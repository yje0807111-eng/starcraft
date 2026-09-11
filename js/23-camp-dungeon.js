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
//   🎲 **자리는 표에 없다** — `campFoeLayout(d, seed)` 가 원정마다 새로 뽑는다(2026-09-09 사용자: 「항상 정해져 있지 않고
//     랜덤으로」). 규칙은 고정이고 세부 자리만 씨앗 난수다: **맨 위 본진 → 그 아래 테크 → 앞줄 생산**(내 기지를 뒤집은
//     거울 · 사용자 확정) · 문지기 탑은 구간 앞 가운데 · 보급고류는 좌우 바깥. 좌표는 격자 비율이고 `campG2W` 가 전장으로 바꾼다.
//     ⚠ 적 기지는 격자 **위 한 화면**(gy −0.43~0.05 · CAMP_LANE_TOP=−0.26 · 전장 y 는 0 이상이어야 한다 — 하한 gy −0.43).
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
      { k:'turret', role:'side', kind:'tower', zone:1 },
      { k:'barracks', role:'prog', kind:'prod', zone:1, step:1, foe:['marine'] },
      { k:'factory', role:'prog', kind:'prod', zone:1, step:2, foe:['machinegun','marine'] },
      { k:'supply', role:'side', kind:'depot', zone:1 },
      // 구간 2 — 문지기 벙커
      { k:'bunker', role:'side', kind:'tower', zone:2 },
      { k:'engbay', role:'prog', kind:'tech', zone:2, step:3, foe:['ghost','marine'] },
      { k:'refinery', role:'prog', kind:'res',  zone:2, step:4, foe:['machinegun','ghost'] },
      { k:'supply', role:'side', kind:'depot', zone:2 },
      // 구간 3 — 문지기 포탑 + 본진
      { k:'turret', role:'side', kind:'tower', zone:3 },
      { k:'academy', role:'prog', kind:'tech', zone:3, step:5, foe:['racer','marine'] },
      { k:'command', role:'prog', kind:'main', zone:3, step:6, foe:['goliath','tank','marine'] },
      { k:'supply', role:'side', kind:'depot', zone:3 } ] },
  // ── D2 스웜 기지 — 「연구가 필요하다」. 기믹: **공중이 섞인다**(대공이 없으면 못 깬다) ──
  { race:'swarm', name:'감염된 둥지', lesson:'research', air:true,
    desc:'적이 단단하다 — 연구 없이는 못 깬다. 하늘에서도 온다',
    bld:[
      { k:'sunken', role:'side', kind:'tower', zone:1 },
      { k:'pool', role:'prog', kind:'prod', zone:1, step:1, foe:['broodling'] },
      { k:'hydraden', role:'prog', kind:'prod', zone:1, step:2, foe:['snapper','broodling'] },
      { k:'creep', role:'side', kind:'depot', zone:1 },
      { k:'spore', role:'side', kind:'tower', zone:2 },
      { k:'evochamber', role:'prog', kind:'tech', zone:2, step:3, foe:['hydra','snapper'] },
      { k:'extractor', role:'prog', kind:'res',  zone:2, step:4, foe:['hydra','broodling'] },
      { k:'creep', role:'side', kind:'depot', zone:2 },
      { k:'sunken', role:'side', kind:'tower', zone:3 },
      { k:'lair', role:'prog', kind:'tech', zone:3, step:5, foe:['thornqueen','hydra'] },
      { k:'hatchery', role:'prog', kind:'main', zone:3, step:6, foe:['ultralisk','thornqueen','hydra'] },
      { k:'creep', role:'side', kind:'depot', zone:3 } ] },
  // ── D3 에테리얼 기지 — 「조합 + 최종」. 기믹: **동력탑이 그 구간의 탑을 먹인다** ──
  //   ⭐ 이 설계의 가장 좋은 한 칸이다 — 문지기 탑을 **직접 깨든, 그 구간의 파일런을 깨든** 문이 열린다.
  //     「어느 걸 먼저」가 진짜 판단이 된다. ⛔ D1·D2 에는 넣지 않는다(배우기 전에 나오면 그냥 어렵다).
  //   ⚠ 파일런은 **보급고이면서 동력탑**이다(kind:'depot' + power:true) — 깨면 버프도 오고 문도 열린다.
  { race:'aetherial', name:'잊혀진 회랑', lesson:'mix', powered:true,
    desc:'동력탑이 문지기를 먹인다 — 무엇을 먼저 깰지가 갈린다',
    bld:[
      { k:'cannon', role:'side', kind:'tower', zone:1 },
      { k:'gateway', role:'prog', kind:'prod', zone:1, step:1, foe:['blade'] },
      { k:'stargate', role:'prog', kind:'prod', zone:1, step:2, foe:['dragoon','blade'] },
      { k:'pylon', role:'side', kind:'depot', zone:1, power:true },
      { k:'cannon', role:'side', kind:'tower', zone:2 },
      { k:'forge', role:'prog', kind:'tech', zone:2, step:3, foe:['dark_templar','dragoon'] },
      { k:'assimilator', role:'prog', kind:'res',  zone:2, step:4, foe:['dragoon','blade'] },
      { k:'pylon', role:'side', kind:'depot', zone:2, power:true },
      { k:'cannon', role:'side', kind:'tower', zone:3 },
      { k:'cyber', role:'prog', kind:'tech', zone:3, step:5, foe:['archon','dragoon'] },
      { k:'nexus', role:'prog', kind:'main', zone:3, step:6, foe:['kronos','archangel','archon'] },
      { k:'pylon', role:'side', kind:'depot', zone:3, power:true } ] },
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
//   ⏳ **한 번에 많이 · 주기는 길게** (2026-09-10 사용자 확정) — 무리 사이에 **틈**이 있어야 한다.
//     ⛔ 옛 값(2~5마리 / 1.8~3.4초)은 **틈이 없는 흐름**이었다. 적이 늘 사거리에 있으니 아군이
//       건물을 영영 못 쳤고(본진 60초에 이론 화력의 2%), 그걸 「건물부터 친다」는 우회로 덮었다.
//     ⭐ 지금은 리듬으로 푼다: **몰려온다 → 다 잡는다 → 그 틈에 벽을 친다.**
//       무리를 정리하고 남는 시간이 곧 공성 시간이라, 「우리 화력이 무리를 제때 잡는가」가
//       그 관문의 물음이 된다 — 못 잡으면 적이 쌓여 틈이 사라지고, 그때가 물러날 때다.
//     ⚠ 초당 유입은 옛 값과 비슷하되 **뒤로 갈수록 완만**하다(0.50 → 1.64 · 옛 0.59 → 2.78).
const CAMP_FOE_RELAY_S = [16, 15, 14, 13, 12, 11];         // 단계별 스폰 주기(초) — 조금씩 짧아진다
const CAMP_FOE_RELAY_N = [8, 10, 12, 14, 16, 18];          // 단계별 한 무리 마리 수 — 한 번에 몰려온다
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
//   🔑 **머릿수는 거의 고정, 세기가 오른다**(2026-09-09 · 자동 플레이 여섯 판으로 잡은 벽의 진짜 원인).
//     ⛔ 상한을 관문마다 크게 올리지 말 것. 난이도 사다리가 **개체 세기**를 이미 던전 하나에 ×7.2 로
//       올리는데, 머릿수까지 ×3.2 로 올리면 적 총 전력이 **×23** 이 된다 — 사다리가 말하는 ×7.2 의
//       세 배다. 그래서 관문 1~5 는 4~10초에 끝나고 마지막 관문만 절벽이 됐다(패배가 전부 거기).
//     ⭐ 지금은 ×1.6 — 총 전력이 ×11.5 로 사다리와 같은 자를 쓴다.
//     ⭐ 그리고 **첫 칸을 10 → 16 으로 올렸다**: 초반에 적이 너무 적어 「몰려온다」가 없었고,
//       적을 죽여 버는 돈(마린키우기의 고리)도 그만큼 얇았다.
//   ⚠ **한 무리보다 넉넉해야 한다**(2026-09-10) — 상한이 무리 크기에 가까우면 남은 적이 몇만 있어도
//     다음 무리가 통째로 건너뛰어져 리듬이 들쭉날쭉해진다. 무리의 두 배쯤 둔다.
const CAMP_FOE_LIVE_MAX = [18, 22, 26, 30, 34, 38];        // 단계별 전장에 동시에 살아 있을 수 있는 적
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
// ══ ♾ 무한층 — 던전 셋 위로 끝없이 이어진다 (2026-09-11 · 단계 3) ═════════════
//
// ⭐ **표를 새로 쓰지 않는다.** 무한 n층은 던전 셋 중 하나를 **그대로 빌려** 쓰고(종족 순환)
//   자리만 씨앗이 흔든다. 그래서 커리큘럼·기믹(공중·동력탑)이 층마다 돌아가며 나온다.
//   ⛔ 무한층 전용 건물 표를 만들지 말 것 — 표가 둘이 되면 던전을 고칠 때마다 한쪽이 뒤처진다.
//
// ⭐ **난이도는 사다리를 그대로 잇는다** — 한 층이 던전 하나와 같은 계단이다(관문 여섯 ×7.17).
//   ⛔ 무한층 전용 배율(CAMP_INF_R 류)을 새로 두지 말 것: 두 개의 자가 생기면
//     「던전 3 끝」과 「무한 1층 시작」 사이에 설명할 수 없는 턱이 생긴다.
//
// 🧗 **한 층을 깨면 곧바로 다음 층이 선다**(캠프로 안 돌아온다).
//   ⚠ 던전 1~3 의 ⛔「완주하면 캠프로」와 **다른 규칙이다** — 그 셋은 커리큘럼이라 집에 들러
//     전리품을 쓰고 다시 온다. 무한층은 **등반**이라 「어디까지 버티나」가 전부다.
//   ⭐ 그래서 환생의 「지금 끊을까, 한 층 더 갈까」가 여기서 생긴다(환생 포인트 = 도달 깊이).
//
// ⚠ **값 둘은 안 쟀다**: `CAMP_INF_COIN`(층당 코인)과 무한층 보상 배수(campMineDef 의 외삽).
const CAMP_INF_COIN = 12;                // 무한 n층을 깨면 코인 n × 이 값 — ⛔ 새 재화를 만들지 않는다
const CAMP_INF_DESC = '끝이 없다 — 한 층이 던전 하나만큼 세진다';
let _campInfDefs = {};                   // 층마다 만든 표를 재사용(매 프레임 Object.assign 을 피한다)
// 그 dg 가 무한 몇 층인가(던전이면 0)
function campInfN(dg){ const n = dg | 0, mx = CAMP_DG_MAX_N; return n > mx ? n - mx : 0; }
// 그 층이 빌려 쓰는 던전 번호(1~3) — 종족이 순환한다
function campInfBase(dg){ const f = campInfN(dg);
  if(f <= 0) return Math.max(1, Math.min(CAMP_DG_MAX_N, dg | 0));
  return ((f - 1) % CAMP_DG_MAX_N) + 1; }
