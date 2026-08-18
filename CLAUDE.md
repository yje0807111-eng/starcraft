# Claude Code Project Guidelines (Superpowers Style)

## Project Context (this repo)
- Deliverable: a single self-contained file `sc-ums-web.html` — a mobile StarCraft-style usemap (vanilla JS + inline CSS/HTML, Three.js 3D, Supabase realtime). No build step and **no test framework**.
- **Read `ARCHITECTURE.md` first** — section map (jump by banner search strings), global state, frame pipeline, M3D API, and a pitfall list. Update it when structure changes.
- **Read `DESIGN.md` before any visual change** — 확정된 스타일 규칙(각진 SF · 볼륨 3단 · 라운드 0/3/6/9 · 역할별 액센트). 값은 고민하지 말고 표에서 꺼낼 것. **일괄 치환 금지** — 화면을 만지는 김에 그 화면만 체크리스트를 통과시킨다(touch-it-fix-it).
- Behavioral verification = **`npm test`** (headless smoke suite: `test/smoke.js` + `test/run-smoke.mjs`, groups lobby/game/sandbox, ~10s) plus browser preview for visuals. Run it after every change; add a `step(...)` when you add a feature. Never claim "done" without it passing.
- After editing inline JS, **syntax-check** the non-module `<script>` (extract it and `new vm.Script(...)`).
- Edit with exact-string replacements; match the surrounding style and line endings.
- Commit only when asked; end commit messages with the `Co-Authored-By` trailer.

## 🧩 UI 단일 소스 원칙 (Single-Source UI — MANDATORY)
같은 UI를 두 번 만들면 반드시 어긋난다. 아래 규칙은 예외 없이 적용:

1. **재구현·복사 금지.** "메인에 있는 것을 가져와라/통합해라"는 요청 = 기존 DOM을 `cloneNode`로 재사용하거나 기존 함수를 호출. 마크업/SVG/CSS를 손으로 베껴 두 번째 구현을 만들지 말 것.
2. **"동일하게"의 검증 = 원본과 직접 diff.** 스타일 몇 개 비교로 통과 처리 금지 — 원본 요소와 innerHTML(값 제외)을 통째로 비교해서 동일함을 증명할 것. (선례: 스타일은 같았지만 단위 표기 `C/E/CP`가 빠져 다르게 보였음)
3. **새 UI가 필요하면 먼저 아래 레지스트리를 확인**하고, 기존 컴포넌트로 안 되면 새로 만들되 레지스트리에 등록. 비슷한 것을 새로 만들었다면 그건 버그다.
4. **낡은 사본 발견 시 보고.** 작업 중 중복 구현을 발견하면 사용자에게 알리고 통합을 제안.

### 🧹 잔상 금지 — 공용 자원을 빌리면 '지우고' 시작한다 (MANDATORY)
3D 렌더러·캔버스·모델 풀은 화면들이 **공유**한다. 새 화면이 이걸 빌려 쓸 때 이전 화면이 만든 것이 남아 있으면
그대로 배경에 비쳐 보인다(선례: HOME에 '미사일 포탑' 고스트 3개가 은은하게 남음).

- **숨기지 말고 삭제한다.** `visible=false`는 어딘가에서 다시 켜지면 도로 나타난다. 지우면 나타날 수가 없다.
- **빌릴 때와 돌려줄 때 양쪽에서** 지운다 — 한쪽만 하면 반대 방향 전환에서 샌다.
- 각 풀은 전부 '없으면 만든다' 구조라 원래 화면으로 돌아가면 알아서 재생성된다. 지우는 게 안전하다.
- 3D는 `M3D.clearGameModels()`(유닛) + **`M3D.clearIdlePools()`**(비콘·미건설 고스트·배치 고스트·건설 전시) 둘 다.
  `M3D.sync()`가 자동으로 숨겨 주는 풀은 일부뿐이라는 것을 전제로 짤 것.

