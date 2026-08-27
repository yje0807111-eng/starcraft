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
await pg.evaluate(()=>{ AUTH.user={uid:'me',nick:'지휘관'};
  ['auth','authGate'].forEach(i=>{const e=document.getElementById(i); if(e){e.classList.add('hide');e.style.display='none';}});
  openMapSelect(); });
await pg.waitForTimeout(800);
await pg.evaluate(async ()=>{ const m=MAPS.find(x=>x.id==='nemo')||MAPS.find(x=>!x.hidden&&x.playable!==false);
  openModeSheet(m); chooseSolo();
  const go=[...document.querySelectorAll('#soloDiffPanel button, #soloDiffPanel .actBtn')].find(x=>/시작/.test(x.textContent));
  if(go) go.click(); });
await pg.waitForTimeout(3500);
await pg.evaluate(()=>{ try{ if(typeof gsSkip==='function') gsSkip(); }catch(e){} });
await pg.waitForTimeout(2200);
// 후보 CSS + 요약 줄(V3·V4·V8 용) 심기
await pg.addStyleTag({url:'/docs/mock/result-popup-8.css'});
await pg.evaluate(()=>{ const card=document.querySelector('#ov .ovCard'); if(!card||card.querySelector('.ovStatsX')) return;
  const d=document.createElement('div'); d.className='ovStatsX';
  d.innerHTML='<div><span>라운드</span><b>20 / 20</b></div><div><span>처치</span><b>1,284</b></div><div><span>획득 포인트</span><b>+3,150</b></div>';
  card.insertBefore(d, card.querySelector('.ovBtns')); });
// ⚠ 게임이 실제로 playing 이 된 뒤에 phase 를 덮어써야 한다 — 아니면 시작 안내(ready)가 찍힌다
await pg.waitForFunction(()=>typeof G!=='undefined'&&G&&G.phase==='playing',{timeout:20000});
// ⚠ 진입 로딩(#gsRoot)이 아직 덮고 있으면 그것이 찍힌다 — 걷힐 때까지 기다리고, 안 걷히면 직접 접는다
await pg.evaluate(()=>{ const g=document.getElementById('gsRoot'); if(g){ g.classList.add('hide'); g.style.display='none'; } });
await pg.waitForTimeout(600);
console.log('phase ok', await pg.evaluate(()=>{ const g=document.getElementById('gsRoot');
  return {gs:g?g.classList.contains('hide'):'none', phase:G.phase}; }));
async function shoot(cls, kind, file){
  await pg.evaluate(c=>{ document.documentElement.className=c; }, cls);
  if(kind==='exit'){ await pg.evaluate(()=>{ document.getElementById('ov').classList.add('hide');
      document.getElementById('exitConfirm').classList.remove('hide'); }); }
  else { await pg.evaluate(k=>{ const e=document.getElementById('exitConfirm'); if(e) e.classList.add('hide');
      G.phase=(k==='win')?'won':'lost'; showOverlay(); }, kind); }
  await pg.waitForTimeout(430);
  const el=await pg.$('#phone'); await el.screenshot({path:path.join(OUT,file)});
}
const V=['v0','v1','v2','v3','v4','v5','v6','v7','v8'];
for(const v of V){ await shoot(v,'win', 'pw-'+v+'-win.png'); await shoot(v,'exit','pw-'+v+'-exit.png'); }
await shoot('v0','lose','pw-v0-lose.png');
// 검증 — v0 이 진짜 승리 카드인지 · v4 버튼 규칙이 먹었는지
await pg.evaluate(()=>{ document.documentElement.className='v4'; G.phase='won'; showOverlay(); });
await pg.waitForTimeout(200);
console.log('check', JSON.stringify(await pg.evaluate(()=>{
  const t=document.getElementById('ovTitle'), b=document.getElementById('ovBtn');
  const c=getComputedStyle(b);
  return { title:t.textContent, htmlClass:document.documentElement.className,
    btnBgImage:(c.backgroundImage||'none').slice(0,40), btnBorder:c.borderTopWidth+' '+c.borderTopColor,
    sheets:[...document.styleSheets].length }; })));
console.log('done');
await b.close(); srv.close();
