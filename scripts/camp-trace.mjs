/* ============================================================================
 * camp-trace.mjs — 캠프 전투 **움직임**을 눈으로 본다 (2026-08-31)
 *
 * ⚠ 왜 만들었나 — 이 프로젝트는 전투 움직임을 **숫자로만** 좇다가 네 번 헛짚었다
 *   (닿으면 정지 / 뒤로 안 가기 / 목표 안쪽으로 / 전선 넓게 — 전부 되돌렸다).
 *   camp-bench.mjs 는 「몇 분에 어디까지」를 재는 자[尺]지 **움직임을 보여 주지 않는다.**
 *   그래서 실제 엔진(campCombatStep)을 돌리면서 매 프레임 좌표를 받아 적고,
 *   ① 궤적 그림 ② 연속 스냅샷 ③ 떨림·사거리 수치 셋을 함께 낸다.
 *
 * ⭐ 「고치기 전 / 고친 뒤」를 같은 자로 견주는 것이 이 도구의 목적이다.
 *   ⚠ 판마다 크게 흔들린다(같은 코드가 사거리 안 45%~100%). 한 번 재고 결론 내지 말 것 —
 *     RUNS=3 이 기본이고, 수치는 **중앙값**으로 낸다.
 *
 * 사용:
 *   CHROME_PATH=... node scripts/camp-trace.mjs [초] [던전] [부대]
 *     초    기록할 시뮬 시간(기본 20)
 *     던전  1~10 (기본 1)
 *     부대  "marine*7,machinegun*3,medic*1" 처럼 (기본이 그것 — 30분 벤치의 실제 구성)
 *   환경변수:
 *     OUT=경로       그림 저장 위치(기본 scratchpad 또는 docs/mock)
 *     RUNS=n         반복 횟수 · 수치는 중앙값(기본 3)
 *     ENGAGE=0       campEngageStep 을 끄고 잰다(대조군 — 「캠프가 손을 떼면」)
 *     SHOTS=n        스냅샷 칸 수(기본 12)
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SECS = +(process.argv[2] || 20);
const DG   = +(process.argv[3] || 1);
const SQUAD = process.argv[4] || 'marine*7,machinegun*3,medic*1';
const RUNS  = +(process.env.RUNS || 3);
const SHOTS = +(process.env.SHOTS || 12);
const ENGAGE = (process.env.ENGAGE == null) ? 1 : (+process.env.ENGAGE ? 1 : 0);
// 🔬 **연구 레벨** — ⚠ 이게 없으면 「전투가 안 된다」를 잘못 읽는다.
//   맨몸 마린은 체력 5 · 공격 1 인데 던전 1 라운드 1 의 적은 체력 392 다(실측). 이동을 어떻게
//   고쳐도 못 이긴다 — 그건 설계가 그런 것이고(연구로 키우라는 뜻), **움직임의 문제가 아니다.**
//   30분 벤치의 실제 판은 계열 업그레이드 91레벨이었다. 기본값은 그 언저리로 둔다.
const RES = (process.env.RES == null) ? 45 : +process.env.RES;
// 🚧 자리 제한(CAMP_ENG_OUT) 을 갈아 끼워 잰다 — 0 이면 게임 값 그대로.
//   ⚠ 옛 구조에서 잰 「500 이 최적」은 **그 제한이 실제로는 안 지켜지던** 판의 값이다
//     (오토배틀의 무제한 추격이 남아 있었다). 미는 주체가 하나가 된 지금은 다시 재야 한다.
const OUTLIM = +(process.env.OUTLIM || 0);
// 👀 인식 거리 상한을 갈아 끼워 잰다 — 0 이면 게임 값 그대로(혼자 900 · 전파받으면 1500).
//   ⚠ 실효 인식은 여기에 STK_ACQ_FAR(1.4) 이 곱해진다 — 900 이면 1260, 1500 이면 2100.
const ACQCAP = +(process.env.ACQ || 0);
// 🔇 전파 인식만 끈다(대조군) — 기본 눈(사거리+PAD)과 피격 확장은 그대로 둔다.
//   ⚠ campAlertTick 을 통째로 끄면 acq 자체가 안 갱신된다. **그 함수가 끝난 직후**
//     _alertAcq/_alertT 만 0 으로 지워야 「전파만 없는」 상태가 된다.
const NOALERT = process.env.NOALERT === '1';
const OUT = process.env.OUT || path.join(ROOT, 'docs', 'mock');
fs.mkdirSync(OUT, { recursive: true });

const MIME = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2','.woff':'font/woff','.mp4':'video/mp4'};
const server = http.createServer((q, s) => { try {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const f = path.join(ROOT, p === '/' ? 'sc-ums-web.html' : p);
  if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end(); }
  s.writeHead(200, {'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(s);
} catch(e){ s.writeHead(500); s.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const CHROME = process.env.CHROME_PATH;
if(!CHROME || !fs.existsSync(CHROME)){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 600000,
  args: ['--mute-audio', '--no-sandbox', '--disable-gpu-sandbox'] });
const pg = await b.newPage();
await pg.setViewport({ width: 1100, height: 1500, deviceScaleFactor: 1 });
const errs = []; pg.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
await pg.goto(`http://127.0.0.1:${PORT}/sc-ums-web.html`, { waitUntil: 'load' });
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"', { timeout: 30000 });

// 🏕 캠프를 띄운다 — camp-bench.mjs 와 같은 부팅 경로다(다르면 다른 것을 재게 된다).
await pg.evaluate(() => {
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p = PROF(); p.chars.length = 0; p.curId = ''; profCreateChar('ranger', '궤적');
  const C = campState(); C.race = 'terran'; saveMeta(); openHome(); });
await pg.waitForFunction("typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech"
  + " && (G.tech.ents||[]).some(e=>e.type==='bldg')", { timeout: 30000 });
await new Promise(r => setTimeout(r, 800));
await pg.evaluate(() => { campStopFrame(); campStopTimer(); });   // 시계를 끄고 직접 민다

/* ── 한 판 기록 ──────────────────────────────────────────────────────────
 * ⚠ 부대는 **campDeploy 로 직접 세운다.** 진짜 플레이로 병력을 모으려면 22분이 걸리고
 *   (30분 벤치에서 던전 진입이 20.6분이었다), 그러면 「움직임을 본다」는 목적에 비해 너무 비싸다.
 *   ⭐ 대신 자리는 실제 생산과 같은 경로를 지난다 — campDeploy 가 campLayerPost 까지 부른다.  */
