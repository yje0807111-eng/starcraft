// ══════════════════════════════════════════════════════════════════════════
// 💠 룬 — 젬으로 사서 슬롯에 끼우는 성장 축 (2026-09-02 사용자 확정)
// ══════════════════════════════════════════════════════════════════════════
// ⭐ **왜 따로 두는가** — 연구·환생 트리는 「사면 계속 쌓인다」인데, 룬은 **골라 끼운다**.
//   칸이 한정이라 하나를 넣으면 하나를 빼야 한다. 그래서 성장이 아니라 **선택**이 축이다.
//
// ⚠ **GEM.md §6 「젬으로 영구 능력을 팔지 않는다」를 뒤집는 결정이다**(사용자 확정 2026-09-02).
//   뒤집어도 되는 근거 둘:
//     ① **칸이 라운드로 열린다** — 돈으로 칸을 앞당길 수 없다. 진행이 문이다.
//     ② **칸이 한정이다** — 사 모아도 동시에 켜지는 것은 정해진 수뿐이라 쌓이지 않는다.
//   ⛔ 이 둘 중 하나라도 무너지면(젬으로 칸을 열거나, 칸을 무한히 늘리면) 젬이 곧 지수 축이 된다.
//
// ⛔ **효과는 합이다. 곱이 아니다**(GEM.md §5-2 — 실측으로 한 번 터진 규칙 ×1,900만).
//   룬 셋이 각 +20% 면 ×1.6 이지 ×1.728 이 아니다. `campRuneEff()` 가 그 단일 입구다.
//
// ⚠ **지금은 뼈대다** — 효과를 실제로 쓰는 곳(수입·전투·속도)에는 **아직 배선하지 않았다**.
//   `campRuneEff(key)` 만 준비돼 있고 아무도 부르지 않는다. 값도 **임시**다(아래 표 주석).
//
// 순서: 19-camp.js 의 `campState`·`campSave`·`CAMP_ROUND_MAX` 를 읽으므로 **뒤에 와야 한다.**

// ── 등급 ────────────────────────────────────────────────────────────────
// 일반 룬은 하급·중급·상급 셋. 유니크는 등급이 없다(그 자체가 한 등급).
const RUNE_GRADES = ['low', 'mid', 'high'];
const RUNE_GD = {
  low:  { tx:'하급', col:'#8b95a5' },
  mid:  { tx:'중급', col:'#5cd6ff' },
  high: { tx:'상급', col:'#ffcf6b' },
  uniq: { tx:'유니크', col:'#c98bff' } };

// ── 룬 표 ───────────────────────────────────────────────────────────────
// ⚠ **여기 값은 전부 임시다.** 등급별 수치·젬 값은 사용자가 정한다(스킬 때와 같은 방식).
//   확정되면 이 표가 단일 소스가 되고, 문서는 `GEM.md` §8 이 받는다.
// kind:'norm' — 일반 칸에 끼운다. v/gem 은 **등급별 표**.
// kind:'uniq' — 유니크 칸(3개)에만 끼운다. **다른 룬에 없는 능력**이라 등급이 하나다.
// eff — 효과 키. `campRuneEff(eff)` 가 이 키로 합을 낸다.
// ── 룬 표 (2026-09-02 값 확정) ──────────────────────────────────────────
// ⭐ **종류가 칸보다 많아야 「고르는 것」이 된다.** 일반 10종 / 5칸 · 유니크 4종 / 3칸.
//   ⛔ 종류 = 칸 이면 전부 끼워지므로 고를 것이 없어진다 — 그러면 이 시스템은 그냥 「연구 2」다.
// kind:'norm' — 일반 칸에 끼운다. 하급·중급·상급 세 등급.
// kind:'uniq' — 유니크 칸(3개)에만. **다른 룬에 없는 능력**이라 등급이 하나다.
// eff — 효과 키. `campRuneEff(eff)` 가 이 키로 합을 낸다. 값은 전부 **더할 비율**이다.
//   ⛔ 감소형(쿨타임·비용 −%)을 넣지 말 것 — 합산이라 100% 를 넘으면 부호가 뒤집힌다.
//     넣으려면 상한을 함께 설계해야 한다(지금은 전부 증가형이라 그 문제가 없다).
// ── 🗺 **구역(성좌) — 넣을 수 있는 룬이 정해져 있다** (2026-09-04 사용자 확정) ──
//   ⭐ 성좌 셋이 곧 세 갈래다. 위=경제 · 왼쪽=전투 · 오른쪽=성장.
//     ⛔ 아무 칸에나 아무 룬을 끼우게 되돌리지 말 것 — 한 성좌 안에서 색이 섞여
//       무엇을 모아 놓은 판인지 읽히지 않는다(사용자 지적).
//   ⚠ 순서는 RUNE_CT(성좌 중심 좌표)와 **같은 순서**다. 한쪽만 고치면 색과 자리가 어긋난다.
const RUNE_GRPS = ['eco', 'war', 'grow'];
const RUNE_GRP = {
  eco:  { nm:'경제', col:'#7effc9' },
  war:  { nm:'전투', col:'#ffa3b8' },
  grow: { nm:'성장', col:'#e6eef8' },
  uniq: { nm:'유니크', col:'#ffe08a' } };
// 일반 i번 칸이 속한 갈래 — 성좌 하나가 통째로 한 갈래다
function runeSlotGrp(i){ return RUNE_GRPS[Math.floor(i / RUNE_CONS)] || RUNE_GRPS[0]; }

const RUNE_LIST = [
  // ── 일반 12종 = 갈래 4종 × 3 ── 값은 RUNE_VAL 이 정한다(하급 1% · 중급 2.5% · 상급 5%)
  // ⚠ 「재화의 룬」(gain · 탭+채취)은 2026-09-03 에 지웠다 — 손끝의 룬을 **품고 있어서**
  //   젬 값이 같으면 손끝을 살 이유가 없었다. ⛔ 되살리려면 손끝과 겹치지 않게 갈라야 한다.
  // ⚠ 「증원의 룬」(pop · 인구 상한)은 2026-09-04 에 뺐다 — 환생 구역에서 200 을 그냥 찍을 수
  //   있어서 룬으로 1~5% 를 더하는 것이 의미가 없었다(사용자 지적).
  // ⚠ 건설·생산·연구 **속도** 룬도 접었다 — 캠프에서 그 시간이 병목이 아니다.

  // 💠 경제 — 캠프에서 버는 것
  { id:'tap',   nm:'손끝의 룬',   kind:'norm', grp:'eco',  eff:'tap',     ico:'coin',
    de:'탭 획득량' },
  { id:'gas',   nm:'정제의 룬',   kind:'norm', grp:'eco',  eff:'gas',     ico:'box',
    de:'가스 획득' },
  // ⚠ 손끝(손으로 누를 때)과 **다른 자리**다 — 이쪽은 일꾼이 왕복해서 캐는 양이다.
  { id:'mine',  nm:'채굴의 룬',   kind:'norm', grp:'eco',  eff:'mine',    ico:'upg',
    de:'일꾼 채취량' },
  { id:'reb',   nm:'윤회의 룬',   kind:'norm', grp:'eco',  eff:'rebPts',  ico:'new',
    de:'환생 포인트 획득' },

  // ⚔ 전투 — 던전에서 싸우는 것
  { id:'atk',   nm:'힘의 룬',     kind:'norm', grp:'war',  eff:'atk',     ico:'upg',
    de:'유닛 공격력' },
  { id:'aspd',  nm:'연타의 룬',   kind:'norm', grp:'war',  eff:'aspd',    ico:'upg',
    de:'유닛 공격속도' },
  { id:'hp',    nm:'수호의 룬',   kind:'norm', grp:'war',  eff:'hp',      ico:'armor',
    de:'유닛 체력' },
  { id:'heal',  nm:'치유의 룬',   kind:'norm', grp:'war',  eff:'heal',    ico:'hero',
    de:'회복량' },

  // 🌱 성장 — 레벨과 바깥 보상
  // ⚠ **레벨 시스템은 아직 없다**(2026-09-04). 이 둘은 자리를 먼저 잡아 둔 것이라 지금은
  //   아무 일도 안 한다 — 열기의 룬이 피버를 안 열었을 때와 같다. 상점에서 그렇게 알린다.
  { id:'exp',   nm:'성장의 룬',   kind:'norm', grp:'grow', eff:'exp',     ico:'hero',
    de:'경험치 획득량', soon:true },
  // ⚠ **아직 닿는 데가 없다**(2026-09-04 실측: campRuneEff('killGain') 을 부르는 곳이 0곳).
  //   적 처치 보상이라는 자리를 먼저 잡아 둔 것이다 — 배선하면 soon 을 지운다.
  { id:'kill',  nm:'전과의 룬',   kind:'norm', grp:'grow', eff:'killGain',ico:'upg',
    de:'적 처치 보상', soon:true },
  // ⚠ 2026-09-04 에 **유니크 → 일반**으로 내려왔다(성장 갈래를 채우려고).
  //   ⛔ 젬에는 안 건다 — 젬은 현질 재화다(GEM.md).
  { id:'mapg',  nm:'전리품의 룬', kind:'norm', grp:'grow', eff:'mapGain', ico:'map',
    de:'유즈맵 보상 재화' },
  // ⚡ 피버 **획득량**(배수)이다. 열기의 룬(확률)과 다른 자리.
  //   ⚠ 예전 주석은 「배수에 붙이면 상시 배수가 된다」고 막았다. 2026-09-04 사용자 확정으로
  //     연다 — 피버 자체를 **짧게·약하게·확률 낮게·쿨 길게** 유지한다는 전제다.
  //     ⛔ 그 전제가 깨지면(피버가 길어지거나 흔해지면) 이 룬부터 다시 재야 한다.
  { id:'fevg',  nm:'열정의 룬',   kind:'norm', grp:'grow', eff:'fevGain', ico:'boost',
    de:'피버 획득량' },

  // ── 유니크 4종 — **다른 데서 못 사는 것**이라 칸이 셋뿐이다 ──
  // ⚠ **가속의 룬은 유별나게 세다.** 실측(2026-09-02 · BALANCE §3-2-7): +10% 가 45분 누적
  //   수입을 **+60%** 로 만들었다(누적 증폭 4.9제곱 — 결제 팩 1.63제곱보다 3배 가파르다).
  //   다른 룬은 축 하나를 키우지만 이것은 **시간 자체**라 모든 축에 곱해진다.
  { id:'speed', nm:'가속의 룬',   kind:'uniq', grp:'uniq', eff:'speed',   ico:'boost',
    de:'캠프 전체 진행 속도' },
  // ⭐ 이동속도 룬은 **일꾼 하나뿐**이다(2026-09-02). 「유닛 이동속도」는 뺀 축이다.
  { id:'wspd',  nm:'신속의 룬',   kind:'uniq', grp:'uniq', eff:'wspd',    ico:'boost',
    de:'일꾼 이동속도' },
  // ⚡ **확률**을 올린다(지속·배수가 아니다). 배수는 열정의 룬이 맡는다.
  //   ⚠ 환생 트리에서 피버를 안 열었으면 이 룬도 아무 일을 안 한다.
  { id:'fever', nm:'열기의 룬',   kind:'uniq', grp:'uniq', eff:'fever',   ico:'new',
    de:'피버 발동 확률' },
  // 💰 **유일한 감소형이다.** 코드 규칙은 감소형을 막는다(합산이 100% 를 넘으면 부호가 뒤집힌다).
  //   ⭐ 그래서 **상한을 함께 둔다** — 유니크 칸이 셋이고 룬당 0.5% 라 최대 1.5% 다.
  //     ⛔ 값을 올리거나 다른 구역에서 같은 축을 건드리지 말 것(2026-09-04 사용자 확정:
  //       「오로지 룬 3개로만」). 올리려면 RUNE_COST_CAP 을 함께 손봐야 한다.
  { id:'cost',  nm:'절약의 룬',   kind:'uniq', grp:'uniq', eff:'costCut', ico:'gift',
    v:0.005, de:'구매 비용 감소' } ];
// 💰 구매 비용 감소의 **뚜껑** — 위 절약의 룬 설명 참고. 합이 이 값을 넘지 않는다.
const RUNE_COST_CAP = 0.015;

// ── 📏 **효과 값 — 등급이 정한다** (2026-09-02 사용자 확정: 「전부 1~5% 로」) ──
// ⭐ **룬은 게임을 심하게 바꾸면 안 된다.** 앞 값(상급 15~35%)은 다 갖추면 수입 ×1.47 ·
//   라운드 +6 이었다(BALANCE §3-2-7). 그 폭이 「조금 도와주는 것」의 선을 넘었다.
// ⭐ **룬마다 값을 다르게 두지 않는다.** 1~5% 안에서 룬끼리 1%p 를 다투게 만들어 봐야
//   실측 흔들림(판마다 ±40%)에 묻힌다 — 고르는 이유는 **세기가 아니라 무슨 축이냐**여야 한다.
// ⛔ 이 값을 두 자릿수로 되돌리지 말 것. 그러면 룬이 「연구 2」가 된다.
const RUNE_VAL = { low:0.01, mid:0.025, high:0.05 };
// 유니크 값 — **넷 다 같다**(2026-09-03 사용자 확정). 한동안 가속만 2.5% 였으나 접었다.
//   ⚠ 룬 하나가 제 값을 가지려면 표에 v 를 적으면 된다(지금은 아무도 안 쓴다).
const RUNE_VAL_UNIQ = 0.05;

// ── 💎 값 — **등급이 정한다. 룬마다 따로 두지 않는다** ────────────────────
// ⭐ **등급이 오를수록 %당 값이 비싸다**(10 → 13 → 20 젬/%). 손해처럼 보이지만 맞다 —
//   여기서 진짜 귀한 것은 %가 아니라 **칸**이다. 상급은 같은 효과를 **한 칸으로** 낸다.
//   ⛔ 「상급이 %당 싸게」 뒤집지 말 것. 그러면 하급을 살 이유가 사라져 등급이 셋일 뜻이 없어진다.
// 관례 대조(GEM.md §5-4-4): 젬당 16~22원 → 상급 400젬 ≈ ₩7,000 · 유니크 1,200젬 ≈ ₩20,000.
// ⚠ **효과 값이 4배 낮아졌는데 젬 값은 그대로다**(2026-09-02). 상급 400젬(≈₩7,000)에
//   +5% 라 %당 값이 8,000원꼴이다 — 앞 표(+20% · 2,000원꼴)보다 네 배 비싸다.
//   ⛔ 함부로 내리지 말 것 — **가격은 사용자 결정**이다. 다만 값을 정할 때 이 사실을 볼 것.
const RUNE_GEM = { low:40, mid:130, high:400 };
const RUNE_GEM_UNIQ = 1200;

