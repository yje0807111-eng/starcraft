# ARCHITECTURE — 코드맵 (`sc-ums-web.html` + `css/` + `js/`)

> AI/사람 공용 내비게이션 문서. **줄 번호는 표류하므로 "찾기 문자열"(배너·함수명)로 점프할 것.**
> 마지막 전면 갱신: 2026-08-20 — **파일 분할**(단일 HTML → HTML + css/ 5 + js/ 19). 총 ~25,600줄.

## 0. 제약(불변)
- 종족 설계·상성 오각형(신규 페럴·콜로서스 포함)은 **`RACES.md`** 참조 — 유닛 실수치·건물·밸런스 상수·시뮬레이션 검증 결과가 모두 거기 있다.
- 산출물은 **정적 파일 묶음** — `sc-ums-web.html`(마크업 ~900줄) + `css/` 5개 + `js/` 19개. **빌드 없음, 번들러 없음** — 브라우저가 태그 순서대로 그냥 읽는다.
  - `js/*.js` 는 전부 **classic 스크립트**(`type="module"` 아님) — 전역 스코프와 실행 순서를 **한 덩어리처럼 공유**한다. 그래서 쪼갠 뒤에도 코드는 예전과 똑같이 동작한다.
  - ⛔ **`<script>` 태그 순서를 바꾸거나 `type="module"` 로 바꾸지 말 것.** 순서 = 실행 순서이고, 모듈로 바꾸면 전역이 끊겨 전부 다시 배선해야 한다.
  - ⚠ `file://` 로 직접 열어도 CSS·JS는 정상 로드된다(classic 스크립트는 CORS 대상이 아님). 다만 3D(`M3D`)는 module + esm.sh 라 안 뜬다 — **분할 전부터 그랬고 분할이 바꾼 것은 없다.** 3D까지 보려면 서버로 띄울 것.
- 테스트 프레임워크 없음 → 행동 검증 = **`npm test`** (스모크 스위트, §9) + 브라우저 프리뷰.
- UI는 단일 소스 원칙(CLAUDE.md 레지스트리) — 같은 UI 재구현 금지, cloneNode/기존 함수 재사용.
- **폰트는 `:root`의 `--font-ti`(제목 = IBM Plex Sans KR **700**) / `--font-ko`(본문 = 같은 가족 400) / `--font-num`(숫자 Rajdhani) 토큰이 단일 소스다.** 한글 제목·본문은 같은 가족이고 굵기로만 가른다 — 다른 가족을 섞으면 글자 폭 비율이 달라 따로 논다(Do Hyeon으로 겪고 되돌렸다). 개별 규칙에 폰트 이름을 박지 말 것(스모크가 잡는다). 숨은 곳 둘: `font:` 단축 속성, 그리고 `var()`를 못 읽는 캔버스 `ctx.font`(JS 상수 `FONT_NUM`). 자세한 규칙은 DESIGN.md §2 「폰트」.

## 1. 파일 지도 (2026-08-20 분할)
`sc-ums-web.html` 25,588줄이 화면·역할별로 쪼개졌다. **고칠 곳을 찾을 땐 먼저 이 표에서 파일을 좁힌다.**
`<link>`/`<script>` 태그는 `sc-ums-web.html` 안에 **번호순 그대로** 나열돼 있다 = 로드 순서.

| 파일 | 줄 | 내용 |
|---|---:|---|
| `sc-ums-web.html` | 919 | `<head>` · **body 마크업 전부** · link/script 태그 나열 |
| `css/00-base.css` | 129 | 디자인 토큰 · 리셋 · 공통 스케일 · `#phone` 셸 |
| `css/10-game.css` | 1631 | 인게임 — HUD · 전장 · 유닛 · 하단 콘솔 · 설정 · 건설/테크 · 커맨드카드 |
| `css/20-lobby.css` | 901 | 대기실 · 방 만들기 · 전환 FX · 오프닝/로딩 · 통계 · 로그인 · 유즈맵 선택 · 메타 성장 |
| `css/30-home.css` | 1394 | 시작 허브 · 장비 · 마을 · 사냥터 업그레이드 · 던전 허브 · 상점 · 출석 · 마을 건설 |
| `css/40-social.css` | 647 | 유즈맵 목록 · 전체 채팅 · 파티 · 친구 · 모드 선택 · 난이도 · 미니맵 |
| `js/01-data.js` | 426 | 유닛/밸런스 실값(엑셀) · 유닛 SVG 아이콘 · `USEMAPS` 레지스트리 |
| `js/02-gacha.js` | 152 | 가챠 등급 시스템 — 데이터 |
| `js/03-meta.js` | 214 | 메타 성장 — 데이터 + 저장/로드 |
| `js/04-profile.js` | 521 | 개인 프로필 RPG — 스탯 · 레벨 곡선 · 환생 · 펫 · 유즈맵↔사냥터 경제 |
| `js/05-home.js` | 317 | HOME 대시보드 · 던전/라운드 고르기 · 스킬 바 |
| `js/06-daily.js` | 285 | 일일 퀘스트 · 출석 |
| `js/07-home-upgrade.js` | 532 | 동료 · 방치 수입 · 환생 UI · 사냥터 업그레이드 · 하단 네비 |
| `js/08-hunt.js` | 2953 | ⛔ **옛 자동사냥(캠프가 대체함 · 2026-08-23)** — 지금 HOME 메인은 `19-camp.js` 다. 여기 남은 것은 **던전 1~10 데이터 · 마을**뿐이니 게임플레이를 여기서 고치지 말 것 |
| `js/09-dungeon.js` | 760 | 던전 — 캐릭터가 직접 싸우는 전용 화면 |
| `js/10-engine.js` | 2029 | 유즈맵 엔진 — `G`/`newGame` · 캔버스/트랙 · 유닛/적 로직 · 프레임 · DOM 렌더 |
| `js/11-cmdcard.js` | 2239 | 탭 · 선택 · 커맨드카드 |
| `js/12-appshell.js` | 2046 | 앱 셸 — 인증 · 유즈맵 선택 · 모드 선택 · BGM/SFX |
| `js/13-room.js` | 388 | 실제 방 시스템(Supabase Realtime) · 대기실 · 대기실 채팅 · 자리 교체 |
| `js/14-input-fx.js` | 1059 | HUD · 입력(드래그/줌팬) · 수송 · 이동 물리 · 트레일/발사 이펙트 · 루프 · 샌드박스 |
| `js/15-tech-data.js` | 397 | 테크트리 데이터 · 상세 스펙 · 커맨드 그리드 어댑터 |
| `js/16-build.js` | 1095 | 건설 탭 — RTS 배치 맵 · 유닛 액션(알/라바/연구/진화/커널/벙커/수리) · 자원 채취 |
| `js/17-build-cards.js` | 1024 | 색 확인 · 애드온 · 프로필/설명 카드 · 뷰(줌·팬) · 배치 격자 · 지형(크립·동력장) |
| `js/18-strike.js` | 2076 | 직스(오토배틀) — 전장 배경 · 특수무기 · 라이프사이클 · 전투 시뮬 · FX 랩 |
| `js/19-camp.js` | 1010 | 🏕 **캠프(HOME 메인)** — 건설 시스템을 빌려 쓰는 새 게임 모드(2026-08-23) |
| `js/90-m3d.module.js` | 1472 | **유일한 module 스크립트** — three.js 3D → `window.M3D` |

### 🏕 캠프 — HOME 메인 게임 모드 (2026-08-23)

**옛 사냥터(웨이브 방어)를 대체한다.** 방향 설계는 `GAME_DIRECTION.md` 가 단일 소스다.

⭐ **새로 만든 게 아니라 건설 시스템을 빌려 쓴다.** 관리자 건설 탭(`16-build.js`)이 종족별 본부 배치 ·
광맥 · 일꾼 왕복 채취 · 격자 배치 · 건물별 생산 카드를 이미 갖고 있다. `19-camp.js` 는 그것을
**초기화하고 캠프 규칙으로 덮을** 뿐이다 — 오토배틀(`18-strike.js:188`)과 같은 관계다.
⛔ `16/17-build.js` 를 고치지 말 것(관리자 탭·오토배틀과 공유).

```
campOpen() → campEnter() → ① techUIInit(종족)  ② campRestore()  ③ 치트 끄기  ④ campShowView()
```
⚠ **순서가 고정이다** — `techUIInit` 이 매번 상태를 새로 만들어서, 복원을 앞에 두면 날아간다.

| 함정 | 내용 |
|---|---|
| **`G.tab`** | 프레임 루프는 `.gview` 가 아니라 `G.tab` 으로 분기한다(`14-input-fx.js:894`). 뷰만 켜면 건설 맵이 렌더 루프를 못 타고 `drawMain()` 이 0크기 `#cvMain` 에 그리다 예외를 던진다 |
| **종족 키 두 벌** | `C.race`=STK 키(`terran`) · `G.tech.race`=TECH 키(`union`). ⛔ `campSave` 에서 서로 덮으면 종족 표시가 깨진다 |
| **직렬화** | `ents` 의 `_` 로 시작하는 런타임 필드(`_rally`·`_cKind`…)는 저장하지 않는다 |
| **`campExit`** | `_campOn` 일 때만 저장한다 — 관리자 탭·오토배틀 판을 캠프 저장에 덮어쓰지 않게 |
| **화면 층** | `#vBuild` 는 인게임 층, HOME 은 앱 화면. `#phone.campMode` 로 예외를 판다 |
| **맵 = 화면 전체** | 시트는 맵 **위에 겹친다.** ⛔ 맵 높이를 시트만큼 줄이지 말 것 — 두 번 틀렸다: ① `#btSheet` 이 `#vBuild` 자식이라 서로 밀어내는 순환(실측 323px 겹침) ② 시트를 밖으로 빼도, 맵 좌표가 0~1 정규화라 맵 픽셀만 커질 뿐 **보이는 월드 범위는 그대로**다(배치 중 시트가 내려가도 안 넓어진다). 기지가 안 가리는 것은 `CAMP_ROW_BASE/MINE` 배치가 맡는다 |
| **`#cstLabels`** | ⛔ 숨기지 말 것. 이름표가 아니라 **배치 확정(▶)·취소(✕) 버튼**과 건설 진행 바·남은시간이 들어간다(3D 위에 떠야 해서 쓰는 z8 오버레이). 껐다가 배치 버튼이 통째로 죽었다 |
| **좌상단 던전 칩** | 재화 바 왼쪽 빈 슬롯(`#curTitle`)에 얹는다 — 화면을 새로 만들지 않는다. 그리는 곳은 **`12-appshell.js` 의 `campChipInfo`/`curChipHTML`/`curPaintChip` 셋뿐**이고 `updateCurBar()` 가 부른다(캠프가 수입마다 그걸 부르므로 타이머가 없다). ⚠ **캠프에는 아직 라운드 칸이 없다**(`p.camp` = `{dg:1,…}`) — 그래서 둘째 줄은 「던전 3/10」이다. `C.rnd` 가 생기면 `campChipInfo` 가 자동으로 「라운드 n/99」로 바꾼다. ⚠ 칩 높이는 재화 바(`--curH`=34px)를 넘으면 안 된다 — 두 줄을 그냥 쌓으면 44.7px 로 삐져나온다(스모크가 잰다). 생김새는 `docs/mock/camp-dungeon-onechip-8.html` 7안 |
| **격자 48칸** | `techCols()` 만 감싼다. ⛔ `TECH_GRID.cols` 를 고치면 `renderBuildTab` 의 `_cellK` 기준선(20칸)이 같이 움직여 **건물만 작아지고 유닛은 그대로**가 된다 |
| **줌 하한 = 1** | 바닥(`.bmapFloor`)이 뷰 변환을 함께 받는다 — 축소하면 바닥도 줄어 사방이 뚫린다(실측 zoom 0.5 → 바닥 183×270 vs 화면 365×540). 팬 한도 `m=(1-1/zoom)×0.5` 는 바닥이 화면을 덮는 한계와 정확히 같다. ⛔ 여유를 더하면 그만큼 뚫린다 |

#### 🖐 캠프 조작 — 입력 경로가 갈린다

같은 화면인데 **등록 위치가 셋**이다. 하나만 보고 고치면 다른 게 죽는다.

| 조작 | 어디에 걸려 있나 | 함정 |
|---|---|---|
| 탭·드래그 | `.bmap` 의 인라인 `onpointerdown` (`16-build.js:1101`) | 맵 DOM 이 매 프레임 새로 그려질 때 **함께 되살아난다** |
| 이동·뗌 | `document` 전역 리스너 (`17-build-cards.js:740`) | DOM 재생성과 무관 |
| 휠 | `#vBuild` 에 `addEventListener` **1회** (`14-input-fx.js:366`) | 그 버블 경로 하나에만 의존 → "포인터는 되는데 휠만 안 먹는" 상태가 가능. 캠프가 `window` 캡처 경로를 하나 더 둔다(중복은 `ev.__campWheel` 로 막는다) |
| 채집 | `document` **캡처** 리스너 (`19-camp.js`) | 성공하면 `stopPropagation` — 그 아래 `techPtrDown` 이 **아예 안 불린다.** 여기에 걸린 부수효과(모드 해제 등)는 이쪽에도 따로 넣어야 한다 |

⚠ **중클릭·Shift 조합에 기대지 말 것.** 브라우저 모바일 에뮬레이션은 마우스를 터치로 바꾸므로
중클릭 이벤트가 **아예 발생하지 않고**(실측: `maxTouch=5` · `pointerdown btn=0 type=touch`),
Shift+드래그는 핀치로 변환된다. 그래서 화면 이동은 **빈 바닥 0.5초 롱프레스 = 모드 토글**이다
(`CAMP_PAN_HOLD_MS`). 손을 떼도 유지되고, 탭하면 꺼진다.
⛔ 빈 바닥 **드래그**를 팬으로 쓰지 말 것 — 거긴 드래그 박스 유닛 지정이 이미 있다.
⚠ 빈 바닥 판별을 `_btBox` 로 하지 말 것: 캠프는 시트를 채우려 늘 본부를 자동 선택해 두므로
빈 바닥 탭이 원본의 "건물 지정 해제"(`17-build-cards.js:685`)로 먼저 소비되어 `_btBox` 가 안 선다.
→ `campEmptyAt(x,y)` 로 좌표를 직접 판정한다.

#### ⚡ 캠프 성능 — 프레임당 두 가지가 무겁다

| 무엇 | 실측 | 대책 |
|---|---|---|
| **레이아웃 스래싱** | `_techGA()`→`_btRect()`(=`getBoundingClientRect`)를 `_techCH()` 가 부르고, 그걸 유닛·광맥·건물마다 부른다. 같은 프레임에 `innerHTML` 이 갈리므로 전부 **강제 동기 레이아웃**. 일꾼 12기에 **76회/프레임** | 캠프가 `_btRect` 를 감싸 **프레임당 1회**만 재고 캐시(`_campRectC`) → 76 → 1 |
| **3D + DOM 재생성** | `#cvMarine` 730×1402 = **1.02M 픽셀**(dpr 2) · `innerHTML` 통째 교체 2회/프레임. `syncBuild` 는 `90-m3d.module.js:1339` 에서 네이티브 해상도 고정이라 캠프만 낮출 수 없다 | `CAMP_FRAME_MS=30` 으로 프레임 제한(rAF 100프레임 중 50만 그린다) |

⚠ `campFrame` 은 시계가 **뒤로 가면 기준을 버린다** — rAF 는 단조 증가하지만 테스트는 가짜 시각을
주므로, 앞선 호출이 기준을 먼 미래로 밀면 뒤 프레임이 통째로 스킵된다(실제로 그렇게 죽었다).

옛 사냥터는 **코드를 남긴 채 진입만 끊었다**(`05-home.js` 의 `hbStart()` 한 줄). 스모크의 옛 step 들은
`skipIf(typeof campOpen==='function')` 로 건너뛴다 — 되살리면 그 줄들을 지운다.

### 🎞 스프라이트 도구 (게임 밖 · 2026-08-22)
유닛·건물의 방향별 모션 프레임을 만들고 보는 도구다. **게임은 이 파일들을 읽지 않는다** —
`sc-ums-web.html` 의 script 태그와 무관하므로 로드 순서에 영향이 없다.

| 파일 | 내용 |
|---|---|
| **`SPRITES.md`** | 폴더 규칙 · 액션 목록 · 방향 번호 · 제작 순서의 **단일 소스** |
| `scripts/unit-frames.mjs` | 걷기 영상 → 보행 주기 측정 → 한 사이클 추출 → 마젠타 배경 제거 |
| `scripts/unit-align.mjs` | 방향별 프레임 위상 정렬 + 좌우 반전으로 8방향 완성 |
| `scripts/sprite-manifest.mjs` | `assets/sprites/` 훑어 `manifest.js` 생성 (기대 로스터는 게임 코드에서 읽는다) |
| `tools/sprites.html` | 뷰어 + 완성도 현황판 — **브라우저로 그냥 열면 된다**(서버 불필요) |
| `assets/sprites/manifest.js` | 자동 생성물 — 손으로 고치지 말 것 |

> 색인이 JSON+`fetch` 가 아니라 **전역 대입(`manifest.js`)** 인 이유: `file://` 에서 `fetch` 는
> CORS 에 막히지만 `<script src>` 는 통과한다. 빌드 단계 없는 이 저장소 방식과 맞다.

> 기대 로스터(어떤 유닛이 있어야 하는가)는 **`RACE_OF`**(`js/11-cmdcard.js`)에서 읽는다.
> ⚠ `STK_RACES[*].units` 를 쓰면 안 된다 — 오토배틀 배출표라 일꾼·주술사가 빠져
> 페럴이 11기로 잡힌다(실제 16기).

> ⛔ **CSS 안의 `url()` 은 CSS 파일 위치 기준으로 풀린다.** 스타일이 `sc-ums-web.html` 안에 있을 땐 `assets/…` 가 맞았지만 `css/` 로 옮긴 뒤로는 **`../assets/…`** 여야 한다. 실제로 이걸 놓쳐 **로딩 화면 배경 아트가 통째로 안 떴다**(2026-08-20). 브라우저는 배경 이미지가 없어도 조용히 넘어가므로 스모크로는 안 잡힌다 — `test/run-smoke.mjs` 의 **프리플라이트**가 정적으로 막는다(`✓ CSS 상대 경로 확인`).

> **파일을 옮길 때 주의:** 함수/상수를 다른 파일로 옮기면 **실행 순서가 바뀐다**. 선언(`function`/`var`)은
> 파일 안에서만 호이스팅되므로, 로드 시점에 바로 부르는 코드가 뒤 파일의 함수를 참조하면 깨진다.
> 옮긴 뒤엔 반드시 `npm test`(브라우저 부팅 포함)로 확인할 것.

### 🐺🗿 페럴·콜로서스 — 5종족 오각형 (2026-08-20)
5종족 설계(`RACES.md`) 중 **페럴(수인)·콜로서스(거신)** 을 코드로 확정하고 **오토배틀까지 편입**했다.

| 무엇 | 어디 |
|---|---|
| 유닛 30기 스탯 | `js/01-data.js` `U` |
| 건물 29동 + 생산·연구 | `js/15-tech-data.js` `TECH_TREE.feral` / `.colossus` |
| 건물 체력·크기·건설시간 | `js/15-tech-data.js` `TECH_SPEC.feral` / `.colossus` |
| 종족 색·유닛→종족 | `js/11-cmdcard.js` `RACE_BAR` / `RACE_OF` |
| 샌드박스 진열 | `js/14-input-fx.js` `RACE_ROSTER` / `SANDBOX_RACE_ORDER` |
| 일꾼·방어건물·채취 색 | `js/16-build.js` `TECH_WORKER` / `TECH_DEF_BLDG` / `TECH_MINE_FX` |

| 오토배틀 유닛 스탯 | `js/14-input-fx.js` `STK_UNITS` |
| 오토배틀 종족·데모 빌드 | `js/14-input-fx.js` `STK_RACES` / `STK_RACE_ORDER` / `STK_BUILDINGS` |
| 건물→전장 배출 | `js/15-tech-data.js` `TECH_BLDG_UNIT` / `STK_RACE_SPAWN` |
| 종족 세기·관측 티어 | `js/18-strike.js` `STK_RACE_STAT` / `STK_RACE_POWER` / `STK_TIERS` |
| **공격 가능 레이어 · 데미지 타입** | `js/11-cmdcard.js` `SB_ATK_MODE` / `UNIT_COMBAT_CLASS` |
| 공중 판정 · 이펙트랩 | `js/18-strike.js` `FXLAB_AIR` / `FXLAB_RACE_ORDER` / `FXLAB_RACE_KO` |

