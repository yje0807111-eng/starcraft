/* ══════════════════════════════════════════════════════════════════════════
 * 23-camp-dungeon.js — 🏰 **던전 = 적 기지** (2026-09-09 · GAME_DIRECTION §0-A)
 *
 * 옛 구조: 던전 안에 라운드 50개. 웨이브를 막으면 다음 라운드. 진행 지표는 **라운드 번호**.
 * 새 구조: 던전 = **적 기지**. 적이 몰려오고, 죽이면 돈이 되고, 성장해서 **적 건물을 하나씩 부순다.**
 *          진행 건물 **6채**를 다 부수면 다음 던전. ⛔ 라운드는 없다.
 *
 * ⭐ **왜 이 파일이 따로 있나** — `19-camp.js` 는 7,000줄이고 세 세션이 같이 만진다.
 *   새 코드를 전부 여기 두면 충돌이 「끼워 넣는 줄」로 줄어든다(REDESIGN_PLAN §5).
 *   ⛔ 여기에 **화면(DOM)을 만들지 말 것** — 그건 12-appshell·19-camp 의 몫이다. 여기는 규칙과 데이터다.
 *
 * ⚠ **이 파일의 수치는 아직 안 쟀다.** 전부 출발점이고, 벤치로 재서 BALANCE.md 에 적은 뒤 고친다.
 *   ⛔ 「그럴듯하니 맞겠지」로 굳히지 말 것 — 이 프로젝트에서 그렇게 네 번 빗나갔다.
 * ═══════════════════════════════════════════════════════════════════════ */