function campInfDef(dg){ const f = campInfN(dg); if(f <= 0) return null;
  if(_campInfDefs[dg]) return _campInfDefs[dg];
  const src = CAMP_DG[campInfBase(dg)];
  const d = Object.assign({}, src, { name:'무한 ' + f + '층', inf:f, desc:CAMP_INF_DESC });
  _campInfDefs[dg] = d; return d; }
// 그 던전의 표. ♾ 표 밖은 무한층이다(위).
function campDgDef(dg){ const n = dg | 0; if(n <= 0) return null;
  return (n < CAMP_DG.length) ? CAMP_DG[n] : campInfDef(n); }
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
  const C0 = (typeof campState === 'function') ? campState() : null;
  const lay = campFoeLayout(d, (C0 && C0.foeSeed) || 1);   // 🎲 이번 원정의 자리(씨앗은 campEnterDungeon 이 뽑는다)
  for(const q of d.bld){
    const eid = 'fb' + dg + '_' + (i++);                   // ⚠ 자리마다 고정된 id — 같은 던전이면 늘 같다
    const def = campFoeBldDef(d.race, q.k);
    const k = CAMP_FOE_BLD_K[q.kind] || 1;
    const hp = Math.max(1, Math.round(CAMP_FOE_BLD_HP0 * k * _bdiff(q)));
    const g = lay.bld[i - 1];
    const p = (typeof campG2W === 'function') ? campG2W(g.gx, g.gy, W) : { x:W * g.gx, y:W * g.gy };
    out.push({ x:p.x, y:p.y, gx:g.gx, gy:g.gy, eid:eid, bk:q.k, role:q.role, kind:q.kind,
      zone:q.zone | 0, step:q.step | 0, spawn:q.foe || null,
      nm:(def && def.name) || q.k, ico:(def && def.ico) || '',
      power:!!q.power, foe:true,                           // foe:true = 「적 것」 표식(내 건물과 가른다)
      hp:hp, max:hp, maxHp:hp, dead:!!dead[eid],
      seen:false, _twT:0 });
  }
  CAMPB._fbld = out;
  CAMPB._fmine = lay.mine; CAMPB._fgas = lay.gas;           // ⛏ 적 광맥·가스 자리(연출 · 19-camp 가 그린다)
  // 👁 **앞줄은 처음부터 보인다.** ⛔ 전부 가리면 표적이 하나도 없어 병력이 집결점에 선 채
  //   영영 안 나아간다 — 안개가 진행을 막아 버린다(닭과 달걀). 내 쪽에서 가장 가까운
  //   세 채를 열어 주면 거기서부터 시야가 번져 나간다.
  { const cand = out.slice().sort(function(a, b){ return b.y - a.y; });  // y 큰 것 = 내 쪽
    for(let j = 0; j < Math.min(3, cand.length); j++) cand[j].seen = true; }
  campFoeReveal(true);                                     // 그 밖에 이미 시야에 든 것도 바로 드러낸다
  // 👁 기지가 서는 순간 뷰를 그쪽으로 — 전장은 campEnterDungeon 이 아니라 **첫 campCombatStep** 이 여니
  //   (실측: 진입 때는 CAMPB 가 아직 없다) 여기서 걸어야 실제로 보인다.
  campFoeLookAt();
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
// 👁 **화면에 보이나** — 안개가 켜져 있으면 「눈으로 본 것(vis)」, 꺼져 있으면 옛 기준(seen).
//   ⭐ 그리는 쪽(3D·표식)과 만지는 쪽(탭·쪽지)이 **같은 자**를 써야 한다 — 안 그러면 안 보이는 것이 눌린다.
//   ⚠ `campFoeCanTarget`(엔진의 표적 판정)은 **seen** 그대로다 — 아군이 나아갈 목표가 없으면 교착이다(campFoeRevealGate).
function campFoeShown(b){
  if(!b) return false;
  const fog = (typeof campFogOn === 'function') && campFogOn() && (typeof techFogEnabled === 'function') && techFogEnabled();
  return fog ? !!b.vis : !!b.seen; }
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
    if(typeof campNote === 'function') campNote('broken', 1);   // 🧭 가이드 — 진행 건물을 하나 부쉈다
    if(!C.best) C.best = {};
    C.best[C.dg] = Math.max(C.best[C.dg] | 0, C.broken);    // 룬 칸·환생이 읽는 「최고 도달」
    // 🩹 **관문 보상 = 전체 회복** — 옛 「라운드 시작」의 자리다. ⛔ 부활은 없다(2026-09-10).
    if(typeof campRescaleMine === 'function') campRescaleMine();   // 🏛 내 기지도 그 관문의 자로
    if(typeof campHealAll === 'function') campHealAll();
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
  const n = CAMP_FOE_RELAY_N[i] | 0;
  // 🧯 상한에 닿았으면 안 보낸다 — ⛔ 이 줄을 빼면 못 이기는 판이 반드시 지는 판이 된다(위 설명).
  //   ⚠ **대기 중인 무리도 센다**(_wq) — 안 세면 큐에 쌓아 두었다가 한꺼번에 쏟아진다.
  //   ⚠ **무리 전체가 들어갈 자리**를 본다(2026-09-10). 「한 마리라도 들어가나」로 재면
  //     무리가 커진 지금(8~18마리) 상한을 **최대 무리−1 만큼 넘긴다**(실측 24 > 18).
  //   ⭐ 통째로 미루는 것이 리듬에도 맞다 — 전장이 어느 정도 비어야 다음 무리가 온다.
  { const live = campFoeLive(), pend = campFoePendN();
    if(live + pend + n > (CAMP_FOE_LIVE_MAX[i] | 0)){ CAMPB._fspT = CAMP_FOE_RELAY_S[i]; return 0; } }
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
  // ♾ 위쪽 한계가 없다(무한층) — 어디까지 갈 수 있나는 `campDgOpen` 이 정한다(12-appshell).
  const n = Math.max(0, dg | 0);
  C.dg = n; C.broken = 0; C.foeDead = {}; C.foeTgt = null;
  // 🎲 원정마다 새 배치 — 같은 원정 안(저장·복원)에서는 같은 씨앗이라 자리가 안 바뀐다
  if(n > 0) C.foeSeed = campFoeNewSeed();
  C.cleared = 0; C.rnd = 1;                       // 🧷 옛 값 — 저장 호환용으로만 남긴다
  if(n > 0) campDgTimerReset(n);                  // ⏱ 이번 판 시계를 0 으로(최고기록은 안 건드린다)
  if(typeof campSave === 'function') campSave();
  if(typeof campBarReset === 'function') campBarReset();
  if(typeof campSkin === 'function') campSkin();  // 🎨 바닥을 그 던전 그림으로
  if(typeof campFogSync === 'function') campFogSync();   // 🌫 적 구역은 덮고 내 기지는 연다(0단계면 꺼진다)
  // 🏰 전장이 열려 있으면 적 기지도 그 던전 것으로 다시 세운다
  if(typeof CAMPB !== 'undefined' && CAMPB) campFoeBase(n);
  if(n > 0 && typeof CAMPB !== 'undefined' && CAMPB) campFoeLookAt();   // 👁 적 기지가 보이는 자리로
  if(n === 0 && typeof campZoom === 'function') campZoom();               // 🏕 집으로 — 시점도 기본 자리로(v·t 함께)
  return n; }


