/* assets/sprites/ 색인 생성 — tools/sprites.html 이 읽는다
 *
 *   node scripts/sprite-manifest.mjs
 *
 * 기대 로스터(어떤 유닛·건물이 있어야 하는가)는 **게임 코드에서 직접 읽는다**.
 * 종족·유닛 표를 여기에 다시 적으면 반드시 어긋난다(CLAUDE.md 단일 소스 원칙).
 *   유닛      RACE_OF[id] → 종족         js/11-cmdcard.js  ← 일꾼까지 있는 완전한 표
 *   유닛 이름 U[id].name                js/01-data.js
 *   건물      TECH_TREE[race].buildings js/15-tech-data.js
 *   방어 건물 TECH_DEF_BLDG[race]       js/16-build.js   ← 이것만 8방향 공격을 갖는다
 *
 * ⚠ STK_RACES[*].units 를 쓰면 안 된다 — 그건 오토배틀 배출표라 일꾼·주술사 같은
 *   유닛이 통째로 빠진다(페럴 11기로 잡힌다. 실제는 16기). 종족 이름·색만 거기서 빌린다.
 *
 * 값을 정규식으로 긁지 않고 헤드리스 크롬에 페이지를 띄워 전역을 그대로 읽는다 —
 * test/run-smoke.mjs 와 같은 방식이라 표 모양이 바뀌어도 따라간다.
 *
 * 출력은 JSON 이 아니라 **manifest.js**(전역 대입)다. file:// 에서 fetch 는 CORS 로
 * 막히지만 <script src> 는 통과한다 — 빌드 단계 없이 HTML 을 더블클릭해서 열 수 있다.
 *
 * 폴더 규칙은 SPRITES.md 가 단일 소스다:
 *   assets/sprites/<종족>/<id>/<액션>[_<방향>]/f00.webp
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPRITES = path.join(ROOT, 'assets', 'sprites');
const OUT = path.join(SPRITES, 'manifest.js');

// STK_RACES 는 기존 3종족에 옛 별칭을 쓴다. 스프라이트 폴더는 관리자·샌드박스 표기로 통일한다.
const RACE_KEY = { terran: 'union', zerg: 'swarm', protoss: 'aetherial', feral: 'feral', colossus: 'colossus' };
const RACE_ORDER = ['union', 'swarm', 'aetherial', 'feral', 'colossus'];
const UNIT_ACTIONS = ['move', 'attack', 'cast', 'idle'];          // 전부 8방향
const BLDG_ACTIONS = ['idle', 'build', 'produce', 'upgrade', 'wreck'];   // 방향 없음
const DEF_ACTION = 'attack';                                       // 방어 건물만 · 8방향
const DIRS = 8;

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH || ''].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('크롬을 찾을 수 없습니다. CHROME_PATH로 지정하세요.'); process.exit(2); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(ROOT, p === '/' ? 'sc-ums-web.html' : p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ── ① 게임 코드에서 기대 로스터를 읽는다 ────────────────────────────
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--mute-audio'] });
let roster;
try {
  const page = await browser.newPage();
  page.on('pageerror', () => {});                     // 로딩 중 게임 예외는 여기선 무관
  await page.goto('http://127.0.0.1:' + PORT + '/sc-ums-web.html', { waitUntil: 'load' });
  roster = await page.evaluate(({ RACE_KEY, RACE_ORDER }) => {
    const out = {};
    for (const k of RACE_ORDER) out[k] = { units: {}, buildings: {} };
    // 종족 이름·색만 STK_RACES 에서 빌린다(유닛 목록은 쓰지 않는다 — 오토배틀 배출표라 빠진 게 많다)
    for (const legacy in STK_RACES) {
      const r = STK_RACES[legacy], key = RACE_KEY[legacy];
      if (!key || !out[key]) continue;
      out[key].name = r.name; out[key].sub = r.sub; out[key].col = r.col;
    }
    // 유닛은 RACE_OF 가 단일 소스 — 일꾼·시전 유닛까지 전부 들어 있다
    for (const id in RACE_OF) {
      const key = RACE_OF[id];
      if (!out[key]) continue;
      out[key].units[id] = { name: (typeof U !== 'undefined' && U[id] && U[id].name) || id };
    }
    for (const key in out) {
      const t = (typeof TECH_TREE !== 'undefined') ? TECH_TREE[key] : null;
      if (!out[key].name && t) out[key].name = t.name;
      const def = (typeof TECH_DEF_BLDG !== 'undefined' && TECH_DEF_BLDG[key]) || [];
      for (const b of (t && t.buildings) || [])
        out[key].buildings[b.k] = { name: b.name || b.k, def: def.indexOf(b.k) >= 0 };
    }
    return out;
  }, { RACE_KEY, RACE_ORDER });
} finally { await browser.close(); server.close(); }

// ── ② 실제 폴더를 훑는다 ────────────────────────────────────────────
const EXT = /\.(webp|png)$/i;
function scanAction(dir) {
  if (!fs.existsSync(dir)) return null;
  const fl = fs.readdirSync(dir).filter(f => EXT.test(f)).sort();
  return fl.length ? { frames: fl.length, ext: path.extname(fl[0]).slice(1) } : null;
}
// unit-pack.mjs 가 남긴 자르기 상자 — 방향마다 크기가 달라서 그리는 쪽이 오프셋을 알아야 한다
function readBox(entDir) {
  const f = path.join(entDir, '_box.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; }
}
function scanEntity(entDir, actions, dirActions) {
  const bx = readBox(entDir);
  const got = {};
  for (const a of actions) {
    if (dirActions.indexOf(a) >= 0) {
      const per = [];
      for (let d = 0; d < DIRS; d++) per.push(scanAction(path.join(entDir, a + '_' + d)));
      const have = per.filter(Boolean).length;
      got[a] = have ? { dirs: have, frames: per.find(Boolean).frames, ext: per.find(Boolean).ext } : null;
      if (got[a] && bx && bx[a]) { got[a].canvas = bx.canvas; got[a].box = bx[a]; }
    } else {
      const s = scanAction(path.join(entDir, a));
      got[a] = s ? { dirs: 0, frames: s.frames, ext: s.ext } : null;
      if (got[a] && bx && bx[a]) { got[a].canvas = bx.canvas; got[a].box = bx[a]; }
    }
  }
  return got;
}

const races = {};
let doneAct = 0, totalAct = 0, doneFrames = 0;
for (const key of RACE_ORDER) {
  const r = roster[key]; if (!r) continue;
  const base = path.join(SPRITES, key);
  const units = {}, buildings = {};
  for (const id in r.units) {
    const acts = scanEntity(path.join(base, id), UNIT_ACTIONS, UNIT_ACTIONS);
    for (const a of UNIT_ACTIONS) { totalAct++; if (acts[a]) { doneAct++; doneFrames += acts[a].frames * Math.max(1, acts[a].dirs); } }
    units[id] = { name: r.units[id].name, kind: 'unit', actions: acts };
  }
  for (const id in r.buildings) {
    const b = r.buildings[id];
    const list = b.def ? BLDG_ACTIONS.concat([DEF_ACTION]) : BLDG_ACTIONS;
    const acts = scanEntity(path.join(base, id), list, b.def ? [DEF_ACTION] : []);
    for (const a of list) { totalAct++; if (acts[a]) { doneAct++; doneFrames += acts[a].frames * Math.max(1, acts[a].dirs); } }
    buildings[id] = { name: b.name, kind: b.def ? 'def' : 'bldg', actions: acts };
  }
  races[key] = { name: r.name || key, sub: r.sub || '', col: r.col || '#8a929d', units, buildings };
}

// ── ③ manifest.js 쓰기 ──────────────────────────────────────────────
const data = {
  generated: new Date().toISOString().slice(0, 10),
  dirs: DIRS,
  unitActions: UNIT_ACTIONS,
  bldgActions: BLDG_ACTIONS,
  defAction: DEF_ACTION,
  order: RACE_ORDER,
  races,
};
fs.mkdirSync(SPRITES, { recursive: true });
fs.writeFileSync(OUT,
  '/* 자동 생성 — 손으로 고치지 말 것. `node scripts/sprite-manifest.mjs` 로 다시 만든다. */\n' +
  'const SPRITE_MANIFEST = ' + JSON.stringify(data, null, 1) + ';\n');

// ── ④ 요약 ──────────────────────────────────────────────────────────
console.log('색인 → ' + path.relative(ROOT, OUT));
console.log('');
for (const key of RACE_ORDER) {
  const r = races[key]; if (!r) continue;
  const cnt = o => { let d = 0, t = 0; for (const id in o) for (const a in o[id].actions) { t++; if (o[id].actions[a]) d++; } return [d, t]; };
  const [ud, ut] = cnt(r.units), [bd, bt] = cnt(r.buildings);
  const pct = ut + bt ? Math.round((ud + bd) / (ut + bt) * 100) : 0;
  console.log('  ' + r.name.padEnd(6) + '유닛 ' + String(Object.keys(r.units).length).padStart(2) + '기 ' +
    String(ud).padStart(3) + '/' + String(ut).padEnd(3) +
    ' · 건물 ' + String(Object.keys(r.buildings).length).padStart(2) + '동 ' +
    String(bd).padStart(3) + '/' + String(bt).padEnd(3) + '   ' + String(pct).padStart(3) + '%');
}
console.log('\n액션 ' + doneAct + '/' + totalAct + ' · 프레임 ' + doneFrames + '장');
console.log('보기: tools/sprites.html 을 브라우저로 열면 됩니다(서버 불필요).');
