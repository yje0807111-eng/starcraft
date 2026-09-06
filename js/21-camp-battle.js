/* ══════════════════════════════════════════════════════════════════════════
 * 21-camp-battle.js — 🏕 캠프 전투: **한 프레임을 캠프가 통째로 소유한다** (2026-08-31)
 *
 * ⭐ 왜 새로 쓰는가 — 지금까지 캠프는 오토배틀(`strikeStepUnits`)을 돌린 **뒤에**
 *   그 결과를 되돌리고 다시 미는 방식이었다. 그래서 **미는 주체가 셋**이었다:
 *     ① 오토배틀이 표적에게 직진시킨다
 *     ② campEngageStep 이 `u.x = u._sx` 로 그것을 **무르고** 제 목표로 다시 민다
 *     ③ campLeash 가 600 경계에서 **위치를 직접 잘라** 끌어당긴다
 *   셋이 매 프레임 싸우니 유닛이 덜덜 떨었다. 실측(`scripts/camp-trace.mjs` · 30초 · 11기):
 *
 *   |                        | 옛 방식 | ②를 끔 | 순수 오토배틀 |
 *   |------------------------|--------|-------|-------------|
 *   | 방향 뒤집힘 / 유닛      | 96.4회 | 40.1회 | **0.9회**   |
 *   | 사거리 안 비율          | 37.2%  | 15.7% | —           |
 *   | 실효(낼 수 있던 화력 중) | 0.50   | 0.32  | —           |
 *   | 목줄이 위치를 자른 횟수  | 5회    | 3760회 | —           |
 *
 *   ⛔ **간격·거리 상수로는 못 고친다** — 그렇게 네 번 시도해서 네 번 다 되돌렸다
 *     (닿으면 정지 / 뒤로 안 가기 / 목표 안쪽으로 / 전선 넓게).
 *   ⭐ 그래서 **미는 주체를 하나로** 만든다. 자리 제약을 「목표를 정할 때」 걸고,
 *     이동은 그 목표를 향해 **한 프레임에 딱 한 번**만 한다.
 *
 * ⛔ **`js/18-strike.js` 를 고치지 않는다** — 유즈맵 오토배틀과 공유한다.
 *   저기서 가져오는 것은 **부품**뿐이다: strikeHit(피해·실드·상성) · strikeMoveToward(한 걸음)
 *   · strikeReach · strikeNear/strikeGridBuild(격자) · strikeSeparate(겹침 회피)
 *   · strikeSkillTick(스킬 29종) · strikeHealStep(치유) · strikeAtkMul · strikeFx.
 *   ⭐ 통짜인 것은 `strikeStepUnits`(한 유닛의 한 프레임 흐름) 하나뿐이고, 이 파일이 그것을
 *     캠프용으로 다시 쓴 것이다. 상성·데미지 타입·스킬은 그대로라 RACES.md 측정이 살아 있다.
 *
 * ⚠ **이 파일은 19-camp.js 뒤에 실려야 한다**(전역 스코프 공유 · 태그 순서를 바꾸지 말 것).
 * ⚠ 값을 바꿨으면 `scripts/camp-trace.mjs` 로 **움직임을 보고** `scripts/camp-bench.mjs` 로
 *   **밸런스를 다시 재라.** 이동이 바뀌면 화력이 바뀌고, 화력이 바뀌면 라운드 시간이 바뀐다.
 * ══════════════════════════════════════════════════════════════════════════ */

// 🏛 건물 반경 — 전투 판정에만 쓴다(그림은 기지 격자가 그린다).
//   ⛔ 오토배틀의 신전 형상 함수(strikeTempleGap/Half/R)를 쓰지 않는다 — 저건 큰 사각형
//     신전용이고, 캠프 건물은 격자 한 칸짜리라 그 계산이 과하게 파고든다.
const CAMP_BLD_R = 46;
// 🏃 **던전 이동 속도 — 기지와 가운데에서 만난다** (2026-09-05 사용자 확정)
//   ⛔ 무엇이 문제였나 — 같은 레인저인데 기지와 던전의 속도가 달랐다.
//     실측(2026-09-05 · **순항** 구간, 화면 세로 비율/초): 기지 병력 **0.1738** · 던전 **0.0435** — **4배**.
//     ⚠ 처음엔 「1.5배」로 읽었는데 **틀린 측정**이었다 — 5초를 재는 동안 기지 유닛이 도착해
//       멈춰서 평균이 낮게 나왔다. 거리를 늘려 초마다 재야 순항 속도가 보인다.
//     두 곳이 아예 다른 식을 쓴다 — 기지는 `TECH_SPD_MUL`(16-build.js), 던전은 오토배틀의
//     `MOVE_MUL`(14-input-fx.js)로 나눈다.
//   ⭐ 사용자 판단은 「가운데」다 — 기지는 너무 빠르고 던전은 너무 느리다.
//     목표 0.1087 = 두 값의 중간. 기지 **병력**은 0.6 → **0.375**(TECH_SPD_MUL_U), 던전은 여기서 **×2.5**.
//     ⛔ 기지 **일꾼**은 0.6 그대로다 — 채취 왕복이 곧 수입이라 건드리면 경제가 조용히 깎인다.
//   ⛔ `MOVE_MUL` 을 고치지 말 것 — 유즈맵 오토배틀과 공유한다.
//   ⚠ 거는 자리는 **이동 호출의 dt** 다(CAMP_RETURN_K 와 같은 관용구). 유닛의 `spd` 는
//     실제 이동에 안 쓰이고, `strikeMoveToward` 안의 `_skSpdMul` 은 밖에서 못 만진다.
const CAMP_SPD_MUL = 2.5;

