/* ============================================================================
 * 19-camp.js — 캠프(HOME 메인) — 건설 시스템을 빌려 쓰는 새 게임 모드 (2026-08-23)
 * ⛔ 로드 순서 = 파일명 번호 순. 16/17(건설)·18(오토배틀) 뒤에 와야 한다.
 * ========================================================================== */
// 🏕 캠프 — 종족을 고르면 본부와 광맥만 있고, 일꾼이 캐고, 건물을 지어 나간다.
//
// ⭐ **새로 만드는 게 아니라 이미 있는 것을 켜는 모듈이다.**
//    관리자 건설 탭(16-build.js)이 종족별 본부 배치 · 광맥 · 일꾼 왕복 채취 ·
//    격자 배치 · 건물별 생산 카드 · 유닛 이동을 전부 갖고 있다. 여기서는
//    그것을 **초기화하고 캠프 규칙으로 덮을** 뿐이다.
//
// ⛔ 16-build.js / 17-build-cards.js 를 고치지 말 것 — 관리자 탭과 오토배틀이 공유한다.
//    오토배틀(18-strike.js:188)이 똑같이 '빌려 쓰는' 쪽에 서 있다. 그 관계를 그대로 따른다.
//
// ⛔ **"초당 수급"이라는 별도 장치를 만들지 말 것.** 일꾼이 실제로 왕복해서 버는 것이 전부다.
//    초당으로 보여 준다면 그건 '번 돈 ÷ 걸린 초'인 표시값이다. 식을 두 벌 만들면 어긋난다.
//
// 옛 사냥터(08-hunt.js)는 **코드를 남긴 채 진입만 끊었다**(05-home.js). 되살리려면 거기 한 줄이다.

const CAMP_VER = 2;   // 1 → 2 : 단계 번호가 한 칸 내려갔다(옛 던전 1 = 지금 0단계 = 캠프)

// ══ 🗺 단계와 라운드 (2026-08-25) ═══════════════════════════════════════
//   **0단계 = 캠프.** 적이 없다. 누르고·뽑고·짓는 것을 위협 없이 익히는 구간이다.
//   **1단계부터 던전.** 여기서부터 적이 내려온다. 단계마다 50라운드.
//   ⭐ 화면은 하나뿐이다 — 단계가 바뀌어도 기지·광맥·일꾼은 그대로 있고 적만 달라진다.
//
//   설계 단일 소스: HUNT_R1.md §6-1 (미네랄 표) · §6-1-0-2 (클리어 기준) · §6-1-0-3 (탈락)
//   ⛔ 아래 표를 공식으로 바꾸지 말 것 — HUNT_R1.md §6-1-0-1-1 에 이유가 있다.
//      (옛 ×2^(단계-1) 공식은 단계 5부터 문턱에서 배율이 '내려갔다')
const CAMP_DG_MAX = 10;        // 던전 1~10
const CAMP_ROUND_MAX = 50;     // 던전 하나 = 50라운드
// [0]=캠프 · [1..10]=던전. base=진입 배율 · x=50라운드 다 깼을 때 몇 배가 되는가
const CAMP_MINE = [
  { base: 1,      x: 1 },      // 0단계 캠프 — 배율 고정, 라운드 없음
  { base: 1,      x: 2 }, { base: 3,      x: 2 }, { base: 10,     x: 2 },
  { base: 30,     x: 3 }, { base: 150,    x: 3 }, { base: 700,    x: 3 },
  { base: 3000,   x: 4 }, { base: 20000,  x: 4 }, { base: 120000, x: 4 },
  { base: 700000, x: 5 },
];
function campDgN(){ const C = campState(); return Math.max(0, Math.min(CAMP_DG_MAX, (C && C.dg) | 0)); }
// ⭐ 배율은 라운드를 **클리어해야** 붙는다 → 50라운드면 50번 붙는다(49번이 아니다).
//    그래서 증가량이 전부 딱 떨어진다: +0.02 · +0.06 · +0.2 · +1.2 · +6 · +28 · +180 · …
function campMineInc(dg){ const t = CAMP_MINE[Math.max(0, Math.min(CAMP_DG_MAX, dg | 0))];
  return t.base * (t.x - 1) / CAMP_ROUND_MAX; }
// 지금 미네랄 배율 — 탭과 일꾼 **양쪽에 똑같이** 걸린다(한쪽만 올리면 두 수입의 비율이 무너진다)
function campMineMul(){ const C = campState(); if(!C) return 1;
  const dg = campDgN(), t = CAMP_MINE[dg];
  return t.base + campCleared() * campMineInc(dg); }
function campCleared(){ const C = campState(); if(!C || !((C.dg | 0) > 0)) return 0;
  return Math.max(0, Math.min(CAMP_ROUND_MAX, C.cleared | 0)); }
// 지금 도전 중인 라운드 = 클리어한 수 + 1 (0단계에는 라운드가 없다)
function campRoundN(){ return (campDgN() > 0) ? campCleared() + 1 : 0; }

// ── 진입 · 클리어 · 탈락 ────────────────────────────────────────────────
// ⛔ 옛 이름 campDgMul 은 남겨 둔다 — 밖에서 부르는 곳이 생겼을 때 조용히 갈라지지 않게.
function campDgMul(dg){ return (dg == null) ? campMineMul() : CAMP_MINE[Math.max(0, Math.min(CAMP_DG_MAX, dg | 0))].base; }

// 캠프(0) → 던전으로 내려간다. 인자가 없으면 **최고 기록 다음 칸**이 아니라 던전 1부터.
function campEnterDungeon(dg){ const C = campState(); if(!C) return 0;
  const n = Math.max(1, Math.min(CAMP_DG_MAX, (dg | 0) || 1));
  C.dg = n; C.cleared = 0; campSave(); return n; }

// 라운드 하나를 깼다. 50을 채우면 **다음 던전으로 자동으로** 넘어간다.
//   ⚠ 전투(2단계)가 부를 입구다. 여기 말고 다른 곳에서 C.cleared 를 만지지 말 것.
function campClearRound(){ const C = campState(); if(!C || !((C.dg | 0) > 0)) return false;
  C.cleared = campCleared() + 1;
  if(!C.best) C.best = {};
  C.best[C.dg] = Math.max(C.best[C.dg] | 0, C.cleared);
  if(C.cleared >= CAMP_ROUND_MAX){
    if(C.dg < CAMP_DG_MAX){ C.dg++; C.cleared = 0; }   // 자동 이동 — 방치형이라 손이 안 가는 게 맞다
    else C.cleared = CAMP_ROUND_MAX;                    // 마지막 던전은 끝에 머문다
  }
  campSave(); return true; }

// 졌다 → **캠프(0단계)로 돌아간다.** 몇 라운드를 깼든 그 판은 끝이다.
//   ⭐ 1라운드도 못 깼으면 보너스 0 — 배율이 base 인 채로 끝난다(HUNT_R1 §6-1-0-3).
//   ⚠ best 는 지우지 않는다. 다시 내려갈 때의 목표가 된다.
function campFail(){ const C = campState(); if(!C) return 0;
  const was = { dg:C.dg | 0, cleared: campCleared() };
  C.dg = 0; C.cleared = 0; campSave(); return was; }

function campBest(dg){ const C = campState(); return (C && C.best && C.best[dg | 0]) | 0; }

// ── 상태 — hbHunt() 와 같은 지연 초기화 모양 ────────────────────────────
function campState(){
  const p = (typeof PROF === 'function') ? PROF() : null;
  if(!p) return null;
  if(!p.camp) p.camp = { ver:CAMP_VER, race:null, dg:0, cleared:0, best:{}, credit:0, energy:0,
    built:{}, addon:{}, units:{}, research:{}, sup:0, supCap:0, eseq:1, ents:[], minerals:[],
    upg:{}, rate:0, leftAt:0, tapped:0 };   // dg=0 은 캠프 · upg=캠프 업그레이드 · rate=실측 수급속도 · leftAt=나간 시각
  // 🔄 ver1 → ver2 : 단계 번호가 한 칸 내려갔다. 옛 「던전 1(적 없음)」이 지금의 0단계(캠프)다.
  //    ⛔ 그냥 두면 옛 저장이 곧장 던전 1(적이 나오는 곳)에 서 있게 된다.
  if((p.camp.ver | 0) < 2){ p.camp.dg = Math.max(0, (p.camp.dg | 0) - 1); p.camp.ver = CAMP_VER; }
  if(typeof p.camp.cleared !== 'number') p.camp.cleared = 0;
  if(!p.camp.best || typeof p.camp.best !== 'object') p.camp.best = {};
  return p.camp;
}
function campHasRace(){ const C = campState(); return !!(C && C.race); }
// STK_RACES 는 기존 3종족에 옛 별칭(terran/zerg/protoss)을 쓰고 TECH_TREE 는 union/swarm/… 을 쓴다.
// 변환은 오토배틀이 이미 갖고 있다 — 표를 다시 적지 않는다.
function campTechRace(r){ return (typeof stkTechRace === 'function') ? stkTechRace(r) : r; }

