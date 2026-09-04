# Claude Code Project Guidelines (Superpowers Style)

## 🗣 말하는 방식 (MANDATORY)
사용자에게 답할 때는 **쉽고 간단하게** 말한다. 여러 번 요청받은 사항이다.

- **결론부터 한두 줄.** 그 다음에 필요한 만큼만 덧붙인다.
- **표와 수식은 꼭 필요할 때만.** 숫자를 나열하기 전에 "그래서 무슨 뜻인지"를 한 문장으로 먼저 말한다.
- **과정 중계 금지.** 무엇을 어떻게 뒤졌는지가 아니라 **무엇을 알아냈는지**를 말한다.
- 전문 용어를 쓸 거면 **그 자리에서 한 줄로 풀어 준다.**
- ⚠ 다만 **나쁜 소식·불확실한 것은 줄이지 말고 그대로** 말한다. 짧게 말하라는 것이지
  숨기라는 것이 아니다. "안 쟀다 / 틀렸다 / 못 고쳤다"는 분명하게.
- 문서·주석은 이 규칙의 대상이 아니다(거기는 지금처럼 촘촘하게 쓴다).

## Project Context (this repo)
- Deliverable: a static file set — `sc-ums-web.html` (markup only, ~900 lines) + **`css/` 5 files** + **`js/` 19 files** — a mobile StarCraft-style usemap (vanilla JS, Three.js 3D, Supabase realtime). No build step and **no test framework**.
  - **Find the right file first: `ARCHITECTURE.md` §1 파일 지도.** Don't grep the HTML for logic — it holds only markup now.
  - `js/*.js` are **classic scripts** sharing one global scope, executed in tag order. ⛔ Never reorder the `<script>` tags, never convert them to `type="module"`, and remember declarations hoist **within a file only**.
- ⚔ **캠프 전투는 `js/21-camp-battle.js` 가 소유한다**(2026-08-31). `campStepUnits(dt)` 한 함수가 표적 선정·자리·이동·사격을 다 한다. ⛔ `js/18-strike.js`(유즈맵 오토배틀)를 고치지 말 것 — 거기서는 **부품만** 가져온다(`strikeHit`·`strikeMoveToward`·`strikeSeparate`·`strikeSkillTick` …). ⛔ 옛 이동 장치 넷(`campPostSnap`·`campPostStep`·`campEngageStep`·`campLeash`)은 `19-camp.js` 에 남아 있지만 **배선이 끊겼다** — 되살리면 미는 주체가 둘이 되어 유닛이 덜덜 떤다(실측 96회/유닛 → 6.5회). 구조·실측은 `ARCHITECTURE.md` §「⚔ 캠프 전투」.
  - 🎬 **전투 움직임을 만졌으면 `node scripts/camp-trace.mjs` 로 눈으로 볼 것** — 궤적 그림 + 떨림·사거리 수치. 이 프로젝트는 움직임을 숫자로만 좇다가 네 번 헛짚고 전부 되돌렸다. 그다음 `scripts/camp-bench.mjs` 로 밸런스를 다시 잰다(이동이 바뀌면 화력이 바뀐다).
- 🏕 **HOME 메인은 「캠프」다**(`js/19-camp.js` · 2026-08-23). 옛 **사냥터(웨이브 방어)를 대체했다** — 새로 만든 게 아니라 관리자 건설 시스템을 빌려 쓴다. 구조는 `ARCHITECTURE.md` §「🏕 캠프」.
  - ⛔ `js/08-hunt.js`(2953줄)는 **던전 1~10 데이터·마을 때문에 남아 있을 뿐**이다. HOME 게임플레이를 여기서 고치지 말 것 — 화면에 안 나온다.
  - ⚠ 문서·코드의 **「사냥터」는 대부분 옛 이름**이다(102곳). 다만 화면의 **「사냥터 업그레이드」(`.hmUpg`)와 `UM_*` 경제 상수는 살아 있는 이름**이라 일괄 치환 금지.
- **Read `GAME_DIRECTION.md` before any 사냥터(=지금의 캠프) gameplay/성장 decision** — 이 게임을 *어떤 게임으로* 만들 것인가의 단일 소스(재미·성장 축·확장·유보). 전투 성장은 추상 카드가 아니라 **`TECH_TREE` 연구**다. ⚠ `HUNT2.md`(구현 부록)는 그보다 먼저 쓰여 **일부 결정이 무효**다 — 무효 목록은 `GAME_DIRECTION.md` §6.
- 🗄 **안 쓰는 코드는 `js/99-attic.js`(다락)에 있다 — 목록은 `ATTIC.md`.** 옛 화면·옛 디자인을 되살리기 전에 거기부터 볼 것. ⛔ 지우지는 않는다(유보는 삭제가 아니다). 되살아나면 스모크 「다락」이 잡는다.
- **Read `ARCHITECTURE.md` first** — section map (jump by banner search strings), global state, frame pipeline, M3D API, and a pitfall list. Update it when structure changes.
- **Read `DESIGN.md` before any visual change** — 확정된 스타일 규칙(각진 SF · 볼륨 3단 · 라운드 0/3/6/9 · 역할별 액센트). 값은 고민하지 말고 표에서 꺼낼 것. **일괄 치환 금지** — 화면을 만지는 김에 그 화면만 체크리스트를 통과시킨다(touch-it-fix-it).
  - 🎬 **화면 전환(페이드·디졸브·줌)을 만진다면 `DESIGN.md` §5.5 체크리스트를 먼저 읽을 것.**
    로딩→종족 선택 전환 하나에 몇 시간을 썼고, 같은 자리에서 네 번 넘어졌다(2026-08-27).
    요지: **연출은 프레임을 저장해서 눈으로 본다**(`SHOT_SAVE=1 node scripts/shot.mjs flick`) —
    평균 밝기·시점 표본은 배경 크기 변화·작은 UI·한 프레임짜리 섬광을 **전부 놓친다**.
    그리고 투명도로 안 고쳐지는 전환 버그는 대개 **z 축(가림 순서)** 이다.
