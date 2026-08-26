/* ============================================================================
 * camp-econ-bench.mjs — 캠프 경제 실측 (BALANCE.md §4 방식 · 2026-08-24)
 *
 * ⚠ 모델로 추정하지 말 것. 실제 techTick / campTapAt / 생산 큐를 돌려서 잰다.
 *
 * 재는 것: 시간에 따른 총획득 · 초당 수급 · 탭Lv · 효율Lv · 일꾼 수
console.log(`⏱ 첫 벽(보급소 1채) 돌파: ${res.wallT!=null ? (res.wallT/60).toFixed(1)+'분' : '못 뚫음'}`);
 * 대조 대상: HUNT_R1.md §1-2 (10분 10만 · 1시간 45만/자동 54)
 *
 * 정책(⚠ sc-3 시뮬과 맞춰야 비교가 된다)
 *   · 탭   — 처음 TAPMIN 분 동안 초당 TAPS 회
 *   · 구매 — 매 초 **Δ(초당 수입) ÷ 비용** 이 가장 큰 것. 탭업 / 효율업 / 일꾼
 *     ⚠ §4 규약의 「가장 싼 것」은 성격이 같은 업그레이드용이다. 캠프는 셋의 성격이 달라
 *       값만 보면 일꾼이 영영 안 팔린다(실측: 1시간 내내 10기).
 *   · 일꾼은 인구가 남을 때만. 인구가 막히면 보급소를 짓는다
 *
 * 사용: node scripts/camp-econ-bench.mjs [시뮬분] [탭분] [초당탭]
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const MINS=+(process.argv[2]||60), TAPMIN=+(process.argv[3]||20), TAPS=+(process.argv[4]||2);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 let f=path.join(ROOT,p==='/'?'sc-ums-web.html':p); if(!f.startsWith(ROOT)){s.writeHead(403);return s.end();}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH||''].filter(Boolean).find(p=>fs.existsSync(p));
if(!CHROME){ console.error('크롬을 찾을 수 없습니다(CHROME_PATH)'); process.exit(2); }
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',protocolTimeout:900000,
  args:['--mute-audio','--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:1});
pg.on('pageerror',e=>console.error('  ⚠ '+String(e.message).slice(0,120)));
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campState==="function"',{timeout:30000});

const res=await pg.evaluate(async(MINS,TAPMIN,TAPS)=>{
  authGuest(); await new Promise(r=>setTimeout(r,2500));
  const C=campState(); C.race=null; C.ents=[]; C.minerals=[]; C.upg={}; saveMeta();
  openHome(); await new Promise(r=>setTimeout(r,300));
  campRaceSel('terran'); campPickRace(); await new Promise(r=>setTimeout(r,1500));
  const T=G.tech, S=campState();
  const wkId=TECH_WORKER[T.race];
  let earned=0, taps=0;
  const credit=()=>T.credit||0;
  const spend=v=>{ T.credit-=v; };
  // ⭐ **투자 대비 수익(ROI)으로 고른다.**
  //   BALANCE.md §4 규약은 「가장 싼 것」이지만, 그건 성격이 같은 업그레이드가 줄지어 있던
  //   옛 사냥터용이다. 캠프는 성격이 다른 셋(탭 / 효율 / 일꾼)이라 값만 보면 왜곡된다 —
  //   실측: 일꾼 11번째(3만)가 탭업(2.2만)에 계속 밀려 **1시간 내내 10기에서 굳었다.**
  //   Δ(초당 수입) ÷ 비용 이 가장 큰 것을 산다. 못 사면 그때까지 모은다.
  let _R=0;   // 최근 자동 수입/초(일꾼 채취분) — 바깥 루프가 갱신한다
  const buyCheapest=()=>{
    const wn=(T.ents||[]).filter(e=>e.type==='worker').length;
    const free=(T.supCap||0)-(T.sup||0), sn=T.built.supply|0;
    const perWk=(wn>0? _R/wn : 3.5);          // 일꾼 1기가 버는 초당 수입(실측 기준 3.5)
    const opts=[];
    // 효율 — 왕복당 배수가 오르는 만큼 자동 수입이 는다
    { const L=S.upg.gather|0, cur=campGatherMul();
      S.upg.gather=L+1; const nxt=campGatherMul(); S.upg.gather=L;
      opts.push({k:'gather', c:campUpgCost('gather'), d:_R*(nxt/cur-1), go:()=>{ S.upg.gather=L+1; }}); }
    // 일꾼 — 수입이 일꾼 수에 선형이다
    if(wn<CAMP_WORKER_MAX && free>=1)
      opts.push({k:'worker', c:campHireCost(wn), d:perWk, go:()=>{ techDoProduce(wkId,'command'); }});
    // 탭 — 누르는 동안에만 값어치가 있다
    { const L=S.upg.tap|0, cur=campTapGain();
      S.upg.tap=L+1; const nxt=campTapGain(); S.upg.tap=L;
      opts.push({k:'tap', c:campUpgCost('tap'), d:(tapping? (nxt-cur)*TAPS : 0), go:()=>{ S.upg.tap=L+1; }}); }
    // 🏠 **보급소도 같은 규약(Δ÷비용)으로 판단한다.**
    //   Δ = 이 보급소로 새로 놓을 수 있게 되는 일꾼 수 × 일꾼 1기 초당 수입.
    //   인구가 안 막혔으면 Δ=0 이라 저절로 뒤로 밀리고, 막히면 **다른 후보의 Δ 가 0** 이 되므로
    //   자연히 1위가 된다. ⛔ 예전에는 「인구가 막히면 저축」이라는 별도 규칙을 뒀는데,
    //   그러면 저축 조건이 늘 참이라 업그레이드가 통째로 멎었다(실측: 25분에 효율 Lv0).
    if(sn<CAMP_SUPPLY_MAX && wn<CAMP_WORKER_MAX){
      const capNow=Math.min(200,(T.supCap||0)), capNext=Math.min(200,(T.supCap||0)+8);
      const gain=Math.max(0, Math.min(capNext-capNow, CAMP_WORKER_MAX-wn-Math.max(0,free)));
      opts.push({k:'supply', c:campSupplyCost(sn), d:gain*perWk,
        go:()=>{ T.built.supply=sn+1; T.supCap=Math.min(200,(T.supCap||0)+8); }});
    }
    const cash=credit();
    // ⭐ **ROI 1위를 살 때까지 모은다.** 「살 수 있는 것 중 1위」로 하면 비싼 1위를 영영 못 산다 —
    //   실측: 보급소(3만)가 ROI 1위인데도 2.2만짜리 탭업이 매 초 현금을 빼가 1시간 내내
    //   인구 10/10 에 갇혔다. 보급소를 후보에 넣는 것만으로는 부족하고, 저축이 함께 있어야 한다.
    const ranked=opts.filter(o=>o.d>0).sort((a,b)=>(b.d/b.c)-(a.d/a.c));
    const pick=ranked[0]; if(!pick) return null;
    if(pick.c>cash) return null;                  // 1위가 비싸면 그때까지 모은다
    if(pick.k!=='worker') spend(pick.c);   // 일꾼은 techDoProduce 가 알아서 깎는다
    pick.go(); return pick.k;
  };
  let wallT=null;   // ⏱ 첫 벽 — 보급소 1채를 사서 인구 10 을 넘긴 시각
  const snap=[]; const mark=t=>snap.push({ t,
    earned:Math.round(earned), tap:S.upg.tap|0, gat:S.upg.gather|0,
    wk:(T.ents||[]).filter(e=>e.type==='worker').length,
    sup:T.built.supply|0, pop:(T.sup||0)+'/'+(T.supCap||0) });
  let tapping=true;
  const DT=0.05, SEC=MINS*60;
  let last=credit(), acc=0, rateWin=[];
  for(let s=0;s<SEC;s++){
    // 탭 — 처음 TAPMIN 분 동안
    tapping = (s < TAPMIN*60);
    if(tapping) for(let i=0;i<TAPS;i++){ const m=(T.minerals||[])[0];
      if(m){ const g=campTapGain(); T.credit+=g; taps++; } }
    for(let i=0;i<1/DT;i++) techTick(DT);
    if(typeof campAutoGather==='function' && s%2===0) campAutoGather();
    const now=credit(); const d=now-last; if(d>0) earned+=d; last=now;
    for(let g=0; g<12 && buyCheapest(); g++) last=credit();   // 살 수 있는 만큼(한 초에 12회까지 — ROI 계산이 무겁다)
    if(wallT===null && (T.built.supply|0)>=1) wallT=s+1;      // ⏱ 첫 보급소를 산 순간
    rateWin.push(Math.max(0,d)); if(rateWin.length>60) rateWin.shift();
    _R = rateWin.reduce((a,b)=>a+b,0)/rateWin.length;   // ROI 판단에 쓰는 최근 자동 수입/초
    if(s===599||s===1799||s===SEC-1) mark(s+1);
  }
  const auto=rateWin.reduce((a,b)=>a+b,0)/Math.max(1,rateWin.length);
  return { snap, taps, wallT, autoPerSec:+auto.toFixed(1),
    tapGain:campTapGain(), gatherMul:+campGatherMul().toFixed(2) };
}, MINS, TAPMIN, TAPS);

const f=v=> v>=1e8?(v/1e8).toFixed(2)+'억' : v>=1e4?(v/1e4).toFixed(1)+'만' : String(Math.round(v));
console.log(`정책: ${MINS}분 시뮬 · 처음 ${TAPMIN}분 초당 ${TAPS}탭 · 매 초 ROI 최대 구매\n`);
console.log('  시점      총획득   탭Lv  효율Lv  일꾼  보급소   인구');
for(const r of res.snap) console.log('  '+String(Math.round(r.t/60)+'분').padStart(5)
  +String(f(r.earned)).padStart(11)+String(r.tap).padStart(6)+String(r.gat).padStart(7)
  +String(r.wk).padStart(6)+String(r.sup).padStart(7)+String(r.pop).padStart(9));
console.log(`\n총 탭 ${res.taps}회 · 마지막 자동수급 ${res.autoPerSec}/초`);
console.log(`탭당 ${f(res.tapGain)} · 효율배수 ×${res.gatherMul}`);
console.log('\n📋 HUNT_R1 §1-2 대조:  10분 10만 · 1시간 45만(자동 54/초)');
await b.close(); server.close();
