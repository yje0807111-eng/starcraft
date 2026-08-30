/* ══ 🔬 캠프 연구 구역 (2026-08-27) ═══════════════════════════════════════
 *
 * 하단 네비 「연구」를 누르면 2단 네비로 내려가고, 고른 요소가 **캠프 하단 시트**에 뜬다.
 * 설계는 sc-2 세션에서 사용자와 확정했다 — 요지 셋:
 *   ① 자리는 캠프 하단 시트(#btSheet) 하나. 건물 프로필과 **같은 자리**를 쓴다.
 *   ② 하위 칸 셋 — 자원(미네랄) · 무장(가스) · 기술(가스).
 *   ③ 그리는 것은 **renderCmdGrid 하나**다. 건물 프로필과 같은 함수라 생김새가 저절로 같고,
 *      5칸을 넘으면 페이지네이션도 알아서 붙는다.
 *
 * ⭐ **왜 새 파일인가** — js/19-camp.js 는 이미 2,700줄이 넘고 다른 세션이 전투를 만지고 있다.
 *    연구는 거기에 기대기만 할 뿐(값·상태를 읽는다) 캠프 내부를 고치지 않으므로 갈라 둔다.
 *    ⚠ 로드 순서상 **19 뒤**여야 한다(campUpgCost 같은 것을 쓴다). 태그를 옮기지 말 것.
 *
 * ⛔ 값을 여기서 새로 계산하지 않는다 — 전부 캠프의 기존 함수에서 꺼낸다.
 *    두 벌이 되는 순간 화면과 실제가 어긋난다(이 저장소에서 여러 번 겪었다).
 */

// ── 상태 ────────────────────────────────────────────────────────────────
// _resSec = 지금 열린 연구 칸. null 이면 연구 모드가 아니다(시트는 건물 프로필이 쓴다).
let _resSec = null;
// 자원 칸에서 지금 고른 항목(정보판에 「얼마나 오르는지」를 띄우는 대상)
let _resPick = 'tap';

const CAMP_RES_SECS = ['res', 'arm', 'tech'];

// ── 🧮 「다음 레벨 값」 — 레벨을 잠깐 올려 두고 **같은 함수**로 잰다 ────────
// ⛔ 다음 값을 위한 수식을 따로 쓰지 말 것. 캠프의 성장 곡선은 마일스톤·환생·던전 배수가
//   겹겹이 걸려 있어(campMileMul · campRebMul · campRtMul · campMineMul) 손으로 옮기면 반드시 틀린다.
//   ⚠ 동기 코드 안에서만 올렸다 되돌린다 — 그 사이 다른 코드가 끼어들 틈이 없다.
function _campPeekNext(k, fn) {
  const C = (typeof campState === 'function') ? campState() : null;
  if (!C) return null;
  C.upg = C.upg || {};
  const had = C.upg[k] | 0;
  C.upg[k] = had + 1;
  let v = null;
  try { v = fn(); } catch (e) { v = null; }
  C.upg[k] = had;
  return v;
}

// ── 📋 자원 칸 항목 표 ───────────────────────────────────────────────────
// ⭐ **한 줄이 곧 슬롯 하나**다. 값·다음값·설명을 전부 여기서 정하고, 그리는 쪽은 이 표만 읽는다.
//   ⚠ 정제소가 여기 있는 것이 이번 이동의 핵심이다 — 예전엔 정제소 **건물**의 연구 카드였다.
//     건물을 고르지 않으면 올릴 수 없어서, 자원 성장 셋 중 하나만 자리가 달랐다.
const CAMP_RES_ITEMS = [
  { k: 'tap', nm: '터치 강화', ico: 'upgrades/up_mineral_up',
    why: '한 번 누를 때 캐는 양',
    now: () => (typeof campTapGain === 'function') ? campTapGain() : 0,
    next: () => _campPeekNext('tap', () => campTapGain()),
    unit: '/탭' },
  { k: 'gather', nm: '채취 강화', ico: 'upgrades/up_speed',
    why: '일꾼이 한 번 다녀올 때 캐는 양',
    now: () => (typeof campGatherMul === 'function') ? campGatherMul() : 1,
    next: () => _campPeekNext('gather', () => campGatherMul()),
    unit: '배', dec: 2 },
  // ⛏ 채굴 속도 — 누르고 있을 때의 간격을 줄인다(js/19-camp.js campHoldMs).
  //   ⚠ **끝이 있는 축**이다: 하한 300ms 에 닿으면 「최대」로 잠긴다(연타보다 빨라지면 안 된다).
  { k: 'hold', nm: '채굴 속도', ico: 'upgrades/up_mine',
    why: '누르고 있을 때 캐는 간격',
    now: () => (typeof campHoldMs === 'function') ? campHoldMs() / 1000 : 0.8,
    next: () => { if(typeof campHoldMs !== 'function') return null;
      if(campUpgLv('hold') >= campHoldLvMax()) return null;
      return _campPeekNext('hold', () => campHoldMs()) / 1000; },
    unit: '초', dec: 2,
    lock: () => (typeof campHoldLvMax === 'function') && campUpgLv('hold') >= campHoldLvMax(),
    lockWhy: '최대 — 더 줄이면 연타보다 빨라집니다' },
  { k: 'refinery', nm: '정제소', ico: 'buildings/bld_refinery',
    why: '정제소가 스스로 캐는 가스',
    now: () => (typeof campGasPerMin === 'function') ? campGasPerMin() : 0,
    // ⚠ 정제소 레벨은 C.upg 와 연구 칸(G.tech.research) 중 **큰 쪽**이다(campRefLv).
    //   그래서 C.upg 만 올려 보는 _campPeekNext 로는 안 움직일 수 있다 — 값에서 직접 한 칸 올린다.
    next: () => {
      if (typeof campGasPerMin !== 'function' || typeof campRefLv !== 'function') return null;
      const cur = campGasPerMin();
      if (!(typeof campHasRefinery === 'function' && campHasRefinery())) return null;   // 안 지었으면 다음 값도 0
      const lv = campRefLv();
      const base = CAMP_REF_BASE + CAMP_REF_STEP * lv;
      if (base <= 0) return null;
      return cur * ((CAMP_REF_BASE + CAMP_REF_STEP * (lv + 1)) / base);
    },
    unit: '/분', dec: 1,
    lv: () => (typeof campRefLv === 'function') ? campRefLv() : 0,
    // ⛽ 정제소를 아직 안 지었으면 올려도 나오는 것이 없다 — 그 사실을 슬롯에 적는다.
    lock: () => !(typeof campHasRefinery === 'function' && campHasRefinery()),
    lockWhy: '정제소를 먼저 지으세요' }
];

