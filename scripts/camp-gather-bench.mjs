/* ============================================================================
 * camp-gather-bench.mjs — 일꾼 축 실측 (BALANCE.md §4 방식 · 2026-08-24)
 *
 * ⚠ 모델로 추정하지 말 것. 실제 techTick 을 돌려 「일꾼 n기 → 초당 수입」을 잰다.
 *
 * 광맥 한 덩이에 붙는 인원(res.cap)이 수입에 어떻게 걸리는지 본다.
 *   cap 1 = 관리자 탭·오토배틀(기존 단일 락)
 *   cap 5 = 캠프(HUNT_R1 §1 — 5기까지 제 속도, 초과분마다 왕복 +5%)
 *
 * 사용: node scripts/camp-gather-bench.mjs
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
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
if(!CHROME){ console.error('크롬 없음'); process.exit(2); }
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
  args:['--mute-audio','--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:1});
pg.on('pageerror',e=>console.error('  ⚠ '+String(e.message).slice(0,120)));
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campState==="function"',{timeout:30000});
const res=await pg.evaluate(async()=>{
  authGuest(); await new Promise(r=>setTimeout(r,2500));
  const C=campState(); C.race=null; C.ents=[]; C.minerals=[]; saveMeta();
  openHome(); await new Promise(r=>setTimeout(r,300));
  campRaceSel('terran'); campPickRace(); await new Promise(r=>setTimeout(r,1500));
  const T=G.tech, base=T.ents.find(e=>e.type==='bldg');
  const cw=_techCW(), ch=_techCH();
  const setW=n=>{ T.ents=T.ents.filter(e=>e.type!=='worker');
    for(let i=0;i<n;i++) T.ents.push({eid:T.eseq++,type:'worker',   // ⚠ 셀 간격 이상으로 벌린다(겹치면 서로 밀어내느라 못 간다)
      x:base.x+((i%8)-4)*cw*1.2, y:base.y+ch*3+Math.floor(i/8)*ch*1.2});
    if(typeof campAutoGather==='function') campAutoGather(); };
  const run=s=>{ const c0=T.credit; for(let t=0;t<s;t+=0.05) techTick(0.05); return (T.credit-c0)/s; };
  const rows=[]; let jam=null;
  for(const cap of [1,5]) for(const n of [6,12,20,40]){
    setW(n); for(const m of T.minerals) m.cap=cap;
    run(90); const _r=+run(60).toFixed(1); rows.push({cap,n,rate:_r});
    if(_r===0 && !jam){                       // 🩺 수입 0 = 관리자 탭 버그 — 그 순간 일꾼 상태를 찍는다
      const st={};
      for(const w of T.ents){ if(w.type!=='worker') continue;
        const k=(w._gKind||'none')+'/'+(w._gSt||'-')+(w._carry?'+carry':''); st[k]=(st[k]||0)+1; }
      jam={ cap, n, states:st,
        nodes:T.minerals.map(m=>({ miner:m.miner==null?'-':m.miner, n:(m._miners&&m._miners.length)|0 })),
        sample:T.ents.filter(w=>w.type==='worker').slice(0,3).map(w=>({
          kind:w._gKind, st:w._gSt, carry:!!w._carry, working:!!w._working,
          pos:(+w.x.toFixed(3))+','+(+w.y.toFixed(3)),
          spot:w._gSpot?((+w._gSpot.x.toFixed(3))+','+(+w._gSpot.y.toFixed(3))):null,
          dist:w._gSpot?+Math.hypot(w._gSpot.x-w.x, w._gSpot.y-w.y).toFixed(4):null })) };
    }
  }
  return { jam, 광맥:T.minerals.length, cap상수:(typeof CAMP_MINE_CAP!=='undefined'?CAMP_MINE_CAP:null), rows };
});
console.log('광맥 '+res.광맥+'덩이 · CAMP_MINE_CAP='+res.cap상수+'\n');
console.log('cap  일꾼   초당수입   일꾼당');
for(const r of res.rows) console.log(String(r.cap).padStart(3)+String(r.n).padStart(6)
  +String(r.rate).padStart(11)+String((r.rate/r.n).toFixed(2)).padStart(9));
const c1=res.rows.filter(r=>r.cap===1), c5=res.rows.filter(r=>r.cap===5);
if(res.jam){ const J=res.jam;
  console.log('');
  console.log('🩺 수입 0 인 조합: cap'+J.cap+' 일꾼 '+J.n+'기');
  console.log('  일꾼 상태 '+JSON.stringify(J.states));
  console.log('  광맥 점유 '+JSON.stringify(J.nodes));
  for(const w of J.sample) console.log('  샘플 '+JSON.stringify(w));
}
console.log('\ncap1 천장 '+Math.max(...c1.map(r=>r.rate))+'/초 · cap5 최대 '+Math.max(...c5.map(r=>r.rate))+'/초');
await b.close(); server.close();
