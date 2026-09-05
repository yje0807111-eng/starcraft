/* ============================================================================
 * 04-profile.js — 개인 프로필 RPG — 스탯 · 레벨 곡선 · 환생 · 펫 · 유즈맵↔사냥터 경제
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ============================================================================
// 🧍 개인 프로필 RPG (1단계) — 유즈맵 경제와 완전 분리. 재화=pcoin(≠coins). G/유즈맵 밸런스 절대 미접촉.
// 이 블록은 PLAYER_META.profile만 읽고 쓴다. metaBonus/bankRunPoints/gainMineral/step에는 절대 등장 금지.
// ============================================================================
const PROF_STATS=['pow','vit','foc','agi'];   // 공격 / 체력 / 집중(치명) / 민첩(속도)
const PROF_STAT_NAME={pow:'공격',vit:'체력',foc:'집중',agi:'민첩'};
// 캐릭터 종류 3종(종족당 하나) — 게임에 이미 있는 유닛을 그대로 쓴다(초상·3D 모델 공용). id = 뿌리 직업 id.
const PROF_CLASSES={
  ranger:{ name:'레인저', unit:'marine',  race:'union',     ico:'🪖', tip:'원거리 사격 · 균형' },
  scout: { name:'척후병', unit:'snapper', race:'swarm',     ico:'🐛', tip:'빠른 기동 · 근접' },
  warden:{ name:'워든',   unit:'blade',   race:'aetherial', ico:'🔮', tip:'중장갑 근접 · 방어' },
};
const PROF_MAX_CHARS=1;   // 계정당 캐릭터 하나(선택 화면 폐지 — profEnsureChar 가 기본 유닛을 지급한다)
// 직업 = 뿌리 3종뿐이다(2026-08-12 전직 폐지). 캐릭터는 만든 그대로 끝까지 간다.
//   ⚠ 옛 상위 직업 12종은 삭제된 게 아니라 **동료(HB_MATES)로 옮겨 갔다** — 영입해서 함께 싸운다.
//      전직 관련 함수(profClassChange·profClassCost·hbGrowJobs·PROF_JOB_PARENT)도 같이 없어졌다.
//      옛 저장은 migrateProfile(v7)이 뿌리로 되돌리면서 그 동료를 무료로 넣어 준다.
// 직업(PROF_JOBS)은 폐지됐다(2026-08-18). 하던 일이 '기본 스탯 3종 차이'뿐이었는데
// 스탯 출처를 넷(업그레이드·레벨 포인트·장비·환생 포인트)으로 정리하면서 같이 걷어냈다.
// ⚠ 캐릭터 종류(PROF_CLASSES)는 남아 있다 — 그건 직업이 아니라 '외형·3D 모델·던전 스킬'이고,
//    나중 길드 종족 선택이 쓸 표다. 성능에는 일절 관여하지 않는다.
const PROF_JOB_MIG=['ranger','scout','warden'];   // v7 마이그레이션이 '옛 뿌리 직업'을 알아보는 데만 쓴다
// 장비 슬롯 — reqLv = 캐릭터 레벨(성장 축 하나로 통일).
// 초반엔 기본 5칸(헬멧·상의·하의·신발·무기)만 열려 있고 레벨이 오르며 나머지가 열린다.
// part = 페이퍼돌 페이지(PROF_GEAR_PAGES). 한 페이지에 자기 part만 나오므로 칸이 널널하다.
// x/y = 그 페이지 아바타 위에 겹쳐 놓을 위치(%). 그 장비가 실제로 붙는 부위에 맞춘다.
const PROF_GEAR={
  helmet:  {name:'헬멧',    stat:'vit', base:6,  part:'armor', x:50, y:9,  reqLv:1,  ico:'🪖'},
  gloves:  {name:'장갑',    stat:'pow', base:5,  part:'armor', x:21, y:34, reqLv:5,  ico:'🧤'},
  top:     {name:'상의',    stat:'vit', base:8,  part:'armor', x:50, y:34, reqLv:1,  ico:'👕'},
  weapon:  {name:'무기',    stat:'pow', base:10, part:'armor', x:79, y:34, reqLv:1,  ico:'⚔'},
  bottom:  {name:'하의',    stat:'vit', base:7,  part:'armor', x:50, y:60, reqLv:1,  ico:'👖'},
  shoes:   {name:'신발',    stat:'agi', base:6,  part:'armor', x:50, y:84, reqLv:1,  ico:'👟'},
  earring: {name:'귀고리',  stat:'foc', base:5,  part:'acc',   x:26, y:11, reqLv:16, ico:'💠'},
  cape:    {name:'망토',    stat:'agi', base:5,  part:'acc',   x:74, y:11, reqLv:30, ico:'🧣'},
  necklace:{name:'목걸이',  stat:'foc', base:6,  part:'acc',   x:50, y:28, reqLv:12, ico:'📿'},
  sub:     {name:'보조무기', stat:'pow', base:5, part:'acc',   x:21, y:52, reqLv:25, ico:'🛡'},
  ring:    {name:'반지',    stat:'foc', base:4,  part:'acc',   x:79, y:52, reqLv:20, ico:'💍'},
  belt:    {name:'벨트',    stat:'vit', base:5,  part:'acc',   x:50, y:73, reqLv:8,  ico:'🎗'},
};
// 페이퍼돌 페이지 — 장비와 장신구를 섞지 않는다(한 페이지엔 자기 part만).
const PROF_GEAR_PAGES=[{id:'armor',name:'장비'},{id:'acc',name:'장신구'}];
function profPageSlots(pg){ return Object.keys(PROF_GEAR).filter(k=>PROF_GEAR[k].part===pg); }
// 슬롯 라인아트 글리프(자체 제작 · viewBox 24) — 이모지 대신 이걸 쓴다.
// 각 장비가 한눈에 구분되도록 특징부(투구 바이저 · 벨트 버클 · 검 손잡이 · 방패 문양 …)까지 그린다.
const PROF_SLOT_ICON={
  helmet:'<path d="M5 15.2v-2.4a7 7 0 0 1 14 0v2.4a5 5 0 0 1-2.3 4.2l-1.4.9H8.7l-1.4-.9A5 5 0 0 1 5 15.2z"/>'
        +'<path d="M9 10.6h6v3.2h-2v3.4h-2v-3.4H9z"/>',
  top:'<path d="M8.6 3.4L4 6.1l1.9 4.3 2.1-1V20.6h8V9.4l2.1 1L20 6.1l-4.6-2.7a3.4 3.4 0 0 1-6.8 0z"/>'
     +'<path d="M9.4 3.7L12 6.6l2.6-2.9"/>',
  bottom:'<path d="M6.4 3.4h11.2v2.8H6.4z"/><path d="M6.7 6.4h10.6l.9 14.2h-4.1L12 12.2l-2.1 8.4H5.8z"/>',
  shoes:'<path d="M7.4 3.6h4.2v9.1l5 2.4c1.9.9 2.9 2 2.9 3.5v1.8H7.4z"/>'
       +'<path d="M7.4 17.7h12.1"/><path d="M8.4 6.2h2.6M8.4 8.7h2.6"/>',
  gloves:'<path d="M8 15.9L5.5 14a1.5 1.5 0 0 1 1.8-2.4l1.7 1.3z"/>'      /* 엄지 */
        +'<path d="M8.9 13.6V8.8a1.2 1.2 0 0 1 2.4 0v4.8z"/>'              /* 손가락 3 */
        +'<path d="M11.3 13.6V7.5a1.2 1.2 0 0 1 2.4 0v6.1z"/>'
        +'<path d="M13.7 13.6V8.3a1.2 1.2 0 0 1 2.4 0v5.3z"/>'
        +'<path d="M7.6 12.5h9.5v8.1H7.6z"/><path d="M7.6 18h9.5"/>',       /* 손등 + 커프 */
  belt:'<path d="M1.6 10.4h7.6v3.4H1.6z"/><path d="M14.8 10.4h7.6v3.4h-7.6z"/>'
      +'<path d="M9.2 8.3h5.6v7.6H9.2z"/><path d="M12 8.3v7.6"/>'
      +'<circle cx="17.6" cy="12.1" r=".8"/><circle cx="20.2" cy="12.1" r=".8"/>',
  weapon:'<path d="M12 2.2l2.7 3.5v9.1H9.3V5.7z"/><path d="M12 5.2v9.6"/>'
        +'<path d="M6.4 14.9h11.2v2H6.4z"/><path d="M10.7 16.9h2.6v3.1h-2.6z"/><circle cx="12" cy="21" r="1.1"/>',
  sub:'<path d="M12 2.5l7.7 2.9v5.7c0 4.7-3.4 7.9-7.7 8.6-4.3-.7-7.7-3.9-7.7-8.6V5.4z"/>'
     +'<path d="M12 5.1l5.2 2v3.9c0 3.2-2.3 5.5-5.2 6-2.9-.5-5.2-2.8-5.2-6V7.1z"/><path d="M12 5.1v11.9M6.8 11.1h10.4"/>',
  necklace:'<path d="M5.2 3.8a9.2 7.4 0 0 0 13.6 0"/><path d="M12 8.8v2.9"/>'
          +'<path d="M12 11.7l3 3.4-3 4.6-3-4.6z"/>',
  earring:'<path d="M9.2 5.4a2.9 2.9 0 0 1 5.4 1.5v1.9"/><path d="M12 9.4l3.3 3.7-3.3 5.3-3.3-5.3z"/>',
  ring:'<circle cx="12" cy="15.6" r="5.3"/><circle cx="12" cy="15.6" r="2.9"/>'
      +'<path d="M12 3.2l2.9 3.1-2.9 3.4-2.9-3.4z"/><path d="M9.5 9.6h5"/>',
  cape:'<path d="M6.6 4.2c2 1.5 3.6 2.1 5.4 2.1s3.4-.6 5.4-2.1l3 16.4H3.6z"/>'
      +'<path d="M9 4.5a3.2 3.2 0 0 0 6 0"/><path d="M12 6.4v14.2M8.4 9.4l-1.3 11.2M15.6 9.4l1.3 11.2"/>',
};
// 잠금 표시 — 이모지 대신 자물쇠 아이콘을 칸 가운데에 얹는다
const PROF_LOCK_SVG='<svg class="pdLockIco" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">'
  +'<path d="M7.6 10.4V7.6a4.4 4.4 0 0 1 8.8 0v2.8"/><path d="M5.4 10.4h13.2v9.4H5.4z"/><circle cx="12" cy="14.6" r="1.4"/><path d="M12 16v1.8"/></svg>';