// ── 슬롯 해금 — **최대 도달 라운드**가 연다 ───────────────────────────────
// ⭐ 「최대」다. 환생으로 되감겨도 **한 번이라도 닿았으면 남는다**(사용자 확정 2026-09-02).
//   그래서 기준은 `C.best`(환생이 지우지 않는 값)이지 지금 라운드가 아니다.
// 던전 10 × 50라운드 = 통산 500 이 상한이다.
//   ⭐ 일반 첫 칸은 처음부터 열려 있다 — 아무것도 못 끼우는 화면은 「준비 중」으로 읽힌다.
//   ⭐ 유니크 첫 칸은 R120(던전 3 중반) — 유니크는 **후반의 물건**이라야 자리가 귀해진다.
//   ⭐ **성좌 셋**(2026-09-03 사용자 확정 · 목업 docs/mock/camp-rune-8.html ②안).
//     일반 24칸이 8칸씩 세 무리로 갈리고, **한 무리를 다 열면 그 한가운데 유니크가 열린다.**
//     15라운드마다 한 칸 → 8칸(R0~105) → 유니크 R120 → 다음 무리(R140~245) → 유니크 R260 → …
//     ⛔ 순서를 흩뜨리지 말 것 — 「성좌 하나를 완성하면 그 중심이 켜진다」가 판의 규칙이고,
//       그게 무너지면 유니크가 왜 셋인지 그림으로 설명되지 않는다.
//     ⚠ 칸이 5 → 24 로 늘었다. 효과 상한도 그만큼 늘었다(상급만 채우면 축 하나에 +120%).
//       값(RUNE_VAL 1~5%)은 5칸 시절에 정해진 것이라 **다시 재야 한다** — BALANCE §3-2-7.
const RUNE_SLOT_R = {
  norm: [0, 15, 30, 45, 60, 75, 90, 105,           // 성좌 ①
         140, 155, 170, 185, 200, 215, 230, 245,   // 성좌 ②
         280, 295, 310, 325, 340, 355, 370, 385],  // 성좌 ③
  uniq: [120, 260, 400] };       // 성좌마다 한가운데 하나
const RUNE_CONS = 8;             // 성좌 하나에 든 일반 칸 수 (24 = 8 × 3)

// ── 🌌 판 좌표 — 유니크가 중심, 일반 8칸이 고리로 둘러싼다 ───────────────
//   ⚠ SVG viewBox 안의 값이다(화면 크기와 무관). 기기마다 판이 통째로 확대·축소된다.
//   🔺 **삼각 배치**(2026-09-03 사용자 확정) — 위 하나 · 아래 둘.
//     ⛔ 지그재그로 되돌리지 말 것. 셋이 사선으로 늘어서면 아래 성좌가 화면 밖으로 밀려
//       「전체 보기」 배율이 뚝 떨어진다(실측).
//     ⚠ 판 폭이 440 인 것은 아래 두 성좌를 벌리기 위해서다 — 390 이면 둘이 붙어 한 덩어리로 보인다.
const RUNE_MAP_W = 440, RUNE_MAP_H = 560;
// 🔺 성좌 셋의 중심 — 판 한가운데를 도는 **작은 삼각**(2026-09-04 사용자 확정: 「더 작은 삼각형 · 간격을 좁혀」).
//   ⭐ 세 자리를 손으로 찍지 않고 **반지름 하나(RUNE_TRI)** 로 낸다 — 좁히고 싶으면 그 숫자만 바꾼다.
//   ⚠ 성좌끼리 안 겹치는 하한이 있다: 이웃 중심 사이 = RUNE_TRI×√3 이고,
//     성좌 하나가 차지하는 반지름은 RUNE_RING + 칸 바깥(25.6) = 97.6 이다.
//     따라서 RUNE_TRI ≥ 2×97.6/√3 = 112.7. 지금 120 은 12 남짓 여유가 있다.
//   ⛔ 옛 값([[220,130],[92,400],[348,400]])으로 되돌리지 말 것 — 세로로 456 을 써서 판이 헐렁했다.
const RUNE_TRI = 132;
//   ⚠ 순서는 **위 · 왼쪽 · 오른쪽** 이다 — RUNE_GRPS(경제·전투·성장)와 짝이라
//     각도를 바꾸면 전투와 성장이 좌우로 뒤집힌다(2026-09-04 에 실제로 뒤집혔다).
const RUNE_CT = [-90, 150, 30].map(function(deg){
  const a = Math.PI / 180 * deg;
  return [Math.round(RUNE_MAP_W / 2 + Math.cos(a) * RUNE_TRI),
          Math.round(RUNE_MAP_H / 2 + Math.sin(a) * RUNE_TRI)]; });
// 🎯 중심에서 고리까지 — 유니크 쪽으로 **더 모은다**(2026-09-04 사용자 확정: 「더 작은 원」).
//   ⚠ 하한이 있다: 이웃 칸끼리(2·RING·sin(π/8))와 가운데 유니크 사이가 둘 다 안 겹쳐야 한다.
//     칸 바깥은 고리 칸 23.5(상급 링 포함) · 유니크 37.6 이라 **RING ≥ 61.4** 다.
//     지금 64 는 이웃 2.0 · 중심 2.9 만큼 남는다. ⛔ 60 이하로 내리지 말 것 — 겹친다(스모크가 잰다).
const RUNE_RING = 64;
const RUNE_R_N = 21, RUNE_R_U = 33;                    // 육각 반지름(일반 · 유니크)
// 일반 i번 칸의 자리 — 성좌 ci 의 j번째. 12시에서 시계방향.
function campRuneNPos(i){
  const ci = Math.floor(i / RUNE_CONS), j = i % RUNE_CONS, c = RUNE_CT[ci] || RUNE_CT[0];
  const a = -Math.PI / 2 + j / RUNE_CONS * Math.PI * 2;
  return [c[0] + Math.cos(a) * RUNE_RING, c[1] + Math.sin(a) * RUNE_RING]; }
function campRuneUPos(i){ return RUNE_CT[i] || RUNE_CT[0]; }

// 통산 최대 도달 라운드. 던전이 넘어가면 라운드가 1로 돌아가므로 **한 줄로 펴서** 센다.
//   D1 R50 = 50 · D2 R10 = 60 · D10 R50 = 500.
function campRuneBestRound(){
  const C = (typeof campState === 'function') ? campState() : null;
  if(!C || !C.best) return 0;
  const per = (typeof CAMP_ROUND_MAX !== 'undefined') ? CAMP_ROUND_MAX : 50;
  let m = 0;
  for(const k in C.best){ const dg = k | 0; if(dg < 1) continue;
    const r = (dg - 1) * per + (C.best[k] | 0); if(r > m) m = r; }
  return m; }
// 열린 칸 수 — 표에서 「도달 라운드 이하」인 것을 센다
function campRuneSlots(kind){ const tb = RUNE_SLOT_R[kind] || [];
  if(CAMP_RUNE_FREE) return tb.length;          // 🔧 전부 열어 둔다(위 스위치)
  const b = campRuneBestRound();
  let n = 0; for(const r of tb) if(b >= r) n++; return n; }

// ── 상태 ────────────────────────────────────────────────────────────────
// `C.rune` 에 산다 = **환생해도 남는다**(campRebirth 의 keep 목록에 넣었다).
//   own : { '룬키': 개수 } · norm/uniq : 슬롯 배열(값은 룬키 또는 null)
function campRuneState(){
  const C = (typeof campState === 'function') ? campState() : null; if(!C) return null;
  if(!C.rune || typeof C.rune !== 'object') C.rune = {};
  const R = C.rune;
  if(!R.own || typeof R.own !== 'object') R.own = {};
  if(!Array.isArray(R.norm)) R.norm = [];
  if(!Array.isArray(R.uniq)) R.uniq = [];
  return R; }

// ── 룬 키 — 일반은 `id:등급`, 유니크는 `id` ───────────────────────────────
function runeDef(id){ for(const d of RUNE_LIST) if(d.id === id) return d; return null; }
function runeKey(id, gd){ const d = runeDef(id); if(!d) return '';
  return (d.kind === 'uniq') ? d.id : (d.id + ':' + gd); }
function runeParse(key){ const s = String(key || '').split(':');
  const d = runeDef(s[0]); if(!d) return { def:null, gd:'' };
  return { def:d, gd:(d.kind === 'uniq') ? 'uniq' : (s[1] || '') }; }
// 📏 효과 값도 **등급 표**가 정한다(RUNE_VAL). 룬이 제 값을 갖고 싶으면 def.v 로 덮는다.
//   ⛔ 룬마다 값을 흩뿌리지 말 것 — 젬 값(runeGem)과 같은 원칙이다.
function runeVal(key){ const p = runeParse(key); if(!p.def) return 0;
  if(p.def.kind === 'uniq') return (p.def.v != null) ? p.def.v : RUNE_VAL_UNIQ;
  if(p.def.v && p.def.v[p.gd] != null) return p.def.v[p.gd];
  return RUNE_VAL[p.gd] || 0; }
// 💎 값은 **등급 표**가 정한다(RUNE_GEM). 룬이 제 값을 갖고 싶으면 def.gem 으로 덮는다.
//   ⛔ 룬마다 값을 흩뿌리지 말 것 — 값을 손볼 때 한 곳만 고치면 되게 둔다.
function runeGem(key){ const p = runeParse(key); if(!p.def) return 0;
  if(p.def.kind === 'uniq') return p.def.gem || RUNE_GEM_UNIQ;
  if(p.def.gem && p.def.gem[p.gd]) return p.def.gem[p.gd];
  return RUNE_GEM[p.gd] || 0; }
// 🔷 **룬 그림은 판까지 포함된 한 장이다**(assets/icons/rune/<id>_<등급>.webp · 2026-09-04).
//   판(육각 타일 4색)과 문양(11종)을 scripts/rune-compose.mjs 가 겹쳐 만든 25장이다.
//   ⭐ 등급 색이 그림 안에 들어 있으므로 **키 하나로 등급까지 보여 준다** —
//     칸·가방·상점이 같은 함수를 쓰고, 따로 색을 입히지 않는다.
//   ⛔ 옛 data-ico(공용 아이콘 세트)로 되돌리지 말 것 — 그건 등급을 못 나타낸다.
// 🔷 **성좌 판은 문양만 쓴다**(2026-09-04 사용자 확정 · 목업 camp-rune-vec47-6 ④안).
//   판(육각)은 도형으로 그린다 — 그래야 등급 색이 테두리·뒷광·번짐에 실려 **상태에 반응**한다.
//   ⛔ 판까지 합친 그림(runeIcoSrc)으로 되돌리지 말 것 — 그건 배경과 상호작용이 없어 스티커처럼 얹혔다.
//   ⚠ 가방·상점은 여전히 합친 그림을 쓴다(HTML 이라 SVG 도형을 못 쓴다) — 둘 다 필요하다.
function runeGlyphSrc(key, grp){ const p = runeParse(key);
  if(!p.def) return '';
  const suf = (p.gd === 'uniq' && grp && grp !== 'uniq') ? ('_' + grp) : '';
  return 'assets/icons/rune/glyph/' + p.def.id + suf + '.webp'; }

//   🎨 유니크는 **앉은 성좌의 색**을 따른다(2026-09-04 사용자 확정) — grp 를 주면 그 벌을 준다.
//     ⚠ 가방·상점처럼 성좌가 없는 자리에서는 기본(금)을 쓴다.
function runeIcoSrc(key, grp){ const p = runeParse(key);
  if(!p.def || !p.gd) return '';
  const suf = (p.gd === 'uniq' && grp && grp !== 'uniq') ? ('_' + grp) : '';
  return 'assets/icons/rune/' + p.def.id + '_' + p.gd + suf + '.webp'; }
function runeIcoHTML(key, cls, grp){ const src = runeIcoSrc(key, grp);
  if(!src) return '';
  return '<img class="' + (cls || 'rnIco') + '" src="' + src + '" alt="" draggable="false">'; }
function runeName(key){ const p = runeParse(key); if(!p.def) return '';
  return (p.def.kind === 'uniq') ? p.def.nm : (RUNE_GD[p.gd] ? RUNE_GD[p.gd].tx + ' ' + p.def.nm : p.def.nm); }
// 표기 — 값은 전부 「+n%」다(합산 항이므로)
// ⚠ **소수점을 반올림해 버리지 말 것.** 2.5% 를 「3%」로 적으면 표기와 실제가 어긋난다.
//   딱 떨어지는 값(20%)에는 소수점을 안 붙인다 — 거짓 정밀도로 보인다.
function runeValTx(key){ const v = runeVal(key), p = v * 100;
  const t = (Math.abs(p - Math.round(p)) < 0.05) ? String(Math.round(p)) : p.toFixed(1);
  return (v > 0 ? '+' : '') + t + '%'; }

// ── 보유 · 구매 ──────────────────────────────────────────────────────────
// 🔧 **룬을 다 갖고 칸도 다 열린 상태**로 보는 스위치 (2026-09-04).
//   ⭐ 환생 포인트 무제한(CAMP_RT_PTS_FREE)과 같은 성격이다 — 게임 안에서 눈으로 확인하려는 문.
//   ⚠ **읽기만 바꾼다.** 저장(R.own)에는 손대지 않으므로 끄면 원래 보유로 돌아온다.
//   ⛔ 켠 채로 커밋하지 말 것 — 상점에서 살 이유가 사라진다. 스모크가 이 값을 잰다.
let CAMP_RUNE_FREE = true;              // ⚠ let 이다 — 스모크가 끄고 정상 규칙을 잰다
const CAMP_RUNE_FREE_N = 9;              // 켰을 때 종류마다 갖고 있다고 치는 개수
function campRuneOwn(key){
  if(CAMP_RUNE_FREE) return runeParse(key).def ? CAMP_RUNE_FREE_N : 0;
  const R = campRuneState(); return R ? ((R.own[key] | 0)) : 0; }
// 지금 몇 개가 끼워져 있나 — 보유보다 많이 끼울 수 없다
function campRuneEqCount(key){ const R = campRuneState(); if(!R) return 0; let n = 0;
  for(const kind of ['norm', 'uniq']) for(const k of R[kind]) if(k === key) n++;
  return n; }
function campRuneFree(key){ return campRuneOwn(key) - campRuneEqCount(key); }
// 💎 젬으로 산다. ⛔ 다른 재화를 받지 않는다(사용자 확정 2026-09-02).
function campRuneBuy(id, gd){
  const key = runeKey(id, gd); const R = campRuneState(); if(!key || !R) return false;
  const say = m => { if(typeof toast === 'function') toast(m); };
  // 📦 **한 종류는 여덟 개까지** — 넘으면 아예 못 산다(버튼도 잠근다)
  if(campRuneOwn(key) >= RUNE_OWN_MAX){
    say('이 룬은 ' + RUNE_OWN_MAX + '개까지만 가질 수 있습니다'); return false; }
  // 💎 값은 runeNowGem 하나가 정한다 — 할인 재고가 남아 있으면 할인가다
  const sale = runeOnSale(key);
  const cost = runeNowGem(key); if(cost <= 0) return false;
  const p = (typeof PROF === 'function') ? PROF() : null; if(!p) return false;
  const have = (typeof profGem === 'function') ? profGem() : 0;
  if(have < cost){ say('💎 젬이 부족합니다'); return false; }
  p.gem = (p.gem || 0) - cost;
  if(sale){ const w = runeSaleState(); if(w) w.sold[key] = 1; }   // 📦 그 주의 재고 하나를 쓴다
  R.own[key] = (R.own[key] | 0) + 1; campRuneTouch();
  if(typeof saveMeta === 'function') saveMeta();
  if(typeof playSfx === 'function') playSfx('hero_merge');
  if(typeof toast === 'function') toast('💠 ' + runeName(key) + ' 획득');
  campRuneRender(); return true; }

