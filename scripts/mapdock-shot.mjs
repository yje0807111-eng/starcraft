/* ============================================================================
 * mapdock-shot.mjs — 🎬 유즈맵 하단 소셜 도크가 열리고 닫히는 것을 **눈으로 본다**
 *   (2026-09-12 · 사용자 요청 「위로 올라가고 내려가는 애니 · 조금 속도감」)
 *
 * 왜 스크립트인가: DESIGN.md §5.5 — **연출은 프레임을 저장해서 눈으로 본다.**
 *   높이 숫자만 보면 「중간에 튀는지 / 채팅이 뒤늦게 팝 하는지」를 전부 놓친다.
 *
 * 무엇을 남기나
 *   ① docs/mock/mapdock-open.png  · mapdock-close.png — 필름스트립(6컷)
 *   ② 콘솔에 매 컷의 도크 높이·채팅 불투명도 (튀는 구간이 있으면 숫자로도 보인다)
 *
 * 사용: CHROME_PATH=/opt/pw-browsers/chromium node scripts/mapdock-shot.mjs
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
await pg.waitForFunction('typeof navGo==="function"',{timeout:30000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(2600);                                   // 부팅이 끝나 로그인까지 (scripts/shot.mjs 와 같은 값)
await pg.evaluate(()=>{ if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','도크'); });
await pg.evaluate(()=>{ navGo('map'); });
await sleep(400);
// 채팅을 몇 줄 채운다 — 빈 도크는 열려도 달라지는 것이 안 보인다
await pg.evaluate(()=>{ try{ for(let i=1;i<=8;i++) addGlobalMsg('플레이어'+i,'접히고 펴지는 것을 봅니다 '+i); }catch(e){} });

const M=()=>pg.evaluate(()=>{ const d=document.getElementById('msSocialDock');
  const so=d&&d.querySelector('.msSocial'); const cs=so?getComputedStyle(so):null;
  return { h:+(d?d.getBoundingClientRect().height:0).toFixed(1),
           open:!(d&&d.classList.contains('collapsed')),
           op:cs?+(+cs.opacity).toFixed(2):null, vis:cs?cs.visibility:null }; });

// 📏 진짜 속도는 **rAF 로** 잰다 — 화면 찍기(pg.screenshot)는 한 장에 100ms 넘게 걸려서
//   그걸로 샘플하면 늘 「이미 끝났다」만 나온다(처음에 그렇게 재고 「애니가 안 걸렸다」고 오진했다).
const trace=()=>pg.evaluate(async()=>{ const d=document.getElementById('msSocialDock'); const out=[];
  mapDockToggle();
  for(let i=0;i<22;i++){ out.push(+d.getBoundingClientRect().height.toFixed(1));
    await new Promise(r=>requestAnimationFrame(r)); }
  return out; });

// 🎞 그림은 **10배 느리게** 돌려서 찍는다 — 곡선 모양은 그대로다.
const SLOW=10;
const slow=on=>pg.evaluate((on,k)=>{ let st=document.getElementById('_dockSlow');
  if(!st){ st=document.createElement('style'); st.id='_dockSlow'; document.head.appendChild(st); }
  st.textContent = on ? '#msSocialDock,#msSocialDock.collapsed,#msSocialDock .msSocial,.msDockBar .mdChev'
    + '{transition-duration:'+(0.26*k)+'s !important}' : '';
}, on, SLOW);

// 한 동작을 찍는다 — 토글 직후부터 STEP ms 간격으로 N 컷(느리게 돌린 시간 기준)
async function film(name, frames, step){
  const shots=[], rows=[];
  await slow(true);
  await pg.evaluate(()=>mapDockToggle());
  for(let i=0;i<frames;i++){
    const m=await M(); rows.push(m);
    shots.push(await pg.screenshot({clip:{x:0,y:844-420,width:390,height:420}}));
    await sleep(step);
  }
  await slow(false);
  // 필름스트립 — 가로로 잇는다
  const strip=await pg.evaluate(async(imgs,w,h)=>{
    const cv=document.createElement('canvas'); cv.width=w*imgs.length; cv.height=h;
    const cx=cv.getContext('2d');
    for(let i=0;i<imgs.length;i++){
      const im=new Image(); await new Promise(r=>{im.onload=r; im.src='data:image/png;base64,'+imgs[i];});
      cx.drawImage(im,i*w,0,w,h);
      cx.fillStyle='#ff5555'; cx.font='bold 20px monospace'; cx.fillText('#'+i, i*w+8, 26);
    }
    return cv.toDataURL('image/png').split(',')[1];
  }, shots.map(s=>Buffer.from(s).toString('base64')), 780, 840);
  fs.writeFileSync(path.join(OUT,'mapdock-'+name+'.png'), Buffer.from(strip,'base64'));
  console.log('\n■ '+name+' → docs/mock/mapdock-'+name+'.png');
  rows.forEach((m,i)=>console.log('  #'+i+'  높이 '+String(m.h).padStart(6)+'px   채팅 op '+m.op+' / '+m.vis+(m.open?'   (열림)':'   (접힘)')));
  return rows;
}

console.log('시작 상태: '+JSON.stringify(await M()));
// 열려 있으면 먼저 접어 둔다(측정 시작점을 고정)
if((await M()).open){ await pg.evaluate(()=>mapDockToggle()); await sleep(700); }
console.log('접은 뒤: '+JSON.stringify(await M()));

console.log('\n📏 실제 높이(매 프레임 · 16.7ms 간격) — 계단이 아니라 곡선이어야 한다');
console.log('  펴기: '+(await trace()).join(' → ')); await sleep(700);
console.log('  접기: '+(await trace()).join(' → ')); await sleep(700);

await film('open', 8, 330);   await sleep(900);
await film('close', 8, 330);  await sleep(900);

if(errs.length) console.log('\n‼ 페이지 예외: '+errs.join(' | '));
await b.close(); server.close();
