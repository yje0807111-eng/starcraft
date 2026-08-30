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
// ⛽ 정제소 레벨 상한(비교 실험용 · 2026-08-29) — 「연구 무한 누적」이 시간 지수 축이 되는지
//   상한 유/무로 갈라 재기 위한 것. 0 = 상한 없음(지금 게임 그대로).
const REFCAP=+(process.argv[5]||0);
// 🔁 환생 손익 실측(2026-08-29 · sc-3 요청) — argv[6]='reb' 이면:
//   던전 3 에 처음 닿는 순간(= D2 완주) 환생하고, 다시 D3 에 닿을 때까지 시간을 잰다.
//   「환생 안 하고 T분」 vs 「환생하고 T'분」 한 쌍이 첫 환생 손익의 실측값이다.
const REB=(process.argv[6]||'')==='reb';
// 🧱 벽 탐색(2026-08-29 · sc-3 요청) — 환생 없이 어디서 막히는가.
//   판정 기준은 sc-3 §: 한 라운드를 **10분** 넘게 못 깨면 벽 후보 · **30분**이면 벽으로 보고 멈춘다.
//   ⚠ 정체 문턱(stallS)과는 다른 것이다 — 그건 「측정을 계속할까」이고, 이건 「벽을 만났나」다.
const WALL_WARN=600, WALL_STOP=1800;
// 🧱 벙커 탑승(2026-08-30) — 환경변수 BUNK=0 이면 **짓기는 하되 태우지 않는다.**
//   ⭐ 켜고 끈 한 쌍이 「벙커가 라운드 시간에 무슨 짓을 하는가」의 실측값이다.
//   ⚠ 벙커 건설 자체는 원래부터 한다(__CB.want 가 모든 생산 건물을 연다) — 다른 것은 탑승뿐이다.
const BUNK=(process.env.BUNK==null) ? 1 : (+process.env.BUNK ? 1 : 0);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 let f=path.join(ROOT,p==='/'?'sc-ums-web.html':p); if(!f.startsWith(ROOT)){s.writeHead(403);return s.end();}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME=process.env.CHROME_PATH;
if(!CHROME||!fs.existsSync(CHROME)){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
// ⚠ **protocolTimeout 을 늘려 둔다.** 기본 30초인데, 병력이 100기를 넘어가면 한 덩이(CH초)를
//   미는 evaluate 호출이 그보다 오래 걸려 「Runtime.callFunctionOn timed out」으로 죽는다
//   (실측 2026-08-29: 던전 2 R8 · 91분 지점에서 그렇게 끊겼다). 게임이 아니라 벤치가 죽는 것이다.
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',protocolTimeout:1800000,
  args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:1});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
const probes=[];
pg.on('console', m=>{ const t=m.text(); if(t.indexOf('__PROBE__')===0) probes.push(t.slice(10)); });
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"',{timeout:30000});

await pg.evaluate((dg0,pol,refCap0,rebMode0,wallWarn0,wallStop0,bunk0)=>{
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','벤치');
  const C=campState(); C.race='terran'; saveMeta(); openHome();
  window.__CB={ dg0, pol, refCap:refCap0, rebMode:rebMode0, wallWarn:wallWarn0, wallStop:wallStop0, bunk:bunk0 };
}, DG0, POL, REFCAP, REB, WALL_WARN, WALL_STOP, BUNK);
await pg.waitForFunction(
  "typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech "
  // ⚠ 본부만 확인한다 — **시작 일꾼은 0기**다(HUNT_R1 §1). ents>=2 로 기다리면 영영 안 온다.
  +"&& (G.tech.minerals||[]).length>0 && (G.tech.ents||[]).some(e=>e.type==='bldg')",
  {timeout:30000});
await new Promise(r=>setTimeout(r,800));

