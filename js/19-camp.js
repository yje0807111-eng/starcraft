/* ============================================================================
 * 19-camp.js — 캠프(HOME 메인) — 건설 시스템을 빌려 쓰는 새 게임 모드 (2026-08-23)
 * ⛔ 로드 순서 = 파일명 번호 순. 16/17(건설)·18(오토배틀) 뒤에 와야 한다.
 * ========================================================================== */
// 🏕 캠프 — 종족을 고르면 본부와 광맥만 있고, 일꾼이 캐고, 건물을 지어 나간다.
//
// ⭐ **새로 만드는 게 아니라 이미 있는 것을 켜는 모듈이다.**
//    관리자 건설 탭(16-build.js)이 종족별 본부 배치 · 광맥 · 일꾼 왕복 채취 ·
//    격자 배치 · 건물별 생산 카드 · 유닛 이동을 전부 갖고 있다. 여기서는
//    그것을 **초기화하고 캠프 규칙으로 덮을** 뿐이다.
//
// ⛔ 16-build.js / 17-build-cards.js 를 고치지 말 것 — 관리자 탭과 오토배틀이 공유한다.
//    오토배틀(18-strike.js:188)이 똑같이 '빌려 쓰는' 쪽에 서 있다. 그 관계를 그대로 따른다.
//
// ⛔ **"초당 수급"이라는 별도 장치를 만들지 말 것.** 일꾼이 실제로 왕복해서 버는 것이 전부다.
//    초당으로 보여 준다면 그건 '번 돈 ÷ 걸린 초'인 표시값이다. 식을 두 벌 만들면 어긋난다.
//
// 옛 사냥터(08-hunt.js)는 **코드를 남긴 채 진입만 끊었다**(05-home.js). 되살리려면 거기 한 줄이다.

const CAMP_VER = 2;   // 1 → 2 : 단계 번호가 한 칸 내려갔다(옛 던전 1 = 지금 0단계 = 캠프)

// ══ 🗺 단계와 라운드 (2026-08-25) ═══════════════════════════════════════
//   **0단계 = 캠프.** 적이 없다. 누르고·뽑고·짓는 것을 위협 없이 익히는 구간이다.
//   **1단계부터 던전.** 여기서부터 적이 내려온다. 단계마다 50라운드.
//   ⭐ 화면은 하나뿐이다 — 단계가 바뀌어도 기지·광맥·일꾼은 그대로 있고 적만 달라진다.
//
//   설계 단일 소스: HUNT_R1.md §6-1 (미네랄 표) · §6-1-0-2 (클리어 기준) · §6-1-0-3 (탈락)
//   ⛔ 아래 표를 공식으로 바꾸지 말 것 — HUNT_R1.md §6-1-0-1-1 에 이유가 있다.
//      (옛 ×2^(단계-1) 공식은 단계 5부터 문턱에서 배율이 '내려갔다')
// ⚠ CAMP_DG_MAX 는 js/12-appshell.js 가 먼저 선언한다(재화 바 칩이 쓴다).
//    고전 스크립트라 전역이 하나뿐 — 여기서 다시 선언하면 파일 전체가 안 읽힌다(머지에서 실제로 그랬다).
const CAMP_ROUND_MAX = 50;     // 던전 하나 = 50라운드
// [0]=캠프 · [1..10]=던전. base=진입 배율 · x=50라운드 다 깼을 때 몇 배가 되는가
const CAMP_MINE = [
  { base: 1,      x: 1 },      // 0단계 캠프 — 배율 고정, 라운드 없음
  { base: 1,      x: 2 }, { base: 3,      x: 2 }, { base: 10,     x: 2 },
  { base: 30,     x: 3 }, { base: 150,    x: 3 }, { base: 700,    x: 3 },
  { base: 3000,   x: 4 }, { base: 20000,  x: 4 }, { base: 120000, x: 4 },
  { base: 700000, x: 5 },
];
function campDgN(){ const C = campState(); return Math.max(0, Math.min(CAMP_DG_MAX, (C && C.dg) | 0)); }
// ⭐ 배율은 라운드를 **클리어해야** 붙는다 → 50라운드면 50번 붙는다(49번이 아니다).
//    그래서 증가량이 전부 딱 떨어진다: +0.02 · +0.06 · +0.2 · +1.2 · +6 · +28 · +180 · …
function campMineInc(dg){ const t = CAMP_MINE[Math.max(0, Math.min(CAMP_DG_MAX, dg | 0))];
  return t.base * (t.x - 1) / CAMP_ROUND_MAX; }
// 지금 미네랄 배율 — 탭과 일꾼 **양쪽에 똑같이** 걸린다(한쪽만 올리면 두 수입의 비율이 무너진다)
function campMineMul(){ const C = campState(); if(!C) return 1;
  const dg = campDgN(), t = CAMP_MINE[dg];
  return t.base + campCleared() * campMineInc(dg); }
function campCleared(){ const C = campState(); if(!C || !((C.dg | 0) > 0)) return 0;
  return Math.max(0, Math.min(CAMP_ROUND_MAX, C.cleared | 0)); }
// 지금 도전 중인 라운드 = 클리어한 수 + 1 (0단계에는 라운드가 없다)
function campRoundN(){ return (campDgN() > 0) ? campCleared() + 1 : 0; }

// ── 진입 · 클리어 · 탈락 ────────────────────────────────────────────────
// ⛔ 옛 이름 campDgMul 은 남겨 둔다 — 밖에서 부르는 곳이 생겼을 때 조용히 갈라지지 않게.
function campDgMul(dg){ return (dg == null) ? campMineMul() : CAMP_MINE[Math.max(0, Math.min(CAMP_DG_MAX, dg | 0))].base; }

// 캠프(0) → 던전으로 내려간다. 인자가 없으면 **최고 기록 다음 칸**이 아니라 던전 1부터.
function campEnterDungeon(dg){ const C = campState(); if(!C) return 0;
  const n = Math.max(1, Math.min(CAMP_DG_MAX, (dg | 0) || 1));
  C.dg = n; C.cleared = 0; campSave();
  if(typeof campBarReset === 'function') campBarReset();
  return n; }

// 라운드 하나를 깼다. 50을 채우면 **다음 던전으로 자동으로** 넘어간다.
//   ⚠ 전투(2단계)가 부를 입구다. 여기 말고 다른 곳에서 C.cleared 를 만지지 말 것.
function campClearRound(){ const C = campState(); if(!C || !((C.dg | 0) > 0)) return false;
  C.cleared = campCleared() + 1;
  if(!C.best) C.best = {};
  C.best[C.dg] = Math.max(C.best[C.dg] | 0, C.cleared);
  if(C.cleared >= CAMP_ROUND_MAX){
    if(C.dg < CAMP_DG_MAX){ C.dg++; C.cleared = 0; }   // 자동 이동 — 방치형이라 손이 안 가는 게 맞다
    else C.cleared = CAMP_ROUND_MAX;                    // 마지막 던전은 끝에 머문다
  }
  campSave(); return true; }

// 졌다 → **캠프(0단계)로 돌아간다.** 몇 라운드를 깼든 그 판은 끝이다.
//   ⭐ 1라운드도 못 깼으면 보너스 0 — 배율이 base 인 채로 끝난다(HUNT_R1 §6-1-0-3).
//   ⚠ best 는 지우지 않는다. 다시 내려갈 때의 목표가 된다.
function campFail(){ const C = campState(); if(!C) return 0;
  const was = { dg:C.dg | 0, cleared: campCleared() };
  C.dg = 0; C.cleared = 0; campSave(); return was; }

function campBest(dg){ const C = campState(); return (C && C.best && C.best[dg | 0]) | 0; }

// ══ 🔁 환생 (2026-08-25 · 5단계) ═══════════════════════════════════════
//   설계 단일 소스: HUNT_R1.md §4. 요지 셋 —
//   ① 조건은 **매번 같다**: 그 회차 재화점수 100만. 회차가 늘어도 안 오른다.
//      고정이라 후반에는 금방 채워진다 → 「특정 시점부터 자유롭게」가 저절로 이루어진다.
//   ② 배수는 **로그**(폭주 방지) · 포인트는 **제곱근 × 깊이**(트리 비용이 지수라 같이 자라야 한다)
//   ③ 기준선 100만과 포인트 공식의 기준선은 **같은 숫자**다 — 그래서 조건을 채운 그 순간
//      기준량이 정확히 1 이고, 「지금 환생할까 더 벌고 환생할까」가 이 한 숫자에서 나온다.
//
//   ⚠ 통신소 스캔은 아직 입구로 안 붙였다(§4 의 화면 쪽). 지금 조건은 재화점수 하나다 —
//      통신소는 유니온 테크에만 있어 다른 종족이 통째로 막힌다. UI 를 붙일 때 함께 푼다.
const CAMP_REB_COST = 1e6;        // 환생 관문 = 포인트 공식의 기준선과 같은 숫자
const CAMP_GAS_RATE = 8;          // 재화점수에서 가스 1 = 미네랄 몇인가
// ── ⛽ 정제소 자동 생산 (HUNT_R1 §2-3-1) ────────────────────────────────
// ⭐ **일꾼을 빼서 배치하지 않는다.** 정제소가 스스로 캔다 — 스타 원본과 다르다.
//   분당 = (12 + 2 × 정제소Lv) × 던전배율 · 업그레이드 비용 = 미네랄 1만 × 1.12^Lv
// ⭐ **가스는 강화 전용 자원이다** — 유닛에는 안 든다(연구·계열 업그레이드만 쓴다).
//   미네랄 = 양(유닛·일꾼·건물) / 가스 = 질(강화·해금). 자세한 것은 CAMP_UNIT_GAS 옆 설명.
// ⚠ **값은 실측으로 정한다**(BALANCE.md §3-2-2). 옛 0.2/0.1 은 「한 회차 = 3시간」을 전제로
//   쓴 값인데, 실측 회차는 41분이라 25분에 가스가 5개뿐이었다 — 상위 유닛도 연구도 못 열었다.
//   합격 기준: 회차 하나에 **계열 업그레이드 144레벨(계열당 24) + 단발 3~5개** ≈ 가스 476.
const CAMP_REF_BASE = 12, CAMP_REF_STEP = 2;     // 분당 생산 — 기본 · 레벨당
// ⭐ 레벨당 +2 인 이유: 정제소를 올리는 것이 **가스가 눈에 띄게 느는 일**이어야 한다.
//   +0.6 일 때는 12레벨을 올려도 분당 13 뿐이라, 미네랄만 새고 체감이 없었다(실측).
// ⛽ 업그레이드 비용(미네랄) — ⭐ **자주 오르는 것이 목적**이다(2026-08-27 사용자 확정).
//   계단이 가파르면 한 회차에 몇 번 못 올라 「가스 구역을 키운다」가 체감되지 않는다.
//   ⛔ 계단을 1 에 가깝게 눕히지 말 것 — 미네랄이 지수로 자라므로 비용도 지수여야
//     정제소 레벨이 로그로 자란다(그래야 가스가 폭주하지 않는다 · BALANCE §0).
const CAMP_REF_COST0 = 10000, CAMP_REF_R = 1.12;
// ⛽ **정제소 「가스 생산」 업그레이드** — 설계 §2-3-1 은 「정제소 안에서」 산다.
//   ⭐ **UI 를 새로 만들지 않는다.** 캠프에 들어올 때 정제소의 `research` 배열에 항목을 하나
//     꽂고 나갈 때 뺀다(`campSyncUnitCost` 와 같은 빌림-반납). 그러면 카드·구매·진행바·
//     비용 표시를 전부 공짜로 얻는다.
//   ⛔ TECH_TREE 는 관리자 탭·오토배틀과 공유다 — 항목을 영구히 넣지 말 것.
//   ⚠ `tier:[]` 는 **캠프에서만** 성립한다(값을 campResearchCost 가 대신 낸다).
//     캠프 밖에서 이 항목이 보이면 `r.tier[lv]` 가 undefined 라 터진다. 그래서 반드시 뺀다.
const CAMP_REF_KEY = 'gasup';
const CAMP_REF_RES = { k:CAMP_REF_KEY, name:'가스 생산', desc:'정제소 자동 생산 +' + CAMP_REF_STEP + '/분', tier:[] };
let _campRefHome = null;
function campPatchRefinery(){
  if(_campRefHome || typeof G === 'undefined' || !G.tech || typeof TECH_TREE === 'undefined') return;
  const t = TECH_TREE[G.tech.race]; if(!t) return;
  const b = (t.buildings || []).find(function(x){ return x.gas; }); if(!b) return;
  _campRefHome = { b: b, had: b.research || null };
  b.research = (b.research || []).concat([CAMP_REF_RES]); }
// 🩸 **스킬의 체력 코스트를 캠프 자릿수로 낮춘다** (2026-08-27).
//   ⛔ 캠프 설계 체력은 SC 의 약 1/8 이다(레인저 5 vs SC 마린 40). 원본 `hpCost:10` 을 그대로 두면
//     `strikeSkillTick` 의 `u.hp <= sk.hpCost*2` 가 **늘 참**이라 광폭화가 영영 안 나간다
//     (실측 2026-08-27: 16분 동안 strikeSkillTick 5,139회 · 시전 0회).
//   ⚠ `SKILLS` 는 관리자 탭·오토배틀과 **공유**다 — 캠프에서만 바꾸고 나갈 때 되돌린다.
//   ⚠ 지금 hpCost 를 쓰는 스킬은 광폭화 하나뿐이지만, 표를 훑어 **전부** 바꾼다(새로 생겨도 따라온다).
const CAMP_SK_HP_K = 0.125;      // 캠프 체력 ÷ SC 체력 (설계표 레인저 5 ÷ SC 마린 40)
let _campSkHome = null;
function campPatchSkillCost(){
  if(_campSkHome || typeof SKILLS === 'undefined') return;
  _campSkHome = [];
  for(const k in SKILLS){ const sk = SKILLS[k];
    if(sk && sk.hpCost > 0){ _campSkHome.push([sk, sk.hpCost]);
      sk.hpCost = Math.max(0.1, sk.hpCost * CAMP_SK_HP_K); } } }
function campRestoreSkillCost(){
  if(!_campSkHome) return;
  for(const pair of _campSkHome) pair[0].hpCost = pair[1];
  _campSkHome = null; }
function campRestoreRefinery(){
  if(!_campRefHome) return;
  const h = _campRefHome; _campRefHome = null;
  if(h.had) h.b.research = h.had; else delete h.b.research; }
// 레벨 저장소는 **연구 칸**이다(연구 카드로 사므로 G.tech.research 에 쌓인다).
// ⚠ 옛 저장(`C.upg.refinery`)도 함께 본다 — 화면이 없던 시절 벤치·테스트가 그쪽에 썼다.
function campRefLv(){
  const T = (typeof G !== 'undefined') ? G.tech : null;
  const r = (T && T.research && (T.research[T.race + '_' + CAMP_REF_KEY] | 0)) || 0;
  return Math.max(r, campUpgLv('refinery')); }
function campHasRefinery(){
  if(typeof G === 'undefined' || !G.tech) return false;
  return (G.tech.ents || []).some(function(e){
    return e.type === 'bldg' && (e.bt || 0) <= 0 && !e._dead
        && ((typeof techGetBldg === 'function' ? (techGetBldg(G.tech.race, e.bk) || {}) : {}).gas); });
}
function campGasPerMin(){
  if(!campHasRefinery()) return 0;                // 정제소를 지어야 나온다
  return (CAMP_REF_BASE + CAMP_REF_STEP * campRefLv()) * campMineMul() * campRtMul('gasMul');
}
// ⚠ **campFrame 이 민다.** 프레임을 끄고 직접 미는 코드(벤치)는 이것도 같이 불러야 한다 —
//   안 부르면 가스가 영영 0 이고, 가스가 드는 유닛을 한 기도 못 산다(실측으로 겪었다).
function campGasTick(dt){
  if(typeof G === 'undefined' || !G.tech) return 0;
  const per = campGasPerMin(); if(per <= 0) return 0;
  const got = per / 60 * dt;
  G.tech.energy = (G.tech.energy || 0) + got;
  const C = campState(); if(C) C.earnGas = (C.earnGas || 0) + got;
  return got;
}
const CAMP_REB_K = 0.8, CAMP_REB_MIN = 0.2;      // 배수 = max(MIN, K × log10(난이도))
const CAMP_RP_DG = 1.35, CAMP_RP_RD = 1.012;     // 포인트 깊이 배수 — 던전 · 라운드

// 그 회차에 번 것 — 미네랄과 가스를 하나로 본다
function campWealth(){ const C = campState(); if(!C) return 0;
  return (C.earn || 0) + (C.earnGas || 0) * CAMP_GAS_RATE; }
function campCanRebirth(){ return campWealth() >= CAMP_REB_COST; }

// ① 획득 배수 — 기존 배수에 **더한다**(곱이 아니다). 로그라 난이도가 1만 배 올라도 +3.2 만 붙는다.
function campRebMulGain(){
  return Math.max(CAMP_REB_MIN, CAMP_REB_K * Math.log10(Math.max(1, campFoeDiff(campDgN(), campCleared())))); }
// ② 획득 포인트 — 기준량(번 재화) × 깊이 배수. 재화를 2배 벌어야 1.41배다.
function campRebPtGain(){
  const base = Math.sqrt(campWealth() / CAMP_REB_COST);
  return base * Math.pow(CAMP_RP_DG, Math.max(0, campDgN() - 1)) * Math.pow(CAMP_RP_RD, campCleared()); }
// 지금 환생 배수 — 터치와 일꾼 양쪽에 걸린다(campMineMul 과 같은 자리)
function campRebMul(){ const C = campState(); return 1 + ((C && C.rebMul) || 0); }

// 환생 실행. 남는 것: 종족 · 최고 기록 · 배수 · 포인트 · 트리.  그 밖은 전부 되감는다.
function campRebirth(){
  const C = campState(); if(!C || !campCanRebirth()) return null;
  const got = { mul: campRebMulGain(), pts: campRebPtGain(), dg: campDgN(), cleared: campCleared() };
  C.rebMul = (C.rebMul || 0) + got.mul;          // ⚠ 합이다 — 곱으로 두면 지수 축이 둘이 된다
  C.rbPts  = (C.rbPts  || 0) + got.pts;
  C.reb    = (C.reb | 0) + 1;
  // ── 되감기 ──
  C.dg = 0; C.cleared = 0;
  C.earn = 0; C.earnGas = 0;
  C.credit = 0; C.energy = 0;
  C.built = {}; C.addon = {}; C.units = {}; C.research = {};
  C.sup = 0; C.supCap = 0; C.eseq = 1; C.ents = []; C.minerals = [];
  C.upg = {};                                     // 캠프 업그레이드(탭·채취)도 한 회차짜리다
  C.rate = 0; C.leftAt = 0; C.tapped = 0;
  // ⛔ C.best · C.rebMul · C.rbPts · C.rbTree 는 지우지 않는다 — 그게 환생의 값이다
  //    ⚠ 다만 아래 campWipeBoard() 가 판을 새로 깔면서 **저장을 다시 읽을 수 있다** —
  //       그러면 방금 올린 값이 통째로 옛 저장으로 되돌아간다(스모크가 잡았다).
  //       그래서 남길 것을 손에 쥐고 있다가 비운 뒤 다시 얹는다.
  const keep = { race:C.race, best:C.best, rebMul:C.rebMul, rbPts:C.rbPts, reb:C.reb, rbTree:C.rbTree };
  campBattleClose(); campBarReset();
  // ⛔ **살아 있는 판(G.tech)도 같이 비운다.** campSave() 는 G.tech 를 C 로 복사하므로,
  //    저장 상태만 되감고 저장하면 **방금 지운 것이 그대로 되살아난다**(스모크가 잡았다).
  campWipeBoard();
  { const C2 = campState();          // 판을 다시 깔면서 저장을 읽었을 수 있다 — 남길 것을 다시 얹는다
    if(C2){ C2.race = keep.race; C2.best = keep.best; C2.rebMul = keep.rebMul;
      C2.rbPts = keep.rbPts; C2.reb = keep.reb; if(keep.rbTree) C2.rbTree = keep.rbTree;
      C2.dg = 0; C2.cleared = 0; C2.earn = 0; C2.earnGas = 0; C2.upg = {}; } }
  campSave();
  return got; }

// 살아 있는 건설 판을 새 판으로 되돌린다. 화면이 떠 있으면 다시 깔고, 아니면 비우기만 한다.
function campWipeBoard(){
  const C = campState(); if(!C || typeof G === 'undefined' || !G.tech) return false;
  if(typeof techUIInit === 'function' && C.race){
    techUIInit(campTechRace(C.race));               // 본부·일꾼만 있는 새 판
    G.tech.inf = false; G.tech.nocool = false;      // 관리자 치트는 꺼진 채로
    if(_campOn){ campLayBase(); campLayMinerals(); campLayGas(); campAutoGather(); }
    if(typeof techUIRender === 'function') techUIRender();
    return true; }
  const T = G.tech;                                  // 종족이 없으면(테스트 등) 비우기만
  T.credit = 0; T.energy = 0; T.built = {}; T.addon = {}; T.units = {}; T.research = {};
  T.sup = 0; T.supCap = 0; T.ents = []; T.minerals = [];
  return false; }

// ══ 🌳 환생 포인트 트리 (2026-08-25 · 6단계) ═══════════════════════════
//   설계 단일 소스: HUNT_R1.md §4-4(구조·비용) · §4-5(32계열 내용).
//   ⭐ 시작점 하나에서 사방 넷으로 퍼지는 마인드맵이다. 계열 하나가 티어 5곳에 등장하고,
//      **산 노드에 붙어 있는 것만** 살 수 있다(사슬).
//   ⛔ 비용 규칙을 여기 말고 다른 곳에 다시 적지 말 것 — campRtCost 하나가 단일 소스다.
const CAMP_RT_TIERS = 20;
const CAMP_RT_BASE = 2;                     // 시작점 노드 값 = 티어 1 기준값
const CAMP_RT_MUL = 4;                      // 티어당 기준값 배수
const CAMP_RT_GRADE = { 흔함:0.5, 보통:1, 귀함:3, 극상:10 };
// 등장 티어 묶음 — 갈래마다 묶음당 계열 2개 → 티어 하나에 노드 8개가 자동으로 맞는다
const CAMP_RT_GRP = { 가:[1,5,9,13,17], 나:[2,6,10,14,18], 다:[3,7,11,15,19], 라:[4,8,12,16,20] };
const CAMP_RT_MILE = { 가:5, 나:10, 다:15, 라:20 };   // 그 묶음의 귀함 계열이 극상이 되는 티어

// 효과 사다리 — HUNT_R1 §4-5. 배수형은 1~5차가 이 값(누적)이다.
const CAMP_RT_LADDER = [0, 1.5, 2.5, 5, 11, 25];

// 32계열. br=갈래 · grp=묶음 · gr=등급 · f=효과 종류(배선된 것만 아래에서 쓴다)
//   ⚠ 묶음마다 흔함4 · 보통3 · 귀함1 이어야 티어당 등급 구성이 맞는다(스모크가 검사).
const CAMP_RT_LINES = [
  // ── 갈래 ① 시작 도움 — 절대값이라 후반에는 저절로 희석된다
  {k:'tap',      br:'start', grp:'가', gr:'흔함', nm:'탭당 미네랄',    f:'tapAdd'},
  {k:'startMin', br:'start', grp:'가', gr:'보통', nm:'시작 미네랄',    f:'startMin'},
  {k:'startWk',  br:'start', grp:'나', gr:'흔함', nm:'시작 일꾼',      f:'startWorker'},
  {k:'startBld', br:'start', grp:'나', gr:'보통', nm:'시작 건물',      f:'startBldg'},
  {k:'earlyDc',  br:'start', grp:'다', gr:'흔함', nm:'초반 건물 할인', f:'earlyDisc'},
  {k:'startUp',  br:'start', grp:'다', gr:'보통', nm:'시작 업그레이드', f:'startUpg'},
  {k:'startUnit',br:'start', grp:'라', gr:'흔함', nm:'시작 유닛',      f:'startUnit'},
  {k:'skipRd',   br:'start', grp:'라', gr:'귀함', nm:'라운드 건너뛰기', f:'skipRound'},
  // ── 갈래 ② 재화 획득
  {k:'gather',   br:'econ',  grp:'가', gr:'흔함', nm:'일꾼 채취량',    f:'gatherMul'},
  {k:'gas',      br:'econ',  grp:'가', gr:'보통', nm:'가스 생산량',    f:'gasMul'},
  {k:'wkCap',    br:'econ',  grp:'나', gr:'흔함', nm:'일꾼 상한',      f:'workerCap'},
  {k:'mine',     br:'econ',  grp:'나', gr:'귀함', nm:'광산 등급',      f:'mineMul'},
  {k:'idle',     br:'econ',  grp:'다', gr:'흔함', nm:'방치 수급',      f:'awayMul'},
  {k:'dgRw',     br:'econ',  grp:'다', gr:'보통', nm:'던전 보상',      f:'dgRewardMul'},
  {k:'tapMul',   br:'econ',  grp:'라', gr:'흔함', nm:'탭 배수',        f:'tapMul'},
  {k:'gasEx',    br:'econ',  grp:'라', gr:'보통', nm:'가스 교환비',    f:'gasExMul'},
  // ── 갈래 ③ 아군 강화
  {k:'atk',      br:'army',  grp:'가', gr:'흔함', nm:'유닛 공격력',    f:'unitAtk'},
  {k:'hp',       br:'army',  grp:'가', gr:'보통', nm:'유닛 체력',      f:'unitHp'},
  {k:'prod',     br:'army',  grp:'나', gr:'흔함', nm:'생산 속도',      f:'prodMul'},
  {k:'sup',      br:'army',  grp:'나', gr:'보통', nm:'인구 상한',      f:'supAdd'},
  {k:'upCost',   br:'army',  grp:'다', gr:'흔함', nm:'업그레이드 비용', f:'upgDisc'},
  {k:'rebuild',  br:'army',  grp:'다', gr:'귀함', nm:'자동 재생산',    f:'autoRebuild'},
  {k:'bldg',     br:'army',  grp:'라', gr:'흔함', nm:'건물 강화',      f:'bldgMul'},
  {k:'skCd',     br:'army',  grp:'라', gr:'보통', nm:'스킬 쿨다운',    f:'skillCd'},
  // ── 갈래 ④ 적 약화 — ⚠ 상한이 있다. 다른 셋과 곱해지므로 반드시 막혀 있어야 한다
  {k:'foeHp',    br:'enemy', grp:'가', gr:'흔함', nm:'적 체력',        f:'cutHp'},
  {k:'foeN',     br:'enemy', grp:'가', gr:'귀함', nm:'적 마리 수',     f:'cutCount'},
  {k:'foeAtk',   br:'enemy', grp:'나', gr:'흔함', nm:'적 공격력',      f:'cutAtk'},
  {k:'foeRes',   br:'enemy', grp:'나', gr:'보통', nm:'적 부활 시간',   f:'cutRes'},
  {k:'foeSpd',   br:'enemy', grp:'다', gr:'흔함', nm:'적 이동 속도',   f:'cutSpd'},
  {k:'bossHp',   br:'enemy', grp:'다', gr:'보통', nm:'보스 체력',      f:'cutBoss'},
  {k:'foeRng',   br:'enemy', grp:'라', gr:'흔함', nm:'적 사거리',      f:'cutRng'},
  {k:'foeDelay', br:'enemy', grp:'라', gr:'보통', nm:'적 등장 지연',   f:'foeDelay'},
];
function campRtLine(k){ for(const L of CAMP_RT_LINES) if(L.k === k) return L; return null; }
// 계열의 n차 등장이 몇 티어인가 (n = 1~5)
function campRtTier(k, n){ const L = campRtLine(k); if(!L) return 0;
  return CAMP_RT_GRP[L.grp][Math.max(1, Math.min(5, n | 0)) - 1]; }
// 그 자리의 등급 — 귀함 계열은 자기 이정표 티어에서만 극상이 된다
function campRtGrade(k, n){ const L = campRtLine(k); if(!L) return '보통';
  return (L.gr === '귀함' && campRtTier(k, n) === CAMP_RT_MILE[L.grp]) ? '극상' : L.gr; }
// 노드 비용 = 티어 기준값 × 등급 배수
function campRtCost(k, n){ const t = campRtTier(k, n); if(!t) return Infinity;
  return CAMP_RT_BASE * Math.pow(CAMP_RT_MUL, t - 1) * CAMP_RT_GRADE[campRtGrade(k, n)]; }

// ── 보유 · 구매 ─────────────────────────────────────────────────────────
//   저장은 C.rbTree = { root:1, '<계열>':<몇 차까지 샀나> }
function campRtBag(){ const C = campState(); if(!C) return null;
  if(!C.rbTree || typeof C.rbTree !== 'object') C.rbTree = {};
  return C.rbTree; }
function campRtHas(k){ const b = campRtBag(); return b ? (b[k] | 0) : 0; }
function campRtRootOn(){ return campRtHas('root') > 0; }
// 다음으로 살 수 있는 차수 (없으면 0)
function campRtNext(k){ const n = campRtHas(k) + 1; return n <= 5 ? n : 0; }
// ⭐ 사슬 규칙 — 시작점 먼저, 그 다음은 그 계열의 앞 차수를 샀어야 한다
function campRtCanBuy(k){ const C = campState(); if(!C) return false;
  if(k === 'root') return !campRtRootOn() && (C.rbPts || 0) >= CAMP_RT_BASE;
  if(!campRtRootOn()) return false;
  const n = campRtNext(k); if(!n) return false;
  return (C.rbPts || 0) >= campRtCost(k, n); }
function campRtBuy(k){ const C = campState(); if(!C || !campRtCanBuy(k)) return 0;
  const b = campRtBag();
  const cost = (k === 'root') ? CAMP_RT_BASE : campRtCost(k, campRtNext(k));
  C.rbPts = (C.rbPts || 0) - cost;
  b[k] = (b[k] | 0) + 1;
  campSave(); return cost; }