// ── 🏰 던전 표 ────────────────────────────────────────────────────────────
//   ⭐ **적 기지는 이 표에서 「만든다」**(campFoeBase). 나중에 「남의 캠프를 친다」(비동기 습격)를
//     넣을 때 그 사람의 배치를 같은 모양으로 넘기면 그대로 돈다 — 그래서 입력을 표 하나로 받는다.
//   ⚠ `k` 는 **`TECH_TREE[campTechRace(race)].buildings` 의 키**다. 종족 키가 두 벌이라는 것에 주의:
//     건물 표는 union·swarm·aetherial · 전투 엔진(STK_RACES)은 terran·zerg·protoss.
//   ⚠ 좌표는 **격자 비율**(gx·gy)이다. `campG2W` 가 전장 좌표로 바꾼다 — 내 건물과 같은 자를 쓴다.
//     적 기지는 격자 **위쪽**(gy 0.18~0.30 · CAMP_LANE_TOP=0.18 부터).
//   role: 'prog' 진행(6채 · 이걸 다 깨야 다음 던전) · 'side' 부수(6채 · 안 센다)
//   kind: 'prod' 생산(깨면 몰려오는 적이 준다) · 'tech' 연구(깨면 적이 약해진다)
//         'res'  자원(깨면 🎁 가스가 나온다) · 'main' 본진(나머지 다섯이 죽어야 열린다)
//         'tower' 방어탑(나를 쏜다 · 부술 수 있다) · 'deco' 치장(⛔ 표적이 아니다 · 체력 없음)
const CAMP_DG_STEPS = 6;                 // 던전 하나 = 진행 건물 6채 = 관문 6개
const CAMP_DG_MAX_N = 3;                 // 던전 셋(유니온 → 스웜 → 에테리얼) · 그 위는 무한층(단계 3)
const CAMP_DG = [
  null,                                  // 0 = 캠프(집) — 적이 없다
  // ── D1 유니온 기지 — 「건물 성격」을 가르친다. 기믹 없음(튜토리얼 · 미러전) ──
  { race:'union', name:'버려진 전초기지', lesson:'building',
    desc:'병영을 깨면 적이 줄고, 공학소를 깨면 적이 약해진다',
    bld:[
      { k:'command',  gx:.50, gy:.185, role:'prog', kind:'main' },
      { k:'barracks', gx:.30, gy:.215, role:'prog', kind:'prod' },
      { k:'engbay',   gx:.70, gy:.215, role:'prog', kind:'tech' },
      { k:'refinery', gx:.14, gy:.255, role:'prog', kind:'res'  },
      { k:'factory',  gx:.86, gy:.255, role:'prog', kind:'prod' },
      { k:'academy',  gx:.50, gy:.265, role:'prog', kind:'tech' },
      { k:'turret',   gx:.24, gy:.250, role:'side', kind:'tower' },
      { k:'turret',   gx:.76, gy:.250, role:'side', kind:'tower' },
      { k:'bunker',   gx:.50, gy:.300, role:'side', kind:'tower' },
      { k:'supply',   gx:.10, gy:.195, role:'side', kind:'deco' },
      { k:'supply',   gx:.90, gy:.195, role:'side', kind:'deco' },
      { k:'supply',   gx:.38, gy:.300, role:'side', kind:'deco' } ] },
  // ── D2 스웜 기지 — 「연구가 필요하다」. 기믹: **공중이 섞인다**(대공이 없으면 못 깬다) ──
  { race:'swarm', name:'감염된 둥지', lesson:'research', air:true,
    desc:'적이 단단하다 — 연구 없이는 못 깬다. 하늘에서도 온다',
    bld:[
      { k:'hatchery',   gx:.50, gy:.185, role:'prog', kind:'main' },
      { k:'pool',       gx:.30, gy:.215, role:'prog', kind:'prod' },
      { k:'evochamber', gx:.70, gy:.215, role:'prog', kind:'tech' },
      { k:'extractor',  gx:.14, gy:.255, role:'prog', kind:'res'  },
      { k:'hydraden',   gx:.86, gy:.255, role:'prog', kind:'prod' },
      { k:'lair',       gx:.50, gy:.265, role:'prog', kind:'tech' },
      { k:'sunken',     gx:.24, gy:.250, role:'side', kind:'tower' },
      { k:'sunken',     gx:.76, gy:.250, role:'side', kind:'tower' },
      { k:'spore',      gx:.50, gy:.300, role:'side', kind:'tower' },
      { k:'creep',      gx:.10, gy:.195, role:'side', kind:'deco' },
      { k:'creep',      gx:.90, gy:.195, role:'side', kind:'deco' },
      { k:'creep',      gx:.38, gy:.300, role:'side', kind:'deco' } ] },
  // ── D3 에테리얼 기지 — 「조합 + 최종」. 기믹: **동력탑이 에너지 타워에 전력을 준다** ──
  //   ⭐ 이 설계의 가장 좋은 한 칸이다 — `pylon` 은 **부수 건물인데 그걸 먼저 깨면 탑 셋이 멎는다.**
  //     「진행 6채만 세지만 부수 건물을 먼저 칠 이유가 있다」가 되어 「어느 걸 먼저」가 진짜 판단이 된다.
  //   ⛔ D1·D2 에는 넣지 않는다 — 배우기 전에 나오면 그냥 어렵기만 하다.
  { race:'aetherial', name:'잊혀진 회랑', lesson:'mix', powered:true,
    desc:'동력탑이 에너지 타워를 먹인다 — 무엇을 먼저 깰지가 갈린다',
    bld:[
      { k:'nexus',       gx:.50, gy:.185, role:'prog', kind:'main' },
      { k:'gateway',     gx:.30, gy:.215, role:'prog', kind:'prod' },
      { k:'forge',       gx:.70, gy:.215, role:'prog', kind:'tech' },
      { k:'assimilator', gx:.14, gy:.255, role:'prog', kind:'res'  },
      { k:'stargate',    gx:.86, gy:.255, role:'prog', kind:'prod' },
      { k:'cyber',       gx:.50, gy:.265, role:'prog', kind:'tech' },
      { k:'cannon',      gx:.24, gy:.250, role:'side', kind:'tower' },
      { k:'cannon',      gx:.76, gy:.250, role:'side', kind:'tower' },
      { k:'cannon',      gx:.50, gy:.300, role:'side', kind:'tower' },
      { k:'pylon',       gx:.10, gy:.195, role:'side', kind:'deco', power:true },
      { k:'pylon',       gx:.90, gy:.195, role:'side', kind:'deco', power:true },
      { k:'pylon',       gx:.38, gy:.300, role:'side', kind:'deco', power:true } ] },
];

