/* 🎓 튜토리얼 실주행 — 캠프에 들어가 단계를 하나씩 실제로 수행하며 넘어가는지 본다.
 *   ⚠ 숫자만 보면 안 된다: 「대상이 화면에 있나 · 링이 그것을 감싸나 · 문구가 무엇인가」를 함께 찍는다.
 *   쓰기: node scripts/tuto-run.mjs        (HEADFUL=1 이면 창을 띄운다) */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH || ''].filter(Boolean).find(p => fs.existsSync(p));
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.glb':'model/gltf-binary', '.mp3':'audio/mpeg', '.ogg':'audio/ogg',
  '.wav':'audio/wav', '.woff':'font/woff', '.woff2':'font/woff2' };
const server = http.createServer((req, res) => { try {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(ROOT, p === '/' ? 'sc-ums-web.html' : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
} catch (e) { res.writeHead(500); res.end(String(e)); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME,
  headless: process.env.HEADFUL ? false : 'new', args: ['--mute-audio', '--no-sandbox'] });
const page = await browser.newPage(); page.setDefaultTimeout(60000);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 160)));
await page.goto('http://127.0.0.1:' + PORT + '/sc-ums-web.html', { waitUntil: 'load' });
await page.waitForFunction('typeof G!=="undefined"', { timeout: 20000 });
await new Promise(r => setTimeout(r, 900));

// 캠프를 세운다 — 종족 선택 연출은 건너뛴다(연출은 다른 검사가 본다).
await page.evaluate(() => {
  try { localStorage.clear(); } catch (_) {}
  if (typeof profCreateChar === 'function') { try { profCreateChar('튜토'); } catch (_) {} }
  // ⚠ 종족을 **먼저** 정해 둔다 — openHome() 은 종족이 있으면 종족 판을 건너뛰고 곧장 campEnter 로 간다
  //   (19-camp.js: `if(!C.race) campRaceSheet(); else campEnter();`). 헤드리스에서는 종족 선택 연출의
  //   검은 판이 전환 이벤트를 못 받아 campPick 이 안 걷힌다 — 연출 자체는 다른 검사가 본다.
  // ⚠ openHome() 은 loadMeta() 로 저장분을 다시 읽어 방금 넣은 종족을 지운다 — 그래서 화면만 직접 세우고
  //   종족을 넣은 뒤 campOpen() 을 부른다(openHome 이 캠프를 여는 것과 같은 입구다).
  if (typeof showAppScreen === 'function') showAppScreen('homeScreen');
  if (typeof navShow === 'function') navShow('home');
  if (typeof renderHome === 'function') renderHome();
  const C = (typeof campState === 'function') ? campState() : null; if (C && !C.race) C.race = 'terran';
  if (typeof campOpen === 'function') campOpen();
  // ⚠ 헤드리스에서는 진입 연출이 끝나며 캠프를 도로 걷어 버린다(campHideView) — 그러면 하단 카드가
  //   사라져 아무것도 못 잰다. 검사 동안만 걷는 문을 막는다.
  try { window.campHideView = function(){}; } catch (_) {}
});
// 캠프가 실제로 켜질 때까지 기다린다 — 전환 연출이 끝나기 전에는 아무것도 못 잰다.
// ⚠ 하단 요약판은 **떴다가 다시 그려지며 잠깐 사라진다** — 한 번 봤다고 진행하면 그 뒤 카드를 못 찾는다.
//   그래서 연속 3회 보일 때까지 기다린다(실측: 한 번만 보고 갔더니 같은 스크립트가 될 때와 안 될 때가 갈렸다).
{ let hit = 0;
  for (let i = 0; i < 80; i++) { const st = await page.evaluate(() => ({
      on: (typeof campIsOn === 'function') ? campIsOn() : null,
      mm: (() => { const e = document.querySelector('[data-minemode]'); return e ? e.getClientRects().length : -1; })(),
      clip: (() => { const e = document.getElementById('homeScreen'); return e ? (e.className + '|' + getComputedStyle(e).display) : null; })(),
      sheetH: (() => { const e = document.getElementById('btSheet'); return e ? Math.round(e.getBoundingClientRect().height) : -1; })(),
      tuto: !!document.getElementById('tutoOv') }));
    hit = (st.on && st.mm > 0) ? hit + 1 : 0;
    if (hit >= 3) break;
    // ⚠ 부팅 타이머가 **뒤늦게** 로비/로그인으로 덮는다(실측: homeScreen 이 hide 로 돌아갔다) — 다시 세운다.
    await page.evaluate(() => { const e = document.getElementById('homeScreen');
      if (e && e.classList.contains('hide')) {
        if (typeof showAppScreen === 'function') showAppScreen('homeScreen');
        if (typeof navShow === 'function') navShow('home');
        if (typeof campOpen === 'function') campOpen(); } });
    if (i === 79) console.log('⚠ 캠프 하단이 안 뜬다: ' + JSON.stringify(st));
    await new Promise(r => setTimeout(r, 760)); } }
