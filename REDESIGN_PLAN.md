# REDESIGN_PLAN — 전면 개편 구현 계획 (2026-09-09 · 초안 · ⚠ 사용자 승인 전)

> *왜*는 `GAME_DIRECTION.md` §0-A · 이 문서는 **어떤 순서로 무엇을 고치나**.
> ⛔ 코드는 아직 안 건드렸다. 승인되면 이 순서대로 간다. 단계마다 `npm test` 초록이 조건이다.
> ⚠ 값(적 체력 계단·환생 관문·2차 트리 가격)은 **전부 임시**다 — 단계 0의 자로 재고 BALANCE 에 적는다.

## 0. 한 장 요약

| 단계 | 무엇 | 메인에 올리는 단위 | 크기 |
|---|---|---|---|
| **0** | 자(尺) — 벤치가 「건물 몇 채 · 몇 분」을 말하게 | 그대로 올린다 | 작다 |
| **1** | 🏰 적 기지 + 라운드 폐지 + 종족 선택 제거 + 재미 넷 | **한 덩어리로**(반쯤은 두 체계가 공존한다) | **크다** |
| **2** | 🔁 환생 2층(2차 환생 · 트리 · 배수 규칙) | 그대로 | 중 |
| **3** | ♾ 무한층 + 무한 포인트 | 그대로 | 중 |
| **4** | 🧬 종족 변이(2차 환생 때 고르기) | 2 뒤에 | 작다 |
| — | 유즈맵 구역 업그레이드 · 비동기 습격 | **자리만** | — |

## 지금 코드가 정하는 것 (조사 결과 · 2026-09-09)