function _slotGlyph(slot){ return '<svg class="slIco" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round" stroke-linecap="round">'
  +(PROF_SLOT_ICON[slot]||'')+'</svg>'; }
// 🖼 장비 아이콘 — 그림 파일이 있으면 그걸 쓰고, 없으면 위 라인아트 글리프로 돌아간다.
//    파일 규칙: assets/icons/gear/<부위>_<등급>.webp (등급별 그림) → assets/icons/gear/<부위>.webp (부위 공용)
//    ⚠ 없는 파일을 src 로 걸면 칸마다 404가 난다(가방이 40칸이다) → '있는 것만' 아래 목록에 적는다.
//      그림을 넣은 뒤 여기에 키를 추가할 것. 규칙과 규격은 assets/icons/gear/README.md 에 있다.
const GEAR_ART = new Set([
  // 예) 'weapon', 'weapon_legend', 'helmet_god'
]);
function gearIco(slot, tier){
  const k = (tier && GEAR_ART.has(slot+'_'+tier)) ? (slot+'_'+tier) : (GEAR_ART.has(slot) ? slot : '');
  return k ? '<img class="slIco" src="assets/icons/gear/'+k+'.webp" alt="">' : _slotGlyph(slot); }
function _emptyGear(){ const o={}; for(const k in PROF_GEAR) o[k]=''; return o; }
function profSlotLocked(slot){ const g=PROF_GEAR[slot], c=CHAR(); return !g || !c || c.level < (g.reqLv||1); }
// 장비 아이템 — 인벤토리는 계정 공용(PROF().items), 장착은 캐릭터별(c.unit.gear[slot]=iid).
// 등급 확률은 프로필 전용 표다. 유즈맵 가챠 밸런스(GACHA_TIERS.prob)를 절대 건드리지 않는다(표시 색만 TIER_COLOR 공용).
// ⚠ 등급 id·순서·색은 계정 공용 사다리(GACHA_TIER_ORDER / GACHA_TIERS / TIER_COLOR)를 그대로 쓴다.
//    장비만 5단계였던 것을 2026-08-18에 7단계로 맞췄다 — 동료·펫과 등급 이름이 어긋나면 같은 게임으로 안 읽힌다.
//    여기서 정하는 건 '장비에서의 값'뿐이다(배수·옵션 수·드랍 가중·상점가).
const PROF_ITEM_TIERS=[
  { id:'common',    mul:1.00, opts:0, p:55,   cost:120  },
  { id:'rare',      mul:1.35, opts:1, p:27,   cost:340  },
  { id:'epic',      mul:1.80, opts:2, p:12,   cost:900  },
  { id:'unique',    mul:2.40, opts:3, p:5,    cost:2200 },
  { id:'legend',    mul:3.20, opts:4, p:1,    cost:0    },   // cost 0 = 상점 판매 안 함(드랍 전용)
  { id:'transcend', mul:4.30, opts:5, p:0.25, cost:0    },
  { id:'god',       mul:6.00, opts:6, p:0.05, cost:0    },
];
const PROF_ITEM_PREFIX={ common:'낡은', rare:'단단한', epic:'벼려진', unique:'각인된', legend:'전설의',
                         transcend:'초월한', god:'신좌의' };
const PROF_INV_MAX=40;               // 가방 칸(계정 공용)
function profItemTier(id){ return PROF_ITEM_TIERS.find(t=>t.id===id) || PROF_ITEM_TIERS[0]; }
function _profTierRoll(bonus){       // bonus↑ = 상위 등급 가중(던전 층이 깊을수록)
  const w=PROF_ITEM_TIERS.map((t,i)=>t.p*(1+i*(bonus||0)));
  let tot=0; for(const v of w) tot+=v;
  let r=Math.random()*tot;
  for(let i=0;i<w.length;i++){ if(r<w[i]) return PROF_ITEM_TIERS[i]; r-=w[i]; }
  return PROF_ITEM_TIERS[0]; }
