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
  campSkin();                                        // 🎨 바닥을 그 던전 그림으로 (아래 ⛔)
  return n; }
// ⛔ **던전이 바뀌면 campSkin() 을 반드시 부를 것**(2026-08-30). 오래도록 캠프 화면에 처음
//   들어올 때 한 번만 불려서, 50라운드를 채워 자동으로 넘어가면 바닥이 옛 그림 그대로였다.
//   부르는 곳은 셋이다: 화면 진입 · 던전 이동 · 50라운드 자동 이동.

// 라운드 하나를 깼다. 50을 채우면 **다음 던전으로 자동으로** 넘어간다.
//   ⚠ 전투(2단계)가 부를 입구다. 여기 말고 다른 곳에서 C.cleared 를 만지지 말 것.
function campClearRound(){ const C = campState(); if(!C || !((C.dg | 0) > 0)) return false;
  C.cleared = campCleared() + 1;
  if(!C.best) C.best = {};
  C.best[C.dg] = Math.max(C.best[C.dg] | 0, C.cleared);
  if(C.cleared >= CAMP_ROUND_MAX){
    if(C.dg < CAMP_DG_MAX){ C.dg++; C.cleared = 0; campSkin(); }   // 자동 이동 — 방치형이라 손이 안 가는 게 맞다
    else C.cleared = CAMP_ROUND_MAX;                    // 마지막 던전은 끝에 머문다
  }
  campSave(); return true; }

// 졌다 → **캠프(0단계)로 돌아간다.** 몇 라운드를 깼든 그 판은 끝이다.
//   ⭐ 1라운드도 못 깼으면 보너스 0 — 배율이 base 인 채로 끝난다(HUNT_R1 §6-1-0-3).
//   ⚠ best 는 지우지 않는다. 다시 내려갈 때의 목표가 된다.
// 🗑 **개발용 플래그 CAMP_DEV_NOFAIL 은 없앴다**(2026-08-30). 그것이 메우던 자리에
//   설계대로 **「병력이 없으면 던전에 못 들어간다」**(campCanEnterDungeon)가 들어왔다.
//   ⚠ 그 플래그가 필요했던 이유는 **던전을 골라도 291ms 만에 되돌아오던 것**이었다 —
//     병력 0 으로 들어가니 도착하자마자 졌다. 이제 애초에 못 들어간다.
//   ⛔ 두 장치를 함께 두지 말 것 — 어느 쪽이 막는지 헷갈린다.
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
// ⏱ **캠프의 스킬 비용은 쿨타임 하나다** (2026-08-28 사용자 확정).
//   ⭐ 캠프는 방치형 자동 전투다 — 누가 마나를 보고 있지 않다. 그래서 **마나·체력 소모를
//     전부 무시하고 쿨타임 하나로** 판단한다. 「쿨이 돌면 쓴다」가 규칙의 전부다.
//   ⛔ **`SKILLS` 표를 고쳐서 하지 말 것.** 처음엔 캠프 진입 때 마나·체력을 0 으로 덮고
//     나갈 때 되돌렸는데, 그 사이에 오토배틀이 돌면 **마나 없이 스킬을 난사한다.**
//     스모크 「오토배틀: 마법 유닛이 스킬을 알아서 쓴다」가 바로 잡아냈다.
//     ⭐ 표를 건드리지 않고 **판정하는 쪽(`js/18-strike.js`)에 캠프 문을 단다** —
//       `S.camp` 를 보는 한 줄짜리 문이라 새는 길이 없다(`strikeCheckOver` 와 같은 방식).
//   → 실제 값은 `strikeSkillCost` · `strikeSkillCd` · `strikeSkillHpCost` 세 함수가 낸다.
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

// ══ 💳 결제 팩 (2026-08-31) ═════════════════════════════════════════════
// 상점 「추천」 구역에서 현금으로 사는 영구 상품. 젬이 함께 들어 있다.
//
// ⭐ **배수는 곱이 아니라 합이다** (2026-08-31 사용자 확정).
//   지금 수입은 (1+채취레벨) × 마일스톤 × 광맥 × 환생 × 연구 로 **전부 곱**이다.
//   여기에 팩 배수를 또 곱하면 곱 항이 하나 더 늘어 폭주한다 —
//   이 프로젝트에서 실측으로 **5회 만에 ×1,900만**이 나온 전례가 있다(BALANCE §0).
//   팩 셋을 다 사도 곱이면 ×8, 합이면 ×4 다. 체감은 비슷하고 뒤가 안 터진다.
//   ⛔ gather 값을 campGatherMul 의 **곱 항으로 옮기지 말 것.** 합산 항에만 더한다.
//
// ⚠ 환생 팩만은 「획득량」에 곱한다 — 🔬 **실측으로 안전을 확인했다**(2026-08-31 · BALANCE §4-C).
//   ×2 를 영구로 걸어도 폭주하지 않는다. 이유 셋:
//     ① 배수는 **합산 누적**(C.rebMul)이라 2배가 되어도 지수가 안 된다
//     ② 배수 자체가 로그(0.8×log₁₀)라 회차당 +3~4 로 묶여 있다
//     ③ 트리는 **유한**하다(161노드 · 9.7조) — 포인트가 2배여도 천장은 안 올라가고 앞당길 뿐
//   되먹임(수입↑ → 더 깊이 → 배수↑ → …)도 **수렴한다**: 깊이 격차가 10회차 11칸에서
//   40회차 8.4칸으로 **줄어든다.** 던전 하나가 50칸 + 문턱 ×3 이라 던전을 못 건넌다.
//   ⛔ 그래도 **곱 항으로 옮기지는 말 것** — 안전한 이유가 ① 합산 누적이기 때문이다.
//
// ⚠ 값은 **초안이다** — 회수 시간·손익분기를 아직 안 쟀다(BALANCE.md §4 방식으로 잴 것).
//   이 프로젝트에서 해석적 추정은 여러 번 크게 빗나갔다.
// 💳 가격은 **젬 팩과 같은 가격대**로 맞췄다(2026-08-31) — 앱마켓 표준 구간이라
//   「이 팩이 젬 얼마어치인가」가 한눈에 견줘진다. 딸려 오는 젬도 그 구간의 젬 수와 같다.
//   ⭐ 스타터만 일부러 **가장 싸고 이득이 크다** — 첫 결제 문턱을 낮추는 것이 관례다.
const CAMP_PACKS = [
  { id:'ads',     nm:'광고 제거',   won:'₩5,500',  soon:true,
    desc:'광고 시스템이 아직 없습니다' },
  { id:'starter', nm:'스타터 팩',   won:'₩1,100',  gem:50,   gather:0.5,
    desc:'재화 획득 +50% · 젬 50' },
  { id:'epic',    nm:'에픽 팩',     won:'₩11,000', gem:600,  gather:1.5,
    desc:'재화 획득 +150% · 젬 600' },
  { id:'unique',  nm:'유니크 팩',   won:'₩33,000', gem:2000, gather:3.0,
    desc:'재화 획득 +300% · 젬 2,000' },
  { id:'reb',     nm:'환생 팩',     won:'₩22,000', gem:1300, rebMul:2, rebPt:2,
    desc:'환생 배수·포인트 ×2 (영구) · 젬 1,300' },
];
// 산 팩은 **프로필**에 남는다 — 환생해도 되감기지 않아야 한다(campRebirth 는 C 만 되감는다).
function campPacks(){ const p = (typeof PROF === 'function') ? PROF() : null;
  if(!p) return {}; if(!p.packs) p.packs = {}; return p.packs; }
function campPackOwn(id){ return !!campPacks()[id]; }
function campPackDef(id){ return CAMP_PACKS.find(function(x){ return x.id === id; }) || null; }
// 재화 획득에 **더할** 보너스(합산). 산 팩의 gather 를 전부 더한다.
function campPackGather(){ let s = 0; const own = campPacks();
  for(const P of CAMP_PACKS) if(own[P.id] && P.gather) s += P.gather;
  return s; }
// 환생 획득량 배수 — 산 팩 중 가장 큰 것 하나만 쓴다(여러 장 곱하지 않는다)
function campPackRebMul(){ let m = 1; const own = campPacks();
  for(const P of CAMP_PACKS) if(own[P.id] && P.rebMul) m = Math.max(m, P.rebMul);
  return m; }
function campPackRebPt(){ let m = 1; const own = campPacks();
  for(const P of CAMP_PACKS) if(own[P.id] && P.rebPt) m = Math.max(m, P.rebPt);
  return m; }

// ── 💠 캠프 지갑에 넣는 **유일한 입구** ──────────────────────────────────
// ⛔ PROF().pcoin / PROF().gas 에 넣지 말 것 — 그것은 **옛 사냥터 지갑**이고 캠프와 안 통한다.
//   실측(2026-08-31): 프로필 지갑에 +5555 를 넣어도 캠프 재화는 그대로였다.
// ⚠ 캠프가 도는 중에는 G.tech 가 진짜 값이고, C 는 저장본이다(campSave 가 T → C 로 덮는다).
//   그래서 **둘 중 한쪽에만** 넣어야 한다 — 양쪽에 넣으면 저장 때 한쪽이 사라지거나 두 배가 된다.
function campAddRes(min, gas){
  const C = campState(); if(!C) return false;
  const live = (typeof _campOn !== 'undefined' && _campOn
                && typeof G !== 'undefined' && G.tech);
  if(live){ if(min) G.tech.credit = (G.tech.credit || 0) + min;
            if(gas) G.tech.energy = (G.tech.energy || 0) + gas; }
  else {
    // ⛔ **C.credit 에 직접 넣지 않는다.** 캠프가 켜질 때 저장분이 없으면 새 판으로 시작하며
    //   credit 을 0 으로 덮는다 — 실측(2026-08-31): 상점에서 3,400만을 샀는데 캠프로
    //   돌아오니 G.tech.credit 이 0 이었다. **산 돈이 사라진다.**
    // ⇒ 보류함에 담아 두고 캠프가 실제로 켜진 뒤에 넣는다(campFlushPend).
    C.pend = C.pend || { m:0, g:0 };
    C.pend.m = (C.pend.m || 0) + (min || 0);
    C.pend.g = (C.pend.g || 0) + (gas || 0);
  }
  if(typeof saveMeta === 'function') saveMeta();
  if(typeof updateCurBar === 'function') updateCurBar();
  return true; }
// 캠프가 켜진 **뒤에** 보류함을 비운다 — 새 판이든 복원이든 그 뒤라야 안 덮인다.
function campFlushPend(){
  const C = campState(); if(!C || !C.pend) return 0;
  const m = C.pend.m || 0, g = C.pend.g || 0;
  C.pend = null;
  if(typeof G !== 'undefined' && G.tech){
    if(m) G.tech.credit = (G.tech.credit || 0) + m;
    if(g) G.tech.energy = (G.tech.energy || 0) + g; }
  if(m > 0 && typeof toast === 'function') toast('💠 상점에서 산 재화가 들어왔습니다');
  if(typeof saveMeta === 'function') saveMeta();
  return m; }

// ① 획득 배수 — 기존 배수에 **더한다**(곱이 아니다). 로그라 난이도가 1만 배 올라도 +3.2 만 붙는다.
function campRebMulGain(){
  return Math.max(CAMP_REB_MIN, CAMP_REB_K * Math.log10(Math.max(1, campFoeDiff(campDgN(), campCleared()))))
    * campPackRebMul(); }   // 💳 환생 팩 — 쌓이는 양만 키운다(합산 누적이라 지수가 안 된다)
// ② 획득 포인트 — 기준량(번 재화) × 깊이 배수. 재화를 2배 벌어야 1.41배다.
function campRebPtGain(){
  const base = Math.sqrt(campWealth() / CAMP_REB_COST);
  return base * Math.pow(CAMP_RP_DG, Math.max(0, campDgN() - 1)) * Math.pow(CAMP_RP_RD, campCleared())
    * campPackRebPt(); }   // 💳 환생 팩
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
  C.earn = 0; C.earnGas = 0; C.earnTap = 0; C.earnAuto = 0;
  C.credit = 0; C.energy = 0;
  C.built = {}; C.addon = {}; C.units = {}; C.research = {};
  C.sup = 0; C.supCap = 0; C.eseq = 1; C.ents = []; C.minerals = [];
  C.upg = {};                                     // 캠프 업그레이드(탭·채취)도 한 회차짜리다
  C.rate = 0; C.rateGas = 0; C.leftAt = 0; C.tapped = 0; C.playS = 0;
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
      C2.dg = 0; C2.cleared = 0; C2.earn = 0; C2.earnGas = 0;
      C2.earnTap = 0; C2.earnAuto = 0; C2.playS = 0; C2.tapped = 0; C2.upg = {}; } }
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
const CAMP_RT_BASE = 2;                     // 티어 1 기준값(비용 공식) — ⚠ root 값이 아니다(CAMP_RT_ROOT_COST)
const CAMP_RT_MUL = 4;                      // 티어당 기준값 배수
const CAMP_RT_GRADE = { 흔함:0.5, 보통:1, 귀함:3, 극상:10 };
// 등장 티어 묶음 — 갈래마다 묶음당 계열 2개 → 티어 하나에 노드 8개가 자동으로 맞는다
const CAMP_RT_GRP = { 가:[1,5,9,13,17], 나:[2,6,10,14,18], 다:[3,7,11,15,19], 라:[4,8,12,16,20] };
const CAMP_RT_MILE = { 가:5, 나:10, 다:15, 라:20 };
const CAMP_RT_GRP_KEYS = ['가','나','다','라'];   // 묶음 순서 — 마디·좌표가 함께 쓴다   // 그 묶음의 귀함 계열이 극상이 되는 티어

// 효과 사다리 — HUNT_R1 §4-5. 배수형은 1~5차가 이 값(누적)이다.
const CAMP_RT_LADDER = [0, 1.5, 2.5, 5, 11, 25];

// 32계열. br=갈래 · grp=묶음 · gr=등급 · f=효과 종류(배선된 것만 아래에서 쓴다)
//   ⚠ 묶음마다 흔함4 · 보통3 · 귀함1 이어야 티어당 등급 구성이 맞는다(스모크가 검사).
const CAMP_RT_LINES = [
  // ── 갈래 ① 시작 도움 — 절대값이라 후반에는 저절로 희석된다
  {k:'tap',      br:'start', grp:'가', gr:'흔함', nm:'Show Me The Money', tn:['잔돈','주머니','금고','광맥','노다지'], pa:'startMin:1', f:'tapMulS', ic:'res_mineral.webp', vk:'mul', lad:[1,2,5,20,50,200], cs:[0,5,100,5000,1000000,500000000], ds:'탭 한 번에 얻는 미네랄이 {} 늘어납니다.'},
  {k:'startMin', br:'start', grp:'가', gr:'보통', nm:"What's Mine Is Mine", tn:['첫 삽','종잣돈','밑천'], pa:'root', f:'startMin', ic:'upgrades/up_mineral_up.webp', vk:'cnt', mx:3, lad:[0,500,1000,5000], cs:[0,2,50,200], ds:'회차를 시작할 때 미네랄 {} 을 갖고 시작합니다.'},
  {k:'startWk',  br:'start', grp:'나', gr:'흔함', nm:'Operation CWAL', tn:['선발대','작업반','교대조','광부단','채굴군'], pa:'startMin:1', f:'startWorker', ic:'buildings/bld_command.webp', vk:'cnt', lad:[0,1,3,5,7,9], cs:[0,10,2500,75000,250000,5000000], ds:'회차를 시작할 때 일꾼 {} 기와 함께 시작합니다.'},
  {k:'skipRd',   br:'start', grp:'라', gr:'귀함', nm:'There Is No Cow Level', tn:['지나온 길','익숙한 땅','밟아본 전선','정복한 전역','무혈입성'], pa:'startMin:3', f:'skipRound', ic:'skills/sk_recall.webp', vk:'cnt', lad:[0,2,4,6,8,10], cs:[0,500,7500,100000,2500000,50000000], ds:'환생하면 던전 {} 까지의 모든 라운드가 열린 채로 시작합니다.'},
  // ── 갈래 ② 재화 획득
  {k:'gather',   br:'econ',  grp:'가', gr:'흔함', nm:'일꾼 채취량',    f:'gatherMul', ic:'upgrades/up_mine.webp', vk:'mul', ds:'일꾼의 1회 채취량이 {} 증가합니다.'},
  {k:'gas',      br:'econ',  grp:'가', gr:'보통', nm:'가스 생산량',    f:'gasMul', ic:'res_gas.webp', vk:'mul', ds:'정제소의 가스 생산량이 {} 증가합니다.'},
  {k:'wkCap',    br:'econ',  grp:'나', gr:'흔함', nm:'일꾼 상한',      f:'workerCap', ic:'upgrades/up_transport.webp', vk:'mul', ds:'데리고 있을 수 있는 일꾼 수가 {} 늘어납니다.'},
  {k:'mine',     br:'econ',  grp:'나', gr:'귀함', nm:'광산 등급',      f:'mineMul', ic:'buildings/bld_extractor.webp', vk:'mul', ds:'광산에서 얻는 미네랄이 {} 증가합니다.'},
  {k:'idle',     br:'econ',  grp:'다', gr:'흔함', nm:'방치 수급',      f:'awayMul', ic:'skills/sk_recharge.webp', vk:'mul', ds:'자리를 비운 동안 쌓이는 수입이 {} 증가합니다.'},
  {k:'dgRw',     br:'econ',  grp:'다', gr:'보통', nm:'던전 보상',      f:'dgRewardMul', ic:'res_gem.webp', vk:'mul', ds:'던전을 깨고 받는 보상이 {} 증가합니다.'},
  {k:'tapMul',   br:'econ',  grp:'라', gr:'흔함', nm:'탭 배수',        f:'tapMul', ic:'skills/sk_nova.webp', vk:'mul', ds:'탭으로 얻는 미네랄이 {} 증가합니다.'},
  {k:'gasEx',    br:'econ',  grp:'라', gr:'보통', nm:'가스 교환비',    f:'gasExMul', ic:'buildings/bld_assimilator.webp', vk:'mul', ds:'가스를 바꿀 때의 교환비가 {} 좋아집니다.'},
  // ── 갈래 ③ 아군 강화
  {k:'atk',      br:'army',  grp:'가', gr:'흔함', nm:'유닛 공격력',    f:'unitAtk', ic:'upgrades/up_inf_atk.webp', vk:'mul', ds:'아군 유닛의 공격력이 {} 증가합니다.'},
  {k:'hp',       br:'army',  grp:'가', gr:'보통', nm:'유닛 체력',      f:'unitHp', ic:'upgrades/up_gnd_arm.webp', vk:'mul', ds:'아군 유닛의 체력이 {} 증가합니다.'},
  {k:'prod',     br:'army',  grp:'나', gr:'흔함', nm:'생산 속도',      f:'prodMul', ic:'upgrades/up_speed.webp', vk:'mul', ds:'유닛과 건물의 생산 속도가 {} 빨라집니다.'},
  {k:'sup',      br:'army',  grp:'나', gr:'보통', nm:'인구 상한',      f:'supAdd', ic:'res_pop.webp', vk:'sup', ds:'인구 상한이 {} 늘어납니다.'},
  {k:'upCost',   br:'army',  grp:'다', gr:'흔함', nm:'업그레이드 비용', f:'upgDisc', ic:'buildings/bld_armory.webp', vk:'disc', ds:'업그레이드 비용이 {} 싸집니다.'},
  {k:'endure',   br:'army',  grp:'다', gr:'귀함', nm:'버팀',          f:'endure', ic:'upgrades/up_shield.webp', vk:'mul', ds:'치명타를 맞아도 체력 1로 버티는 일이 {} 늘어납니다.'},   // 구 rebuild — 로드 시 포인트 이관
  {k:'bldg',     br:'army',  grp:'라', gr:'흔함', nm:'건물 강화',      f:'bldgMul', ic:'buildings/bld_cannon.webp', vk:'mul', ds:'아군 건물의 체력과 공격력이 {} 증가합니다.'},
  {k:'skCd',     br:'army',  grp:'라', gr:'보통', nm:'스킬 쿨다운',    f:'skillCd', ic:'upgrades/up_mana.webp', vk:'mul', ds:'스킬 재사용 대기가 {} 빨리 찹니다.'},
  // ── 갈래 ④ 적 약화 — ⚠ 상한이 있다. 다른 셋과 곱해지므로 반드시 막혀 있어야 한다
  {k:'foeHp',    br:'enemy', grp:'가', gr:'흔함', nm:'적 체력',        f:'cutHp', ic:'skills/sk_plague.webp', vk:'cut', ds:'적의 체력이 {} 감소합니다.'},
  {k:'foeN',     br:'enemy', grp:'가', gr:'귀함', nm:'적 마리 수',     f:'cutCount', ic:'skills/sk_dark_swarm.webp', vk:'cut', ds:'한 번에 몰려오는 적의 수가 {} 줄어듭니다.'},
  {k:'foeAtk',   br:'enemy', grp:'나', gr:'흔함', nm:'적 공격력',      f:'cutAtk', ic:'skills/sk_lockdown.webp', vk:'cut', ds:'적의 공격력이 {} 감소합니다.'},
  {k:'foeRes',   br:'enemy', grp:'나', gr:'보통', nm:'적 부활 시간',   f:'cutRes', ic:'skills/sk_ensnare.webp', vk:'cut', ds:'적이 다시 나타나기까지가 {} 길어집니다.'},
  {k:'foeSpd',   br:'enemy', grp:'다', gr:'흔함', nm:'적 이동 속도',   f:'cutSpd', ic:'skills/sk_slow.webp', vk:'cut', ds:'적의 이동 속도가 {} 느려집니다.'},
  {k:'bossHp',   br:'enemy', grp:'다', gr:'보통', nm:'보스 체력',      f:'cutBoss', ic:'skills/sk_irradiate.webp', vk:'cut', ds:'보스의 체력이 {} 감소합니다.'},
  {k:'foeRng',   br:'enemy', grp:'라', gr:'흔함', nm:'적 사거리',      f:'cutRng', ic:'skills/sk_optical_flare.webp', vk:'cut', ds:'적의 사거리가 {} 짧아집니다.'},
  {k:'foeDelay', br:'enemy', grp:'라', gr:'보통', nm:'적 등장 지연',   f:'foeDelay', ic:'skills/sk_maelstrom.webp', vk:'cut', ds:'적이 처음 나타나기까지가 {} 늦춰집니다.'},
];
function campRtLine(k){ for(const L of CAMP_RT_LINES) if(L.k === k) return L; return null; }
const CAMP_RT_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
/* ⛓ **사슬 갈래**(2026-09-02 사용자 확정) — 차수가 제자리에서 오르는 게 아니라 **앞으로 나아간다**.
   ⭐ 별 하나를 사면 그 별에 붙은 다음 별들이 열린다: 「What's Mine Is Mine I」을 사면
     그 앞(II)과 옆(Show Me The Money I · Operation CWAL I)이 함께 열린다.
   ⚠ 사슬 갈래에는 **갈래·묶음 관문이 없다** — 가운데에서 바로 첫 별로 간다.
     아직 안 옮긴 갈래는 옛 관문 구조 그대로다(한 갈래씩 옮긴다).
   ⛔ 부모를 여럿 두려면 pa 를 배열로 바꾸고 campRtNodeOwn 을 전부(AND) 검사로 고칠 것.
     지금은 하나뿐이라 문자열이다. */
const CAMP_RT_CHAIN = { start:1 };
function campRtIsChain(br){ return !!CAMP_RT_CHAIN[br]; }
// 그 노드를 여는 부모 — 2차 이상은 늘 앞 차수, 1차만 계열이 정한다(없으면 가운데)
function campRtParent(k, n){ if(n > 1) return k + ':' + (n - 1);
  const L = campRtLine(k); return (L && L.pa) || 'root'; }
function campRtNodeOwn(key){ if(key === 'root') return campRtRootOn();
  const i = key.indexOf(':'); return campRtHas(key.slice(0, i)) >= +key.slice(i + 1); }
// 🌌 사슬 좌표 — 부모에서 부채꼴로 뻗는다. 데이터가 정적이라 한 번 계산해 둔다.
//   ⚠ 각도 폭을 **호 길이**(GAP)로 잡는다 — 멀어질수록 각도를 좁혀야 별 간격이 일정해진다.
const CAMP_CH_R1 = 150, CAMP_CH_STEP = 74, CAMP_CH_GAP = 78;
let _ctChain = null;
function campRtChainMap(){
  if(_ctChain) return _ctChain;
  const kids = {}, P = {};
  for(const L of CAMP_RT_LINES){ if(!campRtIsChain(L.br)) continue;
    for(let n = 1, mx = campRtMax(L.k); n <= mx; n++){
      const pk = campRtParent(L.k, n);
      (kids[pk] = kids[pk] || []).push({ key:L.k + ':' + n, br:L.br }); } }
  const place = (list, baseA, baseR) => {
    const m = list.length;
    list.forEach((c, i) => {
      const r0 = baseR + CAMP_CH_STEP;
      const a = baseA + (i - (m - 1) / 2) * (CAMP_CH_GAP / r0)
        + campTreeJit(c.key, 0, 'ca') * (CAMP_CH_GAP / r0) * .22 * CAMP_TREE_JIT;
      const r = r0 + campTreeJit(c.key, 0, 'cr') * CAMP_CH_STEP * .20 * CAMP_TREE_JIT;
      P[c.key] = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      if(kids[c.key]) place(kids[c.key], a, r); }); };
  const byBr = {};                                   // 가운데 직속은 **갈래별로** 나눠 제 방향에서 출발한다
  for(const c of (kids.root || [])) (byBr[c.br] = byBr[c.br] || []).push(c);
  for(const b in byBr) place(byBr[b], CAMP_TREE_BR[b].a, CAMP_CH_R1 - CAMP_CH_STEP);
  return (_ctChain = P); }
function campRtChainPos(key){ return campRtChainMap()[key] || null; }
function campRtStep(k, n){ const L = campRtLine(k), t = L && L.tn && L.tn[n - 1];
  const r = '<span class="ctRom">' + (CAMP_RT_ROMAN[n] || n) + '</span>';
  return t ? (r + t) : (r + n + ' / ' + campRtMax(k) + ' 단계'); }
// 🔢 계열은 제 사다리·제 비용·제 차수를 가질 수 있다(2026-09-02).
//   ⭐ 왜 — 「시작 미네랄」처럼 3차에서 끝나는 계열이 생겼고, 값·비용이 티어 공식과 안 맞는
//     계열이 생겼다. **가진 것이 이기고, 없으면 공용 규칙으로 떨어진다.**
//   ⛔ 공식(CAMP_RT_BASE·MUL·GRADE)을 계열 하나 때문에 흔들지 말 것 — 나머지 27계열이 함께 움직인다.
const CAMP_RT_MAX_DEF = 5;
function campRtMax(k){ const L = campRtLine(k); return (L && L.mx) || CAMP_RT_MAX_DEF; }
function campRtLad(k){ const L = campRtLine(k); return (L && L.lad) || CAMP_RT_LADDER; }
// 그 묶음에 계열이 하나라도 있는가 — 빈 묶음은 사도 아무것도 안 열리므로 존재하지 않는 것으로 친다
function campRtGpLive(bk, g){ if(campRtIsChain(bk)) return false;      // 사슬 갈래엔 관문이 없다
  for(const L of CAMP_RT_LINES) if(L.br === bk && L.grp === g) return true; return false; }
// 계열의 n차 등장이 몇 티어인가 (n = 1~5)
function campRtTier(k, n){ const L = campRtLine(k); if(!L) return 0;
  return CAMP_RT_GRP[L.grp][Math.max(1, Math.min(5, n | 0)) - 1]; }
// 그 자리의 등급 — 귀함 계열은 자기 이정표 티어에서만 극상이 된다
function campRtGrade(k, n){ const L = campRtLine(k); if(!L) return '보통';
  return (L.gr === '귀함' && campRtTier(k, n) === CAMP_RT_MILE[L.grp]) ? '극상' : L.gr; }
// 노드 비용 = 티어 기준값 × 등급 배수
function campRtCost(k, n){ const L = campRtLine(k);
  if(L && L.cs) return (n >= 1 && n < L.cs.length) ? L.cs[n] : Infinity;   // 손으로 정한 값이 이긴다
  const t = campRtTier(k, n); if(!t) return Infinity;
  return CAMP_RT_BASE * Math.pow(CAMP_RT_MUL, t - 1) * CAMP_RT_GRADE[campRtGrade(k, n)]; }

// ── 🌌 마디 · 관문 (2026-09-01 사용자 확정 · 목업 docs/mock/camp-tree-star-v4-4.html) ──
//   ⭐ **갈래와 묶음도 사는 것이다.** 예전에는 32계열의 1차가 처음부터 전부 열려 있어서
//     첫 화면에 32개가 깔렸다 — 어떤 배치를 써도 이름과 값이 겹쳤다(실측).
//     이제 환생 → 갈래 → 묶음 → 계열 순으로 열린다. 첫 화면은 **다섯 개**다.
//   ⚠ 마디는 계열이 아니라서 `CAMP_RT_LINES` 에 없다. 자루(bag)에 `br:<갈래>` · `gp:<갈래><묶음>`
//     키로 들어간다 — 계열 키와 섞이지 않게 접두사를 쓴다.
// 🌟 **새로운 시작** — 가운데(root)는 트리를 여는 열쇠이자 **첫 환생의 보상**이다(2026-09-01 사용자 확정).
//   ⛔ 값을 CAMP_RT_BASE 로 두면 안 된다 — 그것은 **비용 공식의 티어1 기준값**이라
//     건드리면 160칸 전부의 값이 함께 움직인다. root 만의 상수를 따로 둔다.
//   ⭐ 왜 1인가: 포인트 공식은 `√(번 재화 ÷ 100만)` 이라 **조건을 막 채운 첫 환생은 정확히 1** 이다.
//     2 였을 때는 첫 환생으로 트리를 **열 수조차 없었다** — 눌렀는데 아무 일도 안 일어났다.
//     HUNT_R1 §4-2-0 이 「첫 경험이 『눌렀더니 느려졌다』면 두 번 다시 안 누른다」고 못박은 자리다.
const CAMP_RT_ROOT_COST = 1;
//   ⭐ 보상은 **절대값**이다(자원·일꾼·건물). 배수로 주면 §4-5-5 의 곱셈 상한 표에 축이 하나 더
//     늘어 폭주한다 — 절대값은 후반에 저절로 희석되므로 그 표를 건드리지 않는다.
//   수치 근거: 캠프는 미네랄 0 · 일꾼 0 으로 시작하고(HUNT_R1 §1) 탭 0레벨이 1미네랄이다.
//     ⚠ 일꾼 값은 `campHireCost` 다 — **첫 마리 140**, 그 뒤 ×1.65 씩(U.worker_human.cost 50 은
//     샌드박스 값이라 캠프와 무관하다). 그래서 지금 꾸러미의 값어치는
//     일꾼 1기(140) + 미네랄 100 = **240 미네랄**, 탭만으로 벌면 4분 남짓이다.
//   ⚠ HUNT_R1 §4-2-0 ① 은 「첫 환생 보상을 **후하게**」라고 적었는데 이 값은 그보다 가볍다 —
//     사용자가 2026-09-01 에 직접 정한 값이다(옛 200/3기/병영에서 내렸다). 실측 뒤 다시 볼 자리.
const CAMP_ROOT_MIN = 100;          // 시작 미네랄
const CAMP_ROOT_WK = 1;             // 시작 일꾼 — 한 기부터 자동 수급이 돈다
//   🗄 시작 건물은 **화면에서만 뺐다**(유보 규칙) — null 이면 안 준다. 배선은 아래에 그대로 있다.
const CAMP_ROOT_BLD = null;
const CAMP_RT_BR_COST = 8;      // 갈래 마디 값 (티어 2 기준값)
const CAMP_RT_GP_COST = 32;     // 묶음 마디 값 (티어 3 기준값)
const CAMP_RT_BR_KEY = b => 'br:' + b;
const CAMP_RT_GP_KEY = (b, g) => 'gp:' + b + g;
//   ⛔ **짝 조건(관문)을 되살리지 말 것**(2026-09-01 제거). 「4차부터 같은 묶음의 짝도 3차 이상」이라는
//     규칙이 있었다 — 한 줄만 파고드는 것을 막으려던 장치인데, 사는 사람에게는 「왜 못 사는지」를
//     한 겹 더 읽게 만드는 부담이었다. 계열은 **제 앞 차수만** 보면 된다.
function campRtBrOn(b){ return campRtHas(CAMP_RT_BR_KEY(b)) > 0; }
function campRtGpOn(b, g){ return campRtHas(CAMP_RT_GP_KEY(b, g)) > 0; }

// ── 보유 · 구매 ─────────────────────────────────────────────────────────
//   저장은 C.rbTree = { root:1, 'br:econ':1, 'gp:econ가':1, '<계열>':<몇 차까지 샀나> }
function campRtBag(){ const C = campState(); if(!C) return null;
  if(!C.rbTree || typeof C.rbTree !== 'object') C.rbTree = {};
  campRtMigrate(C.rbTree);
  return C.rbTree; }
// 🕰 옛 저장본 잇기 — 마디가 없던 시절의 자루에는 계열만 들어 있다.
//   ⛔ 그대로 두면 **이미 산 계열이 화면에서 사라진다**(부모 마디가 없어서 안 그려진다).
//   ⭐ 산 계열이 있으면 그 갈래·묶음 마디를 **값 없이** 채워 준다 — 이미 낸 값이라 또 받지 않는다.
function campRtMigrate(b){
  if(!b || b._m2 || !b.root) return;
  for(const L of CAMP_RT_LINES){ if(!(b[L.k] > 0)) continue;
    b[CAMP_RT_BR_KEY(L.br)] = 1; b[CAMP_RT_GP_KEY(L.br, L.grp)] = 1; }
  b._m2 = 1; }
function campRtHas(k){ const b = campRtBag(); return b ? (b[k] | 0) : 0; }
function campRtRootOn(){ return campRtHas('root') > 0; }
// 다음으로 살 수 있는 차수 (없으면 0)
function campRtNext(k){ const n = campRtHas(k) + 1; return n <= campRtMax(k) ? n : 0; }
// 살 것의 값 — 마디는 고정값, 계열은 차수 비용
function campRtKeyCost(k){
  if(k === 'root') return CAMP_RT_ROOT_COST;
  if(k.indexOf('br:') === 0) return CAMP_RT_BR_COST;
  if(k.indexOf('gp:') === 0) return CAMP_RT_GP_COST;
  const n = campRtNext(k); return n ? campRtCost(k, n) : Infinity; }
// ⭐ 사슬 규칙 — 환생 → 갈래 → 묶음 → 계열, 그 다음은 그 계열의 앞 차수.
function campRtCanBuy(k){ const C = campState(); if(!C) return false;
  if(k === 'root') return !campRtRootOn() && (C.rbPts || 0) >= CAMP_RT_ROOT_COST;
  if(!campRtRootOn()) return false;
  const pts = C.rbPts || 0;
  if(k.indexOf('br:') === 0) return campRtHas(k) === 0 && pts >= CAMP_RT_BR_COST;
  if(k.indexOf('gp:') === 0){ const b = k.slice(3, -1), g = k.slice(-1);
    return campRtGpLive(b, g) && campRtHas(k) === 0 && campRtBrOn(b) && pts >= CAMP_RT_GP_COST; }
  const L = campRtLine(k); if(!L) return false;
  const n = campRtNext(k); if(!n) return false;
  if(campRtIsChain(L.br)){ if(!campRtNodeOwn(campRtParent(k, n))) return false; }
  else if(!campRtGpOn(L.br, L.grp)) return false;        // 묶음을 안 샀으면 계열은 존재하지 않는다
  return pts >= campRtCost(k, n); }
function campRtBuy(k){ const C = campState(); if(!C || !campRtCanBuy(k)) return 0;
  const b = campRtBag();
  const cost = campRtKeyCost(k);
  C.rbPts = (C.rbPts || 0) - cost;
  b[k] = (b[k] | 0) + 1;
  campSave(); return cost; }
// 초기화 — 산 것을 전부 물리고 포인트를 100% 돌려받는다. 비용은 젬(GEM.md §4).
//   ⚠ 마디 값도 함께 돌려준다 — 안 그러면 되돌릴수록 포인트가 샌다.
function campRtReset(){ const C = campState(); if(!C) return 0;
  const b = campRtBag(); let back = 0;
  if(b.root) back += CAMP_RT_ROOT_COST;
  for(const bk in CAMP_TREE_BR){
    if(b[CAMP_RT_BR_KEY(bk)]) back += CAMP_RT_BR_COST;
    for(const g of CAMP_RT_GRP_KEYS) if(b[CAMP_RT_GP_KEY(bk, g)]) back += CAMP_RT_GP_COST; }
  for(const L of CAMP_RT_LINES){ const n = b[L.k] | 0;
    for(let i = 1; i <= n; i++) back += campRtCost(L.k, i); }
  C.rbTree = { _m2:1 }; C.rbPts = (C.rbPts || 0) + back; campSave(); return back; }