/* 🧱 ── 건물을 뚫고 가지 않는다 — **기지의 길찾기를 그대로 빌린다** (2026-09-05) ─────
 * ⛔ 무엇이 문제였나 — 전장에서 유닛을 미는 장애물은 `strikeTempleRects()`(18-strike.js) 뿐이고
 *   캠프에서 그것은 **본부 하나**다. 나머지 건물은 그냥 통과했다(사용자 신고).
 * ⛔ 먼저 「건물 전부를 원형 장애물로」 만들어 봤다가 **되돌렸다** — 국소 회피 + 밀어내기만으로는
 *   건물 뒤로 길이 안 나서 **아군이 갇혔다**(의무병이 아군에게서 1152 → 1387 로 멀어졌다).
 * ⭐ 그래서 **기지가 이미 쓰는 길찾기**(`_techFindPath` · 16-build.js)를 빌린다. 그것은
 *   **격자 좌표(0~1)** 에서 도는데, 전장 좌표는 `campW2G` 로 바로 그 격자가 된다 —
 *   그림·건물·유닛이 전부 같은 격자에 있으니 변환만 하면 된다. ⛔ 길찾기를 새로 짜지 말 것.
 * ⚠ **매 프레임 돌리지 않는다** — A* 가 건물 꼭짓점 전부를 훑는다. 막혔을 때만, 유닛마다
 *   `CAMP_PATH_T` 마다 다시 낸다. 안 막혔으면 곧장 간다(대부분의 프레임이 이쪽이다).
 * ⚠ 목표가 크게 움직이면(적을 쫓는 중) 길을 버린다 — 낡은 길을 붙들면 엉뚱한 데로 간다.
 */
const CAMP_PATH_T   = 0.5;    // 길을 다시 내는 주기(초)
const CAMP_PATH_ARR = 0.018;  // 경유점 도착 판정(격자)
const CAMP_PATH_MOVE= 0.06;   // 목표가 이만큼(격자) 움직이면 길을 버린다
function _campPathClear(u, gA, gB){
  if(typeof _techSegClear !== 'function') return true;
  return _techSegClear({ x:gA.gx, y:gA.gy, type:'unit', uid:(u.gm || u.id) }, gA.gx, gA.gy, gB.gx, gB.gy); }
function campMove(u, tx, ty, dt){
  if(typeof strikeMoveToward !== 'function') return;
  const step = dt * CAMP_SPD_MUL;
  const W = (CAMPB && CAMPB.world) || 4800;
  if(typeof campW2G !== 'function' || typeof campG2W !== 'function' || typeof _techFindPath !== 'function'){
    strikeMoveToward(u, tx, ty, step); return; }
  const gA = campW2G(u.x, u.y, W), gB = campW2G(tx, ty, W);
  // 들고 있던 길 — 목표가 그대로면 이어서 따라간다
  const wp = u._cpWp;
  if(wp && wp.length && u._cpGx != null
     && Math.hypot(gB.gx - u._cpGx, gB.gy - u._cpGy) <= CAMP_PATH_MOVE){
    while(wp.length && Math.hypot(wp[0].x - gA.gx, wp[0].y - gA.gy) <= CAMP_PATH_ARR) wp.shift();
    if(wp.length){ const p = campG2W(wp[0].x, wp[0].y, W);
      strikeMoveToward(u, p.x, p.y, step); return; }
  }
  u._cpWp = null;
  u._cpT = (u._cpT || 0) - dt;
  if(_campPathClear(u, gA, gB)){ strikeMoveToward(u, tx, ty, step); return; }   // 곧장 갈 수 있다
  if(u._cpT > 0){ strikeMoveToward(u, tx, ty, step); return; }                  // 아직 다시 낼 때가 아니다
  u._cpT = CAMP_PATH_T * (0.8 + Math.random() * 0.4);   // 유닛마다 위상을 흩어 한 프레임에 몰리지 않게
  let path = null;
  try{ path = _techFindPath({ x:gA.gx, y:gA.gy, type:'unit', uid:(u.gm || u.id) }, gB.gx, gB.gy); }catch(e){ path = null; }
  if(path && path.length > 1){ u._cpWp = path; u._cpGx = gB.gx; u._cpGy = gB.gy;
    const p = campG2W(path[0].x, path[0].y, W); strikeMoveToward(u, p.x, p.y, step); return; }
  strikeMoveToward(u, tx, ty, step); }
// ⏱ 목표를 붙들어 두는 시간 — 0 이면 매 프레임 다시 계산한다.
//   ⚠ 옛 CAMP_ENG_TICK(0.4)은 **되돌리기와 싸우던 시절**의 값이다. 미는 주체가 하나면
//     목표가 매 프레임 바뀌어도 서로 무르지 않으므로 붙들 이유가 줄어든다.
//     그래도 표적이 움직이면 목표도 따라 움직이니, 짧게 붙들어 미세 조정을 줄인다.
//   ⭐ 값은 궤적으로 확인하고 정할 것 — 추정하지 말 것.
const CAMP_GOAL_HOLD = 0.20;
// 🎯 도착 판정 — 목표에 이만큼 들어오면 「다 왔다」로 보고 멈춘다.
//   ⚠ 좁히면 제자리에서 미세 조정을 반복해 떤다. 넓히면 대열이 헐거워진다.
//   ⛔ 옛 CAMP_ENG_OK(90)은 되돌리기와 싸우느라 넓혀 둔 값이다(24 → 90 으로 키웠던 기록).
//   ⛔⛔ **고정값으로 두지 말 것** (2026-08-31 실측으로 잡은 함정).
//     목표는 표적에서 `사거리 × 0.85` 인데, 거기서 또 46px 못 미쳐 서면 표적까지가
//     `사거리×0.85 + 46` 이 된다. 사거리 70(기관총병)이면 **105 — 사거리 밖이다.**
//     그래서 짧은 유닛이 영영 못 때렸고 벤치가 D1R10 → D1R5 로 반토막 났다.
//   ⭐ 그러니 **사거리에 비례**시킨다. 여유는 어디까지나 사거리 안이어야 한다.
const CAMP_ARRIVE_MAX = 46;        // 사거리가 긴 유닛의 상한
const CAMP_ARRIVE_F   = 0.12;      // 사거리 대비 여유 비율 (0.85 + 0.12 < 1)
function campArriveR(u){
  return Math.max(6, Math.min(CAMP_ARRIVE_MAX, (u.rng || 0) * CAMP_ARRIVE_F)); }
