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
// ⏫ n = 몇 칸 뒤를 볼 것인가(기본 1 · 자원 칸의 ×5 / MAX 가 넘긴다)
function _campPeekNext(k, fn, n) {
  const C = (typeof campState === 'function') ? campState() : null;
  if (!C) return null;
  C.upg = C.upg || {};
  const had = C.upg[k] | 0;
  C.upg[k] = had + Math.max(1, n | 0);
  let v = null;
  try { v = fn(); } catch (e) { v = null; }
  C.upg[k] = had;
  return v;
}

// 🗄 유보 — ⛏ 「채굴 속도」는 **환생 트리 계열 'holdMs' 로 옮겼다**(2026-09-02 사용자 확정).
//   ⛔ 지우지 않는다(GAME_DIRECTION §5 「유보는 삭제가 아니다」). 화면에서만 뺐다.
//   ⛔ 되살리지 말 것 — 되살리면 홀드 간격을 정하는 곳이 둘이 되어 반드시 어긋난다.
//     되살리려면 js/19-camp.js 의 campHoldMs 도 같이 되돌려야 한다.
const CAMP_RES_ATTIC = [
  { k: 'hold', nm: '채굴 속도', ico: 'upgrades/up_mine',
    why: '누르고 있을 때 캐는 간격',
    now: () => (typeof campHoldMs === 'function') ? campHoldMs() / 1000 : 0.8,
    next: () => { if(typeof campHoldMs !== 'function') return null;
      if(campUpgLv('hold') >= campHoldLvMax()) return null;
      return _campPeekNext('hold', () => campHoldMs()) / 1000; },
    unit: '초', dec: 2,
    lock: () => (typeof campHoldLvMax === 'function') && campUpgLv('hold') >= campHoldLvMax(),
    lockWhy: '최대 — 더 줄이면 연타보다 빨라집니다' },
];