// 초기화 — 산 것을 전부 물리고 포인트를 100% 돌려받는다. 비용은 젬(GEM.md §4).
function campRtReset(){ const C = campState(); if(!C) return 0;
  const b = campRtBag(); let back = 0;
  if(b.root) back += CAMP_RT_BASE;
  for(const L of CAMP_RT_LINES){ const n = b[L.k] | 0;
    for(let i = 1; i <= n; i++) back += campRtCost(L.k, i); }
  C.rbTree = {}; C.rbPts = (C.rbPts || 0) + back; campSave(); return back; }

// ── 효과 ────────────────────────────────────────────────────────────────
//   배수형 = 사다리 값(누적) · 감소형 = 계열마다 −40% 까지 수확 체감
const CAMP_RT_CUT_MAX = 0.40;          // 계열 하나가 깎을 수 있는 최대
const CAMP_RT_CUT_FLOOR = 0.20;        // ⭐ 갈래 전체 실효 하한 — 적이 1/5 밑으로는 안 내려간다
function campRtMul(k){ const n = campRtHas(k); return n > 0 ? CAMP_RT_LADDER[Math.min(5, n)] : 1; }
// ⛔ 공식으로 만들지 말 것 — 지수 감쇠는 5차에서 상한에 **정확히** 닿지 않는다(실측 −37.99%).
//    HUNT_R1 §4-5-4 의 표를 그대로 둔다: 5차가 딱 −40% 여야 「다 찍었다」가 성립한다.
const CAMP_RT_CUT = [0, 0.12, 0.25, 0.33, 0.38, CAMP_RT_CUT_MAX];
function campRtCut(k){ const n = campRtHas(k); return n <= 0 ? 0 : CAMP_RT_CUT[Math.min(5, n)]; }
// 적 약화 갈래의 실효 배수 — 곱한 뒤 하한으로 막는다. ⛔ 하한을 빼면 지수 축이 둘이 된다.
function campRtFoeMul(){ let m = 1;
  for(const L of CAMP_RT_LINES){ if(L.br !== 'enemy') continue; m *= (1 - campRtCut(L.k)); }
  return Math.max(CAMP_RT_CUT_FLOOR, m); }

// ══ 🌳 트리 화면 — 마인드맵 (2026-08-25 · 6단계-b) ═════════════════════
//   시작점이 가운데, 갈래 넷이 사방으로. 계열 하나가 바깥으로 5칸 사슬을 이룬다.
//   ⭐ 밀고(드래그) 확대(핀치)해서 본다 — 160노드를 세로 화면에 다 못 담기 때문이다.
//   ⛔ 좌표를 화면 픽셀로 잡지 말 것. **월드 좌표(SVG viewBox)** 로 두고 변환만 바꾼다 —
//      그래야 확대·이동이 노드 위치 계산과 섞이지 않는다.
//   갈래 색은 DESIGN.md §2 액센트 **역할표**에서 그대로 꺼냈다(재화=금 · 위험=적 · 정보=청 · 긍정=녹).
//   시안(--acc-sel)은 「지금 고른 노드」 전용으로 남긴다 — 화면당 한 곳 규칙.
const CAMP_TREE_BR = {
  enemy:{ a:-Math.PI/2, nm:'적 약화',    col:'#ff3b3b' },   // 위
  army: { a: Math.PI/2, nm:'아군 강화',  col:'#4aa8ff' },   // 아래
  start:{ a: Math.PI,   nm:'시작 도움',  col:'#5dff8f' },   // 왼쪽
  econ: { a: 0,         nm:'재화 획득',  col:'#ffd24a' },   // 오른쪽
};
const CAMP_TREE_SPREAD = 1.45;      // 갈래 하나가 벌어지는 각(rad) — 8계열이 이 안에 부챗살로 선다
const CAMP_TREE_R0 = 150, CAMP_TREE_RS = 86;   // 첫 칸까지 거리 · 칸 간격
//   ⚠ R0 을 줄이지 말 것 — 8계열의 1차가 한 자리에 모여 **링처럼** 보인다(부챗살 느낌이 죽는다)

// 계열 k 의 n차 노드가 월드 좌표 어디인가 (n=0 이면 시작점)
function campTreePos(k, n){
  if(!k || n <= 0) return { x:0, y:0 };
  const L = campRtLine(k); if(!L) return { x:0, y:0 };
  const B = CAMP_TREE_BR[L.br]; if(!B) return { x:0, y:0 };
  const idx = CAMP_RT_LINES.filter(x => x.br === L.br).indexOf(L);   // 갈래 안 0~7
  const a = B.a + (idx - 3.5) * (CAMP_TREE_SPREAD / 7);
  const r = CAMP_TREE_R0 + (n - 1) * CAMP_TREE_RS;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}
// 노드 상태 — 'own'(샀다) · 'buy'(살 수 있다) · 'next'(앞 칸을 사면 열린다) · 'lock'
function campTreeState(k, n){
  const have = campRtHas(k);
  if(n <= have) return 'own';
  if(n !== have + 1) return 'lock';
  if(!campRtRootOn()) return 'lock';
  const C = campState();
  return ((C && C.rbPts || 0) >= campRtCost(k, n)) ? 'buy' : 'next';
}

let _campTreeSel = null;            // 지금 고른 노드 'k:n' — 시안은 여기 한 곳만
let _campTreeView = { x:0, y:0, z:1 };
const CAMP_TREE_ZMIN = 0.35, CAMP_TREE_ZMAX = 2.2;

function campTreeSvg(){
  const rows = [];
  // ① 선 — 시작점→1차, n차→n+1차. 노드보다 먼저 그려야 뒤에 깔린다
  for(const L of CAMP_RT_LINES){ const B = CAMP_TREE_BR[L.br];
    for(let n = 1; n <= 5; n++){
      const a = campTreePos(L.k, n - 1), b = campTreePos(L.k, n);
      const on = campRtHas(L.k) >= n;
      rows.push('<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) +
        '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) +
        '" stroke="' + (on ? B.col : 'rgba(255,255,255,.10)') + '" stroke-width="' + (on ? 2.5 : 1.5) + '"/>'); } }
  // ② 갈래 이름 — 부챗살 바깥에
  for(const bk in CAMP_TREE_BR){ const B = CAMP_TREE_BR[bk];
    const r = CAMP_TREE_R0 + 2 * CAMP_TREE_RS;   // 사슬 중간 — 끝에 두면 기본 배율에서 화면 밖이다
    rows.push('<text x="' + (Math.cos(B.a) * r).toFixed(0) + '" y="' + (Math.sin(B.a) * r).toFixed(0) +
      '" class="ctBrNm" fill="' + B.col + '">' + B.nm + '</text>'); }
  // ③ 시작점
  const rootOn = campRtRootOn();
  rows.push('<circle cx="0" cy="0" r="30" class="ctRoot' + (rootOn ? ' on' : '') + '" data-k="root" data-n="0"/>');
  rows.push('<text x="0" y="4" class="ctRootTx">시작</text>');
  // ④ 노드
  for(const L of CAMP_RT_LINES){ const B = CAMP_TREE_BR[L.br];
    for(let n = 1; n <= 5; n++){
      const p = campTreePos(L.k, n), st = campTreeState(L.k, n);
      const gr = campRtGrade(L.k, n);
      const sel = (_campTreeSel === L.k + ':' + n);
      const r = (gr === '극상') ? 20 : (gr === '귀함' ? 17 : 14);
      rows.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r +
        '" class="ctN ct-' + st + (sel ? ' sel' : '') + '" style="--bc:' + B.col +
        '" data-k="' + L.k + '" data-n="' + n + '"/>');
      if(gr === '극상' || gr === '귀함')
        rows.push('<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 4).toFixed(1) + '" class="ctNm">' +
          (gr === '극상' ? '★' : '◆') + '</text>'); } }
  return rows.join('');
}
// ── 화면 열고 닫기 ──────────────────────────────────────────────────────
function campTreeOpen(){
  const el = document.getElementById('campTree'); if(!el) return;
  _campTreeSel = null; _campTreeView = { x:0, y:0, z:0.55 };   // 처음엔 전체가 보이게
  el.classList.add('on');
  campTreeRender(); campTreeBind();
}
function campTreeClose(){ const el = document.getElementById('campTree'); if(el) el.classList.remove('on'); }
function campTreeIsOn(){ const el = document.getElementById('campTree'); return !!(el && el.classList.contains('on')); }

// 다시 그리기 — SVG 통째로 갈고 아래 정보줄을 채운다
function campTreeRender(){
  const el = document.getElementById('campTree'); if(!el) return;
  const g = el.querySelector('#ctG'); if(g) g.innerHTML = campTreeSvg();
  campTreeApplyView();
  const C = campState();
  const pt = el.querySelector('.ctPts'); if(pt) pt.textContent = campNum(C ? (C.rbPts || 0) : 0);
  campTreeInfo();
}
// 큰 수 표기 — 재화 바와 같은 규칙이 있으면 그것을 쓴다
function campNum(n){ if(typeof fmtCur === 'function') return fmtCur(n);
  return Math.floor(n).toLocaleString('en-US'); }

// 고른 노드 설명 + 사기 버튼
function campTreeInfo(){
  const el = document.getElementById('campTree'); if(!el) return;
  const nm = el.querySelector('.ctInfoNm'), sub = el.querySelector('.ctInfoSub'), btn = el.querySelector('.ctBuy');
  if(!_campTreeSel){
    if(nm) nm.textContent = campRtRootOn() ? '노드를 고르세요' : '시작점부터 — 탭당 미네랄';
    if(sub) sub.textContent = campRtRootOn() ? '' : ('비용 ' + campNum(CAMP_RT_BASE) + ' 포인트');
    if(btn){ btn.textContent = campRtRootOn() ? '고르기' : '시작점 사기';
      btn.disabled = campRtRootOn() || !campRtCanBuy('root');
      btn.dataset.k = 'root'; btn.dataset.n = '0'; }
    return; }
  const [k, ns] = _campTreeSel.split(':'); const n = +ns;
  const L = campRtLine(k); if(!L) return;
  const st = campTreeState(k, n), cost = campRtCost(k, n), gr = campRtGrade(k, n);
  if(nm) nm.textContent = L.nm + ' ' + n + '차';
  if(sub) sub.textContent = CAMP_TREE_BR[L.br].nm + ' · ' + gr + ' · T' + campRtTier(k, n) +
    ' · 비용 ' + campNum(cost);
  if(btn){ btn.dataset.k = k; btn.dataset.n = String(n);
    btn.textContent = st === 'own' ? '보유' : (st === 'buy' ? '사기' : (st === 'next' ? '포인트 부족' : '잠김'));
    btn.disabled = (st !== 'buy'); }
}
function campTreeApplyView(){
  const g = document.getElementById('ctG'); if(!g) return;
  const v = _campTreeView;
  g.setAttribute('transform', 'translate(' + v.x.toFixed(1) + ' ' + v.y.toFixed(1) + ') scale(' + v.z.toFixed(3) + ')');
}
// 노드를 누르면 고르고, 이미 고른 것을 다시 누르면 산다(두 번 누르기 = 구매)
function campTreeTap(k, n){
  const key = k + ':' + n;
  if(k === 'root'){ if(!campRtRootOn() && campRtCanBuy('root')){ campRtBuy('root'); campTreeRender(); } 
    _campTreeSel = null; campTreeInfo(); return; }
  if(_campTreeSel === key && campTreeState(k, n) === 'buy'){ campTreeBuySel(); return; }
  _campTreeSel = key; campTreeRender();
}
function campTreeBuySel(){
  const el = document.getElementById('campTree'); if(!el) return;
  const btn = el.querySelector('.ctBuy'); if(!btn || btn.disabled) return;
  const k = btn.dataset.k, n = +btn.dataset.n;
  if(k === 'root'){ campRtBuy('root'); }
  else { if(campTreeState(k, n) !== 'buy') return; campRtBuy(k); }
  if(typeof playSfx === 'function') playSfx('upgrade');
  campTreeRender();
}

