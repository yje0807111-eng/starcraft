# Claude Code Project Guidelines (Superpowers Style)

## Project Context (this repo)
- Deliverable: a single self-contained file `sc-ums-web.html` — a mobile StarCraft-style usemap (vanilla JS + inline CSS/HTML, Three.js 3D, Supabase realtime). No build step and **no test framework**.
- Therefore the **"TDD / tests first"** rule below maps to **behavioral verification in the live app**: use the browser preview (`preview_eval`, DOM/render checks, screenshots) to confirm behavior *before and after* every change. Never claim "done" without proof.
- After editing inline JS, **syntax-check** the non-module `<script>` (extract it and `new vm.Script(...)`).
- Edit with exact-string replacements; match the surrounding style and line endings.
- Commit only when asked; end commit messages with the `Co-Authored-By` trailer.

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

### 5. 📝 Final Review
- Before finishing, run a self-review:
    - Does the code match the plan?
    - Are there any hardcoded values or magic numbers?
    - Is the code readable and documented?
