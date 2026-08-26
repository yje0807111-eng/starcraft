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

await pg.evaluate(dg0=>{
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','벤치');
  const C=campState(); C.race='terran'; saveMeta(); openHome();
  window.__CB={ dg0 };
}, DG0);
await pg.waitForFunction(
  "typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech "
  +"&& (G.tech.minerals||[]).length>0 && (G.tech.ents||[]).length>=2",
  {timeout:30000});
await new Promise(r=>setTimeout(r,800));

await pg.evaluate(()=>{
  campStopFrame(); campStopTimer();          // 시계를 끄고 직접 민다
  const C=campState(); C.dg=__CB.dg0; C.cleared=0; C.earn=0; C.earnGas=0;
  campBattleClose();
  __CB.log=[]; __CB.t=0; __CB.lastRound=campRoundN(); __CB.roundT=0; __CB.stuck=0;
  __CB.want={}; __CB.wkCap=12;
  { const T=TECH_TREE[G.tech.race]; if(T) for(const b of T.buildings.slice(1,5)) __CB.want[b.k]=1; }
  __CB.army=0; __CB.enter=8;   // 유닛 이만큼 모이면 던전으로 내려간다
  __CB.wealth=[]; __CB.lastW=0; __CB.lastSample=0; __CB.gateT=0;
  __CB.RESERVE=600;   // 건물·유닛 몫으로 남겨 두는 미네랄
  __CB.buy=function(){ for(let g=0;g<50;g++){
    const have=Math.floor((G.tech&&G.tech.credit)||0) - __CB.RESERVE;
    if(have<=0) return;
    let best=null,bc=Infinity;
    for(const k of ['tap','gather']){ const c=campUpgCost(k); if(c<=have&&c<bc){bc=c;best=k;} }
    if(!best) return;
    const C=campState(); C.upg[best]=(C.upg[best]|0)+1;
    G.tech.credit=Math.max(0,(G.tech.credit||0)-bc); } };
  // 자동 건설 — 트리 순서대로, 선행이 맞고 돈이 되면 짓는다
  __CB.build=function(){ if(!G.tech) return;
    const race=G.tech.race, T=TECH_TREE[race]; if(!T) return;
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
    const wn=G.tech.ents.filter(e=>e.type==='worker').length;
    if(wn<__CB.wkCap){ const p=(main.produces||[])[0];
      if(p && (G.tech.credit||0)>=(p.m||0)){ try{ G.tech.sel=(G.tech.ents.find(e=>e.type==='bldg'&&e.bk===main.k)||{}).eid;
        techDoProduce(p.id, main.k); }catch(e){} return; } }
    for(const b of T.buildings){ if(b.k===main.k) continue;
      if(!(G.tech.built[b.k]>0)) continue;
      const p=(b.produces||[])[0]; if(!p) continue;
      if((G.tech.credit||0) < (p.m||0)*1.2) continue;      // 건설비 여유를 남긴다
      const be=G.tech.ents.find(e=>e.type==='bldg'&&e.bk===b.k&&(e.bt||0)<=0); if(!be) continue;
      try{ G.tech.sel=be.eid; techDoProduce(p.id, b.k); }catch(e){} } };
  __CB.tick=function(sec){
    const dt=0.05, n=Math.round(sec/dt);
    for(let i=0;i<n;i++){
      if(typeof renderBuildTab==='function'){ try{ renderBuildTab(dt); }catch(e){} }
      campApplyGatherMul();
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
      if((i%20)===0){ const w=campWealth();
        if(!__CB.gateT && w>=1e6) __CB.gateT=__CB.t;
        if(__CB.t-(__CB.lastSample||0) >= 15){ __CB.lastSample=__CB.t;
          __CB.wealth.push({ t:+__CB.t.toFixed(0), w:Math.round(w), dg:campDgN(), r:campRoundN(),
            gl:campUpgLv('gather'), tl:campUpgLv('tap'), rate:Math.round((w-(__CB.lastW||0))/15),
            ore:Math.round((G.tech&&G.tech.minerals||[]).reduce((a,m)=>a+(m.amount||0),0)),
            wk:(G.tech&&G.tech.ents||[]).filter(e=>e.type==='worker').length,
            un:(G.tech&&G.tech.ents||[]).filter(e=>e.type==='unit').length });
          __CB.lastW=w; } }
      if((i%40)===0){ __CB.build(); __CB.produce(); __CB.buy();
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
      } else if(__CB.roundT>120){ __CB.stuck++; __CB.roundT=0; }
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
const fin=await pg.evaluate(()=>({ log:__CB.log, wealth:__CB.wealth, vanish:__CB.vanish||null, dead:__CB.dead||null, t:__CB.t, gateT:__CB.gateT||0, earn:Math.round(campWealth()),
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
console.log('시각(초) | 위치    | 번 돈      | 초당    | 채취Lv | 탭Lv | 광맥잔량 | 일꾼 | 유닛');
{ const W=fin.wealth, step=Math.max(1, Math.floor(W.length/18));
  for(let i=0;i<W.length;i+=step){ const w=W[i];
    console.log(`${String(w.t).padEnd(9)}| D${w.dg}R${String(w.r).padEnd(4)}| ${F(w.w).padEnd(11)}| ${F(w.rate).padEnd(8)}| ${String(w.gl).padEnd(7)}| ${String(w.tl).padEnd(5)}| ${F(w.ore).padEnd(9)}| ${String(w.wk).padEnd(5)}| ${w.un}`); } }
if(probes.length){ console.log('\n■ 판을 건드린 호출 (전부 '+probes.length+'건 · 마지막 12건)');
  for(const p of probes.slice(-12)) console.log('  '+p.replace(/https?:\/\/[^ )]+/g,'').slice(0,200)); }
if(fin.dead) console.log('\n⛔ 판이 빈 순간: '+JSON.stringify(fin.dead));
if(fin.vanish) console.log('\n⛔ 일꾼이 통째로 사라진 순간: '+JSON.stringify(fin.vanish));

console.log(`\n최종 ${(fin.t/60).toFixed(1)}분 · D${fin.dg}R${fin.round} · 번 돈 ${fin.earn} · 환생 가능 ${fin.reb}`);
console.log(errs.length ? ('\n⚠ 페이지 예외 '+errs.length+'건:\n  '+[...new Set(errs)].slice(0,6).join('\n  ')) : '\n✅ 페이지 예외 없음');
await b.close(); server.close();