// ── 🔢 값 — ⚠ 전부 출발점이다(안 쟀다) ────────────────────────────────────
//   ⭐ 기준은 **내 건물**이다: CAMP_BLD_HP(120) · 본부 CAMP_BASE_HP(750).
//     적 진행 건물이 그보다 얇으면 「깨는 맛」이 없고, 두꺼우면 한 채에 몇 분씩 걸린다.
const CAMP_FOE_BLD_HP0 = 60;             // 진행 건물 한 채의 밑값 · 여기에 난이도(campFoeDiff)가 곱해진다
const CAMP_FOE_BLD_K = { main:3.0, tech:1.0, prod:1.2, res:0.8, tower:1.5, deco:0 };   // deco 0 = 표적이 아니다
// 🗼 방어탑 — 사거리 안 내 유닛을 쏜다. ⚠ 적 유닛과 **같은 자**를 쓴다(CAMP_FOE_ATK0 = 0.05).
const CAMP_FOE_TOWER_DMG = 0.05 * 6;     // 탑 하나 = 적 여섯 몫의 화력
const CAMP_FOE_TOWER_RNG = 210;          // 전장 좌표 · 내 본부 밀어내는 원(210)과 같은 눈금
const CAMP_FOE_TOWER_CD  = 1.0;          // 발사 간격(초)
// 🌊 압박 — **살아 있는 prod 건물이 적을 보낸다.** 그래서 병영을 깨면 몰려오는 적이 준다.
//   ⛔ 「시간이 지나면 적이 세진다」로 만들지 말 것 — 방치형에서 그건 「안 보면 손해」다(§2-5).
const CAMP_FOE_SPAWN_S = 9;              // prod 한 채가 한 무리를 보내는 주기(초)
const CAMP_FOE_SPAWN_N = 3;              // 한 무리 마리 수
// 🎁 반격 웨이브 — 건물을 깨면 **즉시** 보복이 온다. 「깬 직후가 가장 위험하다」
const CAMP_COUNTER_N = { main:14, tech:6, prod:5, res:6, tower:4, deco:0 };
// 🎁 전리품 — 깬 건물 종류마다 다른 보상. ⭐ **이것이 「경제가 모든 것의 앞단」을 푸는 자리다**:
//   지금까지 가스는 정제소(=경제 지출) 하나에서만 나와서, 경제에 쓰면 연구까지 따라와 저울이 안 섰다.
//   res 건물이 가스를 내면 **가스가 전투 성과에서도** 나온다 → 경제=미네랄 / 전투=가스·연구로 축이 갈린다.
//   ⚠ 그래서 **CAMP_LOOT_GAS 가 이 게임의 저울을 정하는 값**이다. 적으면 지금과 같고 많으면 경제가 죽는다.
const CAMP_LOOT_GAS_S = 90;              // res 건물 = 지금 가스 수입의 몇 초치
const CAMP_LOOT_MIN_S = 45;              // prod 건물 = 지금 미네랄 수입의 몇 초치
const CAMP_LOOT_TECH_CUT = 0.5;          // tech 건물 = 진행 중 연구의 남은 시간을 이만큼 깎는다
const CAMP_LOOT_MAIN_S = 180;            // main = 둘 다 이만큼
// 🌫 안개 — 못 본 건물은 실루엣이다. ⚠ 엔진의 타일 안개(fogInit)는 **안 쓴다**(그건 유즈맵 격자용) —
//   건물 12채의 플래그면 충분하고, 시스템 둘을 겹치면 어느 쪽이 정답인지 알 수 없게 된다.
const CAMP_FOE_SEE_R = 1.25;             // 유닛 인지 거리의 이 배수 안이면 보인다
const CAMP_FOE_SEE_T = 0.35;             // 다시 보는 간격(초) — 매 프레임 12×N 을 돌지 않는다

// ── 📖 읽기 — 상태 ────────────────────────────────────────────────────────
// 이 던전에서 부순 **진행 건물** 수(0~6). ⭐ 옛 `campCleared()`(0~50)의 자리다.
function campBroken(){ const C = (typeof campState === 'function') ? campState() : null;
  if(!C || !((C.dg | 0) > 0)) return 0;
  return Math.max(0, Math.min(CAMP_DG_STEPS, C.broken | 0)); }