// ── 장착 ────────────────────────────────────────────────────────────────
// 규칙 셋. ⛔ 하나라도 빼면 「칸이 한정」이라는 전제가 무너진다(맨 위 주석).
//   ① 갈래가 맞아야 한다 — 유니크 룬은 유니크 칸에만
//   ② 열린 칸이어야 한다
//   ③ 보유한 만큼만 — 같은 룬을 두 칸에 끼우려면 두 개 있어야 한다
function campRuneCanEquip(kind, i, key){
  const R = campRuneState(); if(!R) return false;
  const p = runeParse(key); if(!p.def) return false;
  if((p.def.kind === 'uniq' ? 'uniq' : 'norm') !== kind) return false;
  if(i < 0 || i >= campRuneSlots(kind)) return false;
  // 🗺 **성좌마다 들어갈 갈래가 정해져 있다**(2026-09-04 사용자 확정 · RUNE_GRPS 설명).
  //   ⛔ 이 줄을 빼지 말 것 — 한 성좌 안에서 색이 섞이면 무엇을 모은 판인지 안 읽힌다.
  if(kind === 'norm' && p.def.grp && p.def.grp !== runeSlotGrp(i)) return false;
  const cur = R[kind][i] || null;
  return campRuneFree(key) > 0 || cur === key; }
function campRuneEquip(kind, i, key){
  if(!campRuneCanEquip(kind, i, key)) return false;
  const R = campRuneState(); R[kind][i] = key; campRuneTouch();
  if(typeof saveMeta === 'function') saveMeta();
  if(typeof playSfx === 'function') playSfx('ui_tab');
  campRuneRender(); return true; }
function campRuneUnequip(kind, i){
  const R = campRuneState(); if(!R || i < 0 || i >= R[kind].length) return false;
  if(!R[kind][i]) return false;
  R[kind][i] = null; campRuneTouch();
  if(typeof saveMeta === 'function') saveMeta();
  campRuneRender(); return true; }
// 끼워져 있는 것 — 열린 칸까지만 본다(칸이 줄어드는 일은 없지만, 표를 고치면 생길 수 있다)
function campRuneEq(kind){ const R = campRuneState(); if(!R) return [];
  const n = campRuneSlots(kind), out = [];
  for(let i = 0; i < n; i++) out.push(R[kind][i] || null);
  return out; }

// ── 효과 — **합이다** ───────────────────────────────────────────────────
// ⛔ 곱하지 말 것(GEM.md §5-2). 부르는 쪽은 `1 + campRuneEff('gain')` 처럼 **합산 항**에 넣는다.
// ⚠ 아직 아무도 부르지 않는다 — 배선은 다음 단계다.
// ⚡ **매 프레임·일꾼마다 불린다** — 그래서 캐시한다. 장착이 바뀔 때만 다시 센다.
//   ⛔ 캐시를 빼지 말 것: 일꾼 40기면 프레임당 40번 × 슬롯 8칸을 훑게 된다.
let _runeVer = 0, _reCache = null, _reVer = -1, _reObj = null;
const _RE_EMPTY = {};
function campRuneTouch(){ _runeVer++; _reCache = null; }   // 장착·구매가 부른다
function _runeEffAll(){
  const R = campRuneState(); if(!R) return _RE_EMPTY;
  // 세이브가 통째로 갈리면(로그인·환생) R 객체가 바뀐다 — 그때도 다시 센다
  if(_reCache && _reVer === _runeVer && _reObj === R) return _reCache;
  const out = {};
  for(const kind of ['norm', 'uniq']) for(const key of campRuneEq(kind)){
    if(!key) continue; const p = runeParse(key); if(!p.def) continue;
    out[p.def.eff] = (out[p.def.eff] || 0) + runeVal(key); }
  _reCache = out; _reVer = _runeVer; _reObj = R; return out; }
function campRuneEff(eff){
  const v = _runeEffAll()[eff] || 0;
  // 💰 **감소형은 뚜껑이 있다** — 절약의 룬 설명 참고. 다른 축에는 상한이 없다(전부 증가형이라).
  if(eff === 'costCut') return Math.min(v, RUNE_COST_CAP);
  return v; }
// 부르는 쪽이 쓰기 좋은 모양 — **합산 항을 배수 하나로 접어 준다**(1 + 합).
//   ⛔ 배수끼리 다시 곱하지 말 것. 룬끼리는 이미 합으로 접혔다.
function campRuneMul(eff){ return 1 + campRuneEff(eff); }
// 🏕 **캠프 안에서만** 걸리는 것 — 건설 판(16-build.js)은 관리자 탭·오토배틀과 공유다.
//   ⛔ 게이트를 빼면 관리자 건설 탭의 일꾼까지 빨라진다(스모크가 잡는다).
function campRuneMulIn(eff){
  const on = (typeof campIsOn === 'function') && campIsOn();
  return on ? campRuneMul(eff) : 1; }

// ══ 화면 ═════════════════════════════════════════════════════════════════
// 규격은 환생 구역과 같다 — `#phone` 직속 · z-index 120 · `bottom:var(--navH)` 로 네비를 비운다.
// ⛔ 환생 구역의 키 아트(#campRebBg)를 빌리지 않는다 — 그 그림은 그 구역의 것이다(잔상 금지).
let _runeSec = 'slot';     // 'slot'(장착) / 'shop'(룬 상점)
let _runePick = -1;        // 고르는 중인 칸(−1 = 없음) · 'norm0' 같은 문자열로 둔다
let _runePickKind = '';

function campRuneIsOn(){ const el = document.getElementById('campRune');
  return !!(el && el.classList.contains('on')); }
function campRuneOpen(){ const el = document.getElementById('campRune'); if(!el) return;
  el.classList.add('on');
  // 🖼 배경은 **환생 구역과 같은 그림**이다(2026-09-03 사용자 확정) — 세 화면이 한 장을 나눠 쓴다.
  //   ⛔ 룬만의 그림을 따로 두지 말 것. 구역을 오갈 때 배경이 바뀌면 그때마다 번쩍인다.
  if(typeof campRebArtOn === 'function') campRebArtOn();
  campRuneRender();
  if(typeof playSfx === 'function') playSfx('ui_open'); }
function campRuneClose(){ const el = document.getElementById('campRune');
  setTimeout(() => { if(typeof curSplitSync === 'function') curSplitSync(); }, 0);   // 📐 상단 띠 맞춤
  if(el) el.classList.remove('on', 'rnIn');
  _runePick = -1; _runePickKind = '';
  _runeSwapKey = '';                  // 🔁 나갈 때 교체도 걷는다(다시 들어오면 칸이 흔들린 채다)
  _runeVeil = '';                     // 🫥 감춰 둔 칸도 푼다(안 그러면 문양이 사라진 채로 남는다)
  campRuneTipHide();
  if(typeof campRebArtOff === 'function') campRebArtOff(); }

// 🧭 **룬 구역의 유일한 입구.** ⛔ campRuneOpen 을 밖에서 직접 부르지 말 것 —
//   네비 상태(구역·하위)를 맞춰 주지 않아 하위 칸이 통째로 안 나온다(환생 구역과 같은 함정).
function campRuneEnter(sec){
  const s = (sec === 'shop') ? 'shop' : 'slot';
  const wasIn = campRuneIsOn();
  _runeSec = s; _runePick = -1; _runePickKind = ''; _runeSwapKey = '';
  campRuneOpen();
  { const el = document.getElementById('campRune'); if(el) el.classList.toggle('rnIn', !wasIn); }
  if(typeof navShow === 'function') navShow('rune');
  if(typeof _navDrill !== 'undefined') _navDrill = 'rune';
  if(typeof navPaint === 'function') navPaint();
  return s; }

function campRuneRender(){
  campRuneTipHide();      // 🗒 다시 그리면 쪽지는 걷는다(가리키던 칸이 사라질 수 있다)
  const box = document.getElementById('rnBody'); if(!box) return;
  // 📜 **가방이 내려가 있던 자리를 지킨다**(2026-09-04 사용자 확정).
  //   ⛔ 다시 그릴 때마다 맨 위로 올리지 말 것 — 아래쪽 룬을 하나 넣을 때마다 목록이
  //     처음으로 튀어 다음 것을 다시 찾아 내려가야 한다.
  //   ⚠ 갈래를 거르면 목록이 짧아진다 — 남은 높이에 맞춰 물린다(브라우저가 알아서 한다).
  const _bagKeep = (() => { const q = document.querySelector('#campRune .rnBagG');
    return q ? q.scrollTop : 0; })();
  if(!campRuneState()){ box.innerHTML = ''; return; }
  const _shop = (_runeSec === 'shop');
  box.classList.toggle('shop', _shop);       // 상점만 흐르는 목록이다(판은 전체를 채운다)
  // 📜 **스크롤은 젬 상점과 같은 규격이다**(2026-09-04 사용자 확정) — 공용 .uiScroll 하나뿐.
  //   ⛔ 전용 스크롤바나 드래그 장치를 새로 만들지 말 것(CLAUDE.md 「세로 스크롤바」 레지스트리).
  //   ⚠ 이 클래스가 빠지면 브라우저 기본 막대가 굵게 뜬다 — 그게 「오른쪽에 바가 보인다」의 원인이었다.
  box.classList.toggle('uiScroll', _shop);
  box.innerHTML = (_runeSec === 'shop') ? _runeShopHTML() : _runeSlotHTML();
  if(typeof paintIcons === 'function') paintIcons(box);
  if(_bagKeep){ const q = document.querySelector('#campRune .rnBagG'); if(q) q.scrollTop = _bagKeep; }
  _runeTopSync();
  if(typeof curSplitSync === 'function') curSplitSync();   // 📐 상단 띠 맞춤
  if(typeof curPaintChip === 'function') curPaintChip();   // 🏷 좌상단 이름(장착 / 룬 상점)
  if(_runeSec !== 'shop') campRuneBindMap(); }

// ── 📊 지금 걸려 있는 효과 — 오른쪽 위에 합쳐서 나열한다 ─────────────────
//   ⭐ 칸마다 몇 %인지는 알아도 「그래서 지금 무엇이 얼마나 올랐나」는 안 보였다
//     (2026-09-04 사용자 요청). 같은 효과를 여러 칸에 끼웠으면 **합쳐서** 한 줄이다.
//   ⚠ 값은 **campRuneEff 한 곳**에서 가져온다 — 여기서 다시 더하지 말 것.
//     그래야 상한(구매 비용 감소의 뚜껑)도 저절로 따라온다.
//   ⚠ 판을 누르지 않는다: `.rnTop` 안에 넣으면 그 높이가 hideT 로 잡혀 성좌가 아래로 밀린다.
//     그래서 **떠 있는 별도 층**이고 pointer-events 는 없다(팬·줌을 안 가로챈다).
const RUNE_SUM_MAX = 12;                 // 여기까지 보이고 나머지는 「외 n가지」로 접는다
function campRuneEffList(){
  const out = [];
  for(const d of RUNE_LIST){
    const v = (typeof campRuneEff === 'function') ? campRuneEff(d.eff) : 0;
    if(!(v > 0)) continue;
    out.push({ eff:d.eff, nm:d.de, v:v,
      grp:(d.kind === 'uniq') ? 'uniq' : d.grp,
      down:(d.eff === 'costCut') }); }        // 💰 유일한 감소형 — 부호를 뒤집어 적는다
  return out; }
function _runeSumTx(v){ const p = v * 100;
  const t = (Math.abs(p - Math.round(p)) < 0.05) ? String(Math.round(p)) : p.toFixed(1);
  return t + '%'; }
function _runeSumHTML(){
  const q = campRuneEffList();
  if(!q.length) return '';                    // ⛔ 빈 판을 띄우지 않는다
  const shown = q.slice(0, RUNE_SUM_MAX), rest = q.length - shown.length;
  let h = '<div class="rnSum" aria-label="적용 중인 효과">';
  for(const e of shown){
    const c = (RUNE_GRP[e.grp] || {}).col || '#c3ccd8';
    h += '<div class="rnSumR"><span>' + e.nm + '</span>'
      + '<b style="color:' + c + '">' + (e.down ? '−' : '+') + _runeSumTx(e.v) + '</b></div>'; }
  if(rest > 0) h += '<div class="rnSumR more"><span>외 ' + rest + '가지</span></div>';
  return h + '</div>'; }
// ── 장착 화면 — 🌌 성좌 판 ──────────────────────────────────────────────
//   ⭐ 줄 두 개(옛 모습)가 아니라 **한 장의 판**이다. 칸의 자리가 곧 해금 순서이고,
//     성좌 한가운데가 유니크다 — 「이 무리를 다 열면 저 가운데가 열린다」가 그림으로 읽힌다.
//   ⛔ 목록형으로 되돌리지 말 것(2026-09-03 사용자 확정 · 목업 ②안).
//   ⭐ 판은 **밀고 확대한다**(2026-09-03) — 조작은 공용 엔진(svv*, 19-camp.js)이 맡는다.
//   ⭐ 아래는 **상시 가방**이다(프로필 장비창의 가방과 같은 문법) — 칸을 고르지 않아도
//     무엇을 갖고 있는지 늘 보이고, 눌러서 바로 끼운다.
function _runeSlotHTML(){
  return '<div class="rnMap"><svg id="rnSvg" viewBox="0 0 ' + RUNE_MAP_W + ' ' + RUNE_MAP_H + '"'
    + ' preserveAspectRatio="xMidYMid meet"><g id="rnG">' + _runeMapSvg() + '</g></svg></div>'
    + _runeSumHTML() + _runeBagHTML(); }
// 🗺 **상단 진행 수치는 없앴다**(2026-09-04 사용자 확정: 「없어도 될 것 같아」).
//   칸마다 「R45」로 열리는 라운드가 적혀 있어서 같은 말을 두 곳에서 하고 있었다.
//   ⛔ 되살리지 말 것. ⚠ 요소(#rnRound)는 남겨 둔다 — 마크업을 건드리지 않으려는 것뿐이다.
function _runeTopSync(){
  const el = document.getElementById('rnRound'); if(!el) return;
  el.innerHTML = ''; }

// ── 🔍 판 조작 — 공용 엔진(svv*)에 맡긴다 ───────────────────────────────
//   ⛔ 팬·줌·연출을 여기서 다시 짜지 말 것. 엔진은 19-camp.js 에 있다.
//   ⚠ 칸을 고르면 **그 성좌로 들어간다**. 고른 칸만 밀어 올리면 아래쪽 성좌를 골랐을 때
//     판이 통째로 도망가 화면이 텅 빈다(실측 2026-09-03).
const RUNE_PICK_SC = 1.35;
// 🔍 **최대 확대는 성좌 하나가 꽉 차는 자리까지다**(2026-09-04 사용자 확정 · 스크린샷 기준).
//   ⛔ 2.6~2.8 을 되살리지 말 것 — 손가락으로 더 밀면 칸 한두 개만 남아 더 확대할 이유가 없다.
//   ⭐ RUNE_PICK_SC 와 같은 값을 쓴다 — 「칸을 골라 들어간 자리」가 곧 최대치라 숫자가 둘일 이유가 없다.
//   ⭐ **최대 축소는 「전체 보기」까지다**(2026-09-04 사용자 확정: 「너무 많이 축소돼」).
//     out 은 전체 보기 배율에 곱해 하한을 내는 값이다 — 1 이면 그보다 더는 못 줄인다.
//     ⛔ 0.72 로 되돌리지 말 것: 판이 화면의 3분의 2로 쪼그라들어 빈 하늘만 남았다.
const RUNE_ZLIM = { min:0.2, max:RUNE_PICK_SC, out:1 };
let _rnView = null;
function _runeG(){ return document.getElementById('rnG'); }
function _runeSvg(){ return document.getElementById('rnSvg'); }
function _runeAlive(){ return typeof campRuneIsOn === 'function' && campRuneIsOn(); }
// 판에 있는 별들의 자리 — 「전체 보기」가 이것만 잰다(글자·후광은 안 센다)
function _runePts(){ const q = [];
  for(let i = 0; i < RUNE_SLOT_R.norm.length; i++){ const c = campRuneNPos(i); q.push({ x:c[0], y:c[1] }); }
  for(let i = 0; i < RUNE_SLOT_R.uniq.length; i++){ const c = campRuneUPos(i); q.push({ x:c[0], y:c[1] }); }
  return q; }
