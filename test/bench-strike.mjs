/* ============================================================================
 * 대규모 전투 렌더 벤치 — `node test/bench-strike.mjs [유닛수] [프레임수]`
 * 직스(오토배틀) 맵에 유닛을 강제 소환하고, 프레임 시간을
 *   총 프레임(rAF 간격) / 로직(strikeStep) / 3D(M3D.sync)
 * 로 나눠 중앙값을 출력한다.
 *
 * ⚠ 실제 GPU가 필요하므로 창을 띄운다(headful). 창을 다른 창으로 가리면
 *   컴포지팅이 멈춰 측정값이 왜곡된다(ARCHITECTURE §10).
 * ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CHROME=[
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH||'',
].filter(Boolean).find(p=>fs.existsSync(p));
if(!CHROME){ console.error('크롬을 찾을 수 없습니다. CHROME_PATH 환경변수로 지정하세요.'); process.exit(2); }

const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary',
  '.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  try{
    const p=decodeURIComponent(new URL(req.url,'http://x').pathname);
    const f=path.join(ROOT, p==='/'?'sc-ums-web.html':p);
    if(!f.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
    if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  }catch(e){ res.writeHead(500); res.end(String(e)); }
});

const N=+(process.argv[2]||400), FRAMES=+(process.argv[3]||100), REPS=+(process.argv[4]||3);
// 비교 조건 — mix = 애니/스켈레톤 갱신 분산(1=매 프레임 = 최적화 전, 3=3프레임에 1회)
const CONF=process.env.LOWPOLY   // 삼각형 수가 병목인지 판별: 전 유닛을 저폴리 모델로 강제(드로우콜은 그대로)
  ? [{name:'현행 모델(평균 ~1만 tri)', mix:3}, {name:'저폴리 모델 강제(~2천 tri)', mix:3, forceId:'dark_templar'}]
  : process.env.BONEVIS
  ? [{name:'본 순회 포함', mix:3, bone:1}, {name:'본 순회 제외', mix:3, bone:0}]
  : [{name:'최적화 전(매 프레임 갱신 + 본 순회)', mix:1, bone:1},
     {name:'적용 후(애니 분산 + 본 순회 제외)', mix:3, bone:0}];
// BENCH_URL을 주면 이미 떠 있는 개발 서버를 그대로 쓴다(내장 서버 안 띄움) — 지금 돌고 있는 그 빌드를 재려는 경우
const EXT_URL=process.env.BENCH_URL||'';
if(!EXT_URL) await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PAGE_URL=EXT_URL || `http://127.0.0.1:${server.address().port}/sc-ums-web.html`;
const browser=await puppeteer.launch({ executablePath:CHROME, headless:false,
  args:['--mute-audio','--no-sandbox','--window-size=430,900','--window-position=40,40'] });
let out=null;
try{
  const page=(await browser.pages())[0]||await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  const errs=[];   // 셰이더 컴파일 실패·예외는 여기로 — 조용히 실물 모델로 폴백돼 버리면 못 알아채므로 반드시 출력
  page.on('pageerror', e=>errs.push('예외: '+String(e.message||e).slice(0,300)));
  page.on('console', m=>{ if(m.type()==='error') errs.push('콘솔: '+m.text().slice(0,300)); });
  process.on('exit', ()=>{ const seen=new Set();
    for(const e of errs){ const k=e.slice(0,120); if(seen.has(k)) continue; seen.add(k); console.log('  ⚠ '+e); } });
  console.log("  대상:", PAGE_URL);
  await page.goto(PAGE_URL, {waitUntil:"load"});
  await page.waitForFunction('typeof G!=="undefined" && window.M3D && M3D.ready && M3D.ready()', {timeout:60000});
  await new Promise(r=>setTimeout(r,1200));

  // ── 직스 진입 + 유닛 강제 소환 ──
  await page.evaluate(n=>{
    openModeSheet(USEMAPS.cpu); startGameNow([1,2],1,{1:'me',2:'ai'});
    G.loading=false; G.opt=G.opt||{}; G.opt._aqOff=true; G.opt.resScale=1;   // 자동 화질 조절 off = 프레임 비교 조건 고정
    for(let i=0;i<n/2;i++){ strikeSpawnUnit('me'); strikeSpawnUnit('ai'); }
    if(window.M3D&&M3D.loadMapModels) M3D.loadMapModels('cpu', ()=>{ window.__mdl=1; });
  }, N);
  await page.waitForFunction('window.__mdl===1', {timeout:90000}).catch(()=>{});
  // 정상 상태 고정: 무적 + 부족분 재소환 → 측정 내내 유닛 수가 일정(런마다 조건 동일)
  await page.evaluate(n=>{ window.__hold=setInterval(()=>{ if(typeof STK==='undefined'||!STK) return;   // STK는 let — window.STK로는 못 본다
    for(const s of ['me','ai']){ const arr=STK[s].units;
      for(const u of arr){ u.hp=u.maxHp; u.dead=false; }
      while(arr.length<n/2) strikeSpawnUnit(s); } }, 120); }, N);
  await new Promise(r=>setTimeout(r,4000));   // 모델 생성/워밍업

  // 한 페이지 안에서 조건을 번갈아 측정(A/B/A/B…) → 머신 상태·유닛 수 드리프트가 양쪽에 똑같이 실린다
  await page.evaluate(()=>{
    const PROBE=['strikeStep','strikeDrawMain','strikeHud','strikeLeaderboard'];
    window.__pass=(frames)=>new Promise(res=>{
      const raf=[], acc={}, orig={};
      for(const k of PROBE){ if(typeof window[k]!=='function') continue; acc[k]=[]; orig[k]=window[k];
        window[k]=(function(k,f){ return function(){ const t=performance.now(); const r=f.apply(this,arguments); acc[k].push(performance.now()-t); return r; }; })(k, orig[k]); }
      const y0=M3D.sync.bind(M3D); acc['M3D.sync']=[]; acc['  ├ sync JS루프']=[]; acc['  ├ 월드행렬 갱신']=[]; acc['  └ renderer.render']=[];
      let _lastCalls=null, _lastTris=null, _objs=null, _bones=null;
      if(M3D.prof) M3D.prof(true);
      M3D.sync=function(){ const t=performance.now(); const r=y0.apply(null,arguments); acc['M3D.sync'].push(performance.now()-t);
        const p=M3D.prof&&M3D.prof(); if(p&&p.loop!=null){ acc['  ├ sync JS루프'].push(p.loop); acc['  ├ 월드행렬 갱신'].push(p.mw||0); acc['  └ renderer.render'].push(p.render);
          _lastCalls=p.calls; _lastTris=p.tris; _objs=p.objs; _bones=p.bones; } return r; };
      let last=performance.now(), n=0;
      (function tick(){ const now=performance.now(); raf.push(now-last); last=now;
        if(++n<frames) return requestAnimationFrame(tick);
        for(const k of PROBE) if(orig[k]) window[k]=orig[k];
        M3D.sync=y0; if(M3D.prof) M3D.prof(false);
        const med=a=>{ const b=a.slice(10).sort((x,y)=>x-y); return b.length?+b[b.length>>1].toFixed(2):null; };
        const parts={}; for(const k in acc) parts[k]=med(acc[k]);
        res({ frameMs:med(raf), parts, models:(M3D.dbg?M3D.dbg().n:null), units:STK.me.units.length+STK.ai.units.length,
              calls:_lastCalls, tris:_lastTris, objs:_objs, bones:_bones });
      })();
    });
  });
  const hist=await page.evaluate(()=>{ const h={}; let mv=0;
    for(const s of ['me','ai']) for(const u of STK[s].units){ h[u.id]=(h[u.id]||0)+1; if(u.moving) mv++; }
    return {h, moving:mv, race:{me:STK.me.race, ai:STK.ai.race}}; });
  console.log('  유닛 구성:', JSON.stringify(hist.race), '이동중', hist.moving,
    Object.entries(hist.h).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join(' '));
  if(process.env.SHOT){ await page.evaluate(()=>{ if(typeof hideAppScreens==='function') hideAppScreens();   // 로딩/맵선택 오버레이 치우고 전장만 보이게
      for(const id of ['loadingScreen','gsCount','mapSelect']){ const e=document.getElementById(id); if(e) e.classList.add('hide'); }
      const u=STK.ai.units.find(x=>x.id==='blade')||STK.ai.units[0];
      if(u){ STK.cam.x=u.x; STK.cam.y=u.y; } STK.viewWorld=700; });   // 유닛에 바짝 붙여 모델·부착물(워든 쌍검 등) 확인
    // 시뮬을 멈추고 3배 해상도로 한 장 찍는다(픽셀 비교용)
    // 카메라가 두 샷 사이에 흐르면 비교가 무의미해지므로 고정한다(viewWorld는 매 프레임 목표값으로 보간됨)
    if(process.env.FORCEID){ await page.evaluate(id=>{ for(const s of ['me','ai']) for(const u of STK[s].units) u.id=id;
      M3D.clearGameModels(); }, process.env.FORCEID); await new Promise(r=>setTimeout(r,2500)); }
    await page.evaluate(()=>{ G.loading=true;
      if(window.__hold){ clearInterval(window.__hold); window.__hold=null; }   // 정상상태 유지용 재소환도 멈춘다 — 두 샷 사이에 유닛이 늘면 비교가 무의미
      const u=STK.ai.units[0]; if(u){ STK.cam.x=u.x; STK.cam.y=u.y; }
      STK.userCam=true; STK.lastCam=1e12;
      const vw=STK.viewWorld;   // viewWorld는 매 프레임 목표값으로 보간된다 → 고정하지 않으면 두 샷의 줌이 달라진다
      window.__camPin=setInterval(()=>{ if(!STK) return; STK.userCam=true; STK.lastCam=1e12;
        STK.viewWorld=vw; if(u){ STK.cam.x=u.x; STK.cam.y=u.y; } }, 16); });
    await page.setViewport({width:390,height:844,deviceScaleFactor:3});
    await new Promise(r=>setTimeout(r,1200));
    await page.screenshot({path:process.env.SHOT});
    // 촬영 때 멈춰둔 것들을 되돌린다 — 안 그러면 뒤이은 측정 패스에서 유닛이 계속 죽어 수가 무너진다
    await page.evaluate(n=>{ G.loading=false;
      if(window.__camPin){ clearInterval(window.__camPin); window.__camPin=null; }
      window.__hold=setInterval(()=>{ if(typeof STK==='undefined'||!STK) return;
        for(const s of ['me','ai']){ const arr=STK[s].units;
          for(const u of arr){ u.hp=u.maxHp; u.dead=false; }
          while(arr.length<n/2) strikeSpawnUnit(s); } }, 120); }, N);
    await new Promise(r=>setTimeout(r,3000));
    await page.setViewport({width:390,height:844,deviceScaleFactor:1});
    console.log('  스크린샷 →', process.env.SHOT); }
  if(process.env.BONECHK){   // 본 순회 제외가 "부착물 있는 모델"을 제대로 비켜 가는지 검증
    const r=await page.evaluate(id=>{ for(const s of ['me','ai']) for(const u of STK[s].units) u.id=id;
      M3D.clearGameModels(); return new Promise(res=>setTimeout(()=>res(M3D.boneVis(false)), 2500)); }, process.env.BONECHK);
    console.log(`  [본 제외 검증] id=${process.env.BONECHK} → 숨긴 본 루트 ${r}개 (검·프롭 부착 모델이면 0이어야 정상)`); }
  if(process.env.PXDBG){ const r=await page.evaluate(()=>{ const a=M3D.dbg().anims.filter(x=>x.px);
      const by={}; for(const x of a){ if(!by[x.id]) by[x.id]=x.px; }
      return {zoom:STK.zoom, viewWorld:Math.round(STK.viewWorld), by}; });
    console.log(`  ▸ 화면상 모델 높이(px) — zoom ${r.zoom} / viewWorld ${r.viewWorld}`);
    console.log('     '+Object.entries(r.by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join(' ')); }
  const runs={};
  for(let rep=0; rep<REPS; rep++){
    for(const c of (rep&1 ? CONF.slice().reverse() : CONF)){   // 회차마다 순서를 뒤집는다 — 전투가 진행될수록 유닛이 뭉쳐 부하가 오르므로, 순서 고정 시 뒤 조건이 항상 손해를 본다
      await page.evaluate(c=>{ if(c.mix!=null && M3D.mixForce) M3D.mixForce(c.mix);
        for(const s of ['me','ai']) for(const u of STK[s].units){ if(u._id0==null) u._id0=u.id; u.id=c.forceId||u._id0; }
        if(M3D.clearGameModels) M3D.clearGameModels(); }, c);   // 모델은 uid로 캐시됨 → id를 바꿨으면 통째로 재생성
      await new Promise(r=>setTimeout(r,1800));
      await page.evaluate(c=>{ if(c.bone!=null && M3D.boneVis) M3D.boneVis(!!c.bone); }, c);   // 모델 재생성 후에 적용(재생성이 기본값으로 되돌리므로)
      const r=await page.evaluate(f=>window.__pass(f), FRAMES);
      (runs[c.name]=runs[c.name]||[]).push(r);
    }
  }
  out=runs;
}finally{ await browser.close(); if(!EXT_URL) server.close(); }

const pick=(arr,f)=>{ const b=arr.map(f).filter(v=>v!=null).sort((x,y)=>x-y); return b.length?+b[b.length>>1].toFixed(2):null; };
console.log(`\n■ 대규모 전투 벤치 (요청 ${N}기 · ${FRAMES}프레임 × ${REPS}회 교대 측정)`);
for(const c of CONF){
  const rs=out[c.name]; if(!rs) continue;
  const frame=pick(rs,r=>r.frameMs);
  console.log(`\n  [${c.name}]  유닛 ${pick(rs,r=>r.units)}기 · 3D ${pick(rs,r=>r.models)}개 · 드로우콜 ${pick(rs,r=>r.calls)} · 삼각형 ${pick(rs,r=>r.tris)}`);
  console.log(`    씬 오브젝트 ${pick(rs,r=>r.objs)}개 (그중 본 ${pick(rs,r=>r.bones)}개)`);
  console.log(`    프레임 중앙값 ${frame}ms  (${(1000/frame).toFixed(1)} FPS)`);
  const keys=Object.keys(rs[0].parts); let sum=0;
  for(const k of keys){ const v=pick(rs,r=>r.parts[k]); if(v==null) continue; if(k[0]!==' ') sum+=v;
    console.log(`      · ${k.padEnd(20)} ${String(v).padStart(7)}ms`); }
  console.log(`      · ${'(그 외/GPU 대기)'.padEnd(18)} ${(frame-sum).toFixed(2).padStart(7)}ms`);
}