// 그 던전의 표. 무한층(단계 3)은 아직 없으므로 범위 밖은 null.
function campDgDef(dg){ const n = dg | 0; return (n > 0 && n < CAMP_DG.length) ? CAMP_DG[n] : null; }
function campDgName(dg){ const d = campDgDef(dg); return d ? d.name : '캠프'; }
// 그 종족의 건물 표에서 한 채를 찾는다 — 이름·아이콘을 거기서 가져온다(새 에셋을 만들지 않는다).
function campFoeBldDef(race, k){
  const tr = (typeof campTechRace === 'function') ? campTechRace(race) : race;
  const t = (typeof TECH_TREE !== 'undefined') ? TECH_TREE[tr] : null;
  if(!t || !t.buildings) return null;
  for(const b of t.buildings) if(b.k === k) return b;
  return null; }

// ── 🏗 적 기지를 세운다 ───────────────────────────────────────────────────
//   ⚠ `CAMPB._fbld` 에 넣는다 — 내 건물(`CAMPB._bld`)과 **같은 모양**이라야
//     `campStepUnits` 의 건물 분기가 그대로 쓴다(x·y·hp·max·maxHp·dead·eid).
//   ⭐ 부순 것은 **되살아나지 않는다**(C.foeDead) — 캠프에 다녀와도 그 던전 진행은 남는다.
//     ⛔ 단, **패배하면 비운다**(campFail) — 「그 던전 처음부터」가 확정된 규칙이다(§0-A).
function campFoeBase(dg){
  if(typeof CAMPB === 'undefined' || !CAMPB) return 0;
  const d = campDgDef(dg);
  if(!d){ CAMPB._fbld = []; return 0; }                    // 캠프(0)·범위 밖 = 적 기지가 없다
  const C = (typeof campState === 'function') ? campState() : null;
  const dead = (C && C.foeDead) || {};
  const W = CAMPB.world, out = [];
  const diff = (typeof campFoeDiff === 'function') ? campFoeDiff(dg, campBroken()) : 1;
  let i = 0;
  for(const q of d.bld){
    const eid = 'fb' + dg + '_' + (i++);                   // ⚠ 자리마다 고정된 id — 같은 던전이면 늘 같다
    const def = campFoeBldDef(d.race, q.k);
    const k = CAMP_FOE_BLD_K[q.kind] || 1;
    const hp = Math.max(1, Math.round(CAMP_FOE_BLD_HP0 * k * diff));
    const p = (typeof campG2W === 'function') ? campG2W(q.gx, q.gy, W) : { x:W * q.gx, y:W * q.gy };
    out.push({ x:p.x, y:p.y, eid:eid, bk:q.k, role:q.role, kind:q.kind,
      nm:(def && def.name) || q.k, ico:(def && def.ico) || '',
      power:!!q.power, foe:true,                           // foe:true = 「적 것」 표식(내 건물과 가른다)
      hp:hp, max:hp, maxHp:hp, dead:!!dead[eid],
      seen:false, _twT:0 });
  }
  CAMPB._fbld = out;
  // 👁 **앞줄은 처음부터 보인다.** ⛔ 전부 가리면 표적이 하나도 없어 병력이 집결점에 선 채
  //   영영 안 나아간다 — 안개가 진행을 막아 버린다(닭과 달걀). 내 쪽에서 가장 가까운
  //   세 채를 열어 주면 거기서부터 시야가 번져 나간다.
  { const cand = out.filter(function(b){ return b.kind !== 'deco'; })
                    .sort(function(a, b){ return b.y - a.y; });          // y 큰 것 = 내 쪽
    for(let j = 0; j < Math.min(3, cand.length); j++) cand[j].seen = true; }
  campFoeReveal(true);                                     // 그 밖에 이미 시야에 든 것도 바로 드러낸다
  return out.length; }

// 살아 있는 적 건물 — ⛔ **치장(deco)은 뺀다.** 표적이 아니고 체력도 없다(맞아도 안 부서진다).
function campFoeBldAlive(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld) return [];
  return CAMPB._fbld.filter(function(b){
    return b && !b.dead && (b.hp || 0) > 0 && b.kind !== 'deco'; }); }
// 남은 진행 건물 수
function campFoeProgLeft(){
  return campFoeBldAlive().filter(function(b){ return b.role === 'prog'; }).length; }
