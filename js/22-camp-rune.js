// ══════════════════════════════════════════════════════════════════════════
// 💠 룬 — 젬으로 사서 슬롯에 끼우는 성장 축 (2026-09-02 사용자 확정)
// ══════════════════════════════════════════════════════════════════════════
// ⭐ **왜 따로 두는가** — 연구·환생 트리는 「사면 계속 쌓인다」인데, 룬은 **골라 끼운다**.
//   칸이 한정이라 하나를 넣으면 하나를 빼야 한다. 그래서 성장이 아니라 **선택**이 축이다.
//
// ⚠ **GEM.md §6 「젬으로 영구 능력을 팔지 않는다」를 뒤집는 결정이다**(사용자 확정 2026-09-02).
//   뒤집어도 되는 근거 둘:
//     ① **칸이 통산 최고 레벨로 열린다**(2026-09-11) — 돈으로 칸을 앞당길 수 없다. 진행이 문이다.
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
// 🎚 **유니크는 등급이다**(2026-09-05 사용자 확정) — 룬 **종류**가 아니다.
//   ⛔ `kind:'uniq'` 로 되돌리지 말 것. 그때는 유니크가 「다른 룬에 없는 능력」 넷이었는데,
//     지금은 **모든 룬의 네 번째 등급**이다 — 같은 효과를 훨씬 세게 준다.
//   ⭐ **어느 칸에 들어가느냐를 정하는 것도 등급이다**: 유니크 등급 → 유니크 칸(성좌 중심 3).
//     갈래는 그대로다 — 경제 성좌의 중심에는 **경제 룬의 유니크 등급**만 들어간다.
const RUNE_GRADES = ['low', 'mid', 'high', 'uniq'];
const RUNE_GD = {
  low:  { tx:'하급', col:'#8b95a5' },
  mid:  { tx:'중급', col:'#5cd6ff' },
  high: { tx:'상급', col:'#ffcf6b' },
  uniq: { tx:'유니크', col:'#c98bff' } };

// ── 룬 표 ───────────────────────────────────────────────────────────────
// ⚠ **여기 값은 전부 임시다.** 등급별 수치·젬 값은 사용자가 정한다(스킬 때와 같은 방식).
//   확정되면 이 표가 단일 소스가 되고, 문서는 `GEM.md` §8 이 받는다.
// eff — 효과 키. `campRuneEff(eff)` 가 이 키로 합을 낸다.
// ── 룬 표 (2026-09-02 값 확정) ──────────────────────────────────────────
// ⭐ **종류가 칸보다 많아야 「고르는 것」이 된다.** 일반 10종 / 5칸 · 유니크 4종 / 3칸.
//   ⛔ 종류 = 칸 이면 전부 끼워지므로 고를 것이 없어진다 — 그러면 이 시스템은 그냥 「연구 2」다.
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
  // ⚠ 'uniq' 는 **갈래가 아니라 등급**이다(2026-09-05). 여기 남겨 둔 것은 옛 저장·이름표가
  //   찾을 때를 위한 것뿐이고, 칸·탭·성좌는 RUNE_GRPS(셋)만 본다.
  uniq: { nm:'유니크', col:'#ffe08a' } };
// 🎚 룬 하나가 들어갈 **칸 무리** — 등급이 정한다. ⛔ 룬 종류로 가르지 말 것.
function runeBucket(key){ return (runeParse(key).gd === 'uniq') ? 'uniq' : 'norm'; }
// 🗺 칸의 갈래 — 일반 칸은 제 성좌의 갈래이고, 💠 **유니크 칸은 갈래가 없다**
//   (2026-09-12 사용자 확정: 「각 유니크 칸에는 그 구역 상관없이 다 낄 수 있게」).
//   ⚠ 옛 규칙은 「유니크 칸도 제 성좌의 갈래」였는데, 그러면 전투 유니크 룬은 Lv.30 · 성장은 Lv.50
//     까지 낄 데가 없었다 — 종류(4)가 칸(3)보다 많은 자리라 갈래까지 묶으면 고를 것이 사라진다.
//   'uniq' 는 갈래가 아니라 **등급 이름**이고 여기서는 「갈래 없음 · 색은 유니크 색」이라는 뜻이다.
//   ⛔ 이 값을 RUNE_GRPS 와 견주는 코드를 새로 쓰지 말 것 — 갈래 판정은 `runeSlotTakesGrp` 하나다.
function runeCellGrp(kind, i){
  return (kind === 'uniq') ? 'uniq' : runeSlotGrp(i); }
// 일반 i번 칸이 속한 갈래 — 성좌 하나가 통째로 한 갈래다
function runeSlotGrp(i){ return RUNE_GRPS[Math.floor(i / RUNE_CONS)] || RUNE_GRPS[0]; }
// 🔑 **이 칸이 그 갈래의 룬을 받나 — 판정은 여기 하나뿐이다.**
//   일반 칸만 갈래를 탄다. ⛔ 장착·교체·가방이 저마다 다시 비교하지 말 것(둘이 어긋나 있었다:
//   장착은 유니크를 통과시키는데 교체 후보는 막아서, 칸이 다 차면 바꿀 수가 없었다 · 2026-09-12).
function runeSlotTakesGrp(kind, i, grp){
  if(kind !== 'norm') return true;
  return !grp || grp === runeSlotGrp(i); }

