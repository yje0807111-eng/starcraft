# HOME 필드화 계획 — 마을 화면 제거 + 걸어다니는 자동사냥

결정(2026-08-11)
- 마을은 **화면만** 지운다. 월드 카메라·탭 이동 엔진은 남겨 HOME에서 재사용.
- HOME은 지금의 자동사냥 화면·적·전투를 **그대로 두고**, 캐릭터 이동만 얹는다.
- 화면 가운데 = 체력 회복 구역.

## 1단계 — 마을 화면 제거

### 지운다
| 대상 | 비고 |
|---|---|
| `#townScreen` 마크업 · `.tw*` 화면 CSS | `.twMap`/`.twWorld`/`.twGround`는 **남긴다**(HOME이 쓴다) |
| `TOWN_ZONES` · `twBuildZones` · `twZonePx` · `twCheckZones` | 구역 7개 전체 |
| `twEdgeApply` · `_twEdgeEl` · `.twEdge` | 화면 밖 방향 화살표 |
| `openTown` · `twLeave` · `twGoMap` · `openTownPanel` · `closeTownPanel` | 진입·이탈·패널 |
| `twOpenSocial`/`twCloseSocial`/`twOpenChat`/`twCloseChat` | 소셜·채팅 |
| `TW_ZONE_BLDG` · `twPaintBldgs` · `.tzBld` | 구역 건물 3D |
| 네비 '마을' 탭 · `APP_SCREENS`/`CUR_SCREENS`의 `townScreen` | |
| `renderTownBar` · `showTownToast` · `.twBar` 계열 | |

### 남긴다 (HOME이 쓸 엔진)
| 심볼 | 역할 |
|---|---|
| `_twW/_twH/_twVW/_twVH/_twVL/_twVT` | 월드·뷰포트 크기 |
| `twLayout` | 월드 픽셀 산출 + 리사이즈 시 좌표 비례 이동 |
| `twCamApply` | 카메라 = `#twWorld` transform 한 줄 |
| `twScreenToWorld` · `twSetTarget` · `twTapFx` | 탭 → 목적지 |
| `twClampWall` + `TW_WALL_X/Y/DY/CUT` | 경계(팔각형) — HOME 배경에 맞게 재측정 필요 |
| `twStep` · `twStartLoop`/`twStopLoop` | 이동 틱 |
| `twPtrDown/Move/Up` | 포인터 |
| `_twChar` · `twApplyChar` · `.twAvatar` 계열 | 아바타 |
| `TW_SPEED`/`TW_ARRIVE`/`TW_TAP_MS`/`TW_TAP_PX` | 이동 상수 |
| `TW_WORLD_W_MUL`/`H_MUL` | 월드 배율 — HOME 배경 비율에 맞게 재조정 |

> 이름은 `tw*` 그대로 둔다. 일괄 개명은 diff만 키우고 얻는 게 없다.

## 2단계 — HOME에 이동 얹기

### 지금 HOME (그대로 둔다)
`openHome()` · `G.hunt{dg,round,climb,best,upg}` · `HB_UPG` · 적 스폰/전투 · 스킬 바 · 던전 배경(`hbBgImg`).

### 넣을 것
1. **월드 레이어** — HOME 전장에 `#twWorld` 상당의 컨테이너를 두고 `twLayout`/`twCamApply` 연결.
   지금 HOME은 화면 고정이므로, 월드 = 화면 × N배로 넓히고 카메라가 캐릭터를 따라간다.
2. **탭 이동** — `twPtrDown/Move/Up` → `twSetTarget`. 스킬 바·업그레이드 UI 위 터치는 제외.
3. **중앙 회복 구역** — 월드 정중앙 반경 R 안에 있으면 초당 `HP_REGEN%` 회복.
   바닥에 발광 원판(CSS)으로 표시. 전투 중에는 회복 정지 여부 = 결정 필요.
4. **적 배회** — 적이 화면 고정 스폰이 아니라 월드 좌표를 갖고 돌아다니게.
   기존 `strike`의 분리·이동을 재사용할지, HOME 전용 간이 이동으로 갈지 결정 필요.
5. **경계** — HOME 배경(던전 그림)에 맞는 `twClampWall` 값 재측정.

### 확정된 규칙 (2026-08-11)

**회복 구역 = 지형, 안전지대 아님.**
- 전투 중에도 조건 없이 회복된다. 상태 검사 없음 — 원 안에 있으면 초당 회복.
- 적도 원 안까지 따라 들어온다. 진입 금지·어그로 해제 같은 예외를 두지 않는다.
- 따라서 "도망쳐서 쉬는 곳"이 아니라 **버티면서 싸우는 자리**다.
  플레이어의 선택은 "회복하러 갈까"가 아니라 "여기서 버틸까, 밀고 나갈까"가 된다.

**적 = 전원 플레이어 추격.**
- 배회·순찰 없음. 스폰 즉시 플레이어를 향해 직진.
- 배회 AI를 짤 필요가 없다 → `strikeMoveToward` 계열을 그대로 쓰거나
  `(플레이어 - 적)` 정규화 한 줄이면 끝. 분리(`strikeSeparate`)만 얹으면 뭉침이 풀린다.
- 결과적으로 **전투는 항상 플레이어 주변에서 벌어진다** → 카메라가 캐릭터를
  따라가는 것만으로 화면 구성이 성립한다.

**진행도 = 마지막 웨이브 전멸 + 보스 처치.**
- 라운드 클리어 조건이 "시간 경과"가 아니라 **잔적 0**이 된다.
- 마지막 웨이브를 정리하면 보스 등장 → 보스를 잡아야 던전 클리어.
- 도망 다니면 클리어가 안 되므로, 회복 구역이 안전지대가 아닌 것과 맞물려
  "계속 싸우게" 만든다.

> 세 규칙이 한 방향을 가리킨다: **플레이어가 계속 싸우게 하고, 이동은 위치 선택의
> 문제로만 남긴다.** 회피·리트리트 루프를 만들지 않는 것이 설계 의도다.

### 이 결정에서 따라오는 구현
| 항목 | 내용 |
|---|---|
| 회복 | `_twChar`와 월드 중심 거리 < `HB_HEAL_R` → 초당 `HB_HEAL_PCT` 회복 |
| 회복 표시 | 월드 중앙 발광 원판(CSS) — 부감이라 **세로 61% 납작한 타원** |
| 적 이동 | 스폰 → 플레이어 직진 + 분리. 목적지 재계산은 매 틱 |
| 클리어 | 웨이브 잔적 0 → 보스 스폰 → 보스 사망 → 던전 클리어 |
| 남는 결정 | 보스 등장 위치(중앙? 가장자리?) · 웨이브 수 · 회복량 수치 |

## 검증
- `new vm.Script(...)` · `node --check`(module) · `npm test`
- 스모크의 마을 그룹은 **HOME 필드 테스트로 교체**한다(현재 마을 카메라/성벽 테스트).