// ── 광맥을 2열 × 3행으로 다시 깐다 ──────────────────────────────────────
// techUIInit 은 가로 1줄 6개로 깐다(16-build.js:16~18). 캠프는 뭉쳐 놓는다 —
// 한 줄이면 일꾼이 옆으로 늘어서서 답답하다.
// ⛔ 16-build.js 를 고치지 않는다. 오토배틀이 `G.tech.minerals=[]` 로 비우듯 여기서 다시 채운다.
// 좌표식은 원본과 같은 것을 쓴다(가스 구역 c0 기준 왼쪽 오프셋).
// ⭐ **세로 화면의 아래쪽이 손이 닿는 곳이다**(GAME_DIRECTION §2-4 「엄지 도달 범위」).
//   적은 위에서 내려오고, 지킬 본부는 그 아래, 광맥은 **본부보다 더 뒤(최하단)** 에 둔다.
//   ⛔ 건설 탭 기본 자리(가스 구역 왼쪽·위쪽)를 그대로 쓰지 말 것 — 관리자용 배치라
//     가장 자주 누를 광맥이 화면 위쪽 절반으로 가서 엄지가 안 닿는다(실측 sy 0.37).
//
//        위    ← 적이 가로 전체에서 내려온다
//        │
//        ├── 교전 · 방어선(플레이어가 터렛·벙커를 짓는 곳)
//        │
//        ├── 본부      CAMP_ROW_BASE
//        └── 광맥 2×3  CAMP_ROW_MINE   ← 엄지 범위
const CAMP_MINE_COLS = 3, CAMP_MINE_ROWS = 2;   // 가로로 넓게 — 세로 화면에서 아래를 덜 먹는다
// ⚠ 이 둘이 **기지가 하단 시트에 가리지 않게** 하는 유일한 장치다.
//   맵은 화면 전체를 쓰고 시트가 그 위를 덮으므로(css/30-home.css 캠프 블록), 시트 상단보다
//   위에 앉혀야 한다. 시트 상단 = 화면 세로의 0.77 지점(실측: 맵 701px 중 시트 161px + 네비).
//   ⛔ 값을 바꿨으면 **가장 아래 요소인 가스**(광맥 행 + h-0.55)까지 재서 0.74 아래로
//     내려가지 않는지 확인할 것 — 광맥만 보고 정했다가 가스가 시트에 물렸다.
const CAMP_ROW_BASE = 0.61;   // 본부 중심(격자 세로 비율 0~1)
const CAMP_ROW_MINE = 0.70;   // 광맥 첫 줄
// ⚠ 행 번호는 **여기 한 곳에서만** 만든다. 광맥과 가스가 각자 round(rows*f) 를 하면
//   호출 시점에 _techRows() 가 달라져 서로 다른 행에 앉는다(실측: 가스가 광맥보다 5행 위였다).
function campRow(f){ return Math.max(0, Math.round(_techRows() * f)); }
function campRowY(f){ return techY0() + campRow(f) * _techCH(); }
function campMineCol(){ return Math.round(techCols() / 2 - CAMP_MINE_COLS / 2); }
function campLayMinerals(){
  if(typeof G === 'undefined' || !G.tech) return;
  const cw = _techCW(), ch = _techCH();
  const x0 = TECH_GRID.x0 + campMineCol() * cw;   // 가로 가운데(가스와 같은 문으로 계산)
  const y0 = campRowY(CAMP_ROW_MINE);
  G.tech.minerals = [];
  for(let r = 0; r < CAMP_MINE_ROWS; r++) for(let c = 0; c < CAMP_MINE_COLS; c++)
    G.tech.minerals.push({ eid:G.tech.eseq++,
      x: x0 + c * cw, y: y0 + r * ch,
      amount: TECH_MINE_START, owner:null, miner:null });
}
// 본부·일꾼을 하단으로 옮긴다 — techUIInit 은 관리자 자리(0.5, 0.3)에 놓는다.
// ⛔ 16-build.js 를 고치지 않는다. 놓인 것을 캠프가 옮긴다(오토배틀의 strikeTechLayout 과 같은 결).
// ── ⛽ 가스 구역 ────────────────────────────────────────────────────────
// ⚠ **가스 광산은 구조적으로 하나뿐이다.** 정제소 배치 검사가 좌표를 정확히 비교한다:
//     if(_b&&_b.gas){ if(!(s.c0===TECH_GAS.c0 && s.r0===TECH_GAS.r0)) return false; }
//                                                    (17-build-cards.js:857)
//   둘로 늘리려면 이 검사 · _techInGasZone · _techGasOverlap · 렌더를 전부 고쳐야 하는데
//   그 파일은 관리자 탭·오토배틀과 공유한다. ⛔ 여기서 손대지 않는다.
// TECH_GAS 는 const 지만 **객체라 속성은 바뀐다.** 캠프가 자리만 옮겨 쓰고 나갈 때 되돌린다
//   (#cvMarine 을 빌리고 돌려주는 것과 같은 규칙 — 안 되돌리면 관리자 탭의 가스 자리가 어긋난다).
let _campGasHome = null;
function campLayGas(){
  if(typeof TECH_GAS === 'undefined') return;
  if(!_campGasHome) _campGasHome = { c0:TECH_GAS.c0, r0:TECH_GAS.r0 };
  TECH_GAS.c0 = Math.max(0, campMineCol() - TECH_GAS.w - 1);   // 광맥 바로 왼쪽
  TECH_GAS.r0 = campRow(CAMP_ROW_MINE);                       // 광맥과 **같은 행**
  CAMP_GAS2.c0 = Math.min(techCols() - TECH_GAS.w, campMineCol() + CAMP_MINE_COLS + 1);   // 광맥 바로 오른쪽
  CAMP_GAS2.r0 = TECH_GAS.r0;                                 // 같은 행
  campPatchGas(); campPatchSync(); campPatchZoom();
}
function campRestoreGas(){
  if(!_campGasHome || typeof TECH_GAS === 'undefined') return;
  TECH_GAS.c0 = _campGasHome.c0; TECH_GAS.r0 = _campGasHome.r0; _campGasHome = null;
}

// ── ⛽⛽ 가스 광산을 **둘**로 (광맥 좌우) ────────────────────────────────
// 건설 탭은 가스 구역을 **전역 하나**(TECH_GAS)로 본다. 배치·침범·채취 판정 셋이 전부
// 그 좌표 하나를 비교한다. 그 파일들은 관리자 탭·오토배틀과 공유하므로 고칠 수 없다.
//
// ⭐ **로직을 재현하지 않는다.** 원본 함수를 그대로 호출하되, 실패하면 **TECH_GAS 좌표를
//    오른쪽 자리로 잠시 바꿔 한 번 더 묻는다.** 두 자리 중 하나라도 통과하면 통과다.
//    이러면 원본이 나중에 바뀌어도 규칙이 저절로 따라온다(복사한 로직은 낡는다).
// ⛔ 원복을 반드시 한다 — TECH_GAS 는 공용 객체다.
const CAMP_GAS2 = { c0:0, r0:0 };      // 오른쪽 자리(campLayGas 가 채운다)
let _campGasPatched = null;
function _campWithGas2(fn, args){
  const sc = TECH_GAS.c0, sr = TECH_GAS.r0;
  TECH_GAS.c0 = CAMP_GAS2.c0; TECH_GAS.r0 = CAMP_GAS2.r0;
  try { return fn.apply(null, args); } finally { TECH_GAS.c0 = sc; TECH_GAS.r0 = sr; }
}
function campPatchGas(){
  if(_campGasPatched || typeof window === 'undefined') return;
  const P = {};
  for(const name of ['techArmValid', '_techGasOverlap', '_techInGasZone']){
    const orig = window[name];
    if(typeof orig !== 'function') continue;
    P[name] = orig;
    window[name] = function(){
      const r = orig.apply(this, arguments);
      if(r) return r;                                   // 왼쪽 자리에서 이미 통과
      if(!_campOn) return r;                            // 캠프 밖이면 원본 그대로
      return _campWithGas2(orig, arguments);            // 오른쪽 자리로 한 번 더
    };
  }
  _campGasPatched = P;
}
function campUnpatchGas(){
  if(!_campGasPatched) return;
  for(const k in _campGasPatched) window[k] = _campGasPatched[k];
  _campGasPatched = null;
  campUnpatchSync();
}

// 오른쪽 가스의 **3D 모델**도 왼쪽과 같게 세운다.
// renderBuildTab 은 가스 노드를 딱 하나만 목록에 넣는다:
//   list.push({uid:'gz_res', id:'res_en', x:…, y:…})      (14-input-fx.js:951)
// 그 list 는 지역 변수라 손댈 수 없지만, **M3D.syncBuild 를 감싸면 목록이 넘어올 때
// 하나 더 얹을 수 있다.** 좌표식은 원본과 같은 것을 쓴다(h-0.55 = 발판 아래쪽에 세운다).
let _campSyncOrig = null;
function campPatchSync(){
  if(_campSyncOrig || !window.M3D || typeof M3D.syncBuild !== 'function') return;
  _campSyncOrig = M3D.syncBuild;
  M3D.syncBuild = function(list, W, H, dt, zoom){
    try{
      if(_campOn && Array.isArray(list) && !campGas2Built()){
        const v = techView();
        const gx = TECH_GRID.x0 + (CAMP_GAS2.c0 + TECH_GAS.w / 2) * _techCW();
        const gy = techY0() + (CAMP_GAS2.r0 + TECH_GAS.h - 0.55) * _techCH();
        // ⚠ fitW 를 빼먹으면 왼쪽 광산과 크기가 달라진다(원본은 TECH_GAS.w × 셀폭px 로 준다).
        //   격자가 촘촘할수록 차이가 커진다 — 캠프는 48칸이라 눈에 띈다.
        const cwpx = _techCW() * W * v.zoom;
        list.push({ uid:'gz_res2', id:'res_en', x:(gx - v.x) * v.zoom + 0.5, y:(gy - v.y) * v.zoom + 0.5,
          face:Math.PI, fitW:TECH_GAS.w * cwpx });
      }
      // 💎 미네랄·운반 청크는 **셀 크기를 안 따른다.** renderBuildTab 이 이 둘만 fitW·scl 없이
      //   넣기 때문이다(건물=fitW, 유닛=scl×_cellK, 가스=fitW). 관리자 20칸에서는 셀이 커서
      //   티가 안 나지만, 캠프는 격자를 48칸으로 촘촘히 쓰므로 미네랄만 1.6배 크게 남아
      //   광맥 여섯이 서로 뭉개져 보인다(실측: 광맥 3열이 화면 폭의 5.5%인데 모델은 그보다 컸다).
      // ⛔ 14-input-fx.js 를 고치지 않는다 — 관리자 탭·오토배틀이 같은 함수를 쓴다.
      //   유닛과 **같은 계수**(_cellK)를 여기서 얹어 셀 축소를 똑같이 따르게 한다.
      if(_campOn && Array.isArray(list)){
        const k = campCellK();
        if(k < 0.999) for(const it of list){
          if(!it || it.scl != null || it.fitW != null) continue;
          if(typeof it.uid === 'string' && (it.uid.indexOf('mn_') === 0 || it.uid.indexOf('carry_') === 0)) it.scl = k;
        }
      }
    }catch(_e){}
    return _campSyncOrig.call(this, list, W, H, dt, zoom);
  };
}
function campUnpatchSync(){ if(_campSyncOrig && window.M3D){ M3D.syncBuild = _campSyncOrig; _campSyncOrig = null; } }
// 오른쪽 자리에 이미 정제소가 섰나 — 섰으면 광산 노드를 지운다(왼쪽과 같은 규칙)
function campGas2Built(){
  if(typeof G === 'undefined' || !G.tech) return false;
  return (G.tech.ents || []).some(function(e){
    if(e.type !== 'bldg') return false;
    const b = techGetBldg(G.tech.race, e.bk); if(!b || !b.gas) return false;
    const f = _techFoot(G.tech.race, e.bk), sn = _techSnap(e.x, e.y, f.w, f.h);
    return sn.c0 === CAMP_GAS2.c0 && sn.r0 === CAMP_GAS2.r0; });
}
// 오른쪽 가스 구역을 그린다 — techMapRender 가 .bmap 안을 통째로 갈아 끼우므로
// **그 밖(#cstMain 직계)** 에 두고 매 프레임 자리만 갱신한다(안 그러면 매번 지워진다).
function campDrawGas2(){
  const host = document.getElementById('cstMain'); if(!host || !_campOn) return;
  let el = document.getElementById('campGas2');
  if(!el){ el = document.createElement('div'); el.id = 'campGas2';
    el.innerHTML = '<span class="gzLbl">에너지 광산</span>';   // 왼쪽 구역과 같은 라벨
    host.appendChild(el); }
  // 왼쪽이 3D 로 그려지면(.d3) 오른쪽도 같은 클래스를 달아 겉모습을 맞춘다
  const left = document.querySelector('#cstMain .bmap .bGasZone');
  el.className = left ? left.className.replace(/hot/, '').trim() : 'bGasZone';
  if(campGas2Built()){ el.style.display = 'none'; el._campSig = null; return; }   // 서명을 비워 다시 나타날 때 갱신되게
  const cw = _techCW(), ch = _techCH();
  const tl = _techW2S(TECH_GRID.x0 + CAMP_GAS2.c0 * cw, techY0() + CAMP_GAS2.r0 * ch);
  const br = _techW2S(TECH_GRID.x0 + (CAMP_GAS2.c0 + TECH_GAS.w) * cw, techY0() + (CAMP_GAS2.r0 + TECH_GAS.h) * ch);
  // ⚡ 값이 그대로면 손대지 않는다 — 스타일을 쓰면 레이아웃이 무효화돼, 뒤따르는 rect 읽기가
  //   전부 강제 동기 레이아웃이 된다. 화면이 멈춰 있는 동안(대부분의 프레임) 쓸 일이 없다.
  const sig = tl.x.toFixed(4) + ',' + tl.y.toFixed(4) + ',' + (br.x - tl.x).toFixed(4) + ',' + (br.y - tl.y).toFixed(4);
  if(el._campSig === sig) return;
  el._campSig = sig;
  el.style.display = ''; el.style.position = 'absolute';
  el.style.left = (tl.x * 100).toFixed(2) + '%'; el.style.top = (tl.y * 100).toFixed(2) + '%';
  el.style.width = ((br.x - tl.x) * 100).toFixed(2) + '%'; el.style.height = ((br.y - tl.y) * 100).toFixed(2) + '%';
}
function campLayBase(){
  if(typeof G === 'undefined' || !G.tech) return;
  const b = (G.tech.ents || []).find(function(e){ return e.type === 'bldg'; });
  if(b && typeof _techFoot === 'function' && typeof _techSnap === 'function'){
    const f = _techFoot(G.tech.race, b.bk);
    const sn = _techSnap(0.5, campRowY(CAMP_ROW_BASE), f.w, f.h);   // 격자에 스냅해야 배치 검사와 어긋나지 않는다
    b.x = sn.cx; b.y = sn.cy;
  }
  const w = (G.tech.ents || []).find(function(e){ return e.type === 'worker'; });
  if(w){ w.x = 0.5 - _techCW() * 2; w.y = campRowY(CAMP_ROW_MINE) - _techCH();   // 광맥 바로 위에서 시작
    w.tx = null; w.ty = null; }
}