// ── 효과 ────────────────────────────────────────────────────────────────
//   배수형 = 사다리 값(누적) · 감소형 = 계열마다 −40% 까지 수확 체감
const CAMP_RT_CUT_MAX = 0.40;          // 계열 하나가 깎을 수 있는 최대
const CAMP_RT_CUT_FLOOR = 0.20;        // ⭐ 갈래 전체 실효 하한 — 적이 1/5 밑으로는 안 내려간다
function campRtMul(k){ const n = campRtHas(k); if(n <= 0) return 1;
  const lad = campRtLad(k); return lad[Math.min(campRtMax(k), n)]; }
// ⛔ 공식으로 만들지 말 것 — 지수 감쇠는 5차에서 상한에 **정확히** 닿지 않는다(실측 −37.99%).
//    HUNT_R1 §4-5-4 의 표를 그대로 둔다: 5차가 딱 −40% 여야 「다 찍었다」가 성립한다.
const CAMP_RT_CUT = [0, 0.12, 0.25, 0.33, 0.38, CAMP_RT_CUT_MAX];
function campRtCut(k){ const n = campRtHas(k); return n <= 0 ? 0 : CAMP_RT_CUT[Math.min(5, n)]; }
// 적 약화 갈래의 실효 배수 — 곱한 뒤 하한으로 막는다. ⛔ 하한을 빼면 지수 축이 둘이 된다.
function campRtFoeMul(){ let m = 1;
  for(const L of CAMP_RT_LINES){ if(L.br !== 'enemy') continue; m *= (1 - campRtCut(L.k)); }
  return Math.max(CAMP_RT_CUT_FLOOR, m); }

// ══ 🌌 트리 화면 — 별자리 (2026-09-01 · 목업 docs/mock/camp-tree-star-v4-4.html 확정) ═══
//   가운데 붉은 마름모에서 **갈래 넷 → 묶음 넷 → 계열 → 5차** 로 갈라져 나간다.
//   ⭐ 「퍼지는」 느낌은 **갈라짐**에서 온다. 중심에서 32개가 한꺼번에 뻗으면 그건 빗살이지
//     별자리가 아니다 — 그래서 갈래·묶음 마디를 거친다(마디도 사는 것이다).
//   ⭐ 보이는 것은 **산 것 + 그 바로 다음 한 칸**뿐이다. 그 너머는 자물쇠도 흐린 점도 없이
//     아예 안 그린다. 숫자는 **지금 살 수 있는 별에만** 붙는다 — 그래야 후반에도 안 붐빈다.
//   ⛔ 좌표를 화면 픽셀로 잡지 말 것. **월드 좌표(SVG viewBox)** 로 두고 변환만 바꾼다 —
//      그래야 확대·이동이 노드 위치 계산과 섞이지 않는다.
//   갈래 색은 DESIGN.md §2 액센트 **역할표**에서 그대로 꺼냈다(재화=금 · 위험=적 · 정보=청 · 긍정=녹).
//   시안(--acc-sel)은 「지금 고른 별」 전용으로 남긴다 — 화면당 한 곳 규칙.
//   ⚠ 갈래를 **대각선으로 돌리고 거리도 다르게** 준다. 상하좌우 축에 두면 좌우 갈래가
//     같은 높이에 서서 중심 옆에 숫자가 한 줄로 겹친다(실측).
const CAMP_TREE_BR = {
  enemy:{ a:-Math.PI*0.76, rk:1.34, nm:'적 약화',   col:'#ff3b3b' },   // ↖ 멀리
  econ: { a:-Math.PI*0.24, rk:0.82, nm:'재화 획득', col:'#ffd24a' },   // ↗ 가까이
  start:{ a: Math.PI*0.70, rk:0.88, nm:'시작 도움', col:'#5dff8f' },   // ↙ 가까이
  army: { a: Math.PI*0.30, rk:1.26, nm:'아군 강화', col:'#4aa8ff' },   // ↘ 멀리
};
const CAMP_TREE_SPREAD = 1.30;      // 갈래 하나가 벌어지는 각(rad)
const CAMP_TREE_R_BR = 66, CAMP_TREE_R_GP = 132;   // 갈래 마디 · 묶음 마디까지 거리
const CAMP_TREE_R0 = 206, CAMP_TREE_RS = 52;       // 계열 1차까지 거리 · 칸 간격
//   ✨ 흩뜨림 — 같은 차수라도 자리를 조금씩 어긋나게 해 별자리처럼 보이게 한다.
//   ⛔ 난수를 쓰지 말 것. 키로 만든 해시라 **매번 같은 자리**에 선다(별자리는 움직이면 안 된다).
//   ⚠ 흔들림을 차수마다 **누적하지 않는다** — 누적하면 사슬이 제 갈래를 벗어나 얽힌다.
const CAMP_TREE_JIT = 0.70;
function campTreeHash(s){ let h = 2166136261;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000; }
function campTreeJit(k, n, seed){ return campTreeHash(k + ':' + n + ':' + seed) * 2 - 1; }

// 갈래 마디의 자리
function campTreeBrPos(bk){ const B = CAMP_TREE_BR[bk]; if(!B) return { x:0, y:0 };
  const r = CAMP_TREE_R_BR * (B.rk || 1);
  return { x: Math.cos(B.a) * r, y: Math.sin(B.a) * r }; }
// 묶음 마디의 각·자리
function campTreeGpAng(bk, g){ const B = CAMP_TREE_BR[bk];
  const gi = CAMP_RT_GRP_KEYS.indexOf(g);
  return B.a + (gi - 1.5) * (CAMP_TREE_SPREAD / 3)
    + campTreeJit(bk + g, 0, 'g') * (CAMP_TREE_SPREAD / 3) * 0.16 * CAMP_TREE_JIT; }
function campTreeGpPos(bk, g){ const B = CAMP_TREE_BR[bk], a = campTreeGpAng(bk, g);
  const r = CAMP_TREE_R_GP * (0.72 + (B.rk || 1) * 0.34)
    + campTreeJit(bk + g, 0, 'rg') * 14 * CAMP_TREE_JIT;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r }; }
// 계열 k 의 n차가 월드 좌표 어디인가
function campTreePos(k, n){
  const L = campRtLine(k); if(!L || n <= 0) return { x:0, y:0 };
  const B = CAMP_TREE_BR[L.br]; if(!B) return { x:0, y:0 };
  if(campRtIsChain(L.br)){ const c = campRtChainPos(k + ':' + n); if(c) return c; }
  const li = CAMP_RT_LINES.filter(x => x.br === L.br && x.grp === L.grp).indexOf(L);
  const a = campTreeGpAng(L.br, L.grp) + (li - 0.5) * (CAMP_TREE_SPREAD / 3) * 0.46
    + campTreeJit(k, n, 'a') * (CAMP_TREE_SPREAD / 3) * 0.30 * CAMP_TREE_JIT;
  const r = CAMP_TREE_R0 * (0.80 + (B.rk || 1) * 0.22) + (n - 1) * CAMP_TREE_RS
    + campTreeJit(k, n, 'r') * CAMP_TREE_RS * 0.34 * CAMP_TREE_JIT;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}
// 어느 별이든 자리를 하나로 — 선택 이동이 이 함수 하나만 본다
function campTreeSelPos(sel){ if(!sel) return null;
  if(sel.t === 'root') return { x:0, y:0 };
  if(sel.t === 'br') return campTreeBrPos(sel.a);
  if(sel.t === 'gp') return campTreeGpPos(sel.a, sel.b);
  return campTreePos(sel.a, sel.b); }

// ── 상태 ────────────────────────────────────────────────────────────────
//   'own'(샀다) · 'buy'(살 수 있다) · 'next'(열렸는데 포인트가 모자라다)
//   · null(**그리지 않는다**)
function campTreeBrState(bk){ if(campRtIsChain(bk)) return null;       // 사슬 갈래엔 관문이 없다
  if(campRtBrOn(bk)) return 'own';
  if(!campRtRootOn()) return null;
  const C = campState(); return ((C && C.rbPts || 0) >= CAMP_RT_BR_COST) ? 'buy' : 'next'; }
function campTreeGpState(bk, g){ if(!campRtGpLive(bk, g)) return null;   // 계열이 없는 묶음
  if(campRtGpOn(bk, g)) return 'own';
  if(!campRtBrOn(bk)) return null;
  const C = campState(); return ((C && C.rbPts || 0) >= CAMP_RT_GP_COST) ? 'buy' : 'next'; }
function campTreeState(k, n){
  const L = campRtLine(k); if(!L) return null;
  if(campRtIsChain(L.br)){ if(!campRtNodeOwn(campRtParent(k, n))) return null; }
  else if(!campRtGpOn(L.br, L.grp)) return null;
  const have = campRtHas(k);
  if(n <= have) return 'own';
  if(n !== have + 1) return null;
  const C = campState();
  return ((C && C.rbPts || 0) >= campRtCost(k, n)) ? 'buy' : 'next';
}

let _campTreeSel = null;            // 지금 고른 별 {t:'br'|'gp'|'n', a, b} — 시안은 여기 한 곳만
let _campTreeView = { x:0, y:0, z:1 };
const CAMP_TREE_ZMIN = 0.30, CAMP_TREE_ZMAX = 2.6;
const CAMP_TREE_ZSEL = 1.55;        // 별을 골랐을 때의 배율
// 📏 하단 구역이 가리는 높이 — **월드 좌표(viewBox 단위)** 로 돌려준다.
//   ⛔ 상수로 박지 말 것(옛 CAMP_TREE_SEL_Y = -150 이 그랬다). 시트 높이는 고른 별에 따라
//     달라지고, **안 골랐을 때는 0** 이다 — 그때 트리는 화면 전체를 쓴다(2026-09-02 사용자 확정).
function campTreeSheetH(){
  const el = document.getElementById('campTree'); if(!el) return 0;
  if(!el.classList.contains('picked')) return 0;      // 안 골랐으면 시트가 자리를 안 뺏는다
  const svg = document.getElementById('ctSvg'), sh = el.querySelector('.ctSheet');
  if(!svg || !sh) return 0;
  const rs = svg.getBoundingClientRect(), rh = sh.getBoundingClientRect();
  if(!(rs.height > 0) || !(rh.height > 0)) return 0;
  const vb = (svg.getAttribute('viewBox') || '0 0 430 840').split(/\s+/).map(Number);
  return rh.height / rs.height * vb[3]; }
// 고른 별이 앉을 화면 높이 — **시트 위 영역의 한가운데**다(0 = 화면 한가운데)
function campTreeSelY(){ return -campTreeSheetH() / 2; }
function campTreeIsSel(t, a, b){ const s = _campTreeSel;
  return !!(s && s.t === t && s.a === a && (b == null || s.b === b)); }

// ── 그리기 ──────────────────────────────────────────────────────────────
const CAMP_TREE_ICO = 'assets/icons/';
// 👆 누르는 반경 — 계열 간격(CAMP_TREE_RS 52)의 절반보다 작게 잡아 옆 별을 훔치지 않게 한다
function campTreeHitR(r){ return Math.min(Math.max(r + 10, 22), CAMP_TREE_RS * 0.46); }
// ⛔ **x·y 를 반드시 숫자로 되돌린다.** 부르는 쪽(campTreeGem)이 toFixed 한 **문자열**을 넘긴다 —
//   그대로 두면 `x - r` 은 숫자인데 `x + r` 은 **문자열 이어붙이기**가 되어
//   "67.3" + 22.75 → "67.322.75" 같은 값이 나오고, SVG 경로 파서가 그걸 두 수로 쪼개 읽어
//   도형이 통째로 망가진다(실측 2026-09-02: 반짝임 하나가 12×216px 짜리 **긴 세로선**으로 그려졌다).
function campTreeSpark(x, y, r, col, op){
  x = +x; y = +y;
  return '<path d="M' + (x - r) + ' ' + y + ' L' + (x + r) + ' ' + y +
    ' M' + x + ' ' + (y - r) + ' L' + x + ' ' + (y + r) + '" class="ctSp" stroke="' + col +
    '" opacity="' + (op || .5).toFixed(2) + '"/>'; }
// ⭐ 별 하나 — 등급이 테두리로, 내용이 아이콘으로 읽힌다.
//   흔함 가는 한 겹 · 보통 밝은 한 겹 · 귀함 금 두 겹 · 극상 금 두 겹 + 바깥 광륜
function campTreeGem(o){
  const x = (+o.x).toFixed(1), y = (+o.y).toFixed(1), r = o.r, col = o.col, f = o.f;
  const own = o.state === 'own', buy = o.state === 'buy';
  const s = [];
  const ring = (own || buy) ? col : 'rgba(200,220,240,.30)';
  if(o.me){ s.push('<circle cx="' + x + '" cy="' + y + '" r="' + (r * 2.4) + '" fill="rgba(92,214,255,.07)"/>');
    s.push(campTreeSpark(x, y, r * 2.2, '#5cd6ff', .5)); }
  // ⛔ 후광에 f 를 곱하지 않으면 흐려야 할 별들이 그대로 타올라 화면이 노란 구름이 된다(실측)
  if(own){ s.push('<circle cx="' + x + '" cy="' + y + '" r="' + (r * 1.45) + '" fill="' + col +
      '" opacity="' + (0.11 * f).toFixed(3) + '"/>');
    s.push(campTreeSpark(x, y, r * 1.75, col, .34 * f)); }
  if(o.gr === '극상') s.push('<circle cx="' + x + '" cy="' + y + '" r="' + (r + 6) +
    '" class="ctHalo" opacity="' + (0.30 * f).toFixed(2) + '"/>');
  s.push('<circle cx="' + x + '" cy="' + y + '" r="' + r + '" class="ctGem" stroke="' + ring +
    '" stroke-width="' + (own ? 1.7 : 1.1) + '" opacity="' + f.toFixed(2) + '"/>');
  if(o.gr === '귀함' || o.gr === '극상')
    s.push('<circle cx="' + x + '" cy="' + y + '" r="' + (r - 2.6) + '" class="ctIn gold" opacity="' +
      ((own ? .85 : .55) * f).toFixed(2) + '"/>');
  else if(o.gr === '보통')
    s.push('<circle cx="' + x + '" cy="' + y + '" r="' + (r - 2.6) + '" class="ctIn" opacity="' + f.toFixed(2) + '"/>');
  if(o.ic){ const w = r * 1.46;
    s.push('<image href="' + CAMP_TREE_ICO + o.ic + '" x="' + (o.x - w / 2).toFixed(1) + '" y="' +
      (o.y - w / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + w.toFixed(1) +
      '" opacity="' + ((own ? 1 : (buy ? .92 : .6)) * f).toFixed(2) + '"' +
      (own ? '' : ' filter="url(#ctDim)"') + ' pointer-events="none"/>'); }
  if(o.label) s.push('<text x="' + x + '" y="' + (o.y + r + 4).toFixed(1) + '" class="ctTag' +
    (buy ? ' on' : '') + '" style="' + (buy ? 'fill:' + col : '') + '" opacity="' + f.toFixed(2) + '">' +
    o.label + '</text>');
  if(o.me) s.push('<circle cx="' + x + '" cy="' + y + '" r="' + (r + 5) + '" class="ctSel"/>');
  // 👆 누르는 면 — **맨 위에, 투명하게, 넉넉하게**. 이것만 data-k 를 갖는다.
  if(o.k) s.push('<circle cx="' + x + '" cy="' + y + '" r="' + campTreeHitR(r) + '" class="ctHit"' +
    ' data-k="' + o.k + '" data-n="' + (o.n == null ? 0 : o.n) + '"/>');
  return s.join('');
}
// 별 하나의 반지름 — **그릴 때와 선을 물릴 때가 같은 값을 써야 한다.**
//   ⛔ 여기 값을 바꾸면 campTreeSvg 의 gem 반지름도 같이 바꿀 것(둘이 어긋나면 선이 다시 파고든다).
const CAMP_TREE_R_CORE = 13;                    // 가운데 마름모
const CAMP_TREE_R_BRN = 13, CAMP_TREE_R_GPN = 11;   // 갈래 마디 · 묶음 마디
function campTreeNodeR(k, n){ return campTreeState(k, n) === 'own' ? 13 : 15; }
const CAMP_TREE_LINK_GAP = 3;                   // 별 테두리와 선 끝 사이 틈
// ⛔ **중심에서 중심으로 긋지 말 것.** 그러면 선이 별 안으로 파고든다(2026-09-02 사용자 지적).
//   양 끝을 각 별의 반지름 + 틈만큼 물린다. ⚠ 짧은 링크에서 선이 뒤집히지 않도록 거리의 45% 로 막는다.
function campTreeLink(a, b, col, lit, f, ra, rb){
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const t0 = Math.min(d * .45, (ra || 0) + CAMP_TREE_LINK_GAP);
  const t1 = Math.min(d * .45, (rb || 0) + CAMP_TREE_LINK_GAP);
  const x1 = a.x + ux * t0, y1 = a.y + uy * t0;
  const x2 = b.x - ux * t1, y2 = b.y - uy * t1;
  return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) +
    '" y2="' + y2.toFixed(1) + '" stroke="' + (lit ? col : 'rgba(200,220,240,.20)') +
    '" stroke-width="' + (lit ? 2 : .9) + '" opacity="' + ((lit ? .62 : 1) * f).toFixed(2) + '"' +
    (lit ? '' : ' stroke-dasharray="2 3"') + '/>'; }
function campTreeSvg(){
  const rows = [], sel = _campTreeSel;
  // 고른 별이 있으면 나머지를 물린다 — 집중은 세지되 지도를 아주 잃지는 않는 정도
  const dim = sel ? 1 : 0;
  const F = me => me ? 1 : (1 - dim * .78);
  for(const bk in CAMP_TREE_BR){ const B = CAMP_TREE_BR[bk];
    if(campRtIsChain(bk)){                                    // ⛓ 사슬 — 별에서 별로
      for(const L of CAMP_RT_LINES){ if(L.br !== bk) continue;
        for(let n = 1, mx = campRtMax(L.k); n <= mx; n++){ const st = campTreeState(L.k, n); if(!st) continue;
          const b = campTreePos(L.k, n), pk = campRtParent(L.k, n), ci = pk.indexOf(':');
          const a = (ci < 0) ? { x:0, y:0 } : campTreePos(pk.slice(0, ci), +pk.slice(ci + 1));
          const ra = (ci < 0) ? CAMP_TREE_R_CORE : campTreeNodeR(pk.slice(0, ci), +pk.slice(ci + 1));
          const me = campTreeIsSel('n', L.k, n), f = F(me);
          rows.push(campTreeLink(a, b, B.col, st === 'own', f, ra, st === 'own' ? 13 : 15));
          rows.push(campTreeGem({ x:b.x, y:b.y, r: st === 'own' ? 13 : 15, col:B.col, state:st,
            gr:campRtGrade(L.k, n), ic:L.ic, label: st === 'own' ? '' : campNum(campRtCost(L.k, n)),
            me, f, k:L.k, n })); } }
      rows.push('<text x="' + (Math.cos(B.a) * 300).toFixed(0) + '" y="' + (Math.sin(B.a) * 300).toFixed(0) +
        '" class="ctBrNm" fill="' + B.col + '" opacity="' + (sel ? .18 : .5) + '">' + B.nm + '</text>');
      continue; }
    const sb = campTreeBrState(bk); if(!sb) continue;
    const p = campTreeBrPos(bk), meB = campTreeIsSel('br', bk);
    rows.push(campTreeLink({ x:0, y:0 }, p, B.col, sb === 'own', F(meB), CAMP_TREE_R_CORE, CAMP_TREE_R_BRN));
    rows.push(campTreeGem({ x:p.x, y:p.y, r:13, col:B.col, state:sb, gr:'보통',
      label: sb === 'own' ? '' : campNum(CAMP_RT_BR_COST), me:meB, f:F(meB),
      k:CAMP_RT_BR_KEY(bk), n:0 }));
    if(sb === 'own'){
      for(const g of CAMP_RT_GRP_KEYS){ const sg = campTreeGpState(bk, g); if(!sg) continue;
        const q = campTreeGpPos(bk, g), meG = campTreeIsSel('gp', bk, g);
        rows.push(campTreeLink(p, q, B.col, sg === 'own', F(meG), CAMP_TREE_R_BRN, CAMP_TREE_R_GPN));
        rows.push(campTreeGem({ x:q.x, y:q.y, r:11, col:B.col, state:sg, gr:'흔함',
          label: sg === 'own' ? '' : campNum(CAMP_RT_GP_COST), me:meG, f:F(meG),
          k:CAMP_RT_GP_KEY(bk, g), n:0 }));
        if(sg !== 'own') continue;
        for(const L of CAMP_RT_LINES){ if(L.br !== bk || L.grp !== g) continue;
          for(let n = 1, mx = campRtMax(L.k); n <= mx; n++){ const st = campTreeState(L.k, n); if(!st) continue;
            const b = campTreePos(L.k, n), a = (n === 1) ? q : campTreePos(L.k, n - 1);
            const ra = (n === 1) ? CAMP_TREE_R_GPN : campTreeNodeR(L.k, n - 1);
            const me = campTreeIsSel('n', L.k, n), f = F(me);
            rows.push(campTreeLink(a, b, B.col, st === 'own', f, ra, st === 'own' ? 13 : 15));
            rows.push(campTreeGem({ x:b.x, y:b.y, r: st === 'own' ? 13 : 15, col:B.col, state:st,
              gr:campRtGrade(L.k, n), ic:L.ic, label: st === 'own' ? '' : campNum(campRtCost(L.k, n)),
              me, f, k:L.k, n })); } } } }
    // 갈래 이름 — 부챗살 바깥
    rows.push('<text x="' + (Math.cos(B.a) * 300).toFixed(0) + '" y="' + (Math.sin(B.a) * 300).toFixed(0) +
      '" class="ctBrNm" fill="' + B.col + '" opacity="' + (sel ? .18 : .5) + '">' + B.nm + '</text>');
  }
  // ⭐ 가운데 — **글씨 없이 붉은 마름모** 하나(2026-09-01 사용자 확정)
  const rr = 13, on = campRtRootOn();
  const dia = r => [[0, -r], [r, 0], [0, r], [-r, 0]].map(q => q[0] + ',' + q[1]).join(' ');
  rows.push('<circle cx="0" cy="0" r="' + (rr * 3.2) + '" fill="rgba(255,70,60,.06)"/>');
  rows.push(campTreeSpark(0, 0, rr * 3.4, '#ff6a4a', .42));
  rows.push('<polygon points="' + dia(rr * 1.7) + '" class="ctCoreOut"/>');
  rows.push('<polygon points="' + dia(rr) + '" class="ctCore' + (on ? ' on' : '') + '"/>');
  rows.push('<circle cx="0" cy="0" r="' + campTreeHitR(rr) + '" class="ctHit" data-k="root" data-n="0"/>');
  if(campTreeIsSel('root', 'root'))
    rows.push('<circle cx="0" cy="0" r="' + (rr * 2.2) + '" class="ctSel"/>');
  return rows.join('');
}
// ══ 🔁 환생 화면 (2026-08-31) ═══════════════════════════════════════════
//  ⭐ 왜 「먼 목표」를 보여 주는가 — HUNT_R1.md §4-2-0.
//     첫 환생은 **가까운 목표만 보면 손해다**(던전 3까지만 보면 필요 배수 80.3 vs 실제 2.7).
//     먼 목표(던전 10)를 보면 이득이다. 그 사실이 화면에 안 보이면 플레이어는 손해라고 판단하고
//     두 번 다시 안 누른다 — 방치형의 가장 흔한 실패다. 그래서 이 줄은 장식이 아니라 설계 요구다.
//
//  ⚠ 시간 어림의 근거: sc-2 실측에서 화력 ∝ 시간^3.4 였다(§6-2-4). 뒤집으면 영구 배율 M 은
//     걸리는 시간을 M^(-1/3.4) 배로 줄인다. 던전 1~2 실측을 외삽한 값이라 **어림**이다 —
//     화면에도 「어림」이라고 적는다. 실측이 바뀌면 이 두 상수만 고치면 된다.
const CAMP_REB_T10 = 96;      // 배수 없이 던전 10 까지(시간) · HUNT_R1 §4-2-0 표
const CAMP_REB_TEXP = 1 / 3.4;   // 시간 = T10 × M^(-1/3.4)
function campRebHours(mul){ return CAMP_REB_T10 * Math.pow(Math.max(1, mul), -CAMP_REB_TEXP); }
function campRebHourTx(h){ return (h >= 10) ? (Math.round(h) + '시간') : (h.toFixed(1) + '시간'); }

function campRebOpen(){
  const el = document.getElementById('campReb'); if(!el) return;
  el.classList.add('on'); campRebRender();
  // 🖼 배경은 **환생 구역 전용 한 장**(#campRebBg)이다. 여기서 그리지 않고 그것을 켠다.
  //   ⛔ 화면마다 자기 그림을 그리면 전환할 때 호흡 애니가 리셋돼 그림이 툭 튄다.
  //   ⛔ **titleArtShow(true) 를 쓰지 않는다** — 그 함수는 그림(artBg)과 **타이틀 로고(artMark)를
  //     함께** 켠다. 로고(#titleMark)는 부팅 로딩·로그인이 쓰는 것이라, 환생 화면에서는
  //     페이드인하며 게임 로고가 떠오르는 엉뚱한 연출이 된다(2026-08-31 사용자 지적).
  //   ⭐ 그림만 켠다. 끄는 쪽(campRebClose)은 titleArtShow(false) 로 둘 다 꺼도 무해하다.
  campRebArtOn();
  if(typeof playSfx === 'function') playSfx('ui_open'); }
// 🖼 구역의 배경을 켠다 — **환생·업그레이드 두 화면이 함께 쓴다.**
//   ⚠ 트리도 켜 둔다. 제 배경이 거의 불투명해서 안 보일 뿐인데, 안 켜 두면 환생 탭으로
//     넘어오는 순간 그림이 그때부터 떠올라 번쩍인다(2026-08-31).
function campRebArtOn(){
  const bg = document.getElementById('campRebBg'); if(bg) bg.classList.remove('hide');
  // ⚠ 네비를 배경 위로 올려 두는 규칙은 그대로 쓴다 — 배경이 화면을 통째로 덮기 때문이다
  const ph = document.getElementById('phone'); if(ph) ph.classList.add('artLift'); }
function campRebArtOff(){
  const bg = document.getElementById('campRebBg'); if(bg) bg.classList.add('hide');
  const ph = document.getElementById('phone'); if(ph) ph.classList.remove('artLift'); }
// keepArt = **구역 안에서 탭만 바꾸는 중**이라는 뜻 — 그때는 배경을 돌려주지 않는다.
//   ⛔ 무조건 돌려주면 환생 → 업그레이드 로 갈 때 키 아트가 꺼지고, 다시 환생으로 오면
//     **화면은 즉시 뜨는데 그림만 뒤늦게 떠올라** 한 번 번쩍인다(2026-08-31 사용자 신고).
//     트리는 제 배경이 거의 불투명해서 꺼진 것이 안 보였을 뿐이다.
//   ⭐ 배경은 **구역의 것**이다 — 들어올 때 켜고 나갈 때만 돌려준다.
function campRebClose(keepArt){ const el = document.getElementById('campReb'); if(el) el.classList.remove('on', 'crIn');
  if(keepArt) return;
  campRebArtOff();   // 구역을 나갈 때만 끈다(잔상 금지)
}
function campRebIsOn(){ const el = document.getElementById('campReb'); return !!(el && el.classList.contains('on')); }

// 🔁 **환생 구역의 유일한 입구** (2026-08-31 사용자 확정).
//   ⭐ 네비 「환생」 칸의 하위 둘을 여기 한 곳에서 가른다:
//     · 'info' — 지금 환생하면 어떻게 되나(#campReb)
//     · 'tree' — 환생 트리(#campTree)
//   ⛔ 밖에서 campRebOpen()/campTreeOpen() 을 직접 부르지 말 것 — **서로를 안 닫아서**
//     둘 다 `.on` 이 되면 트리가 환생 화면을 덮어 어느 탭인지 알 수 없다.
//   ⚠ 하단 네비는 **켜 둔 채**로 연다(두 화면 CSS 가 네비 높이만큼 자리를 비운다).
function campRebEnter(sec){
  const s = (sec === 'tree') ? 'tree' : 'info';
  // 🎬 페이드는 **구역에 들어올 때 한 번만**이다 (2026-08-31 사용자 지적).
  //   ⛔ `.on` 에 애니를 걸면 환생 ↔ 업그레이드 탭을 오갈 때마다 매번 다시 돈다 —
  //     같은 구역 안에서 칸만 바꾸는 것인데 화면이 통째로 껌뻑여 이동이 무거워 보인다.
  //   ⭐ 그래서 애니는 `.crIn` 이 가지고, 밖에서 들어온 경우에만 붙인다(안이었으면 즉시 교체).
  const wasIn = (typeof campRebIsOn === 'function' && campRebIsOn()) ||
                (typeof campTreeIsOn === 'function' && campTreeIsOn());
  // ⚠ 닫는 쪽에 keepArt 를 준다 — 구역 안에서 칸만 바꾸는 것이라 배경은 그대로 둔다.
  if(s === 'tree'){ campRebClose(true); campTreeOpen(); }
  else { campTreeClose(); campRebOpen(); }
  { const el = document.getElementById(s === 'tree' ? 'campTree' : 'campReb');
    if(el) el.classList.toggle('crIn', !wasIn); }
  // 🧭 네비를 「환생 구역의 하위」 상태로 맞춘다.
  //   ⚠ navShow 만으로는 부족하다 — 그것은 **구역**을 켤 뿐이고, 하위 칸(정보·업그레이드)은
  //     `_navDrill` 이 그 구역일 때만 그려진다(navPaint). 캠프 배지에서 바로 들어오면
  //     _navDrill 이 비어 있어 하위가 통째로 안 나온다.
  //   ⭐ 그래서 셋을 순서대로 부른다: 구역 켜기 → 하위로 내려가기 → 다시 그리기.
  if(typeof navShow === 'function') navShow('reb');
  if(typeof _navDrill !== 'undefined') _navDrill = 'reb';
  if(typeof navPaint === 'function') navPaint();
  return s; }

// 환생 실행 — ⚠ 되돌릴 수 없으므로 확인을 한 번 받는다(.ecCard 공용 확인 껍데기).
//   💳 **×2 는 젬 1회권이 아니라 「환생 팩」(결제)이다**(2026-08-31 사용자 확정 · GEM.md §4).
//     사면 그 뒤로 **계속** 배수·포인트가 2배다 — 실행 경로에 분기가 없고,
//     campRebMulGain / campRebPtGain 안의 campPackRebMul / campPackRebPt 가 알아서 곱한다.
//   ⛔ 젬으로 회차마다 사는 형태로 되돌리지 말 것 — 「1회권」이라는 이름과 달리 횟수를 못 막아
//     결국 같은 영구 2배가 되면서 값만 여러 번 받는 꼴이 된다(그래서 팩으로 옮겼다).
function campRebAsk(){
  if(!campCanRebirth()) return;
  const p = document.getElementById('campRebOk'); if(!p) return;
  const g = { mul: campRebMulGain(), pts: campRebPtGain() };
  const t = p.querySelector('.ecTitle'); if(t) t.textContent = '환생';
  const m = p.querySelector('.ecMsg');
  if(m) m.innerHTML = '지금까지 지은 것이 <b>전부 사라집니다</b>.<br>대신 <b>배수 +' + g.mul.toFixed(2)
    + '</b> 와 <b>포인트 ' + campNum(g.pts) + '</b> 을 영구히 받습니다.';
  const go = p.querySelector('.ecGo'); if(go) go.textContent = '환생하기';
  p.classList.remove('hide');
  if(typeof playSfx === 'function') playSfx('ui_open'); }
function campRebCancel(){ const p = document.getElementById('campRebOk'); if(p) p.classList.add('hide'); }
function campRebGo(){
  campRebCancel();
  const got = campRebirth(); if(!got) return;
  campRebRender();
  if(typeof updateCurBar === 'function') updateCurBar();
  if(typeof toast === 'function') toast('🔁 환생했습니다 — 배수 +'
    + got.mul.toFixed(2) + ' · 포인트 ' + campNum(got.pts));
  if(typeof playSfx === 'function') playSfx('ui_confirm'); }

// 💳 환생 팩을 샀나 — 화면이 「적용 중」과 「사면 2배」를 갈라 보여 주는 데 쓴다
function campRebPackOn(){ return (typeof campPackOwn === 'function') && campPackOwn('reb'); }
function campRebPackX(){ return (typeof campPackRebMul === 'function') ? campPackRebMul() : 1; }

// ⏱ 초 → 「3시간 12분」
function campRebPlayTx(sec){ sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if(h > 0) return h + '시간' + (m ? ' ' + m + '분' : '');
  if(m > 0) return m + '분';
  return sec + '초'; }

function campRebRender(){
  const box = document.getElementById('crBody'); if(!box) return;
  const C = campState(); if(!C){ box.innerHTML = ''; return; }
  const wealth = campWealth(), need = CAMP_REB_COST, can = campCanRebirth();
  const pct = Math.max(0, Math.min(100, wealth / need * 100));
  const gMul = campRebMulGain(), gPts = campRebPtGain();
  const next = campRebMul() + gMul;                 // 배수는 **합**이다(곱이 아니다)
  // 📐 포인트가 어디서 왔는지 — 식을 그대로 쓰지 않고 **곱하는 세 값**으로 쪼갠다.
  //    식을 쓰면 결과(2.96)와 표시(+2 · 바닥내림)가 어긋나 오히려 헷갈린다.
  const fW = Math.sqrt(Math.max(0, wealth) / need);
  const fD = Math.pow(CAMP_RP_DG, Math.max(0, campDgN() - 1));
  const fR = Math.pow(CAMP_RP_RD, campCleared());
  const li = (k, v) => '<div class="crLi"><span>' + k + '</span><b>' + v + '</b></div>';
  box.innerHTML =
    // ── 히어로 = 획득 배수 ──
    '<div class="crHero"><div class="crK">획 득 배 수</div>'
    + '<div class="crBig">' + next.toFixed(2) + '</div>'
    + '<div class="crNow">현재 ×' + campRebMul().toFixed(2) + '</div></div>'
    // ── 포인트 + 계산 근거 ──
    + '<div class="crPt"><div class="crK">획 득 포 인 트</div>'
    + '<div class="crPv">+' + campNum(gPts) + '</div>'
    + '<div class="crFx">재화 <b>' + fW.toFixed(2) + '</b> × 던전 <b>' + fD.toFixed(2)
    + '</b> × 라운드 <b>' + fR.toFixed(2) + '</b></div></div>'
    // ── 이번 회차 지표(②안 · 세로 목록) ──
    + '<div class="crSt"><div class="crH">이 번 회 차</div>'
    + li('터치', campNum(C.tapped || 0) + '회')
    + li('터치로 번 미네랄', campNum(C.earnTap || 0))
    + li('자동으로 번 미네랄', campNum(C.earnAuto || 0))
    + li('가스', campNum(C.earnGas || 0))
    + li('플레이 시간', campRebPlayTx(C.playS))
    + '</div>'
    // ── 조건 ──
    + '<div class="crCond"><div class="crBar' + (can ? ' ok' : '') + '">'
    + '<i style="width:' + pct.toFixed(1) + '%"></i></div>'
    + '<div class="crT"><span>환생 조건</span><span>' + campNum(wealth) + ' / ' + campNum(need) + '</span></div></div>'
    // ── 버튼 ──
    + '<button class="crGo" type="button" onclick="campRebAsk()"' + (can ? '' : ' disabled') + '>환 생</button>'
    // ── 💳 환생 팩 — 사면 **그 뒤로 계속** 2배. 위 두 숫자에 이미 반영돼 있다 ──
    //    ⭐ **버튼 구역**이다(2026-08-31 사용자 확정 · 옛 「조용한 한 줄」에서 승격).
    //      위계는 「환생」보다 한 단 아래 — 같은 얼굴이되 낮고 작다. 색은 보라(현질)를 지킨다.
    //    ⚠ 산 뒤(`.on`)는 **버튼이 아니라 상태 표시**다 — 누를 것이 없으니 button 을 쓰지 않는다.
    + (campRebPackOn()
        ? '<div class="crPk on">환생 팩 ×' + campRebPackX().toFixed(0) + ' 적용 중</div>'
        : '<button class="crPk" type="button" onclick="campRebToShop()">'
          + '환생 팩 — 배수·포인트가 <b>계속 2배</b><u>보러 가기</u></button>');
}
// 환생 팩을 보러 상점으로 — 팩은 **추천 칸**에 있다(젬 칸이 아니다)
function campRebToShop(){ campRebClose();
  if(typeof openShop === 'function') openShop();
  if(typeof setShopSec === 'function') setShopSec('reco'); }