// 📐 칸이 놓인 범위 — **전체 보기와 팬 경계가 같은 값**을 쓴다(단일 소스).
//   ⛔ getBBox 를 쓰지 말 것 — 값 글씨·번짐까지 범위에 들어 경계가 헐렁해진다.
function _runeBox(){ const q = _runePts(); if(!q.length) return null;
  let x0 = q[0].x, x1 = q[0].x, y0 = q[0].y, y1 = q[0].y;
  for(const p of q){ if(p.x < x0) x0 = p.x; if(p.x > x1) x1 = p.x;
    if(p.y < y0) y0 = p.y; if(p.y > y1) y1 = p.y; }
  const m = RUNE_R_U + 8;                       // 칸 반지름만큼 넓힌다(가장 큰 칸 기준)
  return { x0:x0 - m, x1:x1 + m, y0:y0 - m, y1:y1 + m }; }
// 위·아래로 덮이는 픽셀(뷰박스 단위) — 상단 띠와 가방
function _runeBoxOpt(){
  const mp = document.querySelector('#campRune .rnMap');
  const H = mp ? mp.getBoundingClientRect().height : 0;
  const px = e => { const q = document.querySelector(e);
    return (H && q) ? (q.getBoundingClientRect().height / H) * RUNE_MAP_H : 0; };
  return { hideT: px('#campRune .rnTop'), hideB: px('#campRune .rnBag') }; }

function campRuneFit(now){
  if(!_rnView) _rnView = svvNew();
  // 위는 제목 띠, 아래는 가방이 덮는다 — 그 사이에 맞춘다.
  //   ⭐ 덮는 크기를 **실제 높이에서 잰다** — CSS 를 고쳐도 저절로 따라온다(숫자를 두 곳에 두지 않는다).
  const mp = document.querySelector('#campRune .rnMap');
  const H = mp ? mp.getBoundingClientRect().height : 0;
  // ⚠ 아직 레이아웃 전(높이 0)이면 **다음 프레임에 다시** — 지금 재면 가방·상단 띠를 0 으로 보고
  //   판을 너무 크게 맞춰 아래 두 성좌가 가방 뒤에 숨는다(실측 2026-09-04: z 1.1, 맞는 값 0.7).
  if(!H){ requestAnimationFrame(() => { if(_runeAlive()) campRuneFit(now); }); return; }
  const rt = e => { const q = document.querySelector(e);
    return (H && q) ? Math.min(0.4, q.getBoundingClientRect().height / H) : 0; };
  svvFit(_rnView, _runeSvg(), _runeG, _runePts(),
    { pad:30, zmax:1.35, hideT:rt('#campRune .rnTop'), hideB:rt('#campRune .rnBag') }, now, _runeAlive); }
// 고른 칸의 성좌로 들어간다
function campRuneFocus(now){
  if(!_rnView || !_runePickKind) return;
  const ci = (_runePickKind === 'uniq') ? _runePick : Math.floor(_runePick / RUNE_CONS);
  const c = RUNE_CT[ci] || RUNE_CT[0];
  svvLookAt(_rnView, _runeG, { x:c[0], y:c[1] },
    { x:RUNE_MAP_W / 2, y:RUNE_MAP_H * 0.34 },
    Math.max(_rnView.tz, RUNE_PICK_SC), now, _runeAlive); }
// 그릴 때마다 <g> 가 새로 생긴다 — 뷰를 도로 얹고 손가락을 다시 잇는다
function campRuneBindMap(){
  const svg = _runeSvg(); if(!svg) return;
  const first = !_rnView;                       // 처음 열 때만 「전체 보기」로 맞춘다
  if(!_rnView) _rnView = svvNew();              // ⛔ 매번 맞추지 말 것 — 확대해 둔 것이 리셋된다
  svvApply(_rnView, _runeG());
  // 🚧 팬 경계 — 칸이 놓인 범위 밖으로는 못 민다(엔진의 svvClampPan).
  //   ⚠ 위·아래는 상단 띠·가방이 덮으므로 그만큼 더 막는다 — 전체 보기(campRuneFit)와 같은 셈법이다.
  svvBind(svg, { v:_rnView, g:_runeG, lim:RUNE_ZLIM, alive:_runeAlive,
    box: _runeBox, boxOpt: _runeBoxOpt,
    hit: e => (e.target.closest && e.target.closest('[data-rk]')) || null,
    onTap: el => campRuneSlotTap(el.dataset.rk, +el.dataset.ri),
    onHold: el => campRuneSlotHold(el.dataset.rk, +el.dataset.ri, el),
    onEmpty: () => { campRuneTipHide();
      if(_runeSwapKey){ campRuneSwapEnd(); return; }
      if(_runePickKind) campRunePick('', -1); },
    onDouble: () => campRuneFit() });
  if(first) campRuneFit(true); }

// 육각 하나의 꼭짓점 — 뾰족한 쪽이 위(pointy-top)
function _runeHexPts(x, y, r){ const q = [];
  for(let i = 0; i < 6; i++){ const a = Math.PI / 180 * (60 * i - 90);
    q.push((x + r * Math.cos(a)).toFixed(1) + ',' + (y + r * Math.sin(a)).toFixed(1)); }
  return q.join(' '); }

// 칸 하나 — 잠김 / 빈칸 / 끼워짐 세 모습.
//   ⭐ **이중 테두리**(2026-09-03 사용자 확정 · 목업 camp-rune-tri-6 ②안):
//     낀 칸은 바깥에 얇은 겹을 하나 더 둘러 무리 속에서 즉시 읽히고, 색은 조용하게 남는다.
//   ⛔ 십자 반짝임·후광 원을 되살리지 말 것 — 환생 트리의 어휘라 룬 판에서는 시끄러웠다.
//   ⚠ 누르는 면은 **맨 위에 투명하게** 따로 둔다.
/* 🎛 칸의 세기 — 목업 camp-rune-vec47-6 ④안에서 고른 값 (2026-09-04 사용자 확정).
   ⚠ **이웃 칸 중심 사이는 55.1** 이라(고리 72 · 8칸) 칸 바깥으로 27.6 을 넘으면 옆 칸을 침범한다.
     지금 가장 바깥이 유니크 링 둘째 = r+4.6 → 25.6 으로 안전하다.
     ⛔ 점선 후광(r+7)을 되살리지 말 것 — 28.0 이 되어 옆 칸을 밟는다(목업에서 잰 값).
   ⭐ 등급은 **바깥 링 수**로도 읽는다: 하급·중급 0 · 상급 1 · 유니크 2.
     색을 못 알아봐도 형태로 갈린다. */
const RUNE_RING1 = 2.5, RUNE_RING2 = 4.6;      // 바깥 링 — 칸 반지름에 더하는 여유
const RUNE_RING_OP1 = 0.40, RUNE_RING_OP2 = 0.20;
const RUNE_DOT_R = 3.2, RUNE_DOT_SZ = 0.9, RUNE_DOT_OP = 0.45;   // 유니크 꼭짓점 점 여섯
// 🔁 교체 후보의 점선이 칸 밖으로 나가는 거리 — 이웃 칸 가장자리(28.0)를 넘으면 안 된다
const RUNE_ANTS_GAP = 3.2;
// 🔷 문양이 칸에서 차지하는 폭 ÷ 칸 반지름 (2026-09-04 사용자 지적: 「타일 내부를 너무 꽉 채운다」).
//   ⚠ 육각 안에 들어가는 정사각의 한계는 **1.268** 이다(반변 a ≤ 0.634r). 옛 값 1.24 는
//     그 한계에 거의 닿아 문양이 벽에 붙어 보였다. 1.00 이면 좌우로 0.13r 씩 남는다.
//   ⛔ 1.2 이상으로 되돌리지 말 것.
const RUNE_GLYPH_K = 1.00;
// 육각 꼭짓점 하나 — i 번째(꼭짓점이 위)
function _runeVtx(x, y, r, i){ const a = Math.PI / 180 * (60 * i - 90);
  return [x + r * Math.cos(a), y + r * Math.sin(a)]; }

// 칸 하나 — 잠김 / 빈칸 / 끼워짐 세 모습.
//   ⭐ **판을 도형으로 그린다**(환생 트리 별과 같은 켜): 검은 바닥 → 면 그라데이션 + 등급색 테두리
//     → 뒷광 → 안쪽 흰 실선 → 문양. 빛은 형태를 따라 번진다(drop-shadow).
//   ⛔ 후광 원·십자 반짝임을 되살리지 말 것 — 트리의 어휘이고, 육각과 형태가 둘로 읽힌다.
//   ⚠ 누르는 면은 **맨 위에 투명하게** 따로 둔다.
//   ⚠ 잠긴 칸의 `.rnHx.lk` 와 `.rnLkT` 는 스모크가 잰다 — 클래스 이름을 바꾸지 말 것.
function _runeCell(kind, i, x, y, r, key, open, at, sel){
  const g = [], X = x.toFixed(1), Y = y.toFixed(1);
  // 🔁 교체 모드 — 바꿀 수 있는 칸만 흔들고 나머지는 물린다(유니크는 일반 룬을 안 받는다)
  const swCand = campRuneSwapCand(kind, i);
  const swDim = _runeSwapKey && !swCand && !(open && !key);
  if(!open){
    g.push('<polygon class="rnHx lk" points="' + _runeHexPts(x, y, r * 0.93) + '"/>');
    g.push('<text class="rnLkT" x="' + X + '" y="' + (y + 2.5).toFixed(1) + '">R' + at + '</text>');
    return g.join(''); }
  if(!key){
    // 🕳 **파인 홈** — 「+」 하나뿐이던 빈 칸을 «끼우는 자리»로 바꾼다(목업 camp-rune-slot-8 ②안).
    //   ⛔ 반투명으로 되돌리지 말 것 — 뒤의 구역 오로라가 비쳐 칸이 갈래 색으로 물든다.
    //   ⛔ 「+」·숨 원(.rnEmB)을 되살리지 말 것: 홈이 이미 「비었다」를 말하고, 원은 오로라를 한 겹 더 더한다.
    // 🎨 갈래 색 테두리 — 일반 칸은 그 성좌의 갈래, 유니크 칸은 보라
    const gk = (kind === 'uniq') ? 'uniq' : runeSlotGrp(i);
    g.push('<polygon class="rnHx em" points="' + _runeHexPts(x, y, r * 0.93)
      + '" style="stroke:url(#rnEg' + gk + ')"/>');
    g.push('<polygon class="rnEmIn" points="' + _runeHexPts(x, y, r * 0.93 - 1.6) + '"/>'); }
  else {
    const pp = runeParse(key), c = (RUNE_GD[pp.gd] || {}).col || '#8b95a5', uq = pp.gd === 'uniq';
    const gd = pp.gd || 'low';
    // ⭕ 바깥 링 — 등급을 형태로도 읽게 한다(위 설명). 하급·중급은 없다.
    const nRing = uq ? 2 : (gd === 'high' ? 1 : 0);
    for(let k = 0; k < nRing; k++)
      g.push('<polygon class="rnHxR" points="'
        + _runeHexPts(x, y, r + (k ? RUNE_RING2 : RUNE_RING1))
        + '" style="stroke:' + c + ';stroke-width:' + (k ? .7 : .9)
        + ';opacity:' + (k ? RUNE_RING_OP2 : RUNE_RING_OP1) + '"/>');
    // ⬛ 검은 바닥 — 배경 사진을 눌러 앉힌다(안 깔면 칸이 배경에 뜬다)
    g.push('<polygon class="rnHxFloor" points="' + _runeHexPts(x, y, r) + '"/>');
    // ⬡ 면 + 테두리 — 면은 위가 밝은 남색, 테두리는 흰빛→등급색. 번짐은 형태를 따라간다.
    g.push('<polygon class="rnHx on" points="' + _runeHexPts(x, y, r * 0.93)
      + '" style="stroke:url(#rnE' + gd + ');stroke-width:' + (uq ? 1.5 : 1.3)
      + ';filter:drop-shadow(0 0 ' + (uq ? 4 : 3) + 'px ' + c + ')"/>');
    // 💡 문양 뒤 광 — ⛔ blur 금지(칸이 27개다). radialGradient 로 낸다.
    g.push('<circle class="rnBk" cx="' + X + '" cy="' + Y + '" r="' + (r * 0.72).toFixed(1)
      + '" style="fill:url(#rnB' + gd + ')"/>');
    // ✨ 안쪽 흰 실선 — 두께를 안 늘리고 깊이만 준다
    g.push('<polygon class="rnHxIn2" points="' + _runeHexPts(x, y, r - Math.max(1, r * 0.073)) + '"/>');
    // 🔶 유니크 — 꼭짓점 점 여섯. 빛을 더 쓰지 않고 「격」만 올린다.
    if(uq) for(let k = 0; k < 6; k++){ const q = _runeVtx(x, y, r + RUNE_DOT_R, k);
      g.push('<circle class="rnDot" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1)
        + '" r="' + RUNE_DOT_SZ + '" style="fill:' + c + ';opacity:' + RUNE_DOT_OP + '"/>'); }
    // 🔷 문양 — 유니크는 **앉은 성좌 색**을 따른다
    { const gp = (kind === 'uniq') ? (RUNE_GRPS[i] || '') : '';
      const src = runeGlyphSrc(key, gp), w = r * RUNE_GLYPH_K;
      if(src) g.push('<image class="rnImg" href="' + src + '"'
        + ' x="' + (x - w / 2).toFixed(1) + '" y="' + (y - w / 2).toFixed(1) + '"'
        + ' width="' + w.toFixed(1) + '" height="' + w.toFixed(1) + '"/>'); }
    // ⛔ 칸 밖 아래의 % 는 뺐다(2026-09-04 사용자 확정) — 스물일곱 칸에 숫자가 붙으면
    //   판이 시끄럽고, 값은 길게 눌러 뜨는 쪽지와 가방 줄이 이미 말한다. 
  }
  if(sel) g.push('<polygon class="rnHxSel" points="' + _runeHexPts(x, y, r + 6) + '"/>');
  // 👆 누르는 면 — 맨 위에 투명하게. ⚠ onclick 을 달지 않는다: 손가락을 붙잡는 순간
  //   click 의 target 이 <svg> 로 바뀌어 안 온다. 엔진이 pointerdown 에서 이 표시를 읽는다.
  // 🔁 교체 후보의 **흐르는 점선** — 「고를 수 있음」의 오래된 관용구다.
  //   ⚠ 반지름은 칸 밖 3.2 까지만(24.2). 이웃 칸 가장자리가 **28.0** 이라 그 안에 있어야 한다
  //     (이웃 중심 사이 49.0 · 실측 2026-09-04). ⛔ 더 벌리면 옆 칸을 밟는다.
  if(swCand){ const kc = key ? ((RUNE_GD[runeParse(key).gd] || {}).col || '#b4cdeb') : '#b4cdeb';
    g.push('<polygon class="rnAnts" points="' + _runeHexPts(x, y, r + RUNE_ANTS_GAP) + '"'
      + ' style="stroke:' + kc + '"/>'); }
  g.push('<circle class="rnHit" cx="' + X + '" cy="' + Y + '" r="' + (r + 3)
    + '" data-rk="' + kind + '" data-ri="' + i + '"/>');
  // ⚠ 흔들림은 **칸 전체를 감싸서** 준다 — 조각마다 걸면 테두리와 문양이 따로 논다.
  //   transform-origin 은 사용자 좌표라 transform-box:view-box 가 함께 있어야 한다(CSS).
  // ⚠ 흔들림·부풀림은 **칸 전체를 감싸서** 준다 — 조각마다 걸면 테두리와 문양이 따로 논다.
  //   transform-origin 은 사용자 좌표라 transform-box:view-box 가 함께 있어야 한다(CSS).
  const cls = 'rnCell' + (swCand ? ' rnCand' : '') + (swDim ? ' rnDim' : '')
    + ((_runeVeil === kind + '-' + i) ? ' veil' : '');
  const st = 'transform-origin:' + X + 'px ' + Y + 'px'
    + (swCand ? ';animation-delay:' + ((i * 53) % 260) + 'ms' : '');
  return '<g class="' + cls + '" data-ck="' + kind + '-' + i + '" style="' + st + '">'
    + g.join('') + '</g>'; }