// 💉 의무병이 본대를 따라갈 때의 도착 판정 — 치유 사거리(STK_HEAL_RNG 110) 안쪽으로 둔다.
//   ⚠ 일반 도착 판정(campArriveR)을 쓰면 안 된다 — 의무병은 사거리가 0 이라 6px 이 나와
//     제자리에서 미세 조정을 반복한다.
const CAMP_HEAL_FOLLOW = 90;
// 🖐 내 이동 명령의 **제자리걸음 상한**(초) — 이만큼 더 가까워지지 못하면 도착으로 본다.
//   동료가 밀어(strikeSeparate) 도착 반경 안에 못 드는 경우를 위한 것. 값은 실측 궤적으로 확인할 것.
const CAMP_ORDER_STALL = 0.8;
// 🖐 내 이동 명령의 **도착 반경**(px). ⚠ 실측(2026-09-05): 공용 이동 물리(stepUnitMove)가 관성으로 감속하고
//   진행도 창(_pgHold · 12px)이 걸려 유닛은 목표에서 **약 20** 에 선다(조용할 때 20 · 싸우던 중 19.6).
//   그래서 campArriveR(마린 ≈ 11)만 쓰면 늘 제자리걸음 상한(0.8초)을 기다려 도착한다 → 여기서 바로 끝낸다.
//   ⛔ CAMP_POST_R(45) 을 쓰지 말 것 — 그건 AI 복귀용이고 찍은 자리 45 앞에서 멈추던 것이 불만의 하나였다.
const CAMP_ORDER_ARRIVE = 24;

/* ── 목표 자리 ───────────────────────────────────────────────────────────
 * ⭐ **이 함수가 이 파일의 요점이다.** 「어디에 설 것인가」를 한 번에 정하고,
 *   자리 제약도 여기서 건다. 이 뒤로는 아무도 위치를 덮어쓰지 않는다.
 *
 *   표적 없음 → 자기 자리(_post)
 *   표적 있음 → 표적 주위 want 거리의 링/부채꼴 위 한 점, 단 _post 에서 CAMP_ENG_OUT 안
 *
 * ⚠ slot/cnt 는 **같은 표적을 문 아군 안에서의 번호**다. uid 로 정렬해 고정한다 —
 *   매 프레임 뒤바뀌면 자리가 흔들려 제자리걸음이 된다.
 */
function campGoalFor(u, tgt, slot, cnt){
  if(!tgt) return u._post ? { x:u._post.x, y:u._post.y } : { x:u.x, y:u.y };
  const rng = u.rng || 0;
  if(rng <= 0) return u._post ? { x:u._post.x, y:u._post.y } : { x:u.x, y:u.y };
  const want = rng * (u.melee ? CAMP_ENG_MELEE : CAMP_ENG_RANGED);
  // 기준 각도 = **자기 자리 쪽**. 아군은 아래(자기 진영)에서 올려다보므로 그 방향을 중심으로
  // 벌려야 적 뒤로 돌아가지 않는다.
  const home = u._post || u;
  const base = Math.atan2(home.y - tgt.y, home.x - tgt.x);
  let ang;
  if(u.melee){
    // ㉠ 근접 = 둘러싸기. 사방에서 붙어야 여럿이 동시에 때린다.
    ang = base + (slot - (cnt - 1) / 2) * (Math.PI * 2 / Math.max(1, cnt));
  } else {
    // ㉡ 원거리 = 부채꼴. 간격이 각도로 얼마인지 거리에서 역산한다(멀수록 좁은 각도로 충분).
    const step = Math.min(CAMP_ENG_ARC / Math.max(1, cnt),
      2 * Math.asin(Math.min(0.9, CAMP_ENG_GAP / (2 * Math.max(1, want)))));
    ang = base + (slot - (cnt - 1) / 2) * step;
  }
  let gx = tgt.x + Math.cos(ang) * want, gy = tgt.y + Math.sin(ang) * want;
  // 🚧 **자리에서 멀리 나가지 않는다** — 여기서 한 번만 자른다.
  //   ⛔ 예전에는 이동한 **뒤에** 목줄이 위치를 잘랐다. 그래서 「나가려 함 → 잘림」이
  //     초당 4회씩 반복돼 경계에서 덜덜 떨었다(실측 3760회/30초).
  //   ⭐ 목표를 먼저 자르면 애초에 나가지 않으니 자를 일이 없다.
  //   ⚠ 사거리가 안 닿으면 그냥 안 닿는 채로 둔다 — 그것이 「자리를 지킨다」의 뜻이다.
  //     적이 결국 자리 쪽으로 오므로 기다리면 만난다(적은 내 건물을 치러 내려온다).
  if(u._post){
    const lim = (typeof campEngageOut === 'function') ? campEngageOut(u) : CAMP_ENG_OUT;
    const ox = gx - u._post.x, oy = gy - u._post.y, od = Math.hypot(ox, oy);
    if(od > lim){ gx = u._post.x + ox / od * lim; gy = u._post.y + oy / od * lim; }
  }
  return { x:gx, y:gy };
}