// 🗼 살아 있는 방어탑 — D3 은 **동력탑(power)이 하나라도 살아 있어야** 탑이 돈다(기믹)
function campFoeTowerOn(){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld) return [];
  const d = campDgDef((typeof campDgN === 'function') ? campDgN() : 0);
  if(d && d.powered){
    const pw = CAMPB._fbld.some(function(b){ return b && b.power && !b.dead; });
    if(!pw) return [];                                     // ⚡ 전력이 끊겼다 — 탑이 멎는다
  }
  return campFoeBldAlive().filter(function(b){ return b.kind === 'tower'; }); }

// 🎯 **내 병력의 다음 표적.** ⛔ 죽은 것을 절대 돌려주지 않는다 —
//   `strikeFrontStruct` 가 준 구조물이 dead 여도 이동은 안 막혀서(18-strike 의 `_toTemple` 에
//   dead 검사가 없다) 아군이 그 자리까지 행군해 버린다. 그 버그는 이미 한 번 겪었다.
function campFoeFront(){
  const live = campFoeBldAlive();
  if(!live.length) return null;
  const C = (typeof campState === 'function') ? campState() : null;
  // ① 플레이어가 고른 표적이 살아 있으면 그것
  if(C && C.foeTgt){ for(const b of live) if(b.eid === C.foeTgt && campFoeCanTarget(b)) return b; }
  // ② 아니면 **가장 앞줄**(y 가 큰 것 = 내 쪽) 중에서 고를 수 있는 것
  let best = null;
  for(const b of live){ if(!campFoeCanTarget(b)) continue;
    if(!best || b.y > best.y) best = b; }
  return best; }
// 🔒 본진은 **나머지 진행 건물이 다 죽어야** 열린다. 안개에 가린 것도 아직 표적이 아니다.
function campFoeCanTarget(b){
  if(!b || b.dead || b.kind === 'deco') return false;
  if(!b.seen) return false;
  if(b.kind === 'main') return campFoeProgLeft() <= 1;     // 자기 자신만 남았다
  return true; }

// ── 💥 건물을 깼다 — **유일한 입구** ──────────────────────────────────────
//   ⭐ 여기 하나에 재미 넷이 다 걸린다: 전리품 · 반격 웨이브 · 체크포인트 부활 · 진행/타이머.
//   ⚠ `campStepUnits` 의 건물 분기가 hp<=0 을 만들면 그 자리에서 이걸 부른다.
function campBreakBld(b){
  if(!b || b._broke) return false;
  b._broke = true; b.dead = true; b.hp = 0;
  const C = (typeof campState === 'function') ? campState() : null;
  if(C){ if(!C.foeDead) C.foeDead = {}; C.foeDead[b.eid] = 1; }
  campLoot(b);                                             // 🎁 전리품
  campCounterWave(b);                                      // 🎁 반격 — 깬 직후가 가장 위험하다
  campFoeRevealNear(b);                                    // 🌫 깬 자리 둘레가 드러난다
  if(b.role === 'prog' && C){
    C.broken = Math.min(CAMP_DG_STEPS, campBroken() + 1);
    if(!C.best) C.best = {};
    C.best[C.dg] = Math.max(C.best[C.dg] | 0, C.broken);    // 룬 칸·환생이 읽는 「최고 도달」
    // 🩹 **체크포인트 부활** — 옛 「라운드 시작」의 자리다. 누운 병력이 일어나고 체력이 찬다.
    if(typeof campRoundRevive === 'function') campRoundRevive();
    if(typeof campSay === 'function')
      campSay('🏚 ' + (b.nm || '건물') + ' 파괴 — ' + C.broken + '/' + CAMP_DG_STEPS, 'ui_ok');
  } else if(typeof campSay === 'function'){
    campSay('🧱 ' + (b.nm || '건물') + ' 파괴', 'ui_tab'); }
  if(C && C.foeTgt === b.eid) C.foeTgt = null;              // 고른 표적이 죽었으면 자동으로 되돌린다
  if(typeof campSave === 'function') campSave();
  return true; }

