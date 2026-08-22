/* ============================================================================
 * 종족 상성(오각형) 측정 — `node test/race-matchup.mjs [판수] [테크깊이] [종족...] [배율...] [대전...]`
 *
 * ⚠ **모델을 새로 만들지 말 것.** RACES.md §7 은 자체 시뮬을 3번 폐기했고, 4번째도 실제 엔진과
 *   어긋났다(웨이브 모델은 건물 '비용'으로 테크를 재는데, 오토배틀은 양 진영이 **같은 건물 수**로 배출한다).
 *   여기서는 브라우저에 진짜 게임을 올려 **strikeStep 을 그대로 돌리고 승패만 읽는다**(BALANCE.md §4 와 같은 원칙).
 *
 * 무엇을 통제하는가
 *   · 소환   = strikeSpawnForPlayer 의 원격/AI 분기와 같은 식(TECH_BLDG_UNIT 앞에서부터 PB채 배출).
 *              PB(테크 깊이) 2~7 을 전부 돌아 "어느 단계에서 뒤집히는지"까지 본다 — 상성은 단계 의존이 크다.
 *   · 경제   = strikeAiEconomy 무력화 · 광산/강화 0 고정(양측 동일 조건)
 *   · 진영   = 판마다 me/ai 를 바꿔 절반씩 — 진영 편향 상쇄
 *   · 승패   = STK.over. 서든데스까지 안 끝나면 남은 메인 신전 체력 비율로 판정
 *
 * 인자
 *   판수      한 (대전 × 테크깊이) 당 판 수. 기본 3 → 대전당 18판
 *   테크깊이  기본 PB(대전 목록을 지정했을 때만 의미). 기본 6
 *   종족      쉼표 목록으로 부분 집합만(예: union,swarm,aetherial)
 *   배율      STK_RACE_STAT/SPAWN 임시 덮어쓰기(예: swarm=0.95,s:feral=1.2) — 파일을 고치기 전에 값을 훑을 때
 *   대전      쉼표 목록(예: feral:colossus,colossus:union) — 특정 변만 다시 잴 때
 *
 * 예)  CHROME_PATH=... node test/race-matchup.mjs 5
 *      CHROME_PATH=... node test/race-matchup.mjs 3 6 "" "swarm=0.95" "feral:colossus"
 * ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CHROME=[ 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.CHROME_PATH||'' ]
  .filter(Boolean).find(p=>fs.existsSync(p));
if(!CHROME){ console.error('크롬을 찾을 수 없습니다. CHROME_PATH 환경변수로 지정하세요.'); process.exit(2); }

const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary',
  '.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{ try{
  const p=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const f=path.join(ROOT, p==='/'?'sc-ums-web.html':p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('not found'); }
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res); }catch(e){ res.writeHead(500); res.end(String(e)); } });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PORT=server.address().port;

const N=+(process.argv[2]||3), WN=+(process.argv[3]||6);
const ONLY=(process.argv[4]||'').split(',').filter(Boolean);
const OVR={}, SOVR={};
(process.argv[5]||'').split(',').filter(Boolean).forEach(kv=>{ const [k,v]=kv.split('=');
  if(k.startsWith('s:')) SOVR[k.slice(2)]=+v; else OVR[k]=+v; });
const PAIRS=(process.argv[6]||'').split(',').filter(Boolean).map(x=>x.split(':'));

// ⚠ protocolTimeout:0 — 전 대전을 한 번의 evaluate 로 돌린다(기본 180초로는 못 끝낸다)
const browser=await puppeteer.launch({ executablePath:CHROME, headless:process.env.HEADFUL?false:'new',
  protocolTimeout:0, args:['--mute-audio','--disable-gpu-sandbox','--no-sandbox'] });
let out;
try{
  const page=await browser.newPage(); page.setDefaultTimeout(180000);
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  const errs=[]; page.on('pageerror', e=>errs.push(String(e.message||e).slice(0,200)));
  await page.goto(`http://127.0.0.1:${PORT}/sc-ums-web.html`, {waitUntil:'load'});
  await page.waitForFunction('typeof G!=="undefined" && typeof STK_UNITS!=="undefined"', {timeout:30000});
  out=await page.evaluate((N,WN,ONLY,OVR,PAIRS,SOVR)=>{
    Object.assign(STK_RACE_STAT, OVR); Object.assign(STK_RACE_SPAWN, SOVR);   // 데이터 단일 소스는 저장소 파일. 여기선 스윕용 덮어쓰기만.
    const RK={union:'terran',swarm:'zerg',aetherial:'protoss',feral:'feral',colossus:'colossus'};   // 건설 트리 키 → 직스 종족 키
    let RACES=['union','swarm','aetherial','feral','colossus'];
    if(ONLY.length) RACES=RACES.filter(r=>ONLY.indexOf(r)>=0);
    openModeSheet(USEMAPS.cpu); startGameNow([1,2],1,{1:'me',2:'ai'});
    G.loading=false;
    window.toast=function(){}; window.strikeToast=function(){}; window.playSfx=function(){}; window.playSfxT=function(){};
    window.showOverlay=function(){}; window.strikeAiEconomy=function(){};   // 경제는 양측 동일 조건(0)으로 고정
    const snap=JSON.parse(JSON.stringify({base:STK.me.base, sec:STK.me.sec, central:STK.central}));
    const RRACE={me:'union', ai:'union'};
    let PB=WN;
    function emitFor(side, race){
      const keys=Object.keys(TECH_BLDG_UNIT[race]||{}); if(!keys.length) return;
      for(let i=0;i<PB;i++){ const bk=keys[i%keys.length], uid=techBldgUnit(race,bk); if(!uid) continue;
        const cnt=techBldgCount(race,bk); for(let k=0;k<cnt;k++) strikeSpawnUnit(side, uid); } }
    window.strikeSpawnWave=function(){ emitFor('me', RRACE.me); emitFor('ai', RRACE.ai); };
    function reset(rMe,rAi){ const S=STK;
      S.over=null; G.phase='playing'; S.t=0; S.round=0; S.cycleT=S.cycleTime;
      S.me.units.length=0; S.ai.units.length=0; if(S.shots) S.shots.length=0;
      for(const side of ['me','ai']){ const p=S[side];
        p.race=RK[side==='me'?rMe:rAi]; RRACE[side]=(side==='me'?rMe:rAi);
        p.gold=0; p.mines=0; p.atkLv=0; p.hpLv=0; p.roster=null;
        for(const kk of ['base','sec']){ const t=p[kk]; if(!t) continue;
          t.max=snap[kk].max||snap[kk].hp; t.hp=t.max; t.dead=false; t.deadT=0; }
        p.max=p.base.max; p.hp=p.base.hp; }
      if(S.central){ const c=S.central; c.max=snap.central.max||snap.central.hp; c.hp=c.max; c.dead=false; c.deadT=0; } }
    function run(rMe,rAi){ reset(rMe,rAi); const S=STK; strikeSpawnWave();
      for(let i=0;i<12000;i++){ strikeStep(0.1); if(S.over) break; }   // 0.1초 스텝 × 최대 1200초(서든데스 포함)
      if(S.over==='win') return 1; if(S.over==='lose') return 0;
      const a=S.ai.base.hp/S.ai.base.max, b=S.me.base.hp/S.me.base.max;
      return a<b?1:(a>b?0:0.5); }
    const PBS=[2,3,4,5,6,7], res={}, log=[];
    const plist=PAIRS.length?PAIRS:(function(){ const o=[];
      for(let i=0;i<RACES.length;i++) for(let j=i+1;j<RACES.length;j++) o.push([RACES[i],RACES[j]]); return o; })();
    for(const pr of plist){ const A=pr[0], B=pr[1]; let w=0, tot=0; const per=[];
      for(const pb of PBS){ PB=pb; let pw=0;
        for(let k=0;k<N;k++){ const r=(k%2===0)? run(A,B) : (1-run(B,A)); w+=r; pw+=r; tot++; }
        per.push(pb+':'+Math.round(pw/N*100)); }
      res[A+'>'+B]=w/tot; log.push(A+' vs '+B+'  '+(w/tot*100).toFixed(0).padStart(3)+'%   '+per.join(' ')); }
    return {res, races:RACES, log};
  }, N, WN, ONLY, OVR, PAIRS, SOVR);
  if(errs.length) console.log('⚠ 페이지 예외:', [...new Set(errs)].slice(0,5).join(' | '));
}finally{ await browser.close(); server.close(); }

const R=out.races, M={};
for(const k in out.res){ const [a,b]=k.split('>'); (M[a]=M[a]||{})[b]=out.res[k]; (M[b]=M[b]||{})[a]=1-out.res[k]; }
console.log('\n가로 종족이 세로 종족을 이긴 비율(%)');
console.log('       '+R.map(r=>r.slice(0,5).padStart(7)).join(''));
const avg={};
for(const a of R){ let row=a.slice(0,6).padEnd(7), s=0, c=0;
  for(const b of R){ if(a===b){ row+='      -'; continue; }
    const w=M[a]&&M[a][b]; if(w==null){ row+='      .'; continue; }
    s+=w; c++; row+=(w*100).toFixed(0).padStart(7); }
  avg[a]=c?s/c:0; console.log(row); }
console.log('\n대전별(뒤 숫자 = 테크 깊이별 승률)');
out.log.forEach(l=>console.log('  '+l));
console.log('\n평균 '+R.map(r=>r+':'+(avg[r]*100).toFixed(0)).join('  '));