- **Read `ART.md` before generating any image asset** — 장면 이미지(유즈맵 키 아트·배경)의 모델·비율·프롬프트 템플릿·후처리 규격. **프롬프트를 새로 쓰지 말 것**: 고정 블록 4개를 그대로 복사하고 장면 한 칸만 바꾼다. 세션이 바뀌어도 같은 스타일이 나와야 하므로 이 문서가 단일 소스다. 계열이 셋이다(유즈맵 키 아트 §2~§7 · 타이틀 배경 §8 · **유닛 참고 아트 §9**) — 어느 계열인지 먼저 정할 것. 새로 뽑았으면 그 계열 절에 전문을 추가하고 **`node scripts/art-lint.mjs`** 로 규격(고정 블록·금지 표현·맵 표↔`UMAP_BG` 일치)을 확인할 것.
- **Read `RACES.md` before touching any race/unit/building number** — 5종족 오각형 상성의 단일 소스(설계·실수치·상수·측정 결과). ⚠ 상성은 **모델로 추정하지 말고** `node test/race-matchup.mjs` 로 실제 엔진을 돌려 잰다 — 여기서 자체 웨이브 모델을 네 번 짰다가 전부 폐기했다. 종족을 오토배틀에 넣을 땐 `ARCHITECTURE.md` §1 의 "조용히 빠지는 표" 목록(`SB_ATK_MODE`·`UNIT_COMBAT_CLASS`·`FXLAB_AIR`·`TECH_BLDG_UNIT`)을 체크리스트로 쓸 것.
- **Read `GEM.md` before touching 젬·상점·부스트·환생 증폭** — 현질 재화의 자리(정체·획득·용도 둘·안전장치). ⛔ 젬으로 **영구 능력**을 팔거나 배율을 **곱해서 중첩**하면 지수 축이 둘이 되어 폭주한다. 상점의 장비·펫·동료 꾸러미는 **화면에서만 빼고 코드는 남긴다**(유보 규칙).
- 📊 **수치·방향 문서의 층위(2026-08-25 정리)** — 헷갈리면 이 순서다.
  1. `GAME_DIRECTION.md` — ***왜***(재미·성장 축·확장·유보). 최상위.
  2. `HUNT_R1.md` — ***설계 출발점***(1회차·환생 수치). ⚠ 규칙이 아니라 출발점 — 실측이 이긴다.
  3. `BALANCE.md` — ***실측 확정치***(지금 값·기준선·재는 방법). 값을 바꿨으면 여기를 갱신.
  4. `HUNT2.md` — ***구현 부록***(SC2식 기지 운영 = 지금의 캠프). 일부 결정 무효(목록은 `GAME_DIRECTION.md` §6).
  5. `GEM.md` — 젬·상점·환생 **증폭**만. 환생 규칙 자체는 `HUNT_R1.md` §4.
- **Read `BALANCE.md` before touching any growth/difficulty number** — 성장 축 넷의 역할 · 환생 규칙 · 지금 상수 · **실측 기준선** · 남은 일. ⚠ 값을 바꿨으면 **해석적 추정으로 끝내지 말고** 거기 §4 의 엔진 자동 플레이로 다시 재고 표를 갱신할 것 — 이 프로젝트에서 모델 추정은 여러 번 크게 빗나갔다(회수 시간·손익분기·레벨 간격). *왜 그렇게 설계했는가*는 `ARCHITECTURE.md` 가 단일 소스다.
- Behavioral verification = **`npm test`** (headless suite: `test/smoke.js` + `test/run-smoke.mjs`, groups lobby/game/sandbox **+ `duo(2인)`** = two real clients relayed to each other via `test/duo.mjs`) plus browser preview for visuals. Run it after every change; add a `step(...)` when you add a feature. Never claim "done" without it passing.
  - ⚠ **Touching anything multiplayer? The `duo` group is the only thing that catches a send/receive shape mismatch** — a one-page test with a stubbed channel never will. See `ARCHITECTURE.md` §8 「멀티 검증」.