function campResItem(k) { return CAMP_RES_ITEMS.find(x => x.k === k) || null; }
function campResItemLv(it) { return it.lv ? it.lv() : ((typeof campUpgLv === 'function') ? campUpgLv(it.k) : 0); }

// 숫자 표기 — 큰 수는 캠프·HUD 와 같은 축약기(fmtCur)를 쓴다. ⛔ 새 표기기를 만들지 말 것.
function _campResNum(v, dec) {
  if (v == null || !isFinite(v)) return '—';
  if (dec) return (+v).toFixed(dec);
  return (typeof fmtCur === 'function') ? fmtCur(v) : String(Math.round(v));
}

// ── 🎛 자원 칸 모델 → renderCmdGrid ──────────────────────────────────────
function campResModelRes() {
  const have = (typeof G !== 'undefined' && G.tech) ? (G.tech.credit || 0) : 0;   // ⛔ | 0 금지 — 21억을 넘으면 음수가 된다
  const items = CAMP_RES_ITEMS.map(it => {
    const lv = campResItemLv(it);
    const cost = (typeof campUpgCost === 'function') ? campUpgCost(it.k) : 0;
    const locked = it.lock ? it.lock() : false;
    const poor = have < cost;
    return {
      k: it.k,
      pro: (typeof _icoPathImg === 'function') ? _icoPathImg(it.ico, '🔧') : '',
      sn: it.nm,
      // ⭐ 누르기 **전에** 얼마나 오르는지 슬롯에서 바로 보인다(정보판은 고른 것만 보여 준다)
      sub: (function(){ const c = it.now(), x = it.next();
        return (x != null && !locked) ? (_campResNum(c, it.dec) + ' ▸ ' + _campResNum(x, it.dec)) : ''; })(),
      tr: 'Lv.' + lv,
      cr: cost,
      state: (locked || poor) ? 'dim' : '',
      sel: (_resPick === it.k),
      act: 'data-res="' + it.k + '"'
    };
  });
  const it = campResItem(_resPick) || CAMP_RES_ITEMS[0];
  const lv = campResItemLv(it);
  const cost = (typeof campUpgCost === 'function') ? campUpgCost(it.k) : 0;
  const locked = it.lock ? it.lock() : false;
  const cur = it.now(), nxt = it.next();
  return {
    mode: 'upg', compact: true, title: '자원',
    kicker: true,
    info: {
      eb: 'Lv.' + lv,
      name: it.nm,
      // ⛔ **toast 에 기대지 말 것** — toast() 는 채팅으로 간다(addChat). 캠프에는 채팅바가 없어서
      //   (CLAUDE.md: 「유즈맵 안 전 구역 · 캠프만 제외」) 그 알림은 **아무 데도 안 보인다**.
      //   그래서 못 사는 이유를 **정보판이 직접** 말한다 — 늘 화면에 있는 자리다.
      desc: locked ? (it.lockWhy || '아직 올릴 수 없습니다')
          : (have < cost)
            ? ('미네랄 ' + ((typeof fmtCur === 'function') ? fmtCur(cost - have) : (cost - have)) + ' 더 필요합니다')
            : it.why,
      // ⭐ 이 화면의 핵심 — **사기 전에 얼마나 오르는지** 보여 준다.
      //   (옛 채굴 팝업은 비용만 보여 줘서, 살지 말지를 값이 아니라 감으로 골라야 했다.)
      val: (nxt != null && !locked)
        ? { cur: _campResNum(cur, it.dec), nxt: _campResNum(nxt, it.dec), unit: it.unit || '' }
        : null,
      cr: cost
    },
    items: items
  };
}

