/* ============================================================================
 * 02-gacha.js — 가챠 등급 시스템 — 데이터
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ============================================================================
// 가챠 등급 시스템 — 데이터 구조 (1단계: 데이터만. 뽑기/조합/특성/상점제거는 다음 단계)
//   설계서: "네모네모 디펜스 — 가챠 등급 시스템 설계서"
//   ※ 기존 게임 로직과 분리된 신규 데이터. stats는 0(추후 확정), 일부 이름은 (미정).
// ============================================================================
const GACHA_TIERS = {   // 확률 합 = 1.000 (0.547+0.25+0.12+0.055+0.02+0.006+0.002) — 초월·갓 기본 확률 소폭 상향(대신 TIER_MUL 소폭 하향)
  common:    { name:'일반',   prob:0.547, combine:true,     serverNotify:false },
  rare:      { name:'레어',   prob:0.250, combine:true,     serverNotify:false },
  epic:      { name:'에픽',   prob:0.120, combine:true,     serverNotify:false },
  unique:    { name:'유니크', prob:0.055, combine:true,     serverNotify:false },
  legend:    { name:'레전드', prob:0.020, combine:true,     serverNotify:true  },
  transcend: { name:'초월',   prob:0.006, combine:true,     serverNotify:true  },
  god:       { name:'갓',     prob:0.002, combine:false,    serverNotify:true  },
};
const GACHA_TIER_ORDER = ['common','rare','epic','unique','legend','transcend','god'];
// 등급 → 단계 번호 1..7(단일 소스). 프레임 사다리(data-tr)·정렬·비교가 전부 이걸 쓴다.
// ⚠ 등급 순서를 배열 리터럴로 다시 적지 말 것 — 여기 하나만 고치면 전부 따라온다.
function tierRank(id){ const i=GACHA_TIER_ORDER.indexOf(id); return i<0? 1 : i+1; }
function tierName(id){ return (GACHA_TIERS[id]||{}).name || '일반'; }
// 🎰 단계형 뽑기 곡선(공용) — 동료·펫이 '같은 형태'를 쓴다. 새 뽑기를 만들 때도 이 함수를 쓸 것.
//   문턱 need(k) = needA·(needB^(k-1) − 1)   → 초반은 촘촘하고 위로 갈수록 간격이 벌어진다
//   확률 p(t,k) ∝ w0[t]·wg[t]^(k-1)          → wg<1 이면 비중이 줄고, >1 이면 는다
//   ⚠ tiers 에는 '실제로 뽑을 게 있는 등급'만 넣는다 — 없는 등급에 확률을 주면 그만큼 헛돈다.
function buildGachaCurve(cfg){ const out=[];
  for(let k=1;k<=cfg.max;k++){
    const need=Math.round(cfg.needA*(Math.pow(cfg.needB,k-1)-1));
    const w={}; let tot=0;
    for(const t of cfg.tiers){ const v=cfg.w0[t]*Math.pow(cfg.wg[t],k-1); w[t]=v; tot+=v; }
    const p={}; for(const t of cfg.tiers) p[t]=w[t]/tot;
    out.push({need:need, p:p}); }
  return out; }
// 유닛 생성 헬퍼. race: union(유니온) / aetherial(에테리얼) / swarm(스웜)
function _gUnit(id, displayName, tier, race, attackType, opt){ opt=opt||{};
  return { id, displayName, tier, race, attackType,
    stats:{ damage:0, fireRate:0, range:0 },   // 수치 추후 확정
    traits: opt.traits||[], combineFrom: opt.combineFrom||null }; }
const GACHA_UNITS = {   // 4종 × 7등급 = 28 (이름 확정)
  // ── 일반 (common) ──
  ranger_c:   _gUnit('ranger_c','레인저','common','union','single'),
  strider_c:  _gUnit('strider_c','기갑병','common','union','single'),
  sentinel_c: _gUnit('sentinel_c','센티넬','common','aetherial','single'),
  reaper_c:   _gUnit('reaper_c','스파이크','common','swarm','single'),
  // ── 레어 (rare) = 일반 라인 강화형 (3× 해당 common → rare) ──
  ranger_r:   _gUnit('ranger_r','레인저','rare','union','single', {combineFrom:'ranger_c'}),
  strider_r:  _gUnit('strider_r','기갑병','rare','union','single', {combineFrom:'strider_c'}),
  sentinel_r: _gUnit('sentinel_r','센티넬','rare','aetherial','single', {combineFrom:'sentinel_c'}),
  reaper_r:   _gUnit('reaper_r','스파이크','rare','swarm','single', {combineFrom:'reaper_c'}),
  // ── 에픽 (epic) ──
  phantom_e:  _gUnit('phantom_e','저격수','epic','union','single'),
  racer_e:    _gUnit('racer_e','레이서','epic','union','single'),
  void_e:     _gUnit('void_e','보이드','epic','aetherial','single'),
  snapper_e:  _gUnit('snapper_e','척후병','epic','swarm','single'),
  // ── 유니크 (unique) = 에픽 라인 강화형 (3× 해당 epic → unique) ──
  phantom_u:  _gUnit('phantom_u','저격수','unique','union','single', {combineFrom:'phantom_e'}),
  racer_u:    _gUnit('racer_u','레이서','unique','union','single', {combineFrom:'racer_e'}),
  void_u:     _gUnit('void_u','보이드','unique','aetherial','single', {combineFrom:'void_e'}),
  snapper_u:  _gUnit('snapper_u','척후병','unique','swarm','single', {combineFrom:'snapper_e'}),
  // ── 레전드 (legend) = 특성 1개 ──
  machinegun_l: _gUnit('machinegun_l','화력병','legend','union','single_rapid', {traits:['atkspd_buff']}),
  tank_l:       _gUnit('tank_l','공성전차','legend','union','aoe_single', {traits:['def_down']}),
  blade_l:      _gUnit('blade_l','광전사','legend','aetherial','single', {traits:['armor_pierce']}),
  thornqueen_l: _gUnit('thornqueen_l','가시여왕','legend','swarm','dot', {traits:['poison']}),
  // ── 초월 (transcend) = 특성 1~2개 ──
  phantom_t:    _gUnit('phantom_t','저격수','transcend','union','aoe_single', {traits:['armor_pierce','def_down']}),
  skyguard_t:   _gUnit('skyguard_t','전투기','transcend','union','aoe_single', {traits:['slow']}),
  skydancer_t:  _gUnit('skydancer_t','요격기','transcend','aetherial','aoe_rapid', {traits:['atk_buff']}),
  matron_t:     _gUnit('matron_t','여제','transcend','swarm','single_chain', {traits:['slow','poison']}),
  // ── 갓 (god) = 특성 2개 ──
  ranger_god:   _gUnit('ranger_god','레인저','god','union','single_chain', {traits:['atk_buff','armor_pierce']}),
  strider_god:  _gUnit('strider_god','기갑병','god','union','aoe_rapid', {traits:['def_down','slow']}),
  sentinel_god: _gUnit('sentinel_god','센티넬','god','aetherial','single_rapid', {traits:['atkspd_buff','atk_buff']}),
  reaper_god:   _gUnit('reaper_god','스파이크','god','swarm','dot', {traits:['poison','slow']}),
};
// 초월 레시피 폐지 — 레전드 3개도 단순 조합으로 초월(랜덤)이 된다. (빈 맵 유지: 참조 안전)
const TRANSCEND_RECIPE = {};
// 2단계 임시 매핑: 가챠 유닛 → 기존 유닛 ID(모델·성능). 실제 전용 모델·수치는 4단계에서 교체.
const GACHA_PROXY = {
  ranger_c:'marine',  strider_c:'goliath', sentinel_c:'dragoon', reaper_c:'hydra',
  ranger_r:'marine',  strider_r:'goliath', sentinel_r:'dragoon', reaper_r:'hydra',
  phantom_e:'ghost',  racer_e:'marine',    void_e:'archon',      snapper_e:'hydra',
  phantom_u:'ghost',  racer_u:'marine',    void_u:'archon',      snapper_u:'hydra',
  machinegun_l:'marine', tank_l:'goliath', blade_l:'dragoon',    thornqueen_l:'hydra',
  phantom_t:'ghost',  skyguard_t:'turret', skydancer_t:'photon', matron_t:'archon',
  ranger_god:'marine', strider_god:'goliath', sentinel_god:'dragoon', reaper_god:'hydra',
};
// 무기 계열 오버라이드 — 프록시(임시 stats용)와 정체성이 다른 유닛: 레이서=메카닉, 매트론=저그.
// (나머지는 프록시 계열이 정체성과 일치) → 업글 공유가 유닛 종류대로 적용됨.
const GACHA_WPN = { racer_e:'mech', racer_u:'mech', matron_t:'zrg' };
function gachaWpn(u){ return (u && u.gid && GACHA_WPN[u.gid]) || ((U[u.id]||{}).wpn); }
// 가챠 유닛 전용 3D 모델(있으면 프록시 모델 대신 사용). 키=가챠 id → 값=MODELS 키
const GACHA_MODEL = {
  machinegun_l:'machinegun', tank_l:'tank', blade_l:'blade', thornqueen_l:'thornqueen',
  skyguard_t:'skyguard', skydancer_t:'skydancer', matron_t:'matron',
  racer_e:'racer', racer_u:'racer', snapper_e:'snapper', snapper_u:'snapper',   // 레이서·스내퍼 전용 모델(에픽·유니크 공용)
};
// 등급 표시 색
function hpBarColor(r){ return r>.5?'#46f06a':r>.25?'#ffd24a':'#ff5c5c'; }   // HP바 색(전 화면 공통)
function barHTML(cls,pct,color){ return '<div class="'+cls+'"><i style="width:'+pct+'%'+(color?';background:'+color:'')+'"></i></div>'; }   // 진행바 공통 마크업
function _barsHTML(o){   // 🛡 쉴드+HP(한 칸) + ⚡마나(아래 별도 칸) 공용 바 — o:{hpR, hpCol, shR(null=쉴드없음), enR(null=마나없음), w(px)}
  let m='<div class="uhpMain">'+((o.shR!=null)?barHTML('ub uS',o.shR*100):'')+barHTML('ub uH',o.hpR*100,o.hpCol)+'</div>';
  if(o.enR!=null) m+=barHTML('ub uE',o.enR*100);
  return '<div class="uhp"'+(o.w?' style="width:'+o.w+'px"':'')+'>'+m+'</div>'; }
function popShow(id){ const e=document.getElementById(id); if(e) e.classList.remove('hide'); return e; }   // 팝업 표시(공통)
function popHide(id){ const e=document.getElementById(id); if(e) e.classList.add('hide'); return e; }    // 팝업 숨김(공통)
const TIER_COLOR = { common:'#b8c0cc', rare:'#4aa8ff', epic:'#b06bff', unique:'#ffd23b', legend:'#ff8a3b', transcend:'#ff4d6d', god:'#ff2bd6' };
// 🏷 등급 프레임 조각(단일 소스) — 착용 칸(.pdSlot.on)·가방 칸(.igCell)이 이 한 함수로만 등급을 입는다.
//    반환값 = 여는 태그에 그대로 붙이는 속성들. 안쪽에 TIER_FRAME_HTML 을 꼭 같이 넣을 것(프레임 층).
//    ⚠ 등급 색/단계를 호출부에서 다시 계산하지 말 것 — 두 화면이 어긋나는 건 늘 이 지점이었다.
function tierFrame(tier, extraStyle){ const col=TIER_COLOR[tier]||TIER_COLOR.common;
  return ' data-tr="'+tierRank(tier)+'" style="'+(extraStyle||'')+'border-color:'+col+'aa;color:'+col+'"'; }
const TIER_FRAME_HTML='<i class="tfx"></i>';
// #rrggbb → "r,g,b" — 세그먼트 바의 --segCol 은 알파를 얹어 쓰므로 색이 아니라 채널 셋이어야 한다
function hexChannels(h){ const m=/^#?([0-9a-f]{6})$/i.exec(h||''); if(!m) return '255,255,255';
  const v=parseInt(m[1],16); return ((v>>16)&255)+','+((v>>8)&255)+','+(v&255); }
// 등급 띠 = 장비창·사냥터와 같은 세그먼트 바(segNavHTML). 선택 색만 등급색으로 덮는다.
function tierSegHTML(tierSet, cur, fnName){
  const i=Math.max(0, tierSet.indexOf(cur));
  return segNavHTML(tierSet.map(t=>({ label:GACHA_TIERS[t].name, col:hexChannels(TIER_COLOR[t]) })), i,
    k=>fnName+"('"+tierSet[k]+"')"); }
// 등급별 전투 능력치 배율(프록시 기준 데미지·체력에 곱함) — 상위 등급일수록 강함. 밸런스 추후 조정.
/* TIER_MUL → NEMO_BAL.tierMul */   // 레어=높은 기본뎀(초반 체감↑) / 초월·갓 기본 배율 소폭 하향(105→92, 270→235: 확률 상향 보상)
/* UP_TIER_MUL → NEMO_BAL.upTierMul */   // 레어 업글배율=일반과 근접(중반엔 일반과 수렴) / 유니크는 에픽보다 확실히 높음 / 초월·갓 집중   // 레전드 13→9: 풀업 레전드가 20라운드를 깨지 않게(초월=클리어 라인 유지, 봇 시뮬 검증)   // 업그레이드 1회당 증가폭 등급 배율(기본딜 배율의 절반 강도)   // 등급당 ×2.2 — 등급 업=급격한 성장(설계: 초월 조합=클리어 라인, 갓=초반 캐리)
function gachaTierMul(u){ return (u && u.gtier && TIER_MUL[u.gtier]) || 1; }
// 단순 조합 사다리: 같은 유닛 3개 → 다음 등급 랜덤 1종. 갓까지 전부 단순 조합으로 도달(갓=최종).
const SIMPLE_COMBINE_TIERS = { common:'rare', rare:'epic', epic:'unique', unique:'legend', legend:'transcend', transcend:'god' };   // 단순 조합으로 끝까지: 레전드 3개 → 초월 랜덤 / 초월 3개 → 갓 랜덤 (레시피 폐지)
// 별은 등급별로 늘어나지 않음 — 같은 이름이 두 등급에 걸쳐 있어(일반·레어=레인저, 에픽·유니크=팬텀)
// 강화형(레어·유니크)만 ★ 하나로 구분하는 단순 장치. 나머지(이름이 겹치지 않는 등급)는 별 없음.
const UPGRADED_TIER = { rare:true, unique:true };
function tierStars(tier){ return UPGRADED_TIER[tier] ? '★' : ''; }
// 가챠 유닛 표시 이름 = 이름 (+ 강화형이면 ★). u=게임유닛(gtier/gname), def=기본 정의(폴백)
function gNameStar(u, def){ const base=(u&&u.gname)||(def&&def.name)||''; const s=(u&&u.gtier)?tierStars(u.gtier):'';
  return s ? base+' '+s : base; }