// ── 화면 열고 닫기 ──────────────────────────────────────────────────────
function campTreeOpen(){
  const el = document.getElementById('campTree'); if(!el) return;
  _campTreeSel = null;
  el.classList.add('on');
  campRebArtOn();   // 🖼 구역 배경은 두 화면이 함께 쓴다 — 여기서 안 켜면 환생 탭으로 넘어갈 때 번쩍인다
  campTreeRender(); campTreeBind();
  // ⚠ 배치를 재려면 화면에 **떠 있어야** 한다(display:none 이면 getBBox 가 0을 준다) — .on 뒤에 부른다
  campTreeFit(true);
}
function campTreeClose(){ const el = document.getElementById('campTree'); if(el) el.classList.remove('on', 'crIn'); }
function campTreeIsOn(){ const el = document.getElementById('campTree'); return !!(el && el.classList.contains('on')); }

// 고른 별의 모든 정보 — 이름 · 진행도 · 설명 · 지금값▶다음값 · 다음 단계 예고 ·
//   비용 · 사고 나면 남는 포인트 · 사기. ⭐ 한 곳에 모은다(2026-09-01 사용자 확정).
//   ⚠ 값·설명은 지어내지 않는다 — 효과 사다리(CAMP_RT_LADDER · CAMP_RT_CUT)에서 그대로 꺼낸다.
function campTreeIsCut(k){ const L = campRtLine(k); return !!L && L.br === 'enemy'; }
function campTreeVal(k, n){
  const L = campRtLine(k), vk = (L && L.vk) || 'mul';
  const i = Math.max(0, Math.min(campRtMax(k), n));
  if(vk === 'cut')  return Math.round(CAMP_RT_CUT[i] * 100) + '%';
  if(vk === 'disc') return Math.round(CAMP_RT_DISC[i] * 100) + '%';
  if(vk === 'sup')  return '+' + CAMP_RT_SUP[i];
  if(vk === 'add')  return '+' + (i ? CAMP_RT_LADDER[i] : 0);
  if(vk === 'cnt')  return String(campRtLad(k)[i]);          // 총량 — 계열이 제 사다리(lad)를 갖는다
  const lad = campRtLad(k);
  return (lad === CAMP_RT_LADDER ? (i ? lad[i] : 1) : lad[i]) + '배'; }
// 📝 설명 한 줄 — 「…이 5배 → 11배 증가합니다」. 지금 값은 흐리게, 다음 값은 굵게.
//   ⭐ 문장은 계열이 갖는다(ds) — 여기서 만들지 않는다. 값 자리만 채운다.
function campTreeDesc(k, n){
  const L = campRtLine(k); if(!L) return '';
  const next = campTreeVal(k, n);
  const v = (n <= 1) ? ('<b>' + next + '</b>')
    : ('<span class="ctWas">' + campTreeVal(k, n - 1) + '</span><span class="ctTo">→</span><b>' + next + '</b>');
  return (L.ds || (L.nm + ' {}')).replace('{}', v); }
// 💠 필요 포인트 한 줄 — 값이 주인공(24px)이고 보유는 옆에 작게.
function campTreePayHTML(cost, pts){
  return '<div class="ctPay"><span class="ctPip"></span>' +
    '<span class="ctCv">' + campNum(cost) + '</span>' +
    '<span class="ctHave">필요 · 보유 ' + campNum(pts) + '</span></div>'; }
function campTreeInfo(){
  const el = document.getElementById('campTree'); if(!el) return;
  const host = el.querySelector('.ctSheet'); if(!host) return;
  const C = campState(), pts = (C && C.rbPts) || 0;
  const sel = _campTreeSel;
  el.classList.toggle('picked', !!sel);
  if(!sel){ host.innerHTML = '<div class="ctHint">' +
      (campRtRootOn() ? '별을 눌러 보세요' : '가운데를 눌러 시작') + '</div>';
    return; }
  // ── 🌟 가운데 — 트리의 열쇠이자 **첫 환생의 보상**
  if(sel.t === 'root'){
    const own = campRtRootOn(), can = campRtCanBuy('root'), left = pts - CAMP_RT_ROOT_COST;
    const bldNm = (function(){ if(!CAMP_ROOT_BLD) return '';
      const race = (typeof G !== 'undefined' && G.tech) ? G.tech.race : null;
      const B = (typeof TECH_TREE !== 'undefined' && race && TECH_TREE[race] &&
        (TECH_TREE[race].buildings || []).find(function(x){ return x.k === CAMP_ROOT_BLD; }));
      return (B && B.name) || CAMP_ROOT_BLD; })();
    host.innerHTML =
      '<div class="ctHead"><span class="ctIco core">✦</span>' +
      '<div class="ctHt"><div class="ctNm">새로운 시작</div></div></div>' +
      '<div class="ctDesc">회차 시작 시 미네랄 <b>' + campNum(CAMP_ROOT_MIN) + '</b> · 일꾼 <b>' +
      CAMP_ROOT_WK + '</b>' + (bldNm ? ' · ' + bldNm + ' <b>1</b>' : '') + '</div>' +

      campTreePayHTML(CAMP_RT_ROOT_COST, pts) +
      '<button class="ctBuy' + (own || !can ? ' off' : '') + '" type="button" data-key="root"' +
        (own || !can ? ' disabled' : '') + '>' +
        (own ? '보유' : (can ? '해 금' : '포인트가 모자랍니다')) + '</button>';
    return; }
  // ── 마디(갈래·묶음) — 계열이 아니라서 등급·차수가 없다
  if(sel.t === 'br' || sel.t === 'gp'){
    const bk = sel.a, B = CAMP_TREE_BR[bk];
    const key = sel.t === 'br' ? CAMP_RT_BR_KEY(bk) : CAMP_RT_GP_KEY(bk, sel.b);
    const cost = sel.t === 'br' ? CAMP_RT_BR_COST : CAMP_RT_GP_COST;
    const own = campRtHas(key) > 0, can = campRtCanBuy(key), left = pts - cost;
    const nm = sel.t === 'br' ? B.nm : (B.nm + ' · ' + sel.b + ' 묶음');
    const tx = sel.t === 'br' ? '묶음 <b>4</b> 해금' : '계열 <b>2</b> 해금';
    host.innerHTML =
      '<div class="ctHead"><span class="ctDot" style="background:' + B.col + '"></span>' +
      '<div class="ctHt"><div class="ctNm">' + nm + '</div></div></div>' +
      '<div class="ctDesc">' + tx + '</div>' +
      campTreePayHTML(cost, pts) +
      '<button class="ctBuy' + (own || !can ? ' off' : '') + '" type="button" data-key="' + key + '"' +
        (own || !can ? ' disabled' : '') + '>' +
        (own ? '보유' : (can ? '해 금' : '포인트가 모자랍니다')) + '</button>';
    return; }
  // ── 계열 별
  const k = sel.a, n = sel.b, L = campRtLine(k); if(!L) return;
  const B = CAMP_TREE_BR[L.br], st = campTreeState(k, n);
  const cost = campRtCost(k, n), have = campRtHas(k);
  const own = st === 'own';
  // 🎯 원형 게이지 + 설명 한 줄 + 필요 포인트(2026-09-01 사용자 확정).
  //   ⛔ 「재화 획득 · 흔함 · T13」 메타 줄을 되살리지 말 것 — 두 번 빼라고 했다.
  //   ⛔ 짝 조건(관문) 줄도 없다 — 규칙 자체를 걷어냈다.
  //   ⭐ 값은 문장 안에 있다: 「일꾼의 1회 채취량이 5배 → 11배 증가합니다」.
  const gR = 25, gC = 2 * Math.PI * gR;                    // 게이지 고리
  const gauge = '<span class="ctRing">' +
    '<svg viewBox="0 0 56 56"><circle class="ctRingBg" cx="28" cy="28" r="' + gR + '"/>' +
    '<circle class="ctRingOn" cx="28" cy="28" r="' + gR + '" stroke-dasharray="' + gC.toFixed(1) +
    '" stroke-dashoffset="' + (gC * (1 - have / campRtMax(k))).toFixed(1) + '"/></svg>' +
    '<img src="' + CAMP_TREE_ICO + L.ic + '" alt=""></span>';
  const canBuy = (st === 'buy');
  const label = own ? '보유'
    : canBuy ? (n === 1 ? '해 금' : '강 화')
    : (pts < cost ? '포인트가 모자랍니다' : '아직 열리지 않았습니다');
  host.innerHTML =
    '<div class="ctHead">' + gauge +
    '<div class="ctHt"><div class="ctNm">' + L.nm + '</div>' +
    '<div class="ctStage">' + campRtStep(k, n) + '</div></div></div>' +
    '<div class="ctDesc">' + campTreeDesc(k, n) + '</div>' +
    campTreePayHTML(cost, pts) +
    '<button class="ctBuy' + (canBuy ? '' : ' off') + '" type="button" data-key="' + k + '"' +
      (canBuy ? '' : ' disabled') + '>' + label + '</button>';
}
// ❓ 도움말 — 트리 **전체에 공통인 규칙**을 여기 한 곳에 모은다.
//   ⛔ 별마다 「영구」·「회차마다」 같은 꼬리표를 달지 말 것 — 32계열 × 5차 = 160번 같은 말이 된다
//     (2026-09-01 사용자 지적). 공통 규칙은 규칙을 읽는 자리에 두고, 별에는 그 별만의 값을 둔다.
//   ⚠ 숫자는 상수에서 꺼낸다 — 손으로 적으면 값을 바꿀 때 문구만 옛말이 된다.
function campTreeHelpHTML(){
  const cut = Math.round(CAMP_RT_CUT_MAX * 100);
  const floor = Math.round((1 - CAMP_RT_CUT_FLOOR) * 100);
  return '<div class="ctHelpHd">환생 트리</div>' +
    '<ul class="ctHelpLi">' +
    '<li><b>환생 포인트</b>로 별을 해금합니다.</li>' +
    '<li>해금한 것은 <b>환생해도 사라지지 않고</b> 계속 적용됩니다.</li>' +
    '<li>가운데 → <b>갈래</b> → <b>묶음</b> → 계열 순으로 열립니다.</li>' +
    '<li>두 손가락으로 <b>확대</b>, 끌어서 <b>이동</b>, 빈 곳을 <b>두 번</b> 누르면 전체가 보입니다.</li>' +
    '<li>적 약화는 계열마다 최대 <b>−' + cut + '%</b>, 갈래 전체로는 <b>−' + floor + '%</b>까지입니다.</li>' +
    '</ul><button class="ctHelpX" type="button">닫기</button>'; }
function campTreeHelp(on){
  const el = document.getElementById('campTree'); if(!el) return;
  const h = el.querySelector('.ctHelp'); if(!h) return;
  if(on){ h.querySelector('.ctHelpCard').innerHTML = campTreeHelpHTML(); h.classList.remove('hide'); }
  else h.classList.add('hide'); }

// 🔍 뷰 적용 — 고른 별이 있으면 그 자리가 화면 (0, campTreeSelY()) 에 오도록 옮기고 확대한다.
//   ⭐ 확대·이동은 **여기 한 곳**에서만 계산한다. 그리기(campTreeSvg)는 월드 좌표만 안다.
function campTreeApplyView(){
  const g = document.getElementById('ctG'); if(!g) return;
  const v = _campTreeView;
  g.setAttribute('transform', 'translate(' + v.x.toFixed(1) + ' ' + v.y.toFixed(1) +
    ') scale(' + v.z.toFixed(3) + ')');
}
// ══ 🎬 뷰 이동 애니메이션 ═══════════════════════════════════════════════
//   ⭐ 「천천히 출발 → 아주 빠르게 → 마지막에 살며시」(2026-09-01 사용자 지정).
//     그 느낌은 5제곱 ease-in-out 이다 — 3제곱은 중간이 밋밋하고, 그 이상은 순간이동처럼 보인다.
//   ⛔ 배율을 선형으로 보간하지 말 것. 확대는 **곱셈 축**이라 0.6→1.6 을 선형으로 끌면
//     앞쪽이 훅 커지고 뒤쪽이 느려 보인다. 로그(등비)로 끌어야 눈에 일정하다.
//   ⭐ 무엇을 보간하는가: **「어느 월드점(P)이 화면 어디(A)에 오는가」와 배율(z)** 셋이다.
//     x·y 를 직접 끌면 확대와 이동이 따로 놀아 목표가 화면 밖으로 휘어 나간다.
const CAMP_TREE_TWEEN_MS = 560;
let _ctTween = null;
function campTreeEase(t){ return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2; }
// 지금 화면 한가운데에 있는 월드점 — 애니의 출발점이다
function campTreeViewP(){ const v = _campTreeView;
  return { x: -v.x / v.z, y: -v.y / v.z }; }
function campTreeTweenStop(){ _ctTween = null; }
//   to = { P:{x,y} 월드점 · A:{x,y} 그 점이 앉을 화면 자리 · z 배율 }
function campTreeTweenTo(to, now){
  const v = _campTreeView;
  if(now){ _ctTween = null;
    v.z = to.z; v.x = to.A.x - to.P.x * to.z; v.y = to.A.y - to.P.y * to.z;
    campTreeApplyView(); return; }
  _ctTween = { t0: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    ms: CAMP_TREE_TWEEN_MS, z0: v.z, z1: to.z,
    P0: campTreeViewP(), P1: { x:to.P.x, y:to.P.y },
    A0: { x:0, y:0 }, A1: { x:to.A.x, y:to.A.y } };
  campTreeTweenStep(); }
function campTreeTweenStep(){
  const w = _ctTween; if(!w) return;
  const el = document.getElementById('campTree');
  if(!el || !el.classList.contains('on')){ _ctTween = null; return; }   // 화면이 닫혔으면 그만둔다
  const t = Math.min(1, ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - w.t0) / w.ms);
  const e = campTreeEase(t);
  const z = w.z0 * Math.pow(w.z1 / w.z0, e);                            // 등비로 — 눈에 일정하다
  const px = w.P0.x + (w.P1.x - w.P0.x) * e, py = w.P0.y + (w.P1.y - w.P0.y) * e;
  const ax = w.A0.x + (w.A1.x - w.A0.x) * e, ay = w.A0.y + (w.A1.y - w.A0.y) * e;
  _campTreeView.z = z; _campTreeView.x = ax - px * z; _campTreeView.y = ay - py * z;
  campTreeApplyView();
  if(t >= 1){ _ctTween = null; return; }
  requestAnimationFrame(campTreeTweenStep); }

// 고른 별로 뷰를 옮긴다(선택이 없으면 그대로 둔다)
function campTreeFocus(now){ const sel = _campTreeSel; if(!sel) return;
  const p = campTreeSelPos(sel); if(!p) return;
  campTreeTweenTo({ P:p, A:{ x:0, y:campTreeSelY() },
    z: Math.max(_campTreeView.z, CAMP_TREE_ZSEL) }, now); }
// 📊 해금 진행도 — 열 수 있는 칸 전부(가운데 1 + 갈래 4 + 묶음 16 + 계열 32×5)를 분모로 센다.
//   ⚠ 숫자를 손으로 적지 말 것 — 계열이나 갈래가 늘면 저절로 따라와야 한다.
function campTreeTotal(){
  let n = 1;                                            // 가운데
  for(const bk in CAMP_TREE_BR){ if(campRtIsChain(bk)) continue;        // 사슬 갈래엔 관문이 없다
    n++;                                                                // 갈래
    for(const g of CAMP_RT_GRP_KEYS) if(campRtGpLive(bk, g)) n++; }      // 그 안의 **살아 있는** 묶음
  for(const L of CAMP_RT_LINES) n += campRtMax(L.k);
  return n; }
function campTreeOwned(){
  let n = campRtRootOn() ? 1 : 0;
  for(const bk in CAMP_TREE_BR){ if(campRtBrOn(bk)) n++;
    for(const g of CAMP_RT_GRP_KEYS) if(campRtGpOn(bk, g)) n++; }
  for(const L of CAMP_RT_LINES) n += campRtHas(L.k);
  return n; }
function campTreeProg(){
  const el = document.getElementById('campTree'); if(!el) return;
  const have = campTreeOwned(), all = campTreeTotal();
  const bar = el.querySelector('.ctBar i'); if(bar) bar.style.width = (have / all * 100).toFixed(1) + '%';
  const tx = el.querySelector('.ctProgN'); if(tx) tx.textContent = have + ' / ' + all; }
function campTreeRender(){
  const el = document.getElementById('campTree'); if(!el) return;
  const g = el.querySelector('#ctG'); if(g) g.innerHTML = campTreeSvg();
  campTreeApplyView();
  const C = campState();
  const pt = el.querySelector('.ctPts'); if(pt) pt.textContent = campNum(C ? (C.rbPts || 0) : 0);
  campTreeProg();
  campTreeInfo();
}
// 큰 수 표기 — **재화 바와 같은 규칙**을 쓴다(`fmtCur` · js/12-appshell.js).
// ⛔ 여기서 억/만 같은 표기를 다시 짜지 말 것 — 표기가 두 벌이 되면 화면마다 달라진다.
//   실제로 병합 중에 사본이 하나 더 생겨 파일이 통째로 죽었다(2026-08-28 · campNum 중복 선언).
//   ⚠ 그 사본은 `fmtNum`/`numAbbr` 를 먼저 찾았는데 **이 저장소에 없는 이름**이었다.
function campNum(n){ if(typeof fmtCur === 'function') return fmtCur(n);
  return Math.floor(n).toLocaleString('en-US'); }

// 별을 누르면 고른다. 이미 고른 별을 다시 누르면 산다(두 번 누르기 = 구매).
//   ⚠ 마디는 data-k 가 'br:econ' · 'gp:econ가' 로 온다 — 계열 키와 접두사로 갈린다.
function campTreeTap(k, n){
  let sel;
  if(k === 'root') sel = { t:'root', a:'root' };
  else
  if(k.indexOf('br:') === 0) sel = { t:'br', a:k.slice(3) };
  else if(k.indexOf('gp:') === 0) sel = { t:'gp', a:k.slice(3, -1), b:k.slice(-1) };
  else sel = { t:'n', a:k, b:+n };
  const same = _campTreeSel && _campTreeSel.t === sel.t && _campTreeSel.a === sel.a &&
    String(_campTreeSel.b) === String(sel.b);
  if(same){ campTreeBuySel(); return; }
  _campTreeSel = sel; campTreeRender(); campTreeFocus();
}
// ⊘ 지정 해제 — 고른 것을 놓고 원래 배율로 돌아간다(메인 #deselTop 과 같은 아이콘·같은 뜻)
function campTreeDesel(){ _campTreeSel = null;
  campTreeRender();
  campTreeFit();          // 들어올 때와 같은 곡선으로 물러난다
}
function campTreeBuySel(){
  const el = document.getElementById('campTree'); if(!el) return;
  const btn = el.querySelector('.ctBuy'); if(!btn || btn.disabled) return;
  const key = btn.dataset.key; if(!key) return;
  if(!campRtCanBuy(key)) return;
  campRtBuy(key);
  if(typeof playSfx === 'function') playSfx('upgrade');
  campTreeRender();
}
// ── 🔍 밀고 확대 ────────────────────────────────────────────────────────
//   ⛔ 캠프 맵의 팬·줌(campPatchZoom)을 빌리지 말 것 — 그건 건설 격자 좌표계에 묶여 있다.
//   여기는 SVG 변환 하나뿐이라 훨씬 단순하다: 화면점 = 월드점 × z + (x, y).
//
//   ⭐ **확대는 손가락(또는 커서) 자리를 붙잡고 한다**(2026-09-01). 화면 중심을 기준으로 키우면
//     보고 있던 별이 옆으로 흘러가 버려서, 확대할수록 목표를 놓친다.
//     붙잡는 식: 확대 전후로 그 점의 화면 좌표가 같아야 하므로
//       new.x = px − (px − old.x) × (z2 / z1)
//   ⚠ 화면 좌표는 SVG 의 **뷰포트 픽셀**이 아니라 viewBox 단위다 — 둘을 섞으면 손가락을 따라오지
//     않는다(비율이 화면 크기마다 다르다). campTreeToView() 가 그 환산을 맡는다.
let _ctBound = false, _ctPtrs = new Map(), _ctDrag = null, _ctPinch = null, _ctMoved = 0, _ctTapT = 0;
let _ctDown = null, _ctDownXY = null;   // 👆 pointerdown 때 잡아 둔 별과 그 자리
const CAMP_TREE_ZSTEP = 1.22;       // 휠 한 칸 · 두 번 누르기의 배율
const CAMP_TREE_TAP_SLOP = 14;      // 이만큼까지는 「누른 것」 — 손가락은 가만히 못 있는다
// 🔍 축소 한계는 **해금 정도에 따라 풀린다** (2026-09-02 사용자 확정)
//   초반엔 별이 몇 개뿐이라 마음껏 축소하면 화면이 텅 빈다. 그래서 「전체 보기」 배율보다
//   조금만 더 물러날 수 있게 막는다. 별이 늘면 전체 보기 배율이 저절로 내려가고 하한도
//   따라 내려간다 — ⛔ 회차·개수로 표를 짜지 말 것(계열이 늘면 표가 곧 거짓말이 된다).
const CAMP_TREE_ZOUT = 0.72;        // 전체 보기 배율의 몇 배까지 더 물러날 수 있나
let _ctFitZ = 0;                    // 마지막 「전체 보기」 배율 — campTreeFit 이 적어 둔다
function campTreeZMin(){ return Math.max(CAMP_TREE_ZMIN, (_ctFitZ || 0) * CAMP_TREE_ZOUT); }
function campTreeClampZ(z){ return Math.max(campTreeZMin(), Math.min(CAMP_TREE_ZMAX, z)); }
// 화면(클라이언트) 좌표 → SVG viewBox 좌표
function campTreeToView(cx, cy){
  const svg = document.getElementById('ctSvg'); if(!svg) return { x:0, y:0 };
  const r = svg.getBoundingClientRect();
  const vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/\s+/).map(Number);
  if(!r.width || !r.height) return { x:0, y:0 };
  // preserveAspectRatio="xMidYMid meet" — 짧은 쪽에 맞춰 여백이 생긴다
  const s = Math.min(r.width / vb[2], r.height / vb[3]);
  const ox = (r.width - vb[2] * s) / 2, oy = (r.height - vb[3] * s) / 2;
  return { x: vb[0] + (cx - r.left - ox) / s, y: vb[1] + (cy - r.top - oy) / s };
}
// ⭐ 한 점을 붙잡고 배율을 바꾼다 — 확대·축소의 유일한 입구
function campTreeZoomAt(z2, cx, cy){
  campTreeTweenStop();                 // 손으로 확대하면 진행 중인 연출은 멈춘다
  const v = _campTreeView, z1 = v.z;
  z2 = campTreeClampZ(z2); if(z2 === z1) return;
  const p = (cx == null) ? { x:0, y:0 } : campTreeToView(cx, cy);
  v.x = p.x - (p.x - v.x) * (z2 / z1);
  v.y = p.y - (p.y - v.y) * (z2 / z1);
  v.z = z2; campTreeApplyView();
}
function campTreeBind(){
  const el = document.getElementById('campTree'); if(!el || _ctBound) return;
  const svg = el.querySelector('#ctSvg'); if(!svg) return;
  _ctBound = true;
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId); _ctPtrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
    _ctMoved = 0; campTreeTweenStop();
    // 👆 누른 별을 **여기서** 잡아 둔다. capture 뒤에는 target 이 <svg> 가 되어 알 수 없다.
    _ctDown = (e.target.closest && e.target.closest('[data-k]')) || campTreeNearest(e.clientX, e.clientY);
    _ctDownXY = { x:e.clientX, y:e.clientY };
    if(_ctPtrs.size === 1) _ctDrag = { x:e.clientX, y:e.clientY, vx:_campTreeView.x, vy:_campTreeView.y };
    else if(_ctPtrs.size === 2){ _ctDrag = null; _ctPinch = campTreePinch(); }
  });
  svg.addEventListener('pointermove', e => {
    if(!_ctPtrs.has(e.pointerId)) return;
    _ctPtrs.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(_ctPinch && _ctPtrs.size === 2){ const now = campTreePinch();
      if(now && _ctPinch.d > 0){
        // 두 손가락 **가운데를 붙잡고** 키운다 — 중심 기준으로 하면 보던 곳이 흘러간다
        campTreeZoomAt(_campTreeView.z * (now.d / _ctPinch.d), now.cx, now.cy);
        _ctMoved = 99;                 // 핀치 뒤 손을 뗄 때 별이 눌리지 않게
        _ctPinch = now; }
      return; }
    if(_ctDrag){ const dx = e.clientX - _ctDrag.x, dy = e.clientY - _ctDrag.y;
      _ctMoved = Math.max(_ctMoved, Math.abs(dx) + Math.abs(dy));
      // ⚠ 끄는 거리도 viewBox 단위로 바꿔야 손가락과 그림이 **같은 속도**로 움직인다
      const a = campTreeToView(_ctDrag.x, _ctDrag.y), b = campTreeToView(e.clientX, e.clientY);
      _campTreeView.x = _ctDrag.vx + (b.x - a.x); _campTreeView.y = _ctDrag.vy + (b.y - a.y);
      campTreeApplyView(); }
  });
  svg.addEventListener('pointerup', e => {
    const el = _ctDown, xy = _ctDownXY;
    _ctPtrs.delete(e.pointerId); if(_ctPtrs.size < 2) _ctPinch = null; if(!_ctPtrs.size) _ctDrag = null;
    _ctDown = null;
    if(_ctMoved > CAMP_TREE_TAP_SLOP) return;         // 밀었으면 탭이 아니다
    if(el){ _ctTapT = 0; campTreeTap(el.dataset.k, +el.dataset.n); return; }
    // ⭐ 별을 고른 채로 **빈 하늘을 누르면 되돌아간다**(2026-09-01 사용자 확정 · ⊘ 를 없앤 자리).
    //   ⛔ 별도의 해제 버튼을 다시 만들지 말 것 — 「고른 것 말고 다른 데를 누른다」가 곧 해제다.
    if(_campTreeSel){ _ctTapT = 0; campTreeDesel(); return; }
    // 빈 하늘을 **두 번 톡톡** = 전체 보기(연출은 campTreeFit 이 맡는다)
    const now = Date.now();
    if(now - _ctTapT < 320){ _ctTapT = 0; campTreeFit(); return; }
    _ctTapT = now; });
  svg.addEventListener('pointercancel', e => { _ctPtrs.delete(e.pointerId); _ctDown = null;
    if(_ctPtrs.size < 2) _ctPinch = null; if(!_ctPtrs.size) _ctDrag = null; });
  // 🖱 휠 — 커서 자리를 붙잡고 확대. ⚠ passive:false 여야 페이지가 같이 스크롤되지 않는다
  svg.addEventListener('wheel', e => { e.preventDefault();
    const k = e.deltaY < 0 ? CAMP_TREE_ZSTEP : 1 / CAMP_TREE_ZSTEP;
    campTreeZoomAt(_campTreeView.z * k, e.clientX, e.clientY);
  }, { passive:false });
  // ⚠ 밀고 나서 손을 뗄 때 별이 눌리면 안 된다 — 움직인 거리로 가른다
  // 시트의 버튼들 — 시트는 다시 그려지므로 **위임**으로 받는다(요소에 직접 걸면 한 번 쓰고 끊긴다)
  el.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.ctBuy');
    if(b && !b.disabled){ campTreeBuySel(); return; }
    if(e.target.closest && e.target.closest('.ctQ')){ campTreeHelp(true); return; }
    // 카드 밖(딤)이나 「닫기」를 누르면 접는다
    if(e.target.closest && e.target.closest('.ctHelpX')){ campTreeHelp(false); return; }
    if(e.target.classList && e.target.classList.contains('ctHelp')) campTreeHelp(false);
  });
  // ⛔ 확대·축소 **버튼을 만들지 말 것**(2026-09-01 사용자 확정) — 손가락으로만 한다:
  //   핀치(두 손가락) · 끌기 · 빈 하늘 두 번 톡톡. 데스크톱은 휠.
}
// 🔭 전체가 보이게 — 처음 열 때와 「전체」 버튼이 같은 자리로 돌려놓는다.
//   ⭐ 배율을 상수로 박지 않는다. **지금 그려진 별들의 경계**를 재서 맞춘다 —
//     첫 회차에는 별이 다섯이고 후반에는 수십 개라, 고정 배율이면 한쪽은 늘 어긋난다.
//   ⚠ 재기 전에 변환을 1배로 되돌려야 한다. getBBox 는 그룹의 변환 **뒤** 좌표를 주므로,
//     확대된 채로 재면 그 배율이 한 번 더 곱해진다.
const CAMP_TREE_FIT_PAD = 30;        // 가장자리 여백(viewBox 단위)
const CAMP_TREE_FIT_ZMAX = 1.35;     // ⚠ 「전체 보기」의 배율 상한 — 첫 회차엔 별이 다섯뿐이라
                                     //   경계에 딱 맞추면 그 다섯이 화면을 꽉 채워 어색하다.
function campTreeFit(now){ _campTreeSel = null;
  campTreeRender();
  const svg = document.getElementById('ctSvg');
  // ⛔ getBBox() 를 쓰지 말 것 — 갈래 이름표(반지름 300)와 후광까지 범위에 넣어서
  //   별 무리는 위쪽에 뭉쳐 있는데 경계 중심은 원점이 된다(실측: 아래 절반이 통째로 비었다).
  //   ⭐ **별의 자리만** 모은다. 이름표는 따라오면 되는 장식이지 맞출 대상이 아니다.
  let x0 = 0, y0 = 0, x1 = 0, y1 = 0, n = 0;
  document.querySelectorAll('#ctG .ctGem').forEach(e => {
    const x = +e.getAttribute('cx'), y = +e.getAttribute('cy'), r = (+e.getAttribute('r') || 0) + 12;
    if(!isFinite(x) || !isFinite(y)) return;
    if(!n){ x0 = x - r; x1 = x + r; y0 = y - r; y1 = y + r; }
    else { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r);
           y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
    n++; });
  const w0 = x1 - x0, h0 = y1 - y0;
  if(!n || !svg || !(w0 > 1) || !(h0 > 1)){
    _ctFitZ = 0.62;
    campTreeTweenTo({ P:{x:0,y:0}, A:{x:0,y:0}, z:0.62 }, now); return; }
  const vb = (svg.getAttribute('viewBox') || '0 0 430 660').split(/\s+/).map(Number);
  // ⭐ 시트가 가리는 만큼을 **빼고** 맞춘다 — 안 골랐으면 0 이라 화면 전체를 쓴다.
  const sheet = campTreeSheetH();
  const w = vb[2] - CAMP_TREE_FIT_PAD * 2, h = vb[3] - sheet - CAMP_TREE_FIT_PAD * 2;
  // ⚠ 하한(campTreeZMin)의 기준이 되는 값이라 **클램프 전** 값을 적어 둔다 — 클램프한 값을
  //   넣으면 자기 자신을 기준으로 삼아 하한이 점점 올라간다.
  const zRaw = Math.min(w / w0, h / h0, CAMP_TREE_FIT_ZMAX);
  _ctFitZ = zRaw;
  const z = campTreeClampZ(zRaw);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  campTreeTweenTo({ P:{x:cx,y:cy}, A:{x:0,y:-sheet / 2}, z }, now); }
// 👆 그 자리에서 가장 가까운 별 — 없으면 null.
//   ⚠ 임계는 **화면 픽셀**이다(월드 좌표가 아니다). 축소하면 별이 촘촘해 보이므로
//     화면 기준으로 재야 「눈에 보이는 만큼 가까운 것」을 고른다.
const CAMP_TREE_NEAR_PX = 34;
function campTreeNearest(cx, cy){
  const g = document.getElementById('ctG'); if(!g) return null;
  let best = null, bd = CAMP_TREE_NEAR_PX * CAMP_TREE_NEAR_PX;
  const list = g.querySelectorAll('[data-k]');
  for(let i = 0; i < list.length; i++){
    const r = list[i].getBoundingClientRect();
    if(!r.width) continue;
    const dx = (r.left + r.width / 2) - cx, dy = (r.top + r.height / 2) - cy;
    const d = dx * dx + dy * dy;
    if(d < bd){ bd = d; best = list[i]; } }
  return best; }
function campTreePinch(){ const a = [..._ctPtrs.values()]; if(a.length < 2) return null;
  return { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y),
    cx: (a[0].x + a[1].x) / 2, cy: (a[0].y + a[1].y) / 2 }; }

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
// 던전 → 적 종족. ⭐ **`HB_DUNGEONS`(js/08-hunt.js)가 단일 소스**다 — 던전 이름·배경 그림과 맞춘다.
//   ⛔ 옛 코드는 STK_RACE_ORDER 를 그냥 돌려서 이름·그림과 어긋나 있었다(2026-08-30 발견):
//     「감염된 둥지」에 유니온이, 「산란장」에 페럴이 나왔다. 배경 그림은 이름 기준으로 그렸으므로
//     그림에 알집이 깔린 산란장에 야수가 걸어 나오는 상태였다.
//   ⚠ 표의 이름(union/swarm/aetherial)과 엔진 키(terran/zerg/protoss)가 달라 한 번 옮긴다.
const CAMP_DG_RACE = { union:'terran', swarm:'zerg', aetherial:'protoss', feral:'feral', colossus:'colossus',
  abyss:'colossus' };   // 심연(10)은 전용 종족이 없다 — 가장 무거운 콜로서스로 대신한다