// 슬롯 탭 = 고르기 + **한 번 더 누르면 산다**(건물 프로필의 생산 카드와 같은 어법)
// 슬롯 탭 = **두 번 눌러 산다**(2026-08-27 사용자 확정).
//   ① 처음 누르면 **왼쪽 판에 설명과 오를 값**이 뜬다 — 무엇을 사는지 먼저 본다.
//   ② 그 상태에서 한 번 더 누르면 산다.
//   ⚠ 예전에 「한 번에 산다」로 둔 적이 있는데, 그때는 **클릭 자체가 안 들어오는 버그**가 있어
//     첫 탭이 먹히지 않는 것처럼 보였다(시트가 매 프레임 갈려 click 이 안 생겼다 · 지금은 고쳤다).
//   ⭐ 못 사는 것이면 첫 탭에서 **이유가 정보판에 뜬다**(미네랄 부족·잠김) — 두 번째 탭은 조용히 넘어간다.
function campResTap(k) {
  const it = campResItem(k); if (!it) return;
  if (_resPick !== k) {                       // ① 처음 누름 = 설명 보기
    _resPick = k;
    if (typeof playSfx === 'function') playSfx('ui_tab');
    campResSheet(); return;
  }
  if (it.lock && it.lock()) {
    if (typeof toast === 'function') toast(it.lockWhy || '아직 올릴 수 없습니다');
    if (typeof playSfx === 'function') playSfx('ui_tab');
    campResSheet(); return;
  }
  const have = (typeof G !== 'undefined' && G.tech) ? (G.tech.credit || 0) : 0;   // ⛔ | 0 금지 — 21억을 넘으면 음수가 된다
  const cost = (typeof campUpgCost === 'function') ? campUpgCost(k) : 0;
  if (have < cost) {
    // 얼마가 모자란지까지 말한다 — 「안 된다」가 아니라 「얼마가 더 필요하다」로 읽히게
    if (typeof toast === 'function')
      toast('미네랄 ' + ((typeof fmtCur === 'function') ? fmtCur(cost - have) : (cost - have)) + ' 더 필요합니다');
    if (typeof playSfx === 'function') playSfx('ui_tab');
    campResSheet(); return;
  }
  if (typeof campUpgBuy === 'function') campUpgBuy(k);
  campResSheet();
}

// ── 🗂 시트에 그린다 ─────────────────────────────────────────────────────
// ⛔ 여기서 시트 마크업을 만들지 않는다 — 건물 프로필과 **같은 호스트·같은 렌더러**를 쓴다.
//   그래야 카드 높이·페이지네이션·비용 표기가 저절로 같아진다.
// ⛔ **손가락이 닿아 있는 동안은 다시 그리지 않는다.**
//   캠프는 매 프레임 시트를 갱신하는데(초당 30회), 누르고 있는 사이 innerHTML 이 갈리면
//   **처음 누른 요소가 DOM 에서 사라져 브라우저가 click 을 만들지 않는다** — 손으로는 영영 안 눌린다
//   (2026-08-27 실측: pointerdown·mousedown·pointerup·mouseup 은 다 오는데 click 만 없었다).
//   ⚠ 도구로 누르면 down/up 이 같은 프레임이라 통과한다 — 그래서 재현이 오래 걸렸다.
//   ⭐ 건설 맵이 _techHold 로 푸는 것과 같은 방식이다. 뗄 때 밀린 그리기를 한 번에 처리한다.
let _resHold = false, _resDirty = false;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', function () { _resHold = true; }, true);
  const release = function () {
    if (!_resHold) return;
    _resHold = false;
    if (_resDirty) { _resDirty = false; campResSheet(); }
  };
  for (const t of ['pointerup', 'pointercancel']) document.addEventListener(t, release, true);
}
let _campResDrawing = false;
function campResSheet() {
  if (!_resSec || _campResDrawing) return;   // ⚠ campSyncSheet 이 다시 이 함수로 돌아온다 — 한 겹만 그린다
  if (_resHold) { _resDirty = true; return; }   // ⛔ 누르고 있는 동안은 미룬다(위 설명)
  const body = document.getElementById('btSheetBody'), sheet = document.getElementById('btSheet');
  if (!body || !sheet) return;
  let model = null;
  if (_resSec === 'res') model = campResModelRes();
  else if (_resSec === 'arm') model = (_armPick == null) ? campArmModelTop() : campArmModelOne();
  else model = campTechModel();
  sheet.classList.add('open');
  if (typeof G !== 'undefined' && G.tech) { G.tech.sheet = G.tech.sheet || {}; G.tech.sheet.open = true; G.tech.sheet.sec = 'research'; }
  _campResDrawing = true;
  try {
    if (typeof renderCmdGrid === 'function') renderCmdGrid(body, model);
    if (typeof campSyncSheet === 'function') campSyncSheet();
  } finally { _campResDrawing = false; }
}