// ══ 🖼 화면이 읽는 것 — **모델만 준다**(DOM 은 19-camp · 3D 는 90-m3d 가 그린다) ═════════════
//   ⭐ 적 기지 화면은 ③안 「밑변 광원」이다(REDESIGN_PLAN §위험 2 · 목업 docs/mock/camp-foebase-4.html).
//     진행 건물 6채만 바닥이 붉다 · 다음 표적은 붉은 모서리 · 못 본 건물은 속 빈 실루엣 ·
//     잔해는 ✕ · 체력 선은 맞은 건물에만. ⛔ 번호 배지·깃발·후광을 붙이지 말 것 · ⛔ 부수 건물을 물리지 말 것.
// 🏗 **3D 엔트리** — 기지 건물이 syncBuild 에 들어가는 것과 **같은 규약**(14-input-fx.js:910~ 의 건물 줄).
//   캠프 프레임이 M3D.syncBuild 를 감쌀 때(19-camp campWithBattleDraw) 전투 유닛 뒤에 덧붙인다.
//   ⚠ 안 본 것(seen=false)은 hidden 으로 넘긴다(안개 규약 — 자리는 잡되 그리지 않는다) · 죽은 것은 안 넘긴다(잔해는 2D ✕).
//   ⚠ race 는 **던전 종족**(TECH_MODEL 키) — 내 종족이 아니다. ⛔ 두 번째 3D 동기화 함수를 만들지 말 것.
function campFoeBld3D(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld || typeof G === 'undefined' || !G.tech) return [];
  const d = campDgDef((typeof campDgN === 'function') ? campDgN() : 0); if(!d) return [];
  if(typeof TECH_MODEL === 'undefined' || !TECH_MODEL[d.race] || typeof _techW2S !== 'function') return [];
  const v = G.tech.view || { x:0.5, y:0.5, zoom:1 }, W = CAMPB.world || 1;
  const map = document.getElementById('cstMain'), Wpx = (map && map.clientWidth) || 360;
  const cw = _techCW(), ch = _techCH(), cwpx = cw * Wpx * v.zoom;
  const rows = Math.max(1, (typeof _techRows === 'function') ? _techRows() : 28), zstep = Math.min(60, 2600 / (rows + 1));
  // ⚠ 적 기지는 격자 **위**(wy < techY0)라 행이 음수 → z 가 −1000 아래로 내려가 카메라 가시범위(−1200)를 벗어난다
  //   (실측: 3D 가 통째로 안 보였다). 위쪽 것끼리 순서만 지키면 되므로 −1190 에서 받는다.
  const zOf = function(wy){ return Math.max(-1190, -1000 + Math.floor((wy - techY0()) / ch) * zstep); };
  const yaw = (d.race === 'swarm') ? 0 : ((typeof CST_YAW !== 'undefined') ? CST_YAW : 0);
  const out = [];
  for(const q of CAMPB._fbld){
    if(!q || q.dead) continue;
    const mk = TECH_MODEL[d.race][q.bk]; if(!mk) continue;
    const cfg = (typeof CST_BLDG_CFG !== 'undefined') ? CST_BLDG_CFG[mk] : null;
    const g = (typeof campW2G === 'function') ? campW2G(q.x, q.y, W) : { gx:q.x / W, gy:q.y / W };
    const bf = (typeof _techFoot === 'function') ? _techFoot(d.race, q.bk) : { w:2, h:2 };
    const by = g.gy + (bf.h / 2) * ch;
    const x = (g.gx - v.x) * v.zoom + 0.5, y = (by - v.y) * v.zoom + 0.5;
    if(x < -0.3 || x > 1.3 || y < -0.3 || y > 1.3) continue;
    out.push({ uid:'cst_foe_' + q.eid, id:'cb_' + mk, x:x, y:y,
      face:yaw + ((cfg && cfg.f) || 0), yoff:-3, dy:((cfg && cfg.dy) || 0), lift:0,
      fitW:bf.w * cwpx * ((typeof CST_BVIS !== 'undefined') ? CST_BVIS : 1.12) * CAMP_FOE_SCL, rimCol:campFoeRim(),
      sel:false, buildP:null, hidden:!campFoeShown(q), z:zOf(by) }); }
  for(const w of campFoeWorkers3D(v, cwpx)) out.push(w);        // 🚶 적 일꾼(연출)
  return out; }
