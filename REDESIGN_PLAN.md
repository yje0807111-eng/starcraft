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
1. **하루 주기는 못 잰다.** 벤치 한 판이 6시간이다. 시간당 수입(NODG)과 관문별 초로 **외삽**한다 — 이 프로젝트가 금지한 「해석적 추정」에 가깝다. 값을 정할 때 사용자와 같이 본다.
2. **적 기지 화면**(12채 배치 · 표적 표시 · 안개)은 **새 그림**이다 — DESIGN.md 규칙대로 **목업 몇 안 → 사용자 확정** 뒤에 만든다. 이 계획엔 그 시간이 안 들어 있다.
3. **스웜·에테리얼 기지**는 건물 키만 있고 배치·값이 없다. 단계 1은 **D1(유니온)만 완성**하고 D2·D3은 같은 함수에 표만 넣는다 — 표는 사용자와 짠다.
4. **자동화(단계 2)** 는 벤치 정책을 게임에 옮기는 것이라 「무엇을 사도 같다」 문제가 **그대로 게임 규칙**이 된다. 구조 문제(경제가 앞단)를 안 풀면 자동 구매가 정답이 된다 — §0-A 「구조 문제」를 단계 1 뒤에 다시 본다.
5. 다른 두 세션이 `19-camp.js` 를 만지고 있다. 단계 1 은 그 파일 40여 함수를 건드린다 — **병합 충돌이 확실**하다. 시작 전에 알리고, 하루 안에 메인까지 가는 걸 목표로 잡는다.

## 시작 순서 (승인되면)
0 → 1-A → 1-B → 1-C(전투) → 1-D(흐름) → 1-F(공식) → 1-G(스모크) → 1-E(UI · 목업 뒤) → 1-H(문서) → 메인 → 2 → 3 → 4
