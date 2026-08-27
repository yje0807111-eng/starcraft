import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ROOT='/home/user/starcraft', OUT=process.env.OUT;
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2','.woff':'font/woff','.mp4':'video/mp4','.webm':'video/webm'};
const srv=http.createServer((q,s)=>{ try{ const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
  const f=path.join(ROOT,p==='/'?'sc-ums-web.html':p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
  s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();} });
await new Promise(r=>srv.listen(0,'127.0.0.1',r)); const PORT=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--mute-audio','--no-sandbox']});
const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
pg.on('pageerror',e=>console.log('ERR',String(e.message).slice(0,160)));
await pg.goto(`http://127.0.0.1:${PORT}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof G!=="undefined"',{timeout:20000});
await pg.waitForFunction(()=>{const e=document.getElementById('auth');return e&&!e.classList.contains('hide');},{timeout:25000});
await pg.addStyleTag({url:'/docs/mock/exit-face-8.css'});
const openEx=()=>pg.evaluate(()=>{ const e=document.getElementById('exitConfirm'); e.classList.remove('hide'); });
const setV=v=>pg.evaluate(c=>{ document.documentElement.className=c; }, v);
const shot=async n=>{ await pg.waitForTimeout(420); const el=await pg.$('#phone'); await el.screenshot({path:path.join(OUT,n)}); console.log('✓',n); };
async function pair(tag){ await openEx(); await pg.waitForTimeout(700);
  for(const v of ['f3','f4']){ await setV(v); await pg.waitForTimeout(260); await shot('bg-'+tag+'-'+v+'.png'); }
  await pg.evaluate(()=>{ document.getElementById('exitConfirm').classList.add('hide'); document.documentElement.className=''; }); }
// ① 로그인 — 노을·하늘(가장 밝고 색이 많다)
await pair('login');
// ② 유즈맵 선택 — 성운·행성
await pg.evaluate(()=>{ AUTH.user={uid:'me',nick:'지휘관'};
  ['auth','authGate'].forEach(i=>{const e=document.getElementById(i); if(e){e.classList.add('hide');e.style.display='none';}});
  openMapSelect(); });
await pg.waitForTimeout(1100); await pair('map');
// ③ 캠프(HOME) — 초록 지형. 채도 빼기가 일하는 대표 배경
// ⚠ 캠프는 **종족을 고른 뒤에야** 화면이 나온다(안 고르면 종족 선택 오버레이가 덮는다)
await pg.evaluate(()=>{ try{ openHome(); }catch(e){} });
await pg.waitForTimeout(1500);
console.log('camp race', await pg.evaluate(()=>{ try{
  if(document.getElementById('campRaceOv') && typeof campPickRace==='function'){
    if(typeof campRaceSel==='function') campRaceSel('terran');
    campPickRace(); return 'picked'; } return 'already'; }catch(e){ return 'THROW '+e.message; } }));
await pg.waitForTimeout(2800);
console.log('camp state', await pg.evaluate(()=>{ const o=document.getElementById('campRaceOv');
  return { raceOv:o?getComputedStyle(o).display:'none', home:!document.getElementById('homeScreen').classList.contains('hide') }; }));
await pair('camp');
// ④ 게임 진입 로딩 — 맵 키 아트
await pg.evaluate(()=>{ const o=document.getElementById('campRaceOv'); if(o) o.remove(); openMapSelect(); });
await pg.waitForTimeout(1200);
await pg.evaluate(()=>{ const m=MAPS.find(x=>x.id==='nemo')||MAPS.find(x=>!x.hidden&&x.playable!==false);
  openModeSheet(m); chooseSolo();
  const go=[...document.querySelectorAll('#soloDiffPanel button, #soloDiffPanel .actBtn')].find(x=>/시작/.test(x.textContent));
  if(go) go.click(); });
await pg.waitForTimeout(2400); await pair('load');
// ⑤ 인게임 유즈맵 — 어두운 우주
await pg.evaluate(()=>{ const g=document.getElementById('gsRoot'); if(g){ g.classList.add('hide'); g.style.display='none'; } });
await pg.waitForFunction(()=>G&&G.phase==='playing',{timeout:20000});
await pg.waitForTimeout(900); await pair('game');
console.log('done');
await b.close(); srv.close();