await pg.evaluate(()=>{
  campStopFrame(); campStopTimer();          // 시계를 끄고 직접 민다
  // 🏕 **캠프(0)에서 시작한다** — 병력이 없으면 던전에 못 들어간다(2026-08-30).
  //   ⛔ 예전엔 여기서 곧장 __CB.dg0 에 넣었다. 그러면 맨몸으로 던전에 들어가 계속 지고,
  //     「D1R1 10분 · D1R2 17.4분 · 패배 9번」 같은 오염된 초반이 찍힌다.
  //   ⭐ 병력 __CB.enter 기가 모이면 아래(391행 근처)에서 __CB.dg0 으로 내려간다 —
  //     dg0=2 로 줘도 D1 을 안 거치고 바로 D2 로 간다.
  const C=campState(); C.dg=0; C.cleared=0; C.earn=0; C.earnGas=0;
  if(typeof CAMP_INC!=='undefined'){ CAMP_INC.tap=0; CAMP_INC.gather=0; CAMP_INC.mul=0; }   // 📊 수입 내역
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
  // ⚠ **설계 라운드 길이보다 넉넉해야 한다.** 던전 2 후반은 실측 330초이고 R50 은 10분대로
  //   추정된다 — 300초로 두면 정상 라운드를 정체로 세고 스스로 중단한다(그렇게 한 번 겪었다).
  __CB.stallS=900;
  __CB.wealth=[]; __CB.lastW=0; __CB.lastSample=0; __CB.gateT=0;
  // 🧱 벽 — 라운드가 wallWarn(10분) 넘으면 후보로 적고, wallStop(30분)이면 벽으로 보고 멈춘다.
  __CB.wallWarnLog=[]; __CB.wall=null;
  // ⏱ 30분 간격 요약 — 「한 던전에 머물 때 화력이 시간의 몇 제곱으로 자라는가」를 재는 표.
  //   ⚠ 15초 표본과 별개다. 그건 구간 평균용이고 이건 **성장 지수**용이다.
  __CB.slow=[]; __CB.lastSlow=0;
  // 🔮 스킬 자동 시전 계측 — 어떤 스킬이 **실제로 효과를 냈는지**만 센다(시도 X).
  //   ⚠ 효과 함수가 false 를 돌리면 시전 자체가 취소되므로, 여기서 세는 것이 곧 「진짜 나간 횟수」다.
  __CB.sk={}; __CB.healHp=0; __CB.medHp=0;
  // 🔁 회차 — 패배(campFail)마다 하나씩 센다. 「몇 회차에 어디까지 갔나」가 새 밸런스 단위다.
  __CB.runs=1; __CB.runLog=[];
  if(typeof window.campFail==='function'){ const o=window.campFail;
    window.campFail=function(){ const was=o.apply(this,arguments);
      if(was && was.dg>0){ __CB.runLog.push({ run:__CB.runs, dg:was.dg, r:was.cleared, t:+( __CB.t/60).toFixed(1) }); __CB.runs++; }
      return was; }; }
  // 던전을 처음 넘은 순간 — {dg, 회차, 분}
  __CB.dgFirst={};
  // ⚔ **이번 라운드에 실제로 나온 적**의 체력 합과 마리 수. ⛔ 「총량이 맞겠거니」 가정하지 않는다 —
  //   무리가 덜 나오거나(안 나온 무리는 버려진다) 티어·공중 제외로 마리 수가 달라질 수 있다.
  __CB.roundHp=0; __CB.roundFoe=0;
  if(typeof window.campScaleFoes==='function'){ const o=window.campScaleFoes;
    window.campScaleFoes=function(list, share){ const r=o.apply(this, arguments);
      for(const u of (list||[])){ __CB.roundHp+=(u.maxHp||0)+(u.maxSh||0); __CB.roundFoe++; }
      return r; }; }
  // 💉 의무병 치유는 **스킬 경로가 아니다**(strikeHealStep). 따로 재지 않으면 「치유가 도는가」에 답할 수 없다.
  if(typeof window.strikeHealStep==='function'){ const o=window.strikeHealStep;
    window.strikeHealStep=function(u, me, dt){ const b4=(me&&me.units||[]).reduce((a,x)=>a+(x.dead?0:(x.hp||0)),0);
      const r=o.apply(this, arguments);
      const af=(me&&me.units||[]).reduce((a,x)=>a+(x.dead?0:(x.hp||0)),0);
      if(af>b4) __CB.medHp+=(af-b4); return r; }; }
  // ⛔ **아래 세 함수만 세면 절반을 놓친다.** 광폭화(self)·공성 모드(toggle)·은신 장막(aura)은
  //   그 경로를 안 타고 `u.buff` / `u.skillOn` 을 직접 켠다 — 그래서 「스킬 0회」로 잘못 읽혔다
  //   (2026-08-27 실측: 마린 스팀팩이 1,814프레임 걸려 있는데 계측은 0이었다).
  //   strikeSkillTick 앞뒤로 buff/skillOn 이 꺼짐→켜짐으로 바뀐 것을 센다.
  if(typeof window.strikeSkillTick==='function'){ const o=window.strikeSkillTick;
    window.strikeSkillTick=function(){
      __CB.skTick=(__CB.skTick||0)+1;
      const S=(typeof STK!=='undefined')?STK:null, snap=[];
      if(S&&S.me&&S.me.units&&S.me.units.length) __CB.skTickU=(__CB.skTickU||0)+1;
      if(S&&S.me&&S.me.units) for(const u of S.me.units){ if(u.dead) continue;
        snap.push([u, Object.assign({},u.buff||{}), Object.assign({},u.skillOn||{})]); }
      const r=o.apply(this, arguments);
      for(const [u,b0,n0] of snap){
        if(u.buff) for(const k in u.buff){ if((u.buff[k]||0)>0 && !((b0[k]||0)>0)) __CB.sk[k]=(__CB.sk[k]||0)+1; }
        if(u.skillOn) for(const k in u.skillOn){ if(u.skillOn[k] && !n0[k]) __CB.sk[k]=(__CB.sk[k]||0)+1; } }
      return r; }; }
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
  // ⛔ **탭은 진짜 경로로 넣는다** (2026-08-30 고침). 예전엔 여기서 `credit += campTapGain()` 만
  //   했는데, 진짜 탭(campMineTap)은 **_campTapAcc 도 함께 늘린다.** 그 표시가 없으면
  //   campApplyGatherMul 이 탭 몫을 **일꾼이 캔 것으로 착각해 채취 배수를 먹인다** —
  //   「100만 도달이 설계 추정의 22배」의 유력한 원인이 이것이다(자[尺]가 틀렸던 쪽).
  //   ⚠ C.tapped(탭 횟수)도 이 경로라야 센다.
  __CB.tapN=0;
  __CB.tap=function(){ if(typeof campMineTap!=='function') return;
    for(let i=0;i<__CB.taps;i++){ campMineTap(null); __CB.tapN++; } };
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
          // ⛔ 레벨을 올린 **뒤에** 값을 물으면 한 칸 위 값을 낸다(실측: 잔액이 −12만까지 갔다).
          go:()=>{ const pay=campUpgCost('gather'); S.upg.gather=L+1; T.credit-=pay; }}); }
      { const L=S.upg.tap|0, cur=campTapGain();
        S.upg.tap=L+1; const nxt=campTapGain(); S.upg.tap=L;
        opts.push({k:'tap', c:campUpgCost('tap'), d:(nxt-cur)*__CB.taps,
          go:()=>{ const pay=campUpgCost('tap'); S.upg.tap=L+1; T.credit-=pay; }}); }
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
  const RES_M_RESERVE=4;   // 미네랄로 사는 연구 = 값의 몇 배가 지갑에 있어야 사는가
  // ⛽ 정제소 업그레이드는 **__CB.research 가 진짜 경로로 산다**(정제소 연구 카드 · 2026-08-27).
  //   ⛔ 예전엔 여기서 S.upg.refinery 를 직접 올렸다 — 화면에 없는 길이라 실제와 달랐다.
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
        // ⛽ 비교 실험 — 정제소 레벨 상한(0 = 없음)
        if(__CB.refCap>0 && typeof CAMP_REF_KEY!=='undefined' && r.k===CAMP_REF_KEY
           && typeof campRefLv==='function' && campRefLv()>=__CB.refCap) continue;
        if(!r.tier && lv) continue;                        // 단발은 한 번뿐
        if(typeof _techReqMet==='function' && !_techReqMet(r.req)) continue;
        const c=(typeof campResearchCost==='function' && campResearchCost(r,lv))||[r.m||0,r.g||0];
        if((T.credit||0)<c[0] || (T.energy||0)<c[1]) continue;
        // ⛽ **미네랄로 사는 연구(정제소)는 여유가 있을 때만.**
        //   ⛔ 이 문이 없으면 정제소가 싸다는 이유로 미네랄을 다 먹어 **경제 축이 멎는다** —
        //     실측(2026-08-27): 효율Lv 32→10 · 일꾼 14→7 · 45분 수입 199만→60만.
        if(c[0]>0 && (T.credit||0) < c[0]*RES_M_RESERVE) continue;
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
      // 🛡 방어 건물은 **격자 맨 위**에 짓는다 — 전장에서 가장 앞(선두)에 서야 방어막이 된다.
      //   ⚠ 랜덤(0.20~0.42)이면 판마다 벙커 위치가 달라져 비교가 안 된다.
      const c=0.30+Math.random()*0.40;
      const r=(b.k==='bunker'||b.k==='turret') ? 0.20+Math.random()*0.04 : 0.24+Math.random()*0.18;
      try{ techPlace(c, r); }catch(e){}
      G.tech.arm=null; return; } };
  // 🧱 **벙커에 태운다** (2026-08-30) — 사거리가 짧아 앞에서 얻어맞는 유닛부터.
  //   ⭐ 사람이 할 판단을 그대로 흉내낸다: 「제일 가까이 붙어야 하는 애를 넣어 준다」.
  //   ⚠ 탑승은 유닛의 **자리**가 되므로 한 번만 넣으면 라운드마다 저절로 유지된다 —
  //     그래도 매번 부르는 이유는 새로 뽑힌 유닛과 새로 지은 벙커를 채우기 위해서다.
  //   ⚠ BUNK=0 이면 아무것도 안 한다(벙커는 짓되 태우지 않는 대조군).
  //   ⛔ **전 병력을 가두지 말 것** (2026-08-30 고침). 예전에는 빈자리를 사거리 짧은 순으로
  //     전부 채웠다 — 병력 8기가 벙커 3채에 통째로 갇혔고, 사람은 그렇게 하지 않는다.
  //     그 판이 D1R3(실효 0.32) 이었다: 벙커를 평가한 게 아니라 **병력을 창고에 넣은 것**이다.
  //   ⭐ 사람이 할 판단 둘을 규칙으로 못 박는다:
  //     ① 사거리가 **짧은 유닛만** 태운다 — 마린(187)은 밖에서 쏘는 게 낫다
  //     ② 전투 병력의 **1/3 을 넘기지 않는다** — 나머지는 밖에서 싸워야 라운드가 끝난다
  __CB.bunkMaxR=100;                       // 이보다 사거리가 길면 안 태운다(화력병 70 ○ · 마린 187 ✕)
  __CB.bunkShare=1/3;                      // 전투 병력 중 벙커에 넣는 최대 비율
  __CB.board=function(){
    if(!__CB.bunk) return;
    if(typeof campBoard!=='function' || typeof CAMPB==='undefined' || !CAMPB) return;
    const cap=(typeof CAMP_BUNK_CAP!=='undefined')?CAMP_BUNK_CAP:4;
    const alive=CAMPB.me.units.filter(u=>!u.dead && (u.dmg||0)>0);
    const inB=alive.filter(u=>u._bunk!=null).length;
    let room=Math.floor(alive.length*__CB.bunkShare)-inB;      // ② 비율 상한
    if(room<=0) return;
    for(const b of (CAMPB._bld||[])){
      if(room<=0) break;
      if(!b || b.bk!=='bunker' || b.dead) continue;
      const free=cap-((typeof campBunkCrew==='function')?campBunkCrew(b.eid):0);
      if(free<=0) continue;
      const cand=alive
        .filter(u=>u._bunk==null && (u.rng||0)<=__CB.bunkMaxR)  // ① 사거리 짧은 유닛만
        .sort((x,y)=>(x.rng||0)-(y.rng||0)).slice(0, Math.min(free, room));
      if(cand.length){ campBoard(cand, b); room-=cand.length; } } };
  // 🛡 **벙커를 방어선의 기준으로 삼는다** (2026-08-30 사용자 확정).
  //   ⭐ 사용자가 그리는 그림: 「벙커가 **방어막**처럼 가장 선두에서 대신 맞아 주고,
  //     병력들은 그 근처에서 싸운다」. 화력병처럼 근접이라 손으로 체력 관리가 어려운 유닛을
  //     벙커에 넣어 대신 버티게 하는 것이다.
  //   ⛔ 이게 없어서 지금까지 벙커를 **엉뚱한 자리에 두고 쟀다** — 벙커는 격자 랜덤 위치인데
  //     병력은 생산된 자리에 그대로 서 있었다. 다섯 판 내내 벙커 체력이 안 깎였던 이유다.
  //   ⚠ 사람이 하는 조작(병력 지정 → 자리 옮기기)을 흉내내는 것이라 **벤치 쪽**에 둔다.
  //     게임 규칙으로 만들 것인지는 이 측정 결과를 보고 정한다.
  __CB.rally=function(){
    if(!__CB.bunk || typeof CAMPB==='undefined' || !CAMPB) return;
    const bunks=(CAMPB._bld||[]).filter(b=>b && b.bk==='bunker' && !b.dead);
    if(!bunks.length) return;
    let f=bunks[0]; for(const b of bunks) if(b.y<f.y) f=b;      // 가장 앞(적 쪽) 벙커
    const W=CAMPB.world||4800;
    let i=0;
    for(const u of CAMPB.me.units){
      if(u.dead || u._bunk!=null) continue;
      if(u._rallyB===f.eid) continue;                          // 이미 이 벙커를 기준으로 섰다
      u._rallyB=f.eid;
      // 벙커보다 **뒤**(y 큰 쪽)에 반원으로 — 벙커가 먼저 맞고 병력이 뒤에서 쏜다
      const a=(i%9)/8*Math.PI, r=130+((i/9)|0)*70; i++;
      u._post={ x:Math.max(0,Math.min(W, f.x+Math.cos(a)*r)),
                y:Math.max(0,Math.min(W, f.y+Math.abs(Math.sin(a))*r*0.6+60)) }; } };
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
      // 🧱 벽 판정 — 지금 라운드가 얼마나 오래 안 넘어가는가(라운드가 바뀌면 roundT 가 0 이 된다)
      if(campDgN()>0 && !__CB.wall){
        if(__CB.roundT>__CB.wallStop){
          __CB.wall={ dg:campDgN(), r:campRoundN(), sec:Math.round(__CB.roundT), t:+(__CB.t/60).toFixed(1),
            me:(typeof campAlive==='function'?campAlive('me'):0),
            dn:(typeof campDown==='function'?campDown():0),
            dps:__CB.dps(), refLv:(typeof campRefLv==='function'?campRefLv():0),
            res:(function(){ const R=(G.tech&&G.tech.research)||{}; let n=0;
              for(const k in R) n+=(R[k]===true?1:(R[k]|0)); return n; })(),
            cr:Math.round((G.tech&&G.tech.credit)||0), gas:Math.round((G.tech&&G.tech.energy)||0),
            diff:Math.round(typeof campFoeDiff==='function'?campFoeDiff(campDgN(),campCleared()):0) };
        } else if(__CB.roundT>__CB.wallWarn){
          const k=campDgN()+':'+campRoundN();
          if(!__CB.wallWarnLog.some(x=>x.k===k))
            __CB.wallWarnLog.push({ k:k, dg:campDgN(), r:campRoundN(), t:+(__CB.t/60).toFixed(1) });
        } }
      // ⏱ 30분 요약
      if(__CB.t-(__CB.lastSlow||0) >= 1800){ __CB.lastSlow=__CB.t;
        __CB.slow.push({ t:Math.round(__CB.t/60), dg:campDgN(), r:campRoundN(),
          w:Math.round(campWealth()),
          min:Math.round((campState()||{}).earn||0), gas:Math.round((campState()||{}).earnGas||0),
          refLv:(typeof campRefLv==='function'?campRefLv():0),
          res:(function(){ const R=(G.tech&&G.tech.research)||{}; let n=0;
            for(const k in R) n+=(R[k]===true?1:(R[k]|0)); return n; })(),
          dps:__CB.dps(), me:(typeof campAlive==='function'?campAlive('me'):0) }); }
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
      { const d=campDgN(); if(d>0 && !__CB.dgFirst[d]) __CB.dgFirst[d]={ run:__CB.runs, t:+(__CB.t/60).toFixed(1) };
        // 🔁 환생 손익 — D3 에 처음 닿는 순간 환생하고, 다시 닿을 때까지 잰다
        if(__CB.rebMode && d===3){
          if(!__CB.rebGot){                                       // 1단계 — 지금 환생한다
            const got=(typeof campRebirth==='function') ? campRebirth() : null;
            __CB.rebGot={ t1:+(__CB.t/60).toFixed(1), mul:got?got.mul:null, pts:got?got.pts:null };
          } else if(!__CB.rebGot.t2){                             // 2단계 — 환생 후 재도달
            __CB.rebGot.t2=+(__CB.t/60).toFixed(1);
          } } }
      if((i%20)===0){ __CB.tap(); const w=campWealth();
        if(!__CB.gateT && w>=1e6) __CB.gateT=__CB.t;
        if(__CB.t-(__CB.lastSample||0) >= 15){ __CB.lastSample=__CB.t;
          __CB.wealth.push({ t:+__CB.t.toFixed(0), w:Math.round(w), dg:campDgN(), r:campRoundN(),
            gl:campUpgLv('gather'), tl:campUpgLv('tap'), rate:Math.round((w-(__CB.lastW||0))/15),
            ore:Math.round((G.tech&&G.tech.minerals||[]).reduce((a,m)=>a+(m.amount||0),0)),
            wk:(G.tech&&G.tech.ents||[]).filter(e=>e.type==='worker').length,
            // 👥 인구 — ⚠ **기수(병력 수)와 함께 봐야 한다.** 기수만 보면 「병력이 준다」가
            //   새는 것인지 구성이 바뀐 것인지(인구 큰 유닛 ↔ 작은 유닛) 못 가른다(sc-3 지적).
            sup:(G.tech&&G.tech.sup)|0, supCap:(G.tech&&G.tech.supCap)|0,
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
      if((i%40)===0){ __CB.build(); __CB.research(); __CB.produce(); __CB.buy(); __CB.board(); __CB.rally();
        // 캠프(0단계)에 있고 병력이 모였으면 던전으로
        const units=G.tech?G.tech.ents.filter(e=>e.type==='unit').length:0;
        __CB.army=units;
        if(campDgN()===0 && units>=__CB.enter) campEnterDungeon(__CB.dg0);
      }
      const r=campRoundN();
      if(r!==__CB.lastRound){
        // ⭐ **라운드마다** 화력을 남긴다 — 15초 표본으로는 라운드별 곡선을 못 만든다.
        //   dps  = 명목(아군 공격력 합) · hit = 실제로 꽂힌 화력(적 총 체력 ÷ 걸린 초)
        //   eff  = hit ÷ dps — 제자리 방어라 앞줄만 닿는 탓에 1 이 안 된다.
        { const _d=campFoeDiff(campDgN(), Math.max(0,__CB.lastRound-1));
          const _sec=+__CB.roundT.toFixed(1), _dps=__CB.dps();
          // ⭐ **설계 총량이 아니라 실제로 나온 체력**으로 잰다. 둘이 다르면 want/got 로 드러난다.
          const _want=(typeof CAMP_FOE_HP0!=='undefined'?CAMP_FOE_HP0:0)*_d
                    *((typeof campRtFoeMul==='function')?campRtFoeMul():1);
          const _hp=__CB.roundHp||0;
          const _hit=_sec>0 ? _hp/_sec : 0;
          __CB.log.push({ dg:campDgN(), round:__CB.lastRound, sec:_sec,
            earn:Math.round(campWealth()), diff:_d,
            dps:Math.round(_dps*10)/10, hit:Math.round(_hit*10)/10,
            want:Math.round(_want), got:Math.round(_hp), foe:__CB.roundFoe|0,
            eff:_dps>0 ? Math.round(_hit/_dps*1000)/1000 : 0,
            me:(typeof campAlive==='function'?campAlive('me'):0),
            dn:(typeof campDown==='function'?campDown():0) }); }
        __CB.lastRound=r; __CB.roundT=0; __CB.stallT=0; __CB.stuck=0;
        __CB.roundHp=0; __CB.roundFoe=0;
        if(!__CB.gateT && campWealth()>=1e6) __CB.gateT=__CB.t;
      // ⚠ **정체 판정 문턱은 설계 라운드 길이보다 길어야 한다.** 적 체력 1,300 확정 뒤
      //   R50 목표가 175초라, 옛 문턱(60초)이면 정상 라운드를 정체로 세고 스스로 중단한다.
      } else if((__CB.stallT=(__CB.stallT||0)+dt) > __CB.stallS && campDgN()>0){
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
        // ⛔ **roundT 를 건드리지 않는다.** 예전엔 여기서 0 으로 되돌려, 300초를 넘긴 라운드가
        //   **나머지 시간만** 기록됐다 — R39 가 14.3초로 찍혔지만 실제로는 약 314초였다.
        //   그 값으로 계산한 실효 계수가 3.53(물리적으로 불가능)이 되어 곡선을 통째로 흔들었다.
        __CB.stuck++; __CB.stallT=0; }   // ⚠ D0(캠프)엔 라운드가 없다 — 거기서 세면 오작동한다
    } };
});

