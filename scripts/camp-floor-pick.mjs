/* ============================================================================
 * camp-floor-pick.mjs — 🧱 바닥 타일의 **반복 크기·밝기**를 눈으로 고른다 (2026-09-11)
 *   실제 게임 화면에서 CSS 변수만 바꿔 가며 맵 영역을 잘라 한 장에 붙인다.
 * 사용: CHROME_PATH=... node scripts/camp-floor-pick.mjs [던전번호]
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'docs/mock'); fs.mkdirSync(OUT,{recursive:true});
const DG=+(process.argv[2]||0);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 let f=path.join(ROOT,p==='/'?'sc-ums-web.html':p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME=process.env.CHROME_PATH;
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',protocolTimeout:300000,args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:2});
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof campState==="function"',{timeout:30000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(2600);
await pg.evaluate(()=>{ try{ TUTO_OFF=true; const S=guideState(); if(S){ S.zt=S.zt||{}; for(const t of ZONE_TIPS) S.zt[t.id]=1; } }catch(e){}
  if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','바닥');
  try{ const C=campState(); if(C && !C.race) C.race='terran'; showAppScreen('homeScreen'); campOpen(); }catch(e){} });
await sleep(2000);
if(DG>0){ await pg.evaluate(d=>{ try{ campEnterDungeon(d); }catch(e){} }, DG); await sleep(1500); }

const VARIANTS=[];
for(const px of [120,180,260]) VARIANTS.push({px, br:0.92, nm:px+'px'});
for(const br of [0.78, 1.0, 1.15]) VARIANTS.push({px:180, br, nm:'180px · 밝기 '+br});
const TMP=path.join(OUT,'_fp'); fs.mkdirSync(TMP,{recursive:true});
const names=[];
for(let i=0;i<VARIANTS.length;i++){ const v=VARIANTS[i];
  await pg.evaluate(o=>{ const el=document.getElementById('phone');
    el.style.setProperty('--campTileSz', o.px+'px');
    let st=document.getElementById('_floorBr'); if(!st){ st=document.createElement('style'); st.id='_floorBr'; document.head.appendChild(st); }
    st.textContent='#phone.campMode.tileFloor #cstMain .bmapFloor{filter:brightness('+o.br+') saturate(.92)!important}';
  }, v);
  await sleep(500);
  const el=await pg.$('#cstMain'); const box=await el.boundingBox();
  const f=path.join(TMP, i+'.png');
  await pg.screenshot({path:f, clip:{x:box.x, y:box.y+40, width:box.width, height:Math.min(380, box.height-40)}});
  names.push({src:'/docs/mock/_fp/'+i+'.png', nm:v.nm}); }
// 붙이기는 **빈 페이지**에서 한다(게임 페이지의 스타일이 섞이면 그림이 안 뜬다)
const pg2=await b.newPage(); await pg2.setViewport({width:1180,height:640,deviceScaleFactor:1});
await pg2.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'domcontentloaded'});
await pg2.evaluate(ss=>{
  document.documentElement.innerHTML='<head><meta charset=utf-8></head><body></body>';
  document.body.style.cssText='margin:0;background:#0b0e13;color:#ccc;font:12px sans-serif';
  document.body.innerHTML='<div style="padding:6px 8px">바닥 타일 — 반복 크기와 밝기</div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:0 8px">'
    + ss.map(s=>'<div><img src="'+s.src+'" style="width:100%;display:block"><div style="text-align:center;padding:3px">'+s.nm+'</div></div>').join('')
    +'</div>';
}, names);
await sleep(900);
await pg2.screenshot({path:path.join(OUT,'camp-floor-pick'+DG+'.png'), fullPage:true});
fs.rmSync(TMP,{recursive:true,force:true});   // 🧹 중간 조각은 남기지 않는다
console.log('찍었다 → docs/mock/camp-floor-pick'+DG+'.png');
await b.close(); server.close();
