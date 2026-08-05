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
