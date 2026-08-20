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
  {id:'dg1',     cat:'out',  ico:'dungeon', kind:'dgWin', goal:1,   name:'토벌',         desc:'토벌 단계 1회 클리어',        rw:{pcoin:2200, gear:1}},
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
function dqRwTx(rw){ if(!rw) return '';
  const t=[]; const ri=function(k,v){ return '<span class="dqRw">'+resIco(k,'dqRi')+fmtCur(v)+'</span>'; };
  if(rw.pcoin) t.push(ri('mineral',rw.pcoin));
  if(rw.gas)   t.push(ri('gas',rw.gas));
  if(rw.gem)   t.push(ri('gem',rw.gem));
  for(const k in DQ_TK) if(rw[k]) t.push('<span class="dqRw">'+resIco('ticket_'+k,'dqRi')+DQ_TK[k]+' ×'+rw[k]+'</span>');   // '뽑기권'은 🎟 이 말한다
  return t.join(''); }
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
function dqNote(kind, n){ try{
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
// ── 퀘스트 수령 ──
function dqDoneN(){ const D=dqState(); if(!D) return 0;
  return D.q.filter(function(e){ const Q=DQ_BY[e.id]; return Q && e.n>=Q.goal; }).length; }
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
// ⛔ 좌상단 건설 드롭다운(renderHbBuild/#hbBuildWrap)은 폐지했다(2026-08-14).
//    더보기 > 건설 = 즉시 건설 모드이고, 고르는 곳은 하단 패널이다(hbBuildCardHTML).
//    오른쪽 위에서 열었는데 왼쪽 위에 목록이 뜨던 것이 문제였다.
function renderHbBar(){ const bar=document.getElementById('hbBar'); if(!bar||!_hb) return;
  const S=_hb, coin=Math.floor(((typeof PROF==='function'&&PROF())||{}).pcoin||0);
  // 하단 바는 '전투 중에 쓰는 것'만 — 스킬 3개. 판을 여는 것(건설·토벌·부스트)은 좌상단 줄로 갔다.
  // 판 하나에 셋을 담고(트레이), 자동은 판 '밖' 작은 칩으로 뺀다 — 가끔 만지는 설정이라 스킬보다 가벼워야 한다.
  const au=!!hbHunt().skAuto;
  let h='<div class="hbGrp"><div class="hbSkWrap">'
    +'<button class="hbAutoChip'+(au?' on':'')+'" onclick="hbToggleAuto()" title="스킬 자동 사용 '+(au?'켬':'꺼짐')+'">'
    +'<i></i>AUTO '+(au?'ON':'OFF')+'</button><div class="hbTray">';
  for(const k in HB_SKILLS){ const SK=HB_SKILLS[k];
    h+='<button class="hbSk" data-k="'+k+'" onclick="hbUseSkill(&#39;'+k+'&#39;)" title="'+SK.name+' — '+SK.tip+'">'
      +'<span class="hbSkIco">'+_icoImg('skills', SK.ico)+'</span>'
      +'<b class="hbSkSec"></b>'                    // 남은 초 — 글자는 hbSkCdPaint 가 넣는다
      +'<i class="hbCd"><b></b></i></button>'; }   // 껍데기는 --cd 로만 움직인다(다시 그리지 않음)
  bar.innerHTML=h+'</div></div></div>'; }