function profSlots(){ return Object.keys(PROF_GEAR).filter(s=>!profSlotLocked(s)); }
function profMakeItem(slot, lv, tierId){ const g=PROF_GEAR[slot]; if(!g) return null;
  lv=Math.max(1, lv||1);
  const T=tierId? profItemTier(tierId) : _profTierRoll(Math.min(0.9,(lv-1)*0.06));
  const main=Math.max(1, Math.round(g.base*T.mul*(1+(lv-1)*0.35)));
  const opts=[], pool=PROF_STATS.filter(k=>k!==g.stat);
  for(let i=0;i<T.opts;i++){ const k=pool[Math.floor(Math.random()*pool.length)];
    const v=Math.max(1, Math.round(g.base*0.4*T.mul*(1+(lv-1)*0.28)*(0.7+Math.random()*0.6)));
    const ex=opts.find(o=>o.k===k); if(ex) ex.v+=v; else opts.push({k:k, v:v}); }
  return { iid:'it'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
           slot:slot, tier:T.id, lv:lv, main:main, opts:opts }; }
function profItemName(it){ const g=PROF_GEAR[it.slot]; return (PROF_ITEM_PREFIX[it.tier]||'')+' '+(g?g.name:'장비'); }
function profItemPower(it){ let s=it.main; for(const o of it.opts) s+=o.v; return s; }
function profItems(){ const p=PROF(); if(!Array.isArray(p.items)) p.items=[]; return p.items; }
function profFindItem(iid){ return iid? (profItems().find(i=>i.iid===iid)||null) : null; }
function profItemHolder(iid){ if(!iid) return null;
  for(const c of PROF().chars) for(const s in c.unit.gear) if(c.unit.gear[s]===iid) return c;
  return null; }
function profAddItem(it){ if(!it) return null; const inv=profItems();
  if(inv.length>=PROF_INV_MAX) return null; inv.push(it); return it; }
function profEquipItem(iid){ const c=CHAR(), it=profFindItem(iid); if(!c||!it) return false;
  if(profSlotLocked(it.slot)) return false;
  const h=profItemHolder(iid); if(h && h!==c) return false;              // 다른 캐릭터가 장착 중
  c.unit.gear[it.slot] = (c.unit.gear[it.slot]===iid) ? '' : iid;        // 같은 것을 누르면 해제
  profSyncUnlocks(); saveMeta(); return true; }
function profScrapValue(it){ const T=profItemTier(it.tier); return Math.round(12*T.mul*(1+(it.lv-1)*0.5)); }
function profScrapItem(iid){ const p=PROF(), inv=profItems(), i=inv.findIndex(x=>x.iid===iid);
  if(i<0 || profItemHolder(iid)) return -1;                              // 장착 중엔 분해 불가
  const v=profScrapValue(inv[i]); inv.splice(i,1); p.pcoin+=v; saveMeta(); return v; }
const PROF_IDLE_SOURCES={ drill:{name:'훈련장',rate:0.6,tip:'공격 위주'}, library:{name:'수련관',rate:0.6,tip:'집중 위주'}, arena:{name:'투기장',rate:1.0,reqUnlock:'idle_arena',tip:'고수익'} };
// 레벨 해금 — 전부 실제로 무언가를 연다(표시만 하는 항목을 두지 않는다).
// idle_arena→훈련장 장소 / evolve→진화 / idle_8h·idle_12h→오프라인 상한
// turret_plus→hbBuildMax()
// ⚠ 장착 칸(펫·동료)은 여기 없다 — 레벨이 아니라 미네랄로 여는 것이다(mgBuySlot).
// ⚠ 게이트는 '레벨'이다(2026-08-12 설계 전환 — 옛 기준은 파워였다).
//   설계 의도: 혼자 라운드 미는 게 막힐 때쯤 새 요소가 '하나씩' 열려야 한다 → 한꺼번에 열리면 안 된다.
//   그래서 간격을 레벨 곡선이 무거워지는 속도에 맞춰 벌려 둔다(초반 촘촘 → 후반 성김).
//   ⚠ 표를 고칠 땐 lv가 오름차순이고 서로 3레벨 이상 떨어져 있어야 한다 — 스모크가 검사한다.
const PROF_UNLOCKS=[
  {id:'idle_arena', lv:5,   label:'투기장 자동수익'},
  {id:'idle_8h',    lv:20,  label:'오프라인 8시간·100%'},
  {id:'turret_plus',lv:50,  label:'터렛 최대 +2'},
  {id:'idle_12h',   lv:80,  label:'오프라인 12시간'},
];
// 해금 판정에 쓰는 레벨 — 환생해도 이미 연 것은 유지되고(unlocks에 영구 기록),
// 새로 여는 기준은 '지금 캐릭터 레벨'이다.
function profUnlockLv(){ const c=CHAR(); return c? (c.level||1) : 1; }
const PROF_OFF_CAP_MIN=4*60, PROF_OFF_RATE=0.5, PROF_OFF_CAP8_MIN=8*60, PROF_OFF_RATE8=1.0, PROF_OFF_CAP12_MIN=12*60;   // 오프라인 상한/비율(idle_8h 해금 시 8h/100%)
// 곡선(순수함수)
// 📈 레벨 곡선 — 설계: "초반은 아주 빠르게, 뒤로 갈수록 배로" (2026-08-12 확정)
//   PROF_LV_SOFT 미만 = 다항식(옛 50·lv^1.5보다 가벼워 30레벨까지 약 2.6배 빨리 도달)
//   그 이상       = 등비수열 — 레벨당 ×PROF_XP_GEO 라 약 7.3레벨마다 필요량이 2배가 된다.
//   두 식은 lv=PROF_LV_SOFT 에서 값이 같아 이어진다(경계에서 튀지 않는다).
//   ⚠ 벽에 부딪히는 지점이 곧 '환생할 때'다 — 아래 PROF_REB_* 와 한 세트로 움직인다.
// 🎯 설계(2026-08-19): **Lv100 까지는 싸게, 그 뒤로 완만한 기하**.
//   소프트캡이 곧 첫 환생 레벨이다 — 100 전까지는 멱함수라 쭉쭉 오르고, 100부터 비용이 붙기 시작한다.
//   ⚠ 이 곡선이 레벨 속도를 정한다. 환생 배수(REB_LIN)는 이제 선형이라 여기와 묶여 있지 않다.
const PROF_LV_SOFT=100;                      // 여기까지는 빠르게 = 첫 환생 레벨
const PROF_XP_A=16, PROF_XP_P=1.15;          // 초반 곡선 계수 — Lv100 누적 ≈ 147k(옛 곡선의 1/9.6)
// ⚠ 값을 만질 때: 60레벨(환생 포인트 한 칸) 구간마다 GEO^60 배씩 무거워진다.
//    1.008=×1.61(너무 완만) · 1.012=×2.05 · 1.02=×3.28(급격). 1.012 가 '점점 힘들되 급하지 않게'다.
const PROF_XP_GEO=1.012;                     // 이후 레벨당 배수
function profXpForLevel(lv){ lv=Math.max(1, lv|0);
  if(lv<PROF_LV_SOFT) return Math.round(PROF_XP_A*Math.pow(lv,PROF_XP_P));
  const b=PROF_XP_A*Math.pow(PROF_LV_SOFT,PROF_XP_P);
  return Math.round(b*Math.pow(PROF_XP_GEO, lv-PROF_LV_SOFT)); }