// 🎨 판이 쓰는 그라데이션 — 등급마다 테두리(흰빛→등급색)와 뒷광 한 벌씩.
//   ⚠ **매 렌더 새로 낸다** — SVG 를 통째로 갈아 끼우므로 defs 도 같이 들어가야 한다.
// 🌌 **성좌 구역** — 무리마다 갈래 색 오로라 + 이름 (2026-09-04 사용자 확정 · 목업 camp-rune-zone-8 ②안)
//   ⭐ 지금 판은 세 무리가 삼각으로 놓여 있을 뿐 **어느 무리가 무엇인지** 말해 주지 않았다.
//     색만으로는 「민트 = 경제」를 배워야 알므로 **이름을 함께** 둔다.
//   ⚠ 이 레이어는 `#rnG` 안에 있다 — 판을 밀고 확대하면 **같이 움직인다**.
//     ⛔ 화면에 고정하지 말 것: 확대할 때 성좌와 어긋난다.
//   ⚠ 이름의 y 는 **칸 바깥에 바싹** 붙인다(RUNE_RING + RUNE_R_N + 5). 더 띄우면
//     `_runeBox()`(전체 보기·팬 경계의 단일 소스)가 재는 범위 밖으로 나가 잘린다.
const RUNE_ZONE_DY = RUNE_RING + RUNE_R_N + 5;
function _runeZoneSvg(){
  const g = [];
  for(let ci = 0; ci < RUNE_CT.length; ci++){
    const c = RUNE_CT[ci], key = RUNE_GRPS[ci], gi = RUNE_GRP[key];
    if(!gi) continue;
    // ⭕ 원이 아니라 **타원**이다 — 정원은 경계가 도드라진다(트리의 성운도 타원이다).
    g.push('<ellipse class="rnAu" cx="' + c[0] + '" cy="' + c[1] + '" rx="250" ry="215" fill="url(#rnAu' + ci + ')"/>');
    g.push('<text class="rnZn" x="' + c[0] + '" y="' + (c[1] - RUNE_ZONE_DY).toFixed(0)
      + '" style="fill:' + gi.col + '">' + gi.nm + '</text>'); }
  return g.join(''); }
function _runeDefs(){
  let d = '<defs><linearGradient id="rnFace" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#1b2634"/><stop offset="1" stop-color="#06090e"/></linearGradient>';
  for(const k in RUNE_GD){ const c = RUNE_GD[k].col;
    d += '<linearGradient id="rnE' + k + '" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="#ffffff" stop-opacity=".92"/>'
      + '<stop offset=".42" stop-color="' + c + '"/>'
      + '<stop offset="1" stop-color="' + c + '" stop-opacity=".34"/></linearGradient>'
      + '<radialGradient id="rnB' + k + '">'
      + '<stop offset="0" stop-color="' + c + '" stop-opacity=".22"/>'
      + '<stop offset=".62" stop-color="' + c + '" stop-opacity=".07"/>'
      + '<stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>'; }
  // 🌌 성좌 구역의 오로라 — **환생 트리의 성운과 같은 문법**이다(2026-09-04 사용자 확정:
  //   「환생 트리 구역의 배경처럼 뒤에 나오는 은은한 빛」).
  //   ⭐ 요령은 **아주 넓게 · 아주 옅게**다(트리: 타원 rx186 · 세기 .05, 중심 빛 r300).
  //     처음에는 성좌 크기의 1.5배(r132)에 .50 으로 진하게 넣었는데, 그러면 경계가 보여
  //     「빛」이 아니라 **동그란 얼룩**으로 읽힌다(사용자 지적). 반경을 두 배로 늘리고
  //     세기를 절반 아래로 내리면 경계가 화면 밖으로 밀려 스며드는 빛이 된다.
  //   ⛔ 반경을 줄이면서 세기를 올리지 말 것 — 그 조합이 얼룩이다.
  //   ⛔ blur 필터를 쓰지 말 것 — 트리에서 팬·줌이 38 → 23 프레임으로 떨어졌다(19-camp.js).
  for(let i = 0; i < RUNE_GRPS.length; i++){ const c = (RUNE_GRP[RUNE_GRPS[i]] || {}).col || '#8b95a5';
    d += '<radialGradient id="rnAu' + i + '">'
      + '<stop offset="0" stop-color="' + c + '" stop-opacity=".22"/>'
      + '<stop offset=".55" stop-color="' + c + '" stop-opacity=".07"/>'
      + '<stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>'; }
  // 🎨 **빈 칸 테두리는 갈래 색**이다(2026-09-04 사용자 확정 · 목업 camp-rune-edge-8 ③안).
  //   ⭐ 낀 칸의 테두리(#rnE<등급>)와 **같은 어휘**다 — 위가 흰빛, 아래로 갈수록 색.
  //     빛이 위에서 오는 결이 판 전체에 통하고, 칸 하나만 봐도 어느 갈래의 자리인지 읽힌다.
  //   ⚠ 세기는 낀 칸보다 **약하다**(흰빛 .92 → .34). 빈 칸이 더 시끄러우면 끼웠을 때
  //     달라지는 것이 없다. ⛔ 올리지 말 것.
  for(const k of RUNE_GRPS.concat('uniq')){
    const c = (k === 'uniq') ? ((RUNE_GD.uniq || {}).col || '#c98bff')
                             : ((RUNE_GRP[k] || {}).col || '#b4cdeb');
    d += '<linearGradient id="rnEg' + k + '" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="#dfe9f5" stop-opacity=".34"/>'
      + '<stop offset=".45" stop-color="' + c + '" stop-opacity=".34"/>'
      + '<stop offset="1" stop-color="' + c + '" stop-opacity=".12"/></linearGradient>'; }
  // 🕳 빈 칸의 **파인 홈** — 위가 어둡고 아래가 밝다. 빛이 위에서 오니 안쪽으로 파인 자리로 읽힌다
  //   (2026-09-04 사용자 확정 · 목업 camp-rune-slot-8 ②안).
  //   ⚠ **불투명하게 둔다.** 반투명이면 뒤의 구역 오로라가 그대로 비쳐 칸이 갈래 색으로 물든다
  //     (사용자 지적: 「내부가 바깥 오로라 색을 너무 많이 가져온다」).
  d += '<linearGradient id="rnWell" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#04070b"/>'
    + '<stop offset=".55" stop-color="#0d141d"/>'
    + '<stop offset="1" stop-color="#18222e"/></linearGradient>';
  d += '<radialGradient id="rnEm"><stop offset="0" stop-color="#9fc0ea" stop-opacity=".12"/>'
    + '<stop offset="1" stop-color="#9fc0ea" stop-opacity="0"/></radialGradient>';
  return d + '</defs>'; }

function _runeMapSvg(){
  const rows = [_runeDefs(), _runeZoneSvg()], tbN = RUNE_SLOT_R.norm, tbU = RUNE_SLOT_R.uniq;
  const openN = campRuneSlots('norm'), openU = campRuneSlots('uniq');
  const eqN = campRuneEq('norm'), eqU = campRuneEq('uniq');
  // 성좌마다 — 중심에서 고리로 뻗는 실(열린 칸만 밝다)
  // ⚠ 선은 **칸 밖에서 멈춘다** — 안까지 들어오면 육각을 가로질러 지저분해진다(사용자 지적).
  //   양끝을 각각 유니크·일반 반지름만큼 물린다(이중 테두리 바깥 겹까지 고려해 +5).
  for(let i = 0; i < tbN.length; i++){
    const ci = Math.floor(i / RUNE_CONS), c = RUNE_CT[ci], q = campRuneNPos(i);
    const dx = q[0] - c[0], dy = q[1] - c[1], L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, a0 = RUNE_R_U + 5, a1 = RUNE_R_N + 5;
    if(L <= a0 + a1) continue;                       // 너무 가까우면 선을 아예 안 그린다
    rows.push('<line class="rnLink' + (i < openN ? ' on' : '')
      + '" x1="' + (c[0] + ux * a0).toFixed(1) + '" y1="' + (c[1] + uy * a0).toFixed(1)
      + '" x2="' + (q[0] - ux * a1).toFixed(1) + '" y2="' + (q[1] - uy * a1).toFixed(1) + '"/>'); }
  for(let i = 0; i < tbN.length; i++){ const q = campRuneNPos(i);
    rows.push(_runeCell('norm', i, q[0], q[1], RUNE_R_N, eqN[i] || null, i < openN, tbN[i],
      _runePickKind === 'norm' && _runePick === i)); }
  for(let i = 0; i < tbU.length; i++){ const q = campRuneUPos(i);
    rows.push(_runeCell('uniq', i, q[0], q[1], RUNE_R_U, eqU[i] || null, i < openU, tbU[i],
      _runePickKind === 'uniq' && _runePick === i)); }
  return rows.join(''); }


// ── 🔁 교체 — 칸이 꽉 찼을 때 「무엇과 바꿀까」를 판에서 고른다 ───────────
//   ⭐ **왜 있나**(2026-09-04 사용자 확정) — 칸이 다 차면 가방을 눌러도 아무 일이 없었다.
//     그때가 바로 「고르는 것」이 시작되는 자리인데 화면이 아무 말도 안 했다.
//   흐름: 가방을 누른다 → 그 갈래 성좌가 **화면 한가운데**로 온다 → 바꿀 수 있는 칸이
//     **흔들린다** → 그 중 하나를 누르면 있던 룬이 가방으로 날아가고 새 룬이 날아와 앉는다.
//   ⚠ 유니크 룬은 칸 셋이 **세 성좌에 흩어져** 있다 — 한 곳을 잡을 수 없으므로 전체 보기로 둔다.
//   ⛔ 확인창을 띄우지 말 것 — 넣고 빼기가 한 번씩인 화면이라 교체만 두 단계면 어긋난다.
let _runeSwapKey = '';                  // 교체하려는 룬. '' 이면 교체 모드가 아니다
// 이 칸이 지금 교체 후보인가 — 고른 룬과 **같은 종류**의 칸만 흔들린다
function campRuneSwapCand(kind, i){
  if(!_runeSwapKey) return false;
  const p = runeParse(_runeSwapKey); if(!p.def) return false;
  const want = (p.def.kind === 'uniq') ? 'uniq' : 'norm';
  if(kind !== want) return false;
  if(!campRuneEq(kind)[i]) return false;                    // 빈 칸은 교체가 아니라 그냥 장착
  if(kind === 'uniq') return true;
  return runeSlotGrp(i) === p.def.grp;                      // 일반은 제 갈래의 성좌만
}
function campRuneSwapEnd(re){ if(!_runeSwapKey) return;
  _runeSwapKey = ''; if(re !== false) campRuneRender(); }
// 🎯 그 갈래 성좌를 **보이는 자리의 한가운데**로 — 위 띠와 아래 가방을 뺀 나머지의 중심이다.
//   ⛔ 판 한가운데(RUNE_MAP_H/2)로 잡지 말 것 — 아래를 가방이 214px 덮어 성좌가 그 뒤로 내려간다.
function campRuneSwapLook(now){
  const p = runeParse(_runeSwapKey); if(!p.def || !_rnView) return;
  if(p.def.kind === 'uniq'){ campRuneFit(now); return; }     // 칸 셋이 흩어져 있다
  const ci = RUNE_GRPS.indexOf(p.def.grp); if(ci < 0) return;
  const c = RUNE_CT[ci]; if(!c) return;
  const mp = document.querySelector('#campRune .rnMap');
  const H = mp ? mp.getBoundingClientRect().height : 0;
  if(!H){ requestAnimationFrame(() => { if(_runeAlive() && _runeSwapKey) campRuneSwapLook(now); }); return; }
  // 📐 **화면에서 잰 자리를 viewBox 좌표로 바꿔** 앵커로 쓴다.
  //   ⛔ 화면 비율(높이/판높이)을 viewBox 값에 그대로 곱하지 말 것 —
  //     판은 preserveAspectRatio 로 비율을 지키느라 화면을 꽉 채우지 않는다.
  //     그렇게 하면 성좌가 한가운데에서 35px 어긋난다(실측 2026-09-04).
  const svg = _runeSvg(); if(!svg) return;
  const mr = mp.getBoundingClientRect();
  const px = e => { const q = document.querySelector(e); return q ? q.getBoundingClientRect().height : 0; };
  const t = px('#campRune .rnTop'), b = px('#campRune .rnBag');
  const a = svvToView(svg, mr.left + mr.width / 2, mr.top + t + (mr.height - t - b) / 2);
  svvLookAt(_rnView, _runeG, { x:c[0], y:c[1] }, a,
    Math.max(_rnView.tz, RUNE_PICK_SC), now, _runeAlive); }
function campRuneSwapBegin(key){
  if(_runeSwapKey === key){ campRuneSwapEnd(); return; }      // 같은 것을 또 누르면 취소
  _runeSwapKey = key;
  _runePickKind = ''; _runePick = -1;                         // 칸 고르기와 겹치지 않게
  campRuneTipHide();
  campRuneRender();
  campRuneSwapLook(false);
  if(typeof toast === 'function') toast('바꿀 칸을 고르세요'); }

// ── ✈ 룬이 오가는 연출 ────────────────────────────────────────────────────
//   ⭐ **끊겨 보이던 이유는 「도착하는 순간」이 없어서였다**(2026-09-04 사용자 지적).
//     칸에는 룬이 이미 그려져 있고 날아온 그림은 그냥 사라졌다 — 둘이 만나는 지점이 없다.
//   그래서 넷을 함께 한다:
//     ① 날아가는 동안 **받을 칸의 문양을 감춘다** — 그림이 도착해야 나타난다.
//     ② 궤적은 **호**다(직선은 기계 같다). 거리에 비례해 위로 띄운다.
//     ③ 도착하면 칸이 **한 번 부풀고**(pop) 갈래 색 **고리가 퍼진다** — 「적용됐다」의 신호.
//     ④ 가방으로 돌아가면 그 **줄 버튼이 부푼다** — 어디로 들어갔는지 눈이 따라간다.
//   ⛔ 상태를 애니 끝에 바꾸지 말 것 — 중간에 화면을 나가면 반영이 통째로 사라진다.
//     ⚠ 그래서 「감추고 → 도착하면 보이기」로 푼다. 상태는 여전히 즉시 바뀐다.
const RUNE_FLY_MS = 400;              // 날아가는 시간
const RUNE_FLY_GAP = 110;             // 교체에서 «나가는 것» 과 «들어오는 것» 의 시차
const RUNE_ARC_MAX = 74;              // 호의 최대 높이(px)