// 종족 판을 걷는다 — 헤드리스에서는 검은 판의 전환 이벤트가 안 떨어져 campPick 이 남는다(연출 자체는 다른 검사가 본다).
await page.evaluate(() => { const ph = document.getElementById('phone');
  if (ph) { ph.classList.remove('campPick'); ph.classList.remove('artBlack'); }
  const ov = document.getElementById('campRaceOv'); if (ov) { ov.classList.remove('on'); ov.classList.add('hide'); } });
await new Promise(r => setTimeout(r, 760));
await page.evaluate(() => {
  const S = (typeof guideState === 'function') ? guideState() : null;
  // ⚠ 평소에는 안 뜬다(TUTO_AUTO=false) — 「해 보기」로 켠 판(S.trun)으로 세운다.
  if (S) { S.t = 0; S.base = null; delete S.skip; S.trun = 1; }
  if (typeof TUTO_OFF !== 'undefined') TUTO_OFF = false;
  if (typeof tutoKick === 'function') tutoKick();
});
// 🎬 처음 뜰 때의 페이드인은 **스모크가 프레임으로 잰다**(「튜토리얼: 건물 짓기가 …」 스텝).
//   여기서 재려 했더니 오버레이가 이미 떠 있는 때가 많아 첫 프레임을 못 잡았다.

const snap = () => page.evaluate(() => {
  const st = (typeof tutoStep === 'function') ? tutoStep() : null;
  const t = (typeof tutoTarget === 'function') ? tutoTarget() : null;
  const ov = document.getElementById('tutoOv');
  const ring = ov ? ov.querySelector('.tuRing').getBoundingClientRect() : null;
  return { i: (typeof tutoIdx === 'function') ? tutoIdx() : -1, id: st ? st.id : null,
    tip: t ? t.tip : null, n: t ? t.n : null, goal: t ? t.goal : null,
    map: t ? !!t.map : null, hasTarget: !!t, ov: !!ov,
    lines: ov ? (function(){ const x=ov.querySelector('.tuTx'); if(!x) return -1;
      const lh=parseFloat(getComputedStyle(x).lineHeight)||17;
      return Math.round(x.getBoundingClientRect().height/lh); })() : -1,
    tipW: ov ? Math.round(ov.querySelector('.tuTip').getBoundingClientRect().width) : -1,
    no: ov ? (ov.querySelector('.tuStep') || {}).textContent : null,
    aim: ov ? (function(){ const tp=ov.querySelector('.tuTip'), rg=ov.querySelector('.tuRing');
      if(!tp||!rg) return null; const tr=tp.getBoundingClientRect(), rr=rg.getBoundingClientRect();
      // ⚠ **::after 의 계산된 left** 를 읽는다 — JS 가 넣은 변수를 읽으면 CSS 가 그걸 쓰든 말든 같은 값이 나온다.
      const v=parseFloat(getComputedStyle(tp,'::after').left)||tr.width/2;
      return Math.round((tr.left+v)-(rr.left+rr.width/2)); })() : null,
    btn: ov ? (function(){ const g=ov.querySelector('.tuGo');
      return g ? (getComputedStyle(g).display!=='none') : false; })() : false,
    ring: ring ? { w: Math.round(ring.width), h: Math.round(ring.height) } : null,
    credit: (typeof G !== 'undefined' && G.tech) ? Math.floor(G.tech.credit || 0) : 0,
    arm: (typeof G !== 'undefined' && G.tech) ? G.tech.arm : null,
    selU: ((typeof G !== 'undefined' && G.tech && G.tech.selU) || []).length };
});
const log = async (what) => { const s = await snap();
  console.log((String(s.no || '-').padStart(7) + ' ' + String(s.id || '-').padEnd(9) + ' ' + s.n + '/' + s.goal).padEnd(30)
    + (s.map ? '[맵]' : (s.ring ? ('[' + s.ring.w + 'x' + s.ring.h + ']') : '[대상없음]')).padEnd(12)
    + ('꼬리Δ'+String(s.aim==null?'-':s.aim)+'px').padEnd(11)
    + String(s.tip||'').split(String.fromCharCode(10)).join(' | ') + (what ? ('   <- ' + what) : '')); };


