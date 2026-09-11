/* ============================================================================
 * rbtree-bench.mjs — 🌳🔁 **환생 트리 값 실측** (2026-09-11)
 *
 * ⚠ 이 표는 눈금(한 바퀴 18점)만 보고 올린 출발점이었다. 여기서 **실제로 잰다.**
 *   ⛔ 모델로 추정하지 말 것 — 이 프로젝트에서 해석적 추정은 여러 번 크게 빗나갔다.
 *
 * 재는 것
 *   ① 🔓 일꾼 상한(capWk 40→80) — 일꾼을 늘리면 **수입이 실제로 느나**.
 *      ⚠ 광맥 8덩이 × 5기(CAMP_MINE_CAP)가 천장이라 40 위는 놀 수 있다(16-build `_techMinerFull`).
 *   ② 🔓 유닛 반복 구매 배수(capUnitR 1.30→1.24) — 같은 돈으로 **몇 기를 더 사나**.
 *   ③ 🟡 기본 배수(rebMul +1) — 환생 횟수에 따라 **몇 % 오르나**(합산이라 뒤로 갈수록 옅어진다).
 *   ④ 🔓 보급소 상한(capSup 24→40) — 인구 천장이 얼마나 오르고 **값이 얼마나 드나**.
 *   ⑤ 🎫 던전 시작 지점(dgStart 2) — 클리어 시간이 얼마나 줄어드나.
 *
 * 사용: CHROME_PATH=... node scripts/rbtree-bench.mjs [측정초]
 *   ⚠ **단독으로 돌릴 것**(벤치 규약 · 스모크와 겹치면 판이 멎는 사례가 있다).
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core'; import url from 'node:url';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const CHROME=process.env.CHROME_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>fs.existsSync(p));
if(!CHROME){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
const SEC=+(process.argv[2]||120);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((q,r)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 const f=path.join(ROOT,p==='/'?'sc-ums-web.html':p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
 fs.createReadStream(f).pipe(r);}catch(e){r.writeHead(500);r.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',
  args:['--mute-audio','--no-sandbox'],protocolTimeout:900000});
const pg=await browser.newPage(); await pg.setViewport({width:390,height:844});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message||e).slice(0,180)));
await pg.goto('http://127.0.0.1:'+server.address().port+'/sc-ums-web.html',{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"',{timeout:30000});
await pg.evaluate(()=>{document.getElementById('opening')?.classList.add('hide');
 document.getElementById('auth')?.classList.add('hide');
 const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','벤치');
 const C=campState(); C.race='terran'; saveMeta(); openHome();});
await pg.waitForFunction("typeof campIsOn==='function'&&campIsOn()&&typeof G!=='undefined'&&G.tech&&(G.tech.ents||[]).some(e=>e.type==='bldg')",{timeout:30000});
await new Promise(r=>setTimeout(r,900));

const out=await pg.evaluate(async(SEC)=>{
  window.requestAnimationFrame=()=>0;
  campStopFrame(); campStopTimer();
  const C=campState();
  const R={};

  // ── ① 🔓 일꾼 상한 ─────────────────────────────────────────────────────
  //   일꾼 N 기를 세워 두고 **아무것도 사지 않은 채** 수입만 잰다.
  //   ⚠ 값(campHireCost)은 빼고 잰다 — 여기서 묻는 것은 「붙을 자리가 있나」다.
  const tick=(dt)=>{
    // ⚠ **일꾼이 캐는 일은 `renderBuildTab` 이 한다**(건설 탭의 틱). 이걸 빼면 수입이 0 이다
    //   — 처음에 빼고 재서 여섯 판이 전부 0 이 나왔다(campFrame 이 화면에서 대신 부르는 것).
    if(typeof renderBuildTab==='function'){ try{ renderBuildTab(dt); }catch(e){} }
    campApplyGatherMul();
    if(typeof campGasTick==='function') campGasTick(dt);
    campSyncHire(); campSyncSupply(); campSyncUnitCost(); campCombatStep(dt); };
  const setWorkers=(n)=>{
    const T=G.tech, wk=TECH_WORKER[T.race];
    T.ents=(T.ents||[]).filter(e=>e.type!=='worker');
    const y=0.86, w=1;
    for(let i=0;i<n;i++) T.ents.push({ eid:T.eseq++, type:'worker', x:0.30+(i%20)*0.02, y:y-Math.floor(i/20)*0.02 });
    T.sup=0; T.supCap=9999; };
  const income=(n)=>{
    setWorkers(n);
    C.earn=0; G.tech.credit=0;
    for(let i=0;i<200;i++){ tick(0.05); if((i%20)===0) campAutoGather(); }   // 예열 10초
    C.earn=0;
    const N=Math.round(SEC/0.05);
    for(let i=0;i<N;i++){ tick(0.05); if((i%20)===0) campAutoGather(); }
    // ⛏ 실제로 광맥에 붙은 일꾼 수 — 「남아서 노는」 일꾼을 셈한다
    const busy=(G.tech.ents||[]).filter(e=>e.type==='worker'&&e._gEid!=null).length;
    return { n:n, busy:busy, perMin:Math.round((C.earn||0)/SEC*60) }; };
  R.wk=[10,20,30,40,60,80].map(income);
  R.wkCost={ c40:campHireCost(39), c80:campHireCost(79),
             sum40:(()=>{let s=0;for(let i=0;i<40;i++)s+=campHireCost(i);return s;})(),
             sum80:(()=>{let s=0;for(let i=0;i<80;i++)s+=campHireCost(i);return s;})() };
  R.mine={ cols:CAMP_MINE_COLS, cap:CAMP_MINE_CAP, ceil:CAMP_MINE_COLS*CAMP_MINE_CAP,
           patches:(G.tech.minerals||[]).length };

  // ── ② 🔓 유닛 반복 구매 배수 ───────────────────────────────────────────
  //   같은 예산으로 한 종류를 몇 기 사나. ⚠ 지수의 밑이라 예산이 클수록 차이가 벌어진다.
  const nBuy=(r, base, budget)=>{ let n=0, left=budget;
    for(;;){ const c=Math.max(1,Math.ceil(base*Math.pow(r,n))); if(c>left) break; left-=c; n++; if(n>1e4) break; }
    return n; };
  const L=CAMP_RBT_LINES.find(x=>x.k==='capUnitR');
  const base=(typeof campUnitBase==='function')?campUnitBase('machinegun',50):50;
  R.unitR={ r0:L.lad[0], r1:L.lad[1], base:base,
    rows:[1e5,1e6,1e7,1e8,1e9].map(b=>({ b:b, a:nBuy(L.lad[0],base,b), c:nBuy(L.lad[1],base,b) })) };

  // ── ③ 🟡 기본 배수 ─────────────────────────────────────────────────────
  //   ⚠ **합산항**이라 환생을 거듭할수록 옅어진다 — 그것이 여기서 확인하려는 것이다.
  { const add=CAMP_RBT_LINES.find(x=>x.k==='rebMul').lad[1];
    const bk={rebMul:C.rebMul, rebTree:C.rebTree};
    R.reb=[0,1,2,5,10].map(n=>{ C.rebMul=n; C.rebTree={};      const a=campRebMul();
                                             C.rebTree={rebMul:1}; const b=campRebMul();
                                return { reb:n, off:a, on:b, pct:Math.round(1000*(b/a-1))/10 }; });
    R.rebAdd=add; C.rebMul=bk.rebMul; C.rebTree=bk.rebTree||{}; }

  // ── ④ 🔓 보급소 상한 ───────────────────────────────────────────────────
  { const Ls=CAMP_RBT_LINES.find(x=>x.k==='capSup');
    const cost=(n)=>{let s=0;for(let i=0;i<n;i++)s+=campSupplyCost(i);return s;};
    R.sup={ a:Ls.lad[0], c:Ls.lad[1], popA:10+Ls.lad[0]*8, popC:10+Ls.lad[1]*8,
            costA:cost(Ls.lad[0]), costC:cost(Ls.lad[1]) }; }
  // ── ⑤ 🎫 던전 시작 지점 ────────────────────────────────────────────────
  //   camp-clear.mjs 와 **같은 경로**로 민다(드래그 명령 · 다르면 다른 것을 재게 된다).
  //   ⛔ 「전장이 닫혔다 = 졌다」가 아니다 — 판정은 `C.dgDone[D]` 하나.
  { const D=1, N=20, MUL=5, UNIT='machinegun', LIMIT=400;
    const run=(sk)=>{
      C.dgDone={}; C.foeDead={}; C.rebTree = sk ? {dgStart:1} : {};
      campEnterDungeon(0); campEnterDungeon(D); CAMPB=null; campCombatStep(0.05);
      if(!CAMPB) return {err:'전장 없음'};
      const gate0=campBroken();
      campWithStk(()=>{ STK.me.units.length=0; STK.ai.units.length=0; });
      for(let i=0;i<N;i++) campDeploy(UNIT, 0.26+(i%6)*0.048, 0.44+Math.floor(i/6)*0.032);
      CAMPB._started=false; CAMPB._gapT=0; campCombatStep(0.05);
      for(const u of CAMPB.me.units){ u.dmg*=MUL; u.maxHp*=MUL; u.hp=u.maxHp; }
      const push=()=>{ if(!CAMPB) return false; _campSel.length=0;
        for(const u of CAMPB.me.units) if(!u.dead) _campSel.push(u.uid);
        if(!_campSel.length) return false;
        const fr=campFoeFront(); if(!fr) return false;
        const g=campW2G(fr.x, fr.y+240, CAMPB.world); campMoveSel(g.gx, g.gy, true); return true; };
      let t=0,lastB=campBroken(),idle=0,pushes=0,done=false;
      push(); pushes++;
      while(t<LIMIT){ campCombatStep(1/30); t+=1/30;
        if(!CAMPB){ done=!!(C.dgDone&&C.dgDone[D]); break; }
        if(campBroken()>=CAMP_DG_STEPS){ done=true; break; }
        if(campBroken()!==lastB){ lastB=campBroken(); idle=0; } else idle+=1/30;
        if(idle>=12){ idle=0; if(push()) pushes++; } }
      if(CAMPB) campWithStk(()=>{ STK.me.units.length=0; STK.ai.units.length=0; });
      campBattleClose();
      return { gate0:gate0, done:done, t:Math.round(t), pushes:pushes }; };
    R.dgStart={ off:run(false), on:run(true),
                sk:CAMP_RBT_LINES.find(x=>x.k==='dgStart').lad[1] };
    C.rebTree={}; C.dgDone={}; C.foeDead={}; campEnterDungeon(0); }

  // ── ⑥ 🤖 자동화 — **상한까지 얼마나 걸리나 · 돈을 얼마나 쓰나** ──────────
  //   ⚠ 주기 2초에 하나씩이라 「편해지는 것」의 값은 **시간**으로 나온다.
  { const T=G.tech;
    T.ents=(T.ents||[]).filter(e=>e.type!=='worker');
    T.credit=1e18; T.energy=1e18; T.supCap=9999; T.sup=0; T.inf=false;
    // 🏗 **연구 건물을 세워 둔다** — 처음엔 본부 하나뿐이라 `campArmReady` 가 전부 거짓이었고,
    //   그래서 「자동 연구가 1시간에 아무것도 안 했다」는 잘못된 결과가 나왔다(실측으로 겪었다).
    //   ⚠ 자동화는 **내가 지어 둔 건물 안에서만** 돈다 — 건물을 대신 지어 주지 않는다.
    { const t=TECH_TREE[T.race], hq=(T.ents||[]).find(e=>e.type==='bldg');
      let i=0;
      for(const b of (t.buildings||[])){
        if((T.built[b.k]|0)>0) continue;
        T.built[b.k]=1;
        T.ents.push({ eid:T.eseq++, type:'bldg', bk:b.k, bt:0, w:2, h:2,
          x:0.12+(i%7)*0.12, y:(hq?hq.y:0.86)-0.10-Math.floor(i/7)*0.06 });
        i++; } }
    C.rebTree={autoWk:1, autoRes:1};
    const c0=T.credit, g0=T.energy;
    // ⏱ 10분만 잰다 — ⚠ 1시간을 돌렸더니 건물이 다 선 판에서 900초 제한을 넘겼다(실측).
    //   ⭐ 자동화는 주기 2초에 하나씩이라 10분이면 300번이고, 상한까지 가는지 보기엔 넉넉하다.
    let t=0, hit=null; _campAutoT=0;
    const cap=campCap('worker'), DUR=600;
    while(t<DUR){ campAutoTick(1); t+=1;
      // 생산 큐가 흘러야 일꾼이 실제로 나온다 — 큐만 돌리면 되므로 전투 틱은 잘게 안 쪼갠다
      if(typeof renderBuildTab==='function'){ try{ renderBuildTab(1); }catch(e){} }
      campSyncHire(); campSyncSupply();
      if(hit==null && campWorkerNPlanned()>=cap) hit=t; }
    let resLv=0; { const RS=(T.research)||{}; for(const k in RS) resLv+=(RS[k]===true?1:(RS[k]|0)); }
    R.auto={ cap:cap, hitS:hit, wk:campWorkerNPlanned(), resLv:resLv,
             spentM:Math.round(c0-T.credit), spentG:Math.round(g0-T.energy), per:CAMP_AUTO_S, dur:600 };
    C.rebTree={}; }

  // ── ⑦ 🎫 시작 자원이 사는 것 ───────────────────────────────────────────
  { const res=CAMP_RBT_LINES.find(x=>x.k==='startRes').lad[1];
    let n=0,left=res; const b=(typeof campUnitBase==='function')?campUnitBase('machinegun',50):2000;
    for(;;){ const c=Math.max(1,Math.ceil(b*Math.pow(campCap('unitR'),n))); if(c>left) break; left-=c; n++; }
    R.startRes={ res:res, units:n, base:b, wk10Min:Math.round(res/(R.wk[0].perMin||1)) }; }
  return R;
}, SEC);

const f=n=>n.toLocaleString('en-US');
console.log('\n════ 🌳🔁 환생 트리 값 실측 (측정창 '+SEC+'초/판) ════\n');
console.log('① 🔓 일꾼 상한 — 광맥 '+out.mine.patches+'덩이 × '+out.mine.cap+'기 = 붙을 자리 '+out.mine.ceil+'개');
for(const r of out.wk)
  console.log('   일꾼 '+String(r.n).padStart(2)+'기 → 광맥에 붙은 것 '+String(r.busy).padStart(2)
    +'기 · 분당 '+f(r.perMin).padStart(9));
console.log('   값: 40기까지 누적 '+f(out.wkCost.sum40)+' · 80기까지 누적 '+f(out.wkCost.sum80)
  +' (80번째 한 기 '+f(out.wkCost.c80)+')');
console.log('\n② 🔓 유닛 반복 구매 배수 '+out.unitR.r0+' → '+out.unitR.r1
  +' (기본가 '+f(out.unitR.base)+')');
for(const r of out.unitR.rows)
  console.log('   예산 '+f(r.b).padStart(13)+' → '+String(r.a).padStart(3)+'기 → '+String(r.c).padStart(3)
    +'기  (+'+(r.a?Math.round(1000*(r.c/r.a-1))/10:0)+'%)');
console.log('\n③ 🟡 기본 배수 +'+out.rebAdd+' — 합산이라 환생을 거듭할수록 옅어진다');
for(const r of out.reb)
  console.log('   환생 '+String(r.reb).padStart(2)+'회: ×'+r.off+' → ×'+r.on+'  (+'+r.pct+'%)');
console.log('\n④ 🔓 보급소 상한 '+out.sup.a+'채 → '+out.sup.c+'채 — 인구 '+out.sup.popA+' → '+out.sup.popC);
console.log('   그만큼 짓는 값: '+f(out.sup.costA)+' → '+f(out.sup.costC)
  +' (늘어난 몫 '+f(out.sup.costC-out.sup.costA)+')');
console.log('\n⑤ 🎫 던전 시작 지점 — 관문 '+out.dgStart.sk+'채를 부순 채로 시작 (던전 1 · 화력병 20기 ×5)');
{ const a=out.dgStart.off, b=out.dgStart.on;
  const ln=(nm,r)=>'   '+nm+' 관문 '+r.gate0+'채에서 출발 → '
    +(r.done?('🏁 '+r.t+'초 · 드래그 '+r.pushes+'회'):('💀 못 깸 · '+r.t+'초'));
  console.log(ln('안 삼', a)); console.log(ln('  삼', b));
  if(a.done&&b.done) console.log('   → '+(a.t-b.t)+'초 단축 ('+Math.round(1000*(1-b.t/a.t))/10+'%)'); }
console.log('\n⑥ 🤖 자동화 — 주기 '+out.auto.per+'초에 하나씩 (돈은 무한으로 주고 잰다)');
console.log('   일꾼 상한 '+out.auto.cap+'기까지 '
  +(out.auto.hitS!=null?(out.auto.hitS+'초('+Math.round(out.auto.hitS/60*10)/10+'분)'):(Math.round(out.auto.dur/60)+'분 안에 못 참'))
  +' · 끝 '+out.auto.wk+'기');
console.log('   '+Math.round(out.auto.dur/60)+'분에 쓴 돈: 미네랄 '+f(out.auto.spentM)+' · 가스 '+f(out.auto.spentG)
  +' · 연구 레벨 합 '+out.auto.resLv);
console.log('\n⑦ 🎫 시작 자원 '+f(out.startRes.res)+' — 화력병(기본 '+f(out.startRes.base)+') '
  +out.startRes.units+'기 값 · 일꾼 10기 수입으로는 '+out.startRes.wk10Min+'분치\n');
if(errs.length) console.log('\nERR', errs.slice(0,3));
await browser.close(); server.close();