// ── 저장 ────────────────────────────────────────────────────────────────
// ⚠ ents 에는 런타임 전용 필드가 붙는다(_rally · _lifted · _cKind · _gEid …).
//   채취 왕복 상태·3D 표시 상태 같은 것들이라 저장하면 안 된다 —
//   저장이 부풀고, 복원할 때 '들고 있던 자원' 같은 유령 상태가 되살아난다.
function campClean(o){ const out = {}; for(const k in o){ if(k.charAt(0) === '_') continue; out[k] = o[k]; } return out; }
function campSave(){
  const C = campState(); if(!C || typeof G === 'undefined' || !G.tech) return;
  const T = G.tech;
  // ⛔ C.race 를 T.race 로 덮지 말 것 — **둘은 다른 이름 공간이다.**
  //   C.race = STK 키('terran' · 사용자가 고른 것) · T.race = TECH_TREE 키('union').
  //   덮으면 STK_RACES['union'] 이 없어서 종족 이름·색 표시가 통째로 깨진다(실제로 그랬다).
  //   종족은 campPickRace() 가 한 번 정하고 그 뒤로 아무도 손대지 않는다.
  C.credit = Math.floor(T.credit || 0); C.energy = Math.floor(T.energy || 0);
  C.built = campClean(T.built); C.addon = campClean(T.addon);
  C.units = campClean(T.units); C.research = campClean(T.research);
  C.sup = T.sup || 0; C.supCap = T.supCap || 0; C.eseq = T.eseq || 1;
  C.ents = (T.ents || []).map(campClean);
  C.minerals = (T.minerals || []).map(function(m){ return { eid:m.eid, x:m.x, y:m.y, amount:m.amount, owner:null, miner:null }; });
  if(typeof saveMeta === 'function') saveMeta();
}
// 저장분이 있으면 통째로 덮어쓴다. 없으면 false — 호출부가 새 판으로 이어 간다.
function campRestore(){
  const C = campState(); if(!C || typeof G === 'undefined' || !G.tech) return false;
  if(!C.ents || !C.ents.length) return false;
  const T = G.tech;
  T.credit = C.credit || 0; T.energy = C.energy || 0;
  T.built = Object.assign({}, C.built); T.addon = Object.assign({}, C.addon);
  T.units = Object.assign({}, C.units); T.research = Object.assign({}, C.research);
  T.sup = C.sup || 0; T.supCap = C.supCap || 0; T.eseq = C.eseq || 1;
  T.ents = C.ents.map(function(e){ return Object.assign({}, e); });
  T.minerals = (C.minerals || []).map(function(m){ return Object.assign({}, m); });
  T.sel = null; T.selU = []; T.arm = null; T.pend = [];   // 선택·배치 중이던 것은 이어받지 않는다
  return true;
}

// ── 화면 층 ─────────────────────────────────────────────────────────────
// 건설 맵 #vBuild 는 .gview(인게임 층)이고 HOME 은 .appScreen 이다. 층이 다르다.
// ⚠ setInGame(true) 는 네비를 숨기고(navShow(null)) 재화 바도 CSS 로 숨긴다.
//   캠프는 둘 다 필요하므로 #phone.campMode 로 그 규칙에 예외를 판다(css/30-home.css).
// ⛔ DOM 을 옮기거나 복제하지 말 것 — #cstMain 은 관리자 탭·오토배틀과 같은 요소다.
let _campPrevTab = null;
let _campOn = false;   // 캠프 화면이 지금 떠 있나 — campExit 이 남의 판을 저장하지 않게 하는 문지기
let _campHome = null;    // #vBuild 의 원래 자리(돌려놓기 위해)
let _campPrevView = null; // 캠프 진입 전에 켜져 있던 .gview 목록 — ⛔ 반드시 되돌린다
let _campMarine = null;  // #cvMarine(공용 3D 캔버스)의 원래 자리 — ⛔ 반드시 되돌린다
let _campSheet = null;   // #btSheet 의 원래 자리 — 캠프에선 맵 밖으로 꺼낸다(아래 설명)

// ⭐ **HOME 껍데기를 그대로 쓴다.** #homeScreen 은 .appScreen(z-index 60)이라 인게임 층(#vBuild, z 6)을
//   통째로 덮는다 — setInGame(true) 로 켜 봐야 **화면에는 안 보인다**(실측: 화면 한가운데 요소가 #hmScroll).
//   그래서 층을 다투는 대신 **#vBuild 를 #homeScreen 안 배경 자리로 옮긴다.**
//   그 자리는 원래 #hbCv(옛 사냥터 배경 전투 캔버스)가 쓰던 곳이고, 위에 HUD·네비가 얹히는 구조다.
// ⛔ 복제가 아니라 **이동**이다 — #cstMain 은 관리자 탭·오토배틀과 같은 요소여야 한다(단일 소스).
//   나갈 때 원래 부모로 정확히 되돌린다.
// ⚠ **3D 건물은 #vBuild 가 아니라 공용 캔버스 #cvMarine 에 그린다**(14-input-fx.js:918).
//   그건 #gameArea(z 6) 안에 있어서 #homeScreen(z 60) 뒤로 숨는다 — 맵만 옮기면 **건물이 안 보인다.**
//   그래서 둘을 같이 옮긴다. z-index 로 올리는 방법은 쓰지 않는다: 60 을 넘기면 HUD·네비까지 덮는다.
// ⛔ #cvMarine 은 유즈맵·마을·보스가 함께 쓰는 공용 캔버스다. 반드시 원래 자리로 되돌린다.
function campMountView(){
  const hs = document.getElementById('homeScreen'), vb = document.getElementById('vBuild');
  if(!hs || !vb) return;
  if(!_campHome) _campHome = { parent: vb.parentNode, next: vb.nextSibling };
  if(vb.parentNode !== hs) hs.insertBefore(vb, hs.firstChild);   // 배경 자리(HUD 보다 뒤)
  const mc = document.getElementById('cvMarine');
  if(mc){
    if(!_campMarine) _campMarine = { parent: mc.parentNode, next: mc.nextSibling };
    if(mc.parentNode !== hs) hs.insertBefore(mc, vb.nextSibling);   // 맵 바로 위(건물이 바닥 위에 선다)
  }
  // ⭐ **하단 시트도 맵 밖으로 꺼낸다.** #btSheet 은 원래 #vBuild 의 자식이라, 맵 높이를
  //   시트만큼 줄이면 시트도 맵 기준이라 같이 끌려 올라간다 — 서로 밀어내는 순환이다
  //   (실측: 맵을 줄였더니 시트가 화면 한가운데로 올라와 323px 겹쳤다).
  //   #homeScreen 직속으로 옮기면 시트는 화면 바닥에 고정되고, 맵은 그 위까지만 쓰면 된다.
  // ⛔ 복제가 아니라 이동이다 — 관리자 탭·오토배틀이 같은 요소를 쓴다. 나갈 때 되돌린다.
  const sh = document.getElementById('btSheet');
  if(sh){
    if(!_campSheet) _campSheet = { parent: sh.parentNode, next: sh.nextSibling };
    if(sh.parentNode !== hs) hs.appendChild(sh);   // 맨 앞(맵·3D 위에 얹힌다)
  }
}
function campUnmountView(){
  const sh = document.getElementById('btSheet');
  if(sh && _campSheet){
    if(_campSheet.parent) _campSheet.parent.insertBefore(sh, _campSheet.next || null);
    _campSheet = null;
  }
  const mc = document.getElementById('cvMarine');
  if(mc && _campMarine){
    if(_campMarine.parent) _campMarine.parent.insertBefore(mc, _campMarine.next || null);
    _campMarine = null;
  }
  const vb = document.getElementById('vBuild');
  if(!vb || !_campHome) return;
  if(_campHome.parent) _campHome.parent.insertBefore(vb, _campHome.next || null);
  _campHome = null;
}
function campShowView(){
  // ⛔ setInGame(true) 를 쓰지 않는다 — 그건 네비를 숨기고 재화 바를 끄는 '인게임' 규칙이다.
  //   캠프는 HOME 안에 사는 화면이라 그 껍데기를 그대로 둬야 한다.
  const p = document.getElementById('phone'); if(p) p.classList.add('campMode');
  campMountView();
  // ⛔ **빌린 것은 돌려놓는다.** .gview 는 전장(#vMain)과 공유하는 층이고 .on 이 빠지면
  //   display:none 이라 그 안의 #cvMain 이 0×0 이 된다 — 크기를 재서 그리는 코드가 망가진다.
  //   캠프가 켜 둔 동안 어느 뷰가 켜져 있었는지 적어 두고 campHideView 가 되돌린다.
  const vs = document.querySelectorAll('.gview');
  if(_campPrevView === null){
    _campPrevView = [];
    for(let i = 0; i < vs.length; i++) if(vs[i].classList.contains('on')) _campPrevView.push(vs[i].id);
  }
  for(let i = 0; i < vs.length; i++) vs[i].classList.toggle('on', vs[i].id === 'vBuild');
  // ⭐ **프레임 루프는 .gview 가 아니라 `G.tab` 으로 분기한다**(js/14-input-fx.js:894).
  //   뷰만 켜고 이걸 빼먹으면 건설 맵이 렌더 루프를 아예 못 타고, 대신 drawMain() 이
  //   숨겨진 0크기 #cvMain 에 그리다가 drawImage 예외를 던진다(실제로 그랬다).
  // ⛔ switchTab('Build') 로 대신하지 말 것 — 그건 G.strike 분기·시트 토글·뷰 리셋까지
  //   함께 하는 유즈맵 문맥 함수라 캠프에서 부르면 부작용이 붙는다.
  if(typeof G !== 'undefined' && G){ if(_campPrevTab === null) _campPrevTab = G.tab; G.tab = 'Build'; }
  _campOn = true;
}
function campHideView(){
  const p = document.getElementById('phone'); if(p) p.classList.remove('campMode');
  const v = document.getElementById('vBuild'); if(v) v.classList.remove('on');
  if(_campPrevView){                                   // .gview 를 캠프 진입 전 상태로(위 설명)
    const vs = document.querySelectorAll('.gview');
    for(let i = 0; i < vs.length; i++) vs[i].classList.toggle('on', _campPrevView.indexOf(vs[i].id) >= 0);
    _campPrevView = null;
  }
  campUnmountView();                                   // #vBuild 를 원래 자리로
  campRestoreGas(); campUnpatchGas(); campUnpatchZoom();   // ⛽🔍 가스·줌 판정 원복(관리자 탭이 같은 것을 본다)
  { const g2=document.getElementById('campGas2'); if(g2) g2.remove(); }
  campClearSheet();
  if(typeof G !== 'undefined' && G && _campPrevTab !== null){ G.tab = _campPrevTab; _campPrevTab = null; }
  _campOn = false;
}

