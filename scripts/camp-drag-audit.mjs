/* ============================================================================
 * camp-drag-audit.mjs — 🖐 「누르고 끌면 무엇이 되나」를 기지(0단계)와 던전(1단계)에서 대조한다
 *   (2026-09-08 · 사용자 신고 「던전은 지정 중에도 드래그가 돼서 명령이 씹힌다」)
 *
 * 기지의 규약은 한 줄이다 — 「지정 상태: 드래그/탭 = 이동 · 새 박스는 해제(✕) 후에만」.
 * 이 도구는 네 칸(지정 O/X × 빈 바닥/내 유닛 위)을 눌러 끌어 보고 무엇이 생겼는지 적는다.
 *
 * 고치기 전:  던전 지정O·유닛 위 = 박스+롱프레스팬   ← 기지는 「명령」
 *             던전 지정X·유닛 위 = 박스+롱프레스팬   ← 기지는 「박스」만
 * 고친 뒤:    네 칸 모두 기지와 같다
 *
 * 사용: node scripts/camp-drag-audit.mjs   (CHROME_PATH 로 크롬 경로를 덮어쓸 수 있다)
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
  const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','드래그');
  campState().race='terran'; saveMeta(); openHome(); });
await pg.waitForFunction("typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech"
  +" && (G.tech.ents||[]).some(e=>e.type==='bldg')",{timeout:30000});
await new Promise(r=>setTimeout(r,900));

const out = await pg.evaluate(async ()=>{
  const sleep = ms=>new Promise(r=>setTimeout(r,ms));
  const dt = 1/30;
  const r = _btRect();
  const S2C = (sx,sy)=>({ x:r.left+sx*r.width, y:r.top+sy*r.height });
  let pid = 500;
  const fire=(type,x,y,id)=>{ const el=document.elementFromPoint(x,y)||document.body;
    el.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:true,
      clientX:x,clientY:y,bubbles:true,cancelable:true,buttons:type==='pointerup'?0:1,button:0})); };
  // down → 20px 끌기 → 상태를 읽고 → up. 「끌었을 때 무엇이 생겼나」가 알고 싶은 것.
  const probe = async (x,y)=>{
    const id=++pid; fire('pointerdown',x,y,id);
    const armed = !!_campLongT;                       // 롱프레스 화면 이동이 걸렸나
    fire('pointermove',x+20,y+20,id);
    const st = { armed,
      campBox: !!(typeof _campBox!=='undefined' && _campBox && _campBox.on),
      btBox:   !!(typeof _btBox!=='undefined'   && _btBox   && _btBox.active),
      cmd:     !!(typeof _btCmd!=='undefined'   && _btCmd) };
    fire('pointerup',x+20,y+20,id); await sleep(20);
    return st; };
  const tag = s => (s.cmd?'명령':'') + (s.campBox||s.btBox?'박스':'') + (s.armed?'+롱프레스팬':'')
    || '아무것도 아님';

  const res = {};
  /* ── 기지(0단계) ── */
  { const C=campState(); C.dg=0; C.cleared=0; }
  // 유닛 하나를 기지에 세우고 지정
  const e = { eid:G.tech.eseq++, type:'unit', uid:'marine', x:0.5, y:0.55, pop:1 };
  G.tech.ents.push(e);
  const es = _techW2S(e.x, e.y), eC = S2C(es.x, es.y);
  G.tech.selU=[e.eid];
  res['기지 · 지정 O · 빈 바닥'] = tag(await probe(S2C(0.30,0.40).x, S2C(0.30,0.40).y));
  G.tech.selU=[e.eid];
  res['기지 · 지정 O · 내 유닛 위'] = tag(await probe(eC.x, eC.y));
  G.tech.selU=[];
  res['기지 · 지정 X · 빈 바닥'] = tag(await probe(S2C(0.30,0.40).x, S2C(0.30,0.40).y));
  G.tech.ents = G.tech.ents.filter(x=>x!==e); G.tech.selU=[];

  /* ── 던전(1단계) ── */
  campEnterDungeon(1); CAMPB=null; campCombatStep(dt);
  if(!CAMPB) return { err:'전장이 안 열림' };
  campWithStk(()=>{ STK.me.units.length=0; STK.ai.units.length=0; });
  if(CAMPB._down) CAMPB._down.length=0; if(CAMPB._wq) CAMPB._wq.length=0;
  const u = campDeploy('marine', 0.5, CAMP_LINE_GY); u.hp=u.maxHp=1e9;
  const W = CAMPB.world||4800, ug = campW2G(u.x,u.y,W), us = _techW2S(ug.gx,ug.gy), uC = S2C(us.x,us.y);
  campSelSet([u]);
  res['던전 · 지정 O · 빈 바닥'] = tag(await probe(S2C(0.30,0.40).x, S2C(0.30,0.40).y));
  campSelSet([u]);
  res['던전 · 지정 O · 내 유닛 위'] = tag(await probe(uC.x, uC.y));
  campSelClear();
  res['던전 · 지정 X · 빈 바닥'] = tag(await probe(S2C(0.30,0.40).x, S2C(0.30,0.40).y));
  campSelClear();
  res['던전 · 지정 X · 내 유닛 위'] = tag(await probe(uC.x, uC.y));
  return { res, holdMs:(typeof CAMP_HOLD_MS!=='undefined')?CAMP_HOLD_MS:null };
});
console.log(JSON.stringify(out,null,1));
console.log(errs.length?('errs: '+errs.join(' | ')):'errs: 없음');
await b.close(); server.close();