// 👁 **던전에 들어가면 적 기지가 보이게 뷰를 맞춘다**(REDESIGN_PLAN §위험 2 「12채가 화면에 다 드나」).
//   ⛔ 새 팬·줌 장치가 아니다 — 기지 맵의 목표 뷰(techViewT)를 한 번 옮기고 나머지는 원래 장치가 따라간다.
//   ⭐ 축소는 한계(techMinZoom)까지, 세로는 **위 끝**(clamp 가 정한다 = 적 기지 위끝 + 상단바 몫).
//     내 본부는 안 보인다 — 원정 시작은 「무엇을 부술지」를 보는 것이다(2026-09-09 사용자: 「적 기지가 화면 완전 위」).
//     ⚠ 적 기지는 격자 위 한 화면에 있다(19-camp CAMP_LANE_TOP) — 아래로 끌면 내 기지가 나온다.
//   ⚠ 캠프(0)로 돌아갈 때는 손대지 않는다 — 기지 맵의 제 뷰로 돌아간다.
function campFoeLookAt(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld || !CAMPB._fbld.length) return false;
  if(typeof techViewT !== 'function' || typeof techView !== 'function' || typeof _techClampView !== 'function') return false;
  const W = CAMPB.world || 1;
  // 🌫 **안개가 켜져 있으면 「보이는 것」에만 맞춘다**(2026-09-10) — 12채 전체에 맞추면 진입 화면이
  //   통째로 검다(적 기지는 아직 안 봤다). 진입 때 보이는 것은 관문 규칙으로 드러난 앞줄 몇 채다.
  //   ⛔ 안개를 끄고 전체를 보여 주지 말 것 — 그러면 탐험이 사라진다.
  const _fog = (typeof campFogOn === 'function') && campFogOn() && (typeof techFogEnabled === 'function') && techFogEnabled();
  const _list = _fog ? CAMPB._fbld.filter(function(q){ return campFoeShown(q); }) : CAMPB._fbld;
  // 🏠 아직 **한 채도 못 봤으면**(원정 첫 순간) 집을 보여 준다 — 적 기지에 맞추면 통째로 검은 화면이다.
  if(_fog && !(_list && _list.length)){ if(typeof campZoom === 'function') campZoom(); return true; }
  const list = (_list && _list.length) ? _list : CAMPB._fbld;
  let sy = 0, n = 0;
  for(const q of list){ if(!q) continue; const g = campW2G(q.x, q.y, W); sy += g.gy; n++; }
  if(!n) return false;
  const foeY = sy / n;
  const t = techViewT(), v = techView();
  // 🔍 줌 — 기지 세로(광맥 위끝 ~ 앞줄 탑 아래끝 + 여유)가 **상단바 아래·시트 위**에 다 들게. 하한은 campMinZoom(1.0).
  let lo0 = 0, hi0 = 0;
  { let lo = 1, hi = -1;
    for(const q of list){ if(!q) continue; const g = campW2G(q.x, q.y, W); if(g.gy < lo) lo = g.gy; if(g.gy > hi) hi = g.gy; }
    if(!_fog) for(const m of (CAMPB._fmine || [])){ if(m.gy < lo) lo = m.gy; }   // 안개 중엔 광맥도 안 보인다
    // 🌫 안개 중에는 **내 격자 위끝까지** 담는다 — 위쪽은 어차피 검다. 보이는 것은
    //   「내 진영의 앞마당 ~ 드러난 적 앞줄」이고, 그 사이가 이번에 나아갈 길이다.
    //   ⚠ 내 **본부**까지 담으면 세로가 0.96 이 되어 축소 하한(1.0)에 걸린다 — 그러면 위아래가 잘린다(실측).
    if(_fog && typeof techY0 === 'function') hi = Math.max(hi, techY0() + 0.06);
    const span = Math.max(0.2, hi - lo + 0.12);
    const sf = (typeof techSheetFrac === 'function') ? techSheetFrac() : 0.21;
    const avail = Math.max(0.3, 1 - 0.13 - sf);
    // ↔ 가로도 다 들어야 한다(2026-09-10 실측: 세로만 맞추니 줌 1.49 에서 바깥 보급고 0.13/0.87 이 화면 밖) — 발판 반 칸 + 여유
    let hx = 0; for(const q of list){ if(!q) continue; const g = campW2G(q.x, q.y, W); hx = Math.max(hx, Math.abs(g.gx - 0.5)); }
    const zx = 1 / (2 * hx + 0.10 + 0.06);
    t.zoom = Math.max(campMinZoom(), Math.min((typeof techMaxZoom === 'function') ? techMaxZoom() : 3, avail / span, zx));
    lo0 = lo; hi0 = hi; }
  t.x = 0.5;
  // 🌫 안개 중에는 위 끝으로 밀지 않는다 — 밀면 **검은 화면**으로 시작한다(실측 2026-09-10).
  t.y = _fog ? ((lo0 + hi0) / 2) : (foeY - 9);      // 위로 한껏 — clamp 가 위 끝(campViewTop)에서 받는다

  _techClampView(t);
  // ⚠ **목표(t)만 옮긴다** — 실제 뷰(v)는 techViewTick 이 보간해 따라간다. v 를 직접 쓰면 바닥·광맥·그림자
  //   (renderBuildTab 이 뷰가 바뀔 때 다시 그리는 층)가 옛 자리에 남는다(실측: 바닥 transform 이 옛 뷰였다).
  //   내 기지에서 적 기지로 **올라가는 한 박자**가 원정 출발의 연출이기도 하다.
  return true; }
// 🎨 오버레이 모델 — 건물마다 「어디에·어떤 상태로」. 19-camp 의 campFoeOverlayHTML 이 이걸 DOM 으로 옮긴다.
//   상태: prog/side · tgt(다음 표적) · hid(안개) · dead(잔해) · lock(구간이 잠겨 아직 못 때린다) · hit(맞았다)
function campFoeMarks(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld) return [];
  const d = campDgDef((typeof campDgN === 'function') ? campDgN() : 0); if(!d) return [];
  const W = CAMPB.world || 1, tgt = campFoeFront(), out = [];
  for(const b of CAMPB._fbld){
    if(!b) continue;
    const _shown = campFoeShown(b);
    const g = (typeof campW2G === 'function') ? campW2G(b.x, b.y, W) : { gx:b.x / W, gy:b.y / W };
    const foot = (typeof _techFoot === 'function') ? _techFoot(d.race, b.bk) : { w:2, h:2 };
    out.push({ eid:b.eid, nm:b.nm, x:g.gx, y:g.gy, fw:foot.w, fh:foot.h,
      prog:b.role === 'prog', tower:b.kind === 'tower', depot:b.kind === 'depot',
      tgt:!!(tgt && tgt.eid === b.eid), hid:!_shown, dead:!!b.dead,
      lock:(b.role === 'prog' && !b.dead && _shown && !campFoeZoneOpen(b.zone)),
      hp:b.hp, max:b.max, hit:(!b.dead && _shown && b.hp < b.max) }); }
  return out; }