// ── 밀고 확대 ───────────────────────────────────────────────────────────
//   ⛔ 캠프 맵의 팬·줌(campPatchZoom)을 빌리지 말 것 — 그건 건설 격자 좌표계에 묶여 있다.
//   여기는 SVG viewBox 하나뿐이라 훨씬 단순하다.
let _ctBound = false, _ctPtrs = new Map(), _ctDrag = null, _ctPinch = null, _ctMoved = 0;
function campTreeBind(){
  const el = document.getElementById('campTree'); if(!el || _ctBound) return;
  const svg = el.querySelector('#ctSvg'); if(!svg) return;
  _ctBound = true;
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId); _ctPtrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
    _ctMoved = 0;
    if(_ctPtrs.size === 1) _ctDrag = { x:e.clientX, y:e.clientY, vx:_campTreeView.x, vy:_campTreeView.y };
    else if(_ctPtrs.size === 2){ _ctDrag = null; _ctPinch = campTreePinch(); }
  });
  svg.addEventListener('pointermove', e => {
    if(!_ctPtrs.has(e.pointerId)) return;
    _ctPtrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(_ctPinch && _ctPtrs.size === 2){ const now = campTreePinch();
      if(now && _ctPinch.d > 0){ const z = _campTreeView.z * (now.d / _ctPinch.d);
        _campTreeView.z = Math.max(CAMP_TREE_ZMIN, Math.min(CAMP_TREE_ZMAX, z)); _ctPinch = now; campTreeApplyView(); }
      return; }
    if(_ctDrag){ const dx = e.clientX - _ctDrag.x, dy = e.clientY - _ctDrag.y;
      _ctMoved = Math.max(_ctMoved, Math.abs(dx) + Math.abs(dy));
      _campTreeView.x = _ctDrag.vx + dx; _campTreeView.y = _ctDrag.vy + dy; campTreeApplyView(); }
  });
  const up = e => { _ctPtrs.delete(e.pointerId); if(_ctPtrs.size < 2) _ctPinch = null; if(!_ctPtrs.size) _ctDrag = null; };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  // ⚠ 밀고 나서 손을 뗄 때 노드가 눌리면 안 된다 — 움직인 거리로 가른다
  svg.addEventListener('click', e => {
    if(_ctMoved > 8) return;
    const t = e.target.closest && e.target.closest('[data-k]'); if(!t) return;
    campTreeTap(t.dataset.k, +t.dataset.n);
  });
  el.querySelector('.ctBuy')?.addEventListener('click', campTreeBuySel);
  el.querySelector('.ctX')?.addEventListener('click', campTreeClose);
}
function campTreePinch(){ const a = [..._ctPtrs.values()]; if(a.length < 2) return null;
  return { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; }

// ══ ⚔ 던전 전투 (2026-08-25 · 2단계) ═══════════════════════════════════
//   ⭐ **전투를 새로 짜지 않는다 — 오토배틀(18-strike.js)의 것을 빌린다.**
//      유닛 스탯·상성·스킬·표적 선정·회피가 거기 다 있다. 새로 짜면 두 벌이 되어 언젠가 갈라진다.
//      빌리는 방법은 사냥터의 hbWith() 와 같다: 전역 STK 를 캠프 것으로 바꿔 끼우고 부른다.
//
//   ⛔ 18-strike.js 를 고치지 말 것 — 오토배틀 본체와 공유한다.
//   ⚠ STK 는 14-input-fx.js 의 `let STK=null` 이다(바꿔 끼울 수 있다). const 로 바꾸지 말 것.
let CAMPB = null;               // 캠프 전투 상태 — strikeNewState() 모양 그대로
let _campStkPrev = null;
function campWithStk(fn){
  if(!CAMPB || typeof STK === 'undefined') return null;
  const prev = STK; STK = CAMPB;
  try { return fn(CAMPB); } finally { STK = prev; }
}

// 적 종족 — 단계마다 돌아가며 나온다(1단계부터. 0단계=캠프에는 적이 없다)
function campFoeRace(dg){ const o = (typeof STK_RACE_ORDER !== 'undefined') ? STK_RACE_ORDER : ['terran'];
  return o[Math.max(0, (dg | 0) - 1) % o.length]; }

// ══ 📈 적 난이도 곡선 — HUNT_R1.md §6-1 (2026-08-25 · 4단계) ══════════
//   라운드 밑   = 1.07 + (던전-1) × 0.003          ← 깊을수록 라운드가 무겁다
//   던전 문턱   = (앞 던전 라운드 밑)^49 × 3        ← 어느 던전에서나 ×3
//   적 난이도   = Π(던전 문턱) × (라운드 밑)^(깬 라운드 수)
//   ⛔ 미네랄(CAMP_MINE)과 **같은 식으로 묶지 말 것.** 보상은 라운드마다 조금, 난이도는 크게 —
//      둘을 묶으면 50라운드를 돌아도 적이 1.33배인데 아군 화력은 20배가 된다(HUNT_R1 §6-1).
const CAMP_RB0 = 1.07, CAMP_RB_STEP = 0.003, CAMP_DG_STEP = 3;
function campRBase(dg){ return CAMP_RB0 + Math.max(0, (dg | 0) - 1) * CAMP_RB_STEP; }
function campDgThreshold(dg){ return Math.pow(campRBase(dg - 1), CAMP_ROUND_MAX - 1) * CAMP_DG_STEP; }
// dg=0(캠프)은 적이 없으므로 1을 준다
function campFoeDiff(dg, cleared){ dg = dg | 0; if(dg <= 0) return 1;
  let x = 1; for(let k = 2; k <= dg; k++) x *= campDgThreshold(k);
  return x * Math.pow(campRBase(dg), Math.max(0, cleared | 0)); }

// ── 웨이브 — 총량은 난이도가 정하고, 몇 마리로 쪼갤지는 라운드가 정한다 (HUNT_R1 §6-2-1) ──
//   기본값: 체력 40 · 공격 0.33. 여기에 난이도가 곱해진 것이 **그 라운드의 총 유입량**이다.
// ⭐ 체력 3.3 → 40 → **1,300** (2026-08-28 확정, HUNT_R1 §6-2).
//   40 은 「아군 9기 · DPS 5.7」 을 전제로 잡은 값인데, 실측 아군 DPS 가 **190~226** 이라
//   라운드가 목표(2~4분)의 30분의 1로 끝났다. 실측 DPS 205 로 역산한 값이 1,300 이다.
//   ⭐ 아군 화력이 진동해도(163~226) R50 이 **2.6~3.7분**이라 목표 범위를 안 벗어난다.
//   라운드별 예상: R1 6초 · R10 12초 · R25 32초 · R40 89초 · R50 175초.
// ⚠ **공격(0.33)은 같이 올리지 않는다.** 체력은 「얼마나 오래 싸우나」, 공격은 「얼마나 위험한가」다.
//   라운드 길이는 체력만으로 늘고, 공격까지 32배면 본부(체력 150)가 몇 초에 부서진다.
const CAMP_FOE_HP0 = 1300, CAMP_FOE_ATK0 = 0.33;
const CAMP_FOE_N0 = 3, CAMP_FOE_NR = 1.10, CAMP_FOE_NMAX = 100;
function campFoeCount(round){
  const n = CAMP_FOE_N0 * Math.pow(CAMP_FOE_NR, Math.max(0, (round | 0) - 1));
  // 🌳 트리 「적 마리 수」 — 총 유입량은 그대로고 **나누는 수만** 준다(개체가 두꺼워진다)
  const cut = (typeof campRtCut === 'function') ? (1 - campRtCut('foeN')) : 1;
  return Math.max(1, Math.min(CAMP_FOE_NMAX, Math.round(n * cut))); }

// 전장을 연다. 적은 **위**에서 내려오고 내 본부는 **아래** — 캠프 배치와 같은 방향이다.
function campBattleOpen(){
  if(typeof strikeNewState !== 'function') return null;
  const C = campState(); if(!C) return null;
  const S = strikeNewState(); const W = S.world;
  // ⭐ **캠프 전장이라는 표식.** 오토배틀의 승패 처리(strikeCheckOver)가 이걸 보고 빠진다 —
  //    없으면 적 본진을 부순 순간 「오토배틀 승리」 결과창이 뜨고 자동 진행이 로비까지 가서
  //    G 를 새로 만들어 캠프 판을 통째로 날린다(실측으로 잡았다).
  S.camp = true;
  S.me.race = C.race || 'terran';
  S.ai.race = campFoeRace(campDgN());
  S.me.base.x = W * 0.5; S.me.base.y = W * 0.86;      // 아래 = 내 본부
  S.ai.base.x = W * 0.5; S.ai.base.y = W * 0.14;      // 위 = 적이 오는 쪽
  // 캠프에는 2차·중앙 신전이 없다
  S.me.sec.dead = true; S.ai.sec.dead = true; S.central.dead = true;
  // ⛔ **적 본부도 없다.** 캠프의 라운드는 「적 유닛을 다 잡으면 끝」이고 부술 적 기지가 없다.
  //   살려 두면 내 병력이 그걸 때리러 **적 진영까지 올라가** 버리고, 그 사이 적은 반대 방향으로
  //   내 건물을 치러 내려온다 — 둘이 엇갈려 영원히 안 만난다.
  //   실측(2026-08-27): 아군 y≈980 · 적 y≈2500 · 사거리 88 → D1R24 에서 라운드가 멈췄다.
  //   (적 본부 HP 가 -7298 이었다. 이미 부순 것을 계속 붙잡고 있었다.)
  // ⚠ 위치는 남겨 둔다 — 적 유닛이 그 자리에서 스폰된다.
  S.ai.base.dead = true; S.ai.base.hp = 0;
  S.me.units.length = 0; S.ai.units.length = 0;
  // 🌳 「건물 강화」 — 내 건물 전체의 체력에 얹는다(HUNT_R1 §4-5-3)
  { const bm = campRtMul('bldg');
    if(bm !== 1){ S.me.base.maxHp = (S.me.base.maxHp || S.me.base.hp) * bm; S.me.base.hp = S.me.base.maxHp; } }
  CAMPB = S;
  campBuildStructs();                                  // 🏢 기지의 건물들을 전장에 올린다
  return S;
}
function campBattleClose(){ CAMPB = null; }

// ══ 🏢 기지 건물을 전장에 올린다 (2026-08-27) ═══════════════════════════
// **패배 = 내 건물이 전부 부서지는 것**이다. 예전에는 전장에 본부 하나뿐이라
// 병영·보급소를 적이 때릴 수도 없었다(그 하나가 모든 건물을 대표했다).
//
// ⛔ 18-strike.js 를 고치지 않는다. 적이 무엇을 때릴지는 strikeFrontStruct() 가 정하는데,
//   그 함수가 고르는 것은 중립 → 적 2차 → 적 본진 **셋뿐**이다. 캠프는 그 함수를 감싸
//   **가장 앞(적에 가까운) 내 건물**을 대신 돌려준다. 구조물에 필요한 것은 {x,y,hp,max,dead} 뿐이라
//   캠프 건물로 그 모양을 만들어 주면 사거리·피해 처리가 그대로 돈다.
//
// ⚠ 부서진 건물은 **그 판에서만** 부서진다 — 캠프로 돌아오면 그대로 있다.
//   유닛 부활과 같은 철학이다(대가는 비용이 아니라 시간 · HUNT_R1 §5-4).
// ⚠ **설계 스케일**(§3-1 의 1/10 체계)에 맞춘 값이다 — 유닛 체력이 4~47 이고 공격이 1~31 인
//   판에서 1200 을 두면 아군 하나가 건물을 부수는 데 수백 초가 걸린다(전에 그 값이었다).
//   전함(체력 47)의 25배 = 한 채를 레인저(공격 1) 넷이 5분쯤 두드리는 크기다.
//   ⛔ 설계표(§6-6 본부 체력)가 나오면 그 값으로 바꿀 것 — 지금은 잠정이다.
const CAMP_BLD_HP = 1200 / 10;     // 건물 한 채의 기본 체력(본부는 전장 기본값을 쓴다)
function campBuildStructs(){
  if(!CAMPB || typeof G === 'undefined' || !G.tech) return 0;
  const W = CAMPB.world, bm = campRtMul('bldg');
  const x0 = TECH_GRID.x0, x1 = TECH_GRID.x1, y0 = techY0(), y1 = techY1();
  const sx = function(wx){ return W * (0.15 + (wx - x0) / Math.max(1e-6, x1 - x0) * 0.70); };
  const sy = function(wy){ return W * (0.62 + (wy - y0) / Math.max(1e-6, y1 - y0) * 0.30); };
  const mainK = (TECH_TREE[G.tech.race] && TECH_TREE[G.tech.race].buildings[0] || {}).k;
  const out = [];
  for(const e of (G.tech.ents || [])){
    if(e.type !== 'bldg' || (e.bt || 0) > 0) continue;          // 짓는 중인 건물은 아직 없다
    const isMain = (e.bk === mainK);
    const hp = Math.round((isMain ? (CAMPB.me.base.maxHp || CAMPB.me.base.hp) : CAMP_BLD_HP) * (isMain ? 1 : bm));
    if(isMain){ CAMPB.me.base.x = sx(e.x); CAMPB.me.base.y = sy(e.y); CAMPB.me.base.eid = e.eid; out.push(CAMPB.me.base); continue; }
    out.push({ x:sx(e.x), y:sy(e.y), hp:hp, max:hp, maxHp:hp, dead:false, eid:e.eid, bk:e.bk });
  }
  CAMPB._bld = out;
  return out.length;
}
// 살아 있는 내 건물들 — 패배 판정과 표적 선택이 같은 목록을 본다(단일 소스)
function campBldAlive(){
  if(!CAMPB || !CAMPB._bld) return [];
  return CAMPB._bld.filter(function(b){ return b && !b.dead && (b.hp || 0) > 0; });
}
// 적에게 **가장 가까운** 내 건물 — 적은 위에서 내려오므로 y 가 작은 것이 앞이다
function campFrontBld(){
  const live = campBldAlive();
  if(!live.length) return null;
  let best = live[0];
  for(const b of live) if(b.y < best.y) best = b;
  return best;
}
// 🛡 **아군 집결점 — 캠프는 방어전이다.** 내 병력은 진격하지 않고 건물 앞에 서서 적을 기다린다.
//   ⚠ 그냥 「목표 없음」으로 둘 수는 없다. strikeFrontStruct 가 돌려준 구조물이 dead 여도
//     **이동은 막히지 않아서**(18-strike.js:1277~ _toTemple 분기에 dead 검사가 없다) 아군이
//     죽은 적 본부 자리까지 행군해 버린다 — 실측: 아군 y≈500 · 적 y≈2558 로 1764 떨어져
//     서로 못 만나고 라운드가 멈췄다.
//   ⭐ 그래서 **내 건물 앞의 더미 구조물**을 목표로 준다. 아군은 거기 닿으면 멈추고(사거리 안),
//     적이 오면 그때 적을 표적으로 잡는다(_toTemple 은 적 표적이 없을 때만 탄다).
//   ⚠ 체력을 거대하게 둔다 — 아군이 때려도 안 부서져야 집결점이 사라지지 않는다.
function campRallyPoint(){
  if(!CAMPB) return null;
  const W = CAMPB.world;
  if(!CAMPB._rally) CAMPB._rally = { x:W * 0.5, y:W * 0.72, hp:1e18, max:1e18, maxHp:1e18, dead:false, _rally:true };
  const r = CAMPB._rally;
  const live = campBldAlive();
  if(live.length){                                   // 가장 앞(적 쪽) 건물보다 조금 앞에 선다
    let f = live[0];
    for(const b of live) if(b.y < f.y) f = b;
    r.x = f.x; r.y = Math.max(W * 0.55, f.y - W * 0.06);
  }
  r.hp = r.max = r.maxHp = 1e18; r.dead = false;      // 아군 오사로 부서지지 않게 되돌린다
  return r;
}
// ⛔ strikeFrontStruct 를 감싼다 — 적이 내 건물을 때릴 수 있게 하는 유일한 입구다.
//   ⚠ side 는 **때리는 쪽**이다(원본: foe = S[side==='me'?'ai':'me']). 적이 칠 때만 바꿔 준다.
let _campFrontPatched = null;
function campPatchFront(){
  if(_campFrontPatched || typeof window === 'undefined') return;
  const o = window.strikeFrontStruct; if(typeof o !== 'function') return;
  _campFrontPatched = o;
  window.strikeFrontStruct = function(side){
    if(_campOn && CAMPB){
      if(side === 'ai'){ const b = campFrontBld(); if(b) return b; }   // 적 → 내 건물(앞쪽부터)
      if(side === 'me'){ const r = campRallyPoint(); if(r) return r; } // 아군 → 집결점(진격하지 않는다)
    }
    return o.apply(this, arguments);
  };
}
function campUnpatchFront(){
  if(!_campFrontPatched) return;
  window.strikeFrontStruct = _campFrontPatched; _campFrontPatched = null;
}

// ══ 🎨 전투 렌더 (2026-08-25 · A안) — 기지 맵 **위쪽 레인**에 겹쳐 그린다 ══════
//   화면을 바꾸지 않는다. 적은 격자 위끝에서 내려오고 내 병력이 맞으러 올라간다.
//   ⛔ 공유 코드를 고치지 않는다(renderBuildTab · 18-strike · 16/17-build).
//     캠프 프레임 동안만 M3D.sync 를 감싸 **기지 리스트 뒤에 전투 유닛을 덧붙여** 통과시킨다 —
//     campWithStk 가 전역 STK 를 바꿔 끼우는 것과 같은 관용구다.
//   ⭐ 캔버스도 sync 호출도 **프레임당 하나** 그대로다. 두 번 부르면 뒤엣것이 앞엣것을 지운다.
const CAMP_LANE_TOP = 0.18;   // 격자 위끝 = 적이 나타나는 줄(techY0 와 같은 값)
const CAMP_LANE_BOT = 0.62;   // 본부(y≈0.642) 바로 위 = 내 병력이 맞으러 가는 끝
const CAMP_LANE_W   = 0.88;   // 레인 가로 폭 = 격자 폭(x0 0.06 ~ x1 0.94)

// 전장 월드 → 격자 월드비율. 전장 세로축(적 W*0.14 ↔ 내 본부 W*0.86)을 레인에 선형 대응한다.
function campW2G(sx, sy, W){
  const t = Math.max(0, Math.min(1, ((sy / W) - 0.14) / 0.72));   // 0=적(위) · 1=나(아래)
  return { gx: 0.5 + ((sx / W) - 0.5) * CAMP_LANE_W,
           gy: CAMP_LANE_TOP + t * (CAMP_LANE_BOT - CAMP_LANE_TOP) }; }

// 전투 유닛 → 기지 유닛과 **같은 규약**의 렌더 엔트리(scl·yoff·yawFix·z 를 맞춘다).
//   ⚠ _cellK·_zOf 는 renderBuildTab 안의 지역값이라 못 쓴다 — 공개 헬퍼로 똑같이 다시 구한다.
function campBattleList(){
  if(!CAMPB || campDgN() <= 0) return [];
  const W = CAMPB.world || 1, v = (G.tech && G.tech.view) || { x:0.5, y:0.5, zoom:1 };
  const cellK = _techCW() / ((TECH_GRID.x1 - TECH_GRID.x0) / TECH_GRID.cols);
  const rows = Math.max(1, _techRows()), zstep = Math.min(60, 2600 / (rows + 1));
  const scl = ((typeof TECH_USCALE !== 'undefined') ? TECH_USCALE : 1)
            * ((typeof TECH_UVIS   !== 'undefined') ? TECH_UVIS   : 1) * cellK;
  const yoff = (typeof TECH_UNIT_YOFF !== 'undefined') ? TECH_UNIT_YOFF : 6;
  const out = [];
  for(const side of ['me', 'ai']){
    for(const u of CAMPB[side].units){
      if(u.dead) continue;
      const g = campW2G(u.x, u.y, W);
      const x = (g.gx - v.x) * v.zoom + 0.5, y = (g.gy - v.y) * v.zoom + 0.5;
      if(x < -0.2 || x > 1.2 || y < -0.2 || y > 1.2) continue;   // ⚡ 화면 밖은 넘기지 않는다(오토배틀 STK_CULL 과 같은 뜻)
      out.push({ uid:'cb_' + side + '_' + u.uid, id:u.id, x:x, y:y,
        face:(u.face || 0), moving:!!u.moving, yoff:yoff, yawFix:true, scl:scl,
        fireSeq:(u.fireSeq || 0), selCol:(side === 'ai') ? 0xff5c5c : undefined,
        z: -1000 + (Math.floor((g.gy - techY0()) / _techCH()) + 0.5) * zstep }); } }
  return out; }

// 기지 렌더를 감싼다 — 그 안에서 renderBuildTab 이 부르는 M3D.sync 에 전투 유닛을 얹는다.
//   ⚠ finally 로 반드시 되돌린다. 안 되돌리면 관리자 탭·오토배틀이 캠프 유닛을 달고 다닌다.
function campWithBattleDraw(fn){
  const M = window.M3D;
  if(!M || typeof M.syncBuild !== 'function' || !CAMPB || campDgN() <= 0) return fn();
  const orig = M.syncBuild;   // ⚠ 건설 맵은 sync 가 아니라 **syncBuild** 다(14-input-fx.js:950)
  M.syncBuild = function(list){
    try{ const add = campBattleList();
      if(add.length && Array.isArray(list)) for(const e of add) list.push(e); }catch(_e){}
    return orig.apply(M, arguments); };
  try{ return fn(); } finally { M.syncBuild = orig; } }

// 내 병력 출격 — 건설지(G.tech.ents)의 완성 유닛을 전장으로 옮긴다.
//   ⭐ 이 다리는 오토배틀이 이미 갖고 있다(strikeSpawnForPlayer). 그대로 부른다.
// 병력을 전장에 내보낸다.
// ⛔ **라운드마다 부르지 말 것.** strikeSpawnForPlayer 는 건물 하나당 유닛을 새로 만드는데
//   (18-strike.js:1091 — techBldgCount 만큼), 건물은 그대로 있으므로 **부를 때마다 증식**한다.
//   실측(2026-08-27): 라운드 갭마다 불렀더니 던전 1 R50 에 병력 **623기 · DPS 12,415** 였다
//   (인구 상한 200 을 훨씬 넘는다). 그 화력이면 적이 무슨 체력이든 즉사해서
//   난이도 곡선이 아무 브레이크도 못 건다.
// ⭐ 그래서 **전장이 비었을 때만** 부른다 — 첫 진입과 던전 전환이 그 자리다.
//   라운드 사이에는 부활(campReviveStep)이 병력을 유지하므로 보충이 필요 없다.
function campSortie(){ if(!CAMPB || typeof strikeSpawnForPlayer !== 'function') return 0;
  const b4 = CAMPB.me.units.length;
  const n = campWithStk(() => strikeSpawnForPlayer('me', { local:true, noEmit:true })) | 0;   // ⛔ 건물당 공짜 배출 금지(값을 내고 산 병력만)
  campScaleAllies(CAMPB.me.units.slice(b4));   // 🌳 아군 강화 — 새로 나온 것만
  campTrimArmy();                              // 👥 인구 상한을 전장에도 건다(아래 설명)
  return n; }
// 👥 **전장 병력도 인구 상한을 지킨다.**
// ⚠ 전장 자체에는 제한이 없다 — STK_UNIT_CAP 이 0(무제한)이다(18-strike.js:504).
//   캠프의 인구 200 은 **생산** 제한이라, 전장으로 나간 뒤에는 아무도 안 막는다.
//   실측(2026-08-27): 던전 1 을 20기로 잘 돌다가 던전 2 로 넘어가며 **292기**가 됐다 —
//   전환 때마다 strikeSpawnForPlayer 가 건물 수만큼 새로 만들고, 캠프에 쌓여 있던
//   대기 병력(126기)까지 한꺼번에 쏟아져 들어간다.
// ⛔ 여기를 안 막으면 적 체력을 아무리 올려도 병력 수로 뭉갠다(623기 때와 같은 일이다).
function campTrimArmy(){
  if(!CAMPB || typeof G === 'undefined' || !G.tech) return 0;
  const cap = Math.max(1, Math.min(200, G.tech.supCap || 200));
  const live = CAMPB.me.units, down = (CAMPB._down || []).length;
  const over = live.length + down - cap;
  if(over <= 0) return 0;
  live.splice(cap - down < 0 ? 0 : cap - down);   // 뒤(가장 최근에 나온 것)부터 걷는다
  return over;
}

// ⛔ **공중 전용 적은 뽑지 않는다.** hellfire·stinger·venom 은 SB_ATK_MODE 가 'air' 라
//   지상 아군을 한 대도 못 때린다 — 그리고 지상만 있는 편성은 그 적을 못 때린다.
//   실측(2026-08-27): 던전 1 R12 에서 hellfire 하나가 남아 **라운드가 영원히 안 끝났다**
//   (아군 화력병 20기 전부 gnd 전용). 적 본부는 이미 부쉈는데 게임이 멈췄다.
// ⚠ 공중 유닛 자체는 남긴다 — skyguard·dreadnought·medusa 는 공중이면서 지상을 친다.
//   전부 빼면 대공이라는 축이 사라진다(HUNT_R1 §6-2-0).
// ── 🎖 적 티어 구성 (HUNT_R1 §6-2-0 · 2026-08-28) ────────────────────────
// ⛔ **뽑기로 섞으면 라운드 시간이 20배까지 흔들린다.** 실측(2026-08-27): 같은 구간에서
//   2.6초와 59.7초가 섞여 나왔다. 평균을 어디에 두든 그 위에서는 어떤 목표도 못 지킨다.
//   그래서 라운드 구간마다 **어느 티어가 몇 %인지**를 못 박는다.
// ⚠ 유니온·스웜은 §6-2-0 표 그대로다. **에테리얼·페럴·콜로서스는 설계표가 없어
//   내가 나눈 것이다**(가격·역할 순) — 표가 나오면 바꿀 것.
const CAMP_FOE_TIER = {
  terran:   { t1:['ghost','marine','machinegun'], t2:['racer','goliath','tank'], t3:['skyguard','dreadnought'] },
  zerg:     { t1:['broodling','snapper'], t2:['hydra','thornqueen'], t3:['medusa','matron','ultralisk'] },
  protoss:  { t1:['blade','dark_templar'], t2:['dragoon','archon','falcon'], t3:['skydancer','kronos','archangel'] },
  feral:    { t1:['wolfrunner','thornspitter','clawfighter'], t2:['hornedcharger','howlslinger','stalkercat','venomfang'], t3:['alphawolf','wyvernrider','skytalon','stormroc'] },
  colossus: { t1:['gunner','guardwalker'], t2:['twincannon','flakbattery','railgun'], t3:['arclight','siegecolossus','skylance'] } };
// 라운드 구간별 티어 비율 — [최대라운드, t1, t2, t3]
const CAMP_FOE_MIX = [[10, 100, 0, 0], [25, 60, 40, 0], [40, 25, 50, 25], [Infinity, 0, 40, 60]];
function campFoeMix(r){
  for(const row of CAMP_FOE_MIX) if(r <= row[0]) return row;
  return CAMP_FOE_MIX[CAMP_FOE_MIX.length - 1];
}
// ⛔ **공중 전용은 적 풀에서 뺀다**(hellfire · stinger · venom — SB_ATK_MODE 가 'air').
//   아군 지상군을 한 대도 못 때려서, 하나만 남아도 라운드가 영원히 안 끝난다(실측 R12).
function campFoePool(ids){
  const mode = (typeof SB_ATK_MODE !== 'undefined') ? SB_ATK_MODE : {};
  return (ids || []).filter(function(id){ return (mode[id] || 'both') !== 'air'; });
}
// 이 id 가 몇 티어인가 — 없으면 0. (구성이 실제로 지켜지는지 재는 데 쓴다)
function campFoeTierOf(id){
  if(!id || !CAMPB) return 0;
  const T = CAMP_FOE_TIER[CAMPB.ai.race] || CAMP_FOE_TIER.terran;
  if(T.t1.indexOf(id) >= 0) return 1;
  if(T.t2.indexOf(id) >= 0) return 2;
  if(T.t3.indexOf(id) >= 0) return 3;
  return 0;
}
function campFoeId(){
  if(typeof STK_RACES === 'undefined' || !CAMPB) return null;
  const race = CAMPB.ai.race;
  const all = ((STK_RACES[race] || STK_RACES.terran).units) || [];
  if(!all.length) return null;
  const T = CAMP_FOE_TIER[race] || CAMP_FOE_TIER.terran;
  const mix = campFoeMix(campRoundN());
  // 비율대로 티어를 고르고, 그 티어가 비었으면 아래 티어로 내려간다(초반에 T3 만 있는 종족 대비)
  const tiers = [campFoePool(T.t1), campFoePool(T.t2), campFoePool(T.t3)];
  let roll = Math.random() * 100, pick = -1;
  for(let i = 0; i < 3; i++){ roll -= mix[i + 1]; if(roll < 0){ pick = i; break; } }
  if(pick < 0) pick = 2;
  for(let i = pick; i >= 0; i--) if(tiers[i].length) return tiers[i][(Math.random() * tiers[i].length) | 0];
  for(let i = pick + 1; i < 3; i++) if(tiers[i].length) return tiers[i][(Math.random() * tiers[i].length) | 0];
  const fb = campFoePool(all);                    // 티어표에 없는 종족 — 예전처럼 통째로 뽑는다
  return (fb.length ? fb : all)[(Math.random() * (fb.length ? fb.length : all.length)) | 0];
}
// 지금 있는 적을 내 병력이 때릴 수 있나 — 하나도 못 때리면 그 판은 끝이 없다.
// ⚠ 누운(부활 대기) 병력도 센다 — 곧 일어나므로 성급하게 지면 안 된다.
function campCanHitFoes(){
  if(!CAMPB) return true;
  const foes = CAMPB.ai.units.filter(function(u){ return !u.dead; });
  if(!foes.length) return true;
  // ⭐ **전투가 쓰는 값을 그대로 쓴다.** 별도 표를 따로 읽으면 어긋난다 —
  //   실측(2026-08-27): 적이 dreadnought(공중) 하나, 아군이 화력병 20기(지상 전용)인데
  //   판정만 "때릴 수 있다"고 나와 패배가 안 걸리고 라운드가 멈췄다.
  //   전투(18-strike.js:1196~1197)는 이 둘을 쓴다:
  //     공격 가능 레이어 = u._atk (= _sbAtkMode({id, gmodel}))
  //     대상이 공중인가 = FXLAB_AIR.has(o.gm || o.id)      ← **gm 우선**, OR 가 아니다
  const isAir = function(o){
    const k = o.gm || o.id;
    return (typeof FXLAB_AIR !== 'undefined') && FXLAB_AIR.has(k);
  };
  const atkOf = function(u){
    if(u._atk) return u._atk;                                  // 전투가 이미 채워 둔 값이 있으면 그것
    return (typeof _sbAtkMode === 'function')
      ? _sbAtkMode({ id:u.id, gmodel:u.gm })
      : { air:true, gnd:true };
  };
  // ⚠ 공격을 못 하는 유닛은 세지 않는다 — 의무병은 사거리 0 · 공격력 0 이라 아무리 많아도 못 죽인다.
  //   ⭐ _sbAtkMode 가 비전투(FXLAB_NOATK)를 {air:false,gnd:false} 로 돌려주므로 그것도 함께 걸린다.
  const canFight = function(u){ if((u.dmg || 0) <= 0) return false; const a = atkOf(u); return !!(a.air || a.gnd); };
  const mine = CAMPB.me.units.filter(function(u){ return !u.dead && canFight(u); })
    .concat((CAMPB._down || []).map(function(d){ return d.u; }).filter(function(u){ return u && canFight(u); }));
  if(!mine.length) return false;                // 때릴 수 있는 병력이 하나도 없다 = 끝이 없다
  for(const f of foes){
    const fa = isAir(f);
    for(const m of mine){
      const a = atkOf(m);
      if(fa ? a.air : a.gnd) return true;
    }
  }
  return false;
}

// 이번 라운드의 적을 낸다.
// 🎬 **적을 나눠 내보내는 것은 연출이다.** 100마리가 한 프레임에 쏟아지지 않게 나눠 낸다.
//   ⛔ **라운드 길이를 여기서 만들지 않는다.** 라운드 시간은 오직
//        `적 총 체력 ÷ 아군 총 DPS`
//     이고, 화면의 적을 다 잡으면 **그 순간** 다음 라운드다(HUNT_R1 §6-2, 2026-08-27 확정).
//   ⚠ 한때 「안 나온 무리가 남으면 라운드가 안 끝난다」는 하한을 뒀었다. 적 체력이 3.3 이라
//     시간을 벌 다른 방법이 없던 때의 임시방편이었고, 체력을 40 으로 올린 지금은 필요 없다.
//     ⛔ 되살리지 말 것 — 손잡이가 둘이 되면 라운드가 길어졌을 때 **대기 때문인지 전투 때문인지
//       못 가린다.** 실제로 그랬다(난이도가 11배 올라도 18초 고정 = 전부 대기 시간이었다).
//     라운드를 길게 하고 싶으면 **적 체력만** 만진다.
const CAMP_WAVE_MAX = 6;        // 라운드 하나를 최대 몇 번에 나눠 내보내나
// ⚠ 간격은 **짧게** 둔다. 이건 연출이지 라운드 길이를 만드는 장치가 아니다 —
//   길게 잡으면 화면의 적을 다 잡아도 다음 무리를 기다리느라 라운드가 안 끝나고,
//   그 대기가 곧 라운드 길이가 되어 「적 총 체력 ÷ 아군 DPS」 규칙이 깨진다(실측 18초 고정).
const CAMP_WAVE_GAP_S = 0.3;    // 웨이브 사이 간격(초) — 6무리가 1.8초 안에 다 나온다
function campSpawnFoes(){ if(!CAMPB || typeof strikeSpawnUnit !== 'function') return 0;
  const n = campFoeCount(campRoundN());
  const w = Math.max(1, Math.min(CAMP_WAVE_MAX, n));
  const per = Math.floor(n / w), rem = n % w;
  CAMPB._wq = [];
  for(let i = 0; i < w; i++) CAMPB._wq.push(per + (i < rem ? 1 : 0));
  CAMPB._wqT = 0;
  CAMPB._wqTot = n;                              // ⚠ 라운드 전체 마리 수 — 무리마다 몫을 나누는 데 쓴다
  return campSpawnWave(); }                       // 첫 웨이브는 곧바로
// 대기 중인 웨이브 한 묶음을 내보낸다
function campSpawnWave(){
  if(!CAMPB || !CAMPB._wq || !CAMPB._wq.length) return 0;
  const k = CAMPB._wq.shift();
  // ⛔ **무리마다 라운드 총량을 통째로 주면 안 된다.** 6무리로 쪼개면 라운드 총 체력이 6배가 된다 —
  //   실측(2026-08-28): 적 체력 1,300 을 넣었더니 R24 가 설계 16초 대신 **193초**였다.
  //   ⭐ 라운드 총량 = CAMP_FOE_HP0 × 난이도. 각 무리는 **마리 수 비율만큼**만 가져간다.
  const share = (CAMPB._wqTot > 0) ? (k / CAMPB._wqTot) : 1;
  return campWithStk(() => { const b4 = CAMPB.ai.units.length;
    for(let i = 0; i < k; i++) strikeSpawnUnit('ai', campFoeId());   // ⛔ 공중 전용은 뽑지 않는다
    campScaleFoes(CAMPB.ai.units.slice(b4), share);
    return CAMPB.ai.units.length - b4; }) | 0; }
// 아직 안 나온 적이 남았나 — ⚠ 승리 판정이 이걸 봐야 한다(안 보면 첫 웨이브만 잡고 라운드가 넘어간다)
function campFoesPending(){ return !!(CAMPB && CAMPB._wq && CAMPB._wq.length); }

// 👀 **발견 전파** — 적을 본 아군 주변에게만 「넓게 봐라」를 옮긴다.
//   ⚠ 매 프레임 돌면 아군×적 만큼 비싸다(56×100). CAMP_ALERT_TICK 주기로만 돈다.
//   ⚠ 남은 시간은 매 프레임 깎는다 — 주기로만 깎으면 지속이 들쭉날쭉해진다.
function campAlertTick(dt){
  if(!CAMPB || !CAMPB.me) return 0;
  const mine = CAMPB.me.units, foes = CAMPB.ai.units;
  for(const u of mine){ if(u._alertT > 0) u._alertT = Math.max(0, u._alertT - dt); }
  CAMPB._alT = (CAMPB._alT || 0) - dt;
  if(CAMPB._alT > 0){ campAlertApply(); return 0; }
  CAMPB._alT = CAMP_ALERT_TICK;
  // ① 발견자 — 기본 인식 거리 안에 적이 있는 아군
  const B2 = CAMP_ACQ_BASE * CAMP_ACQ_BASE, spot = [];
  for(const u of mine){ if(u.dead) continue;
    for(const e of foes){ if(e.dead) continue;
      const dx = e.x - u.x, dy = e.y - u.y;
      if(dx * dx + dy * dy <= B2){ spot.push(u); break; } } }
  // ② 발견자 주변에만 전파 — ⭐ 멀리 있는 아군은 자기 자리를 지킨다
  if(spot.length){ const R2 = CAMP_ALERT_R * CAMP_ALERT_R;
    for(const u of mine){ if(u.dead) continue;
      for(const sp of spot){ const dx = sp.x - u.x, dy = sp.y - u.y;
        if(dx * dx + dy * dy <= R2){ u._alertT = CAMP_ALERT_S; break; } } } }
  campAlertApply();
  return spot.length;
}
// 전파 상태를 실제 인식 거리로 옮긴다(발견자 자신도 전파 대상이라 함께 넓어진다)
function campAlertApply(){
  if(!CAMPB || !CAMPB.me) return;
  for(const u of CAMPB.me.units){ if(u.dead) continue;
    u.acq = (u._alertT > 0) ? CAMP_ACQ_ALERT : CAMP_ACQ_BASE; }
}

// 🪢 **목줄** — 집결지에서 CAMP_LEASH 보다 멀어지면 그 선까지 끌어당긴다.
//   ⛔ 「인식 거리를 넓힌다」만 하고 이걸 빼면 적 본진까지 쫓아간다. 그러면 아군이 흩어져
//     각개격파되고, 적이 건물을 때리는데 아군은 저 위에 있는 그림이 된다.
//   ⚠ 속도를 깎지 않고 **위치만** 자른다 — 이동 로직(stepUnitMove)은 공용이라 건드리지 않는다.
function campLeash(){
  if(!CAMPB || !CAMPB.me) return 0;
  const r = campRallyPoint(); if(!r) return 0;
  const L2 = CAMP_LEASH * CAMP_LEASH; let n = 0;
  for(const u of CAMPB.me.units){ if(u.dead) continue;
    const dx = u.x - r.x, dy = u.y - r.y, d2 = dx * dx + dy * dy;
    if(d2 <= L2) continue;
    const d = Math.sqrt(d2) || 1;
    u.x = r.x + dx / d * CAMP_LEASH; u.y = r.y + dy / d * CAMP_LEASH; n++; }
  return n;
}

// 갓 스폰된 적을 이번 라운드 난이도에 맞춘다.
//   ⭐ 개체 값을 통째로 덮어쓰지 않고 **무리 전체의 기본값 합** 대비 배율로 민다 —
//      그래야 탱크가 마린보다 단단하다는 유닛별 차이가 살아남는다.
// share = 이 무리가 라운드 총량에서 가져갈 몫(0~1). 한 번에 다 낼 때는 1.
function campScaleFoes(list, share){
  if(!list || !list.length) return 0;
  const sh = (share > 0) ? share : 1;
  campDesignStats(list);                          // ⚔ 설계 능력치 먼저 — 그 뒤에 난이도 정규화가 총량을 맞춘다
  const diff = campFoeDiff(campDgN(), campCleared());
  let hp0 = 0, dmg0 = 0;
  for(const u of list){ hp0 += (u.maxHp || 0) + (u.maxSh || 0); dmg0 += (u.dmg || 0); }
  // 🌳 트리 「적 약화」 갈래 — 계열마다 −40% · 갈래 전체 실효 하한 ×0.2(HUNT_R1 §4-5-4)
  const cut = campRtFoeMul();
  const hpMul  = hp0  > 0 ? (CAMP_FOE_HP0  * diff * cut * sh) / hp0  : 1;
  const dmgMul = dmg0 > 0 ? (CAMP_FOE_ATK0 * diff * cut * sh) / dmg0 : 1;
  const rCap = campFoeRngCap();                     // 🎯 사거리 상한(아래 설명)
  for(const u of list){
    u.maxHp = u.maxHp * hpMul; u.hp = u.maxHp;
    u.maxSh = (u.maxSh || 0) * hpMul; u.sh = u.maxSh;
    u.dmg = (u.dmg || 0) * dmgMul;
    if(u.rng > rCap){ u.rng = rCap; if(u.acq < rCap) u.acq = rCap; } }   // acq 를 같이 열어야 다가와서 쏜다
  return diff; }
// ── 🎯 적 사거리 상한 — **아군이 먼저 쏘게 한다** (2026-08-27) ─────────
// ⛔ 안 걸면 라운드가 안 끝난다. 적 탱크 332 · 고스트 273 이 아군 최대 215 보다 멀리서 쏘는데
//   아군은 제자리 방어라 다가가지 않고, 맞은 만큼 의무병이 채운다 → **양쪽 다 안 죽는다.**
//   ⚠ 「때릴 수 없으면 패배」에는 안 걸린다 — campCanHitFoes 는 true 다(원리상 때릴 수는 있다).
//     때릴 수 없는 게 아니라 **닿지 않는 것**이라 규칙이 따로 필요했다.
// ⚠ 기준은 아군 **최소** 사거리다. 최대(공성전차)로 잡으면 초반에 레인저밖에 없을 때 또 대치한다.
// ⛔ U 표·STK_UNITS 의 range 를 고치지 말 것 — 멀티 대전과 오각형 상성이 같이 바뀐다(RACES.md).
//   **소환된 적 개체의 값만** 깎는다. 아군은 건드리지 않는다.
const CAMP_FOE_RNG_K = 0.9;        // 아군 최소 사거리의 이만큼까지만
const CAMP_FOE_RNG_FB = 168;       // 아군이 아직 전장에 없을 때(레인저 187 × 0.9)
function campFoeRngCap(){
  if(!CAMPB || !CAMPB.me) return CAMP_FOE_RNG_FB;
  // ⚠ **근접 유닛은 기준에서 뺀다.** 어차피 붙어야 때리므로 얘네로 상한을 잡으면
  //   적 사거리가 46 까지 내려가 원거리 적이 통째로 근접 유닛이 된다.
  let min = Infinity;
  const see = (u) => { if(!u || u.dead) return;
    if(!(u.dmg > 0) || !(u.rng > 0) || u.melee) return;
    if(u.rng < min) min = u.rng; };
  for(const u of CAMPB.me.units) see(u);
  for(const d of (CAMPB._down || [])) see(d && d.u);   // ⚠ _down 은 {u,t} 껍데기다(유닛이 아니다)
  return (min === Infinity) ? CAMP_FOE_RNG_FB : min * CAMP_FOE_RNG_K;
}

// ── ⚔ 캠프 전용 능력치 — HUNT_R1 §3-1 / §3-A / §3-B (2026-08-27) ────────
// ⭐ **캠프는 설계표가 단일 소스다.** 사용자가 「체력과 공격을 다 −10해서 1, 5, 2.2, 8 같은
//   수치로 낮추겠다」고 새로 정한 체계라, 코드값(U 표)과 처음부터 다른 표다.
//   ⚠ 인구는 예외 — 그건 **코드가 단일 소스**다(사용자가 원래 정해 둔 값을 되돌린 것).
// ⛔ **U · STK_UNITS · TECH_SPEC 을 고치지 말 것** — 멀티 대전과 오각형 상성(RACES.md)이
//   같이 바뀐다. 가격·적 사거리와 같은 방식으로 **소환된 개체의 값만** 덮는다.
// 표기: a=공격 · h=체력 (설계표는 1/10 스케일이라 ×10 해서 엔진 값으로 쓴다)
//       r=사거리(칸) · c=주기(초). 안 때리는 유닛은 a·r·c 를 비운다.
// ⚠ **설계 스케일을 그대로 쓴다(×1).** §3-1 은 1/10 스케일이고 적 체력 기본값(CAMP_FOE_HP0=40)·
//   본부 체력도 **같은 스케일**로 정해져 있다. 여기서 ×10 을 하면 아군만 10배 세진다.
const CAMP_STAT_HPK = 1, CAMP_STAT_ATK = 1;
const CAMP_STAT_TILE = 850 * 0.22 / 4;             // 칸 → 월드 거리. 레인저 4칸이 지금 엔진 값(187)과 같아지게 맞췄다
const CAMP_UNIT_STAT = {
  // 유니온 §3-1 (⚠ 레이서·저격수는 §3-1-1 조정분이 들어 있다)
  marine:{a:1,h:5,r:4.0,c:1.0}, machinegun:{a:2.2,h:8,r:1.5,c:0.9}, racer:{a:2.5,h:7,r:3.5,c:0.8},
  goliath:{a:3,h:14,r:5.0,c:1.0}, ghost:{a:4,h:9,r:7.0,c:1.6}, medic:{h:23,r:2.0},
  pelican:{h:27}, aegis:{h:23}, tank:{a:12,h:22,r:10.0,c:2.2}, skyguard:{a:4.5,h:22,r:5.0,c:1.0},
  hellfire:{a:10,h:28,r:6.0,c:1.6}, dreadnought:{a:31,h:47,r:6.0,c:2.0},
  // 스웜 §3-A
  snapper:{a:1.2,h:4,r:1.0,c:0.8}, hydra:{a:1.8,h:6,r:4.0,c:1.0}, stinger:{a:6.5,h:2,r:1.0,c:2.5},
  wyvern:{a:3,h:12,r:3.0,c:1.0}, medusa:{h:14}, ultralisk:{a:14,h:38,r:1.0,c:1.4}, overlord:{h:20},
  // 에테리얼 §3-B — ⭐ 실드를 체력에 합쳐 본다(그래서 실드는 0 으로 만든다)
  blade:{a:3,h:16,r:1.0,c:0.9}, dragoon:{a:4,h:18,r:4.0,c:1.2}, dark_templar:{a:6.5,h:12,r:1.0,c:1.3},
  falcon:{a:3.5,h:20,r:4.0,c:1.0}, skydancer:{a:3,h:20,r:5.0,c:0.8}, reaver:{a:20,h:18,r:8.0,c:3.0},
  kronos:{a:8,h:35,r:5.0,c:1.4}, archangel:{a:6,h:45,r:8.0,c:0.9}, high_templar:{h:8},
  seraph:{h:14}, observer:{h:6} };
// 소환된 개체 하나에 설계값을 얹는다. ⚠ **한 번만** 걸어야 한다(_campStat 표시).
function campDesignStat(u){
  if(!u || u._campStat) return false;
  const d = CAMP_UNIT_STAT[u.gm || u.id]; if(!d) return false;
  u._campStat = true;
  if(d.h != null){ const hp = d.h * CAMP_STAT_HPK;
    u.maxHp = hp; u.hp = hp;
    u.sh = 0; u.maxSh = 0; }              // ⭐ 실드는 체력에 합친 값이다 — 따로 두면 두 번 센다
  if(d.a != null) u.dmg = d.a * CAMP_STAT_ATK;
  if(d.c != null) u.cdMax = Math.max(0.45, d.c);
  if(d.r != null){ u.rng = d.r * CAMP_STAT_TILE;
    if(typeof strikeAcq === 'function') u.acq = strikeAcq(u.rng);
    u.melee = d.r <= 1.0; }               // 1칸 = 근접
  return true;
}
function campDesignStats(list){ let n = 0; for(const u of (list || [])) if(campDesignStat(u)) n++; return n; }

// 🌳 아군 강화 — 갓 출격한 내 유닛에 트리 배수를 얹는다(HUNT_R1 §4-5-3).
//   ⭐ 적(campScaleFoes)과 달리 **개체 값에 그대로 곱한다** — 적은 '무리 총량'을 난이도에 맞추지만
//      아군은 기준 총량이 없다. 유닛별 차이는 곱셈이라 그대로 보존된다.
//   ⚠ 같은 유닛에 두 번 걸지 말 것 — 출격 직후 새로 나온 것만 넘긴다(_campRtOn 표시).
// 🔬 연구 배수 — 계열 업그레이드(공격·체력)를 캠프 전투에 얹는다(HUNT_R1 §3-4).
//   ⛔ `_upgAtk`/`_upgDef`(11-cmdcard.js)를 빌려 쓰지 말 것 — 그것은 **샌드박스 전투실험 전용**이고
//     「+1/티어」 **덧셈**이다. 캠프는 설계대로 **×1.065^Lv 곱셈** — 레벨이 무제한이라
//     덧셈은 후반에 무의미해진다(적 체력은 던전당 ×2 로 자란다).
//   ⚠ 방어(armor)는 §3-1 에서 뺐다 — 방어구 업그레이드 자리를 **체력**이 대신한다(§3-4).
//     그래서 'hp' 는 `UNIT_UPG[uid].def` 키를 읽는다.
//   ⚠ 종족은 `RACE_OF` 가 아니라 **`G.tech.race`** 를 쓴다 — `techDoResearch` 가
//     `race+'_'+key` 로 써 넣으므로 읽는 쪽도 같아야 한다.
// ⭐ **한 레벨은 가볍게, 대신 많이 오른다**(2026-08-27 사용자 확정 · 옛 1.065).
//   가스 수급을 키워 레벨 수를 늘리는 대신 한 레벨의 무게를 줄였다 — 총 강함은 비슷한데
//   「오르는 느낌」이 훨씬 자주 온다.
//   ⚠ 던전 하나(적 ×2)를 따라잡는 데 필요한 레벨이 **11 → 24** 로 늘었다(§3-4 표도 그렇게 고쳤다).
const CAMP_RES_STEP = 1.03;       // 계열 업그레이드 한 레벨당(HUNT_R1 §3-4)
function campResLv(uid, kind){    // kind: 'atk' | 'hp'
  if(typeof G === 'undefined' || !G.tech || typeof UNIT_UPG === 'undefined') return 0;
  const m = UNIT_UPG[uid]; if(!m) return 0;
  const k = (kind === 'atk') ? m.atk : m.def;
  if(!k) return 0;
  return (G.tech.research && (G.tech.research[G.tech.race + '_' + k] | 0)) || 0; }
function campResMul(uid, kind){ const lv = campResLv(uid, kind);
  return lv ? Math.pow(CAMP_RES_STEP, lv) : 1; }

function campScaleAllies(list){
  if(!list || !list.length) return 0;
  campDesignStats(list);              // ⚔ 설계 능력치 먼저 — 배수는 그 위에 곱한다
  // 👀 기본 인식 거리만 맞춰 둔다 — 넓히는 것은 campAlertTick 이 **전파로만** 한다.
  //    ⛔ 사거리는 건드리지 않는다(늘리면 종족 상성이 바뀐다).
  for(const u of list) if(u) u.acq = CAMP_ACQ_BASE;
  const tAtk = campRtMul('atk'), tHp = campRtMul('hp');   // 🌳 환생 트리 — 전 유닛 공통
  let n = 0;
  for(const u of list){
    if(!u || u._campRtOn) continue;   // 이미 얹은 유닛
    const uid = u.gm || u.id;
    const atk = tAtk * campResMul(uid, 'atk');   // 🌳 트리 × 🔬 연구(계열별)
    const hp  = tHp  * campResMul(uid, 'hp');
    if(atk === 1 && hp === 1) continue;          // 얹을 것이 없으면 표시도 남기지 않는다
    u._campRtOn = 1;
    if(hp !== 1){ u.maxHp = (u.maxHp || 0) * hp; u.hp = u.maxHp;
      u.maxSh = (u.maxSh || 0) * hp; u.sh = u.maxSh; }
    if(atk !== 1) u.dmg = (u.dmg || 0) * atk;
    n++; }
  return n; }

// ══ 🩹 아군 부활 (2026-08-25) — HUNT_R1 §6-5 ═════════════════════════
//   ⭐ 아군은 **죽지 않는다**. 빈사로 누웠다가 고정 시간 뒤 그 자리에서 일어난다.
//     그래서 §6-6 의 「가동률」이 성립한다 — 사거리가 긴 유닛일수록 덜 눕고 더 오래 싸운다.
//   ⛔ 18-strike.js 를 고치지 않는다. 죽은 유닛은 배열에 남아 있으므로(u.dead=true 로 표시만)
//     캠프가 **전이를 감지해** 타이머를 달고 되살린다.
const CAMP_REV_S = 30;            // 부활 시간(초) — 유닛 종류와 무관한 고정값
// 🌳 「자동 재생산」(rebuild) — 설계의 「죽은 유닛 n% 자동 재구매」를 **부활 단축**으로 읽는다.
//   재구매는 '미네랄을 깎나'가 계속 애매했다. 부활 시간은 적 갈래의 「적 부활 시간」과 대칭이고
//   §6-6 의 가동률(생존÷사이클)에 곧바로 붙어 효과가 읽힌다.
const CAMP_RT_REV = [0, 0.25, 0.50, 0.75, 0.90, 1.00];   // 단축률 — HUNT_R1 §4-5-3 의 25/50/75/90/100
const CAMP_REV_MIN = 3;           // ⛔ 0 으로 만들지 않는다 — 즉시 부활이면 눕는 것이 무의미해진다
function campReviveSec(){ const n = campRtHas('rebuild');
  const cut = n > 0 ? CAMP_RT_REV[Math.min(5, n)] : 0;
  return Math.max(CAMP_REV_MIN, CAMP_REV_S * (1 - cut)); }
//   ⚠ **죽은 유닛은 배열에 남지 않는다** — strikeStepUnits 끝에서 `me.units=me.units.filter(u=>!u.dead)`
//     로 걷어낸다(18-strike.js:1301, 공유 파일이라 못 고침). 그래서 **걷히기 전후를 비교해** 붙잡는다.
//     객체는 살아 있으므로(배열에서 빠졌을 뿐) 그대로 들고 있다가 되살려 배열에 돌려놓는다.
function campCatchDown(before){
  if(!CAMPB || !before) return 0;
  if(!CAMPB._down) CAMPB._down = [];
  const now = CAMPB.me.units, keep = new Set(now);
  let n = 0;
  for(const u of before){ if(keep.has(u) || !u) continue;
    CAMPB._down.push({ u:u, t:campReviveSec() }); n++; }   // 걷힌 것 = 이번 프레임에 누운 것
  return n; }
function campReviveStep(dt){
  if(!CAMPB || !CAMPB._down || !CAMPB._down.length) return 0;
  let up = 0;
  for(let i = CAMPB._down.length - 1; i >= 0; i--){
    const d = CAMPB._down[i];
    if((d.t -= dt) > 0) continue;
    const u = d.u;
    u.dead = false;
    u.hp = u.maxHp || u.hp; u.sh = u.maxSh || 0;
    u._collapseT = null; u.wait = 0;                 // 붕괴 대기·스폰 대기 흔적 정리
    u.tgtUid = null; u._btgt = null; u._btT = 0;     // 표적은 새로 고른다
    CAMPB.me.units.push(u);                          // 전장에 돌려놓는다
    CAMPB._down.splice(i, 1); up++; }
  return up; }
// 누워 있는(부활 대기) 유닛 수 — 승패 판정이 쓴다
function campDown(){ return (CAMPB && CAMPB._down) ? CAMPB._down.length : 0; }

// 살아 있는 유닛 수
function campAlive(side){ if(!CAMPB) return 0; let n = 0;
  for(const u of CAMPB[side].units) if(!u.dead) n++; return n; }

// 한 프레임 — 전투를 굴리고 승패를 본다.
//   ⭐ 승패 판정은 **여기 한 곳**이다. campClearRound()/campFail() 을 다른 데서 부르지 말 것.
// ── ⚔ 마중 나가 싸우고 자리로 돌아온다 (2026-08-28 사용자 확정) ─────────
// ⭐ **완전 고정이 아니다.** 인식 거리 안에 적이 들어오면 마중 나가 싸우고, 적이 없어지면
//   제자리로 돌아와 대기한다. 돌아올 시간을 주려고 라운드 사이 텀도 늘렸다.
// ⛔ 왜 필요했나 — 실측(2026-08-28): 병력을 14 → 56 으로 늘려도 **실제로 꽂히는 화력은
//   27.5 → 72 밖에 안 늘었다**(병력당 1.96 → 1.29). 적이 집결지에 닿아야만 사거리에
//   들어오니 **앞줄만 쏘고 뒷줄은 놀았다.** 인식 거리를 넓히면 뒷줄도 마중 나가 싸운다.
// ⚠ **목줄(leash)이 반드시 필요하다.** 인식만 넓히면 적 본진까지 쫓아가 「제자리 방어」가
//   통째로 무너진다 — 예전에 그렇게 해서 라운드가 영영 안 끝나는 정체를 네 번 겪었다.
// ⭐ **전파식 인식** (2026-08-28 사용자 확정) — 전원이 똑같이 넓게 보는 게 아니다.
//   ① 혼자서는 CAMP_ACQ_BASE 만큼만 본다.
//   ② 누군가 적을 발견하면 **그 아군 주변 CAMP_ALERT_R 안의 아군에게만** 전파된다.
//   ③ 전파받은 아군은 CAMP_ACQ_ALERT 로 넓게 보며 마중 나간다. CAMP_ALERT_S 초 뒤 풀린다.
//   ⭐ 그래서 **발견자에게서 먼 아군은 자기 자리를 지킨다** — 한쪽으로 우르르 몰리지 않고
//     싸움이 난 구역의 병력만 거든다.
//   ⛔ 전원에게 넓은 인식을 주면(옛 방식) 판 전체가 한 덩어리로 움직여, 반대쪽이 통째로 빈다.
const CAMP_ACQ_BASE = 900;         // 혼자 볼 수 있는 거리(엔진 기본 560~900 의 위끝)
const CAMP_ACQ_ALERT = 1500;       // 전파받았을 때 보는 거리
const CAMP_ALERT_R = 900;          // 발견자에게서 이 거리 안의 아군에게 전파
const CAMP_ALERT_S = 3;            // 전파 지속(초) — 풀리면 다시 자기 자리로
const CAMP_ALERT_TICK = 0.25;      // 전파 판정 주기(초) — 매 프레임 돌면 비싸다
const CAMP_LEASH = 1300;           // 집결지에서 이보다 멀리는 못 나간다
const CAMP_ROUND_GAP_S = 6;        // 라운드 사이 숨 고르기 — 자리로 돌아올 시간(옛 1.5초)
const CAMP_SORTIE_S = 3;           // 🚚 증원 간격(초) — 라운드 도중에도 이만큼마다 내보낸다
function campCombatStep(dt){
  const C = campState(); if(!C || campDgN() <= 0) return;      // 0단계(캠프)에는 전투가 없다
  if(!CAMPB) campBattleOpen();
  if(!CAMPB) return;
  if(CAMPB._gapT > 0){ CAMPB._gapT -= dt;
    if(CAMPB._gapT <= 0){
      // 👥 **인구 한도까지 계속 내보낸다** (2026-08-27 · sc-3 판단).
      //   ⛔ 예전 규칙(전장이 비어야 출격)은 전장 병력을 17~18기에 묶었다 — 대기 68기가 놀았고
      //     아군 총 DPS 가 335 에서 멎었다. 적이 100마리까지 나오는 판에서 그건 방어전이 아니다.
      //   ⚠ 상한은 campTrimArmy() 가 건다(인구 200). 여기서 세지 않는다 — 세는 곳이 둘이면 어긋난다.
      campSortie();
      campBuildStructs();                                 // 🏢 그새 지은 건물을 전장에 반영(체력도 새로)
      campTrimArmy();                                     // 👥 인구 상한 재확인(던전 전환에서 새는 자리)
      campSpawnFoes(); }
    return; }
  if(!CAMPB.ai.units.length && !CAMPB._started){ CAMPB._started = true; campSortie(); campSpawnFoes(); return; }
  // 🚚 **라운드 도중에도 증원을 내보낸다** (2026-08-27)
  //   ⛔ 예전엔 라운드 갭에서만 출격했다. 그래서 판이 밀려 아군이 전멸하면 **그 라운드가
  //     영원히 안 끝났다** — 기지에 57기가 대기 중인데 한 기도 못 나갔다(실측 D2R1).
  //   ⚠ 상한은 campTrimArmy() 가 건다(인구 200). 여기서 세지 않는다.
  CAMPB._soT = (CAMPB._soT || 0) - dt;
  if(CAMPB._soT <= 0){ CAMPB._soT = CAMP_SORTIE_S; campSortie(); }
  campAlertTick(dt);    // 👀 발견 전파 — 이동·전투보다 **먼저** 걸어야 이번 프레임에 반영된다
  const _b4 = CAMPB.me.units.slice();   // 🩹 strikeStepUnits 가 죽은 것을 걷어내므로 미리 떠 둔다
  campWithStk(() => { if(typeof strikeStepUnits === 'function') strikeStepUnits(dt); CAMPB.t += dt; });
  campCatchDown(_b4);   // 🩹 이번 프레임에 누운 아군을 붙잡는다
  campLeash();          // 🪢 너무 멀리 나간 아군을 집결선 안으로 되돌린다
  // 🌳 「스킬 쿨다운」 −70% — 18-strike 를 고치지 않고, 이미 dt 만큼 깎인 값을 **더** 깎아 배속한다.
  //   ⚠ 내 유닛만. 사다리 ×N 을 '남은 시간이 1/N 속도로 흐른다'가 아니라 '(N−1)dt 만큼 더 깎는다'로 읽는다.
  campReviveStep(dt);   // 🩹 누운 아군을 일으킨다(승패 판정보다 먼저 — 일어난 프레임에 지면 안 된다)
  if(campFoesPending()){                                  // ⏱ 다음 웨이브 투입
    CAMPB._wqT -= dt;
    if(CAMPB._wqT <= 0){ campSpawnWave(); CAMPB._wqT = CAMP_WAVE_GAP_S; } }
  { const sk = campRtMul('skCd');
    if(sk !== 1){ const extra = dt * (sk - 1);
      for(const u of CAMPB.me.units){ if(u.dead || !u.skillCd) continue;
        for(const k in u.skillCd){ if(u.skillCd[k] > 0) u.skillCd[k] = Math.max(0, u.skillCd[k] - extra); } } } }
  // ① 졌나 — **먼저 본다.** 본부가 뚫린 프레임에 마침 마지막 적도 죽었다면 그건 진 것이다.
  //    ⚠ 순서를 바꾸지 말 것: 승리를 먼저 보면 본부가 0인데도 라운드가 올라간다(스모크가 잡았다).
  //    ⭐ **패배 = 본부 파괴다**(HUNT_R1 §6-5). 부활이 생긴 뒤로 「전멸」은 패배가 아니다 —
  //      다 누워도 30초 뒤 일어난다. 다만 **되살릴 유닛이 하나도 없으면**(출격 병력 0) 끝이 없으므로 그때만 진다.
  // ⛔ **때릴 수 없는 적만 남았으면 진다.** 안 그러면 라운드가 영원히 안 끝난다(실측: R12 hellfire).
  //   ⚠ 아직 안 나온 무리가 있으면 그중에 때릴 수 있는 것이 있을 수 있으므로 기다린다.
  const _noHit = CAMPB._started && !campFoesPending() && !campCanHitFoes();
  // 🏢 **패배 = 내 건물이 전부 부서지는 것**(2026-08-27 확정). 본부 하나가 아니라 기지 전체다.
  //    ⚠ 건물 목록이 비어 있으면(아직 안 세웠으면) 본부 체력으로 판정한다 — 옛 규칙 폴백.
  const _bld = campBldAlive();
  const _allDown = (CAMPB._bld && CAMPB._bld.length) ? (_bld.length === 0) : (CAMPB.me.base.hp <= 0);
  if(_allDown || _noHit
     || (CAMPB._started && CAMPB.me.units.length === 0 && campDown() === 0 && campAlive('ai') > 0)){
    const was = campFail(); campBattleClose(); campBarReset();
    campSay(_allDown
      ? ('🏢 기지가 무너졌습니다 — 던전 ' + was.dg + ' ' + was.cleared + '라운드에서 탈락')
      : _noHit
      ? ('✈ 공중을 칠 수 없어 탈락 — 대공이 되는 병력을 섞으세요(던전 ' + was.dg + ' ' + was.cleared + '라운드)')
      : (was.cleared > 0
        ? ('💀 던전 ' + was.dg + ' ' + was.cleared + '라운드에서 탈락 — 캠프로 돌아갑니다')
        : ('💀 던전 ' + was.dg + ' 1라운드도 못 깼습니다 — 캠프로 돌아갑니다')), 'lose');
    return; }
  // ② 적을 다 잡았다 → 라운드 클리어
  if(CAMPB._started && campAlive('ai') === 0){
    if(CAMPB._wq) CAMPB._wq.length = 0;    // 아직 안 나온 무리는 그냥 안 나온다(기다리는 화면을 만들지 않는다)
    const dgWas = campDgN();
    campClearRound();
    if(campDgN() !== dgWas){                                   // 던전이 바뀌면 전장을 새로 연다(적 종족이 바뀐다)
      campBattleOpen(); campBarReset();
      campSay('🏁 던전 ' + dgWas + ' 완주 — 던전 ' + campDgN() + ' 진입', 'game_start'); }
    if(CAMPB){ CAMPB._started = true; CAMPB._gapT = CAMP_ROUND_GAP_S; } }
}

// ══ 🗺 단계·라운드 배지 (2026-08-25 · 3단계) ═══════════════════════════
//   #campBar — 맵 위, 재화 바 아래. 마크업은 sc-ums-web.html · 값은 css/30-home.css.
//   ⛔ 여기서 마크업을 만들지 말 것(단일 소스). 채우기만 한다.
//   ⚠ 매 프레임 불리므로 **바뀐 것만** 쓴다 — 무조건 innerHTML 을 갈면 리플로가 초당 30번 난다.
let _campBarS = '';
function campBarRender(){
  const el = document.getElementById('campBar'); if(!el) return;
  const C = campState(); const pts = C ? Math.floor(C.rbPts || 0) : 0;
  const dg = campDgN(), foe = campAlive('ai');
  const key = dg + '|' + foe + '|' + pts;
  if(key === _campBarS) return;
  _campBarS = key;
  // ⛔ 던전·라운드·진행은 여기 두지 말 것 — 재화 바 왼쪽 칩(#curTitle · js/12-appshell.js)이
  //    이미 그걸 보여주고 거기에 이동 드롭다운까지 붙어 있다. 두 곳에 두면 반드시 어긋난다.
  const fo = el.querySelector('.cbFoe');
  if(fo) fo.textContent = (dg > 0 && foe > 0) ? ('적 ' + foe) : '';
  { const tb = el.querySelector('.cbTree b'); if(tb) tb.textContent = campNum(pts); }
  // 보여줄 게 하나도 없으면 띠 자체를 숨긴다(빈 판이 맵을 가리지 않게)
  el.classList.toggle('empty', !(dg > 0 && foe > 0) && pts <= 0);
}
// 화면을 떠났다 돌아올 때 다시 그리게 한다(잔상 금지 — 캐시가 남으면 옛 값이 보인다)
function campBarReset(){ _campBarS = ''; }

// 진입·클리어·탈락 알림 — toast()/playSfx() 는 등록된 단일 소스다(CLAUDE.md 레지스트리)
function campSay(msg, sfx){
  if(typeof toast === 'function') toast(msg);
  if(sfx && typeof playSfx === 'function') playSfx(sfx); }

// ── 상태 — hbHunt() 와 같은 지연 초기화 모양 ────────────────────────────
function campState(){
  const p = (typeof PROF === 'function') ? PROF() : null;
  if(!p) return null;
  if(!p.camp) p.camp = { ver:CAMP_VER, race:null, dg:0, cleared:0, best:{}, credit:0, energy:0,
    built:{}, addon:{}, units:{}, research:{}, sup:0, supCap:0, eseq:1, ents:[], minerals:[],
    upg:{}, rate:0, leftAt:0, tapped:0 };   // dg=0 은 캠프 · upg=캠프 업그레이드 · rate=실측 수급속도 · leftAt=나간 시각
  // 🔄 ver1 → ver2 : 단계 번호가 한 칸 내려갔다. 옛 「던전 1(적 없음)」이 지금의 0단계(캠프)다.
  //    ⛔ 그냥 두면 옛 저장이 곧장 던전 1(적이 나오는 곳)에 서 있게 된다.
  if((p.camp.ver | 0) < 2){ p.camp.dg = Math.max(0, (p.camp.dg | 0) - 1); p.camp.ver = CAMP_VER; }
  if(typeof p.camp.cleared !== 'number') p.camp.cleared = 0;
  if(typeof p.camp.earn !== 'number') p.camp.earn = 0;         // 🔁 그 회차 누적 미네랄(환생 관문·포인트 기준)
  if(typeof p.camp.earnGas !== 'number') p.camp.earnGas = 0;
  if(typeof p.camp.rebMul !== 'number') p.camp.rebMul = 0;     // 환생 배수 — 합산 누적
  if(typeof p.camp.rbPts !== 'number') p.camp.rbPts = 0;       // 환생 포인트 — 트리에 쓴다(6단계)
  if(!p.camp.best || typeof p.camp.best !== 'object') p.camp.best = {};
  return p.camp;
}
function campHasRace(){ const C = campState(); return !!(C && C.race); }
// STK_RACES 는 기존 3종족에 옛 별칭(terran/zerg/protoss)을 쓰고 TECH_TREE 는 union/swarm/… 을 쓴다.
// 변환은 오토배틀이 이미 갖고 있다 — 표를 다시 적지 않는다.
function campTechRace(r){ return (typeof stkTechRace === 'function') ? stkTechRace(r) : r; }

// ── 광맥을 2열 × 3행으로 다시 깐다 ──────────────────────────────────────
// techUIInit 은 가로 1줄 6개로 깐다(16-build.js:16~18). 캠프는 뭉쳐 놓는다 —
// 한 줄이면 일꾼이 옆으로 늘어서서 답답하다.
// ⛔ 16-build.js 를 고치지 않는다. 오토배틀이 `G.tech.minerals=[]` 로 비우듯 여기서 다시 채운다.
// 좌표식은 원본과 같은 것을 쓴다(가스 구역 c0 기준 왼쪽 오프셋).
// ⭐ **세로 화면의 아래쪽이 손이 닿는 곳이다**(GAME_DIRECTION §2-4 「엄지 도달 범위」).
//   적은 위에서 내려오고, 지킬 본부는 그 아래, 광맥은 **본부보다 더 뒤(최하단)** 에 둔다.
//   ⛔ 건설 탭 기본 자리(가스 구역 왼쪽·위쪽)를 그대로 쓰지 말 것 — 관리자용 배치라
//     가장 자주 누를 광맥이 화면 위쪽 절반으로 가서 엄지가 안 닿는다(실측 sy 0.37).
//
//        위    ← 적이 가로 전체에서 내려온다
//        │
//        ├── 교전 · 방어선(플레이어가 터렛·벙커를 짓는 곳)
//        │
//        ├── 본부      CAMP_ROW_BASE
//        └── 광맥 2×3  CAMP_ROW_MINE   ← 엄지 범위
// ⛏ **광맥 한 덩이에 붙는 일꾼 수.** 건설 탭 기본은 1이라(res.miner 단일 락) 광맥 6덩이 =
//   동시 6명이 상한이었고, 그래서 일꾼을 아무리 뽑아도 수입이 안 늘었다
//   (실측: 12기 26.8/초 · 300기도 26.8 — 나머지는 줄을 선다). 일꾼 축이 통째로 죽어 있었다.
//   `cap` 은 16-build.js 가 읽는 캠프 표식이다(`inf` 와 같은 수법) — 관리자 탭·오토배틀은
//   cap 이 없어 1로 동작하므로 영향이 없다. 설계 근거는 HUNT_R1.md §1.
const CAMP_MINE_CAP = 5;
const CAMP_MINE_COLS = 3, CAMP_MINE_ROWS = 2;   // 가로로 넓게 — 세로 화면에서 아래를 덜 먹는다
// ⚠ 이 둘이 **기지가 하단 시트에 가리지 않게** 하는 유일한 장치다.
//   맵은 화면 전체를 쓰고 시트가 그 위를 덮으므로(css/30-home.css 캠프 블록), 시트 상단보다
//   위에 앉혀야 한다. 시트 상단 = 화면 세로의 0.77 지점(실측: 맵 701px 중 시트 161px + 네비).
//   ⛔ 값을 바꿨으면 **가장 아래 요소인 가스**(광맥 행 + h-0.55)까지 재서 0.74 아래로
//     내려가지 않는지 확인할 것 — 광맥만 보고 정했다가 가스가 시트에 물렸다.
const CAMP_ROW_BASE = 0.58;   // 본부 중심(격자 세로 비율 0~1)
const CAMP_ROW_MINE = 0.67;   // 광맥 첫 줄
// ⚠ 행 번호는 **여기 한 곳에서만** 만든다. 광맥과 가스가 각자 round(rows*f) 를 하면
//   호출 시점에 _techRows() 가 달라져 서로 다른 행에 앉는다(실측: 가스가 광맥보다 5행 위였다).
function campRow(f){ return Math.max(0, Math.round(_techRows() * f)); }
function campRowY(f){ return techY0() + campRow(f) * _techCH(); }
function campMineCol(){ return Math.round(techCols() / 2 - CAMP_MINE_COLS / 2); }
function campLayMinerals(){
  if(typeof G === 'undefined' || !G.tech) return;
  const cw = _techCW(), ch = _techCH();
  const x0 = TECH_GRID.x0 + campMineCol() * cw;   // 가로 가운데(가스와 같은 문으로 계산)
  const y0 = campRowY(CAMP_ROW_MINE);
  G.tech.minerals = [];
  for(let r = 0; r < CAMP_MINE_ROWS; r++) for(let c = 0; c < CAMP_MINE_COLS; c++)
    G.tech.minerals.push({ eid:G.tech.eseq++,
      x: x0 + c * cw, y: y0 + r * ch,
      // ⭐ 캠프 광맥은 **마르지 않는다**(inf). 방치형이라 5분에 경제가 죽으면 게임이 끝난다 —
      //    실측에서 9,000 이 291초에 0 이 됐다(BALANCE.md §3-2).
      //    ⛔ 관리자 건설 탭의 광맥에는 붙이지 말 것 — 거긴 잔량 %가 화면에 나온다.
      amount: TECH_MINE_START, inf: true, cap: CAMP_MINE_CAP, owner:null, miner:null });
}
// 본부·일꾼을 하단으로 옮긴다 — techUIInit 은 관리자 자리(0.5, 0.3)에 놓는다.
// ⛔ 16-build.js 를 고치지 않는다. 놓인 것을 캠프가 옮긴다(오토배틀의 strikeTechLayout 과 같은 결).
// ── ⛽ 가스 구역 ────────────────────────────────────────────────────────
// ⚠ **가스 광산은 구조적으로 하나뿐이다.** 정제소 배치 검사가 좌표를 정확히 비교한다:
//     if(_b&&_b.gas){ if(!(s.c0===TECH_GAS.c0 && s.r0===TECH_GAS.r0)) return false; }
//                                                    (17-build-cards.js:857)
//   둘로 늘리려면 이 검사 · _techInGasZone · _techGasOverlap · 렌더를 전부 고쳐야 하는데
//   그 파일은 관리자 탭·오토배틀과 공유한다. ⛔ 여기서 손대지 않는다.
// TECH_GAS 는 const 지만 **객체라 속성은 바뀐다.** 캠프가 자리만 옮겨 쓰고 나갈 때 되돌린다
//   (#cvMarine 을 빌리고 돌려주는 것과 같은 규칙 — 안 되돌리면 관리자 탭의 가스 자리가 어긋난다).
let _campGasHome = null;
function campLayGas(){
  if(typeof TECH_GAS === 'undefined') return;
  if(!_campGasHome) _campGasHome = { c0:TECH_GAS.c0, r0:TECH_GAS.r0 };
  TECH_GAS.c0 = Math.max(0, campMineCol() - TECH_GAS.w - 1);   // 광맥 바로 왼쪽
  TECH_GAS.r0 = campRow(CAMP_ROW_MINE);                       // 광맥과 **같은 행**
  CAMP_GAS2.c0 = Math.min(techCols() - TECH_GAS.w, campMineCol() + CAMP_MINE_COLS + 1);   // 광맥 바로 오른쪽
  CAMP_GAS2.r0 = TECH_GAS.r0;                                 // 같은 행
  campPatchGas(); campPatchSync(); campPatchZoom();
}
function campRestoreGas(){
  if(!_campGasHome || typeof TECH_GAS === 'undefined') return;
  TECH_GAS.c0 = _campGasHome.c0; TECH_GAS.r0 = _campGasHome.r0; _campGasHome = null;
}

// ── ⛽⛽ 가스 광산을 **둘**로 (광맥 좌우) ────────────────────────────────
// 건설 탭은 가스 구역을 **전역 하나**(TECH_GAS)로 본다. 배치·침범·채취 판정 셋이 전부
// 그 좌표 하나를 비교한다. 그 파일들은 관리자 탭·오토배틀과 공유하므로 고칠 수 없다.
//
// ⭐ **로직을 재현하지 않는다.** 원본 함수를 그대로 호출하되, 실패하면 **TECH_GAS 좌표를
//    오른쪽 자리로 잠시 바꿔 한 번 더 묻는다.** 두 자리 중 하나라도 통과하면 통과다.
//    이러면 원본이 나중에 바뀌어도 규칙이 저절로 따라온다(복사한 로직은 낡는다).
// ⛔ 원복을 반드시 한다 — TECH_GAS 는 공용 객체다.
const CAMP_GAS2 = { c0:0, r0:0 };      // 오른쪽 자리(campLayGas 가 채운다)
let _campGasPatched = null;
function _campWithGas2(fn, args){
  const sc = TECH_GAS.c0, sr = TECH_GAS.r0;
  TECH_GAS.c0 = CAMP_GAS2.c0; TECH_GAS.r0 = CAMP_GAS2.r0;
  try { return fn.apply(null, args); } finally { TECH_GAS.c0 = sc; TECH_GAS.r0 = sr; }
}
function campPatchGas(){
  if(_campGasPatched || typeof window === 'undefined') return;
  const P = {};
  for(const name of ['techArmValid', '_techGasOverlap', '_techInGasZone']){
    const orig = window[name];
    if(typeof orig !== 'function') continue;
    P[name] = orig;
    window[name] = function(){
      const r = orig.apply(this, arguments);
      if(r) return r;                                   // 왼쪽 자리에서 이미 통과
      if(!_campOn) return r;                            // 캠프 밖이면 원본 그대로
      return _campWithGas2(orig, arguments);            // 오른쪽 자리로 한 번 더
    };
  }
  _campGasPatched = P;
}
function campUnpatchGas(){
  if(!_campGasPatched) return;
  for(const k in _campGasPatched) window[k] = _campGasPatched[k];
  _campGasPatched = null;
  campUnpatchSync();
}

// 오른쪽 가스의 **3D 모델**도 왼쪽과 같게 세운다.
// renderBuildTab 은 가스 노드를 딱 하나만 목록에 넣는다:
//   list.push({uid:'gz_res', id:'res_en', x:…, y:…})      (14-input-fx.js:951)
// 그 list 는 지역 변수라 손댈 수 없지만, **M3D.syncBuild 를 감싸면 목록이 넘어올 때
// 하나 더 얹을 수 있다.** 좌표식은 원본과 같은 것을 쓴다(h-0.55 = 발판 아래쪽에 세운다).
let _campSyncOrig = null;
function campPatchSync(){
  if(_campSyncOrig || !window.M3D || typeof M3D.syncBuild !== 'function') return;
  _campSyncOrig = M3D.syncBuild;
  M3D.syncBuild = function(list, W, H, dt, zoom){
    try{
      if(_campOn && Array.isArray(list) && !campGas2Built()){
        const v = techView();
        const gx = TECH_GRID.x0 + (CAMP_GAS2.c0 + TECH_GAS.w / 2) * _techCW();
        const gy = techY0() + (CAMP_GAS2.r0 + TECH_GAS.h - 0.55) * _techCH();
        // ⚠ fitW 를 빼먹으면 왼쪽 광산과 크기가 달라진다(원본은 TECH_GAS.w × 셀폭px 로 준다).
        //   격자가 촘촘할수록 차이가 커진다 — 캠프는 48칸이라 눈에 띈다.
        const cwpx = _techCW() * W * v.zoom;
        list.push({ uid:'gz_res2', id:'res_en', x:(gx - v.x) * v.zoom + 0.5, y:(gy - v.y) * v.zoom + 0.5,
          face:Math.PI, fitW:TECH_GAS.w * cwpx });
      }
      // 💎 미네랄·운반 청크는 **셀 크기를 안 따른다.** renderBuildTab 이 이 둘만 fitW·scl 없이
      //   넣기 때문이다(건물=fitW, 유닛=scl×_cellK, 가스=fitW). 관리자 20칸에서는 셀이 커서
      //   티가 안 나지만, 캠프는 격자를 48칸으로 촘촘히 쓰므로 미네랄만 1.6배 크게 남아
      //   광맥 여섯이 서로 뭉개져 보인다(실측: 광맥 3열이 화면 폭의 5.5%인데 모델은 그보다 컸다).
      // ⛔ 14-input-fx.js 를 고치지 않는다 — 관리자 탭·오토배틀이 같은 함수를 쓴다.
      //   유닛과 **같은 계수**(_cellK)를 여기서 얹어 셀 축소를 똑같이 따르게 한다.
      if(_campOn && Array.isArray(list)){
        const k = campCellK();
        if(k < 0.999) for(const it of list){
          if(!it || it.scl != null || it.fitW != null) continue;
          if(typeof it.uid === 'string' && (it.uid.indexOf('mn_') === 0 || it.uid.indexOf('carry_') === 0)) it.scl = k;
        }
      }
    }catch(_e){}
    return _campSyncOrig.call(this, list, W, H, dt, zoom);
  };
}
function campUnpatchSync(){ if(_campSyncOrig && window.M3D){ M3D.syncBuild = _campSyncOrig; _campSyncOrig = null; } }
// 오른쪽 자리에 이미 정제소가 섰나 — 섰으면 광산 노드를 지운다(왼쪽과 같은 규칙)
function campGas2Built(){
  if(typeof G === 'undefined' || !G.tech) return false;
  return (G.tech.ents || []).some(function(e){
    if(e.type !== 'bldg') return false;
    const b = techGetBldg(G.tech.race, e.bk); if(!b || !b.gas) return false;
    const f = _techFoot(G.tech.race, e.bk), sn = _techSnap(e.x, e.y, f.w, f.h);
    return sn.c0 === CAMP_GAS2.c0 && sn.r0 === CAMP_GAS2.r0; });
}
// 오른쪽 가스 구역을 그린다 — techMapRender 가 .bmap 안을 통째로 갈아 끼우므로
// **그 밖(#cstMain 직계)** 에 두고 매 프레임 자리만 갱신한다(안 그러면 매번 지워진다).
function campDrawGas2(){
  const host = document.getElementById('cstMain'); if(!host || !_campOn) return;
  let el = document.getElementById('campGas2');
  if(!el){ el = document.createElement('div'); el.id = 'campGas2';
    el.innerHTML = '<span class="gzLbl">에너지 광산</span>';   // 왼쪽 구역과 같은 라벨
    host.appendChild(el); }
  // 왼쪽이 3D 로 그려지면(.d3) 오른쪽도 같은 클래스를 달아 겉모습을 맞춘다
  const left = document.querySelector('#cstMain .bmap .bGasZone');
  el.className = left ? left.className.replace(/hot/, '').trim() : 'bGasZone';
  if(campGas2Built()){ el.style.display = 'none'; el._campSig = null; return; }   // 서명을 비워 다시 나타날 때 갱신되게
  const cw = _techCW(), ch = _techCH();
  const tl = _techW2S(TECH_GRID.x0 + CAMP_GAS2.c0 * cw, techY0() + CAMP_GAS2.r0 * ch);
  const br = _techW2S(TECH_GRID.x0 + (CAMP_GAS2.c0 + TECH_GAS.w) * cw, techY0() + (CAMP_GAS2.r0 + TECH_GAS.h) * ch);
  // ⚡ 값이 그대로면 손대지 않는다 — 스타일을 쓰면 레이아웃이 무효화돼, 뒤따르는 rect 읽기가
  //   전부 강제 동기 레이아웃이 된다. 화면이 멈춰 있는 동안(대부분의 프레임) 쓸 일이 없다.
  const sig = tl.x.toFixed(4) + ',' + tl.y.toFixed(4) + ',' + (br.x - tl.x).toFixed(4) + ',' + (br.y - tl.y).toFixed(4);
  if(el._campSig === sig) return;
  el._campSig = sig;
  el.style.display = ''; el.style.position = 'absolute';
  el.style.left = (tl.x * 100).toFixed(2) + '%'; el.style.top = (tl.y * 100).toFixed(2) + '%';
  el.style.width = ((br.x - tl.x) * 100).toFixed(2) + '%'; el.style.height = ((br.y - tl.y) * 100).toFixed(2) + '%';
}
function campLayBase(){
  if(typeof G === 'undefined' || !G.tech) return;
  const b = (G.tech.ents || []).find(function(e){ return e.type === 'bldg'; });
  if(b && typeof _techFoot === 'function' && typeof _techSnap === 'function'){
    const f = _techFoot(G.tech.race, b.bk);
    const sn = _techSnap(0.5, campRowY(CAMP_ROW_BASE), f.w, f.h);   // 격자에 스냅해야 배치 검사와 어긋나지 않는다
    b.x = sn.cx; b.y = sn.cy;
  }
  const w = (G.tech.ents || []).find(function(e){ return e.type === 'worker'; });
  if(w){ w.x = 0.5 - _techCW() * 2; w.y = campRowY(CAMP_ROW_MINE) - _techCH();   // 광맥 바로 위에서 시작
    w.tx = null; w.ty = null; }
}

// ── 저장 ────────────────────────────────────────────────────────────────
// ⚠ ents 에는 런타임 전용 필드가 붙는다(_rally · _lifted · _cKind · _gEid …).
//   채취 왕복 상태·3D 표시 상태 같은 것들이라 저장하면 안 된다 —
//   저장이 부풀고, 복원할 때 '들고 있던 자원' 같은 유령 상태가 되살아난다.
function campClean(o){ const out = {}; for(const k in o){ if(k.charAt(0) === '_') continue; out[k] = o[k]; } return out; }
function campSave(){
  const C = campState(); if(!C || typeof G === 'undefined' || !G.tech) return;
  const T = G.tech;
  // ⛔ C.race 를 T.race 로 덮지 말 것 — **둘은 다른 이름 공간이다.**
  //   C.race = STK 키('terran' · 사용자가 고른 것) · T.race = TECH_TREE 키('union').
  //   덮으면 STK_RACES['union'] 이 없어서 종족 이름·색 표시가 통째로 깨진다(실제로 그랬다).
  //   종족은 campPickRace() 가 한 번 정하고 그 뒤로 아무도 손대지 않는다.
  C.credit = Math.floor(T.credit || 0); C.energy = Math.floor(T.energy || 0);
  C.built = campClean(T.built); C.addon = campClean(T.addon);
  C.units = campClean(T.units); C.research = campClean(T.research);
  C.sup = T.sup || 0; C.supCap = T.supCap || 0; C.eseq = T.eseq || 1;
  C.ents = (T.ents || []).map(campClean);
  C.minerals = (T.minerals || []).map(function(m){ return { eid:m.eid, x:m.x, y:m.y, amount:m.amount, inf:true, cap:CAMP_MINE_CAP, owner:null, miner:null }; });   // 캠프 광맥은 마르지 않는다
  if(typeof saveMeta === 'function') saveMeta();
}
// 저장분이 있으면 통째로 덮어쓴다. 없으면 false — 호출부가 새 판으로 이어 간다.
function campRestore(){
  const C = campState(); if(!C || typeof G === 'undefined' || !G.tech) return false;
  if(!C.ents || !C.ents.length) return false;
  const T = G.tech;
  T.credit = C.credit || 0; T.energy = C.energy || 0;
  T.built = Object.assign({}, C.built); T.addon = Object.assign({}, C.addon);
  T.units = Object.assign({}, C.units); T.research = Object.assign({}, C.research);
  T.sup = C.sup || 0; T.supCap = C.supCap || 0; T.eseq = C.eseq || 1;
  T.ents = C.ents.map(function(e){ return Object.assign({}, e); });
  T.minerals = (C.minerals || []).map(function(m){ return Object.assign({}, m, { inf:true, cap:CAMP_MINE_CAP, amount:(m.amount>0?m.amount:TECH_MINE_START) }); });   // 옛 저장(마른 광맥·cap 없던 것)도 되살린다
  T.sel = null; T.selU = []; T.arm = null; T.pend = [];   // 선택·배치 중이던 것은 이어받지 않는다
  campApplySupCap();   // 🌳 「인구 상한」 — 복원 뒤에 얹는다(복원이 supCap 을 통째로 덮어쓴다)
  return true;
}
// 🌳 「인구 상한」 +500 — ⚠ _techAddSupCap 은 TECH_SUP_MAX(200)에서 잘린다.
//   그 상한은 관리자·오토배틀 것이라 건드리지 않고, 캠프에서 트리 몫을 **위에 더한다**.
// 🌳 「업그레이드 비용」 −20~−80% — 캠프가 값을 매기는 두 곳(campUpgCost · campCost)에 함께 건다.
const CAMP_RT_DISC = [0, 0.20, 0.40, 0.55, 0.70, 0.80];   // HUNT_R1 §4-5-3
function campUpgDisc(){ const n = campRtHas('upCost'); return n > 0 ? (1 - CAMP_RT_DISC[Math.min(5, n)]) : 1; }
const CAMP_RT_SUP = [0, 10, 30, 80, 200, 500];   // HUNT_R1 §4-5-3 — 공식이 아니라 표다
function campSupAdd(){ const n = campRtHas('sup'); return n > 0 ? CAMP_RT_SUP[Math.min(5, n)] : 0; }
function campApplySupCap(){ const add = campSupAdd();
  if(add > 0 && typeof G !== 'undefined' && G.tech) G.tech.supCap = (G.tech.supCap || 0) + add; }

// ── 화면 층 ─────────────────────────────────────────────────────────────
// 건설 맵 #vBuild 는 .gview(인게임 층)이고 HOME 은 .appScreen 이다. 층이 다르다.
// ⚠ setInGame(true) 는 네비를 숨기고(navShow(null)) 재화 바도 CSS 로 숨긴다.
//   캠프는 둘 다 필요하므로 #phone.campMode 로 그 규칙에 예외를 판다(css/30-home.css).
// ⛔ DOM 을 옮기거나 복제하지 말 것 — #cstMain 은 관리자 탭·오토배틀과 같은 요소다.
let _campPrevTab = null;
let _campOn = false;   // 캠프 화면이 지금 떠 있나 — campExit 이 남의 판을 저장하지 않게 하는 문지기
let _campHome = null;    // #vBuild 의 원래 자리(돌려놓기 위해)
let _campPrevView = null; // 캠프 진입 전에 켜져 있던 .gview 목록 — ⛔ 반드시 되돌린다
let _campMarine = null;  // #cvMarine(공용 3D 캔버스)의 원래 자리 — ⛔ 반드시 되돌린다
let _campSheet = null;   // #btSheet 의 원래 자리 — 캠프에선 맵 밖으로 꺼낸다(아래 설명)

// ⭐ **HOME 껍데기를 그대로 쓴다.** #homeScreen 은 .appScreen(z-index 60)이라 인게임 층(#vBuild, z 6)을
//   통째로 덮는다 — setInGame(true) 로 켜 봐야 **화면에는 안 보인다**(실측: 화면 한가운데 요소가 #hmScroll).
//   그래서 층을 다투는 대신 **#vBuild 를 #homeScreen 안 배경 자리로 옮긴다.**
//   그 자리는 원래 #hbCv(옛 사냥터 배경 전투 캔버스)가 쓰던 곳이고, 위에 HUD·네비가 얹히는 구조다.
// ⛔ 복제가 아니라 **이동**이다 — #cstMain 은 관리자 탭·오토배틀과 같은 요소여야 한다(단일 소스).
//   나갈 때 원래 부모로 정확히 되돌린다.
// ⚠ **3D 건물은 #vBuild 가 아니라 공용 캔버스 #cvMarine 에 그린다**(14-input-fx.js:918).
//   그건 #gameArea(z 6) 안에 있어서 #homeScreen(z 60) 뒤로 숨는다 — 맵만 옮기면 **건물이 안 보인다.**
//   그래서 둘을 같이 옮긴다. z-index 로 올리는 방법은 쓰지 않는다: 60 을 넘기면 HUD·네비까지 덮는다.
// ⛔ #cvMarine 은 유즈맵·마을·보스가 함께 쓰는 공용 캔버스다. 반드시 원래 자리로 되돌린다.
function campMountView(){
  const hs = document.getElementById('homeScreen'), vb = document.getElementById('vBuild');
  if(!hs || !vb) return;
  if(!_campHome) _campHome = { parent: vb.parentNode, next: vb.nextSibling };
  if(vb.parentNode !== hs) hs.insertBefore(vb, hs.firstChild);   // 배경 자리(HUD 보다 뒤)
  const mc = document.getElementById('cvMarine');
  if(mc){
    if(!_campMarine) _campMarine = { parent: mc.parentNode, next: mc.nextSibling };
    if(mc.parentNode !== hs) hs.insertBefore(mc, vb.nextSibling);   // 맵 바로 위(건물이 바닥 위에 선다)
  }
  // ⭐ **하단 시트도 맵 밖으로 꺼낸다.** #btSheet 은 원래 #vBuild 의 자식이라, 맵 높이를
  //   시트만큼 줄이면 시트도 맵 기준이라 같이 끌려 올라간다 — 서로 밀어내는 순환이다
  //   (실측: 맵을 줄였더니 시트가 화면 한가운데로 올라와 323px 겹쳤다).
  //   #homeScreen 직속으로 옮기면 시트는 화면 바닥에 고정되고, 맵은 그 위까지만 쓰면 된다.
  // ⛔ 복제가 아니라 이동이다 — 관리자 탭·오토배틀이 같은 요소를 쓴다. 나갈 때 되돌린다.
  const sh = document.getElementById('btSheet');
  if(sh){
    if(!_campSheet) _campSheet = { parent: sh.parentNode, next: sh.nextSibling };
    if(sh.parentNode !== hs) hs.appendChild(sh);   // 맨 앞(맵·3D 위에 얹힌다)
  }
}
function campUnmountView(){
  const sh = document.getElementById('btSheet');
  if(sh && _campSheet){
    if(_campSheet.parent) _campSheet.parent.insertBefore(sh, _campSheet.next || null);
    _campSheet = null;
  }
  const mc = document.getElementById('cvMarine');
  if(mc && _campMarine){
    if(_campMarine.parent) _campMarine.parent.insertBefore(mc, _campMarine.next || null);
    _campMarine = null;
  }
  const vb = document.getElementById('vBuild');
  if(!vb || !_campHome) return;
  if(_campHome.parent) _campHome.parent.insertBefore(vb, _campHome.next || null);
  _campHome = null;
}
function campShowView(){
  // ⛔ setInGame(true) 를 쓰지 않는다 — 그건 네비를 숨기고 재화 바를 끄는 '인게임' 규칙이다.
  //   캠프는 HOME 안에 사는 화면이라 그 껍데기를 그대로 둬야 한다.
  const p = document.getElementById('phone'); if(p) p.classList.add('campMode');
  campMountView();
  // ⛔ **빌린 것은 돌려놓는다.** .gview 는 전장(#vMain)과 공유하는 층이고 .on 이 빠지면
  //   display:none 이라 그 안의 #cvMain 이 0×0 이 된다 — 크기를 재서 그리는 코드가 망가진다.
  //   캠프가 켜 둔 동안 어느 뷰가 켜져 있었는지 적어 두고 campHideView 가 되돌린다.
  const vs = document.querySelectorAll('.gview');
  if(_campPrevView === null){
    _campPrevView = [];
    for(let i = 0; i < vs.length; i++) if(vs[i].classList.contains('on')) _campPrevView.push(vs[i].id);
  }
  for(let i = 0; i < vs.length; i++) vs[i].classList.toggle('on', vs[i].id === 'vBuild');
  // ⭐ **프레임 루프는 .gview 가 아니라 `G.tab` 으로 분기한다**(js/14-input-fx.js:894).
  //   뷰만 켜고 이걸 빼먹으면 건설 맵이 렌더 루프를 아예 못 타고, 대신 drawMain() 이
  //   숨겨진 0크기 #cvMain 에 그리다가 drawImage 예외를 던진다(실제로 그랬다).
  // ⛔ switchTab('Build') 로 대신하지 말 것 — 그건 G.strike 분기·시트 토글·뷰 리셋까지
  //   함께 하는 유즈맵 문맥 함수라 캠프에서 부르면 부작용이 붙는다.
  if(typeof G !== 'undefined' && G){ if(_campPrevTab === null) _campPrevTab = G.tab; G.tab = 'Build'; }
  _campOn = true;
}
function campHideView(){
  const p = document.getElementById('phone'); if(p) p.classList.remove('campMode');
  const v = document.getElementById('vBuild'); if(v) v.classList.remove('on');
  if(_campPrevView){                                   // .gview 를 캠프 진입 전 상태로(위 설명)
    const vs = document.querySelectorAll('.gview');
    for(let i = 0; i < vs.length; i++) vs[i].classList.toggle('on', _campPrevView.indexOf(vs[i].id) >= 0);
    _campPrevView = null;
  }
  campUnmountView();                                   // #vBuild 를 원래 자리로
  campRestoreGas(); campUnpatchGas(); campUnpatchZoom();   // ⛽🔍 가스·줌 판정 원복(관리자 탭이 같은 것을 본다)
  campRestoreHire(); campRestoreSupply(); campRestoreUnitCost();   // 👷🏠⚔ 가격 원복(TECH_TREE 는 공유다)
  campRestoreRefinery();                                          // ⛽ 정제소 연구 카드를 뺀다(캠프 전용)
  campRestoreSkillCost();                                         // 🩸 스킬 체력 코스트 원복
  campUnpatchProduce(); campUnpatchArm();                  // 상한 문지기 원복
  campUnpatchFront();                                      // 🏢 표적 선택 원복(오토배틀이 같은 함수를 쓴다)
  { const g2=document.getElementById('campGas2'); if(g2) g2.remove(); }
  campClearSheet();
  campTapReset();                                          // 🤖 탭 리듬 기록을 비운다(다음 입장과 섞이면 오판한다)
  if(typeof G !== 'undefined' && G && _campPrevTab !== null){ G.tab = _campPrevTab; _campPrevTab = null; }
  _campOn = false;
}

// ── 진입 / 이탈 ─────────────────────────────────────────────────────────
// ⚠ 순서가 고정이다 — techUIInit 이 매번 상태를 새로 만들기 때문에
//   복원을 그 앞에 두면 방금 복원한 것이 통째로 날아간다.
function campEnter(){
  const C = campState(); if(!C) return;
  if(!C.race){ campRaceSheet(); return; }              // 종족을 아직 안 골랐다
  if(typeof techUIInit !== 'function') return;
  techUIInit(campTechRace(C.race));                    // ① 본부·일꾼·광맥이 깔린 새 판
  const had = campRestore();                           // ② 저장분이 있으면 덮어씀
  if(!had){ campLayBase(); campLayMinerals(); }         // 새 판이면 기지·광맥을 하단으로 다시 깐다
  G.tech.inf = false; G.tech.nocool = false;           // ③ ⚠ 관리자 치트(무한 자원·쿨 없음)를 끈다
  // 👷 **시작 일꾼 0기**(HUNT_R1 §1) — 첫 일꾼은 탭으로 번 돈으로 산다.
  //    techUIInit 이 1기를 깔아 두므로(16-build.js:14) 새 판일 때만 걷는다.
  if(!had) G.tech.ents = (G.tech.ents || []).filter(function(e){ return e.type !== 'worker'; });
  // ⛽ **시작 가스 0**(HUNT_R1 §2-3-1 — 정제소를 지어야 나온다).
  //    techUIInit 은 관리자 탭 기본값 1000 을 넣는다(16-build.js `TECH_START`). 그대로 두면
  //    연구를 26레벨이나 공짜로 사서 「가스는 늘 모자란다」가 첫 5분에 무너진다(실측 2026-08-27).
  //    ⚠ 미네랄(1500)은 건드리지 않는다 — 그쪽은 환생 트리 「시작 미네랄」의 기준선이다(§4-5).
  if(!had) G.tech.energy = 0;
  // 💎 **시작 미네랄 0**(2026-08-27) — 첫 미네랄은 탭으로 번다. 일꾼 0기와 같은 규칙이다.
  //    techUIInit 은 관리자 탭 기본값 1500 을 넣는다(16-build.js `TECH_START`).
  //    ⚠ 환생 트리 「시작 미네랄」(startMin)이 구현되면 **여기에 그 값을 더한다** — 지금은 노드 정의만 있다.
  if(!had) G.tech.credit = 0;
  campPatchProduce(); campPatchArm();                  // 일꾼 40기 · 보급소 24채 문지기
  campPatchRefinery();                                 // ⛽ 정제소에 「가스 생산」 연구 카드를 꽂는다
  campPatchSkillCost();                                // 🩸 스킬 체력 코스트를 캠프 자릿수로
  campPatchFront();                                    // 🏢 적이 내 건물을 때릴 수 있게(패배 = 건물 전멸)
  campShowView();                                      // ④
  // ⭐ **격자 패치를 격자 계산보다 먼저 건다.** techCols() 감싸기(20→48칸)가 여기 들어 있고,
  //   그 뒤로 _techCW()·_techCH()·_techRows() 값이 전부 달라진다.
  //   ⛔ 늦게 걸면 앞뒤 계산이 서로 다른 격자를 본다 — 실측: 가스는 20칸 격자로,
  //     광맥은 48칸 격자로 앉아 두 줄이 30행이나 어긋났다(가스 0.56 vs 광맥 0.86).
  campPatchZoom();
  const got = campSettleAway();                        // ⑤ 자리 비운 동안 번 것
  if(got > 0 && typeof toast === 'function') toast('💠 자리를 비운 동안 미네랄 ' + got);
  _campT0 = Date.now(); _campC0 = G.tech.credit || 0;  // 수급 속도 측정 시작점
  // ⚠ **격자 크기(_techRows)는 맵 요소의 실제 크기에 달렸다.** 맵이 최종 크기가 되기 전에
  //   재면 다른 값이 나온다. 맵 크기를 정하는 것이 둘이다:
  //     ① campShowView()  — #vBuild 를 HOME 안으로 옮긴다(실측 30행 → 35행)
  //     ② campSyncSheet() — 하단 시트 높이만큼 맵을 줄인다(실측 79행 → 61행)
  //   둘 다 안 거친 상태로 가스 자리를 잡았다가, 광맥은 55행·가스는 71행에 앉아
  //   가스가 화면 밖(sy 1.08)으로 밀려났다.
  //   ⛔ 격자 좌표를 쓰는 계산은 전부 **이 둘 뒤**에 둘 것.
  campSyncSheet();                                     // 🗂 시트를 먼저 띄운다 — 맵 높이가 여기서 정해진다
  if(!had){ campLayBase(); campLayMinerals(); }        // 확정된 격자로 기지·광맥을 다시 잡는다
  campLayGas();                                        // ⛽ 가스는 광맥 자리를 보고 정한다 — 반드시 뒤
  campZoom();                                          // 🔍 전체가 한눈에 들어오게
  campSkin();                                          // 🎨 바닥을 사냥터 던전 배경으로
  campStartFrame();                                    // ▶ 캠프 자기 루프(유즈맵 루프는 HOME 에서 멈춘다)
  if(typeof updateCurBar === 'function') updateCurBar();   // 재화 바를 캠프 값으로 즉시 갱신
  campAutoGather();                                    // ⑥ 놀고 있는 일꾼을 광맥에 붙인다(즉시 1회)
  campStartTimer();
  if(typeof techUIRender === 'function') techUIRender();
  campAutoSave(true);
}
// 이번 체류에서 **실제로 번 것**을 재 둔다 — 자리 비움 정산이 이 속도를 쓴다.
let _campT0 = 0, _campC0 = 0;
function campNoteStay(){
  if(!_campT0 || typeof G === 'undefined' || !G.tech) return;
  const secs = (Date.now() - _campT0) / 1000, gained = (G.tech.credit || 0) - _campC0;
  if(secs >= 5 && gained > 0) campNoteRate(gained, secs);   // 5초 미만은 표본이 안 된다
  _campT0 = 0;
}
// ⚠ **캠프가 켜져 있을 때만 저장한다.** showAppScreen() 이 화면을 옮길 때마다 이걸 부르는데,
//   관리자 건설 탭이나 오토배틀에서 온 경우 G.tech 는 그쪽 판이다. 무턱대고 저장하면
//   남의 판을 캠프 저장에 덮어써 기지가 통째로 바뀐다.
function campExit(){ if(!_campOn) return;
  campBattleClose();   // 🧹 전장은 화면을 떠날 때 지운다(공용 STK 를 빌려 쓴 것이라 남기면 샌다)
  campBarReset();      // 🧹 배지 캐시도 비운다(다음 진입에서 옛 값이 남지 않게)
  campNoteStay();                                      // 이번 체류의 수급 속도를 재고
  const C = campState(); if(C) C.leftAt = Date.now();  // 나간 시각을 남긴다(다음 진입에 정산)
  campStopTimer(); campStopFrame();
  campSave(); campHideView(); }
function campIsOn(){ return _campOn; }
// HOME 진입점 — 05-home.js 의 openHome() 이 부른다(옛 hbStart() 자리).
function campOpen(){ const C = campState(); if(!C) return;
  if(!C.race) campRaceSheet(); else campEnter(); }

// 주기 저장 — 건물 완성·생산마다 부르는 대신 타이머 하나로 묶는다(저장은 비싸다).
const CAMP_SAVE_MS = 30000;
let _campSaveT = 0;
function campAutoSave(reset){
  if(reset){ _campSaveT = (typeof performance !== 'undefined') ? performance.now() : 0; return; }
  const now = (typeof performance !== 'undefined') ? performance.now() : 0;
  if(now - _campSaveT < CAMP_SAVE_MS) return;
  _campSaveT = now; campSave();
}

// ── 종족 선택 ───────────────────────────────────────────────────────────
// 🎨 2026-08-24 개편 — 기준은 **로딩 · 로그인 · 설정** 세 화면이다(DESIGN.md).
//   목업 진행: race-select-8 → race-sheet-4 → race-sheet-login-4 → race-sheet-8
//             → race-select-v2-8 → race-select-v2-4a(b안 확정).
//   · 팝업(.hbModal)이 아니라 **전체 화면**이다 — 볼륨 3(진입 화면). 캠프 첫 진입에서
//     되돌릴 수 없는 선택을 하는 자리라 작은 카드로는 무게가 안 맞았다.
//   · 위는 **전투 미리보기 자리**(지금은 빈 칸 — 전투 시스템이 생긴 뒤 녹화 영상이 들어간다).
//     종족을 바꾸면 그 칸이 **짧은 크로스페이드**로 갈리기로 했다. 영상이 들어올 때 붙인다.
//   · 행 구분선은 **좌우로 사라지는 헤어라인**(DESIGN.md §1 볼륨 1 규격)이다.
//     ⛔ 전폭 실선으로 되돌리지 말 것 — 선이 그림을 가로질러 아트가 배경이 아니라 '표'로 보인다
//     (로그인이 그 이유로 전폭 헤어라인을 버렸다).
//   · 확정 버튼은 판 없이 **글자 + 밑변 광원**이다. 밑변 광원은 이 앱에서 주 버튼의 서명이고,
//     판을 안 쓰는 화면에서 버튼만 상자가 되면 그것만 튄다.
// ⛔ 전용 종족 UI 를 새로 만들지 말 것 — 13-room.js:268 에 같은 경고가 있다.
//   표는 STK_RACES 가 단일 소스다.
// ⚠ 캠프는 **3종족만** 쓴다. 페럴·콜로서스는 설계·오토배틀 편입까지 끝났지만(RACES.md)
//   캠프 건물·경제가 아직 3종족 기준이라 여기 목록에 넣지 않는다.
const CAMP_RACE_ORDER = ['terran','zerg','protoss'];
let _campRacePick = null;
// 🖼 종족별 전장 그림 · 아이콘 — **파일을 넣기만 하면 뜬다**(코드 수정 불필요).
//   assets/backgrounds/races/<union|swarm|aetherial>.webp   9:16 · 전장 미리보기
//   assets/icons/races/<union|swarm|aetherial>.webp         128×128 알파 · 선택 행 아이콘
//   없으면 배경은 기본 그라데, 아이콘은 STK_RACES[k].icon(이모지)로 대체된다.
function campRaceArt(k){ return 'assets/backgrounds/races/' + stkTechRace(k) + '.webp'; }
function campRaceIcon(k){ return 'assets/icons/races/' + stkTechRace(k) + '.webp'; }
function campRaceSheet(){
  if(typeof STK_RACES === 'undefined') return;
  _campRacePick = _campRacePick || CAMP_RACE_ORDER[0];
  let ov = document.getElementById('campRaceOv');
  if(!ov){ ov = document.createElement('div'); ov.id = 'campRaceOv';
    // ⚠ 껍데기는 **한 번만** 짓는다 — 미리보기 두 겹(.crPrevL)이 살아 있어야 크로스페이드가 된다.
    //   행/버튼만 campRaceRender() 가 다시 그린다.
    ov.innerHTML = '<div class="crPrev"><div class="crPrevL"></div><div class="crPrevL"></div></div>'
      + '<div class="crScr"><div class="crHd"><div class="crTtl">종족 선택</div></div>'
      + '<div class="crRows"></div>'
      + '<button type="button" class="crGo" onclick="campPickRace()"></button></div>';
    (document.getElementById('phone') || document.body).appendChild(ov); }
  { const _ph=document.getElementById('phone'); if(_ph) _ph.classList.add('campPick'); }   // 옛 사냥터 UI 를 숨긴다(css 「campPick」)
  // ⭐ display 해제와 `on` 을 **같은 프레임에** 한다. animation 은 클래스가 붙는 순간 처음부터 돌기 때문에
  //    한 프레임 미룰 이유가 없다 — 미루면 그 사이 프레임에 판이 보여 검은 섬광이 된다(css 「기본값은 0」).
  ov.classList.remove('hide');
  ov.classList.remove('closing');
  // 🎬 로딩에서 바로 넘어온 것이면 로딩과 **같은 길이로** 차오른다(css 「raceFx」)
  { const _ph2=document.getElementById('phone');
    ov.classList.toggle('raceFx', !!(_ph2 && _ph2.classList.contains('raceIn'))); }
  ov.classList.add('on');
  campRaceRender(); campRacePrev(_campRacePick, true);
}
// 전장 그림 교체 = **짧은 크로스페이드**(두 겹을 번갈아 쓴다). 첫 표시(now)는 페이드 없이 바로.
function campRacePrev(k, now){
  const ov = document.getElementById('campRaceOv'); if(!ov) return;
  const ls = ov.querySelectorAll('.crPrevL'); if(ls.length < 2) return;
  const cur = ov.querySelector('.crPrevL.on') || ls[0], nxt = (cur === ls[0]) ? ls[1] : ls[0];
  const url = campRaceArt(k);
  if(nxt.dataset.race === k && cur.classList.contains('on')) return;   // 같은 종족이면 아무것도 안 한다
  nxt.dataset.race = k; nxt.style.backgroundImage = 'url("' + url + '")';
  if(now){ cur.classList.remove('on'); nxt.classList.add('on'); return; }
  requestAnimationFrame(function(){ cur.classList.remove('on'); nxt.classList.add('on'); });
}
function campRaceRender(){
  const ov = document.getElementById('campRaceOv'); if(!ov) return;
  const cur = _campRacePick || CAMP_RACE_ORDER[0], R = STK_RACES[cur] || {};
  let rows = '';
  for(const k of CAMP_RACE_ORDER){ const S = STK_RACES[k] || {}; const on = (k === cur);
    // 아이콘 파일이 없으면 onerror 가 이모지로 되돌린다 — 자리·크기는 그대로다
    rows += '<button type="button" class="crRow' + (on ? ' on' : '') + '" onclick="campRaceSel(\'' + k + '\')">'
      + '<span class="crIco"><img src="' + campRaceIcon(k) + '" alt="" '
      + 'onerror="this.parentNode.textContent=\'' + (S.icon || '') + '\'"></span>'
      + '<span class="crMain"><span class="crNm">' + (S.name || k) + '</span>'
      + '<span class="crDs">' + (S.sub || '') + ' · ' + (S.desc || '') + '</span></span>'
      + '<span class="crGoIc">' + (on ? '✓' : '›') + '</span></button>'; }
  ov.querySelector('.crRows').innerHTML = rows;
  ov.querySelector('.crGo').textContent = (R.name || '') + (typeof josaRo==='function'?josaRo(R.name):'으로') + ' 시작';
  if(typeof paintIcons === 'function') paintIcons(ov);
}
function campRaceSel(k){ if(!STK_RACES[k] || k === _campRacePick) return;
  _campRacePick = k; campRaceRender(); campRacePrev(k); }
// ⚠ 한 번 고르면 바꾸지 않는다 — 기지가 종족 건물로 채워지므로 도중 교체는 뜻이 없다.
//   (바꾸는 기능이 필요해지면 '기지를 버리고 새로 시작'으로 따로 만든다)
function campPickRace(){
  const C = campState(); if(!C || C.race) return;
  C.race = _campRacePick || CAMP_RACE_ORDER[0];
  if(typeof saveMeta === 'function') saveMeta();
  // 🎬 **검은 화면 + 로고** → 캠프가 드러나며 다가온다.
  //    여기가 「게임이 실제로 시작되는 지점」이다(enterAfterWarm 의 _needRace 주석과 짝).
  //    ⛔ 여기서 종족 판을 걷지 않는다. 위에서 검은 판(z88)이 덮어 주므로 걷을 이유가 없고,
  //       먼저 걷으면 **아직 반투명한 검은 판 아래로 캠프가 통째로 드러난다**
  //       (2026-08-27 프레임 실측: 종족 선택 73.9 → **캠프 139** → 검은 화면 35.6 → 캠프 142.
  //        캠프가 두 번 나온다). 걷는 일은 campRaceToCamp 이 다 덮은 뒤에 한다.
  campRaceToCamp();
}

// 종족 선택 → 캠프.
// ⭐ **순서가 핵심이다.** campEnter() 는 **즉시** 부른다 — 늦추면 이 함수를 부르고 바로 캠프를
//   쓰는 곳(스모크 여덟 군데)이 전부 깨진다. 대신 **검은 판을 먼저 올려** 그 아래에서 세팅되게 한다.
//   검은 판(z 88)은 종족 판(z 64)보다 위라, 캠프가 준비돼도 화면에는 안 보인다.
//   ⛔ campEnter() 를 await 뒤로 옮기지 말 것. ⛔ 검은 판 없이 campEnter() 만 부르면
//     캠프가 잠깐 보였다가 덮이고 다시 나와 — 그게 「깜빡인다」의 정체였다(2026-08-27).
function campRaceToCamp(){
  const ph = document.getElementById('phone');
  const hasBlack = (typeof titleToBlack === 'function' && typeof titleOutroEnd === 'function' && ph);
  if(hasBlack) ph.classList.add('artMark');   // 로고를 다시 켠다 — titleOutroEnd 가 앞서 걷었다
  const black = hasBlack ? titleToBlack() : null;   // 검은 판이 덮이기 시작한다(기다리지 않는다)
  // ⛔ campEnter() 는 **즉시** 부른다. 검은 화면 뒤로 미뤄 봤더니(정지를 숨기려고) 캠프 상태를
  //    바로 기대하는 코드가 여럿이라 스모크 6 개가 깨졌다(2026-08-27). 그 준비 비용 때문에
  //    검은 판이 덮이는 도중 280ms 정도 얼어붙지만, 그 구간은 어차피 어두워지는 중이라 덜 띈다.
  campEnter();                                       // 그 아래에서 캠프가 선다
  // 🎬 **다 덮인 뒤에** 치운다 — 종족 판·campPick 둘 다.
  //    campPick 을 먼저 떼면 네비와 재화 바가 종족 선택 화면 위로 튀어나오고,
  //    그 네비가 처음 그려지는 프레임에 165ms 를 써서 화면까지 얼어붙는다(DESIGN.md §5.5 ⑤).
  const done = function(){
    const ov = document.getElementById('campRaceOv');
    if(ov){ clearTimeout(ov._closeT);
      ov.classList.remove('on'); ov.classList.remove('raceFx'); ov.classList.remove('closing');
      ov.classList.add('hide'); }
    if(ph) ph.classList.remove('campPick');   // 캠프가 켜지면 campMode 가 이어받는다
  };
  if(!black){ done(); campEnterAnim(); return; }
  black.then(function(){ done(); campEnterAnim(); titleOutroEnd(); });   // 다 덮인 뒤 걷으며 다가온다
}

// CSS 가 시간을 정한다 — JS 는 읽기만 한다(두 곳에 숫자를 두면 반드시 어긋난다).
function _campMs(name, def){
  try{ const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
            || getComputedStyle(document.getElementById('phone')||document.body).getPropertyValue(name).trim();
    if(v.slice(-2) === 'ms') return parseFloat(v);
    if(v.slice(-1) === 's')  return parseFloat(v) * 1000;
  }catch(e){}
  return def * 1000; }

// 🎬 맵과 3D 에 **같은** 애니메이션을 건다 — 형제라 하나만 걸면 배경과 건물이 따로 논다.
//   ⚠ 끝나면 클래스를 뺀다. 남겨 두면 나중에 transform 을 쓰는 코드와 부딪힌다.
function campEnterAnim(){
  const els = [document.getElementById('vBuild'), document.getElementById('cvMarine')];
  const ms = _campMs('--campInDur', 2.3);
  for(const e of els){ if(!e) continue;
    clearTimeout(e._campInT);
    if(e._campInEnd){ e.removeEventListener('animationend', e._campInEnd); e._campInEnd = null; }
    e.classList.remove('campIn'); void e.offsetWidth;   // 재생 중이어도 처음부터 다시
    e.classList.add('campIn');
    // ⭐ **animationend 로 뗀다.** setTimeout 은 프레임이 밀리면 애니가 아직 끝나기 전에 떼어
    //    배율이 도중에 1 로 튄다. 타이머는 그 이벤트를 못 받았을 때의 보험으로만 남긴다.
    e._campInEnd = function(ev){ if(ev && ev.target !== e) return;
      e.classList.remove('campIn');
      e.removeEventListener('animationend', e._campInEnd); e._campInEnd = null;
      clearTimeout(e._campInT); };
    e.addEventListener('animationend', e._campInEnd);
    e._campInT = setTimeout(function(){ if(e._campInEnd) e._campInEnd(); }, ms + 400); }
}

// ══ 💠 2단계 — 터치 채집 · 비용 조회 · 자리 비움 정산 (2026-08-23) ═════════════
// 방향 설계는 GAME_DIRECTION.md 가 단일 소스다.

// ── 비용 조회 — **여기 한 곳에서만 값을 읽는다** ───────────────────────
// ⛔ TECH_TREE 의 m/g 를 직접 고치지 말 것 — 유즈맵 건설 모드의 단일 소스라 그쪽이 망가진다.
//    구조(req 체인 · produces · research)만 빌리고 **비용은 이 함수를 거친다.**
// ⚠ 지금은 TECH_TREE 값을 그대로 통과시키는 자리다(CAMP_COST_K = 1).
//   실측: 유니온을 전부 짓고 전부 연구해도 미네랄 7,980 · 가스 6,850 뿐이라
//   탭 한 번에 1,000만 벌면 8탭에 게임이 끝난다. 사냥터 전용 비용 표가 오면
//   **이 함수 안만 갈아끼우면 된다** — 호출부는 손대지 않는다.
// ⭐ lv 인자를 받는 이유: 나중에 연구가 **무한 티어**로 열린다(환생 이후).
//   레벨을 boolean 이나 0~3 고정으로 다루면 그때 구조를 못 넓힌다.
const CAMP_COST_K = 1;                              // 사냥터 전용 배율(표가 오면 교체)
function campCost(kind, key, lv){
  const L = Math.max(0, lv | 0);
  let m = 0, g = 0;
  // ⚠ 비용은 techBldgSpec/techUnitSpec 이 아니라 **TECH_TREE 쪽**에 있다.
  //   techBldgSpec = TECH_SPEC[race].bldg[k] (상세 스펙 · 비용 없음)
  //   건물 비용 = TECH_TREE[race].buildings[].m/g · 유닛 비용 = 그 건물의 produces[].m/g
  if(typeof G !== 'undefined' && G.tech && typeof TECH_TREE !== 'undefined'){
    const race = G.tech.race, t = TECH_TREE[race];
    if(kind === 'bldg'){
      const b = (typeof techGetBldg === 'function') ? techGetBldg(race, key) : null;
      if(b){ m = b.m || 0; g = b.g || 0; }
    } else if(kind === 'unit'){
      const bs = (t && t.buildings) || [];
      for(const b of bs){ const q = (b.produces || []).find(function(x){ return x.id === key; });
        if(q){ m = q.m || 0; g = q.g || 0; break; } }
    }
  }
  const _d = campUpgDisc();   // 🌳 「업그레이드 비용」 — 건물·유닛 값도 캠프가 매긴다
  return { m: Math.round(m * CAMP_COST_K * _d), g: Math.round(g * CAMP_COST_K * _d), lv: L };
}

// ── 터치 채집 ───────────────────────────────────────────────────────────
// 광맥을 누르면 그 자리에서 미네랄이 나온다. 일꾼 왕복(방치)과 **다른 축**이다.
// ⛔ 16/17-build.js 를 고치지 않는다 — 관리자 탭·오토배틀과 공유하는 파일이다.
//   대신 **캡처 단계**에서 먼저 받아 광맥이면 삼키고, 아니면 그대로 흘려보낸다.
// ⭐ **모바일 클리커 표준 구조** — 효과는 **선형**, 비용은 **완만한 지수**, 곱셈은 **마일스톤**.
//   (Cookie Clicker ×1.15 · AdVenture Capitalist ×1.07~1.14 가 쓰는 방식. HUNT_R1.md §1)
//
// ⛔ 예전에는 효과 ×2 / 비용 ×2.5 의 **단일 지수**였다. 그 구조를 버린 이유:
//   ① 마일스톤이 없으면 「다음 계단까지 몇 레벨 남았나」가 안 보인다 — 계단이 목표를 만든다.
//   ② 지수 효과는 값이 금세 10^18 로 튀어 숫자가 뜻을 잃는다.
//   ③ 이 게임의 지수 축은 **던전 배율(2^d)과 환생 배율** 둘이다. 레벨까지 지수면 셋이 되어
//     BALANCE.md §0 폭주 조건에 걸린다. 레벨은 **던전 사이를 잇는 완충**이라 다항이 맞다.
//
// 마일스톤 배수는 Lv 에 **선형**이다(간격이 2배씩 넓어지므로 배수 ÷ Lv ≈ 0.08 로 일정).
//   효과 ≈ (1+0.025L) × 0.08L ≈ 0.002L² — 2차 다항.
// ⛔ 마일스톤 간격을 좁혀 지수로 만들지 말 것(위 ③).
const CAMP_TAP_BASE = 1;        // 탭 0레벨 = 1미네랄
const CAMP_TAP_STEP = 1;        // 탭 레벨당 +1
const CAMP_GAT_STEP = 0.025;    // 효율 레벨당 +2.5% (왕복 1회당)
const CAMP_TAP_COST0 = 70;      // 탭 0→1레벨 비용
const CAMP_GAT_COST0 = 210;     // 효율 0→1레벨 비용
const CAMP_COST_R0 = { tap:1.09, gather:1.12 };   // 무릎 전 비용 계단
const CAMP_COST_R1 = { tap:1.15, gather:1.20 };   // 무릎 후(Lv10~)
const CAMP_COST_KNEE = 10;
// 마일스톤 — 20, 50, 100, 200, 400 … (50 부터 2배씩) · 넘을 때마다 효과 ×2
const CAMP_MILE_FIRST = 20, CAMP_MILE_SECOND = 50;
function campMileMul(lv){
  let mul = 1, m = CAMP_MILE_FIRST;
  while(lv >= m && mul < 1e12){ mul *= 2; m = (m === CAMP_MILE_FIRST) ? CAMP_MILE_SECOND : m * 2; }
  return mul;
}
// 다음 마일스톤까지 몇 레벨 남았나 — 화면에 「계단이 보이게」 쓰는 값
function campMileNext(lv){
  let m = CAMP_MILE_FIRST;
  while(lv >= m){ m = (m === CAMP_MILE_FIRST) ? CAMP_MILE_SECOND : m * 2; }
  return m;
}
function campUpgLv(k){ const C = campState(); return (C && C.upg && C.upg[k]) | 0; }
// 업그레이드 비용 — ⛔ 값은 여기 한 곳에서만 (campCost 와 같은 원칙)
function campUpgCost(k){
  const lv = campUpgLv(k);
  // ⛽ 정제소는 계단이 하나다(무릎 없음) — §2-3-1
  if(k === 'refinery') return Math.max(1, Math.ceil(CAMP_REF_COST0 * Math.pow(CAMP_REF_R, campRefLv()) * campUpgDisc()));
  const base = (k === 'tap') ? CAMP_TAP_COST0 : CAMP_GAT_COST0;
  const r0 = CAMP_COST_R0[k] || CAMP_COST_R0.gather, r1 = CAMP_COST_R1[k] || CAMP_COST_R1.gather;
  const knee = Math.min(lv, CAMP_COST_KNEE);                    // Lv10 까지는 완만하게, 그 뒤로 가팔라진다
  const cost = base * Math.pow(r0, knee) * Math.pow(r1, Math.max(0, lv - CAMP_COST_KNEE));
  return Math.max(1, Math.ceil(cost * campUpgDisc()));           // 🌳 업그레이드 비용
}
// ══ 🔬 연구·계열 업그레이드 값 — 캠프는 **가스만** 받는다 (2026-08-27 확정) ═══
//   ⭐ **미네랄 = 양(유닛·일꾼·건물) / 가스 = 질(강화·해금).**
//     미네랄은 지수로 자라서 어떤 가격표를 붙여도 결국 공짜가 된다 — 그래서 미네랄로 매긴
//     강화 비용은 「비싼 미네랄」일 뿐이고 두 번째 자원을 둔 뜻이 사라진다.
//     가스는 안 자라므로 **끝까지 모자란 것**으로 남는다. 그 자리가 강화·해금이다.
//   ⛔ 연구에 미네랄을 도로 붙이지 말 것.
//   ⛔ 계열 업그레이드에 상한을 두지 말 것 — 설계 §3-4 가 「무제한」으로 확정했다.
//     적이 던전당 ×2 세지는 것을 11레벨씩 따라잡는 구조라 3티어로 막으면 던전 2에서 멎는다.
//   ⚠ **캠프 밖(관리자 탭·오토배틀)은 원본 값 그대로다** — null 을 돌려 갈라 준다.
//     16/17-build.js 는 공유 파일이라 그쪽에 캠프 값을 박으면 두 모드가 함께 망가진다.
const CAMP_RES_GAS0 = 1;        // 계열 업그레이드 1레벨 가스
// ⭐ **효과 계단(1.03)과 짝이다.** 한 레벨의 무게를 절반으로 눕혔으면 **비용 계단도 눕혀야**
//   같은 가스로 두 배 더 오른다 — 안 그러면 축이 그냥 약해진다(실측: DPS 215→108).
//   ⚠ 비율이 중요하다: 효과 1.03 ÷ 비용 1.04 → 강함이 가스의 0.75제곱으로 자란다.
//     옛 짝(1.065 / 1.08)은 0.81제곱이었으므로 **지금이 더 안전한 쪽**이다(BALANCE §0).
const CAMP_RES_GAS_R = 1.04;    // 레벨당 비싸짐
const CAMP_RES_ONE = { 100:10, 150:15, 200:20 };   // 단발 연구(§3-4-1) — 원본 미네랄값이 곧 등급
const CAMP_RES_ONE_DEF = 15;    // 표에 없는 등급은 '보통'으로 본다
// r = TECH_TREE 의 연구 정의 · lv = 지금 레벨. 캠프가 아니면 null(호출부가 원본 값을 쓴다).
// ⚠ r 를 키 문자열로 다시 찾지 않는다 — 같은 k 가 종족마다 있어 건물까지 알아야 한다.
function campResearchCost(r, lv){
  if(!_campOn || !r) return null;
  // ⛽ **정제소만 미네랄로 산다** — 미네랄(양) → 가스(질)로 가는 **유일한 다리**다.
  //   ⛔ 이것까지 가스로 만들면 가스를 가스로 사는 셈이라 축이 닫힌다.
  //   ⭐ 후반에 남아도는 미네랄의 출구이기도 하다(비용이 지수라 폭주하지 않는다).
  if(r.k === CAMP_REF_KEY) return [campUpgCost('refinery'), 0];
  const d = campUpgDisc();                        // 🌳 「업그레이드 비용」 — 건물·유닛과 같은 문
  const g = r.tier
    ? CAMP_RES_GAS0 * Math.pow(CAMP_RES_GAS_R, Math.max(0, lv | 0))
    : (CAMP_RES_ONE[r.m | 0] || CAMP_RES_ONE_DEF);
  return [0, Math.max(1, Math.ceil(g * d))]; }

function campTapGain(){
  const C = campState(); if(!C) return CAMP_TAP_BASE;
  // ⭐ 던전 배수는 **탭과 일꾼 양쪽에 똑같이** 걸린다(한쪽만 올리면 두 수입의 비율이 무너진다)
  // 🌳 트리 — 「탭당 미네랄」은 절대값을 더하고(초반 단축), 「탭 배수」는 곱한다
  const add = campRtHas('tap') > 0 ? CAMP_RT_LADDER[Math.min(5, campRtHas('tap'))] : 0;
  const lv = campUpgLv('tap');
  const base = (CAMP_TAP_BASE + CAMP_TAP_STEP * lv) * campMileMul(lv);   // 선형 × 마일스톤(HUNT_R1 §1)
  return Math.max(1, Math.round((base + add)
    * campMineMul() * campRebMul() * campRtMul('tapMul')));
}
// 일꾼 효율 — **왕복 1회당** 배수(HUNT_R1 §1). Lv0 = 1.0 이라 기준선이 바뀌지 않는다.
// ⚠ 일꾼 **수**로 올리는 축은 따로 산다 — 광맥 cap 을 5로 열어 두었다(CAMP_MINE_CAP).
//   그 전에는 덩이당 1명이라 12기 26.8/초에서 천장이었고 일꾼을 뽑아도 소용이 없었다.
//   지금은 실측 40기 137/초로 일꾼 수에 선형이다(scripts/camp-gather-bench.mjs).
function campGatherMul(){ const C = campState(); if(!C) return 1;
  const lv = campUpgLv('gather');
  return (1 + CAMP_GAT_STEP * lv) * campMileMul(lv)
    * campMineMul() * campRebMul() * campRtMul('gather'); }
// ── 🤖 매크로 방지 (HUNT_R1 §1-1-3 · 2026-08-27) ────────────────────────
// ⛔ 탭에 **상한을 두지 않기로** 했다. 그러면 매크로가 초당 10회를 누를 수 있고,
//   그 순간 일꾼·보급소·인구 200 이 통째로 장식이 된다(설계 추정: 손 수입의 98%).
// 방어선 둘 —
//   1차 event.isTrusted — 콘솔·스크립트가 만든 가짜 이벤트를 한 줄로 막는다.
//   2차 리듬·좌표 감쇠 — 외부 오토클리커는 **진짜 이벤트**라 1차를 통과한다.
//      사람은 탭 간격이 20~80ms 씩 흔들리고 손끝도 3~15px 움직인다. 기계는 둘 다 거의 0이다.
// ⛔ **차단이 아니라 감쇠다.** 오탐 한 번에 플레이어를 막아 세우면 억울하지만,
//   덜 오르는 것은 「왜 덜 오르지」로 끝난다. 그래서 0 이 아니라 20% 를 남긴다.
// ⛔ **경고를 띄우지 않는다** — 「매크로 감지」라고 알리면 우회 방법을 찾게 만든다. 조용히 줄인다.
const CAMP_TAP_WIN = 20;                      // 최근 몇 탭으로 리듬을 재는가
const CAMP_TAP_SIG_OK = 20, CAMP_TAP_SIG_BAD = 5;   // ms — 탭 간격 표준편차
const CAMP_TAP_JIT_OK = 3, CAMP_TAP_JIT_BAD = 1;    // px — 좌표 흔들림
const CAMP_TAP_FLOOR = 0.2;                   // 감쇠 하한(완전히 0 으로 만들지 않는다)
let _campTapLog = [];
function campTapReset(){ _campTapLog = []; }
function _campLerp(v, bad, ok){ if(!(ok>bad)) return 1;
  return Math.max(0, Math.min(1, (v - bad) / (ok - bad))); }
// 사람다움 0~1 — 리듬과 좌표 중 **하나라도** 사람 같으면 사람으로 본다(오탐을 줄인다).
function campTapHuman(x, y){
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  _campTapLog.push({ t: now, x: x, y: y });
  if(_campTapLog.length > CAMP_TAP_WIN) _campTapLog.shift();
  if(_campTapLog.length < CAMP_TAP_WIN) return 1;        // 표본이 모자라면 의심하지 않는다
  const gaps = []; for(let i = 1; i < _campTapLog.length; i++) gaps.push(_campTapLog[i].t - _campTapLog[i-1].t);
  const gm = gaps.reduce(function(a,b){ return a+b; }, 0) / gaps.length;
  let gv = 0; for(const d of gaps) gv += (d - gm) * (d - gm);
  const sig = Math.sqrt(gv / gaps.length);
  let cx = 0, cy = 0; for(const e of _campTapLog){ cx += e.x; cy += e.y; }
  cx /= _campTapLog.length; cy /= _campTapLog.length;
  let jit = 0; for(const e of _campTapLog) jit += Math.hypot(e.x - cx, e.y - cy);
  jit /= _campTapLog.length;
  const h = Math.max(_campLerp(sig, CAMP_TAP_SIG_BAD, CAMP_TAP_SIG_OK),
                     _campLerp(jit, CAMP_TAP_JIT_BAD, CAMP_TAP_JIT_OK));
  return CAMP_TAP_FLOOR + (1 - CAMP_TAP_FLOOR) * h;
}
// 눌린 곳이 광맥인가 — 맞으면 캐고 true
// ⚠ human=true 는 **실제 사람 이벤트로 들어온 탭**에만 준다(아래 리스너). 그때만 감쇠를 잰다 —
//   벤치·스모크가 직접 부르는 탭까지 감쇠하면 측정값이 오염된다.
function campTapAt(clientX, clientY, human){
  if(!_campOn || typeof G === 'undefined' || !G.tech) return false;
  if(typeof _btRect !== 'function' || typeof _techS2W !== 'function' || typeof _techMineralAt !== 'function') return false;
  const r = _btRect(); if(!r || !r.width || !r.height) return false;
  const sx = (clientX - r.left) / r.width, sy = (clientY - r.top) / r.height;
  if(sx < 0 || sx > 1 || sy < 0 || sy > 1) return false;
  if(sy < 0.13) return false;                       // 상단바 — techPtrDown 과 같은 규약
  const w = _techS2W(sx, sy);
  const m = _techMineralAt(w.x, w.y); if(!m || m.amount <= 0) return false;
  let gain = Math.min(campTapGain(), m.amount);     // 매장량보다 많이 캘 수는 없다
  if(human){ gain = Math.max(1, Math.floor(gain * campTapHuman(clientX, clientY))); }   // 🤖 리듬·좌표 감쇠
  m.amount -= gain;
  G.tech.credit = (G.tech.credit || 0) + gain;
  _campTapAcc += gain;                              // 이 몫에는 채취 배수를 걸지 않는다(위 참고)
  const C = campState(); if(C) C.tapped = (C.tapped || 0) + 1;   // 실측용 — 손 축이 얼마나 쓰였나
  if(typeof updateCurBar === "function") updateCurBar();
  else if(typeof techUIRender === 'function') techUIRender();
  return true;
}
// ⚠ 캡처 단계(세 번째 인자 true)라야 `.bmap` 의 인라인 onpointerdown 보다 **먼저** 받는다.
//   뒤에 달면 손가락이 늘 이동·선택 명령에 먼저 먹힌다.
if(typeof document !== 'undefined'){
  document.addEventListener('pointerdown', function(ev){
    if(!_campOn) return;
    // 🤖 1차 방어선 — 스크립트가 만든 이벤트는 isTrusted 가 false 다. 한 줄로 JS 매크로가 막힌다.
    // ⚠ 스모크는 포인터 이벤트를 **프로그램으로 쏜다**(isTrusted=false) — 그대로 두면 채집 관련
    //   step 이 통째로 깨진다. 그래서 테스트 전용 문 하나를 둔다.
    // ⛔ 이걸로 매크로가 막히리라 기대하지 말 것 — 콘솔을 여는 사람은 campTapAt 을 직접 부르면 그만이다.
    //   1차는 「무심코 붙여넣는 스크립트」를, 2차(리듬 감쇠)는 「외부 오토클리커」를 맡는다.
    if(ev.isTrusted === false && !window._campTapForce) return;
    if(ev.button != null && ev.button !== 0) return;              // 좌클릭·터치만
    if(!ev.target || !ev.target.closest || !ev.target.closest('#cstMain')) return;
    if(G && G.tech && G.tech.arm) return;                          // 🧱 건물 배치 중이면 채집하지 않는다
    // 💎 **광맥을 누르면 캐지 않고 판을 연다**(2026-08-27). 캐는 것은 그 판의 넓은 과녁이 맡는다.
    //   ⛔ 여기서 바로 campTapAt 을 부르게 되돌리지 말 것 — 광맥이 화면의 5% 뿐이라 손끝이
    //     일꾼·건물·바닥을 자꾸 눌렀다. campTapAt 은 남겨 둔다(벤치·스모크가 직접 부른다).
    if(campMineHit(ev.clientX, ev.clientY)){
      campPanMode(false);   // 🖐 광맥을 눌렀다 = '조작'이다(빈 바닥 탭·유닛/건물 탭과 같은 규칙)
      openCampMine();
      ev.stopPropagation(); if(ev.preventDefault) ev.preventDefault(); }
  }, true);
}

// 광맥을 눌렀나 — **판정만** 한다(캐지 않는다). campTapAt 의 앞부분과 같은 규약이다.
// ⛔ 좌표 변환을 여기서 새로 짜지 말 것 — _btRect / _techS2W / _techMineralAt 를 그대로 쓴다.
function campMineHit(clientX, clientY){
  if(!_campOn || typeof G === 'undefined' || !G.tech) return false;
  if(typeof _btRect !== 'function' || typeof _techS2W !== 'function' || typeof _techMineralAt !== 'function') return false;
  if(G.tech.arm) return false;                      // 🧱 건물 배치 중에는 열지 않는다
  const r = _btRect(); if(!r || !r.width || !r.height) return false;
  const sx = (clientX - r.left) / r.width, sy = (clientY - r.top) / r.height;
  if(sx < 0 || sx > 1 || sy < 0 || sy > 1) return false;
  if(sy < 0.13) return false;                       // 상단바 — techPtrDown 과 같은 규약
  const w = _techS2W(sx, sy);
  const m = _techMineralAt(w.x, w.y);
  return !!(m && m.amount > 0);
}

// ══ 💎 미네랄 채굴 판 (2026-08-27) ══════════════════════════════════════
// 광맥을 누르면 **그 자리에서 캐지 않고** 이 판이 열린다.
// ⛔ 메인 화면에서 바로 캐게 되돌리지 말 것 — 광맥은 화면의 5% 뿐이라 손끝이 자꾸 일꾼·건물·
//   바닥을 눌렀다(사용자 지적 2026-08-27). 넓은 과녁을 따로 두는 것이 이 판의 존재 이유다.
// ⭐ 껍데기는 공용(.hbModal/.hbmCard) — 새 팝업 컴포넌트를 만들지 않는다(CLAUDE.md 레지스트리).

// 업그레이드 구매 — **값은 campUpgCost 하나가 정한다**(여기서 다시 계산하지 않는다).
function campUpgBuy(k){
  const C = campState(); if(!C || typeof G === 'undefined' || !G.tech) return false;
  const cost = campUpgCost(k);
  if((G.tech.credit || 0) < cost) return false;
  G.tech.credit -= cost;
  C.upg = C.upg || {};
  C.upg[k] = (C.upg[k] | 0) + 1;
  if(typeof saveMeta === 'function') saveMeta();
  if(typeof updateCurBar === 'function') updateCurBar();
  if(typeof playSfx === 'function') playSfx('ui_confirm');
  if(typeof dqNote === 'function') try{ dqNote('upg:' + k, 1); }catch(e){}   // 일일 퀘스트 계측(공용 입구)
  campMineRender();
  return true;
}

// 판 안의 과녁 탭 — 계산은 **campTapGain / campTapHuman 그대로**(메인 탭과 같은 축이다).
// ⛔ 여기서 따로 수식을 만들지 말 것 — 두 벌이 되면 반드시 어긋난다.
function campMineTap(ev){
  if(!_campOn || typeof G === 'undefined' || !G.tech) return;
  if(ev && ev.isTrusted === false && !window._campTapForce) return;   // 🤖 1차 방어선(메인 탭과 같은 규칙)
  let gain = campTapGain();
  if(ev && ev.isTrusted !== false) gain = Math.max(1, Math.floor(gain * campTapHuman(ev.clientX, ev.clientY)));
  G.tech.credit = (G.tech.credit || 0) + gain;
  _campTapAcc += gain;
  const C = campState(); if(C) C.tapped = (C.tapped || 0) + 1;
  if(typeof updateCurBar === 'function') updateCurBar();
  campMineFloat(gain, ev);
  campMineRender();
}

// 캔 만큼 숫자가 튀어오른다 — 눌렀다는 것이 손끝에서 눈으로 돌아오는 유일한 신호다
function campMineFloat(n, ev){
  const host = document.getElementById('campMineTap'); if(!host) return;
  const el = document.createElement('i'); el.className = 'cmPop'; el.textContent = '+' + campNum(n);
  if(ev && ev.clientX != null){ const r = host.getBoundingClientRect();
    el.style.left = Math.max(6, Math.min(r.width - 6, ev.clientX - r.left)) + 'px';
    el.style.top  = Math.max(6, Math.min(r.height - 6, ev.clientY - r.top)) + 'px'; }
  host.appendChild(el);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 900);
}

