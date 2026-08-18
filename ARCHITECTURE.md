# ARCHITECTURE — sc-ums-web.html 코드맵

> AI/사람 공용 내비게이션 문서. **줄 번호는 표류하므로 "찾기 문자열"(배너·함수명)로 점프할 것.**
> 마지막 전면 갱신: 2026-07-22 (총 ~15,400줄 기준)

## 0. 제약(불변)
- 종족 설계·상성 오각형(신규 페럴·콜로서스 포함)은 **`RACES.md`** 참조 — 유닛 실수치·건물·밸런스 상수·시뮬레이션 검증 결과가 모두 거기 있다.
- 산출물은 **단일 자립 파일** `sc-ums-web.html` — 빌드 없음, 번들러 없음.
- 테스트 프레임워크 없음 → 행동 검증 = **`npm test`** (스모크 스위트, §9) + 브라우저 프리뷰.
- UI는 단일 소스 원칙(CLAUDE.md 레지스트리) — 같은 UI 재구현 금지, cloneNode/기존 함수 재사용.
- **폰트는 `:root`의 `--font-ti`(제목 = IBM Plex Sans KR **700**) / `--font-ko`(본문 = 같은 가족 400) / `--font-num`(숫자 Rajdhani) 토큰이 단일 소스다.** 한글 제목·본문은 같은 가족이고 굵기로만 가른다 — 다른 가족을 섞으면 글자 폭 비율이 달라 따로 논다(Do Hyeon으로 겪고 되돌렸다). 개별 규칙에 폰트 이름을 박지 말 것(스모크가 잡는다). 숨은 곳 둘: `font:` 단축 속성, 그리고 `var()`를 못 읽는 캔버스 `ctx.font`(JS 상수 `FONT_NUM`). 자세한 규칙은 DESIGN.md §2 「폰트」.

