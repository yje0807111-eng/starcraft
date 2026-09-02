/* ============================================================================
 * map-stitch.mjs — 업스케일한 네 조각을 **한 장으로 붙인다** (2026-09-02)
 *
 * ⭐ 왜 — map-quarter.mjs 로 겹치게 자른 뒤 AI 로 각각 확대하면, 조각마다 다르게
 *   변형되어 돌아온다(실측: 조각 3·4 가 서로 반대로 40px 씩 밀렸다).
 *   그대로 격자에 놓으면 경계에 선이 보인다.
 *
 * ⚠ **겹침이 있어야 이 도구가 쓸모 있다.** 겹친 띠 안에서 ①위치 ②크기를 조금씩
 *   바꿔 보며 가장 잘 맞는 값을 찾고, 그 띠에서 부드럽게 섞는다.
 *
 * ⛔ 「경계를 찾으려」 하지 말 것 — ART.md §11-4-1 에 두 번 실패한 기록이 있다.
 *   여기서는 경계를 찾는 게 아니라 **겹친 띠 전체를 견주어** 맞춘다.
 *
 * 사용:
 *   node scripts/map-stitch.mjs --up=docs/mock/quarters/up --name=camp \
 *     --src=assets/backgrounds/camp/camp.webp --pad=48
 *   옵션: --range=n(탐색 반경 px · 기본 60) · --scan=n(축소 배율 · 기본 4)
 *         --noscale(크기 탐색 끔) · --out=경로
 *
 * 나오는 것: <out>/<name>_stitched.png + 이음새 진단(겹친 띠의 남은 차이)
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

const UP    = path.resolve(ROOT, opt('up', 'docs/mock/quarters/up'));
const NAME  = opt('name', 'camp');
const SRC   = path.resolve(ROOT, opt('src', 'assets/backgrounds/camp/camp.webp'));
const PAD   = +opt('pad', 48);
const RANGE = +opt('range', 60);
const SCAN  = +opt('scan', 4);
const OUT   = path.resolve(ROOT, opt('out', 'docs/mock/quarters'));
// ⚠ **1.0 아래로는 내려가지 않는다** — 조각을 줄이면 캔버스를 못 덮어 오른쪽·아래에
//   검은 띠가 남고, 그걸 잘라내면 9:16 이 깨진다(실측 0.552). 키우면 넘치는 만큼 잘릴 뿐이다.
const SCALES = has('noscale') ? [1] : [1.0, 1.01, 1.02, 1.03, 1.04];

const meta0 = await sharp(SRC).metadata();
const W0 = meta0.width, H0 = meta0.height;
const hw = Math.floor(W0 / 2), hh = Math.floor(H0 / 2);
const padX = PAD, padY = Math.round(PAD * (hh / hw));

// 원본 좌표계에서 각 조각이 놓이는 자리(자를 때와 같은 규칙)
const PLACE = {
  1: { left: 0,          top: 0,          w: hw + padX, h: hh + padY },
  2: { left: hw - padX,  top: 0,          w: hw + padX, h: hh + padY },
  3: { left: 0,          top: hh - padY,  w: hw + padX, h: hh + padY },
  4: { left: hw - padX,  top: hh - padY,  w: hw + padX, h: hh + padY },
};

const up = {};
for(const n of [1, 2, 3, 4]){
  const p = path.join(UP, `${NAME}_${n}_up.png`);
  if(!fs.existsSync(p)){ console.error('없는 파일: ' + p); process.exit(2); }
  up[n] = { path: p, meta: await sharp(p).metadata() };
}
// 배율 — 조각 1 기준(넷 다 같은 크기로 왔다고 보고, 아니면 각자 제 배율)
const K = up[1].meta.width / PLACE[1].w;
const CW = Math.round(W0 * K), CH = Math.round(H0 * K);

console.log(`  원본 ${W0}×${H0} · 겹침 ${padX}×${padY} · 업스케일 배율 ${K.toFixed(3)} → 캔버스 ${CW}×${CH}`);

/* ── 정렬 탐색 ────────────────────────────────────────────────────────────
 * ⭐ **겹친 띠에서만** 견준다 — 조각 바깥은 이웃이 없어 비교할 수가 없다.
 * ⚠ 축소본으로 찾는다(원본 크기로 하면 한 판에 수십 초씩 걸린다).  */
const sc = SCAN;                                   // 축소 배율
const gray = async (n, scale) => {
  const w = Math.round(up[n].meta.width * scale / sc), h = Math.round(up[n].meta.height * scale / sc);
  const buf = await sharp(up[n].path).resize(w, h, { fit: 'fill' }).grayscale().raw().toBuffer();
  return { buf, w, h };
};
// 조각 n 이 캔버스에서 시작하는 자리(축소본 기준)
const originOf = n => ({ x: PLACE[n].left * K / sc, y: PLACE[n].top * K / sc });