function campFoeRace(dg){
  const n = dg | 0;
  if(n <= 0) return 'terran';                        // 0단계 캠프는 유니온
  const d = (typeof hbDun === 'function') ? hbDun(n) : null;
  const r = d && CAMP_DG_RACE[d.race];
  if(r && typeof STK_RACES !== 'undefined' && STK_RACES[r]) return r;
  const o = (typeof STK_RACE_ORDER !== 'undefined') ? STK_RACE_ORDER : ['terran'];
  return o[Math.max(0, n - 1) % o.length]; }         // 폴백 — 표가 없거나 그 종족이 엔진에 없을 때

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
// ⭐ 체력 3.3 → 40 → 1,300 → 300 → **800** (2026-08-29 확정, HUNT_R1 §6-2).
//   ⚠ 값이 네 번 바뀐 이유는 **매번 전제가 틀렸기 때문**이다. 그 기록이 곧 이 축의 설명이다:
//     3.3·40  아군 병력을 9~17기로 본 **시뮬 추정**(재지 않았다)
//     1,300   **명목 DPS**(공격력 합)로 역산 — 실제로 꽂히는 화력은 그 3분의 1이었다
//     300     **꽂힌 화력**으로 역산 — 방향은 맞았지만 그때 아군이 한 점에 뭉쳐 있었다
//     800     뭉침을 걷어낸 뒤(유닛이 한 번만 태어난다 · BALANCE §3-6) 다시 역산
//   ⭐ R50 을 2~4분에 두는 것이 확정 의도라 거기서 역산했다 — d(50)=1.07^49=27.53,
//     꽂힌 화력 F(50)≈130(R33 의 98 에서 외삽 · 병력이 인구 상한에 닿아 연구로만 는다).
//   ⭐ **추정 오차에 강한 값이다.** F(50) 이 98~160 어디로 튀어도 R50 이 2.3~3.7분에 든다.
//   ⚠ **초반이 길다 — 알고 고른 것이다.** R1~10 이 약 35초로 목표(6~11초)의 3~6배다.
//     새 구조에서 후반 꽂힌 화력이 45 → 130 으로 크게 올라 곡선이 가팔라졌고, 초반은 병력이
//     11기뿐이라 덜 올랐다. **상수 하나로는 양쪽을 못 맞춘다** — R50 을 맞추면 R1 이 길어진다.
//     줄이려면 적 난이도를 구간별로 두어야 하는데(손잡이가 둘이 된다) 사용자 결정이 필요하다.
// ⚠ **공격(0.33)은 같이 올리지 않는다.** 체력은 「얼마나 오래 싸우나」, 공격은 「얼마나 위험한가」다.
//   라운드 길이는 체력만으로 늘고, 공격까지 함께 올리면 본부(체력 150)가 몇 초에 부서진다.
const CAMP_FOE_HP0 = 800, CAMP_FOE_ATK0 = 0.33;
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
  // 🏛 **내 본부도 설계 스케일로 낮춘다** — 엔진 기본값 7500 은 오토배틀(신전)용이다.
  //   ⛔ 이게 빠져 있어서 「전멸 뒤 적이 건물을 부수며 밀고 들어온다」(2026-08-30 패배 규칙)가
  //     실제로는 **작동하지 않았다.** 실측(2026-08-30 · D1R1): 적 총 DPS 0.137 → 본부 7500 을
  //     부수는 데 **909분**. 벤치가 「D1R1 를 30분째 못 깸」으로 멈춘 벽의 정체가 이것이다.
  //   ⭐ 일반 건물(CAMP_BLD_HP = 1200/10)과 **같은 방식**으로 1/10 스케일을 적용한다.
  S.me.base.maxHp = S.me.base.hp = CAMP_BASE_HP;
  S.me.units.length = 0; S.ai.units.length = 0;
  // 🌳 「건물 강화」 — 내 건물 전체의 체력에 얹는다(HUNT_R1 §4-5-3)
  { const bm = campRtMul('bldg');
    if(bm !== 1){ S.me.base.maxHp = (S.me.base.maxHp || S.me.base.hp) * bm; S.me.base.hp = S.me.base.maxHp; } }
  CAMPB = S;
  campBuildStructs();                                  // 🏢 기지의 건물들을 전장에 올린다
  campAdoptBaseUnits();                                // 🪖 캠프에서 뽑아 둔 병력을 그 자리로 데려온다
  return S;
}
// 🪖 **캠프(0단계)에서 뽑은 병력을 전장이 열릴 때 데려온다.**
//   ⛔ 던전 밖에는 전장이 없어서(CAMPB=null) 생산 가로채기가 못 옮긴다 — 그동안은 기지에 선다.
//     전장이 열리는 순간 **그 자리 그대로** 데려와야 한다.
//   ⚠ 실측(2026-08-28)에서 이걸 빠뜨려 판이 통째로 멈췄다: 캠프에서 54기를 뽑아 두었는데
//     던전에 들어가면 전장 병력이 0 이라 곧바로 패배 → 캠프 → 다시 입장이 2,583번 반복됐다.
//   ⛔ 인구를 반환하지 않는다 — 옛 출격이 그걸 해서 인구 상한이 무력했다.
// 🚪 **병력이 없으면 던전에 못 들어간다** (2026-08-30 구현 · 설계는 사용자 확정분).
//   ⛔ 이것이 없어서 맨몸으로 던전에 들어가 계속 졌다 — 30분 벤치에서 **패배 9번**,
//     「D1R1 10분 · D1R2 17.4분」짜리 이상한 라운드가 그 자리다.
//   ⭐ 초반 9.4분이 병력 0 인 것은 **설계대로다**(시작 미네랄 0 → 탭 → 일꾼 140 → 마린 5,000).
//     그 시간은 캠프(0단계)에서 보내야 한다 — 거긴 적이 없다.
//   ⚠ 누운 병력도 센다 — 라운드가 시작되면 일어나므로 「데리고 들어갈 수 있는 병력」이다.
//   ⚠ 일꾼은 안 센다 — STK_UNITS 에 없는 것이 일꾼이다(campAdoptBaseUnits 와 같은 잣대).
function campCombatCount(){
  let n = 0;
  if(typeof G !== 'undefined' && G.tech && typeof STK_UNITS !== 'undefined')
    for(const e of (G.tech.ents || [])) if(e && e.type === 'unit' && STK_UNITS[e.uid]) n++;
  if(typeof CAMPB !== 'undefined' && CAMPB){
    for(const u of (CAMPB.me.units || [])) if(u && !u.dead) n++;
    for(const d of (CAMPB._down || [])) if(d && d.u) n++; }
  return n; }
// 캠프(0)로 돌아가는 것은 **언제나 된다** — 막는 것은 던전으로 내려가는 쪽뿐이다.
function campCanEnterDungeon(dg){ return ((dg | 0) <= 0) || campCombatCount() > 0; }

function campAdoptBaseUnits(){
  if(!CAMPB || typeof G === 'undefined' || !G.tech || typeof STK_UNITS === 'undefined') return 0;
  const ents = G.tech.ents, take = [];
  for(let i = ents.length - 1; i >= 0; i--){ const e = ents[i];
    if(e.type !== 'unit' || !STK_UNITS[e.uid]) continue;
    ents.splice(i, 1); take.push(e); }
  for(const e of take) campDeploy(e.uid, e.x, e.y);
  return take.length; }
// 🧳 전장을 닫을 때 **병력을 기지 엔티티로 되돌린다** (2026-08-29 · 페이블 점검에서 발견).
//   ⛔ 유닛이 한 번만 태어나는 구조에서 전장 유닛은 CAMPB 에만 있는 **유일본**이다.
//     그냥 CAMPB=null 로 버리면 패배·화면 이탈에서 병력이 통째로 증발하고,
//     campSave 는 G.tech.ents 만 직렬화하므로 **앱을 껐다 켜도 사라진다.**
//   ⭐ 자리(_post)를 격자 좌표로 역변환해 담는다 — 재입장 시 campAdoptBaseUnits 가
//     그 자리 그대로 데려오고, campDeploy 가 새로 세우므로 체력도 가득 찬다.
//     「패배하여 다시 시작할 때 부활 + 전체 회복」(사용자 규칙)이 이 경로로 이루어진다.
//   ⚠ 누운 병력(_down)도 담는다 — uid 만 있으면 되살릴 수 있다.
function campBattleClose(){
  if(CAMPB && typeof G !== 'undefined' && G.tech){
    const W = CAMPB.world || 4800, all = [];
    for(const u of CAMPB.me.units){ if(u && !u.dead) all.push(u); }
    for(const d of (CAMPB._down || [])){ if(d && d.u) all.push(d.u); }
    for(const u of all){
      const p = u._post || { x:u.x, y:u.y };
      const g = campW2G(p.x, p.y, W);
      G.tech.ents.push({ eid:G.tech.eseq++, type:'unit', uid:(u.gm || u.id), x:g.gx, y:g.gy });
    }
  }
  CAMPB = null; }

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
const CAMP_BLD_HP = 1200 / 10;     // 건물 한 채의 기본 체력
// 🏛 본부 — 엔진 기본(mapCfg('baseHp') = 7500 · 오토배틀 신전용)을 **같은 1/10 스케일**로 내린 값.
//   ⚠ 본부는 마지막 보루라 일반 건물의 6.25배다. campBattleOpen 에서 덮어쓴다.
const CAMP_BASE_HP = 7500 / 10;
// 🛡 **방어 건물** — 전선에 서야 뜻이 있는 건물들. 유닛과 같은 좌표계(campG2W)를 쓴다.
//   ⚠ 여기 넣는 순간 그 건물은 **격자 위쪽에 지으면 전장 맨 앞**에 선다 — 적이 먼저 만난다.
//   ⛔ 생산·연구 건물을 넣지 말 것. 앞에 나가면 곧바로 부서지고 기지가 멎는다.
const CAMP_DEF_BLD = { bunker:1, turret:1 };

// 💥 **적이 건물을 칠 때만 곱하는 배율** (2026-08-30 · sc-3 계산 · HUNT_R1 §6-2-5).
//   ⛔ 어긋난 것은 「적 공격」이 아니라 **건물 체력과 유닛 체력 사이의 스케일**이다.
//     유닛 체력이 4~47 인데 건물은 120 · 본부 750 — 유닛의 **150배**다. 그래서 유닛 전투는
//     멀쩡히 돌아가는데(라운드마다 아군 3~12기가 눕는다) 건물만 안 부서졌다.
//   ⛔ **CAMP_FOE_ATK0 을 올려서 고치지 말 것** — 그러면 유닛 전투가 통째로 무너진다.
//     체력 5 짜리 아군이 20~35배 센 공격에 즉사한다.
//   ⭐ 실측(D1R1 · 전멸 뒤 라운드가 끝나기까지):
//        ×1(전) 본부만 1829초 · +5채 3293초   →   ×40 본부만 46초 · +5채 82초 · +10채 119초
//     목표는 「전멸 뒤 60~120초」이고 ×40 이 건물 3~10채 구간을 68~119초로 덮는다.
//   ⚠ 후반은 빨라진다(본부+5채: R1 82초 · R10 45 · R25 16 · R50 3). **의도된 것이다** —
//     후반에 전멸했다면 이미 진 판이라 빨리 끝나는 편이 낫다.
//   ⚠ **방어 건물(포탑류)이 생기면 예외가 필요하다** — 40배로 맞으면 무용지물이 된다.
//     지금 캠프 건물은 전부 「맞기만 하는」 것이라 예외가 없다.
const CAMP_FOE_BLD_MUL = 40;
// 프레임 전 건물 체력을 떠 둔다 → strikeStepUnits 뒤에 깎인 만큼을 배율로 증폭한다.
//   ⭐ 이 방식인 이유: 적이 구조물에 넣는 피해는 18-strike.js 안에서 `front.hp -= …` 로
//     직접 빠져 가로챌 훅이 없다. ⛔ 18-strike.js 는 고치지 않는다(오토배틀 공유).
//   ⚠ 내 건물을 때리는 것은 적뿐이다(아군은 같은 편을 안 친다) — 그래서 감소분 = 적 피해다.
function campBldSnap(){
  if(!CAMPB || !CAMPB._bld) return null;
  const m = new Map();
  for(const b of CAMPB._bld) if(b && !b.dead) m.set(b, b.hp);
  return m; }
function campBldAmp(snap){
  if(!snap || CAMP_FOE_BLD_MUL === 1) return 0;
  let hit = 0;
  for(const [b, hp0] of snap){
    const d = hp0 - b.hp;                       // 이번 프레임에 깎인 양
    if(!(d > 0)) continue;
    hit += d;
    b.hp = hp0 - d * CAMP_FOE_BLD_MUL;
    if(b.hp <= 0){ b.hp = 0; b.dead = true; } }
  return hit; }
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
    // 🏛 본부는 **객체를 새로 만들지 않는다**(전장 판정이 me.base 를 본다) — 그래서 체력을 손으로 채운다.
    //   ⛔ 이게 없으면 「건물을 다시 올린다 = 체력이 가득 찬다」가 일반 건물에만 걸린다.
    if(isMain){ const b = CAMPB.me.base;
      b.x = sx(e.x); b.y = sy(e.y); b.eid = e.eid;
      b.hp = b.maxHp = b.max = hp; b.dead = false;
      out.push(b); continue; }
    // 🛡 **방어 건물은 전선에 선다** (2026-08-30 사용자 확정).
    //   ⛔ 일반 매핑(sy)은 격자 전체를 전장 **62~92%** 로 눌러 담는다. 그런데 전투는
    //     **50~60%** 에서 벌어진다 — 벙커를 어디에 지어도 전선 뒤였다(실측 828 떨어짐 ·
    //     화력병 사거리 70 → 벙커 체력이 120/120 그대로였다).
    //   ⭐ 그래서 방어 건물만 **유닛과 같은 좌표계**(campG2W)를 쓴다. 격자 위쪽에 지으면
    //     전장 앞(14%), 아래쪽이면 뒤(86%) — 플레이어가 방어선을 직접 고를 수 있다.
    //   ⚠ campG2W 는 campW2G 의 역이라 **화면과 어긋나지 않는다** — 전장 유닛을 그릴 때
    //     쓰는 역변환이 그대로 원래 격자 자리를 돌려준다.
    //   ⚠ 일반 건물은 그대로 둔다(전투에 거의 안 나오고, 매핑을 바꾸면 기지 그림이 흔들린다).
    const p = CAMP_DEF_BLD[e.bk] ? campG2W(e.x, e.y, W) : { x:sx(e.x), y:sy(e.y) };
    out.push({ x:p.x, y:p.y, hp:hp, max:hp, maxHp:hp, dead:false, eid:e.eid, bk:e.bk });
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

// ── 🖐 전장 병력 배치 (3단계 · 2026-08-28 사용자 확정) ─────────────────
// ⭐ **내가 지정해서 원하는 자리로 옮긴다.** 옮긴 자리가 곧 그 유닛의 자리(_post)다.
// ⛔ 원본(건설 탭)의 탭 로직을 고치지 않는다 — 원본은 **기지 엔티티만** 안다.
//   캠프가 up 에서 **먼저** 보고, 처리했으면 _btDown 을 비워 원본이 그 탭을 다시 안 쓰게 한다
//   (17-build-cards.js 가 쓰는 것과 같은 규약이다).
let _campSel = [];                 // 고른 전장 유닛 uid
let _campBox = null;               // 캠프의 드래그 박스(원본 _btBox 와 별개 — 전장 유닛용)
const CAMP_PICK_R = 0.022;         // 탭 히트 반경(격자 정규 좌표)
const CAMP_BOX_MIN = 0.015;        // 이만큼 끌어야 박스로 본다(원본과 같은 값)
function campSelList(){ if(!CAMPB) return [];
  const out = []; for(const u of CAMPB.me.units){ if(!u.dead && _campSel.indexOf(u.uid) >= 0) out.push(u); } return out; }
function campSelClear(){ if(!_campSel.length) return false; _campSel = []; return true; }
function campSelSet(units){ _campSel = (units || []).map(function(u){ return u.uid; });
  if(_campSel.length && typeof G !== 'undefined' && G.tech){ G.tech.selU = []; G.tech.sel = null; G.tech.selRes = null; }
  return _campSel.length; }
// 화면 좌표 → 격자 좌표(기지와 같은 규약)
function campScr2G(cx, cy){
  if(typeof _btRect !== 'function' || typeof _techS2W !== 'function') return null;
  const r = _btRect(); if(!r || !r.width || !r.height) return null;
  const sx = (cx - r.left) / r.width, sy = (cy - r.top) / r.height;
  if(sx < 0 || sx > 1 || sy < 0 || sy > 1) return null;
  if(sy < 0.13) return null;                       // 상단바 — techPtrDown 과 같은 규약
  return _techS2W(sx, sy); }
// 그 자리에 있는 **내** 전장 유닛 하나(가장 가까운 것)
function campBattleAt(cx, cy){
  if(!CAMPB || campDgN() <= 0) return null;
  const g = campScr2G(cx, cy); if(!g) return null;
  const W = CAMPB.world || 4800; let best = null, bd = CAMP_PICK_R * CAMP_PICK_R;
  for(const u of CAMPB.me.units){ if(u.dead) continue;
    const q = campW2G(u.x, u.y, W), dx = q.gx - g.x, dy = q.gy - g.y, d2 = dx * dx + dy * dy;
    if(d2 <= bd){ bd = d2; best = u; } }
  return best; }
// 박스 안의 내 전장 유닛 전부
function campBattleInBox(g0, g1){
  if(!CAMPB) return [];
  const W = CAMPB.world || 4800, out = [];
  const x0 = Math.min(g0.x, g1.x), x1 = Math.max(g0.x, g1.x);
  const y0 = Math.min(g0.y, g1.y), y1 = Math.max(g0.y, g1.y);
  for(const u of CAMPB.me.units){ if(u.dead) continue;
    const q = campW2G(u.x, u.y, W);
    if(q.gx >= x0 && q.gx <= x1 && q.gy >= y0 && q.gy <= y1) out.push(u); }
  return out; }
// 🪧 고른 유닛들의 **자리를 옮긴다** — 한 점에 포개지지 않게 대형으로 편다.
//   ⭐ 대형 슬롯은 기지 랠리가 쓰는 _ringSlotN 을 그대로 빌린다(새로 만들지 않는다).
function campMoveSel(gx, gy){
  const list = campSelList(); if(!list.length || !CAMPB) return 0;
  const W = CAMPB.world || 4800, c = campG2W(gx, gy, W);
  for(let i = 0; i < list.length; i++){ const u = list[i];
    const sp = (u.size || 14) * 2.2;
    const s = (typeof _ringSlotN === 'function') ? _ringSlotN(i, sp) : { dx:0, dy:0 };
    const px = Math.max(0, Math.min(W, c.x + s.dx)), py = Math.max(0, Math.min(W, c.y + s.dy));
    u._bunk = null; u._bhp = null;                // 🧱 다른 자리를 주면 벙커에서 내린다
    u._post = { x:px, y:py };
    u.tgtUid = null; u._btgt = null; u._btT = 0;   // 표적을 놓고 자리로 간다(복귀가 손댈 수 있게)
  }
  if(typeof playSfx === 'function') playSfx('ui_confirm');
  return list.length; }

// 🖐 up 에서 캠프가 **먼저** 판정한다. true 를 돌리면 원본은 이 탭을 쓰지 않는다.
//   ⚠ 순서가 중요하다 — 박스가 먼저다(끌었으면 탭이 아니다).
function campPtrUp(ev){
  if(!_campOn || !CAMPB || campDgN() <= 0 || !ev) return false;
  const box = _campBox; _campBox = null;
  // ① 박스로 끌었다 = 여러 기 지정
  if(box && box.on){
    const g0 = campScr2G(box.cx0, box.cy0), g1 = campScr2G(ev.clientX, ev.clientY);
    if(g0 && g1){ const hit = campBattleInBox(g0, g1);
      if(hit.length){ campSelSet(hit);
        if(typeof playSfx === 'function') playSfx('ui_tab');
        return true; } }                      // 잡힌 게 있으면 원본 박스(기지 유닛)는 쓰지 않는다
    return false; }
  // ② 탭 — 원본이 아직 지우기 전에 읽는다
  if(typeof _btDown === 'undefined' || !_btDown || _btMoved) return false;
  const u = campBattleAt(ev.clientX, ev.clientY);
  if(u){ campSelSet([u]); if(typeof playSfx === 'function') playSfx('ui_tab'); return true; }
  // ③ 고른 병력이 있고 **벙커**를 눌렀다 = 탑승 (2026-08-30)
  //    ⚠ 바닥 판정보다 **먼저** 본다 — 벙커는 빈 바닥이 아니라서 아래 ④로 새 버린다.
  if(_campSel.length){
    const bunk = campBunkerAtScr(ev.clientX, ev.clientY);
    if(bunk){
      const got = campBoard(campSelList(), bunk);
      if(typeof playSfx === 'function') playSfx(got ? 'ui_confirm' : 'ui_denied');
      if(typeof toast === 'function') toast(got ? ('🧱 벙커 탑승 ' + got + '기')
                                               : ('⛔ 벙커가 찼다 (정원 ' + CAMP_BUNK_CAP + ')'));
      return true; } }
  // ④ 고른 병력이 있고 빈 바닥을 눌렀다 = 그 자리로 이동
  if(_campSel.length && campEmptyAt(ev.clientX, ev.clientY)){
    const g = campScr2G(ev.clientX, ev.clientY);
    if(g){ campMoveSel(g.x, g.y); return true; } }
  // ⑤ 그 밖의 탭 = 지정 해제하고 원본에 넘긴다
  campSelClear();
  return false; }

// 격자(기지 정규 좌표) → 전장 좌표. **campW2G 의 역**이다.
//   ⚠ 두 식은 반드시 짝이어야 한다 — 한쪽만 고치면 유닛이 다른 자리에 선다.
//   ⚠ 레인 밖(본부·건물이 있는 아래쪽)은 레인 끝으로 자른다. 전장은 0.18~0.62 뿐이라
//     그보다 아래에서 뽑힌 유닛은 **레인 맨 아래(건물 바로 앞)** 에 선다.
function campG2W(gx, gy, W){
  const t = Math.max(0, Math.min(1, (gy - CAMP_LANE_TOP) / (CAMP_LANE_BOT - CAMP_LANE_TOP)));
  return { x: W * (0.5 + (gx - 0.5) / CAMP_LANE_W),
           y: W * (0.14 + t * 0.72) }; }

// ⭐ **유닛은 한 번만 태어난다** (2026-08-28 사용자 확정).
//   ⛔ 예전엔 두 번 태어났다 — 생산하면 기지(G.tech.ents)에 서고, campSortie 가 3초 뒤
//     그것을 **지우고 전장에 새로 만들었다**(스폰 지점에). 그래서 ①내가 둔 자리가 사라지고
//     ②나갈 때 인구가 반환되어 인구 200 이 생산을 못 막았다(대기 병력 68기).
//   지금은 생산이 끝나는 순간 **그 자리에 그대로** 전장 유닛이 된다.
// ⚠ 이 함수는 「자리」의 단일 소스이기도 하다 — u._post 를 여기서 처음 준다.
function campDeploy(id, gx, gy){
  if(!CAMPB || typeof strikeSpawnUnit !== 'function') return null;
  const W = CAMPB.world || 4800, p = campG2W(gx, gy, W);
  const u = campWithStk(function(){
    const b4 = CAMPB.me.units.length;
    strikeSpawnUnit('me', id);
    return (CAMPB.me.units.length > b4) ? CAMPB.me.units[CAMPB.me.units.length - 1] : null; });
  if(!u) return null;
  u.x = p.x; u.y = p.y;
  u.wait = 0; u.rallied = true;            // ⚠ 집결지로 걸어가지 않는다 — 여기가 이미 제자리다
  u._post = { x:p.x, y:p.y };              // 🪧 자리 — 내가 옮기면 갱신된다(2단계)
  campScaleAllies([u]);                    // ⚔ 설계 능력치 + 🌳 트리 배수 + 👀 인식 거리
  campLayerPost(u, W);                     // 🪜 사거리가 길수록 뒤에 세운다(아래) — 능력치 뒤라야 rng 을 안다
  return u; }

// 🪜 **사거리가 짧을수록 앞에 선다 — 한 줄로 촘촘히** (2026-09-01 사용자 확정).
//   ⛔ 교전 이동(campEngageStep)으로 층을 만들려다 **두 번 실패했다** — 앞줄이 멈추면
//     뒷줄이 갈 곳이 없어서 사거리 안에 드는 아군이 0~33% 로 떨어졌다.
//   ⭐ 원인은 **자리**였다. 사거리별로 **애초에 다른 줄에 서 있어야** 층이 유지된다.
//
//   ⛔ **옛 방식은 「제 자리에서 뒤로 민다」였다 — 층이 생기지 않았다**(2026-09-01 실측).
//     ① 기준이 생산 건물 자리라, 짧은 사거리 유닛이 뒤쪽 건물에서 나오면 **그대로 맨 뒤**에 남는다.
//        「사거리가 짧으면 앞」이라 해 놓고 앞으로 **당기지는 않았기** 때문이다.
//     ② R0=100 이라 화력병(70)·의무병(0)은 물론 레인저(147)조차 21px 밖에 안 밀렸다 —
//        층이라 부를 것이 없었다. 궤적 그림의 4층은 전부 **테스트 배치**가 만든 것이었다.
//   ⭐ 지금은 **기준선 하나에서 사거리 순으로 줄을 세운다**(절대 정렬). 그래야 어느 건물에서
//     나오든 짧은 사거리가 앞이다. 적은 **위에서** 내려오므로 앞뒤가 곧 교전 순서다.
//   ⚠ 세로는 촘촘하게, 가로는 넓게 — 여러 층이 **동시에** 때리려면 그 모양이어야 한다.
//     ⛔ 가로를 가운데로 모으는 campLanePost 를 만들었다가 없앴다(같은 날) — 실효가 안 올랐고
//       (0.29 → 0.29) 방향도 반대였다. 올린 것은 세로 간격 하나였다.
//   ⚠ **생산될 때의 기본 자리만** 손댄다. 플레이어가 직접 옮기면(campMoveSel) 그 자리가 이긴다.
const CAMP_LINE_GY  = 0.50;        // 부대 앞줄이 서는 격자 y — 여기서부터 사거리 순으로 뒤에 선다
const CAMP_LAYER_R1 = 420;         // 이 사거리면 최대로 민다 — 공성전차 421 은 여기
const CAMP_LAYER_MAX = 60;         // 가장 긴 유닛이 앞줄보다 이만큼 뒤에 선다(px) — 촘촘하게
function campLayerBack(u){
  const rng = (u && u.rng) || 0;   // ⚠ 0 부터 비례한다 — 의무병(0)·화력병(70)도 순서를 갖는다
  const t = Math.min(1, Math.max(0, rng) / CAMP_LAYER_R1);
  return t * CAMP_LAYER_MAX; }
function campLayerPost(u, W){
  if(!u || !u._post) return 0;
  const lim = W || (CAMPB && CAMPB.world) || 4800;
  const front = (typeof campG2W === 'function') ? campG2W(0.5, CAMP_LINE_GY, lim).y : u._post.y;
  const ny = Math.min(lim, front + campLayerBack(u)), d = ny - u._post.y;
  u._post.y = ny;
  u.y = ny;                                                // 갓 태어났으니 그 자리에 바로 선다
  return d; }
// 🚧 자리에서 나갈 수 있는 거리 — **유닛마다 다르게 주지 않는다**(모두 CAMP_ENG_OUT).
//   ⚠ **지금 값은 1200 이다**(선언과 근거는 아래 `const CAMP_ENG_OUT` 자리에 있다).
//     여기서 지키는 것은 값이 아니라 **「층에 따라 다르게 주지 않는다」는 규칙** 하나다.
//
//   ── 📜 500 시절의 기록 (2026-08-31 · 옛 campEngageStep 구조) ──────────────
//   ⛔ 그때 층에 따라 다르게 줘 봤다가 되돌렸다. `500 + (300 − 층)` 으로 계산해서
//     결과적으로 **모두 718~800 으로 늘어났고**, 500 이 최적이라던 그때 실측을 뒤집은 꼴이 됐다.
//     벤치 D1R18 → **D1R13**, 실효 0.87 → 0.50. 라운드가 R6 115초 · R12 110초로 늘어졌다.
//   ⚠ **이 문단의 숫자를 지금 값과 견주지 말 것** — 미는 주체가 셋이던 옛 구조의 값이다.
//     그 구조는 2026-08-31 에 `js/21-camp-battle.js` 로 대체됐고, 같은 이름의 상수가
//     500 → 1200 으로 다시 측정됐다(옛 기준선 R10·R8·R9·R8 을 되찾는 값).
//   ────────────────────────────────────────────────────────────────────
//
//   ⭐ 규칙이 남은 이유 — 자리 제한은 「너무 멀리 쫓아가지 마라」는 **안전장치**일 뿐이다.
//     어느 거리에서 쏠지는 campGoalFor 의 `want`(= 사거리 × 0.85)가 이미 정한다.
//     거기에 층까지 얹으면 두 장치가 같은 것을 두 번 정하게 된다.
//   ⭐ 「짧은 사거리 유닛이 앞으로 나가야 한다」는 **배치(campLayerPost)로 푼다** —
//     애초에 앞줄에 세우면 된다. 제한을 늘려 푸는 문제가 아니었다.
//   ⚠ 이 함수는 배선이 끊긴 campEngageStep 쪽 것이다(2026-08-31) — 되살릴 때 위를 먼저 읽을 것.
function campEngageOut(u){ return CAMP_ENG_OUT; }

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
        sel:(side === 'me' && _campSel.indexOf(u.uid) >= 0),   // 🔵 지정 표시 = 3D 하단 링(기지 유닛과 같은 규약)
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

// ⛔ **출격·전장 트림은 없앴다** (2026-08-28 사용자 확정).
//   유닛이 두 번 태어나던 구조를 걷어내면서 둘 다 필요가 없어졌다 —
//     · campSortie   기지에 선 유닛을 전장으로 옮기던 다리. 지금은 생산될 때 이미 전장에 선다.
//     · campTrimArmy 전장 병력을 인구 상한에서 잘라내던 것. 지금은 **생산에서** 막힌다
//                    (출격이 인구를 반환하지 않으므로 G.tech.sup 이 실제로 쌓인다).
//   ⭐ 둘 다 **원인이 아니라 증상을 막던 코드**였다. 원인이 사라져 함께 지운다.
//   ⛔ 오토배틀의 strikeSpawnForPlayer 는 그대로다 — 캠프가 안 부를 뿐이다.

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
// ⛔ **때릴 수 없는 적은 풀에서 뺀다.** 걸러야 할 것이 셋인데, 예전에는 ①만 걸렀다.
//   ① 공중 전용(SB_ATK_MODE='air') — 아군 지상군을 한 대도 못 때린다
//   ② **아예 공격을 안 하는 유닛**(FXLAB_NOATK — 메두사·감시자·수송기 따위)
//   ③ 캠프 설계표(CAMP_UNIT_STAT)에서 **공격을 안 주기로 한 유닛**(a 가 없다)
//   ⚠ ②③이 빠져 있어서 **60분 벤치가 D1R26 에서 51분을 멈췄다**(2026-08-30 실측):
//     남은 적이 **메두사 3기**였는데 셋 다 공격력 0 이라, 적은 아군을 안 때리고
//     아군은 제자리 방어라 안 올라가서 **아무도 움직이지 않았다**(거리 381 · 사거리 187).
//   ⭐ 라운드는 「적을 다 잡으면 끝」이므로, **아무도 안 움직이는 무리 = 영원히 안 끝나는 라운드**다.
function campFoePool(ids){
  const mode = (typeof SB_ATK_MODE !== 'undefined') ? SB_ATK_MODE : {};
  const noAtk = (typeof FXLAB_NOATK !== 'undefined') ? FXLAB_NOATK : null;
  return (ids || []).filter(function(id){
    if((mode[id] || 'both') === 'air') return false;              // ①
    if(noAtk && noAtk.has && noAtk.has(id)) return false;         // ②
    const d = CAMP_UNIT_STAT[id];
    if(d && d.a == null) return false;                            // ③
    return true;
  });
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
// ⚔ **싸울 수 있는 아군** — 살아 있고, 공격력이 있고, 때릴 수 있는 레이어가 하나라도 있는 것.
//   ⭐ **판정을 여기 한 곳에 모은다**(2026-08-31). 예전엔 campCanHitFoes 안에만 있었고
//     승패 판정은 `campAlive('me') > 0`(**모든** 살아있는 유닛)을 따로 썼다. 둘이 어긋나서
//     **전투 유닛이 다 눕고 의무병만 서 있으면 본부가 멀쩡한데도 즉시 탈락**했다
//     (재현: 본부 750/750 · 적 1 · 의무병 1 → 한 프레임 만에 던전 0 으로 탈락).
//     게다가 뜨는 말이 「✈ 공중을 칠 수 없어 탈락」이라 원인을 가리켰다.
//   ⚠ 공격을 못 하는 유닛은 세지 않는다 — 의무병은 사거리 0 · 공격력 0 이라 아무리 많아도 못 죽인다.
//     ⭐ _sbAtkMode 가 비전투(FXLAB_NOATK)를 {air:false,gnd:false} 로 돌려주므로 그것도 함께 걸린다.
//   ⛔ 누운 병력은 세지 않는다(2026-08-29) — 라운드 부활로 바뀐 뒤 **이번 라운드에는 못 일어난다.**
//     옛 주석의 「곧 일어나므로 센다」는 30초 부활 시절의 전제다.
function campArmedUnits(){
  if(!CAMPB || !CAMPB.me) return [];
  const atk = function(u){
    if(u._atk) return u._atk;
    return (typeof _sbAtkMode === 'function') ? _sbAtkMode({ id:u.id, gmodel:u.gm }) : { air:true, gnd:true }; };
  return CAMPB.me.units.filter(function(u){
    if(u.dead || (u.dmg || 0) <= 0) return false;
    const a = atk(u); return !!(a.air || a.gnd); }); }

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
  const mine = campArmedUnits();
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
// ⛔ **한 무리가 이보다 적어지면 쪼개지 않는다**(2026-08-30). 안 그러면 초반이 깜빡인다:
//   R1 은 적이 3마리인데 옛 식(w = min(6, n))이 **3무리로 1마리씩** 쪼갰고, 거기에
//   「다 잡으면 즉시 다음 무리」가 겹쳐 **적 1 → 0 → 1 → 0** 이 반복됐다(배지가 깜빡였다).
//   ⭐ 후반은 그대로다 — R25(30마리)부터는 어차피 상한 6무리에 걸린다.
const CAMP_WAVE_MIN_N = 4;      // 한 무리 최소 마리 수
// ⚠ 옛 규칙은 「간격은 짧게」였다 — 길게 잡으면 화면의 적을 다 잡아도 다음 무리를 기다리느라
//   라운드가 안 끝나고, 그 대기가 곧 라운드 길이가 되어 「적 총 체력 ÷ 아군 DPS」 규칙이
//   깨졌다(실측: 난이도가 11배 올라도 18초 고정 = 전부 대기 시간).
// ⭐ **그 위험을 campCombatStep 에서 없앴다**(2026-08-30) — 화면의 적을 다 잡으면 간격을
//   무시하고 다음 무리를 곧바로 낸다. 그래서 이제 간격을 「연출」로 길게 잡아도 안전하다.
//   ⛔ 그 한 줄을 지우면 아래 값이 곧바로 라운드 길이가 된다. 같이 봐야 하는 짝이다.
const CAMP_WAVE_GAP_S = 1.5;    // 웨이브 사이 간격(초) — 6무리가 7.5초에 걸쳐 밀려온다
// 🚪 **적은 화면 위 밖에서 태어나 걸어 내려온다** (2026-08-30 사용자 확정)
//   ⛔ 옛 자리는 오토배틀의 스폰 패드 둘(strikeSpawnPads)이었다 — 적 본진 좌우 두 점이다.
//     실측: 패드 ② 가 y 19.9~30.7% 라 **화면(28.2~83.8%)과 겹쳐** 적이 눈앞에서 튀어나왔다.
//     게다가 두 점에서만 나와 「몰려온다」가 아니라 「두 덩이가 생긴다」로 보였다.
//   ⭐ 그래서 스폰 **직후에 좌표만 다시 잡는다.** `strikeSpawnUnit`(18-strike.js)은 공유 파일이라
//     건드리지 않는다 — `campScaleFoes` 가 체력을 후처리하는 것과 같은 수법이다.
//   ⚠ 화면까지 걸어오는 만큼 **라운드가 조금 길어진다.** 웨이브 간격 때와 달리 「대기」가 아니라
//     「이동」이라 화면이 죽지는 않지만, 벤치 값을 이 커밋 전후로 섞지 말 것.
const CAMP_FOE_SPAWN_Y = 0.18;   // 스폰 줄(세로 비율) — 화면 상단보다 확실히 위
const CAMP_FOE_SPAWN_J = 0.05;   // 그 줄에서 위아래로 흩는 폭 — 한 줄로 딱 서면 기계 같다
const CAMP_FOE_SPAWN_W = 0.62;   // 가로로 퍼뜨리는 폭(가운데 통로만큼)
// ⚠ **후반(R30+)에는 다시 재야 한다**(sc-2 지적 2026-08-30). 지금 확인은 R15(적 11마리)까지다.
//   R40 이후엔 100마리가 한 줄로 내려와 **행렬**이 되므로, 앞줄이 닿고 뒷줄이 뒤따르는 사이
//   「다 잡을 때까지」가 길어질 소지가 있다. 라운드 길이가 늘면 이 세 값부터 의심할 것.
function campPlaceFoes(list){
  if(!CAMPB || !list || !list.length) return 0;
  const W = CAMPB.world;
  for(const u of list){
    u.x = W * (0.5 + (Math.random() - 0.5) * CAMP_FOE_SPAWN_W);
    u.y = W * (CAMP_FOE_SPAWN_Y + (Math.random() - 0.5) * CAMP_FOE_SPAWN_J);
    u._sx = u.x; u._sy = u.y;                      // 보간 잔상 제거(안 하면 옛 자리에서 미끄러진다)
  }
  return list.length; }
function campSpawnFoes(){ if(!CAMPB || typeof strikeSpawnUnit !== 'function') return 0;
  const n = campFoeCount(campRoundN());
  const w = Math.max(1, Math.min(CAMP_WAVE_MAX, Math.ceil(n / CAMP_WAVE_MIN_N)));
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
    const fresh = CAMPB.ai.units.slice(b4);
    campPlaceFoes(fresh);                          // 🚪 화면 위 밖에 한 줄로 세운다(아래)
    campScaleFoes(fresh, share);
    return CAMPB.ai.units.length - b4; }) | 0; }
// 아직 안 나온 적이 남았나 — ⚠ 승리 판정이 이걸 봐야 한다(안 보면 첫 웨이브만 잡고 라운드가 넘어간다)
function campFoesPending(){ return !!(CAMPB && CAMPB._wq && CAMPB._wq.length); }

