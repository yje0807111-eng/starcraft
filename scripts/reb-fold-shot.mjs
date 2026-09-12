/* ============================================================================
 * reb-fold-shot.mjs — 🎬 환생 구역 「이번 회차」 접기/펴기가 **울컥이는지** 본다
 *   (2026-09-12 · 사용자 신고 「미세하게 울컥울컥한다」)
 *
 * ⭐ 눈이 따라가는 것은 두 가지다:
 *   ① 히어로 카드(.crTopCard)의 **위치** — 접으면 화면 가운데로 내려온다
 *   ② 지표 구역(.crSt)의 **높이** — 요약 ↔ 다섯 줄
 *   울컥 = 그 둘의 **프레임당 이동량이 들쭉날쭉**하다는 뜻이다. 그래서 1차(속도)뿐 아니라
 *   **2차 차분(가속)** 까지 찍는다 — 부드러운 곡선은 가속이 한 번만 부호를 바꾼다.
 *
 * 사용: CHROME_PATH=/opt/pw-browsers/chromium node scripts/reb-fold-shot.mjs
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
  args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox','--use-gl=angle','--enable-unsafe-swiftshader']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:2});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof campRebEnter==="function" && typeof campState==="function"',{timeout:30000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(2600);                                   // 부팅이 끝나기를 기다린다(shot.mjs 와 같은 값)
await pg.evaluate(()=>{ if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','환생');
  try{ const C=campState(); if(C && !C.race) C.race='terran';
    // 값이 0 이면 줄이 짧아 접힘 차이가 안 보인다 — 이번 회차 지표를 채워 둔다
    if(C){ C.tapped=12840; C.earnTap=938400; C.earnAuto=2841000; C.earnGas=48200; C.playS=5230; }
  }catch(e){}
  try{ showAppScreen('homeScreen'); campOpen(); }catch(e){} });
await sleep(1500);
await pg.evaluate(()=>{ campRebEnter('info'); });
await sleep(600);
{ const ok=await pg.evaluate(()=>!!document.querySelector('#campReb .crSt .crFold'));
  if(!ok){ console.error('⛔ 환생 화면이 안 열렸다'); await b.close(); server.close(); process.exit(1); } }

// ── 📏 매 프레임 추적 ───────────────────────────────────────────────────────
//   ⚠ 스크린샷으로 샘플하지 말 것 — 한 장에 100ms 넘게 걸려 늘 「이미 끝났다」만 나온다.
const trace=()=>pg.evaluate(async()=>{
  const st=document.querySelector('#campReb .crSt');
  const card=document.querySelector('#campReb .crTopCard');
  const body=document.querySelector('#campReb .crBody');
  const rows=[]; const t0=performance.now();
  campRebStToggle();
  for(let i=0;i<32;i++){
    rows.push({ t:+(performance.now()-t0).toFixed(1),
                y:+card.getBoundingClientRect().top.toFixed(2),
                h:+st.getBoundingClientRect().height.toFixed(2),
                sc:+body.scrollTop.toFixed(1),
                sh:+body.scrollHeight.toFixed(0), ch:+body.clientHeight.toFixed(0) });
    await new Promise(r=>requestAnimationFrame(r)); }
  return rows; });

function report(name, rows){
  console.log('\n■ '+name);
  const d=(k)=>rows.map(r=>r[k]);
  const diff=a=>a.slice(1).map((v,i)=>+(v-a[i]).toFixed(2));
  const vy=diff(d('y')), vh=diff(d('h'));
  const ay=diff(vy), ah=diff(vh);
  const fmt=a=>a.map(v=>String(v).padStart(7)).join('');
  console.log('  카드 y   '+fmt(d('y').slice(0,18)));
  console.log('   └ 속도  '+fmt(vy.slice(0,18)));
  console.log('   └ 가속  '+fmt(ay.slice(0,18)));
  console.log('  지표 h   '+fmt(d('h').slice(0,18)));
  console.log('   └ 속도  '+fmt(vh.slice(0,18)));
  // 🔎 울컥 지표 — 움직이는 동안 **속도의 부호가 몇 번 뒤집히나**(부드러우면 0)
  const flips=a=>{ let n=0,p=0; for(const v of a){ if(Math.abs(v)<0.3) continue;
    const s=Math.sign(v); if(p && s!==p) n++; p=s; } return n; };
  // 🔎 그리고 **가속이 몇 번 부호를 바꾸나**(easing 하나면 1~2회가 정상 · 많으면 계단)
  console.log('  → 속도 부호 뒤집힘: 카드 '+flips(vy)+'회 · 지표 '+flips(vh)+'회'
    + '   /   가속 부호 뒤집힘: 카드 '+flips(ay)+'회 · 지표 '+flips(ah)+'회');
  // ⏱ 프레임 간격 — 한 프레임이라도 길게 벌어지면 그것도 「울컥」으로 보인다
  //   ⚠ 헤드리스(SwiftShader)라 절대값은 못 믿는다 — **상대적으로 튀는 프레임이 있나**만 본다
  { const dt=diff(d('t')).slice(0,16); const med=[...dt].sort((a,b)=>a-b)[dt.length>>1];
    const bad=dt.filter(v=>v>med*1.8).length;
    console.log('  → 프레임 간격 중앙값 '+med+'ms · 1.8배 넘게 벌어진 프레임 '+bad+'개'); }
  const sc=d('sc'), scMove=diff(sc).filter(v=>Math.abs(v)>0.5).length;
  console.log('  → 스크롤이 움직인 프레임: '+scMove+' (0이라야 한다) · 스크롤 높이 '
    + d('sh')[0]+'→'+d('sh')[rows.length-1]+' / 보이는 높이 '+d('ch')[0]);
  return {vy,vh,ay,ah};
}

report('펴기', await trace()); await sleep(800);
report('접기', await trace()); await sleep(800);

if(errs.length) console.log('\n‼ 페이지 예외: '+errs.join(' | '));
await b.close(); server.close();
