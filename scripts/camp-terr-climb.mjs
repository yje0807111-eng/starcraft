/* ============================================================================
 * camp-terr-climb.mjs — 🚪 「오르막으로 **정말** 올라갈 수 있나」를 잰다 (2026-09-11)
 *
 * ⭐ **왜 필요한가** — 지형은 그림만 맞아서는 소용이 없다. 벽·절벽이 길을 막고 오르막
 *   하나만 뚫려 있는 것이 규칙인데, 그 규칙이 **살아 있는 판에서도 성립하는지**는 그림으로
 *   알 수 없다. 2026-09-11 에 오르막을 4칸 → 1칸으로 줄일 때 이걸 재려다 문서에 적힌 옛
 *   실측(8판)의 스크립트가 **남아 있지 않아** 처음부터 다시 짰다. 그래서 남긴다.
 *
 * 두 가지를 잰다:
 *   ① 정적 — 씨앗 여러 개로 지형을 굽고 **저지 → 고원** 물 붓기.
 *      오르막 칸을 막으면 못 올라가야 한다(= 「오르막이 유일한 통로」의 증거).
 *      통로 폭도 함께 잰다(오르막 열 중 실제로 위까지 뚫린 열).
 *   ② 살아 있는 판 — 실제 전투를 돌려 유닛이 오르막을 **밟고** 고원에 서는지.
 *
 * ⚠⚠ **전장 폭은 `CAMPB.world` 다**(21-camp-battle 과 같은 값). 여기를 틀리면 `campW2G` 가
 *   gx 2505 같은 값을 뱉고 **모든 수치가 조용히 거짓이 된다** — 처음 실행에서 「고원 도달
 *   1/6 · 오르막 0/6」이라는 가짜 실패를 봤다. 값이 이상하면 좌표부터 의심할 것.
 * ⚠ `window.campCombatStep=function(){}` 로 전투를 멈추는 판(camp-terr-shot)과 **같이 쓰지 말 것** —
 *   함수 선언은 delete 로 못 되돌려 전장이 아예 안 열린다.
 *
 * 사용: CHROME_PATH=/opt/pw-browsers/chromium node scripts/camp-terr-climb.mjs [씨앗수] [판수]
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
  args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:2});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof openHome==="function" && typeof campState==="function"',{timeout:30000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(2600);   // ⚠ 부팅이 끝나기를 기다린다 — 먼저 감추면 로그인 화면이 다시 선다
await pg.evaluate(()=>{ try{ TUTO_OFF=true; }catch(e){}   // 🎓 튜토리얼은 화면을 덮고 던전 진입을 되돌린다 — 검사에서는 끈다
  try{ const S=guideState(); if(S){ S.zt=S.zt||{}; for(const t of ZONE_TIPS) S.zt[t.id]=1; } }catch(e){}   // 🗺 구역 안내도 「이미 봤다」로
  if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','지형');
  try{ const C=campState(); if(C && !C.race) C.race='terran'; }catch(e){}
  try{ showAppScreen('homeScreen'); campOpen(); }catch(e){} });
await sleep(2000);
{ const ok=await pg.evaluate(()=>!!document.querySelector('#phone.campMode #cstMain .bmapFloor'));
  if(!ok){ console.error('⛔ 캠프가 안 열렸다'); await b.close(); server.close(); process.exit(1); } }

/* 🏰 던전으로 들어간다 — **지형은 던전에서만 켜진다**(집은 평지라 CAMPT 가 없다).
 *   ⛔ 여기서 전투를 멈추지 말 것 — ② 가 실제 전투를 돌려야 한다. */
await pg.evaluate(()=>{ try{ campEnterDungeon(1); }catch(e){} });
await sleep(1200);
{ const ok=await pg.evaluate(()=>campDgN()===1 && typeof CAMPT!=='undefined' && !!CAMPT);
  if(!ok){ console.error('⛔ 던전에 안 들어갔다 — 지형이 없다'); await b.close(); server.close(); process.exit(1); } }

const SEEDS=+(process.argv[2]||60), RUNS=+(process.argv[3]||6);

