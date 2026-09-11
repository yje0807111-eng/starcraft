/* ============================================================================
 * camp-clear.mjs — **던전을 끝까지 미는 데 얼마의 화력이 드나** (2026-09-11)
 *
 * ⭐ 재는 것: 던전 D 를 병력 N 기(화력 배수 MUL)로 **드래그해 밀어** 끝까지 깨는 시간.
 *   미는 방식은 스모크 「던전 1 이 실제로 깨진다」와 **같은 경로**다(전원 지정 → campMoveSel).
 *   ⛔ `_post` 를 직접 옮기지 말 것 — 실제 명령 경로가 아니면 재는 것이 달라진다.
 *
 * ⚠ **왜 camp-bench.mjs 로 못 재나** — 그 벤치는 라운드 시절 물건이고 사람 조작 흉내가
 *   「제자리 방어」(벙커 뒤 반원)라 **쳐들어가는 지금 던전과 어긋난다**(BALANCE §5-9).
 *   이 스크립트는 그 자리를 **전투 쪽만** 대신한다(경제는 여전히 벤치 몫).
 *
 * ⛔ **전장이 닫혔다 = 졌다가 아니다.** 완주도 `campBattleClose` 를 지난다 — 여기서 한 번
 *   속아서 「던전 1 을 못 깬다」는 잘못된 결론을 냈다. 판정은 **`C.dgDone[D]` 하나**로 본다.
 *
 * 📊 실측 기준선(2026-09-11 · 화력병 20기 · BALANCE §5-11):
 *     던전 1 ×5 → 164초 · 던전 2 ×36 → 172초 · 던전 3 ×257 → 141초
 *   필요 배수의 비가 `campFoeDiff` 와 정확히 같다(7.2 / 51.4).
 *
 * 사용: CHROME_PATH=... node scripts/camp-clear.mjs <던전> <병력수> "<배수,...>" [유닛] [제한초]
 *   예:  node scripts/camp-clear.mjs 1 20 "5,3" machinegun 400
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core';
import url from 'node:url';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const CHROME=process.env.CHROME_PATH
  || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>fs.existsSync(p));
if(!CHROME){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
const D=+(process.argv[2]||1), N=+(process.argv[3]||20);
const MULS=(process.argv[4]||'5').split(',').map(Number);
const UNIT=process.argv[5]||'machinegun';
const LIMIT=+(process.argv[6]||400);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((q,r)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 const f=path.join(ROOT,p==='/'?'sc-ums-web.html':p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
 fs.createReadStream(f).pipe(r);}catch(e){r.writeHead(500);r.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',
  args:['--mute-audio','--no-sandbox'],protocolTimeout:900000});
const pg=await browser.newPage(); await pg.setViewport({width:390,height:844});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message||e).slice(0,180)));
await pg.goto('http://127.0.0.1:'+server.address().port+'/sc-ums-web.html',{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campCombatStep==="function"',{timeout:30000});
await pg.evaluate(()=>{document.getElementById('opening')?.classList.add('hide');
 document.getElementById('auth')?.classList.add('hide');
 const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','클리어');
 const C=campState(); C.race='terran'; saveMeta(); openHome();});
await pg.waitForFunction("typeof campIsOn==='function'&&campIsOn()&&typeof G!=='undefined'&&G.tech&&(G.tech.ents||[]).some(e=>e.type==='bldg')",{timeout:30000});
await new Promise(r=>setTimeout(r,900));
const out=await pg.evaluate((D,N,MULS,UNIT,LIMIT)=>{
  window.requestAnimationFrame=()=>0;
  campStopFrame(); campStopTimer(); campAddRes(9e9,9e9);
  // 🔎 끝난 이유를 그대로 받는다 — campSay 가 패배·완주 문구의 단일 소스다
  const says=[]; { const o=window.campSay; window.campSay=function(m,k){ says.push(k+': '+m); return o&&o.apply(this,arguments); }; }
  const rows=[];
  for(const MUL of MULS){
    const C=campState(); C.dgDone={}; C.foeDead={};
    campEnterDungeon(0); campEnterDungeon(D); CAMPB=null; campCombatStep(0.05);
    if(!CAMPB){ rows.push({mul:MUL,err:'전장 없음'}); continue; }
    campWithStk(()=>{ STK.me.units.length=0; STK.ai.units.length=0; });
    for(let i=0;i<N;i++) campDeploy(UNIT, 0.26+(i%6)*0.048, 0.44+Math.floor(i/6)*0.032);
    CAMPB._started=false; CAMPB._gapT=0; campCombatStep(0.05);
    const me=CAMPB.me.units.slice();
    for(const u of me){ u.dmg*=MUL; u.maxHp*=MUL; u.hp=u.maxHp; }
    const push=()=>{ if(!CAMPB) return false; _campSel.length=0;
      for(const u of CAMPB.me.units) if(!u.dead) _campSel.push(u.uid);
      if(!_campSel.length) return false;
      const fr=campFoeFront(); if(!fr) return false;
      const g=campW2G(fr.x, fr.y+240, CAMPB.world); campMoveSel(g.gx, g.gy, true); return true; };
    let t=0, best=0, lastB=0, idle=0, pushes=0, done=false, lost=false; const gateLog=[], tl=[]; let nextT=0;
    push(); pushes++;
    while(t<LIMIT){
      campCombatStep(1/30); t+=1/30;
      // ⚠ **전장이 닫혔다 = 졌다가 아니다** — 완주도 campBattleClose 를 지난다(실측으로 한 번 속았다).
      //   판정은 `C.dgDone[D]` 하나로 본다.
      if(!CAMPB){ done=!!(C.dgDone && C.dgDone[D]); lost=!done; break; }
      best=Math.max(best, campBroken());
      if(campBroken()>=CAMP_DG_STEPS){ done=true; break; }
      if(campBroken()!==lastB){ lastB=campBroken(); idle=0;
        gateLog.push({gate:lastB, t:Math.round(t), alive:CAMPB.me.units.filter(u=>!u.dead).length}); }
      else idle+=1/30;
      if(idle>=12){ idle=0; if(push()) pushes++; }
      if(t>=nextT){ nextT+=2;
        const us=CAMPB.me.units.filter(u=>!u.dead);
        tl.push({t:Math.round(t), me:us.length, foe:campAlive('ai'),
          y:us.length?Math.round(us[0].y):null, home:Math.round(campHomeY(CAMPB.world)),
          base:Math.round(CAMPB.me.base.hp), g:campBroken()}); } }
    // 🔎 멈춘 자리 진단 — 무엇이 남았고 왜 못 때리나
    let diag=null;
    if(!done && CAMPB){
      const fb=(CAMPB._fbld||[]);
      const alive=fb.filter(b=>!b.dead&&(b.hp||0)>0);
      const fr=(typeof campFoeFront==='function')?campFoeFront():null;
      diag={ frontKind:fr?(fr.kind||fr.role):'없음', frontNm:fr?fr.nm:'-',
        prog:alive.filter(b=>b.role==='prog').map(b=>b.kind+'/z'+b.zone+'/s'+b.step
          +(typeof campFoeZoneOpen==='function'?(campFoeZoneOpen(b.zone)?'/열림':'/잠김'):'')),
        tower:alive.filter(b=>b.kind==='tower').map(b=>'z'+b.zone),
        foe:campAlive('ai'), myY:CAMPB.me.units.length?Math.round(CAMPB.me.units[0].y):null,
        homeY:Math.round(campHomeY(CAMPB.world)) }; }
    rows.push({ say:says.slice(-2), tl:tl.slice(-4), gateLog, diag, d:D, unit:UNIT, n:N, mul:MUL, done, lost, t:Math.round(t), best, pushes,
      alive:CAMPB?CAMPB.me.units.filter(u=>!u.dead).length:0,
      baseLeft:CAMPB?Math.round(100*CAMPB.me.base.hp/(CAMPB.me.base.maxHp||1)):0 });
    if(CAMPB) campWithStk(()=>{ STK.me.units.length=0; STK.ai.units.length=0; });
    campBattleClose(); }
  return rows;
}, D, N, MULS, UNIT, LIMIT);
for(const r of out){
  if(r.err){ console.log('던전', r.d, '×'+r.mul, '—', r.err); continue; }
  console.log('던전 ' + r.d + ' · ' + r.unit + ' ' + r.n + '기 · 화력 ×' + r.mul + ' → '
    + (r.done ? ('🏁 ' + r.t + '초 클리어 (드래그 ' + r.pushes + '회 · 생존 ' + r.alive + '기)')
              : ('💀 못 깸 — 최고 ' + r.best + '/6 · ' + r.t + '초 · 드래그 ' + r.pushes + '회'))
    + (r.say && r.say.length ? '   ⟨' + r.say[r.say.length-1] + '⟩' : ''));
  if(r.gateLog && r.gateLog.length)
    console.log('   관문별: ' + r.gateLog.map(g=>g.gate+'채 '+g.t+'초(병력 '+g.alive+')').join(' · '));
}
if(errs.length) console.log('ERR',errs.slice(0,3));
await browser.close(); server.close();
