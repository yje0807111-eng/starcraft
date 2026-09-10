/* ============================================================================
 * camp-worker-shot.mjs — 🧍 일꾼이 **서는 자리**를 시안별로 찍어 견준다 (2026-09-08)
 *
 * ⚠ 3D 라 목업(HTML)으로는 못 본다 — 실제 값을 바꿔 가며 같은 장면을 찍어야 판단이 선다.
 *   값은 TECH_MINE_STAND(채취) · TECH_BUILD_SIDE(건설) 둘(js/16-build.js)이 단일 소스다.
 *
 * 내는 것: 출력폴더/wk-mine-*.png (광맥에 붙어 선 모습) · wk-build-*.png (건물 옆에 선 모습)
 * 사용: node scripts/camp-worker-shot.mjs [출력폴더]
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || path.join(ROOT,'docs','mock');
fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml',
  '.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((q,s)=>{ try{
  const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
  const f=path.join(ROOT,p==='/'?'sc-ums-web.html':p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end(); }
  s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(s);
}catch(e){ s.writeHead(500); s.end(); } });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',process.env.CHROME_PATH||'']
  .filter(Boolean).find(p=>fs.existsSync(p));
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',protocolTimeout:600000,
  args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox']});
const pg=await b.newPage();
await pg.setViewport({width:390,height:844,deviceScaleFactor:3,hasTouch:true,isMobile:true});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
await pg.goto('http://127.0.0.1:'+server.address().port+'/sc-ums-web.html',{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"',{timeout:30000});
await pg.evaluate(()=>{ document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','자리');
  campState().race='terran'; saveMeta(); openHome(); });
await pg.waitForFunction("typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech"
  +" && (G.tech.ents||[]).some(e=>e.type==='bldg')",{timeout:30000});
await new Promise(r=>setTimeout(r,1600));

const crop=async(name,gx,gy,S)=>{
  const r=await pg.evaluate((gx,gy)=>{ const q=_btRect(), s=_techW2S(gx,gy);
    return { cx:q.left+s.x*q.width, cy:q.top+s.y*q.height }; }, gx, gy);
  await pg.screenshot({ path:path.join(OUT,name+'.png'),
    clip:{ x:Math.round(r.cx-S/2), y:Math.round(r.cy-S*0.62), width:S, height:S } });
  console.log('  📸 '+name); };

/* ══ ① 채취 자리 — 광맥 한 덩어리에 일꾼 하나를 붙여 세운다 ══ */
const mine = await pg.evaluate(()=>{
  G.tech.credit=1e9;
  G.tech.ents=(G.tech.ents||[]).filter(e=>e.type!=='worker');
  const m=(G.tech.minerals||[])[Math.floor(((G.tech.minerals||[]).length)/2)];
  if(!m) return null;
  const w={eid:G.tech.eseq++, type:'worker', x:m.x, y:m.y+0.05};
  G.tech.ents.push(w); window.__w=w; window.__m=m;
  return { x:m.x, y:m.y }; });
if(!mine){ console.error('광맥이 없다'); process.exit(1); }
for(const v of [{k:'a',nm:'지금',s:1},{k:'b',nm:'바싹',s:0.35},{k:'c',nm:'조금 떨어져',s:1.7},{k:'d',nm:'많이 떨어져',s:2.6}]){
  await pg.evaluate((s)=>{ TECH_MINE_STAND=s;
    const m=window.__m;
    // ⚠ 프레임 루프(techTick)가 채취 로직으로 일꾼을 도로 끌고 간다 — **매 프레임 못 박는다**.
    if(window.__pin) clearInterval(window.__pin);
    window.__pin=setInterval(()=>{ const w=window.__w; if(!w) return;
      const sp=_techMineSpot(m, m.x, m.y+0.2);      // 아래쪽에서 다가온 것으로 친다
      w.x=sp.x; w.y=sp.y; w.tx=null; w.ty=null; w._wp=null; w._working=true;
      w._gKind='mineral'; w._gEid=m.eid; w._gSt='mine'; w._carry=false;
      w.face=Math.atan2(m.x-w.x, m.y-w.y); }, 25);
    const t=techViewT(); t.zoom=techMaxZoom(); t.x=m.x; t.y=m.y; _techClampView(t);
    const q=techView(); q.zoom=t.zoom; q.x=t.x; q.y=t.y; }, v.s);
  await new Promise(r=>setTimeout(r,850));
  await crop('wk-mine-'+v.k, mine.x, mine.y, 150);
}

/* ══ ② 건설 자리 — 건물 하나를 세우고 그 옆에 일꾼을 붙인다 ══ */
const bld = await pg.evaluate(()=>{
  TECH_MINE_STAND=1; if(window.__pin){ clearInterval(window.__pin); window.__pin=null; }
  const race=G.tech.race, bl=(TECH_TREE[race].buildings||[]).filter(x=>!x.addonTo&&!x.evolveOnly);
  const bk=(bl.find(x=>x.k==='barracks')||bl[3]||bl[1]).k;
  G.tech.ents=(G.tech.ents||[]).filter(e=>e.type!=='worker');
  const e={eid:G.tech.eseq++, type:'bldg', bk, x:0.32, y:0.62, bt:12, _bpause:false};
  G.tech.ents.push(e);
  const w={eid:G.tech.eseq++, type:'worker', x:0.32, y:0.70, build:e.eid, _working:true};
  G.tech.ents.push(w); window.__b=e; window.__w=w;
  if(window.M3D&&M3D.cstEnsure) M3D.cstEnsure([(TECH_MODEL[race]||{})[bk]].filter(Boolean));
  return { x:e.x, y:e.y }; });
await new Promise(r=>setTimeout(r,2200));
for(const v of [{k:'a',nm:'지금',s:0.6},{k:'b',nm:'발판 가장자리',s:1.0},{k:'c',nm:'조금 바깥',s:1.35},{k:'d',nm:'안쪽 깊이',s:0.3}]){
  await pg.evaluate((s)=>{ TECH_BUILD_SIDE=s;
    const b=window.__b, w=window.__w;
    const sd=_techBldgSide(b, 2);                   // 아래쪽 면
    w.x=sd.x; w.y=sd.y; w.tx=null; w.ty=null; w._wp=null; w._working=true;
    w.face=Math.atan2(b.x-w.x, b.y-w.y);
    const t=techViewT(); t.zoom=techMaxZoom(); t.x=b.x; t.y=b.y+0.02; _techClampView(t);
    const q=techView(); q.zoom=t.zoom; q.x=t.x; q.y=t.y; }, v.s);
  await new Promise(r=>setTimeout(r,850));
  await crop('wk-build-'+v.k, bld.x, bld.y+0.02, 200);
}
console.log(errs.length?('errs: '+errs.join(' | ')):'errs: 없음');
await b.close(); server.close();