// ══ 🔁 환생 (2026-08-19 전면 개편 — 유한 사다리 → 연속) ══════════════════════════════════
//   **Lv100 부터 언제든, 몇 번이든.** 회차가 아니라 **그때의 레벨**이 보상을 정한다.
//   되돌리는 것: 레벨·경험치·레벨 포인트 · 미네랄 업그레이드 레벨 · 미네랄 재화 · 진행 던전/라운드.
//   그대로: 업그레이드 해금 · 최고 기록 · 환생 포인트 · 장비 · 펫 · 가스 · 젬 · 뽑기권.
//
//   ⭐ 축이 둘로 갈린다(2026-08-19 재조정) — 섞으면 반드시 한쪽이 폭주한다.
//      ① **환생 배수(XP·미네랄) = 선형**. 사이클을 빠르게 돌리는 역할만 한다.
//         ⛔ 기하로 되돌리지 말 것 — 배수가 XP 수입을 올리고, 그 수입이 다음 사이클 레벨을 올리고,
//            배수가 g^레벨 이라 또 커진다. 되먹임이다. 실측으로 5회 만에 Lv1411 · 배수 ×1900만이 됐다.
//      ② **환생 포인트(전투력) = 복리**. 던전을 뚫는 힘은 여기서만 나온다.
//         적 체력이 라운드에 대해 지수(HB_ROUND_HP^prog)라, 어딘가 하나는 지수여야 진행이 된다.
//         미네랄 업그레이드는 값이 덧셈인데 비용이 곱셈이라 log(미네랄)로 눌린다 — 그 역할을 못 한다.
//   ⛔ 옛 사다리(PROF_REB_LEVELS 7회)로 되돌리지 말 것 — 요구 레벨 사이 구간이 통째로 버려졌다
//      (Lv174 환생 = Lv145 환생과 동일 보상).
const PROF_REB_MIN_LV=100;                   // 첫 환생 = 소프트캡과 같은 레벨
const REB_LIN=0.01;                          // 배수 = (레벨 - 100) × 이 값 — 선형(폭주 없음)
// 🔹 환생 포인트 지급 — **log(초과레벨)** 꼴이다(2026-08-19).
//    ⛔ 레벨 비례(선형)로 되돌리지 말 것: 초반엔 모자라고 후반엔 과해서
//       던전마다 필요한 레벨이 거꾸로 줄어든다(실측 D1 334 · D2 720 · D3 1017 — 뒤로 갈수록 짧아졌다).
//       log 면 초반에 넉넉하고 후반에 크게 눌려서, 던전이 오를수록 레벨이 더 든다.
//       (√ 도 시도했으나 던전2가 698 로 목표 550 보다 높았다 — 더 눕혀야 했다)
const PROF_REB_RP_K=60;                      // 지급 = 1 + floor(K × ln(1 + 레벨-100))
const PROF_REB_EVERY=PROF_REB_MIN_LV;        // 옛 이름 호환(= 첫 환생 레벨)
function profRebDone(c){ c=c||CHAR(); return Math.max(0,(c&&c.reb)|0); }      // 지금까지 환생한 횟수
// 다음 환생에 필요한 레벨 — 늘 '지금까지 쓴 최고 레벨 + 1' 이상이고, 최소 PROF_REB_MIN_LV.
function profRebNextLv(c){ c=c||CHAR();
  return Math.max(PROF_REB_MIN_LV, ((c&&c.rebLvMax)|0)+1); }
// 🔺 이 레벨에서 환생하면 얻는 경험치·미네랄 배수(초과분). Lv100 이면 정확히 0.
//    ⚠ 선형이다. 이 값은 '사이클 속도'만 정한다 — 전투력은 환생 포인트가 맡는다.
function profRebGainAt(lv){ return Math.max(0,(lv|0)-PROF_REB_MIN_LV)*REB_LIN; }
// 🔹 이 레벨에서 환생하면 받는 환생 포인트 — 아주 조금씩만 는다.
function profRebGrantAt(lv){ const over=Math.max(0,(lv|0)-PROF_REB_MIN_LV);
  return 1+Math.floor(PROF_REB_RP_K*Math.log(1+over)); }
// ⚠ rebLvMax = 이미 환생에 쓴 최고 레벨. 같은 레벨에서 두 번 환생하는 것을 막는다.
// 🔑 환생 관문 — 2회차부터 **유즈맵 전용 재화(포인트)** 를 요구한다.
//   설계: 평소엔 강제가 없고(1회차 무료), 사냥터 최상위 축을 끝까지 밀려면 결국 유즈맵을 하게 된다.
//   ⛔ 사냥터에서 얻을 수 있는 재화로 바꾸지 말 것 — 그러면 관문이 아니라 그냥 비용이 된다.
// ⚠ 옛 값은 회차 인덱스 배열이라 환생이 무한이 된 지금은 8회차부터 공짜가 됐다 → 레벨 비례 공식으로.
//   깊이 밀수록 관문도 비싸진다(보상이 커지는 만큼). 첫 환생(Lv100)은 그대로 무료다.
const PROF_REB_POINT_R=3;                    // 요구 포인트 = (레벨 - 100) × 이 값
function profRebPoint(c){ c=c||CHAR();
  return Math.max(0, ((c&&c.level)|0)-PROF_REB_MIN_LV)*PROF_REB_POINT_R; }
function profRebPointOk(c){ const need=profRebPoint(c);
  return need<=0 || (((typeof PLAYER_META!=='undefined'&&PLAYER_META.coins)||0) >= need); }
// ⚠ '지난번보다 높은 레벨' 이 조건이다 — 같은 레벨에서 두 번 누르면 공짜 포인트가 된다.
function profCanRebirth(c){ c=c||CHAR(); if(!c) return false;
  return (c.level|0)>=profRebNextLv(c) && profRebPointOk(c); }
function profXpMul(c){ c=c||CHAR(); return 1+((c&&c.rebMul)||0); }
// 💠 미네랄 획득 배수 — 환생으로 미네랄과 업그레이드가 0이 되는 대신 버는 속도가 빨라진다.
// ⚠ 경험치와 **같은 누적치(c.rebMul)** 에서 꺼낸다. 따로 세면 두 배수가 언젠가 갈라진다.
const PROF_REB_COIN_R=0.7;                   // 미네랄 배수 = 경험치 누적치 × 이 비율(조금 느리게 는다)
function profCoinMul(c){ c=c||CHAR(); return 1+PROF_REB_COIN_R*((c&&c.rebMul)||0); }
// ⚠ 미네랄 '획득'은 반드시 이 함수를 지난다 — 지급 지점이 여럿이라 배수를 각자 곱하면 언젠가 어긋난다.
//    되돌려받는 것(분해 환급·마이그레이션 보정)은 획득이 아니므로 여기를 안 지난다.
function profGainCoin(n){ const p=PROF(); if(!p || !(n>0)) return 0;
  const got=n*profCoinMul(); p.pcoin=(p.pcoin||0)+got; return got; }
// ⚠ 경험치 지급은 반드시 이 함수를 지난다 — 지급 지점이 4곳이라 배수를 각자 곱하면 언젠가 어긋난다.
function profGainXp(c, xp){ c=c||CHAR(); if(!c || !(xp>0)) return 0;
  const got=xp*profXpMul(c); c.xp+=got; return got; }