**🧭 종족을 오토배틀에 넣을 때 — 조용히 빠지는 표 (전부 실제로 밟았다)**
- ⛔ **`SB_ATK_MODE` 를 빼면 그 종족은 공중 유닛을 영영 못 때린다.** 기본값이 `{air: FXLAB_AA에 있나, gnd:true}` 라 신규 종족은 전부 '지상 전용'이 된다. 상대에 공중이 한 기라도 있으면 **승률 0%** 가 나온다(페럴 vs 에테리얼이 정확히 이랬다).
- ⛔ **`U.dmg===0` + `airDmg>0`(대공 전용)은 '무공격'이 아니다.** `FXLAB_NOATK` 가 `dmg===0` 만 보고 걸러서 대공 투석수·하늘 사냥수·플랙 배터리·아크 라이트가 **아무것도 못 때렸다**. 지금은 `airDmg` 를 함께 본다.
- ⚠ **배출표(`TECH_BLDG_UNIT`)의 앞 두 건물에 대공이 있어야 한다.** 다섯 종족 전부 그렇다. 페럴만 대공이 레어 티어라 초반에 일방적으로 졌고, 그래서 투척 구덩이(지상+공중인 맹독수)를 두 번째로 올렸다. 스모크가 이 조건을 검사한다.
- ⛔ **`UNIT_COMBAT_CLASS` 누락 = 상성 중립.** `dt`(normal/concussive/explosive)×`sz`(s/m/l)가 이 게임의 **유일한 상성 장치**다. 오각형의 페럴 변 세 개(> 에테리얼·> 콜로서스, < 스웜)는 스탯이 아니라 **"페럴 = 폭발형 공격 + 소형 몸"** 한 줄에서 나온다. 배율만으로는 순환(가위바위보)을 만들 수 없다 — 배율은 전순서라 3자 순환이 불가능하다.
- ⚠ **AI 진영은 종족 키가 다르다.** `STK.me.race` 는 `terran/zerg/protoss`, 배출표는 `union/swarm/aetherial`. 예전엔 `TECH_BLDG_UNIT[e.race]` 로 바로 찾아 **표가 비었고, AI가 웨이브마다 무작위 2기만** 냈다. 지금은 `stkTechRace(r)` 한 입구를 지난다.
- ⚠ `TECH_SPEC.<종족>.bldg` 를 비우면 프로필 머리줄에 체력 대신 **설명이 들어가 두 줄로 감긴다** — 관리자 감사 스모크가 40px 규약으로 잡는다(실제로 29건 걸렸다).
- ⚠ `TECH_SPEC.<종족>.unit` 은 **비워 둔다.** `techUnitSpec` 이 `U` 에서 합성한다 — 적으면 수치가 두 곳이 된다.
- ⛔ **종족 목록을 손으로 나열하지 말 것.** 건설 탭 종족 띠·프로필 순환은 `Object.keys(TECH_TREE)` 에서 뽑는다. 예전엔 `['union','swarm','aetherial']` 이 박혀 있어 데이터엔 있는데 탭에만 안 떴다.
- ⚠ 관리자 샌드박스 진열 간격은 **종족 수에서 역산**한다(`SB_TOP`/`SB_BOT`/`SB_DY_MAX`). 상수로 두었더니 3종족 기준이라 페럴·콜로서스가 화면 밖으로 밀렸다.
**⚙ 신규 전투 메커니즘 3개(`js/18-strike.js`)** — 오각형의 축이라 이게 없으면 상성이 성립하지 않는다.
- `minRange`(최소 사거리): 표적이 이보다 가까우면 **못 쏜다.** 반대 방향으로 물러나고 전개가 다시 걸린다. 콜로서스 3기(포대병·트윈 캐논·시즈 콜로서스)만 갖는다 → **페럴 > 콜로서스**의 기계적 근거.
- `deploy`(전개): 움직인 뒤 `dep` 초가 지나야 사격. `strikeMoveToward` 가 `depT` 를 다시 채우므로 **밀려나기만 해도 화력이 멈춘다**.
- 🐺 광폭화: **진영 단위** 스택(`sd._frz`). 처치 시 +1(상한 `STK_FRZ_CAP` 20), 스택당 공속 +1%·이속 +0.5%, 전투가 끊기면 감쇠. 페럴 진영에만 붙는다.
- ⚠ 셋 다 `U` 의 필드(`minRange`/`deploy`)에서 나온다 — 기존 3종족 유닛엔 그 필드가 없어 **동작이 전혀 바뀌지 않는다**.

**📏 상성은 모델로 추정하지 말고 `node test/race-matchup.mjs` 로 잰다.** 자세한 것은 §9.

## 2. 코드 섹션 지도 (배너 검색어 순서대로)
> 아래 찾기 문자열은 분할 후에도 그대로다 — `grep -rn "찾기 문자열" js/` 로 파일까지 한 번에 찾는다.

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
| `장비창(상=페이퍼돌 / 하=가방)` | `PROF_SLOT_ICON`(슬롯 라인아트 12종)·`_slotGlyph` · `PROF_GEAR_PAGES`/`profPageSlots`/`_profPageNav`(장비↔장신구 페이지) · `_profPaperdoll`(아바타 위 오버레이) · `_profGearGrid`(6열) · `tierFrame`/`TIER_FRAME_HTML`(등급 프레임 · 착용 칸·가방 칸 공용) · `gearIco`/`GEAR_ART`(장비 그림 → 없으면 라인아트) / `_profGearInfo`(가방 위 팝업) · `_gearPick`/`_gearSel`/`_gearPage` · `bagScrollHint` |
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
- **`_hb` 는 세션이 아니라 포인터다** (2026-08-20). 진짜 전투 세션은 `HBS={hunt, dg}` 안에 있고, `_hb` 는 *지금 화면이 보는 쪽*을 가리킨다. 사냥터(방치)와 토벌이 **동시에** 돌아야 해서 이렇게 갈랐다.
  - 불변식 **`_hb === HBS[_hbView]`**. `hbUse(k)`(포인터 재조준) · `hbSetSess(k,S)`(세션 교체) · `hbWith(k,fn)`(잠깐 그 세션으로) — ⛔ **`_hb` 에 직접 대입 금지.**
  - `hbPumpAll()`(50ms 인터벌)이 살아 있는 세션을 **전부** 민다. `hbPump()` 는 `_hb` 하나만. 그리기(`hbFrame`)는 보는 세션만.
  - 시뮬 시계는 세션마다(`S.lastSim`). 전역 하나로 두면 배경 세션이 앞 세션의 시각을 물려받아 돌아온 순간 큰 `dt` 로 점프한다.
  - ⛔ **getter 로 가로채는 방법은 없다**(실측): 파일 스코프 `let` 은 window 프로퍼티가 아니라 `defineProperty` 가 무효이고, `var` 로 바꿔도 전역 var 는 `configurable:false` 라 던진다. 그래서 포인터 재조준 방식이다.
  - 다행히 시뮬 경로는 `S.dg`/`S.round` 를 **세션에서** 읽는다. 저장 진행도(`hbHunt()`)를 만지는 곳은 결과 지점 셋뿐 — `hbSettle()`(클리어) · `hbDie()`(사망) · `hbSpawnWave()`의 벙커 체력 동기화(`hbBase()`). 토벌 분기는 여기서만 갈리면 된다.
  - 스모크 「전투 세션 둘이 동시에 돌고 서로 오염되지 않는다」가 불변식·병행·오염을 검사한다.

- **토벌 진행도는 종류별이다** (2026-08-20). `c.dgFloors={normal,gear,pet,ally,rune}` — 옛 `c.dgFloor` 하나는 v11 이 `normal` 로 옮기고 **지운다**(두 벌이 남으면 반드시 어긋난다).
  - 종류표 `DG_DUNGEONS` 가 단일 소스: 이름·아이콘·`reqLv`(해금 레벨)·`tint`·`sub`(보상 성격 한 줄)·`rw`(`{cur:1}` = 재화 대량 / `{tix:'gear'}` = 그 권종). 종류를 늘릴 땐 여기 한 줄 + `TIX_KINDS`(03-meta) 한 칸.
  - `dgMaxFloor(id)` = 그 종류 / `dgMaxFloor()` = **전 종류 최고**(장비 등급·관문 표시가 이걸 본다). ⚠ 시트·입장·소탕은 반드시 `id` 를 넘길 것 — 안 넘기면 장비 토벌을 처음 열었는데 일반 12단계 다음이 뜬다.
  - 보상 지급은 **`dgGrantReward()` 한 곳**을 지난다 — 입장(전투 클리어)과 소탕(이전 단계 즉시)이 같은 표(`dgFloorReward`)·같은 지급을 쓴다. ⛔ 입구를 둘로 나누지 말 것(옛 코드가 그래서 소탕만 뽑기권을 못 받았다).
  - 🎟 뽑기권 수량은 단계에 비례한다(`dgTixN`). 재화도 단계 선형.
  - ⚔ **자동 토벌은 사냥터 엔진(`HBS.dg`)에서 돈다** (4단계). 이동·카이팅·스킬·3D 를 두 벌 만들지 않기 위해서다 — 같은 `hbStep`, **규칙만 다르다.** 규칙 차이는 딱 여섯 군데:
    | 다른 점 | 어디서 갈리나 |
    |---|---|
    | 기지가 없다(벽·회복 구역·기지 사각) | `hbNoBase()` → `hbBlocked` · `hbLineClear` · `hbWalk` · `hbPlaceFoe` |
    | 웨이브를 다 깨면 단계 클리어 | `hbSettle()` 첫 줄 → `dgHbWin` |
    | 죽으면 실패(라운드 하강 아님) | `hbDie()` 첫 줄 → `dgHbLose` |
    | 웨이브 재화 없음 | `hbWaveReward()` 첫 줄 |
    | **처치 보상 없음** | `hbKill()` — ⛔ 이 분기를 빼면 장비·동료·펫 뽑기권이 토벌 종류와 무관하게 쏟아져 종류를 나눈 뜻이 무너진다 |
    | 동료·펫·터렛·벙커 없음 | 세션을 빈 배열로 만든다(그 루프들이 안 돈다) |
    - ⚠ 배경 세션은 스킬 바 DOM 을 만지면 안 된다(`if(!S.bg)`) — 사냥터 바에 토벌 쿨다운이 찍힌다.
    - ⚠ 판이 끝나면 `hbSettle`/`hbDie` 가 세션을 **그 자리에서 걷는다**. `hbStep` 은 `if(S.done) return;` 으로 즉시 끊어야 한다 — 안 끊으면 뒤의 `hbFx` 가 이미 null 이 된 `_hb` 를 읽고 터진다(실제로 터졌다).
    - ⚠ 거리장 캐시(`_chAt`/`_chF`/`_foeAt`)는 **세션 안**에 있다. 전역에 두면 두 세션이 서로의 '마지막으로 구운 칸' 키를 덮어써 거리장을 다시 안 굽는다.
  - 🎮 **직접 토벌은 사냥터 화면(HOME)을 그대로 빌린다** (5단계). ⛔ 두 번째 전투 화면을 만들지 말 것 — `dgFightEnter/dgFightRestore/dgFightGiveUp` 셋이 전부다.
    - 빌리는 방법: `HBS.hunt.bg=true`(사냥터는 배경에서 계속 돈다) → `dgHbStart(…,{cv:#hbCv})` → `hbUse('dg')` → `body.dgFight`.
    - 걷어내는 것은 **CSS 한 곳**(`body.dgFight`): 사냥터 업그레이드 카드 · 라운드 ◀▶ · 건설 종료 · AUTO 칩(직접은 스킬이 늘 수동이라 눌러도 아무 일이 없는 거짓말 컨트롤이 된다).
    - HUD 는 같은 자리를 쓴다 — `hbHud()` 가 `S.mode==='dg'` 면 「종류 · 단계 N · 웨이브 k/3 · 직접」으로 쓴다(`#hbRoundLb` 라벨도 라운드↔단계로 갈아끼운다).
    - ⚠ **HUD·스킬 바는 보이는 세션만 그린다**(`if(S.bg) return`). 안 막으면 배경 사냥터가 `hbSettle` 을 지나며 토벌 HUD 를 '던전 1 · 라운드 5'로 덮어쓴다(실제로 그랬다).
    - ⚠ **스킬 바 위치**는 `.hmUpg` 기준인데 직접 토벌은 그 카드를 숨긴다 → rect 가 0 이다. 카드가 없으면 `#navBar` 위를 기준으로 잡는다. 실패 모드가 둘이라(화면 위로 날아감 / 네비 뒤로 깔림) 스모크가 **둘 다** 검사한다.
    - 🧹 3D 는 공용이라 `dg3dWipe()` 를 **빌릴 때와 돌려줄 때 양쪽에서** 부른다. 한쪽만 하면 반대 방향 전환에서 잔상이 샌다.
    - 포기(`dgFightGiveUp`)는 열쇠를 쓰지 않는다 — '완료할 때만 소모' 규칙 그대로.
  - ⛔ **토벌 전체가 유보다**(`GAME_DIRECTION.md` §5-D · 2026-08-24). **삭제가 아니다 — 코드를 지우지 말 것.**
    사냥터가 「캠프」(기지 운영)로 바뀌면서 정체성이 갈렸다: 토벌은 캐릭터 1명이 싸우는 RPG 문법인데,
    새 사냥터는 주인공이 없고 `S.char` 도 `S.army[]` 로 해체될 예정이다(§6 인계).
    - **자동 토벌은 그대로 돈다** — 화면이 필요 없어 캠프 전환과 무관하다.
    - **직접 토벌은 도달 불가다**(깨진 게 아니다). `dgFightEnter` 가 빌리는 사냥터 화면(HOME)이
      더 이상 세션을 시작하지 않아서다. 코드·CSS·스모크는 전부 살아 있다.
      ⛔ **지금 고치지 말 것** — 사냥터 화면 자체가 바뀌는 중이라 맞춰도 다시 어긋난다.
    - 되살릴 때 볼 것: 보상이 새 성장 축 **둘(연구·경제) 중 어디로** 들어가는가(§5-D).
      지금 5종 중 장비·펫·동료 토벌 셋은 **유보된 시스템**(§5-B)에 보상을 준다.
  - ⚔ 입장은 **자동 / 직접** 두 갈래(`dgSheetEnter(auto)` → `dgStart(floor,{auto,id,key})`). 자동은 화면에 안 들어가고(`showAppScreen` 생략) 제자리에서 싸우며(`dgStep` 의 접근 이동 스킵) `DG_AUTO_SPEED` 배속으로 돈다. ⚠ `id`/`key` 는 `dgStart` 안에서 심는다 — 자동은 그 함수 안에서 판이 끝날 수 있어 호출부에서 뒤에 심으면 이미 `dgWin` 이 지나간 뒤다.

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
  건설 진입(`stkGoBuild`)은 `stkPickWorker()` 로 일꾼을 자동 지정한다(이미 지정된 것이 있으면 유지). 강화 칸 = `[공격력][체력][빈칸][광산]`,
  사용 그리드 = 구입과 같은 자리·같은 순서에 미보유는 `dim`(빈 칸으로 비우지 말 것). 하단 판 높이는 세 화면 모두 `--bpBodyH`.
  건설지 상단은 전투 화면의 **`#hud` 그 자체**다 — `body.cstMode.stkCst` 가 `#hud` 를 살려 두고 `techMapRender` 는 `techWallet()` 이면 `.bres` 복제본을 만들지 않는다.
  값은 `strikeHud()` 가 채우며 인구 칸만 건설지에서 `G.tech.sup/supCap` 로 바뀐다. **관리자 건설은 반대**(좌상단 종족 탭과 시계가 겹쳐 `#hud` 숨김 + `.bres`) — 갈리는 지점은 `stkCst` 클래스 하나.
  하단 시트 접기 버튼(`#btCardCtl`)과 카드 최소화 모드(`cm2`)는 제거됐다 — 높이는 `--bpBodyH` 하나뿐.
- **두 네비 바(HOME `NAV_TREE`/`navGo` · 유즈맵 `GTAB_TREE`/`gtabDrill`)는 같은 규칙을 쓴다**: 구역에 밖에서 들어오면 `reset()` 으로 늘 첫 하위. 이미 그 구역이면 되돌리지 않는다(안 그러면 자동화가 판매로 튕긴다).
- **하단 구역의 톤·높이는 토큰 셋 하나가 정한다**(2026-08-14): `--panelBig`(판) · `--bpFace`(속살 검정) ·
  `--bpTile`(초상 방사) · **`--bpBodyH`**(본문 높이). ⚠ `--bpBodyH` 는 `min(28vh,140px)` 이라 `getPropertyValue()` 로 읽으면 원문 문자열이다 —
  숫자로 재려면 그 토큰을 적용한 탐침 요소를 만들어 잴 것(스모크가 예전에 `parseFloat`=NaN 으로 검사를 통째로 건너뛴 적 있음). 다섯 섹션(메인 홈 `#defaultCmd` · 시트 `#unitCmd`/`#btSheetBody` ·
  플레이어 `#plGridWrap`)이 같은 변수를 쓰므로 값을 개별 규칙에 다시 박지 말 것 — 예전엔 시트 176px / 메인·플레이어 126px 이라
  탭을 옮길 때마다 판이 튀었다. 스모크 `하단 프로필: 다섯 섹션 같은 높이 …` 가 지킨다.
  ⚠ **판 '밖'(위쪽)에 붙는 조작 버튼(`.cgTopOut` — 랠리·부양/착륙·전체지정)은 `.bp` 의 `overflow-y:auto` 에 통째로 잘린다.**
  `overflow-y:auto` 는 `overflow-x` 까지 `auto` 로 만들기 때문에 위로 삐져나온 자식이 사라진다 — 화면엔 아무것도 안 보이는데
  `getBoundingClientRect()` 는 멀쩡한 값을 돌려주므로 **위치만 재는 검사는 통과한다**(건설 시트에선 잘 보여서 더 늦게 발견됐다).
  그래서 프로필을 띄운 동안은 `#bpMain:has(#unitCmd.on)` 계열 규칙이 `overflow:visible` 로 끈다(프로필 호스트는 높이가 고정이라 바깥 스크롤이 필요 없다).
  스모크 `메인 프로필: 판 밖 조작 버튼이 잘리지 않는다 …` 는 위치가 아니라 **`elementFromPoint` 로 실제로 눌리는지**를 본다.
  - **조작 묶음 = 한 판 트레이**(2026-08-19 · E+S3). 사냥터 스킬 바(`.hbTray`/`.hbSk`)와 **같은 구조·같은 토큰**이다 — 회색 판(`--trayPanel`) + 모서리 컷 7px 안에 검정 칸(`--bpFace` + `--trayEdge` 붉은 테두리) **30px**(2026-08-19 · 0.8배 · 스킬 칸은 37px). ⛔ `clip-path`·라운드·면은 **크기와 함께 줄이지 않는다** — 스킬 칸·업그레이드 카드와 같은 값이어야 하는 계약이고 스모크가 네 속성을 직접 대조한다. `.on`(랠리 지정 중·부양 중)이면 `--trayEdgeOn` 으로 붉게 빛난다. 한 슬롯(`topRight`)에 **11군데**가 물려 있으니 여기만 고치면 전부 따라온다. 되돌아가기(`m.back`)도 같은 트레이 **맨 왼쪽**에 붙는다 — `renderCmdGrid` 가 `(m.back||'')+(m.topRight||'')` 로 이어 붙이므로 세 곳의 모델 빌더는 그대로 두고 여기 한 줄이 자리를 정한다. ⛔ 머리줄(`.cgHead`)에 조작 버튼을 되돌리지 말 것 — 버튼 높이가 제목 줄을 밀어 올려 그리드가 짧아지고 조작 입구가 두 곳으로 갈린다(스모크가 `.cgHead` 안의 `.cgBack` 까지 잡는다).
    - **일꾼 수(`.cgGasAuto`)는 넓은 칸 하나(76px)** — 안쪽 `−`/`+` 는 판을 갖지 않고 구분선만이다. 세 칸으로 늘어놓으면 트레이가 5칸이 되어 숫자 조정이 제일 커 보인다.
    - ⚠ **판 색은 `--trayPanel`(`:root`)** 이다. `--hmPanel` 은 `#homeScreen`·`#townScreen` 스코프라 게임 화면에서 쓰면 판이 통째로 사라진다.
    - ⚠ `.gaBtn` 은 전역에 동명의 다른 버튼이 있다 — `.cmdG .cgGasAuto` 아래로 좁혀 쓸 것.
    - 스모크가 트레이 판·모서리 컷·칸의 붉은 테두리(시안/파랑 금지)·일꾼 칸 폭을 검사한다.