async function record(seed){
  return await pg.evaluate((dg, squad, secs, shots, engage, res, outlim, acqcap, noalert, seed) => {
    const FPS = 30, dt = 1 / FPS, N = Math.round(secs * FPS);
    // 🔬 연구 — 계열 업그레이드 전 항목을 res 레벨로. campResLv 가 읽는 그 자리에 직접 넣는다.
    if(res > 0 && typeof UNIT_UPG !== 'undefined' && G.tech){
      G.tech.research = G.tech.research || {};
      const race = G.tech.race;
      for(const uid in UNIT_UPG){ const m = UNIT_UPG[uid];
        for(const k of [m.atk, m.def]) if(k) G.tech.research[race + '_' + k] = res; } }
    if(outlim > 0) window.campEngageOut = function(){ return outlim; };
    // ── 부대 세우기
    campEnterDungeon(dg); CAMPB = null; campCombatStep(dt);
    if(!CAMPB) return { err: '전장이 안 열림' };
    // 🧹 전장 비우기 — smoke.js 의 campWipeField 와 같은 일(그건 테스트 파일 안에만 있다).
    //   ⚠ campBattleClose 는 병력을 기지로 되돌리므로 여기선 못 쓴다(이 판의 임시 유닛이 새어 나간다).
    campWithStk(() => { STK.me.units.length = 0; STK.ai.units.length = 0; });
    if(CAMPB._down) CAMPB._down.length = 0;
    if(CAMPB._wq) CAMPB._wq.length = 0;
    const list = [];
    for(const part of squad.split(',')){
      const m = part.trim().split('*'); const id = m[0].trim(), n = +(m[1] || 1);
      for(let i = 0; i < n; i++) list.push(id); }
    // 🪖 **가로 한 줄로 넓게** — 적은 위에서 내려오므로 옆으로 펴야 동시에 때린다.
    //   ⛔ 예전엔 4열 격자로 세웠다(세로 4행). 격자 0.035 는 전장으로 **275px** 이라
    //     4행이면 세로 폭 825px — 인식(260)·전파(150) 어느 것도 층을 못 넘어
    //     **앞의 두세 기만 싸웠다**(사거리 안 2/11). 배치가 결과를 만든 것이었다.
    //   ⚠ 세로(gy)는 campLayerPost 가 사거리 순으로 다시 정렬하므로 여기 값은 뜻이 없다.
    //   ⚠ 간격은 **어깨 맞댈 만큼**이다(격자 0.011 = 전장 60px · 유닛 크기 14 의 4배).
    //     ⛔ 0.70 폭(전장 3818px)에 15기를 흩었더니 실효 0.26 으로 더 떨어졌다 — 적 세 마리가
     //       한 곳에 오는데 부대가 그만큼 벌어지면 아무도 못 만난다. 넓게 = 흩어지게 가 아니다.
    const _gap = 0.011, _x0 = 0.5 - _gap * (list.length - 1) / 2;
    list.forEach((id, i) => campDeploy(id, _x0 + i * _gap, CAMP_LINE_GY));
    CAMPB._started = false; CAMPB._gapT = 0;
    // ⚙ 대조군 — campEngageStep 을 끄면 「캠프가 손을 뗀 상태」가 된다
    const _eng = window.campEngageStep;
    if(!engage) window.campEngageStep = function(){ return 0; };

    const W = CAMPB.world || 4800;
    const frames = [];        // [{t, me:[{u,x,y,r,tgt,dead}], ai:[{x,y}]}]
    let leash = 0, engPush = 0;
    // 💥 **실제로 오간 피해** — strikeHit 이 유일한 피해 경로다(18-strike.js §473).
    //   ⭐ 「사거리 안 몇 %」는 자세일 뿐이다. 진짜 물음은 **때렸는가**이고, 그 답은 여기서만 나온다.
    //   ⚠ 체력 총합 차이로 재면 안 된다 — 새 무리가 들어오면 총합이 늘어 피해가 가려진다.
    let dmgOut = 0, dmgIn = 0, shotOut = 0;
    const _hit = window.strikeHit;
    window.strikeHit = function(tgt, rawAtk, atk){
      const b4 = (tgt ? (tgt.hp || 0) + (tgt.sh || 0) : 0);
      const r = _hit.apply(this, arguments);
      const af = (tgt ? (tgt.hp || 0) + (tgt.sh || 0) : 0), d = Math.max(0, b4 - af);
      if(tgt && tgt.side === 'ai'){ dmgOut += d; shotOut++; } else dmgIn += d;
      return r; };
    // 👀 인식 상한 — campAlertTick 이 **매 틱 u.acq 를 다시 쓴다.** 그래서 프레임 앞에서
    //   조여 봐야 소용없고(그렇게 한 번 헛짚었다 — 상한 350 인데 알아챈 거리가 1844 로 그대로였다),
    //   그 함수가 끝난 **직후** 조여야 그 프레임의 표적 선정에 반영된다.
    const _alt = window.campAlertTick;
    if((acqcap > 0 || noalert) && typeof _alt === 'function') window.campAlertTick = function(dt2){
      const r = _alt.apply(this, arguments);
      if(CAMPB) for(const u of CAMPB.me.units){
        if(noalert){ u._alertAcq = 0; u._alertT = 0;
          if(typeof campAcqBase === 'function'){ const b = Math.max(campAcqBase(u), u._hitAcq || 0);
            if(u.acq > b) u.acq = b; } }
        if(acqcap > 0 && u.acq > acqcap) u.acq = acqcap; }
      return r; };
    const _lea = window.campLeash;
    window.campLeash = function(){ const n = _lea.apply(this, arguments); leash += n || 0; return n; };
    const _en2 = window.campEngageStep;
    window.campEngageStep = function(){ const n = _en2.apply(this, arguments); engPush += n || 0; return n; };

    // ⚔ 설계 DPS — 「낼 수 있었던 피해」의 분모. 첫 프레임(적이 나온 직후)에 뜬다.
    const dpsOf = arr => arr.reduce((a, u) => a + ((!u.dead && u.cdMax > 0) ? (u.dmg || 0) / u.cdMax : 0), 0);
    let dpsMe0 = 0, dpsAi0 = 0, hpMe0 = 0, hpAi0 = 0;
    for(let f = 0; f < N; f++){
      campCombatStep(dt);
      if(!CAMPB) break;
      if(f === 0){ dpsMe0 = dpsOf(CAMPB.me.units); dpsAi0 = dpsOf(CAMPB.ai.units);
        hpMe0 = CAMPB.me.units.reduce((a, u) => a + (u.maxHp || 0) + (u.maxSh || 0), 0);
        hpAi0 = CAMPB.ai.units.reduce((a, u) => a + (u.maxHp || 0) + (u.maxSh || 0), 0); }
      const me = [], ai = [];
      for(const u of CAMPB.me.units) me.push({ u: u.uid, id: u.id, x: Math.round(u.x), y: Math.round(u.y),
        r: Math.round(u.rng || 0), tgt: u.tgtUid || '', dead: !!u.dead,
        px: u._post ? Math.round(u._post.x) : null, py: u._post ? Math.round(u._post.y) : null });
      for(const u of CAMPB.ai.units) if(!u.dead) ai.push({ x: Math.round(u.x), y: Math.round(u.y) });
      // 💥 체력 총합 — 「실제로 피해가 오갔는가」. ⚠ 죽은 유닛의 남은 체력은 0 으로 친다.
      //   ⭐ 이것이 있어야 「안 죽는다」가 **못 맞히는 것**인지 **원래 단단한 것**인지 갈린다.
      const hp = (arr) => arr.reduce((a, u) => a + (u.dead ? 0 : (u.hp || 0) + (u.sh || 0)), 0);
      frames.push({ t: +(f * dt).toFixed(2), me, ai,
        hpMe: Math.round(hp(CAMPB.me.units)), hpAi: Math.round(hp(CAMPB.ai.units)) }); }
    window.campLeash = _lea; window.campEngageStep = _eng; window.strikeHit = _hit; window.campAlertTick = _alt;
    const secsRan = frames.length / FPS;

    // ── 수치 ────────────────────────────────────────────────────────────
    // ① 방향 뒤집힘 — 연속한 이동 벡터의 각이 90°를 넘으면 한 번. 「덜덜 떤다」의 자[尺]다.
    // ② 사거리 안 비율 — 살아 있는 내 유닛 중 가장 가까운 적이 제 사거리 안인 비율(프레임 평균).
    //    ⭐ 이것이 「전투가 실제로 이루어지는가」다. 20~40% 면 대부분이 놀고 있다는 뜻.
    // ③ 순간이동 — 한 프레임 이동량이 60px 를 넘은 횟수(목줄이 위치를 자를 때 생긴다).
    // ④ 표적 바뀜 — 떨림의 원인이 표적 흔들림인지 거리 유지인지 가른다.
    const prev = new Map(), last = new Map(), tgtPrev = new Map(), flipBy = new Map();
    let flips = 0, tele = 0, teleMax = 0, tgtSw = 0, inR = 0, inRn = 0, moved = 0;
    let flipIn = 0, flipOut = 0, flipNoT = 0, flipSw = 0;   // 꺾은 순간의 상태 내역
    // 🔍 「표적을 못 찾는다」와 「표적은 있는데 못 닿는다」를 가른다 — 둘의 처방이 다르다.
    let hasT = 0, hasTn = 0, gap = 0, gapN = 0;
    let inRf = 0, inRfn = 0, idleF = 0;   // 적이 살아 있는 프레임만 / 적이 없던 프레임 수
    // 🏃 「돌격하는 느낌」의 자[尺] — 자리에서 얼마나 벗어나 있나, 얼마나 멀리서 표적을 잡나.
    //   ⭐ 인식 거리가 이동 제한보다 크면 「적이 나오자마자 제한 끝까지 우르르」가 된다.
    let away = 0, awayN = 0, awayMax = 0; const acqAt = [];
    const uids = new Set();
    for(const fr of frames){
      let alive = 0, hit = 0, withT = 0;
      for(const m of fr.me){
        if(m.dead) continue;
        alive++; uids.add(m.u);
        if(m.tgt) withT++;
        let best = 1e9;
        for(const a of fr.ai){ const d = Math.hypot(a.x - m.x, a.y - m.y); if(d < best) best = d; }
        if(m.r > 0){
          if(best <= m.r) hit++;
          // 표적이 있는데 사거리 밖이면 「얼마나 모자라는가」 — 사거리 배수로 잰다
          if(m.tgt && best < 1e9 && best > m.r){ gap += best / Math.max(1, m.r); gapN++; } }
        const p = last.get(m.u);
        if(p){ const vx = m.x - p.x, vy = m.y - p.y, sp = Math.hypot(vx, vy);
          if(sp > 60){ tele++; if(sp > teleMax) teleMax = sp; }
          moved += sp;
          if(sp > 1.5){ const q = prev.get(m.u);
            if(q){ const dot = (vx * q.x + vy * q.y) / (sp * Math.hypot(q.x, q.y) || 1);
              if(dot < 0){ flips++; flipBy.set(m.u, (flipBy.get(m.u) || 0) + 1);
                // 🔬 «꺾은 그 순간» 이 유닛은 어떤 상태였나 — 원인을 가른다.
                //   ⭐ 사거리 안에서 꺾으면 「이미 쏠 수 있는데 흔들린다」,
                //     밖에서 꺾으면 「아직 못 쏘고 **자리를 찾는 중**」이다. 처방이 정반대다.
                if(m.r > 0 && best <= m.r) flipIn++; else flipOut++;
                if(!m.tgt) flipNoT++;
                const t0f = tgtPrev.get(m.u);
                if(t0f != null && t0f !== m.tgt) flipSw++; } }
            prev.set(m.u, { x: vx, y: vy }); } }
        last.set(m.u, { x: m.x, y: m.y });
        const t0 = tgtPrev.get(m.u); if(t0 != null && t0 !== m.tgt && m.tgt) tgtSw++;
        // 표적이 **없다가 생긴** 순간의 거리 = 「얼마나 멀리서 알아채나」
        if(!t0 && m.tgt){ let best = 1e9;
          for(const a of fr.ai){ const d = Math.hypot(a.x - m.x, a.y - m.y); if(d < best) best = d; }
          if(best < 1e9) acqAt.push(best); }
        tgtPrev.set(m.u, m.tgt);
        if(m.px != null){ const ad = Math.hypot(m.x - m.px, m.y - m.py);
          away += ad; awayN++; if(ad > awayMax) awayMax = ad; } }
      if(alive){ inR += hit / alive; inRn++; hasT += withT / alive; hasTn++;
        // ⚠ **적이 없는 프레임도 위에 섞인다** — 라운드를 깨고 다음 적을 기다리는 동안은
        //   사거리 안일 수가 없다. 「전투 중에는 얼마나 닿는가」를 따로 낸다(2026-08-31 · sc-3).
        if(fr.ai && fr.ai.some(a=>!a.dead)){ inRf += hit / alive; inRfn++; } else { idleF++; } } }
    /* 🔬 «자리를 잡는 중이었나, 끝내 못 잡았나» ────────────────────────────────
     * ⭐ 꺾음(방향 전환)의 99% 가 사거리 **밖**에서 일어난다는 것까지는 알았다.
     *   그 다음 물음은 둘이다 — ① 자리를 잡기까지 얼마나 걸리나 ② 결국 잡기는 하나.
     * ⚠ 「잡는 중」과 「못 잡음」은 처방이 정반대다. 전자면 시간을 줄이는 문제고,
     *   후자면 애초에 닿지 못하는 자리를 목표로 삼고 있다는 뜻이다.  */
    const perU = new Map();
    for(let fi = 0; fi < frames.length; fi++){
      const fr = frames[fi];
      for(const m of fr.me){
        if(m.dead) continue;
        let best = 1e9;
        for(const a of fr.ai){ const d = Math.hypot(a.x - m.x, a.y - m.y); if(d < best) best = d; }
        let arr = perU.get(m.u); if(!arr){ arr = []; perU.set(m.u, arr); }
        arr.push({ x:m.x, y:m.y, r:m.r, tgt:m.tgt, inR:(m.r > 0 && best <= m.r), near:best,
          foe:(fr.ai ? fr.ai.length : 0) }); } }
    const settleT = [];              // 표적을 잡고 → 사거리 안에 들기까지(초)
    let segDone = 0, segFail = 0, segCleared = 0;   // 든 구간 / 못 든 구간 / 적이 먼저 사라진 구간
    let failClosing = 0;             // 못 든 구간 중 «그래도 가까워지고 있던» 것
    let flipSolved = 0, flipTot2 = 0;   // 꺾은 뒤 3초 안에 사거리 안에 들었나
    const SOLVE_F = Math.round(FPS * 3);
    for(const arr of perU.values()){
      // ① 표적 구간
      let st = -1;
      for(let i = 0; i < arr.length; i++){
        const a = arr[i];
        // ⚠ **이미 사거리 안이면 구간을 시작하지 않는다** — 안 그러면 쏘고 있는 동안
        //   매 프레임 새 구간이 열렸다 즉시 닫혀 「0초 만에 자리 잡음」이 3191번 찍힌다.
        if(a.tgt && !a.inR && st < 0){ st = i; continue; }
        if(st >= 0){
          if(a.inR){ settleT.push((i - st) / FPS); segDone++; st = -1; }
          else if(!a.tgt){
            // ⚠ 실패 사유를 가른다 — 「적을 다 죽여서 끝난 구간」은 실패가 아니다.
            //   그것까지 실패로 세면 「표적을 잡고도 61% 는 못 닿는다」 같은 헛읽기가 나온다.
            if(a.foe === 0) segCleared++;
            else { segFail++;
              if(arr[i-1] && arr[st] && arr[i-1].near < arr[st].near - 20) failClosing++; }
            st = -1; } } }
      if(st >= 0){ const last = arr[arr.length-1];
        if(last && last.foe === 0) segCleared++;
        else { segFail++;
          if(last && arr[st] && last.near < arr[st].near - 20) failClosing++; } }
      // ② 꺾은 뒤 실제로 자리를 잡았나
      let pv = null;
      for(let i = 1; i < arr.length; i++){
        const vx = arr[i].x - arr[i-1].x, vy = arr[i].y - arr[i-1].y, sp = Math.hypot(vx, vy);
        if(sp <= 1.5) continue;
        if(pv){ const dot = (vx*pv.x + vy*pv.y) / (sp * Math.hypot(pv.x, pv.y) || 1);
          if(dot < 0){ flipTot2++;
            for(let k = i; k < Math.min(arr.length, i + SOLVE_F); k++)
              if(arr[k].inR){ flipSolved++; break; } } }
        pv = { x:vx, y:vy }; } }
    settleT.sort((a,b) => a-b);
    const settleMed = settleT.length ? settleT[Math.floor(settleT.length/2)] : -1;
    const settleP90 = settleT.length ? settleT[Math.floor(settleT.length*0.9)] : -1;
    const nU = Math.max(1, uids.size);
    const stat = { frames: frames.length, units: uids.size,
      flips: +(flips / nU).toFixed(1), tele, teleMax: Math.round(teleMax), tgtSw: +(tgtSw / nU).toFixed(1),
      flipTot: flips, flipInPct: +(flipIn / Math.max(1, flips) * 100).toFixed(0),
      settleMed: +settleMed.toFixed(1), settleP90: +settleP90.toFixed(1),
      segDone, segFail, segCleared, failClosePct: +(failClosing / Math.max(1, segFail) * 100).toFixed(0),
      flipSolvedPct: +(flipSolved / Math.max(1, flipTot2) * 100).toFixed(0),
      flipNoTPct: +(flipNoT / Math.max(1, flips) * 100).toFixed(0),
      flipSwPct: +(flipSw / Math.max(1, flips) * 100).toFixed(0),
      inRange: +(100 * inR / Math.max(1, inRn)).toFixed(1),
      inRangeFight: +(100 * inRf / Math.max(1, inRfn)).toFixed(1),
      idlePct: +(100 * idleF / Math.max(1, inRn)).toFixed(1),
      hasTgt: +(100 * hasT / Math.max(1, hasTn)).toFixed(1),
      awayAvg: Math.round(away / Math.max(1, awayN)), awayMax: Math.round(awayMax),
      acqAt: acqAt.length ? Math.round(acqAt.slice().sort((a,b)=>a-b)[Math.floor(acqAt.length/2)]) : 0,
      gapMul: +(gap / Math.max(1, gapN)).toFixed(2),
      moveAvg: +(moved / nU / Math.max(1, frames.length)).toFixed(2),
      leash, engPush,
      aliveEnd: frames.length ? frames[frames.length - 1].me.filter(m => !m.dead).length : 0,
      foeEnd: frames.length ? frames[frames.length - 1].ai.length : 0,
      foe0: frames.length ? frames[0].ai.length : 0,
      // 💥 실효 — 「낼 수 있었던 피해 중 실제로 낸 비율」. 이것이 전투가 도는가의 최종 답이다.
      dmgOut: Math.round(dmgOut), dmgIn: Math.round(dmgIn), shotOut,
      dpsMe: Math.round(dpsMe0), dpsAi: Math.round(dpsAi0), hpMe0, hpAi0,
      effMe: +(dmgOut / Math.max(1, dpsMe0 * secsRan)).toFixed(2),
      effAi: +(dmgIn / Math.max(1, dpsAi0 * secsRan)).toFixed(2) };

    // ── 그림 ────────────────────────────────────────────────────────────
    // ⚠ 범위는 **아군만으로** 잡는다. 적을 넣으면 화면 밖에서 스폰돼 걸어 내려오는 구간이
    //   범위를 다 먹어서(실측: 궤적 판의 3/4 이 빈 하늘) 정작 보고 싶은 떨림이 점으로 뭉개진다.
    //   적은 그 범위 안에 들어온 것만 보이면 된다 — 어차피 교전은 아군 근처에서 일어난다.
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for(const fr of frames) for(const m of fr.me){ if(m.dead) continue;
      x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x); y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y); }
    const pad = 200; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const spanX = Math.max(1, x1 - x0), spanY = Math.max(1, y1 - y0);

    const CW = 1060, PAD = 16;
    const TRACE_H = Math.round(Math.min(560, CW * spanY / spanX));
    const cols = 4, rows = Math.ceil(shots / cols);
    const cellW = Math.floor((CW - PAD * (cols - 1)) / cols), cellH = Math.round(cellW * spanY / spanX);
    // 🔍 확대 — 가장 많이 뒤집힌 유닛 둘. 「덜덜 떤다」는 이 패널에서만 눈에 보인다.
    const worst = [...flipBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);
    const ZW = Math.floor((CW - PAD) / 2), ZH = 240;
    const cv = document.createElement('canvas');
    cv.width = CW + PAD * 2; cv.height = PAD + TRACE_H + 34 + ZH + 34 + rows * (cellH + 22) + PAD;
    cv.id = '__trace'; cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
    document.body.appendChild(cv);
    const g = cv.getContext('2d');
    g.fillStyle = '#0d0e11'; g.fillRect(0, 0, cv.width, cv.height);
    const MX = (x, w) => PAD + (x - x0) / spanX * w, MY = (y, h) => (y - y0) / spanY * h;

    // ① 궤적 — 아군은 파랑 계열(유닛마다 색상), 적은 붉게 옅게, 자리(_post)는 ✕
    g.save(); g.translate(0, PAD);
    g.fillStyle = '#08090c'; g.fillRect(PAD, 0, CW, TRACE_H);
    g.save(); g.beginPath(); g.rect(PAD, 0, CW, TRACE_H); g.clip();   // ⚠ 범위 밖(멀리서 오는 적)은 잘라낸다
    // 적 궤적
    g.strokeStyle = 'rgba(255,90,110,.16)'; g.lineWidth = 1;
    { const track = new Map();
      frames.forEach((fr, i) => fr.ai.forEach((a, k) => {
        const key = k; if(!track.has(key)) track.set(key, []); track.get(key).push(a); }));
      for(const pts of track.values()){ g.beginPath();
        pts.forEach((p, i) => i ? g.lineTo(MX(p.x, CW), MY(p.y, TRACE_H)) : g.moveTo(MX(p.x, CW), MY(p.y, TRACE_H)));
        g.stroke(); } }
    // 아군 궤적
    const paths = new Map();
    for(const fr of frames) for(const m of fr.me){ if(m.dead) continue;
      if(!paths.has(m.u)) paths.set(m.u, { id: m.id, pts: [], post: (m.px != null) ? { x: m.px, y: m.py } : null });
      paths.get(m.u).pts.push({ x: m.x, y: m.y }); }
    let ci = 0; const NU = Math.max(1, paths.size);
    for(const p of paths.values()){
      const hue = Math.round(190 + (ci / NU) * 130) % 360; ci++;
      g.strokeStyle = `hsla(${hue},70%,62%,.85)`; g.lineWidth = 1.4; g.beginPath();
      p.pts.forEach((q, i) => i ? g.lineTo(MX(q.x, CW), MY(q.y, TRACE_H)) : g.moveTo(MX(q.x, CW), MY(q.y, TRACE_H)));
      g.stroke();
      // 시작 ○ · 끝 ● · 자리 ✕
      const a = p.pts[0], z = p.pts[p.pts.length - 1];
      g.strokeStyle = `hsla(${hue},70%,72%,.9)`; g.beginPath(); g.arc(MX(a.x, CW), MY(a.y, TRACE_H), 3.2, 0, 7); g.stroke();
      g.fillStyle = `hsla(${hue},80%,66%,1)`; g.beginPath(); g.arc(MX(z.x, CW), MY(z.y, TRACE_H), 3.4, 0, 7); g.fill();
      if(p.post){ const px = MX(p.post.x, CW), py = MY(p.post.y, TRACE_H);
        g.strokeStyle = 'rgba(255,255,255,.30)'; g.lineWidth = 1; g.beginPath();
        g.moveTo(px - 3, py - 3); g.lineTo(px + 3, py + 3); g.moveTo(px + 3, py - 3); g.lineTo(px - 3, py + 3); g.stroke(); } }
    g.restore();   // clip
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1; g.strokeRect(PAD + .5, .5, CW - 1, TRACE_H - 1);
    g.restore();   // translate

    // ② 🔍 확대 — 가장 많이 뒤집힌 유닛 둘을 **제 궤적 범위로** 확대한다.
    //   ⭐ 전체 궤적 판에서는 20초치 이동이 겹쳐 보여 떨림이 선 하나로 뭉갠다.
    //     한 유닛만 떼어 확대해야 「같은 자리에서 앞뒤로 흔들린다」가 눈에 보인다.
    { const zy = PAD + TRACE_H + 34;
      g.fillStyle = '#c9d3de'; g.font = '600 12px system-ui,sans-serif';
      g.fillText('▲ 궤적 (전체 ' + secs + '초) · ○ 시작 ● 끝 ✕ 자리(_post) · 붉은 선 = 적'
        + '   |   ▼ 🔍 가장 많이 뒤집힌 유닛 둘 (확대)', PAD, zy - 12);
      worst.forEach((uid, wi) => {
        const p = paths.get(uid); if(!p) return;
        const ox = PAD + wi * (ZW + PAD);
        g.fillStyle = '#08090c'; g.fillRect(ox, zy, ZW, ZH);
        let a0 = 1e9, b0 = 1e9, a1 = -1e9, b1 = -1e9;
        for(const q of p.pts){ a0 = Math.min(a0, q.x); a1 = Math.max(a1, q.x); b0 = Math.min(b0, q.y); b1 = Math.max(b1, q.y); }
        const mg = 24; a0 -= mg; a1 += mg; b0 -= mg; b1 += mg;
        // 종횡비를 맞춘다 — 안 맞추면 한 축만 늘어나 떨림이 과장되거나 눌린다
        const sx = ZW / Math.max(1, a1 - a0), sy = ZH / Math.max(1, b1 - b0), sc = Math.min(sx, sy);
        const cx = (a0 + a1) / 2, cy = (b0 + b1) / 2;
        const zx = v => ox + ZW / 2 + (v - cx) * sc, zzy = v => zy + ZH / 2 + (v - cy) * sc;
        g.save(); g.beginPath(); g.rect(ox, zy, ZW, ZH); g.clip();
        if(p.post){ const px = zx(p.post.x), py = zzy(p.post.y);
          g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath();
          g.moveTo(px - 5, py - 5); g.lineTo(px + 5, py + 5); g.moveTo(px + 5, py - 5); g.lineTo(px - 5, py + 5); g.stroke(); }
        g.strokeStyle = 'hsla(200,80%,66%,.9)'; g.lineWidth = 1.2; g.beginPath();
        p.pts.forEach((q, i) => i ? g.lineTo(zx(q.x), zzy(q.y)) : g.moveTo(zx(q.x), zzy(q.y)));
        g.stroke();
        // 프레임마다 점 — 촘촘하면 그 자리에서 멈칫한 것이다
        g.fillStyle = 'hsla(200,80%,72%,.5)';
        p.pts.forEach(q => { g.beginPath(); g.arc(zx(q.x), zzy(q.y), .9, 0, 7); g.fill(); });
        g.restore();
        g.strokeStyle = 'rgba(255,255,255,.10)'; g.strokeRect(ox + .5, zy + .5, ZW - 1, ZH - 1);
        g.fillStyle = '#8b95a2'; g.font = '600 11px system-ui,sans-serif';
        g.fillText(p.id + ' · 뒤집힘 ' + flipBy.get(uid) + '회 · 확대 ×' + sc.toFixed(1)
          + ' (' + Math.round(a1 - a0) + '×' + Math.round(b1 - b0) + 'px)', ox + 2, zy + ZH + 14); }); }

    // ③ 스냅샷 격자 — 시간 순으로 등간격
    g.fillStyle = '#c9d3de'; g.font = '600 12px system-ui,sans-serif';
    g.fillText('▼ 스냅샷 · 옅은 원 = 사거리 (적이 원 안이면 때린다)', PAD, PAD + TRACE_H + 34 + ZH + 24);
    for(let s = 0; s < shots; s++){
      const fi = Math.min(frames.length - 1, Math.round(s * (frames.length - 1) / Math.max(1, shots - 1)));
      const fr = frames[fi]; if(!fr) continue;
      const c = s % cols, r = Math.floor(s / cols);
      const ox = PAD + c * (cellW + PAD), oy = PAD + TRACE_H + 34 + ZH + 34 + r * (cellH + 22);
      g.fillStyle = '#08090c'; g.fillRect(ox, oy, cellW, cellH);
      g.save(); g.beginPath(); g.rect(ox, oy, cellW, cellH); g.clip();
      const mx = x => ox + (x - x0) / spanX * cellW, my = y => oy + (y - y0) / spanY * cellH;
      g.fillStyle = 'rgba(255,90,110,.8)';
      for(const a of fr.ai){ g.beginPath(); g.arc(mx(a.x), my(a.y), 2, 0, 7); g.fill(); }
      let k = 0;
      for(const m of fr.me){ if(m.dead){ k++; continue; }
        const hue = Math.round(190 + (k / NU) * 130) % 360; k++;
        // 사거리 원 — 「닿는가」를 눈으로 본다
        if(m.r > 0){ g.strokeStyle = `hsla(${hue},60%,60%,.18)`; g.lineWidth = 1; g.beginPath();
          g.arc(mx(m.x), my(m.y), m.r / spanX * cellW, 0, 7); g.stroke(); }
        g.fillStyle = `hsla(${hue},80%,66%,1)`; g.beginPath(); g.arc(mx(m.x), my(m.y), 2.6, 0, 7); g.fill(); }
      g.restore();   // clip
      g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1; g.strokeRect(ox + .5, oy + .5, cellW - 1, cellH - 1);
      g.fillStyle = '#8b95a2'; g.font = '600 11px system-ui,sans-serif';
      g.fillText(fr.t.toFixed(1) + 's · 아군 ' + fr.me.filter(m => !m.dead).length + ' · 적 ' + fr.ai.length,
        ox + 2, oy + cellH + 14); }
    return { stat, ok: true };
  }, DG, SQUAD, SECS, SHOTS, ENGAGE, RES, OUTLIM, ACQCAP, NOALERT, seed);
}

