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
const RUNE_LIST = [
  // ── 일반 7종 ── 값은 아래 RUNE_VAL 이 정한다(하급 1% · 중급 2.5% · 상급 5%)
  // ⚠ 「재화의 룬」(gain · 탭+채취)은 2026-09-03 에 지웠다 — 손끝의 룬을 **품고 있어서**
  //   젬 값이 같으면 손끝을 살 이유가 없었다. ⛔ 되살리려면 손끝과 겹치지 않게 갈라야 한다.
  { id:'tap',   nm:'손끝의 룬',   kind:'norm', eff:'tap',   ico:'coin',
    de:'탭 획득량' },
  { id:'gas',   nm:'정제의 룬',   kind:'norm', eff:'gas',   ico:'box',
    de:'가스 획득' },
  { id:'pop',   nm:'증원의 룬',   kind:'norm', eff:'pop',   ico:'user',
    de:'인구 상한' },
  { id:'atk',   nm:'힘의 룬',     kind:'norm', eff:'atk',   ico:'upg',
    de:'유닛 공격력' },
  { id:'aspd',  nm:'연타의 룬',   kind:'norm', eff:'aspd',  ico:'upg',
    de:'유닛 공격속도' },
  { id:'hp',    nm:'수호의 룬',   kind:'norm', eff:'hp',    ico:'armor',
    de:'유닛 체력' },
  { id:'heal',  nm:'치유의 룬',   kind:'norm', eff:'heal',  ico:'hero',
    de:'회복량' },
  // ── 유니크 4종 — **다른 데서 못 사는 것**이라 칸이 셋뿐이다 ──
  // ⚠ **가속의 룬은 유별나게 세다.** 실측(2026-09-02 · BALANCE §3-2-7): +10% 가 45분 누적
  //   수입을 **+60%** 로 만들었다(누적 증폭 4.9제곱 — 결제 팩 1.63제곱보다 3배 가파르다).
  //   다른 룬은 축 하나를 키우지만 이것은 **시간 자체**라 모든 축에 곱해진다.
  //   그래서 한동안 저 혼자 2.5% 였다. 2026-09-03 사용자 확정으로 **다른 유니크와 같은 5%** 로
  //   올렸다 — ⛔ 다시 재야 한다(칸도 5 → 24 로 늘어 상한이 함께 움직였다).
  { id:'speed', nm:'가속의 룬',   kind:'uniq', eff:'speed', ico:'boost',
    de:'캠프 전체 진행 속도' },
  // ⭐ 이동속도 룬은 **일꾼 하나뿐**이다(2026-09-02). 「유닛 이동속도」는 뺀 축이다.
  //   ⚠ 2026-09-03 사용자 확정으로 **일반 → 유니크**로 올라왔다(질주의 룬이 가속과 겹쳐 빠진 자리).
  { id:'wspd',  nm:'신속의 룬',   kind:'uniq', eff:'wspd',  ico:'boost',
    de:'일꾼 이동속도' },
  { id:'mapg',  nm:'전리품의 룬', kind:'uniq', eff:'mapGain', ico:'map',
    de:'유즈맵 보상 재화' },
  // ⚡ 피버타임이 들어왔다(메인 머지 2026-09-02) — `campFevPct()` 에 곱한다.
  //   ⚠ **확률**을 올린다(지속·배수가 아니다). 지속·배수를 키우면 피버가 「사건」에서
  //     「상시 배수」로 바뀐다 — 그걸 막는 것이 재발동 대기(CAMP_FEV_CD)다.
  //   ⚠ 환생 트리에서 피버를 안 열었으면 이 룬도 아무 일을 안 한다.
  { id:'fever', nm:'열기의 룬',   kind:'uniq', eff:'fever', ico:'new',
    de:'피버 발동 확률' } ];

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
const RUNE_CT = [[220, 130], [92, 400], [348, 400]];   // 성좌 셋의 중심 — 🔺
const RUNE_RING = 72;                                  // 중심에서 고리까지
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
function campRuneSlots(kind){ const tb = RUNE_SLOT_R[kind] || []; const b = campRuneBestRound();
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
function campRuneOwn(key){ const R = campRuneState(); return R ? ((R.own[key] | 0)) : 0; }
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
function campRuneEff(eff){ return _runeEffAll()[eff] || 0; }
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
  box.classList.toggle('shop', _runeSec === 'shop');   // 상점만 흐르는 목록이다(판은 전체를 채운다)
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
// 🗺 진행 수치는 **상단 제목 옆**에 붙는다 — 판 위에 또 한 줄을 띄우면 층이 둘이 된다.
function _runeTopSync(){
  const el = document.getElementById('rnRound'); if(!el) return;
  el.innerHTML = (_runeSec === 'shop') ? ''
    : ('최대 도달 <b>' + campRuneBestRound() + '</b> / ' + campRuneMaxRound()); }

// ── 🔍 판 조작 — 공용 엔진(svv*)에 맡긴다 ───────────────────────────────
//   ⛔ 팬·줌·연출을 여기서 다시 짜지 말 것. 엔진은 19-camp.js 에 있다.
//   ⚠ 칸을 고르면 **그 성좌로 들어간다**. 고른 칸만 밀어 올리면 아래쪽 성좌를 골랐을 때
//     판이 통째로 도망가 화면이 텅 빈다(실측 2026-09-03).
const RUNE_PICK_SC = 1.35;
const RUNE_ZLIM = { min:0.45, max:2.8, out:0.72 };
let _rnView = null;
function _runeG(){ return document.getElementById('rnG'); }
function _runeSvg(){ return document.getElementById('rnSvg'); }
function _runeAlive(){ return typeof campRuneIsOn === 'function' && campRuneIsOn(); }
// 판에 있는 별들의 자리 — 「전체 보기」가 이것만 잰다(글자·후광은 안 센다)
function _runePts(){ const q = [];
  for(let i = 0; i < RUNE_SLOT_R.norm.length; i++){ const c = campRuneNPos(i); q.push({ x:c[0], y:c[1] }); }
  for(let i = 0; i < RUNE_SLOT_R.uniq.length; i++){ const c = campRuneUPos(i); q.push({ x:c[0], y:c[1] }); }
  return q; }
function campRuneFit(now){
  if(!_rnView) _rnView = svvNew();
  // 위는 제목 띠, 아래는 가방이 덮는다 — 그 사이에 맞춘다.
  //   ⭐ 덮는 크기를 **실제 높이에서 잰다** — CSS 를 고쳐도 저절로 따라온다(숫자를 두 곳에 두지 않는다).
  const mp = document.querySelector('#campRune .rnMap');
  const H = mp ? mp.getBoundingClientRect().height : 0;
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
  svvBind(svg, { v:_rnView, g:_runeG, lim:RUNE_ZLIM, alive:_runeAlive,
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
function _runeCell(kind, i, x, y, r, key, open, at, sel){
  const g = [], X = x.toFixed(1), Y = y.toFixed(1);
  if(!open){
    g.push('<polygon class="rnHx lk" points="' + _runeHexPts(x, y, r) + '"/>');
    g.push('<text class="rnLkT" x="' + X + '" y="' + (y + 2.5).toFixed(1) + '">R' + at + '</text>');
    return g.join(''); }
  if(!key){
    g.push('<polygon class="rnHx em" points="' + _runeHexPts(x, y, r) + '"/>');
    g.push('<text class="rnPl" x="' + X + '" y="' + (y + 4.5).toFixed(1) + '">+</text>'); }
  else {
    const pp = runeParse(key), c = (RUNE_GD[pp.gd] || {}).col || '#8b95a5', uq = pp.gd === 'uniq';
    g.push('<polygon class="rnHxOut" points="' + _runeHexPts(x, y, r + 3) + '" style="--rg:' + c + '"/>');
    g.push('<polygon class="rnHx on" points="' + _runeHexPts(x, y, r) + '" style="--rg:' + c + '"/>');
    if(uq) g.push('<polygon class="rnHxIn" points="' + _runeHexPts(x, y, r - 5.5) + '" style="--rg:' + c + '"/>');
    g.push('<text class="rnNm' + (uq ? ' uq' : '') + '" x="' + X + '" y="' + (y + 3).toFixed(1) + '"'
      + (uq ? ' style="fill:' + c + '"' : '') + '>' + pp.def.nm.replace('의 룬', '') + '</text>');
    g.push('<text class="rnVl" x="' + X + '" y="' + (y + r + 3.5).toFixed(1) + '" style="fill:' + c + '">'
      + runeValTx(key) + '</text>'); }
  if(sel) g.push('<polygon class="rnHxSel" points="' + _runeHexPts(x, y, r + 7.5) + '"/>');
  // 👆 누르는 면 — 맨 위에 투명하게. ⚠ onclick 을 달지 않는다: 손가락을 붙잡는 순간
  //   click 의 target 이 <svg> 로 바뀌어 안 온다. 엔진이 pointerdown 에서 이 표시를 읽는다.
  g.push('<circle class="rnHit" cx="' + X + '" cy="' + Y + '" r="' + (r + 3)
    + '" data-rk="' + kind + '" data-ri="' + i + '"/>');
  return g.join(''); }

function _runeMapSvg(){
  const rows = [], tbN = RUNE_SLOT_R.norm, tbU = RUNE_SLOT_R.uniq;
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
function _runeBagRows(){
  const out = [];
  for(const d of RUNE_LIST){
    const gds = (d.kind === 'uniq') ? ['uniq'] : RUNE_GRADES.slice().reverse();   // 상급부터
    for(const gd of gds){ const key = runeKey(d.id, gd), own = campRuneOwn(key);
      if(own > 0) out.push({ key, d, gd, own, free: campRuneFree(key) }); } }
  return out; }
function _runeBagHTML(){
  const rows = _runeBagRows();
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
  for(const r of rows){
    const c = (RUNE_GD[r.gd] || {}).col || '#8b95a5';
    const kind = (r.d.kind === 'uniq') ? 'uniq' : 'norm';
    const off = kindSel && kindSel !== kind;                 // 고른 칸에 못 끼우는 것은 물린다
    const full = r.free <= 0;
    g += '<button class="rnB' + (off ? ' off' : '') + (full ? ' full' : '') + '" type="button"'
      + ' style="--rg:' + c + '" onclick="campRuneBagTap(\'' + r.key + '\')">'
      + '<span data-ico="' + r.d.ico + '"></span>'
      + '<span class="rnBn">' + r.d.nm.replace('의 룬', '') + '</span>'
      + '<span class="rnBv">' + runeValTx(r.key) + '</span>'
      + '<span class="rnBc">' + r.free + '<i>/' + r.own + '</i></span></button>'; }
  if(!g) g = '<div class="rnEmp">가진 룬이 없습니다 — 룬 상점에서 삽니다</div>';
  return '<div class="rnBag"><div class="rnBagH">' + hd + '</div>'
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
  let h = '<div class="rnHead"><span>보유 젬</span><b>💎 '
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
          + '<b>' + (RUNE_GD[gd] || {}).tx + '</b><span>' + runeValTx(key) + '</span>'
          + '<u>💎 ' + cost + '</u></button>'; }
      const ownN = gds.reduce((a, gd) => a + campRuneOwn(runeKey(d.id, gd)), 0);
      h += '<div class="rnItem"><div class="rnIH"><span data-ico="' + d.ico + '"></span>'
        + '<span class="rnIN">' + d.nm + '</span><span class="rnID">' + d.de + '</span>'
        + '<span class="rnIO">' + ownN + '</span></div>'
        + '<div class="rnBuys">' + btns + '</div></div>'; }
    h += '</div>'; }
  return h; }
