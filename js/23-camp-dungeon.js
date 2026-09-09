/* ══════════════════════════════════════════════════════════════════════════
 * 23-camp-dungeon.js — 🏰 **던전 = 적 기지** (2026-09-09 · GAME_DIRECTION §0-A)
 *
 * 옛 구조: 던전 안에 라운드 50개. 웨이브를 막으면 다음 라운드. 진행 지표는 **라운드 번호**.
 * 새 구조: 던전 = **적 기지**. 적이 몰려오고, 죽이면 돈이 되고, 성장해서 **적 건물을 하나씩 부순다.**
 *          진행 건물 **6채**를 다 부수면 다음 던전. ⛔ 라운드는 없다.
 *
 * ⭐ **왜 이 파일이 따로 있나** — `19-camp.js` 는 7,000줄이고 세 세션이 같이 만진다.
 *   새 코드를 전부 여기 두면 충돌이 「끼워 넣는 줄」로 줄어든다(REDESIGN_PLAN §5).
 *   ⛔ 여기에 **화면(DOM)을 만들지 말 것** — 그건 12-appshell·19-camp 의 몫이다. 여기는 규칙과 데이터다.
 *
 * ⚠ **이 파일의 수치는 아직 안 쟀다.** 전부 출발점이고, 벤치로 재서 BALANCE.md 에 적은 뒤 고친다.
 *   ⛔ 「그럴듯하니 맞겠지」로 굳히지 말 것 — 이 프로젝트에서 그렇게 네 번 빗나갔다.
 * ═══════════════════════════════════════════════════════════════════════ */