await log('시작');
await page.evaluate(() => { if (typeof campMineModeSet === 'function') campMineModeSet(true); });
await new Promise(r => setTimeout(r, 760)); await log('채굴 켬');
await page.evaluate(() => { for (let i = 0; i < 12; i++) if (typeof campMineOnce === 'function') campMineOnce(195, 400, false); });
await new Promise(r => setTimeout(r, 760)); await log('12번 캠');
await page.evaluate(() => { const b = document.querySelector('.navIt[data-nav="research"]'); if (b) b.click(); });
await new Promise(r => setTimeout(r, 500)); await log('연구 엶');

const feed = async (n) => { await page.evaluate((k) => {
  if (typeof G !== 'undefined' && G.tech) G.tech.credit = (G.tech.credit || 0) + k;
  if (typeof updateCurBar === 'function') updateCurBar(); }, n); };

for (let guard = 0; guard < 24; guard++) {
  const s = await snap();
  if (s.id === null) break;
  if (/^coin/.test(s.id)) { await feed(Math.max(0, s.goal - s.credit) + 5);
    await new Promise(r => setTimeout(r, 760)); await log('돈 채움'); continue; }
  if (s.id === 'upgTap' || s.id === 'upgGat') { const k = (s.id === 'upgTap') ? 'tap' : 'gather';
    await page.evaluate((kk) => { if (typeof campUpgBuy === 'function') campUpgBuy(kk);
      else if (typeof campUpgBuyN === 'function') campUpgBuyN(kk, 1); }, k);
    await new Promise(r => setTimeout(r, 760)); await log('강화 삼'); continue; }
  if (s.id === 'worker') { await page.evaluate(() => {
      const bk = (typeof campWorkerBldg === 'function') ? campWorkerBldg() : null;
      if (bk && typeof techDoProduce === 'function') techDoProduce(TECH_WORKER[G.tech.race], bk); });
    await new Promise(r => setTimeout(r, 760)); await log('일꾼 뽑음'); continue; }
  break;
}

{ const ok = await page.evaluate(() => { const b = document.getElementById('campMineStop'); if (!b) return false; b.click(); return true; });
  await new Promise(r => setTimeout(r, 760)); await log(ok ? '채굴 멈춤 버튼 누름' : '⚠ 멈춤 버튼이 없다'); }

// 👷 일꾼은 **생산에 3초**가 걸린다 — 뽑자마자 지정하려 들면 아직 없다.
for (let i = 0; i < 40; i++) { const has = await page.evaluate(() =>
    !!(typeof G !== 'undefined' && G.tech && G.tech.ents.find(e => e.type === 'worker')));
  if (has) break; await new Promise(r => setTimeout(r, 760)); }