// ── 🖱 슬롯 누르기 — **위임 + pointerup** (2026-08-27) ────────────────────
// ⛔ onclick 을 쓰지 말 것. 캠프는 매 프레임 시트를 다시 그리는데(초당 30회), 누르고 있는 사이
//   innerHTML 이 갈리면 **처음 누른 요소가 사라져 브라우저가 click 을 만들지 않는다.**
//   실측(2026-08-27): 20ms 누르면 되고 **150ms 부터 안 된다** — 사람 손은 100~200ms 라 영영 안 눌렸다.
//   (도구로 누르면 down/up 이 같은 프레임이라 통과한다. 그래서 재현이 오래 걸렸다.)
// ⭐ 다시 그리기를 막는 쪽으로는 못 푼다 — 시트를 갈아치우는 경로가 여럿이다(실측: 가드가 6번 중 1번을 놓쳤다).
//   대신 **갈려도 동작하게** 한다: 누른 자리에서 pointerup 때의 요소를 보고 data 속성으로 무엇인지 읽는다.
//   ⚠ 누르기 시작한 자리와 뗀 자리가 크게 다르면(드래그) 무시한다 — 실수로 사지 않게.
// ⛏ 채굴 토글은 **연구 칸이 아닐 때**(기지 요약) 뜨므로 위임을 따로 둔다.
let _mineDownPt = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', function (ev) {
    const t = ev.target;
    _mineDownPt = (t && t.closest && t.closest('[data-minemode]')) ? { x: ev.clientX, y: ev.clientY } : null;
  }, true);
  document.addEventListener('pointerup', function (ev) {
    const from = _mineDownPt; _mineDownPt = null;
    if (!from) return;
    if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) > 20) return;
    const t = ev.target;
    if (!(t && t.closest && t.closest('[data-minemode]'))) return;
    if (typeof campMineModeToggle === 'function') campMineModeToggle();
  }, true);
}
let _resDownPt = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', function (ev) {
    if (!_resSec) return;
    const t = ev.target; if (!t || !t.closest) return;
    if (!t.closest('#btSheetBody')) { _resDownPt = null; return; }
    _resDownPt = { x: ev.clientX, y: ev.clientY };
  }, true);
  document.addEventListener('pointerup', function (ev) {
    if (!_resSec || !_resDownPt) return;
    const from = _resDownPt; _resDownPt = null;
    if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) > 20) return;   // 끌었다 = 취소
    const t = ev.target; if (!t || !t.closest) return;
    // ⛔ **`#btSheetBody 안` 으로 찾지 말 것.** 누르고 있는 사이 시트가 갈리면 pointerup 은
    //   **이미 DOM 에서 떨어져 나간 옛 요소**에 온다(실측 2026-08-27: isConnected=false).
    //   그 요소는 문서 밖이라 `#btSheetBody …` 셀렉터가 통째로 실패한다 — 손으로는 영영 안 눌렸다.
    //   ⭐ 떨어져 나간 트리 안에서도 closest 는 동작한다. 슬롯 자신의 표식만 보면 된다.
    const sl = t.closest('[data-res],[data-arm],[data-armbuy],[data-tech]');
    if (!sl) return;
    if (sl.hasAttribute('data-res'))         campResTap(sl.getAttribute('data-res'));
    else if (sl.hasAttribute('data-arm'))    campArmPick(+sl.getAttribute('data-arm'));
    else if (sl.hasAttribute('data-armbuy')) campArmBuy(sl.getAttribute('data-armbuy'));
    else if (sl.hasAttribute('data-tech'))   campTechBuy(sl.getAttribute('data-tech'));
  }, true);
}