## 6. 3D 모듈 (window.M3D)
- 진입: `M3D.sync(units, GW, GH, dt, sel, enemies, selEnemy, scaleMul, view)` — 유닛/적 모델 동기화+렌더. 그 외 `syncShop/syncBuild/syncBldg/syncBoss`(탭별), `portrait`, `hasModel`, `loadMapModels/keepOnlyMap`(맵별 VRAM), `dbg()/matDbg(uid)`(디버그).
- `makeModel(id)` → `{holder(위치/스케일)→view(부감틸트)→yaw(회전)→anim(모션)}` + `inner/runInner/stayInner/atkInner`(정지/달리기/대기/공격 GLB) + `rim`(선택링 메시) + `shadow`.
- **피격·사망 연출 세기**: FX 스토어의 `hitK`(기본 1)가 impact·death 크기를 배율로 줄인다. 직스는 `STK_HIT_K=0.5` + `STK_DEATH_PARTS=5`(공용 기본 9) — 수백 기가 동시에 싸워 기본값이면 화면이 이펙트로 덮인다. **공용 FX 코어는 기본값 그대로**라 네모는 영향 없음.
- **인스턴싱(드로우콜 절감)**: 선택링=`ringInst`(_ringPush), 그림자=`shInstA/B`(_shadowInstPass, 지상0.22/공중0.26). 개별 `m.rim`은 직스 팀색·토벌장·적 선택용으로만 남음. 새 발밑 표시는 인스턴스 경로를 따를 것.
- **대군 최적화**: `_mixStride`(유닛>60 → 2프레임, >150 → 3프레임에 1회)로 스킨드 믹서를 분산(`_mixStep`). 건너뛴 프레임엔 `skeleton.update`도 홀드(`_mixHold`/`_skels`) — 본 포즈가 그대로라 화면은 동일하고 본 행렬·본 텍스처 업로드가 사라진다. 본 서브트리는 `hideBoneRoots`로 `visible=false` → three.js 렌더 순회에서 제외(손 본에 검 등 메시를 붙인 모델은 자동 제외). 해상도는 **직스 전장에서만** `STK_RES[strikeResMode()].gl`을 `M3D.sync`가 반영(고화질=1.2× 슈퍼샘플·절전=0.6×). 다른 게임(`G.strike` 거짓)·건설지(`syncBuild`는 네이티브 명시 리셋)엔 배율을 주지 않는다.
- **측정 훅(기본 off)**: `M3D.prof(true)` → `{loop, mw, render, calls, tris, objs, bones}`. `M3D.mixForce(n)`/`M3D.boneVis(on)` = 벤치 A/B 강제 토글.
- 플레이어색: `_toneInject`(HSV 본체 회색화+액센트 마스크) + fresnel 림(`addRim`). 상수: `TINT_*`, `RIM_*`(`RIM_MUL` 유닛별 배율).

## 7. 유즈맵 모듈 시스템
> 개별 유즈맵 설계는 **`NEMO_DESIGN.md`**(네모네모 디펜스 · 트랙 디펜스)와 **`STRIKE_DESIGN.md`**(출격! 라인 워 = 직스)가 갖는다.
> 관리자 샌드박스 탭별 진행 상태는 **`PROGRESS.md`**.
[공유 베이스](엔진·렌더·3D·UI셸·U) + [유즈맵 모듈](등급·가챠·밸런스·경제). 새 맵 = `USEMAPS`에 항목 추가 + `cfg`/`cfg.bal` 오버라이드. 직스(strike)가 "nemo 셸 재사용 게임플레이 모듈"의 선례.

## 8. 멀티/소셜
Supabase Realtime presence 기반(방 목록·로비·파티·귓말). 방 목록엔 시뮬 봇 방 혼재(`buildRoomList`). **게임플레이 자체는 로컬** — 각자 자기 트랙을 돌리고 채널로는 '상태'만 오간다.

### 멀티 검증 — 두 클라이언트 통합 테스트 `test/duo.mjs` (2026-08-20)
⚠ **스모크의 협동 테스트는 전부 가짜 채널이라 '보내는 것'만 잡는다.** 보내는 모양과 받는 모양이 어긋나도 절대 못 잡는데, 그 어긋남이 곧 **멀티가 조용히 죽는** 방식이다.

`duo.mjs` 는 페이지를 둘 띄우고 각자의 `_sb` 를 가짜 채널로 바꾼 뒤, A 가 `send` 한 것을 **B 의 핸들러로 실제로 넣는다** — `startGameCoop` 의 진짜 배선과 모든 수신 핸들러가 그대로 돈다. `npm test` 가 마지막 그룹으로 자동 실행한다(`node test/run-smoke.mjs duo` 로 단독 실행).

- 보는 것: 슬롯 번호·색이 양쪽에서 같은가 · 채팅 · 관전 보드가 **상대 유닛**인가(내 것이 아니라) · 대역폭 계약(관전 O/X) · 배속 수렴 · 공용 보스 데미지 · 재접속(away→live) · 패배 전파
- ⛔ **프레임 루프에 기대지 말 것.** 헤드리스에서 두 번째 페이지는 rAF·타이머가 throttle 된다 — `coopWatchSync()`·`coopBroadcastState()` 를 테스트가 직접 펌프한다(대신 "루프가 그것을 부르는가"는 소스로 따로 검사한다).
- ❌ 못 잡는 것: Supabase 자체의 전달 지연·서버 쿼터·인증. 그건 실기기 둘로만 확인된다.

### 자리(슬롯) 상태 — `slotState(n)` 이 단일 소스 (2026-08-20)
| 상태 | 뜻 | 관전 | 그리는 것 |
|---|---|---|---|
| `me` | 나 | — | 내 전장 |
| `live` | 게임 중인 다른 사람 | O | 그 사람 스냅(`renderSpectate`) |
| `done` | **승리 = 정지된 자리.** 유닛은 그대로 서 있고 시간만 멈춘다 | O | 마지막 스냅(얼어붙음) |
| `away` | **연결 끊김 — 자리를 잡아 둔 상태.** `AWAY_MS`(30초) 안에 돌아오면 복귀 | O | 마지막 스냅(얼어붙음) + 📡 |
| `dead` | 탈락·일부러 나감·복귀 실패 | X | **아무것도 없음**(`renderEmptySlot`) |
| `empty` | 애초에 안 들어온 자리 | X | **아무것도 없음** |

⛔ 다른 곳에서 `activePlayers`/`eliminated` 를 직접 뒤져 판정하지 말 것 — 판정이 두 벌이 되면 반드시 어긋난다.
- **`killSlot(n, reason)`** = 자리를 죽이는 유일한 입구. 탈락(`lost`)·이탈(`left`)이 같은 정리를 탄다 — `coopBoard`/`coopState`/`coopBossU`/`coopTeamB`/`coopSpeed`/`coopUpg`/`vote`/`coopWatchers` 에서 **지운다**(숨기는 게 아니라 삭제 — 남기면 관전 보드가 얼어붙은 채 계속 보인다).
- **`finishSlot(n)`** = 승리한 자리. 죽이지 않고 보드를 그대로 얼려 둔다.
- **배속 투표(`computeSpeed`)는 죽은 자리를 뺀다.** 협동 배속은 '전원 투표 중 최소'인데, 없는 사람이 기본값 1배로 계속 표를 던지면 판이 영원히 1배속에 묶인다.
- **`nemoGameOver(result)`** = 판 종료의 유일한 출구(`js/10-engine.js`). 상대에게 `over` 를 쏘고, 패배면 `clearMyField()` 로 내 유닛·적·투사체를 전부 지운다(배열을 직접 비운다 — 사망 처리 함수를 타면 킬·보상이 늘어난다). ⚠ **이 전파가 없으면 상대 화면에서 내가 영원히 살아 있다** — 내 브로드캐스트는 `phase!=='playing'` 이면 멈춰서 마지막 값에 얼어붙기 때문이다.
- `step(dt)` 는 `phase!=='playing'` 이면 안 돈다 → 승·패 어느 쪽이든 **새 유닛·새 적은 안 생긴다**(죽은 자리의 '아무것도 안 나온다'가 여기서 보장된다).

### 화면을 껐다 돌아왔을 때 — 따라잡기 / 판 포기 (2026-08-20)
`loop()` 의 `dt` 는 `Math.min(now-last,100)` 으로 잘려 있다. 그래서 탭이 숨겨져 있던 동안 **게임 시간이 흐르지 않고** 돌아오면 그 자리에서 이어졌다. 이제는 그 시간을 실제로 돌린다.

| 자리 비움 | 처리 |
|---|---|
| ~30초(`AWAY_MS`) | **`nemoCatchUp`** — 숨겨져 있던 만큼 `step()` 을 몰아서 돌린다. 명령을 못 냈으니 **적이 쌓인 채로 이어받는다.** |
| 30초 초과 | **`abandonRun`** — 실수가 아니라 의도적 이탈로 본다. **보상도 판 기록도 없이** 로비로. |

- ⚠ 이 30초는 상대가 내 자리를 잡아 두는 시간(`away`)과 **같은 값이어야 한다** — 다르면 한쪽에선 살아 있고 한쪽에선 죽은 상태가 된다. `AWAY_MS` 하나가 단일 소스다.
- 따라잡기는 **배속(`speedMul`)을 곱한다** — 2배속에서 10초를 비웠으면 게임 시간 20초가 흘러야 맞다.
- 비용은 문제가 아니다(실측: 30초치 ≈ 1,800스텝 ≈ 0.2초). ⚠ 다만 **효과음은 끈다**(`G._catchUp`) — 수십 개가 한꺼번에 터진다. 채팅은 남긴다: 자리를 비운 동안 무슨 일이 있었는지 읽을 수 있어야 한다.
- `abandonRun` 은 **결과창을 거치지 않는다.** `_runSummary` 가 돌면 `dqNote('umRun')`·`recordRunResult()`·`bankRunPoints()` 가 붙어 판으로 인정된다 — 그래서 `overlayToLobby()` 로 바로 나가고 `_pointsBanked` 로 정산을 막는다.
- **탭이 죽어도 30초는 이어진다** — 아래 「판 저장/복구」. 모바일은 화면을 내려두면 백그라운드 탭을 **통째로 버리는 일이 흔해서**, 돌아오면 페이지가 처음부터 다시 뜨고 `G` 가 사라진다. 따라잡기만으로는 못 살린다.
- ⚠ 실측 참고: 자리를 비우면 **약 5분에 탈락선(200기)에 닿는다**(라운드 10 · 유닛 24기 기준). 자동화(`stepAuto`)를 켜도 거의 차이가 없다 — 유닛 뽑기는 시민이 비콘까지 걸어가야 일어나는데 `stepCitizen` 은 `step()` 밖이고 **유닛뽑기 탭에서만** 돈다.

### 판 저장/복구 (2026-08-20)
숨는 순간(`nemoOnHide`·`pagehide`) 판을 `localStorage['nm_run']` 에 저장하고, 부팅 때 `enterAfterWarm()` 이 HOME 으로 끌어가기 **직전에** `tryRestoreRun()` 이 되돌린다. 나이가 `AWAY_MS`(30초) 이내면 복구 + 그동안을 `nemoCatchUp` 으로 따라잡고, 넘었으면 **버린다**(보상도 기록도 없음 — `abandonRun` 과 같은 규칙).

- ⛔ **저장본은 읽는 즉시 지운다.** 깨진 저장본이 남아 있으면 부팅이 **영원히** 같은 자리에서 막힌다. 삭제 → 파싱 순서를 바꾸지 말 것.
- ⛔ 부팅 호출부는 한 겹 더 `try/catch` 로 감싼다 — 여기서 예외가 나면 사용자가 HOME 에 영영 못 간다.
- 실패하면 `G=newGame()` 으로 깨끗이 되돌리고 평소 부팅으로 흘린다. **반쯤 복구된 상태로 두지 않는다.**
- ⚠ 저장할 때 `coopChan`(Supabase 채널)·`coopStateT`(타이머 id)·`_runSum` 은 뺀다 — 순환 참조라 `JSON.stringify` 가 통째로 실패한다.
- 판이 끝나면 `overlayToLobby()` 가 저장본을 지운다(끝난 판을 복구하면 안 된다). 탭이 살아서 돌아왔으면 `nemoOnShow` 가 지운다.
- 협동이었으면 복구 후 채널에 다시 붙어 본다 — **실패해도 판을 막지 않는다**(혼자 이어서 한다).

### 재접속 (2026-08-20)
⚠ **presence leave 는 '일부러 나감'과 '연결 끊김'을 구분하지 못한다** — 둘 다 소켓이 닫히는 같은 신호다. 그래서 신호를 하나 더 둔다.

| 신호 | 뜻 | 처리 |
|---|---|---|
| `over{lost}` | 패배 | 영구 `dead` |
| `over{won}` | 승리 | `done` |
| **`bye`** | 일부러 나감(나가기 확인) | 영구 `dead` |
| presence **leave** — `bye` 없이 | 연결 끊김 | **`away`** — 보드를 지우지 않고 30초 잡아 둔다 |
| presence **join** — `away` 중 | 재접속 | **`live` 복귀**(보드가 그대로라 이어진다) |
| `away` 30초 초과 (`tickAway`) | 복귀 실패 | 영구 `dead` |

돌아온 본인 쪽 처리는 위 「따라잡기 / 판 포기」를 볼 것 — 같은 30초를 쓴다.

- ⛔ `onCoopPlayerLeft` 에서 바로 `killSlot` 하지 말 것 — 지하철 순단에도 판에서 영구 제외된다. `awaySlot` 을 거친다.
- **끊긴 동안 지나간 일회성 사건**(누가 이겼나·졌나·나갔나, 배속 투표)은 pstate 로는 복구되지 않는다 → 돌아온 쪽이 `hello` 를 쏘고 각자 `resync`(`{over, speed, dead[], done[]}`)로 한 번 답한다. `killSlot`/`finishSlot` 은 멱등이라 중복 흡수해도 안전하다.
- 너무 늦게 돌아와 남들이 이미 나를 `dead` 로 지웠으면, `resync` 를 받은 쪽이 스스로 `stopGameCoop()` 한다(없는 사람이 계속 송신하지 않게).
- **영구히 죽은 자리에서 뒤늦게 온 `pstate` 는 무시한다**(`onCoopState` 첫 줄) — 안 그러면 지운 보드가 되살아난다.
- ⚠ **`away`·`dead` 는 보스 권위자(`coopAuthNum`)가 될 수 없다** — 그 사람이 최저 번호면 보스 HP 동기화가 통째로 멈춘다.
- ⚠ **`online` 이벤트는 `_coopRetryN` 을 반드시 리셋한다.** 안 하면 재시도 상한(5회)에 걸린 채라 `coopReconnect` 가 즉시 return 해서 **네트워크가 돌아와도 영영 재접속이 안 된다**(실제로 그랬다).

### 방 정원 · 외부 의존 (2026-08-20)
- **정원은 `rtRoomSync` 에서 강제한다.** `joinRoom` 의 사전 검사(`r.cur>=r.max`)는 방장이 presence 로 게시한 값을 보는 것이라 갱신 지연·동시 입장에 뚫린다 — 2인 방에 5명이 들어가 그대로 시작됐다. 모든 클라이언트가 같은 presence 를 같은 규칙(방장 먼저 → 입장순)으로 정렬하므로 판정이 일치한다. 정원 밖이면 두 번 연속 확인 후 `rtRoomKicked`(한 번의 어긋난 sync 로 튕기지 않게).
- ⚠ **`openLobby` 에 `max` 를 반드시 넘길 것.** 빠지면 참가자 쪽 `_lobbyMax` 가 8 로 잡혀 방 정원을 모른 채 대기실을 그린다(실제로 `joinRoom` 에서 빠져 있었다).
- **팀 강화 공유는 `G._tbPeak`(지급 근거가 된 최고치)보다 높아진 만큼만 준다.** '이번에 오른 만큼'을 주면 연결이 불안정한 사람이 나갔다 들어올 때마다 같은 보너스를 다시 지급해 판마다 미네랄이 조용히 불어난다.
- **`supabase-js` 는 정확한 버전으로 고정**(`@2.112.3`). `@2` 로 두면 esm.sh 가 내보내는 최신 2.x 로 조용히 바뀐다(three.js 는 이미 고정돼 있었다). ⚠ esm.sh 는 **단일 장애점** — 막히면 인증·방·소셜이 통째로 죽는다(게임 자체는 로컬이라 돌아간다).
- ⚠ **realtime-js 2.112.x 에는 클라이언트 쪽 전송 제한이 없다**(`eventsPerSecond`·throttle 모두 없음 — 소스 확인). 한도는 Supabase 프로젝트의 서버 쿼터뿐이라 많이 쏘면 클라이언트가 막아 주는 게 아니라 **서버가 끊는다**. 그래서 송신 빈도는 아래 규칙으로 우리가 직접 줄인다.

### 협동 채널 `game-{방번호}` — 대역폭 규칙 (2026-08-20)
`pstate`(10Hz)가 유닛·적·탄·빔을 통째로 실어 **R30 에서 한 번에 11.3KB**였다. 8인방이면 각자 초당 790KB를 받는다(실측).
- **전장 데이터(`u`/`e`/`s`/`b`)는 `iAmWatched()` 일 때만 싣는다.** 쓰는 곳이 관전 화면(`specRemoteBoard`)뿐이다. 아무도 안 보면 **164B**로 줄고 주기도 10Hz → 2Hz.
- 관전 대상은 `coopWatchSync()` 가 **바뀔 때만** `watch` 로 알린다(프레임마다 비교만). 이벤트를 놓쳐도 `pstate.w` 가 복구한다.
- 파견 유닛(`bu`)·보스 상태는 **토벌장이 열려 있을 때만**(`anyBossArenaOpen()`).
- **보스 데미지는 합산해서 `COOP_BOSSDMG_MS`(150ms)마다 한 번**(`coopBossDmgFlush`). 공격 1회마다 보내면 유닛 평균 2.02회/초 × 파견 수라 초당 20건이 넘었다. HP는 권위자가 `bs` 로 수렴시키므로 정밀도 손해 없음.
- `buildInterpBoard` 의 투사체 외삽은 **한 스냅 간격까지만** 클램프한다 — 정지(`done`)했거나 끊긴 상대의 탄이 영원히 날아가지 않게.
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
- **종족 상성(오각형)은 `node test/race-matchup.mjs [판수]` 로 잰다.** 헤드리스 크롬에 진짜 게임을 올려 `strikeStep` 을 그대로 돌리고 승패만 읽는다 — 양 진영을 AI 로 두고, 배출은 `strikeSpawnForPlayer` 의 AI 분기와 같은 식으로, **테크 깊이(배출 건물 수) 2~7 을 전부** 돌아 단계별 승률까지 낸다. 판마다 me/ai 를 바꿔 진영 편향을 상쇄한다.
  - ⛔ **자체 웨이브 모델을 새로 짜지 말 것.** `RACES.md` §7 이 그 길로 네 번 갔다가 전부 폐기했다 — 특히 "건물 **비용**으로 테크를 재는" 모델은 오토배틀과 다르다(오토배틀은 양 진영이 **같은 건물 수**로 배출한다).
  - 판당 ~30초. 5종족 전체(10대전 × 6깊이 × 5판)면 15분쯤 걸리므로 `protocolTimeout:0` 이 필요하다.
  - 값을 파일에 박기 전에 훑을 땐 배율 인자로: `node test/race-matchup.mjs 3 6 "" "swarm=0.95" "feral:colossus"`.
- 스위트 본체: `test/smoke.js` (인페이지 주입, `runSmoke(group)`), 러너: `test/run-smoke.mjs`(내장 정적 서버+puppeteer-core→시스템 크롬).
- 스텝 추가법: `test/smoke.js`의 해당 그룹 함수에 `await step('이름', ()=>{ ... assert(...) })` 한 줄. 없는 기능은 `skipIf`.
- 수정 후 `npm test` 통과 없이 "완료" 선언 금지. 구문 검사는 vm.Script(classic)+`node --check`(module).

