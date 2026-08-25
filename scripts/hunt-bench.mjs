/* ============================================================================
 * hunt-bench.mjs — 캠프 던전 진행 실측 (BALANCE.md §3 기준선)
 *
 * ⚠ 모델로 추정하지 말 것 — BALANCE.md §4 규칙. 실제 hbStep 루프를 돌려서 잰다.
 *   BALANCE.md §4 의 「엔진 자동 플레이」를 브라우저 콘솔이 아니라 헤드리스로 돌린다.
 *
 *   재는 것: 던전 d 를 완주(50라운드 클리어)하는 시점의 **레벨 · 시각 · 환생 횟수**
 *
 * 사용: CHROME_PATH=... node scripts/hunt-bench.mjs [시뮬시간(시간)] [최대던전]
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';

const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const HOURS=+(process.argv[2]||12);
const MAXDG=+(process.argv[3]||5);
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
await page.waitForFunction('typeof hbStep==="function" && typeof openHome==="function"',{timeout:30000});

await page.evaluate(()=>{
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p=PROF(); p.chars.length=0; p.curId=''; p.pcoin=0; p.gas=0;
  PLAYER_META.coins=1e12;                       // 유즈맵 포인트 관문은 이 측정의 주제가 아니다
  p.hunt={dg:1,round:1,climb:true,climbChosen:1,best:{},rw:{},mates:{},party:[],mateN:0,allySlots:0,upg:{},unl:{},dgIn:{}};
  profCreateChar('ranger','시뮬'); saveMeta();
  hbEnd(); openHome();
});
await page.waitForFunction('typeof _hb==="object" && _hb && _hb.on',{timeout:20000});

// ── 시뮬 커널 ──────────────────────────────────────────────────────────────
await page.evaluate((MAXDG)=>{
  _hb.manual=true;
  window.__S={ t:0, reb:0, marks:[], stall:0, lastProg:0, maxDg:MAXDG, done:false };
  // 살 수 있는 것 중 가장 싼 업그레이드를 계속 산다(해금 포함)
  __S.buy=function(){
    for(let guard=0; guard<200; guard++){
      const p=PROF(), have=Math.floor(p.pcoin||0);
      let best=null, bc=Infinity;
      for(const k in HB_UPG){
        const c = hbUpgOwned(k) ? hbUpgCost(k) : HB_UPG[k].u;
        if(c<=have && c<bc){ bc=c; best=k; } }
      if(!best) return;
      if(!hbUpgOwned(best)){ PROF().pcoin-=HB_UPG[best].u; hbHunt().unl[best]=1; }
      else { PROF().pcoin-=hbUpgCost(best); hbHunt().upg[best]=(hbHunt().upg[best]||0)+1; }
    } };
  // 남은 포인트를 공격력에 몰아 찍는다(축 선택은 이 측정의 주제가 아니다)
  __S.spend=function(){ if(lpFree()>0) lpAdd('atk', 999); if(rpFree()>0) rpAdd('atk', 999); };
  __S.tick=function(seconds){
    const dt=0.05, n=Math.round(seconds/dt);
    for(let i=0;i<n;i++){
      hbStep(dt); __S.t+=dt;
      if((i%40)===0){ __S.buy(); __S.spend(); hbSyncChar(0);
        const H=hbHunt(), prog=hbProg(H.dg,H.round);
        // 던전 완주 기록
        for(let d=1; d<=__S.maxDg; d++)
          if((H.best[d]||0)>=HB_ROUND_MAX && !__S.marks.some(m=>m.dg===d))
            __S.marks.push({dg:d, lv:CHAR().level|0, t:__S.t, reb:__S.reb});
        if(__S.marks.some(m=>m.dg===__S.maxDg)){ __S.done=true; return; }
        // 환생 판단 — 진행도가 오래 안 오르고 환생이 가능하면
        if(prog>__S.lastProg){ __S.lastProg=prog; __S.stall=0; } else __S.stall+=2;
        if(__S.stall>600 && profCanRebirth()){
          profRebirth(); __S.reb++; __S.stall=0;
          // ⭐ 환생 뒤 복귀 — 이걸 빼면 매 사이클 1-1부터 걷느라 결과가 통째로 틀어진다
          const HH=hbHunt(); let bd=1; for(const d in HH.best) if((HH.best[d]||0)>0) bd=Math.max(bd,+d);
          hbGoDungeon(bd); hbSetRound(HH.best[bd]||1);
          hbEnd(); openHome(); _hb.manual=true;
        }
      }
    } };
}, MAXDG);

// ── 나눠 돌린다(도구 타임아웃 회피) ────────────────────────────────────────
const CHUNK=300;                       // 시뮬 5분씩
const total=HOURS*3600;
let ran=0;
process.stdout.write(`⏱  시뮬 ${HOURS}시간 · 던전 ${MAXDG} 까지\n`);
while(ran<total){
  const st=await page.evaluate(c=>{ __S.tick(c); const H=hbHunt();
    return {t:__S.t, reb:__S.reb, lv:CHAR().level|0, dg:H.dg, round:H.round, marks:__S.marks, done:__S.done}; }, CHUNK);
  ran=st.t;
  process.stdout.write(`\r   ${(st.t/3600).toFixed(1)}h · Lv${st.lv} · 던전 ${st.dg}-${st.round} · 환생 ${st.reb} · 완주 ${st.marks.length}   `);
  if(st.done){ break; }
}
const fin=await page.evaluate(()=>({marks:__S.marks, t:__S.t, reb:__S.reb, lv:CHAR().level|0,
  dg:hbHunt().dg, round:hbHunt().round, best:hbHunt().best}));
console.log('\n\n■ 던전 완주 (라운드 ' + (await page.evaluate(()=>HB_ROUND_MAX)) + ' 클리어) 시점');
console.log('던전 | 레벨    | 시각   | 환생');
for(const m of fin.marks) console.log(`  ${String(m.dg).padEnd(3)}| ${String(m.lv).padEnd(7)}| ${(m.t/3600).toFixed(1)}h`.padEnd(32)+`| ${m.reb}`);
if(!fin.marks.length) console.log('  (기간 안에 완주 없음)');
console.log(`\n최종: ${(fin.t/3600).toFixed(1)}h · Lv${fin.lv} · 던전 ${fin.dg}-${fin.round} · 환생 ${fin.reb}`);
console.log('최고 기록:', JSON.stringify(fin.best));
if(errs.length) console.log('\n⚠ 페이지 예외 ' + errs.length + '건: ' + errs.slice(0,3).join(' / '));
await browser.close(); server.close();