function profRebirth(c){ c=c||CHAR(); if(!profCanRebirth(c)) return 0;
  { const cost=profRebPoint(c); if(cost>0){ PLAYER_META.coins=(PLAYER_META.coins||0)-cost; } }   // 🔑 관문 = 유즈맵 포인트 차감
  const N=profRebDone(c)+1, LV=(c.level|0);          // 보상은 회차가 아니라 **이 레벨**이 정한다
  c.reb=N; c.rebMul=(c.rebMul||0)+profRebGainAt(LV);  // ⚠ 곱이 아니라 합 — 초과분끼리 더한다
  c.rp=(c.rp|0)+profRebGrantAt(LV);                  // 🔁 환생 포인트 지급(영구 — 다시 환생해도 안 사라진다)
  c.rebLvMax=Math.max(c.rebLvMax|0, c.level|0);      // 이 레벨은 다 썼다
  c.level=1; c.xp=0; if(c.unit){ c.unit.level=1; c.unit.pts={}; }   // 레벨 포인트는 레벨에서 나오므로 같이 되감는다
  // 🔄 계정 진행도도 되감는다 — 이제 미네랄 축이 '한 회차짜리'다(2026-08-18).
  //    ⚠ 해금(unl)과 최고 기록(best)은 남긴다: 해금비를 6번 다시 내면 매 회차 초반이 답답하고,
  //      best 를 지우면 던전 해금과 라운드 선택이 통째로 사라진다.
  try{ const p=PROF(), H=hbHunt();
    H.upg={};                                        // 미네랄 업그레이드 레벨
    // ⭐ 진행은 **던전 1-1 부터 다시** 시작한다 — 되감기가 환생의 값이다.
    //    ⚠ 다만 '깼던 구간'은 열린 채로 남는다: hunt.best 를 지우지 않으므로
    //       라운드 선택(hbSetRound)·던전 이동(hbGoDungeon)으로 곧장 돌아갈 수 있다.
    //       환생 포인트가 영구라 대개 바로 복귀할 수 있고, 약하면 hbDie 가 알아서 내려 준다.
    //    ⛔ hunt.best 를 같이 지우지 말 것 — 그러면 던전 해금과 복귀 경로가 통째로 사라진다.
    H.dg=1; H.round=1;
    p.pcoin=0;                                       // 미네랄 재화 — 안 지우면 즉시 되사서 리셋이 무의미
  }catch(e){}
  try{ saveMeta(); }catch(e){}
  return N; }
// 스탯/파워(전부 read-only)
// 장비가 주는 스탯 합(pow/vit/foc/agi) — 이제 이 네 키는 '장비 전용 꼬리표'다.
// ⚠ 직업 기본치·진화★·레벨 자동증가·펫 %는 전부 뺐다(2026-08-18). 스탯 출처는 넷뿐이다:
//    사냥터 업그레이드 · 레벨 포인트 · 장비 · 환생 포인트. 여기에 다시 무언가를 더하지 말 것.
function profStat(k){ const c=CHAR(); if(!c) return 0;
  let gear=0;
  for(const slot in c.unit.gear){ const it=profFindItem(c.unit.gear[slot]); if(!it) continue;
    const g=PROF_GEAR[slot]; if(g && g.stat===k) gear+=it.main;
    for(const o of it.opts) if(o.k===k) gear+=o.v; }
  return Math.round(gear); }
// 파워 = 대략적인 세기 한 줄. 전투 수치에서 뽑는다(장비 스탯만 보던 옛 식은 업그레이드·포인트를 무시했다).
function profPower(){ const dps=csVal('atk')*(csVal('aspd')/100)*(1+(csVal('crit')/100)*(csVal('critd')/100-1));
  return Math.round(dps*2 + csVal('hp')*0.15); }
function profHasUnlock(id){ const p=PROF(); if(p.unlocks[id]) return true; const u=PROF_UNLOCKS.find(x=>x.id===id); return !!u && profUnlockLv()>=u.lv; }
function profSyncUnlocks(){ const p=PROF(), lv=profUnlockLv(); for(const u of PROF_UNLOCKS){ if(!p.unlocks[u.id] && lv>=u.lv) p.unlocks[u.id]=true; } }   // 한 번 넘으면 영구(환생해도 안 닫힌다)
// 레벨업(xp→level, 스탯 포인트 지급). 유닛 레벨도 동반 상승.
// 성장은 두 축이다 — 캐릭터(레벨→스탯 포인트, 마을 광장에서 배분) / 계정(미네랄→업그레이드 6종).
// 둘 다 hbCharStats()에서 합산된다.
const PROF_LV_MINERAL=10;   // 레벨업 보상 = 미네랄. 성장 축은 미네랄 업그레이드(HB_UPG) 하나로 통일했다.
function profApplyLevelUps(c){ c=c||CHAR(); if(!c) return 0; let ups=0;
  // ⛔ 레벨 상한을 다시 두지 말 것 — 상한이 있으면 '계속 두면 성장'이 거기서 멎는다(2026-08-19).
  //    비용이 기하로 오르므로 상한 없이도 알아서 눕는다.
  while(c.xp>=profXpForLevel(c.level) && ups<9999){
    c.xp-=profXpForLevel(c.level); c.level++; c.unit.level++; ups++; }
  if(ups>0) profGainCoin(ups*PROF_LV_MINERAL);        // 레벨업 = 미네랄(환생 배수를 탄다)
  if(ups>0 && c.lpAuto) lpAutoSpend(c);               // 🤖 자동 배분 — 켜 뒀으면 받은 포인트를 바로 찍는다
  return ups; }
// 방치 수익(분당 pcoin) = 파워 기반 × 소스 배율
// 방치·오프라인 수입(분당) = 자동사냥에서 실제로 벌던 속도 × 훈련 장소 배율 × 펫 코인%.
// ⚠ 옛 공식(파워 기반 고정치)은 자동사냥 수입의 1/8 수준이라 잠수 보상이 제일 약한 역전이 있었다.
//   아직 한 라운드도 못 깬 신규 유저만 옛 공식으로 떨어진다.
// 아직 한 라운드도 못 깬 신규만 쓰는 값. 라운드 1 실적(분당 15 남짓)보다 확실히 낮게 둔다 —
// 높게 잡으면 '가만히 있는 게 이득'이 된다. ⛔ 파워(profPower) 기반으로 되돌리지 말 것:
// 레벨 포인트가 배수라 파워는 지수로 튀고, 폴백이 실측을 앞질러 버린다.
const PROF_IDLE_BASE=8;
function profIdleRate(){ const p=PROF(), src=PROF_IDLE_SOURCES[p.idle.sourceId]||PROF_IDLE_SOURCES.drill;
  const H=p.hunt, base=(H&&H.rate>0) ? H.rate*60 : PROF_IDLE_BASE;
  return base * (src.rate||0.6) * (1+profPetBonus('coin')); }