await page.evaluate(() => { if (typeof G === 'undefined' || !G.tech) return;
  const w = G.tech.ents.find(e => e.type === 'worker');
  if (w) { G.tech.sel = null; G.tech.selU = [w.eid];
    // 드래그 지정 핸들러가 하는 것과 같다 — 시트를 열어야 건설 카드가 나온다.
    const sh = G.tech.sheet || (G.tech.sheet = {}); sh.open = true; sh.sec = 'ent';
    if (typeof techUIRender === 'function') techUIRender(); } });
await new Promise(r => setTimeout(r, 760)); await log('일꾼 지정');

for (let guard = 0; guard < 20; guard++) {
  const s = await snap(); const id = String(s.id || '');
  if (!/^(armB|placeB|deselWk|selB1|unit|dg|outro)/.test(id)) break;
  if (id === 'dgOpen') {
    await page.evaluate(() => { const e = document.getElementById('curTitle'); if (e) e.click();
      else if (typeof campDropToggle === 'function') campDropToggle(); });
    await new Promise(r => setTimeout(r, 760)); await log('칩 누름'); continue; }
  if (id === 'dgPick') {
    const r = await page.evaluate(() => { const el = document.querySelector('.cdRow[data-dg="' + TUTO_DG + '"]');
      if (!el) return '⚠ 던전 칸이 없다'; el.click(); return '던전 ' + TUTO_DG + ' 고름'; });
    await new Promise(r => setTimeout(r, 760)); await log(r); continue; }
  if (id === 'outro') {
    const r = await page.evaluate(() => { const ov = document.getElementById('tutoOv');
      const g0 = (typeof profGem === 'function') ? profGem() : -1;
      const go = ov ? ov.querySelector('.tuGo') : null;
      const shown = !!(go && !go.hidden);
      const label = go ? go.textContent.replace(/s+/g,' ').trim() : '-';
      const ico = go ? go.querySelectorAll('img,svg,i').length : -1;
      const icoH = go ? String(go.innerHTML).slice(0,120) : '';
      if (go) go.click();
      window.__g0 = g0;
      return '확인 버튼 ' + (shown ? ('보임 「' + label + '」') : '⛔ 안 보임')
        + ' · 아이콘요소 ' + ico + ' · 젬 ' + g0 + '→' + ((typeof profGem === 'function') ? profGem() : -1)
        + String.fromCharCode(10) + '        HTML: ' + icoH; });
    await new Promise(r => setTimeout(r, 760));
    const gem = await page.evaluate(() => (window.__g0|0) + '→' + ((typeof profGem==='function')?profGem():-1));
    await log(r + ' · 텀 뒤 젬 ' + gem); continue; }
  if (id === 'dgGo') {
    const r = await page.evaluate(() => { const el = document.querySelector('.cdGo');
      if (!el) return '⚠ 이동 버튼이 없다'; el.click(); return '이동 누름'; });
    // 🎞 마지막 단계로 가는 **궤적** — 왼쪽을 들렀다 오는지 프레임마다 링 자리를 적는다.
    { const tr = await page.evaluate(async () => { const ov=document.getElementById('tutoOv');
        const rg=ov?ov.querySelector('.tuRing'):null; const out=[];
        for(let i=0;i<40;i++){ await new Promise(r=>requestAnimationFrame(r));
          const q=rg?rg.getBoundingClientRect():null;
          out.push(q?(Math.round(q.left)+','+Math.round(q.top)):'-'); }
        return out; });
      const uniq=[]; for(const p of tr) if(uniq[uniq.length-1]!==p) uniq.push(p);
      console.log('        링 궤적: ' + uniq.join('  ')); }
    await new Promise(r => setTimeout(r, 760)); await log(r); continue; }
  if (/^armB/.test(id)) {
    const hit = await page.evaluate((sid) => { const sel = _tutoBSel(sid === 'armB1' ? 0 : 1);
      const el = sel ? document.querySelector(sel) : null;
      if (!el) return { sel: sel, found: false }; el.click(); return { sel: sel, found: true }; }, id);
    await new Promise(r => setTimeout(r, 760));
    if (!hit.found) { console.log('   하단 칸들: ' + await page.evaluate(() =>
      [...document.querySelectorAll('.cgSlot')].map(e => (e.querySelector('.cgName') || {}).textContent
        + '|' + String(e.getAttribute('onclick') || '').slice(0, 34)).join(' ; ')
      + '   /// 시트=' + JSON.stringify((typeof G !== 'undefined' && G.tech) ? G.tech.sheet : null)
      + ' selU=' + JSON.stringify((typeof G !== 'undefined' && G.tech) ? G.tech.selU : null))); }
    await log(hit.found ? ('카드 누름 ' + hit.sel) : ('⚠ 카드를 못 찾았다 ' + hit.sel));
    if (!hit.found) break; continue; }
  if (/^placeB/.test(id)) {
    const r = await page.evaluate(() => { if (typeof G === 'undefined' || !G.tech || !G.tech.arm) return 'arm 없음';
      const bk = G.tech.arm;
      // ⚠ **화면 안에** 짓는다 — 격자 절대좌표로 찍으면 확대된 캠프에서는 화면 밖일 수 있고,
      //   그러면 스포트라이트가 맞는지 눈으로 못 본다(2026-09-04).
      const v = (typeof techView === 'function') ? techView() : { x:0.5, y:0.5 };
      for (let k = 0; k < 48; k++) { const x = v.x + ((k % 8) - 3.5) * 0.03, y = v.y + (Math.floor(k / 8) - 2) * 0.03;
        if (typeof techArmValid === 'function' && techArmValid(x, y)) { G.tech.armXY = { x: x, y: y }; techConfirmPlace(); return '놓음 ' + bk; } }
      return '자리를 못 찾았다 ' + bk; });
    // ⏱ **손대지 않는다** — 튜토리얼은 즉시 건설이라(tutoNoWait) 기다림 없이 완성돼야 한다.
    //   여기서 강제로 완성시키면 그 규칙이 도는지를 못 잰다.
    await new Promise(r => setTimeout(r, 500));
    const bt = await page.evaluate(() => { const e = (G.tech.ents || []).find(x => x.type === 'bldg' && x.bk === _tutoBk(0));
      return e ? (e.bt | 0) : -1; });
    await log(r + ' · 남은 건설시간 ' + bt); continue; }
  if (id === 'deselWk') {
    await page.evaluate(() => { const b = document.getElementById('btDesel'); if (b) b.click();
      else if (typeof techDeselU === 'function') techDeselU(); });
    await new Promise(r => setTimeout(r, 760)); await log('지정 해제'); continue; }
  if (id === 'selB1') {
    // 🖼 SHOT=1 이면 이 단계를 한 장 찍는다 — 링이 **실제 건물 위**에 놓였는지는 눈으로 봐야 안다.
    if (process.env.SHOT) { await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: 'docs/mock/camp-tuto-bldring.png' });
      console.log('        shot docs/mock/camp-tuto-bldring.png'); }
    const r = await page.evaluate(() => { const k = _tutoBk(2);
      const e = (G.tech.ents || []).find(x => x.type === 'bldg' && x.bk === k && x.bt <= 0);
      if (!e) return '건물이 없다 ' + k;
      G.tech.selU = []; G.tech.sel = e.eid;
      const sh = G.tech.sheet || (G.tech.sheet = {}); sh.open = true; sh.sec = 'ent';
      if (typeof techUIRender === 'function') techUIRender();
      // 💰 **카드가 열리는 그 순간** 값을 읽는다 — 뒤늦게 0 이 되면 사용자가 잠긴 카드를 본다.
      const uid = _tutoUnitId();
      const bb = techGetBldg(G.tech.race, k), p = (bb && bb.produces || []).find(x => x.id === uid);
      const el = document.querySelector(_tutoUnitSel());
      const cost = el ? (el.querySelector('.cgCost') || {}).textContent : null;
      return '지정 ' + k + ' · 그 순간 ' + uid + ' 값 ' + (p ? p.m : '?')
        + ' · 카드 표시 "' + String(cost || '-').trim().replace(/s+/g, ' ') + '"'
        + ' · 잠김 ' + (el ? el.classList.contains('dim') : '?'); });
    await new Promise(r => setTimeout(r, 760)); await log(r); continue; }
  if (id === 'unit') {
    // 💰 값이 0 인지(첫 한 기 공짜) 함께 본다 — 카드가 읽는 값이 곧 실제 지불액이다.
    const r = await page.evaluate(() => { if (typeof G === 'undefined' || !G.tech) return 'G 없음';
      const uid = _tutoUnitId(), bk = _tutoBk(2);
      const b = (typeof techGetBldg === 'function') ? techGetBldg(G.tech.race, bk) : null;
      const p = (b && b.produces || []).find(x => x.id === uid);
      const cost = p ? (p.m | 0) : -1, had = (G.tech.credit || 0);
      const el = document.querySelector(_tutoUnitSel());
      if (el) el.click(); else if (typeof techDoProduce === 'function') techDoProduce(uid, bk);
      return uid + ' 값 ' + cost + ' · 지갑 ' + had + '→' + Math.floor(G.tech.credit || 0)
        + (el ? ' · 카드로 눌렀다' : ' · ⚠ 카드를 못 찾아 직접 불렀다'); });
    await new Promise(r => setTimeout(r, 760)); await log(r); continue; }
}
await log('끝');
// ⏱ 튜토리얼이 끝나면 **즉시 생산이 꺼져야 한다** — 안 꺼지면 게임이 통째로 치트 상태가 된다.
{ await new Promise(r => setTimeout(r, 600));
  const t = await page.evaluate(() => ({ on: (typeof tutoOn === 'function') ? tutoOn() : null,
    nw: (typeof tutoNoWait === 'function') ? tutoNoWait() : null,
    nocool: !!(typeof G !== 'undefined' && G.tech && G.tech.nocool),
    dg: (typeof campDgN === 'function') ? campDgN() : null,
    ov: !!document.getElementById('tutoOv') }));
  console.log('끝난 뒤: 튜토리얼 ' + t.on + ' · 즉시생산 ' + t.nocool + ' · 던전 ' + t.dg + ' · 딤 ' + t.ov); }