function openCampMine(){
  const el = document.getElementById('campMineSheet'); if(!el) return;
  el.classList.remove('hide'); campMineRender();
  if(typeof playSfx === 'function') playSfx('ui_open');
}
function closeCampMine(){
  const el = document.getElementById('campMineSheet'); if(el) el.classList.add('hide');
  if(typeof playSfx === 'function') playSfx('ui_close');
}
// 구매 버튼은 **위임**으로 받는다 — onclick 문자열에 따옴표를 넣으면 편집·이스케이프에서 깨진다.
if(typeof document !== 'undefined'){
  document.addEventListener('click', function(ev){
    const b = ev.target && ev.target.closest ? ev.target.closest('#campMineUpg [data-upg]') : null;
    if(!b || b.disabled) return;
    ev.preventDefault(); campUpgBuy(b.getAttribute('data-upg'));
  });
}

function campMineOpen(){ openCampMine(); }   // 별칭 — 호출부가 어느 이름을 쓰든 통하게

// 큰 수를 읽히게 — 이미 있는 것이 있으면 그것을 쓴다(표기가 두 벌이 되면 화면마다 달라진다)
function campNum(n){
  if(typeof fmtNum === 'function') return fmtNum(n);
  if(typeof numAbbr === 'function') return numAbbr(n);
  n = Math.floor(n || 0);
  return n >= 1e8 ? (n/1e8).toFixed(1)+'억' : n >= 1e4 ? (n/1e4).toFixed(1)+'만' : n.toLocaleString();
}