// 🗺 맵 띠 오른쪽에 적을 이름 — 「다음 공학소」. 없으면 빈 문자열(띠가 칸을 감춘다).
function campFoeTgtName(){ const t = campFoeFront(); return t ? (t.nm || t.bk || '') : ''; }
// 👆 적 건물을 눌렀다 — 격자 좌표(gx·gy)에서 가장 가까운 **살아 있고 본** 건물. 발판 반폭 안이어야 한다.
//   ⭐ 누르는 것은 「들여다보기」다(CAMPB._foeSel · 세션 값 · 저장 안 함) — 시트에 프로필이 뜨고,
//     **표적 지정은 그 카드**(campFoeTgtSet)가 한다. 잠긴 건물도 눌리며 왜 잠겼는지 읽을 수 있다.
//   ⛔ 여기서 바로 foeTgt 를 박지 말 것 — 잠긴 건물을 누르면 아무 일도 안 일어나 「안 눌린다」로 느껴진다(실측).
//   ⚠ 안개에 가린 것은 안 잡힌다(실루엣은 있지만 무엇인지 모르는 것이 안개의 뜻이다).
function campFoeTapAt(gx, gy){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld) return null;
  const d = campDgDef((typeof campDgN === 'function') ? campDgN() : 0); if(!d) return null;
  const W = CAMPB.world || 1, cw = (typeof _techCW === 'function') ? _techCW() : 0.05,
        ch = (typeof _techCH === 'function') ? _techCH() : 0.05;
  let best = null, bd = 1e9;
  for(const b of CAMPB._fbld){
    if(!b || b.dead || !campFoeShown(b)) continue;   // 🌫 안 보이는 것은 안 잡힌다(campFoeShown)
    const g = (typeof campW2G === 'function') ? campW2G(b.x, b.y, W) : { gx:b.x / W, gy:b.y / W };
    const foot = (typeof _techFoot === 'function') ? _techFoot(d.race, b.bk) : { w:2, h:2 };
    const hw = Math.max(1, foot.w) * cw * 0.6, hh = Math.max(1, foot.h) * ch * 0.6;
    const dx = (gx - g.gx) / hw, dy = (gy - g.gy) / hh, dd = dx * dx + dy * dy;
    if(dd <= 1 && dd < bd){ bd = dd; best = b; } }
  if(!best) return null;
  CAMPB._foeSel = best.eid;
  return best; }

// 🗂 적 건물 프로필 — **공용 커맨드 카드 모델**(renderCmdGrid · CLAUDE.md 「프로필/커맨드 그리드」).
//   ⛔ 시트를 새로 만들지 말 것 — 내 건물(techBldgPlainModel)과 같은 껍데기에 「공격 대상」 카드 하나다.
function campFoeSheetModel(b){
  if(!b) return null;
  const d = campDgDef((typeof campDgN === 'function') ? campDgN() : 0);
  const C = (typeof campState === 'function') ? campState() : null;
  const isTgt = !!(C && C.foeTgt === b.eid), can = campFoeCanTarget(b);
  const role = b.role === 'prog' ? ('진행 ' + b.step + '/' + CAMP_DG_STEPS)
             : (b.kind === 'tower' ? '문지기 탑' : (b.kind === 'depot' ? '보급고' : '부수'));
  const why = !campFoeShown(b) ? '아직 못 봤다' : (b.dead ? '이미 부쉈다' : (!campFoeZoneOpen(b.zone) ? ('구간 ' + b.zone + ' 문지기 탑이 살아 있다') : ''));
  const loot = b.kind === 'res' ? '가스' : b.kind === 'prod' ? '미네랄' : b.kind === 'tech' ? '연구 시간 −'
             : b.kind === 'main' ? '미네랄 + 가스' : b.kind === 'depot' ? '⚡ 잠시 자원 ×2' : '—';
  // ⚠ 잠김 표기는 **진행 건물에만** — 탑·보급고는 언제든 때릴 수 있다(실측: 탑 자체에 「잠김」이 떠 헷갈렸다)
  const stats = [['역할', role], ['구간', String(b.zone) + ((b.role === 'prog' && !campFoeZoneOpen(b.zone)) ? ' · 🔒 잠김' : '')],
                 ['부수면', loot]];
  if(b.spawn && b.spawn.length) stats.push(['뽑는 적', b.spawn.join(' · ')]);
  const ico = (typeof _techBldgPortrait === 'function') ? _techBldgPortrait(b.bk, b.ico) : '';
  const hpsh = (typeof _cgHpShStr === 'function') ? _cgHpShStr(Math.max(0, Math.round(b.hp)), 0) : '';
  return { mode:'info', foeEid:b.eid, title:b.nm || b.bk, icon:ico, hpsh:hpsh,
    sub:(d ? d.name : '적 기지') + (why ? (' · ' + why) : ''),
    items:[{ pro:(typeof pIco === 'function') ? pIco('⚔') : '⚔', sn:isTgt ? '표적 해제' : '공격 대상',
             tr:isTgt ? '표적' : '', metaCls:'lv', sel:isTgt, state:can ? 'ok' : 'dim',
             act:'onclick="campFoeTgtSet(event,\'' + b.eid + '\')"' }],
    info:{ stats:stats } }; }
// 카드가 부른다 — 이미 표적이면 푼다(자동으로 돌아간다)
function campFoeTgtSet(ev, eid){
  if(ev && ev.stopPropagation) ev.stopPropagation();
  const C = (typeof campState === 'function') ? campState() : null; if(!C) return;
  const b = (CAMPB && CAMPB._fbld || []).find(function(q){ return q && q.eid === eid; });
  if(!b || !campFoeCanTarget(b)){ if(typeof playSfx === 'function') playSfx('ui_denied'); return; }
  C.foeTgt = (C.foeTgt === eid) ? null : eid;
  if(typeof campSave === 'function') campSave();
  if(typeof playSfx === 'function') playSfx('ui_tab');
  if(typeof campFoeSheet === 'function') campFoeSheet(); }
// 지금 열어 둔 적 건물(시트가 보여 줄 것) — 눌러 둔 것(_foeSel). 죽었으면 없는 것으로.
function campFoePicked(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld || !CAMPB._foeSel) return null;
  const b = CAMPB._fbld.find(function(q){ return q && q.eid === CAMPB._foeSel; });
  if(!b || b.dead){ CAMPB._foeSel = null; return null; }
  return b; }
// 들여다보기를 닫는다(⊘ 해제와 같은 뜻) — 19-camp 의 지정 해제가 부른다
function campFoeUnpick(){ if(typeof CAMPB !== 'undefined' && CAMPB) CAMPB._foeSel = null; }

// 👁 **뷰의 위 한계** — 던전 안에서는 적 기지 위끝까지 올라간다(17-build-cards _techClampView 가 부른다).
//   캠프(0)에서는 격자 위끝(techY0) 그대로 — 적 기지가 없는데 빈 하늘로 올라갈 이유가 없다.
//   ⚠ 여유는 표의 가장 위 건물 + **0.18** — 상단바(재화 바 · 화면 위 13% ≈ 격자 0.09)와 발판 반 칸(0.06)이
//     그 위를 덮기 때문이다(실측: 0.06 이면 위 끝에서 3채가 재화 바 뒤에 숨었다). 값이 아니라 표에서 읽는다.
function campViewTop(){
  const dg = (typeof campDgN === 'function') ? campDgN() : 0;
  const y0 = (typeof techY0 === 'function') ? techY0() : 0.18;
  if(dg <= 0) return y0;
  const d = campDgDef(dg); if(!d || !d.bld || !d.bld.length) return y0;
  const lay = campFoeLayout(d, ((typeof campState === 'function' && campState()) || {}).foeSeed || 1);
  let top = 1; for(const q of lay.bld) if(q.gy < top) top = q.gy;
  for(const m of lay.mine) if(m.gy < top) top = m.gy;
  return Math.min(y0, top - 0.18); }


