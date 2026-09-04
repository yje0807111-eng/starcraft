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
  { id:'kill',  nm:'전과의 룬',   kind:'norm', grp:'grow', eff:'killGain',ico:'upg',
    de:'적 처치 보상' },
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
function campRuneMaxRound(){ const per = (typeof CAMP_ROUND_MAX !== 'undefined') ? CAMP_ROUND_MAX : 50;
  const dgs = (typeof CAMP_DG_MAX !== 'undefined') ? (CAMP_DG_MAX | 0) : 10;
  return per * Math.max(1, dgs); }
// 열린 칸 수 — 표에서 「도달 라운드 이하」인 것을 센다
function campRuneSlots(kind){ const tb = RUNE_SLOT_R[kind] || [];
  if(CAMP_RUNE_FREE) return tb.length;          // 🔧 전부 열어 둔다(위 스위치)
  const b = campRuneBestRound();
  let n = 0; for(const r of tb) if(b >= r) n++; return n; }
// 다음 칸이 열리는 라운드(전부 열렸으면 0)
function campRuneNextAt(kind){ const tb = RUNE_SLOT_R[kind] || []; const b = campRuneBestRound();
  for(const r of tb) if(b < r) return r; return 0; }

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
function runeGradeOf(key){ return runeParse(key).gd; }
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
  const cost = runeGem(key); if(cost <= 0) return false;
  const p = (typeof PROF === 'function') ? PROF() : null; if(!p) return false;
  const have = (typeof profGem === 'function') ? profGem() : 0;
  if(have < cost){ if(typeof toast === 'function') toast('💎 젬이 부족합니다'); return false; }
  p.gem = (p.gem || 0) - cost;
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
  if(el) el.classList.remove('on', 'rnIn');
  _runePick = -1; _runePickKind = '';
  if(typeof campRebArtOff === 'function') campRebArtOff(); }

// 🧭 **룬 구역의 유일한 입구.** ⛔ campRuneOpen 을 밖에서 직접 부르지 말 것 —
//   네비 상태(구역·하위)를 맞춰 주지 않아 하위 칸이 통째로 안 나온다(환생 구역과 같은 함정).
function campRuneEnter(sec){
  const s = (sec === 'shop') ? 'shop' : 'slot';
  const wasIn = campRuneIsOn();
  _runeSec = s; _runePick = -1; _runePickKind = '';
  campRuneOpen();
  { const el = document.getElementById('campRune'); if(el) el.classList.toggle('rnIn', !wasIn); }
  if(typeof navShow === 'function') navShow('rune');
  if(typeof _navDrill !== 'undefined') _navDrill = 'rune';
  if(typeof navPaint === 'function') navPaint();
  return s; }