## 10. 함정 목록 (실제로 밟았던 것)
- **`#vUnit`/`#bpUnit`(옛 유닛뽑기 화면)은 아무도 못 여는 죽은 화면이다 — 감사 대상이 아니다** (2026-08-20 확인).
  「유닛뽑기」 탭의 `onclick` 은 `openGachaSheet()` → `openMainSheet('gacha', el, 'Unit')` 이고, **이건 `G.tab` 을 `'Main'` 에 둔 채 `#unitCmd` 에 시트만 올린다.** `G.tab='Unit'` 로 가는 유일한 길인 `switchTab('Unit', …)` 은 `openGachaSheet` 안의 `if(G.strike)` 분기 하나뿐인데, 그건 첫 줄에서 `strikeSwitchTab` 으로 빠져 이 코드에 닿지 않는다. 관리자 샌드박스에서는 Unit 탭이 **이펙트 랩**으로 갈아끼워지며 `shopProfile`·`prodHint`·`gachaActions`·`opsManual` 을 명시적으로 숨긴다.
  - 그래서 비콘 시계 필드(`buildClock`·시민·`moveCitizenTo`) · `#gachaActions`(`.gaBtn` 6칸) · `#opsManual`(생산고 운용 안내) · `#rateMini`(뽑기 확률표) 는 **어느 모드에서도 화면에 나오지 않는다**. 지금 쓰는 것은 `renderGachaSheet()` → `renderCmdGrid` 시트 한 벌뿐이다.
  - ⛔ **디자인 감사에서 `switchTab('Unit')` 을 직접 불러 화면을 띄우지 말 것.** 실제로 그렇게 뽑은 스크린샷이 "옛 스타일이 남은 화면" 1순위로 올라갔고, 그 여파로 네모네모 디펜스 유즈맵을 잘못 내렸다(되돌림). 감사는 **실제 조작 경로로만** 도달한 화면을 대상으로 한다.
  - 걷어내는 것 자체는 별건이다 — `DRAW_BEACONS` 는 지금 시트도 쓰고(`GACHA_SEC_CELLS`), `M3D` 비콘 풀·`G.citizen` 이 물려 있어 의존을 하나씩 끊어야 한다.
- **죽은 코드 판정에 이름 검색을 쓰면 조립되는 이름을 못 본다** (2026-08-14, 실제로 회귀를 냈다). 클래스·에셋 이름의 상당수가 문자열로 조립된다 — `'mcLine sc-'+scope` · `'fDot-'+st` · `'bld_'+key` · `'up_'+UPG_ICO[k]` · `'sk_'+(SKILL_ICO[k]||k)` · `'dg'+n` · `'vc-'+spd`. 문서 전체 검색으로 0회라고 지우면 **로비 채팅이 통째로 안 보이는** 식으로 조용히 깨진다(`.msChat .mcLine{display:none}` + `.sc-*{display:block}` 구조라 CSS만 지워도 기능이 죽는다).
  - 판정 절차: ① 이름이 그대로 나오는가 → ② 안 나오면 **조립 접두사 대조**(`'P'+` 형태의 문자열 리터럴을 모아 `name.startsWith(P)` 확인) → ③ 그래도 애매하면 브라우저에서 화면을 돌며 `document.querySelector('.'+c)` 로 실물 확인.
  - 지운 목록·오탐 목록은 `CLEANUP.md` 에 남긴다.
- **던전 배경은 정지 1장 + (선택) 움직임 4프레임이다.** `dgN.webp`가 기본, `dgN_f1..f4.webp`가 있으면 `hbFloor`가 두 장을 겹쳐 크로스페이드한다. 순서는 **핑퐁(1→2→3→4→3→2)** — 순환하면 영상의 끝↔처음이 달라 툭 튄다. 위상은 순수 함수 `hbBgPhase(t,n)`이라 스모크가 이음새·인접프레임·최대점프를 직접 검사한다. ⛔ 프레임 수를 늘리지 말 것: 1024² 한 장이 디코딩되면 4MB라 32장이면 134MB다. 실측 비용은 60fps 유지(측정 노이즈 이하).
- **던전 전체 개방은 `HB_DG_ALL_OPEN` 한 줄이다(지금 `true`).** 배경·밸런스를 던전별로 확인하려고 열어 뒀다. 해금 진행을 되살리려면 이 값만 `false`. `const`가 아니라 `let`인 이유는 스모크가 껐다 켜며 **양쪽 상태를 다 검사**하기 때문 — 기본값을 바꿔도 테스트는 그대로 통과한다.
- **웨이브 실패 = 1웨이브부터 다시, 라운드는 유지** (2026-08-12). `hbWaveFail()` — 20초 안에 필드를 못 비우면 `phase='fail'`, `HB_FAIL_S`(3초) 뒤 캐릭터가 **가운데(회복 구역)에서 최대 체력으로** 서고 `wave=1`로 재시작한다.
  - **죽음(`hbDie`)과 구분할 것** — 죽으면 라운드가 내려가지만, 시간 초과는 라운드를 유지하고 클리어 보너스 몫(`_hb.buf`)만 잃는다.
  - 예전 규칙은 "시간이 끝나도 다음 웨이브로 넘어가 적이 누적"이었다. 그래서 `mop`(마지막 웨이브 잔존 소탕) 단계는 **진입 경로가 없어졌다** — 함수는 옛 저장 호환으로만 남겨 뒀다.
- **🏁 던전 = `HB_ROUND_MAX`(99)라운드짜리 챕터다**(2026-08-18). 99를 깨면 `hbAdvanceDungeon()`이 자동으로 다음 던전 1라운드로 넘긴다(등반 모드만 — 반복은 그 라운드를 계속 돈다). ⭐ **던전 배수는 라운드 곡선을 99칸 이어 붙인 것**이다(`hbCurve(base,dg,round)`) — 경계가 계단이 아니라 '한 칸'이다. 전역 진행도 = `hbProg(dg,round)`. **던전 최초 진입에는 보너스(`HB_DG_ENTER`)** 를 준다 — 경계가 매끄러운 대신 '올라섰다'는 순간이 없어서다(`hunt.dgIn` 에 기록, 한 번뿐). ⚠ **내려오는 길도 있어야 한다**: `hbDie` 에서 라운드가 1 밑이면 `hbRetreatDungeon()` 이 이전 던전 99로 물린다 — 없을 때 자동 이동으로 올라간 던전 1라운드에 **영영 갇혔다**(실측 40시간 헛돔). ⛔ 옛 고정 배수(체력 8·공격 5·보상 24)로 되돌리지 말 것 — 99라운드(체력 240만 배)를 민 뒤 다음 던전이 8배로 떨어져 난이도가 통째로 무너진다. 던전 해금 `HB_DG_UNLOCK`도 99다. ⚠ 곡선이 지수라 재화가 던전 3에서 1e12를 넘는다 → `CUR_SUF`가 3자리 단위로 Vg(1e63)까지 잇고 그 위는 지수 표기다.
- **📈 라운드 난이도 = 지수 × 던전별 기울기 × S자 리듬**(2026-08-19 개편). `HB_ROUND_HP`(1.10) / `HB_ROUND_ATK`(1.13) / `HB_ROUND_REW`(1.14) / `HB_ROUND_XP`(1.03) 는 **던전 1 기준값**이고, 전부 `hbCurve(base, dg, round)` 한 함수를 지난다. ⚠ 새 라운드 스케일을 만들면 **반드시 `hbCurve`를 쓸 것** — `hbChestHp`를 선형으로 남겨 뒀더니 라운드 60에서 상자가 적의 1/300이라 한 대에 깨졌다.
  - **📐 던전별 기울기** `hbRoundHp(dg) = 1.10 + (dg-1)×0.035`. 옛 구조는 상수 하나라 **던전마다 요구 파워가 같았고**, 그래서 필요한 레벨도 평평했다(실측 354·345·338). ⚠ 체력만 올리면 후반 던전이 '고생만 하고 보상은 짜다'가 된다 → 공격·보상·경험치를 **같은 로그 배율(`hbDgK`)** 로 함께 민다. 그래야 던전 안에서 체력:공격:보상:경험치 관계가 어디서나 같다.
  - **🌊 던전 안의 S자** `hbRoundS(round) = exp(-HB_ROUND_S × sin(2π(round-1)/99))`. 라운드당 상승률이 **낮음 → 높음 → 낮음** — 도입·고비·마무리의 리듬이 생긴다. 한 주기가 정확히 던전 하나라 **총량은 변하지 않는다**(재배치일 뿐). ⚠ **보상에는 태우지 않는다** — 태우면 중반 고비가 '힘든데 보상도 짜다'가 된다. 균일하게 두면 중반은 손해·후반은 꿀이 되어 돌파 보상이 붙는다.
  - 순서(**HP > REW > ATK > XP**)는 그대로다: 시급은 오르되 조금씩 빡세지고, **XP가 제일 완만해야 레벨이 적 체력을 못 따라가 '벽'이 생긴다**.
  - ⚠ 스모크의 경계 검사는 둘로 갈린다 — 보상·경험치는 S자를 안 타므로 **정확 일치**, 체력·공격은 경계 한 칸이 **그 던전의 칸 범위 안**인지로 본다. 그리고 경계를 넘는 칸은 *다음* 던전이 아니라 **지금 던전의 99→100번째 칸**이다(한 번 헛짚었다).
- **📦 상자는 '공격 대상'이다** (2026-08-12). 사냥터는 회복 구역이 중앙이고 적이 알아서 찾아오니 가운데를 뜰 이유가 없었다. 상자는 사거리 안에 들어와야 때린다 → 초반엔 걸어가야 하고, **사거리를 올릴수록 앉은 자리에서 더 많이 부순다**(방치 보상이 사거리 업그레이드에 붙는다).
  - **적이 항상 우선** — 적이 사거리에 있으면 상자는 안 때린다. 안 그러면 상자 때문에 딜을 흘려 웨이브를 못 버틴다.
  - ⚠ **사거리 상한 `HB_RNG_MAX`(420 ≈ 맵 `HB_MAP_R` 300의 대각선)와 카메라 줌 기준 `HB_ZOOM_RNG_MAX`(190)는 다른 상수다.** 한 상수로 겸용하다 상한을 올리는 순간 같은 사거리에서 화면이 더 멀어졌다(사거리 74 기준 보이는 높이 530 → 602). 상한을 만질 땐 줌 기준은 그대로 두는 것이 기본이다.
  - 웨이브마다 1개(최대 `HB_CHEST_MAX`), **다음 웨이브가 시작되면 사라진다**(`hbSpawnWave`에서 초기화) — 모아 두고 한 번에 줍는 게 최적이 되지 않게.
  - 캐릭터에서 `HB_CHEST_MIN_D` 밖 · 회복 구역 위 제외 · **보이는 영역 안**(맵이 화면의 2×2라 밖에 두면 있는 줄도 모른다. 가장자리 화살표는 아직 없다).
  - 보상은 섞어서(`hbChestReward`): 뽑기권 74% · 일시 버프 20% · 젬 6%. **미네랄은 일부러 안 준다** — 상자 효율이 웨이브 효율을 넘으면 전투를 방치하고 상자만 도는 게 최적이 된다. 젬은 그전까지 획득 경로가 없던 재화다.
- **성장 축은 미네랄 업그레이드(`HB_UPG`) 하나다** (2026-08-12 확정). ⭐ **`HB_UPG`는 값의 단일 소스이자 31종 전부 전투에 배선돼 있다**(2026-08-18). `v0`/`vs`는 '카드에 적는 숫자'가 아니라 **전투에 들어가는 숫자**다. 배선처는 넷뿐 — `csAxis`(7축) · `hbCharStats`(축이 아닌 캐릭터 직결 17종: 흡혈·넉백·멀티샷·바운스샷·슈퍼치명·실드·재화·이속·재생범위) · `hbAllyMul`(동료·터렛·벙커체력·펫) · `hbBunkerAtkMul`(벙커 공격력). 새 키를 넣으면 반드시 이 중 한 곳에 걸 것 — **표에만 있고 안 걸린 키는 거짓말**이고, 실제로 17종이 그 상태로 오래 남아 있었다. 비용은 `base`(최저 5) × `mul`(최대 1.15)로 2026-08-18에 하향했다. 구역은 `HB_UPG_CAT` 4개 — `char`(내 캐릭터) · `ally`(동료) · `bld`(건물) · `pet`(펫). 아군 3구역의 업그레이드는 **`hbAllyMul()` 한 곳에서만** 실제 수치가 된다(`HB_ALLY_DPS` 등 상수를 호출부에서 직접 쓰지 말 것). `HB_UPG_CAT_BUILD`가 지정한 구역은 **건설(수량) 카드도 같은 격자에 함께** 낸다 — 사는 곳과 키우는 곳을 나누지 않는다. 옛 구역 키(atk/def/util)가 저장돼 있으면 `hbHunt()`가 `char`로 되돌린다. 캐릭터 스탯에 **직접 찍는 경로는 없다** — 레벨 포인트도, 자동 배분도 폐지했다(`profAllocStat`·`hmAllocStat`·`profDoAlloc`·`profGainStats` 전부 삭제).
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
- **'아직 저장 안 됨'을 전제로 하는 검사는 준비 상태를 강제해야 한다.** 사냥터는 저장 지점이 여럿이다 — 8처치 주기(`HB_SAVE_KILLS`) · 라운드 정산(`hbSettle`) · **자동 업그레이드가 코인을 쓰면 `hmAutoUpgTick`이 `saveMeta`** · 떠날 때 flush. 스모크 `자동사냥: 라운드 정산 …` 은 "마지막 저장 이후에 번 돈"을 만들어 놓고 화면 이탈 flush 를 검사하는데, 그 창 안에서 위 저장 중 하나가 끼어들면 준비가 무너져 **간헐 실패**했다(앞 단계의 난수·잔여 상태에 따라 갈렸다). 지금은 기준점의 저장본을 들고 있다가 **되돌려서** 준비 상태를 확정한다(메모리의 `PROF()` 는 건드리지 않으므로 검사 대상은 그대로다). 예약 출현(`_hb.pend`)도 함께 비운다 — 안 비우면 창 안에서 다른 적이 튀어나와 처치가 쌓인다.
- **⚠ 오래 걸리는 비동기가 끝나고 화면을 끌어간다 — 같은 함정이 두 번 나왔다.**
  - `enterAfterWarm()` 은 3D 예열(`warmAll`)을 기다린 뒤 `openHome()` 을 불렀는데, 예열은 실기기에서 1초 안이어도 **헤드리스 소프트웨어 렌더러에선 20초를 넘는다**. 그 사이 사용자가 게임에 들어가 있으면 `openHome → showAppScreen → setInGame(false)` 가 걸려 **하단 콘솔(`#bot`)이 통째로 사라졌다**(`#phone:not(.inGame) #bot{display:none}`). 지금은 `#phone.inGame` 이면 끌어오지 않는다.
  - ⛔ 이 가드를 "`#opening` 이 감춰졌으면 return" 으로 넓게 잡지 말 것 — 예열 중 다른 경로가 오프닝을 내리는 경우가 있어 **정상 진입까지 막힌다**(실제로 게스트가 HOME 에 못 갔다).
  - 스모크에서 오토배틀 하단 판 높이가 0 으로 나오면 이 증상이다(그 스텝이 그렇게 알려 준다).
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
- **캐릭터 구역(`upgScreen`) = 스탯 · 환생 · 스킬** (`CHR_SECS` / `NAV_TREE`의 `upg`). **스탯**은 이 화면 전용 렌더러(`renderChrStat`)이고, **환생**만 팝업 본문(`#hbGrowBody`)을 빌려 온다(`chrReturnBody`가 되돌린다). ⚠ '스탯 출처' 상세표는 **사냥터 좌상단 프로필**(`#hbHud` → `hbOpenInfo` → `renderInfoModal`)이 주인이다 — 같은 표를 두 곳에 두지 말 것.
- **📊 기본 스탯 = 전투 수치 그 자체다** (`CS_AXES` / `CS_ORDER` / `csAxis(k)` / `csVal(k)`). 축 하나의 값 = **(기본 + 사냥터 업그레이드 + 장비) × 레벨 포인트 × 환생 포인트**. ⭐ **기본값·레벨당 증가는 `CS_AXES`가 갖지 않는다 — `HB_UPG[upgK].v0/.vs`가 단일 소스**(2026-08-18). 그전엔 두 벌이라 카드가 거짓말을 했다(카드 '데미지 10/+2' ↔ 전투 12/+3 · 카드 '사거리 100' ↔ 전투 34). `CS_AXES`에 `base`/`upgV`를 다시 넣지 말 것 — 스모크가 검사한다. 출처는 이 **넷뿐**이다 — 직업(`PROF_JOBS`)·진화(★)·펫 %는 2026-08-18에 전부 걷어냈다. ⛔ `hbCharStats` 안에 식을 다시 적지 말 것: 전투도 스탯 출처 표도 `csAxis()` 하나만 읽는다(두 벌이 되면 반드시 어긋난다). 던전(`dgMySpec`)도 여기서 나온다.
- **캐릭터 사격은 `hbCharShot()` → `hbCharHit()` 한 경로다**(2026-08-18). 치명타·슈퍼치명·생명력 흡수·넉백·멀티샷·바운스샷이 전부 여기 있다 — ⛔ `hbStep` 안에 피해식을 다시 적지 말 것(예전엔 치명타만 인라인이라 새 효과를 걸 자리가 없었다). 부가 표적은 `HB_MULTI_MUL`·`HB_BOUNCE_MUL`로 깎아서 맞는다. **피격은 `hbCharTake()` 한 곳** — 🛡 실드(`c.shd`)가 먼저 닳고 남은 만큼만 체력에 들어간다. 회복 구역 반경은 `hbHealR()`(재생 범위 업그레이드 `rrng` 배수 — 걷기·그리기·상자 배치가 전부 이 함수를 본다). 웨이브를 비울 때 나오는 재화는 `hbWaveReward()`(업그레이드 `mw`/`gw`로만 생긴다).
- **전투 수치 = 기본 스탯 × `csBonus(k)`** — 장비 어빌리티 %·펫/동료 패시브가 생기면 **`csBonus` 안에서만** 곱한다. 지금은 원천이 없어 항상 1이다.
- **💠 살 수 있는가 = `hmUpgOff(key)` 한 함수** — 그릴 때(`renderHome`/`hbBuildCardHTML`)와 다시 칠할 때(`hmUpgAfford`)가 **같은 판정**을 쓴다. ⛔ 두 벌로 두면 '회색인데 눌리는 버튼'이 생긴다. 값은 `hmUpgCost(key)`(건설 카드는 `'b_<종류>'`).
  - ⚠ **재화가 늘어도 카드를 다시 그리지 않는다**(30장을 매 틱 다시 그릴 수 없다). 전투 틱이 0.2초마다 `hmUpgAfford()` 로 `.off` 만 다시 칠한다 — 이게 없으면 미네랄이 충분해져도 **화면을 떠났다 와야** 버튼이 열린다(2026-08-19 버그).
- **🤖 자동 업그레이드(`hbHunt().upgAuto` / `hmAutoUpgTick`)** — 켜 두면 살 수 있는 것 중 **가장 싼 것**을 계속 산다(`hmAutoNext`). 대상을 고르게 하지 않는 이유: 업그레이드가 31종·4구역이라 하나만 고르면 나머지가 놀고, 싼 것부터 사면 저절로 고르게 오른다. 잠긴 칸의 해금도 포함한다. ⚠ 한 틱 상한 `HM_AUTO_MAX` 필수(미네랄이 많으면 프레임이 통째로 멈춘다). ⚠ `hmBuyUpg`/`hmUnlockUpg` 를 쓰면 안 된다 — 매번 `renderHome()`과 소리를 부른다. 조용한 경로(`hmBuyUpgQuiet(k, true)`)로 사고 산 게 있을 때만 한 번 다시 그린다.
- **사냥터 업그레이드 패널에 접기는 없다**(2026-08-19 폐지). 늘 펴 두는 구역이라 접는 칸이 자리만 먹었다. ⚠ `.hmUpg.down` 스타일은 마을 패널이 아직 쓰므로 남아 있다.
- **📈 성장 곡선(2026-08-19 전면 재설계)** — 사냥터는 **주 무대가 아니다**. 유즈맵이 중심이고 여기는 눌러 놓고 떠나는 곳이라, 자주 눌러야 하는 것은 **사냥터 업그레이드 하나**뿐이다. 나머지는 느리거나 자동이다.
  - **경험치**: `PROF_LV_SOFT`(30) 미만은 다항식, 그 이상은 **등비**(레벨당 ×`PROF_XP_GEO`). 두 식은 경계에서 값이 같아 이어진다.
  - **환생**: **`PROF_REB_MIN_LV`(100)부터 언제든, 몇 번이든**. 레벨 상한은 없다. 보상은 회차가 아니라 **그때의 레벨**이 정하고, **유즈맵 포인트 관문**(`(레벨-100)×PROF_REB_POINT_R`)이 붙는다 — 첫 환생(딱 Lv100)만 무료다.
  - **환생 보상 = 두 배수**: `profXpMul`(경험치) · `profCoinMul`(미네랄 획득). ⚠ **밑이 하나다** — 환생 때 `c.rebMul += PROF_REB_GAIN×N` 로 쌓고, 미네랄은 그 값에 `PROF_REB_COIN_R`(0.7)을 곱해 꺼낸다. 따로 세면 두 배수가 언젠가 갈라진다(스모크가 대조).
  - ⚠ **미네랄 '획득'은 `profGainCoin(n)` 한 곳을 지난다**(처치·라운드 보상·클리어 보너스·방치·레벨업). 되돌려받는 것(장비 분해·마이그레이션 보정)은 **여기를 지나면 안 된다** — 배수가 붙으면 분해로 무한 증식이 된다(스모크가 검사).