// ── 🏰 던전 표 ────────────────────────────────────────────────────────────
//   ⭐ **적 기지는 이 표에서 「만든다」**(campFoeBase). 나중에 「남의 캠프를 친다」(비동기 습격)를
//     넣을 때 그 사람의 배치를 같은 모양으로 넘기면 그대로 돈다 — 그래서 입력을 표 하나로 받는다.
//   ⚠ `k` 는 **`TECH_TREE[campTechRace(race)].buildings` 의 키**다. 종족 키가 두 벌이라는 것에 주의:
//     건물 표는 union·swarm·aetherial · 전투 엔진(STK_RACES)은 terran·zerg·protoss.
//   ⚠ 좌표는 **격자 비율**(gx·gy)이다. `campG2W` 가 전장 좌표로 바꾼다 — 내 건물과 같은 자를 쓴다.
//     적 기지는 격자 **위쪽**(gy 0.18~0.30 · CAMP_LANE_TOP=0.18 부터).
//   role: 'prog' 진행(6채 · 이걸 다 깨야 다음 던전) · 'side' 부수(6채 · 안 센다)
//   step: 진행 건물의 **차례**(1~6). ⭐ 릴레이의 뼈대다 — 살아 있는 것 중 step 이 가장 작은
//         한 채만 적을 뽑는다. 그걸 깨면 다음 채가 이어받아 **더 센 것을 더 자주** 보낸다.
//   zone: 구간(1~3). 그 구간의 **문지기 탑이 살아 있으면 그 구간의 진행 건물을 못 때린다.**
//         ⭐ 그래서 리듬이 「탑 → 건물 → 건물」 세 번이 된다(§0-A 「진출」).
//   foe:  그 건물이 뽑는 유닛 id 목록(STK_RACES 기준). ⭐ 던전 하나의 커리큘럼이 여기 적힌다.
//         ⚠ `campFoePool` 이 못 때리는 것을 거른다 — 다 걸리면 티어 표로 되돌아간다.
//   kind: 'prod' 생산 · 'tech' 연구 · 'res' 자원 · 'main' 본진(마지막 차례) — 전리품이 갈린다
//         'tower' 문지기 방어탑(나를 쏜다 · 구간을 잠근다) · 'depot' 보급고(깨면 ⚡ 일시 버프)
//   ⛔ **「치장(deco)」은 없앴다**(2026-09-09) — 표적이 안 되는 건물은 화면만 채우고 판단을 안 만든다.
const CAMP_DG_STEPS = 6;                 // 던전 하나 = 진행 건물 6채 = 관문 6개
const CAMP_DG_MAX_N = 3;                 // 던전 셋(유니온 → 스웜 → 에테리얼) · 그 위는 무한층(단계 3)
const CAMP_DG_ZONES = 3;                 // 구간 셋 — 구간마다 방어탑 하나가 문지기다
const CAMP_DG = [
  null,                                  // 0 = 캠프(집) — 적이 없다
  // ── D1 유니온 기지 — 「릴레이를 가르친다」. 기믹 없음(튜토리얼 · 미러전) ──
  //   커리큘럼: T1 만으로 시작해 ⑤에서 T2 가 처음 나온다.
  { race:'union', name:'버려진 전초기지', lesson:'building',
    desc:'앞 건물부터 하나씩 — 깰수록 다음 건물이 더 센 것을 보낸다',
    bld:[
      // 구간 1 — 문지기 미사일 포탑
      { k:'turret',   gx:.50, gy:.335, role:'side', kind:'tower', zone:1 },
      { k:'barracks', gx:.30, gy:.310, role:'prog', kind:'prod', zone:1, step:1, foe:['marine'] },
      { k:'factory',  gx:.70, gy:.310, role:'prog', kind:'prod', zone:1, step:2, foe:['machinegun','marine'] },
      { k:'supply',   gx:.10, gy:.325, role:'side', kind:'depot', zone:1 },
      // 구간 2 — 문지기 벙커
      { k:'bunker',   gx:.50, gy:.270, role:'side', kind:'tower', zone:2 },
      { k:'engbay',   gx:.28, gy:.240, role:'prog', kind:'tech', zone:2, step:3, foe:['ghost','marine'] },
      { k:'refinery', gx:.72, gy:.240, role:'prog', kind:'res',  zone:2, step:4, foe:['machinegun','ghost'] },
      { k:'supply',   gx:.90, gy:.255, role:'side', kind:'depot', zone:2 },
      // 구간 3 — 문지기 포탑 + 본진
      { k:'turret',   gx:.50, gy:.215, role:'side', kind:'tower', zone:3 },
      { k:'academy',  gx:.26, gy:.185, role:'prog', kind:'tech', zone:3, step:5, foe:['racer','marine'] },
      { k:'command',  gx:.60, gy:.182, role:'prog', kind:'main', zone:3, step:6, foe:['goliath','tank','marine'] },
      { k:'supply',   gx:.88, gy:.190, role:'side', kind:'depot', zone:3 } ] },
  // ── D2 스웜 기지 — 「연구가 필요하다」. 기믹: **공중이 섞인다**(대공이 없으면 못 깬다) ──
  { race:'swarm', name:'감염된 둥지', lesson:'research', air:true,
    desc:'적이 단단하다 — 연구 없이는 못 깬다. 하늘에서도 온다',
    bld:[
      { k:'sunken',     gx:.50, gy:.335, role:'side', kind:'tower', zone:1 },
      { k:'pool',       gx:.30, gy:.310, role:'prog', kind:'prod', zone:1, step:1, foe:['broodling'] },
      { k:'hydraden',   gx:.70, gy:.310, role:'prog', kind:'prod', zone:1, step:2, foe:['snapper','broodling'] },
      { k:'creep',      gx:.10, gy:.325, role:'side', kind:'depot', zone:1 },
      { k:'spore',      gx:.50, gy:.270, role:'side', kind:'tower', zone:2 },
      { k:'evochamber', gx:.28, gy:.240, role:'prog', kind:'tech', zone:2, step:3, foe:['hydra','snapper'] },
      { k:'extractor',  gx:.72, gy:.240, role:'prog', kind:'res',  zone:2, step:4, foe:['hydra','broodling'] },
      { k:'creep',      gx:.90, gy:.255, role:'side', kind:'depot', zone:2 },
      { k:'sunken',     gx:.50, gy:.215, role:'side', kind:'tower', zone:3 },
      { k:'lair',       gx:.26, gy:.185, role:'prog', kind:'tech', zone:3, step:5, foe:['thornqueen','hydra'] },
      { k:'hatchery',   gx:.60, gy:.182, role:'prog', kind:'main', zone:3, step:6, foe:['ultralisk','thornqueen','hydra'] },
      { k:'creep',      gx:.88, gy:.190, role:'side', kind:'depot', zone:3 } ] },
  // ── D3 에테리얼 기지 — 「조합 + 최종」. 기믹: **동력탑이 그 구간의 탑을 먹인다** ──
  //   ⭐ 이 설계의 가장 좋은 한 칸이다 — 문지기 탑을 **직접 깨든, 그 구간의 파일런을 깨든** 문이 열린다.
  //     「어느 걸 먼저」가 진짜 판단이 된다. ⛔ D1·D2 에는 넣지 않는다(배우기 전에 나오면 그냥 어렵다).
  //   ⚠ 파일런은 **보급고이면서 동력탑**이다(kind:'depot' + power:true) — 깨면 버프도 오고 문도 열린다.
  { race:'aetherial', name:'잊혀진 회랑', lesson:'mix', powered:true,
    desc:'동력탑이 문지기를 먹인다 — 무엇을 먼저 깰지가 갈린다',
    bld:[
      { k:'cannon',      gx:.50, gy:.335, role:'side', kind:'tower', zone:1 },
      { k:'gateway',     gx:.30, gy:.310, role:'prog', kind:'prod', zone:1, step:1, foe:['blade'] },
      { k:'stargate',    gx:.70, gy:.310, role:'prog', kind:'prod', zone:1, step:2, foe:['dragoon','blade'] },
      { k:'pylon',       gx:.10, gy:.325, role:'side', kind:'depot', zone:1, power:true },
      { k:'cannon',      gx:.50, gy:.270, role:'side', kind:'tower', zone:2 },
      { k:'forge',       gx:.28, gy:.240, role:'prog', kind:'tech', zone:2, step:3, foe:['dark_templar','dragoon'] },
      { k:'assimilator', gx:.72, gy:.240, role:'prog', kind:'res',  zone:2, step:4, foe:['dragoon','blade'] },
      { k:'pylon',       gx:.90, gy:.255, role:'side', kind:'depot', zone:2, power:true },
      { k:'cannon',      gx:.50, gy:.215, role:'side', kind:'tower', zone:3 },
      { k:'cyber',       gx:.26, gy:.185, role:'prog', kind:'tech', zone:3, step:5, foe:['archon','dragoon'] },
      { k:'nexus',       gx:.60, gy:.182, role:'prog', kind:'main', zone:3, step:6, foe:['kronos','archangel','archon'] },
      { k:'pylon',       gx:.88, gy:.190, role:'side', kind:'depot', zone:3, power:true } ] },
];

