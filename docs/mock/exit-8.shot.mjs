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
await pg.addStyleTag({url:'/docs/mock/exit-8.css'});
await pg.evaluate(()=>{ AUTH.user={uid:'me',nick:'지휘관'};
  ['auth','authGate'].forEach(i=>{const e=document.getElementById(i); if(e){e.classList.add('hide');e.style.display='none';}});
  openMapSelect(); });
await pg.waitForTimeout(800);
await pg.evaluate(()=>{ const m=MAPS.find(x=>x.id==='nemo')||MAPS.find(x=>!x.hidden&&x.playable!==false);
  openModeSheet(m); chooseSolo();
  const go=[...document.querySelectorAll('#soloDiffPanel button, #soloDiffPanel .actBtn')].find(x=>/시작/.test(x.textContent));
  if(go) go.click(); });
await pg.waitForTimeout(3200);
await pg.evaluate(()=>{ const g=document.getElementById('gsRoot'); if(g){ g.classList.add('hide'); g.style.display='none'; } });
await pg.waitForFunction(()=>G&&G.phase==='playing',{timeout:20000});
// ⚠ 확인창을 **한 번만** 연다. 프레임마다 다시 열면 화면 전환 FX 가 위를 덮어 어둡게 찍힌다.
await pg.evaluate(()=>{ document.getElementById('exitConfirm').classList.remove('hide'); });
await pg.waitForTimeout(1200);
const shot=async n=>{ await pg.waitForTimeout(360); const el=await pg.$('#phone'); await el.screenshot({path:path.join(OUT,n)}); console.log('✓',n); };
const V=['e0','e1','e2','e3','e4','e5','e6','e7','e8'];
for(const v of V){ await pg.evaluate(c=>{ document.documentElement.className=(c==='e0')?'':c; }, v);
  await pg.waitForTimeout(200); await shot('ex-'+v+'.png'); }
console.log('done');
await b.close(); srv.close();