// a(고정) 와 b(움직임) 가 겹치는 캔버스 영역에서 평균 절대차
function overlapDiff(A, oA, B, oB, dx, dy){
  const x0 = Math.max(oA.x, oB.x + dx), x1 = Math.min(oA.x + A.w, oB.x + dx + B.w);
  const y0 = Math.max(oA.y, oB.y + dy), y1 = Math.min(oA.y + A.h, oB.y + dy + B.h);
  if(x1 - x0 < 8 || y1 - y0 < 8) return { v: 1e9, n: 0 };
  let s = 0, c = 0;
  for(let y = Math.ceil(y0) + 2; y < y1 - 2; y += 2){
    for(let x = Math.ceil(x0) + 2; x < x1 - 2; x += 2){
      const ax = Math.round(x - oA.x), ay = Math.round(y - oA.y);
      const bx = Math.round(x - oB.x - dx), by = Math.round(y - oB.y - dy);
      if(ax < 0 || ay < 0 || ax >= A.w || ay >= A.h) continue;
      if(bx < 0 || by < 0 || bx >= B.w || by >= B.h) continue;
      s += Math.abs(A.buf[ay * A.w + ax] - B.buf[by * B.w + bx]); c++; } }
  return { v: c ? s / c : 1e9, n: c };
}

// 조각 1 을 기준으로, 2·3·4 를 차례로 맞춘다(4 는 2·3 양쪽을 함께 본다)
const G1 = await gray(1, 1);
const fix = { 1: { dx: 0, dy: 0, s: 1 } };
const R = Math.round(RANGE * K / sc);

async function solve(n, anchors){
  let best = { v: 1e9, dx: 0, dy: 0, s: 1 };
  for(const s of SCALES){
    const B = await gray(n, s);
    // 크기가 바뀌면 중심을 유지하도록 시작점을 보정한다
    const oB0 = originOf(n);
    const oB = { x: oB0.x - (B.w - up[n].meta.width / sc) / 2, y: oB0.y - (B.h - up[n].meta.height / sc) / 2 };
    for(let dy = -R; dy <= R; dy += 2) for(let dx = -R; dx <= R; dx += 2){
      let tot = 0, cnt = 0;
      for(const a of anchors){
        const r = overlapDiff(a.G, a.o, B, oB, dx, dy);
        if(r.n < 40) { tot = 1e9; break; }
        tot += r.v * r.n; cnt += r.n; }
      if(!cnt) continue;
      const v = tot / cnt;
      if(v < best.v) best = { v, dx, dy, s }; }
  }
  fix[n] = best;
  console.log(`  조각${n}  이동 x${String(Math.round(best.dx * sc / K)).padStart(5)}`
    + ` y${String(Math.round(best.dy * sc / K)).padStart(5)}px · 크기 ×${best.s.toFixed(2)}`
    + `   겹친 띠의 남은 차이 ${best.v.toFixed(1)}`);
  return best;
}

const o1 = originOf(1);
await solve(2, [{ G: G1, o: o1 }]);
await solve(3, [{ G: G1, o: o1 }]);
// 4 는 2·3 양쪽에 맞춘다 — 한쪽만 보면 반대쪽이 벌어진다
const G2 = await gray(2, fix[2].s), G3 = await gray(3, fix[3].s);
const o2 = { x: originOf(2).x + fix[2].dx - (G2.w - up[2].meta.width / sc) / 2,
             y: originOf(2).y + fix[2].dy - (G2.h - up[2].meta.height / sc) / 2 };
const o3 = { x: originOf(3).x + fix[3].dx - (G3.w - up[3].meta.width / sc) / 2,
             y: originOf(3).y + fix[3].dy - (G3.h - up[3].meta.height / sc) / 2 };
await solve(4, [{ G: G2, o: o2 }, { G: G3, o: o3 }]);

/* ── 합성 ────────────────────────────────────────────────────────────────
 * ⭐ 조각 1 을 깔고, 나머지를 **겹친 띠에서 0→1 로 서서히 나타나는 알파**로 얹는다.
 *   선형 페이드라 띠 안에서 두 그림의 비중이 합쳐서 1 이 된다 — 선이 안 생긴다.  */