// ✂ **줄이 넘어가는 자리를 손으로 잡는다**(2026-09-05 사용자 요청 「각 줄이 깔끔하게 넘어가도록」).
//   설명 칸은 **95px 밖에 안 된다**(실측) — 한글 9~10자에서 줄이 바뀐다. 띄어쓰기마다 끊기게 두면
//   「…획득량 / 증가」처럼 한 낱말만 남거나, 두 문장이 한 줄에 섞인다.
//   ⭐ 그래서 **붙어 있어야 하는 낱말 사이에 `\u00A0`(줄바꿈 없는 공백)** 을 넣는다.
//     보이는 것은 보통 띄어쓰기와 같고, 거기서만 안 끊긴다.
//   ⚠ 눈에 안 보이는 문자라 **반드시 `\u00A0` 이스케이프로 적을 것** — 진짜 NBSP 를 붙여 넣으면
//     나중에 보통 공백으로 되돌아가도 아무도 모른다.
//   ⛔ `<br>` 로 끊지 말 것 — 폭이 달라지면(기기·글꼴) 그 자리가 틀린 자리가 된다.
// ── 📋 자원 칸 항목 표 ───────────────────────────────────────────────────
// ⭐ **한 줄이 곧 슬롯 하나**다. 값·다음값·설명을 전부 여기서 정하고, 그리는 쪽은 이 표만 읽는다.
//   ⚠ 정제소가 여기 있는 것이 이번 이동의 핵심이다 — 예전엔 정제소 **건물**의 연구 카드였다.
//     건물을 고르지 않으면 올릴 수 없어서, 자원 성장 셋 중 하나만 자리가 달랐다.
const CAMP_RES_ITEMS = [
  { k: 'tap', nm: '터치 강화', ico: 'upgrades/up_mineral_up',
    why: '탭\u00A0당 미네랄\u00A0증가',
    now: () => (typeof campTapGain === 'function') ? campTapGain() : 0,
    next: (n) => _campPeekNext('tap', () => campTapGain(), n),
    unit: '/탭' },
  { k: 'gather', nm: '일꾼 강화', ico: 'upgrades/up_speed',
    why: '채굴\u00A0당 미네랄 획득량\u00A0증가',
    now: () => (typeof campGatherMul === 'function') ? campGatherMul() : 1,
    next: (n) => _campPeekNext('gather', () => campGatherMul(), n),
    unit: '배', dec: 2 },
  // ⚠ 이름은 **「정제 강화」**다(2026-09-05 사용자 확정) — 이 칸은 건물이 아니라 **올리는 것**이다.
  //   건물 이름(정제소)은 아직 안 지었을 때 `lockWhy` 가 따로 말한다.
  { k: 'refinery', nm: '정제 강화', ico: 'buildings/bld_refinery',
    why: '채굴\u00A0당 가스 획득량\u00A0증가',
    now: () => (typeof campGasPerMin === 'function') ? campGasPerMin() : 0,
    // ⚠ 정제소 레벨은 C.upg 와 연구 칸(G.tech.research) 중 **큰 쪽**이다(campRefLv).
    //   그래서 C.upg 만 올려 보는 _campPeekNext 로는 안 움직일 수 있다 — 값에서 직접 한 칸 올린다.
    next: (n) => {
      if (typeof campGasPerMin !== 'function' || typeof campRefLv !== 'function') return null;
      const cur = campGasPerMin();
      if (!(typeof campHasRefinery === 'function' && campHasRefinery())) return null;   // 안 지었으면 다음 값도 0
      const lv = campRefLv(), _n = Math.max(1, n | 0);
      const base = CAMP_REF_BASE + CAMP_REF_STEP * lv;
      if (base <= 0) return null;
      return cur * ((CAMP_REF_BASE + CAMP_REF_STEP * (lv + _n)) / base);
    },
    unit: '/분', dec: 1,
    lv: () => (typeof campRefLv === 'function') ? campRefLv() : 0,
    // ⛽ 정제소를 아직 안 지었으면 올려도 나오는 것이 없다 — 그 사실을 슬롯에 적는다.
    lock: () => !(typeof campHasRefinery === 'function' && campHasRefinery()),
    lockWhy: '정제소를 먼저\u00A0건설하세요' },
  // 👷 **일꾼 생산** (2026-09-03 사용자 확정). 나머지 셋과 성격이 다르다 —
  //   「올리는 것」이 아니라 「사는 것」이다. 그래서 cost/buy 를 제 손으로 갖는다.
  //   ⭐ 왜 여기 두나: 자원을 늘리는 방법 넷(터치·채취·정제소·일꾼)이 **한 자리에** 모인다.
  //     예전엔 일꾼만 본부를 골라 생산 카드에서 뽑아야 해서 혼자 동선이 달랐다.
  //   ⚠ 값은 campHireCost 하나가 단일 소스다(본부 생산 카드도 그것을 쓴다 — campSyncHire).
  //   ⛔ 여기서 유닛을 직접 만들지 말 것 — techDoProduce 를 부른다. 인구·대기열·상한 계산이
  //     전부 거기 있고, 캠프는 그것을 감싸서 40기 상한만 얹었다(campPatchProduce).
  { k: 'worker', nm: '일꾼 생산', ico: () => 'units/un_' + campWorkerKey(),
    why: '자동 자원\u00A0채굴\u00A0유닛',
    // ⚠ 여기 넷은 전부 **뽑는 중인 것까지** 센다(campWorkerNPlanned) — 안 그러면 대기열에
    //   몰아 넣어 첫 마리 값으로 다섯을 사는 구멍이 난다(2026-09-03 사용자 발견).
    now: () => (typeof campWorkerNPlanned === 'function') ? campWorkerNPlanned() : 0,
    next: (n) => (typeof campWorkerNPlanned === 'function') ? campWorkerNPlanned() + Math.max(1, n | 0) : null,
    unit: '기',
    lv: () => (typeof campWorkerNPlanned === 'function') ? campWorkerNPlanned() : 0,
    lvTx: () => ((typeof campWorkerNPlanned === 'function') ? campWorkerNPlanned() : 0)
            + '/' + ((typeof CAMP_WORKER_MAX !== 'undefined') ? CAMP_WORKER_MAX : 40),
    cost: () => (typeof campHireCost === 'function' && typeof campWorkerNPlanned === 'function')
            ? campHireCost(campWorkerNPlanned()) : 0,
    // ⏫ n 기를 한 번에 — 값은 **마리마다 다르다**(campHireCost 가 지금 마릿수를 본다).
    costN: (n) => { if(typeof campHireCost !== 'function' || typeof campWorkerNPlanned !== 'function') return 0;
      const b = campWorkerNPlanned(); let s = 0;
      for(let i = 0; i < Math.max(1, n | 0); i++) s += campHireCost(b + i);
      return s; },
    // MAX = 미네랄과 **상한(40기)** 이 함께 정한다 — 업그레이드 사다리와 다른 규칙이다.
    maxN: () => { if(typeof campHireCost !== 'function' || typeof campWorkerNPlanned !== 'function') return 1;
      const cap = (typeof CAMP_WORKER_MAX !== 'undefined') ? CAMP_WORKER_MAX : 40;
      const step = (typeof CAMP_UPG_MAX_STEP !== 'undefined') ? CAMP_UPG_MAX_STEP : 99;
      const b = campWorkerNPlanned();
      let have = (typeof G !== 'undefined' && G.tech) ? (G.tech.credit || 0) : 0, n = 0;
      for(; n < step && b + n < cap; n++){ const c = campHireCost(b + n); if(c > have) break; have -= c; }
      return n; },
    buy: () => { const bk = campWorkerBldg();
      if(bk && typeof techDoProduce === 'function' && typeof TECH_WORKER !== 'undefined')
        techDoProduce(TECH_WORKER[G.tech.race], bk); },
    // ⏫ n 기를 한 번에 — ⚠ **넣기 직전에 값을 다시 잰다.**
    //   본부 생산 카드의 값(q.m)은 campSyncHire 가 **프레임마다 한 번** 갱신한다. 그래서 한 프레임에
    //   다섯을 몰아 넣으면 다섯 다 첫 마리 값으로 나간다(실측 250 · 제값 3,224 · 2026-09-03).
    //   ⛔ 여기서 값을 따로 계산해 차감하지 말 것 — campHireCost 가 단일 소스다.
    buyN: (n) => { const bk = campWorkerBldg(); if(!bk) return;
      for(let i = 0; i < Math.max(1, n | 0); i++){
        if(typeof campSyncHire === 'function') campSyncHire();
        if(typeof techDoProduce === 'function' && typeof TECH_WORKER !== 'undefined')
          techDoProduce(TECH_WORKER[G.tech.race], bk); } },
    lock: () => (typeof campWorkerNPlanned === 'function' && typeof CAMP_WORKER_MAX !== 'undefined')
            && campWorkerNPlanned() >= CAMP_WORKER_MAX,
    lockWhy: '일꾼은 ' + ((typeof CAMP_WORKER_MAX !== 'undefined') ? CAMP_WORKER_MAX : 40) + '기까지' }
];
// 👷 일꾼 유닛 키와, 그 일꾼을 뽑는 건물 키 — 종족마다 다르다.
//   ⚠ TECH_TREE 를 뒤져 찾는다(campSyncHire 와 **같은 방식**) — 이름을 박아 두면 종족이 늘 때 깨진다.
function campWorkerKey(){
  return (typeof TECH_WORKER !== 'undefined' && typeof G !== 'undefined' && G.tech)
    ? (TECH_WORKER[G.tech.race] || 'worker_human') : 'worker_human'; }
