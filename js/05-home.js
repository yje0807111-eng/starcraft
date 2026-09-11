/* ============================================================================
 * 05-home.js — HOME 대시보드 · 던전/라운드 고르기 · 스킬 바
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ── 🏠 HOME 대시보드 ──
// ⚠ 화면은 세 덩어리뿐이다 — ①수입 줄 · ②매치 화면(빈 자리) · ③POWER UPGRADES(스탯 4종).
//    실제 데이터에 붙은 것은 ①과 ③. ②는 시스템이 없어 문구만 있는 빈 판이다.
// POWER UPGRADES = 캐릭터 스탯 4종(실제). 아이콘·표기만 참고 이미지 문법을 따른다.

function openHome(){ loadMeta();
  // 토벌 허브는 '화면'이 아니라 HOME 위에 덮는 팝업(.hbModal)이라 화면 전환으로는 안 닫힌다 —
  // 열어 둔 채 네비 HOME을 누르면 그대로 HOME을 가린다. 여기서 걷어낸다.
  if(typeof closeDungeonHub==='function') closeDungeonHub();
  profEnsureChar();   // 캐릭터가 없으면 조용히 기본 유닛을 지급한다(선택 화면 없음)
  if(typeof bgmStart==='function') bgmStart('lobby');
  showAppScreen('homeScreen'); navShow('home'); renderHome();
  // 🏕 캠프(2026-08-23) — HOME 을 열면 바로 캠프다. 종족을 아직 안 골랐으면 선택 시트가 뜬다.
  // ⛔ 아래 hbStart() 는 **지우지 않았다**. 옛 사냥터(웨이브 방어)를 되살리려면 이 두 줄을 맞바꾼다.
  //    hbStart();   // 배경 전투(웨이브 방어) 시작 — 캠프로 대체됨
  if(typeof campOpen==='function') campOpen();
  if(typeof paintIcons==='function') paintIcons(document.getElementById('homeScreen')); }

// 사냥터 업그레이드 표시 보조물
const HM_ARW='<svg class="hmArw" viewBox="0 0 24 24"><path d="M6 12h11M13 7.5 17.5 12 13 16.5"/></svg>';
// (사냥터 업그레이드 카드의 자물쇠는 2026-08-19 **아예 뺐다** — `해금 필요` 글자와 죽은 색이 이미 잠김을 말한다.
//  자물쇠 그림이 필요한 곳은 칸 하나가 통째로 잠긴 자리(정비 펫·동료 칸)뿐이고, 거기서는 `stIco('lock','🔒')` 를 쓴다.)
// 아이콘은 전부 기존 에셋 재사용 — 'upgrades/up_x' 처럼 폴더까지 담겨 있다
// 경로형 아이콘 — 키에 하위폴더까지 들어 있는 표기('upgrades/up_range'). HB_UPG.ico 와 LP_STATS.ico 가 같이 쓴다.
function _icoPathImg(path, fb){ return '<img class="icoImg" src="'+ICO_DIR+path+'.webp" alt="" draggable="false" data-fb="'+(fb||'⚙')+'" data-fbcls="" onerror="_icoFail(this)">'; }
// 이름을 [본체 + 작은 보조어]로 쪼개다 — 폭도 벌고 훑어보기도 쉽다
const HM_SUF=['확률','배수','계수','재생','표적','수','흡수'];
// 🏠 HOME(=캠프) 화면을 다시 그린다.
// 🗄 **사냥터 업그레이드 카드는 없앴다**(2026-09-10 · 마을을 접으며). 내용이 전부 캐릭터 하나가
//   싸우던 수치(데미지·치명타·멀티샷 …)라 캠프에는 쓸 곳이 없다 — 마크업·CSS·그리는 코드 전부 걷었다.
//   ⚠ 그 전에도 `#phone.campMode #hmScroll{display:none}` 이라 **화면엔 안 보이면서 그리기만** 돌았다.
//   ⛔ 되살리지 말 것(GAME_DIRECTION §0-A). 껍데기가 필요하면 연구 구역이 같은 부품을 쓴다.
//   ⭐ 남은 일은 둘뿐이다 — 재화 바 갱신과 ☰ 의 ! 배지.
function renderHome(){ try{
  if(typeof updateCurBar==='function') updateCurBar();   // 💠 재화는 공용 재화 바(#curBar)가 갖는다
  renderHomeStats();
}catch(e){} }
// 레벨업으로 받은 스탯 포인트 — 남았을 때만 줄이 뜬다. 배분은 공용 profAllocStat()(마을 광장과 같은 함수).
// 진화·환생 신호 — 하단 패널의 줄이 아니라 상단 성장 버튼의 ! 배지.
//   (줄로 두면 조건이 찰 때마다 패널 높이가 흔들렸다 — 2026-08-14 이동)
function renderHomeStats(){ const dot=document.getElementById('hbGrowDot'); if(!dot) return;
  // ☰ 의 ! = 더보기 안에 '지금 할 수 있는 것'이 있다는 신호. 안을 열면 어느 칸인지 각자의 점이 알려 준다.
  const has=((typeof hbGrowHas==='function') && hbGrowHas()) || ((typeof dqHas==='function') && dqHas());
  dot.classList.toggle('show', !!has); }
// ── 던전·라운드 고르기 ────────────────────────────────────────────────────
// ⚠ 고르는 즉시 이동하지 않는다 — _hbPick 에 '초안'을 담고 [이동]을 눌러야 적용된다.
//   던전은 ◀▶ 로 한 장씩, 라운드는 세로 피커(아래가 1라운드)에서 가운데 띠에 멈춘 것이 선택된다.
let _hbPick=null, _hbRdT=null;
const HB_RD_H=40, HB_RD_GAP=6;                       // 피커 한 칸 높이 · 간격 → 이동 간격은 둘의 합
// ☰ 더보기 — 사냥터에서만. 다른 화면에서는 같은 버튼이 그대로 설정을 연다.
// ⚠ ☰ 는 두 개가 겹쳐 있다 — 게임 HUD의 #settingsBtn(hudTopRow)과 재화 바의 #curSettingsBtn.
//    사냥터에서는 재화 바 쪽이 위에 있어 그쪽이 눌린다. 그래서 둘 다 이 함수를 거치게 한다.
//    (한쪽만 고치면 "눌러도 설정만 나온다"가 된다 — 실제로 그랬다)
// fb: 사냥터가 아닐 때의 갈 곳 — 'app'이면 앱 화면 설정, 아니면 유즈맵 설정.
// 열려 있으면 같은 자리가 X 다 — 그 X 만이 닫는 유일한 방법이다
// 🎬 「움직임 줄이기」를 켠 기기 — 연출을 건너뛰고 즉시 닫는다(css 도 animation:none 이라
//    animationend 가 아예 안 온다 → 기다리면 판이 남는다).
function _uiReduced(){ try{ return !!(window.matchMedia
  && window.matchMedia('(prefers-reduced-motion:reduce)').matches); }catch(e){ return false; } }
// ⚠ **닫히는 중(.closing)도 「닫혔다」로 센다.** 셔터가 끝나야 .hide 가 붙으므로, 그 사이에
//    ☰ 를 다시 누르면 '열려 있다'로 읽혀 또 닫기가 돌고 **영영 안 열린다**(실제로 그랬다).
function hbMoreOn(){ const el=document.getElementById('hbMoreSheet');
  return !!(el && !el.classList.contains('hide') && !el.classList.contains('closing')); }
function hbMoreBtns(){ return ['curSettingsBtn','settingsBtn']
  .map(function(id){ return document.getElementById(id); }).filter(Boolean); }
function hudTopMenu(fb){ const hs=document.getElementById('homeScreen');
  if(hbMoreOn()) return hbCloseMore();
  // 🏕 캠프 **구역**(환생·트리·룬)이 열려 있으면 오른쪽 위는 **톱니(설정)** 다 — 더보기가 아니다.
  //   ⚠ 구역은 HOME 위에 덮는 판이라 homeScreen 이 그대로 '보이는' 상태다. 그래서 아래 줄이
  //     먼저 걸려 **더보기가 구역 뒤에서 열리고 있었다**(눌러도 아무 일도 안 나는 것처럼 보였다).
  { const ph=document.getElementById('phone');
    if(ph && ph.classList.contains('artLift') && typeof openAppSettings==='function') return openAppSettings(); }
  if(hs && !hs.classList.contains('hide') && typeof hbOpenMore==='function') return hbOpenMore();
  if(fb==='app' && typeof openAppSettings==='function') return openAppSettings();
  openSettings(); }
// 🎬 여닫은 **횟수**. 닫기의 뒷정리(animationend·보험 타이머)가 자기 차례인지 이걸로 가린다.
// ⛔ 없으면 이렇게 된다: 닫는 중에 ☰ 를 다시 눌러 열었는데, **앞선 닫기의 뒷정리가 뒤늦게 와서
//    방금 연 판에 .hide 를 붙인다** → 눌러도 안 열린다(실제로 그랬다).
let _hbMoreGen = 0;
function hbOpenMore(){ const el=document.getElementById('hbMoreSheet'); if(!el) return;
  _hbMoreGen++;                                   // 지난 닫기의 뒷정리를 무효로 만든다
  // 닫히는 중이었으면 그 상태를 걷고 새로 연다(셔터가 되감기다 말고 다시 내려온다)
  el.classList.remove('closing');
  { const b=document.getElementById('hbMoreBox'); if(b) b.classList.remove('hbmOut'); }
  renderHbMore(); el.classList.remove('hide');
  { const box=document.getElementById('hbMoreBox'), ph=document.getElementById('phone');
    // 실제로 눌린 ☰ 아래에 붙인다 — 두 개가 겹쳐 있으므로 보이는 쪽을 고른다
    const btns=['curSettingsBtn','settingsBtn'].map(function(id){ return document.getElementById(id); })
      .filter(function(b){ return b && b.getClientRects().length; });
    if(box && ph && btns.length){ const r=btns[0].getBoundingClientRect(), p=ph.getBoundingClientRect();
      // 테두리 1px 만큼 끌어올려 두 선을 정확히 포갠다 — 그냥 붙이면 1px+1px 이 2줄로 보인다
      box.style.top=(Math.round(r.bottom-p.top)-1)+'px';
      box.style.right=Math.round(p.right-r.right)+'px'; } }
  hbMoreBtns().forEach(function(b){ b.classList.add('on'); b.title='닫기'; });
  if(typeof playSfx==='function') playSfx('ui_open'); }
// now=true → 연출 없이 즉시 닫는다(다른 화면으로 넘어가는 길에는 사라지는 연출이 방해만 된다)
function hbCloseMore(now){ const el=document.getElementById('hbMoreSheet');
  if(el){ const box=document.getElementById('hbMoreBox');
    if(box && !now && !_uiReduced()){
      const gen = ++_hbMoreGen;
      el.classList.add('closing'); box.classList.add('hbmOut');
      const done=function(){
        if(gen !== _hbMoreGen) return;            // 그 사이 다시 열렸다 — 내 뒷정리가 아니다
        el.classList.add('hide'); el.classList.remove('closing');
        box.classList.remove('hbmOut'); };
      box.addEventListener('animationend', done, { once:true });
      setTimeout(done, 400);   // 애니가 안 돌았을 때의 보험 — 판이 남는 것보다 낫다
    } else { _hbMoreGen++; el.classList.remove('closing'); el.classList.add('hide');
             if(box) box.classList.remove('hbmOut'); } }
  hbMoreBtns().forEach(function(b){ b.classList.remove('on'); b.title='더보기'; });
  if(typeof playSfx==='function') playSfx('ui_close'); }
// 시트를 닫고 나서 연다 — 배치(건설)처럼 필드를 눌러야 하는 것이 시트에 가리면 안 된다
function hbMoreGo(fn){ hbCloseMore(true); setTimeout(function(){ try{ fn(); }catch(e){} }, 60); }
// ☰ 더보기 칸 (2026-08-25 정리) — 캠프에서 **실제로 도는 것**만 남겼다.
// ⛔ 뺀 것의 코드는 지우지 않았다(유보는 삭제가 아니다 · GAME_DIRECTION §5). 길만 닫았다:
//   · 마을(town)   — 5구역 중 상점은 하단 네비와 같은 화면 · 캐릭터/장비는 §5-B 유보 · 관문은 토벌(§5-D)
//   · 성장(grow)   — 환생·진화는 §5-A 유보
//   · 건설(build)  — **이미 죽은 칸이었다**: hbBuildStart() 가 `if(!_hb) return` 이라 캠프에선 아무 일도 안 한다
//   · 토벌(dg)     — §5-D 유보(도달 불가)
//   · 일일 퀘스트  — 14종 중 9종이 옛 사냥터 계측이라 캠프에선 거의 안 찬다 → **가이드**로 바꿨다
// ⚠ 부스트는 남겼지만 **지금 효과가 없다** — 수입·공격 배율이 옛 사냥터 전투에만 걸려 있고
//   캠프 수급(campTapGain/campGatherMul)에는 안 들어간다. 캠프 쪽에서 걸어 줘야 산다.
const HB_MORE=[
  {k:'guide',  ico:'flag',    name:'가이드',      sub:'무엇을 할지 순서대로'},
  {k:'att',    ico:'cal',     name:'출석',        sub:'4주 캘린더'},
  {k:'boost',  ico:'boost',   name:'부스트',      sub:'일시 강화'},
  {k:'set',    ico:'',        name:'설정',        sub:''},
];
function renderHbMore(){ const g=document.getElementById('hbMoreGrid'); if(!g) return;
  g.innerHTML=HB_MORE.map(function(it){
    const off='';
    // 배지(!) — '지금 받을 게 있다'만 알린다. 판정은 각 시스템이 갖고 여기선 묻기만 한다.
    // ⚠ 글자를 넣지 않는다 — 이 격자는 아이콘만(이름은 title/aria-label). 점은 CSS 로만 그린다.
    const dot=((it.k==='guide' && typeof guideOn==='function'  && guideOn())
            || (it.k==='daily' && typeof dqQHas==='function'   && dqQHas())
            || (it.k==='att'   && typeof dqAttHas==='function' && dqAttHas())
            || (it.k==='grow'  && typeof hbGrowHas==='function' && hbGrowHas())) ? '<i class="hbGrowDot show"></i>' : '';
    // 설정은 아이콘 세트에 톱니가 없어 직접 그린다. ☰ 와 같은 그림을 쓰면 '메뉴 안의 메뉴'로 보인다.
    const ico=it.ico ? '<span data-ico="'+it.ico+'"></span>'
      : '<i class="hbMoreSvg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="butt">'
        +'<circle cx="12" cy="12" r="6.1"/>'      // 몸통 링 — 이게 없으면 태양이 된다
        +'<circle cx="12" cy="12" r="2.1"/>'      // 축 구멍
        +'<path d="M12 3.2v2.6M12 18.2v2.6M3.2 12h2.6M18.2 12h2.6'
        +      'M5.9 5.9l1.9 1.9M16.2 16.2l1.9 1.9M18.1 5.9l-1.9 1.9M7.8 16.2l-1.9 1.9"/>'   // 이빨은 링 바깥으로만
        +'</svg></i>';
    const tip=it.name+(it.sub?' — '+it.sub:'');
    return '<button class="hbMoreIt" data-k="'+it.k+'" onclick="hbMoreTap(&#39;'+it.k+'&#39;)"'+off
      +' title="'+tip+'" aria-label="'+tip+'">'+dot+ico+'</button>'; }).join('');
  if(typeof paintIcons==='function') paintIcons(g); }
// ⚠ **분기는 HB_MORE 에 있는 칸만 둔다.** 없는 칸의 분기를 「유보」로 남겨 두면 그것이 옛 마을 코드
//   4천 줄을 통째로 살아 있는 것처럼 붙들어, 죽은 코드 검사가 아무것도 못 잡는다(2026-09-10 실측).
//   ⛔ 마을·성장·건설·토벌 분기를 되살리지 말 것 — 그 화면들은 없어졌다(GAME_DIRECTION §0-A).
//   ⚠ 일일 퀘스트(daily)는 **마을이 아니다** — 칸만 가이드에 내줬을 뿐 캠프의 기능이라 분기를 남긴다.
function hbMoreTap(k){
  if(k==='guide') return hbMoreGo(function(){ if(typeof openGuide==='function') openGuide(); });
  if(k==='daily') return hbMoreGo(function(){ if(typeof openDaily==='function') openDaily(); });   // ⛔ 칸에서만 뺐다 — 일일 퀘스트는 캠프의 것이라 살아 있다
  if(k==='att')   return hbMoreGo(function(){ if(typeof openAtt==='function') openAtt(); });
  if(k==='set')   return hbMoreGo(function(){
    if(typeof openAppSettings==='function') openAppSettings();   // 앱 문맥(.appCtx) — 인게임 설정에는 배속·게임 나가기가 있다
    else openSettings(); });
  if(k==='boost') return hbMoreGo(function(){ if(typeof hbOpenBoost==='function') hbOpenBoost(); }); }
