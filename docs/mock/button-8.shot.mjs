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
await pg.addStyleTag({url:'/docs/mock/button-8.css'});
const shot=async n=>{ await pg.waitForTimeout(420); const el=await pg.$('#phone'); await el.screenshot({path:path.join(OUT,n)}); console.log('✓',n); };
const V=['b0','b1','b2','b3','b4','b5','b6','b7','b8'];
const setV=v=>pg.evaluate(c=>{ document.documentElement.className=(c==='b0')?'':c; }, v);
// ── 화면 ① 방 찾기 (.actBtn 가족) ──
await pg.evaluate(()=>{ AUTH.user={uid:'me',nick:'지휘관'};
  ['auth','authGate'].forEach(i=>{const e=document.getElementById(i); if(e){e.classList.add('hide');e.style.display='none';}});
  openMapSelect(); });
await pg.waitForTimeout(800);
await pg.evaluate(()=>{ const m=MAPS.find(x=>!x.hidden&&x.playable!==false); openModeSheet(m); chooseMulti(); });
await pg.waitForTimeout(1400);
for(const v of V){ await setV(v); await shot('bt-rooms-'+v+'.png'); }
// ── 화면 ② 결과(#ovBtn 가족) ──
await setV('b0');
await pg.evaluate(()=>{ document.getElementById('rooms').classList.add('hide');
  const m=MAPS.find(x=>x.id==='nemo')||MAPS.find(x=>!x.hidden&&x.playable!==false);
  openModeSheet(m); chooseSolo();
  const go=[...document.querySelectorAll('#soloDiffPanel button, #soloDiffPanel .actBtn')].find(x=>/시작/.test(x.textContent));
  if(go) go.click(); });
await pg.waitForTimeout(3200);
await pg.evaluate(()=>{ const g=document.getElementById('gsRoot'); if(g){ g.classList.add('hide'); g.style.display='none'; } });
await pg.waitForFunction(()=>G&&G.phase==='playing',{timeout:20000});
await pg.evaluate(()=>{ G.kills=1284; G.round=20; G.timeSec=724;
  G._runSum={ coins:3150, kills:1284, round:20, time:724, prof:{xp:412,pc:8420,gas:1684,ups:0,level:24,day:1,dayMul:1} }; });
await pg.evaluate(()=>{ G.phase='won'; showOverlay(); rsSkip(); }); await pg.waitForTimeout(900);   // 워밍업
// ⚠ 결과 화면은 **한 번만** 세운다. 프레임마다 showOverlay() 를 다시 부르면
//    화면 전환 FX 가 매번 위를 덮어 전부 어둡게 찍힌다(실제로 그랬다).
await pg.evaluate(()=>{ G.phase='won'; showOverlay(); rsSkip(); _ovClearAuto(); });
await pg.waitForTimeout(1200);
for(const v of V){
  await setV(v); await pg.waitForTimeout(200);
  console.log('  probe', v, JSON.stringify(await pg.evaluate(()=>{
    const b=document.getElementById('ovBtn'), c=getComputedStyle(b), r=b.getBoundingClientRect();
    const ph=document.getElementById('phone').getBoundingClientRect();
    const ab=b.querySelector('.autoBar'); const ac=ab?getComputedStyle(ab):null;
    return { bg:c.backgroundColor, bgi:(c.backgroundImage||'none').slice(0,28), color:c.color,
      h:Math.round(r.height), phone:Math.round(ph.width)+'x'+Math.round(ph.height),
      barW:ac?ac.width:'-', barBgi:ac?(ac.backgroundImage||'none').slice(0,24):'-' }; })));
  await shot('bt-res-'+v+'.png'); }
console.log('done');
await b.close(); srv.close();
