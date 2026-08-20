/* ============================================================================
 * 17-build-cards.js — 색 확인 · 애드온 · 프로필/설명 카드 · 뷰(줌·팬) · 배치 격자 · 지형(크립·동력장)
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ══ 🎨 플레이어 색 확인 구역 ══
//   실제 게임 렌더러·조명·틴트를 그대로 쓰므로 여기 보이는 색이 곧 인게임 색이다
//   (건물 초상 렌더러에는 자동 노출이 있어 실제보다 진하게 보임 — 색 판단은 반드시 이 패널로)
const PC_NAMES=['파랑','빨강','노랑','초록','보라','주황','갈색','흰색'];
// 패널 마크업 단일 소스 — 건설 구역·메인 화면이 같은 컴포넌트를 쓴다(칩만 공용, 액션 버튼만 화면별로 주입)
function _pcPanel(pickFn, actsHTML){ const me=(G.myPlayer||1);
  const chips=PLAYER_VIEW_COLORS.map((c,i)=>'<span class="pcChip'+((i+1)===me?' on':'')+'" style="--pcc:'+c+'" onclick="'+pickFn+'(event,'+(i+1)+')" title="'+(i+1)+'P '+PC_NAMES[i]+'">'+(i+1)+'</span>').join('');
  return '<div class="pcPanel" onpointerdown="event.stopPropagation()">'
    +'<div class="pcHead">🎨 '+me+'P '+PC_NAMES[me-1]+'</div>'
    +'<div class="pcChips">'+chips+'</div>'
    +'<div class="pcActs">'+actsHTML+'</div></div>'; }
function _techPCPanel(){ return _pcPanel('techPCPick',
  '<span class="pcAct" onclick="techPCFill(event)">전 건물 배치</span>'
  +'<span class="pcAct" onclick="techPCUnits(event)">전 유닛 배치</span>'); }
function techPCheck(ev){ if(ev) ev.stopPropagation(); G.tech.pcheck=!G.tech.pcheck; techMapRender(); }
function techPCPick(ev,n){ if(ev) ev.stopPropagation(); G.myPlayer=n; techMapRender(); }   // 루프가 매 프레임 setPlayerRim(내 플레이어색) → 전 모델 즉시 재틴트
// 현재 종족의 모든 건물을 격자로 한 번에 배치(색 비교용)
function techPCFill(ev){ if(ev) ev.stopPropagation(); const race=G.tech.race, list=TECH_TREE[race].buildings;
  G.tech.ents=(G.tech.ents||[]).filter(e=>e.type!=='bldg');
  const cols=5, x0=0.16, y0=0.30, dx=0.17, dy=0.15;
  list.forEach((b,i)=>{ G.tech.ents.push({eid:G.tech.eseq++, type:'bldg', bk:b.k,
    x:x0+(i%cols)*dx, y:y0+Math.floor(i/cols)*dy, done:1, hp:1000, maxHp:1000}); });
  if(window.M3D&&M3D.cstEnsure) M3D.cstEnsure(list.map(b=>b.k), ()=>techMapRender());
  techMapRender(); toast(race+' 건물 '+list.length+'개 배치'); }
// 현재 종족의 모든 생산 유닛을 격자로 배치 — 목록은 3D 모델 로딩과 같은 소스(_techRaceUnitKeys)를 쓴다
function techPCUnits(ev){ if(ev) ev.stopPropagation(); const race=G.tech.race;
  const ids=(typeof _techRaceUnitKeys==='function')?_techRaceUnitKeys(race):[];   // 모델 없는 키(핵 등)는 syncBuild가 알아서 건너뜀
  G.tech.ents=(G.tech.ents||[]).filter(e=>e.type!=='unit');
  const cols=6, x0=0.14, y0=0.34, dx=0.145, dy=0.12;
  ids.forEach((uid,i)=>{ G.tech.ents.push({eid:G.tech.eseq++, type:'unit', uid:uid,
    x:x0+(i%cols)*dx, y:y0+Math.floor(i/cols)*dy}); });
  if(window.M3D&&M3D.ensureUnits) M3D.ensureUnits(ids, ()=>techMapRender());
  techMapRender(); toast(race+' 유닛 '+ids.length+'종 배치'); }

// ══ 🎨 메인 화면 색 확인 뷰 ══
//   건설 구역과 같은 패널 컴포넌트(_pcPanel)를 쓰고, 액션만 메인용으로 교체.
//   메인은 유닛이 원래 크기로 렌더되므로 화면 줌(G.view.zoom)으로 키워서 액센트를 눈으로 확인할 수 있다.
const PC_ZOOMS=[1,1.8,2.6,3.6];
const PC_RACE_KR={union:'유니온', swarm:'스웜', aetherial:'에테리얼'};
function pcMainPanel(){ const z=G.pcScale||1;
  return _pcPanel('pcMainPick',
    '<span class="pcAct" onclick="pcMainUnits(event)">전 유닛 배치</span>'
    +'<span class="pcAct" onclick="pcMainRace(event)">'+(PC_RACE_KR[G.pcRace||'union'])+'</span>'
    +'<span class="pcAct" onclick="pcMainZoom(event)">크기 ×'+z.toFixed(1)+'</span>'); }
function pcMainSync(){ let el=document.getElementById('pcMain');
  if(!G.pcheck){ if(el) el.remove(); return; }
  if(!el){ el=document.createElement('div'); el.id='pcMain'; document.getElementById('gameArea').appendChild(el); }
  el.innerHTML=pcMainPanel(); }
// 🎨 색 확인은 관리자 샌드박스 메인에서만 — 네모네모 실게임에선 G.units가 실제 게임 유닛이라 건드리면 안 됨
function updatePcFab(){ const b=document.getElementById('pcFab'); if(!b) return;
  const show=!!(G.sandbox && G.tab==='Main' && !G.strike);
  b.classList.toggle('hide', !show);
  if(!show && G.pcheck){ G.pcheck=false; G.pcScale=1; pcMainSync(); }   // 다른 탭·게임으로 나가면 자동 종료
}
function pcMainToggle(ev){ if(ev) ev.stopPropagation(); if(!G.sandbox) return; G.pcheck=!G.pcheck; if(!G.pcheck) G.pcScale=1; pcMainSync(); }
function pcMainPick(ev,n){ if(ev) ev.stopPropagation(); G.myPlayer=n; pcMainSync(); }
function pcMainRace(ev){ if(ev) ev.stopPropagation();
  const R=['union','swarm','aetherial']; G.pcRace=R[(R.indexOf(G.pcRace||'union')+1)%R.length];
  pcMainUnits(); }
function pcMainZoom(ev){ if(ev) ev.stopPropagation();
  const i=PC_ZOOMS.indexOf(+((G.pcScale||1).toFixed(1)));
  G.pcScale=PC_ZOOMS[(i<0?0:i+1)%PC_ZOOMS.length]; pcMainSync(); }
// 확인 종족의 "전" 유닛 목록 — 건설 테크트리(_techRaceUnitKeys)만으로는 가챠·전투 유닛이 빠지므로
//   종족표(RACE_OF) 전체를 합친다. NPC와 모델을 공유하는 유닛(레이스·드랍쉽 등)도 포함 —
//   applyPlayerTintInst가 내 인스턴스만 따로 틴트하므로 색이 정상 전환된다.
const PC_NOT_UNIT=new Set(['turret','photon','citizen','nuke','swarm_egg']);   // 방어탑·셀렉터 시민·핵·알은 유닛 아님
function _pcRaceUnits(race){ const set=new Set();
  if(typeof RACE_OF!=='undefined') for(const k in RACE_OF){ if(RACE_OF[k]===race) set.add(k); }
  ((typeof _techRaceUnitKeys==='function')?_techRaceUnitKeys(race):[]).forEach(k=>set.add(k));
  return [...set].filter(k=>k && !PC_NOT_UNIT.has(k));
}
// 현재 확인 종족의 전 유닛을 메인 맵에 격자 배치(전투 방해 없도록 정지 상태)
function pcMainUnits(ev){ if(ev) ev.stopPropagation(); if(!G.sandbox) return; const race=G.pcRace||'union';
  const want=_pcRaceUnits(race).filter(k=>U[k]);   // U 스펙 없는 키(swarm_larva 등)는 배치 제외 — 게임 루프(충돌·스탯)가 U를 참조
  const place=()=>{ const ids=want.filter(k=>window.M3D&&M3D.hasModel&&M3D.hasModel(k));
    G.units.length=0;
    const cols=5, x0=0.14, y0=0.28, dx=0.18, dy=0.13;
    ids.forEach((id,i)=>G.units.push({uid:'pc_'+id, id:id, gmodel:id,
      x:x0+(i%cols)*dx, y:y0+Math.floor(i/cols)*dy, hp:100, maxHp:100, lv:1}));
    pcMainSync(); toast(PC_RACE_KR[race]+' 유닛 '+ids.length+'/'+want.length+'종 배치'); };
  if(window.M3D&&M3D.ensureUnits) M3D.ensureUnits(want, place); else place(); }
function techBldgInfoModel(b, e){ const race=G.tech.race, hb=TECH_TREE[race].buildings[0], bs=techBldgSpec(race,b.k)||{};
  if(b.k==='gspire'){   // 🦅 그레이터 스파이어 = 해금은 유지하되 카드·해금유닛 스탯 없이 간단 설명
    return { mode:'prod', title:b.name, icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs.hp,bs.sh), sub:'', items:_techWithAddons([], b.k),
      info:{ eb:'해금', hideName:true, desc:'와이번 → 베놈 또는 베히모스로 진화 가능. 파괴 시 잠김.', cr:0, en:0 } }; }
  const items=(b.unlocks||[]).map(uid=>{ const p=(hb.produces||[]).find(x=>x.id===uid)||{}; return { pro:_techUnitPortrait(uid), sn:p.name||uid, cr:p.m||0, en:p.g||0, meta:p.pop?'👤'+p.pop:'', state:'ok', act:'' }; });
  const _evc=_techEvolveCards(b, e); if(_evc.length){ while(items.length<3) items.push(null); items[3]=_evc[0]; }   // 🧬 진화 카드 = 4번 슬롯(스파이어→그레이터 스파이어)
  const _items=_techWithAddons(items, b.k);
  return { mode:'prod', title:b.name, icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs.hp,bs.sh), sub:'이 건물이 해금 · 생산은 '+hb.name+'에서', items:_items,
    info:{ eb:'해금', name:b.name, hideName:true, desc:'테크 건물 — 생산은 '+hb.name+'에서. 철거 시 해당 유닛 재잠금.', stats:[['해금 유닛',(b.unlocks||[]).length+'종']], cr:0, en:0 } }; }
// 🔗 부속(애드온) 연결 판정 — 본체 오른쪽·하단 도크에 부속이 접지·인접해 붙어있으면 '연결'
function _techAddonAdjacent(p, ad){ const pf=_techEntFoot(p), af=_techEntFoot(ad); return af.c0===pf.c0+pf.w && (af.r0+af.h)===(pf.r0+pf.h); }   // 도크 위치(우측 붙임 + 하단 정렬)
function _techAddonConnected(p){ if(!p||p._lifted||p._addonEid==null) return false; const ad=G.tech.ents.find(x=>x.eid===p._addonEid&&x.type==='bldg'); return !!(ad && !ad._lifted && _techAddonAdjacent(p,ad)); }   // 이 본체에 부속이 붙어있는가(건설 중 포함)
// 🔗 부속(애드온) 카드 — 그 본체(bk)에 붙는 부속 건물들. 이 본체에 연결된 부속이 있으면 모든 부속 카드 잠금(본체당 1개)
function _techAddonCards(bk){ const race=G.tech.race, t=TECH_TREE[race], out=[];
  const e=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'&&x.bk===bk):null;   // 현재 선택된 본체
  const connected=_techAddonConnected(e), myAd=connected?G.tech.ents.find(x=>x.eid===e._addonEid&&x.type==='bldg'):null;
  for(const x of t.buildings){ if(x.addonTo!==bk) continue;
    const isMine=!!(myAd && myAd.bk===x.k), reqok=_techReqMet(x.req), afford=_techAfford(x.m,x.g);
    out.push({ _addon:true, pro:_techBldgPortrait(x.k, x.ico), sn:x.name, cr:x.m, en:x.g,   // 초상=건물 3D 렌더 · 이름=괄호 표기 없이(원격 정리 반영)
      meta:isMine?'✓ 연결':(connected?pIco('🔒','sm'):'＋부속'), metaCls:isMine?'lv':'',
      state:(isMine||connected)?'max':((!reqok||!afford)?'dim':'ok'),   // 연결됨 = 이 카드+다른 부속 카드 모두 잠금
      act:((!connected&&reqok&&afford)?('onclick="techBuildAddon(event,\''+x.k+'\')"'):'')+_techTipAttr('b',x.k) }); }   // 길게 = 부속 건물 설명(잠금 상태여도 설명은 보임)
  return out; }
// 🎮 오토배틀 전용 — 이 건물이 웨이브마다 내보내는 유닛을 '누를 수 없는 정보 카드'로 1번 칸에 보여준다.
//   생산 버튼이 없어 빈 그리드로 보이던 것을 메꾼다(건물 = 병력 공급원이라는 규칙을 프로필에서 바로 읽히게).
function _techSpawnCard(bk){ if(!techWallet() || typeof techBldgUnit!=='function') return null;
  const race=G.tech.race, uid=techBldgUnit(race,bk); if(!uid) return null;
  return { pro:_techUnitPortrait(uid), sn:_techRealName(race,uid), tr:'×'+techBldgCount(race,bk), metaCls:'lv', state:'dim', act:'' }; }   // tr = 건설 카드에서도 보이는 우상단 배지(meta는 build:true에서 숨겨짐)
function _techWithAddons(items, bk){ const sc=_techSpawnCard(bk), base=sc?[sc].concat(items):items;   // 배출 카드=1번 칸
  const addons=_techAddonCards(bk); if(!addons.length) return base; return base.concat(addons); }   // 부속 카드(_addon)는 renderCmdGrid가 항상 그리드 맨 끝 슬롯에 고정 배치
function techBuildAddon(ev, k){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;
  const race=G.tech.race, b=techGetBldg(race,k); if(!b||!b.addonTo) return;
  const selB=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'&&x.bk===b.addonTo):null;
  if(selB && _techAddonConnected(selB)){ if(typeof toast==='function') toast('⛔ 이미 부속 연결됨'); return; }   // 이 본체에 이미 부속 연결 → 불가
  if(!(G.tech.built[b.addonTo]>0)||!_techReqMet(b.req)){ if(typeof toast==='function') toast('⛔ 본체·선행 필요'); return; }
  if(_techFailRes(b.m,b.g)) return;
  techDockAddon(b, G.tech.sel); }   // 선택된 본체 우선
// 생산·연구·해금이 없는 건물(리파이너리·서플라이 디팟 등)의 프로필 — 체력·에너지 매장량 등 정보
function techBldgPlainModel(b, e){ const race=G.tech.race, bs=techBldgSpec(race,b.k)||{}, stats=[];
  const _amk=(TECH_AMMO[b.k]&&!TECH_AMMO[b.k].unit)?b.k:null;   // ☢️ 뉴클리어 사일로 = 단일 장전(최대 1)
  if(_amk){ const a=TECH_AMMO[_amk], cap=_techAmmoCap(_amk), have=(e?((e._chc||0)+((e._chq||[]).length)):0);
    const aitems=[{ pro:pIco(a.ico), sn:a.label+' 장전', cr:a.m, en:a.g, meta:have+'/'+cap, metaCls:'lv', state:(have>=cap||!_techAfford(a.m,a.g))?'dim':'ok', act:'onclick="techChargeAmmo(event,\''+_amk+'\')"' }];
    return { mode:'info', title:b.name, icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs.hp,bs.sh), sub:'☢️ 단일 장전(최대 1)', items:aitems, info:_techAmmoInfo(e||{}, _amk) }; }
  // ⚡ 에너지 잔량은 **왼쪽 정보 구역**이다 — 머리줄은 제목 + HP/실드 한 줄까지가 한계다(넘치면 그리드가 낮아진다).
  if(b.gas) stats.push(['에너지 잔량', G.tech.inf?'∞':(_techGasRemain()+' / '+TECH_GAS_START)]);
  const _evc=_techEvolveCards(b, e); let _pit=[];   // 🧬 진화 카드 = 3·4번 슬롯(크립 콜로니→성큰/스포어)
  if(_evc.length){ _pit=[null,null]; for(let i=0;i<_evc.length;i++) _pit[2+i]=_evc[i]; }
  const items=_techWithAddons(_pit, b.k);   // 🔗 부속 카드 + 진화 카드
  if(e && typeof BLDG_SKILLS!=='undefined' && BLDG_SKILLS[b.k]){ for(const _k of BLDG_SKILLS[b.k]){ const sk=SKILLS[_k]; if(!sk) continue;   // 🏢 건물 스킬 카드(컴셋 스캐너·쉴드배터리 충전)
    const armed=!!(G.tech.skillArm&&G.tech.skillArm.eid===e.eid&&G.tech.skillArm.key===_k), cost=_skCost(sk), lowE=cost>0&&(_techSkEn(e)<cost);   // 쿨다운 없음(SC식) — 마나만
    items.push({ pro:skillIcoHTML(_k, '<span class="skPro">'+((typeof SKILL_ICON!=='undefined'&&SKILL_ICON[_k])||pIco('✨'))+'</span>'), sn:sk.name, meta:'', metaCls:'lv', sel:armed, state:lowE?'dim':'ok', bottom:'<div class="cgCost">'+_skCostHTML(sk)+'</div>', act:'onclick="techCastBldgSkill(event,\''+_k+'\')"' }); } }
  const _def=_techIsDef(b.k);
  const _bMx=(typeof BLDG_EN!=='undefined'&&BLDG_EN[b.k])||0;   // 🏢 건물 마나(컴셋·쉴드배터리) = 실시간 현재/최대(선택 당시 고정 아님)
  const _bEn=(_bMx>0)?((e&&e.en!=null)?(Math.round(e.en)+'/'+Math.round(e.maxEn||_bMx)):(_bMx+'/'+_bMx)):0;
  if(_bMx>0) stats.push(['마나', _bEn]);   // 🔮 마나도 왼쪽 정보 구역(유닛 프로필과 같은 규약)
  return { mode:'info', title:b.name, icon:_techBldgPortrait(b.k, b.ico), hpsh:_cgHpShStr(bs.hp,bs.sh), sub:(b.gas?'⛽ 에너지 채취 건물':(b.supply?'👤 인구 공급':(_def?'🛡 방어 건물':'건물 정보'))), items, topRight:_techBldgTR(b),
    info:{ eb:(_techSpawnCard(b.k)?'':_techBldgKind(b)+(b.detector?' (탐지)':'')), name:b.name, hideName:true, desc:_techBldgSummary(b), stats, cr:0, en:0 } }; }   // 프로필은 요약 한 줄(팝업은 섹션 포함 _techBldgDesc) · 오토배틀 배출 건물은 라벨 없이 배출 정보만
// 💎⛽ 중립 자원(미네랄·가스 광산) 프로필 — 이름 + 하단 HP 자리에 잔량 표시
function techResourceModel(res){ if(!res) return null;
  if(res.kind==='mineral'){ const m=(G.tech.minerals||[]).find(x=>x.eid===res.eid); if(!m) return null;
    const rem=m.amount, tot=TECH_MINE_START, pct=Math.max(0,Math.round(rem/tot*100));   // 이름 아래 HP 자리 = 메인 c 표기 + (남은 %)
    const hp=G.tech.inf?'<span class="hpv" style="color:#8fd8ff">∞ c</span>':'<span class="hpv" style="color:#8fd8ff">'+rem+' / '+tot+' c <em style="opacity:.75">('+pct+'%)</em></span>';
    return { mode:'info', title:'크레딧 덩어리', icon:pIco('💎'), hpsh:hp, sub:'중립 자원 — 크레딧', items:[],
      info:{ eb:'중립 자원', name:'크레딧 덩어리', hideName:true, desc:'일꾼으로 채취하면 크레딧을 얻습니다.', cr:0, en:0 } };
  }
  const rem=_techGasRemain(), tot=TECH_GAS_START, pct=Math.max(0,Math.round(rem/tot*100));
  const hp=G.tech.inf?'<span class="hpv" style="color:#7ee081">∞ e</span>':'<span class="hpv" style="color:#7ee081">'+rem+' / '+tot+' e <em style="opacity:.75">('+pct+'%)</em></span>';
  return { mode:'info', title:'에너지 광산', icon:pIco('💨'), hpsh:hp, sub:'중립 지형 — 에너지', items:[],
    info:{ eb:'중립 자원', name:'에너지 광산', hideName:true, desc:'에너지 건물 건설 후 채취 = 에너지.', cr:0, en:0 } };
}
// 🪄 건설 탭 유닛 스킬 어댑터 — 정의는 메인 SKILLS/SKILL_ICON/UNIT_SKILLS 단일 소스 그대로, 시전·FX만 tech 엔티티용(적 없음 = 효과는 이동·상태·연출)
function _techSkEn(u){ if(u.en==null){ const _m=(u.type==='bldg')?((typeof BLDG_EN!=='undefined'&&BLDG_EN[u.bk])||0):(u.maxEn!=null?u.maxEn:((typeof U!=='undefined'&&U[u.uid]&&U[u.uid].energy)||0)); u.en=Math.min(50,_m); } return u.en; }   // 🔮 마나 = 바에 표시되는 en과 단일화(유닛·건물)
function techCastBldgSkill(ev,key){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||G.tech.sel==null) return;   // 🏢 건물 스킬 시전(선택 건물)
  const b=G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'); const sk=(typeof SKILLS!=='undefined')&&SKILLS[key]; if(!b||!sk) return;
  const cost=_skCost(sk); if(cost>0 && _techSkEn(b)<cost){ if(typeof toast==='function') toast('에너지 부족 ('+cost+'e)'); return; }   // 쿨다운 없음(SC식) — 마나만 게이트
  G.tech.skillArm={eid:b.eid, key:key}; if(typeof toast==='function') toast(sk.arm||'ℹ️ 대상을 탭하세요'); techUIRender(); }
function _techSkFx(){ return G.tech.skillFx||(G.tech.skillFx=[]); }
function techCastSkill(ev,key){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||!(G.tech.selU||[]).length) return;
  const sk=(typeof SKILLS!=='undefined')&&SKILLS[key]; if(!sk) return;
  if(_skillLocked(G.tech.race,key)){ if(typeof toast==='function') toast('🔒 연구 필요: '+_techBldgOfResearch(G.tech.race,SKILL_RESEARCH[key])); return; }   // 🔒 스펠 언락 게이트(권위) — 카드 dim은 표시용, 실제 차단은 여기
  // 👥 활성셋(SC식): 지정 중 이 스킬 보유 유닛 전부(동일종류=전체 · 혼합 공통 시전=보유 종류 전부)
  const _ents=G.tech.selU.map(id=>G.tech.ents.find(e=>e.eid===id)).filter(Boolean);
  const _owns=e=>(e.type==='unit')&&(((typeof UNIT_SKILLS!=='undefined'&&UNIT_SKILLS[e.uid])||[]).indexOf(key)>=0);
  const set=G.tech.selType?_ents.filter(e=>(((e.type==='worker')?'__wk':e.uid)===G.tech.selType)&&_owns(e)):_ents.filter(_owns);   // 활성셋 = selType 소프트선택 시 그 종류만 · 아니면 지정 중 이 스킬 보유자 전부
  if(!set.length) return;
  const _c=_skCost(sk);
  if(sk.kind==='self'){ let did=0;   // ⚡ 즉시 자버프(스팀팩 등) = 활성셋 전체 발동(SC식: 쿨다운 없음 — 마나/체력만 게이트, 사용 직후 바로 재사용 가능)
    for(const u of set){
      if(_c>0&&_techSkEn(u)<_c) continue;
      if(sk.hpCost>0){ const _mh=(u.maxHp!=null?u.maxHp:((techUnitSpec(G.tech.race,u.uid)||{}).hp||0)), _hp=(u.hp!=null?u.hp:_mh); if(_mh>0&&u.maxHp==null) u.maxHp=_mh; if(_hp<=sk.hpCost) continue; u.hp=Math.max(1,_hp-sk.hpCost); }   // 🩸 스팀팩 = 체력 소모(SC 10 HP)
      if(_c>0) u.en=Math.max(0,(u.en||0)-_c);
      u._skStim=sk.dur||6; _techSkFx().push({type:'stim',eid:u.eid,t:0,dur:0.5}); did++; }
    if(!did){ if(typeof toast==='function'){ const u0=set[0];   // 전원 불발 = 사유 안내(마나/체력 부족만 · 쿨다운 없음)
      toast((_c>0&&_techSkEn(u0)<_c)?('에너지 부족 ('+_c+'e)'):('⛔ 체력 부족 (스팀팩 '+(sk.hpCost||0)+' HP)')); } return; }
    if(typeof playSfx==='function') playSfx('skill'); techUIRender(); return; }
  if(sk.kind==='toggle'||sk.kind==='aura'){ const nv=!(set[0]._skOn&&set[0]._skOn[key]);   // 시즈/은폐 토글 = 그룹 일관(전원 같은 새 상태로)
    for(const u of set){ u._skOn=u._skOn||{}; u._skOn[key]=nv; if(nv&&sk.kind==='toggle'){ u.tx=null; u.ty=null; u._wp=null; } }   // 시즈 = 그 자리 고정
    if(typeof playSfx==='function') playSfx('skill'); techUIRender(); return; }
  // 🎯 지정형(지점/유닛/대상) = 마나 충족하는 1기만 시전(SC식: 쿨다운 없음) — 무장 후 맵 탭
  const caster=set.find(u=>(_c<=0||_techSkEn(u)>=_c));
  if(!caster){ if(typeof toast==='function') toast('에너지 부족 ('+_c+'e)'); return; }
  G.tech.skillArm={eid:caster.eid, key:key};
  if(typeof toast==='function') toast(sk.arm||'ℹ️ 대상을 탭하세요'); techUIRender(); }
function _techSkFire(u,key,wx,wy,tgt){ const sk=SKILLS[key];
  { const _c=_skCost(sk); if(_c>0){ if(_techSkEn(u)<_c) return; u.en=Math.max(0,(u.en||0)-_c); } }   // 🔮 마나 소모(바에 반영) — 관리자=SC값(enSc) · 쿨다운 없음(SC식)
  const F=_techSkFx();
  if(key==='psi_storm') F.push({type:'storm', x:wx, y:wy, t:0, dur:sk.dur||3, r:sk.radius});
  else if(key==='ensnare') F.push({type:'ensnare', x:wx, y:wy, t:0, dur:sk.dur||8, r:sk.radius, slow:sk.slow});
  else if(key==='spider_mine') F.push({type:'mine', x:wx, y:wy, t:0, dur:1e9, trig:sk.trig||0.045, r:sk.r||0.06, owner:u.eid});
  else if(key==='nuke') F.push({type:'nuke', x:wx, y:wy, t:0, dur:(sk.delay||3.5)+1.1, delay:sk.delay||3.5, r:sk.radius||0.15});
  else if(key==='emp') F.push({type:'emp', x:wx, y:wy, t:0, dur:0.7, r:sk.radius||0.13});
  else if(key==='lockdown'&&tgt){ tgt._lockT=sk.dur||6; tgt.tx=null; tgt._wp=null; F.push({type:'lock', eid:tgt.eid, t:0, dur:sk.dur||6}); }
  else if(key==='yamato'&&tgt) F.push({type:'beam', sx:u.x, sy:u.y-0.015, x:tgt.x, y:tgt.y, t:0, dur:0.55});
  else if(key==='heal'&&tgt){ u._healF=(u._healF===tgt.eid)?null:tgt.eid; }   // 재시전 = 지정 해제(자동 복귀)
  // ── 🔮 에테리얼 마법 ──
  else if(key==='hallucination'&&tgt){ const n=sk.count||2; for(let i=0;i<n;i++){ const off=(i?1:-1)*0.02;   // 👥 환영 복제 n기(반투명·일정시간 후 소멸)
      G.tech.ents.push({eid:G.tech.eseq++, type:'unit', uid:tgt.uid, x:Math.max(techBX0(),Math.min(techBX1(),tgt.x+off)), y:Math.max(techBY0(),Math.min(techBY1(),tgt.y+0.012)), _illusion:true, _illT:20}); }
      F.push({type:'halluc', x:tgt.x, y:tgt.y, t:0, dur:0.8}); }
  else if(key==='feedback'&&tgt){ const burn=Math.round(tgt.en||0); tgt.en=0;   // 💥 마나 소각 + 소각량만큼 HP 피해
      const mh=(tgt.maxHp!=null?tgt.maxHp:((techUnitSpec(G.tech.race,tgt.uid)||{}).hp||0)); if(tgt.maxHp==null&&mh>0) tgt.maxHp=mh; if(burn>0&&mh>0) tgt.hp=Math.max(1,(tgt.hp!=null?tgt.hp:mh)-burn);
      F.push({type:'boom', x:tgt.x, y:tgt.y, t:0, dur:0.5, r:0.04}); }
  else if(key==='maelstrom'){ const r=sk.radius||0.1, d=sk.dur||6; for(const x of G.tech.ents){ if((x.type==='unit'||x.type==='worker')&&x.eid!==u.eid&&Math.hypot(x.x-wx,x.y-wy)<=r){ x._lockT=Math.max(x._lockT||0,d); x.tx=null; x._wp=null; } } F.push({type:'maelstrom', x:wx, y:wy, t:0, dur:d, r:r}); }   // 🌀 범위 마비
  else if(key==='mind_control'&&tgt){ u.sh=0; tgt._mcT=1.2; F.push({type:'beam', sx:u.x, sy:u.y-0.015, x:tgt.x, y:tgt.y, t:0, dur:0.6}); F.push({type:'halluc', x:tgt.x, y:tgt.y, t:0, dur:0.9}); }   // 🧠 장악(자신 쉴드 0 페널티)
  else if(key==='disruption_web') F.push({type:'dweb', x:wx, y:wy, t:0, dur:sk.dur||8, r:sk.radius||0.11});   // 🕸️ 지상 결계 구역
  else if(key==='stasis'){ const r=sk.radius||0.1, d=sk.dur||6; for(const x of G.tech.ents){ if((x.type==='unit'||x.type==='worker')&&Math.hypot(x.x-wx,x.y-wy)<=r){ x._lockT=Math.max(x._lockT||0,d); x._stasisT=d; x.tx=null; x._wp=null; } } F.push({type:'stasis', x:wx, y:wy, t:0, dur:d, r:r}); }   // 🧊 범위 정지+무적
  else if(key==='recall'){ const r=sk.radius||0.18; let n=0; for(const x of G.tech.ents){ if((x.type==='unit'||x.type==='worker')&&x.eid!==u.eid&&Math.hypot(x.x-wx,x.y-wy)<=r){   // ↩️ 근처 아군 → 시전자 위치로 순간이동
        const off=(n%2?1:-1)*0.02*(1+Math.floor(n/2)); x.x=Math.max(techBX0(),Math.min(techBX1(),u.x+off)); x.y=Math.max(techBY0(),Math.min(techBY1(),u.y+0.03+0.012*Math.floor(n/2))); x.tx=null; x._wp=null; n++; } } F.push({type:'warp', x:wx, y:wy, t:0, dur:0.6}); F.push({type:'warp', x:u.x, y:u.y, t:0, dur:0.6}); }
  // ── 🦎 스웜 마법 ──
  else if(key==='parasite'&&tgt){ tgt._parasited=1; F.push({type:'boom', x:tgt.x, y:tgt.y, t:0, dur:0.4, r:0.025}); }   // 🦠 기생(시야 공유)
  else if(key==='dark_swarm'){ const r=sk.radius||0.13; for(const x of G.tech.ents){ if((x.type==='unit'||x.type==='worker')&&Math.hypot(x.x-wx,x.y-wy)<=r) x._darkSwarm=sk.dur||8; } F.push({type:'dswarm', x:wx, y:wy, t:0, dur:sk.dur||8, r:r}); }   // ☁️ 범위 보호(원거리 피해 무효)
  else if(key==='plague') F.push({type:'plague', x:wx, y:wy, t:0, dur:sk.dur||6, r:sk.radius||0.11, dps:sk.dps||18});   // 🩸 범위 HP 지속 감소(1까지)
  else if(key==='consume'&&tgt){ if(u.maxEn>0) u.en=Math.min(u.maxEn,(u.en||0)+(sk.gain||50)); const _fx={x:tgt.x,y:tgt.y}; G.tech.ents=G.tech.ents.filter(e=>e.eid!==tgt.eid); if(G.tech.selU) G.tech.selU=G.tech.selU.filter(id=>id!==tgt.eid); F.push({type:'boom', x:_fx.x, y:_fx.y, t:0, dur:0.4, r:0.025}); }   // 🍽 아군 잡아먹기 → 마나 +gain
  // ── 🛡 유니온 마법 ──
  else if(key==='irradiate'&&tgt){ tgt._irradT=sk.dur||8; tgt._irradDps=sk.dps||30; F.push({type:'boom', x:tgt.x, y:tgt.y, t:0, dur:0.4, r:0.03}); }   // ☢ 방사능 지속 피해
  else if(key==='optical_flare'&&tgt){ tgt._blind=sk.dur||20; F.push({type:'boom', x:tgt.x, y:tgt.y, t:0, dur:0.4, r:0.025}); }   // 👁 실명
  else if(key==='defensive_matrix'&&tgt){ tgt._matrix=(tgt._matrix||0)+(sk.absorb||250); F.push({type:'warp', x:tgt.x, y:tgt.y, t:0, dur:0.5}); }   // 🛡 흡수 보호막
  else if(key==='restoration'&&tgt){ tgt._lockT=0; tgt._skSlow=0; tgt._irradT=0; tgt._blind=0; tgt._parasited=0; tgt._stasisT=0; tgt._darkSwarm=0; F.push({type:'warp', x:tgt.x, y:tgt.y, t:0, dur:0.4}); }   // ✳ 디버프 해제
  // ── 🏢 건물 스킬 ──
  else if(key==='scan'){ (G.tech._scans=G.tech._scans||[]).push({x:wx, y:wy, r:sk.radius||0.15, t:sk.dur||5}); if(G.tech.fog&&G.tech.fog.on){ techFogCompute(); techFogDraw(); } F.push({type:'scan', x:wx, y:wy, t:0, dur:sk.dur||5, r:sk.radius||0.15}); }   // 📡 스캐너: 지점 시야(일시)
  else if(key==='recharge'&&tgt){ const mxSh=(tgt.maxSh!=null?tgt.maxSh:0); if(mxSh>0){ const need=mxSh-(tgt.sh!=null?tgt.sh:mxSh), avail=(u.en||0)*(sk.rate||2), give=Math.max(0,Math.min(need,avail)); tgt.sh=(tgt.sh!=null?tgt.sh:mxSh)+give; u.en=Math.max(0,(u.en||0)-Math.ceil(give/(sk.rate||2))); } F.push({type:'warp', x:tgt.x, y:tgt.y, t:0, dur:0.5}); }   // 🔋 쉴드 충전(마나1→쉴드2)
  if(typeof playSfx==='function') playSfx('skill'); }
function _techSkillTick(dt){ if(!G.tech) return false; const F=G.tech.skillFx; let live=false, _illGone=false;
  for(const e of G.tech.ents){ if(e.type!=='unit'&&e.type!=='worker') continue;
    if(e._skCd) for(const k in e._skCd){ if(e._skCd[k]>0){ e._skCd[k]=Math.max(0,e._skCd[k]-dt); live=true; } }
    if(e._skStim>0){ e._skStim-=dt; live=true; }
    if(e._illusion){ e._illT=(e._illT||0)-dt; live=true; if(e._illT<=0){ e._dead=true; _illGone=true; } }   // 👥 환영 수명
    if(e._stasisT>0){ e._stasisT-=dt; e.tx=null; e._wp=null; live=true; }   // 🧊 스테이시스(정지+무적)
    if(e._darkSwarm>0){ e._darkSwarm-=dt; }   // ☁️ 다크스웜 보호(존 밖=만료)
    if(e._blind>0){ e._blind-=dt; live=true; }   // 👁 옵티컬 플레어 실명
    if(e._irradT>0){ e._irradT-=dt; live=true; if(e.hp>1) e.hp=Math.max(1, e.hp-(e._irradDps||30)*dt); if(e._irradT<=0) e._irradDps=0; }   // ☢ 이레디에이트 지속 피해(1까지)
    if(e._mcT>0){ e._mcT-=dt; live=true; }   // 🧠 장악 연출
    if(e._lockT>0){ e._lockT-=dt; e.tx=null; e._wp=null; live=true; }
    if(e._skOn&&e._skOn.siege){ e.tx=null; e._wp=null; }   // 시즈 중 = 이동 불가 유지
    e._skSpdMul=((e._skStim>0)?1.4:1)*((e._skSlow>0)?0.5:1); if(e._skSlow>0) e._skSlow-=dt;
    if(HEALER[e.uid]){ let t=null;   // 💉 메딕: 지정 힐(따라다니며 1명) or 자동(근처 부상 바이오닉 최근접) — SC 메딕(마나1→체력2, 사거리 0.9칸)
      if(e._healF!=null){ t=G.tech.ents.find(x=>x.eid===e._healF); if(!t) e._healF=null; }   // 지정 힐 우선
      if(!t){ let best=null, bd=(HEAL_RANGE*3)*(HEAL_RANGE*3);   // 자동: 사거리×3 이내 부상 바이오닉 중 최근접(스팀팩으로 깎인 레인저 등)
        for(const a of G.tech.ents){ if(a===e||(a.type!=='unit'&&a.type!=='worker')||!BIONIC[a.uid]) continue;
          if(!a.maxHp||(a.hp!=null?a.hp:a.maxHp)>=a.maxHp) continue;
          const dx=a.x-e.x, dy=a.y-e.y, dd=dx*dx+dy*dy; if(dd<=bd){ bd=dd; best=a; } }
        t=best; }
      if(t){ const dx=t.x-e.x, dy=t.y-e.y, d=Math.hypot(dx,dy)||1e-4;
        if(d>HEAL_RANGE*0.85){ e.tx=t.x-(dx/d)*HEAL_RANGE*0.55; e.ty=t.y-(dy/d)*HEAL_RANGE*0.55; }   // 사거리 밖 → 접근(힐하러 이동)
        else { e.tx=null; e.ty=null; e._wp=null; }   // 도착 → 정지
        if(d<=HEAL_RANGE){   // 사거리 내 → 치유 · 💉 마나 히스테리시스: 0 소진 → 휴식(재충전 중 힐 안 함) → 풀충전되면 다시 힐(0에서 트리클 힐 방지)
          if(e.maxEn>0){
            if(e._healRest && e.en>=e.maxEn) e._healRest=false;   // 다 차면 재개
            if(!e._healRest){ _healApply(e,t,dt); if((e.en||0)<=0) e._healRest=true; } }   // 힐(마나 차감) · 이번에 0 소진 → 휴식 진입
          else _healApply(e,t,dt); }
        live=true; } } }
  if(_illGone){ for(let i=G.tech.ents.length-1;i>=0;i--){ const x=G.tech.ents[i]; if(x._illusion&&x._dead){ G.tech.ents.splice(i,1); if(G.tech.selU) G.tech.selU=G.tech.selU.filter(id=>id!==x.eid); } } }   // 👥 소멸한 환영 제거
  if(F&&F.length){ live=true;
    for(let i=F.length-1;i>=0;i--){ const fx=F[i]; fx.t+=dt;
      if(fx.type==='mine'){ const hit=G.tech.ents.find(x=>(x.type==='unit'||x.type==='worker')&&x.eid!==fx.owner&&Math.hypot(x.x-fx.x,x.y-fx.y)<=fx.trig);
        if(hit){ F[i]={type:'boom', x:fx.x, y:fx.y, t:0, dur:0.8, r:fx.r}; } continue; }
      if(fx.type==='nuke'&&fx.t>=fx.delay&&!fx._boomed){ fx._boomed=true; }
      if(fx.type==='ensnare'){ for(const x of G.tech.ents){ if((x.type==='unit'||x.type==='worker')&&Math.hypot(x.x-fx.x,x.y-fx.y)<=fx.r) x._skSlow=0.25; } }   // 범위 내 둔화(연출·테스트)
      if(fx.type==='plague'){ fx._pAcc=(fx._pAcc||0)+dt; if(fx._pAcc>=0.5){ fx._pAcc-=0.5; for(const x of G.tech.ents){ if((x.type==='unit'||x.type==='worker')&&x.hp>1&&Math.hypot(x.x-fx.x,x.y-fx.y)<=fx.r) x.hp=Math.max(1,x.hp-(fx.dps||18)*0.5); } } }   // 🩸 범위 HP 지속 감소(1까지)
      if(fx.type==='dswarm'){ for(const x of G.tech.ents){ if((x.type==='unit'||x.type==='worker')&&Math.hypot(x.x-fx.x,x.y-fx.y)<=fx.r) x._darkSwarm=0.2; } }   // ☁️ 범위 보호 갱신
      if(fx.t>=fx.dur) F.splice(i,1); } }
  return live; }
function _techMultiTypeModel(units, canBack){ const race=G.tech.race, uid=units[0].uid, spec=techUnitSpec(race,uid)||{}, n=units.length;   // 👥 동일 종류 다수(or 종류 소프트선택) — 헤더 ×N + 유닛별 HP 리스트 + 그 종류 스킬 카드(SC식)
  const items=[];
  if(typeof UNIT_SKILLS!=='undefined'){ const _skSlot={ high_templar:{psi_storm:0, hallucination:1} }[uid]||null;   // 단일 프로필과 동일한 고정 슬롯 유지
    for(const _k of (UNIT_SKILLS[uid]||[])){ const sk=SKILLS[_k]; if(!sk) continue; const _c=_skCost(sk);
      let armed=false, on=false, canCast=false;   // 카드 상태 = 활성셋 집계(쿨다운 없음 — 마나만 · 한 기라도 armed/ON=표시 · 전원 마나부족=dim)
      for(const u of units){
        if(G.tech.skillArm&&G.tech.skillArm.eid===u.eid&&G.tech.skillArm.key===_k) armed=true;
        if((u._skOn&&u._skOn[_k])||(_k==='heal'&&u._healF!=null)||(_k==='stim'&&u._skStim>0)) on=true;
        if(_c<=0||_techSkEn(u)>=_c) canCast=true; }
      const _lk=_skillLocked(race,_k), _lb=_lk?_techBldgOfResearch(race,SKILL_RESEARCH[_k]):'';   // 🔒 스펠 언락 미연구=잠금
      const _card={ pro:skillIcoHTML(_k, '<span class="skPro">'+((typeof SKILL_ICON!=='undefined'&&SKILL_ICON[_k])||pIco('✨'))+'</span>'), sn:sk.name,
        meta:_lk?pIco('🔒','sm'):(on?'ON':''), metaCls:'lv', sel:!_lk&&(armed||on), bottom:'<div class="cgCost">'+_skCostHTML(sk)+'</div>',
        state:_lk?'dim':(canCast?'ok':'dim'), act:'onpointerdown="techSkDown(event,\''+_k+'\')" onpointerup="techSkUp(event)" onpointerleave="techSkCancel()" onpointercancel="techSkCancel()" oncontextmenu="return false"' };
      const _si=_skSlot&&_skSlot[_k]; if(_si!=null){ while(items.length<=_si) items.push(null); items[_si]=_card; } else items.push(_card); } }
  const CAP=60, rows=units.slice(0,CAP).map(u=>({ eid:u.eid, uid:u.uid, hp:(u.hp!=null?u.hp:(spec.hp||0)), maxHp:(u.maxHp||spec.hp||1),
    sh:(u.sh!=null?u.sh:(u.maxSh||0)), maxSh:(u.maxSh||0), en:(u.en!=null?u.en:0), maxEn:(u.maxEn||0) }));   // 유닛별 HP 칩(탭=개별 지정) — 60까지 전부 칩+스크롤, 초과만 +N 안전장치
  if(n>CAP) rows.push({ more:n-CAP });
  const rn=_techRealName(race,uid), role=_techRoleOf(uid);
  return { mode:'prod', title:rn+' <span class="nsub">×'+n+'</span>', icon:_techUnitPortrait(uid),
    sub:'', items, topRight:_techSelAllBtn(uid),   // 👥 화면 내 같은 종류 전체 지정
    back:canBack?'<button class="cgLift cgBack" onclick="techSubSelectType(event,\'\')" title="전체 선택으로">'+uiIco('back')+'</button>':'',   // 🔙 소프트선택 해제(전체 복귀) — 오른쪽 끝
    info:{ eb:'', hideName:true, units:rows, cr:0, en:0 } }; }
function _techMultiMixedModel(list, grp, ord){ const race=G.tech.race, items=[];   // 👥 혼합 지정(여러 종류) — 종류 초상화 칩(탭=그 종류만) + 공통 스킬(교집합)만(SC식)
  const uidOf=k=>(k==='__wk')?(TECH_WORKER[race]||'worker_human'):k;
  for(const k of ord){ const uid=uidOf(k);
    items.push({ pro:_techUnitPortrait(uid), sn:_techRealName(race,uid), tr:'×'+grp[k].n, metaCls:'lv', state:'ok',
      bottom:'<div class="cgTrash" onpointerdown="event.stopPropagation()" onpointerup="event.stopPropagation()" onclick="techRemoveType(event,\''+k+'\')" title="이 종류 지정 해제">'+uiIco('untype')+'</div>',   // 🗑 카드 하단 = 그 종류만 지정 해제(카드 사라지고 뒤 카드 당겨짐)
      act:'onpointerdown="techChipDown(event,\''+k+'\')" onpointerup="techChipUp(event)" onpointerleave="techChipCancel()" onpointercancel="techChipCancel()" oncontextmenu="return false"' }); }   // 짧게=소프트(전부 유지) · 꾹=그 종류만 분리 · 전환은 pointerup에서(터치 롱프레스 대응) + 뒤따르는 click은 삼킴
  if(typeof UNIT_SKILLS!=='undefined'){ const sets=ord.filter(k=>k!=='__wk').map(k=>new Set(UNIT_SKILLS[grp[k].e.uid]||[]));
    const common=(sets.length&&sets.length===ord.length)?[...sets[0]].filter(kk=>sets.every(s=>s.has(kk))):[];   // 일꾼 포함 시 공통 없음
    for(const _k of common){ const sk=SKILLS[_k]; if(!sk) continue; const _c=_skCost(sk), _lk=_skillLocked(race,_k), _lb=_lk?_techBldgOfResearch(race,SKILL_RESEARCH[_k]):'';
      items.push({ pro:skillIcoHTML(_k, '<span class="skPro">'+((typeof SKILL_ICON!=='undefined'&&SKILL_ICON[_k])||pIco('✨'))+'</span>'), sn:sk.name,
        meta:_lk?pIco('🔒','sm'):'', metaCls:'lv', state:_lk?'dim':'ok', bottom:'<div class="cgCost">'+_skCostHTML(sk)+'</div>', act:'onpointerdown="techSkDown(event,\''+_k+'\')" onpointerup="techSkUp(event)" onpointerleave="techSkCancel()" onpointercancel="techSkCancel()" oncontextmenu="return false"' }); } }
  return { mode:'prod', title:'유닛 '+list.length+'기', icon:_techUnitPortrait(uidOf(ord[0])),
    sub:'', items,
    info:{ hideName:true, statsScroll:true, stats:ord.map(k=>[_techRealName(race,uidOf(k)), '×'+grp[k].n]), cr:0, en:0 } }; }   // 좌측 종류 목록 = 3종류까지만 보이고 그 아래 스크롤(.sc) · 상단 '선택' 라벨 제거
function techUnitPanelModel(list){ const race=G.tech.race, grp={}, ord=[];   // 유닛 지정 시트 — 건물 그리드와 동일한 커맨드 그리드 재사용
  for(const e of list){ const k=(e.type==='worker')?'__wk':e.uid; if(!grp[k]){ grp[k]={n:0,e:e}; ord.push(k); } grp[k].n++; }
  if(list.length>1){ const _ak=(ord.length===1)?ord[0]:((G.tech.selType&&grp[G.tech.selType])?G.tech.selType:null);   // 👥 다중 지정: 동일종류(1종) or 종류 소프트선택(selType)=타입 모델 · 혼합=종류 칩 모델
    if(_ak==='__wk') return techWorkerBuildModel(list.filter(e=>e.type==='worker'), ord.length>1);   // 🔨 일꾼 종류 선택 = 건설 프로필(혼합에서 소프트선택 시 ▲ 복귀)
    if(_ak) return _techMultiTypeModel(list.filter(e=>(((e.type==='worker')?'__wk':e.uid)===_ak)), ord.length>1);
    return _techMultiMixedModel(list, grp, ord); }
  const items=[];   // 유닛 초상 카드 제거 — 헤더 프로필과 중복(그리드는 변태·장전 등 행동 카드만)
  if((race==='swarm'||race==='aetherial') && list.length===1 && list[0].type==='unit' && typeof TECH_MORPH!=='undefined' && TECH_MORPH[list[0].uid]){   // 🧬 2차 변태/진화 카드(단일 지정 시) — 이름만(변태→ 없음), 지정 슬롯 위치
    const _slot={ hydra:{thornqueen:3}, wyvern:{venom:2, behemoth:3}, high_templar:{archon:3}, dark_templar:{dark_archon:3} }[list[0].uid]||{};   // 리퍼=베놈퀸 4번칸 · 와이번=베놈 3·베히모스 4 · 하이세이지=보이드 4번칸 · 다크세이지=다크보이드 4번칸
    for(const mm of TECH_MORPH[list[0].uid]){ const ok=_techMorphOK(mm);
      const card={ pro:_techUnitPortrait(mm.to), sn:mm.name, cr:mm.m, en:mm.g, meta:'', state:(ok.ok&&_techAfford(mm.m,mm.g))?'ok':'dim', act:ok.ok?('onclick="techDoMorph(event,\''+mm.to+'\')"'):'' };
      const si=_slot[mm.to]; if(si!=null){ while(items.length<=si) items.push(null); items[si]=card; } else items.push(card); } }
  const _amE=(list.length===1 && list[0].type==='unit' && TECH_AMMO[list[0].uid])?list[0]:null;   // 🚀 캐리어(요격기)·리버(스캐럽) = 내부 장전 큐
  if(_amE){ const key=_amE.uid, a=TECH_AMMO[key], cap=_techAmmoCap(key), have=(_amE._chc||0)+((_amE._chq||[]).length);
    items.push({ pro:pIco(a.ico), sn:a.label+' 장전', cr:a.m, en:a.g, meta:have+'/'+cap, metaCls:'lv', state:(have>=cap||!_techAfford(a.m,a.g))?'dim':'ok', act:'onclick="techChargeAmmo(event,\''+key+'\')"' }); }
  if(list.length===1 && list[0].type==='unit' && typeof UNIT_SKILLS!=='undefined'){   // 🪄 유닛 스킬 카드 — 메인 UNIT_SKILLS/SKILLS/SKILL_ICON 단일 소스 재사용
    const _su=list[0]; const _skSlot={ high_templar:{psi_storm:0, hallucination:1} }[_su.uid]||null;   // 하이세이지 = 1스톰·2할루시네이션(4보이드) 한 페이지 고정
    for(const _k of (UNIT_SKILLS[_su.uid]||[])){ const sk=SKILLS[_k]; if(!sk) continue;
      const armed=!!(G.tech.skillArm&&G.tech.skillArm.eid===_su.eid&&G.tech.skillArm.key===_k);
      const on=!!((_su._skOn&&_su._skOn[_k])||(_k==='heal'&&_su._healF!=null)||(_k==='stim'&&_su._skStim>0));
      const _c=_skCost(sk), lowE=_c>0&&_techSkEn(_su)<_c;   // 쿨다운 없음(SC식) — 마나 부족만 dim
      const _lk=_skillLocked(race,_k), _lb=_lk?_techBldgOfResearch(race,SKILL_RESEARCH[_k]):'';   // 🔒 스펠 언락 미연구=잠금
      const _card={ pro:skillIcoHTML(_k, '<span class="skPro">'+((typeof SKILL_ICON!=='undefined'&&SKILL_ICON[_k])||pIco('✨'))+'</span>'), sn:sk.name,
        meta:_lk?pIco('🔒','sm'):(on?'ON':''), metaCls:'lv', sel:!_lk&&(armed||on), bottom:'<div class="cgCost">'+_skCostHTML(sk)+'</div>',
        state:_lk?'dim':(lowE?'dim':'ok'), act:'onpointerdown="techSkDown(event,\''+_k+'\')" onpointerup="techSkUp(event)" onpointerleave="techSkCancel()" onpointercancel="techSkCancel()" oncontextmenu="return false"' };
      const _si=_skSlot&&_skSlot[_k]; if(_si!=null){ while(items.length<=_si) items.push(null); items[_si]=_card; } else items.push(_card); } }
  const f=list[0], fid=(f.type==='worker')?(TECH_WORKER[race]||'worker_human'):f.uid, spec=techUnitSpec(race,fid)||{};
  const rn=_techRealName(race,fid), role=_techRoleOf(fid);
  const nm=(list.length===1)?(rn):('유닛 '+list.length+'기');   // 이름 (직책)
  const _hpsh=(list.length===1 && f && f.hp!=null)   // 🔴 단일 지정 = 실시간 HP/쉴드/마나(스팀팩 등 소모 반영) · 초기화 전이면 spec 폴백
    ? _cgHpShStr(Math.round(f.hp)+'/'+Math.round(f.maxHp!=null?f.maxHp:spec.hp),
        (f.maxSh>0)?(Math.round(f.sh!=null?f.sh:f.maxSh)+'/'+Math.round(f.maxSh)):0,
        0)                                       // ⚠ 마나는 머리줄이 아니라 왼쪽 정보 구역(스탯)에 넣는다
    : _cgHpShDual(spec.hp,spec.sh,0);
  return { mode:'prod', title:nm, icon:_techUnitPortrait(fid), hpsh:_hpsh, sub:(_amE?'내부 장전 — 탭 · 맵 탭=이동':'맵을 탭하면 이동 · 해제는 우상단 ✕'), items,
    topRight:_techSelAllBtn((f.type==='worker')?'__wk':fid),   // 👥 화면 내 같은 종류 전체 지정
    info:_amE?_techAmmoInfo(_amE, _amE.uid):{ eb:'', hideName:true, stats:_techUnitStatList(spec,fid,f), cr:0, en:0 } }; }   // 왼쪽: 장전 큐(캐리어·리버) / 유닛 스탯(+마나)
function techWorkerBuildModel(list, canBack){ const race=G.tech.race, fid=(TECH_WORKER[race]||'worker_human'), n=list.length;   // 일꾼 지정 시트 — 헤더=일꾼 프로필, 그리드=건물 생성 카드 · canBack=혼합 소프트선택에서 ▲ 복귀
  const ws=techUnitSpec(race,fid)||{}, rn=_techRealName(race,fid), role=_techRoleOf(fid);
  // 👥 2기 이상 = 다른 동일종류 다중 지정과 동일하게 유닛별 HP 칩(탭=개별 지정) · 1기 = 유닛 스탯
  const _winfo=(()=>{ if(n<=1) return { eb:'', hideName:true, stats:_techUnitStatList(ws,fid), cr:0, en:0 };
    const CAP=60, rows=list.slice(0,CAP).map(u=>({ eid:u.eid, uid:u.uid, hp:(u.hp!=null?u.hp:(ws.hp||0)), maxHp:(u.maxHp||ws.hp||1),
      sh:(u.sh!=null?u.sh:(u.maxSh||0)), maxSh:(u.maxSh||0), en:(u.en!=null?u.en:0), maxEn:(u.maxEn||0) }));
    if(n>CAP) rows.push({ more:n-CAP });
    return { eb:'', hideName:true, units:rows, cr:0, en:0 }; })();
  const _bk=canBack?'<button class="cgLift cgBack" onclick="techSubSelectType(event,\'\')" title="전체 선택으로">'+uiIco('back')+'</button>':'';
  let _bd=null; for(const w of list){ const b=_techBuildBldg(w); if(b&&b.bt>0&&!b._bpause){ _bd=b; break; } }   // 지정 중 한 마리라도 건설 중(미일시정지) 일꾼이 있으면 = 작업 프로필(그리드 비우고 4번째 칸에 일시정지만)
  if(_bd){
    const items=[null,null,null,{ pro:'<svg viewBox="0 0 24 24" style="display:block;width:100%;height:100%"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><line x1="6.2" y1="6.2" x2="17.8" y2="17.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>', sn:'', state:'ok', cls:'iconFill', act:'onclick="techPauseBuild(event)"' }];   // 4번째(우상단) 칸 = 유닛 지정해제와 동일한 금지 아이콘(칸 중앙에 크게, 텍스트 없음), 나머지 비움 → 다른 행동 불가
    return { mode:'build', alwaysFull:true, title:rn, icon:_techUnitPortrait(fid), hpsh:_cgHpShDual(ws.hp,ws.sh), back:_bk,
      sub:'🔨 건설 중 — ⏸ 일시정지하면 자유 이동·다른 건물 건설 가능', items, info:_winfo }; }   // alwaysFull=항상 두 줄(작업 시 한 줄로 안 줄어듦 · 일시정지=4번 칸 유지) · info=1기 스탯 / 2기↑ HP 칩
  const bl=techBuildListModel();   // 그 외(자유 상태): 건물 카드(techArm) 재사용 — 처음처럼 다른 건물 건설 가능
  return { mode:'build', alwaysFull:true, title:rn+(n>1?(' '+n+'기'):''), icon:_techUnitPortrait(fid), hpsh:_cgHpShDual(ws.hp,ws.sh), back:_bk,
    sub:'건물 선택 → 맵 탭해 배치 · 맵 탭 = 이동 · 해제 ✕', items:bl.items, info:_winfo }; }
function techPauseBuild(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;   // ⏸ 일시정지: 건물 동결 + 일꾼 완전 분리(처음 상태로 복귀)
  const wks=(G.tech.selU||[]).map(id=>G.tech.ents.find(e=>e.eid===id)).filter(e=>e&&e.type==='worker'&&e.build!=null); if(!wks.length) return;   // 지정된 건설 중 일꾼 전체
  let any=false;
  for(const wk of wks){ const bd=_techBuildBldg(wk); if(!bd||bd.bt<=0) continue;
    bd._bpause=true; bd.waiting=false;   // 건물 = 반건설 상태로 동결(일꾼 없음, 카운트다운 정지)
    wk.build=null; wk._working=false; wk._bpSide=null; wk._bpT=null; wk.tx=null; wk.ty=null; wk._wp=null; wk._rr=0; any=true; }   // 일꾼 = 자유(다른 건물 건설·이동 가능)
  if(!any) return;
  if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); }
function techResumeBuild(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;   // ▶ 재개: 선택된 일시정지 건물에 가장 가까운 유휴 엔지니어를 보내 이어서 건설
  const bd=(G.tech.sel!=null)?G.tech.ents.find(e=>e.eid===G.tech.sel&&e.type==='bldg'):null; if(!bd||bd.bt<=0||!bd._bpause) return;
  let wk=(G.tech.selU||[]).map(id=>G.tech.ents.find(e=>e.eid===id)).find(e=>e&&e.type==='worker'&&e.build==null);   // 지정해둔 유휴 일꾼 우선(그 일꾼으로 재개)
  if(!wk){ let bdst=1e9; for(const e of G.tech.ents){ if(e.type==='worker'&&e.build==null){ const d=(e.x-bd.x)*(e.x-bd.x)+(e.y-bd.y)*(e.y-bd.y); if(d<bdst){ bdst=d; wk=e; } } } }   // 없으면 가장 가까운 유휴 일꾼
  if(!wk){ if(typeof toast==='function') toast('⛔ 건설할 일꾼이 없음'); return; }
  wk.build=bd.eid; wk._working=false; wk._bpSide=null; wk._bpT=null;
  _techRoute(wk, Math.max(techBX0(),Math.min(techBX1(),bd.x)), Math.max(techBY0(),Math.min(techBY1(),bd.y+0.05)));   // 건설지까지 우회 경로로 이동
  bd._bpause=false; bd.waiting=true;   // 일꾼 도착까지 대기(카운트다운 정지) → 도착 시 이어서 건설
  G.tech.selU=[]; G.tech.sel=bd.eid;   // 재개 = 일꾼 중복 지정 해제하고 해당 건물만 지정(건물 프로필 표시)
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
function techDemolishBuild(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||G.tech.sel==null) return;   // 건설 중·일시정지 건물 즉시 철거(일꾼 도착 불필요) — 완성 전이라 built/supCap 미반영이므로 카운트 조정 없음
  const e=G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'); if(!e||e.bt<=0) return;
  const b=techGetBldg(G.tech.race,e.bk); if(b) techRefund(Math.round((b.m||0)*0.75), Math.round((b.g||0)*0.75));   // 자원 75% 환불(취소)
  for(const w of G.tech.ents){ if(w.type==='worker'&&w.build===e.eid){ w.build=null; w._working=false; w._bpSide=null; w._bpT=null; w.tx=null; w.ty=null; w._wp=null; w._rr=0; } }   // 일꾼 해방
  for(const p of G.tech.ents){ if(p._addonEid===e.eid) p._addonEid=null; }   // 애드온이면 본체 슬롯 해제(재부착 가능)
  if(e._drone){ G.tech.ents.push({eid:G.tech.eseq++, type:'worker', x:e.x, y:Math.min(techBY1(),e.y+0.02)}); G.tech.sup+=1; }   // 🧬 스웜: 변태 취소 → 희생됐던 드론 부활
  G.tech.ents=G.tech.ents.filter(x=>x.eid!==e.eid); G.tech.sel=null;
  if(typeof playSfx==='function') playSfx('ui_denied'); techUIRender(); }
function techBldgBuildingModel(be){ const race=G.tech.race, b=techGetBldg(race,be.bk)||{}, bs=techBldgSpec(race,be.bk)||{};   // 건설 중·일시정지 건물 = 전부 잠금 + 진행도 비례 체력
  const maxHp=bs.hp||0, maxSh=bs.sh||0, ratio=Math.max(0,Math.min(1,1-(be.bt/(be.btMax||1)))), pct=Math.round(ratio*100), paused=!!be._bpause;
  const curHp=Math.round(maxHp*ratio), curSh=Math.round(maxSh*ratio);
  let items=[];
  if(b.produces) items=b.produces.map(p=>({ pro:_techUnitPortrait(p.id), sn:_techRealName(race,p.id), cr:p.m, en:p.g, meta:'🔒', metaCls:'', state:'dim', act:'' }));   // 생산 목록 표시하되 전부 잠금(클릭 불가)
  else if(_techResList(b).length) items=_techResList(b).map(r=>({ pro:(SKILLS&&SKILLS[r.k]?skillIcoHTML(r.k):upgIcoHTML(r.k)), sn:r.name, meta:'🔒', metaCls:'', state:'dim', act:'' }));
  return { mode:'prod', title:b.name+(paused?' (일시정지)':' (건설 중)'), icon:pIco(b.ico||'🏢'),
    hpsh:_cgHpShStr(curHp+'/'+maxHp, maxSh?(curSh+'/'+maxSh):0), status:(paused?'⏸ 일시정지':'🏗 '+pct+'%'), statusIdle:paused,
    sub:(paused?'⏸ 미완성 — 건물 클릭 후 ▶ 재개로 이어서 건설':'🏗 건설 중 '+pct+'% — 완성 전 사용 불가'), items,
    info:{ eb:'상태', name:b.name, hideName:true, desc:(paused?'일시정지된 미완성 건물. ▶ 재개 시 가장 가까운 일꾼이 이어서 건설.':''), progLabel:'건설', progTime:(paused?'':(Math.ceil(be.bt)+'s')), progVal:pct+'%', prog:pct, cr:0, en:0, time:'' } }; }   // 남은 초 = 건설 라벨 옆(progTime) · 하단 안내/설명 제거
function techPanelRender(){ const body=document.getElementById('btSheetBody'), sheet=document.getElementById('btSheet'); if(!body||!sheet) return;
  const sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null});
  const selB=(G.tech.sel!=null)?G.tech.ents.find(e=>e.eid===G.tech.sel&&e.type==='bldg'):null;
  const selUs=(G.tech.selU||[]).map(id=>G.tech.ents.find(e=>e.eid===id)).filter(Boolean);
  let selRes=G.tech.selRes||null; if(selRes && selRes.kind==='mineral' && !(G.tech.minerals||[]).some(m=>m.eid===selRes.eid)){ G.tech.selRes=null; selRes=null; }   // 💎 소멸한 미네랄 지정 정리
  if(sh.sec==='ent' && !selB && !selUs.length && !selRes){ sh.open=false; sh.sec=null; }   // 선택 사라짐 → 시트 닫기
  const _allWk=selUs.length>0 && selUs.every(e=>e.type==='worker');   // 전원 일꾼 = 건설 프로필 · 일꾼+전투유닛 혼합 = 복합(칩) 프로필(칩 탭으로 종류별 전환)
  // 시트: 선택된 대상(일꾼=건설 그리드 / 유닛=이동 / 건물=생산·연구)만 표시. 별도 독 배너 없음 — 업그레이드 탭 시트처럼 그 영역만
  const _selKey=(G.tech.sel!=null)?('b'+G.tech.sel):((G.tech.selU&&G.tech.selU.length)?('u'+G.tech.selU.join(',')):(selRes?('r'+selRes.kind+(selRes.eid||'')):''));
  if(_selKey!==G.tech._lastSelKey){ G.tech.cardMode=1; G.tech.selType=null; G.tech._lastSelKey=_selKey; }   // 선택 변화(해제=''도 포함) = 간소화 초기화 + 종류 소프트선택(selType) 리셋 · 칩 탭(selU 불변)은 유지 — 해제도 기록해야 같은 유닛 재지정 시 첫 복합 화면으로 복귀
  let model=null;
  const _resumeMode=!!(selB && selB.bt>0 && selB._bpause && selUs.length);   // 재개 모드(유닛 지정 + 일시정지 건물 선택): 건물 위 재개 버튼만, 하단은 지정 유닛 프로필
  if(sh.open){ if(selRes){ model=techResourceModel(selRes); }   // 💎⛽ 중립 자원(미네랄·가스 광산) 프로필
    else if(selB && !_resumeMode){ if(selB.bt>0){ model=techBldgBuildingModel(selB); }   // 건설 중·일시정지 = 잠금 프로필(진행도 HP)
      else { const b=techGetBldg(G.tech.race,selB.bk); model=(G.tech.race==='union'&&selB.bk==='bunker')?techBunkerModel(b, selB):((G.tech.race==='swarm'&&selB.bk==='nydus')?techNydusModel(b, selB):((G.tech.race==='swarm'&&TECH_LARVA_BLDG[selB.bk])?techBldgProdModel(b, selB):(_techHasProd(b)?techBldgProdModel(b, selB):((_techResList(b).length)?techBldgUpgModel(b, selB):((b&&b.unlocks)?techBldgInfoModel(b, selB):techBldgPlainModel(b, selB)))))); } }   // 🧱 벙커·🕳 나이더스=전용 모델 · 🐛 라바 건물 우선 · 해금=정보 모델
    else if(selUs.length){ const _selEgg=selUs.filter(e=>e.type==='egg'), _selLv=selUs.filter(e=>e.type==='larva');
      model=_selEgg.length?techEggModel(_selEgg):(_selLv.length?techLarvaProdModel(_selLv):(_allWk?techWorkerBuildModel(selUs):techUnitPanelModel(selUs))); } }   // 🥚 알 = 진화중(잠금) 프로필
  // 🔢 모든 건물 = 4그리드 1줄(간소화)로 높이 통일. 5개↑는 2줄로 높이지 않고 페이지로 넘김(슬롯 위치 보존). cm2=최소화(본문 숨김)만 별도
  const cm=1; G.tech.cardMode=1;   // 카드 높이는 한 가지(간소화 1줄)뿐 — 접기 버튼을 없애면서 cm2(최소화)도 함께 사라졌다
  // 📦 보급 시트는 화면 전환이 아니라 하단 시트 토글이라, 건설지에서도 같은 호스트(#btSheetBody)에 그대로 올린다.
  //   모델(_stkSupplyModel)과 렌더(renderCmdGrid)는 전투 화면과 동일한 것을 쓴다 — UI를 두 번 만들지 않는다.
  let _sup=false, specHTML=null;
  if(typeof STK!=='undefined' && STK && STK.specSheet && typeof _stkSpecGridHTML==='function'){ specHTML=_stkSpecGridHTML(); _sup=true; }   // 👁 관전 = 전용 .plbtn 그리드(건설지 호스트에도 동일)
  else if(typeof STK!=='undefined' && STK && STK.supSheet && typeof _stkSupplyModel==='function'){ model=_stkSupplyModel(); _sup=true; }
  const _shown=!!((sh.open||_sup) && (model||specHTML) && G.tech.arm==null && G.tech.rallySet==null);   // 🗺 배치·착륙(arm)·랠리 지정 중 = 프로필 시트 잠시 내려 맵을 넓게 확보 · 모드 종료 시 자동 복귀
  if(model && !_sup){ model.compact=(cm===1); model.build=true; }   // 건설 탭 카드 스타일(업그레이드 시트는 모델이 이미 같은 스타일을 들고 온다)
  sheet.classList.toggle('open', _shown);
  if(_shown) sheet.classList.add('simple');   // 숨길 땐 높이 클래스(.simple) 유지 → 현재 높이 그대로 아래로 슬라이드(즉시 확대로 위로 울컥이는 것 방지)
  body.classList.toggle('stkSpec', specHTML!=null);
  // ⚠ 보급·관전 시트는 값이 안 변해도 0.22초마다 이 함수를 부른다(strikeFrame). DOM 을 통째로 새로 만들면
  //    그때마다 <img> 가 새로 생겨 **아이콘이 화면에 뜰 틈이 없다** — 실제로 강화·구입 칸이 빈칸으로 보였다.
  //    서명이 같으면 그대로 둔다(전투 화면 호스트 strikeRenderSelInfo 와 같은 규약).
  const _sig=_sup?_stkSheetSig():null;
  if(_sig==null || _sig!==body._stkSig){ body._stkSig=_sig;
    if(specHTML!=null) body.innerHTML=specHTML; else if(model) renderCmdGrid(body, model); }
  const _liftSel=(G.tech.sel!=null)&&!!G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'&&x._lifted);   // 부양 건물 선택 = 바닥탭이 이동이라 금지버튼으로 해제
  const dz=document.getElementById('btDesel'); if(dz) dz.classList.toggle('on',(G.tech.selU||[]).length>0 || _liftSel || !!G.tech.selRes); }
function techDeselU(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;
  if(G.tech.arm!=null){ techCancelArm(ev); return; }   // 🚫 건설 배치 중 = 지정 해제(⊘) 버튼 = 건설 취소 → 일꾼 지정·프로필 복귀(맵에 올리지 않고도 취소)
  G.tech.selU=[]; G.tech.sel=null; G.tech.selRes=null;   // 유닛·건물(부양 포함)·중립 자원 지정 모두 해제
  const sh=G.tech.sheet; if(sh&&sh.sec==='ent'){ sh.open=false; sh.sec=null; } techUIRender(); }   // 해제 후 다시 드래그=박스 지정(메인 규약)
function techSubSelectType(ev,uid){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;   // 👥 혼합 지정 → 종류 칩 짧게 탭 = 그 종류 프로필만 표시(selU는 전부 유지 · 소프트) · uid 빈값=전체로 복귀
  G.tech.selType=uid||null; const body=document.getElementById('btSheetBody'); if(body) body._cgPage=0;
  if(typeof playSfx==='function') playSfx('ui_open'); techPanelRender(); }
function techSepSelectType(uid){ if(!G.tech||!uid) return;   // 👥 종류 칩 꾹(롱프레스) = 그 종류 유닛만 지정해 분리(나머지 해제)
  const ids=(G.tech.selU||[]).filter(id=>{ const e=G.tech.ents.find(x=>x.eid===id); return e && (((e.type==='worker')?'__wk':e.uid)===uid); });
  if(!ids.length) return; G.tech.selU=ids; G.tech.selType=null; const body=document.getElementById('btSheetBody'); if(body) body._cgPage=0;
  if(typeof playSfx==='function') playSfx('ui_open'); if(typeof toast==='function') toast('👥 해당 종류만 분리'); techUIRender(); }
const TECH_HOLD_MS=420;   // 롱프레스 유지 시간 — 벙커·드롭쉽(나이더스) 탑승/수리 상호작용과 통일
let _chipT=null, _chipK=null, _chipDone=false, _chipSwallow=false;   // 종류 칩: 짧게=소프트(전부 유지) · 꾹(유지시간 경과)=자동 분리(손 안 떼도 프로필 변경)
function techChipDown(ev,k){ if(ev&&ev.stopPropagation) ev.stopPropagation(); _chipSwallow=false; _chipK=k; _chipDone=false;
  if(_chipT) clearTimeout(_chipT);
  _chipT=setTimeout(()=>{ _chipT=null; if(_chipK===k){ _chipDone=true; _chipSwallow=true; if(typeof playSfx==='function') playSfx('ui_open'); techSepSelectType(k); } }, TECH_HOLD_MS); }   // 유지 경과 = 손 안 떼도 즉시 분리 + 뒤따르는 합성 click 삼킴(누수 차단)
function techChipUp(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(_chipT){ clearTimeout(_chipT); _chipT=null; }
  const k=_chipK, done=_chipDone; _chipK=null; _chipDone=false;
  if(k!=null && !done){ _chipSwallow=true; techSubSelectType(ev,k); } }   // 유지 전 뗌 = 소프트선택(전부 유지)
function techChipCancel(){ if(_chipT){ clearTimeout(_chipT); _chipT=null; } _chipK=null; _chipDone=false; }   // 손가락이 칩 밖으로 벗어나면 취소
if(typeof document!=='undefined') document.addEventListener('click', function(e){ if(_chipSwallow){ _chipSwallow=false; e.stopPropagation(); e.preventDefault(); } }, true);   // 칩 액션(소프트/분리) 직후의 합성 click 1회 삼킴 → 새 그리드(빌드 카드 등)로 새어 오발동 차단
// 🔮 스킬 카드: 짧게=시전 · 길게(TECH_HOLD_MS)=설명 팝업(손 떼면 사라짐). 칩 롱프레스 패턴 복제 + 합성 click 삼킴 재사용.
let _tskT=null, _tskKey=null, _tskDone=false;
function techSkDown(ev,key){ if(ev&&ev.stopPropagation) ev.stopPropagation(); _chipSwallow=false; _tskKey=key; _tskDone=false;
  const el=ev&&ev.currentTarget, r=(el&&el.getBoundingClientRect)?el.getBoundingClientRect():null;   // 앵커 rect를 pointerdown 시점에 즉시 캡처(틱 리렌더로 카드가 detach돼도 좌표 유지)
  const rect=r?{left:r.left,top:r.top,bottom:r.bottom,width:r.width}:null;
  if(_tskT) clearTimeout(_tskT);
  _tskT=setTimeout(()=>{ _tskT=null; if(_tskKey===key){ _tskDone=true; _chipSwallow=true; if(typeof playSfx==='function') playSfx('ui_open'); techShowSkTip(key, rect); } }, TECH_HOLD_MS); }
function techSkUp(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(_tskT){ clearTimeout(_tskT); _tskT=null; }
  const key=_tskKey, done=_tskDone; _tskKey=null; _tskDone=false; techHideSkTip();
  if(key!=null && !done){ _chipSwallow=true;   // 짧게 = 시전(잠금이면 잠금 토스트)
    if(_skillLocked(G.tech.race,key)){ techSkillLocked(ev, _techBldgOfResearch(G.tech.race, SKILL_RESEARCH[key])); } else techCastSkill(ev, key); } }
function techSkCancel(){ if(_tskT){ clearTimeout(_tskT); _tskT=null; } _tskKey=null; _tskDone=false; techHideSkTip(); }
// 📖 카드 설명 팝업(공용) — 스킬·건물·유닛 생산 등 모든 카드가 같은 팝업을 씀. d={ico,name,cost(HTML),desc}
function techShowTip(d, rect){ if(!d) return; const tip=document.getElementById('techSkTip'); if(!tip) return;
  if(tip.parentNode!==document.body) document.body.appendChild(tip);   // 숨겨진 화면 안에 있으면 안 보인다 → 최상위로 승격(위치는 rect 기준 고정)
  tip.innerHTML='<div class="tskH"><b>'+(d.name||'')+'</b>'+(d.time?('<span class="tskC"><span class="tskT">'+d.time+'</span></span>'):'')+'</div><div class="tskD">'+(d.desc||'')+'</div>';   // 좌상단 아이콘·우상단 비용 제거 → 우상단은 소요 시간
  tip.classList.remove('hide');
  if(rect&&rect.width){ const tw=tip.offsetWidth, th=tip.offsetHeight;
    // 클램프 기준 = 게임 화면(#phone) 영역. window 기준으로 잡으면 데스크톱에서 화면 바깥(좌우 여백)으로 삐져나감
    const _ph=document.getElementById('phone'), _pr=_ph?_ph.getBoundingClientRect():null;
    const L=_pr?_pr.left:0, R=_pr?_pr.right:(window.innerWidth||420), T=_pr?_pr.top:0, B=_pr?_pr.bottom:(window.innerHeight||800);
    let left=rect.left+rect.width/2-tw/2; left=Math.max(L+6, Math.min(left, R-tw-6));
    let top=rect.top-th-8; if(top<T+6) top=Math.min(rect.bottom+8, B-th-6);
    tip.style.left=left+'px'; tip.style.top=top+'px'; } }
function techShowSkTip(key, rect){ const sk=(typeof SKILLS!=='undefined')?SKILLS[key]:null; if(!sk) return;
  const c=_skCost(sk), cost=(sk.hpCost>0)?('체력 '+sk.hpCost):(c>0?('마나 '+c):'');   // 스킬은 소요 시간이 없어 헤더 비움 · 비용은 섹션으로
  techShowTip({ name:sk.name, desc:'<div class="tskSecL">'+_skillDesc(key)+'</div>'+(cost?_tskSec('소모',cost):'') }, rect); }
function _tskSec(t,l){ return '<div class="tskSec"><div class="tskSecT">'+t+'</div><div class="tskSecL">'+l+'</div></div>'; }   // 📖 설명 섹션(제목 + 내용)
// 🏢 건물 요약 한 줄(프로필 하단 .cgDd용 — 좁은 영역이라 섹션 없이 문장만)
function _techSpawnText(b){ if(!b || typeof techBldgUnit!=='function') return '';
  if(!techWallet()) return '';   // 🎮 자동 배출은 오토배틀 전용 규칙 — 관리자 건설 프로필에는 넣지 않는다
  const race=G.tech.race, uid=techBldgUnit(race,b.k); if(!uid) return '';
  return _techRealName(race,uid)+' ×'+techBldgCount(race,b.k); }
function _techBldgSummary(b){ const s=_techSpawnText(b), o=_techBldgSummary0(b);
  return s || o; }   // 오토배틀은 배출 정보만 한 줄(관리자는 기존 요약 그대로)
function _techBldgSummary0(b){ if(!b) return '';
  const race=G.tech.race;
  if(typeof TECH_BLDG_DESC!=='undefined' && TECH_BLDG_DESC[b.k]) return TECH_BLDG_DESC[b.k];
  if(b.gas) return '일꾼이 에너지 채취';
  if(b.supply) return '최대 인구 '+b.supply+' 증가';
  if(typeof _techIsDef==='function' && _techIsDef(b.k)) return '적 자동 공격';
  if(b.addonTo) return ((techGetBldg(race,b.addonTo)||{}).name||'')+' 부속';
  return ''; }
// 🏢 건물 설명(롱프레스 팝업) — 요약 문장 + 생산/연구/해금 섹션
function _techBldgDesc(b){ if(!b) return '';
  const race=G.tech.race, out=[], sum=_techBldgSummary(b);
  if(sum) out.push('<div class="tskSecL">'+sum+'</div>');
  { const _mp=techWallet() ? (b.produces||[]).filter(p=>p.id===TECH_WORKER[race]) : (b.produces||[]);   // 🎮 오토배틀만 일꾼으로 축약(전투 유닛은 자동 배출) · 관리자는 생산 전체 표기
    if(_mp.length) out.push(_tskSec('생산', _mp.map(p=>_techRealName(race,p.id)).join(' · '))); }
  if(_techResList(b).length) out.push(_tskSec('연구', _techResList(b).map(r=>r.name).join(' · ')));
  if(b.unlocks&&b.unlocks.length) out.push(_tskSec('해금', b.unlocks.map(id=>_techRealName(race,id)).join(' · ')));
  return out.length?out.join(''):'건물입니다.'; }
// 🚶 유닛 설명(단일 소스) — 역할 + 핵심 스탯 + 고유 능력(spec.abil)
// 유닛 고유 능력 설명(표시용 단일 소스) — spec.abil은 밸런스 메모라 축약·원어가 섞여 있어, 읽히는 문장으로 따로 관리
const TECH_UNIT_ABIL={
  worker_human:'건물 건설 · 수리', marine:'광폭화(체력 소모, 공격·이동 속도↑)', machinegun:'광역 근접 공격 · 광폭화',
  medic:'아군 치유 · 상태이상 해제 · 시야 교란', ghost:'은신 · 기계 무력화 · 핵 유도',
  racer:'지뢰 설치', tank:'고정 모드 시 장거리 광역 포격', goliath:'대공 특화',
  skyguard:'은신', pelican:'유닛 수송', aegis:'탐지 · 보호막 · 마나 소각 · 방사능',
  hellfire:'공중 전용 광역 공격', dreadnought:'단일 대상 강력 포격', nuke:'지정 지점 대규모 폭발',
  worker_swarm:'건물 변태', overlord:'탐지 · 유닛 수송(연구 필요)', snapper:'1회 2기 생산 · 이동·공격 속도 강화',
  hydra:'사거리 강화 · 잠복형으로 변태', wyvern:'공격이 주변으로 튕김', stinger:'1회 2기 생산 · 공중 자폭',
  medusa:'적 시야 공유 · 소환수 생성 · 이동 둔화', ultralisk:'방어 연구 시 추가 방어', defiler:'아군 은폐 · 전염 · 아군 흡수로 마나 회복',
  worker_light:'건물 소환', blade:'이동 속도 강화', dragoon:'사거리 강화',
  high_templar:'번개 폭풍 · 환영 생성 · 합체', dark_templar:'영구 은신 · 합체',
  falcon:'대공 특화 · 이동 속도 강화', skydancer:'공중 광역 공격 · 적 원거리 봉쇄',
  archangel:'요격기 최대 8기 운용', kronos:'아군 은폐 · 소환 · 시간 정지', seraph:'유닛 수송 · 이동 속도 강화',
  observer:'탐지 · 영구 은신', reaver:'스캐럽 최대 10기 장전 · 광역 공격'
};
function _techUnitDesc(uid){ const race=G.tech.race, s=(typeof techUnitSpec==='function'&&techUnitSpec(race,uid))||{}, role=_techRoleOf(uid);
  const bits=[]; if(s.hp) bits.push('체력 '+s.hp); if(s.sh) bits.push('실드 '+s.sh);
  bits.push(s.atk?('공격 '+s.atk):'무공격'); if(s.rng) bits.push('사거리 '+s.rng);
  const out=[], nm=_techRealName(race,uid);
  if(role && role!==nm) out.push('<div class="tskSecL">'+role+'</div>');   // 역할이 이름과 같으면 중복이라 생략(헤더에 이미 이름 표시)
  out.push(_tskSec('능력치', bits.join(' · ')));
  const ab=TECH_UNIT_ABIL[uid]||s.abil;   // 표시용 문장 우선 · 없으면 스펙 메모 폴백
  if(ab) out.push(_tskSec('고유 능력', ab));
  return out.join(''); }
// 📖 카드 롱프레스 설명 — kind: b=건물 · u=유닛(생산) · r=연구. 짧게 탭은 기존 onclick 그대로 동작(길게일 때만 _chipSwallow로 클릭 삼킴)
function _techTipTime(sec){ sec=Math.round(sec||0); return sec>0?(sec+'초'):''; }   // 우상단 소요 시간(즉시건설 토글과 무관하게 원래 스펙 기준)
function _techCardTip(kind, key, bk){ const race=G.tech.race;
  if(kind==='sup'){ const S=STK, me=S&&S.me; if(!me) return null;   // 📦 업그레이드 카드 설명
    const T={ mine:{ n:'광산', d:'웨이브 수입을 늘립니다. 5개를 모두 지으면 건설지가 확장됩니다.' },
      upg:{ n:'강화', d:'전장 유닛의 공격력과 체력을 강화합니다.' },
      bomb:{ n:'특수무기', d:'가장 밀집한 적 무리에 폭탄을 투하합니다.' },
      atk:{ n:'공격력', d:'전장 유닛의 공격력을 올립니다. 이미 나가 있는 유닛에도 적용됩니다.' },
      hp:{ n:'체력', d:'전장 유닛의 최대 체력을 올립니다.' } };
    const t=T[key]; return t? { name:t.n, desc:t.d } : null; }
  if(kind==='b'){ const b=techGetBldg(race,key); if(!b) return null;
    return { name:b.name, time:_techTipTime(((techBldgSpec(race,key)||{}).t||20)*TECH_TIME_MUL), desc:_techBldgDesc(b) }; }
  if(kind==='u'){ return { name:_techRealName(race,key), time:_techTipTime(((techUnitSpec(race,key)||{}).t||15)*TECH_TIME_MUL), desc:_techUnitDesc(key) }; }
  if(kind==='r'){ const b=techGetBldg(race,bk)||{}, r=((b.research||[]).find(x=>x.k===key))||{};
    const lv=G.tech.research[race+'_'+key]||0;
    const _d='<div class="tskSecL">'+(r.desc||'연구')+'</div>'+(r.tier?_tskSec('단계','현재 '+lv+'단계 · 최대 '+r.tier.length+'단계'):'');
    return { name:r.name||key, time:_techTipTime((r.t?r.t:(r.tier?24:30))*TECH_TIME_MUL), desc:_d }; }
  return null; }
let _ctipT=null, _ctipK=null;
function techTipDown(ev, kind, key, bk){ if(ev&&ev.stopPropagation) ev.stopPropagation(); _chipSwallow=false;
  const sig=kind+'|'+key+'|'+(bk||''); _ctipK=sig;
  const el=ev&&ev.currentTarget, r=(el&&el.getBoundingClientRect)?el.getBoundingClientRect():null;   // 앵커 rect 즉시 캡처(리렌더로 카드가 detach돼도 좌표 유지)
  const rect=r?{left:r.left,top:r.top,bottom:r.bottom,width:r.width}:null;
  if(_ctipT) clearTimeout(_ctipT);
  _ctipT=setTimeout(()=>{ _ctipT=null; if(_ctipK===sig){ _chipSwallow=true;   // 길게 = 설명만(뒤따르는 click 삼켜 카드 액션 차단)
    if(typeof playSfx==='function') playSfx('ui_open'); techShowTip(_techCardTip(kind,key,bk), rect); } }, TECH_HOLD_MS); }
function techTipUp(){ if(_ctipT){ clearTimeout(_ctipT); _ctipT=null; } _ctipK=null; techHideSkTip(); }
function _techTipAttr(kind,key,bk){ return ' onpointerdown="techTipDown(event,\''+kind+'\',\''+key+'\''+(bk?(',\''+bk+'\''):'')+')" onpointerup="techTipUp()" onpointerleave="techTipUp()" onpointercancel="techTipUp()" oncontextmenu="return false"'; }
function techHideSkTip(){ const tip=document.getElementById('techSkTip'); if(tip) tip.classList.add('hide'); }
function techSubSelectOne(ev,eid){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;   // 👤 유닛별 HP 행 탭 = 그 1기만 지정(단일 프로필)
  if(!G.tech.ents.some(e=>e.eid===eid)) return;
  G.tech.selU=[eid]; const body=document.getElementById('btSheetBody'); if(body) body._cgPage=0;
  if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); }
// 입력
// 뷰(확대/축소·팬) — 월드좌표(0~1)↔화면좌표 변환 (메인탭 G.view와 동일 규약)
function techView(){ if(!G.tech.view) G.tech.view={x:0.5,y:0.5,zoom:1}; return G.tech.view; }
function techViewT(){ if(!G.tech.viewT){ const v=techView(); G.tech.viewT={x:v.x,y:v.y,zoom:v.zoom}; } return G.tech.viewT; }   // 목표 뷰(핀치가 갱신) — G.view/G.viewT 규약과 동일
function _techViewCSS(){ const v=techView(); return 'translate(50%,50%) scale('+v.zoom.toFixed(4)+') translate('+(-v.x*100).toFixed(3)+'%,'+(-v.y*100).toFixed(3)+'%)'; }   // viewApply(translate W/2,H/2·scale zoom·translate -v.x*W,-v.y*H)의 CSS 등가 — 메인맵 뷰와 동일 규약
function techBX0(){ return TECH_GRID.x0+_techCW()*0.5; }   // 이동 가능 경계 = 건설 가능 구역(격자)과 동일
function techBX1(){ return TECH_GRID.x1-_techCW()*0.5; }
function techBY0(){ return techY0()+_techCH()*0.5; }
function techBY1(){ return techY1()-_techCH()*0.5; }
function techMinZoom(){ if(!techWallet()) return 1;   // 오토배틀: 건설 구역이 화면을 채우도록 축소 한계를 올림(주변 빈 공간 억제)
  const hgt=Math.max(0.05, techY1()-techY0()); return Math.max(1, Math.min(2.15, 1/hgt)); }
function techMaxZoom(){ return techWallet()? 3.1 : 4; }   // 오토배틀: 과확대 억제
function techSheetFrac(){ const sh=document.getElementById('btSheet'); if(!sh||!sh.classList.contains('open')) return 0;   // 열린 하단 시트가 맵을 가리는 비율
  const r=_btRect(); if(!r||!r.height) return 0; const b=sh.getBoundingClientRect(); if(!b.height) return 0;
  return Math.max(0, Math.min(0.6, (r.bottom-b.top)/r.height)); }
function _techClampView(v){ v=v||G.tech.view; if(!v) return; v.zoom=Math.max(techMinZoom(),Math.min(techMaxZoom(),v.zoom));
  if(techWallet()){
    // 이동 한계 = '실제로 보이는 화면'(하단 시트 제외) 기준 + 줌과 무관한 고정 여백(STK_TECH_PAD).
    // 두 갈래(구역>화면 / 구역<화면)로 나누지 않고 min/max로 이어 붙여, 확대·축소해도 규칙이 같게 동작한다.
    const sf=techSheetFrac(), M=STK_TECH_PAD;
    const cl=(a,b,val,hv,off)=>{ const c1=a+hv+off, c2=b-hv+off, lo=Math.min(c1,c2)-M, hi=Math.max(c1,c2)+M; return Math.max(lo, Math.min(hi, val)); };
    v.x=cl(TECH_GRID.x0, TECH_GRID.x1, v.x, 0.5/v.zoom, 0);
    v.y=cl(techY0(), techY1(), v.y, (1-sf)/(2*v.zoom), sf/(2*v.zoom));   // 세로는 시트에 가려진 만큼 보이는 영역만 사용
    return; } const m=(1-1/v.zoom)*0.5; v.x=Math.max(0.5-m,Math.min(0.5+m,v.x)); v.y=Math.max(0.5-m,Math.min(0.5+m,v.y)); }
function techViewTick(dt){ const v=techView(), t=techViewT(); if(v.zoom===t.zoom && v.x===t.x && v.y===t.y) return false;   // 메인맵 nemoViewTick과 동일한 보간(k=min(1,dt*9))
  const k=Math.min(1,dt*9); v.zoom+=(t.zoom-v.zoom)*k; v.x+=(t.x-v.x)*k; v.y+=(t.y-v.y)*k;
  if(Math.abs(v.zoom-t.zoom)<0.003 && Math.abs(v.x-t.x)<0.002 && Math.abs(v.y-t.y)<0.002){ v.zoom=t.zoom; v.x=t.x; v.y=t.y; } return true; }
function _techW2S(wx,wy){ const v=techView(); return { x:(wx-v.x)*v.zoom+0.5, y:(wy-v.y)*v.zoom+0.5 }; }   // 월드→화면
function _techS2W(sx,sy){ const v=techView(); return { x:(sx-0.5)/v.zoom+v.x, y:(sy-0.5)/v.zoom+v.y }; }   // 화면→월드
// 이동 파라미터 = 메인과 동일한 공용 자료 사용: 속도=U.moveSpd×MOVE_MUL · 공중 판정=FXLAB_AIR (별도 표 없음)
function _techEntKey(e){ return (e.type==='worker')?(TECH_WORKER[G.tech.race]||'worker_human'):e.uid; }
function _techBuildBldg(e){ return (e&&e.type==='worker'&&e.build!=null)?G.tech.ents.find(x=>x.eid===e.build&&x.type==='bldg'):null; }   // 일꾼이 짓는 건물(없으면 null)
function _techBuildLocked(e){ const bd=_techBuildBldg(e); return !!(bd&&bd.bt>0&&!bd._bpause); }   // 건설 중(미일시정지) 일꾼 = 이동 잠금
function _techAirOf(e){ return (typeof FXLAB_AIR!=='undefined')&&FXLAB_AIR.has(_techEntKey(e)); }
const _btPtrs=new Map(); let _btPan=null, _btPinch=null, _btBox=null, _btCmd=null, _btMoved=false, _btDown=null, _btArm=false, _btArmOff={x:0,y:0}, _btLongT=null, _btHold=null;
let _btArmPt=null;   // 🎥 배치 고스트를 끄는 동안의 손가락 화면 위치(0..1) — 가장자리 끌기용
// 고스트를 화면 가장자리로 끌고 있으면 뷰를 그쪽으로 민다. HOME 사냥터와 **같은 edgePush()** 를 쓴다.
function techEdgePan(dt){ if(!_btArm||!_btArmPt||!G.tech||!G.tech.arm) return false;
  const e=edgePush(_btArmPt.sx, _btArmPt.sy); if(!e.x && !e.y) return false;
  const t=techViewT(), v=techView();
  const dx=e.x*EDGE_SPD*dt/Math.max(0.001,v.zoom), dy=e.y*EDGE_SPD*dt/Math.max(0.001,v.zoom);
  t.x+=dx; t.y+=dy; _techClampView(t);
  v.x=t.x; v.y=t.y; _techClampView(v);          // 끌고 있는 동안은 즉시 반영(보간을 기다리면 고스트가 손을 놓친다)
  _techArmTo(_btArmPt.sx, _btArmPt.sy); return true; }
function _btRect(){ const m=document.getElementById('cstMain'); return m?m.getBoundingClientRect():null; }
// 충돌 반경 기반 동심원 대형 슬롯(메인 assignFormation과 동일 공식)
function _techRingSlots(list){ const slots=[{dx:0,dy:0}]; if(list.length<=1) return slots;
  const r=(list.reduce((a,e)=>a+((U[_techEntKey(e)]||{}).size||14)*0.62,0)/list.length)*2.2*(typeof TECH_USCALE!=='undefined'?TECH_USCALE:1);   // 대형 슬롯 간격(이동 시 서로 붙지 않게 넉넉히 · ×0.5 축소 반영). 분리 최소간격보다 크게 → 슬롯에 안착(지터 방지)
  let ring=1; while(slots.length<list.length){ const n=Math.floor(Math.PI*2*ring*0.9)||6;
    for(let k=0;k<n&&slots.length<list.length;k++){ const a=(k/n)*Math.PI*2+ring*0.5; slots.push({dx:Math.cos(a)*ring*r, dy:Math.sin(a)*ring*r}); } ring++; }
  return slots; }
function _techAssignMove(wx,wy){ const all=(G.tech.selU||[]).map(id=>G.tech.ents.find(e=>e.eid===id)).filter(e=>e&&(e.type==='unit'||e.type==='worker'));
  all.forEach(e=>{ if(e.type==='worker'&&e._gKind) _techReleaseGather(e); e._rallyOf=null; e._rallySlot=null; e._spawnOf=null; e._spawnSlot=null; e._repairTgt=null; e._repairing=false; e._boardTgt=null; e._nydusTgt=null; });   // 이동 명령 = 채취·수리·탑승·커널이동 취소 + 랠리·소환 슬롯 반환
  const sel=all.filter(e=>!_techBuildLocked(e));   // 건설 중 일꾼은 이동 잠금(일시정지해야 이동 가능)
  if(!sel.length){ if(all.length && !_btMoved && typeof toast==='function') toast('⏸ 건설 중 — 일꾼 프로필의 일시정지 후 이동'); return; }
  const cx=Math.max(techBX0(),Math.min(techBX1(),wx)), cy=Math.max(techBY0(),Math.min(techBY1(),wy));
  const cX=x=>Math.max(techBX0(),Math.min(techBX1(),x)), cY=y=>Math.max(techBY0(),Math.min(techBY1(),y)), GWp=GW||390, GHp=GH||390;
  // 집합 = 메인 assignFormation과 100% 동일: 공중=한 지점 스택(강한 관성으로 자연스럽게 뭉쳤다 퍼짐) / 지상=충돌 반경 동심원 대형
  const air=sel.filter(e=>_techAirOf(e)), ground=sel.filter(e=>!_techAirOf(e));
  air.forEach(e=>{ e.tx=cx; e.ty=cy; e._wp=null; e._rr=0; e._mvStuck=0; e._mvPrevD=null; });
  const gslots=_techRingSlots(ground).map(s=>({x:cX(cx+s.dx/GWp), y:cY(cy+s.dy/GHp), rr:s.dx*s.dx+s.dy*s.dy})).sort((a,b)=>a.rr-b.rr);   // 안쪽 슬롯부터
  const gsorted=ground.slice().sort((a,b)=>(((a.x-cx)*(a.x-cx)+(a.y-cy)*(a.y-cy))-((b.x-cx)*(b.x-cx)+(b.y-cy)*(b.y-cy))));   // 중심에 가까운 유닛부터 → 안쪽 슬롯 배정(군집 가로지르지 않고 안착, 촘촘해도 지터/공전 없음)
  _navExcl=new Set(sel.map(u=>u.eid));   // 같은 명령 그룹은 서로 장애물 아님(순차 배정 중 아직 안 움직인 동료 제외)
  gsorted.forEach((e,i)=>{ const s=gslots[i]; _techRoute(e, s.x, s.y); });
  _navExcl=null; }   // 지상 = 경로 탐색으로 우회 경로 배정 · 효과음은 다운 1회만(드래그 재지정 스팸 방지)
// ── PC 조작(모바일 두 손가락 대체): 휠 = 커서 위치 기준 줌 · 가운데 버튼/Shift+드래그 = 화면 이동 ──
function techWheel(ev){ if(!G.tech || G.tab!=='Build') return; const r=_btRect(); if(!r) return; if(ev.cancelable) ev.preventDefault();
  const sx=(ev.clientX-r.left)/(r.width||1), sy=(ev.clientY-r.top)/(r.height||1), t=techViewT();
  const wx=t.x+(sx-0.5)/t.zoom, wy=t.y+(sy-0.5)/t.zoom;                        // 커서 아래 월드점(줌 전)
  t.zoom=Math.max(techMinZoom(),Math.min(techMaxZoom(), t.zoom*(ev.deltaY>0?0.9:1.1)));
  t.x=wx-(sx-0.5)/t.zoom; t.y=wy-(sy-0.5)/t.zoom;                              // 그 점이 커서에 그대로 머물게 중심 보정
  _techClampView(t); }
function techPanStart(ev){ const r=_btRect(); if(!r) return false; const t=techViewT();
  _btPan={ x:ev.clientX, y:ev.clientY, vx:t.x, vy:t.y, rw:r.width, rh:r.height, zoom:t.zoom }; _btBox=null; _btCmd=null; _btMoved=true; return true; }
function techPanMove(ev){ if(!_btPan) return; const t=techViewT();
  t.x=_btPan.vx-(ev.clientX-_btPan.x)/(_btPan.rw||1)/_btPan.zoom;
  t.y=_btPan.vy-(ev.clientY-_btPan.y)/(_btPan.rh||1)/_btPan.zoom; _techClampView(t); }
function techPtrDown(ev){ if(!G.tech) return; const r=_btRect(); if(!r) return; if(ev.preventDefault)ev.preventDefault();
  if(typeof STK!=='undefined' && STK && STK.supSheet && typeof strikeToggleSupply==='function') strikeToggleSupply(false);   // 업그레이드 시트가 올라와 있으면 맵 탭으로 내린다(전투 화면과 같은 규칙)
  if(ev.button===1 || (ev.shiftKey && ev.pointerType==='mouse')){ _btPtrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY}); techPanStart(ev); return; }   // 마우스 팬(두 손가락 대체)
  _btPtrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  const sx=(ev.clientX-r.left)/(r.width||1), sy=(ev.clientY-r.top)/(r.height||1);
  if(_btPtrs.size>=2){ _btBox=null; _btCmd=null; const p=[..._btPtrs.values()], v=techViewT();   // 두 손가락 = 화면 이동(팬 + 핀치 줌) — 목표 뷰 기준(부드럽게 보간)
    _btPinch={ d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1, zoom:v.zoom, cx:(p[0].x+p[1].x)/2, cy:(p[0].y+p[1].y)/2, vx:v.x, vy:v.y, rw:r.width, rh:r.height }; _btMoved=true; return; }
  _btMoved=false; _btDown={sx, sy}; _btBox=null; _btCmd=null; _btHold=null;
  if(sy<0.13) return;   // 상단바 = 탭만
  if(G.tech.rallySet!=null){   // 🚩 랠리 지정 모드 = 맵 탭으로 랠리 위치 설정
    const rb=G.tech.ents.find(x=>x.eid===G.tech.rallySet&&x.type==='bldg'), w=_techS2W(sx,sy);
    if(rb) rb._rally={ x:Math.max(techBX0(),Math.min(techBX1(),w.x)), y:Math.max(techBY0(),Math.min(techBY1(),w.y)) };
    G.tech.rallySet=null; _btDown=null; if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); return; }   // _btDown=null → techPtrUp이 이 탭을 빈곳탭으로 재처리해 건물 지정 해제·시트 닫는 것 방지(랠리 설정 후 건물 지정 유지)
  if(G.tech.skillArm){ const sa=G.tech.skillArm, su=G.tech.ents.find(x=>x.eid===sa.eid), sk=(typeof SKILLS!=='undefined')&&SKILLS[sa.key];   // 🪄 스킬 무장 = 이번 탭으로 시전
    G.tech.skillArm=null;
    if(su&&sk){ const w=_techS2W(sx,sy);
      if(sk.kind==='target_ground'){ _techSkFire(su,sa.key,w.x,w.y,null); }
      else { const t=_techEntAt(w.x,w.y); if(t&&t.eid!==su.eid&&(t.type==='unit'||t.type==='worker')) _techSkFire(su,sa.key,t.x,t.y,t); else if(typeof toast==='function') toast('대상 유닛을 탭하세요 — 취소됨'); } }
    techUIRender(); return; }
  if(G.tech.arm!=null){   // 배치 중
    if(!G.tech.armXY){ _btArm=true; _btArmOff={x:0,y:0}; _techArmTo(sx, sy); return; }   // 첫 탭 = 그 자리에 예비건물 배치
    // 이미 배치됨 → 예비 실루엣을 눌렀을 때만 잡고 드래그(다른 곳 탭은 무시=텔레포트 안 함)
    const _gs=_techW2S(G.tech.armXY.x,G.tech.armXY.y), _rr=_btRect(), _W=(_rr&&_rr.width)||380, _H=(_rr&&_rr.height)||440;
    const _mk2=(TECH_MODEL[G.tech.race]||{})[G.tech.arm], _sp=(((typeof CST_BLDG_CFG!=='undefined'&&CST_BLDG_CFG[_mk2])||{}).s||46)*techView().zoom;
    const _bx=_gs.x*_W, _by=_gs.y*_H+(CST_YSHIFT+2), _px=sx*_W, _py=sy*_H;   // _by=건물 base 화면 px(yoff 반영)
    if(Math.abs(_px-_bx)<=_sp*0.8 && _py<=_by+_sp*0.45 && _py>=_by-_sp*1.6){   // 실루엣 hit-box(위로 넉넉) 안을 눌렀으면 잡기
      _btArm=true; const _w=_techS2W(sx,sy); _btArmOff={x:_w.x-G.tech.armXY.x, y:_w.y-G.tech.armXY.y}; }
    return; }
  { const _lb=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'&&x._lifted&&(x._liftPhase==='flying'||x._liftPhase==='rising')):null;   // 🛫 비행 중 또는 이륙(상승) 중인 부양 건물 = 맵 탭으로 이동/이동 예약
    if(_lb && (G.tech.selU||[]).length===0){ const w=_techS2W(sx,sy); _btCmd={lift:_lb}; _lb.tx=Math.max(techBX0(),Math.min(techBX1(),w.x)); _lb.ty=Math.max(techBY0(),Math.min(techBY1(),w.y));   // 상승 중이면 tx/ty=이동 예약(다 뜨면 자동 이동), 비행 중이면 즉시 이동
      if(_lb._liftPhase==='rising' && typeof toast==='function') toast('🛫 이륙 후 이동 예약');
      if(typeof playSfx==='function') playSfx('ui_confirm'); techMapRender(); return; } }   // _btCmd 설정 → techPtrUp이 지정 해제 안 함(상승 중 바닥 탭도 해제 방지)
  const selN=(G.tech.selU||[]).length;
  const _immovSel=selN>0 && (G.tech.selU||[]).every(id=>{ const x=G.tech.ents.find(z=>z.eid===id); return x&&(x.type==='larva'||x.type==='egg'); });   // 🐛🥚 라바·알 = 이동 불가
  if(_immovSel) return;   // 이동 명령/박스 지정 안 함 → techPtrUp 탭 선택에 위임(빈 바닥=해제 · 건물/유닛 탭=그 대상 재지정)
  if(selN>0){ const w=_techS2W(sx,sy), e=_techEntAt(w.x,w.y);   // 지정 상태: 드래그/탭 = 이동(메인 규약 — 새 박스는 해제(✕) 후에만)
    if(selN===1 && e && (e.type==='unit'||e.type==='worker'||e.type==='larva') && e.eid!==G.tech.selU[0]) return;   // 단일 지정 → 다른 유닛/라바 탭 = 업에서 재지정
    const _gwk=(G.tech.selU||[]).map(id=>G.tech.ents.find(x=>x.eid===id)).filter(x=>x&&x.type==='worker'&&x.build==null);   // 💎⚡ 자원 채취 지정: 지정된 일꾼 + 미네랄/가스건물 탭 = 채취(이동 대신)
    if(_gwk.length){ const _mn=_techMineralAt(w.x,w.y);
      if(_mn){ _techAssignGatherMineral(_gwk, _mn.eid); if(typeof playSfx==='function') playSfx('ui_confirm'); _btDown=null; techUIRender(); return; }
      if(e && e.type==='bldg' && e.bt<=0 && ((techGetBldg(G.tech.race,e.bk)||{}).gas)){ _techAssignGather(_gwk,'gas',e.eid); if(typeof playSfx==='function') playSfx('ui_confirm'); _btDown=null; techUIRender(); return; }
      const _mainK=((TECH_TREE[G.tech.race].buildings||[])[0]||{}).k;   // 🎒 손에 자원 든 채 본진 탭 = 이동 아니라 그 자원 작업 재개(반납→계속 채취)
      if(e && e.type==='bldg' && e.bt<=0 && e.bk===_mainK){ const _carriers=_gwk.filter(x=>x._carry&&x._cKind); if(_carriers.length && _techResumeCarry(_carriers)){ if(typeof playSfx==='function') playSfx('ui_confirm'); _btDown=null; techUIRender(); return; } } }
    const _hasIdleWk=(G.tech.selU||[]).some(id=>{ const wk=G.tech.ents.find(x=>x.eid===id); return wk&&wk.type==='worker'&&wk.build==null; });
    if(e && e.type==='bldg' && e.bt>0 && e._bpause && _hasIdleWk){ G.tech.sel=e.eid; const _sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null}); _sh.open=true; _sh.sec='ent'; if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); return; }   // 일꾼 지정 상태로 일시정지 건물 탭 = 이동 아니라 재개 대상 지정(일꾼 유지 → ▶ 재개 버튼 표시)
    if(G.tech.sel!=null){ const _cur=G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'); if(_cur){ G.tech.sel=null; const _sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null}); _sh.open=true; _sh.sec='ent'; _btDown=null; techUIRender(); return; } }   // 재개 대상 지정 상태에서 딴 곳/바닥 탭 = 건물 지정만 해제(일꾼 지정·프로필 유지). _btDown=null → techPtrUp이 이 탭을 빈곳탭으로 재처리해 시트 닫는 것 방지
    { const _lpb=_techBldgAt(w.x,w.y);   // 🧱🔧 건물 롱프레스 = 바이오닉 탑승(벙커)/커널 순간이동/일꾼 수리 · 히트범위=선택과 동일(유닛이 위에 있어도 관통)
      if(_lpb){ const _su=(G.tech.selU||[]).map(id=>G.tech.ents.find(z=>z.eid===id)).filter(Boolean);
        const _canBoard=(_lpb.bk==='bunker'&&_lpb.bt<=0&&_su.some(_techBunkerable)), _canRepair=(!_lpb._lifted&&_su.some(x=>x.type==='worker'&&x.build==null));
        const _canNydus=(_lpb.bk==='nydus'&&_lpb.bt<=0&&_lpb._nydusLink!=null&&_su.some(x=>(x.type==='unit'||x.type==='worker')&&!_techAirOf(x)));
        if(_canBoard||_canNydus||_canRepair){ clearTimeout(_btLongT); const _be=_lpb.eid;   // 꾹 누르면 입장 시작 → 손을 건물 위에 유지하면 한 명씩 계속 입장, 떼면 중단
          _btLongT=setTimeout(()=>{ _btLongT=null; if(!_btDown) return; techLongPressBldg(_be); _btHold={eid:_be, board:_canBoard||_canNydus}; }, TECH_HOLD_MS);
          return; } } }   // 건물 위 손 유지 = 입장 모드 → 이동-추종(_btCmd) 안 함 = 입장 명령이 취소되지 않음
    _btCmd={}; _techAssignMove(w.x,w.y); if(typeof playSfx==='function') playSfx('ui_confirm'); return; }
  _btBox={sx0:sx, sy0:sy, sx1:sx, sy1:sy, active:false, rw:r.width, rh:r.height}; }   // 무지정 = 한 손가락 드래그로 유닛 지정 박스
function techPtrMove(ev){ if(!G.tech||G.tab!=='Build'||!_btPtrs.has(ev.pointerId)) return; _btPtrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(_btPan){ techPanMove(ev); return; }
  if(_btLongT && _btDown){ const r=_btRect(); if(r){ const mx=(ev.clientX-r.left)/(r.width||1), my=(ev.clientY-r.top)/(r.height||1); if(Math.hypot(mx-_btDown.sx,my-_btDown.sy)>0.05){ clearTimeout(_btLongT); _btLongT=null; } } }   // 🧱 크게 드래그 = 롱프레스 취소(손가락 미세 흔들림은 허용)
  if(_btPinch && _btPtrs.size>=2){ const p=[..._btPtrs.values()], d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y), z=Math.max(techMinZoom(),Math.min(techMaxZoom(),_btPinch.zoom*d/_btPinch.d)), t=techViewT(); t.zoom=z;   // 목표 뷰만 갱신 → techViewTick이 부드럽게 따라감
    const cx=(p[0].x+p[1].x)/2, cy=(p[0].y+p[1].y)/2; t.x=_btPinch.vx-(cx-_btPinch.cx)/(_btPinch.rw||1)/z; t.y=_btPinch.vy-(cy-_btPinch.cy)/(_btPinch.rh||1)/z; _techClampView(t); _btMoved=true; return; }
  if(_btArm){ const r=_btRect(); if(!r) return;
    _btArmPt={ sx:(ev.clientX-r.left)/(r.width||1), sy:(ev.clientY-r.top)/(r.height||1) };   // 🎥 가장자리 끌기가 쓸 마지막 손가락 위치
    _techArmTo(_btArmPt.sx, _btArmPt.sy); _btMoved=true; return; }   // 배치 고스트가 손가락을 따라 이동
  if(_btCmd){ const r=_btRect(); if(!r) return; const w=_techS2W((ev.clientX-r.left)/(r.width||1),(ev.clientY-r.top)/(r.height||1));
    if(_btCmd.lift){ _btCmd.lift.tx=Math.max(techBX0(),Math.min(techBX1(),w.x)); _btCmd.lift.ty=Math.max(techBY0(),Math.min(techBY1(),w.y)); _btMoved=true; techMapRender(); return; }   // 🛫 부양 건물이 손가락 따라 이동
    _techAssignMove(w.x,w.y); _btMoved=true; return; }   // 지정 유닛이 손가락을 따라 이동
  if(_btBox){ const r=_btRect(); if(!r) return; const sx=(ev.clientX-r.left)/(r.width||1), sy=(ev.clientY-r.top)/(r.height||1); _btBox.sx1=sx; _btBox.sy1=sy;
    if(!_btBox.active && (Math.abs(sx-_btBox.sx0)*(r.width||1)+Math.abs(sy-_btBox.sy0)*(r.height||1))>6) _btBox.active=true;
    if(_btBox.active){ _btMoved=true; techMapRender(); } } }
function techPtrUp(ev){ if(!G.tech) return; clearTimeout(_btLongT); _btLongT=null;
  if(_btPan){ _btPan=null; _btPtrs.delete(ev.pointerId); return; }   // 🧱 손 떼면 롱프레스 취소(짧게=이동만)
  const had=_btPtrs.has(ev.pointerId); _btPtrs.delete(ev.pointerId); if(_btPtrs.size<2) _btPinch=null;
  if(_btPtrs.size>0) return; const box=_btBox, cmd=_btCmd, down=_btDown, moved=_btMoved, armDrag=_btArm, hold=_btHold; _btBox=null; _btCmd=null; _btDown=null; _btMoved=false; _btArm=false; _btArmPt=null; _btHold=null;
  const body=document.getElementById('btSheetBody'), sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null});
  if(hold){ if(hold.board) for(const id of (G.tech.selU||[])){ const u=G.tech.ents.find(e=>e.eid===id); if(u){ if(u._boardTgt!=null){ u._boardTgt=null; u.tx=null; u.ty=null; u._wp=null; } if(u._nydusTgt!=null){ u._nydusTgt=null; u.tx=null; u.ty=null; u._wp=null; } } }   // 손 뗌 = 아직 안 들어간 유닛 입장 중단(수리는 계속)
    techMapRender(); return; }
  if(armDrag||G.tech.arm){ techMapRender(); return; }   // 배치 중: 탭/드래그로 고스트만 이동, 배치는 ✓ 버튼으로만
  if(cmd){ techMapRender(); return; }   // 이동 명령 완료(다운/드래그에서 이미 목표 지정)
  if(box && box.active){   // 박스 드래그 완료 → 안의 유닛/일꾼 지정 + 유닛 시트 열기
    const x0=Math.min(box.sx0,box.sx1),y0=Math.min(box.sy0,box.sy1),x1=Math.max(box.sx0,box.sx1),y1=Math.max(box.sy0,box.sy1);
    if((x1-x0>0.015||y1-y0>0.015)){ const w0=_techS2W(x0,y0), w1=_techS2W(x1,y1);
      G.tech.selU=G.tech.ents.filter(e=>(e.type==='unit'||e.type==='worker'||e.type==='larva'||e.type==='egg')&&e.x>=w0.x&&e.x<=w1.x&&e.y>=w0.y&&e.y<=w1.y).map(e=>e.eid);   // 🐛🥚 라바·알도 드래그 박스로 지정(이동은 불가)
      G.tech.sel=null; G.tech.selRes=null; if(G.tech.selU.length){ sh.open=true; sh.sec='ent'; } if(body) body._cgPage=0; }
    techUIRender(); return; }
  if(!had||moved||!down||G.tab!=='Build'||down.sy<0.13) return;   // 핀치/드래그/상단바 = 탭 아님
  const w=_techS2W(down.sx, down.sy);
  const e=_techEntAt(w.x, w.y);
  if(e){ G.tech.selRes=null; if(e.type==='bldg'){
      const _keepWk=(e.bt>0&&e._bpause&&(G.tech.selU||[]).some(id=>{ const w=G.tech.ents.find(x=>x.eid===id); return w&&w.type==='worker'&&w.build==null; }));   // 일시정지 건물 + 유휴 일꾼 지정 = 그 일꾼 지정 유지(재개 시 사용)
      const _movU=(G.tech.selU||[]).some(id=>{ const u=G.tech.ents.find(x=>x.eid===id); return u&&(u.type==='unit'||u.type==='worker'); });   // 🏗 이동 가능 유닛 지정 중 = 건물 짧게 탭 = 그 지점으로 이동(건물 지정 안 함 · 롱프레스 탑승/수리는 별도) → 건물 지정은 유닛 해제(✕) 후에만
      if(_movU && !_keepWk){ _techAssignMove(w.x,w.y); if(typeof playSfx==='function') playSfx('ui_confirm'); if(body) body._cgPage=0; techMapRender(); return; }
      G.tech.sel=e.eid; if(!_keepWk) G.tech.selU=[]; }
    else { G.tech.selU=[e.eid]; G.tech.sel=null; } sh.open=true; sh.sec='ent'; }   // 엔티티 탭 = 시트 즉시 교체(닫혔다 열리지 않음)
  else { const _mn=_techMineralAt(w.x,w.y), _gz=_techInGasZone(w.x,w.y);   // 💎⛽ 빈 곳 탭 = 중립 자원(미네랄·가스 광산) 지정(단 하나만). 자원 없으면 시트 닫기
    if(_mn){ G.tech.selRes={kind:'mineral',eid:_mn.eid}; G.tech.sel=null; G.tech.selU=[]; sh.open=true; sh.sec='ent'; }
    else if(_gz){ G.tech.selRes={kind:'gas'}; G.tech.sel=null; G.tech.selU=[]; sh.open=true; sh.sec='ent'; }
    else { G.tech.sel=null; G.tech.selRes=null; G.tech.selU=[]; sh.open=false; } }   // 빈 바닥 탭 = 전부 해제(라바·알 이동불가 지정도 여기서 해제)
  if(body) body._cgPage=0; techUIRender(); }
// 전역 pointer 리스너 — 건설 탭에서만 동작(다른 화면 터치 무영향), passive(techPtrMove는 preventDefault 안 함 → 모바일 탭 신뢰도 유지)
function _inBuildPtr(){ return typeof G!=='undefined' && G.tech && G.tab==='Build'; }
if(typeof document!=='undefined'){ document.addEventListener('pointermove', function(e){ if(_inBuildPtr()&&typeof techPtrMove==='function') techPtrMove(e); }, {passive:true});
  document.addEventListener('pointerup', function(e){ if(_inBuildPtr()&&typeof techPtrUp==='function') techPtrUp(e); });
  document.addEventListener('pointercancel', function(e){ if(_inBuildPtr()&&typeof techPtrUp==='function') techPtrUp(e); }); }
// ── 그리드 배치: 배치 영역(0.06~0.94 × 0.18~0.94)을 20×20 정사각(픽셀) 셀로 나눔. 건물은 size[w,h]만큼 셀 점유 ──
const TECH_SPD_MUL=0.6;   // 건설지 유닛 이동 속도 배율(1=기존). 화면 종횡비 보정과 함께 적용
const TECH_GRID={ cols:20, x0:0.06, y0:0.18, x1:0.94, y1:0.94 };
function techCols(){ return techWallet()? STK_TECH_COLS : TECH_GRID.cols; }   // 건설 그리드 칸 수 — 오토배틀은 보드처럼 더 넓게(맵별)
function techExtOpen(){ const w=techWallet(); return !!(w && (w.mines||0)>=STK_MINE_CAP); }   // 광산 최대 보유 → 건설지 확장 개방
function techY0(){ return techWallet()? STK_TECH_TOP : TECH_GRID.y0; }                          // 건설 가능 구역 위 경계(오토배틀)
function techY1(){ return techWallet()? (STK_TECH_TOP+STK_TECH_ROWS*(1+(techExtOpen()?STK_TECH_EXT:0))*_techCH()) : TECH_GRID.y1; }   // 아래 경계 = 행 수로 산출 · 밖은 진입 불가 구역
function _techCW(){ return (TECH_GRID.x1-TECH_GRID.x0)/techCols(); }   // 셀 폭(월드 x비율)
function _techGA(){ const r=_btRect(); return (r&&r.width&&r.height)?(r.width/r.height):0.563; }   // 맵 종횡비(W/H)
function _techCH(){ return _techCW()*_techGA(); }   // 셀 높이(월드 y비율) — 픽셀상 정사각이 되도록 종횡비 보정
function _techRows(){ return Math.max(1, Math.floor((techY1()-techY0())/_techCH())); }   // 세로 셀 수(동적)
function _techFoot(race,bk){ const sp=(typeof techBldgSpec==='function')?techBldgSpec(race,bk):null; const s=(sp&&sp.size)||[2,2]; return { w:Math.max(1,s[0]|0), h:Math.max(1,s[1]|0) }; }   // size 없으면(부속) 2x2
// 중심(x,y)+footprint(w,h) → 그리드 스냅: top-left 셀(c0,r0) + 스냅된 중심 월드(cx,cy)
function _techSnap(x,y,w,h){ const cw=_techCW(), ch=_techCH(), rows=_techRows();
  let c0=Math.round((x-TECH_GRID.x0)/cw - w/2); c0=Math.max(0,Math.min(techCols()-w, c0));
  let r0=Math.round((y-techY0())/ch - h/2); r0=Math.max(0,Math.min(Math.max(0,rows-h), r0));
  return { c0, r0, w, h, cx:TECH_GRID.x0+(c0+w/2)*cw, cy:techY0()+(r0+h/2)*ch }; }
function _techEntFoot(e){ const f=_techFoot(G.tech.race,e.bk); return _techSnap(e.x, e.y, f.w, f.h); }   // 기존 건물 점유 셀(중심 역산)
// 건설을 막는 유닛 = 유휴 일꾼(build==null) + 지상 유닛(공중 제외). 작업중인 일꾼, 그리고 내가 지정한(건설할) 일꾼은 통과
function _techBlocksBuild(e){ if(e.type==='worker'){ if(e.build!=null) return false; if((G.tech.selU||[]).indexOf(e.eid)>=0) return false; return true; } if(e.type==='unit') return !_techAirOf(e); return false; }
function _techFootBlockCells(s){ const cw=_techCW(), ch=_techCH(), out=[];   // 발판 셀 안에 걸친 차단 유닛의 점유 셀 목록
  for(const e of G.tech.ents){ if(!_techBlocksBuild(e)) continue;
    const cu=Math.floor((e.x-TECH_GRID.x0)/cw), ru=Math.floor((e.y-techY0())/ch);
    if(cu>=s.c0 && cu<s.c0+s.w && ru>=s.r0 && ru<s.r0+s.h) out.push({c:cu,r:ru}); }
  return out; }
// ⛽ 가스 광산 구역(맵 고정 지형, 건설 격자 오른쪽 위 구석 4x2) — 가스 건물(리파이너리 등)은 이 위에만, 일반 건물은 침범 불가
const TECH_GAS={ c0:TECH_GRID.cols-4, r0:0, w:4, h:2 };
// 🔵 파일런 동력장(사이오닉 매트릭스, 에테리얼 전용) — 파일런 중심 타원. 넥서스·어시밀레이터·파일런 외 모든 건물은 동력장 안에만 소환 가능
// 동력장 반경(셀, 파일런 중심 기준) — 가이드: 전체 8x6타일 → 중심 반경 4x3. 비대칭(우/하 판정이 미세하게 김)
const TECH_PYLON_RX=4.0, TECH_PYLON_RY=3.0, TECH_ASYM=0.4;   // TECH_ASYM=오른쪽·아래로 더 뻗는 양(셀)
// 비대칭 타원 판정: 오른쪽/아래(양의 방향)는 반경 +TECH_ASYM
function _techInEllip(x,y,cx,cy,rx,ry,cw,ch){ const _rx=(x>=cx?rx+TECH_ASYM:rx), _ry=(y>=cy?ry+TECH_ASYM:ry); const dx=(x-cx)/(_rx*cw), dy=(y-cy)/(_ry*ch); return dx*dx+dy*dy<=1; }
function _techNeedsPower(bk){ return G.tech.race==='aetherial' && bk!=='nexus' && bk!=='pylon' && bk!=='assimilator'; }
function _techPylons(){ const out=[]; if(G.tech.race!=='aetherial') return out; for(const e of G.tech.ents){ if(e.type==='bldg'&&e.bk==='pylon'&&e.bt<=0) out.push(e); } return out; }   // 완성 파일런만 동력 공급
function _techPowered(x,y){ if(G.tech.race!=='aetherial') return true; const cw=_techCW(), ch=_techCH();
  for(const p of _techPylons()){ if(_techInEllip(x,y,p.x,p.y,TECH_PYLON_RX,TECH_PYLON_RY,cw,ch)) return true; } return false; }
// 🟣 크립(스웜 전용 지형) — 해처리·레어·하이브(대) / 크립·성큰·스포어 콜로니(소) 주변 점막. 해처리·익스트랙터 외 모든 스웜 건물은 크립 위에만 건설 가능
const TECH_CREEP_SRC={ hatchery:[6.0,5.5], lair:[6.0,5.5], hive:[6.0,5.5], creep:[4.0,4.0], sunken:[4.0,4.0], spore:[4.0,4.0] };   // 최종 반경(셀) — 해처리류 12×11타일(발판4×3+사방4) / 콜로니 8×8타일(발판2×2+사방3)
const TECH_CREEP_EXT={ hatchery:4, lair:4, hive:4, creep:3, sunken:3, spore:3 };   // 건물 외곽선 기준 사방 확장 타일 수(=성장 단계). 처음엔 건물만, 1타일씩 뚝뚝 확장
const TECH_CREEP_GROW_T=16;   // 초 — 최종 확장까지(초반 빠르고 후반 적당: 2u-u² 이즈아웃)
function _techCreepStep(cs){ const ext=TECH_CREEP_EXT[cs.bk]||0; if(!ext) return 0; const u=Math.max(0,Math.min(1,(cs._crAge||0)/TECH_CREEP_GROW_T)); return Math.round(ext*(2*u-u*u)); }   // 지금까지 뻗은 타일 수(정수 단계 — 뚝뚝 점프)
function _techCreepR(cs){ const fin=TECH_CREEP_SRC[cs.bk]||[0,0], ext=TECH_CREEP_EXT[cs.bk]||0; if(!ext) return fin; const k=_techCreepStep(cs); return [fin[0]-ext+k, fin[1]-ext+k]; }   // 반경 = 최종−미확장분 + 현재단계(1타일=1셀 단위 점프, k=0이면 건물 발판만)
function _techNeedsCreep(bk){ return G.tech.race==='swarm' && bk!=='hatchery' && bk!=='extractor'; }
function _techCreepSrcs(){ const out=[]; if(G.tech.race!=='swarm') return out; for(const e of G.tech.ents){ if(e.type==='bldg'&&e.bt<=0&&TECH_CREEP_SRC[e.bk]) out.push(e); } return out; }   // 완성 건물만 점막 유지
function _techOnCreep(x,y){ if(G.tech.race!=='swarm') return true; const cw=_techCW(), ch=_techCH();
  for(const cs of _techCreepSrcs()){ const r=_techCreepR(cs); if(_techInEllip(x,y,cs.x,cs.y,r[0],r[1],cw,ch)) return true; } return false; }
// 🧬 2차 변태(스웜): 기존 유닛 → 고치(알) → 고급 유닛. dpop=인구 증가분
// 건물별 설명 오버라이드(단일 소스) — 자동 생성으로는 부정확·불충분한 건물만 명시. 생산/연구/해금 목록은 팝업이 섹션으로 따로 붙임
const TECH_BLDG_DESC={
  // ── 유니온 ──
  bunker:'유닛 4기 탑승 · 태운 유닛이 대신 공격',
  turret:'공중 자동 공격 · 탐지',
  comsat:'본부 부속 · 스캐너 스윕(지점 시야·탐지)',
  nuke:'본부 부속 · 핵미사일 1발 보관',
  barracks:'보병 생산',
  factory:'기계·차량 생산',
  starport:'공중 유닛 생산',
  academy:'보병 능력·스킬 연구',
  engbay:'보병 공격·방어 강화',
  armory:'기계·공중 공격·방어 강화',
  machshop:'기갑 공장 부속 · 차량 기술 연구',
  control:'비행장 부속 · 공중 기술 연구',
  scifac:'상위 기술 연구 · 부속 부착',
  covert:'연구소 부속 · 은신·핵 기술 연구',
  physics:'연구소 부속 · 대형 공중 화력 연구',
  // ── 스웜 ──
  sunken:'지상 자동 공격',
  spore:'공중 자동 공격 · 탐지',
  creep:'점막 확장 · 방어 건물로 진화',
  nydus:'두 지점 연결 · 유닛 즉시 이동',
  hatchery:'본진 · 라바 생성',
  lair:'부화장 발전 · 상위 기술',
  hive:'소굴 발전 · 최상위 기술',
  pool:'기본 지상 유닛 해금',
  evochamber:'지상 공격·방어 강화',
  hydraden:'원거리 지상 유닛 해금',
  spire:'공중 유닛 해금 · 공중 강화',
  gspire:'첨탑 발전 · 최상위 공중 해금',
  queensnest:'여왕 계열 해금',
  defilermound:'오염 계열 해금',
  ultracavern:'대형 돌격 유닛 해금',
  // ── 에테리얼 ──
  cannon:'지상·공중 자동 공격 · 탐지 · 동력장 필요',
  pylon:'동력장 생성 · 최대 인구 8 증가',
  battery:'주변 아군 실드 충전',
  gateway:'지상 유닛 소환',
  stargate:'공중 유닛 소환',
  robo:'로봇 유닛 소환',
  forge:'지상 공격·방어 강화',
  cyber:'공중 강화 · 상위 기술 연구',
  citadel:'근접 강화 · 상위 건물 해금',
  archives:'주문 유닛 스킬 연구',
  robobay:'로봇 유닛 강화',
  observatory:'정찰·탐지 능력 연구',
  fleet:'대형 공중 능력 연구',
  tribunal:'상위 공중 지원 연구'
};
const TECH_MORPH={ hydra:[{to:'thornqueen', name:'베놈퀸', m:50, g:100, dpop:1, needR:'lurker'}],
  wyvern:[{to:'venom', name:'베놈', m:50, g:150, dpop:0, needB:'defilermound'},
          {to:'behemoth', name:'베히모스', m:50, g:100, dpop:0, needB:'gspire'}],
  // 🔮 에테리얼 진화(합체) — 프로토스=알 없이 그 자리에서 즉시 변태. 하이세이지→보이드(아칸) · 다크세이지→다크보이드(다크아칸)
  high_templar:[{to:'archon', name:'보이드', m:0, g:0, dpop:0}],
  dark_templar:[{to:'dark_archon', name:'다크보이드', m:0, g:0, dpop:0}] };
function _techMorphOK(m){ if(m.needR && !G.tech.research['swarm_'+m.needR]) return {ok:false, why:'연구 필요: '+m.needR}; 
  if(m.needB && !(G.tech.built[m.needB]>0)) return {ok:false, why:(techGetBldg('swarm',m.needB)||{}).name+' 필요'}; return {ok:true}; }
function _techGasOverlap(s){ return s.c0<TECH_GAS.c0+TECH_GAS.w && s.c0+s.w>TECH_GAS.c0 && s.r0<TECH_GAS.r0+TECH_GAS.h && s.r0+s.h>TECH_GAS.r0; }
// 배치 유효성: footprint 셀이 다른 건물과 안 겹치고, 발판 위에 차단 유닛(유휴 일꾼·지상 유닛)이 없으면 OK. 가스 건물=광산 위 정확히, 일반 건물=광산 침범 불가
function _techFootUnexplored(s){ if(!techFogEnabled()) return false; const cw=_techCW(), ch=_techCH();   // 🌫️ footprint 셀 중 하나라도 완전 암흑(미탐색)이면 true → 건설 불가(스타1: 암흑엔 못 지음)
  for(let r=s.r0;r<s.r0+s.h;r++){ for(let c=s.c0;c<s.c0+s.w;c++){
    if(techFogVisAt(TECH_GRID.x0+(c+0.5)*cw, techY0()+(r+0.5)*ch)===0) return true; } }
  return false; }
function techArmValid(x,y){ if(!G.tech||!G.tech.arm) return false; const f=_techFoot(G.tech.race,G.tech.arm), s=_techSnap(x,y,f.w,f.h);
  const _b=techGetBldg(G.tech.race,G.tech.arm);
  if(_techFootUnexplored(s)) return false;   // 🌫️ 완전 암흑(미탐색) 구역 = 건설 불가(정찰 강제 — 커서로 지형 파악 꼼수 차단)
  if(_b&&_b.gas){ if(!(s.c0===TECH_GAS.c0 && s.r0===TECH_GAS.r0)) return false; }   // 가스 건물 = 가스 광산 위에 정확히 겹칠 때만
  else if(_techGasOverlap(s)) return false;   // 일반 건물 = 가스 광산 칸 침범 불가(광산 예약)
  if(_techNeedsPower(G.tech.arm) && !_techPowered(s.cx,s.cy)) return false;   // 🔵 에테리얼 = 파일런 동력장 안에만 소환
  if(_techNeedsCreep(G.tech.arm) && !_techOnCreep(s.cx,s.cy)) return false;   // 🟣 스웜 = 크립 위에만 건설
  for(const e of G.tech.ents){ if(e.type!=='bldg'||e._lifted) continue; const ef=_techEntFoot(e);   // 🛫 부양 건물 자리는 비어있음(그 위/자리에 건설·착륙 가능)
    if(s.c0<ef.c0+ef.w && s.c0+s.w>ef.c0 && s.r0<ef.r0+ef.h && s.r0+s.h>ef.r0) return false; }   // 셀 AABB 교차
  if(_techFootBlockCells(s).length) return false;   // 유휴 일꾼/지상 유닛이 발판을 차지 → 건설 불가
  return true; }
function _techArmTo(sx,sy){ if(!G.tech||!G.tech.arm) return; const w=_techS2W(sx,sy); const ox=(_btArmOff&&_btArmOff.x)||0, oy=(_btArmOff&&_btArmOff.y)||0;
  const f=_techFoot(G.tech.race,G.tech.arm), s=_techSnap(w.x-ox, w.y-oy, f.w, f.h);
  G.tech.armXY={ x:s.cx, y:s.cy }; techMapRender(); }   // 손가락 위치 → 그리드 셀에 스냅
function techConfirmPlace(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||!G.tech.arm||!G.tech.armXY) return;
  if(!techArmValid(G.tech.armXY.x,G.tech.armXY.y)){ const _b=techGetBldg(G.tech.race,G.tech.arm), _s=_techSnap(G.tech.armXY.x,G.tech.armXY.y,(_techFoot(G.tech.race,G.tech.arm)||{w:2,h:2}).w,(_techFoot(G.tech.race,G.tech.arm)||{w:2,h:2}).h);
    if(typeof toast==='function') toast(_techFootUnexplored(_s)?'⛔ 암흑 구역 — 유닛으로 정찰 후':((_b&&_b.gas)?'⛔ 가스 광산 위에만':((_techNeedsPower(G.tech.arm)&&!_techPowered(_s.cx,_s.cy))?'⛔ 파일런 동력장 안에만':((_techNeedsCreep(G.tech.arm)&&!_techOnCreep(_s.cx,_s.cy))?'⛔ 크립 위에만':(G.tech.armLand!=null?'⛔ 착륙 불가 — 빈 평지 필요':'해당 지역에는 건설할 수 없습니다.'))))); return; }   // 유닛·건물이 자리를 차지
  if(G.tech.armLand!=null){   // 🛬 착륙 위치 확정 — 그 지점으로 이동 후 하강(즉시 착지 아님)
    const le=G.tech.ents.find(x=>x.eid===G.tech.armLand&&x.type==='bldg'), p=G.tech.armXY;
    if(le){ le._landXY={ x:p.x, y:p.y }; le._liftPhase='toland'; le.tx=null; le.ty=null; }
    G.tech.arm=null; G.tech.armLand=null; G.tech.armXY=null; if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); return; }
  const p=G.tech.armXY; techPlace(p.x, p.y); }   // techPlace가 arm/armXY 정리
function techCancelArm(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return; G.tech.arm=null; G.tech.armXY=null; G.tech.armLand=null;
  const sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null}); sh.open=true; sh.sec='ent'; if(typeof playSfx==='function') playSfx('ui_back'); techUIRender(); }
function techArm(bk){ const race=G.tech.race, b=techGetBldg(race,bk); if(!b) return;
  if(b.addonTo && !(G.tech.built[b.addonTo]>0)){ if(typeof toast==='function') toast('⛔ '+((techGetBldg(race,b.addonTo)||{}).name)+' 먼저 건설'); return; }
  if(!_techReqMet(b.req)){ if(typeof toast==='function') toast('⛔ 선행: '+(b.req||[]).map(r=>(techGetBldg(race,r)||{}).name).join(', ')); return; }
  if(_techFailRes(b.m,b.g)) return;
  if(b.addonTo){ techDockAddon(b); return; }   // 애드온 = 스타1식 자동 도킹(본체 오른쪽 하단 부착, 자유 배치 없음)
  G.tech.arm=(G.tech.arm===bk)?null:bk;
  G.tech.armXY=null;   // 예비 건물은 카드 탭이 아니라 '맵을 탭한 위치'에 등장(그 후 드래그로 조정)
  if(G.tech.arm && b.gas){ const cw=_techCW(), ch=_techCH();   // ⛽ 가스 건물 = 유일한 유효 위치(가스 광산)에 고스트 바로 표시
    G.tech.armXY={ x:TECH_GRID.x0+(TECH_GAS.c0+TECH_GAS.w/2)*cw, y:techY0()+(TECH_GAS.r0+TECH_GAS.h/2)*ch }; }
  const sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null}); sh.open=(G.tech.arm==null); if(G.tech.arm==null) sh.sec='ent';   // 배치 중 = 시트 내려 맵 확보, 취소 = 일꾼 건설 시트로 복귀
  techUIRender(); }
// 🔗 애드온 자동 도킹(스타1): 완성된 본체 중 애드온이 없는 것을 찾아 오른쪽·하단 정렬로 즉시 부착. 본체가 직접 건설(일꾼 불필요) — 본체-애드온 사이는 심시티 판정상 완전 밀봉
function techDockAddon(b, preferEid){ const race=G.tech.race, cw=_techCW(), ch=_techCH(), rows=_techRows(), f2=_techFoot(race,b.k);
  let parent=null, dock=null;
  const _cand=G.tech.ents.filter(p=>p.type==='bldg'&&p.bk===b.addonTo&&p.bt<=0&&!p._addonEid).sort((a,c)=>((a.eid===preferEid)?-1:0)-((c.eid===preferEid)?-1:0));   // 선택된 본체 우선
  for(const p of _cand){ if(p.type!=='bldg'||p.bk!==b.addonTo||p.bt>0||p._addonEid) continue;   // 완성 본체 + 애드온 미부착
    const pf=_techEntFoot(p), c0=pf.c0+pf.w, r0=pf.r0+pf.h-f2.h;   // 본체 바로 오른쪽·하단 정렬(스타1 규칙)
    if(c0+f2.w>techCols()||r0<0||r0+f2.h>rows) continue;   // 격자 밖
    const s={c0,r0,w:f2.w,h:f2.h}; let clash=false;
    for(const o of G.tech.ents){ if(o.type!=='bldg') continue; const of2=_techEntFoot(o);
      if(s.c0<of2.c0+of2.w && s.c0+s.w>of2.c0 && s.r0<of2.r0+of2.h && s.r0+s.h>of2.r0){ clash=true; break; } }   // 다른 건물과 겹침
    if(clash) continue;
    if(_techFootBlockCells(s).length) continue;   // 유닛(유휴 일꾼·지상)이 자리 점유
    parent=p; dock=s; break; }
  if(!parent){ if(typeof toast==='function') toast('⛔ 부착할 자리가 없음 — 본체 오른쪽 하단을 비워주세요'); return; }
  _techSpend(b.m,b.g);
  const bt=_techBuildTime(race,b.k);
  const ne={eid:G.tech.eseq++, type:'bldg', bk:b.k, x:TECH_GRID.x0+(dock.c0+dock.w/2)*cw, y:techY0()+(dock.r0+dock.h/2)*ch, bt:bt, btMax:bt, waiting:false, _dockOf:parent.eid};
  G.tech.ents.push(ne); parent._addonEid=ne.eid;   // 본체당 애드온 1개(스타1)
  if(bt<=0) techFinishBuild(ne);
  G.tech.arm=null; G.tech.armXY=null; const sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null}); sh.open=true; sh.sec='ent';
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
function techPlace(x,y){ if(G.tech&&G.tech.armNydusExit!=null){ _techPlaceNydusExit(x,y); return; }   // 🕳 나이더스 출구(무료·즉시·크립)
  const race=G.tech.race, b=techGetBldg(race,G.tech.arm); if(!b){ G.tech.arm=null; techUIRender(); return; }
  if(_techFailRes(b.m,b.g)){ G.tech.arm=null; techUIRender(); return; }   // 크레딧/에너지 중 무엇이 부족한지 안내
  if((b.addonTo&&!(G.tech.built[b.addonTo]>0))||!_techReqMet(b.req)){ if(typeof toast==='function') toast('⛔ 건설 불가'); G.tech.arm=null; techUIRender(); return; }
  const _pf=_techFoot(race,b.k), _ps=_techSnap(x,y,_pf.w,_pf.h), bx=_ps.cx, by=_ps.cy, bt=_techBuildTime(race,b.k);   // 그리드 셀에 스냅해 배치
  const _preAllIds=(G.tech.selU||[]).slice();   // 배치 전 지정 전체(건설 일꾼만 빼고 나머지 유닛은 지정 유지)
  let wk=null;
  if(bt>0){   // 노쿨이 아니면 일꾼이 걸어가서 건설 — 선택된 일꾼 우선, 없으면 가장 가까운 유휴 일꾼
    const sels=(G.tech.selU||[]).map(id=>G.tech.ents.find(e=>e.eid===id)).filter(e=>e&&e.type==='worker'&&e.build==null);
    if(sels.length){ let bd=1e9; for(const e of sels){ const d=(e.x-bx)*(e.x-bx)+(e.y-by)*(e.y-by); if(d<bd){ bd=d; wk=e; } } }   // 지정 일꾼 중 건설지에 가장 가까운 일꾼이 건설
    if(!wk){ let bd=1e9; for(const e of G.tech.ents){ if(e.type==='worker'&&e.build==null){ const d=(e.x-bx)*(e.x-bx)+(e.y-by)*(e.y-by); if(d<bd){ bd=d; wk=e; } } } }
    if(!wk){ if(typeof toast==='function') toast('⛔ 건설할 일꾼이 없음'); G.tech.arm=null; techUIRender(); return; }
  }
  _techSpend(b.m,b.g);
  const ne={eid:G.tech.eseq++, type:'bldg', bk:b.k, x:bx, y:by, bt:bt, btMax:bt, waiting:(bt>0&&!!wk)};
  G.tech.ents.push(ne);
  if(bt<=0){ techFinishBuild(ne); }   // 즉시(노쿨) 완성
  else if(wk){ wk.build=ne.eid; _techRoute(wk, Math.max(techBX0(),Math.min(techBX1(),bx)), Math.max(techBY0(),Math.min(techBY1(),by+0.05))); }   // 일꾼 → 건설지까지 우회 경로로 이동
  G.tech.arm=null; G.tech.armXY=null; const sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null}); sh.open=true; sh.sec='ent';
  if(wk){ const rest=_preAllIds.filter(id=>id!==wk.eid); G.tech.sel=null; G.tech.selType=null; G.tech.selU=rest.length?rest:[wk.eid]; }   // 🔨 건설 일꾼만 지정에서 빠지고 나머지 유닛(마린 등)은 지정 유지 — 혼자면 그 일꾼 유지
  else if(_preAllIds.length){ G.tech.sel=null; G.tech.selType=null; G.tech.selU=_preAllIds.slice(); }   // 노쿨(즉시건설): 지정했던 유닛 그대로 유지(건물로 안 바뀜)
  else { G.tech.sel=ne.eid; G.tech.selU=[]; }   // 지정 일꾼이 없을 때만 그 건물 시트로
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }   // 배치 후 그리드 페이지 유지(2페이지에서 지으면 남은 일꾼도 2페이지 유지) — 지정 해제 후 재지정 시에만 1페이지 복귀(탭/박스지정 핸들러가 _cgPage=0)
function techDoProduce(id, bk){ const race=G.tech.race; if(!(G.tech.built[bk]>0)){ if(typeof toast==='function') toast('⛔ 건물 미건설'); return; }
  const b=techGetBldg(race,bk), p=b&&b.produces&&b.produces.find(x=>x.id===id); if(!p) return;
  if(!_techReqMet(p.req)){ if(typeof toast==='function') toast('⛔ 선행 미충족'); return; }
  let _lv=null, be=null;   // 🐛 스웜=라바 소모 / 테란·프로토스=건물 인스턴스 대기열(최대 5)
  if(race==='swarm'&&bk==='hatchery'){ const _selH=(G.tech.sel!=null)?G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'&&x.bk==='hatchery'&&x.bt<=0):null;
    if(_selH) _lv=G.tech.ents.find(l=>l.type==='larva'&&l.hatch===_selH.eid);
    if(!_lv) _lv=G.tech.ents.find(l=>l.type==='larva');
    if(!_lv){ if(typeof toast==='function') toast('⛔ 라바가 없습니다 — 해처리가 낳을 때까지 대기'); return; } }
  else { be=_techSelBldgOf(bk); if(!be){ if(typeof toast==='function') toast('⛔ 건물 없음'); return; }
    if(_techNeedsPower(bk) && !_techPowered(be.x,be.y)){ if(typeof toast==='function') toast('⛔ 동력 없음 — 파일런을 지으세요'); return; }   // 🛑 블랙아웃 중 생산 불가
    if((be._pq||[]).length>=5){ if(typeof toast==='function') toast('⛔ 대기열 가득참 (최대 5)'); return; } }
  if(_techFailPop(p.pop)) return;
  if(_techFailRes(p.m,p.g)) return;
  _techSpend(p.m,p.g); G.tech.sup+=(p.pop||0);   // 자원·인구 즉시 예약(선차감) — 취소 시 100% 환불
  const pt=_techProdTime(race,id);
  if(_lv){ G.tech.ents=G.tech.ents.filter(x=>x!==_lv);   // 라바 → 알(그 자리에서 변태, 부화 시 유닛)
    const _egg={eid:G.tech.eseq++, type:'egg', x:_lv.x, y:_lv.y, id:id, t:pt, tMax:pt, pop:p.pop||0, supply:p.supply||0, twin:(id==='snapper'||id==='stinger'), hatch:_lv.hatch};   // 🥚 스내퍼·스팅어=1알 2기
    if(pt<=0) techHatchEgg(_egg); else G.tech.ents.push(_egg); }
  else { const q={id:id, bk:bk, t:pt, tMax:pt, pop:p.pop||0, supply:p.supply||0, m:p.m||0, g:p.g||0};   // m·g=환불용
    if(pt<=0) techFinishProduce(q, be); else (be._pq=be._pq||[]).push(q); }
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
function _techSelBldgOf(bk){ const s=(G.tech.sel!=null)?G.tech.ents.find(e=>e.eid===G.tech.sel&&e.type==='bldg'&&e.bk===bk&&e.bt<=0):null; if(s) return s; return G.tech.ents.find(e=>e.type==='bldg'&&e.bk===bk&&e.bt<=0)||null; }   // 생산·연구 대상 건물 인스턴스(선택 우선)
function techCancelQueue(ev, idx){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;   // 대기열 슬롯 탭 = 취소(100% 환불)
  const be=(G.tech.sel!=null)?G.tech.ents.find(e=>e.eid===G.tech.sel&&e.type==='bldg'):null; if(!be||!be._pq||!be._pq[idx]) return;
  const q=be._pq[idx]; techRefund(q.m,q.g); G.tech.sup=Math.max(0,G.tech.sup-(q.pop||0));
  be._pq.splice(idx,1); if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); }
function techChargeAmmo(ev, key){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return; const a=TECH_AMMO[key]; if(!a) return;   // 🚀 내부 장전(캐리어·리버·핵 사일로)
  const e=_techChargerEnt(key); if(!e){ if(typeof toast==='function') toast('⛔ 대상 선택'); return; }
  if(!a.unit && _techNeedsPower(key) && !_techPowered(e.x,e.y)){ if(typeof toast==='function') toast('⛔ 동력 없음'); return; }
  const cap=_techAmmoCap(key), have=(e._chc||0)+((e._chq||[]).length);
  if(have>=cap){ if(typeof toast==='function') toast('⛔ 최대 '+cap+(a.unit?'기':'발')); return; }
  if(_techFailPop(a.pop)) return;
  if(_techFailRes(a.m,a.g)) return;
  _techSpend(a.m,a.g); if(a.pop) G.tech.sup+=a.pop; const t=_techAmmoTime(a), it={t:t,tMax:t,m:a.m,g:a.g,pop:a.pop||0};   // 선차감(자원·인구) — 취소 시 100% 환불
  (e._chq=e._chq||[]).push(it); if(t<=0){ e._chc=(e._chc||0)+1; e._chq.pop(); }
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
function techCancelAmmo(ev, key, j){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;   // 장전 대기 슬롯 탭 = 취소(100% 환불)
  const e=_techChargerEnt(key); if(!e||!e._chq||!e._chq[j]) return; const it=e._chq[j];
  techRefund(it.m,it.g); if(it.pop) G.tech.sup=Math.max(0,G.tech.sup-it.pop); e._chq.splice(j,1);
  if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); }
function techApplyResearch(be, rj){ if(!rj) return; if(rj.tier) G.tech.research[rj.key]=(G.tech.research[rj.key]||0)+1; else G.tech.research[rj.key]=true; }
function techCancelResearch(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;   // 연구 취소 = 100% 환불
  const be=(G.tech.sel!=null)?G.tech.ents.find(e=>e.eid===G.tech.sel&&e.type==='bldg'):null; if(!be||!be._rj) return;
  const rj=be._rj; techRefund(rj.cost[0],rj.cost[1]); be._rj=null; if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); }
function techDoResearch(bk, rk){ const race=G.tech.race, b=techGetBldg(race,bk); if(!b||!b.research) return; const r=b.research.find(x=>x.k===rk); if(!r) return;
  if(!((G.tech.built[bk]>0)||G.tech.addon[bk])){ if(typeof toast==='function') toast('⛔ 건물 미건설'); return; }
  const be=_techSelBldgOf(bk); if(!be){ if(typeof toast==='function') toast('⛔ 건물 없음'); return; }
  if(be._rj){ if(typeof toast==='function') toast('⛔ 연구 중 — 완료 후'); return; }   // 단일 연구(순차)
  if(_techNeedsPower(bk) && !_techPowered(be.x,be.y)){ if(typeof toast==='function') toast('⛔ 동력 없음'); return; }
  const key=race+'_'+rk; let cost;
  if(r.tier){ const lv=G.tech.research[key]||0; if(lv>=r.tier.length){ if(typeof toast==='function') toast('최대 레벨'); return; } cost=r.tier[lv]; }
  else { if(G.tech.research[key]){ if(typeof toast==='function') toast('이미 연구됨'); return; } cost=[r.m||0, r.g||0]; }
  if(_techFailRes(cost[0],cost[1])) return;
  _techSpend(cost[0],cost[1]);   // 선차감 — 취소 시 100% 환불
  const t=_techResearchTime(r); be._rj={ rk:rk, key:key, name:r.name||'', t:t, tMax:t, tier:!!r.tier, cost:[cost[0]||0,cost[1]||0] };
  if(t<=0){ techApplyResearch(be, be._rj); be._rj=null; }
  if(typeof playSfx==='function') playSfx('ui_confirm'); techUIRender(); }
function techRace(ev,r){ if(ev&&ev.stopPropagation) ev.stopPropagation(); techUIInit(r); techUIRender(); }
function techInf(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return; G.tech.inf=!G.tech.inf; techUIRender(); }
function techNocool(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return; G.tech.nocool=!G.tech.nocool;
  if(G.tech.nocool){ for(const e of G.tech.ents){ if(e.type==='bldg'&&e.bt>0){ techFinishBuild(e); } }   // 켤 때 진행 중인 것 즉시 완료
    for(const e of G.tech.ents){ if(e.type!=='bldg') continue;
      if(e._pq&&e._pq.length){ for(const q of e._pq) techFinishProduce(q, e); e._pq.length=0; }
      if(e._rj){ techApplyResearch(e, e._rj); e._rj=null; } } }
  techUIRender(); }
function techReset(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); const r=G.tech?G.tech.race:'union', inf=G.tech?G.tech.inf:false; techUIInit(r); G.tech.inf=inf; techUIRender(); }
function techLiftToggle(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||G.tech.sel==null) return;
  const e=G.tech.ents.find(x=>x.eid===G.tech.sel&&x.type==='bldg'); if(!e||e.bt>0) return;
  if(!_techCanLift(e.bk)){ if(typeof toast==='function') toast('⛔ 부양 불가 건물'); return; }
  if(!e._lifted){   // 🛫 이륙 시작 — 상승 애니(2초) 후 이동 가능. 애드온 분리·기능 정지
    e._lifted=true; e._liftPhase='rising'; e._liftT=TECH_LIFT_T; e._liftH=0; e.tx=null; e.ty=null; e._smkBurst=1;   // 이륙 순간 먼지 poof
    for(const ad of G.tech.ents){ if(ad.type==='bldg'&&ad._dockOf===e.eid) ad._orphan=true; }
    if(typeof toast==='function') toast('🛫 이륙 중 — 다 뜨면(약 2초) 이동 가능'); if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); return; }
  if(e._liftPhase==='flying'){   // 🛬 착륙 위치 지정 — 건설 실루엣(고스트) 시스템 재사용
    G.tech.arm=e.bk; G.tech.armLand=e.eid; G.tech.armXY={ x:e.x, y:e.y };
    if(typeof toast==='function') toast('🛬 착륙 위치를 정하고 ✓ — 이동 후 2초간 하강'); if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); return; }
  if(typeof toast==='function') toast('⏳ '+(e._liftPhase==='descending'?'착륙 중':(e._liftPhase==='toland'?'착륙 지점 이동 중':'이륙 중'))); }   // 애니 중엔 조작 불가
function techDemolish(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech||G.tech.sel==null) return;
  const e=G.tech.ents.find(x=>x.eid===G.tech.sel); if(!e||e.type!=='bldg') return; const race=G.tech.race, b=techGetBldg(race,e.bk), main=TECH_TREE[race].buildings[0];
  if(!b||b.k===main.k){ if(typeof toast==='function') toast('본진은 철거 불가'); return; }
  if(e._pq&&e._pq.length){ for(const q of e._pq){ techRefund(q.m,q.g); G.tech.sup=Math.max(0,G.tech.sup-(q.pop||0)); } }   // 대기열 100% 환불
  if(e._rj) techRefund(e._rj.cost[0], e._rj.cost[1]);   // 연구 환불
  if(e._chq&&e._chq.length){ for(const it of e._chq){ techRefund(it.m,it.g); G.tech.sup=Math.max(0,G.tech.sup-(it.pop||0)); } }   // 장전 대기열 환불
  if(e._chc && (TECH_AMMO[e.bk]||{}).pop){ G.tech.sup=Math.max(0,G.tech.sup-(TECH_AMMO[e.bk].pop*e._chc)); }   // 장전 완료분(핵) 인구 해제
  if(b.addonTo) G.tech.addon[b.k]=false; else G.tech.built[b.k]=Math.max(0,(G.tech.built[b.k]||0)-1);
  G.tech.supCap=Math.max(0,G.tech.supCap-(b.supply||0));
  for(const w of G.tech.ents){ if(w.type==='worker'&&w.build===e.eid){ w.build=null; w.tx=null; w.ty=null; w._wp=null; w._rr=0; } }   // 건설 중이던 일꾼 해방
  for(const p of G.tech.ents){ if(p._addonEid===e.eid) p._addonEid=null; }   // 애드온 철거 시 본체 슬롯 해제(재부착 가능)
  _techNydusUnlink(e);   // 🕳 나이더스 철거 = 반대편 영구 고장
  G.tech.ents=G.tech.ents.filter(x=>x.eid!==e.eid); G.tech.sel=null;
  if(typeof playSfx==='function') playSfx('ui_confirm'); if(typeof toast==='function') toast('🗑 '+b.name+' 철거 — 해금 유닛 재잠금'); techUIRender(); }
function strikeRandomRace(){ return STK_RACE_ORDER[Math.floor(Math.random()*STK_RACE_ORDER.length)]; }
   // 그 진영 종족의 소환 가능 유닛 id
// 직스 타일 에셋(기존 assets/tiles 재사용)
const STRIKE_GROUND=new Image(); STRIKE_GROUND.src='assets/tiles/desert.webp?v=1';        // 전장 지형(사막)
const STRIKE_PAVE=new Image(); STRIKE_PAVE.src='assets/tiles/protoss_floor.webp?v=1';     // 신전 잇는 포장 길(프로토스 테크)
const STRIKE_BUILDTILE=new Image(); STRIKE_BUILDTILE.src='assets/tiles/terran_tile_light.webp?v=1';  // 건설 보드(깔끔한 금속)