/* ── 한 유닛의 표적 고르기 ────────────────────────────────────────────────
 * ⭐ **오토배틀의 검증된 로직을 그대로 옮겼다.** 여기는 아프지 않았다 —
 *   실측에서 표적 바뀜은 유닛당 1~2회뿐이었다(떨림은 96회). 손대지 않는다.
 *   ① 사거리 안에 때릴 수 있는 적이 있으면 그것(가장 가까운 것)
 *   ② 없으면 인지 범위 안 최근접을, 주기를 두고 재탐색(잦은 전환 방지)
 * ⚠ `load` 는 표적별 배정 인원이다 — 한 표적에 전군이 몰리는 것을 막는다.
 */
function _campPickTarget(u, foeUnits, load, dt){
  const canHit = (o) => { const k = o.gm || o.id;
    const air = (typeof FXLAB_AIR !== 'undefined' && FXLAB_AIR.has(k));
    return air ? u._atk.air : u._atk.gnd; };
  const d2 = (o) => { const dx = o.x - u.x, dy = o.y - u.y; return dx * dx + dy * dy; };
  let tgt = (typeof strikeFindUnit === 'function') ? strikeFindUnit(foeUnits, u.tgtUid) : null;
  // ① 사거리 안
  let inR = null;
  const c = u._inrObj;
  if(c && !c.dead && c._sd !== u._sd && canHit(c)){ const rc = strikeReach(u, c); if(d2(c) <= rc * rc) inR = c; }
  if(!inR) u._inrObj = null;
  u._inrT = (u._inrT || 0) - dt;
  if(!inR && u._inrT <= 0){
    u._inrT = STK_INR_T * (0.75 + Math.random() * 0.5);   // 유닛마다 위상을 흩어 한 프레임에 몰리지 않게
    let bd = Infinity;
    const fb = strikeNear(u.x, u.y, u.rng + 120, u._tgBuf || (u._tgBuf = []));
    for(let i = 0; i < fb.length; i++){ const e = fb[i];
      if(e._sd === u._sd || e.dead || !canHit(e)) continue;
      const dd = d2(e), rc = strikeReach(u, e);
      if(dd <= rc * rc && dd < bd){ bd = dd; inR = e; } }
    u._inrObj = inR; }
  if(inR) return inR;
  // ② 인지 범위 안 최근접
  const cap = (e) => Math.max(3, Math.floor(6.2832 * strikeReach(u, e) / Math.max(1, (u.size || 14) * 2 * STK_SEP)));
  const okT = (e) => ((load.get(e.uid) || 0) - (u.tgtUid === e.uid ? 1 : 0)) < cap(e);
  const AR = u.acq * STK_ACQ_FAR, AR2 = AR * AR;
  const keep = tgt && canHit(tgt) && okT(tgt) && d2(tgt) <= AR2;
  u._acqT = (u._acqT || 0) - dt;
  if(keep && u._acqT > 0) return tgt;
  u._acqT = 0.35 + Math.random() * 0.2;
  let bs = Infinity, best = null;
  const ab = strikeNear(u.x, u.y, AR, u._acBuf || (u._acBuf = []));
  for(let i = 0; i < ab.length; i++){ const e = ab[i];
    if(e._sd === u._sd || e.dead || !canHit(e) || !okT(e)) continue;
    const dd = d2(e); if(dd > AR2) continue;
    if(dd < bs){ bs = dd; best = e; } }
  if(best && tgt && best !== tgt && canHit(tgt) && bs > d2(tgt) * 0.8) best = tgt;   // 눈에 띄게 가깝지 않으면 유지
  // ⚠ 정원에 막혀 후보가 없으면 정원을 무시하고 한 번 더 찾는다 —
  //   정원은 몰림 방지용이지 「코앞의 적을 무시하라」는 뜻이 아니다.
  if(!best){ let b2 = Infinity, e2 = null;
    for(let i = 0; i < ab.length; i++){ const e = ab[i];
      if(e._sd === u._sd || e.dead || !canHit(e)) continue;
      const dd = d2(e); if(dd > AR2) continue;
      if(dd < b2){ b2 = dd; e2 = e; } }
    best = e2; }
  return best || (keep ? tgt : null);
}

// 💉 **치유할 대상이 있나** — 판정식은 `strikeHealStep`(18-strike.js §504) 의 ①과 같다.
//   ⚠ 같은 조건이 두 곳에 있다. 저 함수는 「찾아서 치유까지」 하고 값을 안 돌려주므로 미리 물어볼
//     길이 없어서 이렇게 뒀다. ⛔ 한쪽만 고치면 「따라가긴 하는데 치유는 안 하는」 상태가 된다.
function _campHealNeed(u, me){
  const S2 = STK_HEAL_SEEK * STK_HEAL_SEEK;
  for(const a of me.units){
    if(a === u || a.dead || a.hp >= a.maxHp) continue;
    if(typeof BIONIC !== 'undefined' && !BIONIC[a.gm || a.id]) continue;
    const dx = a.x - u.x, dy = a.y - u.y;
    if(dx * dx + dy * dy <= S2) return a; }
  return null; }
// ⚔ **지금 싸우고 있는 아군** 중 가장 가까운 것 — 의무병이 따라붙을 곳.
//   ⭐ 이게 있어야 「다친 사람은 없지만 전투 중」일 때 의무병이 집으로 가 버리지 않는다.
//   ⚠ 표적 번호만 보지 말 것 — 적이 죽어도 u.tgtUid 는 남는다(2026-08-28 에 이걸로 한 번 물렸다).
function _campBusyAlly(u, me){
  let best = null, bd = Infinity;
  for(const a of me.units){
    if(a === u || a.dead || !a.tgtUid) continue;
    if(typeof HEALER !== 'undefined' && HEALER[a.gm || a.id]) continue;
    if(!strikeFindUnit(CAMPB.ai.units, a.tgtUid)) continue;      // 죽은 표적은 「싸우는 중」이 아니다
    const dx = a.x - u.x, dy = a.y - u.y, d2 = dx * dx + dy * dy;
    if(d2 < bd){ bd = d2; best = a; } }
  return best; }