// ══ 🎲 적 기지 배치 생성기 — 규칙은 고정 · 자리는 씨앗 (2026-09-09 사용자 확정) ═════════
//   ⭐ **내 기지를 뒤집은 거울**: 맨 위 본진(6) → 테크(5·4·3) → 앞줄 생산(2·1). 문지기 탑은 각 구간 **앞**
//     가운데(그 탑을 깨야 구간이 열린다 · campFoeZoneOpen) · 보급고류는 좌우 바깥.
//   ⭐ 광맥·가스도 뽑는다 — 본진 **위**에 광맥 호(내 기지의 거울 · 위로 볼록), 가스는 구간 2 옆.
//     ⚠ 둘 다 **연출**이다(사용자 확정 「연출만」) — 게임 값에 안 들어간다. 적 정제소(res)를 깨면 나오는
//     전리품은 그대로다.
//   🎲 씨앗 = C.foeSeed(원정마다 새로) — ⛔ Math.random 을 쓰지 말 것: 저장·복원하면 자리가 바뀌고 스모크가 못 잰다.
//   📐 세로 자리(격자 gy): 광맥 −0.48 · 본진 −0.42 · 구간3 테크 −0.38(본진 옆) · 탑③ −0.34 · 구간2 테크 −0.30 · 탑② −0.26 ·
//     생산 −0.22 · 탑① −0.18. ⚠ 구간3 테크와 구간2 테크는 **다른 줄**이다 — 한 줄에 두면 좌우 교대가 같은 열을 다시 잡아
//     겹친다(실측: engbay · academy). ⚠ 건물 하한 −0.43 — 그 위는 전장 y 가 음수가 된다(18-strike 길찾기 셀). 상단 여유는 campViewTop 이 준다.
//   🗺 **기지 전체가 그림의 고원 안에 선다**(2026-09-10 사용자: 「미네랄을 더 위로 · 건물은 판 안에 더 작은 비율로」) — 던전 바닥
//     그림(ART.md §17)은 위 8~27% 가 적 고원이고, 바닥은 격자 위 0.58 까지 늘려 깐다(css/30-home.css .bmapFloor::before) →
//     고원 = gy −0.48 ~ −0.16. 그래서 광맥 −0.48(고원 위 홈) · 탑① −0.18(고원 아래 턱) 이고, 줄 간격은 **0.08** 로 조였다.
//     ⚠ 광맥은 연출이라 하한(−0.43) 위여도 된다(전장 좌표를 안 쓴다). 건물은 본진 −0.42 가 끝이다(세로 흔들림 없음).
//   📏 **같은 열에 서는 쌍은 줄 차이 − 흔들림 합 ≥ 0.07(발판)** 이어야 한다 — 씨앗 12,000개를 돌려 잡은 규칙(scratch seeds.mjs):
//     가운데 열(본진·탑 셋)은 0.08 간격에 흔들림 0 · 옆 열(테크③·테크②·생산)은 0.08 − 0.005×2 = 0.07.
//     ⛔ 값을 옮기면 스모크의 겹침 검사(900판)가 씨앗에 따라 터진다.
//   🏔 **고원에는 높은 테크만, 통로에는 펼쳐서**(2026-09-10 사용자): 본진·테크·탑③ 은 고원 · 탑②·생산·탑① 은 통로에
//     0.08~0.10 간격으로 내려온다. 앞줄(탑① +0.02)은 **진입 화면의 가운데보다 조금 아래**까지만 — 더 내려오면 내 병력 집결선과 붙는다.
//   📏 **고원의 실측 경계는 gy −0.45 ~ −0.14**(그림 세로 8.2%·27.9% 의 밝기 단차 — scratch 로 잰 값 · ART.md §17).
//     광맥은 그 **안**에 들어간다(2026-09-10 사용자: 「미네랄을 조금 내려 판 안에」) — 줄 −0.43 에 호가 0.018 위로 부풀어 −0.448.
//     본진도 따라 내려(−0.38) 광맥과 0.05 를 둔다 — 내 기지의 본부↔광맥 간격(0.053 · CAMP_ROW_BASE↔MINE)과 같은 거울이다.
const CAMP_FOE_ROW = { mine:-0.43, main:-0.38, tech3:-0.34, tower3:-0.28, tech:-0.22, tower2:-0.14, prod:-0.06, tower1:0.02 };
// 🔍 던전 안의 축소 하한 — 위 한 화면(적 기지)까지 한눈에 보이게 1.0 까지 내린다(캠프는 CAMP_MIN_ZOOM 그대로).
//   ⚠ 1.0 아래로는 바닥이 화면 폭을 못 덮는다(19-camp CAMP_MIN_ZOOM 설명 · 물리 하한 1.0).
const CAMP_DG_MIN_ZOOM = 1.0;
function campMinZoom(){ const dg = (typeof campDgN === 'function') ? campDgN() : 0;
  return dg > 0 ? CAMP_DG_MIN_ZOOM : ((typeof CAMP_MIN_ZOOM !== 'undefined') ? CAMP_MIN_ZOOM : 1.45); }
