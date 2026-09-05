/* ============================================================================
 * camp-move-trace.mjs — 🖐 「이동 명령 → 실제 움직임」을 기지(0단계)와 던전(1단계)에서 **같은 자**로 잰다
 *   (2026-09-05 · 조작감 통일 A안의 근거이자 회귀 자)
 *
 * 세 판: ① 기지 유닛에 _techAssignMove ② 던전 · 적 없음 · campMoveSel ③ 던전 · 싸우는 중 뒤로 빼기
 * 내는 값: 명령 뒤 출발까지(초) · 도착(초) · 끝거리(px) · 흔들림(경로/직선) · 뒤집힘 · 표적 프레임 · 거리 추이
 * 고치기 전 실측: 던전 조용 출발 0.8s(굳음) · 싸움 중 거리 1012→1074(무시) · 끝거리 35(45 앞 정지)
 * 고친 뒤:      출발 0.03s · 거리 단조 감소 · 끝거리 ≈22 (ARCHITECTURE §「⚔ 캠프 전투」 표)
 *
 * 사용: node scripts/camp-move-trace.mjs   (크롬은 표준 경로에서 찾는다 · CHROME_PATH 로 덮어쓸 수 있다)
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((q, s) => { try {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const f = path.join(ROOT, p === '/' ? 'sc-ums-web.html' : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
} catch (e) { s.writeHead(500); s.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.CHROME_PATH || '']
  .filter(Boolean).find(p => fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 600000,
  args: ['--mute-audio', '--no-sandbox', '--disable-gpu-sandbox'] });
const pg = await b.newPage();
await pg.setViewport({ width: 1100, height: 1500, deviceScaleFactor: 1 });
const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
await pg.goto('http://127.0.0.1:' + server.address().port + '/sc-ums-web.html', { waitUntil: 'load' });
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"', { timeout: 30000 });
await pg.evaluate(() => {
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p = PROF(); p.chars.length = 0; p.curId = ''; profCreateChar('ranger', '이동');
  const C = campState(); C.race = 'terran'; saveMeta(); openHome(); });
await pg.waitForFunction("typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech"
  + " && (G.tech.ents||[]).some(e=>e.type==='bldg')", { timeout: 30000 });
await new Promise(r => setTimeout(r, 800));
await pg.evaluate(() => { campStopFrame(); campStopTimer(); });

const out = await pg.evaluate(() => {
  const FPS = 30, dt = 1 / FPS, R = {};
  const stat = (pts, goal) => {          // pts: [{x,y}] in a common unit
    let start = -1, flips = 0, pathLen = 0, prevDir = null, stopped = -1;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y, d = Math.hypot(dx, dy);
      pathLen += d;
      if (d > 0.3) { if (start < 0) start = i; const dir = Math.atan2(dy, dx);
        if (prevDir != null) { let a = Math.abs(dir - prevDir); if (a > Math.PI) a = 2 * Math.PI - a; if (a > Math.PI * 0.6) flips++; }
        prevDir = dir; }
      else if (start >= 0 && stopped < 0 && i > start + 3) { let still = true;
        for (let k = i; k < Math.min(pts.length, i + 15); k++) { const q = pts[k], p0 = pts[i - 1]; if (Math.hypot(q.x - p0.x, q.y - p0.y) > 0.3) { still = false; break; } }
        if (still) stopped = i; } }
    const last = pts[pts.length - 1], first = pts[0];
    const straight = Math.hypot(goal.x - first.x, goal.y - first.y);
    return { startDelayS: start < 0 ? null : +(start * dt).toFixed(2), arriveS: stopped < 0 ? null : +(stopped * dt).toFixed(2),
      endDist: +Math.hypot(goal.x - last.x, goal.y - last.y).toFixed(1), straight: +straight.toFixed(1),
      pathLen: +pathLen.toFixed(1), wobble: +(pathLen / Math.max(1, straight)).toFixed(2), flips };
  };
  R.consts = { CAMP_RETURN_DELAY, CAMP_POST_R, CAMP_RETURN_K, CAMP_ENG_OUT, CAMP_PICK_R, CAMP_ROUND_GAP_S,
    arriveR_marine: (typeof campArriveR === 'function') ? campArriveR({ rng: 90 }) : null };

  /* ── ① 기지(0단계): 유닛 엔티티 하나를 만들고 _techAssignMove 로 보낸다 ── */
  { const e = { eid: G.tech.eseq++, type: 'unit', uid: 'marine', x: 0.50, y: 0.50, pop: 1 };
    G.tech.ents.push(e); G.tech.selU = [e.eid];
    const goal = { x: 0.65, y: 0.50 };
    _techAssignMove(goal.x, goal.y);
    const W = 4800;                      // 던전과 같은 자로 견주기 위해 격자 → 전장 px(가로 기준 CAMP_LANE_W)
    const toPx = p => ({ x: p.x * W / (typeof CAMP_LANE_W !== 'undefined' ? CAMP_LANE_W : 1), y: p.y * W / (typeof CAMP_LANE_W !== 'undefined' ? CAMP_LANE_W : 1) });
    const pts = []; for (let i = 0; i < 8 * FPS; i++) { techTick(dt); pts.push(toPx({ x: e.x, y: e.y })); }
    R.base = stat(pts, toPx(goal)); R.base.note = 'A* 경로(_techRoute) · tx/ty 로 한 걸음씩';
    G.tech.ents = G.tech.ents.filter(x => x !== e); G.tech.selU = []; }

  /* ── ② 던전 1 · 적 없음: campMoveSel 로 보낸다 ── */
  campEnterDungeon(1); CAMPB = null; campCombatStep(dt);
  if (!CAMPB) return { err: '전장이 안 열림' };
  campWithStk(() => { STK.me.units.length = 0; STK.ai.units.length = 0; });
  if (CAMPB._down) CAMPB._down.length = 0; if (CAMPB._wq) CAMPB._wq.length = 0;
  const gap = 0.011, x0 = 0.5 - gap * 2;
  for (let i = 0; i < 5; i++) campDeploy('marine', x0 + i * gap, CAMP_LINE_GY);
  CAMPB._started = false; CAMPB._gapT = 0;
  const W = CAMPB.world || 4800;
  { const u = CAMPB.me.units[2];
    R.dgIdle0 = { idleT: u._idleT || 0, wait: u.wait || 0, post: u._post ? 1 : 0 };
    campSelSet([u]);
    const g = { x: 0.5 + 0.15, y: CAMP_LINE_GY }; campMoveSel(g.x, g.y);
    const goal = { x: u._post.x, y: u._post.y };
    const pts = [], mv = []; for (let i = 0; i < 8 * FPS; i++) { campWithStk(() => campStepUnits(dt)); pts.push({ x: u.x, y: u.y }); mv.push(u.moving ? 1 : 0); }
    R.dgQuiet = stat(pts, goal); R.dgQuiet.movingFrames = mv.reduce((a, c) => a + c, 0);
    R.dgQuiet.note = '적 없음 · _post 로 「복귀」 경로(CAMP_RETURN_DELAY 뒤 · CAMP_POST_R 앞에서 멈춤)'; }

  /* ── ③ 던전 1 · 적 있음: 싸우는 중에 뒤로 빼는 명령 ── */
  { CAMPB._started = false; CAMPB._gapT = 0;
    let t = 0; while (t < 20 && !(CAMPB.ai.units.length && CAMPB.me.units.some(x => x.tgtUid))) { campCombatStep(dt); t += dt; }
    R.dgFightSetup = { secToContact: +t.toFixed(1), foes: CAMPB.ai.units.length, engaged: CAMPB.me.units.filter(x => x.tgtUid).length };
    const u = CAMPB.me.units.find(x => x.tgtUid) || CAMPB.me.units[0];
    campSelSet([u]);
    const g = { x: 0.5 - 0.12, y: CAMP_LANE_BOT - 0.01 }; campMoveSel(g.x, g.y);        // 뒤(아래)로 멀리
    const goal = { x: u._post.x, y: u._post.y };
    const pts = []; let tgtFrames = 0, minD = 1e9; const seq = [];
    for (let i = 0; i < 10 * FPS; i++) { campCombatStep(dt); if (u.dead) break; pts.push({ x: u.x, y: u.y });
      if (u.tgtUid) tgtFrames++; const d = Math.hypot(goal.x - u.x, goal.y - u.y); minD = Math.min(minD, d);
      if (i % 15 === 0) seq.push(Math.round(d)); }
    R.dgFight = stat(pts, goal); R.dgFight.tgtFrames = tgtFrames; R.dgFight.frames = pts.length;
    R.dgFight.minDistToOrder = Math.round(minD); R.dgFight.distEveryHalfSec = seq; R.dgFight.dead = !!u.dead;
    R.dgFight.note = '명령 지점까지 거리 추이 — 적을 다시 물면 campGoalFor 가 적 쪽으로 데려간다'; }
  return R;
});
console.log(JSON.stringify(out, null, 1));
console.log(errs.length ? 'errs: ' + errs.join(' | ') : 'errs: 없음');
await b.close(); server.close();