// 📍 칸의 <g> — 문양을 감추거나 부풀리려면 칸 전체를 잡아야 한다
function _runeCellEl(kind, i){
  return document.querySelector('#rnG .rnCell[data-ck="' + kind + '-' + i + '"]'); }
// 🫥 받을 칸의 문양을 감춘다 — 날아온 그림이 도착해야 나타난다.
//   ⚠ **그릴 때부터** 감춰야 한다(상태로 둔다). 다 그린 뒤에 클래스를 붙이면 문양이
//     opacity 1 로 한 번 계산된 뒤 0 으로 **페이드아웃**되어, 누르는 순간 칸에 룬이
//     「생겼다 사라진다」(2026-09-04 실측: 탭 직후 1 → 6프레임에 걸쳐 0.18).
//   ⛔ 렌더 뒤에 classList 로만 붙이지 말 것.
let _runeVeil = '';                     // 'norm-3' 처럼 — 도착을 기다리는 칸 하나
function _runeVeilKey(kind, i){ return kind + '-' + i; }
// 💥 도착 — 칸이 한 번 부풀고, 갈래 색 고리가 퍼진다
function campRuneLand(kind, i, key){
  if(_runeVeil === _runeVeilKey(kind, i)) _runeVeil = '';
  const el = _runeCellEl(kind, i); if(!el) return;
  el.classList.remove('veil');
  el.classList.remove('rnPop'); void el.getBBox;          // 애니를 다시 태우려면 한 번 끊는다
  requestAnimationFrame(() => el.classList.add('rnPop'));
  setTimeout(() => el.classList.remove('rnPop'), 460);
  // 🔵 퍼지는 고리 — 등급 색으로. ⛔ blur 를 쓰지 말 것(칸이 스물일곱이다).
  const g = _runeG(); if(!g) return;
  const p = runeParse(key), c = (RUNE_GD[p.gd] || {}).col || '#8b95a5';
  const pos = (kind === 'uniq') ? campRuneUPos(i) : campRuneNPos(i);
  const r0 = (kind === 'uniq') ? RUNE_R_U : RUNE_R_N;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  ring.setAttribute('class', 'rnRipple');
  ring.setAttribute('points', _runeHexPts(pos[0], pos[1], r0));
  ring.setAttribute('style', 'stroke:' + c + ';transform-origin:' + pos[0] + 'px ' + pos[1] + 'px');
  g.appendChild(ring);
  setTimeout(() => ring.remove(), 620); }
// 🎒 가방 줄의 버튼이 한 번 부푼다 — 빠진 룬이 어디로 갔는지 눈이 따라간다
function campRuneBagPop(key){
  const el = document.querySelector('#campRune .rnHb[data-key="' + key + '"]');
  if(!el) return;
  el.classList.remove('rnPop'); void el.offsetWidth;
  el.classList.add('rnPop');
  setTimeout(() => el.classList.remove('rnPop'), 460); }

// ✈ 날아가는 룬 — 호를 그리며 간다. 도착하면 onLand 를 부른다.
//   ⚠ 그림은 **끝까지 또렷하다**. 흐려지며 사라지면 「도착」이 아니라 「없어짐」으로 보인다.
function _runeFly(key, from, to, ms, opt){
  const host = document.getElementById('campRune');
  const O = opt || {};
  const done = () => { if(O.onLand) O.onLand(); };
  if(!host || !from || !to){ done(); return; }
  const src = runeIcoSrc(key); if(!src){ done(); return; }
  const hb = host.getBoundingClientRect();
  const el = document.createElement('img');
  el.className = 'rnFly'; el.src = src; el.draggable = false;
  el.style.left = Math.round(from.x - hb.left - 17) + 'px';
  el.style.top  = Math.round(from.y - hb.top - 17) + 'px';
  if(O.tint) el.style.filter = 'drop-shadow(0 0 7px ' + O.tint + ')';
  host.appendChild(el);
  const dx = to.x - from.x, dy = to.y - from.y;
  const arc = Math.min(RUNE_ARC_MAX, Math.hypot(dx, dy) * 0.34);
  const run = () => {
    const kf = [
      { transform:'translate(0px,0px) scale(1)', opacity:1, offset:0 },
      { transform:'translate(' + (dx * 0.28).toFixed(1) + 'px,' + (dy * 0.28 - arc * 0.82).toFixed(1)
        + 'px) scale(1.16)', opacity:1, offset:0.34 },
      { transform:'translate(' + (dx * 0.72).toFixed(1) + 'px,' + (dy * 0.72 - arc * 0.5).toFixed(1)
        + 'px) scale(1.06)', opacity:1, offset:0.72 },
      { transform:'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(.94)',
        opacity:1, offset:1 }];
    const a = el.animate ? el.animate(kf, { duration: ms, easing:'cubic-bezier(.32,.02,.2,1)',
      fill:'forwards' }) : null;
    const fin = () => { el.remove(); done(); };
    if(a) a.onfinish = fin; else setTimeout(fin, ms); };
  // ⏳ 늦게 띄우는 것(교체의 «들어오는 것»)은 그만큼 기다렸다 뜬다 — 두 그림이 겹쳐 날지 않게
  if(O.delay){ el.style.opacity = '0';
    setTimeout(() => { el.style.opacity = '1'; run(); }, O.delay); }
  else requestAnimationFrame(run); }
// 📍 화면에서의 자리 — 칸 / 가방 줄의 버튼
function _runeSlotAt(kind, i){
  const el = document.querySelector('#rnG [data-rk="' + kind + '"][data-ri="' + i + '"]');
  if(!el) return null; const r = el.getBoundingClientRect();
  return { x:r.left + r.width / 2, y:r.top + r.height / 2 }; }
function _runeBagAt(key){
  const el = document.querySelector('#campRune .rnHb[data-key="' + key + '"]');
  if(!el) return null; const r = el.getBoundingClientRect();
  return { x:r.left + r.width / 2, y:r.top + r.height / 2 }; }
// 🔁 실제 교체 — 있던 것은 가방으로, 고른 것은 칸으로.
function campRuneSwapDo(kind, i){
  const key = _runeSwapKey; if(!key) return false;
  const old = campRuneEq(kind)[i] || null;
  if(!campRuneCanEquip(kind, i, key)){
    if(typeof toast === 'function') toast('이 칸에는 못 넣습니다'); return false; }
  // 📐 자리를 **바꾸기 전에** 잰다 — 다시 그리면 가방 줄이 달라진다
  const slotP = _runeSlotAt(kind, i);
  const bagP  = _runeBagAt(key);
  _runeSwapKey = '';
  const R = campRuneState(); if(!R) return false;
  R[kind][i] = key; campRuneTouch();
  if(typeof saveMeta === 'function') saveMeta();
  if(typeof playSfx === 'function') playSfx('ui_tab');
  _runeVeil = _runeVeilKey(kind, i);                   // 🫥 다시 그리기 **전에** 감춘다
  campRuneRender();
  // ✈ 그린 뒤에 잰다 — 빠진 룬이 돌아갈 가방 줄은 이제야 생긴다
  const backP = old ? _runeBagAt(old) : null;
  // ⭐ **나가는 것이 먼저다.** 둘이 같이 날면 어느 것이 들어오는지 안 읽힌다.
  if(old && slotP && backP){
    const oc = (RUNE_GD[runeParse(old).gd] || {}).col || '';
    _runeFly(old, slotP, backP, RUNE_FLY_MS,
      { tint:oc, onLand: () => campRuneBagPop(old) }); }
  if(bagP && slotP){
    const nc = (RUNE_GD[runeParse(key).gd] || {}).col || '';
    _runeFly(key, bagP, slotP, RUNE_FLY_MS,
      { tint:nc, delay: old ? RUNE_FLY_GAP : 0, onLand: () => campRuneLand(kind, i, key) }); }
  else campRuneLand(kind, i, key);
  return true; }

// ── 🗒 효과 쪽지 — 칸을 길게 누르면 그 칸 옆에 뜬다 ─────────────────────
//   ⭐ 확인창(.ecCard)이 아니다. 「무엇을 얼마나 올리나」만 말하는 **읽는 쪽지**라 버튼이 없다.
//     아무 데나 누르면 사라진다(닫기 버튼을 두면 그것을 누르러 가야 한다).
//   ⚠ 자리는 **누른 칸의 화면 좌표**에서 낸다 — 판이 밀리고 확대되므로 SVG 좌표로는 못 잡는다.
//     위로 띄우되 화면 위를 넘으면 아래로 내린다.
const RUNE_TIP_W = 168;
function campRuneTipHide(){ const t = document.getElementById('rnTip'); if(t) t.remove(); }
function campRuneTipShow(key, el){
  campRuneTipHide();
  const host = document.getElementById('campRune'); if(!host || !el) return;
  const p = runeParse(key); if(!p.def) return;
  const c = (RUNE_GD[p.gd] || {}).col || '#8b95a5';
  const box = el.getBoundingClientRect(), hb = host.getBoundingClientRect();
  const tip = document.createElement('div');
  tip.id = 'rnTip'; tip.className = 'rnTip'; tip.style.setProperty('--rg', c);
  tip.innerHTML = runeIcoHTML(key, 'rnTipI')
    + '<span class="rnTipB"><b>' + runeName(key) + '</b>'
    + '<s>' + p.def.de + '</s>'
    + '<u>' + runeValTx(key) + '</u></span>'
    + (p.def.soon ? '<i class="rnTipS">아직 배선되지 않은 효과입니다</i>' : '');
  host.appendChild(tip);
  // 📐 가운데를 칸에 맞추고, 위가 모자라면 아래로 — 좌우는 화면 안으로 물린다
  const w = tip.offsetWidth || RUNE_TIP_W, h = tip.offsetHeight || 60;
  let x = box.left - hb.left + box.width / 2 - w / 2;
  let y = box.top - hb.top - h - 8;
  if(y < 6) y = box.bottom - hb.top + 8;
  x = Math.max(6, Math.min(hb.width - w - 6, x));
  tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(y) + 'px'; }

// 👆 **칸을 누르면** — 낀 칸은 **바로 빠지고**, 빈 칸은 골라진다(2026-09-04 사용자 확정).
//   ⭐ 넣고 빼는 데 확인 단계를 두지 않는다: 가방을 누르면 들어가고, 칸을 누르면 나온다.
//     빼는 것은 잃는 것이 아니라 **가방으로 돌아가는 것**이라 되돌리기가 쉽다.
//   ⛔ 낀 칸을 눌러 「고르기」 상태로 되돌리지 말 것 — 그러면 빼려고 두 번 눌러야 한다.
function campRuneSlotTap(kind, i){
  campRuneTipHide();
  // 🔁 교체 모드 — 흔들리는 칸을 누르면 바꾸고, 아닌 칸을 누르면 교체를 그만둔다
  if(_runeSwapKey){
    if(campRuneSwapCand(kind, i)){ campRuneSwapDo(kind, i); return; }
    // 빈 칸이면 교체가 아니라 **그냥 장착**이다(칸이 비어 있으니 뺄 것이 없다)
    const p0 = runeParse(_runeSwapKey);
    const want0 = (p0.def && p0.def.kind === 'uniq') ? 'uniq' : 'norm';
    if(kind === want0 && !campRuneEq(kind)[i] && campRuneCanEquip(kind, i, _runeSwapKey)){
      const k0 = _runeSwapKey; _runeSwapKey = '';
      campRuneEquipFly(kind, i, k0);
      return; }
    campRuneSwapEnd(); return; }
  const cur = campRuneEq(kind)[i] || null;
  if(cur){
    // ✈ 자리를 **빼기 전에** 잰다 — 빼고 나면 그 칸에 문양이 없다
    const from = _runeSlotAt(kind, i);
    campRuneUnequip(kind, i);
    const to = _runeBagAt(cur);
    const c = (RUNE_GD[runeParse(cur).gd] || {}).col || '';
    if(from && to) _runeFly(cur, from, to, RUNE_FLY_MS,
      { tint:c, onLand: () => campRuneBagPop(cur) });
    return; }
  campRunePick(kind, i); }

// 👆 **길게 누르면 효과 쪽지** — 낀 룬이 무엇을 얼마나 올리는지 그 자리에서 본다.
//   ⚠ 빈 칸에는 쪽지가 없다(보여 줄 것이 없다). 잠긴 칸은 애초에 누르는 면이 없다.
function campRuneSlotHold(kind, i, el){
  const cur = campRuneEq(kind)[i] || null;
  if(!cur) return;
  campRuneTipShow(cur, el); }

// 칸을 누르면 그 아래에 「끼울 수 있는 룬」이 펼쳐진다.
// ⭐ 새 팝업을 만들지 않는다 — 칸과 후보를 한 화면에서 봐야 바꿔 끼우는 판단이 된다.
function campRunePick(kind, i){
  const off = (!kind || i < 0) || (_runePickKind === kind && _runePick === i);
  if(off){ _runePickKind = ''; _runePick = -1; }
  else { _runePickKind = kind; _runePick = i; }
  campRuneRender();
  if(!off) campRuneFocus(); }
// ── 🎒 상시 가방 — 무엇을 갖고 있는지 늘 보인다 ─────────────────────────
//   ⭐ 프로필 장비창의 가방과 같은 문법이다(위=판 / 아래=가방, 각각 따로 스크롤).
//     ⛔ 칸을 눌러야 나타나는 임시 시트로 되돌리지 말 것 — 무엇을 살지·바꿀지 판단하려면
//       갖고 있는 것이 **늘** 보여야 한다(2026-09-03 사용자 확정).
//   ⭐ 누르면 **바로 끼운다**: 칸을 골라 뒀으면 그 칸에, 아니면 빈 칸 중 첫 칸에.
//
// 🔷 **줄 하나 = 룬 한 종류**다(2026-09-04 사용자 확정 · 목업 camp-rune-hexbtn7-4 ③안).
//   ⛔ 4열 카드 그리드(.rnB)로 되돌리지 말 것 — 같은 룬의 세 등급이 서로 떨어져 놓여서
//     「이 효과를 얼마나 갖고 있나」가 한눈에 안 읽혔다.
//   줄의 짜임: [그림] [효과 이름 / 등급 값 세 개] … [육각 버튼 셋 — 등급마다 하나]
//     · 이름은 **효과 이름**(def.de)이다. ⛔ 「윤회·손끝」 같은 룬 이름으로 되돌리지 말 것 —
//       무엇이 오르는지 못 읽는다(사용자 지적).
//     · 버튼 안 숫자는 **보유 개수**(×N)다. 못 가진 등급은 «–» 로 물린다.
//     · 등급은 **테두리 색**이 말한다(하급 회색 · 중급 하늘 · 상급 금 · 유니크 보라).
//   ⚠ 갈래(경제·전투·성장·유니크)마다 머리줄을 둔다 — 성좌와 같은 색이라 판과 이어 읽힌다.
const RUNE_BAG_W = 34;          // 육각 버튼 한 변 — 목업에서 잰 값(더 키우면 % 가 뾰족한 아래로 밀린다)
// 🎨 등급 그라데이션은 **한 벌만** 만들어 버튼 48개가 나눠 쓴다.
//   ⛔ 버튼마다 <defs> 를 넣지 말 것 — 같은 그라데이션 48벌이 문서에 쌓인다.
function _runeBagDefs(){
  let d = '<svg class="rnBagDefs" width="0" height="0" aria-hidden="true"><defs>'
    + '<linearGradient id="rbF" x1="0" y1="0" x2="0" y2="1">'
    +   '<stop offset="0" stop-color="#1b2634"/><stop offset="1" stop-color="#06090e"/></linearGradient>';
  for(const gd of ['low', 'mid', 'high', 'uniq']){
    const c = (RUNE_GD[gd] || {}).col || '#8b95a5';
    d += '<linearGradient id="rbE' + gd + '" x1="0" y1="0" x2="0" y2="1">'
      +   '<stop offset="0" stop-color="#ffffff" stop-opacity=".92"/>'
      +   '<stop offset=".42" stop-color="' + c + '"/>'
      +   '<stop offset="1" stop-color="' + c + '" stop-opacity=".34"/></linearGradient>'
      + '<radialGradient id="rbB' + gd + '">'
      +   '<stop offset="0" stop-color="' + c + '" stop-opacity=".26"/>'
      +   '<stop offset=".62" stop-color="' + c + '" stop-opacity=".08"/>'
      +   '<stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>'; }
  return d + '</defs></svg>'; }