// 👀 **발견 전파** — 적을 본 아군 주변에게만 「넓게 봐라」를 옮긴다.
//   ⚠ 매 프레임 돌면 아군×적 만큼 비싸다(56×100). CAMP_ALERT_TICK 주기로만 돈다.
//   ⚠ 남은 시간은 매 프레임 깎는다 — 주기로만 깎으면 지속이 들쭉날쭉해진다.
function campAlertTick(dt){
  if(!CAMPB || !CAMPB.me) return 0;
  const mine = CAMPB.me.units, foes = CAMPB.ai.units;
  for(const u of mine){
    if(u._alertT > 0){ u._alertT = Math.max(0, u._alertT - dt); if(u._alertT === 0) u._alertAcq = 0; }
    if(u._hitT   > 0){ u._hitT   = Math.max(0, u._hitT   - dt); if(u._hitT   === 0) u._hitAcq   = 0; } }
  CAMPB._alT = (CAMPB._alT || 0) - dt;
  if(CAMPB._alT > 0){ campAlertApply(); return 0; }
  CAMPB._alT = CAMP_ALERT_TICK;
  // ① 시드 = **지금 적을 보고 있는 아군**(제 눈 안에 적이 있다). 눈은 유닛마다 다르다.
  //    ⚠ 여기서 쓰는 눈은 campAlertApply 가 이미 얹어 둔 값이다 — 맞아서 넓어진 것도,
  //      지난 틱에 전파받은 것도 포함된다. 그래서 **연쇄**가 일어난다.
  //    ⭐ 시드는 **자기가 본 적의 자리**를 함께 들고 온다 — 곁에 넘겨줄 것이 「눈의 크기」가
  //      아니라 **「저기 적이 있다」** 이기 때문이다. 받는 쪽은 제 자리에서 그 적까지의
  //      거리를 스스로 재서 눈을 넓힌다(멀리 있을수록 더 크게 뜬다).
  const spot = [];
  for(const u of mine){ if(u.dead) continue;
    const a = Math.max(u.acq || 0, campAcqBase(u)), A2 = a * a;
    let bx = 0, by = 0, bd = Infinity;
    for(const e of foes){ if(e.dead) continue;
      const dx = e.x - u.x, dy = e.y - u.y, d2 = dx * dx + dy * dy;
      if(d2 <= A2 && d2 < bd){ bd = d2; bx = e.x; by = e.y; } }
    if(bd < Infinity) spot.push({ u:u, x:bx, y:by }); }
  // ② 시드 곁(150)의 아군에게 **그 눈을 그대로** 넘긴다.
  //    ⭐ 넘겨받은 아군은 다음 틱의 시드가 되어 또 곁으로 넘긴다 — 줄줄이 번진다.
  //    ⛔ 반경을 다시 넓히지 말 것(옛 900) — 한 명이 보면 판 전체가 몰렸다.
  if(spot.length){ const R2 = CAMP_ALERT_R * CAMP_ALERT_R;
    for(const u of mine){ if(u.dead) continue;
      for(const sp of spot){ if(sp.u === u) continue;
        const dx = sp.u.x - u.x, dy = sp.u.y - u.y;
        if(dx * dx + dy * dy > R2) continue;
        // 내 자리에서 **그 적까지** 닿는 눈을 뜬다(여유 PAD 만큼 더)
        const need = Math.hypot(sp.x - u.x, sp.y - u.y) + CAMP_ACQ_PAD;
        u._alertT = CAMP_ALERT_S;
        if(need > (u._alertAcq || 0)) u._alertAcq = need; } } }
  campAlertApply();
  return spot.length;
}
// 세 겹을 겹쳐 실제 인식 거리를 정한다 — 셋 중 **가장 넓은 것**이 이긴다.
//   ① 기본 = 제 사거리 + PAD   ② 맞아서 넓어진 것   ③ 곁에서 전파받은 것
//   ⚠ 지속이 끝나면 각각 스스로 꺼지고, 남는 것은 ① 뿐이다(자기 자리로 돌아간다).
function campAlertApply(){
  if(!CAMPB || !CAMPB.me) return;
  for(const u of CAMPB.me.units){ if(u.dead) continue;
    let a = campAcqBase(u);
    if(u._hitT > 0 && (u._hitAcq || 0) > a) a = u._hitAcq;
    if(u._alertT > 0 && (u._alertAcq || 0) > a) a = u._alertAcq;
    u.acq = a; }
}

// ── 🪧 자리(post) — 내가 준 자리를 지킨다 (2026-08-28 사용자 확정) ─────
// ⭐ 자리는 **내가 옮길 때마다 바뀐다**. 태어난 자리는 첫 값일 뿐이다(campDeploy).
// ⭐ **싸우는 중이면 건드리지 않는다** — 표적이 있으면 그대로 두고, 표적이 없을 때만 돌아온다.
//   그래서 **돌아오다가도 근처에서 싸움이 나면 그대로 합류한다**(발견 전파가 인식 거리를 넓히면
//   strikeStepUnits 가 표적을 잡아 주고, 표적이 잡힌 유닛은 이 함수가 손대지 않는다).
// ⚠ **왜 되돌렸다가 다시 미는가** — strikeStepUnits 는 표적 없는 유닛을 집결지로 보낸다.
//   그 이동을 그대로 두고 위치만 덮어쓰면 **겹침 회피를 안 탄다**(유닛이 포개진다).
//   그래서 프레임 시작 위치로 되돌린 뒤 **strikeMoveToward 로 다시 민다** — 그 함수가
//   stepUnitMove(주변 회피·신전 회피)를 타므로 복귀도 전진과 똑같은 이동 규칙을 쓴다.
/* ⛔⛔ 아래 넷은 **더 이상 배선돼 있지 않다** (2026-08-31 · `js/21-camp-battle.js` 로 옮겼다).
 *   campPostSnap · campPostStep · campEngageStep · campLeash — 셋이 오토배틀 이동과
 *   매 프레임 싸워 유닛이 덜덜 떨던 구조다(방향 뒤집힘 96회/유닛 · 순수 오토배틀 0.9회).
 *   지금은 표적 선정·자리·이동·사격이 campStepUnits 한 곳에 있고 아무도 위치를 덮어쓰지 않는다.
 *   ⚠ **되살리지 말 것.** 되살리면 미는 주체가 다시 둘이 된다 —
 *     스모크 「캠프: 미는 주체가 하나다」가 campCombatStep 소스를 훑어 막는다.
 *   ⚠ 지우지 않고 남겨 둔 것은 유보 규칙 때문이다(CLAUDE.md 🗄 다락). 옛 값·주석에 실측 근거가 있다. */
function campPostSnap(){
  if(!CAMPB || !CAMPB.me) return;
  for(const u of CAMPB.me.units){ if(u.dead) continue; u._sx = u.x; u._sy = u.y; } }
// 🏠 **자리 복귀 — 「한 번만 명령한다」** (2026-08-31 사용자 확정).
//   ⛔ 예전에는 **매 프레임** 복귀를 다시 밀었다. 그러면 오토배틀 이동과 매 순간 싸운다:
//     ① strikeStepUnits 가 적 쪽으로 한 걸음 옮긴다
//     ② 캠프가 그걸 되돌린다(u.x = u._sx)
//     ③ 캠프가 자기 목표로 다시 민다
//     운전대를 둘이 잡고 반대로 돌리는 꼴이라 **덜덜 떨린다.**
//   ⭐ 실측(2026-08-31 · 마린 10기 30초): 방향 뒤집힘이
//     **순수 오토배틀 0.9회/유닛** vs **캠프 덧씌우기 29.9회** — **33배**다.
//     떨림은 오토배틀 탓이 아니라 전적으로 이 덧씌우기 탓이었다.
//   ⭐ 그래서 규칙을 바꾼다(사용자 설계):
//     · 전투 중에는 **손을 뗀다** — 오토배틀이 알아서 다가가 싸운다.
//     · 적과의 전투가 **CAMP_RETURN_DELAY 초** 동안 없으면 그때 복귀를 건다.
//     · 복귀는 매 프레임 걸되 **목표가 _post 로 고정**이라 흔들리지 않는다.
//   ⚠ 오토배틀은 `u.rallied=false` 인 동안에도 **사거리 안에 적이 있으면 그대로 교전한다**
//     (18-strike.js:1336~ `_eng` 분기) — 되돌아가다 적을 만나면 자연스럽게 싸운다.
//     다만 집결지는 strikeRallyPoint(side) 가 정하고 **side 만 받아 유닛별 값을 못 준다.**
//     그래서 자리까지의 이동은 캠프가 밀되 **한 번만** 민다.
const CAMP_RETURN_DELAY = 0.8;     // 전투가 이만큼 없으면 자리로 돌아간다
function campPostStep(dt){
  if(!CAMPB || !CAMPB.me || typeof strikeMoveToward !== 'function') return 0;
  const R2 = CAMP_POST_R * CAMP_POST_R; let n = 0;
  campWithStk(function(){
    for(const u of CAMPB.me.units){ if(u.dead) continue;
      if(campInBunker(u)) continue;               // 🧱 벙커에 탄 유닛은 campBunkerStep 이 붙든다
      if(!u._post) u._post = { x:u.x, y:u.y };     // 자리가 없으면 지금 자리를 자리로 삼는다
      // ⚔ 싸우는 중이면 복귀보다 전투가 먼저다.
      // ⛔ **표적 번호가 있다는 것만으로 판단하지 말 것.** 적이 죽어도 u.tgtUid 는 그대로 남는다 —
      //   그러면 「싸우는 중」으로 오해해 **영영 자리로 안 돌아온다**(브라우저 실측 2026-08-28).
      if(u.tgtUid && strikeFindUnit(CAMPB.ai.units, u.tgtUid)){
        u._idleT = 0; u._homeT = 0; continue; }    // 전투 중 — 시계를 되감고 손을 뗀다
      // ⏳ 전투가 없어진 지 얼마나 됐나 — 바로 돌아가지 않는다(적이 곧 다시 붙을 수 있다)
      u._idleT = (u._idleT || 0) + dt;
      if(u._idleT < CAMP_RETURN_DELAY) continue;
      const p = u._post, dx = p.x - u.x, dy = p.y - u.y;
      if(dx * dx + dy * dy <= R2){ u.moving = false; u._homeT = 0; continue; }   // 이미 자리
      // ⛔ **몰아서 밀지 않는다** (2026-08-31). 처음엔 0.5초치를 한 프레임에 밀었다가
      //   유닛이 **308px 씩 순간이동**했다(실측 37회). 복귀 목표는 _post 로 고정이라
      //   간격을 둘 이유도 없다 — 매 프레임 dt 만큼 정상 속도로 걸어온다.
      // ⭐ **복귀는 빠르게**(2026-08-30 사용자 확정) — 싸우러 나갔다 오는 길이라 굼뜨면
      //   다음 무리가 올 때까지 자리를 못 잡는다. 속도 상수를 건드리지 않고 dt 를 키운다.
      //   ⚠ 배수는 1.8 이라 한 프레임 이동이 0.09초치 — 순간이동으로 보이지 않는다.
      strikeMoveToward(u, p.x, p.y, dt * CAMP_RETURN_K); n++; }
    if(n && typeof strikeSeparate === 'function') strikeSeparate();  // 겹친 것을 밀어낸다(공용 함수)
  });
  return n; }

// 🧱 **벙커 — 화력병을 살리는 자리** (2026-08-30 사용자 확정).
//   ⚠ 왜 필요한가: 화력병 사거리는 70 인데 적(스웜 T1)은 34~47 이다. **적 사거리 안까지
//     들어가야만 때릴 수 있는 유닛**이라, 마린(187)처럼 안전한 거리에서 쏘지 못한다.
//     실측(2026-08-30): 의무병을 8기까지 늘려도 마린은 2/8 → 7/8 로 살아나는데
//     **화력병은 5/8 에서 꿈쩍도 안 했다.** 치유가 그 집중포화를 못 따라간다.
//   ⭐ 벙커는 **건설 시스템에 이미 있다**(TECH_TREE union · 100 미네랄 · 병영 필요 · 바이오닉 4기).
//     ⛔ 그런데 캠프 전장에는 반영이 없어서, 넣으면 그 유닛이 **전투에서 그냥 빠졌다.**
//   ⭐ 그래서 여기서 잇는다 — 탄 유닛은 **벙커 자리에서 쏘고, 피해는 벙커가 대신 맞는다.**
//   ⚠ 벙커를 그 유닛의 **자리(_post)** 로 삼는다. 라운드마다 죽고 부활해도 손으로 다시
//     태울 필요가 없다 — 부활이 _post 로 되돌리므로 저절로 벙커로 돌아간다(사용자 결정).
//   ⚠ 전장을 닫았다 다시 열면 탑승은 풀린다(유닛 객체가 새로 만들어진다). 자리는 벙커 앞이라
//     그 자리에 서긴 한다. 그때까지 이어 붙이는 것은 다음 일이다.
const CAMP_BUNK_CAP = 4;          // 벙커 한 채의 정원 — 건설 시스템(_techBunkerable)과 같은 값
const CAMP_BUNK_SLOT = 26;        // 벙커 안에서 서로 벌리는 간격(px) — 3D 로 겹쳐 보이지 않을 만큼
// 🎯 **벙커 사거리 보너스 = +2칸** (2026-08-30 사용자 확정 · 스타크래프트 벙커와 같은 발상).
//   ⚠ 왜 필요한가: 벙커는 한 번 지으면 못 움직이는데 전선은 판마다 다른 자리에 생긴다.
//     실측(2026-08-30 · 벤치 25분 한 쌍): 태우면 라운드가 **2~3배 느려졌다**(R2 79.7초 vs 26.3초).
//     벙커 체력은 94/120 — **거의 안 맞았다.** 탄 병력이 적을 못 만나고 그냥 논 것이다.
//   ⭐ 보너스는 그 어긋남을 메운다 — 벙커가 전선보다 조금 뒤여도 안에서 쏠 수 있다.
//   ⚠ 값은 설계표와 같은 **칸 단위**로 준다(CAMP_UNIT_STAT.r 이 칸이다).
//   ⛔ const 로 두지 말 것 — CAMP_STAT_TILE 이 이 줄보다 **아래**에 선언돼 있어서
//     평가 시점에 ReferenceError(TDZ)가 난다. 함수로 미루면 호출 때는 이미 있다.
const CAMP_BUNK_TILES = 2;                  // +2칸
function campBunkRng(){ return CAMP_BUNK_TILES * CAMP_STAT_TILE; }   // ≈ 94px
function campBldFind(eid){
  if(!CAMPB || !CAMPB._bld || eid == null) return null;
  for(const b of CAMPB._bld) if(b && b.eid === eid) return b;
  return null; }
// 지금 그 벙커에 탄 아군 수
function campBunkCrew(eid){
  if(!CAMPB) return 0; let n = 0;
  for(const u of CAMPB.me.units) if(!u.dead && u._bunk === eid) n++;
  return n; }
// 화면 좌표에 벙커가 있나 — 기지 격자에서 찾는다(건물은 격자에 놓이므로)
function campBunkerAtScr(cx, cy){
  if(!CAMPB || typeof G === 'undefined' || !G.tech) return null;
  const g = campScr2G(cx, cy); if(!g) return null;
  const cw = (typeof _techCW === 'function') ? _techCW() : 0.05;
  const ch = (typeof _techCH === 'function') ? _techCH() : 0.05;
  for(const e of (G.tech.ents || [])){
    if(!e || e.type !== 'bldg' || e.bk !== 'bunker' || (e.bt || 0) > 0) continue;
    const w = (e.w || 2) * cw, h = (e.h || 2) * ch;      // 건물이 차지하는 격자 크기
    if(Math.abs(g.x - e.x) <= w * 0.7 && Math.abs(g.y - e.y) <= h * 0.7){
      const b = campBldFind(e.eid); if(b && !b.dead) return b; } }
  return null; }
// 태운다 — 정원을 넘기면 넘긴 만큼은 그대로 둔다
function campBoard(list, b){
  if(!b || b.dead || !list || !list.length) return 0;
  let n = campBunkCrew(b.eid), got = 0;
  for(const u of list){
    if(u.dead || u._bunk === b.eid) continue;
    if(n >= CAMP_BUNK_CAP) break;
    u._bunk = b.eid; u._bslot = n; u._bhp = u.hp;
    u._post = { x:b.x, y:b.y };                 // 🪧 벙커가 이 유닛의 자리가 된다
    u.tgtUid = null; u._btgt = null; u._btT = 0;
    n++; got++; }
  return got; }
// 지금 **실제로** 벙커 안에 있나 — 벙커가 살아 있어야 탄 것이다.
//   ⭐ 탑승 기록(_bunk)은 벙커가 무너져도 **지우지 않는다.** 라운드가 새로 시작하면
//     campBuildStructs 가 건물 체력을 채우므로, 그때 **저절로 다시 탄다**(사용자 요구:
//     한 번 태우면 매 라운드 손으로 다시 태우지 않는다).
//   ⚠ 벙커가 무너져 있는 동안에는 null 을 준다 → 그 유닛은 평소처럼 싸우고 자리로 돌아간다.
function campInBunker(u){
  if(!u || u._bunk == null) return null;
  const b = campBldFind(u._bunk);
  return (b && !b.dead && (b.hp || 0) > 0) ? b : null; }
// 벙커 안 유닛을 붙들어 둔다 — 자리 고정 · 피해는 벙커가 대신 맞는다
//   ⚠ **campBldAmp 뒤에** 불러야 한다. 앞에서 부르면 유닛이 대신 넘긴 피해까지
//     건물 배수(×40)를 먹어 벙커가 한순간에 무너진다.
function campBunkerStep(dt){
  if(!CAMPB || !CAMPB.me) return 0;
  let n = 0;
  for(const u of CAMPB.me.units){
    if(u.dead) continue;
    const b = campInBunker(u);
    // 🎯 사거리 보너스 — **탄 상태에 맞춰 매 프레임 맞춘다.**
    //   ⭐ 이렇게 두면 탑승·하차·무너짐·복구가 전부 저절로 맞는다(각 지점에서 따로 안 만진다).
    //   ⚠ 원래 사거리는 _rng0 에 보관한다. 그것이 있으면 「지금 보너스가 걸려 있다」는 뜻이다.
    if(b && u._rng0 == null){
      u._rng0 = u.rng; u.rng = u._rng0 + campBunkRng();
      if(typeof strikeAcq === 'function') u.acq = Math.max(u.acq || 0, strikeAcq(u.rng)); }
    else if(!b && u._rng0 != null){
      u.rng = u._rng0; u._rng0 = null;
      u.acq = campAcqBase(u); }
    if(u._bunk == null) continue;
    if(!b){ u._bhp = null; continue; }          // 🧱 무너져 있는 동안은 밖에서 싸운다(기록은 남긴다)
    const s = (typeof _ringSlotN === 'function') ? _ringSlotN(u._bslot | 0, CAMP_BUNK_SLOT) : { dx:0, dy:0 };
    u.x = b.x + s.dx; u.y = b.y + s.dy; u.moving = false;
    if(u._bhp != null && u.hp < u._bhp){        // 이번 프레임에 맞은 만큼을 벙커로 넘긴다
      const d = u._bhp - u.hp; u.hp = u._bhp;
      b.hp -= d; if(b.hp <= 0){ b.hp = 0; b.dead = true; } }
    u._bhp = u.hp;                              // 치유로 오른 것은 그대로 받는다
    n++; }
  return n; }

// ⚔ **싸울 때는 빈자리를 찾아 파고든다** (2026-08-30 사용자 확정).
//   ⛔ 예전에는 표적이 있으면 **아무것도 안 하고 strike 의 기본 이동에 맡겼다**(위 campPostStep 의
//     `continue`). 그러면 앞줄만 적에게 닿고 뒷줄은 겹침 회피에 밀려 **뒤로만 밀린다.**
//   ⚠ 실측(2026-08-30 · 아군 22기 · D1R15): 30초 시점에 공격 가능 13기 중 **사거리 안이 2기**였다.
//     적까지 거리가 96·101·103·113 · 169 · **207·213·214·215·215·215·218** · 339 로,
//     뒤쪽 6기가 사거리(마린 187) 밖에 뭉쳐 있었다. 실효 계수 0.15 의 정체가 이것이다.
//   ⭐ 그래서 **자리를 나눠 준다.** 유닛 종류에 따라 두 방식을 갈라 쓴다(사용자 결정):
//     ㉠ **근접**(melee) = 표적을 **둘러싸는 링** — 사방에서 붙어야 여럿이 동시에 때린다
//     ㉡ **원거리**      = 자기 사거리 끝의 **부채꼴** — 뒤로 물러설 필요 없이 옆으로 벌려 선다
//   ⚠ 슬롯은 **표적별로** 나눈다. 같은 적을 때리는 아군끼리만 자리를 다투기 때문이다.
//   ⚠ 순서는 uid 로 고정한다 — 매 프레임 뒤바뀌면 자리가 흔들려 제자리걸음을 한다.
const CAMP_ENG_MELEE = 0.90;      // 근접이 서는 거리 = 자기 사거리 × 이 값
// ⛔ **사거리 끝에 서지 않는다** (2026-08-31 사용자 지적 · 옛 0.85).
//   ⚠ 증상: 「멈췄다 갔다 한다. 적이 몰려오면 도망 다니는 것처럼 보인다.」
//   ⭐ 원인: 목표를 사거리 끝(×0.85)에 두면, 적 사거리가 아군보다 짧아(campFoeRngCap)
//     계속 붙으러 오는데 아군은 그 거리를 **지키려고 뒤로 밀려난다.** 매 프레임 방향이 뒤집힌다.
//     실측(마린 10기 · 30초): 방향 뒤집힘 **유닛당 33.9회** · 표적 바뀜은 2.1회뿐 —
//     표적이 흔들려서가 아니라 **거리 유지 때문**이라는 뜻이다.
//   ⛔ 「뒤로는 안 간다」(want = min(지금거리, 사거리×K))로 풀려다 **두 번 실패했다** —
//     앞줄이 멈추면 뒷줄이 막혀 사거리 안에 든 아군이 33% 로 떨어졌다.
//   ⛔ 「목표를 안쪽으로 당긴다」(0.85 → 0.60)도 **틀렸다.** 목표가 안쪽이면 적이 그보다
//     조금만 다가와도 물러나므로 **더 자주** 뒤집힌다 — 실측 40.5회(0.85 는 33.9).
//   ⭐ 진짜 원인은 **미세 조정의 반복**이다. 목표에 거의 도착해도 매 프레임 다시 미니
//     제자리에서 떨리는 것이다. → 도착 판정(CAMP_ENG_OK)을 넓혀서 푼다. 아래 참고.
const CAMP_ENG_RANGED = 0.85;     // 원거리가 서는 거리 = 자기 사거리 × 이 값
const CAMP_ENG_GAP = 38;          // 옆 유닛과 벌리는 간격(px) — 이만큼이면 겹침 회피가 안 밀어낸다
const CAMP_ENG_ARC = Math.PI * 0.75;   // 원거리 부채꼴의 최대 폭(라디안)
// ⭐ **도착 판정 — 「멈췄다 갔다」의 실제 해법** (2026-08-31 사용자 지적).
//   ⛔ 24 는 너무 좁았다. 목표에 거의 도착해도 매 프레임 다시 밀어서 **제자리에서 떨렸고**,
//     적이 조금 다가올 때마다 목표가 따라 움직여 왔다 갔다 했다.
//   ⚠ 앞서 두 가지를 시도했다가 둘 다 틀렸다:
//     · 「뒤로는 안 간다」 → 앞줄이 멈춰 뒷줄이 막혔다(사거리 안 33%)
//     · 「목표를 안쪽으로 당긴다」(0.60) → 적이 조금만 와도 물러나 **더** 뒤집혔다(40.5회)
//   ⭐ 넓히면 그 안에서는 아예 안 움직인다 — 적이 다가와도 사거리 안이면 가만히 쏜다.
const CAMP_ENG_OK = 90;
// ⏱ **파고들기를 거는 간격(초)** — 매 프레임이 아니다.
//   ⭐ 매 프레임이면 오토배틀 이동과 싸워 떨리고, 아예 끄면 앞줄만 닿아 화력이 반토막 난다.
//     그 사이를 이 값이 정한다: 작을수록 캠프가 자주 끼어들고, 클수록 오토배틀에 맡긴다.
const CAMP_ENG_TICK = 0.4;
// 🚧 **자리에서 나갈 수 있는 최대 거리**(px). 이 값이 「전선이 얼마나 움직이나」를 정한다.
//   ⭐ 작을수록 제자리 방어에 가깝고(고정 방어가 뜻을 갖는다), 클수록 적을 따라 들어간다.
//   ⚠ 목줄(CAMP_LEASH 1300)과 다른 것이다 — 목줄은 「끌려간 뒤 잘라내는」 안전장치이고
//     이건 애초에 **그만큼만 나가게 하는** 규칙이다.
// ⭐ **미는 주체가 하나가 된 뒤 다시 잰 값**(2026-08-31 · 500 → 1200).
//   ⛔ 옛 「500 이 최적」은 **그 제한이 실제로는 안 지켜지던** 판에서 나온 값이다 —
//     오토배틀(strikeStepUnits)의 **무제한 추격**이 매 프레임 먼저 돌았고, campEngageStep 이
//     그것을 무르지 않고 넘긴 유닛(목표에 이미 도착한 유닛)은 그대로 계속 나갔다.
//     그러니 화면에서는 500 을 훌쩍 넘어 싸우고 있었고, 「500」은 이름뿐이었다.
//   ⭐ 이제는 목표를 정할 때 한 번 자르고 아무도 덮어쓰지 않으므로 **글자 그대로 지켜진다.**
//     그래서 같은 500 을 두면 병력이 자리에 묶여 화력이 반토막 났다(벤치 D1R10 → D1R5).
//   📊 30분 벤치 실측 (던전 1 · 같은 조건):
//        500 → D1R5 · 800 → D1R7 · **1200 → R13·R9·R8** · 1800 → D1R7
//      옛 구조의 기준선은 R10·R8·R9·R8(4판) 이다 — 1200 이 그 자리를 되찾는 값이다.
//      ⚠ 1800 에서 도로 떨어진다 — 너무 나가면 흩어져 서로 지원 사격이 안 된다.
//   ⛔ **한 판으로 고르지 말 것.** 같은 1200 에서 R8~R13 이 나온다. 처음에 기준선을 한 판만
//     (R10) 재고 「1200 이 더 좋다」고 읽었다가, 네 판을 재니 기준선도 R8~R10 이었다.
//     화력은 기준선과 **같고**, 달라진 것은 떨림(96.4 → 6.5회/유닛)이다.
//   ⚠ 이 값은 **방어 건물의 뜻과 맞바꾼 것이다** — 전선이 넓게 움직일수록 벙커·포탑이
//     서 있는 자리의 의미가 옅어진다. 줄이려면 화력 손실을 다른 축에서 메워야 한다.
const CAMP_ENG_OUT = 1200;
function campEngageStep(dt){
  if(!CAMPB || !CAMPB.me || typeof strikeMoveToward !== 'function') return 0;
  if(typeof strikeFindUnit !== 'function') return 0;
  // ① 표적별로 붙은 아군을 모은다
  const byTgt = new Map();
  for(const u of CAMPB.me.units){
    if(u.dead || !u.tgtUid) continue;
    if(campInBunker(u)) continue;              // 🧱 벙커에 탄 유닛은 나가지 않는다(무너졌으면 나간다)
    if(!byTgt.has(u.tgtUid)) byTgt.set(u.tgtUid, []);
    byTgt.get(u.tgtUid).push(u); }
  if(!byTgt.size) return 0;
  let n = 0;
  campWithStk(function(){
    for(const pair of byTgt){
      const list = pair[1];
      const t = strikeFindUnit(CAMPB.ai.units, pair[0]);
      if(!t || t.dead) continue;                       // 죽은 표적은 campPostStep 이 복귀로 처리한다
      list.sort(function(a, b){ return (a.uid < b.uid) ? -1 : (a.uid > b.uid) ? 1 : 0; });
      const cnt = list.length;
      for(let i = 0; i < cnt; i++){
        const u = list[i], rng = u.rng || 0;
        if(rng <= 0) continue;                          // 안 때리는 유닛(의무병 등)은 건드리지 않는다
        // ⛔ **사거리 끝을 「지키려」 하지 않는다 — 뒤로는 안 물러난다** (2026-08-31 사용자 지적).
        //   ⚠ 증상: 「유닛들이 멈췄다 갔다 한다. 적이 몰려오면 도망 다니는 것처럼 보인다.」
        //   ⭐ 원인: 목표를 늘 `표적에서 rng×0.85` 로 잡으니, **적이 다가오면 그 거리를 지키려고
        //     뒤로 밀려났다.** 적 사거리는 아군보다 짧아(campFoeRngCap) 계속 붙으러 오는데
        //     아군은 계속 물러나니 **매 프레임 방향이 뒤집힌다.**
        //     실측(마린 10기 · 30초): 방향 뒤집힘 **유닛당 33.9회** · 표적 바뀜은 2.1회뿐 —
        //     표적이 흔들려서가 아니라 **거리 유지 때문**이라는 뜻이다.
        //   ⭐ 그래서 **다가가는 데만** 쓴다: 이미 그보다 가까우면 지금 거리를 그대로 둔다.
        //     각도(부채꼴·링)는 그대로 계산되므로 옆으로 벌리는 것은 계속 된다.
        //   ⚠ 이 식은 예전에 한 번 33% 로 실패했었다(시도 ②). 그때는 **레인저가 3칸**이라
        //     사거리 자체가 짧았고 층 배치도 없었다 — 조건이 다르다.
        // ⛔ `Math.min(지금거리, …)` 로 「뒤로 안 간다」를 만들지 말 것 — **세 번 실패했다.**
        //   도착 판정을 90 으로 넓힌 뒤에도 43% 였다(그 전엔 0% · 33%).
        //   앞줄이 멈추면 뒷줄이 갈 곳이 없다는 구조는 무엇과 조합해도 그대로다.
        const want = rng * (u.melee ? CAMP_ENG_MELEE : CAMP_ENG_RANGED);
        // 기준 각도 — **자기 자리 쪽**이다. 아군은 아래(자기 진영)에서 올려다보므로
        // 원거리는 그 방향을 중심으로 벌려야 적 뒤로 돌아가지 않는다.
        const home = u._post || u;
        const base = Math.atan2(home.y - t.y, home.x - t.x);
        let ang;
        if(u.melee){
          ang = base + (i - (cnt - 1) / 2) * (Math.PI * 2 / Math.max(1, cnt));   // ㉠ 둘러싸기
        } else {
          // ㉡ 부채꼴 — 간격이 각도로 얼마인지 거리에서 역산한다(멀수록 좁은 각도로 충분하다)
          const step = Math.min(CAMP_ENG_ARC / Math.max(1, cnt), 2 * Math.asin(Math.min(0.9, CAMP_ENG_GAP / (2 * Math.max(1, want)))));
          ang = base + (i - (cnt - 1) / 2) * step; }
        let gx = t.x + Math.cos(ang) * want, gy = t.y + Math.sin(ang) * want;
        // 🚧 **자리에서 멀리 나가지 않는다** (2026-08-30 사용자 확정).
        //   ⛔ 그냥 두면 적을 **따라 들어간다** — 표적이 멀수록 멀리 쫓아가서 자리가 무너지고,
        //     전선이 계속 움직여 **벙커·포탑 같은 고정 방어가 아무 뜻이 없어진다**
        //     (실측 2026-08-30: 벙커에 태운 판이 안 태운 판보다 늘 느렸다 · 실효 0.45 vs 1.4).
        //   ⭐ 원하는 그림은 「제자리에서 조금만 나가 도와주고 자리를 지킨다」다.
        //     그래서 목표 자리를 **_post 로부터 CAMP_ENG_OUT 안**으로 자른다.
        //   ⚠ 사거리가 안 닿으면 그냥 안 닿는 채로 둔다 — 그것이 「자리를 지킨다」의 뜻이다.
        //     적이 결국 자리 쪽으로 오므로 기다리면 만난다(적은 내 건물을 치러 내려온다).
        //   ⭐ 상한은 **층마다 다르다**(campEngageOut) — 뒤로 밀린 긴 사거리 유닛은 덜 나가고,
        //     앞줄의 짧은 사거리 유닛은 더 나간다. 그래야 긴 유닛이 앞을 막아도 짧은 유닛이 닿는다.
        { const home = u._post, lim = campEngageOut(u);
          if(home){ const ox = gx - home.x, oy = gy - home.y, od = Math.hypot(ox, oy);
            if(od > lim){ gx = home.x + ox / od * lim;
                          gy = home.y + oy / od * lim; } } }
        const dx = gx - u.x, dy = gy - u.y;
        if(dx * dx + dy * dy <= CAMP_ENG_OK * CAMP_ENG_OK){ u.moving = false; continue; }
        // ⏱ **간격은 「목표 계산」에 건다 — 이동은 매 프레임 정상 속도로** (2026-08-31).
        //   ⛔ 처음엔 이동 자체를 가끔만 하고 **0.4초치를 한 프레임에 몰아서** 밀었다.
        //     그래서 유닛이 **훅훅 튀었다** — 실측: 자리 잡기에서 순간이동 236회(최대 203px).
        //     사용자가 화면에서 「튕기면서 순간이동한다」고 본 것이 이것이다.
        //   ⭐ 떨림의 원인은 **목표가 매 프레임 바뀌는 것**이지 이동이 잦은 게 아니다.
        //     그러니 목표만 CAMP_ENG_TICK 마다 갱신하고, **이동은 매 프레임 dt 만큼** 한다.
        //     → 이동량이 정상이라 안 튀고, 목표가 안정적이라 덜 떨린다.
        u._engT = (u._engT || 0) - dt;
        if(u._engT <= 0 || u._engGx == null){ u._engT = CAMP_ENG_TICK; u._engGx = gx; u._engGy = gy; }
        const tx = u._engGx, ty = u._engGy;
        const ddx = tx - u.x, ddy = ty - u.y;
        if(ddx * ddx + ddy * ddy <= CAMP_ENG_OK * CAMP_ENG_OK){ u.moving = false; continue; }
        if(u._sx != null){ u.x = u._sx; u.y = u._sy; }   // strike 가 옮긴 것을 무르고
        strikeMoveToward(u, tx, ty, dt); n++; } }        // ⭐ dt — 몰아서 밀지 않는다
    if(n && typeof strikeSeparate === 'function') strikeSeparate();
  });
  return n; }

