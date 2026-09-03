/* ============================================================================
 * map-merge.mjs — 업스케일한 **보이는 부분**을 원본 자리에 되돌려 넣는다 (2026-09-02)
 *
 * ⭐ 파이프라인의 마지막 칸이다:
 *      map-visible.mjs  → 보이는 데만 잘라내고 4등분
 *      (AI 로 각 조각 업스케일)
 *      map-stitch.mjs   → 네 조각을 한 장으로
 *      map-merge.mjs    → **여기** — 원본 좌표계로 되돌려 게임에 넣을 파일을 만든다
 *
 * ⚠ 왜 되돌려야 하나 — 잘라낸 것은 원본의 71% 뿐이다. 그대로 배경으로 쓰면
 *   `background-size:auto 118% · center bottom` 계산이 통째로 어긋나 맵이 밀린다.
 *   ⛔ CSS 를 고쳐서 맞추려 하지 말 것 — 던전마다 잘린 양이 달라 유지가 안 된다.
 *   ⭐ 원본을 목표 폭으로 늘리고, 그 위에 고화질 조각을 **제자리에** 얹는다.
 *     안 보이는 29% 는 늘린 원본 그대로다 — 어차피 화면에 안 나온다.
 *
 * ⚠ 경계는 좁게 섞는다(--fade). 안 보이는 자리라 티가 날 일은 없지만,
 *   화질이 뚝 끊기는 선이 남으면 나중에 「여기 왜 이러지」 하고 헤매게 된다.
 *
 * 사용:
 *   node scripts/map-merge.mjs --src=assets/backgrounds/dungeons/dg1.webp \
 *     --up=docs/mock/visible/up/dg1_stitched.png --width=2400 --blur=0.6
 *   옵션: --out=경로(기본 = src 를 덮어쓴다) · --fade=px(기본 24) · --dry(쓰지 않고 계산만)
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import sharp from 'sharp';

sharp.cache(false);
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const has = k => argv.includes('--' + k);

const SRC   = path.resolve(ROOT, opt('src', ''));
const UP    = path.resolve(ROOT, opt('up', ''));
const WIDTH = +opt('width', 2400);
const BLUR  = +opt('blur', 0.6);
const FADE  = +opt('fade', 24);
const OUT   = path.resolve(ROOT, opt('out', opt('src', '')));

if(!fs.existsSync(SRC) || !fs.existsSync(UP)){
  console.error('--src 와 --up 을 주세요'); process.exit(2); }

// 📐 map-visible.mjs 와 **같은 값**이어야 한다 — 거기서 그 비율로 잘랐다.
//   ⛔ 한쪽만 고치면 얹는 자리가 어긋난다. 바꿀 일이 있으면 둘을 함께 본다.
const VIS = { x0: 169 / 1600, x1: 1431 / 1600, y0: 447 / 2930, y1: 2875 / 2930 };
const AR = 9 / 16;

const m = await sharp(SRC).metadata();
const W0 = m.width, H0 = m.height;
// map-visible 이 실제로 자른 사각형을 그대로 다시 계산한다
let x0 = Math.round(VIS.x0 * W0), x1 = Math.round(VIS.x1 * W0);
let y0 = Math.round(VIS.y0 * H0), y1 = Math.round(VIS.y1 * H0);
let cw = x1 - x0, chh = y1 - y0;
const wantW = Math.round(chh * AR);
if(wantW > cw){
  const add = wantW - cw, l = Math.floor(add / 2);
  x0 -= l; x1 += add - l;
  if(x0 < 0){ x1 += -x0; x0 = 0; }
  if(x1 > W0){ x0 -= (x1 - W0); x1 = W0; }
  x0 = Math.max(0, x0); x1 = Math.min(W0, x1);
} else if(wantW < cw){
  const wantH = Math.round(cw / AR), add = wantH - chh;
  y0 = Math.max(0, y0 - add); if(y1 - y0 < wantH) y1 = Math.min(H0, y0 + wantH);
}
cw = x1 - x0; chh = y1 - y0;

const K = WIDTH / W0;                       // 목표 배율
const OW = WIDTH, OH = Math.round(H0 * K);
const px = Math.round(x0 * K), py = Math.round(y0 * K);
const pw = Math.round(cw * K), phh = Math.round(chh * K);

console.log(`  원본 ${W0}×${H0} → ${OW}×${OH} (×${K.toFixed(2)})`);
console.log(`  얹을 자리 ${px},${py}  ${pw}×${phh}  (넓이의 ${(pw*phh/(OW*OH)*100).toFixed(0)}%)`);
if(has('dry')) process.exit(0);

// ① 바탕 = 원본을 목표 폭으로 늘린 것(안 보이는 자리를 채운다)
const base = await sharp(SRC).resize(OW, OH).blur(BLUR > 0 ? BLUR : undefined).removeAlpha().raw().toBuffer();
// ② 얹을 것 = 업스케일한 조각을 그 자리 크기로
const overRGB = await sharp(UP).resize(pw, phh, { fit: 'fill' }).blur(BLUR > 0 ? BLUR : undefined)
  .removeAlpha().raw().toBuffer();
// ③ 가장자리만 부드럽게 — 화질이 뚝 끊기는 선을 남기지 않는다
const rgba = Buffer.alloc(pw * phh * 4);
for(let y = 0; y < phh; y++){
  const fy = FADE > 0 ? Math.min(1, Math.min(y, phh - 1 - y) / FADE) : 1;
  for(let x = 0; x < pw; x++){
    const fx = FADE > 0 ? Math.min(1, Math.min(x, pw - 1 - x) / FADE) : 1;
    const i = y * pw + x;
    rgba[i*4] = overRGB[i*3]; rgba[i*4+1] = overRGB[i*3+1]; rgba[i*4+2] = overRGB[i*3+2];
    rgba[i*4+3] = Math.round(255 * Math.min(fx, fy)); } }
const overPng = await sharp(rgba, { raw: { width: pw, height: phh, channels: 4 } }).png().toBuffer();

const tmp = OUT + '.tmp.webp';
await sharp(base, { raw: { width: OW, height: OH, channels: 3 } })
  .composite([{ input: overPng, left: px, top: py }])
  .webp({ quality: 82 }).toFile(tmp);
fs.renameSync(tmp, OUT);
const sz = fs.statSync(OUT).size;
console.log(`  🖼 ${path.relative(ROOT, OUT)}  ${(sz/1024/1024).toFixed(2)}MB`);