// ── 🚪 들고 나기 ─────────────────────────────────────────────────────────
// 연구는 네비 **최상위**라 캠프 밖(유즈맵·상점)에서도 눌린다. 거기엔 하단 시트가 없다.
// ⭐ 토벌 입구와 같은 규칙 — 먼저 캠프로 들어간 뒤에 내려간다(CLAUDE.md 레지스트리에 선례).
function campResEnter(sec) {
  if (typeof campIsOn !== 'function' || !campIsOn()) {
    if (typeof openHome === 'function') openHome();
  }
  setResSec(sec || 'res');
}
function setResSec(k) {
  if (CAMP_RES_SECS.indexOf(k) < 0) k = 'res';
  if (_resSec !== k) { _armPick = null; _armSel = null; _techSel = null; }   // 칸을 옮기면 처음부터
  _resSec = k;
  // 🗺 **한 자리에 두 주인을 두지 않는다** — 연구를 열면 맵 선택은 해제한다.
  //   (반대 방향은 campResPatch 가 맡는다: 맵에서 뭘 고르면 연구 모드가 풀린다.)
  campResClearMapSel();
  campResSheet();
}
function campResClearMapSel() {
  if (typeof G === 'undefined' || !G.tech) return;
  G.tech.sel = null; G.tech.selU = []; G.tech.selRes = null;
}
// 연구 모드에서 빠져나온다 — 맵에서 뭘 고르거나, 다른 구역으로 갈 때.
function campResExit() {
  if (!_resSec) return;
  _resSec = null;
  // ⛔ **시트 캐시를 비운다.** renderCampIdleSheet 는 「값이 안 바뀌었으면 다시 안 그린다」인데,
  //   그 판정이 `_cgModel.kicker` 로 「지금 그려진 것이 요약인가」를 본다 — 연구 그리드도 kicker 를 쓰므로
  //   요약으로 오인해서, 값이 그대로면 **연구 그리드가 시트에 그대로 남는다**
  //   (2026-08-27 실측: 아무것도 안 사고 뒤로 가면 하단이 「자원」인 채였다).
  { const body = document.getElementById('btSheetBody');
    if (body) { body._gSig = null; body._cgModel = null; body._cgSig = undefined; } }
  if (typeof G !== 'undefined' && G.tech && G.tech.sheet && G.tech.sheet.sec === 'research') {
    G.tech.sheet.open = false; G.tech.sheet.sec = null;
  }
}

// ── 🔧 패치 — 시트의 주인을 가른다 ───────────────────────────────────────
// techPanelRender 는 건물·유닛·자원 프로필을 그리는 **공유 함수**다(관리자 탭·오토배틀도 쓴다).
// ⛔ 그 안에 캠프 전용 분기를 넣지 않는다 — 캠프가 감싸서 자기 차례만 가로챈다
//   (campPatchZoom·campPatchRefinery 와 같은 방식).
let _campResPatched = null;
function campPatchResearch() {
  if (_campResPatched || typeof window === 'undefined') return;
  const o = window.techPanelRender;
  if (typeof o !== 'function') return;
  // 🏕 **입구가 둘이다.** 건물·유닛 프로필은 techPanelRender 가, 「아무것도 안 골랐을 때」 요약은
  //   renderCampIdleSheet 가 그린다(js/11-cmdcard.js). 캠프는 매 프레임 뒤엣것을 부르므로
  //   그쪽을 안 잡으면 **연구 그리드를 그려 놓아도 다음 프레임에 요약이 덮어쓴다**(2026-08-27 실측).
  // ⛏ **「MY BASE」 요약판 오른쪽에 채굴 토글을 끼운다**(2026-08-27 사용자 확정).
  //   ⭐ topRight 는 renderCmdGrid 가 **본문 오른쪽 열**에 놓는 자리다(css .cmdG:has(.cgTopOut)).
  //     새 컴포넌트를 만들지 않고 그 자리를 빌린다.
  //   ⚠ 클릭은 **위임 + pointerup** 으로 받는다 — 시트가 매 프레임 갈려 onclick 은 손으로 안 눌린다.
  const om = window._campIdleModel;
  if (typeof om === 'function') window._campIdleModel = function () {
    const m = om.apply(this, arguments);
    if (m && typeof campMineModeOn === 'function') {
      const on = campMineModeOn();
      // ⭐ **커맨드 그리드의 슬롯 한 칸**으로 그린다(2026-08-27 사용자 확정).
      //   판을 새로 만들지 않는다 — 같은 렌더러의 슬롯이라 검은 면·테두리·아이콘 자리가 저절로 같다.
      //   ⚠ wide 를 끈다(그래야 그리드가 그려진다). 빈 칸 셋은 CSS 로 감춰 **한 칸만** 보이게 한다.
      m.wide = false;
      m.items = [{
        pro: (typeof _icoPathImg === 'function') ? _icoPathImg('upgrades/up_mine', '⛏') : '',
        sn: on ? '채굴 중' : '채굴',
        bottom: '<div class="cgCost"></div>',
        cls: 'cmbSlot' + (on ? ' on' : ''),
        act: 'data-minemode="1"'
      }];
    }
    return m; };
  const oi = window.renderCampIdleSheet;
  _campResPatched = { techPanelRender: o, renderCampIdleSheet: oi };
  if (typeof oi === 'function') window.renderCampIdleSheet = function (host) {
    if (_resSec && typeof campIsOn === 'function' && campIsOn() && !host) { campResSheet(); return; }
    return oi.apply(this, arguments); };
  window.techPanelRender = function () {
    if (_resSec && typeof campIsOn === 'function' && campIsOn()) {
      // 🗺 맵에서 무언가를 고르면 **연구가 자리를 내준다**. 네비도 최상위로 올린다.
      const T = (typeof G !== 'undefined') ? G.tech : null;
      const picked = !!(T && (T.sel != null || (T.selU && T.selU.length) || T.selRes));
      if (picked) { campResExit(); if (typeof navBack === 'function') navBack(); return o.apply(this, arguments); }
      campResSheet();
      return;
    }
    return o.apply(this, arguments);
  };
}
function campUnpatchResearch() {
  if (!_campResPatched) return;
  window.techPanelRender = _campResPatched.techPanelRender;
  if (_campResPatched.renderCampIdleSheet) window.renderCampIdleSheet = _campResPatched.renderCampIdleSheet;
  _campResPatched = null;
}

