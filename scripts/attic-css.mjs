/* ============================================================================
 * attic-css.mjs — 🗄 죽은 CSS 규칙을 css/99-attic.css 로 옮긴다 (2026-09-05)
 *
 * 왜 CSS 도 다락인가: JS 만 다락으로 가고 CSS 는 남아 있었다. 그래서 `.frRow` `.igFeed` 같은 옛 화면의
 *   스타일이 **살아 있는 것처럼** 보였고, 새 화면을 만들 때 grep 에 걸려 재사용되는 사고가 반복됐다.
 *   ⛔ 지우지 않는다(GAME_DIRECTION.md §5). css/99-attic.css 는 sc-ums-web.html 이 **링크하지 않는다** —
 *   CSS 는 로드되는 순간 살아 있는 것이라, 다락 CSS 는 반드시 링크 밖에 있어야 한다(스모크가 잰다).
 *
 * 어떻게: 규칙(selector{…})마다 쉼표로 갈라진 선택자를 본다.
 *   · 모든 선택자가 죽은 클래스를 품고 있다 → 규칙 통째로 이사
 *   · 일부만 → 죽은 선택자만 떼어 이사하고, 원본에는 산 선택자만 남긴다
 *   · @media 안은 같은 @media 로 감싸 옮긴다 · @keyframes/@font-face 는 건드리지 않는다
 *   · 규칙 바로 위 한 줄 주석(빈 줄 없이 붙은 것)은 함께 간다 — 구획 배너(여러 줄)는 남긴다
 *   ⚠ 원본은 **잘라내기만** 한다 — 남는 텍스트는 바이트 그대로다(다시 찍어 내지 않는다).
 *     첫 판은 파일을 통째로 다시 찍어 1600줄이 바뀌었다 — 이력이 통째로 사라진다(2026-09-05 실패).
 *
 * 사용:  node scripts/attic-css.mjs <dead.json>      # dead-audit --json 의 출력 파일
 *        node scripts/attic-css.mjs <dead.json> --dry # 무엇이 갈지 보기만
 * ========================================================================== */
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const R = p => path.join(ROOT, p);
const [inFile, ...flags] = process.argv.slice(2);
if (!inFile) { console.error('사용: node scripts/attic-css.mjs <dead.json> [--dry]'); process.exit(2); }
const DRY = flags.includes('--dry');
const plan = JSON.parse(fs.readFileSync(inFile, 'utf8')).css || {};
const ATTIC = R('css/99-attic.css');
const today = new Date().toISOString().slice(0, 10);

// ── 아주 작은 CSS 토크나이저 — 문자열·주석을 건너뛰며 { } 짝을 잡는다 ──────
function parse(src, base = 0) {
  const items = []; let i = 0, n = src.length;
  const skipWs = () => { while (i < n && /\s/.test(src[i])) i++; };
  const blockEnd = (start) => { let d = 0, q = null;
    for (let j = start; j < n; j++) { const c = src[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j + 2); if (j < 0) return n; j++; continue; }
      if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return j + 1; } }
    return n; };
  while (i < n) { skipWs(); if (i >= n) break;
    if (src[i] === '/' && src[i + 1] === '*') { const s = i; i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2;
      items.push({ t: 'comment', s: s + base, e: i + base }); continue; }
    const s = i; let j = i, q = null;
    while (j < n && (q || (src[j] !== '{' && src[j] !== ';'))) { const c = src[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; } else if (c === '"' || c === "'") q = c; j++; }
    if (j >= n) { items.push({ t: 'text', s: s + base, e: n + base }); break; }
    if (src[j] === ';') { items.push({ t: 'stmt', s: s + base, e: j + 1 + base }); i = j + 1; continue; }
    const head = src.slice(s, j).trim(); const e = blockEnd(j);
    const it = { t: head.startsWith('@') ? 'at' : 'rule', head, s: s + base, e: e + base, headE: j + base, bodyS: j + 1 + base, bodyE: e - 1 + base };
    if (it.t === 'at') { it.name = head.split(/[\s(]/)[0];
      if (['@media', '@supports', '@layer'].includes(it.name)) it.children = parse(src.slice(j + 1, e - 1), base + j + 1); }
    items.push(it); i = e; }
  return items; }

// 쉼표 분리 — 괄호 안(:is(a,b)) 은 자르지 않는다
const splitSel = h => { const out = []; let d = 0, cur = '';
  for (const c of h) { if (c === '(') d++; if (c === ')') d--; if (c === ',' && d === 0) { out.push(cur); cur = ''; } else cur += c; }
  out.push(cur); return out.map(s => s.trim()).filter(Boolean); };