// ── 🔢 값 — ⚠ 전부 출발점이다(안 쟀다) ────────────────────────────────────
//   ⭐ 기준은 **내 건물**이다: CAMP_BLD_HP(120) · 본부 CAMP_BASE_HP(750).
//     적 진행 건물이 그보다 얇으면 「깨는 맛」이 없고, 두꺼우면 한 채에 몇 분씩 걸린다.
// ⏫ **60 → 180** (2026-09-09) — 「몇 초 동안 때려야 깨지나」로 다시 잡았다.
//   ⛔ 60 은 종잇장이었다: 던전 3 에 드레드노트 20기로 들어가면 진행 건물 여섯이 **한 프레임에**
//     같이 무너져 던전이 10초에 끝났다(실측). 「하나씩 부순다」가 성립하려면 한 채가 시간을 먹어야 한다.
//   ⭐ 기준: 그 관문에 **알맞은 병력**이면 한 채에 **20~30초**. 아군은 그동안 적 유닛과도 싸우므로
//     실효 화력은 이론의 3분의 1쯤이다(실측 31%) — 그 몫까지 계산에 넣은 값이다.
//   ⏫ **180 → 260** (2026-09-09 · 30분 자동 플레이 세 번으로 잡았다)
//     · 180 이면 관문 1~5 를 **3~8초**에 넘어간다 — 「지금 더 갈까, 업그레이드하고 갈까」가 설 틈이 없고
//       준비 없이 최종 관문에 닿아 거기서만 죽는다(패배 12번 중 마지막 5번이 전부 관문 5→6).
//     · 400 이면 **첫 관문부터 막혀** 캠프에서 25분을 그냥 기다렸다(전투 0초 · 대기 1,518초).
//     · 260 이 그 사이다. ⚠ 관문 사다리(×1.22^n)가 뒤로 갈수록 알아서 두껍게 만든다 —
//       여기서 정하는 것은 **첫 관문의 두께**다.
const CAMP_FOE_BLD_HP0 = 260;            // 진행 건물 한 채의 밑값 · 여기에 그 관문의 난이도가 곱해진다
// ⏬ 본진 3.0 → 2.2 → **1.4** (2026-09-09) — 본진은 **마지막 관문**이라 사다리 배율을 이미 안고 있다.
//   ⚠ 2.2 로도 절벽이었다(실측): 관문 5 건물이 376 인데 본진이 1,168 — **3.1배 점프**라
//     자동 플레이가 12번 중 마지막 5번을 전부 거기서 졌다. 1.4 면 2.0배로 이어진다.
//   ⛔ 3.0 으로 되돌리지 말 것 — 「마지막이 제일 크다」는 사다리 배율이 이미 하고 있다.
const CAMP_FOE_BLD_K = { main:1.4, tech:1.0, prod:1.2, res:0.8, tower:1.2, depot:0.5 }; // 보급고는 얇다(들르는 값)
// 🗼 방어탑 — 사거리 안 내 유닛을 쏜다. ⚠ 적 유닛과 **같은 자**를 쓴다(CAMP_FOE_ATK0 = 0.05).
// ⚠ **적 공격력에서 파생시킨다** — 상수로 박아 두면 `CAMP_FOE_ATK0` 를 만질 때마다 어긋난다
//   (실제로 0.05 시절 값이 그대로 남아 탑이 적 한 마리보다 약해져 있었다 · 2026-09-09).
const CAMP_FOE_TOWER_DMG = ((typeof CAMP_FOE_ATK0 !== 'undefined') ? CAMP_FOE_ATK0 : 0.17) * 6;   // 탑 하나 = 적 여섯 몫
const CAMP_FOE_TOWER_RNG = 210;          // 전장 좌표 · 내 본부 밀어내는 원(210)과 같은 눈금
const CAMP_FOE_TOWER_CD  = 1.0;          // 발사 간격(초)
// 🌊 **릴레이 압박** — 적은 **활성 건물 한 곳에서만** 나온다(2026-09-09 사용자 확정).
//   ⭐ 옛 규칙(살아 있는 prod 수만큼 자주 온다)을 **뒤집었다**: 그때는 깰수록 편해져서
//     마지막 건물이 제일 시시했다. 이제 깰수록 **다음 건물이 더 센 것을 더 자주** 보낸다.
//   ⛔ 「시간이 지나면 적이 세진다」로 만들지 말 것 — 방치형에서 그건 「안 보면 손해」다(§2-5).
//     이건 시간이 아니라 **내가 깬 것**에 반응하므로 방치해도 손해가 없다.
//   ⚠ 두 표는 단계(step 1~6)로 읽는다 — 배열 인덱스는 step−1.
const CAMP_FOE_RELAY_S = [3.4, 3.0, 2.7, 2.4, 2.1, 1.8];   // 단계별 스폰 주기(초) — 짧아진다
const CAMP_FOE_RELAY_N = [2, 2, 3, 3, 4, 5];               // 단계별 한 무리 마리 수 — 늘어난다
// 🧯 **전장 적 상한 — 「죽음의 나선」을 끊는 유일한 장치** (2026-09-09 사용자 지적)
//   ⛔ 상한이 없으면 **못 이기는 판은 반드시 지는 판**이 된다: 죽이는 속도가 나오는 속도보다
//     느린 순간부터 적이 무한히 쌓이고, 그 뒤로는 무엇을 해도 전멸한다. 병력이 약한 초반이
//     정확히 그 구간이라, 「들어간다 → 죽는다 → 다시 산다」가 끝없이 돈다.
//   ⭐ 상한이 있으면 못 이기는 판은 **버티는 판**이 된다 — 적을 잡아 돈을 벌며 캠프 경제로
//     자라다가, 준비되면 다시 민다. 그게 이 게임이 원한 마린키우기의 고리다.
//   ⚠ 상한은 단계마다 오른다 — 「밀수록 어려워진다」는 그대로다(마리 수도 세기도 함께 오른다).
//   ⛔ 상한을 없애서 난이도를 올리지 말 것. 난이도는 CAMP_GATE_RATE(세기)와 이 표(머릿수)로 올린다.
//   ⚠ 전부 안 쟀다.
//   ⚠ 아군 규모에 맞춘다 — 재구매 배수를 1.30 으로 내려(2026-09-09) 병력이 20~40기가 됐다.
//     상한이 아군 수보다 훨씬 작으면 「몰려온다」가 안 되고, 크면 상한이 뜻을 잃는다.
//   ⚠ **마지막 칸을 급증시키지 말 것**(2026-09-09 실측). 관문 6 은 사다리 배율도 가장 크므로(×1.62),
//     상한까지 40 으로 뛰면 적 전력이 한 번에 ×2.2 가 되어 **벽이 둘로 겹친다** —
//     자동 플레이가 패배 11번 중 마지막 5번을 전부 거기서 졌다. 32 면 ×1.75 로 이어진다.
const CAMP_FOE_LIVE_MAX = [10, 14, 18, 22, 27, 32];        // 단계별 전장에 동시에 살아 있을 수 있는 적
const CAMP_FOE_SPAWN_R   = 26;           // 건물 둘레로 흩는 반경 — 한 점에서 겹쳐 나오면 끼인다
const CAMP_FOE_SPAWN_OFF = 18;           // 건물보다 내 쪽으로 이만큼 — 건물 안에서 안 나오게
// ⚡ **보급고** — 진행에 안 세지만 깨면 일시 버프. ⭐ 「지금 들러서 힘 받고 갈까」가 생긴다.
//   ⛔ 영구 효과로 만들지 말 것 — 부수 건물이 성장 축이 되면 진행 6채가 뒷전이 된다.
const CAMP_DEPOT_S   = 30;               // 버프 지속(초)
const CAMP_DEPOT_MUL = 2;                // 그동안 자원 수입 배수(탭·일꾼 양쪽)
// 🎁 반격 웨이브 — 건물을 깨면 **즉시** 보복이 온다. 「깬 직후가 가장 위험하다」
//   ⚠ 반격은 **깨진 그 건물 자리**에서 튀어나온다(campCounterWave) — 위쪽 줄이 아니다.
const CAMP_COUNTER_N = { main:14, tech:6, prod:5, res:6, tower:4, depot:3 };
// 🎁 전리품 — 깬 건물 종류마다 다른 보상. ⭐ **이것이 「경제가 모든 것의 앞단」을 푸는 자리다**:
//   지금까지 가스는 정제소(=경제 지출) 하나에서만 나와서, 경제에 쓰면 연구까지 따라와 저울이 안 섰다.
//   res 건물이 가스를 내면 **가스가 전투 성과에서도** 나온다 → 경제=미네랄 / 전투=가스·연구로 축이 갈린다.
//   ⚠ 그래서 **CAMP_LOOT_GAS 가 이 게임의 저울을 정하는 값**이다. 적으면 지금과 같고 많으면 경제가 죽는다.
//   ⏫ **관문 하나가 요구하는 성장을 전리품이 실제로 채워야 한다**(2026-09-09 설계).
//     관문 배율이 ×1.2~1.55 이므로, 한 채를 깨면 그만큼의 성장을 **살 수 있어야** 다음 채로 간다.
//     그 자리를 못 채우면 「깨고 → 벽 → 캠프에서 하염없이 기다림」이 되어 원정의 리듬이 죽는다.
//   ⚠ 「몇 초치」라 수입이 자라면 전리품도 함께 자란다 — 뒤 관문일수록 자동으로 커진다.
const CAMP_LOOT_GAS_S = 150;             // res 건물 = 지금 가스 수입의 몇 초치(연구 몇 레벨치)
const CAMP_LOOT_MIN_S = 90;              // prod 건물 = 지금 미네랄 수입의 몇 초치(유닛 한두 기치)
const CAMP_LOOT_TECH_CUT = 0.5;          // tech 건물 = 진행 중 연구의 남은 시간을 이만큼 깎는다
const CAMP_LOOT_MAIN_S = 300;            // main = 둘 다 이만큼(던전 하나를 끝낸 삯)
// 🌫 안개 — 못 본 건물은 실루엣이다. ⚠ 엔진의 타일 안개(fogInit)는 **안 쓴다**(그건 유즈맵 격자용) —
//   건물 12채의 플래그면 충분하고, 시스템 둘을 겹치면 어느 쪽이 정답인지 알 수 없게 된다.
const CAMP_FOE_SEE_R = 1.25;             // 유닛 인지 거리의 이 배수 안이면 보인다
const CAMP_FOE_SEE_T = 0.35;             // 다시 보는 간격(초) — 매 프레임 12×N 을 돌지 않는다

