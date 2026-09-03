/* ============================================================================
 * tree-unlock.mjs — ✨ 해금 연출을 **프레임으로** 본다 (2026-09-03)
 *
 * ⚠ 연출은 평균값·최종 상태로 판단하면 안 된다(CLAUDE.md · DESIGN.md §5.5).
 *   선이 먼저 자라고 별이 뒤따르는지, 채도가 실제로 차오르는지는 **중간 프레임**에만 있다.
 * 사용: CHROME_PATH=... node scripts/tree-unlock.mjs
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2' };
const server = http.createServer((q, s) => { try {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const f = path.join(ROOT, p === '/' ? 'sc-ums-web.html' : p);
  if(!f.startsWith(ROOT)){ s.writeHead(403); return s.end(); }
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end('nf'); }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
} catch(e){ s.writeHead(500); s.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new',
  protocolTimeout: 300000, args: ['--mute-audio','--no-sandbox','--disable-gpu-sandbox'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`, { waitUntil: 'load' });
await pg.waitForFunction('typeof campRebEnter==="function"', { timeout: 30000 });
await pg.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); });
await new Promise(r => setTimeout(r, 900));
await pg.evaluate(() => { if(typeof campHasRace==='function' && !campHasRace() && typeof campPickRace==='function') campPickRace(); });
await new Promise(r => setTimeout(r, 1300));
// 가운데와 갈래 하나만 열어 둔다 — 그다음 묶음을 사서 「구역이 생성되는」 장면을 본다
await pg.evaluate(() => { const C = campState();
  C.rbTree = { root:1, _m2:1, 'br:econ':1 }; C.rbPts = 1e12;
  campRebEnter('tree'); });
await new Promise(r => setTimeout(r, 900));
await pg.evaluate(() => { campTreeZoomAt(1.5, null); campTreeViewSettle(); });
await new Promise(r => setTimeout(r, 200));

const OUT = path.join(ROOT, 'docs', 'mock');
// 사기 직전
await pg.screenshot({ path: path.join(OUT, 'tree-unlock-0.png') });
// 산다 — 묶음 마디 하나
await pg.evaluate(() => {
  _campTreeSel = { t:'gp', a:'econ', b:'가' };
  campTreeRender();
  const el = document.getElementById('campTree');
  const btn = el && el.querySelector('.ctBuy');
  if(btn && !btn.disabled) campTreeBuySel();
});
// ⚠ **스크린샷을 기다려서 찍으면 안 된다** — 한 장에 수백 ms 가 걸려 첫 장에 이미 애니가 끝난다
//   (2026-09-03 실측: 90ms 프레임이 800ms 프레임과 똑같았다).
//   ⭐ 애니를 **멈추고 원하는 시점으로 되돌려** 찍는다 — animation-play-state:paused + 음수 delay.
const at = async (t) => {
  await pg.evaluate(function(ms){
    // ⚠ 끝난 애니에 delay 만 바꾸면 **재시작되지 않는다**. animation:none 으로 한 번 끊고
    //   강제로 재계산(reflow)시킨 뒤 되살려야 그 시점으로 간다(2026-09-03 실측).
    document.querySelectorAll('#campTree .ctPop, #campTree .ctGrow, #campTree .ctFade')
      .forEach(function(e){
        e.style.animation = 'none';
        void e.getBoundingClientRect();
        e.style.animation = '';
        e.style.animationPlayState = 'paused';
        e.style.animationDelay = (-ms) + 'ms'; });
  }, t);
  await new Promise(r => setTimeout(r, 60));
  await pg.screenshot({ path: path.join(OUT, 'tree-unlock-' + t + '.png') }); };
// 🔬 **at() 보다 먼저** 읽는다 — at() 은 인라인 animation 을 지워 duration 까지 날린다(2026-09-03 실측).
{ const pre = await pg.evaluate(function(){
    return [].map.call(document.querySelectorAll('#campTree .ctGrow'), function(e){
      const cs = getComputedStyle(e);
      return { len:+e.style.getPropertyValue('--ctLen'), dur:cs.animationDuration,
        da:cs.strokeDasharray }; }); });
  console.log('선 자람: ' + JSON.stringify(pre)); }
for(const ms of [90, 220, 400, 800]) await at(ms);
// 🔬 진단 — 애니가 실제로 값에 반영되나
{ const diag = await pg.evaluate(function(){
    const out = [];
    document.querySelectorAll('#campTree .ctPop').forEach(function(e, i){
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      out.push({ t:'pop' + i, op:cs.opacity, tr:cs.transform.slice(0, 26), fil:cs.filter,
        an:cs.animationName, st:cs.animationPlayState, dl:cs.animationDelay,
        box:[Math.round(r.left), Math.round(r.top), Math.round(r.width)] }); });
    document.querySelectorAll('#campTree .ctGrow').forEach(function(e, i){
      const cs = getComputedStyle(e);
      out.push({ t:'grow' + i, da:cs.strokeDasharray, dur:cs.animationDuration,
        an:cs.animationName, st:cs.animationPlayState, len:e.style.getPropertyValue('--ctLen') }); });
    return out; });
  console.log(JSON.stringify(diag, null, 1)); }
// 애니 클래스가 실제로 붙었나 + 흐르는 빛이 도는가
const probe = await pg.evaluate(() => {
  const g = document.getElementById('ctG');
  return { pop: g.querySelectorAll('.ctPop').length, grow: g.querySelectorAll('.ctGrow').length,
           flowLinks: (typeof _ctFlowLinks !== 'undefined') ? _ctFlowLinks.length : -1,
           flowOn: (typeof _ctFlowT !== 'undefined') && !!_ctFlowT };
});
console.log('애니 ' + JSON.stringify(probe));
// 흐르는 빛 — 인터벌을 기다렸다가 원이 생기는지 본다
await new Promise(r => setTimeout(r, 2000));
const flow = await pg.evaluate(() => document.querySelectorAll('#ctG circle animate').length);
console.log('흐르는 빛 요소 ' + flow + '개(0 이면 아직 안 뜬 순간일 수 있다)');
console.log(errs.length ? ('⚠ 예외 ' + errs.length + '건: ' + errs[0]) : '✅ 예외 없음');
await b.close(); server.close();