let movedRules = 0, splitRules = 0, movedMedia = 0; const log = [];
for (const [file, deadList] of Object.entries(plan)) {
  const dead = new Set(deadList); if (!dead.size) continue;
  const isDead = sel => [...sel.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].some(m => dead.has(m[1]));
  const src = fs.readFileSync(R('css/' + file), 'utf8');
  const edits = [];                     // {s,e,text} — 원본에 가할 편집(text '' = 잘라내기)
  const gone = [];                      // 다락으로 갈 텍스트
  // 규칙 앞 공백 + 붙은 한 줄 주석까지 잘라내는 시작점을 구한다
  const cutStart = (it, prev) => { let s = it.s;
    // 앞의 공백(줄바꿈 하나까지)
    while (s > 0 && (src[s - 1] === ' ' || src[s - 1] === '\t')) s--;
    if (prev && prev.t === 'comment' && !src.slice(prev.e, it.s).includes('\n\n')) {
      const c = src.slice(prev.s, prev.e); if (!c.includes('\n')) { gone.push(c); s = prev.s;
        while (s > 0 && (src[s - 1] === ' ' || src[s - 1] === '\t')) s--; } }
    return s; };
  // 줄 끝 개행은 **그 규칙이 줄을 시작했을 때만** 먹는다 — 같은 줄의 앞 규칙 뒤에 붙은 것이면 개행을 남겨야
  // 다음 줄 주석이 앞 규칙 뒤에 달라붙지 않는다(`.crTitle{flex:1}/* 🧱 …` 가 그랬다).
  const cutEnd = (it, s) => { let e = it.e; while (e < src.length && (src[e] === ' ' || src[e] === '\t')) e++;
    if (src[e] === '\n' && (s === 0 || src[s - 1] === '\n')) e++; return e; };
  const judge = (it, prev, sink) => { const sels = splitSel(it.head), d = sels.filter(isDead), a = sels.filter(x => !isDead(x));
    if (!d.length) return false;
    if (!a.length) { movedRules++; const s = cutStart(it, prev); sink.push(src.slice(it.s, it.e)); edits.push({ s, e: cutEnd(it, s), text: '' }); return true; }
    splitRules++; const body = src.slice(it.bodyS, it.bodyE);
    sink.push(d.join(',') + '{' + body + '}'); edits.push({ s: it.s, e: it.headE, text: a.join(',') }); return false; };
  const items = parse(src); let prev = null;
  for (const it of items) {
    if (it.t === 'rule') judge(it, prev, gone);
    else if (it.t === 'at' && it.children) {
      const kids = []; let p = null; let removed = 0, rules = 0;
      const saveLen = edits.length;
      for (const k of it.children) { if (k.t === 'rule') { rules++; if (judge(k, p, kids)) removed++; } p = k; }
      if (kids.length) { movedMedia++; gone.push(it.head + '{\n  ' + kids.join('\n  ') + '\n}'); }
      if (rules && removed === rules) {   // 전부 나갔다 — 블록째 잘라낸다(안쪽 편집은 버린다)
        edits.length = saveLen;
        const s = cutStart(it, prev); edits.push({ s, e: cutEnd(it, s), text: '' }); } }
    prev = it; }
  if (!gone.length) continue;
  log.push(file + ': ' + gone.length + ' 조각');
  if (DRY) { console.log('── ' + file); console.log(gone.map(g => '  ' + g.split('\n')[0].slice(0, 110)).join('\n')); continue; }
  // ⚠ 겹치는 편집은 하나로 합친다 — 같은 줄의 `.a{} .b{}` 둘이 나가면 a 의 뒤 공백과 b 의 앞 공백이
  //   같은 자리라 두 번 잘려 **다음 규칙의 머리가 먹힌다**(`.hsEmpty` → `y{…}` · 2026-09-05 실패).
  edits.sort((a, b) => a.s - b.s); const merged = [];
  for (const ed of edits) { const last = merged[merged.length - 1];
    if (last && ed.s <= last.e) { last.e = Math.max(last.e, ed.e); last.text = last.text + ed.text; } else merged.push({ ...ed }); }
  // 뒤에서부터 적용 — 앞쪽 위치가 안 흔들린다
  merged.sort((a, b) => b.s - a.s); let out = src;
  for (const ed of merged) out = out.slice(0, ed.s) + ed.text + out.slice(ed.e);
  fs.writeFileSync(R('css/' + file), out);
  const banner = '\n/* ══════════ [' + file + '] ' + today + ' — 어디에도 안 쓰는 클래스 ' + dead.size + '개의 규칙 ══════════ */\n';
  fs.appendFileSync(ATTIC, banner + gone.join('\n') + '\n'); }

console.log((DRY ? '[dry] ' : '') + '규칙 통째 ' + movedRules + ' · 선택자만 떼어냄 ' + splitRules + ' · @media 묶음 ' + movedMedia + (log.length ? '\n  ' + log.join('\n  ') : ''));
