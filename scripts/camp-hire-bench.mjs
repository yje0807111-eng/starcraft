/* ============================================================================
 * camp-hire-bench.mjs — 👷 **일꾼 축이 살아 있나** (2026-09-11)
 *
 * ⭐ 묻는 것 하나: **일꾼 한 기를 더 사는 것과 채취 강화 한 레벨을 사는 것 중 무엇이 이득인가.**
 *   둘 다 수입을 「왕복당 +N원」으로 **선형하게** 올리는 축이라 나란히 놓고 비교할 수 있다.
 *   ⇒ 자는 **회수 시간**(그 값을 그것이 벌어 갚는 데 몇 분)이다. 두 축의 회수 시간이 비슷해야
 *     「일꾼을 살까 강화를 살까」가 판단이 되고, 한쪽이 몇 자릿수 비싸면 그 축은 **죽는다.**
 *
 * ⚠ **모델로 추정하지 말 것.** 수입은 `campGatherMul` 한 줄에 던전 배수·환생 배수·마일스톤·
 *   룬이 전부 곱해져 있어서 손으로 세면 반드시 빗나간다 — 엔진을 돌려 **Δ수입**을 직접 잰다.
 *
 * ⚠ **일꾼이 캐는 일은 `renderBuildTab(dt)` 가 한다**(건설 탭의 틱) — 빼면 수입이 통째로 0 이다.
 *   화면에서는 `campFrame` 이 대신 불러 준다(여기선 프레임을 껐으므로 직접 부른다).
 *
 * 사용: CHROME_PATH=... node scripts/camp-hire-bench.mjs [측정초] [채취Lv,...]
 *   예:  node scripts/camp-hire-bench.mjs 60 "0,10,30,60"
 *   ⚠ **단독으로 돌릴 것**(벤치 규약).
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core'; import url from 'node:url';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const CHROME=process.env.CHROME_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>fs.existsSync(p));
if(!CHROME){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
const SEC=+(process.argv[2]||60);
const LVS=(process.argv[3]||'0,10,30,60').split(',').map(Number);
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
 const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','일꾼벤치');
 const C=campState(); C.race='terran'; saveMeta(); openHome();});
await pg.waitForFunction("typeof campIsOn==='function'&&campIsOn()&&G.tech&&(G.tech.ents||[]).some(e=>e.type==='bldg')",{timeout:30000});
await new Promise(r=>setTimeout(r,900));

const out=await pg.evaluate(async(SEC,LVS)=>{
  window.requestAnimationFrame=()=>0;
  campStopFrame(); campStopTimer();
  const C=campState();
  const tick=(dt)=>{ if(typeof renderBuildTab==='function'){ try{ renderBuildTab(dt); }catch(e){} }
    campApplyGatherMul(); campSyncHire(); campSyncSupply(); campCombatStep(dt); };
  const setW=(n)=>{ const T=G.tech;
    T.ents=(T.ents||[]).filter(e=>e.type!=='worker');
    for(let i=0;i<n;i++) T.ents.push({ eid:T.eseq++, type:'worker', x:0.30+(i%20)*0.02, y:0.86-Math.floor(i/20)*0.02 });
    T.sup=0; T.supCap=9999; };
  // 분당 수입 — 예열 10초 뒤 SEC 초를 잰다(⚠ 예열을 빼면 첫 왕복이 안 끝나 값이 낮게 나온다)
  const inc=(n)=>{ setW(n); C.earn=0;
    for(let i=0;i<200;i++){ tick(0.05); if((i%20)===0) campAutoGather(); }
    C.earn=0; const N=Math.round(SEC/0.05);
    for(let i=0;i<N;i++){ tick(0.05); if((i%20)===0) campAutoGather(); }
    return (C.earn||0)/SEC*60; };
  const WS=[5,10,20,40,60,80];
  const rows=[];
  for(const L of LVS){
    C.upg = C.upg || {}; C.upg.gather = L;            // 채취 레벨을 박는다
    const I={}; for(const w of WS) I[w]=inc(w);
    // Δ(일꾼 한 기) — 이웃한 두 표본의 기울기로 잰다(한 기 차이는 잡음에 묻힌다)
    const slope=(w)=>{ const i=WS.indexOf(w);
      const a=WS[Math.max(0,i-1)], b=WS[Math.min(WS.length-1,i+1)];
      return (I[b]-I[a])/Math.max(1,(b-a)); };
    // Δ(채취 한 레벨) — 같은 일꾼 수에서 레벨만 +1
    const dG=(w)=>{ const was=C.upg.gather; const a=inc(w);
      C.upg.gather=was+1; const b=inc(w); C.upg.gather=was; return b-a; };
    const r={ L:L, w:{} };
    for(const w of WS){
      const dw=slope(w), hire=campHireCost(w);
      r.w[w]={ inc:Math.round(I[w]), dw:+dw.toFixed(1), hire:hire,
               pb: dw>0 ? hire/dw : Infinity };
    }
    { const w=20, dg=dG(w), gc=(function(){ const was=C.upg.gather; C.upg.gather=L;
        const c=campUpgCost('gather'); C.upg.gather=was; return c; })();
      r.gat={ w:w, dg:+dg.toFixed(1), cost:gc, pb: dg>0 ? gc/dg : Infinity }; }
    rows.push(r); }
  // 누적도 함께 — 「40기/80기를 채우는 데 얼마」가 이 축의 값이다
  const sum=(n)=>{ let t=0; for(let i=0;i<n;i++) t+=campHireCost(i); return t; };
  return { rows:rows, ws:WS, curve:{ h0:CAMP_HIRE0, p:CAMP_HIRE_P }, sum:{ s40:sum(40), s80:sum(80) } };
}, SEC, LVS);

const f=n=>!isFinite(n)?'∞':(n>=1e6?n.toExponential(1):Math.round(n).toLocaleString('en-US'));
console.log('\n════ 👷 일꾼 축이 살아 있나 (측정창 '+SEC+'초/표본) ════');
console.log('값 곡선: '+out.curve.h0+' × (보유+1)^'+out.curve.p
  +'   · 누적 40기 '+f(out.sum.s40)+' · 80기 '+f(out.sum.s80)+'\n');
for(const r of out.rows){
  console.log('── 채취 Lv.'+r.L+' ───────────────────────────────────────────');
  console.log('   일꾼    분당수입    일꾼+1의 Δ      그 일꾼 값        회수');
  for(const w of out.ws){ const x=r.w[w];
    console.log('   '+String(w).padStart(3)+'기  '+f(x.inc).padStart(10)+'  '+String(x.dw).padStart(10)
      +'  '+f(x.hire).padStart(14)+'  '+(isFinite(x.pb)?f(x.pb)+'분':'∞').padStart(12)); }
  console.log('   ⇒ 견줌: 채취 Lv.'+r.L+'→'+(r.L+1)+' (일꾼 '+r.gat.w+'기)  Δ '+r.gat.dg
    +' · 값 '+f(r.gat.cost)+' · 회수 '+(isFinite(r.gat.pb)?f(r.gat.pb)+'분':'∞'));
  { const wpb=r.w[20].pb, gpb=r.gat.pb;
    console.log('   ⇒ 일꾼 20기째가 채취보다 **'+(isFinite(wpb/gpb)?f(wpb/gpb):'∞')+'배** 느리게 갚는다\n'); }
}
if(errs.length) console.log('ERR', errs.slice(0,3));
await browser.close(); server.close();