const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const runs = [];
let shotPath = '';
for(let i = 0; i < RUNS; i++){
  await pg.evaluate(() => { const c = document.getElementById('__trace'); if(c) c.remove(); });
  const r = await record(i);
  if(r.err){ console.error('❌ ' + r.err); process.exit(1); }
  runs.push(r.stat);
  if(i === 0){   // 그림은 첫 판만 남긴다(판마다 다르지만 「어떻게 움직이는가」는 같다)
    shotPath = path.join(OUT, 'camp-trace' + (ENGAGE ? '' : '-noeng') + '.png');
    const el = await pg.$('#__trace');
    await el.screenshot({ path: shotPath }); }
}

const K = ['inRange', 'inRangeFight', 'idlePct', 'hasTgt', 'gapMul', 'flips', 'tgtSw', 'tele', 'teleMax', 'moveAvg', 'leash', 'engPush', 'aliveEnd', 'foeEnd',
  'dmgOut', 'dmgIn', 'shotOut', 'awayAvg', 'awayMax', 'acqAt', 'dpsMe', 'dpsAi', 'hpMe0', 'hpAi0', 'effMe', 'effAi',
  'flipTot', 'flipInPct', 'flipNoTPct', 'flipSwPct',
  'settleMed', 'settleP90', 'segDone', 'segFail', 'segCleared', 'failClosePct', 'flipSolvedPct'];