function campWorkerBldg(){
  if(typeof G === 'undefined' || !G.tech || typeof TECH_TREE === 'undefined') return null;
  const t = TECH_TREE[G.tech.race]; if(!t || !t.buildings) return null;
  const wk = campWorkerKey();
  for(const b of t.buildings) if((b.produces || []).some(x => x.id === wk)) return b.k;
  return null; }

function campResItem(k) { return CAMP_RES_ITEMS.find(x => x.k === k) || null; }
function campResItemLv(it) { return it.lv ? it.lv() : ((typeof campUpgLv === 'function') ? campUpgLv(it.k) : 0); }
// 💰 값 — 항목이 제 값을 갖고 있으면 그것이 이긴다(일꾼은 campHireCost 를 쓴다).
function campResItemCost(it) {
  if (it && it.cost) return it.cost();
  return (typeof campUpgCost === 'function') ? campUpgCost(it ? it.k : '') : 0; }
// 🔤 슬롯 오른쪽 위 표기 — 기본은 「Lv.n」이고, 일꾼처럼 세는 것은 「n/40」이다.
function campResItemTr(it) {
  if (it && it.lvTx) return it.lvTx();
  return 'Lv.' + campResItemLv(it); }

// 숫자 표기 — 큰 수는 캠프·HUD 와 같은 축약기(fmtCur)를 쓴다. ⛔ 새 표기기를 만들지 말 것.
function _campResNum(v, dec) {
  if (v == null || !isFinite(v)) return '—';
  if (dec) return (+v).toFixed(dec);
  return (typeof fmtCur === 'function') ? fmtCur(v) : String(Math.round(v));
}