// ⚠ **섞는 구간이 넓으면 잔상이 생긴다** — 정렬이 완벽하지 않으므로 두 그림이 반투명하게
//   겹치면 직선이 두 겹으로 보인다(실측: 콘크리트 판 이음선·난간·빗금이 전부 이중).
//   흙·풀처럼 무늬가 불규칙한 곳은 넓게 섞어도 안 보이지만, **직선이 있는 곳은 좁아야 한다.**
const FADE = +opt('fade', 0.25);   // 겹친 띠 중 실제로 섞는 비율(0.25 = 띠의 1/4만)
const OVX = Math.max(8, Math.round(padX * 2 * K * FADE)), OVY = Math.max(8, Math.round(padY * 2 * K * FADE));
// 섞기 시작하는 자리 — 띠의 한가운데에서 시작해 FADE 폭만큼만 넘어간다
const OFX = Math.round(padX * 2 * K * (1 - FADE) / 2), OFY = Math.round(padY * 2 * K * (1 - FADE) / 2);
function fadeAlpha(w, h, left, top){
  const a = Buffer.alloc(w * h, 255);
  for(let y = 0; y < h; y++){
    const fy = top ? Math.min(1, Math.max(0, (y - OFY) / OVY)) : 1;
    for(let x = 0; x < w; x++){
      const fx = left ? Math.min(1, Math.max(0, (x - OFX) / OVX)) : 1;
      a[y * w + x] = Math.round(255 * fx * fy); } }
  return a;
}
// 조각이 놓이는 자리 — 크기를 줄이면 그만큼 캔버스를 못 덮는다(오른쪽·아래에 검은 띠).
//   ⚠ 자리는 미리 다 구해 두고, **넷이 함께 덮는 사각형**만 남기고 잘라낸다.
function placeOf(n){
  const f = fix[n], w = Math.round(up[n].meta.width * f.s), h = Math.round(up[n].meta.height * f.s);
  const x = Math.round(PLACE[n].left * K + f.dx * sc - (w - up[n].meta.width) / 2);
  const y = Math.round(PLACE[n].top  * K + f.dy * sc - (h - up[n].meta.height) / 2);
  return { w, h, x, y };
}
const PL = { 1: placeOf(1), 2: placeOf(2), 3: placeOf(3), 4: placeOf(4) };

async function layer(n, left, top){
  const p = PL[n];
  const rgb = await sharp(up[n].path).resize(p.w, p.h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const al = fadeAlpha(p.w, p.h, left, top);
  const rgba = Buffer.alloc(p.w * p.h * 4);
  for(let i = 0; i < p.w * p.h; i++){
    rgba[i*4] = rgb[i*3]; rgba[i*4+1] = rgb[i*3+1]; rgba[i*4+2] = rgb[i*3+2]; rgba[i*4+3] = al[i]; }
  const png = await sharp(rgba, { raw: { width: p.w, height: p.h, channels: 4 } }).png().toBuffer();
  return { input: png, left: Math.max(0, p.x), top: Math.max(0, p.y) };
}
const base = await sharp(up[1].path).resize(PL[1].w, PL[1].h, { fit: 'fill' }).png().toBuffer();
const comp = [{ input: base, left: Math.max(0, PL[1].x), top: Math.max(0, PL[1].y) },
  await layer(2, true, false), await layer(3, false, true), await layer(4, true, true)];

fs.mkdirSync(OUT, { recursive: true });
const dst = path.join(OUT, `${NAME}_stitched.png`);
// 🩹 **검은 띠를 남기지 않는다** — 넷이 모두 덮는 사각형으로 잘라낸다.
const x0 = Math.max(0, PL[1].x, PL[3].x), y0 = Math.max(0, PL[1].y, PL[2].y);
const x1 = Math.min(CW, PL[2].x + PL[2].w, PL[4].x + PL[4].w);
const y1 = Math.min(CH, PL[3].y + PL[3].h, PL[4].y + PL[4].h);
let cropW = Math.max(1, x1 - x0), cropH = Math.max(1, y1 - y0);
// 🎯 **비율은 원본과 같아야 한다** — 맵은 격자 좌표에 매핑된다. 남는 쪽을 조금 더 잘라 맞춘다.
const AR = W0 / H0;
if(cropW / cropH > AR) cropW = Math.round(cropH * AR); else cropH = Math.round(cropW / AR);
const raw = await sharp({ create: { width: CW, height: CH, channels: 3, background: { r: 0, g: 0, b: 0 } } })
  .composite(comp).png({ compressionLevel: 6 }).toBuffer();
await sharp(raw).extract({ left: x0, top: y0, width: cropW, height: cropH })
  .png({ compressionLevel: 6 }).toFile(dst);
if(cropW !== CW || cropH !== CH)
  console.log(`  ✂ 가장자리를 잘라냈다 — ${CW}×${CH} → ${cropW}×${cropH}`
    + `  (비율 ${(cropW/cropH).toFixed(3)} vs 원본 ${AR.toFixed(3)}${Math.abs(cropW/cropH - AR) < 0.004 ? ' ✅ 같다' : ' ⚠ 다르다'})`);
console.log('  🖼 ' + path.relative(ROOT, dst));
