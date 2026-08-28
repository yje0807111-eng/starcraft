/* ============================================================================
 * 08-hunt.js — ⛔ 옛 자동사냥(캠프가 대체함) · 던전 1~10 데이터 · 마을 · 전투 루프
 *
 * ⛔⛔ HOME 메인 게임은 이 파일이 아니다. 2026-08-23 부터 **캠프(19-camp.js)** 다.
 *   여기 남은 이유는 **던전 1~10 데이터와 마을**이 아직 쓰이기 때문 — 웨이브 방어 자체는 화면에 안 나온다.
 *   HOME 게임플레이를 고치러 왔다면 `js/19-camp.js` 와 `ARCHITECTURE.md` §「🏕 캠프」로 갈 것.
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ── ⚔ 자동사냥(HOME 메인 전투) — 마린키우기식 웨이브 방어 ──
// ⛔ 유즈맵(G / U / M3D / GACHA_*)과 완전 분리 — 던전과 같은 격리 규칙. 표·상태·루프·렌더 전부 자체 보유.
// 확정 규칙(2026-08-07):
//   라운드 = 5웨이브 · 웨이브 20초 · 못 잡은 적은 다음 웨이브와 누적(마린키우기식)
//   웨이브를 다 비우면 3초 뒤 즉시 다음 · 마지막 웨이브 종료 후 필드를 비워야 라운드 클리어(잔존 적 소탕 = 'mop')
//   보상(미네랄·가스·XP)은 라운드 버퍼(_hb.buf)에 쌓였다가 클리어 때만 지급 — 사망 = 버퍼 소실 + 라운드 하강
//   등반 모드(hunt.climb) ON = 클리어 시 다음 라운드 · OFF = 같은 라운드 무한 반복
//   던전 1~10(레벨 밴드·큰 격차)은 HB_DG_MUL 하나로 — 선택 UI는 Phase 2
// ⚔ 던전 1~10 — 스웜 → 유니온 → 에테리얼을 순환하며 갈수록 강한 유닛이 나온다.
// 이 표가 던전 정체성의 단일 소스다. 적 유닛(mdl)은 RACE_ROSTER/MODELS의 실제 3D 모델 키,
// 바닥(tile)은 assets/tiles의 실제 파일, tint는 그 위에 덮는 색(a가 클수록 어둡고 무섭게).
// ⚠ 새 던전을 넣거나 적을 바꿀 땐 여기만 고친다. 스모크가 모델 키·타일 파일 실재를 검사한다.
// 👾 적 종류 = **단일 소스**. 스탯·행동·크기·이동 방식을 여기서만 정한다.
//   ⚠ 외형(mdl/ico)은 여기 없다 — 역할과 얼굴은 분리돼 있어서 같은 '사수'가 던전마다 다르게 생겼다.
//   way 'ground' 벽을 못 넘어 거리장으로 우회(기본) · 'phase' 벽을 통과(유령) · 'air' 벽·기지를 통째로 무시(비행)
//   rng  0 이면 근접(HB_STOP 까지 붙는다) · >0 이면 그 거리에서 멈춰 쏜다
//   rw   처치 보상 배수 — 던전 안에서 역할끼리의 **상대** 크기만 뜻한다(중장갑이 돌격보다 많이 준다).
//        절대 크기는 hbRwNormPlan(plan) 이 **웨이브마다** 맞춘다 → 그 웨이브의 평균 처치 보상은 늘 1.0.
//        ⚠ 이게 시급을 지키는 핵심이다. 실측해 보니 이 엔진의 처리량은 **웨이브 페이스**가 정한다 —
//          처치 수는 편성을 바꿔도 거의 안 변하고(42.9→39.8), 시급은 오직 '처치당 보상'을 따라간다.
//          그래서 '보상÷체력'을 맞추는 것으로는 부족했다(그렇게 했다가 던전1 R20 시급이 −32% 났다).
//          시급은 hunt.rate → umRate() → 유즈맵 보상 앵커까지 그대로 이어진다.
const HB_FOE_KIND={
  grunt : {nm:'기본',   hp:1.00, atk:1.00, spd:50, sz:1.00, rng:0,   way:'ground', rw:0.854},
  runner: {nm:'돌격',   hp:0.55, atk:0.75, spd:96, sz:0.76, rng:0,   way:'ground', rw:0.469},
  ranger: {nm:'사수',   hp:0.70, atk:0.85, spd:44, sz:0.95, rng:118, way:'ground', rw:0.687},
  flyer : {nm:'비행',   hp:0.75, atk:0.90, spd:64, sz:0.92, rng:92,  way:'air',    rw:0.800},
  brute : {nm:'중장갑', hp:2.60, atk:1.45, spd:32, sz:1.38, rng:0,   way:'ground', rw:2.219},
  phase : {nm:'유령',   hp:0.85, atk:1.15, spd:54, sz:0.95, rng:0,   way:'phase',  rw:0.834},
};
function hbKindOf(k){ return HB_FOE_KIND[k] || HB_FOE_KIND.grunt; }
const HB_FOE_ROLE=[{hp:1.0, atk:1.0, spd:50},{hp:0.7, atk:0.8, spd:82},{hp:1.6, atk:1.3, spd:38}];   // (구) 3자리 역할 — 옛 foes 표 하위호환용으로만 남는다
const HB_FOE_SPD_MUL=1.45;   // 미로 때문에 걷는 거리가 길어져 전체 속도를 올렸다 — 속도 조절은 이 손잡이 하나로

// 🎭 역할 → 얼굴. **던전마다 60줄을 손으로 쓰지 않는다** — 종족 팔레트 하나에서 뽑는다.
//   ⚠ phase(유령)는 반드시 **지상 모델**이어야 한다(way!=='air' 이므로) — FXLAB_AIR 에 없는 것만 넣을 것.
//     유니온은 은신 침투병 ghost, 에테리얼은 dark_templar, 스웜은 thornqueen 이 그 자리다.
const HB_RACE_FACE={
  swarm:    { grunt:[['swarm_larva','🥚'],['snapper','🦗']], runner:[['broodling','🐛']],
              ranger:[['hydra','🐍']], flyer:[['stinger','💥'],['wyvern','🦇']],
              brute:[['ultralisk','🦏']], phase:[['thornqueen','👑']] },
  union:    { grunt:[['worker_human','🔧'],['marine','🪖']], runner:[['racer','🏍']],
              ranger:[['machinegun','🔫'],['tank','🛡']], flyer:[['hellfire','🔥'],['dreadnought','🚀']],
              brute:[['goliath','🤖']], phase:[['ghost','👻']] },
  aetherial:{ grunt:[['worker_light','🔹']], runner:[['blade','⚔️']],
              ranger:[['dragoon','🔷']], flyer:[['observer','👁'],['falcon','🦅']],
              brute:[['archon','⚡']], phase:[['dark_templar','🌑']] },
  abyss:    { grunt:[['archon','⚡']], runner:[['broodling','🐛']],
              ranger:[['dragoon','🔷']], flyer:[['dreadnought','🚀']],
              brute:[['ultralisk','🦏']], phase:[['dark_templar','🌑']] },
};
// 📈 등장 규칙 — **라운드와 웨이브가 정한다**(던전이 아니다).
//   from  이 라운드부터 나온다(문턱)  ·  ramp  이 라운드에 상한에 닿는다
//   cap   **웨이브당 최대 마릿수**(0=무제한). 적이 아무리 많아져도 이 수를 절대 안 넘는다 —
//         '하늘이 덮이는' 상황이 구조적으로 불가능해진다.
//   ⚠ 기본·돌격은 상한이 없다(주력). 나머지 넷은 상한이 곧 난이도 천장이다.
const HB_SPAWN={
  grunt : {from:1,  ramp:1,  cap:0},
  runner: {from:1,  ramp:1,  cap:0},
  ranger: {from:5,  ramp:35, cap:4},
  flyer : {from:15, ramp:45, cap:5},
  brute : {from:30, ramp:60, cap:3},
  phase : {from:50, ramp:80, cap:2},
};
const HB_WAVE_MUL=[0.45, 0.75, 1.0];   // 웨이브 1·2·3 — 뒤 웨이브일수록 까다로운 놈이 많다
const HB_BASIC_MIN=1;                  // 어떤 웨이브든 기본 계열을 최소 이만큼은 남긴다
// 그 라운드·웨이브에서 이 역할이 **몇 기까지** 나오는가
function hbKindQuota(k, round, wave){ const P=HB_SPAWN[k]; if(!P) return 0;
  if(!P.cap) return -1;                                   // -1 = 무제한(기본·돌격)
  if(round<P.from) return 0;                              // 아직 안 나오는 라운드
  const span=Math.max(1, P.ramp-P.from);
  const t=Math.max(0, Math.min(1, (round-P.from)/span));
  const byRound=Math.max(1, Math.round(P.cap*t));          // 문턱에선 1기부터 — 처음 만나는 순간이 최대치면 안 된다
  const w=HB_WAVE_MUL[Math.max(0,Math.min(HB_WAVE_MUL.length-1,(wave||1)-1))];
  return Math.max(0, Math.min(P.cap, Math.round(byRound*w))); }
// 얼굴 뽑기 — 같은 역할이라도 던전 종족에 맞는 모델로 나온다
function hbFaceOf(D, k){ const pal=HB_RACE_FACE[(D&&D.race)||'union']||HB_RACE_FACE.union;
  const arr=pal[k]||pal.grunt||[['marine','🪖']];
  const f=arr[(Math.random()*arr.length)|0]||arr[0];
  return { mdl:f[0], ico:f[1] }; }
const HB_DUNGEONS=[
  {dg:1,  race:'swarm',     name:'감염된 둥지',   tile:'badlands',          tint:'rgba(38,54,26,.30)'},
  {dg:2,  race:'union',     name:'버려진 전초기지', tile:'terran_tile_light', tint:'rgba(30,38,52,.32)'},
  {dg:3,  race:'aetherial', name:'잊혀진 회랑',   tile:'protoss_floor',     tint:'rgba(34,30,58,.34)'},
  {dg:4,  race:'swarm',     name:'산란장',       tile:'badlands',          tint:'rgba(40,44,20,.42)'},
  {dg:5,  race:'union',     name:'폐쇄된 시설',   tile:'installation',      tint:'rgba(26,32,44,.46)'},
  {dg:6,  race:'aetherial', name:'봉인된 성소',   tile:'protoss_floor',     tint:'rgba(30,24,58,.50)'},
  {dg:7,  race:'swarm',     name:'군단의 심장',   tile:'ashworld',          tint:'rgba(52,20,16,.54)'},
  {dg:8,  race:'union',     name:'함대 정박지',   tile:'space_platform',    tint:'rgba(20,26,40,.58)'},
  {dg:9,  race:'aetherial', name:'공허의 문',     tile:'protoss_floor',     tint:'rgba(26,14,46,.62)'},
  {dg:10, race:'abyss',     name:'심연',         tile:'space_bg',          tint:'rgba(30,8,14,.66)'},
];
function hbDun(dg){ return HB_DUNGEONS[Math.min(HB_DUNGEONS.length, Math.max(1, dg||1))-1]; }
const HB_DG_MAX=10;                 // 던전 1~10
// 🏁 던전 하나 = 50라운드. 50을 깨면 자동으로 다음 던전 1라운드로 넘어간다(hbSettle).
//    ⭐ 그래서 던전은 '난이도 점프'가 아니라 **50라운드짜리 챕터**다 — 곡선은 아래에서 이어 붙인다.
//    ⚠ 2026-08-25 에 99 → 50 으로 줄였다. 설계 단일 소스(HUNT_R1.md §6-1)가 처음부터 50이었고
//       코드만 99로 갈라져 있었다. 이 상수 하나에서 전부 파생된다(hbProg · hbCurve · hbRoundS · 해금).
const HB_ROUND_MAX=50;
// 🎁 던전 최초 진입 보너스 = 그 던전 1라운드 클리어 보너스의 이 배수. 한 번뿐이다.
const HB_DG_ENTER=40;
const HB_DG_UNLOCK=HB_ROUND_MAX;    // 다음 던전 해금 = 지금 던전을 끝까지(50) 깼을 때
// ⚠ 배경·밸런스 확인용 전체 개방. 해금 진행을 되살리려면 이 한 줄만 false로.
//    (const이 아니라 let인 이유: 스모크가 양쪽 상태를 다 검사한다)
let HB_DG_ALL_OPEN=true;
// 엘리트 — 라운드·던전이 오를수록 자주 나온다. 체력·공격이 크고 보상도 크다.
const HB_ELITE_HP=4, HB_ELITE_ATK=1.6, HB_ELITE_REW=5, HB_ELITE_MAX=.35;
const HB_AIR_LIFT=18;        // ✈️ 공중 유닛을 띄워 그리는 높이(월드 px) — 바닥 그림자와 짝이다
const HB_ELITE_SCALE=1.46;   // 엘리트는 더 크게 — 옛 2D 그리기의 38/26 을 상수로 꺼낸 것(크기가 종류별로 갈리면서 한 곳이 필요해졌다)
// 👑 보스 = 마지막 웨이브에 섞여 나오는 한 마리. 별도 단계가 아니라 그 웨이브의 유닛이다.
//    라운드 클리어 조건이 '잔적 0'이라, 보스를 눕혀야 웨이브가 비고 곧 클리어가 된다.
const HB_BOSS_HP=14, HB_BOSS_ATK=2.4, HB_BOSS_REW=18, HB_BOSS_SPD=0.72, HB_BOSS_SCALE=1.85;
const HB_TICKET_ELITE=.08, HB_TICKET_NORMAL=.003;   // 장비 뽑기권 드랍 확률
// 라운드 구성(확정 스펙 — 바꾸려면 사용자와 합의). 2026-08-12: 미로가 생겨 이동 거리가 늘어난 만큼 재조정.
//   5웨이브 20초 → 3웨이브 50초 · 마지막(보스) 웨이브만 +30초 · 다 잡으면 3초 뒤 바로 다음 웨이브.
const HB_WAVES=3, HB_WAVE_S=50, HB_GAP_S=3;
const HB_BOSS_EXTRA_S=30;                        // 보스 웨이브에 얹는 여유
function hbWaveTime(w){ return HB_WAVE_S + ((w>=HB_WAVES)?HB_BOSS_EXTRA_S:0); }
// 🎟 동료 뽑기권 — 동료를 얻는 유일한 길이라 장비보다 귀하게 준다(엘리트 위주).
//   ⚠ 주는 곳이 없으면 동료 시스템 전체가 잠긴다 — 새 소비처를 만들 땐 여기도 같이 볼 것.
const HB_ATICKET_ELITE=.03, HB_ATICKET_NORMAL=.0008;
// 🎟 펫 뽑기권 — 상자·젬으로도 들어와 동료보다 넉넉하게 준다
const HB_PTICKET_ELITE=.05, HB_PTICKET_NORMAL=.0015;
const HB_SPREAD_N=12, HB_SPREAD_S=5;             // 웨이브 유닛이 이보다 많으면 5초에 걸쳐 분산 출현
const HB_STOP=30, HB_DOWN_S=3;
const HB_FAIL_S=3;   // 웨이브 시간 초과 → 이만큼 뒤에 1웨이브부터 다시(라운드는 유지)
// 전장은 화면 픽셀이 아니라 '월드 좌표'다. 캐릭터가 원점(0,0)이고 적·사거리·글자가 전부 월드 단위.
// 그리기 직전에 카메라 한 번(translate+scale)으로 화면에 맞춘다 → 보이는 영역이 커지면 배율 k가 커져
// 캐릭터만 내려가는 게 아니라 장면 전체가 같은 비율로 확대된다.
// (구 HB_WARM_HOLD 는 폐지 — 100% 유지 시간은 LOAD_HOLD 하나가 갖는다. 2026-08-19)
const HB_BG_VIG_IN=0.42, HB_BG_VIG_A=0.62;   // 배경 그림 비네트: 시작 반경 비율 · 가장자리 불투명도
// 움직이는 배경(dgN_f1..f4.webp)을 쓸지. 지금은 정지 그림만 쓰기로 해서 꺼 둔다.
// 끄면 프레임 파일을 아예 요청하지 않는다 — 켜 두면 파일이 없는 던전마다 404가 4번씩 난다.
// 프레임을 넣기로 하면 이 한 줄만 true로.
const HB_BG_ANIM=false;
const HB_BG_FRAMES=4;      // 던전당 움직임 프레임 수(dgN_f1..f4.webp) — 있으면 크로스페이드, 없으면 정지 1장
const HB_BG_CYCLE=8;       // 한 왕복(1→2→3→4→3→2)에 걸리는 초. 느릴수록 '숨쉬는' 느낌
// 움직임 크기(0~1). 1=영상 그대로, 0.5=절반만 움직임, 0=정지.
// AI 영상은 모션 강도를 정확히 맞추기 어렵다 — 과하게 나왔을 때 다시 뽑지 말고 이 값을 내린다.
const HB_BG_AMP=1;
const HB_WORLD_H=400;                 // 보이는 영역 높이를 이 값으로 나눈 것이 배율 k
// 🚶 필드 이동 — 캐릭터가 원점 고정이 아니라 걸어다닌다(탭한 곳으로).
const HB_MOVE_SPD=118;                // 월드 단위/초
// 💚 중앙 회복 구역 — 지형이다. 전투 중에도 회복되고, 적도 그 안까지 따라 들어온다.
const HB_HEAL_R=64;                   // 회복 반경(월드 단위) — 실제 반경은 hbHealR()
// 💚 지금 반경 = 기본 × 재생 범위 업그레이드(rrng). ⚠ 걷기·그리기·상자 배치가 전부 이걸 봐야 테두리와 효과가 맞는다.
function hbHealR(){ const c=_hb&&_hb.char; return HB_HEAL_R*((c&&c.rrng)||1); }
const HB_HEAL_PCT=0.06;               // 초당 최대체력 비율
// 🎯 사거리 — 스프라이트 반지름(약 14) 두 개분이 근접의 하한. 업그레이드로만 늘어난다.
const HB_RNG_BASE=34, HB_RNG_MAX=420;   // 맵이 ±HB_MAP_R(300)이라 420 ≈ 가운데서 구석까지 = 자연 상한
// 🎥 줌 보간 기준은 전투 상한과 따로 둔다 — 겸용하면 상한을 올린 순간 같은 사거리에서 화면이 더 멀어진다
//    (사거리 74 기준 실측: 겸용이면 보이는 높이 530 → 602 로 벌어졌다)
const HB_ZOOM_RNG_MAX=190;
const HB_CRIT_DMG=2;      // 치명타 기본 피해 배수(옛 전투식에 2가 박혀 있던 것을 이름으로 꺼냈다)
// 공격 쿨다운 하한. 옛 값 0.22는 1포인트 +50% 체계에선 5포인트 만에 막혀 공속이 함정 스탯이 됐다.
// 시뮬 시계가 50ms 간격(hbPump)이라 0.05 아래는 의미가 없다 — 0.10 이 실질 바닥이다.
const HB_CD_MIN=0.10;
// 쿨다운 하한을 공격속도(%)로 되짚은 값 = 이 축의 실질 상한. 축 표에 cap 으로 넣어야 초과분을 셀 수 있다.
const HB_ASPD_MAX=0.70/HB_CD_MIN*100;   // 700%
// 🔀 상한을 한 번 더 채웠을 때(초과 비율 1.0) 대신 받는 값 — 축의 원래 정체성과 같은 방향으로 흘린다.
const HB_OV_CHEST=2.0;    // 사거리 초과 → 상자 피해 배수 (+200%). 사거리는 원래 '앉아서 상자를 더 부수는' 축이다
const HB_OV_MULTI=0.30;   // 공격속도 초과 → 멀티샷 확률 (+30%p). 더 빨리 못 쏘면 한 번에 여러 발
const HB_OV_CRITD=2.0;    // 치명타 확률 초과 → 치명 피해 (+200%p). 터지는 빈도가 막히면 크기로
// ⚔ 부가 타격 — 멀티샷/바운스샷이 '표적 수 × 풀데미지'가 되면 한 방에 화면이 비므로 부가 표적은 깎아서 때린다.
const HB_MULTI_MUL=0.6;   // 멀티샷 부가 표적 피해 비율
const HB_BOUNCE_MUL=0.5;  // 바운스샷 튕긴 표적 피해 비율
const HB_BOUNCE_R=90;     // 바운스가 옮겨 붙는 반경(월드 단위) — 사거리와 무관하다(맞은 적 주변)
const HB_KNOCK_PX=42;     // 넉백 1회 밀어내는 거리. hbSlide 를 쓰므로 벽을 뚫지 않는다
// 🔍 줌 = 사거리에 종속. 사거리가 짧을 땐 바짝(반경 3배), 길어지면 멀리(1.2배)까지 선형.
const HB_ZOOM_NEAR=4.4, HB_ZOOM_FAR=1.2;
const HB_VIEW_MIN=280, HB_VIEW_MAX=620;   // 보이는 높이(월드 단위) 한계
// 맵 = 배경 그림이 덮는 정사각 영역의 반지름(월드 단위).
// 보이는 높이는 사거리에 따라 변하지만(hbViewH: 280~620) 맵은 상수여야 한다 — 커졌다 작아지면
// 그림이 늘었다 줄었다 한다. 기준은 '기본 줌'(사거리 최소 = hbViewH(34) ≈ 299)의 2배.
// → 기본 줌에서 딱 2×2 화면. 더 크게 잡으면(예: HB_VIEW_MAX 기준 1240) 기본 줌에서 4배가 되고
//   화면에 그림의 24%만 보여 2.5배 확대라 뭉개진다(1536px 원본 기준).
const HB_MAP_R=300;
// 이동 범위 = 맵과 같다. 예전엔 필드(±900×±620)가 그림보다 훨씬 넓어서, 걸어 나가면
// 그림이 끝나고 검은 바닥이 나왔다(“이미지 구역이 너무 좁다”의 정체).
// 카메라는 lim()으로 ±R 안쪽만 비추므로, 이 값이 곧 '그림 밖으로 못 나간다'는 보장이다.
const HB_FIELD_RX=HB_MAP_R, HB_FIELD_RY=HB_MAP_R;
function hbViewH(rng){
  const t=Math.max(0, Math.min(1, (rng-HB_RNG_BASE)/(HB_ZOOM_RNG_MAX-HB_RNG_BASE)));
  const mul=HB_ZOOM_NEAR+(HB_ZOOM_FAR-HB_ZOOM_NEAR)*t;   // 선형
  return Math.max(HB_VIEW_MIN, Math.min(HB_VIEW_MAX, rng*2*mul)); }
const HB_CAM_SNAP=24;                 // 이만큼 넘게 벌어지면 보간하지 않고 즉시 맞춘다(화면 복귀·회전 등)
const HB_CAM_EASE=0.25;               // 접힘/펼침 애니메이션을 좇는 속도(0=정지, 1=즉시)
// ── 영구 업그레이드 6종(미네랄 구매) — 효과·비용 곡선은 밸런스 패스에서 조정 ──
/* 사냥터 업그레이드 — 대상별 4구역(내 캐릭터·동료·건물·펫).
   u = 해금 비용(0 = 처음부터 열림) · v0/vs/f = 값(0레벨값/레벨당/단위) · base/mul = 강화 비용.
   ⭐ 이 표가 값의 **단일 소스**다(2026-08-18). v0/vs 는 '카드에 적는 숫자'가 아니라 **전투에 들어가는 숫자**이고,
      CS_AXES 는 제 base/upgV 를 갖지 않고 여기서 읽어 간다 — 예전엔 두 벌이라 카드가 거짓말을 했다
      (카드 '데미지 10/+2' ↔ 실제 12/+3 · 카드 '사거리 100' ↔ 실제 34).
   ⭐ 32종 전부 전투에 배선돼 있다. 새 키를 넣으면 반드시 아래 넷 중 한 곳에 걸 것 —
      csAxis(축) / hbCharStats(캐릭터 직결) / hbAllyMul(아군) / hbBunkerAtkMul(벙커).
   ⚠ 값의 뜻은 '가산'이다: v0=0 인 것(흡혈·넉백·실드·재화 보너스…)은 0레벨에 효과가 없다.
      배수형(mspd·rrng·아군 %)만 v0=100 으로 시작한다. */
const HB_UPG={
  atk:     {name:'데미지', cat:'char',   u:0,     v0:12,   vs:3,     f:'',   base:5,   mul:1.07,  ico:'upgrades/up_melee_atk'},
  aspd:    {name:'공격속도', cat:'char',   u:0,     v0:100,  vs:1.5,   f:'%',  base:8,   mul:1.08,  ico:'skills/sk_stim'},
  crit:    {name:'치명타 확률', cat:'char',   u:40,    v0:5,    vs:0.6,   f:'%',  base:8,   mul:1.08,  ico:'upgrades/up_gnd_wpn'},
  critm:   {name:'치명 피해', cat:'char',   u:100,   v0:HB_CRIT_DMG*100, vs:5, f:'%', base:11, mul:1.09, ico:'upgrades/up_inf_atk'},
  lifest:  {name:'생명력 흡수', cat:'char',   u:150,   v0:0,    vs:0.5,   f:'%',  base:15,  mul:1.095, ico:'skills/sk_consume'},
  knock:   {name:'넉백 확률', cat:'char',   u:90,    v0:0,    vs:1.5,   f:'%',  base:9,   mul:1.08,  ico:'skills/sk_maelstrom'},
  rng:     {name:'사거리', cat:'char',   u:50,    v0:HB_RNG_BASE, vs:4,  f:'',   base:6,   mul:1.08,  ico:'upgrades/up_range'},
  multic:  {name:'멀티샷 확률', cat:'char',   u:220,   v0:0,    vs:1.2,   f:'%',  base:18,  mul:1.10,  ico:'upgrades/up_range_atk'},
  multin:  {name:'멀티샷 수', cat:'char',   u:450,   v0:1,    vs:1,     f:'발',  base:35,  mul:1.14,  ico:'upgrades/up_air_atk'},
  bncc:    {name:'바운스샷 확률', cat:'char',   u:220,   v0:0,    vs:1.2,   f:'%',  base:18,  mul:1.10,  ico:'skills/sk_disruption_web'},
  bncn:    {name:'바운스샷 표적', cat:'char',   u:450,   v0:0,    vs:1,     f:'체',  base:35,  mul:1.14,  ico:'upgrades/up_veh_atk'},
  scritc:  {name:'슈퍼 치명 확률', cat:'char',   u:380,   v0:0,    vs:0.4,   f:'%',  base:28,  mul:1.12,  ico:'skills/sk_yamato'},
  scritm:  {name:'슈퍼 치명 배수', cat:'char',   u:620,   v0:3,    vs:0.2,   f:'x',  base:45,  mul:1.15,  ico:'skills/sk_psi_storm'},
  hp:      {name:'체력', cat:'char',   u:0,     v0:120,  vs:18,    f:'',   base:5,   mul:1.07,  ico:'upgrades/up_carapace'},
  regen:   {name:'체력 재생', cat:'char',   u:100,   v0:0,    vs:1.2,   f:'/s', base:6,   mul:1.08,  ico:'skills/sk_heal'},
  shd:     {name:'실드량', cat:'char',   u:120,   v0:0,    vs:15,    f:'',   base:10,  mul:1.085, ico:'upgrades/up_shield'},
  shdreg:  {name:'실드 재생', cat:'char',   u:200,   v0:0,    vs:0.2,   f:'/s', base:13,  mul:1.09,  ico:'skills/sk_recharge'},
  mk:      {name:'미네랄 (킬)', cat:'char',  u:80,    v0:0,    vs:0.5,   f:'',   base:8,   mul:1.085, ico:'upgrades/up_mineral_up'},
  gk:      {name:'가스 (킬)', cat:'char',  u:120,   v0:0,    vs:0.2,   f:'',   base:14,  mul:1.095, ico:'res_gas'},
  mw:      {name:'미네랄 (웨이브)', cat:'char',  u:100,   v0:0,    vs:4,     f:'',   base:11,  mul:1.09,  ico:'upgrades/up_mineral_up'},
  gw:      {name:'가스 (웨이브)', cat:'char',  u:220,   v0:0,    vs:2,     f:'',   base:20,  mul:1.10,  ico:'res_gas'},
  mspd:    {name:'이동속도', cat:'char',  u:80,    v0:100,  vs:2,     f:'%',  base:9,   mul:1.08,  ico:'upgrades/up_speed'},
  rrng:    {name:'재생 범위', cat:'char',  u:110,   v0:100,  vs:3,     f:'%',  base:11,  mul:1.085, ico:'upgrades/up_sight'},
  // 아군 — 전부 '캐릭터 대비 비율'을 키우는 배수다. 실제 전투 반영은 hbAllyMul() 한 곳에서만 한다.
  alatk:   {name:'동료 공격력', cat:'ally',  u:0,     v0:100,  vs:8,     f:'%',  base:10,  mul:1.085, ico:'upgrades/up_inf_atk'},
  alspd:   {name:'동료 공격속도', cat:'ally',  u:120,   v0:100,  vs:1.5,   f:'%',  base:15,  mul:1.09,  ico:'skills/sk_stim'},
  tuatk:   {name:'터렛 공격력', cat:'bld',   u:0,     v0:100,  vs:8,     f:'%',  base:10,  mul:1.085, ico:'upgrades/up_veh_atk'},
  turng:   {name:'터렛 사거리', cat:'bld',   u:100,   v0:100,  vs:3,     f:'%',  base:13,  mul:1.085, ico:'upgrades/up_range'},
  bnhp:    {name:'벙커 체력', cat:'bld',   u:150,   v0:100,  vs:12,    f:'%',  base:18,  mul:1.095, ico:'upgrades/up_carapace'},
  bkatk:   {name:'벙커 공격력', cat:'bld',   u:0,     v0:100,  vs:10,    f:'%',  base:10,  mul:1.085, ico:'buildings/bld_bunker'},   // 벙커 안 유닛 화력 배수(100% = 기본)
  peatk:   {name:'펫 공격력', cat:'pet',   u:0,     v0:100,  vs:8,     f:'%',  base:11,  mul:1.085, ico:'skills/sk_consume'},
  pespd:   {name:'펫 공격속도', cat:'pet',   u:180,   v0:100,  vs:1.5,   f:'%',  base:20,  mul:1.095, ico:'skills/sk_stim'},
};
// 구역 — 대상별로 몰아 넣는다. 세 번째 값 = 선택된 탭 카드를 아래로 물들이는 색(§DESIGN 역할표 토큰)
const HB_UPG_CAT=[['char','내 캐릭터','255,59,59'],['ally','동료','74,168,255'],
                  ['bld','건물','255,210,74'],['pet','펫','93,255,143']];
// 아군 구역은 '건설(수량)' 카드도 같은 격자에 함께 낸다 — 사는 곳과 키우는 곳을 나누지 않는다
// 구역별 '수량을 사는' 카드. ⚠ 동료는 여기 없다 — 영입은 미네랄이 아니라 동료 뽑기권이라
//   이 격자에 살 수 있는 카드를 두면 설계가 어긋난다(동료 구역은 강화 업그레이드만 보여 준다).
// ⚠ 이 카드들은 '수량을 사는' 것이 아니라 **누르면 배치 모드로 들어간다**(hbBuy → hbArmStart).
// 전장 위 건설 버튼에 나오는 건물 순서(업그레이드 격자에는 들어가지 않는다)
const HB_BUILD_KEYS=['wall','turret','bunker'];
// 업그레이드 레벨 → 실제 전투 수치. 아군 배수는 전부 여기서만 나온다(hbUnitFire 호출부가 이 값을 받는다)
function hbAllyMul(){ const u=hbHunt().upg;
  const lpA=lpMul('ally'), lpB=lpMul('bld');          // 🎯 레벨 포인트 — 동료 계열 / 건물 계열
  const aMul=(1+(u.alatk||0)*0.08)*lpA;
  return { ally:  { dps:HB_ALLY_DPS*aMul, mul:aMul, cdMul:Math.pow(0.985, u.alspd||0) },
           turret:{ dps:HB_TURRET_DPS*(1+(u.tuatk||0)*0.08)*lpB, rng:HB_TURRET_RANGE*(1+(u.turng||0)*0.03) },
           bunker:{ hp:HB_BUNKER_HP  *(1+(u.bnhp ||0)*0.12) },
           pet:   { dps:HB_PET_DPS   *(1+(u.peatk||0)*0.08)*lpA, cdMul:Math.pow(0.985, u.pespd||0) } }; }
function hbHunt(){ const p=PROF();
  if(!p.hunt) p.hunt={dg:1,round:1,climb:true,best:{},upg:{atk:0,rng:0,aspd:0,crit:0,hp:0,regen:0}};   // 기본 = 등반
  if(typeof p.hunt.skAuto!=='number') p.hunt.skAuto=0;   // 스킬 자동 사용 — 세 개를 한 번에(0/1)
  // 기본 모드가 반복→등반으로 바뀌었다(2026-08-14). 옛 저장의 climb:false 는 '옛 기본값'일 뿐이므로
  // 직접 고른 흔적(climbChosen)이 없으면 등반으로 올린다. 버튼으로 고르면 흔적이 남아 다시 안 건드린다.
  if(!p.hunt.climbChosen && !p.hunt.climb) p.hunt.climb=true;
  if(!p.hunt.unl) p.hunt.unl={};        // 해금한 업그레이드(key→1). u:0 은 여기 없어도 열린 것으로 친다
  if(!p.hunt.rw || typeof p.hunt.rw!=='object') p.hunt.rw={};   // 🎁 마일스톤 수령 기록(던전→라운드)
  // 옛 구역 키(atk/def/util)가 저장돼 있으면 '내 캐릭터'로 옮긴다 — 없는 구역이면 격자가 빈 채로 남는다
  if(!p.hunt.upgCat || !HB_UPG_CAT.some(function(c){ return c[0]===p.hunt.upgCat; })) p.hunt.upgCat='char';
  if(!p.hunt.upgQty) p.hunt.upgQty=1;
  return p.hunt; }
function hbUpgCost(k,lv){ const l=(lv==null)?(hbHunt().upg[k]||0):lv;
  return Math.ceil(HB_UPG[k].base*Math.pow(HB_UPG[k].mul, l)); }
// u:0 은 처음부터 열려 있고, 나머지는 hunt.unl 에 표식이 있어야 쓴다
function hbUpgOwned(k){ const U=HB_UPG[k]; return !!U && ((U.u===0) || !!hbHunt().unl[k]); }
// 표시값 — 소수는 필요할 때만(레벨당 증가가 0.1 미만이면 2자리)
// 표시용 문자열은 hbUpgVal, 계산에 쓸 실수는 hbUpgNum — 섞어 쓰면 '100%'가 숫자로 들어간다
function hbUpgNum(k){ const U=HB_UPG[k]; return U? (U.v0+U.vs*((hbHunt().upg[k]||0))) : 0; }
function hbUpgVal(k,lv){ const U=HB_UPG[k], v=U.v0+U.vs*lv;
  const d=(U.vs<0.1)?2:1;
  const t=(Math.abs(v-Math.round(v))<0.001)? String(Math.round(v)) : v.toFixed(d);
  return (U.f==='x') ? ('x'+t) : (t+U.f); }
// 1 / 10 = 그 수만큼 · max = 보유 미네랄로 살 수 있는 만큼
function hbUpgPlan(k){ const lv=hbHunt().upg[k]||0, q=hbHunt().upgQty||1;
  const have=Math.floor((PROF()||{}).pcoin||0);
  if(q!=='max'){ let sum=0; for(let i=0;i<q;i++) sum+=hbUpgCost(k,lv+i); return {n:q,sum:sum}; }
  let t=0,got=0;
  for(let j=0;j<999;j++){ const c=hbUpgCost(k,lv+j); if(t+c>have) break; t+=c; got++; }
  return got? {n:got,sum:t} : {n:1,sum:hbUpgCost(k,lv)}; }
// 전투 수치 = 계정 업그레이드(hunt.upg) + 캐릭터 스탯(profStat). 한 곳에서만 합친다.
// ══ 🎯 레벨 포인트 — 레벨업으로 얻어 '배수'에 직접 찍는 축 ══════════════════════════════════
//   미네랄 업그레이드(HB_UPG)는 '자주 눌러 쌓는' 축, 이건 '가끔 눌러 두면 조용히 붙는' 축이다.
//   ⚠ 전투 반영은 아래 네 곳에서만 한다: hbCharStats / hbAllyMul / hbBunkerAtkMul / 치명타 피해.
//     새 항목을 넣을 땐 반드시 이 중 한 곳에 배선할 것 — 표에만 있고 안 걸린 키는 거짓말이 된다.
//   ⚠ 환생하면 레벨이 1로 돌아가므로 포인트도 함께 돌아간다(총량이 레벨에서 나온다).
// 🎯 설계(2026-08-19 확정): **레벨 1회 = 포인트 1 · 1포인트 = +5% 배수**.
//    사냥터는 '주 무대'가 아니다 — 유즈맵이 게임플레이의 중심이고, 여기는 눌러 놓고 떠나는 곳이다.
//    그래서 자주 눌러야 하는 것은 **사냥터 업그레이드 하나**로 두고, 레벨 포인트는
//    '가끔 들러 눌러 두면 조용히 세지는' 낮은 배수로 둔다.
//    ⚠ 세기를 조절할 땐 LP_STEP 하나만 만진다.
//    ⛔ 되돌리지 말 것: +50%(2026-08-18)는 Lv11에 한 축 6배로 전투가 무너졌고,
//       덧셈(업그레이드 1레벨어치)은 반대로 눌러 둘 이유가 없을 만큼 미미했다.
// ⚠ name 은 2열 칸에 한 줄로 들어가야 한다 — 길면 말줄임된다(실측: '치명타 데미지'가 잘렸다).
//    수치 축과 같은 이름을 쓴다(CS_AXES.critd = '치명 피해') — 같은 것을 두 이름으로 부르지 말 것.
const LP_PER_LEVEL=1;                       // 레벨 1회 = 포인트 1
const LP_STEP=0.05;                         // 1포인트 = +5% (세기 조절은 이 값 하나)
// ⚠ step 은 전부 LP_STEP 하나다 — 항목마다 다르게 두면 '어디 찍는 게 이득인지'가 숨은 지식이 된다.
const LP_STATS=[
  {k:'atk',   name:'공격력',     step:LP_STEP, ico:'upgrades/up_melee_atk'},
  {k:'hp',    name:'체력',       step:LP_STEP, ico:'upgrades/up_carapace'},
  {k:'aspd',  name:'공격속도',   step:LP_STEP, ico:'skills/sk_stim'},
  {k:'range', name:'사거리',     step:LP_STEP, ico:'upgrades/up_range'},
  {k:'critd', name:'치명 피해',  step:LP_STEP, ico:'skills/sk_yamato'},
  {k:'ally',  name:'동료 데미지', step:LP_STEP, ico:'upgrades/up_veh_atk'},
  {k:'bld',   name:'건물 데미지', step:LP_STEP, ico:'buildings/bld_turret'},
];
function lpDef(k){ return LP_STATS.find(x=>x.k===k)||null; }
// 🔁 환생 포인트 — 환생으로만 얻고 '환생해도 사라지지 않는' 영구 축.
//   레벨 포인트와 같은 항목에 찍지만 1점이 더 세다(RP_STEP_MUL). 그래야 되감는 값이 있다.
//   ⚠ 레벨 포인트(unit.pts)와 다른 필드(unit.rpts)다 — 같이 담으면 환생 때 같이 날아간다.
// ⭐ **이 축이 전투력의 지수 성장을 담당한다**(2026-08-19). 적 체력이 라운드에 대해 지수라,
//    어딘가 하나는 지수여야 던전이 진행된다. 그 자리가 여기다.
//    ⛔ 선형(1 + n×step)으로 되돌리지 말 것 — 그러면 어떤 축도 지수가 아니게 되어
//       미네랄을 ×1300만 벌어도 라운드가 88에서 멎는다(실측).
//    ⭐ 발산은 **재투자 체증 비용**(ptCostAt)이 막는다. 비용이 1,2,3,4… 로 오르면
//       n칸에 n²/2 포인트가 들어 **총 P 포인트로 찍히는 칸 = √(2P)** — 네 배 모아야 두 배.
//       그래서 '복리 × √체감'이 되어 지수로 크되 통제된다.
//    ⚠ 복리라 여러 축에 나눠 찍어도 총 곱은 같다(밑수가 같다) — 함정 빌드가 없다.
const RP_STEP=0.27;        // 1포인트 = ×1.27 (복리) — 4칸 ×2.6 · 10칸 ×10.9 · 30칸 ×1301
const RP_PER_REB=1;        // 옛 이름 호환(= 첫 환생 지급량)
const RP_STEP_MUL=RP_STEP/LP_STEP;   // 옛 이름 호환 — 레벨 포인트 1점의 몇 배인가
function rpBag(c){ c=c||((typeof CHAR==='function')?CHAR():null); if(!c) return {};
  if(!c.unit.rpts || typeof c.unit.rpts!=='object') c.unit.rpts={}; return c.unit.rpts; }
function rpSpent(c){ return ptSpent('rp', c); }
function rpFree(c){ c=c||((typeof CHAR==='function')?CHAR():null);
  return c ? Math.max(0, rpTotal(c)-rpSpent(c)) : 0; }
// 총량 = 환생으로 받은 몫뿐이다(기록 기반 몫은 2026-08-19에 폐지 — profRecordRp 주석 참고).
function rpTotal(c){ c=c||((typeof CHAR==='function')?CHAR():null);
  return c ? (c.rp|0) : 0; }
function rpPts(k, c){ return Math.max(0, rpBag(c)[k]|0); }
// 복리 — 전투력의 지수 축(위 ⭐ 참고). 밑수가 같아 배분과 무관하게 총 곱이 같다.
function rpMul(k, c){ return Math.pow(1+RP_STEP, rpPts(k,c)); }
function rpAdd(k, n){ const c=CHAR(), S=lpDef(k); if(!c||!S) return 0;
  n=Math.max(1, n|0); const b=rpBag(c); let got=0;
  while(got<n){ const cost=ptCostAt('rp', k, b[k]|0); if(rpFree(c)<cost) break;
    b[k]=(b[k]|0)+1; got++; }
  if(got) saveMeta(); return got; }
function rpReset(){ const c=CHAR(); if(!c) return 0; const n=rpSpent(c);
  c.unit.rpts={}; saveMeta(); return n; }
function lpTotal(c){ c=c||((typeof CHAR==='function')?CHAR():null);
  return c ? Math.max(0, (c.level||1)-1)*LP_PER_LEVEL : 0; }
function lpBag(c){ c=c||((typeof CHAR==='function')?CHAR():null); if(!c) return {};
  if(!c.unit.pts || typeof c.unit.pts!=='object') c.unit.pts={}; return c.unit.pts; }
// 한 번 찍는 데 드는 포인트.  lv = 지금 그 항목에 찍혀 있는 수(0부터). 반환 = lv → lv+1 비용.
// ⚠ 버튼 표기(-1p)와 실제 차감이 반드시 이 함수에서 같이 나와야 한다 — 표기만 바꾸면 거짓말이 된다.
// ⭐ 환생 포인트만 체증한다(1,2,3,4…). 한 축 몰빵을 억제하는 동시에,
//    총량 대비 효과를 √ 로 눕혀 무한 환생에서도 발산하지 않게 하는 장치다(RP_STEP 주석 참고).
// ⚠ 레벨 포인트는 1 고정으로 둔다 — '가끔 눌러 두면 조용히 붙는' 축이라
//    매번 비용을 계산하게 만들면 성격이 어긋난다.
function ptCostAt(kind, k, lv){ return (kind==='rp') ? (1+Math.floor(Math.max(0,lv|0)/5)) : 1; }
// 다음 1점의 값 — 버튼에 적히는 수다.
function ptCost(kind, k, c){ return ptCostAt(kind, k, (kind==='rp'? rpPts(k,c) : lpPts(k,c))); }
// 지금까지 그 축에 들어간 포인트 합(비용 곡선을 되짚는다 — 찍은 수와 다를 수 있다)
function ptSpent(kind, c){ let n=0;
  for(const S of LP_STATS){ const lv=(kind==='rp'? rpPts(S.k,c) : lpPts(S.k,c));
    for(let i=0;i<lv;i++) n+=ptCostAt(kind, S.k, i); }
  return n; }
function lpSpent(c){ return ptSpent('lp', c); }
function lpFree(c){ return Math.max(0, lpTotal(c)-lpSpent(c)); }
function lpPts(k, c){ return Math.max(0, lpBag(c)[k]|0); }
// 배수 — 찍은 수만큼 선형으로 오른다(1포인트 = step). 전투는 전부 이 함수만 부른다.
// 지금 찍은 포인트의 배수. 가산 선형(1 + n×step) — 여러 축에 나눠 찍어도 합이 같다.
// ⛔ 복리로 만들지 말 것 — 그건 환생 포인트(rpMul)의 몫이다. 둘 다 복리면 후반이 폭주한다.
function lpMul(k, c){ const S=lpDef(k); return S ? 1 + lpPts(k,c)*S.step : 1; }
// n = '올리고 싶은 칸 수'. 남은 포인트로 살 수 있는 만큼만 올리고, 실제로 올린 칸 수를 돌려준다.
function lpAdd(k, n){ const c=CHAR(), S=lpDef(k); if(!c||!S) return 0;
  n=Math.max(1, n|0); const b=lpBag(c); let got=0;
  while(got<n){ const cost=ptCostAt('lp', k, b[k]|0); if(lpFree(c)<cost) break;
    b[k]=(b[k]|0)+1; got++; }
  if(got) saveMeta(); return got; }
function lpReset(){ const c=CHAR(); if(!c) return 0; const n=lpSpent(c);
  c.unit.pts={}; saveMeta(); return n; }
// 🤖 자동 배분 — '눌러 놓고 떠나는' 구역이라 레벨업 때 포인트가 알아서 찍힌다.
//   ⭐ **미리 골라 둔 한 축**에만 계속 찍는다. 고르는 건 플레이어 몫이고, 그 뒤로는 안 들러도 된다.
//   c.lpAuto = LP_STATS 의 키(''=끔). ⚠ 옛 저장은 0/1 이라 fixChar 가 키로 옮긴다.
const LP_AUTO_DEFAULT='atk';                 // 처음엔 공격력에 자동(안 들러도 세지도록 · 언제든 바꾼다)
function lpAutoKey(c){ c=c||CHAR(); const k=c&&c.lpAuto;
  return (k && lpDef(k)) ? k : ''; }
function lpAutoOn(c){ return !!lpAutoKey(c); }
// 고른 축에 남은 포인트를 전부 넣는다
function lpAutoSpend(c){ c=c||CHAR(); const k=lpAutoKey(c); if(!c||!k) return 0;
  let put=0;
  for(let guard=0; guard<9999; guard++){
    if(lpFree(c)<ptCost('lp',k,c)) break;
    if(!lpAdd(k,1)) break;
    put++; }
  return put; }
// 고르는 흐름: [자동 선택] → 카드를 눌러 지정 → 그 카드만 진하고 나머지는 어두워진다 → [지정 해제]
//   ⚠ '고르는 중'은 저장하지 않는 순간 상태다. 화면을 떠나면 남기지 않는다(setChrSec 에서 끈다).
let _lpPicking=false;
function lpAutoBtnTx(c){ return _lpPicking ? '취소' : (lpAutoKey(c) ? '지정 해제' : '자동 선택'); }
// 머리 버튼 하나가 세 가지 일을 한다 — 지금 상태가 곧 다음 동작이다
function lpAutoBtn(){ const c=CHAR(); if(!c) return;
  if(_lpPicking) _lpPicking=false;                   // 취소
  else if(lpAutoKey(c)){ c.lpAuto=''; saveMeta(); }  // 지정 해제
  else _lpPicking=true;                              // 고르기 시작
  if(typeof playSfx==='function') playSfx('ui_tab');
  _ptRepaint(); }
// 고르는 중에 카드를 누르면 그 축이 대상이 된다(그동안 쌓인 포인트도 바로 들어간다)
function lpAutoSet(k){ const c=CHAR(); if(!c||!lpDef(k)) return;
  c.lpAuto=k; _lpPicking=false; lpAutoSpend(c); saveMeta();
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof hbSyncChar==='function') hbSyncChar();
  _ptRepaint(); }
// ══════════════════════════════════════════════════════════════════════════════════════
// ══ 📊 기본 스탯 축 — 이 게임의 스탯은 '전투 수치' 그 자체다 ═══════════════════════════════
//   한 축의 값 = (기본 + 사냥터 업그레이드 + 장비) × 레벨 포인트 × 환생 포인트
//   출처는 이 넷뿐이다. 직업·진화·펫은 2026-08-18에 뺐다(펫·동료는 자기 화력으로 따로 싸운다).
//   ⛔ 표(스탯 출처 팝업)와 전투가 '같은 식'을 써야 한다 → 둘 다 csAxis() 하나만 부른다.
//      hbCharStats 안에 식을 다시 적으면 두 벌이 되어 반드시 어긋난다.
//   gearK = 장비 스탯 꼬리표(pow/vit/foc/agi) · lp/rp = 배수를 얹는 포인트 키
// ⭐ base / 레벨당 증가는 여기 적지 않는다 — HB_UPG[upgK].v0 / .vs 가 단일 소스다(2026-08-18).
//    두 벌로 두면 반드시 어긋난다(실제로 카드 '데미지 10/+2' ↔ 전투 12/+3 로 갈라져 있었다).
//    upgK 가 없는 축만 base 를 직접 갖는다(지금은 없다).
const CS_AXES={
  atk:  { name:'공격력',   upgK:'atk',   gearK:'pow', gearV:2,    lp:'atk',   rp:'atk'   },
  hp:   { name:'체력',     upgK:'hp',    gearK:'vit', gearV:10,   lp:'hp',    rp:'hp'    },
  aspd: { name:'공격속도', upgK:'aspd',  gearK:'agi', gearV:1,    lp:'aspd',  rp:'aspd', cap:HB_ASPD_MAX, unit:'%' },
  crit: { name:'치명타',   upgK:'crit',  gearK:'foc', gearV:0.4,  cap:60,     unit:'%'   },
  critd:{ name:'치명 피해', upgK:'critm',                          lp:'critd', rp:'critd', unit:'%' },
  range:{ name:'사거리',   upgK:'rng',                 cap:HB_RNG_MAX, lp:'range', rp:'range' },
  regen:{ name:'체력회복', upgK:'regen' },
};
const CS_ORDER=['atk','hp','aspd','crit','critd','range','regen'];
// 한 축의 출처별 기여. 표도 전투도 이걸 읽는다.
//   sub   = 기본 스탯(네 출처의 결과)
//   total = 전투 수치 = 기본 스탯 × 추가 보정(장비 어빌리티 % · 펫/동료 패시브 — 아직 없다)
function csAxis(k){ const A=CS_AXES[k]; if(!A) return null;
  const u=hbHunt().upg, U=A.upgK?HB_UPG[A.upgK]:null;
  const base = U ? U.v0 : (A.base||0);                 // 0레벨 값 = 카드가 적는 값과 같은 것
  const upg  = U ? (u[A.upgK]||0)*U.vs : 0;
  const gear = A.gearK ? profStat(A.gearK)*A.gearV : 0;
  const lp   = A.lp ? lpMul(A.lp) : 1;               // 🎯 레벨 포인트 = 낮은 선형 배수(+5%/p)
  const rp   = A.rp ? rpMul(A.rp) : 1;               // 🔁 환생 포인트 = 복리 배수
  const raw=(base+upg+gear)*lp*rp;                    // 상한을 걸기 전 값
  let sub=raw;
  if(A.cap!=null) sub=Math.min(A.cap, sub);
  const bonus=csBonus(k);
  let total=sub*bonus;
  if(A.cap!=null) total=Math.min(A.cap, total);
  // 🔀 넘친 몫 — 버려지지 않고 hbCharStats 에서 다른 값으로 넘어간다(csOver 참고)
  const over=(A.cap!=null)? Math.max(0, raw-A.cap) : 0;
  return { name:A.name, unit:A.unit||'', base:base, upg:upg, gear:gear, lp:lp, rp:rp,
           raw:raw, cap:(A.cap!=null?A.cap:0), over:over,
           sub:sub, bonus:bonus, total:total, capped:(A.cap!=null && raw>=A.cap) }; }
// 상한 대비 '몇 배를 더 넘겼는가'. 1 = 상한만큼 더 쌓았다.
// ⭐ 상한 있는 축(사거리·공격속도·치명타)은 그냥 두면 일정 지점부터 투자가 통째로 버려진다.
//    환생 포인트는 영구라 한 번 잘못 넣으면 되돌리기 어려우므로, 넘긴 몫을 같은 방향의 다른 값으로 흘린다.
function csOver(k){ const a=csAxis(k); return (a && a.cap>0) ? a.over/a.cap : 0; }
function csVal(k){ const a=csAxis(k); return a?a.total:0; }
// 추가 보정 훅 — 장비 어빌리티(공격력 %)·펫/동료 패시브가 생기면 여기서만 곱한다.
// ⚠ 지금은 원천이 없어 항상 1이다. 새 보정을 만들면 이 함수 안에 넣을 것(전투식에 직접 곱하지 말 것).
function csBonus(k){ return 1; }
function csHasBonus(){ for(const k of CS_ORDER) if(Math.abs(csBonus(k)-1)>1e-9) return true; return false; }
// ══════════════════════════════════════════════════════════════════════════════════════
function hbCharStats(){ const n=hbUpgNum;
  return { atk:csVal('atk'), hpMax:csVal('hp'),
    cd:Math.max(HB_CD_MIN, .70/(csVal('aspd')/100)),    // 공격속도(%)는 '빠르기'라 대기시간을 나눈다
    crit:csVal('crit')/100,
    critDmg:csVal('critd')/100 + HB_OV_CRITD*csOver('crit'),
    range:csVal('range'), regen:csVal('regen'),
    // ── 아래는 '축'이 아니다(장비·레벨포인트·환생포인트가 붙지 않는다) → 출처가 HB_UPG 하나뿐이라 여기서 바로 꺼낸다.
    //    ⛔ 호출부에서 hbUpgNum 을 다시 부르지 말 것 — 전투가 읽는 수치는 이 함수 하나로 모은다.
    // 🔀 상한 초과분 환산 — 사거리→상자 피해 · 공격속도→멀티샷 확률 · 치명타→치명 피해
    //    ⛔ 호출부에서 csOver 를 다시 부르지 말 것. 전투가 읽는 값은 이 함수 하나로 모은다.
    chestDmg:1+HB_OV_CHEST*csOver('range'),
    lifest:n('lifest')/100, knock:n('knock')/100,
    multiC:n('multic')/100 + HB_OV_MULTI*csOver('aspd'), multiN:Math.round(n('multin')),
    bncC:n('bncc')/100,     bncN:Math.round(n('bncn')),
    scritC:n('scritc')/100, scritM:n('scritm'),
    shdMax:n('shd'), shdReg:n('shdreg'),
    mspd:n('mspd')/100, rrng:n('rrng')/100 }; }
// 전투 중인 캐릭터에 수치를 다시 입힌다 — 업그레이드·레벨·포인트를 바꾼 직후 부르는 '단일 지점'.
// ⛔ 이 복사를 손으로 다시 적지 말 것: 새 수치를 추가할 때 여기 한 곳만 고치면 되게 둔다.
//    (치명타 피해 critDmg 를 넣을 때 복사가 세 군데로 흩어져 있어 한 곳을 빠뜨릴 뻔했다)
function hbSyncChar(heal){ if(!_hb||!_hb.char) return null;
  const st=hbCharStats(), c=_hb.char;
  c.atk=st.atk; c.cd=st.cd; c.crit=st.crit; c.critDmg=st.critDmg; c.range=st.range; c.regen=st.regen;
  c.hpMax=st.hpMax; c.hp=Math.min(st.hpMax, c.hp+(heal||0));
  c.lifest=st.lifest; c.knock=st.knock; c.chestDmg=st.chestDmg;
  c.multiC=st.multiC; c.multiN=st.multiN; c.bncC=st.bncC; c.bncN=st.bncN;
  c.scritC=st.scritC; c.scritM=st.scritM;
  c.mspd=st.mspd; c.rrng=st.rrng; c.shdReg=st.shdReg;
  // 🛡 실드 상한이 늘어난 만큼은 그 자리에서 채워 준다(영구 구매라 되팔 수 없다 — 악용 여지가 없다)
  { const prev=c.shdMax||0; c.shdMax=st.shdMax;
    c.shd=Math.min(st.shdMax, (c.shd||0)+Math.max(0, st.shdMax-prev)); }
  return st; }
// ── 🌍 던전 배수 = 라운드 곡선을 HB_ROUND_MAX(50)칸 이어 붙인 것 (2026-08-18) ──
//    던전 d 라운드 r 의 세기 = 곡선^(전역 진행도-1),  전역 진행도 = (d-1)*50 + r  (hbProg).
//    ⭐ 그래서 '던전 50 → 다음 던전 1'이 한 칸 오른 것과 정확히 같다 — 자동 이동에 계단이 없다.
//    ⛔ 옛 고정 배수(체력 8 · 공격 5 · 보상 24)로 되돌리지 말 것: 50라운드를 민 뒤
//       다음 던전 1라운드가 8배로 떨어져 난이도가 통째로 무너진다.
function hbProg(dg,round){ return (Math.max(1,dg||1)-1)*HB_ROUND_MAX + Math.max(1,round||1); }
// ⚠ 아래 넷은 '던전 시작까지의 누적 배수'다 — hbCurve(base,dg,1) 과 같다(옛 이름 호환).
function HB_DG_HP (dg){ return hbCurve(HB_ROUND_HP , dg, 1); }   // 적 체력
function HB_DG_REW(dg){ return hbCurve(HB_ROUND_REW, dg, 1); }   // 재화 보상
function HB_DG_MUL(dg){ return HB_DG_HP(dg); }             // 옛 이름 호환
// ── 📈 라운드 곡선 = 지수(2026-08-18). 레벨 1회에 포인트 1 = +50% 라 성장이 폭발적이고,
//    옛 선형 곡선(체력 14+5R)으로는 몇 라운드 만에 저항이 사라졌다. 그래서 적도 같이 지수로 올린다.
//    ⚠ 넷을 함께 본다 — 체력만 올리면 벽이고, 보상만 올리면 인플레다.
//      HP > REW > ATK 순서로 두어 '라운드가 오를수록 시급은 오르지만 조금씩 빡세진다'가 되게 했다.
//      XP 를 제일 낮게(1.06) 두는 것이 핵심 — 레벨(=포인트)이 적 체력을 따라 오르면 벽이 생기지 않는다.
//   ⚠ 아래 넷은 **던전 1 기준값**이다. 던전이 오르면 hbDgK 배율만큼 같이 가팔라진다.
const HB_ROUND_HP =1.10;   // 라운드당 적 체력   (던전1)
const HB_ROUND_ATK=1.13;   // 라운드당 적 공격   (던전1)
const HB_ROUND_REW=1.14;   // 라운드당 재화 보상 (던전1)
const HB_ROUND_XP =1.03;   // 라운드당 경험치    (던전1) — 제일 완만해야 '벽'이 생긴다

// ══ 📐 던전별 난이도 계수 (2026-08-19) ══════════════════════════════════════════════
//   ⭐ 옛 구조는 라운드당 배수가 **상수 하나**여서 던전마다 요구 파워가 똑같았고(×1.16^99),
//      그래서 던전마다 필요한 레벨도 똑같이 나왔다(실측 354·345·338 — 거의 평평).
//      "뒤 던전일수록 더 든다"를 만들려면 기울기 자체가 던전마다 달라야 한다.
//   ⚠ 체력만 올리면 후반 던전이 '고생만 하고 보상은 짜다'가 된다 → 넷 다 **같은 로그 배율**로 민다.
//      그래야 던전 안에서 체력:공격:보상:경험치 관계가 어디서나 같다.
const HB_ROUND_HP_D=0.035;                   // 던전마다 체력 증가율에 더하는 값
function hbRoundHp(dg){ return HB_ROUND_HP + Math.max(0,(dg|0)-1)*HB_ROUND_HP_D; }
function hbDgK(dg){ return Math.log(hbRoundHp(dg))/Math.log(HB_ROUND_HP); }   // 던전1 = 1
function hbRoundRate(base, dg){ return Math.pow(base, hbDgK(dg)); }

// ══ 🌊 던전 안의 S자 리듬 (2026-08-19) ══════════════════════════════════════════════
//   ⭐ 라운드당 상승률이 **낮음 → 높음 → 낮음**이 되게 누적 로그에 사인 편차를 얹는다.
//      초반은 천천히(도입) · 중반이 가장 가파르고(고비) · 후반은 다시 완만해지며(마무리) 넘어간다.
//   ⭐ 한 주기가 정확히 던전 하나라 **총량은 변하지 않는다** — 난이도를 더하지 않고 재배치만 한다.
//   ⚠ 보상(REW/XP)에는 태우지 않는다. 태우면 중반 고비가 '힘든데 보상도 짜다'가 된다.
//      균일하게 두면 중반은 손해·후반은 꿀이 되어 돌파 보상이 자연스럽게 붙는다.
const HB_ROUND_S=0.5;                        // S자 세기 (0 = 균일)
// ⛔ 주기를 HB_ROUND_MAX 에 묶지 말 것 (2026-08-25).
//    ⚔ 토벌(dgHbStart)이 이 라운드 축을 빌려 쓴다 — dg=1 · round=층 이라 던전 개념이 없다.
//    HB_ROUND_MAX 를 99 → 50 으로 줄였을 때 사인 주기가 같이 줄어 **토벌 20~45층이 통째로
//    다시 위상을 잡았고**, 실측에서 20층 직접 클리어율이 88% → 13% 로 무너졌다(사거리 Lv20).
//    S자는 '던전 하나의 리듬'인데 토벌에는 그 단위가 없으므로, 주기를 별도 상수로 고정한다.
//    ⚠ 캠프 던전(50라운드)을 코드로 옮길 때는 그쪽 주기를 따로 줄 것 — HUNT_R1.md §6-1.
const HB_S_PERIOD=99;                        // S자 한 주기 (라운드 수)
function hbRoundS(round){ return Math.exp(-HB_ROUND_S*Math.sin(2*Math.PI*(Math.max(1,round||1)-1)/HB_S_PERIOD)); }

// 진행도 누적 배수 — 던전마다 기울기가 다르므로 이전 던전들을 곱해서 온다.
// ⚠ 매 스폰마다 불리므로 던전별 누적은 캐시한다(던전은 10개뿐이다).
const _hbCurveC={};
function hbCurve(base, dg, round){
  dg=Math.max(1,dg|0);
  const key=base+'|'+dg; let head=_hbCurveC[key];
  if(head===undefined){ head=1;
    for(let d=1; d<dg; d++) head*=Math.pow(hbRoundRate(base,d), HB_ROUND_MAX);
    _hbCurveC[key]=head; }
  return head*Math.pow(hbRoundRate(base,dg), Math.max(0,(round||1)-1)); }
// 라운드 한 판 목표 40~60초(3웨이브). 웨이브가 갈수록 조금씩 두꺼워진다.
function hbFoeCount(round,w){ return 3+Math.floor(round*0.4)+w; }
function hbFoeHp(dg,round,w){ return (15+w*3)*hbCurve(HB_ROUND_HP,dg,round)*hbRoundS(round); }
function hbFoeAtk(dg,round){ return 2.1*hbCurve(HB_ROUND_ATK,dg,round)*hbRoundS(round); }
// 처치 = 즉시 지급(미네랄·가스·XP) · 클리어 보너스 = 사망 시 잃는 몫.
// XP만 재화와 다르게 완만히 오른다 — 레벨은 스탯 포인트라 재화처럼 폭증하면 안 된다.
// ⚠ 보상에는 S자(hbRoundS)를 곱하지 않는다 — 위 🌊 주석 참고.
function hbKillReward(dg,round){ const m=hbCurve(HB_ROUND_REW,dg,round);
  return { min:0.85*m, gas:0.09*m, xp:4.5*hbCurve(HB_ROUND_XP,dg,round) }; }
function hbClearBonus(dg,round){ const m=hbCurve(HB_ROUND_REW,dg,round);
  return { min:12*m, gas:1.7*m }; }
// 🎁 라운드 마일스톤 보상 — HB_RW_EVERY 간격 라운드에 '최초 클리어 1회' 보상이 붙는다.
//   설계 의도: 다음 목표가 눈에 보여야 라운드를 민다(도전정신). 그래서 라운드 팝업에서 미리 확인할 수 있다.
//   ⚠ 반복 파밍으로 재수령되면 안 된다 → 던전별로 받은 라운드를 hunt.rw[dg][round] 에 기록한다.
const HB_BG_DIR='assets/backgrounds/dungeons/';   // 던전 배경 = 전장 바닥 + 라운드 시트 카드 공용
const HB_RW_EVERY=5;
function hbRoundRw(dg,round){ if(!round || round%HB_RW_EVERY) return null;
  const m=HB_DG_REW(dg), t=round/HB_RW_EVERY;
  //  뽑기권: 장비는 4번째마다, 동료·펫은 번갈아 매 마일스톤마다 — 뽑기가 유일한 영입 경로라 꾸준히 들어와야 한다
  return { min:Math.round(60*t*m), gas:Math.round(8*t*m), tk:(t%4===0)?1:0,
           atk:(t%2===0)?1:0, ptk:(t%2===1)?1:0 }; }
function hbRwGot(dg,round){ const H=hbHunt(); return !!(H.rw && H.rw[dg] && H.rw[dg][round]); }
// 최초 클리어면 지급하고 true. 이미 받았거나 마일스톤이 아니면 false.
function hbRwClaim(dg,round){ const r=hbRoundRw(dg,round); if(!r || hbRwGot(dg,round)) return false;
  const H=hbHunt(), p=PROF();
  if(!H.rw) H.rw={}; if(!H.rw[dg]) H.rw[dg]={}; H.rw[dg][round]=1;
  profGainCoin(r.min); p.gas=(p.gas||0)+r.gas;                     // 💠 미네랄 획득은 환생 배수를 탄다
  if(!p.tickets) p.tickets={gear:0,pet:0,ally:0};
  if(r.tk)  p.tickets.gear=(p.tickets.gear||0)+r.tk;
  if(r.atk) p.tickets.ally=(p.tickets.ally||0)+r.atk;
  if(r.ptk) p.tickets.pet=(p.tickets.pet||0)+r.ptk;
  return true; }
// 다음으로 노릴 마일스톤(아직 안 받은 것 중 가장 가까운 것) — 팝업 안내 문구용
function hbNextRw(dg,from){ const best=hbBest(dg);
  for(let r=HB_RW_EVERY; r<=Math.max(best,from||1)+HB_RW_EVERY*4; r+=HB_RW_EVERY)
    if(!hbRwGot(dg,r)) return r;
  return 0; }
// ── ⚔ Phase 4: 전장 확장 — 스킬 · 부스트 · 동료/펫 · 건설(터렛·벙커) ──
// 수치는 전부 아래 표에 모여 있다(밸런스는 나중에 표만 고친다).
// 아군(동료·펫·터렛·벙커)은 hbStep 안에서 적과 같은 월드 좌표로 돈다.
const HB_SKILLS={
  nova: {name:'폭발', ico:'sk_nova', cd:20, tip:'화면의 적 전체에 공격력 300% 피해'},
  heal: {name:'응급', ico:'sk_emrg', cd:30, tip:'최대 체력의 40% 즉시 회복'},
  slow: {name:'감속', ico:'sk_slow', cd:45, tip:'8초간 적 이동속도 50%'},
};
const HB_SLOW_S=8, HB_SLOW_MUL=.5;
const HB_BOOSTS={
  inc: {name:'수입 ×2', ico:'💰', sec:300, cost:400, tip:'5분간 처치 보상 2배'},
  atk: {name:'공격 ×2', ico:'🗡', sec:180, cost:600, tip:'3분간 공격력 2배'},
};
// 건설·고용 — 영구 보유(미네랄). 라운드가 바뀌어도 남는다.
// ⛔ 옛 개수형 건설 표(HB_BUILD)는 없앴다 — 터렛·벙커·벽은 전부 타일에 직접 놓는다(HB_STRUCT).
//    같은 뜻의 표를 두 벌 두면 반드시 어긋난다. 이름·비용·상한은 HB_STRUCT 하나에서만 온다.
// 🤝 동료 — 옛 상위 직업 12종이 그대로 넘어왔다(전직 폐지, 2026-08-12).
//   이름·3D 모델(unit)은 옛 직업표 값을 그대로 물려받았다.
//   ⚠ 영입은 '구매'가 아니라 '뽑기'다(2026-08-12 2차 전환) — 등급(tier)이 해금 레벨을 대체했고,
//      강화는 미네랄이 아니라 '중복 동료 합성'으로만 한다. hbMateBuy/hbMateCost/hbMateOpen은 없어졌다.
//   등급은 공용 GACHA_TIERS/TIER_COLOR를 그대로 쓴다 — 새 등급 체계를 만들지 말 것.
const HB_MATES={
  sniper:    {name:'저격수',    unit:'ghost',        ico:'🎯', race:'union',     tier:'common',    dps:.30, rng:1.9, spd:1.0, tip:'긴 사거리 저격'},
  gunner:    {name:'화력병',    unit:'machinegun',   ico:'🔥', race:'union',     tier:'common',    dps:.34, rng:1.0, spd:1.2, tip:'근거리 연사'},
  spike:     {name:'스파이크',  unit:'hydra',        ico:'🦂', race:'swarm',     tier:'rare',      dps:.44, rng:1.4, spd:1.2, tip:'중거리 견제'},
  swarmling: {name:'스웜링',    unit:'broodling',    ico:'🐛', race:'swarm',     tier:'rare',      dps:.40, rng:0.9, spd:1.5, tip:'빠른 연사'},
  sentinel:  {name:'센티넬',    unit:'dragoon',      ico:'🛡', race:'aetherial', tier:'epic',      dps:.55, rng:1.3, spd:1.0, tip:'중장갑 사격'},
  phantom:   {name:'팬텀',      unit:'ghost',        ico:'👻', race:'union',     tier:'epic',      dps:.60, rng:1.8, spd:1.1, tip:'고화력 저격'},
  darksage:  {name:'다크세이지',unit:'dark_templar', ico:'🗡', race:'aetherial', tier:'unique',    dps:.74, rng:0.8, spd:1.3, tip:'근접 순간 화력'},
  goliath:   {name:'기갑병',    unit:'goliath',      ico:'🤖', race:'union',     tier:'unique',    dps:.80, rng:1.2, spd:0.9, tip:'중장갑 화력'},
  thornqueen:{name:'가시여왕',  unit:'thornqueen',   ico:'👑', race:'swarm',     tier:'legend',    dps:1.00,rng:1.5, spd:1.2, tip:'광역 견제'},
  ultra:     {name:'돌격괴수',  unit:'ultralisk',    ico:'🦖', race:'swarm',     tier:'legend',    dps:1.10,rng:0.8, spd:1.1, tip:'최전선 돌격'},
  void:      {name:'보이드',    unit:'archon',       ico:'🔮', race:'aetherial', tier:'transcend', dps:1.45,rng:1.1, spd:1.0, tip:'파괴적 에너지'},
  highsage:  {name:'하이세이지',unit:'high_templar', ico:'✨', race:'aetherial', tier:'god',       dps:1.90,rng:1.6, spd:1.1, tip:'최상위 술사'},
};
// 🎰 동료 뽑기 — 뽑을수록 '뽑기 단계'가 올라 상위 등급 비중이 커진다(2026-08-12 2차 설계).
//   설계 요구: ① 최대 30단계 ② 초반 단계는 금방 넘어가고, 위로 갈수록 넘어가기 훨씬 어렵다
//             ③ 갓도 처음부터 나오긴 하지만 확률이 아주 낮다 ④ 단계가 오를수록 일반·레어·에픽 비중이 떨어진다
//   ⚠ 30줄을 손으로 적지 않는다 — 아래 상수 두 벌에서 생성한다. 밸런스는 상수만 고칠 것.
const HB_MATE_GACHA_MAX=30;
// 다음 단계까지 필요한 '누적 뽑기 횟수' = A·(B^(k-1) − 1) → 2·4·10…에서 시작해 30단계는 876회.
//   ⚠ 뽑기권은 미네랄로 살 수 없다(엘리트·상자·라운드 보너스·젬) — 그래서 문턱을 이 규모로 잡았다.
//      예전 값(8/1.25)은 30단계에 5,162회가 필요해 사실상 도달 불가였다.
const HB_MATE_NEED_A=12, HB_MATE_NEED_B=1.16;
// 등급별 가중치 = 시작값 × 배수^(단계−1). 정규화 전 값이라 절대 크기가 아니라 '서로의 비'가 의미를 갖는다.
//   시작값: 1단계를 일반 90 / 레어 9 / 에픽 1 (%) 근처로 맞춘 값.
//   배수  : 1보다 작으면 단계가 오를수록 비중이 줄고(일반·레어·에픽), 크면 늘어난다(유니크 이상).
//   ⚠ 갓의 시작값이 0이 아니라는 게 중요하다 — 1단계에서도 0.0001% 로 '나오긴 한다'.
const HB_MATE_W0={common:900,  rare:90,   epic:10,   unique:1,    legend:0.1,  transcend:0.01, god:0.001};
const HB_MATE_WG={common:0.83, rare:0.90, epic:0.95, unique:1.08, legend:1.16, transcend:1.20, god:1.20};
const HB_MATE_GACHA=buildGachaCurve({max:HB_MATE_GACHA_MAX, needA:HB_MATE_NEED_A, needB:HB_MATE_NEED_B,
  tiers:GACHA_TIER_ORDER, w0:HB_MATE_W0, wg:HB_MATE_WG});
// 중복 1장이 주는 재료 포인트 — 등급마다 3배씩(상위 중복은 그만큼 값어치가 있다)
const HB_MATE_PT={common:1, rare:3, epic:9, unique:27, legend:81, transcend:243, god:729};
const HB_MATE_STEP=0.22;     // 강화 1레벨당 위력 증가(비율)
const HB_MATE_NEED_MUL=1.5;  // 다음 레벨에 드는 재료 배수
const HB_MATE_START_TICKETS=5;   // 처음 열 때 쥐여 주는 동료 뽑기권
// 동시에 데리고 나가는 인원 — **해금과 무관하게 3칸 고정**이다(2026-08-14 확정).
//   늘리는 해금을 두지 않기로 했으므로 PROF_UNLOCKS 의 ally_plus 항목도 함께 삭제했다
//   (「해금은 전부 실제로 무언가를 연다」 규칙 — 늘릴 게 없으면 항목을 남기면 안 된다).
const HB_MATE_PARTY=3;
// 보유 상태 = { lv:강화 레벨(1↑), dup:합성 재료로 쓸 수 있는 중복 수 }
function hbMates(){ const H=hbHunt(); if(!H.mates) H.mates={}; if(!Array.isArray(H.party)) H.party=[];
  if(typeof H.mateN!=='number') H.mateN=0;    // 누적 뽑기 횟수 → 뽑기 레벨
  if(typeof H.allySlots!=='number') H.allySlots=0;   // 출전 칸(미네랄로 연다)
  return H; }
function hbMateRec(id){ const H=hbMates(); return H.mates[id]||null; }
function hbMateLv(id){ const r=hbMateRec(id); return r? (r.lv||0) : 0; }
function hbMateDup(id){ const r=hbMateRec(id); return r? (r.dup||0) : 0; }
function hbMateOwned(id){ return hbMateLv(id)>0; }
function hbMateDps(id){ const M=HB_MATES[id]; if(!M) return 0;
  return M.dps*(1+HB_MATE_STEP*Math.max(0,hbMateLv(id)-1)); }
function hbMateMax(){ return Math.max(0, Math.min(MG_SLOT_MAX, hbHunt().allySlots||0)); }
// ── 뽑기 레벨 · 확률 ──
function hbGachaStage(n){ n=(n==null)?hbMates().mateN:n;
  let i=0; for(let k=0;k<HB_MATE_GACHA.length;k++) if(n>=HB_MATE_GACHA[k].need) i=k;
  return i; }                                            // 0-based 단계
function hbGachaLv(n){ return hbGachaStage(n)+1; }       // 표시용(1-based)
function hbGachaProbs(n){ return HB_MATE_GACHA[hbGachaStage(n)].p; }
function hbGachaNext(){ const st=hbGachaStage(); const nx=HB_MATE_GACHA[st+1];
  return nx? {lv:st+2, left:Math.max(0, nx.need-hbMates().mateN)} : null; }
function hbMateTicket(){ const p=PROF(); return (p.tickets&&p.tickets.ally)||0; }
// 뽑기 1회 — 뽑기권 1장. 신규면 Lv.1로 영입, 중복이면 합성 재료(dup)로 쌓인다.
function hbMateRoll(){ const p=PROF(); if(hbMateTicket()<=0) return null;
  const H=hbMates(); p.tickets.ally--; H.mateN=(H.mateN||0)+1;
  if(typeof dqNote==='function') dqNote('gacha',1);   // 📅 일일 — 뽑기
  const probs=hbGachaProbs(H.mateN-1);                   // ⚠ 이번 판은 '뽑기 전' 확률로 굴린다
  const pool={}; for(const id in HB_MATES){ const t=HB_MATES[id].tier; (pool[t]=pool[t]||[]).push(id); }
  let r=Math.random(), tier=null;
  for(const t of GACHA_TIER_ORDER){ const w=(probs[t]||0)*(pool[t]?1:0); if(w<=0) continue;
    if(r<w){ tier=t; break; } r-=w; }
  if(!tier){ for(let i=GACHA_TIER_ORDER.length-1;i>=0;i--){ const t=GACHA_TIER_ORDER[i];
    if((probs[t]||0)>0 && pool[t]){ tier=t; break; } } }      // 반올림 잔차 — 열려 있는 최상위로
  const list=pool[tier], id=list[Math.floor(Math.random()*list.length)];
  const isNew=!hbMateOwned(id);
  if(isNew){ H.mates[id]={lv:1,dup:0};
    if(H.party.length<hbMateMax()) H.party.push(id); }        // 처음 얻으면 자리가 있는 만큼 바로 출전
  else H.mates[id].dup=(H.mates[id].dup||0)+1;
  saveMeta(); hbLayoutAllies();
  return { id:id, tier:tier, isNew:isNew, lv:hbGachaLv() }; }
// ── 합성 — 중복 동료를 '직접 골라' 재료로 넣는다 ──
function hbMatePt(id){ return HB_MATE_PT[(HB_MATES[id]||{}).tier]||1; }
// 다음 레벨에 필요한 재료 포인트 — 대상 등급이 높을수록·레벨이 높을수록 많이 든다
function hbMateNeed(id){ const M=HB_MATES[id]; if(!M) return 0;
  return Math.ceil(HB_MATE_PT[M.tier]*2*Math.pow(HB_MATE_NEED_MUL, Math.max(0,hbMateLv(id)-1))); }
function hbMateFed(id){ const r=hbMateRec(id); return r? (r.fed||0) : 0; }   // 이 레벨에 넣어 둔 재료
// 재료 1장 투입. 자기 자신의 중복도 재료로 쓸 수 있다. 채워지면 레벨이 오른다.
function hbMateFeed(targetId, matId){
  if(!hbMateOwned(targetId) || !HB_MATES[matId]) return false;
  if(hbMateDup(matId)<=0) return false;
  const H=hbMates(), T=H.mates[targetId];
  H.mates[matId].dup--;
  T.fed=(T.fed||0)+hbMatePt(matId);
  let up=0;
  while(T.fed>=hbMateNeed(targetId)){ T.fed-=hbMateNeed(targetId); T.lv++; up++; }
  saveMeta(); hbLayoutAllies();
  return up? up : true; }
// 재료로 쓸 수 있는 중복 목록(많은 것부터) — UI 공용
function hbMateMats(){ const H=hbMates(), out=[];
  for(const id in H.mates){ if(!HB_MATES[id]) continue; const d=H.mates[id].dup||0;
    if(d>0) out.push({id:id, dup:d, pt:hbMatePt(id)}); }
  return out.sort((a,b)=>b.pt-a.pt); }
// 출전 토글 — 정원을 넘기면 거절한다(자동으로 남을 빼지 않는다)
function hbMateToggle(id){ const H=hbMates(); if(!hbMateOwned(id)) return false;
  const i=H.party.indexOf(id);
  if(i>=0) H.party.splice(i,1);
  else { if(H.party.length>=hbMateMax()) return false; H.party.push(id); }
  saveMeta(); hbLayoutAllies(); return true; }
// 실제로 싸우러 나가는 동료 — 정원·보유 여부를 여기서 한 번에 거른다(전투·UI 공용)
function hbParty(){ const H=hbMates();
  return H.party.filter(id=>HB_MATES[id]&&hbMateOwned(id)).slice(0, hbMateMax()); }
// HB_ALLY_DPS 는 옛 '범용 동료'의 절대 위력이다. 동료가 이름·등급별 고유치를 갖게 된 뒤로
// 전투에는 안 쓰이지만, 아군 업그레이드 배수(hbAllyMul)의 기준값으로 남아 있다 — 지우지 말 것.
const HB_ALLY_DPS=.35, HB_TURRET_DPS=.55, HB_TURRET_RANGE=1.45;   // 캐릭터 대비 비율
const HB_PET_DPS=.18;                                             // 장착 펫 1마리당
const HB_BUNKER_HP=6, HB_BUNKER_R=150;                            // 캐릭터 최대체력 대비 배수 · 도발 반경
// ⚠ 적 사거리(HB_FOE_KIND.rng)는 이 반경을 넘으면 안 된다 — 넘는 순간 사수가 벙커 밖에 서서 캐릭터만 쏴
//    벙커의 존재 이유('대신 맞아준다')가 사라진다. 스모크가 표를 훑어 막는다.
// ═══ 🧱 기지 격자 — 사냥터 타일에 직접 짓는다 ═══════════════════════════════
// 좌표계: 타일 인덱스 (gx,gy). 타일 중심의 월드 좌표 = gx*HB_TILE + HB_TILE/2.
//   맵이 ±HB_MAP_R(300)이고 타일이 20이므로 gx,gy ∈ [-15, 14] → 30×30 = 900칸.
// ⚠ 다중 타일 건물은 **좌상단 타일 하나에만** 기록하고 w×h로 점유를 계산한다.
//   점유 칸마다 따로 쓰면 철거·이동에서 반드시 어긋난다.
// ⚠ 예전 구조(hunt.build = 종류별 '개수')는 hbBase()가 타일로 이관한다 — 아래 마이그레이션 참조.
const HB_TILE=20;                                   // 월드 유닛/타일
const HB_GRID_R=Math.round(HB_MAP_R/HB_TILE);       // 15 → gx,gy ∈ [-15, 14]
const HB_FOOT_MAX=2;                                // 가장 큰 건물의 변 길이(점유 역추적 범위)
const HB_OPEN_STEP=3;                               // 해금 한 단계 = 코어 밖으로 몇 타일 더
// 구조물 표 — 예전 HB_BUILD를 대체한다. ico = assets/icons/buildings/<ico>.webp
const HB_STRUCT={
  wall:   {name:'벽',        ico:'bld_supply',   m3d:'union_supply_depot',   w:1,h:1, max:400, base:20,  mul:1.012, slab:1, tip:'적이 돌아서 오게 만든다'},
  turret: {name:'터렛',      ico:'bld_turret',   m3d:'union_missile_turret', w:1,h:1, max:4,   base:120, mul:1.8,   tip:'고정 포탑 — 사거리가 길다'},
  bunker: {name:'벙커',      ico:'bld_bunker',   m3d:'union_bunker',         w:2,h:2, max:2,   base:300, mul:2.4,   tip:'유닛을 넣어 함께 쏜다 · 적을 끌어당긴다'},
};
// 🪖 벙커 주둔 = **구매 유닛 최대 4 + 출전 동료 1**(2026-08-12 확정 설계).
//   · 유닛: 벙커마다 개별로 미네랄로 사서 채운다(t.n, 비용은 그 벙커의 보유 수 기준). 새 벙커는 1기로 시작.
//   · 동료: 출전 동료 중 하나를 추가로 지정해 넣는다(t.m, 한 벙커에 1명 · 한 동료는 한 벙커에만).
//   벙커 화력 = (유닛 수 × HB_BUNKER_UNIT_DPS + 동료 위력) × 벙커 공격력(bkatk) · 사거리 HB_BUNKER_RNG.
const HB_BUNKER_SLOTS=4;                 // 벙커 한 채의 구매 유닛 상한
const HB_BUNKER_MATE_SLOTS=1;            // 추가로 들어가는 동료 수
const HB_BUNKER_UNIT_DPS=0.45;           // 유닛 1기 = 캐릭터 공격력의 45%
const HB_BUNKER_RNG=1.25;                // 벙커 사거리 = 캐릭터 사거리 배수
const HB_BUNKER_UNIT_BASE=90, HB_BUNKER_UNIT_MUL=1.75;   // 유닛 추가 비용(벙커별로 그 벙커의 보유 수 기준)
function hbBunkerN(t){ return Math.max(0, Math.min(HB_BUNKER_SLOTS, (t&&t.n)|0)); }
function hbBunkerUnitCost(n){ return Math.ceil(HB_BUNKER_UNIT_BASE*Math.pow(HB_BUNKER_UNIT_MUL, n)); }
// 이 벙커에 실제로 들어 있는 동료 — 파티에서 빠졌거나 팔린 동료는 여기서 걸러진다(타일도 정리)
function hbBunkerMates(t){ if(!t||t.k!=='bunker') return [];
  const party=hbParty(), m=(t.m||[]).filter(id=>party.indexOf(id)>=0);
  if(m.length!==(t.m||[]).length) t.m=m;               // 죽은 지정은 그 자리에서 지운다
  return m.slice(0, HB_BUNKER_MATE_SLOTS); }
// 이 동료가 들어가 있는 벙커의 타일 키(없으면 null) — 한 동료는 한 벙커에만 들어간다
function hbMateBunkerQ(id){ const T=hbBase().tiles;
  for(const q in T){ const t=T[q]; if(t.k==='bunker' && (t.m||[]).indexOf(id)>=0) return q; }
  return null; }
// '건물' 업그레이드 '벙커 공격력'(%) → 배수(기본 100%=1) × 레벨 포인트
function hbBunkerAtkMul(){ return hbUpgNum('bkatk')/100*lpMul('bld'); }
// 옛 개수형 보유분 → 타일. 'ally'는 없다 — 동료는 뽑기 로스터(HB_MATES)로 옮겨졌다.
const HB_BUILD_MIG={ turret:'turret', bunker:'bunker' };
function hbKey(gx,gy){ return gx+','+gy; }
function hbTx(g){ return g*HB_TILE+HB_TILE/2; }              // 타일 인덱스 → 타일 중심 월드 좌표
function hbGx(w){ return Math.floor(w/HB_TILE); }            // 월드 좌표 → 타일 인덱스
function hbInGrid(g){ return g>=-HB_GRID_R && g<HB_GRID_R; }
// 기지 상태 — hbHunt()와 같은 '없으면 그때 채운다' 방식이라 프로필 버전을 올릴 필요가 없다
function hbBase(){ const H=hbHunt();
  if(!H.base){ H.base={ tiles:{}, open:1 };
    // 옛 개수형 보유분을 타일로 이관 — 데이터를 잃지 않는다(코어 바깥부터 나선형으로 채운다)
    const old=H.build||{};
    for(const ok in HB_BUILD_MIG){ const n=old[ok]|0, nk=HB_BUILD_MIG[ok];
      for(let i=0;i<n;i++){ const c=hbFreeCell(nk); if(!c) break; H.base.tiles[hbKey(c[0],c[1])]={k:nk}; } }
    H.build={};   // 이관 완료 — 이후로는 타일이 단일 소스
  }
  return H.base; }
// 격자는 맵 전체다(2026-08-12 사용자 결정) — 해금 구역·코어 제한 없이 어디든 지을 수 있다.
// hunt.base.open은 옛 세이브 호환으로 남겨 두되 판정에 쓰지 않는다.
function hbCellBuildable(gx,gy){ return hbInGrid(gx) && hbInGrid(gy); }
// 이 칸을 점유한 구조물의 좌상단 키(없으면 null) — 좌상단에만 기록하므로 최대 변 길이만큼 역추적한다
function hbCellOwner(gx,gy){ const T=hbBase().tiles;
  for(let dy=0;dy<HB_FOOT_MAX;dy++) for(let dx=0;dx<HB_FOOT_MAX;dx++){
    const q=hbKey(gx-dx,gy-dy), t=T[q]; if(!t) continue;
    const S=HB_STRUCT[t.k]; if(!S) continue;
    if(dx<S.w && dy<S.h) return q; }
  return null; }
function hbStructN(k){ const T=hbBase().tiles; let n=0; for(const q in T) if(T[q].k===k) n++; return n; }
function hbBuildCost(k){ const B=HB_STRUCT[k]; return B?Math.ceil(B.base*Math.pow(B.mul, hbStructN(k))):0; }
function hbCanPlace(k,gx,gy){ const S=HB_STRUCT[k]; if(!S) return false;
  for(let dy=0;dy<S.h;dy++) for(let dx=0;dx<S.w;dx++){
    if(!hbCellBuildable(gx+dx,gy+dy)) return false;
    if(hbCellOwner(gx+dx,gy+dy)) return false; }
  return true; }
// ═══ 🧭 경로 — 플로우 필드 한 장 ═════════════════════════════════════════════
// 적 수십 기가 모두 같은 목표(캐릭터)로 향하므로 개체별 A*는 낭비다. 목표 타일에서 BFS를
// 한 번 돌려 900칸짜리 거리장을 굽고, 각 유닛은 자기 칸에서 '가장 가까운 이웃'으로만 걸어간다.
// 다시 굽는 조건: 목표가 다른 타일로 옮겼을 때 또는 구조물이 바뀌었을 때(_hbGridDirty)뿐.
const HB_GRID_N=HB_GRID_R*2;
let _hbBlk=null, _hbGridDirty=true, _hbBlkSeq=1;   // 막힌 칸(Uint8) 캐시 + 세대 번호(거리장 무효화용)
// ⚠ 거리장 캐시는 **세션 안**에 둔다(S._chF/S._chAt/S._foeAt). 2026-08-20 세션이 둘이 되면서 옮겼다 —
//    전역에 두면 사냥터와 토벌이 번갈아 돌 때 서로의 '마지막으로 구운 칸' 키를 덮어써서
//    거리장을 다시 굽지 않는다(적이 벽을 뚫고 오거나 엉뚱한 데로 돈다).
//    막힌 칸 표(_hbBlk)는 기지에서 나오는 것이라 계정 단위가 맞다 — 대신 토벌은 기지가 없어 hbBlocked() 가 빈 표를 준다.
// 구조물이 바뀌면 반드시 부른다 — 안 부르면 옛 길로 걸어 벽을 통과한다.
// 타일을 바꾸는 곳은 전부 hbLayoutBase()를 지나므로 그쪽에서 한 번 부르면 충분하다.
function hbGridDirty(){ _hbGridDirty=true; _hbBlkSeq++; for(const k in HBS){ if(HBS[k]) HBS[k]._chAt=''; } }
function hbFi(gx,gy){ return (gy+HB_GRID_R)*HB_GRID_N+(gx+HB_GRID_R); }
const _HB_NOBLK=new Uint8Array(HB_GRID_N*HB_GRID_N);   // 기지가 없는 판(토벌)용 — 전부 0
// ⚔ 토벌은 기지가 없다. 사냥터 기지 벽을 그대로 물려받으면 토벌장 한가운데 성벽이 서 있게 된다.
function hbNoBase(){ const S=_hb; return !!(S && S.mode==='dg'); }
function hbBlocked(){ if(hbNoBase()) return _HB_NOBLK;
  if(_hbBlk && !_hbGridDirty) return _hbBlk;
  const b=new Uint8Array(HB_GRID_N*HB_GRID_N), T=hbBase().tiles;
  for(const q in T){ const B=HB_STRUCT[T[q].k]; if(!B) continue;
    const p=q.split(','), gx=+p[0], gy=+p[1];
    for(let dy=0;dy<B.h;dy++) for(let dx=0;dx<B.w;dx++){
      const x=gx+dx, y=gy+dy; if(hbInGrid(x)&&hbInGrid(y)) b[hbFi(x,y)]=1; } }
  _hbBlk=b; _hbGridDirty=false;
  // 구조물이 하나도 없으면 경로 계산 자체를 건너뛴다 + 기지가 차지한 사각 범위를 함께 잡아 둔다
  _hbAnyBlk=false; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(let gy=-HB_GRID_R; gy<HB_GRID_R; gy++) for(let gx=-HB_GRID_R; gx<HB_GRID_R; gx++){
    if(!b[hbFi(gx,gy)]) continue; _hbAnyBlk=true;
    const cx=hbTx(gx), cy=hbTx(gy);
    if(cx<x0)x0=cx; if(cx>x1)x1=cx; if(cy<y0)y0=cy; if(cy>y1)y1=cy; }
  _hbBaseBox=_hbAnyBlk? {x0:x0-HB_TILE, y0:y0-HB_TILE, x1:x1+HB_TILE, y1:y1+HB_TILE} : null;
  return b; }
let _hbBaseBox=null;   // 기지가 차지한 사각 범위(+여유 1칸) — 적이 이 안에서 태어나면 벽이 무의미해진다
// 목표 칸에서 BFS — 막힌 칸은 통과 불가. 도달 못 하는 칸은 0xffff로 남는다.
function hbBakeField(tgx,tgy){ const blk=hbBlocked(), N=HB_GRID_N, n=N*N;
  const d=new Uint16Array(n).fill(0xffff), q=new Int32Array(n); let h=0,t=0;
  if(!hbInGrid(tgx)||!hbInGrid(tgy)) return d;
  const s0=hbFi(tgx,tgy); d[s0]=0; q[t++]=s0;                 // 목표가 막혀 있어도 출발점으로 삼는다(안에 갇힌 경우 대비)
  while(h<t){ const i=q[h++], x=(i%N)-HB_GRID_R, y=((i/N)|0)-HB_GRID_R, nd=d[i]+1;
    for(let e=0;e<4;e++){ const nx=x+(e===0?1:e===1?-1:0), ny=y+(e===2?1:e===3?-1:0);
      if(!hbInGrid(nx)||!hbInGrid(ny)) continue;
      const j=hbFi(nx,ny); if(blk[j]||d[j]<=nd) continue;
      d[j]=nd; q[t++]=j; } }
  return d; }
// 거리장을 따라 갈 방향(단위 벡터). 목표 칸에 이미 있거나 길이 없으면 null.
function hbFieldDir(d, wx, wy){ if(!d) return null;
  const gx=hbGx(wx), gy=hbGx(wy); if(!hbInGrid(gx)||!hbInGrid(gy)) return null;
  const cur=d[hbFi(gx,gy)]; if(cur===0) return null;
  let bx=0,by=0,bd=(cur===0xffff)?0xffff:cur;
  for(let e=0;e<4;e++){ const nx=gx+(e===0?1:e===1?-1:0), ny=gy+(e===2?1:e===3?-1:0);
    if(!hbInGrid(nx)||!hbInGrid(ny)) continue;
    const v=d[hbFi(nx,ny)]; if(v<bd){ bd=v; bx=nx; by=ny; } }
  if(!bx&&!by&&bd>=cur) return null;
  const tx=hbTx(bx), ty=hbTx(by), dx=tx-wx, dy=ty-wy, m=Math.hypot(dx,dy)||1;
  return [dx/m, dy/m]; }
// 두 점 사이가 뚫려 있나 — 뚫려 있으면 거리장을 무시하고 곧장 간다.
// 이게 없으면 열린 벌판에서도 타일 중심을 따라 계단처럼 걸어 부자연스럽다(각도도 4방향으로 뭉친다).
let _hbAnyBlk=false;
function hbLineClear(x0,y0,x1,y1){ if(!_hbAnyBlk || hbNoBase()) return true;
  const dx=x1-x0, dy=y1-y0, d=Math.hypot(dx,dy); if(d<1) return true;
  const n=Math.min(64, Math.ceil(d/(HB_TILE*0.5)));
  for(let i=1;i<=n;i++){ const t=i/n; if(!hbWalkable(x0+dx*t, y0+dy*t)) return false; }
  return true; }
// 벽 통과 금지 — 축을 나눠 밀어 본다(모서리에서 걸려 멈추지 않게)
function hbWalkable(wx,wy){ const gx=hbGx(wx), gy=hbGx(wy);
  if(!hbInGrid(gx)||!hbInGrid(gy)) return true;              // 맵 밖은 별도 클램프가 담당
  return !hbBlocked()[hbFi(gx,gy)]; }
function hbSlide(o, dx, dy){
  if(!hbWalkable(o.x,o.y)){ o.x+=dx; o.y+=dy; return; }   // 이미 벽 안이면 그냥 보낸다 — 안 그러면 영영 못 빠져나온다
  if(hbWalkable(o.x+dx,o.y+dy)){ o.x+=dx; o.y+=dy; return; }
  if(dx&&hbWalkable(o.x+dx,o.y)) o.x+=dx;
  if(dy&&hbWalkable(o.x,o.y+dy)) o.y+=dy; }
// 코어 바깥부터 나선형으로 첫 빈 자리 — 마이그레이션과 '자리 없음' 판정에 쓴다
function hbFreeCell(k){ const S=HB_STRUCT[k]||{w:1,h:1};
  for(let r=1;r<=HB_GRID_R;r++)
    for(let gy=-r;gy<=r;gy++) for(let gx=-r;gx<=r;gx++){
      if(Math.max(Math.abs(gx),Math.abs(gy))!==r) continue;             // 링 위만
      if(hbCanPlace(k,gx,gy)) return [gx,gy]; }
  return null; }
// ── 📦 상자 — 맵을 돌아다닐 이유 ─────────────────────────────────────────────
// 사냥터는 회복 구역이 중앙이고 적이 알아서 찾아오니, 그냥 두면 가운데를 뜰 이유가 없다.
// 상자는 '공격 대상'이다 — 사거리 안에 들어와야 때린다. 초반엔 걸어가야 하고,
// 사거리를 올릴수록 앉은 자리에서 더 많이 부순다(방치 보상이 사거리 업그레이드에 붙는다).
// ⚠ 적이 항상 우선이다. 상자 때문에 딜을 흘리면 웨이브를 못 버틴다.
const HB_CHEST_MAX=5;        // 필드 동시 존재 수
const HB_CHEST_HP0=14;       // 기본 체력(라운드로 조금 오른다 — 늘 몇 대는 때리게)
const HB_CHEST_MIN_D=90;     // 캐릭터에서 이 거리 밖에만 — 가만히 있어도 먹히면 이동 동기가 없다
// ⚠ 적 체력과 같은 지수를 탄다. 옛 선형(×0.35/라운드)으로 두면 라운드 60에서 적의 1/300이라
//    상자가 한 대에 깨지는 공짜 보상이 된다.
// ⚠ 적과 같은 곡선을 탄다(S자 포함) — 안 그러면 고비 구간에서 상자만 헐거워진다.
function hbChestHp(round,dg){ const S=_hb;
  return Math.round(HB_CHEST_HP0*hbCurve(HB_ROUND_HP,(dg||(S&&S.dg)||1),round)*hbRoundS(round)); }
// 보이는 영역 안에 둔다 — 화면 밖에 두면 있는 줄도 모른다(가장자리 화살표는 아직 없다)
function hbSpawnChest(){ const S=_hb; if(!S || !S.chests || S.chests.length>=HB_CHEST_MAX) return null;
  const k=S.k||1, hw=Math.max(60,(S.w/k)/2-30), hh=Math.max(60,((S.vBot-S.vTop)/k)/2-30);
  const cx=S.camX||0, cy=S.camY||0, R=HB_MAP_R-30;
  for(let i=0;i<30;i++){
    const x=Math.max(-R,Math.min(R, cx+(Math.random()*2-1)*hw));
    const y=Math.max(-R,Math.min(R, cy+(Math.random()*2-1)*hh));
    if(Math.hypot(x-S.char.x, y-S.char.y) < HB_CHEST_MIN_D) continue;
    if(Math.hypot(x,y) < hbHealR()+30) continue;              // 회복 구역 위에는 두지 않는다
    if(!hbWalkable(x,y)) continue;                            // 벽·건물 안에 박히면 때릴 수가 없다
    const hp=hbChestHp(S.round,S.dg); const ch={x:x,y:y,hp:hp,hpMax:hp};
    S.chests.push(ch); return ch; }
  return null; }
// 섞어서 굴린다 — 대부분 장비 뽑기권, 드물게 젬, 가끔 일시 버프
function hbChestReward(){ const p=(typeof PROF==='function')?PROF():null; if(!p) return '';
  const r=Math.random();
  if(r<0.06){ p.gem=(p.gem||0)+1; return '💎 젬 +1'; }
  if(r<0.26){ const k=(Math.random()<0.5)?'inc':'atk', B=HB_BOOSTS[k], H=hbHunt();
    H.boostT=H.boostT||{};
    H.boostT[k]=Math.max(Date.now(), H.boostT[k]||0) + B.sec*1000;
    return B.ico+' '+B.name; }
  // 📦 상자는 뽑기권의 주요 공급처다 — 장비뿐 아니라 펫·동료 권도 여기서 나온다
  p.tickets=p.tickets||{};
  const kind = (r<0.52)?'gear' : (r<0.80)?'pet' : 'ally';
  p.tickets[kind]=(p.tickets[kind]||0)+1;
  return '🎟 '+TICKET_NAME[kind]+' 뽑기권 +1'; }
function hbBreakChest(ch){ const S=_hb; if(!S) return; const i=S.chests.indexOf(ch); if(i<0) return;
  S.chests.splice(i,1);
  S.floats.push({x:ch.x, y:ch.y-22, tx:hbChestReward(), cl:'#ffd24a', t:0});
  if(typeof dqNote==='function') dqNote('chest',1);   // 📅 일일 — 보급 상자
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof saveMeta==='function') saveMeta();
  if(typeof updateCurBar==='function') updateCurBar(); }
function hbBoostOn(k){ return (hbHunt().boostT&&hbHunt().boostT[k]||0) > Date.now(); }
function hbBoostLeft(k){ return Math.max(0, Math.ceil((((hbHunt().boostT&&hbHunt().boostT[k])||0)-Date.now())/1000)); }
// 아군 배치 — 보유 수가 바뀌거나 라운드가 시작될 때 다시 세운다(월드 좌표, 캐릭터가 원점)
// 기지 타일 → 전장 개체. 타일이 단일 소스이므로 좌표를 여기서 만들어내지 않는다(초소만 예외: 동료가 그 둘레를 돈다).
// 벙커 체력은 재배치 때마다 되살아나면 안 되므로 타일에 남긴 hp를 이어받는다.
function hbLayoutBase(){ hbGridDirty();   // 구조물이 바뀌었을 수 있다 — 길을 다시 굽게 한다
  const S=_hb; if(!S) return; const st=hbCharStats();
  S.allies=[]; S.turrets=[]; S.bunkers=[];
  // 🤝 동료 — 벙커에 지정된 동료는 궤도에서 빠져 그 벙커에 들어간다. 나머지가 '내 주위'를 돈다.
  const party=(typeof hbParty==='function')?hbParty():[];
  const inBunker={}; { const T0=hbBase().tiles;
    for(const q in T0){ const t0=T0[q]; if(t0.k==='bunker') for(const id of hbBunkerMates(t0)) inBunker[id]=q; } }
  const orbit=party.filter(id=>!inBunker[id]);
  for(let i=0;i<orbit.length;i++){ const id=orbit[i], M=HB_MATES[id], a=i/Math.max(1,orbit.length)*Math.PI*2;
    S.allies.push({x:S.char.x+Math.cos(a)*52, y:S.char.y+Math.sin(a)*52, ph:a, cdT:Math.random()*.5,
      mid:id, mdl:M.unit, ico:M.ico, dps:hbMateDps(id), rng:M.rng, spd:M.spd, face:0}); }
  const T=hbBase().tiles;
  for(const q in T){ const t=T[q], B=HB_STRUCT[t.k]; if(!B) continue;
    const pp=q.split(','), gx=+pp[0], gy=+pp[1];
    const x=hbTx(gx)+(B.w-1)*HB_TILE/2, y=hbTx(gy)+(B.h-1)*HB_TILE/2;   // 점유 영역의 중심
    if(t.k==='turret') S.turrets.push({ x, y, cdT:Math.random()*.5, ico:'🔫' });   // 발사 시차(main 동작 유지)
    else if(t.k==='bunker'){ const mx=st.hpMax*hbAllyMul().bunker.hp;   // 벙커 체력 업그레이드(main) 반영
      if(t.n==null) t.n=1;                                              // 새 벙커는 유닛 1기로 시작 — 지어 두고 안 쏘면 이유를 알기 어렵다
      S.bunkers.push({ x, y, q, hp:(t.hp==null?mx:Math.min(t.hp,mx)), hpMax:mx,
        n:hbBunkerN(t), mates:hbBunkerMates(t), cdT:Math.random()*.5, ico:'🧱' }); } }
  const eq=((typeof PROF==='function'&&PROF().equip)||[]).slice(0,profPetSlots());
  S.pets=eq.map((id,i)=>({ id, ico:(PROF_PETS[id]&&PROF_PETS[id].emoji)||'🐾',
    ph:i/Math.max(1,eq.length)*Math.PI*2, x:0, y:0, cdT:Math.random()*.5 })); }
function hbLayoutAllies(){ return hbLayoutBase(); }   // 옛 이름 유지(호출부·스모크가 쓴다)
// 아군 한 명의 사격 — 가장 가까운 적을 친다(공용: 동료·펫·터렛)
// ✨ 공격 이펙트 = **관리자 페이지·유즈맵과 같은 공용 FX 코어**(FX/ATK_STYLE, js/18-strike.js).
//   ⛔ 사냥터 전용 사격선을 따로 만들지 말 것 — 예전엔 S.shots 에 직선 하나를 그렸다(두 번째 구현).
//   사격 주체는 전부 진짜 유닛 id 를 갖고 있어(캐릭터=PROF_CLASSES[cls].unit · 동료/몹=mdl)
//   ATK_STYLE 이 바로 걸린다 → 레인저는 3연사, 히드라는 가시, 드라군은 플라즈마로 각자 다르게 나간다.
// 캐릭터의 유닛 id — 3D 모델과 공격 이펙트가 **같은 값**을 봐야 한다(직업이 바뀌면 둘 다 따라간다)
function hbCharMdl(){ const ch=(typeof CHAR==='function')?CHAR():null;
  return (ch && PROF_CLASSES[ch.cls] && PROF_CLASSES[ch.cls].unit) || 'marine'; }
// ⚠ 이름은 hbFxStore 다. 사냥터엔 이미 hbFx(dt)(이펙트 스텝)가 있어서 hbFx 로 두면
//    같은 이름의 선언 둘이 서로를 덮어 무한 재귀가 난다(실제로 그랬다 — 스택 오버플로).
// 좌표계: 월드 390 = 관리자 화면 폭 1.0. 오토배틀의 STK_FX_SPAN(1400)과 같은 뜻이고,
//   사냥터는 월드가 거의 1:1 px 이라 390 이면 관리자와 **크기·오프셋 체감이 같아진다**.
const HB_FX_SPAN=390;
function hbFxStore(){ const S=_hb; if(!S || typeof FX==='undefined') return null;
  if(!S.fx || !S.fx.shots) S.fx=FX.store();          // 월드 좌표 스토어 — 사망 이펙트용
  return S.fx; }
function hbFxUnit(){ const S=_hb; if(!S || typeof FX==='undefined') return null;
  if(!S.fxU || !S.fxU.store) S.fxU={ store:FX.store(), pend:[] };   // 정규화 스토어 — 유닛별 발사 이펙트용
  return S.fxU; }
// ✨ 발사는 **관리자(이펙트 랩·전투실험)와 같은 디스패처** unitFireFx 를 지난다.
//   ⛔ FX.spawn 을 직접 부르지 말 것 — 그건 한 단계 아래라 골리앗 어깨 미사일·레이서 쌍권총 같은
//     유닛별 연출이 통째로 빠진다(오토배틀도 unitFireFx 를 쓰고 FX.spawn 은 폴백으로만 둔다).
function hbFire(sx,sy,tx,ty,mdl,size,tgtAir){
  const L=hbFxUnit(); if(!L) return; const W=HB_FX_SPAN;
  if(typeof unitFireFx==='function'){
    const pu={ uid:'hb'+(mdl||'?'), id:mdl||'marine', gmodel:mdl||null, x:sx/W, y:sy/W, size:size||FX.REF, face:Math.atan2(tx-sx,ty-sy) };
    try{ unitFireFx(L, pu, tx/W, ty/W, size||FX.REF, !!tgtAir); return; }catch(e){}
  }
  FX.spawn(L.store, mdl||'_default', sx/W,sy/W, tx/W,ty/W, {unitSize:size||FX.REF});   // 폴백
}
function hbFoeSize(f){ return FX.REF*(f&&f.sz||1); }
function hbIsAir(mdl){ return (typeof FXLAB_AIR!=='undefined') && FXLAB_AIR.has(mdl); }
function hbUnitFire(u, dps, rangeMul, dt, cdMul){ const S=_hb, c=S.char;
  u.cdT-=dt; if(u.cdT>0) return;
  const rng=c.range*(rangeMul||1); let best=null,bd=1e18;
  for(const f of S.foes){ const d=Math.hypot(f.x-u.x,f.y-u.y); if(d<bd){ bd=d; best=f; } }
  if(!best || bd>rng) return;
  if(u.face!==undefined) u.face=Math.atan2(best.x-u.x, best.y-u.y);   // 쏠 땐 표적을 본다
  u.cdT=c.cd*(cdMul||1); const dmg=c.atk*dps*(hbBoostOn('atk')?2:1);
  best.hp-=dmg; hbFire(u.x,u.y-6, best.x,best.y, u.mdl, FX.REF, hbIsAir(best.mdl));
  if(best.hp<=0) hbKill(best); }
// 스킬
function hbSkillReady(k){ const S=_hb; return !!S && (S.skT&&S.skT[k]||0)<=0; }
// 자동 사용 on/off — 작은 원을 누를 때마다 뒤집힌다
// 쇼타임 껍데기 — 남은 비율만 CSS 변수로 넣는다(DOM 재생성 없음).
// ⚠ HB_SKILLS[k].cd 가 총시간 — 남은 시간을 그걸로 나눠야 한 바퀴가 맞는다.
function hbSkCdPaint(){ const S=_hb; if(!S) return;
  const bar=document.getElementById('hbBar'); if(!bar) return;
  for(const k in HB_SKILLS){ const el=bar.querySelector('.hbSk[data-k="'+k+'"]'); if(!el) continue;
    const tot=HB_SKILLS[k].cd||1, left=Math.max(0, S.skT[k]||0);
    const f=Math.max(0, Math.min(1, left/tot));
    el.style.setProperty('--cd', f.toFixed(3));
    el.classList.toggle('cool', f>0);
    // 숫자도 여기서 — 준비되면 비운다(아이콘만 남는다)
    const sec=el.querySelector('.hbSkSec'), tx=f>0? String(Math.ceil(left)) : '';
    if(sec && sec.textContent!==tx) sec.textContent=tx; } }
function hbToggleAuto(){ const H=hbHunt(); H.skAuto=H.skAuto?0:1;
  if(typeof playSfx==='function') playSfx('ui_toggle');
  if(typeof saveMeta==='function') saveMeta(); renderHbBar(); }
// 매 틱 — 켜 둔 스킬을 준비되는 대로 쓴다.
// ⚠ 회복은 체력이 넓넓할 때 쓰면 그대로 버려진다 — 70% 아래일 때만 내보낸다.
function hbAutoSkills(){ const S=_hb; if(!S||!S.char) return;
  // ⚔ 자동 토벌은 "스킬도 자동사용됨"이 정의다 — 사냥터의 skAuto 토글과 무관하게 늘 켜져 있다.
  //   직접 토벌은 수동이 기본(그게 '직접'을 고르는 이유다).
  if(S.mode==='dg'){ if(!S.auto) return; }
  else if(!hbHunt().skAuto) return;   // 한 번에 켜고 끈다
  for(const k in HB_SKILLS){ if(!hbSkillReady(k)) continue;
    if(k==='heal' && S.char.hp > S.char.hpMax*0.7) continue;
    hbUseSkill(k); } }
function hbUseSkill(k){ const S=_hb, SK=HB_SKILLS[k]; if(!S||!SK) return;
  if(!hbSkillReady(k)){ return; }
  const c=S.char;
  if(k==='nova'){ const dmg=c.atk*3*(hbBoostOn('atk')?2:1);
    for(const f of S.foes.slice()){ f.hp-=dmg; if(f.hp<=0) hbKill(f); }
    S.floats.push({x:0,y:-40,tx:'💥 폭발!',cl:'#ffd24a',t:0}); }
  else if(k==='heal'){ c.hp=Math.min(c.hpMax, c.hp+c.hpMax*.4); c.hitT=0;
    S.floats.push({x:0,y:-40,tx:'💚 회복',cl:'#5dff8f',t:0}); }
  else if(k==='slow'){ S.slowT=HB_SLOW_S;
    S.floats.push({x:0,y:-40,tx:'🕸 감속',cl:'#9ad0ff',t:0}); }
  S.skT[k]=SK.cd; if(typeof playSfx==='function') playSfx('ui_open'); if(!S.bg) renderHbBar(); }
// ══ 전투 세션 레지스트리 — 사냥터와 토벌이 **동시에** 돈다 (2026-08-20) ══════════════════
// `_hb` 는 세션이 아니라 **'지금 화면이 보는 세션'을 가리키는 포인터**다. 진짜 세션은 HBS 안에 있다.
// 159개 함수가 `_hb` 를 직접 읽으므로, 포인터만 재조준하면 그 함수들을 한 줄도 안 고치고 두 세션을 굴린다.
//   ⛔ `_hb` 에 직접 대입하지 말 것 — 반드시 hbUse()/hbSetSess() 를 지날 것.
//      불변식: **_hb === HBS[_hbView]**. 이게 깨지면 한 세션이 다른 세션의 적·재화를 먹는다(스모크가 검사).
//   ⛔ getter 로 가로채는 방법은 쓸 수 없다(2026-08-20 실측): 파일 스코프 `let` 은 window 프로퍼티가
//      아니라 defineProperty 가 무효이고, `var` 로 바꿔도 전역 var 는 configurable:false 라 던진다.
//   ⚠ 시뮬 시계(lastSim)도 세션마다 따로다 — 전역 하나로 두면 배경 세션이 앞 세션의 시각을 물려받아
//      돌아온 순간 큰 dt 로 한 번에 점프한다.
const HBS={ hunt:null, dg:null };   // hunt = 자동사냥(방치) · dg = 토벌
let _hbView='hunt';                 // _hb 가 지금 가리키는 쪽
let _hb=null,_hbRaf=0,_hbTick=0;
function hbUse(k){ _hbView=k; _hb=HBS[k]||null; return _hb; }                        // 포인터 재조준(세션 생성 아님)
function hbSetSess(k,S){ HBS[k]=S||null; if(_hbView===k) _hb=HBS[k]; return HBS[k]; }// 세션 교체 — 보고 있으면 포인터도 따라간다
function hbWith(k,fn){ const v=_hbView; try{ hbUse(k); return fn(HBS[k]); } finally{ hbUse(v); } }  // 그 세션 기준으로 잠깐 실행
// ⏩ 자동 토벌 배속 상한 — dt 를 키우면 충돌·사거리 판정이 통째로 샌다(적이 벽을 통과하고 사거리를 건너뛴다).
//    그래서 '한 번에 크게'가 아니라 **작은 dt 로 여러 번** 민다. 값은 BALANCE.md 가 단일 소스.
const HB_SUB_MAX=16;
// 시뮬 시계 — rAF와 분리(50ms 인터벌이 진행을 보장한다. 이 환경·백그라운드 탭에서 rAF가 멎어도 전투는 돈다)
function hbPump(){ const S=_hb; if(!S||!S.on||S.manual) return;   // manual = 스모크가 hbStep을 직접 돌릴 때
  const now=performance.now(); let dt=(now-(S.lastSim||now))/1000; if(dt<=0) return;
  S.lastSim=now;
  dt=Math.min(dt,.25);                                            // 오래 멎었다 와도 한 번에 크게 점프하지 않는다
  // ⏩ 배속 = **평소 크기의 스텝을 여러 번**. 총 sub×dt 만큼 전진한다.
  //   ⛔ hbStep(dt*배속) 로 하지 말 것 — 한 스텝이 커지면 충돌·사거리 판정이 통째로 샌다
  //      (적이 벽을 통과하고 사거리를 건너뛴다).
  //   ⛔ hbStep(dt/배속) 을 여러 번도 아니다 — 그건 총합이 dt 라 **배속이 아예 안 걸린다**
  //      (2026-08-20 실제로 그렇게 짰고, 스모크가 그 버그를 보증하고 있었다).
  const sub=Math.max(1, Math.min(HB_SUB_MAX, Math.round(S.speed||1)));   // speed 미설정 = 1 = 옛 동작 그대로
  for(let i=0;i<sub;i++){ hbStep(dt); if(_hb!==S) break; }         // 스텝 도중 세션이 걷히면(사망·클리어) 즉시 중단
}
// 그리기 재개 — 보는 세션이 바뀌었을 때(사냥터 ↔ 토벌) 한 줄로 다시 돌린다.
// ⚠ hbFrame 은 `_hb.bg` 면 스스로 멎고 _hbRaf 를 0 으로 놓는다 — 그래서 되살릴 입구가 필요하다.
function hbKick(){ const S=_hb; if(!S||!S.on||S.bg) return;
  S.lastSim=performance.now();
  if(!_hbRaf) _hbRaf=requestAnimationFrame(hbFrame);
  if(!_hbTick) _hbTick=setInterval(hbPumpAll,50); }
// 살아 있는 세션을 **전부** 민다 — 배경 세션도 여기서 진행한다.
// ⚠ 반드시 원래 보던 세션으로 되돌려 놓는다(finally). 안 하면 다음 그리기가 남의 세션을 그린다.
function hbPumpAll(){ const v=_hbView;
  try{ for(const k in HBS){ const S=HBS[k]; if(!S||!S.on||S.manual) continue; hbUse(k); hbPump(); } }
  finally{ hbUse(v); } }
function hbStart(){ const cv=document.getElementById('hbCv'); if(!cv) return;
  hbUse('hunt');                                      // ⚠ 사냥터 화면이므로 포인터를 사냥터 세션으로 — 토벌을 보다 왔을 수 있다
  if(_hb && _hb.on){                                  // 이미 돌고 있던 판 — 라운드·웨이브·적을 그대로 이어받는다
    _hb.bg=false; _hb.cv=cv; _hb.ctx=cv.getContext('2d'); _hb._pat=null;
    _hb.vTop=0; _hb.vBot=0;                           // 카메라는 새 레이아웃으로 '즉시' 맞춘다(보간하면 돌아온 순간 어긋나 보인다)
    hbSyncChar();                                     // 자리를 비운 사이 산 업그레이드·레벨·포인트를 반영
    if(!_hbTick) _hbTick=setInterval(hbPumpAll,50);
    _hb.lastSim=performance.now();
    if(!_hbRaf) _hbRaf=requestAnimationFrame(hbFrame);
    hbResize(); hbHud(); renderHbBar(); return; }
  const H=hbHunt(), st=hbCharStats();
  hbSetSess('hunt', { on:true, mode:'hunt', speed:1, lastSim:performance.now(),
    cv, ctx:cv.getContext('2d'), w:0,h:0,d:1, vTop:0, vBot:0, cx:0, cy:0, k:1, t:0,
    dg:H.dg||1, round:H.round||1, wave:1, phase:'fight', waveT:hbWaveTime(1), gapT:0, downT:0,
    pend:[], pendT:0, foes:[], chests:[], fx:null, floats:[], kills:0, rt0:0, charDir:4, charFace:0, atkT:0,
    allies:[], turrets:[], bunkers:[], pets:[], skT:{nova:0,heal:0,slow:0}, slowT:0, skDirty:false,
    buf:{min:0,gas:0,xp:0,kills:0},
    char:{ x:0,y:0, hp:st.hpMax, hpMax:st.hpMax, atk:st.atk, cd:st.cd, crit:st.crit, critDmg:st.critDmg,
           range:st.range, regen:st.regen, cdT:0, hitT:9,
           shd:st.shdMax, shdMax:st.shdMax, shdReg:st.shdReg,
           lifest:st.lifest, knock:st.knock, chestDmg:st.chestDmg, multiC:st.multiC, multiN:st.multiN,
           bncC:st.bncC, bncN:st.bncN, scritC:st.scritC, scritM:st.scritM,
           mspd:st.mspd, rrng:st.rrng } });
  hbUse('hunt');
  hbEnsureModels(_hb.dg);                            // ⚔ 현재 던전 적 모델 준비(없으면 이모지로 시작)
  hbResize(); hbLayoutAllies(); hbSpawnWave(); hbHud(); renderHbBar();
  _hb.lastSim=performance.now();
  _hbRaf=requestAnimationFrame(hbFrame);            // 그리기
  if(!_hbTick) _hbTick=setInterval(hbPumpAll,50); }  // 진행 보장(세션 전부)
// ══ ⚔ 토벌 세션 — 같은 엔진, 다른 규칙 (2026-08-20) ══════════════════════════════════
// 사냥터와 **같은 hbStep** 을 쓴다. 이동·카이팅·스킬·3D 를 두 번 만들지 않기 위해서다(단일 소스).
// 다른 것은 규칙뿐이고, 규칙 차이는 딱 다섯 군데다:
//   ① 기지가 없다(hbNoBase) — 벽·회복 구역·기지 사각이 전부 빠진다
//   ② 웨이브를 다 깨면 '라운드 다음'이 아니라 **단계 클리어**(hbSettle 분기)
//   ③ 죽으면 라운드가 내려가는 게 아니라 **실패**(hbDie 분기)
//   ④ 웨이브 재화를 안 준다(hbWaveReward 분기) — 보상은 클리어 때 한 번
//   ⑤ 동료·펫·터렛·벙커가 없다 — 토벌은 '캐릭터가 직접 싸우는' 콘텐츠다
// ⚠ 화면 없이도 돌아야 한다(자동 전투). 그래서 cv/ctx 없이 만들고, 화면 기하는 기본값을 심는다.
const DG_HB_W=390, DG_HB_H=560;        // 화면이 없을 때 쓸 가상 화면 크기(적 출현 거리 계산에만 쓴다)
// 토벌 단계 → 사냥터 곡선 좌표. 단계 하나가 라운드 하나다(곡선을 그대로 빌린다).
//   ⚠ 아직 실측 전이다(BALANCE.md §5 A6). 토벌이 사냥터보다 쉬우면 아무도 사냥터를 안 한다.
const DG_ROUND_PER_FLOOR=1;
function dgHbRound(floor){ return Math.max(1, Math.round(floor*DG_ROUND_PER_FLOOR)); }
function dgHbStart(floor, id, opt){ const c=CHAR(); if(!c) return null;
  const o=opt||{}, st=hbCharStats(), cv=o.cv||null;
  const S={ on:true, mode:'dg', auto:!!o.auto, speed:o.auto?DG_AUTO_SPEED:1, lastSim:performance.now(),
    dgId:id||'normal', floor:floor, needKey:!!o.key, done:0,
    cv:cv, ctx:cv?cv.getContext('2d'):null, bg:!cv,
    w:DG_HB_W, h:DG_HB_H, d:1, vTop:0, vBot:DG_HB_H, cx:0, cy:0, k:1, t:0,
    dg:1, round:dgHbRound(floor), wave:1, phase:'fight', waveT:hbWaveTime(1), gapT:0, downT:0,
    pend:[], pendT:0, foes:[], chests:[], shots:[], floats:[], kills:0, rt0:0, charDir:4, charFace:0, atkT:0,
    allies:[], turrets:[], bunkers:[], pets:[],   // ⑤ 캐릭터 단독 — 비워 두면 그 루프들이 안 돈다
    skT:{nova:0,heal:0,slow:0}, slowT:0, skDirty:false, _chAt:'', _foeAt:'', _chF:null,
    buf:{min:0,gas:0,xp:0,kills:0},
    char:{ x:0,y:0, hp:st.hpMax, hpMax:st.hpMax, atk:st.atk, cd:st.cd, crit:st.crit, critDmg:st.critDmg,
           range:st.range, regen:st.regen, cdT:0, hitT:9,
           shd:st.shdMax, shdMax:st.shdMax, shdReg:st.shdReg,
           lifest:st.lifest, knock:st.knock, chestDmg:st.chestDmg, multiC:st.multiC, multiN:st.multiN,
           bncC:st.bncC, bncN:st.bncN, scritC:st.scritC, scritM:st.scritM,
           mspd:st.mspd, rrng:st.rrng } };
  hbSetSess('dg', S);
  hbWith('dg', ()=>{ hbSpawnWave(); });      // ⚠ 반드시 그 세션을 보는 상태에서 — hbSpawnWave 는 _hb 를 읽는다
  if(!_hbTick) _hbTick=setInterval(hbPumpAll,50);   // 자동은 rAF 없이 인터벌로 돈다(탭을 내려도 진행)
  return S; }
// 토벌 판을 끝낸다 — 결과는 dg 쪽(09-dungeon.js)이 처리한다.
function dgHbEnd(){ const S=HBS.dg; hbSetSess('dg', null); return S; }
// 화면을 떠나도 전투는 계속 돈다 — '그리기'만 멈추고 시뮬(setInterval)은 살려 둔다.
// ⚠ 여기서 반드시 저장한다. 처치 보상은 메모리에만 있어서, 다음 화면의 loadMeta()가 그대로 덮어쓴다(재화가 사라지던 원인).
// ⚠ 3D 캔버스는 공용이라 떠날 때 무조건 반납한다(안 하면 유즈맵 3D가 사라진다).
function hbStop(){ if(_hbRaf) cancelAnimationFrame(_hbRaf); _hbRaf=0;
  if(_hb){ if(_hb.build && typeof hbBuildExit==='function') hbBuildExit();   // 🛠 건설 중이었으면 라운드를 되살리고 나간다
    _hb.bg=true; _hb.arm=null; _hbDirty=false; if(typeof saveMeta==='function') saveMeta(); }
  if(typeof hbArmBtns==='function') hbArmBtns();   // 🧱 배치 중이었으면 확정 버튼도 걷는다(안 그러면 다른 화면 위에 남는다)
  hb3dDetach(); }
// 전투를 진짜로 끝낼 때(로그아웃) — 진행 상태까지 버린다.
// ⚠ 세션 **전부**를 버린다 — 토벌만 남으면 인터벌이 죽은 뒤로 영영 안 돈다.
function hbEnd(){ hbStop(); if(_hbTick) clearInterval(_hbTick); _hbTick=0;
  for(const k in HBS){ if(HBS[k]) HBS[k].on=false; hbSetSess(k, null); }
  hbUse('hunt'); }
const HB_BAR_BOT=12;   // 업그레이드 카드가 없을 때(직접 토벌) 스킬 바를 띄울 캔버스 아래 간격(px)
// 전장은 화면 전체가 아니라 '보이는 영역'이다 — 위는 재화 바 아래, 아래는 업그레이드 카드 위.
// 카드를 접으면 그만큼 전장이 넓어지고 캐릭터도 내려온다(매 프레임 다시 재므로 토글이 바로 반영된다).
function hbResize(){ const S=_hb, cv=S.cv, w=cv.clientWidth||1, h=cv.clientHeight||1, d=Math.min(2,window.devicePixelRatio||1);
  if(cv.width!==Math.round(w*d) || cv.height!==Math.round(h*d)){ cv.width=Math.round(w*d); cv.height=Math.round(h*d); }
  S.w=w; S.h=h; S.d=d;
  { const bar=document.getElementById('hbBar'), up=document.querySelector('#homeScreen .hmUpg');
    // ⚠ 직접 토벌은 업그레이드 카드를 숨긴다(.dgFight) — 그러면 rect 가 전부 0 이라
    //   pr.bottom-0+8 이 되어 **스킬 바가 화면 밖으로 밀린다**(실제로 사라졌다).
    //   카드가 없을 땐 캔버스 아래에서 고정 간격으로 띄운다.
    //   ⚠ 그냥 캔버스 아래 12px 로 두면 이번엔 **하단 네비 뒤**로 깔린다(실제로 그랬다) —
    //     카드가 없을 땐 네비 위를 기준으로 삼는다.
    const upOn=!!(up && up.getClientRects().length);
    if(bar){ const pr=cv.getBoundingClientRect();
      let bot=HB_BAR_BOT;
      if(upOn) bot=Math.round(pr.bottom-up.getBoundingClientRect().top+8);
      else { const nav=document.getElementById('navBar');
        if(nav && nav.getClientRects().length) bot=Math.round(pr.bottom-nav.getBoundingClientRect().top+HB_BAR_BOT); }
      bar.style.bottom=bot+'px'; } }
  if(typeof hmUpgSnapGrid==='function') hmUpgSnapGrid();   // 폭이 바뀌면 칸 폭도 다시 정수로 잡는다
  const box=cv.getBoundingClientRect();
  const cur=document.getElementById('curBar'), up=document.querySelector('#homeScreen .hmUpg');
  const curB=(cur && !cur.classList.contains('hide')) ? cur.getBoundingClientRect().bottom-box.top : 0;
  // 아래 경계는 '카드 위'가 아니라 '스킬 바 위'다 — 스킬 바가 전장 위에 떠 있어서
  // 카드 기준으로 잡으면 적이 버튼 뒤로 지나가 섞인다(위 블록에서 바 위치를 이미 정했으므로 여기서 재도 된다).
  const bar2=document.getElementById('hbBar');
  const barOn=!!(bar2 && bar2.getClientRects().length);
  const lowT=barOn ? bar2 : up;
  const upT =(lowT && lowT.getClientRects().length) ? lowT.getBoundingClientRect().top-box.top : h;
  S.hideB=barOn ? Math.round(bar2.getBoundingClientRect().height)+8 : 0;   // 아래 스폰이 숨어야 할 높이
  let tTop=Math.max(0,curB), tBot=Math.min(h,upT);
  if(tBot-tTop<80){ tTop=0; tBot=h; }                // 비정상적으로 좁으면(측정 실패) 화면 전체로
  // 보이는 영역 자체를 좇는다 — 카메라(중심·배율)가 여기서 파생되므로 한 곳만 부드럽게 하면 전부 따라온다
  const near=(a,b)=>Math.abs(a-b)<0.5;
  // 보간은 '카드 접기/펴기' 같은 작은 변화용이다. 화면을 갔다 오면 레이아웃이 통째로 바뀌어 있어
  // 보간하면 한동안 어긋난 채로 그려진다(적이 스킬 바 뒤로 지나간다) → 큰 변화는 즉시 맞춘다.
  const snap=(cur,tgt)=>(!cur || near(cur,tgt) || Math.abs(tgt-cur)>HB_CAM_SNAP) ? tgt : cur+(tgt-cur)*HB_CAM_EASE;
  S.vTop=snap(S.vTop,tTop);
  S.vBot=snap(S.vBot,tBot);
  S.k=(S.vBot-S.vTop)/hbViewH(S.char.range||HB_RNG_BASE);   // 줌 = 사거리 종속
  // 카메라는 캐릭터를 따라가되, 보이는 사각형이 필드를 벗어나지 않게 가둔다 → 맵 바깥이 화면에 안 들어온다
  const hvw=(w/S.k)/2, hvh=((S.vBot-S.vTop)/S.k)/2;
  const lim=(v,R,hv)=>(hv>=R)?0:Math.max(-(R-hv), Math.min(R-hv, v));   // 필드가 화면보다 작으면 가운데 고정
  // 건설 중에는 캐릭터가 아니라 '건설 카메라'(S.bcam)를 따라간다 — 고스트를 화면 끝으로 끌면 여기가 움직인다
  const _fx=(S.build&&S.bcam)?S.bcam.x:(S.char.x||0), _fy=(S.build&&S.bcam)?S.bcam.y:(S.char.y||0);
  const camX=lim(_fx, HB_FIELD_RX, hvw), camY=lim(_fy, HB_FIELD_RY, hvh);
  S.camX=camX; S.camY=camY;                          // 보이는 영역의 월드 중심 — hbFloor가 여기를 덮는다
  S.cx=w/2-camX*S.k; S.cy=(S.vTop+S.vBot)/2-camY*S.k;
  if(S.char.px==null){ S.char.x=0; S.char.y=0; S.char.tx=0; S.char.ty=0; S.char.px=1; } }   // 최초 1회만 원점 — 그 뒤로는 걸어다닌 자리를 지킨다
function hbSpawnWave(){ const S=_hb, n=hbFoeCount(S.round,S.wave);
  if(S.wave===1) for(const b of S.bunkers){ b.hp=b.hpMax;         // 라운드 시작 = 벙커 수리
    if(b.q){ const _bt=hbBase().tiles[b.q]; if(_bt) _bt.hp=b.hp; } }
  S.waveT=hbWaveTime(S.wave); S.pend.length=0;
  const D=hbDun(S.dg);
  const plan=hbWavePlan(D, S.round, S.wave, n);          // 🧮 이 웨이브에 누가 몇 기 나오는지 — 라운드·웨이브가 정한다
  const rwN=hbRwNormPlan(plan);                          // 🔒 그 구성의 평균 처치 보상 = 1.0(시급 고정)
  let _i=0; const mk=()=>hbFoeProto(plan[_i++]||'grunt', S, D, rwN);
  const boss=(S.wave===HB_WAVES);   // 마지막 웨이브 = 보스가 함께 나온다
  if(S.chests) S.chests.length=0;                        // 📦 지난 웨이브 상자는 사라진다(모아 두는 플레이 방지)
  if(S.mode!=='dg') hbSpawnChest();                       // 📦 웨이브마다 하나(토벌엔 보급 상자가 없다)
  if(n<=HB_SPREAD_N){ for(let i=0;i<n;i++) hbPlaceFoe(mk()); if(boss) hbPlaceFoe(mkBoss(D,S,rwN)); }
  else{ for(let i=0;i<n;i++) S.pend.push(mk()); if(boss) S.pend.push(mkBoss(D,S,rwN)); S.pendT=0; }
  if(boss){ S.floats.push({x:S.char.x,y:S.char.y-46,tx:'⚠ 보스 출현',cl:'#ff3b3b',t:0});
    if(typeof playSfx==='function') playSfx('ui_open'); }
  hbHud(); }
// 🎲 편성표에서 가중 추첨 — 역할(HB_FOE_KIND)과 얼굴(roster)이 여기서 만난다.
//   ⚠ 원형에는 kind 키까지 실어 보낸다. 이동·사격·크기가 전부 그 키 하나에서 갈린다.
// 그 던전에 나올 수 있는 (역할×얼굴) 전부 — 종족 팔레트에서 유도한다(표를 두 벌로 두지 않는다).
//   모델 미리받기(hbEnsureModels)와 스모크 검사가 이걸 쓴다.
function hbRoster(D){ const pal=HB_RACE_FACE[(D&&D.race)||'union']||HB_RACE_FACE.union, out=[];
  for(const k of Object.keys(HB_FOE_KIND)) for(const f of (pal[k]||[])) out.push({ k:k, mdl:f[0], ico:f[1] });
  return out.length?out:[{k:'grunt',mdl:null,ico:'👾'}]; }
// 원형 하나 — 역할(kind)과 던전(얼굴)과 그 웨이브의 보상 정규화(rwN)를 합친다
function hbFoeProto(kind,S,D,rwN){ const K=hbKindOf(kind), F=hbFaceOf(D,kind);
  return { kind:kind, ico:F.ico, mdl:F.mdl, hpMul:K.hp, atkMul:K.atk, sz:K.sz, rng:K.rng, way:K.way,
    rw:K.rw*(rwN||1), spd:K.spd*HB_FOE_SPD_MUL*(1+S.round*0.01) }; }
// 🧮 **웨이브 편성표를 짠다** — 이 함수 하나가 '언제 · 얼마나' 를 전부 정한다.
//   ① 상한 있는 역할(사수·비행·중장갑·유령)은 hbKindQuota 가 정한 **정확한 마릿수**만 넣는다.
//   ② 남은 자리는 기본·돌격이 채운다(주력). 기본 계열은 최소 HB_BASIC_MIN 기 남긴다.
//   ③ 순서를 섞는다 — 안 섞으면 늘 같은 순서로 등장해 '대열'처럼 보인다.
//   ⚠ 던전은 **얼굴만** 정한다. 구성은 라운드·웨이브가 정한다(2026-08-20 재설계).
function hbWavePlan(D, round, wave, n){
  const out=[];
  let room=Math.max(0, n-HB_BASIC_MIN);
  for(const k of ['ranger','flyer','brute','phase']){
    let q=hbKindQuota(k, round, wave);
    if(q<=0) continue;
    q=Math.min(q, room); room-=q;
    for(let i=0;i<q;i++) out.push(k); }
  // 남은 자리 = 기본·돌격. 돌격 비중은 라운드가 오를수록 조금 늘어난다(초반은 기본이 주력)
  const rest=Math.max(0, n-out.length);
  const runP=Math.min(0.45, 0.15+round*0.004);
  for(let i=0;i<rest;i++) out.push(Math.random()<runP?'runner':'grunt');
  for(let i=out.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=out[i]; out[i]=out[j]; out[j]=t; }
  return out; }
// 🔒 **그 웨이브의 평균 처치 보상 = 1.0**. 구성이 라운드·웨이브마다 달라져도 시급은 안 움직인다.
//   ⚠ 예전엔 던전 편성표(고정 가중치)로 한 번만 계산했다. 이제 구성이 매 웨이브 달라지므로
//     **짜인 편성표를 받아** 그때그때 정규화한다. 안 그러면 후반 웨이브(강한 놈 비중↑)에서 시급이 뛴다.
function hbRwNormPlan(plan){ if(!plan||!plan.length) return 1;
  let rw=0; for(const k of plan) rw+=hbKindOf(k).rw;
  return (rw>0)? plan.length/rw : 1; }
// 보스 원형 — 편성표에서 **가장 무거운 놈**(중장갑 > 가중치 낮은 순)을 키운 것. 새 모델을 만들지 않는다.
//   ⚠ 보스는 늘 지상 근접이다 — 날거나 벽을 통과하는 보스는 벽·기지 설계를 통째로 무의미하게 만든다.
// 보스 역할 = 그 라운드에 이미 등장하는 것 중 가장 무거운 지상 근접. 아직 안 열린 역할을 보스로 쓰지 않는다.
function hbBossKind(round){ for(const k of ['brute','phase','grunt'])
    if(k==='grunt' || round>=((HB_SPAWN[k]||{}).from||1)) return k;
  return 'grunt'; }
function hbBossEntry(D,round){ const k=hbBossKind(round==null?99:round), F=hbFaceOf(D,k); return { k:k, mdl:F.mdl, ico:F.ico }; }
function mkBoss(D,S,rwN){ const e=hbBossEntry(D,S&&S.round), K=hbKindOf(e.k);
  return { kind:e.k, ico:e.ico, mdl:e.mdl, boss:true, sz:K.sz, rng:0, way:'ground', rw:K.rw*(rwN||1),
    hpMul:HB_BOSS_HP, atkMul:HB_BOSS_ATK, spd:K.spd*HB_FOE_SPD_MUL*HB_BOSS_SPD*(1+S.round*0.01) }; }
// 맵 테두리에서 뚫린 칸 찾기 — 같은 방향(ca,sa) 쪽 가장자리부터 시계방향으로 훑는다
function hbEdgeSpawn(ca,sa){
  const R=HB_GRID_R, ring=[];
  for(let g=-R; g<R; g++){ ring.push([g,-R],[g,R-1],[-R,g],[R-1,g]); }
  let best=null, bd=-1e9;
  for(const c of ring){ if(!hbWalkable(hbTx(c[0]),hbTx(c[1]))) continue;
    const sc=(hbTx(c[0])*ca+hbTx(c[1])*sa);        // 요청 방향과 가장 잘 맞는 테두리 칸
    if(sc>bd){ bd=sc; best=c; } }
  return best? [hbTx(best[0]),hbTx(best[1])] : [0,0]; }
// 🚶 유닛 간 회피 조향 — **관리자/유즈맵 엔진(unitAI)과 같은 레시피**를 사냥터 좌표계로 옮긴 것.
//   반발만 주면 서로 밀며 뭉치고, 전방을 막은 놈은 영영 못 지나간다. 그래서 두 겹이다:
//     ① 반발  가까울수록 서로 밀어낸다
//     ② 접선  **진행 방향 앞을 막고 있을 때만** 옆으로 돌아간다(비켜 지나가는 움직임)
//   ⛔ 미로 경로탐색(hbFieldDir/hbSlide)을 대체하는 게 아니다 — 그 위에 얹는 보정이다.
//     벽·기지·미로는 그대로 두고, 유닛끼리 겹치는 것만 푼다.
const HB_AVOID_MUL=2.4;     // 회피 반경 = (내 반지름+상대 반지름) × 이 값 (엔진과 같은 계수)
const HB_AVOID_TAN=1.6;     // 접선(옆으로 비키기) 세기 — 엔진과 같은 값
const HB_AVOID_FWD=0.25;    // '내 앞을 막고 있다' 판정(진행 방향과의 내적)
function hbFoeR(f){ return 9*((f&&f.sz)||1); }              // 충돌 반지름 = 크기에 비례(중장갑은 넓게 자리를 차지)
function hbAvoid(f, dirx, diry){ const S=_hb; if(!S) return [dirx,diry];
  let sx=0, sy=0; const myR=hbFoeR(f);
  for(const o of S.foes){ if(o===f) continue;
    const ox=o.x-f.x, oy=o.y-f.y, od=Math.hypot(ox,oy);
    const aR=(myR+hbFoeR(o))*HB_AVOID_MUL;
    if(od<=0.01 || od>=aR) continue;
    const w=1-od/aR, nx=ox/od, ny=oy/od;
    sx-=nx*w; sy-=ny*w;                                       // ① 반발
    if(nx*dirx+ny*diry>HB_AVOID_FWD){                         // ② 앞을 막았을 때만 접선으로
      const tnx=-diry, tny=dirx, side=(tnx*ox+tny*oy)>=0?-1:1;
      sx+=tnx*side*w*HB_AVOID_TAN; sy+=tny*side*w*HB_AVOID_TAN; } }
  const mx=dirx+sx, my=diry+sy, ml=Math.hypot(mx,my)||1;
  return [mx/ml, my/ml]; }
function hbPlaceFoe(proto){ const S=_hb;
  const a=Math.random()*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a);
  const k=S.k||1;                                                        // 화면 경계를 월드 단위로 환산
  // 아래쪽은 스킬 바 높이만큼 더 밖에서 낸다 — 그러지 않으면 출현 순간 버튼 위에 겹쳐 보인다
  const half=(S.vBot-S.vTop)/2, mDown=24+(S.hideB||0);
  const hx=(S.w/2+24)/k, hy=Math.max(60,(half+(sa>0?mDown:24))/k);
  const R=1/Math.max(Math.abs(ca)/hx, Math.abs(sa)/hy);                  // 보이는 경계 바로 바깥
  const elite=!proto.boss && Math.random()<hbEliteChance(S.dg,S.round);   // 보스는 엘리트 굴림 제외
  const hp=hbFoeHp(S.dg,S.round,S.wave)*proto.hpMul*(elite?HB_ELITE_HP:1);
  // 필드가 넓어져 캐릭터가 원점을 떠난다 → 출현 위치도 캐릭터 기준(화면 경계 바깥)이어야 한다
  let sx=Math.max(-HB_FIELD_RX,Math.min(HB_FIELD_RX,(S.char.x||0)+ca*R));
  let sy=Math.max(-HB_FIELD_RY,Math.min(HB_FIELD_RY,(S.char.y||0)+sa*R));
  // ⚠ 기지 안에서 태어나면 벽이 통째로 무의미해진다(적이 성벽 안쪽에 그대로 나온다).
  //   기지가 차지한 사각 범위 안이면 같은 방향으로 그 바깥까지 밀어낸다.
  //   기지가 작을 땐 거의 그대로 → 초반 진행 속도가 안 바뀐다. 커질수록 자연히 바깥에서 온다.
  hbBlocked();
  // ✈️👻 공중·유령은 벽을 무시하므로 '기지 밖으로 밀어내기'와 '뚫린 칸 찾기'를 건너뛴다.
  //    지상 몹에게만 걸던 규칙을 이들에게도 걸면 엉뚱한 데서 태어난다(벽이 의미 없는 종류다).
  // ⚔ 토벌은 기지 자체가 없다(hbNoBase) — 같은 이유로 건너뛴다.
  const ghost=(proto.way==='air'||proto.way==='phase');
  const BX=(ghost||hbNoBase())?null:_hbBaseBox;
  if(BX && sx>BX.x0 && sx<BX.x1 && sy>BX.y0 && sy<BX.y1){
    for(let step=1; step<=HB_GRID_R*2; step++){ const nx=sx+ca*HB_TILE*step, ny=sy+sa*HB_TILE*step;
      sx=Math.max(-HB_FIELD_RX,Math.min(HB_FIELD_RX,nx)); sy=Math.max(-HB_FIELD_RY,Math.min(HB_FIELD_RY,ny));
      if(!(sx>BX.x0 && sx<BX.x1 && sy>BX.y0 && sy<BX.y1)) break;
      if(Math.abs(nx)>HB_FIELD_RX && Math.abs(ny)>HB_FIELD_RY) break; } }
  // 그래도 막힌 칸이면(건물 위) 뚫린 자리를 찾는다 — 마지막 수단은 맵 테두리
  if(!ghost && !hbWalkable(sx,sy)){ let ok=false;
    for(let step=1; step<=HB_GRID_R; step++){ const nx=sx+ca*HB_TILE*step, ny=sy+sa*HB_TILE*step;
      if(Math.abs(nx)>HB_FIELD_RX||Math.abs(ny)>HB_FIELD_RY) break;
      if(hbWalkable(nx,ny)){ sx=nx; sy=ny; ok=true; break; } }
    if(!ok){ const e=hbEdgeSpawn(ca,sa); sx=e[0]; sy=e[1]; } }
  S.foes.push({ kind:proto.kind||'grunt', ico:proto.ico, mdl:proto.mdl, x:sx, y:sy, hp:hp, hpMax:hp,
    elite:elite, boss:!!proto.boss,
    sz:(proto.sz||1)*(proto.boss?HB_BOSS_SCALE:(elite?HB_ELITE_SCALE:1)),
    rng:proto.rng||0, way:proto.way||'ground', rw:proto.rw||1,
    atk:hbFoeAtk(S.dg,S.round)*proto.atkMul*(elite?HB_ELITE_ATK:1),
    spd:proto.spd*(elite?0.85:1), cdT:Math.random()*0.6 }); }
function hbHud(){ const S=_hb; if(!S) return;
  // ⚠ HUD 는 **화면에 보이는 세션만** 그린다(스킬 바와 같은 규칙). 배경 세션이 만지면
  //   직접 토벌 중에 배경 사냥터가 hbSettle 을 지나면서 '던전 1 · 라운드 5'로 덮어쓴다(실제로 그랬다).
  if(S.bg) return;
  const c=(typeof CHAR==='function')?CHAR():null;
  const put=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  put('hbName', c? (c.name||'캐릭터') : '캐릭터');
  { const K=(c&&PROF_CLASSES[c.cls])||null;   // 직업 이름은 안 쓰지만 초상 아이콘은 여기서 온다
    const av=document.getElementById('hbAv'); if(av) av.textContent=(K&&K.ico)||'🧍'; }
  put('hbLv','Lv.'+(c?c.level:1));
  put('hbAtkN', fmtCur(S.char.atk));               // 검 글리프는 마크업에 고정 — 숫자만 갱신한다
  { const bar=document.getElementById('hbXpBar');                       // 다음 레벨까지
    if(bar && c && typeof profXpForLevel==='function'){ const need=profXpForLevel(c.level)||1;
      bar.style.width=Math.max(0,Math.min(100,(c.xp/need)*100))+'%'; } }
  put('hbWaveTx','웨이브 '+Math.min(S.wave,HB_WAVES)+'/'+HB_WAVES);
  // ⚔ 토벌(직접 전투)은 같은 자리에 **단계**를 쓴다. 라운드 ◀▶ 는 CSS(.dgFight)가 숨긴다 —
  //    토벌 도중에 단계를 갈아탈 수는 없다.
  if(S.mode==='dg'){ const d=(typeof dgDef==='function')?dgDef(S.dgId):null;
    put('hbDgName', (d?d.name:'토벌'));
    put('hbRoundLb','단계'); put('hbRound', String(S.floor));
    put('hbMode', S.auto?'자동':'직접'); return; }
  put('hbRoundLb','라운드');   // 토벌에서 돌아왔을 수 있다 — 라벨을 되돌린다
  // ⚔ 번호만으로는 이동한 느낌이 없다 → 던전 고유 이름을 같이 보여준다.
  //    '던전' 표기는 유지한다(자동사냥=던전 / 옛 콘텐츠=토벌 용어 분리 · 스모크가 검사)
  put('hbDgName','던전 '+S.dg+' · '+hbDun(S.dg).name);
  put('hbRound', String(S.round));                  // 숫자만 — 라벨('라운드')은 마크업에 고정
  { const best=hbBest(S.dg);                        // ◀▶ 는 갈 수 있는 쪽만 살린다
    const pv=document.getElementById('hbRdPrev'), nx=document.getElementById('hbRdNext');
    if(pv) pv.disabled=(S.round<=1);
    if(nx) nx.disabled=(S.round>=best); }
  put('hbMode', hbHunt().climb?'등반':'반복'); }   // 킬수 표시는 제거(요청)
function hbSettle(){ const S=_hb, p=PROF();
  // ⚔ 토벌: 마지막 웨이브를 비웠다 = **단계 클리어**. 사냥터 진행도(hbHunt)는 한 줄도 안 건드린다.
  if(S.mode==='dg'){ S.phase='done'; S.on=false; S.done=1; if(typeof dgHbWin==='function') dgHbWin(S); return; }
  hbNoteRate((S.buf.paid||0)+hbClearBonus(S.dg,S.round).min, Math.max(1,S.t-(S.rt0||0)));   // 방치 수입 기준 = 실제로 번 속도
  S.rt0=S.t;
  const bo=hbClearBonus(S.dg,S.round);        // 처치 보상은 이미 지급됨 — 여기서 주는 건 클리어 보너스뿐(사망 시 소실되는 몫)
  profGainCoin(bo.min); p.gas=(p.gas||0)+bo.gas;                   // 💠 미네랄 획득은 환생 배수를 탄다
  S.floats.push({x:S.char.x,y:S.char.y-32,tx:'ROUND CLEAR +'+fmtCur(bo.min)+'M',cl:'#ffd24a',t:0});
  if(typeof dqNote==='function') dqNote('round',1);   // 📅 일일 — 라운드 클리어
  S.buf={min:0,gas:0,xp:0,kills:0,paid:0};
  // 🎁 마일스톤 최초 클리어 보상 — 등반으로 라운드를 올리기 '전에' 지금 깬 라운드로 판정한다
  if(hbRwClaim(S.dg,S.round)){ const rw=hbRoundRw(S.dg,S.round);
    S.floats.push({x:S.char.x,y:S.char.y-52,tx:'🎁 라운드 '+S.round+' 보상 +'+fmtCur(rw.min)+'M',cl:'#5dff8f',t:0});
    if(typeof toast==='function') toast('🎁 던전 '+S.dg+' 라운드 '+S.round+' 최초 클리어 보상'+(rw.tk?' · 장비 뽑기권 +'+rw.tk:'')+(rw.atk?' · 동료 뽑기권 +'+rw.atk:'')+(rw.ptk?' · 펫 뽑기권 +'+rw.ptk:'')); }
  const H=hbHunt();
  H.best[S.dg]=Math.max(H.best[S.dg]||1, S.round);                // 최고 도달(라운드 선택 상한)
  // 🏁 99라운드를 깨면 자동으로 다음 던전 1라운드로. 곡선이 이어져 있어 세기는 한 칸 오른 것과 같다.
  //    ⚠ 반복(climb=false)에서는 넘기지 않는다 — 그 라운드를 계속 도는 게 반복의 정의다.
  if(H.climb){
    if(S.round>=HB_ROUND_MAX && S.dg<HB_DG_MAX) hbAdvanceDungeon();
    else if(S.round<HB_ROUND_MAX){ S.round++; H.round=S.round;
      H.best[S.dg]=Math.max(H.best[S.dg]||1, S.round); } }
  if(typeof updateCurBar==='function') updateCurBar(); if(typeof saveMeta==='function') saveMeta();
  S.wave=1; S.phase='clearWait'; S.gapT=2; hbHud(); }
// 🏁 다음 던전으로 — 자동 이동 전용. 수동 이동(hbGoDungeon)과 달리 라운드를 1로 놓는다.
//    ⚠ 던전이 바뀌면 바닥 패턴 캐시와 적 모델을 같이 갈아야 한다(안 하면 옛 던전 그림이 남는다).
function hbAdvanceDungeon(){ const S=_hb, H=hbHunt();
  const nd=Math.min(HB_DG_MAX, S.dg+1);
  H.best[S.dg]=Math.max(H.best[S.dg]||1, HB_ROUND_MAX);
  S.dg=nd; H.dg=nd; S.round=1; H.round=1;
  H.best[nd]=Math.max(H.best[nd]||1, 1);
  S._pat=null;                                   // 바닥 타일 패턴 캐시 무효화
  if(typeof hbEnsureModels==='function') hbEnsureModels(nd);
  // 🎁 던전 진입 보너스 — 곡선은 경계에서 매끄럽게 이어지지만(설계), 그러면 '올라섰다'는 순간이 없다.
  //    한 번뿐인 큰 덩어리로 그 순간을 만든다. ⚠ 최초 진입에만 준다(hunt.dgIn 기록).
  { const H2=hbHunt(); if(!H2.dgIn) H2.dgIn={};
    if(!H2.dgIn[nd]){ H2.dgIn[nd]=1;
      const b=hbClearBonus(nd,1), mn=b.min*HB_DG_ENTER, gs=b.gas*HB_DG_ENTER, p=PROF();
      if(typeof profGainCoin==='function') profGainCoin(mn); else p.pcoin=(p.pcoin||0)+mn;
      p.gas=(p.gas||0)+gs;
      const c2=(typeof CHAR==='function')?CHAR():null;
      if(c2 && typeof profGainXp==='function'){ profGainXp(c2, hbKillReward(nd,1).xp*HB_DG_ENTER);
        if(typeof profApplyLevelUps==='function') profApplyLevelUps(c2); }
      S.curDirty=true; _hbDirty=true;
      S.floats.push({x:S.char.x,y:S.char.y-84,tx:'🎁 진입 보너스 +'+fmtCur(mn)+'M',cl:'#ffd24a',t:0}); } }
  if(typeof toast==='function') toast('🏁 던전 '+(nd-1)+' 완주 — 던전 '+nd+' · '+hbDun(nd).name+' 진입');
  S.floats.push({x:S.char.x,y:S.char.y-64,tx:'🏁 던전 '+nd+' 진입',cl:'#7ad1ff',t:0}); }
function hbDie(){ const S=_hb;
  // ⚔ 토벌: 죽으면 **실패**다(라운드가 내려가는 게 아니다). 열쇠는 소모하지 않는다.
  if(S.mode==='dg'){ S.phase='done'; S.on=false; S.done=-1; S.foes.length=0; S.pend.length=0;
    if(typeof dgHbLose==='function') dgHbLose(S); return; }
  const H=hbHunt();
  S.buf={min:0,gas:0,xp:0,kills:0};                               // 클리어 보너스 몫 소실(처치 보상은 이미 받았다)
  S.foes.length=0; S.pend.length=0; S.fx=null; S.fxU=null;
  // ⭐ 라운드 하강 — 1 밑으로 내려가면 **이전 던전 마지막 라운드**로 물러난다(hbAdvanceDungeon 의 반대).
  //    ⛔ Math.max(1, …) 로만 막지 말 것: 자동 이동으로 올라간 던전 1라운드에서 약해지면
  //       내려올 길이 없어 영영 갇힌다(실측 — 환생 직후 던전3 1라운드에서 40시간을 헛돌았다).
  if(S.round>1) S.round--;
  else if(S.dg>1) hbRetreatDungeon();
  H.round=S.round; H.dg=S.dg;
  S.wave=1; S.phase='down'; S.downT=HB_DOWN_S;
  S.floats.push({x:S.char.x,y:S.char.y-32,tx:'쓰러짐… '+S.dg+'-'+S.round,cl:'#ff8a9a',t:0}); hbHud(); }
// 🔙 이전 던전으로 물러난다 — 자동 이동(hbAdvanceDungeon)과 대칭이다.
//    ⚠ 던전이 바뀌므로 바닥 패턴 캐시와 적 모델을 같이 갈아야 한다(올라갈 때와 같은 규칙).
function hbRetreatDungeon(){ const S=_hb, H=hbHunt();
  const nd=Math.max(1, S.dg-1);
  S.dg=nd; H.dg=nd; S.round=HB_ROUND_MAX; H.round=S.round;
  S._pat=null;
  if(S.chests) S.chests.length=0;
  if(typeof hbEnsureModels==='function') hbEnsureModels(nd);
  if(typeof toast==='function') toast('🔙 던전 '+nd+' · '+hbDun(nd).name+' 로 물러납니다'); }
// 웨이브 시간 초과 = 실패. 라운드는 그대로 두고 1웨이브부터 다시 — 죽는 것(hbDie)과 달리
// 라운드가 내려가지 않는다. 3초 뒤 캐릭터가 가운데에서 최대 체력으로 다시 선다.
function hbWaveFail(){ const S=_hb; if(!S) return;
  S.buf={min:0,gas:0,xp:0,kills:0};                                // 클리어 보너스 몫 소실(처치 보상은 이미 받았다)
  S.foes.length=0; S.pend.length=0; S.fx=null; S.fxU=null;
  if(S.chests) S.chests.length=0;
  S.phase='fail'; S.failT=HB_FAIL_S;
  S.floats.push({x:S.char.x, y:S.char.y-32, tx:'시간 초과 — 1웨이브부터', cl:'#ff8a9a', t:0});
  hbHud(); }
// ══ ⚔ 캐릭터 사격 — 치명/슈퍼치명/흡혈/넉백/멀티샷/바운스샷이 전부 이 세 함수를 지난다 ══════════
//   ⛔ hbStep 안에 피해식을 다시 적지 말 것. 예전에 '치명타'만 인라인으로 있어서
//      새 효과를 넣을 자리가 없었고, 카드에만 있고 안 걸린 업그레이드가 17종이나 쌓였다.
// 반경 r 안에서 skip 에 없는 가까운 적을 n체까지 골라 out 에 담는다(멀티샷·바운스 공용).
function hbNearFoes(x,y,r,n,skip,out){ const S=_hb, cand=[];
  for(const f of S.foes){ if(f.hp<=0 || skip.indexOf(f)>=0) continue;
    const d=Math.hypot(f.x-x,f.y-y); if(d<=r) cand.push([d,f]); }
  cand.sort(function(a,b){ return a[0]-b[0]; });
  for(let i=0;i<n && i<cand.length;i++) out.push(cand[i][1]);
  return out; }
// 표적 1체 타격. mul = 부가 표적 감쇠(주 표적은 1).
function hbCharHit(t, mul){ const S=_hb, c=S.char;
  // 슈퍼 치명 = 치명타 위 등급. 둘이 겹쳐 곱해지면 배수가 폭주하므로 먼저 굴려 갈라 놓는다.
  const sup=(c.scritC>0) && Math.random()<c.scritC;
  const crit=!sup && Math.random()<c.crit;
  const k=sup ? (c.scritM||3) : (crit ? (c.critDmg||HB_CRIT_DMG) : 1);
  const dmg=c.atk*k*(mul||1)*(hbBoostOn('atk')?2:1);
  t.hp-=dmg;
  hbFire(c.x,c.y-10, t.x,t.y, hbCharMdl(), FX.REF, hbIsAir(t.mdl));
  S.floats.push({x:t.x,y:t.y-20,tx:(sup?'★':(crit?'✦':''))+fmtCur(dmg),
                 cl:sup?'#ff6bd6':(crit?'#ffd24a':'#ececec'),t:0});
  if(c.lifest>0 && c.hp<c.hpMax){                                   // 🩸 생명력 흡수 — 준 피해의 %
    const g=Math.min(c.hpMax-c.hp, dmg*c.lifest); c.hp+=g;
    if(g>=1) S.floats.push({x:c.x,y:c.y-40,tx:'+'+fmtCur(g),cl:'#5dff8f',t:0}); }
  if(t.hp>0 && c.knock>0 && Math.random()<c.knock){                 // 💥 넉백 — 캐릭터 반대쪽으로
    const dx=t.x-c.x, dy=t.y-c.y, d=Math.hypot(dx,dy)||1;
    hbSlide(t, dx/d*HB_KNOCK_PX, dy/d*HB_KNOCK_PX); }
  if(t.hp<=0) hbKill(t); }
// 1회 사격 전체 — 주 표적 + 멀티샷 + 바운스샷
function hbCharShot(primary){ const S=_hb, c=S.char;
  const hit=[primary], mul=[1];
  const extra=Math.max(0,(c.multiN||1)-1);                          // 🔱 멀티샷 — '수'는 총 표적 수라 1을 뺀다
  if(extra>0 && c.multiC>0 && Math.random()<c.multiC){
    const n0=hit.length; hbNearFoes(c.x,c.y,c.range,extra,hit,hit);
    for(let i=n0;i<hit.length;i++) mul.push(HB_MULTI_MUL); }
  if((c.bncN||0)>0 && c.bncC>0 && Math.random()<c.bncC){            // ↩ 바운스샷 — 맞은 적 주변으로 튕긴다
    const n0=hit.length; hbNearFoes(primary.x,primary.y,HB_BOUNCE_R,c.bncN,hit,hit);
    for(let i=n0;i<hit.length;i++) mul.push(HB_BOUNCE_MUL); }
  for(let i=0;i<hit.length;i++){ const t=hit[i];
    if(t.hp<=0) continue;                                           // 앞 표적의 넉백·처치로 이미 빠졌을 수 있다
    hbCharHit(t, mul[i]); } }
// 캐릭터 피격 — 🛡 실드가 먼저 닳고 남은 만큼만 체력에 들어간다(적·상자·모든 출처 공용)
function hbCharTake(dmg){ const S=_hb, c=S.char; c.hitT=0;
  if(c.shd>0){ const a=Math.min(c.shd,dmg); c.shd-=a; dmg-=a;
    S.floats.push({x:c.x,y:c.y-34,tx:'-'+fmtCur(a),cl:'#7fd0ff',t:0}); }
  if(dmg>0){ c.hp-=dmg; S.floats.push({x:c.x,y:c.y-26,tx:'-'+fmtCur(dmg),cl:'#ff8a9a',t:0}); } }
// 🌊 웨이브를 비울 때마다 나오는 재화 — 업그레이드(mw/gw)로만 생긴다(0레벨이면 0).
//    던전 배수를 같이 받아야 상위 던전에서도 의미가 남는다(처치 보상과 같은 규칙).
function hbWaveReward(){ const S=_hb;
  if(S.mode==='dg') return;   // ⚔ 토벌은 웨이브 재화가 없다 — 보상은 단계 클리어 때 한 번(dgFloorReward)
  const mn=hbUpgNum('mw'), gs=hbUpgNum('gw'); if(mn<=0 && gs<=0) return;
  const m=HB_DG_REW(S.dg)*(hbBoostOn('inc')?2:1), p=PROF();
  p.pcoin=(p.pcoin||0)+mn*m; p.gas=(p.gas||0)+gs*m;
  S.buf.paid=(S.buf.paid||0)+mn*m; S.curDirty=true; _hbDirty=true;
  S.floats.push({x:S.char.x,y:S.char.y-44,tx:'웨이브 +'+fmtCur(mn*m)+'M',cl:'#ffd24a',t:0}); }
// 순수 시뮬 한 스텝 — rAF와 분리(스모크가 직접 부른다). phase: fight/gap/fail/clearWait/down
// 탭한 곳으로 걸어간다 + 중앙 회복 구역. 적은 이미 캐릭터를 쫓으므로 전투는 알아서 따라온다.
// ═══ 🎥 가장자리 끌기 — 건물 고스트를 화면 끝으로 끌면 카메라가 그쪽으로 따라간다 ═══
// 한 손가락만으로 맵을 넓게 쓰게 해 준다. HOME 사냥터와 관리자 건설 화면이 **같은 함수**를 쓴다.
// 반환 = -1..1 방향 세기(가장자리에 가까울수록 ±1, 안쪽이면 0).
const EDGE_PAD=0.16, EDGE_SPD=0.9;   // 감지 폭(화면 비율) · 초당 이동(보이는 화면의 배수)
function edgePush(fx,fy){
  const f=(v)=>{ if(v<EDGE_PAD) return -(1-Math.max(0,v)/EDGE_PAD);
                 if(v>1-EDGE_PAD) return (1-Math.max(0,1-v)/EDGE_PAD); return 0; };
  return { x:f(fx), y:f(fy) }; }
function hbClampField(x,y){ return [ Math.max(-HB_FIELD_RX,Math.min(HB_FIELD_RX,x)),
                                     Math.max(-HB_FIELD_RY,Math.min(HB_FIELD_RY,y)) ]; }
function hbWalk(S,c,dt){
  if(c.tx!=null){ const dx=c.tx-c.x, dy=c.ty-c.y, d=Math.hypot(dx,dy);
    if(d>2){ const sp=Math.min(d, HB_MOVE_SPD*(c.mspd||1)*dt);   // 🏃 이동속도 업그레이드
      // 목적지까지 벽을 돌아서 간다 — 거리장은 목적지 칸이 바뀔 때만 다시 굽는다
      let ux=dx/d, uy=dy/d;
      if(!hbLineClear(c.x,c.y,c.tx,c.ty)){                    // 가리는 게 있을 때만 길을 굽는다
        const key=hbGx(c.tx)+','+hbGx(c.ty);
        if(S._chAt!==key || S._chSeq!==_hbBlkSeq){ S._chAt=key; S._chSeq=_hbBlkSeq; S._chF=hbBakeField(hbGx(c.tx),hbGx(c.ty)); }
        const f=hbFieldDir(S._chF, c.x, c.y); if(f){ ux=f[0]; uy=f[1]; } }
      hbSlide(c, ux*sp, uy*sp);
      c.mv=1; S.charFace=Math.atan2(ux,uy); } else c.mv=0; }
  { const p=hbClampField(c.x,c.y); c.x=p[0]; c.y=p[1]; }   // 위치 자체를 가둔다 — 목적지만 걸러서는 보장이 안 된다
  // ⚔ 토벌에는 회복 구역이 없다 — 있으면 원점에서 카이팅하며 무한히 버틸 수 있어 단계 난이도가 무의미해진다
  if(c.hp>0 && c.hp<c.hpMax && !hbNoBase() && Math.hypot(c.x,c.y)<=hbHealR()){   // 회복 구역 — 조건 없음
    c.hp=Math.min(c.hpMax, c.hp + c.hpMax*HB_HEAL_PCT*dt); c.healFx=1; } else c.healFx=0; }
function hbSetDest(sx,sy){ const S=_hb; if(!S||!S.on) return;
  const p=hbClampField((sx-S.cx)/S.k, (sy-S.cy)/S.k);
  S.char.tx=p[0]; S.char.ty=p[1]; }
// ── 필드 포인터 — 관리자 건설 화면과 같은 방식 ──────────────────────────────
// 누른 즉시 그 자리로 이동하고, **손가락을 떼기 전까지 계속 따라온다**(techPtrDown/Move의 _btCmd와 동일).
// 탭만 받으면 연속으로 찍을 때 명령이 씹히는 느낌이 나고, preventDefault가 없으면 드래그가
// 브라우저 스크롤로 새어 화면 자체가 끌려간다 — 관리자 맵(.bmap)은 touch-action:none + preventDefault로 막는다.
// ⛔ 대상 판정은 화이트리스트다(블랙리스트로 두면 새 UI마다 이동으로 샌다).
//   ⚠ 단, click-through 레이어(.curBar.bare 등)가 위에 있으면 대상이 #homeScreen이 되어 통과한다 — 그쪽 CSS를 볼 것.
let _hbPtr=null;
function hbFieldEl(e){
  if(!_hb||!_hb.on||_hb.bg) return null;
  const hs=document.getElementById('homeScreen'); if(!hs||hs.classList.contains('hide')) return null;
  const cv=document.getElementById('hbCv');
  // ⚠ #hmScroll이 남은 세로 공간을 전부 차지하므로 '보이는 전장'의 대부분은 그 위다 — 여기도 필드로 친다.
  const sc=document.getElementById('hmScroll');
  if(e.target!==hs && e.target!==cv && e.target!==sc) return null;
  return cv; }
function hbFieldTap(e){ const cv=hbFieldEl(e); if(!cv) return;
  if(e.cancelable && e.preventDefault) e.preventDefault();      // 브라우저가 화면을 끌고 가지 않게
  const r=cv.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  if(_hb.arm){ _hbPtr={id:e.pointerId, arm:true, px:px, py:py}; hbArmTo(px,py); return; }   // 🧱 배치 중이면 고스트가 손가락을 따라온다
  if(hbTapStruct(px,py)) return;                                // 🪖 벙커를 눌렀으면 이동이 아니라 벙커 창
  _hbPtr={id:e.pointerId, arm:false}; hbSetDest(px,py); }
function hbFieldMove(e){ const P=_hbPtr; if(!P || e.pointerId!==P.id) return;
  if(!_hb||!_hb.on||_hb.bg){ _hbPtr=null; return; }
  const cv=document.getElementById('hbCv'); if(!cv) return;
  if(e.cancelable && e.preventDefault) e.preventDefault();
  const r=cv.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  if(P.arm){ if(_hb.arm){ P.px=px; P.py=py; hbArmTo(px,py); } else _hbPtr=null; return; }
  hbSetDest(px,py); }                                            // 지정 유닛이 손가락을 따라 이동
function hbFieldUp(e){ if(_hbPtr && e.pointerId===_hbPtr.id) _hbPtr=null; }
// 고스트를 화면 가장자리로 끌고 있으면 건설 카메라를 그쪽으로 민다(매 프레임)
let _hbEdgeT=0;
function hbEdgePan(){ const S=_hb, P=_hbPtr;
  const now=performance.now(), dt=Math.min(0.05,(now-(_hbEdgeT||now))/1000); _hbEdgeT=now;
  if(!S||!S.build||!S.bcam||!P||!P.arm||!S.arm) return;
  const cv=document.getElementById('hbCv'); if(!cv) return;
  const r=cv.getBoundingClientRect(); if(!r.width||!r.height) return;
  // 세로는 '보이는 전장'(재화 바 아래 ~ 스킬 바 위)을 기준으로 본다 — 캔버스 전체로 재면 위아래가 안 먹는다
  const vy0=S.vTop||0, vy1=S.vBot||r.height, vh=Math.max(1,vy1-vy0);
  const e=edgePush(P.px/r.width, (P.py-vy0)/vh);
  if(!e.x && !e.y) return;
  const k=S.k||1, spanX=(r.width/k), spanY=(vh/k);
  S.bcam.x=Math.max(-HB_MAP_R, Math.min(HB_MAP_R, S.bcam.x + e.x*EDGE_SPD*spanX*dt));
  S.bcam.y=Math.max(-HB_MAP_R, Math.min(HB_MAP_R, S.bcam.y + e.y*EDGE_SPD*spanY*dt));
  hbResize(); hbArmTo(P.px, P.py); }                 // 카메라를 옮긴 뒤 고스트를 손가락 자리에 다시 맞춘다
// 구조물을 눌렀나 — 지금은 벙커만 창이 열린다(나머지는 그냥 통과시켜 이동으로 처리)
function hbTapStruct(sx,sy){ const S=_hb; if(!S) return false;
  const q=hbCellOwner(hbGx((sx-S.cx)/S.k), hbGx((sy-S.cy)/S.k));
  if(!q) return false;
  const t=hbBase().tiles[q]; if(!t||t.k!=='bunker') return false;
  hbOpenBunker(q); return true; }
// ── 🪖 벙커 창 ──────────────────────────────────────────────────────────────
let _hbBunkerQ=null;
function hbOpenBunker(q){ _hbBunkerQ=q; const el=document.getElementById('hbBunkerModal'); if(!el) return;
  el.classList.remove('hide'); renderBunkerModal(); if(typeof playSfx==='function') playSfx('ui_open'); }
function hbCloseBunker(){ _hbBunkerQ=null; const el=document.getElementById('hbBunkerModal'); if(el) el.classList.add('hide'); }
function renderBunkerModal(){ const box=document.getElementById('hbBunkerBody'); if(!box) return;
  const t=_hbBunkerQ && hbBase().tiles[_hbBunkerQ];
  if(!t||t.k!=='bunker'){ box.innerHTML='<div class="hbRoundNote">벙커가 없습니다.</div>'; return; }
  const n=hbBunkerN(t), inb=hbBunkerMates(t), party=hbParty();
  const st=hbCharStats(), bm=hbBunkerAtkMul(), M=hbAllyMul();
  const per=Math.round(st.atk*HB_BUNKER_UNIT_DPS*bm);                  // 구매 유닛 1기의 한 발 피해
  const dmg=(id)=>Math.round(st.atk*hbMateDps(id)*M.ally.mul*bm);      // 이 벙커에서 이 동료가 내는 한 발 피해
  // 칸 표시 = 유닛 4 + 동료 1(마지막 칸, 파랗게 구분)
  let slots=''; for(let i=0;i<HB_BUNKER_SLOTS;i++) slots+='<span class="hbSlot'+(i<n?' on':'')+'">🪖</span>';
  { const id=inb[0], MT=id&&HB_MATES[id];
    slots+='<span class="hbSlot mate'+(MT?' on':'')+'"'+(MT?' title="'+MT.name+'"':' title="동료 자리"')+'>'+(MT?MT.ico:'🤝')+'</span>'; }
  let h='<div class="hbSlots">'+slots+'</div>';
  let tot=per*n; for(const id of inb) tot+=dmg(id);
  h+='<div class="hbRoundNote">유닛 <b>'+n+'/'+HB_BUNKER_SLOTS+'</b> · 동료 <b>'+inb.length+'/'+HB_BUNKER_MATE_SLOTS+'</b> · 합계 <b>'+tot+'</b> 피해 · 벙커 공격력 <b>'+Math.round(bm*100)+'%</b>'
    +' <button class="hbRowBtn" style="margin-left:6px" onclick="hbCloseBunker();hmUpgTab(&#39;bld&#39;)">건물 업그레이드</button></div>';
  // ① 유닛 구매 — 벙커마다 개별(비용은 이 벙커의 보유 수 기준)
  { const full=n>=HB_BUNKER_SLOTS, cost=hbBunkerUnitCost(n), coin=Math.floor(PROF().pcoin||0);
    h+='<div class="hbRow"><span class="hbRowIco">🪖</span>'
      +'<span class="hbRowTx"><b>주둔 유닛 <i>'+n+'/'+HB_BUNKER_SLOTS+'</i></b>'
      +'<em>1기당 '+per+' 피해 · 합계 '+(per*n)+'</em></span>'
      +'<button class="hbRowBtn" onclick="hbBunkerAdd()"'+((full||coin<cost)?' disabled':'')+'>'
      +(full?'가득':fmtCur(cost)+' 미네랄')+'</button></div>'; }
  // ② 동료 지정 — 출전 동료 전원. 이 벙커에 넣기/빼기, 다른 벙커에 있으면 이리로 옮기기
  if(!party.length) h+='<div class="hbRoundNote">출전한 동료가 없습니다 — <b>정비 · 동료</b>에서 출전시키면 여기 넣을 수 있습니다.</div>';
  for(const id of party){ const MT=HB_MATES[id], q2=hbMateBunkerQ(id);
    const here=(q2===_hbBunkerQ), elsewhere=(q2 && !here), full=inb.length>=HB_BUNKER_MATE_SLOTS;
    h+='<div class="hbRow"><span class="hbRowIco">'+MT.ico+'</span>'
      +'<span class="hbRowTx"><b>'+MT.name+' <i>Lv.'+hbMateLv(id)+'</i></b>'
      +'<em>'+(here?('주둔 중 · '+dmg(id)+' 피해'):elsewhere?'다른 벙커에 주둔 중':('내 주위 · 넣으면 '+dmg(id)+' 피해'))+'</em></span>'
      +'<button class="hbRowBtn" onclick="hbBunkerAssign(&#39;'+id+'&#39;)"'+((!here&&full)?' disabled':'')+'>'
      +(here?'빼기':elsewhere?'이리로':full?'가득':'넣기')+'</button></div>'; }
  box.innerHTML=h; }
// 유닛 구매 — 이 벙커에 1기 추가(벙커별 개별 비용)
function hbBunkerAdd(){ const t=_hbBunkerQ && hbBase().tiles[_hbBunkerQ]; if(!t||t.k!=='bunker') return;
  const n=hbBunkerN(t); if(n>=HB_BUNKER_SLOTS) return;
  const p=PROF(), cost=hbBunkerUnitCost(n);
  if(Math.floor(p.pcoin||0)<cost){ hmToast('미네랄이 부족합니다'); return; }
  p.pcoin-=cost; t.n=n+1; saveMeta(); hbLayoutBase();
  if(typeof playSfx==='function') playSfx('ui_open');
  if(typeof updateCurBar==='function') updateCurBar();
  renderBunkerModal(); }
// 동료 지정 토글 — 여기 있으면 빼고, 다른 벙커에 있으면 옮겨 오고, 밖에 있으면 넣는다. 저장은 타일에.
function hbBunkerAssign(id){ const t=_hbBunkerQ && hbBase().tiles[_hbBunkerQ]; if(!t||t.k!=='bunker') return;
  if(hbParty().indexOf(id)<0) return;
  const q2=hbMateBunkerQ(id);
  if(q2===_hbBunkerQ){ t.m=(t.m||[]).filter(x=>x!==id); }              // 빼기 → 다시 내 주위를 돈다
  else {
    if(hbBunkerMates(t).length>=HB_BUNKER_MATE_SLOTS) return;          // 동료 자리는 1칸
    if(q2){ const o=hbBase().tiles[q2]; if(o) o.m=(o.m||[]).filter(x=>x!==id); }   // 다른 벙커에서 빼서
    (t.m||(t.m=[])).push(id); }                                        // 이 벙커로
  saveMeta(); hbLayoutBase();
  if(typeof playSfx==='function') playSfx('ui_open');
  renderBunkerModal(); }
document.addEventListener('pointerdown', hbFieldTap, true);   // 리스너 위치는 document 그대로(로드 순서 무관) — 거르는 것은 위의 대상 검사다
document.addEventListener('pointermove', hbFieldMove, true);
document.addEventListener('pointerup', hbFieldUp, true);
document.addEventListener('pointercancel', hbFieldUp, true);
// ═══ 🧱 배치 흐름 — 고스트를 옮기고 ▶로 확정한다 ═════════════════════════════
// ⛔ 관리자 건설(techPtrDown/G.tech)을 부르지 않는다 — HOME은 유즈맵 전역 G를 참조하면 안 된다.
//    공용으로 쓰는 것은 확정/취소 버튼(.bArmBtns)뿐이고, 나머지는 여기 전용이다.
// ── 🛠 건설 모드 = 라운드 정지 ──────────────────────────────────────────────
// 짓는 동안 적이 몰려오면 자리를 볼 수가 없다. 그래서 배치를 시작하면 라운드를 '시작 직전'으로
// 되돌리고 시계를 멈춘다. 나가면(오른쪽 위 ⊘ 또는 ✕) 1웨이브부터 새로 시작한다.
function hbBuildEnter(){ const S=_hb; if(!S||S.build) return;
  S.build=true;
  S.foes.length=0; S.pend.length=0; S.fx=null; S.fxU=null;
  if(S.chests) S.chests.length=0;
  S.wave=1; S.phase='fight'; S.waveT=hbWaveTime(1); S.buf={min:0,gas:0,xp:0,kills:0};
  S.char.tx=null; S.char.ty=null; S.char.mv=0;      // 캐릭터도 멈춘다
  S.bcam={ x:S.char.x, y:S.char.y };                // 건설 카메라는 캐릭터 자리에서 시작
  hbHud(); }
function hbBuildExit(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation();
  const S=_hb; if(!S) return;                        // ⚠ _hb 없이 부르면 hbSpawnWave가 터진다
  const was=S.build;
  S.arm=null; S.build=false; S.bcam=null;                         // ⚠ 상태를 먼저 끄고 나서 버튼을 다시 그린다(순서를 바꾸면 ⊘가 남는다)
  hbArmBtns();
  if(was){ S.wave=1; S.phase='fight'; hbSpawnWave(); }
  if(typeof playSfx==='function') playSfx('ui_close');
  hbHud(); renderHome(); }   // 하단 패널을 업그레이드로 되돌린다
function hbArmStart(k,gx,gy){ if(!_hb) return;
  hbBuildEnter();
  _hb.arm={ k:k, gx:gx, gy:gy, dir:[1,0], last:null };   // dir = 연속 배치가 나아가는 방향(기본 오른쪽)
  hbArmBtns(); }
function hbArmCancel(ev){ return hbBuildExit(ev); }      // ✕ = 건설 종료(오른쪽 위 ⊘와 같은 동작)
// 다음 자리 — 직전 두 배치가 만든 방향으로 이어간다. 막힌 칸은 그 방향으로 계속 건너뛴다.
function hbArmAdvance(){ const S=_hb, A=S&&S.arm; if(!A) return; const B=HB_STRUCT[A.k]||{w:1,h:1};
  if(A.last){ const dx=Math.sign(A.gx-A.last.gx), dy=Math.sign(A.gy-A.last.gy);
    if(dx||dy) A.dir=[dx,dy]; }                          // 고스트를 무시하고 다른 칸에 놓으면 그게 새 방향
  A.last={gx:A.gx, gy:A.gy};
  const step=(d)=>{ if(!d[0]&&!d[1]) return null; let x=A.gx, y=A.gy;
    for(let i=0;i<HB_GRID_R*2;i++){ x+=d[0]*B.w; y+=d[1]*B.h;
      if(!hbInGrid(x)||!hbInGrid(y)) return null;        // 맵 밖 = 이 방향은 끝
      if(hbCanPlace(A.k,x,y) && !hbSealCheck(A.k,x,y)) return [x,y]; }
    return null; };
  const hit = step(A.dir) || step([0,1]) || step([1,0]) || step([0,-1]) || step([-1,0]);
  if(hit){ A.gx=hit[0]; A.gy=hit[1]; }
  else { const f=hbFreeCell(A.k); if(f){ A.gx=f[0]; A.gy=f[1]; A.last=null; } } }
function hbArmTo(sx,sy){ const S=_hb, A=S&&S.arm; if(!A) return;
  const B=HB_STRUCT[A.k]||{w:1,h:1};
  A.gx=Math.max(-HB_GRID_R, Math.min(HB_GRID_R-B.w, hbGx((sx-S.cx)/S.k)-((B.w-1)>>1)));
  A.gy=Math.max(-HB_GRID_R, Math.min(HB_GRID_R-B.h, hbGx((sy-S.cy)/S.k)-((B.h-1)>>1)));
  hbArmBtns(); }
// 배치 가능 판정 — 겹침·범위·해금(hbCanPlace) + 봉쇄 금지(hbSealCheck)
function hbArmOk(){ const A=_hb&&_hb.arm; if(!A) return false;
  return hbCanPlace(A.k,A.gx,A.gy) && !hbSealCheck(A.k,A.gx,A.gy); }
function hbArmConfirm(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation();
  const A=_hb&&_hb.arm; if(!A) return;
  if(hbSealCheck(A.k,A.gx,A.gy)){ hmToast('길이 완전히 막힙니다'); return; }   // 자원은 깎지 않는다
  if(!hbPlaceStruct(A.k,A.gx,A.gy)){ hmToast('여기엔 지을 수 없습니다'); return; }
  if(typeof playSfx==='function') playSfx('ui_open');
  // 연속 배치 — 나갈 때까지 계속 짓는다. 더 못 사면 그때 건설을 끝낸다.
  if(hbStructN(A.k)>=hbBuildMax(A.k)){ hmToast(HB_STRUCT[A.k].name+' 최대치'); hbBuildExit(); }
  else if(Math.floor(PROF().pcoin||0)<hbBuildCost(A.k)){ hmToast('미네랄이 부족합니다'); hbBuildExit(); }
  else hbArmAdvance();
  hbArmBtns(); renderHome(); }
// ▶확정 / ✕취소 — 공용 .bArmBtns를 재사용한다(CLAUDE.md 레지스트리). 위치는 고스트 아래 중앙.
// ▶확정 / ✕취소 — 공용 .bArmBtns 재사용.
// ⚠ **한 번만 만들고 그 뒤엔 위치·상태만 바꾼다.** 예전엔 매 호출마다 innerHTML을 새로 썼는데,
//   이 함수는 드래그하는 동안(hbArmTo)과 매 프레임(hbFrame) 둘 다에서 불린다 → 초당 수십 번 DOM이
//   갈려서 ▶를 누르는 순간 눌린 요소가 사라지고 클릭이 씹혔다.
const HB_ARM_HTML='<div class="bArmBtns" onpointerdown="event.stopPropagation()">'
  +'<button class="bArmBtn ok" onclick="hbArmConfirm(event)" title="확정">'
  +'<svg viewBox="0 0 24 24" width="15" height="15" style="display:block"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>'
  +'<button class="bArmBtn cancel" onclick="hbArmCancel(event)" title="취소">✕</button></div>';
function hbArmBtns(){ const host=document.getElementById('hbArmBtns');
  { const st=document.getElementById('hbBuildStop');   // ⊘ 건설 종료 — 건설 중에만 보인다
    if(st) st.classList.toggle('hide', !(_hb&&_hb.build)); }
  if(!host) return;
  const S=_hb, A=S&&S.arm;
  if(!A){ host.classList.add('hide'); return; }        // 지우지 않는다 — 다시 켤 때 그대로 쓴다
  if(!host.firstChild) host.innerHTML=HB_ARM_HTML;     // 최초 1회만 생성
  const B=HB_STRUCT[A.k]||{w:1,h:1};
  const wx=hbTx(A.gx)+(B.w-1)*HB_TILE/2, wy=hbTx(A.gy)+(B.h-1)*HB_TILE/2+B.h*HB_TILE/2;
  host.classList.remove('hide');
  host.style.left=(S.cx+wx*S.k)+'px'; host.style.top=(S.cy+wy*S.k)+'px';
  const okBtn=host.querySelector('.bArmBtn.ok');
  if(okBtn) okBtn.classList.toggle('dis', !hbArmOk()); }
// ═══ 봉쇄 금지 — 이 배치가 어딘가를 가둬 버리는가? ═══════════════════════════
// 맵 테두리에서 flood fill 해서, 막히지 않은 칸 중 도달 못 하는 칸이 하나라도 생기면 true.
// 벽을 통과 불가로 둘 수 있는 근거가 이 검사다 — 적이 영원히 못 들어오는 상황이 만들어지지 않는다.
function hbSealCheck(k,gx,gy){
  const N=HB_GRID_R*2, blocked=new Uint8Array(N*N);
  const at=(gx,gy)=>(gy+HB_GRID_R)*N+(gx+HB_GRID_R);
  const T=hbBase().tiles;
  const mark=(k2,bx,by)=>{ const B=HB_STRUCT[k2]; if(!B) return;
    for(let dy=0;dy<B.h;dy++) for(let dx=0;dx<B.w;dx++){
      const x=bx+dx, y=by+dy; if(hbInGrid(x)&&hbInGrid(y)) blocked[at(x,y)]=1; } };
  for(const q in T){ const p=q.split(','); mark(T[q].k, +p[0], +p[1]); }
  if(k) mark(k,gx,gy);                                   // 놓았다고 가정
  // 테두리의 열린 칸에서 BFS
  const seen=new Uint8Array(N*N), qq=new Int32Array(N*N); let h=0,t2=0;
  const push=(x,y)=>{ if(!hbInGrid(x)||!hbInGrid(y)) return; const i=at(x,y);
    if(seen[i]||blocked[i]) return; seen[i]=1; qq[t2++]=i; };
  for(let g=-HB_GRID_R; g<HB_GRID_R; g++){ push(g,-HB_GRID_R); push(g,HB_GRID_R-1); push(-HB_GRID_R,g); push(HB_GRID_R-1,g); }
  while(h<t2){ const i=qq[h++], x=(i%N)-HB_GRID_R, y=((i/N)|0)-HB_GRID_R;
    push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1); }
  for(let i=0;i<N*N;i++) if(!blocked[i] && !seen[i]) return true;   // 갇힌 빈칸이 있다
  return false; }
// 벙커로 향하는 거리장 — 도발된 적만 쓴다. 벙커는 안 움직이므로 격자가 바뀔 때만 다시 굽는다.
function hbBunkerField(bk){ if(!bk) return null;
  const key=hbGx(bk.x)+','+hbGx(bk.y);
  if(bk._fKey!==key || bk._fDirty!==_hbBlkSeq){ bk._fKey=key; bk._fDirty=_hbBlkSeq; bk._f=hbBakeField(hbGx(bk.x),hbGx(bk.y)); }
  return bk._f; }
function hbStep(dt){ const S=_hb; if(!S) return; const c=S.char;
  if(S.build){ hbFx(dt); return; }   // 🛠 건설 중 = 시계도 전투도 멈춘다(이펙트만 사그라들게 둔다)
  S.t+=dt;
  // 📅 일일 — 사냥터 플레이타임(초). 건설 중은 위에서 빠지므로 '실제로 돈 시간'만 쌓인다.
  if(S.mode!=='dg'){ S.dqT=(S.dqT||0)+dt; if(S.dqT>=1){ const w=Math.floor(S.dqT); S.dqT-=w;
      if(typeof dqNote==='function') dqNote('play',w); } }   // 사냥터 플레이타임 — 토벌 시간은 안 센다
  // 적이 따라올 길 — 캐릭터가 다른 칸으로 넘어갔을 때만 다시 굽는다(900칸 BFS는 1ms 미만)
  { const key=hbGx(c.x)+','+hbGx(c.y);
    if(S._foeAt!==key || S._blkSeq!==_hbBlkSeq){ S._foeAt=key; S._blkSeq=_hbBlkSeq; S.foeF=hbBakeField(hbGx(c.x),hbGx(c.y)); } }
  if(S.phase!=='down') hbWalk(S,c,dt);
  if(S.phase==='down'){ S.downT-=dt;
    if(S.downT<=0){ c.hp=c.hpMax; c.shd=c.shdMax||0; c.hitT=9; S.phase='fight'; S.wave=1; hbSpawnWave(); }
    hbFx(dt); return; }
  if(S.phase==='fight'){
    if(S.pend.length){ S.pendT-=dt;                               // 분산 출현(5초에 걸쳐)
      if(S.pendT<=0){ hbPlaceFoe(S.pend.shift()); S.pendT=HB_SPREAD_S/Math.max(1,hbFoeCount(S.round,S.wave)); } }
    S.waveT-=dt;
    const emptied=(!S.foes.length && !S.pend.length);
    if(emptied){
      hbWaveReward();                                              // 🌊 웨이브 재화(mw/gw) — 마지막 웨이브도 받는다
      if(S.wave<HB_WAVES){ S.phase='gap'; S.gapT=HB_GAP_S; }      // 다 잡으면 3초 뒤 다음 웨이브
      else hbSettle(); }                                           // 마지막 웨이브 + 필드 0 = 라운드 클리어
    else if(S.waveT<=0) hbWaveFail(); }                            // 시간 안에 못 비우면 실패
  else if(S.phase==='gap'){ S.gapT-=dt; if(S.gapT<=0){ S.wave++; S.phase='fight'; hbSpawnWave(); } }
  else if(S.phase==='clearWait'){ S.gapT-=dt; if(S.gapT<=0){ S.phase='fight'; hbSpawnWave(); } }
  else if(S.phase==='fail'){ S.failT-=dt;
    if(S.failT<=0){ const c2=S.char;
      c2.x=0; c2.y=0; c2.tx=0; c2.ty=0; c2.mv=0;                   // 가운데(회복 구역)에서 다시
      c2.hp=c2.hpMax; c2.shd=c2.shdMax||0; c2.hitT=9;
      S.wave=1; S.phase='fight'; hbSpawnWave(); hbHud(); } }
  else if(S.phase==='mop'){ if(!S.foes.length) hbSettle(); }       // (지금은 진입 경로 없음 — 옛 저장 호환)
  // ⚔ 토벌이 위에서 끝났다(hbSettle→dgHbWin / hbDie→dgHbLose 가 세션을 걷었다).
  //   ⚠ 여기서 안 끊으면 아래 전투·이펙트가 계속 돌고, hbFx 가 이미 null 이 된 _hb 를 읽어 터진다
  //     (실측: "Cannot read properties of null (reading 'shots')").
  if(S.done) return;
  // ── 전투(쓰러진 동안만 정지 — 웨이브 간격에도 잔존 적은 계속 싸운다) ──
  const spdMul=(S.slowT>0)?HB_SLOW_MUL:1;
  for(const f of S.foes){
    // ⚠ 이동 방식은 f.way 다 — f.mv 가 아니다. f.mv 는 아래에서 '움직이는 중(0/1)'으로 덮어쓰는
    //    옛 플래그라, 여기에 'phase' 를 담으면 첫 프레임 뒤 1 로 바뀌어 지상 취급된다(실제로 그랬다).
    const ghost=(f.way==='air'||f.way==='phase');          // 벽을 무시하는 종류 — 경로탐색도 충돌도 건너뛴다
    const rng=f.rng||0;
    // 벙커가 반경 안에 있으면 그쪽을 때린다(캐릭터 대신 맞아준다) — 사수도 이 대상을 그대로 쏜다
    let tg=c, bk=null, bd2=HB_BUNKER_R;
    for(const b of S.bunkers){ if(b.hp<=0) continue; const d2=Math.hypot(b.x-f.x,b.y-f.y); if(d2<bd2){ bd2=d2; bk=b; } }
    if(bk) tg=bk;
    const dx=tg.x-f.x, dy=tg.y-f.y, d=Math.hypot(dx,dy)||1;
    // 🏹 사거리 안 + 쏠 수 있으면 멈춰서 쏜다. 지상 사수는 벽에 가리면 못 쏘고(더 붙는다),
    //    공중은 넘어서 보므로 시야를 안 따진다.
    const inRange = rng>0 && d<=rng && (f.way==='air' || hbLineClear(f.x,f.y,tg.x,tg.y));
    const stop = inRange || d<=HB_STOP;
    if(!stop){ const sp=f.spd*spdMul*dt;
      // 벽은 부수지 않고 반드시 돌아간다. 목표가 캐릭터면 공용 거리장을, 벙커면 그 벙커용을 쓴다.
      let ux=dx/d, uy=dy/d;
      if(!ghost && !hbLineClear(f.x,f.y,tg.x,tg.y)){          // 가리는 게 있을 때만 우회 — 열린 곳에선 직진(각도가 자연스럽다)
        const fd=(tg===c) ? hbFieldDir(S.foeF, f.x, f.y) : hbFieldDir(hbBunkerField(bk), f.x, f.y);
        if(fd){ ux=fd[0]; uy=fd[1]; } }
      const st=hbAvoid(f, ux, uy);                            // 🚶 유닛끼리는 밀치지 않고 옆으로 비켜 간다(공용 레시피)
      ux=st[0]; uy=st[1];
      if(ghost) { f.x+=ux*sp; f.y+=uy*sp; }                   // 👻✈️ 벽을 통과 — 거리장도 hbSlide 도 타지 않는다(회피는 한다)
      else hbSlide(f, ux*sp, uy*sp);
      f.face=Math.atan2(ux, uy); f.mv=1; }            // ⚠ 게임과 같은 식: atan2(dx,dy). -dy로 쓰면 모델이 정반대를 본다
    else{ f.mv=0; f.face=Math.atan2(dx/d, dy/d);      // 멈춰 쏠 때도 대상을 본다(등 뒤로 쏘는 것처럼 보이지 않게)
      f.cdT-=dt; if(f.cdT<=0){ f.cdT=1.1;
      // ✨ 공격이 **실제로 일어나는 순간**에 그 유닛의 이펙트를 낸다(ATK_STYLE 이 근접·투사체를 알아서 가른다)
      //   ⛔ 사거리 판정에 걸지 말 것 — 그러면 근접 몹은 자기 이펙트(발톱·낫)가 영영 안 나온다.
      hbFire(f.x,f.y-8*(f.sz||1), tg.x,tg.y, f.mdl, hbFoeSize(f), false);   // 대상=캐릭터/벙커=지상
      if(bk){ bk.hp-=f.atk; if(bk.q){ const _bt=hbBase().tiles[bk.q]; if(_bt) _bt.hp=Math.max(0,bk.hp); }   // 타일이 단일 소스 — 재배치해도 체력이 되살아나지 않는다
        S.floats.push({x:bk.x,y:bk.y-20,tx:'-'+fmtCur(f.atk),cl:'#c9a24a',t:0}); }
      else hbCharTake(f.atk);                                     // 🛡 실드 → 체력 순서는 hbCharTake 한 곳에서만
      if(f._u) f._u.fireSeq=(f._u.fireSeq||0)+1; } } }   // 적도 같은 방식으로 공격 모션
  // 캐릭터는 늘 가장 가까운 적을 본다 — 게임의 '정지 + 대상 바라봄'(atan2(dx,dy))과 같은 규칙.
  // 쏠 때만 돌리면 쏘기 직전까지 엉뚱한 곳을 보고 있어 총알이 등 뒤에서 나가는 것처럼 보인다.
  { let n=null,nd=1e18;
    for(const f of S.foes){ const d=Math.hypot(f.x-c.x,f.y-c.y); if(d<nd){ nd=d; n=f; } }
    if(n){ const _d=Math.hypot(n.x-c.x,n.y-c.y)||1; if(_d>1e-4) S.charFace=Math.atan2(n.x-c.x, n.y-c.y); } }
  c.cdT-=dt;
  if(c.cdT<=0){ let best=null,bd=1e18;
    for(const f of S.foes){ const d=Math.hypot(f.x-c.x,f.y-c.y); if(d<bd){ bd=d; best=f; } }
    if(best && bd<=c.range){ c.cdT=c.cd;
      S.atkT=HB_ATK_SHOW;
      if(S._u) S._u.fireSeq=(S._u.fireSeq||0)+1;      // 공격 모션 트리거(랩·게임과 같은 방식)
      hbCharShot(best); }                             // 피해·치명·흡혈·넉백·멀티샷·바운스는 전부 저 안에서
    else { let cb=null, cd2=1e18;                        // 📦 적이 사거리에 없을 때만 상자
      for(const ch of S.chests){ const d=Math.hypot(ch.x-c.x, ch.y-c.y); if(d<cd2){ cd2=d; cb=ch; } }
      if(cb && cd2<=c.range){ c.cdT=c.cd;
        const dmg=c.atk*(c.chestDmg||1)*(hbBoostOn('atk')?2:1);   // 🔀 사거리 상한 초과분이 여기로 온다
        cb.hp-=dmg; hbFire(c.x,c.y-10, cb.x,cb.y, hbCharMdl(), FX.REF);
        S.atkT=HB_ATK_SHOW; if(S._u) S._u.fireSeq=(S._u.fireSeq||0)+1;
        if(cb.hp<=0) hbBreakChest(cb); } } }
  // 아군 — 동료는 캐릭터 주위를 천천히 돌고, 터렛은 고정, 펫은 가깝게 붙어 돈다
  // 동료·펫은 '캐릭터 주위'를 돈다 — 예전엔 원점 고정이라 걸어가면 뒤에 남았다. 수치는 전부 hbAllyMul()에서.
  { const M=hbAllyMul();
    for(const a of S.allies){ const p0x=a.x, p0y=a.y;
      a.ph+=dt*0.5*(a.spd||1); a.x=c.x+Math.cos(a.ph)*52; a.y=c.y+Math.sin(a.ph)*52;
      a.face=Math.atan2(a.x-p0x, a.y-p0y);                          // 도는 방향을 본다(게임과 같은 atan2(dx,dy))
      hbUnitFire(a, (a.dps||0.3)*M.ally.mul, a.rng||1, dt, (M.ally.cdMul||1)/(a.spd||1)); }
    for(const t of S.turrets) hbUnitFire(t,M.turret.dps,M.turret.rng,dt);
    // 🪖 벙커 = 구매 유닛(각 HB_BUNKER_UNIT_DPS) + 지정 동료(자기 위력 × 동료 업그레이드)의 화력 합.
    //    전체에 벙커 공격력(bkatk) 배수와 벙커 사거리(HB_BUNKER_RNG)가 걸린다.
    { const bm=hbBunkerAtkMul();
      for(const b of S.bunkers){ if(b.hp<=0) continue;
        let dps=(b.n||0)*HB_BUNKER_UNIT_DPS;
        for(const id of (b.mates||[])) dps+=hbMateDps(id)*M.ally.mul;
        if(dps<=0) continue;
        hbUnitFire(b, dps*bm, HB_BUNKER_RNG, dt, M.ally.cdMul); } }
    for(const q of S.pets){ q.ph+=dt*1.1; q.x=c.x+Math.cos(q.ph)*30; q.y=c.y+Math.sin(q.ph)*30; hbUnitFire(q,M.pet.dps,1,dt,M.pet.cdMul); } }
  if(S.atkT>0) S.atkT-=dt;                            // 공격 모션 남은 시간(끝나면 idle로)
  if(S.slowT>0) S.slowT-=dt;
  for(const k in S.skT) if(S.skT[k]>0){ S.skT[k]-=dt; if(S.skT[k]<=0) S.skDirty=true; }
  hbAutoSkills();   // 자동 사용 — 켜 둔 것만, 준비됐을 때만
  // ⚠ 스킬 바는 **화면에 보이는 세션만** 그린다. 배경 세션이 만지면 사냥터 바에 토벌 쿨다운이 찍힌다.
  if(!S.bg){ hbSkCdPaint();
    if(S.skDirty && typeof renderHbBar==='function'){ S.skDirty=false; renderHbBar(); } }
  c.hitT+=dt;                                                     // 3초 무피격이면 서서히 회복(+회복 업그레이드)
  if(c.hitT>3 && c.hp<c.hpMax) c.hp=Math.min(c.hpMax, c.hp+(c.hpMax*.02+c.regen)*dt);
  // 🛡 실드 재생 — 체력과 달리 피격 직후에도 돈다(실드가 '먼저 닳는 완충재'로 굴러가게)
  if(c.shdMax>0 && c.shd<c.shdMax && c.shdReg>0) c.shd=Math.min(c.shdMax, c.shd+c.shdReg*dt);
  if(c.hp<=0){ hbDie(); }
  if(S.curDirty && S.t-(S.curT||0)>.2){ S.curT=S.t; S.curDirty=false;
    if(typeof updateCurBar==='function') updateCurBar();
    if(typeof hmAutoUpgTick==='function') hmAutoUpgTick();   // 🤖 자동 업그레이드 — 살 수 있으면 산다
    if(typeof hmUpgAfford==='function') hmUpgAfford(); }     // 💠 살 수 있게 됐으면 버튼을 연다
  hbFx(dt); }
// 처치 1건 — 캐릭터·동료·펫·터렛·스킬이 전부 이 한 곳을 지난다(보상 규칙을 여러 벌 두지 않는다)
function hbKill(f){ const S=_hb, i=S.foes.indexOf(f); if(i<0) return; S.foes.splice(i,1); S.kills++;
  // 💥 사망 이펙트도 공용 코어 — 크기가 큰 놈은 크게 터진다(FX.REF 대비 f.sz)
  //    ⚠ 이건 토벌에서도 나와야 한다(보이는 것) — 아래 보상 차단보다 **앞**에 둔다.
  { const st=hbFxStore(); if(st && FX.death) FX.death(st, f.x, f.y, {unitSize:hbFoeSize(f)}); }
  if(typeof dqNote==='function') dqNote('kill',1);   // 📅 일일 — 적 처치(토벌 처치도 처치다)
  // ⚔ 토벌은 **처치로 아무것도 주지 않는다**. 보상은 단계 클리어 때 dgFloorReward 한 번뿐이다.
  //   ⛔ 이 분기를 빼면 토벌이 사냥터 수입원이 되고, 무엇보다 장비·동료·펫 뽑기권이
  //      토벌 종류와 무관하게 쏟아져 종류를 나눈 뜻이 통째로 무너진다.
  if(S.mode==='dg') return;
  // 처치 보상은 즉시 지급 — 재화 바가 바로 오른다. 사망 시 잃는 것은 '라운드 클리어 보너스'뿐.
  // ⚠ 종류 배수(f.rw)는 **여기 한 곳에서만** 곱한다 — 보상 경로를 두 벌 만들지 않는다.
  //    중장갑은 잡는 데 오래 걸리므로 그만큼 더 준다(안 그러면 탱커가 나오는 던전이 시급만 깎는 함정이 된다).
  const rm=(f.elite?HB_ELITE_REW:1)*(hbBoostOn('inc')?2:1)*(f.rw||1);
  // 💰 처치 재화 업그레이드(mk/gk)는 던전 배수를 같이 받는다 — 안 그러면 상위 던전에서 반올림 오차가 된다
  const ub=HB_DG_REW(S.dg);
  const r0=hbKillReward(S.dg,S.round),
        r={ min:(r0.min+hbUpgNum('mk')*ub)*rm, gas:(r0.gas+hbUpgNum('gk')*ub)*rm, xp:r0.xp*rm };
  const p=PROF(), c=(typeof CHAR==='function')?CHAR():null;
  profGainCoin(r.min); p.gas=(p.gas||0)+r.gas;                     // 💠 미네랄 획득은 환생 배수를 탄다
  if(Math.random() < (f.elite?HB_TICKET_ELITE:HB_TICKET_NORMAL)){   // 🎟 장비 뽑기권
    if(typeof dgAddTicket==='function') dgAddTicket('gear',1);
    S.floats.push({x:f.x,y:f.y-48,tx:'🎟 장비 뽑기권!',cl:'#ffd24a',t:0}); }
  if(Math.random() < (f.elite?HB_ATICKET_ELITE:HB_ATICKET_NORMAL)){  // 🎟 동료 뽑기권
    if(typeof dgAddTicket==='function') dgAddTicket('ally',1);
    S.floats.push({x:f.x,y:f.y-62,tx:'🎟 동료 뽑기권!',cl:'#5dff8f',t:0}); }
  if(Math.random() < (f.elite?HB_PTICKET_ELITE:HB_PTICKET_NORMAL)){  // 🎟 펫 뽑기권
    if(typeof dgAddTicket==='function') dgAddTicket('pet',1);
    S.floats.push({x:f.x,y:f.y-76,tx:'🎟 펫 뽑기권!',cl:'#7ad1ff',t:0}); }
  if(c){ profGainXp(c, r.xp);
    if(profApplyLevelUps(c)){ S.floats.push({x:S.char.x,y:S.char.y-46,tx:'LEVEL UP!',cl:'#5dff8f',t:0});
      if(typeof renderHomeStats==='function') renderHomeStats(); } }
  S.buf.kills++; S.buf.paid=(S.buf.paid||0)+r.min; S.curDirty=true;   // 재화 바 갱신은 묶어서(처치마다 DOM 금지)
  _hbDirty=true;                                                      // 저장 안 된 보상 있음 → loadMeta가 지우기 전에 flush된다
  S.saveT=(S.saveT||0)+1;
  if(S.saveT>=HB_SAVE_KILLS){ S.saveT=0; _hbDirty=false; if(typeof saveMeta==='function') saveMeta(); }
  S.floats.push({x:f.x,y:f.y-34,tx:'+'+fmtCur(r.min),cl:'#ffd24a',t:0}); hbHud(); }
function hbFx(dt){ const S=_hb; if(!S) return;   // 세션이 걷힌 뒤에 불릴 수 있다(판이 끝나는 프레임)
  { const st=hbFxStore(); if(st) FX.advance(st, dt);                          // 사망 이펙트(월드 좌표)
    const L=hbFxUnit(); if(L){ if(typeof tickUnitFx==='function') tickUnitFx(L, dt); FX.advance(L.store, dt); } }   // 유닛별 발사(정규화) — 오토배틀과 같은 순서
  for(const f of S.floats) f.t+=dt; S.floats=S.floats.filter(f=>f.t<.9); }
// ── 던전 겉모습: 적 스프라이트 · 바닥 타일 ──
// 3D 모델은 로드·굽기가 비동기라 준비되기 전엔 null을 준다 → 그리는 쪽이 이모지로 폴백한다.
// 즉 모델이 없어도 게임은 그대로 돌아가고, 준비되면 조용히 그림이 바뀐다.
const _hbSpr={};
function hbSprite(mdl, dir){ if(!mdl) return null;
  const d=((dir|0)%8+8)%8, k=mdl+'#'+d;
  const c=_hbSpr[k]; if(c!==undefined) return (c&&c.complete&&c.naturalWidth)?c:null;
  const url=(window.M3D && M3D.unitSprite) ? M3D.unitSprite(mdl,d) : null;
  if(!url){ _hbSpr[k]=null; setTimeout(()=>{ delete _hbSpr[k]; }, 1200); return null; }   // 아직 모델 전 → 잠시 뒤 재시도
  const im=new Image(); im.src=url; _hbSpr[k]=im; return null; }
const _hbTile={};
function hbTile(name){ if(!name) return null;
  const t=_hbTile[name]; if(t!==undefined) return (t&&t.complete&&t.naturalWidth)?t:null;
  const im=new Image(); im.src='assets/tiles/'+name+'.webp'; _hbTile[name]=im; return null; }
// 던전에 들어가면 그 던전 편성(roster)에 실린 모델만 지연 로드한다(전부 미리 받으면 HOME 진입이 느려진다)
//   ⚠ 보스도 편성표에서 고르므로(hbBossEntry) 따로 받을 필요가 없다 — 목록이 두 벌로 갈리지 않는다.
function hbEnsureModels(dg){ const D=hbDun(dg);
  if(!(window.M3D && M3D.ensureUnits)) return;
  const keys=[...new Set(hbRoster(D).map(f=>f.mdl).filter(Boolean))];
  try{ M3D.ensureUnits(keys, ()=>{ for(const k in _hbSpr) if(keys.indexOf(k.split('#')[0])>=0) delete _hbSpr[k]; }); }catch(e){}
}
// 바닥 = 던전 타일을 월드 좌표로 깔고, 그 위에 던전 틴트를 덮는다(dg가 오를수록 진해져 어두워진다)
let _hbDirty=false;         // 전투 보상이 메모리에만 있는 상태(loadMeta가 flush한다)
const HB_SAVE_KILLS=8;      // 처치 N건마다 저장(매 건 저장은 무겁고, 안 하면 화면 전환 때 재화가 날아간다)
const HB_ATK_SHOW=6/14;     // 공격 모션 길이(초) = 실험장 시트 규격(6프레임 · 14fps)과 같다
const HB_TILE_SCALE=0.34;   // 타일 원본은 크다 — 월드 좌표에 1:1로 깔면 흙 한 덩이가 화면을 덮는다
// 던전 배경 그림 — HB_BG_DIR/dg1.webp … dg10.webp (라운드 시트의 던전 카드도 같은 파일을 쓴다)
// 파일을 넣기만 하면 그 던전에 뜬다(코드 수정 불필요). 없으면 아래 타일 바닥으로 떨어진다.
const _hbBg={}; let _hbBgCur='';
function hbBgImg(dg){ const key='dg'+(dg||1), t=_hbBg[key];
  // 지금 던전 것만 물고 있는다. 1536² 한 장이 디코딩되면 9MB라, 10개를 다 방문하면 90MB가 된다.
  // (지우면 다시 요청되지만 브라우저 캐시에서 오므로 재방문 비용은 사실상 없다)
  if(_hbBgCur!==key){ for(const k in _hbBg) if(k!==key) delete _hbBg[k]; _hbBgCur=key; }
  if(t!==undefined) return (t&&t.complete&&t.naturalWidth)?t:null;   // 404면 naturalWidth=0 → 영원히 null(재시도 안 함)
  const im=new Image(); im.src=HB_BG_DIR+key+'.webp'; _hbBg[key]=im; return null; }
// 움직임 프레임 — dgN_f1.webp … dgN_f4.webp. 넷이 다 오기 전엔 정지 그림으로 버틴다.
const _hbBgF={};
function hbBgFrames(dg){ if(!HB_BG_ANIM) return null;
  const key='dg'+(dg||1), have=_hbBgF[key];
  if(!have){ const a=[]; for(let i=1;i<=HB_BG_FRAMES;i++){ const im=new Image();
      im.src=HB_BG_DIR+key+'_f'+i+'.webp'; a.push(im); } _hbBgF[key]=a; return null; }
  for(const im of have) if(!(im.complete && im.naturalWidth)) return null;   // 하나라도 없으면 안 씀(깜빡임 방지)
  return have; }
// 첫 프레임만 와도 그것을 바탕으로 쓴다 — 넷을 다 기다리면 그동안 정지 그림을 또 받아야 해서
// 던전당 한 장(약 180KB)이 헛돈다. 이 덕에 정지 그림 없이 프레임 4장만 넣어도 동작한다.
function hbBgFirst(dg){ if(!HB_BG_ANIM) return null;
  const a=_hbBgF['dg'+(dg||1)];
  const im=a&&a[0]; return (im&&im.complete&&im.naturalWidth)?im:null; }
// 핑퐁 위상 — 1→2→3→4→3→2로 돌아 이음새가 없다(영상의 마지막↔첫 프레임이 달라도 안 튄다).
// 반환: 겹칠 두 프레임 인덱스 a,b와 섞는 비율 f(0..1).
// 1번 프레임을 기준으로 깔고 그 위에 지금 위상을 HB_BG_AMP만큼만 섞는다 → 움직임 폭이 amp배가 된다.
//   원하는 결과 = amp*(A*(1-pf) + B*pf) + (1-amp)*F1
//   캔버스는 순차 합성(dst = src*α + dst*(1-α))이라 알파를 그대로 쓰면 안 되고 아래처럼 풀어야 한다.
function hbBgMix(amp, pf){ const a2=amp*pf, den=1-a2;
  return { a1: den>1e-6 ? amp*(1-pf)/den : 1, a2:a2 }; }
function hbBgPhase(t, n){ if(!(n>1)) return {a:0,b:0,f:0};
  const seg=(n-1)*2, u=(((t/HB_BG_CYCLE)*seg)%seg+seg)%seg, i=Math.floor(u);
  let f=u-i; f=f*f*(3-2*f);                      // 등속이면 교차 순간이 티난다 → 부드럽게
  const pp=k=>{ k=((k%seg)+seg)%seg; return k<n?k:seg-k; };
  return {a:pp(i), b:pp(i+1), f:f}; }
// 보이는 영역을 'cover'로 채운다 — 비율 유지, 남는 쪽은 잘림. 어떤 비율의 그림을 넣어도 빈 곳이 안 생긴다.
// 그리는 위치는 월드 원점 고정 → 업그레이드를 접었다 펴면 적·캐릭터와 같은 비율로 커지고 작아진다.
function hbBgFit(ar, wx, wy){ ar=ar||1; let dw=wx*2, dh=dw/ar; if(dh<wy*2){ dh=wy*2; dw=dh*ar; } return {dw:dw,dh:dh}; }
// 가장자리 어둡게 — 배경 그림이 화려해도 유닛이 묻히지 않게(그림을 쓸 때만)
// 비네트는 '보이는 곳'을 따라다닌다 — 맵에 고정하면 걸어갈수록 한쪽만 어두워진다
function hbVignette(cx,cy,wx,wy){ const x=_hb.ctx, r=Math.hypot(wx,wy);
  const g=x.createRadialGradient(cx,cy,r*HB_BG_VIG_IN,cx,cy,r);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,'+HB_BG_VIG_A+')');
  x.save(); x.fillStyle=g; x.fillRect(cx-wx,cy-wy,wx*2,wy*2); x.restore(); }
function hbFloor(){ const S=_hb, x=S.ctx, D=hbDun(S.dg);
  const half=(S.vBot-S.vTop)/2, k=S.k||1, wx=(S.w/2+40)/k, wy=(half+40)/k;
  const cx=S.camX||0, cy=S.camY||0;                 // 바닥·타일·비네트는 '보이는 곳'을 덮어야 한다(원점이 아니라)
  x.save(); x.fillStyle='#05070c'; x.fillRect(cx-wx,cy-wy,wx*2,wy*2); x.restore();   // 어두운 바탕(그림·타일이 늦게 와도 배경이 비지 않게)
  const fr=hbBgFrames(S.dg), bg=fr?fr[0]:(hbBgFirst(S.dg)||hbBgImg(S.dg));
  if(bg){ // 그림은 화면이 아니라 '맵'을 덮는다 — 걸어 다니면 그만큼 흘러간다
    const f=hbBgFit(bg.naturalWidth/bg.naturalHeight, HB_MAP_R, HB_MAP_R), X=-f.dw/2, Y=-f.dh/2;
    x.save();
    if(fr){ const p=hbBgPhase(S.t||0, fr.length), m=hbBgMix(HB_BG_AMP, p.f);   // 겹쳐서 크로스페이드 = 영상처럼
      if(HB_BG_AMP<1) x.drawImage(fr[0], X, Y, f.dw, f.dh);          // 기준 프레임(움직임 0의 자리)
      if(m.a1>0.002){ x.globalAlpha=m.a1; x.drawImage(fr[p.a], X, Y, f.dw, f.dh); }
      if(m.a2>0.002){ x.globalAlpha=m.a2; x.drawImage(fr[p.b], X, Y, f.dw, f.dh); }
      x.globalAlpha=1; }
    else x.drawImage(bg, X, Y, f.dw, f.dh);
    x.restore();
    hbVignette(cx,cy,wx,wy); return; }                                 // 그림이 있으면 타일·틴트는 건너뛴다(그림에 이미 색이 있다)
  const img=hbTile(D.tile);
  if(img){ if(!S._pat || S._patName!==D.tile){ const p=x.createPattern(img,'repeat');
      // 패턴은 캔버스 변환을 같이 받는다 → 타일 자체를 줄여 '바닥 질감'으로 읽히게 한다
      if(p && p.setTransform && typeof DOMMatrix!=='undefined'){ try{ p.setTransform(new DOMMatrix().scale(HB_TILE_SCALE)); }catch(e){} }
      S._pat=p; S._patName=D.tile; }
    if(S._pat){ x.save(); x.globalAlpha=.9; x.fillStyle=S._pat; x.fillRect(cx-wx,cy-wy,wx*2,wy*2); x.restore(); } }
  x.save(); x.fillStyle=D.tint; x.fillRect(cx-wx,cy-wy,wx*2,wy*2); x.restore(); }
// 적 한 마리 — 이동 방향(8방향) 스프라이트가 준비됐으면 그림, 아니면 이모지
function hbUnitArt(x, mdl, ico, cx, cy, px, dir){
  const sp=hbSprite(mdl, dir||0);
  if(sp){ x.drawImage(sp, cx-px/2, cy-px*0.62, px, px); return; }
  x.font=Math.round(px*0.72)+'px sans-serif'; x.fillText(ico, cx, cy); }
// 내 캐릭터 — 관리자 실험장의 8방향 시트를 그대로 쓴다(idle/attack). 시트가 없는 직업은 구운 스프라이트로 폴백.
// 캐릭터는 월드 원점에 고정이라 walk는 쓰지 않는다(적이 다가온다). 방향은 지금 노리는 적 쪽.
function hbCharArt(x, cx, cy, px){
  const S=_hb, c=(typeof CHAR==='function')?CHAR():null;
  const mdl=(c && PROF_CLASSES[c.cls] && PROF_CLASSES[c.cls].unit) || 'marine';
  const sh=(typeof sprSheet==='function') ? sprSheet(mdl) : null;
  const ico=(c && PROF_CLASSES[c.cls] && PROF_CLASSES[c.cls].ico)||'🧍';
  if(sh){ const st=(S.atkT>0)?'attack':'idle', spec=sh.states[st];
    const img=hbSheetImg(sh.url[st]);
    if(img){ const n=spec.frames, fr=(st==='attack')
        ? Math.min(n-1, Math.floor((HB_ATK_SHOW-S.atkT)*spec.fps))
        : (Math.floor(S.t*spec.fps)%n);
      const cell=sh.cell;
      x.drawImage(img, fr*cell, (S.charDir||0)*cell, cell, cell, cx-px/2, cy-px*0.66, px, px); return; } }
  const sp=hbSprite(mdl, S.charDir||0);
  if(sp){ x.drawImage(sp, cx-px/2, cy-px*0.62, px, px); return; }
  x.font=Math.round(px*0.72)+'px sans-serif'; x.fillText(ico, cx, cy); }
const _hbSheet={};
function hbSheetImg(url){ const c=_hbSheet[url];
  if(c!==undefined) return (c&&c.complete&&c.naturalWidth)?c:null;
  const im=new Image(); im.src=url; _hbSheet[url]=im; return null; }
// 중앙 회복 구역 — 지형이다(안전지대 아님). 부감이라 세로를 61%로 눌러 타원으로 그린다.
function hbDrawHeal(x, S){
  if(hbNoBase()) return;   // ⚔ 토벌엔 회복 구역이 없다 — 로직만 끄면 초록 원이 남아 "여기서 회복된다"고 거짓말한다
  const R=hbHealR(), pulse=0.5+0.5*Math.sin(S.t*2.2);
  x.save(); x.translate(0,0); x.scale(1,0.61);
  const g=x.createRadialGradient(0,0,R*0.15,0,0,R);
  g.addColorStop(0,'rgba(93,255,143,'+(0.16+0.05*pulse).toFixed(3)+')');
  g.addColorStop(0.72,'rgba(93,255,143,0.07)');
  g.addColorStop(1,'rgba(93,255,143,0)');
  x.fillStyle=g; x.beginPath(); x.arc(0,0,R,0,6.2832); x.fill();
  x.strokeStyle='rgba(93,255,143,'+(0.38+0.22*pulse).toFixed(3)+')';
  x.lineWidth=1.6/(S.k||1); x.beginPath(); x.arc(0,0,R,0,6.2832); x.stroke();
  x.restore(); }
// ═══ 🧱 기지 격자 그리기 ═════════════════════════════════════════════════════
// ⚠ 캔버스 transform이 이미 걸려 있어 여기의 좌표·선 두께는 전부 월드 단위다.
//    선은 줌이 바뀌어도 굵기가 일정해야 하므로 1/k로 나눈다(회복 구역 테두리와 같은 규칙).
const _hbIco={};                                            // 건물 아이콘 이미지 캐시(키 = bld_*)
function hbIcoImg(k){ let im=_hbIco[k];
  if(im===undefined){ im=new Image(); im.src=ICO_DIR+'buildings/'+k+'.webp'; _hbIco[k]=im; }
  return (im&&im.complete&&im.naturalWidth)?im:null; }
// 격자는 **건설 중일 때만** 보인다 — 평소엔 전장이 격자로 덮여 답답하다.
// 화면에 보이는 범위만 그린다(맵 전체 30×30을 매 프레임 긋는 것은 낭비다).
// 🧱 배치 격자 — **화면 전체에 깔지 않는다.** 지으려는 건물 둘레 한 칸까지만, 면 없이 선만 흐리게.
//   ⛔ 예전엔 보이는 맵 전체를 푸른 면으로 덮고 격자를 다 그렸다 — 전장이 안 보이고 배치할 칸도 눈에 안 띄었다.
const HB_GRID_PAD=1;                       // 건물 둘레로 더 보여 줄 칸 수
const HB_GRID_COL='rgba(90,230,140,.85)';  // 격자 색 — 진한 초록(배경이 어두워 파란 흐린 선은 묻힌다)
const HB_GRID_LW=1.4;                      // 선 굵기 배수
const HB_GRID_DASH=4;                       // 점선 간격(px, 줌 보정 전)
function hbDrawGrid(x, S){ if(!S.arm) return;
  const R=HB_MAP_R, lw=1/(S.k||1);
  const B=HB_STRUCT[S.arm.k]||{w:1,h:1}, ok=hbArmOk();
  const gx=hbTx(S.arm.gx)-HB_TILE/2, gy=hbTx(S.arm.gy)-HB_TILE/2;
  // 건물 자리 + 둘레 한 칸(맵 밖으로는 안 넘어간다)
  const x0=Math.max(-R, gx-HB_GRID_PAD*HB_TILE), x1=Math.min(R, gx+B.w*HB_TILE+HB_GRID_PAD*HB_TILE);
  const y0=Math.max(-R, gy-HB_GRID_PAD*HB_TILE), y1=Math.min(R, gy+B.h*HB_TILE+HB_GRID_PAD*HB_TILE);
  x.save();
  x.beginPath(); x.rect(x0,y0,x1-x0,y1-y0); x.clip();                      // 이 안에만 격자를 그린다
  // 진한 초록 점선 — 면은 안 깔고 칸 경계만. 흐린 파란 선은 배경에 묻혀 안 보였다.
  x.strokeStyle=HB_GRID_COL; x.lineWidth=lw*HB_GRID_LW; x.setLineDash([HB_GRID_DASH*lw, HB_GRID_DASH*lw]);
  x.beginPath();
  for(let w=Math.ceil(x0/HB_TILE)*HB_TILE; w<=x1; w+=HB_TILE){ x.moveTo(w,y0); x.lineTo(w,y1); }
  for(let w=Math.ceil(y0/HB_TILE)*HB_TILE; w<=y1; w+=HB_TILE){ x.moveTo(x0,w); x.lineTo(x1,w); }
  x.stroke(); x.setLineDash([]);
  x.restore();
  x.save();
  x.strokeStyle='rgba(140,190,255,.30)'; x.lineWidth=lw*1.6;              // 맵 경계(격자와 별개 — 어디까지가 맵인지)
  x.strokeRect(-R,-R,R*2,R*2);
  {                                                                        // 배치 고스트(위에서 잰 gx/gy/B/ok 를 그대로 쓴다)
    x.fillStyle=ok?'rgba(124,224,255,.22)':'rgba(255,90,110,.26)';
    x.fillRect(gx,gy,B.w*HB_TILE,B.h*HB_TILE);
    x.strokeStyle=ok?'#7ee0ff':'#ff5a6e'; x.lineWidth=lw*2;
    x.strokeRect(gx,gy,B.w*HB_TILE,B.h*HB_TILE); }
  x.restore(); }
function hbDrawStructs(x, S){ const T=hbBase().tiles;
  for(const q in T){ const t=T[q], B=HB_STRUCT[t.k]; if(!B) continue;
    const p=q.split(','), gx=+p[0], gy=+p[1];
    const x0=hbTx(gx)-HB_TILE/2, y0=hbTx(gy)-HB_TILE/2, w=B.w*HB_TILE, h=B.h*HB_TILE;
    const lw=1/(S.k||1);
    // 3D 모델이 올라와 있으면 본체는 그쪽이 그린다 — 여기선 발자국(바닥 판)만 남겨 자리를 알려준다
    const has3d=hb3dReady() && B.m3d && window.M3D && M3D.hasModel && M3D.hasModel('cb_'+B.m3d);
    x.save();
    if(has3d){ x.fillStyle='rgba(20,26,38,.42)'; x.fillRect(x0,y0,w,h);
      x.strokeStyle='rgba(150,180,220,.30)'; x.lineWidth=lw; x.strokeRect(x0,y0,w,h); x.restore(); continue; }
    if(B.slab){                                                          // 벽 = 아이콘 없이 두꺼운 판(줄지어 서도 깔끔하다)
      x.fillStyle='rgba(58,66,82,.94)'; x.fillRect(x0,y0,w,h);
      x.fillStyle='rgba(255,255,255,.10)'; x.fillRect(x0,y0,w,h*0.3);    // 윗면 하이라이트
      x.strokeStyle='rgba(12,16,24,.85)'; x.lineWidth=lw*1.5; x.strokeRect(x0,y0,w,h);
    } else {
      x.fillStyle='rgba(24,30,42,.72)'; x.fillRect(x0,y0,w,h);
      x.strokeStyle='rgba(150,180,220,.45)'; x.lineWidth=lw; x.strokeRect(x0,y0,w,h);
      const im=hbIcoImg(B.ico), pad=w*0.12;
      if(im) x.drawImage(im, x0+pad, y0+pad, w-pad*2, h-pad*2);
      else { x.fillStyle='#cfe0f5'; x.font=(w*0.6)+'px sans-serif'; x.fillText('🏗', x0+w/2, y0+h/2); } }
    x.restore(); }
  for(const b of S.bunkers){ if(b.hp<=0||b.hp>=b.hpMax) continue;         // 벙커 체력 — 닳았을 때만
    x.fillStyle='rgba(0,0,0,.55)'; x.fillRect(b.x-13,b.y-24,26,3);
    x.fillStyle='#c9a24a'; x.fillRect(b.x-13,b.y-24,26*Math.max(0,b.hp/b.hpMax),3); } }
function hbDraw(){ const S=_hb, x=S.ctx, c=S.char; if(!x) return;
  x.setTransform(S.d,0,0,S.d,0,0); x.clearRect(0,0,S.w,S.h);
  // 카메라 = 월드 원점을 보이는 영역 중심으로 옮기고 배율 k를 건다.
  // 이 뒤의 좌표·글꼴 크기는 전부 월드 단위 → 접었다 펴면 적·글자·링이 캐릭터와 같은 비율로 커지고 작아진다.
  const K=S.d*(S.k||1); x.setTransform(K,0,0,K,S.d*(S.cx||S.w/2),S.d*(S.cy||S.h/2));
  hbFloor();                                                        // ⚔ 던전마다 다른 바닥(모든 것보다 먼저)
  hbDrawGrid(x, S);   // 🧱 기지 격자 — 바닥 그림 위, 회복 구역 아래
  hbDrawHeal(x, S);   // 바닥 회복 구역 — ⚠ 반드시 hbFloor 뒤. 앞에 두면 배경 그림이 그대로 덮어 안 보인다
  if(S.slowT>0){ x.save(); x.globalAlpha=.10; x.fillStyle='#9ad0ff';
    x.fillRect(-S.w,-S.h,S.w*2,S.h*2); x.restore(); }               // 감속 중 화면 틴트
  x.save(); x.globalAlpha=.25; x.strokeStyle='#7fa8ff'; x.lineWidth=1;   // 바닥 링(수비 반경 암시)
  x.beginPath(); x.ellipse(c.x,c.y+8,c.range*.62,c.range*.24,0,0,Math.PI*2); x.stroke(); x.restore();
  if(typeof FX!=='undefined' && FX.drawShots){   // ✨ 공용 FX 코어가 그린다(월드 변환 안이라 좌표 변환만 맞춘다)
    const st=hbFxStore(); if(st) FX.drawShots(x, st, (px,py)=>({x:px,y:py}), 1);            // 사망 = 월드 좌표 그대로
    // 발사 = 정규화 → 월드. 크기는 **줌을 따라간다**(오토배틀 strikeDrawFx 와 같은 환산) —
    //   고정값으로 두면 확대했을 때 이펙트만 그대로라 유닛에 비해 쪼그라들어 보인다.
    const L=hbFxUnit();
    if(L){ const szU=Math.max(0.55, Math.min(2.2, (HB_FX_SPAN*(S.k||1))/390));
      FX.drawShots(x, L.store, (px,py)=>({x:px*HB_FX_SPAN,y:py*HB_FX_SPAN}), szU); } }
  x.textAlign='center'; x.textBaseline='middle';
  for(const ch of S.chests){                                       // 📦 상자 — 유닛보다 먼저(발밑에 깔린다)
    x.font='17px sans-serif'; x.fillText('📦', ch.x, ch.y);
    if(ch.hp<ch.hpMax){ x.fillStyle='rgba(0,0,0,.55)'; x.fillRect(ch.x-11,ch.y-16,22,3);
      x.fillStyle='#ffd24a'; x.fillRect(ch.x-11,ch.y-16,22*Math.max(0,ch.hp/ch.hpMax),3);
      x.fillStyle='#ececec'; } }
  hbDrawStructs(x, S);                                             // 🧱 기지 구조물(벽·초소·터렛·벙커) — 타일에서 읽는다
  for(const a of S.allies){ x.font='17px sans-serif'; x.fillText(a.ico,a.x,a.y); }
  for(const q of S.pets){ x.font='14px sans-serif'; x.fillText(q.ico,q.x,q.y); }
  for(const f of S.foes){ const el=!!f.elite, bs=!!f.boss;
    if(bs){ const pl=0.5+0.5*Math.sin(S.t*3.4);   // 👑 보스 = 붉은 이중 링(엘리트 금색과 구분)
      x.save(); x.strokeStyle='rgba(255,59,59,'+(0.5+0.3*pl).toFixed(2)+')'; x.lineWidth=2.4;
      x.beginPath(); x.ellipse(f.x,f.y+4,26,26*0.61,0,0,Math.PI*2); x.stroke();
      x.globalAlpha=.45; x.lineWidth=1.2;
      x.beginPath(); x.ellipse(f.x,f.y+4,32,32*0.61,0,0,Math.PI*2); x.stroke(); x.restore(); }
    else if(el){ x.save(); x.globalAlpha=.5; x.strokeStyle='#ffd24a'; x.lineWidth=1.5;
      x.beginPath(); x.arc(f.x,f.y,17,0,Math.PI*2); x.stroke(); x.restore(); }
    // ✈️ 공중은 띄워 그리고 바닥에 그림자를 남긴다 — 그림자가 없으면 '어디 있는지' 안 읽힌다
    const av=(f.way==='air')?HB_AIR_LIFT:0;
    if(av){ x.save(); x.globalAlpha=.28; x.fillStyle='#000';
      x.beginPath(); x.ellipse(f.x, f.y+3, 9*(f.sz||1), 9*(f.sz||1)*0.42, 0, 0, Math.PI*2); x.fill(); x.restore(); }
    if(!hb3dReady()) hbUnitArt(x, f.mdl, f.ico, f.x, f.y-av, 26*(f.sz||1), f.dir);   // 3D가 없을 때만 2D 폴백 · 크기는 종류가 정한다
    if(f.hp<f.hpMax){ const sz=(f.sz||1), w2=22*sz, hh=bs?4.5:3, yy=f.y-av-16*sz;
      x.fillStyle='rgba(0,0,0,.6)'; x.fillRect(f.x-w2/2,yy,w2,hh);
      x.fillStyle=bs?'#ff3b3b':(el?'#ffd24a':'#ff6b7a'); x.fillRect(f.x-w2/2,yy,w2*Math.max(0,f.hp/f.hpMax),hh); } }
  x.save(); if(S.phase==='down') x.globalAlpha=.35+.25*Math.sin(S.t*6);   // 쓰러짐 = 깜빡임
  if(!hb3dReady()) hbCharArt(x, c.x, c.y, 34);                      // 3D가 없을 때만 2D 폴백
  x.restore();
  if(c.hp<c.hpMax && S.phase!=='down'){ x.fillStyle='rgba(0,0,0,.55)'; x.fillRect(c.x-15,c.y-22,30,3.5);
    x.fillStyle='#5dff8f'; x.fillRect(c.x-15,c.y-22,30*Math.max(0,c.hp/c.hpMax),3.5); }
  if(c.shdMax>0 && S.phase!=='down'){                     // 🛡 실드 = 체력 바 바로 위 하늘색(게임 유닛 바와 같은 색)
    x.fillStyle='rgba(0,0,0,.55)'; x.fillRect(c.x-15,c.y-26,30,2.5);
    x.fillStyle='#7fd0ff'; x.fillRect(c.x-15,c.y-26,30*Math.max(0,(c.shd||0)/c.shdMax),2.5); }
  x.font='700 10px '+(getComputedStyle(document.documentElement).getPropertyValue('--font-num')||'sans-serif');
  for(const f of S.floats){ x.save(); x.globalAlpha=1-f.t/.9; x.fillStyle=f.cl;
    x.fillText(f.tx,f.x,f.y-f.t*22); x.restore(); }
  const tm=document.getElementById('hbTimer');                    // 웨이브 시계(값이 바뀔 때만 DOM 갱신)
  if(tm){ const v=S.build ? '건설 중'
                 : S.phase==='fight' ? Math.ceil(S.waveT)+'s'
                 : S.phase==='fail' ? '실패' : S.phase==='mop' ? '소탕' : S.phase==='down' ? '…'
                 : Math.ceil(S.gapT)+'s';
    if(tm._v!==v){ tm._v=v; tm.textContent=v; } } }
// ── 3D 유닛 렌더 — 메인 게임과 '같은 경로'를 쓴다 ──
// 새로 만들지 않는다: M3D.syncBuild(list,W,H,dt)가 이미 정규화 좌표·face 회전 보간·
// 달리기 모션(it.moving)까지 다 한다. 공용 캔버스(#cvMarine)만 전장 위로 옮겨 쓴다.
// ⚠ 캔버스는 하나뿐이라 쓰고 나면 반드시 제자리로 돌려놓는다(안 그러면 유즈맵 3D가 사라진다).
let _hb3dHome=null;
// 공용 3D 캔버스(#cvMarine)는 유즈맵(#gameArea) 소유다 — HOME·마을이 잠깐 빌려 쓴다.
// ⚠ '원래 자리'는 여기 한 곳에서만 기억한다. 남이 빌린 상태에서 또 빌리면 그 임시 위치를
//    원래 자리로 착각해, 반납해도 캔버스가 남의 화면에 갇힌다(실제로 그랬다 — 유즈맵 3D가 사라짐).
let _cv3dHome=null;
function cv3dHome(cv){ if(!_cv3dHome && cv) _cv3dHome=cv.parentNode; return _cv3dHome; }
// ── 첫 진입 멈춤 없애기: 미리 데워 두기 ─────────────────────────────────────
// 모델을 '처음' 만들 때 텍스처 GPU 업로드 + 셰이더 컴파일이 한꺼번에 일어난다
// (실측: HOME 첫 진입에서 5개 만드는 프레임 504ms + 다음 프레임 148ms).
// 두 번째부터는 4ms라, 비용은 개수가 아니라 '처음'에 붙는다 → 로그인 화면·로딩으로 옮긴다.
// ⚠ 한 프레임에 하나씩만 만든다. 한꺼번에 하면 로그인 화면이 그만큼 얼어붙는다.
let _warmDone=false, _warmRun=null;
function warmIds(){ const ids=[];
  try{ for(const k in PROF_CLASSES){ const u=PROF_CLASSES[k]&&PROF_CLASSES[k].unit;
    if(u && ids.indexOf(u)<0) ids.push(u); } }catch(e){}          // 어떤 직업으로 들어와도 준비돼 있게
  try{ const dg=(typeof hbHunt==='function' && hbHunt().dg)||1;
    for(const f of hbDun(dg).foes) if(f.mdl && ids.indexOf(f.mdl)<0) ids.push(f.mdl); }catch(e){}
  return ids; }
function warmAll(onStep){
  if(_warmDone) return Promise.resolve(0);
  if(_warmRun) return _warmRun;
  _warmRun=(async()=>{
    for(let i=0;i<200 && !(window.M3D&&M3D.ready&&M3D.ready()); i++) await new Promise(r=>setTimeout(r,50));
    if(!(window.M3D&&M3D.ready&&M3D.ready())){ _warmDone=true; return 0; }   // 3D가 없으면 데울 것도 없다
    try{ hbBgImg((typeof hbHunt==='function' && hbHunt().dg)||1); }catch(e){}   // 배경 그림도 미리 받아 둔다
    const ids=warmIds(); let n=0;
    for(const id of ids){
      await new Promise(r=>requestAnimationFrame(()=>r()));
      try{ M3D.sync([{uid:'_warm', id:id, x:0.5, y:0.5, face:0, moving:false, size:1}], 300, 300, .016, [], [], null, null); }catch(e){}
      n++; if(onStep) try{ onStep(n, ids.length); }catch(e){} }
    await new Promise(r=>requestAnimationFrame(()=>r()));
    // 🧹 데운 흔적을 지운다 — GPU 캐시는 남는다(그게 목적).
    // ⚠ clearGameModels() 는 scene.remove() 만 한다. **다시 그리지 않으면 캔버스에는 마지막 프레임이
    //    그대로 박제된다** — 예열 유닛은 x:.5, y:.5 즉 화면 한가운데 서 있었다. 그 뒤 검은 판이
    //    페이드로 덮이는 동안(--t-screen) 반투명한 그 사이로 비쳐, 로고 옆에 유닛이 공중에 뜬 것처럼
    //    보였다(2026-08-24). 빈 목록으로 sync 를 한 번 더 돌려 캔버스를 실제로 비운다
    //    (sync 는 끝에서 renderer.render 를 부른다 — '지우기'는 지운 뒤 한 번 더 그려야 완성된다).
    //    ⛔ 뒤에 rAF 를 하나 더 두지 말 것 — renderer.render 는 동기라 기다릴 이유가 없는데,
    //       그 한 프레임 사이에 게임 루프가 sync 를 불러 모델을 도로 만든다(스모크가 잡았다).
    try{ M3D.clearGameModels();
         M3D.sync([], 300, 300, .016, [], [], null, null); }catch(e){}
    _warmDone=true; return n; })();
  return _warmRun; }
// 로그인/게스트 → 로딩 화면(#opening 재사용)에서 데우기를 끝낸 뒤 HOME으로.
// 새 로딩 UI를 만들지 않는다 — 부팅 때 쓰는 그 화면의 막대와 문구를 그대로 쓴다.
async function enterAfterWarm(){
  const op=document.getElementById('opening');
  showAppScreen('opening');
  // 막대는 공용 규칙(opBarStart/Real/Done)이 몬다.
  // ⚠ 부팅에서 이어서 오면 **그 막대를 그대로 잇는다** — 여기서 0 으로 되돌리면 사용자에겐
  //   '로딩이 두 번' 도는 것으로 보인다(2026-08-19). 로그인·게스트로 들어올 때만 새로 시작한다.
  const cont = (typeof _opBar!=='undefined' && _opBar);
  const base = cont ? BOOT_AUTH_P : 0;
  if(!cont) opBarStart();
  await warmAll((n,t)=>opBarReal(base+(1-base)*(t?n/t:1)));
  await opBarDone();
  // 🎬 **검은 화면 + 로고는 「게임이 실제로 시작되는 지점」에 쓴다.**
  //    종족을 아직 안 골랐으면 여기가 그 지점이 아니다 — 로딩에서 종족 선택으로 **바로 디졸브**하고,
  //    검은 화면은 종족을 고른 뒤(campPickRace)가 맡는다. 안 그러면 검은 화면이 두 번 나온다:
  //    로딩→검정→종족선택→(다시)캠프 — 그 사이가 깜빡이는 것처럼 보였다(2026-08-27).
  const _needRace = (function(){ try{ return typeof campState==='function' && campState() && !campState().race; }catch(e){ return false; } })();
  //   ⭐ 종족 선택으로 갈 때는 **여기서 아무것도 걷지 않는다.** 아래 openHome() 이 부르는
  //     showAppScreen 이 이미 로딩을 페이드아웃시키고 그 아래에 HOME·종족 판을 세운다 —
  //     그것이 진짜 크로스페이드다.
  //     ⛔ 여기서 먼저 걷고 기다리지 말 것. 로딩이 **완전히 사라진 뒤에** HOME 이 켜지면
  //       그 사이 빈 HOME 이 키 아트를 덮어 검게 한 번 깜빡인다(2026-08-27).
  if(!_needRace && typeof titleToBlack==='function') await titleToBlack();
  opBarReset();
  // ⚠ 예열은 오래 걸린다(헤드리스 소프트웨어 렌더러에선 20초를 넘긴다). 그 사이 사용자가 이미
  //    **게임에 들어가 있으면 끌어오지 않는다** — 무조건 openHome() 을 부르면 게임 중에
  //    setInGame(false) 가 걸려 하단 콘솔(#bot)이 통째로 사라진다(스모크가 간헐 실패했다).
  //    bootApp() 의 '이미 다른 화면으로 넘어갔으면 건드리지 않는다' 와 같은 규칙이다.
  //    ⛔ '#opening 이 감춰졌으면 return' 으로 넓게 잡지 말 것 — 예열 중 다른 경로가 오프닝을
  //       내리는 경우가 있어 정상 진입까지 막힌다(실제로 게스트가 HOME 에 못 갔다).
  // ⚠ 어느 갈래로 빠지든 검은 판·로고는 반드시 걷는다 — 안 걷으면 화면이 검은 채로 잠긴다.
  { const ph=document.getElementById('phone'); if(ph && ph.classList.contains('inGame')){ if(typeof titleOutroEnd==='function') titleOutroEnd(); return; } }
  // 화면을 내린 사이 탭이 죽었을 수 있다 — 30초 안이면 그 판을 그대로 이어받는다(실패하면 평소대로 HOME)
  // ⛔ 부팅 경로다 — 여기서 예외가 나면 사용자가 HOME 에 영영 못 간다. 한 겹 더 감싼다.
  try{ if(typeof tryRestoreRun==='function' && tryRestoreRun()){ if(typeof titleOutroEnd==='function') titleOutroEnd(); return; } }catch(e){ console.warn('tryRestoreRun', e); }
  openHome();
  if(typeof titleOutroEnd==='function') titleOutroEnd(); }   // 게임 화면이 선 뒤 — 검은 판과 로고가 함께 걷힌다
function hb3dAttach(){ const cv=document.getElementById('cvMarine'), host=document.getElementById('homeScreen');
  if(!cv||!host||_hb3dHome) return;
  if(_tw3dHome && typeof tw3dDetach==='function') tw3dDetach();   // 남이 쓰고 있으면 먼저 돌려받는다
  _hb3dHome=cv3dHome(cv);                                   // 돌려놓을 자리(공용 기억)
  cv.style.zIndex='1';                                      // 바닥(#hbCv) 위 · HOME UI(z2+) 아래
  host.insertBefore(cv, host.firstChild.nextSibling||null);
  if(window.M3D && M3D.clearGameModels){ try{ M3D.clearGameModels(); }catch(e){} }   // 랩과 같이 유닛 모델 풀을 비우고 시작
  if(window.M3D && M3D.clearIdlePools){ try{ M3D.clearIdlePools(); }catch(e){} } }    // 잔상이 될 수 있는 풀은 아예 삭제(숨기기 아님)
function hb3dDetach(){ const cv=document.getElementById('cvMarine');
  if(cv&&_hb3dHome){ cv.style.zIndex=''; cv.style.display='none'; _hb3dHome.appendChild(cv);
    if(window.M3D && M3D.clearGameModels){ try{ M3D.clearGameModels(); }catch(e){} }
    if(window.M3D && M3D.clearIdlePools){ try{ M3D.clearIdlePools(); }catch(e){} } }   // 빌린 것도 돌려줄 때 깨끗이 — 양쪽 다 잔상을 남기지 않는다
  _hb3dHome=null; }
function hb3dReady(){ return !!(window.M3D && M3D.ready && M3D.ready() && M3D.syncBuild
  && !(typeof G!=='undefined' && G.opt && G.opt.model3d===false)); }
// 월드 좌표 → 화면 정규화(0..1). hbDraw의 카메라(cx,cy,k)와 같은 식이라 2D 바닥과 정확히 겹친다.
// 유닛 객체는 관리자 이펙트 랩(FXLAB)이 만드는 것과 '같은 모양'이다:
//   { uid, id, x, y(0..1), face, moving, fireSeq, size, hidden }
// 이 객체를 M3D.sync에 넘기면 이동·회전·걷기·공격 모션·이펙트가 전부 자동으로 나온다.
// ⚠ syncBuild(건설 뷰)로 그리면 안 된다 — 거긴 공격 모션(fireSeq) 처리가 아예 없다(그래서 조준이 이상했다).
// 객체는 적/캐릭터에 붙여 두고 재사용한다 — fireSeq는 '누적'이라 매 프레임 새로 만들면 공격 모션이 안 뜬다.
function _hbU(host, id, x, y, face, moving){
  let u=host._u;
  if(!u || u.id!==id){ u=host._u={ uid:'hb'+(++_hbUid), id:id, x:0, y:0, face:0, moving:false, fireSeq:0, size:13, hidden:false }; }
  u.x=x; u.y=y; u.face=face; u.moving=moving; return u; }
function hb3dList(){ const S=_hb, W=S.w||1, H=S.h||1, k=S.k||1, out=[];
  const nx=(wx)=>((S.cx||W/2)+wx*k)/W, ny=(wy)=>((S.cy||H/2)+wy*k)/H;
  const c=S.char, ch=(typeof CHAR==='function')?CHAR():null;
  const mdl=hbCharMdl();   // 공격 이펙트(hbFire)와 같은 단일 소스
  out.push(_hbU(S, mdl, nx(c.x), ny(c.y), S.charFace||0, false));
  for(const a of S.allies){ if(!a.mdl) continue;                       // 🤝 동료도 캐릭터와 같은 경로로 그린다
    out.push(_hbU(a, a.mdl, nx(a.x), ny(a.y), a.face||0, true)); }
  for(const f of S.foes){ if(!f.mdl) continue;
    // ⚠ 고도는 여기서 더하지 않는다 — M3D 가 모델 id 로 판정해(FXLAB_AIR) 알아서 띄운다.
    //   여기서 y 를 빼면 화면에서 뜨는 게 아니라 **바닥 위를 북쪽으로 밀어** 두 번 어긋난다.
    //   HB_AIR_LIFT 는 3D 가 없을 때의 2D 폴백 전용이다.
    const u=_hbU(f, f.mdl, nx(f.x), ny(f.y), f.face||0, !!f.mv);
    // 크기는 종류가 정한다. M3D 의 per-unit 크기 손잡이는 bossScale 하나뿐이라 그걸 쓴다
    //   (u.size 는 메인 sync 가 안 본다 — 넣어도 3D 에서는 아무 일도 안 일어난다).
    u.bossScale=(f.sz||1);
    out.push(u); }
  hb3dStructs(out, S, nx, ny, k);
  return out; }
const HB_M3D_FIT=1.15;   // 모델을 타일보다 조금 크게 — 발자국에 딱 맞추면 실제보다 작아 보인다
// 🧱 기지 구조물을 '같은 sync 목록'에 얹는다.
// ⛔ M3D.syncBuild를 따로 부르면 안 된다 — sync와 syncBuild는 서로의 모델 풀을 숨겨서
//    같은 프레임에 둘 다 부르면 나중 것만 남고 앞의 것이 통째로 사라진다.
// 화면 밖 구조물은 넣지 않는다 — 벽은 수백 칸까지 늘어나서 컬링이 없으면 드로우콜이 폭증한다.
function hb3dStructs(out, S, nx, ny, k){
  if(!(window.M3D && M3D.hasModel)) return;
  const T=hbBase().tiles, hw=(S.w/k)/2+HB_TILE*2, hh=(((S.vBot||S.h)-(S.vTop||0))/k)/2+HB_TILE*3;
  const k3=Math.max(0.12, Math.min(1.7, k*0.72));      // hbFrame이 sync에 넘기는 배율과 같아야 한다
  for(const q in T){ const t=T[q], B=HB_STRUCT[t.k]; if(!B||!B.m3d) continue;
    const id='cb_'+B.m3d; if(!M3D.hasModel(id)) continue;
    const p=q.split(','), gx=+p[0], gy=+p[1];
    const wx=hbTx(gx)+(B.w-1)*HB_TILE/2, wy=hbTx(gy)+(B.h-1)*HB_TILE/2;
    if(Math.abs(wx-(S.camX||0))>hw || Math.abs(wy-(S.camY||0))>hh) continue;   // 화면 밖은 건너뛴다
    const fp=M3D.footprintOf && M3D.footprintOf(id);   // 모델의 실제 표시 반경(px)
    const want=(B.w*HB_TILE*k)/2*HB_M3D_FIT;           // 타일 발자국에 맞출 반경
    out.push({ uid:'hbs_'+q, id:id, x:nx(wx), y:ny(wy), face:0, moving:false, fireSeq:0,
      scl:(fp&&fp>0.5)? (want/(fp*k3)) : 1, size:B.w*HB_TILE*0.5 }); }
  // 🧱 배치 고스트 = **관리자 건설과 같은 반투명 회색 3D**(M3D 의 makeBuildGhost/buildGhostModels).
  //   ⛔ 새로 만들지 말 것 — 항목에 ghost:true 만 실으면 M3D 가 같은 풀로 그린다.
  //   사냥터는 메인 sync 하나로 전부 그리므로(syncBuild 를 같은 프레임에 부르면 서로를 지운다)
  //   같은 목록에 얹는다.
  if(S.arm){ const B=HB_STRUCT[S.arm.k];
    if(B && B.m3d){ const id='cb_'+B.m3d;
      if(M3D.hasModel(id)){
        const wx=hbTx(S.arm.gx)+(B.w-1)*HB_TILE/2, wy=hbTx(S.arm.gy)+(B.h-1)*HB_TILE/2;
        const fp=M3D.footprintOf && M3D.footprintOf(id);
        const want=(B.w*HB_TILE*k)/2*HB_M3D_FIT;
        out.push({ uid:'__bghost__', id:id, x:nx(wx), y:ny(wy), face:0, ghost:true,
          scl:(fp&&fp>0.5)? (want/(fp*k3)) : 1 }); } } } }
// 기지 건물 3D 모델 지연 로드 — 관리자 건설과 같은 에셋(cb_*). 한 번만 부른다.
let _hbCstLoaded=false;
function hbEnsureStructModels(){ if(_hbCstLoaded) return; if(!(window.M3D&&M3D.cstEnsure)) return;
  _hbCstLoaded=true;
  const keys=[]; for(const k in HB_STRUCT){ const m=HB_STRUCT[k].m3d; if(m) keys.push(m); }
  try{ M3D.cstEnsure(keys); }catch(_e){ _hbCstLoaded=false; } }
let _hbUid=0;
function hbFrame(){ if(!_hb||!_hb.on||_hb.bg){ _hbRaf=0; return; }   // 배경 모드 = 시뮬만(setInterval), 그리기 없음
  hbPump(); hbEdgePan(); hbResize(); hbDraw(); if(_hb.arm) hbArmBtns();   // 🧱 고스트 버튼은 카메라를 따라간다
  if(hb3dReady()){ const cv=document.getElementById('cvMarine');
    if(cv){ hb3dAttach(); hbEnsureStructModels(); cv.style.display='block';
      // 관리자 랩과 같은 호출: M3D.sync(list, W, H, dt, [], [], null, k)
      try{ const dt3=Math.min(.05,(performance.now()-(_hb._l3||performance.now()))/1000);
        const k3=Math.max(0.12, Math.min(1.7, (_hb.k||1)*0.72));   // 랩과 같은 식(줌 → 모델 크기)
        M3D.sync(hb3dList(), _hb.w, _hb.h, dt3, [], [], null, k3); }catch(e){}
      _hb._l3=performance.now(); } }
  _hbRaf=requestAnimationFrame(hbFrame); }
// ── 🧍 마을 3D 캐릭터 — 던전(hb3dAttach/hb3dList)과 같은 방식. 공용 #cvMarine을 마을로 옮겨 M3D.sync로 그린다.
//    캐릭터는 항상 화면 정중앙(twCamApply가 월드를 움직인다)이라 정규화 좌표는 (0.5, 0.5) 고정.
let _tw3dHome=null, _tw3dU=null, _tw3dLast=0;
function tw3dDetach(){ const cv=document.getElementById('cvMarine');
  if(cv&&_tw3dHome){ cv.style.zIndex=''; cv.style.display='none'; _tw3dHome.appendChild(cv);
    if(window.M3D && M3D.clearGameModels){ try{ M3D.clearGameModels(); }catch(e){} } }
  _tw3dHome=null; _tw3dU=null; }
// ── 🏘 마을(메인 화면) UI ──
// 🚪 메인(마을) 뒤로가기 = 로그아웃 확인 — 되돌아갈 곳이 로그인뿐이다
function askLogout(){ const p=document.getElementById('logoutPanel'); if(!p) return;
  p.classList.remove('hide'); if(typeof fxPop==='function') fxPop(p.querySelector('.cpCard'));
  if(typeof paintIcons==='function') paintIcons(p); if(typeof playSfx==='function') playSfx('ui_open'); }
function closeLogout(){ const p=document.getElementById('logoutPanel'); if(p) p.classList.add('hide'); }
function doLogoutNow(){ closeLogout(); if(typeof doLogout==='function') doLogout(); else openAuth(); }
// ▶ 즉시 플레이 — 모드/난이도 선택 없이 기본값으로 바로 시작(멀티 전용 맵은 모드 선택으로 넘긴다)
// ── 하단 소셜: 친구 목록 + DM(현재 데모 데이터 — 실제 친구/프레즌스 연동은 별도 백엔드) ──
//   status: active(초록) / away(빨강=게임 내 5분+ 무터치 자리비움) / offline(회색) · close=친한친구 · act.type=usemap|rpg|off
const HUB_FRIENDS=[
  { name:'별빛사냥꾼', av:'🦊', status:'active',  close:true,  act:{type:'usemap', map:'네모네모 디펜스', label:'플레이 중', pt:72} },
  { name:'NovaWolf',  av:'🐺', status:'active',  close:false, act:{type:'usemap', map:'오토배틀',       label:'대전 중',   pt:26} },
  { name:'모험가_K',  av:'🐱', status:'active',  close:true,  act:{type:'rpg',                          label:'캐릭터 육성 중', pt:143} },
  { name:'느긋한곰',  av:'🐻', status:'away',    close:false, act:{type:'usemap', map:'네모네모 디펜스', idle:5} },   // 게임 내 자리비움
  { name:'슬리피H',   av:'🦁', status:'away',    close:true,  act:{type:'rpg',    map:'RPG 마을',        idle:12} },   // RPG 자리비움
  { name:'구름',      av:'🦉', status:'offline', close:true,  act:{type:'off',                          label:'2시간 전 접속'} },
  { name:'다크나이트',av:'🐲', status:'offline', close:false, act:{type:'off',                          label:'오프라인'} },
];
const _FR_CHAT_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-10.8 6.75L4 20l1.3-4.9A7.5 7.5 0 1 1 20 11.5z"/></svg>';
let _friendFil='all';
// 친구 필터 띠 = 공용 세그먼트 바(segNavHTML). ⛔ 새 탭 띠를 만들지 말 것.
const HUB_FRIEND_FILS=[['all','전체'],['usemap','유즈맵'],['rpg','RPG'],['close','친한친구']];
// ── 친구 DM ──
let _dmFriend=-1; const _dmMsgs={};
const _DM_REPLIES=['ㅇㅋ!','좋아 콜 ㅋㅋ','지금 바로 갈게','잠만, 이거만 깨고!','오 그래?','굿굿 👍','ㅋㅋㅋㅋ','어 어디서 봐?'];
// ── 마을(월드 + 카메라) ──
// 좌표계: 월드 픽셀. 캐릭터는 화면 정중앙에 CSS로 고정되고, 매 프레임 #twWorld의 transform만 바뀐다.
// ═══ 🏘 마을 건설 — 건물을 사면 정해진 슬롯에 자동으로 서고, 재화가 쌓이면 탭해서 거둔다 ═══
//  · 배치는 슬롯 순서대로(드래그 없음) · 산출 재화는 건물마다 다르다 · 저장 한도가 차면 멈춘다
const TOWN_SLOTS=[   // 성벽 안 빈 공터(배경 그림 기준 %)
  {x:50,y:30},{x:31,y:36},{x:69,y:36},{x:24,y:50},{x:76,y:50},{x:31,y:64},
  {x:69,y:64},{x:50,y:70},{x:38,y:22},{x:62,y:22},{x:38,y:78},{x:62,y:78} ];
const TOWN_BLDG={
  supply:  { name:'보급창',    ico:'bld_supply',    cost:{min:80},              out:'min', rate:0.30, cap:240  },
  refinery:{ name:'정제소',    ico:'bld_refinery',  cost:{min:220},             out:'gas', rate:0.05, cap:60   },
  engbay:  { name:'공학소',    ico:'bld_engbay',    cost:{min:600},             out:'min', rate:1.10, cap:900  },
  extract: { name:'추출기',    ico:'bld_extractor', cost:{min:900,  gas:60},    out:'gas', rate:0.16, cap:200  },
  scifac:  { name:'연구소',    ico:'bld_scifac',    cost:{min:2400, gas:200},   out:'gas', rate:0.45, cap:520  },
  factory: { name:'공장',      ico:'bld_factory',   cost:{min:5200, gas:420},   out:'min', rate:4.20, cap:3400 },
  starport:{ name:'우주공항',  ico:'bld_starport',  cost:{min:12000,gas:1100},  out:'gas', rate:1.30, cap:1500 },
  physics: { name:'물리연구소',ico:'bld_physics',   cost:{min:30000,gas:3000},  out:'min', rate:14.0, cap:11000} };
const TOWN_COST_MUL=1.65;   // 같은 건물을 더 지을 때마다 비용 배수

let _vgTick=0;
// 시설 팝업은 TOWN_PANELS 한 줄이면 늘어난다(제목 + 렌더러).
// 배치: 가로로 긴 직사각형의 네 모서리 + 정중앙 광장(주 이동 방향이 가로라 좌우로 넓게 잡는다)
// 광장을 가운데 두고 6구역이 그 둘레를 감싼다(육각 배치). 반지름은 한 화면 안에 다 들어오는 거리라
// 어느 구역이든 화면을 옮기지 않고 한 번의 터치로 갈 수 있다. deco=상호작용 없는 지형지물.
const TW_WORLD_W_MUL=2.4, TW_WORLD_H_MUL=1.66;   // 월드 = 화면의 가로 N배 × 세로 M배(3배→1.6배: 구역을 한 화면에 모으며 여백만 남김)
const TW_SPEED=285;          // 캐릭터 이동 속도(월드 px/초)
const TW_ARRIVE=4;           // 목적지 도착 판정(px)
const TW_ZONE_R=78;          // 구역 도착 판정 반경(px)
const TW_TAP_MS=260, TW_TAP_PX=10;   // 이보다 길게 누르거나 많이 움직이면 '탭'이 아니라 '꾹 누르기'
// 시설 패널 — 옛 마을 지도는 폐지됐고 팝업만 남았다. 제목과 렌더러만 있으면 된다.
const TOWN_PANELS={
  plaza:   { title:'내 캐릭터',        render:()=>renderProfStats()  },
  gacha:   { title:'상점',             render:()=>renderProfGacha(), screen:'shop' },   // 전용 화면으로(팝업 아님)
  gate:    { title:'관문',             render:()=>renderProfGate()   },
  gym:     { title:'훈련장',           render:()=>renderProfIdle()   },
  gear:    { title:'장비',             render:()=>renderProfGear()   } };
let _townOpen=false, _twZone=null;
let _twW=0,_twH=0, _twVW=0,_twVH=0, _twVL=0,_twVT=0;   // 월드 크기 / 화면(뷰포트) 크기·위치
let _twChar={x:0,y:0,tx:0,ty:0,dx:0,dy:0,mode:null,face:1};   // mode: null=정지 | 'to'=목적지 이동 | 'dir'=방향 이동
let _twPtr=null, _twGoZone=null, _twRaf=0, _twLast=0;   // _twGoZone = 지금 향하고 있는 '지정한' 구역(도착하면 그것만 열린다)
function mapToHub(){ if(typeof stopRoomsTick==='function') stopRoomsTick(); if(typeof playSfx==='function') playSfx('ui_close'); openHome(); }   // 유즈맵 선택 → 메인(HOME)으로 복귀
// 마을을 떠날 때의 공통 정리 — 루프·패널·시트를 한 번에 닫는다(그대로 두면 배경에서 계속 돈다)
function twLeave(){ _townOpen=false; twStopLoop(); closeTownPanel(); twCloseSocial(); twCloseChat(); profStampSeen(); }
// 🗺 마을 → 유즈맵 선택
function twGoMap(){ twLeave(); if(typeof playSfx==='function') playSfx('ui_open'); openMapSelect(); }
function twCloseChat(){ const el=document.getElementById('twChat'); if(el) el.classList.add('hide'); }
function twCloseSocial(){ const el=document.getElementById('twSocial'); if(el) el.classList.add('hide'); }

// 성벽 경계 — town_ground.webp의 성벽을 방사 측정(3도 간격)해 역산한 값. 그림을 바꾸면 다시 재야 한다.
const TW_WALL_X=1.00, TW_WALL_Y=0.798, TW_WALL_DY=0;   // 월드 정규좌표(-1~1) 기준 좌우/상하 한계 + 세로 치우침 보정
const TW_WALL_CUT=0.30;                 // 모서리 컷(팔각형) — 기기별 1.285~1.338의 평균
function twStopLoop(){ if(_twRaf){ cancelAnimationFrame(_twRaf); _twRaf=0; } _twPtr=null; _twChar.mode=null; _twGoZone=null;
  tw3dDetach(); const _b=document.querySelector('#twAvatar .twAvBody'); if(_b) _b.style.display=''; }   // 마을을 떠나면 3D 캔버스를 원래 자리로

window.addEventListener('resize', function(){ if(_townOpen){ twLayout(); twCamApply(); } });
function renderTownBar(){ const p=PROF(), c=CHAR();
  const nm=document.getElementById('twName'); if(nm) nm.textContent=c?c.name:'캐릭터';
  const lv=document.getElementById('twLv'); if(lv) lv.textContent='Lv.'+(c?c.level:1);
  const pw=document.getElementById('twPow'); if(pw) pw.textContent='⚔ '+profPower();
  if(typeof updateCurBar==='function') updateCurBar(); }   // 💠 미네랄/가스/젬은 공용 재화 바
function showTownToast(msg){ const t=document.getElementById(gearOpen()?'gearToast':shopOpen()?'shopToast':'twToast'); if(!t) return; t.textContent=msg; t.classList.remove('hide');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.add('hide'), 2600); }
const TOWN_ZONE_SCREEN={ shop:()=>openShop() };   // 구역 → 전용 화면 매핑(팝업 대신 화면 전환)
function openTownPanel(zone){ const _z=TOWN_PANELS[zone];
  if(_z && _z.screen && TOWN_ZONE_SCREEN[_z.screen]){ _twChar.mode=null; _twPtr=null; return TOWN_ZONE_SCREEN[_z.screen](); }   // 전용 화면 구역
  _twZone=zone; _twChar.mode=null; _twPtr=null;   // 시설에 들어가면 걸음을 멈춘다
  const card=document.querySelector('#townPanel .twCard');
  if(card) card.classList.toggle('gearFull', zone==='gear');   // 장비창만 카드 높이를 고정해 위/아래 구역을 나눈다
  const t=document.getElementById('tpTitle'), z=TOWN_PANELS[zone]; if(t) t.textContent=(z&&z.title)||'시설';
  refreshTownPanel(); popShow('townPanel'); bagScrollHint(); }   // 숨은 동안은 높이가 0이라 표시 후 한 번 더 재본다
// ── 🎁 상점(전용 화면) ─────────────────────────────────────────────────────
// 팝업이 아니라 독립 화면이다. 내용 렌더러는 renderProfGacha() 하나뿐(단일 소스) — 마크업을 복제하지 말 것.
function shopOpen(){ const e=document.getElementById('shopScreen'); return !!(e && !e.classList.contains('hide')); }
function openShop(){ if(typeof loadMeta==='function') loadMeta();
  profEnsureChar();   // 캐릭터가 없으면 조용히 기본 유닛을 지급한다(선택 화면 없음)
  if(typeof twLeave==='function') twLeave();                                     // 마을에서 들어왔으면 루프·팝업 정리
  showAppScreen('shopScreen'); navShow('shop'); renderShop();
  if(typeof paintIcons==='function') paintIcons(document.getElementById('shopScreen')); }
function renderShop(){ const body=document.getElementById('shopBody'); if(!body) return;
  const old=body.querySelector('.bagBody'), keep=old?old.scrollTop:0;
  body.innerHTML=(SHOP_SECS[_shopSec]||SHOP_SECS.deal)();
  const nb=body.querySelector('.bagBody'); if(nb&&keep) nb.scrollTop=keep; }
// ── 🧰 정비(전용 화면) — 장비·펫·동료 ────────────────────────────────────
// ⛔ 내용을 새로 만들지 않는다. 장비 = renderProfGear() (마을 장비창과 같은 함수),
//    펫 = _shopPetPanel() (상점과 같은 함수). 여기서는 탭 전환과 껍데기만 담당한다.
//    동료는 아직 시스템이 없다 — HOME '건설'의 동료가 유일한 실체라 그쪽으로 보낸다.
let _gearTab='gear';
function gearOpen(){ const e=document.getElementById('gearScreen'); return !!(e && !e.classList.contains('hide')); }
// ⬆ 강화 — 아직 내용이 없다. 들어오는 길과 내비게이션만 먼저 열어 둔다.
// ── 🧍 캐릭터 구역 — 정보 · 성장 · 스킬 ────────────────────────────────
// 스탯 = 이 화면 전용 렌더러(간단 요약 + 레벨 포인트). '스탯 출처' 상세표는 사냥터 좌상단
//   프로필(#hbHud → hbOpenInfo)이 맡는다 — 같은 표를 두 곳에 두지 않는다.
// ⛔ 환생 본문은 복제하지 않는다: 보관함(#chrStash)의 #hbGrowBody 를 통째로 빌려 오고
//   화면을 떠날 때 제자리로 돌려준다. 렌더러는 그대로 같은 id 를 찾는다.
const CHR_SECS={ stat: { html:()=>renderChrStat() },
                 reb:  { body:'hbGrowBody', home:'chrStash', render:()=>renderGrowModal() },   // ⚠ 집이 성장 팝업 → #chrStash 로 바뀌었다(팝업은 다락 · ATTIC.md)
                 skill:{ html:()=>_chrSkillHTML() } };
let _chrSec='stat';
// 빌린 본문을 원래 팝업으로 되돌린다(화면을 떠나거나 팝업이 열릴 때)
function chrReturnBody(){ for(const k in CHR_SECS){ const S=CHR_SECS[k]; if(!S.body) continue;
  const el=document.getElementById(S.body), home=document.getElementById(S.home);
  if(el && home && el.parentNode!==home) home.appendChild(el); } }
function renderChr(){ const host=document.getElementById('chrBody'); if(!host) return;
  const S=CHR_SECS[_chrSec]||CHR_SECS.stat;
  chrReturnBody();
  if(S.body){ const el=document.getElementById(S.body);
    if(el){ host.innerHTML=''; host.appendChild(el); S.render(); } }
  else { host.innerHTML=S.html(); }
  if(typeof paintIcons==='function') paintIcons(host); }
function setChrSec(k){ if(!CHR_SECS[k]) return; _chrSec=k;
  if(typeof _lpPicking!=='undefined') _lpPicking=false;   // 화면을 옮기면 '고르는 중'은 남기지 않는다
  renderChr();
  if(typeof navPaint==='function') navPaint(); }
// ── 🧍 스탯 구역 ────────────────────────────────────────────────────────────────
//   위 = 지금 내가 어떤 상태인지 '아주 간단히'(자세한 출처 분해는 사냥터 좌상단 프로필 팝업).
//   아래 = 레벨 포인트를 찍는 곳. 여기가 이 화면의 유일한 조작이다.
// 포인트 배수 표기 — n칸 × step 을 퍼센트로. 1.5%/칸 처럼 소수 단위면 소수로 적는다.
// ⚠ (1+n*step-1)*100 으로 되짚지 말 것 — 부동소수 오차로 1.5%가 1%로 반올림됐다(실측).
function _ptPct(n, step){ const v=n*step*100;
  return '+'+((Math.abs(v-Math.round(v))<0.01)? String(Math.round(v)) : v.toFixed(1))+'%'; }
// 카드에 찍히는 글자 — ⛔ 화면이 제 식을 따로 갖지 말 것. lpMul/rpMul 과 같은 식을 여기서만 쓴다.
//   둘 다 선형 배수(1+n·step) → '+X%'. 세기만 다르다(lp=LP_STEP · rp=RP_STEP).
// ⚠ 퍼센트는 끝없이 길어진다(만 레벨이면 +49995%). 커지면 배수 표기로 바꿔 칸 안에 남긴다.
//    실측: 299p 에서 '+1495%▸+1500%' 가 81px 이라 64px 칸을 넘쳤다.
const PT_PCT_MAX=1000;                       // 이 %를 넘으면 ×N 으로 적는다
function _ptShow(kind, k, n){ const S=lpDef(k); if(!S) return '';
  const step=(kind==='rp')? RP_STEP : S.step, pct=n*step*100;
  if(pct<PT_PCT_MAX) return _ptPct(n, step);
  const m=1+n*step;
  return '×'+(m<100? m.toFixed(1) : fmtCur(m)); }
// 축 값 표시 — 단위(%·초·×)는 축 표가 갖는다. 두 화면이 같은 표기를 쓰도록 여기 하나만 둔다.
// ⚠ 큰 수는 전부 fmtCur 를 지난다(단일 표기기) — 환생 포인트가 복리라 공격력·체력이 1e20 을 넘는다.
function csFmt(k, v){ const A=CS_AXES[k];
  if(k==='aspd') return (0.70/(v/100)).toFixed(2)+'초';
  if(k==='critd') return '×'+((v/100)<1000 ? (v/100).toFixed(2) : fmtCur(v/100));
  if(k==='regen') return (v<1e5? v.toFixed(1) : fmtCur(v))+'/s';
  if(A.unit==='%') return (v<1e5? Math.round(v) : fmtCur(v))+'%';
  return fmtCur(v); }
function renderChrStat(){ const c=CHAR(); if(!c) return '<div class="hbRoundNote">캐릭터가 없습니다.</div>';
  // ① 전투력 헤더 — 한 숫자로 '얼마나 셌는지'. 파워 표기는 여기로 합쳤다(이름 줄에서 뺀다).
  let h='<div class="csHead"><span class="csHl">전투력</span><b class="csHv">'+fmtCur(profPower())+'</b></div>';
  h+='<div class="hbRoundNote" style="padding:0 0 8px">'+escHtml(c.name)+' · Lv.'+c.level
    +(c.reb?(' · 환생 '+c.reb+'회'):'')+'</div>';
  // ② 전투 수치 = 하이라인 2열. 자세한 출처 분해는 사냥터 좌상단 프로필 팝업이 맡는다
  h+='<div class="hbGrowLbl">전투 수치 <span class="hbTblSub">좌상단 프로필에서 출처를 볼 수 있습니다</span></div>';
  h+='<div class="csGrid">'+CS_ORDER.map(function(k){
      return '<div class="csR"><span>'+CS_AXES[k].name+'</span><b>'+csFmt(k, csVal(k))+'</b></div>'; }).join('')+'</div>';
  // ② 레벨 포인트 — 이 화면의 조작
  h+=_ptListHTML('lp', c);
  return h; }
// 찍기 — 남은 포인트가 있으면 1점. 전투 중이면 그 자리에서 반영된다.
//   두 포인트가 같은 경로를 탄다(kind만 다르다) — 화면이 둘이라고 동작을 두 벌 만들지 말 것.
function _ptRepaint(){ hbSyncChar();
  if(typeof renderChr==='function') renderChr();
  if(document.getElementById('hbGrowBody') && typeof renderGrowModal==='function') renderGrowModal();
  if(typeof renderHome==='function') renderHome(); }
function ptTap(kind, k){ if(!(kind==='rp'? rpAdd(k,1) : lpAdd(k,1))) return;
  if(typeof playSfx==='function') playSfx('ui_confirm'); _ptRepaint(); }
function ptDoReset(kind){ if(!(kind==='rp'? rpReset() : lpReset())) return;
  if(typeof playSfx==='function') playSfx('ui_close'); _ptRepaint(); }
// 스킬 — 지금은 읽는 곳이다(레벨·강화는 아직 없다). 표는 HB_SKILLS 하나에서만 온다.
function _chrSkillHTML(){ let h='<div class="hbGrowLbl">사냥터 스킬</div>';
  for(const k in HB_SKILLS){ const SK=HB_SKILLS[k];
    h+='<div class="hbRow"><span class="hbRowIco">'+_icoImg('skills', SK.ico)+'</span>'
      +'<span class="hbRowTx"><b>'+SK.name+' <i>재사용 '+SK.cd+'초</i></b><em>'+SK.tip+'</em></span></div>'; }
  h+='<div class="hbRoundNote" style="padding:8px 0 0">스킬 강화는 아직 없습니다 — 사냥터 하단 바에서 직접 쓰거나 자동(A)으로 켤 수 있습니다.</div>';
  return h; }
function openUpgScreen(){ if(typeof loadMeta==='function') loadMeta();
  profEnsureChar();
  if(typeof twLeave==='function') twLeave();
  showAppScreen('upgScreen'); navShow('upg'); renderChr();
  if(typeof paintIcons==='function') paintIcons(document.getElementById('upgScreen')); }
function openGear(){ if(typeof loadMeta==='function') loadMeta();
  profEnsureChar();   // 캐릭터가 없으면 조용히 기본 유닛을 지급한다(선택 화면 없음)
  if(typeof twLeave==='function') twLeave();                                     // 마을에서 들어왔으면 루프·팝업 정리
  _gearPick=null; _gearSel=null;
  showAppScreen('gearScreen'); navShow('gear'); renderGear();
  if(typeof paintIcons==='function') paintIcons(document.getElementById('gearScreen')); }
function setGearTab(v){ if(_gearTab===v) return; _gearTab=v; _gearPick=null; _gearSel=null;
  if(typeof playSfx==='function') playSfx('ui_tab');
  if(typeof navPaint==='function') navPaint();   // 탭 띠는 하단 네비로 갔다 — 표시는 거기서 한다
  renderGear(); }
function renderGear(){ const body=document.getElementById('gearBody'); if(!body) return;
  const old=body.querySelector('.bagBody'), keep=old?old.scrollTop:0;   // 다시 그려도 가방을 보던 위치를 유지
  body.innerHTML = (_gearTab==='pet') ? _shopPetPanel('펫을 장착하면 <b>코인·공격·체력 %</b>가 오릅니다')
                 : (_gearTab==='ally') ? _gearAllyPanel()
                 : renderProfGear();
  const nb=body.querySelector('.bagBody'); if(nb&&keep) nb.scrollTop=keep;
  bagScrollHint(); }
// 🧰 정비 3탭 공용 뼈대 — 장비 화면의 구조를 펫·동료도 그대로 쓴다(2026-08-14).
//   상단 = 지금 쓰고 있는 것(슬롯) + 요약 / 하단 = 보유한 전부(격자).
//   ⛔ 새 껍데기를 만들지 말 것 — .gearWrap/.gearSum/.bagSec/.igGrid 는 장비와 같은 클래스다.
//   등급 표현은 세 탭 모두 '테두리 색'으로 통일한다(글자색·배지로 갈라 쓰지 않는다).
function _gearFrame(sum, top, headL, headR, grid, info){
  return '<div class="gearWrap">'
    +'<div class="gearSum">'+sum+'</div>'
    +top
    +'<div class="bagSec"><div class="bagHead">'+headL+'<span class="gsSub bagCnt">'+headR+'</span></div>'
    +'<div class="bagScroll"><div class="bagBody" onscroll="bagScrollHint()">'+grid+'</div></div>'
    +(info||'')
    +'</div></div>'; }
// ── 🧰 정비 상단(펫·동료) — 종류만 다르고 조작은 같다. 표 하나로 묶어 두 벌로 만들지 않는다 ──
//   한 줄 = [등급 테두리 카드] [이름·능력치·확장칸] [합성][해제]  ·  빈 자리 = [＋]
//   합성  : 슬롯의 대상을 고른 뒤 하단에서 재료를 고르면 그 재료의 경험치가 대상에 들어간다(레벨/★↑)
//   해제  : 슬롯에서 내린다 → 그 자리는 ＋ 가 된다
//   하단 탭: 팝업이 떠서 '빈 자리에 추가' 또는 '어느 슬롯과 교체'를 고른다
const MG_ADD_SLOTS=2;          // 추가 능력치·스킬이 들어갈 확장 칸(내용 미정 — 자리만)
const MG={
  pet:{ label:'펫', unit:'마리',
    max:()=>profPetSlots(),
    on:()=>((PROF().equip||[]).slice(0,profPetSlots())),
    owned:()=>Object.keys(PROF().pets||{}).filter(id=>PROF_PETS[id])
      .sort((a,b)=>GACHA_TIER_ORDER.indexOf(PROF_PETS[b].tier)-GACHA_TIER_ORDER.indexOf(PROF_PETS[a].tier)),
    has:id=>!!profPetRec(id),
    tier:id=>PROF_PETS[id].tier, ico:id=>PROF_PETS[id].emoji, name:id=>PROF_PETS[id].name,
    lvTx:id=>'★'+profPetStar(id),
    // 줄에 쓰는 짧은 능력치 — 등급은 테두리 색이 말하므로 글자로 또 쓰지 않는다
    stat:id=>PROF_BONUS_NAME[PROF_PETS[id].bonus.type]+' +'+Math.round(profPetVal(id)*100)+'%',
    exp:id=>({cur:profPetFed(id), need:profPetNeed(id), max:profPetStar(id)>=PROF_PET_STAR_MAX}),
    dup:id=>profPetDup(id), pt:id=>profPetPt(id),
    // 자동 선택 기준 — '강함' 한 줄. 등급과 ★를 함께 보므로 같은 등급이면 ★ 높은 쪽이 이긴다.
    power:id=>GACHA_TIER_ORDER.indexOf(PROF_PETS[id].tier)*1000 + Math.round(profPetVal(id)*1000),
    statOnly:id=>PROF_BONUS_NAME[PROF_PETS[id].bonus.type]+' +'+Math.round(profPetVal(id)*100)+'%',
    addSlot:()=>{ const p=PROF(); p.petSlots=Math.min(MG_SLOT_MAX,(p.petSlots||0)+1); },
    toggle:id=>profPetEquip(id), feed:(t,m)=>profPetFeed(t,m),
    sum:()=>{ const eq=PROF().equip||[];
      return '장착 <b>'+eq.length+'</b>/'+profPetSlots()+' · '
        +['atk','vit','coin'].map(k=>PROF_BONUS_NAME[k].replace(' %','')+' <b>+'+Math.round(profPetBonus(k)*100)+'%</b>').join(' · '); },
    empty:'빈 슬롯', none:'비어 있음 — 상점에서 펫을 뽑아 보세요.' },
  ally:{ label:'동료', unit:'명',
    max:()=>hbMateMax(),
    on:()=>hbParty(),
    owned:()=>Object.keys(HB_MATES).filter(hbMateOwned)
      .sort((a,b)=>GACHA_TIER_ORDER.indexOf(HB_MATES[b].tier)-GACHA_TIER_ORDER.indexOf(HB_MATES[a].tier)),
    has:id=>hbMateOwned(id),
    tier:id=>HB_MATES[id].tier, ico:id=>HB_MATES[id].ico, name:id=>HB_MATES[id].name,
    lvTx:id=>'Lv.'+hbMateLv(id),
    stat:id=>'위력 '+Math.round(hbMateDps(id)*100)+'%',
    exp:id=>({cur:hbMateFed(id), need:hbMateNeed(id), max:false}),
    dup:id=>hbMateDup(id), pt:id=>hbMatePt(id),
    power:id=>Math.round(hbMateDps(id)*1000),
    statOnly:id=>'위력 '+Math.round(hbMateDps(id)*100)+'% · '+HB_MATES[id].tip,
    addSlot:()=>{ const H=hbMates(); H.allySlots=Math.min(MG_SLOT_MAX,(H.allySlots||0)+1); },
    toggle:id=>hbMateToggle(id), feed:(t,m)=>hbMateFeed(t,m),
    sum:()=>{ const party=hbParty(); let d=0; for(const id of party) d+=hbMateDps(id);
      return '출전 <b>'+party.length+'</b>/'+hbMateMax()+' · 합계 위력 <b>'+Math.round(d*100)+'%</b>'; },
    empty:'빈 자리', none:'비어 있음 — 동료 뽑기권으로 영입하세요.' },
};
// 조작 상태 — 셋은 서로 배타적이다(하나가 켜지면 나머지는 꺼진다)
let _mgPick=null;   // 상태창: {kind,id}
let _mgSwap=null;   // 교체 대상 고르는 중: {kind,id} — 상단 세 칸이 빨갛게 변한다
let _mgMix=null;    // 합성 팝업: {kind,id,sel:{재료id:개수}}
function _mgReset(){ _mgPick=null; _mgSwap=null; _mgMix=null; }

// ── 상단 한 줄 ──
// 아직 안 산 칸 — 무엇을 내면 열리는지 그 줄에서 바로 보여 준다
function _mgLockRow(k, i){ const cost=mgSlotCost(i), can=Math.floor((PROF().pcoin||0))>=cost;
  return '<div class="mgSlot lock">'
    +'<span class="mgCard"><span class="mgIco">'+stIco('lock','🔒')+'</span></span>'
    +'<span class="mgBody"><b class="mgName">'+(i+1)+'번째 칸</b>'
    +'<em class="mgStat">'+resIco('mineral','gi')+' '+cost.toLocaleString('en-US')+' 로 열립니다</em></span>'
    +'<span class="mgBtns"><button class="mgBtn'+(can?' on':'')+'" onclick="mgBuySlot(\''+k+'\')"'+(can?'':' disabled')+'>열기</button></span></div>'; }
function _mgRow(k, id){ const M=MG[k], swapping=_mgSwap&&_mgSwap.kind===k;
  if(!id) return '<div class="mgSlot empty'+(swapping?' swapT':'')+'"'
    +(swapping?(' onclick="mgSwapTo(\'\')"'):' onclick="mgAddTap(\''+k+'\')"')+'>'
    +'<span class="mgCard"><span class="mgIco"><i class="pdPlus">＋</i></span></span>'
    +'<span class="mgBody"><b class="mgName">'+M.empty+'</b>'
    +'<em class="mgStat">'+(swapping?'여기에 넣기':'아래 목록에서 고르세요')+'</em></span></div>';
  const col=TIER_COLOR[M.tier(id)]||'#b8c0cc', ex=M.exp(id);
  // ⚠ 줄 높이는 '본문 스택'이 만든다(카드는 44px 바닥값일 뿐). 그래서 두 가지를 줄였다:
  //   ① 확장 칸을 본문 밖 오른쪽 열로 뺀다(-25px)  ② EXP 숫자를 막대와 한 줄에 놓는다(-8px)
  let add='<span class="mgAdd">';
  for(let n=0;n<MG_ADD_SLOTS;n++) add+='<button class="mgAddBtn" onclick="event.stopPropagation();mgExtTap()">＋</button>';
  add+='</span>';
  const pct=ex.max?100:Math.min(100,Math.round(ex.cur/Math.max(1,ex.need)*100));
  return '<div class="mgSlot on'+(swapping?' swapT':'')+'"'+(swapping?(' onclick="mgSwapTo(\''+id+'\')"'):'')+'>'
    +'<span class="mgCard" style="border-color:'+col+'aa;color:'+col+'"><span class="mgIco">'+M.ico(id)+'</span></span>'
    +'<span class="mgBody"><span class="mgNameRow"><b class="mgName" style="color:'+col+'">'+M.name(id)+'</b>'
      +'<i class="mgLv">'+M.lvTx(id)+'</i></span>'
      +'<em class="mgStat">'+M.stat(id)+'</em>'
      +'<span class="mgExpRow"><span class="mgExp"><i style="width:'+pct+'%"></i></span>'
        +'<em class="mgStat sm">'+(ex.max?'★ 최대':(ex.cur+'/'+ex.need))+'</em></span></span>'
    +(swapping?'<span class="mgBtns"><span class="mgSwapHint">교체</span></span>'
             :'<span class="mgBtns">'+add+'<button class="mgBtn" onclick="mgUnequip(\''+k+'\',\''+id+'\')">해제</button></span>')
    +'</div>'; }
function mgAddTap(k){ showTownToast('아래 목록에서 '+MG[k].label+'을 눌러 상태창을 여세요'); }
// 🔓 칸 열기 — 미네랄로 산다(레벨 해금이 아니다)
function mgBuySlot(k){ const M=MG[k], n=M.max(), p=PROF();
  if(n>=MG_SLOT_MAX) return;
  const cost=mgSlotCost(n);
  if(Math.floor(p.pcoin||0)<cost){ showTownToast('미네랄이 부족합니다'); return; }
  p.pcoin-=cost; M.addSlot(); saveMeta();
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof updateCurBar==='function') updateCurBar();
  showTownToast(M.label+' 칸 '+(n+1)+'/'+MG_SLOT_MAX+' 열림'); refreshTownPanel(); }
function mgExtTap(){ showTownToast('추가 능력치·스킬 칸 — 준비 중입니다'); }
function mgUnequip(k,id){ if(!MG[k].toggle(id)) return; _mgReset();
  if(typeof playSfx==='function') playSfx('ui_close'); refreshTownPanel(); }

// ⚡ 자동 선택 — 가장 강한 순서대로 정원만큼 채운다
function mgAuto(k){ const M=MG[k], mx=M.max();
  const rank=M.owned().slice().sort((a,b)=>M.power(b)-M.power(a)).slice(0,mx);
  for(const id of M.on().slice()) if(rank.indexOf(id)<0) M.toggle(id);   // 뺄 것부터 빼야 자리가 난다
  for(const id of rank) if(M.on().indexOf(id)<0) M.toggle(id);
  _mgReset(); if(typeof playSfx==='function') playSfx('ui_open');
  showTownToast('가장 강한 '+M.on().length+'을 올렸습니다'); refreshTownPanel(); }

// ── 하단 카드 탭 = 상태창 ──
function mgCellTap(k,id){
  if(_mgSwap){ showTownToast('위에서 바꿀 자리를 고르세요'); return; }
  _mgPick={kind:k,id:id}; _mgMix=null;
  if(typeof playSfx==='function') playSfx('ui_open'); refreshTownPanel(); }
function mgPickClose(){ _mgPick=null; refreshTownPanel(); }
// 교체 — 팝업을 내리고 상단을 빨갛게. 그 다음 상단에서 자리를 고른다.
function mgSwapStart(){ const P=_mgPick; if(!P) return;
  if(MG[P.kind].on().indexOf(P.id)>=0){ showTownToast('이미 올라가 있습니다'); return; }
  _mgSwap={kind:P.kind,id:P.id}; _mgPick=null;
  if(typeof playSfx==='function') playSfx('ui_open');
  showTownToast('바꿀 자리를 고르세요'); refreshTownPanel(); }
function mgSwapCancel(){ _mgSwap=null; refreshTownPanel(); }
function mgSwapTo(slotId){ const S=_mgSwap; if(!S) return; const M=MG[S.kind];
  if(slotId && !M.toggle(slotId)) return;              // 먼저 내려야 자리가 난다(빈 칸이면 건너뛴다)
  if(!M.toggle(S.id) && slotId) M.toggle(slotId);      // 실패하면 되돌린다
  _mgReset(); if(typeof playSfx==='function') playSfx('ui_open'); refreshTownPanel(); }
function _mgPickSheet(){ const P=_mgPick; if(!P) return ''; const M=MG[P.kind], id=P.id;
  if(!M.has(id)) return '';
  const col=TIER_COLOR[M.tier(id)], up=M.on().indexOf(id)>=0, ex=M.exp(id);
  return '<div class="mgSheet" onclick="if(event.target===this)mgPickClose()"><div class="mgSheetCard" style="border-color:'+col+'66">'
    +'<div class="mgSheetHead"><span class="mgEmo" style="color:'+col+'">'+M.ico(id)+'</span>'
    +'<span class="igInfoTx"><b style="color:'+col+'">'+M.name(id)+' '+M.lvTx(id)+'</b><em>'+GACHA_TIERS[M.tier(id)].name+'</em></span>'
    +'<button class="hbmX" onclick="mgPickClose()" aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"/></svg></button></div>'
    +'<div class="mgStatTbl">'
      +'<div><span>능력</span><b>'+M.statOnly(id)+'</b></div>'
      +'<div><span>경험치</span><b>'+(ex.max?'최대':(ex.cur+' / '+ex.need))+'</b></div>'
      +'<div><span>보유 중복</span><b>'+M.dup(id)+'</b></div>'
      +'<div><span>상태</span><b>'+(up?'출전 중':'대기')+'</b></div></div>'
    +'<div class="mgSheetBtns">'
      +'<button class="twBtn" onclick="mgMixOpen()"'+(ex.max?' disabled':'')+'>합성</button>'
      +'<button class="twBtn" onclick="mgSwapStart()"'+(up?' disabled':'')+'>교체</button>'
    +'</div></div></div>'; }

// ── 합성 팝업 — 등급 버튼으로 그 등급 중복을 통째로 담고, 취소/완료로 끝낸다 ──
function mgMixOpen(){ const P=_mgPick; if(!P) return;
  _mgMix={kind:P.kind, id:P.id, sel:{}}; _mgPick=null;
  if(typeof playSfx==='function') playSfx('ui_open'); refreshTownPanel(); }
function mgMixCancel(){ _mgMix=null; refreshTownPanel(); }
function _mgMixPool(){ const X=_mgMix, M=MG[X.kind], out={};
  for(const id of M.owned()){ const d=M.dup(id); if(d>0) out[M.tier(id)]=(out[M.tier(id)]||0)+d; }
  return out; }
// 등급 버튼 — 그 등급의 모든 중복을 한 번에 담는다(다시 누르면 뺀다)
function mgMixTier(t){ const X=_mgMix; if(!X) return; const M=MG[X.kind];
  const ids=M.owned().filter(id=>M.tier(id)===t && M.dup(id)>0);
  const allIn=ids.every(id=>(X.sel[id]||0)>=M.dup(id));
  for(const id of ids) X.sel[id]=allIn?0:M.dup(id);
  if(typeof playSfx==='function') playSfx('ui_tab'); refreshTownPanel(); }
function mgMixExp(){ const X=_mgMix; if(!X) return 0; const M=MG[X.kind];
  let e=0; for(const id in X.sel) e+=(X.sel[id]||0)*M.pt(id); return e; }
// 완료 — 담은 재료를 한 번에 넣는다
function mgMixApply(){ const X=_mgMix; if(!X) return; const M=MG[X.kind];
  let n=0, lv0=M.lvTx(X.id);
  for(const id in X.sel){ for(let i=0;i<(X.sel[id]||0);i++){ if(M.feed(X.id, id)) n++; } }
  _mgMix=null;
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(n) showTownToast('합성 '+n+'개 · '+M.name(X.id)+' '+M.lvTx(X.id)+(M.lvTx(X.id)!==lv0?' 달성!':''));
  else showTownToast('담은 재료가 없습니다');
  refreshTownPanel(); }
function _mgMixSheet(){ const X=_mgMix; if(!X) return ''; const M=MG[X.kind], col=TIER_COLOR[M.tier(X.id)];
  const pool=_mgMixPool(), ex=M.exp(X.id), got=mgMixExp();
  let h='<div class="mgSheet" onclick="if(event.target===this)mgMixCancel()"><div class="mgSheetCard wide" style="border-color:'+col+'66">'
    +'<div class="mgSheetHead"><span class="mgEmo" style="color:'+col+'">'+M.ico(X.id)+'</span>'
    +'<span class="igInfoTx"><b style="color:'+col+'">'+M.name(X.id)+' '+M.lvTx(X.id)+'</b>'
    +'<em>EXP '+ex.cur+' + <b class="mgGain">'+got+'</b> / '+ex.need+'</em></span></div>'
    +'<div class="mgSheetNote">등급을 누르면 그 등급의 <b>중복 전부</b>가 재료로 담깁니다</div>'
    +'<div class="mgTierRow">';
  const tiers=GACHA_TIER_ORDER.filter(t=>pool[t]);
  if(!tiers.length) h+='<span class="mgSheetNote">중복으로 얻은 '+M.label+'이 없습니다</span>';
  for(const t of tiers){ const c2=TIER_COLOR[t];
    const ids=M.owned().filter(id=>M.tier(id)===t && M.dup(id)>0);
    const inN=ids.reduce((a,id)=>a+(X.sel[id]||0),0), on=inN>0;
    h+='<button class="mgTierBtn'+(on?' on':'')+'" style="border-color:'+c2+(on?'':'66')+';color:'+c2+'"'
      +' onclick="mgMixTier(\''+t+'\')">'+GACHA_TIERS[t].name+' <i>'+(on?inN:pool[t])+'</i></button>'; }
  h+='</div>'
    +'<div class="mgSheetBtns">'
      +'<button class="twBtn" onclick="mgMixCancel()">취소</button>'
      +'<button class="twBtn on" onclick="mgMixApply()"'+(got>0?'':' disabled')+'>완료</button>'
    +'</div></div></div>';
  return h; }

// ── 하단 보유 격자 ──
function _mgGrid(k){ const M=MG[k], owned=M.owned(), on=M.on();
  if(!owned.length) return '<div class="igEmpty">'+M.none+'</div>';
  let h='<div class="igGrid">';
  for(const id of owned){ const col=TIER_COLOR[M.tier(id)]||'#b8c0cc';
    h+='<div class="igCell'+(_mgPick&&_mgPick.id===id?' sel':'')+'" style="border-color:'+col+'88;color:'+col+'"'
      +' onclick="mgCellTap(\''+k+'\',\''+id+'\')"><span class="mgEmo">'+M.ico(id)+'</span>'
      +(on.indexOf(id)>=0?'<i class="igOn"></i>':'')
      +(M.dup(id)?('<i class="igDup">'+M.dup(id)+'</i>'):'')
      +'</div>'; }   // 숫자는 칸에 넣지 않는다 — 레벨/★ 은 위 슬롯과 상태창에서 본다
  return h+'</div>'; }
// ── 패널 — 펫·동료가 같은 함수를 쓴다 ──
function _mgPanel(k, note){ const M=MG[k], on=M.on(), mx=M.max();
  let top='<div class="mgSlots">';
  for(let i=0;i<MG_SLOT_MAX;i++) top += (i<mx) ? _mgRow(k, on[i]||null) : _mgLockRow(k, i);
  if(mx>0) top+='<div class="mgAutoRow">'
    +(_mgSwap? '<button class="twBtn" onclick="mgSwapCancel()">교체 취소</button>'
             : '<button class="twBtn" onclick="mgAuto(\''+k+'\')">⚡ 자동 선택 — 가장 강한 '+mx+'</button>')
    +'</div>';
  top+='</div>';
  const hint=_mgSwap&&_mgSwap.kind===k
    ? '<div class="igEmpty sm feed">'+stIco('rebirth','🔁')+' <b>'+M.name(_mgSwap.id)+'</b> 을 넣을 자리를 <b>위에서</b> 고르세요</div>'
    : (note?'<div class="igEmpty sm">'+note+'</div>':'');
  return _gearFrame(M.sum(), top, '<span class="bagTtl">보유 '+M.label+'</span>',
    M.owned().length+M.unit, _mgGrid(k), hint+_mgPickSheet()+_mgMixSheet()); }
function _shopPetPanel(note){ return _mgPanel('pet', note||'펫을 장착하면 <b>코인·공격·체력 %</b>가 오릅니다'); }
function _gearAllyPanel(){ return _mgPanel('ally', '동료는 <b>동료 뽑기권</b>으로 영입합니다 — 사냥터 좌상단 동료 아이콘'); }
// (profDoBuyPetTicket · profDoPetEquip · gearGoHire 는 2026-08-19 삭제 — 참조 0회.
//  펫 뽑기권 구매는 onclick 의 doBuyTicket('pet'), 펫 장착은 _mgPanel 의 toggle→profPetEquip 이 실제 경로다.)
function refreshTownPanel(){ if(gearOpen()){ renderGear(); return; }              // 정비 전용 화면이 열려 있으면 그쪽을 갱신
  if(shopOpen()){ renderShop(); return; }   // 상점 전용 화면이 열려 있으면 그쪽을 갱신
  const body=document.getElementById('tpBody'), z=TOWN_PANELS[_twZone]; if(!body||!z) return;
  const old=body.querySelector('.bagBody'), keep=old?old.scrollTop:0;   // 다시 그려도 가방을 보던 위치를 유지
  body.innerHTML = z.render();
  const nb=body.querySelector('.bagBody'); if(nb&&keep) nb.scrollTop=keep;
  bagScrollHint(); }
// 가방에 더 볼 게 남았는지(스크롤 가능 여부)를 아래 그림자로 알린다
function bagScrollHint(){   // 장비창은 마을 팝업·정비 화면 두 곳에 뜬다 — 숨은 쪽을 재면 높이가 0이라 항상 어긋난다
  const s=document.querySelector((typeof gearOpen==='function'&&gearOpen()?'#gearBody':'#tpBody')+' .bagScroll'); if(!s) return;
  const b=s.querySelector('.bagBody'); if(!b) return;
  s.classList.toggle('more', b.scrollHeight-b.scrollTop-b.clientHeight>4); }
function closeTownPanel(){ popHide('townPanel'); _twZone=null; _gearPick=null; _gearSel=null; }

// 광장: 캐릭터 요약(스탯 조작은 캐릭터 화면이 맡는다)
function renderProfStats(){ const c=CHAR(); if(!c) return '<div class="twHead">캐릭터가 없습니다.</div>';
  const C=PROF_CLASSES[c.cls]||{ico:'🧍',name:'캐릭터'};
  let h='<div class="twHead">'+C.ico+' <b>'+escHtml(c.name)+'</b><br>Lv.'+c.level+' · 파워 <b>'+profPower()+'</b>'
    +(c.reb?(' · 환생 '+c.reb+'회'):'')+'<br>다음 레벨까지 '+Math.max(0,profXpForLevel(c.level)-c.xp)+' XP</div>'
    +'<div class="twStatGrid">';
  for(const k of CS_ORDER) h+='<div class="twStat"><span class="tsL">'+CS_AXES[k].name+'</span><span class="tsV">'+csFmt(k, csVal(k))+'</span></div>';
  return h+'</div>'; }
// 뽑기집: 펫 뽑기 + 보유 펫 장착
// ── 💠 재화 아이콘 단일 소스 ────────────────────────────────────────────────
// ⛔ 새 UI에서 미네랄·가스·젬·인구를 표시할 땐 **반드시 resIco()**를 쓴다. 이모지를 임의로 넣지 말 것.
//    한글 이름으로도 찾는다 — resIco('미네랄') === resIco('mineral').
// 🎟 뽑기권 3종도 여기 있다 — 세는 물건이라 재화와 같은 자리·같은 함수로 그린다(`resIco('ticket_pet')`).
//   ⚠ 이모지 🎟 를 새로 박지 말 것: 세 종류가 색으로만 갈리는데 이모지는 하나뿐이라 구분이 사라진다.
const RES_ICON={ mineral:'res_mineral', gas:'res_gas', gem:'res_gem', pop:'res_pop',
  ticket_gear:'res_ticket_gear', ticket_pet:'res_ticket_pet', ticket_ally:'res_ticket_ally',
  ticket_rune:'res_ticket_rune' };
// 파일이 아직 없는 것만 여기 적는다 — 없으면 이 글리프로 떨어지고, 파일을 넣으면 자동으로 교체된다
// (beaconProHTML·_shopArtFail 과 같은 규칙). ⛔ 표에 이모지를 직접 박지 말 것.
const RES_ICO_FB={ ticket_rune:'🔮' };
// ⚠ 한글 이름도 열쇠다 — 상점 특가는 `SHOP_GIVE_LABEL` 의 **한글 이름으로** `resIco()` 를 부른다.
//   여기 세 줄이 없으면 그 줄만 이모지 폴백(🎟)으로 떨어져 세 종류가 같은 그림이 된다.
const RES_ICON_KO={ '미네랄':'mineral', '가스':'gas', '젬':'gem', '인구':'pop',
  '장비 뽑기권':'ticket_gear', '펫 뽑기권':'ticket_pet', '동료 뽑기권':'ticket_ally',
  '룬 뽑기권':'ticket_rune' };
function resIco(k, cls){ const key=RES_ICON[k]?k:(RES_ICON_KO[k]||''), id=RES_ICON[key];
  if(!id) return '';
  const fb=RES_ICO_FB[key], c=(cls||'ri');
  return '<img class="'+c+'" src="assets/icons/'+id+'.webp" alt=""'
       + (fb? ' data-fb="'+fb+'" onerror="_resIcoFail(this)"' : '') + '>'; }
function _resIcoFail(im){ try{ im.outerHTML='<span class="'+(im.className||'ri')+'">'+(im.getAttribute('data-fb')||'')+'</span>'; }
  catch(_e){ try{ im.remove(); }catch(_e2){} } }
// ── 🎁 상점 내용(단일 소스) — 모바일 재화상점 형태: 오늘의 특가 → 뽑기 → 젬(현질) → 보유 펫 ──
// 특가는 매일 09:00 갱신(던전 열쇠와 같은 축). 3개를 다 사면 그 자리에서 새 3개가 나온다.
// 꼸러미 아이콘 파일이 없으면 원래 이모지로 복귀(빈칸 방지) — 파일을 넣으면 자동 교체
function _shopArtFail(im){ try{ im.outerHTML=im.getAttribute('data-fb')||''; }catch(_e){ try{ im.remove(); }catch(_e2){} } }
const SHOP_DEAL_POOL=[
  {id:'pet',   tag:'펫 꾸러미',   art:'🐾', gem:20,  give:{pcoin:660,  ticket_pet:1}},
  {id:'gear',  tag:'장비 꾸러미', art:'🎒', gem:35,  give:{pcoin:1200, ticket_gear:2}},
  {id:'res',   tag:'자원 꾸러미', art:'💠', gem:15,  give:{pcoin:2000, gas:120}},
  {id:'ally',  tag:'동료 꾸러미', art:'🤝', gem:60,  give:{pcoin:2500, ticket_ally:1}},
  {id:'gas',   tag:'가스 꾸러미', art:'⚡', gem:25,  give:{gas:300}},
  {id:'mega',  tag:'특급 꾸러미', art:'📦', gem:90,  give:{pcoin:6000, gas:400, ticket_gear:3}},
];
// 💎 젬 = 현질 재화(실제 결제로만 얻는다). 특가는 이 젬으로 산다.
const SHOP_GEM_PACKS=[ {n:60,won:'₩1,500'}, {n:220,won:'₩5,500'}, {n:800,won:'₩19,000'} ];
// 지급 내용 라벨 — 아이콘은 resIco()가 이름으로 자동 매칭(임의 이모지 금지)
const SHOP_GIVE_LABEL={ pcoin:'미네랄', gas:'가스', gem:'젬',
  ticket_gear:'장비 뽑기권', ticket_pet:'펫 뽑기권', ticket_ally:'동료 뽑기권' };
function shopState(){ const p=PROF(); if(!p.shop) p.shop={day:0,bought:[],cycle:0};
  const dk=_dgDayKey(); if(p.shop.day!==dk){ p.shop={day:dk,bought:[],cycle:0}; } return p.shop; }
function shopDeals(){ const st=shopState(), n=SHOP_DEAL_POOL.length, out=[];
  const base=(Math.floor(st.day/86400000)*3 + st.cycle*3) % n;          // 날짜+주기로 3개 선정(무작위 아님 = 재현 가능)
  for(let i=0;i<3;i++) out.push(SHOP_DEAL_POOL[(base+i)%n]);
  return out; }
function shopBuyDeal(id){ const p=PROF(), st=shopState(), d=SHOP_DEAL_POOL.find(x=>x.id===id); if(!d) return;
  if(st.bought.indexOf(id)>=0) return;
  if(profGem()<d.gem){ showTownToast('💎 젬이 부족합니다'); return; }
  p.gem=(p.gem||0)-d.gem;
  for(const k in d.give){ const v=d.give[k];
    if(k==='pcoin') p.pcoin=(p.pcoin||0)+v;
    else if(k==='gas') p.gas=(p.gas||0)+v;
    else if(k==='gem') p.gem=(p.gem||0)+v;
    else { const t=k.replace('ticket_',''); if(!p.tickets) p.tickets={gear:0,pet:0,ally:0}; p.tickets[t]=(p.tickets[t]||0)+v; } }
  st.bought.push(id);
  if(shopDeals().every(x=>st.bought.indexOf(x.id)>=0)){ st.cycle++; st.bought=[]; }   // 3개 다 사면 새 3개
  saveMeta(); if(typeof playSfx==='function') playSfx('hero_merge');
  renderTownBar(); refreshTownPanel(); showTownToast('🎁 '+d.tag+' 구매 완료'); }
function shopGemSoon(){ showTownToast('💎 젬 충전은 준비 중입니다'); }
// ── 🎁 상점 = 구역 5개. 하단 네비가 구역을 고르고 여기서 그 구역만 그린다 ──
// ⛔ 구역 내용을 복제하지 않는다 — 옛 renderProfGacha()가 이어 붙이던 조각을 그대로 함수로 나눴다.
function _shopDealHTML(){ const st=shopState(); let h='';
  // ① 오늘의 특가 — 패널(구역) 안에 꾸러미 칸을 담는다(HOME .hmCard 구조)
  h+='<div class="shopPanel"><div class="shopHead">오늘의 특가<em>매일 09:00 갱신</em></div><div class="shopBody">';
  h+='<div class="shopNote">특가 <b>3개</b>를 모두 구매하면 새로운 3개가 나옵니다</div>';
  for(const d of shopDeals()){ const sold=st.bought.indexOf(d.id)>=0, can=profGem()>=d.gem;
    h+='<div class="shopDeal'+(sold?' sold':'')+'"><div class="shopDealL"><span class="shopTag">'+d.tag+'</span><div class="shopGive">';
    for(const k in d.give){ const nm=SHOP_GIVE_LABEL[k]||k, ico=resIco(nm,'gi');   // 이름으로 아이콘 자동 매칭
      h+='<span>'+(ico||'<i class="giT">🎟</i>')+' '+nm+' <b>'+d.give[k].toLocaleString('en-US')+'</b></span>'; }
    h+='</div></div><div class="shopDealR"><span class="shopArt"><img src="assets/icons/shop/shop_'+d.id+'.webp" alt="" draggable="false" data-fb="'+d.art+'" onerror="_shopArtFail(this)"></span>'
      +'<button class="shopBuy" onclick="shopBuyDeal(\''+d.id+'\')"'+((sold||!can)?' disabled':'')+'>'
      +(sold?'구매완료':(resIco('gem','gi')+'<b>'+d.gem+'</b>'))+'</button></div></div>'; }
  h+='</div></div>';
  return h; }
function _shopDrawHTML(){ const p=PROF(), eq=p.equip||[]; let h='';
  // ② 뽑기(실제 기능)
  h+='<div class="shopPanel"><div class="shopHead">뽑기<em>장착 '+eq.length+'/'+profPetSlots()+'</em></div><div class="shopBody">';
  h+='<div class="shopNote">펫을 장착하면 <b>코인·공격·체력 %</b>가 오릅니다</div>';
  // 🎰 펫 뽑기 — 동료 뽑기와 같은 형태(뽑기권 + 단계별 확률 + 중복은 합성 재료)
  { const tk=profPetTicket(), nx=profPetNext();
    h+='<div class="shopRow"><div class="twRowInfo"><div class="twRowName">펫 뽑기 <span class="twStars">Lv.'+profPetLv()+'</span></div>'
      +'<div class="twRowSub'+(tk?'':' lock')+'">보유 '+resIco('ticket_pet','gi')+' '+tk+' · '
      +(nx? ('다음 단계까지 '+nx.left+'회'):'최고 단계')+' · 중복은 합성 재료</div></div>'
      +'<button class="twBtn" onclick="profDoGacha()"'+(tk?'':' disabled')+'>뽑기</button></div>';
    h+='<div class="mateOdds">';
    for(const t of PET_TIERS){ const v=profPetProbs()[t]||0;
      h+='<span class="mateOdd'+(v>0?'':' off')+'" style="color:'+(v>0?TIER_COLOR[t]:'#5a5a5a')+'">'
        +GACHA_TIERS[t].name+' <b>'+(v>0? fmtOdds(v) : '—')+'</b></span>'; }
    h+='</div>';
    h+=ticketBuyRow('pet'); }
  // 🎟 장비 뽑기권 — 자동사냥 엘리트 처치·토벌 클리어로 얻는다. 여기가 유일한 소비처.
  { const tk=((p.tickets&&p.tickets.gear)||0), full=profItems().length>=PROF_INV_MAX;
    h+='<div class="shopRow"><div class="twRowInfo"><div class="twRowName">장비 뽑기권 사용</div>'
      +'<div class="twRowSub'+(tk?'':' lock')+'">'+(full?'가방이 가득 찼습니다':('보유 '+resIco('ticket_gear','gi')+' '+tk+' · 엘리트 처치·토벌에서 획득'))+'</div></div>'
      +'<button class="twBtn" onclick="profUseGearTicket()"'+((tk&&!full)?'':' disabled')+'>뽑기</button></div>'; }
  h+='</div></div>';
  h+=_shopPetPanel();   // 뽑은 펫은 뽑기 구역에서 바로 본다(정비 '펫' 탭과 같은 함수)
  return h; }
function _shopGemHTML(){ let h='';
  // ③ 젬 — 유일한 현질 상품(실제 결제로만 얻는 재화)
  h+='<div class="shopPanel"><div class="shopHead">젬 충전<em>현금 결제</em></div><div class="shopBody">';
  h+='<div class="shopNote">젬은 <b>현금 결제</b>로만 얻습니다 · 특가 구매에 사용</div>';
  h+='<div class="shopGems">';
  for(const g of SHOP_GEM_PACKS)
    h+='<div class="shopGem"><em>'+resIco('gem','gi')+' '+g.n+'</em>'
      +'<button class="shopBuy" onclick="shopGemSoon()">'+g.won+'</button></div>';
  h+='</div></div></div>';
  return h; }
// 아직 내용이 없는 구역 — 자리는 만들되 있는 척하지 않는다(설정 하위 팝업과 같은 표기)
function _shopSoonHTML(t){ return '<div class="shopPanel"><div class="shopHead">'+t+'</div>'
  +'<div class="shopBody"><div class="setSoon">준비 중입니다</div></div></div>'; }
const SHOP_SECS={ deal:_shopDealHTML, draw:_shopDrawHTML,
  res:()=>_shopSoonHTML('재화'), pack:()=>_shopSoonHTML('패키지'), gem:_shopGemHTML };
let _shopSec='deal';
function setShopSec(k){ if(!SHOP_SECS[k]) return; _shopSec=k;
  if(typeof renderShop==='function') renderShop();
  if(typeof navPaint==='function') navPaint(); }
// 옛 호출부 호환 — '전부 이어 붙이기'. 상점 화면은 구역 하나만 그린다.
function renderProfGacha(){ return _shopDealHTML()+_shopDrawHTML()+_shopGemHTML(); }
// 보유 펫 패널은 정비 탭 쪽(_shopPetPanel)이 단일 소스다 — 상점도 그 함수를 부른다.
// 🎟 뽑기권 구매 줄 — 상점·동료 팝업이 함께 쓴다(값과 문구를 두 곳에 적지 말 것)
function ticketBuyRow(kind){ const can=profGem()>=TICKET_GEM[kind];
  return '<div class="shopRow"><div class="twRowInfo"><div class="twRowName">'+TICKET_NAME[kind]+' 뽑기권 구매</div>'
    +'<div class="twRowSub">엘리트 처치 · 맵의 상자 · 라운드 보너스로도 얻습니다</div></div>'
    +'<button class="twBtn" onclick="doBuyTicket(&#39;'+kind+'&#39;)"'+(can?'':' disabled')+'>'
    +resIco('gem','gi')+' '+TICKET_GEM[kind]+'</button></div>'; }
function doBuyTicket(kind){ if(!buyTicketGem(kind)){ showTownToast('💎 젬이 부족합니다'); return; }
  if(typeof playSfx==='function') playSfx('ui_open');
  if(typeof updateCurBar==='function') updateCurBar();
  if(typeof renderTownBar==='function') renderTownBar();
  if(shopOpen&&shopOpen()) refreshTownPanel();
  const mm=document.getElementById('hbMateModal');
  if(mm && !mm.classList.contains('hide')) renderMateModal(); }
// 장비 뽑기권 1장 = 무작위 장비 1개(등급은 최고 토벌 단계에 따라 좋아진다)
function profUseGearTicket(){ const p=PROF();
  if(!p.tickets || (p.tickets.gear||0)<=0) return;
  if(profItems().length>=PROF_INV_MAX){ showTownToast('가방이 가득 찼습니다'); return; }
  const sl=profSlots(); if(!sl.length) return;
  const it=profMakeItem(sl[Math.floor(Math.random()*sl.length)], Math.max(1, dgMaxFloor()));
  if(!it) return;
  p.tickets.gear--; profAddItem(it); saveMeta();
  if(typeof dqNote==='function') dqNote('gacha',1);   // 📅 일일 — 뽑기
  if(typeof playSfx==='function') playSfx('ui_open');
  renderTownBar(); refreshTownPanel(); showTownToast('🎟 '+profItemName(it)+' 획득'); }
function profDoGacha(){ const res=profPetRoll(); if(!res) return; if(typeof playSfx==='function') playSfx('ui_open');
  const P=PROF_PETS[res.id]; renderTownBar(); refreshTownPanel();
  showTownToast((res.isNew?'🎉 ':'♻ ')+GACHA_TIERS[res.tier].name+' '+P.name+(res.isNew?' 획득!':' — 중복 → 강화 재료')); }
// ── 장비창(위=아바타+슬롯 / 아래=가방) ──
// 아바타 = SF 파워아머 실루엣(자체 제작). 얼굴은 그리지 않고 바이저로 대신한다.
// 부위마다 닫힌 외곽선 + 배경색 채움으로 겹침을 가리고, 먼 것부터(다리 → 골반 → 몸통 → 팔 → 어깨판 → 투구) 쌓는다.
const _FIG_ATTR='viewBox="0 0 100 200" width="100%" height="100%" fill="rgba(10,14,22,.9)" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const PROF_FIGURE='<svg '+_FIG_ATTR+'>'
  /* 다리: 허벅지 → 정강이 → 부츠 (각진 판으로 끊어서 관절을 만든다) */
  +'<path d="M38 110L48 110L47 141L36 141Z"/><path d="M62 110L52 110L53 141L64 141Z"/>'
  +'<path d="M36 141L47 141L46 176L34 176Z"/><path d="M64 141L53 141L54 176L66 176Z"/>'
  +'<path d="M32 176L48 176L49.5 191L29 191Z"/><path d="M68 176L52 176L50.5 191L71 191Z"/>'
  +'<path d="M36.5 143h10M53.5 143h10" opacity=".4" fill="none"/>'
  /* 골반 장갑 */
  +'<path d="M38 95L62 95L64 111L36 111Z"/><path d="M50 96v14" opacity=".35" fill="none"/>'
  /* 흉갑 */
  +'<path d="M35 44L65 44L67 77L61 96L39 96L33 77Z"/>'
  +'<path d="M44 52L56 52L57.5 71L42.5 71Z" opacity=".45"/>'
  +'<path d="M50 46v48" opacity=".3" fill="none"/>'
  /* 팔: 상완 → 전완 → 건틀릿 (다리에 닿지 않게 짧고 좁게) */
  +'<path d="M26 60L34 60L33 85L24 85Z"/><path d="M24 85L33 85L34 109L22 109Z"/><path d="M22.5 109L33.5 109L33 120L23 120Z"/>'
  +'<path d="M74 60L66 60L67 85L76 85Z"/><path d="M76 85L67 85L66 109L78 109Z"/><path d="M77.5 109L66.5 109L67 120L77 120Z"/>'
  /* 어깨판 — 둥근 덩어리 대신 각진 장갑판 */
  +'<path d="M35 43L21 45L15 58L18.5 69L33 66.5Z"/><path d="M65 43L79 45L85 58L81.5 69L67 66.5Z"/>'
  +'<path d="M21.5 52l10-2M78.5 52l-10-2" opacity=".4" fill="none"/>'
  /* 목가리개 + 투구(얼굴 없음 · 바이저) */
  +'<path d="M45 36L55 36L56.5 44L43.5 44Z"/>'
  +'<path d="M39 24L41 12.5L50 8.5L59 12.5L61 24L61 31L55 37.5L45 37.5L39 31Z"/>'
  +'<path d="M43 19.5L57 19.5L55 29L45 29Z" opacity=".5"/>'
  +'<path d="M59.5 13L68 4.5" opacity=".65" fill="none"/></svg>';
function _profFigureHTML(){ return PROF_FIGURE; }
let _gearPick=null;   // 가방을 한 슬롯으로 거를 때 그 슬롯(null=전체)
let _gearSel=null;    // 격자에서 고른 아이템 iid(상세 팝업 대상)
let _gearPage=PROF_GEAR_PAGES[0].id;   // 페이퍼돌 페이지(방어구 ↔ 무기·장신구)
function profGearPageAt(i){ const n=PROF_GEAR_PAGES.length;
  _gearPage=PROF_GEAR_PAGES[((i%n)+n)%n].id; _gearSel=null; _gearPick=null;
  if(typeof playSfx==='function') playSfx('ui_open'); refreshTownPanel(); }
function profGearPageStep(d){ profGearPageAt(PROF_GEAR_PAGES.findIndex(p=>p.id===_gearPage)+d); }
// 가방 분류 — 페이퍼돌 섹션과 같은 축(전체 + PROF_GEAR_PAGES)이라 표기가 하나로 유지된다
function _gearPageName(){ const pg=PROF_GEAR_PAGES.find(x=>x.id===_gearPage); return pg?pg.name:'장비'; }
// 아이템 1개가 주는 스탯 합(주 스탯 + 옵션) — 비교 표시와 합계에 함께 쓴다
function _profItemStats(it){ const o={pow:0,vit:0,foc:0,agi:0}; if(!it) return o;
  const g=PROF_GEAR[it.slot]; if(g) o[g.stat]+=it.main;
  for(const x of it.opts) o[x.k]=(o[x.k]||0)+x.v;
  return o; }
// 장비창 = 위(아바타 + 부위별 슬롯) / 아래(가방) 두 구역. 가방은 늘 열려 있고 각 구역이 따로 스크롤한다.
// 섹션 이동 바(세그먼트) — 화살표 버튼이 아니라 바에서 골라 넘긴다. 목록은 PROF_GEAR_PAGES 한 곳에서만 온다.
// ── 세그먼트 이동 바(단일 소스) ─────────────────────────────────────────────
// 한 구역으로 묶고 그 안에서 나뉘는 네비. 장비창 섹션 바(장비·장신구)와 사냥터 업그레이드 탭(공격·방어·유틸)이
// 같은 컴포넌트를 쓴다 — 새 탭 띠를 만들지 말고 이 함수를 부를 것.
//   items: [{label, ico?}]  ·  i: 현재 index  ·  act(k): k번째 버튼의 onclick 문자열
// 액센트(선택 표시 밑줄)는 화면이 정한다 — 기본 시안, 사냥터 패널(.hmUpg)은 자기 빨강으로 덮는다.
function segNavHTML(items, i, act){ const n=items.length;
  const col=(items[i]&&items[i].col)||'';   // 구역색(R,G,B) — 판을 아래로 물들이는 데 쓴다. 없으면 화면 기본값
  let h='<div class="pdSeg" style="--n:'+n+'"><i class="pdSegInd" style="left:calc(var(--pad) + '+i+'*(100% - 2*var(--pad))/'+n+')'
    +(col?';--segCol:'+col:'')+'"></i>';
  items.forEach(function(it,k){ h+='<button class="pdSegBtn'+(k===i?' on':'')+'" onclick="'+act(k)+'">'
    +(it.ico?'<span data-ico="'+it.ico+'"></span>':'')+it.label
    +(it.tail||'')+'</button>'; });   // tail = 버튼 안 끝에 덧붙이는 것(친구 탭의 안 읽은 배지)
  return h+'</div>'; }
function _profPageNav(){ const i=PROF_GEAR_PAGES.findIndex(p=>p.id===_gearPage);
  return '<div class="pdNav">'+segNavHTML(PROF_GEAR_PAGES.map(p=>({label:p.name})), i, k=>'profGearPageAt('+k+')')+'</div>'; }
function _profPaperdoll(c){
  let h='<div class="pdWrap"><div class="pdFig">'+_profFigureHTML()+'</div>';
  for(const slot of profPageSlots(_gearPage)){ const g=PROF_GEAR[slot];
    const locked=profSlotLocked(slot), it=locked? null : profFindItem(c.unit.gear[slot]);
    const pos='left:'+g.x+'%;top:'+g.y+'%;';
    const cls='pdSlot'+(locked?' lock':(it?' on':' empty'))+(_gearPick===slot?' pick':'');
    h+='<div class="'+cls+'"'+(it? tierFrame(it.tier,pos) : (' style="'+pos+'"'))
      +' title="'+g.name+'" onclick="profSlotTap(\''+slot+'\')">'
      +(it? TIER_FRAME_HTML : '')
      +gearIco(slot, it&&it.tier)
      +(locked? PROF_LOCK_SVG : (it?'':'<i class="pdPlus">＋</i>'))   // 착용 칸엔 숫자 배너를 달지 않는다(테두리가 등급을 말한다)
      +'</div>'; }
  return h+'</div>'+_profPageNav(); }   // 섹션 바는 아바타 아래
function _profGearGrid(c, list){
  if(!list.length) return '<div class="igEmpty">비어 있음 — 토벌에서 장비를 구해 오세요.</div>';
  let h='<div class="igGrid">';
  for(const it of list){
    const holder=profItemHolder(it.iid), mine=(holder===c), busy=holder&&!mine;
    h+='<div class="igCell'+(_gearSel===it.iid?' sel':'')+(busy?' busy':'')+'"'+tierFrame(it.tier)
      +' onclick="profSelItem(\''+it.iid+'\')">'+TIER_FRAME_HTML+gearIco(it.slot, it.tier)
      +(mine?'<i class="igOn"></i>':'')+'</div>'; }   // 숫자는 칸에 넣지 않는다(등급은 테두리가 말한다)
  return h+'</div>'; }
// 고른 아이템 — 이름/스탯/증감/버튼을 한 덩어리로 압축(구역을 밀어내지 않게)
function _profGearInfo(c, it){ const g=PROF_GEAR[it.slot], col=TIER_COLOR[it.tier]||'#b8c0cc';
  const cur=profFindItem(c.unit.gear[it.slot]), on=(cur&&cur.iid===it.iid);
  const holder=profItemHolder(it.iid), busy=holder&&holder!==c, lk=profSlotLocked(it.slot);
  const a=_profItemStats(it), b0=_profItemStats(on?null:cur);
  const line=PROF_STATS.filter(k=>a[k]).map(k=>PROF_STAT_NAME[k]+' +'+a[k]).join(' · ');
  const diff=PROF_STATS.map(k=>{ const d=a[k]-b0[k]; if(!d) return null;
    return '<b style="color:'+(d>0?'#6ff0a0':'#ff8a9a')+'">'+PROF_STAT_NAME[k]+' '+(d>0?'+':'')+d+'</b>'; }).filter(Boolean).join(' ');
  let note='';
  if(busy) note='<span class="lock">'+escHtml(holder.name)+' 장착 중</span>';
  else if(lk) note='<span class="lock">🔒 Lv.'+g.reqLv+'부터</span>';
  else if(!on && diff) note='<span class="igArrow">→</span> '+diff;
  else if(!on && !cur) note='<span class="ok">빈 칸</span>';
  // 가방 아래로 밀어내지 않고 가방 위로 겹쳐 올라오는 팝업이다(.bagSec 기준 absolute)
  return '<div class="igInfo" style="border-color:'+col+'55">'
    +'<button class="igClose" onclick="profCloseInfo()" aria-label="닫기">✕</button>'
    +'<div class="igTxt"><div class="igName" style="color:'+col+'">'+profItemName(it)
      +' <span class="twStars">Lv.'+it.lv+'</span> <span class="igSlotTag">'+g.name+'</span></div>'
    +'<div class="igStat">'+line+(note?(' <span class="igSep">·</span> '+note):'')+'</div></div>'
    +'<div class="igBtns">'
    +((busy||lk)?'<button class="twBtn" disabled>장착</button>'
      :'<button class="twBtn'+(on?' on':'')+'" onclick="profDoEquip(\''+it.iid+'\')">'+(on?'해제':'장착')+'</button>')
    +(on||busy?'':'<button class="twBtn del" onclick="profDoScrap(\''+it.iid+'\')">분해</button>')
    +'</div></div>'; }
function profCloseInfo(){ _gearSel=null; if(typeof playSfx==='function') playSfx('ui_close'); refreshTownPanel(); }
function renderProfGear(){ const c=CHAR(); if(!c) return '<div class="twHead">캐릭터가 없습니다.</div>';
  const slot=(_gearPick && PROF_GEAR[_gearPick]) ? _gearPick : null, g=slot? PROF_GEAR[slot] : null;
  const order=PROF_ITEM_TIERS.map(t=>t.id);
  // 칸을 지정했으면 그 칸만, 아니면 분류(전체/방어구/무기·장신구)로 거른다
  // 가방은 '위 페이지'를 따라간다 — 장비 페이지면 장비만, 장신구 페이지면 장신구만.
  // ⚠ 분류 칩(_gearCat)은 없앴다. 같은 축을 두 군데서 고르게 하면 서로 어긋난다.
  const list=profItems().filter(i=>slot? (i.slot===slot) : ((PROF_GEAR[i.slot]||{}).part===_gearPage))
    .sort((a,b)=>(order.indexOf(b.tier)-order.indexOf(a.tier))||(profItemPower(b)-profItemPower(a)));
  let sum=0, n=0;
  for(const k in c.unit.gear){ const it=profFindItem(c.unit.gear[k]); if(it){ sum+=profItemPower(it); n++; } }
  const sel=profFindItem(_gearSel), hasInfo=!!(sel && (!slot || sel.slot===slot));
  let h='<div class="gearWrap">'
    +'<div class="gearSum">착용 <b>'+n+'</b>/'+Object.keys(PROF_GEAR).length+' · 장비 합계 <b>+'+sum+'</b></div>'
    +_profPaperdoll(c)                                        // 아바타 + 그 아래 섹션 이동 바
    +'<div class="bagSec"><div class="bagHead">'                // 분류 줄 + 개수를 한 줄에(높이 절약)
      +(g? ('<span class="bagTtl">'+g.name+' <span class="gsSub">'+list.length+'</span></span>'
            +'<button class="twBtn igBack" onclick="profPickBack()">전체</button>')
         : ('<span class="bagTtl">'+_gearPageName()+'</span><span class="gsSub bagCnt">'+list.length+'/'+PROF_INV_MAX+'</span>'))
      +'</div>'
    +'<div class="bagScroll"><div class="bagBody" onscroll="bagScrollHint()">'+_profGearGrid(c, list)+'</div></div>'
    +(hasInfo? _profGearInfo(c, sel) : '');   // 가방 구역 안에 겹쳐 뜨는 팝업
  return h+'</div></div>'; }
// 잠긴 칸은 조건만 알려주고, 열린 칸은 가방을 그 칸으로 거른다(다시 누르면 전체)
function profSlotTap(slot){ const g=PROF_GEAR[slot];
  if(profSlotLocked(slot)){ if(typeof playSfx==='function') playSfx('ui_close');
    showTownToast(g.name+' — Lv.'+g.reqLv+'부터 열립니다'); return; }
  if(_gearPick===slot) return profPickBack();
  _gearPick=slot; _gearSel=CHAR().unit.gear[slot]||null;
  if(typeof playSfx==='function') playSfx('ui_open'); refreshTownPanel(); }
function profSelItem(iid){ _gearSel=(_gearSel===iid)?null:iid; if(typeof playSfx==='function') playSfx('ui_open'); refreshTownPanel(); }
function profPickBack(){ _gearPick=null; _gearSel=null; if(typeof playSfx==='function') playSfx('ui_close'); refreshTownPanel(); }
function profDoEquip(iid){ if(!profEquipItem(iid)) return; if(typeof playSfx==='function') playSfx('ui_open');
  renderTownBar(); refreshTownPanel(); }
function profDoScrap(iid){ const v=profScrapItem(iid); if(v<0) return; if(_gearSel===iid) _gearSel=null;
  if(typeof playSfx==='function') playSfx('ui_close'); renderTownBar(); refreshTownPanel(); showTownToast('분해 · +'+v+' P'); }
// 훈련장(방치)
function renderProfIdle(){ const p=PROF();
  const H=PROF().hunt;
  let h='<div class="twHead">켜두면 분당 <b>'+profIdleRate().toFixed(1)+' P</b> 자동 적립.<br>'
    +((H&&H.rate>0)?('기준 = 자동사냥 실적(초당 '+H.rate.toFixed(2)+')'):'기준 = 파워(자동사냥 첫 클리어 전)')
    +'<br>껐다 켜면 최대 '+(profOfflineCapMin()/60)+'시간 · '+(profOfflineRate()*100)+'% 정산.</div><div class="twSectLbl">일하는 곳 고르기</div>';
  for(const id in PROF_IDLE_SOURCES){ const s=PROF_IDLE_SOURCES[id], locked=s.reqUnlock&&!profHasUnlock(s.reqUnlock), on=p.idle.sourceId===id;
    const reqP=(PROF_UNLOCKS.find(u=>u.id===s.reqUnlock)||{}).lv;
    h+='<div class="twRow"><div class="twRowInfo"><div class="twRowName">'+s.name+'</div><div class="twRowSub'+(locked?' lock':'')+'">'+(locked?('🔒 Lv.'+reqP+' 필요'):('배율 '+s.rate+'× · '+(s.tip||'')))+'</div></div><button class="twBtn'+(on?' on':'')+'" onclick="profDoIdle(\''+id+'\')"'+(locked?' disabled':'')+'>'+(on?'선택됨':'선택')+'</button></div>'; }
  return h; }
function profDoIdle(id){ if(profSetIdleSource(id)){ if(typeof playSfx==='function') playSfx('ui_open'); refreshTownPanel(); } }
// 관문(던전 입구 + 레벨 해금 사다리) — 던전은 허브(전용 화면)로 통합
function renderProfGate(){ const mx=dgMaxFloor();
  let h='<div class="twHead">토벌은 사냥터 하단 <b>토벌</b> 버튼 또는 아래 버튼으로 들어갑니다.<br>최고 기록 <b>'+(mx?mx+'단계':'없음')+'</b> · 개방 <b>'+dgFloorCap()+'단계</b></div>';
  h+='<div class="twRow"><div class="twRowInfo"><div class="twRowName">토벌 허브</div><div class="twRowSub">종류 선택 · 단계 도전 · 즉시 보상</div></div><button class="twBtn" onclick="openDungeonHub()">이동</button></div>';
  h+='<div class="twSectLbl">레벨 해금</div>';
  for(const u of PROF_UNLOCKS){ const open=profHasUnlock(u.id);
    h+='<div class="twRow"><div class="twRowInfo"><div class="twRowName">'+u.label+'</div><div class="twRowSub '+(open?'ok':'lock')+'">'+(open?'✓ 열림':('🔒 Lv.'+u.lv+' 필요'))+'</div></div></div>'; }
  return h; }

