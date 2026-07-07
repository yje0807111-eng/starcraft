# 관리자 페이지 작업 진행 상태 (PROGRESS)

> 이 파일 하나만 보고 새 세션에서 페이지별로 바로 이어갈 수 있도록 정리한 핸드오프 문서.
> 대상 파일은 **단일 파일** `sc-ums-web.html` (빌드 없음, vanilla JS + inline CSS/HTML, Three.js 3D `M3D` 모듈).
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

**JS 문법 검사**(편집 후 필수): 비-module `<script>`를 추출해 `new vm.Script(code)`.
```
node -e 'const fs=require("fs"),vm=require("vm");const h=fs.readFileSync("sc-ums-web.html","utf8");
const re=/<script(?![^>]*type=["\x27]module)[^>]*>([\s\S]*?)<\/script>/g;let m,bad=0;
while((m=re.exec(h))){if(!m[1].trim())continue;try{new vm.Script(m[1]);}catch(e){bad++;console.log(e.message);}}
console.log("errors:",bad);'
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