// ── 진입 / 이탈 ─────────────────────────────────────────────────────────
// ⚠ 순서가 고정이다 — techUIInit 이 매번 상태를 새로 만들기 때문에
//   복원을 그 앞에 두면 방금 복원한 것이 통째로 날아간다.
function campEnter(){
  const C = campState(); if(!C) return;
  if(!C.race){ campRaceSheet(); return; }              // 종족을 아직 안 골랐다
  if(typeof techUIInit !== 'function') return;
  techUIInit(campTechRace(C.race));                    // ① 본부·일꾼·광맥이 깔린 새 판
  const had = campRestore();                           // ② 저장분이 있으면 덮어씀
  if(!had){ campLayBase(); campLayMinerals(); }         // 새 판이면 기지·광맥을 하단으로 다시 깐다
  G.tech.inf = false; G.tech.nocool = false;           // ③ ⚠ 관리자 치트(무한 자원·쿨 없음)를 끈다
  campShowView();                                      // ④
  // ⭐ **격자 패치를 격자 계산보다 먼저 건다.** techCols() 감싸기(20→48칸)가 여기 들어 있고,
  //   그 뒤로 _techCW()·_techCH()·_techRows() 값이 전부 달라진다.
  //   ⛔ 늦게 걸면 앞뒤 계산이 서로 다른 격자를 본다 — 실측: 가스는 20칸 격자로,
  //     광맥은 48칸 격자로 앉아 두 줄이 30행이나 어긋났다(가스 0.56 vs 광맥 0.86).
  campPatchZoom();
  const got = campSettleAway();                        // ⑤ 자리 비운 동안 번 것
  if(got > 0 && typeof toast === 'function') toast('💠 자리를 비운 동안 미네랄 ' + got);
  _campT0 = Date.now(); _campC0 = G.tech.credit || 0;  // 수급 속도 측정 시작점
  // ⚠ **격자 크기(_techRows)는 맵 요소의 실제 크기에 달렸다.** 맵이 최종 크기가 되기 전에
  //   재면 다른 값이 나온다. 맵 크기를 정하는 것이 둘이다:
  //     ① campShowView()  — #vBuild 를 HOME 안으로 옮긴다(실측 30행 → 35행)
  //     ② campSyncSheet() — 하단 시트 높이만큼 맵을 줄인다(실측 79행 → 61행)
  //   둘 다 안 거친 상태로 가스 자리를 잡았다가, 광맥은 55행·가스는 71행에 앉아
  //   가스가 화면 밖(sy 1.08)으로 밀려났다.
  //   ⛔ 격자 좌표를 쓰는 계산은 전부 **이 둘 뒤**에 둘 것.
  campSyncSheet();                                     // 🗂 시트를 먼저 띄운다 — 맵 높이가 여기서 정해진다
  if(!had){ campLayBase(); campLayMinerals(); }        // 확정된 격자로 기지·광맥을 다시 잡는다
  campLayGas();                                        // ⛽ 가스는 광맥 자리를 보고 정한다 — 반드시 뒤
  campZoom();                                          // 🔍 전체가 한눈에 들어오게
  campSkin();                                          // 🎨 바닥을 사냥터 던전 배경으로
  campStartFrame();                                    // ▶ 캠프 자기 루프(유즈맵 루프는 HOME 에서 멈춘다)
  if(typeof updateCurBar === 'function') updateCurBar();   // 재화 바를 캠프 값으로 즉시 갱신
  campAutoGather();                                    // ⑥ 놀고 있는 일꾼을 광맥에 붙인다(즉시 1회)
  campStartTimer();
  if(typeof techUIRender === 'function') techUIRender();
  campAutoSave(true);
}
// 이번 체류에서 **실제로 번 것**을 재 둔다 — 자리 비움 정산이 이 속도를 쓴다.
let _campT0 = 0, _campC0 = 0;
function campNoteStay(){
  if(!_campT0 || typeof G === 'undefined' || !G.tech) return;
  const secs = (Date.now() - _campT0) / 1000, gained = (G.tech.credit || 0) - _campC0;
  if(secs >= 5 && gained > 0) campNoteRate(gained, secs);   // 5초 미만은 표본이 안 된다
  _campT0 = 0;
}
// ⚠ **캠프가 켜져 있을 때만 저장한다.** showAppScreen() 이 화면을 옮길 때마다 이걸 부르는데,
//   관리자 건설 탭이나 오토배틀에서 온 경우 G.tech 는 그쪽 판이다. 무턱대고 저장하면
//   남의 판을 캠프 저장에 덮어써 기지가 통째로 바뀐다.
function campExit(){ if(!_campOn) return;
  campNoteStay();                                      // 이번 체류의 수급 속도를 재고
  const C = campState(); if(C) C.leftAt = Date.now();  // 나간 시각을 남긴다(다음 진입에 정산)
  campStopTimer(); campStopFrame();
  campSave(); campHideView(); }
function campIsOn(){ return _campOn; }
// HOME 진입점 — 05-home.js 의 openHome() 이 부른다(옛 hbStart() 자리).
function campOpen(){ const C = campState(); if(!C) return;
  if(!C.race) campRaceSheet(); else campEnter(); }

// 주기 저장 — 건물 완성·생산마다 부르는 대신 타이머 하나로 묶는다(저장은 비싸다).
const CAMP_SAVE_MS = 30000;
let _campSaveT = 0;
function campAutoSave(reset){
  if(reset){ _campSaveT = (typeof performance !== 'undefined') ? performance.now() : 0; return; }
  const now = (typeof performance !== 'undefined') ? performance.now() : 0;
  if(now - _campSaveT < CAMP_SAVE_MS) return;
  _campSaveT = now; campSave();
}

// ── 종족 선택 ───────────────────────────────────────────────────────────
// ⛔ 전용 종족 UI 를 새로 만들지 말 것 — 13-room.js:268 에 같은 경고가 있다.
//   표는 STK_RACES/STK_RACE_ORDER, 띠는 segNavHTML() 이 단일 소스다.
//   껍데기는 .hbModal/.hbmCard(HOME 팝업 공용).
let _campRacePick = null;
function campRaceSheet(){
  if(typeof STK_RACE_ORDER === 'undefined' || typeof segNavHTML !== 'function') return;
  _campRacePick = _campRacePick || STK_RACE_ORDER[0];
  let ov = document.getElementById('campRaceOv');
  if(!ov){ ov = document.createElement('div'); ov.id = 'campRaceOv'; ov.className = 'hbModal';
    (document.getElementById('phone') || document.body).appendChild(ov); }
  ov.classList.remove('hide');
  campRaceRender();
}
function campRaceRender(){
  const ov = document.getElementById('campRaceOv'); if(!ov) return;
  const i = Math.max(0, STK_RACE_ORDER.indexOf(_campRacePick));
  const R = STK_RACES[_campRacePick] || {};
  ov.innerHTML = '<div class="hbmCard">'
    + '<div class="hbRow"><b>종족 선택</b></div>'
    // ⚠ segNavHTML(items, i, act) — 항목은 {label}, 셋째는 **함수**(k → onclick 문자열)다.
    + '<div class="hbRow">' + segNavHTML(
        STK_RACE_ORDER.map(function(k){ const S = STK_RACES[k] || {}; return { label:S.name || k }; }),
        i,
        function(k){ return "campRaceSel('" + STK_RACE_ORDER[k] + "')"; }) + '</div>'
    + '<div class="hbRow campRaceDesc"><span class="crName">' + (R.name || '') + '</span>'
    + '<span class="crSub">' + (R.sub || '') + ' · ' + (R.desc || '') + '</span></div>'
    + '<div class="hbRow"><button class="actBtn pri" onclick="campPickRace()">이 종족으로 시작</button></div>'
    + '</div>';
  if(typeof paintIcons === 'function') paintIcons(ov);
}
function campRaceSel(k){ if(STK_RACES[k]) { _campRacePick = k; campRaceRender(); } }
// ⚠ 한 번 고르면 바꾸지 않는다 — 기지가 종족 건물로 채워지므로 도중 교체는 뜻이 없다.
//   (바꾸는 기능이 필요해지면 '기지를 버리고 새로 시작'으로 따로 만든다)
function campPickRace(){
  const C = campState(); if(!C || C.race) return;
  C.race = _campRacePick || STK_RACE_ORDER[0];
  if(typeof saveMeta === 'function') saveMeta();
  const ov = document.getElementById('campRaceOv'); if(ov) ov.classList.add('hide');
  campEnter();
}

// ══ 💠 2단계 — 터치 채집 · 비용 조회 · 자리 비움 정산 (2026-08-23) ═════════════
// 방향 설계는 GAME_DIRECTION.md 가 단일 소스다.