// ── 🎛 자원 칸 모델 → renderCmdGrid ──────────────────────────────────────
// ⏫ 이 칸을 한 번 눌러 오를 레벨 수 — 무장 칸과 **같은 배수 상태(_armMul)** 를 쓴다.
//   ⛔ 자원용 배수를 따로 두지 말 것: 두 칸을 오갈 때마다 값이 달라 보이면 그게 버그로 읽힌다.
//   ⚠ MAX 는 **지금 미네랄로 살 수 있는 만큼**이다(무장 칸의 MAX 는 가스 기준).
//   ⚠ 항목이 **제 값을 갖고 있으면**(일꾼의 costN/maxN) 그것을 쓴다 — 일꾼은 레벨이 아니라
//     생산 대기열이고 상한(40기)도 있어서, 업그레이드 사다리로는 못 센다.
function campResMulN(it) {
  const o = (typeof it === 'string') ? campResItem(it) : it;
  if (_armMul !== 'max') return _armMul;
  if (o && o.maxN) return Math.max(1, o.maxN() | 0);
  return Math.max(1, (typeof campUpgAfford === 'function') ? campUpgAfford(o ? o.k : it) : 1);
}
// n 칸의 비용 합 — ⛔ 여기서 식을 다시 쓰지 말 것(값은 항목이나 campUpgDry 가 갖는다)
function campResCostN(it, n) {
  const o = (typeof it === 'string') ? campResItem(it) : it;
  if (n <= 1) return campResItemCost(o);
  if (o && o.costN) return o.costN(n);
  if (typeof campUpgDry !== 'function') return campResItemCost(o);
  return campUpgDry(o ? o.k : it, n)[0];
}
function campResModelRes() {
  const have = (typeof G !== 'undefined' && G.tech) ? (G.tech.credit || 0) : 0;   // ⛔ | 0 금지 — 21억을 넘으면 음수가 된다
  const items = CAMP_RES_ITEMS.map(it => {
    const lv = campResItemLv(it);
    const nMul = campResMulN(it);
    const cost = campResCostN(it, nMul);
    const locked = it.lock ? it.lock() : false;
    const poor = have < cost;
    return {
      k: it.k,
      pro: (typeof _icoPathImg === 'function')
        ? _icoPathImg((typeof it.ico === 'function') ? it.ico() : it.ico, '🔧') : '',
      sn: it.nm,
      // ⭐ 누르기 **전에** 얼마나 오르는지 슬롯에서 바로 보인다(정보판은 고른 것만 보여 준다)
      sub: (function(){ const c = it.now(), x = it.next(nMul);
        return (x != null && !locked) ? (_campResNum(c, it.dec) + ' ▸ ' + _campResNum(x, it.dec)) : ''; })(),
      tr: campResItemTr(it) + (nMul > 1 ? ' +' + nMul : ''),
      cr: cost,
      state: (locked || poor) ? 'dim' : '',
      sel: (_resPick === it.k),
      act: 'data-res="' + it.k + '"'
    };
  });
  const it = campResItem(_resPick) || CAMP_RES_ITEMS[0];
  const lv = campResItemLv(it);
  const nSel = campResMulN(it);
  const cost = campResCostN(it, nSel);
  const locked = it.lock ? it.lock() : false;
  const cur = it.now(), nxt = it.next(nSel);
  return {
    mode: 'upg', compact: true, title: '자원',
    kicker: true,
    // ⏫ 배수 칸 — 무장 칸과 **같은 껍데기·같은 위임**이다(⛔ onclick 으로 달지 말 것)
    topRight: campArmMulHTML(),
    info: {
      eb: campResItemTr(it) + (nSel > 1 ? ' +' + nSel : ''),
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
  const nBuy = campResMulN(it);
  const cost = campResCostN(it, nBuy);
  if (have < cost) {
    // 얼마가 모자란지까지 말한다 — 「안 된다」가 아니라 「얼마가 더 필요하다」로 읽히게
    if (typeof toast === 'function')
      toast('미네랄 ' + ((typeof fmtCur === 'function') ? fmtCur(cost - have) : (cost - have)) + ' 더 필요합니다');
    if (typeof playSfx === 'function') playSfx('ui_tab');
    campResSheet(); return;
  }
  // ⏫ 배수만큼 한 번에.
  //   👷 일꾼은 「올리기」가 아니라 「생산」이다 — 항목이 제 손(buy)을 갖고 있으면 그것을 n 번 부른다.
  //   ⛏ 그 밖은 campUpgBuyN 이 묶어 산다(소리·저장은 한 번만 낸다).
  if (it.buyN) it.buyN(nBuy);
  else if (it.buy) { for (let i = 0; i < nBuy; i++) it.buy(); }
  else if (typeof campUpgBuyN === 'function') campUpgBuyN(k, nBuy);
  else if (typeof campUpgBuy === 'function') campUpgBuy(k);
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
    const sl = t.closest('[data-res],[data-arm],[data-armbuy],[data-tech],[data-armmul],[data-armback]');
    if (!sl) return;
    // 🎛 트레이 두 버튼도 **여기로** 온다(2026-09-03). onclick 으로 두면 손가락에서 안 눌린다 —
    //   칸은 이 위임을 타는데 트레이만 click 을 기다려 경로가 둘로 갈려 있었다.
    if (sl.hasAttribute('data-armmul'))      { campArmMulCycle(); return; }
    if (sl.hasAttribute('data-armback'))     { campArmPick(null); return; }
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
// ⭐ **네 칸이다**(2026-09-03 사용자 확정): 공격력 · 공격속도 · 체력 · 방어력.
//   ⚠ `def` 는 이름이 「방어력」이지만 캠프에서 하는 일은 **체력**이다(HUNT_R1 §3-4 —
//     방어구 자리를 체력이 대신한다). 그래서 화면 라벨은 「체력」이라 쓴다.
//   ⭐ `as`(공격속도) · `dr`(방어력)는 **캠프 전용 연구**다 — 아래 CAMP_ARM_ADD 가 주입한다.
//   ⚠ 저그는 근접·원거리가 지상 체력·방어를 **함께 쓴다**(gnd_def · gnd_dr 이 두 자리에 온다).
//   ⚠ 에테리얼 가운데(보호막)는 공격이 없다 — 체력 한 칸만 선다.
const CAMP_ARM_TREE = {
  union:     [ { nm:'보병', atk:'inf_atk',   as:'inf_as',   def:'inf_def', dr:'inf_dr' },
               { nm:'차량', atk:'veh_atk',   as:'veh_as',   def:'veh_def', dr:'veh_dr' },
               { nm:'함선', atk:'air_atk',   as:'air_as',   def:'air_def', dr:'air_dr' } ],
  swarm:     [ { nm:'근접', atk:'melee_atk', as:'melee_as', def:'gnd_def', dr:'gnd_dr' },
               { nm:'원거리', atk:'range_atk', as:'range_as', def:'gnd_def', dr:'gnd_dr' },
               { nm:'비행', atk:'fly_atk',   as:'fly_as',   def:'fly_def', dr:'fly_dr' } ],
  aetherial: [ { nm:'지상', atk:'gnd_wpn',   as:'gnd_as',   def:'gnd_arm', dr:'gnd_dr' },
               { nm:'보호막', atk:null,      as:null,       def:'shield',  dr:null     },
               { nm:'공중', atk:'air_wpn',   as:'air_as',   def:'air_arm', dr:'air_dr' } ]
};
// ── ⚔ 캠프 전용 계열 연구 주입 ──────────────────────────────────────────
//   ⛔ `js/15-tech-data.js` 를 직접 고치지 않는다 — 그 표는 **관리자 건설과 공유**다.
//     여기서 밀어 넣고, 건물 카드 노출은 `_techResList`(16-build.js)가 `camp` 플래그로 거른다.
//     ⚠ 오토배틀은 원래 연구를 안 쓴다(techWallet() 이면 빈 목록) — 대전 밸런스는 안 움직인다.
//   ⚠ 값·건물은 **같은 계열의 기존 연구를 따라간다**(공격력이 있는 건물에 함께 선다).
const CAMP_ARM_ADD = {
  union: { engbay:[['inf_as','보병 공격속도'], ['inf_dr','보병 방어력']],
           armory:[['veh_as','차량 공격속도'], ['veh_dr','차량 방어력'],
                   ['air_as','함선 공격속도'], ['air_dr','함선 방어력']] },
  swarm: { evochamber:[['melee_as','근접 공격속도'], ['range_as','원거리 공격속도'],
                       ['gnd_dr','지상 방어력']],
           spire:[['fly_as','비행 공격속도'], ['fly_dr','비행 방어력']] },
  aetherial: { forge:[['gnd_as','지상 공격속도'], ['gnd_dr','지상 방어력']],
               cyber:[['air_as','공중 공격속도'], ['air_dr','공중 방어력']] }
};
const CAMP_ARM_TIER = [[100,100],[175,175],[250,250]];   // 기존 계열 연구와 같은 자
// 🎨 아이콘 — 계열 연구는 upgrades/up_<키>.webp 를 쓴다.
//   ⚠ 캠프 전용 연구(as·dr)는 제 그림이 아직 없다 — **뜻이 같은 기존 것**을 빌린다
//     (CLAUDE.md 아이콘 원칙: 있으면 그것을 쓰고, 없을 때만 새로 뽑는다 · ART.md §15).
//   ⛔ 이모지 폴백으로 두지 말 것 — 다른 칸은 전부 그림이라 한 칸만 글자면 눈에 튄다.
//   ⚠ 계열(보병·차량·함선)마다 같은 그림이 된다 — 계열별로 뽑으면 그때 표를 늘린다.
const CAMP_ARM_ICO = { as:'up_atkspd', dr:'up_carapace' };
function campArmIco(rk){
  if(!rk) return 'up_perm';
  const t = rk.slice(-3);
  if(t === '_as') return CAMP_ARM_ICO.as;
  if(t === '_dr') return CAMP_ARM_ICO.dr;
  return 'up_' + rk; }
function campArmInstall(){
  if(typeof TECH_TREE === 'undefined') return 0; let n = 0;
  for(const race in CAMP_ARM_ADD){ const t = TECH_TREE[race]; if(!t) continue;
    for(const bk in CAMP_ARM_ADD[race]){
      const b = (t.buildings || []).find(x => x.k === bk); if(!b) continue;
      b.research = b.research || [];
      for(const [k, nm] of CAMP_ARM_ADD[race][bk]){
        if(b.research.some(r => r.k === k)) continue;       // 두 번 넣지 않는다
        const as = k.slice(-3) === '_as';
        b.research.push({ k, camp:true, name:nm,
          desc: as ? '공격 간격 −3%/레벨' : '받는 피해 −1.5%/레벨 (최대 −60%)',
          tier: CAMP_ARM_TIER });
        n++; } } }
  return n; }
campArmInstall();
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
    const keys = [g.atk, g.as, g.def, g.dr].filter(Boolean);
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
           desc:'강화할 계열을 선택하세요. 계열\u00A0별\u00A0강화가 나누어져\u00A0있습니다.' },
  // ⚠ 「계열 별 강화가」를 통째로 묶어야 넷째 줄이 산다 — 「계열 별」만 묶으면 그것이
  //   둘째 줄 끝에 올라타고 「강화가」 하나만 셋째 줄에 남는다(실측으로 두 번 만에 잡았다).
  //   지금: 「강화할 계열을 / 선택하세요. / 계열 별 강화가 / 나누어져 있습니다.」
    items: items };
}
// ── 고른 계열의 [공격][방어] ─────────────────────────────────────────────
function campArmModelOne() {
  const rows = campArmTree(), g = rows[_armPick]; if (!g) return campArmModelTop();
  const T = G.tech;
  const mk = (rk, label, override) => {
    if (!rk) return { state:'empty' };
    const r = campArmRes(rk), lv = campArmLv(rk);
    // ⏫ 배수가 걸려 있으면 **그만큼의 값**을 보여 준다 — 누르기 전에 얼마인지 알아야 한다.
    const nMul = campArmMulN(rk);
    let cc = (typeof campResearchCost === 'function') ? campResearchCost(r, lv) : null;
    if(cc && nMul > 1){ let m = 0, g = 0;
      for(let i = 0; i < nMul; i++){ const c = campResearchCost(r, lv + i); if(!c) break;
        m += c[0] || 0; g += c[1] || 0; }
      cc = [m, g]; }
    const ready = campArmReady(rk);
    const poor = cc ? ((T.energy || 0) < cc[1]) : true;
    return {
      k: rk,
      pro: (typeof _icoPathImg === 'function') ? _icoPathImg('upgrades/' + campArmIco(rk), '⚔') : '',
      sn: override || (r && r.name) || label,
      tr: 'Lv.' + lv + (nMul > 1 ? ' +' + nMul : ''),
      cr: cc ? cc[0] : 0, en: cc ? cc[1] : 0,
      state: (!ready || poor) ? 'dim' : '',
      sel: (_armSel === rk),
      act: 'data-armbuy="' + rk + '"'
    };
  };
  // ⭐ 네 칸 — 공격력 · 공격속도 · 체력 · 방어력.
  //   ⚠ `def` 의 표 이름은 「…방어력」이지만 캠프에서 하는 일은 체력이다 — 여기서 라벨을 덮는다.
  // ⚠ 칸 이름은 **짧게** — 제목이 이미 계열(보병·차량…)이라 앞에 또 붙이면 잘린다.
  //   전체 이름(「보병 공격속도」)은 아래 정보 줄이 보여 준다.
  const items = [ mk(g.atk, '공격력', '공격력'), mk(g.as, '공격속도', '공격속도'),
                  mk(g.def, '체력', '체력'), mk(g.dr, '방어력', '방어력') ];
  // 🔙 되돌아가기는 **건설 탭이 쓰는 그 자리**(m.back)다 — 새 버튼을 만들지 않는다.
  // 고른 것이 있으면 그것을, 없으면 첫 줄을 보여 준다(첫 탭 = 설명 보기)
  const keys4 = [g.atk, g.as, g.def, g.dr].filter(Boolean);
  const first = (keys4.indexOf(_armSel) >= 0 ? _armSel : null) || keys4[0];
  const r0 = campArmRes(first), lv0 = campArmLv(first);
  const cc0 = (typeof campResearchCost === 'function') ? campResearchCost(r0, lv0) : null;
  const bld = campArmBldgOf(first);
  return { mode:'upg', compact:true, title:g.nm, kicker:true,
    topRight: campArmMulHTML()
      + '<button class="cgGly cgGlySq cgBack" data-armback="1" title="계열 고르기로">'
      + ((typeof uiIco === 'function') ? uiIco('back') : '‹') + '</button>',
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
// ⏫ 한 번에 올릴 레벨 — ×1 · ×5 · MAX (2026-09-03 사용자 확정 · 트레이 오른쪽 위).
//   ⭐ 클릭 수를 줄이는 장치다. **시간은 안 줄인다** — n 레벨이면 연구 시간도 n 배다
//     (돈만 내고 즉시가 되면 시간 축이 통째로 사라진다 · techDoResearch 가 그렇게 짠다).
const CAMP_ARM_MULS = [1, 5, 'max'];
let _armMul = 1;
// 🔁 **한 칸을 눌러 돌린다** — ×1 → ×5 → MAX → ×1 (2026-09-03 사용자 확정).
//   ⛔ 버튼 셋을 나란히 두지 말 것: 트레이는 판 밖에 떠 있어 칸이 늘수록 전장을 더 가린다.
//   ⭐ 사냥터 수량 토글(hmUpgQtyCycle · 1→10→MAX)과 **같은 어법**이고 껍데기도 그것을 그대로 쓴다.
function campArmMulCycle(){
  const i = CAMP_ARM_MULS.indexOf(_armMul);
  _armMul = CAMP_ARM_MULS[(i + 1) % CAMP_ARM_MULS.length];
  if(typeof playSfx === 'function') playSfx('ui_tab');
  campResSheet(); }
// 지금 가스로 살 수 있는 최대 레벨 — MAX 가 쓴다. ⚠ 레벨마다 값이 다르므로 한 칸씩 더해 본다.
const CAMP_ARM_MAX_STEP = 99;          // 한 번에 이 이상은 안 올린다(무한 루프·과금 사고 방지)
function campArmAfford(rk){
  const r = campArmRes(rk); if(!r) return 0;
  const T = (typeof G !== 'undefined') ? G.tech : null; if(!T) return 0;
  let lv = campArmLv(rk), gas = T.energy || 0, min = T.credit || 0, n = 0;
  for(; n < CAMP_ARM_MAX_STEP; n++){
    const c = (typeof campResearchCost === 'function') ? campResearchCost(r, lv + n) : null;
    if(!c) break;
    if((c[0] || 0) > min || (c[1] || 0) > gas) break;
    min -= (c[0] || 0); gas -= (c[1] || 0); }
  return n; }
function campArmMulN(rk){ return (_armMul === 'max') ? Math.max(1, campArmAfford(rk)) : _armMul; }
// 🎛 트레이 오른쪽 위 — 되돌아가기(🔙)와 같은 줄. **칸은 하나**다.
//   ⛔ 껍데기를 새로 만들지 말 것 — 사냥터 수량 버튼(.hmUpQty/.hmUpQ)이 단일 소스다.
function campArmMulHTML(){
  return '<button class="cgGly cgGlyN" type="button" data-armmul="1"'
    + ' title="한 번에 올릴 레벨 — 눌러서 바꿉니다">'
    + (_armMul === 'max' ? 'MAX' : '×' + _armMul) + '</button>'; }
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
  if (typeof techDoResearch === 'function') techDoResearch(b.k, rk, campArmMulN(rk));
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
