# 진행 상태 (PROGRESS)

## 🎨 2026-09-13 — 아트 방향 · 2.5D 전환 (인수인계)

> ⚠ 아래 「🧭 여기서 멈춘다」 절은 **게임플레이·밸런스 쪽** 인수인계다. 이 절은 **아트 방향**이라 별개다.
> **지금 상태**: `main` = `96a1d79` · 작업 트리 깨끗 · `npm test` 통과 · `node scripts/art-lint.mjs` 통과.
> 🚨 **한 줄 요약**: 3D 를 접고 **2.5D 스프라이트**로 간다. **그림 규격은 확정**했고 **아직 한 장도 안 구웠다.**

### 왜 2.5D 인가 (사용자 결정 2026-09-12)
3D 는 **모션에 한계**가 있다 — 넣을 수 있는 동작이 적고, 어떤 유닛은 이동 모션뿐이며,
**짐승·비인간형은 이동 모션조차 넣기 어렵다.** 기술이 나아질 기미가 없어 3D 로는 무리라고 봤다.
⛔ **기존 3D 모델에서 스프라이트를 굽지 않는다**(`M3D.unitSprite`) — 퀄리티가 원하는 방향이 아니라
**처음부터 전부 다시 뽑는다**(사용자 확정).

### ✅ 확정된 것 — 규격은 `ART.md` §19 가 단일 소스
| 항목 | 값 |
|---|---|
| 투영 | **직교(orthographic)** · 원근 없음 · 소실점 없음 · 머리가 발보다 크지 않다 |
| 부감 | **수평선 위 30°** |
| 회전 | **요(yaw) 45°** — 모서리에서 본다 |
| 바닥 | **정사각 격자**(마름모 아님) |
| 그림체 | 툰 셰이딩 4톤 · 외곽선은 **바깥 실루엣에만** · 무광 |
| 디자인 언어 | 「고속 경장갑」 — 쐐기 덩어리 · 긴 대각 이음선 · 깎인 코 |
| 색 | 레이싱 리버리 — **팀 색이 몸의 1/3** + 흰색·그래파이트 + 청록 발광 |
| 비율 | 4.5등신 · 어깨 넓게 · 치비 아님 |
| 건물 높이 | 발자국 폭의 **2/3** · 전 건물 같은 비율 · ⛔ 탑 금지(뒤의 유닛이 가린다) |
| 건물 위계 | **높이가 아니라 넓이·질량**으로 |

`scripts/art-lint.mjs` 가 이 블록을 **기계로 잠근다**(13종 + 금지어 4종). 프롬프트를 새로 쓰면 실패한다.

### ⛔ 이미 해 보고 접은 것 — 다시 하지 말 것
1. **`VIEW_TILT` 를 70°(1.22)·55°(0.96) 로 올리기** → 실기기에서 「거의 90도」. **0.65 로 되돌렸다.**
2. **바닥을 2:1 마름모로** → 재 봤다(`docs/mock/iso-grid-spike.png`). 우리 맵이 40×68 **세로로 긴** 형태라
   45° 돌리면 **가로로 긴 평행사변형**이 되어 세로 폰에서 **위아래 3/4 가 빈다**(87×76% → 100×25%).
   스타1 은 **가로로 넓은 PC 화면**이라 됐던 것이다.
3. **요 30°** → 2:1 에 안 얹힌다. 45° 가 맞다.
4. **적 건물을 다른 디자인으로** → ⛔ **같은 건물에 색만 다르다**(엔진이 이미 `rimCol` 로 그렇게 한다).

### 🚨 두 번 크게 헛돈 함정 — 이것만은 기억할 것
**① 이미지 모델의 「70도」는 실제 기하 70° 가 아니다.**
시트를 「70°」로 뽑아 사용자가 골랐기에 같은 숫자를 `VIEW_TILT` 에 넣었더니 지붕만 보였다.
⇒ **그림은 방향만 정하고, 코드 값은 실기기 화면으로 정한다.**

**② 「너무 정면」의 범인은 각도가 아니라 원근이었다.**
같은 30° 라도 원근으로 그리면 머리가 커지고 정면이 과장된다. 프롬프트에 **직교 투영**을 박으니
30° 에서 바로 맞았다. 각도 숫자를 37→70→55→30 으로 옮겨 다닌 것이 전부 헛일이었다.

**③ 각도 기준이 둘이다** — 수평선 위 30° = 수직에서 60° = 블렌더 X회전 60°.
「3D 툴 기준 55~60도」 같은 문장을 수평선 기준으로 읽으면 ① 의 사고가 반복된다.

