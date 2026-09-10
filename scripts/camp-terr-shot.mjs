/* ============================================================================
 * camp-terr-shot.mjs — 🗺 지형층(벽·언덕·램프)을 눈으로 본다 (2026-09-10)
 *
 * ⭐ **왜 필요한가** — 이 프로젝트는 움직임·그림을 숫자로만 좇다가 여러 번 헛짚었다.
 *   지형은 「칸이 맞물리나 / 절벽이 높이로 읽히나」가 전부라 **찍어서 봐야 한다.**
 *
 * 사용: CHROME_PATH=/opt/pw-browsers/chromium node scripts/camp-terr-shot.mjs
 *   → docs/mock/camp-terr-*.png
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'docs/mock'); fs.mkdirSync(OUT,{recursive:true});
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
await pg.waitForFunction('typeof openHome==="function" && typeof campState==="function"',{timeout:30000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(2600);   // ⚠ 부팅이 끝나기를 기다린다 — 먼저 감추면 로그인 화면이 다시 선다
await pg.evaluate(()=>{ try{ TUTO_OFF=true; }catch(e){}   // 🎓 튜토리얼은 화면을 덮고 던전 진입을 되돌린다 — 검사에서는 끈다
  try{ const S=guideState(); if(S){ S.zt=S.zt||{}; for(const t of ZONE_TIPS) S.zt[t.id]=1; } }catch(e){}   // 🗺 구역 안내도 「이미 봤다」로
  if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','지형');
  try{ const C=campState(); if(C && !C.race) C.race='terran'; }catch(e){}
  try{ showAppScreen('homeScreen'); campOpen(); }catch(e){} });
await sleep(2000);
{ const ok=await pg.evaluate(()=>!!document.querySelector('#phone.campMode #cstMain .bmapFloor'));
  if(!ok){ console.error('⛔ 캠프가 안 열렸다'); await b.close(); server.close(); process.exit(1); } }

// 🏰 던전 1 로 들어간다 — 지형은 던전에서만 켜진다(집은 평지다)
//   ⚠ 병력이 0 이면 **한 프레임 만에 전멸 판정**이 나 캠프로 되돌아간다(19-camp _wiped).
//     지형을 보는 것이 목적이므로, 전장이 열린 뒤 **전투 단계만 멈춘다**(게임 코드는 안 고친다).
//   🎲 씨앗을 못박아 네 장이 **같은 지형**을 보게 한다.
await pg.evaluate(()=>{ try{ campEnterDungeon(1); campState().foeSeed=20260910; }catch(e){} });
await sleep(600);
await pg.evaluate(()=>{ try{ window.campCombatStep=function(){}; }catch(e){} });
await sleep(1200);
{ const dg=await pg.evaluate(()=>campDgN());
  if(dg!==1){ console.error('⛔ 던전에 안 들어갔다(dg='+dg+') — 지형은 던전에서만 켜진다'); await b.close(); server.close(); process.exit(1); } }

const info=await pg.evaluate(()=>{
  if(typeof CAMPT==='undefined'||!CAMPT) return {err:'CAMPT 가 없다'};
  const T=CAMPT; let hi=0,wall=0,ramp=0;
  for(let i=0;i<T.h.length;i++){ if(T.h[i])hi++; if(T.w[i])wall++; if(T.r[i])ramp++; }
  const cv=document.querySelector('#cstMain .bmapTerr');
  return { cols:T.cols, rows:T.rows, wy0:+T.wy0.toFixed(3), hi, wall, ramp,
           baked:!!T.bake, bakeW:T.bake?T.bake.width:0, bakeH:T.bake?T.bake.height:0,
           canvas:!!cv, cw:cv?cv.width:0, ch:cv?cv.height:0,
           conn:(typeof campTerrConnected==='function')?campTerrConnected():null };
});
console.log('지형:', JSON.stringify(info));

// ① 들어갔을 때 보이는 화면
await pg.screenshot({path:path.join(OUT,'camp-terr-enter.png')});
// ② 안개를 걷고 **끝까지 축소**해 본다 — 지형 전체가 한 화면에 들어와야 판단이 된다
await pg.evaluate(()=>{ try{ if(G.tech&&G.tech.fog) G.tech.fog.on=false;
  const v=techView(), t=techViewT(); v.zoom=t.zoom=1.0; v.x=t.x=0.5; v.y=t.y=0.16; }catch(e){} });
await sleep(900);
await pg.screenshot({path:path.join(OUT,'camp-terr-nofog.png')});
// ③ 고원 밑변으로 당겨 본다 — 절벽·램프가 높이로 읽히나
await pg.evaluate(()=>{ try{ const v=techView(), t=techViewT();
  v.zoom=t.zoom=2.6; v.x=t.x=0.5; v.y=t.y=-0.13; }catch(e){} });
await sleep(900);
await pg.screenshot({path:path.join(OUT,'camp-terr-cliff.png')});
// ④ 벽 구역
await pg.evaluate(()=>{ try{ const v=techView(), t=techViewT();
  v.zoom=t.zoom=2.2; v.x=t.x=0.5; v.y=t.y=0.02; }catch(e){} });
await sleep(900);
await pg.screenshot({path:path.join(OUT,'camp-terr-wall.png')});
// ⑤ 구운 그림 원본 — 조각이 맞물리는지는 이걸 봐야 정확하다
const bake=await pg.evaluate(()=>{ try{
  if(typeof CAMPT==='undefined'||!CAMPT) return 'ERR:CAMPT 없음';
  if(!CAMPT.bake) return 'ERR:bake 없음';
  return CAMPT.bake.toDataURL('image/png'); }catch(e){ return 'ERR:'+e.message; } });
if(bake.indexOf('ERR:')===0) console.error('⛔ 구운 그림을 못 꺼냈다 — '+bake);
else { fs.writeFileSync(path.join(OUT,'camp-terr-bake.png'), Buffer.from(bake.split(',')[1],'base64'));
  console.log('구운 그림: '+(bake.length/1024|0)+'KB'); }

if(errs.length) console.log('⚠ 페이지 오류:', errs.slice(0,5).join(' | '));
console.log('찍었다 → docs/mock/camp-terr-*.png');
await b.close(); server.close();
