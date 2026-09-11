/* ============================================================================
 * 07-home-upgrade.js — 하단 네비 · 유즈맵 소셜 도크 (+ 펫 장착 칸)
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * 🗄 2026-09-10 — 사냥터 UI(동료 뽑기·부스트·환생 팝업·업그레이드 격자)는 다락으로 갔다.
 *    HOME 메인이 캠프로 바뀌면서 열리는 길이 사라진 화면들이다(ATTIC.md 「🏘 마을」).
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ── D. 레벨 해금 확장 — 해금이 실제로 무언가를 열도록 배선 ──
// 🔓 장착/출전 칸 — 펫·동료 모두 **0칸에서 시작해 미네랄로 하나씩 연다**(2026-08-14 확정).
//   최대 3칸이고 레벨 해금이 아니다 — 그래서 PROF_UNLOCKS 의 pet_slot3·4, ally_plus 는 전부 삭제됐다.
//   ⚠ 여는 값을 두 곳에 적지 말 것. MG_SLOT_COST 한 줄이 전부다.
const MG_SLOT_MAX=3;
const MG_SLOT_COST=[500, 6000, 60000];   // 1·2·3번째 칸을 여는 미네랄

// ── 하단 6칸 네비게이션 ──
// 화면마다 바를 새로 만들지 않는다 — #phone 위에 하나만 두고 여기서 표시·활성 탭을 정한다.
// ══ 하단 네비 = 2층(최상위 구역 → 구역 전용) ══════════════════════════
// 최상위 5칸에서 구역을 누르면 그 구역 전용 네비로 내려간다: [‹][구역][하위…].
// '‹ 돌아가기' = 사냥터 화면 + 최상위 네비(홈이 허브).
// ⚠ 마크업은 손으로 쓰지 않는다 — 이 표가 단일 소스이고 navPaint()가 칸을 만든다.
//   sub.cur 가 있는 구역(정비·유즈맵)은 '지금 고른 것'이 있어 하위 한 칸이 .cur 로 표시된다.
//   sub.cur 가 없는 구역(사냥터)은 하위가 전부 '여는 동작'이라 선택 표시가 없다.
//   하위가 없는 구역(강화·상점)은 내려가지 않는다 — [‹][상점] 2칸은 빈 껍데기라서.
const NAV_TREE=[
  // 사냥터 = 기본 화면이자 최상위 그 자체 — 눌러도 내려가지 않는다(하위는 화면 상단 버튼줄이 맡는다)
  // 사냥터 = 기본 화면이자 '‹ 뒤로'가 돌아가는 곳. 칸은 두지 않는다(noCell) — 다른 구역이 내려갈 때
  //   자기 이름 칸을 빼는 것과 같은 규칙이다. ⚠ 항목 자체는 남겨야 navShow('home')·navBack() 이 찾는다.
  { k:'home', label:'사냥터', ico:'home', noCell:true, go:()=>openHome(), subs:[] },
  // 🔬 연구 · 📋 임무 — 옛 '캐릭터'·'정비' 자리(2026-08-25 개편).
  //   ⭐ 왜 이 둘인가: 기획서(GAME_DIRECTION.md)가 **성장 축을 「연구·경제」 둘로** 못박았고(§3-1),
  //     **1분 세션**(들어와서 쓸 곳이 한눈에 보여야 한다 · §2-2)을 가장 중요하게 본다.
  //     연구 = 강해지는 곳 · 임무 = 뭘 할지 알려주는 곳.
  //   옛 두 칸은 내용이 전부 유보였다 — 캐릭터(스탯·환생·스킬)는 §5-A, 정비(장비·펫·동료)는 §5-B.
  //   ⛔ **코드는 지우지 않았다**(유보는 삭제가 아니다 · §5). openUpgScreen()·openGear() 와
  //     #upgScreen·#gearScreen 은 그대로 살아 있고, 하단에서 길만 닫았다. 되살릴 땐 이 줄을 되돌리면 된다.
  //   ⚠ 지금은 **껍데기다** — 화면 본문이 '준비 중'이다. 하위 항목(subs)도 아직 없다.
  // 🔬 연구 — 하위 셋(자원·무장·기술). 실제 동작은 js/20-camp-research.js 가 갖는다.
  //   ⭐ 고른 요소는 화면이 아니라 **캠프 하단 시트**에 뜬다 — 그래서 go 가 캠프로 데려간다.
  { k:'research', label:'연구', ico:'upg',  go:()=>openResearch(),
    cur:()=>(typeof _resSec!=='undefined'?_resSec:null), reset:()=>campResEnter('res'), subs:[
      { k:'res',  label:'자원', ico:'coin', act:()=>campResEnter('res') },
      { k:'arm',  label:'무장', ico:'upg',  act:()=>campResEnter('arm') },
      { k:'tech', label:'기술', ico:'flag', act:()=>campResEnter('tech') } ] },
  // 🔁 환생 — 옛 '임무' 자리(2026-08-31). 임무(가이드·일일·출석·도전과제)는 **더보기 ☰** 로 간다:
  //   화면을 옮기지 않고 바로 보는 편이 낫다는 판단이다.
  //   ⭐ 환생을 네비에 올린 이유는 화면이 **설계 요구**이기 때문이다 — HUNT_R1.md §4-2-0 이
  //     「먼 목표를 화면에서 보여 줘야 한다」고 못박았다. 안 보이면 첫 환생을 손해로 판단한다.
  //   ⚠ 이 결정은 GAME_DIRECTION.md §5-A(환생 유보)를 뒤집는다 — 그 문서도 함께 고쳤다.
  //   ⭐ 하위 둘 — **정보**(지금 환생하면 어떻게 되나)와 **성장 트리**(레벨 포인트로 산다).
  //     ⚠ 둘 다 하단 네비가 **보인 채로** 열린다(사용자 확정 2026-08-31). 그래서 두 화면의
  //       CSS 가 `bottom:var(--navH)` 로 네비 자리를 비운다 — z-index 를 낮추지 않는다
  //       (낮추면 키 아트가 딸려 내려가고 시트류와 층이 꼬인다).
  //     ⚠ 서로를 닫아 준다 — 둘 다 `.on` 이면 트리가 환생 화면을 덮어 어느 탭인지 모른다.
  //   🗺 **셋째 칸 = 유즈맵 강화**(2026-09-10 사용자 확정). 2차 환생이 주는 포인트를 쓰는 곳이라
  //     「버는 곳 옆에서 쓴다」가 맞다 — ⛔ 유즈맵 구역으로 되돌리지 말 것.
  { k:'reb', label:'환생', ico:'upg', go:()=>campRebEnter('info'),
    cur:()=>((typeof mapUpgIsOn==='function' && mapUpgIsOn()) ? 'umap'
             : (campTreeIsOn() ? 'tree' : (campRebIsOn() ? 'info' : null))),
    reset:()=>campRebEnter('info'), subs:[
      { k:'info', label:'환생',      ico:'upg',  act:()=>campRebEnter('info') },
      { k:'tree', label:'성장 트리', ico:'flag', act:()=>campRebEnter('tree') },   // 📈 레벨 포인트로 산다(2026-09-11)
      { k:'umap', label:'유즈맵 강화', ico:'map', act:()=>campRebEnter('umap') } ] },
  // 💠 룬 — 환생과 유즈맵 사이(2026-09-02 사용자 확정: 연구·환생·**룬**·유즈맵·상점).
  //   ⭐ 자리가 여기인 이유: 왼쪽 셋이 「내가 세지는 곳」이고 오른쪽 둘이 「밖으로 나가는 곳」이다.
  //   하위 둘 — **장착**(칸에 끼우기)과 **룬 상점**(젬으로 사기).
  //   ⚠ 상점 구역(#shopScreen)에 넣지 않았다 — 칸과 후보를 **한 화면에서** 봐야 바꿔 끼우는
  //     판단이 되기 때문이다. 젬 상점은 재화만 판다.
  { k:'rune', label:'룬', ico:'boost', go:()=>campRuneEnter('slot'),
    cur:()=>(campRuneIsOn() ? _runeSec : null),
    reset:()=>campRuneEnter('slot'), subs:[
      { k:'slot', label:'장착',    ico:'upg',  act:()=>campRuneEnter('slot') },
      { k:'shop', label:'룬 상점', ico:'gift', act:()=>campRuneEnter('shop') } ] },
  // 유즈맵: 정렬(인기·신규·추천·즐겨찾기)은 화면 위 띠로 되돌렸고, 하단은 소셜이 맡는다.
  //   ⛔ 소셜 UI 를 새로 만들지 않는다 — 이미 있는 #twChat 시트(.msSocial 채팅·파티·친구)를 연다.
  // ⛔ 여기에 「강화」를 되돌리지 말 것 — 유즈맵 강화는 **환생 구역의 셋째 칸**이다(2026-09-10).
  //   포인트를 주는 쪽이 2차 환생이라 「버는 곳 옆에서 쓴다」가 맞다.
  { k:'map',  label:'유즈맵', ico:'map', go:()=>twGoMap(), cur:()=>_mapSocial,
    reset:()=>mapOpenSocial('chat'), subs:[
      { k:'chat',   label:'채팅', ico:'chat',   act:()=>mapOpenSocial('chat') },
      { k:'friend', label:'친구', ico:'friend', act:()=>mapOpenSocial('friend') },
      { k:'party',  label:'파티', ico:'party',  act:()=>mapOpenSocial('party') } ] },
  // 🏕 캠프 상점 = **두 칸**(2026-08-31 재편). 앞의 다섯 칸은 옛 사냥터 기준이라
  //   파는 것이 캠프에 하나도 안 닿았다 — 자세한 것은 08-ui-parts.js 「캠프 상점」 절.
  //   ⛔ 옛 구역(한정구매·뽑기·재화·패키지)의 코드는 남아 있다. 길만 닫았다.
  { k:'shop', label:'상점', ico:'gift', go:()=>openShop(), cur:()=>_shopSec, reset:()=>setShopSec('reco'), subs:[
      { k:'reco', label:'추천',    ico:'flag',  act:()=>setShopSec('reco') },
      { k:'gem',  label:'젬 상점', ico:'boost', act:()=>setShopSec('gem') } ] },
];
// 🔬📋 두 칸을 여는 함수 — 옛 openUpgScreen()/openGear() 와 **같은 순서**를 따른다
//   (메타 다시 읽기 → 마을 루프 정리 → 화면 켜기 → 네비 표시 → 아이콘 칠하기).
//   ⚠ 지금은 본문이 '준비 중'이라 render* 호출이 없다. 내용이 생기면 여기서 부른다.
function _navOpenShell(id, key){
  if(typeof loadMeta==='function') loadMeta();
  if(typeof twLeave==='function') twLeave();          // 마을·캠프에서 들어왔으면 루프·팝업 정리
  showAppScreen(id); navShow(key);
  if(typeof paintIcons==='function') paintIcons(document.getElementById(id)); }
// 🔬 연구는 **전용 화면이 없다** — 캠프 하단 시트를 쓴다(js/20-camp-research.js).
//   ⚠ 다른 구역(유즈맵·상점)에서 눌러도 되게, 캠프에 먼저 들어간 뒤 내려간다(토벌 입구와 같은 규칙).
//   ⛔ #researchScreen 은 지우지 않았다 — 되살릴 길을 막지 않는다(유보 규칙).
// 🔬 연구는 **전용 화면이 없다** — 캠프 하단 시트를 쓴다(js/20-camp-research.js).
//   ⭐ 캠프에 있으면 **화면을 갈아치우지 않는다.** showAppScreen 을 부르면 캠프가 통째로 닫혔다
//     다시 열려 화면이 한 번 튕긴다(2026-08-27 사용자 지적) — 바뀌어야 하는 것은 하단뿐이다.
//   ⚠ 다른 구역(유즈맵·상점)에서 눌렀을 때만 캠프로 데려간다(토벌 입구와 같은 규칙).
//   ⛔ #researchScreen 은 지우지 않았다 — 되살릴 길을 막지 않는다(유보 규칙).
function openResearch(){
  if(typeof campResEnter!=='function'){ _navOpenShell('researchScreen','research'); return; }
  const on=(typeof campIsOn==='function') && campIsOn();
  if(!on && typeof openHome==='function') openHome();   // 캠프 밖에서 눌렀다 — 먼저 데려간다
  navShow('research');
  campResEnter('res'); }
const navSec=(k)=>NAV_TREE.find(x=>x.k===k)||null;
let _navSec='', _navDrill='';   // 지금 구역 / 내려가 있는 구역('' = 최상위)
// attr = 'nav'(구역) / 'sub'(구역 안 항목). 같은 키가 두 층에 있을 수 있어(정비 구역 = 장비 하위 = gear) 나눈다.
function _navCell(attr,k,label,ico,cls,fn){
  return '<button class="navIt'+(cls?' '+cls:'')+'" data-'+attr+'="'+k+'" onclick="'+fn+'">'
    +'<span data-ico="'+ico+'"></span>'+label+'</button>'; }
function navPaint(){ const b=document.getElementById('navBar'); if(!b) return;
  const sec=navSec(_navSec);
  let h='';
  if(_navDrill && sec){
    h+=_navCell('nav','back','뒤로','back','navBk','navBack()');   // 구역 이름 칸은 두지 않는다 — 하위에 자리를 준다
    const cur=sec.cur?sec.cur():null;
    for(const t of sec.subs) h+=_navCell('sub', t.k, t.label, t.ico, (cur===t.k?'cur':''), "navSub('"+t.k+"')");
  } else {
    for(const x of NAV_TREE){ if(x.noCell) continue;   // 사냥터는 칸이 없다 — 거기 있을 땐 아무 칸도 켜지지 않는다
      h+=_navCell('nav', x.k, x.label, x.ico, (x.k===_navSec?'on':''), "navGo('"+x.k+"')"); }
  }
  b.innerHTML=h;
  b.classList.toggle('drill', !!_navDrill);
  if(typeof paintIcons==='function') paintIcons(b); }
// 화면 전환이 부르는 쪽 — 구역이 바뀌면 최상위로 올라온다(같은 구역이면 내려간 상태를 지킨다)
function navShow(tab){ const b=document.getElementById('navBar'); if(!b) return;
  b.classList.toggle('hide', !tab);
  // ⚠ null 은 '숨김'일 뿐 '구역을 떠남'이 아니다 — 여기서 상태를 지우면
  //   showAppScreen 이 항상 navShow(null) 을 먼저 부르므로 내려간 상태가 매번 풀린다(마을 진입에서 밟았다).
  if(!tab) return;
  // 🔁 **환생 구역을 떠나면 그 화면을 닫는다** (2026-08-31 사용자 확정).
  //   ⭐ 환생 화면의 ✕ 를 없앴으므로 **나가는 길은 하단 네비 하나**다 — 다른 구역으로 가거나
  //     「뒤로」를 누르면 여기서 닫힌다(navBack 도 결국 navShow 를 거친다).
  //   ⛔ tab 이 null 일 때는 닫지 않는다 — 그건 「숨김」이지 「구역을 떠남」이 아니다
  //     (showAppScreen 이 매번 navShow(null) 을 부른다 · 위 주석과 같은 이유).
  if(tab!=='reb'){
    if(typeof campRebClose==='function') campRebClose();
    if(typeof campTreeClose==='function') campTreeClose(); }
  // 💠 룬 구역도 같은 규칙 — 나가는 길이 하단 네비뿐이라 여기서 닫는다(2026-09-02).
  if(tab!=='rune'){ if(typeof campRuneClose==='function') campRuneClose(); }
  // 📐 **구역 상단 띠**는 환생·룬·유즈맵·상점의 것이다 — 캠프로 돌아오면 끈다(2026-09-05).
  //   ⛔ 캠프에 걸지 말 것: 거기 좌상단은 던전 칩이고 배경이 밝은 돌이라 규칙이 다르다.
  if(tab==='camp' && typeof curSplitSync==='function') curSplitSync(false);
  if(_navSec!==tab){ _navSec=tab; _navDrill=''; }   // 다른 구역으로 갔다 = 최상위로
  navPaint(); }
// 최상위 칸 — 화면으로 이동하고, 하위가 있으면 그 구역 네비로 내려간다
function navGo(tab){ if(typeof playSfx==='function') playSfx('ui_tab');
  if(tab==='town'){ openHome(); return navShow('home'); }   // 마을 폐지 — 옛 진입점은 HOME으로
  const sec=navSec(tab); if(!sec) return;
  const was=_navDrill;
  sec.go();                                   // 화면 이동(안에서 navShow 를 부르며 _navDrill 을 비운다)
  if(!sec.subs.length) return;
  // 구역에 '밖에서 들어올 때'는 늘 첫 하위로 되돌린다 — 유즈맵 하단 탭바(gtabDrill)와 같은 규칙.
  // 안 그러면 정비의 '펫'을 보다 나갔다 다시 들어와도 펫이 열려 있어 구역 이름과 내용이 어긋난다.
  // ⚠ sec.go() 가 이미 그 구역 내용을 그렸으므로 reset 은 반드시 그 뒤에(렌더까지 하는 setter 로) 부른다.
  if(was!==tab && sec.reset) sec.reset();
  _navDrill=tab; navPaint(); }
// 구역 전용 칸
function navSub(k){ const sec=navSec(_navDrill); if(!sec) return;
  const t=sec.subs.find(x=>x.k===k); if(!t) return;
  if(typeof playSfx==='function') playSfx('ui_tab');
  t.act(); navPaint(); }
// 유즈맵 소셜 — 화면 하단 상주 구역(#msSocialDock). 시트를 열지 않는다.
//   ⛔ 소셜 DOM(.msSocial)은 하나뿐: 유즈맵에 들어올 때 도크로 옮겨 쓰고(mapDockSocial),
//     마을 채팅 시트(twOpenChat)가 열릴 때 제자리(#twChat)로 돌려놓는다. id 기반 함수들이 그대로 동작한다.
let _mapSocial='chat';   // 기본 = 채팅
function mapDockSocial(){ const dock=document.getElementById('msSocialDock'), so=document.querySelector('.msSocial');
  if(!dock||!so) return;
  if(so.parentNode!==dock) dock.appendChild(so);
  if(!_mapSocial) _mapSocial='chat';
  // ⚠ 판을 **먼저** 그리고 나서 접기를 적용한다 — 접힌 줄이 그 판의 머리줄을 읽어 가기 때문이다
  if(typeof setBottomTab==='function') setBottomTab(_mapSocial);
  mapDockApply(); }
function mapOpenSocial(bt){ _mapSocial=bt;
  mapDockSet(true);   // 네비에서 채팅·친구·파티를 고른 것 = 펴 달라는 뜻
  if(typeof setBottomTab==='function') setBottomTab(bt);
  navPaint(); }
// ── 소셜 도크 접기/펴기 ──────────────────────────────────────────────
//  유즈맵 선택은 「고르는 화면」이라 기본은 접힘이다 — 목록이 화면을 거의 다 쓴다.
//  ⚠ 접힌 줄의 내용은 #msChat 의 마지막 줄을 **복제**한다. 채팅을 두 번 그리지 않는다.
const MAPDOCK_KEY='nm_mapdock';
let _mapDockOpen=(typeof _lsGet==='function') ? !!_lsGet(MAPDOCK_KEY,false) : false;
function mapDockApply(){ const dock=document.getElementById('msSocialDock'); if(!dock) return;
  dock.classList.toggle('collapsed', !_mapDockOpen);
  if(!_mapDockOpen) mapDockPeek(); }
function mapDockSet(open){ if(_mapDockOpen===!!open){ mapDockApply(); return; }
  _mapDockOpen=!!open; if(typeof _lsSet==='function') _lsSet(MAPDOCK_KEY,_mapDockOpen); mapDockApply(); }
function mapDockToggle(){ mapDockSet(!_mapDockOpen);
  if(typeof playSfx==='function') playSfx(_mapDockOpen?'ui_open':'ui_close');
  if(_mapDockOpen){ const c=document.getElementById('msChat'); if(c) c.scrollTop=c.scrollHeight; } }
// 접힌 줄 갱신 — 채팅이 한 줄 늘 때마다 addGlobalMsg/addWhisperMsg 가 불러 준다.
function mapDockPeek(){ const peek=document.getElementById('msDockPeek'); if(!peek) return;
  // 친구·파티 = 그 판의 **머리줄을 그대로** 읽는다(요약 문구를 새로 쓰지 않는다 — 수가 어긋날 자리가 없다).
  // ⚠ innerHTML 로 베끼지 말 것 — 머리줄 안에 id(#foCount)가 있어 같은 id 가 둘이 된다.
  if(_mapSocial && _mapSocial!=='chat'){
    const t=document.querySelector('#msPanelBody .ptTitle');
    peek.textContent = t ? t.textContent.replace(/\s+/g,' ').trim() : (_mapSocial==='party'?'파티':'친구');
    peek.classList.add('sum'); return; }
  peek.classList.remove('sum');
  const box=document.getElementById('msChat');
  // ⚠ 지금 범위(전체/파티/친구)에서 **실제로 보이는** 줄만 센다 — .msChat 의 표시 필터와 같은 규칙이다.
  //   전부 세면 파티 범위인데 전체 채팅 마지막 줄이 접힌 줄에 뜬다.
  const sc=(box&&box.dataset.scope)||'all';
  const lines=box? box.querySelectorAll('.mcLine.sc-'+sc+', .mcLine.whisper') : null;
  const last=(lines&&lines.length)? lines[lines.length-1] : null;
  if(!last){ peek.textContent='채팅'; return; }
  peek.innerHTML=last.innerHTML; }   // 복제 — 이름·구분자·본문 서식이 채팅과 그대로 같다
// ‹ 돌아가기 = 사냥터 화면 + 최상위 네비
function navBack(){ if(typeof playSfx==='function') playSfx('ui_back');
  // 🔬 연구에서 나가면 하단은 **캠프 기본 요약**으로 돌아간다(renderCampIdleSheet).
  //   ⛔ 이걸 안 하면 연구 그리드가 시트를 계속 쥐고 있어, 최상위로 올라와도 하단이 안 바뀐다.
  if(typeof campResExit==='function') campResExit();
  // ⛔ **이미 캠프에 있으면 openHome() 을 부르지 않는다.** 부르면 캠프가 닫혔다 다시 열려
  //   화면이 한 번 튄다(2026-08-27 사용자 지적 · 들어갈 때와 같은 이유).
  //   ⚠ 다른 구역(유즈맵·상점)에서 올라오는 길은 그대로 openHome() 이 맡는다.
  const _here=(typeof campIsOn==='function') && campIsOn()
    && document.getElementById('homeScreen') && !document.getElementById('homeScreen').classList.contains('hide');
  if(_here){ if(typeof navShow==='function') navShow('home');
    if(typeof renderCampIdleSheet==='function') renderCampIdleSheet(); }   // 하단만 기본 요약으로 되돌린다
  else openHome();
  _navDrill=''; navPaint(); }