### ⚠ 이 개발 환경의 제약 (중요)
- **3D 가 아예 안 뜬다.** `js/90-m3d.module.js` 가 three.js 와 애드온을 **`esm.sh`** 에서 받는데
  프록시가 막는다(`ERR_TUNNEL_CONNECTION_FAILED`) → `M3D` 가 정의조차 안 된다.
  ⇒ **`npm test` 통과가 「3D 가 괜찮다」는 뜻이 아니다**(스모크의 M3D 검사는 없으면 건너뛴다).
  **화면 확인은 실기기에서만** 된다. 바닥·격자 같은 DOM/CSS 는 헤드리스로 찍힌다.
- 이미지 생성 CDN(`d8j0ntlcm91z4.cloudfront.net`)도 막혀 있어 **뽑은 그림을 내가 못 본다.**
  사용자가 채팅에 붙여 주면 그건 보인다.

### ⏳ 다음에 할 것 — 이 순서다
1. 🎨 **확정 규격으로 시트를 다시 뽑는다.** 지금까지 뽑은 컨셉 시트는 **전부 규격 전의 것**이라
   각도가 과하거나 원근이 들어갔다. `ART.md` §19-2 블록을 그대로 쓴다.
2. 🔍 **줌 구간을 정한다**(사용자 아이디어: 자유 줌 대신 **구간 스냅**). **스프라이트 px 이 여기에 매달린다.**
   지금 격자 한 칸 8.36px · 줌 1.45~1.9 라 유닛이 약 18 CSS px 인데, 「확대해서 유닛 하나하나를 보는」
   방향으로 간다고 했으므로 이 값이 바뀐다. ⛔ **정하기 전에 굽지 말 것**(굽고 나면 못 고친다).
3. 📐 **규격 셋을 정한다**: 스프라이트 px · 모션당 프레임 수(사용자가 본 방식은 4프레임 × 8방향) ·
   **팀 색 마스크 형식**.
4. 🎬 **한 유닛만 먼저 넣어 본다** — 8방향 한 벌을 실기기에 얹고 링·그림자·축척을 본다.
5. 그다음 42종.

### ⚠ 안 잰 것 / 열린 질문
- **`fitW`** — 모서리에서 본 그림은 **대각선이 가장 넓은데** 코드는 「발자국 가로 × 셀폭」에 맞춘다
  (`js/14-input-fx.js`). 그대로 두면 이웃 칸을 밟는다. **넣어 봐야 안다.**
- **`VIEW_TILT`(지금 0.65 = 37°)를 30°(0.52)로 내릴지** — 그림 규격은 30° 다. 8° 차이를 맞출지 안 정했다.
  3D 를 완전히 걷으면 무의미하지만 섞어 쓰는 기간이 있으면 정해야 한다.
- **30° 가 게임플레이에서도 맞는지** — 큰 시트로만 봤다. **작게 줄였을 때 실루엣이 구분되는지**를
  실제 줌 배율로 봐야 한다.
- **팀 색 8종의 실제 비용** — 오토배틀이 8인 대전이라 유닛마다 색이 여덟 벌 필요하다.
  3D 는 `applyTeamTint` 한 줄이면 끝나던 자리다. 「팀 색이 몸의 1/3, 크고 뭉쳐 있다」는 규칙이
  마스크 한 장으로 여덟 색을 찍기 위한 것인데 **아직 안 해 봤다.**
- **뜨는 건물 6종**(본부·병영·공학소·기갑공장·비행장·연구소)은 이착륙 프레임이 더 필요하다.
  엔진은 이미 `rising→flying→descending` · `_liftH` 연속 · 지면 그림자 · 착지 먼지가 다 돈다.
  애드온은 부모가 뜨면 **연결 통로가 사라지고 도킹 면이 드러난다**(사용자 확정).
- **타일** — 지금 `assets/tiles/` 는 §18 의 「dark tones · 3D render」로 뽑힌 **사실계**라
  새 툰 스타일과 **한 화면에서 어긋난다**. 새 스타일로 가면 바닥을 통째로 다시 뽑아야 한다.
  ⛔ §18 원문은 사용자가 준 것이라 **고치지 말고** 새 계열로 추가할 것.

### 📎 남긴 것
- `ART.md` **§19** — 계열 전문(고정 블록 · 헛돈 기록 · 각도 환산표 · 5종족 · 애드온 · 이착륙)
- `scripts/art-lint.mjs` — sprite 계열 검사(일부러 어긋뜨려 잡히는 것 확인함)
- `docs/mock/iso-grid-spike.png` + `.html` — 마름모를 접은 근거(그린 코드까지)

---

## 🧭 2026-09-13 — 여기서 멈춘다 (인수인계 반 페이지)