- **🎯 레벨 포인트(`LP_STATS` / `unit.pts` / `lpMul`)** — 레벨업으로 얻어 **선형 배수**(`1 + n×LP_STEP`, 1p=+5%). 총량 = `(레벨-1)×LP_PER_LEVEL`, 환생하면 레벨과 함께 되감긴다.
  - ⚠ **성장 축이 넷인데 역할이 다 다르다** — 미네랄 업그레이드 `log(미네랄)`(사이클 안에서 쌓기) · 레벨 포인트 **선형**(조용히 붙기) · **환생 포인트 복리**(던전을 뚫는 힘) · 환생 배수 **선형**(사이클 속도). ⛔ 섞지 말 것: 지수 축이 둘이 되면 반드시 한쪽이 폭주한다.
- **🤖 자동 배분(`c.lpAuto` = 대상 축의 키, `''`=끔 · 기본 `LP_AUTO_DEFAULT`)** — 레벨업 때 **미리 골라 둔 한 축에만** 계속 찍는다(`lpAutoSpend`). 고르는 흐름은 `lpAutoBtn`(머리 버튼 하나가 상태에 따라 **자동 선택 / 취소 / 지정 해제**) + `lpAutoSet(k)`(고르는 중에 카드를 눌러 지정). 고르는 중(`_lpPicking`)은 저장하지 않는 순간 상태라 `setChrSec` 에서 끈다. ⚠ 옛 저장은 `0/1` 이라 `fixChar` 가 키로 옮긴다.
- **🔁 환생 포인트(`unit.rpts` / `rpMul`)** — 환생으로만 얻고 **환생해도 남는다**. ⚠ 레벨 포인트와 **다른 필드**다 — 같이 담으면 환생 때 같이 날아간다.
  - ⭐ **이 축이 전투력의 지수 성장을 담당한다** — `rpMul(k) = (1+RP_STEP)^n`, `RP_STEP=0.27`. 적 체력이 라운드에 대해 지수라 **어딘가 하나는 지수여야 던전이 진행된다**. ⛔ 선형으로 되돌리지 말 것 — 그러면 어떤 축도 지수가 아니라, 미네랄을 ×1300만 벌어도 라운드가 88에서 멎는다(실측).
  - **지급은 적게, 효과는 세게, 재투자는 비싸게** — 지급 `1 + PROF_REB_RP_K(60)×ln(1+초과레벨)` · 체증 `ptCostAt('rp') = 1+floor(k/5)`. 체증이 칸을 `√(10P)` 로 눕혀 **네 배 모아야 두 배**가 되므로, 복리인데도 발산하지 않는다. 그 체감이 지급식에 숨지 않고 **화면에 -3p, -4p 로 보이는 자리**에 있다.
  - ⚠ 지급식이 **log**인 이유: 레벨 비례(선형)면 초반엔 모자라고 후반엔 과해서 **던전이 오를수록 필요한 레벨이 거꾸로 줄어든다**(실측 D1 334 · D2 720 · D3 1017). √ 도 부족했고(D2 698) log 라야 뒤 던전이 더 든다.
  - ⚠ 레벨 포인트는 `ptCostAt` 이 1 고정이다 — '가끔 눌러 두면 조용히 붙는' 축이라 매번 비용을 계산하게 만들면 성격이 어긋난다.
- **포인트 UI는 `_ptListHTML(kind, c)` 한 함수**다(`kind`='lp' 캐릭터>스탯 / 'rp' 캐릭터>환생). 조작도 `ptTap`/`ptDoReset` 하나로 모인다 — 화면이 둘이라고 동작을 두 벌 만들지 말 것. **카드는 사냥터 업그레이드와 같은 `hmUpCardHTML()`** 을, 초기화 버튼은 사냥터 수량 버튼(`.hmUpQty>.hmUpQ`)을 그대로 쓴다(스모크가 '카드 뼈대가 사냥터 것과 같은가'를 검사한다). ⚠ 카드 버튼 윗줄은 **지금 레벨만** 적는다 — 값 변화 화살표는 제목 아래 줄에만 쓴다(`nextLv` 인자는 없앴다).
- **찍는 값은 `ptCostAt(kind, k, lv)`** 하나가 정한다(지금은 어디나 1p). 버튼 표기·`ptSpent`(들어간 총합)·`lpAdd`/`rpAdd`(구매 루프)가 전부 여기서 나오므로, 비용 곡선을 올릴 땐 이 함수만 고치면 된다. ⚠ 저장되는 값(`unit.pts`/`unit.rpts`)은 **'찍은 칸 수'** 지 '쓴 포인트'가 아니다 — 쓴 포인트는 곡선을 되짚어 계산한다.
- **아군 배수(동료·건물 데미지)는 기본 스탯 축이 아니다** — 내 수치가 아니라 `hbAllyMul`/`hbBunkerAtkMul` 이 읽는 별도 축이라 스탯 출처 표에 넣지 않는다.
- **`hbSyncChar(heal)`** — 전투 중인 `_hb.char` 에 수치를 다시 입히는 **단일 지점**. 업그레이드 구매·성장·포인트 투자·화면 복귀가 전부 이걸 부른다. ⛔ 복사문을 손으로 다시 적지 말 것(예전엔 세 군데에 흩어져 있어 새 수치를 넣을 때 빠뜨리기 쉬웠다).
- **등급은 계정 공용 7단계 사다리 하나뿐이다** — `GACHA_TIER_ORDER`(순서) · `GACHA_TIERS`(이름) · `TIER_COLOR`(색). 장비(`PROF_ITEM_TIERS`) · 동료 · 펫이 전부 같은 id 를 쓴다. 등급을 하나 늘리려면 `GACHA_TIER_ORDER` 만 고치고 나머지는 따라오게 둘 것. 단계 번호는 `tierRank(id)`, 이름은 `tierName(id)`.
- **칸에 등급을 입히는 건 `tierFrame(tier, extraStyle)` + 안쪽의 `TIER_FRAME_HTML` 한 쌍이다.** 착용 칸(`.pdSlot.on`)과 가방 칸(`.igCell`)이 이 한 함수만 쓴다 — 호출부에서 `TIER_COLOR` 를 다시 꺼내면 두 화면이 어긋난다. CSS 사다리는 `[data-tr="1".."7"]` 가 변수(`--tfB` 아랫변 · `--tfR` 안쪽 링 · `--tfKL` 브래킷 · `--tfG` 글로우)를 정하고 `.tfx` 층이 그린다. 자세한 규칙은 DESIGN.md 「등급 프레임」.
- **장비 그림은 `gearIco(slot, tier)`** — `GEAR_ART` 목록에 있는 키만 `<img>` 가 되고 나머지는 내장 라인아트(`PROF_SLOT_ICON`)로 돌아간다. ⚠ 목록을 거치지 않고 파일명을 바로 `src` 로 걸면 가방 40칸이 전부 404를 쏜다. 파일 규격은 `assets/icons/gear/README.md`.
- **가방은 페이퍼돌 페이지(`_gearPage`)를 그대로 따라간다** — `_profGearGrid`에 넘기는 목록이 `PROF_GEAR[i.slot].part===_gearPage`로 걸러진다. 가방 전용 분류 칩(옛 `PROF_BAG_CATS`/`profBagCat`)은 2026-08-18에 삭제했다: 같은 축을 두 군데서 고르게 하면 서로 어긋난다. `.bagHead`에는 지금 페이지 이름(`_gearPageName()`)과 `보유수/PROF_INV_MAX`만 **한 줄**로 들어간다(따로 줄을 잡으면 가방이 26px 커지고 위 세그먼트 바와 똑같이 보여 헷갈린다). 칸을 지정한 상태(`_gearPick`)에선 그 자리에 `이름 + 전체` 버튼이 온다.
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
- **게임 진입 화면은 두 단계다 — 로딩(막대) → 준비(버튼)**(2026-08-19). 예전엔 시작 버튼이 처음부터 눌려서 **막대도 버튼도 뜻이 없었다**(막대는 그냥 5초 타이머).
  - ① `_gsEnterLoading()` — 막대 `#gsBarFill` 이 **실제 로딩**을 따라 찬다. 그동안 `#opStart` 는 `disabled`(잠김 모습은 공용 `.actBtn:disabled` 가 갖는다).
    - **실제 = 그 맵의 3D 모델**(`M3D.loadMapModels(id, done, onProg)` → `ensureModels` 의 `onProg(받은수,전체)`). `MAP_ASSETS` 기준이고 **아직 없는 것만** 큐잉하므로, 로그인 때 데워졌으면 총 0개라 즉시 끝난다(두 번째 진입이 느려지지 않는다).
    - 표시값은 **시간과 실제 중 늦은 쪽**이다: `min(경과/GS_LOAD_MS, 실제진행률)`. 실제가 빨라도 `GS_LOAD_MS`(800ms)는 채워 깜빡임을 막고, 최소 시간이 지나도 실제가 안 끝났으면 기다린다 — **막대가 거짓말하지 않는다.**
    - ⚠ 안전판 `GS_LOAD_MAX`(15s) — 모델 하나가 영영 안 오면 막대를 100%로 열어 준다. 없으면 사용자가 진입 화면에 갇힌다.
  - ② 100% 가 되는 순간 버튼이 열리고 스스로 `_gsEnterReady()` 로 넘어간다 — 거기서부터 시작 버튼 진행 표시(자동 시작 `GS_READY_MS`)가 돈다.
  - 막대의 뜻이 단계마다 다르다: 로딩 중 = **LOADING %** (혼자든 여럿이든) · 그 뒤 = 혼자면 「시작을 누르세요」, 여럿이면 **준비 n/N**. `_gsPaintCount` 가 `_gsLoading` 으로 가른다.
  - ⚠ `_gsLoading` 플래그는 **나가기(`gsQuitToMaps`)·종료(`_gsFinish`)에서도 내린다** — 잠금이 남으면 다음 진입에서 시작 버튼을 영영 못 누른다.
  - ⚠ 스모크에서 준비 인원 표기를 검사하려면 **로딩이 끝나기를 기다려야** 한다(`while(_gsLoading)`). 안 그러면 `LOADING 15%` 를 읽는다.
- **부팅 로딩(`#opening` 비-counting)은 시네마틱이다**(2026-08-20). 구조는 `.opArt`(키 아트) + `.opWrap > [.opMid(엠블럼·제목·서브) · .opDock(라벨·숫자·막대)]`.
  진입 카운트다운(`.counting`)은 `.opWrap` 을 감추고 `#gsRoot` 만 띄우는 **별개 층**이라 서로 안 건드린다(`#opening.counting .opArt{display:none}`).
  - ⚠ `.opWrap` 은 통계 창(`#resultScreen`)과 공용 — 부팅 값은 전부 `#opening` 안에서만 덮는다. 특히 `align-items:center`(공용)를 `stretch` 로 덮지 않으면 하단 도크가 내용 폭으로 쪼그라든다.
  - ⚠ `.opLoading` 은 이제 **진행률 숫자**다(옛 `LOADING…` 문구가 아니다). `opBarStart/Done` 이 이 요소의 `innerHTML` 에 `n<s>%</s>` 를 쓴다.
  - ⚠ 마지막 100% 는 **CSS 전환 없이 즉시** 채운다 — 전환은 프레임이 있어야 진행되므로 탭이 가려지면 막대가 0 에 남는다(실측: 인라인 `width:100%` 인데 계산값 `0px`). 그래서 구 `LOAD_SNAP` 은 폐지했다.
  - 배경 그림 규격은 **ART.md §8**(타이틀 계열) — `scripts/title-bg.mjs`. 유즈맵 키 아트(`usemap-bg.mjs`)와 시점·구도·밝기·채도 규칙이 다르다.
- **로딩 막대는 `.opBar` 하나이고 규칙은 「항상 100% → 0.2초 → 전환」이다**(2026-08-19).
  전에는 막대(CSS `opLoad 1.6s`)와 화면 전환(`showLoading` 의 1.1~1.3초 타이머)이 **따로 돌아** 막대가 80% 쯤에서 잘린 채 넘어갔다.
  이제 전환은 반드시 **`opBarDone()` 의 약속을 기다린다** — 새 타이머를 따로 두지 말 것.
  - 입구 넷: `opBarStart(dur)` 시작 · `opBarReal(p)` 실제 진행률 먹이기 · `opBarDone()` 100%+0.2초 뒤 resolve · `opBarReset()` 원복.
  - 막대는 **시간과 실제 진행률 중 앞선 쪽**을 따른다. 실제 로딩이 순식간에 끝나도 `LOAD_FILL`(700ms)만큼은 차오르는 걸 보여 준다.
  - 값 셋: `LOAD_FILL` 차는 시간 · `LOAD_SNAP` 마지막 칸(110ms) · `LOAD_HOLD` 100% 유지(200ms). ⚠ **0.2초는 다 찬 뒤부터**다 — LOAD_SNAP 과 겹쳐 두면 실측이 144ms 로 줄어든다.
  - 쓰는 곳: 부팅(파싱 시점) · 로그인/게스트→HOME(`enterAfterWarm`) · 게임 종료→맵 선택(`showLoading`) · 모델 로드 진행률(`ensureModels`→`opBarReal`).
  - ⚠ **부팅 막대는 「한 번만」 시작한다 — 두 번 시작하면 사용자에겐 로딩이 두 번 돈다**(2026-08-19). 두 가지가 겹쳐서 실제로 그랬다:
    ① `.opBar` 의 CSS 애니(`opLoad 1.6s`)는 **첫 페인트**에 시작 ② `bootApp` 은 `window.load` 라 한참 뒤에 돌며 막대를 0 으로 되돌렸다
    → 숫자 없는 바가 차다가 처음으로 돌아가 숫자 바가 다시 차 보였다. **CSS 애니를 지웠고**(다시 넣지 말 것), JS 막대는 **스크립트가 읽히는 순간** 시작한다.
  - **부팅 → 데우기는 한 막대로 잇는다.** `bootApp` 이 `BOOT_AUTH_P`(0.35)까지 채우고, `enterAfterWarm` 은 **`_opBar` 가 살아 있으면 새로 시작하지 않고** 0.35~1 구간을 이어 채운다. 로그인·게스트로 들어올 때만(막대가 없을 때만) 새로 시작한다.
  - 스모크가 `.opBar` 에 CSS 애니가 되살아났는지, 데우기가 막대를 다시 시작하는지 둘 다 검사한다.
  - ⚠ `ensureModels` 는 `bar.style.width` 를 **직접 쓰지 않는다** — 막대는 rAF 가 몰고 있어 서로 덮어쓴다. `opBarReal()` 로만 먹인다.
  - ⚠ 탭이 숨겨지면 rAF 가 멈춰 막대가 안 움직인다(전환은 setTimeout 이라 진행됨). 브라우저 창이 가려진 상태에서 재면 측정이 걸린다 — 스모크로 검사한다.