// ── 📖 읽기 — 상태 ────────────────────────────────────────────────────────
// 이 던전에서 부순 **진행 건물** 수(0~6). ⭐ 옛 `campCleared()`(0~50)의 자리다.
function campBroken(){ const C = (typeof campState === 'function') ? campState() : null;
  if(!C || !((C.dg | 0) > 0)) return 0;
  return Math.max(0, Math.min(CAMP_DG_STEPS, C.broken | 0)); }
// 그 던전의 표. 무한층(단계 3)은 아직 없으므로 범위 밖은 null.
function campDgDef(dg){ const n = dg | 0; return (n > 0 && n < CAMP_DG.length) ? CAMP_DG[n] : null; }
function campDgName(dg){ const d = campDgDef(dg); return d ? d.name : '캠프'; }
// 그 종족의 건물 표에서 한 채를 찾는다 — 이름·아이콘을 거기서 가져온다(새 에셋을 만들지 않는다).
function campFoeBldDef(race, k){
  const tr = (typeof campTechRace === 'function') ? campTechRace(race) : race;
  const t = (typeof TECH_TREE !== 'undefined') ? TECH_TREE[tr] : null;
  if(!t || !t.buildings) return null;
  for(const b of t.buildings) if(b.k === k) return b;
  return null; }