function campRuneRender(){
  const box = document.getElementById('rnBody'); if(!box) return;
  if(!campRuneState()){ box.innerHTML = ''; return; }
  const _shop = (_runeSec === 'shop');
  box.classList.toggle('shop', _shop);       // 상점만 흐르는 목록이다(판은 전체를 채운다)
  // 📜 **스크롤은 젬 상점과 같은 규격이다**(2026-09-04 사용자 확정) — 공용 .uiScroll 하나뿐.
  //   ⛔ 전용 스크롤바나 드래그 장치를 새로 만들지 말 것(CLAUDE.md 「세로 스크롤바」 레지스트리).
  //   ⚠ 이 클래스가 빠지면 브라우저 기본 막대가 굵게 뜬다 — 그게 「오른쪽에 바가 보인다」의 원인이었다.
  box.classList.toggle('uiScroll', _shop);
  box.innerHTML = (_runeSec === 'shop') ? _runeShopHTML() : _runeSlotHTML();
  if(typeof paintIcons === 'function') paintIcons(box);
  _runeTopSync();
  if(typeof curPaintChip === 'function') curPaintChip();   // 🏷 좌상단 이름(장착 / 룬 상점)
  if(_runeSec !== 'shop') campRuneBindMap(); }

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
    + _runeBagHTML(); }
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
    onTap: el => campRunePick(el.dataset.rk, +el.dataset.ri),
    onEmpty: () => { if(_runePickKind) campRunePick('', -1); },
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
  if(!open){
    g.push('<polygon class="rnHx lk" points="' + _runeHexPts(x, y, r * 0.93) + '"/>');
    g.push('<text class="rnLkT" x="' + X + '" y="' + (y + 2.5).toFixed(1) + '">R' + at + '</text>');
    return g.join(''); }
  if(!key){
    g.push('<circle class="rnEmB" cx="' + X + '" cy="' + Y + '" r="' + (r * 0.8).toFixed(1) + '"/>');
    g.push('<polygon class="rnHx em" points="' + _runeHexPts(x, y, r * 0.93) + '"/>');
    g.push('<text class="rnPl" x="' + X + '" y="' + (y + 4.5).toFixed(1) + '">+</text>'); }
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
      const src = runeGlyphSrc(key, gp), w = r * 1.24;
      if(src) g.push('<image class="rnImg" href="' + src + '"'
        + ' x="' + (x - w / 2).toFixed(1) + '" y="' + (y - w / 2).toFixed(1) + '"'
        + ' width="' + w.toFixed(1) + '" height="' + w.toFixed(1) + '"/>'); }
    g.push('<text class="rnVl" x="' + X + '" y="' + (y + r + 3.5).toFixed(1) + '" style="fill:' + c + '">'
      + runeValTx(key) + '</text>'); }
  if(sel) g.push('<polygon class="rnHxSel" points="' + _runeHexPts(x, y, r + 6) + '"/>');
  // 👆 누르는 면 — 맨 위에 투명하게. ⚠ onclick 을 달지 않는다: 손가락을 붙잡는 순간
  //   click 의 target 이 <svg> 로 바뀌어 안 온다. 엔진이 pointerdown 에서 이 표시를 읽는다.
  g.push('<circle class="rnHit" cx="' + X + '" cy="' + Y + '" r="' + (r + 3)
    + '" data-rk="' + kind + '" data-ri="' + i + '"/>');
  return g.join(''); }

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
    g.push('<circle class="rnAu" cx="' + c[0] + '" cy="' + c[1] + '" r="'
      + Math.round((RUNE_RING + RUNE_R_N) * 1.55) + '" fill="url(#rnAu' + ci + ')"/>');
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
  // 🌌 성좌 구역의 오로라 — 갈래 색으로 넓고 흐리게(칸의 뒷광과 다른 층이다)
  //   ⚠ 세기는 **재서 정했다**(2026-09-04). 배경이 어두운 사진이라 .20 에서는 배경보다
   //     2~10 밝을 뿐이어서 전투·성장이 아예 안 보였다. .50 에서 R13/G19 만큼 갈린다.
  //     ⛔ 다시 낮추지 말 것 — 「은은하게」의 하한이 여기다.
  for(let i = 0; i < RUNE_GRPS.length; i++){ const c = (RUNE_GRP[RUNE_GRPS[i]] || {}).col || '#8b95a5';
    d += '<radialGradient id="rnAu' + i + '">'
      + '<stop offset="0" stop-color="' + c + '" stop-opacity=".50"/>'
      + '<stop offset=".55" stop-color="' + c + '" stop-opacity=".16"/>'
      + '<stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>'; }
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
  return '<button class="' + cls + '" type="button" style="--rg:' + c + '"'
    + (on ? ' onclick="campRuneBagTap(\'' + key + '\')"' : ' disabled')
    + ' aria-label="' + runeName(key) + ' ' + own + '개">' + s
    + '<span class="rnHbL"><span class="rnHbN">' + (on ? '<em>×</em>' + own : '–') + '</span>'
    + '<span class="rnHbP">' + _runePctTx(key) + '</span></span></button>'; }