- ⚠ **모든 화면·팝업은 `#phone` 안에 있어야 한다 — `</div>` 하나가 어긋나면 전체 화면으로 퍼진다**(2026-08-19).
  `.appScreen` 은 `position:absolute;inset:0` 이라 **가장 가까운 positioned 조상**을 기준으로 잡는다. 그게 `#phone`(relative)이면 390×809 프레임에 갇히지만,
  프레임 밖으로 나가면 `body` 는 static 이라 **뷰포트**가 기준이 되어 화면 전체를 덮는다. 실제로 `#dgScreen` 뒤에 병합 잔재 `</div>` 가 하나 남아 있어
  `#townPanel`·`#pointPanel`·`#ptHelpPop`·`#settingsPop`·`#setSubPop`·`#exitConfirm`·**`#opening`(로딩·게임 진입 카운트다운)** 일곱이 프레임 밖에 있었다.
  증상은 「게임 들어갈 때 화면이 모바일 영역을 넘어 전체로 넓어진다」였고, 원인은 CSS 가 아니라 **태그 균형**이었다.
  - **진단법**: 브라우저에서 `[...document.body.children].map(e=>e.id)` — `phone` 과 `gachaDex`(의도된 폰 밖 패널) 말고 다른 id 가 있으면 그게 새어 나온 것이다.
    소스에서는 `<div` / `</div>` 개수를 `#phone` 시작~끝 범위에서 세어 **0** 인지 본다(그때는 -1 이었다).
  - `#phone` 은 **파일 끝에서 한 번만** 닫는다(`</div><!-- /#phone … -->`). 중간에 닫는 태그를 넣지 말 것 — 그 자리에 경고 주석을 남겨 두었다.
  - 원래 의도는 `c44a6ee fix(layout): 모든 화면을 #phone 프레임 안으로 통합(비율 일원화)` 그대로다.
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
- **로그인 = 부팅 로딩과 한 장면**(2026-08-20 L1+M8). `#auth` 는 블록을 **아래로**(`flex-end` · `--authLift`) 두고 딤도 로딩(`.opArt::after`)과 같은 값이다. 로고 블록(`.authMark`/`.authLogo`/`.authSub`)은 로딩(`.opLogo`/`.opTitle`/`.opSub`)과 같은 규격이고 **부제는 `BATTLE ARENA` 고정** — 안내 문구로 덮지 말 것(덮던 곳이 셋 있었다: `authShowHub`·`authMode`·`openAuthLink` → 전부 `#authErr.info` 로 모았다). 방식 셋은 번호도 주 표시도 없이 **같은 무게**이고, 구분은 `.authWay+.authWay::before` 짧은 가운데 선 하나뿐이다.
- **◀▶ 방향 버튼 = 공용 `.arwBtn`**(2026-08-14). 마크업은 `<button class="arwBtn" data-arw="l|r">` 한 줄뿐이고 속은 `paintIcons`가 부르는 `paintArrows`가 채운다(아이콘 레지스트리와 같은 방식 — 화살표 SVG를 마크업에 박지 말 것). 기본은 **글리프만**(판도 선도 없이 그림자로 띄운다 · 배경을 하나도 가리지 않는다 · 터치 영역은 30px 유지). 판이 필요한 자리에만 `.framed`를 붙이면 **모서리 컷 테두리**가 나온다 — ⚠ `clip-path`로 자르면 테두리까지 잘려 잘린 변에 선이 안 남으므로 외곽선은 SVG path로 직접 그린다. ⚠ 팝업(`#hbRoundSheet`)은 푸른기 금지라 선·글자 색을 회색으로 유지할 것. 더보기(각진 판)는 **다른 영역**이라 이 문법과 통일하지 않는다.
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
- **`.msPanel` = 붉은 헤어라인 위·아래 두 줄**(2026-08-18). 바깥 1px(금속 엣지) + **위·아래 변에 각각 1px 붉은 광선**(`::before`=위 / `::after`=아래, `rgba(255,59,59,.72)` + 약한 글로우). DESIGN §0 '강조는 두께가 아니라 빛' 그대로다. 라운드는 `--r-bar`(3px). ⚠ 아래쪽 어두운 inset 선은 뺐다 — 붉은 선 바로 옆에 검은 선이 겹쳐 두 줄로 보였다.
- **유즈맵 화면은 카드 두 장이다**(2026-08-18 · B안 확정). 위 = 목록 카드(`.msPanel` — 정렬 띠 + 목록), 아래 = 소셜 카드(`#msSocialDock` — 채팅·친구·파티). 소셜은 목록 카드 **안에 들어가지 않는다**.
  - 목록 카드 안에서 정렬 띠 + 목록은 `.msTop` 이 **한 톤 어두운 판**(`rgba(0,0,0,.2)`)으로 한 번 더 묶는다.
  - **두 카드는 같은 규격이고 무게만 다르다** — 좌우 변·라운드(`--r-bar`)·1px 테두리(`--panelBigEdge`)를 목록 카드에 맞추고, 면만 한 톤 어둡게(`rgba(18,18,18,.9)→rgba(9,9,9,.92)`) 간다. 붉은 헤어라인은 **윗변 한 줄뿐**(카드는 위·아래 두 줄) — 넷이 되면 어느 판이 주인공인지 사라진다.
  - ⛔ **면을 완전 검정으로 떨어뜨리지 말 것.** 검정 + 금속 엣지(`--metal-edge`)는 이 화면에서 **목록 항목(`.mapItem`)이 쓰는 언어**라, 구역이 아니라 '큰 항목 한 장'으로 읽히고 하위 구역의 선이 주 카드보다 세진다. 전폭(`margin:0 -13px`) 띠였던 옛 3안 '터미널'이 그랬다 — 좌우가 26px 어긋나 화면 밖으로 새 보였다.
  - ⚠ **도크는 `box-sizing:border-box` + 높이 고정이라 자기 테두리가 안높이를 먹는다.** 아랫변 1px 이 생기면서 파티 8칸(여유 1px)에 스크롤이 생겼다 → `padding-bottom` 을 6 → **4px**(DESIGN 간격 표의 값)로 줄여 되돌렸다. 바깥 높이는 그대로라 목록 '5장' 계산은 안 건드린다.
  - 모양은 **도크가 직접 갖는다** — 안의 `.msSocial` 은 껍데기를 벗겨 둔다(겹치면 테두리가 두 줄로 보인다).
  - 본문 결(채팅 `›` 프리픽스 · 친구·파티의 헤어라인 목록)은 옛 '터미널'에서 그대로 가져왔다 — 껍데기만 바꿨다.
  - ⚠ **도크의 `flex-basis` 는 `#mapSelect` 기준이다**(카드 안에 있을 때는 `.msPanel` 기준이었다). 안팎을 옮기면 같은 `30%` 라도 실제 높이가 달라져 목록의 '5장' 계산이 깨진다 — 지금 값은 `calc(30% - 24px)`. 옮길 일이 있으면 **목록 5장**과 **파티 8칸** 두 계산을 모두 다시 맞출 것.
  - 소셜 구역 머리줄은 **친구·파티가 같은 컴포넌트**를 쓴다(`.ptHead`/`.ptTitle`/`.ptHeadBtns` + `.ptFind`). 친구 전용이던 `.foHead`/`.foHeadAdd` 는 폐지. 제목은 `--fs-xl`(13px) — 10px 은 읽히지 않았다. 오른쪽 버튼(`파티 찾기`·`친구 추가`)은 **오른쪽 위 더보기 배너 칸(`.hbMoreIt`)과 같은 물성**(각진 3px · 검은 판 · 금속 엣지)이고, **구역색으로 물들이지 않는다** — 그 자리는 제목의 숫자가 맡는다.
  - ⚠ 스크롤 영역은 **padding box 에서 잘린다** — 아래 여백은 스크롤러가 아닌 바깥(`.msList` 의 `margin-bottom` · 도크의 `padding-bottom`)에 줘야 잘리는 자리가 안쪽으로 들어온다. padding 으로 주면 카드가 그 여백까지 흘러들어와 판 끝선에 딱 붙어 잘린다.
  - 유즈맵 카드(`.mapItem`)의 **세로 여백 7px 은 '목록에 5장이 딱 들어오는' 값**이다 — `안높이 386 ≥ 5×71.2 + 4×7(gap) = 384`. 좌우(12px)와는 무관하니 세로만 건드릴 것. 목록 높이나 카드 내용 줄 수가 바뀌면 이 값을 다시 계산해야 한다. 스모크가 '몇 장 들어오는가'를 재서 5장인지 검사한다.
  - ⛔ 유즈맵 목록은 끝을 흐리지 **않는다**(2026-08-18 제거) — 안쪽에서 끝난다는 것은 여백이 이미 말한다. 문서 어디에도 `mask-image` 는 남아 있지 않다(소셜 목록에도 없다).
  - **채팅 줄**(2026-08-18 · B+F+G안): **이름이 본문보다 밝다**(`#e8eef5` vs `#b8c2cc`) — 반대로 두면 누가 말했는지가 본문보다 덜 읽힌다. 줄머리 `›` 프리픽스는 **뺐다**(` : ` 구분자와 겹쳐 기호가 둘이었다). 시각은 `_mcTime()` 이 **줄 맨 앞에 넣지만 `float:right`** 라 오른쪽 끝에 붙는다 — ⚠ flex 로 붙이면 본문이 익명 flex 아이템이 되어 긴 줄의 줄바꿈이 깨진다. 입력 바는 판을 걷고 **청록을 뺐다**(전송·범위 라벨 둘이 쓰고 있었다 — 시안은 '지금 선택된 것' 전용). 범위는 색이 아니라 글자('전체'·'파티'·'친구')가 말한다.
  - 이 화면은 '한 상자 → 분리된 두 카드 → 한 카드 두 구역'을 오갔다. 지금 결론은 **두 장, 같은 규격, 무게만 다르게**다(2026-08-18 · B안). 8안을 실제 화면에 CSS 로 덮어 비교한 뒤 고른 것이라, 되돌리려면 그 비교부터 다시 할 것.
- **모드 선택 팝업(`#modeSheet`)은 시네마틱이다**(2026-08-18). 카드 전체가 아트고 정보는 그 위에 얹힌다. 구조는 `.moCard > .moInner > [.moArt(#moThumb + #moWash) · .moHead(제목+칩) · .moBody(#moDesc) · .moBtns(세로 2단)]`. id(`moThumb`/`moMap`/`moMeta`/`moDesc`)는 그대로라 `openModeSheet()` 는 **`#moWash` 채우는 한 줄만** 늘었다. 자세한 값·근거는 DESIGN.md 「유즈맵 모드 선택 팝업 — 시네마틱」.
  - **아트는 4층이고 `z-index` 를 전부 명시한다** — 0 맵 전용 키 아트(`#moWash` ← `mapBgUrl()`/`UMAP_BG`, 없으면 빈 층) / 1 또렷한 맵(`#moThumb`) / 2 비네트(`.moArt::before`) / 3 맵색 오라(`.moArt::after`). 의사요소는 `::before`=첫 자식·`::after`=마지막 자식이라 z를 안 주면 비네트가 맵 아래로 깔린다.
  - ⚠ **`#moWash` 도 `.moThumb` 클래스를 갖는다.** `#modeSheet .moWash` 는 `#modeSheet .moThumb` 와 명시도가 같아 **반드시 뒤에 와야** 이긴다.
  - **키 아트는 `scripts/usemap-bg.mjs` 가 만든다** — 맵마다 노출이 3배씩 흔들려 밝기 정규화가 필요하다(공용 `optimize-img.mjs` 는 이 폴더를 다루지 않는다). 원본 `.png` 는 gitignore, `.webp` 만 커밋. **새 그림을 뽑기 전에 `ART.md` 를 볼 것** — 모델·비율·프롬프트 전문·후처리 규격의 단일 소스다(세션이 바뀌어도 같은 스타일이 나와야 한다). 팝업이 그림을 어떻게 쓰는지는 DESIGN.md 「유즈맵 팝업 뒤 배경」.
  - ⚠ **`.moThumb`/`.moMap`/`.moInfo`/`.moFeat` 의 주인은 결과(`#resultScreen`) 화면이다** — `.moThumb.opThumb`/`.opMapName.moMap`/`.opPanel.moInfo`. 팝업 쪽 값은 전부 `#modeSheet` 안에 가둬 두었다. 공용 베이스를 지우면 결과 화면의 미니맵·제목·기록 패널이 통째로 사라진다(전환 중 실제로 그랬다). 게임 **진입** 로딩은 아래 `#gsRoot` 로 떨어져 나갔고 특징 리스트(`.moFeats`)만 빌려 쓴다.
- **🎬 게임 진입 로딩 = 카드 덱**(`#gsRoot`, 2026-08-19). 한 화면이 세 경우를 다 맡는다 — 다른 화면을 만들지 말고 클래스만 붙일 것.
  | 경우 | 클래스 | 덱 | 하단 |
  |---|---|---|---|
  | 협동 | (없음) | 카드 4장씩 두 줄 | `준비 n/N` |
  | 팀전(`cfg.teams`) | `.teamed` | 팀마다 4장 한 줄 + 팀 라벨 | `준비 n/N` |
  | 개인(1명) | `.solo` | **없음** | `LOADING n%` · 버튼 `전투 시작` |
  - **팀 색은 카드 윗변, 준비는 밑변**이다 — 자리가 달라야 팀전에서 두 정보가 겹쳐 읽히지 않는다. 팀 색은 대기실과 같은 `--tmC1`/`--tmC2`.
  - ⛔ **이 화면에서 초록은 '준비 완료' 전용**이다. 난이도 배지를 초록으로 두면 두 뜻이 섞인다(스모크가 배지 색을 검사한다).
  - 배경 = 유즈맵 **키 아트**(`_mapBgInto` — 목록·팝업과 같은 단일 소스). 그림이 없는 맵은 비워 둔다(미니맵으로 대신 채우지 않는다).
  - 초상은 공용 **`avatarHTML()`**, 버튼은 공용 **`.actBtn`/`.actBtn.pri`**. 카드용 초상이나 전용 버튼을 새로 만들지 말 것.
  - 특징 3줄은 `_mapGuideHTML(m)` 이고, **`.moFeats` 클래스를 같이 붙여야** 아이콘 판·간격이 산다(안 붙였더니 글자만 나왔다).
  - ⚠ **`.gsWrap>*{position:relative}` 가 `.gsArt` 를 이긴다**(특이도 동률 → 나중 규칙). `.gsWrap>.gsArt` 를 **뒤에** 적어야 `absolute` 가 살고, 아니면 아트가 흐름으로 돌아와 높이 0이 되어 배경이 통째로 안 보인다. 난이도 워터마크에서 똑같이 당했다.
  - ⚠ `_gsTimers` 에는 `setInterval` 도 들어간다(`{__iv}` — 개인 로딩 진행률). `_gsClearTimers` 가 `clearTimeout` 만 돌리면 화면을 나가도 계속 돈다.
  - **세로 배치** — 위 덩어리(이름·배지·덱)는 남는 높이의 **가운데**, 특징·도크는 **하단 고정**. 남는 높이를 `.gsHead` 위와 `.gsDeck` 아래 두 `auto` 가 반씩 나눠 갖는다. 엄지가 닿는 하단을 안 건드리면서 가운데가 비지 않는다(2026-08-19 · 전체를 중앙에 모으는 안은 버튼이 밑바닥에서 떠서 뺐다).
    - ⚠ **개인은 덱이 `display:none` 이라 `auto` 가 위 하나만 남는다** → 이름이 특징 바로 위에 달라붙는다. `.gsWrap.solo .gsHead{margin-bottom:auto}` 로 아래쪽 `auto` 를 이름이 대신 갖게 해 멀티와 같은 자리로 되돌렸다. 스모크가 위·아래 여백을 둘 다 잰다.
  - 부팅 오프닝(`.opWrap` — 로고·LOADING…)과 **별개 층**이다. `.opWrap`/`.opMap`/`.opBtns` 는 결과 화면과 공용이라 `#opening.counting` 에서 덮으면 그쪽이 같이 바뀐다.
  - ⚠ **`.moCard` 는 공용 카드 껍데기(`.cpCard,.rmCard,.lbCard,.authCard,.foCtxCard,.ptInviteCard`) 목록에서 빠졌다.** 되돌리면 모서리 컷과 붉은 네온 테두리가 다시 붙어 맵 액센트와 색이 경쟁한다.
  - ⚠ **설명 칸 높이는 상수가 아니다** — `_moFitInfo` 가 부모 `.moBody`(`flex:1`)의 남은 높이를 재고, 못 재면 `_MO_INFO_H`(306)로 떨어진다. 카드 높이 `--popH` 가 `min(564px,90%)` 라 짧은 기기에서 실제로 줄어들기 때문이다.
  - **난이도 팝업(`#soloDiffPanel .cpCard`)도 같은 언어다**(2026-08-18) — 시네마틱 카드에서 아트만 뺀 것. `openSoloDiff` 가 `_selMap` 의 액센트를 이어 심는다. ⚠ `.cpCard` 는 방 만들기·종족 선택·로그아웃과 공용이라 **전부 `#soloDiffPanel` 안에서만** 덮었다. 죽은 `.raceTrig`(없는 함수 `openSoloRace` 호출)는 삭제했다.
- ⚠ **`--hmPanel`/`--hbEdge` 는 `#homeScreen`·`#townScreen` 안에서만 정의된다.** 다른 화면에서 그대로 쓰면 `var()`가 무효가 되어 **면도 테두리도 통째로 사라진다** — `.msPanel`(유즈맵 목록·정비·캐릭터)이 이것 때문에 '상자'로 안 보이고 탭 띠와 목록이 배경 위에 떠 있었다. 같은 함정이 `.pdSeg` 주석에도 적혀 있다. **반드시 대체값을 함께 적을 것**(`var(--hmPanel, linear-gradient(...))`). 스모크가 `.msPanel`의 테두리·면이 실제로 그려지는지, 그리고 탭 띠와 목록 카드의 좌우가 같은지 검사한다.
- **개인 플레이 난이도 = 스테퍼 + 상세**(2026-08-19). `#soloDiffPanel` 안이 `sdNav`(◀ 이름 ▶ + 위치 점) + `sdDet`(고른 하나만 크게) + `sdInf`(무한 모드) 로 나뉜다. ⛔ 목록을 훑어 **바로 시작**하던 방식(`.soloDiffBtns`)은 폐지 — 오탭으로 시작되고 난이도끼리 비교가 안 됐다.
  - **잠긴 난이도도 고를 수 있다** — 무엇이 필요한지 상세가 보여 주고, `sdGo` 버튼만 잠긴다(토스트로 튕기지 않는다).
  - **무한 모드는 난이도가 아니다**(노말 고정) — 탭에 끼우지 않고 아래 별도 줄(`#sdInf`)이 맡는다. 탭에 넣었더니 6칸이 되어 `NORMAL` 이 잘렸다.
  - ⛔ **탭 띠(`segNavHTML`/`.pdSeg`)로 5칸을 늘어놓던 방식은 폐지**했다 — 350px 카드에서 한 칸이 59px 이고 `NORMAL` 이 58px 이라 여백을 2px만 줘도 잘렸다. 난이도는 **순서가 있는 축**이라 좌우 이동(스테퍼)이 맞다. 화살표는 공용 **`.arwBtn`**(`data-arw` + `paintArrows`) 그대로이고, 양 끝에서 `disabled` 로 멈춘다(순환하지 않는다 — 순환하면 몇 번째인지 안 읽힌다). 위치는 점 5개(`.sdDots`)가 말한다.
  - 이름은 **스테퍼가 갖는다** — 상세에 `.sdName` 을 다시 넣지 말 것(스모크가 중복을 검사한다).
  - 상세 머리에 **지금 고른 맵**(썸네일 + 이름)을 얹는다 — 두 팝업이 한 흐름으로 읽히고, 카드 높이가 고정이라 생기던 빈 칸도 메운다.
  - **고른 난이도가 상세 판을 물들인다**(2026-08-19). `renderSoloDiff` 가 `--dc`(hex) 와 `--dcRGB`(채널 셋)를 함께 실어 준다 — `var()` 색에는 알파를 얹을 수 없어 테두리·광원엔 채널이 따로 필요하다. 잠긴 난이도는 회색(`#5a626c`)이 들어간다. 색을 갖는 것은 **선·빛·글자**뿐이고 면은 검정 그대로다(DESIGN §0). ⛔ 난이도 이름을 뒤에 워터마크로 한 번 더 깔지 말 것 — `.sdName` 과 겹쳐 읽기만 나빠졌다.
  - **시작(`.sdGo`)은 공용 액션 버튼 `.actBtn.pri` 를 그대로 물려받는다** — 마크업이 `class="actBtn pri sdGo"` 이고 여기서 덮는 건 크기뿐이다(잠김 모습도 `.actBtn:disabled` 그대로). 취소도 같은 컴포넌트의 기본형(하위 단계)이다. ⛔ 난이도 색으로 물들이지 말 것: 고를 때마다 확정 버튼 색이 바뀌면 '무엇이 확정인지'가 흔들린다(난이도 색은 스테퍼와 상세 판이 이미 말한다). ⚠ 공용 `.actBtn` 규칙이 이 블록보다 **아래**에 있어 같은 특이도면 진다 → `#soloDiffPanel .sdGo` 처럼 ID 를 붙인다(안 붙였더니 `flex:1` 에 져서 버튼이 94px 로 늘어났다).
  - ⚠ **카드 높이 474px 는 내용에서 나온 값이다**. `.sdBody`(수치 2칸 + 설명 한 줄)가 담기려면 상세 판에 그만큼이 필요하고, 짧게 잡았더니 설명 줄이 시작 버튼 위로 흘러 **잘린 것처럼** 보였다. `.sdBody` 에 `overflow:hidden` 을 두고 스모크가 모든 난이도에서 `scrollHeight`/버튼 겹침을 검사한다.
- **탭 띠는 게임 전체에 하나뿐이다 — `segNavHTML`**(2026-08-18). 장비창 섹션 바 · 사냥터 업그레이드 탭 · **유즈맵 정렬 띠**가 전부 같은 함수·같은 클래스(`.pdSeg`/`.pdSegInd`/`.pdSegBtn`)를 쓴다. 화면이 덮는 것은 여백·글자 크기와 광원 색(`--segCol`)뿐이다. 유즈맵이 쓰던 전용 탭(`.msSortTab` — 밑줄 2px + 세로 구분선 + 아이콘)은 **폐지**했다. ⚠ 글자만 넣는다 — 아이콘을 같이 넣으면 아이콘+글자가 한 덩어리로 가운데 정렬돼 글자가 중앙에서 밀린다. 스모크가 `#msSortTabs`에 `.pdSeg`가 있는지, 옛 `.msSortTab`이 되살아났는지, 사냥터 띠와 라운드가 같은지를 검사한다.
- **👥 유즈맵 소셜 — 친구는 한 목록, 파티는 게시판이 앞에 선다**(2026-08-18).
  - **친구 행은 한 줄 조밀형**(2026-08-18). 도크 안높이가 131px 뿐이라 2줄·48px 행은 **세 명째가 잘렸다**(4명 목록에 `scrollHeight 265`). 이름·태그·★는 왼쪽, 상태 문구는 `margin-left:auto` 로 오른쪽 끝 — 행 **33px**, 한 화면에 **4명+**. ⚠ 행 높이를 정하는 것은 초상(22px)이 아니라 **액션 버튼의 높이**다(30×26). 여기를 키우면 곧바로 '4명 안 보임'이 된다.
    - **초상은 동그란 채로 둔다** — 이 화면에서 유일한 원이지만 '사람'을 뜻하는 자리라 그렇게 정했다. 라운드 3단계(DESIGN §2)는 판·칸·버튼의 규칙이고 초상은 거기 들지 않는다. 각지게 바꾸지 말 것(스모크가 `50%` 를 검사한다).
    - **액션은 글리프만**이다. 예전 `.foAct` 는 `--glass` 면 + `--metal-edge` 테두리를 갖고 있었는데, 그 선은 **목록 항목(`.mapItem`)이 쓰는 값**이라 도크 면에서 걷어낸 언어가 버튼에만 남아 있던 꼴이었다. 스모크가 면·테두리가 없는지 검사한다.
    - ⚠ 이 규칙들은 **`#msSocialDock` 안으로만** 건다 — `.foRow`/`.fAva`/`.foAct` 는 마을 채팅 시트·친구 초대 팝업과 공용이다.
  - **친구**: 맨 위는 목록이다. 머리줄은 파티와 같은 `.ptHead`(친구 N + `친구 추가`)이고 **온라인/오프라인 섹션 라벨은 없앴다** — `friendSortCmp`가 **접속 상태를 1순위**로 정렬해 온라인이 위로 오고(즐겨찾기는 같은 상태 안에서만), 오프라인은 `.foRow.off`가 **어두운 상자**로 갈라 준다. ⚠ `.foRow.off`를 `opacity`로 흐리게 두면 '어두운 상자'가 아니라 '흐린 상자'가 된다 — 면 색을 낮춘다(스모크가 두 행의 배경 휘도를 비교한다).
  - **친구 추가**는 목록 위 검색줄에서 `openFriendAdd()` 팝업으로 옮겼다. 입력 id(`#foSearch`/`#foSearchResult`)를 그대로 유지해 `friendSearch()`/`friendAdd()`는 손대지 않았다.
  - **파티**: 탭에 들어왔는데 `hasParty()`가 거짓이면 **게시판(`openPartyFind`)이 먼저 뜬다** — 빈 슬롯만 보여 주면 어디서 사람을 구하는지 알 수 없다. 하단 내 파티(`renderPartyTab`)는 그대로 남고, 머리에 `파티 찾기` 버튼이 상시 있다.