// 값 표기에서 부호를 뗀다 — 줄 부제는 「1% · 2.5% · 5%」처럼 **세기의 눈금**이라 +가 군더더기다
function _runePctTx(key){ return runeValTx(key).replace('+', ''); }
// 육각 버튼 하나 — 성좌 칸의 「켜」를 축소해 넣는다(면 그라데이션 · 테두리 · 뒷광 · 안쪽 흰 실선)
function _runeBagHex(key, gd, own, off, full){
  const on = own > 0, W = RUNE_BAG_W, R = W / 2 - 1, c = (RUNE_GD[gd] || {}).col || '#8b95a5';
  let s = '<svg width="' + W + '" height="' + W + '" viewBox="0 0 ' + W + ' ' + W + '">';
  if(on) s += '<polygon points="' + _runeHexPts(W / 2, W / 2, R) + '" fill="url(#rbF)"'
      + ' stroke="url(#rbE' + gd + ')" stroke-width="1.2"/>'
    + '<circle cx="' + (W / 2) + '" cy="' + (W / 2) + '" r="' + (R * 0.7).toFixed(1)
      + '" fill="url(#rbB' + gd + ')"/>'
    + '<polygon points="' + _runeHexPts(W / 2, W / 2, R - 1.4) + '" fill="none"'
      + ' stroke="#fff" stroke-width=".55" opacity=".16"/>';
  else s += '<polygon points="' + _runeHexPts(W / 2, W / 2, R) + '" fill="rgba(255,255,255,.018)"'
    + ' stroke="rgba(150,170,200,.16)" stroke-width="1"/>';
  s += '</svg>';
  const cls = 'rnHb' + (on ? '' : ' none') + (off ? ' off' : '') + (full ? ' full' : '');
  return '<button class="' + cls + '" type="button" data-key="' + key + '" style="--rg:' + c + '"'
    + (on ? ' onclick="campRuneBagTap(\'' + key + '\')"' : ' disabled')
    + ' aria-label="' + runeName(key) + ' ' + own + '개">' + s
    + '<span class="rnHbL"><span class="rnHbN">' + (on ? '<em>×</em>' + own : '–') + '</span>'
    + '<span class="rnHbP">' + _runePctTx(key) + '</span></span></button>'; }
// 줄 하나 — 룬 한 종류(등급 셋을 한 줄에)
function _runeBagRow(d, kindSel){
  const gds = (d.kind === 'uniq') ? ['uniq'] : RUNE_GRADES;
  const kind = (d.kind === 'uniq') ? 'uniq' : 'norm';
  const off = false;      // 🔎 거르고 나면 남은 줄은 전부 끼울 수 있다(물릴 것이 없다)
  // 그림은 **가진 것 중 가장 높은 등급**을 보여 준다 — 하나도 없으면 가장 낮은 등급
  let ico = runeKey(d.id, gds[0]);
  for(const gd of gds){ const k = runeKey(d.id, gd); if(campRuneOwn(k) > 0) ico = k; }
  let bt = '';
  for(const gd of gds){ const k = runeKey(d.id, gd);
    bt += _runeBagHex(k, gd, campRuneOwn(k), off, campRuneFree(k) <= 0); }
  return '<div class="rnRw' + (off ? ' off' : '') + '">' + runeIcoHTML(ico, 'rnRwI')
    + '<span class="rnRwT">' + d.de + (d.soon ? '<u>준비 중</u>' : '')
    // 🎨 등급 값은 **그 등급의 색**으로 적는다 — 버튼 테두리와 같은 색이라 줄과 버튼이 이어 읽힌다
    + '<s>' + gds.map(gd => '<b style="color:' + ((RUNE_GD[gd] || {}).col || '#69737f') + '">'
        + _runePctTx(runeKey(d.id, gd)) + '</b>').join('<i>·</i>') + '</s></span>'
    + '<span class="rnRwB">' + bt + '</span></div>'; }
function _runeBagHTML(){
  const kindSel = _runePickKind || '';
  // 🔎 **칸을 고르면 그 갈래만 남긴다**(2026-09-04 사용자 확정: 「전투 칸이면 전투 룬만」).
  //   ⛔ 물리기만(.off) 하지 말 것 — 못 끼우는 줄이 화면을 차지하면 고르는 일이 안 줄어든다.
  //   ⚠ 갈래는 **칸이 정한다**(runeSlotGrp) — 유니크 칸이면 유니크만.
  const grpSel = kindSel ? (kindSel === 'uniq' ? 'uniq' : runeSlotGrp(_runePick)) : '';
  // 머리줄 — 고른 칸이 있으면 그 칸을 말하고, 차 있으면 빼는 길을 준다
  let hd;
  if(kindSel){
    const eq = campRuneEq(kindSel), cur = eq[_runePick] || null;
    const nm = (kindSel === 'uniq' ? '유니크' : '일반') + ' ' + (_runePick + 1) + '번 칸';
    const gn = (RUNE_GRP[grpSel] || {}).nm || '';
    hd = '<span class="rnBagT">' + nm + (cur ? ' · ' + runeName(cur) : ' · 비어 있음') + '</span>'
      + (gn ? '<span class="rnBagN">' + gn + ' 룬만</span>' : '')
      + (cur ? '<button class="rnOff" type="button" onclick="campRuneUnequip(\'' + kindSel + '\','
          + _runePick + ')">빼기</button>' : ''); }
  // ⛔ 「누르면 빈 칸에 끼웁니다」 안내는 뺐다(2026-09-04 사용자 확정) —
  //   한 번 배우면 계속 자리만 차지한다. 칸을 고른 상태의 안내는 위에 남는다.
  else hd = '<span class="rnBagT">보유한 룬</span>';
  let g = '';
  for(const grp of RUNE_GRPS.concat('uniq')){
    if(grpSel && grp !== grpSel) continue;              // 🔎 고른 칸의 갈래만
    const q = RUNE_LIST.filter(d => (d.kind === 'uniq' ? 'uniq' : d.grp) === grp);
    if(!q.length) continue;
    const gi = RUNE_GRP[grp] || { nm:grp, col:'#8b95a5' };
    g += '<div class="rnGrpH" style="--gc:' + gi.col + '"><i></i><span>' + gi.nm + '</span><u></u></div>'
      + q.map(d => _runeBagRow(d, kindSel)).join(''); }
  if(!g) g = '<div class="rnEmp">가진 룬이 없습니다 — 룬 상점에서 삽니다</div>';
  return '<div class="rnBag">' + _runeBagDefs() + '<div class="rnBagH">' + hd + '</div>'
    + '<div class="rnBagG uiScroll bare">' + g + '</div></div>'; }

// 빈 칸 중 첫 칸에 끼운다 — 「고르지 않고 그냥 눌렀을 때」의 길
function campRuneAuto(key){
  const pp = runeParse(key); if(!pp.def) return false;
  const kind = (pp.def.kind === 'uniq') ? 'uniq' : 'norm';
  if(campRuneFree(key) <= 0) return false;
  const R = campRuneState(); if(!R) return false;
  const n = campRuneSlots(kind);
  // ⚠ **그 룬이 들어갈 수 있는** 빈 칸을 찾는다 — 그냥 첫 빈 칸을 잡으면
  //   갈래가 다른 성좌에서 걸려 장착이 실패한다(성장 룬이 경제 칸에서 막혔다).
  for(let i = 0; i < n; i++) if(!R[kind][i] && campRuneCanEquip(kind, i, key)){
    // ✈ 빈 칸에 들어갈 때도 **날아서** 들어간다(2026-09-04 사용자 확정) —
    //   교체만 날아가면 「그냥 넣기」와 「바꿔 넣기」가 다른 화면처럼 보인다.
    if(!campRuneEquipFly(kind, i, key)) return false;
    return true; }
  return false; }
// ✈ 장착 + 날아가는 그림 — 가방 줄에서 칸으로.
//   ⚠ 출발 자리는 **끼우기 전에** 잰다(다시 그리면 그 버튼이 «–» 로 바뀌거나 자리가 달라진다).
function campRuneEquipFly(kind, i, key, opt){
  const O = opt || {};
  const from = _runeBagAt(key);
  // 🫥 **끼우기 전에** 감춰 둔다 — campRuneEquip 이 곧 다시 그리는데, 그때 이미 감춰져 있어야
  //   문양이 「생겼다 사라지는」 것으로 안 보인다.
  _runeVeil = _runeVeilKey(kind, i);
  if(!campRuneEquip(kind, i, key)){ _runeVeil = ''; return false; }
  const to = _runeSlotAt(kind, i);
  if(!from || !to){ _runeVeil = ''; campRuneRender(); return true; }   // 자리를 못 찾으면 그냥 보인다
  const c = (RUNE_GD[runeParse(key).gd] || {}).col || '';
  _runeFly(key, from, to, RUNE_FLY_MS,
    { tint:c, delay:O.delay || 0, onLand: () => campRuneLand(kind, i, key) });
  return true; }
// 🎒 가방을 눌렀을 때 — 칸을 골라 뒀으면 **그 칸에**, 아니면 **빈 칸에**.
// 🎯 같은 갈래의 **다음 빈 칸** — 없으면 -1.
//   ⚠ 한 바퀴 돌며 찾는다(뒤가 다 찼으면 앞의 빈 칸으로). 갈래를 넘어가지는 않는다 —
//     성좌가 바뀌면 화면이 멀리 뛰고, 가방도 통째로 갈린다.
function campRunePickNext(kind, from){
  const n = campRuneSlots(kind), eq = campRuneEq(kind);
  const grp = (kind === 'uniq') ? 'uniq' : runeSlotGrp(from);
  for(let s = 1; s <= n; s++){ const i = (from + s) % n;
    if(eq[i]) continue;
    if(kind === 'norm' && runeSlotGrp(i) !== grp) continue;
    return i; }
  return -1; }
function campRuneBagTap(key){
  const pp = runeParse(key); if(!pp.def) return;
  const kind = (pp.def.kind === 'uniq') ? 'uniq' : 'norm';
  const say = m => { if(typeof toast === 'function') toast(m); };
  if(_runePickKind && _runePickKind !== kind){
    say(kind === 'uniq' ? '유니크 칸에만 들어갑니다' : '일반 칸에만 들어갑니다'); return; }
  if(_runePickKind && _runePick >= 0){
    // 고른 칸에 이미 같은 룬이면 아무 일도 아니다
    const cur = campRuneEq(kind)[_runePick] || null;
    if(cur === key) return;
    const at = _runePick;
    if(!campRuneEquipFly(kind, at, key)){ say('남은 룬이 없습니다'); return; }
    // 🎯 **다음 빈 칸으로 옮겨 간다**(2026-09-04 사용자 요청) — 가방을 연달아 누르면
    //   그 갈래의 빈 칸이 차례로 채워진다. 칸을 하나 넣을 때마다 다시 고르지 않아도 된다.
    //   ⛔ 고른 자리를 그대로 두지 말 것 — 다음 탭이 방금 넣은 것을 **덮어쓴다**.
    const nx = campRunePickNext(kind, at);
    if(nx >= 0) _runePick = nx;
    else { _runePickKind = ''; _runePick = -1; }   // 그 갈래가 다 찼다 — 가방을 전체로 되돌린다
    campRuneRender();
    return; }
  if(campRuneAuto(key)) return;
  // 🔁 **꽉 찼으면 교체 모드**로 들어간다 — 예전에는 여기서 아무 일도 안 일어났다.
  if(campRuneFree(key) <= 0){ say('남은 룬이 없습니다'); return; }
  campRuneSwapBegin(key); }

// ── 룬 상점 ─────────────────────────────────────────────────────────────
// ══ 🛒 룬 상점 — 추천 · 주간 할인 · 일반 (2026-09-04 사용자 확정) ═══════
//   ⭐ 세 구역의 **역할이 다르다**:
//     ① 추천 — 지금 상태에 맞는 셋. 값은 그대로고 **고르는 수고**만 줄인다.
//     ② 주간 할인 — 30% 싸지만 **종류마다 한 개**뿐. 「매주 챙기는 것」이다.
//     ③ 일반 — 언제든 살 수 있는 곳. 값은 제값(RUNE_GEM).
//   ⛔ 값의 층을 셋으로 만들지 말 것 — 추천이 제 값을 가지면 「어디서 사야 싼가」를
//     매번 계산해야 한다. 추천은 **바로가기**일 뿐이고, 할인 중이면 할인가로 보여 준다.
//   ⛔ 할인에 재고를 두지 않으면 그 주의 6종은 아무도 일반에서 안 산다 — 일반 구역이 죽는다.

// 📦 **한 종류는 여덟 개까지**(사용자 확정) — 일반 룬은 갈래마다 칸이 여덟이라
//   한 종류로 성좌 하나를 채울 수 있는 선이다. ⛔ 넘겨서 팔지 말 것.
const RUNE_OWN_MAX = 8;
const RUNE_SALE_OFF = 0.30;              // 할인율
const RUNE_SALE_N = 5;                   // 주마다 도는 일반 룬 수(등급은 섞인다)
// 🕘 주는 **월요일 09:00** 에 바뀐다(사용자 확정). 로컬 시각 기준이다.
const RUNE_WEEK_DOW = 1, RUNE_WEEK_HOUR = 9;
function runeWeekStart(t){
  const now = (t == null) ? Date.now() : t;
  const d = new Date(now);
  d.setHours(RUNE_WEEK_HOUR, 0, 0, 0);
  const dow = (d.getDay() - RUNE_WEEK_DOW + 7) % 7;   // 이번 주 월요일까지 되돌린 날수
  d.setDate(d.getDate() - dow);
  if(now < d.getTime()) d.setDate(d.getDate() - 7);   // 아직 09:00 전이면 지난 주다
  return d.getTime(); }
function runeWeekNo(t){ return Math.floor(runeWeekStart(t) / 86400000 / 7); }
function runeWeekLeft(t){
  const now = (t == null) ? Date.now() : t;
  const nx = new Date(runeWeekStart(now)); nx.setDate(nx.getDate() + 7);
  return Math.max(0, nx.getTime() - now); }
// ⏳ 「3일 4시간」처럼 — 분 아래는 안 적는다(초까지 세면 화면이 쉬지 않는다)
function runeLeftTx(ms){
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if(d > 0) return d + '일 ' + (h % 24) + '시간';
  if(h > 0) return h + '시간 ' + (m % 60) + '분';
  return Math.max(1, m) + '분'; }

