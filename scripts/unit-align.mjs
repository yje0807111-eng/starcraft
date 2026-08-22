/* 방향별 걷기 프레임 → 위상 정렬 + 좌우 반전으로 8방향 완성
 *
 *   node scripts/unit-align.mjs <베이스폴더> --prefix <유닛id> [옵션]
 *
 *   --out <폴더>     출력 베이스(기본: 입력 베이스와 같은 곳, _aligned 접미사)
 *   --no-mirror      반전본(5·6·7)을 만들지 않는다
 *   --no-align       위상 정렬을 하지 않는다(순서 그대로 복사)
 *   --sheet          8방향 대조 시트 _sheet.jpg 를 만든다
 *
 * 입력은 unit-frames.mjs 가 만든 폴더 다섯 개다:
 *   <베이스>/<prefix>_0  (카메라 쪽)   _1 (아래-오른쪽)  _2 (오른쪽)
 *   <베이스>/<prefix>_3  (위-오른쪽)   _4 (멀어짐)
 * 출력은 여덟 개(0~7). 5·6·7 은 3·2·1 의 좌우 반전이다.
 *
 * ── 왜 위상 정렬이 필요한가 ────────────────────────────────────────
 * 방향마다 영상을 따로 만들면 걸음의 '시작 지점'이 다르다. 그대로 쓰면 유닛이
 * 방향을 틀 때 다리가 순간이동한 것처럼 튄다. 보폭·속도 차이보다 이게 훨씬 눈에 띈다.
 * 그래서 모든 방향에서 '발이 가장 벌어진 순간'을 찾아 그것을 f00 으로 돌려놓는다.
 *
 * 발 벌어짐은 피사체 박스 아래 25% 띠의 대각 길이로 잰다 — 가로 폭만 쓰면 정면·후면
 * 뷰에서 다리가 앞뒤(=화면 세로)로 벌어져 신호가 죽는다.
 *
 * ⚠ 한 사이클 안에 발이 최대로 벌어지는 순간은 두 번(왼발 주도·오른발 주도) 있다.
 *   여기서는 더 큰 쪽 하나를 고른다 — 반 사이클 어긋날 수 있지만 사족보행에서는
 *   좌우가 거의 대칭이라 눈에 띄지 않는다. 정확히 맞추려면 --no-align 후 손으로 돌린다.
 *
 * ⚠ 반전은 정렬 뒤에 한다. 같은 프레임을 뒤집는 것이라 위상이 그대로 따라온다.
 *   좌우가 뒤집히므로 한 손에만 든 물건은 반대 손으로 간다(페럴 장비는 대칭이라 무해).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const BASE = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const flag = k => argv.includes('--' + k);
if (!BASE || BASE.startsWith('--')) {
  console.error('사용: node scripts/unit-align.mjs <베이스폴더> --prefix <유닛id> [--out 폴더] [--no-mirror] [--no-align] [--sheet]');
  process.exit(2);
}
const PREFIX = opt('prefix', null);
if (!PREFIX) { console.error('--prefix <유닛id> 가 필요합니다.'); process.exit(2); }
const OUT = opt('out', BASE + '_aligned');
const MIRROR_FROM = { 5: 3, 6: 2, 7: 1 };   // 반전 대응(왼쪽 = 오른쪽의 거울)

const dirOf = (base, d) => path.join(base, PREFIX + '_' + d);
const framesIn = dir => fs.readdirSync(dir).filter(f => /^f\d+\.png$/.test(f)).sort()
  .map(f => path.join(dir, f));

// 발이 바닥에 가장 많이 닿은 프레임 찾기 — 피사체 박스 아래 12% 띠의 화소 수.
// 발이 벌어진 '폭'으로 재면 정면·후면 뷰에서 다리가 화면 안쪽(깊이 방향)으로 흔들려
// 신호가 죽는다 — 실측 진폭비가 1.08 로 노이즈였다. 바닥 띠 화소 수는 다리를 들면
// 줄고 딛으면 늘어서, 어느 방향에서도 1.4~2.4 배로 또렷하게 흔들린다.
async function groundContact(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const on = (x, y) => data[(y * W + x) * ch + 3] >= 128;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (on(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return 0;
  const band = y1 - Math.round((y1 - y0) * 0.12);      // 피사체 아래 12% = 발
  let n = 0;
  for (let y = band; y <= y1; y++) for (let x = x0; x <= x1; x++) if (on(x, y)) n++;
  return n;
}

fs.mkdirSync(OUT, { recursive: true });
console.log('베이스 ' + BASE + '\n출력   ' + OUT + '\n');

// ── ① 위상 정렬 ────────────────────────────────────────────────────
const shifts = {};
for (let d = 0; d <= 4; d++) {
  const src = dirOf(BASE, d);
  if (!fs.existsSync(src)) { console.log('방향 ' + d + ' — 폴더 없음, 건너뜀 (' + src + ')'); continue; }
  const fl = framesIn(src);
  if (!fl.length) { console.log('방향 ' + d + ' — 프레임 없음, 건너뜀'); continue; }
  const sp = [];
  for (const f of fl) sp.push(await groundContact(f));
  let at = 0;
  if (!flag('no-align')) for (let i = 1; i < sp.length; i++) if (sp[i] > sp[at]) at = i;
  shifts[d] = at;
  const dst = dirOf(OUT, d);
  fs.mkdirSync(dst, { recursive: true });
  for (let i = 0; i < fl.length; i++) {
    const from = fl[(i + at) % fl.length];
    fs.copyFileSync(from, path.join(dst, 'f' + String(i).padStart(2, '0') + '.png'));
  }
  // 진폭비가 낮으면 최댓값이 걸음이 아니라 노이즈일 수 있다 — 그대로 두지 말고 알려 준다
  const amp = Math.max.apply(null, sp) / Math.max(1, Math.min.apply(null, sp));
  console.log('방향 ' + d + '  접지 ' + sp.map(v => String(v).padStart(6)).join('') +
    '   진폭 ' + amp.toFixed(2) + (amp < 1.3 ? ' ⚠ 신호 약함(손으로 확인)' : '') +
    '   → f' + String(at).padStart(2, '0') + ' 을 맨 앞으로');
}

// ── ② 좌우 반전으로 5·6·7 만들기 ───────────────────────────────────
if (!flag('no-mirror')) {
  console.log('');
  for (const d of Object.keys(MIRROR_FROM)) {
    const from = MIRROR_FROM[d], src = dirOf(OUT, from);
    if (!fs.existsSync(src)) { console.log('방향 ' + d + ' — 원본 ' + from + ' 이 없어 건너뜀'); continue; }
    const dst = dirOf(OUT, d);
    fs.mkdirSync(dst, { recursive: true });
    const fl = framesIn(src);
    for (let i = 0; i < fl.length; i++)
      await sharp(fl[i]).flop().png().toFile(path.join(dst, 'f' + String(i).padStart(2, '0') + '.png'));
    console.log('방향 ' + d + '  ← 방향 ' + from + ' 좌우 반전 (' + fl.length + '장)');
  }
}

// ── ③ 대조 시트 ────────────────────────────────────────────────────
if (flag('sheet')) {
  const T = 180, rows = [];
  for (let d = 0; d <= 7; d++) { const dir = dirOf(OUT, d); if (fs.existsSync(dir)) rows.push({ d, fl: framesIn(dir) }); }
  const cols = Math.max.apply(null, rows.map(r => r.fl.length));
  const tiles = [];
  for (let r = 0; r < rows.length; r++) for (let i = 0; i < rows[r].fl.length; i++) {
    const lbl = '<svg width="' + T + '" height="' + T + '"><text x="4" y="18" font-size="16" fill="#ff0" font-family="monospace">' + rows[r].d + '.' + i + '</text></svg>';
    const b = await sharp(rows[r].fl[i]).resize(T, T, { fit: 'contain', background: '#00000000' })
      .composite([{ input: Buffer.from(lbl), top: 0, left: 0 }]).png().toBuffer();
    tiles.push({ input: b, top: r * T, left: i * T });
  }
  const sh = path.join(OUT, '_sheet.jpg');
  await sharp({ create: { width: cols * T, height: rows.length * T, channels: 3, background: '#6e6e6e' } })
    .composite(tiles).jpeg({ quality: 84 }).toFile(sh);
  console.log('\n✓ ' + sh + '  (8방향 대조 시트)');
}
console.log('\n완료 — ' + OUT);