- **👥 멀티 대기실(`#lobby`) = 전체 화면 · 내 종족은 공용 탭 띠**(2026-08-19).
  - 방 찾기·방 만들기와 **같은 전체 화면 규약**(딤·카드 테두리 없음, 폭·높이 100%). 하단은 공용 `.actBtn`(`.sub` 나가기 / `.pri` 시작) — 잠김 모습도 `.actBtn:disabled` 가 갖는다(옛 `.lbStart.ready` 는 폐지).
  - **머리 아래 = 이 방의 조건 카드**(`#lbCond` · `renderLobbyCond`). 방 만들기의 대전 설정 판(`.cpVs`)과 **같은 자리·같은 모양**이라 두 화면이 형제로 읽힌다. 오토배틀이면 라운드·시작 골드·수입·본진 체력(사용자 지정이면 주황), 아니면 난이도·적HP·포인트·정원.
  - ⚠ **채팅(`.lbChatWrap`)에는 상한이 있다**(`max-height:168px` + `margin-top:auto`). 없으면 남는 높이를 통째로 먹어 화면 절반이 빈 검은 판이 된다 — 남는 높이는 슬롯과 채팅 **사이 여백**으로 흘린다. 스모크가 카드 대비 28% 를 넘는지 검사한다.
  - ⚠ 공용 `.pdSeg` 는 `max-width:286px` 라 그대로 두면 종족 띠 오른쪽에 여백이 남는다 — `#lbRaceSec .pdSeg{max-width:none}` 으로 푼다(스모크가 폭 일치를 잰다).
  - **기본은 오토 배틀**이다 — 1팀/2팀 + 각자 종족을 고른다. **내 종족을 바꾸는 입구는 위 띠 하나뿐**(`#lbRaceSec` · `segNavHTML` + `STK_RACE_ORDER`). 슬롯 안의 종족 칩(`.lbRace`)은 **읽기 전용**이다 — 입구를 둘 두면 어디를 눌러야 할지 모른다(옛 칩 클릭 경로는 뗐다).
  - **종족이 없는 유즈맵(네모네모 등)은 그 자리가 잠긴 안내(`.lbRaceLk`)로 바뀐다.** 자리를 비우지 않는 이유는, 비우면 "왜 나는 종족을 못 고르지"가 설명되지 않기 때문이다. 슬롯 칩도 함께 사라진다.
  - ⚠ **슬롯 판(`.lbGrid`)은 높이가 고정이다**(292px). 두 가지를 동시에 지키기 위해서다(2026-08-19):
    ① **팀 유무와 무관하게 같은 높이** — 팀전은 라벨 2줄이 더 들어가므로, 팀이 없으면 행을 그만큼 키워 메운다. 그래서 행 높이는 식에서 **역산한 값**이다: `(팀전) 라벨 2×20 + 행 8×31 = 288` = `(팀 없음) 행 8×36 = 288`. 토큰은 `--lbRowH`/`--lbRowTH`/`--lbSepH` 이고 높이는 `.lbGrid` 가 그 식으로 계산한다 — **행 높이만 따로 고치면 ①이 깨진다.**
    ② **정원이 줄어도 판은 그대로** — 안의 행만 하나씩 사라진다. 판이 같이 줄면 화면 전체가 출렁인다.
    스모크가 (팀전 8 / 협동 8 / 협동 4 / 팀전 4) 네 경우의 높이가 전부 같고 스크롤이 없는지 검사한다.
  - 머리줄 오른쪽(`renderLobbyHeadR`) = 방 번호 + 배지. 팀전이면 대진(`4 vs 4`), 아니면 난이도. **사용자 지정 방이면 배지가 하나 더 붙는다** — 들어와 있는 사람도 기본 밸런스가 아님을 알아야 한다.
  - 실방 종족 전파: `rtRoomMe()` 가 `race` 를 presence 에 싣고 `rtRoomSetRace()` 가 바뀔 때 다시 track 한다. 시작 시엔 방장이 `start` payload 의 **슬롯마다** 실어 보낸다(각자 다른 것을 고르므로 방 단위 값이 아니다).
- **🏗 방 만들기(`#createPanel`) = 전체 화면 · 난이도는 스테퍼 · 오토배틀은 대전 설정**(2026-08-19).
  - 방 찾기와 **같은 전체 화면 규약**이다(딤·카드 테두리 없음, 폭·높이 100%). 팝업 카드 안에 다시 넣지 말 것.
  - **난이도는 난이도 선택 화면(`#soloDiffPanel`)의 컴포넌트를 그대로 빌린다** — `.sdStepRow`/`.sdStepTx`/`.sdDots`(◀ 이름 ▶ + 점) + 상세 판 + 무한 모드 줄 `.sdInf`. ⛔ 여기에만 있는 난이도 UI 를 새로 만들지 말 것(옛 `.cpDiffBtns` pill 나열은 폐지). 두 화면이 어긋나면 같은 것을 두 번 만든 것이다.
  - **최대 인원 = 1~8 칸 게이지**(`.cpPGrid`/`.cpPc`). 고른 값까지 조용히 채우고 **고른 칸 하나만** 밑변이 발광한다 — 여덟 칸이 다 빛나면 뭘 골랐는지 안 보인다.
  - **🎛 오토 배틀 대전 설정**(`#cpMode` · `renderCpMode`) — 프리셋 3장(일반 · 속도전 · 사용자 지정) + 결과 카드/세부 스테퍼. 결과 카드 `.cpVs` 는 난이도 상세 판과 **같은 자리·같은 모양**이라 맵이 바뀌어도 골격이 안 흔들린다.
    - **상하한은 `STK_OPTS` 표 한 곳에서만 정한다** — UI·프리셋·검증이 전부 이 표를 본다. 기본값은 `USEMAPS.cpu.cfg` 와 같아야 한다(일반 모드 = 오버라이드 없음).
    - **값이 전부 기본값이면 오버라이드를 만들지 않는다**(`cpOptsPayload()` 가 `null`) — 사용자 지정을 골랐다가 되돌린 방이 '사용자 지정'으로 표시되면 안 된다.
    - `hpMul` 은 배율이지만 엔진은 배율을 모른다 → `stkCfgFromOpts` 가 신전 3종(`baseHp`/`secHp`/`centralHp`)의 **구체값**으로 바꿔 싣는다.
  - **엔진 반영은 `mapCfg` 한 곳**이다. `MAP_CFG_OVR` 이 있으면 그것이 맵 cfg 를 이긴다 — `startGameNow` 가 심고 `overlayToLobby` 가 반납한다. ⚠ **유즈맵 cfg 를 직접 고치지 말 것**(다음 판까지 남는다). 반납을 잊으면 밸런스가 조용히 어긋난다 — 스모크가 주입·반납 두 경로를 다 검사한다.
  - ⚠ **라운드는 화면 전체가 `--r-bar`(3px) 하나다**(2026-08-19). 옛 값(입력 9~10px · 세그먼트/상세 판 6px)이 섞여 있어 "카드가 둥글다"는 인상이 났다. DESIGN §라운드 표(0/3/6/9) 밖 값이 하나라도 들어오면 그 화면만 다르게 보인다 — 스모크가 방 찾기·방 만들기 두 화면의 **모든 요소**를 훑어 표 밖 라운드를 잡는다.
  - 기본 밸런스가 아닌 방은 목록에서 `사용자 지정`(`.riOpt`)으로, 게임 진입 로딩에서는 머리줄 배지(`.gsBd.cus`)로 표시된다 — 들어가기 전에 알아야 한다.
- **🚪 방 찾기(`#rooms`) = 전체 화면 · 빠른 입장이 맨 위 · 난이도는 탭 띠 · 행 밑변이 난이도 색**(2026-08-19).
  - ⛔ **팝업 카드가 아니다.** 화면 하나를 통째로 쓴다 — 딤도 카드 테두리도 없고, 상단 재화 바와 **하단 네비까지 덮는다**(`openRooms` 가 `navShow(null)`). 배경(우주 `.spaceBg`)이 네 변까지 이어진다. `#rooms .rmCard` 는 껍데기를 전부 벗긴 채 폭·높이 100%다. 카드 틀에 다시 넣으면 안쪽에 상자가 또 생겨 목록이 좁아진다(스모크가 카드와 화면 크기가 같은지 검사한다).
  - ⚠ **파티 찾기(`.pfOv`)는 여전히 팝업**이라 같은 `.rmCard` 를 카드 모습으로 써야 한다 — `.pfOv .rmCard` 가 폭·높이·여백을 되돌린다. 한쪽만 보고 공용 규칙을 고치면 다른 쪽이 깨진다.
  - **주 액션은 화면에 하나뿐**이다 — 맨 위 `빠른 입장`(`.rmQuickTop` = `.actBtn.pri`). 실제로 가장 잦은 동작이라 제일 크게 놓았다. 버튼 안의 부제(`#rmQuickSub`)는 지금 들어갈 수 있는 방 수다(파티 인원까지 고려). 하단 `방 만들기`·뒤로·새로고침은 전부 하위 단계다.
  - **하단은 주 동작이 가로로 길고 뒤로·새로고침은 38px 정사각**(`.rmBtns .actBtn` / `.actBtn.sq`). 파티 찾기도 같은 규칙을 쓴다. ⚠ 공용 `.actBtn` 의 좌우 여백 14px 을 그대로 두면 `파티 만들기`가 두 줄로 접힌다 — `.rmBtns` 에서 6px 로 조였다.
  - **난이도 필터 = 공용 탭 띠**(`segNavHTML` → `#rmFilter`). ⛔ 옛 우상단 팝다운(`.rmDiff`/`.rmDiffMenu`)은 폐지. **난이도가 없는 유즈맵(대인전)에서는 띠를 통째로 비운다** — 요약 줄 같은 것으로 그 자리를 대신 채우지 않는다(요청).
  - **행(`.roomItem`)은 액션 버튼과 같은 문법**이다 — 볼록 판 + 밑변 광원. 광원 색이 곧 난이도(`--dc`)라 배지를 안 읽어도 훑힌다. 난이도가 없으면 `--dc` 를 안 실어 주고 중립 흰선이 된다(`.actBtn` 기본형과 같은 값). 잠긴 행(게임중·가득참)은 오목으로 뒤집히고 광원이 죽는다(`.actBtn:disabled` 와 같은 규칙).
  - **방 번호 입장은 친구 방 전용**이라 평소엔 접어 둔다 — 우상단 🔍(`#rmNumBtn`)가 `.rmNum` 줄을 편다. 목록은 `flex:1` 로 카드가 남는 높이를 전부 먹는다(옛 '6칸 고정'은 폐지 — 카드 높이가 고정이라 결과는 같고 배치만 자유로워졌다).
  - **파티 찾기 판 = 방 찾기(`#rooms`) 컴포넌트를 그대로 빌린 것**이다 — 카드(`.rmCard`)·머리(`.rmHead`)·입력줄(`.rmNum`)·목록(`.rmList`/`.roomItem`)·하단 4칸(`.rmBtns`)까지 전부 같다. 새로 정한 것은 '어디에 뜨는가'(`.pfOv` = 딤만, `#rooms`의 우주 배경 없음)뿐이다. 방 번호 자리는 파티엔 번호가 없어 **이름으로 찾기**가 맡고, `파티 만들기`를 누르면 **같은 줄이 이름 입력으로 바뀐다**(판을 하나 더 띄우지 않는다). 만들기 입구는 하단 한 곳뿐 — 두 군데 두면 어디를 눌러야 할지 모른다.
  - ⛔ 파티 탭에 들어와도 **게시판을 자동으로 띄우지 않는다**(2026-08-18 되돌림). 탭을 누를 때마다 판이 덮여 정작 내 파티가 안 보였다. 들어가는 길은 머리줄의 `파티 찾기` 버튼 하나뿐이다.
  - 소셜 구역은 목록에서 **채팅 한 줄(17px)만큼 떨어져 있다** — `margin-top:17px` + `flex:0 0 calc(30% - 17px)`. 차지하는 총 높이가 그대로라 위 목록은 줄지 않고, 채팅은 한 줄 덜 보인다. 딱 붙여 두면 두 구역이 한 덩어리로 보였다.
  - **파티도 친구와 같은 한 줄 33px 행**이다(2026-08-18 · D+F안). 소셜 세 탭(채팅 줄 · 친구 행 · 파티 행)이 한 결로 묶인다. 이름은 왼쪽, 역할·태그는 `margin-left:auto` 로 오른쪽 끝(친구 행의 상태와 같은 자리).
    - ⛔ **빈 자리를 칸으로 늘어놓지 않는다.** 1명일 때 '＋ 친구 초대'가 **일곱 번** 반복돼 본문 대부분이 정보 0이었다. `renderPartyTab()` 이 **사람 수만큼만** `.ptSlot` 을 내고, 남은 자리는 `.ptInviteLine` 한 줄(`빈자리 N`)이 말한다. 가득 차면 그 줄도 사라진다.
    - ⚠ **그 대가로 초대 입구가 접히는 자리 밑으로 내려간다**(3명이면 벌써). 도크 안에서 `position:sticky;bottom:0` 로 바닥에 붙이고, 면은 **불투명 `#0b0b0b`** 이어야 한다 — 반투명이면 밑을 지나가는 행이 글자 사이로 비친다.
    - **파티장 = 빨강**(왼쪽 2px 바 + 붉은 밑변). 시안은 DESIGN 에서 '지금 선택된 것' 전용이라 파티장에 쓰면 안 된다.
    - 내보내기 `✕`(`.ptKick`)도 도크에서는 **글리프만**이다 — 친구 액션 버튼과 같은 이유(그 판의 테두리는 목록 항목의 선이었다).
    - ⚠ **옛 '2열 8칸 무스크롤' 계산은 폐기됐다.** 이제 규칙은 친구 목록과 같다 — **4명까지 스크롤 없이**, 그 위는 스크롤. 스모크가 칸 수 = 파티원 수 · 빈 칸 0 · 행 ≤34px · 초대 줄이 구역 안에 있는지를 검사한다.
  - 파티는 **맵과 무관한 자유 파티**다(사람을 먼저 모으고 뭘 할지는 모여서 정한다 → 한 파티로 여러 맵을 돌 수 있다). 게시판 상태는 `_pbRooms` + `_party.pbId`이고, **자리 반납은 `pbLeave()` 한 곳**에서만 한다 — 방을 옮길 때와 파티를 해제할 때 양쪽에서 부르지 않으면 인원이 샌다.
  - ⚠ 서버 `parties` 테이블에는 이름·공개 칼럼이 없어 지금은 **로컬 게시판**(임시친구 `_tempFriends`와 같은 결)이다. 실연동은 `parties`에 `name`/`open`을 추가한 뒤 `pbRooms()`/`pbJoin()` 둘만 갈아 끼우면 된다.
  - 팝업 껍데기는 **`_lobbyOv(id, onClose)` 하나**로 모았고 `#phone`에 붙인다(`.ptInviteOv.top`, z-index 110) — 소셜은 유즈맵 도크와 마을 시트를 오가므로 화면 하나에 매달면 반대쪽에서 안 보인다. `showAppScreen`이 화면을 바꿀 때 이 팝업들을 함께 접는다(안 접으면 `#phone`에 남아 다음 화면을 덮는다).
  - ⚠ 공용 카드 면(`.cpCard` 계열)은 반투명이다 — 유즈맵 목록 위에 뜨는 `.ptInviteCard`는 뒤 카드가 글자 사이로 비쳐 못 읽는다. 이 카드만 면을 불투명하게 덮었다.
