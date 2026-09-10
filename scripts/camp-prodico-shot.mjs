/* ============================================================================
 * camp-prodico-shot.mjs — 🕐 건물 위 **생산 표시**를 눈으로 보고 자리를 잰다 (2026-09-08)
 *
 * ⚠ 왜 만들었나 — 「건물마다 뜨는 자리가 다르고 줌에서 뜬 정도가 바뀐다」는 신고를 숫자로 좇다가
 *   발자국 기준으로는 차이가 안 보였다. 실제로 그려진 3D 모델과의 관계는 **그림으로 봐야** 한다.
 *
 * 내는 것: ① 줌 두 단계 화면 ② 건물마다 「모델 꼭대기 ↔ 아이콘 아래끝」 틈(px)과 아이콘 크기
 * 고치기 전: 발자국 윗변에 붙어 건물 왼쪽·뒤에 걸쳤다 · 작은 건물은 12px 하한에 걸려 비율이 흔들렸다
 * 고친 뒤:   M3D.topOf(그려진 꼭대기)에 붙고, 크기는 격자 한 칸 기준이라 건물·줌과 무관하게 같다
 *
 * 사용: node scripts/camp-prodico-shot.mjs [출력폴더]   (CHROME_PATH 로 크롬 경로를 덮어쓸 수 있다)
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || path.join(ROOT, 'docs', 'mock');
fs.mkdirSync(OUT, { recursive:true });
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml',
  '.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2' };
const server = http.createServer((q,s)=>{ try{
  const p = decodeURIComponent(new URL(q.url,'http://x').pathname);
  const f = path.join(ROOT, p==='/'?'sc-ums-web.html':p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end(); }
  s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(s);
}catch(e){ s.writeHead(500); s.end(); } });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.CHROME_PATH||'']
  .filter(Boolean).find(p=>fs.existsSync(p));
const b = await puppeteer.launch({ executablePath:CHROME, headless:'new', protocolTimeout:600000,
  args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox'] });
const pg = await b.newPage();
await pg.setViewport({ width:390, height:844, deviceScaleFactor:2, hasTouch:true, isMobile:true });
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
await pg.goto('http://127.0.0.1:'+server.address().port+'/sc-ums-web.html',{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"',{timeout:30000});
await pg.evaluate(()=>{ document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','생산');
  campState().race='terran'; saveMeta(); openHome(); });
await pg.waitForFunction("typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech"
  +" && (G.tech.ents||[]).some(e=>e.type==='bldg')",{timeout:30000});
await new Promise(r=>setTimeout(r,1400));

// 생산 건물 넷을 나란히 세우고 프레임을 세운다(대기열이 소진되지 않게)
const picks = await pg.evaluate(()=>{
  const race=G.tech.race;
  const bl=(TECH_TREE[race].buildings||[]).filter(x=>!x.addonTo&&!x.evolveOnly).slice(0,5);
  G.tech.ents=(G.tech.ents||[]).filter(e=>e.type!=='bldg');
  bl.forEach((x,i)=>{ G.tech.ents.push({ eid:G.tech.eseq++, type:'bldg', bk:x.k, x:0.22+i*0.14, y:0.55, bt:0,
    _pq:[{id:'marine',t:5000,tMax:10000},{id:'marine',t:10000,tMax:10000}] });
    G.tech.built[x.k]=(G.tech.built[x.k]||0)+1; });
  // ⚠ 모델을 **먼저 받아야** 3D 가 그린다 — 안 그러면 M3D.topOf 가 null 이다
  if(window.M3D && M3D.cstEnsure) M3D.cstEnsure(bl.map(x=>(TECH_MODEL[race]||{})[x.k]).filter(Boolean));
  return bl.map(x=>x.k); });
await new Promise(r=>setTimeout(r,2500));

const rows=[];
for(const z of [1.45, 2.0, 2.6]){
  await pg.evaluate((z)=>{ const v=techViewT(); v.zoom=z; v.x=0.5; v.y=0.55; _techClampView(v);
    const vv=techView(); vv.zoom=v.zoom; vv.x=v.x; vv.y=v.y;
    for(const e of (G.tech.ents||[])) if(e.type==='bldg'){ e.bt=0;
      e._pq=[{id:'marine',t:5000,tMax:10000},{id:'marine',t:10000,tMax:10000}]; }
    techMapRender(); }, z);
  await new Promise(r=>setTimeout(r,700));
  await pg.evaluate(()=>techMapRender());
  await new Promise(r=>setTimeout(r,250));
  const got = await pg.evaluate(()=>{
    const r=_btRect(), race=G.tech.race, out=[];
    for(const e of (G.tech.ents||[])){ if(e.type!=='bldg') continue;
      const mk=(TECH_MODEL[race]||{})[e.bk]; if(!mk) continue;
      const top=(window.M3D&&M3D.topOf)?M3D.topOf('cst_'+race+'_'+mk+'_'+e.eid):null;
      const ico=[...document.querySelectorAll('.bprodIco')]
        .map(n=>({n,b:n.getBoundingClientRect()}))
        .sort((a,c)=>Math.abs(a.b.left+a.b.width/2-(r.left+(top?top.x:0.5)*r.width))
                    -Math.abs(c.b.left+c.b.width/2-(r.left+(top?top.x:0.5)*r.width)))[0];
      if(!ico||!top) continue;
      const topPx=r.top+top.y*r.height;
      out.push({ bk:e.bk, zoom:+techView().zoom.toFixed(2), 크기:+ico.b.width.toFixed(1),
        틈:+(topPx-ico.b.bottom).toFixed(1),
        가로어긋남:+((ico.b.left+ico.b.width/2)-(r.left+top.x*r.width)).toFixed(1) }); }
        return out; });
  rows.push(...got);
  await pg.screenshot({ path: path.join(OUT, 'camp-prodico-z'+z+'.png') });
}
for(const z of [...new Set(rows.map(x=>x.zoom))]){
  console.log('\n── 줌 '+z);
  for(const x of rows.filter(y=>y.zoom===z))
    console.log('  '+String(x.bk).padEnd(12)+'크기 '+String(x.크기).padStart(5)
      +'px · 모델 꼭대기와의 틈 '+String(x.틈).padStart(6)+'px · 가로 어긋남 '+String(x.가로어긋남).padStart(6)+'px');
}
console.log(errs.length?('\nerrs: '+errs.join(' | ')):'\nerrs: 없음');
await b.close(); server.close();