### 공식 컴포넌트 레지스트리 (단일 소스)
| 컴포넌트 | 단일 소스 | 비고 |
|---|---|---|
| 자원 표시(크레딧/에너지/인구) | `#hudR` (메인 HUD) | 다른 화면은 cloneNode+숫자 치환 (예: `techMapRender`의 `.bres`) · 단위 `<i class="ru">C/E/CP</i>` 포함 |
| 프로필/커맨드 그리드 | `renderCmdGrid(host, model)` + `_cgSlotHTML`/`_cgInfoHTML` | 모든 프로필 시트(건설 탭·업그레이드 탭 공용) · 모델 객체로만 내용 제어 |
| 카드 높이/모드 | cm1(간소화 4그리드 1줄, 150px) ↔ cm2(최소화) | 2줄(cm0) 없음 · 5칸↑=페이지네이션(슬롯 위치 보존) |
| 생산 진행 | 파랑 바 `.cgBar`(앞 유닛 %) + 얇은 대기열 선 `.cgQBar`(수량·흰→빨강) | 연구도 동일: 남은 초 = 라벨 옆 `progTime` |
| 지정(선택) 표시 | 3D 하단 링 | 유닛·건물·라바·중립 자원(미네랄/가스) 전부 이것으로 통일 |
| 지정 해제 버튼 | 금지(⊘) SVG — 메인 `#deselTop` = 건설 `#btDesel` = 일시정지 카드 | 새 해제/중단 UI도 이 아이콘 재사용 |
| 확정/취소 플로팅 버튼 | `.bArmBtns` (▶ ok / ✕ cancel) | 배치 확정·재개·철거 공용 |
| 유닛 초상 | `_techUnitPortrait(uid)` | 카드·헤더·대기열 공용 |
| 프리뷰 패널 | `#cstPrev` + `techHidePreview()` | (구 cstHidePreview는 삭제됨) |
| 알림/사운드 | `toast()` / `playSfx()`·`playSfxT()` | |
| 세로 스크롤바 | `.uiScroll` (CSS 공용) | 스크롤 영역에 클래스만 추가 · `::-webkit-scrollbar`를 새로 정의하지 말 것 (Chrome 최신은 웹킷 의사요소를 무시하고 표준 `scrollbar-width`/`scrollbar-color`만 적용 → 화면마다 굵기가 달라지는 원인이었음) |
| **재화 아이콘**(미네랄·가스·젬·인구) | **`resIco(key, cls)`** → `assets/icons/res_*.webp` | ⛔ **이모지를 임의로 넣지 말 것.** 한글 이름으로도 찾는다(`resIco('미네랄')`=`resIco('mineral')`) · 새 UI에서 재화를 표시할 땐 무조건 이 함수 · 상단 재화 바(`#curBar`)·인게임 HUD와 같은 그림이 나온다 |
| 상점 | `#shopScreen` + `renderProfGacha()` | 전용 화면(팝업 아님) · 마을 '상점' 구역도 같은 화면으로 이동(`TOWN_ZONES.gacha.screen='shop'`) · 젬 = 유일한 현질 재화 |
| 정비(장비·펫·동료) | `#gearScreen` + `renderGear()` | 전용 화면 · 내용은 **전부 기존 렌더러 호출**: 장비=`renderProfGear()`(마을 장비창과 같은 함수) · 펫=`_shopPetPanel()`(상점 '보유 펫'과 같은 함수) · 동료=아직 시스템 없음(HOME 건설로 안내) |
| 보유 펫 목록 | `_shopPetPanel(note)` | 상점 ④ 구역 = 정비 '펫' 탭 — 한 함수 |
| 토벌 입구 | HOME 스킬 바(`renderHbBar()`)의 **토벌** 버튼 → `openDungeonHub()` 팝업 | 네비에서 뺐다(2번 칸은 정비) · 다른 화면에서 부르면 먼저 `openHome()` |
| 상자(목록 판) | `.msPanel` | 유즈맵 목록 · 정비 · 캐릭터 공용 |
| **방향·증감 버튼(◀▶)** | **`.arwBtn` + `data-arw="l\|r"`** (`paintIcons`가 함께 채운다) | 기본 = **글리프만**(판·선 없음 · 그림자로 띄움 · 터치 영역 30px 유지) · 판이 필요한 자리에만 `.framed`(모서리 컷 테두리) · 새 화살표 SVG를 마크업에 직접 박지 말 것 |
| 로비 팝업 껍데기 | **`_lobbyOv(id, onClose)`** + `.ptInviteOv.top` / `.ptInviteCard` / `.ptInviteHead` | 친구 초대·친구 추가·파티 찾기 공용 · `#phone`에 붙여 유즈맵 도크와 마을 시트 어느 쪽에서 열어도 보인다 |
| 친구 목록 | `renderFriendList()` → `.ptHead`/`.ptTitle`(파티 머리줄과 같은 것) + `.foList` | 온라인/오프라인 **섹션 라벨 없음** — 정렬(`friendSortCmp`)이 온라인을 위로 올리고 오프라인은 `.foRow.off`(어두운 상자)로 갈린다 |
| 친구 추가 | `openFriendAdd()` → `#foAddOv` | 목록 위가 아니라 팝업 · 검색 id(`#foSearch`/`#foSearchResult`)는 그대로라 `friendSearch()`/`friendAdd()` 재사용 |
| 파티 게시판(찾기·만들기) | `openPartyFind()` → `#ptFindOv` + `pbRooms()`/`pbJoin()`/`pbCreate()` | 파티 탭의 **이전 단계** · 파티가 없으면 자동으로 뜬다 · 맵과 무관한 자유 파티 |
| 목록 고르는 판(방 찾기·파티 찾기) | `.rmCard` + `.rmHead`/`.rmNum`/`.rmList`+`.roomItem`/`.rmBtns` | 방 찾기(`#rooms`)가 원본 · 파티 찾기는 이 컴포넌트를 그대로 빌린다(딤만 `.pfOv`) · **새 목록 판을 만들지 말 것** |
| **일일 퀘스트** | `openDaily()` → `#hbDailySheet` + `renderDaily()` | 더보기 ☰ > 일일 퀘스트 · 하루 5개 + 주간 25개 |
| **출석** | `openAtt()` → `#hbAttSheet` + `renderAtt()` | 더보기 ☰ > 출석 · **퀘스트와 화면이 다르다**(같은 판에 탭으로 묶지 말 것 — 2026-08-14 분리) |
| 일일 진행 계측·보상 | **`dqNote(kind, n)`** / `dqGive(rw)` | 출석·퀘스트가 함께 쓰는 뒷단 · 새 계측 지점이 생기면 `dqNote` 한 줄만 넣는다 |
| HOME 팝업 껍데기·버튼 색 | `.hbModal` / `.hbmCard` / `.hbRow` · 버튼 면색 토큰은 `.hbModal{--btnA/B/C}` | 새 HOME 팝업을 만들 때 `#새시트 .ecGo` 같은 선택자를 **덧붙이지 말 것** — `.hbModal` 하위면 자동으로 같은 물성·회색톤이 된다 |
| 세그먼트 이동 바(한 구역 안에서 나뉘는 네비 = **모든 탭 띠**) | **`segNavHTML(items, i, act)`** → `.pdSeg`/`.pdSegInd`/`.pdSegBtn` | 장비창 섹션 바(장비·장신구) = 사냥터 업그레이드 탭(내 캐릭터·동료·건물·펫) = 유즈맵 정렬 띠(인기순·신규·추천·즐겨찾기) — 한 함수 · **글자만**(아이콘을 같이 넣으면 한 덩어리로 가운데 정렬돼 글자가 밀린다) · 생김새도 공용 규칙이 전부 갖는다(각진 3px · 검정 판 · 밑변 1px 광원) · 화면이 덮는 건 광원 색 `--segCol` 하나 · 안쪽 틈은 `--pad` 변수 하나가 단일 소스(계산식을 복사해 박지 말 것) |

