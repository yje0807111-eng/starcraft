/* ============================================================================
 * camp-carry-shot.mjs — 🎒 일꾼이 든 덩어리의 자리를 **시안별로 찍어 견준다** (2026-09-08)
 *
 * ⚠ 3D 라 목업(HTML)으로는 못 본다 — 실제 값을 바꿔 가며 같은 장면을 찍어야 판단이 선다.
 *   값은 TECH_CARRY_FWD / SIDE / YOFF / SCL 넷(js/14-input-fx.js)이 단일 소스다.
 *
 * 내는 것: 시안마다 docs/mock(또는 인자로 준 폴더)/carry-<이름>.png (일꾼 한 명을 바싹 자른 그림)
 * 사용: node scripts/camp-carry-shot.mjs [출력폴더]
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
  const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','운반');
  campState().race='terran'; saveMeta(); openHome(); });
await pg.waitForFunction("typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech"
  +" && (G.tech.ents||[]).some(e=>e.type==='bldg')",{timeout:30000});
await new Promise(r=>setTimeout(r,1600));

/* 🧍 **한 명만 세워 놓고 본다** — 여럿이면 어느 덩어리가 누구 것인지 헷갈린다.
 *   ⚠ 프레임 루프는 살려 둔다(세우면 3D 동기화가 안 돈다 · 2026-09-08 실측). 대신 그 자리에 못 박는다. */
await pg.evaluate(()=>{
  G.tech.credit=1e9;
  G.tech.ents=(G.tech.ents||[]).filter(e=>e.type!=='worker');
  const w={eid:G.tech.eseq++, type:'worker', x:0.30, y:0.70,
    _carry:true, _cKind:'mineral', _gKind:'mineral', face:0.0};
  G.tech.ents.push(w);
  window.__cw=w;
  // 매 프레임 제자리·같은 방향으로 되돌린다(채취 로직이 끌고 가지 않게)
  setInterval(()=>{ const e=window.__cw; if(!e) return;
    e.x=0.30; e.y=0.70; e.face=0.0; e.tx=null; e.ty=null; e._wp=null;
    e._carry=true; e._cKind='mineral'; e._gSt='back'; e._working=false; }, 30);
});
await new Promise(r=>setTimeout(r,900));

const V=[
  { k:'a-now',   nm:'지금 (크고 · 떠 있음)', fwd:0.014, side:0,     yoff:-3,  scl:1    },
  { k:'b-small', nm:'작게만 (0.45)',        fwd:0.014, side:0,     yoff:-3,  scl:0.45 },
  { k:'c-down',  nm:'작게 + 아래로',         fwd:0.010, side:0,     yoff:6,   scl:0.45 },
  { k:'d-hand',  nm:'작게 + 손 앞',          fwd:0.012, side:0,     yoff:2,   scl:0.38 },
  { k:'e-side',  nm:'작게 + 옆구리',         fwd:0.004, side:0.010, yoff:4,   scl:0.38 },
  { k:'f-head',  nm:'작게 + 머리 위',        fwd:0.002, side:0,     yoff:-6,  scl:0.42 },
];
for(const v of V){
  await pg.evaluate((v)=>{
    TECH_CARRY_FWD=v.fwd; TECH_CARRY_SIDE=v.side; TECH_CARRY_YOFF=v.yoff; TECH_CARRY_SCL=v.scl;
    const t=techViewT(); t.zoom=techMaxZoom(); t.x=0.30; t.y=0.70; _techClampView(t);
    const q=techView(); q.zoom=t.zoom; q.x=t.x; q.y=t.y;
  }, v);
  await new Promise(r=>setTimeout(r,900));
  const r=await pg.evaluate(()=>{ const q=_btRect(); const s=_techW2S(0.30,0.70);
    return { cx:q.left+s.x*q.width, cy:q.top+s.y*q.height }; });
  const S=120;   // 자르는 상자(CSS px)
  await pg.screenshot({ path:path.join(OUT,'carry-'+v.k+'.png'),
    clip:{ x:Math.round(r.cx-S/2), y:Math.round(r.cy-S*0.72), width:S, height:S } });
  console.log('  📸 '+v.k+' · '+v.nm);
}
console.log(errs.length?('errs: '+errs.join(' | ')):'errs: 없음');
await b.close(); server.close();