// ── 비용 조회 — **여기 한 곳에서만 값을 읽는다** ───────────────────────
// ⛔ TECH_TREE 의 m/g 를 직접 고치지 말 것 — 유즈맵 건설 모드의 단일 소스라 그쪽이 망가진다.
//    구조(req 체인 · produces · research)만 빌리고 **비용은 이 함수를 거친다.**
// ⚠ 지금은 TECH_TREE 값을 그대로 통과시키는 자리다(CAMP_COST_K = 1).
//   실측: 유니온을 전부 짓고 전부 연구해도 미네랄 7,980 · 가스 6,850 뿐이라
//   탭 한 번에 1,000만 벌면 8탭에 게임이 끝난다. 사냥터 전용 비용 표가 오면
//   **이 함수 안만 갈아끼우면 된다** — 호출부는 손대지 않는다.
// ⭐ lv 인자를 받는 이유: 나중에 연구가 **무한 티어**로 열린다(환생 이후).
//   레벨을 boolean 이나 0~3 고정으로 다루면 그때 구조를 못 넓힌다.
const CAMP_COST_K = 1;                              // 사냥터 전용 배율(표가 오면 교체)
function campCost(kind, key, lv){
  const L = Math.max(0, lv | 0);
  let m = 0, g = 0;
  // ⚠ 비용은 techBldgSpec/techUnitSpec 이 아니라 **TECH_TREE 쪽**에 있다.
  //   techBldgSpec = TECH_SPEC[race].bldg[k] (상세 스펙 · 비용 없음)
  //   건물 비용 = TECH_TREE[race].buildings[].m/g · 유닛 비용 = 그 건물의 produces[].m/g
  if(typeof G !== 'undefined' && G.tech && typeof TECH_TREE !== 'undefined'){
    const race = G.tech.race, t = TECH_TREE[race];
    if(kind === 'bldg'){
      const b = (typeof techGetBldg === 'function') ? techGetBldg(race, key) : null;
      if(b){ m = b.m || 0; g = b.g || 0; }
    } else if(kind === 'unit'){
      const bs = (t && t.buildings) || [];
      for(const b of bs){ const q = (b.produces || []).find(function(x){ return x.id === key; });
        if(q){ m = q.m || 0; g = q.g || 0; break; } }
    }
  }
  return { m: Math.round(m * CAMP_COST_K), g: Math.round(g * CAMP_COST_K), lv: L };
}

// ── 터치 채집 ───────────────────────────────────────────────────────────
// 광맥을 누르면 그 자리에서 미네랄이 나온다. 일꾼 왕복(방치)과 **다른 축**이다.
// ⛔ 16/17-build.js 를 고치지 않는다 — 관리자 탭·오토배틀과 공유하는 파일이다.
//   대신 **캡처 단계**에서 먼저 받아 광맥이면 삼키고, 아니면 그대로 흘려보낸다.
// ⭐ **두 축 모두 ×2 계단(지수)이고 비용은 ×2.5 계단이다.**
//   선형으로 두면 수급이 초당 수백에서 멎는다. 지수로 두되 **비용이 더 가팔라야** 브레이크가 걸린다 —
//   실측(초당 2탭 · 1시간): 비용이 선형이면 21초, ×1.5 면 23초, ×2 면 299초 만에 레벨 60(탭당 10^18).
//   ×2.5 라야 1시간에 레벨 23 에서 멈춘다. 기준은 「다음 레벨까지 몇 탭인가」이고, 그 값이
//   ×2.5 에서 10 → 93 → 867 탭으로 **늘어난다**(선형은 0 으로 수렴 = 누를수록 쉬워짐 = 폭주).
// ⛔ 비용 계단을 획득 계단보다 낮추지 말 것. BALANCE.md §0 의 "지수 축이 둘이면 폭주"가 바로 이것이다.
const CAMP_GROW = 2;            // 획득 계단 — 레벨당 ×2 (0레벨 1 → 1레벨 2 → 2레벨 4 …)
const CAMP_PRICE = 2.5;         // 비용 계단 — 획득보다 가팔라야 한다
const CAMP_TAP_BASE = 1;        // 탭 0레벨 = 1미네랄
const CAMP_TAP_COST0 = 10;      // 탭 0→1레벨 비용(= 10탭)
const CAMP_GAT_COST0 = 400;     // 채취량 0→1레벨 비용(일꾼 축은 초당 26.8 이라 눈금이 다르다)
function campUpgLv(k){ const C = campState(); return (C && C.upg && C.upg[k]) | 0; }
// 업그레이드 비용 — ⛔ 값은 여기 한 곳에서만 (campCost 와 같은 원칙)
function campUpgCost(k){
  const base = (k === 'tap') ? CAMP_TAP_COST0 : CAMP_GAT_COST0;
  return Math.ceil(base * Math.pow(CAMP_PRICE, campUpgLv(k)));
}
function campTapGain(){
  const C = campState(); if(!C) return CAMP_TAP_BASE;
  // ⭐ 던전 배수는 **탭과 일꾼 양쪽에 똑같이** 걸린다(한쪽만 올리면 두 수입의 비율이 무너진다)
  return Math.max(1, Math.round(CAMP_TAP_BASE * Math.pow(CAMP_GROW, campUpgLv('tap')) * campMineMul()));
}
// 일꾼 채취 배수 — 일꾼 **수**로는 못 올린다(실측: 12기 26.8/초에서 천장. 300기도 26.8).
//   광맥 6덩이가 한 번에 한 명씩만 캐서 나머지는 줄을 선다. 그래서 **1회 채취량**을 올린다.
function campGatherMul(){ const C = campState(); if(!C) return 1;
  return Math.pow(CAMP_GROW, campUpgLv('gather')) * campMineMul(); }
// 눌린 곳이 광맥인가 — 맞으면 캐고 true
function campTapAt(clientX, clientY){
  if(!_campOn || typeof G === 'undefined' || !G.tech) return false;
  if(typeof _btRect !== 'function' || typeof _techS2W !== 'function' || typeof _techMineralAt !== 'function') return false;
  const r = _btRect(); if(!r || !r.width || !r.height) return false;
  const sx = (clientX - r.left) / r.width, sy = (clientY - r.top) / r.height;
  if(sx < 0 || sx > 1 || sy < 0 || sy > 1) return false;
  if(sy < 0.13) return false;                       // 상단바 — techPtrDown 과 같은 규약
  const w = _techS2W(sx, sy);
  const m = _techMineralAt(w.x, w.y); if(!m || m.amount <= 0) return false;
  const gain = Math.min(campTapGain(), m.amount);   // 매장량보다 많이 캘 수는 없다
  m.amount -= gain;
  G.tech.credit = (G.tech.credit || 0) + gain;
  _campTapAcc += gain;                              // 이 몫에는 채취 배수를 걸지 않는다(위 참고)
  const C = campState(); if(C) C.tapped = (C.tapped || 0) + 1;   // 실측용 — 손 축이 얼마나 쓰였나
  if(typeof updateCurBar === "function") updateCurBar();
  else if(typeof techUIRender === 'function') techUIRender();
  return true;
}
// ⚠ 캡처 단계(세 번째 인자 true)라야 `.bmap` 의 인라인 onpointerdown 보다 **먼저** 받는다.
//   뒤에 달면 손가락이 늘 이동·선택 명령에 먼저 먹힌다.
if(typeof document !== 'undefined'){
  document.addEventListener('pointerdown', function(ev){
    if(!_campOn) return;
    if(ev.button != null && ev.button !== 0) return;              // 좌클릭·터치만
    if(!ev.target || !ev.target.closest || !ev.target.closest('#cstMain')) return;
    if(G && G.tech && G.tech.arm) return;                          // 🧱 건물 배치 중이면 채집하지 않는다
    if(campTapAt(ev.clientX, ev.clientY)){
      // 🖐 광맥을 눌렀다 = '조작'이다 → 화면 이동 모드를 끈다(빈 바닥 탭·유닛/건물 탭과 같은 규칙).
      // ⚠ 여기서 끊어 줘야 한다 — 이 리스너는 캡처 단계에서 stopPropagation 하므로
      //   .bmap 의 인라인 techPtrDown(모드를 끄는 곳)이 **아예 안 불린다**.
      campPanMode(false);
      ev.stopPropagation(); if(ev.preventDefault) ev.preventDefault(); }
  }, true);
}

// ── 자리 비움 정산 ──────────────────────────────────────────────────────
// ⛔ "일꾼 n기 × 초당 k" 같은 식을 새로 만들지 않는다 — 화면 안에서 버는 것과 두 벌이 되면 어긋난다.
//   대신 **화면 안에서 실제로 번 속도**를 재 두고(campNoteRate), 자리를 비운 동안 그 속도로 채운다.
const CAMP_AWAY_CAP_S = 8 * 3600;   // 정산 상한 8시간 — 무한정 쌓이면 접속할 이유가 사라진다
const CAMP_AWAY_EFF = 0.5;          // 자리 비움 효율 — 보고 있을 때보다 덜 번다(들어올 이유를 남긴다)
function campNoteRate(gained, secs){
  const C = campState(); if(!C || !(secs > 0)) return;
  const r = gained / secs;
  C.rate = (C.rate > 0) ? (C.rate * 0.7 + r * 0.3) : r;   // EMA — 한 판의 운에 휘둘리지 않게
}
function campSettleAway(){
  const C = campState(); if(!C || !C.leftAt || !(C.rate > 0)) return 0;
  const secs = Math.min(CAMP_AWAY_CAP_S, Math.max(0, (Date.now() - C.leftAt) / 1000));
  C.leftAt = 0;
  const got = Math.floor(C.rate * secs * CAMP_AWAY_EFF);
  if(got > 0 && typeof G !== 'undefined' && G.tech) G.tech.credit = (G.tech.credit || 0) + got;
  return got;
}

// ── 일꾼 자동 채취 ──────────────────────────────────────────────────────
// ⚠ 관리자 건설 탭에서는 **사람이 일꾼을 골라 광맥을 클릭**해야 캔다. 그래서 캠프에 그냥
//   들어가면 일꾼이 놀고 초당 수급이 0 이다(실측: 일꾼 1기가 20초에 0). 캠프는 방치가
//   전제이므로 유휴 일꾼을 자동으로 붙인다.
// ⛔ 채취 로직을 새로 짜지 않는다 — 배정만 대신 눌러 주고 왕복·적립은 건설 탭 것을 그대로 쓴다.
//   (_techAssignGatherMineral 이 '인원이 가장 적은 광맥'으로 알아서 분배한다)
function campAutoGather(){
  if(!_campOn || typeof G === 'undefined' || !G.tech) return 0;
  if(typeof _techAssignGatherMineral !== 'function') return 0;
  const mins = (G.tech.minerals || []).filter(function(m){ return m.amount > 0; });
  if(!mins.length) return 0;
  const idle = (G.tech.ents || []).filter(function(w){
    return w.type === 'worker' && w.build == null && !w._gKind; });
  for(const w of idle) _techAssignGatherMineral([w], mins[0].eid);
  return idle.length;
}