// ── 🏗 적 기지를 세운다 ───────────────────────────────────────────────────
//   ⚠ `CAMPB._fbld` 에 넣는다 — 내 건물(`CAMPB._bld`)과 **같은 모양**이라야
//     `campStepUnits` 의 건물 분기가 그대로 쓴다(x·y·hp·max·maxHp·dead·eid).
//   ⭐ 부순 것은 **되살아나지 않는다**(C.foeDead) — 캠프에 다녀와도 그 던전 진행은 남는다.
//     ⛔ 단, **패배하면 비운다**(campFail) — 「그 던전 처음부터」가 확정된 규칙이다(§0-A).
function campFoeBase(dg){
  if(typeof CAMPB === 'undefined' || !CAMPB) return 0;
  const d = campDgDef(dg);
  if(!d){ CAMPB._fbld = []; return 0; }                    // 캠프(0)·범위 밖 = 적 기지가 없다
  const C = (typeof campState === 'function') ? campState() : null;
  const dead = (C && C.foeDead) || {};
  const W = CAMPB.world, out = [];
  // 🪜 **건물마다 「제 관문의 난이도」로 짓는다**(2026-09-09).
  //   ⛔ 기지 전체를 입장 시점의 난이도 하나로 짓지 말 것 — 그러면 체력이 판 내내 고정이라
  //     적 유닛만 세지고 **뒤 건물이 상대적으로 더 물러진다**. 「밀수록 어려워진다」의 반대다
  //     (실측 2026-09-09: 드레드노트 20기가 던전 3 을 13초에 통과했다).
  //   ⭐ 진행 건물은 제 차례(step−1), 부수 건물은 제 구간이 열리는 관문((zone−1)×2)을 쓴다.
  const _bdiff = function(q){
    if(typeof campFoeDiff !== 'function') return 1;
    const g = (q.step | 0) > 0 ? ((q.step | 0) - 1) : Math.max(0, ((q.zone | 0) - 1) * 2);
    return campFoeDiff(dg, g); };
  let i = 0;
  for(const q of d.bld){
    const eid = 'fb' + dg + '_' + (i++);                   // ⚠ 자리마다 고정된 id — 같은 던전이면 늘 같다
    const def = campFoeBldDef(d.race, q.k);
    const k = CAMP_FOE_BLD_K[q.kind] || 1;
    const hp = Math.max(1, Math.round(CAMP_FOE_BLD_HP0 * k * _bdiff(q)));
    const p = (typeof campG2W === 'function') ? campG2W(q.gx, q.gy, W) : { x:W * q.gx, y:W * q.gy };
    out.push({ x:p.x, y:p.y, eid:eid, bk:q.k, role:q.role, kind:q.kind,
      zone:q.zone | 0, step:q.step | 0, spawn:q.foe || null,
      nm:(def && def.name) || q.k, ico:(def && def.ico) || '',
      power:!!q.power, foe:true,                           // foe:true = 「적 것」 표식(내 건물과 가른다)
      hp:hp, max:hp, maxHp:hp, dead:!!dead[eid],
      seen:false, _twT:0 });
  }
  CAMPB._fbld = out;
  // 👁 **앞줄은 처음부터 보인다.** ⛔ 전부 가리면 표적이 하나도 없어 병력이 집결점에 선 채
  //   영영 안 나아간다 — 안개가 진행을 막아 버린다(닭과 달걀). 내 쪽에서 가장 가까운
  //   세 채를 열어 주면 거기서부터 시야가 번져 나간다.
  { const cand = out.slice().sort(function(a, b){ return b.y - a.y; });  // y 큰 것 = 내 쪽
    for(let j = 0; j < Math.min(3, cand.length); j++) cand[j].seen = true; }
  campFoeReveal(true);                                     // 그 밖에 이미 시야에 든 것도 바로 드러낸다
  return out.length; }

// 살아 있는 적 건물 — ⭐ **12채 전부 표적이다**(2026-09-09 · 옛 '치장'을 없앴다).
function campFoeBldAlive(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld) return [];
  return CAMPB._fbld.filter(function(b){
    return b && !b.dead && (b.hp || 0) > 0; }); }
// 남은 진행 건물 수
function campFoeProgLeft(){
  return campFoeBldAlive().filter(function(b){ return b.role === 'prog'; }).length; }
// 🗼 **그 구간에서 돌고 있는 문지기 탑.** D3 은 **그 구간의 동력탑(power)** 이 살아 있어야 돈다.
//   ⭐ 그래서 D3 은 「탑을 직접 깨나, 그 구간 파일런을 깨나」가 같은 문을 연다.
//   ⛔ 전력을 기지 전체로 보지 말 것 — 파일런 하나에 문 셋이 열려 던전이 통째로 무너진다.
function campFoeTowerLive(z){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld) return [];
  const tw = campFoeBldAlive().filter(function(b){
    return b.kind === 'tower' && (z == null || (b.zone | 0) === (z | 0)); });
  if(!tw.length) return tw;
  const d = campDgDef((typeof campDgN === 'function') ? campDgN() : 0);
  if(!(d && d.powered)) return tw;
  return tw.filter(function(t){
    return CAMPB._fbld.some(function(b){
      return b && b.power && !b.dead && (b.hp || 0) > 0 && (b.zone | 0) === (t.zone | 0); }); }); }
// 살아 있는(=쏘는) 방어탑 전부 — 사격 담당이 쓴다
function campFoeTowerOn(){ return campFoeTowerLive(null); }
// 🚪 그 구간의 문이 열렸나 — 문지기 탑이 멎었으면 안쪽 진행 건물을 때릴 수 있다
function campFoeZoneOpen(z){ return campFoeTowerLive(z).length === 0; }
// 🏭 **활성 생산자** — 살아 있는 진행 건물 중 차례(step)가 가장 앞선 한 채. ⭐ 릴레이의 심장이다.
function campFoeActive(){
  let best = null;
  for(const b of campFoeBldAlive()){
    if(b.role !== 'prog') continue;
    if(!best || (b.step | 0) < (best.step | 0)) best = b; }
  return best; }
// 그 건물의 단계 인덱스(0~5) — 표를 읽는 자리
function campFoeStepIdx(b){
  const n = (b && (b.step | 0)) || 1;
  return Math.max(0, Math.min(CAMP_DG_STEPS - 1, n - 1)); }

// 🎯 **내 병력의 다음 표적.** ⛔ 죽은 것을 절대 돌려주지 않는다 —
//   `strikeFrontStruct` 가 준 구조물이 dead 여도 이동은 안 막혀서(18-strike 의 `_toTemple` 에
//   dead 검사가 없다) 아군이 그 자리까지 행군해 버린다. 그 버그는 이미 한 번 겪었다.
function campFoeFront(){
  const live = campFoeBldAlive();
  if(!live.length) return null;
  const C = (typeof campState === 'function') ? campState() : null;
  // ① 플레이어가 고른 표적이 살아 있으면 그것 — ⭐ 보급고로 새는 길이 여기다(자동으로는 안 간다)
  if(C && C.foeTgt){ for(const b of live) if(b.eid === C.foeTgt && campFoeCanTarget(b)) return b; }
  // ② 릴레이가 정한다 — 활성 건물, 그 구간이 잠겨 있으면 **문지기 탑부터**
  const act = campFoeActive();
  if(act){
    if(campFoeZoneOpen(act.zone)){ if(act.seen) return act; }
    else {
      let g = null;
      for(const t of campFoeTowerLive(act.zone)){ if(!t.seen) continue;
        if(!g || t.y > g.y) g = t; }                       // 여럿이면 내 쪽 것부터
      if(g) return g; } }
  // ③ 폴백 — 아직 아무것도 못 봤거나 표가 없는 경우: 가장 앞줄 중 고를 수 있는 것
  let best = null;
  for(const b of live){ if(!campFoeCanTarget(b)) continue;
    if(!best || b.y > best.y) best = b; }
  return best; }