// 🎁 **전리품** — 깬 건물 종류에 따라 다른 보상.
//   ⛔ 지갑은 `campAddRes()` 한 입구다(19-camp) — 여기서 G.tech.credit 을 직접 만지지 말 것.
function campLoot(b){
  if(!b) return 0;
  const C = (typeof campState === 'function') ? campState() : null; if(!C) return 0;
  const rM = (C.rate || 0), rG = (C.rateGas || 0);          // 지금 초당 수입(미네랄·가스)
  let min = 0, gas = 0;
  if(b.kind === 'res')  gas = rG * CAMP_LOOT_GAS_S;
  else if(b.kind === 'prod') min = rM * CAMP_LOOT_MIN_S;
  else if(b.kind === 'main'){ min = rM * CAMP_LOOT_MAIN_S; gas = rG * CAMP_LOOT_MAIN_S; }
  else if(b.kind === 'tech'){                              // 🔬 진행 중인 연구의 남은 시간을 깎는다
    if(typeof G !== 'undefined' && G.tech && G.tech.ents){
      for(const e of G.tech.ents){ if(e && e._rj && e._rj.t > 0) e._rj.t *= (1 - CAMP_LOOT_TECH_CUT); } } }
  min = Math.floor(min); gas = Math.floor(gas);
  if((min > 0 || gas > 0) && typeof campAddRes === 'function') campAddRes(min, gas);
  return min + gas; }

// 🎁 **반격 웨이브** — 건물을 깨면 즉시 보복이 온다.
//   ⚠ 웨이브 큐(`CAMPB._wq`)를 그대로 쓴다 — 새 장치를 만들지 않는다.
function campCounterWave(b){
  if(typeof CAMPB === 'undefined' || !CAMPB || !b) return 0;
  const n = CAMP_COUNTER_N[b.kind] | 0; if(n <= 0) return 0;
  if(!CAMPB._wq) CAMPB._wq = [];
  CAMPB._wq.push(n);
  CAMPB._wqTot = (CAMPB._wqTot || 0) + n;
  CAMPB._wqT = 0;                                          // 곧바로 나온다
  return n; }

// ── 🌊 압박 — 살아 있는 prod 건물이 적을 보낸다 ──────────────────────────
//   ⭐ **prod 를 깨면 몰려오는 적이 준다**가 이 한 함수로 성립한다(§0-A 「건물마다 성격」).
function campFoeSpawnTick(dt){
  if(typeof CAMPB === 'undefined' || !CAMPB) return 0;
  const prod = campFoeBldAlive().filter(function(b){ return b.kind === 'prod' || b.kind === 'main'; });
  if(!prod.length){ CAMPB._fspT = 0; return 0; }
  CAMPB._fspT = (CAMPB._fspT || 0) - dt;
  if(CAMPB._fspT > 0) return 0;
  CAMPB._fspT = CAMP_FOE_SPAWN_S / prod.length;            // 건물이 많을수록 자주 온다
  if(!CAMPB._wq) CAMPB._wq = [];
  CAMPB._wq.push(CAMP_FOE_SPAWN_N);
  CAMPB._wqTot = (CAMPB._wqTot || 0) + CAMP_FOE_SPAWN_N;
  return CAMP_FOE_SPAWN_N; }

// ── 🗼 방어탑이 나를 쏜다 ────────────────────────────────────────────────
//   ⚠ 정지 사수라 이동이 없다 — `campStepUnits` 를 안 건드리고 여기서 직접 깎는다.
//   ⛔ 새 전투 규칙을 만들지 말 것: 피해는 그냥 hp 에서 뺀다(적 유닛과 같은 자 · CAMP_FOE_ATK0 눈금).
function campFoeTowerStep(dt){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB.me) return 0;
  const tw = campFoeTowerOn(); if(!tw.length) return 0;
  const mine = CAMPB.me.units; if(!mine || !mine.length) return 0;
  const R2 = CAMP_FOE_TOWER_RNG * CAMP_FOE_TOWER_RNG;
  let hits = 0;
  for(const t of tw){
    t._twT = (t._twT || 0) - dt;
    if(t._twT > 0) continue;
    let best = null, bd = Infinity;
    for(const u of mine){ if(u.dead) continue;
      const dx = u.x - t.x, dy = u.y - t.y, d2 = dx * dx + dy * dy;
      if(d2 <= R2 && d2 < bd){ bd = d2; best = u; } }
    if(!best) continue;
    t._twT = CAMP_FOE_TOWER_CD;
    const dm = CAMP_FOE_TOWER_DMG * ((typeof campFoeDiff === 'function')
      ? campFoeDiff((typeof campDgN === 'function') ? campDgN() : 1, campBroken()) : 1);
    if(best.sh > 0){ const s = Math.min(best.sh, dm); best.sh -= s;
      if(dm > s) best.hp -= (dm - s); }
    else best.hp -= dm;
    if(best.hp <= 0){ best.hp = 0; best.dead = true; }
    hits++; }
  return hits; }

