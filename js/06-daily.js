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
const GUIDE_RACE='union';        // 이 표가 전제하는 종족(TECH_TREE 키)
const GUIDE_STEPS=[
  // ── 1부 · 돈 버는 법 (1분 세션) ───────────────────────────────
  {id:'tap',    kind:'tap',            goal:10, name:'광맥 두드리기',
   do:'광맥을 10번 두드린다',        why:'돈은 여기서 나온다',            rw:{gem:1}},
  {id:'upgTap', kind:'upg:tap',        goal:1,  name:'터치 강화',
   do:'터치 업그레이드를 1번 산다',   why:'번 돈을 쓰는 법',               rw:{gem:1}},
  {id:'worker', kind:'unit:worker',    goal:1,  name:'일꾼 뽑기',
   do:'일꾼을 1기 뽑는다',           why:'가만 있어도 벌린다',            rw:{gem:1}},
  {id:'upgGat', kind:'upg:gather',     goal:1,  name:'채취 강화',
   do:'자동생산 업그레이드를 1번 산다', why:'두 번째 수입 축',             rw:{gem:1}},
  // ── 2부 · 기지를 세운다 (10분 세션) ──────────────────────────
  {id:'barrack',kind:'build:barracks', goal:1,  name:'병영 짓기',
   do:'병영을 짓는다',               why:'테크가 열리는 문',              rw:{gem:2}},
  {id:'supply', kind:'build:supply',   goal:1,  name:'보급고 짓기',
   do:'보급고를 짓는다',             why:'인구가 있어야 병력이 는다',      rw:{gem:2}},
  {id:'unit',   kind:'unit:combat',    goal:1,  name:'유닛 뽑기',
   do:'전투 유닛을 1기 뽑는다',       why:'기지를 지킬 병력',              rw:{gem:2}},
  {id:'dg2',    kind:'dg:2',           goal:1,  name:'던전 내려가기',
   do:'좌상단 칩을 눌러 던전 2 로 옮긴다', why:'더 깊을수록 더 번다',       rw:{gem:2}},
  {id:'res1',   kind:'research',       goal:1,  name:'연구 끝내기',
   do:'연구를 1개 완료한다',         why:'유닛 전부가 영원히 세진다',      rw:{gem:2}},
  // ── 3부 · 환생까지 (한 시간~) ────────────────────────────────
  {id:'refine', kind:'build:refinery', goal:1,  name:'정제소 짓기',
   do:'정제소를 짓는다',             why:'두 번째 자원(가스)',            rw:{gem:2}},
  {id:'academy',kind:'build:academy',  goal:1,  name:'훈련소 짓기',
   do:'훈련소를 짓는다',             why:'통신소의 조건',                 rw:{gem:2}},
  {id:'comsat', kind:'build:comsat',   goal:1,  name:'통신소 짓기',
   do:'본부에 통신소를 붙인다',       why:'환생이 일어나는 곳',            rw:{gem:3}},
  {id:'dg3',    kind:'dg:3',           goal:1,  name:'던전 3 도달',
   do:'던전 3 으로 옮긴다',          why:'여기서부터 스캔이 작동한다',     rw:{gem:3}},
  {id:'reb',    kind:'rebirth',        goal:1,  name:'환생하기',
   do:'통신소의 스캔을 누른다',       why:'전부 초기화하고 더 세게 다시',   rw:{gem:5}},
  {id:'rebUse', kind:'rebUse',         goal:1,  name:'환생 보상 쓰기',
   do:'환생으로 얻은 것을 쓴다',      why:'두 번째 판이 시작된다',         rw:{gem:5}},
];
const GUIDE_BY={}; for(const _g of GUIDE_STEPS) GUIDE_BY[_g.id]=_g;
// 가이드를 띄우는가 — 종족이 다르면 안 띄운다(위 ⚠ 참고). 다 끝냈어도 안 띄운다.
function guideOn(){ const S=guideState(); if(!S || S.i>=GUIDE_STEPS.length) return false;
  const C=(typeof campState==='function')?campState():null;
  if(!C || !C.race) return false;                     // 종족을 아직 안 골랐다
  const tr=(typeof campTechRace==='function')?campTechRace(C.race):C.race;
  return tr===GUIDE_RACE; }
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
  if(typeof toast==='function') toast('🧭 '+g.name+' 완료'+(tx?' — '+tx:''));
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
const TUTO_STEPS = [
  // ⚠ 채굴이 켜졌는지는 **campMineModeOn()** 이 안다(#phone.mineMode). 옛 시트의 #campMineTap 을
  //   보고 있었더니 켜도 다음으로 안 넘어갔다(2026-09-04 사용자 신고 · 그 시트는 이제 안 쓴다).
  { id:'mineOn', goal:1,  tip:'여기를 눌러 채굴을 켭니다',
    at:()=>_tutoVis('[data-minemode]'),
    n:()=>(typeof campMineModeOn==='function' && campMineModeOn()) ? 1 : 0 },
  // ⛏ 채굴 모드에서는 **맵 어디를 눌러도 캔다**(19-camp.js) — 그래서 대상이 맵 전체다.
  { id:'tap',    goal:10, tip:()=>_tutoTapTip('맵을 두드려 미네랄을 캡니다'),
    at:_tutoTapAt, n:()=>_tutoDelta('tapped') },
  { id:'resOpen',goal:1,  tip:'하단의 「연구」를 엽니다',
    at:()=>_tutoVis('.navIt[data-nav="research"]'), n:()=>_tutoVis('[data-res="tap"]') ? 1 : 0 },
  // 💰 **살 돈부터 모은다**(2026-09-04 사용자 지적) — 돈이 없는데 「사세요」라고만 하면 막힌다.
  //   ⭐ 목표는 **그 물건의 값**이고 진행은 **지금 미네랄**이다 — 이미 있으면 즉시 넘어간다.
  //   ⛔ 「10번 두드리기」처럼 횟수로 두지 말 것: 값이 바뀌면(강화·환생) 모자라 또 막힌다.
  { id:'coinTap',goal:()=>_tutoCost('tap'),  tip:()=>_tutoTapTip('맵을 두드려 살 돈을 모읍니다'),
    at:_tutoTapAt, n:()=>_tutoCoin() },
  { id:'upgTap', goal:1,  tip:'터치 강화를 삽니다 — 한 번 더 누르면 삽니다',
    at:()=>_tutoVis('[data-res="tap"]'), n:()=>_tutoLv('tap') },
  { id:'coinWk', goal:()=>_tutoHire(),       tip:()=>_tutoTapTip('일꾼 값을 모읍니다 — 맵을 두드리세요'),
    at:_tutoTapAt, n:()=>_tutoCoin() },
  { id:'worker', goal:1,  tip:'일꾼을 뽑습니다 — 가만 있어도 벌어 줍니다',
    at:()=>_tutoVis('[data-res="worker"]'),
    n:()=>(typeof campWorkerNPlanned==='function' ? (campWorkerNPlanned()>0?1:0) : 0) },
  { id:'coinGat',goal:()=>_tutoCost('gather'),tip:()=>_tutoTapTip('채취 강화 값을 모읍니다'),
    at:_tutoTapAt, n:()=>_tutoCoin() },
  { id:'upgGat', goal:1,  tip:'채취 강화를 삽니다 — 두 번째 수입',
    at:()=>_tutoVis('[data-res="gather"]'), n:()=>_tutoLv('gather') },
  // 🏗 **건물 짓기는 손이 네 번 간다**(2026-09-04 사용자 지적) — 채굴을 끄고 · 일꾼을 지정하고 ·
  //   하단 카드를 누른 다음에야 맵에 놓는다. 「맵의 본부를 눌러 병영을 짓습니다」 한 줄로는
  //   그 넷을 알 길이 없어 거기서 막혔다. 그래서 **한 동작에 한 단계**로 편다.
  //   ⚠ 돈은 **채굴이 켜져 있을 때 한꺼번에** 모은다 — 끄고 나면 두드려 벌 수가 없다(순서가 곧 이유다).
  { id:'coinB',  goal:()=>_tutoBCost(0)+_tutoBCost(1), tip:()=>_tutoTapTip('건물 값을 모읍니다 — 맵을 두드리세요'),
    at:_tutoTapAt, n:()=>_tutoCoin() },
  { id:'mineOff',goal:1,  tip:'오른쪽 위 「채굴 멈춤」을 누릅니다',
    at:()=>_tutoVis('#campMineStop'),
    n:()=>(typeof campMineModeOn==='function' && !campMineModeOn()) ? 1 : 0 },
  { id:'pickWk', goal:1,  tip:'일꾼을 드래그해 지정합니다 — 건설 카드가 하단에 뜹니다',
    at:()=>'map', n:()=>_tutoWkSel() },
  { id:'armB1',  goal:1,  tip:()=>'하단의 「'+_tutoBName(0)+'」 카드를 누릅니다',
    at:()=>_tutoVis(_tutoBSel(0)) || 'map', n:()=>_tutoArmed(0) },
  { id:'placeB1',goal:1,  tip:()=>'맵에서 지을 자리를 누르고 ▶ 로 확정합니다',
    at:()=>'map', n:()=>_tutoBuiltI(0) },
  { id:'armB2',  goal:1,  tip:()=>'일꾼을 지정하고 「'+_tutoBName(1)+'」 카드를 누릅니다',
    at:()=>_tutoVis(_tutoBSel(1)) || 'map', n:()=>_tutoArmed(1) },
  { id:'placeB2',goal:1,  tip:()=>'「'+_tutoBName(1)+'」 자리를 누르고 ▶ 로 확정합니다',
    at:()=>'map', n:()=>_tutoBuiltI(1) },
  // 🧹 지은 뒤에는 **일꾼 지정을 푼다**(2026-09-04 사용자 지적). 안 풀면 하단이 건설 목록인 채라
  //   병영을 눌러도 생산 카드가 안 나온다 — 해제 버튼은 공용 ⊘ 하나뿐이다(#btDesel).
  { id:'deselWk',goal:1,  tip:'⊘ 를 눌러 일꾼 지정을 풉니다',
    at:()=>_tutoVis('#btDesel'),
    n:()=>((typeof G!=='undefined' && G.tech && (G.tech.selU||[]).length) ? 0 : 1) },
  // ⚔ 유닛 뽑기도 **두 동작**이다 — 건물을 눌러 지정해야 생산 카드가 열린다.
  //   (2026-09-04 사용자 신고: 병영을 눌렀는데 다음 단계로 안 갔다 — 한 단계에 두 동작을 넣어서였다)
  { id:'selB1',  goal:1,  tip:()=>'맵의 「'+_tutoBName(2)+'」 을 눌러 지정합니다',
    at:()=>'map', n:()=>_tutoSelB() },
  { id:'unit',   goal:1,  tip:()=>'「'+_tutoUnitName()+'」 를 뽑습니다 — 첫 한 기는 공짜입니다',
    at:()=>_tutoVis(_tutoUnitSel()) || 'map', n:()=>_tutoUnit() },
  // 🗺 던전 이동도 **세 동작**이다(2026-09-04 사용자 요청) — 칩을 눌러 목록을 열고 · 던전을 고르고 ·
  //   아래 「이동」 을 누른다. 고르기만 하고 끝내면 화면이 열린 채로 남아 무엇을 더 해야 할지 모른다.
  //   ⚠ 캠프가 0 단계라 **첫 이동지는 던전 1** 이다(전에 던전 2 라고 적어 두었던 것은 잘못이었다).
  { id:'dgOpen', goal:1,  tip:'좌상단을 눌러 던전 목록을 엽니다',
    at:()=>_tutoVis('#curTitle'), n:()=>_tutoVis('#campDrop') ? 1 : 0 },
  { id:'dgPick', goal:1,  tip:'「던전 '+TUTO_DG+'」 을 고릅니다',
    at:()=>_tutoVis('.cdRow[data-dg="'+TUTO_DG+'"]') || _tutoVis('#curTitle'),
    n:()=>((typeof _cdPick!=='undefined' && _cdPick && (_cdPick.dg|0)===TUTO_DG) ? 1 : 0) },
  { id:'dgGo',   goal:1,  tip:'아래 「이동」 을 눌러 내려갑니다',
    at:()=>_tutoVis('.cdGo') || _tutoVis('#curTitle'),
    n:()=>{ const C=(typeof campState==='function')?campState():null;
      return (C && (C.dg|0)>=TUTO_DG) ? 1 : 0; } },
];

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
function _tutoLv(k){ return (typeof campUpgLv==='function' && campUpgLv(k)>0) ? 1 : 0; }
// 💰 값과 지갑 — 「모으기」 단계가 쓴다. 값은 **살 때마다 오르므로** 그때그때 물어본다.
function _tutoCost(k){ return (typeof campUpgCost==='function') ? Math.max(1, campUpgCost(k)|0) : 1; }
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
function _tutoUnitName(){ const id=_tutoUnitId(); if(!id) return '전투 유닛';
  const T=(typeof G!=='undefined')?G.tech:null;
  if(typeof _techRealName==='function' && T){ try{ return _techRealName(T.race, id); }catch(_e){} }
  const b=_tutoBDef(2), p=b && (b.produces||[]).find(x=>x&&x.id===id); return (p&&p.name) || id; }