// 🔒 **구간이 표적을 잠근다** — 문지기 탑이 살아 있으면 그 구간의 진행 건물은 못 때린다.
//   ⭐ 탑과 보급고는 **언제든** 때릴 수 있다(문을 여는 길 · 들르는 길).
//   ⚠ 안개에 가린 것은 아직 표적이 아니다.
//   ⛔ 옛 「본진은 나머지 다섯이 죽어야 열린다」 규칙은 없앴다 — 구간 3 의 문지기가 그 일을 한다.
function campFoeCanTarget(b){
  if(!b || b.dead) return false;
  if(!b.seen) return false;
  if(b.role === 'prog') return campFoeZoneOpen(b.zone);
  return true; }

// ── 💥 건물을 깼다 — **유일한 입구** ──────────────────────────────────────
//   ⭐ 여기 하나에 재미 넷이 다 걸린다: 전리품 · 반격 웨이브 · 체크포인트 부활 · 진행/타이머.
//   ⚠ `campStepUnits` 의 건물 분기가 hp<=0 을 만들면 그 자리에서 이걸 부른다.
function campBreakBld(b){
  if(!b || b._broke) return false;
  b._broke = true; b.dead = true; b.hp = 0;
  const C = (typeof campState === 'function') ? campState() : null;
  if(C){ if(!C.foeDead) C.foeDead = {}; C.foeDead[b.eid] = 1; }
  campLoot(b);                                             // 🎁 전리품
  campCounterWave(b);                                      // 🎁 반격 — 깬 직후가 가장 위험하다
  campFoeRevealNear(b);                                    // 🌫 깬 자리 둘레가 드러난다
  if(b.role === 'prog' && C){
    C.broken = Math.min(CAMP_DG_STEPS, campBroken() + 1);
    if(!C.best) C.best = {};
    C.best[C.dg] = Math.max(C.best[C.dg] | 0, C.broken);    // 룬 칸·환생이 읽는 「최고 도달」
    // 🩹 **체크포인트 부활** — 옛 「라운드 시작」의 자리다. 누운 병력이 일어나고 체력이 찬다.
    if(typeof campRescaleMine === 'function') campRescaleMine();   // 🏛 내 기지도 그 관문의 자로
    if(typeof campRoundRevive === 'function') campRoundRevive();
    if(typeof campSay === 'function'){
      const nx = campFoeActive();                          // 이어받을 다음 건물(없으면 이 던전 끝)
      campSay('🏚 ' + (b.nm || '건물') + ' 파괴 — ' + C.broken + '/' + CAMP_DG_STEPS
        + (nx ? ' · ' + (nx.nm || '다음 건물') + '이 나선다' : ''), 'ui_ok'); }
  } else if(b.kind === 'depot' && C){
    // ⚡ 보급고 — 진행에 안 세는 대신 **일시 버프**. ⛔ 겹쳐 쌓지 말 것(지속만 다시 채운다).
    C.depotT = CAMP_DEPOT_S;
    if(typeof campSay === 'function')
      campSay('⚡ ' + (b.nm || '보급고') + ' 파괴 — 자원 ×' + CAMP_DEPOT_MUL + ' ' + CAMP_DEPOT_S + '초', 'ui_ok');
  } else if(typeof campSay === 'function'){
    // 🗼 문지기를 깼으면 그 구간이 열렸는지 말해 준다 — 「이제 들어갈 수 있다」가 안 보이면 안 읽힌다.
    const opened = (b.kind === 'tower' && campFoeZoneOpen(b.zone));
    campSay((opened ? '🚪 ' : '🧱 ') + (b.nm || '건물') + ' 파괴' + (opened ? ' — 길이 열렸다' : ''),
      opened ? 'ui_ok' : 'ui_tab'); }
  if(C && C.foeTgt === b.eid) C.foeTgt = null;              // 고른 표적이 죽었으면 자동으로 되돌린다
  if(typeof campSave === 'function') campSave();
  return true; }

// 🎁 **전리품** — 깬 건물 종류에 따라 다른 보상.
//   ⛔ 지갑은 `campAddRes()` 한 입구다(19-camp) — 여기서 G.tech.credit 을 직접 만지지 말 것.
function campLoot(b){
  if(!b) return 0;
  const C = (typeof campState === 'function') ? campState() : null; if(!C) return 0;
  const rM = (C.rate || 0), rG = (C.rateGas || 0);          // 지금 초당 수입(미네랄·가스)
  let min = 0, gas = 0;
  if(b.kind === 'res')  gas = rG * CAMP_LOOT_GAS_S;
  else if(b.kind === 'prod') min = rM * CAMP_LOOT_MIN_S;
  else if(b.kind === 'main'){ min = rM * CAMP_LOOT_MAIN_S; gas = rG * CAMP_LOOT_MAIN_S; }
  else if(b.kind === 'tech'){                              // 🔬 진행 중인 연구의 남은 시간을 깎는다
    if(typeof G !== 'undefined' && G.tech && G.tech.ents){
      for(const e of G.tech.ents){ if(e && e._rj && e._rj.t > 0) e._rj.t *= (1 - CAMP_LOOT_TECH_CUT); } } }
  min = Math.floor(min); gas = Math.floor(gas);
  if((min > 0 || gas > 0) && typeof campAddRes === 'function') campAddRes(min, gas);
  return min + gas; }