const CAMP_FOE_JIT = { x:0.04, y:0.02, tower:0.06 };         // 씨앗 흔들림(격자 단위) — 발판(2칸 = 0.088)보다 작다 · 본진·탑은 가로만
// 🏗 적 건물 3D 크기 — **내 건물과 같다**(2026-09-10 사용자가 0.85 배를 물렸다: 「이전처럼 다시 키워」).
//   ⚠ 크기는 발판(fitW)이 정하므로 이 값은 1 이 기본이다 — 줄이면 건물이 제 발판보다 작아져 표식(.fbMark)과 어긋난다.
const CAMP_FOE_SCL = 1;
// 🎨 **적 건물·일꾼은 붉다**(2026-09-10 사용자 요청) — 색은 오토배틀의 **적 진영 색 그대로**(PLAYER_VIEW_COLORS[1] · 18-strike 가 u.pcol 로 쓰는 것).
//   ⛔ 새 빨강을 정하지 말 것 · 칠하는 일은 3D 의 공용 인스턴스 틴트(`applyTeamTint`)가 한다 — 엔트리에 rimCol 을 얹기만 하면 된다.
function campFoeRim(){ return (typeof PLAYER_VIEW_COLORS !== 'undefined' && PLAYER_VIEW_COLORS[1]) || '#d6292f'; }
function campFoeRng(seed){                                   // mulberry32 — 작고 결정적이다
  let a = (seed >>> 0) || 1;
  return function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function campFoeNewSeed(){ return ((Date.now() * 2654435761) ^ (Math.floor(performance.now() * 1000))) >>> 0 || 1; }
// 표(d.bld)의 순서를 지키며 자리를 준다 — 같은 씨앗이면 같은 배치
function campFoeLayout(d, seed){
  const R = campFoeRng(seed), j = k => (R() - 0.5) * 2 * k;
  const flip = R() < 0.5 ? -1 : 1;                           // 기지 전체 좌우 반전
  const X = x => 0.5 + (x - 0.5) * flip;
  const rowOf = q => q.kind === 'main' ? 'main' : q.kind === 'tower' ? ('tower' + q.zone)
               : (q.role === 'prog' && (q.kind === 'prod')) ? 'prod' : (q.role === 'prog') ? (q.zone === 3 ? 'tech3' : 'tech') : ('side' + q.zone);
  // 줄마다 좌·우 자리를 번갈아 준다(씨앗으로 어느 쪽이 먼저인지 정한다)
  const side = {}, out = [];
  for(const q of d.bld){
    const r = rowOf(q); let gx, gy;
    if(r === 'main'){ gx = 0.5 + j(0.03); gy = CAMP_FOE_ROW.main; }   // 세로 흔들림 없음 — 하한 −0.43 바로 위다
    else if(r.indexOf('tower') === 0){ gx = 0.5 + j(CAMP_FOE_JIT.tower); gy = CAMP_FOE_ROW[r]; }   // 세로 흔들림 없음(위 📏)
    else if(r === 'prod' || r === 'tech' || r === 'tech3'){
      if(side[r] == null) side[r] = R() < 0.5 ? 0 : 1;
      const left = (side[r]++ % 2) === 0;
      gx = X(left ? 0.30 : 0.70) + j(CAMP_FOE_JIT.x);
      gy = CAMP_FOE_ROW[r] + j(CAMP_FOE_JIT.y); }
    else { // 보급고·크립·파일런 — 구간 바깥. 구간 1 은 왼쪽, 2·3 은 오른쪽(반전은 X 가 한다)
      const z = q.zone | 0, left = (z === 1);
      // ⚠ 구간 2·3 은 **같은 오른쪽 열**이라 세로 간격이 곧 겹침 여부다 — 줄 차이 0.10 에서 흔들림 ±0.02 씩을 빼면
      //   0.06 이라 발판(0.07)보다 가까웠다(실측: supply · supply 겹침 · 씨앗 하나). 구간 3 만 제 줄에 두면 0.13 − 0.04 = 0.09.
      // 📐 **탑과 같은 줄 · 가로 0.19/0.81**(2026-09-10) — 옛 0.13/0.87 은 진입 줌(campFoeLookAt · 가로 맞춤)이 1.0 까지 내려가 기지가 작아졌다.
      //   안쪽으로 들이면 옆 열(0.30/0.70 ± 0.04)과 가까워지므로 **탑의 줄**(테크 줄 사이)에 두고 가로 흔들림을 뺀다:
      //   옆 열과 dx ≥ 0.07 · dy 0.04 → 0.081 ≥ 0.07(발판). ⛔ 가로 흔들림을 되살리지 말 것 — 0.02 만 흔들려도 0.057 로 겹친다.
      const gyRow = z === 1 ? CAMP_FOE_ROW.tower1 : z === 2 ? CAMP_FOE_ROW.tower2 : CAMP_FOE_ROW.tower3;
      gx = X(left ? 0.19 : 0.81); gy = gyRow; }   // 0.20 은 옆 열과 0.069 로 21/12000 겹쳤다(실측)
    out.push({ gx:gx, gy:gy }); }
  // ⛏ 광맥 — 본진 위 호(내 기지 campLayMinerals 의 거울 · 위로 볼록). 흔들림은 같은 고정 난수(campMineJit)
  const mine = [];
  { const cols = (typeof CAMP_MINE_COLS !== 'undefined') ? CAMP_MINE_COLS : 8;
    const gap = (typeof CAMP_MINE_GAP !== 'undefined') ? CAMP_MINE_GAP : 1.65;
    const arc = (typeof CAMP_MINE_ARC !== 'undefined') ? CAMP_MINE_ARC : 0.8;
    const cw = (typeof _techCW === 'function') ? _techCW() : 0.022, ch = (typeof _techCH === 'function') ? _techCH() : 0.02;
    const last = Math.max(1, cols - 1), mid = last / 2;
    const x0 = 0.5 - mid * gap * cw, y0 = CAMP_FOE_ROW.mine + j(0.01);
    for(let c = 0; c < cols; c++){
      const jx = (typeof campMineJit === 'function') ? campMineJit(c, 11) : 0, jy = (typeof campMineJit === 'function') ? campMineJit(c, 12) : 0;
      mine.push({ i:c, gx: x0 + (c * gap + jx * 0.55) * cw,
                  gy: y0 - ((1 - Math.pow(c / last * 2 - 1, 2)) * arc + jy * 0.45) * ch }); } }
  // ⛽ 가스 — 본진 줄의 **왼쪽** 바깥(내 기지의 거울 · 오른쪽은 구간 2·3 보급고 열). 반전을 따라간다.
  const gas = { gx: X(0.19), gy: CAMP_FOE_ROW.main + j(0.01) };
  return { bld:out, mine:mine, gas:gas, flip:flip }; }
// 🚶 적 일꾼 연출 — 본진↔광맥을 오간다. **전투 밖**이다(맞지 않는다 · 세지 않는다 · 값에 안 들어간다).
//   3D 엔트리(기지 유닛 규약)로만 존재한다 — campFoeBld3D 가 함께 돌려준다.
const CAMP_FOE_WORKERS = 3, CAMP_FOE_WORK_S = 7.5;           // 마릿수 · 왕복 한 바퀴(초)
function campFoeWorkers3D(v, cwpx){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld || !CAMPB._fmine || !CAMPB._fmine.length) return [];
  const d = campDgDef((typeof campDgN === 'function') ? campDgN() : 0); if(!d) return [];
  const main = CAMPB._fbld.find(function(b){ return b && b.kind === 'main' && !b.dead; }); if(!main) return [];
  const mk = (typeof TECH_WORKER !== 'undefined' && TECH_WORKER[d.race]) || 'worker_human';
  const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  const yoff = (typeof TECH_UNIT_YOFF !== 'undefined') ? TECH_UNIT_YOFF : 6;
  const cellK = _techCW() / ((TECH_GRID.x1 - TECH_GRID.x0) / TECH_GRID.cols);
  const scl = ((typeof TECH_USCALE !== 'undefined') ? TECH_USCALE : 1) * ((typeof TECH_UVIS !== 'undefined') ? TECH_UVIS : 1) * cellK;
  const out = [];
  for(let i = 0; i < CAMP_FOE_WORKERS; i++){
    const m = CAMPB._fmine[Math.floor(i * CAMPB._fmine.length / CAMP_FOE_WORKERS)];
    const ph = ((t / CAMP_FOE_WORK_S) + i / CAMP_FOE_WORKERS) % 1;        // 0→1 왕복 위상
    const u = ph < 0.5 ? ph * 2 : (1 - ph) * 2;                           // 0(본진) → 1(광맥) → 0
    const gx = main.gx + (m.gx - main.gx) * u + (i - 1) * 0.012, gy = main.gy + (m.gy - main.gy) * u;
    const x = (gx - v.x) * v.zoom + 0.5, y = (gy - v.y) * v.zoom + 0.5;
    if(x < -0.2 || x > 1.2 || y < -0.2 || y > 1.2) continue;
    if(typeof techFogHidden === 'function' && techFogHidden(gx, gy)) continue;   // 🌫 안개 안이면 안 보인다(적 진영 연출)
    out.push({ uid:'cst_foe_wk' + i, id:mk, x:x, y:y, face:(ph < 0.5 ? -Math.PI / 2 : Math.PI / 2), moving:true,
      yoff:yoff, yawFix:true, scl:scl, working:false, sel:false, z:-1185, rimCol:campFoeRim() }); }
  return out; }