// ── 캠프 시계 ───────────────────────────────────────────────────────────
// 건설 탭의 프레임 루프에는 끼어들 수 없다(16/17 수정 금지). 가벼운 자체 타이머를 둔다.
// 하는 일 둘: 새로 뽑힌 일꾼을 광맥에 붙이고, 주기적으로 저장한다.
// ⚠ 일꾼 채취량에 배수를 거는 방법 — TECH_GATHER_AMT(=8)는 16-build.js 의 const 라 못 고친다.
//   대신 **크레딧이 늘어난 만큼을 보고 차액을 얹는다.** 터치로 번 몫(_campTapAcc)은 빼고 계산한다 —
//   터치는 자기 배수를 이미 쓰므로 두 번 곱하면 안 된다.
// ⛔ 주기를 길게 잡으면 숫자가 뚝뚝 튄다. 250ms 로 촘촘히 돌리고, 배정·저장만 2초마다 한다.
const CAMP_TICK_MS = 250;
const CAMP_SLOW_EVERY = 8;      // 250ms × 8 = 2초
let _campTimer = 0, _campSlow = 0, _campLastCr = 0, _campTapAcc = 0;
function campApplyGatherMul(){
  if(typeof G === 'undefined' || !G.tech) return;
  const cur = G.tech.credit || 0;
  let delta = cur - _campLastCr;
  if(delta > 0){
    const tapPart = Math.min(delta, _campTapAcc);   // 터치 몫은 배수 대상이 아니다
    _campTapAcc -= tapPart; delta -= tapPart;
    const m = campGatherMul();
    if(delta > 0 && m > 1) G.tech.credit = cur + Math.round(delta * (m - 1));
  } else if(delta < 0){ _campTapAcc = 0; }          // 건물을 샀다 = 지출. 누적을 흘려보낸다
  _campLastCr = G.tech.credit || 0;
}
// ── 캠프 전용 프레임 루프 ────────────────────────────────────────────────
// ⭐ **유즈맵 루프는 HOME 에서 멈춘다.** loop() 안에 이 가드가 있다:
//      if(!nemoScreenOn()){ requestAnimationFrame(loop); return; }   (14-input-fx.js:840)
//    nemoScreenOn() 은 **앱 화면이 하나라도 열려 있으면 false** 다. 캠프는 HOME(.appScreen)
//    안에 살기 때문에 늘 걸린다 → renderBuildTab 이 영원히 안 불리고 3D 건물·광맥이
//    안 그려지며 일꾼도 안 움직인다(실측: #cvMarine 그려진 픽셀 전 구간 0).
// ⛔ nemoScreenOn 에 예외를 파지 말 것 — 그 가드는 성능 때문에 **일부러** 있다
//    (원 주석: "HOME에서 이걸 안 막으면 60 → 47fps"). 유즈맵 전장까지 같이 되살아난다.
//    캠프가 필요한 건 renderBuildTab 하나뿐이므로 **자기 루프**를 따로 돈다.
let _campRAF = 0, _campLastT = 0;
// ⏱ 프레임 간격 하한(ms). 캠프 한 프레임은 **3D 1.02M 픽셀 렌더 + 맵 DOM 통째 재생성**이다
//   (실측: #cvMarine 730×1402 @dpr2 · techMapRender 가 #cstMain·#cstLabels 의 innerHTML 을
//    매 프레임 갈아 끼운다). RTS 라 60fps 가 필요 없으므로 절반만 그린다.
// ⚠ 30ms 인 이유: 스모크가 33ms 간격으로 campFrame 을 직접 부른다 — 그보다 크면 테스트가
//   프레임을 건너뛰어 계측이 어긋난다. 실제 rAF(16.7ms)에서는 두 번에 한 번 그려 ~33fps 가 된다.
const CAMP_FRAME_MS = 30;
let _campLastDraw = 0;
function campFrame(now){
  if(!_campOn){ _campRAF = 0; return; }
  const t = now || (typeof performance !== 'undefined' ? performance.now() : 0);
  // ⚠ 시계가 **뒤로 가면** 기준을 버린다. rAF 시각은 절대 뒤로 가지 않지만, 테스트는
  //   campFrame 을 가짜 시각으로 직접 부른다 — 앞선 호출이 기준을 먼 미래로 밀어 두면
  //   그 뒤의 모든 프레임이 통째로 스킵된다(실제로 휠·일꾼 검사가 그렇게 죽었다).
  if(t < _campLastDraw) _campLastDraw = 0;
  if(t - _campLastDraw < CAMP_FRAME_MS){ _campRAF = requestAnimationFrame(campFrame); return; }   // 너무 이르면 건너뛴다
  _campLastDraw = t;
  const dt = Math.min(0.05, Math.max(0, (t - (_campLastT || t)) / 1000));   // ⚠ 건너뛴 시간도 dt 에 담긴다(_campLastT 는 그릴 때만 갱신)
  _campLastT = t;
  // ⚡ **한 프레임 안에서 맵 rect 를 한 번만 잰다.** 아래 campPatchRect 설명 참고.
  _campRectC = null;
  try{
    if(typeof renderBuildTab === 'function') renderBuildTab(dt);   // 건설 틱 + 3D — 단일 소스 그대로
    campDrawGas2();                                               // ⛽ 오른쪽 가스 구역(캠프가 얹는다)
    campSyncSheet();                                              // 🗂 시트를 늘 띄워 둔다
  } finally { _campRectC = null; }   // ⛔ 프레임 밖으로 캐시를 들고 나가지 않는다(이벤트 핸들러가 낡은 값을 본다)
  _campRAF = requestAnimationFrame(campFrame);
}
function campStartFrame(){ if(_campRAF) return; _campLastT = 0; _campLastDraw = 0; _campRAF = requestAnimationFrame(campFrame); }
function campStopFrame(){ if(_campRAF){ cancelAnimationFrame(_campRAF); _campRAF = 0; } }

function campStartTimer(){
  if(_campTimer) return;
  _campLastCr = (typeof G !== 'undefined' && G.tech) ? (G.tech.credit || 0) : 0;
  _campTapAcc = 0; _campSlow = 0;
  _campTimer = setInterval(function(){
    if(!_campOn) return;
    campApplyGatherMul();
    if(typeof updateCurBar === 'function') updateCurBar();   // 💠 번 돈이 재화 바에 바로 보이게
    if(++_campSlow >= CAMP_SLOW_EVERY){ _campSlow = 0;
      campAutoGather();    // 새 일꾼 · 고갈로 놀게 된 일꾼을 다시 붙인다
      campAutoSave(); }
  }, CAMP_TICK_MS);
}
function campStopTimer(){ if(_campTimer){ clearInterval(_campTimer); _campTimer = 0; } }

// ── 🎨 겉모습을 사냥터 것으로 ────────────────────────────────────────────
// 시스템은 건설 구역, 디자인은 사냥터 — 바닥 그림도 사냥터가 쓰던 던전 배경을 그대로 쓴다.
// ⚠ 인라인 style 이 아니라 CSS 변수로 심는다. techMapRender 가 맵 innerHTML 을 통째로
//   갈아 끼우므로 요소에 직접 준 style 은 다음 렌더에 날아간다.
// 캠프 전용 배경 — ⛔ 사냥터의 assets/backgrounds/dungeons/ 를 쓰지 않는다.
//   같은 파일을 쓰면 캠프 던전 1 을 초원으로 바꾸는 순간 사냥터 던전 1 도 같이 바뀐다.
//   파일이 없는 던전은 사냥터 배경으로 폴백한다(README 의 "없으면 타일 바닥" 규칙과 같은 결).
const CAMP_BG_DIR = 'assets/backgrounds/camp/';
const CAMP_BG_FALLBACK = 'assets/backgrounds/dungeons/';
const CAMP_BG_HAVE = { 1:1 };   // 캠프 전용 그림이 있는 던전(늘어나면 여기 추가)
function campSkin(){
  const C = campState(); if(!C) return;
  const el = document.getElementById('phone'); if(!el) return;
  const dg = Math.max(1, Math.min(10, (C.dg | 0) || 1));   // 0단계(캠프)는 던전 1 그림을 쓴다
  // ⚠ **문서 기준 절대 URL 로 만든다.** CSS 변수 안의 상대 경로는 변수를 *선언한 곳*이 아니라
  //   *쓰는 곳*(css/30-home.css)을 기준으로 풀린다 → 'assets/…' 가 'css/assets/…' 가 된다.
  //   같은 함정을 파일 분할 때도 밟았다(커밋 「분할이 깨뜨린 상대 경로」).
  const dir = CAMP_BG_HAVE[dg] ? CAMP_BG_DIR : CAMP_BG_FALLBACK;
  const url = new URL(dir + 'dg' + dg + '.webp', document.baseURI).href;
  el.style.setProperty('--campBg', "url('" + url + "')");
}