const M = {}; for(const k of K) M[k] = med(runs.map(r => r[k]));
console.log('');
console.log('🎬 캠프 전투 궤적 — ' + SECS + '초 · 던전 ' + DG + ' · ' + SQUAD + ' · 연구 Lv' + RES
  + (OUTLIM ? ' · 자리제한 ' + OUTLIM : '') + (ACQCAP ? ' · 인식상한 ' + ACQCAP : '') + (NOALERT ? ' · 🔇 전파 끔' : '') + ' · ' + RUNS + '판 중앙값' + (ENGAGE ? '' : '  ⚙ campEngageStep 끔(대조군)'));
console.log('   유닛 ' + runs[0].units + '기 · 프레임 ' + runs[0].frames + ' · 첫 적 ' + runs[0].foe0 + '마리');
console.log('');
console.log('  ⚔ 사거리 안 비율      ' + M.inRange + '%      ← 전투가 실제로 이루어지는가 (낮으면 대부분 논다)');
console.log('  ⚔ 그중 **전투 중**만   ' + M.inRangeFight + '%      ← 적이 살아 있던 프레임만 (대기 시간을 뺀 값)');
console.log('  💤 적이 없던 프레임    ' + M.idlePct + '%      ← 위 두 값의 차이를 만드는 것');
console.log('  🎯 표적을 가진 비율    ' + M.hasTgt + '%      ← 낮으면 「못 찾는다」 · 높은데 위가 낮으면 「못 닿는다」');
console.log('  📐 못 닿는 정도        ×' + M.gapMul + '      ← 표적까지 거리 ÷ 사거리 (1.0 = 딱 사거리 끝)');
console.log('  🏃 자리에서 벗어난 거리  평균 ' + M.awayAvg + ' · 최대 ' + M.awayMax
  + '   ← 「돌격하는 느낌」의 자 (제한 = campEngageOut)');
