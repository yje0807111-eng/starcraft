/* 정렬 끝난 프레임 → 여백을 잘라 assets/sprites 에 넣는다
 *
 *   node scripts/unit-pack.mjs <정렬폴더> --race feral --id wolfrunner [--action move]
 *
 *   --size <px>   자르기 전 기준 캔버스(기본 256) — 오프셋은 이 좌표계로 기록된다
 *   --pad <px>    잘라낸 상자에 남기는 여백(기본 2)
 *   --dry         쓰지 않고 얼마나 줄어드는지만 보여 준다
 *
 * ── 왜 자르는가 ────────────────────────────────────────────────────
 * 256×256 캔버스에서 피사체가 쓰는 면적은 60% 안팎, 불투명 화소는 20% 뿐이다.
 * 4만 장 규모에서 이 여백이 그대로 저장소 용량이 된다.
 *
 * ⚠ **프레임마다 따로 자르면 안 된다.** 프레임마다 상자가 달라져 스프라이트가 흔들린다.
 *   한 방향의 모든 프레임을 **합집합 상자 하나**로 자른다 — 그러면 프레임 간 상대 위치가
 *   그대로 보존된다.
 *
 * ⚠ 방향마다 상자가 다르므로 **화면에 놓을 때 오프셋이 필요하다.** 그것을 유닛 폴더의
 *   _box.json 에 적는다. sprite-manifest.mjs 가 읽어 색인에 싣고, 그리는 쪽은
 *   원본 캔버스(canvas×canvas) 안 (x,y) 위치에 그대로 놓으면 된다.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const SRC = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const flag = k => argv.includes('--' + k);
const RACE = opt('race', null), ID = opt('id', null), ACTION = opt('action', 'move');
const CANVAS = parseInt(opt('size', '256'), 10), PAD = parseInt(opt('pad', '2'), 10);
if (!SRC || !RACE || !ID) {
  console.error('사용: node scripts/unit-pack.mjs <정렬폴더> --race feral --id wolfrunner [--action move] [--size 256] [--pad 2] [--dry]');
  process.exit(2);
}
const FRAME_RE = /^f\d+\.(png|webp)$/i;
const DST = path.join('assets/sprites', RACE, ID);

// 정렬폴더 안의 <id>_<방향> 을 찾는다
const dirs = fs.readdirSync(SRC).filter(d => d.startsWith(ID + '_') && fs.statSync(path.join(SRC, d)).isDirectory())
  .map(d => ({ d, n: parseInt(d.slice(ID.length + 1), 10) }))
  .filter(x => !isNaN(x.n)).sort((a, b) => a.n - b.n);
if (!dirs.length) { console.error('방향 폴더를 못 찾았습니다: ' + path.join(SRC, ID + '_0')); process.exit(3); }

const box = {};
let before = 0, after = 0, nf = 0;
console.log('방향  프레임  잘라낸 상자(x,y,w,h)      캔버스 대비');

for (const { d, n } of dirs) {
  const dir = path.join(SRC, d);
  const fl = fs.readdirSync(dir).filter(f => FRAME_RE.test(f)).sort();
  if (!fl.length) continue;

  // ① 한 방향의 모든 프레임을 합쳐 상자 하나를 만든다(프레임별로 자르면 흔들린다)
  let x0 = CANVAS, y0 = CANVAS, x1 = -1, y1 = -1;
  const bufs = [];
  for (const f of fl) {
    const buf = await sharp(path.join(dir, f))
      .resize(CANVAS, CANVAS, { fit: 'contain', background: '#00000000' }).png().toBuffer();
    bufs.push(buf);
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, ch = info.channels;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < W; x++)
      if (data[(y * W + x) * ch + 3] >= 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
  }
  if (x1 < 0) { console.log('  ' + n + '  (빈 프레임)'); continue; }
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD);
  x1 = Math.min(CANVAS - 1, x1 + PAD); y1 = Math.min(CANVAS - 1, y1 + PAD);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  box[n] = { x: x0, y: y0, w, h };

  // ② 같은 상자로 전부 자른다
  const to = path.join(DST, ACTION + '_' + n);
  if (!flag('dry')) { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(to)) fs.unlinkSync(path.join(to, f)); }
  for (let i = 0; i < bufs.length; i++) {
    const out = await sharp(bufs[i]).extract({ left: x0, top: y0, width: w, height: h })
      .webp({ quality: 82, alphaQuality: 90 }).toBuffer();
    before += CANVAS * CANVAS; after += w * h; nf++;
    if (!flag('dry')) fs.writeFileSync(path.join(to, 'f' + String(i).padStart(2, '0') + '.webp'), out);
  }
  console.log('  ' + n + '   ' + String(fl.length).padStart(4) + '    ' +
    String(x0).padStart(3) + ',' + String(y0).padStart(3) + ',' + String(w).padStart(3) + ',' + String(h).padStart(3) +
    '        ' + (w * h / (CANVAS * CANVAS) * 100).toFixed(0) + '%');
}

if (!flag('dry')) {
  const bf = path.join(DST, '_box.json');
  const prev = fs.existsSync(bf) ? JSON.parse(fs.readFileSync(bf, 'utf8')) : {};
  prev.canvas = CANVAS;
  prev[ACTION] = box;
  fs.writeFileSync(bf, JSON.stringify(prev, null, 1));
  console.log('\n✓ ' + bf + '  — 그리는 쪽은 canvas ' + CANVAS + '×' + CANVAS + ' 안 (x,y) 에 그대로 놓는다');
}
console.log((flag('dry') ? '[dry] ' : '') + '프레임 ' + nf + '장 · 화소 ' +
  (after / before * 100).toFixed(0) + '% 로 줄었다 (' + (before / after).toFixed(2) + '배 절약)');