> **아이콘 일반 원칙:** 새 UI를 만들 때 **기존 에셋을 먼저 찾아 쓴다**(`assets/icons/` — 재화 4종 · `buildings/` 52 · `skills/` 28 · `upgrades/` 24). 같은 뜻의 아이콘이 이미 있으면 그것을 쓰고, 없을 때만 대체 표기를 쓴다.

## Scope — when to run the full workflow (operating mode: A)
Scale the process to the change:
- **Substantial work** (new feature, gameplay system, architecture, multi-step change — e.g. the 직스/strike combat system): run the FULL workflow below — brainstorm → clarify → propose 2-3 approaches → get approval → plan → implement → verify → review.
- **Small, unambiguous changes** (numeric/size/layout/color tweaks, copy edits, obvious bug fixes — e.g. "make the temple smaller", "widen the road"): proceed directly, then verify in the live app. No clarifying questions or approach proposals needed.
- When unsure which bucket a request is in, ask one quick question instead of assuming.

## Core Philosophy
You are a Senior Software Engineer following the "Superpowers" methodology. You do NOT just write code; you engineer solutions. You must follow this strict workflow for every feature request:

1.  **Brainstorming & Requirements**: Clarify intent before planning.
2.  **Planning**: Create a detailed plan before coding.
3.  **TDD**: Write tests first, then implementation. *(In this repo: verify behavior in the live app first — see Project Context.)*
4.  **Review**: Self-review code against the plan and best practices.