// 🎁 **반격 웨이브** — 건물을 깨면 즉시 보복이 온다.
//   ⚠ 웨이브 큐(`CAMPB._wq`)를 그대로 쓴다 — 새 장치를 만들지 않는다.
function campCounterWave(b){
  if(typeof CAMPB === 'undefined' || !CAMPB || !b) return 0;
  const n = CAMP_COUNTER_N[b.kind] | 0; if(n <= 0) return 0;
  if(!CAMPB._wq) CAMPB._wq = [];
  // ⭐ **깨진 그 자리에서** 튀어나온다 — 위쪽 줄에서 나오면 「보복」으로 안 읽힌다.
  const act = campFoeActive();
  CAMPB._wq.push({ n:n, x:b.x, y:b.y, ids:(act && act.spawn) || null });
  CAMPB._wqT = 0;                                          // 곧바로 나온다
  // ⛔ `_wqTot` 을 건드리지 않는다 — 그건 **옛 라운드 큐**의 자다(몫은 마리 수).
  return n; }

// ── 🌊 릴레이 압박 — **활성 건물 한 곳**이 적을 보낸다 ────────────────────
//   ⭐ 깰수록 다음 건물이 이어받아 **더 센 것을 더 자주** 보낸다(§0-A · 2026-09-09).
//   ⛔ 「살아 있는 건물 수로 나눈다」로 되돌리지 말 것 — 그러면 마지막 건물이 제일 시시해진다.
function campFoeSpawnTick(dt){
  if(typeof CAMPB === 'undefined' || !CAMPB) return 0;
  const act = campFoeActive();
  if(!act){ CAMPB._fspT = 0; return 0; }                   // 진행 건물이 다 죽었다 — 압박 끝
  CAMPB._fspT = (CAMPB._fspT || 0) - dt;
  if(CAMPB._fspT > 0) return 0;
  const i = campFoeStepIdx(act);
  // 🧯 상한에 닿았으면 안 보낸다 — ⛔ 이 줄을 빼면 못 이기는 판이 반드시 지는 판이 된다(위 설명).
  //   ⚠ **대기 중인 무리도 센다**(_wq) — 안 세면 큐에 쌓아 두었다가 한꺼번에 쏟아진다.
  { const live = campFoeLive(), pend = campFoePendN();
    if(live + pend >= (CAMP_FOE_LIVE_MAX[i] | 0)){ CAMPB._fspT = CAMP_FOE_RELAY_S[i]; return 0; } }
  const n = CAMP_FOE_RELAY_N[i] | 0;
  CAMPB._fspT = CAMP_FOE_RELAY_S[i];
  if(!CAMPB._wq) CAMPB._wq = [];
  CAMPB._wq.push({ n:n, x:act.x, y:act.y, ids:act.spawn || null });
  return n; }                                              // ⛔ `_wqTot` 은 안 건드린다(위 설명)

// 지금 전장에 살아 있는 적 · 아직 안 나온 적(큐에 든 것)
function campFoeLive(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB.ai) return 0;
  let n = 0; for(const u of CAMPB.ai.units) if(u && !u.dead) n++;
  return n; }
function campFoePendN(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._wq) return 0;
  let n = 0;
  for(const q of CAMPB._wq) n += (q && typeof q === 'object') ? (q.n | 0) : (q | 0);
  return n; }

// ── ⚡ 보급고 버프 ────────────────────────────────────────────────────────
//   ⛔ `campCommonMul`(화면의 「총 배수」)에 넣지 말 것 — 피버와 같은 이유다: 켜질 때마다
//     대표 숫자가 튀어서 「내가 쌓아 온 값」으로 안 읽힌다. 획득 계산에만 곱한다.
function campDepotMul(){
  const C = (typeof campState === 'function') ? campState() : null;
  return (C && (C.depotT || 0) > 0) ? CAMP_DEPOT_MUL : 1; }
function campDepotTick(dt){
  const C = (typeof campState === 'function') ? campState() : null;
  if(!C || !((C.depotT || 0) > 0)) return 0;
  C.depotT = Math.max(0, (C.depotT || 0) - dt);
  return C.depotT; }

// ── 🗼 방어탑이 나를 쏜다 ────────────────────────────────────────────────
//   ⚠ 정지 사수라 이동이 없다 — `campStepUnits` 를 안 건드리고 여기서 직접 깎는다.
//   ⛔ 새 전투 규칙을 만들지 말 것: 피해는 그냥 hp 에서 뺀다(적 유닛과 같은 자 · CAMP_FOE_ATK0 눈금).
function campFoeTowerStep(dt){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB.me) return 0;
  const tw = campFoeTowerOn(); if(!tw.length) return 0;
  const mine = CAMPB.me.units; if(!mine || !mine.length) return 0;
  const R2 = CAMP_FOE_TOWER_RNG * CAMP_FOE_TOWER_RNG;
  let hits = 0;
  for(const t of tw){
    t._twT = (t._twT || 0) - dt;
    if(t._twT > 0) continue;
    let best = null, bd = Infinity;
    for(const u of mine){ if(u.dead) continue;
      const dx = u.x - t.x, dy = u.y - t.y, d2 = dx * dx + dy * dy;
      if(d2 <= R2 && d2 < bd){ bd = d2; best = u; } }
    if(!best) continue;
    t._twT = CAMP_FOE_TOWER_CD;
    const dm = CAMP_FOE_TOWER_DMG * ((typeof campFoeDiff === 'function')
      ? campFoeDiff((typeof campDgN === 'function') ? campDgN() : 1, campBroken()) : 1);
    if(best.sh > 0){ const s = Math.min(best.sh, dm); best.sh -= s;
      if(dm > s) best.hp -= (dm - s); }
    else best.hp -= dm;
    if(best.hp <= 0){ best.hp = 0; best.dead = true; }
    hits++; }
  return hits; }