// ══ 🌫 던전의 안개 — 「내 쪽은 열려 있고, 적 쪽은 덮여 있다」 (2026-09-10 사용자 요청) ═══════
//   ⭐ **관리자 건설 탭의 안개를 그대로 빌린다**(10-engine techFogInit/Compute/Draw · G.tech.fog).
//     ⛔ 캠프용 안개를 새로 만들지 말 것 — 그리기·부드러운 전이·3D 숨김 규약이 이미 거기 있다.
//     빌리면서 두 가지만 바꾼다: ① 덮는 세로 범위를 **격자 위 적 기지까지**(wy0) ② 시야를 내는 것에
//     **전장 병력**을 더한다(기지 건물만 보던 것 — campFogExtra).
//   🏠 **내 기지(격자 안)는 늘 열려 있다** — 집을 탐험할 이유가 없다(사용자: 「내 본진쪽은 깔끔하게」).
//     그래서 격자 위끝(techY0) 아래는 매 계산마다 활성(2)으로 칠한다.
//   👣 적 쪽은 **병력을 데리고 올라가야** 열린다 — 이미 있던 「적 건물 seen」(campFoeSee)과 같은 자다.
//   ⚠ 안개는 **던전에서만** 켠다(캠프 0단계는 집이라 끈다 · campFogSync).
const CAMP_FOG_SIGHT = 1.15;      // 전장 유닛 시야 = 인지 사거리(u.acq) × 이 배수 — 건물 seen 판정(CAMP_FOE_SEE_R)보다 살짝 넓다
function campFogOn(){ return (typeof campDgN === 'function') && campDgN() > 0; }
// 덮을 세로 위끝 — 뷰가 올라갈 수 있는 끝(campViewTop)보다 조금 더 위. 안 그러면 위 가장자리가 안개 밖으로 샌다.
function campFogTop(){ const t = (typeof campViewTop === 'function') ? campViewTop() : 0; return Math.min(0, t - 0.06); }
// 🌫 켜고 끄기 — 던전에 들어가면 켜고, 캠프로 돌아오면 끈다. 화면(#cstFog)도 같이 여닫는다.
function campFogSync(){
  if(typeof G === 'undefined' || !G.tech || typeof techFogInit !== 'function') return false;
  const on = campFogOn(), ph = document.getElementById('phone');
  if(ph) ph.classList.toggle('dgFog', on);
  if(!on){ if(G.tech.fog) G.tech.fog.on = false; return false; }
  const top = campFogTop(), f = G.tech.fog;
  // 범위가 달라졌으면 새로 판다(던전마다 표의 맨 위가 다르다)
  if(!f || Math.abs((f.wy0 == null ? 0 : f.wy0) - top) > 0.001) techFogInit(true, { wy0:top, wy1:1, flat:true });
  else { f.on = true; if(typeof techFogCompute === 'function') techFogCompute(); }
  return true; }
// 👁 **캠프가 더하는 시야** — 10-engine techFogCompute 가 마지막에 부른다(엔진에 캠프 코드를 넣지 않으려고 뺀 훅).
//   ⚠ asp·cpt 는 엔진이 이미 보정해서 준다(칸 크기·화면비) — 여기서 다시 만지지 말 것.
function campFogExtra(f, asp, cpt){
  if(!f || !f.on || !campFogOn()) return 0;
  // 🏠 내 기지(격자 안)는 통째로 열어 둔다 — 아래에서 위로 훑는 것이 아니라 **줄 단위**로 칠한다(빠르다).
  const sp0 = (f.wy0 == null ? 0 : f.wy0), spH = Math.max(1e-6, (f.wy1 == null ? 1 : f.wy1) - sp0);
  const y0 = (typeof techY0 === 'function') ? techY0() : 0.18;
  const ty0 = Math.max(0, Math.min(f.rows - 1, Math.floor(((y0 - sp0) / spH) * f.rows)));
  for(let ty = ty0; ty < f.rows; ty++){ const row = ty * f.cols; for(let tx = 0; tx < f.cols; tx++) f.state[row + tx] = 2; }
  // 👣 전장 병력 — 내 유닛만(적은 시야를 안 낸다). 전장 좌표 → 격자 → 안개 칸.
  let n = 0;
  if(typeof CAMPB !== 'undefined' && CAMPB && CAMPB.me && typeof campW2G === 'function'){
    const W = CAMPB.world || 1, laneW = (typeof CAMP_LANE_W !== 'undefined') ? CAMP_LANE_W : 1;
    for(const u of (CAMPB.me.units || [])){
      if(!u || u.dead) continue;
      const g = campW2G(u.x, u.y, W);
      const rg = ((u.acq || 300) * CAMP_FOG_SIGHT) / W * laneW;     // 전장 사거리 → 격자 비율
      _fogReveal(g.gx, g.gy, Math.max(1, rg * f.cols), false, f, asp); n++; } }
  // 👀 **눈에 들어온 것에 표시를 남긴다**(b.vis / m.vis · 2026-09-10 사용자: 「적 건물과 유닛도 안개에 가려지고,
  //   다가가서 시야를 열면 보이도록」). 한 번 본 것은 계속 그린다(RTS 의 기억 — 지형·건물은 남고 유닛은 안 남는다).
  //   ⚠ **b.seen 과 다른 자다.** seen 은 **엔진의 표적 기억**이라 관문 규칙(campFoeRevealGate)이 아군을 안 멈추게
  //     미리 켜 준다 — 그걸 그림에 쓰면 **가 보지도 않은 건물이 어둠 속에 떠 있다**(실측). 그림은 vis 만 본다.
  //   ⛔ 유닛에는 vis 를 두지 말 것 — 유닛은 지금 보이는 것만 그린다(campFogHidesAt).
  if(typeof CAMPB !== 'undefined' && CAMPB){
    const W2 = CAMPB.world || 1, at = function(gx, gy){ const t = _fogTile(gx, gy, f); return f.state[t.ty * f.cols + t.tx]; };
    for(const b of (CAMPB._fbld || [])){ if(!b || b.vis) continue;
      const g = campW2G(b.x, b.y, W2); if(at(g.gx, g.gy) === 2) b.vis = true; }
    for(const m of (CAMPB._fmine || [])){ if(!m || m.vis) continue; if(at(m.gx, m.gy) === 2) m.vis = true; }
    if(CAMPB._fgas && !CAMPB._fgas.vis && at(CAMPB._fgas.gx, CAMPB._fgas.gy) === 2) CAMPB._fgas.vis = true; }
  return n; }
// 🌫 **안개에 가려 안 보이나** — 전장 좌표(x,y)로 묻는다(3D·HP 바가 쓴다).
//   ⚠ 격자 좌표를 받는 techFogHidden 과 다른 자다 — 전장 좌표를 그대로 넘기면 늘 가려진다.
function campFogHidesAt(wx, wy){
  if(!campFogOn() || typeof techFogHidden !== 'function' || typeof CAMPB === 'undefined' || !CAMPB) return false;
  const g = campW2G(wx, wy, CAMPB.world || 1);
  return techFogHidden(g.gx, g.gy); }