## Rules & Workflow

### 1. 🧠 Brainstorming First (No Code Yet)
- When I ask for a new feature, DO NOT write implementation code immediately.
- Instead, ask clarifying questions to narrow down requirements.
- Propose 2-3 different architectural approaches with trade-offs.
- Wait for my approval on the approach.
- *(Small, unambiguous tweaks may proceed directly.)*

### 2. 📋 Plan & Design
- Once an approach is selected, write a step-by-step implementation plan.
- List all files to be created or modified.
- Define the exact function signatures and data structures.
- **Output:** A distinct "Implementation Plan" section.

### 3. 🔴🟢 Test-Driven Development (TDD)
- **Step 1 (Red):** Write a failing test case that covers the requirement. Run it to confirm failure.
- **Step 2 (Green):** Write the *minimum* code necessary to pass the test.
- **Step 3 (Refactor):** Clean up the code while ensuring tests still pass.
- **Constraint:** Never write implementation code without a corresponding test.
- *(This repo has no test runner → substitute live-app verification: capture current behavior, make the minimum change, re-verify the new behavior.)*

### 4. 🔍 Systematic Debugging
- If a test fails or an error occurs, do not blindly try fixes.
- **Phase 1:** Analyze the error log and stack trace.
- **Phase 2:** Formulate a hypothesis about the root cause.
- **Phase 3:** Create a reproduction script/test to prove the hypothesis.
- **Phase 4:** Apply the fix and verify.

> **⛔ 증상부터 만지지 말 것 — 흐름부터 파악 (MANDATORY).**
> 버그·이상 동작 요청이 오면, **관련 코드 경로 전체를 먼저 끝까지 읽고 근본 원인을 특정한 뒤** 손댄다. 증상만 보고 눈에 띄는 값·파라미터부터 조정하는 것 금지.
> - 특히 **상호작용/입력 버그**(터치·롱프레스·드래그·선택 등)는 관련 핸들러 흐름(예: `techPtrDown → techPtrMove → techPtrUp`, 그리고 tick 루프)을 **먼저 통째로 따라가** 어느 지점이 상태를 덮어쓰는지 찾는다.
> - "왜 이 증상이 나는가"를 한 문장으로 설명할 수 없으면 아직 고치지 마라.
> - 선례: 벙커/커널 입장 버그 — 실제 원인은 이동 명령(`_btCmd`)이 입장 명령(`_boardTgt`)을 취소하던 것이었는데, 증상만 보고 throttle 간격부터 손대서 한 번 헛돌고 오히려 악화됨. 처음부터 포인터 핸들러 흐름을 읽었으면 한 번에 끝났을 일.

### 5. 📝 Final Review
- Before finishing, run a self-review:
    - Does the code match the plan?
    - Are there any hardcoded values or magic numbers?
    - Is the code readable and documented?