> **지금 상태**: `main` = `origin/main` = `1d227a7` · 작업 트리 깨끗 · `npm test` 전부 통과.
> 사용자가 이 프로젝트를 **잠시 멈추고 한 달짜리 작은 게임**을 먼저 내기로 했다(2026-09-13).
> 돌아왔을 때 **이 절만 읽으면** 바로 이어갈 수 있게 적는다. 아래 「관리자 페이지」 절부터는
> 2026-07 의 옛 문서라 지금 무게중심(캠프)과 다르다 — 참고만 할 것.

### 마지막 세션에서 한 일
| 커밋 | 무엇 |
|---|---|
| — | 🏠 보급소 **첫 채만** 5,000 확정(`CAMP_SUPPLY_FIRST`). 1만도 재 보고 되돌렸다 — 근거는 BALANCE §5-16 |
| `dfd859b` | 🎬 유즈맵 소셜 도크 여닫기 애니(`--t-dock` .26s / `--t-dockOut` .2s) |
| `1c8472d` | 🎬 환생 「이번 회차」 접기/펴기 울컥 제거 — 높이를 **한 속성**(grid-template-rows)만 움직이게 |
| `6c90937` | 💠📣 룬 칸 해금을 Lv.5~50 으로 · 레벨업 알림(`campLvUpSay`) · **캠프가 말을 못 하던 것**(토스트가 2026-08-25부터 통째로 숨어 있었다) |
| `130586e` | 🔁 룬 칸을 갈래별로 **번갈아** 연다(Lv.8 이면 세 갈래가 다 열린다) |
| `1d227a7` | 💠 유니크 칸은 갈래를 안 가린다 — 판정은 `runeSlotTakesGrp` 하나 |

### 🚨 내보내기 전에 반드시 끌 것 (지금 켜져 있다)
- `js/22-camp-rune.js:395` **`CAMP_RUNE_DEV_SEED = true`** — 저장에 룬·젬·칸을 진짜로 심는다.
- `js/19-camp.js:1332` **`CAMP_DEV_START_MIN = 1000000`** — 시작 미네랄. ⛔ 경제를 **재기 전에도** 0 으로.
- (`CAMP_RUNE_FREE`·`CAMP_RT_PTS_FREE` 는 이미 false)

### 다음에 이어간다면 — 값이 없는 것부터
1. **전과의 룬**(적 처치 보상)이 아직 `soon:true` 다 — 젬을 받으면서 닿는 데가 없다. 배선하면 `soon` 을 지운다.
2. **안 잰 값들**: `CAMP_INF_COIN`(12) · 무한층 보상 외삽 비 · `CAMP_AUTOUPG_KEEP`(4) · 환생 강화 「켜고 끄는 넷」의 값 순서 · 룬 칸 Lv.30/50 에 닿는 **실제 깊이**(계산만 했다).
3. **환생 강화 「시작 구성 바꾸기」** — 표에 못 올린다. 닿는 자리(`campWipeBoard` 한 줄)를 먼저 만들어야 한다.
4. **Supabase RLS 를 한 번도 확인 안 했다** — 내보내기 전에 반드시.

### 재는 법 (잊기 쉬운 것만)
```
CHROME_PATH=/opt/pw-browsers/chromium npm test          # 유일한 검증. 이게 통과 안 하면 끝난 게 아니다
node --check js/<파일>.js                                 # 고친 파일만
node scripts/camp-clear.mjs all 20 "5,36,257"            # 난이도 사다리(연속 모드)
node scripts/camp-bench.mjs 45 1                         # 경제 · 「🏁 첫 도달」
node scripts/camp-trace.mjs                              # 전투 움직임은 반드시 눈으로
```
⚠ **연출은 `pg.screenshot` 으로 재지 말 것** — 한 장에 100ms 넘어 늘 「이미 끝났다」만 나온다.
속도는 rAF 로 잰다(`scripts/mapdock-shot.mjs`·`scripts/reb-fold-shot.mjs` 가 그 본보기다).

### 문서 순서 (헷갈리면 이 순서)
`GAME_DIRECTION.md` §0-A → `GAME_DIRECTION.md` → `HUNT_R1.md` → **`BALANCE.md`(실측 확정치)** → `HUNT2.md` → `GEM.md`.
구조는 `ARCHITECTURE.md`, 화면은 `DESIGN.md`, 그림은 `ART.md`, 안 쓰는 코드는 `ATTIC.md`.

---

## 📦 (옛 문서 · 2026-07) 관리자 페이지 작업 진행 상태

> 이 파일 하나만 보고 새 세션에서 페이지별로 바로 이어갈 수 있도록 정리한 핸드오프 문서.
> 대상은 `sc-ums-web.html`(마크업) + `css/` 5개 + `js/` 19개 (빌드 없음, vanilla JS, Three.js 3D `M3D` 모듈).
> **2026-08-20 분할** — 어느 파일인지는 `ARCHITECTURE.md` §1 「파일 지도」에서 먼저 좁힐 것.
> "관리자 페이지"란 `enterSandbox()`로 진입하는 **샌드박스(G.sandbox=true) 모드의 각 탭(섹션)** 을 말한다.
> 줄번호는 편집으로 이동하므로 **함수명 / 요소 ID를 기준 앵커**로 쓰고, 줄번호는 "대략"으로 참고만.