// ── 🌫 안개 — 못 본 건물은 실루엣 ────────────────────────────────────────
//   ⭐ 드러나는 길은 둘이다: ① 내 유닛 시야 안 ② **이웃 진행 건물이 깨졌다**(안쪽이 드러난다).
//   ⚠ `dt` 를 받아 스스로 주기를 센다 — 매 프레임 12채×N기를 돌면 비싸다.
//     `now=true` 면 주기를 무시하고 지금 본다(진입·건물 파괴 직후).
//   ⭐ **막고 선 것은 늘 보인다**(campFoeRevealGate) — 안개는 「기지의 나머지」를 가리는 것이지
//     길을 가리는 것이 아니다. ⛔ 이걸 빼면 **교착**이다: 구간을 넘어가면 다음 문지기가 안 보이고
//     → 표적이 없고 → 아군이 안 나아가고 → 영영 안 보인다. 구간 사이가 314px 인데 깬 자리 둘레는
//     170px 뿐이라 저절로는 절대 안 드러난다(2026-09-09 실측). 처음 세 채를 열어 준 것과 같은 이유다.
function campFoeRevealGate(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld) return 0;
  const act = campFoeActive(); if(!act) return 0;
  let n = 0;
  if(!act.seen){ act.seen = true; n++; }                    // 적이 쏟아져 나오는 곳을 모를 리 없다
  for(const t of campFoeTowerLive(act.zone)) if(!t.seen){ t.seen = true; n++; }
  return n; }
function campFoeReveal(now, dt){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld) return 0;
  if(!now){ CAMPB._fsT = (CAMPB._fsT || 0) - (dt || 0);
    if(CAMPB._fsT > 0) return 0; }
  campFoeRevealGate();                                      // 🚪 막고 선 것은 늘 보인다(교착 방지)
  CAMPB._fsT = CAMP_FOE_SEE_T;
  const mine = (CAMPB.me && CAMPB.me.units) || [];
  let n = 0;
  for(const b of CAMPB._fbld){
    if(!b || b.seen) continue;
    if(b.dead){ b.seen = true; n++; continue; }             // 이미 깬 것은 당연히 보인다
    for(const u of mine){ if(u.dead) continue;
      const r = (u.acq || 300) * CAMP_FOE_SEE_R;
      const dx = b.x - u.x, dy = b.y - u.y;
      if(dx * dx + dy * dy <= r * r){ b.seen = true; n++; break; } } }
  return n; }

// 🌫 깬 건물 **둘레**가 드러난다 — 안쪽으로 길이 열리는 느낌.
//   ⭐ 이게 있어야 안개가 「가리는 장치」가 아니라 **「나아가면 열리는 장치」**가 된다.
const CAMP_FOE_SEE_NEAR = 170;           // 깬 건물에서 이 거리 안은 같이 드러난다(전장 좌표)
function campFoeRevealNear(b){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld || !b) return 0;
  const R2 = CAMP_FOE_SEE_NEAR * CAMP_FOE_SEE_NEAR; let n = 0;
  for(const q of CAMPB._fbld){ if(!q || q.seen) continue;
    const dx = q.x - b.x, dy = q.y - b.y;
    if(dx * dx + dy * dy <= R2){ q.seen = true; n++; } }
  return n; }

// ── ⏱ 최고기록 타이머 ────────────────────────────────────────────────────
//   ⭐ 「지난 회차 3시간 → 이번 40분」. 같은 던전 셋을 회차마다 다시 해도 **나와의 경주**가 된다.
function campDgTimerTick(dt){
  const C = (typeof campState === 'function') ? campState() : null;
  const dg = (typeof campDgN === 'function') ? campDgN() : 0;
  if(!C || dg <= 0) return 0;
  if(!C.dgT) C.dgT = {};
  const t = C.dgT[dg] || (C.dgT[dg] = { cur:0, best:0 });
  t.cur = (t.cur || 0) + dt;
  return t.cur; }
// 던전을 완주했다 — 이번 기록을 최고기록과 견준다. 되돌아온 값이 **새 최고기록이면 true**.
function campDgTimerDone(dg){
  const C = (typeof campState === 'function') ? campState() : null; if(!C || !C.dgT) return false;
  const t = C.dgT[dg | 0]; if(!t) return false;
  const fresh = !t.best || t.cur < t.best;
  if(fresh) t.best = t.cur;
  t.cur = 0;
  return fresh; }
// 던전에 들어갈 때 이번 판 시계를 0 으로 (⚠ 최고기록은 안 건드린다)
function campDgTimerReset(dg){
  const C = (typeof campState === 'function') ? campState() : null; if(!C) return false;
  if(!C.dgT) C.dgT = {};
  const t = C.dgT[dg | 0] || (C.dgT[dg | 0] = { cur:0, best:0 });
  t.cur = 0; return true; }

// ── 🚪 던전에 들어간다 — **유일한 입구** ─────────────────────────────────
//   ⭐ 다락에 있던 옛 `campEnterDungeon`(라운드를 0 으로)을 새 계약으로 되살린 것이다.
//   🏰 **늘 그 던전 처음부터**다 — 부순 건물이 되살아나고 시계가 0 으로 돌아간다(§0-A).
//     ⛔ 「라운드를 골라 들어간다」로 되돌리지 말 것: 관문은 건물이고 중간 진입이 없다.
function campEnterDungeon(dg){
  const C = (typeof campState === 'function') ? campState() : null; if(!C) return 0;
  const mx = (typeof CAMP_DG_MAX !== 'undefined') ? CAMP_DG_MAX : CAMP_DG_MAX_N;
  const n = Math.max(0, Math.min(mx, dg | 0));
  C.dg = n; C.broken = 0; C.foeDead = {}; C.foeTgt = null;
  C.cleared = 0; C.rnd = 1;                       // 🧷 옛 값 — 저장 호환용으로만 남긴다
  if(n > 0) campDgTimerReset(n);                  // ⏱ 이번 판 시계를 0 으로(최고기록은 안 건드린다)
  if(typeof campSave === 'function') campSave();
  if(typeof campBarReset === 'function') campBarReset();
  if(typeof campSkin === 'function') campSkin();  // 🎨 바닥을 그 던전 그림으로
  // 🏰 전장이 열려 있으면 적 기지도 그 던전 것으로 다시 세운다
  if(typeof CAMPB !== 'undefined' && CAMPB) campFoeBase(n);
  return n; }