// ══ ⚔ 무장 칸 — 계열 강화 (2026-08-27) ═══════════════════════════════════
// 2단이다: [보병][차량][함선] → 고르면 [🔙][공격][방어].
// ⭐ **테란 기준 구조를 세 종족에 그대로 쓴다**(사용자 확정). 계열 구성이 종족마다 달라서
//   (테란 6 · 저그 5 · 프로토스 5) 자동으로 묶을 수가 없다 — 자리를 표에 못박는다.
//   ⚠ 저그는 근접·원거리가 **지상 방어를 함께 쓴다**(gnd_def 가 두 자리에 온다). 레벨은 하나이므로
//     어느 쪽에서 올리든 같은 값이다 — 빈 칸을 두는 것보다 낫다.
//   ⚠ 프로토스의 가운데 자리는 **실드**다(공격이 없다) — 그 칸은 방어 하나만 선다.
// ⛔ 표에 없는 계열 연구가 생기면 **스모크가 실패한다**(아래 검사). 조용히 사라지는 것이 제일 나쁘다.
const CAMP_ARM_TREE = {
  union:     [ { nm:'보병', atk:'inf_atk',   def:'inf_def' },
               { nm:'차량', atk:'veh_atk',   def:'veh_def' },
               { nm:'함선', atk:'air_atk',   def:'air_def' } ],
  swarm:     [ { nm:'근접', atk:'melee_atk', def:'gnd_def' },
               { nm:'원거리', atk:'range_atk', def:'gnd_def' },
               { nm:'비행', atk:'fly_atk',   def:'fly_def' } ],
  aetherial: [ { nm:'지상', atk:'gnd_wpn',   def:'gnd_arm' },
               { nm:'보호막', atk:null,      def:'shield'  },
               { nm:'공중', atk:'air_wpn',   def:'air_arm' } ]
};
let _armPick = null;    // 고른 계열(0~2) · null = 계열 고르는 화면

function campArmTree() {
  const T = (typeof G !== 'undefined') ? G.tech : null;
  return (T && CAMP_ARM_TREE[T.race]) || [];
}
// 연구가 어느 건물에 있나 — techDoResearch 가 건물 키를 요구한다.
// ⛔ 표를 따로 만들지 않는다. 트리에서 찾는다(연구가 옮겨 가도 따라온다).
function campArmBldgOf(rk) {
  const T = (typeof G !== 'undefined') ? G.tech : null;
  if (!T || typeof TECH_TREE === 'undefined') return null;
  const t = TECH_TREE[T.race]; if (!t) return null;
  for (const b of (t.buildings || [])) if ((b.research || []).some(x => x.k === rk)) return b;
  return null;
}
function campArmRes(rk) {
  const b = campArmBldgOf(rk); if (!b) return null;
  return (b.research || []).find(x => x.k === rk) || null;
}
function campArmLv(rk) {
  const T = (typeof G !== 'undefined') ? G.tech : null;
  return (T && T.research && (T.research[T.race + '_' + rk] | 0)) || 0;
}
// 살 수 있나 — 건물이 서 있어야 한다(techDoResearch 와 같은 조건).
function campArmReady(rk) {
  const b = campArmBldgOf(rk); const T = (typeof G !== 'undefined') ? G.tech : null;
  if (!b || !T) return false;
  return !!((T.built && T.built[b.k] > 0) || (T.addon && T.addon[b.k]));
}