---

## ★ 현재 완료 현황 (2026-07 세션 갱신)

전 페이지 시트 규약 정합 1차 완료. 각 탭 상태:

| 페이지 | 상태 | 요지 |
|---|---|---|
| 메인 (Main) | ✅ 완료(기준) | 무선택=시트 내려감 / 지정=프로필 슬라이드업. **무선택 재탭 무반응** 추가. 다중선택 칩 6칸×1줄로 축소 |
| 업그레이드 (Upgrade) | ✅ 완료 | `_upgSheetSync()`로 무선택=닫힘/힌트숨김·지정=목록 슬라이드업·빈땅탭=닫힘. 무선택 재탭 무반응 |
| 전투실험 (Battle) | ✅ 완료 | **피커 유지 + 최소 정합** — 소환 피커는 도구 팔레트라 빈 땅 탭으로 안 닫힘(탭 재탭으로만 여닫음) |
| 유닛뽑기/이펙트랩 (Unit) | ✅ 완료 | (a)자동오픈 유지. 그리드 2줄·이펙트 크기 1 고정·크기/맵줌 슬라이더 제거·**핀치 줌(FXLAB.scale)**·동작배너(#fxLabActs) 시트 위 상승 |
| 플레이어 (Players) | ⏸️ 현행 유지 | 사용자 결정 — 관전 탭은 이대로 충분(수정 없음) |
| 건설 (Build) | ✅ 완료 | 자체 시트 시스템(#btSheet) — 공통 .bp 규약과 별개 |

> 브랜치: `claude/admin-page-status-review-wn6tpz` (구 핸드오프 브랜치 `claude/github-mobile-workflow-Qh2aK`의 최신 작업을 fast-forward로 이어받음).
> 이후 작업은 **메인 화면 디테일 다듬기** 단계로 진입(예: 다중선택 칩 축소). 개별 요청 단위로 진행.

---

## 0. 검증 방법 (중요 — 브라우저 실측)

이 환경엔 Chromium + Playwright가 있다. 실제 부팅해서 DOM/스타일을 측정·스크린샷으로 검증한다.

```js
// /opt/node22/lib/node_modules/playwright 에서 import
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport:{width:420, height:820}, deviceScaleFactor:2 });
await pg.route('**', r=>{ const u=r.request().url(); u.startsWith('file:')?r.continue():r.abort(); }); // 원격 차단(로컬만)
await pg.goto('file://'+process.cwd()+'/sc-ums-web.html', { waitUntil:'domcontentloaded', timeout:20000 });
await pg.waitForTimeout(1100);
// 샌드박스(관리자) 진입 + 오버레이 숨김
await pg.evaluate(()=>{ enterSandbox();
  ['ov','opening','authGate','auth','mapSelect','rooms'].forEach(i=>{const e=document.getElementById(i); if(e) e.style.display='none';}); });
```

**헤드리스 주의(아티팩트)**: 로비 타이머가 `showAppScreen()`→`setInGame(false)`를 호출해 `#phone`의 `.inGame`을
벗겨 `#bot`(탭 바/시트)이 사라지는 경우가 있다. 측정이 갑자기 0높이/빈 상태로 나오면, 측정 전에
`window.showAppScreen=function(){}` 로 스텁하고 재측정할 것. **실게임에선 발생하지 않음.**

**JS 문법 검사**(편집 후 필수): 고친 파일만 검사하면 된다.
```
node --check js/11-cmdcard.js                      # classic 스크립트
node --input-type=module --check < js/90-m3d.module.js   # module 스크립트
for f in js/*.js; do case $f in *module*) continue;; esac; node --check "$f" || echo "✗ $f"; done   # 전부
```

---

## 1. 완료 — 공통 인프라 (모든 탭이 이미 공유)

레이아웃 골격은 `#phone`(flex column) = `#gameArea`(flex:1) + `#bot`(탭 바). 각 탭은 `.gview`(캔버스/맵) +
`.bp`(하단 슬라이드 시트) 한 쌍. 아래는 최근 커밋들(`3bb8eff`~`ac9925d`)로 이미 적용됨:

- **탭 바를 화면 맨 아래로**: `#bot{height:auto}` (탭 바 높이만). `#tabs`가 화면 최하단. (CSS ~597, ~604)
- **탭 바 최상위·불투명**: `#tabs{z-index:45; background:linear-gradient(180deg,#171922,#090b10)}` — 내려간 시트가
  탭 사이로 비치지 않게 불투명 + 시트(z22/30)보다 앞. (CSS ~604-606)
- **슬라이드업 시트**: `.bp{position:absolute; bottom:100%; z-index:22; transform:translateY(112%); max-height:min(46vh,342px)}`,
  `.bp.on{display:flex}`(활성 탭 패널만 존재), `body.sheetOpen .bp.on{transform:translateY(0)}`(올라옴). (CSS ~760-766)
  - 높이 캡 `min(46vh,342px)`: 뷰포트가 `#phone`보다 커도 화면 절반 수준 유지(이펙트 랩 전체화면 방지).
- **상단 HUD 전 구역 공통**: `#hud`(크레딧/에너지/인구/라운드/킬/시계, z20)는 `#gameArea` 안 고정 요소라 탭과
  무관하게 항상 뜸. 건설 탭에서 숨기던 규칙 제거. (CSS ~83, cstMode 규칙 ~1016)
- **사이드 배너 동반 상승**: 시트 올라오면 `#chatBar/#chatLog/#autoFab/#pbossBtn`이 `--sheetH`만큼 위로.
  `--sheetH`는 `_syncSheetLift()`가 열린 `.bp.on`의 offsetHeight로 세팅(리렌더 중 <20px 무시 가드). (CSS ~771-774)
- **화면 dim/스크림 제거**: 예전 `#sheetScrim`(반투명 오버레이+터치차단) **완전 제거**. 시트 열려도 위 화면
  상호작용(유닛/건물/줌/팬) 그대로 가능.
- **시트 열림/닫힘 규칙(핵심 규약)**:
  - 탭 진입 = `body.sheetOpen` 세팅. (`switchTab` ~6038: `toggle('sheetOpen', id!=='Build')`)
  - **같은 탭 재탭 = 시트 토글**. (`switchTab` 앞부분 ~6026)
  - **바깥(게임) 빈 땅을 빠르게 탭(누르고<400ms 뗌) = 시트 닫힘**. 유닛/건물 탭·박스드래그·핀치줌·팬·이동명령은
    각각 다른 분기라 시트 유지. (메인은 `onUp` ~9207에서 `closeSheet()` 호출)
  - `closeSheet()`(~7503)=`body.sheetOpen` 제거. `_syncSheetLift()`(~7499).
- **탭 전환 시 잔류 방지 교훈**: `#vBuild{display:flex}`(ID) 가 `.gview:not(.on){display:none}`(클래스)를 이겨서
  탭 떠나도 안 사라진 버그가 있었음 → **`#vXxx.on{display:flex}`로 반드시 `.on` 게이팅**. (CSS ~951)

### 핵심 함수/위치 (안정 앵커)
| 함수 | 대략 줄 | 역할 |
|---|---|---|
| `switchTab(id,el)` | ~6025 | 탭 전환 허브. gview/bp `.on` 토글, `body.sheetOpen`/`cstMode`, 탭별 렌더 호출 |
| `setInGame(on)` | ~7498 | `#phone.inGame` + `body.sheetOpen` |
| `_syncSheetLift()` / `closeSheet()` | ~7499 / ~7503 | 사이드 상승량 / 시트 닫기 |
| `refreshSelCard()` | ~6146 | **선택 상태 → 하단 패널 전환의 중심**(메인) |
| `updateAutoFab()` | ~6914 | 자동설정 FAB(렌더 루프 매프레임 호출) |
| `enterSandbox()` | ~9791 | 관리자 진입(로스터 배치 + 초기 상태) |

---

## 2. 메인 페이지 (Main 탭) — **기준 레퍼런스 (완료)**

다른 페이지들이 이걸 기준으로 맞춰야 함. 최종 구조/패턴:

- **경로/요소**: 뷰 `#vMain`(canvas `#cvMain`, 2365) · 시트 `#bpMain`(2623).
  - `#bpMain` 자식: `#stSelInfo`(직스용, hide) / `#defaultCmd`(홈: 유닛지정·판매 탭 = `#hsTabSel/#hsTabSell/#hsTabComb`) /
    `#unitCmd`(선택 유닛 프로필 `#scSingle`: `#uPortrait/#uName/#uType/#uHp/#uKill/#statGrid`).
- **캔버스 내용**: `drawMain('cvMain')`(~4179). 관리자에선 유닛 진열대(갤러리) — `placeSandboxUnits()`(~9773) +
  `SANDBOX_ROSTER`(~9766, 3종족×유닛) 로 `G.units` 배치, `G._sandboxRows` 라벨.
- **포인터**: `#cvMain`에 `onDown/onMove/onUp`(~9095/~9147/~9181) 바인딩. Main+Battle 공용.
  - 유닛 탭=선택(`selectOne`), 드래그=박스선택(`selectMany`), 두 손가락=줌/팬, 빈 땅 클릭=선택해제.

### 확립된 패턴 (★ 다른 페이지가 따라야 할 규약)
1. **무선택 = 아무것도 안 보임**: 하단 시트 내려가고(`body.sheetOpen=false`) 홈/기본 패널 숨김.
   관리자에선 예전 "유닛지정/유닛판매" 홈(`#defaultCmd`)을 **표시하지 않음**.
2. **대상 지정 = 프로필 시트 슬라이드업**: 유닛 선택 시 `body.sheetOpen=true` + `#unitCmd`(프로필)만 표시.
3. **선택 상태 구동은 `refreshSelCard()`에서**: 관리자(sandbox) 전용 분기가 들어가 있음(~6154 부근):
   ```js
   if(G.sandbox && G.tab==='Main'){
     const hasSel=(G.sel.length>=1 || !!en);
     document.body.classList.toggle('sheetOpen', hasSel); requestAnimationFrame(_syncSheetLift);
     document.getElementById('defaultCmd').classList.add('hide');           // 홈 패널 항상 숨김
     if(!hasSel){ document.getElementById('unitCmd').classList.remove('on'); renderUnits(); return; } // 무선택=아무것도
     // 선택됨 → 아래 unitCmd(프로필) 렌더로 진행
   } else { /* 일반 게임 기존 로직 그대로 */ }
   ```
4. **초기 상태 즉시 적용**: `enterSandbox()` 끝에서 `refreshSelCard()` 호출(~9802) → 진입 즉시 무선택 상태 반영.
5. **빈 땅 빠른 탭 = 시트 닫기**: `onUp`(~9207)에서 처리(위 1번 공통 규약).
6. **자동설정 깜빡임 해결 완료**: `updateAutoFab`의 `.act` 토글을 `!!(...)`로 감쌈(~6912). 원인은
   `G.auto.place/bossdeploy`가 undefined → 식이 undefined → `classList.toggle('act', undefined)`가 매프레임 토글.
   **교훈: `classList.toggle(name, cond)`의 `cond`는 반드시 엄격 불리언(`!!`)으로.**

**검증 완료치**: 진입/탭복귀 시 `sheetOpen=false`·`#defaultCmd` hidden. 유닛 선택 시 `#bpMain` 114px 프로필
슬라이드업(체력/공격/방어/사거리 표시). `.act` 프레임간 토글 사라짐.

---

## 3. 나머지 관리자 페이지 목록 (경로 + 메인 기준 수정할 것)

각 탭은 `switchTab(id)` 내부 분기(~6045~6060)에서 진입 처리됨. 공통적으로 **"무선택=시트 내려감/빈
상태, 대상 지정=프로필/상세 시트 슬라이드업"** 규약(§2 패턴 1~5)을 맞추는 게 목표.

### 3-A. 유닛뽑기 / **이펙트 랩** (Unit 탭) — 관리자에선 이펙트 테스트베드
- **경로**: 뷰 `#vUnit`(canvas `#cvUnit`, 2366) · 시트 `#bpUnit`(2668).
  - `#bpUnit` 자식: `#fxLabWrap`>`#fxLabGrid`(이펙트 유닛 그리드) / `#stBuildBp` / `#shopProfile` /
    `#prodHint` / `#gachaActions` / `#opsManual`.
- **진입/렌더**: `switchTab` Unit 분기(~6049) — `G.sandbox`면 `fxLabActivate()`(~11875), 아니면 일반 유닛뽑기.
  렌더 `fxLabRender(dt)`(~12080), 그리드 `fxLabRenderGrid()`(~11864), 이탈 `fxLabDeactivate()`(~11881).
- **메인 기준 수정할 것**:
  - 지금은 탭 진입 시 시트 자동 오픈 + 이펙트 그리드가 시트를 꽉 채움(항상 열림). 판단 필요:
    (a) 그리드가 이 탭의 "주 컨텐츠"면 자동 오픈 유지가 맞음(현재 42vh 캡됨). 그대로 두되 §4 공통만 적용.
    (b) "무선택=빈, 유닛 배너 탭=상세" 규약을 원하면 fxLab 그리드를 시트가 아니라 캔버스/상단으로 빼고,
        배너 탭 시 프로필 시트를 올리는 구조로 변경.
  - **먼저 유저에게 (a)/(b) 확인**(둘 다 유효한 설계). 기본 추천: (a) 유지 + 공통 패턴만.
  - `#shopProfile/#opsManual/#gachaActions`는 일반(비-sandbox) 유닛뽑기용 — 관리자에서 뜨면 숨길 것.

### 3-B. 업그레이드 (Upgrade 탭)
- **경로**: 뷰 `#vUpgrade`(canvas `#cvUpgrade`, 2367) · 시트 `#bpUpgrade`(2690).
  - `#bpUpgrade` 자식: `#stEconBp`(직스용) / `#upgHint`("건물 터치하면…") / `#upgList`(업그레이드 목록).
- **진입/렌더/입력**: `switchTab` Upgrade 분기(~6053) — `renderBldgs('vUpgrade',TECH,TECH_POS,null,selectUpg)`(~5928) +
  `drawUpg()`(~4332). 건물 선택 `selectUpg(id)`(~7241). 입력 `onUpgDown/Move/Up`(~9548/9554/9556), 박스 `drawUpgBox`(~9564).
- **메인 기준 수정할 것**:
  - **무선택 시** `#upgHint`("건물을 터치하면…")가 시트에 뜨는데 → 규약대로 **무선택=시트 내려감(빈)**.
    → Upgrade 진입 시 자동 오픈 끄고, `selectUpg`에서 대상 지정 시에만 `body.sheetOpen=true`.
  - **건물 지정 시** `#upgList`(업그레이드 목록)를 프로필 시트처럼 슬라이드업. `selectUpg`/무선택 해제 지점에
    `body.sheetOpen` + `_syncSheetLift` 토글 추가(메인 `refreshSelCard` sandbox 분기와 동형).
  - `onUpgUp`의 빈 곳 탭 분기에 `closeSheet()` 추가(메인 `onUp`과 동일 규약).

### 3-C. 플레이어 (Players 탭) — 관전
- **경로**: 뷰 `#vPlayers`(canvas `#cvPlayer`, 2368) · 시트 `#bpPlayers`(2699).
  - `#bpPlayers` 자식: `#playerProfile`(관전 유닛 프로필) / `#plGridWrap`>`#plGrid`(플레이어 그리드).
- **진입/렌더**: `switchTab` Players 분기(~6055) — `renderPlayers()`(~7294) + `drawPlayer()`(=`drawMain('cvPlayer')`, ~4382).
  선택 해제 `clearPlayerSel()`.
- **메인 기준 수정할 것**:
  - 관리자에서 이 탭의 용도 확인 필요(관전은 멀티 기능). 최소한 §4 공통(시트 규약/HUD) 정합만 맞추고,
    **무선택=`#plGrid`만/시트 내려감, 관전 유닛 선택=`#playerProfile` 슬라이드업** 형태로 정리.
  - 관리자에서 불필요하면 탭 자체를 숨기는 것도 옵션(현재 항상 노출).

### 3-D. 전투실험 (Battle 탭) — 관리자 전용(`#battleTab` 노출)
- **경로**: 뷰는 **Main과 공유**(`v'+(id==='Battle'?'Main':id)` → `#vMain`/`#cvMain`) · 시트 `#bpBattle`(2712) ·
  화면 오버레이 컨트롤 `#btCtl`(2372 부근, ▶전투/＋적/아군손상 등).
  - `#bpBattle` 자식: `.btPickHead` / `.btSplit`>`#btPicker`,`#btPickerFoe`(아군/적 유닛 피커).
- **진입/렌더**: `switchTab` Battle 분기(~6058) — `drawMain(); renderUnits(); renderBtPicker(); sbCombatUiSync()`.
  전투 로직 `sbCombat*`(전투실험 시뮬), 별도 전장 유닛 `G.btUnits`.
- **메인 기준 수정할 것**:
  - `#btCtl`은 화면 상단 오버레이라 시트 규약과 별개(유지). `#bpBattle` 피커를 **§2 패턴**에 맞춰:
    무선택=시트 내려감, 유닛 배치/선택 시 상세/피커 슬라이드업 검토.
  - 포인터는 Main의 `onDown/onUp`을 공유(이미 Battle 포함) → 빈 땅 탭 닫기 자동 적용됨. 확인만.

### 3-E. 건설 (Build 탭) — **이미 완료 (별도 시트 시스템)**
- **경로**: 뷰 `#vBuild`(2370: `#cstMain` 맵 + `#techMap3d` + `#cstPrev` + **자체 시트 `#btSheet`/`#btSheetBody`** +
  해제버튼 `#btDesel`) · `#bpBuild`는 **display:none**(미사용, CSS ~953).
- **특징**: `.bp` 시트가 아니라 **전용 `#btSheet`**(CSS ~1004, `bottom:0` of `#vBuild`, z30). `body.cstMode` 사용
  (HUD 아래 `.bmapTop top:58px`, 사이드/스크림 규약에서 제외). 렌더 `techPanelRender()`(~10455),
  진입 `techUIEnsure()`(~10387)/`techUIInit()`(~10321). 일꾼/유닛/건물 지정 → 커맨드 그리드, 일꾼 건설 흐름,
  3D는 `M3D.syncBuild`. 빈 맵 탭=시트 닫힘은 `techPtrUp`에서 자체 처리.
- **주의**: 건설은 위 공통 §4 중 "`.bp`/`body.sheetOpen`/스크림/사이드상승"에 **해당 없음**(자체 시스템).
  다른 탭 작업 시 건설을 건드리지 말 것. 건설을 더 손봐야 하면 `techPanelRender`/`techPtrUp` 기준.

---

## 4. 공통으로 적용할 변경 (모든 `.bp` 탭 — Unit/Upgrade/Players/Battle 반복)

건설(§3-E)을 **제외**한 각 탭에 동일하게:

1. **탭 진입 시 자동 오픈 여부 결정**: 기본 규약은 "무선택=닫힘". 현재 `switchTab`(~6038)이 진입 시
   `sheetOpen=true`(Build 제외)로 자동 오픈함 → **관리자에서 대상 없는 탭은 닫힘으로** 조정 필요.
   방법: 각 탭의 선택/무선택 핸들러(§3의 `selectUpg`, `renderPlayers` 등)에서 `refreshSelCard`처럼
   `document.body.classList.toggle('sheetOpen', hasSel); requestAnimationFrame(_syncSheetLift);` 를 세팅.
2. **무선택 = 기본/힌트 패널 숨김**: 각 시트의 안내/홈 요소(`#upgHint`, `#defaultCmd`, `#opsManual` 등)를
   관리자에선 `hide`.
3. **대상 지정 = 상세(프로필/목록) 슬라이드업**: 지정 시 해당 상세 요소만 `.on`/표시 + `sheetOpen=true`.
4. **빈 땅 빠른 탭 = 닫힘**: 각 탭 포인터 up 핸들러의 "빈 곳 탭" 분기에
   `if(document.body.classList.contains('sheetOpen') && (e.timeStamp-_downTime)<400) closeSheet();` 추가.
   (Main/Battle은 `onUp` 공유로 이미 적용. Upgrade는 `onUpgUp`에 추가 필요. Players/Unit은 해당 입력 경로 확인.)
5. **`classList.toggle(name, cond)`는 `!!cond`** 로 (undefined 토글 버그 예방 — §2 패턴 6).
6. **뷰 표시는 `#vXxx.on{...}`로 `.on` 게이팅** — ID 규칙이 `.gview:not(.on){display:none}`을 이기지 않게(§1 교훈).
7. **편집 후**: JS 문법검사 + Playwright로 (진입=닫힘 / 지정=슬라이드업 / 빈탭=닫힘) 3-스텝 실측 스크린샷.

---

## 5. 작업 순서 추천

1. **업그레이드(§3-B)** — 메인과 구조가 가장 유사(선택→상세). `refreshSelCard` sandbox 분기를 본떠
   `selectUpg`/무선택/`onUpgUp`에 시트 규약 이식. 가장 명확하고 효과 큼. **먼저.**
2. **전투실험(§3-D)** — 포인터를 Main과 공유해 빈탭닫기는 공짜. `#bpBattle` 피커만 규약 정합.
3. **유닛뽑기/이펙트 랩(§3-A)** — (a)자동오픈 유지 vs (b)선택형, **유저 확인 후** 진행.
4. **플레이어(§3-C)** — 관리자 용도 확인 후(불필요하면 탭 숨김) 최소 정합.
5. 마지막에 **전 탭 크로스체크**: 탭 간 이동 시 잔류/겹침 없는지, HUD 항상 상단, 탭 바 항상 최하단·불투명,
   시트 열림 상태에서 위 화면 상호작용 정상, 자동설정 미깜빡임.

> 각 페이지 착수 시: (1) 해당 `switchTab` 분기 + 시트/렌더 함수부터 읽기 → (2) §4 공통 7항 적용 →
> (3) Playwright 3-스텝 검증 → (4) 커밋(제목 `feat/fix(<tab>): …`, 끝에 `Co-Authored-By: Claude <noreply@anthropic.com>`).

---

## 6. 규칙/제약 (반드시 준수)
- 커밋/푸시는 **요청 시에만**. 브랜치 `claude/github-mobile-workflow-Qh2aK`. 푸시 `git push -u origin <branch>`(네트워크 실패 시 지수 백오프 재시도).
- PR은 명시 요청 시에만. 커밋/아티팩트에 모델 ID 넣지 말 것.
- 커밋 메시지 끝에 `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **일반 게임(비-sandbox) 동작을 깨지 말 것** — 관리자 변경은 `if(G.sandbox)` 분기로 격리.
- 건설 탭 자체 시트 시스템(`#btSheet`)은 `.bp` 공통 규약과 별개 — 혼동 금지.