## 1. 파일 최상위 구조
| 블록 | 시작 앵커 | 내용 |
|---|---|---|
| `<style>` | 파일 서두 `<style>` | 전체 CSS (~2,400줄). 모바일 폰 프레임(#phone) 안에 앱 전체 |
| `<script>` (classic) | `// 데이터 — 엑셀` 배너 | 게임 전체 로직 (~11,000줄) |
| `<script type="module">` | `<script type="module">` | three.js 3D 모듈 → `window.M3D` (~1,400줄) |

## 2. classic 스크립트 섹션 지도 (배너 검색어 순서대로)
| 찾기 문자열 | 담당 |
|---|---|
| `데이터 — 엑셀` | 원본 스탯 데이터 |
| `[공유 베이스] 유닛 기본 정의` | `U` = 유닛 정의(모든 유즈맵 공유) |
| `★ 유즈맵 레지스트리` | `USEMAPS`, `mapCfg()`, `applyMapBalance()` — 맵별 오버라이드 구조 |
| `[nemo 유즈맵 모듈] 밸런스` | 네모네모 등급 배율·적 HP 스케일 |
| `가챠 등급 시스템` | `GACHA_UNITS`/`GACHA_TIERS`/`TIER_COLOR`, 조합 레시피 |
| `메타 성장 시스템` | 코인·포인트 영구강화(`G.metaB`, `loadMeta/saveMeta`) |
| `🧍 개인 프로필 RPG` | 캐릭터 육성 — 종류 3종(`PROF_CLASSES`)·직업 트리(`PROF_JOBS`)·스탯·장비·펫·진화·방치수익. **유즈맵 경제와 완전 분리**(재화 `pcoin`) |
| `장비 아이템` | `PROF_ITEM_TIERS`(등급)·`profMakeItem`(생성)·`profEquipItem`/`profScrapItem` — 가방은 계정 공용(`PROF().items`), 장착은 캐릭터별(`c.unit.gear[slot]=iid`) |
| `장비창(상=페이퍼돌 / 하=가방)` | `PROF_SLOT_ICON`(슬롯 라인아트 12종)·`_slotGlyph` · `PROF_GEAR_PAGES`/`profPageSlots`/`_profPageNav`(장비↔장신구 페이지) · `_profPaperdoll`(아바타 위 오버레이) · `_profGearGrid`(6열) · `PROF_BAG_CATS`/`profBagCat`(가방 분류) / `_profGearInfo`(가방 위 팝업) · `_gearPick`/`_gearSel`/`_gearPage` · `bagScrollHint` |
| `🧍 기본 지급` | `PROF_DEFAULT_CLASS` + `profEnsureChar()` — **캐릭터를 고르거나 만드는 화면은 없다**(2026-08-13 폐지). 계정당 하나, 입구마다 없으면 조용히 지급 |
| `마을(월드 + 카메라)` | `TOWN_ZONES`(구역 단일 출처) · `twStep`/`twCamApply` · 입력 `twPtrDown→Move→Up` |
| `⚔ 던전` | 캐릭터 직접 전투 — `DG` 상태 · `dgStep`/`dgTick` 자체 루프 · `DG_FOES` 자체 적 표 · `dgRender`(DOM 유일 접점). **유즈맵과 완전 분리** |
| `⚔ 던전 1~10` | **자동사냥 던전 정체성 + 3D 유닛** — `HB_DUNGEONS`(10곳 단일 소스) · `hbFloor`(타일+틴트) · `hb3dAttach/Detach`(공용 `#cvMarine`) · `_hbU`/`hb3dList`(**관리자 랩과 같은 표준 유닛 객체**) · `hbFrame`이 **`M3D.sync(list,W,H,dt,[],[],null,k)`** 호출 — 랩(`fxLabRender`)과 같은 방식 |
| `📅 일일` | 출석 캘린더(4주 × 5+2칸 · `openAtt`)와 일일 퀘스트(하루 5개 + 주간 25개 · `openDaily`) — **화면은 따로, 뒷단은 공용**. `DQ_POOL`/`dqState`/`dqDraw`/**`dqNote(kind,n)`**(유일한 계측 입구)/`dqGive`. 저장은 `PROF().daily` 한 곳, 하루 경계는 `_dgDayKey()`, 주 경계는 `_dqWeekKey()` |
| `게임 상태` | `G` 전역 + `newGame()` |
| `캔버스 + 트랙` | 2D 캔버스(#cvMain) 트랙/적 그리기, `DPR`(2D쪽) |
| `유닛/적 로직` | `spawnEnemy`(→`G.pendSpawn` 대기열!), `summonPersonalBoss`, `sellUnit(유닛객체)` , 전투 판정 |
| `🌫️ 전장의 안개` | fog 격자·시야 |
| `프레임 업데이트` | `step()` — 전투/타겟팅 틱 |
| `DOM 렌더 (유닛/건물)` | `renderUnits()`(sig캐시+위치 diff), `separateUnits()`(공간 그리드), `renderBldgs` |
| `탭 / 선택 / 커맨드카드` | `switchTab`, `refreshSelCard`(§4 참조), `openMainSheet`/`openBossSheet`, `renderCmdGrid` 어댑터들(`_gachaSheetModel` 등) |
| `🎛 메인 선택 프로필` | `mainProfileRender` — sig 바뀔 때만 DOM 재빌드 |
| `🪄 유닛 스킬 프레임워크` | `SKILLS` 레지스트리, `stepSkills` |
| `앱 셸: 인증 / 유즈맵 / 모드 선택` | 타이틀→로그인→맵선택→`openModeSheet`→솔로/멀티, 설정 팝업(`setQuality` 프리셋) |
| `⚔ 전투 실험` | 관리자 Battle 탭(`G.sbFoes` 자립 더미) |
| `BGM` / `효과음` | `playSfx`/`playSfxT`/`bgm*` |
| `Supabase Realtime 소셜` | presence/로비채팅/DM/파티 |
| `★ 실제 방 시스템` | 방 목록 presence(`_roomList`), `openRooms` |
| `[admin 샌드박스]` | `enterSandbox()` — 관리자 진열 모드(`G.sandbox`) |
| `공용 유닛 로스터(단일 출처)` | `RACE_ROSTER` — 유닛 추가/개명은 여기 한 곳 |
| `💎⚡ 자원 채취` | 건설(테크) 맵 자원 |
| (tech 계열 `techPtrDown` 등) | 건설/테크 맵 — `G.tech`, `techMapRender`, 입력 흐름 `techPtrDown→Move→Up` |
| `공용 FX 코어` | 유닛별 공격 이펙트(전 유즈맵 공유) |
| `컴퓨터가 싸운다(직스)` | strike 모드 — `loop()` 최상단 `if(G.strike)` 분기로 nemo 우회 |
| `🔄 팀 순환 출격` | 사이클마다 각 팀에서 1명씩 차례로 출격 — `strikeBuildRosters`/`strikeNextTurn`/`strikeSpawnForPlayer`/`strikeSpawnWave` |
| `🎆 이펙트 테스트베드` | 관리자 Unit 탭 FX 랩 |

## 3. 전역 상태 핵심
- `G` — 게임 전체 상태. 주요 필드: `phase`('ready'/'playing'), `sandbox`, `strike`, `tab`('Main'/'Unit'/'Upgrade'/'Players'/'Battle'/'Build'), `mainSheet`('gacha'|'upgrade'|'players'|'boss'|null), `sel`(uid배열), `selEnemy`, `units`, `enemies`, `pendSpawn`(적 등장 대기열), `credits/mineral/gas`, `pbossCds`, `opt`(품질·사운드), `metaB`(영구강화), `tech`(건설 상태), `view`(줌/팬).
- 유닛 인스턴스: `{uid, id(프록시), gid/gtier/gname/gmodel(가챠), hero, x,y(0..1 정규화), hp/sh/en, moveTo, moving, fixed, atBoss, cargo}`.
- 맵 값 주입: 항상 `mapCfg('키', 기본값)` — 하드코딩 금지.

## 4. 프레임 파이프라인 (loop → …) ⚠️ 성능 핵심
`loop()`(찾기: `function loop(now)`) 매 프레임:
1. `if(G.strike) strikeFrame(dt); return` — 직스 우회
2. 배속 루프(`_sm`회): `step(dt)` + `stepCmdMove(dt)` + `separateUnits()`
3. **`refreshSelCard()` = UI 갱신 단일 진입점.** 내부에서 `updateCmdRow/updateSkillFab/updateAutoFab/updateTransportBtns/mainProfileRender/renderUnits`까지 모두 호출한다.
   **→ loop나 다른 곳에서 이들을 추가로 매 프레임 호출하지 말 것(과거 2중 실행 버그).**
4. `updatePbossFab()`(보스 탭 표시/배지) → `updateHud()` → `M3D.sync(...)`
- `separatePass` = 공간 해시 그리드(O(n)). 쌍 로직 수정 시 그리드 셀=최대 충돌지름 불변식 유지.
- `stepCmdMove`는 renderUnits를 호출하지 않는다(루프가 함).

## 5. UI 셸: 탭·시트
- **전역 하단 네비 `#navBar` = 2층 드릴다운**(2026-08-14). 단일 소스는 **`NAV_TREE`** 하나 — 최상위 5구역과 각 구역의 하위 항목을 다 갖고 있고, 마크업은 `navPaint()`가 만든다(HTML에 칸을 손으로 쓰지 말 것).
  - 최상위 `[사냥터][정비][강화][유즈맵][상점]` → 구역을 누르면 **`[‹][하위…]`** 로 내려간다. **구역 이름 칸은 두지 않는다** — 하위에 자리를 준다. `‹`(`navBack`) = 사냥터 화면 + 최상위(홈이 허브).
  - 판형: **모든 칸 등폭**(선택돼도 넓어지지 않는다 — flex-grow 1.42 는 인게임 탭바 `#tabs`만) · `‹` = 정사각 48px · 하위 선택 `.cur` = 최상위 `.on` 과 **같은 판·링**(`--nav-plate-on`+`--nav-ring-on`, 밑줄 표시는 폐기).
  - 구역별 하위(순서 = `사냥터·캐릭터·정비·유즈맵·상점`): 사냥터 **없음**(기본 화면이자 허브) · **캐릭터** `정보·성장·스킬` · 정비 `장비·펫·동료` · 유즈맵 `채팅·친구·파티`(소셜, 기본=채팅) · 상점 `한정구매·뽑기·재화·패키지·충전`.
  - **캐릭터 = '나 자신' / 정비 = '장착물'** 로 가른다. 장비를 캐릭터에도 두면 두 벌이 되므로 넣지 않는다.
    - 화면은 `#upgScreen`(옛 '강화' — id 는 아직 그대로) · 구역 전환 `setChrSec(k)` · 표 `CHR_SECS`.
    - ⛔ 정보·성장 본문은 복제하지 않는다: 팝업의 `#hbInfoBody`/`#hbGrowBody` 를 화면으로 **빌려** 오고, 팝업(`hbOpenInfo`/`hbOpenGrow`)이 열릴 때 `chrReturnBody()` 로 돌려준다 — 설정 보관함·소셜 도크와 같은 수법.
    - 스킬은 아직 읽는 곳이다(`HB_SKILLS` 3개, 레벨 없음). 강화를 붙인다면 `HB_UPG_CAT` 에 구역을 더하는 쪽이 미네랄 경제에 자동으로 붙는다.
  - ⚠ **`APP_SCREENS`/`CUR_SCREENS` 에 없는 화면은 `showAppScreen()` 이 영영 안 켠다.** 캐릭터 화면이 그래서 눌러도 안 열렸다(2026-08-14 수정).
  - `data-nav`=구역 칸 / `data-sub`=하위 칸. **키가 겹칠 수 있어**(정비 구역 = 장비 하위 = `gear`) 속성을 나눴다.
  - `sec.cur()` 가 있는 구역은 하위 한 칸이 `.cur`(밑변 2px): 정비 `_gearTab` · 유즈맵 `_mapSocial` · 상점 `_shopSec`.
  - 하위가 없는 구역(사냥터·강화)은 **내려가지 않는다**. `NAV_TREE` 에 항목을 넣으면 자동으로 드릴다운이 생긴다.
  - ⚠ **`navShow(null)` 은 '숨김'이지 '구역 이탈'이 아니다.** `showAppScreen()` 이 항상 `navShow(null)` 을 먼저 부르므로, 거기서 상태를 지우면 내려간 상태가 매번 풀린다(마을 진입에서 밟았다).
  - **유즈맵 소셜 = 화면 하단 상주 도크 `#msSocialDock`**(flex 30%). 시트를 열지 않는다 — `.msSocial` DOM 은 하나뿐이라 유즈맵 진입 시 `mapDockSocial()` 이 도크로 **옮겨** 쓰고, 마을 채팅 시트(`twOpenChat`)가 열리면 `#twChat` 로 되찾아 간다(설정 보관함과 같은 수법 — id 기반 함수들이 그대로 동작). 도크에선 탭 띠(`.msTabs2`)를 감추고(네비가 맡는다) 마을 시트에선 보인다.
  - **유즈맵 정렬**(인기순·신규·추천·즐겨찾기)은 화면 위 `#msSortTabs` 띠 그대로다(한 번 네비로 올렸다가 되돌렸다).
  - **상점 5구역**: `SHOP_SECS` 표 + `setShopSec(k)`. 옛 `renderProfGacha()` 가 4구역을 이어 붙이던 것을 `_shopDealHTML/_shopDrawHTML/_shopGemHTML` 로 쪼갠 것이고, `renderProfGacha()` 는 '전부 이어 붙이기'로 남아 옛 호출부를 지킨다. 재화·패키지는 아직 내용이 없어 `_shopSoonHTML` 자리표시.
- 하단 탭 `#tabs`: 메인/유닛뽑기/업그레이드/**보스**(게임 전용, `updatePbossFab`이 표시 제어)/플레이어 + 샌드박스 전용 전투실험/건설.
  **2층이다**(2026-08-14): 구역을 누르면 `[‹][하위…]` 로 내려간다 — 표 `GTAB_TREE` + `gtabPaint/gtabDrill/gtabSub/gtabBack`.
  칸은 HOME 네비와 같은 `_navCell()`(`.navIt`)로 만들고, **최상위 `.tab` 마크업은 그대로 두고 CSS(`#tabs.drill .tab`)로만 숨긴다**
  — `switchTab`/`_setBottomTab`/`updatePbossFab` 이 `style.display`·`.on` 을 직접 만지므로 지웠다 다시 만들면 그 상태가 날아간다.
  구역 상태는 `_homeMode`/`_gachaSec`/`_upgSec`/`_plSec`(+ 보스는 `G.bossOpen`, 자동화는 `G.mainSheet==='auto'`). 샌드박스·직스에선 내려가지 않는다.
- **포인트방(`openBossArena`)은 화면이 아니라 오버레이**다 — 입장은 네비 `보스 › 포인트방` 하나뿐이고(우상단 `#coopBossBar` 는 `pointer-events:none` 보기 전용),
  퇴장은 `gtabBack()`(‹). `gameRestHome()` 이 `closeBossArena()` 를 **직접** 부른다 — `G.tab` 이 `'Main'` 그대로라 `switchTab` 의 정리를 안 지난다.
  하단 4칸은 `[파견][파견][빈칸][전체 회수]`(`_bossArenaSheetModel`) — '돌아가기' 칸은 폐지.
- **무선택 기본 상태 = `gameRestHome()`**(2026-08-14): 하단 = 유닛 지정(`_homeMode='select'`), 네비 = 최상위 5칸이되 **어느 칸도 안 켜짐**(`_setBottomTab('')`).
  `gtabBack()`(‹)이 이걸 부른다 — 층만 올리면 '하단은 보스 시트인데 네비는 최상위'인 어중간한 상태가 남는다.
  ⚠ `switchTab` 이 안에서 `gtabDrill` 을 부르므로 층·하이라이트 정리는 반드시 그 뒤에 할 것. 메인 탭(`openMainHome`)은 첫 하위(유닛 판매)로 들어간다.
- **자동화는 메인 구역의 마지막 하위**다(2026-08-14, 옛 전송 옆 `#autoFab` 배너 폐지). `updateAutoFab()` 은 이제 배너를 만지지 않고
  해금 여부가 **바뀐 순간에만** 네비를 다시 그린다 — 매 프레임 도는 자리라 무조건 `gtabPaint()` 하면 DOM 을 매 프레임 갈아엎는다.
- ⚠ **`#hud` 는 `z-index:24`** (2026-08-14). 포인트방 입력 차단막 `#bossPanel`(z22) 위여야 우상단 ☰ 가 눌린다.
  `#hud` 가 쌓임 맥락을 만들므로 자식만 올려서는 절대 못 빠져나온다 — 바 자체를 올릴 것.
- 하단 패널 `.bp` — **id는 `'bp'+탭명` 동적 참조**(`bpMain/bpUnit/bpUpgrade/bpPlayers/bpBattle/bpBuild`). ⚠️ 미참조로 보여도 살아있음.
- **하단 판의 '면'은 `.bp::before` / `#btSheet::before` 다**(2026-08-14). 좌우 위 7px 사선 컷을 거기 건다 —
  요소 자체에 `clip-path` 를 걸면 시트 밖 `#btCardCtl`(top:-28px)이 잘려 사라진다.
- **카드 껍데기는 `.hmUp,.hsCell` 한 규칙**이다(2026-08-14) — 사냥터 업그레이드 카드와 유즈맵 유닛 카드가 면·테두리·그림자를 공유하고 액센트만 `--accRGB` 로 갈린다.
  ⚠ `:root` 토큰으로 묶으면 안 된다 — 커스텀 속성 안의 `var()` 는 선언 지점에서 치환돼 `--accRGB` 가 무효가 되고 `background` 가 통째로 죽는다.
- **유닛 카드(지정·판매·조합)는 `_hsCardHTML(gid, name, act, title, qty, rows)` 한 함수**다(2026-08-14). 수량은 초상 좌상단 뱃지고, `rows` 는 이름 아래 줄(`_hsPrice`/`_hsUpRow`).
  세 렌더러가 각자 마크업을 만들던 것을 합쳤다 — 새 화면이 유닛 카드를 쓸 때도 이걸 부를 것.
- 머리줄 초상(`.cgPort`)은 폐지했다 — `renderCmdGrid` 가 그리지 않는다(모델의 `icon` 은 남아 있다). 등급 띠는 `tierSegHTML()` → 공용 `.pdSeg`.
- 유닛뽑기·업그레이드 시트는 **구역별로 칸이 갈린다**: `GACHA_SEC_CELLS`(뽑기/타워구매) · `_upgAtkItems/_upgLuckItems/_upgPermItems`(공격력/확률/영구강화). ×5 뽑기는 `BEACON_BULK`(1회 값 × 배수) — ⚠ 좌표가 없으므로 `DRAW_BEACONS`(맵 위 비콘 표)에 넣지 말 것.
- 시트 모드: `G.mainSheet` + `renderMainSheet()` 디스패처. 유닛 지정 중엔 프로필 우선, 해제 시 시트 복원(`refreshSelCard` 분기).
- 프로필/그리드는 전부 `renderCmdGrid(host, model)` — 모델 객체로만 내용 제어(레지스트리 참조).
- **오토배틀도 같은 페인터를 쓴다**(2026-08-14): `gtabTree()` 가 모드에 따라 `GTAB_TREE`(네모) / `STK_TREE`(직스) 를 고른다.
  직스 최상위 = 건설지·특수무기·관전, 전투는 무선택 기본 화면(`strikeRestHome`). 화면 전환 알맹이는 `_stkShowScreen()`.
  특수무기는 `STK_WEAPONS` 표 하나(구입 그리드·사용 그리드·효과 분기) · 재고는 `STK.me.wpn` · 효과는 기존 필드(`hp`,`u.wait`)만 쓴다.
- **두 네비 바(HOME `NAV_TREE`/`navGo` · 유즈맵 `GTAB_TREE`/`gtabDrill`)는 같은 규칙을 쓴다**: 구역에 밖에서 들어오면 `reset()` 으로 늘 첫 하위. 이미 그 구역이면 되돌리지 않는다(안 그러면 자동화가 판매로 튕긴다).
- **하단 구역의 톤·높이는 토큰 셋 하나가 정한다**(2026-08-14): `--panelBig`(판) · `--bpFace`(속살 검정) ·
  `--bpTile`(초상 방사) · **`--bpBodyH`**(본문 높이). 다섯 섹션(메인 홈 `#defaultCmd` · 시트 `#unitCmd`/`#btSheetBody` ·
  플레이어 `#plGridWrap`)이 같은 변수를 쓰므로 값을 개별 규칙에 다시 박지 말 것 — 예전엔 시트 176px / 메인·플레이어 126px 이라
  탭을 옮길 때마다 판이 튀었다. 스모크 `하단 프로필: 다섯 섹션 같은 높이 …` 가 지킨다.

## 6. 3D 모듈 (window.M3D)
- 진입: `M3D.sync(units, GW, GH, dt, sel, enemies, selEnemy, scaleMul, view)` — 유닛/적 모델 동기화+렌더. 그 외 `syncShop/syncBuild/syncBldg/syncBoss`(탭별), `portrait`, `hasModel`, `loadMapModels/keepOnlyMap`(맵별 VRAM), `dbg()/matDbg(uid)`(디버그).
- `makeModel(id)` → `{holder(위치/스케일)→view(부감틸트)→yaw(회전)→anim(모션)}` + `inner/runInner/stayInner/atkInner`(정지/달리기/대기/공격 GLB) + `rim`(선택링 메시) + `shadow`.
- **피격·사망 연출 세기**: FX 스토어의 `hitK`(기본 1)가 impact·death 크기를 배율로 줄인다. 직스는 `STK_HIT_K=0.5` + `STK_DEATH_PARTS=5`(공용 기본 9) — 수백 기가 동시에 싸워 기본값이면 화면이 이펙트로 덮인다. **공용 FX 코어는 기본값 그대로**라 네모는 영향 없음.
- **인스턴싱(드로우콜 절감)**: 선택링=`ringInst`(_ringPush), 그림자=`shInstA/B`(_shadowInstPass, 지상0.22/공중0.26). 개별 `m.rim`은 직스 팀색·토벌장·적 선택용으로만 남음. 새 발밑 표시는 인스턴스 경로를 따를 것.
- **대군 최적화**: `_mixStride`(유닛>60 → 2프레임, >150 → 3프레임에 1회)로 스킨드 믹서를 분산(`_mixStep`). 건너뛴 프레임엔 `skeleton.update`도 홀드(`_mixHold`/`_skels`) — 본 포즈가 그대로라 화면은 동일하고 본 행렬·본 텍스처 업로드가 사라진다. 본 서브트리는 `hideBoneRoots`로 `visible=false` → three.js 렌더 순회에서 제외(손 본에 검 등 메시를 붙인 모델은 자동 제외). 해상도는 **직스 전장에서만** `STK_RES[strikeResMode()].gl`을 `M3D.sync`가 반영(고화질=1.2× 슈퍼샘플·절전=0.6×). 다른 게임(`G.strike` 거짓)·건설지(`syncBuild`는 네이티브 명시 리셋)엔 배율을 주지 않는다.
- **측정 훅(기본 off)**: `M3D.prof(true)` → `{loop, mw, render, calls, tris, objs, bones}`. `M3D.mixForce(n)`/`M3D.boneVis(on)` = 벤치 A/B 강제 토글.
- 플레이어색: `_toneInject`(HSV 본체 회색화+액센트 마스크) + fresnel 림(`addRim`). 상수: `TINT_*`, `RIM_*`(`RIM_MUL` 유닛별 배율).

## 7. 유즈맵 모듈 시스템
[공유 베이스](엔진·렌더·3D·UI셸·U) + [유즈맵 모듈](등급·가챠·밸런스·경제). 새 맵 = `USEMAPS`에 항목 추가 + `cfg`/`cfg.bal` 오버라이드. 직스(strike)가 "nemo 셸 재사용 게임플레이 모듈"의 선례.

## 8. 멀티/소셜
Supabase Realtime presence 기반(방 목록·로비·파티·귓말). 방 목록엔 시뮬 봇 방 혼재(`buildRoomList`). 게임플레이 자체는 로컬.
- 팀 분할은 **로비 규칙이 단일 소스**: `slotTeam(i)` = 앞 절반 1팀 / 뒤 절반 2팀(8인 → 1~4 vs 5~8), 입장은 `lobbyFillOrder()`로 두 팀 번갈아(1,5,2,6…). 직스 인게임도 같은 기준(`strikeTeamOf`, 상수 `STK_TEAM_HALF=4`).
- 직스 **팀 순환 출격**: 사이클마다 각 팀에서 **한 명씩만** 출격한다(8인 → 1주기 1·5, 2주기 2·6 …). 팀 인원이 다르면 팀별로 독립 랩어라운드(2:3 → 1·5, 2·6, 1·7). 이탈자는 `G.activePlayers`에 없으면 `strikeNextTurn`이 건너뛴다. 로컬 플레이어만 실제 건설지(`G.tech`)로 생산하고(미완성 `bt>0`·파괴 `_dead` 건물 제외), 나머지는 그 종족 건물 구성으로 시뮬(규모는 로컬 건물 수에 연동). 인게임 유닛 동기화는 없으므로 **다른 플레이어는 로컬 시뮬**이다.

## 9. 검증 (필수 워크플로)
```bash
npm test                      # 전 그룹: lobby / game / sandbox (헤드리스 크롬, ~10초)
node test/run-smoke.mjs game  # 한 그룹만
node test/bench-strike.mjs 400 80 4   # 대규모 전투 렌더 벤치(유닛수 프레임수 반복수)
```
- 벤치(`test/bench-strike.mjs`)는 직스 맵에 유닛을 강제 소환해 프레임을 `strikeStep`/`M3D.sync`(JS루프·월드행렬·renderer.render)로 쪼개 잰다. **실제 GPU가 필요해 창을 띄운다(headful) — 창을 가리면 컴포지팅이 멈춰 값이 무의미**해진다. 조건은 한 페이지 안에서 교대(A/B/B/A) 측정 — 전투가 진행될수록 유닛이 뭉쳐 부하가 오르므로 순서를 고정하면 뒤 조건이 손해를 본다. 런 간 편차 ±5% 수준이라 그보다 작은 개선은 이 벤치로 판정 불가.
- 환경변수: `BENCH_URL=주소`(이미 떠 있는 개발 서버로 측정) · `LOWPOLY=1`(삼각형이 병목인지) · `BONEVIS=1`(본 순회 제외 효과) · `PXDBG=1`(화면상 유닛 px) · `SHOT=경로`(시뮬 정지 후 3배 해상도 스크린샷) · `FORCEID=유닛id`(전 유닛을 한 종류로 — 1:1 비교) · `BONECHK=유닛id`(부착물 모델이 본 제외에서 빠지는지 검증).
- 스위트 본체: `test/smoke.js` (인페이지 주입, `runSmoke(group)`), 러너: `test/run-smoke.mjs`(내장 정적 서버+puppeteer-core→시스템 크롬).
- 스텝 추가법: `test/smoke.js`의 해당 그룹 함수에 `await step('이름', ()=>{ ... assert(...) })` 한 줄. 없는 기능은 `skipIf`.
- 수정 후 `npm test` 통과 없이 "완료" 선언 금지. 구문 검사는 vm.Script(classic)+`node --check`(module).

## 10. 함정 목록 (실제로 밟았던 것)
- **죽은 코드 판정에 이름 검색을 쓰면 조립되는 이름을 못 본다** (2026-08-14, 실제로 회귀를 냈다). 클래스·에셋 이름의 상당수가 문자열로 조립된다 — `'mcLine sc-'+scope` · `'fDot-'+st` · `'bld_'+key` · `'up_'+UPG_ICO[k]` · `'sk_'+(SKILL_ICO[k]||k)` · `'dg'+n` · `'vc-'+spd`. 문서 전체 검색으로 0회라고 지우면 **로비 채팅이 통째로 안 보이는** 식으로 조용히 깨진다(`.msChat .mcLine{display:none}` + `.sc-*{display:block}` 구조라 CSS만 지워도 기능이 죽는다).
  - 판정 절차: ① 이름이 그대로 나오는가 → ② 안 나오면 **조립 접두사 대조**(`'P'+` 형태의 문자열 리터럴을 모아 `name.startsWith(P)` 확인) → ③ 그래도 애매하면 브라우저에서 화면을 돌며 `document.querySelector('.'+c)` 로 실물 확인.
  - 지운 목록·오탐 목록은 `CLEANUP.md` 에 남긴다.
- **던전 배경은 정지 1장 + (선택) 움직임 4프레임이다.** `dgN.webp`가 기본, `dgN_f1..f4.webp`가 있으면 `hbFloor`가 두 장을 겹쳐 크로스페이드한다. 순서는 **핑퐁(1→2→3→4→3→2)** — 순환하면 영상의 끝↔처음이 달라 툭 튄다. 위상은 순수 함수 `hbBgPhase(t,n)`이라 스모크가 이음새·인접프레임·최대점프를 직접 검사한다. ⛔ 프레임 수를 늘리지 말 것: 1024² 한 장이 디코딩되면 4MB라 32장이면 134MB다. 실측 비용은 60fps 유지(측정 노이즈 이하).
- **던전 전체 개방은 `HB_DG_ALL_OPEN` 한 줄이다(지금 `true`).** 배경·밸런스를 던전별로 확인하려고 열어 뒀다. 해금 진행을 되살리려면 이 값만 `false`. `const`가 아니라 `let`인 이유는 스모크가 껐다 켜며 **양쪽 상태를 다 검사**하기 때문 — 기본값을 바꿔도 테스트는 그대로 통과한다.
- **웨이브 실패 = 1웨이브부터 다시, 라운드는 유지** (2026-08-12). `hbWaveFail()` — 20초 안에 필드를 못 비우면 `phase='fail'`, `HB_FAIL_S`(3초) 뒤 캐릭터가 **가운데(회복 구역)에서 최대 체력으로** 서고 `wave=1`로 재시작한다.
  - **죽음(`hbDie`)과 구분할 것** — 죽으면 라운드가 내려가지만, 시간 초과는 라운드를 유지하고 클리어 보너스 몫(`_hb.buf`)만 잃는다.
  - 예전 규칙은 "시간이 끝나도 다음 웨이브로 넘어가 적이 누적"이었다. 그래서 `mop`(마지막 웨이브 잔존 소탕) 단계는 **진입 경로가 없어졌다** — 함수는 옛 저장 호환으로만 남겨 뒀다.
- **📦 상자는 '공격 대상'이다** (2026-08-12). 사냥터는 회복 구역이 중앙이고 적이 알아서 찾아오니 가운데를 뜰 이유가 없었다. 상자는 사거리 안에 들어와야 때린다 → 초반엔 걸어가야 하고, **사거리를 올릴수록 앉은 자리에서 더 많이 부순다**(방치 보상이 사거리 업그레이드에 붙는다).
  - **적이 항상 우선** — 적이 사거리에 있으면 상자는 안 때린다. 안 그러면 상자 때문에 딜을 흘려 웨이브를 못 버틴다.
  - 웨이브마다 1개(최대 `HB_CHEST_MAX`), **다음 웨이브가 시작되면 사라진다**(`hbSpawnWave`에서 초기화) — 모아 두고 한 번에 줍는 게 최적이 되지 않게.
  - 캐릭터에서 `HB_CHEST_MIN_D` 밖 · 회복 구역 위 제외 · **보이는 영역 안**(맵이 화면의 2×2라 밖에 두면 있는 줄도 모른다. 가장자리 화살표는 아직 없다).
  - 보상은 섞어서(`hbChestReward`): 뽑기권 74% · 일시 버프 20% · 젬 6%. **미네랄은 일부러 안 준다** — 상자 효율이 웨이브 효율을 넘으면 전투를 방치하고 상자만 도는 게 최적이 된다. 젬은 그전까지 획득 경로가 없던 재화다.
- **성장 축은 미네랄 업그레이드(`HB_UPG`) 하나다** (2026-08-12 확정). 구역은 `HB_UPG_CAT` 4개 — `char`(내 캐릭터) · `ally`(동료) · `bld`(건물) · `pet`(펫). 아군 3구역의 업그레이드는 **`hbAllyMul()` 한 곳에서만** 실제 수치가 된다(`HB_ALLY_DPS` 등 상수를 호출부에서 직접 쓰지 말 것). `HB_UPG_CAT_BUILD`가 지정한 구역은 **건설(수량) 카드도 같은 격자에 함께** 낸다 — 사는 곳과 키우는 곳을 나누지 않는다. 옛 구역 키(atk/def/util)가 저장돼 있으면 `hbHunt()`가 `char`로 되돌린다. 캐릭터 스탯에 **직접 찍는 경로는 없다** — 레벨 포인트도, 자동 배분도 폐지했다(`profAllocStat`·`hmAllocStat`·`profDoAlloc`·`profGainStats` 전부 삭제).
  - 레벨업 보상 = 미네랄 `PROF_LV_MINERAL`(레벨당 10). `profApplyLevelUps`가 오른 레벨 수만큼 한 번에 준다.
  - `migrateProfile` v6가 옛 저장을 옮긴다: 배분 스탯 → 대응 업그레이드 레벨(캐릭터 중 최대, `pow=atk·vit=hp·foc=crit·agi=aspd`), 남은 포인트 → 미네랄(1pt=20). ⚠ **옮긴 뒤 `unit.stats`를 0으로 비운다** — 안 비우면 같은 스탯이 업그레이드와 스탯 양쪽에 남아 파워에 이중 계상된다(한동안 그 상태였다).
  - 이후 `profStat(k)`에 남는 것은 직업 기본치 + 레벨 + 장비 + 진화★뿐이다. 스모크가 "레벨업해도 `unit.stats`는 안 변하고 미네랄만 는다"를 검사한다.
- **첫 진입 멈춤은 '개수'가 아니라 '처음'에 붙는다 — 미리 데워서 로딩으로 옮긴다.** 모델을 처음 만들 때 텍스처 GPU 업로드 + 셰이더 컴파일이 한꺼번에 일어난다(실측 538ms). 두 번째부터는 4ms다. `warmAll()`이 `warmIds()`(전 직업 유닛 + 현재 던전 적 3종)를 **한 프레임에 하나씩** 만들고 한 번 렌더한 뒤 `clearGameModels()`로 지운다 — 인스턴스는 지워도 GPU 캐시는 남는 것이 요점. 한꺼번에 만들면 로그인 화면이 그만큼 얼어붙으므로 프레임당 하나를 지킬 것.
  - 로그인 화면이 뜨면 400ms 뒤 백그라운드로 시작하고, 로그인/게스트는 `enterAfterWarm()`이 **완료를 기다린 뒤** HOME으로 간다. 로딩 UI는 **부팅용 `#opening`을 그대로 재사용**한다(새로 만들지 않는다) — CSS의 가짜 진행 애니메이션을 끄고 `.opBar` 인라인 폭에 실제 비율을 넣으며, 끝나면 인라인 값을 지워 다음 로딩이 100%에서 시작하지 않게 한다.
  - 실측: 바로 누르면 736ms, 로그인 화면에 3초 있다 누르면 238ms(대부분 `HB_WARM_HOLD`). HOME 진입의 긴 작업은 **538ms → 0**.
- **화면을 떠나도 그 화면의 rAF 루프는 죽지 않는다 — 공용 3D 캔버스를 놓고 싸운다.** 유즈맵 `loop()`는 전역 rAF라 HOME/마을에 있어도 계속 돌며 `M3D.sync(G.units,…)`를 불렀다. HOME의 sync가 남의 모델을 `dying`으로 지우면 유즈맵이 다음 프레임에 38개를 다시 만드는 왕복이 생겨 **60 → 47fps**로 떨어졌다(「유즈맵에서 나와 RPG로 가면 랙」의 정체). 마을 `twTick`도 같은 부류 — 살아 있으면 매 프레임 캔버스를 다시 빌려 가서, 마을에서 곧장 게임으로 들어가면 **유즈맵 3D가 통째로 사라졌다**.
  - 판정은 `nemoScreenOn()` = **APP_SCREENS가 하나도 안 열려 있음**. `#phone.inGame`은 샌드박스 진입에서 안 켜질 때가 있고, `#gameArea`는 HOME이 떠 있어도 계속 보여서 둘 다 못 쓴다.
  - `nemoOwns3D()`는 보이는데 남이 들고 있으면 **되찾아온다**. 반납 누락 하나로 유즈맵 3D가 사라지는 것보다 낫다.
  - 화면을 떠날 때는 **반납 전에 그 화면의 루프를 세운다**(`twLeave()` → `tw3dDetach()`). 순서를 바꾸면 루프가 다시 빌려 간다. 단 마을로 **들어가는** 전환은 예외 — `openTown`이 `_townOpen`을 켜고 `showAppScreen`을 부르므로 여기서 끄면 마을 3D가 안 뜬다.
  - 게임 진입은 **반드시 `hideAppScreens()`를 거친다**. `enterSandbox`만 빠져 있어서 HOME이 열린 채 게임이 시작됐다.
  - 스모크 「HOME/마을에서는 유즈맵이 3D를 그리지 않는다」는 모델 개수가 아니라 **`sync`의 첫 인자가 `G.units`인지**로 검사한다 — 앞 스텝 상태에 안 흔들린다.
- **화면 전용 장식은 "기본 끔 + 그리는 쪽이 켠다"(화이트리스트).** 고정 슬롯 터렛/포토 고스트는 네모네모 전용인데 예전엔 `sync`에서 **기본으로 그려졌고**, 빌려 쓰는 화면이 각자 끄는 플래그(`__sandbox`→`__strike`→`__unitView`)를 추가해야 했다. 그래서 **새 맵을 만들거나 관리자 페이지에서 시스템을 가져올 때마다 유령 터렛이 그대로 따라왔다** — 새 호출부는 그 목록에 없으니까. 지금은 반대다: `window.__nemoView`가 켜진 동안만 그리고, 네모네모 본편/관전이 `sync` **호출 한 줄을 감싸서**(`try/finally`) 켠다. 새 화면은 아무것도 안 해도 깨끗하다. 스모크는 플래그가 아니라 `M3D.idleVisible()`로 **보이는 개수 0**을 확인한다.
- **`M3D.sync`는 모든 모델 풀을 숨기지 않는다.** `shopModels`·`buildModels`·보스는 숨기지만 **뽑기 비콘(`beaconInsts`)·미건설 고스트(`ghostModels`)·배치 고스트(`buildGhostModels`)는 그대로 둔다.** 공용 캔버스를 빌려 쓰는 화면은 **`M3D.clearIdlePools()`로 지우고 시작하고, 돌려줄 때도 지운다**(숨기기가 아니라 삭제 — 숨긴 것은 다시 켜지면 도로 나타난다). 각 풀은 '없으면 만든다'라 원래 화면에서 재생성된다. 선례: HOME에 '미사일 포탑' 고스트가 남았다. 규칙은 CLAUDE.md 「잔상 금지」.
- **화면 함수는 `loadMeta()`를 먼저, `showAppScreen`(→`hbStop`)을 나중에 부른다.** 그래서 `hbStop`에서만 저장하면 **이미 지워진 값을 저장**한다 — 자동사냥 처치 보상이 화면을 옮길 때마다 사라지던 진짜 이유다. 저장 안 된 보상은 `_hbDirty` 플래그로 표시하고 **`loadMeta()` 첫 줄에서 flush**한다(모든 화면이 지나는 유일한 길목).
- **HOME 전투는 화면을 떠나도 계속 돈다**(2026-08-10 요청). `hbStop`은 '정지'가 아니라 **그리기만 중단(`_hb.bg=true`) + 저장 + 3D 반납**이고, 시뮬 `setInterval`은 살아 있다. 재진입(`hbStart`)은 새 판을 만들지 않고 **이어받으며**, 자리를 비운 사이의 업그레이드를 반영하려 캐릭터 스탯만 다시 읽는다. 진짜 종료는 `hbEnd()`(로그아웃). 스모크가 새 판을 원하면 `hbEnd()`를 먼저 부를 것.
- **카메라 보간(`HB_CAM_EASE`)은 작은 변화용이다.** 화면을 갔다 오면 레이아웃이 통째로 달라져 보간이 한동안 어긋난 채 그린다(적이 스킬 바 뒤로 지나간다) → `HB_CAM_SNAP`(24px) 넘게 벌어지면 즉시 맞춘다.
- **3D 유닛을 그릴 땐 `M3D.sync`에 '표준 유닛 객체'를 넘긴다** — `{uid,id,x,y(0..1),face,moving,fireSeq,size,hidden}`. 관리자 이펙트 랩이 정확히 이 모양을 만들어 `M3D.sync(list, W, H, dt, [], [], null, k)`로 넘긴다(`k=clamp(zoom*0.72,.12,1.7)`). **`syncBuild`(건설 뷰)로 그리지 말 것 — 거긴 `fireSeq`(공격 모션) 처리가 아예 없고 `scaleMul` 기본값도 0.5다.** 던전을 처음에 syncBuild로 붙였다가 공격 모션이 안 나오고 크기가 어긋나 되돌렸다.
- **`fireSeq`는 누적 카운터다.** 공격할 때 `u.fireSeq++` 하면 `sync`가 공격 애니를 재생한다. 유닛 객체를 **매 프레임 새로 만들면 0으로 리셋**되어 공격 모션이 영원히 안 나온다 — 객체를 적/캐릭터에 붙여 두고 재사용할 것.
- **유닛이 바라보는 각도는 게임 전체가 `Math.atan2(dx, dy)` 하나로 통일돼 있다**(`dx=대상x-내x`, `dy=대상y-내y` · 예: `u.face=Math.atan2(tgt.x-u.x, tgt.y-u.y)`). 스프라이트 실험장의 `sprDir`은 `atan2(nx,-ny)`로 **y가 뒤집힌 별개 규약**이다 — 이걸 3D `face`에 넘기면 모델이 정반대를 보고 **총알이 등 뒤에서 나가는 것처럼** 보인다(실제로 그랬다). 3D 회전에는 반드시 게임 식을 쓸 것.
- **조준은 쏠 때만 돌리면 안 된다.** 게임은 정지 상태에서도 매 프레임 대상을 바라본다(`정지 + 대상 바라봄`). 발사 순간에만 각도를 갱신하면 쏘기 직전까지 엉뚱한 곳을 보고 있어 같은 증상이 난다.
- **`M3D.syncBuild`의 목록 규약 두 가지를 틀리면 조용히 망가진다.** ① 모델 풀은 **`it.uid`**로 찾는다 — `key` 등 다른 이름으로 주면 전부 `undefined`로 충돌해 **모델 하나를 돌려쓰고** 유닛이 사라지거나 깜빡인다. uid는 프레임마다 바뀌면 안 된다(매번 모델 재생성). ② `scaleMul`(5번째 인자)의 기본값은 **0.5**다 — 안 넘기면 절반 크기로 나온다. 던전은 `scaleMul=1`로 두고 유닛별 `scl = 원하는화면지름 / (2*M3D.footprintOf(id))`로 역산한다(`HB_PX_CHAR/FOE/ELITE`).
- **던전 3D는 공용 캔버스(`#cvMarine`)를 빌려 쓴다 — 반드시 돌려놔야 한다.** 렌더러가 그 캔버스 하나에 묶여 있어, HOME에 붙인 채로 게임에 들어가면 **유즈맵 3D가 통째로 사라진다.** 원복 경로는 `showAppScreen`·`hideAppScreens`·`hbStop` 셋 다 걸려 있어야 한다(`hideAppScreens`가 실제로 빠져 있었고 스모크가 잡는다). 새 화면 전환 경로를 만들면 여기도 확인할 것.
- **던전 유닛 렌더는 새로 만들지 않는다.** `M3D.syncBuild(list,W,H,dt)`가 이미 정규화 좌표·`face`+`yawFix` 회전 보간·`moving` 걷기 모션(run GLB 또는 절차적 bob)을 전부 한다 — 메인 게임과 같은 경로다. 각도는 8칸이 아니라 **연속 라디안**(`atan2(nx,-ny)`, 북=0).
- **스프라이트 시트 표는 `SPR_UNITS` 하나다.** 관리자 실험장(`SPR_MARINE`)과 던전 전장이 **같은 객체**를 본다 — 복사본을 만들면 곧 어긋난다(스모크가 `SPR_MARINE===SPR_UNITS.marine`을 검사). 시트를 새로 구우면 `SPR_UNITS`에 한 줄만 추가하면 두 곳에 동시에 반영된다.
- **8방향 규약은 `sprDir(nx,ny)` 하나다**(북=0, 시계). 적은 이동할 때 `f.dir`을 여기서 갱신하고, `M3D.unitSprite(id,dir)`가 같은 규약으로 8장을 구워 캐시한다. 정지 그림 한 장을 8방향에 돌려쓰면 어느 쪽으로 걸어도 같은 그림이라 **미끄러져 보인다**.
- **`hbPump()`는 실제 경과시간으로 돈다** — 스모크에서 촘촘히 부르면 `dt≈0`이라 아무것도 안 움직인다. `_hb.manual=true`로 두고 `hbStep(고정dt)`를 직접 돌릴 것. phase도 `fight`로 고정해야 이동 루프가 돈다(웨이브 타이머가 넘어가면 멎는다).
- **`MODELS`는 모듈 스코프다.** 클래식 스크립트·스모크에서 `typeof MODELS==='undefined'`로 감싸면 검사가 **항상 통과**한다(실제로 던전 표 모델 키 검사가 그렇게 헛돌았다). 카탈로그가 필요하면 `M3D.modelKeys()`를 쓰고, M3D가 없는 환경에선 통과시키지 말고 "미검증"이라고 밝힐 것.
- **자동사냥 전장은 2D 캔버스라 3D를 직접 못 얹는다.** `M3D.unitSprite(id)`가 GLB를 원래 재질 그대로 PNG로 한 번 구워 주고, 캔버스는 그걸 `drawImage`한다. `M3D.portrait()`는 흰 실루엣(UI 칩용)이라 전장에 쓰면 적이 전부 흰 종이가 된다 — 용도가 다르다.
- **캔버스 패턴은 카메라 변환을 같이 받는다.** 타일을 월드 좌표에 1:1로 깔면 흙 한 덩이가 화면을 덮는다 → `pattern.setTransform(scale)`으로 줄여야 '바닥 질감'으로 읽힌다(`HB_TILE_SCALE`).
- **부팅 타이머가 화면을 덮는다.** `bootApp()`의 `setTimeout(openAuth, 1700)`은 오프닝을 걷어내는 용도인데, 무조건 부르면 1.7초 사이에 이미 다른 화면으로 넘어가 있어도 로그인 화면이 그 위를 덮는다. 스모크가 "유즈맵에서 뒤로 갔는데 HOME으로 안 옴"으로 **간헐 실패**하던 진짜 원인이었다(그룹 실행 시간이 1.3~1.5초라 경계에 걸렸다). `#opening`이 아직 안 감춰졌을 때만 열도록 가드가 들어가 있다 — 빼지 말 것.
- **동적 id/클래스**: `'bp'+탭`, `'body-'+id`, `'arr-'+id`, `'fDot-'+status` 등 — "미참조" 판정 전 접두사 조합 검색 필수.
- **`sellUnit(u)`는 유닛 객체**를 받는다(uid 아님). 적 소환은 `G.pendSpawn` 대기열 경유(즉시 `G.enemies` 증가 아님).
- **백그라운드 탭 측정 왜곡**: 브라우저 팬이 숨겨지면 rAF 정지·WebGL 스로틀 → 성능 절대값 비교 불가. 같은 표시 상태끼리만 비교.
- `THREE.GLTFLoader: Couldn't load texture blob` 콘솔 오류 = 기지 이슈(동시 로드), 스모크에서 knownNoise로 분류.
- 스킨드 메시 bbox 부정확 · WebGL 캔버스 preserveDrawingBuffer=false(픽셀 읽기 불가).
- **`M3D.sync` 목록에서 빠진 것 = 사망으로 처리된다**: 직스는 화면 밖 유닛을 잘라내(`STK_CULL`) 목록에서 빼므로, 나갔다 `DEAD_HOLD`(2초) 안에 돌아온 유닛은 사망 모션이 걸린 모델을 그대로 재사용한다. 되살리지 않으면 **멀쩡한 유닛이 누운 채 이동하다가 모델 재생성 시 벌떡 일어난다.** → 아군·적 루프 진입부에서 `reviveModel`로 해제. 컬링을 새로 넣는 코드는 이 상호작용을 반드시 확인할 것.
- **임포스터(스프라이트 대체)는 만들었다가 제품 판단으로 걷어냈다**: 400기 기준 드로우콜 1,340 → 144, 26 → 39 FPS까지 나왔지만, 직스 기본 줌에서 유닛이 4~19px이라 전환 임계(20px) 아래 = 사실상 전투 내내 스프라이트로 보였다. "항상 3D 모델로 움직여야 한다"는 요구와 맞지 않아 제거(2026-07-31). 다시 필요하면 그때 측정치와 함정(밉맵 금지·정사각 프레임 금지·premultipliedAlpha 필수)을 참고할 것.
- **대군 렌더 병목은 삼각형도 재질도 아니다(실측)**: 400기에서 전 유닛을 1/7 폴리곤 모델로 바꿔도, 전 유닛 재질을 공유 단일 재질로 바꿔도 프레임이 나아지지 않았다. `renderer.render` 시간은 **드로우콜 수에 거의 선형**(229콜 4.9ms / 488콜 9ms / 1250콜 22ms ≈ 18µs·콜). → 지오메트리 LOD·텍스처 축소는 헛수고, 줄일 것은 **오브젝트/드로우콜 수**(유닛당 2~3콜).
- 상호작용 버그는 핸들러 흐름(`techPtrDown→Move→Up`, tick)을 끝까지 읽고 나서 수정(CLAUDE.md 원칙).
- **마을은 월드 좌표 + 카메라다(화면 % 아님)**: 캐릭터는 CSS로 화면 정중앙 고정이고 매 프레임 `#twWorld`의 `transform` 한 줄만 바뀐다(구역이 늘어도 비용 불변). 구역 추가·좌표·아이콘·패널은 전부 `TOWN_ZONES` 한 곳 — DOM은 `twBuildZones`가 만든다(마크업에 좌표를 적지 말 것). 월드는 화면×`TW_WORLD_MUL`이라 **구역 대부분이 화면 밖**이고, 화면 가장자리 방향 표시(`twEdgeApply`)가 유일한 길잡이다. 이동 로직은 `twStep(dt)`로 분리 — rAF(`twTick`)와 헤드리스 스모크가 같은 함수를 쓴다(헤드리스는 rAF가 안 돌아 수동 pump 필요).
- **던전은 유즈맵과 코드가 닿아선 안 된다**: `DG` 상태 + `dgTick` 자체 rAF + `#dgScreen`으로 돌고, `G`/`step`/`loop`/`U`/`GACHA_*`/`mapCfg`/`metaBonus`를 **한 줄도 참조하지 않는다**(적 표·밸런스도 `DG_FOES`로 자체 보유). 스모크 `던전: 유즈맵 상태를 건드리지 않음`이 ① 던전 함수들의 `toString()`에 유즈맵 전역이 등장하는지(정적) ② 한 판 돌린 뒤 `G` 스냅샷이 그대로인지(동적) 두 방향으로 지킨다 — 새 던전 코드를 쓸 때 이 스텝을 먼저 볼 것.
- **던전 전장은 가로 배율 하나로 그린다**: `DG_W`는 고정, 세로 `DG.h`는 진입 시 아레나 실제 비율로 계산(`DG_W*clientH/clientW`). 이걸 상수로 두면 세로가 긴 화면에서 전투가 위쪽에 몰리고 아래가 텅 빈다. 적의 `range`는 공격 사거리이자 **접근을 멈추는 거리**라, 근접이라도 스프라이트 반지름 2개분(≈28+) 이상이어야 서로 파묻히지 않는다(16으로 뒀다가 캐릭터와 적이 완전히 겹쳤다). 적끼리는 `DG_SEP` 밀어내기가 없으면 한 점에 포개진다.
- **장비는 아이템이다(ver4)** — `c.unit.gear[slot]`은 **정수 티어가 아니라 아이템 id(문자열)**다(ver3까지는 정수였고 `migrateProfile`이 동등 성능 아이템으로 변환한다). 가방(`PROF().items`, `PROF_INV_MAX`칸)은 **계정 공용**이라 캐릭터를 지워도 남고 장착만 풀린다 → **환급 대상이 아니다**(`profSpentOn`에 장비를 다시 넣지 말 것). 한 아이템은 한 캐릭터만 장착(`profItemHolder`로 검사). 등급 확률·가격은 **프로필 전용 표 `PROF_ITEM_TIERS`** — 유즈맵 가챠 밸런스(`GACHA_TIERS.prob`)를 쓰면 안 된다(표시 이름·색만 공용). 아이템 한 줄 UI는 `_profItemRow` 하나로 통일.
- **장비 화면은 페이퍼돌이고 페이지가 둘이다**: 가운데 캐릭터 도형(`PROF_FIGURE` — 종족 구분 없는 단일 인간 외곽선 SVG, viewBox 100×200 자체 제작) 위에 슬롯을 겹치되, **한 페이지엔 자기 `part`만** 올린다(`PROF_GEAR_PAGES` = 장비 6칸(헬멧·장갑·상의·무기·하의·신발) / 장신구 6칸(귀고리·망토·목걸이·보조무기·반지·벨트), 섹션 이동은 아바타 **아래**의 세그먼트 바 `_profPageNav`(`.pdSeg`, 화살표 버튼 아님) — 위쪽은 `.gearSum`(장비 합계) 자리다). 장비 페이지에 장신구가 섞이면 안 된다 — 스모크가 양쪽 페이지의 `title`을 대조해 지킨다. 슬롯 위치는 `PROF_GEAR`의 `part`/`x`/`y`(%) 하나에서 나온다(별도 좌표표 없음). 슬롯을 늘릴 땐 `part`를 반드시 지정할 것 — 빠지면 어느 페이지에도 안 나온다. 구워둔 초상(`assets/portraits`)은 **흉상**이라 신체 위치를 잡을 수 없어 쓰지 않는다.
- **해금 축은 캐릭터 레벨 하나로 통일한다**: 장비 슬롯은 `PROF_GEAR[slot].reqLv`(판정 `profSlotLocked`) — Lv.1엔 헬멧·상의·하의·신발·무기 5칸, 이후 장갑5·벨트8·목걸이12·귀고리16·반지20·보조무기25·망토30. 던전 층도 같은 축이다: `dgFloorCap()` = `1+floor((level-1)/DG_LV_PER_FLOOR)`, 역산은 `dgFloorReqLv(floor)`. 드랍·구매(`profSlots`)·장착(`profEquipItem`)·던전 입장(`dgEnter`)이 전부 이 판정을 거치므로 **잠긴 칸용 장비가 떨어지지도, 못 갈 층에 들어가지도 않는다.** 파워 기반 해금(`PROF_UNLOCKS`)은 방치수익 쪽에만 남았다 — 장비에 다시 섞지 말 것.
- **장비창은 위/아래 두 구역이고 전체가 스크롤 없이 들어간다**: 위 = 아바타(`.pdFig`, `opacity:.34`로 흐린 배경) **위에 겹친 그 페이지의 슬롯**(`.pdSlot`, 좌표는 `PROF_GEAR`의 `x`/`y` %) + 페이지 넘김 줄(`.pdNav`), 아래 = 가방(`.bagSec`, 늘 열려 있고 `.bagBody`만 따로 스크롤). 카드에 `gearFull` 클래스를 붙여 크기를 고정해야(`openTownPanel`) 두 구역이 나뉜다 — 안 붙이면 본문이 늘어나 위쪽이 잘린다. **목록을 본문 아래로 이어 붙이거나 슬라이드 시트로 감추지 말 것**(둘 다 해봤고 각각 스크롤·가려짐 문제가 났다).
- **장비창 높이 배분은 "가방이 고정, 아바타가 나머지"다**: `.bagScroll{flex:0 0 auto;height:172px}`(6열 × 3줄) + `.bagSec{flex:0 0 auto}` + `.pdWrap{flex:1 1 auto;min-height:196px}`. **`.bagSec`를 늘어나게(`flex:1 1 auto`) 두면 안 된다** — 격자 높이가 basis가 되어 짐이 늘수록 아바타를 밀어낸다(실제로 아바타가 292→205px로 찌그러졌다). 반대로 `.bagSec`에 큰 `min-height`를 주면 짧은 화면(≈640px)에서 카드를 넘쳐 잘린다. 착용 구역을 넓히고 싶으면 `.bagScroll`의 `height`를 줄일 것. 숫자를 바꿀 땐 스모크 `장비창: 짐이 많아도…`가 **6그리드 · 칸 ≤54px · 3줄 이상 · 가방 < 착용 구역 · 카드 밖으로 안 나감**과 **세로 순서 `gearSum > pdWrap > pdNav > bagSec`**를 지킨다.
- **가방 분류 칩(`PROF_BAG_CATS` = 전체 + `PROF_GEAR_PAGES`)은 페이퍼돌 섹션과 같은 축을 쓴다** — 분류 목록을 따로 만들지 말 것(페이지를 늘리면 칩도 따라 늘어난다). 칩은 `.bagHead` 안에서 개수 표시와 **한 줄**을 나눠 쓴다(따로 줄을 잡으면 가방이 26px 커지고 위 세그먼트 바와 똑같이 보여 헷갈린다). 칸을 지정한 상태(`_gearPick`)에선 칩 대신 `이름 + 전체` 버튼이 그 자리에 온다.
- **아이템 상세(`.igInfo`)는 가방을 밀어내는 바가 아니라 겹쳐 올라오는 팝업이다**: `.bagSec{position:relative}` 기준의 `position:absolute;bottom:0`이라 열고 닫아도 위·아래 구역 높이가 그대로다(닫기는 `.igClose` → `profCloseInfo()`, 같은 칸을 다시 눌러도 닫힌다). 예전처럼 흐름 안에 넣으면 뜰 때마다 가방이 눌리고, 자리를 만들려고 `bagSec`의 `min-height`를 키우면 짧은 화면에서 카드를 넘친다(둘 다 겪었다).
- **가방 스크롤 위치는 재렌더를 넘어 살아남아야 한다**: `refreshTownPanel`이 `innerHTML`을 통째로 갈아끼우므로 `.bagBody.scrollTop`을 직접 저장·복원한다. 안 하면 아래쪽 아이템을 고를 때마다 가방이 맨 위로 튄다. "더 있음" 그림자는 `.bagScroll.more`(`bagScrollHint()`가 토글) — 팝업이 `display:none`인 동안은 높이가 0이라 판정이 안 되니 `popShow` **뒤에** 한 번 더 부른다.
- **아바타(`PROF_FIGURE`)는 SF 파워아머 실루엣이고 얼굴을 그리지 않는다**(투구 + 바이저로 대신). 각 부위를 각진 닫힌 판으로 그리고 먼 것부터(다리 → 골반 → 흉갑 → 팔 → 어깨판 → 투구) 쌓는다. 팔은 골반 아래로 길게 내리지 말 것 — 다리와 이어져 코트처럼 보인다(실제로 한 번 그랬다). 어깨판도 원호(`Q`)로 부풀리면 풍선처럼 보여 각진 판으로 그린다. 머리는 헬멧 슬롯이 덮으므로 세부를 넣어도 보이지 않는다.
- **슬롯/아이템 아이콘은 이모지가 아니라 라인아트 글리프**(`PROF_SLOT_ICON` + `_slotGlyph`, viewBox 24 stroke-only): 빈 칸은 글리프를 흐리게 깔고 가운데 `＋`, 채운 칸은 등급 색 + 레벨 배지, 잠긴 칸은 글리프를 흐리게 깔고 **가운데에 자물쇠 아이콘(`PROF_LOCK_SVG`)** — 이모지(🔒) 배지는 쓰지 않는다(스모크가 `🔒` 잔존을 잡는다). 가방 격자도 같은 글리프를 써서 표기를 하나로 유지한다. 글리프는 24px 안에서 **부위가 읽히게 그린다**(벨트 = 좌우 스트랩 + 버클 + 구멍, 장갑 = 엄지 + 손가락 3 + 손등 + 커프, 무기 = 날 + 혈조 + 가드 + 폼멜 …). 실루엣만 남기면 벨트가 막대, 장갑이 가방으로 보인다(둘 다 실제로 그랬다). 슬롯을 늘리면 `PROF_SLOT_ICON`에도 같은 키를 추가할 것 — 스모크가 누락을 잡는다.
- **`.pdWrap` 첫 줄 레벨 배지**는 칸 밖(`top:-7px`)으로 나가므로 위 여백이 없으면 잘린다.
- **외곽선 캐릭터 도형을 그릴 때**: 팔·다리를 단선(`stroke`)으로 그으면 막대 인간이 되고 겹친 선이 뭉쳐 형태가 안 읽힌다(실제로 한 번 그렇게 나왔다). **각 부위를 닫힌 외곽선으로 그리고 배경색 채움(`fill="rgba(10,14,22,.82)"`)으로 뒤를 가린 뒤, 먼 것부터(다리 → 몸통 → 팔 → 머리) 쌓을 것.**
- **`.portImg`는 `position:absolute;inset:0`이다**: 감싸는 요소에 `position:relative`가 없으면 positioned 조상까지 거슬러 올라가 화면을 뚫는다(페이퍼돌에서 실제로 초상이 패널을 덮었다). 초상을 새 컨테이너에 넣을 땐 그 컨테이너에 `position:relative`를, 위에 얹을 버튼엔 `z-index:2` 이상을 줄 것(`.portImg`가 `z-index:1`).
- **마을에서는 3D 모델을 쓸 수 없다**: `M3D`는 유즈맵 진입 시 초기화·로드되므로 마을/장비 화면 시점엔 `window.M3D`가 없거나 `hasModel()`이 전부 false다(헤드리스에선 아예 미정의). 캐릭터 그림이 필요하면 **구워둔 초상 `assets/portraits/*.webp`**(= `unitPortraitHTML`)를 쓸 것. 실시간 전신 렌더를 전제로 UI를 짜지 말 것.
- **캐릭터 삭제 환급은 "재화로 넣은 것"만 돌려준다**(`profSpentOn`/`profRefundOf`): 장비 강화 + 전직(뿌리까지 `PROF_JOB_PARENT`로 역추적) + 진화. 레벨·경험치·스탯포인트는 환급 없음 = 삭제의 유일한 비용. 비율은 `PROF_REFUND_RATE`(현재 1.0). ⚠️ **캐릭터별 어빌리티/뽑기를 나중에 붙일 땐 환급 대상에서 빼거나 비율을 낮출 것** — 전액 환급이면 "좋은 게 나올 때까지 만들고 지우기"가 공짜가 된다. 비용 공식은 `profGearCost`/`profClassCost`/`profEvolveCost` 한 곳뿐이라 환급이 자동으로 따라온다(새 지출을 만들면 `profSpentOn`에도 더할 것).
- **`PLAYER_META.profile`은 계정 공용 + 캐릭터별로 나뉜다**(ver3): 공용 = `pcoin`·`pets`·`equip`·`unlocks`·`idle`, 캐릭터별 = `chars[]`의 `level/xp/statPoints/unit{jobId,stats,gear,evoStars}`. **`PROF()`는 계정, `CHAR()`는 현재 캐릭터** — 새 코드에서 레벨·스탯을 `PROF()`에서 읽으면 조용히 틀린다(ver2까지는 거기 있었다). 캐릭터 종류 = 뿌리 직업 id(`ranger`/`scout`/`warden`)로 `PROF_CLASSES`와 `PROF_JOBS`가 같은 키를 공유한다. 마이그레이션은 `migrateProfile`(ver2 단일 캐릭터 → `chars[0]`)과 `fixChar`.
- **시설 팝업은 "내가 지정한 구역"에 도착했을 때만 열린다**(`twCheckZones` + `_twGoZone`): 구역 아이콘·가장자리 방향 표시를 눌러야 지정되고(`townGo`), 땅을 누르거나 꾹 눌러 이동하면 지정이 풀린다(`twSetTarget`/`dir` 모드에서 `_twGoZone=null`). **반경 안에 있다는 사실만으로는 절대 열리지 않는다** — 옆을 스쳐 지나가도, 걸어가서 구역 위에 겹쳐 서도 안 열리고, 그 자리에서 구역을 다시 눌러야 열린다(아바타는 `pointer-events:none`이라 겹쳐도 아래 아이콘이 눌린다). 반경 근접만으로 열던 초기 구현은 광장→모서리 경로에서 옆 구역을 스쳐 팝업이 튀어나왔다(여유가 54px뿐이었다). 스모크 `마을: 지정하지 않으면 안 열림(스쳐 지남·겹쳐 섬)`이 세 경우를 모두 지킨다.
- **메인 화면 = HOME 대시보드(`#homeScreen`)이다** (2026-08-07). 로그인·게스트·유즈맵 뒤로가기가 `openHome()`으로 모인다. 화면 이동은 **전역 하단 네비 `#navBar` 하나**로만 한다 — 화면마다 바를 만들지 말 것. `showAppScreen()`이 네비를 무조건 숨기고, `openHome()`/`openTown()`이 `navShow(tab)`으로 다시 켠다(새 메인 화면을 만들면 이 호출을 빠뜨리기 쉽다). ⚠ **HOME에 카드는 POWER UPGRADES(`.hmUpg`·스탯 4종·`profAllocStat`) 하나뿐이다**(2026-08-07 정리). 바로가기 줄·리그 순위표·라이브 매치 바·수입 줄(`.hmRes`)·매치 화면(`.hmStage`)과 더미 상수 `HOME_DUMMY`는 **전부 삭제됐다** — 되살리지 말 것. 위쪽 빈 자리는 `.spaceBg`가 보이라고 비워 둔 것이고 카드는 `margin-top:auto`로 네비 바로 위에 붙는다. 톤은 네비바와 같은 순수 회색(`--hmPanel`/`--hbEdge`), 라운드는 `--r-bar`(3px) — 푸른기를 다시 넣으면 스모크가 잡는다. 상단 재화 바는 HOME에서만 `.curBar.bare`(면·구분선 없음)로 배경이 이어져 보이게 하는데, `#curBar`는 마을·유즈맵 **공용**이라 전역으로 고치지 말고 `BARE_CUR_SCREENS`에 화면 id를 넣을 것.
- **게스트 = Supabase 익명 로그인**(2026-08-13). `authGuestStart()`가 `signInAnonymously()`를 먼저 시도하고, **실패하면 예전의 로컬 게스트(`authGuestUser`, `local:true`)로 떨어진다** — 대시보드에서 Anonymous sign-in 이 꺼져 있어도 입장은 항상 된다. 익명이면 uid 가 있으므로 `sbReady()`가 켜져 클라우드 저장·소셜이 동작한다.
  - **게스트 판정은 `sbUser()` 한 곳**에서 `guest:!!u.is_anonymous`로 정한다 — 세션 복원(새로고침) 뒤에도 유지된다.
  - ⚠ `onAuthStateChange` 가드는 **`local` 게스트만** 보호한다. 예전처럼 `guest`로 막으면 익명 세션 갱신까지 무시된다.
  - **계정 연결** `authLinkAccount()` = `updateUser({email,password})` — uid 를 그대로 두므로 진행도가 따라온다. 진입점은 설정의 `#setLink`(`authCanLink()` 참일 때만 보인다). 폼은 로그인 폼을 `_authLink` 플래그로 재사용한다(두 벌 만들지 않는다).
- **하단 네비 5칸 = `HOME · 정비 · 마을 · 유즈맵 · 상점`** (2026-08-10). `navGo(tab)`가 유일한 분기다(`home/gear/town/map/shop`). **토벌은 네비에서 빠졌다** — 입구는 HOME 스킬 바(`renderHbBar()`)의 '토벌' 버튼 하나뿐이고, `#dgHubScreen`은 화면이 아니라 HOME 위 `.hbModal` 팝업이다(`openDungeonHub()`/`closeDungeonHub()`, 다른 화면에서 부르면 먼저 `openHome()`). 빈 2번 칸이 **정비(`#gearScreen`)** — 장비/펫/동료 3탭. ⛔ 정비는 자체 렌더러를 갖지 않는다: 장비=`renderProfGear()`(마을 장비창과 같은 함수) · 펫=`_shopPetPanel()`(상점 '보유 펫'과 같은 함수) · 동료=자리만(HOME 업그레이드 패널 '동료' 구역으로 안내). `refreshTownPanel()`이 `gearOpen()`→`renderGear()`, `shopOpen()`→`renderShop()` 순으로 갈라지므로 **장착·분해가 어느 화면에서 일어나도 알아서 그 화면을 다시 그린다** — 새 전용 화면을 만들면 여기에 분기를 추가할 것. 장비창이 두 곳(마을 팝업 `#tpBody` · 정비 `#gearBody`)에 뜨므로 `bagScrollHint()`는 **열려 있는 쪽**만 잰다(숨은 쪽은 높이가 0이라 늘 어긋난다).
- **`--hmPanel`/`--hbEdge`(회색)는 `#homeScreen` 스코프에만 있고 `--setAcc`는 `.setCard` 스코프에만 있다.** 다른 화면에서 `var(--setAcc)`를 대체값 없이 쓰면 배경이 사라져 검은 글씨만 남는다 — `.twBtn.on`('장착중')이 마을·상점에서 실제로 안 보였다(`var(--setAcc,#5cd6ff)`로 고침). 새 화면에서 이 토큰들을 쓸 땐 대체값을 넣을 것.
- ⚠ **동료와 건설의 경계**(2026-08-12 병합). 두 갈래 작업이 같은 자리를 다르게 만들었다가 합쳤다. 지금 규칙은 하나뿐이다:
  · **동료 = 뽑기 로스터(`HB_MATES`)** — 정비 > 동료 탭에서 출전(`hbParty()`, 정원 `hbMateMax()`)하고 **캐릭터 주위**를 돈다. 옛 '동료 초소' 타일은 없앴다.
  · **벽·터렛·벙커 = 타일 배치(`HB_STRUCT`)** — 옛 개수형 표 `HB_BUILD`는 **삭제**했다(같은 뜻의 표를 두 벌 두면 반드시 어긋난다). 이름·비용·상한은 `HB_STRUCT` 하나에서만 온다.
  · 업그레이드 패널 '건물' 구역 카드(`HB_UPG_CAT_BUILD`)는 **수량을 사는 것이 아니라 누르면 배치 모드로 들어간다**(`hbBuy` → `hbArmStart`). 아이콘은 `assets/icons/buildings/`, 벽은 화력이 없으므로 값은 '칸 수'로 낸다.
- **🧱 기지 격자 = 사냥터 타일 건설**(2026-08-12, 1단계). 좌표는 타일 인덱스 `(gx,gy)`이고 타일 중심의 월드 좌표는 `hbTx(g)=g*HB_TILE+HB_TILE/2`, 역은 `hbGx(w)`. `HB_TILE=20` · `HB_GRID_R=HB_MAP_R/HB_TILE=15` → 30×30=900칸. **단일 소스는 `PROF().hunt.base.tiles`**(`"gx,gy" → {k, hp?}`)이고 `hbBase()`가 없으면 만들면서 **옛 개수형 `hunt.build`(ally/turret/bunker)를 타일로 이관**한다(`HB_BUILD_MIG`, 이관 뒤 `hunt.build`는 비운다) — 프로필 버전을 올리지 않는 것이 이 방식의 요점이다. ⚠ **다중 타일 건물은 좌상단 타일에만 기록**하고 `w×h`로 점유를 계산한다(`hbCellOwner`가 `HB_FOOT_MAX`만큼 역추적) — 점유 칸마다 따로 쓰면 철거·이동에서 반드시 어긋난다. 설치는 경로가 하나뿐이다: **`hbPlaceStruct(k,gx,gy)`** (배치 확정·마이그레이션·스모크가 전부 여기를 지난다). `hbBuy(k)`는 이제 즉시 짓지 않고 배치를 시작할 뿐이고, 지출은 확정 때 일어난다. 배치 UI는 `hbArmStart/hbArmTo/hbArmOk/hbArmConfirm/hbArmCancel` + `#hbArmBtns`(공용 `.bArmBtns`를 담는 앵커)다. ⛔ **관리자 건설(`techPtrDown`/`techMapRender`/`G.tech`)을 부르지 않는다** — HOME은 유즈맵 전역 `G`를 참조하면 안 되고 스모크가 `G` 스냅샷으로 검사한다. 공유하는 것은 `.bArmBtns` CSS·`CST_BLDG_CFG` 데이터·`assets/icons/buildings` 뿐이다.
- **기지 건물 3D는 `M3D.sync`의 '같은 목록'에 얹는다**(`hb3dStructs`가 `hb3dList`에 append). ⛔ **`M3D.sync`와 `M3D.syncBuild`를 같은 프레임에 둘 다 부르면 안 된다** — 서로 상대의 모델 풀을 통째로 `visible=false`로 만들어서 나중에 부른 쪽만 남는다(`sync`가 `buildModels`를, `syncBuild`가 `models`를 숨긴다). HOME은 유닛 때문에 `sync`를 쓰므로 건물도 `sync`로 간다. 스모크가 소스에 `M3D.syncBuild(`가 없는지 검사한다. 모델 키는 관리자 건설과 같은 에셋 `cb_<CST_BLDG_CFG 키>`이고 `M3D.cstEnsure`로 지연 로드한다(`hbEnsureStructModels`, 1회). `sync`에는 `fitW`(발자국 맞춤)가 없으므로 크기는 `scl = 원하는반경 / (M3D.footprintOf(id) * k3)`로 역산한다 — `k3`는 `hbFrame`이 `sync`에 넘기는 배율과 **반드시 같아야** 한다. **화면 밖 구조물은 목록에 넣지 않는다**(벽은 최대 400칸 — 컬링이 없으면 드로우콜이 폭증한다). 3D가 올라오면 2D는 발자국 판만 그린다(`hbDrawStructs`의 `has3d` 분기) — 안 그러면 두 겹으로 보인다.
- **벙커 주둔 = 구매 유닛 최대 4(`t.n`, 벙커별 개별 비용 `hbBunkerUnitCost`) + 출전 동료 1(`t.m`)**(2026-08-12 확정). 새 벙커는 유닛 1기로 시작한다. 동료는 한 벙커에 `HB_BUNKER_MATE_SLOTS`(1)명 — `hbBunkerAssign`이 옮길 때 이전 벙커에서 빼고, `hbBunkerMates`가 파티에서 빠진 유령 지정을 그 자리에서 걸러낸다. 벙커에 든 동료는 궤도(`S.allies`)에서 빠진다. 화력 = `(유닛 수 × HB_BUNKER_UNIT_DPS + hbMateDps × M.ally.mul) × hbBunkerAtkMul()`, 사거리 `HB_BUNKER_RNG`. 배수는 **'건물' 구역 업그레이드 `bkatk`**(cat `bld`)가 정한다. 필드에서 벙커를 누르면(`hbTapStruct` → `hbOpenBunker`) 창이 열린다 — `hbFieldTap`에서 **이동보다 먼저** 걸러야 한다. ⚠ 사거리는 `hbUnitFire`가 캐릭터 사거리를 쓰므로(`HB_BUNKER_RNG` 배수) 캐릭터 사거리를 0으로 만들면 벙커도 못 쏜다 — 테스트에서 실제로 헛돌았다.
- ⚠ **이 컨테이너에서는 3D를 눈으로 검증할 수 없다.** three.js를 `https://esm.sh`에서 받는데 프록시가 403으로 막는다 → `M3D`가 아예 없고 3D 스모크는 전부 SKIP된다. 3D 관련 변경은 `window.M3D`를 스텁으로 세워 **목록 생성 로직**만 검사하고(스모크 '기지 3D'), 실제 화면은 사용자 확인이 필요하다고 밝힐 것.
- **◀▶ 방향 버튼 = 공용 `.arwBtn`**(2026-08-14). 마크업은 `<button class="arwBtn" data-arw="l|r">` 한 줄뿐이고 속은 `paintIcons`가 부르는 `paintArrows`가 채운다(아이콘 레지스트리와 같은 방식 — 화살표 SVG를 마크업에 박지 말 것). 기본은 **글리프만**(판도 선도 없이 그림자로 띄운다 · 배경을 하나도 가리지 않는다 · 터치 영역은 30px 유지). 판이 필요한 자리에만 `.framed`를 붙이면 **모서리 컷 테두리**가 나온다 — ⚠ `clip-path`로 자르면 테두리까지 잘려 잘린 변에 선이 안 남으므로 외곽선은 SVG path로 직접 그린다. ⚠ 팝업(`#hbRoundSheet`)은 푸른기 금지라 선·글자 색을 회색으로 유지할 것. 스킬 바(원형)·더보기(각진 판)는 **다른 영역**이라 이 문법과 통일하지 않는다.
- **던전·라운드 고르기 = 초안(`_hbPick`) + [이동]**(2026-08-14). 시트에서 던전을 넘기거나 라운드를 골라도 **바로 옮겨가지 않는다** — `_hbPick={dg,round}`에만 담고 `hbPickGo()`가 유일한 적용 지점이다(취소는 그냥 닫기).
  · 던전은 `hbPickDg(±1)`로 **열려 있는 것만** 건너뛰며 한 장씩. 카드 그림은 전장 바닥과 같은 파일(`HB_BG_DIR`).
  · 라운드는 **세로 피커** — 큰 수가 위, 1이 맨 아래. `scroll-snap-type:y mandatory` + 위아래 여백 `(보이는 높이-칸 높이)/2`(`hbRdPad`)가 있어야 첫·마지막 칸도 가운데에 선다. 멈춘 위치 → `idx=round(scrollTop/pitch)`, `round=최고-idx`(`hbRdSettle`, 110ms 디바운스). 탭하면 `hbRdTap`이 그 칸을 가운데로 미끄러뜨린다.
  · ⚠ **강조는 목록을 다시 그리지 말고 클래스만 갈아 끼운다**(`hbRdMark`) — 다시 그리면 스크롤이 튄다.
  · ⚠ `.hbRdPick`은 **높이를 못 박는다**. 부모 `.hbmCard`가 내용 높이라 `flex:1`로 두면 안쪽 스크롤 높이가 안 정해져 카드 밖으로 샌다(실제로 그랬다).
  · ⚠ `requestAnimationFrame` 콜백은 시트가 이미 닫힌 뒤 실행될 수 있다 — `_hbPick` 널 가드 없이 읽으면 콘솔 예외가 난다.
  · ⛔ **이 팝업엔 푸른기를 쓰지 않는다**(스모크가 B-R>12를 잡는다). 공용 팝업 액션 버튼은 모양·볼륨만 공유하고 면 색은 `--btnA/B/C` 토큰으로 덮으며, 글자색도 `#dfe7f0`→회색으로 바꿔야 통과한다. 강조는 흰색·금색만.
- **웨이브 재조정(2026-08-12)**: 미로가 생겨 적이 걷는 거리가 늘어난 만큼 `5웨이브×20초` → **`3웨이브×50초`(보스 웨이브 80초)**, 적 속도는 `HB_FOE_SPD_MUL`=1.45 한 손잡이로 올렸다(표준 50→73 · 빠름 82→119 · 둔중 38→55, 보스도 같은 배수). 라운드당 적은 절반쯤으로 줄지만(R1 30→15 · R10 50→27 · R50 130→75) **라운드도 그만큼 짧아져서** 처치 수입 시급은 그대로이고, 라운드마다 주는 클리어 보너스(`hbClearBonus`)는 오히려 더 자주 들어온다(실측: 강한 스펙에서 R1 한 라운드 11.9초/16킬, R10 16초/28킬 — 즉 타이머가 아니라 '얼마나 빨리 잡느냐'가 속도를 정한다). 50초 제한은 **미로가 길어 적이 못 올 때만** 걸린다.
- **🧭 경로 = 플로우 필드 한 장 + 시야 지름길.** 목표 칸에서 BFS로 900칸 거리장을 굽고(`hbBakeField`) 각 유닛은 `hbFieldDir`로 이웃 한 칸씩 간다. 적용 장은 캐릭터가 **다른 칸으로 넘어갈 때만**, 캐릭터용 장은 목적지 칸이 바뀔 때만 다시 굽는다(`_hbBlkSeq` 세대 번호로 구조물 변경도 감지). ⚠ **거리장만 쓰면 열린 벌판에서도 타일 중심을 따라 계단처럼 걷고 각도가 4방향으로 뭉친다** — 그래서 `hbLineClear`로 목표까지 직선이 뚫렸는지 먼저 보고, 뚫렸으면 그냥 직진한다(구조물이 하나도 없으면 `_hbAnyBlk=false`라 검사 자체를 건너뛴다). 스모크가 '열린 곳은 직진'을 각도로 검사한다.
- **벽은 통과 불가, 적은 절대 부수지 않는다.** 충돌은 `hbSlide`가 축을 나눠 밀어 모서리에서 안 걸리게 한다. ⚠ **이미 막힌 칸 안에 있으면 그냥 통과시킨다** — 안 그러면 자기 위에 건물이 지어졌을 때 영영 못 빠져나온다. `hbLayoutBase()`가 `hbGridDirty()`를 부르는 것이 유일한 무효화 지점이다(타일을 바꾸는 경로는 전부 여길 지난다).
- **적은 기지 안에서 태어나지 않는다.** `hbBlocked()`가 구조물의 사각 범위(`_hbBaseBox`, +1칸)를 함께 잡고, `hbPlaceFoe`가 그 안이면 같은 방향으로 바깥까지 밀어낸다. 기지가 작을 땐 거의 그대로라 초반 속도가 안 바뀌고, 커질수록 자연히 바깥에서 온다. 막힌 칸이면 뚫린 자리를, 그래도 없으면 맵 테두리(`hbEdgeSpawn`)를 쓴다.
- **건설의 입구·고르는 곳은 한 자리다**(2026-08-14). 더보기 > 건설 = **즉시 건설 모드**(`hbBuildStart` → `hbBuildEnter`)이고, 무엇을 지을지는 **하단 업그레이드 패널이 그대로 '건설' 구역이 되어** 고른다(`renderHome`의 `_hb.build` 분기 → `hbBuildCardHTML`, 카드 규격은 업그레이드와 같은 `hmUpCardHTML`). 탭 띠·수량은 `.hmUpg.bd`로 숨기고 제목만 '건설'로 바꾼다. 나가는 길은 오른쪽 위 ⊘(`#hbBuildStop`) 하나이고 `hbBuildExit()`가 모드와 하단을 함께 되돌린다(`renderHome()` 호출 포함).
  ⛔ 좌상단 건설 드롭다운(`#hbBuildWrap`/`renderHbBuild`/`.hbBdMenu`/`hbToggleBuild`)은 **폐지**했다 — 오른쪽 위에서 열었는데 왼쪽 위에 목록이 떠서 시선이 튀었다. 좌상단 아이콘 줄(`.hbIcoRow`)도 함께 비었다.
- **🛠 건설 모드 = 라운드 정지**(2026-08-12). 배치를 시작하면(`hbArmStart` → `hbBuildEnter`) 라운드가 '시작 직전'으로 돌아간다 — 적·대기·상자·탄을 비우고 `wave=1`, `waveT=hbWaveTime(1)`, 캐릭터 목적지도 지운다. `hbStep`은 `if(S.build){ hbFx(dt); return; }`로 **시계까지 멈춘다**(이펙트만 사그라들게 둔다). 나가는 길은 하나: **`hbBuildExit()`** — 오른쪽 위 ⊘(`#hbBuildStop`)·고스트의 ✕(`hbArmCancel`)·화면 이탈(`hbStop`)이 전부 이걸 부르고, 나가면 1웨이브부터 새로 돈다. ⚠ `hbBuildExit`는 **`S.build=false`를 먼저 하고 `hbArmBtns()`를 불러야** 한다(순서를 바꾸면 ⊘가 화면에 남는다). ⚠ `_hb`가 없을 때 부르면 `hbSpawnWave`가 터지므로 맨 앞에서 막는다.
- **연속 배치는 방향을 기억한다.** `_hb.arm={k,gx,gy,dir,last}`. 확정하면 `hbArmAdvance()`가 `dir`(기본 오른쪽)로 다음 자리를 잡고, **막힌 칸은 그 방향으로 계속 건너뛴다**. 맵 끝에 닿으면 아래→오른쪽→위→왼쪽 순으로 꺾고, 그래도 없으면 `hbFreeCell`. 사용자가 고스트를 무시하고 다른 칸에 놓으면 `직전 → 이번` 이동이 곧 새 `dir`이 된다(왼쪽에 놓으면 그 뒤로 계속 왼쪽). 후보는 `hbCanPlace` + `hbSealCheck`를 **둘 다** 통과해야 한다 — 봉쇄 검사를 빠뜨리면 고스트가 못 놓는 칸에 서서 ▶가 계속 비활성으로 보인다.
- **📅 일일(출석 캘린더 + 일일 퀘스트)은 프로필 한 곳(`p.daily`)에 산다**(2026-08-14). 배너 검색어 `📅 일일`. 하루 경계는 던전 열쇠·상점 특가와 **같은 축**(`_dgDayKey()` · 09:00)이고, 주 경계 `_dqWeekKey()`는 **그 위에 얹은 월요일**이다(하루 축을 새로 만들면 두 축이 어긋나 하루가 새는 날이 생긴다).
  - **화면은 둘로 나뉜다** — `#hbAttSheet`(출석 · `openAtt`/`renderAtt`)와 `#hbDailySheet`(퀘스트 · `openDaily`/`renderDaily`). 더보기 ☰ 에도 칸이 각각 있고 배지도 따로 판정한다(`dqAttHas`/`dqQHas`, ☰ 의 `!`만 `dqHas`=둘의 합). ⛔ 한 판에 탭으로 묶지 말 것 — '오늘 뭘 해야 하나'와 '도장을 찍었나'가 서로를 가렸다. 저장·계측·지급(`dqNote`/`dqGive`)은 그대로 공용이다.
  - **출석** `att={n,day,bn,fin,cyc}` — 한 주 = **출석 5칸 + 보너스 2칸**. 보너스는 '나머지 2일' 몫이라 그 주 5칸을 채우면 **추가 출석 없이** 열린다(`dqBonusOpen`). 4주 = **20도장**이면 `dqClaimFinal()`이 최종 보상 + **남아 있는 보너스까지 한꺼번에** 주고 캘린더를 새로 깐다(`cyc++`) — 안 그러면 안 받은 보너스가 사라진다.
  - **퀘스트** `q=[{id,n,got}]` — 하루 5개. 뽑기는 **날짜 시드**(`dqDraw(dk)` + `_dqRand`)라 새로고침해도 같은 5개다. 5개 중 `DQ_OUT_N(2)`개는 반드시 `cat:'out'`(유즈맵·토벌·뽑기·부스트) — 다른 구역까지 자연스럽게 끌어내는 것이 이 기능의 목적이다. ⚠ **같은 `kind`는 하루에 하나만** 뽑는다 — '적 처치 60'과 '적 처치 150'이 같이 나오면 큰 쪽을 하는 순간 작은 쪽이 덤으로 끝나 5개가 사실상 4개가 된다.
  - **줄 생김새는 `dqRowHTML(o)` 하나** — 퀘스트·주간·완주가 전부 이걸 쓴다. `[아이콘] 제목 / 내용 + 진행 / 진행 바`이고 **보상은 줄 본문이 아니라 수령 버튼 안**(`dqClaimBtn`)에 들어간다 — 무엇을 받는지가 누르는 자리에 있어야 한다. ⚠ 받을 수 있는 `.hbRowBtn`은 **면이 금색**이라 그 위 보상 글자는 어두워야 한다(`.dqBtn:not(:disabled) .dqRwB i`) — 금색 위 금색이면 안 보인다. 스모크가 대비를 검사한다.
  - **주간** `wk={key,n,got}` — `_dqWeekKey()`가 바뀌면 `dqState()`가 통째로 0으로 되돌린다. 누적은 **'수령'이 아니라 '완료'로** 센다(`dqNote`가 목표를 넘긴 개수만큼 더한다) — 안 받고 날이 바뀌어도 이번 주 몫은 남아야 한다. `DQ_WEEK_GOAL(25)` = 하루 5개 × 5일치라 이틀을 빠져도 채울 수 있다(출석 5/7과 같은 결).
  - **계측은 `dqNote(kind,n)` 한 곳으로만** 들어온다. 지금 붙어 있는 곳: `hbKill`(kill) · `hbBreakChest`(chest) · `hmBuyUpg`/`hmBuyUpgQuiet`(upg) · `hbSettle`(round) · `hbPlaceStruct`(build) · `hbStep`(play, 1초 단위) · `_runSummary`(umRun/umWin) · `dgWin`(dgWin) · `hbMateRoll`/`profPetRoll`/`profUseGearTicket`(gacha) · `hbBuyBoost`(boost). 스모크가 **정적으로** 이 12곳을 검사한다(빠지면 퀘스트가 영원히 0이다).
  - ⚠ **`dqNote`는 초당 여러 번 들어온다**(처치). 저장·배지·리렌더는 **완료된 순간과 시트가 열려 있을 때만** 한다 — 매번 하면 전투 중 프레임이 죽는다.
  - ☰의 `!` 배지(`#hbGrowDot`)는 **성장과 일일이 함께 쓴다**(`renderHomeStats`). 더보기 격자 안의 점은 **글자 없는 점**이어야 한다 — 그 격자는 '아이콘만'이 규칙이고 스모크가 `textContent`를 검사한다.
- ⚠ **`.curBar.bare`는 click-through다**(`pointer-events:none`, `.res`·`.hudSet`만 되살림). 되살릴 자식을 빠뜨리면 그 UI는 '눌러도 아무 일 없고 뒤 화면이 대신 반응'한다 — 설정(☰ `#curSettingsBtn`)이 이 때문에 HOME·마을·유즈맵·상점·정비 다섯 화면에서 죽어 있었고, 클릭이 `#homeScreen`까지 내려가 캐릭터가 그리로 걸어갔다. **필드 탭 화이트리스트의 전제('UI는 자식이라 자동 제외')가 click-through 레이어에서는 깨진다** — `pointer-events:none`을 새로 줄 때마다 여기를 볼 것. 또 `#curBar`의 설정은 `openAppSettings()`(앱용)를 불러야 한다. `openSettings()`는 인게임용이라 HOME에서도 임무 목표·배속·게임 나가기가 뜬다.
- ⚠ **`applyVideo()`와 `fxLevel()`의 기본값을 맞출 것.** `fxLevel()`은 `G.opt.fx` 미설정을 `'full'`로 보는데 `applyVideo()`만 `G.opt.fx!=='full'`로 봐서, fx가 아직 없는 새 프로필은 **설정을 한 번 여는 것만으로** `body.lite`(`box-shadow`·`backdrop-filter` 전부 `none!important`)가 켜졌다 — 화면엔 '고화질'이라 떠 있는데 이펙트만 사라졌다. 지금은 둘 다 `fxLevel()`을 쓴다.
- **🎥 가장자리 끌기 = 배치 고스트를 화면 끝으로 끌면 카메라가 따라간다**(2026-08-12). 방향 판정은 **`edgePush(fx,fy)` 하나**를 HOME 사냥터(`hbEdgePan`)와 관리자 건설 화면(`techEdgePan`)이 함께 쓴다 — 상수도 `EDGE_PAD`/`EDGE_SPD` 공용.
  HOME은 건설 중에만 쓰는 별도 카메라 `_hb.bcam`을 두고(`hbResize`가 `S.build&&S.bcam`이면 캐릭터 대신 이걸 따라간다) `hbBuildExit`에서 `null`로 돌려 캐릭터 추적으로 복귀한다.
  ⚠ 카메라를 옮긴 뒤에는 **고스트를 손가락 자리에 다시 맞춰야 한다**(`hbArmTo`/`_techArmTo` 재호출) — 안 하면 화면만 흐르고 고스트가 뒤에 남는다.
  ⚠ 관리자 쪽은 `techView()`와 `techViewT()`를 **둘 다** 갱신한다. 목표(`viewT`)만 바꾸면 `techViewTick` 보간을 기다리는 동안 고스트가 손가락을 놓친다.
  ⚠ **최소 줌에선 팬할 여지가 없다** — `_techClampView`가 화면을 가운데로 고정하므로 스모크도 확대한 뒤에 잰다.
- **필드 이동은 관리자 건설 화면과 같은 방식**(2026-08-12): 누른 즉시 그 자리로 이동하고 **뗄 때까지 손가락을 따라온다**
  (`hbFieldTap`/`hbFieldMove`/`hbFieldUp` ↔ 관리자 `techPtrDown`/`techPtrMove`의 `_btCmd` → `_techAssignMove`). 포인터 id를 물고 있어 멀티터치가 명령을 훔치지 못한다.
  ⚠ **`touch-action:none` + `preventDefault()`가 둘 다 있어야 한다** — 없으면 드래그가 브라우저 스크롤로 새어 화면 자체가 끌려간다.
  `#homeScreen`·`#hmScroll`에 `none`, 그 안의 `.uiScroll`/`.hmUpgGrid`만 `pan-y`로 되살린다(관리자 `.bmap`·마을 `.twMap`이 쓰는 것과 같은 규칙).
  탭만 받던 예전 방식은 연속으로 찍을 때 명령이 씹히는 느낌이 났다.
- **필드 탭은 화이트리스트다.** 예전엔 `document`에 캡처로 걸고 셀렉터 **블랙리스트**로 UI를 걸렀는데, 목록에 없는 것(재화 바·네비·업그레이드 카드 빈 공간·`#phone` 바깥)은 전부 이동으로 샜다. 지금은 `e.target`이 **`#homeScreen` / `#hbCv` / `#hmScroll`** 셋 중 하나일 때만 이동한다 — 모든 UI는 자식이라 자기 자신이 대상이 되어 자동 제외되고, 새 UI를 추가해도 여기 손댈 일이 없다. ⚠ `#hmScroll`이 남은 세로 공간을 전부 차지하므로 '보이는 전장'의 대부분이 그 위다 — 빼면 필드 탭이 통째로 죽는다.
- **격자는 맵 전체이고 건설 중일 때만 보인다**(2026-08-12). 해금 구역·코어 제한은 없앴다(`hbCellBuildable`은 맵 안인지만 본다, `hunt.base.open`은 옛 세이브 호환으로만 남음). `hbDrawGrid`는 `S.arm`이 없으면 아무것도 안 그리고, 있을 때도 **보이는 범위만** 긋는다.
- **봉쇄 금지 = `hbSealCheck(k,gx,gy)`.** 맵 테두리에서 4방향 flood fill 해서 도달 못 하는 빈칸이 생기면 배치를 거절한다(자원 미차감). ⚠ **대각 통과가 없으므로 사각 테두리는 '모서리'를 비워도 여전히 갇힌다** — 열어 둘 칸은 변의 중간이어야 한다(스모크가 이 전제를 검사한다). 벽을 통과 불가로 둘 수 있는 근거가 이 검사다.
- **동료·펫은 더 이상 원점에 고정되지 않는다.** 동료는 자기 초소(`post`) 둘레를 `HB_ALLY_ORB`로 돌고, 펫은 캐릭터를 따라다닌다. 궤도 위상은 타일에서 결정한다(난수로 두면 재배치마다 위치가 바뀌어 사거리 경계에서 스모크가 흔들린다 — 실제로 그랬다). 벙커 체력은 `S.bunkers[].q`로 타일에 되쓴다(재배치해도 되살아나지 않는다).
- **자동사냥(`hb*`) = HOME 메인 전투** (2026-08-09, Phase 1). 마린키우기식 웨이브 방어 — 라운드 = **3웨이브 · 웨이브 50초**(마지막 보스 웨이브만 `HB_BOSS_EXTRA_S`=+30초, `hbWaveTime(w)`가 계산) · 다 비우면 `HB_GAP_S`=3초 뒤 다음 웨이브 · **시간 안에 못 비우면 실패**(아래 「웨이브 실패」 참고 — 2026-08-12에 '적 누적' 규칙에서 바뀌었다) · 마지막 웨이브 뒤 필드를 비워야 클리어. 보상(미네랄·가스·XP)은 `_hb.buf`에 쌓였다가 **라운드 클리어 때만 지급**(`hbSettle`) — 사망(`hbDie`) = 버퍼 소실 + 라운드 하강. 등반 모드 `hunt.climb`. 영구 업그레이드 6종 = `PROF().hunt.upg`(미네랄 구매, `hmBuyUpg`) — **스탯 포인트 체계는 v6에서 흡수**: `migrateProfile`이 배분 스탯→업그레이드 레벨(캐릭터 중 최대)·잔여 포인트→미네랄(1pt=20)로 1회 이관(`hunt.migrated`), `profApplyLevelUps`는 이제 포인트 대신 미네랄(레벨당 10)을 준다. ⚠ **시뮬 시계는 rAF가 아니라 50ms 인터벌**(`hbPump`) — 이 환경·백그라운드 탭에서 rAF가 멎어도 전투가 돈다(rAF는 그리기 전용). 스모크는 `_hb.manual=true`로 인터벌을 끄고 `hbStep`을 직접 돌린다. ⚠ 블록을 통째로 바꿀 땐 끝 마커 주의 — `_hbRaf=requestAnimationFrame(hbFrame)`은 hbStart와 hbFrame 두 곳에 있어 첫 매칭으로 자르면 옛 함수 7개가 뒤에 남아 조용히 이긴다(실제로 그랬다). 격리 규칙(G/U/M3D 미접촉)은 던전과 동일. 라운드 선택 시트(#hbRoundSheet — 껍데기는 친구 시트와 같은 공용 .twSheet · **좌상단 아이콘 버튼 `#hbRoundBtn`(깃발)** 으로 연다. 중앙 `.hbMid`는 `pointer-events:none` 표시 전용이다)는 최고 도달(hunt.best[dg])까지만 고를 수 있고, 반복(climb=false)=같은 라운드 무한 파밍 / 등반(climb=true)=클리어 시 +1. 처치 보상은 즉시 지급이고 사망 시 잃는 것은 클리어 보너스뿐(hbSettle). 업그레이드 카드는 접이식(hunt.upgDown)이고 전장 중심은 hbResize가 재는 보이는 영역(재화 바 아래~카드 위)을 따른다. 던전 1~10 선택은 라운드 팝업 안 칩(hbGoDungeon) — 해금은 `hbDgOpen(dg)` = 이전 던전 최고 라운드 ≥ HB_DG_UNLOCK(10). 엘리트는 `hbEliteChance(dg,round)`(라운드·던전 비례, 상한 35%)로 체력 ×4·공격 ×1.6·보상 ×5, 그리기는 30px + 금색 링. 🎟 장비 뽑기권은 엘리트 8% / 일반 0.3%로 떨어지고 **유일한 소비처는 마을 뽑기집의 `profUseGearTicket()`** — 그전까지는 토벌에서 주기만 하고 쓸 데가 없는 죽은 재화였다. ⚠ 옛 층 등반 콘텐츠는 표기가 '토벌'이고 '던전'은 자동사냥 전용어다(코드 식별자 dg*/DG_*는 옛 이름 유지).
- **자동사냥 전장 확장(Phase 4)** — 스킬 3종(`HB_SKILLS` 폭발·응급·감속, 쿨다운 `_hb.skT`) · 부스트 2종(`HB_BOOSTS` 수입×2·공격×2, 만료 시각 `hunt.boostT`, 이미 걸려 있으면 연장) · 아군(`HB_BUILD` 동료·터렛·벙커 = 미네랄 영구 구매 `hunt.build`, 장착 펫은 자동 소환). 배치는 `hbLayoutAllies()`가 월드 좌표로 세우고 구매 즉시 다시 부른다. ⚠ **아군 발사 주기는 캐릭터 쿨다운(`c.cd`)을 공유한다** — 공속 업그레이드가 전부를 빠르게 한다는 뜻이고, 검사할 때 캐릭터를 막으면 아군도 멈추므로 '아군 유무 비교'로 재야 한다(실제로 한 번 헛짚었다). 벙커는 반경 150 안의 적을 도발해 대신 맞고 라운드 시작마다 수리된다. **처치 처리는 `hbKill()` 한 곳** — 캐릭터·동료·펫·터렛·스킬이 전부 이 경로를 지난다(보상 규칙을 여러 벌 두지 않는다).
- **자동사냥(`hb*`) = HOME 메인 전투** (2026-08-09, Phase 1). 마린키우기식 웨이브 방어 — 라운드 = 5웨이브 · 웨이브 20초 · **시간 안에 못 비우면 실패**(아래 「웨이브 실패」 참고 — 2026-08-12에 '적 누적' 규칙에서 바뀌었다) · 마지막 웨이브 뒤 필드를 비워야 클리어. 보상(미네랄·가스·XP)은 `_hb.buf`에 쌓였다가 **라운드 클리어 때만 지급**(`hbSettle`) — 사망(`hbDie`) = 버퍼 소실 + 라운드 하강. 등반 모드 `hunt.climb`. 영구 업그레이드 6종 = `PROF().hunt.upg`(미네랄 구매, `hmBuyUpg`) — **스탯 포인트 체계는 v6에서 흡수**: `migrateProfile`이 배분 스탯→업그레이드 레벨(캐릭터 중 최대)·잔여 포인트→미네랄(1pt=20)로 1회 이관(`hunt.migrated`), `profApplyLevelUps`는 이제 포인트 대신 미네랄(레벨당 10)을 준다. ⚠ **시뮬 시계는 rAF가 아니라 50ms 인터벌**(`hbPump`) — 이 환경·백그라운드 탭에서 rAF가 멎어도 전투가 돈다(rAF는 그리기 전용). 스모크는 `_hb.manual=true`로 인터벌을 끄고 `hbStep`을 직접 돌린다. ⚠ 블록을 통째로 바꿀 땐 끝 마커 주의 — `_hbRaf=requestAnimationFrame(hbFrame)`은 hbStart와 hbFrame 두 곳에 있어 첫 매칭으로 자르면 옛 함수 7개가 뒤에 남아 조용히 이긴다(실제로 그랬다). 격리 규칙(G/U/M3D 미접촉)은 던전과 동일. 라운드 선택 시트(#hbRoundSheet — 껍데기는 친구 시트와 같은 공용 .twSheet · **좌상단 아이콘 버튼 `#hbRoundBtn`(깃발)** 으로 연다. 중앙 `.hbMid`는 `pointer-events:none` 표시 전용이다)는 최고 도달(hunt.best[dg])까지만 고를 수 있고, 반복(climb=false)=같은 라운드 무한 파밍 / 등반(climb=true)=클리어 시 +1. 처치 보상은 즉시 지급이고 사망 시 잃는 것은 클리어 보너스뿐(hbSettle). 업그레이드 카드는 접이식(hunt.upgDown)이고 전장 중심은 hbResize가 재는 보이는 영역(재화 바 아래~카드 위)을 따른다. 던전 1~10 선택은 라운드 팝업 안 칩(hbGoDungeon) — 해금은 `hbDgOpen(dg)` = 이전 던전 최고 라운드 ≥ HB_DG_UNLOCK(10). 엘리트는 `hbEliteChance(dg,round)`(라운드·던전 비례, 상한 35%)로 체력 ×4·공격 ×1.6·보상 ×5, 그리기는 30px + 금색 링. 🎟 장비 뽑기권은 엘리트 8% / 일반 0.3%로 떨어지고 **유일한 소비처는 마을 뽑기집의 `profUseGearTicket()`** — 그전까지는 토벌에서 주기만 하고 쓸 데가 없는 죽은 재화였다. ⚠ 옛 층 등반 콘텐츠는 표기가 '토벌'이고 '던전'은 자동사냥 전용어다(코드 식별자 dg*/DG_*는 옛 이름 유지).
- **자동사냥 전장 확장(Phase 4)** — 스킬 3종(`HB_SKILLS` 폭발·응급·감속, 쿨다운 `_hb.skT`) · 부스트 2종(`HB_BOOSTS` 수입×2·공격×2, 만료 시각 `hunt.boostT`, 이미 걸려 있으면 연장) · 아군(`HB_BUILD` 동료·터렛·벙커 = 미네랄 영구 구매 `hunt.build`, 장착 펫은 자동 소환). **전용 '건설' 팝업은 폐지됐다**(2026-08-12) — 고용·건설 카드는 업그레이드 패널의 동료·건물 구역에 있고 스킬 바 버튼도 뺐다. 배치는 `hbLayoutAllies()`가 월드 좌표로 세우고 구매 즉시 다시 부른다. ⚠ **아군 발사 주기는 캐릭터 쿨다운(`c.cd`)을 공유한다** — 공속 업그레이드가 전부를 빠르게 한다는 뜻이고, 검사할 때 캐릭터를 막으면 아군도 멈추므로 '아군 유무 비교'로 재야 한다(실제로 한 번 헛짚었다). 벙커는 반경 150 안의 적을 도발해 대신 맞고 라운드 시작마다 수리된다. **처치 처리는 `hbKill()` 한 곳** — 캐릭터·동료·펫·터렛·스킬이 전부 이 경로를 지난다(보상 규칙을 여러 벌 두지 않는다).
- **방치·오프라인 수입은 자동사냥 실적을 따라간다**(2026-08-10). `hbSettle()`이 라운드마다 `번 미네랄/걸린 초`를 EMA(0.3)로 `hunt.rate`에 기록하고, `profIdleRate()`가 그 값 ×60 ×장소배율 ×펫코인%를 돌려준다. ⚠ 옛 공식(파워 기반 고정치)은 자동사냥 수입의 **1/8** 수준이라 '잠수 위주' 컨셉인데 잠수 보상이 제일 약한 역전이 있었다(실측 1/분 vs 27/분). 한 라운드도 못 깬 신규 유저만 옛 공식으로 떨어진다.
- **전직·진화는 HOME 성장 팝업(`hbOpenGrow`)에서도 된다**(2026-08-10). 판정·실행은 마을과 같은 `profClassChange()`/`profEvolve()`를 그대로 부른다 — 다만 **마을 렌더러(`refreshTownPanel`/`showTownToast`)는 부르지 않는다**(HOME에서는 마을 DOM이 숨어 있어 토스트가 안 보인다). HOME 성장 줄(`.hmStatRow`)은 스탯 포인트가 남았거나 전직/진화가 가능할 때만 뜬다.
- **HOME 좌상단 HUD = `.hbHudTop`**(2026-08-10). 프로필 버튼(`#hbHud` — 초상·이름·직업·Lv·경험치 바·⚔공격/❤체력)과 라운드 선택 아이콘(`#hbRoundBtn`)을 세로로 묶어 화면 맨 위 왼쪽(`left:8px; top:3px`)에 고정한다. **킬수 표시(`#hbKill`)는 삭제됐다** — 되살리지 말 것. 주의 세 가지: ① 클래스 이름 `.hbTop`은 **인게임 홈 하단 탭 줄(`#bpMain .hbTop.hsTabs`)이 이미 쓰고 있다** — 좌상단 규칙을 `.hbTop`에 걸면 그 줄이 세로로 무너진다(그래서 `.hbHudTop`). ② 공용 재화 바 `#curBar`는 화면 전체 폭을 덮는 판이라, HOME처럼 투명(`.bare`)일 때 **왼쪽 빈 자리가 프로필 클릭을 삼킨다** → `.curBar.bare{pointer-events:none}` + `.res`만 되살린다. ③ 프로필이 4줄로 커져서 중앙 `.hbMid`는 `--hbHudH`(83px) 아래로 내려간다 — 프로필 높이를 바꾸면 이 변수도 같이 바꿀 것. 셋 다 스모크가 검사한다.
- **🤝 전직은 폐지됐고, 옛 상위 직업 12종이 그대로 '동료'가 됐다**(2026-08-12 설계 전환). `PROF_JOBS`는 **뿌리 3종만** 남았고(캐릭터는 만든 그대로 끝까지 간다), `profClassChange`·`profClassCost`·`hbGrowJobs`·`PROF_JOB_PARENT`는 **삭제됐다** — 되살리지 말 것.
  - **`HB_MATES`(12종)** = 옛 상위 직업의 이름·3D 모델(`unit`)을 그대로 가져온 표. **영입은 구매가 아니라 뽑기**이고(2026-08-12 2차 전환), **등급(`tier`)이 해금 레벨을 대체했다** — `hbMateBuy`/`hbMateCost`/`hbMateOpen`과 `lv`/`cost` 필드는 없어졌다. 표는 등급 오름차순이고 상위 등급이 더 세야 한다(스모크가 검사). 등급은 공용 `GACHA_TIERS`/`TIER_COLOR`를 쓴다 — 새 등급 체계를 만들지 말 것.
  - **🎰 뽑기 곡선은 공용 `buildGachaCurve(cfg)` 하나로 만든다** — **동료(`HB_MATE_GACHA`)와 펫(`PROF_PET_GACHA`)이 같은 형태**다(2026-08-12). 새 뽑기를 만들 때도 이 함수를 쓸 것. 스모크도 `checkGachaCurve()` 한 벌로 두 곡선을 같은 잣대로 검사한다 — 규칙을 두 벌로 적지 말 것.
  - **🎰 뽑기 `HB_MATE_GACHA` = 30단계, 표가 아니라 '곡선에서 생성'한다**(2026-08-12 3차). 30줄을 손으로 적지 말 것 — 상수 두 벌에서 만든다.
    - **단계 문턱** `need(k)=HB_MATE_NEED_A·(HB_MATE_NEED_B^(k-1)−1)` = 12·(1.16^(k-1)−1). 2 · 10 · 34회로 **초반은 금방** 넘어가고 30단계는 **누적 876회**로 점점 어려워진다(간격이 계속 벌어지는지 스모크가 검사). ⚠ 옛 값(8/1.25)은 30단계에 **5,162회**를 요구해 사실상 잠긴 단계였다 — 뽑기권이 미네랄로 안 팔리는 재화라 그만큼 모을 수가 없다. 그래서 스모크가 **하한(300)뿐 아니라 상한(1,500)까지** 검사한다.
    - **등급 확률** = `HB_MATE_W0[t] · HB_MATE_WG[t]^(k-1)` 을 정규화. 배수가 1보다 작으면 비중이 줄고(일반 .83 · 레어 .90 · 에픽 .95) 크면 는다(유니크 1.08 · 레전드 1.16 · 초월/갓 1.20).
    - 결과: 1단계 `90 / 9 / 1 / 0.1 / 0.01 / 0.001 / 0.0001%` → 30단계 `14 / 14 / 7.7 / 32 / 25 / 6.7 / 0.67%`. **갓은 1단계부터 0이 아니다**(0.0001%) — '금방 나오되 아주 낮게'가 설계 요구다.
    - 상수를 고칠 때 지킬 규칙(전부 스모크가 검사): ① 각 단계 확률 합 = 1 ② 단계가 오르면 **유니크 이상은 반드시 늘고 일반은 반드시 준다** ③ 레어·에픽은 중간에 정점을 찍고 **꺾여야 한다**(끝까지 오르면 '낮게 떨어진다'가 아니다) ④ 최종 단계의 일반+레어+에픽 합 < 50% ⑤ 모든 등급이 1단계부터 0%가 아니다.
    - ⚠ 한 판은 **'뽑기 전' 단계 확률**로 굴린다(`hbGachaProbs(mateN-1)`) — 안 그러면 그 판이 자기 결과로 확률을 바꾼다.
    - ⚠ 확률 표기는 `fmtOdds()`로 한다 — 고정 소수점 1자리로 찍으면 갓(0.0001%)이 전부 `0.0%`로 뭉개진다.
  - **중복 = 합성 재료** — 겹쳐 나오면 레벨이 아니라 `dup`이 는다(펫의 ★ 규칙과 다르다). `hbMateFeed(대상, 재료)`로 **중복을 직접 골라** 넣고, 재료 값어치는 등급을 따른다(`HB_MATE_PT`, 등급마다 3배). 강화는 이것뿐이다 — 미네랄로는 못 올린다.
  - **뽑기권(`tickets.ally`)이 동료를 얻는 유일한 길**이다. 나오는 곳: 엘리트/일반 처치 드랍(`HB_ATICKET_*`) · 라운드 마일스톤 2번째마다. ⚠ **주는 곳을 없애면 동료 시스템 전체가 잠긴다.** (이 티켓은 원래 필드만 있고 주는 곳도 쓰는 곳도 없는 죽은 재화였다.)
  - **상태는 계정 축이다** — `hunt.mates{id:{lv,dup,fed}}`(없음 = 미영입) + `hunt.party[]`(출전) + `hunt.mateN`(누적 뽑기). **환생해도 남는다.** 정원은 `hbMateMax()` = 기본 3 + `ally_plus` 해금 2. ⚠ 정원 검사는 `hbMateToggle`이 **거절**하는 방식이어야 한다 — `hbParty()`의 slice만 믿으면 저장된 편성이 몰래 넘친다(스모크가 거절 여부까지 본다).
  - **동료도 캐릭터와 같은 3D 경로로 그린다** — `hb3dList()`가 `S.allies`를 목록에 넣는다(이모지로만 그리면 옛 직업 모델이 사라진 것과 같다). 사격은 공용 `hbUnitFire(u,dps,rangeMul,dt,spd)`이고 동료마다 dps/사거리/연사가 다르다.
  - **건설표(`HB_BUILD`)에서 `ally`는 빠졌다** — 남은 것은 터렛·벙커뿐. `hbBuildMax('ally')`를 부르지 말 것.
  - **마이그레이션(v8)** — 보유 표기가 숫자에서 `{lv,dup}`로 바뀌었고, 미네랄로 사 뒀던 레벨은 그대로 인정한다. 처음 열 때 뽑기권을 `HB_MATE_START_TICKETS`장 쥐여 준다(안 그러면 뽑기 화면이 비어 보인다).
  - **마이그레이션 순서 함정(v7)**: `fixChar()`가 '이제 없는 직업'을 조용히 뿌리로 되돌린다. 그래서 **전직→동료 변환은 반드시 `fixChar` 루프보다 앞에서** 해야 한다 — 뒤에 두면 옛 직업을 볼 수 없어 동료를 못 준다(실제로 그렇게 짰다가 스모크가 잡았다).
- **🎟 뽑기권은 미네랄로 살 수 없다**(2026-08-12 확정). 얻는 곳은 **엘리트 처치 · 맵의 상자(`hbChestReward`) · 라운드 마일스톤**이고, 사는 곳은 **💎 젬뿐**(`buyTicketGem`, `TICKET_GEM`). 미네랄로 팔면 방치 수입이 곧 뽑기가 되어 등급 설계가 통째로 무너진다 — `PROF_PET_TICKET_COST`(미네랄 300 구매)는 그래서 삭제됐다.
  - 상자는 장비/펫/동료 권을 **섞어서** 낸다(26/28/20%) — 장비만 세는 검사를 쓰면 다른 권이 나왔을 때 '보상 없음'으로 오판한다(실제로 스모크가 그렇게 깨졌다).
  - 마일스톤은 동료·펫 권을 **번갈아** 준다(짝수=동료 · 홀수=펫). 구매 줄은 `ticketBuyRow(kind)` 하나를 상점·동료 팝업이 함께 쓴다.
  - ※ **퀘스트 보상은 아직 없다** — 퀘스트 시스템 자체가 없다. 생기면 `dgAddTicket(kind,n)`을 부르면 된다.
- **🐾 펫도 동료와 같은 단계형 뽑기다**(2026-08-12). 다른 점은 두 가지뿐: ① 펫은 등급이 5종(초월·갓 펫이 없다 — `PET_TIERS`는 `PROF_PETS`에서 자동으로 뽑는다. 없는 등급에 확률을 주면 그만큼 헛돈다) ② 강화 축이 레벨이 아니라 **별(★, 상한 5)** 이다.
  - **영입은 `tickets.pet`으로만** 한다. 옛 `PROF_PET_GACHA_COST`(미네랄 300 즉시 뽑기)는 없어졌다. 드랍은 엘리트 5% / 일반 0.15% + 상자 + 마일스톤이고, 구매는 젬뿐이다.
  - **중복은 ★를 바로 올리지 않는다** — `dup`에 쌓이고 `profPetFeed(대상, 재료)`로 골라 넣어야 ★가 오른다(옛 규칙은 '중복 수 − 1 = ★'였다). 재료 값어치는 등급을 따른다(`PROF_PET_PT`).
  - **마이그레이션(v9) 주의** — 옛 표기는 `{count:N}`이고 ★는 `N−1`이었다. `star=count-1`로 옮기지 않으면 **펫 성능(`profPetVal`)이 그대로 깎인다**. 스모크가 '중복 4 → ★3'을 검사한다.
- **💠 재화 표기는 `fmtCur(n)` 하나로 한다**(2026-08-12). 던전 보상 배수가 `24^(dg-1)`이라 상위 던전에서 자릿수가 폭주하고, 우측 정렬된 숫자가 왼쪽으로 자라 **좌상단 프로필을 덮는다**(실측: `646,228` 3개면 3px 겹침). **10만부터 K/M/B/T로 축약**하고 그 아래는 콤마 표기를 유지한다 — 새 재화 표시를 만들 때 `toLocaleString`을 직접 쓰지 말 것.
- **📈 성장 곡선·환생·해금 = 설계 문서가 아니라 코드 상수다**(2026-08-12 설계 확정). 사용자 설계: *초반은 빠르게 → 뒤로 갈수록 배로 → 막히면 환생 → 막힐 때쯤 새 요소가 하나씩*.
  - **레벨 곡선 `profXpForLevel(lv)`은 구간 함수다.** `lv<PROF_LV_SOFT(30)` = `PROF_XP_A(30)·lv^PROF_XP_P(1.35)`(옛 `50·lv^1.5` 대비 30레벨 누적 36k vs 94k = 2.6배 빠름), 그 이상 = 레벨당 `×PROF_XP_GEO(1.10)` 등비(약 7.3레벨마다 2배). 두 식은 lv=30에서 값이 같아 이어진다 — **상수를 만질 땐 경계 연속성이 깨지지 않는지 봐야 한다**(스모크가 검사).
  - **경험치 지급은 `profGainXp(c,xp)` 한 곳만 지난다.** 지급 지점이 4곳(자동사냥 처치·토벌 클리어·소탕·방치 정산)이라 환생 배수를 각자 곱하면 반드시 어긋난다. `c.xp+=` 를 새로 쓰지 말 것.
  - **환생 `profRebirth(c)`** — `PROF_REB_EVERY(25)` 레벨마다 1단계, 단계당 `PROF_REB_GAIN(0.2)`씩 `c.rebMul` 누적(= 경험치 획득 배수). **깊이 밀고 환생할수록 단계가 커진다**(Lv50 = 2단계). 되돌리는 것은 `c.level`·`c.xp`·`c.unit.level`뿐 — **계정 축(`hunt.upg` 미네랄 업그레이드)·장비·펫·진화★는 건드리지 않는다**(스모크가 지킨다).
  - **해금 `PROF_UNLOCKS`는 레벨 게이트다**(옛 기준은 파워였다 — `u.power`는 없어졌다). 표의 `lv`는 오름차순이고 **서로 3레벨 이상 떨어져 있어야 한다** — 붙어 있으면 한꺼번에 열려 '하나씩 열리는 재미'가 사라진다(스모크가 간격까지 검사). 판정 기준은 `profUnlockLv()`(=현재 캐릭터 레벨)이고, 한 번 연 것은 `p.unlocks`에 영구 기록돼 **환생해도 닫히지 않는다**. 문구에 필요 레벨을 손으로 박지 말고 `profUnlockNeed(id)`를 쓸 것.
  - **🎁 라운드 마일스톤 `hbRoundRw(dg,round)`** — `HB_RW_EVERY(5)` 간격 라운드의 **최초 클리어 1회** 보상(4번째마다 장비 뽑기권). 수령 기록은 **던전별로** `hunt.rw[dg][round]` — 반복 파밍으로 재수령되면 안 된다. 지급은 `hbSettle`에서 **등반으로 라운드를 올리기 전에** 한다(안 그러면 한 칸 밀린 라운드로 판정된다). 라운드 팝업은 아직 못 간 **다음 마일스톤까지 한 칸 더** 보여 주되 `disabled`로 잠근다(목표 제시 = 도전정신).
  - ⚠ `HB_DG_ALL_OPEN=true`(밸런스 확인용 전체 개방)가 켜져 있는 동안은 던전 해금 진행이 무의미하다 — 진행 설계를 실제로 체감하려면 `false`로 돌려야 한다.
- **스탯 출처 내역은 `profStatParts(k)`**(2026-08-10) — 직업 base / 배분 / 레벨 / 진화 / 장비 / 펫%로 분해해 HOME 좌상단 HUD → 캐릭터 정보 팝업에 표로 보여준다. ⚠ `profStat()`의 계산식을 손으로 분해한 것이라 **식을 고치면 여기도 같이 고쳐야 한다** — 스모크가 '분해합 === profStat'을 4스탯 전부에서 검산해 어긋나면 잡는다.
- **파워 해금(`PROF_UNLOCKS`)은 전부 실제 배선이 있어야 한다**(2026-08-10, 3 → 8단계). 투기장·진화·오프라인 8h에 더해 펫 슬롯 3/4(`profPetSlots()`), 동료·터렛 최대 +2(`hbBuildMax(k)`), 오프라인 12h. **저장된 `p.petSlots`·`HB_BUILD[k].max`를 직접 읽지 말고 이 두 getter를 쓸 것** — 직접 읽으면 해금이 조용히 무시된다. 스모크가 '표시만 하는 해금 항목'을 금지한다(배선된 id 목록과 대조).
- **마을(`#townScreen`)은 네비의 한 탭이다** (2026-08-07, 허브 삭제). 로그인·게스트·유즈맵 뒤로가기·캐릭터 화면 닫기가 전부 `openTown()`으로 모인다. 유즈맵은 마을 하단 고정 바(`.twBottom` → `twGoMap()`)로만 들어가고, 친구 목록은 마을 하단 시트(`#twSocial`)가 **허브 소셜의 마크업·id·렌더러를 그대로 이어받았다**(`#hubFriendTabs`/`#hubFriends`/`renderFriends`/`setFriendFilter` — 이름의 `hub`는 옛 위치의 흔적일 뿐 화면은 마을이다). 로그아웃·설정은 마을 상단 바(`askLogout()`/`openAppSettings()`). 캐릭터가 없으면 `openTown()`이 **그 자리에서 `profEnsureChar()`로 기본 유닛을 지급**하고 그대로 진행한다 — 되돌려 보낼 화면이 없다(2026-08-13, 캐릭터 생성 화면 폐지).
- **마을을 떠날 땐 `twLeave()`를 쓸 것**: 루프(`twStopLoop`)·시설 팝업·친구 시트를 한 번에 닫는다. 빼먹으면 다른 화면 뒤에서 마을 루프가 계속 돈다.
- **스모크에서 캐릭터를 지울 땐 `saveMeta()`까지 할 것**: 화면 진입 함수들이 `loadMeta()`로 저장소를 다시 읽어 방금 지운 캐릭터를 되살린다(실제로 한 번 걸렸다).
- **함수마다 래퍼를 씌우는 프로파일링은 호출 수가 많은 함수를 가짜로 비싸게 만든다.** 래퍼 비용(`performance.now()` 2회)이 호출 수에 비례하므로, 프레임당 10만 회 불리는 함수는 자동으로 "제일 비싼 함수"로 보인다(실제로 `strikeIsAir`를 13.99ms로 오판 → 캐싱해도 2%뿐이었다). **부분의 합이 전체를 넘으면 측정이 틀린 것이다** — 그때는 호출이 프레임당 몇 번뿐인 지점만 재거나, 함수를 통째로 no-op으로 바꿔 차이를 보는 ablation을 쓴다.
- 직스 성능 비교는 **반드시 같은 세션 안에서** 구현을 런타임으로 갈아끼워 A/B 할 것. 리로드 사이에는 발열·GPU 상태·품질 모드·랜덤 유닛 구성이 달라져 편차가 효과보다 크다(리로드 비교로 "한계가 300→450으로 올랐다"고 잘못 보고한 적 있음).
- **그래픽 품질 = 절전/고화질 2단계(기본 고화질)** — `G.opt.quality`(`setQuality`). 해상도 배율은 **직스 전장에만** 적용(`STK_RES`/`strikeResMode`): 고화질=3D 1.2× 슈퍼샘플·2D 네이티브, 절전=0.6×. 건설지·네모 등 다른 화면은 항상 네이티브. (구 `strikeAutoQuality` 자동조절은 제거 — 고주사율 화면에서 '주사율을 못 채우니 해상도를 깎자'는 오판으로 태블릿이 흐려지는 버그가 있었다. 프레임 시간을 목표 fps ms 상수와 비교하는 자동조절은 vsync 바닥 때문에 되살리지 말 것.)
- **건설 시스템(`TECH_TREE`·`techBuildListModel`·건물 프로필)은 관리자와 오토배틀 공용이다.** 오토배틀 전용 규칙은 `TECH_TREE`를 고치지 말고 별도 표 + `techWallet()` 게이트로 붙인다 — `TECH_BLDG_UNIT`(건물 1채 = 웨이브마다 담당 유닛 n×`TECH_WAVE_MUL`기 자동 배출, `strikeSpawnWave`, 웨이브 20초 · AI는 내 배출 총량에 맞춰 대응하므로 진영 밸런스는 자동 유지 — 전투 규모는 개별 `n`이 아니라 `TECH_WAVE_MUL`로 조절할 것), `STK_BLDG_LOCK`(벙커·포탑 잠금), `_techSpawnText`("출격 시 …" 문구), `_techHasProd`(생산 프로필 판정). 게이트를 빠뜨려 관리자로 샌 선례 **2회**: ① `_techSpawnText` → 건물 프로필 좌하단 설명 오염, ② "수동 생산은 일꾼만" 규칙이 프로필 디스패처·`_prodShow`·`_techBldgDesc` 세 곳에 무조건 걸려 **관리자 건물의 유닛 생산 그리드가 통째로 사라짐**. 스모크 `건물→전장 배출표`·`관리자 건설: 병영 생산 카드` 스텝이 양쪽을 지킨다.
- 건물 프로필 모델 선택은 `techPanelRender`의 한 줄 삼항 사슬(벙커→나이더스→라바→생산→연구→해금→plain). 생산 조건을 좁히면 조건에서 밀려난 건물은 **빈 그리드**가 된다(연구도 해금도 없으면 plain).