// ⚠ 한 번에 미는 시뮬 초. 짧을수록 evaluate 하나가 가벼워 타임아웃에 안전하다
//   (병력 100기대에서 30초는 무거웠다 — 10초로 줄였다. 총 실행 시간은 거의 같다).
const CH=10; let ran=0;
process.stdout.write(`⏱  캠프 시뮬 ${MINS}분 · 던전 ${DG0} 시작\n`);
while(ran<MINS*60){
  const st=await pg.evaluate(c=>{ __CB.tick(c);
    return { t:__CB.t, dg:campDgN(), round:campRoundN(), earn:Math.round(campWealth()),
      foe:campAlive('ai'), me:campAlive('me'), rounds:__CB.log.length, stuck:__CB.stuck, army:__CB.army,
      cr:Math.round((G.tech&&G.tech.credit)||0), rebDone:!!(__CB.rebGot&&__CB.rebGot.t2),
      wall:__CB.wall||null }; }, CH);
  ran=st.t;
  if(st.rebDone){ process.stdout.write('\n🔁 환생 후 재도달 완료 — 조기 종료\n'); break; }
  if(st.wall){ process.stdout.write('\n🧱 벽 — D'+st.wall.dg+'R'+st.wall.r+' 를 '+Math.round(st.wall.sec/60)+'분째 못 깸 · 종료\n'); break; }
  process.stdout.write(`\r   ${(st.t/60).toFixed(1)}분 · D${st.dg}R${st.round} · 번돈 ${st.earn} · 보유 ${st.cr} · 적 ${st.foe} 아군 ${st.me}(대기 ${st.army}) · 깬라운드 ${st.rounds}   `);
  if(st.stuck>3){ process.stdout.write('\n⚠ 라운드가 15분 넘게 안 넘어감 — 중단\n'); break; }
}
const fin=await pg.evaluate(()=>({ price:(function(){ const T=TECH_TREE[G.tech.race], out=[];
    if(typeof campSyncUnitCost==='function') campSyncUnitCost();
    for(const b of T.buildings) for(const q of (b.produces||[])) out.push({id:q.id, m:Math.round(q.m||0),
      own:(typeof campUnitOwned==='function')?campUnitOwned(q.id):-1, base:(G.tech.units[q.id]|0)});
    return out; })(), sk:__CB.sk||{}, skTick:__CB.skTick||0, skTickU:__CB.skTickU||0, medHp:Math.round(__CB.medHp||0), healHp:Math.round(__CB.healHp||0), log:__CB.log, wealth:__CB.wealth, jam:__CB.jam||null, vanish:__CB.vanish||null, dead:__CB.dead||null, t:__CB.t, gateT:__CB.gateT||0, earn:Math.round(campWealth()),
  dg:campDgN(), round:campRoundN(), reb:campCanRebirth(),
  // 🧱 벙커 — 몇 채이고 몇 기가 탔고 실제로 얼마나 맞았나
  bunk:(function(){ const on=!!__CB.bunk;
    let n=0, crew=0, hp=0, mx=0;
    if(typeof CAMPB!=='undefined' && CAMPB) for(const b of (CAMPB._bld||[])){
      if(!b || b.bk!=='bunker') continue; n++;
      hp+=Math.max(0,b.hp||0); mx+=(b.maxHp||b.max||0);
      if(typeof campBunkCrew==='function') crew+=campBunkCrew(b.eid); }
    return { on:on, n:n, crew:crew, hp:Math.round(hp), max:Math.round(mx),
             built:(G.tech.built&&G.tech.built.bunker)|0 }; })(),
  // 📊 수입 내역 — 번 돈이 어디서 왔는가(sc-3 요청 2026-08-30 · 100만 22배 건)
  inc:(typeof CAMP_INC!=='undefined')?{ tap:Math.round(CAMP_INC.tap), gather:Math.round(CAMP_INC.gather),
       mul:Math.round(CAMP_INC.mul), gmul:(typeof campGatherMul==='function')?campGatherMul():1 }:null,
  taps:Math.round(__CB.tapN||0), tapGain:(typeof campTapGain==='function')?campTapGain():0,
  // ⚠ 일꾼은 type:'unit' 이 아니라 **type:'worker'** 다(campWorkerN 과 같은 잣대).
  wk:(function(){ let n=0; for(const e of (G.tech.ents||[])) if(e&&e.type==='worker') n++;
      return { n:n, effLv:((campState()||{}).upg||{}).eff|0, tapLv:((campState()||{}).upg||{}).tap|0 }; })(),
  // 🔬 연구 내역 — 계열(레벨)과 단발(해금)을 갈라 본다. ⚠ 합계만 보면 둘을 못 가른다.
  resBreak:(function(){ const T=G.tech, R=(T&&T.research)||{}, t=TECH_TREE[T.race]||{};
    const tierK=new Set(), oneK={};
    for(const b of (t.buildings||[])) for(const r of (b.research||[])){
      if(r.tier) tierK.add(r.k); else oneK[r.k]=r.name||r.k; }
    let tierN=0; const one=[];
    for(const k in R){ const kk=k.replace(T.race+'_',''), v=(R[k]===true?1:(R[k]|0));
      if(tierK.has(kk)) tierN+=v; else if(oneK[kk]) one.push(oneK[kk]); else if(kk!=='gasup') one.push(kk); }
    return { tier:tierN, one:one }; })() }));
{ const R=await pg.evaluate(()=>({ runs:__CB.runs, log:__CB.runLog||[], first:__CB.dgFirst||{}, cap:__CB.refCap|0, ref:(typeof campRefLv==='function')?campRefLv():-1, reb:__CB.rebGot||null }));
  { const W=await pg.evaluate(()=>({ wall:__CB.wall||null, warn:__CB.wallWarnLog||[], slow:__CB.slow||[] }));
    console.log('');
    console.log('■ 🧱 벽 — 환생 없이 어디서 막히는가');
    if(W.wall){ const w=W.wall;
      console.log('  막힌 곳: **던전 '+w.dg+' R'+w.r+'** · '+w.t+'분 경과 · 그 라운드를 '+Math.round(w.sec/60)+'분째 못 깸');
      console.log('  그때 상태: 병력 '+w.me+'(누움 '+w.dn+') · 명목 DPS '+w.dps+' · 연구 총Lv '+w.res+' · 정제소 L'+w.refLv);
      console.log('             보유 미네랄 '+w.cr+' · 가스 '+w.gas+' · 적 난이도 '+w.diff);
    } else console.log('  ⚠ 주어진 시간 안에는 벽을 못 만났다(계속 진행 중이었다)');
    if(W.warn.length) console.log('  10분 넘긴 라운드: '+W.warn.map(x=>'D'+x.dg+'R'+x.r+'('+x.t+'분)').join(' · '));
    console.log('');
    console.log('■ ⏱ 30분 간격 — 한 던전에 머물 때의 성장');
    console.log('경과분 | 던전R  | 미네랄누적 | 가스누적 | 연구Lv | 정제소 | 명목DPS | 병력');
    for(const x of W.slow) console.log(String(x.t).padStart(5)+'  | D'+x.dg+'R'+String(x.r).padEnd(3)
      +'| '+String(x.min).padStart(10)+' | '+String(x.gas).padStart(7)+' | '+String(x.res).padStart(6)
      +' | '+String(x.refLv).padStart(6)+' | '+String(x.dps).padStart(7)+' | '+x.me); }
  if(R.reb){ console.log('');
    console.log('■ 🔁 첫 환생 손익 (D3 첫 도달 시 환생 → 재도달)');
    console.log('  환생 없이 D3 까지: '+R.reb.t1+'분 · 환생 보상 배수 +'+R.reb.mul+' · 포인트 +'+R.reb.pts);
    console.log(R.reb.t2!=null
      ? ('  환생 후 다시 D3 까지: '+(R.reb.t2-R.reb.t1).toFixed(1)+'분 (누적 '+R.reb.t2+'분)')
      : '  ⚠ 시간 안에 재도달 못 함'); }
  console.log('');
  console.log('■ 🔁 회차 — 정제소 상한 '+(R.cap>0?('L'+R.cap):'없음')+' · 최종 정제소 L'+R.ref);
  for(const d in R.first) console.log('  던전 '+d+' 첫 진입: '+R.first[d].run+'회차 · '+R.first[d].t+'분');
  console.log('  패배 '+R.log.length+'번 · 마지막 5번: '+R.log.slice(-5).map(x=>x.run+'회차 D'+x.dg+'R'+x.r).join(' · ')); }