/* ── 사격 ────────────────────────────────────────────────────────────────
 * ⭐ 피해·실드·상성·광역·반격은 전부 오토배틀 부품 그대로다(strikeHit).
 *   ⛔ 여기에 피해식을 다시 적지 말 것 — 두 벌이 되면 반드시 어긋난다.
 */
function _campFireUnit(u, tgt, me, foe, dt, col){
  if(u.depT > 0){ u.depT -= dt; return false; }   // 🗿 전개 — 멈춘 뒤 dep 초가 지나야 쏜다
  u.cd -= dt;
  if(u.cd > 0) return false;
  u.cd = u.cdMax * ((typeof strikeFrzCdMul === 'function') ? strikeFrzCdMul(u, me) : 1);
  u.fireSeq = (u.fireSeq || 0) + 1;              // 3D 공격 모션
  const atk = u.dmg * strikeSkillAtkMul(u) * strikeAtkMul(me);
  strikeHit(tgt, atk, u);
  strikeFx(u, tgt.x, tgt.y, col);
  { const uAir = strikeIsAir(u);
    if(!tgt.tgtUid && (!tgt._atk || (uAir ? tgt._atk.air : tgt._atk.gnd))) tgt.tgtUid = u.uid;   // 반격
    tgt._acqT = 0; tgt._inrT = 0;                // 맞으면 즉시 재판단
    // 🩸 **사거리 밖에서 맞았으면 그 적까지 눈을 넓힌다**(2026-09-01 사용자 확정).
    //   맞고만 있지 않고 반격하러 들어간다. 넓어진 눈은 campAlertApply 가 CAMP_HIT_ACQ_S 초
    //   동안 지켜 주고, 그 사이 곁의 아군에게 전파되어 **줄줄이** 들어간다.
    //   ⚠ 양 진영이 이 함수를 지난다 — 적도 같은 규칙으로 반응한다(한쪽만 주면 상성이 틀어진다).
    if(typeof campAcqBase === 'function'){
      const hx = u.x - tgt.x, hy = u.y - tgt.y, hd = Math.hypot(hx, hy);
      if(hd > campAcqBase(tgt) && hd > (tgt._hitAcq || 0)){ tgt._hitAcq = hd; }
      if(hd > campAcqBase(tgt)) tgt._hitT = CAMP_HIT_ACQ_S; }
    if(typeof strikeAlert === 'function') strikeAlert(foe.units, u.uid, tgt.x, tgt.y, 420, uAir); }
  if(u.splash > 0){ const sr2 = u.splash * u.splash, sd = u.dmg * 0.6;   // 광역: 표적 주변에 60%
    for(const e of foe.units){ if(e === tgt || e.dead) continue;
      const ex = e.x - tgt.x, ey = e.y - tgt.y;
      if(ex * ex + ey * ey <= sr2){ strikeHit(e, sd, u);
        if(e.hp <= 0){ e.dead = true; me.kills = (me.kills || 0) + 1;
          me.gold += strikeKillGold(e); strikeFrzKill(me); } } } }
  if(tgt.hp <= 0){ tgt.dead = true; me.kills = (me.kills || 0) + 1;
    me.gold += strikeKillGold(tgt); strikeFrzKill(me); }
  return true;
}

/* ── 건물 사격 (적 전용) ──────────────────────────────────────────────────
 * ⭐ **배율을 여기서 곱한다.** 예전에는 프레임 전후 체력을 떠서 깎인 만큼을 ×40 으로
 *   되곱했다(campBldSnap/campBldAmp) — 18-strike.js 안에서 `front.hp -= …` 로 직접
 *   빠져 가로챌 훅이 없었기 때문이다. 이제 사격이 이 파일에 있으니 그 우회가 필요 없다.
 * ⚠ 배율의 근거는 HUNT_R1 §6-2-5 — 건물 체력이 유닛의 150배라 생긴 스케일 차이를 메운다.
 *   ⛔ 적 공격력(CAMP_FOE_ATK0)을 올려서 고치지 말 것 — 유닛 전투가 통째로 무너진다.
 */
function _campFireBld(u, b, me, dt, col){
  if(u.depT > 0){ u.depT -= dt; return false; }
  u.cd -= dt;
  if(u.cd > 0) return false;
  u.cd = u.cdMax;
  u.fireSeq = (u.fireSeq || 0) + 1;
  const sz = (typeof _sbTypeMulSize === 'function') ? _sbTypeMulSize({ id:u.id, gmodel:u.gm }, 'l') : 1;
  b.hp -= u.dmg * strikeSkillAtkMul(u) * strikeAtkMul(me) * sz * CAMP_FOE_BLD_MUL;
  strikeFx(u, b.x, b.y, col);
  if(b.hp <= 0){ b.hp = 0; b.dead = true; }
  return true;
}

/* ══ ⚔ 캠프의 한 프레임 ══════════════════════════════════════════════════
 * ⚠ **campWithStk 안에서 부른다** — 부품들이 전역 STK 를 보기 때문이다(캠프가 바꿔 끼운다).
 */
