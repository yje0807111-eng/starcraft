/* ============================================================================
 * reb-x2-sim.mjs — 🔁 ×2 환생권이 폭주를 부르나 (BALANCE.md §5-A6 · GEM.md §7-1)
 *
 * ⛔ **자체 전투 모델을 만들지 않는다.** 이 프로젝트는 자체 웨이브 모델을 네 번 짰다가
 *    전부 폐기했다(CLAUDE.md). 여기서 재는 것은 **포인트 경제**뿐이다 —
 *    campRebPtGain · campRtCost · campRtBuy · campRtMul · campRtFoeMul 을
 *    브라우저에서 **실제 함수 그대로** 부른다. 전투는 엔진 벤치(camp-bench.mjs)의 몫이다.
 *
 * 묻는 것 둘:
 *   ① 트리는 유한한가 — 총 비용과 상한(사다리 5차 · 적 약화 바닥)이 실제로 막혀 있나
 *   ② ×2 는 몇 회차를 앞당기나 — 같은 깊이 진행표에서 baseline vs ×2 의 티어 도달 시점
 *
 * 사용: CHROME_PATH=... node scripts/reb-x2-sim.mjs [회차수]
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const N=+(process.argv[2]||20);
// 깊이 진행표의 기울기 — 회차당 라운드 몇 칸. ⭐ 결론이 이 값에 안 흔들리는지 보려고 손잡이로 뺐다.
const STEP=+(process.env.STEP||10);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 let f=path.join(ROOT,p==='/'?'sc-ums-web.html':p); if(!f.startsWith(ROOT)){s.writeHead(403);return s.end();}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME=process.env.CHROME_PATH;
if(!CHROME||!fs.existsSync(CHROME)){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',protocolTimeout:600000,
  args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:1});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof campRebPtGain==="function" && typeof campRtBuy==="function"',{timeout:30000});

const out=await pg.evaluate((N,STEP)=>{
  const L=[]; const say=s=>L.push(s);
  const F=n=>{ if(!isFinite(n)) return '∞';
    for(const [s,v] of [['해',1e20],['경',1e16],['조',1e12],['억',1e8],['만',1e4]]) if(n>=v) return (n/v).toFixed(1)+s;
    return n<10?n.toFixed(2):n<1000?n.toFixed(1):n.toFixed(0); };
  const P=(s,n)=>String(s).padEnd(n);

  // ── 판을 하나 세운다(실제 상태 객체를 쓴다) ──
  document.getElementById('opening')?.classList.add('hide');
  document.getElementById('auth')?.classList.add('hide');
  const C0=()=>campState();
  function fresh(){
    const p=PROF(); p.camp=null;
    const C=campState(); if(!C) return null;
    C.race='terran'; C.dg=1; C.cleared=0; C.earn=0; C.earnGas=0;
    C.reb=0; C.rebMul=0; C.rbPts=0; C.rbTree={}; return C; }

  // ══ ① 트리는 유한한가 ════════════════════════════════════════════════
  say('=== ① 트리 총량 — 유한한가 ===');
  { const C=fresh(); if(!C) return ['캠프 상태를 못 만듦'];
    let total=CAMP_RT_BASE, per={};
    for(const Ln of CAMP_RT_LINES){ let s=0;
      for(let n=1;n<=5;n++) s+=campRtCost(Ln.k,n);
      per[Ln.k]=s; total+=s; }
    say(`계열 ${CAMP_RT_LINES.length}개 × 5차 + 시작점 1 = 노드 ${CAMP_RT_LINES.length*5+1}개`);
    say(`트리 전체 비용 = ${F(total)} 포인트  (티어당 ×${CAMP_RT_MUL} · 시작점 ${CAMP_RT_BASE})`);
    // 6차를 살 수 있나 — 사다리·차수 상한이 실제로 막는가
    C.rbPts=1e30; C.rbTree={root:1};
    for(const Ln of CAMP_RT_LINES) C.rbTree[Ln.k]=5;
    const over=[]; for(const Ln of CAMP_RT_LINES) if(campRtCanBuy(Ln.k)) over.push(Ln.k);
    say(`포인트 무한(1e30)으로 다 산 뒤 더 살 수 있는 계열: ${over.length?over.join(','):'없음 ✅'}`);
    say(`만렙 배수: 공격 ×${campRtMul('atk')} · 체력 ×${campRtMul('hp')} · 채취 ×${campRtMul('gather')} · 탭 ×${campRtMul('tapMul')}`);
    say(`만렙 적 약화 실효 배수 ×${campRtFoeMul().toFixed(3)}  (하한 ${CAMP_RT_CUT_FLOOR} · 막혔나: ${campRtFoeMul()<=CAMP_RT_CUT_FLOOR+1e-9?'✅ 바닥에 닿음':'아직'})`);
    say(''); }

  // ══ ② 회차 루프 ══════════════════════════════════════════════════════
  //  깊이 진행표는 **양쪽에 똑같이** 준다 — 여기서 재는 것은 「같은 깊이에서 ×2 가 무엇을
  //  바꾸는가」다. 깊이↔시간은 엔진 벤치가 잴 몫이라 여기서 모델을 만들지 않는다.
  //  재화는 HUNT_R1 §4-2 의 가정(재화 ∝ 난이도)을 그대로 쓴다 — 그 가정 자체는 §5 D 미검증.
  function runLoop(x2, depth){
    const C=fresh(); const rows=[];
    for(let i=1;i<=N;i++){
      const d=depth(i).d, r=depth(i).r;
      C.dg=d; C.cleared=r;
      C.earn=CAMP_REB_COST*campFoeDiff(d,r); C.earnGas=0;
      const mul=campRebMulGain(), pts=campRebPtGain();
      const k=x2?2:1;
      C.rebMul=(C.rebMul||0)+mul*k; C.rbPts=(C.rbPts||0)+pts*k; C.reb=i;
      // 🌳 트리 구매 — 살 수 있는 것 중 **가장 싼 것**을 계속 산다
      let bought=0;
      for(;;){ let best=null,bc=Infinity;
        if(campRtCanBuy('root')){ best='root'; bc=CAMP_RT_BASE; }
        else for(const Ln of CAMP_RT_LINES){ if(!campRtCanBuy(Ln.k)) continue;
          const c=campRtCost(Ln.k,campRtNext(Ln.k)); if(c<bc){bc=c;best=Ln.k;} }
        if(!best) break; campRtBuy(best); bought++; if(bought>400) break; }
      let nodes=0,maxTier=0;
      for(const Ln of CAMP_RT_LINES){ const h=campRtHas(Ln.k); nodes+=h;
        if(h>0) maxTier=Math.max(maxTier,campRtTier(Ln.k,h)); }
      rows.push({i,d,r,mul,pts,accMul:campRebMul(),left:C.rbPts||0,nodes,maxTier,
                 atk:campRtMul('atk'),foe:campRtFoeMul()});
    }
    return rows; }

  // 깊이 진행표: 회차마다 라운드 10칸 · 50칸이면 다음 던전 (양쪽 공통)
  const depth=i=>{ const t=(i-1)*STEP; return { d:Math.min(CAMP_DG_MAX,1+Math.floor(t/50)), r:t%50 }; };

  const A=runLoop(false,depth), B=runLoop(true,depth);
  say(`=== ② ${N}회차 — 같은 깊이 진행표(회차당 라운드 +${STEP}) ===`);
  say('회차 깊이     받은포인트  │ 기본: 노드/티어/누적배수  │ ×2: 노드/티어/누적배수  │ 노드차');
  for(let i=0;i<N;i++){ const a=A[i],c=B[i];
    say(`${P(a.i,4)} ${P('D'+a.d+'R'+a.r,9)} ${P(F(a.pts),11)} │ ${P(a.nodes+'/'+a.maxTier+'/×'+a.accMul.toFixed(1),24)} │ ${P(c.nodes+'/'+c.maxTier+'/×'+c.accMul.toFixed(1),23)} │ +${c.nodes-a.nodes}`); }

  // ⭐ 앞당김 — ×2 가 도달한 노드 수를, 기본은 몇 회차에 도달하나
  say('');
  say('=== ③ ×2 는 몇 회차를 앞당기나 ===');
  say('회차  ×2 노드수  기본이 같은 노드수에 닿는 회차  앞당김');
  for(const i of [1,2,3,5,8,12,16,20].filter(x=>x<=N)){
    const target=B[i-1].nodes; let at=null;
    for(let j=0;j<N;j++) if(A[j].nodes>=target){ at=A[j].i; break; }
    say(`${P(i,5)} ${P(target,10)} ${P(at===null?'>'+N:at,30)} ${at===null?'?':(i-at>0?'뒤짐':(at-i)+'회차')}`);
  }
  // ══ ④ 획득 배수 축 — ⛔ 여기가 진짜 문제다 ══════════════════════════
  //  배수는 회차마다 **더해지고 환생해도 안 지워진다**(C.rebMul 은 keep 목록에 있다).
  //  그러니 매 회차 ×2 를 쓰면 「영구 배수가 통째로 2배」가 된다 — GEM.md §4 가
  //  「영구 효과는 절대 팔지 않는다」고 못 박은 바로 그 형태인지 여기서 확인한다.
  say('');
  say('=== ④ 획득 배수 — 영구 축이 2배가 되는가 ===');
  function mulOnly(mode, depth){        // mode: 'none' | 'once' | 'always'
    const C=fresh(); const rows=[];
    for(let i=1;i<=N;i++){ const d=depth(i).d, r=depth(i).r;
      C.dg=d; C.cleared=r; C.earn=CAMP_REB_COST*campFoeDiff(d,r); C.earnGas=0;
      const k=(mode==='always')?2:(mode==='once'&&i===1)?2:1;
      C.rebMul=(C.rebMul||0)+campRebMulGain()*k; C.reb=i;
      rows.push(campRebMul()); }
    return rows; }
  const M0=mulOnly('none',depth), M1=mulOnly('once',depth), M2=mulOnly('always',depth);
  say('회차   안 씀     1회만 씀   매 회차     매회차÷안씀');
  for(const i of [1,5,10,20,30,40].filter(x=>x<=N))
    say(`${P(i,6)} ×${P(M0[i-1].toFixed(1),9)} ×${P(M1[i-1].toFixed(1),10)} ×${P(M2[i-1].toFixed(1),11)} ×${(M2[i-1]/M0[i-1]).toFixed(3)}`);
  say('⭐ 「매회차÷안씀」이 2.0 에 붙으면 = 젬으로 **영구 배수를 2배로 산 것**이다.');
  say('   1회만 쓰면 뒤로 갈수록 묽어진다(그것이 GEM.md §4 가 뜻한 「1회권」).');

  // 2배 수입은 라운드 몇 칸어치인가 — 난이도 함수(실제)로만 환산한다.
  //  ⚠ 「재화 ∝ 난이도」 가정 위의 값이다(HUNT_R1 §5-D · 미검증).
  { const rb=campRBase(1), rb10=campRBase(10);
    say(`   수입 ×2 ≈ 라운드 ${(Math.log(2)/Math.log(rb)).toFixed(1)}칸(D1) ~ ${(Math.log(2)/Math.log(rb10)).toFixed(1)}칸(D10) 어치`);
    say(`   던전 문턱 ×${CAMP_DG_STEP} 이므로, 수입 ×2 로는 던전 하나를 못 건넌다(그게 안전판이다).`); }

  // ══ ⑤ 되먹임 — 수입이 2배면 더 깊이 가고, 그럼 배수를 더 받는다. 발산하나? ══
  //  ⚠ 여기 하나만 **탄력도 가정**을 쓴다: 수입 X배 = 라운드 log(X)/log(라운드밑) 칸.
  //     그 환산은 실제 난이도 함수(campRBase)로 하고, 나머지는 전부 실제 함수다.
  //     ⭐ 재는 것은 절대값이 아니라 **격차가 벌어지는가 멎는가**다.
  say('');
  say('=== ⑤ 되먹임 — 격차가 벌어지나 멎나 ===');
  //  ⛔ 격차는 **같은 회차의 「팩 없음」과 견준다**(직전 회차와 견주면 늘 0 이 나온다 — 한 번 헛짚었다).
  function loopFB(packMul, depth, ref){
    const C=fresh(); const rows=[];
    for(let i=1;i<=N;i++){
      // 지금 내 배수가 「팩 없음」의 같은 회차보다 몇 배인가 → 그만큼 라운드를 더 간다
      const cur=campRebMul(), base=ref?Math.max(1,ref[i-1].mulBefore):cur;
      const rb=campRBase(depth(i).d);
      const extra=Math.max(0, Math.log(Math.max(1,cur/base))/Math.log(rb));
      let d=depth(i).d, r=depth(i).r+extra;
      while(r>=CAMP_ROUND_MAX && d<CAMP_DG_MAX){ r-=CAMP_ROUND_MAX; d++; }
      r=Math.min(CAMP_ROUND_MAX-1,r);
      C.dg=d; C.cleared=Math.round(r);
      C.earn=CAMP_REB_COST*campFoeDiff(d,C.cleared); C.earnGas=0;
      C.rebMul=(C.rebMul||0)+campRebMulGain()*packMul;
      C.rbPts=(C.rbPts||0)+campRebPtGain()*packMul; C.reb=i;
      rows.push({i,d,r,extra,mul:campRebMul(),mulBefore:cur});
    }
    return rows; }
  { const F0=loopFB(1,depth,null), F2=loopFB(2,depth,F0);
    say('회차  팩없음 깊이   팩×2 깊이    깊이 격차(라운드)  배수 비율');
    for(const i of [1,2,5,10,20,30,40].filter(x=>x<=N)){
      const a=F0[i-1], c=F2[i-1];
      const gap=(c.d-a.d)*CAMP_ROUND_MAX+(c.r-a.r);
      say(`${P(i,5)} ${P('D'+a.d+'R'+a.r.toFixed(0),12)} ${P('D'+c.d+'R'+c.r.toFixed(0),12)} ${P(gap.toFixed(1),18)} ×${(c.mul/a.mul).toFixed(3)}`); }
    const g=k=>{const a=F0[k-1],c=F2[k-1];return (c.d-a.d)*CAMP_ROUND_MAX+(c.r-a.r);};
    const mid=g(Math.min(N,20)), end=g(N);
    say(`⭐ 격차 ${Math.min(N,20)}회차 ${mid.toFixed(1)}칸 → ${N}회차 ${end.toFixed(1)}칸 : ` +
        (end>mid*1.5 ? '⛔ 벌어진다(발산)' : '✅ 멎는다(수렴) — 되먹임이 폭주로 안 간다'));
    say(`   던전 하나 = ${CAMP_ROUND_MAX}칸 + 문턱 ×${CAMP_DG_STEP} · 격차가 그보다 작으면 던전을 못 건넌다`); }

  const last=A[N-1], lastB=B[N-1];
  say('');
  say(`${N}회차 끝 — 기본 노드 ${last.nodes}/${CAMP_RT_LINES.length*5} · ×2 노드 ${lastB.nodes}/${CAMP_RT_LINES.length*5}`);
  say(`         기본 적약화 ×${last.foe.toFixed(3)} · ×2 적약화 ×${lastB.foe.toFixed(3)} (바닥 ${CAMP_RT_CUT_FLOOR})`);
  say(`         기본 누적배수 ×${last.accMul.toFixed(1)} · ×2 누적배수 ×${lastB.accMul.toFixed(1)}`);
  return L;
},N,STEP);

console.log(out.join('\n'));
if(errs.length) console.log('\n⛔ 페이지 예외:\n  '+errs.join('\n  '));
else console.log('\n✅ 페이지 예외 없음');
await b.close(); server.close();
