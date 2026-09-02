/* ============================================================================
 * tree-shot.mjs — 🌌 환생 트리를 눈으로 본다 (2026-09-02)
 *
 * ⚠ 이 프로젝트는 연출·배치를 숫자로만 좇다가 여러 번 헛짚었다(DESIGN.md §5.5).
 *   트리는 **밀고 확대하는 화면**이라 더욱 그렇다 — 프레임을 저장해서 본다.
 *
 * 사용: CHROME_PATH=... node scripts/tree-shot.mjs [출력폴더]
 *   찍는 것: ① 첫 회차(별 다섯) ② 포인트 있음 ③ 별 고름(시트) ④ 많이 산 뒤
 *            ⑤ 전체 보기 ⑥ 환생 화면
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const OUT=process.argv[2]||path.join(ROOT,'docs/mock');
fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 let f=path.join(ROOT,p==='/'?'sc-ums-web.html':p); if(!f.startsWith(ROOT)){s.writeHead(403);return s.end();}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME=process.env.CHROME_PATH;
if(!CHROME||!fs.existsSync(CHROME)){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',protocolTimeout:300000,
  args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:2});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof campTreeOpen==="function"',{timeout:30000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const shot=async(name)=>{ const f=path.join(OUT,'tree-'+name+'.png');
  await pg.screenshot({path:f}); console.log('  📸 '+path.relative(ROOT,f)); };

await pg.evaluate(async()=>{
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','샷');
  campState().race='terran'; saveMeta(); openHome();
  await new Promise(r=>setTimeout(r,500));
});
await sleep(600);

// ① 첫 회차 — 포인트 0
await pg.evaluate(()=>{ const C=campState(); C.rbPts=0; C.rbTree={}; campTreeOpen(); });
await sleep(900); await shot('1-첫회차');

// ② 포인트가 생겼다 — 살 수 있는 별이 빛나야 한다
await pg.evaluate(()=>{ campState().rbPts=40; campTreeRender(); });
await sleep(500); await shot('2-포인트40');

// ③ 별을 골랐다 — 아래 시트
const sel=await pg.evaluate(()=>{ campTreeTap('root',1); return JSON.stringify(_campTreeSel); });
await sleep(900); await shot('3-별고름'); console.log('  고른 별: '+sel);

// ④ 시작점 + 갈래 몇 개를 산 뒤
await pg.evaluate(()=>{ const C=campState(); C.rbPts=1e6; C.rbTree={};
  campRtBuy('root');
  for(let i=0;i<40;i++){ let best=null,bc=Infinity;
    for(const L of CAMP_RT_LINES){ if(!campRtCanBuy(L.k)) continue;
      const c=campRtCost(L.k,campRtNext(L.k)); if(c<bc){bc=c;best=L.k;} }
    for(const b of Object.keys(CAMP_TREE_BR)){ const k='br:'+b;
      if(campRtCanBuy(k)&&campRtKeyCost(k)<bc){ bc=campRtKeyCost(k); best=k; } }
    if(!best) break; campRtBuy(best); }
  campTreeDesel(); campTreeRender(); campTreeFit(true); });
await sleep(900); await shot('4-많이산뒤');

// ⑤ 전부 사면 — 별자리 전체 모양
await pg.evaluate(()=>{ const C=campState(); C.rbPts=1e12; C.rbTree={root:1};
  for(const b of Object.keys(CAMP_TREE_BR)) C.rbTree['br:'+b]=1;
  for(const b of Object.keys(CAMP_TREE_BR)) for(const g of CAMP_RT_GRP_KEYS) C.rbTree['gp:'+b+g]=1;
  for(const L of CAMP_RT_LINES) C.rbTree[L.k]=campRtMax(L.k);
  campTreeDesel(); campTreeRender(); campTreeFit(true); });
await sleep(900); await shot('5-전부산뒤');

// ⑥ 환생 화면
await pg.evaluate(()=>{ campTreeClose(); const C=campState();
  C.earn=3.2e6; C.dg=2; C.cleared=17; C.tapped=1240; C.earnTap=8.2e5; C.earnAuto=2.4e6;
  C.earnGas=12000; C.playS=11520; campRebOpen(); });
await sleep(900); await shot('6-환생화면');

console.log(errs.length?('\n⛔ 예외:\n  '+errs.join('\n  ')):'\n✅ 예외 없음');
await b.close(); server.close();