const F=n=>{ if(n<1e4) return String(Math.round(n));
  for(const [u,v] of [['해',1e20],['경',1e16],['조',1e12],['억',1e8],['만',1e4]]) if(n>=v) return (n/v).toFixed(1)+u;
  return String(Math.round(n)); };
console.log('\n\n■ 라운드별 (전 구간에서 고르게 뽑음)');
console.log('던전-라운드 | 걸린 초 | 적난이도 | 적체력(설계→실제) | 적수 | 명목DPS | 꽂힌화력 | 실효 | 병력(선+누움)');
// ⚠ 라운드 곡선을 보려면 **전부** 찍어야 한다 — 22개 표본으로는 R1~50 곡선이 안 나온다.
{ const L=fin.log, step=(L.length<=60) ? 1 : Math.max(1, Math.floor(L.length/22));
  for(let i=0;i<L.length;i+=step){ const r=L[i];
    console.log(`D${r.dg}R${String(r.round).padEnd(3)}| ${String(r.sec).padEnd(8)}| ${String(r.diff).padEnd(9)}| ${(F(r.want||0)+'→'+F(r.got||0)).padEnd(18)}| ${String(r.foe==null?'-':r.foe).padEnd(5)}| ${String(r.dps==null?'-':r.dps).padEnd(8)}| ${String(r.hit==null?'-':r.hit).padEnd(9)}| ${String(r.eff==null?'-':r.eff).padEnd(5)}| ${(r.me|0)+'+'+(r.dn|0)}`); }
  if(L.length){ const r=L[L.length-1];
    console.log(`D${r.dg}R${String(r.round).padEnd(3)}| ${String(r.sec).padEnd(8)}| ${String(r.diff).padEnd(9)}| ${(F(r.want||0)+'→'+F(r.got||0)).padEnd(18)}| ${String(r.foe==null?'-':r.foe).padEnd(5)}| ${String(r.dps==null?'-':r.dps).padEnd(8)}| ${String(r.hit==null?'-':r.hit).padEnd(9)}| ${String(r.eff==null?'-':r.eff).padEnd(5)}| ${(r.me|0)+'+'+(r.dn|0)}  ← 끝`); } }