function campStepUnits(dt){
  const S = (typeof STK !== 'undefined') ? STK : null;
  if(!S || !CAMPB) return;
  strikeGridBuild();                                   // ⚡ 프레임 1회 격자 — 아래 질의가 재사용
  // 👹 적이 치러 갈 건물 — **앞에서부터 차례로** 하나씩(campFrontBld = y 가 가장 작은 것).
  //   ⚠ 유닛마다 최근접을 고르게 하면 무리가 갈라져 건물 여럿을 동시에 갉는다.
  //   ⛔ **프레임 처음에 한 번만 고르면 안 된다**(2026-08-31). 그 건물이 프레임 **중간에**
  //     부서지면, 뒤에 오는 적들이 이미 죽은 건물을 계속 때려 그만큼의 피해가 버려진다.
  //     ⭐ 그래서 부서진 것이 확인되면 그 자리에서 다음 건물로 갈아탄다(아래 nextBld).
  let frontBld = (typeof campFrontBld === 'function') ? campFrontBld() : null;
  const nextBld = function(){
    if(frontBld && !frontBld.dead && (frontBld.hp || 0) > 0) return frontBld;
    frontBld = (typeof campFrontBld === 'function') ? campFrontBld() : null;
    return frontBld; };
  for(const side of ['me', 'ai']){
    const me = S[side], foe = S[side === 'me' ? 'ai' : 'me'];
    const col = (side === 'me') ? '#7fd0ff' : '#ff8a96';
    if(typeof strikeFrzStep === 'function') strikeFrzStep(me, dt);   // 🐺 광폭화 감쇠

    /* ── 패스 ① 표적 선정 ────────────────────────────────────────────
     * ⭐ 이동을 여기서 하지 않는 것이 옛 구조와의 차이다. 표적을 다 정한 **뒤에** 묶어야
     *   「같은 적을 때리는 아군이 몇이고 나는 몇 번인가」를 알 수 있고, 그래야 자리를 나눈다.
     *   ⛔ 오토배틀처럼 한 패스에서 이동까지 하면 뒤 유닛이 앞 유닛의 낡은 수를 본다.  */
    const load = new Map();
    for(const x of me.units) if(x.tgtUid) load.set(x.tgtUid, (load.get(x.tgtUid) || 0) + 1);
    const act = [];                                    // 이번 프레임에 움직이거나 쏠 유닛
    for(const u of me.units){
      if(u.dead) continue;
      // 💥 2차 붕괴 대기 — 순차 폭발
      if(u._collapseT != null){ u._collapseT -= dt; u.moving = false; u._vx = 0; u._vy = 0;
        if(u._collapseT <= 0){ u.dead = true;
          if(!S.fx || !S.fx.shots){ S.fx = FX.store(); S.fx.hitK = STK_HIT_K; }
          FX.death(S.fx, u.x, u.y, { unitSize:(u.size || 14) * 1.7, color:'#ffca4a', parts:STK_DEATH_PARTS + 8 }); }
        continue; }
      if(u.wait > 0){ u.wait -= dt; u.moving = false; continue; }
      if(!u._atk) u._atk = (typeof _sbAtkMode === 'function')
        ? _sbAtkMode({ id:u.id, gmodel:u.gm }) : { air:true, gnd:true };   // 공격 가능 레이어
      // 💉 무공격 지원(의무병 등) — 표적을 안 잡는다. 다만 **여기서 끝내지 않는다.**
      //   ⛔ 예전엔 여기서 strikeHealStep 만 부르고 `continue` 했다. 그러면 의무병이
      //     **복귀 분기를 영영 안 탄다** — 오토배틀의 치유 경로에는 「자기 자리」라는 개념이
      //     없어서(다친 아군 → 없으면 가장 가까운 아군 → 110 안이면 정지) 전투가 끝나도
      //     낙오한 아군 옆에 붙어 선 채로 남는다.
      //     실측(60초): 의무병이 자리에서 평균 **572** 떨어져 있었고(마린 273 · 기관총병 422),
      //     적이 하나도 없는 조용한 프레임에서도 598 에 **그대로 멈춰** 있었다.
      //   ⭐ 그래서 패스 ② 로 넘겨 「치유 → 본대 따라가기 → 자기 자리」를 순서대로 태운다.
      // 💣 **매설 임무 중** — 표적을 안 잡고 그 자리로 간다(사용자 확정 2026-08-28).
      //   ⛔ 벙커 탑승과 같은 자리다. 이 위로 올리면 죽은 유닛도 걸어간다.
      if(u._mine){ if(typeof campMineTrip === 'function') campMineTrip(u, dt); continue; }
      // 🖐 **내 명령이 살아 있다 — 표적을 잡지 않는다**(SC 「이동」 · 2026-09-05 사용자 확정 · A안).
      //   ⛔ 여기서 _campPickTarget 을 타면 인지 범위의 적을 다음 프레임에 **다시 물어** 명령이 무시된다
      //     (실측: 뒤로 빼는 명령에 거리가 1012 → 1074 로 벌어지고 적이 죽을 때까지 안 왔다).
      //   ⚠ 의무병보다 **먼저** 본다 — 의무병도 명령을 받으면 치유를 멈추고 따라온다(기지와 같다).
      //   ⚠ 매설(_mine)은 그 위에 있다 — 그건 이미 「명령」이고 campMoveSel 이 지우지 않는다.
      if(side === 'me' && u._order){
        if(u.tgtUid){ load.set(u.tgtUid, Math.max(0, (load.get(u.tgtUid) || 0) - 1)); u.tgtUid = null; }
        u._btgt = null; act.push({ u, tgt:null, order:true }); continue; }
      if(typeof HEALER !== 'undefined' && HEALER[u.gm || u.id]){ act.push({ u, tgt:null, heal:true }); continue; }
      const prev = u.tgtUid;
      const tgt = _campPickTarget(u, foe.units, load, dt);
      u.tgtUid = tgt ? tgt.uid : null;
      if(prev !== u.tgtUid){                            // 배정 인원을 즉시 갱신
        if(prev && load.has(prev)) load.set(prev, Math.max(0, load.get(prev) - 1));
        if(u.tgtUid) load.set(u.tgtUid, (load.get(u.tgtUid) || 0) + 1); }
      act.push({ u, tgt }); }

    /* ── 표적별로 묶어 자리 번호를 준다 ──────────────────────────────
     * ⚠ 순서는 **uid 로 고정**한다 — 매 프레임 뒤바뀌면 자리가 흔들려 제자리걸음이 된다.  */
    const byTgt = new Map();
    for(const a of act) if(a.tgt){
      if(!byTgt.has(a.tgt.uid)) byTgt.set(a.tgt.uid, []);
      byTgt.get(a.tgt.uid).push(a.u); }
    const slotOf = new Map(), cntOf = new Map();
    for(const pair of byTgt){
      const list = pair[1];
      list.sort((a, b) => (a.uid < b.uid) ? -1 : (a.uid > b.uid) ? 1 : 0);
      list.forEach((x, i) => { slotOf.set(x.uid, i); cntOf.set(x.uid, list.length); }); }

    /* ── 패스 ② 자리 → 사격 또는 이동 (한 번만) ──────────────────────
     * ⭐ **이 블록이 유닛의 위치를 정하는 유일한 곳이다.** 뒤에서 무르거나 자르지 않는다.  */
    for(const a of act){
      const u = a.u, tgt = a.tgt;
      // 🖐 **내 명령 — 명령 지점으로만 간다**(SC 「이동」 · 2026-09-05 · A안). 벙커·치유·복귀보다 위다.
      //   · 도착 판정은 기지처럼 **작게**(campArriveR · 마린 ≈ 11) — ⛔ CAMP_POST_R(45) 을 쓰지 말 것,
      //     그건 AI 복귀용이라 찍은 자리 45 앞에서 멈춘다(실측 35 앞).
      //   · 붙어 선 동료가 밀어(strikeSeparate) 끝내 반경 안에 못 드는 경우가 있다 → 더 가까워지지
      //     않은 채 CAMP_ORDER_STALL 이 지나면 도착으로 본다(제자리걸음을 막는다).
      //   · 도착한 자리가 새 _post 다. _idleT 를 채워 두어 **복귀 대기(0.8초)를 안 탄다** — 그 자리에서
      //     바로 AI 가 표적을 잡는다.
      if(a.order){ const o = u._order, dx = o.x - u.x, dy = o.y - u.y, d = Math.hypot(dx, dy);
        if(d < (u._ordBest || Infinity) - 1){ u._ordBest = d; u._ordT = 0; } else u._ordT = (u._ordT || 0) + dt;
        if(d <= Math.max(campArriveR(u), CAMP_ORDER_ARRIVE) || u._ordT >= CAMP_ORDER_STALL){
          u._order = null; u._post = { x:o.x, y:o.y }; u._idleT = CAMP_RETURN_DELAY;
          u._goalX = null; u._goalTgt = null; u.moving = false; continue; }
        u._idleT = CAMP_RETURN_DELAY;
        campMove(u, o.x, o.y, dt); continue; }
      // 💉 의무병 — ① 치유 ② 싸우는 본대 따라가기 ③ 자기 자리. 순서가 곧 우선순위다.
      if(a.heal){
        if(_campHealNeed(u, me)){ strikeHealStep(u, me, dt); u._idleT = 0; continue; }   // ① 다친 아군이 있다
        const buddy = _campBusyAlly(u, me);
        if(buddy){                                                     // ② 싸우는 아군 곁으로
          u._idleT = 0;
          let gx = buddy.x, gy = buddy.y;
          if(u._post){ const ox = gx - u._post.x, oy = gy - u._post.y, od = Math.hypot(ox, oy);
            const lim = (typeof campEngageOut === 'function') ? campEngageOut(u) : CAMP_ENG_OUT;
            if(od > lim){ gx = u._post.x + ox / od * lim; gy = u._post.y + oy / od * lim; } }
          const dx = gx - u.x, dy = gy - u.y;
          if(dx * dx + dy * dy <= CAMP_HEAL_FOLLOW * CAMP_HEAL_FOLLOW){ u.moving = false; continue; }
          campMove(u, gx, gy, dt); continue; }
        // ③ 아무도 안 싸운다 → 아래 일반 복귀와 **같은 규칙**으로 자기 자리로 (지연 포함)
      }
      // 🧱 벙커에 탄 유닛은 움직이지 않는다 — 자리 고정·피해 전가는 campBunkerStep 이 맡는다.
      //   ⚠ 여기서 이동을 건너뛰어야 그 고정이 「덮어쓰기」가 아니라 「원래 안 움직임」이 된다.
      if(typeof campInBunker === 'function' && campInBunker(u)){
        u.moving = false;
        if(tgt){ const d = Math.hypot(tgt.x - u.x, tgt.y - u.y);
          if(d <= strikeReach(u, tgt)){ u.face = Math.atan2(tgt.x - u.x, tgt.y - u.y);
            _campFireUnit(u, tgt, me, foe, dt, col); } }
        continue; }

      if(tgt) u._idleT = 0;                              // ⏳ 싸우는 중 — 복귀 시계를 되감는다
      if(tgt){
        const d = Math.hypot(tgt.x - u.x, tgt.y - u.y);
        // 🗿 최소 사거리 — 이보다 가까우면 **쏠 수 없다.** 물러나 거리를 되찾는다.
        //   ⚠ 이것이 '페럴 > 콜로서스'의 핵심이다(RACES.md §1).
        if(u.minRng > 0 && d < u.minRng + (u.size || 14) * 0.95){
          campMove(u, u.x - (tgt.x - u.x), u.y - (tgt.y - u.y), dt);
          u.depT = u.dep; continue; }
        if(d <= strikeReach(u, tgt)){
          u.moving = false; u.face = Math.atan2(tgt.x - u.x, tgt.y - u.y);
          _campFireUnit(u, tgt, me, foe, dt, col);
          continue; }
      }

      // ── 갈 곳을 정한다
      let goal;
      if(tgt){
        // ⏱ 목표를 짧게 붙들어 미세 조정을 줄인다. ⛔ **이동을 몰아서 하지 않는다** —
        //   예전에 0.4초치를 한 프레임에 밀었다가 유닛이 203px 씩 튀었다(실측 236회).
        //   붙드는 것은 **목표**고, 이동은 늘 dt 만큼이다.
        u._goalT = (u._goalT || 0) - dt;
        if(u._goalT <= 0 || u._goalX == null || u._goalTgt !== u.tgtUid){
          const g = campGoalFor(u, tgt, slotOf.get(u.uid) | 0, cntOf.get(u.uid) || 1);
          u._goalX = g.x; u._goalY = g.y; u._goalTgt = u.tgtUid; u._goalT = CAMP_GOAL_HOLD; }
        goal = { x:u._goalX, y:u._goalY };
      } else if(side === 'ai'){
        // 👹 적은 표적이 없으면 **내 건물**을 치러 내려온다. 앞(y 가 작은) 건물부터.
        //   ⛔ 오토배틀의 신전 분기를 쓰지 않는다 — 캠프에는 신전 형상이 없다.
        u._goalX = null; u._goalTgt = null;
        const b = nextBld();                              // 앞(y 가 작은) 건물 — 부서졌으면 그 자리에서 다음 것으로
        if(!b){ u.moving = false; continue; }             // 부술 것이 없으면 선다
        const bd2 = Math.hypot(b.x - u.x, b.y - u.y) - CAMP_BLD_R;
        if(!u._atk.gnd){ u.moving = false; continue; }     // 지상을 못 때리면 건물도 못 때린다
        if(bd2 <= (u.rng || 0) + (u.size || 14) * 0.95){
          u.moving = false; u.face = Math.atan2(b.x - u.x, b.y - u.y);
          _campFireBld(u, b, me, dt, col);
          continue; }
        goal = { x:b.x, y:b.y };
      } else {
        // 🪧 아군은 표적이 없으면 **자기 자리로 돌아간다.**
        //   ⛔ 옛 구조는 여기서 「집결점」이라는 가짜 구조물을 목표로 줬다(campRallyPoint) —
        //     오토배틀이 표적 없는 유닛을 신전으로 보내는 것을 막으려는 우회였다.
        //     이 파일은 제 프레임을 소유하므로 그런 가짜가 필요 없다.
        u._goalX = null; u._goalTgt = null;
        if(!u._post) u._post = { x:u.x, y:u.y };
        // ⏳ **바로는 안 돌아온다** — 전투가 CAMP_RETURN_DELAY 동안 없어야 복귀를 건다
        //   (2026-08-31 사용자 확정). ⛔ 빼면 무리를 다 잡을 때마다 집에 갔다가 다음 무리에
        //   다시 나오기를 반복해 왔다 갔다 한다. 라운드 사이 간격이 4초라 특히 눈에 띈다.
        u._idleT = (u._idleT || 0) + dt;
        if(u._idleT < CAMP_RETURN_DELAY){ u.moving = false; continue; }
        const p = u._post, dx = p.x - u.x, dy = p.y - u.y;
        if(dx * dx + dy * dy <= CAMP_POST_R * CAMP_POST_R){ u.moving = false; continue; }
        // ⭐ **복귀는 빠르게**(2026-08-30 사용자 확정) — 싸우러 나갔다 오는 길이라 굼뜨면
        //   다음 무리가 올 때까지 자리를 못 잡는다. 배수 1.8 = 한 프레임 0.09초치라 안 튄다.
        campMove(u, p.x, p.y, dt * CAMP_RETURN_K);
        continue; }

      // ── 이동 — **한 프레임에 딱 한 번**
      const gx = goal.x - u.x, gy = goal.y - u.y;
      const ar = campArriveR(u);
      if(gx * gx + gy * gy <= ar * ar){ u.moving = false; continue; }
      campMove(u, goal.x, goal.y, dt); }

    // ── 죽은 유닛 정리 (오토배틀과 같은 규약)
    const dead = me.units.filter(u => u.dead);
    if(dead.length){
      if(!S.fx || !S.fx.shots){ S.fx = FX.store(); S.fx.hitK = STK_HIT_K; }
      for(const du of dead) FX.death(S.fx, du.x, du.y,
        { unitSize:(du.size || 14) * 0.5, color:du.color, parts:STK_DEATH_PARTS });
      if(window.M3D && M3D.dropModels){ try { M3D.dropModels(dead.map(u => u.uid)); } catch(e){} } }
    me.units = me.units.filter(u => !u.dead); }

  // ⛔ strikeSuddenDeath 를 부르지 않는다 — 오토배틀의 장기전 방지책이고, 캠프의 라운드는
  //   「적을 다 잡으면 끝」이라 해당이 없다.
  if(typeof strikeSkillTick === 'function') strikeSkillTick(dt);   // 🔮 마나·쿨다운·자동 시전
  // 🏢 **건물 시전** — strikeSkillTick 은 me.units 만 돈다(건물은 유닛이 아니다).
  //   값·주기는 js/19-camp.js 의 CAMP_BLD_SKILL 이 단일 소스다.
  if(typeof campBldSkillStep === 'function') campBldSkillStep(dt);
  if(typeof campMineStep === 'function') campMineStep(dt);   // 💣 심어 둔 지뢰(수명·밟힘)
  if(typeof campNukeStep === 'function') campNukeStep(dt);   // ☢ 유도 중인 핵(지연 뒤 폭발)
  if(typeof strikeSeparate === 'function') strikeSeparate();       // 겹침 회피
  if(S.fx && typeof FX !== 'undefined') FX.advance(S.fx, dt);
}
