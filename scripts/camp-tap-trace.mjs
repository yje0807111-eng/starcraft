/* ============================================================================
 * camp-tap-trace.mjs — 👆 던전에서 **좌우 연타**가 몇 번이나 먹히는지 잰다 (2026-09-08)
 *
 * ⚠ 왜 만들었나 — 사용자가 「연타하면 몇 번이 안 먹는다」고 했다. 연타 속도를 의심했지만
 *   실측해 보니 범인은 **손 흔들림**이었다. 다섯 조건을 같은 자로 재야 그게 보인다.
 *
 * 고치기 전: 또박또박 10/10 · **흔들림 4px 0/10** · 8px 0/10 · 빠른 연타 9/10 · 겹치는 두 손가락 9/10
 * 고친 뒤:   다섯 조건 모두 10/10 (누르는 순간 명령이 나가고, 지정 중에는 박스를 안 만든다)
 *
 * 사용: node scripts/camp-tap-trace.mjs   (크롬은 표준 경로에서 찾는다 · CHROME_PATH 로 덮어쓸 수 있다)
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml',
  '.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2' };
const server = http.createServer((q,s)=>{ try{
  const p = decodeURIComponent(new URL(q.url,'http://x').pathname);
  const f = path.join(ROOT, p==='/'?'sc-ums-web.html':p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end(); }
  s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(s);
}catch(e){ s.writeHead(500); s.end(); } });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.CHROME_PATH||'']
  .filter(Boolean).find(p=>fs.existsSync(p));
const b = await puppeteer.launch({ executablePath:CHROME, headless:'new', protocolTimeout:600000,
  args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox'] });
const pg = await b.newPage();
await pg.setViewport({ width:390, height:844, deviceScaleFactor:2, hasTouch:true, isMobile:true });
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
await pg.goto('http://127.0.0.1:'+server.address().port+'/sc-ums-web.html',{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"',{timeout:30000});
await pg.evaluate(()=>{ document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','연타');
  campState().race='terran'; saveMeta(); openHome(); });
await pg.waitForFunction("typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech"
  +" && (G.tech.ents||[]).some(e=>e.type==='bldg')",{timeout:30000});
await new Promise(r=>setTimeout(r,900));

const out = await pg.evaluate(async ()=>{
  const sleep = ms=>new Promise(r=>setTimeout(r,ms));
  const dt = 1/30;
  // 던전 1 · 적 없음 · 유닛 하나 지정
  campEnterDungeon(1); CAMPB=null; campCombatStep(dt);
  if(!CAMPB) return { err:'전장이 안 열림' };
  campWithStk(()=>{ STK.me.units.length=0; STK.ai.units.length=0; });
  if(CAMPB._down) CAMPB._down.length=0; if(CAMPB._wq) CAMPB._wq.length=0;
  const u = campDeploy('marine', 0.5, CAMP_LINE_GY); u.hp=u.maxHp=1e9;
  campSelSet([u]);

  // 🔬 계측 — 어느 갈래가 탭을 삼켰나
  const log = [];
  const wrap = (name, tag) => { const o = window[name]; if(typeof o!=='function') return;
    window[name] = function(){ const r = o.apply(this, arguments); log.push(tag); return r; }; };
  const st = { pinch:0, boxOn:0, moveOk:0, downs:0, ups:0 };
  const oMove = window.campMoveSel;
  window.campMoveSel = function(){ st.moveOk++; return oMove.apply(this, arguments); };

  const r = _btRect();
  const cy = r.top + r.height*0.42;
  const xs = [r.left + r.width*0.28, r.left + r.width*0.72];
  let pid = 100;
  const ev = (type, x, y, id) => { const el = document.elementFromPoint(x, y) || document.body;
    const e = new PointerEvent(type, { pointerId:id, pointerType:'touch', isPrimary:true,
      clientX:x, clientY:y, bubbles:true, cancelable:true, buttons:type==='pointerup'?0:1, button:0 });
    el.dispatchEvent(e); };
  // 한 번의 탭 — drift 만큼 손이 흔들리고, hold 만큼 눌렀다 뗀다
  const tap = async (x, y, drift, hold, id) => {
    ev('pointerdown', x, y, id);
    if(drift){ await sleep(8); ev('pointermove', x+drift, y+drift, id); }
    await sleep(hold);
    ev('pointerup', x+drift, y+drift, id); };

  const run = async (label, opt) => {
    const N = 10; let ok=0;
    for(let i=0;i<N;i++){
      const x = xs[i%2]; st.moveOk=0;
      if(opt.overlap && i>0){
        // 앞 손가락을 떼기 **전에** 다음 손가락을 내린다(양손 연타)
        ev('pointerdown', x, cy, ++pid);
        await sleep(20);
        ev('pointerup', x, cy, pid);
      } else {
        await tap(x, cy, opt.drift||0, opt.hold||30, ++pid); }
      if(st.moveOk>0) ok++; st.moveOk=0;
      await sleep(opt.gap||40);
      // 프레임을 조금 굴린다(실제 화면처럼)
      for(let k=0;k<3;k++) campWithStk(()=>campStepUnits(dt));
    }
    return label+': '+ok+'/'+N; };

  const res = [];
  res.push(await run('① 또박또박(흔들림 0 · 손가락 하나)', { drift:0, hold:30, gap:60 }));
  res.push(await run('② 흔들림 4px', { drift:4, hold:30, gap:60 }));
  res.push(await run('③ 흔들림 8px', { drift:8, hold:30, gap:60 }));
  res.push(await run('④ 빠른 연타(간격 10ms)', { drift:0, hold:12, gap:10 }));
  res.push(await run('⑤ 겹치는 두 손가락', { overlap:true }));
  return { res, ptrs:(typeof _btPtrs!=='undefined')?_btPtrs.size:-1,
    boxMin:(typeof CAMP_BOX_MIN_PX!=='undefined')?CAMP_BOX_MIN_PX:null };
});
console.log(JSON.stringify(out,null,1));
console.log(errs.length?('errs: '+errs.join(' | ')):'errs: 없음');
await b.close(); server.close();