const CAMP_MINE_UPGS = [
  { k:'tap',    nm:'터치 강화', why:'한 번 누를 때 캐는 양' },
  { k:'gather', nm:'채취 강화', why:'일꾼이 한 번 다녀올 때 캐는 양' }
];
function campMineRender(){
  const sheet = document.getElementById('campMineSheet');
  if(!sheet || sheet.classList.contains('hide')) return;
  const have = (typeof G !== 'undefined' && G.tech) ? (G.tech.credit | 0) : 0;
  { const h = document.getElementById('campMineHead');
    if(h) h.innerHTML = (typeof resIco === 'function' ? resIco('mineral','cmIco') : '') + '<b>' + campNum(have) + '</b>'; }
  { const t = document.getElementById('campMineTap');
    if(t) t.innerHTML = (typeof resIco === 'function' ? resIco('mineral','cmBig') : '')
      + '<em class="cmGain">+' + campNum(campTapGain()) + '</em>'; }
  const box = document.getElementById('campMineUpg'); if(!box) return;
  box.innerHTML = CAMP_MINE_UPGS.map(function(u){
    const lv = campUpgLv(u.k), cost = campUpgCost(u.k), can = have >= cost;
    const next = campMileNext(lv);
    return '<div class="cmRow">'
      + '<span class="cmB"><b class="cmNm">' + u.nm + ' <i>Lv.' + lv + '</i></b>'
      + '<em class="cmWhy">' + u.why + ' · 다음 계단 Lv.' + next + '</em></span>'
      + '<button type="button" class="actBtn pri cmBuy"' + (can ? '' : ' disabled')
      + ' data-upg="' + u.k + '">'
      + (typeof resIco === 'function' ? resIco('mineral','cmC') : '') + campNum(cost) + '</button></div>'; }).join('');
  if(typeof paintIcons === 'function') paintIcons(sheet);
}