// ── ① 정적 — 마스크 위에서 저지 → 고원 물 붓기 ───────────────────────────
const stat = await pg.evaluate((N)=>{
  const out={ok:0, viaRamp:0, mouth:0, thru:0, ramps:0, bad:[]};
  const C=CAMPT.cols, W=CAMPT.rows;
  const flood=(blocked, start)=>{ const seen=new Uint8Array(C*W), q=[start]; seen[start]=1;
    while(q.length){ const i=q.pop(), tx=i%C, ty=(i/C)|0;
      for(const [nx,ny] of [[tx-1,ty],[tx+1,ty],[tx,ty-1],[tx,ty+1]]){
        if(nx<0||ny<0||nx>=C||ny>=W) continue; const j=ny*C+nx;
        if(seen[j]||blocked[j]) continue; seen[j]=1; q.push(j); } }
    return seen; };
  for(let s=0;s<N;s++){
    const seed=1000+s*7919;
    campTerrGen(1, seed); campTerrMask();
    const T=CAMPT, m=T._blk;
    let start=-1;                                        // 출발 = 레인 안 저지 칸(아래쪽)
    for(let ty=W-2; ty>=0 && start<0; ty--) for(let tx=2;tx<C-2;tx++){ const i=ty*C+tx;
      if(!T.h[i] && !m[i]){ start=i; break; } }
    if(start<0){ out.bad.push(seed); continue; }
    const seen=flood(m, start);
    let hit=0; for(let i=0;i<C*W;i++) if(seen[i] && T.h[i] && !T.r[i]) hit++;
    const m2=Uint8Array.from(m);                         // 오르막을 막아 본다
    for(let i=0;i<C*W;i++) if(T.r[i]) m2[i]=1;
    const seen2=flood(m2, start);
    let hit2=0; for(let i=0;i<C*W;i++) if(seen2[i] && T.h[i] && !T.r[i]) hit2++;
    for(let tx=0;tx<C;tx++){ let b0=-1;                  // 통로 폭 — 위까지 뚫린 열
      for(let ty=0;ty<W;ty++) if(T.r[ty*C+tx]) b0=ty;
      if(b0<0) continue; out.ramps++;
      const i=b0*C+tx, up=(b0-1)*C+tx;
      if(seen[i]) out.mouth++;
      if(seen[i] && b0>0 && !m[up] && seen[up]) out.thru++; }
    if(hit>0) out.ok++; else out.bad.push(seed);
    if(hit>0 && hit2===0) out.viaRamp++; }
  return out; }, SEEDS);
const pct=(a,b)=>b? (a/b*100).toFixed(1)+'%' : '-';
console.log(`정적 ${SEEDS}판 — 고원 도달 ${stat.ok}/${SEEDS} · 오르막이 유일한 길 ${stat.viaRamp}/${SEEDS}`
  + ` · 오르막 열 ${stat.ramps}칸 중 입구에 닿는 칸 ${pct(stat.mouth,stat.ramps)}`
  + ` · 위까지 뚫린 칸 ${pct(stat.thru,stat.ramps)}`
  + (stat.bad.length? ' ⛔ 실패 씨앗 '+stat.bad.join(','):''));
// ── ② 살아 있는 판 — 유닛이 오르막을 밟고 고원에 서나 ───────────────────
const out = await pg.evaluate(async (RUNS)=>{
  const R=[];
  for(let r=0;r<RUNS;r++){
   try{
    campEnterDungeon(1); campState().foeSeed = 4200 + r*131;
    CAMPB=null; campCombatStep(0.05);
    if(!CAMPB || typeof CAMPT==='undefined' || !CAMPT){ R.push({err:'전장 없음'}); continue; }
    campWithStk(()=>{ if(STK&&STK.me) STK.me.units.length=0; if(STK&&STK.ai) STK.ai.units.length=0; });
    if(CAMPB._down) CAMPB._down.length=0;
    if(CAMPB._wq) CAMPB._wq.length=0;
    campWithStk(()=>{ for(let i=0;i<8;i++) strikeSpawnUnit('me','marine'); });
    if(!CAMPB || !CAMPB.me){ R.push({err:'CAMPB 가 사라졌다'}); continue; }
    const T=CAMPT, C=T.cols, W=T.rows, span=(T.wy1-T.wy0);
    let botRow=-1;
    for(let ty=0;ty<W;ty++) for(let tx=0;tx<C;tx++) if(T.h[ty*C+tx] && ty>botRow) botRow=ty;
    let onHi=0, stuck=0, frames=0; const seenRamp=new Set();
    for(let f=0; f<3600; f++){
      try{ campCombatStep(0.05); }catch(e){ break; }
      frames++;
      if(!CAMPB || !CAMPB.me) break;
      for(const u of (CAMPB.me.units||[])){
        if(u.dead) continue;
        const g=campW2G(u.x,u.y,(CAMPB&&CAMPB.world)||4800);
        const tx=Math.max(0,Math.min(C-1,Math.floor(g.gx*C)));
        const ty=Math.max(0,Math.min(W-1,Math.floor((g.gy-T.wy0)/span*W)));
        const i=ty*C+tx;
        if(T.r[i]) seenRamp.add(u);
        if(T.h[i] && !T.r[i] && ty<botRow) onHi++;
        if(T._blk && T._blk[i]) stuck++;
      }
      if(onHi>0 && seenRamp.size>0) break;
    }
    R.push({ hi:onHi>0, ramp:seenRamp.size, stuck, sec:+(frames*0.05).toFixed(1),
             alive:(CAMPB&&CAMPB.me?(CAMPB.me.units||[]).filter(u=>!u.dead).length:-1) });
   }catch(e){ R.push({err:String(e.message).slice(0,90)}); }
  }
  return R;
}, RUNS);
console.log('살아 있는 판:', JSON.stringify(out));
const ok=out.filter(r=>r.hi).length, rmp=out.filter(r=>r.ramp>0).length;
console.log(`고원 도달 ${ok}/${out.length} · 오르막을 밟은 판 ${rmp}/${out.length} · 막힌 칸 프레임 ${out.map(r=>r.stuck).join(',')}`);
await b.close(); server.close();
