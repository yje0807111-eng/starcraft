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

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--mute-audio'] });
try {
  const page = await browser.newPage();
  const isPage = WHAT.endsWith('.html');   // 임의의 페이지를 통째로 찍는 모드(시안 비교용)
  await page.setViewport(isPage ? { width: 1640, height: 1030, deviceScaleFactor: 1 } : { width: 430, height: 880, deviceScaleFactor: 1 });
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
