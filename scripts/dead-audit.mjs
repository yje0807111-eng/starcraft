/* ============================================================================
 * dead-audit.mjs — 🗄 죽은 코드 래칫 (2026-09-05)
 *
 * 왜 있나: 다락 이사(ATTIC.md)는 한 번짜리였다. 그 뒤로 아무도 안 부르는 함수 64개 · 어디에도 없는
 *   CSS 클래스 187개가 다시 쌓였고, 그 **살아 있는 척하는 옛 CSS** 가 새 화면에 재사용되는 사고가
 *   반복됐다(사용자 지적 2026-09-05). 청소가 아니라 **되돌아가지 않게 잠그는 것**이 이 파일의 일이다.
 *
 * 무엇을 재나
 *   ① 살아 있는 js/*.js(다락 제외)의 `function 이름(` 선언 중 — 주석을 뺀 JS + HTML 어디에서도
 *      정의 줄 밖에 한 번도 안 나오는 것. ⚠ test/smoke.js 는 **생명으로 치지 않는다** — 테스트만 부르는
 *      함수는 앱에선 죽은 것이다(campEnterDungeon 이 62번 불리면서도 앱에는 입구가 없었다).
 *   ② css/*.css(다락 제외)의 클래스 선택자 중 — HTML·JS 어디에도 그 이름이 없는 것.
 *      ⚠ `'fDot-'+st` 처럼 접두어로 조립하는 이름은 잡을 수 없다 → JS 에 `'접두어-'` 문자열이 있으면
 *      **동적**으로 보고 살려 둔다(놓치는 쪽으로 기운다 — 거짓 고발이 더 위험하다 · ATTIC.md §3-E).
 *   ③ 다락과 살아 있는 파일에 **같은 이름이 둘 다** 선언돼 있는 것 — 되살리기(복사)의 흔적이다.
 *
 * 래칫: test/dead-known.json 에 없는 새 이름이 나오면 **exit 1**. 새 이름은 둘 중 하나다 —
 *   다락으로 옮기거나(node scripts/attic-move.mjs · attic-css.mjs), 살려 둘 이유를 적고 known 에 넣는다.
 *   ⛔ 이유 없이 known 에만 넣으면 이 검사는 장식이 된다(ATTIC.md §3-E 와 같은 경고).
 *
 * 사용:  node scripts/dead-audit.mjs            # 검사(npm test 가 브라우저 전에 돌린다)
 *        node scripts/dead-audit.mjs --list     # 후보 전체 목록
 *        node scripts/dead-audit.mjs --json     # {fn:{file:[...]}, css:{file:[...]}} — 이사 스크립트 입력
 *        node scripts/dead-audit.mjs --update   # 지금 목록을 known 으로 기록(이유는 남는다)
 * ========================================================================== */
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const R = p => path.join(ROOT, p);
const args = new Set(process.argv.slice(2));
const KNOWN_PATH = R('test/dead-known.json');

