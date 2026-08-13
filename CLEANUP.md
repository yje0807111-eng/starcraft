# CLEANUP — 지울 후보 목록

`sc-ums-web.html`(단일 파일) 전체 스캔 결과. 2026-08-14 기준.

판정 절차(순서대로):
1. 이름이 문서에 **그대로** 나오는가
2. 안 나오면 **조립 접두사 대조** — `'P'+` 꼴 문자열 리터럴을 모아 `name.startsWith(P)` 확인
3. 그래도 애매하면 브라우저에서 화면을 돌며 `document.querySelector('.'+c)` 로 실물 확인

> ⚠️ 2번을 건너뛰면 안 된다. 1차 시도에서 `sc-all`/`fDot-*` 를 지웠다가 **로비 채팅이 통째로 안 보이게** 만들었다(§D 참고).

- ✅ = 삭제 완료
- ❓ = 살아 있으나 지금 방향에서 벗어남 — **사용자 판단 필요**

---

## A. 삭제 완료 ✅ (2026-08-14)

### A-1. 아무도 안 부르는 함수 12개 — 53줄 삭제
| 함수 | 무엇이었나 |
|---|---|
| `_openTownOld_disabled` | 옛 마을 열기 (이름부터 disabled) |
| `deployBestToBoss` | 보스에게 최정예 자동 파견 |
| `setVol` | 소리 볼륨 슬라이더 핸들러 (슬라이더 폐기) |
| `toggleSortMenu` | 옛 정렬 드롭다운 |
| `armBossPick` | 보스 지정 배치 |
| `cancelResearch` | 연구 취소 |
| `profDoBuyItem` | 옛 장비 구매 경로 |
| `renderBtPicker` | 전투실험 유닛 피커 |
| `toggleBossArena` | 보스 아레나 토글 |
| `hbCloseBuild` | 사냥터 건설 드롭다운 닫기(지금은 `renderHbBuild`가 처리) |
| `hbOpenR` | `hbOpenRounds` 로 대체된 옛 이름 |
| `hmFitUpgGrid` | **빈 함수** `{}` — 고정 높이로 바뀌며 속만 비었다 |

### A-2. 참조 없는 에셋 5개 — 2,673KB 회수
`assets/models/marine_watch.glb`(1,105KB) · `firebat.glb`(850KB) · `dragoon_attack.glb`(710KB) ·
`assets/icons/buildings/bld_infested_command.webp`(6KB) · `assets/icons/auto/auto_rally.webp`(2KB)

### A-3. 안 쓰이는 CSS — 규칙 72개 삭제 · 셀렉터 2개 축소 · 고아 주석 5줄 — 약 77줄
| 묶음 | 클래스 |
|---|---|
| 유즈맵 옛 머리 | `msHead` `msHeadL` `msUser` `msGear` `msSortCar` |
| 옛 전투 컬럼 뷰 | `btCol` `btColHead` `btSplit` |
| 옛 스킬 바 | `skBtn` `hbSkTx` `hbBdBtn` |
| 옛 허브 화면 | `hsHead` `hsHTitle` `hsTabBtn` `hsOnDot` `hsResult` |
| 마을 구역 라벨 | `tzIco` `tzLbl` `tzBld` |
| 낱개 | `homeBoss` `moLockNote` `tabSet` `plcnt` `stUnitCard` `portJob` `be-nm` `tm1` `tm2` `ucProd` `ucCost` `tpCard` `tierTag` `cpPop` `hmStatPt` `hmUpEmo` `ptLv` `ptT` `mcIco` `pbDot` `ic-ok` `ic-warn` `setSub` |

> 셀렉터 축소 2건: `.tzIco,.twAvBody,…` → `.twAvBody,…` / 팝업 열림 규칙에서 `.tpCard`·`.cpPop` 만 제거.

### A-4. 설정 리스트 9 → 3
뒤에 붙은 것이 없는 껍데기 항목을 걷어냈다. **계정**(로그아웃 버튼과 중복) · **언어**(i18n 코드 0건) ·
**패치노트**(설정이 아니라 타이틀/로비 배너 자리) · **개인정보 보호**(스토어 출시 때 부활) · **문의하기**(디스코드와 목적 중복) 삭제.

**채팅 표시**는 지우지 않고 **상단 스위치로 승격** — 열어 보는 화면이 아니라 껐다 켜는 것이다.
`SND.chatOn`(소리와 같은 `nm_snd` 저장소) → `body.chatOff` → 플레이어 채팅·입력창·로비 채팅만 감춘다.
⚠ **시스템 알림(`.cmsg.sys`)은 끄지 않는다** — 뽑기 결과·패배 경고가 그 줄로 나간다.

남은 리스트: 비디오 설정 · 임무 목표 · 디스코드(**URL 없음 — 아직 "준비 중"**)