function _tutoUnitSel(){ const id=_tutoUnitId(); return id ? (`.cgSlot[onclick*="techDoProduce('${id}'"]`) : null; }
// 🏛 유닛을 뽑으려면 **그 건물이 지정돼 있어야** 한다 — 지정이 곧 생산 카드를 여는 동작이다.
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
function tutoIdx(){ const S=guideState(); return S ? (S.t|0) : 0; }
function tutoStep(){ return TUTO_STEPS[tutoIdx()] || null; }
// 🔧 **검사용 스위치**(CAMP_DEV_NOFAIL 과 같은 어법). 튜토리얼은 화면을 통째로 덮고 입력을 막으므로
//   자동 검사(스모크)가 게임을 조작할 수 없다 — 그래서 검사에서는 꺼 두고, **튜토리얼 전용 스텝만** 켠다.
//   ⛔ 게임 코드에서 이 값을 켜지 말 것. 검사와 개발자 콘솔 전용이다.
let TUTO_OFF=false;
function tutoOn(){ const S=guideState();
  if(TUTO_OFF) return false;
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
  if(a==='map') return { map:true, tip:tip, n:n, goal:goal };
  if(!a) return null;
  return { el:a, tip:tip, n:n, goal:goal };
}
// 다 했으면 다음 단계로 — 진행도를 그릴 때마다 확인한다(따로 이벤트를 안 단다).
function tutoAdvance(){
  const S=guideState(), st=tutoStep(); if(!S || !st) return false;
  if((st.n()|0) < _tutoGoal(st)) return false;
  S.t=tutoIdx()+1; S.base=null;
  // 💰 **단계가 바뀌면 값도 그 자리에서 다시 잰다.** 유닛 값은 campFrame 이 프레임마다 갱신하는데
  //   「첫 한 기 공짜」는 **단계**에 달려 있다 — 안 그러면 카드가 한 박자 옛 값으로 잠겨 보인다.
  //   ⛔ 여기서 값을 계산하지 말 것. campSyncUnitCost 가 단일 소스다(19-camp.js).
  try{ if(typeof campSyncUnitCost==='function') campSyncUnitCost(); }catch(_e){}
  try{ if(typeof techUIRender==='function') techUIRender(); }catch(_e){}
  if(typeof playSfx==='function') playSfx('ui_confirm');
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
      +'<span class="tuTx"></span></div>';
    ph.appendChild(ov); }
  ph.classList.add('tutoOn');
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
  const r = t.map ? (function(){ const h=(host||ph).getBoundingClientRect();
      const top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topPad'))||10;
      const cur=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--curH'))||34;
      const nav=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navH'))||42;
      return { left:h.left, right:h.right, top:pr.top+top+cur+26, bottom:pr.bottom-nav-170 }; })()
    : t.el.getBoundingClientRect();
  const PAD=6;
  const x1=Math.max(0, r.left-pr.left-PAD), y1=Math.max(0, r.top-pr.top-PAD);
  const x2=Math.min(pr.width, r.right-pr.left+PAD), y2=Math.min(pr.height, r.bottom-pr.top+PAD);
  const px=(v)=>v.toFixed(1)+'px';
  const q=(s)=>ov.querySelector(s);
  q('.tuT').style.cssText='left:0;top:0;right:0;height:'+px(y1);
  q('.tuB').style.cssText='left:0;top:'+px(y2)+';right:0;bottom:0';
  q('.tuL').style.cssText='left:0;top:'+px(y1)+';width:'+px(x1)+';height:'+px(y2-y1);
  q('.tuR').style.cssText='left:'+px(x2)+';top:'+px(y1)+';right:0;height:'+px(y2-y1);
  q('.tuRing').style.cssText='left:'+px(x1)+';top:'+px(y1)+';width:'+px(x2-x1)+';height:'+px(y2-y1);
  // 말풍선은 **대상 옆**에 붙인다(2026-09-04 사용자 지적) — 화면 아래 끝에 두면 어디를 누르라는 건지
  //   눈이 두 번 움직인다. 아래에 자리가 있으면 아래, 없으면 위. 좌우는 대상 중심을 따라간다.
  q('.tuStep').textContent=(tutoIdx()+1)+' / '+TUTO_STEPS.length;
  q('.tuTx').textContent=t.tip;
  q('.tuN').textContent=t.n+' / '+t.goal;                    // 오른쪽 = **이번 단계의 진행**
  const tip=q('.tuTip'), TIPW=250, below=(y2+86<pr.height);
  const cx=(x1+x2)/2, L=Math.max(10, Math.min(pr.width-TIPW-10, cx-TIPW/2));
  tip.style.cssText='width:'+px(TIPW)+';left:'+px(L)+';'
    +(below? 'top:'+px(y2+10) : 'top:'+px(Math.max(10, y1-84)));
  tip.classList.toggle('up', !below);
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
    +'<span class="gbTx">'+escHtml(g.do)+'</span>'
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
function tutoRestart(){
  const S=guideState(); if(!S) return;
  S.t=0; S.base=null; delete S.skip;
  if(typeof TUTO_OFF!=='undefined') TUTO_OFF=false;
  if(typeof closeGuide==='function') closeGuide();
  // 캠프 밖이면 데려간다 — 튜토리얼은 캠프 화면 위에서만 뜻이 있다
  if(typeof campIsOn==='function' && !campIsOn() && typeof openHome==='function') openHome();
  if(typeof saveMeta==='function') saveMeta();
  setTimeout(tutoPaint, 260); }
function tutoStop(){
  const S=guideState(); if(!S) return;
  S.skip=1;
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
      +'<span class="gqBody"><b class="gqNm">'+escHtml(g.do)+'</b>'
        +'<em class="gqWhy">'+escHtml(g.why)+'</em>'+bar+'</span>'
      +'<span class="gqRw">'+((typeof dqRwIco==='function')?dqRwIco(g.rw):'')+'</span></div>'; }).join('');
  { const h=document.getElementById('hbGuideHead');
    if(h) h.textContent=guideDone()? '다 끝냈다' : ('가이드 '+(S.i+1)+' / '+GUIDE_STEPS.length); }
  if(typeof paintIcons==='function') paintIcons(box); }