console.log('  👀 표적을 알아챈 거리    ' + M.acqAt + '      ← 이게 이동 제한보다 크면 「나오자마자 우르르」');
console.log('  💫 방향 뒤집힘        ' + M.flips + '회/유닛   ← 덜덜 떠는 정도 (순수 오토배틀 기준 0.9)');
console.log('     ├ 사거리 안에서 꺾음  ' + M.flipInPct + '%   ← 높으면 「쏠 수 있는데 흔들린다」');
console.log('     ├ 사거리 밖에서 꺾음  ' + (100 - M.flipInPct) + '%   ← 높으면 「못 쏘고 **자리를 찾는 중**」');
console.log('     ├ 표적이 없었다       ' + M.flipNoTPct + '%');
console.log('     └ 표적이 방금 바뀌었다 ' + M.flipSwPct + '%');
console.log('     ⤷ 꺾은 뒤 3초 안에 사거리 안에 듦  ' + M.flipSolvedPct + '%   ← 높으면 「자리 잡는 중이었다」');
console.log('  🪑 자리 잡기          표적을 잡고 ' + M.settleMed + '초 만에 사거리 안 (느린 10% 는 ' + M.settleP90 + '초)');
console.log('     └ 닿음 ' + M.segDone + ' / 못 닿음 ' + M.segFail + ' / 적이 먼저 죽음 ' + M.segCleared
  + '   못 닿은 것 중 «가까워지곤 있었다» ' + M.failClosePct + '%');