// ⚔ 던전 1 을 레인저 1 기로 버티나 — 튜토리얼 직후 바로 지면 인상이 나쁘다(지면 캠프로 부활 복귀한다).
{ const r = await page.evaluate(async () => {
    const n0 = (typeof campFail === 'function' && typeof campState === 'function') ? (campState().fails | 0) : -1;
    for (let i = 0; i < 600; i++) { if (typeof campCombatStep === 'function') campCombatStep(0.1); }
    const B = (typeof CAMPB !== 'undefined') ? CAMPB : null;
    const mine = B && B.me && B.me.units ? B.me.units.filter(u => u && !u.dead).length : -1;
    const foes = B && B.ai && B.ai.units ? B.ai.units.filter(u => u && !u.dead).length : -1;
    const baseHp = B && B.me && B.me.base ? Math.round(B.me.base.hp) + "/" + Math.round(B.me.base.maxHp) : "-";
    return { dg: (typeof campDgN === 'function') ? campDgN() : null,
      rnd: (typeof campRoundN === 'function') ? campRoundN() : null,
      mine: mine, foes: foes, baseHp: baseHp, fails: (typeof campState === 'function') ? (campState().fails | 0) : -1, n0: n0 }; });
  console.log('던전 1 에서 60초: 내 병력 ' + r.mine + ' · 적 ' + r.foes + ' · 본부 ' + r.baseHp
    + ' · 지금 던전/라운드 ' + r.dg + '/' + r.rnd); }
console.log('\n총 단계 ' + (await page.evaluate(() => TUTO_STEPS.length)));
if (errs.length) console.log('페이지 오류: ' + errs.join(' | '));
await browser.close(); server.close();
