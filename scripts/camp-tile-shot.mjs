/* ============================================================================
 * camp-tile-shot.mjs — 🧱 캠프 바닥을 타일로 깔아 본다 (2026-09-10)
 *
 * ⚠ **게임을 고치지 않는다.** 화면 위에서 CSS 만 바꿔 찍는다 — 고르고 나서 심는다.
 * ⭐ 방식은 오토배틀 것 그대로다(js/18-strike.js STK_FLOOR_CELLS · js/16-build.js _floorSt):
 *   타일 한 장이 격자 N칸을 덮고, 격자 원점에 딱 맞춰 깐다. ⛔ 새 방식을 만들지 않는다.
 *
 * 사용: CHROME_PATH=... node scripts/camp-tile-shot.mjs
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
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campState==="function"',{timeout:30000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// 캠프를 띄운다 — ⚠ **부팅이 끝나기를 먼저 기다린다**(scripts/shot.mjs 와 같은 2600ms).
//   먼저 화면을 감추면 부팅이 그 위에 다시 로그인 화면을 세운다(실측: 로그인 화면이 찍혔다).
await sleep(2600);
await pg.evaluate(()=>{ if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','타일');
  try{ const C=campState(); if(C && !C.race) C.race='terran'; }catch(e){}
  try{ showAppScreen('homeScreen'); campOpen(); }catch(e){} });
await sleep(1800);
await pg.evaluate(()=>{ try{ if(typeof campHasRace==='function' && !campHasRace()) campPickRace(); }catch(e){} });
await sleep(1800);
{ const ok=await pg.evaluate(()=>!!document.querySelector('#phone.campMode #cstMain .bmapFloor'));
  if(!ok){ console.error('⛔ 캠프 바닥(.bmapFloor)이 없다 — 캠프가 안 열렸다'); await b.close(); server.close(); process.exit(1); } }

// 격자 값을 읽어 온다 — ⛔ 손으로 박지 않는다
const G=await pg.evaluate(()=>({ x0:TECH_GRID.x0, x1:TECH_GRID.x1, y0:techY0(),
  cols:techCols(), cw:_techCW(), ch:_techCH() }));
const MW=await pg.evaluate(()=>document.getElementById('cstMain').clientWidth);
console.log('격자: '+G.cols+'칸 · 셀 '+(G.cw*100).toFixed(2)+'% ('+(G.cw*MW).toFixed(1)+'px) · 맵 폭 '+MW+'px');
console.log('타일 실제 크기: '+[1,2,4,6,8].map(c=>c+'칸='+(G.cw*MW*c).toFixed(0)+'px').join(' · '));

// 타일을 깐다 — 오토배틀과 같은 계산(타일 1장 = 격자 cells칸)
async function lay(tile, cells, macro){
  await pg.evaluate((tile,cells,macro,G)=>{
    let st=document.getElementById('_tileTest');
    if(!st){ st=document.createElement('style'); st.id='_tileTest'; document.head.appendChild(st); }
    // ⭐ 바닥 요소(.bmapFloor)에는 뷰 변환이 걸려 있다 — 배경을 **요소 비율**로 주면
    //   확대·이동을 저절로 따라간다(오토배틀은 px 로 계산해 매 렌더 다시 넣는다).
    const bw=(G.cw*cells*100).toFixed(4)+'% '+(G.ch*cells*100).toFixed(4)+'%';
    const bp=(G.x0*100).toFixed(4)+'% '+(G.y0*100).toFixed(4)+'%';
    const layers=[ "url('assets/tiles/"+tile+"')" ];
    const sizes=[bw], poss=[bp], reps=['repeat'];
    if(macro){ layers.unshift("url('assets/tiles/auto/macro.webp')"); sizes.unshift('100% 100%'); poss.unshift('0 0'); reps.unshift('no-repeat'); }
    st.textContent='#phone.campMode #cstMain .bmapFloor::before{'
      + 'background-image:'+layers.join(',')+' !important;'
      + 'background-size:'+sizes.join(',')+' !important;'
      + 'background-position:'+poss.join(',')+' !important;'
      + 'background-repeat:'+reps.join(',')+' !important;'
      + 'top:0 !important;' + (macro?'background-blend-mode:soft-light,normal;':'') + '}'
      // ⚠ 바닥에 brightness(.60) 이 걸려 있어 타일 무늬가 안 보인다 — **비교하는 동안만** 걷는다.
      //   ⛔ 실제로 심을 때 이 값을 함부로 바꾸지 말 것(css/30-home.css 에 이유가 적혀 있다).
      + '#phone.campMode #cstMain .bmapFloor{filter:brightness(.86) saturate(.9) !important}';
  }, tile, cells, macro, G);
  await sleep(500);
}
const shot=async(name)=>{ const f=path.join(OUT,'camp-tile-'+name+'.png');
  await pg.screenshot({path:f}); console.log('  📸 '+path.relative(ROOT,f)); };

// ① 지금(그림 한 장) — 견줄 기준
await shot('0-지금');
// ② 타일 크기 비교 — 같은 그림으로
for(const c of [2,4,6,8]){ await lay('auto/ground.webp', c, false); await shot('size-'+c+'칸'); }
// ③ 그림 비교 — **6칸 고정**(2026-09-10 사용자 확정). 있는 타일 전부를 같은 조건으로 본다.
const TILES=['terran_tile_light.webp','installation.webp','space_platform.webp','protoss_floor.webp',
  'badlands.webp','ashworld.webp','desert.webp','auto/pave.webp','auto/ground.webp'];
for(const t of TILES){ await lay(t, 6, false); await shot('tile-'+t.replace(/.*\//,'').replace('.webp','')); }
// ④ 반복감 깨기 — 매크로 얼룩을 얹으면 넓게 볼 때 되풀이가 덜 읽힌다
for(const t of ['terran_tile_light.webp','installation.webp','badlands.webp']){
  await lay(t, 6, true); await shot('macro-'+t.replace(/.*\//,'').replace('.webp','')); }

console.log(errs.length?('\n⛔ 예외:\n  '+errs.join('\n  ')):'\n✅ 예외 없음');
await b.close(); server.close();