const RUNE_LIST = [
  // ── 갈래마다 7종을 목표로 한다(칸은 8이라 하나는 두 번 끼우게 된다 — 그게 마지막 선택이다).
  //   ⚠ **유니크는 여기 없다.** 등급이지 종류가 아니다(위 RUNE_GRADES 설명).
  // ⚠ 지운 룬들 — ⛔ 되살리려면 왜 지웠는지부터 볼 것:
  //   「재화의 룬」(gain · 2026-09-03) 손끝의 룬을 품고 있어 값이 같으면 손끝을 살 이유가 없었다.
  //   「증원의 룬」(pop · 2026-09-04) 환생 구역에서 200 을 그냥 찍을 수 있어 1~5% 가 무의미했다.
  //   「윤회의 룬」(rebPts · 2026-09-05) **환생할 때만 끼는 시스템이 별로**라는 판단(사용자).
  //   「성장의 룬」(exp · 2026-09-05) 적 처치 보상과 **겹친다**(사용자).
  //   건설·생산·연구 **속도** 룬 — 캠프에서 그 시간이 병목이 아니다.

  // 💠 경제 7 — 캠프에서 버는 것
  { id:'tap',   nm:'손끝의 룬',   grp:'eco',  eff:'tap',      ico:'coin',
    de:'탭 획득량' },
  { id:'gas',   nm:'정제의 룬',   grp:'eco',  eff:'gas',      ico:'box',
    de:'가스 획득' },
  // ⚠ 손끝(손으로 누를 때)과 **다른 자리**다 — 이쪽은 일꾼이 왕복해서 캐는 양이다.
  { id:'mine',  nm:'채굴의 룬',   grp:'eco',  eff:'mine',     ico:'upg',
    de:'일꾼 채취량' },
  // ⭐ 이동속도 룬은 **일꾼 하나뿐**이다. 「유닛 이동속도」는 뺀 축이다 — 되살리지 말 것.
  //   📐 값이 기본표의 **0.55배**다 — 일꾼이 빨라지면 왕복이 늘고, 그 왕복이 채취 배수를
  //     타므로 표시값의 **1.8배**로 증폭된다(실측 BALANCE §3-2-9 · 두 씨앗 다 +17% → +30%).
  { id:'wspd',  nm:'신속의 룬',   grp:'eco',  eff:'wspd',     ico:'boost',
    v:{ low:0.003, mid:0.006, high:0.009, uniq:0.03 }, de:'일꾼 이동속도' },
  // ✨ 치명 — 확률 둘(터치·채굴)과 배수 하나. ⛔ 채굴용 배수를 따로 만들지 말 것.
  //   📐 값이 기본표의 **10배**다. ⛔ 놀라서 낮추지 말 것 — **확률에 비율을 곱하기 때문**이다.
  //     기본 확률 10% 에 +15% 를 해 봐야 11.5% 이고, 기대 배수는 1.100 → 1.115(**+1.4%**)뿐이다.
  //     다 채워도(+170%) 확률 27% · 실제 수입 **+15%** 로, 다른 룬과 같은 자리에 온다.
  { id:'crit',  nm:'예리의 룬',   grp:'eco',  eff:'critPct',  ico:'upg',
    v:{ low:0.05, mid:0.10, high:0.15, uniq:0.50 }, de:'치명 터치 확률' },
  //   📐 값이 기본표의 **5.5배** — 예리와 같은 이유(배수에 비율을 곱한다).
  //     다 채우면(+94%) 배수 2 → 3.9 이고 기대 배수는 1.10 → 1.29(**+17%**)다.
  { id:'critm', nm:'일격의 룬',   grp:'eco',  eff:'critMul',  ico:'coin',
    v:{ low:0.025, mid:0.05, high:0.08, uniq:0.30 }, de:'치명 배수(터치·채굴)' },
  //   📐 예리와 같은 이유로 크지만 한 단 낮다 — **일꾼 경로에만** 걸리기 때문이다.
  //     ⚠ 그래서 **후반 룬**이다: 초반엔 일꾼이 수입의 5% 뿐이라 거의 안 느껴지고,
  //       일꾼이 40기까지 늘면 채취 경로가 수입의 70% 대가 되어 그때 값을 한다.
  { id:'gcrit', nm:'노다지의 룬', grp:'eco',  eff:'gcritPct', ico:'coin',
    v:{ low:0.04, mid:0.08, high:0.12, uniq:0.40 }, de:'일꾼 채굴 치명 확률' },

  // ⚔ 전투 7 — 던전에서 싸우는 것
  //   ⚠ 「공격 회피율」은 사용자가 뺐다(2026-09-05).
  { id:'atk',   nm:'힘의 룬',     grp:'war',  eff:'atk',      ico:'upg',
    de:'유닛 공격력' },
  { id:'aspd',  nm:'연타의 룬',   grp:'war',  eff:'aspd',     ico:'upg',
    de:'유닛 공격속도' },
  { id:'hp',    nm:'수호의 룬',   grp:'war',  eff:'hp',       ico:'armor',
    de:'유닛 체력' },
  // 🛡 **방어막** — 최대 체력의 n% 만큼 실드를 얹는다(2026-09-08 사용자 확정).
  //   ⭐ 수호(체력)와 같은 축처럼 보이지만 **다르다**: 실드로 막는 피해는 `strikeHit` 에서
  //     **상성을 무시**하고 실드 전용 방어(`shArmor`)를 쓴다 — 상성상 불리한 적에게 더 값을 한다.
  //     체력바 위 파란 칸으로 **눈에도 보인다**(18-strike.js 의 유닛 바).
  //   ⛔ 「피해 감소 %」로 만들지 말 것 — 그건 실효 체력이라 수호와 **글자만 다른 룬**이 된다.
  //   ⚠ 이미 실드를 가진 유닛에는 **더한다**(덮어쓰지 않는다).
  //   ⚠ 실드는 **저절로 차지 않는다**(스킬만 채운다). 라운드마다 전원 부활·회복이라 그때 함께 찬다.
  { id:'shld',  nm:'방벽의 룬',   grp:'war',  eff:'shield',
    de:'유닛 방어막' },
  { id:'heal',  nm:'치유의 룬',   grp:'war',  eff:'heal',     ico:'hero',
    de:'회복량' },
  // 🎯 ⚠ campScaleAllies 의 옛 주석은 「사거리는 건드리지 않는다(종족 상성이 바뀐다)」였다.
  //   그 경고는 **인식 거리를 넓히던 맥락**의 것이고, 여기는 1.5~5% 라 상성이 뒤집힐 폭이 아니다.
  //   ⛔ 그래도 두 자릿수로 올리지 말 것 — 그때는 옛 경고가 그대로 살아난다.
  { id:'rng',   nm:'조준의 룬',   grp:'war',  eff:'rng',      ico:'flag',
    de:'유닛 사거리' },
  // 📉 **감소형**이다 — 뚜껑은 RUNE_CUT_CAP(50%).
  { id:'skcd',  nm:'각성의 룬',   grp:'war',  eff:'skCd',     ico:'boost',
    de:'스킬 쿨타임 감소' },

  // 🌱 성장 7 — 캠프 바깥까지 닿는 것
  // ⚠ **아직 닿는 데가 없다**(2026-09-04 실측: 부르는 곳 0곳). 적 처치 보상이라는 자리를
  //   먼저 잡아 둔 것이다 — 배선하면 soon 을 지운다.
  { id:'kill',  nm:'전과의 룬',   grp:'grow', eff:'killGain', ico:'upg',
    de:'적 처치 보상', soon:true },
  // ⛔ 젬에는 안 건다 — 젬은 현질 재화다(GEM.md).
  { id:'mapg',  nm:'전리품의 룬', grp:'grow', eff:'mapGain',  ico:'map',
    de:'유즈맵 보상 재화' },
  // ⚡ 피버 **획득량**(배수). 열기(확률)와 다른 자리다.
  //   📐 일격과 **같은 짜임**이다(배수에 비율) — 같은 자로 키운다.
  { id:'fevg',  nm:'열정의 룬',   grp:'grow', eff:'fevGain',  ico:'boost',
    v:{ low:0.025, mid:0.05, high:0.08, uniq:0.30 }, de:'피버 획득량' },
  // ⚠ **가속은 유별나게 세다.** 실측(BALANCE §3-2-7): +10% 가 45분 누적 수입을 +60% 로
  //   만들었다(누적 증폭 4.9제곱 — 결제 팩 1.63제곱보다 3배 가파르다). 다른 룬은 축 하나를
  //   키우지만 이것은 **시간 자체**라 모든 축에 곱해진다. ⛔ 값을 올릴 때 이 사실을 먼저 볼 것.
  //   📐 값이 기본표의 **0.2배**다. ⛔ 다른 룬과 같은 표로 되돌리지 말 것 —
  //     **시간 자체**라 모든 축에 곱해져 표시값이 누적 **4.9제곱**으로 증폭된다
  //     (실측 §3-2-7: +10% 가 45분 누적 +60%). 기본표(+17%)로 두면 실제 **+116%** 가 된다.
  //     지금 값이면 다 채워도 +3.4% → 누적 **+18%** 로 다른 룬과 같은 자리다.
  { id:'speed', nm:'가속의 룬',   grp:'grow', eff:'speed',    ico:'boost',
    v:{ low:0.001, mid:0.002, high:0.003, uniq:0.01 }, de:'캠프 전체 진행 속도' },
  // ⚡ **확률**을 올린다(지속·배수가 아니다). ⚠ 환생 트리에서 피버를 안 열었으면 아무 일도 안 한다.
  //   📐 예리와 **같은 짜임**이다(확률에 비율) — 같은 자로 키운다.
  { id:'fever', nm:'열기의 룬',   grp:'grow', eff:'fever',    ico:'new',
    v:{ low:0.05, mid:0.10, high:0.15, uniq:0.50 }, de:'피버 발동 확률' },
  // 📉 **감소형 둘** — 미네랄과 가스를 갈랐다(2026-09-05 사용자 확정). 뚜껑은 RUNE_CUT_CAP.
  //   ⚠ 캠프에서 미네랄로 사는 것과 가스로 사는 것이 다른 화면이라, 한 룬으로 묶으면
  //     「무엇이 싸지는가」가 안 읽힌다.
  { id:'costm', nm:'절약의 룬',   grp:'grow', eff:'costMin',  ico:'gift',
    de:'미네랄 구매 비용 감소' },
  { id:'costg', nm:'검약의 룬',   grp:'grow', eff:'costGas',  ico:'gift',
    de:'가스 구매 비용 감소' } ];
// 💰📉 **감소형의 뚜껑 — 50%**(2026-09-05 사용자 확정).
//   ⛔ 감소형은 합산이라 100% 를 넘으면 부호가 뒤집힌다(공짜를 지나 돈을 받는다).
//     지금 값으로는 24칸을 다 몰아도 36% 라 안 닿지만, **뚜껑은 값과 무관하게 있어야 한다** —
//     값을 손보는 사람이 이 사실을 매번 다시 발견하게 두면 안 된다.
//   해당하는 룬 셋: 미네랄 비용 · 가스 비용 · 스킬 쿨타임.
// 📐 **그 룬을 다 채웠을 때의 합** — 성좌 8칸(상급) + 중심 유니크. 곧 그 룬의 상한이다.
//   ⭐ 이 수가 룬마다 **다른 것이 정상**이다. 값을 맞춘 기준은 「표시값」이 아니라
//     **「실제 수입·전투력에 닿는 폭」**이고, 룬마다 전달률이 다르기 때문이다(GEM.md §8-8).
function runeFullSum(id){ const d = runeDef(id); if(!d) return 0;
  return runeVal(runeKey(id, 'high')) * RUNE_CONS + runeVal(runeKey(id, 'uniq')); }
const RUNE_CUT_CAP = 0.50;
const RUNE_CUT_EFF = { costMin:1, costGas:1, skCd:1 };

// ── 📏 **효과 값 — 등급이 정한다** (2026-09-02 사용자 확정: 「전부 1~5% 로」) ──
// ⭐ **룬은 게임을 심하게 바꾸면 안 된다.** 앞 값(상급 15~35%)은 다 갖추면 수입 ×1.47 ·
//   라운드 +6 이었다(BALANCE §3-2-7). 그 폭이 「조금 도와주는 것」의 선을 넘었다.
// ⭐ **룬마다 값을 다르게 두지 않는다.** 1~5% 안에서 룬끼리 1%p 를 다투게 만들어 봐야
//   실측 흔들림(판마다 ±40%)에 묻힌다 — 고르는 이유는 **세기가 아니라 무슨 축이냐**여야 한다.
// ⛔ 이 값을 두 자릿수로 되돌리지 말 것. 그러면 룬이 「연구 2」가 된다.
// ⚠ 값이 낮아진 것은 **칸이 5 → 24 로 늘었기 때문**이다(2026-09-05 사용자 확정).
//   상급만 24칸을 채워도 축 하나에 +36% 라, 옛 값(1/2.5/5%)이면 +120% 였다.
const RUNE_VAL = { low:0.005, mid:0.01, high:0.015, uniq:0.05 };