// ── 자리 비움 정산 ──────────────────────────────────────────────────────
// ⛔ "일꾼 n기 × 초당 k" 같은 식을 새로 만들지 않는다 — 화면 안에서 버는 것과 두 벌이 되면 어긋난다.
//   대신 **화면 안에서 실제로 번 속도**를 재 두고(campNoteRate), 자리를 비운 동안 그 속도로 채운다.
const CAMP_AWAY_CAP_S = 8 * 3600;   // 정산 상한 8시간 — 무한정 쌓이면 접속할 이유가 사라진다
const CAMP_AWAY_EFF = 0.5;          // 자리 비움 효율 — 보고 있을 때보다 덜 번다(들어올 이유를 남긴다)
function campNoteRate(gained, secs){
  const C = campState(); if(!C || !(secs > 0)) return;
  const r = gained / secs;
  C.rate = (C.rate > 0) ? (C.rate * 0.7 + r * 0.3) : r;   // EMA — 한 판의 운에 휘둘리지 않게
}
function campSettleAway(){
  const C = campState(); if(!C || !C.leftAt || !(C.rate > 0)) return 0;
  const secs = Math.min(CAMP_AWAY_CAP_S, Math.max(0, (Date.now() - C.leftAt) / 1000));
  C.leftAt = 0;
  const got = Math.floor(C.rate * secs * CAMP_AWAY_EFF);
  if(got > 0 && typeof G !== 'undefined' && G.tech) G.tech.credit = (G.tech.credit || 0) + got;
  return got;
}