### A 작업 중 나온 것 — 별건
- **`.msUserTag` 가 스타일 없이 떠 있다.** 마크업(`#msNick` 안 `<span class="msUserTag">#태그</span>`)은 살아 있는데, 스타일이 `.msUser .msUserTag` 로 **없어진 컨테이너 안에 갇혀** 있어 원래부터 적용되지 않고 있었다. 죽은 규칙이라 지웠다 — 태그를 회색 작게 보이게 하려면 `.msUserTag` 로 다시 세워야 한다.

---

## B. 설정 개편으로 죽은 잔재 (아직 남음)

| 대상 | 상태 | 주의 |
|---|---|---|
| `.setRange` `.setVolRow` `_sndDisp` | 볼륨 슬라이더 — 마크업 없음, CSS·JS만 남음 | `_sndPaintBar` 안 슬라이더 갱신 분기도 같이 |
| `.sndGroup` | 옛 소리 묶음 상자 | |
| `.sndBtn` | 마크업 없음. **`.setQGo`(배속 변경 버튼)가 이 선택자에 얹혀 있다** | 지우려면 `.setQGo` 로 이름을 옮길 것 |
| `.setMenu.expanded` `.setItem.open` `.setBody.on` | 옛 아코디언(`setExpand`) 잔재 — 함수는 삭제됨 | |

---

## C. 방향이 굳으면 지울 것 ❓ — 판단 필요

지금은 **동작한다**. 게임 방향이 「혼자 하는 사냥터 + 메타 성장」으로 굳으면 통째로 빠지는 덩어리들.

| 시스템 | 규모 | 판단 포인트 |
|---|---|---|
| **직스 strike 모드** (컴퓨터가 싸운다·팀 순환 출격) | 선언 192개 · 최대 덩어리 | 별도 유즈맵으로 유지할지 |
| **관리자 샌드박스 · 전투실험 · FX 랩** | 선언 76개 | 출시 빌드에서 뺄 것인가 (남겨두면 유용) |
| **Supabase 실시간 소셜** (로비 채팅·귓말·파티·친구) | 선언 35개 | 멀티를 계속 갈 것인가 |
| **실제 방 시스템** (`RTROOM`·방 목록·시뮬 봇 방) | 선언 33개 | 위와 한 몸 |
| **던전 `DG`(토벌, 3곳)** | 선언 45개 | 사냥터 10곳과 역할이 겹침 — 하나로 합칠지 |
| `sk_nova` · `sk_emrg` · `sk_slow` (임시 스킬 아이콘) | 3장 | `sk_heal`·`sk_ensnare` 와 의미 중복. 스킬 확정 후 한쪽 폐기 |
| 사냥터 팝업 `.hbmCard` | — | 흰 테두리(옛 스타일) → 메탈 링으로 옮길지 |

---

## D. 지우지 말 것 — 스캔이 죽었다고 하지만 살아 있다

**전부 이름이 문자열로 조립된다.** 이름 검색만으로는 절대 안 잡힌다.

| 대상 | 조립 지점 |
|---|---|
| `sc-all` `sc-party` `sc-friend` | `'mcLine sc-'+scope` — ⚠ **한 번 지웠다가 채팅이 통째로 안 보였다** (`.msChat .mcLine{display:none}` 이 기본이고 `.sc-*` 가 켜 준다) |
| `fDot-*` `fL2-*` `fStat-*` | `'fDot-'+st` / `'fL2-'+st` / `'fStat-'+(busy?'busy':st)` — 친구 상태 |
| `assets/icons/buildings/*` 39장 | `_techBldgPortrait` → `'bld_'+건물키` |
| `assets/icons/upgrades/*` 12장 | `upgIcoHTML` → `'up_'+UPG_ICO[k]` |
| `assets/icons/skills/sk_*` 21장 | `skillIcoHTML` → `'sk_'+(SKILL_ICO[k]‖k)` |
| `assets/icons/shop/shop_*` 6장 | `SHOP_DEAL_POOL` 의 `d.id` |
| `assets/backgrounds/dungeons/dg4.webp` | `hbBgImg` → `'dg'+n` (던전 10곳) |
| id `vc-1` `vcol-1` `flag-bgm` … | `'vc-'+spd` · `'flag-'+key` |
| id `hudRwrap` `miniBox` `rsQuit` `bpBattle` `sprScale` … | 마크업 + CSS 로만 쓰는 정상 id |
| CSS `googleapis` `jsdelivr` `woff2` `com` `net` | URL 조각을 클래스로 오인 |

**헷갈렸지만 진짜 죽은 것**(접두사가 겹쳐 살아 보였다): `hbSkTx`·`hbBdBtn`(`'hb'+`는 uid 생성) · `hmUpEmo`(`'hmUp'+`는 `hmUp lk` 만 만든다).

---

## 검증

각 단계마다 `npm test`(lobby 65 / game 29 / sandbox 5) 통과 + 브라우저에서 화면을 돌며
`document.querySelector('.'+지운클래스)` 가 전부 `null` 인지 확인했다.