const GACHA_COST = 40;   // 1회 뽑기 크레딧 비용(덜 자주 — 한 마리 더 강하게)
const RACER_CD = 12;     // 레이서 공격 쿨다운(프레임/60fps) = 5발/초. 데미지는 DPS 유지 위해 퍼샷 대폭 감소
const FAST_CD = { racer:RACER_CD, machinegun:8 };   // gmodel별 초고속 발사 쿨다운(발칸=8프레임≈7.5발/초). 데미지는 DPS 유지로 퍼샷 감소
const CD_OVR = { phantom_t:130, skyguard_t:60, skydancer_t:8, ranger_god:78, strider_god:90, sentinel_god:150, reaper_god:6 };   // 센티넬 갓: 초저속 한방   // gid별 쿨다운 오버라이드 — 디토네이터=느린 한방 / 템페스트=중속 단발 / 스카이댄서=초고속 연사
const GDMG_OVR = { skyguard_t:{dmg:28,up:12}, skydancer_t:{dmg:4,up:2}, ranger_god:{dmg:16,up:5}, strider_god:{dmg:12,up:4}, sentinel_god:{dmg:50,up:20}, reaper_god:{dmg:3,up:1} };
// 업글 밸런스 원칙: 발수·공속 정규화 — 업글당 DPS 증가가 유닛 간 비슷해지도록 up을 조정.
// 느린 한방(센티넬 20, 템페스트 12)=업글 표시값 큼 / 초고속 연사(리퍼 1, 스카이댄서 2)=작음 /
// 다발사격(레인저 5, 스트라이더 4)=발수만큼 증폭되므로 낮게. 오버라이드 없는 유닛은 cd 비례 보정이 자동 정규화.   // 센티넬 갓: 광역 풀데미지 한방   // 스트라이더 갓: 발당 중간 데미지(볼리 6발×, 소광역 스플래시 별도)   // 레인저 갓: 발당 고정 고데미지(볼리 5발×, cd비례 보정 제외)   // 스카이댄서=저공격력(좁은 광역 초고속으로 보완)   // gid별 기본 공격 오버라이드 — 구조물 프록시(터렛75/포톤321)의 비정상 수치 교정(명시 dmg+cd → cd비례 보정 제외)
const AIR_FLOAT_GIDS = { skyguard_t:1, skydancer_t:1 };   // 비행체 gid(엔진 분사·부양 연출 대상)
function cdOf(u,def){ return (CD_OVR[u.gid]||FAST_CD[u.gmodel]||def.cd)/((G.teamSpd)||1); }   // 팀 공속버프 → 장전 단축
// 가챠 유닛 base(gid에서 등급접미사 제거) → 사거리 배율(기본 1). 근접형 유닛 사거리 단축
function gachaBase(u){ return (u&&u.gid) ? u.gid.replace(/_(c|r|e|u|l|t|god)$/,'') : null; }
const GACHA_RANGE_MUL = { void:0.6, snapper:0.6, machinegun:0.65, blade:0.6, thornqueen:1.15, matron:0.65 };   // 매트론=근접(팔 휘두름)   // 발칸=근거리 / 워든=근접 / 베놈퀸=약간 장거리
function gachaRangeMul(u){ if(u&&u.gid==='phantom_t') return 1.8;   // 디토네이터: 장거리 포격(에픽·유니크 팬텀과 무관)
  if(u&&u.gid==='ranger_god') return 2.2;   // 레인저 갓: 장거리 저격
  if(u&&u.gid==='strider_god') return 1.8;   // 스트라이더 갓: 장거리 미사일 폭격
  if(u&&u.gid==='sentinel_god') return 1.3;   // 센티넬 갓: 중장거리 대구체
  if(u&&u.gid==='reaper_god') return 1.3;     // 리퍼 갓: 중장거리 연사
  const b=gachaBase(u); return (b&&GACHA_RANGE_MUL[b])||1; }