// D 가정 검사 — 번돈÷난이도가 일정한가
{ const L=fin.log.filter(r=>r.earn>0 && r.diff>0);
  if(L.length>4){ const q=L.map(r=>r.earn/r.diff).sort((a,b)=>a-b);
    const lo=q[Math.floor(q.length*0.1)], hi=q[Math.floor(q.length*0.9)];
    console.log(`\n□ D 가정 「번 돈 ∝ 난이도」 — 비율 10~90퍼센타일 ${F(lo)} ~ ${F(hi)} (${(hi/lo).toFixed(1)}배 폭)`); } }
// E 검사 — 관문 100만을 언제 넘겼나
console.log(fin.gateT ? `\n□ E 관문 100만 도달: 시작 후 **${(fin.gateT/60).toFixed(1)}분** (설계 추정 10시간)`
                     : `\n□ E 관문 100만: ${(fin.t/60).toFixed(1)}분 안에 못 넘음(번 돈 ${F(fin.earn)})`);
console.log('\n■ 15초마다 — 번 돈과 수급 속도');
console.log('초    | 던전R  | 번돈      | 초당    | 효율 | 탭  | 일꾼 | 인구     | 가스/정제소 | 연구Lv | 병력(선+누움) | 아군DPS | 건물(남음 체력) | 적난이도 | 병력 구성');
{ const W=fin.wealth, step=Math.max(1, Math.floor(W.length/18));
  for(let i=0;i<W.length;i+=step){ const w=W[i];
    console.log(`${String(w.t).padEnd(6)}| D${w.dg}R${String(w.r).padEnd(3)}| ${F(w.w).padEnd(9)}| ${F(w.rate).padEnd(8)}| ${String(w.gl).padEnd(4)}| ${String(w.tl).padEnd(4)}| ${String(w.wk).padEnd(4)}| ${String((w.sup|0)+"/"+(w.supCap|0)).padEnd(7)}| ${String((w.gas|0)+'/L'+(w.rl|0)).padEnd(9)}| ${String(w.res|0).padEnd(6)}| ${String((w.me|0)+'+'+(w.dn|0)).padEnd(7)}| ${String(w.dps).padEnd(8)}| ${String((w.bld|0)+'/'+(w.bldAll|0)+' '+(w.bldHp|0)+'%').padEnd(11)}| ${String(w.dif).padEnd(8)}| ${Object.entries(w.mix||{}).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k+' '+v).join(', ')}`); } }
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
  console.log('  (계측: strikeSkillTick '+fin.skTick+'회 · 그중 내 유닛이 있던 것 '+fin.skTickU+'회)');
  console.log('  ✚ 스킬로 회복시킨 체력 '+(fin.healHp||0)+' · 💉 의무병(전용 경로)이 회복시킨 체력 '+(fin.medHp||0)); }