// ── 계열 고르는 화면 ─────────────────────────────────────────────────────
function campArmModelTop() {
  const rows = campArmTree();
  const items = rows.map((g, i) => {
    const keys = [g.atk, g.def].filter(Boolean);
    const lv = keys.reduce((a, k) => a + campArmLv(k), 0);
    const ready = keys.some(campArmReady);
    return {
      pro: (typeof _icoPathImg === 'function') ? _icoPathImg('upgrades/up_' + (g.atk ? 'gnd_wpn' : 'shield'), '⚔') : '',
      sn: g.nm, tr: 'Lv.' + lv,
      bottom: '<div class="cgCost"></div>',
      state: ready ? '' : 'dim',
      act: 'data-arm="' + i + '"'
    };
  });
  return { mode:'upg', compact:true, title:'무장', kicker:true,
    info:{ eb:'계열', name:'', hideName:true,
           desc:'강화할 계열을 고르세요 — 공격과 방어를 따로 올립니다' },
    items: items };
}
// ── 고른 계열의 [공격][방어] ─────────────────────────────────────────────
function campArmModelOne() {
  const rows = campArmTree(), g = rows[_armPick]; if (!g) return campArmModelTop();
  const T = G.tech;
  const mk = (rk, label) => {
    if (!rk) return { state:'empty' };
    const r = campArmRes(rk), lv = campArmLv(rk);
    const cc = (typeof campResearchCost === 'function') ? campResearchCost(r, lv) : null;
    const ready = campArmReady(rk);
    const poor = cc ? ((T.energy || 0) < cc[1]) : true;
    return {
      k: rk,
      pro: (typeof _icoPathImg === 'function') ? _icoPathImg('upgrades/up_' + rk, '⚔') : '',
      sn: (r && r.name) || label, tr: 'Lv.' + lv,
      cr: cc ? cc[0] : 0, en: cc ? cc[1] : 0,
      state: (!ready || poor) ? 'dim' : '',
      sel: (_armSel === rk),
      act: 'data-armbuy="' + rk + '"'
    };
  };
  const items = [ mk(g.atk, '공격'), mk(g.def, '방어') ];
  // 🔙 되돌아가기는 **건설 탭이 쓰는 그 자리**(m.back)다 — 새 버튼을 만들지 않는다.
  // 고른 것이 있으면 그것을, 없으면 첫 줄을 보여 준다(첫 탭 = 설명 보기)
  const first = ((_armSel === g.atk || _armSel === g.def) ? _armSel : null) || g.atk || g.def;
  const r0 = campArmRes(first), lv0 = campArmLv(first);
  const cc0 = (typeof campResearchCost === 'function') ? campResearchCost(r0, lv0) : null;
  const bld = campArmBldgOf(first);
  return { mode:'upg', compact:true, title:g.nm, kicker:true,
    back:'<button class="cgBack" onclick="campArmPick(null)" title="계열 고르기로">🔙</button>',
    info:{ eb:'Lv.' + lv0, name:(r0 && r0.name) || g.nm,
           desc: campArmReady(first) ? ((r0 && r0.desc) || '') : ('🔒 ' + ((bld && bld.name) || '건물') + ' 필요'),
           cr: cc0 ? cc0[0] : 0, en: cc0 ? cc0[1] : 0 },
    items: items };
}
function campArmPick(i) {
  _armPick = (i == null) ? null : (i | 0);
  if (typeof playSfx === 'function') playSfx('ui_tab');
  campResSheet();
}
let _armSel = null;   // 무장 칸에서 고른 항목(자원 칸의 _resPick 과 같은 어법)
function campArmBuy(rk) {
  const b = campArmBldgOf(rk);
  if (!b) return;
  if (_armSel !== rk) {                       // ① 처음 누름 = 설명 보기
    _armSel = rk;
    if (typeof playSfx === 'function') playSfx('ui_tab');
    campResSheet(); return;
  }
  if (!campArmReady(rk)) { if (typeof toast === 'function') toast('🔒 ' + b.name + ' 을 먼저 지으세요'); return; }
  // ⛔ 구매 경로를 새로 만들지 않는다 — 건물 카드가 쓰는 techDoResearch 그대로다
  //   (선행 조건·비용 차감·연구 시간·환불이 전부 거기 있다).
  if (typeof techDoResearch === 'function') techDoResearch(b.k, rk);
  campResSheet();
}