// 🐾 펫 (프로필 전용 % 보너스 — 유즈맵과 무관). 중복 = 별(★). 티어 색은 TIER_COLOR 재사용.
const PROF_PETS={
  slime:  {name:'슬라임',   emoji:'🟢', tier:'common', bonus:{type:'coin',val:0.03}},
  chick:  {name:'병아리',   emoji:'🐤', tier:'common', bonus:{type:'vit', val:0.02}},
  wolf:   {name:'늑대',     emoji:'🐺', tier:'rare',   bonus:{type:'atk', val:0.04}},
  owl:    {name:'부엉이',   emoji:'🦉', tier:'rare',   bonus:{type:'coin',val:0.05}},
  golem:  {name:'골렘',     emoji:'🗿', tier:'epic',   bonus:{type:'vit', val:0.07}},
  tiger:  {name:'호랑이',   emoji:'🐯', tier:'epic',   bonus:{type:'atk', val:0.08}},
  phoenix:{name:'불사조',   emoji:'🔥', tier:'unique', bonus:{type:'coin',val:0.10}},
  dragon: {name:'드래곤',   emoji:'🐲', tier:'legend', bonus:{type:'atk', val:0.15}},
};
// 🎰 펫 뽑기 — 동료 뽑기와 '같은 형태'다(2026-08-12). 곡선은 공용 buildGachaCurve.
//   다른 점은 두 가지뿐: ① 펫은 등급이 5종(초월·갓 펫이 없다) ② 강화 축이 레벨이 아니라 별(★)이다.
//   ⚠ 확률을 줄 등급에 실제 펫이 있어야 한다 — PET_TIERS 는 PROF_PETS 에서 뽑아 만든다.
const PET_TIERS=GACHA_TIER_ORDER.filter(t=>{ for(const id in PROF_PETS) if(PROF_PETS[id].tier===t) return true; return false; });
const PROF_PET_GACHA_MAX=30;
const PROF_PET_NEED_A=12, PROF_PET_NEED_B=1.16;   // 동료와 같은 문턱(30단계 876회)
// 등급이 5종이라 최상위(레전드)가 동료의 '갓' 자리를 맡는다 — 1단계 0.0001%에서 시작한다.
const PROF_PET_W0={common:900,  rare:90,   epic:10,   unique:1,    legend:0.001};
const PROF_PET_WG={common:0.78, rare:0.85, epic:0.94, unique:1.06, legend:1.22};
const PROF_PET_GACHA=buildGachaCurve({max:PROF_PET_GACHA_MAX, needA:PROF_PET_NEED_A, needB:PROF_PET_NEED_B,
  tiers:PET_TIERS, w0:PROF_PET_W0, wg:PROF_PET_WG});
const PROF_PET_START_TICKETS=5;      // 처음 열 때 쥐여 주는 펫 뽑기권
// 🎟 뽑기권은 미네랄로 살 수 없다 — 엘리트 처치 · 맵의 상자 · 라운드 보너스로 얻고, 💎 젬으로만 산다.
//   (젬 = 유일한 현질 재화. 미네랄로 사면 방치 수입이 곧 뽑기가 되어 등급 설계가 무너진다.)
//   ※ 퀘스트 보상은 아직 퀘스트 시스템 자체가 없다 — 생기면 여기 dgAddTicket 을 부르면 된다.
const TICKET_GEM={ally:5, pet:4, gear:3};
const TICKET_NAME={ally:'동료', pet:'펫', gear:'장비'};
function buyTicketGem(kind){ const p=PROF(), c=TICKET_GEM[kind]; if(!c) return false;
  if(profGem()<c) return false;
  p.gem=(p.gem||0)-c; if(!p.tickets) p.tickets={gear:0,pet:0,ally:0};
  p.tickets[kind]=(p.tickets[kind]||0)+1; saveMeta(); return true; }
const PROF_PET_PT={common:1, rare:3, epic:9, unique:27, legend:81};   // 중복 1장이 주는 재료 포인트
const PROF_PET_STAR_MAX=5;
const PROF_BONUS_NAME={atk:'공격 %',vit:'체력 %',coin:'코인 %'};
// 보유 상태 = { star:별, dup:합성 재료로 쓸 중복 수, fed:이번 별에 넣어 둔 재료 }
function profPetRec(id){ const p=PROF(); return (p.pets&&p.pets[id])||null; }
function profPetStar(id){ const r=profPetRec(id); return r? Math.max(0, r.star||0) : 0; }
function profPetDup(id){ const r=profPetRec(id); return r? (r.dup||0) : 0; }
function profPetOwned(id){ return !!profPetRec(id); }
function profPetVal(id){ const P=PROF_PETS[id]; return P? P.bonus.val*(1+profPetStar(id)*0.2) : 0; }
function profPetBonus(type){ const p=PROF(); let s=0; for(const id of (p.equip||[])){ const P=PROF_PETS[id]; if(P&&P.bonus.type===type) s+=profPetVal(id); } return s; }
// ── 뽑기 단계 · 확률 ──
function profPetN(){ const p=PROF(); if(typeof p.petN!=='number') p.petN=0; return p.petN; }
function profPetStage(n){ n=(n==null)?profPetN():n;
  let i=0; for(let k=0;k<PROF_PET_GACHA.length;k++) if(n>=PROF_PET_GACHA[k].need) i=k;
  return i; }
function profPetLv(n){ return profPetStage(n)+1; }
function profPetProbs(n){ return PROF_PET_GACHA[profPetStage(n)].p; }
function profPetNext(){ const st=profPetStage(), nx=PROF_PET_GACHA[st+1];
  return nx? {lv:st+2, left:Math.max(0, nx.need-profPetN())} : null; }
function profPetTicket(){ const p=PROF(); return (p.tickets&&p.tickets.pet)||0; }
// 뽑기 1회 — 펫 뽑기권 1장. 신규면 ★0으로 영입, 중복이면 합성 재료(dup)로 쌓인다.
function profPetRoll(){ const p=PROF(); if(profPetTicket()<=0) return null;
  p.tickets.pet--; p.petN=profPetN()+1;
  if(typeof dqNote==='function') dqNote('gacha',1);   // 📅 일일 — 뽑기(장비·펫·동료 공통)
  const probs=profPetProbs(p.petN-1);                    // ⚠ 이번 판은 '뽑기 전' 확률로 굴린다
  const pool={}; for(const id in PROF_PETS){ const t=PROF_PETS[id].tier; (pool[t]=pool[t]||[]).push(id); }
  let r=Math.random(), tier=null;
  for(const t of PET_TIERS){ const w=(probs[t]||0)*(pool[t]?1:0); if(w<=0) continue;
    if(r<w){ tier=t; break; } r-=w; }
  if(!tier){ for(let i=PET_TIERS.length-1;i>=0;i--){ const t=PET_TIERS[i];
    if((probs[t]||0)>0 && pool[t]){ tier=t; break; } } }     // 반올림 잔차 — 열려 있는 최상위로
  const list=pool[tier], id=list[Math.floor(Math.random()*list.length)];
  const isNew=!profPetOwned(id);
  if(!p.pets) p.pets={};
  if(isNew){ p.pets[id]={star:0, dup:0, fed:0};
    if((p.equip||[]).length<profPetSlots()) p.equip.push(id); }   // 신규 + 빈 슬롯 = 자동 장착
  else p.pets[id].dup=(p.pets[id].dup||0)+1;
  saveMeta(); return { id:id, tier:tier, star:profPetStar(id), isNew:isNew, lv:profPetLv() }; }
// ── 합성 — 중복 펫을 '직접 골라' 재료로 넣어 별(★)을 올린다 ──
function profPetPt(id){ return PROF_PET_PT[(PROF_PETS[id]||{}).tier]||1; }
function profPetNeed(id){ const P=PROF_PETS[id]; if(!P) return 0;
  return Math.ceil(PROF_PET_PT[P.tier]*2*Math.pow(1.5, profPetStar(id))); }