console.log('  🎯 표적 바뀜          ' + M.tgtSw + '회/유닛   ← 떨림이 표적 흔들림 때문인지 가른다');
console.log('  ⚡ 순간이동(>60px)    ' + M.tele + '회 (최대 ' + M.teleMax + 'px)');
console.log('  🪢 목줄 발동          ' + M.leash + '회');
console.log('  🚚 자리잡기 밀기      ' + M.engPush + '회');
console.log('  📏 프레임당 이동      ' + M.moveAvg + 'px/유닛');
console.log('  💀 끝: 아군 ' + M.aliveEnd + '기 살아있음 · 적 ' + M.foeEnd + '마리 남음');
console.log('');
console.log('  🔫 아군이 쏜 횟수      ' + M.shotOut + '회      ← 위치 문제인지 표적 문제인지 가른다');
console.log('  💥 실제로 준 피해      ' + M.dmgOut + '  (설계 DPS ' + M.dpsMe + ' × ' + SECS + '초 = '
  + Math.round(M.dpsMe * SECS) + ')  → 실효 ' + M.effMe);
console.log('  🩸 실제로 받은 피해    ' + M.dmgIn + '  (적 DPS ' + M.dpsAi + ' × ' + SECS + '초 = '
  + Math.round(M.dpsAi * SECS) + ')  → 실효 ' + M.effAi);
console.log('  ❤ 총 체력  아군 ' + M.hpMe0 + ' vs 적 ' + M.hpAi0);
console.log('');
console.log('  판별 편차: ' + K.slice(0, 3).map(k => k + ' ' + runs.map(r => r[k]).join('/')).join(' · '));
console.log('  🖼 ' + shotPath);
if(errs.length) console.log('  ⚠ 페이지 예외 ' + errs.length + '건: ' + errs.slice(0, 3).join(' | '));
else console.log('  ✅ 페이지 예외 없음');

await b.close(); server.close();
