/* ============================================================================
 * map-prompt.mjs — 조각 그림에서 **업스케일 프롬프트를 뽑아낸다** (2026-09-02)
 *
 * ⭐ 왜 — 캠프에서 두 번 뽑아 보고 배운 것: 공통 문장만으로는 **요소가 제멋대로 움직인다.**
 *   1차(장면 설명 + 「crisp」)  → 바위가 커지고 판 이음선이 9·24·47·70·95% 로 밀렸다.
 *   2차(아래 셋을 넣음)        → 8·23·46·68·93% 로 원본(8·23·46·68·92%)과 거의 일치.
 *
 *   ① 「다시 그리지 말고 선명하게만」(SHARPENING task, not a redraw)
 *   ② **직선의 위치를 % 로 못 박는다**  ← 이것이 가장 셌다
 *   ③ 틀어졌던 것을 콕 집어 금지(「바위를 키우지 마라」)
 *
 * ⚠ ②의 숫자는 **조각마다 다르다.** 그래서 공통 프롬프트 하나로는 안 되고, 조각을 읽어
 *   직선을 찾아 그 자리에서 문장을 만든다 — 이 스크립트가 하는 일이다.
 *
 * ⛔ 「crisp · no softness」를 그냥 쓰지 말 것 — 선이 1.3px 까지 날카로워져 화면을 밀 때
 *   **반짝인다**(2026-09-02 · 캠프에서 실제로 났다). 아래 문장은 그 말을 뺐다.
 *
 * 사용:
 *   node scripts/map-prompt.mjs docs/mock/visible/dg1_vis_1.png
 *   node scripts/map-prompt.mjs "docs/mock/visible/dg1_vis_*.png"     # 여러 장
 *   옵션: --scene="장면 한 줄"   (없으면 자리를 비워 둔다)
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SCENE = opt('scene', '');

// glob 흉내 — dg1_vis_*.png 같은 것을 풀어 준다
const files = [];
for(const a of argv){
  if(a.startsWith('--')) continue;
  if(a.includes('*')){
    const dir = path.resolve(ROOT, path.dirname(a));
    const re = new RegExp('^' + path.basename(a).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$');
    if(fs.existsSync(dir)) for(const f of fs.readdirSync(dir).sort()) if(re.test(f)) files.push(path.join(dir, f));
  } else files.push(path.resolve(ROOT, a));
}
if(!files.length){ console.error('조각 파일을 주세요'); process.exit(2); }

/* ── 직선 찾기 ────────────────────────────────────────────────────────────
 * ⭐ 「행/열 평균 밝기가 급하게 꺾이는 자리」가 곧 이음선이다.
 * ⚠ 흙·풀처럼 무늬가 불규칙한 조각에서는 아무것도 안 나온다 — 정상이다(그런 조각은
 *   직선이 없으니 못 박을 것도 없다). 그때는 그 문장을 통째로 뺀다.  */
async function lines(p){
  const { data, info } = await sharp(p).grayscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const pick = (n, get, minGapFrac) => {
    const prof = new Float64Array(n);
    for(let i = 0; i < n; i++) prof[i] = get(i);
    const step = Math.max(2, Math.round(n / 400));
    const d = [];
    for(let i = step * 2; i < n - step * 2; i++) d.push({ i, v: Math.abs(prof[i + step * 2] - prof[i - step * 2]) });
    d.sort((a, b) => b.v - a.v);
    const out = [], gap = n * minGapFrac;
    for(const q of d){
      if(q.v < 1.6) break;
      if(out.some(z => Math.abs(z.i - q.i) < gap)) continue;
      out.push(q); if(out.length >= 6) break; }
    return out.sort((a, b) => a.i - b.i).map(q => Math.round(q.i / n * 100));
  };
  const rows = pick(H, y => { let s = 0; for(let x = 0; x < W; x += 4) s += data[y * W + x]; return s / (W / 4); }, 0.05);
  const cols = pick(W, x => { let s = 0; for(let y = 0; y < H; y += 4) s += data[y * W + x]; return s / (H / 4); }, 0.05);
  return { rows, cols, W, H };
}

const QUAD = { '1': ['top-left', 'right and bottom'], '2': ['top-right', 'left and bottom'],
               '3': ['bottom-left', 'top and right'], '4': ['bottom-right', 'top and left'] };

for(const f of files){
  const L = await lines(f);
  const base = path.basename(f);
  const q = (base.match(/_(\d)\.png$/) || [])[1] || '';
  const [where, edges] = QUAD[q] || ['', 'its inner'];
  const seg = [];
  if(L.rows.length) seg.push(`Horizontal seams cross the full width at ${L.rows.map(v => v + '%').join(', ')} of the frame height`);
  if(L.cols.length) seg.push(`vertical seams run top-to-bottom at ${L.cols.map(v => v + '%').join(', ')} of the frame width`);
  const lineSent = seg.length
    ? `THE STRAIGHT LINES — THIS IS THE CRITICAL PART: ${seg.join(', and ')}. Every one of them must stay at exactly those positions, perfectly straight, and — most importantly — must touch each frame border at exactly the same point as in the original, with the same thickness and the same colour. Those touch points are where this tile joins its neighbours; if one is off by even a few pixels the joined map shows a broken line.`
    : `There are no straight seams in this tile — keep every rock, plant and ground feature at its exact position and size.`;

  console.log('\n' + '─'.repeat(78));
  console.log(`  ${base}   ${L.W}×${L.H}${q ? '  (' + where + ')' : ''}`);
  console.log(`  가로선 ${L.rows.length ? L.rows.map(v=>v+'%').join(' ') : '없음'}`
            + `   |   세로선 ${L.cols.length ? L.cols.map(v=>v+'%').join(' ') : '없음'}`);
  console.log('─'.repeat(78));
  console.log(
`This is a SHARPENING task, not a redraw. Output the attached image at much higher resolution with the exact same content in the exact same places. It is the ${where || 'one'} quarter of a top-down strategy game map seen from directly above.${SCENE ? ' THE SCENE: ' + SCENE : ''} WHAT TO IMPROVE: resolve the texture that is currently blurred — the grain and staining of the stone paving, the grit and small stones in the bare ground, the facets and cracks of the rock, the individual leaf clusters of any plants, the thin metal of railings. Detail that is now a smudge should become a clean, readable shape. ⚠ Keep the edges natural: do NOT make lines razor-thin or high-contrast — a line that is too thin shimmers when the map is scrolled. ${lineSent} WHAT MUST NOT CHANGE: the position, size and outline of every single object. Do not enlarge or shrink anything. Do not move, add, remove or relocate anything. Scaled back down and laid over the original, every feature would sit on top of itself. This tile is joined back to its neighbours along its ${edges} edges, so those edge regions must stay pixel-faithful. STYLE: soft anime game background art, gentle airbrushed gradients, clean simple shapes with delicate highlights, the look of a stylised mobile RPG world map. No text, no logos, no user interface, no characters, no watermark.`);
}
console.log('\n  ⚙ 설정: 9:16 · 4k · high');