function profPetFed(id){ const r=profPetRec(id); return r? (r.fed||0) : 0; }
function profPetFeed(targetId, matId){
  if(!profPetOwned(targetId) || !PROF_PETS[matId]) return false;
  if(profPetStar(targetId)>=PROF_PET_STAR_MAX) return false;
  if(profPetDup(matId)<=0) return false;
  const p=PROF(), T=p.pets[targetId];
  p.pets[matId].dup--;
  T.fed=(T.fed||0)+profPetPt(matId);
  let up=0;
  while(profPetStar(targetId)<PROF_PET_STAR_MAX && T.fed>=profPetNeed(targetId)){
    T.fed-=profPetNeed(targetId); T.star=(T.star||0)+1; up++; }
  saveMeta(); return up? up : true; }
// 상점: 미네랄 → 펫 뽑기권

function profPetEquip(id){ const p=PROF(); if(!p.pets[id]) return false; const i=p.equip.indexOf(id);
  if(i>=0){ p.equip.splice(i,1); saveMeta(); return true; }                                // 토글 해제
  if(p.equip.length>=profPetSlots()) return false; p.equip.push(id); saveMeta(); return true; }
// 🌟 유닛 진화(별)는 폐지됐다(2026-08-18) — 하던 일이 '전 스탯 +2' 하나뿐이라, 스탯 출처를 넷으로
//   정리하면서 같이 걷어냈다. 되감고 다시 키우는 축은 환생(+환생 포인트) 하나로 통일한다.
//   ⚠ 옛 저장의 c.unit.evoStars 는 남아 있을 수 있지만 아무 데서도 읽지 않는다(새 캐릭터엔 필드 자체가 없다).
// 액션(성공 true · saveMeta 포함 · 재렌더는 호출측)
// 성장 축은 미네랄 업그레이드(HB_UPG) 하나다. 레벨업은 미네랄을 주고(PROF_LV_MINERAL),
// 캐릭터 스탯(unit.stats)에 직접 찍는 경로는 없다 — 레벨 포인트도, 자동 배분도 폐지했다.
// unit.stats는 마이그레이션에서 비워지고, 이후로는 직업 기본치·레벨·장비만 profStat에 반영된다.
function profCreateChar(cls, name){ const p=PROF(); if(!PROF_CLASSES[cls] || p.chars.length>=PROF_MAX_CHARS) return null;
  const c=defaultChar(cls, (name||'').trim().slice(0,10)); p.chars.push(c); p.curId=c.id; profSyncUnlocks(); saveMeta(); return c; }
// ── 🧍 기본 지급 ─────────────────────────────────────────────────────────────
// 계정당 캐릭터는 하나다. 고르는 화면도, 만드는 화면도 없다 —
// 처음 들어오면 기본 유닛이 조용히 지급되고 바로 게임으로 간다(2026-08-13 설계 변경).
// 모두 같은 스탯·같은 외형으로 시작해서 각자 키운다.
// 종족은 나중에 '길드 가입' 시점에 고르고, 그때 그 종족 유닛을 추가로 받는다 —
// ⚠ 그래서 PROF_CLASSES 테이블은 지우지 않았다. 길드 종족 선택이 이 표를 그대로 쓴다.
const PROF_DEFAULT_CLASS='ranger';
// 캐릭터가 없으면 조용히 만들어 준다. 반환값 = 지금 캐릭터(항상 있다)
function profEnsureChar(){ return CHAR() || profCreateChar(PROF_DEFAULT_CLASS, ''); }
// 캐릭터 선택·삭제·환급은 폐지했다(계정당 하나) — 고를 것도, 지울 것도 없다.
function profSetIdleSource(id){ const p=PROF(), src=PROF_IDLE_SOURCES[id]; if(!src) return false; if(src.reqUnlock && !profHasUnlock(src.reqUnlock)) return false; p.idle.sourceId=id; saveMeta(); return true; }
// ══ 🔗 유즈맵 ↔ 사냥터 경제 ═══════════════════════════════════════════════
// 유즈맵 보상은 고정값이 아니라 **사냥터 시급에 앵커**한다. 사냥터 재화는 지수(라운드 ×HB_ROUND_REW ·
// 던전 ×그것의 99제곱)라서 고정값은 몇 라운드만 지나면 반올림 오차가 된다 — 실측으로 옛 공식은
// 판당 117 미네랄이었고 그건 던전1 R50 기준 **0.7초치**였다.
//   ⚠ 시급의 단일 소스는 `hunt.rate`(hbSettle 이 EMA 로 적는 '초당 미네랄')다. 방치 수입(profIdleRate)이
//      이미 이 값을 본다 — 유즈맵용 곡선을 새로 만들지 말 것.
//   ⚠ 경험치는 앵커에 붙이지 않는다. 사냥터 XP 곡선(HB_ROUND_XP)만 일부러 완만해서 '레벨이 적 체력을
//      못 따라가는 벽'을 만드는데, XP까지 시급에 앵커하면 그 설계가 통째로 무너진다.
const UM_ANCHOR_MIN=60;              // 판당 기준 = 사냥터 60분치(진행도·난이도로 오르내린다)
const UM_PROG_MIN=0.2;               // 진행도 하한 — 일찍 끝나도 빈손은 아니다
const UM_GAS_RATIO=0.09/0.85;        // 가스:미네랄 = 사냥터 처치 보상(hbKillReward)과 같은 비율
function umRate(){ const p=(typeof PROF==='function')?PROF():null, H=p&&p.hunt;
  return (H && H.rate>0) ? H.rate*60 : PROF_IDLE_BASE; }   // 분당 미네랄 · 첫 라운드 클리어 전에는 방치와 같은 폴백
// 판 진행도 0~1 — '얼마나 해냈나'의 뜻이 맵마다 다르다.
//   네모      : 클리어 = 1.0 · 못 깼으면 도달 라운드 비율 (라운드가 이미 다 말해 준다 — 소모 자원은 안 본다)
//   오토배틀  : 승패 + '번 돈을 굴린 비율' + 버틴 시간 (라운드 개념이 없다)
//   무한      : 클리어가 없다 → 도달 라운드 / 기준 라운드
const UM_STK_W_WIN=0.45, UM_STK_W_SPEND=0.35, UM_STK_W_TIME=0.20;   // 합 1.0 · 패배 상한 = 0.55
const UM_STK_CYCLES=30;              // 만점 기준 사이클 수(cycleTime 20초 × 30 = 10분)
function umProgress(){ if(typeof G==='undefined' || !G) return 0;
  if(G.strike){ const S=(typeof STK!=='undefined'&&STK)?STK:null; if(!S) return 0;
    const me=S.me||{}, pool=(mapCfg('startGold',0)||0)+(me.earned||0);   // 그 판에 쓸 수 있었던 총액
    const sp=(pool>0) ? Math.max(0,Math.min(1,(pool-(me.gold||0))/pool)) : 0;   // ⚠ 소모는 '수입−잔액'으로 파생시킨다 —
    const tm=Math.min(1,(S.round||1)/UM_STK_CYCLES);                            //    골드를 깎는 곳(광산·강화·무기·건설)을 건드리지 않아 새 소모처가 생겨도 안 어긋난다
    return UM_STK_W_WIN*((G.phase==='won')?1:0) + UM_STK_W_SPEND*sp + UM_STK_W_TIME*tm; }
  const rounds=mapCfg('rounds',TOTAL_ROUNDS)||TOTAL_ROUNDS;
  if(mapCfg('infinite')) return Math.min(1,(G.round||0)/rounds);
  return (G.phase==='won') ? 1 : Math.min(1,(G.round||0)/rounds); }
