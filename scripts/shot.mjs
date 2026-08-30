/* 화면을 실제로 렌더해서 찍는다 — 눈으로 확인하기 위한 도구
 *
 *   node scripts/shot.mjs boot            부팅 로딩(막대가 도는 중)
 *   node scripts/shot.mjs auth            로그인
 *   node scripts/shot.mjs loading         로그인에서 로딩으로 넘어간 상태
 *   node scripts/shot.mjs boot --at 600   그 시각(ms)에 찍는다
 *
 * 왜 필요한가: 이 환경의 브라우저 창이 안 뜰 때가 많아 계산값만 보고 "됐다"고 말하기 쉽다.
 * 실제로 그러다 두 번 틀렸다 — **찍어서 봐야 한다.**
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const WHAT = argv.find(a => !a.startsWith('--')) || 'boot';
const AT = (() => { const i = argv.indexOf('--at'); return i < 0 ? null : +argv[i + 1]; })();
const OUT = path.join(ROOT, 'scratch_shot_' + WHAT.replace(/[\/:]/g, '_') + '.png');   // 목업 경로(docs/mock/…)도 파일명 하나로

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH || ''].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('크롬을 찾을 수 없습니다.'); process.exit(2); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(ROOT, p === '/' ? 'sc-ums-web.html' : p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// 🖥 SHOT_HEADFUL=1 이면 **창을 띄운 진짜 크롬**으로 돈다 — 소프트웨어 래스터(SwiftShader)가 아니라
//    실제 GPU 를 쓴다. 전환 성능(프레임 정지)을 실기 조건으로 재려면 이쪽이어야 한다.
const HEADFUL = process.env.SHOT_HEADFUL === '1';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: HEADFUL ? false : 'new',
  args: HEADFUL ? ['--no-sandbox', '--mute-audio', '--window-size=460,940']
                : ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--mute-audio'] });
try {
  const page = await browser.newPage();
  const isPage = WHAT.endsWith('.html');   // 임의의 페이지를 통째로 찍는 모드(시안 비교용)
  await page.setViewport(isPage ? { width: 1640, height: 1030, deviceScaleFactor: 1 } : { width: 430, height: 880, deviceScaleFactor: +(process.env.SHOT_DPR||1) });
  await page.goto('http://127.0.0.1:' + PORT + '/' + (isPage ? WHAT : 'sc-ums-web.html'), { waitUntil: 'domcontentloaded' });
  if (isPage) { await new Promise(r => setTimeout(r, 1200)); await page.screenshot({ path: OUT, fullPage: true });
    console.log(WHAT + ' → ' + path.basename(OUT)); await browser.close(); server.close(); process.exit(0); }
  if (WHAT === 'boot') {
    await new Promise(r => setTimeout(r, AT != null ? AT : 700));   // 막대가 도는 중
  } else {
    await new Promise(r => setTimeout(r, 2600));                    // 부팅이 끝나 로그인까지
    if (WHAT === 'warmleft') {
      const r = await page.evaluate(async () => {
        _warmDone=false; _warmRun=null;
        await warmAll(()=>{});
        const a1=M3D.dbg();
        return { afterWarmAll:{n:a1.n, anims:a1.anims} };
      });
      console.log(JSON.stringify(r,null,1));
    }
    if (WHAT === 'warmerr') {
      const r = await page.evaluate(async () => {
        await warmAll(()=>{});
        const out={};
        try{ M3D.sync([], 300, 300, .016, [], [], null, null); out.emptySync='ok'; }
        catch(e){ out.emptySync='THREW: '+(e&&e.message); }
        out.models = (typeof M3D.modelCount==='function') ? M3D.modelCount() : 'n/a';
        out.keys = Object.keys(window.M3D).filter(k=>/render|clear|sync|draw/i.test(k));
        return out;
      });
      console.log(JSON.stringify(r,null,1));
    }
    if (WHAT === 'warmpix') {
      const r = await page.evaluate(async () => {
        const cv=document.getElementById('cvMarine');
        const count=()=>{ const c=document.createElement('canvas'); c.width=cv.width; c.height=cv.height;
          const x=c.getContext('2d'); x.drawImage(cv,0,0);
          const d=x.getImageData(0,0,c.width,c.height).data; let n=0;
          for(let i=3;i<d.length;i+=4) if(d[i]>8) n++;
          return {on:n, total:d.length/4, w:c.width, h:c.height}; };
        await warmAll(()=>{});
        await new Promise(q=>requestAnimationFrame(()=>q()));
        const after=count();
        return {afterWarm:after};
      });
      console.log(JSON.stringify(r));
    }
    if (WHAT === 'warmblack') {
      await page.evaluate(async () => { await warmAll(()=>{}); });   // 실제 진입처럼 3D 를 다 데운다
      await page.evaluate(async () => { await titleToBlack(); });
      await new Promise(r => setTimeout(r, 500));
      const info = await page.evaluate(() => {
        const ph=document.getElementById('phone');
        const bz=parseFloat(getComputedStyle(document.getElementById('titleBlack')).zIndex)||0;
        const out=[];
        ph.querySelectorAll('*').forEach(el=>{
          const cs=getComputedStyle(el); const z=parseFloat(cs.zIndex);
          if(!isNaN(z) && z>bz && cs.visibility!=='hidden' && cs.display!=='none' && parseFloat(cs.opacity)>0.02){
            const r=el.getBoundingClientRect();
            if(r.width>2&&r.height>2) out.push((el.id||el.className||el.tagName)+' z='+z+' '+Math.round(r.width)+'x'+Math.round(r.height)); }
        });
        const cvs=[...ph.querySelectorAll('canvas')].map(c=>{ const cs=getComputedStyle(c); const r=c.getBoundingClientRect();
          return c.id+' z='+cs.zIndex+' vis='+cs.visibility+' op='+cs.opacity+' '+Math.round(r.width)+'x'+Math.round(r.height)+' parent='+(c.parentElement.id||c.parentElement.className); });
        return {aboveBlack:out, canvases:cvs, blackZ:bz, blackOp:getComputedStyle(document.getElementById('titleBlack')).opacity};
      });
      console.log(JSON.stringify(info,null,1));
      const grid=await page.evaluate(()=>{
        const m=document.querySelector('#cstMain'); if(!m) return null;
        const mr=m.getBoundingClientRect();
        const f=m.querySelector('.bmapFloor'); const fr=f?f.getBoundingClientRect():null;
        const bl=[...m.querySelectorAll('*')].filter(e=>/bBld|bUnit|bGhost|bItem/.test(e.className||''));
        const rs=bl.map(e=>e.getBoundingClientRect()).filter(r=>r.width>4&&r.height>4);
        const ph=document.getElementById('phone').getBoundingClientRect();
        let infoTop=null;
        document.querySelectorAll('#homeScreen *').forEach(e=>{ const t=(e.textContent||'');
          if(/MY BASE/.test(t) && t.length<200){ const r=e.getBoundingClientRect(); if(r.height>20) infoTop=Math.round(r.top-ph.top); } });
        return {phoneH:Math.round(ph.height),
          map:{t:Math.round(mr.top-ph.top), b:Math.round(mr.bottom-ph.top)},
          floor:fr?{t:Math.round(fr.top-ph.top), b:Math.round(fr.bottom-ph.top)}:null,
          objs:rs.length,
          objBand:rs.length?{t:Math.round(Math.min(...rs.map(r=>r.top))-ph.top), b:Math.round(Math.max(...rs.map(r=>r.bottom))-ph.top)}:null,
          infoTop}; });
      console.log('GRID '+JSON.stringify(grid));
    }
    if (WHAT === 'outro' || WHAT === 'black') {
      await page.evaluate(() => titleToBlack());          // 그림·막대를 걷어 검은 화면 + 로고
      await new Promise(r => setTimeout(r, 1300));
      if (WHAT === 'outro') { await page.evaluate(() => { openHome(); });   // 게임 화면이 뒤에 선다
        await new Promise(r => setTimeout(r, AT != null ? AT : 260)); }     // 검은 판·로고가 걷히는 중
    }
    else if (WHAT === 'authin') { await page.evaluate(() => { showAppScreen('opening'); }); await new Promise(r=>setTimeout(r,900)); await page.evaluate(() => { openAuth(); }); await new Promise(r => setTimeout(r, AT != null ? AT : 500)); }
    else if (WHAT === 'authout') { await page.evaluate(() => { openAuth(); }); await new Promise(r=>setTimeout(r,1600)); await page.evaluate(() => { showAppScreen('opening'); }); await new Promise(r => setTimeout(r, AT != null ? AT : 380)); }
    else if (WHAT === 'scrimon' || WHAT === 'scrimoff') {
      await page.addStyleTag({content:'#titleBg{animation:none !important;transform:scale(1.04) !important}'
        + (WHAT==='scrimoff' ? ' #titleBg::before{background:none !important}' : '')});
      await new Promise(r=>setTimeout(r,300)); }
    else if (WHAT === 'noscrim') { await page.addStyleTag({content:'#titleMark::before,.authIn::before{background:none !important}'}); await new Promise(r=>setTimeout(r,300)); }
    else if (WHAT === 'setanim') {
      const tr=await page.evaluate(()=>new Promise(res=>{ const log=[]; const p=document.getElementById('settingsPop');
        openAppSettings(); const t0=performance.now();
        const iv=setInterval(()=>{ const t=Math.round(performance.now()-t0);
          const c=document.querySelector('#settingsPop .setCard');
          log.push(t+'ms 딤'+(+getComputedStyle(p).opacity).toFixed(2)+' 카드'+(+getComputedStyle(c).opacity).toFixed(2));
          if(t>360){ clearInterval(iv); closeSettings(); const t1=performance.now();
            const iv2=setInterval(()=>{ const t2=Math.round(performance.now()-t1);
              log.push('닫기 '+t2+'ms 딤'+(+getComputedStyle(p).opacity).toFixed(2)+' hide='+p.classList.contains('hide'));
              if(t2>360){ clearInterval(iv2); res(log); } },90); } },60); }));
      console.log('  [여닫기] '+tr.join(' | '));
    }
    else if (WHAT === 'bg') { await page.evaluate(()=>{ window.__bg={body:getComputedStyle(document.body).backgroundColor,html:getComputedStyle(document.documentElement).backgroundColor,phone:getComputedStyle(document.getElementById('phone')).backgroundColor}; }); const r=await page.evaluate(()=>window.__bg); console.log(JSON.stringify(r)); }
    else if (WHAT === 'nav') { await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); }); await new Promise(r=>setTimeout(r,900)); await page.evaluate(()=>{ try{ navGo('upg'); navBack(); }catch(e){} }); await new Promise(r=>setTimeout(r,700)); }
    else if (WHAT === 'navsub') { await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); }); await new Promise(r=>setTimeout(r,900)); await page.evaluate(()=>{ try{ navGo('shop'); }catch(e){} }); await new Promise(r=>setTimeout(r,800)); }
    else if (WHAT === 'slow5') {   // 🔍 기준선 — 아무것도 안 해도 이 구간에 프레임이 비는가
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      const r = await page.evaluate((mode) => new Promise(res=>{
        try{ showAppScreen('opening'); }catch(e){}
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ _warmDone=true; _warmRun=null; }catch(e){}
        const out={ mode, frames:[] };
        // nav2 = 로딩 중에 네비를 미리 한 번 그려 두는 처방을 흉내낸다
        if(mode==='nav2'){ try{ navShow('home'); navShow(null); }catch(e){} }
        setTimeout(()=>{
          const t0=performance.now();
          if(mode==='home') { try{ openHome(); }catch(e){} }
          else if(mode==='screen') { try{ showAppScreen('homeScreen'); }catch(e){} }
          else if(mode==='camp') { try{ showAppScreen('homeScreen'); campOpen(); }catch(e){} }
          else if(mode==='render') { try{ showAppScreen('homeScreen'); renderHome(); paintIcons(document.getElementById('homeScreen')); }catch(e){} }
          else if(mode==='nav') { try{ showAppScreen('homeScreen'); navShow('home'); }catch(e){} }
          else if(mode==='nav2') { try{ showAppScreen('homeScreen'); navShow('home'); }catch(e){} }   // 앞서 미리 한 번 그려 뒀다
          else if(mode==='navhide') { try{ showAppScreen('homeScreen'); navShow('home');
            document.getElementById('navBar').style.display='none'; }catch(e){} }   // 네비를 안 보이게 한 채로
          else if(mode==='navplain') { try{ showAppScreen('homeScreen'); navShow('home');
            const b=document.getElementById('navBar'); b.style.background='#000'; b.style.boxShadow='none';
            for(const e of b.querySelectorAll('*')) e.style.boxShadow='none'; }catch(e){} }   // 그림자·그라데만 뺀 채로
          let n=0; const tick=()=>{ out.frames.push(+(performance.now()-t0).toFixed(1));
            if(++n<10) requestAnimationFrame(tick); else res(out); };
          requestAnimationFrame(tick);
        }, 250); }), process.env.SHOT_MODE||'none');
      console.log('SLOW5 '+JSON.stringify(r));
    }
    else if (WHAT === 'slow4') {   // 🔍 3D 인가 — 캔버스를 뺀 채로 같은 것을 잰다
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      const r = await page.evaluate((kill) => new Promise(res=>{
        try{ showAppScreen('opening'); }catch(e){}
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ _warmDone=true; _warmRun=null; }catch(e){}
        const out={ killed:kill, frames:[] };
        setTimeout(()=>{
          if(kill){ const c=document.getElementById('vBuild'); if(c){ c.style.display='none'; out.had3d=true; }
            const m=document.getElementById('cvMarine'); if(m) m.style.display='none'; }
          const t0=performance.now(); try{ openHome(); }catch(e){}
          if(kill){ const c=document.getElementById('vBuild'); if(c) c.style.display='none';
            const m=document.getElementById('cvMarine'); if(m) m.style.display='none'; }
          let n=0; const tick=()=>{ out.frames.push(+(performance.now()-t0).toFixed(1));
            if(++n<10) requestAnimationFrame(tick); else res(out); };
          requestAnimationFrame(tick);
        }, 250); }), process.env.SHOT_KILL3D==='1');
      console.log('SLOW4 '+JSON.stringify(r));
    }
    else if (WHAT === 'slow3') {   // 🔍 그 123ms 가 이미지 디코딩인지 — 미리 디코드하고 다시 잰다
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      const r = await page.evaluate(async () => {
        try{ showAppScreen('opening'); }catch(e){}
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ _warmDone=true; _warmRun=null; }catch(e){}
        const out={ decoded:[], frames:[] };
        const urls=[];
        try{ for(const k of CAMP_RACE_ORDER){ urls.push(campRaceArt(k)); urls.push(campRaceIcon(k)); } }catch(e){}
        try{ urls.push(new URL(CAMP_BG_DIR+CAMP_BG_HOME, document.baseURI).href); }catch(e){}
        for(const u of urls){ const a=performance.now();
          try{ const im=new Image(); im.src=u; await im.decode(); out.decoded.push([u.split('/').pop(), +(performance.now()-a).toFixed(1)]); }
          catch(e){ out.decoded.push([u.split('/').pop(),'ERR']); } }
        await new Promise(r=>setTimeout(r,120));
        return await new Promise(res=>{
          const t0=performance.now(); try{ openHome(); }catch(e){}
          let n=0; const tick=()=>{ out.frames.push(+(performance.now()-t0).toFixed(1));
            if(++n<10) requestAnimationFrame(tick); else res(out); };
          requestAnimationFrame(tick); }); });
      console.log('SLOW3 '+JSON.stringify(r));
    }
    else if (WHAT === 'slow2') {   // 🔍 openHome() 은 15ms 인데 화면은 118ms 얼었다 — 나머지는 어디에
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      const r = await page.evaluate(() => new Promise(res=>{
        try{ showAppScreen('opening'); }catch(e){}
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ _warmDone=true; _warmRun=null; }catch(e){}
        const out={ frames:[], long:[] };
        // 긴 작업이 무엇인지 브라우저에게 직접 묻는다
        try{ new PerformanceObserver(l=>{ for(const e of l.getEntries())
          out.long.push({ name:e.name, ms:+e.duration.toFixed(1) }); }).observe({entryTypes:['longtask']}); }catch(e){}
        setTimeout(()=>{
          const t0=performance.now();
          const sync = (function(){ const a=performance.now(); try{ openHome(); }catch(e){} return +(performance.now()-a).toFixed(1); })();
          let n=0; const tick=()=>{ out.frames.push(+(performance.now()-t0).toFixed(1));
            if(++n<14) requestAnimationFrame(tick);
            else { out.sync=sync;
              const imgs=[...document.images].filter(i=>!i.complete).map(i=>i.src.split('/').pop());
              out.notLoaded=imgs.slice(0,8); out.imgTotal=document.images.length;
              res(out); } };
          requestAnimationFrame(tick);
        }, 250);
      }));
      console.log('SLOW2 '+JSON.stringify(r));
    }
    else if (WHAT === 'slow') {   // 🔍 종족 선택으로 넘어갈 때 화면을 얼리는 것이 무엇인가
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      const r = await page.evaluate(() => new Promise(res=>{
        try{ showAppScreen('opening'); }catch(e){}
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ _warmDone=true; _warmRun=null; }catch(e){}
        const T=[]; const mark=(n,f)=>{ const a=performance.now(); try{ f(); }catch(e){ T.push([n,'ERR '+e.message]); return; }
          T.push([n, +(performance.now()-a).toFixed(1)]); };
        setTimeout(()=>{
          // openHome() 이 하는 일을 **같은 순서로** 하나씩 재다
          mark('loadMeta', ()=>loadMeta());
          mark('closeDungeonHub', ()=>{ if(typeof closeDungeonHub==='function') closeDungeonHub(); });
          mark('profEnsureChar', ()=>profEnsureChar());
          mark('bgmStart', ()=>{ if(typeof bgmStart==='function') bgmStart('lobby'); });
          mark('showAppScreen', ()=>showAppScreen('homeScreen'));
          mark('navShow', ()=>navShow('home'));
          mark('renderHome', ()=>renderHome());
          mark('campOpen', ()=>{ if(typeof campOpen==='function') campOpen(); });
          mark('paintIcons', ()=>{ if(typeof paintIcons==='function') paintIcons(document.getElementById('homeScreen')); });
          res(T);
        }, 250);
      }));
      console.log('SLOW '+JSON.stringify(r));
    }
    else if (WHAT === 'predec') {   // 🔍 캠프 바닥 그림을 미리 디코드하면 실제로 빨라지나
      // ⚠ 브라우저를 새로 띄운 실행끼리만 비교해야 한다 — 같은 페이지에서 두 번 재면
      //    두 번째는 이미 캐시·디코드가 끝나 있어 무조건 빠르다.
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      await page.evaluate(() => new Promise(res=>{
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ openHome(); }catch(e){}
        setTimeout(res, 1400); }));
      const r = await page.evaluate(async (pre) => {
        const out={ pre };
        if(pre==='1'){
          const a=performance.now();
          try{ const im=new Image();
            out.url=new URL(CAMP_BG_DIR+CAMP_BG_HOME, document.baseURI).href;
            im.src=out.url;
            await im.decode(); out.decodeMs=+(performance.now()-a).toFixed(1);
            out.px=im.naturalWidth+'x'+im.naturalHeight; }
          catch(e){ out.decodeMs='ERR'; }
          await new Promise(r=>setTimeout(r,200));   // 디코드가 프레임에 남긴 여파를 흘려보낸다
        }
        // camp.webp 를 누가 언제 받았나
        try{ out.res=performance.getEntriesByType('resource')
          .filter(e=>e.name.indexOf('camp.webp')>=0)
          .map(e=>({at:+e.startTime.toFixed(0), dur:+e.duration.toFixed(1), size:e.transferSize})); }catch(e){}
        try{ out.imgs=[...document.images].filter(i=>i.src.indexOf('camp.webp')>=0).length; }catch(e){}
        return await new Promise(res=>{
          const C=campState(); C.race=_campRacePick||CAMP_RACE_ORDER[0];
          out.long=[];
          try{ new PerformanceObserver(l=>{ for(const e of l.getEntries())
            out.long.push(+e.duration.toFixed(0)); }).observe({entryTypes:['longtask']}); }catch(e){}
          const t0=performance.now();
          try{ campEnter(); }catch(e){ out.err=String(e).slice(0,60); }
          out.sync=+(performance.now()-t0).toFixed(1);
          let n=0; const fr=[]; const tick=()=>{ fr.push(+(performance.now()-t0).toFixed(0));
            if(++n<4) requestAnimationFrame(tick); else { out.frames=fr; res(out); } };
          requestAnimationFrame(tick); }); }, process.env.SHOT_PRE||'0');
      console.log('PREDEC '+JSON.stringify(r));
    }
    else if (WHAT === 'slow8') {   // 🔍 그 240ms 가 JS 인가 렌더인가 — longtask 로 가른다
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      await page.evaluate(() => new Promise(res=>{
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ openHome(); }catch(e){}
        setTimeout(res, 1400); }));
      const r = await page.evaluate((kill) => new Promise(res=>{
        const out={ kill, long:[], frames:[] };
        try{ new PerformanceObserver(l=>{ for(const e of l.getEntries())
          out.long.push(+e.duration.toFixed(0)); }).observe({entryTypes:['longtask']}); }catch(e){}
        const C=campState(); C.race=_campRacePick||CAMP_RACE_ORDER[0];
        // ⭐ campEnter **전에** 끈다 — 뒤에 끄면 이미 그려진 뒤라 의미가 없다(2026-08-27 에 그랬다)
        if(kill==='3d'){ try{ window.M3D=Object.assign({},window.M3D,{
          sync:function(){}, clearGameModels:function(){}, clearIdlePools:function(){} }); }catch(e){} }
        if(kill==='bg'){ try{ const st=document.createElement('style');
          st.textContent='.bmapFloor{background-image:none !important}'; document.head.appendChild(st); }catch(e){} }
        if(kill==='render'){ try{ window.techMapRender=function(){}; }catch(e){} }
        const t0=performance.now();
        try{ campEnter(); }catch(e){ out.err=String(e).slice(0,80); }
        out.sync=+(performance.now()-t0).toFixed(1);
        let n=0; const tick=()=>{ out.frames.push(+(performance.now()-t0).toFixed(0));
          if(++n<8) requestAnimationFrame(tick); else res(out); };
        requestAnimationFrame(tick); }), process.env.SHOT_KILL||'none');
      console.log('SLOW8 '+JSON.stringify(r));
    }
    else if (WHAT === 'slow7') {   // 🔍 campEnter 안에서 무엇이 그 시간을 쓰나 — 단계별
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      await page.evaluate(() => new Promise(res=>{
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ openHome(); }catch(e){}
        setTimeout(res, 1400); }));
      await page.evaluate((k)=>{ document.__kill=k; }, process.env.SHOT_KILL||'none');
      const r = await page.evaluate(() => new Promise(res=>{
        const out={ steps:[], frames:[] };
        const C=campState(); C.race=_campRacePick||CAMP_RACE_ORDER[0];
        // campEnter 를 통째로 부르되, 그 안의 주요 단계를 감싸서 잰다
        const wrap=(name)=>{ const f=window[name]; if(typeof f!=='function') return;
          window[name]=function(){ const a=performance.now(); const r=f.apply(this,arguments);
            out.steps.push([name, +(performance.now()-a).toFixed(1)]); return r; }; };
        ['techUIInit','campRestore','campLayBase','campLayMinerals','campShowView',
         'campPatchZoom','campSettleAway','campMountView','techMapRender','campBarReset'].forEach(wrap);
        const kill=out.kill=(document.__kill||'none');
        const t0=performance.now();
        try{ campEnter(); }catch(e){ out.err=String(e).slice(0,80); }
        // 무엇이 비싼지 하나씩 빼 보고 잰다
        if(kill==='bg'||kill==='both'){ const f=document.querySelector('.bmapFloor');
          if(f) f.style.backgroundImage='none'; }
        if(kill==='3d'||kill==='both'){ for(const id of ['vBuild','cvMarine']){
          const e=document.getElementById(id); if(e) e.style.display='none'; } }
        if(kill==='panel'){ const p=document.querySelector('.bp,#btSheet,.cstBot');
          if(p) p.style.display='none'; }
        out.sync=+(performance.now()-t0).toFixed(1);
        let n=0; const tick=()=>{ out.frames.push(+(performance.now()-t0).toFixed(0));
          if(++n<10) requestAnimationFrame(tick); else res(out); };
        requestAnimationFrame(tick); }));
      console.log('SLOW7 '+JSON.stringify(r));
    }
    else if (WHAT === 'slow6') {   // 🔍 종족을 고른 직후 화면이 멈추는 것 — 무엇이 쓰는 시간인가
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      await page.evaluate(() => new Promise(res=>{
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ openHome(); }catch(e){}
        setTimeout(res, 1400); }));
      const r = await page.evaluate(() => new Promise(res=>{
        const out={ steps:[], frames:[] };
        const mark=(n,f)=>{ const a=performance.now(); try{ f(); }catch(e){ out.steps.push([n,'ERR '+e.message]); return; }
          out.steps.push([n, +(performance.now()-a).toFixed(1)]); };
        const t0=performance.now();
        // campPickRace() 가 하는 일을 같은 순서로 하나씩
        mark('race+save', ()=>{ const C=campState(); C.race=_campRacePick||CAMP_RACE_ORDER[0];
          if(typeof saveMeta==='function') saveMeta(); });
        const ph=document.getElementById('phone');
        mark('artMark', ()=>{ ph.classList.add('artMark'); });
        mark('titleToBlack', ()=>{ window.__blk = titleToBlack(); });
        mark('campEnter', ()=>{ campEnter(); });
        let n=0; const tick=()=>{ out.frames.push(+(performance.now()-t0).toFixed(0));
          if(++n<12) requestAnimationFrame(tick); else res(out); };
        requestAnimationFrame(tick); }));
      console.log('SLOW6 '+JSON.stringify(r));
    }
    else if (WHAT === 'flick2') {   // 🔍 종족 선택 → 캠프 : 페이드아웃·검은 화면·페이드인을 프레임으로 본다
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      // 먼저 종족 선택까지 간다
      await page.evaluate(() => new Promise(res=>{
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ openHome(); }catch(e){}
        setTimeout(res, 1200); }));
      const cdp = await page.createCDPSession();
      const frames = [];
      cdp.on('Page.screencastFrame', async (f) => {
        frames.push({ t: f.metadata.timestamp, d: f.data });
        try{ await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); }catch(e){}
      });
      await cdp.send('Page.startScreencast', { format:'jpeg', quality:70, everyNthFrame:1 });
      await new Promise(r=>setTimeout(r,300));
      await page.evaluate(() => { setTimeout(()=>{ try{ campPickRace(); }catch(e){} }, 200); });
      await new Promise(r=>setTimeout(r, +(process.env.SHOT_MS||6000)));
      try{ await cdp.send('Page.stopScreencast'); }catch(e){}
      const lum = await page.evaluate(async (list) => {
        const out=[];
        for(const it of list){
          const img=new Image();
          await new Promise(r=>{ img.onload=r; img.onerror=r; img.src='data:image/jpeg;base64,'+it.d; });
          if(!img.width){ out.push({t:it.t,L:null}); continue; }
          const c=document.createElement('canvas'); c.width=64; c.height=128;
          const x=c.getContext('2d'); x.drawImage(img,0,0,64,128);
          const d=x.getImageData(0,0,64,128).data; let sum=0;
          for(let i=0;i<d.length;i+=4) sum += .2126*d[i] + .7152*d[i+1] + .0722*d[i+2];
          out.push({ t:it.t, L:+(sum/(d.length/4)).toFixed(1) });
        }
        return out; }, frames);
      const t0 = lum.length ? lum[0].t : 0;
      const rows = lum.map(v=>({ ms: Math.round((v.t-t0)*1000), L: v.L }));
      if(process.env.SHOT_SAVE){
        const from=+(process.env.SHOT_FROM||0), to=+(process.env.SHOT_TO||99999), step=+(process.env.SHOT_STEP||1);
        let k=0, saved=0;
        for(let i=0;i<rows.length;i++){ if(rows[i].ms<from||rows[i].ms>to) continue;
          if((k++)%step) continue;
          fs.writeFileSync(path.join(ROOT,'scratch_f2_'+String(rows[i].ms).padStart(5,'0')+'.jpg'),
            Buffer.from(frames[i].d,'base64')); saved++; }
        console.log('SAVED '+saved+' frames'); }
      console.log('FLICK2 frames='+rows.length);
      console.log(rows.map(r=>r.ms+':'+r.L).join(' '));
    }
    else if (WHAT === 'flick') {   // 🔍 전환 구간을 **프레임마다** 찍어 밝기가 튀는 곳을 찾는다
      // ⭐ 눈에 보이는 '깜박임' 은 opacity 표본으로는 안 잡힌다 — 한 프레임짜리라서.
      //    그래서 화면을 통째로 녹화하고 프레임별 평균 휘도를 본다. 비단조로 튀는 지점이 깜박임이다.
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      const cdp = await page.createCDPSession();
      const frames = [];
      cdp.on('Page.screencastFrame', async (f) => {
        frames.push({ t: f.metadata.timestamp, d: f.data });
        try{ await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); }catch(e){}
      });
      await cdp.send('Page.startScreencast', { format:'jpeg', quality:70, everyNthFrame:1 });
      await page.evaluate(() => {
        try{ showAppScreen('opening'); }catch(e){}
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ _warmDone=true; _warmRun=null; }catch(e){}
        setTimeout(()=>{ try{ enterAfterWarm(); }catch(e){} }, 250);
      });
      await new Promise(r=>setTimeout(r, +(process.env.SHOT_MS||3200)));
      try{ await cdp.send('Page.stopScreencast'); }catch(e){}
      // 휘도는 브라우저에게 계산시킨다(Node 쪽에 디코더가 없다)
      const lum = await page.evaluate(async (list) => {
        const out=[];
        for(const it of list){
          const img=new Image();
          await new Promise(r=>{ img.onload=r; img.onerror=r; img.src='data:image/jpeg;base64,'+it.d; });
          if(!img.width){ out.push({t:it.t,L:null}); continue; }
          const c=document.createElement('canvas'); c.width=64; c.height=128;
          const x=c.getContext('2d'); x.drawImage(img,0,0,64,128);
          const d=x.getImageData(0,0,64,128).data; let sum=0;
          for(let i=0;i<d.length;i+=4) sum += .2126*d[i] + .7152*d[i+1] + .0722*d[i+2];
          out.push({ t:it.t, L:+(sum/(d.length/4)).toFixed(1) });
        }
        return out; }, frames);
      const t0 = lum.length ? lum[0].t : 0;
      const rows = lum.map(v=>({ ms: Math.round((v.t-t0)*1000), L: v.L }));
      // 튀는 지점 = 직전 대비 밝기가 되돌아가는 곳(단조롭게 어두워져야 정상)
      const jumps=[];
      for(let i=2;i<rows.length;i++){
        const a=rows[i-2].L, b=rows[i-1].L, c=rows[i].L;
        if(a==null||b==null||c==null) continue;
        if((b-a)*(c-b) < 0 && Math.abs(c-b) > 6 && Math.abs(b-a) > 6)
          jumps.push(rows[i-1].ms+'ms '+a+'→'+b+'→'+c);
      }
      // 프레임을 눈으로 본다 — 평균 밝기는 배경 크기 변화나 작은 UI 를 못 잡는다(2026-08-27 에 놓쳤다)
      if(process.env.SHOT_SAVE){
        const from=+(process.env.SHOT_FROM||0), to=+(process.env.SHOT_TO||99999), step=+(process.env.SHOT_STEP||1);
        let k=0, saved=0;
        for(let i=0;i<rows.length;i++){ if(rows[i].ms<from||rows[i].ms>to) continue;
          if((k++)%step) continue;
          fs.writeFileSync(path.join(ROOT,'scratch_fr_'+String(rows[i].ms).padStart(5,'0')+'.jpg'),
            Buffer.from(frames[i].d,'base64')); saved++; }
        console.log('SAVED '+saved+' frames'); }
      console.log('FLICK frames='+rows.length);
      console.log(rows.map(r=>r.ms+':'+r.L).join(' '));
      console.log('JUMPS '+(jumps.length?jumps.join(' | '):'없음'));
    }
    else if (WHAT === 'overlap') {   // 🔍 로딩→종족 선택 사이에 무엇이 겹쳐 보이나
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,900));
      const at = +(process.env.SHOT_AT || 250);
      const info = await page.evaluate((ms) => new Promise(res=>{
        // ⭐ **진짜 enterAfterWarm 을 돌린다.** 예열만 건너뛴다(_warmDone) — 흐름을 흉내내면
        //    그 흉내를 재게 되어 실제 코드의 회귀를 못 잡는다(2026-08-27 에 그랬다).
        try{ showAppScreen('opening'); }catch(e){}
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ _warmDone=true; _warmRun=null; }catch(e){}
        setTimeout(()=>{
          try{ enterAfterWarm(); }catch(e){}
          setTimeout(()=>{
            const g=(id)=>{ const e=document.getElementById(id); if(!e) return '없음';
              const cs=getComputedStyle(e);
              if(cs.display==='none'||e.classList.contains('hide')) return '숨김';
              return 'op='+(+cs.opacity).toFixed(2); };
            const _tb=document.getElementById('titleBg');
            const _tr=_tb?getComputedStyle(_tb).transform:'-';
            const _bar=document.querySelector('.opStartBar,.opBar,#opBar');
            const _tx=document.querySelector('.opPct,.opBarTx');
            const sc=document.getElementById('hmScroll');
            res({ at:ms,
              로딩:g('opening'), 홈:g('homeScreen'), 종족판:g('campRaceOv'),
              키아트:g('titleBg'), 로고:g('titleMark'), 검은판:g('titleBlack'),
              사냥터본문: sc?(getComputedStyle(sc).display==='none'?'숨김':'보임'):'없음',
              배경크기:_tr, 막대:(_bar?getComputedStyle(_bar).width:'-'),
              막대글자:(_tx?_tx.textContent.trim():'-'),
              phone:document.getElementById('phone').className,
              vBuild:g('vBuild'), cstMain:(document.getElementById('cstMain')?'있음':'없음'),
              바닥:(function(){ const f=document.querySelector('.bmapFloor'); if(!f) return '없음';
                const cs=getComputedStyle(f); return (cs.display==='none'?'숨김':'보임 bg='+(cs.backgroundImage||'').slice(0,60)); })(),
              campBg:(getComputedStyle(document.getElementById('phone')).getPropertyValue('--campBg')||'없음').slice(0,60) });
          }, ms);
        }, 250);
      }), at);
      console.log('OVERLAP '+JSON.stringify(info,null,1));
    }
    else if (WHAT === 'hbpix') {   // #hbCv 에 옛 사냥터 배경이 남아 있나
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); });
      await new Promise(r=>setTimeout(r,1500));
      const r = await page.evaluate(() => {
        const cv=document.getElementById('hbCv');
        if(!cv) return {no:'hbCv'};
        const rc=cv.getBoundingClientRect();
        const out={ buf:cv.width+'x'+cv.height, shown:Math.round(rc.width)+'x'+Math.round(rc.height),
                    vis:getComputedStyle(cv).visibility, disp:getComputedStyle(cv).display };
        try{ const c=document.createElement('canvas'); c.width=cv.width; c.height=cv.height;
          const x=c.getContext('2d'); x.drawImage(cv,0,0);
          const d=x.getImageData(0,0,c.width,c.height).data; let on=0;
          for(let i=3;i<d.length;i+=4) if(d[i]>8) on++;
          out.painted = on; out.total = d.length/4;
        }catch(e){ out.err=String(e).slice(0,60); }
        out.hbOn = (typeof _hb!=='undefined' && _hb) ? {on:_hb.on, bg:_hb.bg, dg:_hb.dg} : 'no _hb';
        return out; });
      console.log('HBPIX '+JSON.stringify(r));
    }
    else if (WHAT === 'toRace') {   // 🎬 로딩 → 종족 선택 전환을 시각별로 잰다
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); });
      await new Promise(r=>setTimeout(r,600));
      const at = +(process.env.SHOT_AT || 300);
      const info = await page.evaluate((ms) => new Promise(res=>{
        const pick=()=>{ const ph=document.getElementById('phone');
          const g=(id)=>{ const e=document.getElementById(id); if(!e) return '-';
            const cs=getComputedStyle(e);
            return cs.display==='none'?'none':((+cs.opacity).toFixed(2)+(e.classList.contains('hide')?' hide':'')); };
          return { op:g('opening'), home:g('homeScreen'), race:g('campRaceOv'),
                   bg:g('titleBg'), mark:g('titleMark'), black:g('titleBlack'),
                   cls:ph?ph.className:'-' }; };
        const before = pick();
        try{ const C=campState(); if(C){ C.race=null; C.ents=null; } }catch(e){}
        try{ enterAfterWarm(); }catch(e){}
        setTimeout(()=>res({ at:ms, before, after:pick() }), ms);
      }), at);
      console.log('TORACE '+JSON.stringify(info));
    }
    else if (WHAT === 'mine') {   // 💎 미네랄 채굴 판
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); });
      await new Promise(r=>setTimeout(r,1200));
      await page.evaluate(()=>{ const ov=document.getElementById('campRaceOv'); if(ov && !ov.classList.contains('hide')){ try{ campPickRace(); }catch(e){} } });
      await new Promise(r=>setTimeout(r,2600));
      const info = await page.evaluate((rich) => {
        const out={};
        try{ if(rich) G.tech.credit = 5000; out.credit=G.tech.credit; openCampMine(); }catch(e){ out.err=String(e).slice(0,90); }
        const sh=document.getElementById('campMineSheet');
        out.open = sh ? !sh.classList.contains('hide') : 'no sheet';
        out.tapGain = (typeof campTapGain==='function') ? campTapGain() : '-';
        out.cost = (typeof campUpgCost==='function') ? [campUpgCost('tap'), campUpgCost('gather')] : '-';
        const btns=[...document.querySelectorAll('#campMineUpg [data-upg]')];
        out.buttons = btns.map(b=>b.getAttribute('data-upg')+(b.disabled?'(잠김)':'(살수있음)'));
        return out;
      }, process.env.SHOT_RICH ? 1 : 0);
      console.log('MINE '+JSON.stringify(info));
      await new Promise(r=>setTimeout(r,300));
    }
    else if (WHAT === 'campin') {   // 🎬 종족 선택 → 캠프 진입 연출. 애니 시각을 직접 지정해 잡는다
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); });
      await new Promise(r=>setTimeout(r,1000));
      const at = +(process.env.SHOT_AT || 300);
      const info = await page.evaluate((ms) => {
        const out={};
        try{ campPickRace(); }catch(e){ out.err=String(e).slice(0,90); }
        const seek=(el)=>{ if(!el) return '-';
          const as=el.getAnimations?el.getAnimations():[];
          out['anim_'+el.id]=as.length;
          as.forEach(a=>{ try{ a.pause(); a.currentTime=ms; }catch(e){} });
          const cs=getComputedStyle(el);
          return cs.transform.slice(0,34)+' op='+(+cs.opacity).toFixed(2); };
        const ov=document.getElementById('campRaceOv');
        if(ov){ const oa=ov.getAnimations?ov.getAnimations():[]; oa.forEach(a=>{ try{ a.pause(); a.currentTime=ms; }catch(e){} }); }
        out.at=ms;
        out.vBuild=seek(document.getElementById('vBuild'));
        out.cvMarine=seek(document.getElementById('cvMarine'));
        out.ov = ov ? (ov.className+' op='+(+getComputedStyle(ov).opacity).toFixed(2)) : '-';
        return out;
      }, at);
      console.log('CAMPIN '+JSON.stringify(info));
      await new Promise(r=>setTimeout(r,150));
    }
    else if (WHAT === 'camp') {   // 캠프(HOME 메인) — 맵 확대율·배경 해상도 측정
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); });
      await new Promise(r=>setTimeout(r,1200));
      await page.evaluate(()=>{ const ov=document.getElementById('campRaceOv');
        if(ov && !ov.classList.contains('hide')){ const b=[...ov.querySelectorAll('button')].find(x=>/시작/.test(x.textContent||'')); if(b) b.click(); } });
      await new Promise(r=>setTimeout(r,3000));
      if(process.env.SHOT_ZOOM){ const zr=await page.evaluate((z)=>{ const out={}; try{ window.__zHold=setInterval(()=>{ try{ const v=G.tech.view; if(v && v.zoom!==+z){ v.zoom=+z; } }catch(e){} }, 16); const v=G.tech.view; v.zoom=+z; if(typeof _techClampView==="function") _techClampView(); out.set=v.zoom; }catch(e){ out.err=String(e).slice(0,90); } return out; }, process.env.SHOT_ZOOM); await new Promise(r=>setTimeout(r,900)); const zr2=await page.evaluate(()=>{ const f=document.querySelector(".bmapFloor"); return { zoom:G.tech.view.zoom, x:+G.tech.view.x.toFixed(3), y:+G.tech.view.y.toFixed(3),          tr:f?getComputedStyle(f).transform:"-" }; }); console.log('ZOOM '+JSON.stringify(zr)+' | '+JSON.stringify(zr2)); }
      await new Promise(r=>setTimeout(r,700));
      if(process.env.SHOT_MEASURE){ const r=await page.evaluate(()=>{ const ph=document.getElementById('phone').getBoundingClientRect(); const m=document.querySelector('#cstMain'); const mr=m?m.getBoundingClientRect():null; let sheet=null; document.querySelectorAll('#homeScreen *,#phone>*').forEach(e=>{ const t=(e.textContent||'');   if(/MY BASE/.test(t) && t.length<300){ const rr=e.getBoundingClientRect(); if(rr.height>20 && (!sheet||rr.top<sheet.top)){ sheet=rr; sheet.__id=(e.id||e.className||e.tagName).toString().slice(0,40); } } }); const f=document.querySelector('.bmapFloor'); const fr=f?f.getBoundingClientRect():null; const v=(G.tech&&G.tech.view)||{}; return { phoneH:Math.round(ph.height), map:mr?{t:Math.round(mr.top-ph.top),b:Math.round(mr.bottom-ph.top)}:null,          sheetTop:sheet?Math.round(sheet.top-ph.top):null, sheetId:sheet?(sheet.__id||''):'', floor:fr?{t:Math.round(fr.top-ph.top),b:Math.round(fr.bottom-ph.top)}:null,          view:{zoom:+(v.zoom||0).toFixed(3), y:+(v.y||0).toFixed(3)}, btSheet:(function(){ const b=document.getElementById('btSheet'); if(!b) return null; const r=b.getBoundingClientRect(); return {t:Math.round(r.top-ph.top),h:Math.round(r.height),cls:b.className}; })() }; }); console.log('MEASURE '+JSON.stringify(r)); }
      if(process.env.SHOT_DG) await page.evaluate((n)=>{ try{ const C=campState(); if(C){ C.dg=+n; campSkin(); } }catch(e){} }, process.env.SHOT_DG);
      await new Promise(r=>setTimeout(r,500));
      if(process.env.SHOT_BGPOS) await page.addStyleTag({content:'#phone.campMode #cstMain .bmapFloor{background-position:center '+process.env.SHOT_BGPOS+' !important}'});
      if(process.env.SHOT_BGZ) await page.addStyleTag({content:'#phone.campMode #cstMain .bmapFloor{background-size:auto '+process.env.SHOT_BGZ+' !important}'});
      await new Promise(r=>setTimeout(r,400));
      const info=await page.evaluate(()=>{
        const out={imgs:[],canvas:[],css:[]};
        document.querySelectorAll('img').forEach(im=>{ const r=im.getBoundingClientRect();
          if(r.width>40&&r.height>40) out.imgs.push({src:(im.currentSrc||im.src).split('/').slice(-2).join('/'),
            nat:im.naturalWidth+'x'+im.naturalHeight, shown:Math.round(r.width)+'x'+Math.round(r.height),
            zoom:+(r.width/(im.naturalWidth||1)).toFixed(2)}); });
        document.querySelectorAll('canvas').forEach(c=>{ const r=c.getBoundingClientRect();
          if(r.width>40) out.canvas.push({id:c.id, buf:c.width+'x'+c.height, shown:Math.round(r.width)+'x'+Math.round(r.height),
            zoom:+(r.width/(c.width||1)).toFixed(2), dpr:window.devicePixelRatio}); });
        document.querySelectorAll('*').forEach(el=>{ const bi=getComputedStyle(el).backgroundImage;
          if(bi && bi!=='none' && bi.indexOf('url(')>=0){ const r=el.getBoundingClientRect();
            if(r.width>60&&r.height>60) out.css.push({el:(el.id||el.className||el.tagName).toString().slice(0,26),
              url:bi.slice(bi.lastIndexOf('/')+1, bi.indexOf(')')).replace(/["']/g,''),
              size:getComputedStyle(el).backgroundSize, box:Math.round(r.width)+'x'+Math.round(r.height)}); } });
        return out; });
      console.log(JSON.stringify(info,null,1));
    }
    else if (WHAT === 'tabs') {   // 인게임 유즈맵 탭바(#tabs) — 전장 위에 얹힌 상태
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); });
      await new Promise(r=>setTimeout(r,900));
      await page.evaluate(() => { try{ enterSandbox(); }catch(e){} });
      await new Promise(r=>setTimeout(r,2200));
      await page.evaluate(()=>{   // 종족 선택이 떠 있으면 통과시킨다
        const ov=document.getElementById('campRaceOv');
        if(ov && !ov.classList.contains('hide')){
          const btns=[...ov.querySelectorAll('button')];
          const go=btns.find(b=>/시작/.test(b.textContent||''));
          if(go) go.click(); } });
      await new Promise(r=>setTimeout(r,2600));
      const info=await page.evaluate(()=>{ const t=document.getElementById('tabs');
        if(!t) return {no:'tabs 없음'};
        const cs=getComputedStyle(t); const r=t.getBoundingClientRect();
        const tab=t.querySelector('.tab'); const ts=tab?getComputedStyle(tab):null;
        return {h:Math.round(r.height), bg:cs.backgroundImage.slice(0,40), vis:cs.visibility,
          tabBg:ts?ts.backgroundImage.slice(0,30):'-', tabBorder:ts?ts.borderTopWidth:'-',
          tabRadius:ts?ts.borderTopLeftRadius:'-', tabDir:ts?ts.flexDirection:'-',
          n:t.querySelectorAll('.tab').length}; });
      console.log(JSON.stringify(info));
      const gap=await page.evaluate(()=>{ const t=document.getElementById('tabs');
        const tabs=[...t.querySelectorAll('.tab')].filter(e=>getComputedStyle(e).display!=='none');
        const rows=tabs.map(e=>{ const r=e.getBoundingClientRect();
          const ti=e.querySelector('.ti'); const ir=ti?ti.getBoundingClientRect():null;
          const txt=(e.textContent||'').trim();
          return {t:txt, w:Math.round(r.width), left:Math.round(r.left), right:Math.round(r.right),
            over:e.scrollWidth>e.clientWidth+1}; });
        const gaps=[]; for(let i=1;i<rows.length;i++) gaps.push(rows[i].left-rows[i-1].right);
        const on=t.querySelector('.tab.on');
        const af=on?getComputedStyle(on,'::after'):null;
        return {rows, gaps, onLabel:on?on.textContent.trim():'-',
          onAfter:af?{c:af.content,h:af.height,bg:af.backgroundImage.slice(0,50)}:null}; });
      console.log(JSON.stringify(gap,null,1));
    }
    else if (WHAT === 'home') { await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); }); await new Promise(r=>setTimeout(r,900)); }
    else if (WHAT === 'settings') { await page.evaluate(() => openAppSettings()); await new Promise(r=>setTimeout(r,400)); }
    // 인게임 하단 — 프로필(#unitCmd) + 하단 네비(#tabs). 관리자 샌드박스로 바로 들어가 유닛을 하나 지정한다.
    //   ingame       무선택(기본 상태)   ingame:sel  유닛 지정 → 프로필 카드   ingame:chat  채팅바 열림
    else if (WHAT.startsWith('ingame')) { const sel=WHAT.split(':')[1]||'';
      await page.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); enterSandbox();
        // 부팅 타이틀(#titleBlack/#titleMark)은 정상 진입 경로에서만 걷힌다 — 샌드박스는 직접 내린다
        ['titleBlack','titleMark'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.opacity='0'; }); });
      await new Promise(r=>setTimeout(r,1000));
      // 시트(.bp)를 올려야 하단 프로필이 보인다 — 스모크가 쓰는 그 두 줄과 같다
      await page.evaluate(() => { document.body.classList.add('sheetOpen');
        if(typeof openMainHome==='function') openMainHome(); });
      await new Promise(r=>setTimeout(r,400));
      if(sel==='chat') await page.evaluate(() => { if(typeof chatOpenBar==='function') chatOpenBar(); });   // 채팅바 열린 상태
      else if(sel) await page.evaluate(() => { const u=(G.units||[])[0]; if(u){ G.sel=[u.uid]; G.sheetDown=false;
        document.body.classList.add('sheetOpen'); refreshSelCard(); } });
      await new Promise(r=>setTimeout(r,800)); }
    // 캠프 종족 선택 — race / race:zerg / race:protoss (딤이 그림을 제대로 눌러 주는지 종족별로 봐야 한다)
    else if (WHAT.startsWith('race')) { const r0=WHAT.split(':')[1]||'';
      await page.evaluate((rk) => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷');
        openHome(); campRaceSheet(); if(rk) campRaceSel(rk); }, r0);
      await new Promise(r=>setTimeout(r,1400)); }
    else if (WHAT === 'press') {
      const box = await page.evaluate(() => { const r=document.getElementById('authGuest').getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; });
      await page.mouse.move(box.x, box.y); await page.mouse.down();
      await new Promise(r=>setTimeout(r,150));
      const st = await page.evaluate(() => { const e=document.getElementById('authGuest'); const c=getComputedStyle(e), b=getComputedStyle(e,'::before'), a=getComputedStyle(e,'::after');
        return {bg:c.backgroundImage+' | '+c.backgroundColor, shadow:c.boxShadow, before:b.display+' '+b.backgroundImage.slice(0,40), after:a.display+' '+a.backgroundImage.slice(0,40), clip:c.clipPath}; });
      console.log('  [눌림] '+JSON.stringify(st,null,1));
    }
    else if (WHAT === 'focus') { await page.evaluate(() => { const b=document.getElementById('authGuest'); b.focus(); }); await new Promise(r=>setTimeout(r,200)); }
    else if (WHAT === 'guest') {
      const seen = await page.evaluate(() => { const vis=()=>[...document.querySelectorAll('#phone *')].filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>0.02&&e.getBoundingClientRect().width>30&&e.getBoundingClientRect().height>10;}).map(e=>e.id||'.'+(e.className.split?e.className.split(' ')[0]:''));
        const before=new Set(vis()); window.__before=before; authGuest(); return [...before].length; });
      await new Promise(r=>setTimeout(r, AT != null ? AT : 120));
      const trace=await page.evaluate(() => new Promise(res=>{
        const key=e=>(e.id||('.'+(e.className&&e.className.split?e.className.split(' ')[0]:'')))+ '@' + Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height);
        const vis=()=>new Set([...document.querySelectorAll('#phone *')].filter(e=>{const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden'||+c.opacity<0.05)return false;const r=e.getBoundingClientRect();return r.width>40&&r.height>8;}).map(key));
        let prev=vis(); const log=[]; const t0=performance.now();
        const iv=setInterval(()=>{ const t=Math.round(performance.now()-t0); const cur=vis();
          const add=[...cur].filter(x=>!prev.has(x)), del=[...prev].filter(x=>!cur.has(x));
          if(add.length||del.length) log.push(t+'ms +['+add.join(',')+'] -['+del.join(',')+']');
          prev=cur; if(t>1200){clearInterval(iv);res(log);} },25); }));
      console.log('  [추적] '+trace.join(' || '));
      const now = await page.evaluate(() => { const vis=()=>[...document.querySelectorAll('#phone *')].filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>0.02&&e.getBoundingClientRect().width>30&&e.getBoundingClientRect().height>10;}).map(e=>e.id||'.'+(e.className.split?e.className.split(' ')[0]:''));
        return vis().filter(x=>!window.__before.has(x)); });
      console.log('  [새로 보임] '+JSON.stringify(now));
    }
    else if (WHAT === 'authhub2form') { await new Promise(r=>setTimeout(r,900));
      await page.evaluate(() => authOpenForm('id')); await new Promise(r => setTimeout(r, AT != null ? AT : 110)); }
    else if (WHAT === 'authswap') { await page.evaluate(() => authOpenForm('id')); await new Promise(r=>setTimeout(r,1500));
      const dbg=await page.evaluate(() => { const a=document.getElementById('auth'); const pre=_authSwapRun; const before=a.className; authMode('signup'); return {호출전_run:pre, before, after:a.className, 호출후:_authSwapRun}; });
      console.log('  [swap] '+JSON.stringify(dbg)); await new Promise(r => setTimeout(r, AT != null ? AT : 110)); }
    else if (WHAT === 'authsignup') { await page.evaluate(() => { authOpenForm('id'); authMode('signup'); }); await new Promise(r => setTimeout(r, 500)); }
    else if (WHAT === 'authform') { await page.evaluate(() => authOpenForm('id')); await new Promise(r => setTimeout(r, 400)); }
    else if (WHAT === 'loading') { await page.evaluate(() => showLoading(function(){}, 9000)); await new Promise(r => setTimeout(r, AT != null ? AT : 1200)); }
    else await new Promise(r => setTimeout(r, 400));
  }
  const st = await page.evaluate(() => ({
    parts:(()=>{const p=document.getElementById('phone').getBoundingClientRect();const g=q=>{const e=document.querySelector(q);if(!e)return null;const r=e.getBoundingClientRect();return {top:Math.round(r.top-p.top),bottom:Math.round(r.bottom-p.top),h:Math.round(r.height),w:Math.round(r.width)};};return {마크_로그인:g('.authMark'),마크_로딩:g('.opLogo'),제목_로그인:g('.authLogo'),제목_로딩:g('.opTitle'),부제_로그인:g('.authSub'),부제_로딩:g('.opSub')};})(),
    marks:(()=>{const p=document.getElementById('phone').getBoundingClientRect();const g=q=>{const e=document.querySelector(q);if(!e)return null;const r=e.getBoundingClientRect();return Math.round(p.bottom-r.bottom);};return {authHead:g('.authHead'), opMid:g('.opMid'), chat:(()=>{const c=document.getElementById('chatBar');return c?getComputedStyle(c).visibility:null;})(), authInTop:(()=>{const e=document.querySelector('.authIn');if(!e)return null;return Math.round(p.bottom-e.getBoundingClientRect().top);})(), phoneH:Math.round(p.height)};})(),
    headRect:(()=>{const e=document.querySelector('.authHead'),p=document.getElementById('phone');if(!e||!p)return null;const r=e.getBoundingClientRect(),q=p.getBoundingClientRect();return {topPct:+(((r.top-q.top)/q.height)*100).toFixed(1), bottomFromPhoneBottom:Math.round(q.bottom-r.bottom), h:Math.round(r.height)};})(),
    layers:(()=>{const g=id=>{const e=document.getElementById(id);if(!e)return null;const c=getComputedStyle(e);return {z:c.zIndex,op:c.opacity,disp:c.display,parent:e.parentElement.id};};return {titleBlack:g('titleBlack'),titleMark:g('titleMark'),homeScreen:g('homeScreen'),phoneCls:document.getElementById('phone').className};})(),
    authProbe:(()=>{const e=document.querySelector('.authIn');if(!e)return null;const c=getComputedStyle(e);const a=document.getElementById('auth');return {op:c.opacity, trans:c.transition, delay:c.transitionDelay, cls:a.className, tAuth:getComputedStyle(document.documentElement).getPropertyValue('--t-auth').trim()};})(),
    setProbe:(()=>{const t=document.querySelector('#settingsPop .setTitle');if(!t)return null;const af=getComputedStyle(t,'::after');const q=document.querySelector('#settingsPop .setQGo');const r=document.querySelector('#settingsPop .setQRow');const cd=document.querySelector('#settingsPop .setCard');const cds=cd?getComputedStyle(cd):null;const x=document.querySelector('#settingsPop .setX');const me=document.querySelector('#settingsPop .setMe');return {card:cds?(cds.backgroundImage.slice(0,26)+' | '+cds.backgroundColor+' | bw='+cds.borderTopWidth):null, setX:x?getComputedStyle(x).color:null, meBorder:me?getComputedStyle(me).borderBottomColor:null, titleAfter:af.display+' '+(af.backgroundImage||'').slice(0,28), qgo:q?getComputedStyle(q).backgroundImage.slice(0,18)+' bw='+getComputedStyle(q).borderTopWidth+' bg2='+getComputedStyle(q).backgroundColor:null, sw:(()=>{const w=document.querySelector('#settingsPop .setSw.on');if(!w)return null;const k=w.querySelector('i');return getComputedStyle(w).backgroundImage.slice(0,18)+' | knob '+getComputedStyle(k).width+'x'+getComputedStyle(k).height;})(), row:r?getComputedStyle(r).fontWeight+' '+getComputedStyle(r).fontSize:null, popCls:document.getElementById('settingsPop').className};})(),
    guestBtn:(()=>{const e=document.getElementById('authGuest');if(!e)return null;const c=getComputedStyle(e),b=getComputedStyle(e,'::before'),a=getComputedStyle(e,'::after');return {clip:c.clipPath, bg:c.backgroundImage+'/'+c.backgroundColor, before:b.content+' disp='+b.display+' bg='+(b.backgroundImage||'').slice(0,30), after:a.content+' disp='+a.display};})(),
    flds:(()=>{const g=id=>{const e=document.getElementById(id);if(!e)return null;const c=getComputedStyle(e),r=e.getBoundingClientRect();return {op:+(+c.opacity).toFixed(2),h:Math.round(r.height),cls:(e.className.match(/fieldw+/)||['-'])[0]};};return {nick:g('authNick'),pw2:g('authPw2')};})(),
    panels:(()=>{const ph=document.getElementById('phone').getBoundingClientRect();const g=id=>{const e=document.getElementById(id);if(!e)return null;const c=getComputedStyle(e),r=e.getBoundingClientRect();return {op:+(+c.opacity).toFixed(2),disp:c.display,밑변:Math.round(ph.bottom-r.bottom),윗변:Math.round(ph.bottom-r.top)};};return {hub:g('authHub'),form:g('authForm')};})(),
    authIn:(()=>{const e=document.querySelector('.authIn');const a=document.getElementById('auth');return e?{op:+(+getComputedStyle(e).opacity).toFixed(2), inView:a.classList.contains('inView'), authHidden:a.classList.contains('hide'), openingOp:+(+getComputedStyle(document.getElementById('opening')).opacity).toFixed(2)}:null;})(),
    gear:(()=>{const e=document.querySelector('.authGear');if(!e)return null;const c=getComputedStyle(e),sv=e.querySelector('svg'),cs=getComputedStyle(sv),r=e.getBoundingClientRect();const ai=document.querySelector('.authIn');return {터치:Math.round(r.width)+'x'+Math.round(r.height), 글리프:cs.width, 톱니:+(+c.opacity).toFixed(2), 버튼:+(+getComputedStyle(ai).opacity).toFixed(2), 판:getComputedStyle(e,'::before').content};})(),
    artBg: document.getElementById('phone').classList.contains('artBg'),
    titleBgOpacity: getComputedStyle(document.getElementById('titleBg')).opacity,
    opening: !document.getElementById('opening').classList.contains('hide'),
    auth: !document.getElementById('auth').classList.contains('hide'),
  }));
  await page.screenshot({ path: OUT });
  console.log(WHAT + ' → ' + path.basename(OUT));
  console.log('  ' + JSON.stringify(st));
} finally { await browser.close(); server.close(); }
