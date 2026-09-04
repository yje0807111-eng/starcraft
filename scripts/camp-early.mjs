/* ============================================================================
 * camp-early.mjs — **초반 라운드가 몇 초에 깨지나** (2026-09-04)
 *
 * ⚠ 왜 따로 만들었나 — camp-bench.mjs 는 「몇 분에 어디까지」를 재는 자라 자동 플레이가
 *   던전에 내려가기까지 20분이 걸린다(6분 벤치는 D0 에 머물렀다). camp-trace.mjs 는 움직임을
 *   보여 주지만 **라운드가 언제 넘어갔는지**를 안 낸다. 초반 램프(CAMP_EASY_*)를 손보려면
 *   바로 그 값이 필요하다.
 *
 * ⭐ 재는 것: 던전 D 에서 병력 SQUAD 로 **각 라운드가 몇 초에 깨졌나**.
 *   부팅·부대 세우기는 camp-trace.mjs 와 **같은 경로**를 쓴다(다르면 다른 것을 재게 된다).
 *
 * 사용: CHROME_PATH=... node scripts/camp-early.mjs [초] [던전] [부대] [연구Lv]
 *   기본 120초 · 던전 1 · marine*1 · 연구 0(첫 플레이 그대로)
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SECS = +(process.argv[2] || 120);
const DG = +(process.argv[3] || 1);
const SQUAD = process.argv[4] || 'marine*1';
const RES = +(process.argv[5] || 0);
const FROM = +(process.env.FROM || 1);   // 시작 라운드(중간 구간을 바로 잰다)
const NOEASY = process.env.EASY === '0';   // 초반 램프를 끄고 재는 대조군
const CHROME = process.env.CHROME_PATH
  || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.glb':'model/gltf-binary', '.mp3':'audio/mpeg', '.ogg':'audio/ogg',
  '.wav':'audio/wav', '.woff':'font/woff', '.woff2':'font/woff2' };
const server = http.createServer((req, res) => { try {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(ROOT, p === '/' ? 'sc-ums-web.html' : p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
} catch (e) { res.writeHead(500); res.end(String(e)); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--mute-audio', '--no-sandbox'] });
const pg = await browser.newPage();
await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const errs = []; pg.on('pageerror', e => errs.push(String(e.message || e).slice(0, 160)));
await pg.goto('http://127.0.0.1:' + server.address().port + '/sc-ums-web.html', { waitUntil: 'load' });
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"', { timeout: 30000 });

// 🏕 camp-trace.mjs 와 같은 부팅 경로
await pg.evaluate(() => {
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p = PROF(); p.chars.length = 0; p.curId = ''; profCreateChar('ranger', '초반');
  const C = campState(); C.race = 'terran'; saveMeta(); openHome(); });
await pg.waitForFunction("typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech"
  + " && (G.tech.ents||[]).some(e=>e.type==='bldg')", { timeout: 30000 });
await new Promise(r => setTimeout(r, 800));
await pg.evaluate(() => { campStopFrame(); campStopTimer(); });   // 시계를 끄고 직접 민다

// ⚠ **판마다 크게 흔들린다**(camp-trace.mjs 와 같은 이유 — 자리 잡기·표적 선정이 무작위다).
//   한 판 재고 결론 내지 말 것. RUNS=3 이면 라운드별 시간을 세 판 나란히 낸다.
const RUNS = +(process.env.RUNS || 1);
const runOne = () => pg.evaluate((dg, squad, secs, res, noEasy, from) => {
  const FPS = 30, dt = 1 / FPS, N = Math.round(secs * FPS);
  if (res > 0 && typeof UNIT_UPG !== 'undefined' && G.tech) {
    G.tech.research = G.tech.research || {}; const race = G.tech.race;
    for (const uid in UNIT_UPG) { const m = UNIT_UPG[uid];
      for (const k of [m.atk, m.def]) if (k) G.tech.research[race + '_' + k] = res; } }
  // 🍼 대조군 — EASY=0 이면 초반 램프를 끄고 잰다(「넣기 전 / 넣은 뒤」를 같은 자로 견준다)
  if(noEasy && typeof campFoeEasy === "function") window.campFoeEasy = function(){ return 1; };
  campEnterDungeon(dg); CAMPB = null;
  // 🎯 시작 라운드 — 램프가 R50 까지 이어지므로 중간(R20·R40)도 재야 한다. 깬 수를 직접 넣는다.
  if(from > 1){ const C = campState(); if(C) C.cleared = Math.max(0, (from | 0) - 1); }
  campCombatStep(dt);
  if (!CAMPB) return { err: '전장이 안 열림' };
  campWithStk(() => { STK.me.units.length = 0; STK.ai.units.length = 0; });
  if (CAMPB._down) CAMPB._down.length = 0;
  if (CAMPB._wq) CAMPB._wq.length = 0;
  // 🪖 camp-trace.mjs 와 같은 배치 — 가로 한 줄, 어깨 맞댈 간격(거기 주석에 이유가 길게 적혀 있다)
  const list = [];
  for (const part of squad.split(',')) {
    const m = part.trim().split('*'); const id = m[0].trim(), n = Math.max(1, +(m[1] || 1));
    for (let i = 0; i < n; i++) list.push(id); }
  const gap = 0.011, x0 = 0.5 - gap * (list.length - 1) / 2;
  list.forEach((id, i) => campDeploy(id, x0 + i * gap, CAMP_LINE_GY));
  // ⚠ **이 두 줄이 없으면 적이 안 나온다** — 라운드가 시작되지 않아 첫 라운드가 0초에 「깨진」 것으로 잡힌다.
  CAMPB._started = false; CAMPB._gapT = 0;
  const rows = []; let r0 = campRoundN(), t0 = 0;
  for (let i = 0; i < N; i++) {
    campCombatStep(dt);
    const r = campRoundN();
    if (r !== r0) { const t = (i + 1) / FPS;
      rows.push({ round: r0, secs: +(t - t0).toFixed(1),
        alive: CAMPB && CAMPB.me ? CAMPB.me.units.filter(u => u && !u.dead).length : -1 });
      r0 = r; t0 = t; if (rows.length >= 30) break; } }
  return { rows: rows, last: campRoundN(),
    alive: CAMPB && CAMPB.me ? CAMPB.me.units.filter(u => u && !u.dead).length : -1,
    foes: CAMPB && CAMPB.ai ? CAMPB.ai.units.filter(u => u && !u.dead).length : -1 };
}, DG, SQUAD, SECS, RES, NOEASY, FROM);

const runs = [];
for (let i = 0; i < RUNS; i++) {
  runs.push(await runOne());
  if (i < RUNS - 1) await pg.reload({ waitUntil: 'load' })
    .then(() => pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"', { timeout: 30000 }))
    .then(() => pg.evaluate(() => {
      document.getElementById('opening')?.classList.add('hide');
      document.getElementById('auth')?.classList.add('hide');
      const p = PROF(); p.chars.length = 0; p.curId = ''; profCreateChar('ranger', '초반');
      const C = campState(); C.race = 'terran'; saveMeta(); openHome(); }))
    .then(() => pg.waitForFunction("typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech"
      + " && (G.tech.ents||[]).some(e=>e.type==='bldg')", { timeout: 30000 }))
    .then(() => new Promise(r => setTimeout(r, 800)))
    .then(() => pg.evaluate(() => { campStopFrame(); campStopTimer(); }));
}

console.log('\n⏱ 초반 라운드 — 던전 ' + DG + ' · ' + SQUAD + ' · 연구 Lv' + RES
  + (FROM > 1 ? ' · R' + FROM + '부터' : '') + (NOEASY ? ' · 램프 OFF' : '') + ' · ' + SECS + '초 · ' + RUNS + '판');
{ const maxR = Math.max(1, ...runs.map(o => (o.rows || []).length));
  const head = runs.map((_, i) => ('판' + (i + 1)).padStart(8)).join('');
  console.log('        ' + head);
  for (let k = 0; k < maxR; k++) {
    const cells = runs.map(o => { const r = (o.rows || [])[k]; return (r ? (r.secs + '초') : '—').padStart(8); }).join('');
    const rn = runs.map(o => (o.rows || [])[k]).find(Boolean);
    console.log('  R' + String(rn ? rn.round : k + 1).padStart(2) + '   ' + cells); }
  for (const o of runs) if (o.err) console.log('  ⛔ ' + o.err);
  console.log('  ── 깬 라운드 ' + runs.map(o => (o.rows || []).length).join(' / ')
    + ' · 끝난 자리 R' + runs.map(o => o.last).join(' / ')
    + ' · 아군 ' + runs.map(o => o.alive).join(' / ')); }
if (errs.length) console.log('  ⚠ 페이지 오류: ' + errs.join(' | '));
await browser.close(); server.close();