// ── 💎 값 — **등급이 정한다. 룬마다 따로 두지 않는다** ────────────────────
// ⭐ **등급이 오를수록 %당 값이 비싸다**(10 → 13 → 20 젬/%). 손해처럼 보이지만 맞다 —
//   여기서 진짜 귀한 것은 %가 아니라 **칸**이다. 상급은 같은 효과를 **한 칸으로** 낸다.
//   ⛔ 「상급이 %당 싸게」 뒤집지 말 것. 그러면 하급을 살 이유가 사라져 등급이 셋일 뜻이 없어진다.
// 관례 대조(GEM.md §5-4-4): 젬당 16~22원 → 상급 400젬 ≈ ₩7,000 · 유니크 1,200젬 ≈ ₩20,000.
// ⚠ **효과 값이 4배 낮아졌는데 젬 값은 그대로다**(2026-09-02). 상급 400젬(≈₩7,000)에
//   +5% 라 %당 값이 8,000원꼴이다 — 앞 표(+20% · 2,000원꼴)보다 네 배 비싸다.
//   ⛔ 함부로 내리지 말 것 — **가격은 사용자 결정**이다. 다만 값을 정할 때 이 사실을 볼 것.
const RUNE_GEM = { low:40, mid:130, high:400, uniq:1200 };

// ── 슬롯 해금 — **통산 최고 레벨**이 연다 ────────────────────────────────
// ⭐ 「최고」다. 환생으로 되감겨도 **한 번이라도 닿았으면 남는다**(사용자 확정 2026-09-02).
//   그래서 기준은 `C.lvBest`(되감기지 않는 값)이지 지금 레벨(`C.lv`)이 아니다.
// 🏆 **칸을 여는 자 = 통산 최고 레벨**(2026-09-11 · `campBestLevel`).
//   ⚠ 옛 규칙은 「일반 첫 칸은 처음부터 열려 있다」였다 — 2026-09-12 에 **Lv.5 로 옮겼다**(사용자).
//     그 전까지는 스물일곱 칸이 전부 잠겨 보이지만, 칸마다 **여는 레벨이 적혀 있어** 빈 화면이 아니다.
//   ⭐ **성좌 셋**(2026-09-03 사용자 확정 · 목업 docs/mock/camp-rune-8.html ②안).
//     일반 24칸이 8칸씩 세 무리로 갈린다. 무리 하나 = 갈래 하나이고, **칸은 제 갈래의 룬만 받는다.**
//     ⚠ 옛 규칙 「한 무리를 다 열면 그 한가운데 유니크가 열린다」는 **2026-09-12 에 버렸다** —
//       무리를 통째로 먼저 열면 세 번째 갈래가 Lv.31 까지 잠겼기 때문이다(아래 여는 레벨 절).
//
// 🔁 **왜 라운드도 관문도 아니고 레벨인가**(2026-09-11 · 전면 개편):
//   ① 라운드는 없어졌다(던전 = 적 기지 치기) · ② 통산 관문은 **던전 셋 = 18 이 끝**이라
//     한 바퀴만 돌면 27칸이 전부 열려 버린다 — 룬은 긴 축인데 자가 짧았다.
//   ③ 레벨은 환생할수록(배수가 붙을수록) 더 높이 오르므로 **회차를 거듭할수록 열린다**.
//   ⚠ 그런데 레벨 자체는 **회차마다 1 로 되감긴다**. 💠 룬은 젬으로 산 물건이라
//     한 번 열린 칸이 닫히면 결제가 사라지는 것이다 → 자는 **통산 최고 레벨**(`C.lvBest`)이다.
//     ⛔ `campLevel()`(지금 레벨)으로 열지 말 것.
//
const RUNE_CONS = 8;             // 성좌 하나에 든 일반 칸 수 (24 = 8 × 3)
// 🎚 **여는 레벨 — 5 에서 시작해 50 에서 끝난다**(2026-09-12 사용자 확정:
//   「5레벨부터 하나씩 · 유니크는 15·30·50 · 50레벨이면 전부 열림」).
//
// 🔁 **갈래를 번갈아 연다**(2026-09-12 사용자 지적: 「성좌 1,2,3 으로 가면 내가 원하는 구역이
//   너무 늦게까지 안 열린다」). ⛔ **성좌 하나를 통째로 먼저 열지 말 것** — 칸은 **제 성좌의 갈래만**
//   받으므로(`runeCellGrp`), 성좌 순서대로 열면 **세 번째 갈래의 룬은 Lv.31 까지 낄 데가 없다.**
//   젬으로 산 룬이 스무 레벨 넘게 가방에 묶여 있는 셈이라 거짓 판매에 가깝다.
//   ⭐ 지금은 **경제 → 전투 → 성장 → 경제 …** 순으로 한 칸씩 돌아가며 열린다 — **Lv.8 이면 세 갈래가 다 열린다.**
//
// ⚠ **그래서 옛 규칙 「성좌를 다 열면 그 한가운데가 열린다」는 버렸다.** 돌아가며 열면 성좌 셋이
//   거의 같이 차므로 그 규칙으로는 유니크 셋이 Lv.44~49 에 몰린다. 유니크는 **15·30·50 으로 고정**이고
//   갈래 순서(경제·전투·성장)는 그대로라 「성좌가 셋이라 중심도 셋」은 여전히 그림으로 읽힌다.
//   ⛔ 「완성하면 중심」으로 되돌리지 말 것 — 되돌리면 위의 「세 번째 갈래가 잠긴다」가 같이 돌아온다.
//
//   ⭐ 숫자를 손으로 스물일곱 개 찍지 않는다 — **시기 셋의 「첫 칸 ~ 마지막 칸」**과 유니크 셋만 적는다.
//     ⛔ 생성된 배열을 리터럴로 되돌리지 말 것 — 폭을 바꾸려면 아래 두 줄만 고치면 된다.
//   📈 간격이 **저절로 벌어진다**: 초반 1~2레벨 · 중반 2레벨 · 후반 2~3레벨.
//     레벨 요구량이 등비(×1.55)라 뒤로 갈수록 한 칸이 훨씬 무거워진다.
//   ⚠ **Lv.5 이전에는 한 칸도 안 열린다**(옛 표는 첫 칸이 Lv.1 이었다). 사용자 확정 사항이고,
//     Lv.5 는 첫 던전에서 관문 셋을 깨면 닿는다(실측 73초) — 잠긴 칸에는 여는 레벨이 적혀 있다.
const RUNE_LV_UNIQ = [15, 30, 50];                     // 성좌 셋의 한가운데 — 경제 · 전투 · 성장 순
// ⚠ 이 셋은 **시기**(초·중·후반)다 — **성좌가 아니다.** 여덟 칸씩 세 묶음으로 레벨만 낸다.
const RUNE_LV_PHASE = [[5, 14], [16, 29], [31, 49]];
const RUNE_SLOT_LV = (function(){
  // ① 열리는 **순서대로의** 레벨 24개
  const seq = [];
  for(const ph of RUNE_LV_PHASE)
    for(let j = 0; j < RUNE_CONS; j++)
      seq.push(Math.round(ph[0] + (ph[1] - ph[0]) * j / (RUNE_CONS - 1)));
  // ② 🔁 갈래를 **번갈아** 나눠 준다 — k번째로 열리는 칸은 성좌 (k % 성좌수) 의 것이다.
  const nc = RUNE_GRPS.length, norm = new Array(seq.length);
  for(let k = 0; k < seq.length; k++){
    const c = k % nc, j = (k - c) / nc;                // 성좌 c 의 j번째 칸
    norm[c * RUNE_CONS + j] = seq[k]; }
  return { norm: norm, uniq: RUNE_LV_UNIQ.slice() }; })();

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

// 🏆 통산 최고 레벨 — 되감기지 않는 값이다(js/19-camp.js `campBestLevel`).
//   ⚠ 캠프가 없으면 1(첫 칸만 열린다).
function campRuneBestLv(){
  return (typeof campBestLevel === 'function') ? campBestLevel() : 1; }
// 열린 칸 수 — 표에서 「그 레벨 이하」인 것을 센다.
//   ⭐ **레벨을 인자로 받는 쪽이 단일 소스**다(2026-09-12) — 레벨업 알림이 「이번에 몇 칸이 열렸나」를
//     재려면 지금 레벨이 아니라 **오르기 전 레벨**로도 물어봐야 한다.
function campRuneSlotsAt(kind, lv){ const tb = RUNE_SLOT_LV[kind] || [];
  if(CAMP_RUNE_FREE || CAMP_RUNE_DEV_SEED) return tb.length;   // 🔧 전부 열어 둔다(확인용 스위치 둘)
  let n = 0; for(const r of tb) if(lv >= r) n++; return n; }
