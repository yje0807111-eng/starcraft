/* ============================================================================
 * dg-bench.mjs — 토벌 밸런스 실측 (BALANCE.md §5 A5·A6·A7)
 *
 * ⚠ 모델로 추정하지 말 것 — BALANCE.md §4 규칙. 실제 hbStep 루프를 돌려서 잰다.
 *
 *   A7  직접(카이팅) 이 자동(제자리) 보다 실제로 잘 깨지는가
 *   A6  토벌 단계 n 이 사냥터 라운드 n 과 견줘 어느 정도인가
 *   A5  일반 토벌 재화가 사냥터 방치 수입을 압도하지 않는가
 *
 * 사용: CHROME_PATH=... node scripts/dg-bench.mjs [시행수]
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';

const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const TRIALS=+(process.argv[2]||20);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{ try{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname);
  let f=path.join(ROOT,p==='/'?'sc-ums-web.html':p); if(!f.startsWith(ROOT)){res.writeHead(403);return res.end();}
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('nf');}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);
 }catch(e){res.writeHead(500);res.end(String(e));} });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PORT=server.address().port;
const CHROME=process.env.CHROME_PATH;
if(!CHROME||!fs.existsSync(CHROME)){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
const browser=await puppeteer.launch({executablePath:CHROME, headless:'new', args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox']});
const page=await browser.newPage(); await page.setViewport({width:390,height:844,deviceScaleFactor:1});
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
await page.goto(`http://127.0.0.1:${PORT}/sc-ums-web.html`,{waitUntil:'load'});
await page.waitForFunction('typeof dgHbStart==="function" && typeof hbStep==="function"',{timeout:30000});

// ── 벤치 커널을 페이지 안에 심는다(모든 측정이 이 한 벌을 쓴다) ──
await page.evaluate(()=>{
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  window.__B={};
  // 같은 스펙에서 재야 비교가 뜻이 있다 — 캐릭터·업그레이드를 고정한다
  __B.setup=function(lv, upg){
    const p=PROF(); p.chars.length=0; p.curId=''; p.pcoin=0; p.gas=0;
    p.hunt={dg:1,round:1,climb:true,climbChosen:1,best:{},rw:{},mates:{},party:[],mateN:0,allySlots:0,upg:{},unl:{},dgIn:{}};
    profCreateChar('ranger','벤치');
    const c=CHAR(); c.level=lv; c.dgFloors={};
    Object.assign(hbHunt().upg, upg);
    saveMeta(); };
  // 한 판을 끝까지 돌린다. policy: 'stand'(자동=제자리) | 'kite'(직접=카이팅)
  //   ⚠ 보상·열쇠는 이 측정의 주제가 아니다 — dgHbWin/Lose 를 기록기로 갈아끼워 상태를 안 건드린다.
  __B.run=function(floor, policy, maxS){
    const realW=window.dgHbWin, realL=window.dgHbLose;
    let res=null;
    window.dgHbWin=function(S){ res={win:true, t:S.t}; hbSetSess('dg',null); };
    window.dgHbLose=function(S){ res={win:false, t:S.t}; hbSetSess('dg',null); };
    try{
      const S=dgHbStart(floor,'normal',{auto:(policy==='stand'), key:false});
      S.manual=true;                                   // 인터벌 시계를 끄고 직접 민다
      const dt=0.05, cap=Math.round((maxS||120)/dt);
      let fails=0;                                     // 웨이브 시간 초과(1웨이브로 리셋) 횟수
      hbWith('dg', ()=>{
        let ph=S.phase;
        for(let i=0;i<cap && !res;i++){
          if(policy==='kite'){ __B.kite(S);
            // 직접은 스킬도 사람이 쓴다 — 자동과 같게 '준비되면 쓴다'로 맞춘다(차이를 이동으로만 둔다)
            for(const k in HB_SKILLS) if(hbSkillReady(k)) hbUseSkill(k); }
          hbStep(dt);
          if(S.phase==='fail' && ph!=='fail') fails++;
          ph=S.phase; }
      });
      if(!res){ res={win:false, t:S.t, timeout:true}; hbSetSess('dg',null); }
      res.fails=fails;                                 // 죽어서 졌나 / 시간에 쫓겨 졌나
      return res;
    } finally{ window.dgHbWin=realW; window.dgHbLose=realL; hbSetSess('dg',null); hbUse('hunt'); } };
  // 🎮 카이팅 정책 — 사람이 직접 할 때 하는 것은 '도망'이 아니라 **간격 유지**다.
  //   ⛔ 사거리 밖까지 빼면 공격이 멎어 손해다(첫 벤치가 그렇게 짜여 카이팅이 더 나쁘게 나왔다).
  //   적이 때리는 거리(HB_STOP=30) 바로 밖 ~ 내 사거리 안쪽에 머문다.
  //   ⚠ 그래서 **사거리 업그레이드가 없으면 카이팅할 공간 자체가 없다**(기본 사거리 34 vs HB_STOP 30).
  __B.kite=function(S){ const c=S.char; if(!S.foes.length){ c.tx=null; return; }
    let n=null, nd=1e18;
    for(const f of S.foes){ const d=Math.hypot(f.x-c.x,f.y-c.y); if(d<nd){ nd=d; n=f; } }
    const safe=HB_STOP*1.25, band=Math.min(c.range*0.92, Math.max(safe, c.range*0.92));
    if(nd<safe){ const dx=c.x-n.x, dy=c.y-n.y, m=Math.hypot(dx,dy)||1;
      const back=Math.min(band-nd, 120);
      c.tx=c.x+dx/m*back; c.ty=c.y+dy/m*back; }    // 딱 안전 간격까지만 뺀다(사거리 안쪽 유지)
    else c.tx=null; };
});

const bench=async(floors, policy, trials)=>page.evaluate((floors,policy,trials)=>{
  const out=[];
  for(const fl of floors){ let w=0, ts=[], f=0;
    for(let i=0;i<trials;i++){ const r=__B.run(fl, policy, 120); if(r.win) w++; else f+=r.fails; ts.push(r.t); }
    out.push({floor:fl, win:w, n:trials, avg:ts.reduce((a,b)=>a+b,0)/trials, fails:f}); }
  return out; }, floors, policy, trials);

const FLOORS=[8,12,16,20,24];
const LV=40;
// 🎯 사거리별로 잰다 — 기본 사거리 34 vs 적이 때리는 거리 30 이라, 사거리를 안 올리면
//    카이팅할 공간이 **물리적으로 없다**. "직접이 유리한가"는 사거리 투자에 달려 있다.
const RNG_LV=[0,10,20,30];
console.log('════ A7 · 직접(카이팅) vs 자동(제자리) ════');
console.log(`캐릭터 Lv.${LV} · atk30/hp30/aspd10/crit10 · 단계당 ${TRIALS}판`);
console.log('사거리 = 34 + 4×Lv (HB_STOP=30 = 적이 멈춰 때리는 거리)\n');
for(const rl of RNG_LV){
  const UPG={atk:30,hp:30,aspd:10,crit:10,rng:rl};
  await page.evaluate((lv,upg)=>__B.setup(lv,upg), LV, UPG);
  const rng=await page.evaluate(()=>Math.round(csVal('range')));
  const auto=await bench(FLOORS,'stand',TRIALS);
  const kite=await bench(FLOORS,'kite',TRIALS);
  console.log(`── 사거리 Lv.${rl} (사거리 ${rng} · 여유 ${rng-30}) ──`);
  console.log('단계 |   자동 클리어  |   직접 클리어  |  차이  | 시간초과(자동/직접)');
  console.log('-----+----------------+----------------+--------+--------------------');
  for(let i=0;i<FLOORS.length;i++){ const a=auto[i], k=kite[i];
    const ap=a.win/a.n*100, kp=k.win/k.n*100;
    console.log(String(a.floor).padStart(4)+' | '
      +(a.win+'/'+a.n).padStart(6)+' '+(ap.toFixed(0)+'%').padStart(6)+' | '
      +(k.win+'/'+k.n).padStart(6)+' '+(kp.toFixed(0)+'%').padStart(6)+' | '
      +(((kp-ap)>=0?'+':'')+(kp-ap).toFixed(0)+'%p').padStart(6)+' | '
      +String(a.fails).padStart(8)+' / '+k.fails); }
  console.log(''); }
// ══ A6 · 토벌 단계 n 이 사냥터 라운드 n 과 견줘 어느 정도인가 ══
// 같은 캐릭터로 사냥터 라운드 n 을 돌려 '웨이브 3개를 시간 안에 비우는가'를 본다.
await page.evaluate(()=>{
  __B.hunt=function(round, maxS){
    const S=HBS.hunt; if(!S) return null;
    const was={round:S.round, wave:S.wave, phase:S.phase, foes:S.foes.slice(), pend:S.pend.slice(),
      hp:S.char.hp, t:S.t, manual:S.manual};
    try{
      S.manual=true; S.round=round; S.wave=1; S.phase='fight'; S.waveT=hbWaveTime(1);
      S.foes.length=0; S.pend.length=0; S.char.hp=S.char.hpMax; S.char.hitT=9; S.char.tx=null;
      hbWith('hunt', ()=>{ hbSpawnWave(); });
      const dt=0.05, cap=Math.round((maxS||120)/dt); let res=null;
      hbWith('hunt', ()=>{ for(let i=0;i<cap;i++){ hbStep(dt);
        if(S.phase==='clearWait'){ res='clear'; break; }
        if(S.phase==='down'){ res='die'; break; }
        if(S.phase==='fail'){ res='timeout'; break; } } });
      return res||'timeout';
    } finally{ S.round=was.round; S.wave=was.wave; S.phase=was.phase;
      S.foes.length=0; S.pend.length=0; S.char.hp=was.hp; S.t=was.t; S.manual=was.manual; } }; });
console.log('════ A6 · 토벌 단계 n  vs  사냥터 라운드 n ════');
{ const UPG={atk:30,hp:30,aspd:10,crit:10};
  await page.evaluate((lv,upg)=>__B.setup(lv,upg), LV, UPG);
  await page.evaluate(()=>{ openHome(); });
  await new Promise(r=>setTimeout(r,700));
  const R=[8,12,16,20];
  const dg=await bench(R,'stand',TRIALS);
  const hunt=await page.evaluate((R,n)=>{ const out=[];
    for(const r of R){ let w=0; for(let i=0;i<n;i++){ if(__B.hunt(r,120)==='clear') w++; } out.push({round:r,win:w,n:n}); }
    return out; }, R, TRIALS);
  console.log('n   | 토벌 단계 n(자동) | 사냥터 라운드 n');
  console.log('----+-------------------+-----------------');
  for(let i=0;i<R.length;i++) console.log(String(R[i]).padStart(3)+' | '
    +((dg[i].win/dg[i].n*100).toFixed(0)+'%').padStart(11)+'        | '
    +((hunt[i].win/hunt[i].n*100).toFixed(0)+'%').padStart(6));
  console.log(''); }

// ══ A5 · 일반 토벌 재화가 사냥터 방치 수입을 압도하지 않는가 ══
console.log('════ A5 · 일반 토벌 보상  vs  사냥터 방치 수입 ════');
console.log(await page.evaluate(()=>{
  const S=HBS.hunt; if(!S) return '사냥터 세션 없음';
  const p=PROF(), was=S.manual; S.manual=true;
  const T=600;                                   // 사냥터를 10분(시뮬) 돌린다
  const m0=p.pcoin, g0=p.gas;
  hbWith('hunt', ()=>{ const dt=0.05; for(let i=0;i<T/dt;i++) hbStep(dt); });
  S.manual=was;
  const dm=p.pcoin-m0, dg2=p.gas-g0;
  const perMin=dm/(T/60);
  const rows=[ '사냥터 방치: '+Math.round(dm).toLocaleString()+' M + '+Math.round(dg2).toLocaleString()+' G / 10분'
             + '  →  분당 '+Math.round(perMin).toLocaleString()+' M' ];
  rows.push('');
  rows.push('단계 | 일반 토벌 1회 |  하루 2회분  | = 사냥터 몇 분?');
  rows.push('-----+---------------+--------------+----------------');
  for(const fl of [8,12,16,20]){ const r=dgFloorReward(fl,'normal');
    const day=r.pc*2;
    rows.push(String(fl).padStart(4)+' | '+Math.round(r.pc).toLocaleString().padStart(9)+' M | '
      +Math.round(day).toLocaleString().padStart(10)+' M | '
      +(perMin>0? (day/perMin).toFixed(1)+'분' : '—')); }
  return rows.join('\n'); }));

if(errs.length) console.log('\n⚠ 페이지 오류: '+errs.slice(0,3).join(' | '));
await browser.close(); server.close();