- 캠프와 던전은 **한 전장** `CAMPB`(`campBattleOpen`). 내 본부 y=0.86W · 적 스폰 y=0.14W · **적 본부는 dead**(`S.ai.base.dead=true` — 내 병력이 올라가 버리는 걸 막으려고).
- 적→내 건물 경로: `campPatchFront()` 가 `strikeFrontStruct('ai')` 를 `campFrontBld()`(y 가 가장 작은 내 건물)로 바꿔 끼우고, `campStepUnits` 의 건물 분기가 `_campFireBld` 로 때린다. **`side==='me'` 는 집결점(`campRallyPoint`)만 준다** — 진격이 없다.
- 라운드는 `C.cleared` 하나. 입구 `campClearRound()` · 읽기 `campRoundN()` `campCleared()` · 난이도 `campFoeDiff(dg, cleared)` · 보상 `campMineMul()`(cleared 로 오른다) · 부활 `campRoundRevive()` · 포인트 `campRebPtGain()`(√번돈 × 1.35^던전 × 1.012^라운드) · 관문 `campCanRebirth()`(누적 100만) · 룬 칸 `campRuneBestRound()` · 칩 `curPaintChip()` · 던전 선택 `campDropRender/campRndTap`(12-appshell 280~375).
- 패배 = 본부 파괴 → `campFail()`(dg=0 · cleared=0) → `campBattleClose()`. **전멸은 패배가 아니다**(누운 유닛 `_down` 이 라운드 시작에 일어난다).
- 종족: `campEnter()` 가 `C.race` 없으면 `campRaceSheet()`(#campRaceOv) → `campPickRace` → `campRaceToCamp`(검은 판 + `tutoKick`).
- 적 종족: `campFoeRace(dg)` = `CAMP_DG_RACE[hbDun(dg).race]` → `STK_RACES` 키(terran/zerg/protoss). `HB_DUNGEONS`(08-hunt · 10개)가 이름·타일·종족을 준다.
- ⚠ **종족 키가 두 벌이다**(계획 초안의 오류를 정정): 건물 표 `TECH_TREE` 는 **`union`·`swarm`·`aetherial`**,
  전투 엔진 `STK_RACES` 는 **`terran`·`zerg`·`protoss`**. 잇는 함수는 `campTechRace(r)`(→ `stkTechRace`).
  ⛔ `TECH_TREE['terran']` 은 **없다** — 적 기지 표는 `TECH_TREE[campTechRace(race)]` 로 읽어야 한다.
- 안개: `fogInit/fogEnabled/fogVisAt/fogComputeVision/_fogReveal`(10-engine 1184~) — 유즈맵 `fogtest` 가 쓴다.
- 스모크: `await step(` 314개 중 **69개**가 던전·라운드·환생·룬 구역을 잰다. `campRoundN/campClearRound/campRndTap/campDrop/CAMP_ROUND_MAX` 참조 120줄.

---

## 단계 0 — 자(尺) 먼저 (게임은 안 바뀐다)

**왜 먼저**: 단계 1 이 끝나면 「라운드」가 없어서 지금 벤치·갈림도 스크립트가 진행도를 못 말한다.
「도달 라운드」는 어차피 못 믿는 자였다(BALANCE §3-2-15). 새 자는 **건물 수 · 첫 관문까지 초 · 던전 클리어 초**다.

| 파일 | 할 일 |
|---|---|
| `scripts/camp-bench.mjs` | `«BENCH»` 줄에 `bld:{dg, broken, firstBreakS, dgClearS:[…]}` 추가 · `__CB.enter` 는 그대로(1기면 내려간다) · 라운드 기록(`__CB.log` 의 round)은 단계 1 뒤에 건물 기록으로 갈아 끼운다(자리 예약) |
| `scripts/camp-strat.mjs` | 진행도 열을 「부순 건물 수」로 바꿀 준비(단계 1 뒤에 켠다) · 지금은 돈만 본다 |
| `BALANCE.md` §4 | 「재는 자 = 돈 · 건물 수 · 초」로 갱신 |

검증: 벤치 3분 판 하나가 새 줄을 낸다. 스모크 변화 없음.

---

## 단계 1 — 🏰 적 기지 · 라운드 폐지 · 종족 선택 제거 · 재미 넷 (한 덩어리)

⚠ **브랜치에서 잘게 커밋하되, 메인에는 전부 초록일 때 한 번에 올린다.** 라운드와 건물이 메인에서 공존하면 칩·룬·환생이 서로 다른 자를 본다.

### 1-A. 데이터 — 적 기지 표 (`js/19-camp.js` 상단 · 새 절)

```js
// 🏰 던전 = 적 기지 (GAME_DIRECTION §0-A) — 던전 셋 · 진행 6 + 부수 6
const CAMP_DG_MAX = 3;                         // 12-appshell 의 10 을 여기로 옮겨 단일 소스
const CAMP_DG_STEPS = 6;                       // 진행 건물 수 = 관문 수
const CAMP_DG = [
  null,                                        // 0 = 캠프(집)
  { race:'terran',  name:'버려진 전초기지', tile:'terran_tile_light', tint:'…', lesson:'building',
    bld:[ // 격자 좌표(내 기지와 같은 자) · 위 절반(y 0.18~0.45)
      { k:'barracks', x:.30, y:.22, role:'prog', kind:'prod'  },   // 병영 — 깨면 몰려오는 수가 준다
      { k:'engbay',   x:.62, y:.22, role:'prog', kind:'tech'  },   // 공학소 — 깨면 적이 약해진다
      { k:'refinery', x:.14, y:.32, role:'prog', kind:'res'   },   // 정제소 — 전리품 가스
      { k:'factory',  x:.80, y:.32, role:'prog', kind:'prod'  },
      { k:'academy',  x:.46, y:.36, role:'prog', kind:'tech'  },
      { k:'command',  x:.50, y:.20, role:'prog', kind:'main', last:true },   // 본진 — 나머지 다 깨야 열린다
      { k:'turret',   x:.22, y:.28, role:'side', kind:'tower', dmg:…, rng:… },
      { k:'turret',   x:.74, y:.28, role:'side', kind:'tower' },
      { k:'bunker',   x:.50, y:.30, role:'side', kind:'tower' },
      { k:'supply',   x:.10, y:.20, role:'side', kind:'deco'  },
      { k:'supply',   x:.90, y:.20, role:'side', kind:'deco'  },
      { k:'supply',   x:.36, y:.42, role:'side', kind:'deco'  } ] },
  { race:'zerg',    … lesson:'research' },
  { race:'protoss', … lesson:'mix' },
];
```

#### 던전 셋의 표 — **실제 건물 키로 다 채웠다** (2026-09-09 · 「스웜·에테리얼이 없다」 해소)

⚠ `k` 는 `TECH_TREE[campTechRace(race)].buildings` 의 키다. 아래는 **그 파일에 실재하는 키**만 골랐다.

| | **D1 유니온** — 「건물 성격」 | **D2 스웜** — 「연구가 필요하다」 | **D3 에테리얼** — 「조합 + 최종」 |
|---|---|---|---|
| **prod** | `barracks` 병영 | `pool` 번식지 | `gateway` 지상 차원문 |
| **prod** | `factory` 기갑 공장 | `hydraden` 스파이크 굴 | `stargate` 공중 차원문 |
| **tech** | `engbay` 공학소 | `evochamber` 진화장 | `forge` 강화소 |
| **tech** | `academy` 훈련소 | `lair` 소굴 | `cyber` 사이버 코어 |
| **res** | `refinery` 정제소 | `extractor` 채취기 | `assimilator` 융합소 |
| **main** | `command` 본부 | `hatchery` 부화장 | `nexus` 본거지 |
| **tower** ×3 | `turret` ×2 · `bunker` | `sunken` ×2 · `spore` | `cannon` ×3 |
| **deco** ×3 | `supply` ×3 | `creep` ×3 | `pylon` ×3 |
| **기믹** | **없다**(튜토리얼 · 미러전) | **공중이 섞인다** — `spore`(대공탑)가 있고 적도 난다 → **대공 병력이 없으면 못 깬다** | **`pylon` 이 `cannon` 에 전력을 준다** — 부수 건물인데 깨면 탑 셋이 멎는다 → 「부수 건물을 먼저 칠 이유」 |
| **가르침** | 병영을 깨면 적이 준다 · 공학소를 깨면 약해진다 | 적 체력이 높아 **연구 없이는 못 깬다** | 순서를 고르면 훨씬 쉬워진다 |

⭐ D3 의 `pylon` 이 이 설계의 **가장 좋은 한 칸**이다 — 「진행 6채만 세지만, 부수 건물을 먼저 깨는 게 이득일 수 있다」가
성립해 「어느 걸 먼저」가 진짜 판단이 된다. ⛔ D1·D2 에는 넣지 않는다(배우기 전에 나오면 그냥 어렵기만 하다).

⚠ **값(체력·전리품 양·탑 화력)은 안 정했다.** 단계 0 의 자로 D1 부터 맞추고 D2·D3 은 그 배수로 시작한다.
- `k` 는 **`TECH_TREE[race].buildings` 의 키**다(그림·이름을 거기서 가져온다 — 새 에셋 없음). 종족마다 키가 다르므로 표는 종족별로 쓴다.
- ⚠ 좌표는 **격자 비율**(내 기지 `campG2W` 와 같은 변환) — 화면과 어긋나지 않게. 적 기지는 격자 **위 절반**(지금 적이 내려오는 레인 `CAMP_LANE_TOP=0.18` 부터).
- `HB_DUNGEONS`(08-hunt) 는 **읽지 않는다** — `hbDun`/`CAMP_DG_RACE` 의존을 끊고 `CAMP_DG` 가 단일 소스. 08-hunt 는 마을 때문에 그대로 둔다.
- ⭐ **적 기지는 이 표에서 「만든다」**(`campFoeBase(dgDef)`) — 나중에 남의 캠프(`G.tech.ents` 스냅샷)도 같은 함수에 넣을 수 있게 **입력을 표 하나로** 받는다.

### 1-B. 상태 — `C.cleared` → `C.broken`

| 옛 | 새 | 뜻 |
|---|---|---|
| `C.cleared`(0~50) | **`C.broken`**(0~6) | 이 던전에서 부순 진행 건물 수 |
| `C.best[dg]`(최대 라운드) | `C.best[dg]`(최대 broken · 0~6) | 룬 칸·환생·먼 목표가 읽는다 |
| — | **`C.foeDead`**(`{eid:1}`) | 이 던전에서 부순 건물(진행+부수). 패배하면 비운다(「그 던전 처음부터」) |
| — | **`C.dgT`**(`{dg:{cur, best}}`) | 🎁 최고기록 타이머(초) |
| — | **`C.foeTgt`**(eid \| null) | 플레이어가 고른 다음 표적(없으면 자동) |
| `campCleared()` `campRoundN()` | **`campBroken()`** · `campRoundN` 은 삭제 | 소비처 20+3+1 곳을 전부 바꾼다 |
| `campClearRound()` | **`campBreakBld(b)`** | 유일한 입구. broken++ · best 갱신 · 전리품 · 반격 웨이브 · 체크포인트 부활 · 6이면 `C.dg++`(3이면 무한층 문 — 단계 3 전까진 「완주」 표시로 머문다) |
| `campFail()` | `campFail()` | dg=0 · **broken=0 · foeDead={}** · `_down` 은 **버린다**(죽은 유닛은 다시 산다 — `G.tech.units[id]` 는 이미 사망 시 −1 이라 값이 내려간다) |
| `campRoundRevive()` | **`campCheckpointRevive()`** | 부르는 곳이 「건물 하나 깰 때」로 바뀐다 |
| `CAMP_ROUND_MAX` | 삭제 → `CAMP_DG_STEPS` | 12-appshell `CAMP_DG_MAX=10` 도 삭제 |

저장 호환: `campState()` 복원에서 `C.cleared` 가 있고 `C.broken` 이 없으면 **broken=0 · dg 는 유지**(진행 중 던전 처음부터 — 새 규칙과 같다). 마이그레이션 함수 한 곳 `campMigrate(C)`.

### 1-C. 전투 — 내 병력이 적 건물을 친다 (`js/19-camp.js` + `js/21-camp-battle.js`)

새 함수(19-camp):
```js
function campFoeBase(def)            // CAMP_DG[dg] → CAMPB._fbld = [{x,y,hp,max,maxHp,dead,eid,bk,role,kind,last,seen,dmg,rng}]
                                     //   hp = CAMP_FOE_BLD_HP0 × campFoeDiff(dg, broken) × (kind별 배수) · main 은 ×3
function campFoeBldAlive()           // _fbld 중 살아 있는 것 (campBldAlive 의 거울)
function campFoeFront()              // 내 병력의 다음 표적 — C.foeTgt 가 살아 있으면 그것 · 아니면 「앞줄」(y 큰 것 = 내 쪽) 진행 건물 · last 는 나머지 다 죽어야
function campFoeDiff(dg, broken)     // 시그니처 유지 · 내부 곡선을 6계단으로(아래 1-F)
function campFoeSpawnTick(dt)        // 🆕 압박 — 살아 있는 prod 건물마다 주기(CAMP_FOE_SPAWN_S / 남은 prod 수)로 1무리. 웨이브 큐(_wq) 대신
function campFoeTowerStep(dt)        // 🆕 부수 건물 tower 가 사거리 안 내 유닛을 쏜다 (_campFireBld 의 거울 · 정지 사수)
function campCounterWave(b)          // 🎁 반격 — 건물을 깨면 즉시 campSpawnWave(kind별 크기) · 「깬 직후가 가장 위험하다」
function campLoot(b)                 // 🎁 전리품 — res→가스 · prod→미네랄 · tech→진행 중 연구 시간 −n% · main→둘 다. 입구는 campAddRes()
function campFoeReveal()             // 🎁 안개 — 내 유닛 시야(u.acq) 안이거나 이웃 prog 가 죽으면 b.seen=true. 그림·표적 후보에서 seen 만
function campDgTimerTick(dt)         // 🎁 타이머 — dg>0 이고 전장이 열려 있으면 C.dgT[dg].cur += dt · 클리어 때 best 갱신
```
21-camp-battle 수정(부품 재사용 · 새 이동 장치 없음):
- `campPatchFront`: `side==='me'` 분기가 `campFoeFront()` 를 준다(살아 있으면). 없으면 지금처럼 집결점. → 아군이 **적 건물로 진격**한다. `_toTemple` 이 dead 검사가 없으므로 `campFoeFront` 는 **dead 를 절대 돌려주지 않는다**.
- `campStepUnits` 의 건물 분기(492~510)는 `side` 무관하게 이미 「표적 구조물 b 를 향해 가고 사거리면 `_campFireBld`」다. **`campBldAlive()` 를 side 로 갈라**(`me` 면 `campFoeBldAlive()`) 막힘 대체 표적이 제 편 목록을 보게 한다. `_campFireBld` 의 `CAMP_FOE_BLD_MUL` 은 side 별 상수로.
- 건물이 죽는 순간(`b.hp<=0`)에 `_fbld` 면 `campBreakBld(b)` 를 부른다 — **입구는 그 한 곳**.
- 승리 판정 교체: 「적 유닛 0」 → **「prog 6채 dead」**. 패배는 그대로(본부 파괴).
- `campFoesPending/_wq/_wqT` 는 반격 웨이브 전용으로 남긴다. `campSpawnFoes`(라운드 시작 스폰)는 다락.
- 안개: `campFoeReveal()` 를 `campAlertTick` 옆에서 같은 주기로. 렌더(`campRenderBattle`?)에서 `!b.seen` 은 안 그린다. ⚠ 엔진 `fogInit` 는 유즈맵 타일 격자용이라 **쓰지 않는다** — 캠프는 건물 12개의 플래그면 충분하다(⛔ 시스템 둘을 겹치지 말 것). 문서엔 「안개 시스템이 있다」고 썼는데 **캠프에 맞는 건 플래그**다 — 정정.

### 1-D. 캠프 = 집 · 던전 = 원정 (화면·흐름)
- `campEnterDungeon(dg)`(지금 **다락**에 있다 · 99-attic 709) 를 **되살려** 유일한 입구로: `C.dg=dg · broken=0(또는 이어서) · campBattleOpen · campFoeBase`. 조건 「병력 1기 이상」 유지.
- 패배 → `campFail()` → 캠프(dg 0). 결과는 **`campSay`(토스트)** + 던전 칩이 「캠프」로. ⛔ 새 결과 카드는 안 만든다(있는 어휘 — 지금도 그렇다).
- 승리(6채) → 다음 던전 **자동 진입은 안 한다**(원정이니 돌아와서 고른다): `C.dg` 는 그대로 두고 `C.dgDone[dg]=1` · 칩이 「완주 · 다음 던전 열림」. ⚠ 지금은 50라운드에 자동 이동 — 바뀐다(GAME_DIRECTION §0-A 「던전 = 원정」).
- 재정비: 캠프에서 경제·생산·연구는 **지금 그대로**(전장이 닫혀도 `G.tech` 는 산다).

### 1-E. UI — 라운드 흔적을 전부 걷는다 (`js/12-appshell.js` · `sc-ums-web.html` · `css/30-home.css`)
| 자리 | 지금 | 바꿈 |
|---|---|---|
| 던전 칩 `curPaintChip` | `잊혀진 회랑 · 30/50` | `버려진 전초기지 · 건물 3/6` · 캠프는 `캠프` · 완주는 `완주 ✓` · 진행선 = broken/6 |
| 던전 선택 `#campDrop` | 카드 + **ROUND 큰 숫자·◀▶·슬라이더** + [이동] | 카드(번호·이름·**최고기록 ⏱**·완주 표시) + [진입] / 캠프에 있으면 [복귀] 없음. `.cdFoot` 의 ROUND 줄·`campRndTap`·`.cdSld` **삭제 → CSS 다락**(`attic-css.mjs`) |
| 맵 띠 `#campBar` | 적 수 · 피버 | 그대로 + **다음 표적 이름**(`campFoeFront().bk`) 한 칸 |
| 적 건물 탭 | — | 기지 맵에서 적 건물을 누르면 `C.foeTgt=eid`(고르기). 프로필 시트는 **`techBldgPlainModel` 재사용**(단일 소스 규칙) — 「공격 대상」 카드 하나 |
| 종족 선택 `#campRaceOv` | 첫 진입에 뜬다 | **뜨지 않는다** — `campEnter` 가 `C.race='terran'` 을 박는다. 마크업·CSS·`campRaceSheet/campPickRace/_campRacePick` → **다락**. `campRaceToCamp` 의 검은 판 전환은 **첫 진입 연출**로 남긴다(`tutoKick` 이 거기 걸려 있다) |
| 룬 칸 해금 | `campRuneBestRound`(라운드 환산) | `campRuneBestStep()` = max((dg−1)×6 + best[dg]) · `RUNE_SLOT_R` 을 **0~18 눈금**으로 다시 적는다(GEM.md §8-3 갱신) |
| 환생 화면 `.crFx` | 재화×던전×라운드 | 재화 → **도달**(아래 1-F) · 라운드 → 건물 |

### 1-F. 곡선·공식 — 자리만 바꾸고 값은 나중에
- `campFoeDiff(dg, broken)`: 던전 문턱 ×3 유지 · 던전 안 6계단은 `CAMP_STEP_R=[1, r1, …, r5]`(표 · 단계 0 자로 맞춘다). ⛔ 50라운드 곡선 상수(`CAMP_RR_LO/HI`·`campRoundRate`) → 다락.
- `campMineMul()`: `cleared` → `broken`(6계단으로 나눠 오른다 · `campMineInc` 분모 = 6).
- **환생 포인트 = 도달 기준**: `campRebPtGain()` = `CAMP_RP0 × Π(던전 배수)^bestDg × (1 + broken/6)`. **번 돈 항을 뺀다**(§0-A). 관문 `campCanRebirth()` = `campReach() >= CAMP_REB_REACH`(임시: D1 6채). 옛 `CAMP_REB_COST`·`campWealth` 기준 → 다락 아니고 **삭제**(스모크가 다시 못 살아나게 잰다).
- `campRebMulGain()`: 입력이 `campFoeDiff(dg, broken)` 이라 그대로 통한다.

### 1-G. 테스트 (`test/smoke.js`)
- 69 스텝 중 라운드를 **직접** 재는 것(라운드 슬라이더·`campClearRound`·50 자동 이동·라운드 부활·룬 칸 라운드 환산·환생 계산 근거 세 값)은 **새 계약으로 다시 쓴다**. 이름을 바꾸지 말고 본문을 바꾼다(이력).
- 새 스텝(최소): ① 적 기지가 표대로 선다(12채 · prog 6) ② 내 병력이 앞줄 건물로 간다(집결점이 아니라) ③ 건물을 깨면 broken++ · 반격 웨이브 · 전리품 · 체크포인트 부활 ④ 본진은 나머지가 살아 있으면 표적이 안 된다 ⑤ 6채면 완주 · 자동 이동 없음 ⑥ 패배 → 캠프 · broken 0 · `_down` 버림 · 재화 유지 ⑦ 종족 선택 화면이 **안 뜬다** + 다락 되살아남 검사 ⑧ 안개: 안 본 건물은 안 그리고 표적 후보도 아니다 ⑨ 타이머 best 갱신 ⑩ 저장 마이그레이션(cleared → broken).
- 벤치: `__CB` 의 승리·정체 판정을 건물로. `camp-strat` 진행도 열 = broken.

### 1-H. 문서
`ARCHITECTURE.md` §🏕 캠프·§⚔ 캠프 전투(전장 그림 갱신) · `CLAUDE.md` 레지스트리(캠프 종족 선택 행 삭제 · 칩·드롭 행 갱신) · `GEM.md` §8-3 룬 칸 표 · `BALANCE.md`(임시 값 표 + 「아직 안 쟀다」) · `ATTIC.md`.

**단계 1 검증**: 스모크 전부 초록 · 벤치 45시뮬분에서 「첫 관문 ≤ 3분 · D1 완주 시간 · 패배 횟수」를 적는다. ⚠ **「한 주기 = 하루」는 벤치로 못 잰다**(6시간짜리 판). NODG 경제 축으로 시간당 수입만 재고, 하루 여부는 **값을 정할 때 다시**.

---

## 단계 2 — 🔁 환생 2층

| 항목 | 내용 |
|---|---|
| 상태 | `C.reb2`(횟수) · `C.reb2Pts` · `C.rb2Tree` · `C.infBest`(단계 3) |
| 배수 | **`campRebMul()` = 1 + C.reb2 + C.rebMul`** — 2차 첫 번은 기본 ×2(=1+1), 그 뒤 +1씩 · 1차 `rebMul` 은 2차 환생 때 **0 으로**. ⛔ 곱 없음 |
| 조건 | `campCanRebirth2()` = D3 완주(`C.dgDone[3]`) — 단계 3 뒤엔 「무한층 진입」과 같은 뜻 |
| 실행 | `campRebirth2()`: `keep = {race?, rune, reb2+1, reb2Pts+got, rb2Tree, best?, dgT.best}` · **`rbTree` 와 `rebMul` 을 비운다** · `campRunReset` · 종족은 단계 4 |
| 트리 | `CAMP_TREE2` = 갈래 넷(스킵 `skip` · 자동화 `auto` · 기본 배수 `base` · 상한 `cap`) · 렌더는 **`campTreeSvg(model)`** 에 모델을 넘겨 재사용(⛔ 두 번째 트리 렌더러 금지 · `CAMP_TREE_BR` 색 표에 넷 추가) · 화면은 `campRebEnter('tree2')` — 네비 「환생」 하위 세 번째 칸 |
| 소비처 | `skip.dgStart` → `campEnterDungeon` 시작 broken · `skip.startRes` → `campFreshStart` · `auto.buy/build/research` → `__CB` 와 같은 규칙을 **게임 안에** 옮긴다(`campAutoTick` · 벤치 정책과 단일 소스로 — 벤치가 그 함수를 부르게) · `cap.worker/supply/unitR` → `CAMP_WORKER_MAX`·`CAMP_SUPPLY_MAX`·`CAMP_UNIT_R` 을 **함수**로(`campCap('worker')`) |
| 1차 트리 | 단순화·가격 하향 — **별도 결정**(표를 새로 짜야 한다 · 사용자와) |
| 테스트 | 배수 합 규칙(곱이면 실패) · 2차 환생이 1차 트리를 비운다 · 룬은 남는다 · 관문 완화 항목이 트리에 **없다**(스모크가 이름을 잰다) |

## 단계 3 — ♾ 무한층
- `C.dg >= 4` = 무한층 n=dg−3. `campFoeBase()` 에 **생성기**: 세 표 중 하나(종족 순환) + 좌표 흔들기(씨앗 = n) · 난이도 `campFoeDiff(3, 6) × CAMP_INF_R^n`(계단은 6 그대로).
- 무한 포인트 `C.infPts += CAMP_INF_PT × n`(층 클리어 때) · 최고기록 `C.infBest`. 칩 「무한 7층 · 건물 2/6」.
- 유즈맵 구역 업그레이드: **자리만** — `C.umUpg={}` · 화면·표 없음.
- 테스트: 층이 끝없이 이어진다 · 같은 층은 같은 배치(씨앗) · 포인트가 층에 비례.

## 단계 4 — 🧬 종족 변이
- 2차 환생 실행 화면에 종족 띠(**`segNavHTML(CAMP_RACE_ORDER)`** — ⛔ 옛 `#campRaceOv` 되살리지 않는다) · 첫 바퀴는 유니온 고정(`C.reb2===0`).
- `campTechRace` · `TECH_TREE[race]` 는 이미 종족별이라 전투·생산은 그대로. ⚠ 스웜·에테리얼 **캠프 값 표**(`CAMP_UNIT_PRICE` 등)가 유니온만 있다 — 일률 배수(`CAMP_UNIT_PRICE_MUL`)로 시작하고 값은 단계 0 자로.

---

## 위험 · 못 하는 것 (정직하게)
1. ~~하루 주기를 못 잰다~~ → **지금은 안 잰다**(2026-09-09 사용자 결정: 「1번의 주기를 재는 건 아직 괜찮다」).
   구조를 먼저 세우고, 주기 값은 나중에 따로 본다. ⚠ 그래서 **단계 1~4 의 어떤 값도 「하루」를 근거로 정하지 않는다** —
   근거 없이 정한 값이 나중에 사실처럼 굳는 것이 이 프로젝트가 여러 번 겪은 일이다.
2. ~~적 기지 화면이 새 그림이다~~ → ✅ **③안으로 확정**(2026-09-09 사용자 · 목업 `docs/mock/camp-foebase-4.html`).

   ### 🏰 적 기지 화면 — 확정된 얼굴 (③안 「밑변 광원」)
   - **진행 건물 6채만 바닥이 붉다**(테두리도 한 단 밝다). ⭐ 이 게임이 이미 쓰는 어휘다 —
     커맨드 카드·탭 띠·던전 칩이 전부 밑변 한 줄로 말한다. **새 기호를 하나도 안 늘린다.**
   - ⛔ 번호 배지·깃발·후광을 붙이지 말 것(①②안은 판을 시끄럽게 한다) ·
     ⛔ **부수 건물을 물리지 말 것**(④안) — 방어탑이 흐려지면 위험이 안 보인다.
   - 다음 표적 = **붉은 모서리 표시** + 맵 띠 오른쪽에 이름 · 적 건물을 누르면 표적이 바뀐다
   - 칩은 `버려진 전초기지 · 3/6` + 아래 붉은 진행선(라운드 30/50 을 대체)
   - 안개 = 못 본 건물은 **속 빈 실루엣**(이름도 없다) · 체력 선은 **맞은 건물에만**
   - 본진(6번)은 나머지 다섯이 죽어야 열린다(🔒)

   **남은 물음 셋의 답** (하나는 ③안을 고르면서 사라졌다):
   | 물음 | 답 |
   |---|---|
   | 방어탑을 물릴까 | **사라졌다** — ③안은 아무것도 안 물린다(④안 전용 문제였다) |
   | 잔해를 몇 채까지 남기나 | **부술 수 있는 것만 잔해가 된다**: 진행 6채 + 방어탑 3채 = 최대 9. **치장(deco) 3채는 표적이 아니다**(충돌만 있고 체력이 없다) — 12채가 다 잔해가 되는 일이 없다 |
   | 12채가 화면에 다 드나 | **단계 1 에서 실제로 그려 보고 정한다.** 목업 좌표는 격자 위 절반(y 0.18~0.45)에 들어간다. ⚠ 안 들어오면 **적 기지에 처음 들어갈 때 한 번 전체 보기로 맞춘다**(캠프 맵은 이미 밀고 확대된다 · `_techClampView`) — ⛔ 새 팬·줌 장치를 만들지 말 것 |
3. ~~스웜·에테리얼 기지가 없다~~ → ✅ **표 셋을 위에 다 채웠다**(실재하는 건물 키 · 기믹 · 가르침).
   남은 건 **좌표와 값**이다: 좌표는 목업이 확정되면 그 배치를 그대로 옮기고, 값은 단계 0 의 자로 D1 → D2·D3ic 순서로 맞춘다.
   ⚠ 그래도 **D1 을 먼저 완성**하고 D2·D3 은 표만 넣은 채 한 번 돌려 본다 — 세 던전을 동시에 맞추면 무엇이 틀렸는지 못 가른다.
4. ⭐ **구조 문제(경제가 앞단)는 이번 개편이 이미 푼다** — 계획을 짜다 알아냈다(2026-09-09).

   > 지금: **가스 ← 정제소 ← 경제 지출** 하나뿐이라, 경제에 쓰면 연구까지 따라와 저울이 안 선다.
   > 새로: **가스 ← 정제소(경제) + 🎁 전리품(전투)** 둘이 된다. 적 `res` 건물을 깨면 가스가 나온다.

   ⇒ **경제에 쓰면 미네랄이 늘고, 병력에 쓰면 더 깊이 가서 가스가 는다.** 두 길이 갈린다 — 저울이 선다.
   같은 뜻으로 **「던전 클리어가 테크를 연다」**도 해금을 경제에서 떼어 전투 진행에 붙인다.
   ⚠ 그래서 **전리품의 가스 양이 이 게임의 저울을 정하는 값**이다 — 너무 적으면 지금과 같고, 너무 많으면
   경제가 죽는다. 단계 0 의 자로 **`camp-strat` 갈림도**를 다시 재서 정한다(그게 이 값의 유일한 근거다).

   자동화(단계 2)는 그 뒤다 — 저울이 선 뒤에 자동 구매를 넣어야 「자동이 곧 정답」이 안 된다.
5. **병합 충돌 — 새 파일로 면적을 줄인다**(2026-09-09 계획).
   `19-camp.js`(7,043줄)를 셋이 같이 만지고 있어 충돌이 확실하다. 그래서 **새 코드는 새 파일에 몰아넣는다**:

   | 파일 | 무엇 | 왜 |
   |---|---|---|
   | 🆕 **`js/23-camp-dungeon.js`** | `CAMP_DG` 표 · `campFoeBase` · `campFoeBldAlive` · `campFoeFront` · `campBreakBld` · `campCounterWave` · `campLoot` · `campFoeReveal` · `campDgTimerTick` · `campFoeSpawnTick` · `campFoeTowerStep` | 새 코드가 **전부 여기** 있으면 충돌이 「끼워 넣는 줄」로 줄어든다 |
   | `js/19-camp.js` | **삭제와 치환만** — `cleared`→`broken` 이름 바꾸기 · 옛 라운드 함수 다락으로 · 새 함수 호출 한 줄씩 | 새 로직을 여기 쓰지 않는다 |
   | `js/21-camp-battle.js` | `campPatchFront` 의 `me` 분기 · 건물 분기의 side 가르기 — **두 곳** | 이 파일은 원래 작다(567줄) |
   | `sc-ums-web.html` | `<script src="js/23-camp-dungeon.js">` 를 **22 뒤 · 90 앞**에 | ⛔ 태그 순서를 바꾸지 말 것(선언은 파일 안에서만 호이스팅) |

   ⚠ **`19-camp.js` 는 여전히 40여 곳이 바뀐다**(이름 바꾸기가 대부분). 그래서 순서를 이렇게 잡는다:
   ① 시작 직전 메인 병합 → ② `23-camp-dungeon.js` 를 **먼저** 다 쓴다(충돌 0) → ③ 19/21 의 치환은 **마지막 날 한 번에**
   → ④ 그날 안에 메인까지. ⚠ 다른 두 세션에 **시작 전에 알린다**(그날은 `19-camp.js` 를 비워 달라고).

## 시작 순서 (승인되면)
**목업 확정**(`camp-foebase-4.html` 중 하나 + 남은 물음 셋) → 0 → **`js/23-camp-dungeon.js` 먼저**(1-A·1-C 의 새 함수 · 충돌 0)
→ 1-B(이름 바꾸기) → 1-D(흐름) → 1-F(공식) → 1-G(스모크) → 1-E(UI) → 1-H(문서) → **메인(하루 안에)** → 2 → 3 → 4
