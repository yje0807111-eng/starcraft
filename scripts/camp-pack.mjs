/* ============================================================================
 * camp-pack.mjs — 유닛이 **얼마나 붙어 설 수 있는지**를 실제 화면으로 본다 (2026-09-01)
 *   간격 셋(20/60/100px) + 전투 중 한 칸을 나란히 찍고, 겹친 쌍·최소 간격을 함께 낸다.
 *   ⚠ 게임 최대 확대는 3.1 이라 그대로는 유닛이 점만 하다 — 캔버스에서 2배로 그린다.
 *   사용: CHROME_PATH=... node scripts/camp-pack.mjs   → docs/mock/camp-pack.png
 *
 * (아래는 camp-trace.mjs 의 부팅부를 그대로 쓴 것이다)
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

// 🧪 세 가지 간격으로 세워 보고 ① 실제 화면 ② 정착 뒤 간격을 함께 낸다.
const CASES = [
  { name:'촘촘 20px', gap: 20 },
  { name:'지금 60px', gap: 60 },
  { name:'넉넉 100px', gap: 100 },
  // ⭐ 진짜 물음 — 서 있을 때가 아니라 **싸울 때** 겹치는가
  { name:'전투 중 60px', gap: 60, fight: true },
];
const shots = [];
for(const c of CASES){
  const info = await pg.evaluate((gapPx, fight) => {
    const dt = 1/30;
    campEnterDungeon(1); CAMPB = null; campCombatStep(dt);
    if(!CAMPB) return { err:'전장이 안 열림' };
    campWithStk(() => { STK.me.units.length = 0; STK.ai.units.length = 0; });
    if(CAMPB._down) CAMPB._down.length = 0;
    if(CAMPB._wq) CAMPB._wq.length = 0;
    if(!fight) CAMPB.ai.units.length = 0;           // 적 없이 — 자리만 본다
    const list = [];
    for(const part of 'marine*9,machinegun*4,medic*2'.split(',')){
      const m = part.trim().split('*'); for(let i=0;i<+(m[1]||1);i++) list.push(m[0].trim()); }
    const W = CAMPB.world || 4800;
    // gapPx(전장 px) → 격자 간격
    const gg = gapPx / W * CAMP_LANE_W;
    const x0 = 0.5 - gg * (list.length - 1) / 2;
    list.forEach((id, i) => campDeploy(id, x0 + i * gg, CAMP_LINE_GY));
    CAMPB._started = false; CAMPB._gapT = 0;
    if(fight){ for(let f=0; f<600; f++) campCombatStep(dt); }        // 20초 — 실제로 싸우는 중
    else { for(let f=0; f<150; f++){ campCombatStep(dt); CAMPB.ai.units.length = 0; } }  // 5초 — 자리에 정착
    const me = CAMPB.me.units.filter(u=>!u.dead);
    // 겹침 최소거리 = (a.size+b.size)*STK_SEP
    let pairs = 0, over = 0, minD = Infinity, sumMin = 0;
    for(let i=0;i<me.length;i++){
      let best = Infinity;
      for(let j=0;j<me.length;j++){ if(i===j) continue;
        const d = Math.hypot(me[i].x-me[j].x, me[i].y-me[j].y);
        if(d < best) best = d;
        if(j > i){ pairs++;
          const need = ((me[i].size||14)+(me[j].size||14))*STK_SEP;
          if(d < need) over++; } }
      if(best < minD) minD = best; sumMin += best; }
    let spanX = 0, spanY = 0;
    for(let i=0;i<me.length;i++) for(let j=i+1;j<me.length;j++){
      spanX = Math.max(spanX, Math.abs(me[i].x-me[j].x));
      spanY = Math.max(spanY, Math.abs(me[i].y-me[j].y)); }
    const need0 = 28*STK_SEP;
    // 화면이 부대를 담도록 시점을 맞춘다
    const cx = me.reduce((a,u)=>a+u.x,0)/me.length, cy = me.reduce((a,u)=>a+u.y,0)/me.length;
    const g = campW2G(cx, cy, W);
    G.tech.view.x = g.gx; G.tech.view.y = g.gy; G.tech.view.zoom = techMaxZoom();   // 게임에서 확대할 수 있는 최대(3.1)
    techMapRender();
    // 🔍 부대가 화면 어디에 그려졌는지 — campBattleList 가 0~1 화면 비율로 준다
    let bx0=1, bx1=0, by0=1, by1=0;
    for(const e of campBattleList()){ if(e.x<bx0)bx0=e.x; if(e.x>bx1)bx1=e.x;
      if(e.y<by0)by0=e.y; if(e.y>by1)by1=e.y; }
    return { n:me.length, minD:Math.round(minD), avgMin:Math.round(sumMin/me.length),
      over, pairs, need:Math.round(need0), spanX:Math.round(spanX), spanY:Math.round(spanY),
      bx0:bx0, bx1:bx1, by0:by0, by1:by1 };
  }, c.gap, !!c.fight);
  if(info.err) throw new Error(info.err);
  await new Promise(r => setTimeout(r, 700));
  const el = await pg.$('#phone');
  const box = await el.boundingBox();
  // 부대 주변만 잘라낸다 — 화면 전체를 찍으면 유닛이 점만 하게 나온다
  const mx = 0.06, my = 0.22;
  const cx0 = Math.max(0, Math.min(info.bx0, info.bx1) - mx), cx1 = Math.min(1, Math.max(info.bx0, info.bx1) + mx);
  const cy0 = Math.max(0, Math.min(info.by0, info.by1) - my), cy1 = Math.min(1, Math.max(info.by0, info.by1) + my);
  const buf = await pg.screenshot({ encoding:'base64', clip:{
    x: box.x + box.width * cx0, y: box.y + box.height * cy0,
    width: Math.max(40, box.width * (cx1 - cx0)), height: Math.max(40, box.height * (cy1 - cy0)) } });
  shots.push({ ...c, info, b64: buf });
  console.log(`  ${c.name.padEnd(12)} 최소간격 ${String(info.minD).padStart(3)}px · 평균 최근접 ${String(info.avgMin).padStart(3)}px`
    + ` · 겹친 쌍 ${info.over}/${info.pairs} (겹침 기준 ${info.need}px) · 가로폭 ${info.spanX} · 세로폭 ${info.spanY}`);
}

// 세 장을 한 장으로 합친다
const png = await pg.evaluate(async (shots) => {
  const imgs = await Promise.all(shots.map(s => new Promise(res => {
    const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s.b64; })));
  const K = 2;   // 2배로 그린다 — 게임 최대 확대(3.1)에서도 유닛이 작아 눈으로 못 센다
  const PAD = 14, HEAD = 64, W = imgs[0].width*K, H = imgs[0].height*K;
  const cv = document.createElement('canvas');
  cv.width = PAD + (W + PAD) * imgs.length; cv.height = HEAD + H + PAD + 72;
  const x = cv.getContext('2d');
  x.fillStyle = '#0a0c10'; x.fillRect(0,0,cv.width,cv.height);
  x.fillStyle = '#cfe6ff'; x.font = 'bold 22px sans-serif';
  x.fillText('유닛 간격 실험 — 보병 15기를 한 줄로 세우고 5초 뒤 (적 없음)', PAD, 30);
  x.font = '15px sans-serif'; x.fillStyle = '#8fb6d8';
  x.fillText('겹침 기준 ' + shots[0].info.need + 'px 보다 가까우면 서로 밀어낸다', PAD, 52);
  imgs.forEach((im, i) => {
    const s = shots[i], ox = PAD + (W + PAD) * i;
    x.imageSmoothingEnabled = false; x.drawImage(im, ox, HEAD, W, H);
    x.strokeStyle = s.info.over ? '#ff7a86' : '#5de08a'; x.lineWidth = 2;
    x.strokeRect(ox-1, HEAD-1, W+2, H+2);
    x.fillStyle = '#e8f2ff'; x.font = 'bold 17px sans-serif';
    x.fillText(s.name, ox, HEAD + H + 22);
    x.font = '14px sans-serif'; x.fillStyle = s.info.over ? '#ff9aa4' : '#7de0a4';
    x.fillText('최소 ' + s.info.minD + 'px · 겹친 쌍 ' + s.info.over + '/' + s.info.pairs, ox, HEAD + H + 42);
    x.fillStyle = '#8fb6d8';
    x.fillText('폭 ' + s.info.spanX + '×' + s.info.spanY, ox, HEAD + H + 60);
  });
  return cv.toDataURL('image/png');
}, shots);

const out = 'docs/mock/camp-pack.png';
fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
console.log('  🖼 ' + out);
await b.close(); process.exit(0);
