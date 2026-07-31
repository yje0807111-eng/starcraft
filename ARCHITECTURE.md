# ARCHITECTURE — sc-ums-web.html 코드맵

> AI/사람 공용 내비게이션 문서. **줄 번호는 표류하므로 "찾기 문자열"(배너·함수명)로 점프할 것.**
> 마지막 전면 갱신: 2026-07-22 (총 ~15,400줄 기준)

## 0. 제약(불변)
- 산출물은 **단일 자립 파일** `sc-ums-web.html` — 빌드 없음, 번들러 없음.
- 테스트 프레임워크 없음 → 행동 검증 = **`npm test`** (스모크 스위트, §9) + 브라우저 프리뷰.
- UI는 단일 소스 원칙(CLAUDE.md 레지스트리) — 같은 UI 재구현 금지, cloneNode/기존 함수 재사용.

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
- 하단 탭 `#tabs`: 메인/유닛뽑기/업그레이드/**보스**(게임 전용, `updatePbossFab`이 표시 제어)/플레이어 + 샌드박스 전용 전투실험/건설.
- 하단 패널 `.bp` — **id는 `'bp'+탭명` 동적 참조**(`bpMain/bpUnit/bpUpgrade/bpPlayers/bpBattle/bpBuild`). ⚠️ 미참조로 보여도 살아있음.
- 시트 모드: `G.mainSheet` + `renderMainSheet()` 디스패처. 유닛 지정 중엔 프로필 우선, 해제 시 시트 복원(`refreshSelCard` 분기).
- 프로필/그리드는 전부 `renderCmdGrid(host, model)` — 모델 객체로만 내용 제어(레지스트리 참조).

## 6. 3D 모듈 (window.M3D)
- 진입: `M3D.sync(units, GW, GH, dt, sel, enemies, selEnemy, scaleMul, view)` — 유닛/적 모델 동기화+렌더. 그 외 `syncShop/syncBuild/syncBldg/syncBoss`(탭별), `portrait`, `hasModel`, `loadMapModels/keepOnlyMap`(맵별 VRAM), `dbg()/matDbg(uid)`(디버그).
- `makeModel(id)` → `{holder(위치/스케일)→view(부감틸트)→yaw(회전)→anim(모션)}` + `inner/runInner/stayInner/atkInner`(정지/달리기/대기/공격 GLB) + `rim`(선택링 메시) + `shadow`.
- **피격·사망 연출 세기**: FX 스토어의 `hitK`(기본 1)가 impact·death 크기를 배율로 줄인다. 직스는 `STK_HIT_K=0.5` + `STK_DEATH_PARTS=5`(공용 기본 9) — 수백 기가 동시에 싸워 기본값이면 화면이 이펙트로 덮인다. **공용 FX 코어는 기본값 그대로**라 네모는 영향 없음.
- **인스턴싱(드로우콜 절감)**: 선택링=`ringInst`(_ringPush), 그림자=`shInstA/B`(_shadowInstPass, 지상0.22/공중0.26). 개별 `m.rim`은 직스 팀색·토벌장·적 선택용으로만 남음. 새 발밑 표시는 인스턴스 경로를 따를 것.
- **대군 최적화**: `_mixStride`(유닛>60 → 2프레임, >150 → 3프레임에 1회)로 스킨드 믹서를 분산(`_mixStep`). 건너뛴 프레임엔 `skeleton.update`도 홀드(`_mixHold`/`_skels`) — 본 포즈가 그대로라 화면은 동일하고 본 행렬·본 텍스처 업로드가 사라진다. 본 서브트리는 `hideBoneRoots`로 `visible=false` → three.js 렌더 순회에서 제외(손 본에 검 등 메시를 붙인 모델은 자동 제외). 해상도는 `G.opt.resScale`을 sync가 매 프레임 반영(품질 프리셋과 연동).
- **측정 훅(기본 off)**: `M3D.prof(true)` → `{loop, mw, render, calls, tris, objs, bones}`. `M3D.mixForce(n)`/`M3D.boneVis(on)` = 벤치 A/B 강제 토글.
- 플레이어색: `_toneInject`(HSV 본체 회색화+액센트 마스크) + fresnel 림(`addRim`). 상수: `TINT_*`, `RIM_*`(`RIM_MUL` 유닛별 배율).

## 7. 유즈맵 모듈 시스템
[공유 베이스](엔진·렌더·3D·UI셸·U) + [유즈맵 모듈](등급·가챠·밸런스·경제). 새 맵 = `USEMAPS`에 항목 추가 + `cfg`/`cfg.bal` 오버라이드. 직스(strike)가 "nemo 셸 재사용 게임플레이 모듈"의 선례.

## 8. 멀티/소셜
Supabase Realtime presence 기반(방 목록·로비·파티·귓말). 방 목록엔 시뮬 봇 방 혼재(`buildRoomList`). 게임플레이 자체는 로컬.

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
- **동적 id/클래스**: `'bp'+탭`, `'body-'+id`, `'arr-'+id`, `'fDot-'+status` 등 — "미참조" 판정 전 접두사 조합 검색 필수.
- **`sellUnit(u)`는 유닛 객체**를 받는다(uid 아님). 적 소환은 `G.pendSpawn` 대기열 경유(즉시 `G.enemies` 증가 아님).
- **백그라운드 탭 측정 왜곡**: 브라우저 팬이 숨겨지면 rAF 정지·WebGL 스로틀 → 성능 절대값 비교 불가. 같은 표시 상태끼리만 비교.
- `THREE.GLTFLoader: Couldn't load texture blob` 콘솔 오류 = 기지 이슈(동시 로드), 스모크에서 knownNoise로 분류.
- 스킨드 메시 bbox 부정확 · WebGL 캔버스 preserveDrawingBuffer=false(픽셀 읽기 불가).
- **`M3D.sync` 목록에서 빠진 것 = 사망으로 처리된다**: 직스는 화면 밖 유닛을 잘라내(`STK_CULL`) 목록에서 빼므로, 나갔다 `DEAD_HOLD`(2초) 안에 돌아온 유닛은 사망 모션이 걸린 모델을 그대로 재사용한다. 되살리지 않으면 **멀쩡한 유닛이 누운 채 이동하다가 모델 재생성 시 벌떡 일어난다.** → 아군·적 루프 진입부에서 `reviveModel`로 해제. 컬링을 새로 넣는 코드는 이 상호작용을 반드시 확인할 것.
- **임포스터(스프라이트 대체)는 만들었다가 제품 판단으로 걷어냈다**: 400기 기준 드로우콜 1,340 → 144, 26 → 39 FPS까지 나왔지만, 직스 기본 줌에서 유닛이 4~19px이라 전환 임계(20px) 아래 = 사실상 전투 내내 스프라이트로 보였다. "항상 3D 모델로 움직여야 한다"는 요구와 맞지 않아 제거(2026-07-31). 다시 필요하면 그때 측정치와 함정(밉맵 금지·정사각 프레임 금지·premultipliedAlpha 필수)을 참고할 것.
- **대군 렌더 병목은 삼각형도 재질도 아니다(실측)**: 400기에서 전 유닛을 1/7 폴리곤 모델로 바꿔도, 전 유닛 재질을 공유 단일 재질로 바꿔도 프레임이 나아지지 않았다. `renderer.render` 시간은 **드로우콜 수에 거의 선형**(229콜 4.9ms / 488콜 9ms / 1250콜 22ms ≈ 18µs·콜). → 지오메트리 LOD·텍스처 축소는 헛수고, 줄일 것은 **오브젝트/드로우콜 수**(유닛당 2~3콜).
- 상호작용 버그는 핸들러 흐름(`techPtrDown→Move→Up`, tick)을 끝까지 읽고 나서 수정(CLAUDE.md 원칙).