function campRuneSlots(kind){ return campRuneSlotsAt(kind, campRuneBestLv()); }

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
  if(CAMP_RUNE_DEV_SEED && R.seed !== CAMP_RUNE_DEV_TAG) _campRuneDevSeed(R);
  return R; }
// 🔧 확인용 상태를 **저장에 심는다**(위 CAMP_RUNE_DEV_SEED 설명).
//   ⚠ 이미 갖고 있는 것은 건드리지 않는다 — 모자란 것만 채운다.
function _campRuneDevSeed(R){
  R.seed = CAMP_RUNE_DEV_TAG;
  for(const d of RUNE_LIST) for(const gd of RUNE_GRADES){
    const k = runeKey(d.id, gd);
    if((R.own[k] | 0) < CAMP_RUNE_DEV_OWN) R.own[k] = CAMP_RUNE_DEV_OWN; }
  const P = (typeof PROF === 'function') ? PROF() : null;
  if(P && (P.gem | 0) < CAMP_RUNE_DEV_GEM) P.gem = CAMP_RUNE_DEV_GEM;
  if(typeof saveMeta === 'function') saveMeta(); }

// ── 룬 키 — 일반은 `id:등급`, 유니크는 `id` ───────────────────────────────
function runeDef(id){ for(const d of RUNE_LIST) if(d.id === id) return d; return null; }
function runeKey(id, gd){ const d = runeDef(id); if(!d) return '';
  return d.id + ':' + gd; }
function runeParse(key){ const s = String(key || '').split(':');
  const d = runeDef(s[0]); if(!d) return { def:null, gd:'' };
  return { def:d, gd:(s[1] || '') }; }
// 📏 효과 값도 **등급 표**가 정한다(RUNE_VAL). 룬이 제 값을 갖고 싶으면 def.v 로 덮는다.
//   ⛔ 룬마다 값을 흩뿌리지 말 것 — 젬 값(runeGem)과 같은 원칙이다.
function runeVal(key){ const p = runeParse(key); if(!p.def) return 0;
  if(p.def.v && p.def.v[p.gd] != null) return p.def.v[p.gd];
  return RUNE_VAL[p.gd] || 0; }
// 💎 값은 **등급 표**가 정한다(RUNE_GEM). 룬이 제 값을 갖고 싶으면 def.gem 으로 덮는다.
//   ⛔ 룬마다 값을 흩뿌리지 말 것 — 값을 손볼 때 한 곳만 고치면 되게 둔다.
function runeGem(key){ const p = runeParse(key); if(!p.def) return 0;
  if(p.def.gem && p.def.gem[p.gd]) return p.def.gem[p.gd];
  return RUNE_GEM[p.gd] || 0; }

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
  return RUNE_GD[p.gd] ? (RUNE_GD[p.gd].tx + ' ' + p.def.nm) : p.def.nm; }
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
let CAMP_RUNE_FREE = false;             // ⚠ let 이다 — 스모크가 끄고 정상 규칙을 잰다
const CAMP_RUNE_FREE_N = 9;              // 켰을 때 종류마다 갖고 있다고 치는 개수
// 🔧 **구매를 눈으로 확인하려고 심어 두는 상태** (2026-09-08 사용자 요청).
//   ⭐ CAMP_RUNE_FREE 와 **다르다**: 저것은 「갖고 있다고 친다」라 개수가 늘 9라서
//     상한(8)에 걸려 **상점에서 아무것도 못 산다**. 이것은 저장에 **진짜로 넣어** 두므로
//     사면 개수가 실제로 오르고 젬도 실제로 빠진다 — 그게 지금 확인하려는 것이다.
//   ⚠ 한 번만 심는다(R.seed 표시). 사서 줄어든 것을 도로 채우지 않는다 —
//     채우면 「젬이 빠지는지」를 못 본다.
//   ⛔ 내보내기 전에 false 로 되돌릴 것. 스모크는 세 곳에서 이 값을 끄고 정상 규칙을 잰다.
let CAMP_RUNE_DEV_SEED = true;
const CAMP_RUNE_DEV_OWN = 3;             // 종류·등급마다 이만큼 갖고 시작한다
const CAMP_RUNE_DEV_GEM = 9999999;       // 다 사고도 남는 양(전부 사면 약 30만)
const CAMP_RUNE_DEV_TAG = 'dev3';        // 이 표시가 있으면 이미 심었다
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
  campRuneRender();
  campRuneBuyFx(id, gd);            // ✨ 산 칸이 부풀고 고리가 퍼진다(연출은 그린 뒤에)
                                    // ⚠ 여기 `p` 는 **프로필**(PROF())이다 — runeParse 결과가 아니다(한 번 헷갈렸다)
  return true; }
// ✨ **구매 연출** — 장착(campRuneEquipFly)과 **같은 어휘**다: 부풀기(.rnPop) + 등급 색 고리(.rnFxRing).
//   ⛔ 새 어휘를 만들지 말 것 — 룬 화면의 「됐다」는 이미 이 둘이다.
//   ⚠ campRuneRender 뒤에 부른다 — 다시 그리면 방금 누른 칸의 DOM 이 새것으로 바뀐다.
function campRuneBuyFx(id, gd){
  const box=document.getElementById('rnBody'); if(!box) return;
  const el=[...box.querySelectorAll('.rnBuy')].find(b=>{
    const o=b.getAttribute('onclick')||''; return o.indexOf("'"+id+"'")>=0 && o.indexOf("'"+gd+"'")>=0; });
  if(!el) return;
  el.classList.remove('rnPop'); void el.offsetWidth; el.classList.add('rnPop');
  setTimeout(()=>el.classList.remove('rnPop'), 460);
  const r=document.createElement('i'); r.className='rnFxRing';
  r.style.setProperty('--rg', (RUNE_GD[gd]||{}).col || '#8b95a5');
  el.appendChild(r); setTimeout(()=>r.remove(), 520); }
// ❓ **살 때는 물어본다**(2026-09-12 사용자 요청) — 젬은 현질 재화라 잘못 누르면 되돌릴 수 없다.
//   ⛔ 확인창을 새로 만들지 말 것 — 공용 uiAsk(.ecCard)를 쓴다(CLAUDE.md 「확인 팝업」).
//   ⚠ 실제 구매는 campRuneBuy 하나다 — 확인은 그 앞의 문일 뿐이다(스모크는 campRuneBuy 를 직접 부른다).
//   ⚠ 못 사는 경우(상한·젬 부족)는 **묻기 전에** 알린다 — 확인창을 띄웠다가 실패하면 두 번 속는다.
function campRuneBuyAsk(id, gd){
  const key=runeKey(id, gd), p=runeParse(key); if(!p.def) return;
  if(campRuneOwn(key) >= RUNE_OWN_MAX){
    if(typeof toast==='function') toast('이 룬은 ' + RUNE_OWN_MAX + '개까지만 가질 수 있습니다'); return; }
  const cost=runeNowGem(key), gemI=(typeof resIco==='function') ? resIco('gem') : '';
  const have=(typeof profGem==='function') ? profGem() : 0;
  if(have < cost){ if(typeof toast==='function') toast('💎 젬이 부족합니다'); return; }
  if(typeof uiAsk!=='function'){ campRuneBuy(id, gd); return; }
  uiAsk({ title:runeName(key),
    msg:'<b>' + runeValTx(key) + '</b> · ' + (p.def.de||'') + '<br>' + gemI + ' <b>' + cost + '</b> 을(를) 씁니다',
    go:'구매', onGo:()=>campRuneBuy(id, gd) }); }