// 🪢 **목줄** — **자기 자리**에서 CAMP_LEASH 보다 멀어지면 그 선까지 끌어당긴다.
//   ⛔ 「인식 거리를 넓힌다」만 하고 이걸 빼면 적 본진까지 쫓아간다. 그러면 아군이 흩어져
//     각개격파되고, 적이 건물을 때리는데 아군은 저 위에 있는 그림이 된다.
//   ⚠ 속도를 깎지 않고 **위치만** 자른다 — 이동 로직(stepUnitMove)은 공용이라 건드리지 않는다.
function campLeash(){
  if(!CAMPB || !CAMPB.me) return 0;
  const L2 = CAMP_LEASH * CAMP_LEASH; let n = 0;
  const fb = campRallyPoint();                     // 자리가 아직 없는 유닛만 옛 기준을 쓴다
  for(const u of CAMPB.me.units){ if(u.dead) continue;
    const r = u._post || fb; if(!r) continue;
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
// 아군이 아직 전장에 없을 때 쓰는 값 = **레인저 사거리 × 0.9**.
//   ⛔ 예전에는 168 을 손으로 계산해 박아 뒀다(레인저 187×0.9). 그래서 레인저 사거리를
//     바꾸면 **조용히 어긋났다** — 표와 코드가 이어져 있지 않았다.
//   ⭐ 이제 표에서 유도한다. 레인저 값을 고치면 여기도 저절로 따라온다.
//   ⚠ const 로 두지 말 것 — CAMP_UNIT_STAT · CAMP_STAT_TILE 이 **아래**에 선언돼 있어
//     평가 시점에 TDZ ReferenceError 가 난다(벙커 사거리에서 이미 한 번 물렸다).
function campFoeRngFb(){
  const d = CAMP_UNIT_STAT.marine;
  return (d && d.r ? d.r : 4) * CAMP_STAT_TILE * CAMP_FOE_RNG_K; }
function campFoeRngCap(){
  if(!CAMPB || !CAMPB.me) return campFoeRngFb();
  // ⚠ **근접 유닛은 기준에서 뺀다.** 어차피 붙어야 때리므로 얘네로 상한을 잡으면
  //   적 사거리가 46 까지 내려가 원거리 적이 통째로 근접 유닛이 된다.
  let min = Infinity;
  const see = (u) => { if(!u || u.dead) return;
    if(!(u.dmg > 0) || !(u.rng > 0) || u.melee) return;
    if(u.rng < min) min = u.rng; };
  for(const u of CAMPB.me.units) see(u);
  for(const d of (CAMPB._down || [])) see(d && d.u);   // ⚠ _down 은 {u,t} 껍데기다(유닛이 아니다)
  return (min === Infinity) ? campFoeRngFb() : min * CAMP_FOE_RNG_K;
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
const CAMP_STAT_TILE = 850 * 0.22 / 4;             // 칸 → 월드 거리(46.75). ⚠ 「레인저 4칸 = 엔진 187」로 역산한 값이라
                                                   //   레인저 사거리를 바꿔도 **이 상수는 그대로 둔다**(칸의 크기는 안 변한다).
// 🪜 **사거리 = 테크 계단** (2026-08-31 사용자 확정)
//   ⛔ 예전에는 계단이 어긋나 있었다 — **T1 레인저 4.0칸이 T2 레이서 3.5칸보다 길었다.**
//     그래서 ①테크를 올릴 이유가 약하고 ②초반 유닛이 후반까지 그대로 앞줄에 섰다.
//   ⭐ 티어는 코드에 표가 없다 — `TECH_TREE` 의 **`produces[].req` 사슬**이 곧 티어다
//     (`js/15-tech-data.js`). ⚠ 저격수는 T1 건물(병영)에서 나오지만 req:['scifac','covert'] 라
//     **실질 최종 티어**다. 「어느 건물에서 나오는가」로 판단하면 틀린다.
//
//   유니온 계단 (⚠ 스모크 「사거리 계단」이 이 순서를 지킨다)
//     T1 레인저      4.0   ⚠ **4칸에서 안 내린다** — 아래 「자리 제한과 짝」 참고
//     T2 레이서      4.0
//     T3 전투기      5.0   기갑병 6.0
//     T4 폭격기      6.5
//     T5 전함        7.0   저격수 8.0
//     ⭐ 공성전차 9.0 은 **계단 밖 예외**다 — T3 이지만 공성 유닛이라 원작대로 최장으로 둔다.
//
//   ⛔ **손대지 않는 것 둘** (사용자 확정)
//     · 근접(r ≤ 1.5) — 화력병·스내퍼·블레이드·다크템플러·울트라리스크·스팅어.
//       「붙어서 싸운다」가 정체성이라 계단에 넣으면 역할이 사라진다.
//     · 비전투 — 의무병·수송선·지원정찰기·메두사·오버로드·하이템플러·세라프·옵저버.
//   ⚠ 스웜·에테리얼은 아직 안 건드렸다(유니온 결과를 보고 정한다).
//     페럴·콜로서스는 이 표에 **아예 없어서** 엔진 원본 사거리를 그대로 쓴다.
//
//   ⛔ **레인저 사거리는 자리 제한(CAMP_ENG_OUT)과 짝이다** — 한쪽만 바꾸면 조합이 깨진다.
//     📜 500 시절의 기록 (2026-08-31 · 옛 campEngageStep 구조): 4칸 → 3칸 으로 내려 봤더니
//       **짧은 사거리 유닛이 적에게 영영 못 닿았다** — 아군이 전부 자리에서 500(상한)까지
//       나가 굳고, 적까지는 342~375 였다(사거리 140). 그 사이 아군만 12기 → 5기로 죽었다.
//       벤치로도 D1R18 → D1R14 로 나빠졌다.
//     ⚠ **그 500 은 지금 값이 아니다** — 같은 상수가 그 뒤 **1200** 으로 다시 측정됐다.
//       위 숫자를 지금 값과 견주지 말 것. 짝이라는 사실만 남는다.
//     → 레인저를 내리려면 **CAMP_ENG_OUT 도 함께** 다시 재야 한다(선언 자리의 표를 볼 것).
//
//   ⛔ **이동 속도는 여기서 못 바꾼다** (2026-08-31 · s 칸을 넣었다가 되돌림).
//     `u.spd` 를 덮어도 **실제 이동 속도가 안 변한다.** 실측: u.spd 를 100 으로 하든 600 으로
//     하든 600px 이동이 똑같이 1.8초(실효 333px/s)였고 순간 속도도 내내 342 로 같았다.
//     ⭐ 이유: 실제 이동은 `stepUnitMove(p, …, key, key, …)` 가 **유닛 id(key)로 원본
//       moveSpd 를 조회해** 계산한다. `u.spd` 는 그 공용 함수가 없을 때의 **폴백 경로**에서만 쓰인다.
//     ⚠ 그래서 「공성전차를 6.5칸으로 올렸다」는 보고가 **틀렸었다** — 올라간 적이 없다.
//       화면에서 「전차 속도는 맞다」고 느껴진 것도 그것이 계속 원래 값이었기 때문이다.
//     ⭐ 정말로 바꾸려면 길은 셋뿐이고 앞의 둘은 막혀 있다:
//       ① U[id].moveSpd 수정 → ⛔ 멀티 대전·오각형 상성이 같이 바뀐다(RACES.md)
//       ② 18-strike.js 수정 → ⛔ 오토배틀과 공유
//       ③ strikeMoveToward 를 캠프가 감싸 **dt 에 배수를 곱한다**(campPatchFront 와 같은 방식)
//       → ③ 이 유일한 길이지만 가속·감속 곡선이 달라진다. 필요해지면 그때 재고 넣는다.
//   ⚠ **적 사거리가 여기에 매여 있다** — campFoeRngCap 이 「아군 **최소** 사거리 × 0.9」다.
//     ⭐ 다만 화력병(1.5칸)은 melee 판정(r ≤ 1.0)에 **안 걸려서** 상한 계산에 들어간다.
//       즉 화력병이 전장에 있으면 상한은 70×0.9 = 63 이고, 레인저를 3칸으로 낮춰도 **안 바뀐다.**
//       달라지는 것은 **화력병이 없는 초반**뿐이다(168 → 126 · 적이 더 가까이 와야 쏜다).
const CAMP_UNIT_STAT = {
  // 유니온 §3-1 (⚠ 레이서·저격수는 §3-1-1 조정분이 들어 있다)
  //   🪜 **사거리는 테크 계단이다**(2026-08-31 사용자 확정) — 아래 CAMP_RNG_TIER 참고.
  marine:{a:1,h:5,r:4.0,c:1.0}, machinegun:{a:2.2,h:8,r:1.5,c:0.9}, racer:{a:2.5,h:7,r:4.0,c:0.8},
  goliath:{a:3,h:14,r:6.0,c:1.0}, ghost:{a:4,h:9,r:8.0,c:1.6}, medic:{h:23,r:2.0},
  pelican:{h:27}, aegis:{h:23}, tank:{a:12,h:22,r:9.0,c:2.2}, skyguard:{a:4.5,h:22,r:5.0,c:1.0},
  hellfire:{a:10,h:28,r:6.5,c:1.6}, dreadnought:{a:31,h:47,r:7.0,c:2.0},
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
    u.acq = campAcqBase(u);
    u.melee = d.r <= 1.0; }               // 1칸 = 근접
  // ⛔ 이동 속도는 여기서 안 덮는다 — `u.spd` 는 실제 이동에 안 쓰인다(위 표 주석 참고).
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
  for(const u of list) if(u) u.acq = campAcqBase(u);
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

// ══ 🩹 아군 부활 — **라운드 단위** (2026-08-29 사용자 확정) ═══════════
//   ⭐ 아군은 죽지 않는다. 다만 **그 라운드 안에서는 못 일어난다** —
//     라운드가 새로 시작할 때 **전원 부활 + 체력 전체 회복**으로 판이 리셋된다.
//   ⛔ **시간 부활(30초)을 없앴다.** 그것이 후반 발산의 실제 동력이었다 —
//     실측(2026-08-29 · 던전 2): 누운 병력이 6 → 34 로 쌓이며 꽂힌 화력이
//     R9 정점 891 에서 R24 487 로 **떨어졌고**(라운드당 ×0.968), 난이도는 ×1.073 로
//     계속 올라 R24 가 11.4분이 됐다. 죽는 속도가 30초 부활보다 빨랐던 것이다.
//   ⭐ 라운드마다 리셋되면 화력이 **줄지 않는다** — 발산의 되먹임 고리가 끊어진다.
//   ⛔ **결과 하나가 딸려 온다: 전멸 = 패배.** 라운드 도중에는 못 일어나므로 서 있는 병력이
//     0 이 되면 그 라운드를 깰 방법이 없다. 예전에는 「다 누워도 30초 뒤 일어난다」라
//     전멸이 패배가 아니었다 — 그 전제가 사라졌다.
// 🌳 「버팀」(endure · 구 rebuild) — 치명 피해를 **1회 무시하고 체력 1로 버틴다**(유닛당 라운드 1회).
//   라운드 부활 규칙에서 「한 대 더 버틴다 = 그 라운드를 더 싸운다」라, 옛 부활 단축과 역할이 같다.
//   ⛔ T5 를 100% 로 올리지 말 것 — 전멸이 안 나고, 실질 체력 ×2 라 체력 축과 겹친다(sc-3 §4-5-7).
//   ⛔ 「라운드 도중 부활」로 되돌리지 말 것 — 버팀은 죽기 **전에** 작동하는 것이다.
const CAMP_RT_END = [0, 0.15, 0.30, 0.45, 0.60, 0.75];   // 그 라운드에 버티는 유닛 비율
function campEndureP(){ const n = campRtHas('endure'); return n > 0 ? CAMP_RT_END[Math.min(5, n)] : 0; }
//   ⚠ **죽은 유닛은 배열에 남지 않는다** — strikeStepUnits 끝에서 `me.units=me.units.filter(u=>!u.dead)`
//     로 걷어낸다(18-strike.js:1301, 공유 파일이라 못 고침). 그래서 **걷히기 전후를 비교해** 붙잡는다.
//     객체는 살아 있으므로(배열에서 빠졌을 뿐) 그대로 들고 있다가 되살려 배열에 돌려놓는다.
function campCatchDown(before){
  if(!CAMPB || !before) return 0;
  if(!CAMPB._down) CAMPB._down = [];
  const now = CAMPB.me.units, keep = new Set(now);
  let n = 0;
  const endP = campEndureP();
  for(const u of before){ if(keep.has(u) || !u) continue;
    // 🛡 버팀 — 치명타를 1회 무시하고 체력 1로 그 자리에서 계속 싸운다(유닛당 라운드 1회).
    //   걷힌 직후 되살리는 것이라 겉보기에 「죽기 전에 버틴」 것과 같다 — 자리·표적이 그대로다.
    if(endP > 0 && !u._endured && Math.random() < endP){
      u._endured = true; u.dead = false; u.hp = 1;
      CAMPB.me.units.push(u); continue; }
    CAMPB._down.push({ u:u, t:0 }); n++; }   // 걷힌 것 = 이번 프레임에 누운 것 (⏱ 타이머 없음 — 라운드가 끝나야 일어난다)
  return n; }
// 🩹 **라운드 리셋** — 누운 병력을 전원 일으키고, 서 있는 병력도 체력을 가득 채운다.
//   ⭐ 라운드가 시작될 때 · 던전이 바뀔 때 · 전장을 새로 열 때 부른다.
//   ⛔ 라운드 도중에는 부르지 않는다 — 그게 이 규칙의 전부다.
function campRoundRevive(){
  if(!CAMPB || !CAMPB.me) return 0;
  let up = 0;
  for(const d of (CAMPB._down || [])){ const u = d && d.u; if(!u) continue;
    u.dead = false;
    u._collapseT = null; u.wait = 0;                 // 붕괴 대기·스폰 대기 흔적 정리
    u.tgtUid = null; u._btgt = null; u._btT = 0;     // 표적은 새로 고른다
    if(u._post){ u.x = u._post.x; u.y = u._post.y; } // 🪧 자기 자리에서 일어난다(누운 곳이 아니라)
    u._sx = u.x; u._sy = u.y;
    CAMPB.me.units.push(u); up++; }
  if(CAMPB._down) CAMPB._down.length = 0;
  // ⭐ **서 있던 병력도 가득 채운다** — 라운드가 온전한 상태로 시작해야 화력이 줄지 않는다.
  for(const u of CAMPB.me.units){ if(u.dead) continue;
    u.hp = u.maxHp || u.hp; u.sh = u.maxSh || 0;
    u._endured = false; }                            // 🛡 버팀은 라운드당 1회 — 새 라운드에 다시 찬다
  return up; }
// 누워 있는(부활 대기) 유닛 수 — 승패 판정이 쓴다
function campDown(){ return (CAMPB && CAMPB._down) ? CAMPB._down.length : 0; }

// 살아 있는 유닛 수
function campAlive(side){ if(!CAMPB) return 0; let n = 0;
  for(const u of CAMPB[side].units) if(!u.dead) n++; return n; }

// 🏁 던전 전환 — **내 병력·자리·건물은 그대로 두고 적만 갈아 끼운다** (2026-08-28 사용자 확정).
//   ⛔ 예전엔 campBattleOpen() 으로 전장을 통째로 새로 만들었다. 그러면 me.units 가 비워져
//     **병력이 통째로 사라진다.** 지금까지는 campSortie 가 기지에서 곧바로 다시 채워 넣어
//     가려져 있었을 뿐이다 — 유닛이 한 번만 태어나게 된 지금은 그대로 증발한다.
//   ⭐ 전장을 새로 만들 이유는 **적 종족이 바뀌는 것 하나뿐**이었다. 나머지(본부 위치·신전
//     없음·적 본부 없음)는 던전과 무관하게 늘 같다.
//   ⭐ 건물 체력은 **채워 준다**(사용자 결정) — 다음 던전을 온전한 기지로 시작한다.
function campDungeonSwap(){
  if(!CAMPB) return false;
  CAMPB.ai.race = campFoeRace(campDgN());
  CAMPB.ai.units.length = 0;                       // 적만 비운다
  if(CAMPB._wq) CAMPB._wq.length = 0;
  CAMPB._wqTot = 0; CAMPB._wqT = 0;
  campBuildStructs();                              // 🏢 건물을 다시 올린다 = 체력이 가득 찬다
  campRoundRevive();                               // 🩹 던전이 바뀌어도 온전한 상태로 시작한다
  campRegroup();                                   // 🧭 표적을 풀어 자기 자리로 돌아가게 (아래)
  // ⏸ **던전이 바뀔 때도 숨 고르기를 준다**(2026-08-30 사용자 확정) — 라운드 사이와 같은 6초.
  //   그 사이 병력이 걸어서 자리를 잡고, 다 모인 뒤에 새 던전의 적이 나온다.
  //   ⛔ 0 으로 두면 적이 곧바로 쏟아져 흩어진 채로 첫 라운드를 맞는다.
  CAMPB._gapT = CAMP_ROUND_GAP_S;
  return true; }

// 🧭 **제 자리로 걸어 돌아가게 한다** (2026-08-30 사용자 확정).
//   ⛔ 순간이동시키지 말 것 — 처음엔 즉시 옮겼는데, 사용자가 **걸어서 오는 쪽**으로 정했다.
//   ⛔ _post 를 새로 잡지도 말 것 — 플레이어가 공들여 옮긴 배치가 통째로 리셋된다.
//     「전열로 정렬」안은 그래서 쓰지 않는다.
//   ⭐ 여기서 하는 일은 **표적을 푸는 것뿐**이다. 표적이 없으면 campStepUnits 의 복귀 분기가
//     자기 자리로 걸려 보낸다 — 그 걸어올 시간은 숨 고르기(CAMP_ROUND_GAP_S)가 대준다.
//     ⚠ 옛 주석은 campPostStep 을 가리켰다 — 2026-08-31 에 배선이 끊긴 함수다.
function campRegroup(){
  if(!CAMPB || !CAMPB.me) return 0;
  let n = 0;
  for(const u of CAMPB.me.units){
    u.tgtUid = null; u._btgt = null; u._btT = 0;    // 표적 해제 — 없어진 적을 쫓지 않는다
    if(u._post) n++; }
  return n; }

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
//   ① 혼자서는 **제 사거리 + CAMP_ACQ_PAD** 만큼만 본다(유닛마다 다르다).
//   ② 사거리 밖에서 맞으면 **그 적까지** 눈이 즉시 넓어진다(CAMP_HIT_ACQ_S 초 유지).
//   ③ 눈이 넓어진 아군은 곁(CAMP_ALERT_R = 400) 의 아군에게 그 눈을 전파한다.
//   ④ 전파받은 아군도 다음 틱에 전파원이 된다 — **연쇄**로 줄줄이 번진다.
//      ⭐ 그래서 「사거리 긴 적이 뒤에서 때리면, 맞은 아군부터 그 옆까지 차례로 들어간다」.
//   ⭐ 그래서 **발견자에게서 먼 아군은 자기 자리를 지킨다** — 한쪽으로 우르르 몰리지 않고
//     싸움이 난 구역의 병력만 거든다.
//   ⛔ 전원에게 넓은 인식을 주면(옛 방식) 판 전체가 한 덩어리로 움직여, 반대쪽이 통째로 빈다.
// ⭐ **인식은 「나갈 수 있는 거리」보다 작아야 한다** (2026-08-31 사용자 지적 · 실측으로 확정).
//   ⛔ 옛 값(900 / 1500)은 **실효 1260 / 2100** 이었다(STK_ACQ_FAR 1.4 가 곱해진다).
//     이동 제한(1200)보다 커서 **적이 화면에 나타나는 순간 전군이 표적을 잡고 제한 끝까지
//     우르르 올라갔다** — 「지키다가 맞으러 나간다」가 아니라 「생성되자마자 돌격」이었다.
//   📊 실측(30초 · 11기): 알아챈 거리 1822 · 자리에서 벗어난 거리 평균 590 · 최대 1353.
//     인식을 조이면 → 알아챈 거리 601 · 벗어난 거리 평균 **149** · 최대 590.
//   ⭐ 그래서 인식이 곧 실질 제한이 된다. CAMP_ENG_OUT 은 이제 「최후의 안전선」이다.
//   ⚠ 전파(campAlertTick)는 그대로 둔다 — 「같이 싸우는 느낌」이 거기서 나온다.
//     다만 전파받은 인식도 함께 조여야 뜻이 있다(안 그러면 한 명이 보는 순간 전원이 멀리 본다).
// ⭐ **인식은 유닛마다 다르다 — 제 사거리 + CAMP_ACQ_PAD**(2026-09-01 사용자 확정).
//   고정값 하나(옛 450)는 근접(사거리 47)과 공성전차(421)에게 같은 눈을 줬다 —
//   근접은 닿지도 못할 거리를 보고 달려 나가고, 장거리는 제 사거리도 못 채웠다.
const CAMP_ACQ_PAD = 100;          // 기본 인식 = 자기 사거리 + 이만큼
function campAcqBase(u){ return ((u && u.rng) || 0) + CAMP_ACQ_PAD; }
// 🩸 **사거리 밖에서 맞으면 그 적까지 눈을 넓힌다** — 맞고만 있지 않고 반격하러 간다.
const CAMP_HIT_ACQ_S = 3;          // 맞아서 넓어진 인식이 유지되는 시간(초)
// ⚠ **진형 폭보다 좁으면 줄 끝까지 소식이 안 간다** (2026-09-01 실측).
//   눈은 사거리+100(레인저 287)인데 진형은 840px 이라, 왼쪽 끝 유닛은 오른쪽 적을 못 본다.
//   실측 표적을 가진 비율이 적이 끊이지 않는 던전에서도 **33~52%** 였다 — 절반이 논다.
//   ⛔ 그렇다고 진형 폭(840)까지 주면 안 된다 — **어디에 두든 전군이 달려가 배치의 뜻이 사라진다**
//     (2026-09-01 사용자 확정). 400 은 「곁의 두세 명 건너까지」에 해당한다.
const CAMP_ALERT_R = 400;          // 옆 아군에게 전파되는 거리 — **연쇄한다**(아래 campAlertTick)
const CAMP_ALERT_S = 3;            // 전파 지속(초) — 풀리면 다시 자기 자리로
const CAMP_ALERT_TICK = 0.25;      // 전파 판정 주기(초) — 매 프레임 돌면 비싸다
// 🪢 **자기 자리에서 이보다 멀리는 못 나간다** — 이제 이것이 **자리 제한의 유일한 장치**다.
//   ⛔ 예전에는 campEngageStep 이 목표를 CAMP_ENG_OUT(500) 안으로 잘라 제한했다. 전투를
//     오토배틀에 넘기면서 그 장치가 사라졌고, 유닛이 적을 따라 **750 까지** 나갔다(스모크가 잡았다).
//   ⭐ 그래서 옛 500 과 비슷한 수준으로 조인다. 목줄은 「최후의 선」이라 조금 여유를 둔다.
//   ⚠ 목줄은 위치를 **직접 자른다**(순간이동). 그래서 경계에 붙어 있으면 툭툭 끊겨 보인다 —
//     값을 더 줄일 때는 그 점을 함께 볼 것.
const CAMP_LEASH = 600;
const CAMP_POST_R = 45;            // 자리 도착 판정 반경 — 이 안이면 다 온 것으로 본다
const CAMP_RETURN_K = 1.8;         // 복귀 속도 배수(자리로 돌아올 때만) — 「빠르게 되돌아온다」
const CAMP_ROUND_GAP_S = 4;        // 라운드·던전 사이 숨 고르기(초) — 자리로 걸어 돌아올 시간
  // ⭐ **라운드 사이와 던전 이동이 같은 값을 쓴다** — 여기 하나만 고치면 양쪽이 함께 움직인다.
  // ⚠ 실측: 자리에서 424 떨어진 유닛이 **2초에 35 까지** 붙는다(스모크 「걸어서 자리로」).
  //   4초면 판 반대편에서도 도착한다. ⛔ 0 으로 두면 흩어진 채로 다음 라운드를 맞는다.
function campCombatStep(dt){
  const C = campState(); if(!C || campDgN() <= 0) return;      // 0단계(캠프)에는 전투가 없다
  if(!CAMPB) campBattleOpen();
  if(!CAMPB) return;
  // ⏸ 숨 고르기 — 적이 안 나오는 동안 **걸어서 자기 자리로 돌아온다**.
  //   ⛔ 예전엔 여기서 곧바로 return 해서 **6초 동안 유닛이 한 발짝도 안 움직였다**(2026-08-30 발견).
  //     「돌아올 시간을 준다」는 주석만 있고 실제로는 멈춰 서 있었다 — 텀을 아무리 늘려도 소용없었다.
  //   ⭐ 그래서 이동·복귀·부활만 굴린다. 적이 없으니 전투는 저절로 일어나지 않는다.
  if(CAMPB._gapT > 0){ CAMPB._gapT -= dt;
    const _g4 = CAMPB.me.units.slice();                   // 🩹 걷히기 전 명부(아래 campCatchDown)
    campWithStk(() => { campStepUnits(dt); CAMPB.t += dt; });
    // ⛔ **여기에도 campCatchDown 이 있어야 한다** (2026-08-30 · 병력 누수의 원인).
    //   campStepUnits 는 끝에서 죽은 유닛을 배열에서 **걷어낸다**. 그걸 붙잡지
    //   않으면 그 유닛은 _down 에도 안 들어가 **명부에서 통째로 사라진다** — 부활도 못 하고
    //   campBattleClose 가 기지로 되돌리지도 못한다.
    //   ⚠ 「숨 고르기엔 적이 없으니 안 죽는다」가 아니다 — 지속 피해(역병·방사능)와 붕괴
    //     대기(_collapseT)가 이 구간에서도 계속 굴러간다.
    //   ⭐ 실측(2026-08-30 브라우저): 숨 고르기 중 한 기를 죽였더니 명부가 4 → 3 이 됐고
    //     라운드가 시작돼도 3 그대로였다. 벽 측정에서 병력이 88 → 85 로 줄던 것이 이것이다.
    campCatchDown(_g4);
    campBunkerStep(dt);                                   // 🧱 벙커에 탄 유닛은 그 자리에 (숨 고르기에도 유지)
    // ⛔ 여기서 부활시키지 않는다 — **부활은 라운드 단위**다(campRoundRevive · 2026-08-29).
    //   숨 고르기 끝에서 한 번에 일으키므로, 여기서 또 부르면 두 벌이 된다.
    //   ⚠ 옛 시간 부활(campReviveStep)은 없앴다 — 그게 후반 발산의 동력이었다.
    if(CAMPB._gapT <= 0){
      // ⛔ **출격이라는 것이 없다** (2026-08-28). 유닛은 생산될 때 이미 전장에 선다(campDeploy).
      //   인구 상한도 생산에서 막히므로 전장에서 잘라낼 것이 없다.
      campBuildStructs();                                 // 🏢 그새 지은 건물을 전장에 반영(체력도 새로)
      campRoundRevive();                                  // 🩹 라운드 시작 = 전원 부활 + 체력 전체 회복
      campSpawnFoes(); }
    return; }
  if(!CAMPB.ai.units.length && !CAMPB._started){ CAMPB._started = true; campRoundRevive(); campSpawnFoes(); return; }
  campAlertTick(dt);    // 👀 발견 전파 — 이동·전투보다 **먼저** 걸어야 이번 프레임에 반영된다
  const _b4 = CAMPB.me.units.slice();   // 🩹 campStepUnits 가 죽은 것을 걷어내므로 미리 떠 둔다
  // ⚔ **캠프가 제 프레임을 통째로 소유한다**(`js/21-camp-battle.js` · 2026-08-31).
  //   ⛔ 예전엔 strikeStepUnits 를 돌린 **뒤에** 그 결과를 되돌리고 다시 밀었다 —
  //     campEngageStep(되돌리기) · campPostStep(복귀) · campLeash(위치 자르기) 셋이
  //     오토배틀 이동과 매 프레임 싸워 유닛이 덜덜 떨었다(방향 뒤집힘 96회/유닛 ·
  //     순수 오토배틀은 0.9회). 상수로 네 번 고쳐 보고 네 번 다 되돌렸다.
  //   ⭐ 지금은 표적 선정·자리·이동·사격이 campStepUnits 한 곳에 있다. 자리 제약은
  //     「목표를 정할 때」 걸리고, 이동은 프레임당 한 번뿐이라 무를 것이 없다.
  campWithStk(() => { campStepUnits(dt); CAMPB.t += dt; });
  campCatchDown(_b4);   // 🩹 이번 프레임에 누운 아군을 붙잡는다
  campBunkerStep(dt);   // 🧱 벙커에 탄 유닛은 그 자리에 붙들고, 맞은 만큼을 벙커가 대신 받는다
  // 🌳 「스킬 쿨다운」 −70% — 18-strike 를 고치지 않고, 이미 dt 만큼 깎인 값을 **더** 깎아 배속한다.
  //   ⚠ 내 유닛만. 사다리 ×N 을 '남은 시간이 1/N 속도로 흐른다'가 아니라 '(N−1)dt 만큼 더 깎는다'로 읽는다.
  if(campFoesPending()){                                  // ⏱ 다음 웨이브 투입
    CAMPB._wqT -= dt;
    // ⭐ **화면의 적을 다 잡았으면 기다리지 않는다**(2026-08-30). 이 한 줄이 있어야
    //   간격을 늘려도 「대기가 곧 라운드 길이」가 되지 않는다 — 위 CAMP_WAVE_GAP_S 경고 참조.
    if(CAMPB._wqT <= 0 || !CAMPB.ai.units.length){ campSpawnWave(); CAMPB._wqT = CAMP_WAVE_GAP_S; } }
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
  //   ⚠ **병력이 하나도 없을 때는 이 규칙을 쓰지 않는다**(2026-08-30 · 새 패배 규칙과 짝).
  //     campCanHitFoes 는 「살아서 때릴 수 있는 아군」이 없으면 false 를 준다 — 전멸도 그 경우다.
  //     그대로 두면 **전멸 = 즉시 패배**가 되어, 사용자가 오늘 정한 「패배는 본부 파괴 하나뿐」이
  //     무력해진다(브라우저 실측 2026-08-30: 전멸 프레임에 곧바로 전장이 닫혔다).
  //   ⭐ 이 규칙의 뜻은 「**때릴 병력은 있는데** 원리상 안 닿는다」(공중 전용 적)이다.
  //     병력이 0 이면 적이 건물·본부를 부수며 판이 나아가므로 멈추지 않는다.
  // ⛔ **`campAlive('me') > 0` 을 쓰지 말 것** — 그러면 의무병 하나가 「병력이 있다」로 세어져
  //   전투 유닛이 다 누운 판이 곧바로 탈락으로 간다(2026-08-31 재현). 두 판정은 **같은 자**를 써야 한다.
  const _noHit = CAMPB._started && !campFoesPending()
    && campArmedUnits().length > 0 && !campCanHitFoes();
  // 🏢 **패배 = 본부 파괴 하나뿐**(2026-08-30 사용자 확정).
  //    ⭐ 전멸은 패배가 아니다. 병력이 다 누우면 적이 **길목의 건물을 차례로 부수며** 밀고
  //      들어오고, 마지막에 본부가 무너질 때 진다. 그 사이 건물들이 시간을 벌어 준다.
  //      (적이 내 건물을 때리는 경로는 campPatchFront → campFrontBld 가 만든다.)
  //    ⛔ 되돌리지 말 것 — 이 자리에서 두 규칙을 거쳐 왔다:
  //       · 「건물 전부 파괴」(2026-08-27) → 지금은 본부 하나
  //       · 「전멸 = 패배」(2026-08-29) → 사용자가 2026-08-30 에 뒤집었다
  //    ⚠ 전멸해도 판이 멈추지 않는 이유가 여기 있다: 부활은 라운드 시작뿐이라 그동안 못
  //      일어나지만, 적이 본부를 부수면서 **게임은 계속 나아간다.** 그 둘이 짝이다.
  const _base = CAMPB.me.base;
  const _lost = !_base || _base.dead || (_base.hp || 0) <= 0;
  if(_lost || _noHit){
    const was = campFail(); campBattleClose(); campBarReset();
    campSay(_lost
      ? ('🏢 본부가 무너졌습니다 — 던전 ' + was.dg + ' ' + was.cleared + '라운드에서 탈락')
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
    if(campDgN() !== dgWas){                                   // 던전이 바뀌면 **적만** 갈아 끼운다
      campDungeonSwap(); campBarReset();
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
  const canReb = (typeof campCanRebirth === 'function') && campCanRebirth();   // ⓒ 지금은 조건만 본다(종족별 건물은 나중에)
  const key = dg + '|' + foe + '|' + pts + '|' + (canReb ? 1 : 0);
  if(key === _campBarS) return;
  _campBarS = key;
  // ⛔ 던전·라운드·진행은 여기 두지 말 것 — 재화 바 왼쪽 칩(#curTitle · js/12-appshell.js)이
  //    이미 그걸 보여주고 거기에 이동 드롭다운까지 붙어 있다. 두 곳에 두면 반드시 어긋난다.
  const fo = el.querySelector('.cbFoe');
  if(fo) fo.textContent = (dg > 0 && foe > 0) ? ('적 ' + foe) : '';
  // 🌳 트리 입구는 **하단 네비 「환생 › 트리」 하나**다(2026-09-01 사용자 확정).
  //   ⛔ 띠에 트리 칩을 되돌리지 말 것 — 환생 화면에서 가는 길이 생겨 두 입구가 되었다.
  // 🔁 환생 칩 — 조건(누적 재화 100만)을 채우면 나타난다. 화면을 안 봐도 열리는 것이 아니라
  //    일꾼을 사고 탭을 눌러야 채워지는 값이다(HUNT_R1 §4-1).
  { const rb = el.querySelector('.cbReb'); if(rb) rb.classList.toggle('hide', !canReb); }
  // 보여줄 게 하나도 없으면 띠 자체를 숨긴다(빈 판이 맵을 가리지 않게)
  el.classList.toggle('empty', !(dg > 0 && foe > 0) && !canReb);
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
    upg:{}, rate:0, leftAt:0, tapped:0, earnTap:0, earnAuto:0, playS:0 };   // dg=0 은 캠프 · upg=캠프 업그레이드 · rate=실측 수급속도 · leftAt=나간 시각
  // 🔄 ver1 → ver2 : 단계 번호가 한 칸 내려갔다. 옛 「던전 1(적 없음)」이 지금의 0단계(캠프)다.
  //    ⛔ 그냥 두면 옛 저장이 곧장 던전 1(적이 나오는 곳)에 서 있게 된다.
  if((p.camp.ver | 0) < 2){ p.camp.dg = Math.max(0, (p.camp.dg | 0) - 1); p.camp.ver = CAMP_VER; }
  if(typeof p.camp.cleared !== 'number') p.camp.cleared = 0;
  if(typeof p.camp.earn !== 'number') p.camp.earn = 0;         // 🔁 그 회차 누적 미네랄(환생 관문·포인트 기준)
  if(typeof p.camp.earnGas !== 'number') p.camp.earnGas = 0;
  if(typeof p.camp.rebMul !== 'number') p.camp.rebMul = 0;     // 환생 배수 — 합산 누적
  if(typeof p.camp.rbPts !== 'number') p.camp.rbPts = 0;       // 환생 포인트 — 트리에 쓴다(6단계)
  if(!p.camp.best || typeof p.camp.best !== 'object') p.camp.best = {};
  // 🛡 rebuild → endure 이관(2026-08-29) — 갈래 키가 바뀌었다. 옛 세이브의 포인트를 옮긴다.
  if(p.camp.rbTree && p.camp.rbTree.rebuild && !p.camp.rbTree.endure){
    p.camp.rbTree.endure = p.camp.rbTree.rebuild; delete p.camp.rbTree.rebuild; }
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
// 💎 광맥은 **한 줄 일곱 칸**이다(2026-08-31 사용자 확정). 3×2 두 줄은 덩어리로 뭉쳐 보였다.
//   ⭐ 일직선이 아니라 **가운데가 처진 호**다 — 본부(위)를 감싸 안는 모양이 되고, 일곱이
//     한 줄로 서도 울타리처럼 딱딱해지지 않는다.
//   ⚠ 칸 수를 바꾸면 가스와의 간격(CAMP_GAS_GAP)도 같이 봐야 한다 — 반폭이 그만큼 늘어난다.
const CAMP_MINE_COLS = 7, CAMP_MINE_ROWS = 1;
const CAMP_MINE_ARC = 0.8;   // 호의 깊이(칸) — 가운데가 이만큼 아래로 처진다
// ⚠ 이 둘이 **기지가 하단 시트에 가리지 않게** 하는 유일한 장치다.
//   맵은 화면 전체를 쓰고 시트가 그 위를 덮으므로(css/30-home.css 캠프 블록), 시트 상단보다
//   위에 앉혀야 한다. 시트 상단 = 화면 세로의 0.77 지점(실측: 맵 701px 중 시트 161px + 네비).
//   ⛔ 값을 바꿨으면 **가장 아래 요소인 가스**(광맥 행 + h-0.55)까지 재서 0.74 아래로
//     내려가지 않는지 확인할 것 — 광맥만 보고 정했다가 가스가 시트에 물렸다.
// 🏠 본부는 **광맥 바로 위**다(2026-08-31 사용자 확정 · 0.58 → 0.63).
//   위쪽을 비워 적이 내려오는 길을 길게 잡고, 손이 닿는 아래쪽에 본부·광맥·가스를 모은다.
const CAMP_ROW_BASE = 0.63;   // 본부 중심(격자 세로 비율 0~1)
const CAMP_ROW_MINE = 0.67;   // 광맥 첫 줄
// ⚠ 행 번호는 **여기 한 곳에서만** 만든다. 광맥과 가스가 각자 round(rows*f) 를 하면
//   호출 시점에 _techRows() 가 달라져 서로 다른 행에 앉는다(실측: 가스가 광맥보다 5행 위였다).
function campRow(f){ return Math.max(0, Math.round(_techRows() * f)); }
function campRowY(f){ return techY0() + campRow(f) * _techCH(); }
function campMineCol(){ return Math.round(techCols() / 2 - CAMP_MINE_COLS / 2); }
// ── 💎 광맥 그림 ─────────────────────────────────────────────────────────
// 여섯 칸에 **서로 다른 그림**을 쓴다. 3D 노드는 6칸이 같은 모델·같은 각도라 격자무늬로 보였다.
// ⭐ 뒤(윗줄)가 크고 앞(아랫줄)이 작다 — 그래야 한 광맥으로 읽히고 깊이가 생긴다.
//   `CAMP_MINE_COLS = 3` 이므로 인덱스 0~2 가 윗줄, 3~5 가 아랫줄이다(campLayMinerals 의 배치 순서).
// ⚠ 그림은 고갈 6단계로 뽑아 뒀지만 **캠프 광맥은 마르지 않는다**(inf) — 지금은 「크기 변주」로만 쓴다.
//   고갈을 실제로 넣게 되면 campMineStage() 가 잔량으로 단계를 고르게 바꾸면 된다.
// 지금은 **1번 하나로 여섯 칸을 통일**한다.
// ⚠ 2~6번 그림은 **고갈 단계용**이라 여기서 안 쓴다(캠프 광맥은 마르지 않는다).
//   잔량이 주는 유즈맵이 생기면 그때 campMineSprite 가 잔량으로 고르게 바꾼다.
const CAMP_MINE_SPRITE = ['1','1','1', '1','1','1'];
// 💎 결정 덩어리의 **크기와 간격**(2026-08-31 사용자 요청 — 「조금 키우고 간격을 아주 조금 벌리자」)
//   ⚠ 둘은 함께 움직인다: 키우기만 하면 서로 겹치고, 벌리기만 하면 사이가 휑해진다.
//   ⛔ 간격을 키울 때 x0(왼끝) 기준으로 곱하면 줄 전체가 오른쪽으로 밀린다 —
//      **가운데를 축으로** 벌려야 제자리에 있다(campLayMinerals 참고).
const CAMP_MINE_SCALE = 1.50;   // 스프라이트 크기(칸 대비) — 옛 1.34
const CAMP_MINE_GAP   = 1.12;   // 이웃 간 간격 배수
// ⛔ **좌우 뒤집기를 쓰지 않는다**(2026-08-31 사용자 확정). 같은 그림을 그대로 반복한다 —
//   뒤집으면 광원 방향이 칸마다 반대가 되어 오히려 눈에 걸린다. 반복이 거슬리면 뒤집지 말고
//   그림을 한 장 더 뽑는다(stage2…). 가스도 같은 규칙이다.
// ⛽ 가스 구역도 같은 규칙 — **캠프에서만** 그림으로 바꾼다(2026-08-31).
//   3D 노드(res_en)는 좌우 두 구역이 같은 모델·같은 각도라 미네랄과 같은 「격자무늬」가 났다.
//   ⛔ 관리자 건설 탭·오토배틀은 3D 그대로 — 여기서 '' 를 돌려주면 옛 경로가 그대로 산다.
//   ⚠ 그림은 4×2 칸(비율 2:1)에 맞춰 뽑았다(실측 320×151). 비율이 크게 다른 그림으로 갈면
//     구역 사각형과 그림 발치가 어긋난다 — 바꿀 때 화면에서 다시 잴 것.
function campGasSprite(){
  if(!_campOn) return '';
  return 'assets/props/gas/stage1.webp';
}
function campMineSprite(m, i){
  if(!_campOn) return '';                                   // ⛔ 관리자 탭·오토배틀은 3D 그대로
  const k = CAMP_MINE_SPRITE[i % CAMP_MINE_SPRITE.length];
  return 'assets/props/mineral/stage' + k + '.webp';
}
// ⭐ 미네랄 덩어리는 **칸 중심에 점으로** 앉는다(transform: translate(-50%,-50%)).
//   그래서 시각 중심은 `c0 + (COLS-1)/2` 이지 `c0 + COLS/2` 가 **아니다** — 반 칸 차이다.
//   ⛔ 가스를 미네랄 「가장자리」 기준으로 놓으면 좌우가 한 칸 어긋난다 — 실측으로 그랬다
//      (미네랄 중심에서 왼 51px / 오른 64px · 정확히 한 칸 13px).
//      가스 구역은 **사각형**이라 중심이 `c0 + w/2` 다. 그 두 중심을 맞춘다.
// ⚠ 가스는 **본부 양옆**이다(2026-08-31 사용자 확정). 광맥 옆이 아니라 한 줄 위다.
//   본부 반폭(4/2 = 2칸) + 가스 반폭(4/2 = 2칸) = 4 가 안 겹치는 최소 — 한 칸 띄운다.
const CAMP_GAS_GAP = 5;   // 가로 중심 ↔ 가스 구역 중심 사이 칸 수(좌우 같다)
function campMineMidCol(){ return campMineCol() + (CAMP_MINE_COLS - 1) / 2; }
function campLayMinerals(){
  if(typeof G === 'undefined' || !G.tech) return;
  const cw = _techCW(), ch = _techCH();
  const x0 = TECH_GRID.x0 + campMineCol() * cw;   // 가로 가운데(가스와 같은 문으로 계산)
  const y0 = campRowY(CAMP_ROW_MINE);
  G.tech.minerals = [];
  // 🏹 가운데가 처진 호 — t 는 -1(왼끝) ~ +1(오른끝), 가운데에서 가장 깊다.
  //   ⛔ 칸(행)으로 계단을 만들지 말 것 — 일곱이 계단처럼 꺾여 보인다. 연속 좌표로 부드럽게.
  const _last = Math.max(1, CAMP_MINE_COLS - 1);
  const _mid = _last / 2;                       // 줄의 가운데(칸 단위) — 벌리기의 축
  for(let r = 0; r < CAMP_MINE_ROWS; r++) for(let c = 0; c < CAMP_MINE_COLS; c++)
    G.tech.minerals.push({ eid:G.tech.eseq++,
      // ⭐ 가운데를 축으로 벌린다 — x0 기준으로 곱하면 줄이 통째로 오른쪽으로 밀린다.
      x: x0 + (_mid + (c - _mid) * CAMP_MINE_GAP) * cw,
      y: y0 + (r + (1 - Math.pow(c / _last * 2 - 1, 2)) * CAMP_MINE_ARC) * ch,
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
  // 🪞 좌우 대칭 — 미네랄 **시각 중심**에서 같은 거리에 놓는다(위 campMineMidCol 설명)
  const mid = campMineMidCol(), half = TECH_GAS.w / 2;
  TECH_GAS.c0  = Math.max(0, Math.round(mid - CAMP_GAS_GAP - half));                       // 왼쪽
  CAMP_GAS2.c0 = Math.min(techCols() - TECH_GAS.w, Math.round(mid + CAMP_GAS_GAP - half)); // 오른쪽
  // ⛽ 가스는 **본부와 같은 높이**다 — 구역 높이(h)의 절반만큼 올려 본부 중심에 맞춘다.
  //   ⛔ 광맥 행으로 되돌리지 말 것 — 광맥이 한 줄 일곱 칸으로 넓어져 그 옆에는 자리가 없다.
  TECH_GAS.r0 = Math.max(0, campRow(CAMP_ROW_BASE) - Math.round(TECH_GAS.h / 2));
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
      // ⛔ 오른쪽 3D 가스 노드(gz_res2)는 더 얹지 않는다 — 캠프 가스는 **그림**이다(2026-08-31).
      //   얹으면 그림 위에 3D 덩어리가 겹쳐 오른쪽만 커 보인다(실측 프레임으로 확인).
      //   ⚠ 자리 계산(CAMP_GAS2.c0)과 campGas2Built() 는 그대로 살아 있다 — 오른쪽 DOM 이 그것을 쓴다.
      if(false && _campOn && Array.isArray(list) && !campGas2Built()){
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
  if(!el){ el = document.createElement('div'); el.id = 'campGas2'; host.appendChild(el); }
  // 🧩 **왼쪽 것을 그대로 복제한다**(CLAUDE.md 「재구현·복사 금지」).
  //   손으로 라벨만 베껴 뒀더니 왼쪽에만 💨 아이콘이 있고 오른쪽엔 없어 좌우가 달라 보였다.
  //   ⛔ 여기서 마크업을 다시 쓰지 말 것 — 왼쪽 렌더러가 바뀌면 오른쪽이 저절로 따라와야 한다.
  const left = document.querySelector('#cstMain .bmap .bGasZone');
  // ⚠ 'hot'(배치 중 강조)만 뺀다. 예전엔 정규식으로 지웠는데 \b 가 **백스페이스 문자로**
  //   박혀 있어(/\x08hot\x08/) 한 번도 안 맞았다 — 오른쪽이 왼쪽을 따라 같이 강조됐다.
  el.className = left ? left.className.split(' ').filter(function(c){ return c && c !== 'hot'; }).join(' ')
                      : 'bGasZone';
  { const html = left ? left.innerHTML : '<span class="gzLbl">에너지 광산</span>';
    if(el._campHtml !== html){ el._campHtml = html; el.innerHTML = html; } }
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

// 🌟 새로운 시작 — root 를 산 뒤로는 **회차마다** 빈손이 아니게 시작한다.
//   ⭐ 여기가 그 자리다: 위 초기화가 「시작 미네랄 0 · 일꾼 0」을 만들고, 그 **다음에** 얹는다.
//     (옛 주석이 「startMin 이 구현되면 여기에 더한다」고 표시해 둔 자리 그대로다.)
//   ⚠ **새 판일 때만** 부른다. 저장분을 복원한 판에 얹으면 캠프를 열 때마다 자원이 불어난다.
//   ⛔ 여기서 배수를 곱하지 말 것 — 새로운 시작은 절대값이라 후반에 저절로 희석되는 것이 설계다.
function campRootGrant(){
  if(typeof G === 'undefined' || !G.tech || !campRtRootOn()) return null;
  const got = { min:0, wk:0, bld:null };
  G.tech.credit = (G.tech.credit || 0) + CAMP_ROOT_MIN;
  got.min = CAMP_ROOT_MIN;
  // 👷 일꾼 — 광맥 위에 나란히. 좌표는 campLayBase 의 첫 일꾼 자리를 기준으로 옆으로 벌린다.
  const cw = (typeof _techCW === 'function') ? _techCW() : 0.02;
  const ch = (typeof _techCH === 'function') ? _techCH() : 0.02;
  const y0 = (typeof campRowY === 'function') ? campRowY(CAMP_ROW_MINE) - ch : 0.62;
  for(let i = 0; i < CAMP_ROOT_WK; i++){
    G.tech.ents.push({ eid:G.tech.eseq++, type:'worker', x: 0.5 + (i - 1) * cw * 2, y: y0 });
    got.wk++; }
  // 🏛 건물 — 이미 지어진 상태로 선다(bt:0). 테크도 함께 열어야 유닛 카드가 나온다.
  const race = G.tech.race;
  const B = !CAMP_ROOT_BLD ? null
    : (typeof TECH_TREE !== 'undefined' && TECH_TREE[race] && TECH_TREE[race].buildings || [])
      .find(function(x){ return x.k === CAMP_ROOT_BLD; });
  if(B && typeof _techFoot === 'function' && typeof _techSnap === 'function' && !G.tech.built[B.k]){
    const f = _techFoot(race, B.k);
    const sn = _techSnap(0.5 + cw * 5, campRowY(CAMP_ROW_BASE), f.w, f.h);
    G.tech.ents.push({ eid:G.tech.eseq++, type:'bldg', bk:B.k, x:sn.cx, y:sn.cy, bt:0 });
    G.tech.built[B.k] = 1;
    if(typeof _techAddSupCap === 'function') _techAddSupCap(B.supply || 0);
    got.bld = B.name || B.k; }
  return got;
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
    // 🧹 **빌린 것은 보이는 상태로 되돌려 놓고 시작한다**(CLAUDE.md 「잔상 금지」).
    //   앞 화면이 style.display='none' 로 꺼 두면(renderEmptySlot·strikeHideNemoChrome·setModel3d)
    //   캠프에서도 꺼진 채다 — 3D 건물이 안 보이고, **진입 줌 애니도 안 돈다**
    //   (display:none 요소에는 CSS 애니메이션이 안 걸린다 — 실제로 그렇게 깨졌다).
    //   ⚠ 3D 를 끈 설정(G.opt.model3d===false)은 존중한다.
    if(!(typeof G !== 'undefined' && G && G.opt && G.opt.model3d === false)) mc.style.display = '';
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
  campUnpatchProduce(); campUnpatchArm();                  // 상한 문지기 원복
  campUnpatchFinish();                                     // 🏭 생산 완료 원복(공유 함수다)
  campUnpatchFront();                                      // 🏢 표적 선택 원복(오토배틀이 같은 함수를 쓴다)
  // 🔬 연구 구역 원복 — ⛔ **이것만 빠져 있었다**(2026-08-31). 나머지 9개는 전부 여기서 되돌리는데
  //   이 하나가 없어 techPanelRender·renderCampIdleSheet 래퍼가 영영 남았다.
  //   ⚠ 지금은 래퍼가 campIsOn() 으로 스스로 빠져서 무해하지만, 그 가드를 지우는 순간
  //     **관리자 건설 탭이 캠프 연구 카드로 오염된다.** 규약을 맞춰 둔다.
  if(typeof campUnpatchResearch === 'function') campUnpatchResearch();
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
  //    ⚠ 환생 트리 「시작 미네랄」(startMin)은 **아직 미배선**이다 — 노드 정의만 있다.
  if(!had) G.tech.credit = 0;
  // 🌟 새로운 시작 — 가운데(root)를 샀으면 빈손이 아니게 시작한다. **새 판일 때만** 얹는다.
  if(!had) campRootGrant();
  campPatchProduce(); campPatchArm();                  // 일꾼 40기 · 보급소 24채 문지기
  campPatchFinish();                                   // 🏭 생산 완료 → 전장에 바로(유닛은 한 번만 태어난다)
  // ⛽ **정제소 카드는 연구 구역 「자원」 칸이 갖는다**(2026-08-27 · js/20-camp-research.js).
  //   건물을 골라야만 올릴 수 있어서 자원 성장 셋 중 하나만 자리가 달랐다.
  //   ⚠ 뺐을 때 스모크 넷이 깨져 한 번 되돌렸는데, 재 보니 **연쇄가 아니라 테스트 간 오염**이었다:
  //     카드를 검사하던 두 step 이 실패로 중간에 끊기면서 정리를 못 해 뒤 step 들이 넘어졌다.
  //     같은 조건을 프로브로 직접 재현했더니 격자·시트·광맥·일꾼이 **완전히 같았다**
  //     (카드 유무 둘 다 rows 81 · 광맥 y 0.6836 · 60초에 256 획득).
  //   ⛔ campPatchRefinery·CAMP_REF_RES 는 지우지 않았다 — 되살릴 땐 이 줄을 되돌린다(유보 규칙).
  //   campPatchRefinery();
  campPatchResearch();                                 // 🔬 연구 구역이 시트를 쓸 차례를 가로챈다
  campPatchFront();                                    // 🏢 적이 내 건물을 때릴 수 있게(패배 = 건물 전멸)
  campShowView();                                      // ④
  // ⭐ **격자 패치를 격자 계산보다 먼저 건다.** techCols() 감싸기(20→48칸)가 여기 들어 있고,
  //   그 뒤로 _techCW()·_techCH()·_techRows() 값이 전부 달라진다.
  //   ⛔ 늦게 걸면 앞뒤 계산이 서로 다른 격자를 본다 — 실측: 가스는 20칸 격자로,
  //     광맥은 48칸 격자로 앉아 두 줄이 30행이나 어긋났다(가스 0.56 vs 광맥 0.86).
  campPatchZoom();
  const got = campSettleAway();                        // ⑤ 자리 비운 동안 번 것
  if(got > 0 && typeof toast === 'function') toast('💠 자리를 비운 동안 미네랄 ' + got);
  _campT0 = Date.now(); _campC0 = G.tech.credit || 0; _campE0 = G.tech.energy || 0;  // 수급 속도 측정 시작점
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
  campCalcViewBot();                                   // ✂ 화면 아래 끝을 배치에서 잰다(반드시 광맥·가스 뒤)
  campFlushPend();                                     // 💠 상점에서 산 재화 — 판이 선 뒤에 넣는다
  campZoom();                                          // 🔍 전체가 한눈에 들어오게
  campSkin();                                          // 🎨 바닥을 사냥터 던전 배경으로
  campStartFrame();                                    // ▶ 캠프 자기 루프(유즈맵 루프는 HOME 에서 멈춘다)
  if(typeof updateCurBar === 'function') updateCurBar();   // 재화 바를 캠프 값으로 즉시 갱신
  campAutoGather();                                    // ⑥ 놀고 있는 일꾼을 광맥에 붙인다(즉시 1회)
  campStartTimer();
  if(typeof techUIRender === 'function') techUIRender();
  campMineBtnPaint();                                  // ⛏ 채굴 모드 버튼
  campAutoSave(true);
}
// 이번 체류에서 **실제로 번 것**을 재 둔다 — 자리 비움 정산이 이 속도를 쓴다.
let _campT0 = 0, _campC0 = 0, _campE0 = 0;
function campNoteStay(){
  if(!_campT0 || typeof G === 'undefined' || !G.tech) return;
  const secs = (Date.now() - _campT0) / 1000, gained = (G.tech.credit || 0) - _campC0;
  if(secs >= 5 && gained > 0) campNoteRate(gained, secs);   // 5초 미만은 표본이 안 된다
  // ⏱ 이 회차에 실제로 **논 시간**을 쌓는다 — 상점이 「n 시간치」를 팔지 말지 여기서 가른다.
  //   ⛔ 실측(2026-08-31)으로 드러난 것: 20분 플레이 시점에 「8시간치」는 그때 부의 **23.8배**,
  //     「24시간치」는 **71.4배**였다. 40분 벤치에서 대조군 D1R19·70.9만 이 각각 D1R25·1450만,
  //     D1R35·4263만 이 됐다 — **한 회차를 통째로 건너뛴다.**
  //   ⇒ 플레이한 시간보다 긴 시간치는 팔지 않는다(campPlayS 가 그 자[尺]다).
  { const C = campState(); if(C && secs > 0) C.playS = (C.playS || 0) + secs; }
  // ⛽ 가스도 같은 방식으로 잰다 — 상점의 「n시간치 가스」가 이 값을 쓴다.
  //   ⚠ 미네랄과 **따로** 재야 한다. CAMP_GAS_RATE(환산비)로 미루어 짐작하면
  //     정제소를 안 지었을 때도 가스가 나오는 것처럼 보인다.
  { const gg = (G.tech.energy || 0) - _campE0;
    if(secs >= 5 && gg > 0) campNoteRate(gg, secs, 'gas'); }
  _campT0 = 0;
}
// ⚠ **캠프가 켜져 있을 때만 저장한다.** showAppScreen() 이 화면을 옮길 때마다 이걸 부르는데,
//   관리자 건설 탭이나 오토배틀에서 온 경우 G.tech 는 그쪽 판이다. 무턱대고 저장하면
//   남의 판을 캠프 저장에 덮어써 기지가 통째로 바뀐다.
function campExit(){ if(!_campOn) return;
  _campHidden = false;      // 🔌 숨김 표시를 되돌린다(다음 진입의 campOnShow 가 헛돌지 않게)
  campMineModeSet(false);   // ⛏ 채굴 모드는 캠프 밖으로 들고 나가지 않는다
  campBattleClose();   // 🧹 전장은 화면을 떠날 때 지운다(공용 STK 를 빌려 쓴 것이라 남기면 샌다)
  campBarReset();      // 🧹 배지 캐시도 비운다(다음 진입에서 옛 값이 남지 않게)
  campNoteStay();                                      // 이번 체류의 수급 속도를 재고
  const C = campState(); if(C) C.leftAt = Date.now();  // 나간 시각을 남긴다(다음 진입에 정산)
  campStopTimer(); campStopFrame();
  campSave(); campHideView(); }
function campIsOn(){ return _campOn; }

// ══ 🔌 앱이 숨거나 꺼질 때 — campExit 이 **안 불리는 경로** (2026-08-31) ═══════
//   ⛔ 예전엔 나간 시각(leftAt)을 campExit 에서만 찍었다. 그런데 모바일에서 앱을 스와이프로
//     닫거나 홈으로 나가면 campExit 이 안 불린다 — 그게 가장 흔한 이탈 경로다. 결과:
//       · 자리 비움 보상이 **0**(leftAt 이 안 찍혀 campSettleAway 가 그냥 빠진다)
//       · 마지막 자동 저장(30초 주기) 이후의 진행이 **날아간다**
//   ⭐ 프로젝트에 이미 같은 규약이 있다 — 12-appshell.js 의 `pagehide → saveRun` ·
//     `visibilitychange → profStampSeen`. 캠프만 빠져 있었다.
//   ⚠ 숨는 동안 수입은 거의 0 이다(rAF 가 멈춰 일꾼이 안 캔다). 그래서 그 시간은
//     **자리 비움 정산**으로 돌려주는 것이 맞다 — 여기서 leftAt 을 찍는 이유가 그것이다.
let _campHidden = false;
function campOnHide(){
  if(!_campOn || _campHidden) return 0;     // ⚠ visibilitychange 와 pagehide 가 잇달아 온다
  _campHidden = true;
  campNoteStay();                            // 이번 체류의 수급 속도·논 시간을 기록
  const C = campState(); if(C) C.leftAt = Date.now();
  campSave();
  return 1; }
function campOnShow(){
  if(!_campOn || !_campHidden) return 0;
  _campHidden = false;
  const got = campSettleAway();              // 숨어 있던 동안을 정산
  if(got > 0 && typeof toast === 'function') toast('💠 자리를 비운 동안 미네랄 ' + got);
  // ⚠ **정산한 뒤에 기준점을 다시 잡는다.** 안 그러면 campApplyGatherMul 이 그 보상을
  //   「일꾼이 캔 것」으로 보고 채취 배수를 한 번 더 먹인다(campEnter 도 같은 순서다).
  if(typeof G !== 'undefined' && G.tech){
    _campT0 = Date.now(); _campC0 = G.tech.credit || 0; _campE0 = G.tech.energy || 0;
    _campLastCr = G.tech.credit || 0; _campTapAcc = 0; }
  _campLastDraw = 0; _campLastT = 0;          // 프레임 기준 시각도 새로 잡는다(숨은 동안이 dt 로 들어오지 않게)
  return got; }
if(typeof document !== 'undefined' && typeof window !== 'undefined'){
  document.addEventListener('visibilitychange', function(){
    try{ if(document.hidden) campOnHide(); else campOnShow(); }catch(e){} });
  // ⚠ pagehide 는 visibilitychange 가 **안 오는** 경로(앱 종료·탭 정리)를 맡는다.
  window.addEventListener('pagehide', function(){ try{ campOnHide(); }catch(e){} });
}
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
  // ⚡ 검은 판이 **실제로 한 프레임 그려진 뒤에** 캠프를 세운다(2026-08-27).
  //   캠프 화면을 처음 세우는 일은 메인 스레드를 230ms 잡는다(실기 GPU 에서도 그렇다 —
  //   longtask 로 확인. 배경·3D 어느 하나가 아니라 전체에 퍼져 있어 걷어낼 수가 없다).
  //   같은 태스크에서 부르면 그 정지가 **페이드아웃이 시작되기도 전에** 와서, 버튼을 누르고
  //   0.56 초 동안 아무 반응이 없다. 검은 판을 먼저 그려 두면 0.1 초 만에 어두워지기 시작하고
  //   정지는 어두워지는 중에 묻힌다.
  //   ⛔ rAF **한 번**으로는 안 된다 — 그 콜백은 같은 렌더 직전에 돌아 결국 한 프레임에 합쳐진다.
  //      setTimeout(0) 도 마찬가지다(렌더 전에 실행된다). 실측으로 둘 다 효과가 없었다.
  //   ⛔ 더 미루지도 말 것 — black.then(0.7초)까지 미뤘더니 캠프 상태를 바로 쓰는 스모크가 6 개 깨졌다.
  if(black) requestAnimationFrame(function(){ requestAnimationFrame(campEnter); });
  else campEnter();
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
  // ✂ 확대가 하단 네비 자리를 넘지 않게 — 애니메이션 동안만 화면을 잘라 둔다(css 「campInClip」)
  const hs = document.getElementById('homeScreen');
  if(hs){ hs.classList.add('campInClip');
    clearTimeout(hs._campClipT);
    hs._campClipT = setTimeout(function(){ hs.classList.remove('campInClip'); },
      _campMs('--campInDur', 2.3) + 400); }
  const ms = _campMs('--campInDur', 2.3);
  for(const e of els){ if(!e) continue;
    // ⛔ display:none 요소에는 CSS 애니메이션이 **안 걸린다.** 공용 3D 캔버스(#cvMarine)는
    //    프레임 루프(renderBuildTab)가 3D 준비 전이면 꺼 두므로, 여기서 켜 두지 않으면
    //    **맵만 다가오고 3D 는 가만히 있는다**(3D 가 늦게 뜨면 건물이 도중에 뚝 나타난다).
    //    ⚠ 3D 를 끈 설정은 존중한다 — 그땐 어차피 그릴 것이 없다.
    if(!(typeof G !== 'undefined' && G && G.opt && G.opt.model3d === false)) e.style.display = '';
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
const CAMP_GAT_STEP = 0.025;    // ⛔ 옛 값(레벨당 +2.5%) — 지금은 campGatRaw 가 정수로 센다
// ⛏ **탭 강화 비용은 「필요한 탭 수」로 설계한다** (2026-09-02 사용자 확정)
//   ⛔ 옛 값은 첫 강화가 **70** 이었다 — 탭당 1원이니 **70번을 눌러야** 첫 성장이 왔다.
//     게임을 처음 켠 사람에게 그 구간은 너무 길다. 던전 0(캠프)은 튜토리얼 자리다.
//   ⭐ 그래서 값이 아니라 **횟수**를 먼저 정했다: 10탭 → 15탭 → 20탭 → 25탭 …(5씩)
//     Lv n 을 살 시점의 탭당 획득은 n 이므로  비용 = (5n+5) × n = **5n(n+1)**.
//       Lv1 10(10탭) · Lv2 30(15탭) · Lv3 60(20탭) · Lv4 100(25탭) · Lv5 150(30탭)
//   ⚠ 이것은 **2차식**이라 지수보다 완만하다. 후반까지 이대로 두면 탭이 공짜가 된다 —
//     무릎(CAMP_COST_KNEE) 부터는 지수로 넘어간다. 후반 밸런스는 아직 안 쟀다(2026-09-02).
const CAMP_TAP_COSTK = 5;       // 탭 비용 = 필요탭수 × 그때 탭당 · 필요탭수 = 5n+5
// ⛏ **탭 마일스톤** (2026-09-02 사용자 확정) — 여기를 지나면 **레벨당 증가폭이 2배**가 된다.
//   1 → 2 → 4 → 8 → 16 → 32 → 64
//   ⭐ Lv10 을 사면 탭당 **10 → 12**(+2) · Lv25 는 40 → 44(+4) · Lv50 은 140 → 148(+8) …
//   ⚠ 증가폭을 **더하기(+1)로** 두는 안도 검토했는데, 그러면 Lv1000 에서 +7 이 전체의 0.1% 라
//     **마일스톤이 시시해진다**(5,125탭을 눌러 도달했는데 아무것도 안 바뀐 느낌).
//     배로 키우면 끝까지 「확 뛴다」가 유지된다 — Lv1000 탭당 5,315 → **2.3만**.
//   ⚠ 마일스톤 레벨은 **사는 것도 비싸다**: 필요 탭이 +20 붙는다(Lv10 은 55 → **75탭**).
//     성능이 뛰는 자리는 관문이기도 해야 한다.
const CAMP_TAP_MILES = [10, 25, 50, 100, 500, 1000];
// Lv 에서의 **기본** 탭당(배수 제외) — 구간마다 증가폭이 다르므로 구간별로 한 번에 더한다.
//   ⛔ 레벨 하나씩 도는 루프를 쓰지 말 것 — Lv 가 수천이 되면 프레임마다 그만큼 돈다.
function campTapRaw(lv){
  let v = CAMP_TAP_BASE, step = CAMP_TAP_STEP, from = 1, mi = 0;
  const ms = CAMP_TAP_MILES.concat([Infinity]);
  while(from <= lv){
    const m = ms[mi];
    if(from >= m){ step *= 2; mi++; continue; }
    const to = Math.min(lv, m - 1);
    v += step * (to - from + 1);
    from = to + 1;
  }
  return v;
}
// Lv n 을 사는 데 필요한 탭 수 — 5씩 늘고, 마일스톤에서 +20
function campTapNeedTaps(n){
  let t = 5 * n + 5;
  for(const m of CAMP_TAP_MILES) if(n >= m) t += 20;
  return t;
}
// ⛏ **채취도 배율이 아니라 「실제 수」다** (2026-09-02 사용자 확정)
//   기본 일꾼은 왕복 1회에 **1원**, 강화하면 2원·3원 … 탭과 **같은 곡선**을 쓴다
//   (마일스톤 10·25·50·100·500·1000 에서 증가폭이 2배 · Lv10 은 10 → 12).
//   ⛔ 옛 방식은 「레벨당 +2.5% × campMileMul」 이었다 — 배율이라 「1원이 2원이 된다」가
//     화면에서 안 읽혔다. 정수로 세면 무엇이 늘었는지 바로 보인다.
//   ⚠ 비용은 **탭보다 훨씬 비싸다**(아래 campGatCost) — 일꾼은 수가 늘고 저절로 캐기 때문이다.
function campGatRaw(lv){ return campTapRaw(lv); }
// 💰 채취 강화 비용 — **50 · 150 · 300 · 500 · 750 …** (2026-09-02 사용자 확정)
//   ⭐ 차이가 100 · 150 · 200 … **50씩** 늘어난다 → 식은 **25n(n+1)**,
//     즉 탭 비용(5n(n+1))의 **정확히 5배**다. 두 축이 같은 꼴이라 견주기 쉽다.
//   ⛔ 앞서 「두 레벨마다 ×10」(50·250·500·2500·5000)을 넣었다가 **Lv10 이 250만**이 되어
//     되돌렸다(2026-09-02) — 탭의 3,300배라 초반에 손도 못 댄다.
function campGatCost(n){ return CAMP_GAT_COST0 * n * (n + 1) / 2; }
const CAMP_GAT_COST0 = 50;      // 채취 0→1레벨 비용(옛 210) — 비용 = 25n(n+1) = COST0·n(n+1)/2
// ⛏ 홀드 간격 단축 — **10레벨이 끝이다**(800 → 300ms · CAMP_HOLD_MIN).
//   ⭐ 끝이 있는 축이라 계단을 가파르게 둔다 — 끝까지 가는 것 자체가 목표가 되게.
const CAMP_HOLD_COST0 = 500;    // 홀드 0→1레벨 비용
//   ⚠ **함수여야 한다** — CAMP_HOLD_MS0 는 아래 채굴 모드 블록에서 선언된다(const 는 TDZ).
function campHoldLvMax(){ return Math.round((CAMP_HOLD_MS0 - CAMP_HOLD_MIN) / CAMP_HOLD_STEP); }   // = 10
const CAMP_COST_R0 = { tap:1.09, gather:1.12, hold:1.35 };   // 무릎 전 비용 계단
const CAMP_COST_R1 = { tap:1.15, gather:1.20, hold:1.35 };   // 무릎 후(Lv10~)
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
  // ⛏ 탭은 **횟수로 설계한 2차식**이다(위 CAMP_TAP_COSTK 설명) — 무릎까지는 그 식을 그대로 쓰고,
  //    무릎을 넘으면 그때 값을 출발점 삼아 지수로 이어 붙인다(후반이 공짜가 되지 않게).
  if(k === 'tap'){
    // ⭐ 비용은 **「몇 번 눌러야 하는가」로 정의한다**: 필요 탭 수 × 그 시점의 기본 탭당.
    //    그래서 환생·팩 배수가 커지면 실제로 눌러야 하는 횟수가 줄어 성장이 체감된다.
    //    ⛔ 옛 무릎(지수) 분기는 없앴다 — 탭당 자체가 마일스톤으로 계단을 밟으므로 비용도 함께 뛴다.
    const n = lv + 1;                                            // 지금 사려는 레벨
    const c = campTapNeedTaps(n) * campTapRaw(n - 1);
    return Math.max(1, Math.ceil(c * campUpgDisc()));
  }
  if(k === 'gather') return Math.max(1, Math.ceil(campGatCost(lv + 1) * campUpgDisc()));
  const base = CAMP_HOLD_COST0;
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
  // 🌳 트리 — 「탭당 미네랄」·「탭 배수」 둘 다 **곱한다**(2026-09-02 · 전자가 가산에서 배수로 바뀜)
  const lv = campUpgLv('tap');
  // ⛏ 탭은 **제 마일스톤 곡선**을 쓴다(campTapRaw · 증가폭이 2배씩).
  //   ⛔ campMileMul 을 곱하지 말 것 — 그것은 채취(gather)용이고, 여기 곱하면 계단이 두 겹이 된다.
  const base = campTapRaw(lv);
  // 💳 결제 팩 — **탭에도 걸어야 「재화 획득 +N%」가 참말이 된다.**
  //   ⛔ 실측(2026-08-31)으로 드러난 것: 채취에만 걸었더니 배수 1.5/2.5/4.0 인데 실제 수입은
  //     ×1.16 / ×1.46 / ×1.89 뿐이었다. 수입의 **66% 가 탭**인데 거기 안 걸렸기 때문이다.
  //     「재화 획득 +300%」라고 팔면서 실제로는 +89% 였다 — 표기와 실제가 달랐다.
  //   ⚠ 여기서도 **합이다**(곱이 아니다) — campGatherMul 과 같은 규칙(GEM.md §5-2).
  const packA = (typeof campPackGather === 'function') ? campPackGather() : 0;
  return Math.max(1, Math.round(base * (1 + packA)
    * campMineMul() * campRebMul() * campRtMul('tap') * campRtMul('tapMul')));
}
// 일꾼 효율 — **왕복 1회당** 배수(HUNT_R1 §1). Lv0 = 1.0 이라 기준선이 바뀌지 않는다.
// ⚠ 일꾼 **수**로 올리는 축은 따로 산다 — 광맥 cap 을 5로 열어 두었다(CAMP_MINE_CAP).
//   그 전에는 덩이당 1명이라 12기 26.8/초에서 천장이었고 일꾼을 뽑아도 소용이 없었다.
//   지금은 실측 40기 137/초로 일꾼 수에 선형이다(scripts/camp-gather-bench.mjs).
function campGatherMul(){ const C = campState(); if(!C) return 1;
  const lv = campUpgLv('gather');
  // 💳 팩 보너스는 **첫 괄호 안**(합산 항)에 들어간다. ⛔ 곱 항으로 옮기지 말 것 —
  //    곱 항이 하나 더 늘면 지수 축이 늘어 후반이 터진다(위 CAMP_PACKS 설명).
  // ⛏ **정수 곡선**이다(campGatRaw) — 왕복 1회당 1원 → 2원 → 3원 …
  //   ⛔ campMileMul 을 곱하지 말 것 — 계단은 campGatRaw 안에 이미 있다(두 겹이 된다).
  //   💳 팩 보너스는 여기서도 **합**이다(GEM.md §5-2).
  return (campGatRaw(lv) + campPackGather())
    * campMineMul() * campRebMul() * campRtMul('gather'); }
// ══ ⛏ 채굴 모드 (2026-08-27 사용자 확정 · A+F) ═══════════════════════════
// 켜면 **맵 전체가 과녁**이 된다(A). 누르고 있으면 간격마다 저절로 캔다(F).
//   ⭐ 왜 모드인가 — 광맥은 화면의 5% 뿐이라 손끝이 자꾸 일꾼·건물·바닥을 눌렀다.
//     과녁을 화면 전체로 넓히면 그 문제가 통째로 사라진다. 대신 유닛·건물 조작과 겹치므로 모드로 가른다.
//   ⭐ 왜 홀드인가 — 연타는 손이 아프다. 누르고만 있어도 벌 수 있는 길을 둔다(느린 대신 편하다).
const CAMP_TAP_MIN_MS = 90;      // 연타 **상한**(초당 11회) — 사람 손은 여기 거의 안 닿는다
const CAMP_HOLD_MS0   = 800;     // 홀드 간격 0레벨
const CAMP_HOLD_STEP  = 50;      // 레벨당 −50ms
const CAMP_HOLD_MIN   = 300;     // 하한 — 연타(≈초당 6회)보다 느려야 「편한 대신 느린」 선택지가 된다
// ⛏ 홀드 1회의 획득량 배수. **1 = 탭과 같다**(사용자 확정 2026-08-27).
//   ⭐ 「편한 만큼 덜 버는 선택지」가 이 축의 뜻이라, 간격만으로 차이를 낸다 —
//     하한 0.3초 = 실효 초당 3.3탭으로 **연타(≈6탭)의 절반**이다(실측 30분 56만 vs 127만).
//   ⚠ 장치는 살려 둔다 — 나중에 조이거나 풀 자리가 여기 하나여야 한다.
const CAMP_HOLD_MUL   = 1;
function campHoldMs(){
  const lv = (typeof campUpgLv === 'function') ? campUpgLv('hold') : 0;
  return Math.max(CAMP_HOLD_MIN, CAMP_HOLD_MS0 - CAMP_HOLD_STEP * lv); }
let _campMineMode = false;       // 채굴 모드가 켜져 있나
let _campHoldT = null, _campHoldPt = null, _campLastTap = 0;
function campMineModeOn(){ return _campMineMode; }
function campMineModeSet(on){
  _campMineMode = !!on;
  campHoldStop();
  const ph = document.getElementById('phone');
  if(ph) ph.classList.toggle('mineMode', _campMineMode);
  // 🖐 채굴 모드와 화면 이동 모드는 **같이 켤 수 없다** — 한 손가락에 두 뜻을 주지 않는다.
  if(_campMineMode && typeof campPanMode === 'function') campPanMode(false);
  if(typeof playSfx === 'function') playSfx(_campMineMode ? 'ui_open' : 'ui_close');
  campMineBtnPaint();
}
function campMineModeToggle(){ campMineModeSet(!_campMineMode); }
// 한 번 캔다 — 맵 어디서 눌렀든 같다(모드가 켜져 있을 때만 불린다).
//   ⛔ 획득량 수식을 여기서 만들지 말 것 — campTapGain 하나가 단일 소스다.
function campMineOnce(clientX, clientY, human, mul){
  if(typeof G === 'undefined' || !G.tech) return 0;
  let gain = ((typeof campTapGain === 'function') ? campTapGain() : 1) * (mul || 1);
  // 🤖 2차 방어선은 그대로 둔다 — 상한만으로는 매크로가 사람의 2배를 번다(설계 대화 2026-08-27).
  if(human && typeof campTapHuman === 'function')
    gain = Math.max(1, Math.floor(gain * campTapHuman(clientX, clientY)));
  G.tech.credit = (G.tech.credit || 0) + gain;
  _campTapEarn += gain;                             // 📊 표시용(경제와 무관)
  const C = campState(); if(C) C.tapped = (C.tapped || 0) + 1;
  if(typeof updateCurBar === 'function') updateCurBar();
  campMineFloatMap(gain, clientX, clientY);
  if(typeof dqNote === 'function') try{ dqNote('tap', 1); }catch(e){}
  return gain;
}
// 캔 만큼 숫자가 **누른 자리에서** 튀어오른다 — 눌렀다는 것이 눈으로 돌아오는 유일한 신호다.
function campMineFloatMap(n, clientX, clientY){
  const host = document.getElementById('cstMain'); if(!host) return;
  const r = host.getBoundingClientRect();
  const el = document.createElement('i'); el.className = 'cmPop mapPop';
  el.textContent = '+' + ((typeof campNum === 'function') ? campNum(n) : n);
  el.style.left = Math.max(6, Math.min(r.width - 6, (clientX || r.width/2) - r.left)) + 'px';
  el.style.top  = Math.max(6, Math.min(r.height - 6, (clientY || r.height/2) - r.top)) + 'px';
  host.appendChild(el);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 900);
}
// ⏱ 홀드 — 누르고 있는 동안 간격마다 한 번. 손을 떼면 멈춘다.
function campHoldStart(clientX, clientY, pid){
  campHoldStop();
  // ⚠ 어느 손가락이 누르고 있는지 기억한다 — 두 손가락이 오면 그때 멈추기 위해서다.
  //   fired = **자동 채굴이 한 번이라도 돌았나.** 그 전과 후로 손가락 이동의 뜻이 갈린다.
  _campHoldPt = { x: clientX, y: clientY, id: (pid==null ? null : pid), fired: false };
  _campHoldT = setInterval(function(){
    if(!_campMineMode || !_campOn || !_campHoldPt){ campHoldStop(); return; }
    // ⚠ 홀드는 **손가락이 멈춰 있는 것이 정상**이다 — 여기서 리듬 감쇠를 재면 늘 기계로 보인다.
    //   그래서 human=false 로 부른다(간격이 고정이라 매크로가 얻을 이득도 없다).
    _campHoldPt.fired = true;   // 여기부터는 손가락이 움직여도 이어서 캔다(아래 pointermove)
    campMineOnce(_campHoldPt.x, _campHoldPt.y, false, CAMP_HOLD_MUL);   // ⛏ 홀드 1회 = 탭 CAMP_HOLD_MUL 회분(지금 1)
  }, campHoldMs());
}
function campHoldStop(){ if(_campHoldT){ clearInterval(_campHoldT); _campHoldT = null; } _campHoldPt = null; }
// ⛏ 모드 버튼은 **「MY BASE」 요약판 안**에 있다(js/20-camp-research.js · 2026-08-27 사용자 확정).
//   ⛔ 맵 위에 띄우지 말 것 — 늘 보여서 화면을 가린다. 요약판은 아무것도 안 골랐을 때만 뜨는 자리다.
function campMineBtnPaint(){
  const b = document.getElementById('campMineBtn');
  if(b && b.parentNode) b.parentNode.removeChild(b);   // 옛 버튼이 남아 있으면 걷는다
  // 요약판을 다시 그리게 한다 — 서명만 보면 모드 변화를 못 잡는다
  const body = document.getElementById('btSheetBody');
  if(body) body._gSig = null;
  if(typeof renderCampIdleSheet === 'function' && !(typeof _resSec !== 'undefined' && _resSec)) renderCampIdleSheet();
}

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
  _campTapEarn += gain;                             // 📊 표시용(경제와 무관)
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
    // ⛏ **채굴 모드면 맵 어디를 눌러도 캔다**(2026-08-27 · A안). 광맥을 겨냥할 필요가 없다.
    if(_campMineMode){
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      // 🤖 연타 **상한** — 사람 손(초당 5~8회)은 여기 거의 안 닿고, 매크로의 폭주만 잘린다.
      //   ⛔ 이것만으로 막힌다고 보지 말 것: 0.09초여도 기계는 초당 11회다(사람의 약 2배).
      //     실제로 가르는 것은 2차 감쇠(campTapHuman)다 — 벽에 붙은 리듬은 완벽히 일정해서 더 잘 걸린다.
      if(now - _campLastTap >= CAMP_TAP_MIN_MS){
        _campLastTap = now;
        campMineOnce(ev.clientX, ev.clientY, ev.isTrusted !== false);
      }
      campHoldStart(ev.clientX, ev.clientY, ev.pointerId);   // ⏱ 누르고 있으면 이어서 캔다
      ev.stopPropagation(); if(ev.preventDefault) ev.preventDefault();
      return;
    }
    // 💎 모드가 꺼져 있을 때 광맥을 누르면 **채굴 모드를 켜 준다** — 옛 팝업을 여는 자리였다.
    //   ⛔ openCampMine 은 지우지 않았다(업그레이드는 연구 구역으로 갔다 · 유보 규칙).
    if(campMineHit(ev.clientX, ev.clientY)){
      campPanMode(false);   // 🖐 광맥을 눌렀다 = '조작'이다(빈 바닥 탭·유닛/건물 탭과 같은 규칙)
      campMineModeSet(true);
      ev.stopPropagation(); if(ev.preventDefault) ev.preventDefault(); }
  }, true);
  // ⏱ 손을 떼면 홀드를 멈춘다 — 창 밖으로 나가거나 취소돼도 마찬가지다.
  for(const t of ['pointerup','pointercancel','pointerleave','blur'])
    document.addEventListener(t, function(){ campHoldStop(); }, true);
  // 🖐 손가락 이동의 뜻은 **자동 채굴이 시작됐는가**로 갈린다(2026-09-01 사용자 확정).
  //   ① 시작 전(아직 한 번도 안 캠) — 누르자마자 미는 것은 **화면 이동이나 다른 조작**일 수 있다.
  //      그래서 크게 움직이면 홀드를 접는다.
  //   ② 시작 후 — 이미 「가만히 눌러 캐는 중」이라는 뜻이 섰다. 이제는 움직여도 **따라가며** 캔다.
  //      ⛔ 여기서 다시 끊지 말 것 — 손끝이 조금만 흔들려도 수급이 뚝 끊겼다.
  document.addEventListener('pointermove', function(ev){
    if(!_campHoldPt) return;
    if(_campHoldPt.id != null && ev.pointerId !== _campHoldPt.id) return;   // 다른 손가락의 움직임은 무시
    if(!_campHoldPt.fired){
      if(Math.hypot(ev.clientX - _campHoldPt.x, ev.clientY - _campHoldPt.y) > 24) campHoldStop();
      return; }
    _campHoldPt.x = ev.clientX; _campHoldPt.y = ev.clientY;
  }, true);
  // 🤏 두 번째 손가락이 내려오면 = 확대·축소다. 그동안 캐면 손대지 않은 돈이 오른다.
  document.addEventListener('pointerdown', function(ev){
    if(_campHoldPt && _campHoldPt.id != null && ev.pointerId !== _campHoldPt.id) campHoldStop();
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
  // ⛏ 홀드는 **끝이 있는 축이다** — 하한(CAMP_HOLD_MIN)에 닿으면 더 팔지 않는다.
  if(k === 'hold' && campUpgLv('hold') >= campHoldLvMax()) return false;
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
  _campTapEarn += gain;                             // 📊 표시용(경제와 무관)
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
function campNoteRate(gained, secs, kind){
  const C = campState(); if(!C || !(secs > 0)) return;
  const k = (kind === 'gas') ? 'rateGas' : 'rate';
  const r = gained / secs;
  C[k] = (C[k] > 0) ? (C[k] * 0.7 + r * 0.3) : r;   // EMA — 한 판의 운에 휘둘리지 않게
}

// ── 💠 「n 시간치」 — 상점이 파는 단위 ───────────────────────────────────
// ⭐ **고정 숫자를 팔지 않는다**(2026-08-31 사용자 확정). 회차가 돌면 수입이 몇 배씩 뛰어
//   「미네랄 5만」 같은 값이 곧 무의미해진다. 대신 **지금 내 수입의 30분치·24시간치**를 판다.
// ⭐ 속도는 **이미 재고 있던 것을 그대로 쓴다**(campNoteRate) — 자리 비움 정산이 쓰는 그 값이다.
//   ⛔ "일꾼 n기 × 초당 k" 같은 식을 새로 만들지 말 것. 두 벌이 되면 반드시 어긋난다.
// ⚠ 캠프에 5초 이상 머문 적이 없으면 0 이다 — 그때는 팔지 않는다(화면이 안내한다).
// 이 회차에 논 시간(초). 상점의 「n 시간치」 상한이자, 「아직 못 산다」의 이유다.
function campPlayS(){ const C = campState(); return (C && C.playS > 0) ? C.playS : 0; }
function campRateOf(kind){ const C = campState(); if(!C) return 0;
  const v = (kind === 'gas') ? C.rateGas : C.rate;
  return (v > 0) ? v : 0; }
// 보기 좋게 — **유효숫자 두 자리**로 반올림한다(1,234,567 → 1,200,000 → 「120.0만」).
//   딱 떨어지는 수가 아니면 「이만큼 준다」가 눈에 안 들어온다.
function campRoundNice(n){
  n = Math.floor(n || 0); if(n <= 0) return 0;
  if(n < 100) return n;
  const d = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / d) * d; }
// secs 초치 = 지금 속도 × secs, 보기 좋게 반올림한 값
function campTimeAmt(secs, kind){ const r = campRateOf(kind);
  return (r > 0) ? campRoundNice(r * secs) : 0; }
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
// 📊 **표시 전용** 탭 누적 — 경제용 `_campTapAcc` 와 **따로 둔다.**
//   ⚠ 왜 따로인가: `_campTapAcc` 는 「채취 배수를 안 먹일 몫」이라 경제 계산에 쓰인다.
//     거기에 맵 탭(campMineOnce)을 끼워 넣으면 **획득량이 바뀐다**(그 몫이 배수를 못 받게 된다).
//     환생 화면의 「터치로 번 미네랄」은 표시일 뿐이라 경제를 건드리면 안 된다.
//   ⚠ 그래서 맵 탭이 `_campTapAcc` 에 안 들어가는 문제는 **여기서 고치지 않는다**(BALANCE 문제).
let _campTapEarn = 0;
// 📊 **수입 내역** — 번 돈이 어디서 왔는지 나눠 센다(2026-08-30 · sc-3 요청).
//   ⭐ 왜 필요한가: 실측 100만 도달이 **27분**인데 설계 추정은 10시간이다(22배). 설계표(§1-1)를
//     그냥 깎으면 엉뚱한 축을 깎게 된다 — **무엇이 그 돈을 벌었는지** 먼저 봐야 한다.
//   ⚠ 여기가 캠프 수입의 **유일한 관문**이다(C.earn 을 늘리는 곳이 이 함수뿐이다).
//   tap    = 터치 — 배수를 안 먹는다
//   gather = 일꾼이 실제로 캐 온 몫(배수 먹기 전)
//   mul    = 채취 배수로 불어난 몫 ← ⚠ 이것이 크면 §1-1 표에 없는 지수 축이 있다는 뜻이다
const CAMP_INC = { tap:0, gather:0, mul:0 };
function campApplyGatherMul(){
  if(typeof G === 'undefined' || !G.tech) return;
  const cur = G.tech.credit || 0;
  let delta = cur - _campLastCr;
  if(delta > 0){
    const tapPart = Math.min(delta, _campTapAcc);   // 터치 몫은 배수 대상이 아니다
    _campTapAcc -= tapPart; delta -= tapPart;
    CAMP_INC.tap += tapPart;
    const m = campGatherMul();
    if(delta > 0){ CAMP_INC.gather += delta;
      if(m > 1){ const add = Math.round(delta * (m - 1));
        CAMP_INC.mul += add; G.tech.credit = cur + add; } }
  } else if(delta < 0){ _campTapAcc = 0; }          // 건물을 샀다 = 지출. 누적을 흘려보낸다
  // 🔁 환생 기준이 되는 **번 돈**을 여기서 센다 — 배수를 다 먹인 뒤의 실제 증가분이다.
  //    ⛔ 지출은 빼지 않는다. '얼마나 벌었나'가 기준이지 '지금 얼마 있나'가 아니다.
  { const gained = (G.tech.credit || 0) - _campLastCr;
    const C = campState();
    if(gained > 0 && C){ C.earn = (C.earn || 0) + gained;
      // 📊 어디서 번 돈인가 — 환생 화면이 이 둘을 보여 준다.
      //   터치 몫은 이 프레임에 실제로 탭으로 들어온 만큼까지만 인정한다(나머지는 자동).
      const tp = Math.min(gained, _campTapEarn);
      C.earnTap  = (C.earnTap  || 0) + tp;
      C.earnAuto = (C.earnAuto || 0) + (gained - tp); }
    _campTapEarn = 0;   // ⚠ 매 틱 비운다 — 안 비우면 지출이 끼었을 때 다음 틱에 잘못 붙는다
    // ⏱ 이 회차를 얼마나 붙잡고 있었나. 캠프가 켜져 있는 동안만 센다(틱 자체가 _campOn 가드 안이다).
    if(C) C.playS = (C.playS || 0) + CAMP_TICK_MS / 1000; }
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
// 🖐 **손가락으로 미는 동안에는 제한을 푼다** (2026-09-02 사용자 확정).
//   ⚠ 평소 30ms(≈30fps)는 자원이 자라고 유닛이 걷는 화면에는 충분하지만,
//     **화면을 끌 때는 다르다** — 손가락을 따라오는 움직임이 30fps 면 뚝뚝 끊겨 보인다.
//     rAF 는 16.7ms 간격이라 30ms 제한은 사실상 **두 프레임에 한 번**만 그린다는 뜻이다.
//   ⭐ 그래서 「끄는 중」과 「따라오는 중」에만 0 으로 낮춘다. 손을 떼고 보간이 끝나면
//     저절로 30 으로 돌아가므로 평소 부담은 그대로다.
//   ⚠ _btPan·_btPinch 는 17-build-cards.js 의 값이다(같은 전역을 공유한다) —
//     ⛔ 그 파일을 고치지 않는다. 여기서 **읽기만** 한다.
function campFrameMs(){
  try{
    if((typeof _btPan !== 'undefined' && _btPan) || (typeof _btPinch !== 'undefined' && _btPinch)) return 0;
    if(typeof techView === 'function' && typeof techViewT === 'function'){
      const v = techView(), t = techViewT();
      if(v && t && (v.x !== t.x || v.y !== t.y || v.zoom !== t.zoom)) return 0; }
  }catch(_e){}
  return CAMP_FRAME_MS; }
let _campLastDraw = 0;
// 🛟 프레임 예외 복구 — 연속 실패가 이만큼(약 4초)이면 루프를 접는다. 위 campFrame 참고.
const CAMP_ERR_GIVEUP = 120;
let _campErrN = 0;
function campFrame(now){
  if(!_campOn){ _campRAF = 0; return; }
  const t = now || (typeof performance !== 'undefined' ? performance.now() : 0);
  // ⚠ 시계가 **뒤로 가면** 기준을 버린다. rAF 시각은 절대 뒤로 가지 않지만, 테스트는
  //   campFrame 을 가짜 시각으로 직접 부른다 — 앞선 호출이 기준을 먼 미래로 밀어 두면
  //   그 뒤의 모든 프레임이 통째로 스킵된다(실제로 휠·일꾼 검사가 그렇게 죽었다).
  if(t < _campLastDraw) _campLastDraw = 0;
  if(t - _campLastDraw < campFrameMs()){ _campRAF = requestAnimationFrame(campFrame); return; }   // 너무 이르면 건너뛴다(끄는 중이면 안 건너뛴다)
  _campLastDraw = t;
  const dt = Math.min(0.05, Math.max(0, (t - (_campLastT || t)) / 1000));   // ⚠ 건너뛴 시간도 dt 에 담긴다(_campLastT 는 그릴 때만 갱신)
  _campLastT = t;
  // ⚡ **한 프레임 안에서 맵 rect 를 한 번만 잰다.** 아래 campPatchRect 설명 참고.
  _campRectC = null;
  let _ok = false;
  try{
    // 기지 렌더(단일 소스 그대로) — 던전 중이면 전투 유닛을 같은 sync 에 얹어 보낸다
    if(typeof renderBuildTab === 'function') campWithBattleDraw(() => renderBuildTab(dt));
    campCombatStep(dt);                                           // ⚔ 던전 전투(0단계에서는 스스로 빠진다)
    campBarRender();                                              // 🗺 단계·라운드 배지(바뀐 것만 쓴다)
    campDrawGas2();                                               // ⛽ 오른쪽 가스 구역(캠프가 얹는다)
    campGasTick(dt);                                              // ⛽ 정제소 자동 생산
    campSyncHire(); campSyncSupply(); campSyncUnitCost();          // 👷🏠⚔ 일꾼·보급소·전투 유닛 다음 가격(보유 수에 따라)
    campSyncSheet();                                              // 🗂 시트를 늘 띄워 둔다
    _ok = true;
  } catch(err){
    // ⛔ **한 번의 예외로 화면이 영구 정지하면 안 된다** (2026-08-31).
    //   예전엔 재예약(requestAnimationFrame)이 try 밖 **아래**에 있어서, 안에서 예외가 나면
    //   그 줄에 도달을 못 했다 → 캠프가 그대로 굳는다. 그런데 250ms 타이머는 계속 돌아
    //   재화 바 숫자만 올라가서 **살아 있는 것처럼 보였다** — 그게 더 나쁘다.
    // ⚠ **삼키지 않는다.** 비동기로 다시 던져 window.onerror·스모크 pageerror 가 그대로 본다.
    //   ⛔ 매 프레임 던지면 콘솔이 넘치므로 **연속 실패의 첫 번째만** 알린다.
    _campErrN++;
    if(_campErrN === 1 && !(typeof window !== 'undefined' && window.__campErrQuiet))
      setTimeout(function(){ throw err; }, 0);
  } finally { _campRectC = null; }   // ⛔ 프레임 밖으로 캐시를 들고 나가지 않는다(이벤트 핸들러가 낡은 값을 본다)
  if(_ok) _campErrN = 0;
  // ⚠ 계속 실패하면 접는다 — 초당 30번 터지는 화면을 그대로 돌리지 않는다.
  else if(_campErrN >= CAMP_ERR_GIVEUP){
    _campRAF = 0;
    if(typeof toast === 'function') toast('⚠ 화면이 멈췄습니다 — 캠프를 다시 열어 주세요');
    return; }
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
// 🔍 캠프 기본 시점 (2026-08-30 확정 → **2026-08-31 재조정**)
//   ⭐ 1.3 → 1.8 — 유닛이 점처럼 작아 전투가 안 읽혔다. 2.3 부터는 아군 기지가
//     하단 시트에 가려서, 건설도 하는 화면에는 과했다.
//   ⭐ y 0.5 → **0.56** — 확대만 하면 위쪽(적이 오는 곳)이 남고 아래(내 기지)가 잘린다.
//
// ⛔ **1.8 → 1.9** (2026-08-31 · 「건물이 타일에 비해 너무 작다」).
//   화면을 재 보니 **위쪽 60% 가 아무것도 없는 땅**이었고, 본부는 화면 폭의 20% 뿐이었다.
//
// ⚠ **손잡이 둘이 다 막혀 있었다** — 다음에 같은 것을 시도하기 전에 읽을 것.
//   ① **시점(CAMP_VIEW_Y)은 한 칸도 안 움직인다.** 0.56 / 0.62 / 0.68 / 0.74 를 넣어도
//     실제 y 는 전부 **0.557** 이었다. _techClampView 의 상한이 이미 걸려 있다:
//       yHi = _campViewBot − (0.5 − 시트비율) / zoom   → 0.71 − (0.5−0.225)/1.8 = 0.557
//     즉 「광맥 아래 여백이 보이면 안 된다」는 규칙이 시점을 **아래 끝에 붙여 둔다.**
//     ⛔ 시점 값을 올려 빈 땅을 줄이려는 시도는 **아무 효과가 없다.**
//   ② **줌은 1.9 가 한계다.** 2.0 부터 스모크 둘이 깨진다(실측 2026-08-31):
//       · 「배치 확정/취소 버튼이 없다」 — 격자 20행 아래가 **화면 밖**으로 나가 탭이 안 먹는다
//       · 「띠가 재화 바와 겹친다」
//     1.9 는 1.8 보다 **5.6% 클 뿐이라 체감이 거의 없다.**
//
// ⇒ ⭐ **「건물이 작다」는 시점·줌으로 못 푼다.** 남은 길은 둘이다:
//     A 격자 칸 수를 줄여 건물·유닛을 키운다(실험: 48 → 34 면 1.4배 · ⚠ 광맥 배치가 어긋난다)
//     C 광맥·건물을 세로로 펼쳐 빈 땅을 콘텐츠로 채운다
//   ⚠ 줌을 바꾸면 이 y 도 다시 봐야 한다. 확인: SHOT_ZOOM=1.9 SHOT_CY=0.56 node scripts/shot.mjs dgfight
const CAMP_ZOOM = 1.9;
const CAMP_VIEW_Y = 0.56;
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
// ⭐ **축소 하한 1.45** (2026-08-31 사용자 요청 · 「처음 화면이 너무 확대돼 있다」)
//   ⛔ 앞서는 하한 = 기본 배율(1.8) 이었다 — 즉 **축소가 아예 안 됐다.** 「처음 본 화면이 가장 넓은
//     화면이어야 한다」(2026-08-27)는 판단이었는데, 실제로 써 보니 답답하다고 하여 뒤집었다.
//   ⭐ 1.45 → 기본(1.8) 보다 화면이 **1.24배 넓게** 보인다. 기본 시점은 그대로 1.8 이다.
// 🔬 **뚫림 한계는 실측했다**(dgfight 샷 10단계 · 화면의 검은 픽셀 비율):
//     1.8~1.0 = 0.2~0.4%(전부 유닛 그림자 · 맵이 화면 좌우 끝까지 닿음) · **0.85 = 13.8%** · 0.7 = 31.5%
//   → **물리적 하한은 1.0** 이고(옛 주석의 「zoom 1 에서 화면을 덮는다」와 일치), 1.45 는 그보다
//     한참 위라 어떤 팬에서도 밖이 안 보인다. 더 낮추고 싶으면 1.0 까지가 여유다.
//   ⚠ 이 측정에서 자[尺]가 두 번 틀렸다: ① 폰 **바깥 여백**(201,192,172)을 구멍으로 세었다 —
//     그 색은 1.8 에도 똑같이 있다 ② 눈으로 「좌우가 뚫렸다」고 본 것도 같은 착시였다.
//     구멍의 진짜 색은 **검정**이다. 다시 잴 일이 있으면 검정으로 세고, 맵이 닿는 좌우 끝 px 를 함께 찍을 것.
const CAMP_MIN_ZOOM = 1.45;
// ✂ **화면이 내려갈 수 있는 아래 끝**(월드 y) — 미네랄·가스 덩어리 바로 아래에서 멈춘다.
//   그 아래는 아무것도 없는 여백이라, 보이면 「빈 땅이 드러난 화면」이 된다.
//   ⭐ 상수로 박지 않고 **실제 배치에서 잰다** — CAMP_ROW_MINE 이나 광맥 줄 수가 바뀌면 같이 따라간다.
let _campViewBot = null;
const CAMP_VIEW_PAD = 2;   // 덩어리 아래로 남기는 여유(격자 칸 수)
function campCalcViewBot(){
  _campViewBot = null;
  if(typeof G === 'undefined' || !G.tech) return null;
  const ch = _techCH(); let bot = 0;
  for(const m of (G.tech.minerals || [])) if(m && m.y > bot) bot = m.y;
  try{ if(typeof TECH_GAS !== 'undefined')
    bot = Math.max(bot, techY0() + (TECH_GAS.r0 + (TECH_GAS.h || 1)) * ch); }catch(e){}
  if(!bot) return null;
  _campViewBot = bot + ch * CAMP_VIEW_PAD;
  return _campViewBot;
}
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
      // 🤏 **두 손가락은 언제나 확대·축소 + 화면 이동**이다(2026-09-01 사용자 확정).
      //   팬 모드에서도, **유닛을 지정한 채로도** 그대로 잡힌다 — 지정을 풀지 않고 화면만 옮길 수 있다.
      //   ⚠ 한때 이동을 뺐던 적이 있다(확대하려다 화면이 밀린다는 이유). 되살린 이유는
      //     유닛을 지정한 상태에서 화면을 옮길 길이 롱프레스 팬뿐이었고, 그 팬은 빈 바닥에서만
      //     열려서 **지정 중에는 옮길 방법이 없었다**. 두 손가락이 그 자리를 메운다.
      if(_campOn && ev && ev.button !== 1){
        _btPtrs.set(ev.pointerId, { x:ev.clientX, y:ev.clientY });
        if(_btPtrs.size >= 2){
          const r = (typeof _btRect === 'function') ? _btRect() : null;
          if(r){ const p = [..._btPtrs.values()], v = techViewT();
            _btPan = null; _campPanDown = null; campPanDisarm();   // 팬·롱프레스를 접는다
            _btPinch = { d:Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y) || 1, zoom:v.zoom,
                         cx:(p[0].x+p[1].x)/2, cy:(p[0].y+p[1].y)/2, vx:v.x, vy:v.y, rw:r.width, rh:r.height };
            _btMoved = true; return; } }
      }
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
      // 🖐 캠프의 박스 시작점 — 원본 _btBox 는 기지 엔티티용이라 전장 유닛을 못 잡는다
      if(_campOn && CAMPB && campDgN() > 0 && !_btPan && !_btCmd && !_btArm)
        _campBox = { cx0:ev.clientX, cy0:ev.clientY, on:false };
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
      // 🤏 두 손가락 = **확대·축소 + 화면 이동**. 두 손가락의 중점이 움직인 만큼 뷰를 옮긴다.
      //   ⛔ 계산식을 새로 짜지 말 것 — 원본(17-build-cards.js techPtrMove)과 **같은 식**이다.
      //     한쪽만 고치면 관리자 건설 탭과 캠프의 손맛이 갈린다.
      if(_campOn && _btPinch && _btPtrs.size >= 2 && ev){
        _btPtrs.set(ev.pointerId, { x:ev.clientX, y:ev.clientY });
        const p = [..._btPtrs.values()];
        const d = Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y);
        const z = Math.max(techMinZoom(), Math.min(techMaxZoom(), _btPinch.zoom * d / _btPinch.d));
        const t = techViewT(); t.zoom = z;
        const cx = (p[0].x+p[1].x)/2, cy = (p[0].y+p[1].y)/2;
        t.x = _btPinch.vx - (cx - _btPinch.cx) / (_btPinch.rw || 1) / z;
        t.y = _btPinch.vy - (cy - _btPinch.cy) / (_btPinch.rh || 1) / z;
        _techClampView(t); _btMoved = true; return;
      }
      // 끌기 시작하면 롱프레스 취소 — 끌었다는 건 박스 지정을 하겠다는 뜻이다
      if(_campLongT && ev && _campLongFrom && ev.pointerId === _campLongFrom.id
         && Math.hypot(ev.clientX - _campLongFrom.x, ev.clientY - _campLongFrom.y) > 8) campPanDisarm();
      if(_campBox && ev && !_campBox.on){ const r = (typeof _btRect === 'function') ? _btRect() : null;
        if(r && (Math.abs(ev.clientX - _campBox.cx0) / (r.width || 1) > CAMP_BOX_MIN
              || Math.abs(ev.clientY - _campBox.cy0) / (r.height || 1) > CAMP_BOX_MIN)) _campBox.on = true; }
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
      // 🖐 전장 병력 조작 — 원본보다 **먼저** 본다(원본은 기지 엔티티만 안다).
      //   처리했으면 _btDown·_btBox 를 비워 원본이 같은 탭을 두 번 쓰지 않게 한다.
      if(_campOn && !_campPanMode && campPtrUp(ev)){
        if(typeof _btDown !== 'undefined') _btDown = null;
        if(typeof _btBox !== 'undefined') _btBox = null;
      }
      _campBox = null;
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
    // ✂ **아래로 내려가는 한도만 기본 배율에 묶는다**(2026-08-27 사용자 확정).
    //   하단 시트가 맵의 아래 21%(실측 162px)를 덮고 있다. 확대하면 세로 여지가 넓어져
    //   그 시트 뒤 구역을 위로 끌어올려 볼 수 있었다 — 평소에는 볼 수 없는 자리라 어색하다.
    //   여지를 **기본 배율(CAMP_ZOOM)의 값으로 고정**하면, 아무리 확대해도 처음 화면에서
    //   보이던 것보다 아래는 드러나지 않는다.
    //   ⚠ 위쪽(0.5-m)은 줌에 따라 그대로 넓어진다 — 확대해서 기지 위를 살피는 것은 정상 동작이다.
    //   ⛔ **줌마다 같은 곳에서 멈춰야 한다.** 「기본 배율의 여지」로 상한을 고정해 봤더니
    //      보이는 하단이 줌에 따라 달라졌다(실측: 축소 0.838 / 확대 0.709) — 축소하면 여백이 드러난다.
    //      화면에서 시트에 가려지는 몫(sf)을 빼고 **월드 좌표에서** 맞춰야 어느 줌에서든 같은 자리다.
    let yHi = 0.5 + m;
    if(_campViewBot != null){
      const sf = (typeof techSheetFrac === 'function') ? techSheetFrac() : 0;
      // 시트 윗변(화면 1-sf 지점)이 닿는 월드 좌표 = _campViewBot 이 되는 v.y
      yHi = Math.min(yHi, _campViewBot - (0.5 - sf) / v.zoom);
    }
    const yLo = 0.5 - m;
    v.y = Math.max(yLo, Math.min(Math.max(yLo, yHi), v.y));
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
    // ⚠ target 이 Element 일 때만 contains 를 쓴다 — Node 가 아닌 것(window 등)을 넘기면
    //   Node.contains 가 TypeError 를 던져 리스너가 통째로 죽는다.
    const tg = e.target;
    const inside = (el) => !!(el && tg && tg.nodeType === 1 && el.contains(tg));
    const sh = document.getElementById('btSheet');
    if(sh && sh.classList.contains('open') && inside(sh)) return;   // 시트 스크롤 존중
    // 🏕 **좌상단 재화 바 위(던전 드롭다운 포함)도 존중한다**(2026-08-27).
    //   드롭다운의 라운드 칸은 자기 스크롤을 갖는데, 여기서 가로채면 그 위에서 휠을 돌릴 때
    //   목록이 아니라 **뒤 캠프 화면이 확대·축소됐다**. 시트와 같은 이유·같은 처리다.
    if(inside(document.getElementById('campDrop'))) return;
    if(inside(document.getElementById('curBar'))) return;
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
  campSelClear(); _campBox = null;                                                    // 🖐 전장 병력 지정도 들고 나가지 않는다
  for(const k in _campZoomPatched) window[k] = _campZoomPatched[k];
  _campZoomPatched = null;
}
function campZoom(){
  if(typeof G === 'undefined' || !G.tech) return;
  const v = G.tech.view || (G.tech.view = { x:0.5, y:0.5, zoom:1 });
  // 축소 상태에서는 클램프가 x·y 를 0.5 로 고정한다(전체가 보이므로 팬 여지가 없다).
  //   기지가 아래쪽에 오는 것은 시점이 아니라 **배치**가 만든다(campLayBase).
  v.zoom = CAMP_ZOOM; v.x = 0.5; v.y = CAMP_VIEW_Y;
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
// 👷 첫 일꾼 **50** (2026-09-02 사용자 확정 · 옛 140).
//   ⭐ 첫 탭 강화(10)를 사고 탭당 2원이 된 뒤 **25탭**이면 닿는다 — 튜토리얼 구간의 두 번째 목표.
//   ⚠ 두 마리째부터는 ×1.65 그대로다(50 → 82 → 136 → 225 …).
// ⭐ 다음 마리 = **지금 값 + 지금 값의 1.5배** = **×2.5** (2026-09-02 사용자 확정 · 옛 ×1.65)
//   50 → 125 → 313 → 781 → 1,953 …
//   ⚠ 곱셈이 30번 쌓이면 옛 곡선의 **16만 배**가 된다: 30마리째 1.0억 → **17.3조**,
//     40마리 전부 사는 총액 20.3억 → **333조**.
//   ⛔ 그래도 이대로 간다 — 일꾼을 **귀하게** 만드는 것이 의도다. 초반 몇 마리가 분명한 목표가
//     되고, 그 위는 **환생 배수(미네랄 획득)와 트리 포인트**가 열어 준다(사용자 판단 · §4).
//   ⚠ 일꾼 = 자동 수입의 전부다. 여기를 만지면 회차 시간이 통째로 바뀐다 —
//     초반이 확정되면 BALANCE.md §4 방식으로 회차 시간을 다시 잴 것.
const CAMP_HIRE0 = 50, CAMP_HIRE_R = 2.5;        // n마리 보유 → 다음 마리 가격
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
// 🏭 생산 완료 가로채기 — 기지에 선 전투 유닛을 **그 자리 그대로** 전장으로 옮긴다.
//   ⭐ 원본을 먼저 부른다 — 보유 수·인구 상한·스폰 위치 계산이 전부 거기 있다.
//     여기서 다시 계산하면 두 벌이 되어 반드시 어긋난다.
//   ⛔ 일꾼·라바·알은 그대로 기지에 둔다(미네랄을 캐야 한다).
//   ⚠ 공유 파일(16-build.js)의 함수라 **나갈 때 반드시 되돌린다** — 안 되돌리면
//     관리자 탭에서 뽑은 유닛이 화면에서 사라진다.
let _campFinHome = null;
function campPatchFinish(){
  if(_campFinHome || typeof window === 'undefined') return;
  const o = window.techFinishProduce; if(typeof o !== 'function') return;
  _campFinHome = o;
  window.techFinishProduce = function(q, be){
    const r = o.apply(this, arguments);
    if(!_campOn || !CAMPB || !q || typeof STK_UNITS === 'undefined' || !STK_UNITS[q.id]) return r;
    const ents = (typeof G !== 'undefined' && G.tech) ? G.tech.ents : null; if(!ents) return r;
    for(let i = ents.length - 1; i >= 0; i--){ const e = ents[i];
      if(e.type !== 'unit' || e.uid !== q.id) continue;
      ents.splice(i, 1);                       // 기지에서 빼고
      campDeploy(q.id, e.x, e.y);              // 같은 자리에 전장 유닛으로 세운다
      break; }
    return r; }; }
function campUnpatchFinish(){
  if(!_campFinHome) return;
  window.techFinishProduce = _campFinHome; _campFinHome = null; }

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
