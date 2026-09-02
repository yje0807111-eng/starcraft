/* ============================================================================
 * map-quarter.mjs — 맵 그림을 **2×2 로 자른다** (2026-09-02)
 *
 * ⭐ 왜 — 맵 원본이 1600×2844 라 게임에서 최대(줌 3.1)로 확대하면 픽셀이 보인다.
 *   AI 업스케일에 통째로 넣으면 세부를 못 살리므로, **네 조각으로 나눠 각각 뽑는다.**
 *
 * ⚠ 1600×2844 는 정확히 9:16 이다. 2×2 로 자르면 각 조각도 800×1422 = **9:16** 이라
 *   AI 에 그대로 넣을 수 있다(모델이 9:16 을 요구한다 — ART.md §11).
 *
 * ⛔ **이음새를 조심할 것.** 네 조각을 따로 확대하면 맞닿는 선에서 색·질감이 어긋난다.
 *   ART.md §11-4-1 에 「경계를 찾으려 하지 말 것 — 두 번 실패했다」가 있다.
 *   그래서 `--pad=n` 으로 **겹쳐 자를 수 있게** 해 두었다(기본 0 = 딱 4등분).
 *
 * 사용:
 *   node scripts/map-quarter.mjs assets/backgrounds/camp/camp.webp
 *   node scripts/map-quarter.mjs assets/backgrounds/dungeons/dg1.webp --pad=48
 *   node scripts/map-quarter.mjs --all              # 캠프 + 던전 11장 전부
 *   옵션: --pad=n(겹침 px) · --out=경로 · --jpg(png 대신 jpg)
 *
 * 나오는 것: <out>/<이름>_1.png … _4.png
 *   1 = 왼쪽 위 · 2 = 오른쪽 위 · 3 = 왼쪽 아래 · 4 = 오른쪽 아래
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const has = k => argv.includes('--' + k);

const PAD = +opt('pad', 0);                       // 조각끼리 겹치는 폭(px) — 이음새 보험
const EXT = has('jpg') ? 'jpg' : 'png';
const OUT = path.resolve(ROOT, opt('out', 'docs/mock/quarters'));

const files = has('all')
  ? ['assets/backgrounds/camp/camp.webp',
     ...Array.from({ length: 10 }, (_, i) => `assets/backgrounds/dungeons/dg${i + 1}.webp`)]
  : argv.filter(a => !a.startsWith('--'));

if(!files.length){ console.error('자를 파일을 주세요 (또는 --all)'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

// 1 왼위 · 2 오른위 · 3 왼아래 · 4 오른아래 — 사용자가 부르는 순서 그대로
const QUAD = [['1', 0, 0], ['2', 1, 0], ['3', 0, 1], ['4', 1, 1]];

for(const rel of files){
  const src = path.resolve(ROOT, rel);
  if(!fs.existsSync(src)){ console.error('없는 파일: ' + rel); continue; }
  const im = sharp(src);
  const meta = await im.metadata();
  const W = meta.width, H = meta.height;
  const hw = Math.floor(W / 2), hh = Math.floor(H / 2);
  const name = path.basename(rel).replace(/\.\w+$/, '');
  const out = [];
  // ⚠ **세로 겹침은 가로에 비례해 늘린다** — 안 그러면 조각이 9:16 을 벗어난다.
  //   가로만 48 겹치면 848×1422 = 0.596 이라 모델이 9:16 으로 찌그러뜨린다.
  const padX = PAD, padY = Math.round(PAD * (hh / hw));
  for(const [n, cx, cy] of QUAD){
    // 바깥 가장자리로는 안 넘긴다 — 안쪽(맞닿는 쪽)으로만 넓힌다
    const left = cx ? Math.max(0, hw - padX) : 0;
    const top  = cy ? Math.max(0, hh - padY) : 0;
    const w    = Math.min(W - left, hw + padX);
    const h    = Math.min(H - top,  hh + padY);
    const dst  = path.join(OUT, `${name}_${n}.${EXT}`);
    await sharp(src).extract({ left, top, width: w, height: h })
      .toFormat(EXT === 'jpg' ? 'jpeg' : 'png', EXT === 'jpg' ? { quality: 95 } : {})
      .toFile(dst);
    out.push(`${n}:${w}×${h}`);
  }
  const r = (hw + padX) / (hh + padY);
  console.log(`  ${name}  ${W}×${H} (${(W/H).toFixed(3)})  →  ${out.join(' · ')}`
    + `   조각 비율 ${r.toFixed(3)}${Math.abs(r - 9/16) < 0.01 ? ' ✅ 9:16' : ' ⚠ 9:16 아님'}`);
}
console.log('  📁 ' + path.relative(ROOT, OUT));