// ── 장착 ────────────────────────────────────────────────────────────────
// 규칙 셋. ⛔ 하나라도 빼면 「칸이 한정」이라는 전제가 무너진다(맨 위 주석).
//   ① 갈래가 맞아야 한다 — 유니크 룬은 유니크 칸에만
//   ② 열린 칸이어야 한다
//   ③ 보유한 만큼만 — 같은 룬을 두 칸에 끼우려면 두 개 있어야 한다
function campRuneCanEquip(kind, i, key){
  const R = campRuneState(); if(!R) return false;
  const p = runeParse(key); if(!p.def) return false;
  if(runeBucket(key) !== kind) return false;              // 🎚 칸 무리는 **등급**이 정한다
  if(i < 0 || i >= campRuneSlots(kind)) return false;
  // 🗺 **성좌마다 들어갈 갈래가 정해져 있다**(2026-09-04 사용자 확정 · RUNE_GRPS 설명).
  //   ⛔ 이 줄을 빼지 말 것 — 한 성좌 안에서 색이 섞이면 무엇을 모은 판인지 안 읽힌다.
  //   💠 다만 **유니크 칸은 갈래를 안 가린다**(2026-09-12) — 판정은 `runeSlotTakesGrp` 하나다.
  if(!runeSlotTakesGrp(kind, i, p.def.grp)) return false;
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
  if(RUNE_CUT_EFF[eff]) return Math.min(v, RUNE_CUT_CAP);   // 📉 감소형 셋의 뚜껑
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
  // 📜 상점도 같다 — 줄을 펼치거나 등급을 고를 때마다 다시 그리므로 #rnBody 의 자리를 지킨다
  const _shopKeep = (_runeSec === 'shop') ? box.scrollTop : 0;
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
  if(_shopKeep) box.scrollTop = _shopKeep;
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
      grp:d.grp,
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
//   칸마다 「Lv.26」으로 열리는 레벨이 적혀 있어서 같은 말을 두 곳에서 하고 있었다.
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
  for(let i = 0; i < RUNE_SLOT_LV.norm.length; i++){ const c = campRuneNPos(i); q.push({ x:c[0], y:c[1] }); }
  for(let i = 0; i < RUNE_SLOT_LV.uniq.length; i++){ const c = campRuneUPos(i); q.push({ x:c[0], y:c[1] }); }
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
// 🗺 그 칸이 속한 **성좌 번호** — 일반은 여덟 칸이 한 성좌, 유니크는 칸 하나가 한 성좌다.
//   ⛔ 이 셈을 여러 곳에 적지 말 것(칸 → 성좌를 묻는 자리가 셋이다).
function campRuneConsOf(kind, i){
  return (kind === 'uniq') ? i : Math.floor(i / RUNE_CONS); }
// 고른 칸의 성좌로 들어간다
function campRuneFocus(now){
  if(!_rnView || !_runePickKind) return;
  campRuneLookCons(campRuneConsOf(_runePickKind, _runePick), now); }
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
/* 🃏 **낀 칸은 카드 그림 한 장이다**(2026-09-12 사용자 확정) — 가방·상점과 같은 에셋.
   📐 크기는 **칸 지름 × 0.93**. 카드(128×128)의 육각이 네모의 **세로를 가득 채우므로**(실측:
     알파 범위 세로 128 · 가로 118), `2r` 이면 옛 검은 바닥과 높이가 같고 `1.86r` 이면
     옛 **면**(r×0.93)과 같다 — 칸 사이 숨 쉴 틈이 그대로 남는다(둘을 찍어 견줬다).
     ⛔ 2.0 으로 올리지 말 것: 이웃과 맞닿아 고리가 답답해진다.
     ⛔ 1.0 쯤으로 줄이지 말 것: 카드가 칸 안에 떠서 「칸 속의 작은 카드」가 된다. */
const RUNE_CARD_K = 1.86;
// 📏 **칸 하나가 바깥으로 뻗는 거리** ÷ 칸 반지름 — 전체 보기·팬 경계·이웃 간섭을 재는 자가
//   이것 하나다(⛔ 값을 따로 적지 말 것). ⚠ 이웃 칸 중심 사이는 **55.1**(고리 72 · 8칸)이라
//   칸 바깥으로 27.6 을 넘으면 옆 칸을 침범한다 — 지금은 r×0.93 = 22.8 로 넉넉하다.
//   ⚠ 옛 「바깥 링(RUNE_RING1/2)·꼭짓점 점」은 카드가 등급을 말하면서 사라졌다(2026-09-12).
const RUNE_CELL_OUT = RUNE_CARD_K / 2;
// 🔁 교체 후보의 점선이 칸 밖으로 나가는 거리 — 이웃 칸 가장자리(28.0)를 넘으면 안 된다
const RUNE_ANTS_GAP = 3.2;

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
    g.push('<text class="rnLkT" x="' + X + '" y="' + (y + 2.5).toFixed(1) + '">Lv.' + at + '</text>');
    return g.join(''); }
  if(!key){
    // 🕳 **파인 홈** — 「+」 하나뿐이던 빈 칸을 «끼우는 자리»로 바꾼다(목업 camp-rune-slot-8 ②안).
    //   ⛔ 반투명으로 되돌리지 말 것 — 뒤의 구역 오로라가 비쳐 칸이 갈래 색으로 물든다.
    //   ⛔ 「+」·숨 원(.rnEmB)을 되살리지 말 것: 홈이 이미 「비었다」를 말하고, 원은 오로라를 한 겹 더 더한다.
    // 🎨 갈래 색 테두리 — 일반 칸은 그 성좌의 갈래, 유니크 칸은 보라
    const gk = runeCellGrp(kind, i);
    g.push('<polygon class="rnHx em" points="' + _runeHexPts(x, y, r * 0.93)
      + '" style="stroke:url(#rnEg' + gk + ')"/>');
    g.push('<polygon class="rnEmIn" points="' + _runeHexPts(x, y, r * 0.93 - 1.6) + '"/>'); }
  else {
    const pp = runeParse(key), c = (RUNE_GD[pp.gd] || {}).col || '#8b95a5', uq = pp.gd === 'uniq';
    // ⬛ 검은 바닥 — 배경 사진을 눌러 앉힌다(카드 속이 조금 비쳐 오로라가 올라온다)
    g.push('<polygon class="rnHxFloor" points="' + _runeHexPts(x, y, r) + '"/>');
    // 🃏 **낀 칸은 카드 그림 한 장이다**(2026-09-12 사용자 확정) — 가방·상점과 **같은 에셋**이다.
    //   ⭐ 손으로 그리던 것(바깥 링 · 면 그라데이션 · 뒷광 · 안쪽 흰 선 · 꼭짓점 점 · 문양)을
    //     전부 카드가 대신한다 — 카드에 이미 테두리·등급색·속광이 그려져 있어 겹치면 테가 둘이 된다.
    //   ⛔ 손그림을 도로 얹지 말 것(두 겹이 된다) · ⛔ 가방·상점과 다른 그림을 쓰지 말 것.
    //   ⚠ 클래스는 **`rnImg` 그대로** 둔다 — 가림(`.veil`)·날아오기·부풀림이 그 이름을 잡는다.
    //   💡 등급색 번짐만 남긴다 — 이게 없으면 배경과 상호작용이 없어 **스티커처럼 얹혀** 보인다
    //     (2026-09-04 에 합친 그림을 물렸던 이유가 그것이라, 이번엔 번짐을 함께 준다).
    { const gp = (kind === 'uniq') ? (RUNE_GRPS[i] || '') : '';
      const src = runeIcoSrc(key, gp), w = r * RUNE_CARD_K;
      if(src) g.push('<image class="rnImg" href="' + src + '"'
        + ' x="' + (x - w / 2).toFixed(1) + '" y="' + (y - w / 2).toFixed(1) + '"'
        + ' width="' + w.toFixed(1) + '" height="' + w.toFixed(1) + '"'
        + ' style="filter:drop-shadow(0 0 ' + (uq ? 4 : 3) + 'px ' + c + ')"/>'); }
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
  // 🃏 **낀 칸의 그라데이션은 없앴다**(2026-09-12) — 칸이 카드 그림 한 장이 되면서
  //   면(#rnFace) · 테두리(#rnE<등급>) · 뒷광(#rnB<등급>)을 쓰는 곳이 사라졌다.
  //   ⛔ 되살리지 말 것: 카드에 이미 그려져 있어 겹치면 테가 둘이 된다.
  let d = '<defs>';
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
  //   ⭐ 카드 그림의 테두리와 **같은 어휘**다 — 위가 흰빛, 아래로 갈수록 색.
  //     빛이 위에서 오는 결이 판 전체에 통하고, 칸 하나만 봐도 어느 갈래의 자리인지 읽힌다.
  //   ⚠ 세기는 낀 칸보다 **약하다**(흰빛 .92 → .34). 빈 칸이 더 시끄러우면 끼웠을 때
  //     달라지는 것이 없다. ⛔ 올리지 말 것.
  for(const k of RUNE_GRPS.concat('uniq')){     // 💠 유니크 칸은 갈래가 없어 **제 등급 색**을 쓴다
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
  const rows = [_runeDefs(), _runeZoneSvg()], tbN = RUNE_SLOT_LV.norm, tbU = RUNE_SLOT_LV.uniq;
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
  const want = runeBucket(_runeSwapKey);
  if(kind !== want) return false;
  if(!campRuneEq(kind)[i]) return false;                    // 빈 칸은 교체가 아니라 그냥 장착
  return runeSlotTakesGrp(kind, i, p.def.grp);              // 🗺 장착과 **같은 판정**을 쓴다
}
function campRuneSwapEnd(re){ if(!_runeSwapKey) return;
  _runeSwapKey = ''; if(re !== false) campRuneRender(); }
// 🎯 그 갈래 성좌를 **보이는 자리의 한가운데**로 — 위 띠와 아래 가방을 뺀 나머지의 중심이다.
//   ⛔ 판 한가운데(RUNE_MAP_H/2)로 잡지 말 것 — 아래를 가방이 214px 덮어 성좌가 그 뒤로 내려간다.
function campRuneSwapLook(now){
  const p = runeParse(_runeSwapKey); if(!p.def) return;
  // 💠 유니크 룬은 **어느 유니크 칸에도** 들어가고 그 셋이 세 성좌에 흩어져 있다 —
  //   한 곳을 잡을 수 없으므로 **전체 보기 그대로** 둔다(2026-09-12).
  //   ⚠ 여기(교체 대기)에서만 그렇다 — **빈 칸에 넣을 때는 칸이 이미 정해져 있어** 그리로 간다.
  if(runeBucket(_runeSwapKey) === 'uniq') return;
  campRuneLookCons(RUNE_GRPS.indexOf(p.def.grp), now); }
// 🎯 **성좌 하나를 보이는 자리의 한가운데로** — 교체 대기 · 칸 고르기 · 빈 칸에 넣기 셋이
//   같은 함수를 쓴다(2026-09-12 에 셋째가 붙으면서 하나로 모았다).
//   ⛔ 성좌를 가운데로 옮기는 길을 또 만들지 말 것 — 앵커가 갈리면 같은 동작인데 화면이 다르게 선다
//     (옛 campRuneFocus 는 `RUNE_MAP_H*0.34` 라는 **손으로 적은 근사값**을 썼다).
function campRuneLookCons(ci, now){
  if(!_rnView || ci == null || ci < 0) return;
  const c = RUNE_CT[ci]; if(!c) return;
  const mp = document.querySelector('#campRune .rnMap');
  const H = mp ? mp.getBoundingClientRect().height : 0;
  if(!H){ requestAnimationFrame(() => { if(_runeAlive()) campRuneLookCons(ci, now); }); return; }
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
  // ⛔ **지우기를 rAF 밖에 두지 말 것**(2026-09-05 에 잡은 버그). 붙이는 것은 rAF 안인데
  //   지우기를 밖에서 460ms 뒤로 걸면, rAF 가 밀린 프레임에서는 **지운 뒤에 붙어** 클래스가
  //   영영 남는다. 그러면 그 칸은 다음 교체 대기에서 숨쉬지 않는다 —
  //   `.rnCell.rnPop` 이 `.rnCand` 보다 CSS 뒤에 있어 이기기 때문이다(스모크가 잡았다).
  requestAnimationFrame(() => { el.classList.add('rnPop');
    setTimeout(() => el.classList.remove('rnPop'), 460); });
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
    const want0 = p0.def ? runeBucket(_runeSwapKey) : 'norm';
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
  const gds = RUNE_GRADES;                                 // 🎚 등급 넷을 한 줄에(유니크 포함)
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
  //   💠 **유니크 칸은 갈래를 안 가리므로 안 거른다**(2026-09-12) — 세 갈래를 다 보여 준다.
  const grpSel = (kindSel && kindSel !== 'uniq') ? runeSlotGrp(_runePick) : '';
  // 머리줄 — 고른 칸이 있으면 그 칸을 말하고, 차 있으면 빼는 길을 준다
  let hd;
  if(kindSel){
    const eq = campRuneEq(kindSel), cur = eq[_runePick] || null;
    const nm = (kindSel === 'uniq' ? '유니크' : '일반') + ' ' + (_runePick + 1) + '번 칸';
    const gn = (kindSel === 'uniq') ? '유니크' : ((RUNE_GRP[grpSel] || {}).nm || '');
    hd = '<span class="rnBagT">' + nm + (cur ? ' · ' + runeName(cur) : ' · 비어 있음') + '</span>'
      + (gn ? '<span class="rnBagN">' + gn + ' 룬만</span>' : '')
      + (cur ? '<button class="rnOff" type="button" onclick="campRuneUnequip(\'' + kindSel + '\','
          + _runePick + ')">빼기</button>' : ''); }
  // ⛔ 「누르면 빈 칸에 끼웁니다」 안내는 뺐다(2026-09-04 사용자 확정) —
  //   한 번 배우면 계속 자리만 차지한다. 칸을 고른 상태의 안내는 위에 남는다.
  else hd = '<span class="rnBagT">보유한 룬</span>';
  let g = '';
  for(const grp of RUNE_GRPS){
    if(grpSel && grp !== grpSel) continue;              // 🔎 고른 칸의 갈래만
    const q = RUNE_LIST.filter(d => d.grp === grp);
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
  const kind = runeBucket(key);
  if(campRuneFree(key) <= 0) return false;
  const R = campRuneState(); if(!R) return false;
  const n = campRuneSlots(kind);
  // ⚠ **그 룬이 들어갈 수 있는** 빈 칸을 찾는다 — 그냥 첫 빈 칸을 잡으면
  //   갈래가 다른 성좌에서 걸려 장착이 실패한다(성장 룬이 경제 칸에서 막혔다).
  for(let i = 0; i < n; i++) if(!R[kind][i] && campRuneCanEquip(kind, i, key)){
    // ✈ 빈 칸에 들어갈 때도 **날아서** 들어간다(2026-09-04 사용자 확정) —
    //   교체만 날아가면 「그냥 넣기」와 「바꿔 넣기」가 다른 화면처럼 보인다.
    if(!campRuneEquipFly(kind, i, key, { look:true })) return false;
    return true; }
  return false; }
// ✈ 장착 + 날아가는 그림 — 가방 줄에서 칸으로.
//   ⚠ 출발 자리는 **끼우기 전에** 잰다(다시 그리면 그 버튼이 «–» 로 바뀌거나 자리가 달라진다).
// ⏳ **판이 다 미끄러진 뒤에** 한다 — 날아갈 자리(`_runeSlotAt`)는 **화면 좌표**라,
//   미끄러지는 동안 재면 룬이 칸이 **있던 자리**에 내린다(궤적은 고정된 keyframe 이다).
//   ⚠ 상한을 둔다 — 어떤 이유로든 안 멎으면 연출이 통째로 사라지는 것보다 조금 어긋나는 편이 낫다.
const RUNE_LOOK_MAX = 900;
function _runeAfterLook(fn){
  let did = false;
  const go = () => { if(did) return; did = true; fn(); };
  // ⏰ **타이머가 안전망이다** — rAF 만 믿으면 안 된다. 탭이 가려지거나 그릴 것이 없으면
  //   rAF 가 통째로 멈추는데, 그러면 날아가는 그림도 **도착도** 영영 안 와서 받을 칸이
  //   가려진 채(`_runeVeil`) 빈칸으로 남는다 — 장착은 됐는데 화면에는 없는 꼴이다
  //   (2026-09-12 실측: 스모크에서 rAF 가 안 와 비행이 통째로 사라졌다). ⛔ 빼지 말 것.
  setTimeout(go, RUNE_LOOK_MAX);
  const step = () => {
    if(did || !_runeAlive()) return;
    const v = _rnView;
    if(!v || (v.x === v.tx && v.y === v.ty && v.z === v.tz)){ go(); return; }
    requestAnimationFrame(step); };
  requestAnimationFrame(step); }
function campRuneEquipFly(kind, i, key, opt){
  const O = opt || {};
  const from = _runeBagAt(key);
  // 🫥 **끼우기 전에** 감춰 둔다 — campRuneEquip 이 곧 다시 그리는데, 그때 이미 감춰져 있어야
  //   문양이 「생겼다 사라지는」 것으로 안 보인다.
  _runeVeil = _runeVeilKey(kind, i);
  if(!campRuneEquip(kind, i, key)){ _runeVeil = ''; return false; }
  const c = (RUNE_GD[runeParse(key).gd] || {}).col || '';
  const fly = () => {
    const to = _runeSlotAt(kind, i);
    if(!from || !to){ _runeVeil = ''; campRuneRender(); return; }   // 자리를 못 찾으면 그냥 보인다
    _runeFly(key, from, to, RUNE_FLY_MS,
      { tint:c, delay:O.delay || 0, onLand: () => campRuneLand(kind, i, key) }); };
  // 🎯 **빈 칸에 넣을 때는 그 성좌로 먼저 간다**(2026-09-12 사용자 요청 — 교체·칸 고르기와 같은 자리).
  //   ⭐ 상태는 위에서 **이미** 바뀌었다 — 여기서 미루는 것은 그림뿐이라, 도중에 화면을 나가도
  //     장착은 남는다(⛔ 애니가 끝날 때 상태를 바꾸지 말 것 · 같은 규칙).
  if(O.look){ campRuneLookCons(campRuneConsOf(kind, i)); _runeAfterLook(fly); }
  else fly();
  return true; }
// 🎒 가방을 눌렀을 때 — 칸을 골라 뒀으면 **그 칸에**, 아니면 **빈 칸에**.
// 🎯 같은 갈래의 **다음 빈 칸** — 없으면 -1.
//   ⚠ 한 바퀴 돌며 찾는다(뒤가 다 찼으면 앞의 빈 칸으로). 갈래를 넘어가지는 않는다 —
//     성좌가 바뀌면 화면이 멀리 뛰고, 가방도 통째로 갈린다.
function campRunePickNext(kind, from){
  const n = campRuneSlots(kind), eq = campRuneEq(kind);
  const grp = runeCellGrp(kind, from);
  for(let s = 1; s <= n; s++){ const i = (from + s) % n;
    if(eq[i]) continue;
    if(kind === 'norm' && runeSlotGrp(i) !== grp) continue;
    return i; }
  return -1; }
function campRuneBagTap(key){
  const pp = runeParse(key); if(!pp.def) return;
  const kind = runeBucket(key);
  const say = m => { if(typeof toast === 'function') toast(m); };
  if(_runePickKind && _runePickKind !== kind){
    say(kind === 'uniq' ? '유니크 칸에만 들어갑니다' : '일반 칸에만 들어갑니다'); return; }
  if(_runePickKind && _runePick >= 0){
    // 고른 칸에 이미 같은 룬이면 아무 일도 아니다
    const cur = campRuneEq(kind)[_runePick] || null;
    if(cur === key) return;
    const at = _runePick;
    if(!campRuneEquipFly(kind, at, key, { look:true })){ say('남은 룬이 없습니다'); return; }
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
  for(const d of RUNE_LIST) for(const gd of RUNE_GRADES){
    if(gd !== 'uniq') norm.push(runeKey(d.id, gd)); }
  norm.sort((a, b) => runeHash(seed + a) - runeHash(seed + b));
  const uq = RUNE_LIST.map(d => runeKey(d.id, 'uniq'));
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
    for(const d of RUNE_LIST){ if(d.grp !== g) continue;
      // 안 가진 것 중 **가장 높은 등급**을 권한다(살 수 있으면 좋은 것을)
      for(const gd of RUNE_GRADES.slice().reverse()){ const k = runeKey(d.id, gd);
        if(campRuneOwn(k) > 0) continue;
        push(k, (RUNE_GRP[g] || {}).nm + ' 칸이 ' + hole[g] + '개 비었습니다'); break; }
      if(out.length >= 3) break; }
    if(out.length >= 3) break; }
  if(holeU > 0) for(const d of RUNE_LIST){
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
  const S = RUNE_TAB_ICO;
  // ⚪ 「전체」 — 갈래가 아니라 원 하나(육각·글리프는 갈래의 것이다)
  if(grp === 'all'){ const h = S / 2;
    return '<svg class="rnTabI" width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + ' ' + S + '">'
      + '<circle cx="' + h + '" cy="' + h + '" r="' + (h - 2) + '" fill="none" stroke="#c3ccd8" stroke-width="1" opacity="' + (on ? '.85' : '.38') + '"/>'
      + '<circle cx="' + h + '" cy="' + h + '" r="3.2" fill="#c3ccd8" opacity="' + (on ? '1' : '.45') + '"/></svg>'; }
  const c = (grp === 'uniq') ? ((RUNE_GD.uniq || {}).col || '#c98bff')
                             : ((RUNE_GRP[grp] || {}).col || '#b4cdeb');
  const R = S / 2 - 1, q = [];
  for(let i = 0; i < 6; i++){ const a = Math.PI / 180 * (60 * i - 90);
    q.push((S / 2 + R * Math.cos(a)).toFixed(1) + ',' + (S / 2 + R * Math.sin(a)).toFixed(1)); }
  const k = (S * 0.60 / 24).toFixed(3), off = (S / 2 - S * 0.30).toFixed(1);
  return '<svg class="rnTabI" width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + ' ' + S + '">'
    + '<polygon points="' + q.join(' ') + '" fill="' + (on ? 'rgba(255,255,255,.05)' : 'none')
    +   '" stroke="' + c + '" stroke-width="1" opacity="' + (on ? '.85' : '.38') + '"/>'
    + '<g transform="translate(' + off + ',' + off + ') scale(' + k + ')">'
    + '<path d="' + (RUNE_TAB_GLYPH[grp] || RUNE_TAB_GLYPH.eco) + '" fill="' + c
    +   '" opacity="' + (on ? '1' : '.45') + '"/></g></svg>'; }
// 🛒 **일반 상점의 두 축**(2026-09-12 사용자 확정 · 목업 rune-shop-final-3):
//   유형(전체·경제·전투·성장)은 평소 「전체」로 **묶여 있고**, 등급(하·중·상·유니크)은 따로 고른다.
//   ⭐ 규칙은 하나 — **등급이 하나로 정해졌으면 줄 오른쪽에 버튼 하나, 아니면 줄을 눌러 아래로 펼친다.**
//   ⛔ 줄마다 등급 버튼 넷을 늘어놓던 옛 모양(.rnBuyS · 다락)으로 되돌리지 말 것 — 한 탭에 서른 개가
//     깔려 「무엇을 파는가」보다 격자가 먼저 읽혔다.
let _runeShopTab = 'all';                // 유형 — 'all' | RUNE_GRPS 중 하나
let _runeShopGd = '';                    // 등급 고정 — '' | RUNE_GRADES 중 하나
let _runeShopOpen = '';                  // 펼쳐 둔 줄(룬 id) — 한 번에 하나
function campRuneShopTab(g){ _runeShopTab = g; _runeShopOpen = ''; campRuneRender(); }
function campRuneShopGd(gd){ _runeShopGd = (_runeShopGd === gd) ? '' : gd; _runeShopOpen = ''; campRuneRender(); }
// ⬇ 펼친 구역의 HTML — **렌더와 애니가 같은 것을 쓴다**(⛔ 두 벌로 만들지 말 것)
function _runeShopExpHTML(id){
  return '<div class="rnShopExp">'
    + RUNE_GRADES.map(gd => _runeGdCard(runeKey(id, gd))).join('') + '</div>'; }
const RUNE_EXP_MS=220;   // 펼침·접힘 시간(ms) — CSS .rnShopExp 의 transition 과 같아야 한다
// 🎬 **펼침·접힘은 제자리에서 움직인다**(2026-09-12 사용자 요청 「자연스러운 애니메이션」).
//   ⛔ 여기서 campRuneRender() 를 부르지 말 것 — 목록을 통째로 다시 그리면 DOM 이 사라져
//     전환이 걸릴 요소가 없다(그래서 옛 코드는 툭 열리고 툭 닫혔다).
//   ⭐ 높이를 0 ↔ 실제높이로 민다. 다 펴지면 height:auto 로 풀어 준다(안 풀면 내용이 바뀔 때 잘린다).
//   ⚠ 다른 줄을 누르면 **닫힘과 열림이 같이 돈다** — 닫는 것을 기다렸다 열면 굼떠 보인다.
//   ⚠ 화면을 다시 그리는 다른 길(구매·등급 칩·탭)은 그대로 campRuneRender 를 쓴다 —
//     그때는 열린 줄이 처음부터 펼쳐진 채로 그려진다(위 _runeShopExpHTML).
function _runeExpOpen(el){
  el.style.height='0px'; void el.offsetHeight;
  el.style.height=el.scrollHeight+'px';
  clearTimeout(el._expT); el._expT=setTimeout(()=>{ el.style.height='auto'; }, RUNE_EXP_MS); }
function _runeExpClose(el, done){
  if(el._expOut) return;   // 이미 접는 중 — 두 번 걸면 타이머가 엇갈린다
  el._expOut=1; clearTimeout(el._expT);
  el.style.height=el.scrollHeight+'px'; void el.offsetHeight;
  el.style.height='0px';
  el._expT=setTimeout(()=>{ el.remove(); if(done) done(); }, RUNE_EXP_MS); }
function campRuneShopOpen(id){
  const box=document.getElementById('rnBody');
  const list=box && box.querySelector('.rnShopList');
  const same=(_runeShopOpen===id);
  _runeShopOpen = same ? '' : id;
  // 목록이 아직 없으면(첫 그리기 전) 평소대로 그린다
  if(!list){ campRuneRender(); return; }
  // 열려 있던 것을 접는다
  //   ⚠ 펼친 구역은 **열린 줄의 바로 다음 형제**로 집는다. `querySelector('.rnShopExp')` 로 집으면
  //     아직 **접히는 중인 옛 구역**(사라지기 전 220ms)이 먼저 걸려, 정작 열린 것을 못 닫는다
  //     (실측: 다른 줄을 연 직후 같은 줄을 다시 누르면 안 닫혔다 · 스모크가 잡았다).
  const openRow=list.querySelector('.rnShopRw.open');
  const _nx=openRow && openRow.nextElementSibling;
  const openExp=(_nx && _nx.classList.contains('rnShopExp')) ? _nx : null;
  if(openRow){ openRow.classList.remove('open');
    const a=openRow.querySelector('.rnRwArw'); if(a) a.textContent='›'; }
  if(openExp) _runeExpClose(openExp);
  if(same){ if(typeof playSfx==='function') playSfx('ui_close'); return; }
  // 새로 연다 — 그 줄 바로 뒤에 끼우고 높이를 민다
  const rows=[...list.querySelectorAll('.rnShopRw')];
  const idx=RUNE_LIST.filter(d=>_runeShopTab==='all'||d.grp===_runeShopTab).findIndex(d=>d.id===id);
  const row=rows[idx]; if(!row){ campRuneRender(); return; }
  row.classList.add('open');
  { const a=row.querySelector('.rnRwArw'); if(a) a.textContent='⌃'; }
  const tmp=document.createElement('div'); tmp.innerHTML=_runeShopExpHTML(id);
  const exp=tmp.firstElementChild; if(!exp){ campRuneRender(); return; }
  row.insertAdjacentElement('afterend', exp);
  if(typeof paintIcons==='function') paintIcons(exp);
  _runeExpOpen(exp);
  if(typeof playSfx==='function') playSfx('ui_open'); }
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
    + ' onclick="campRuneBuyAsk(\'' + p.def.id + '\',\'' + gd + '\')">'
    + (sale ? '<i class="rnOff">-' + Math.round(RUNE_SALE_OFF * 100) + '%</i>' : '')
    + runeIcoHTML(key, 'rnBuyI')
    + (p.def.soon ? '<i class="rnSoon">준비 중</i>' : '')
    + '<b>' + (O.nameFull ? runeName(key) : ((RUNE_GD[gd] || {}).tx || '')) + '</b>'
    + '<span>' + runeValTx(key) + '</span>' + tail
    + (own > 0 ? '<em class="rnHas">×' + own + '</em>' : '') + '</button>'; }

// 🧾 펼친 구역의 **등급 카드** — 할인 카드(.rnBuy)의 얼굴을 작게(.gd). 안은 넷:
//   [작은 그림 + 등급 이름](제일 크다) / 등급 값(작게) / 젬 값 판 / 보유 ×N(더 작게).
//   ⚠ 등급 이름이 제일 크다(2026-09-12 사용자: 「가장 큰 것이 등급이 되도록」) — 값·보유는 그 아래.
function _runeGdCard(key){
  const p = runeParse(key); if(!p.def) return '';
  const gd = p.gd, c = (RUNE_GD[gd] || {}).col || '#8b95a5';
  const gemI = (typeof resIco === 'function') ? resIco('gem') : '';
  const own = campRuneOwn(key), full = own >= RUNE_OWN_MAX;
  const sale = runeOnSale(key), cost = runeNowGem(key);
  const have = (typeof profGem === 'function') ? profGem() : 0;
  const off = full || have < cost;
  return '<button class="rnBuy gd' + (sale ? ' sale' : '') + '" type="button"'
    + (off ? ' disabled' : '') + ' style="--rg:' + c + '"'
    + ' onclick="campRuneBuyAsk(\'' + p.def.id + '\',\'' + gd + '\')">'
    + (sale ? '<i class="rnOff">-' + Math.round(RUNE_SALE_OFF * 100) + '%</i>' : '')
    + '<span class="hd">' + runeIcoHTML(key, 'rnGdI') + '<b>' + ((RUNE_GD[gd] || {}).tx || '') + '</b></span>'
    + '<span class="pc">' + runeValTx(key) + '</span>'
    + (full ? '<u class="max">' + RUNE_OWN_MAX + '개</u>'
            : '<u>' + gemI + ' ' + cost + (sale ? '<s>' + runeGem(key) + '</s>' : '') + '</u>')
    + (own > 0 ? '<em class="own">보유 ×' + own + '</em>' : '<em class="own none">—</em>')
    + '</button>'; }
// 🧾 등급이 하나로 정해졌을 때 줄 오른쪽의 **버튼 하나**(.rnBuy.one · 모서리 컷 + 금속 띠)
function _runeBuyOne(key){
  const p = runeParse(key); if(!p.def) return '';
  const gd = p.gd, c = (RUNE_GD[gd] || {}).col || '#8b95a5';
  const gemI = (typeof resIco === 'function') ? resIco('gem') : '';
  const own = campRuneOwn(key), full = own >= RUNE_OWN_MAX;
  const sale = runeOnSale(key), cost = runeNowGem(key);
  const have = (typeof profGem === 'function') ? profGem() : 0;
  const off = full || have < cost;
  return '<button class="rnBuy one' + (sale ? ' sale' : '') + (gd === 'uniq' ? ' gold' : '') + '" type="button"'
    + (off ? ' disabled' : '') + ' style="--rg:' + c + '"'
    + ' onclick="campRuneBuyAsk(\'' + p.def.id + '\',\'' + gd + '\')">'
    + (sale ? '<i class="rnOff">-' + Math.round(RUNE_SALE_OFF * 100) + '%</i>' : '')
    + (full ? '<u class="max">' + RUNE_OWN_MAX + '개</u>'
            : '<u>' + gemI + ' ' + cost + (sale ? '<s>' + runeGem(key) + '</s>' : '') + '</u>')
    + '</button>'; }
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

  // 🗂 ③ 일반 — 유형 탭(전체·경제·전투·성장) + 등급 칩 + 펼치는 줄(위 _runeShopTab 주석).
  const tabs = ['all'].concat(RUNE_GRPS);
  const idx = Math.max(0, tabs.indexOf(_runeShopTab));
  const gdOn = _runeShopGd;
  const list = RUNE_LIST.filter(d => _runeShopTab === 'all' || d.grp === _runeShopTab);
  // 🏷 제목 옆 배지 — 「지금 무엇으로 좁혀져 있나」를 제목이 말한다(안 그러면 분류 줄을 봐야 안다)
  let badge = '';
  if(_runeShopTab !== 'all') badge += '<span class="rnState" style="--rg:' + ((RUNE_GRP[_runeShopTab] || {}).col || '#c3ccd8')
    + '"><i></i>' + ((RUNE_GRP[_runeShopTab] || {}).nm || '') + '</span>';
  if(gdOn) badge += '<span class="rnState" style="--rg:' + ((RUNE_GD[gdOn] || {}).col || '#c3ccd8')
    + '"><i></i>' + ((RUNE_GD[gdOn] || {}).tx || '') + (_runeShopTab === 'all' ? '<u>만</u>' : '') + '</span>';
  h += '<div class="rnSec"><div class="rnSecH"><span class="rnSecT">상점' + badge + '</span>'
    + '<span class="rnSecN"><b>' + list.length + '</b>종' + (_runeShopTab === 'all' && !gdOn ? ' · 전체' : '') + '</span></div>';
  // 🗂 탭 띠는 **공용 함수**다(CLAUDE.md 「세그먼트 이동 바」) — 새로 만들지 않는다.
  //   🔷 **아이콘 탭**(2026-09-05 사용자 확정 · 목업 shop-icontab-4 ①안) — 육각 아이콘 + 이름,
  //     고른 칸만 한 단 밝고 **아래 밑변 광원 한 줄**이 켜진다. 「전체」는 원 하나(_runeTabIco).
  //     ⛔ 상점 전용 탭 함수를 새로 만들지 말 것.
  h += (typeof segNavHTML === 'function')
    ? segNavHTML(tabs.map((g, k) => ({
        label: _runeTabIco(g, k === idx) + '<span>' + (g === 'all' ? '전체' : ((RUNE_GRP[g] || {}).nm || g)) + '</span>' })), idx,
        k => "campRuneShopTab('" + tabs[k] + "')").replace('class="pdSeg"', 'class="pdSeg stack"')
    : '';
  // 🎚 등급 칩 — 판 없는 글자 + 밑변 광원(탭 띠와 같은 어휘 · 다시 누르면 풀린다)
  h += '<div class="rnGdChips"><i>등급</i>'
    + RUNE_GRADES.map(gd => '<button type="button" class="rnGdChip' + (gdOn === gd ? ' on' : '')
        + '" style="--rg:' + ((RUNE_GD[gd] || {}).col || '#8b95a5') + '" data-gd="' + gd
        + '" onclick="campRuneShopGd(\'' + gd + '\')">' + ((RUNE_GD[gd] || {}).tx || gd) + '</button>').join('')
    + (gdOn ? '' : '<span class="rnGdNote">안 고르면 펼쳐서 산다</span>') + '</div>';
  h += '<div class="rnShopList">';
  for(const d of list){
    const open = !gdOn && _runeShopOpen === d.id;
    // 🧾 **가로줄** — [그림] [룬 이름 / 설명 · 등급 값] … [▸ 또는 버튼 하나]
    //   ⚠ 상점 줄은 **룬 이름이 제목, 설명이 부제**다(2026-09-12 사용자 확정). 가방 줄은 반대다
    //     (2026-09-04 「무엇이 오르는지」가 먼저) — 두 화면의 규칙이 다르니 하나로 맞추지 말 것.
    h += '<div class="rnShopRw' + (open ? ' open' : '') + '"'
      + (gdOn ? '' : ' onclick="campRuneShopOpen(\'' + d.id + '\')"') + '>'
      + runeIcoHTML(runeKey(d.id, gdOn || 'mid'), 'rnRwI')
      + '<span class="rnRwT">' + d.nm + (d.soon ? '<u>준비 중</u>' : '')
      + '<s><i>' + d.de + '</i> · ' + RUNE_GRADES.map(gd => _runePctTx(runeKey(d.id, gd))).join(' · ') + '</s></span>'
      + (gdOn ? _runeBuyOne(runeKey(d.id, gdOn)) : '<span class="rnRwArw">' + (open ? '⌃' : '›') + '</span>')
      + '</div>';
    // ⬇ 펼친 구역 — 등급 넷을 할인 카드와 같은 얼굴(모서리 컷 + 금속 띠)로, 작게
    if(open) h += _runeShopExpHTML(d.id); }
  h += '</div></div>';
  return h; }
