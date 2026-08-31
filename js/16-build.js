/* ============================================================================
 * 16-build.js — 건설 탭 — RTS 배치 맵 · 유닛 액션(알/라바/연구/진화/커널/벙커/수리) · 자원 채취
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ══ 건설 탭 — RTS식 배치 맵(종족→일꾼→건물 배치) + 선택 건물 생산/연구 카드 ══
const TECH_START={credit:1500, energy:1000};
const _TECH_RKO={union:'유니온',swarm:'스웜',aetherial:'에테리얼',feral:'페럴',colossus:'콜로서스'};
const TECH_TIME_MUL=0.25;   // 스타 대비 생산·건설 시간 배율(전부 1/4=속도감↑, 기존 0.5에서 다시 절반)
function techUIInit(race){ if(!TECH_TREE[race]) race='union'; _techEnsureRoster(race);   // 공용 로스터 전 유닛 생산 가능하게 보정
  const keep=G.tech?{inf:G.tech.inf,nocool:G.tech.nocool,fog:!!(G.tech.fog&&G.tech.fog.on)}:{};
  G.tech={ race, credit:TECH_START.credit, energy:TECH_START.energy, built:{}, addon:{}, units:{}, research:{}, sup:0, supCap:0, inf:!!keep.inf, nocool:!!keep.nocool, ents:[], sel:null, selU:[], arm:null, eseq:1, pend:[], view:{x:0.5,y:0.5,zoom:1}, sheet:{open:false,sec:null} };
  const main=TECH_TREE[race].buildings[0]; if(main){ G.tech.built[main.k]=1; _techAddSupCap(main.supply||0); const _mf=_techFoot(race,main.k), _ms=_techSnap(0.5,0.3,_mf.w,_mf.h); G.tech.ents.push({eid:G.tech.eseq++, type:'bldg', bk:main.k, x:_ms.cx, y:_ms.cy, bt:0}); }   // 본진 자동 배치(그리드 스냅)
  G.tech.ents.push({eid:G.tech.eseq++, type:'worker', x:0.32, y:0.62});   // 일꾼 1기
  if(race==='swarm'){ const _ov=((main.produces||[]).find(p=>p.id==='overlord')||{}); G.tech.ents.push({eid:G.tech.eseq++, type:'unit', uid:'overlord', x:0.62, y:0.42}); _techAddSupCap(_ov.supply||8); }   // 🐛 스웜은 해처리 인구 1뿐 → 시작 시 너울 1기 기본 제공(+8 인구)
  { const _mcw=_techCW(), _mch=_techCH(); G.tech.minerals=[];   // 💎 미네랄 6개 한 줄(가스 구역 왼쪽, 인접=다닥다닥) — 채취=크레딧. 한 줄이라 모든 덩어리 아래(본진 쪽)가 열려 낑김 없음
    const _offs=[[-7,1],[-6,1],[-5,1],[-4,1],[-3,1],[-2,1]];   // (칸) c0 기준 왼쪽, 가로 1줄·1칸 간격
    for(const o of _offs) G.tech.minerals.push({ eid:G.tech.eseq++, x:TECH_GRID.x0+(TECH_GAS.c0+o[0])*_mcw, y:techY0()+(TECH_GAS.r0+o[1])*_mch, amount:TECH_MINE_START, owner:null, miner:null }); }
  techFogInit(keep.fog); }   // 🌫️ 건설 안개(토글 상태는 종족 전환에도 유지)
const TECH_MINE_START=1500, TECH_GAS_START=5000, TECH_GATHER_AMT=8, TECH_MINE_T=1.2, TECH_GAS_T=1.2;   // 채취 상수: 매장량 · 1회 채취량 · 채취 소요시간
function _techGasRemain(){ if(!G.tech) return TECH_GAS_START; if(G.tech.gasAmt==null) G.tech.gasAmt=TECH_GAS_START; return G.tech.gasAmt; }   // ⛽ 가스 광산(지형) 잔량 = 지속값. 건물 파괴돼도 유지(캐고 남은 만큼 그대로)
function _techBuildTime(race,k){ if(G.tech.nocool) return 0; if(techWallet()) return STK_TECH_BUILD_T;   // 오토배틀: 건물 종류와 무관하게 동일 시간
  return ((techBldgSpec(race,k)||{}).t||20)*TECH_TIME_MUL; }
function _techProdTime(race,id){ if(G.tech.nocool) return 0; return ((techUnitSpec(race,id)||{}).t||15)*TECH_TIME_MUL; }
function _techResearchTime(r){ if(G.tech.nocool) return 0; return (r&&r.t?r.t:(r&&r.tier?24:30))*TECH_TIME_MUL; }   // 업그레이드 소요(스펙 t 있으면 사용, 없으면 티어 24s·일회성 30s)
const TECH_DEF_BLDG={ union:['bunker','turret'], swarm:['sunken','spore'], aetherial:['cannon'], feral:['thornburrow'], colossus:['bastion'] };   // 🛡 방어 건물(공격형)
function _techIsDef(bk){ return (TECH_DEF_BLDG[G.tech.race]||[]).indexOf(bk)>=0; }
function _techBldgKind(b){ if(!b) return '건물'; if(b.produces) return '생산'; if(_techResList(b).length) return '업그레이드'; if(b.gas) return '에너지 채취'; if(_techIsDef(b.k)) return '방어'; if(b.supply) return '인구 공급'; if(b.unlocks) return '해금'; return '건물'; }
// ── 🚀 내부 장전 큐: 캐리어(요격기)·리버(스캐럽) 유닛 + 뉴클리어 사일로(핵) 단일 — 전투 없는 관리 탭이라 '장전 UI'(카운트+타이머+취소 환불) ──
const TECH_AMMO={
  archangel:{ label:'요격기', ico:'✈️', unit:true, m:25, g:0, t:8, cap:4, capUp:8, upKey:'aetherial_carrier_cap' },   // 캐리어 = 인터셉터(최대 4→8)
  reaver:{ label:'스캐럽', ico:'🔺', unit:true, m:15, g:0, t:9, cap:5, capUp:10, upKey:'aetherial_reaver_cap' },      // 리버 = 스캐럽(최대 5→10)
  nuke:{ label:'핵미사일', ico:'☢️', unit:false, m:200, g:200, pop:8, t:75, cap:1 }                                    // 뉴클리어 사일로 = 단일(최대 1, 인구 8)
};
function _techAmmoCap(key){ const a=TECH_AMMO[key]; if(!a) return 0; return (a.capUp && G.tech.research[a.upKey])?a.capUp:a.cap; }
function _techAmmoTime(a){ return G.tech.nocool?0:((a&&a.t||8)*TECH_TIME_MUL); }
function _techChargerEnt(key){ const a=TECH_AMMO[key]; if(!a) return null;
  if(a.unit){ const ids=G.tech.selU||[]; if(ids.length!==1) return null; const e=G.tech.ents.find(x=>x.eid===ids[0]); return (e&&e.type==='unit'&&e.uid===key)?e:null; }
  return (G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'&&x.bk===key):null; }
function _techAmmoInfo(e, key){ const a=TECH_AMMO[key], cap=_techAmmoCap(key), ready=(e&&e._chc)||0, q=(e&&e._chq)||[];
  const queue=[]; for(let i=0;i<cap;i++){ if(i<ready){ queue.push({pro:pIco(a.ico), ready:true, prog:100}); }   // 장전 완료
    else { const j=i-ready, it=q[j]; queue.push(it?{pro:pIco(a.ico), front:j===0, prog:j===0?Math.round((1-it.t/(it.tMax||1))*100):0, act:'onclick="techCancelAmmo(event,\''+key+'\','+j+')"'}:null); } }   // 생산 중/대기(탭=취소)
  const front=q[0], have=ready+q.length; let progLabel,progVal,prog,time;
  if(front){ prog=Math.round((1-front.t/(front.tMax||1))*100); progLabel=a.label+' 생산 중'; progVal=have+'/'+cap; time=Math.ceil(front.t)+'s 남음'; }
  else { progLabel=a.label+' 장전'; progVal=have+'/'+cap; prog=have>=cap?100:0; time=have>=cap?'가득 장전됨':'탭 = 장전'; }
  return { eb:a.label, hideName:true, queue, qcap:cap, qlabel:a.label, progLabel, progVal, prog, cr:0, en:0, time }; }
function techFinishBuild(e){ const b=techGetBldg(G.tech.race,e.bk); if(!b) return; e.bt=0; e.waiting=false; if(b.addonTo) G.tech.addon[b.k]=true; else G.tech.built[b.k]=(G.tech.built[b.k]||0)+1; _techAddSupCap(b.supply||0);
  if(b.gas) e._gasAmt=_techGasRemain();   // ⛽ 가스 건물 = 광산 잔량을 이어받음(재건설 시 5000 리셋 아님)
  for(const w of G.tech.ents){ if(w.type==='worker'&&w.build===e.eid){ w.build=null; w._working=false; w._bpSide=null; w._bpT=null; w.tx=null; w.ty=null; w._wp=null; w._rr=0; } } }   // 건설 완료 → 일꾼 해방(작업상태 초기화)
// 건물에서 유닛 소환 위치 = 발판을 사각형으로 둘러싸며 좌하단에서 반시계로 채움(하단→우측→상단→좌측), 최대한 건물에 붙임(화면 y-down 기준)
// 🥚 알 부화(스웜): 그 자리에서 유닛 등장 — twin(스내퍼·스팅어)=2마리
function techHatchEgg(g){ const race=G.tech.race, n=g.twin?2:1;
  for(let i=0;i<n;i++){ G.tech.units[g.id]=(G.tech.units[g.id]||0)+1;
    const _isWk=(g.id===(TECH_WORKER[race]||'worker_swarm'));
    const _off=(n>1)?((i?1:-1)*0.011):0;
    G.tech.ents.push(_isWk?{eid:G.tech.eseq++, type:'worker', x:Math.max(techBX0(),Math.min(techBX1(),g.x+_off)), y:Math.max(techBY0(),Math.min(techBY1(),g.y+0.006))}
      :{eid:G.tech.eseq++, type:'unit', uid:g.id, x:Math.max(techBX0(),Math.min(techBX1(),g.x+_off)), y:Math.max(techBY0(),Math.min(techBY1(),g.y+0.006)), pop:(g.pop||0)}); }   // pop = 오토배틀 출격 시 인구 반환용
  if(g.supply) _techAddSupCap(g.supply); }
// 🧬 2차 변태: 선택한 유닛(리퍼/와이번)을 그 자리에서 고치(알)로 → 부화 시 고급 유닛
function techDoMorph(ev, to){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return; const race=G.tech.race; if(race!=='swarm'&&race!=='aetherial') return;
  const sel=(G.tech.selU||[]).map(id=>G.tech.ents.find(e=>e.eid===id)).filter(e=>e&&e.type==='unit');
  const u=sel.find(e=>TECH_MORPH[e.uid]&&TECH_MORPH[e.uid].some(m=>m.to===to)); if(!u) return;
  const m=TECH_MORPH[u.uid].find(x=>x.to===to);
  const ok=_techMorphOK(m); if(!ok.ok){ if(typeof toast==='function') toast('⛔ '+ok.why); return; }
  if(race==='aetherial'){   // 🔮 프로토스 융합: 같은 유닛 2마리가 서로 다가가 합쳐져 1마리 생성(홀수는 대기)
    const srcUid=u.uid;
    let pool=sel.filter(e=>e.uid===srcUid && e._fuseP==null);
    if(pool.length<2){ const base=pool[0]||u; let p=null,bd=Infinity;   // 1마리 지정 = 근처 같은 유닛과 짝
      for(const e of G.tech.ents){ if(e.type==='unit'&&e.uid===srcUid&&e!==base&&e._fuseP==null){ const d=Math.hypot(e.x-base.x,e.y-base.y); if(d<bd){ bd=d; p=e; } } }
      if(!p){ if(typeof toast==='function') toast('⛔ 융합할 짝이 없음 (같은 유닛 2마리 필요)'); return; } pool=[base,p]; }
    const pairs=_techPairUp(pool); if(!pairs.length){ if(typeof toast==='function') toast('⛔ 융합할 짝이 없음'); return; }
    for(const pr of pairs) _techStartFusion(pr[0], pr[1], to);
    if(typeof toast==='function') toast('🔮 '+m.name+' 융합('+pairs.length+'쌍)'+((pool.length%2)?' · 1마리 대기':''));
    if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); return; }
  if(_techFailPop(m.dpop)) return;   // 🧬 스웜: 그 자리에서 고치(알)
  if(_techFailRes(m.m,m.g)) return;
  _techSpend(m.m,m.g); G.tech.sup+=(m.dpop||0);
  G.tech.units[u.uid]=Math.max(0,(G.tech.units[u.uid]||0)-1);
  const pt=_techProdTime('swarm',to);   // 그 자리에서 고치(알) → 부화
  G.tech.ents=G.tech.ents.filter(x=>x.eid!==u.eid); G.tech.selU=(G.tech.selU||[]).filter(id=>id!==u.eid);
  const _egg={eid:G.tech.eseq++, type:'egg', x:u.x, y:u.y, id:to, t:pt, tMax:pt, pop:0, supply:0, twin:false};
  if(pt<=0) techHatchEgg(_egg); else G.tech.ents.push(_egg);
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
function _techPairUp(pool){ const rem=pool.slice(), pairs=[];   // 🔮 근접 그리디 짝짓기(2마리씩) — 홀수 1마리는 남김
  while(rem.length>=2){ const a=rem.shift(); let bi=0,bd=Infinity; for(let i=0;i<rem.length;i++){ const d=Math.hypot(rem[i].x-a.x,rem[i].y-a.y); if(d<bd){ bd=d; bi=i; } } pairs.push([a, rem.splice(bi,1)[0]]); } return pairs; }
function _techStartFusion(a,b,to){ const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;   // 두 유닛이 중간점으로 접근 → 만나면 융합
  a._fuseP=b.eid; b._fuseP=a.eid; a._fuseTo=to; b._fuseTo=to; a.tx=mx; a.ty=my; a._wp=null; a._mvStuck=0; b.tx=mx; b.ty=my; b._wp=null; b._mvStuck=0; }
function _techFusionTick(dt){ if(!G.tech||G.tech.race!=='aetherial') return 0; let live=false, done=false;
  for(const a of G.tech.ents){ if(a.type!=='unit'||a._fuseP==null) continue;
    const b=G.tech.ents.find(e=>e.eid===a._fuseP&&e.type==='unit');
    if(!b||b._fuseP!==a.eid){ a._fuseP=null; a._fuseTo=null; a.tx=null; continue; }   // 짝 소멸 → 취소
    live=true; if(a.eid>b.eid) continue;   // 낮은 eid에서만 완료(중복 방지)
    if(Math.hypot(a.x-b.x,a.y-b.y)<0.03){   // 만남 → 융합
      const to=a._fuseTo, mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
      G.tech.units[a.uid]=Math.max(0,(G.tech.units[a.uid]||0)-2); G.tech.units[to]=(G.tech.units[to]||0)+1;
      G.tech.ents=G.tech.ents.filter(e=>e.eid!==a.eid&&e.eid!==b.eid);
      if(G.tech.selU) G.tech.selU=G.tech.selU.filter(id=>id!==a.eid&&id!==b.eid);
      const ne={eid:G.tech.eseq++, type:'unit', uid:to, x:mx, y:my}; G.tech.ents.push(ne); if(G.tech.selU) G.tech.selU.push(ne.eid);
      _techSkFx().push({type:'warp', x:mx, y:my, t:0, dur:0.6}); done=true; if(typeof playSfx==='function') playSfx('ui_confirm'); } }
  return done?2:(live?1:0); }
// 🐛 라바 선택: 선택된 해처리의 라바 전체를 한 번에 잡음 → 라바 생산 패널로
function techSelectLarva(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||G.tech.race!=='swarm') return;
  const hb=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'&&x.bk==='hatchery'):null; if(!hb) return;
  const lv=G.tech.ents.filter(e=>e.type==='larva'&&e.hatch===hb.eid).map(e=>e.eid);
  if(!lv.length){ if(typeof toast==='function') toast('⛔ 라바가 없습니다'); return; }
  G.tech.sel=null; G.tech.selU=lv; const sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null}); sh.open=true; sh.sec='ent';   // 해처리 지정 해제하고 라바 전체 지정
  if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); }
const TECH_LARVA_BLDG={ hatchery:1, lair:1, hive:1 };   // 🐛 라바 생성·라바 선택 프로필 건물(진화 체인 공통 — 진화해도 라바 계속)
function _techLarvaBox(h){ const cw=_techCW(), ch=_techCH(), fh=_techFoot('swarm',h.bk||'hatchery'), yb=h.y+(fh.h/2)*ch;   // 🐛 라바 서식 박스: 가로 3타일, 세로 = 해처리 바로 아래 칸 상단 1/5
  return { x0:h.x-1.5*cw, x1:h.x+1.5*cw, y0:yb, y1:yb+ch*0.2 }; }
// 🔬 연구 카드(단계형=다음 단계 배지 tr · 완료/MAX=비활성) — techBldgUpgModel·라바 건물 공용 단일 소스
function _techResearchCard(b, r, e){ const race=G.tech.race, rj=e&&e._rj, key=race+'_'+r.k, isThis=!!(rj&&rj.rk===r.k); let meta,state,cr,en,tr='';
  // 🏕 캠프는 **가스만** 받고 계열 업그레이드에 상한이 없다(값은 js/19-camp.js · null=캠프 밖)
  const _lv=G.tech.research[key]|0, _cc=(typeof campResearchCost==='function')?campResearchCost(r,_lv):null;
  if(r.tier){ const lv=_lv, isMax=!_cc&&lv>=r.tier.length, nx=_cc||r.tier[Math.min(lv,r.tier.length-1)]; meta=isMax?'MAX':((lv+1)+'단계'); tr=isMax?'MAX':''+(lv+1); cr=isMax?0:nx[0]; en=isMax?0:nx[1]; state=isThis?'busy':(isMax?'max':((rj||!_techAfford(cr,en))?'dim':'ok')); }
  else { const done=G.tech.research[key], _c=_cc||[r.m,r.g]; meta=done?'완료':'연구'; cr=done?0:_c[0]; en=done?0:_c[1]; state=isThis?'busy':(done?'max':((rj||!_techAfford(cr,en))?'dim':'ok')); }
  const _act=isThis?'onclick="techCancelResearch(event)"':(state==='max'?'':'onclick="techDoResearch(\''+b.k+'\',\''+r.k+'\')"');
  return { pro:(SKILLS&&SKILLS[r.k]?skillIcoHTML(r.k):upgIcoHTML(r.k)), sn:r.name, cr, en, meta, metaCls:'lv', tr, state, sel:isThis, act:_act+_techTipAttr('r',r.k,b.k) }; }   // 길게 = 연구 설명
// 🧬 건물 진화 카드 — b.evolveTo(단일/배열)의 각 대상으로 진화. 진행 중(_evo)=busy(남은 초)
function _techEvolveCards(b, e){ if(!b||!b.evolveTo) return []; const race=G.tech.race, evo=(e&&e._evo);
  const tos=Array.isArray(b.evolveTo)?b.evolveTo:[b.evolveTo];
  return tos.map(tk=>{ const tb=techGetBldg(race,tk)||{}, reqok=_techReqMet(tb.req), afford=G.tech.inf||_techAfford(tb.m,tb.g), busy=!!(evo&&evo.to===tk);
    return { pro:pIco(tb.ico||'🧬'), sn:tb.name, cr:busy?0:tb.m, en:busy?0:tb.g,
      meta:busy?(Math.ceil(evo.t)+'s'):'진화', metaCls:'lv', sel:busy, state:evo?(busy?'busy':'dim'):((!reqok||!afford)?'dim':'ok'),
      act:(!evo&&reqok&&afford)?('onclick="techEvolveBldg(event,'+(e?e.eid:'null')+',\''+tk+'\')"'):'' }; }); }
function techEvolveBldg(ev, eid, toK){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;
  const e=G.tech.ents.find(x=>x.eid===eid&&x.type==='bldg'), tb=techGetBldg(G.tech.race,toK); if(!e||!tb||e._evo) return;
  if(!_techReqMet(tb.req)){ if(typeof toast==='function') toast('⛔ 선행 조건 필요'); return; }
  if(_techFailRes(tb.m,tb.g)) return;
  if(!G.tech.inf){ G.tech.credit-=tb.m; G.tech.energy-=tb.g; }
  const _t=G.tech.nocool?0:(((techBldgSpec(G.tech.race,toK)||{}).t||30)*TECH_TIME_MUL);
  if(_t<=0) _techEvolveDone(e, toK); else e._evo={ to:toK, t:_t, tMax:_t };
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
function _techEvolveDone(e, toK){ e.bk=toK; e._evo=null; G.tech.built[toK]=(G.tech.built[toK]||0)+1;   // bk 교체(같은 자리) · 이전 타입 built 유지(테크 만족)
  if(typeof toast==='function') toast('🧬 '+((techGetBldg(G.tech.race,toK)||{}).name)+' 진화 완료'); }
// 🕳 나이더스 커널 — 크립 위에 출구 1개(무료) 연결 · 지상 유닛 1:1 양방향 순간이동 · 한쪽 파괴 = 영구 고장
function techNydusModel(b, e){ const bs=techBldgSpec('swarm','nydus')||{};
  const link=(e&&e._nydusLink!=null)?G.tech.ents.find(x=>x.eid===e._nydusLink&&x.type==='bldg'&&x.bk==='nydus'):null, broken=!!(e&&e._nydusBroken);
  let items=[], desc, eb;
  if(broken){ eb='고장'; desc='연결 건물 파괴 — 영구 고장.'; }
  else if(link){ eb='연결됨'; desc='지상 유닛 즉시 순간이동(양방향).'; items=[{ pro:pIco('🕳'), sn:'출구 보기', state:'ok', act:'onclick="techNydusSelectExit(event,'+e.eid+')"' }]; }
  else { eb='커널'; desc='크립 위에 출구 1개 연결.'; items=[{ pro:pIco('🕳'), sn:'출구 뚫기', meta:'무료', metaCls:'lv', state:'ok', act:'onclick="techNydusDigExit(event,'+e.eid+')"' }]; }
  return { mode:'prod', title:b.name+(link?' <span class="nsub">(연결됨)</span>':(broken?' <span class="nsub">(고장)</span>':'')), icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs.hp,bs.sh), sub:'', items, topRight:_techBldgTR(b),
    info:{ eb, hideName:true, desc, cr:0, en:0 } }; }
function techNydusDigExit(ev, entryEid){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||G.tech.race!=='swarm') return;
  const entry=G.tech.ents.find(e=>e.eid===entryEid&&e.type==='bldg'&&e.bk==='nydus'&&e.bt<=0); if(!entry) return;
  if(entry._nydusLink!=null||entry._nydusBroken){ if(typeof toast==='function') toast('⛔ 출구는 1개만(1:1)'); return; }
  G.tech.arm='nydus'; G.tech.armXY=null; G.tech.armNydusExit=entryEid;
  const sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null}); sh.open=false; if(typeof toast==='function') toast('🕳 크립 위에 출구 뚫기'); techUIRender(); }
function techNydusSelectExit(ev, entryEid){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return; const e=G.tech.ents.find(x=>x.eid===entryEid); if(!e||e._nydusLink==null) return;
  G.tech.sel=e._nydusLink; G.tech.selU=[]; const sh=G.tech.sheet||(G.tech.sheet={}); sh.open=true; sh.sec='ent'; if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); }
function _techPlaceNydusExit(x,y){ const entry=G.tech.ents.find(e=>e.eid===G.tech.armNydusExit&&e.type==='bldg'&&e.bk==='nydus'&&e.bt<=0);
  G.tech.armNydusExit=null; if(!entry||entry._nydusLink!=null){ techCancelArm(); return; }
  const _pf=_techFoot('swarm','nydus'), _ps=_techSnap(x,y,_pf.w,_pf.h);
  const exit={eid:G.tech.eseq++, type:'bldg', bk:'nydus', x:_ps.cx, y:_ps.cy, bt:0, btMax:0, _nydusLink:entry.eid, _nydusExit:true};
  G.tech.ents.push(exit); G.tech.built['nydus']=(G.tech.built['nydus']||0)+1; entry._nydusLink=exit.eid;
  G.tech.arm=null; G.tech.armXY=null; G.tech.sel=entry.eid; const sh=G.tech.sheet||(G.tech.sheet={}); sh.open=true; sh.sec='ent';
  if(typeof playSfx==='function') playSfx('ui_confirm'); if(typeof toast==='function') toast('🕳 출구 연결 완료'); techUIRender(); }
function _techNydusUnlink(e){ if(!e||e.bk!=='nydus'||e._nydusLink==null) return; const other=G.tech.ents.find(x=>x.eid===e._nydusLink&&x.type==='bldg'&&x.bk==='nydus'); if(other){ other._nydusLink=null; other._nydusBroken=true; } }
function techOrderNydus(nydusEid, units){ const nyd=G.tech.ents.find(e=>e.eid===nydusEid&&e.type==='bldg'&&e.bk==='nydus'&&e.bt<=0); if(!nyd||nyd._nydusLink==null) return;
  let n=0; for(const u of units){ if(_techAirOf(u)) continue; if(u.type==='worker'&&u._gKind) _techReleaseGather(u); u._nydusTgt=nydusEid; u.tx=nyd.x; u.ty=nyd.y; u._wp=null; u._mvStuck=0; u._mvPrevD=null; n++; }   // 커널로 이동 지시 → 도착 시 순간이동
  if(n){ if(typeof playSfx==='function') playSfx('ui_confirm'); if(typeof toast==='function') toast('🕳 커널 이동'); techMapRender(); } }
function _techNydusTick(dt){ if(!G.tech||G.tech.race!=='swarm') return 0; let r=0;   // 지정 유닛만 명령 순간이동(양방향) · 출구는 좌하단→반시계
  for(const e of G.tech.ents){ if(e.type==='bldg'&&e.bk==='nydus'&&e._entryCd>0) e._entryCd=Math.max(0,e._entryCd-dt); }   // 건물별 입장 간격 카운트다운(프레임당 1회)
  for(const u of G.tech.ents){ if((u.type!=='unit'&&u.type!=='worker')||u._nydusTgt==null) continue;
    const nyd=G.tech.ents.find(e=>e.eid===u._nydusTgt&&e.type==='bldg'&&e.bk==='nydus'&&e.bt<=0);
    if(!nyd||nyd._nydusLink==null||_techAirOf(u)){ u._nydusTgt=null; continue; }
    const link=G.tech.ents.find(e=>e.eid===nyd._nydusLink&&e.type==='bldg'&&e.bk==='nydus'&&e.bt<=0); if(!link){ u._nydusTgt=null; continue; }
    if(Math.hypot(u.x-nyd.x,u.y-nyd.y) < _techBunkerR(nyd)){   // 입구 도착 → 출구로 순간이동 + 지정 해제
      if(nyd._entryCd>0){ if(r<1) r=1; continue; }   // 앞 유닛 입장 직후 → 간격만큼 대기(한 명씩 순서대로 쭉쭉)
      const sp=_techSpawnPos(link, u.uid||(TECH_WORKER[G.tech.race]||'worker_swarm'));
      u.x=sp.x; u.y=sp.y; u._spawnOf=link.eid; u._spawnSlot=sp.slot; u.tx=null; u.ty=null; u._wp=null; u._nydusTgt=null; u._mvStuck=0; u._mvPrevD=null;
      if(G.tech.selU) G.tech.selU=G.tech.selU.filter(id=>id!==u.eid); nyd._entryCd=0.07; r=2; }
    else { u.tx=nyd.x; u.ty=nyd.y; if(r<1) r=1; } }
  return r; }
// 🧱 벙커: 바이오닉·일꾼 최대 4기 탑승(대피). 유닛 지정 후 벙커 롱프레스 = 탑승 이동 → 도착 시 탑승 · 슬롯 탭 = 하차
function _techBunkerable(e){ return !!(e && e.type==='unit' && (typeof BIONIC!=='undefined') && BIONIC[e.uid]); }   // 바이오닉만(레인저·발칸·메딕·팬텀) — 일꾼 탑승 불가
const _SVG_EJECT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4H6a1 1 0 00-1 1v14a1 1 0 001 1h7"/><path d="M11 12h9"/><path d="M17 8l4 4-4 4"/></svg>';   // 🚪 문틀(3면) + 밖으로 나가는 화살표(전체 하차)
function _techBunkerEjectBtn(e){ if(!e||!e._cargo||!e._cargo.length) return ''; return '<button class="cgLift" onclick="techEjectAllBunker(event,'+e.eid+')" title="전체 하차">'+_SVG_EJECT+'</button>'; }
function techEjectAllBunker(ev, bunkerEid){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;
  const bunk=G.tech.ents.find(x=>x.eid===bunkerEid&&x.type==='bldg'); if(!bunk||!bunk._cargo) return;
  const n=bunk._cargo.length; while(bunk._cargo.length) techUnboardBunker(null, bunkerEid, bunk._cargo.length-1);   // 뒤에서부터 전부 하차
  if(n&&typeof toast==='function') toast('🚪 벙커 전체 하차'); techUIRender(); }
function _techBunkerR(bunk){ const r=_techCollRect(bunk,{type:'unit',uid:'marine'}); return Math.max(0.075, Math.max((r.x1-r.x0),(r.y1-r.y0))/2+0.04); }   // 입장(탑승·순간이동) 도착 반경 = 충돌 사각 경계 + 여유(작은 건물도 최소 0.075) → 확실히 인식
function techOrderBoard(bunkerEid){ if(!G.tech) return; const bunk=G.tech.ents.find(e=>e.eid===bunkerEid&&e.type==='bldg'&&e.bk==='bunker'&&e.bt<=0); if(!bunk) return;
  const cap=4-((bunk._cargo&&bunk._cargo.length)||0);
  if(cap<=0){ if(typeof toast==='function') toast('⛔ 벙커 가득 참 (4/4)'); return; }
  const sel=(G.tech.selU||[]).map(id=>G.tech.ents.find(e=>e.eid===id)).filter(e=>e&&_techBunkerable(e)&&e.build==null);
  if(!sel.length){ if(typeof toast==='function') toast('⛔ 벙커 탑승 = 바이오닉·일꾼만'); return; }
  let n=0; for(const u of sel){ if(n>=cap) break; u._boardTgt=bunkerEid; u.tx=bunk.x; u.ty=bunk.y; u._wp=null; u._mvStuck=0; u._mvPrevD=null; n++; }   // 벙커로 이동 지시 → 도착 시 탑승
  if(typeof playSfx==='function') playSfx('ui_confirm'); if(typeof toast==='function') toast('🧱 벙커로 탑승'); techMapRender(); }
function techUnboardBunker(ev, bunkerEid, idx){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;
  const bunk=G.tech.ents.find(e=>e.eid===bunkerEid&&e.type==='bldg'&&e.bk==='bunker'); if(!bunk||!bunk._cargo||!bunk._cargo[idx]) return;
  const c=bunk._cargo.splice(idx,1)[0], uid=(c.type==='worker')?(TECH_WORKER[G.tech.race]||'worker_human'):c.uid;
  const sp=_techSpawnPos(bunk, uid);   // 🧱 하차 = 유닛 생성과 동일하게 좌하단→반시계 일렬(슬롯 순차)
  const ne={eid:G.tech.eseq++, type:c.type, x:sp.x, y:sp.y, _spawnOf:bunk.eid, _spawnSlot:sp.slot}; if(c.type==='unit') ne.uid=c.uid; G.tech.ents.push(ne);
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
// 🔧 일꾼 수리: 지정 일꾼 + 건물 롱프레스 = 그 건물로 이동해 수리. 건설 중(bt>0) 건물은 수리로 완성 가속(+100%/일꾼). 완성 건물은 손상 개념이 없어 대기 자세.
function techLongPressBldg(eid){ if(!G.tech) return; const b=G.tech.ents.find(x=>x.eid===eid&&x.type==='bldg'); if(!b) return;
  const sel=(G.tech.selU||[]).map(id=>G.tech.ents.find(e=>e.eid===id)).filter(Boolean);
  if(b.bk==='nydus' && b.bt<=0 && b._nydusLink!=null){ const grd=sel.filter(x=>(x.type==='unit'||x.type==='worker')&&!_techAirOf(x)); if(grd.length){ techOrderNydus(eid, grd); return; } }   // 🕳 연결된 커널 = 지상 유닛 순간이동
  if(b.bk==='bunker' && b.bt<=0 && sel.some(_techBunkerable)) techOrderBoard(eid);   // 바이오닉 → 탑승
  const wks=sel.filter(x=>x.type==='worker'&&x.build==null); if(wks.length) techOrderRepair(eid, wks); }   // 일꾼 → 수리
function techOrderRepair(bldgEid, wks){ const b=G.tech.ents.find(x=>x.eid===bldgEid&&x.type==='bldg'); if(!b) return;
  if(b._lifted){ if(typeof toast==='function') toast('⛔ 부양 중 건물은 수리 불가'); return; }
  for(const w of wks){ if(w._gKind) _techReleaseGather(w); w._repairTgt=bldgEid; w.tx=b.x; w.ty=b.y; w._wp=null; w._mvStuck=0; w._mvPrevD=null; }
  if(typeof playSfx==='function') playSfx('ui_confirm'); if(typeof toast==='function') toast('🔧 수리'); techMapRender(); }
function _techRepairTick(dt){ if(!G.tech) return false; let live=false;
  for(const b of G.tech.ents){ if(b.type==='bldg') b._repairN=0; }
  for(const w of G.tech.ents){ if(w.type!=='worker'||w._repairTgt==null) continue;
    const b=G.tech.ents.find(x=>x.eid===w._repairTgt&&x.type==='bldg'&&!x._lifted);
    if(!b){ w._repairTgt=null; w._repairing=false; continue; }
    const fh=_techFoot('union',b.bk), rr=(Math.max(fh.w,fh.h)/2)*_techCH()+0.04;
    if(Math.hypot(w.x-b.x,w.y-b.y)<rr){ w._repairing=true; w.tx=null; if(b.bt>0) b._repairN=(b._repairN||0)+1; live=true; }   // 도착 → 수리(건설 중이면 완성 가속)
    else { w.tx=b.x; w.ty=b.y; w._repairing=false; live=true; } }
  return live; }
function techBunkerModel(b, e){ const bs=techBldgSpec('union','bunker')||{}, cargo=(e&&e._cargo)||[], items=[];
  for(let i=0;i<4;i++){ const c=cargo[i];
    if(c){ const hp=c.hp||(techUnitSpec('union',c.uid)||{}).hp||0;
      items.push({ cls:'cgBunk', pro:_techUnitPortrait(c.uid), sn:_techRealName('union',c.uid)||c.uid, bottom:'<div class="cgBunkHp">'+pIco('❤','sm')+' '+hp+'</div>', state:'ok', act:'onclick="techUnboardBunker(event,'+e.eid+','+i+')"' }); }
    else items.push({ state:'empty' }); }
  return { mode:'prod', title:b.name+' <span class="nsub">('+cargo.length+'/4)</span>', icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs.hp,bs.sh), sub:'', items, topRight:_techBunkerEjectBtn(e),
    info:{ eb:'방어', hideName:true, desc:'최대 4기 탑승. 유닛 지정 후 벙커 길게 누르기 = 탑승.', cr:0, en:0 } }; }
// 🥚 알 지정 시 = 진화 대상 유닛의 프로필(전부 잠금 + 이름 옆 (진화중))
function techEggModel(list){ const e=list[0], id=e.id, race=G.tech.race, spec=techUnitSpec(race,id)||{};
  const rn=_techRealName(race,id)||id;
  const base=techUnitPanelModel([{type:'unit',uid:id}]);   // 그 유닛의 카드 그리드를 잠금 상태로 표시
  const items=(base.items||[]).map(it=>it?Object.assign({}, it, { state:'dim', act:'', sel:false }):null);
  return { mode:'prod', title:rn+' <span class="nsub">(진화중)</span>', icon:_techUnitPortrait(id), hpsh:_cgHpShDual(spec.hp,spec.sh,0), sub:'', items,
    info:{ eb:'진화', hideName:true, stats:_techUnitStatList(spec,id), cr:0, en:0 } }; }
// 라바 지정 시 생산 패널 — 그리드=생성 가능 유닛(카드 1탭=라바 1마리 소모)
function techLarvaProdModel(list){ const hb=techGetBldg('swarm','hatchery')||{produces:[]};
  const items=(hb.produces||[]).filter(p=>p.id===TECH_WORKER.swarm).map(p=>{ const reqok=_techReqMet(p.req), afford=_techAfford(p.m,p.g), popok=G.tech.inf||!p.pop||(G.tech.sup+p.pop<=G.tech.supCap), cnt=G.tech.units[p.id]||0, twin=(p.id==='snapper'||p.id==='stinger');
    return { pro:_techUnitPortrait(p.id), sn:_techRealName('swarm',p.id)+(twin?' ×2':''), cr:p.m, en:p.g, meta:cnt?('×'+cnt):(p.pop?'👤'+p.pop:''), metaCls:cnt?'lv':'', state:(!reqok||!afford||!popok)?'dim':'ok', act:'onclick="techLarvaMorph(event,\''+p.id+'\')"' }; });
  return { mode:'prod', title:'라바 <span class="nsub">('+list.length+'기)</span>', icon:pIco('🐛'), hpsh:'', sub:'', items,
    info:{ eb:'변태', hideName:true, desc:'지정한 라바 전체가 한번에 선택한 유닛으로 변태합니다.', cr:0, en:0, time:'' } }; }   // 아이콘·이름 아래 설명·상단 N기 필·좌하단 스탯 제거(수는 이름 옆 괄호 하나로)
// 라바 1마리 → 알(그 자리 변태). 스내퍼·스팅어=1알 2기
function techLarvaMorph(ev, id){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||G.tech.race!=='swarm') return;
  const lv=(G.tech.selU||[]).map(x=>G.tech.ents.find(e=>e.eid===x)).filter(e=>e&&e.type==='larva'); if(!lv.length){ if(typeof toast==='function') toast('⛔ 라바 없음'); return; }
  const hb=techGetBldg('swarm','hatchery'), p=hb&&hb.produces&&hb.produces.find(x=>x.id===id); if(!p) return;
  if(!_techReqMet(p.req)){ if(typeof toast==='function') toast('⛔ 선행 미충족'); return; }
  const pt=_techProdTime('swarm',id), twin=(id==='snapper'||id==='stinger'); let made=0, blocked='';
  for(const _lv of lv){   // 🐛 지정된 라바 전체를 한번에 변태(자원·인구 되는 만큼)
    { const w=_techWhyPop(p.pop)||_techWhyRes(p.m,p.g); if(w){ blocked=w; break; } }   // 무엇이 부족한지(인구/크레딧/에너지) 사유 보존
    _techSpend(p.m,p.g); G.tech.sup+=(p.pop||0);
    G.tech.ents=G.tech.ents.filter(x=>x!==_lv); G.tech.selU=(G.tech.selU||[]).filter(x=>x!==_lv.eid);
    const _egg={eid:G.tech.eseq++, type:'egg', x:_lv.x, y:_lv.y, id:id, t:pt, tMax:pt, pop:p.pop||0, supply:p.supply||0, twin, hatch:_lv.hatch};
    if(pt<=0) techHatchEgg(_egg); else G.tech.ents.push(_egg); made++; }
  if(!made){ if(blocked&&typeof toast==='function') toast(blocked); return; }
  if(blocked&&typeof toast==='function') toast(blocked);
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
function _techSpawnPos(be, uid){ const race=G.tech.race, f=(typeof _techFoot==='function')?_techFoot(race,be.bk):{w:2,h:2}, W=GW||390, H=GH||390;
  const hwp=(f.w/2)*_techCW()*W, hhp=(f.h/2)*_techCH()*H;   // 발판 반폭·반높이(px)
  const uRp=(((U[uid]&&U[uid].size)||14)*0.62)*(typeof TECH_USCALE!=='undefined'?TECH_USCALE:1)*(typeof TECH_PACK!=='undefined'?TECH_PACK:1)*1.69, step=2*uRp;   // 소환 반경(px) — 이동 밀집도는 유지하고 소환만 1.69배(1.3×1.3) 띄움
  const cx=be.x*W, cy=be.y*H;
  const posAt=(idx)=>{ let Hw=hwp+uRp, Hh=hhp+uRp, rem=idx, perim=2*(2*Hw+2*Hh), cap=Math.max(4,Math.floor(perim/step));   // 좌하단→반시계 idx번째 슬롯(px)
    while(rem>=cap){ rem-=cap; Hw+=step; Hh+=step; perim=2*(2*Hw+2*Hh); cap=Math.max(4,Math.floor(perim/step)); }   // 안쪽 테두리부터 다 채우면 다음(바깥) 테두리로
    const t=(rem/cap)*perim, eB=2*Hw, eR=2*Hh, eT=2*Hw; let px, py;
    if(t<eB){ px=cx-Hw+t; py=cy+Hh; }                          // 하단(좌→우)
    else if(t<eB+eR){ px=cx+Hw; py=cy+Hh-(t-eB); }             // 우측(아래→위)
    else if(t<eB+eR+eT){ px=cx+Hw-(t-eB-eR); py=cy-Hh; }       // 상단(우→좌)
    else { px=cx-Hw; py=cy-Hh+(t-eB-eR-eT); }                  // 좌측(위→아래)
    return { px, py }; };
  const used=new Set(); for(const e of G.tech.ents){ if((e.type==='unit'||e.type==='worker') && e._spawnOf===be.eid && e._spawnSlot!=null) used.add(e._spawnSlot); }   // 이 건물 소속 소환 슬롯을 '위치'가 아닌 '슬롯번호'로 판정 → 유닛이 밀려도(분리) 뭉치지 않음
  let idx=0; while(used.has(idx)) idx++;   // 가장 낮은 빈 슬롯 = 사각 테두리를 좌하단→반시계로 순차 채움(빠진 자리 재사용)
  const sp=posAt(idx);
  return { slot:idx, x:Math.max(techBX0(),Math.min(techBX1(),sp.px/W)), y:Math.max(techBY0(),Math.min(techBY1(),sp.py/H)) }; }
function techFinishProduce(q, be){ const race=G.tech.race; G.tech.units[q.id]=(G.tech.units[q.id]||0)+1; if(q.supply) _techAddSupCap(q.supply);
  be=be||G.tech.ents.find(e=>e.type==='bldg'&&e.bk===q.bk); const p=be?_techSpawnPos(be,q.id):{x:0.5,y:0.6}, _ex=p.x, _ey=p.y;
  const _isWk=(q.id===(TECH_WORKER[race]||'worker_human'));   // 생산된 일꾼도 초기 일꾼과 동일한 type:'worker'(건설 가능)
  const _nu=_isWk?{eid:G.tech.eseq++, type:'worker', x:_ex, y:_ey}:{eid:G.tech.eseq++, type:'unit', uid:q.id, x:_ex, y:_ey, pop:(q.pop||0)};   // pop = 이 유닛이 차지한 인구(오토배틀 출격 시 반환)
  if(be && p.slot!=null){ _nu._spawnOf=be.eid; _nu._spawnSlot=p.slot; }   // 소환 슬롯 점유 표시(사각 테두리 순차 채움 · 이동/사망 시 슬롯 반환)
  G.tech.ents.push(_nu);
  if(be&&be._rally){ const d=_techRallyDest(be, _nu, be._rally); if(typeof _techRoute==='function') _techRoute(_nu, d.x, d.y); else { _nu.tx=d.x; _nu.ty=d.y; } _nu._spawnOf=null; _nu._spawnSlot=null; } }   // 🚩 랠리 지정 시 = 랠리 대형으로 이동(소환 슬롯 미사용)
function _ringSlotN(i, r){ if(i<=0) return {dx:0,dy:0}; let ring=1, idx=i;   // i번째 동심원 대형 슬롯 — 반시계 방향으로 링을 채워 나감
  while(true){ const cnt=Math.floor(Math.PI*2*ring*0.9)||6; if(idx<=cnt){ const a=((idx-1)/cnt)*Math.PI*2+ring*0.5; return {dx:Math.cos(a)*ring*r, dy:-Math.sin(a)*ring*r}; } idx-=cnt; ring++; } }   // dy 반전=화면상 반시계
function _techRallyDest(be, nu, gp){ const r=gp||be._rally, GWp=GW||390, GHp=GH||390;   // 대형 목적지 — 이 건물 소속(_rallyOf) 유닛 슬롯 중 가장 낮은 빈 슬롯 배정(빙글빙글 나선 채움, 죽거나 이동해 빠진 자리 재사용)
  const used=new Set(); for(const e of G.tech.ents){ if(e===nu||(e.type!=='unit'&&e.type!=='worker')) continue; if(e._rallyOf===be.eid && e._rallySlot!=null) used.add(e._rallySlot); }
  let n=0; while(used.has(n)) n++;   // 가장 낮은 빈 슬롯(연속 채움 → 오른쪽 위에서 뭉치지 않고 계속 바깥으로)
  nu._rallyOf=be.eid; nu._rallySlot=n;
  const sp=(((U[nu&&(nu.uid||'marine')]||{}).size||14)*0.62)*(typeof TECH_USCALE!=='undefined'?TECH_USCALE:1)*2.2, s=_ringSlotN(n, sp);
  return { x:Math.max(techBX0(),Math.min(techBX1(),r.x+s.dx/GWp)), y:Math.max(techBY0(),Math.min(techBY1(),r.y+s.dy/GHp)) }; }
// ── 🧭 경로 탐색(visibility graph) — 이동 명령 시 건물 판정 사각의 꼭짓점을 잇는 최단 우회 경로를 미리 계산 ──
// 벽 비비기(반응형 조향) 대신 경유점을 따라 직선 이동 → 틱틱 걸리지 않고 깔끔. 심시티 틈새는 등급별 판정 사각 간 통로로 자동 발견됨
function _segInRect(ax,ay,bx,by,R){ const dx=bx-ax, dy=by-ay; let t0=0, t1=1;   // 선분이 사각 '내부'를 지나는가(경계 스침은 허용 — 밀봉 틈새 통로가 경계선이므로)
  const p=[-dx,dx,-dy,dy], q=[ax-R.x0, R.x1-ax, ay-R.y0, R.y1-ay];
  for(let i=0;i<4;i++){ if(Math.abs(p[i])<1e-12){ if(q[i]<0) return false; }
    else { const t=q[i]/p[i]; if(p[i]<0){ if(t>t0) t0=t; } else { if(t<t1) t1=t; } if(t0>t1) return false; } }
  if(t1-t0<1e-9) return false;
  const tm=(t0+t1)/2, mx=ax+dx*tm, my=ay+dy*tm, E=1e-9;
  return mx>R.x0+E && mx<R.x1-E && my>R.y0+E && my<R.y1-E; }
const TECH_MINE_EXP=0.06;   // 미네랄 충돌 상자를 타일보다 살짝 키워(±0.06칸) 인접 상자끼리 겹치게 → 사이 틈(seam)으로 못 빠져나감
function _techMineralRects(){ const out=[], cw=_techCW(), ch=_techCH(), ex=TECH_MINE_EXP*cw, ey=TECH_MINE_EXP*ch; for(const m of (G.tech.minerals||[])){ out.push({x0:m.x-0.5*cw-ex, x1:m.x+0.5*cw+ex, y0:m.y-0.5*ch-ey, y1:m.y+0.5*ch+ey}); } return out; }   // 💎 미네랄 = 통과 불가 벽(1×1, 살짝 겹침)
function _techNavRects(e){ const out=[]; for(const b of G.tech.ents){ if(b.type!=='bldg'||b.eid===e.build||b._lifted) continue;   // 🛫 부양 건물=공중이라 지상 통과(장애물 아님) if(b.bt>0&&!b._bpause) continue;   // 벽 = 완성/일시정지 건물(건설 중은 통과 허용, 자기가 짓는 건물 제외)
    const R=_techCollRect(b,e); if(R.x1>R.x0&&R.y1>R.y0) out.push(R); }
  for(const R of _techMineralRects()) out.push(R);   // 💎 미네랄 = 지형지물(모든 유닛·일꾼이 돌아서 감)
  return out; }
let _navExcl=null;   // 같은 이동 명령 그룹(eid Set) — 서로를 장애물로 안 봄(_techAssignMove가 설정)
// 정지 유닛도 자리 차지(유닛 벽): 시작→목표 통로 상자 안의 같은 레이어 정지 유닛을 작은 사각 장애물로 등록
function _techNavUnitRects(e, sx, sy, tx, ty){ const out=[], GWp=GW||390, GHp=GH||390;
  const eAir=(typeof _techAirOf==='function')&&_techAirOf(e);
  const rr=k=>(((U[k]&&U[k].size)||14)*0.62)*(typeof TECH_USCALE!=='undefined'?TECH_USCALE:1)*(typeof TECH_PACK!=='undefined'?TECH_PACK:1);
  const rM=rr(_techEntKey(e));
  const bx0=Math.min(sx,tx)-0.25, bx1=Math.max(sx,tx)+0.25, by0=Math.min(sy,ty)-0.25, by1=Math.max(sy,ty)+0.25;   // 통로 상자(경로 주변만 — 성능, 우회 여유 포함)
  for(const o of G.tech.ents){ if(o===e||(o.type!=='unit'&&o.type!=='worker')||o.tx!=null||o._ghost) continue;   // 정지 유닛만(이동 중·채취 유령 제외)
    if(((typeof _techAirOf==='function')&&_techAirOf(o))!==eAir) continue;   // 같은 레이어만(지상↔공중 통과)
    if(_navExcl&&_navExcl.has(o.eid)) continue;   // 같은 명령 그룹 제외
    if(o.x<bx0||o.x>bx1||o.y<by0||o.y>by1) continue;
    const rpx=(rr(_techEntKey(o))+rM)*1.18, rx=rpx/GWp, ry=rpx/GHp;   // 살짝 크게 — 서브픽셀 샛길을 경로 후보에서 제거
    out.push({x0:o.x-rx, x1:o.x+rx, y0:o.y-ry, y1:o.y+ry});
    if(out.length>=64) break; }   // 노드 폭주 방지
  return out; }
// 시작→목표 최단 경로(경유점 배열, 마지막=목표). 직선 가능하면 [목표] 하나. 목표가 판정 안이면 가장 가까운 바깥 지점으로 보정
function _techFindPath(e, tx, ty){
  if(typeof _techAirOf==='function' && _techAirOf(e)) return [{x:tx,y:ty}];   // 공중 = 직선
  const bR=_techNavRects(e), uR2=_techNavUnitRects(e, e.x, e.y, tx, ty), rects=bR.concat(uR2);   // 건물 + 정지 유닛(유닛 벽도 우회)
  for(const R of rects){ if(tx>R.x0&&tx<R.x1&&ty>R.y0&&ty<R.y1){ const dl=tx-R.x0, dr=R.x1-tx, dt2=ty-R.y0, db=R.y1-ty, m=Math.min(dl,dr,dt2,db);
    if(m===dl) tx=R.x0; else if(m===dr) tx=R.x1; else if(m===dt2) ty=R.y0; else ty=R.y1; } }   // 목표 보정(장애물 안 명령 → 가장자리)
  const seg=(ax,ay,bx,by)=>{ for(const R of rects){ if(_segInRect(ax,ay,bx,by,R)) return true; } return false; };
  if(!seg(e.x,e.y,tx,ty)) return [{x:tx,y:ty}];   // 직선 가능
  const nodes=[[e.x,e.y],[tx,ty]];   // 노드 = 시작 + 목표 + 각 사각 꼭짓점(+살짝 띄운 꼭짓점 — 벽에 딱 붙지 않은 부드러운 경로용. 밀봉 틈새는 정확한 꼭짓점이 담당)
  const inR=(x,y)=>rects.some(R=>x>R.x0+1e-9&&x<R.x1-1e-9&&y>R.y0+1e-9&&y<R.y1-1e-9);
  for(const R of rects){ for(const p of [[R.x0,R.y0],[R.x1,R.y0],[R.x0,R.y1],[R.x1,R.y1]]){
    if(p[0]>0.02&&p[0]<0.98&&p[1]>0.12&&p[1]<0.98&&!inR(p[0],p[1])) nodes.push(p); } }   // 정확한 꼭짓점(밀봉 틈새 통로 보존) — 이동 부드러움은 경유점 선행 전환이 담당
  const N=nodes.length, gsc=new Array(N).fill(1e9), par=new Array(N).fill(-1), closed=new Array(N).fill(false);
  gsc[0]=0;   // A* (시작=0, 목표=1)
  for(let it=0;it<N;it++){ let cur=-1, best=1e9;
    for(let i=0;i<N;i++){ if(!closed[i]&&gsc[i]<1e9){ const f=gsc[i]+Math.hypot(nodes[i][0]-tx,nodes[i][1]-ty); if(f<best){ best=f; cur=i; } } }
    if(cur<0||cur===1) break; closed[cur]=true;
    for(let j=0;j<N;j++){ if(closed[j]) continue; const d=Math.hypot(nodes[j][0]-nodes[cur][0], nodes[j][1]-nodes[cur][1]);
      if(gsc[cur]+d>=gsc[j]) continue;
      if(seg(nodes[cur][0],nodes[cur][1],nodes[j][0],nodes[j][1])) continue;   // 막힌 간선(비싼 검사라 개선 여지 있을 때만)
      gsc[j]=gsc[cur]+d; par[j]=cur; } }
  if(gsc[1]>=1e9) return [{x:tx,y:ty}];   // 경로 없음 → 직선 폴백(밀어냄이 안전망)
  const out=[]; let c=1; while(c>0){ out.unshift({x:nodes[c][0], y:nodes[c][1]}); c=par[c]; }
  return out.length?out:[{x:tx,y:ty}]; }
// 유닛을 경로 따라 (x,y)로 보냄 — 경유점 저장 + 첫 경유점을 이동 목표로
function _techRoute(e, x, y){ const wp=_techFindPath(e, x, y); e._wp=wp; e._rr=0; e.tx=wp[0].x; e.ty=wp[0].y; e._mvStuck=0; e._mvPrevD=null; }
// (ax,ay)→(bx,by) 직선이 장애물(건물+정지 유닛)에 안 막히는가 — 경유점 선행 전환용
function _techSegClear(e, ax, ay, bx, by){ const rects=_techNavRects(e).concat(_techNavUnitRects(e, ax, ay, bx, by));
  for(const R of rects){ if(_segInRect(ax,ay,bx,by,R)) return false; } return true; }
// 🔧 용접 스파크(엔지니어 일꾼 작업 중) — 오른손 근처에서 작은 불꽃이 튀며 낙하(cvFx에 직접 그림, 공용 FX 코어 무영향)
const TECH_MINE_FX={ union:['#ffffff','#ffe28a','#ff9440','#fff7d8'], swarm:['#eaffce','#b6f06a','#6fce34','#ecffd6'], aetherial:['#eaf4ff','#9fd8ff','#ffd76a','#f0f8ff'],
  feral:['#fff2e2','#e8b487','#c98b5a','#ffe9d2'], colossus:['#f2f5f8','#c3ccd6','#9aa6b2','#e8eef4'] };   // 종족별 채취 스파크 색(스파크3 + 코어1)
function _techEmitWeld(e, cols){ cols=cols||TECH_MINE_FX.union; if(!G._weldFx) G._weldFx=[]; if(G._weldFx.length>150) return;
  const fx=Math.sin(e.face||0), fy=Math.cos(e.face||0);   // 바라보는(대상) 방향
  const s=(typeof _techW2S==='function')?_techW2S(e.x + fx*0.0075, e.y + fy*0.0075 - 0.0025):null; if(!s) return;   // 손 위치 = 월드 오프셋(발에서 앞·위) → _techW2S가 줌 반영 → 축소해도 일꾼 바로 앞에서 나옴
  const hx=s.x, hy=s.y;
  const n=2+((Math.random()*3)|0);   // 스파크 더 많이(2~4/프레임)
  for(let k=0;k<n;k++){ const a=(-Math.PI/2)+(Math.random()-0.5)*1.7, sp=0.05+Math.random()*0.12;   // 상방 분사 + 느린 속도 → 팔끝 근처에 튀고 곧 낙하
    G._weldFx.push({x:hx+(Math.random()-0.5)*0.005, y:hy, vx:Math.cos(a)*sp+fx*0.03, vy:Math.sin(a)*sp*0.7, life:0.2+Math.random()*0.18, len:1.5+Math.random()*2.5, color:Math.random()<0.3?cols[0]:(Math.random()<0.6?cols[1]:cols[2])}); }
  G._weldFx.push({x:hx, y:hy, vx:0, vy:0, life:0.09, flash:true, color:cols[3]}); }   // 손끝 채취 코어(매 프레임 깜빡)
function _techWeldStep(dt, s){ const arr=G._weldFx; if(!arr||!arr.length) return; const ctx=s.ctx, W=s.W, H=s.H;
  ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
  for(let i=arr.length-1;i>=0;i--){ const p=arr[i]; p.vy+=0.6*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt*(p.flash?11:4.2);
    if(p.life<=0){ arr.splice(i,1); continue; }
    const L=Math.max(0,p.life), cx=p.x*W, cy=p.y*H;
    if(p.flash){ ctx.globalAlpha=Math.min(1,L*1.2); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(cx,cy,2.4*(0.4+L),0,6.283); ctx.fill(); }
    else { const sp=Math.hypot(p.vx,p.vy)||1e-4; ctx.globalAlpha=Math.min(1,L*1.7); ctx.strokeStyle=p.color; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx-(p.vx/sp)*p.len, cy-(p.vy/sp)*p.len); ctx.stroke(); } }
  ctx.restore(); }
// 건설 맵 이동 트레일 — 메인 stepMoveTrails와 동일 레시피(TRAIL_UNIT/emitMoveTrail)를 건설 뷰(팬/줌) 좌표로 적용
function techMoveTrails(dt){ if(typeof FX==='undefined'||typeof emitMoveTrail==='undefined'||!G.tech) return;
  if(!G._techFx) G._techFx=FX.store();
  const v=techView(), z=v.zoom;
  if(typeof fxOff!=='function'||!fxOff()) for(const e of G.tech.ents){ if((e.type!=='unit'&&e.type!=='worker')||e.tx==null) continue;
    const gm=_techEntKey(e); if(!MOVE_TRAIL_GM.has(gm)) continue;
    const vx=e.vx||0, vy=e.vy||0, sp=Math.hypot(vx,vy);
    const _c=(window.M3D&&M3D.centerAt)?M3D.centerAt('tu_'+e.eid):null;   // 실제 렌더된 모델 중앙(팬·줌·부양 정확) — 없으면 뷰 좌표 폴백
    const px={ x:_c?_c.x:(e.x-v.x)*z+0.5, y:_c?_c.y:(e.y-v.y)*z+0.5, uid:'tu_'+e.eid, _mtT:e._mtT };
    if(sp>0.004) emitMoveTrail(G._techFx, gm, px, vx/sp, vy/sp, 1, dt);
    else if(typeof e.face==='number') emitMoveTrail(G._techFx, gm, px, Math.sin(e.face), Math.cos(e.face), 1, dt);
    e._mtT=px._mtT; }
  if(typeof fxOff!=='function'||!fxOff()){ for(const e of G.tech.ents){ if(e.type!=='bldg'||!e._smkBurst) continue;   // 🛫 이륙·착지 순간 한 번만 먼지 poof(계속 X)
    e._smkBurst=0; const _f=(typeof _techFoot==='function')?_techFoot(G.tech.race,e.bk):{w:2,h:2}, _fw=_f.w*_techCW()*z, _bx=(e.x-v.x)*z+0.5, _by=(e.y-v.y)*z+0.5+_f.h*_techCH()*z*0.34;   // 발판 하단(지면)
    if(typeof FX!=='undefined'&&FX.smoke){ for(let k=0;k<6;k++) FX.smoke(G._techFx, _bx+(Math.random()-0.5)*_fw, _by); } } }   // 짧은 먼지 구름 한 번
  FX.advance(G._techFx, dt);
  for(const e of G.tech.ents){ if(e.type!=='worker'||!e._working||e._inGas) continue;
    if(_techEntKey(e)==='worker_human'){ _techEmitWeld(e, TECH_MINE_FX.union); }   // 🔧 유니온 엔지니어 = 건설·채취 용접 스파크
    else if(e._gKind==='mineral'&&e._gSt==='mine'){ _techEmitWeld(e, TECH_MINE_FX[G.tech.race]||TECH_MINE_FX.union); } }   // 💎 스웜·에테리얼 일꾼 = 미네랄 채취 스파크(종족 색)
  if(typeof setup!=='function') return; const s=setup('cvFx');   // setup=캔버스 크기 재설정+클리어(메인 drawFx와 동일)
  FX.drawShots(s.ctx, G._techFx, (x,y)=>({x:x*s.W, y:y*s.H}), 1.0);
  _techWeldStep(dt, s); }   // 용접 스파크 갱신·그리기(cvFx, 같은 프레임)
// 건설 유닛 겹침 분리 — 메인 separateUnits와 동일(공용 separatePass). 도착(정지)한 유닛만 대상 → 한 점에 모인 공중유닛이 메인처럼 완만히 흩어져 자리 잡음. 반환=움직였는지(리렌더 필요).
function techSeparate(){ if(!G.tech||!GW||!GH) return false; const es=G.tech.ents;
  const items=[]; for(const e of es){ if((e.type!=='unit'&&e.type!=='worker')||e.tx!=null) continue;   // 이동 중 제외
    const k=_techEntKey(e); items.push({ref:e, r:(((U[k]&&U[k].size)||14)*0.62)*(typeof TECH_USCALE!=='undefined'?TECH_USCALE:1)*(typeof TECH_PACK!=='undefined'?TECH_PACK:1), air:_techAirOf(e), fixed:!!e._ghost, settle:false}); }   // 채취 유령=고정(서로는 겹쳐 뭉치되, 취소돼 유휴가 된 일꾼은 밀어내 빠져나오게)
  if(items.length<2) return false;
  const b0=items.map(it=>[it.ref.x, it.ref.y]);   // 유닛별 위치 스냅(대칭 이동도 감지 — 합산은 상쇄되어 안 됨)
  for(let iter=0; iter<3; iter++){ separatePass(items, GW, GH);
    for(const it of items){ it.ref.x=Math.max(0.02,Math.min(0.98,it.ref.x)); it.ref.y=Math.max(0.12,Math.min(0.98,it.ref.y)); } }
  for(let i=0;i<items.length;i++){ if(Math.abs(items[i].ref.x-b0[i][0])>1e-9 || Math.abs(items[i].ref.y-b0[i][1])>1e-9) return true; }
  return false; }
function _techBldgSide(bd, i){ const race=G.tech.race, f=(typeof _techFoot==='function')?_techFoot(race,bd.bk):{w:2,h:2};   // 건물 상/우/하/좌 지점 — 발판 안쪽(≈0.6배)이라 일꾼이 건물 위에 겹쳐 서고, 반대 면으로 갈 때 건물 중앙을 가로지름
  const hw=(f.w/2)*_techCW()*0.6, hh=(f.h/2)*_techCH()*0.6;
  const sd=[{x:bd.x,y:bd.y-hh},{x:bd.x+hw,y:bd.y},{x:bd.x,y:bd.y+hh},{x:bd.x-hw,y:bd.y}][i%4];   // 상·우·하·좌
  return { x:Math.max(techBX0(),Math.min(techBX1(),sd.x)), y:Math.max(techBY0(),Math.min(techBY1(),sd.y)) }; }
// ═══ 💎⚡ 자원 채취(미네랄=크레딧 / 가스=에너지) — 덩어리 독점·왕복·8씩 적립·반납 ═══
function _techMainB(){ const k=((TECH_TREE[G.tech.race]||{}).buildings||[])[0]; if(!k) return null; for(const e of G.tech.ents){ if(e.type==='bldg'&&e.bk===k.k&&e.bt<=0) return e; } return null; }   // 본진(폴백 반납 지점 — 첫 커맨드센터)
function _techCCList(){ const k=((TECH_TREE[G.tech.race]||{}).buildings||[])[0]; if(!k) return []; return G.tech.ents.filter(e=>e.type==='bldg'&&e.bk===k.k&&e.bt<=0&&!e._lifted); }   // 완공·접지된 모든 커맨드센터(자원 반납 가능 지점)
function _techNearestCC(x,y){ const cw=_techCW(),ch=_techCH(); let best=null,bd=1e9; for(const c of _techCCList()){ const d=Math.hypot((c.x-x)/cw,(c.y-y)/ch); if(d<bd){ bd=d; best=c; } } return best; }   // (x,y)에서 가장 가까운 커맨드센터 — 소속·반납 자동 판단 기준
function _techMineralAt(wx,wy){ const cw=_techCW(),ch=_techCH(); for(const m of (G.tech.minerals||[])){ if(Math.abs(wx-m.x)<=0.7*cw && Math.abs(wy-m.y)<=0.7*ch) return m; } return null; }
function _techInGasZone(wx,wy){ if(techWallet()) return false;   // 오토배틀: 가스 구역 없음
  const cw=_techCW(),ch=_techCH(), x0=TECH_GRID.x0+TECH_GAS.c0*cw, x1=TECH_GRID.x0+(TECH_GAS.c0+TECH_GAS.w)*cw, y0=techY0()+TECH_GAS.r0*ch, y1=techY0()+(TECH_GAS.r0+TECH_GAS.h)*ch; return wx>=x0&&wx<=x1&&wy>=y0&&wy<=y1; }   // ⛽ 가스 광산 구역 안?
function _techGatherRes(w){ if(w._gKind==='mineral') return (G.tech.minerals||[]).find(m=>m.eid===w._gEid)||null; if(w._gKind==='gas'){ const gb=G.tech.ents.find(e=>e.eid===w._gEid&&e.type==='bldg'); return (gb&&gb.bt<=0)?gb:null; } return null; }
// ⛏ 광맥 채취락 — **한 덩이에 몇 명까지 붙나.** `res.cap` 이 없으면 1이라 관리자 탭·오토배틀은
//   기존과 똑같이 굴러간다. 캠프만 cap 을 얹어 여러 명이 동시에 캔다(19-camp.js) —
//   `m.inf`(무제한 광맥)와 같은 수법이다.
// ⚠ 왜 필요한가: 락이 1이면 광맥 6덩이 = 동시 6명이 상한이라 **일꾼을 아무리 뽑아도 수입이
//   안 는다**(실측: 12기 26.8/초 · 300기도 26.8). 일꾼 축이 통째로 죽는다.
// `res.miner` 는 그대로 둔다 — 다른 코드가 "지금 캐는 사람"으로 읽는다.
const TECH_MINE_CROWD = 0.05;   // 광맥이 cap 을 넘을 때 1명당 채취 시간 증가율(HUNT_R1 §1)
function _techMinerCap(res){ const c = res && res.cap | 0; return c > 1 ? c : 1; }
function _techMinerHas(res, eid){ return !!(res && res._miners && res._miners.indexOf(eid) >= 0); }
function _techMinerN(res){ return (res && res._miners) ? res._miners.length : (res && res.miner != null ? 1 : 0); }
// 🧹 **찜해 놓고 안 캐는 일꾼의 자리를 뺏는다.**
// ⚠ 이걸 안 하면 일꾼이 많을 때 판이 통째로 굳는다 — 실측(2026-08-27): 관리자 탭에서
//   일꾼 20기부터 **수입이 0** 이었다. 광맥 6개가 전부 찜(miner)돼 있는데 찜한 6명이 모두
//   'go'(가는 중)에 머물러 아무도 캐지 않았다(목표까지 거리가 0 인데도).
//   원인: 도착 판정이 d<=0.008 인데, 북적일 때 서로 밀리며 찜해 둔 일꾼이 그 문턱을 놓친다.
//   찜은 남고 나머지는 자리가 없다며 기다리니 교착이 된다.
// ⭐ 「지금 실제로 캐는 중(_gSt==='mine')이고 이 광맥에 배정된」 일꾼만 자리를 지킨다.
function _techMinerSweep(res){
  if(!res || !G.tech) return;
  const ents=G.tech.ents;
  const holds=(id)=>{ for(const w of ents){ if(w.eid!==id) continue;
      return w.type==='worker' && w._gSt==='mine' && w._gEid===res.eid; } return false; };
  if(res._miners){ for(let i=res._miners.length-1;i>=0;i--) if(!holds(res._miners[i])) res._miners.splice(i,1); }
  if(res.miner!=null && !holds(res.miner)) res.miner=(res._miners&&res._miners[0]!=null)?res._miners[0]:null;
}
function _techMinerFull(res, eid){
  if(_techMinerHas(res, eid)) return false;                       // 이미 붙어 있으면 자리 있음
  if(_techMinerN(res) > 0) _techMinerSweep(res);                  // 🧹 막혀 보이면 먼저 유령 찜을 걷는다
  // ⭐ cap 이 붙은 광맥(캠프)은 **막지 않는다** — cap 을 넘으면 대기가 아니라 **왕복이 느려진다**
  //   (HUNT_R1 §1: 덩이당 5기까지 제 속도, 초과분마다 +5%). 막아 버리면 일꾼 상한이
  //   6덩이×5=30 으로 굳어 설계의 40마리가 뜻을 잃는다.
  if(_techMinerCap(res) > 1) return false;
  return _techMinerN(res) >= 1;                                   // 관리자 탭·오토배틀 = 기존 1명 락 그대로
}
// 초과 인원만큼 채취가 느려진다 — cap 이하면 1.0
function _techMinerSlow(res){
  const over = _techMinerN(res) - _techMinerCap(res);
  return over > 0 ? (1 + TECH_MINE_CROWD * over) : 1;
}
function _techMinerAdd(res, eid){
  if(!res._miners) res._miners = [];
  if(res._miners.indexOf(eid) < 0) res._miners.push(eid);
  res.miner = eid;
}
function _techMinerDel(res, eid){
  if(res._miners){ const i = res._miners.indexOf(eid); if(i >= 0) res._miners.splice(i, 1); }
  if(res.miner === eid) res.miner = (res._miners && res._miners[0] != null) ? res._miners[0] : null;
}
function _techReleaseGather(w){ for(const m of (G.tech.minerals||[])){ if(m.owner===w.eid) m.owner=null; _techMinerDel(m, w.eid); }   // 배정·채취락 반환
  for(const e of G.tech.ents){ if(e.type==='bldg'&&e._gasWorker===w.eid) e._gasWorker=null; }
  w._gKind=null; w._gEid=null; w._gSt=null; w._working=false; w._ghost=false; w._gSpot=null; w._gDep=false; w._inGas=false; w._gBaseSpot=null; w._forceCC=null; w._dropEid=null; }   // _carry·_cKind는 유지 — 수동 이동해도 들고 있던 자원 안 사라짐(반납/교체 시에만 해제)
// 자원 상자(미네랄 1×1 / 가스건물 발판) 가장자리에 딱 붙는 채취 지점 — 이상적으로는 (fromX,fromY) 쪽 면,
// 그 면이 옆 미네랄에 막혀 있으면 막히지 않은(열린) 바깥 면으로 → 인접 미네랄은 돌아가서 캠
function _techMineSpot(res, fromX, fromY){ const cw=_techCW(), ch=_techCH();
  let hw, hh, others=[], cx0=res.x, cy0=res.y;
  if(res.bk){ const R=_techCollRect(res,{type:'worker'}); cx0=(R.x0+R.x1)/2; cy0=(R.y0+R.y1)/2; hw=Math.max(0.001,(R.x1-R.x0)/2); hh=Math.max(0.001,(R.y1-R.y0)/2); }   // 건물=이동충돌 사각 기준(발판보다 크고 위로 시프트) → 밀려나지 않는 진짜 닿는 면
  else { const ex=TECH_MINE_EXP*cw, ey=TECH_MINE_EXP*ch; hw=0.5*cw+ex; hh=0.5*ch+ey; others=(G.tech.minerals||[]).filter(m=>m!==res); }
  const uRp=(((U[TECH_WORKER[G.tech.race]]||{}).size||14)*0.62)*((typeof TECH_USCALE!=='undefined'?TECH_USCALE:1))*((typeof TECH_PACK!=='undefined'?TECH_PACK:1))*0.7;
  const gx=uRp/(GW||390), gy=uRp/(GH||390), bx=0.5*cw+TECH_MINE_EXP*cw, by=0.5*ch+TECH_MINE_EXP*ch;
  let dx=fromX-cx0, dy=fromY-cy0; if(Math.abs(dx)<1e-6&&Math.abs(dy)<1e-6) dy=1;
  const ideal=Math.atan2(dy,dx);
  const spotAt=(a)=>{ const ca=Math.cos(a), sa=Math.sin(a), tX=Math.abs(ca)>1e-6?hw/Math.abs(ca):1e9, tY=Math.abs(sa)>1e-6?hh/Math.abs(sa):1e9, t=Math.min(tX,tY); return { x:cx0+ca*t+ca*gx, y:cy0+sa*t+sa*gy }; };
  const blocked=(s)=> others.some(m=> s.x>m.x-bx && s.x<m.x+bx && s.y>m.y-by && s.y<m.y+by);   // 다른 미네랄 상자 안이면 막힘
  for(let i=0;i<8;i++){ const a=ideal + (i%2?1:-1)*Math.ceil(i/2)*(Math.PI/4); const s=spotAt(a); if(!blocked(s)) return s; }   // ideal 방향부터 ±45,±90,±135,180 순으로 열린 면 채택
  return spotAt(ideal); }   // 다 막히면 폴백
function _techGatherGoto(w, res, toward){ w._gSpot=_techMineSpot(res, toward.x, toward.y); w._gSt='go'; _techRoute(w, w._gSpot.x, w._gSpot.y); }
function _techSetGather(w, kind, eid){ w._gKind=kind; w._gEid=eid; w.build=null; w._ghost=true; w._gDep=false;   // 한 일꾼을 자원에 배정(유령 상태 — 겹침·유닛 통과)
  if(w._carry && w._cKind===kind){ w._gSt='back'; w._gBaseSpot=null; w._working=false; w.tx=null; w.ty=null; w._wp=null; return; }   // 같은 종류를 들고 있음 → 본진에 먼저 반납 후 그 자원으로 출발(반납은 back FSM이 처리)
  if(!(w._carry && w._cKind && w._cKind!==kind)){ w._carry=false; w._cKind=null; w._cEid=null; }   // 다른 종류를 들고 있으면 광산까지 들고 가서 도착 시 폐기(mine 진입에서 해제) / 그 외엔 즉시 비움
  const res=_techGatherRes(w); if(res) _techGatherGoto(w,res,{x:w.x,y:w.y}); else w._gSt='go'; }   // 첫 채취 = 일꾼과 가장 가까운 방향
function _techAssignGather(wks, kind, eid){ for(const w of wks){ _techReleaseGather(w); _techSetGather(w, kind, eid); } }   // 가스/직접 지정
// 💎 미네랄 자동 분산: 클릭한 미네랄이 차 있으면 5칸 이내 빈 미네랄로, 다 차면 클릭 미네랄에서 대기(교대)
function _techAssignGatherMineral(wks, clickEid){ const minerals=G.tech.minerals||[], clicked=minerals.find(m=>m.eid===clickEid); if(!clicked) return;
  const cw=_techCW(), ch=_techCH(), R=5;   // 탐색 반경 5칸(클릭 미네랄 기준)
  const near=minerals.filter(m=>{ const dx=(m.x-clicked.x)/cw, dy=(m.y-clicked.y)/ch; return dx*dx+dy*dy<=R*R+1e-6; })
    .sort((a,b)=> ((a.x-clicked.x)**2+(a.y-clicked.y)**2)-((b.x-clicked.x)**2+(b.y-clicked.y)**2));   // 클릭 미네랄=거리0으로 맨 앞
  if(!near.length) return;
  const cnt=new Map(near.map(m=>[m.eid,0]));   // 미네랄별 현재 배정 인원(재배정 대상 제외) — 균등 분배 기준
  for(const w of G.tech.ents){ if(w.type==='worker'&&w._gKind==='mineral'&&cnt.has(w._gEid)&&wks.indexOf(w)<0) cnt.set(w._gEid,cnt.get(w._gEid)+1); }
  for(const w of wks) _techReleaseGather(w);
  for(const w of wks){ let best=near[0], bc=cnt.get(near[0].eid);   // 인원 가장 적은(동률=클릭에 가까운) 미네랄로 → 남는 일꾼도 다른 미네랄로 퍼짐(한 곳에 안 몰림)
    for(const m of near){ const c=cnt.get(m.eid); if(c<bc){ bc=c; best=m; } }
    cnt.set(best.eid, cnt.get(best.eid)+1); best.owner=best.owner||w.eid;   // owner=대표(첫 배정 일꾼) 표시용
    _techSetGather(w,'mineral',best.eid); } }
// 🎒 손에 자원을 든 채 멈춘 일꾼 → 본진 클릭 = 들고 있던 자원 작업 재개(반납 후 그 자원 계속 채취). 소스 소멸 시 스킵
function _techResumeCarry(wks){ let did=false;
  for(const w of wks){ if(w.type!=='worker'||!w._carry||!w._cKind) continue;
    if(w._cKind==='gas'){ const gb=G.tech.ents.find(x=>x.eid===w._cEid&&x.type==='bldg'&&x.bt<=0&&((techGetBldg(G.tech.race,x.bk)||{}).gas)); if(gb){ _techAssignGather([w],'gas',gb.eid); did=true; } }
    else { const m=(G.tech.minerals||[]).find(x=>x.eid===w._cEid&&x.amount>0)||(G.tech.minerals||[]).find(x=>x.amount>0); if(m){ _techAssignGatherMineral([w], m.eid); did=true; } } }
  return did; }
// 🔄 미네랄 균형: 본진 10칸 이내 미네랄에 채취 일꾼을 고르게 재분배 → 빈 미네랄 생기면 많은 곳에서 이동
function _techRebalanceMinerals(){ const ccs=_techCCList(); if(!ccs.length) return; const cw=_techCW(), ch=_techCH();
  for(const mb of ccs){   // 커맨드센터별 영역(그 CC가 가장 가까운 10칸 이내 광산)에서 각각 균등 재분배
    const home=(G.tech.minerals||[]).filter(m=> m.amount>0 && Math.hypot((m.x-mb.x)/cw,(m.y-mb.y)/ch)<=10 && _techNearestCC(m.x,m.y)===mb); if(home.length<2) continue;
    const cnt=new Map(home.map(m=>[m.eid,0])), pool={};   // cnt=전체 채취인원 / pool=운반중 아닌(이동 가능) 일꾼
    for(const w of G.tech.ents){ if(w.type==='worker'&&w._gKind==='mineral'&&cnt.has(w._gEid)){ cnt.set(w._gEid,cnt.get(w._gEid)+1); if(!w._carry){ (pool[w._gEid]=pool[w._gEid]||[]).push(w); } } }
    if([...cnt.values()].reduce((a,c)=>a+c,0)===0) continue;
    for(let guard=0; guard<home.length*2; guard++){ let hi=null,lo=null,hc=-1,lc=1e9;
      for(const m of home){ const c=cnt.get(m.eid); if(c>hc){hc=c;hi=m;} if(c<lc){lc=c;lo=m;} }
      if(!hi||!lo||hc-lc<2) break;   // 균형(최대-최소 ≤1)
      const cand=(pool[hi.eid]||[]).sort((a,b)=>Math.hypot(a.x-lo.x,a.y-lo.y)-Math.hypot(b.x-lo.x,b.y-lo.y))[0]; if(!cand) break;   // 이동 가능 일꾼 없으면 다음 틱
      pool[hi.eid]=pool[hi.eid].filter(w=>w!==cand); (pool[lo.eid]=pool[lo.eid]||[]).push(cand);
      cnt.set(hi.eid,cnt.get(hi.eid)-1); cnt.set(lo.eid,cnt.get(lo.eid)+1);
      _techReleaseGather(cand); _techSetGather(cand,'mineral',lo.eid); } } }   // 많은 곳→빈 곳으로 1명 이동(각 CC 영역 내)
// 우상단 스텝퍼: 숫자=지금 그 건물과 연동돼 작업 중인 일꾼 수(수동 지정도 반영). +/− = 1명 추가/반환
function _techMineralWorkers(e){ return G.tech.ents.filter(w=>{ if(w.type!=='worker'||w._gKind!=='mineral') return false;
  if(w._forceCC!=null){ const fc=_techCCList().find(c=>c.eid===w._forceCC); if(fc) return fc.eid===e.eid; }   // 수동 + 강제 소속(1회 상호작용 보장)이 유효하면 그 기준
  const m=(G.tech.minerals||[]).find(x=>x.eid===w._gEid); if(!m) return false; const cc=_techNearestCC(m.x,m.y); return cc && cc.eid===e.eid; }); }   // 그 외 = 캐는 광산의 최근접 CC가 이 건물인 일꾼
function _techGasWorkers(e){ return G.tech.ents.filter(w=>w.type==='worker'&&w._gKind==='gas'&&w._gEid===e.eid); }
function techAutoAdjust(delta, ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;
  const e=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'):null; if(!e) return;
  const race=G.tech.race, b=techGetBldg(race,e.bk); if(!b) return; const isMain=(b.k===((TECH_TREE[race].buildings[0])||{}).k);
  if(delta>0){
    if(isMain){ const cw=_techCW(), ch=_techCH(), near=(G.tech.minerals||[]).filter(m=>Math.hypot((m.x-e.x)/cw,(m.y-e.y)/ch)<=10&&m.amount>0).sort((a,c)=>Math.hypot((a.x-e.x)/cw,(a.y-e.y)/ch)-Math.hypot((c.x-e.x)/cw,(c.y-e.y)/ch));
      // 유휴 + (이 CC 소속이 아닌) 미네랄 일꾼 중 이 건물에 가장 가까운 1명 → 이 CC 근처 광산으로 재배치. 유휴가 없으면 다른 CC 일꾼을 끌어옴
      const cand=G.tech.ents.filter(w=>{ if(w.type!=='worker'||w.build!=null||w._gKind==='gas') return false; if(w._forceCC===e.eid) return false; if(!w._gKind) return true; const m=(G.tech.minerals||[]).find(x=>x.eid===w._gEid); if(!m) return true; const cc=_techNearestCC(m.x,m.y); return !(cc&&cc.eid===e.eid); }).sort((a,c)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(c.x-e.x,c.y-e.y))[0];   // 가장 가까운 일꾼 이동
      if(near.length&&cand){ _techAssignGatherMineral([cand], near[0].eid); cand._forceCC=e.eid; } }   // 강제 소속 → 이 CC와 최소 1회 상호작용 후 자동 판단(전환/유지)
    else if(b.gas){ const pool=G.tech.ents.filter(w=>w.type==='worker'&&w.build==null&&w._gKind!=='gas').sort((a,c)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(c.x-e.x,c.y-e.y))[0];   // 건설X·가스X(미네랄·유휴) 중 가장 가까이 1명
      if(pool) _techAssignGather([pool],'gas',e.eid); } }
  else if(delta<0){ const list=isMain?_techMineralWorkers(e):(b.gas?_techGasWorkers(e):[]);
    if(list.length){ const w=list[list.length-1]; _techReleaseGather(w); w.tx=null; w.ty=null; } }   // 1명 반환(유휴로)
  if(isMain) _techRebalanceMinerals();
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
// 프로필 우상단 아이콘(이모지 제거 → 심플 라인 아이콘)
const _SVG_ARR_UP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18.5V7.5"/><path d="M6.5 12.5l5.5-5.5 5.5 5.5"/></svg>';   // 짧고 굵은 위 화살표(부양)
const _SVG_ARR_DOWN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5v11"/><path d="M6.5 11.5l5.5 5.5 5.5-5.5"/></svg>';   // 짧고 굵은 아래 화살표(하강)
const _SVG_RALLY='<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v8.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9.3 8.9l2.7 2.7 2.7-2.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="12" cy="17.2" rx="6" ry="4.1" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="17.2" r="1.5" fill="currentColor"/></svg>';   // 위→아래 얇은 화살표 + 원+점(웨이포인트와 통일)
const _SVG_SELALL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" stroke-dasharray="3 2.3"/><circle cx="9" cy="9" r="1.7" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.7" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.7" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.7" fill="currentColor" stroke="none"/></svg>';   // 👥 마퀴(점선 상자)+4점 = 화면 내 같은 종류 전체 지정
// ══ 🎛 UI 조작 아이콘(투명 배경 계열) ══════════════════════════════════
// 능력 아이콘(금속판 계열)과 **다른 계열**이다 — 판·테두리 없이 단색 실루엣 하나.
//   파일: assets/icons/ui/ui_<키>.webp (알파 유지). 없으면 아래 표의 기존 인라인 SVG로 되돌아간다.
//   ⚠ 색은 버튼이 낸다(.cgRally/.cgLift/.cgSelAll 의 면·테두리). 아이콘 자체에 색을 넣지 말 것.
const _SVG_BACK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6L4 11l5 5"/><path d="M4 11h9a6 6 0 0 1 6 6v1"/></svg>';   // ↩ 한 종류 보기 → 여러 종류 전체로 복귀
const _SVG_TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M10 11v6M14 11v6"/></svg>';   // 🗑 휴지통 = 그 종류 지정 해제
const UI_SVG={ rally:_SVG_RALLY, lift:_SVG_ARR_UP, land:_SVG_ARR_DOWN, selall:_SVG_SELALL, back:_SVG_BACK, untype:_SVG_TRASH };
function uiIco(k){ return '<img class="uiIco" src="'+ICO_DIR+'ui/ui_'+k+'.webp" alt="" draggable="false" data-ui="'+k+'" onerror="_uiFail(this)">'; }
function _uiFail(im){ try{ im.outerHTML=UI_SVG[im.getAttribute('data-ui')]||''; }catch(_e){ try{ im.remove(); }catch(_e2){} } }   // 파일이 없으면 원래 인라인 SVG로(칸이 비지 않는다)
function _techAutoBtn(b){ const e=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'):null; if(!e||e.bk!==b.k) return '';
  const isMain=(b.k===((TECH_TREE[G.tech.race].buildings[0])||{}).k); if(!isMain && !b.gas) return '';   // 본진 또는 가스 건물만
  const tt=isMain?'이 본진과 연동 중인 미네랄 채취 일꾼 수':'이 가스 건물에서 작업 중인 일꾼 수', n=isMain?_techMineralWorkers(e).length:_techGasWorkers(e).length;   // 우상단 배너와 동일 톤 스텝퍼(아이콘 제거, − n +)
  return '<div class="cgGasAuto" title="'+tt+'"><button class="gaBtn" onclick="techAutoAdjust(-1,event)">−</button><b class="gaN">'+n+'</b><button class="gaBtn" onclick="techAutoAdjust(1,event)">+</button></div>'; }
function _techLiftBtn(b){ const e=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'):null; if(!e||e.bk!==b.k||e.bt>0||!_techCanLift(b.k)) return '';   // 🛫 부양 버튼(프로필 우상단) — 상태별
  let up,ttl,busy=false; const ph=e._liftPhase;
  if(!e._lifted){ up=true; ttl='부양'; } else if(ph==='flying'){ up=false; ttl='착륙 위치 지정'; } else { up=(ph==='rising'); ttl=(ph==='descending'?'착륙 중':(ph==='toland'?'착륙 지점 이동 중':'이륙 중')); busy=true; }
  const ico=uiIco(up?'lift':'land');
  return '<button class="cgLift'+(e._lifted?' on':'')+(busy?' busy':'')+'"'+(busy?'':' onclick="techLiftToggle(event)"')+' title="'+ttl+'">'+ico+'</button>'; }
function _techRallyBtn(b){ const e=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'):null; if(!e||e.bk!==b.k||e.bt>0) return '';   // 🚩 랠리 포인트(생성 유닛 자동 이동) — 유닛 생산 건물만
  if(!(b.produces&&b.produces.length)) return '';
  const on=(G.tech.rallySet===e.eid)||!!e._rally;
  return '<button class="cgRally'+(on?' on':'')+'" onclick="techRallySet(event)" title="랠리 포인트 — 생성된 유닛이 자동으로 갈 위치 지정">'+uiIco('rally')+'</button>'; }
function techRallySet(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||G.tech.sel==null) return;
  const e=G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'); if(!e) return;
  if(G.tech.rallySet===e.eid){ G.tech.rallySet=null; e._rally=null; if(typeof toast==='function') toast('랠리 해제'); }   // 지정 중 다시 누르면 해제
  else { G.tech.rallySet=e.eid; if(typeof toast==='function') toast('🚩 맵을 탭해 랠리 위치 지정'); }
  if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); }
function _techBldgTR(b){ return _techAutoBtn(b)+_techRallyBtn(b)+_techLiftBtn(b); }   // 프로필 우상단 = [자원 스텝퍼][랠리][부양] (지정해제는 메인 금지버튼으로 통일)
function _techSelAllBtn(key){ return '<button class="cgSelAll" onclick="techSelectAllType(event,\''+key+'\')" title="화면 안의 같은 종류 전체 지정">'+uiIco('selall')+'</button>'; }   // 👥 프로필 우상단 = 화면 내 같은 종류 전체 지정
function techSelectAllType(ev,key){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||!G.tech.ents) return;
  const keyOf=e=>(e.type==='worker')?'__wk':e.uid;
  const list=G.tech.ents.filter(e=>{ if(e.type!=='unit'&&e.type!=='worker') return false; if(keyOf(e)!==key) return false;
    const s=_techW2S(e.x,e.y); return s.x>=-0.03&&s.x<=1.03&&s.y>=-0.03&&s.y<=1.03; });   // 화면 안(약간 여유)
  if(!list.length) return;
  G.tech.selU=list.map(e=>e.eid); G.tech.sel=null; G.tech.selType=null;
  const body=document.getElementById('btSheetBody'); if(body) body._cgPage=0;
  const nm=_techRealName(G.tech.race, (key==='__wk')?(TECH_WORKER[G.tech.race]||'worker_human'):key);
  if(typeof playSfx==='function') playSfx('ui_open'); if(typeof toast==='function') toast('👥 '+nm+' 전체 지정 ('+list.length+')'); techUIRender(); }
function techRemoveType(ev,key){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||!G.tech.selU) return;   // 🗑 혼합 지정에서 그 종류만 지정 해제(카드 사라지고 뒤 카드 당겨짐)
  const keyOf=e=>(e.type==='worker')?'__wk':e.uid;
  G.tech.selU=G.tech.selU.filter(id=>{ const e=G.tech.ents.find(x=>x.eid===id); return !(e&&keyOf(e)===key); });
  if(G.tech.selType===key) G.tech.selType=null; _chipSwallow=true;   // 뒤따르는 합성 click 삼킴(재렌더 그리드 누수 방지)
  const body=document.getElementById('btSheetBody'); if(body) body._cgPage=0;
  if(typeof playSfx==='function') playSfx('ui_close'); techUIRender(); }
function _techGatherTick(dt){ let dep=false, any=false;
  const mainB=_techMainB();
  const ccAvail=_techCCList().length>0;   // 접지된 커맨드센터가 하나도 없으면(전부 부양) 반납 불가 → 채취 정지
  for(const w of G.tech.ents){ if(w.type!=='worker'||!w._gKind) continue;
    if(w.build!=null){ _techReleaseGather(w); continue; }   // 건설로 전환됨 → 채취 취소
    const res=_techGatherRes(w); if(!res){ _techReleaseGather(w); continue; }   // 자원 소멸/미완성 가스건물
    if(!ccAvail){ w.tx=null; w.ty=null; w._wp=null; w._working=false; continue; }   // 모든 CC 부양 → 그 자리에 정지(소속·상태 유지, 착륙하면 이어서 작업)
    any=true;
    if(w._gSt==='go'){
      if(!w._gSpot) _techGatherGoto(w,res,{x:w.x,y:w.y});
      const gdx=w._gSpot.x-w.x, gdy=w._gSpot.y-w.y, d=Math.hypot(gdx,gdy);
      if(d<=0.008){ const _full=(w._gKind==='mineral') ? _techMinerFull(res, w.eid)
          : (res._gasWorker!=null && res._gasWorker!==w.eid);   // 채취 지점 도착 → 채취락(광맥은 res.cap 명까지 · 가스는 1명). 스냅 없음(걸어서 이미 붙음)
        if(!_full){ if(w._carry){ w._carry=false; w._cKind=null; w._cEid=null; }   // 다른 종류를 들고 왔으면 광산에서 폐기(교체 채취 시작)
          if(w._gKind==='mineral') _techMinerAdd(res, w.eid); else { res._gasWorker=w.eid; w._inGas=true; } w._gSt='mine';
          w._gT=(w._gKind==='gas'?TECH_GAS_T:(TECH_MINE_T*_techMinerSlow(res)));   // 💎 붐비면 그만큼 느리게(_techMinerSlow)
          w.tx=null; w.ty=null; w._wp=null; w._working=true; }
        else { w.tx=null; w.ty=null; w._wp=null; w._working=false; const k2=Math.min(1,dt*6); w.x+=gdx*k2; w.y+=gdy*k2; } }   // 선점됨 → 스르륵 모여 겹쳐 대기(교대·유령)
      else if(w.tx==null){ if(d<=0.07){ const st=Math.min(d,0.42*dt); w.x+=gdx/d*st; w.y+=gdy/d*st; w.face=Math.atan2(gdx,gdy); }   // 경로 종료 후 남은 거리 = 걷는 속도 그대로 마저 붙음(순간이동 X)
        else _techRoute(w, w._gSpot.x, w._gSpot.y); } }
    else if(w._gSt==='mine'){ w._working=true; const fx=res.x-w.x, fy=res.y-w.y; if(fx*fx+fy*fy>1e-6) w.face=Math.atan2(fx,fy);
      if(w._gSpot){ const k2=Math.min(1,dt*10); w.x+=(w._gSpot.x-w.x)*k2; w.y+=(w._gSpot.y-w.y)*k2; }   // 채취 중 지점에 부드럽게 정착
      w._gT-=dt;
      if(w._gT<=0){ if(w._gKind==='mineral'){ _techMinerDel(res, w.eid); } else { if(res._gasWorker===w.eid) res._gasWorker=null; w._inGas=false; }   // 채취 완료 → 채취락 반환·운반(가스=건물서 나옴)
        w._carry=true; w._cKind=w._gKind; w._cEid=w._gEid; w._gSt='back'; w._working=false;
        const forceB=(w._forceCC!=null)?_techCCList().find(c=>c.eid===w._forceCC):null;   // 수동 + 강제 소속(접지 상태일 때만) 우선 반납
        const drop0=forceB||_techNearestCC(w.x,w.y)||mainB; w._dropEid=drop0?drop0.eid:null;   // 그 외엔 가장 가까운 CC → 더 가까운 CC가 생기면 다음 왕복부터 자동 이동
        w._bStuck=0; w._bPrevD=null;
        if(drop0){ w._gBaseSpot=_techMineSpot(drop0, w.x, w.y); _techRoute(w, w._gBaseSpot.x, w._gBaseSpot.y); } } }   // CC 가장자리 딱 붙는 지점으로 · _cKind/_cEid=들고 있는 자원 종류·출처(재지정에도 유지)
    else if(w._gSt==='back'){ const dropB=(w._dropEid!=null?G.tech.ents.find(x=>x.eid===w._dropEid&&x.type==='bldg'&&x.bt<=0&&!x._lifted):null)||_techNearestCC(w.x,w.y)||mainB; if(!dropB) continue;   // 소속 CC 소멸/부양 시 최근접 CC로 폴백
      if(!w._gBaseSpot) w._gBaseSpot=_techMineSpot(dropB, w.x, w.y);
      const bdx=w._gBaseSpot.x-w.x, bdy=w._gBaseSpot.y-w.y, bD=Math.hypot(bdx,bdy);
      // 🧩 끼임 감지: 진행이 멈춘 채 CC 발판 코앞이면 강제 반납(가까이 겹친 건물 사이에 껴서 못 붙는 경우 방지)
      const _cD=Math.hypot(dropB.x-w.x, dropB.y-w.y), _bf2=(typeof _techFoot==='function')?_techFoot(G.tech.race,dropB.bk):{w:2,h:2}, _footR=Math.max(_bf2.w*_techCW(),_bf2.h*_techCH())*0.5;
      if(w._bPrevD!=null && bD>w._bPrevD-0.0006) w._bStuck=(w._bStuck||0)+dt; else w._bStuck=0; w._bPrevD=bD;
      const _wedged=(w._bStuck>0.6 && _cD<=_footR+0.05);
      if(bD<=0.03){ const bfx=dropB.x-w.x, bfy=dropB.y-w.y; if(bfx*bfx+bfy*bfy>1e-6) w.face=Math.atan2(bfx,bfy); }   // 붙었을 때만 건물을 응시(넣는 자세)
      if(bD<=0.008 || _wedged){   // 건물에 딱 붙어 도착(또는 끼임 강제 반납) → 적립
        w.tx=null; w.ty=null; w._wp=null; w._bStuck=0; w._bPrevD=null;
        const _ck=w._cKind||w._gKind, _ce=(w._cEid!=null?w._cEid:w._gEid);   // 들고 있는 자원 기준 적립(재지정 후에도 원래 캔 자원에서 차감)
        // ⛔ **남아 있는 만큼만 준다.** 예전에는 지급에 잔량 검사가 없어서, 광맥이 0 이 된 뒤에도
        //    거기 붙은 일꾼이 왕복할 때마다 계속 벌었다 — 사실상 무한 자원이었다.
        //    캠프 실측에서 잔량 0 인 채로 초당 9,236 을 벌었다(BALANCE.md §3-2).
        //    ⚠ 잔량 그릇을 못 찾은 경우(_sm/_sg 없음)는 예전대로 전액 준다 — 그 경로까지 바꾸면
        //       관리자 탭·오토배틀의 다른 채취 흐름을 건드리게 된다.
        //    ⭐ `m.inf` 가 붙은 광맥은 **줄지 않는다**(캠프가 그렇게 깐다 — 19-camp.js).
        //       관리자 건설 탭은 잔량 %를 화면에 보여주는 기능이 있으므로 거기는 그대로 줄어든다.
        if(_ck==='mineral'){ const _sm=(G.tech.minerals||[]).find(m=>m.eid===_ce)||((w._gKind==='mineral')?res:null);
          const _inf=!!(_sm&&_sm.inf);
          const _got=(_sm&&!_inf) ? Math.min(TECH_GATHER_AMT, Math.max(0,_sm.amount||0)) : TECH_GATHER_AMT;
          if(!G.tech.inf) G.tech.credit+=_got;
          if(_sm&&!_inf) _sm.amount=Math.max(0,(_sm.amount||0)-_got); }
        else { const _sg=G.tech.ents.find(x=>x.eid===_ce&&x.type==='bldg')||((w._gKind==='gas')?res:null);
          const _got=_sg ? Math.min(TECH_GATHER_AMT, Math.max(0,_techGasRemain())) : TECH_GATHER_AMT;
          if(!G.tech.inf) G.tech.energy+=_got;
          if(_sg){ G.tech.gasAmt=Math.max(0,_techGasRemain()-_got); _sg._gasAmt=G.tech.gasAmt; } }   // ⛽ 광산 지속 잔량에서 차감(건물엔 미러)
        dep=true; w._carry=false; w._cKind=null; w._cEid=null; w._gDep=true; w._gBaseSpot=null; w._forceCC=null; _techGatherGoto(w,res,{x:dropB.x,y:dropB.y}); }   // 반납 완료 → 강제 소속 해제(1회 상호작용 끝, 이후 자동 판단) · 바로 다음 왕복
      else if(w.tx==null){ if(bD<=0.07){ const st=Math.min(bD,0.42*dt); w.x+=bdx/bD*st; w.y+=bdy/bD*st; w.face=Math.atan2(bdx,bdy); }   // 경로 종료 후 남은 거리 = 걷는 속도 그대로 마저 붙음
        else _techRoute(w, w._gBaseSpot.x, w._gBaseSpot.y); } } }
  return { any, dep }; }
function _techBFootRect(bk, cx, cy){ const f=(typeof _techFoot==='function')?_techFoot(G.tech.race,bk):{w:2,h:2}, hw=f.w*_techCW()/2, hh=f.h*_techCH()/2; return {x0:cx-hw,y0:cy-hh,x1:cx+hw,y1:cy+hh}; }   // 건물 발판 사각(월드)
function _techLandOccupied(e, x, y){ const A=_techBFootRect(e.bk,x,y);   // 착륙 지점이 이미 접지·하강 중인 다른 건물과 겹치는가
  for(const o of G.tech.ents){ if(o===e||o.type!=='bldg') continue;
    const occ=(!o._lifted)||o._liftPhase==='descending'; if(!occ) continue;   // 지상에 자리했거나 지금 내려앉는 건물만 자리 차지
    const B=_techBFootRect(o.bk,o.x,o.y); if(A.x1<=B.x0||A.x0>=B.x1||A.y1<=B.y0||A.y0>=B.y1) continue;   // 겹침 없음
    const same=(o._liftPhase==='descending' && (o._liftT||0)>=TECH_LIFT_T-1e-6);   // 같은 프레임에 하강 시작(완전 동시) → 늦게 온 쪽 폭발
    return { b:o, same }; }
  return null; }
function _techExplodeBldg(e){ if(G._techFx && typeof FX!=='undefined' && FX.death){ try{ FX.death(G._techFx, e.x, e.y, {unitSize:28, color:'#ff8a3a'}); }catch(_){} }
  if(typeof playSfx==='function') playSfx('boom');
  for(const ad of G.tech.ents){ if(ad.type==='bldg'&&ad._dockOf===e.eid) ad._orphan=true; }   // 애드온 고아 처리
  const b=techGetBldg(G.tech.race,e.bk); if(b&&b.supply) G.tech.supCap=Math.max(0,G.tech.supCap-b.supply);
  if(G.tech.built&&G.tech.built[e.bk]) G.tech.built[e.bk]=Math.max(0,G.tech.built[e.bk]-1);
  if(G.tech.sel===e.eid) G.tech.sel=null; G.tech.selU=(G.tech.selU||[]).filter(id=>id!==e.eid);
  e._dead=true; if(typeof toast==='function') toast('💥 착륙 지점 충돌 — 건물 파괴'); }
function techTick(dt){ if(!G.tech) return; let active=false, done=false;
  if(_techSkillTick(dt)) active=true;   // 🪄 스킬 쿨다운·버프·FX 진행(활동 중=계속 렌더)
  if(_techRepairTick(dt)) active=true;   // 🔧 일꾼 수리(건설 중 건물 완성 가속 · b._repairN 집계)
  { const _nr=_techNydusTick(dt); if(_nr) active=true; if(_nr===2) done=true; }   // 🕳 나이더스 순간이동(지정 유닛 명령) · 텔레포트=지정 해제라 전체 갱신
  { const _fr=_techFusionTick(dt); if(_fr) active=true; if(_fr===2) done=true; }   // 🔮 융합(하이세이지×2→보이드 / 다크세이지×2→다크보이드)
  for(const e of G.tech.ents){ if(e.type==='bldg'&&e.bk==='bunker'&&e._entryCd>0) e._entryCd=Math.max(0,e._entryCd-dt); }   // 벙커별 입장 간격 카운트다운(프레임당 1회)
  for(let i=G.tech.ents.length-1;i>=0;i--){ const u=G.tech.ents[i]; if(u._boardTgt==null) continue;   // 🧱 벙커 탑승 이동 중 → 도착 시 탑승
    const bunk=G.tech.ents.find(e=>e.eid===u._boardTgt&&e.type==='bldg'&&e.bk==='bunker'&&e.bt<=0);
    if(!bunk){ u._boardTgt=null; continue; } bunk._cargo=bunk._cargo||[];
    if(bunk._cargo.length>=4){ u._boardTgt=null; u.tx=null; continue; }   // 가득 → 탑승 취소
    if(Math.hypot(u.x-bunk.x,u.y-bunk.y) < _techBunkerR(bunk)){
      if(bunk._entryCd>0){ active=true; continue; }   // 앞 유닛 탑승 직후 → 간격만큼 대기(도착 즉시 한 명씩 순서대로 입장)
      const uid=(u.type==='worker')?(TECH_WORKER[G.tech.race]||'worker_human'):u.uid;
      bunk._cargo.push({ type:u.type, uid, hp:(techUnitSpec('union',uid)||{}).hp||0 });
      if(G.tech.selU) G.tech.selU=G.tech.selU.filter(id=>id!==u.eid); G.tech.ents.splice(i,1); bunk._entryCd=0.12; done=true; }
    else active=true; }
  for(const e of G.tech.ents){ if(e.type!=='bldg'||!e._evo) continue; e._evo.t=Math.max(0,e._evo.t-dt); active=true; if(e._evo.t<=0){ _techEvolveDone(e, e._evo.to); done=true; } }   // 🧬 건물 진화 진행
  const _edge=techEdgePan(dt);       // 🎥 배치 고스트를 화면 끝으로 끌면 뷰가 따라간다
  const _vmoving=techViewTick(dt)||_edge;   // 🎥 부드러운 줌/팬 보간(메인맵과 동일) — 애니메이션 중이면 매 프레임 재렌더
  if(G.tech.fog && G.tech.fog.on){ G.tech.fog.t=(G.tech.fog.t||0)+dt; if(G.tech.fog.t>=0.1){ G.tech.fog.t=0; techFogCompute(); } techFogDraw(); }   // 🌫️ 시야 계산은 ~10/s, 그리기는 매 프레임(어두워짐 페이드 부드럽게)
  for(const e of G.tech.ents){ if(e.type==='bldg'&&e.bt>0){ const _frozen=e._bpause||(_techNeedsPower(e.bk)&&!_techPowered(e.x,e.y));   // 일시정지·블랙아웃 = 완전 정지(카운트다운·재렌더 불필요)
    if(!e.waiting&&!_frozen){ e.bt=Math.max(0,e.bt-dt*(1+(e._repairN||0))); if(e.bt<=0){ techFinishBuild(e); done=true; } }   // 🔧 수리 일꾼 수만큼 완성 가속
    if(!_frozen) active=true; } }   // 얼어붙은 건물은 active 제외 → 영구 매프레임 재렌더(=클릭 먹힘 방지) 차단. 진행·일꾼대기만 재렌더
  const _gath=_techGatherTick(dt); if(_gath.any) active=true; if(_gath.dep) done=true;   // 💎⚡ 자원 채취 FSM(이동 목표 지정 → 아래 이동 루프가 수행)
  { G.tech._gaT=(G.tech._gaT||0)+dt; if(G.tech._gaT>=1.2){ G.tech._gaT=0; _techRebalanceMinerals(); } }   // 🔄 주기적 미네랄 균형(빈 덩어리 자동 채움)
  // 🚶 유닛 이동 — 공용 stepUnitMove(관성·유닛회피·감속·정착·응시) + 🧭 경유점(waypoint) 추종. 건물 회피 조향 없음(경로가 이미 우회) → 벽 비비기/틱틱 걸림 제거
  const _clamp=(x,y)=>({x:Math.max(techBX0(),Math.min(techBX1(),x)), y:Math.max(techBY0(),Math.min(techBY1(),y))});   // 이동 한계 = 건설 가능 구역(매 프레임 위치 보정도 동일 기준)
  const _staticN=[]; for(const o of G.tech.ents){ if((o.type!=='unit'&&o.type!=='worker')||o.tx!=null||o._ghost) continue; const k=_techEntKey(o); _staticN.push({ref:o, x:o.x, y:o.y, sizeKey:k, airKey:k}); }   // 정지 유닛만(이동 중·채취 유령 제외 — 유령은 통과 가능)
  for(const e of G.tech.ents){ if((e.type==='unit'||e.type==='worker')&&e.tx!=null){
    const key=_techEntKey(e);
    while(e._wp && e._wp.length>1){ const _dw=Math.hypot(e.tx-e.x,e.ty-e.y);
      if(_dw>=0.05) break;
      if(_dw>0.018 && !_techSegClear(e, e.x, e.y, e._wp[1].x, e._wp[1].y)) break;   // 아직 코너 못 돌았고 다음 구간 막힘 → 유지(단 피벗 초근접(≤0.018)이면 강제 전환 — 감속 정지 방지)
      e._wp.shift(); const _n=e._wp[0]; e.tx=_n.x; e.ty=_n.y; e._mvStuck=0; e._mvPrevD=null; }   // 🏃 경유점 선행 전환: 모퉁이마다 멈췄다 가는 현상 제거 + 좁은 통로에선 지름길 금지
    e._pfx=e.x; e._pfy=e.y;   // 이번 프레임 이동 전 위치(쐐기 판정 시 되돌림용)
    const r=stepUnitMove(e, {x:e.tx,y:e.ty}, key, key, dt, { GW:GW||390, GH:GH||390, clamp:_clamp, staticN:(e._ghost?[]:_staticN), avoidMul:0.22, noSlow:(e._wp&&e._wp.length>1), ay:(1/_techGA()), spdMul:TECH_SPD_MUL });   // 채취 유령=유닛 회피 없음(통과) / avoidMul 0.22=슬롯 간격 미만 최대
    if(r.done){ const _far=Math.hypot(e.tx-e.x, e.ty-e.y)>0.035;   // 도착이 아니라 막혀서 멈춤(관성 정체)
      if(e._wp && e._wp.length>1){   // 경유점 남음 → 다음 경유점으로(막혔으면 현재 위치 기준 경로 재계산)
        if(_far && (e._rr||0)<4){ e._rr=(e._rr||0)+1; const _fin=e._wp[e._wp.length-1]; e._wp=_techFindPath(e,_fin.x,_fin.y); }
        else e._wp.shift();
        const _n=e._wp[0]; e.tx=_n.x; e.ty=_n.y; e._mvStuck=0; e._mvPrevD=null; }
      else if(_far && (e._rr||0)<4 && !_techAirOf(e)){ e._rr=(e._rr||0)+1;   // 직행 중 새 벽에 막힘(도중 완성된 건물 등) → 우회 경로로 재시도
        const _wp2=_techFindPath(e,e.tx,e.ty);
        if(_wp2.length>1){ e._wp=_wp2; e.tx=_wp2[0].x; e.ty=_wp2[0].y; e._mvStuck=0; e._mvPrevD=null; }
        else { e.tx=null; e.ty=null; e._wp=null; e._rr=0; } }
      else { e.tx=null; e.ty=null; e._wp=null; e._rr=0;
        if(e.type==='worker'&&e.build!=null){ const bd=G.tech.ents.find(x=>x.eid===e.build); if(bd&&bd.waiting&&Math.hypot(bd.x-e.x,bd.y-e.y)<0.16){ bd.waiting=false; done=true;
          if(G.tech.race==='swarm'){ bd._drone=true; e._dead=true; G.tech.sup=Math.max(0,G.tech.sup-1); G.tech.selU=(G.tech.selU||[]).filter(id=>id!==e.eid); } } } } }   // 일꾼 도착 → 건설 시작(🧬 스웜=드론이 건물로 변태·소멸, 취소 시 부활)
    active=true; } }
  if(G.tech.race==='swarm') G.tech.ents=G.tech.ents.filter(x=>!x._dead);   // 🧬 변태로 소멸한 드론 제거
  // 🔨 건설 중 일꾼: 건물의 상하좌우를 순회하며 여러 곳을 짓는 듯 작업(도착→체류(작업모션)→다음 면)
  for(const e of G.tech.ents){ if(e.type!=='worker'||e.build==null) continue;
    const bd=G.tech.ents.find(x=>x.eid===e.build);
    if(!bd||bd.type!=='bldg'||bd.bt<=0){ e._working=false; continue; }   // 건물 없음/완성 → 작업 종료
    if(bd.waiting){ e._working=false; continue; }   // 첫 도착 전(이동 중) — 위 이동 루프가 도착 처리
    if(bd._bpause){ e._working=false; continue; }   // ⏸ 사용자 일시정지 → 작업 안 함(자유 이동 가능)
    if(G.tech.race==='aetherial'){ e._working=true; e._warpT=(e._warpT||0)+dt;   // 🔮 차원 소환: 균열만 열고(≈0.9s) 즉시 해방 — 건물은 스스로 완성(테란처럼 붙어 있지 않음)
      const _fdx=bd.x-e.x, _fdy=bd.y-e.y; if(_fdx*_fdx+_fdy*_fdy>1e-5) e.face=Math.atan2(_fdx,_fdy);
      if(e._warpT>=0.9){ e.build=null; e._working=false; e._warpT=0; e._wp=null; done=true; }   // 해방 → 바로 다음 건물 소환 가능
      active=true; continue; }
    const _f=(typeof _techFoot==='function')?_techFoot(G.tech.race,bd.bk):{w:2,h:2}, _pr=Math.max((_f.w/2)*_techCW(),(_f.h/2)*_techCH())+0.03, _near=Math.hypot(bd.x-e.x,bd.y-e.y)<=_pr;
    if(e.tx==null){
      if(_near){   // 건물 곁에 도착·정착 = 작업 모션
        e._working=true;
        const _fdx=bd.x-e.x, _fdy=bd.y-e.y; if(_fdx*_fdx+_fdy*_fdy>1e-5) e.face=Math.atan2(_fdx,_fdy);   // 건물 내부 중앙을 향해 작업
        e._bpT=(e._bpT!=null?e._bpT:0.5)-dt;
        if(e._bpT<=0){ e._bpSide=((e._bpSide==null?(G.tech.eseq+e.eid)%4:e._bpSide)+1)%4; const _sd=_techBldgSide(bd,e._bpSide); e.tx=_sd.x; e.ty=_sd.y; e._bpT=0.9+((e.eid*37)%7)*0.1; e._working=false; }   // 체류 끝 → 다음 면으로 이동
      } else { e._working=false; const _sd=_techBldgSide(bd,e._bpSide||0); _techRoute(e,_sd.x,_sd.y); }   // 멀리 있으면(재개 등) 우회 경로로 건물 복귀
      active=true; } }
  if(techSeparate()) active=true;   // 도착한 유닛 겹침 분리(메인과 동일) — 공중 한 점 집결 후 완만히 흩어짐
  // 🧱 완성 or 일시정지(동결) 건물과 겹친 유닛을 즉시 경계로 보정 — 진행 중(bt>0, 미일시정지)만 겹침 허용
  // 즉시 보정(속도는 유지) → 벽 안에 머무는 프레임이 없어 경유점 선행 전환이 안 끊김(벽 따라갈 때 속도 출렁임 제거)
  for(const bd of G.tech.ents){ if(bd.type!=='bldg'||bd._lifted||(bd.bt>0 && !bd._bpause)) continue;   // 🛫 부양 건물=공중이라 발판 비움(밀어내지 않음)
    for(const e of G.tech.ents){ if(e.type!=='unit'&&e.type!=='worker') continue;
      if(_techAirOf(e)) continue;   // ✈️ 공중 유닛 = 지형지물(건물) 무시하고 통과
      if(e.build===bd.eid) continue;   // 이 건물을 짓는 일꾼만 겹침 허용
      if(e._inGas && e._gEid===bd.eid) continue;   // ⛽ 가스 채취 중 = 그 건물 안에 머무름(밀어내지 않음)
      const R=_techCollRect(bd,e); if(R.x1<=R.x0||R.y1<=R.y0) continue;   // 심시티 판정 사각(유니온=그룹별 껍질+통과 등급)
      if(e.x<=R.x0||e.x>=R.x1||e.y<=R.y0||e.y>=R.y1) continue;   // 판정 밖
      const pL=e.x-R.x0, pR=R.x1-e.x, pT=e.y-R.y0, pB=R.y1-e.y;
      const mPen=Math.min(pL,pR,pT,pB);   // 최소침투 축으로 경계까지 즉시(관통 잔류 0 — 접선 속도는 그대로라 벽 따라 미끄러짐)
      if(mPen===pL) e.x=R.x0; else if(mPen===pR) e.x=R.x1; else if(mPen===pT) e.y=R.y0; else e.y=R.y1;
      active=true; } }
  for(const R of _techMineralRects()){ for(const e of G.tech.ents){ if(e.type!=='unit'&&e.type!=='worker') continue;   // 💎 미네랄 안에 들어온 유닛 즉시 경계로(지상만 — 지형지물)
      if(_techAirOf(e)) continue;   // ✈️ 공중 유닛 = 미네랄 무시하고 통과
      if(e.x<=R.x0||e.x>=R.x1||e.y<=R.y0||e.y>=R.y1) continue;
      const pL=e.x-R.x0, pR=R.x1-e.x, pT=e.y-R.y0, pB=R.y1-e.y, mPen=Math.min(pL,pR,pT,pB);
      if(mPen===pL) e.x=R.x0; else if(mPen===pR) e.x=R.x1; else if(mPen===pT) e.y=R.y0; else e.y=R.y1;
      active=true; } }
  // 🚧 이동 유닛 ↔ 정지 유닛 물리 충돌(정지 유닛 = 자리 차지) — 겹치면 이동 유닛을 접촉 거리까지 즉시 밀어냄(속도 유지)
  // 틈을 유닛이 막고 있을 때 비비다 뚫고 지나가던 현상 방지(경로 회피 실패 시에도 물리적으로 통과 불가)
  { const GWp=GW||390, GHp=GH||390, _rrP=k=>(((U[k]&&U[k].size)||14)*0.62)*(typeof TECH_USCALE!=='undefined'?TECH_USCALE:1)*(typeof TECH_PACK!=='undefined'?TECH_PACK:1);
    for(const e of G.tech.ents){ if((e.type!=='unit'&&e.type!=='worker')||e.tx==null) continue;   // 이동 중 유닛만 보정(정지끼리는 techSeparate)
      if(_techAirOf(e)) continue;   // 공중은 스택 허용(기존 규약)
      const rM=_rrP(_techEntKey(e));
      for(const o of G.tech.ents){ if(o===e||(o.type!=='unit'&&o.type!=='worker')||o.tx!=null) continue;
        if(_techAirOf(o)) continue;
        const cpx=rM+_rrP(_techEntKey(o));   // 접촉 거리(px)
        let dxp=(e.x-o.x)*GWp, dyp=(e.y-o.y)*GHp, dp=Math.hypot(dxp,dyp);
        if(dp>=cpx) continue;
        if(dp<0.01){ dxp=1; dyp=0; dp=1; }   // 정확히 겹침 → 옆으로
        e.x=o.x+(dxp/dp)*cpx/GWp; e.y=o.y+(dyp/dp)*cpx/GHp;   // 접촉 거리까지 즉시 밀어냄
        const nX=dxp/dp, nY=dyp/dp, vdx=e.vx||0, vdy=e.vy||0, rad=nX*vdx+nY*vdy;   // rad<0 = 정지 유닛 쪽으로 향하는 속도 성분
        if(rad<0){ const tX=-nY, tY=nX, sgn=((tX*vdx+tY*vdy)>=0)?1:-1;   // 🫸 어깨 스침: 막힌 정면 성분을 접선으로 전환 → 밀리며 정체(_mvStuck 정지) 없이 옆으로 흘러 지나감
          e.vx=vdx-nX*rad+sgn*tX*(-rad)*0.85; e.vy=vdy-nY*rad+sgn*tY*(-rad)*0.85; }
        for(const bd2 of G.tech.ents){ if(bd2.type!=='bldg'||bd2._lifted||(bd2.bt>0&&!bd2._bpause)||e.build===bd2.eid) continue;   // 밀어낸 자리가 건물 안이면 다시 경계로(부양 제외)
          const R2=_techCollRect(bd2,e); if(R2.x1<=R2.x0||R2.y1<=R2.y0) continue;
          if(e.x<=R2.x0||e.x>=R2.x1||e.y<=R2.y0||e.y>=R2.y1) continue;
          const pL2=e.x-R2.x0, pR2=R2.x1-e.x, pT2=e.y-R2.y0, pB2=R2.y1-e.y, mP2=Math.min(pL2,pR2,pT2,pB2);
          if(mP2===pL2) e.x=R2.x0; else if(mP2===pR2) e.x=R2.x1; else if(mP2===pT2) e.y=R2.y0; else e.y=R2.y1; }
        const ddx=(e.x-o.x)*GWp, ddy=(e.y-o.y)*GHp;   // 건물과 정지 유닛 사이 쐐기(둘 다 만족 불가) → 이번 프레임 이동 취소(조금씩 굴러 넘어가는 것 방지)
        if(Math.hypot(ddx,ddy)<cpx*0.96 && e._pfx!=null){ e.x=e._pfx; e.y=e._pfy; e.vx=0; e.vy=0; }
        active=true; } } }
  // 🚫 터널링 방지: 겹치는 두 판정 사각(밀봉·차단 조합) 사이에 낀 유닛 — 순차 밀어냄이 반대편으로 뚫는 것을 차단. 보정 후에도 어느 사각 '안'이면 이번 프레임 이동 취소
  for(const e of G.tech.ents){ if((e.type!=='unit'&&e.type!=='worker')||e.tx==null||e._pfx==null) continue;
    if(_techAirOf(e)) continue;   // ✈️ 공중 유닛 = 지형지물 통과(터널링 방지 되돌림 제외)
    let inR=false; for(const bd of G.tech.ents){ if(bd.type!=='bldg'||bd._lifted||(bd.bt>0&&!bd._bpause)||e.build===bd.eid) continue;
      const R=_techCollRect(bd,e); if(R.x1<=R.x0||R.y1<=R.y0) continue;
      if(e.x>R.x0+1e-6&&e.x<R.x1-1e-6&&e.y>R.y0+1e-6&&e.y<R.y1-1e-6){ inR=true; break; } }
    if(inR){ let pfIn=false; for(const bd of G.tech.ents){ if(bd.type!=='bldg'||bd._lifted||(bd.bt>0&&!bd._bpause)||e.build===bd.eid) continue;
        const R=_techCollRect(bd,e); if(e._pfx>R.x0+1e-6&&e._pfx<R.x1-1e-6&&e._pfy>R.y0+1e-6&&e._pfy<R.y1-1e-6){ pfIn=true; break; } }
      if(!pfIn){ e.x=e._pfx; e.y=e._pfy; e.vx=0; e.vy=0; } } }   // 원래 밖에 있었을 때만 되돌림(스폰 겹침 등 예외 보호)
  if(G.tech.race==='swarm'){   // 🐛 라바 생성(해처리당 최대 3, 8초 주기) + 🥚 알 부화
    let _zd=false;
    for(const cc of G.tech.ents){ if(cc.type!=='bldg'||cc.bt>0||!TECH_CREEP_EXT[cc.bk]) continue;   // 🟣 크립: 건물만 있다가 1타일씩 뚝뚝 확장(단계 바뀔 때만 렌더)
      if((cc._crAge||0)<TECH_CREEP_GROW_T){ cc._crAge=(cc._crAge||0)+dt; const nk=_techCreepStep(cc); if(nk!==cc._crK){ cc._crK=nk; _zd=true; } } }
    for(const g2 of G.tech.ents){ if(g2.type!=='egg') continue; g2.t=Math.max(0,g2.t-dt); active=true; if(g2.t<=0){ g2._dead=true; _zd=true; techHatchEgg(g2); } }
    for(const h of G.tech.ents){ if(h.type!=='bldg'||!TECH_LARVA_BLDG[h.bk]||h.bt>0) continue;   // 🐛 해처리·레어·하이브 = 라바 생성(진화 중에도 계속)
      const _ln=G.tech.ents.reduce((a,l)=>a+((l.type==='larva'&&l.hatch===h.eid)?1:0),0);
      if(_ln<3){ h._lvT=(h._lvT||0)+dt; active=true;
        if(h._lvT>=8){ h._lvT=0; const _bx=_techLarvaBox(h);
          G.tech.ents.push({eid:G.tech.eseq++, type:'larva', hatch:h.eid, x:_bx.x0+Math.random()*(_bx.x1-_bx.x0), y:_bx.y0+Math.random()*(_bx.y1-_bx.y0)}); _zd=true; } }
      else h._lvT=0; }
    for(const lv of G.tech.ents){ if(lv.type!=='larva') continue;   // 🐛 라바 꾸물꾸물: 서식 박스 안에서만 이동↔정지 반복 · 개별 랜덤(동기화 금지)
      const _h=G.tech.ents.find(e=>e.eid===lv.hatch&&e.type==='bldg'&&TECH_LARVA_BLDG[e.bk]); if(!_h) continue; const bx=_techLarvaBox(_h);
      if(lv._wpause==null){ lv._wpause=Math.random()*1.8; lv._wtgt=null; }   // 각 라바 독립 시드
      if(lv._wpause>0){ lv._wpause-=dt; }
      else { if(!lv._wtgt){ const cw=_techCW(), ch=_techCH(); lv._wtgt={ x:Math.max(bx.x0,Math.min(bx.x1, lv.x+(Math.random()-0.5)*cw*0.8)), y:Math.max(bx.y0,Math.min(bx.y1, lv.y+(Math.random()-0.5)*ch*0.15)) }; }   // 근처 미세 목표
        const dx=lv._wtgt.x-lv.x, dy=lv._wtgt.y-lv.y, d=Math.hypot(dx,dy);
        if(d<0.0015){ lv._wtgt=null; lv._wpause=0.5+Math.random()*1.9; }   // 도착 → 정지(랜덤)
        else { const step=Math.min(d, 0.008*dt); lv.x+=dx/d*step; lv.y+=dy/d*step; active=true; } }
      lv.x=Math.max(bx.x0,Math.min(bx.x1,lv.x)); lv.y=Math.max(bx.y0,Math.min(bx.y1,lv.y)); }   // 항상 박스 안
    if(_zd){ G.tech.ents=G.tech.ents.filter(x=>!x._dead); done=true; } }
  for(const be of G.tech.ents){ if(be.type!=='bldg'||be.bt>0||be._lifted) continue;   // 🔢 생산 대기열 · 🔬 업그레이드 진행 — 🛫 부양 중=기능 정지(대기열 일시정지)
    const _blk=_techNeedsPower(be.bk)&&!_techPowered(be.x,be.y);   // 🛑 블랙아웃 = 진행 정지(복구 시 이어서)
    if(be._pq&&be._pq.length){ if(_blk){ active=true; } else { const q=be._pq[0]; q.t=Math.max(0,q.t-dt); active=true; if(q.t<=0){ techFinishProduce(q, be); be._pq.shift(); done=true; } } }
    if(be._rj){ if(_blk){ active=true; } else { const rj=be._rj; rj.t=Math.max(0,rj.t-dt); active=true; if(rj.t<=0){ techApplyResearch(be, rj); be._rj=null; done=true; } } } }
  for(const e of G.tech.ents){ if(e.type!=='bldg'||!e._lifted) continue;   // 🛫 부양 상태 머신: 상승(2s)→비행→(착륙지정)이동→하강(2s)→착지
    if(e._liftPhase==='rising'){ e._liftT=Math.max(0,(e._liftT||0)-dt); e._liftH=Math.min(1,1-e._liftT/TECH_LIFT_T); active=true; if(e._liftT<=0){ e._liftH=1; e._liftPhase='flying'; done=true; } }
    else if(e._liftPhase==='descending'){ e._liftT=Math.max(0,(e._liftT||0)-dt); e._liftH=Math.max(0,e._liftT/TECH_LIFT_T); active=true;
      if(e._liftT<=0){ e._liftH=0; e._lifted=false; e._liftPhase=null; e._landXY=null; e.tx=null; e.ty=null; e._smkBurst=1;   // 착지 순간 먼지 poof
        for(const ad of G.tech.ents){ if(ad.type==='bldg'&&ad._dockOf===e.eid){ if(_techAddonAdjacent(e,ad)){ ad._orphan=false; } else { ad._dockOf=null; ad._orphan=false; if(e._addonEid===ad.eid) e._addonEid=null; } } } done=true; } }   // 착지 완료 → 같은 자리=재연결 / 다른 자리=부속 분리(연결 해제, 새 부속 건설 가능)
    else { const tgt=(e._liftPhase==='toland')?e._landXY:(e.tx!=null?{x:e.tx,y:e.ty}:null);   // 비행 이동 / 착륙 지점 이동
      if(tgt){ const dx=tgt.x-e.x, dy=tgt.y-e.y, d=Math.hypot(dx,dy), spd=TECH_LIFT_SPD*dt;
        if(d<=spd||d<1e-4){ e.x=tgt.x; e.y=tgt.y;
          if(e._liftPhase==='toland'){ const occ=_techLandOccupied(e, e.x, e.y);   // 착륙 직전 자리 점검
            if(occ){ if(occ.same){ _techExplodeBldg(e); } else { e._liftPhase='flying'; e._landXY=null; if(typeof toast==='function') toast('⛔ 착륙 자리 있음 — 다른 곳 지정'); } }   // 동시=폭발 / 선점=비행 유지(못 내려감)
            else { e._liftPhase='descending'; e._liftT=TECH_LIFT_T; } done=true; }
          else { e.tx=null; e.ty=null; } }
        else { e.x+=dx/d*spd; e.y+=dy/d*spd; } active=true; } } }
  if(G.tech.ents.some(x=>x._dead)){ for(const x of G.tech.ents){ if(x._dead&&x.bk==='nydus') _techNydusUnlink(x); } G.tech.ents=G.tech.ents.filter(x=>!x._dead); }   // 💥 폭발한 건물 제거(🕳 나이더스=반대편 고장)
  for(const e of G.tech.ents){ if(!e._chq||!e._chq.length) continue; if(e.type==='bldg'&&e.bt>0) continue;   // 🚀 내부 장전 큐(캐리어·리버·핵 사일로) — 맨 앞 1개만 진행
    const it=e._chq[0]; it.t=Math.max(0,it.t-dt); active=true; if(it.t<=0){ e._chc=(e._chc||0)+1; e._chq.shift(); done=true; } }
  // ⚡ 마나(에너지): 마법 유닛 = 생산 직후 50 + 자연 회복(1.2초당 1). 지정된 캐스터 회복 중이면 바만 스로틀 갱신(perma-render 방지)
  let _manaSel=false;
  for(const e of G.tech.ents){ if(e.type!=='unit'&&e.type!=='worker') continue;
    const _uid=(e.type==='worker')?(TECH_WORKER[G.tech.race]||'worker_light'):e.uid, _sp=techUnitSpec(G.tech.race,_uid)||{};
    if(e.maxHp==null) e.maxHp=_sp.hp||0; if(e.hp==null) e.hp=e.maxHp;   // ❤ 실시간 HP(스팀팩 등 소모 · 회복 없음=SC 테란)
    if(e.maxSh==null) e.maxSh=_sp.sh||0; if(e.sh==null) e.sh=e.maxSh;   // 🛡 실시간 쉴드
    let _mx=(typeof U!=='undefined'&&U[e.uid]&&U[e.uid].energy)||0; if(_mx<=0) continue;
    _mx+=_techAmuletBonus(G.tech.race, e.uid);   // 🔮 부적 연구(+50) — 매 tick 재계산이라 여기서 더해야 유지(khaydarin→하이세이지 200→250)
    if(e.maxEn!==_mx) e.maxEn=_mx;
    if(e.en==null) e.en=Math.min(50,_mx);   // ⚡ 생산 직후 50
    else if(e.en<_mx){ e.en=Math.min(_mx, e.en+dt/1.2); if(G.tech.sel===e.eid||(G.tech.selU&&G.tech.selU.indexOf(e.eid)>=0)) _manaSel=true; } }
  for(const e of G.tech.ents){ if(e.type!=='bldg'||e.bt>0) continue; const _bm=(typeof BLDG_EN!=='undefined'&&BLDG_EN[e.bk])||0; if(_bm<=0) continue;   // 🏢 건물 마나(컴셋·쉴드배터리)
    if(e._skCd) for(const k in e._skCd){ if(e._skCd[k]>0){ e._skCd[k]=Math.max(0,e._skCd[k]-dt); if(G.tech.sel===e.eid) _manaSel=true; } }
    if(e.maxEn!==_bm) e.maxEn=_bm; if(e.en==null) e.en=Math.min(50,_bm); else if(e.en<_bm){ e.en=Math.min(_bm, e.en+dt/1.2); if(G.tech.sel===e.eid) _manaSel=true; } }
  if(G.tech._scans&&G.tech._scans.length){ for(const s of G.tech._scans) s.t-=dt; const _had=G.tech._scans.length; G.tech._scans=G.tech._scans.filter(s=>s.t>0); if(G.tech._scans.length!==_had && G.tech.fog&&G.tech.fog.on){ techFogCompute(); techFogDraw(); } if(G.tech._scans.length) active=true; }   // 📡 스캐너 시야 만료
  // 🔴 선택 프로필 실시간 스탯: 지정 유닛 전체(다중 포함) or 선택 건물의 표시 정수값(HP/쉴드/마나)이 바뀌면 패널 재렌더(선택 당시 고정 아님)
  let _panSig=null;
  if((G.tech.selU||[]).length){ let _s=''; const _cap=Math.min(G.tech.selU.length,16);   // 유닛별 HP 리스트 표시 상한(12)+여유 — 대량 박스 지정 시 해시 비용 상한
    for(let _i=0;_i<_cap;_i++){ const _e=G.tech.ents.find(x=>x.eid===G.tech.selU[_i]); if(_e) _s+=Math.round(_e.hp||0)+'.'+Math.round(_e.sh||0)+'.'+Math.round(_e.en||0)+'.'+Math.round(_e.maxEn||0)+'|'; }
    _panSig=_s; }
  else if(G.tech.sel!=null){ const _e=G.tech.ents.find(x=>x.eid===G.tech.sel); if(_e) _panSig=Math.round(_e.hp||0)+'/'+Math.round(_e.sh||0)+'/'+Math.round(_e.en||0)+'/'+Math.round(_e.maxEn||0); }
  const _panLive=(_panSig!=null && _panSig!==G.tech._panSig);   // 표시값(정수) 변화 감지
  if(done){ if(_techHold) _techDirty=true; else techUIRender(); }
  else { let _panDone=false;
    if(active||_vmoving){ if(_techHold && !_vmoving) _techDirty=true; else techMapRender();   // 🎥 팬·줌 중이면 손가락이 닿아 있어도 그린다(17-build-cards.js 의 _vmoving 주석)
      const _selB=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'):null;   // 선택된 건물(건설·생산·연구·장전 진행) = 프로필 실시간 갱신(스로틀 5/s)
      const _selU1=((G.tech.selU||[]).length===1)?G.tech.ents.find(x=>x.eid===G.tech.selU[0]):null;   // 단일 지정 유닛(캐리어·리버 장전)
      if((_selB && (_selB.bt>0 || (_selB._pq&&_selB._pq.length) || _selB._rj || (_selB._chq&&_selB._chq.length))) || (_selU1&&_selU1._chq&&_selU1._chq.length)){ G.tech._panT=(G.tech._panT||0)+dt; if(G.tech._panT>=0.2){ G.tech._panT=0; techPanelRender(); _panDone=true; } } }
    else if(_manaSel){ G.tech._manaT=(G.tech._manaT||0)+dt; if(G.tech._manaT>=0.2){ G.tech._manaT=0; if(_techHold) _techDirty=true; else techMapRender(); } }
    if(_panLive && !_panDone){ techPanelRender(); } }   // 마나 회복·HP(힐/스팀팩)·쉴드 실시간 → 프로필 수치 갱신
  G.tech._panSig=_panSig; }   // 완성=전체 갱신 / 진행중=맵(+선택 프로필)
// 건설 탭 건물 3D 프리뷰: TECH 건물키 → glb 모델키(선택/배치대기 시 하단 도크에 회전 렌더)
const TECH_MODEL={
  union:{ command:'union_command_center', supply:'union_supply_depot', refinery:'union_refinery', barracks:'union_barracks', academy:'union_academy', engbay:'union_engineering_bay', bunker:'union_bunker', turret:'union_missile_turret', factory:'union_factory', machshop:'union_machine_shop', armory:'union_armory', starport:'union_starport', control:'union_control_tower', scifac:'union_science_facility', covert:'union_covert_ops', physics:'union_physics_lab', comsat:'union_comsat_station', nuke:'union_nuclear_silo' },
  swarm:{ hatchery:'swarm_hatchery', extractor:'swarm_extractor', pool:'swarm_spawning_pool', evochamber:'swarm_evolution_chamber', hydraden:'swarm_hydralisk_den', creep:'swarm_creep_colony', sunken:'swarm_sunken_colony', spore:'swarm_spore_colony', lair:'swarm_lair', spire:'swarm_spire', queensnest:'swarm_queens_nest', hive:'swarm_hive', gspire:'swarm_greater_spire', defilermound:'swarm_defiler_mound', ultracavern:'swarm_ultralisk_cavern', nydus:'swarm_nydus_canal' },
  aetherial:{ nexus:'aetherial_nexus', pylon:'aetherial_pylon', assimilator:'aetherial_assimilator', forge:'aetherial_forge', cannon:'aetherial_photon_cannon', gateway:'aetherial_gateway', battery:'aetherial_shield_battery', cyber:'aetherial_cybernetics_core', citadel:'aetherial_temple_of_adun', archives:'aetherial_templar_archives', robo:'aetherial_robotics_facility', robobay:'aetherial_robotics_support_bay', observatory:'aetherial_observatory', stargate:'aetherial_stargate', fleet:'aetherial_fleet_beacon', tribunal:'aetherial_arbiter_tribunal' }
};
// 건설 건물 고정 스펙 — s: 목표 화면크기(모델 바운딩박스로 정규화 → 파일 재추가·다른 맵에도 동일 크기) · f: 정면 방향(yaw 라디안)
// 값만 바꾸면 크기·정면이 확정됨. (스웜·에테리얼은 미지정 시 자동크기 55·정면 0.34)
// 타일 비율 기준 크기(s): 4x3=64 · 4x2=58 · 3x3=52 · 3x2=46 · 2x2=36 · f=정면 yaw
const CST_BLDG_CFG={
  // 유니온(테란)
  union_command_center:{s:64,f:0,dy:8},   // dy = 발판 대비 세로 미세 보정(px, +면 아래로) — 다른 건물과 눈높이 맞춤
  // ⚠ 아래 5개는 위 주석에 줄이 합쳐져 통째로 주석 처리돼 있었다(크기·정면 미적용 → 공학소가 늘 뒷모습). 한 줄에 이어 붙이지 말 것.
  union_barracks:{s:64,f:0}, union_engineering_bay:{s:64,f:Math.PI}, union_factory:{s:64,f:0}, union_starport:{s:64,f:0}, union_science_facility:{s:64,f:0},
  union_refinery:{s:58,f:0},
  union_supply_depot:{s:46,f:0}, union_academy:{s:46,f:0}, union_bunker:{s:46,f:0}, union_armory:{s:46,f:0},
  union_missile_turret:{s:36,f:0}, union_comsat_station:{s:36,f:0}, union_nuclear_silo:{s:36,f:0}, union_machine_shop:{s:36,f:0}, union_control_tower:{s:36,f:0}, union_covert_ops:{s:36,f:0}, union_physics_lab:{s:36,f:0},
  // 스웜(저그)
  swarm_hatchery:{s:64,f:0}, swarm_lair:{s:64,f:0}, swarm_hive:{s:64,f:0},
  swarm_extractor:{s:58,f:-0.52},
  swarm_spawning_pool:{s:46,f:0}, swarm_evolution_chamber:{s:46,f:0.52}, swarm_hydralisk_den:{s:46,f:0}, swarm_queens_nest:{s:46,f:0}, swarm_defiler_mound:{s:46,f:-1.57}, swarm_ultralisk_cavern:{s:46,f:0.52},
  swarm_creep_colony:{s:36,f:0}, swarm_sunken_colony:{s:36,f:0}, swarm_spore_colony:{s:36,f:0.52}, swarm_spire:{s:36,f:0}, swarm_greater_spire:{s:36,f:0}, swarm_nydus_canal:{s:36,f:-0.52},
  // 에테리얼(프로토스)
  aetherial_nexus:{s:64,f:0}, aetherial_gateway:{s:64,f:0}, aetherial_stargate:{s:64,f:1.136},
  aetherial_assimilator:{s:58,f:0},
  aetherial_forge:{s:52,f:Math.PI}, aetherial_cybernetics_core:{s:52,f:0}, aetherial_temple_of_adun:{s:52,f:0}, aetherial_templar_archives:{s:52,f:0}, aetherial_robotics_facility:{s:52,f:0}, aetherial_robotics_support_bay:{s:52,f:0}, aetherial_fleet_beacon:{s:52,f:0}, aetherial_arbiter_tribunal:{s:52,f:0},
  aetherial_observatory:{s:46,f:0},
  aetherial_pylon:{s:36,f:0}, aetherial_photon_cannon:{s:36,f:0}, aetherial_shield_battery:{s:36,f:0}
};
try{ if(typeof window!=='undefined') window.CST_BLDG_CFG=CST_BLDG_CFG; }catch(_e){}
const CST_YSHIFT=34;   // 건설 건물 3D 전체를 화면 아래로 내리는 양(px). 키우면 더 아래로.
const CST_YAW=-0.52;   // 유니온·에테리얼 정면 회전(라디안). -0.52≈왼쪽 30°.
try{ if(typeof window!=='undefined') window.CST_YAW=CST_YAW; }catch(_e){}   // 업그레이드 탭 각도 통일용(모듈에서 참조)
const TECH_WORKER={ union:'worker_human', swarm:'worker_swarm', aetherial:'worker_light', feral:'worker_feral', colossus:'worker_col' };   // 종족별 일꾼(모델 없으면 2D 폴백)
const TECH_UNIT_YOFF=6;   // 건설 맵 3D 유닛 바닥 보정(px) — 크기는 메인과 동일한 유닛별 SCALE 그대로
const CST_BVIS=1.12;     // 🏢 건설 화면 건물 3D 모델 미세 확대(발판 대비)
const TECH_UVIS=0.98;    // 🚶 건설 화면 전투 유닛 3D 모델 미세 축소(충돌·간격은 그대로)
const TECH_WVIS=0.92;    // 🔧 일꾼(정비공)만 별도 축소 배율
const TECH_USCALE=0.5;   // 건설 맵 전용 유닛 축소 배율(건물 대비 절반) — 시각 크기·충돌·소환 간격에 함께 적용(건물은 footprint 폭에 맞춰 렌더되어 무영향)
const TECH_PACK=0.6;   // 건설 맵 밀집도(충돌/소환 반경 = U.size*0.62*TECH_USCALE*TECH_PACK) — 낮을수록 여백 없이 따닥따닥. U.size(2D 충돌)는 3D 축소 시각보다 커서 이 값으로 실제 크기에 맞춤
const TECH_COLL_YUP=0.7;   // 건물 이동충돌 사각을 발판 대비 위로 올리는 양(셀 수, 건물 크기와 무관한 고정값) — 3D 모델의 발판 위 솟음은 발판 깊이에 비례하지 않으므로 고정 시프트. 넓은/큰 건물(4x3 등)도 상단이 과하게 막히지 않음. 값↑=위로
// ── 🧱 스타1식 심시티(길막) — 유니온 한정: 건물 그룹별 비대칭 판정 껍질 + 유닛 통과 등급 ──
// 공식(가이드 재현): A↖+B↘ 붙이면 완전 밀봉(1등급도 불가) · B↖+A↘ = 1~2등급만 통과 · A+A, B+B = 1~2등급만 통과 · 1타일 띄우면 4등급도 통과
const TECH_SIM_GROUP={ command:'A',barracks:'A',engbay:'A',factory:'A',starport:'A',scifac:'A',refinery:'A',
  supply:'B',academy:'B',bunker:'B',armory:'B', turret:'C',comsat:'C',nuke:'C',machshop:'C',control:'C',covert:'C',physics:'C',   // 유니온: A=대형(4x3+리파이너리) B=중형(3x2) C=소형·애드온(2x2)
  nexus:'pA',gateway:'pA',stargate:'pA',assimilator:'pA',   // 에테리얼: pA=대형(4x3+어시밀레이터)
  forge:'pB',cyber:'pB',citadel:'pB',archives:'pB',robo:'pB',robobay:'pB',fleet:'pB',tribunal:'pB',observatory:'pB',   // pB=테크(3x3·옵저버터리 3x2)
  pylon:'pC',cannon:'pC',battery:'pC' };   // pC=소형(2x2)
const TECH_SIM_MG={ A:{l:0.35,t:0.35,r:0,b:0}, B:{l:0.18,t:0.18,r:0.18,b:0.18}, C:{l:0.18,t:0.18,r:0.18,b:0.18},   // 유니온 판정 여백(셀) — A는 오른쪽/아래 판정이 두꺼움(여백 0, 스타1 엔진 비대칭)
  pA:{l:0.62,t:0.62,r:0.15,b:0.15}, pB:{l:0.6,t:0.6,r:0.2,b:0.2}, pC:{l:0.05,t:0.05,r:0.2,b:0.2} };   // 에테리얼 — 공식: pA+pB=질럿 구멍(0.75) · pA+pA=질럿 구멍(0.77, 게이트끼리도 틈 샘) · pA↖pC↘=완전 밀봉(0.20) · pC↖pA↘=틈(0.82) · pB+pB=질럿 구멍(0.8) · pC+pC=저글링만(0.25) — 질럿 구멍=3등급 통과·4등급 차단
const TECH_GAP_GRADE={ ghost:1,snapper:1,broodling:1, marine:2,medic:2,high_templar:2,
  machinegun:3,worker_human:3,worker_swarm:3,worker_light:3,blade:3,hydra:3,dark_templar:3,
  racer:4,tank:4,goliath:4,dragoon:4,archon:4,larva:4,thornqueen:4,medusa:4,ultralisk:4 };   // 유닛 통과 등급(1=팬텀급 초소형 … 4=차량·대형). 미지정 지상유닛=3
const TECH_GRADE_D=[0,0.22,0.33,0.72,0.95];   // 등급별 통과에 필요한 틈 지름(셀): 밀봉 0.18<0.22라 1등급도 불가 · A+A 0.35≥0.33 → 2등급 통과 · B↖A↘ 0.53<0.72 → 3등급 불가 · 1타일 1.18≥0.95 → 4등급 통과
function _techGrade(key){ return TECH_GAP_GRADE[key]||3; }
function _techMg(bk){ return TECH_SIM_MG[TECH_SIM_GROUP[bk]||'B']; }
// 건물 b의 이동충돌 사각(월드) — 유닛 e의 통과 등급 여유 포함. 유니온=심시티 껍질(그룹별 비대칭 여백), 그 외 종족=기존(발판+uR 대칭)
function _techCollRect(b, e){ const race=G.tech.race, cw=_techCW(), ch=_techCH(), f=(typeof _techFoot==='function')?_techFoot(race,b.bk):{w:2,h:2};
  const bcy=b.y-ch*(typeof TECH_COLL_YUP!=='undefined'?TECH_COLL_YUP:0), hx=(f.w/2)*cw, hy=(f.h/2)*ch;
  let mg, cr;   // mg=판정 여백(셀) · cr=유닛 통과 반경(셀)
  if(race==='union'||race==='aetherial'){ mg=_techMg(b.bk); cr=TECH_GRADE_D[_techGrade(_techEntKey(e))]/2; }   // 심시티 판정(유니온+에테리얼)
  else { const uRw=(((U[_techEntKey(e)]||{}).size||14)*0.62)*(typeof TECH_USCALE!=='undefined'?TECH_USCALE:1)*(typeof TECH_PACK!=='undefined'?TECH_PACK:1)/(GW||390); mg={l:0,t:0,r:0,b:0}; cr=uRw/cw; }
  const R={ x0:b.x-hx+(mg.l-cr)*cw, x1:b.x+hx-(mg.r-cr)*cw, y0:bcy-hy+(mg.t-cr)*ch, y1:bcy+hy-(mg.b-cr)*ch };
  if(b._dockOf!=null){ const par=G.tech.ents.find(p=>p.eid===b._dockOf&&p.type==='bldg'&&p.bt<=0&&!p._lifted); if(par){ const pr=_techCollRect(par,e); R.y0=Math.min(R.y0,pr.y0); R.x0=Math.min(R.x0,pr.x1-0.001); } }   // 🔗 애드온 = 본체와 한 덩어리: 위쪽 노치(빈칸)·이음새를 본체 상단·우측까지 확장해 봉인(유닛 통과 불가)
  return R; }
function _techEntModel(e){ if(!e) return null; if(e.type==='worker') return (TECH_WORKER[G.tech.race]||'worker_human'); if(e.type==='unit') return e.uid; if(e.type==='larva') return 'swarm_larva'; if(e.type==='egg') return 'swarm_egg'; return null; }   // 엔티티 → 3D 모델 키 · 🐛 라바=swarm_larva · 🥚 알=swarm_egg
function _techRaceUnitKeys(race){ const keys=new Set(); keys.add(TECH_WORKER[race]||'worker_human'); if(race==='swarm'){ keys.add('swarm_larva'); keys.add('swarm_egg'); } const bs=(TECH_TREE[race]&&TECH_TREE[race].buildings)||[]; for(const b of bs){ for(const p of (b.produces||[])) if(p&&p.id) keys.add(p.id); } return [...keys]; }   // 그 종족 건설 맵에서 쓸 유닛 모델 키(일꾼+생산 유닛 + 스웜 라바·알)
function techHidePreview(){ const prev=document.getElementById('cstPrev'), main=document.getElementById('cstMain'); if(prev) prev.classList.remove('on'); if(main) main.classList.remove('hasPrev'); if(window.M3D&&M3D.cstStop) M3D.cstStop(); }
function techUIEnsure(){ if(!G.tech||!TECH_TREE[G.tech.race]) techUIInit('union'); techUIRender(); }
function _techReqMet(req){ if(!req) return true; const _noGas=techWallet();   // 오토배틀: 가스 건물이 없으니 그 선행조건은 면제
  for(const r of req){ if(_noGas && ((techGetBldg(G.tech.race,r)||{}).gas)) continue;
    if(!(G.tech.built[r]>0||G.tech.addon[r])) return false; } return true; }
const TECH_SUP_MAX=200;   // 인구 상한(보급 건물을 더 지어도 이 이상은 안 늘어남)
function _techAddSupCap(n){ if(!n) return; G.tech.supCap=Math.min(TECH_SUP_MAX, (G.tech.supCap||0)+n); }   // 인구 상한 반영(단일 소스)
// ── 오토배틀 지갑 연동 ────────────────────────────────────────────────
// 관리자 건설은 크레딧/에너지 2자원이지만 오토배틀은 골드 하나뿐(채취 경제 미도입).
// → 에너지 비용을 크레딧으로 환산해 골드에서만 차감하고, 표기도 크레딧으로 합쳐 보여준다.
const STK_TECH_G2C=2;                     // 에너지 1 = 크레딧 2
function techWallet(){ return (typeof G!=='undefined' && G.strike && typeof STK!=='undefined' && STK && STK.me) ? STK.me : null; }
function techCostCr(m,g){ return (m||0)+(g||0)*STK_TECH_G2C; }
function techCostView(cr,en){ return techWallet() ? { cr:techCostCr(cr,en), en:0 } : null; }   // 표기 변환(오토배틀만)
function techSyncWallet(){ const w=techWallet(); if(!w||!G.tech) return; G.tech.credit=Math.floor(w.gold||0); G.tech.energy=0; }   // 건설 화면 자원 표시 = 오토배틀 골드
function _techAfford(m,g){ const w=techWallet(); if(w) return G.tech.inf || Math.floor(w.gold||0)>=techCostCr(m,g);
  return G.tech.inf || (G.tech.credit>=(m||0) && G.tech.energy>=(g||0)); }
function _techSpend(m,g){ if(G.tech.inf) return; const w=techWallet();
  if(w){ w.gold-=techCostCr(m,g); techSyncWallet(); return; }
  G.tech.credit-=(m||0); G.tech.energy-=(g||0); }
const TECH_SELL_BACK=0.5;   // 철거·취소 환불 비율(오토배틀) — 조합 교체에 대가를 치른다
function techRefund(m,g){ if(!G.tech||G.tech.inf) return; const w=techWallet();
  if(w){ m=Math.round((m||0)*TECH_SELL_BACK); g=Math.round((g||0)*TECH_SELL_BACK); }
  if(w){ w.gold+=techCostCr(m,g); techSyncWallet(); return; }
  G.tech.credit+=(m||0); G.tech.energy+=(g||0); }   // 취소·철거 환불(오토배틀=골드로 반환)
// ⛔ 실패 사유 안내(단일 소스) — 자원은 크레딧/에너지를 구분, 인구는 최대치/부족을 구분해서 무엇이 모자란지 바로 알려줌
function _techWhyRes(m,g){ if(G.tech.inf) return ''; if(techWallet()) return _techAfford(m,g)?'':'크레딧이 부족합니다.';   // 오토배틀=크레딧 단일 자원
  if(G.tech.credit<(m||0)) return '크레딧이 부족합니다.'; if(G.tech.energy<(g||0)) return '에너지가 부족합니다.'; return ''; }
function _techWhyPop(pop){ if(G.tech.inf||!pop) return ''; if(G.tech.sup+pop<=G.tech.supCap) return '';
  return (G.tech.supCap>=TECH_SUP_MAX)?'인구수가 최대입니다.':'인구수가 부족합니다.'; }   // 상한(200)까지 올린 상태 = 최대 · 그 외(여유 0 포함) = 부족(보급 건물로 확장 가능)
function _techFailRes(m,g){ const w=_techWhyRes(m,g); if(w&&typeof toast==='function') toast(w); return !!w; }   // 부족하면 안내 후 true
function _techFailPop(pop){ const w=_techWhyPop(pop); if(w&&typeof toast==='function') toast(w); return !!w; }
// 발판(격자 점유 칸) 사각형 히트 — 모델 반경 기준 원형 판정은 실제 건물보다 훨씬 넓어 옆 땅을 눌러도 잡혔다
function _techBldgRectAt(x,y){ if(!G.tech) return undefined; const cw=_techCW(), ch=_techCH();
  let best=null;
  for(let i=G.tech.ents.length-1;i>=0;i--){ const e=G.tech.ents[i]; if(e.type!=='bldg') continue;
    const f=_techFoot(G.tech.race,e.bk)||{w:2,h:2};
    if(Math.abs(x-e.x)<=f.w*cw/2 && Math.abs(y-e.y)<=f.h*ch/2){ best=e; break; } }
  return best;   // null=빈 땅(주변 건물 안 잡힘)
}
function _techEntAt(x,y){ { const _b=_techBldgRectAt(x,y); if(_b) return _b; }   // 건물은 발판 안에서만
 let best=null,bd=1e9; const _W=(typeof GW!=='undefined'&&GW)?GW:380, _H=(typeof GH!=='undefined'&&GH)?GH:440, _ys=(typeof CST_YSHIFT!=='undefined'?CST_YSHIFT:34); for(let i=G.tech.ents.length-1;i>=0;i--){ const e=G.tech.ents[i]; if(e.type==='bldg') continue;   // 건물은 위에서 발판 사각형으로 이미 판정
    let rad=(e.type==='larva'||e.type==='egg'?0.038:0.055), cy=e.y; if(e.type==='bldg'){ const _mk=(TECH_MODEL[G.tech.race]||{})[e.bk]; const _cf=(typeof CST_BLDG_CFG!=='undefined')?CST_BLDG_CFG[_mk]:null; const _sz=(_cf&&_cf.s)||50; rad=(_sz*0.6)/_W; cy=e.y+(_ys-_sz*0.35)/_H; if(e._lifted) cy-=(e._liftH||0)*TECH_LIFT_PX/_H; } const dx=e.x-x, dy=cy-y, d=dx*dx+dy*dy; if(d<=rad*rad && d<bd){ bd=d; best=e; } } return best; }   // 🛫 부양=히트박스도 위로
function _techBldgAt(x,y){ { const _r=_techBldgRectAt(x,y); if(_r!==undefined) return _r; } let best=null,bd=1e9; const _W=(typeof GW!=='undefined'&&GW)?GW:380, _H=(typeof GH!=='undefined'&&GH)?GH:440, _ys=(typeof CST_YSHIFT!=='undefined'?CST_YSHIFT:34); for(let i=G.tech.ents.length-1;i>=0;i--){ const e=G.tech.ents[i]; if(e.type!=='bldg') continue; const _mk=(TECH_MODEL[G.tech.race]||{})[e.bk]; const _cf=(typeof CST_BLDG_CFG!=='undefined')?CST_BLDG_CFG[_mk]:null; const _sz=(_cf&&_cf.s)||50; const rad=(_sz*0.6)/_W; let cy=e.y+(_ys-_sz*0.35)/_H; if(e._lifted) cy-=(e._liftH||0)*TECH_LIFT_PX/_H; const dx=e.x-x, dy=cy-y, d=dx*dx+dy*dy; if(d<=rad*rad && d<bd){ bd=d; best=e; } } return best; }   // 🧱 건물만 히트(유닛이 위에 있어도 관통) — 선택 히트범위와 동일
function _techResInfo(){ techSyncWallet();
  const stats=techWallet()? [['크레딧',G.tech.inf?'∞':''+G.tech.credit],['인구',G.tech.sup+'/'+G.tech.supCap]]   // 오토배틀=크레딧 단일 자원
    : [['크레딧',G.tech.inf?'∞':''+G.tech.credit],['에너지',G.tech.inf?'∞':''+G.tech.energy],['인구',G.tech.sup+'/'+G.tech.supCap]];
  return { eb:'자원', name:TECH_TREE[G.tech.race].name, desc:'일꾼 탭 → 건물 선택 → 맵을 탭해 배치', stats }; }
// 하단 패널 모델
function techBuildListModel(){ const race=G.tech.race, t=TECH_TREE[race];
  const items=t.buildings.filter(b=>!b.addonTo&&!b.evolveOnly&&!(techWallet()&&b.gas)).map(b=>{ const cnt=(G.tech.built[b.k]||0)+(G.tech.addon[b.k]?1:0), spec=techBldgSpec(race,b.k)||{};   // 🔗 부속·🧬 진화 전용(레어·하이브·성큰·스포어·그레이터스파이어)은 일꾼 건설 목록 제외
    const parentOk=!b.addonTo||G.tech.built[b.addonTo]>0, reqok=_techReqMet(b.req)&&parentOk, afford=_techAfford(b.m,b.g), armed=(G.tech.arm===b.k);
    const lock=!!(techWallet() && STK_BLDG_LOCK[b.k]);   // 🔒 오토배틀 전용 잠금(관리자 건설은 영향 없음)
    return { pro:_techBldgPortrait(b.k, b.ico), sn:b.name, cr:b.m, en:b.g, meta:lock?'🔒':(cnt?('✓'+(cnt>1?cnt:'')):(b.addonTo?'부속':(b.supply?'👤+'+b.supply:(spec.size?spec.size.join('×'):'')))), metaCls:cnt&&!lock?'lv':'', state:armed?'sel':((lock||!reqok||!afford)?'dim':'ok'), act:lock?'onclick="toast(\'준비 중인 건물입니다\')"':('onclick="techArm(\''+b.k+'\')"'+_techTipAttr('b',b.k)) }; });   // 길게 = 건물 설명
  return { mode:'build', title:t.name+' · 건설', icon:pIco('👷'), sub:'건물 탭 → 맵을 탭해 배치', items, info:_techResInfo() }; }
// 🔬 이 건물의 연구 목록. 오토배틀은 건물 연구(업그레이드) 자체를 쓰지 않는다 —
//   강화는 업그레이드 탭(_stkSupplyModel)의 전역 항목으로만 하고, 건물은 병력 공급원 역할만 한다.
function _techResList(b){ return (techWallet() || !b) ? [] : (b.research||[]); }
// 🏭 이 건물이 '생산' 프로필을 쓰는가. 관리자 = produces가 하나라도 있으면 생산 건물.
//   오토배틀만 예외 — 전투 유닛은 건물이 웨이브마다 자동 배출(TECH_BLDG_UNIT)하므로 수동 생산은 일꾼뿐이다.
function _techHasProd(b){ const ps=(b&&b.produces)||[];
  return techWallet() ? ps.some(p=>p.id===TECH_WORKER[G.tech.race]) : ps.length>0; }
function techBldgProdModel(b, e){ const race=G.tech.race;
  const bs0=techBldgSpec(race,b.k)||{};
  if(race==='swarm' && TECH_LARVA_BLDG[b.k]){   // 🐛 해처리·레어·하이브 = 유닛 직접 생산 X → 1번 칸 '라바 선택' · 4번 칸 진화 · 페이지2 = 연구 업그레이드
    const selB=(G.tech.sel!=null)?G.tech.ents.find(e=>e.eid===G.tech.sel&&e.type==='bldg'):null, hid=selB?selB.eid:null;
    const _ln=hid!=null?G.tech.ents.reduce((a,l)=>a+((l.type==='larva'&&l.hatch===hid)?1:0),0):0;
    const items=[{ pro:pIco('🐛'), sn:'라바 선택', meta:_ln+'/3', metaCls:'lv', state:_ln>0?'ok':'dim', act:_ln>0?'onclick="techSelectLarva(event)"':'' }, null, null, (_techEvolveCards(b, selB)[0]||null)];   // 4번 슬롯 = 진화(레어/하이브) · 하이브=진화 없음
    for(const r of _techResList(b)) items.push(_techResearchCard(b, r, selB));   // 페이지2(슬롯 1~3) = 이 건물 연구(오토배틀은 없음)
    return { mode:'prod', title:b.name+' <span class="nsub">('+_ln+'/3)</span>', icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs0.hp,bs0.sh), sub:'🐛 라바 선택 후 유닛 생성', items, topRight:_techBldgTR(b),
      info:{ eb:'생산', hideName:true, desc:'8초마다 라바 1기 생성<br>(최대 3).', cr:0, en:0, time:'' } }; }   // 라바 수 = 이름 옆 괄호 · 괄호는 줄바꿈
  if(TECH_AMMO[b.k] && !TECH_AMMO[b.k].unit){ const a=TECH_AMMO[b.k], cap=_techAmmoCap(b.k), have=(e?((e._chc||0)+((e._chq||[]).length)):0);   // ☢️ 뉴클리어 사일로 = 단일 장전(5큐 아님)
    const aitems=[{ pro:pIco(a.ico), sn:a.label+' 장전', cr:a.m, en:a.g, meta:have+'/'+cap, metaCls:'lv', state:(have>=cap||!_techAfford(a.m,a.g))?'dim':'ok', act:'onclick="techChargeAmmo(event,\''+b.k+'\')"' }];
    return { mode:'prod', title:b.name, icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs0.hp,bs0.sh), sub:'☢️ 단일 장전(최대 1)', items:aitems, info:_techAmmoInfo(e||{}, b.k) }; }
  const pq=(e&&e._pq)||[], qFull=pq.length>=5;   // 🔢 건물별 생산 대기열(최대 5)
  const _prodShow=techWallet() ? (b.produces||[]).filter(p=>p.id===TECH_WORKER[race]) : (b.produces||[]);   // 🎮 오토배틀만: 전투 유닛은 건물이 자동 배출(TECH_BLDG_UNIT)이라 수동 생산은 일꾼만. 관리자 건설은 전 유닛 생산 그대로.
  const items=_techWithAddons(_prodShow.map(p=>{ const reqok=_techReqMet(p.req), afford=_techAfford(p.m,p.g), popok=G.tech.inf||!p.pop||(G.tech.sup+p.pop<=G.tech.supCap), cnt=G.tech.units[p.id]||0;
    return { pro:_techUnitPortrait(p.id), sn:_techRealName(race,p.id), cr:p.m, en:p.g, meta:cnt?('×'+cnt):(p.pop?'👤'+p.pop:''), metaCls:cnt?'lv':'', state:(qFull||!reqok||!afford||!popok)?'dim':'ok', act:'onclick="techDoProduce(\''+p.id+'\',\''+b.k+'\')"'+_techTipAttr('u',p.id,b.k) }; }), b.k);   // 길게 = 유닛 설명   // 🔗 부속 카드는 마지막 그리드로 · 대기열 가득참=비활성
  const bs=techBldgSpec(race,b.k)||{};
  const front=pq[0]; let progLabel,progVal,progTime='',prog=0;
  if(front){ progLabel='생산 중'; progTime=Math.ceil(front.t)+'s'; progVal=(_techRealName(race,front.id)||''); prog=Math.round((1-front.t/(front.tMax||1))*100); }   // 파랑 진행 바 = 앞 유닛 진행%(유지)
  else { progLabel='생산 대기'; progVal=''; }
  const _qn=pq.length, _f=Math.max(0,Math.min(1,(_qn-1)/4)), _gb=Math.round(255-_f*190);   // 🔢 진행 바 아래 얇은 선 = 대기열 채움(1→1/5 … 5=가득), 흰(1)→빨강(5)
  return { mode:'prod', title:b.name, icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs.hp,bs.sh), sub:'유닛 생산 — 탭(최대 5 예약)', items, topRight:_techBldgTR(b),
    info:{ eb:'생산', hideName:true, progLabel, progVal, prog, progTime, qbar:{ fill:Math.round(_qn/5*100), color:(_qn>0?('rgb(255,'+_gb+','+_gb+')'):''), cancel:(_qn>0?(_qn-1):null), n:_qn }, cr:0, en:0, time:'' } }; }
function techBldgUpgModel(b, e){ const race=G.tech.race; const rj=e&&e._rj;
  const items=_techWithAddons(_techResList(b).map(r=>_techResearchCard(b, r, e)), b.k);   // 🔬 연구 카드(단일 소스 _techResearchCard) + 🔗 부속 카드(사이언스 퍼실리티=코버트 옵스·피직스 랩 — 연구 전용 건물이라 빠져 있던 것)
  const bs=techBldgSpec(race,b.k)||{}; let progLabel,progVal,prog,progTime='',val=null;
  if(rj){ prog=Math.round((1-rj.t/(rj.tMax||1))*100); progLabel='연구 중'; progVal=rj.name||''; progTime=Math.ceil(rj.t)+'s';   // 남은 초 = 라벨 옆에 간단히(생산과 통합) · 취소는 진행 카드 탭
    const rd=b.research.find(r=>r.k===rj.rk); if(rd&&rd.tier){ const lv=G.tech.research[race+'_'+rd.k]||0; val={ cur:lv+'Lv', nxt:(lv+1)+'Lv', unit:'', sm:true }; } }   // 단계형 = 진행 바 아래 작게 0Lv ▸ 1Lv
  else { progLabel='연구 대기'; progVal=''; prog=0; }
  return { mode:'upg', title:b.name, icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs.hp,bs.sh), sub:'연구/업그레이드 — 탭', items, topRight:_techBldgTR(b),
    info:{ eb:'업그레이드', hideName:true, val, progLabel, progVal, prog, progTime, cr:0, en:0, time:'' } }; }
// 렌더
// 🖱 버튼을 누르고 있는 동안에는 재렌더를 미룬다.
//   맵은 innerHTML로 통째로 다시 그려지므로, pointerdown과 pointerup 사이에 재렌더가 끼면
//   누르고 있던 요소가 DOM에서 사라져 브라우저가 click을 발생시키지 않는다.
//   (스웜은 라바 생성 주기로 재렌더가 돌아 좌측 버튼이 안 눌리는 증상이 있었다)
let _techHold=0, _techDirty=false;
window.addEventListener('pointerdown', ()=>{ _techHold++; }, true);
window.addEventListener('pointerup', ()=>{ _techHold=Math.max(0,_techHold-1);
  if(!_techHold && _techDirty){ _techDirty=false; setTimeout(()=>{ if(G.tech) techMapRender(); }, 0); } }, true);
window.addEventListener('pointercancel', ()=>{ _techHold=Math.max(0,_techHold-1);
  if(!_techHold && _techDirty){ _techDirty=false; setTimeout(()=>{ if(G.tech) techMapRender(); }, 0); } }, true);
function techUIRender(){ if(!G.tech) return; techMapRender(); techPanelRender(); techHidePreview(); }   // 3D 건물은 메인 렌더러(syncBuild)가 렌더
function techMapRender(){ const map=document.getElementById('cstMain'); if(!map) return; const race=G.tech.race;
  const _res3d=!!(window.M3D&&M3D.hasModel&&M3D.hasModel('res_cn')&&!(G.opt&&G.opt.model3d===false));   // 자원 3D 로드됨 → 2D 이모지(💎💨🎒) 숨김(라벨·구역은 유지)
  let ents='', labels=''; for(const e of G.tech.ents){ let inner,cls;
    if(e.type==='bldg'){ const _b=techGetBldg(race,e.bk)||{}; cls='bldg live3d'; inner='';
      const _bf=(typeof _techFoot==='function')?_techFoot(race,e.bk):{w:2,h:2}, _byB=e.y+(_bf.h/2)*_techCH(), _sb=_techW2S(e.x,_byB);
      const _hw=Math.max(0.05,_bf.w*_techCW()*techView().zoom), _ratio=(e.bt>0)?Math.max(0,Math.min(1,1-e.bt/(e.btMax||1))):1;   // 바 폭=발판 폭(줌) · 건설 중=진행도/완성=풀
      if(e._lifted){ const _sc=_sb, _sw=Math.max(0.07,_bf.w*_techCW()*techView().zoom*1.25);   // 🛫 지면 그림자(발판 하단) — 발판보다 넓게, 높이(_liftH)만큼 진해짐
        ents+='<div class="bLiftShadow" style="left:'+(_sc.x*100).toFixed(2)+'%;top:'+(_sc.y*100).toFixed(2)+'%;width:'+(_sw*100).toFixed(2)+'%;height:'+(_sw*0.46*100).toFixed(2)+'%;opacity:'+(0.15+0.4*(e._liftH||0)).toFixed(2)+'"></div>'; }
      if(e.bt>0) labels+='<div class="bldHp bld" style="left:'+(_sb.x*100).toFixed(2)+'%;top:'+(_sb.y*100).toFixed(2)+'%;width:'+(_hw*100).toFixed(2)+'%"><i style="width:'+(_ratio*100).toFixed(1)+'%"></i></div>';   // 건설 중=진행도 바(실시간 차오름) · 완성+지정 = 아래 쉴드/HP/마나 바로 대체
      const _noPow=_techNeedsPower(e.bk)&&!_techPowered(e.x,e.y);   // 🛑 블랙아웃(동력 없음)
      if(_noPow){ const _sp=_techW2S(e.x,e.y-(_bf.h/2)*_techCH()); labels+='<div class="bldNoPow" style="left:'+(_sp.x*100).toFixed(2)+'%;top:'+(_sp.y*100).toFixed(2)+'%">⚡✕ 동력 없음</div>'; }
      if(_b.gas && e.bt<=0 && e._gasWorker!=null){ const _gp=_techW2S(e.x, e.y-(_bf.h/2)*_techCH()), _gc=_techW2S(e.x, e.y);   // ⛽ 가스 채취 중 = 건물 활성 연출(초록 발광 + 피어오르는 연기)
        labels+='<div class="bGasGlow" style="left:'+(_gc.x*100).toFixed(2)+'%;top:'+(_gc.y*100).toFixed(2)+'%"></div>';
        labels+='<div class="bGasFx" style="left:'+(_gp.x*100).toFixed(2)+'%;top:'+(_gp.y*100).toFixed(2)+'%"><i></i><i></i><i></i><i></i><i></i></div>'; }
      if(e.bt>0 && !e._bpause && !techWallet()){ const _lbl=e.waiting?'<span class="bldSpin"></span>':(_noPow?'⏸':(Math.ceil(e.bt)+'s'));   // 일꾼 오는 중 스피너 / 건설 중 시간 · 블랙아웃=정지 표시
        labels+='<div class="bldTime" style="left:'+(_sb.x*100).toFixed(2)+'%;top:'+(_sb.y*100).toFixed(2)+'%">'+_lbl+'</div>'; }
      else if(!techWallet()){ const _q0=(e._pq&&e._pq.length)?e._pq[0]:(e._rj||null); if(_q0){ const _pp=Math.round((1-_q0.t/(_q0.tMax||1))*100); inner='<div class="bprog prod" style="bottom:0"><i style="width:'+_pp+'%"></i></div>'; } } }
    else if(e.type==='larva'){ const _lh3=!!(window.M3D&&M3D.ready&&M3D.ready()&&M3D.hasModel&&M3D.hasModel('swarm_larva')&&!(G.opt&&G.opt.model3d===false)); cls='larvaE'+(_lh3?' live3d':''); inner=_lh3?'':'<span class="lvWig">🐛</span>'; }   // 🐛 라바 · 3D 로드 시 빈 앵커 + live3d(2D 네모 아웃라인 제거 → 유닛과 동일한 3D 하단링)
    else if(e.type==='egg'){ const _eh3=!!(window.M3D&&M3D.ready&&M3D.ready()&&M3D.hasModel&&M3D.hasModel('swarm_egg')&&!(G.opt&&G.opt.model3d===false)); cls='eggE'+(_eh3?' live3d':''); inner=_eh3?'':'<span class="eggWig">🥚</span>'; }   // 🥚 알(변태 중) · 3D 로드 시 빈 앵커(swarm_egg 모델로 렌더)
    else if(e.type==='worker'||e.type==='unit'){ const _mk=_techEntModel(e);
      const _h3=!!(window.M3D&&M3D.ready&&M3D.ready()&&_mk&&M3D.hasModel&&M3D.hasModel(_mk)&&!(G.opt&&G.opt.model3d===false));   // 3D 모델 로드 완료 시 DOM은 빈 앵커, 아니면 초상화 폴백
      if(_h3 && typeof FXLAB_AIR!=='undefined' && FXLAB_AIR.has(_mk)){ const _as=_techW2S(e.x,e.y), _asw=Math.max(0.05,0.95*_techCW()*techView().zoom);   // 🛩 공중 유닛 지면 그림자(고정 고도 부양 → 건물 이륙 그림자와 동일 방식·고정 농도)
        ents+='<div class="bLiftShadow" style="left:'+(_as.x*100).toFixed(2)+'%;top:'+(_as.y*100).toFixed(2)+'%;width:'+(_asw*100).toFixed(2)+'%;height:'+(_asw*0.5*100).toFixed(2)+'%;opacity:0.34"></div>'; }
      cls=(e.type==='worker'?'worker':'unit')+(_h3?' live3d':'');
      const _ore=(!_res3d&&e.type==='worker'&&e._carry)?((e._cKind||e._gKind)==='gas'?'<i class="carryOre gas"></i>':'<span class="carryOre">💎</span>'):'';   // 🎒 운반 중 = 작은 광물/가스 덩어리(3D 로드 시 3D 청크로 대체)
      const _rep=(e.type==='worker'&&e._repairing)?'<span style="position:absolute;left:50%;top:-8px;transform:translateX(-50%);font-size:13px">🔧</span>':'';   // 🔧 수리 중 표시
      inner=(_h3?_rep:(e.type==='worker'?'<span class="be-ico">👷</span>'+_rep:_techUnitPortrait(e.uid)))+_ore; }
    const _seld=(G.tech.sel===e.eid)||(G.tech.selU&&G.tech.selU.indexOf(e.eid)>=0);
    const _s=_techW2S(e.x,e.y); ents+='<div class="bent '+cls+(_seld?' sel':'')+(e._illusion?' illusion':'')+'" style="left:'+(_s.x*100).toFixed(2)+'%;top:'+(_s.y*100).toFixed(2)+'%;transform:translate(-50%,-50%) scale('+techView().zoom.toFixed(2)+')">'+inner+'</div>';
    if(_seld && e.type!=='egg' && e.type!=='larva' && !(e.type==='bldg'&&e.bt>0)){   // 🛡 지정 시 쉴드+HP(+마나) 바 — 건설탭도 표시(전투 아님=항상 가득)
      let _mHp=0,_mSh=0,_mEn=0,_bx=_s.x,_bTop,_bW;
      if(e.type==='bldg'){ const _bs=techBldgSpec(race,e.bk)||{}, _bf2=(typeof _techFoot==='function')?_techFoot(race,e.bk):{w:2,h:2}, _sbb=_techW2S(e.x,e.y+(_bf2.h/2)*_techCH());
        _mHp=_bs.hp||0; _mSh=_bs.sh||0; _mEn=(typeof BLDG_EN!=='undefined'&&BLDG_EN[e.bk])||0; _bx=_sbb.x; _bTop=(_sbb.y*100).toFixed(2)+'%'; _bW=Math.max(0.05,_bf2.w*_techCW()*techView().zoom); }
      else { const _uid=(e.type==='worker')?(TECH_WORKER[race]||'worker_light'):e.uid, _sp=techUnitSpec(race,_uid)||{};
        _mHp=(e.maxHp!=null?e.maxHp:_sp.hp)||0; _mSh=(e.maxSh!=null?e.maxSh:_sp.sh)||0; _mEn=(typeof U!=='undefined'&&U[_uid]&&U[_uid].energy)||0; _bTop='calc('+(_s.y*100).toFixed(2)+'% + 17px)'; _bW=Math.max(0.05,0.9*_techCW()*techView().zoom); }   // 유닛 바 = 초상 아래로 살짝 내림(딱 붙지 않게)
      const _hpR=_mHp>0?Math.max(0,Math.min(1,(e.hp!=null?e.hp:_mHp)/_mHp)):1;   // ❤ 실시간 HP(스팀팩 소모 반영)
      const _shR=_mSh>0?Math.max(0,Math.min(1,(e.sh!=null?e.sh:_mSh)/_mSh)):null;   // 🛡 실시간 쉴드
      const _enR=_mEn>0?Math.max(0,Math.min(1,(e.en!=null?e.en:Math.min(50,_mEn))/_mEn)):null;   // ⚡ 실시간 마나(초기 50 → 자연 회복 → 스킬 소모)
      if(_mHp>0) labels+='<div class="bentBar" style="left:'+(_bx*100).toFixed(2)+'%;top:'+_bTop+';width:'+(_bW*100).toFixed(2)+'%">'+_barsHTML({ hpR:_hpR, hpCol:hpBarColor(_hpR), shR:_shR, enR:_enR })+'</div>'; } }
  if(_btBox && _btBox.active){ const bx=Math.min(_btBox.sx0,_btBox.sx1),by=Math.min(_btBox.sy0,_btBox.sy1),bw=Math.abs(_btBox.sx1-_btBox.sx0),bh=Math.abs(_btBox.sy1-_btBox.sy0);   // 🔲 한 손가락 드래그 = 유닛 지정 박스
    ents+='<div class="techSelBox" style="left:'+(bx*100).toFixed(2)+'%;top:'+(by*100).toFixed(2)+'%;width:'+(bw*100).toFixed(2)+'%;height:'+(bh*100).toFixed(2)+'%;position:absolute;border:1.5px solid #46f06a;background:rgba(70,240,106,.14);pointer-events:none;z-index:23;border-radius:2px"></div>'; }
  // 종족 탭 = TECH_TREE 에 있는 것 전부. ⛔ 목록을 여기 손으로 적지 말 것 —
  //   종족을 늘렸을 때 데이터엔 있는데 탭에만 안 뜬다(페럴·콜로서스에서 실제로 그랬다).
  let tabs=''; Object.keys(TECH_TREE).forEach(r=>{ tabs+='<span class="techTab'+(r===race?' on':'')+'" onclick="techRace(event,\''+r+'\')">'+(_TECH_RKO[r]||(TECH_TREE[r]&&TECH_TREE[r].name)||r)+'</span>'; });
  const selE=(G.tech.sel!=null)?G.tech.ents.find(e=>e.eid===G.tech.sel):null, canDemo=selE&&selE.type==='bldg'&&((techGetBldg(race,selE.bk)||{}).k!==TECH_TREE[race].buildings[0].k);
  let res='';   // 🔁 메인 #hudR DOM을 그대로 클론(복사본 마크업 유지 X) — 메인 HUD 디자인 변경 시 자동 반영. 숫자만 이 탭 값으로 치환
  //   ⚠ 오토배틀은 클론을 만들지 않는다 — 건설지에서도 진짜 #hud 가 그대로 떠 있어 두 번 표시된다(strikeHud 가 값을 채운다).
  { const _h=document.getElementById('hudR'); if(_h && !techWallet()){ const c=_h.cloneNode(true);
    const set=(id,v)=>{ const el=c.querySelector('#'+id); if(el){ el.innerHTML=v; el.removeAttribute('id'); } };   // id 제거(중복 방지)
    set('hMin',(G.tech.inf?'∞':G.tech.credit)); set('hGas',(G.tech.inf?'∞':G.tech.energy)); set('hPop',G.tech.sup+'/'+G.tech.supCap);
    res=c.innerHTML; } }
  const btns=(canDemo?'<span class="cbtn dz" onclick="techDemolish(event)">'+pIco('🗑','sm')+' 철거</span>':'')+'<span class="cbtn'+(G.tech.inf?' on':'')+'" onclick="techInf(event)" title="무제한 자원">∞</span><span class="cbtn'+(G.tech.nocool?' on':'')+'" onclick="techNocool(event)" title="즉시 건설·생산">⏱</span><span class="cbtn'+(techFogEnabled()?' on':'')+'" onclick="techFog(event)" title="전장의 안개">🌫️</span><span class="cbtn'+(G.tech.pcheck?' on':'')+'" onclick="techPCheck(event)" title="플레이어 색 확인">🎨</span><span class="cbtn" onclick="techReset(event)" title="리셋">↺</span>';
  // 좌측 도구열: 관리자는 종족 전환·치트 토글까지, 오토배틀은 게임에 필요한 철거만(테스트 도구 비노출)
  const _sideBtns=techWallet()? (canDemo?'<span class="cbtn dz" onclick="techDemolish(event)">'+pIco('🗑','sm')+' 철거</span>':'') : btns;
  const _side=(_sideBtns||!techWallet())? ('<div class="techSide" onpointerdown="event.stopPropagation()">'+(techWallet()?'':'<div class="techTabs">'+tabs+'</div>')+'<div class="techBtns">'+_sideBtns+'</div></div>') : '';
  let oobZ='';   // 건설 가능 구역 밖 = 어두운 진입 불가 구역(위·아래·좌·우 같은 농도, 서로 겹치지 않게 4면 분할)
  if(techWallet()){ const _cl=v=>Math.max(0,Math.min(100,v));
    const _t=_cl(_techW2S(0.5, techY0()).y*100), _b=_cl(_techW2S(0.5, techY1()).y*100);
    const _l=_cl(_techW2S(TECH_GRID.x0, 0.5).x*100), _r=_cl(_techW2S(TECH_GRID.x1, 0.5).x*100);
    if(_t>0) oobZ+='<div class="bOob" style="left:0;right:0;top:0;height:'+_t.toFixed(2)+'%"></div>';
    if(_b<100) oobZ+='<div class="bOob" style="left:0;right:0;top:'+_b.toFixed(2)+'%;bottom:0"></div>';
    if(_b>_t){ const _h=(_b-_t).toFixed(2)+'%';
      if(_l>0) oobZ+='<div class="bOob" style="left:0;top:'+_t.toFixed(2)+'%;height:'+_h+';width:'+_l.toFixed(2)+'%"></div>';
      if(_r<100) oobZ+='<div class="bOob" style="left:'+_r.toFixed(2)+'%;right:0;top:'+_t.toFixed(2)+'%;height:'+_h+'"></div>'; } }
  const pcPanel=G.tech.pcheck?_techPCPanel():'';   // 🎨 플레이어 색 확인 패널(1P~8P 전환 + 전 건물 배치)
  // (플레이어 색 확인 패널은 _techPCPanel에서 생성)
  // 배치 고스트 + ✓/✕ 확정 버튼 (드래그로 위치 조정)
  let ghost='', armBtns='', foot='';
  if(G.tech.arm && G.tech.armXY){ const _ab=techGetBldg(race,G.tech.arm)||{}, _gs=_techW2S(G.tech.armXY.x,G.tech.armXY.y), _ok=techArmValid(G.tech.armXY.x,G.tech.armXY.y);
    const _gmk=(TECH_MODEL[race]||{})[G.tech.arm], _is3d=!!(window.M3D&&M3D.ready&&M3D.ready()&&!(G.opt&&G.opt.model3d===false)&&M3D.hasModel&&M3D.hasModel('cb_'+_gmk));
    const _off=0, _zm=techView().zoom;   // 건물 base가 이제 footprint 하단에 렌더되므로 지면 요소는 실제 셀 위치 그대로
    // 점유 셀 footprint 하이라이트(격자선 포함) — 배치 중에만
    const _f=_techFoot(race,G.tech.arm), _sn=_techSnap(G.tech.armXY.x,G.tech.armXY.y,_f.w,_f.h), _cw=_techCW(), _ch=_techCH();
    const _tl=_techW2S(TECH_GRID.x0+_sn.c0*_cw, techY0()+_sn.r0*_ch), _br=_techW2S(TECH_GRID.x0+(_sn.c0+_sn.w)*_cw, techY0()+(_sn.r0+_sn.h)*_ch);
    const _r=_btRect(), _mW=(_r&&_r.width)||360, _mH=(_r&&_r.height)||420;
    foot='<div class="bfoot '+(_ok?'ok':'bad')+'" style="left:'+(_tl.x*100).toFixed(2)+'%;top:calc('+(_tl.y*100).toFixed(2)+'% + '+_off+'px);width:'+((_br.x-_tl.x)*100).toFixed(2)+'%;height:'+((_br.y-_tl.y)*100).toFixed(2)+'%;background-size:'+(_cw*_mW*_zm).toFixed(1)+'px '+(_ch*_mH*_zm).toFixed(1)+'px"></div>';
    for(const bc of _techFootBlockCells(_sn)){ const _btl=_techW2S(TECH_GRID.x0+bc.c*_cw,techY0()+bc.r*_ch), _bbr=_techW2S(TECH_GRID.x0+(bc.c+1)*_cw,techY0()+(bc.r+1)*_ch);   // 유닛 점유 셀 = 빨간색
      foot+='<div class="bfootBlk" style="left:'+(_btl.x*100).toFixed(2)+'%;top:calc('+(_btl.y*100).toFixed(2)+'% + '+_off+'px);width:'+((_bbr.x-_btl.x)*100).toFixed(2)+'%;height:'+((_bbr.y-_btl.y)*100).toFixed(2)+'%"></div>'; }
    if(!_is3d) ghost='<div class="bent bghost '+(_ok?'ok':'bad')+'" style="left:'+(_gs.x*100).toFixed(2)+'%;top:calc('+(_gs.y*100).toFixed(2)+'% + '+_off+'px);transform:translate(-50%,-50%) scale('+_zm.toFixed(2)+')"><span class="be-ico">'+(_ab.ico||'🏢')+'</span></div>';   // 3D 미가용 폴백(이모지)
    const _fbx=(_tl.x+_br.x)/2, _fby=_br.y;   // 발판 하단 중앙 → 배너 앵커
    armBtns='<div class="bArmBtns" style="left:'+(_fbx*100).toFixed(2)+'%;top:calc('+(_fby*100).toFixed(2)+'% + '+_off+'px)" onpointerdown="event.stopPropagation()" onpointerup="event.stopPropagation()"><button class="bArmBtn ok'+(_ok?'':' dis')+'" onclick="techConfirmPlace(event)" title="확정"><svg viewBox="0 0 24 24" width="15" height="15" style="display:block"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button><button class="bArmBtn cancel" onclick="techCancelArm(event)" title="취소">✕</button></div>'; }   // ▶ 확정 + ✕ 취소 — 발판 하단 중앙
  let resumeBtn='';   // ▶ 재개 — 일시정지된 건물 선택 시 발판 하단에 뜸
  if(G.tech.sel!=null){ const _sb=G.tech.ents.find(e=>e.eid===G.tech.sel&&e.type==='bldg'); if(_sb&&_sb.bt>0&&_sb._bpause){ const _sbf=_techFoot(race,_sb.bk), _rs=_techW2S(_sb.x,_sb.y+(_sbf.h/2)*_techCH());   // 발판 하단 중앙
    resumeBtn='<div class="bArmBtns" style="left:'+(_rs.x*100).toFixed(2)+'%;top:'+(_rs.y*100).toFixed(2)+'%" onpointerdown="event.stopPropagation()" onpointerup="event.stopPropagation()"><button class="bArmBtn ok" onclick="techResumeBuild(event)" title="재개"><svg viewBox="0 0 24 24" width="15" height="15" style="display:block"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button><button class="bArmBtn cancel" onclick="techDemolishBuild(event)" title="철거">✕</button></div>'; } }   // 재개(▶) + 철거(✕) — 단순 아이콘
  const hint=G.tech.skillArm?(((typeof SKILLS!=='undefined'&&SKILLS[G.tech.skillArm.key])||{}).arm||'🪄 대상을 탭하세요'):(G.tech.arm?('📍 '+((techGetBldg(race,G.tech.arm)||{}).name)+(G.tech.armXY?' — 드래그로 위치 조정 후 ✓ 확정':' — 지을 곳을 탭하세요')):((G.tech.selU&&G.tech.selU.length)?('👥 '+G.tech.selU.length+'기 지정 — 탭/드래그로 이동 · 해제는 우상단 ✕'):(G.tech.sel==null?'일꾼 탭=건설 메뉴 · 드래그=유닛 지정 · 두 손가락=화면 이동':'건물을 탭하면 하단 시트에 생산·연구가 표시됩니다')));
  let _floorSt='';   // 오토배틀: 바닥 타일 1개 = 격자 STK_FLOOR_CELLS칸 — 칸 크기·격자 원점에 정확히 맞춤
  if(techWallet()){ const _mw=map.clientWidth||375, _mh=map.clientHeight||620, _fc=STK_FLOOR_CELLS;
    _floorSt=';background-size:'+(_techCW()*_mw*_fc).toFixed(2)+'px '+(_techCH()*_mh*_fc).toFixed(2)+'px'
            +';background-position:'+(TECH_GRID.x0*_mw).toFixed(2)+'px '+(techY0()*_mh).toFixed(2)+'px'; }
  const _floor='<div class="bmapFloor" style="transform:'+_techViewCSS()+_floorSt+'"></div>';   // 바닥 = 메인맵과 동일한 뷰 변환(_techViewCSS = viewApply의 CSS판)
  let creepZ='';   // 🟣 크립(스웜 지형) — 항상 표시, 스웜 건물 배치 중이면 강조
  if(race==='swarm'){ const _ccw=_techCW(), _cch=_techCH(), _hot=!!(G.tech.arm&&_techNeedsCreep(G.tech.arm));
    for(const cs of _techCreepSrcs()){ const r=_techCreepR(cs);
      const _ctl=_techW2S(cs.x-r[0]*_ccw, cs.y-r[1]*_cch), _cbr=_techW2S(cs.x+(r[0]+TECH_ASYM)*_ccw, cs.y+(r[1]+TECH_ASYM)*_cch);   // 우/하 비대칭
      creepZ+='<div class="bCreep'+(_hot?' hot':'')+'" style="left:'+(_ctl.x*100).toFixed(2)+'%;top:'+(_ctl.y*100).toFixed(2)+'%;width:'+((_cbr.x-_ctl.x)*100).toFixed(2)+'%;height:'+((_cbr.y-_ctl.y)*100).toFixed(2)+'%"></div>'; } }
  let psi='';   // 🔵 파일런 동력장 표시 — 동력 필요 건물 또는 파일런 배치 중일 때 각 완성 파일런(+예비 파일런의 미래 필드) 타원 렌더(스타1처럼)
  const _armPylon=(G.tech.arm==='pylon');
  if(G.tech.arm && (_techNeedsPower(G.tech.arm)||_armPylon)){ const _pcw=_techCW(), _pch=_techCH();
    const _psiOne=(px,py,ghost)=>{ const _ptl=_techW2S(px-TECH_PYLON_RX*_pcw, py-TECH_PYLON_RY*_pch), _pbr=_techW2S(px+(TECH_PYLON_RX+TECH_ASYM)*_pcw, py+(TECH_PYLON_RY+TECH_ASYM)*_pch);   // 우/하 비대칭
      return '<div class="bPsi'+(ghost?' new':'')+'" style="left:'+(_ptl.x*100).toFixed(2)+'%;top:'+(_ptl.y*100).toFixed(2)+'%;width:'+((_pbr.x-_ptl.x)*100).toFixed(2)+'%;height:'+((_pbr.y-_ptl.y)*100).toFixed(2)+'%"></div>'; };
    for(const pl of _techPylons()) psi+=_psiOne(pl.x, pl.y, false);
    if(_armPylon && G.tech.armXY) psi+=_psiOne(G.tech.armXY.x, G.tech.armXY.y, true); }   // 예비 파일런의 동력장 미리보기(강조)
  let gasZone='';   // (오토배틀=미사용, 아래 블록 자체를 건너뜀)   // ⛽ 가스 광산 구역(고정 지형) — 줌/팬 따라 이동, 가스 건물 배치 중이면 강조. 가스 건물이 서 있으면 숨김(겹쳐 보임 방지)
  const _gasBuilt=G.tech.ents.some(e=>e.type==='bldg'&&((techGetBldg(race,e.bk)||{}).gas));
  if(!_gasBuilt && !techWallet()){ const _gcw=_techCW(), _gch=_techCH();
    const _gtl=_techW2S(TECH_GRID.x0+TECH_GAS.c0*_gcw, techY0()+TECH_GAS.r0*_gch), _gbr=_techW2S(TECH_GRID.x0+(TECH_GAS.c0+TECH_GAS.w)*_gcw, techY0()+(TECH_GAS.r0+TECH_GAS.h)*_gch);
    const _gArm=!!(G.tech.arm && (techGetBldg(race,G.tech.arm)||{}).gas);
    gasZone='<div class="bGasZone'+(_gArm?' hot':'')+(_res3d?' d3':'')+'" style="left:'+(_gtl.x*100).toFixed(2)+'%;top:'+(_gtl.y*100).toFixed(2)+'%;width:'+((_gbr.x-_gtl.x)*100).toFixed(2)+'%;height:'+((_gbr.y-_gtl.y)*100).toFixed(2)+'%">'+(_res3d?'':'<span class="gzIco">💨</span>')+'<span class="gzLbl">에너지 광산</span></div>'; }   // 선택 표시는 3D 하단 링
  let hillZ='';   // ⛰ 고지대(언덕) — 좌하단 테스트 지형. 저지→고지 시야 차단 확인용
  { const H=TECH_HILL, tl=_techW2S(H.x0,H.y0), br=_techW2S(H.x1,H.y1);
    hillZ='<div class="bHill" style="left:'+(tl.x*100).toFixed(2)+'%;top:'+(tl.y*100).toFixed(2)+'%;width:'+((br.x-tl.x)*100).toFixed(2)+'%;height:'+((br.y-tl.y)*100).toFixed(2)+'%"><span class="hillLbl">⛰ 고지</span></div>'; }
  let mineZ='';   // 💎 미네랄 덩어리(1×1) 6개 클러스터 — 채취=크레딧
  // 🏕 캠프는 **그림 스프라이트**로 그린다(2026-08-31). 3D 노드(res_cn)는 6칸이 전부 같은 모델·같은
  //   각도(face:Math.PI)라 격자무늬로 보였다 — 칸마다 다른 그림을 쓰면 그 자리에서 풀린다.
  //   ⛔ 관리자 건설 탭·오토배틀은 그대로 3D 다(mineSprite 가 캠프에서만 값을 준다).
  { const _mcw=_techCW(), _mch=_techCH(); let _mi=0; for(const m of (G.tech.minerals||[])){
    const _spr=(typeof campMineSprite==='function') ? campMineSprite(m, _mi) : '';
    // ⚠ 스프라이트는 칸보다 크다 — 결정이 칸 밖으로 자라는 것이 자연스럽다. 아래(발치)를 칸에 맞춘다.
    const _k=_spr?1.34:1.2, _dy=_spr?0.30:0;
    const _mtl=_techW2S(m.x-_k/2*_mcw, m.y-(_k/2+_dy)*_mch), _mbr=_techW2S(m.x+_k/2*_mcw, m.y+(_k/2-_dy)*_mch);
    mineZ+='<div class="bMineral'+(_res3d&&!_spr?' d3':'')+(_spr?' spr':'')+'" style="left:'+(_mtl.x*100).toFixed(2)+'%;top:'+(_mtl.y*100).toFixed(2)+'%;width:'+((_mbr.x-_mtl.x)*100).toFixed(2)+'%;height:'+((_mbr.y-_mtl.y)*100).toFixed(2)+'%">'
      +(_spr ? '<img class="mnSpr'+(((typeof campMineFlip==='function')&&campMineFlip(_mi))?' flip':'')+'" src="'+_spr+'" alt="">'
             : (_res3d?'':'<span class="mnIco">💎</span>'))+'</div>';
    _mi++; } }   // 수치 텍스트 제거 → 클릭 시 프로필에서만 잔량 표시 · 선택 표시는 3D 하단 링
  let rallyZ='';   // 🚩 랠리 포인트 — 선택된 건물의 랠리 위치 깃발 + 건물→랠리 점선(지정 모드=강조)
  { const _rb=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'):null;
    if(_rb && _rb._rally){ const _bs=_techW2S(_rb.x,_rb.y), _rs=_techW2S(_rb._rally.x,_rb._rally.y), _hot=(G.tech.rallySet===_rb.eid);
      const _len=Math.hypot((_rs.x-_bs.x)*(GW||390),(_rs.y-_bs.y)*(GH||390)), _ang=Math.atan2((_rs.y-_bs.y)*(GH||390),(_rs.x-_bs.x)*(GW||390))*180/Math.PI;
      rallyZ+='<div class="bRallyLine'+(_hot?' hot':'')+'" style="left:'+(_bs.x*100).toFixed(2)+'%;top:'+(_bs.y*100).toFixed(2)+'%;width:'+_len.toFixed(1)+'px;transform:rotate('+_ang.toFixed(1)+'deg)"></div>';
      rallyZ+='<div class="bRallyMark'+(_hot?' hot':'')+'" style="left:'+(_rs.x*100).toFixed(2)+'%;top:'+(_rs.y*100).toFixed(2)+'%"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9.5" ry="6.6" fill="none" stroke="#46f06a" stroke-width="1.3"/><circle cx="12" cy="12" r="1.7" fill="#46f06a"/></svg></div>'; } }
  let skZ='';   // 🪄 스킬 FX 오버레이 — 상태값(fx.t) 기반 인라인 스타일(프레임 재구성에도 애니메이션 안정)
  { const _skR=_btRect(), _skRW=(_skR&&_skR.width)||380;   // 픽셀 정원(컨테이너 종횡비로 타원 되는 것 방지)
    const _circ=(x,y,r,css)=>{ const c=_techW2S(x,y), a=_techW2S(x-r,y), b2=_techW2S(x+r,y), wpx=Math.max(6,(b2.x-a.x)*_skRW);
      return '<div class="tkFx" style="left:'+(c.x*100).toFixed(2)+'%;top:'+(c.y*100).toFixed(2)+'%;width:'+wpx.toFixed(1)+'px;height:'+wpx.toFixed(1)+'px;transform:translate(-50%,-50%);'+css+'"></div>'; };
    for(const fx of (G.tech.skillFx||[])){
      if(fx.type==='storm'){ const fl=0.55+0.35*Math.abs(Math.sin(fx.t*22)); skZ+=_circ(fx.x,fx.y,fx.r,'background:radial-gradient(circle,rgba(170,120,255,.55),rgba(90,40,190,.25) 60%,transparent 72%);box-shadow:inset 0 0 18px rgba(200,160,255,.8);opacity:'+fl.toFixed(2)); }
      else if(fx.type==='ensnare'){ const op=Math.min(0.8,(fx.dur-fx.t)); skZ+=_circ(fx.x,fx.y,fx.r,'background:radial-gradient(circle,rgba(120,230,120,.4),rgba(60,160,60,.18) 65%,transparent 75%);border:1px dashed rgba(140,240,140,.5);opacity:'+op.toFixed(2)); }
      else if(fx.type==='mine'){ const pu=0.6+0.4*Math.abs(Math.sin(fx.t*5)); skZ+=_circ(fx.x,fx.y,0.008,'background:#d8dfe8;border:1.5px solid #79808a;box-shadow:0 0 6px rgba(255,80,80,'+pu.toFixed(2)+')'); }
      else if(fx.type==='nuke'&&fx.t<fx.delay){ const bl=(Math.sin(fx.t*12)>0)?0.9:0.35; skZ+=_circ(fx.x,fx.y,0.028,'border:2px solid rgba(255,70,70,'+bl+');background:radial-gradient(circle,rgba(255,60,60,.22),transparent 65%)'); }
      else if(fx.type==='nuke'||fx.type==='boom'){ const bt=fx.type==='nuke'?(fx.t-fx.delay):fx.t, bd=fx.type==='nuke'?1.1:fx.dur, p=Math.max(0,Math.min(1,bt/bd)); skZ+=_circ(fx.x,fx.y,(fx.r||0.08)*(0.3+0.7*p),'background:radial-gradient(circle,rgba(255,230,150,'+(0.9*(1-p)).toFixed(2)+'),rgba(255,120,40,'+(0.55*(1-p)).toFixed(2)+') 55%,transparent 75%)'); }
      else if(fx.type==='emp'){ const p=fx.t/fx.dur; skZ+=_circ(fx.x,fx.y,fx.r*(0.25+0.75*p),'border:2px solid rgba(120,190,255,'+(0.9*(1-p)).toFixed(2)+');background:radial-gradient(circle,rgba(120,190,255,'+(0.25*(1-p)).toFixed(2)+'),transparent 70%)'); }
      else if(fx.type==='beam'){ const s=_techW2S(fx.sx,fx.sy), e2=_techW2S(fx.x,fx.y), len=Math.hypot((e2.x-s.x)*(GW||390),(e2.y-s.y)*(GH||390)), ang=Math.atan2((e2.y-s.y)*(GH||390),(e2.x-s.x)*(GW||390))*180/Math.PI, op=1-fx.t/fx.dur;
        skZ+='<div class="tkBeam" style="left:'+(s.x*100).toFixed(2)+'%;top:'+(s.y*100).toFixed(2)+'%;width:'+len.toFixed(1)+'px;transform:rotate('+ang.toFixed(1)+'deg);opacity:'+op.toFixed(2)+'"></div>'; }
      else if(fx.type==='lock'){ const t=G.tech.ents.find(x=>x.eid===fx.eid); if(t){ const p2=_techW2S(t.x,t.y), pu=0.6+0.4*Math.sin(fx.t*6);
        skZ+='<div class="tkLock" style="left:'+(p2.x*100).toFixed(2)+'%;top:'+(p2.y*100).toFixed(2)+'%;opacity:'+pu.toFixed(2)+'">'+((typeof SKILL_ICON!=='undefined'&&SKILL_ICON.lockdown)||'🔒')+'</div>'; } }
      else if(fx.type==='stim'){ const t=G.tech.ents.find(x=>x.eid===fx.eid); if(t){ skZ+=_circ(t.x,t.y,0.02*(1+fx.t*2),'border:2px solid rgba(255,120,120,'+(1-fx.t/fx.dur).toFixed(2)+')'); } }
      else if(fx.type==='halluc'){ const p=fx.t/fx.dur; skZ+=_circ(fx.x,fx.y,0.03*(1+p),'border:1.5px solid rgba(150,210,255,'+(0.8*(1-p)).toFixed(2)+');background:radial-gradient(circle,rgba(150,210,255,'+(0.25*(1-p)).toFixed(2)+'),transparent 70%)'); }   // 👥 할루시네이션 번쩍
      else if(fx.type==='maelstrom'){ const pu=0.5+0.35*Math.abs(Math.sin(fx.t*10)), fade=Math.min(1,(fx.dur-fx.t)); skZ+=_circ(fx.x,fx.y,fx.r,'background:radial-gradient(circle,rgba(170,90,255,.4),rgba(110,40,190,.2) 60%,transparent 74%);border:1.5px solid rgba(190,130,255,'+(0.7*fade).toFixed(2)+');box-shadow:inset 0 0 14px rgba(200,150,255,'+pu.toFixed(2)+');opacity:'+Math.min(1,fade+0.2).toFixed(2)); }   // 🌀 메일스트롬
      else if(fx.type==='dweb'){ const fade=Math.min(1,(fx.dur-fx.t)); skZ+=_circ(fx.x,fx.y,fx.r,'background:radial-gradient(circle,rgba(120,220,160,.18),transparent 72%);border:1.5px dashed rgba(150,240,190,'+(0.7*fade).toFixed(2)+');opacity:'+Math.min(1,fade+0.2).toFixed(2)); }   // 🕸️ 디스럽션 웹
      else if(fx.type==='stasis'){ const fade=Math.min(1,(fx.dur-fx.t)), sh=0.5+0.4*Math.abs(Math.sin(fx.t*4)); skZ+=_circ(fx.x,fx.y,fx.r,'background:radial-gradient(circle,rgba(120,200,255,.32),rgba(70,140,230,.18) 60%,transparent 74%);border:2px solid rgba(150,220,255,'+(0.8*fade*sh).toFixed(2)+');box-shadow:inset 0 0 16px rgba(180,230,255,'+(0.7*fade).toFixed(2)+');opacity:'+Math.min(1,fade+0.2).toFixed(2)); }   // 🧊 스테이시스 필드
      else if(fx.type==='warp'){ const p=fx.t/fx.dur; skZ+=_circ(fx.x,fx.y,0.05*(1-0.6*p),'border:2px solid rgba(150,210,255,'+(0.9*(1-p)).toFixed(2)+');background:radial-gradient(circle,rgba(150,210,255,'+(0.3*(1-p)).toFixed(2)+'),transparent 65%)'); }   // ↩️ 리콜 워프
      else if(fx.type==='plague'){ const fade=Math.min(1,(fx.dur-fx.t)), pu=0.5+0.35*Math.abs(Math.sin(fx.t*8)); skZ+=_circ(fx.x,fx.y,fx.r,'background:radial-gradient(circle,rgba(180,60,60,.38),rgba(120,30,30,.2) 60%,transparent 74%);border:1.5px solid rgba(220,90,90,'+(0.7*fade*pu).toFixed(2)+');opacity:'+Math.min(1,fade+0.2).toFixed(2)); }   // 🩸 플레이그 역병운
      else if(fx.type==='dswarm'){ const fade=Math.min(1,(fx.dur-fx.t)); skZ+=_circ(fx.x,fx.y,fx.r,'background:radial-gradient(circle,rgba(60,50,80,.5),rgba(30,25,45,.35) 60%,transparent 76%);border:1.5px solid rgba(120,100,160,'+(0.6*fade).toFixed(2)+');opacity:'+Math.min(1,fade+0.3).toFixed(2)); }   // ☁️ 다크 스웜 먹구름
      else if(fx.type==='scan'){ const sw=(fx.t<0.5)?(fx.t/0.5):1, fade=Math.min(1,(fx.dur-fx.t)); skZ+=_circ(fx.x,fx.y,fx.r*sw,'border:1.5px solid rgba(120,220,255,'+(0.85*fade).toFixed(2)+');background:radial-gradient(circle,rgba(150,230,255,'+(0.18*fade).toFixed(2)+'),transparent 70%)'); } }   // 📡 스캐너 스윕 원형 확산
    for(const e of G.tech.ents){ if(e.type!=='unit'&&e.type!=='worker') continue;   // 지속 상태 표시(토글·지정 힐)
      if(e._stasisT>0) skZ+=_circ(e.x,e.y,0.02,'border:2px solid rgba(150,220,255,.85);background:radial-gradient(circle,rgba(150,220,255,.2),transparent 70%)');   // 🧊 정지된 유닛
      if(e._skOn&&e._skOn.psi_cloak&&typeof SKILLS!=='undefined'&&SKILLS.psi_cloak) skZ+=_circ(e.x,e.y,SKILLS.psi_cloak.radius||0.12,'border:1px solid rgba(150,210,255,.55);background:radial-gradient(circle,rgba(150,210,255,.13),transparent 70%)');
      if(e._skOn&&e._skOn.siege) skZ+=_circ(e.x,e.y,0.024,'border:2px solid rgba(255,180,80,.7);background:radial-gradient(circle,rgba(255,180,80,.14),transparent 70%)');
      if(e._healF!=null){ const t=G.tech.ents.find(x=>x.eid===e._healF); if(t){ const p2=_techW2S(t.x,t.y); skZ+='<div class="tkHeal" style="left:'+(p2.x*100).toFixed(2)+'%;top:'+(p2.y*100).toFixed(2)+'%">'+((typeof SKILL_ICON!=='undefined'&&SKILL_ICON.heal)||'✚')+'</div>'; } } } }
  map.innerHTML='<div class="bmap'+(techWallet()?' stk':'')+(G.tech.arm?' arming':'')+(G.tech.rallySet!=null?' rally':'')+'" onpointerdown="techPtrDown(event)" style="touch-action:none">'+_floor+hillZ+creepZ+psi+gasZone+mineZ+rallyZ+skZ+oobZ+'<div class="bmapTop">'+_side+(res?'<div class="bres" onpointerdown="event.stopPropagation()">'+res+'</div>':'')+'</div>'+pcPanel+ents+foot+ghost+'<div class="bhint'+((G.tech.arm||(G.tech.selU&&G.tech.selU.length))?' on':'')+'">'+hint+'</div></div>';
  const _lblLayer=document.getElementById('cstLabels'); if(_lblLayer) _lblLayer.innerHTML=labels+armBtns+resumeBtn;   // 남은시간 라벨 + 배치 ✓/✕ + ▶재개 버튼을 전용 오버레이(z8)에 → 3D 유닛·건물 위(리파이너리 등 큰 건물에 안 가림)
  techFogDraw(); }   // 🌫️ 건설 안개 오버레이 재그림(맵 재렌더마다)