// 🎲 주 번호를 씨앗으로 한 **정해진 난수** — 같은 주에는 늘 같은 목록이 나온다
function runeHash(s){ let h = 2166136261;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000000) / 1000000; }
// 🛒 이번 주 할인 목록 — 일반 5(등급 섞임) + 유니크 1
//   ⚠ 목록은 **주 번호만** 보고 정한다. 보유·진행에 따라 달라지면 「이번 주 목록」이 사람마다 달라진다.
function runeSaleList(t){
  const wk = runeWeekNo(t), seed = 'rs' + wk;
  const norm = [];
  for(const d of RUNE_LIST){ if(d.kind === 'uniq') continue;
    for(const gd of RUNE_GRADES) norm.push(runeKey(d.id, gd)); }
  norm.sort((a, b) => runeHash(seed + a) - runeHash(seed + b));
  const uq = RUNE_LIST.filter(d => d.kind === 'uniq').map(d => d.id);
  uq.sort((a, b) => runeHash(seed + 'u' + a) - runeHash(seed + 'u' + b));
  return norm.slice(0, RUNE_SALE_N).concat(uq.slice(0, 1)); }
function runeSaleGem(key){ return Math.max(1, Math.round(runeGem(key) * (1 - RUNE_SALE_OFF))); }
// 📦 이번 주에 이미 산 것 — 주가 바뀌면 저절로 비워진다
function runeSaleState(){
  const R = campRuneState(); if(!R) return null;
  const wk = runeWeekNo();
  if(!R.wk || R.wk.no !== wk) R.wk = { no:wk, sold:{} };
  if(!R.wk.sold || typeof R.wk.sold !== 'object') R.wk.sold = {};
  return R.wk; }
function runeSaleLeft(key){
  const w = runeSaleState(); if(!w) return 0;
  return (runeSaleList().indexOf(key) < 0) ? 0 : (w.sold[key] ? 0 : 1); }
function runeOnSale(key){ return runeSaleList().indexOf(key) >= 0 && runeSaleLeft(key) > 0; }
// 💎 지금 이 룬의 값 — 할인 재고가 남아 있으면 할인가다(단일 소스)
function runeNowGem(key){ return runeOnSale(key) ? runeSaleGem(key) : runeGem(key); }

// ⭐ 추천 셋 — **지금 사면 바로 쓸 수 있는 것**부터
//   ① 빈 칸이 있는 갈래에서 ② 아직 안 가진 것 ③ 그것도 없으면 낀 것보다 한 등급 위
//   ⛔ 무작위로 뽑지 말 것 — 「왜 이것을 권하나」를 한 줄로 댈 수 없으면 추천이 아니다.
function runeRecoList(){
  const R = campRuneState(); if(!R) return [];
  const eqN = campRuneEq('norm'), eqU = campRuneEq('uniq');
  const openN = campRuneSlots('norm'), openU = campRuneSlots('uniq');
  // 갈래마다 빈 칸 수
  const hole = {};
  for(let i = 0; i < openN; i++) if(!eqN[i]){ const g = runeSlotGrp(i); hole[g] = (hole[g] | 0) + 1; }
  let holeU = 0; for(let i = 0; i < openU; i++) if(!eqU[i]) holeU++;
  const out = [], seen = {};
  const push = (key, why) => { if(!key || seen[key]) return;
    if(campRuneOwn(key) >= RUNE_OWN_MAX) return;
    // ⛔ 아직 닿는 데가 없는 룬은 **권하지 않는다** — 젬을 쓰라고 등 떠밀 수는 없다
    { const pd = runeParse(key).def; if(pd && pd.soon) return; }
    seen[key] = 1; out.push({ key, why }); };
  // ① 빈 칸이 많은 갈래부터
  const grps = RUNE_GRPS.slice().sort((a, b) => (hole[b] | 0) - (hole[a] | 0));
  for(const g of grps){
    if(!(hole[g] > 0)) continue;
    for(const d of RUNE_LIST){ if(d.kind === 'uniq' || d.grp !== g) continue;
      // 안 가진 것 중 **가장 높은 등급**을 권한다(살 수 있으면 좋은 것을)
      for(const gd of RUNE_GRADES.slice().reverse()){ const k = runeKey(d.id, gd);
        if(campRuneOwn(k) > 0) continue;
        push(k, (RUNE_GRP[g] || {}).nm + ' 칸이 ' + hole[g] + '개 비었습니다'); break; }
      if(out.length >= 3) break; }
    if(out.length >= 3) break; }
  if(holeU > 0) for(const d of RUNE_LIST){ if(d.kind !== 'uniq') continue;
    const k = runeKey(d.id, 'uniq');
    if(campRuneOwn(k) > 0) continue;
    push(k, '유니크 칸이 ' + holeU + '개 비었습니다'); break; }
  // ② 칸이 다 찼으면 — 낀 것 중 **등급을 올릴 수 있는 것**
  if(out.length < 3) for(let i = 0; i < openN; i++){
    const cur = eqN[i]; if(!cur) continue;
    const p = runeParse(cur); if(!p.def || p.gd === 'high') continue;
    const up = runeKey(p.def.id, p.gd === 'low' ? 'mid' : 'high');
    push(up, runeName(cur) + ' 을 한 등급 올립니다');
    if(out.length >= 3) break; }
  return out.slice(0, 3); }

// ── 🛒 상점 화면 — 추천 · 주간 할인 · 일반(갈래 탭) ─────────────────────
// 🔷 갈래 아이콘의 속 글리프 — 경제=마름모(재화) · 전투=방패 · 성장=위 화살 · 유니크=별.
//   ⛔ 새 에셋을 만들지 않는다: 도형 넷이면 충분하고, 색은 이미 정해진 갈래 색을 쓴다.
const RUNE_TAB_GLYPH = {
  eco:  'M12 3 L20 12 L12 21 L4 12 Z',
  war:  'M12 3 L20 7 V13 C20 17 12 21 12 21 C12 21 4 17 4 13 V7 Z',
  grow: 'M12 3 L19 11 H15 V21 H9 V11 H5 Z',
  uniq: 'M12 2 L14.6 9.2 L22 12 L14.6 14.8 L12 22 L9.4 14.8 L2 12 L9.4 9.2 Z' };
const RUNE_TAB_ICO = 22;
// 탭 하나의 그림 — 육각 테두리(갈래 색) + 속 글리프. 고른 것만 진하다.
function _runeTabIco(grp, on){
  const c = (grp === 'uniq') ? ((RUNE_GD.uniq || {}).col || '#c98bff')
                             : ((RUNE_GRP[grp] || {}).col || '#b4cdeb');
  const S = RUNE_TAB_ICO, R = S / 2 - 1, q = [];
  for(let i = 0; i < 6; i++){ const a = Math.PI / 180 * (60 * i - 90);
    q.push((S / 2 + R * Math.cos(a)).toFixed(1) + ',' + (S / 2 + R * Math.sin(a)).toFixed(1)); }
  const k = (S * 0.60 / 24).toFixed(3), off = (S / 2 - S * 0.30).toFixed(1);
  return '<svg class="rnTabI" width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + ' ' + S + '">'
    + '<polygon points="' + q.join(' ') + '" fill="' + (on ? 'rgba(255,255,255,.05)' : 'none')
    +   '" stroke="' + c + '" stroke-width="1" opacity="' + (on ? '.85' : '.38') + '"/>'
    + '<g transform="translate(' + off + ',' + off + ') scale(' + k + ')">'
    + '<path d="' + (RUNE_TAB_GLYPH[grp] || RUNE_TAB_GLYPH.eco) + '" fill="' + c
    +   '" opacity="' + (on ? '1' : '.45') + '"/></g></svg>'; }
let _runeShopTab = 'eco';                // 일반 구역에서 보고 있는 갈래
function campRuneShopTab(g){ _runeShopTab = g; campRuneRender(); }
// 💠 한 칸 — 그림 · 이름 · 등급 · 값. 살 수 없으면 왜 못 사는지 칸이 말한다.
function _runeBuyCell(key, opt){
  const O = opt || {}, p = runeParse(key); if(!p.def) return '';
  const gd = p.gd, c = (RUNE_GD[gd] || {}).col || '#8b95a5';
  const gemI = (typeof resIco === 'function') ? resIco('gem') : '';
  const own = campRuneOwn(key), full = own >= RUNE_OWN_MAX;
  const sale = runeOnSale(key), cost = runeNowGem(key);
  const have = (typeof profGem === 'function') ? profGem() : 0;
  const soldOut = O.sale && !sale;                    // 할인 칸인데 재고를 이미 썼다
  const off = full || soldOut || have < cost;
  let tail;
  if(full) tail = '<u class="max">' + RUNE_OWN_MAX + '개 보유</u>';
  else if(soldOut) tail = '<u class="max">이번 주 완료</u>';
  else tail = '<u>' + gemI + ' ' + cost
    + (sale ? '<s>' + runeGem(key) + '</s>' : '') + '</u>';
  return '<button class="rnBuy' + (sale ? ' sale' : '') + '" type="button"'
    + (off ? ' disabled' : '') + ' style="--rg:' + c + '"'
    + ' onclick="campRuneBuy(\'' + p.def.id + '\',\'' + gd + '\')">'
    + (sale ? '<i class="rnOff">-' + Math.round(RUNE_SALE_OFF * 100) + '%</i>' : '')
    + runeIcoHTML(key, 'rnBuyI')
    + (p.def.soon ? '<i class="rnSoon">준비 중</i>' : '')
    + '<b>' + (O.nameFull ? runeName(key) : ((RUNE_GD[gd] || {}).tx || '')) + '</b>'
    + '<span>' + runeValTx(key) + '</span>' + tail
    + (own > 0 ? '<em class="rnHas">×' + own + '</em>' : '') + '</button>'; }

// 🧾 상점 줄의 **작은 등급 버튼** — 가방의 육각 버튼과 같은 자리를 맡되 값(젬)을 적는다.
//   ⚠ 가방은 「몇 개 가졌나」, 상점은 「얼마인가」다 — 같은 자리에 다른 숫자가 온다.
function _runeBuySmall(key){
  const p = runeParse(key); if(!p.def) return '';
  const gd = p.gd, c = (RUNE_GD[gd] || {}).col || '#8b95a5';
  const gemI = (typeof resIco === 'function') ? resIco('gem') : '';
  const own = campRuneOwn(key), full = own >= RUNE_OWN_MAX;
  const sale = runeOnSale(key), cost = runeNowGem(key);
  const have = (typeof profGem === 'function') ? profGem() : 0;
  const off = full || have < cost;
  return '<button class="rnBuyS' + (sale ? ' sale' : '') + '" type="button"'
    + (off ? ' disabled' : '') + ' style="--rg:' + c + '"'
    + " onclick=\"campRuneBuy('" + p.def.id + "','" + gd + "')\">"
    // 🏷 할인 중이면 그렇게 말한다 — 값만 싸면 「왜 싼가」를 모른다(일반 목록에도 뜬다)
    + (sale ? '<i class="rnOffS">-' + Math.round(RUNE_SALE_OFF * 100) + '%</i>' : '')
    + '<b>' + ((RUNE_GD[gd] || {}).tx || '') + '</b>'
    + (full ? '<u class="max">' + RUNE_OWN_MAX + '개</u>'
            : '<u' + (sale ? ' class="sale"' : '') + '>' + gemI + ' ' + cost + '</u>')
    + (own > 0 && !full ? '<em>×' + own + '</em>' : '') + '</button>'; }
function _runeShopHTML(){
  // ⛔ 「보유 젬」 줄은 뺐다(2026-09-04 사용자 확정) — 젬은 **상단 재화 바**에 이미 있다.
  //   같은 숫자를 두 층에 띄우면 어느 쪽이 진짜인지 묻게 된다.
  let h = '';

  // ⭐ ① 추천 — 지금 사면 바로 쓸 수 있는 셋. 값은 건드리지 않는다(바로가기일 뿐).
  const reco = runeRecoList();
  if(reco.length){
    h += '<div class="rnSec"><div class="rnSecH"><span class="rnSecT">추천</span>'
      + '<span class="rnSecN">' + reco[0].why + '</span></div>'
      + '<div class="rnGrid3">'
      + reco.map(r => _runeBuyCell(r.key, { nameFull:true })).join('')
      + '</div></div>'; }

  // 🛒 ② 주간 할인 — 30% 싸지만 **종류마다 한 개**. 남은 시간을 함께 적는다.
  // 📶 **등급 순으로 늘어놓는다**(2026-09-05 사용자 확정) — 하 · 중 · 상 · 유니크.
  //   왼쪽 위에서 오른쪽 아래로 갈수록 좋은 것이라 값도 함께 커진다(읽는 결이 한 방향).
  //   ⚠ 목록 자체(주간 시드)는 안 건드린다 — **보여 주는 순서만** 정한다.
  const rank = { low:0, mid:1, high:2, uniq:3 };
  const sale = runeSaleList().slice()
    .sort((a, b) => (rank[runeParse(a).gd] | 0) - (rank[runeParse(b).gd] | 0));
  h += '<div class="rnSec"><div class="rnSecH"><span class="rnSecT">주간 할인</span>'
    + '<span class="rnSecN">' + runeLeftTx(runeWeekLeft()) + ' 뒤 갱신</span></div>'
    + '<div class="rnGrid3">'
    + sale.map(k => _runeBuyCell(k, { sale:true, nameFull:true })).join('')
    + '</div></div>';

  // 🗂 ③ 일반 — 갈래 탭으로 나눈다(16종 × 3등급이면 한 목록에 다 못 담는다)
  const tabs = RUNE_GRPS.concat('uniq');
  const idx = Math.max(0, tabs.indexOf(_runeShopTab));
  h += '<div class="rnSec"><div class="rnSecH"><span class="rnSecT">상점</span></div>';
  // 🗂 탭 띠는 **공용 함수**다(CLAUDE.md 「세그먼트 이동 바」) — 새로 만들지 않는다.
  //   ⚠ items 는 {label} 이고 act 는 **함수**(k => 코드)다.
  //   🔷 **아이콘 탭**(2026-09-05 사용자 확정 · 목업 shop-icontab-4 ①안) —
  //     육각 아이콘 + 이름, 고른 칸만 한 단 밝고 **아래 밑변 광원 한 줄**이 켜진다.
  //     ⭐ 공용 함수(segNavHTML)를 그대로 쓴다 — label 에 그림을 담고 CSS 변형(.stack)이 세로로 세운다.
  //     ⛔ 상점 전용 탭 함수를 새로 만들지 말 것.
  h += (typeof segNavHTML === 'function')
    ? segNavHTML(tabs.map((g, k) => ({
        label: _runeTabIco(g, k === idx) + '<span>' + ((RUNE_GRP[g] || {}).nm || g) + '</span>' })), idx,
        k => "campRuneShopTab('" + tabs[k] + "')").replace('class="pdSeg"', 'class="pdSeg stack"')
    : '';
  h += '<div class="rnShopList">';
  for(const d of RUNE_LIST){
    const g = (d.kind === 'uniq') ? 'uniq' : d.grp;
    if(g !== tabs[idx]) continue;
    const gds = (d.kind === 'uniq') ? ['uniq'] : RUNE_GRADES;
    // 🧾 **가로줄** — 가방과 같은 짜임이라 두 화면이 한 어휘로 읽힌다
    h += '<div class="rnShopRw">'
      + runeIcoHTML(runeKey(d.id, (d.kind === 'uniq') ? 'uniq' : 'mid'), 'rnRwI')
      + '<span class="rnRwT">' + d.de + (d.soon ? '<u>준비 중</u>' : '')
      + '<s>' + gds.map(gd => _runePctTx(runeKey(d.id, gd))).join(' · ') + '</s></span>'
      + '<span class="rnRwB">' + gds.map(gd => _runeBuySmall(runeKey(d.id, gd))).join('')
      + '</span></div>'; }
  h += '</div></div>';
  return h; }