- **게임 밖 설정(`#settingsPop.appCtx`)은 게임 안 설정과 같은 카드**를 문맥 클래스 하나로 갈라 쓴다(2026-08-18 · H안). 게임 밖에만 있는 것 = **내 프로필 머리줄(`#setMe`) · 진동 · 화면 항상 켜기 · 닉네임 변경 · 버전**, 게임 안에만 있는 것 = 임무 목표 · 배속 · 일시정지 · 나가기. 둘 다 `#settingsPop(:not).appCtx` 선택자로만 갈린다 — **두 번째 설정 화면을 만들지 말 것**.
  - **프로필 배지가 계정 연결 입구다**(`setAcctGo()`). 정식 계정이면 `계정`(표시만), 클라우드 게스트면 `게스트 연결 ›` → `openAuthLink()`(uid 유지 → 진행도 따라옴), 로컬 게스트·미로그인은 사실대로 알리고 `openAuth()`. ⚠ `AUTH.user` 가 null 인 상태를 '정식 계정'으로 읽으면 계정 없는 사람에게서 입구가 사라진다.
  - ⚠ **하위 팝업(`#setSubPop`)은 `openSetSub` 가 부모의 `.appCtx` 를 옮겨 붙여** 껍데기 규칙(붉은 헤어라인 · 44px ✕)을 물려받는다. 안 하면 하위 팝업만 금색 선으로 남는다.
  - ⚠ **새 스위치는 `SND` 초기값을 같이 넣는다** — 없으면 `!undefined`=true 라 첫 탭이 헛돈다. 진동은 `playSfx()` **맨 앞**에서 `hapt()` 로 낸다(안쪽에 두면 음소거일 때 진동도 죽는다). 화면 항상 켜기는 `wakeSupported()` 가 거짓이면 **줄 자체를 감춘다**.
  - 버전은 `APP_VER` 하나가 소스다 — 빌드 단계가 없으니 `package.json` 과 손으로 맞춘다.
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
- **업그레이드 카드 = 이중 테두리 + 비용 버튼의 광원은 왼쪽 위**(2026-08-19 D1+B3). 카드는 바깥 1px + `.hmUp::after` 안쪽 프레임 1px(inset 3px · 컷 4px = 바깥 7 − inset 3). 버튼은 `--btnRing`(315deg 벽돌) · `--btnLine`(안쪽 선 색) · `--btnBevel`(inset 세 줄) 세 토큰이 단일 소스 — `.off`·잠긴 카드는 토큰만 바꾼다. ⚠ 빛의 방향은 링이 아니라 `inset` 두 줄이 낸다(링은 inset 선에 덮인다). 스모크가 컷의 평행 여부와 빛의 방향을 검산한다.
- **업그레이드 격자의 칸 폭은 `hmUpgSnapGrid()`가 정수로 못 박는다**(`renderHome()` 끝 · `hbResize()`). `1fr` 두 칸이면 (안쪽폭 − 간격)이 홀수일 때 칸이 185.5px 가 되고 세로 테두리가 한쪽만 두 픽셀로 번진다 — 좌우 칸의 computed style 은 완전히 같으므로 스타일 비교로는 안 잡힌다. 스모크가 칸 변의 소수부를 잰다.
- **스킬 바 = 한 판 트레이**(`renderHbBar()` → `.hbSkWrap` > `.hbAutoChip` + `.hbTray` > `.hbSk` ×3, 2026-08-19 T1안). 칸(`.hbSk`)은 바로 아래 사냥터 업그레이드 카드(`.hmUp`)와 **같은 값**이다 — 완전 검정 면(`--bpFace`) · 붉은 알파 그라데 테두리 · 모서리 컷 7px · 라운드 `--r-bar`. 쿨은 잠긴 카드(`.hmUp.lk`) 문법이라 **붉은 발광만 꺼진다**. 자동은 트레이 **밖** 작은 칩이고 붉은색을 쓰지 않는다(빨강은 '지금 쓸 수 있다'는 뜻으로 스킬 칸이 독점). 남은 시간은 칸 아래 얇은 바 + 아이콘 위에 얹은 숫자이고, 둘 다 `hbSkCdPaint()`가 `--cd`와 텍스트만 갱신한다(**DOM을 다시 그리지 않는다** — `renderHbBar()`는 상태가 바뀔 때만). ⚠ `--hmAccRGB`는 `.hmUpg` 안에만 있으므로 `.hbTray`가 같은 값을 다시 선언한다(`.lpList`와 같은 선례). 스모크가 `.hbSk`와 `.hmUp`의 computed style을 직접 대조해 두 벌로 갈라지는 것을 막는다.
- **👾 사냥터 몹 여섯 역할**(2026-08-20) — `HB_FOE_KIND`(기본·돌격·사수·비행·중장갑·유령) 한 표가 스탯·크기·사거리·이동을 다 갖는다. **역할과 얼굴은 분리**돼 있다: 얼굴은 `HB_RACE_FACE` 종족 팔레트에서 나오고(`hbFaceOf`), 던전은 **얼굴만** 정한다.
  - 📈 **누가 몇 기 나오는지는 라운드·웨이브가 정한다** — `HB_SPAWN{from,ramp,cap}` + `HB_WAVE_MUL`. `hbWavePlan(D,round,wave,n)` 이 웨이브 편성표를 짜고(상한 있는 역할부터 정확한 마릿수를 넣고 남은 자리를 기본·돌격이 채운 뒤 순서를 섞는다) `hbSpawnWave` 가 그대로 낸다. **cap 은 웨이브당 절대 마릿수**라 적이 아무리 많아져도 안 넘는다. *숫자와 곡선, 그리고 '후반에 비중이 줄어드는' 트레이드오프는 `BALANCE.md` §6 이 단일 소스다.*
  - 보스는 `hbBossKind(round)` 가 **그 라운드에 이미 열린 역할 중** 가장 무거운 지상 근접을 고른다(아직 안 열린 역할을 보스로 쓰지 않는다). **보스는 늘 지상 근접** — 날거나 통과하는 보스는 벽·기지 설계를 통째로 무의미하게 만든다.
  - ⚠ **이동 방식은 `f.way` 다 — `f.mv` 가 아니다.** `f.mv` 는 이동 루프 끝에서 '움직이는 중(0/1)'으로 덮어쓰는 옛 플래그라, 여기에 `'phase'` 를 담으면 **첫 프레임 뒤 1 로 바뀌어 지상 취급**된다(실제로 그렇게 짰고, 겉보기·스탯이 다 멀쩡해서 위치만 재는 검사는 통과했다). 그래서 스모크는 **실제로 벽 칸을 지났는지**를 본다.
  - `way='air'|'phase'` 는 거리장·`hbSlide` 를 건너뛰고 직진하며, `hbPlaceFoe` 의 '기지 밖으로 밀어내기'와 walkable 검사도 건너뛴다(벽이 의미 없는 종류라 안 그러면 엉뚱한 데서 태어난다). 원거리는 `rng` 안에서 멈춰 쏘고, **지상 사수는 `hbLineClear` 시야가 필요**하지만 공중은 넘어서 보므로 안 따진다. 적 사격선은 `S.shots` 에 `foe:1` 로 실려 붉게 그려진다(캐릭터=금 · 아군=초록).
  - 사거리는 **`HB_BUNKER_R`(150)을 넘으면 안 된다** — 넘는 순간 사수가 벙커 도발 밖에 서서 캐릭터만 쏴 벙커가 '대신 맞아준다'는 설계가 사라진다. 스모크가 표를 훑어 막는다.
  - 🚶 **유닛 간 회피 조향 `hbAvoid(f,dirx,diry)` = 엔진 `unitAI` 와 같은 레시피**(반발 + '앞을 막았을 때만' 접선). ⛔ 미로 경로탐색을 대체하는 게 아니라 **그 위에 얹는 보정**이다 — `hbFieldDir`/`hbSlide` 로 벽을 돌아간 방향에 회피를 더한 뒤 움직인다. 벽·기지·미로는 그대로다. 실측(24기가 사방에서 몰릴 때): 겹친 쌍 **48 → 11**. 유령·공중도 회피는 한다(벽만 무시).
  - 🧱 **배치 격자는 지으려는 건물 둘레 `HB_GRID_PAD`(1)칸까지만** — `clip()` 으로 좁히고 면 없이 **진한 초록 점선**(`HB_GRID_COL`/`HB_GRID_LW`/`HB_GRID_DASH`). 예전엔 보이는 맵 전체를 푸른 면으로 덮고 격자를 다 그려서 전장이 안 보였고, 흐린 파란 선(.09)은 어두운 배경에 묻혔다. 맵 경계(`strokeRect(-R,…)`)는 격자와 별개라 그대로 둔다.
    - 🧱 **배치 미리보기는 관리자 건설과 같은 반투명 3D 고스트**다. `hb3dList` 가 `{uid:'__bghost__', id:'cb_*', ghost:true}` 를 **같은 sync 목록에** 얹으면 M3D 가 `makeBuildGhost`/`buildGhostModels`(syncBuild 가 쓰는 그 풀)로 그린다. ⛔ 새로 만들지 말 것 · ⛔ `syncBuild` 를 따로 부르지 말 것(sync 와 서로의 풀을 숨긴다) — 그래서 **메인 `sync` 에 ghost 분기를 열어 두었다**.
    - 스모크는 **캔버스 호출을 받아 적어** 격자선의 범위·점선 여부·색(초록 우세 + 알파)과 칠해진 면의 범위를 재고, 고스트는 `hb3dList` 결과로 본다. ⛔ 함수 소스 정규식은 주석만 남아도 통과한다 · ⛔ `fillRect` 호출 수로 재면 배치 칸 표시까지 잡혀 헛돈다 · ⛔ '초록 채널이 크다'로만 재면 옛 파란색(g=190)도 통과한다 — 셋 다 실제로 겪었다.
  - ✨ **공격·사망 이펙트는 공용 코어를 쓴다 — 사냥터 전용을 두 번째로 만들지 말 것.** 발사는 **`unitFireFx(L,u,tx,ty,size,tgtAir)`**(관리자 이펙트 랩·전투실험·오토배틀이 쓰는 그 디스패처), 사망은 `FX.death`. 사격 주체가 전부 진짜 유닛 id 를 갖고 있어(캐릭터=`hbCharMdl()`=`PROF_CLASSES[cls].unit` · 동료/몹=`mdl`) `ATK_STYLE` 이 그대로 걸린다 → 레인저 3연사 · 히드라 가시 · 드라군 플라즈마 · 탱크 포탄 · 아콘 보이드로 각자 다르게 나간다. 옛 `S.shots`(직선 하나) 는 삭제됐다.
    - 스토어는 **둘**이다(오토배틀과 같은 구조): `_hb.fxU`= 정규화(0~1) — 유닛별 발사 / `_hb.fx`= 월드 좌표 — 사망. 진행은 `tickUnitFx`+`FX.advance` 둘 다, 그리기는 `FX.drawShots` 를 각각의 좌표 매핑으로.
    - ⚠ **좌표계**: `HB_FX_SPAN=390`(월드 390 = 관리자 화면 폭 1.0). 오토배틀 `STK_FX_SPAN=1400` 과 같은 뜻이고, 사냥터는 월드가 거의 1:1 px 이라 390 이면 관리자와 크기 체감이 같다. 이펙트 크기는 **줌을 따라간다**(`(SPAN*S.k)/390`) — 고정하면 확대했을 때 이펙트만 쪼그라든다.
    - ⚠ 이펙트는 **공격이 실제로 일어나는 틱**에 낸다. 사거리 판정에 걸면 근접 몹은 자기 이펙트(발톱·낫)가 영영 안 나온다.
    - ⚠ 이름: 스토어 접근자는 **`hbFxStore`/`hbFxUnit`** 이다. 사냥터엔 이미 `hbFx(dt)`(이펙트 스텝)가 있어서 `hbFx` 로 두면 선언 둘이 서로를 덮어 **무한 재귀**가 난다(실제로 스택 오버플로가 났다).
  - 🧊 **3D 연결: 역할의 이동 방식과 모델의 성질이 반드시 일치해야 한다.** M3D 는 `FXLAB_AIR`(비행 모델 단일 출처, `js/18-strike.js`)를 보고 **모델 id 로** 자동 부양시킨다 — `way` 를 보지 않는다. 그래서 어긋나면 3D 에서 바로 티가 난다: 비행 역할에 지상 모델이면 비행체가 땅을 기고(dg7 `thornqueen`→`wyvern` 으로 교체), 지상 역할에 비행 모델이면 걸어야 할 놈이 떠 있다(dg4 `stinger` 를 돌격→비행으로). 스모크가 편성표를 훑어 막는다.
  - ⚠ **고도를 코드에서 더하지 말 것.** `HB_AIR_LIFT` 는 **2D 폴백 전용**이다. 3D 목록(`hb3dList`)에서 `y` 를 빼면 화면에서 뜨는 게 아니라 **바닥 위를 북쪽으로 미는** 것이라 M3D 의 자동 부양과 이중으로 어긋난다.
  - ⚠ **크기는 `u.bossScale` 로 넘긴다 — `u.size` 는 메인 sync 가 보지 않는다.** M3D 의 per-unit 크기 손잡이는 `bossScale` 하나뿐이라(`SCALE[id] × bossScale`), `size` 에 넣으면 2D 폴백만 커지고 3D 는 그대로다.
  - 💰 **경제는 `hbRwNormPlan(plan)` 이 지킨다 — 그 웨이브의 평균 처치 보상은 늘 1.0.** `rw` 는 역할끼리의 상대 크기만 뜻하고, 구성이 라운드·웨이브마다 달라져도 시급(→`umRate()`→유즈맵 앵커)이 안 움직인다. ⚠ 예전엔 던전당 한 번만 계산했는데, 구성이 변하는 지금 구조에서는 그걸로 부족하다(빼면 R1W1 이 0.661 로 떨어진다). *왜 '보상÷체력'이 아니라 '평균 보상'인지는 `BALANCE.md` §6 이 단일 소스다.*
- **자동사냥 전장 확장(Phase 4)** — 스킬 3종(`HB_SKILLS` 폭발·응급·감속, 쿨다운 `_hb.skT`) · 부스트 2종(`HB_BOOSTS` 수입×2·공격×2, 만료 시각 `hunt.boostT`, 이미 걸려 있으면 연장) · 아군(`HB_BUILD` 동료·터렛·벙커 = 미네랄 영구 구매 `hunt.build`, 장착 펫은 자동 소환). 배치는 `hbLayoutAllies()`가 월드 좌표로 세우고 구매 즉시 다시 부른다. ⚠ **아군 발사 주기는 캐릭터 쿨다운(`c.cd`)을 공유한다** — 공속 업그레이드가 전부를 빠르게 한다는 뜻이고, 검사할 때 캐릭터를 막으면 아군도 멈추므로 '아군 유무 비교'로 재야 한다(실제로 한 번 헛짚었다). 벙커는 반경 150 안의 적을 도발해 대신 맞고 라운드 시작마다 수리된다. **처치 처리는 `hbKill()` 한 곳** — 캐릭터·동료·펫·터렛·스킬이 전부 이 경로를 지난다(보상 규칙을 여러 벌 두지 않는다).
- **자동사냥(`hb*`) = HOME 메인 전투** (2026-08-09, Phase 1). 마린키우기식 웨이브 방어 — 라운드 = 5웨이브 · 웨이브 20초 · **시간 안에 못 비우면 실패**(아래 「웨이브 실패」 참고 — 2026-08-12에 '적 누적' 규칙에서 바뀌었다) · 마지막 웨이브 뒤 필드를 비워야 클리어. 보상(미네랄·가스·XP)은 `_hb.buf`에 쌓였다가 **라운드 클리어 때만 지급**(`hbSettle`) — 사망(`hbDie`) = 버퍼 소실 + 라운드 하강. 등반 모드 `hunt.climb`. 영구 업그레이드 6종 = `PROF().hunt.upg`(미네랄 구매, `hmBuyUpg`) — **스탯 포인트 체계는 v6에서 흡수**: `migrateProfile`이 배분 스탯→업그레이드 레벨(캐릭터 중 최대)·잔여 포인트→미네랄(1pt=20)로 1회 이관(`hunt.migrated`), `profApplyLevelUps`는 이제 포인트 대신 미네랄(레벨당 10)을 준다. ⚠ **시뮬 시계는 rAF가 아니라 50ms 인터벌**(`hbPump`) — 이 환경·백그라운드 탭에서 rAF가 멎어도 전투가 돈다(rAF는 그리기 전용). 스모크는 `_hb.manual=true`로 인터벌을 끄고 `hbStep`을 직접 돌린다. ⚠ 블록을 통째로 바꿀 땐 끝 마커 주의 — `_hbRaf=requestAnimationFrame(hbFrame)`은 hbStart와 hbFrame 두 곳에 있어 첫 매칭으로 자르면 옛 함수 7개가 뒤에 남아 조용히 이긴다(실제로 그랬다). 격리 규칙(G/U/M3D 미접촉)은 던전과 동일. 라운드 선택 시트(#hbRoundSheet — 껍데기는 친구 시트와 같은 공용 .twSheet · **좌상단 아이콘 버튼 `#hbRoundBtn`(깃발)** 으로 연다. 중앙 `.hbMid`는 `pointer-events:none` 표시 전용이다)는 최고 도달(hunt.best[dg])까지만 고를 수 있고, 반복(climb=false)=같은 라운드 무한 파밍 / 등반(climb=true)=클리어 시 +1. 처치 보상은 즉시 지급이고 사망 시 잃는 것은 클리어 보너스뿐(hbSettle). 업그레이드 카드는 접이식(hunt.upgDown)이고 전장 중심은 hbResize가 재는 보이는 영역(재화 바 아래~카드 위)을 따른다. 던전 1~10 선택은 라운드 팝업 안 칩(hbGoDungeon) — 해금은 `hbDgOpen(dg)` = 이전 던전 최고 라운드 ≥ HB_DG_UNLOCK(10). 엘리트는 `hbEliteChance(dg,round)`(라운드·던전 비례, 상한 35%)로 체력 ×4·공격 ×1.6·보상 ×5, 그리기는 30px + 금색 링. 🎟 장비 뽑기권은 엘리트 8% / 일반 0.3%로 떨어지고 **유일한 소비처는 마을 뽑기집의 `profUseGearTicket()`** — 그전까지는 토벌에서 주기만 하고 쓸 데가 없는 죽은 재화였다. ⚠ 옛 층 등반 콘텐츠는 표기가 '토벌'이고 '던전'은 자동사냥 전용어다(코드 식별자 dg*/DG_*는 옛 이름 유지).
- **자동사냥 전장 확장(Phase 4)** — 스킬 3종(`HB_SKILLS` 폭발·응급·감속, 쿨다운 `_hb.skT`) · 부스트 2종(`HB_BOOSTS` 수입×2·공격×2, 만료 시각 `hunt.boostT`, 이미 걸려 있으면 연장) · 아군(`HB_BUILD` 동료·터렛·벙커 = 미네랄 영구 구매 `hunt.build`, 장착 펫은 자동 소환). **전용 '건설' 팝업은 폐지됐다**(2026-08-12) — 고용·건설 카드는 업그레이드 패널의 동료·건물 구역에 있고 스킬 바 버튼도 뺐다. 배치는 `hbLayoutAllies()`가 월드 좌표로 세우고 구매 즉시 다시 부른다. ⚠ **아군 발사 주기는 캐릭터 쿨다운(`c.cd`)을 공유한다** — 공속 업그레이드가 전부를 빠르게 한다는 뜻이고, 검사할 때 캐릭터를 막으면 아군도 멈추므로 '아군 유무 비교'로 재야 한다(실제로 한 번 헛짚었다). 벙커는 반경 150 안의 적을 도발해 대신 맞고 라운드 시작마다 수리된다. **처치 처리는 `hbKill()` 한 곳** — 캐릭터·동료·펫·터렛·스킬이 전부 이 경로를 지난다(보상 규칙을 여러 벌 두지 않는다).
- **🔗 유즈맵 보상은 사냥터 시급에 앵커한다**(2026-08-19) — `umRate()`(분당 미네랄) × `UM_ANCHOR_MIN`(60) × `umProgress()` × `umDiffMul()`. **시급의 단일 소스는 `hunt.rate`** 하나이고 방치 수입(`profIdleRate`)이 이미 같은 값을 본다 — 유즈맵용 곡선을 새로 만들지 말 것. ⛔ 옛 고정 공식(`5+kills*0.2+round*4`)으로 되돌리지 말 것: 지수 곡선에 삼켜져 던전1 R50에서 **0.7초치**였다. ⚠ **경험치는 앵커에 붙이지 않는다** — `HB_ROUND_XP`(1.03)가 만드는 '레벨의 벽'이 무너진다. `umProgress()`는 맵마다 뜻이 다르다: 네모=클리어 1.0/미클리어 라운드 비율 · 오토배틀=승패 `UM_STK_W_WIN` + 굴린 비율 `UM_STK_W_SPEND` + 버틴 시간 `UM_STK_W_TIME`(패배 상한 0.55) · 무한=라운드 비율. 오토배틀 소모량은 **세지 않고 역산한다**(`시작금 + side.earned − gold`) — 골드를 깎는 곳이 넷이라 각자 세면 새 소모처에서 어긋난다. 스모크가 비례·XP 불변·폴백·진행도·`earned` 누적을 전부 검사한다.
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
  - **환생 `profRebirth(c)`** (2026-08-19 전면 개편) — **`PROF_REB_MIN_LV`(100)부터 언제든, 몇 번이든**. `c.rebLvMax` 가 같은 레벨 재환생을 막는다(늘 지난번보다 높은 레벨이어야 한다). ⛔ 고정 사다리로 되돌리지 말 것 — 요구 레벨 **사이 구간이 통째로 버려졌다**(Lv174 환생 = Lv145 환생과 같은 보상).
  - 보상은 **회차가 아니라 그때의 레벨**이 정한다: 경험치·미네랄 배수 `profRebGainAt(lv) = (lv-100)×REB_LIN(0.01)` · 포인트 `profRebGrantAt(lv) = 1 + 60×ln(1+lv-100)`. Lv100 즉시 환생이면 배수는 정확히 0이다.
  - ⛔ **배수를 기하로 두지 말 것** — 배수가 XP 수입을 올리고 → 다음 사이클 레벨이 오르고 → 배수가 `g^레벨` 이라 또 커진다. 되먹임이다. 실측 5회 만에 **Lv1411 · 배수 ×1900만**. 깊이 밀 이유는 배수가 아니라 **환생 포인트(복리)** 가 맡는다.
  - **배수는 곱이 아니라 합으로 쌓인다**(`c.rebMul += gain`, 배수 = `1 + rebMul`) — +0.05 뒤 +0.25 면 ×1.30 이다.
  - **되돌리는 것**: 레벨·경험치·유닛 레벨·레벨 포인트 · **`hunt.upg`(미네랄 업그레이드 레벨)** · **`p.pcoin`(미네랄 재화)** · **`hunt.dg`/`hunt.round` → 1-1**.
  - **남는 것**: **`hunt.unl`(업그레이드 해금)** · **`hunt.best`(최고 기록)** · 환생 포인트 · 장비 · 펫 · 가스 · 젬 · 뽑기권 · 진화★.
  - ⭐ **1-1 로 되돌아가되 '깼던 구간은 열려 있다'** — `hunt.best` 를 안 지우므로 `hbSetRound`/`hbGoDungeon` 으로 곧장 복귀할 수 있고, `hbDoRebirth` 가 토스트로 그 사실을 알려 준다(모르면 1-1 부터 손으로 걸어 올라간다). ⛔ `hunt.best` 를 같이 지우지 말 것 — 던전 해금과 복귀 경로가 통째로 사라진다.
  - ⚠ 미네랄 **재화**를 안 지우면 환생 직후 즉시 되사서 리셋이 무의미해진다. 반대로 **해금**까지 지우면 매 회차 초반이 해금비로 막힌다 — 이 둘의 비대칭이 설계의 핵심이다.
  - ⚠ 기록 기반 RP(`profRecordRp`)는 폐지했다 — '마지막 환생 이후'라는 상태가 없어졌고, 깊이 민 보상은 환생 자체가 이미 준다(두 벌로 두면 같은 진행을 두 번 센다).
  - 실측(자동 플레이 · 환생 뒤 최고 기록으로 복귀하는 플레이 기준): 던전2 진입 **Lv288**(2.3h) · 던전3 **Lv662**(2.9h) · 던전4 **Lv1188**(5.5h) · 던전5 **Lv1817**(9.5h · 환생 6회).
  - ⚠ **던전:레벨 대응을 조정하는 레버는 `HB_ROUND_HP`(던전1 기울기)와 `HB_ROUND_HP_D`(던전마다 더하는 값)** 다. RP 지급식(`PROF_REB_RP_K`)은 '뒤 던전일수록 더 드는가'의 모양을 정한다.
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