// ── 🔍 화면 배율 ────────────────────────────────────────────────────────
// 건설 탭 기본 zoom=1 은 관리자용이라 폰 화면에서 너무 확대돼 보인다(광맥·본부가 한 화면에
// 있어도 각각이 크게 잡힌다). 캠프는 기지 전체를 한눈에 보는 게임이라 낮춘다.
// ⚠ **건설 탭은 줌 1 이 최소다** — techMinZoom() 이 관리자(=캠프)에게 1 을 돌려준다.
//   그리고 클램프가 m=(1-1/zoom)*0.5 로 팬 범위를 정하는데, zoom 1 이면 m=0 이라
//   x·y 가 0.5 에 **고정**된다 → 화면 이동이 아예 안 된다(중클릭 팬이 안 먹던 이유).
//   축소도 막힌다(0.62 를 넣어도 1 로 되돌아온다).
// ⛔ 17-build-cards.js 를 고치지 않는다 — 관리자 탭·오토배틀이 같은 함수를 쓴다.
//   캠프일 때만 두 함수를 감싼다. 규칙 자체는 원본을 그대로 따르고 **하한만 낮춘다.**
// 🔎 화면 배율과 칸 수 — 「맵을 1.5배 넓게 쓴다 = 안의 요소를 1/1.5 로 줄인다」
//
// 화면에 보이는 셀 폭 = (격자폭 0.88 / 칸수) × zoom 이다. 두 값을 함께 정해야 한다.
//   ① zoom = 1 → 격자가 화면을 꽉 채운다. 0.62 였을 때는 좌우 23%씩이 격자 밖 빈 배경이었다.
//   ② 칸수 = 20 × 1.5 ÷ 0.62 ≈ 48 → 예전 화면(20칸 @0.62)과 견줘 셀이 정확히 1/1.5 로 작아진다.
//      (0.88/48)×1 = 0.01833  vs  (0.88/20)×0.62 = 0.02728  →  비 0.672
// ⛔ TECH_GRID.cols 를 직접 고치지 말 것. renderBuildTab 의 _cellK 가
//   `_techCW() / ((x1-x0)/TECH_GRID.cols)` 로 **20칸을 기준선 삼아** 유닛 크기를 정한다
//   (js/14-input-fx.js). 상수를 바꾸면 기준선도 같이 움직여 _cellK 가 1 로 남고
//   건물만 작아지고 **유닛은 그대로**인 어긋난 화면이 된다.
//   techCols() 만 감싸면 분모가 20 으로 남아 유닛도 같은 비율로 줄어든다(실측 _cellK 0.417).
const CAMP_ZOOM = 1;
const CAMP_COLS = 48;
// 🚧 **맵 밖이 화면에 보이지 않게 하는 한도.**
// 바닥(.bmapFloor)은 inset:0 이지만 **뷰 변환을 함께 받는다**(_techViewCSS). 그래서
// 축소하면 바닥도 같이 줄어 사방에 빈 공간이 뚫린다 — 실측: zoom 0.5 에서 바닥이
// 183×270 으로 줄어 365×540 화면의 가운데에만 남았다. zoom 1 에서 정확히 화면을 덮는다.
//   → 축소 하한 = 1.
// 팬도 마찬가지다. 원본 클램프 m=(1-1/zoom)×0.5 는 **바닥이 화면을 덮는 최대 범위**와 정확히
// 같다(z 배 커진 바닥의 가장자리가 화면 가장자리에 닿는 지점). 그래서 원본 식을 그대로 쓰면
// 어떤 줌에서도 밖이 안 보인다. ⛔ 여기에 여유를 더하면(예전 CAMP_PAN_FREE) 그만큼 밖이 뚫린다.
// ⚠ 맞바꿈: zoom 1(=하한)에서는 m=0 이라 **화면 이동이 안 된다.** 밖을 안 보이게 하는 것과
//   하한에서 움직이는 것은 양립하지 않는다 — 이동하려면 확대해야 한다(RTS 표준 동작).
const CAMP_MIN_ZOOM = 1;   // = 바닥이 화면을 딱 덮는 배율. 더 줄이면 맵 밖이 뚫린다(위 설명)
let _campZoomPatched = null;
let _campRectC = null;
let _campPanMode = false;   // 🖐 화면 이동 모드가 켜져 있나(롱프레스로 켜고 탭으로 끈다)
let _campPanDown = null;    // 모드 중 눌린 손가락(움직였는지 판정용)
let _campPanJustOn = false; // 방금 롱프레스로 켰다 — 그 손가락의 up 은 탭이 아니다
let _campLongT = null, _campLongFrom = null;   // 롱프레스 타이머    // 이번 프레임의 맵 rect(campFrame 이 비운다) — 위 campPatchRect 설명
function campPatchZoom(){
  if(_campZoomPatched || typeof window === 'undefined') return;
  const oMin = window.techMinZoom, oClamp = window._techClampView, oCols = window.techCols;
  const oRect = window._btRect;
  if(typeof oMin !== 'function' || typeof oClamp !== 'function' || typeof oCols !== 'function'
     || typeof oRect !== 'function') return;
  _campZoomPatched = { techMinZoom:oMin, _techClampView:oClamp, techCols:oCols, _btRect:oRect };
  // ⚡ **맵 rect 를 프레임당 한 번만 잰다 — 랙의 주범이었다.**
  //   _techGA() 가 _btRect()(=getBoundingClientRect)를 부르고, _techCH() 가 _techGA() 를 부르며,
  //   _techCH() 는 유닛·광맥·건물마다 불린다. 같은 프레임에 techMapRender 가 innerHTML 을
  //   통째로 갈아 끼우므로 레이아웃이 무효화되고, 그 뒤의 rect 읽기가 전부 **강제 동기 레이아웃**이 된다.
  //   실측: 엔티티가 본부+일꾼 둘뿐인데도 프레임당 22.7회. 유닛이 늘면 선형으로 늘어난다.
  //   맵 크기는 한 프레임 안에서 변하지 않으므로 캐시가 안전하다.
  window._btRect = function(){
    if(!_campOn) return oRect.apply(this, arguments);
    return _campRectC || (_campRectC = oRect.apply(this, arguments));
  };
  window.techMinZoom = function(){ return _campOn ? CAMP_MIN_ZOOM : oMin.apply(this, arguments); };
  // 격자를 촘촘하게 = 같은 화면에 더 넓은 구역. 셀이 작아지면 건물 발판(_techCW 비례)과
  // 유닛(_cellK 비례)이 함께 줄고, 배치 상수(CAMP_ROW_*)는 비율이라 저절로 따라온다.
  window.techCols = function(){ return _campOn ? CAMP_COLS : oCols.apply(this, arguments); };
  // 🖱 휠은 경로가 둘이다(#vBuild 리스너 + 캠프의 window 캡처). 같은 이벤트를 두 번 처리하면
  //   한 번 굴릴 때 두 단계씩 줌된다 — 이벤트에 표시를 남겨 한 번만 처리한다.
  const oWheel = window.techWheel;
  if(typeof oWheel === 'function'){
    _campZoomPatched.techWheel = oWheel;
    window.techWheel = function(ev){
      if(_campOn && ev){ if(ev.__campWheel) return; ev.__campWheel = true; }
      return oWheel.apply(this, arguments);
    };
  }
  campPatchWheel();
  // 🖐 **화면 이동 모드 — 빈 바닥 0.5초 롱프레스로 켜고, 탭으로 끈다.**
  //
  //   왜 모드인가(사용자 화면 실측으로 확정된 사슬):
  //   ① 사용자는 터치 모드로 본다(pointerdown type=touch · maxTouch=5 · 폭 375).
  //   ② 터치 변환은 중클릭 이벤트를 아예 만들지 않는다(진단 pointerdown:— → btn=0 만 옴).
  //   ③ Shift+드래그 우회도 죽는다 — 에뮬레이션이 두 손가락 핀치로 바꿔 보낸다.
  //   → 버튼·키보드 조합은 전부 못 쓴다. 손가락 하나로 되어야 한다.
  //
  //   ⛔ **그렇다고 빈 바닥 드래그를 팬으로 쓰면 안 된다** — 거긴 이미 드래그 박스 유닛 지정이
  //     있다(원본 _btBox). 한 제스처에 두 뜻을 담으면 반드시 하나가 죽는다.
  //     그래서 **모드**로 가른다: 롱프레스로 켜면 그때부터 드래그가 팬이고, 박스 지정은 쉰다.
  //
  //   규칙(사용자 확정):
  //   · 빈 바닥을 0.5초 누르고 있으면 → 화면 이동 모드 ON
  //   · 손을 떼도 유지 → 다음 스와이프도 화면 이동
  //   · 그냥 탭하거나(바닥·유닛·건물 무엇이든) → OFF. 그 탭은 원본에 그대로 흘려 보내
  //     선택·채집이 정상 동작한다(모드가 조작을 삼키지 않는다).
  const oDown = window.techPtrDown, oMove = window.techPtrMove, oUp = window.techPtrUp;
  if(typeof oDown === 'function' && typeof oMove === 'function' && typeof oUp === 'function'){
    _campZoomPatched.techPtrDown = oDown;
    _campZoomPatched.techPtrMove = oMove;
    _campZoomPatched.techPtrUp = oUp;

    window.techPtrDown = function(ev){
      if(_campOn && _campPanMode && ev && ev.button !== 1 && typeof techPanStart === 'function'){
        // ⭐ **대상 판별은 여기(down)서 한다.** 유닛·건물·자원을 눌렀으면 모드를 끄고 원본에 넘긴다
        //   — 그러면 선택·채집이 원본 규칙 그대로 일어난다(재전달 같은 잔재주가 필요 없다).
        if(!campEmptyAt(ev.clientX, ev.clientY)){
          campPanMode(false);
          return oDown.apply(this, arguments);
        }
        // 빈 바닥 = 팬. 움직였는지는 up 에서 본다(제자리면 '지정 해제 탭'으로 되돌린다).
        _campPanDown = { id:ev.pointerId, x:ev.clientX, y:ev.clientY };
        _btPtrs.set(ev.pointerId, { x:ev.clientX, y:ev.clientY });
        techPanStart(ev);
        return;
      }
      const ret = oDown.apply(this, arguments);
      // 빈 바닥을 눌렀나 — **좌표로 직접 판정한다.**
      // ⛔ _btBox(원본의 드래그 박스)로 판별하면 안 된다. 캠프는 시트를 채우려고 늘 본부를
      //   자동 선택해 두는데(campSyncSheet), 그러면 빈 바닥 탭이 원본의 "건물 지정 해제"
      //   경로로 먼저 소비되어(17-build-cards.js:685) _btBox 가 **영영 서지 않는다**.
      //   실측: 그 판별자로는 롱프레스가 한 번도 안 걸렸다.
      if(_campOn && !_campPanMode && !_btPan && !_btCmd && !_btArm && ev
         && campEmptyAt(ev.clientX, ev.clientY)){
        campPanArm(ev);
      }
      return ret;
    };

    window.techPtrMove = function(ev){
      // 끌기 시작하면 롱프레스 취소 — 끌었다는 건 박스 지정을 하겠다는 뜻이다
      if(_campLongT && ev && _campLongFrom && ev.pointerId === _campLongFrom.id
         && Math.hypot(ev.clientX - _campLongFrom.x, ev.clientY - _campLongFrom.y) > 8) campPanDisarm();
      return oMove.apply(this, arguments);
    };

    window.techPtrUp = function(ev){
      campPanDisarm();
      if(_campOn && _campPanMode && _campPanDown && ev && ev.pointerId === _campPanDown.id){
        const moved = Math.hypot(ev.clientX - _campPanDown.x, ev.clientY - _campPanDown.y) > 8;
        _campPanDown = null;
        // ⚠ **모드를 켠 그 손가락이 떨어지는 것은 탭이 아니다.** 롱프레스는 제자리에서 일어나므로
        //   거리로만 재면 moved=false 가 되어 켜자마자 다시 꺼진다(실측: 650ms 후 ON → up 후 OFF).
        //   사용자 규칙은 "손을 떼도 유지" 다 — 그 한 번만 탭 판정을 건너뛴다.
        if(_campPanJustOn){ _campPanJustOn = false; return oUp.apply(this, arguments); }
        if(!moved){
          // 빈 바닥을 제자리에서 눌렀다 뗐다 = 탭 → 모드를 끄고 그 탭을 원본에 넘긴다(지정 해제).
          // ⚠ 재전달은 **지금 이벤트**로 한다 — 예전에 _campPanDownEv(모드를 켤 때의 빈 바닥
          //   좌표)를 넘겼다가, 엉뚱한 자리를 누른 것이 되어 선택이 안 됐다.
          campPanMode(false);
          _btPan = null; _btPtrs.delete(ev.pointerId);
          oDown.call(window, ev);
          return oUp.apply(this, arguments);
        }
      }
      return oUp.apply(this, arguments);
    };
  }
  window._techClampView = function(v){
    if(!_campOn) return oClamp.apply(this, arguments);
    v = v || (G.tech && G.tech.view); if(!v) return;
    v.zoom = Math.max(CAMP_MIN_ZOOM, Math.min(techMaxZoom(), v.zoom));
    // 팬 여지 = 바닥이 화면을 덮는 한도(위 설명). 원본과 같은 식이되 음수만 막는다.
    const m = Math.max(0, (1 - 1 / v.zoom) * 0.5);
    // ⛔ 시트 몫으로 시점을 내리지 않는다 — **맵 뷰포트(#cstMain)가 이미 시트 위에서 끝난다**
    //   (campMountView 가 시트를 맵 밖으로 꺼내 그 순환을 풀었다). 여기서 또 내리면 두 벌이 된다.
    v.x = Math.max(0.5 - m, Math.min(0.5 + m, v.x));
    v.y = Math.max(0.5 - m, Math.min(0.5 + m, v.y));
  };
}
// ── 🖱 휠 줌 — 전달 경로를 이중화한다 ─────────────────────────────────
// 건설 탭의 휠은 **#vBuild 에 addEventListener 로 딱 한 번** 걸린다(js/14-input-fx.js).
// 반면 탭·드래그는 .bmap 의 인라인 onpointerdown 이라 techMapRender 가 맵 DOM 을 매 프레임
// 새로 만들 때마다 함께 되살아난다. 그래서 **포인터는 되는데 휠만 안 먹는** 상태가 가능하다
// (커서 아래 요소가 매 프레임 교체되는 화면에서 버블 경로 하나에만 기대는 구조).
//
// 원인을 코드로 재현하지 못했으므로 — G.tab · 리스너 등록 · hit-test · 덮개를 전부 재서
// 정상이었다 — **경로를 하나 더 둬서** 무엇이 막든 통하게 한다. window 캡처 단계라
// 중간에서 누가 stopPropagation 을 해도 먼저 받는다.
// ⛔ 시트 안에서는 손대지 않는다 — 거기 휠은 시트 자신의 스크롤이다.
let _campWheel = null;
function campPatchWheel(){
  if(_campWheel || typeof window === 'undefined') return;
  _campWheel = function(e){
    if(!_campOn || typeof techWheel !== 'function') return;
    const sh = document.getElementById('btSheet');
    // ⚠ target 이 Element 일 때만 contains 를 쓴다 — Node 가 아닌 것(window 등)을 넘기면
    //   Node.contains 가 TypeError 를 던져 리스너가 통째로 죽는다.
    const tg = e.target;
    if(sh && sh.classList.contains('open') && tg && tg.nodeType === 1 && sh.contains(tg)) return;   // 시트 스크롤 존중
    const r = _btRect(); if(!r || !r.width) return;
    if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    techWheel(e);
  };
  window.addEventListener('wheel', _campWheel, { passive:false, capture:true });
}
function campUnpatchWheel(){
  if(!_campWheel) return;
  window.removeEventListener('wheel', _campWheel, { capture:true });
  _campWheel = null;
}
function campUnpatchZoom(){
  if(!_campZoomPatched) return;
  campUnpatchWheel();
  campPanDisarm(); campPanMode(false); _campPanDown = null; _campPanJustOn = false;   // 🖐 모드를 들고 나가지 않는다
  for(const k in _campZoomPatched) window[k] = _campZoomPatched[k];
  _campZoomPatched = null;
}
function campZoom(){
  if(typeof G === 'undefined' || !G.tech) return;
  const v = G.tech.view || (G.tech.view = { x:0.5, y:0.5, zoom:1 });
  // 축소 상태에서는 클램프가 x·y 를 0.5 로 고정한다(전체가 보이므로 팬 여지가 없다).
  //   기지가 아래쪽에 오는 것은 시점이 아니라 **배치**가 만든다(campLayBase).
  v.zoom = CAMP_ZOOM; v.x = 0.5; v.y = 0.5;
  if(typeof _techClampView === 'function') _techClampView(v);   // 줌 하한 등 규칙을 즉시 반영
  if(typeof techViewT === 'function'){ const t = techViewT(); if(t){ t.zoom = v.zoom; t.x = v.x; t.y = v.y; } }
}

