/* ============================================================================
 * 06-daily.js — 일일 퀘스트 · 출석
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ══════════════════════════════════════════════════════════════════════════
// 📅 일일 — 출석 캘린더(4주) · 일일 퀘스트(하루 5개 + 주간 25개)
// ──────────────────────────────────────────────────────────────────────────
//  · 두 기능은 **화면이 따로다** — 더보기 ☰ 에 '출석'(#hbAttSheet)과 '퀘스트'(#hbDailySheet)로 각각 들어간다.
//    저장·계측·보상 지급은 여기 한 곳에서 공유한다(p.daily · dqNote · dqGive).
//  · 하루 경계는 던전 열쇠·상점 특가와 같은 축(_dgDayKey · 09:00). 주 경계는 그 위에 얹은 월요일(_dqWeekKey).
//  · 출석: 하루 1도장. 한 주 = 출석 5칸 + 보너스 2칸(그 주 5칸을 채우면 열린다).
//         4주 = 20도장을 다 채우면 최종 보상 → 받으면 캘린더가 새로 시작된다.
//  · 퀘스트: 날짜를 씨앗으로 뽑으므로 새로고침해도 같은 5개가 나온다.
//         하루 5개 완주 = 완주 보너스 · 한 주 25개 = 주간 보너스(월요일에 0으로 돌아간다).
//         진행은 dqNote(kind, n) 한 곳으로만 들어온다 — 새 계측 지점은 여기에 붙일 것.
// ══════════════════════════════════════════════════════════════════════════
const DQ_WEEKS=4, DQ_PER_WEEK=5, DQ_BONUS=2;          // 4주 × (출석 5칸 + 보너스 2칸)
const DQ_ATT_MAX=DQ_WEEKS*DQ_PER_WEEK;                 // 20도장 = 최종 보상 조건
const DQ_N=5, DQ_OUT_N=3;                              // 하루 5개 중 **3개**는 사냥터 바깥(2026-08-19: 유즈맵을 주류로 올리며 2→3)
const DQ_WEEK_MAX=DQ_N*7;                              // 한 주에 나올 수 있는 최대(35개)
const DQ_WEEK_GOAL=25;                                 // 주간 목표 = 5일치. 이틀을 빠져도 채울 수 있다(출석 5/7과 같은 결)
const DQ_TK={gear:'장비', pet:'펫', ally:'동료'};
// 퀘스트 표 — kind 가 dqNote()의 계측 종류. cat:'hunt'=사냥터 / 'out'=바깥 구역
//   name = 줄의 **제목**(무엇에 대한 것인지 한눈에) · desc = 그 아래 **내용**(무엇을 얼마나)
const DQ_POOL=[
  {id:'kill60',  cat:'hunt', ico:'marine',  kind:'kill',  goal:60,  name:'적 처치',      desc:'사냥터에서 적 60기 처치',     rw:{pcoin:900}},
  {id:'kill150', cat:'hunt', ico:'marine',  kind:'kill',  goal:150, name:'적 처치',      desc:'사냥터에서 적 150기 처치',    rw:{pcoin:1800, gas:40}},
  {id:'chest3',  cat:'hunt', ico:'box',     kind:'chest', goal:3,   name:'보급 상자',    desc:'필드의 보급 상자 3개 열기',   rw:{pcoin:1200}},
  {id:'chest6',  cat:'hunt', ico:'box',     kind:'chest', goal:6,   name:'보급 상자',    desc:'필드의 보급 상자 6개 열기',   rw:{pcoin:2200, gear:1}},
  {id:'upg5',    cat:'hunt', ico:'upg',     kind:'upg',   goal:5,   name:'업그레이드',   desc:'사냥터 업그레이드 5회 구매',  rw:{pcoin:1000}},
  {id:'upg15',   cat:'hunt', ico:'upg',     kind:'upg',   goal:15,  name:'업그레이드',   desc:'사냥터 업그레이드 15회 구매', rw:{pcoin:2400, gas:50}},
  {id:'round3',  cat:'hunt', ico:'flag',    kind:'round', goal:3,   name:'라운드',       desc:'라운드 3회 클리어',           rw:{pcoin:1500}},
  {id:'play300', cat:'hunt', ico:'rec',     kind:'play',  goal:300, name:'플레이타임',   desc:'사냥터에서 5분 플레이',       rw:{pcoin:1400, gas:30}},
  {id:'build2',  cat:'hunt', ico:'build',   kind:'build', goal:2,   name:'기지 건설',    desc:'기지에 건물 2채 짓기',        rw:{pcoin:1600}},
  {id:'um1',     cat:'out',  ico:'map',     kind:'umRun', goal:1,   name:'유즈맵',       desc:'유즈맵에서 1판 플레이',       rw:{pcoin:2000, gas:60}},
  {id:'um2',     cat:'out',  ico:'map',     kind:'umRun', goal:2,   name:'유즈맵',       desc:'유즈맵에서 2판 플레이',       rw:{pcoin:3600, gear:1}},
  {id:'umWin1',  cat:'out',  ico:'globe',   kind:'umWin', goal:1,   name:'유즈맵 승리',  desc:'유즈맵에서 1승 거두기',       rw:{pcoin:3000, gem:3}},
  {id:'gacha1',  cat:'out',  ico:'gift',    kind:'gacha', goal:1,   name:'뽑기',         desc:'아무 뽑기 1회',               rw:{pcoin:1500}},
  {id:'boost1',  cat:'out',  ico:'boost',   kind:'boost', goal:1,   name:'부스트',       desc:'부스트 1회 사용',             rw:{pcoin:1200}},
];
const DQ_BY={}; for(const _q of DQ_POOL) DQ_BY[_q.id]=_q;
const DQ_ALL_RW={pcoin:5000, gas:200, gem:5};                                  // 하루 5개 완주 보너스
const DQ_WEEK_RW={pcoin:15000, gas:600, gem:25, gear:2, ally:1};               // 한 주 25개 = 주간 보너스
const DQ_FINAL_RW={pcoin:20000, gas:1500, gem:100, gear:5, pet:2, ally:3};     // 출석 4주 완성 = 아주 큰 보상
// 출석 5칸 — 주가 올라갈수록 커진다(m=주 배수). 4번째 칸은 뽑기권으로 결을 바꾼다.
function dqAttRw(w,i){ const m=w+1;
  if(i===0) return {pcoin:500*m};
  if(i===1) return {gas:40*m};
  if(i===2) return {pcoin:900*m};
  if(i===3) return {gear:1};
  return {pcoin:1600*m, gas:60*m}; }
// 보너스 2칸 — 그 주 출석 5칸을 다 채우면 '나머지 2일' 몫으로 열린다(추가 출석 불필요)
function dqAttBonusRw(w,b){ return (b===0) ? {pet:1, gas:80*(w+1)} : {gem:10+5*w}; }
// 주 경계 = 하루 경계(09:00) 위에 얹은 월요일. 하루 축을 새로 만들지 않는다 — 두 축이 어긋나면 하루가 새는 날이 생긴다.
function _dqWeekKey(){ const d=new Date(_dgDayKey());
  const dow=(d.getDay()+6)%7;                                                  // 월=0 … 일=6
  d.setDate(d.getDate()-dow); d.setHours(0,0,0,0); return d.getTime(); }
// ── 저장·상태 ──
function dqState(){ const p=(typeof PROF==='function')?PROF():null; if(!p) return null;
  if(!p.daily || typeof p.daily!=='object') p.daily={};
  const D=p.daily, dk=_dgDayKey();
  if(!D.att || typeof D.att!=='object') D.att={n:0, day:0, bn:{}, fin:0, cyc:0};
  if(!D.att.bn || typeof D.att.bn!=='object') D.att.bn={};
  if(D.day!==dk){ D.day=dk; D.q=dqDraw(dk); D.allGot=0; }                      // 날이 바뀌면 5개를 새로 뽑는다
  if(!Array.isArray(D.q) || D.q.length!==DQ_N) D.q=dqDraw(D.day||dk);
  { const wk=_dqWeekKey();                                                     // 주가 바뀌면 주간 누적은 0으로
    if(!D.wk || typeof D.wk!=='object' || D.wk.key!==wk) D.wk={key:wk, n:0, got:0}; }
  return D; }
// 날짜 시드 난수 — 같은 날이면 몇 번을 켜도 같은 5개(새로고침 리롤 방지)
function _dqRand(seed){ let s=(seed>>>0)||1;
  return function(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
function dqDraw(dk){ const rnd=_dqRand(Math.floor((dk||0)/86400000)+7919);
  // ⚠ 같은 kind 를 두 개 뽑지 않는다 — '적 처치 60'과 '적 처치 150'이 같은 날 나오면
  //    큰 쪽을 하는 순간 작은 쪽이 덤으로 끝나서 5개가 사실상 4개가 된다.
  const used={};
  const take=function(arr,n){ const a=arr.slice(), o=[];
    while(o.length<n && a.length){ const q=a.splice(Math.floor(rnd()*a.length),1)[0];
      if(used[q.kind]) continue; used[q.kind]=1; o.push(q); }
    return o; };
  const hunt=DQ_POOL.filter(function(q){ return q.cat==='hunt'; });
  const out =DQ_POOL.filter(function(q){ return q.cat!=='hunt'; });
  const sel=take(hunt, DQ_N-DQ_OUT_N).concat(take(out, DQ_OUT_N));
  while(sel.length<DQ_N && sel.length<DQ_POOL.length){                          // 표가 줄어도 5개를 채운다
    let rest=DQ_POOL.filter(function(q){ return sel.indexOf(q)<0 && !used[q.kind]; });
    if(!rest.length) rest=DQ_POOL.filter(function(q){ return sel.indexOf(q)<0; });   // 종류가 동나면 그때만 중복 허용
    if(!rest.length) break;
    const q=rest[Math.floor(rnd()*rest.length)]; used[q.kind]=1; sel.push(q); }
  return sel.map(function(q){ return {id:q.id, n:0, got:0}; }); }
// ── 보상 지급·표기(재화 아이콘은 resIco 단일 소스) ──
function dqRwPlain(rw){ if(!rw) return '';
  const t=[];
  if(rw.pcoin) t.push('미네랄 '+fmtCur(rw.pcoin));
  if(rw.gas)   t.push('가스 '+fmtCur(rw.gas));
  if(rw.gem)   t.push('젬 '+fmtCur(rw.gem));
  for(const k in DQ_TK) if(rw[k]) t.push(DQ_TK[k]+' 뽑기권 ×'+rw[k]);
  return t.join(' · '); }
// 칸 안에 넣는 작은 표기 — 재화는 아이콘, 뽑기권은 🎟
// 칸이 좁아 하나만 보여 준다 — 그 보상의 '얼굴'을 고른다(뽑기권 > 젬 > 미네랄 > 가스)
function dqRwIco(rw){ if(!rw) return '';
  for(const k in DQ_TK) if(rw[k]) return resIco('ticket_'+k,'tk');
  if(rw.gem)   return resIco('gem')+'<i>'+rw.gem+'</i>';
  if(rw.pcoin) return resIco('mineral')+'<i>'+(rw.pcoin>=1000?Math.round(rw.pcoin/100)/10+'k':rw.pcoin)+'</i>';
  if(rw.gas)   return resIco('gas')+'<i>'+rw.gas+'</i>';
  return ''; }
function dqGive(rw){ const p=(typeof PROF==='function')?PROF():null; if(!p||!rw) return '';
  if(rw.pcoin) p.pcoin=(p.pcoin||0)+rw.pcoin;
  if(rw.gas)   p.gas  =(p.gas||0)+rw.gas;
  if(rw.gem)   p.gem  =(p.gem||0)+rw.gem;
  for(const k in DQ_TK) if(rw[k] && typeof dgAddTicket==='function') dgAddTicket(k, rw[k]);
  if(typeof saveMeta==='function') saveMeta();
  if(typeof updateCurBar==='function') updateCurBar();
  return dqRwPlain(rw); }
function dqRwAdd(a,b){ for(const k in b) a[k]=(a[k]||0)+b[k]; return a; }
// ── 계측 — 게임 곳곳에서 이 한 곳으로만 들어온다 ──
function dqNote(kind, n){
  // 🎓 **가이드도 같은 계측을 쓴다**(2026-09-04). 전에는 guideNote 를 부르는 곳이 던전 이동 한 곳뿐이라
  //   탭·업그레이드·건설·유닛 단계가 **영영 안 넘어갔다**(실측). 지급 지점마다 줄을 더하지 말고
  //   **공용 입구 하나**에 얹는다 — 새 계측이 생겨도 여기로 들어오면 가이드가 저절로 따라온다.
  //   ⛔ guideNote 를 개별 지점에 흩뿌리지 말 것(두 벌이 되면 한쪽만 세다 어긋난다).
  try{ if(typeof guideNote==='function') guideNote(kind, n); }catch(_g){}
  try{
  const D=dqState(); if(!D) return; const done=[]; let ch=0;
  for(const e of D.q){ const Q=DQ_BY[e.id];
    if(!Q || Q.kind!==kind || e.got || e.n>=Q.goal) continue;
    e.n=Math.min(Q.goal, (e.n||0)+(n||1)); ch=1;
    if(e.n>=Q.goal) done.push(dqQName(Q)); }
  if(!ch) return;
  // ⚠ 처치처럼 초당 여러 번 들어오는 계측이 있다 — 저장·배지·리렌더는 '완료된 순간'과 '보고 있을 때'만.
  if(done.length){
    // 주간 누적은 '수령'이 아니라 '완료'로 센다 — 안 받고 날이 바뀌어도 이번 주 몫은 남는다.
    D.wk.n=Math.min(DQ_WEEK_MAX, (D.wk.n||0)+done.length);
    if(typeof saveMeta==='function') saveMeta();
    if(typeof toast==='function') toast('📅 일일 퀘스트 완료 — '+done.join(' · '));
    dqDot(); }
  dqRefresh();
}catch(_e){} }
function dqClaim(i){ const D=dqState(); if(!D) return; const e=D.q[i], Q=e&&DQ_BY[e.id];
  if(!Q || e.got || e.n<Q.goal) return;
  e.got=1; const tx=dqGive(Q.rw);
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof toast==='function') toast('📅 '+dqQName(Q)+' — '+tx);
  dqRefresh(); dqDot(); }
function dqAllGot(){ const D=dqState(); return !!(D && D.q.every(function(e){ return e.got; })); }
function dqClaimAll(){ const D=dqState(); if(!D || D.allGot || !dqAllGot()) return;
  D.allGot=1; const tx=dqGive(DQ_ALL_RW);
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof toast==='function') toast('📅 오늘의 퀘스트 완주 — '+tx);
  dqRefresh(); dqDot(); }
// 주간 — 월요일에 0으로 돌아간다. 매일 들어와야 25개가 찬다.
function dqWeekN(){ const D=dqState(); return D ? (D.wk.n||0) : 0; }
function dqWeekOpen(){ return dqWeekN()>=DQ_WEEK_GOAL; }
function dqWeekGot(){ const D=dqState(); return !!(D && D.wk.got); }
function dqClaimWeek(){ const D=dqState(); if(!D || D.wk.got || !dqWeekOpen()) return;
  D.wk.got=1; const tx=dqGive(DQ_WEEK_RW);
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof toast==='function') toast('🏆 주간 퀘스트 '+DQ_WEEK_GOAL+'개 달성 — '+tx);
  dqRefresh(); dqDot(); }
// 토스트·로그처럼 한 줄로 말해야 하는 자리는 '내용'을 그대로 쓴다(제목만으론 무엇을 했는지 모른다)
function dqQName(Q){ return Q.desc || (Q.name+' '+Q.goal); }
// ── 출석 ──
function dqAttCan(){ const D=dqState(); return !!(D && D.att.n<DQ_ATT_MAX && D.att.day!==_dgDayKey()); }
function dqCheckIn(){ const D=dqState(); if(!D || !dqAttCan()) return;
  const A=D.att; A.day=_dgDayKey(); A.n++;
  const w=Math.floor((A.n-1)/DQ_PER_WEEK), i=(A.n-1)%DQ_PER_WEEK;
  const tx=dqGive(dqAttRw(w,i));
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof toast==='function') toast('📅 출석 '+A.n+'일차 — '+tx);
  dqRefresh(); dqDot(); }
function dqBonusOpen(w){ const D=dqState(); return !!(D && D.att.n>=(w+1)*DQ_PER_WEEK); }
function dqBonusGot(w,b){ const D=dqState(); return !!(D && D.att.bn[w+'-'+b]); }
function dqClaimBonus(w,b){ const D=dqState(); if(!D || !dqBonusOpen(w) || dqBonusGot(w,b)) return;
  D.att.bn[w+'-'+b]=1; const tx=dqGive(dqAttBonusRw(w,b));
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof toast==='function') toast('📅 '+(w+1)+'주 추가 보상 — '+tx);
  dqRefresh(); dqDot(); }
function dqFinalOpen(){ const D=dqState(); return !!(D && D.att.n>=DQ_ATT_MAX); }
// 최종 = 남아 있는 보너스까지 한꺼번에 준다(안 그러면 캘린더를 새로 깔 때 사라진다)
function dqClaimFinal(){ const D=dqState(); if(!D || !dqFinalOpen()) return;
  const A=D.att, rw=Object.assign({}, DQ_FINAL_RW);
  for(let w=0;w<DQ_WEEKS;w++) for(let b=0;b<DQ_BONUS;b++) if(!A.bn[w+'-'+b]) dqRwAdd(rw, dqAttBonusRw(w,b));
  const tx=dqGive(rw);
  A.n=0; A.bn={}; A.fin=0; A.cyc=(A.cyc||0)+1;                                  // 캘린더를 새로 깐다(오늘 몫은 이미 찍혔다)
  if(typeof saveMeta==='function') saveMeta();
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof toast==='function') toast('🏆 4주 완성 보상 — '+tx);
  dqRefresh(); dqDot(); }
// ── 배지 — ☰ 의 ! 점과 더보기 칸 점. '지금 받을 게 있다'만 신호한다(칸마다 따로) ──
function dqAttHas(){ const D=dqState(); if(!D) return false;
  if(dqAttCan() || dqFinalOpen()) return true;
  for(let w=0;w<DQ_WEEKS;w++) for(let b=0;b<DQ_BONUS;b++) if(dqBonusOpen(w) && !dqBonusGot(w,b)) return true;
  return false; }
function dqQHas(){ const D=dqState(); if(!D) return false;
  if(!D.allGot && dqAllGot()) return true;
  if(dqWeekOpen() && !dqWeekGot()) return true;
  return D.q.some(function(e){ const Q=DQ_BY[e.id]; return Q && !e.got && e.n>=Q.goal; }); }
function dqHas(){ return dqAttHas() || dqQHas(); }   // ☰ 의 ! = 둘 중 아무거나
function dqDot(){ if(typeof renderHomeStats==='function') renderHomeStats();
  if(hbMoreOn()) renderHbMore(); }
// ── 화면 — 퀘스트(#hbDailySheet)와 출석(#hbAttSheet)은 **따로 뜬다** ──
//   한 판에 탭으로 묶어 뒀더니 '오늘 뭘 해야 하나'와 '도장을 찍었나'가 서로를 가렸다(2026-08-14 분리).
function dqOn(){ const el=document.getElementById('hbDailySheet'); return !!(el && !el.classList.contains('hide')); }
function dqAttOn(){ const el=document.getElementById('hbAttSheet'); return !!(el && !el.classList.contains('hide')); }
function dqRefresh(){ if(dqOn()) renderDaily(); if(dqAttOn()) renderAtt(); }   // 열려 있는 쪽만 다시 그린다
function openDaily(){ const el=document.getElementById('hbDailySheet'); if(!el) return;
  el.classList.remove('hide'); renderDaily();
  if(typeof playSfx==='function') playSfx('ui_open'); }
function closeDaily(){ const el=document.getElementById('hbDailySheet'); if(el) el.classList.add('hide');
  if(typeof saveMeta==='function') saveMeta(); dqDot(); }
function openAtt(){ const el=document.getElementById('hbAttSheet'); if(!el) return;
  el.classList.remove('hide'); renderAtt();
  if(typeof playSfx==='function') playSfx('ui_open'); }
function closeAtt(){ const el=document.getElementById('hbAttSheet'); if(el) el.classList.add('hide');
  if(typeof saveMeta==='function') saveMeta(); dqDot(); }
function renderDaily(){ const box=document.getElementById('hbDailyBody'); if(!box) return;
  box.innerHTML=dqQuestHTML(); if(typeof paintIcons==='function') paintIcons(box); }
function renderAtt(){ const box=document.getElementById('hbAttBody'); if(!box) return;
  box.innerHTML=dqAttHTML(); if(typeof paintIcons==='function') paintIcons(box); }
// 수령 버튼 — '무엇을 받는지'가 버튼 안에 들어간다(보상 줄 + 받기). 줄 밖에 따로 적지 않는다.
function dqClaimBtn(rw, act, done, got){
  let r=''; { const t=[]; const ri=function(k,v){ return '<i>'+resIco(k,'dqRi')+fmtCur(v)+'</i>'; };
    if(rw.pcoin) t.push(ri('mineral',rw.pcoin));
    if(rw.gas)   t.push(ri('gas',rw.gas));
    if(rw.gem)   t.push(ri('gem',rw.gem));
    for(const k in DQ_TK) if(rw[k]) t.push('<i>'+resIco('ticket_'+k,'dqRi')+DQ_TK[k]+' ×'+rw[k]+'</i>');
    r='<span class="dqRwB">'+t.join('')+'</span>'; }
  return '<button class="hbRowBtn dqBtn" onclick="'+act+'"'+((done&&!got)?'':' disabled')+'>'
    +r+'<b>'+(got?'완료':'받기')+'</b></button>'; }
// 한 줄 = [아이콘] 제목 / 내용 · 진행 바 / [보상 + 받기]
function dqRowHTML(o){
  const pct=Math.min(100, Math.round((o.n||0)/o.goal*100));
  return '<div class="hbRow dqQ'+(o.got?' got':(o.done?' done':''))+'">'
    +'<span class="hbRowIco"><span data-ico="'+o.ico+'"></span></span>'
    +'<span class="hbRowTx"><b>'+o.title+'</b>'
    +'<em>'+o.desc+' <i>'+Math.min(o.n||0,o.goal)+'/'+o.goal+'</i></em>'
    +'<i class="dqBar"><u style="width:'+pct+'%"></u></i></span>'
    +dqClaimBtn(o.rw, o.act, o.done, o.got)+'</div>'; }
function dqQuestHTML(){ const D=dqState(); if(!D) return '';
  // 맨 위 = 주간 진행. '오늘 5개'만 보이면 매일 들어올 이유가 약해져서, 주간 목표를 먼저 보여 준다.
  let h=''; { const n=dqWeekN(), open=dqWeekOpen(), got=dqWeekGot();
    h+='<div class="dqWeek'+(got?' got':(open?' on':''))+'">'
      +dqRowHTML({ico:'flag', title:'이번 주 퀘스트', desc:'퀘스트 '+DQ_WEEK_GOAL+'개 완료', n:n, goal:DQ_WEEK_GOAL,
                  rw:DQ_WEEK_RW, act:'dqClaimWeek()', done:open, got:got})
      +'<div class="dqWeekNo">월요일에 0으로 돌아갑니다</div></div>'; }
  D.q.forEach(function(e,i){ const Q=DQ_BY[e.id]; if(!Q) return;
    h+=dqRowHTML({ico:Q.ico, title:Q.name, desc:Q.desc, n:e.n, goal:Q.goal, rw:Q.rw,
                  act:'dqClaim('+i+')', done:e.n>=Q.goal, got:!!e.got}); });
  { const got=D.q.filter(function(e){ return e.got; }).length;   // '수령까지' 끝난 개수 — 조건(dqAllGot)과 같은 잣대로 센다
    h+=dqRowHTML({ico:'gift', title:'오늘 완주', desc:'오늘의 퀘스트 '+DQ_N+'개 모두 수령', n:got, goal:DQ_N,
                  rw:DQ_ALL_RW, act:'dqClaimAll()', done:dqAllGot(), got:!!D.allGot}); }
  return h; }
function dqAttHTML(){ const D=dqState(); if(!D) return ''; const A=D.att;
  const can=dqAttCan();
  let h='<div class="dqTop"><span>출석 <b>'+A.n+'</b> / '+DQ_ATT_MAX+'</span>'
    +'<button class="ecGo" onclick="dqCheckIn()"'+(can?'':' disabled')+'>'+(can?'오늘 출석':'출석 완료')+'</button></div>';
  for(let w=0;w<DQ_WEEKS;w++){
    h+='<div class="dqWk"><i class="dqWkL">'+(w+1)+'주</i><div class="dqWkG">';
    for(let i=0;i<DQ_PER_WEEK;i++){ const n=w*DQ_PER_WEEK+i+1, got=A.n>=n, now=(!got && n===A.n+1 && can);
      h+='<div class="dqC'+(got?' got':'')+(now?' now':'')+'"><b>'+n+'</b>'+dqRwIco(dqAttRw(w,i))+'</div>'; }
    for(let b=0;b<DQ_BONUS;b++){ const open=dqBonusOpen(w), got=dqBonusGot(w,b);
      h+='<button class="dqC bn'+(got?' got':'')+((open&&!got)?' now':'')+'"'+((open&&!got)?'':' disabled')
        +' onclick="dqClaimBonus('+w+','+b+')" title="'+(w+1)+'주 추가 보상"><b>+</b>'+dqRwIco(dqAttBonusRw(w,b))+'</button>'; }
    h+='</div></div>'; }
  { const fin=dqFinalOpen();
    h+='<div class="dqFin'+(fin?' on':'')+'"><span class="hbRowIco"><span data-ico="gift"></span></span>'
      +'<span class="dqFinTx"><b>4주 완성 보상</b><em>'+(fin?dqRwPlain(DQ_FINAL_RW)+' · 남은 추가 보상 포함':'20일을 다 채우면 열립니다')+'</em></span>'
      +'<button class="hbRowBtn" onclick="dqClaimFinal()"'+(fin?'':' disabled')+'>받기</button></div>'; }
  return h; }

// ════════════════════════════════════════════════════════════════════
// 🧭 가이드 퀘스트 (2026-08-25) — 「이 게임을 어떻게 하는가」를 순서로 가르친다
//
// 일일 퀘스트와 **다른 것**이다. 일일은 매일 오게 하는 장치이고, 가이드는 **한 번만** 돈다.
//   · 순서가 있다(앞 단계를 끝내야 다음이 보인다)
//   · 끝나면 사라진다
//   · 목표가 곧 조작법이다 — 「무엇을 눌러야 하는지」를 문장으로 말해 준다
//
// ⚠ **유니온 전용이다.** 건물 키가 종족마다 다르다(union=barracks · swarm=pool ·
//    aetherial=gateway · feral=huntpen · colossus=assembly). 매핑 표를 여기서 새로 지으면
//    두 벌이 되므로, 다른 종족이면 가이드를 **아예 안 띄운다**(guideOn() 이 false).
//    기획서도 「유니온만 완비」라고 본다(GAME_DIRECTION §4-1).
//
// ⚠ **진행을 세는 곳은 캠프다.** 여기는 받는 입구(guideNote)만 갖는다 —
//    캠프가 `guideNote('build:barracks',1)` 한 줄씩 넣어 주면 차오른다.
//    지금 이어져 있는 것은 던전 이동뿐이다(campDropGo → 12-appshell.js).
// ════════════════════════════════════════════════════════════════════
// 🏰 **개편을 따라간다**(2026-09-10). 던전이 「라운드 50」에서 「적 기지 · 진행 건물 6채」로 바뀌면서
//   옛 표의 절반이 없는 것을 가리켰다 — 「던전 2 로 옮긴다」·「통신소의 스캔을 눌러 환생」 따위.
//   ⛔ 화면에 없는 것을 시키지 말 것: 가이드는 **다음에 무엇을 할지**를 말하는 자리다.
// 🐞 그리고 **고장나 있었다** — 열다섯 중 계측이 이어진 것은 넷(tap·upg:*·dg:*)뿐이라
//   다섯째 「병영 짓기」에서 영영 멈췄다(2026-09-10 실측). 계측을 캠프에서 흘려보내 고쳤다
//   (campPatchNote · 건물 완공 · 유닛 생산 · 연구 완료 · 적 건물 파괴 · 던전 완주 · 환생).
// 🧬 **종족을 가리지 않는다** — 첫 건물 이름만 종족 표(TUTO_BLD)에서 꺼낸다.
//   ⛔ GUIDE_RACE 로 유니온만 띄우던 것으로 되돌리지 말 것: 다른 종족을 고르면 가이드가 통째로 없었다.
const GUIDE_STEPS=[
  // ── 1부 · 돈 버는 법 (1분 세션) ───────────────────────────────
  {id:'tap',    kind:'tap',            goal:10, name:'광맥 두드리기',
   do:'광맥을 10번 두드린다',        why:'돈은 여기서 나온다',            rw:{gem:1}},
  {id:'upgTap', kind:'upg:tap',        goal:1,  name:'터치 강화',
   do:'터치 강화를 1번 산다',        why:'번 돈을 쓰는 법',               rw:{gem:1}},
  {id:'worker', kind:'unit:worker',    goal:1,  name:'일꾼 뽑기',
   do:'일꾼을 1기 뽑는다',           why:'가만 있어도 벌린다',            rw:{gem:1}},
  {id:'upgGat', kind:'upg:gather',     goal:1,  name:'일꾼 강화',
   do:'일꾼 강화를 1번 산다',        why:'두 번째 수입 축',               rw:{gem:1}},
  // ── 2부 · 기지를 세우고 첫 출격 (10분 세션) ──────────────────
  {id:'barrack',kind:'build:first',    goal:1,  name:()=>_guideB()+' 짓기',
   do:()=>_guideB()+'을 짓는다',      why:'전투 유닛이 나오는 곳',         rw:{gem:2}},
  {id:'unit',   kind:'unit:combat',    goal:1,  name:'유닛 뽑기',
   do:'전투 유닛을 1기 뽑는다',       why:'적 기지를 칠 병력',            rw:{gem:2}},
  {id:'dg1',    kind:'dg:1',           goal:1,  name:'던전으로 나가기',
   do:'좌상단 칩을 눌러 던전 1 로 들어간다', why:'캠프는 집이고 던전이 사냥터다', rw:{gem:2}},
  {id:'break1', kind:'broken',         goal:1,  name:'적 건물 부수기',
   do:'적 진행 건물을 1채 부순다',    why:'깰수록 재화 배수가 오른다',     rw:{gem:2}},
  {id:'dgDone1',kind:'dgDone',         goal:1,  name:'던전 완주',
   do:()=>('진행 건물 '+_guideSteps()+'채를 다 부순다'), why:'다음 던전이 열린다', rw:{gem:3}},
  // ── 3부 · 더 깊이 (한 시간~) ─────────────────────────────────
  {id:'res1',   kind:'research',       goal:1,  name:'연구 끝내기',
   do:'연구를 1개 완료한다',         why:'유닛 전부가 영원히 세진다',      rw:{gem:2}},
  {id:'dg2',    kind:'dg:2',           goal:1,  name:'던전 2',
   do:'던전 2 로 들어간다',          why:'연구 없이는 못 깬다 · 하늘에서도 온다', rw:{gem:3}},
  {id:'dg3',    kind:'dg:3',           goal:1,  name:'던전 3',
   do:'던전 3 으로 들어간다',        why:'순서를 고르면 훨씬 쉬워진다',    rw:{gem:3}},
  {id:'reb',    kind:'rebirth',        goal:1,  name:'환생하기',
   do:'하단 「환생」 에서 환생한다',   why:'전부 되감고 더 세게 다시',      rw:{gem:5}},
];
// 🧬 그 종족의 **첫 전투 건물 이름** — 표는 튜토리얼과 같은 것을 쓴다(TUTO_BLD 가 단일 소스).
function _guideB(){ try{ if(typeof _tutoBName==='function') return _tutoBName(0); }catch(_e){} return '병영'; }
function _guideSteps(){ return (typeof CAMP_DG_STEPS!=='undefined') ? CAMP_DG_STEPS : 6; }
// 표의 글자는 **함수여도 된다**(종족·값이 바뀌면 문구가 따라온다) — 읽는 곳은 이 둘뿐이다.
function guideTx(g, k){ const v=g?g[k]:null; return (typeof v==='function') ? v() : (v||''); }
const GUIDE_BY={}; for(const _g of GUIDE_STEPS) GUIDE_BY[_g.id]=_g;
// 가이드를 띄우는가 — 종족을 아직 안 골랐거나 다 끝냈으면 안 띄운다.
//   ⛔ 종족으로 거르지 말 것(옛 GUIDE_RACE) — 표가 종족을 안 가린다(첫 건물 이름만 바뀐다).
function guideOn(){ const S=guideState(); if(!S || S.i>=GUIDE_STEPS.length) return false;
  const C=(typeof campState==='function')?campState():null;
  return !!(C && C.race); }
function guideState(){ const p=(typeof PROF==='function')?PROF():null; if(!p) return null;
  if(!p.guide) p.guide={ i:0, n:0 };                  // i=지금 단계 · n=그 단계 진행 수
  return p.guide; }
function guideCur(){ const S=guideState(); return (S && S.i<GUIDE_STEPS.length) ? GUIDE_STEPS[S.i] : null; }
function guideDone(){ const S=guideState(); return !!(S && S.i>=GUIDE_STEPS.length); }
// ── 계측 — 캠프가 이 한 곳으로만 넣는다. 지금 단계와 종류가 같을 때만 센다(순서가 있는 퀘스트다) ──
function guideNote(kind, n){ try{
  const S=guideState(), g=guideCur(); if(!S||!g||g.kind!==kind) return;
  S.n=Math.min(g.goal, (S.n||0)+(n||1));
  if(S.n<g.goal){ guidePaint(); return; }
  // 단계 완료 — 보상은 일일 퀘스트와 같은 지급기를 쓴다(두 벌을 만들지 않는다)
  const tx=(typeof dqGive==='function')?dqGive(g.rw):'';
  S.i++; S.n=0;
  if(typeof saveMeta==='function') saveMeta();
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof toast==='function') toast('🧭 '+guideTx(g,'name')+' 완료'+(tx?' — '+tx:''));
  guidePaint(); tutoKick();
}catch(_e){} }
// ── 화면 ① 「지금 할 일」 띠 — 재화 바 바로 아래 ─────────────────
// ⚠ 더보기 **안에만** 두면 초보자가 못 찾는다(메뉴를 열 줄 알면 이미 초보가 아니다).
//   그래서 지금 할 일 **한 줄만** 화면에 두고, 전체 목록은 시트에서 본다.
// ⚠ #phone 직속이다 — 캠프 화면(#homeScreen) 안에 넣으면 캠프 파일을 건드리게 된다.
// ══ 🎓 강제 튜토리얼 (2026-09-04 사용자 확정) ════════════════════════════
//   모바일 초반 튜토리얼 방식: **대상만 남기고 화면을 덮어** 순서대로 따라가게 한다.
//   ⭐ 딤에 「구멍」을 뚫는 게 아니라 **네 판(위·아래·왼·오른)** 으로 둘러싼다 —
//     구멍을 뚫는 방식(mask)은 그 자리의 터치가 딤에 먹혀 대상이 안 눌린다.
//   ⛔ 대상 밖 터치는 전부 막는다(하단 네비·설정 포함) — 「완전 강제」가 사용자 확정이다.
//   ⚠ 3D 오브젝트(본부 등)는 DOM 이 아니라 앵커를 못 잡는다 — 그런 단계는 **맵 전체**를 열어 주고
//     말풍선으로 안내한다(TUTO_AT 의 'map').
// 📋 **튜토리얼은 제 단계표를 갖는다**(2026-09-04 사용자 확정). 가이드(GUIDE_STEPS)와 나눈 이유:
//   가이드의 「광맥 10번」 한 줄이 실제로는 **채굴을 켜고 → 10번 두드리는** 두 동작이라,
//   한 줄로 두면 「여기를 눌러 채굴을 켭니다 0/10」처럼 **셈이 거짓말**을 한다(사용자 지적).
//   ⭐ 진행도는 **게임 상태에서 직접 읽는다**(n()) — 따로 세지 않으므로 어긋날 수가 없다.
//   ⛔ 여기에 이벤트 리스너를 달아 세지 말 것(두 벌이 된다).
const TUTO_DG = 1;   // 🗺 튜토리얼이 데려가는 곳 — 캠프(0)의 바로 다음
// 📚 **셋으로 나눈다**(2026-09-08 사용자 확정) — 스물여섯 단계를 한 줄로 이으면 어디쯤 왔는지
//   알 수 없고 쉬어 갈 자리도 없다. 챕터가 바뀔 때 카드를 한 번 띄우고, 그 뒤로는 말풍선
//   왼쪽 위가 「챕터 2 · 3/13」처럼 **챕터 안에서만** 센다.
//   ⭐ **경계는 표가 아니라 단계다** — TUTO_STEPS 안의 챕터 카드(ch 를 가진 칸)가 곧 경계이고,
//     번호도 그 사이에서 센다. ⛔ 「몇 번부터 몇 번까지」를 따로 적어 두지 말 것: 단계가
//     하나 늘 때마다 두 곳을 고쳐야 하고, 한 곳을 잊으면 번호가 조용히 어긋난다.
//   ⛔ 보상은 나누지 않는다(사용자 확정) — 챕터는 나누는 눈금일 뿐이고 보상은 끝에 한 번이다.
const TUTO_CH = [
  { n:1, title:'자원',        sub:'두드려 벌고, 일꾼에게 맡깁니다' },
  { n:2, title:'기지와 부대',  sub:'짓고, 뽑고, 움직입니다' },
  { n:3, title:'출격',        sub:'던전으로 나갑니다' },
];
// 🃏 챕터 카드 한 칸을 만든다 — 시키는 일이 없고 **읽고 [계속]** 을 누른다(outro 와 같은 어법).
function _tutoChStep(k){ const c=TUTO_CH[k];
  return { id:'ch'+c.n, ch:c.n, goal:1,
    tip:()=>c.title, sub:()=>c.sub, go:()=>'계속',
    at:()=>'all', n:()=>{ const S=guideState(); return (S && S.tack) ? 1 : 0; } }; }
const TUTO_STEPS = [
  _tutoChStep(0),
  // ⚠ 채굴이 켜졌는지는 **campMineModeOn()** 이 안다(#phone.mineMode). 옛 시트의 #campMineTap 을
  //   보고 있었더니 켜도 다음으로 안 넘어갔다(2026-09-04 사용자 신고 · 그 시트는 이제 안 쓴다).
  { id:'mineOn', goal:1,  tip:'여기를 터치하여 채굴 모드를 켭니다',
    at:()=>_tutoVis('[data-minemode]'),
    n:()=>(typeof campMineModeOn==='function' && campMineModeOn()) ? 1 : 0 },
  // ⛏ 채굴 모드에서는 **맵 어디를 눌러도 캔다**(19-camp.js) — 그래서 대상이 맵 전체다.
  { id:'tap',    goal:10, tip:()=>_tutoTapTip('화면을 두드려 미네랄을 획득합니다'),
    at:_tutoTapAt, n:()=>_tutoDelta('tapped') },
  { id:'resOpen',goal:1,  tip:'연구 구역으로 이동합니다',
    at:()=>_tutoVis('.navIt[data-nav="research"]'), n:()=>_tutoVis('[data-res="tap"]') ? 1 : 0 },
  // 💰 **살 돈부터 모은다**(2026-09-04 사용자 지적) — 돈이 없는데 「사세요」라고만 하면 막힌다.
  //   ⭐ 목표는 **그 물건의 값**이고 진행은 **지금 미네랄**이다 — 이미 있으면 즉시 넘어간다.
  //   ⛔ 「10번 두드리기」처럼 횟수로 두지 말 것: 값이 바뀌면(강화·환생) 모자라 또 막힌다.
  { id:'coinWk', goal:()=>_tutoHire(),       tip:()=>_tutoTapTip('일꾼 구매 비용을 모읍니다'),
    at:_tutoTapAt, n:()=>_tutoCoin() },
  { id:'worker', goal:1,  tip:'일꾼을 구매합니다 — 미네랄 자동 채취',
    at:()=>_tutoVis('[data-res="worker"]'),
    n:()=>(typeof campWorkerNPlanned==='function' ? (campWorkerNPlanned()>0?1:0) : 0) },
  // 🏗 **건물 짓기는 손이 네 번 간다**(2026-09-04 사용자 지적) — 채굴을 끄고 · 일꾼을 지정하고 ·
  //   하단 카드를 누른 다음에야 맵에 놓는다. 「맵의 본부를 눌러 병영을 짓습니다」 한 줄로는
  //   그 넷을 알 길이 없어 거기서 막혔다. 그래서 **한 동작에 한 단계**로 편다.
  //   ⚠ 돈은 **채굴이 켜져 있을 때 한꺼번에** 모은다 — 끄고 나면 두드려 벌 수가 없다(순서가 곧 이유다).
  { id:'coinB',  goal:()=>_tutoBCost(0)+_tutoBCost(1), tip:()=>_tutoBuildCostTip(),
    at:_tutoTapAt, n:()=>_tutoCoin() },
  _tutoChStep(1),
  { id:'mineOff',goal:1,  tip:'채굴 모드 해제 버튼을 눌러 일반모드로 전환합니다',
    at:()=>_tutoVis('#campMineStop'),
    n:()=>(typeof campMineModeOn==='function' && !campMineModeOn()) ? 1 : 0 },
  { id:'pickWk', goal:1,  tip:'화면을 드래그하여 일꾼을 지정합니다',
    at:()=>'map', n:()=>_tutoWkSel() },
  { id:'armB1',  goal:1,  tip:()=>'하단의 「'+_tutoBName(0)+'」 카드를 누릅니다',   // 「건설할 카드」
    at:()=>_tutoVis(_tutoBSel(0)) || 'map', n:()=>_tutoArmed(0) },
  { id:'placeB1',goal:1,  tip:()=>'맵에 건설할 자리를 누르고 ▶ 버튼을 눌러 확정합니다',
    at:()=>'map', n:()=>_tutoBuiltI(0) },
  { id:'armB2',  goal:1,  tip:()=>'일꾼을 지정하고 「'+_tutoBName(1)+'」 카드를 누릅니다',
    at:()=>_tutoVis(_tutoBSel(1)) || 'map', n:()=>_tutoArmed(1) },
  { id:'placeB2',goal:1,  tip:()=>'「'+_tutoBName(1)+'」 자리를 누르고 ▶ 로 확정합니다',
    at:()=>'map', n:()=>_tutoBuiltI(1) },
  // 🧹 지은 뒤에는 **일꾼 지정을 푼다**(2026-09-04 사용자 지적). 안 풀면 하단이 건설 목록인 채라
  //   병영을 눌러도 생산 카드가 안 나온다 — 해제 버튼은 공용 ⊘ 하나뿐이다(#btDesel).
  { id:'deselWk',goal:1,  tip:'⊘ 를 눌러 유닛을 지정 해제합니다',
    at:()=>_tutoVis('#btDesel'),
    n:()=>((typeof G!=='undefined' && G.tech && (G.tech.selU||[]).length) ? 0 : 1) },
  // ⚔ 유닛 뽑기도 **두 동작**이다 — 건물을 눌러 지정해야 생산 카드가 열린다.
  //   (2026-09-04 사용자 신고: 병영을 눌렀는데 다음 단계로 안 갔다 — 한 단계에 두 동작을 넣어서였다)
  { id:'selB1',  goal:1,  tip:'지은 건물을 터치합니다',
    at:()=>_tutoBldRect(_tutoBk(2)) || 'map', n:()=>_tutoSelB() },
  { id:'unit',   goal:1,  tip:()=>'전투를 할 유닛을 뽑습니다\n튜토리얼 내에서만 무료로 제공됩니다',
    at:()=>_tutoVis(_tutoUnitSel()) || 'map', n:()=>_tutoUnit() },
  // 🗺 던전 이동도 **세 동작**이다(2026-09-04 사용자 요청) — 칩을 눌러 목록을 열고 · 던전을 고르고 ·
  //   아래 「진입」 을 누른다. 고르기만 하고 끝내면 화면이 열린 채로 남아 무엇을 더 해야 할지 모른다.
  //   ⚠ 캠프가 0 단계라 **첫 이동지는 던전 1** 이다.
  // 🗄 유닛 지정·이동·해제와 화면 조작(확대·밀기·이동 모드) 여섯 단계는 **구역 안내로 옮겼다**
  //   (2026-09-10 사용자 확정 — 「아주 기본적인 것만 강제하고 나머지는 자유롭게」).
  //   ⛔ 여기로 되돌리지 말 것: 강제 단계가 길수록 개편 때마다 통째로 낡는다(실제로 세 곳이 그랬다).
  //   그 문구들은 ZONE_TIPS 에 있다.
  _tutoChStep(2),
  { id:'dgOpen', goal:1,  tip:'좌상단을 눌러 던전 목록을 엽니다',
    at:()=>_tutoVis('#curTitle'), n:()=>_tutoVis('#campDrop') ? 1 : 0 },
  { id:'dgPick', goal:1,  tip:()=>_tutoDgTip(),
    at:()=>_tutoVis('.cdRow[data-dg="'+TUTO_DG+'"]') || _tutoVis('#curTitle'),
    n:()=>((typeof _cdPick!=='undefined' && _cdPick && (_cdPick.dg|0)===TUTO_DG) ? 1 : 0) },
  { id:'dgGo',   goal:1,  tip:()=>('하단의 「' + _tutoGoLabel() + '」 버튼을 눌러 던전에 들어갑니다'),
    at:()=>_tutoVis('.cdGo') || _tutoVis('#curTitle'),
    n:()=>{ const C=(typeof campState==='function')?campState():null;
      return (C && (C.dg|0)>=TUTO_DG) ? 1 : 0; } },
  // 🎁 **마지막은 보상 카드다**(2026-09-10). 전에는 여기서 던전을 설명했는데, 그 설명은
  //   **던전에 처음 들어갈 때** 구역 안내(ZONE_TIPS 'foe')가 한다 — 두 곳에서 말하면 중복이고,
  //   튜토리얼은 곧 판을 걷으므로 여기서 배운 것이 바로 사라진다.
  //   ⚠ 이 단계만 게임 상태가 아니라 **눌렀나**를 본다(S.tack) — 확인 버튼이 그 신호다.
  //   ⭐ 챕터 카드와 **같은 얼굴**이다(제목 · 한 줄 · 버튼) — 껍데기가 하나뿐이라 그렇게 된다.
  { id:'outro',  goal:1,  tip:()=>'기본 조작을 익혔습니다',
    sub:()=>TUTO_END_SUB,                                    // ⚠ 초기화를 말없이 하지 않는다
    at:()=>'all',
    n:()=>{ const S=guideState(); return (S && S.tack) ? 1 : 0; } },
];
// 🧱 건설 비용 안내 — 「병영 건설 비용을 모읍니다」처럼 **그 건물 이름**으로 말한다.
//   ⛔ 「건물」이라고 뭉뚱그리지 말 것 — 종족마다 첫 건물이 다르다(TUTO_BLD).
function _tutoBuildCostTip(){ return _tutoTapTip(_tutoBName(0) + ' 건설 비용을 모읍니다'); }
// 🚪 진입 버튼의 **글자는 화면이 정한다**(campDropRender) — 「이동」이었다가 개편으로 「진입」이 됐다.
//   ⛔ 문구에 손으로 박지 말 것: 버튼 글자가 바뀌면 안내가 곧바로 거짓말이 된다(2026-09-10 실제로 그랬다).
function _tutoGoLabel(){
  const b = document.querySelector('#campDrop .cdGo');
  const t = b ? String(b.textContent||'').trim() : '';
  return t || '진입'; }
// 🗺 던전 고르기 안내 — 이름과 한 줄 설명을 **화면과 같은 함수**에서 꺼낸다.
//   ⛔ hbDun(08-hunt 의 옛 10던전 표)을 쓰지 말 것 — 순서가 달라 **말풍선과 목록의 이름이 어긋난다**
//     (2026-09-10 · 던전 개편이 이름을 campDgName 으로 옮겼다. 같은 실수를 던전 칩이 먼저 했다).
//   ⛔ 획득 배율을 문구에 적지 말 것 — 목록 카드 오른쪽이 이미 말하고, 개편으로 오르는 축이 바뀌었다.
function _tutoDgTip(){
  let nm = '던전 ' + TUTO_DG, ds = '';
  try{ if(typeof campDgName==='function') nm = campDgName(TUTO_DG) || nm; }catch(_e){}
  try{ if(typeof campDgDesc==='function') ds = campDgDesc(TUTO_DG) || ''; }catch(_e){}
  const jo = (typeof josaEul==='function') ? josaEul(nm) : '를';
  return nm + jo + ' 선택합니다' + (ds ? (String.fromCharCode(10) + ds) : ''); }

// ⛏ **맵을 두드려 버는 단계의 공용 대상**(2026-09-04 사용자 신고에서 나왔다).
//   채굴이 꺼져 있으면 맵을 아무리 두드려도 안 캐진다 — 그 상태로 두면 그 단계가 영영 안 끝난다.
//   ⭐ 그래서 꺼져 있으면 **켜는 칸을 먼저 연다.** 이것은 **두 번째 방어선**이다 —
//     첫 번째는 CSS(`#phone.tutoOn #campMineStop`)가 애초에 못 끄게 막는 것이다.
function _tutoTapAt(){ return (typeof campMineModeOn==='function' && campMineModeOn())
  ? 'map' : (_tutoVis('[data-minemode]') || 'map'); }
function _tutoTapTip(base){ return (typeof campMineModeOn==='function' && campMineModeOn())
  ? base : '채굴이 꺼졌습니다 — 여기를 다시 켭니다'; }
// 화면에 **실제로 보이는** 것만 돌려준다 — 숨은 시트 안의 요소를 가리키면 스포트라이트가 안 뜬다
//   (예: #campMineTap 은 채굴 시트 안이라 닫혀 있어도 DOM 에는 있다 · 실측 2026-09-04).
function _tutoVis(sel){ if(!sel) return null; const e=document.querySelector(sel); return (e && e.getClientRects().length) ? e : null; }
// 진행도 밑값 — 「10번 두드리기」처럼 **이번 단계에서 얼마나 했나**를 세는 것은 시작값을 빼야 한다.
function _tutoDelta(key){ const S=guideState(), C=(typeof campState==='function')?campState():null;
  if(!S || !C) return 0;
  if(S.base==null) S.base=(C[key]|0);
  return Math.max(0, (C[key]|0) - S.base); }
function _tutoHire(){ return (typeof campHireCost==='function' && typeof campWorkerNPlanned==='function')
  ? Math.max(1, campHireCost(campWorkerNPlanned())|0) : 1; }
function _tutoCoin(){ const T=(typeof G!=='undefined')?G.tech:null; return T ? Math.floor(T.credit||0) : 0; }
function _tutoBuilt(k){ const T=(typeof G!=='undefined')?G.tech:null;
  return (T && T.built && T.built[k]) ? 1 : 0; }
// 🏗 **종족마다 초반 건물이 다르다.** b=[먼저, 그다음] · u=유닛을 뽑는 건물.
//   ⚠ 여기 키는 **TECH_TREE 키**(union·swarm·aetherial)다 — 화면에서 고르는 terran/zerg/protoss 가
//     아니다(campTechRace 가 옮긴다). ⛔ 'barracks' 처럼 유니온 이름을 박아 두지 말 것.
//   ⚠ 에테리얼은 **동력탑이 먼저**다(동력장 없이는 차원문을 못 짓는다) — 그래서 순서가 종족마다 다르다.
//   ⚠ 스웜은 보급이 건물이 아니라 유닛(수송충)이라 둘째 칸이 없다 — null 이면 그 단계는 저절로 넘어간다.
const TUTO_BLD = {
  // ⛔ 유니온의 둘째 칸은 **비워 둔다** — 캠프의 보급소는 3만이다(campSupplyCost · 30000×1.2^n).
  //   튜토리얼 초반에 손으로 모을 수 있는 돈이 아니다(실측: 목표가 30,150 으로 잡혔다).
  //   인구는 환생 트리로도 올라간다 — 보급소는 한참 뒤의 일이라 첫 안내에서 뺀다.
  union:     { b:['barracks',null],     u:'barracks' },
  aetherial: { b:['pylon','gateway'],   u:'gateway'  },
  swarm:     { b:['pool',null],         u:'hatchery' },
};
function _tutoBk(i){ const T=(typeof G!=='undefined')?G.tech:null;
  const d=(T && TUTO_BLD[T.race]) || null; if(!d) return null;
  return (i===2) ? (d.u||null) : (d.b[i]||null); }
function _tutoBDef(i){ const T=(typeof G!=='undefined')?G.tech:null, k=_tutoBk(i);
  return (k && typeof techGetBldg==='function') ? (techGetBldg(T.race,k)||null) : null; }
function _tutoBName(i){ const b=_tutoBDef(i); return b ? b.name : '건물'; }
function _tutoBCost(i){ const b=_tutoBDef(i); return b ? Math.max(0,b.m|0) : 0; }
// 건설 카드는 data 속성이 없다 — 슬롯이 들고 있는 **onclick 문자열**로 찾는다(techBuildListModel).
function _tutoBSel(i){ const k=_tutoBk(i); return k ? (`.cgSlot[onclick*="techArm('${k}'"]`) : null; }
function _tutoArmed(i){ const k=_tutoBk(i); if(!k) return 1;   // 없는 건물 = 이미 끝난 것으로 친다
  const T=(typeof G!=='undefined')?G.tech:null; return (T && T.arm===k) ? 1 : 0; }
function _tutoBuiltI(i){ const k=_tutoBk(i); return k ? _tutoBuilt(k) : 1; }
// 👷 일꾼을 지정했나 — 건설 카드가 하단에 뜨는 조건이다(지정이 없으면 캠프 요약판이 그대로다).
function _tutoWkSel(){ const T=(typeof G!=='undefined')?G.tech:null;
  if(!T || !T.ents || !(T.selU||[]).length) return 0;
  return T.selU.some(id=>{ const e=T.ents.find(x=>x.eid===id); return !!(e && e.type==='worker'); }) ? 1 : 0; }
// ⚔ 첫 전투 유닛 — 일꾼이 아니고 **인구를 먹는 것**이다(스웜의 수송충은 pop 0 이라 이 조건으로 빠진다).
function _tutoUnitId(){ const b=_tutoBDef(2); if(!b) return null;
  const T=(typeof G!=='undefined')?G.tech:null;
  const wk=(typeof TECH_WORKER!=='undefined' && T) ? TECH_WORKER[T.race] : null;
  const p=(b.produces||[]).find(x=>x && x.id!==wk && (x.pop|0)>0); return p ? p.id : null; }
function _tutoUnitSel(){ const id=_tutoUnitId(); return id ? (`.cgSlot[onclick*="techDoProduce('${id}'"]`) : null; }
// 🏛 유닛을 뽑으려면 **그 건물이 지정돼 있어야** 한다 — 지정이 곧 생산 카드를 여는 동작이다.
// 🏛 **지은 건물을 그 자리에서 감싼다**(2026-09-04 사용자 요청) — 어디에 지었든 따라간다.
//   ⚠ 화면 좌표는 기지 렌더와 **같은 자**를 쓴다(_techW2S · _techFoot · techView().zoom) —
//     다른 자로 재면 3D 건물과 어긋난다(16-build.js 의 HP 바가 쓰는 계산과 같다).
//   ⚠ 3D 건물은 발판보다 **위로** 그려진다(CST_YSHIFT) — 그만큼 올려 잡아야 그림을 감싼다.
//   ⛔ 맵 전체('map')로 되돌리지 말 것: 어디를 누르라는 건지 안 보인다.
// ⚠ **좌표 변환은 캠프 프레임 안에서만 맞다.** `_techW2S` 가 보는 좌표계는 campFrame 이 도는 동안
//   (_campSim) 캠프 것으로 바뀐다(campPatchZoom) — 튜토리얼이 제 박자로 계산하면 관리자 탭 좌표계라
//   링이 **화면 좌상단으로 튄다**(2026-09-04 실측으로 두 번 확인).
//   ⭐ 그래서 캠프가 프레임마다 `tutoBldBoxSave()` 로 자리를 재어 두고, 여기서는 **읽기만** 한다.
//   ⛔ 여기서 다시 계산하지 말 것.
// 📏 건물 링의 자리 — 화면을 보고 맞춘 값이다(2026-09-04).
//   UP  = 3D 가 올라간 만큼 중 **얼마나 따라 올릴지**(1 이면 발판 위쪽 끝, 0 이면 발판 그대로).
//   PAD = 상하좌우 여유(px). 3D 그림이 발판 밖으로 자라므로 발판만 감싸면 좁아 보인다.
//   ⛔ 눈으로 확인하지 않고 바꾸지 말 것 — 3D 는 DOM 이 없어 계산만으로는 못 맞춘다
//     (scripts/tuto-run.mjs 를 SHOT=1 로 돌리면 그 단계를 찍어 준다).
const TUTO_BLD_UP = 0.18, TUTO_BLD_PAD = 9;
let _tutoBox = null;
function tutoBldBoxSave(){
  _tutoBox = null;
  if(typeof G==='undefined' || !G.tech) return;
  if(typeof _techW2S!=='function' || typeof _techFoot!=='function' || typeof _btRect!=='function') return;
  const st=(typeof tutoStep==='function') ? tutoStep() : null;
  if(!st) return;
  const hb0=_btRect(); if(!hb0 || !(hb0.width>0 && hb0.height>0)) return;
  // 🗄 데려갈 자리(moveU)는 구역 안내로 옮겨 갔다(2026-09-10) — 잴 것이 하나 줄었다.
  if(st.id!=='selB1') return;                              // 나머지 단계는 잴 것이 없다
  const bk=_tutoBk(2); if(!bk) return;
  const hb=hb0;
  const e=(G.tech.ents||[]).find(x=>x && x.type==='bldg' && x.bk===bk && (x.bt|0)<=0);
  if(!e) return;
  const f=_techFoot(G.tech.race, bk) || { w:2, h:2 };
  const zm=(typeof techView==='function' && techView()) ? (techView().zoom||1) : 1;
  const s=_techW2S(e.x, e.y);
  const cx=hb.left + s.x*hb.width;
  // 🖼 3D 건물은 발판보다 위로 그려지지만(CST_YSHIFT) **그만큼 다 올리면 너무 높다** —
  //   실측(2026-09-04 사용자 지적: 「범위가 위로 올라가 있고 좁다」)으로 계수를 낮춰 잡았다.
  const ys=(typeof CST_YSHIFT!=='undefined') ? CST_YSHIFT : 0;
  const cy=hb.top + s.y*hb.height - ys*zm*TUTO_BLD_UP;
  // 📏 발판보다 **넉넉하게** 감싼다 — 3D 그림은 발판 밖으로 자란다(지붕·포탑).
  const pw=Math.max(30, f.w*_techCW()*zm*hb.width)  + TUTO_BLD_PAD*2;
  const ph=Math.max(30, f.h*_techCH()*zm*hb.height) + TUTO_BLD_PAD*2;
  _tutoBox = { kind:'bld', bk:bk, left:cx-pw/2, right:cx+pw/2, top:cy-ph/2, bottom:cy+ph/2 }; }
function _tutoBldRect(bk){ return (_tutoBox && _tutoBox.kind==='bld' && _tutoBox.bk===bk) ? _tutoBox : null; }
function _tutoSelB(){ const T=(typeof G!=='undefined')?G.tech:null, k=_tutoBk(2);
  if(!T || !k) return 1;
  if(T.sel==null) return 0;
  const e=(T.ents||[]).find(x=>x.eid===T.sel);
  return (e && e.type==='bldg' && e.bk===k) ? 1 : 0; }
// ⚠ 캠프는 완성된 유닛을 **전장으로 바로 보낸다**(campPatchFinish) — ents 만 보면 영영 0 이다.
//   그래서 셋 다 본다: 이미 나왔나(units 카운터) · 판에 있나 · 뽑는 중인가(대기열 `_pq` · 스웜은 알).
function _tutoUnit(){ const T=(typeof G!=='undefined')?G.tech:null; if(!T) return 0;
  const id=_tutoUnitId(); if(!id) return 1;
  if(T.units && (T.units[id]|0)>0) return 1;
  const es=T.ents||[];
  if(es.some(e=>e.type==='unit' && e.uid===id)) return 1;
  if(es.some(e=>e.type==='egg' && e.id===id)) return 1;
  if(es.some(e=>e.type==='bldg' && (e._pq||[]).some(q=>q && q.id===id))) return 1;
  return 0; }
// 🎁 **첫 전투 유닛은 공짜**(2026-09-04 사용자 확정) — 캠프 레인저는 5,000 이라 튜토리얼 도중에
//   손으로 모을 수 있는 돈이 아니다(campUnitCost · CAMP_UNIT_PRICE).
//   ⛔ 조건을 넓히지 말 것: 튜토리얼이 켜져 있고 · 지금 단계가 「뽑기」고 · 그 유닛을 아직 한 기도
//     안 가졌을 때만이다. 하나라도 빠지면 공짜가 캠프 경제로 샌다.
//   ⚠ 값을 실제로 0 으로 만드는 곳은 `campSyncUnitCost`(19-camp.js) 한 줄이다 — 카드도 그 값을 읽는다.
// ⏱ **튜토리얼 동안은 기다림이 없다**(2026-09-04 사용자 요청) — 건물 짓는 시간·유닛 나오는 시간에
//   할 일이 없어 「멈춰 있는 느낌」이었다. 즉시 완료는 관리자 치트 `nocool` 과 **같은 스위치**다
//   (`_techBuildTime`·`_techProdTime`·`_techResearchTime` 셋이 그 하나를 본다 — 16-build.js).
//   ⛔ 시간 계산을 여기서 새로 하지 말 것. ⚠ 켜고 끄는 곳은 campFrame 한 곳이다(19-camp.js).
function tutoNoWait(){ return (typeof tutoOn==='function') && tutoOn(); }
function tutoFreeUnit(id){
  if(typeof tutoOn!=='function' || !tutoOn()) return false;
  // ⏱ **한 단계 일찍부터** 공짜다(2026-09-04 사용자 지적: 「5,000 으로 잠겨 있다가 뒤늦게 0 이 된다」).
  //   병영을 지정하는 단계(selB1)에서 이미 0 이라야, 카드가 열리는 그 순간부터 0 으로 보인다.
  //   ⛔ 더 넓히지 말 것 — 「그 유닛을 아직 한 기도 안 가졌을 때만」이 새는 것을 막는 마지막 조건이다.
  const st=tutoStep(); if(!st || (st.id!=='unit' && st.id!=='selB1')) return false;
  if(!id || id!==_tutoUnitId()) return false;
  const T=(typeof G!=='undefined')?G.tech:null;
  return !!(T && !(T.units && (T.units[id]|0) > 0)); }
// 🔢 **번호는 「보이는 단계」로 센다**(2026-09-04 사용자 지적 — 「4번이 없고 바로 5번으로 건너뛴다」).
//   종족에 따라 쓰이지 않는 단계(유니온은 둘째 건물이 없다)는 즉시 통과해 화면에 안 나타난다 —
//   그것까지 세면 번호가 중간에 뛴다. ⛔ TUTO_STEPS 에서 지우지 말 것: 에테리얼은 그 둘을 쓴다.
function _tutoLive(st){ if(!st) return false;
  if(st.id==='armB2' || st.id==='placeB2') return _tutoBk(1)!=null;
  return true; }
// 🔢 번호는 **범위 안에서** 센다 — 인자를 안 주면 전체(옛 동작), 챕터 경계를 주면 챕터 안 번호다.
//   ⚠ 챕터 카드는 세지 않는다 — 시키는 일이 아니라 표지라서, 세면 「1/13」이 카드에서 시작한다.
function _tutoNo(from){ let n=0, k=Math.min(tutoIdx(), TUTO_STEPS.length-1);
  for(let i=(from|0);i<=k;i++){ const s=TUTO_STEPS[i]; if(_tutoLive(s) && !s.ch) n++; }
  return Math.max(1, n); }
function _tutoTotal(from, to){ let n=0;
  const a=(from|0), b=(to==null?TUTO_STEPS.length:to);
  for(let i=a;i<b;i++){ const s=TUTO_STEPS[i]; if(_tutoLive(s) && !s.ch) n++; }
  return n; }
// 📚 지금 챕터 — 지나온 마지막 챕터 카드가 정한다(경계가 곧 그 카드다).
function _tutoChNow(){ let c=null, k=Math.min(tutoIdx(), TUTO_STEPS.length-1);
  for(let i=0;i<=k;i++) if(TUTO_STEPS[i].ch) c=TUTO_STEPS[i].ch;
  return c; }
// 📐 지금 챕터의 [시작, 끝) — 앞 카드의 다음 칸부터 다음 카드 앞까지.
function _tutoChSpan(){ let a=0, k=Math.min(tutoIdx(), TUTO_STEPS.length-1);
  for(let i=0;i<=k;i++) if(TUTO_STEPS[i].ch) a=i+1;
  let b=TUTO_STEPS.length;
  for(let i=a;i<TUTO_STEPS.length;i++) if(TUTO_STEPS[i].ch){ b=i; break; }
  return [a, b]; }
function tutoIdx(){ const S=guideState(); return S ? (S.t|0) : 0; }
function tutoStep(){ return TUTO_STEPS[tutoIdx()] || null; }
// 🔧 **검사용 스위치**(CAMP_DEV_NOFAIL 과 같은 어법). 튜토리얼은 화면을 통째로 덮고 입력을 막으므로
//   자동 검사(스모크)가 게임을 조작할 수 없다 — 그래서 검사에서는 꺼 두고, **튜토리얼 전용 스텝만** 켠다.
//   ⛔ 게임 코드에서 이 값을 켜지 말 것. 검사와 개발자 콘솔 전용이다.
let TUTO_OFF=false;
// 🎓 **평소에는 안 뜬다**(2026-09-04 사용자 요청 — 「새로 들어갈 때마다 나온다」).
//   ⚠ 버그가 아니었다: 끝내지도 「그만두기」를 누르지도 않으면 다음 진입에 그 단계부터 다시 뜨는 것이
//     원래 설계였다. 요청은 그 자동 시작을 끄는 것이다.
//   ⭐ 시작하는 문은 이제 **가이드 시트의 「해 보기」 하나뿐**이다(tutoRestart 가 S.trun 을 켠다).
//   ⚠ 신규 계정 첫 진입에 자동으로 켜고 싶어지면 이 상수만 true 로 되돌린다 — 그때도
//     **한 번 뜨면 다시 안 뜬다**(S.tseen). ⛔ tseen 검사를 지우지 말 것: 그게 없으면
//     끝낼 때까지 매번 뜨는 옛 동작으로 돌아간다.
const TUTO_AUTO = false;
function tutoOn(){ const S=guideState();
  if(TUTO_OFF) return false;
  if(S && !S.trun){                       // 「해 보기」로 켠 판이 아니면
    if(!TUTO_AUTO) return false;          //   평소에는 안 뜬다(지금 설정)
    if(S.tseen) return false; }           //   자동이어도 한 번만
  // 🎬 **화면이 넘어가는 중에는 안 뜬다**(2026-09-04 사용자 신고) — 종족을 고르고 캠프로 들어가는
  //   전환(그라데이션·로고)이 끝나기 전에 스포트라이트가 떠서, 아직 없는 것을 가리키고 있었다.
  //   ⚠ 종족 선택(#phone.campPick)이 떠 있는 동안도 아니다 — 그때는 캠프가 아직 아니다.
  { const ph=document.getElementById('phone');
    if(ph && ph.classList.contains('campPick')) return false;
    // 🎬 **로고가 걷히면 바로 뜬다**(2026-09-04 사용자 확정). 전에는 캠프가 다가오는 연출
    //   (campInClip · 2.7초)까지 기다렸는데 「너무 느리다」였다. 기다리는 것은 **검은 판**까지고,
    //   맵이 커지는 동안에는 이미 떠 있어도 된다 — 대상은 하단·상단이라 그 애니와 겹치지 않고,
    //   자리가 조금 움직여도 tutoPump 가 120ms 마다 다시 잰다.
    //   ⛔ campInClip 가드를 되살리지 말 것. ⚠ 종족 판(campPick) 가드는 위에 그대로 둔다 —
    //     그건 「아직 캠프가 아닌」 상태라 가리킬 것이 정말로 없다.
  }
  return !!(S && !S.skip && tutoIdx() < TUTO_STEPS.length
            && typeof campIsOn==='function' && campIsOn()
            && typeof guideOn==='function' && guideOn()); }
// 지금 단계의 대상 — {el|map, tip, n, goal}. 못 찾으면 null(그 프레임은 넘어간다).
// ⚠ goal 은 **숫자이거나 함수**다 — 「모으기」는 그 물건의 값이 목표라 그때 물어봐야 한다.
function _tutoGoal(st){ const g=(typeof st.goal==='function') ? st.goal() : st.goal; return Math.max(1, g|0); }
function tutoTarget(){
  const st=tutoStep(); if(!st) return null;
  const a=st.at();
  const goal=_tutoGoal(st), n=Math.min(goal, st.n()|0);
  const tip=(typeof st.tip==='function') ? st.tip() : st.tip;   // 종족마다 건물 이름이 다르다
  // 🗒 **부제는 단계가 갖는다** — 챕터 카드는 「짓고, 뽑고, 움직입니다」, 마지막 칸은 초기화 예고.
  //   ⛔ 화면 쪽에서 단계 id 를 보고 문구를 고르지 말 것(표가 단일 소스다).
  const sub=(typeof st.sub==='function') ? st.sub() : (st.sub||'');
  if(a==='free') return { free:true, tip:tip, sub:sub, n:n, goal:goal };  // 👆 화면을 통째로 연다
  if(a==='all') return { full:true, ch:st.ch||0, tip:tip, sub:sub, n:n, goal:goal }; // 📖 읽고 넘긴다
  if(a==='map') return { map:true, tip:tip, sub:sub, n:n, goal:goal };
  // 🏛 맵 위의 **한 자리**(건물처럼 DOM 이 아닌 것) — {left,top,right,bottom}
  if(a && a.left!=null) return { rect:a, tip:tip, sub:sub, n:n, goal:goal };
  if(!a) return null;
  return { el:a, tip:tip, sub:sub, n:n, goal:goal };
}
// 다 했으면 다음 단계로 — 진행도를 그릴 때마다 확인한다(따로 이벤트를 안 단다).
// ✅ **완료를 보고 넘어간다**(2026-09-04 사용자 요청) — 목표를 채우면 곧바로 다음으로 가지 않고
//   0.3초 머문다. 그동안 오른쪽 진행이 「1 / 1」 **초록**으로 바뀌어, 무엇 때문에 넘어가는지가 보인다.
//   ⛔ 0 으로 되돌리지 말 것(넘어가는 이유가 안 보인다) · ⛔ 길게 잡지 말 것(손이 기다린다).
//   ⚠ 머무는 시각은 S.hold 에 둔다 — 중간에 나가도 이미 달성한 것이라 다음에 바로 넘어갈 뿐 무해하다.
const TUTO_HOLD_MS = 300;
function tutoAdvance(){
  const S=guideState(), st=tutoStep(); if(!S || !st) return false;
  if((st.n()|0) < _tutoGoal(st)){ if(S.hold) delete S.hold; return false; }
  // ⚠ **이 종족에서 안 쓰는 단계는 머물지 않는다**(2026-09-04). 그런 단계는 n() 이 처음부터
  //   달성이라, 머물게 두면 화면에 0.3초씩 뜬다 — 이름도 없어 「건물 카드를 누릅니다」처럼 보였다.
  //   ⛔ _tutoLive 검사를 빼지 말 것(유니온에서 둘째 건물 단계 둘이 그렇다).
  if(_tutoLive(st)){ const now=Date.now();
    if(!S.hold){ S.hold=now;                                   // 방금 채웠다 — 소리도 여기서 낸다
      if(typeof playSfx==='function') playSfx('ui_confirm');
      return false; }
    if(now - S.hold < TUTO_HOLD_MS) return false;               // 아직 보여 주는 중
    delete S.hold; }
  const _last=(tutoIdx()+1 >= TUTO_STEPS.length);
  // 📖 **「읽었다」는 한 칸짜리다** — 안 지우면 다음 챕터 카드가 뜨자마자 통과한다(카드가 셋이다).
  S.t=tutoIdx()+1; S.base=null; delete S.tack; delete S.mv0; delete S.vw0; delete S.vp0;
  if(_last) tutoFinish();
  // 💰 **단계가 바뀌면 값도 그 자리에서 다시 잰다.** 유닛 값은 campFrame 이 프레임마다 갱신하는데
  //   「첫 한 기 공짜」는 **단계**에 달려 있다 — 안 그러면 카드가 한 박자 옛 값으로 잠겨 보인다.
  //   ⛔ 여기서 값을 계산하지 말 것. campSyncUnitCost 가 단일 소스다(19-camp.js).
  try{ if(typeof campSyncUnitCost==='function') campSyncUnitCost(); }catch(_e){}
  try{ if(typeof techUIRender==='function') techUIRender(); }catch(_e){}
  if(typeof saveMeta==='function') saveMeta();
  return true;
}
let _tutoT=0;
function tutoPaint(){
  const ph=document.getElementById('phone'); if(!ph) return;
  // ⭐ 그릴 때마다 「다 했나」를 본다 — 이벤트를 따로 달지 않으므로 무엇으로 달성했든 넘어간다.
  //   ⏱ 넘어갔으면 **이 프레임에서 바로** 새 대상을 그린다(아래로 그대로 이어진다) — 한 박자 쉬면 굼떠 보인다.
  if(tutoOn()){ let guard=0; while(tutoAdvance() && ++guard<TUTO_STEPS.length){} }
  let ov=document.getElementById('tutoOv');
  if(!tutoOn()){ if(ov) ov.remove(); ph.classList.remove('tutoOn'); return; }
  const t=tutoTarget(); if(!t){ if(ov) ov.remove(); ph.classList.remove('tutoOn'); return; }
  if(!ov){ ov=document.createElement('div'); ov.id='tutoOv'; ov.className='tutoOv';
    ov.innerHTML='<i class="tuT"></i><i class="tuB"></i><i class="tuL"></i><i class="tuR"></i>'
      +'<i class="tuRing"></i><div class="tuTip"><span class="tuHd"><b class="tuStep"></b><b class="tuN"></b></span>'
      +'<span class="tuTx"></span><span class="tuSub" hidden></span>'
      // 🎁 **마지막 단계의 확인 버튼**(2026-09-04 사용자 제안) — 보상을 버튼에 얹으면
      //   「여기서 끝난다」가 한눈에 읽힌다. ⛔ 새 버튼을 만들지 말 것: 공용 .actBtn.pri 다.
      +'<button type="button" class="actBtn pri tuGo" hidden></button></div>';
    ph.appendChild(ov);
    // 🎞 **처음 뜰 때는 안 미끄러진다** — 만들자마자 transition 을 걸면 판이 0 에서 자라 보인다.
    //   한 박자 뒤에 .tuAnim 을 붙여, 그 뒤의 **단계 전환부터** 부드럽게 옮겨 가게 한다.
    if(typeof requestAnimationFrame==='function') requestAnimationFrame(function(){ ov.classList.add('tuAnim'); });
    else ov.classList.add('tuAnim');
    // 📖 마지막 안내는 **확인 버튼**으로 끝낸다(2026-09-04 사용자 제안 — 보상을 버튼에 얹었다).
    //   ⛔ 「아무 데나 터치」로 되돌리지 말 것 — 실수로 눌러 보상 안내를 못 읽고 지나간다.
    //   ⚠ 게임 행동이 아니라 「읽었다」는 신호라, 계측(dqNote)이 아니라 여기서 받는 것이 맞다.
    ov.querySelector('.tuGo').addEventListener('click', function(ev){
      if(ev && ev.stopPropagation) ev.stopPropagation();
      const st=tutoStep(); if(!st || (st.id!=='outro' && !st.ch)) return;
      const S=guideState(); if(S) S.tack=1;
      tutoPaint(); }); }
  ph.classList.add('tutoOn');
  // 🎓 **한 번 떴다**는 표시 — 자동 시작(TUTO_AUTO)일 때 두 번째부터 안 뜨게 하는 자리다.
  //   ⚠ 지금은 자동이 꺼져 있어 쓰이지 않지만, 되돌렸을 때 곧바로 살아나야 한다.
  { const _S=guideState(); if(_S && !_S.tseen){ _S.tseen=1;
      try{ if(typeof saveMeta==='function') saveMeta(); }catch(_e){} } }
  // 🚧 **맵을 열면 그 위에 떠 있는 버튼까지 함께 열린다**(2026-09-04 사용자 신고).
  //   「채굴 멈춤」(#campMineStop)은 #phone 직속이라 맵 영역과 겹친다 — 맵 단계에서 그걸 누르면
  //   캐는 것이 멎어 「맵을 두드립니다」가 **영영 안 끝났다**(돈 모으기 단계도 같다).
  //   ⭐ 그래서 **그 버튼이 지금 단계의 대상일 때만** 살려 둔다(막는 일은 CSS 가 한다).
  //   ⛔ 버튼을 숨기지 말 것 — 자리가 사라지면 mineOff 단계에서 가리킬 것이 없다.
  { const _ms=document.getElementById('campMineStop');
    if(_ms) _ms.classList.toggle('tuLive', t.el===_ms); }
  const pr=ph.getBoundingClientRect();
  // 맵 단계는 **맵 전체**를 연다(3D 오브젝트는 앵커를 못 잡는다)
  const host=document.getElementById('homeScreen');
  // 📖 읽고 넘기는 단계는 **여는 곳이 없다** — 점 하나로 두면 판 넷이 화면을 다 덮어,
  //   어디를 눌러도 아래 리스너가 받는다(그게 「화면을 터치하세요」의 구현이다).
  const r = t.rect ? t.rect
    // 👆 화면 전체 — 판 넷이 두께 0 이 되어 **아무것도 안 막는다**(그 단계만 강제를 푼다).
    : t.free ? { left:pr.left, right:pr.right, top:pr.top, bottom:pr.bottom }
    : t.full ? { left:pr.left+pr.width/2, right:pr.left+pr.width/2,
                       top:pr.top+pr.height*0.40, bottom:pr.top+pr.height*0.40 }
    // 🗺 **전장 = 상단 띠와 하단 시트 사이**(2026-09-08 사용자 확정).
    //   ⚠ 아랫변은 **시트를 직접 재서** 잡는다 — 예전엔 170px 상수였는데, 시트는 고른 것에 따라
    //     커진다(기지 요약 ↔ 생산 카드 줄). 상수로 두면 병영을 고른 화면에서 틀 아랫변이
    //     시트 뒤로 숨어 「어디까지가 전장인지」가 안 보였다(실측 camp-tuto-picku.png).
    //   ⚠ 시트가 화면 밖으로 내려가 있을 때(배치 중)는 네비 위까지가 전장이다.
    : t.map ? (function(){ const h=(host||ph).getBoundingClientRect();
      const top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topPad'))||10;
      const cur=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--curH'))||34;
      const nav=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navH'))||42;
      const y0=pr.top+top+cur+26;
      let y2=pr.bottom-nav;                              // 시트가 없거나 내려가 있으면 네비 위까지
      const _sh=document.getElementById('btSheet');
      if(_sh){ const s=_sh.getBoundingClientRect();
        if(s.height>0 && s.top>y0 && s.top<y2) y2=s.top; }
      return { left:h.left, right:h.right, top:y0, bottom:Math.max(y0+40, y2) }; })()
    : t.el.getBoundingClientRect();
  // 📚 **대상이 없는 칸은 구멍도 없다** — 챕터 카드와 마지막 보상 카드(t.full)가 그렇다.
  //   여느 단계의 여유(PAD)를 그대로 두면 열 곳이 없는데도 14px 짜리 밝은 점이 카드 위에 남는다
  //   (2026-09-08 실측). 시킬 일이 없으니 열 곳도 없다.
  const PAD=(t.ch || t.full) ? 0 : 6;
  const x1=Math.max(0, r.left-pr.left-PAD), y1=Math.max(0, r.top-pr.top-PAD);
  const x2=Math.min(pr.width, r.right-pr.left+PAD), y2=Math.min(pr.height, r.bottom-pr.top+PAD);
  const px=(v)=>v.toFixed(1)+'px';
  const q=(s)=>ov.querySelector(s);
  // 🎞 **멀리 뛸 때는 미끄러지지 않는다**(2026-09-04 사용자 지적 — 「왼쪽으로 갔다가 온다」).
  //   미끄러지면 그 사이 엉뚱한 데를 훑는다(실측 궤적: 하단 버튼 → 좌상단 칸까지 화면을 가로질렀다).
  //   ⭐ 먼 이동은 그 자리에서 갈아타고, 링이 **살짝 부풀며 나타난다**(tuPop) — 「거기서 새로 떴다」로 읽힌다.
  //   ⚠ **자리를 주기 전에** 정해야 한다(2026-09-08). 링 style 을 준 뒤에 transition 을 꺼 봐야
  //     이미 시작한 보간은 안 멈춘다 — 실측에서 링이 364px 에서 53px 로 계속 미끄러졌다.
  //   ⚠ 가까운 이동은 그대로 미끄러진다(단계가 이어진다는 느낌은 그쪽이 낫다).
  //   📚 **챕터 카드로 들어갈 때도 즉시** — 대상이 없어 구멍이 화면만 하게 벌어져 있다가
  //     점으로 오므라든다. 그건 「미끄러진다」가 아니라 **밝은 사각형이 닫히는** 것이라
  //     한 박자 동안 아무것도 아닌 판이 떠 있는 것으로 보인다(2026-09-08 실측 camp-tuto-ch2.png).
  { const mx=(x1+x2)/2, my=(y1+y2)/2, prev=ov._tuAt;
    ov._tuAt={ x:mx, y:my };
    if((prev && Math.hypot(mx-prev.x, my-prev.y) > pr.height*0.30) || !!t.ch){
      ov.classList.remove('tuAnim');
      const rg=q('.tuRing'); rg.classList.remove('tuPop'); void rg.offsetWidth; rg.classList.add('tuPop');
      if(typeof requestAnimationFrame==='function') requestAnimationFrame(function(){ ov.classList.add('tuAnim'); });
      else ov.classList.add('tuAnim'); } }
  q('.tuT').style.cssText='left:0;top:0;right:0;height:'+px(y1);
  q('.tuB').style.cssText='left:0;top:'+px(y2)+';right:0;bottom:0';
  q('.tuL').style.cssText='left:0;top:'+px(y1)+';width:'+px(x1)+';height:'+px(y2-y1);
  q('.tuR').style.cssText='left:'+px(x2)+';top:'+px(y1)+';right:0;height:'+px(y2-y1);
  q('.tuRing').style.cssText='left:'+px(x1)+';top:'+px(y1)+';width:'+px(x2-x1)+';height:'+px(y2-y1);
  // 👆 화면 전체를 여는 단계 · 📚 챕터 카드에는 테두리를 안 그린다.
  //   ⚠ 챕터 카드에 링이 남으면 화면 한가운데에 **아무것도 아닌 붉은 사각형**이 뜬다 —
  //     시키는 일이 없는 칸이라 가리킬 곳도 없다(2026-09-08 실측 camp-tuto-ch2.png).
  q('.tuRing').classList.toggle('tuHide', !!t.free || !!t.ch || !!t.full);
  // 말풍선은 **대상 옆**에 붙인다(2026-09-04 사용자 지적) — 화면 아래 끝에 두면 어디를 누르라는 건지
  //   눈이 두 번 움직인다. 아래에 자리가 있으면 아래, 없으면 위. 좌우는 대상 중심을 따라간다.
  // 🎞 **단계가 바뀔 때만** 말풍선을 다시 태운다(2026-09-04 사용자 요청 — 「조금 더 자연스럽게」).
  //   ⚠ tutoPaint 는 120ms 마다 도므로 조건 없이 붙이면 글자가 계속 깜빡인다.
  //   ⛔ animation-fill-mode 를 주지 말 것 — 기본 상태가 보임이라 애니가 안 돌아도 안전하다.
  { const _st=tutoStep(), _id=_st?_st.id:'';
    if(ov._tuStep!==_id){ ov._tuStep=_id;
      const _tp=q('.tuTip'); _tp.classList.remove('tuIn'); void _tp.offsetWidth; _tp.classList.add('tuIn'); } }
  // 🏷 왼쪽 위 — 챕터 카드는 「챕터 2」, 마지막 칸은 「튜토리얼 종료」, 그 밖은 「챕터 2 · 3/13」.
  //   ⭐ 번호를 **챕터 안에서** 센다(2026-09-08 사용자 확정) — 스물여섯을 통으로 세면 어디쯤
  //     왔는지 감이 안 온다. ⛔ 전체 통산으로 되돌리지 말 것.
  { const _st=tutoStep(), _last=!!(_st && _st.id==='outro'), _sp=q('.tuStep');
    const _ch=_tutoChNow(), _sp2=_tutoChSpan();
    _sp.textContent = _st && _st.ch ? ('챕터 ' + _st.ch)
      : _last ? TUTO_END_TITLE
      : ((_ch ? ('챕터 ' + _ch + ' · ') : '') + _tutoNo(_sp2[0]) + ' / ' + _tutoTotal(_sp2[0], _sp2[1]));
    _sp.classList.toggle('end', _last || !!(_st && _st.ch)); }
  q('.tuTx').textContent=t.tip;
  // 🗒 부제 — 챕터 카드의 한 줄 소개 · 마지막 칸의 초기화 예고. 없으면 자리도 없다.
  { const _sb=q('.tuSub'); _sb.textContent=t.sub||''; _sb.hidden=!t.sub; }
  // 🃏 챕터 카드는 **판이 다르다** — 제목이 크고 진행 숫자가 없다(시키는 일이 없다).
  // 🃏 **대상이 없는 칸은 판이 다르다** — 챕터 카드와 마지막 보상 카드. 제목이 크고 진행 숫자가 없다
  //   (시키는 일이 없으니 「0 / 1」이 뜻이 없다). 껍데기가 하나뿐이라 둘이 같은 얼굴이 된다.
  { const _st=tutoStep(), _isCh=!!((_st && _st.ch) || t.full);
    q('.tuTip').classList.toggle('ch', _isCh);
    q('.tuN').hidden=_isCh; }
  q('.tuN').textContent=t.n+' / '+t.goal;                    // 오른쪽 = **이번 단계의 진행**
  q('.tuN').classList.toggle('ok', t.n>=t.goal);             // ✅ 다 했으면 초록(0.3초 머무는 동안 보인다)
  // 🎁 마지막 단계에만 확인 버튼 — 보상을 **버튼 안에** 얹는다(재화 아이콘은 공용 resIco 하나뿐이다).
  { const _go=q('.tuGo'), _st=tutoStep(), _last=!!(_st && _st.id==='outro');
    const _isCh=!!(_st && _st.ch);
    _go.hidden=!(_last || _isCh);
    // 🃏 챕터 카드의 버튼은 **「계속」** — 보상이 없으므로 글자만이다.
    //   ⚠ 캐시 열쇠는 **단계 id** 다 — 「채운 적 있다」로 두면 챕터 2 카드에 챕터 1 의 글자가 남는다.
    if(_isCh && _go._tuFill!==_st.id){ _go._tuFill=_st.id;
      _go.innerHTML='<span>'+((typeof _st.go==='function')?_st.go():'계속')+'</span>'; }
    if(_last && _go._tuFill!=='outro'){ _go._tuFill='outro';
      // 🎁 **받는 것을 다 적는다** — 젬(보상)과 밑천 미네랄(새 출발). 둘 다 실제로 들어가므로
      //   하나만 적으면 나머지가 없는 것처럼 보인다. ⛔ 이모지 금지 — 재화 그림은 resIco 하나다.
      const _rw=[];
      { const _g=(TUTO_REWARD && TUTO_REWARD.gem)|0;
        if(_g>0) _rw.push(['gem', _g]); }
      if(TUTO_RESET_MIN>0) _rw.push(['mineral', TUTO_RESET_MIN]);
      _go.innerHTML='<span>확인</span>' + _rw.map(function(r){
        const _ico=(typeof resIco==='function') ? resIco(r[0],'tuGoIco') : '';
        return '<b class="tuGoRw">'+_ico+'×'+r[1].toLocaleString()+'</b>'; }).join('');
      if(typeof paintIcons==='function') try{ paintIcons(_go); }catch(_e){} } }
  // 📏 **폭은 글에 맞춘다**(2026-09-04 사용자 요청 — 「두 줄로 나오는 것들이 한 줄로」).
  //   전에는 250px 고정이라 짧은 문구도 두 줄이 됐고, 「탭하 / 세요」처럼 어절 중간에서 끊겼다.
  //   ⭐ width:max-content + max-width → 짧으면 한 줄, 길면 그 폭에서 **어절 단위로** 접힌다
  //     (끊는 규칙은 CSS 의 word-break:keep-all 이 갖는다).
  //   ⚠ 폭을 **먼저 재고** 자리를 한 번에 쓴다 — 두 번 나눠 쓰면 transition 이 중간 자리에서 튄다.
  const tip=q('.tuTip');
  // ⚠ 상한 340 — 300 에서는 13번(「맵에 건설할 자리를 누르고 ▶ 버튼을 눌러 확정합니다」)이 두 줄이었다.
  //   화면 폭(390)에서 좌우 10px 을 뺀 370 이 물리적 한계다. ⛔ 더 넓히면 말풍선이 화면을 꽉 채운다.
  const TIPMAX=Math.max(150, Math.min(340, pr.width-20));
  tip.style.maxWidth=px(TIPMAX); tip.style.width='max-content';
  const tw=Math.min(TIPMAX, tip.getBoundingClientRect().width||TIPMAX);
  const th=tip.getBoundingClientRect().height||64;
  const below=(y2+th+14<pr.height);
  const cx=(x1+x2)/2, L=Math.max(10, Math.min(pr.width-tw-10, cx-tw/2));
  tip.style.left=px(L); tip.style.right=''; tip.style.bottom='';
  tip.style.top = below ? px(y2+10) : px(Math.max(10, y1-th-10));
  tip.classList.toggle('up', !below);
  // 🎯 **꼬리는 대상을 가리킨다**(2026-09-04 사용자 지적) — 말풍선은 화면 안에 들어가려고 좌우로
  //   밀리는데(위 L 의 clamp), 꼬리가 가운데 고정이라 **엉뚱한 데를 가리키고 있었다**.
  //   ⭐ 말풍선 안에서의 x = 대상 중심 - 말풍선 왼쪽. 모서리(radius)를 넘지 않게 양끝을 물린다.
  //   ⛔ left:50% 로 되돌리지 말 것.
  { const tx=Math.max(12, Math.min(tw-12, cx-L));
    tip.style.setProperty('--tuTail', px(tx)); }
}
// 매 프레임 다시 재지 않는다 — 대상이 움직이는 것은 화면이 바뀔 때뿐이라 그때만 부른다.
//   ⚠ 다만 시트가 새로 그려지면 대상 노드가 바뀌므로 짧은 간격으로 한 번 더 확인한다.
function tutoKick(){
  // ⛔ **부팅이 끝나기 전에는 돌지 않는다**(2026-09-04). 로딩 중에 이 일을 하면 load 이벤트가
  //   늦어지거나 안 떨어진다 — 실측: 2인 검사에서 첫 페이지가 readyState 'interactive' 에서 멈췄다.
  if(typeof document!=='undefined' && document.readyState!=='complete'){
    if(!_tutoWait){ _tutoWait=1; window.addEventListener('load', ()=>{ _tutoWait=0; tutoKick(); }, {once:true}); }
    return; }
  // ⏱ **다음 프레임에 그린다**(2026-09-04 사용자 지적: 넘어가는 게 굼떴다). 60ms 지연을 두면
  //   화면은 이미 바뀌었는데 스포트라이트가 한 박자 늦게 따라와 어긋나 보인다.
  if(_tutoRaf) return;
  _tutoRaf=requestAnimationFrame(()=>{ _tutoRaf=0; tutoPaint(); });
  tutoPump(); }
let _tutoRaf=0;
let _tutoWait=0;
let _tutoTimer=0;
// 🔁 **튜토리얼이 도는 동안은 스스로 다시 그린다**(2026-09-04). 전에는 dqNote 가 불릴 때만 그렸는데,
//   일꾼 지정·건설 카드 누르기·건물 배치는 **계측을 안 거친다** — 그 단계들이 영영 안 넘어갔다.
//   ⛔ 그 자리마다 tutoKick() 을 흩뿌리지 말 것(빠뜨린 곳이 곧 멈추는 곳이 된다).
//   ⏱ 120ms = 손이 느꼈을 때 이미 넘어가 있는 간격이고, tutoPaint 는 껐을 때 즉시 빠져나온다.
//   타이머는 **튜토리얼을 마쳤거나 껐을 때만** 선다 — 캠프 밖으로 나간 동안은 돌되 아무것도 안 그린다.
function tutoPump(){ if(_tutoTimer || typeof setInterval!=='function') return;
  _tutoTimer=setInterval(function(){
    const S=(typeof guideState==='function')?guideState():null;
    const done = TUTO_OFF || !S || S.skip || tutoIdx()>=TUTO_STEPS.length
                 || !(typeof guideOn==='function' && guideOn());
    if(done){ clearInterval(_tutoTimer); _tutoTimer=0; tutoPaint(); return; }
    tutoPaint();
  }, 120); }
function guidePaint(){
  const ph=document.getElementById('phone'); if(!ph) return;
  let el=document.getElementById('guideBar');
  // ⚠ 조건은 campIsOn() **하나뿐이다.** 화면을 옮기면 campExit() 가 캠프를 걷으므로 이것으로 충분하다.
  //   ⛔ 여기에 「#homeScreen 이 보이는가」를 더하지 말 것 — 스모크는 3D 를 못 띄워
  //     **화면 없이 상태만 흉내 내므로**(campIsOn 을 가짜로 true), 그 조건을 넣으면 검사가 깨진다.
  //   ⭐ 띠가 상점 머리줄을 덮던 문제(실측 2026-08-31: 배너 top 105 · 상점 헤더 top 106)는
  //     조건이 아니라 **타이밍**이었다 — 화면을 옮겨도 이 함수가 안 불려 옛 띠가 남았다.
  //     showAppScreen() 이 마지막에 부르게 고쳤다(12-appshell.js).
  const show=guideOn() && (typeof campIsOn==='function') && campIsOn();
  if(!show){ if(el) el.remove(); return; }
  const g=guideCur(), S=guideState(); if(!g) { if(el) el.remove(); return; }
  if(!el){ el=document.createElement('button'); el.id='guideBar'; el.className='guideBar';
    el.onclick=openGuide; ph.appendChild(el); }
  const pct=Math.max(0,Math.min(100,(S.n/g.goal)*100));
  el.innerHTML='<i class="gbIco" data-ico="flag"></i>'
    +'<span class="gbTx">'+escHtml(guideTx(g,'do'))+'</span>'
    +(g.goal>1 ? '<b class="gbN">'+S.n+'</b><i class="gbD">/'+g.goal+'</i>' : '')
    +'<i class="gbFill" style="width:'+pct.toFixed(1)+'%"></i>';
  if(typeof paintIcons==='function') paintIcons(el); }
// ── 화면 ② 전체 목록 — 일일 퀘스트와 **같은 껍데기**(.hbModal/.hbmCard/.hbRows) ──
function openGuide(){ const el=document.getElementById('hbGuideSheet'); if(!el) return;
  el.classList.remove('hide'); renderGuide();
  if(typeof playSfx==='function') playSfx('ui_open'); }
function closeGuide(){ const el=document.getElementById('hbGuideSheet'); if(el) el.classList.add('hide');
  if(typeof playSfx==='function') playSfx('ui_close'); }
// 🎓 **튜토리얼을 직접 켜 보는 자리**(2026-09-04 사용자 요청) — 가이드 시트 맨 위 줄.
//   ⭐ 튜토리얼은 원래 새 계정에서 저절로 뜬다. 이미 지나간 사람이 **다시 볼 길**이 없어서 여기 둔다.
//   ⚠ 켜면 화면이 덮이고 대상 밖 터치가 막힌다(완전 강제) — 그래서 **그만두기**를 함께 둔다.
//     ⛔ 그만두기를 없애지 말 것: 없으면 켠 사람이 끝낼 때까지 빠져나올 길이 없다.
// 🎁 **끝내면 보상**(2026-09-04 사용자 확정 — 젬 20).
//   ⛔ 젬을 여기서 직접 더하지 말 것 — 공용 지급기 dqGive 하나가 단일 소스다(저장·재화 바 갱신까지 한다).
//   ⚠ S.tdone 으로 **한 번만** 준다. 「해 보기」로 다시 돌려도 두 번 주지 않는다.
const TUTO_REWARD = { gem:20 };
// 🎁 마치고 새로 시작할 때 쥐어 주는 밑천. 연습판을 걷어내므로 빈손이 되면 안 된다.
const TUTO_RESET_MIN = 500;
// 🏁 **마지막 칸의 말**(2026-09-08 사용자 확정) — 왼쪽 위는 단계 번호 대신 「튜토리얼 종료」,
//   문구 아래에는 판이 걷힌다는 예고를 둔다. ⛔ 초기화를 말없이 하지 말 것 —
//   지어 둔 병영과 유닛이 사라지므로, 누르기 **전에** 알아야 한다.
const TUTO_END_TITLE = '튜토리얼 종료';
const TUTO_END_SUB   = '게임이 초기화 됩니다';
function tutoFinish(){
  const S=guideState(); if(!S) return;
  delete S.trun; delete S.tack;
  if(S.tdone){ if(typeof saveMeta==='function') saveMeta(); return; }
  S.tdone=1;
  let tx='';
  try{ if(typeof dqGive==='function') tx=dqGive(TUTO_REWARD); }catch(_e){}
  if(typeof saveMeta==='function') saveMeta();
  // 🔄 **연습판을 걷고 맨 처음부터**(2026-09-08 사용자 확정) — 튜토리얼은 던전 1 까지 데려가고
  //   건물·유닛을 남긴다. 그대로 두면 「처음 하는 판」이 아니라 남이 쓰던 판에서 시작하는 셈이다.
  //   ⛔ 환생이 아니다 — 배수·포인트를 안 준다(campTutoReset 이 그 경계를 지킨다).
  //   🎁 밑천 미네랄을 함께 준다 — 빈손으로 되돌리면 앞의 스무 단계가 헛수고로 보인다.
  let reset=false;
  try{ if(typeof campTutoReset==='function') reset=campTutoReset(TUTO_RESET_MIN); }catch(_e){}
  if(reset){ try{ if(typeof techUIRender==='function') techUIRender(); }catch(_e){}
    try{ if(typeof updateCurBar==='function') updateCurBar(); }catch(_e){} }
  if(typeof playSfx==='function') try{ playSfx('ui_confirm'); }catch(_e){}
  if(typeof toast==='function')
    toast('🎓 튜토리얼 완료 — ' + (tx || '💎 젬 20')
          + (reset ? (' · ' + TUTO_RESET_MIN.toLocaleString() + ' 미네랄로 새 출발') : '')); }
function tutoRestart(){
  const S=guideState(); if(!S) return;
  // ⭐ 이 판을 **직접 켠 것**으로 표시한다 — 평소에는 안 뜨므로(TUTO_AUTO) 이 표시가 없으면 안 뜬다.
  S.t=0; S.base=null; delete S.skip; delete S.tack; S.trun=1;
  if(typeof TUTO_OFF!=='undefined') TUTO_OFF=false;
  if(typeof closeGuide==='function') closeGuide();
  // 캠프 밖이면 데려간다 — 튜토리얼은 캠프 화면 위에서만 뜻이 있다
  if(typeof campIsOn==='function' && !campIsOn() && typeof openHome==='function') openHome();
  if(typeof saveMeta==='function') saveMeta();
  setTimeout(tutoPaint, 260); }
function tutoStop(){
  const S=guideState(); if(!S) return;
  S.skip=1; delete S.trun;              // 직접 켠 표시도 걷는다(다시 켜려면 「해 보기」)
  if(typeof saveMeta==='function') saveMeta();
  tutoPaint();
  if(typeof toast==='function') toast('🎓 튜토리얼을 껐습니다 — 가이드에서 다시 켤 수 있습니다'); }
function renderGuide(){ const box=document.getElementById('hbGuideBody'); if(!box) return;
  const S=guideState(); if(!S) return;
  const running=(typeof tutoOn==='function') && tutoOn();
  box.innerHTML='<div class="gqTuto">'
    +'<span class="gqTutoTx">따라 하며 배우는 튜토리얼'
      +(running?(' <b>'+(tutoIdx()+1)+' / '+TUTO_STEPS.length+' 진행 중</b>'):'')+'</span>'
    +'<button class="actBtn gqTutoGo" type="button" onclick="tutoRestart()">'+(running?'처음부터':'해 보기')+'</button>'
    +(running?'<button class="actBtn sub gqTutoNo" type="button" onclick="tutoStop();renderGuide()">그만두기</button>':'')
    +'</div>'
    +GUIDE_STEPS.map(function(g,i){
    const done=(i<S.i), now=(i===S.i);
    const n=now?(S.n||0):(done?g.goal:0);
    const bar=(now && g.goal>1) ? '<i class="gqBar"><i style="width:'+((n/g.goal)*100).toFixed(1)+'%"></i></i>' : '';
    return '<div class="gqRow'+(done?' done':'')+(now?' now':'')+'">'
      +'<i class="gqIx">'+(done?'✓':(i+1))+'</i>'
      +'<span class="gqBody"><b class="gqNm">'+escHtml(guideTx(g,'do'))+'</b>'
        +'<em class="gqWhy">'+escHtml(guideTx(g,'why'))+'</em>'+bar+'</span>'
      +'<span class="gqRw">'+((typeof dqRwIco==='function')?dqRwIco(g.rw):'')+'</span></div>'; }).join('');
  { const h=document.getElementById('hbGuideHead');
    if(h) h.textContent=guideDone()? '다 끝냈다' : ('가이드 '+(S.i+1)+' / '+GUIDE_STEPS.length); }
  if(typeof paintIcons==='function') paintIcons(box); }

// ══ 🗺 구역 안내 — 그 화면을 처음 열 때 한 번 (2026-09-10 사용자 확정) ═════════
//   ⭐ **강제 튜토리얼은 아주 기본만** 잡고, 나머지는 여기서 「말해 주고 자유롭게」다.
//     스물여섯 단계를 손잡고 끌던 것을 열일곱으로 줄이면서 뺀 여섯 단계(유닛 지정·이동·해제 ·
//     확대·밀기·이동 모드)가 여기로 왔다. ⛔ 다시 강제 단계로 되돌리지 말 것 —
//     강제가 길수록 개편 때마다 통째로 낡는다(던전 개편에서 안내 셋이 한꺼번에 거짓말이 됐다).
//   ⭐ **껍데기는 챕터 카드 그대로**(.tutoOv > .tuTip.ch) — 새 컴포넌트를 만들지 않는다.
//     다른 점은 딱 하나: 판 넷이 화면을 **덮기만 하고 막지는 않는다**(자유 플레이 중이다).
//   ⚠ 「봤다」는 프로필에 남는다(S.zt) — 환생·튜토리얼 되감기로 지워지지 않는다(배운 것은 안 되감는다).
//   ⛔ 튜토리얼이 도는 동안에는 안 뜬다 — 두 카드가 겹치면 어느 것을 눌러야 할지 모른다.
const ZONE_TIPS = [
  { id:'res',  title:'연구 구역',
    sub:'터치 강화는 두드릴 때 버는 양을,\n일꾼 강화는 일꾼이 캐는 양을 늘립니다',
    at:()=>!!_tutoVis('[data-res="tap"]') },
  // 🖐 부대와 화면 조작은 **한 장에** — 유닛을 처음 뽑았을 때가 둘 다 필요해지는 순간이다.
  { id:'army', title:'부대 조작',
    sub:'화면을 드래그해 유닛을 지정하고,\n맵을 눌러 그 자리로 보냅니다 · ⊘ 로 지정을 풉니다',
    at:()=>_zoneHasUnit() },
  { id:'view', title:'화면 조작',
    sub:'두 손가락으로 확대하고 움직입니다\n빈 바닥을 길게 누르면 한 손가락으로도 밀립니다',
    at:()=>_zoneHasUnit() },
  // 🏰 던전에 처음 들어왔을 때 — 개편이 만든 규칙 셋을 한 장에(진행·표적·구간).
  { id:'foe',  title:'적 기지',
    sub:()=>('진행 건물 ' + _zoneSteps() + '채를 부수면 완주입니다\n'
           + '적 건물을 눌러 「공격 대상」으로 표적을 고를 수 있고,\n'
           + '문지기 탑이 살아 있으면 그 구간 건물은 잠깁니다'),
    at:()=>((typeof campDgN==='function') ? (campDgN()|0) > 0 : false) },
];
function _zoneSteps(){ return (typeof CAMP_DG_STEPS!=='undefined') ? CAMP_DG_STEPS : 6; }
// 🪖 전투 유닛이 하나라도 서 있나 — 일꾼은 안 센다(일꾼 조작은 튜토리얼이 이미 가르쳤다).
function _zoneHasUnit(){
  const T=(typeof G!=='undefined')?G.tech:null; if(!T) return false;
  return (T.ents||[]).some(e=>e && e.type==='unit'); }
// 아직 안 본 것 중 **조건이 맞는 첫 장**. 튜토리얼 중이거나 캠프 밖이면 없다.
function zoneTipNext(){
  if(typeof campIsOn!=='function' || !campIsOn()) return null;
  if(typeof tutoOn==='function' && tutoOn()) return null;
  const S=guideState(); if(!S) return null;
  const seen=S.zt || (S.zt={});
  for(const z of ZONE_TIPS){ if(seen[z.id]) continue;
    let ok=false; try{ ok=!!z.at(); }catch(_e){}
    if(ok) return z; }
  return null; }
// 봤다고 적고 닫는다 — 다시 안 뜬다.
function zoneTipClose(id){
  const S=guideState(); if(S){ S.zt=S.zt||{}; if(id) S.zt[id]=1;
    if(typeof saveMeta==='function') saveMeta(); }
  const el=document.getElementById('zoneTip'); if(el) el.remove(); }
// 그린다 — 챕터 카드와 **같은 마크업**이라 CSS 를 새로 쓰지 않는다.
//   ⚠ 판 넷은 화면을 덮되 `pointer-events:none`(.ztOv)이라 게임 조작을 막지 않는다.
function zoneTipPaint(){
  const ph=document.getElementById('phone'); if(!ph) return;
  const z=zoneTipNext();
  let el=document.getElementById('zoneTip');
  if(!z){ if(el) el.remove(); return; }
  if(el && el.dataset.zt===z.id) return;              // 이미 그 장이 떠 있다
  if(el) el.remove();
  el=document.createElement('div'); el.id='zoneTip'; el.className='tutoOv ztOv';
  el.dataset.zt=z.id;
  const sub=(typeof z.sub==='function')?z.sub():z.sub;
  el.innerHTML='<i class="tuT"></i><i class="tuB"></i><i class="tuL"></i><i class="tuR"></i>'
    +'<div class="tuTip ch tuIn"><span class="tuHd"><b class="tuStep end"></b></span>'
    +'<span class="tuTx"></span><span class="tuSub"></span>'
    +'<button type="button" class="actBtn pri tuGo"><span>확인</span></button></div>';
  el.querySelector('.tuStep').textContent='안내';
  el.querySelector('.tuTx').textContent=z.title;
  el.querySelector('.tuSub').textContent=sub;
  ph.appendChild(el);
  // 자리 — 화면 가운데. 판 넷은 두께 0 으로 두고(막지 않는다) 카드만 앉힌다.
  const tip=el.querySelector('.tuTip');
  tip.style.maxWidth='300px'; tip.style.width='max-content';
  const pr=ph.getBoundingClientRect(), tr=tip.getBoundingClientRect();
  tip.style.left=Math.round((pr.width-tr.width)/2)+'px';
  tip.style.top=Math.round(pr.height*0.40)+'px';
  el.querySelector('.tuGo').addEventListener('click', function(ev){
    if(ev && ev.stopPropagation) ev.stopPropagation();
    if(typeof playSfx==='function') try{ playSfx('ui_confirm'); }catch(_e){}
    zoneTipClose(z.id); }); }
// 밖에서 부르는 입구 — 재화 바를 갱신할 때마다 본다(캠프가 수입마다 부른다).
//   ⛔ 제 타이머를 두지 말 것: 카드 한 장 띄우자고 프레임을 더 돌릴 이유가 없다.
function zoneTipKick(){ try{ zoneTipPaint(); }catch(_e){} }