// 🏁 첫 클리어 마일스톤 — 맵×난이도마다 **평생 1회**. 사냥터 마일스톤(hunt.rw[dg][round])과 같은 문법이다.
//   보상 크기는 '사냥터 N시간치'인데, ⚠ **상한을 걸지 않으면 유즈맵을 최대한 늦게 하는 것이 최적 플레이**가 된다
//     (시급이 계속 오르므로). 그래서 min(현재 시급, 난이도별 권장 시급) 으로 막는다.
const UM_DIFF_R={ easy:20, normal:35, hard:50, hell:65, nightmare:80 };   // 난이도별 '권장 사냥터 라운드'(상한 기준)
const UM_FIRST={   // h=사냥터 시간치 · gem/tk=시급과 무관한 절대 재화
  easy:      {h:1,  gem:10,  tk:{gear:1}},
  normal:    {h:2,  gem:20,  tk:{gear:1, pet:1}},
  hard:      {h:4,  gem:40,  tk:{gear:2, ally:1}},
  hell:      {h:8,  gem:80,  tk:{gear:3, pet:1, ally:1}},
  nightmare: {h:16, gem:150, tk:{gear:5, pet:2, ally:2}},
};
const UM_STK_FIRST='hard';   // 오토배틀은 난이도가 없다(noDiff) → '첫 승리' 1회를 이 급으로
// 권장 진행도의 시급(분당 미네랄). ⚠ 사냥터 곡선 함수를 그대로 쓴다 — 새 곡선을 만들면 반드시 어긋난다.
function umCapRate(diff){ const R=UM_DIFF_R[diff]||UM_DIFF_R.normal;
  let foes=0, sec=0; for(let w=1;w<=HB_WAVES;w++){ foes+=hbFoeCount(R,w); sec+=hbWaveTime(w)+HB_GAP_S; }
  return (foes*hbKillReward(1,R).min + hbClearBonus(1,R).min) / (sec/60); }
// 💠 전리품의 룬 — **보상 재화만** 늘린다(사용자 확정 2026-09-02).
//   ⛔ 젬에는 걸지 않는다. 젬으로 산 룬이 젬을 더 준다면 그것은 인쇄기다.
//   ⚠ 이 룬은 일부러 **층을 넘는다**(GEM.md §1: 젬 부스트는 유즈맵에 안 걸린다).
//     대신 승패에는 개입하지 않는다 — 끝난 뒤 받는 재화만 본다.
function umRuneMul(){ return (typeof campRuneMul === 'function') ? campRuneMul('mapGain') : 1; }
function umFirstRw(diff){ const F=UM_FIRST[diff]; if(!F) return null;
  const min=Math.round(Math.min(umRate(), umCapRate(diff))*60*F.h*umRuneMul());
  return Object.assign({ pcoin:min, gas:Math.round(min*UM_GAS_RATIO), gem:F.gem }, F.tk||{}); }
function umClearTbl(){ const M=PLAYER_META; if(!M.umClear) M.umClear={}; return M.umClear; }
function umFirstGot(mapId,diff){ const t=umClearTbl()[mapId]; return !!(t&&t[diff]); }
// 최초 클리어면 지급하고 보상을 돌려준다(중복 지급 불가). 지급은 dqGive 한 곳을 지난다.
function umFirstClaim(mapId,diff){ if(!mapId||!diff||umFirstGot(mapId,diff)) return null;
  const rw=umFirstRw(diff); if(!rw) return null;
  const t=umClearTbl(); if(!t[mapId]) t[mapId]={}; t[mapId][diff]=1;
  if(typeof dqGive==='function') dqGive(rw); else saveMeta();
  return rw; }
// 📅 하루 몇 판째인가 — 목표 세션이 '하루 2~3판'이라 그 숫자를 규칙으로 새긴다.
//   ⚠ 하드 캡이 아니라 체감이다: 4판째부터 30% — 더 해도 손해는 아니고, 짧은 판 반복으로 긁는 것만 막는다.
//   ⚠ 하루 경계는 **_dgDayKey() 하나**를 쓴다(출석·일일 퀘스트와 같은 축) — 새 축을 만들면 하루가 새는 날이 생긴다.
const UM_DAY_FULL=3, UM_DAY_FADE=0.3;
function umDayRec(){ const M=PLAYER_META, dk=_dgDayKey();
  if(!M.umDay || M.umDay.key!==dk) M.umDay={ key:dk, n:0 };
  return M.umDay; }
function umTodayN(){ return umDayRec().n; }                       // 오늘 이미 끝낸 판 수
function umDayMul(){ return (umTodayN()<UM_DAY_FULL)?1:UM_DAY_FADE; }   // 이번 판에 붙을 계수
function umDayCount(){ const r=umDayRec(); r.n++; try{ saveMeta(); }catch(e){} return r.n; }
function umDiffMul(){ const D=(typeof DIFFICULTY!=='undefined')&&DIFFICULTY[G.difficulty];
  return (D&&D.coinMult)||1; }   // 난이도 배율은 DIFFICULTY 표 하나만 본다(두 벌을 두지 말 것)
// 판 종료 보상 — 순수 read G / write profile. _runSummary에서 1회 호출.
function profRunReward(){ const p=PROF();
  const prog=Math.max(UM_PROG_MIN, Math.min(1, umProgress())), dMul=umDiffMul(), day=umDayMul();
  const min=Math.round(umRate()*UM_ANCHOR_MIN*prog*dMul*day*(1+profPetBonus('coin'))*umRuneMul());   // 🐾 펫 코인% · 📅 하루 3판 뒤 체감 · 💠 전리품의 룬
  const gas=Math.round(min*UM_GAS_RATIO);
  const k=G.kills||0, rd=G.round||0;
  const xp=Math.round((10 + k*0.5 + rd*8)*dMul);   // ⚠ 앵커 아님(위 주석 참조)
  const c=CHAR(); profGainXp(c, xp); const ups=profApplyLevelUps(c);
  p.pcoin=(p.pcoin||0)+min; p.gas=(p.gas||0)+gas; profSyncUnlocks();
  const dayN=umDayCount();   // 📅 판 수는 여기서만 센다(정산은 판당 1회다)
  saveMeta();
  return { xp:xp, pc:min, gas:gas, prog:prog, ups:ups, level:c?c.level:1, day:dayN, dayMul:day }; }
// 방치 정산(오프라인/켜둠) — Date.now 기준(1단계 클라이언트 신뢰). 유즈맵과 무관.
function profOfflineCapMin(){ return profHasUnlock('idle_12h')?PROF_OFF_CAP12_MIN
  : profHasUnlock('idle_8h')?PROF_OFF_CAP8_MIN : PROF_OFF_CAP_MIN; }
function profOfflineRate(){ return profHasUnlock('idle_8h')?PROF_OFF_RATE8:PROF_OFF_RATE; }
function profIdleTick(){ if(!PLAYER_META||!PLAYER_META.profile) return; const p=PROF();   // 켜둔 동안 60초마다 100%
  profGainCoin(profIdleRate()); const now=Date.now(); p.lastSeenTs=now; p.idle.lastClaimTs=now; saveMeta();
  if(typeof _townOpen!=='undefined' && _townOpen && typeof renderTownIdle==='function') renderTownIdle(); }
function profStampSeen(){ if(PLAYER_META&&PLAYER_META.profile){ PLAYER_META.profile.lastSeenTs=Date.now(); try{ localStorage.setItem(metaKey(), JSON.stringify(PLAYER_META)); }catch(e){} } }