// ── 일꾼 자동 채취 ──────────────────────────────────────────────────────
// ⚠ 관리자 건설 탭에서는 **사람이 일꾼을 골라 광맥을 클릭**해야 캔다. 그래서 캠프에 그냥
//   들어가면 일꾼이 놀고 초당 수급이 0 이다(실측: 일꾼 1기가 20초에 0). 캠프는 방치가
//   전제이므로 유휴 일꾼을 자동으로 붙인다.
// ⛔ 채취 로직을 새로 짜지 않는다 — 배정만 대신 눌러 주고 왕복·적립은 건설 탭 것을 그대로 쓴다.
//   (_techAssignGatherMineral 이 '인원이 가장 적은 광맥'으로 알아서 분배한다)
function campAutoGather(){
  if(!_campOn || typeof G === 'undefined' || !G.tech) return 0;
  if(typeof _techAssignGatherMineral !== 'function') return 0;
  const mins = (G.tech.minerals || []).filter(function(m){ return m.amount > 0; });
  if(!mins.length) return 0;
  const idle = (G.tech.ents || []).filter(function(w){
    return w.type === 'worker' && w.build == null && !w._gKind; });
  if(!idle.length) return 0;
  // ⛔ **일꾼을 가스로 보내지 않는다** (HUNT_R1 §2-3-1 「생산 — 일꾼이 필요 없다」).
  //   정제소가 **스스로** 캔다(campGasTick). 스타 원본과 다른 지점이라 헷갈리기 쉽다 —
  //   실제로 한 번 일꾼 1/4 을 가스로 보냈다가 되돌렸다(2026-08-27).
  // ⛏ **덩이별로 고르게 나눈다.** 예전에는 전부 mins[0] 한 곳에 몰아넣었고,
  //   원본의 분산(_techAssignGatherMineral)은 cap 을 모르는 채 "차 있나"만 보므로
  //   일꾼이 많아지면 한 덩이에 쌓여 줄만 섰다 — 실측: 20기·40기에서 수입이 **0** 이었다.
  //   지금 배정 수를 세어 가장 적은 덩이에 붙인다.
  const cnt = new Map();
  for(const m of mins) cnt.set(m.eid, 0);
  for(const w of (G.tech.ents || [])){
    if(w.type === 'worker' && w._gKind === 'mineral' && cnt.has(w._gEid))
      cnt.set(w._gEid, cnt.get(w._gEid) + 1);
  }
  for(const w of idle){
    let best = mins[0], bn = cnt.get(best.eid) || 0;
    for(const m of mins){ const n = cnt.get(m.eid) || 0; if(n < bn){ best = m; bn = n; } }
    _techAssignGatherMineral([w], best.eid);
    cnt.set(best.eid, bn + 1);
  }
  return idle.length;
}

// ── 캠프 시계 ───────────────────────────────────────────────────────────
// 건설 탭의 프레임 루프에는 끼어들 수 없다(16/17 수정 금지). 가벼운 자체 타이머를 둔다.
// 하는 일 둘: 새로 뽑힌 일꾼을 광맥에 붙이고, 주기적으로 저장한다.
// ⚠ 일꾼 채취량에 배수를 거는 방법 — TECH_GATHER_AMT(=8)는 16-build.js 의 const 라 못 고친다.
//   대신 **크레딧이 늘어난 만큼을 보고 차액을 얹는다.** 터치로 번 몫(_campTapAcc)은 빼고 계산한다 —
//   터치는 자기 배수를 이미 쓰므로 두 번 곱하면 안 된다.
// ⛔ 주기를 길게 잡으면 숫자가 뚝뚝 튄다. 250ms 로 촘촘히 돌리고, 배정·저장만 2초마다 한다.
const CAMP_TICK_MS = 250;
const CAMP_SLOW_EVERY = 8;      // 250ms × 8 = 2초
let _campTimer = 0, _campSlow = 0, _campLastCr = 0, _campTapAcc = 0;
function campApplyGatherMul(){
  if(typeof G === 'undefined' || !G.tech) return;
  const cur = G.tech.credit || 0;
  let delta = cur - _campLastCr;
  if(delta > 0){
    const tapPart = Math.min(delta, _campTapAcc);   // 터치 몫은 배수 대상이 아니다
    _campTapAcc -= tapPart; delta -= tapPart;
    const m = campGatherMul();
    if(delta > 0 && m > 1) G.tech.credit = cur + Math.round(delta * (m - 1));
  } else if(delta < 0){ _campTapAcc = 0; }          // 건물을 샀다 = 지출. 누적을 흘려보낸다
  // 🔁 환생 기준이 되는 **번 돈**을 여기서 센다 — 배수를 다 먹인 뒤의 실제 증가분이다.
  //    ⛔ 지출은 빼지 않는다. '얼마나 벌었나'가 기준이지 '지금 얼마 있나'가 아니다.
  { const gained = (G.tech.credit || 0) - _campLastCr;
    if(gained > 0){ const C = campState(); if(C) C.earn = (C.earn || 0) + gained; } }
  _campLastCr = G.tech.credit || 0;
}
// ── 캠프 전용 프레임 루프 ────────────────────────────────────────────────
// ⭐ **유즈맵 루프는 HOME 에서 멈춘다.** loop() 안에 이 가드가 있다:
//      if(!nemoScreenOn()){ requestAnimationFrame(loop); return; }   (14-input-fx.js:840)
//    nemoScreenOn() 은 **앱 화면이 하나라도 열려 있으면 false** 다. 캠프는 HOME(.appScreen)
//    안에 살기 때문에 늘 걸린다 → renderBuildTab 이 영원히 안 불리고 3D 건물·광맥이
//    안 그려지며 일꾼도 안 움직인다(실측: #cvMarine 그려진 픽셀 전 구간 0).
// ⛔ nemoScreenOn 에 예외를 파지 말 것 — 그 가드는 성능 때문에 **일부러** 있다
//    (원 주석: "HOME에서 이걸 안 막으면 60 → 47fps"). 유즈맵 전장까지 같이 되살아난다.
//    캠프가 필요한 건 renderBuildTab 하나뿐이므로 **자기 루프**를 따로 돈다.
let _campRAF = 0, _campLastT = 0;
// ⏱ 프레임 간격 하한(ms). 캠프 한 프레임은 **3D 1.02M 픽셀 렌더 + 맵 DOM 통째 재생성**이다
//   (실측: #cvMarine 730×1402 @dpr2 · techMapRender 가 #cstMain·#cstLabels 의 innerHTML 을
//    매 프레임 갈아 끼운다). RTS 라 60fps 가 필요 없으므로 절반만 그린다.
// ⚠ 30ms 인 이유: 스모크가 33ms 간격으로 campFrame 을 직접 부른다 — 그보다 크면 테스트가
//   프레임을 건너뛰어 계측이 어긋난다. 실제 rAF(16.7ms)에서는 두 번에 한 번 그려 ~33fps 가 된다.
const CAMP_FRAME_MS = 30;
let _campLastDraw = 0;
function campFrame(now){
  if(!_campOn){ _campRAF = 0; return; }
  const t = now || (typeof performance !== 'undefined' ? performance.now() : 0);
  // ⚠ 시계가 **뒤로 가면** 기준을 버린다. rAF 시각은 절대 뒤로 가지 않지만, 테스트는
  //   campFrame 을 가짜 시각으로 직접 부른다 — 앞선 호출이 기준을 먼 미래로 밀어 두면
  //   그 뒤의 모든 프레임이 통째로 스킵된다(실제로 휠·일꾼 검사가 그렇게 죽었다).
  if(t < _campLastDraw) _campLastDraw = 0;
  if(t - _campLastDraw < CAMP_FRAME_MS){ _campRAF = requestAnimationFrame(campFrame); return; }   // 너무 이르면 건너뛴다
  _campLastDraw = t;
  const dt = Math.min(0.05, Math.max(0, (t - (_campLastT || t)) / 1000));   // ⚠ 건너뛴 시간도 dt 에 담긴다(_campLastT 는 그릴 때만 갱신)
  _campLastT = t;
  // ⚡ **한 프레임 안에서 맵 rect 를 한 번만 잰다.** 아래 campPatchRect 설명 참고.
  _campRectC = null;
  try{
    // 기지 렌더(단일 소스 그대로) — 던전 중이면 전투 유닛을 같은 sync 에 얹어 보낸다
    if(typeof renderBuildTab === 'function') campWithBattleDraw(() => renderBuildTab(dt));
    campCombatStep(dt);                                           // ⚔ 던전 전투(0단계에서는 스스로 빠진다)
    campBarRender();                                              // 🗺 단계·라운드 배지(바뀐 것만 쓴다)
    campDrawGas2();                                               // ⛽ 오른쪽 가스 구역(캠프가 얹는다)
    campGasTick(dt);                                              // ⛽ 정제소 자동 생산
    campSyncHire(); campSyncSupply(); campSyncUnitCost();          // 👷🏠⚔ 일꾼·보급소·전투 유닛 다음 가격(보유 수에 따라)
    campSyncSheet();                                              // 🗂 시트를 늘 띄워 둔다
  } finally { _campRectC = null; }   // ⛔ 프레임 밖으로 캐시를 들고 나가지 않는다(이벤트 핸들러가 낡은 값을 본다)
  _campRAF = requestAnimationFrame(campFrame);
}
function campStartFrame(){ if(_campRAF) return; _campLastT = 0; _campLastDraw = 0; _campRAF = requestAnimationFrame(campFrame); }
function campStopFrame(){ if(_campRAF){ cancelAnimationFrame(_campRAF); _campRAF = 0; } }

function campStartTimer(){
  if(_campTimer) return;
  _campLastCr = (typeof G !== 'undefined' && G.tech) ? (G.tech.credit || 0) : 0;
  _campTapAcc = 0; _campSlow = 0;
  _campTimer = setInterval(function(){
    if(!_campOn) return;
    campApplyGatherMul();
    if(typeof updateCurBar === 'function') updateCurBar();   // 💠 번 돈이 재화 바에 바로 보이게
    if(++_campSlow >= CAMP_SLOW_EVERY){ _campSlow = 0;
      campAutoGather();    // 새 일꾼 · 고갈로 놀게 된 일꾼을 다시 붙인다
      campAutoSave(); }
  }, CAMP_TICK_MS);
}
function campStopTimer(){ if(_campTimer){ clearInterval(_campTimer); _campTimer = 0; } }

// ── 🎨 겉모습을 사냥터 것으로 ────────────────────────────────────────────
// 시스템은 건설 구역, 디자인은 사냥터 — 바닥 그림도 사냥터가 쓰던 던전 배경을 그대로 쓴다.
// ⚠ 인라인 style 이 아니라 CSS 변수로 심는다. techMapRender 가 맵 innerHTML 을 통째로
//   갈아 끼우므로 요소에 직접 준 style 은 다음 렌더에 날아간다.
// 캠프 전용 배경 — ⛔ 사냥터의 assets/backgrounds/dungeons/ 를 쓰지 않는다.
//   같은 파일을 쓰면 캠프 던전 1 을 초원으로 바꾸는 순간 사냥터 던전 1 도 같이 바뀐다.
//   파일이 없는 던전은 사냥터 배경으로 폴백한다(README 의 "없으면 타일 바닥" 규칙과 같은 결).
const CAMP_BG_DIR = 'assets/backgrounds/camp/';
const CAMP_BG_FALLBACK = 'assets/backgrounds/dungeons/';
const CAMP_BG_HAVE = {};   // 캠프 전용 '던전' 그림이 있는 번호(지금은 없다 — 전부 사냥터 것을 쓴다)
// 🏕 **0단계(캠프 그 자체)는 던전이 아니다**(2026-08-26). 예전엔 던전 1 그림을 빌려 썼는데,
//    캠프는 적이 내려오는 통로가 없는 '터전'이라 그림의 요구가 다르다 — 위쪽이 통째로 숲이다.
//    ⛔ dg 를 1 로 클램프해서 던전 1 과 공유하지 말 것. 던전 1(감염된 둥지)을 손보면 캠프가 같이 바뀐다.
const CAMP_BG_HOME = 'camp.webp';   // 0단계 전용 그림(ART.md §11-B)
function campSkin(){
  const C = campState(); if(!C) return;
  const el = document.getElementById('phone'); if(!el) return;
  const raw = (C.dg | 0);
  if(raw <= 0){   // 캠프 — 전용 그림 한 장
    const u = new URL(CAMP_BG_DIR + CAMP_BG_HOME, document.baseURI).href;
    el.style.setProperty('--campBg', "url('" + u + "')");
    return; }
  const dg = Math.max(1, Math.min(10, raw));
  // ⚠ **문서 기준 절대 URL 로 만든다.** CSS 변수 안의 상대 경로는 변수를 *선언한 곳*이 아니라
  //   *쓰는 곳*(css/30-home.css)을 기준으로 풀린다 → 'assets/…' 가 'css/assets/…' 가 된다.
  //   같은 함정을 파일 분할 때도 밟았다(커밋 「분할이 깨뜨린 상대 경로」).
  const dir = CAMP_BG_HAVE[dg] ? CAMP_BG_DIR : CAMP_BG_FALLBACK;
  const url = new URL(dir + 'dg' + dg + '.webp', document.baseURI).href;
  el.style.setProperty('--campBg', "url('" + url + "')");
}