// ── 🌫 안개 — 못 본 건물은 실루엣 ────────────────────────────────────────
//   ⭐ 드러나는 길은 둘이다: ① 내 유닛 시야 안 ② **이웃 진행 건물이 깨졌다**(안쪽이 드러난다).
//   ⚠ `dt` 를 받아 스스로 주기를 센다 — 매 프레임 12채×N기를 돌면 비싸다.
//     `now=true` 면 주기를 무시하고 지금 본다(진입·건물 파괴 직후).
function campFoeReveal(now, dt){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld) return 0;
  if(!now){ CAMPB._fsT = (CAMPB._fsT || 0) - (dt || 0);
    if(CAMPB._fsT > 0) return 0; }
  CAMPB._fsT = CAMP_FOE_SEE_T;
  const mine = (CAMPB.me && CAMPB.me.units) || [];
  let n = 0;
  for(const b of CAMPB._fbld){
    if(!b || b.seen) continue;
    if(b.dead){ b.seen = true; n++; continue; }             // 이미 깬 것은 당연히 보인다
    for(const u of mine){ if(u.dead) continue;
      const r = (u.acq || 300) * CAMP_FOE_SEE_R;
      const dx = b.x - u.x, dy = b.y - u.y;
      if(dx * dx + dy * dy <= r * r){ b.seen = true; n++; break; } } }
  return n; }

// 🌫 깬 건물 **둘레**가 드러난다 — 안쪽으로 길이 열리는 느낌.
//   ⭐ 이게 있어야 안개가 「가리는 장치」가 아니라 **「나아가면 열리는 장치」**가 된다.
const CAMP_FOE_SEE_NEAR = 170;           // 깬 건물에서 이 거리 안은 같이 드러난다(전장 좌표)
function campFoeRevealNear(b){
  if(typeof CAMPB === 'undefined' || !CAMPB || !CAMPB._fbld || !b) return 0;
  const R2 = CAMP_FOE_SEE_NEAR * CAMP_FOE_SEE_NEAR; let n = 0;
  for(const q of CAMPB._fbld){ if(!q || q.seen) continue;
    const dx = q.x - b.x, dy = q.y - b.y;
    if(dx * dx + dy * dy <= R2){ q.seen = true; n++; } }
  return n; }

// ── ⏱ 최고기록 타이머 ────────────────────────────────────────────────────
//   ⭐ 「지난 회차 3시간 → 이번 40분」. 같은 던전 셋을 회차마다 다시 해도 **나와의 경주**가 된다.
function campDgTimerTick(dt){
  const C = (typeof campState === 'function') ? campState() : null;
  const dg = (typeof campDgN === 'function') ? campDgN() : 0;
  if(!C || dg <= 0) return 0;
  if(!C.dgT) C.dgT = {};
  const t = C.dgT[dg] || (C.dgT[dg] = { cur:0, best:0 });
  t.cur = (t.cur || 0) + dt;
  return t.cur; }
// 던전을 완주했다 — 이번 기록을 최고기록과 견준다. 되돌아온 값이 **새 최고기록이면 true**.
function campDgTimerDone(dg){
  const C = (typeof campState === 'function') ? campState() : null; if(!C || !C.dgT) return false;
  const t = C.dgT[dg | 0]; if(!t) return false;
  const fresh = !t.best || t.cur < t.best;
  if(fresh) t.best = t.cur;
  t.cur = 0;
  return fresh; }
// 던전에 들어갈 때 이번 판 시계를 0 으로 (⚠ 최고기록은 안 건드린다)
function campDgTimerReset(dg){
  const C = (typeof campState === 'function') ? campState() : null; if(!C) return false;
  if(!C.dgT) C.dgT = {};
  const t = C.dgT[dg | 0] || (C.dgT[dg | 0] = { cur:0, best:0 });
  t.cur = 0; return true; }