// ══ 🔬 기술 칸 — 단발 연구 (2026-08-27) ══════════════════════════════════
// 보이는 조건 둘 — **그 기술을 쓰는 유닛을 보유**했고, **아직 안 산 것**(sc-2 확정).
//   ⭐ 이 두 조건이 이 화면의 전부다. 20개를 그냥 늘어놓으면 5페이지가 되어 아무도 안 본다 —
//     초반(병영만 있을 때)에는 두어 개만 보이는 것이 목적이다.
// 정렬 — **지금 가스가 되는 것이 앞**(= 첫 페이지) → 그다음 트리 순서.
//
// ⭐ 「어느 유닛 것인가」는 **연구 데이터가 갖는다**(js/15-tech-data.js 의 `u:` · 사용자 확정 ⓐ).
//   ⛔ 여기에 매핑 표를 따로 두지 말 것 — 두 벌이 되면 연구가 늘 때 반드시 어긋난다.
//   ⚠ u 는 문자열 또는 배열이고, '*' 는 **전 유닛 대상**이다(예: 저그 매복).
//   ⚠ u 가 없는 단발 연구가 생기면 **스모크가 실패한다** — 조용히 사라지는 것이 제일 나쁘다.
function campTechUsers(r) {
  const u = r && r.u;
  if (!u) return null;                       // 표에 없다 — 스모크가 잡는다
  return Array.isArray(u) ? u : [u];
}
// 내가 그 유닛을 갖고 있나 — 전장에 있거나 생산한 적이 있으면 「보유」다.
// ⚠ **전장 병력을 반드시 함께 센다.** 유닛이 한 번만 태어나는 구조(2026-08-28)에서
//   생산된 유닛은 기지가 아니라 `CAMPB.me.units` 에 산다 — `G.tech.units` 만 보면
//   던전에 들어간 순간 기술 목록이 통째로 비어 버린다.
//   ⭐ 반복 구매(`campUnitOwned`)가 이미 같은 기준을 쓴다. 여기도 맞춘다.
function campHasUnit(uid) {
  const T = (typeof G !== 'undefined') ? G.tech : null; if (!T) return false;
  if ((T.units && (T.units[uid] | 0) > 0)) return true;
  if ((T.ents || []).some(e => e && e.type !== 'bldg' && (e.uid === uid || e.gmodel === uid))) return true;
  if (typeof CAMPB !== 'undefined' && CAMPB && CAMPB.me) {
    const hit = (u) => u && (u.gm === uid || u.id === uid);
    if (CAMPB.me.units.some(hit)) return true;
    if ((CAMPB._down || []).some(d => d && hit(d.u))) return true;   // ⚠ _down 은 {u,t} 껍데기다
  }
  return false;
}
// 이 기술을 화면에 보일 것인가
function campTechShow(r) {
  if (!r || r.tier) return false;                        // 계열은 무장 칸이 맡는다
  const T = (typeof G !== 'undefined') ? G.tech : null; if (!T) return false;
  if (T.research && T.research[T.race + '_' + r.k]) return false;   // 이미 샀다
  const us = campTechUsers(r);
  if (!us) return false;
  if (us.indexOf('*') >= 0) return true;                 // 전 유닛 대상
  return us.some(campHasUnit);
}
function campTechList() {
  const T = (typeof G !== 'undefined') ? G.tech : null;
  if (!T || typeof TECH_TREE === 'undefined') return [];
  const t = TECH_TREE[T.race]; if (!t) return [];
  const out = [];
  for (const b of (t.buildings || [])) for (const r of (b.research || []))
    if (campTechShow(r)) out.push({ r: r, b: b });
  // 💰 **지금 살 수 있는 것이 앞으로** — 첫 페이지에 「누를 수 있는 것」이 오게 한다.
  //   ⚠ 그 안에서는 **트리 순서를 지킨다**(안 그러면 가스가 찰 때마다 카드가 뛰어다닌다).
  const gas = (T.energy || 0);
  const cost = (o) => { const c = (typeof campResearchCost === 'function')
      ? campResearchCost(o.r, 0) : null; return c ? c[1] : 0; };
  out.forEach((o, i) => { o._i = i; o._afford = (gas >= cost(o)) ? 0 : 1; });
  out.sort((a, b2) => (a._afford - b2._afford) || (a._i - b2._i));
  return out;
}
function campTechModel() {
  const T = G.tech;
  const list = campTechList();
  const items = list.map(o => {
    const c = (typeof campResearchCost === 'function') ? campResearchCost(o.r, 0) : null;
    const ready = !!((T.built && T.built[o.b.k] > 0) || (T.addon && T.addon[o.b.k]));
    const poor = c ? ((T.energy || 0) < c[1]) : true;
    return {
      pro: (typeof _icoPathImg === 'function') ? _icoPathImg('skills/sk_' + o.r.k, '✨') : '',
      sn: o.r.name || o.r.k,
      cr: c ? c[0] : 0, en: c ? c[1] : 0,
      state: (!ready || poor) ? 'dim' : '',
      sel: (_techSel === o.r.k),
      act: 'data-tech="' + o.r.k + '"'
    };
  });
  const first = list.find(x => x.r.k === _techSel) || list[0];
  const c0 = first ? ((typeof campResearchCost === 'function') ? campResearchCost(first.r, 0) : null) : null;
  return { mode:'upg', compact:true, title:'기술', kicker:true,
    info: first
      ? { eb:first.b.name, name:first.r.name, desc:first.r.desc || '',
          cr:c0 ? c0[0] : 0, en:c0 ? c0[1] : 0 }
      // ⭐ 비어 있는 것이 **정상**이다 — 유닛을 뽑아야 그 유닛의 기술이 나타난다.
      : { eb:'기술', name:'', hideName:true,
          desc:'유닛을 갖추면 그 유닛의 기술이 여기 나타납니다' },
    items: items };
}
let _techSel = null;   // 기술 칸에서 고른 항목
function campTechBuy(rk) {
  const list = campTechList(), o = list.find(x => x.r.k === rk);
  if (!o) return;
  if (_techSel !== rk) {                      // ① 처음 누름 = 설명 보기
    _techSel = rk;
    if (typeof playSfx === 'function') playSfx('ui_tab');
    campResSheet(); return;
  }
  const T = G.tech;
  if (!((T.built && T.built[o.b.k] > 0) || (T.addon && T.addon[o.b.k]))) {
    if (typeof toast === 'function') toast('🔒 ' + o.b.name + ' 을 먼저 지으세요'); return; }
  // ⛔ 구매 경로는 건물 카드가 쓰는 techDoResearch 하나다(무장 칸과 같다)
  if (typeof techDoResearch === 'function') techDoResearch(o.b.k, rk);
  campResSheet();
}
