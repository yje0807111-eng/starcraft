/* ============================================================================
 * reb-upg-bench.mjs — 🔁 **환생 강화 아홉 줄의 값어치를 잰다** (2026-09-11)
 *
 * ⚠ 메인이 **총액은 맞췄다**(전부 469점 · 한 환생 18~36점 → 15~25 바퀴 · BALANCE §5-12).
 *   여기서 재는 것은 그다음 물음, 즉 **항목끼리의 값 순서**다:
 *   ⭐ **같은 1점으로 무엇이 가장 많이 버나.**
 *
 * 🪙 자는 **포인트당 분당 미네랄**로 통일한다 — 그래야 갈래가 달라도 나란히 놓을 수 있다.
 *   ⚠ 그러자면 「편해지는 것」도 돈으로 바꿔야 한다. 바꾸는 규칙을 여기 적어 둔다(⛔ 숨기지 말 것):
 *     · `autoTap`   — 초당 n회 × 탭 1회 획득(`campTapRoll`) = 분당 미네랄. **정확하다.**
 *     · `capWk`     — 일꾼 +8기/레벨의 Δ수입을 **엔진으로 잰다**(자리도 같이 열린다).
 *     · `capUnitR`  — 돈이 아니라 **병력 수**다. 같은 예산으로 몇 기 더 사는지로 낸다(⚠ 환산 안 함).
 *     · `awayCap`   — 자리 비움 상한 +4시간/레벨. ⚠ **효율이 반이다**(`CAMP_AWAY_EFF` 0.5) —
 *                     빼먹으면 두 배로 세어진다(실제로 한 번 빼먹었다).
 *                     ⚠ **하루에 자리를 비우는 시간**을 가정해야 값이 나온다(기본 22시간 =
 *                     하루 2시간 논다). 기본 상한 8시간은 이미 잘리므로, 사서 **더 받는 것**은
 *                     `min(비움, 8+산 만큼) − min(비움, 8)` 시간뿐이다.
 *     · 켜고 끄는 넷(`autoUpg`·`autoWk`·`autoRes`·`autoDg`) — **손이 덜 가는 것**이라 돈으로 못 바꾼다.
 *                     ⛔ 억지로 환산하지 말 것. 대신 「무엇을 대신해 주나」를 수치로 적는다.
 *
 *     · `autoTap`   — ⚠ **탭 레벨을 같이 줘야 공정하다.** 탭 Lv.0 에서 재면 탭 1회가 2원이라
 *                     자동 채굴이 무조건 꼴찌로 나온다(처음에 그렇게 재서 「96배 약하다」가 나왔다).
 *
 * 사용: CHROME_PATH=... node scripts/reb-upg-bench.mjs [측정초] [채취Lv] [일꾼수] [탭Lv] [하루비움h]
 *   ⚠ **단독으로 돌릴 것**(벤치 규약).
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core'; import url from 'node:url';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const CHROME=process.env.CHROME_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p=>fs.existsSync(p));
if(!CHROME){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
const SEC=+(process.argv[2]||25), LV=+(process.argv[3]||30), WK=+(process.argv[4]||40);
const TAP=+(process.argv[5]||30), AWAY_H=+(process.argv[6]||22);
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
 const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','강화벤치');
 const C=campState(); C.race='terran'; saveMeta(); openHome();});
await pg.waitForFunction("typeof campIsOn==='function'&&campIsOn()&&G.tech&&(G.tech.ents||[]).some(e=>e.type==='bldg')",{timeout:30000});
await new Promise(r=>setTimeout(r,900));

const out=await pg.evaluate(async(SEC,LV,WK,TAP,AWAY_H)=>{
  window.requestAnimationFrame=()=>0;
  campStopFrame(); campStopTimer();
  const C=campState(); C.upg=C.upg||{}; C.upg.gather=LV; C.upg.tap=TAP;
  const bag=campRebUpgBag();
  const clear=()=>{ for(const k in bag) delete bag[k]; };
  const tick=(dt)=>{ if(typeof renderBuildTab==='function'){ try{ renderBuildTab(dt); }catch(e){} }
    campApplyGatherMul(); campMineCapSync(); campSyncHire(); campSyncSupply(); campCombatStep(dt); };
  const setW=(n)=>{ const T=G.tech;
    T.ents=(T.ents||[]).filter(e=>e.type!=='worker');
    for(let i=0;i<n;i++) T.ents.push({ eid:T.eseq++, type:'worker', x:0.30+(i%20)*0.02, y:0.86-Math.floor(i/20)*0.02 });
    T.sup=0; T.supCap=9999; };
  const inc=(n)=>{ setW(n); C.earn=0;
    for(let i=0;i<200;i++){ tick(0.05); if((i%20)===0) campAutoGather(); }
    C.earn=0; const N=Math.round(SEC/0.05);
    for(let i=0;i<N;i++){ tick(0.05); if((i%20)===0) campAutoGather(); }
    return (C.earn||0)/SEC*60; };
  // 한 줄을 0차 → max 까지 사는 총 포인트
  const total=(k)=>{ const d=CAMP_REB_UPG[k]; let s=0;
    for(let n=0;n<d.max;n++) s+=campRebUpgCost(k,n); return s; };
  // ⚠ **`campTapRoll()` 은 한 번의 굴림이다**(치명·피버가 섞인다) — 한 번만 부르면 값이
  //   두 배로 튄다(실측: 같은 레벨에서 220 과 441 이 나왔다). **평균**을 쓴다.
  const tapAvg=(n)=>{ let s=0; const N=n||4000; for(let i=0;i<N;i++) s+=campTapRoll().gain; return s/N; };
  const R={ lv:LV, wk:WK, lines:{}, base:{} };

  clear();
  R.base.inc = inc(WK);                                   // 기준 분당 수입
  R.base.tap = tapAvg();                                  // 탭 1회 획득(평균 · ⛔ 한 번 굴리지 말 것)
  R.base.wkMax = campWorkerMax(); R.base.seats = CAMP_MINE_COLS*campMineCap();
  R.base.awayS = campAwayCapS(); R.base.tapLv = TAP; R.base.awayH = AWAY_H;

  // ── ① 🤖 자동 채굴 — 초당 n회 × 탭 1회
  { const d=CAMP_REB_UPG.autoTap; clear(); bag.autoTap=d.max;
    const ps=campAutoTapPS();
    R.lines.autoTap={ pts:total('autoTap'), max:d.max, per:'분당 미네랄',
      gain: ps*60*tapAvg(), note:'초당 '+ps+'회' };
    // ⚠ **탭 레벨에 통째로 매달린다** — 몇 레벨에서 얼마인지 함께 찍는다(싸다 · 엔진 안 돈다).
    { const was=C.upg.tap; const curve=[];
      for(const t of [0,10,20,30,45,60]){ C.upg.tap=t;
        bag.autoTap=d.max; const g=campAutoTapPS()*60*tapAvg(); clear();
        curve.push({ tap:t, gain:g, ppp:g/R.lines.autoTap.pts }); }
      C.upg.tap=was; R.lines.autoTap.curve=curve; }
    clear(); }

  // ── ② 🔓 일꾼 상한 — 엔진으로 Δ수입을 잰다(자리도 같이 열린다)
  { const d=CAMP_REB_UPG.capWk; clear(); bag.capWk=d.max;
    const n2=campWorkerMax();
    const a=R.base.inc, b=inc(n2);
    R.lines.capWk={ pts:total('capWk'), max:d.max, per:'분당 미네랄',
      gain: b-a, note:WK+'기 → '+n2+'기 · 자리 '+(CAMP_MINE_COLS*campMineCap()) }; clear(); }

  // ── ③ 🔓 재구매 완화 — 돈이 아니라 **병력 수**다(⚠ 환산 안 함)
  { const d=CAMP_REB_UPG.capUnitR; clear();
    const base=(typeof campUnitBase==='function')?campUnitBase('machinegun',50):2000;
    const nBuy=(r,b)=>{ let n=0,left=b; for(;;){ const c=Math.max(1,Math.ceil(base*Math.pow(r,n)));
      if(c>left) break; left-=c; n++; if(n>5000) break; } return n; };
    const r0=campUnitRate(); bag.capUnitR=d.max; const r1=campUnitRate(); clear();
    const B=[1e6,1e8];
    R.lines.capUnitR={ pts:total('capUnitR'), max:d.max, per:'병력 수(환산 안 함)',
      r0:r0, r1:r1, rows:B.map(b=>({b:b, a:nBuy(r0,b), c:nBuy(r1,b)})) }; }

  // ── ④ 🌙 자리 비움 상한 — 그 시간의 수입(⚠ 하루 한 번 비운다고 가정)
  { const d=CAMP_REB_UPG.awayCap; clear();
    const h0=R.base.awayS/3600; bag.awayCap=d.max; const h1=campAwayCapS()/3600; clear();
    // 실제로 **더 받는 시간** — 비우는 시간이 짧으면 사도 소용이 없다
    const extraH = Math.min(AWAY_H, h1) - Math.min(AWAY_H, h0);
    const eff = (typeof CAMP_AWAY_EFF !== 'undefined') ? CAMP_AWAY_EFF : 0.5;
    R.lines.awayCap={ pts:total('awayCap'), max:d.max, per:'분당 미네랄(하루 평균)',
      gain: R.base.inc * extraH * eff / 24, h0:h0, h1:h1, extraH:extraH, eff:eff,
      note:h0+'h → '+h1+'h · 실제 +'+extraH+'h × 효율 '+eff }; }

  // ── ⑤ 🚪 던전 개방 — 시간 단축(돈이 아니다)
  { const d=CAMP_REB_UPG.dgStart; clear();
    R.lines.dgStart={ pts:total('dgStart'), max:d.max, per:'회차 시작 던전', note:'1 → '+(1+d.step*d.max) }; }

  // ── ⑥ 🤖 켜고 끄는 넷 — ⛔ 돈으로 환산하지 않는다. 「무엇을 대신하나」만 적는다.
  for(const k of ['autoUpg','autoWk','autoRes','autoDg'])
    R.lines[k]={ pts:total(k), max:CAMP_REB_UPG[k].max, per:'손이 덜 간다(환산 불가)' };

  // ── ⑦ 💰 **자동화 넷이 지갑을 비우지 않나** — 같은 문지기(CAMP_AUTOUPG_KEEP)를 나눠 쓴다.
  //   ⭐ 「편해지는 것」이 「유닛을 못 사는 것」이 되면 그건 편한 게 아니다(CLAUDE.md).
  //   ⚠ 벤치는 유닛을 안 사므로 **남은 돈의 비율**로 본다 — 자동화가 번 돈을 다 쓰면 0 에 가깝다.
  { const T=G.tech; setW(WK);
    const run=(on)=>{ clear(); if(on){ bag.autoUpg=1; bag.autoWk=1; bag.autoRes=1; bag.autoTap=CAMP_REB_UPG.autoTap.max; }
      T.credit=0; T.energy=1e12; C.earn=0; C.upg.gather=LV; C.upg.tap=TAP;
      _campAutoUpgAcc=0; _campAutoT=0; _campAutoTapAcc=0;
      const MIN=3, N=Math.round(MIN*60/0.05);
      for(let i=0;i<N;i++){ tick(0.05);
        if((i%20)===0){ campAutoGather();
          campAutoTapTick(1); campAutoUpgTick(1); campAutoTick(1); } }
      return { earn:C.earn||0, left:T.credit||0, wk:campWorkerNPlanned(),
               gl:campUpgLv('gather'), tl:campUpgLv('tap') }; };
    const off=run(false), on=run(true);
    R.wallet={ off:off, on:on,
      keepOff: off.earn>0 ? off.left/off.earn : 0,
      keepOn : on.earn>0  ? on.left/on.earn   : 0 }; clear(); }

  R.all=Object.keys(CAMP_REB_UPG).reduce((s,k)=>s+total(k),0);
  R.lap={ d3:CAMP_DG_MAX*CAMP_DG_STEPS*CAMP_REB_PT_GATE };
  clear(); return R;
}, SEC, LV, WK, TAP, AWAY_H);

const f=n=>!isFinite(n)?'∞':(Math.abs(n)>=1e6?n.toExponential(1):Math.round(n).toLocaleString('en-US'));
console.log('\n════ 🔁 환생 강화 — 같은 1점으로 무엇이 가장 많이 버나 ════');
console.log('잰 자리: 채취 Lv.'+out.lv+' · 탭 Lv.'+out.base.tapLv+' · 일꾼 '+out.wk+'기'
  +' · 분당 '+f(out.base.inc)+' · 탭 1회 '+f(out.base.tap)
  +' · 하루 자리 비움 '+out.base.awayH+'h 가정');
console.log('전부 사는 값 '+out.all+'점 · 한 환생(D3 완주) '+out.lap.d3+'점\n');
const money=['autoTap','capWk','awayCap'];
console.log('💰 돈으로 잴 수 있는 셋 — 포인트당 분당 미네랄');
const rows=money.map(k=>({k, ...out.lines[k], ppp: out.lines[k].gain/out.lines[k].pts}))
  .sort((a,b)=>b.ppp-a.ppp);
for(const r of rows)
  console.log('   '+r.k.padEnd(9)+String(r.pts).padStart(4)+'점 → +'+f(r.gain).padStart(9)
    +'/분  =  **'+f(r.ppp).padStart(7)+'/점**   ('+r.note+')');
{ const hi=rows[0], lo=rows[rows.length-1];
  console.log('   ⇒ 가장 센 '+hi.k+' 이 가장 약한 '+lo.k+' 보다 **'+f(hi.ppp/lo.ppp)+'배**\n'); }
{ const c=out.lines.autoTap.curve;
  console.log('   ⚠ 자동 채굴은 **탭 레벨에 통째로 매달린다** — 포인트당 분당:');
  console.log('      '+c.map(x=>'Lv.'+x.tap+' '+f(x.ppp)).join(' · '));
  console.log(); }
{ const u=out.lines.capUnitR;
  console.log('⚔ 재구매 완화 '+u.pts+'점 — 배수 '+u.r0.toFixed(2)+' → '+u.r1.toFixed(2)+' (병력 수 · ⚠ 돈으로 환산 안 함)');
  for(const r of u.rows) console.log('   예산 '+f(r.b).padStart(9)+' → '+r.a+'기 → '+r.c+'기 (+'
    +Math.round(1000*(r.c/r.a-1))/10+'%)');
  const d=out.lines.dgStart;
  console.log('🚪 던전 개방 '+d.pts+'점 — 회차 시작 던전 '+d.note+' (시간 단축 · ⚠ 환산 안 함)\n'); }
{ const w=out.wallet;
  console.log('💰 자동화 넷이 지갑을 비우지 않나 (3분 · 유닛은 안 산다)');
  console.log('   끄고: 번 돈 '+f(w.off.earn)+' · 남은 돈 '+f(w.off.left)
    +' ('+Math.round(w.keepOff*100)+'%) · 일꾼 '+w.off.wk+' · 채취Lv '+w.off.gl+' · 탭Lv '+w.off.tl);
  console.log('   켜고: 번 돈 '+f(w.on.earn)+' · 남은 돈 '+f(w.on.left)
    +' ('+Math.round(w.keepOn*100)+'%) · 일꾼 '+w.on.wk+' · 채취Lv '+w.on.gl+' · 탭Lv '+w.on.tl);
  console.log('   ⇒ '+(w.keepOn>=0.25 ? '✅ 유닛 살 돈이 남는다'
    : '❌ 자동화가 지갑을 비운다 — CAMP_AUTOUPG_KEEP 을 봐야 한다')+'\n'); }
console.log('🤖 켜고 끄는 넷 — ⛔ 돈으로 환산하지 않는다(손이 덜 가는 것이다)');
for(const k of ['autoUpg','autoWk','autoRes','autoDg'])
  console.log('   '+k.padEnd(9)+String(out.lines[k].pts).padStart(4)+'점');
if(errs.length) console.log('\nERR', errs.slice(0,3));
await browser.close(); server.close();