// ── 🗂 하단 시트 상시 표시 ──────────────────────────────────────────────
// 유즈맵 하단 프로필 구역처럼 **늘 자리를 차지한다**(건물을 고르면 그 안에 생산·연구 카드가 뜬다).
// ⚠ 맵(#vBuild)이 시트에 가리지 않도록 실제 높이를 CSS 변수로 흘린다 —
//   값을 CSS 에 상수로 박으면 시트 내용이 바뀔 때 어긋난다.
function campSyncSheet(){
  const sh = document.getElementById('btSheet'); if(!sh) return;
  const T = G.tech;
  // 🗺 **배치·랠리 지정 중에는 시트를 내린다** — 맵을 넓게 보며 지을 자리를 고르는 동작이고,
  //   techPanelRender 가 이미 그렇게 한다(17-build-cards.js: _shown 에 arm==null 조건).
  //   ⛔ 여기서 .open 을 무조건 붙이면 그 동작을 매 프레임 덮어써 시트가 안 내려간다.
  if(T && (T.arm != null || T.rallySet != null)) return;     // 높이도 건드리지 않는다(맵은 화면 전체라 무관)
  sh.classList.add('open');                                  // #btSheet.open → transform:translateY(0)
  if(T){
    // 시트를 늘 열어 두므로 **내용도 늘 있어야** 한다. 아무것도 안 골랐으면 본부를 고른다
    // (유즈맵 하단 프로필이 늘 내 캐릭터를 보여 주는 것과 같다).
    // ⛔ 배치·스킬 조준 중에는 건드리지 않는다 — 조준 대상이 바뀌어 버린다.
    const idle = T.sel == null && !(T.selU && T.selU.length) && !T.selRes && !T.arm && !T.skillArm;
    if(idle){
      const hq = campHQ();
      if(hq){ T.sel = hq.eid;
        const st = T.sheet || (T.sheet = {open:false, sec:null}); st.open = true; st.sec = 'ent';
        if(typeof techUIRender === 'function') techUIRender(); }   // 내용이 바뀌었을 때만(idle 진입 순간 한 번)
    }
  }
}
// ⛔ 예전에는 여기서 시트 높이를 --campSheetH 로 흘려 맵 높이를 줄였다. 지금은 맵이 화면 전체를
//   쓰므로 그 값을 아무도 안 본다 — 매 프레임 offsetHeight 를 읽는 것은 **강제 동기 레이아웃**만
//   일으키는 순손해라 걷어냈다.
// 본부 한 채 — 시트의 기본 대상. 종족마다 키가 달라 TECH_TREE 의 첫 건물(=본부)로 찾는다
function campHQ(){
  const T = G.tech; if(!T || !T.ents) return null;
  const tree = (typeof TECH_TREE !== 'undefined') && TECH_TREE[T.race];
  const key = tree && tree.buildings && tree.buildings[0] && tree.buildings[0].key;
  let hq = key && T.ents.find(e => e.type === 'bldg' && e.key === key && !(e.bt > 0));
  if(!hq) hq = T.ents.find(e => e.type === 'bldg' && !(e.bt > 0));   // 본부가 없으면 완성된 아무 건물
  return hq || null;
}
function campClearSheet(){
  const sh = document.getElementById('btSheet'); if(sh) sh.classList.remove('open');
  const el = document.getElementById('phone'); if(el) el.style.removeProperty('--campSheetH');   // 옛 값이 남아 있으면 지운다
}

// 셀 축소 비 — renderBuildTab 의 _cellK 와 **같은 식**이어야 한다(js/14-input-fx.js).
// 관리자 20칸을 기준선 삼아 "격자가 얼마나 촘촘해졌나"를 재고, 유닛·미네랄이 그만큼 작아진다.
function campCellK(){
  if(typeof TECH_GRID === 'undefined' || typeof _techCW !== 'function') return 1;
  const base = (TECH_GRID.x1 - TECH_GRID.x0) / TECH_GRID.cols;
  return base ? (_techCW() / base) : 1;
}

// ── 🖐 화면 이동 모드 ───────────────────────────────────────────────────
// 켜고 끄는 입구는 여기 하나. 표시(안내·테두리)도 같이 맡는다.
const CAMP_PAN_HOLD_MS = 500;   // 사용자 확정: 빈 바닥 0.5초
function campPanMode(on){
  if(_campPanMode === !!on) return;
  _campPanMode = !!on;
  const m = document.getElementById('cstMain');
  if(m) m.classList.toggle('campPan', _campPanMode);
  if(typeof toast === 'function') toast(_campPanMode ? '🖐 화면 이동 — 탭하면 해제' : '👆 지정 모드');
  if(_campPanMode && typeof playSfx === 'function') playSfx('ui_open');
}
// 빈 바닥을 눌렀다 — 0.5초 버티면 모드 ON
function campPanArm(ev){
  campPanDisarm();
  _campLongFrom = { id:ev.pointerId, x:ev.clientX, y:ev.clientY };
  _campLongT = setTimeout(function(){
    _campLongT = null;
    if(!_campOn) return;
    campPanMode(true);
    _campPanJustOn = true;   // 이 손가락이 떨어질 때는 탭으로 치지 않는다(위 techPtrUp 설명)
    // 누르고 있는 그 손가락을 **곧바로 팬으로 넘긴다** — 손을 뗐다 다시 끌 필요가 없다.
    if(_campLongFrom && _btPtrs.has(_campLongFrom.id) && typeof techPanStart === 'function'){
      _btBox = null;   // 혹 서 있으면 걷는다(박스 지정과 팬이 겹치지 않게)
      _campPanDown = { id:_campLongFrom.id, x:_campLongFrom.x, y:_campLongFrom.y };
      techPanStart({ clientX:_campLongFrom.x, clientY:_campLongFrom.y, pointerId:_campLongFrom.id });
    }
  }, CAMP_PAN_HOLD_MS);
}
function campPanDisarm(){
  if(_campLongT){ clearTimeout(_campLongT); _campLongT = null; }
  _campLongFrom = null;
}

// 이 화면 좌표에 **고를 것이 없나**(= 빈 바닥인가). 롱프레스로 화면 이동 모드를 켤 자리인지 가른다.
// ⛔ 판정 로직을 새로 쓰지 않는다 — 원본 히트 판정 함수(_techMineralAt · _techBldgRectAt)를
//   그대로 부르고, 유닛만 셀 크기로 훑는다(원본에 단일 진입점이 없다).
function campEmptyAt(cx, cy){
  if(typeof G === 'undefined' || !G.tech) return false;
  const r = _btRect(); if(!r || !r.width) return false;
  if(cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false;
  const sx = (cx - r.left) / r.width, sy = (cy - r.top) / r.height;
  if(sy < 0.13) return false;                                   // 상단바 — techPtrDown 과 같은 규약
  const w = _techS2W(sx, sy);
  if(typeof _techMineralAt === 'function' && _techMineralAt(w.x, w.y)) return false;
  if(typeof _techBldgRectAt === 'function' && _techBldgRectAt(w.x, w.y)) return false;
  const cw = _techCW(), ch = _techCH();
  for(const e of (G.tech.ents || [])){
    if(e.type === 'bldg') continue;
    if(Math.abs(e.x - w.x) <= cw && Math.abs(e.y - w.y) <= ch) return false;   // 유닛·일꾼·라바·알
  }
  return true;
}