// 줄 하나 — 룬 한 종류(등급 셋을 한 줄에)
function _runeBagRow(d, kindSel){
  const gds = (d.kind === 'uniq') ? ['uniq'] : RUNE_GRADES;
  const kind = (d.kind === 'uniq') ? 'uniq' : 'norm';
  const off = !!kindSel && kindSel !== kind;              // 고른 칸에 못 끼우는 줄은 물린다
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
  // 머리줄 — 고른 칸이 있으면 그 칸을 말하고, 차 있으면 빼는 길을 준다
  let hd;
  if(kindSel){
    const eq = campRuneEq(kindSel), cur = eq[_runePick] || null;
    const nm = (kindSel === 'uniq' ? '유니크' : '일반') + ' ' + (_runePick + 1) + '번 칸';
    hd = '<span class="rnBagT">' + nm + (cur ? ' · ' + runeName(cur) : ' · 비어 있음') + '</span>'
      + (cur ? '<button class="rnOff" type="button" onclick="campRuneUnequip(\'' + kindSel + '\','
          + _runePick + ')">빼기</button>' : ''); }
  else hd = '<span class="rnBagT">보유한 룬</span><span class="rnBagN">누르면 빈 칸에 끼웁니다</span>';
  let g = '';
  for(const grp of RUNE_GRPS.concat('uniq')){
    const q = RUNE_LIST.filter(d => (d.kind === 'uniq' ? 'uniq' : d.grp) === grp);
    if(!q.length) continue;
    const gi = RUNE_GRP[grp] || { nm:grp, col:'#8b95a5' };
    g += '<div class="rnGrpH" style="--gc:' + gi.col + '"><i></i><span>' + gi.nm + '</span><u></u></div>'
      + q.map(d => _runeBagRow(d, kindSel)).join(''); }
  if(!g) g = '<div class="rnEmp">가진 룬이 없습니다 — 룬 상점에서 삽니다</div>';
  return '<div class="rnBag">' + _runeBagDefs() + '<div class="rnBagH">' + hd + '</div>'
    + '<div class="rnBagG uiScroll">' + g + '</div></div>'; }

// 빈 칸 중 첫 칸에 끼운다 — 「고르지 않고 그냥 눌렀을 때」의 길
function campRuneAuto(key){
  const pp = runeParse(key); if(!pp.def) return false;
  const kind = (pp.def.kind === 'uniq') ? 'uniq' : 'norm';
  if(campRuneFree(key) <= 0) return false;
  const R = campRuneState(); if(!R) return false;
  const n = campRuneSlots(kind);
  for(let i = 0; i < n; i++) if(!R[kind][i]) return campRuneEquip(kind, i, key);
  return false; }
// 🎒 가방을 눌렀을 때 — 칸을 골라 뒀으면 **그 칸에**, 아니면 **빈 칸에**.
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
    if(!campRuneEquip(kind, _runePick, key)) say('남은 룬이 없습니다');
    return; }
  if(campRuneAuto(key)) return;
  say(campRuneFree(key) <= 0 ? '남은 룬이 없습니다' : '빈 칸이 없습니다 — 칸을 골라 바꿔 끼우세요'); }

// ── 룬 상점 ─────────────────────────────────────────────────────────────
function _runeShopHTML(){
  // 💠 재화는 **공용 아이콘**이다(resIco) — ⛔ 이모지를 직접 박지 말 것(CLAUDE.md 레지스트리).
  const gemI = (typeof resIco === 'function') ? resIco('gem') : '';
  let h = '<div class="rnHead"><span>보유 젬</span><b>' + gemI + ' '
    + ((typeof profGem === 'function') ? profGem() : 0) + '</b></div>';
  for(const kind of ['norm', 'uniq']){
    h += '<div class="rnSec"><div class="rnSecH"><span class="rnSecT">'
      + (kind === 'uniq' ? '유니크' : '일반') + '</span></div>';
    for(const d of RUNE_LIST){
      if((d.kind === 'uniq' ? 'uniq' : 'norm') !== kind) continue;
      const gds = (d.kind === 'uniq') ? ['uniq'] : RUNE_GRADES;
      let btns = '';
      for(const gd of gds){ const key = runeKey(d.id, gd), cost = runeGem(key);
        const can = ((typeof profGem === 'function') ? profGem() : 0) >= cost;
        btns += '<button class="rnBuy" type="button"' + (can ? '' : ' disabled')
          + ' style="--rg:' + ((RUNE_GD[gd] || {}).col || '#8b95a5') + '"'
          + ' onclick="campRuneBuy(\'' + d.id + '\',\'' + gd + '\')">'
          + runeIcoHTML(key, 'rnBuyI')
          + '<b>' + (RUNE_GD[gd] || {}).tx + '</b><span>' + runeValTx(key) + '</span>'
          + '<u>' + gemI + ' ' + cost + '</u></button>'; }
      const ownN = gds.reduce((a, gd) => a + campRuneOwn(runeKey(d.id, gd)), 0);
      h += '<div class="rnItem"><div class="rnIH">'
        + runeIcoHTML(runeKey(d.id, (d.kind === 'uniq') ? 'uniq' : 'mid'), 'rnIi')
        + '<span class="rnIN">' + d.nm + '</span><span class="rnID">' + d.de + '</span>'
        + '<span class="rnIO">' + ownN + '</span></div>'
        + '<div class="rnBuys">' + btns + '</div></div>'; }
    h += '</div>'; }
  return h; }