const html = fs.readFileSync(R('sc-ums-web.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const jsFiles = fs.readdirSync(R('js')).filter(f => f.endsWith('.js') && f !== '99-attic.js').sort();
const cssFiles = fs.readdirSync(R('css')).filter(f => f.endsWith('.css') && f !== '99-attic.css').sort();
const attic = fs.existsSync(R('js/99-attic.js')) ? fs.readFileSync(R('js/99-attic.js'), 'utf8') : '';
const atticCss = fs.existsSync(R('css/99-attic.css')) ? fs.readFileSync(R('css/99-attic.css'), 'utf8') : '';

// 주석을 걷는다 — 주석에 이름만 남은 것은 생명이 아니다(고아 검사와 반대 방향이다: 저기는 「놓치는 쪽」,
// 여기는 「이름이 정말 코드에 있나」를 본다. 문자열 안의 // 는 살린다 — 'http://' 가 흔하다).
const stripJs = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const stripCss = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, 'url()').replace(/@import[^;]*;/g, '');
const esc = n => n.replace(/[$.]/g, m => '\\' + m);
const word = n => new RegExp('(?<![\\w$-])' + esc(n) + '(?![\\w$-])');

const js = {}; for (const f of jsFiles) js[f] = stripJs(fs.readFileSync(R('js/' + f), 'utf8'));
const css = {}; for (const f of cssFiles) css[f] = stripCss(fs.readFileSync(R('css/' + f), 'utf8'));
const jsAll = Object.values(js).join('\n'), cssAll = Object.values(css).join('\n');
const life = jsAll + '\n' + html;

// ── ① 함수 ──────────────────────────────────────────────────────────────────
const fnRe = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const deadFn = {}; let nFn = 0; let m;
for (const f of jsFiles) { fnRe.lastIndex = 0;
  while ((m = fnRe.exec(js[f]))) { nFn++;
    const n = m[1], hits = (life.match(new RegExp('(?<![\\w$])' + esc(n) + '(?![\\w$])', 'g')) || []).length;
    if (hits <= 1) (deadFn[f] = deadFn[f] || []).push(n); } }

// ── ② CSS 클래스 ───────────────────────────────────────────────────────────
const clsRe = /\.(-?[A-Za-z_][\w-]*)/g; const cls = new Map();       // 이름 → 첫 파일
for (const f of cssFiles) { clsRe.lastIndex = 0; while ((m = clsRe.exec(css[f]))) if (!cls.has(m[1])) cls.set(m[1], f); }
const dynamic = [];                                                    // 접두어 조립으로 보이는 것
const deadCss = {};
for (const [c, f] of cls) {
  if (word(c).test(life)) continue;
  const dash = c.lastIndexOf('-');
  // 접두어 바로 뒤에 닫는 따옴표가 오면 조립이다 — `"fAvaDot fDot-"+st` 처럼 긴 문자열 끝에 있어도 잡힌다
  if (dash > 1) { const pre = c.slice(0, dash + 1);
    if (new RegExp('(?<![\\w-])' + esc(pre) + "['\"`]").test(jsAll)) { dynamic.push(c); continue; } }
  (deadCss[f] = deadCss[f] || []).push(c); }

// ── ③ 되살아남 — 다락과 살아 있는 쪽에 같은 이름 ─────────────────────────
const dupFn = []; { const re = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm; const a = stripJs(attic);
  while ((m = re.exec(a))) if (new RegExp('^(?:async\\s+)?function\\s+' + esc(m[1]) + '\\s*\\(', 'm').test(jsAll)) dupFn.push(m[1]); }
// CSS 되살아남은 두 꼴이다. ⚠ 다락 규칙에는 산 클래스도 문맥으로 섞여 있다(`.btn.amb .bl` 의 .btn/.bl) —
//   그래서 「다락에 있는 클래스가 살아 있는 CSS 에도 있다」로 재면 전부 거짓 고발이 된다(첫 판이 그랬다).
//   ㉠ 다락에만 스타일이 있는 클래스를 HTML/JS 가 쓴다 → 옛 디자인을 **그대로 재사용**한 것
//   ㉡ 다락의 선택자 머리와 **글자까지 같은** 규칙이 살아 있는 CSS 에 있다 → 규칙을 **복사해 되살린** 것
//   ⚠ ㉠ 은 **주어 클래스**만 본다 — 복합 선택자에 붙은 상태 꼬리(`.bprog.prod` 의 .prod · `.frRow.offline`)는
//     JS 문자열 'prod' 'offline' 과 우연히 겹쳐 거짓 고발이 난다(둘째 판이 그랬다).
const dupCss = []; { const a = stripCss(atticCss);
  const subj = new Set(); for (const x of a.matchAll(/(^|[\s,>+~(])\.(-?[A-Za-z_][\w-]*)/g)) subj.add(x[2]);
  // 「쓴다」는 **class 문맥**에서만 — HTML 의 class="…" 안이거나, JS 줄에 className/classList/class= 이 함께 있을 때.
  //   그냥 단어로 재면 퀘스트 id 'dgGo' 같은 문자열이 클래스로 오인된다(셋째 판).
  const usesAsClass = c => new RegExp('class="[^"]*(?<![\\w-])' + esc(c) + '(?![\\w-])[^"]*"').test(html)
    || jsAll.split('\n').some(l => word(c).test(l) && /class=|className|classList|querySelector|closest\(/.test(l));
  for (const c of subj) { if (c.length < 3) continue;
    const inLive = new RegExp('\\.' + esc(c) + '(?![\\w-])').test(cssAll);
    if (!inLive && usesAsClass(c)) dupCss.push(c + '(다락에만 스타일이 있는데 마크업/JS 가 쓴다)'); }
  const heads = s => new Set([...s.matchAll(/(^|[}\n;])\s*([^{}]*?)\s*\{/g)].map(x => x[2].replace(/\s+/g, ' ').trim())
    .filter(h => h.length > 3 && !h.startsWith('@')));
  const ah = heads(a), lh = heads(cssAll);
  for (const h of ah) if (lh.has(h)) dupCss.push(h + '(같은 규칙이 양쪽에)'); }

// ── 출력 ───────────────────────────────────────────────────────────────────
const flat = o => Object.values(o).flat();
const fnList = flat(deadFn), cssList = flat(deadCss);
if (args.has('--json')) { console.log(JSON.stringify({ fn: deadFn, css: deadCss, dynamic }, null, 1)); process.exit(0); }

const known = fs.existsSync(KNOWN_PATH) ? JSON.parse(fs.readFileSync(KNOWN_PATH, 'utf8')) : { fn: {}, css: {} };
const newFn = fnList.filter(n => !(n in known.fn)), newCss = cssList.filter(c => !(c in known.css));
const goneFn = Object.keys(known.fn).filter(n => !fnList.includes(n)), goneCss = Object.keys(known.css).filter(c => !cssList.includes(c));

console.log('죽은 함수 ' + fnList.length + '/' + nFn + ' · 죽은 CSS 클래스 ' + cssList.length + '/' + cls.size
  + ' (동적 조립으로 보고 살려 둔 것 ' + dynamic.length + ')');
if (args.has('--list')) {
  for (const f of Object.keys(deadFn)) console.log('  fn  ' + f.padEnd(22) + String(deadFn[f].length).padStart(3) + '  ' + deadFn[f].join(' '));
  for (const f of Object.keys(deadCss)) console.log('  css ' + f.padEnd(22) + String(deadCss[f].length).padStart(3) + '  ' + deadCss[f].join(' '));
  if (dynamic.length) console.log('  dyn ' + dynamic.join(' ')); }

if (args.has('--update')) {
  const next = { fn: {}, css: {} };
  for (const n of fnList) next.fn[n] = known.fn[n] || '(이유를 적을 것)';
  for (const c of cssList) next.css[c] = known.css[c] || '(이유를 적을 것)';
  fs.writeFileSync(KNOWN_PATH, JSON.stringify(next, null, 1) + '\n');
  console.log('known 갱신 — 함수 ' + fnList.length + ' · CSS ' + cssList.length); process.exit(0); }

let bad = 0;
if (dupFn.length) { bad++; console.log('⛔ 다락과 살아 있는 파일에 **같은 함수**가 둘 다 있다(되살리기 흔적): ' + dupFn.join(' ')); }
if (dupCss.length) { bad++; console.log('⛔ 다락 CSS 와 살아 있는 CSS 에 **같은 클래스**가 둘 다 있다: ' + dupCss.join(' ')); }
if (newFn.length) { bad++; console.log('⛔ 새로 죽은 함수 ' + newFn.length + ': ' + newFn.join(' ')); }
if (newCss.length) { bad++; console.log('⛔ 새로 죽은 CSS 클래스 ' + newCss.length + ': ' + newCss.join(' ')); }
if (goneFn.length || goneCss.length) console.log('ℹ known 에 있는데 이제 죽지 않은 것(살렸으면 known 에서 빼라): '
  + [...goneFn, ...goneCss].join(' '));
if (bad) { console.log('   → 다락으로 옮기거나(ATTIC.md §5) 살려 둘 이유를 적어 test/dead-known.json 에 넣을 것'); process.exit(1); }
console.log('✅ 새로 죽은 코드 없음 · 되살아난 것 없음');