if(fin.dead) console.log('\n⛔ 판이 빈 순간: '+JSON.stringify(fin.dead));
if(fin.vanish) console.log('\n⛔ 일꾼이 통째로 사라진 순간: '+JSON.stringify(fin.vanish));

if(fin.resBreak) console.log(`\n■ 🔬 연구 내역 — 계열 업그레이드 ${fin.resBreak.tier}레벨 · 단발 해금 ${fin.resBreak.one.length}개`
  + (fin.resBreak.one.length?('\n  '+fin.resBreak.one.join(' · ')):''));
// 🧱 벙커 — 켰나 · 실제로 탔나 · 몸으로 받았나
if(fin.bunk){ const B=fin.bunk;
  console.log(`\n■ 🧱 벙커 — 탑승 ${B.on?'켬':'끔(대조군)'}`);
  console.log(`  지은 채수 ${B.built} · 전장 ${B.n}채 · 탄 병력 **${B.crew}기** · 체력 ${B.hp}/${B.max}`);
  if(B.on && B.n && !B.crew) console.log('  ⚠ 벙커가 있는데 **아무도 안 탔다** — 태우는 경로가 안 돈다');
  if(B.n && B.max && B.hp===B.max) console.log('  ⚠ 벙커가 **한 대도 안 맞았다** — 전선 뒤에 있다는 뜻이다');
}
// 📊 수입 내역 — 그 돈이 어디서 왔는가(sc-3 요청 · 100만 22배 건)
if(fin.inc){
  const I=fin.inc, tot=I.tap+I.gather+I.mul || 1;
  const pct=(v)=>((v/tot)*100).toFixed(1).padStart(5)+'%';
  console.log('\n■ 📊 수입 내역 — 번 돈이 어디서 왔는가');
  console.log(`  터치        ${F(I.tap).padStart(12)}  ${pct(I.tap)}   · 탭 ${fin.taps}회 · 지금 1탭 ${F(fin.tapGain)}`);
  console.log(`  일꾼 채취    ${F(I.gather).padStart(12)}  ${pct(I.gather)}   · 일꾼 ${fin.wk.n}기`);
  console.log(`  채취 배수    ${F(I.mul).padStart(12)}  ${pct(I.mul)}   · 지금 배수 ×${(fin.inc.gmul||1).toFixed(2)}`);
  console.log(`  합계        ${F(tot).padStart(12)}          (번 돈 ${F(fin.earn)} 과 맞아야 한다)`);
  console.log(`  업그레이드   탭 Lv${fin.wk.tapLv} · 효율 Lv${fin.wk.effLv}`);
  if(I.mul > I.gather) console.log('  ⚠ **채취 배수가 원본보다 크다** — §1-1 표에 없는 지수 축이다');
  if(Math.abs(tot-fin.earn) > fin.earn*0.05)
    console.log(`  ⚠ 내역 합계와 번 돈이 5% 넘게 어긋난다 — 표에 없는 수입원이 있다는 뜻이다`);
}
console.log(`\n최종 ${(fin.t/60).toFixed(1)}분 · D${fin.dg}R${fin.round} · 번 돈 ${fin.earn} · 환생 가능 ${fin.reb}`);
console.log(errs.length ? ('\n⚠ 페이지 예외 '+errs.length+'건:\n  '+[...new Set(errs)].slice(0,6).join('\n  ')) : '\n✅ 페이지 예외 없음');
await b.close(); server.close();