// ── 🔍 화면 배율 ────────────────────────────────────────────────────────
// 건설 탭 기본 zoom=1 은 관리자용이라 폰 화면에서 너무 확대돼 보인다(광맥·본부가 한 화면에
// 있어도 각각이 크게 잡힌다). 캠프는 기지 전체를 한눈에 보는 게임이라 낮춘다.
// ⚠ **건설 탭은 줌 1 이 최소다** — techMinZoom() 이 관리자(=캠프)에게 1 을 돌려준다.
//   그리고 클램프가 m=(1-1/zoom)*0.5 로 팬 범위를 정하는데, zoom 1 이면 m=0 이라
//   x·y 가 0.5 에 **고정**된다 → 화면 이동이 아예 안 된다(중클릭 팬이 안 먹던 이유).
//   축소도 막힌다(0.62 를 넣어도 1 로 되돌아온다).
// ⛔ 17-build-cards.js 를 고치지 않는다 — 관리자 탭·오토배틀이 같은 함수를 쓴다.
//   캠프일 때만 두 함수를 감싼다. 규칙 자체는 원본을 그대로 따르고 **하한만 낮춘다.**
// 🔎 화면 배율과 칸 수 — 「맵을 1.5배 넓게 쓴다 = 안의 요소를 1/1.5 로 줄인다」
//
// 화면에 보이는 셀 폭 = (격자폭 0.88 / 칸수) × zoom 이다. 두 값을 함께 정해야 한다.
//   ① zoom = 1 → 격자가 화면을 꽉 채운다. 0.62 였을 때는 좌우 23%씩이 격자 밖 빈 배경이었다.
//   ② 칸수 = 20 × 1.5 ÷ 0.62 ≈ 48 → 예전 화면(20칸 @0.62)과 견줘 셀이 정확히 1/1.5 로 작아진다.
//      (0.88/48)×1 = 0.01833  vs  (0.88/20)×0.62 = 0.02728  →  비 0.672
// ⛔ TECH_GRID.cols 를 직접 고치지 말 것. renderBuildTab 의 _cellK 가
//   `_techCW() / ((x1-x0)/TECH_GRID.cols)` 로 **20칸을 기준선 삼아** 유닛 크기를 정한다
//   (js/14-input-fx.js). 상수를 바꾸면 기준선도 같이 움직여 _cellK 가 1 로 남고
//   건물만 작아지고 **유닛은 그대로**인 어긋난 화면이 된다.
//   techCols() 만 감싸면 분모가 20 으로 남아 유닛도 같은 비율로 줄어든다(실측 _cellK 0.417).
const CAMP_ZOOM = 1.3;
const CAMP_COLS = 48;
// 🚧 **맵 밖이 화면에 보이지 않게 하는 한도.**
// 바닥(.bmapFloor)은 inset:0 이지만 **뷰 변환을 함께 받는다**(_techViewCSS). 그래서
// 축소하면 바닥도 같이 줄어 사방에 빈 공간이 뚫린다 — 실측: zoom 0.5 에서 바닥이
// 183×270 으로 줄어 365×540 화면의 가운데에만 남았다. zoom 1 에서 정확히 화면을 덮는다.
//   → 축소 하한 = 1.
// 팬도 마찬가지다. 원본 클램프 m=(1-1/zoom)×0.5 는 **바닥이 화면을 덮는 최대 범위**와 정확히
// 같다(z 배 커진 바닥의 가장자리가 화면 가장자리에 닿는 지점). 그래서 원본 식을 그대로 쓰면
// 어떤 줌에서도 밖이 안 보인다. ⛔ 여기에 여유를 더하면(예전 CAMP_PAN_FREE) 그만큼 밖이 뚫린다.
// ⚠ 맞바꿈: zoom 1(=하한)에서는 m=0 이라 **화면 이동이 안 된다.** 밖을 안 보이게 하는 것과
//   하한에서 움직이는 것은 양립하지 않는다 — 이동하려면 확대해야 한다(RTS 표준 동작).
const CAMP_MIN_ZOOM = 1;   // = 바닥이 화면을 딱 덮는 배율. 더 줄이면 맵 밖이 뚫린다(위 설명)
let _campZoomPatched = null;
let _campRectC = null;
let _campPanMode = false;   // 🖐 화면 이동 모드가 켜져 있나(롱프레스로 켜고 탭으로 끈다)
let _campPanDown = null;    // 모드 중 눌린 손가락(움직였는지 판정용)
let _campPanJustOn = false; // 방금 롱프레스로 켰다 — 그 손가락의 up 은 탭이 아니다
let _campLongT = null, _campLongFrom = null;   // 롱프레스 타이머    // 이번 프레임의 맵 rect(campFrame 이 비운다) — 위 campPatchRect 설명
function campPatchZoom(){
  if(_campZoomPatched || typeof window === 'undefined') return;
  const oMin = window.techMinZoom, oClamp = window._techClampView, oCols = window.techCols;
  const oRect = window._btRect;
  if(typeof oMin !== 'function' || typeof oClamp !== 'function' || typeof oCols !== 'function'
     || typeof oRect !== 'function') return;
  _campZoomPatched = { techMinZoom:oMin, _techClampView:oClamp, techCols:oCols, _btRect:oRect };
  // ⚡ **맵 rect 를 프레임당 한 번만 잰다 — 랙의 주범이었다.**
  //   _techGA() 가 _btRect()(=getBoundingClientRect)를 부르고, _techCH() 가 _techGA() 를 부르며,
  //   _techCH() 는 유닛·광맥·건물마다 불린다. 같은 프레임에 techMapRender 가 innerHTML 을
  //   통째로 갈아 끼우므로 레이아웃이 무효화되고, 그 뒤의 rect 읽기가 전부 **강제 동기 레이아웃**이 된다.
  //   실측: 엔티티가 본부+일꾼 둘뿐인데도 프레임당 22.7회. 유닛이 늘면 선형으로 늘어난다.
  //   맵 크기는 한 프레임 안에서 변하지 않으므로 캐시가 안전하다.
  window._btRect = function(){
    if(!_campOn) return oRect.apply(this, arguments);
    return _campRectC || (_campRectC = oRect.apply(this, arguments));
  };
  window.techMinZoom = function(){ return _campOn ? CAMP_MIN_ZOOM : oMin.apply(this, arguments); };
  // 격자를 촘촘하게 = 같은 화면에 더 넓은 구역. 셀이 작아지면 건물 발판(_techCW 비례)과
  // 유닛(_cellK 비례)이 함께 줄고, 배치 상수(CAMP_ROW_*)는 비율이라 저절로 따라온다.
  window.techCols = function(){ return _campOn ? CAMP_COLS : oCols.apply(this, arguments); };
  // 🖱 휠은 경로가 둘이다(#vBuild 리스너 + 캠프의 window 캡처). 같은 이벤트를 두 번 처리하면
  //   한 번 굴릴 때 두 단계씩 줌된다 — 이벤트에 표시를 남겨 한 번만 처리한다.
  const oWheel = window.techWheel;
  if(typeof oWheel === 'function'){
    _campZoomPatched.techWheel = oWheel;
    window.techWheel = function(ev){
      if(_campOn && ev){ if(ev.__campWheel) return; ev.__campWheel = true; }
      return oWheel.apply(this, arguments);
    };
  }
  campPatchWheel();
  // 🖐 **화면 이동 모드 — 빈 바닥 0.5초 롱프레스로 켜고, 탭으로 끈다.**
  //
  //   왜 모드인가(사용자 화면 실측으로 확정된 사슬):
  //   ① 사용자는 터치 모드로 본다(pointerdown type=touch · maxTouch=5 · 폭 375).
  //   ② 터치 변환은 중클릭 이벤트를 아예 만들지 않는다(진단 pointerdown:— → btn=0 만 옴).
  //   ③ Shift+드래그 우회도 죽는다 — 에뮬레이션이 두 손가락 핀치로 바꿔 보낸다.
  //   → 버튼·키보드 조합은 전부 못 쓴다. 손가락 하나로 되어야 한다.
  //
  //   ⛔ **그렇다고 빈 바닥 드래그를 팬으로 쓰면 안 된다** — 거긴 이미 드래그 박스 유닛 지정이
  //     있다(원본 _btBox). 한 제스처에 두 뜻을 담으면 반드시 하나가 죽는다.
  //     그래서 **모드**로 가른다: 롱프레스로 켜면 그때부터 드래그가 팬이고, 박스 지정은 쉰다.
  //
  //   규칙(사용자 확정):
  //   · 빈 바닥을 0.5초 누르고 있으면 → 화면 이동 모드 ON
  //   · 손을 떼도 유지 → 다음 스와이프도 화면 이동
  //   · 그냥 탭하거나(바닥·유닛·건물 무엇이든) → OFF. 그 탭은 원본에 그대로 흘려 보내
  //     선택·채집이 정상 동작한다(모드가 조작을 삼키지 않는다).
  const oDown = window.techPtrDown, oMove = window.techPtrMove, oUp = window.techPtrUp;
  if(typeof oDown === 'function' && typeof oMove === 'function' && typeof oUp === 'function'){
    _campZoomPatched.techPtrDown = oDown;
    _campZoomPatched.techPtrMove = oMove;
    _campZoomPatched.techPtrUp = oUp;

    window.techPtrDown = function(ev){
      if(_campOn && _campPanMode && ev && ev.button !== 1 && typeof techPanStart === 'function'){
        // ⭐ **대상 판별은 여기(down)서 한다.** 유닛·건물·자원을 눌렀으면 모드를 끄고 원본에 넘긴다
        //   — 그러면 선택·채집이 원본 규칙 그대로 일어난다(재전달 같은 잔재주가 필요 없다).
        if(!campEmptyAt(ev.clientX, ev.clientY)){
          campPanMode(false);
          return oDown.apply(this, arguments);
        }
        // 빈 바닥 = 팬. 움직였는지는 up 에서 본다(제자리면 '지정 해제 탭'으로 되돌린다).
        _campPanDown = { id:ev.pointerId, x:ev.clientX, y:ev.clientY };
        _btPtrs.set(ev.pointerId, { x:ev.clientX, y:ev.clientY });
        techPanStart(ev);
        return;
      }
      const ret = oDown.apply(this, arguments);
      // 빈 바닥을 눌렀나 — **좌표로 직접 판정한다.**
      // ⛔ _btBox(원본의 드래그 박스)로 판별하면 안 된다. 캠프는 시트를 채우려고 늘 본부를
      //   자동 선택해 두는데(campSyncSheet), 그러면 빈 바닥 탭이 원본의 "건물 지정 해제"
      //   경로로 먼저 소비되어(17-build-cards.js:685) _btBox 가 **영영 서지 않는다**.
      //   실측: 그 판별자로는 롱프레스가 한 번도 안 걸렸다.
      if(_campOn && !_campPanMode && !_btPan && !_btCmd && !_btArm && ev
         && campEmptyAt(ev.clientX, ev.clientY)){
        campPanArm(ev);
      }
      return ret;
    };

    window.techPtrMove = function(ev){
      // 끌기 시작하면 롱프레스 취소 — 끌었다는 건 박스 지정을 하겠다는 뜻이다
      if(_campLongT && ev && _campLongFrom && ev.pointerId === _campLongFrom.id
         && Math.hypot(ev.clientX - _campLongFrom.x, ev.clientY - _campLongFrom.y) > 8) campPanDisarm();
      return oMove.apply(this, arguments);
    };

    window.techPtrUp = function(ev){
      campPanDisarm();
      if(_campOn && _campPanMode && _campPanDown && ev && ev.pointerId === _campPanDown.id){
        const moved = Math.hypot(ev.clientX - _campPanDown.x, ev.clientY - _campPanDown.y) > 8;
        _campPanDown = null;
        // ⚠ **모드를 켠 그 손가락이 떨어지는 것은 탭이 아니다.** 롱프레스는 제자리에서 일어나므로
        //   거리로만 재면 moved=false 가 되어 켜자마자 다시 꺼진다(실측: 650ms 후 ON → up 후 OFF).
        //   사용자 규칙은 "손을 떼도 유지" 다 — 그 한 번만 탭 판정을 건너뛴다.
        if(_campPanJustOn){ _campPanJustOn = false; return oUp.apply(this, arguments); }
        if(!moved){
          // 빈 바닥을 제자리에서 눌렀다 뗐다 = 탭 → 모드를 끄고 그 탭을 원본에 넘긴다(지정 해제).
          // ⚠ 재전달은 **지금 이벤트**로 한다 — 예전에 _campPanDownEv(모드를 켤 때의 빈 바닥
          //   좌표)를 넘겼다가, 엉뚱한 자리를 누른 것이 되어 선택이 안 됐다.
          campPanMode(false);
          _btPan = null; _btPtrs.delete(ev.pointerId);
          oDown.call(window, ev);
          return oUp.apply(this, arguments);
        }
      }
      return oUp.apply(this, arguments);
    };
  }
  window._techClampView = function(v){
    if(!_campOn) return oClamp.apply(this, arguments);
    v = v || (G.tech && G.tech.view); if(!v) return;
    v.zoom = Math.max(CAMP_MIN_ZOOM, Math.min(techMaxZoom(), v.zoom));
    // 팬 여지 = 바닥이 화면을 덮는 한도(위 설명). 원본과 같은 식이되 음수만 막는다.
    const m = Math.max(0, (1 - 1 / v.zoom) * 0.5);
    // ⛔ 시트 몫으로 시점을 내리지 않는다 — **맵 뷰포트(#cstMain)가 이미 시트 위에서 끝난다**
    //   (campMountView 가 시트를 맵 밖으로 꺼내 그 순환을 풀었다). 여기서 또 내리면 두 벌이 된다.
    v.x = Math.max(0.5 - m, Math.min(0.5 + m, v.x));
    v.y = Math.max(0.5 - m, Math.min(0.5 + m, v.y));
  };
}
// ── 🖱 휠 줌 — 전달 경로를 이중화한다 ─────────────────────────────────
// 건설 탭의 휠은 **#vBuild 에 addEventListener 로 딱 한 번** 걸린다(js/14-input-fx.js).
// 반면 탭·드래그는 .bmap 의 인라인 onpointerdown 이라 techMapRender 가 맵 DOM 을 매 프레임
// 새로 만들 때마다 함께 되살아난다. 그래서 **포인터는 되는데 휠만 안 먹는** 상태가 가능하다
// (커서 아래 요소가 매 프레임 교체되는 화면에서 버블 경로 하나에만 기대는 구조).
//
// 원인을 코드로 재현하지 못했으므로 — G.tab · 리스너 등록 · hit-test · 덮개를 전부 재서
// 정상이었다 — **경로를 하나 더 둬서** 무엇이 막든 통하게 한다. window 캡처 단계라
// 중간에서 누가 stopPropagation 을 해도 먼저 받는다.
// ⛔ 시트 안에서는 손대지 않는다 — 거기 휠은 시트 자신의 스크롤이다.
let _campWheel = null;
function campPatchWheel(){
  if(_campWheel || typeof window === 'undefined') return;
  _campWheel = function(e){
    if(!_campOn || typeof techWheel !== 'function') return;
    const sh = document.getElementById('btSheet');
    // ⚠ target 이 Element 일 때만 contains 를 쓴다 — Node 가 아닌 것(window 등)을 넘기면
    //   Node.contains 가 TypeError 를 던져 리스너가 통째로 죽는다.
    const tg = e.target;
    if(sh && sh.classList.contains('open') && tg && tg.nodeType === 1 && sh.contains(tg)) return;   // 시트 스크롤 존중
    const r = _btRect(); if(!r || !r.width) return;
    if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    techWheel(e);
  };
  window.addEventListener('wheel', _campWheel, { passive:false, capture:true });
}
function campUnpatchWheel(){
  if(!_campWheel) return;
  window.removeEventListener('wheel', _campWheel, { capture:true });
  _campWheel = null;
}
function campUnpatchZoom(){
  if(!_campZoomPatched) return;
  campUnpatchWheel();
  campPanDisarm(); campPanMode(false); _campPanDown = null; _campPanJustOn = false;   // 🖐 모드를 들고 나가지 않는다
  for(const k in _campZoomPatched) window[k] = _campZoomPatched[k];
  _campZoomPatched = null;
}
function campZoom(){
  if(typeof G === 'undefined' || !G.tech) return;
  const v = G.tech.view || (G.tech.view = { x:0.5, y:0.5, zoom:1 });
  // 축소 상태에서는 클램프가 x·y 를 0.5 로 고정한다(전체가 보이므로 팬 여지가 없다).
  //   기지가 아래쪽에 오는 것은 시점이 아니라 **배치**가 만든다(campLayBase).
  v.zoom = CAMP_ZOOM; v.x = 0.5; v.y = 0.5;
  if(typeof _techClampView === 'function') _techClampView(v);   // 줌 하한 등 규칙을 즉시 반영
  if(typeof techViewT === 'function'){ const t = techViewT(); if(t){ t.zoom = v.zoom; t.x = v.x; t.y = v.y; } }
}

// ── 🗂 하단 시트 상시 표시 ──────────────────────────────────────────────
// 유즈맵 하단 프로필 구역처럼 **늘 자리를 차지한다**(건물을 고르면 그 안에 생산·연구 카드가 뜬다).
// ⚠ 맵(#vBuild)이 시트에 가리지 않도록 실제 높이를 CSS 변수로 흘린다 —
//   값을 CSS 에 상수로 박으면 시트 내용이 바뀔 때 어긋난다.
function campSyncSheet(){
  const sh = document.getElementById('btSheet'); if(!sh) return;
  const T = G.tech;
  // 🗺 **배치·랠리 지정 중에는 시트를 내린다** — 맵을 넓게 보며 지을 자리를 고르는 동작이고,
  //   techPanelRender 가 이미 그렇게 한다(17-build-cards.js: _shown 에 arm==null 조건).
  //   ⛔ 여기서 .open 을 무조건 붙이면 그 동작을 매 프레임 덮어써 시트가 안 내려간다.
  if(T && (T.arm != null || T.rallySet != null)) return;     // 높이도 건드리지 않는다(맵은 화면 전체라 무관)
  sh.classList.add('open');                                  // #btSheet.open → transform:translateY(0)
  if(T){
    // 시트를 늘 열어 두므로 **내용도 늘 있어야** 한다. 아무것도 안 골랐으면 **기지 요약**을 보여 준다.
    // ⛔ 예전에는 여기서 **본부를 대신 골랐다**(2026-08-25 교체). 그러면 「고르지 않은 상태」가
    //    아예 없어서 늘 본부 카드만 보였다 — 지금은 요약 카드가 그 자리를 맡는다.
    //    요약을 그리는 곳은 renderCampIdleSheet() 하나뿐이다(js/11-cmdcard.js · 공용 renderCmdGrid 사용).
    // ⚠ 이때 techPanelRender 는 model 이 null 이라 시트 본문을 건드리지 않는다 — 요약이 덮이지 않는다.
    //    (건물을 고르면 그쪽이 body 를 다시 그리고, 해제하면 요약이 스스로 되살아난다)
    // ⛔ 배치·스킬 조준 중에는 건드리지 않는다 — 조준 대상이 바뀌어 버린다.
    const idle = T.sel == null && !(T.selU && T.selU.length) && !T.selRes && !T.arm && !T.skillArm;
    if(idle){
      const st = T.sheet || (T.sheet = {open:false, sec:null}); st.open = false; st.sec = null;
      // ⚠ 높이 클래스(.simple)를 직접 붙인다 — techPanelRender 는 '보여 줄 모델이 있을 때만' 붙이는데
      //   요약은 그쪽 모델이 아니다. 안 붙이면 시트가 내용대로 커져 **기지를 가린다**(실측으로 걸렸다).
      sh.classList.add('simple');
      if(typeof renderCampIdleSheet === 'function') renderCampIdleSheet();
    }
  }
}
// ⛔ 예전에는 여기서 시트 높이를 --campSheetH 로 흘려 맵 높이를 줄였다. 지금은 맵이 화면 전체를
//   쓰므로 그 값을 아무도 안 본다 — 매 프레임 offsetHeight 를 읽는 것은 **강제 동기 레이아웃**만
//   일으키는 순손해라 걷어냈다.
// 본부 한 채 — 시트의 기본 대상. 종족마다 키가 달라 TECH_TREE 의 첫 건물(=본부)로 찾는다
function campHQ(){
  const T = G.tech; if(!T || !T.ents) return null;
  const tree = (typeof TECH_TREE !== 'undefined') && TECH_TREE[T.race];
  const key = tree && tree.buildings && tree.buildings[0] && tree.buildings[0].key;
  let hq = key && T.ents.find(e => e.type === 'bldg' && e.key === key && !(e.bt > 0));
  if(!hq) hq = T.ents.find(e => e.type === 'bldg' && !(e.bt > 0));   // 본부가 없으면 완성된 아무 건물
  return hq || null;
}
function campClearSheet(){
  const sh = document.getElementById('btSheet'); if(sh) sh.classList.remove('open');
  const el = document.getElementById('phone'); if(el) el.style.removeProperty('--campSheetH');   // 옛 값이 남아 있으면 지운다
}

// 셀 축소 비 — renderBuildTab 의 _cellK 와 **같은 식**이어야 한다(js/14-input-fx.js).
// 관리자 20칸을 기준선 삼아 "격자가 얼마나 촘촘해졌나"를 재고, 유닛·미네랄이 그만큼 작아진다.
function campCellK(){
  if(typeof TECH_GRID === 'undefined' || typeof _techCW !== 'function') return 1;
  const base = (TECH_GRID.x1 - TECH_GRID.x0) / TECH_GRID.cols;
  return base ? (_techCW() / base) : 1;
}

// ── 🖐 화면 이동 모드 ───────────────────────────────────────────────────
// 켜고 끄는 입구는 여기 하나. 표시(안내·테두리)도 같이 맡는다.
const CAMP_PAN_HOLD_MS = 500;   // 사용자 확정: 빈 바닥 0.5초
function campPanMode(on){
  if(_campPanMode === !!on) return;
  _campPanMode = !!on;
  const m = document.getElementById('cstMain');
  if(m) m.classList.toggle('campPan', _campPanMode);
  if(typeof toast === 'function') toast(_campPanMode ? '🖐 화면 이동 — 탭하면 해제' : '👆 지정 모드');
  if(_campPanMode && typeof playSfx === 'function') playSfx('ui_open');
}
// 빈 바닥을 눌렀다 — 0.5초 버티면 모드 ON
function campPanArm(ev){
  campPanDisarm();
  _campLongFrom = { id:ev.pointerId, x:ev.clientX, y:ev.clientY };
  _campLongT = setTimeout(function(){
    _campLongT = null;
    if(!_campOn) return;
    campPanMode(true);
    _campPanJustOn = true;   // 이 손가락이 떨어질 때는 탭으로 치지 않는다(위 techPtrUp 설명)
    // 누르고 있는 그 손가락을 **곧바로 팬으로 넘긴다** — 손을 뗐다 다시 끌 필요가 없다.
    if(_campLongFrom && _btPtrs.has(_campLongFrom.id) && typeof techPanStart === 'function'){
      _btBox = null;   // 혹 서 있으면 걷는다(박스 지정과 팬이 겹치지 않게)
      _campPanDown = { id:_campLongFrom.id, x:_campLongFrom.x, y:_campLongFrom.y };
      techPanStart({ clientX:_campLongFrom.x, clientY:_campLongFrom.y, pointerId:_campLongFrom.id });
    }
  }, CAMP_PAN_HOLD_MS);
}
function campPanDisarm(){
  if(_campLongT){ clearTimeout(_campLongT); _campLongT = null; }
  _campLongFrom = null;
}

// 이 화면 좌표에 **고를 것이 없나**(= 빈 바닥인가). 롱프레스로 화면 이동 모드를 켤 자리인지 가른다.
// ⛔ 판정 로직을 새로 쓰지 않는다 — 원본 히트 판정 함수(_techMineralAt · _techBldgRectAt)를
//   그대로 부르고, 유닛만 셀 크기로 훑는다(원본에 단일 진입점이 없다).
function campEmptyAt(cx, cy){
  if(typeof G === 'undefined' || !G.tech) return false;
  const r = _btRect(); if(!r || !r.width) return false;
  if(cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false;
  const sx = (cx - r.left) / r.width, sy = (cy - r.top) / r.height;
  if(sy < 0.13) return false;                                   // 상단바 — techPtrDown 과 같은 규약
  const w = _techS2W(sx, sy);
  if(typeof _techMineralAt === 'function' && _techMineralAt(w.x, w.y)) return false;
  if(typeof _techBldgRectAt === 'function' && _techBldgRectAt(w.x, w.y)) return false;
  const cw = _techCW(), ch = _techCH();
  for(const e of (G.tech.ents || [])){
    if(e.type === 'bldg') continue;
    if(Math.abs(e.x - w.x) <= cw && Math.abs(e.y - w.y) <= ch) return false;   // 유닛·일꾼·라바·알
  }
  return true;
}

// ── 👷 일꾼 고용 — 마리마다 비싸진다 (HUNT_R1 §1-1-2) ────────────────────
// `140 × 1.65^n` · 31마리째부터 계단을 ×1.10 으로 눕힌다 · 상한 40마리 · **시작 0기**.
// ⚠ 배수를 그대로(×1.65) 두면 40마리째가 424억이라 200회차 안에도 못 채운다 —
//   눕혀서 7.4억(약 19회차)으로 만들었다. 일꾼 수가 「며칠짜리 벽」이 아니라 「중기 목표」다.
// ⛔ 비용은 TECH_TREE 의 produces[].m 에 들어 있고 그건 관리자 탭·오토배틀과 **공유**다.
//   캠프가 값을 갈아 끼우되 나갈 때 **반드시 되돌린다**(TECH_GAS 와 같은 규약).
const CAMP_HIRE0 = 140, CAMP_HIRE_R = 1.65;      // n마리 보유 → 다음 마리 가격
const CAMP_HIRE_KNEE = 30, CAMP_HIRE_R2 = 1.10;  // 31마리째부터 완만하게
const CAMP_WORKER_MAX = 40;                      // 일꾼 상한
function campHireCost(n){
  const k = CAMP_HIRE_KNEE - 1;                  // 30마리째 = 보유 29
  const cost = (n < k) ? CAMP_HIRE0 * Math.pow(CAMP_HIRE_R, n)
                       : CAMP_HIRE0 * Math.pow(CAMP_HIRE_R, k) * Math.pow(CAMP_HIRE_R2, n - k);
  return Math.max(1, Math.ceil(cost));
}
function campWorkerN(){
  if(typeof G === 'undefined' || !G.tech) return 0;
  return (G.tech.ents || []).filter(function(e){ return e.type === 'worker'; }).length;
}
// ── 🏠 보급소 — 지을수록 비싸진다 (HUNT_R1 §2-2) ────────────────────────
// `3만 × 1.20^n` · 한 채당 인구 +8 · 24채(=설계의 24레벨)에서 인구 202(본부 10 + 192).
// ⚠ 설계 문구는 「한 채를 레벨업」이다. 지금은 **여러 채를 짓되 값이 누진**하는 형태로 넣었다 —
//   수치(비용·인구·누적 1,177만)는 같고, 한 채 레벨업 UI 는 별도 작업이다.
const CAMP_SUPPLY0 = 30000, CAMP_SUPPLY_R = 1.20, CAMP_SUPPLY_MAX = 24;
function campSupplyCost(n){ return Math.max(1, Math.ceil(CAMP_SUPPLY0 * Math.pow(CAMP_SUPPLY_R, n))); }
function campSupplyN(){
  if(typeof G === 'undefined' || !G.tech) return 0;
  return (G.tech.built && G.tech.built.supply) | 0;
}
// 일꾼·보급소 가격을 지금 상태에 맞춰 갱신 — 매 프레임 부른다(카드가 그 값을 읽는다)
let _campHireHome = null, _campSupHome = null;
function campSyncSupply(){
  if(typeof G === 'undefined' || !G.tech || typeof TECH_TREE === 'undefined') return;
  const t = TECH_TREE[G.tech.race]; if(!t || !t.buildings) return;
  const b = t.buildings.find(function(x){ return x.k === 'supply'; }); if(!b) return;
  if(!_campSupHome) _campSupHome = { b: b, m: b.m, g: b.g };
  b.m = campSupplyCost(campSupplyN()); b.g = 0;
}
function campRestoreSupply(){
  if(!_campSupHome) return;
  _campSupHome.b.m = _campSupHome.m; _campSupHome.b.g = _campSupHome.g;
  _campSupHome = null;
}
function campSyncHire(){
  if(typeof G === 'undefined' || !G.tech || typeof TECH_TREE === 'undefined') return;
  const t = TECH_TREE[G.tech.race]; if(!t || !t.buildings) return;
  const wk = (typeof TECH_WORKER !== 'undefined') ? TECH_WORKER[G.tech.race] : null; if(!wk) return;
  let q = null;
  for(const b of t.buildings){ const f = (b.produces || []).find(function(x){ return x.id === wk; }); if(f){ q = f; break; } }
  if(!q) return;
  if(!_campHireHome) _campHireHome = { q: q, m: q.m, g: q.g };
  q.m = campHireCost(campWorkerN());
  q.g = 0;
}
function campRestoreHire(){
  if(!_campHireHome) return;
  _campHireHome.q.m = _campHireHome.m; _campHireHome.q.g = _campHireHome.g;
  _campHireHome = null;
}
// ── ⚔ 반복 구매 — 같은 유닛을 살수록 비싸진다 (HUNT_R1 §3-3 · 2026-08-27) ──
// `기본가 × 1.15^(이미 보유한 같은 유닛 수)`.
// ⭐ **이게 없으면 「제일 센 유닛 도배」가 늘 정답이다.** 크기·데미지 타입 상성(§3-2)과
//   적 티어 구성(§6-2-0)이 통째로 이 규칙에 기대고 있다 — 조합을 강제하는 유일한 장치다.
// ⚠ 배수 1.10 은 약했다(도배↔골고루 7배). 1.15 로 16배가 된다 — 인구까지 세고 나온 값이다.
// ⛔ 값은 TECH_TREE 의 produces[].m/g 에 있고 관리자 탭·오토배틀과 **공유**다 — 나갈 때 되돌린다.
// ⚠ 보유 수 = 기지에 있는 것(G.tech.units) + **전장에 나가 있는 것**. 전장 것을 안 세면
//   출격할 때마다 값이 처음으로 돌아가 규칙이 통째로 무력해진다.
const CAMP_UNIT_R = 1.15;
// ── 💰 캠프 기본가 — HUNT_R1 §3-1 표 (2026-08-27) ────────────────────────
// ⛔ **코드 값이 설계표의 1/100 ~ 1/800 이었다.** 그래서 반복 구매(×1.15)가 안 물었다 —
//   레인저 50 짜리는 초당 수입 8,781 에 견줘 공짜라, 36기를 사고 나서야 처음 비싸진다.
//   배수가 약한 게 아니라 **기본가가 수입에 비해 작았다.**
// ⚠ 캠프 전용이다. TECH_TREE 값을 프레임마다 갈아 끼우고 나갈 때 되돌린다(관리자 탭·오토배틀 공유).
// ⛔ **가스는 건드리지 않는다.** 설계표(§3-1)는 「미네랄만」이라고 못 박았고 가스 규칙은 §2-3-2 인데
//   아직 안 나왔다. 미네랄이 오른 비율만큼 가스도 올렸더니 **화력병 가스 5,000** 이 되어
//   가스 유닛을 한 기도 못 샀다(실측 2026-08-27: 25분 내내 마린만 나왔다). 원값 그대로 둔다.
const CAMP_UNIT_PRICE = {
  // 유니온 (§3-1)
  marine:5000, machinegun:10000, racer:8000, goliath:20000, ghost:20000, medic:20000,
  pelican:25000, aegis:20000, tank:35000, skyguard:35000, hellfire:50000, dreadnought:100000,
  // 스웜 (§3-A) — ⭐ 싸고 얇다. 인구 1짜리가 둘이라 머릿수로 민다
  snapper:4000, hydra:6000, stinger:8000, wyvern:16000, medusa:18000, ultralisk:55000, overlord:10000,
  // 에테리얼 (§3-B) — ⭐ 비싸고 두껍다(실드를 체력에 합쳐 본다)
  blade:12000, dragoon:18000, dark_templar:25000, falcon:22000, skydancer:30000, reaver:45000,
  kronos:50000, archangel:90000, high_templar:20000, seraph:25000, observer:12000 };
// ⚠ 표에 없는 종족(야수·기계 등)은 아직 설계표가 없다 — 일률 배수를 쓴다.
//   유니온 12종의 「설계가 ÷ 코드가」 중앙값이 약 216배라 200 을 골랐다. 표가 나오면 위에 채운다.
const CAMP_UNIT_PRICE_MUL = 200;
// ⛽ **유닛에는 가스가 안 든다** (2026-08-27 확정 — 축 분리).
//   ⭐ **미네랄 = 양(유닛·일꾼·건물) / 가스 = 질(강화·해금).** 유닛은 '양' 쪽이다.
//   ⛔ 되살리지 말 것 — 가스는 늘 모자란 자원이라, 유닛과 연구가 나눠 쓰면 **연구가 굶는다.**
//     상위 유닛의 뚜껑은 **반복 구매 ×1.15**(`campUnitCost`)가 이미 맡고 있다.
//   ⚠ 옛 값(§2-3-2 · 원본 ÷10)은 되돌릴 때를 위해 남긴다 —
//     machinegun 3 · medic 3 · goliath 5 · ghost 8 · tank 10 · skyguard 10 ·
//     hellfire 13 · pelican 10 · aegis 10 · dreadnought 30
const CAMP_UNIT_GAS = {};
function campUnitBase(id, m){ const v = CAMP_UNIT_PRICE[id];
  return (v != null) ? v : Math.round((m || 0) * CAMP_UNIT_PRICE_MUL); }
function campUnitOwned(id){
  let n = (typeof G !== 'undefined' && G.tech && G.tech.units) ? (G.tech.units[id] | 0) : 0;
  if(typeof CAMPB !== 'undefined' && CAMPB){
    const cnt = (L) => { let k = 0; for(const u of (L || [])){ if(u && !u.dead && (u.id === id || u.gm === id)) k++; } return k; };
    n += cnt(CAMPB.me && CAMPB.me.units) + cnt(CAMPB._down);
  }
  return n;
}
function campUnitCost(base, id){ return Math.max(1, Math.ceil((base || 0) * Math.pow(CAMP_UNIT_R, campUnitOwned(id)))); }
let _campUnitHome = null;
function campSyncUnitCost(){
  if(typeof G === 'undefined' || !G.tech || typeof TECH_TREE === 'undefined') return;
  const t = TECH_TREE[G.tech.race]; if(!t || !t.buildings) return;
  const wk = (typeof TECH_WORKER !== 'undefined') ? TECH_WORKER[G.tech.race] : null;
  if(!_campUnitHome){ _campUnitHome = [];
    for(const b of t.buildings) for(const q of (b.produces || [])){
      if(q.id === wk) continue;                       // 👷 일꾼은 campSyncHire 가 맡는다(두 곳에서 만지면 어긋난다)
      _campUnitHome.push({ q: q, m: q.m, g: q.g }); } }
  for(const h of _campUnitHome){
    const base = campUnitBase(h.q.id, h.m);                    // 💰 설계표 값(없으면 일률 배수)
    h.q.m = campUnitCost(base, h.q.id);
    const gas = CAMP_UNIT_GAS[h.q.id];                         // ⛽ 설계표(§2-3-2) · 없으면 가스 안 듦
    h.q.g = gas ? campUnitCost(gas, h.q.id) : 0;
  }
}
function campRestoreUnitCost(){
  if(!_campUnitHome) return;
  for(const h of _campUnitHome){ h.q.m = h.m; h.q.g = h.g; }
  _campUnitHome = null;
}
// 상한 — 일꾼 40기 · 보급소 24채를 넘기지 못하게 한다.
// ⛔ TECH_TREE 의 req 를 조작하지 않는다(「선행: undefined」 같은 안내가 나온다).
let _campProdHome = null, _campArmHome = null;
function campPatchArm(){
  if(_campArmHome || typeof window === 'undefined') return;
  const o = window.techArm; if(typeof o !== 'function') return;
  _campArmHome = o;
  window.techArm = function(bk){
    if(_campOn && bk === 'supply' && campSupplyN() >= CAMP_SUPPLY_MAX){
      if(typeof toast === 'function') toast('⛔ 보급소는 ' + CAMP_SUPPLY_MAX + '채까지(인구 202)');
      return;
    }
    return o.apply(this, arguments);
  };
}
function campUnpatchArm(){
  if(!_campArmHome) return;
  window.techArm = _campArmHome; _campArmHome = null;
}
function campPatchProduce(){
  if(_campProdHome || typeof window === 'undefined') return;
  const o = window.techDoProduce; if(typeof o !== 'function') return;
  _campProdHome = o;
  window.techDoProduce = function(id, bk){
    if(_campOn && typeof TECH_WORKER !== 'undefined' && G.tech && id === TECH_WORKER[G.tech.race]
       && campWorkerN() >= CAMP_WORKER_MAX){
      if(typeof toast === 'function') toast('⛔ 일꾼은 ' + CAMP_WORKER_MAX + '기까지');
      return;
    }
    return o.apply(this, arguments);
  };
}
function campUnpatchProduce(){
  if(!_campProdHome) return;
  window.techDoProduce = _campProdHome; _campProdHome = null;
}
