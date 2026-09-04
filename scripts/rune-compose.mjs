/* ============================================================================
 * rune-compose.mjs — 룬 아이콘 25장을 **판 4장 + 문양 11장**으로 조합한다 (2026-09-04)
 *
 * ⭐ 왜 스크립트인가 — AI 합성을 두 번 시도했고 두 번 다 **문양이 판 색으로 물들었다.**
 *   모델이 「색이 다른 두 요소를 그대로 두고 합치는 것」을 못 한다(2026-09-04 실측).
 *   여기서 겹치면 25장이 **전부 같은 자리·같은 크기**가 되고, 마음에 안 들면 값 하나만 고친다.
 *
 * ⚠ 문양은 **검정 배경 위의 발광 그림**이다. 그래서 `screen` 으로 얹는다 —
 *   검정(0)은 아무것도 더하지 않아 배경이 저절로 사라진다.
 *   ⛔ `over` 로 얹지 말 것 — 문양의 검정 사각이 판을 가린다.
 *
 * 넣는 곳: docs/mock/rune/
 *   판   tile_low.png · tile_mid.png · tile_high.png · tile_uniq.png
 *   문양 sym_<id>.png  (id 는 RUNE_LIST 의 것 — tap gas pop atk aspd hp heal
 *                       speed wspd mapg fever)
 * 나오는 곳: assets/icons/rune/<id>_<등급>.webp   (128×128 · 일반 21 + 유니크 4)
 *
 * 사용:
 *   node scripts/rune-compose.mjs               # 전부
 *   node scripts/rune-compose.mjs --only=tap    # 한 종류만(크기 맞출 때)
 *   옵션: --scale=0.46(문양이 판 폭에서 차지하는 비율) · --size=128 · --sheet(대조판도 만든다)
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

const SRC   = path.resolve(ROOT, 'docs/mock/rune');
const OUT   = path.resolve(ROOT, 'assets/icons/rune');
const SIZE  = +opt('size', 128);
// 📐 0.44 → 0.64 (2026-09-04 사용자 지적: 「룬과 칸 사이 검은 여백」 — 문양이 판에 비해 작아 안쪽 검은 면이
//   넓게 남았다. 성좌 칸 실제 크기(44px)에서 0.44/0.56/0.66 을 나란히 보고 정했다 — 0.66 도 테두리에 안 닿는다).
const SCALE = +opt('scale', 0.64);          // **잘라낸 문양**의 폭 ÷ 판 폭
// ⬆ **눈으로 보는 가운데는 기하학적 가운데보다 조금 위다.**
//   문양을 픽셀 단위로 정확히 중앙에 놓아도(실측 위 36 / 아래 36) 아래로 처져 보인다 —
//   손끝의 룬처럼 아래쪽에 가로줄이 있는 글리프는 무게가 아래에 쏠리기 때문이다.
//   ⇒ 판 크기의 이 비율만큼 위로 올린다. 음수가 위쪽.
const DY = +opt('dy', -0.0266);             // 판 폭 대비 세로 보정(−가 위 · 128px 에서 3.4px)
const ONLY  = opt('only', '');

// 🔗 **룬 표는 js/22-camp-rune.js 가 단일 소스다.** 여기서는 id 와 등급 여부만 안다.
//   ⛔ 값·이름을 여기에 복사하지 말 것 — 두 벌이 되면 반드시 어긋난다.
// 🔧 **룬마다 따로 잡아 주는 값** — 글리프 모양에 따라 눈에 보이는 가운데가 다르다.
//   ⚠ 기하학적으로는 전부 정중앙인데도(실측) 어떤 것은 떠 보이고 어떤 것은 커 보인다.
//   dy: 음수가 위 · scale: 잘라낸 문양의 폭 ÷ 판 폭. 없으면 기본값(DY·SCALE)을 쓴다.
const TWEAK = {
  hp:    { dy: +0.014 },   // 역삼각이라 무게가 위에 쏠려 떠 보였다 — 오히려 내린다
  fever: { dy: +0.014 },   // Y 자도 같은 이유
  speed: { scale: 0.55 }   // 모래시계는 꽉 찬 사각이라 같은 값에서도 커 보인다(기본의 0.86 배)
};
// ⚠ 갈래 순서 = RUNE_GRPS(경제·전투·성장). 표는 js/22-camp-rune.js 가 단일 소스다.
const NORM = ['tap', 'gas', 'mine', 'reb',      // 💠 경제
              'atk', 'aspd', 'hp', 'heal',      // ⚔ 전투
              'exp', 'kill', 'mapg', 'fevg'];   // 🌱 성장
const UNIQ = ['speed', 'wspd', 'fever', 'cost'];
// 🎨 **유니크는 성좌 색을 따라간다**(2026-09-04 사용자 확정).
//   ⚠ 유니크 칸은 성좌 **한가운데**라, 문양이 금색 하나면 그 칸만 색이 튄다.
//   ⭐ 그래서 같은 문양을 갈래 색으로 물들여 3벌 더 만든다 — 다시 뽑지 않는다.
//     `<id>_uniq.webp`(기본 금 · 가방·상점용) + `<id>_uniq_<갈래>.webp`(성좌용)
//   ⛔ 색을 코드에서 CSS 필터로 입히지 말 것 — 발광 코어까지 물들어 탁해진다.
const GRP_COL = { eco:[0x7e,0xff,0xc9], war:[0xff,0xa3,0xb8], grow:[0xe6,0xee,0xf8] };
const GRADES = ['low', 'mid', 'high'];

const tilePath = g => path.join(SRC, 'tile_' + g + '.png');
const symPath  = id => path.join(SRC, 'sym_' + id + '.png');

const missing = [];
for(const g of [...GRADES, 'uniq']) if(!fs.existsSync(tilePath(g))) missing.push('tile_' + g + '.png');
for(const id of [...NORM, ...UNIQ]){
  if(ONLY && id !== ONLY) continue;
  if(!fs.existsSync(symPath(id))) missing.push('sym_' + id + '.png'); }
if(missing.length){
  console.log('  ⚠ 아직 없는 파일 ' + missing.length + '개 — 있는 것만 만든다');
  for(const m of missing.slice(0, 14)) console.log('    · ' + m); }

fs.mkdirSync(OUT, { recursive: true });

// ✂ **문양이 실제로 그려진 자리**를 찾는다 — 원본은 가운데가 아니다.
//   ⚠ 뽑은 그림마다 글리프가 프레임 안에서 조금씩 다른 자리에 있고, 무게중심도 제각각이다
//     (손끝의 룬은 아래 두 줄 때문에 아래로 처져 보였다 — 2026-09-04 사용자 지적).
//   ⭐ 그래서 **밝은 픽셀의 경계 상자**를 재고, 그 중심을 판 중심에 맞춘다.
//     그러면 원본이 어디에 치우쳐 있든 11장이 전부 같은 자리에 온다.
//   ⚠ 글로우까지 잉크로 세면 상자가 번진다 — 문턱(THRESH)을 두어 심지만 잡는다.
const THRESH = 40;                       // 0~255 · 이보다 밝으면 「그려진 곳」
async function inkBox(file){
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for(let y = 0; y < H; y++){ for(let x = 0; x < W; x++){
    const i = (y*W + x)*C;
    if(Math.max(data[i], data[i+1], data[i+2]) < THRESH) continue;
    if(x < x0) x0 = x; if(x > x1) x1 = x;
    if(y < y0) y0 = y; if(y > y1) y1 = y; } }
  if(x1 < 0) return { left:0, top:0, width:W, height:H };   // 온통 검정이면 통째로
  return { left:x0, top:y0, width:x1-x0+1, height:y1-y0+1 };
}

// 🎭 **육각형 밖을 투명하게 잘라낸다** (2026-09-04).
//   ⚠ 그림은 검정 배경 위에 그려져 있다. 그대로 쓰면 성좌 판에서 **육각형 뒤에 검은 사각**이 남는다.
//   ⛔ 「어두운 픽셀을 투명하게」로 하지 말 것 — 판 안쪽 면도 어두워서 구멍이 뚫린다.
//   ⭐ 판이 정육각형(꼭짓점이 위)이라는 것을 알고 있으므로 **같은 모양의 마스크**를 만들어 씌운다.
//     반경을 조금 키우고(MASK_R) 가장자리를 흐리게 해서 발광이 각져 잘리지 않게 한다.
const MASK_R = 1.02;                     // 육각형 반경 배수 — 1 이면 딱 맞고, 크면 발광이 더 남는다
const MASK_BLUR = 1.2;                   // 가장자리 흐림(px)
function hexMaskSvg(size){
  const c = size / 2, r = c * MASK_R, q = [];
  for(let i = 0; i < 6; i++){ const a = Math.PI / 180 * (60 * i - 90);
    q.push((c + r * Math.cos(a)).toFixed(1) + ',' + (c + r * Math.sin(a)).toFixed(1)); }
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">'
    + '<polygon points="' + q.join(' ') + '" fill="#fff"/></svg>');
}
let _maskCache = null;
async function hexMask(size){
  if(_maskCache && _maskCache.size === size) return _maskCache.buf;
  const buf = await sharp(hexMaskSvg(size)).blur(MASK_BLUR).toColourspace('b-w').raw().toBuffer();
  _maskCache = { size, buf }; return buf;
}

// 문양을 판 위에 screen 으로 얹는다(위 설명)
// tint 를 주면 문양을 그 색으로 물들인다(유니크의 갈래 색 벌 — 위 GRP_COL 설명).
// 📐 **문양은 판의 「안쪽 면」 안에 들어가야 한다** (2026-09-04 사용자 지적: 「룬 형태가 타일 바깥으로 삐져나온다」).
//   ⚠ 판 그림의 육각은 **테두리 띠가 두껍다** — 문양이 놓일 자리는 그 안쪽이다.
//     판 4장을 실측해(가로 중앙선·세로 중앙선을 훑어 밝은 띠가 끝나는 곳) 가장 조이는 값을 쓴다:
//       가로 반폭  low 46 · mid 51 · high 53 · uniq 50   → 46 (반지름으로 환산 53.1)
//       세로 반높이 low 58 · mid 56 · high 45 · uniq 54   → 45 (상급 판의 위 테두리가 가장 두껍다)
//   ⛔ 정사각 패딩 뒤 SCALE 하나로만 키우지 말 것 — 종횡비가 제각각이라 정사각에 가까운
//     문양(윤회의 나선·치유)이 육각 좌우 경사면을 넘는다(실측: SCALE 0.64 에서 1px 초과).
const FACE_R  = 53.1 / 64;      // 안쪽 면의 육각 반지름 ÷ 판 반지름
const FACE_HY = 45   / 64;      // 안쪽 면의 반높이 ÷ 판 반지름
const FACE_PAD = 0.95;          // 발광 번짐 여유 — 잉크 상자 밖으로 빛이 조금 더 퍼진다
// 육각(뾰족한 쪽이 위)의 반폭 — 중심에서 dy 만큼 떨어진 높이에서
const hexHalf = (dy, R) => (dy <= R / 2) ? (0.866 * R) : (0.866 * R * Math.max(0, (R - dy) / (R / 2)));
// 잉크 상자(rw×rh, 정사각 변 대비 비율)가 안쪽 면에 들어가는 **정사각 변의 상한**
//   dyPx 만큼 옮겨 놓으므로 위·아래 모서리를 따로 잰다.
function faceFit(rw, rh, dyPx){
  const R = SIZE / 2 * FACE_R * FACE_PAD, HY = SIZE / 2 * FACE_HY * FACE_PAD;
  const ok = side => { const hx = side * rw / 2, h = side * rh / 2;
    const top = Math.abs(-h + dyPx), bot = Math.abs(h + dyPx);
    if(Math.max(top, bot) > HY) return false;
    return hx <= hexHalf(top, R) && hx <= hexHalf(bot, R); };
  let lo = 0, hi = SIZE * 2;
  for(let i = 0; i < 40; i++){ const m = (lo + hi) / 2; if(ok(m)) lo = m; else hi = m; }
  return lo; }
async function compose(tile, sym, outFile, id, tint){
  const tw = TWEAK[id] || {};
  const scale = (tw.scale != null) ? tw.scale : SCALE;
  const dy    = (tw.dy    != null) ? tw.dy    : DY;
  // ✂ **판도 그려진 자리로 가운데 맞춘다** — 뽑은 판마다 육각형이 프레임 안에서 조금씩 다른
  //   자리에 있다. 판이 치우쳐 있으면 문양만 가운데 놓아 봐야 서로 어긋난다
  //   (2026-09-04: 문양을 중앙에 놓았는데도 위아래 여백이 달랐던 이유가 이것이었다).
  const tb = await inkBox(tile);
  const base = await sharp(tile)
    .extract({ left: tb.left, top: tb.top, width: tb.width, height: tb.height })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } })
    .png().toBuffer();
  // ✂ 그려진 자리만 잘라내 정사각으로 맞춘다 — 잘라낸 뒤라 SCALE 은 「잉크가 판에서 차지하는 폭」이다
  const bx = await inkBox(sym);
  const side = Math.max(bx.width, bx.height);
  const sq = {
    left: Math.round(bx.left - (side - bx.width)/2),
    top:  Math.round(bx.top  - (side - bx.height)/2),
    width: side, height: side };
  // 📐 안쪽 면 상한 — 원하는 크기(scale)와 들어가는 크기 중 **작은 쪽**을 쓴다
  const want = SIZE * scale;
  const cap  = faceFit(bx.width / side, bx.height / side, Math.round(SIZE * dy));
  const sw = Math.round(Math.min(want, cap));
  if(cap < want) fitLog.push([id, (cap / SIZE).toFixed(3), scale.toFixed(2)]);
  let ov = sharp(sym)
    .extract({ left: Math.max(0, sq.left), top: Math.max(0, sq.top),
               width: sq.width, height: sq.height })
    .resize(sw, sw, { fit: 'contain', background: { r:0, g:0, b:0, alpha:255 } })
    .removeAlpha();
  let over = await ov.png().toBuffer();
  // 🎨 **색을 갈아입힌다** — ⛔ sharp 의 tint 로는 안 된다(2026-09-04 실측):
  //   문양의 심지가 이미 흰색(255)이라 tint 를 걸어도 흰색 그대로 남아 색이 안 보인다
  //   (네 벌을 재 보니 전부 rgb(255,255,255) 였다). 그래서 픽셀을 직접 칠한다.
  //   ⭐ 원본 밝기(L)를 그대로 쓰되, 아주 밝은 곳만 흰빛을 조금 남긴다 — 발광이 죽지 않게.
  if(tint){
    const { data, info } = await sharp(over).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height, out = Buffer.alloc(n * 3);
    for(let i = 0; i < n; i++){
      const L = Math.max(data[i*3], data[i*3+1], data[i*3+2]) / 255;
      const w = Math.max(0, (L - 0.82) / 0.18) * 0.55;      // 심지에 남기는 흰빛
      for(let c = 0; c < 3; c++)
        out[i*3+c] = Math.min(255, Math.round(tint[c] * L + 255 * w)); }
    over = await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
      .png().toBuffer(); }
  const off = Math.round((SIZE - sw) / 2);
  const offY = Math.max(0, Math.min(SIZE - sw, off + Math.round(SIZE * dy)));
  const flat = await sharp(base)
    .composite([{ input: over, left: off, top: offY, blend: 'screen' }])
    .removeAlpha().raw().toBuffer();
  // 🎭 육각 마스크를 알파로 붙인다(위 설명)
  const m = await hexMask(SIZE);
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  for(let i = 0; i < SIZE * SIZE; i++){
    rgba[i*4] = flat[i*3]; rgba[i*4+1] = flat[i*3+1]; rgba[i*4+2] = flat[i*3+2];
    rgba[i*4+3] = m[i]; }
  await sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100 }).toFile(outFile);
  return fs.statSync(outFile).size;
}

// 🔷 **문양만** 따로 낸다 — 성좌 판이 판(육각)을 도형으로 그리기 때문이다(2026-09-04 사용자 확정 ④안).
//   ⭐ 판을 벡터로 그리면 등급 색이 테두리·뒷광·번짐에 실려 **상태에 반응**한다. 그림은 못 한다.
//   ⚠ 배경이 검정인 원본을 그대로 얹으면 육각 안에 검은 사각이 남는다 —
//     **밝기를 알파로** 옮긴다(글로우가 자연스럽게 사라진다). ⛔ 문턱으로 자르지 말 것: 가장자리가 톱니가 된다.
//   ⚠ 가방·상점은 그대로 합친 그림(webp)을 쓴다 — 거기는 HTML 이라 SVG 도형을 못 쓴다.
const GLYPH_OUT = path.resolve(ROOT, 'assets/icons/rune/glyph');
const GLYPH_SIZE = 128;
async function glyph(sym, outFile, tint){
  const bx = await inkBox(sym);
  const side = Math.max(bx.width, bx.height);
  const sq = { left: Math.round(bx.left - (side - bx.width) / 2),
               top:  Math.round(bx.top  - (side - bx.height) / 2),
               width: side, height: side };
  const { data, info } = await sharp(sym)
    .extract({ left: Math.max(0, sq.left), top: Math.max(0, sq.top), width: sq.width, height: sq.height })
    .resize(GLYPH_SIZE, GLYPH_SIZE, { fit: 'contain', background: { r:0, g:0, b:0, alpha:255 } })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, out = Buffer.alloc(n * 4);
  for(let i = 0; i < n; i++){
    let r = data[i*3], g = data[i*3+1], b = data[i*3+2];
    const L = Math.max(r, g, b);                       // 밝기 = 알파
    if(tint){ const k = L / 255;                       // 🎨 갈래 색으로 갈아입힌다(유니크)
      const w = Math.max(0, (k - 0.82) / 0.18) * 0.55; // 심지에 남기는 흰빛
      r = Math.min(255, Math.round(tint[0] * k + 255 * w));
      g = Math.min(255, Math.round(tint[1] * k + 255 * w));
      b = Math.min(255, Math.round(tint[2] * k + 255 * w)); }
    // ⚠ 알파를 곱한 색이 아니라 **원래 색**을 넣는다(webp 는 straight alpha 다).
    const k2 = L ? 255 / L : 0;
    out[i*4]   = Math.min(255, Math.round(r * k2));
    out[i*4+1] = Math.min(255, Math.round(g * k2));
    out[i*4+2] = Math.min(255, Math.round(b * k2));
    out[i*4+3] = L; }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100 }).toFile(outFile);
  return fs.statSync(outFile).size; }

const fitLog = [];
const made = [];
const gmade = [];
for(const id of NORM){
  if(ONLY && id !== ONLY) continue;
  if(!fs.existsSync(symPath(id))) continue;
  for(const g of GRADES){
    if(!fs.existsSync(tilePath(g))) continue;
    const f = path.join(OUT, id + '_' + g + '.webp');
    const sz = await compose(tilePath(g), symPath(id), f, id);
    made.push([id + '_' + g, sz]); }
  // 🔷 성좌 판이 쓰는 문양 — 등급과 무관하게 한 장이다(판은 도형이 그린다)
  fs.mkdirSync(GLYPH_OUT, { recursive: true });
  gmade.push([id, await glyph(symPath(id), path.join(GLYPH_OUT, id + '.webp'))]); }
for(const id of UNIQ){
  if(ONLY && id !== ONLY) continue;
  if(!fs.existsSync(symPath(id)) || !fs.existsSync(tilePath('uniq'))) continue;
  const f = path.join(OUT, id + '_uniq.webp');
  const sz = await compose(tilePath('uniq'), symPath(id), f, id);
  made.push([id + '_uniq', sz]);
  // 🎨 갈래 색 벌 — 성좌 한가운데에 앉을 때 쓴다(위 GRP_COL 설명)
  for(const g in GRP_COL){
    const f2 = path.join(OUT, id + '_uniq_' + g + '.webp');
    const sz2 = await compose(tilePath('uniq'), symPath(id), f2, id, GRP_COL[g]);
    made.push([id + '_uniq_' + g, sz2]); }
  // 🔷 문양 — 유니크는 **앉은 성좌 색**을 따르므로 갈래마다 한 장씩(2026-09-04)
  fs.mkdirSync(GLYPH_OUT, { recursive: true });
  gmade.push([id, await glyph(symPath(id), path.join(GLYPH_OUT, id + '.webp'))]);
  for(const g in GRP_COL)
    gmade.push([id + '_' + g, await glyph(symPath(id), path.join(GLYPH_OUT, id + '_' + g + '.webp'), GRP_COL[g])]); }

if(!made.length){ console.log('  만든 것이 없다 — docs/mock/rune/ 에 파일을 넣어 주세요'); process.exit(0); }
const tot = made.reduce((a, b) => a + b[1], 0);
console.log('  🔷 ' + made.length + '장 · 합계 ' + (tot/1024).toFixed(0) + 'KB · 평균 '
  + (tot/made.length/1024).toFixed(1) + 'KB   문양 비율 ' + SCALE + ' · 올림 ' + DY + ' · ' + SIZE + 'px');
console.log('  📁 ' + path.relative(ROOT, OUT));
if(fitLog.length){ const seen = {};
  const q = fitLog.filter(r => seen[r[0]] ? false : (seen[r[0]] = 1));
  console.log('  📐 판 안쪽 면에 맞춰 줄인 문양 ' + q.length + '개 — '
    + q.map(r => r[0] + ' ' + r[2] + '→' + r[1]).join(' · ')); }
if(gmade.length){ const gt = gmade.reduce((a, b) => a + b[1], 0);
  console.log('  🔷 문양(성좌 판용) ' + gmade.length + '장 · 합계 ' + (gt/1024).toFixed(0) + 'KB');
  console.log('  📁 ' + path.relative(ROOT, GLYPH_OUT)); }

// 🖼 대조판 — 이름표를 붙여 늘어놓는다. ⚠ 트리 33장에서 이 판이 없었으면 어긋난 것을 못 찾았다(ART.md §15-3).
if(has('sheet') && made.length){
  const COLS = 6, CELL = SIZE + 16, ROWS = Math.ceil(made.length / COLS);
  const canvas = sharp({ create: { width: COLS*CELL, height: ROWS*CELL,
    channels: 3, background: { r:8, g:10, b:14 } } });
  const parts = [];
  for(let i = 0; i < made.length; i++){
    parts.push({ input: path.join(OUT, made[i][0] + '.webp'),
      left: (i % COLS)*CELL + 8, top: Math.floor(i/COLS)*CELL + 8 }); }
  const f = path.resolve(ROOT, 'docs/mock/rune/_sheet.png');
  await canvas.composite(parts).png().toFile(f);
  console.log('  🖼 대조판 ' + path.relative(ROOT, f)); }