- After editing JS, **syntax-check** the file you touched: `node --check js/<file>.js` (module file: `node --input-type=module --check`). No more extracting from the HTML.
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
| **확인 팝업(정말 하시겠습니까)** | **`.ecCard` + `.ecTitle`/`.ecMsg`/`.ecBtns` + `.ecCancel`/`.ecGo`** | 게임 나가기(`#exitConfirm`) = 로그아웃(`#logoutPanel`) — 한 컴포넌트(2026-08-27) · 되돌릴 수 없는 주 동작은 **붉은 글자**(`.ecGo`) · ⛔ 확인창을 새로 만들지 말 것 · ⚠ 설정에서 부르는 확인은 **`#phone` 직속 + z-index 97**(설정이 게임 밖에서 95라 그 아래면 통째로 가려진다) |
| 확정/취소 플로팅 버튼 | `.bArmBtns` (▶ ok / ✕ cancel) | 배치 확정·재개·철거 공용 |
| 게임 진입 로딩 | `#gsRoot` + `gameStartCountdown()` · `.teamed`(팀전) / `.solo`(개인) | 카드 덱 한 화면이 협동·팀전·개인을 다 맡는다 · 팀 색=카드 윗변 / 준비=밑변 · 초록은 '준비 완료' 전용 · 초상 `avatarHTML()` · 버튼 `.actBtn` |
| **액션 버튼(확정·취소·시작)** | **`.actBtn`** + `.pri`(주 동작) / 기본(하위) / `:disabled`(잠김) | **옅은 면 + 1px**(2026-08-26 · B4안) · 위계는 **면과 테두리의 밝기**(부 5%/.1 · 주 14%/.32 + 흰 글자) · ⛔ 볼록한 판·밑변 광원·`--font-ti`(Jua) 를 되돌리지 말 것 · 새 버튼에 면·테두리를 따로 쓰지 말고 클래스만 붙일 것(화면이 덮는 건 크기뿐) · `.cpBtns` 안에서 취소는 `.sub` · **팝업 버튼(`#ovBtn`/`#ovBtn2`/`.ecGo`/`.ecCancel`)도 같은 얼굴**(36px) — 로그인 `.authBtn`/`.authGuest` 만 제 디자인을 갖는다 |
| 유닛 초상 | `_techUnitPortrait(uid)` | 카드·헤더·대기열 공용 |
| 프리뷰 패널 | `#cstPrev` + `techHidePreview()` | (구 cstHidePreview는 삭제됨) |
| 알림/사운드 | `toast()` / `playSfx()`·`playSfxT()` | |
| **채팅 입력줄** | **`.msChatBar` + `.msChatSend`** (`css/40-social.css`) | 유즈맵 하단 도크 = 대기실 — 한 컴포넌트(2026-08-27 통일 · 옛 사본 `.lbChatBar` 는 없앴다) · 범위 배지(`.msScopeDD`)는 **선택 슬롯**이다(대기실은 고를 범위가 하나뿐이라 뺐다) · 전송은 **중립 밝은 회색** — ⛔ 빨강으로 되돌리지 말 것(대기실의 빨강은 「시작」 주 동작의 색) · ⚠ 인게임 `#chatBar` 는 **다른 것**이다(전장 위에 떠서 접히는 말풍선) |
| **인게임 채팅바** | `#chatBar` + `chatToggle()`/`chatOpenBar()`/`chatFoldBar()` | 접힘(말풍선 44px) ↔ 열림(`[∨｜입력｜전송]` 한 상자) · **유즈맵 안 전 구역**에 있다(캠프만 제외) · ⛔ 열려도 왼쪽 ∨ 를 없애지 말 것(접을 방법이 사라진다) · 상시 청록·붉은 밑변 광원 금지 · ⚠ 구역마다 시트가 다른 요소다(`.bp` ↔ 건설 `#btSheet`) — `_syncSheetLift()` 가 갈라 잰다 |
| 세로 스크롤바 | `.uiScroll` (CSS 공용) | 스크롤 영역에 클래스만 추가 · `::-webkit-scrollbar`를 새로 정의하지 말 것 (Chrome 최신은 웹킷 의사요소를 무시하고 표준 `scrollbar-width`/`scrollbar-color`만 적용 → 화면마다 굵기가 달라지는 원인이었음) |
| **재화 아이콘**(미네랄·가스·젬·인구) | **`resIco(key, cls)`** → `assets/icons/res_*.webp` | ⛔ **이모지를 임의로 넣지 말 것.** 한글 이름으로도 찾는다(`resIco('미네랄')`=`resIco('mineral')`) · 새 UI에서 재화를 표시할 땐 무조건 이 함수 · 상단 재화 바(`#curBar`)·인게임 HUD와 같은 그림이 나온다 |
| 상점 | `#shopScreen` + `SHOP_SECS` (추천 · 젬 상점 **두 칸**) | 캠프 기준 재편 2026-08-31 · 옛 5칸(한정구매·뽑기·재화·패키지·충전)은 사냥터 기준이라 **화면에서만 뺐다**(코드는 남음) · 캠프 지갑에 넣는 유일한 입구는 `campAddRes()` — ⛔ `PROF().pcoin` 은 옛 지갑이라 캠프와 안 통한다 · 팩 배수는 **합**(GEM.md §5-2) · 젬 = 유일한 현질 재화 |
| 정비(장비·펫·동료) | `#gearScreen` + `renderGear()` | 전용 화면 · 내용은 **전부 기존 렌더러 호출**: 장비=`renderProfGear()`(마을 장비창과 같은 함수) · 펫=`_shopPetPanel()`(상점 '보유 펫'과 같은 함수) · 동료=아직 시스템 없음(HOME 건설로 안내) |
| 보유 펫 목록 | `_shopPetPanel(note)` | 상점 ④ 구역 = 정비 '펫' 탭 — 한 함수 |
| 토벌 입구 | HOME 스킬 바(`renderHbBar()`)의 **토벌** 버튼 → `openDungeonHub()` 팝업 | 네비에서 뺐다(2번 칸은 정비) · 다른 화면에서 부르면 먼저 `openHome()` |
| **유즈맵 하단 채팅 접기** | `.msDockBar` + `mapDockToggle()`/`mapDockPeek()` | 한 요소가 두 모습 — 접힘=줄 전체(마지막 채팅+▲) / 펴짐=윗변 15px 손잡이(▼) · 접힌 줄은 `#msChat` 마지막 줄의 **복제**(채팅 렌더러는 하나) · 상태는 `nm_mapdock` |
| 상자(목록 판) | `.msPanel` | 유즈맵 목록 · 정비 · 캐릭터 공용 |
| **방향·증감 버튼(◀▶)** | **`.arwBtn` + `data-arw="l\|r"`** (`paintIcons`가 함께 채운다) | 기본 = **글리프만**(판·선 없음 · 그림자로 띄움 · 터치 영역 30px 유지) · 판이 필요한 자리에만 `.framed`(모서리 컷 테두리) · 새 화살표 SVG를 마크업에 직접 박지 말 것 |
| 로비 팝업 껍데기 | **`_lobbyOv(id, onClose)`** + `.ptInviteOv.top` / `.ptInviteCard` / `.ptInviteHead` | 친구 초대·친구 추가·파티 찾기 공용 · `#phone`에 붙여 유즈맵 도크와 마을 시트 어느 쪽에서 열어도 보인다 |
| 친구 목록 | `renderFriendList()` → `.ptHead`/`.ptTitle`(파티 머리줄과 같은 것) + `.foList` | 온라인/오프라인 **섹션 라벨 없음** — 정렬(`friendSortCmp`)이 온라인을 위로 올리고 오프라인은 `.foRow.off`(어두운 상자)로 갈린다 |
| 친구 추가 | `openFriendAdd()` → `#foAddOv` | 목록 위가 아니라 팝업 · 검색 id(`#foSearch`/`#foSearchResult`)는 그대로라 `friendSearch()`/`friendAdd()` 재사용 |
| 파티 게시판(찾기·만들기) | `openPartyFind()` → `#ptFindOv` + `pbRooms()`/`pbJoin()`/`pbCreate()` | 머리줄 **`파티 찾기` 버튼으로만** 연다(자동 노출 금지) · 맵과 무관한 자유 파티 |
| **캠프 종족 선택** | **`#campRaceOv`** (전체 화면 · 판 없음 · `CAMP_RACE_ORDER` 3종족) | DESIGN.md 전환 기록 2026-08-24 · 위는 전투 미리보기 자리(빈 칸) · ⛔ 팝업(`.hbModal`)으로 되돌리지 말 것 |
| 대기실 종족 선택 | `#lbRaceSec` + `segNavHTML(STK_RACE_ORDER)` → `setLobbyRace()` | 입구는 이 띠 **하나뿐** · 슬롯 칩(`.lbRace`)은 읽기 전용 · 종족 없는 유즈맵은 `.lbRaceLk` 안내로 대체 |
| 난이도 고르기(선택 화면·방 만들기) | `.sdStepRow`/`.sdStepTx`/`.sdDots` + 상세 판 + `.sdInf`(무한 모드) | 개인 플레이 난이도 선택(`#soloDiffPanel`)이 원본 · 방 만들기가 그대로 빌린다 · ⛔ 화면별 난이도 UI 를 새로 만들지 말 것 |
| **무장 칸(계열 연구)** | `CAMP_ARM_TREE`(20-camp-research.js) — 계열마다 **네 축**: 공격력 `atk` · 공격속도 `as` · 체력 `def` · 방어력 `dr` | ⚠ `def` 는 표 이름이 「…방어력」이지만 캠프에서 하는 일은 **체력**이다(HUNT_R1 §3-4) — 화면 라벨만 「체력」으로 덮는다 · ⚔ `as`·`dr` 은 **캠프 전용 연구**라 `CAMP_ARM_ADD` 가 `TECH_TREE` 에 주입한다(⛔ 15-tech-data.js 를 직접 고치지 말 것 — 관리자 건설과 공유) · 노출은 `_techResList`(16-build.js)가 `camp` 플래그로 거른다 · 🛡 방어력은 **받는 피해 −1.5%/레벨(최대 −60%)** 이고 구현은 **체력 배수 환산**이다(엔진 armor 는 감산이라 공격력 1짜리가 무력화된다 — HUNT_R1 §3-1) · 배선은 `UNIT_UPG`(11-cmdcard.js) → `campResLv` → `campScaleAllies` 셋이 이어져야 한다(스모크가 넷 다 잰다) · ⏫ **한 번에 여러 레벨**(×1 → ×5 → MAX)은 **자원 칸과 무장 칸이 함께 쓴다**(2026-09-03 · ⛔ 자원용 배수를 따로 두지 말 것 — 상태는 `_armMul` 하나 · 자원은 **미네랄**로, 무장은 **가스**로 MAX 를 잰다 · 자원의 뒷단은 `campUpgDry`/`campUpgAfford`/`campUpgBuyN`(19-camp.js)이고 비용은 **campUpgCost 를 레벨마다 다시 물어본다** — ⛔ 식을 새로 쓰지 말 것) — 트레이 오른쪽 위의 **칸 하나를 눌러 돌린다**(`m.topRight` · 껍데기는 **글리프 버튼 `.cgGly`**(옅은 면 · ⛔ **`onclick` 으로 달지 말 것** — 트레이도 칸과 **같은 위임**을 타야 손가락에서 눌린다: `campResRoot` 의 `pointerdown`/`pointerup` 쌍 + `data-armmul`/`data-armback`) — 판·테두리 없이 아주 옅은 면만(2026-09-03 · 목업 camp-arm-tray-thin-8 ④안 · ⛔ 붉은색을 넣지 말 것: 그건 칸의 신호다) · 순서는 **[배수][뒤로]** 이고 둘 다 `m.topRight` 한 칸에 담는다(`m.back` 을 쓰면 왼쪽으로 간다 — 공유 코드라 순서를 못 바꾼다) · ⛔ 버튼 셋으로 되돌리지 말 것 — 트레이는 판 밖이라 칸이 늘수록 전장을 가린다)이고 `campArmMulN` → `techDoResearch(bk, rk, n)` → `rj.n` 으로 간다 — **클릭만 줄이고 시간은 안 줄인다**(n 레벨이면 연구 시간도 n 배 · ⛔ 「돈만 내고 즉시」로 만들지 말 것) · 값은 레벨마다 다르므로 **한 칸씩 더해** 합친다 · MAX 는 지금 가진 가스로 살 수 있는 만큼(`campArmAfford` · 상한 `CAMP_ARM_MAX_STEP`) · 아이콘은 `CAMP_ARM_ICO`(공격속도 `up_atkspd` · 방어력 `up_carapace` 공용 — ⛔ `up_speed` 는 **부츠**다) |
| 오토배틀 대전 설정 | `STK_OPTS`(상하한 표) + `STK_PRESETS` + `renderCpMode()` | 상하한·기본값은 표 한 곳에서만 · 엔진 반영은 `MAP_CFG_OVR` → `mapCfg` 한 입구(시작 때 심고 로비 복귀 때 반납) |
| 목록 고르는 판(방 찾기·파티 찾기) | `.rmCard` + `.rmHead`/`.rmNum`/`.rmList`+`.roomItem`/`.rmBtns` | 방 찾기(`#rooms`)가 원본 · 파티 찾기는 이 컴포넌트를 그대로 빌린다(딤만 `.pfOv`) · **새 목록 판을 만들지 말 것** · 행 밑변 광원 = `--dc`(난이도 색, 없으면 중립) · 하단은 `.actBtn`(주 동작 길게 + `.sq` 38px 둘) |
| **캠프 단계·라운드 표시** | `#curTitle` 칩(`curPaintChip()` · `js/12-appshell.js`) | **한 줄 · 가운뎃점**(`잊혀진 회랑 · 30/50` + ⌄ · 2026-09-03 사용자 확정 · 목업 `docs/mock/camp-chip-cmd-8.html` 5안) — ⛔ **판(면·테두리)·왼쪽 광원 띠·청록(--hud)을 되돌리지 말 것**: 좌상단만 색이 갈려 하단 구역과 안 어울리던 것이 이유다 · 어휘는 하단 커맨드 카드에서 왔다(흰 글자 · Rajdhani 숫자 · 진행선은 비용색 `#ff7676` · **박스 밖** 음수 bottom — 안쪽 패딩으로 두면 글자가 재화 줄보다 위로 뜬다) · 캠프(0단계)도 같은 자리를 쓴다(`캠프 · 0/50` · 상한은 라운드 50 · 아이콘 없음) · 라벨은 화면에서 뺐고 `aria-label` 에만 남는다 · 폭 예산 110px(스모크) · 🖥 **칩을 누르면 던전 선택이 전체 화면으로 열린다**(`#campDrop` · 2026-09-03 사용자 확정 · 목업 `docs/mock/camp-dgpick-full-8.html` 1안 — 그 전에 칩 아래 드롭다운 3벌(`camp-dgdrop-redo/harmony/layout-8`)을 거쳤다: 청록 판 → 검정 판(너무 진함) → 그늘 위 글자(좁음) 순으로 버려졌다): `#phone` 직속 · z 61(재화 바 62 **아래**라 칩이 위에 남아 머리줄이자 닫는 손잡이다 — 다시 누르면 닫힘) · `bottom:var(--navH)` 로 네비 자리를 비운다 · 위는 던전 **카드** 목록(큰 번호 · 이름/부제 · 배수 · 「지금 여기」= 붉은 테두리+붉은 번호 · 지나온 곳은 번호 옅게) · 아래 고정 `.cdFoot`: ROUND **큰 숫자 + 공용 `.arwBtn` ◀▶(누르고 있으면 반복 · pointerdown) + 🎚 슬라이더(`.cdSld` · 붉은 채움 + 흰 손잡이 · 누르는 높이 28px · 위치 (r-1)/(max-1) · pointer capture)** · [이동]은 **공용 `.actBtn.pri` 44px** — 값 입구는 `campRndTap` 하나(◀▶·슬라이더 둘 다) · ⛔ 청록·발광·굴림 피커(`.cdRn`)·제 버튼·칩 아래 작은 판을 되돌리지 말 것(스모크가 전부 잰다) · ⛔ 맵 띠(`#campBar`)에 다시 두지 말 것 — 거긴 **적 수와 ⚡ 피버만** — 🚪 화면 입구는 두지 않는다(트리 2026-09-01 · 환생 2026-09-03 제거 · 둘 다 하단 네비에 제 칸이 있다) · 상태는 `campDgN()`/`campRoundN()` 이 단일 소스(칩은 읽기만) |
| **캠프 구역 공통 상단** | **공용 재화 바 `#curBar`** — 환생·업그레이드·룬 세 화면 위에 그대로 올린다(`#phone.artLift .curBar{z-index:121}`) | 새 바를 만들지 말 것(단일 소스) · 🏷 **화면 이름은 재화 바 왼쪽(`#curTitle`)** 이다 — 유즈맵 선택·상점과 같은 자리 · 이름은 `campZoneTitle()` 한 곳이 정하고(환생 / 환생 트리 / 룬 / 룬 상점) `curPaintChip()` 이 던전 칩 대신 그것을 쓴다 · ⛔ 화면 안에 제목을 또 두지 말 것(`.rnTitle`·`.ctTitle`·`.crTitle` 은 감춰 뒀다 — 요소는 공용 제목 규격 계약이 잰다) · ⚙ 설정 버튼은 구역에서 **톱니**다(`#phone.campMode.artLift` — 캠프 맵의 ☰ 와 얼굴을 가른다) · 🧍 **인구 칸**은 캠프 밖에서도 보인다 — 화면 목록은 `POP_SCREENS`(12-appshell.js) 한 곳 · 세 화면의 상단 띠는 **위 44px**(`--topPad` + `--curH`)을 비워 재화 바와 안 겹치게 한다 |
| **환생 구역** | **`campRebEnter(sec)` 가 유일한 입구** — `'info'`=`#campReb` · `'tree'`=`#campTree` · 내용은 `campRebRender()`/`campTreeRender()` | `#phone` 직속(z-index 120) · **하단 네비가 「환생 · 환생 트리」 두 칸으로 갈린다**(2026-08-31 · 두 번째 칸 이름은 2026-09-04 에 「업그레이드」에서 바뀌었다 — 그 말은 캠프의 자원·무장 연구를 가리키는 다른 이름이다) · 열릴 때 var(--t-screen) 페이드인(⛔ animation-fill-mode 를 주지 말 것 — 탭이 백그라운드면 애니가 멈춰 화면이 통째로 안 보인다) · ⛔ `campRebOpen`/`campTreeOpen` 을 직접 부르지 말 것 — 서로를 안 닫아 둘 다 열린다(캠프 맵 띠 🔁·🌳 칩도 `campRebEnter` 로 온다) · **네비를 가리지 않는다**: 두 화면은 `bottom:var(--navH)` 로 자리를 비우고, 키 아트는 `#phone.artLift .navBar{z-index:121}` 로 네비를 그 위에 올린다(⛔ 키 아트를 `bottom` 으로 자르는 것으로는 안 된다 — 호흡 애니가 8px 더 그린다) · 실행 확인은 `.ecCard` 공용 확인창 · 배경은 **환생 구역 전용 한 장**이다(`#campRebBg` · `assets/backgrounds/reb/reb.webp` · ART.md §14) — 두 화면이 그 한 층을 함께 켠다(⛔ 화면마다 제 그림을 그리지 말 것 · ⛔ 공용 키 아트 `#titleBg` 를 빌리던 옛 방식으로 되돌리지 말 것 — 로그인·부팅과 서로 간섭한다 · 스모크가 잡는다) · 아래 넷은 빼지 말 것: ⭐ **히어로 = 환생 뒤 획득 배수**(`.crBig` · 「먼 목표」의 자리 — 없으면 첫 환생을 손해로 판단한다 · HUNT_R1 §4-2-0) · **포인트 계산 근거**(`.crFx` · 재화×던전×라운드 세 값) · **이번 회차 지표 다섯 줄**(`.crLi` · 터치 / 터치로 번 미네랄 / 자동으로 번 미네랄 / 가스 / 플레이 시간) · 💳 **환생 팩 버튼**(`.crPk` · **버튼 구역**이되 위계는 「환생」보다 한 단 아래 — 높이 38 vs 50 · 색은 보라(현질) · 산 뒤엔 `.on` = 「적용 중」 **상태 표시**라 버튼이 아니다 · ⛔ 젬 1회권으로 되돌리지 말 것 — 결제 팩 영구 ×2 다 · GEM.md §4-1) |
| **룬 구역** | **`campRuneEnter(sec)` 가 유일한 입구** — `'slot'`=장착 · `'shop'`=룬 상점 · 화면 `#campRune` · 내용은 `campRuneRender()` | 하단 네비 **세 번째 칸**(연구·환생·**룬**·유즈맵·상점 · 2026-09-02) · 환생 화면과 **같은 규격**(`#phone` 직속 · z-index 120 · `bottom:var(--navH)` 로 네비 자리를 비운다) · ⛔ `campRuneOpen` 을 직접 부르지 말 것(네비 하위가 안 나온다) · 🖼 배경은 **환생 구역과 같은 그림**이다(`#campRebBg` 한 장을 세 화면이 나눠 쓴다 · 2026-09-03 사용자 확정 — ⛔ 룬만의 그림을 따로 두지 말 것: 구역을 오갈 때 배경이 바뀌면 번쩍인다 · 끄기는 **한 박자 뒤**라야 「닫고→연다」 사이에 안 꺼진다) · 🗺 상단(`.rnTop`)은 **판 위에 떠 있다** — 판이 화면 맨 위까지 차오르고 진행 수치도 제목 옆(`.rnRound`)에 합쳤다(⛔ 판 위에 머리줄을 다시 띄우지 말 것) · 🔺 성좌는 **삼각 배치**(위 하나·아래 둘 · 판 440×560) · 칸은 **이중 테두리**(⛔ 십자 반짝임·후광 원은 트리의 어휘다 — 되살리지 말 것) · 성좌 중심에서 뻗는 선은 **칸 밖에서 멈춘다** · 칸은 **최대 도달 라운드**가 연다(`campRuneBestRound()` · 젬으로는 못 연다) · 효과는 **`campRuneEff(key)` 합산** 하나뿐(⛔ 곱 금지 · GEM.md §5-2) · 산 룬은 **환생해도 남는다**(`C.rune`) · 화면은 **🌌 성좌 판**(2026-09-03 · `_runeMapSvg` SVG 한 장 · 유니크가 중심, 일반 8칸이 고리 · 칸을 고르면 그 성좌로 확대해 들어간다) · 판은 **밀고 확대한다** — 조작은 **공용 엔진 `svv*`**(19-camp.js · ARCHITECTURE §「공용 SVG 뷰」)가 맡는다(⛔ 팬·줌을 화면마다 새로 짜지 말 것) · 아래는 **상시 가방**(`.rnBag` · 프로필 장비창의 가방과 같은 나눔) — 누르면 **칸을 골라 뒀으면 그 칸에, 아니면 빈 칸 중 첫 칸에** 끼운다(`campRuneBagTap`/`campRuneAuto`) · ⛔ 칸을 눌러야 뜨는 임시 시트(`.rnPick`)로 되돌리지 말 것 — ⛔ 목록형(`_runeRowHTML`)으로 되돌리지 말 것(다락에 있다) · 칸은 **일반 24(8칸×성좌 3) · 유니크 3** 이고 **한 성좌를 다 열면 그 중심이 열린다**(표는 GEM.md §8-3) · **유니크만 종류(4)>칸(3)** 이고 일반은 칸이 더 많다 — 그래서 일반의 선택은 「어느 축에 몇 칸을 주나」다(⛔ 같은 룬의 중복 장착을 막지 말 것) · 값 표는 **GEM.md §8-3 단일 소스** — **효과도 젬 값도 등급이 정한다**(`RUNE_VAL` 1/2.5/5% · `RUNE_GEM`) · ⛔ 룬마다 값을 흩뿌리지 말 것 · ⛔ 효과를 두 자릿수로 되돌리지 말 것(「룬은 게임을 심하게 바꾸면 안 된다」 — 실측 BALANCE §3-2-7) · **효과가 닿는 곳은 룬마다 한 자리뿐**(표는 GEM.md §8-5) — ⛔ 한 효과를 두 곳에 걸면 표기가 거짓말이 된다 · **일반 7종 · 유니크 4종**(2026-09-03) — ⛔ 「재화의 룬」(손끝을 품어서)과 「질주의 룬」(가속과 겹쳐서)을 되살리지 말 것 · 신속의 룬은 **유니크**로 올라왔다 · 유니크 값은 **넷 다 5%**(가속만 2.5% 이던 것을 접었다 — ⚠ 다시 재야 한다) · 가속의 룬 = `campFrame` 의 dt 한 줄(`campDtMul()`) · 신속의 룬만 캠프 게이트(`campRuneMulIn`)가 필요하다(16-build.js 는 관리자 탭과 공유) · 전리품의 룬은 ⛔ **젬에 안 건다** · 열기의 룬은 피버 **발동 확률**(`campFevPct`)에만 — ⛔ 지속·배수에 붙이면 피버가 상시 배수가 된다 |
| **환생 트리(마인드맵)** | `#campTree` + `campTreeOpen()` · 노드는 `campTreeSvg()` | `#phone` 직속 전체 화면 · 밀고 확대 · 입구는 **하단 네비 「환생 › 트리」 하나**(⛔ 맵 띠에 칩을 되돌리지 말 것) · 갈래 색은 `CAMP_TREE_BR` 한 곳 |
| **가스 교환**(가스→미네랄) | **정제소 프로필의 커맨드 카드** — `techBldgPlainModel` 안 `b.gas` 분기 + `campGasExAll()` | 정제소를 지정하면 그 프로필에 카드 하나로 붙는다(2026-09-02 사용자 확정) · ⛔ **캠프에서만** — 유즈맵·오토배틀 정제소에는 안 붙는다(환생 값이 대전에 새면 안 된다) · ⛔ 옛 자리(캠프 채굴 시트 `.cmRow`)로 되돌리지 말 것 — 미네랄 판이라 가스가 남의 집에 얹혀 있었다 · ⭐ **고정 교환비가 아니다** — 지금 미네랄 수입의 몇 초치(`CAMP_GASEX_SEC`)를 준다 · ⛔ 지갑은 `campAddRes()` 한 입구 · ⚠ 카드 규약: 받는 것은 우상단 `tr`, 내는 것은 `bottom` 의 **`.cc.en` 안에** (맨 아이콘만 넣으면 크기가 안 잡힌다 · `meta` 는 이 카드 꼴에서 안 보인다) |
| **일일 퀘스트** | `openDaily()` → `#hbDailySheet` + `renderDaily()` | 더보기 ☰ > 일일 퀘스트 · 하루 5개 + 주간 25개 |
| **출석** | `openAtt()` → `#hbAttSheet` + `renderAtt()` | 더보기 ☰ > 출석 · **퀘스트와 화면이 다르다**(같은 판에 탭으로 묶지 말 것 — 2026-08-14 분리) |
| 일일 진행 계측·보상 | **`dqNote(kind, n)`** / `dqGive(rw)` | 출석·퀘스트가 함께 쓰는 뒷단 · 새 계측 지점이 생기면 `dqNote` 한 줄만 넣는다 |
| HOME 팝업 껍데기·버튼 색 | `.hbModal` / `.hbmCard` / `.hbRow` · 버튼 면색 토큰은 `.hbModal{--btnA/B/C}` | 새 HOME 팝업을 만들 때 `#새시트 .ecGo` 같은 선택자를 **덧붙이지 말 것** — `.hbModal` 하위면 자동으로 같은 물성·회색톤이 된다 |
| **둘 중 하나 고르기(토글)** | **`.setSeg` + `.segBtn`** (`css/10-game.css`) | 설정 > 그래픽 품질(절전/고화질) = 방 만들기 공개/비공개 — 한 컴포넌트(2026-08-27 통일) · **탭 띠(`.pdSeg`)와 다르다**: 칸이 둘이고 「고른 것이 켜진 면」으로 읽혀야 할 때만 이것 · 액센트는 화면이 `--setAcc` 로 정한다(빨강이 주 동작인 화면에선 중립 밝은 색) · ⛔ 새 토글을 만들지 말 것 |
| 세그먼트 이동 바(한 구역 안에서 나뉘는 네비 = **모든 탭 띠**) | **`segNavHTML(items, i, act)`** → `.pdSeg`/`.pdSegInd`/`.pdSegBtn` | 장비창 섹션 바(장비·장신구) = 사냥터 업그레이드 탭 = 유즈맵 정렬 띠 = **채팅/파티/친구**(`renderSocialTabs`) = **친구 필터**(`renderHubFriendTabs`) = **코인 공학소**(`renderPtTabs`) — 한 함수 · ⛔ **탭 띠는 이것 하나뿐이다**(2026-08-27 통일 · 옛 사본 `.msTab2`·`.ptTab` 은 없앴고 스모크 「옛 사본이 되살아나지 않았다」가 잡는다) · 버튼 안 끝에 뭘 붙여야 하면 `tail` 슬롯(친구 배지) · **글자만**(아이콘을 같이 넣으면 한 덩어리로 가운데 정렬돼 글자가 밀린다) · 생김새도 공용 규칙이 전부 갖는다(각진 3px · 검정 판 · 밑변 1px 광원) · 화면이 덮는 건 광원 색 `--segCol` 하나 · 안쪽 틈은 `--pad` 변수 하나가 단일 소스(계산식을 복사해 박지 말 것) |

> **아이콘 일반 원칙:** 새 UI를 만들 때 **기존 에셋을 먼저 찾아 쓴다**(`assets/icons/` — 재화 4종 · `buildings/` 52 · `skills/` 28 · `upgrades/` 24 · **`tree/` 33**). 같은 뜻의 아이콘이 이미 있으면 그것을 쓰고, 없을 때만 대체 표기를 쓴다. **새로 뽑을 땐 `ART.md` §15**(규격·공통 블록·컷아웃 도구) — ⛔ 배경 지우는 코드를 직접 짜지 말 것.

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
