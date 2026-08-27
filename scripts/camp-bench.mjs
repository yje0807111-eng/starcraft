/* ============================================================================
 * camp-bench.mjs — 캠프 던전 실측 (BALANCE.md §4 방식 · 2026-08-25)
 *
 * ⚠ 모델로 추정하지 말 것. 실제 campCombatStep / 건설 틱을 돌려서 잰다.
 *
 *   D  「재화 누적 ∝ 난이도」 가정이 맞는가 (HUNT_R1.md §5 D)
 *   E  환생 관문 100만이 후반에 몇 초 만에 채워지는가 (§5 E)
 *
 * 사용: CHROME_PATH=... node scripts/camp-bench.mjs [시뮬분] [시작던전]
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const MINS=+(process.argv[2]||10), DG0=+(process.argv[3]||1);
// 🧭 구매 정책 — HUNT_R1 §6-7-0 의 세 갈래를 그대로 옵션으로 둔다(대조용)
//   A 살 수 있는 것 중 ROI 1위   B 인구가 막히면 보급소만 모은다   C ROI 1위가 비싸면 모은다
const POL=(process.argv[4]||'A').toUpperCase();
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 let f=path.join(ROOT,p==='/'?'sc-ums-web.html':p); if(!f.startsWith(ROOT)){s.writeHead(403);return s.end();}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME=process.env.CHROME_PATH;
if(!CHROME||!fs.existsSync(CHROME)){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:1});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
const probes=[];
pg.on('console', m=>{ const t=m.text(); if(t.indexOf('__PROBE__')===0) probes.push(t.slice(10)); });
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"',{timeout:30000});

await pg.evaluate((dg0,pol)=>{
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','벤치');
  const C=campState(); C.race='terran'; saveMeta(); openHome();
  window.__CB={ dg0, pol };
}, DG0, POL);
await pg.waitForFunction(
  "typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech "
  // ⚠ 본부만 확인한다 — **시작 일꾼은 0기**다(HUNT_R1 §1). ents>=2 로 기다리면 영영 안 온다.
  +"&& (G.tech.minerals||[]).length>0 && (G.tech.ents||[]).some(e=>e.type==='bldg')",
  {timeout:30000});
await new Promise(r=>setTimeout(r,800));

await pg.evaluate(()=>{
  campStopFrame(); campStopTimer();          // 시계를 끄고 직접 민다
  const C=campState(); C.dg=__CB.dg0; C.cleared=0; C.earn=0; C.earnGas=0;
  campBattleClose();
  __CB.log=[]; __CB.t=0; __CB.lastRound=campRoundN(); __CB.roundT=0; __CB.stuck=0;
  // ⚠ 상한은 **설계값**을 쓴다(HUNT_R1 §1). 12기로 묶어 두면 일꾼 축을 잰 것이 아니게 된다 —
  //   광맥 cap 을 연 뒤로 일꾼 수가 수입에 선형이라(실측 40기 137/초) 여기가 결과를 좌우한다.
  __CB.want={}; __CB.wkCap=(typeof CAMP_WORKER_MAX!=='undefined')?CAMP_WORKER_MAX:40;
  // 🏭 **생산 건물을 전부 열어 둔다.** 예전엔 앞 4채만 지어서 병영 계열 3종밖에 안 나왔고,
  //   그러면 반복 구매(×1.15)가 마린에 쏠린다 — 12종이 열려야 조합이 의미를 갖는다.
  //   ⚠ 값·선행은 __CB.build 가 본다(못 지으면 그냥 넘어간다).
  { const T=TECH_TREE[G.tech.race]; if(T) for(const b of T.buildings.slice(1)) __CB.want[b.k]=1;
  }
  __CB.army=0; __CB.enter=8;   // 유닛 이만큼 모이면 던전으로 내려간다
  __CB.wealth=[]; __CB.lastW=0; __CB.lastSample=0; __CB.gateT=0;
  // 🔮 스킬 자동 시전 계측 — 어떤 스킬이 **실제로 효과를 냈는지**만 센다(시도 X).
  //   ⚠ 효과 함수가 false 를 돌리면 시전 자체가 취소되므로, 여기서 세는 것이 곧 「진짜 나간 횟수」다.
  __CB.sk={}; __CB.healHp=0; __CB.medHp=0;
  // 💉 의무병 치유는 **스킬 경로가 아니다**(strikeHealStep). 따로 재지 않으면 「치유가 도는가」에 답할 수 없다.
  if(typeof window.strikeHealStep==='function'){ const o=window.strikeHealStep;
    window.strikeHealStep=function(u, me, dt){ const b4=(me&&me.units||[]).reduce((a,x)=>a+(x.dead?0:(x.hp||0)),0);
      const r=o.apply(this, arguments);
      const af=(me&&me.units||[]).reduce((a,x)=>a+(x.dead?0:(x.hp||0)),0);
      if(af>b4) __CB.medHp+=(af-b4); return r; }; }
  for(const fn of ['_stkApplyAlly','_stkApplyFoe','_stkApplySpot']){
    const o=window[fn]; if(typeof o!=='function') continue;
    window[fn]=function(u,t,sk,key){ const ally=(fn==='_stkApplyAlly'), hp0=(ally&&t)?(t.hp||0):0;
      const ok=o.apply(this, arguments);
      if(ok){ const k=(fn==='_stkApplySpot')?arguments[3]:((sk&&sk.key)||key);
        __CB.sk[k]=(__CB.sk[k]||0)+1;
        if(ally&&t) __CB.healHp+=Math.max(0,(t.hp||0)-hp0); }
      return ok; }; }
  // ⚠ **탭은 필수다.** 시작 일꾼이 0기라(HUNT_R1 §1) 탭으로 첫 일꾼(140)을 사지 않으면
  //   건설할 일꾼이 없어 건물도 유닛도 영영 안 생긴다 — 실측: 탭 0이면 8분 내내 D0·일꾼 0·유닛 0.
  __CB.rate=0; __CB.taps=3;   // 초당 탭 수(설계 §1-2 가정)
  // ⚔ 아군 총 DPS — 적 총량을 역산하려면 이 값이 있어야 한다(HUNT_R1 §6-2 재설계 입력).
  //   DPS = 공격력 ÷ 공격주기(cdMax). 누워 있는(부활 대기) 유닛은 안 센다.
  __CB.dps=function(){ if(typeof CAMPB==='undefined' || !CAMPB || !CAMPB.me) return 0;
    let d=0; for(const u of CAMPB.me.units){ if(u.dead) continue;
      const cd=u.cdMax||u.cd||0; if(cd>0) d+=(u.dmg||0)/cd; }
    return Math.round(d*10)/10; };
  __CB.pol=__CB.pol||'A';
  __CB.tap=function(){ const m=(G.tech&&G.tech.minerals||[])[0]; if(!m) return;
    for(let i=0;i<__CB.taps;i++) G.tech.credit=(G.tech.credit||0)+campTapGain(); };
  __CB.RESERVE=600;   // 건물·유닛 몫으로 남겨 두는 미네랄
  // ⭐ **투자 대비 수익(ROI)으로 산다.** 「가장 싼 것」은 성격이 같은 업그레이드가 줄지어 있던
  //   옛 사냥터용 규약이라 캠프에서는 왜곡된다 — 실측(camp-econ-bench): 값만 보면 일꾼(3만)이
  //   탭업(2.2만)에 계속 밀려 1시간 내내 10기에서 굳었다. BALANCE.md §3-3.
  //   여기서는 탭·효율 둘만 고른다(일꾼·건물은 __CB.produce/build 가 맡는다).
  // ⭐ **구매 정책 셋을 나란히 돌린다**(HUNT_R1 §6-7-0). 후보는 넷 — 효율 / 탭 / 일꾼 / 보급소.
  //   Δ 는 전부 「초당 수입이 얼마나 느는가」로 통일한다. 값이 아니라 **Δ÷비용** 으로 고른다.
  //   ⛔ 「가장 싼 것」(BALANCE §4 규약)은 옛 사냥터용이라 여기서는 일꾼이 영영 안 팔린다.
  __CB.buy=function(){
    const S=campState(), T=G.tech;
    for(let g=0; g<20; g++){
      const cash=Math.floor((T.credit||0)) - __CB.RESERVE;
      if(cash<=0) return;
      const wn=T.ents.filter(e=>e.type==='worker').length;
      const free=(T.supCap||0)-(T.sup||0), sn=T.built.supply|0;
      const smax=(typeof CAMP_SUPPLY_MAX!=='undefined')?CAMP_SUPPLY_MAX:24;
      const wmax=(typeof CAMP_WORKER_MAX!=='undefined')?CAMP_WORKER_MAX:40;
      const R=__CB.rate||0, perWk=(wn>0? R/wn : 3.5);
      const opts=[];
      { const L=S.upg.gather|0, cur=campGatherMul();
        S.upg.gather=L+1; const nxt=campGatherMul(); S.upg.gather=L;
        opts.push({k:'gather', c:campUpgCost('gather'), d:R*(nxt/cur-1),
          go:()=>{ S.upg.gather=L+1; T.credit-=campUpgCost('gather'); }}); }
      { const L=S.upg.tap|0, cur=campTapGain();
        S.upg.tap=L+1; const nxt=campTapGain(); S.upg.tap=L;
        opts.push({k:'tap', c:campUpgCost('tap'), d:(nxt-cur)*__CB.taps,
          go:()=>{ S.upg.tap=L+1; T.credit-=campUpgCost('tap'); }}); }
      if(wn<wmax && free>=1)
        opts.push({k:'worker', c:campHireCost(wn), d:perWk,
          go:()=>{ try{ T.sel=(T.ents.find(e=>e.type==='bldg'&&e.bk===TECH_TREE[T.race].buildings[0].k)||{}).eid;
            techDoProduce(TECH_WORKER[T.race], TECH_TREE[T.race].buildings[0].k); }catch(e){} }});
      if(sn<smax && wn<wmax){
        const capNow=Math.min(200,T.supCap||0), capNext=Math.min(200,(T.supCap||0)+8);
        const gain=Math.max(0, Math.min(capNext-capNow, wmax-wn-Math.max(0,free)));
        opts.push({k:'supply', c:campSupplyCost(sn), d:gain*perWk,
          go:()=>{ __CB.want.supply=sn+1; __CB.build(); }});   // 배치는 build 가 한다
      }
      const live=opts.filter(o=>o.d>0);
      if(!live.length) return;
      const ranked=live.sort((a,b)=>(b.d/b.c)-(a.d/a.c));
      let pick=null;
      if(__CB.pol==='C'){                       // C — 1위가 비싸면 그때까지 모은다
        if(ranked[0].c>cash) return;
        pick=ranked[0];
      } else if(__CB.pol==='B'){                // B — 인구가 막히면 보급소만 모은다
        if(free<1 && sn<smax){
          const sup=live.find(o=>o.k==='supply');
          if(!sup || sup.c>cash) return;
          pick=sup;
        } else pick=ranked.find(o=>o.c<=cash);
      } else {                                  // A — 살 수 있는 것 중 1위
        pick=ranked.find(o=>o.c<=cash);
      }
      if(!pick) return;
      pick.go();
    } };
  // 자동 건설 — 트리 순서대로, 선행이 맞고 돈이 되면 짓는다
  // ⛽ 정제소 레벨 — 가스가 없으면 유닛 12종 중 8종을 못 산다. 경제 몫으로 산다.
  __CB.refine=function(){ if(!G.tech || typeof campUpgCost!=='function') return;
    const S=campState(); if(!S || !campHasRefinery()) return;
    for(let i=0;i<6;i++){ const c=campUpgCost('refinery');
      if((G.tech.credit||0) < c*1.5) return;                       // 다른 축도 사야 하니 여유를 남긴다
      if(campRefLv() >= 40) return;
      G.tech.credit-=c; S.upg.refinery=(S.upg.refinery|0)+1; } };
  // 🔬 연구 — **가스는 여기에만 쓴다**(2026-08-27). 건물마다 한 번에 하나씩이라
  //   가스가 남아돌아도 **건물 수와 연구 시간**이 처리량을 정한다 — 그것도 재는 값이다.
  //   ⚠ 살 수 있는 것 중 **가장 싼 것**을 산다(§4 규약). 계열 업그레이드는 상한이 없어
  //     늘 후보에 남고, 단발 연구는 한 번 사면 빠진다.
  __CB.research=function(){ const T=G.tech; if(!T) return;
    const t=TECH_TREE[T.race]; if(!t) return;
    for(const b of (t.buildings||[])){
      if(!b.research || !b.research.length) continue;
      if(!(T.built[b.k]>0)) continue;
      const be=T.ents.find(e=>e.type==='bldg'&&e.bk===b.k&&(e.bt||0)<=0); if(!be||be._rj) continue;
      let best=null;
      for(const r of b.research){
        const key=T.race+'_'+r.k, lv=T.research[key]|0;
        if(!r.tier && lv) continue;                        // 단발은 한 번뿐
        if(typeof _techReqMet==='function' && !_techReqMet(r.req)) continue;
        const c=(typeof campResearchCost==='function' && campResearchCost(r,lv))||[r.m||0,r.g||0];
        if((T.credit||0)<c[0] || (T.energy||0)<c[1]) continue;
        if(!best || c[1]<best.c[1]) best={r:r,c:c}; }
      if(best){ T.sel=be.eid; try{ techDoResearch(b.k,best.r.k); }catch(e){} } } };
  __CB.build=function(){ if(!G.tech) return;
    const race=G.tech.race, T=TECH_TREE[race]; if(!T) return;
    // 🏠 인구가 막혔으면 보급소를 한 채 더 — 그게 일꾼·유닛 축을 여는 유일한 길이다.
    //   ⛔ want.supply 를 24 로 못 박지 말 것: build 가 보급소만 계속 짓느라 병영까지 못 간다.
    // ⚠ 보급소도 __CB.buy 가 정책에 따라 결정한다(want.supply 를 올려 준다).
    for(const b of T.buildings){
      if(b.k===T.buildings[0].k) continue;                 // 본부는 이미 있다
      if((G.tech.built[b.k]|0) >= (__CB.want[b.k]|0)) continue;
      if(b.addonTo && !(G.tech.built[b.addonTo]>0)) continue;
      if(typeof _techReqMet==='function' && !_techReqMet(b.req)) continue;
      if((G.tech.credit||0) < (b.m||0) || (G.tech.energy||0) < (b.g||0)) continue;
      const wk=G.tech.ents.find(e=>e.type==='worker' && e.build==null); if(!wk) return;
      G.tech.arm=b.k; G.tech.selU=[wk.eid];
      const c=0.30+Math.random()*0.40, r=0.20+Math.random()*0.22;
      try{ techPlace(c, r); }catch(e){}
      G.tech.arm=null; return; } };
  // 자동 생산 — 본부는 일꾼, 그 밖의 완성 건물은 첫 유닛을 계속
  __CB.produce=function(){ if(!G.tech) return;
    const race=G.tech.race, T=TECH_TREE[race]; if(!T) return;
    const main=T.buildings[0];
    // ⚠ 일꾼은 __CB.buy 가 정책에 따라 산다 — 여기서 무조건 사면 정책 비교가 흐려진다.
    // ⭐ **살 수 있는 것 중 가장 싼 것**을 산다. 예전엔 건물마다 produces[0] 고정이었는데,
    //   그러면 값이 올라도 늘 같은 유닛만 사서 **반복 구매 규칙을 잰 것이 아니게 된다.**
    const wk=(typeof TECH_WORKER!=='undefined')?TECH_WORKER[race]:null;
    for(let k=0;k<12;k++){
      let best=null;
      for(const b of T.buildings){ if(b.k===main.k) continue;
        if(!(G.tech.built[b.k]>0)) continue;
        const be=G.tech.ents.find(e=>e.type==='bldg'&&e.bk===b.k&&(e.bt||0)<=0); if(!be) continue;
        for(const p of (b.produces||[])){ if(p.id===wk) continue;      // 일꾼은 __CB.buy 담당
          if(typeof _techReqMet==='function' && !_techReqMet(p.req)) continue;
          if(p.pop && (G.tech.sup+p.pop) > G.tech.supCap) continue;    // 인구가 막히면 못 산다
          if((G.tech.credit||0) < (p.m||0)*1.2) continue;              // 건설비 여유를 남긴다
          if((G.tech.energy||0) < (p.g||0)) continue;
          if(!best || (p.m||0) < best.p.m) best={p:p, b:b, be:be}; } }
      if(!best) break;
      try{ G.tech.sel=best.be.eid; techDoProduce(best.p.id, best.b.k); }catch(e){ break; }
      if(typeof campSyncUnitCost==='function') campSyncUnitCost();     // 산 즉시 다음 마리 값이 오른다
    } };
  // 💰 **수입의 절반은 경제, 절반은 병력** (2026-08-27 · sc-3 요청)
  //   ⛔ ROI 만 보면 한쪽으로 쏠려 실측이 왜곡된다 — 실제로 유닛을 사느라 업그레이드가 멎어
  //     초당 수입이 6,902 → 2,909 로 줄었다. 사람도 그렇게 몰아 쓰지 않는다.
  //   ⚠ 지갑은 하나(G.tech.credit)라 **누적 지출**로 가른다.
  { const oP=__CB.produce, oB=__CB.buy;
    __CB.produce=function(){ if((__CB.spentU||0) >= campWealth()*0.5) return;
      const c0=G.tech.credit||0; oP(); __CB.spentU=(__CB.spentU||0)+Math.max(0,c0-(G.tech.credit||0)); };
    __CB.buy=function(){ if((__CB.spentE||0) >= campWealth()*0.5) return;
      const c0=G.tech.credit||0; oB(); __CB.spentE=(__CB.spentE||0)+Math.max(0,c0-(G.tech.credit||0)); }; }
  __CB.tick=function(sec){
    const dt=0.05, n=Math.round(sec/dt);
    for(let i=0;i<n;i++){
      if(typeof renderBuildTab==='function'){ try{ renderBuildTab(dt); }catch(e){} }
      campApplyGatherMul();
      // ⚠ **가격 동기화는 campFrame 이 한다.** 벤치는 campStopFrame() 으로 그 루프를 껐으므로
      //   여기서 같이 불러 주지 않으면 일꾼·보급소·유닛 값이 **기본가에 얼어붙는다**
      //   (실측 2026-08-27: 반복 구매 ×1.15 가 통째로 안 걸려 마린 101기가 나왔다).
      if(typeof campGasTick==='function') campGasTick(dt);        // ⛽ 정제소 자동 생산(campFrame 이 하던 일)
      if(typeof campSyncHire==='function') campSyncHire();
      if(typeof campSyncSupply==='function') campSyncSupply();
      if(typeof campSyncUnitCost==='function') campSyncUnitCost();
      campCombatStep(dt);
      __CB.t+=dt; __CB.roundT+=dt;
      if((i%20)===0 && typeof campAutoGather==='function'){ try{ campAutoGather(); }catch(e){} }
      if((i%10)===0){
        if(!__CB.techRef) __CB.techRef=G.tech;
        const T=G.tech;
        if(!__CB.dead && (!T || !T.ents || T.ents.length===0)){
          __CB.dead={ t:+__CB.t.toFixed(1),
            hasG:(typeof G!=='undefined'), hasTech:!!T,
            same:(T===__CB.techRef),
            keys:T?Object.keys(T).length:'-', race:T?T.race:'-',
            entsType:T?Object.prototype.toString.call(T.ents):'-',
            ents:T&&T.ents?T.ents.length:'-', mins:T&&T.minerals?T.minerals.length:'-',
            refEnts:(__CB.techRef&&__CB.techRef.ents)?__CB.techRef.ents.length:'-',
            campOn:(typeof campIsOn==='function')?campIsOn():'-' }; } }
      if((i%10)===0 && G.tech && G.tech.ents){ const wk=G.tech.ents.filter(e=>e.type==='worker').length;
        if(__CB.prevWk>2 && wk===0 && !__CB.vanish){ __CB.vanish={ t:+__CB.t.toFixed(1),
          hasTech:!!G.tech, techEnts:(G.tech&&G.tech.ents)?G.tech.ents.length:'없음',
          types:(G.tech&&G.tech.ents)?[...new Set(G.tech.ents.map(e=>e.type))].join(','):'-',
          mins:(G.tech&&G.tech.minerals)?G.tech.minerals.length:'없음',
          campOn:(typeof campIsOn==='function')?campIsOn():'-', dg:campDgN(),
          round:campRoundN(), ore:Math.round(G.tech.minerals.reduce((a,m)=>a+(m.amount||0),0)),
          ents:G.tech.ents.length, race:G.tech.race, credit:Math.round(G.tech.credit||0) }; }
        __CB.prevWk=wk; }
      if((i%20)===0){ __CB.tap(); const w=campWealth();
        if(!__CB.gateT && w>=1e6) __CB.gateT=__CB.t;
        if(__CB.t-(__CB.lastSample||0) >= 15){ __CB.lastSample=__CB.t;
          __CB.wealth.push({ t:+__CB.t.toFixed(0), w:Math.round(w), dg:campDgN(), r:campRoundN(),
            gl:campUpgLv('gather'), tl:campUpgLv('tap'), rate:Math.round((w-(__CB.lastW||0))/15),
            ore:Math.round((G.tech&&G.tech.minerals||[]).reduce((a,m)=>a+(m.amount||0),0)),
            wk:(G.tech&&G.tech.ents||[]).filter(e=>e.type==='worker').length,
            gas:Math.round((G.tech&&G.tech.energy)||0), rl:(typeof campRefLv==='function'?campRefLv():0),
            res:(function(){ const R=(G.tech&&G.tech.research)||{}; let n=0;
              for(const k in R) n+=(R[k]===true?1:(R[k]|0)); return n; })(),   // 🔬 연구 총레벨(계열+단발)
            me:(typeof campAlive==='function'?campAlive('me'):0),      // 전장에 서 있는 내 병력
            dps:__CB.dps(),                                            // ⚔ 아군 총 DPS
            bld:(typeof campBldAlive==='function'?campBldAlive().length:0),          // 🏢 살아있는 건물
            bldAll:(typeof CAMPB!=='undefined'&&CAMPB&&CAMPB._bld?CAMPB._bld.length:0),
            bldHp:(function(){ if(typeof campBldAlive!=='function') return 0;
              const L=campBldAlive(); if(!L.length) return 0;
              let h=0,m=0; for(const b of L){ h+=b.hp||0; m+=b.max||b.maxHp||0; }
              return m>0?Math.round(h/m*100):0; })(),                                // 남은 체력 %
            dn:(typeof campDown==='function'?campDown():0),            // 누워서 부활 대기 중
            dif:Math.round(typeof campFoeDiff==='function'?campFoeDiff(campDgN(),campCleared()):0),
            un:(G.tech&&G.tech.ents||[]).filter(e=>e.type==='unit').length,
            // ⚔ 병력 구성 — 반복 구매(×1.15)가 실제로 조합을 강제하는지 보는 값이다.
            //   한 종류가 절반을 넘으면 배수가 약한 것이다.
            mix:(function(){ const m={};
              // ⚠ _down 은 유닛이 아니라 **{u,t} 껍데기**다 — 그대로 세면 전부 undefined 가 된다.
              //   그리고 누운 유닛은 dead=true 라, 살아있는 것만 거를 때 통째로 사라진다.
              const add=(L,skipDead)=>{ for(const u of (L||[])){ if(!u||(skipDead&&u.dead)) continue; const k=u.gm||u.id; m[k]=(m[k]||0)+1; } };
              if(typeof CAMPB!=='undefined'&&CAMPB){ add(CAMPB.me&&CAMPB.me.units,true); add((CAMPB._down||[]).map(d=>d&&d.u),false); }
              for(const e of (G.tech&&G.tech.ents||[])) if(e.type==='unit'){ m[e.uid]=(m[e.uid]||0)+1; }
              return m; })() });
          __CB.rate=Math.max(0,(w-(__CB.lastW||0))/15);   // ROI 판단에 쓰는 초당 수입
          __CB.lastW=w; } }
      if((i%40)===0){ __CB.build(); __CB.refine(); __CB.research(); __CB.produce(); __CB.buy();
        // 캠프(0단계)에 있고 병력이 모였으면 던전으로
        const units=G.tech?G.tech.ents.filter(e=>e.type==='unit').length:0;
        __CB.army=units;
        if(campDgN()===0 && units>=__CB.enter) campEnterDungeon(__CB.dg0);
      }
      const r=campRoundN();
      if(r!==__CB.lastRound){
        __CB.log.push({ dg:campDgN(), round:__CB.lastRound, sec:+__CB.roundT.toFixed(1),
          earn:Math.round(campWealth()), diff:campFoeDiff(campDgN(), Math.max(0,r-1)) });
        __CB.lastRound=r; __CB.roundT=0; __CB.stuck=0;
        if(!__CB.gateT && campWealth()>=1e6) __CB.gateT=__CB.t;
      } else if(__CB.roundT>60 && campDgN()>0){
        // 🩺 정체 진단 — 라운드가 60초 넘게 안 넘어가면 전장을 통째로 찍는다(한 번만)
        if(!__CB.jam && CAMPB){
          const cls=(typeof UNIT_COMBAT_CLASS!=='undefined')?UNIT_COMBAT_CLASS:{};
          const mode=(typeof SB_ATK_MODE!=='undefined')?SB_ATK_MODE:{};
          const air=(typeof FXLAB_AIR!=='undefined')?FXLAB_AIR:new Set();
          const desc=u=>({ id:u.id, hp:Math.round(u.hp), max:Math.round(u.maxHp||0),
            x:+(u.x||0).toFixed(3), y:+(u.y||0).toFixed(3), dead:!!u.dead,
            rng:u.rng, dmg:u.dmg, atk:mode[u.id]||'both', air:air.has(u.id)||air.has(u.gm),
            sz:(cls[u.id]||{}).sz, dt:(cls[u.id]||{}).dt });
          __CB.jam={ round:campRoundN(), dg:campDgN(),
            foes:CAMPB.ai.units.filter(u=>!u.dead).map(desc),
            mine:CAMPB.me.units.filter(u=>!u.dead).map(desc),
            down:campDown(), pending:(CAMPB._wq&&CAMPB._wq.length)|0,
            canHit:(typeof campCanHitFoes==='function'?campCanHitFoes():null),
            started:!!CAMPB._started,
            foesPending:(typeof campFoesPending==='function'?campFoesPending():null),
            airHas:(typeof FXLAB_AIR!=='undefined'&&CAMPB.ai.units[0])?FXLAB_AIR.has(CAMPB.ai.units[0].gm||CAMPB.ai.units[0].id):null,
            myMode:(typeof SB_ATK_MODE!=='undefined'&&CAMPB.me.units[0])?(SB_ATK_MODE[CAMPB.me.units[0].id]||'both'):null,
            // 🔎 아군 구성과 「대공 가능」 수 — 못 때리는 것인지, 때릴 수 있는데 안 잡는 것인지 가른다
            mix:(function(){ const c={}; for(const u of CAMPB.me.units){ if(u.dead) continue; c[u.id]=(c[u.id]||0)+1; } return c; })(),
            aa:(function(){ let n=0; for(const u of CAMPB.me.units){ if(u.dead) continue;
              const a=u._atk||((typeof _sbAtkMode==='function')?_sbAtkMode({id:u.id,gmodel:u.gm}):{air:1,gnd:1});
              if(a.air) n++; } return n; })(),
            // 대공 가능한 아군과 적 사이의 최단 거리 — 사거리와 견줘 본다
            aaDist:(function(){ const f=CAMPB.ai.units.find(u=>!u.dead); if(!f) return null;
              let best=null, rng=null;
              for(const u of CAMPB.me.units){ if(u.dead) continue;
                const a=u._atk||((typeof _sbAtkMode==='function')?_sbAtkMode({id:u.id,gmodel:u.gm}):{air:1,gnd:1});
                if(!a.air) continue; const d=Math.hypot(u.x-f.x,u.y-f.y);
                if(best===null||d<best){ best=d; rng=u.rng; } }
              return best===null?null:{d:Math.round(best), rng:Math.round(rng||0)}; })(),
            baseHp:Math.round(CAMPB.me.base.hp), aiBaseHp:Math.round(CAMPB.ai.base.hp) };
        }
        __CB.stuck++; __CB.roundT=0; }   // ⚠ D0(캠프)엔 라운드가 없다 — 거기서 세면 오작동한다
    } };
});

const CH=30; let ran=0;
process.stdout.write(`⏱  캠프 시뮬 ${MINS}분 · 던전 ${DG0} 시작\n`);
while(ran<MINS*60){
  const st=await pg.evaluate(c=>{ __CB.tick(c);
    return { t:__CB.t, dg:campDgN(), round:campRoundN(), earn:Math.round(campWealth()),
      foe:campAlive('ai'), me:campAlive('me'), rounds:__CB.log.length, stuck:__CB.stuck, army:__CB.army,
      cr:Math.round((G.tech&&G.tech.credit)||0) }; }, CH);
  ran=st.t;
  process.stdout.write(`\r   ${(st.t/60).toFixed(1)}분 · D${st.dg}R${st.round} · 번돈 ${st.earn} · 보유 ${st.cr} · 적 ${st.foe} 아군 ${st.me}(대기 ${st.army}) · 깬라운드 ${st.rounds}   `);
  if(st.stuck>3){ process.stdout.write('\n⚠ 라운드가 2분 넘게 안 넘어감 — 중단\n'); break; }
}
const fin=await pg.evaluate(()=>({ price:(function(){ const T=TECH_TREE[G.tech.race], out=[];
    if(typeof campSyncUnitCost==='function') campSyncUnitCost();
    for(const b of T.buildings) for(const q of (b.produces||[])) out.push({id:q.id, m:Math.round(q.m||0),
      own:(typeof campUnitOwned==='function')?campUnitOwned(q.id):-1, base:(G.tech.units[q.id]|0)});
    return out; })(), sk:__CB.sk||{}, medHp:Math.round(__CB.medHp||0), healHp:Math.round(__CB.healHp||0), log:__CB.log, wealth:__CB.wealth, jam:__CB.jam||null, vanish:__CB.vanish||null, dead:__CB.dead||null, t:__CB.t, gateT:__CB.gateT||0, earn:Math.round(campWealth()),
  dg:campDgN(), round:campRoundN(), reb:campCanRebirth() }));
const F=n=>{ if(n<1e4) return String(Math.round(n));
  for(const [u,v] of [['해',1e20],['경',1e16],['조',1e12],['억',1e8],['만',1e4]]) if(n>=v) return (n/v).toFixed(1)+u;
  return String(Math.round(n)); };
console.log('\n\n■ 라운드별 (전 구간에서 고르게 뽑음)');
console.log('던전-라운드 | 걸린 초 | 그때까지 번 돈 | 적 난이도  | 번돈÷난이도');
{ const L=fin.log, step=Math.max(1, Math.floor(L.length/22));
  for(let i=0;i<L.length;i+=step){ const r=L[i];
    console.log(`D${r.dg}R${String(r.round).padEnd(3)}| ${String(r.sec).padEnd(8)}| ${F(r.earn).padEnd(15)}| ${F(r.diff).padEnd(11)}| ${F(r.earn/r.diff)}`); }
  if(L.length){ const r=L[L.length-1];
    console.log(`D${r.dg}R${String(r.round).padEnd(3)}| ${String(r.sec).padEnd(8)}| ${F(r.earn).padEnd(15)}| ${F(r.diff).padEnd(11)}| ${F(r.earn/r.diff)}  ← 끝`); } }
// D 가정 검사 — 번돈÷난이도가 일정한가
{ const L=fin.log.filter(r=>r.earn>0 && r.diff>0);
  if(L.length>4){ const q=L.map(r=>r.earn/r.diff).sort((a,b)=>a-b);
    const lo=q[Math.floor(q.length*0.1)], hi=q[Math.floor(q.length*0.9)];
    console.log(`\n□ D 가정 「번 돈 ∝ 난이도」 — 비율 10~90퍼센타일 ${F(lo)} ~ ${F(hi)} (${(hi/lo).toFixed(1)}배 폭)`); } }
// E 검사 — 관문 100만을 언제 넘겼나
console.log(fin.gateT ? `\n□ E 관문 100만 도달: 시작 후 **${(fin.gateT/60).toFixed(1)}분** (설계 추정 10시간)`
                     : `\n□ E 관문 100만: ${(fin.t/60).toFixed(1)}분 안에 못 넘음(번 돈 ${F(fin.earn)})`);
console.log('\n■ 15초마다 — 번 돈과 수급 속도');
console.log('초    | 던전R  | 번돈      | 초당    | 효율 | 탭  | 일꾼 | 가스/정제소 | 연구Lv | 병력(선+누움) | 아군DPS | 건물(남음 체력) | 적난이도 | 병력 구성');
{ const W=fin.wealth, step=Math.max(1, Math.floor(W.length/18));
  for(let i=0;i<W.length;i+=step){ const w=W[i];
    console.log(`${String(w.t).padEnd(6)}| D${w.dg}R${String(w.r).padEnd(3)}| ${F(w.w).padEnd(9)}| ${F(w.rate).padEnd(8)}| ${String(w.gl).padEnd(4)}| ${String(w.tl).padEnd(4)}| ${String(w.wk).padEnd(4)}| ${String((w.gas|0)+'/L'+(w.rl|0)).padEnd(9)}| ${String(w.res|0).padEnd(6)}| ${String((w.me|0)+'+'+(w.dn|0)).padEnd(7)}| ${String(w.dps).padEnd(8)}| ${String((w.bld|0)+'/'+(w.bldAll|0)+' '+(w.bldHp|0)+'%').padEnd(11)}| ${String(w.dif).padEnd(8)}| ${Object.entries(w.mix||{}).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k+' '+v).join(', ')}`); } }
if(probes.length){ console.log('\n■ 판을 건드린 호출 (전부 '+probes.length+'건 · 마지막 12건)');
  for(const p of probes.slice(-12)) console.log('  '+p.replace(/https?:\/\/[^ )]+/g,'').slice(0,200)); }
if(fin.jam){ const J=fin.jam;
  console.log('');
  console.log('🩺 정체 진단 — D'+J.dg+'R'+J.round+' (라운드가 60초 넘게 안 넘어감)');
  console.log('  본부 HP '+J.baseHp+' · 적 본부 '+J.aiBaseHp+' · 누운 아군 '+J.down+' · 안 나온 무리 '+J.pending);
  console.log('  🔎 campCanHitFoes='+J.canHit+' · 적[0] 공중='+J.airHas);
  console.log('  🔎 아군 구성 '+JSON.stringify(J.mix)+' · 대공 가능 '+J.aa+'기');
  if(J.aaDist) console.log('  🔎 대공 아군↔적 최단거리 '+J.aaDist.d+' · 그 유닛 사거리 '+J.aaDist.rng
    +(J.aaDist.d>J.aaDist.rng?'  ⛔ 사거리 밖':'  ✔ 사거리 안'));
  console.log('  ■ 살아있는 적 '+J.foes.length+'기');
  for(const f of J.foes.slice(0,12)) console.log('    '+String(f.id).padEnd(14)+' hp '+String(f.hp).padStart(6)+'/'+String(f.max).padEnd(6)+' 위치('+f.x+','+f.y+') 사거리 '+f.rng+' 공격대상 '+f.atk+(f.air?' 공중':'')+' 크기 '+(f.sz||'?')+' 타입 '+(f.dt||'?'));
  console.log('  ■ 살아있는 아군 '+J.mine.length+'기');
  for(const m of J.mine.slice(0,8)) console.log('    '+String(m.id).padEnd(14)+' hp '+String(m.hp).padStart(6)+'/'+String(m.max).padEnd(6)+' 위치('+m.x+','+m.y+') 사거리 '+m.rng+' 공격력 '+m.dmg+' 공격대상 '+m.atk+(m.air?' 공중':''));
}
{ console.log("\n■ 유닛 값 — 반복 구매 x1.15 가 실제로 걸렸는가");
  for(const q of (fin.price||[])) console.log('  '+String(q.id).padEnd(14)+' 값 '+String(q.m).padStart(10)+' · 보유 '+q.own+'(기지 '+q.base+')'); }
{ const E=Object.entries(fin.sk||{}).sort((a,b)=>b[1]-a[1]);
  console.log("\n■ 🔮 실제로 나간 스킬 (효과가 적용된 횟수)");
  console.log(E.length ? '  '+E.map(([k,v])=>k+' '+v+'회').join(' · ') : '  ⛔ 한 번도 안 나감');
  console.log('  ✚ 스킬로 회복시킨 체력 '+(fin.healHp||0)+' · 💉 의무병(전용 경로)이 회복시킨 체력 '+(fin.medHp||0)); }
if(fin.dead) console.log('\n⛔ 판이 빈 순간: '+JSON.stringify(fin.dead));
if(fin.vanish) console.log('\n⛔ 일꾼이 통째로 사라진 순간: '+JSON.stringify(fin.vanish));

console.log(`\n최종 ${(fin.t/60).toFixed(1)}분 · D${fin.dg}R${fin.round} · 번 돈 ${fin.earn} · 환생 가능 ${fin.reb}`);
console.log(errs.length ? ('\n⚠ 페이지 예외 '+errs.length+'건:\n  '+[...new Set(errs)].slice(0,6).join('\n  ')) : '\n✅ 페이지 예외 없음');
await b.close(); server.close();
