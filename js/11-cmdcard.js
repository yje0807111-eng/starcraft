/* ============================================================================
 * 11-cmdcard.js — 탭 · 선택 · 커맨드카드
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ============================================================================
// 탭 / 선택 / 커맨드카드
// ============================================================================
const ZONE_LABEL={Main:'📍 내 디펜스 구역',Unit:'🏗 유닛 생산 구역',Upgrade:'⚙️ 업그레이드 구역',Players:'👥 다른 플레이어 화면',Boss:'👹 월드 보스방',Battle:'⚔ 전투 실험 구역',Build:'🏗 건설 테스트 구역'};
function switchTab(id,el){ if(G.strike){ strikeSwitchTab(id,el); return; }   // 컴퓨터가 싸운다: 직스 탭 동작
  if(G.tab===id && id!=='Build'){   // 같은 탭 재탭 = 슬라이드 시트 열고/닫기(건설은 선택 기반)
    if(G.sandbox && (id==='Main'||id==='Upgrade')){   // 관리자 메인/업그레이드: 무선택이면 재탭 무반응(빈 시트 안 올라오게)
      const _hasSel=(id==='Main')?(G.sel.length>=1 || G.selEnemy!=null):(G.techB!=null);
      if(!_hasSel) return; }
    document.body.classList.toggle('sheetOpen'); requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); return; }
  const _fromBattle=(G.tab==='Battle');   // ⚔ 전투실험: 별도 전장 유닛(G.btUnits)으로 스왑
  if(_fromBattle && id!=='Battle' && G._galUnits){ G.units=G._galUnits; G._galUnits=null; if(window.M3D&&M3D.clearGameModels) M3D.clearGameModels(); }   // 이탈 → 갤러리 유닛 복원
  if(id==='Battle' && !_fromBattle){ G.btUnits=G.btUnits||[]; G._galUnits=G.units; G.units=G.btUnits; if(window.M3D&&M3D.clearGameModels) M3D.clearGameModels(); }   // 진입 → 빈 전장 유닛으로
  { const _btc=document.getElementById('btCtl'); if(_btc) _btc.style.display=(id==='Battle')?'flex':'none'; }   // 전투실험 화면 오버레이 컨트롤
  if(G.view){ G.view.x=0.5; G.view.y=0.5; G.view.zoom=1; } if(G.viewT){ G.viewT.x=0.5; G.viewT.y=0.5; G.viewT.zoom=1; } _nptrs.clear(); _nemoPinch=null; _fxPinch=null;   // 탭 전환 시 화면 줌/팬 초기화(다른 탭 3D 카메라 보호)
  if(G.bossOpen && typeof closeBossArena==='function') closeBossArena();   // 탭 전환 시 보스 팝업 닫기
  if(G.bossPickArm){ G.bossPickArm=false; if(typeof updateBossPickBtn==='function') updateBossPickBtn(); }
  G.mainSheet=null; G.sheetDown=false;   // 🎰 실제 탭 전환 = 유닛뽑기 등 메인 시트 모드 종료 + 접힘상태 해제
  G.tab=id;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on')); el.classList.add('on');
  gtabDrill(id);   // 그 구역에 하위가 있으면 내려간다(없으면 최상위 유지)
  document.querySelectorAll('.gview').forEach(v=>v.classList.remove('on')); document.getElementById('v'+(id==='Battle'?'Main':id)).classList.add('on');   // 전투실험은 메인 아레나 뷰 공유
  document.querySelectorAll('.bp').forEach(p=>p.classList.remove('on')); document.getElementById('bp'+id).classList.add('on');
  document.body.classList.toggle('sheetOpen', id!=='Build');   // 탭 진입 = 시트 자동 오픈(건설은 선택 시 시트)
  requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220);
  { const _z=ZONE_LABEL[id]||'', _m=_z.match(/^(\S+)\s+(.*)$/), _e=_m?_m[1]:'';   // 라벨 앞 이모지 → 아이콘
    const _hit=_e?(MSG_ICO[_e]||MSG_ICO[_e+'️']):null;
    const _zl=document.getElementById('zoneLabel');
    if(_zl) _zl.innerHTML=_hit? pIco(_e)+'<span class="zlTx">'+escHtml(_m[2])+'</span>' : escHtml(_z); }
  document.body.classList.toggle('cstMode', id==='Build');   // 건설 탭: 게임 HUD 숨김
  document.body.classList.remove('stkCst');                  // 네모/관리자 경로 = 오토배틀 건설지 표시 해제(직스에서 빠져나온 잔여 클래스 제거)
  if(id==='Build' && typeof techUIEnsure==='function') techUIEnsure(); else { if(typeof techHidePreview==='function') techHidePreview(); if(window.M3D&&M3D.techMap3DStop) M3D.techMap3DStop();
    if(G.tech){ G.tech.sel=null; G.tech.selU=[]; G.tech.arm=null; if(G.tech.sheet){ G.tech.sheet.open=false; G.tech.sheet.sec=null; } } G._weldFx=null; }   // 건설 진입 렌더 / 이탈 시 프리뷰·라이브3D 정지 + 지정·시트·용접스파크 해제
  deselectUnit(); G.prodB=null; G.techB=null; G.mergeMode=false; { const mb=document.getElementById('mergeBtn'); if(mb) mb.classList.remove('on'); }
  if(typeof clearShopProfile==='function') clearShopProfile();   // 유닛뽑기 중립 선택 해제
  document.getElementById('prodHint').style.display='';
  if(id!=='Unit' && typeof fxLabDeactivate==='function') fxLabDeactivate();   // Unit 떠나면 이펙트 랩 비활성
  if(id==='Unit'){ if(G.sandbox){ fxLabActivate(); }   // 관리자: Unit 탭 = 이펙트 테스트베드
    else { G.citizen={x:CITIZEN_HOME.x,y:CITIZEN_HOME.y,gx:null,gy:null,buyId:null,mode:'idle',targetPad:null}; uHold=null; G.shopSel=null; buildClock(); drawProd(); buildGachaDex(); if(typeof renderGachaActions==='function') renderGachaActions(); } }   // 일반: 유닛뽑기
  updateDeselTop();
  if(id==='Upgrade'){ drawUpg(); }   // 업그레이드 = 배경만(건물 화면 폐지) · 실제 강화는 하단 업그레이드 시트
  if(id==='Players'){ const mine=G.myPlayer||1; const others=(G.activePlayers||[1,2,3,4,5,6,7,8]).filter(n=>n!==mine);
    if(others.indexOf(G.curPlayer)<0) G.curPlayer=others[0]||mine;   // 입장한 다른 플레이어 기본
    if(typeof clearPlayerSel==='function') clearPlayerSel(); renderPlayers(); drawPlayer(); }
  if(id==='Main'){ drawMain(); renderUnits(); }
  if(id==='Battle'){ if(typeof sprLabStart==='function') sprLabStart(); }   // 🧪 스프라이트 유닛 실험장(전투실험 대체)
  else { if(typeof sprLabStop==='function') sprLabStop(); }
  if(id==='Boss'){ BOSS_VIEW.x=0; BOSS_VIEW.y=0; renderBossPanel(); drawBoss(); }
  if(typeof updateCoopBossBar==='function') updateCoopBossBar();
  updateSpecLabel();
  // 메인 외 탭에서 전투 미니맵 표시(조합 FAB 은 폐지 — 하단 네비 「유닛 조합」이 단일 소스)
  const _labView=(G.sandbox && id==='Unit'), _arena=(id==='Main'||id==='Battle');   // 이펙트 랩: 미니맵 숨김 / 아레나(메인·전투실험)
  document.getElementById('miniWrap').classList.toggle('on', !_arena && !_labView);
  if(!_arena && !_labView) drawMiniMap();
  // 구역마다 시트가 다른 요소다(.bp ↔ #btSheet) — 넘어올 때 채팅바 높이를 다시 잡는다
  if(typeof _syncSheetLift==='function'){ requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); }
}
// 계열 한글명(타입 라벨용)
// 유닛 직업(이름 옆 작은 배지)
const UNIT_CLS={   // 유닛 직업/병과 — 모델 id(gmodel) 기준. 베이스 유닛은 id로 폴백
  marine:'보병', goliath:'기갑병', ghost:'저격수', dragoon:'포격수', archon:'광전사', hydra:'전사',
  turret:'포탑', photon:'방어탑', citizen:'시민',
  racer:'돌격병', machinegun:'화력병', tank:'공성전차', skyguard:'전투기',
  blade:'검사', matron:'여제', skydancer:'전투기',
  thornqueen:'역병술사', snapper:'척후병',
  hellfire:'폭격기', pelican:'수송선', dreadnought:'전함', aegis:'지원함',
  kronos:'전함', seraph:'수송선', archangel:'모함', falcon:'전투기', observer:'정찰기',
  overlord:'수송충', stinger:'자폭충', venom:'산성충', medusa:'군단여왕', defiler:'오염술사',
  wyvern:'전투기', behemoth:'공성생물',
  worker_human:'일꾼', worker_light:'일꾼', worker_swarm:'일꾼',
  medic:'의무병', broodling:'소환수', larva:'공성', ultralisk:'돌격괴수', dark_templar:'암살자', high_templar:'대마법사', dark_archon:'암흑마법사',
};
// 유닛 종족 → 좌측 바 색(유니온=파랑/스웜=초록/에테리얼=금색). 같은 모델을 다른 종족이 쓰기도 해 모델키(gmodel||id) 기준
const RACE_BAR={ union:'#4aa8ff', swarm:'#a8472e', aetherial:'#ffc040', feral:'#c98b5a', colossus:'#9aa6b2' };   // 페럴·콜로서스 색은 ART.md §종족 다섯과 같은 값
const RACE_OF={
  marine:'union', goliath:'union', ghost:'union', racer:'union', machinegun:'union', tank:'union', skyguard:'union', hellfire:'union', pelican:'union', dreadnought:'union', aegis:'union', worker_human:'union', turret:'union', photon:'union', citizen:'union', medic:'union',
  dragoon:'aetherial', archon:'aetherial', blade:'aetherial', skydancer:'aetherial', kronos:'aetherial', seraph:'aetherial', archangel:'aetherial', falcon:'aetherial', observer:'aetherial', worker_light:'aetherial', dark_templar:'aetherial', high_templar:'aetherial', dark_archon:'aetherial', larva:'aetherial',
  hydra:'swarm', snapper:'swarm', thornqueen:'swarm', matron:'swarm', overlord:'swarm', stinger:'swarm', venom:'swarm', medusa:'swarm', defiler:'swarm', wyvern:'swarm', behemoth:'swarm', worker_swarm:'swarm', broodling:'swarm', ultralisk:'swarm',
  // 🐺 페럴 · 🗿 콜로서스 — 관리자 전용(오토배틀 미편입). ⚠ STK_RACE_STAT 에 이 두 키가 없으므로
  //    오토배틀에 넣을 때 배율(RACES.md §6)을 같이 추가해야 한다 — 없으면 배율 1로 조용히 센다.
  worker_feral:'feral', wolfrunner:'feral', thornspitter:'feral', clawfighter:'feral', hornedcharger:'feral', howlslinger:'feral', venomfang:'feral', stalkercat:'feral', packshaman:'feral', alphawolf:'feral', hawkeye:'feral', windcarrier:'feral', wyvernrider:'feral', skytalon:'feral', stormroc:'feral', primalbeast:'feral',
  worker_col:'colossus', gunner:'colossus', guardwalker:'colossus', twincannon:'colossus', flakbattery:'colossus', spotterdrone:'colossus', railgun:'colossus', stasistech:'colossus', arclight:'colossus', supplylifter:'colossus', siegecolossus:'colossus', skylance:'colossus', orbitalanchor:'colossus', worldbreaker:'colossus',
};
try{ if(typeof window!=='undefined') window.RACE_OF=RACE_OF; }catch(_e){}   // M3D 모듈(별도 스코프)에서 종족별 틴트 분기용
// ══ 건설 연구/업그레이드 효과 연결 (건설 샌드박스 전용 · nemo 무관 — G.tech.research만 읽음) ══
// (A) 최대 마나 +50 부적 — 값은 반드시 U[uid].energy>0(실제 캐스터). apollo(→skyguard)·colossus(→dreadnought)는 대상이 비캐스터(energy0)라 무효 → 제외
const AMULET_UNITS={ caduceus:['medic'], titan:['aegis'], moebius:['ghost'], gamete:['medusa'], metasynaptic:['defiler'],
  khaydarin:['high_templar'], argus:['dark_archon'], khaydarin_core:['kronos'], argus_jewel:['falcon'] };
// (B) 스펠 언락 — 스킬키 → 연구키(종족 접두사 없음). 연구 항목 있는 스펠만(heal·nuke·psi_cloak·defensive_matrix·parasite·dark_swarm·feedback = innate)
const SKILL_RESEARCH={ stim:'stim', siege:'siege', spider_mine:'mine', lockdown:'lockdown', emp:'emp', irradiate:'irradiate', yamato:'yamato',
  restoration:'restore', optical_flare:'flare', ensnare:'ensnare', broodling:'broodling', plague:'plague', consume:'consume',
  psi_storm:'storm', hallucination:'hallucination', maelstrom:'maelstrom', mind_control:'mindcontrol', disruption_web:'disruption', stasis:'stasis', recall:'recall' };
// (C) 무기/방어 티어 — uid → {atk,def,sh?}(uid당 각 1개 → 중복가산 없음). 지상/공중=FXLAB_AIR · 종족=RACE_OF
const UNIT_UPG={
  marine:{atk:'inf_atk',def:'inf_def'}, machinegun:{atk:'inf_atk',def:'inf_def'}, ghost:{atk:'inf_atk',def:'inf_def'}, medic:{def:'inf_def'},
  racer:{atk:'veh_atk',def:'veh_def'}, tank:{atk:'veh_atk',def:'veh_def'}, goliath:{atk:'veh_atk',def:'veh_def'},
  skyguard:{atk:'air_atk',def:'air_def'}, hellfire:{atk:'air_atk',def:'air_def'}, dreadnought:{atk:'air_atk',def:'air_def'}, pelican:{def:'air_def'}, aegis:{def:'air_def'},
  snapper:{atk:'melee_atk',def:'gnd_def'}, broodling:{atk:'melee_atk',def:'gnd_def'}, ultralisk:{atk:'melee_atk',def:'gnd_def'},
  hydra:{atk:'range_atk',def:'gnd_def'}, thornqueen:{atk:'range_atk',def:'gnd_def'}, matron:{def:'gnd_def'}, defiler:{def:'gnd_def'},
  wyvern:{atk:'fly_atk',def:'fly_def'}, stinger:{atk:'fly_atk',def:'fly_def'}, behemoth:{atk:'fly_atk',def:'fly_def'}, venom:{atk:'fly_atk',def:'fly_def'}, overlord:{def:'fly_def'}, medusa:{def:'fly_def'},
  blade:{atk:'gnd_wpn',def:'gnd_arm',sh:'shield'}, dragoon:{atk:'gnd_wpn',def:'gnd_arm',sh:'shield'}, archon:{atk:'gnd_wpn',def:'gnd_arm',sh:'shield'}, dark_templar:{atk:'gnd_wpn',def:'gnd_arm',sh:'shield'}, larva:{atk:'gnd_wpn',def:'gnd_arm',sh:'shield'},
  high_templar:{def:'gnd_arm',sh:'shield'}, dark_archon:{def:'gnd_arm',sh:'shield'}, worker_light:{def:'gnd_arm',sh:'shield'},
  falcon:{atk:'air_wpn',def:'air_arm',sh:'shield'}, skydancer:{atk:'air_wpn',def:'air_arm',sh:'shield'}, archangel:{atk:'air_wpn',def:'air_arm',sh:'shield'}, kronos:{atk:'air_wpn',def:'air_arm',sh:'shield'}, seraph:{def:'air_arm',sh:'shield'}, observer:{def:'air_arm',sh:'shield'} };
function _techResearched(race,key){ return !!(typeof G!=='undefined'&&G.tech&&(G.tech.inf||(G.tech.research&&G.tech.research[race+'_'+key]))); }   // 게이트/효과 판정(inf=선행무시 우회)
function _upgLv(race,key){ return (typeof G!=='undefined'&&G.tech&&G.tech.research&&(G.tech.research[race+'_'+key]|0))||0; }   // 티어 레벨(정수) · 배틀탭 G.tech null=0
function _unitRace(u){ return (typeof RACE_OF!=='undefined'&&RACE_OF[u.gmodel||u.id])||null; }
function _upgAtk(u){ const k=(UNIT_UPG[u.gmodel||u.id]||{}).atk, r=_unitRace(u); return (k&&r)?_upgLv(r,k):0; }   // 무기 티어 +lv
function _upgDef(u){ const key=u.gmodel||u.id, m=UNIT_UPG[key]||{}, r=_unitRace(u); let d=(m.def&&r)?_upgLv(r,m.def):0; if(key==='ultralisk'&&r&&_techResearched(r,'chitinous')) d+=2; return d; }   // 방어 티어 +lv (+치티너스 2)
function _upgShield(u){ const m=UNIT_UPG[u.gmodel||u.id]||{}, r=_unitRace(u); return (m.sh&&r)?_upgLv(r,m.sh):0; }   // 실드 티어 +lv
function _techAmuletBonus(race,uid){ let b=0; for(const k in AMULET_UNITS){ if(AMULET_UNITS[k].indexOf(uid)>=0 && _techResearched(race,k)) b+=50; } return b; }   // 부적 +50
function _skillLocked(race,key){ const rk=SKILL_RESEARCH[key]; if(!rk) return false; if(!(typeof G!=='undefined'&&G.tech)) return false; return !_techResearched(race,rk); }   // 스펠 언락(연구 전 잠금) · G.tech 없으면(순수 배틀) 자유
function _techBldgOfResearch(race,rk){ const bs=((typeof TECH_TREE!=='undefined'&&TECH_TREE[race])||{}).buildings||[]; for(const b of bs){ if((b.research||[]).some(x=>x.k===rk)) return b.name; } return ''; }
function techSkillLocked(ev,bname){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(typeof toast==='function') toast('🔒 연구 필요: '+(bname||'')); }
// 관리자 사거리·공속 = base_stats 단일 소스(구 SB_RANGE/SB_CD/SB_AIR 파생표 제거). 전투(_sbUnitRange/_sbUnitDps)와 표시·발사 리듬이 완전히 동일값. 네모는 U 그대로.
function effRange(id, fb){ if(typeof BASE_UNIT!=='undefined' && id!=null && BASE_UNIT[id]) return BASE_UNIT[id][4]*SB_ANCHOR_RANGE; return fb; }   // 관리자 사거리 = base타일 × 앵커(전투 _sbUnitRange와 동일)
function _sbBaseCd(key){ const bcd=(typeof BASE_CD!=='undefined'&&BASE_CD[key]>0)?Math.round(BASE_CD[key]*SB_ANCHOR_CD):0; return bcd>0?bcd/60:(((U[key]&&U[key].cd)||22)/60); }   // 관리자 공속(초) = base_stats(BASE_CD×앵커, _baseUnitOv와 동일 반올림) — 표시·발사 리듬=전투 완전 일치
// 관리자 이펙트 크기 = 실제 3D 모델 크기(SCALE)에서 유도(단일 소스). 모델 덩치와 이펙트가 항상 비례 → 이펙트 구역 크기와 자동 연동. SCALE(또는 이펙트 계수)만 바꾸면 발사·사망·이펙트 크기가 같이 따라옴.
const FX_UNIT_SIZE_K=1.11;   // SCALE→이펙트 크기 계수(현행 평균 유지, 어긋난 유닛만 모델 비례로 교정)
const FX_SIZE_OVR={ machinegun:1.25, wyvern:1.25 };   // 유닛별 이펙트 크기 미세 보정(모델 대비 이펙트만 키우거나 줄임). 발칸·와이번=이펙트 확대
function _fxUnitSize(key){ const ov=FX_SIZE_OVR[key]||1; const sc=(typeof window!=='undefined'&&window.M3D&&window.M3D.scaleOf)?window.M3D.scaleOf(key):null; return (sc&&sc>0)?Math.round(sc*FX_UNIT_SIZE_K*ov*10)/10:(((U[key]&&U[key].size)||16)*ov); }   // 3D 미가용 시 U.size 폴백
// 체력/실드/에너지 초록 LCD 텍스트(스타식 "실드 HP / 에너지")
function scHpHTML(u){ const def=U[u.id]; const m=u.hero?HERO_STAT_MUL:1;
  const maxHp=u.maxHp||Math.round(def.hp*m), hp=u.hp!=null?u.hp:maxHp;
  const maxSh=u.maxSh!=null?u.maxSh:Math.round((def.shield||0)*m), sh=u.sh!=null?u.sh:maxSh;
  const maxEn=u.maxEn!=null?u.maxEn:(def.energy||0), en=u.en!=null?u.en:maxEn;
  let h='';
  if(maxSh>0) h+='<div class="hpline shd"><span class="lab">쉴드</span>'+sh+'/'+maxSh+'</div>'; // 보호막(쉴드)
  h+='<div class="hpline hp"><span class="lab">체력</span>'+hp+'/'+maxHp+'</div>';
  if(maxEn>0) h+='<div class="hpline en"><span class="lab">에너지</span>'+en+'/'+maxEn+'</div>';
  return h;
}
// 큰 수치 축약(칸 넘침 방지): 1만 미만=그대로, 그 이상=K/M
function fmtStat(n){ n=Math.round(n); if(n<10000) return ''+n; if(n<1000000) return (n/1000).toFixed(n<100000?1:0)+'K'; return (n/1000000).toFixed(1)+'M'; }
// 초록 테두리 스탯 박스(공격/방어/사거리) — 스타 콘솔식
function scStatBoxesHTML(u){ const def=(typeof G!=='undefined'&&G.sandbox&&!G.strike)?Ueff(u):U[u.id];   // 관리자: 방어·실드도 base_stats
  const numBox=(label,val,cls)=>'<div class="scBox"><div class="sv">'+fmtStat(val)+'</div><div class="sl '+(cls||'')+'">'+label+'</div></div>';
  const atkBox=(label,p,cls)=>'<div class="scBox atkBox" onpointerdown="atkPeekStart(this,event)">'   // 평소=총 공격력 / 길게 누르면 위에 기본+업글
    +'<div class="atkPeek">기본 '+fmtStat(Math.max(0,p.total-p.up))+' + 업글 '+fmtStat(p.up)+'</div>'
    +'<div class="sv">'+fmtStat(p.total)+'</div><div class="sl '+(cls||'')+'">'+label+'</div></div>';
  let h=numBox('방어력',def.armor,'def');             // 방어력(파랑)
  if((u.gid!=='matron_t') && ((u.maxSh!=null)?u.maxSh>0:def.shield>0)) h+=numBox('쉴드방어력',def.shArmor||0,'shd');  // 실드 있는 유닛만(매트론=실드 없음)
  const dp=unitDmgParts(u), ap=unitAirParts(u), _mk=(u.gmodel||u.id);
  if(ap && (_mk==='goliath'||_mk==='skyguard')){ h+=atkBox('지상공격력',dp,'atk'); h+=atkBox('공중공격력',ap,'atk'); }   // 지상/공중 분리 = 스트라이더(goliath)·템페스트(skyguard)만
  else h+=atkBox(def.splash?'광역공격력':'공격력',dp,'atk');            // 그 외 전부 통합 공격력(최대 3박스)
  return h;
}
// 스탯 박스 크기 고정 — 숫자가 칸을 넘치면 폰트를 점점 줄여 맞춤
// 공격력 박스 길게 누르기 → 기본+업글 분해 툴팁(위로 팝업)
let _atkPeekT=null, _atkPeekEl=null;
function atkPeekStart(box, ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  atkPeekClear();
  _atkPeekT=setTimeout(()=>{ box.classList.add('peek'); _atkPeekEl=box; _atkPeekT=null; }, 300); }   // 0.3초 이상 누르면 표시
function atkPeekClear(){ if(_atkPeekT){ clearTimeout(_atkPeekT); _atkPeekT=null; } if(_atkPeekEl){ _atkPeekEl.classList.remove('peek'); _atkPeekEl=null; } }
['pointerup','pointercancel'].forEach(e=>document.addEventListener(e, atkPeekClear));
function fitStatNumbers(){
  document.querySelectorAll('.scStats .scBox .sv').forEach(sv=>{   // 메인/뽑기/관전 프로필 모두
    let fs=18; sv.style.fontSize=fs+'px';
    const avail=sv.parentElement.clientWidth-5; let guard=0;
    while(sv.scrollWidth>avail && fs>6 && guard++<28){ fs--; sv.style.fontSize=fs+'px'; }
  });
}
// ═══ 🎛 메인 선택 프로필 = 건설 탭과 동일한 커맨드 그리드(renderCmdGrid) 재사용 — 모델만 메인 데이터(G.units/G.sel)로 구성 ═══
function _mainTypeKey(u){ return (u.gid||u.gmodel||u.id)+'|'+(u.hero?1:0)+'|'+(u.lv||1); }   // 종류 = 등급·영웅·강화까지 동일해야 같은 칩
function _mainRole(u){ return (typeof UNIT_CLS!=='undefined'&&UNIT_CLS[u.gmodel||u.id])||''; }
function _mainPort(u){ return unitPortraitHTML(u.gmodel||u.id); }
function _mainMaxHp(u){ const d=U[u.id]||{}, m=u.hero?HERO_STAT_MUL:1; return u.maxHp||Math.round((d.hp||0)*m); }
function _mainMaxSh(u){ const d=U[u.id]||{}, m=u.hero?HERO_STAT_MUL:1; return (u.maxSh!=null)?u.maxSh:Math.round((d.shield||0)*m); }
function _mainMaxEn(u){ const d=U[u.id]||{}; return (u.maxEn!=null)?u.maxEn:(d.energy||0); }
// ⚠ 마나는 머리줄에 넣지 않는다 — 제목 옆 한 줄에 HP·실드까지가 한계고, 마나는 왼쪽 정보 구역(스탯)이 자리다.
function _mainHpsh(u){ const mh=_mainMaxHp(u), ms=_mainMaxSh(u);
  return _cgHpShStr(Math.round(u.hp!=null?u.hp:mh)+'/'+mh, ms>0?(Math.round(u.sh!=null?u.sh:ms)+'/'+ms):0, 0); }
function _mainManaStat(u){ const me=_mainMaxEn(u); return (me>0)?[['마나', Math.round(u.en!=null?u.en:me)+'/'+me]]:[]; }
// 좌측 스탯 = 건설 프로필과 동일 구성(공격력·사거리·공격속도·처치) · 처치=메인 누적 킬
function _mainUnitStatList(u){ const def=(G.sandbox&&!G.strike&&typeof Ueff==='function')?Ueff(u):(U[u.id]||{}), k=u.gmodel||u.id;
  const rng=(G.sandbox&&typeof effRange==='function')?(Math.round(effRange(k,def.range)/SB_ANCHOR_RANGE*10)/10)
    :Math.round((def.range||0)*((typeof gachaRangeMul==='function')?gachaRangeMul(u):1)*100);
  const _cdf=(typeof cdOf==='function')?cdOf(u,def):def.cd, _sbcd=(G.sandbox&&typeof _sbBaseCd==='function')?_sbBaseCd(k):null;
  const spd=(_sbcd!=null)?((1/_sbcd).toFixed(1)+'/s'):((_cdf>0)?((60/_cdf).toFixed(1)+'/s'):'-');
  const dp=(typeof unitDmgParts==='function')?unitDmgParts(u):null, atk=(dp&&dp.total>0)?fmtStat(dp.total):(def.dmg>0?fmtStat(def.dmg):'무공격');
  return [['공격력',atk], ['사거리', rng>0?(''+rng):'-'], ['공격속도',spd], ['처치', ''+(u.kills||0)]].concat(_mainManaStat(u)); }
// 👥 활성셋(건설 techCastSkill과 동일 규약): 지정 중 이 스킬 보유 유닛 전부 · 소프트선택(G.selType) 시 그 종류만
function _mainSkillSet(key){ const list=(G.sel||[]).map(id=>G.units.find(u=>u.uid===id)).filter(Boolean);
  const owns=u=>unitSkillKeys(u).indexOf(key)>=0;
  return G.selType?list.filter(u=>_mainTypeKey(u)===G.selType&&owns(u)):list.filter(owns); }
// 🪄 스킬 카드 — 메인 UNIT_SKILLS/SKILLS/SKILL_ICON 재사용 · 상태는 활성셋 집계(건설과 동일)
function _mainSkillCards(list){ const out=[]; if(typeof SKILLS==='undefined'||typeof unitSkillKeys!=='function') return out;
  const arr=Array.isArray(list)?list:[list], u0=arr[0]; if(!u0) return out;
  for(const k of unitSkillKeys(u0)){ const sk=SKILLS[k]; if(!sk) continue;
    const lk=(typeof _skillLocked==='function')&&_skillLocked(_unitRace(u0),k);
    const set=arr.filter(u=>unitSkillKeys(u).indexOf(k)>=0), c=_skCost(sk);
    let armed=false, on=false, canCast=false;   // 한 기라도 armed/ON=표시 · 전원 마나부족=dim (쿨다운 없음 — SC식, 건설과 동일)
    for(const u of set){
      if(G.skillArm&&G.skillArm.uid===u.uid&&G.skillArm.key===k) armed=true;
      if(((sk.kind==='toggle'||sk.kind==='aura')&&u.skillOn&&u.skillOn[k])||(sk.kind==='target_unit'&&u.healFocus)||(sk.kind==='self'&&u.buff&&u.buff[k]&&u.buff[k].t>0)) on=true;
      if(c<=0||(u.en||0)>=c) canCast=true; }
    out.push({ _k:k, pro:skillIcoHTML(k, '<span class="skPro">'+((typeof SKILL_ICON!=='undefined'&&SKILL_ICON[k])||pIco('✨'))+'</span>'), sn:sk.name,
      tr:lk?pIco('🔒','sm'):(on?'ON':''), metaCls:'lv', sel:!lk&&(armed||on),   // tr=우상단 배지(ON/잠금) · _k=스킬 키(혼합 공통 카드 식별용)
      bottom:'<div class="cgCost">'+((typeof _skCostHTML==='function')?_skCostHTML(sk):'')+'</div>',
      state:(lk||!canCast)?'dim':'ok',
      act:'onpointerdown="mainSkDown(event,\''+k+'\')" onpointerup="mainSkUp(event)" onpointerleave="mainSkCancel()" onpointercancel="mainSkCancel()" oncontextmenu="return false"' }); }   // 짧게=시전 · 길게=설명 팝업(건설과 동일)
  return out; }
// 🔮 스킬 카드 상호작용 — 건설(techSkDown/Up/Cancel)과 동일 규약. 설명 팝업(techShowSkTip/techHideSkTip)은 그대로 재사용
let _mskT=null, _mskKey=null, _mskDone=false;
function mainSkDown(ev,key){ if(ev&&ev.stopPropagation) ev.stopPropagation(); _chipSwallow=false; _mskKey=key; _mskDone=false;
  const el=ev&&ev.currentTarget, r=(el&&el.getBoundingClientRect)?el.getBoundingClientRect():null;   // 앵커 rect 즉시 캡처(리렌더로 카드가 detach돼도 좌표 유지)
  const rect=r?{left:r.left,top:r.top,bottom:r.bottom,width:r.width}:null;
  if(_mskT) clearTimeout(_mskT);
  _mskT=setTimeout(()=>{ _mskT=null; if(_mskKey===key){ _mskDone=true; _chipSwallow=true; if(typeof playSfx==='function') playSfx('ui_open'); techShowSkTip(key, rect); } }, TECH_HOLD_MS); }
function mainSkUp(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(_mskT){ clearTimeout(_mskT); _mskT=null; }
  const key=_mskKey, done=_mskDone; _mskKey=null; _mskDone=false; techHideSkTip();
  if(key!=null && !done){ _chipSwallow=true; mainCastSkill(key); } }   // 짧게 = 시전
function mainSkCancel(){ if(_mskT){ clearTimeout(_mskT); _mskT=null; } _mskKey=null; _mskDone=false; techHideSkTip(); }
// 시전 — 건설 techCastSkill과 동일 규약(자버프·토글=활성셋 전체 / 지정형=마나 충족 1기 무장). 실행은 메인 엔진(G.skillArm·u.skillOn·u.buff)
function mainCastSkill(key){ const sk=(typeof SKILLS!=='undefined')&&SKILLS[key]; if(!sk) return;
  const set=_mainSkillSet(key); if(!set.length) return;
  const race=_unitRace(set[0]);
  if(typeof _skillLocked==='function' && _skillLocked(race,key)){ if(typeof toast==='function') toast('🔒 연구 필요: '+((typeof _techBldgOfResearch==='function')?_techBldgOfResearch(race,SKILL_RESEARCH[key]):'')); return; }   // 🔒 실제 차단은 여기(카드 dim은 표시용)
  const c=_skCost(sk);
  if(sk.kind==='toggle'||sk.kind==='aura'){ const nv=!(set[0].skillOn&&set[0].skillOn[key]);   // 토글 = 그룹 일관(전원 같은 새 상태로)
    for(const u of set){ u.skillOn=u.skillOn||{}; u.skillOn[key]=nv; }
    if(typeof playSfx==='function') playSfx('skill'); refreshSelCard(); return; }
  if(sk.kind==='self'){ let did=0;   // 자버프(스팀팩 등) = 활성셋 전체 발동(SC식: 쿨다운 없음 — 마나/체력만 게이트, 사용 직후 바로 재사용 가능)
    for(const u of set){
      if(c>0&&(u.en||0)<c) continue;
      if(sk.hpCost>0){ const mh=_mainMaxHp(u), hp=(u.hp!=null?u.hp:mh); if(hp<=sk.hpCost) continue; u.hp=Math.max(1,hp-sk.hpCost); }
      if(c>0) u.en=Math.max(0,(u.en||0)-c);
      u.buff=u.buff||{}; u.buff[key]={t:sk.dur||3, atkMul:sk.atkMul||1, spdMul:sk.spdMul||1}; did++; }
    if(!did) return;   // 전원 불발(마나·체력 부족) = 조용히 무시 — 카드가 이미 dim으로 표시(채팅 알림 없음)
    if(typeof playSfx==='function') playSfx('skill'); refreshSelCard(); return; }
  // 🎯 지정형(지점/유닛/대상) = 마나 충족하는 1기만 시전(SC식: 쿨다운 없음) — 무장 후 맵 탭
  const caster=set.find(u=>(c<=0||(u.en||0)>=c));
  if(!caster) return;   // 마나 부족 = 조용히 무시(카드 dim으로 표시 · 채팅 알림 없음)
  if(sk.kind==='target_unit' && caster.healFocus){ caster.healFocus=null; if(typeof toast==='function') toast(sk.name+' 해제'); refreshSelCard(); return; }
  const mode=(sk.kind==='target_ground')?'ground':((sk.kind==='target_unit')?'unit':'enemy');
  G.skillArm={uid:caster.uid, key:key, mode:mode}; G.focusArm=false; G.patrolArm=false;
  if(typeof toast==='function') toast(sk.arm||'ℹ️ 대상을 탭하세요'); refreshSelCard(); }
// 🛬🛫 수송 카드(구 #transportCmd 대체)
function _mainTransportCards(u){ const out=[]; if(typeof isTransport!=='function'||!isTransport(u)) return out;
  const cap=transportCap(u), n=(u.cargo?u.cargo.length:0);
  out.push({ pro:pIco('🛬'), sn:'태우기', tr:n+'/'+cap, metaCls:'lv', sel:!!G.boardArm, state:(n>=cap)?'dim':'ok', act:'onclick="armBoard()"' });
  out.push({ pro:pIco('🛫'), sn:'내리기', sel:!!G.unloadArm, state:(n>0)?'ok':'dim', act:'onclick="armUnload()"' });
  return out; }
function _mainSelAllBtn(u){ if(typeof isBuilding==='function'&&isBuilding(u.id)) return '';
  const key=_mainTypeKey(u), cnt=G.units.filter(x=>!isBuilding(x.id)&&_mainTypeKey(x)===key).length;
  return (cnt>1)?('<button class="cgSelAll" onclick="selectAllOfType()" title="같은 종류 전체 지정">'+uiIco('selall')+'</button>'):''; }
function _mainSingleModel(u){ const def=U[u.id]||{}, role=_mainRole(u);
  return { mode:'prod', title:gNameStar(u,def)+(u.hero?' [영웅]':''), icon:_mainPort(u), hpsh:_mainHpsh(u),   // 이름 옆 (보직/직업) 표기 제거 — 건설 프로필과 통일
    sub:'맵을 탭하면 이동 · 해제는 우상단 ✕', items:_mainSkillCards([u]).concat(_mainTransportCards(u)), topRight:_mainSelAllBtn(u),
    info:{ eb:'', hideName:true, stats:_mainUnitStatList(u), cr:0, en:0 } }; }
function _mainTypeModel(list, canBack){ const u0=list[0], def=U[u0.id]||{}, n=list.length, role=_mainRole(u0), CAP=60;   // canBack=소프트선택 중 → ↩(전체 복귀) 버튼
  const rows=list.slice(0,CAP).map(u=>({ uid:u.uid, hp:(u.hp!=null?u.hp:_mainMaxHp(u)), maxHp:_mainMaxHp(u)||1,
    act:'onclick="mainSubSelectOne(event,'+u.uid+')"' }));   // 칩 탭 = 그 1기만 지정
  if(n>CAP) rows.push({ more:n-CAP });
  return { mode:'prod', title:gNameStar(u0,def)+' <span class="nsub">×'+n+'</span>', icon:_mainPort(u0),   // 이름 옆 (보직/직업) 표기 제거
    sub:'', items:_mainSkillCards(list), topRight:_mainSelAllBtn(u0),   // 활성셋 전체 기준 상태(ON·마나·쿨다운)
    back:canBack?'<button class="cgLift cgBack" onclick="mainSubSelectType(event,\'\')" title="전체 선택으로">'+uiIco('back')+'</button>':'',   // 🔙 소프트선택 해제(전체 복귀)
    info:{ eb:'', hideName:true, units:rows, cr:0, en:0 } }; }
function _mainMixedModel(list){ const grp={}, ord=[];
  for(const u of list){ const k=_mainTypeKey(u); if(!grp[k]){ grp[k]={n:0,u:u}; ord.push(k); } grp[k].n++; }
  const items=ord.map(k=>({ pro:_mainPort(grp[k].u), sn:gNameStar(grp[k].u,U[grp[k].u.id]||{}), tr:'×'+grp[k].n, metaCls:'lv', state:'ok',
    bottom:'<div class="cgTrash" onpointerdown="event.stopPropagation()" onpointerup="event.stopPropagation()" onclick="mainRemoveType(event,\''+k+'\')" title="이 종류 지정 해제">'+uiIco('untype')+'</div>',
    act:'onpointerdown="mainChipDown(event,\''+k+'\')" onpointerup="mainChipUp(event)" onpointerleave="mainChipCancel()" onpointercancel="mainChipCancel()" oncontextmenu="return false"' }));   // 짧게=소프트(전부 유지) · 꾹=그 종류만 분리 · 🗑=그 종류 해제
  if(typeof unitSkillKeys==='function'){ const sets=ord.map(k=>new Set(unitSkillKeys(grp[k].u)));   // 🪄 혼합 = 전 종류 공통 스킬(교집합)만 카드로(건설과 동일)
    const common=sets.length?[...sets[0]].filter(kk=>sets.every(s=>s.has(kk))):[];
    for(const kk of common){ const rep=list.filter(u=>unitSkillKeys(u).indexOf(kk)>=0);   // 그 스킬 보유 유닛 전부 기준으로 카드 상태 집계
      const c=_mainSkillCards(rep).find(x=>x._k===kk); if(c) items.push(c); } }
  return { mode:'prod', title:'유닛 '+list.length+'기', icon:_mainPort(list[0]), sub:'', items,
    info:{ hideName:true, statsScroll:true, stats:ord.map(k=>[gNameStar(grp[k].u,U[grp[k].u.id]||{}), '×'+grp[k].n]), cr:0, en:0 } }; }
function _mainEnemyModel(en){ const mk=(typeof ENEMY_MODEL!=='undefined')&&ENEMY_MODEL[en.name], img=mk&&PORTRAIT_IMG[mk];
  const port=img?('<img class="portImg" src="'+img+'" alt="" draggable="false">')
    :'<svg viewBox="0 0 24 24" width="46" height="46"><circle cx="12" cy="12" r="7" fill="none" stroke="#ff6a6a" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" fill="#ff6a6a"/></svg>';
  return { mode:'prod', title:en.name+' [적]', icon:port, hpsh:_mainEnemyHpsh(en), sub:(en.boss?'보스':(en.special?'스페셜':'공중')), items:[],
    info:{ eb:'', hideName:true, stats:[['방어력', ''+(en.ar||0)]], cr:0, en:0 } }; }
function _mainEnemyHpsh(en){ return _cgHpShStr(Math.max(0,Math.round(en.hp))+'/'+en.maxHp, (en.maxSh>0)?(Math.max(0,Math.round(en.sh))+'/'+en.maxSh):0, 0); }
function cmdGridModelForSel(){ const en=(G.selEnemy!=null)?G.enemies.find(x=>x.eid===G.selEnemy):null;
  if(en) return _mainEnemyModel(en);
  const list=G.sel.map(id=>G.units.find(u=>u.uid===id)).filter(Boolean);
  if(!list.length) return null;
  if(list.length===1) return _mainSingleModel(list[0]);
  const keys=[...new Set(list.map(_mainTypeKey))];
  if(keys.length===1) return _mainTypeModel(list);   // 동일 종류 = 그대로 타입 프로필
  if(G.selType && keys.indexOf(G.selType)>=0) return _mainTypeModel(list.filter(u=>_mainTypeKey(u)===G.selType), true);   // 👥 소프트선택 = 지정 전부 유지한 채 그 종류 프로필만(↩로 복귀)
  return _mainMixedModel(list); }
// 👥 종류 칩 상호작용 — 건설 탭(techSubSelectType/techSepSelectType/techChip*)과 동일 규약, 데이터만 메인(G.sel/G.units)
// 짧게 탭 = 소프트선택(전부 지정 유지 + 그 종류 프로필만 표시) · 꾹(TECH_HOLD_MS) = 분리(그 종류만 지정)
function mainSubSelectType(ev,key){ if(ev&&ev.stopPropagation) ev.stopPropagation();   // key 빈값 = 전체로 복귀(↩)
  G.selType=key||null; const host=document.getElementById('unitCmd'); if(host) host._cgPage=0;
  if(typeof playSfx==='function') playSfx('ui_open'); refreshSelCard(); }
function mainSepSelectType(key){ if(!key) return;   // 그 종류 유닛만 지정해 분리(나머지 해제)
  const uids=G.sel.map(id=>G.units.find(u=>u.uid===id)).filter(u=>u&&_mainTypeKey(u)===key).map(u=>u.uid);
  if(!uids.length) return; G.selType=null; const host=document.getElementById('unitCmd'); if(host) host._cgPage=0;
  selectMany(uids); if(typeof playSfx==='function') playSfx('ui_open'); if(typeof toast==='function') toast('👥 해당 종류만 분리'); }
function mainChipDown(ev,k){ if(ev&&ev.stopPropagation) ev.stopPropagation(); _chipSwallow=false; _chipK=k; _chipDone=false;
  if(_chipT) clearTimeout(_chipT);
  _chipT=setTimeout(()=>{ _chipT=null; if(_chipK===k){ _chipDone=true; _chipSwallow=true; mainSepSelectType(k); } }, TECH_HOLD_MS); }   // 유지 경과 = 손 안 떼도 즉시 분리 + 합성 click 삼킴
function mainChipUp(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(_chipT){ clearTimeout(_chipT); _chipT=null; }
  const k=_chipK, done=_chipDone; _chipK=null; _chipDone=false;
  if(k!=null && !done){ _chipSwallow=true; mainSubSelectType(ev,k); } }   // 유지 전 뗌 = 소프트선택
function mainChipCancel(){ if(_chipT){ clearTimeout(_chipT); _chipT=null; } _chipK=null; _chipDone=false; }
function mainRemoveType(ev,key){ if(ev&&ev.stopPropagation) ev.stopPropagation();
  const rest=G.sel.map(id=>G.units.find(u=>u.uid===id)).filter(u=>u&&_mainTypeKey(u)!==key).map(u=>u.uid);
  G.sel=rest; if(!rest.length) deselectUnit(); else refreshSelCard(); }
function mainSubSelectOne(ev,uid){ if(ev&&ev.stopPropagation) ev.stopPropagation(); selectMany([uid]); }
// 구조가 바뀔 때만 재렌더(매 프레임 innerHTML 재빌드 = 클릭 먹힘 → 시그니처 캐시) · HP 등 연속값은 아래 _mainCmdLive가 인플레이스 갱신
function _mainCmdSig(m){ if(!m) return '';
  const it=(m.items||[]).map(x=>x?((x.sn||'')+'|'+(x.state||'')+'|'+(x.sel?1:0)+'|'+(x.meta||'')+'|'+(x.tr||'')):'-').join(',');
  const inf=m.info||{}; const st=(inf.stats||[]).map(s=>s[0]+'='+s[1]).join(',');
  return (m.title||'')+'#'+(m.topRight?1:0)+'#'+(m.back?1:0)+'#'+it+'#'+st+'#'+((inf.units||[]).length); }
// 매 프레임 연속값만 패치(헤더 HP/S/E · 유닛 HP 칩)
function _mainCmdLive(){ const host=document.getElementById('unitCmd'); if(!host||!host._cgModel) return;
  const hs=host.querySelector('.cgHpsh');
  const en=(G.selEnemy!=null)?G.enemies.find(x=>x.eid===G.selEnemy):null;
  if(en){ if(hs) hs.innerHTML=_mainEnemyHpsh(en); return; }
  const list=G.sel.map(id=>G.units.find(u=>u.uid===id)).filter(Boolean);
  if(list.length===1 && hs) hs.innerHTML=_mainHpsh(list[0]);
  const chips=host.querySelectorAll('.cgUChip'); if(!chips.length) return;
  chips.forEach(ch=>{ const u=G.units.find(x=>x.uid===+ch.dataset.uid); if(!u){ ch.style.opacity='.35'; return; } ch.style.opacity='';
    const mh=_mainMaxHp(u)||1, hp=(u.hp!=null?u.hp:mh), r=Math.max(0,Math.min(1,hp/mh));
    const f=ch.querySelector('.cgUFill'); if(f){ f.style.width=(r*100)+'%'; f.style.background=hpBarColor(r); }
    const em=ch.querySelector('.cgUHp'); if(em) em.textContent=Math.round(hp)+'/'+Math.round(mh); }); }
function refreshSelCard(){ if(typeof G!=='undefined'){ G.boardArm=false; G.unloadArm=false; }
  if(G.bossOpen){   // ⚔ 토벌장: 트랙의 홈 자리를 보스방 전용 하단으로 대체. 선택·시트 로직 우회.
    updateDeselTop();
    const dc=document.getElementById('defaultCmd'), uc=document.getElementById('unitCmd');
    document.body.classList.add('sheetOpen'); if(typeof _syncSheetLift==='function') requestAnimationFrame(_syncSheetLift);
    if(G.bossDeployPick){   // 🎯 파견 선택 모드: 유닛 지정 패널(카드 탭 = 1기 즉시 파견)
      if(dc) dc.classList.remove('hide'); if(uc) uc.classList.remove('on');
      renderHomeLeft(); renderUnits(); return; }
    if(G.bossBldSel && !(G.coopBoss&&!G.coopBoss.dead)) G.bossBldSel=false;   // 건물 파괴/부재 시 지정 자동 해제
    if(G.bossBldSel){   // 🏢 건물 지정 → 간단 프로필
      if(dc) dc.classList.add('hide'); if(uc) uc.classList.add('on');
      renderBossBldProfile(); renderUnits(); return; }
    if(dc) dc.classList.add('hide'); if(uc) uc.classList.add('on');
    renderBossArenaSheet(); renderUnits(); return; }
  const en = G.selEnemy!=null ? G.enemies.find(x=>x.eid===G.selEnemy) : null;
  updateDeselTop(); // 우상단 해제버튼(탭별)
  updateCmdRow();   // 명령 버튼 행(홀드/공격이동/지정공격/반복이동)
  if(typeof updateTransportBtns==='function') updateTransportBtns();   // 수송 유닛 태우기/내리기 버튼
  updateSkillFab(); // 메인 화면 스킬 버튼
  if(typeof updateAutoFab==='function') updateAutoFab();   // 자동 설정 배너(선택 시 숨김 — 해제버튼과 자리 공유)
  if(G.sandbox && G.tab==='Main'){   // 관리자 메인: 홈 지정/판매 패널 미사용 — 무선택=아무것도(시트 내려감), 유닛 지정=프로필 시트 올라옴
    const hasSel=(G.sel.length>=1 || !!en);
    document.body.classList.toggle('sheetOpen', hasSel); if(typeof _syncSheetLift==='function') requestAnimationFrame(_syncSheetLift);
    document.getElementById('defaultCmd').classList.add('hide');
    if(!hasSel){ document.getElementById('unitCmd').classList.remove('on'); renderUnits(); return; }
    // 선택됨 → 아래 유닛 프로필(unitCmd) 렌더로 진행
  } else {
    if(G.sel.length>=1 || en){ G.sheetDown=false; }   // 🎛 유닛/적 지정 = 메인 시트(유닛뽑기·업그레이드) 잠시 숨김(프로필 표시) — 시트 상태는 유지해 지정 해제 시 원래 섹션 복원
    if(G.tab==='Main' && G.mainSheet && !en && G.sel.length===0){   // 🎛 메인 시트: 프로필 자리에 해당 그리드
      document.getElementById('defaultCmd').classList.add('hide');
      document.getElementById('unitCmd').classList.add('on');
      document.body.classList.toggle('sheetOpen', !G.sheetDown); if(typeof _syncSheetLift==='function') requestAnimationFrame(_syncSheetLift);   // 재탭으로 접었으면(G.sheetDown) 매프레임 재오픈 안 함
      renderMainSheet(); renderUnits(); return; }
    if(G.tab==='Main' && _selViaTab && !en && G.sel.length>=1){   // 하단 지정구역 경유 선택 → 홈 패널 유지(지정/판매/조합 어느 탭이든). 프로필은 화면 직접 터치 시에만
      document.getElementById('defaultCmd').classList.remove('hide');
      document.getElementById('unitCmd').classList.remove('on'); renderHomeLeft(); renderUnits(); return; }
    if(G.sel.length===0 && !en){ document.getElementById('defaultCmd').classList.remove('hide');
      document.getElementById('unitCmd').classList.remove('on'); renderHomeLeft(); renderUnits(); return; }
  }
  document.getElementById('defaultCmd').classList.add('hide');
  document.getElementById('unitCmd').classList.add('on');
  mainProfileRender();
  renderUnits();
}
// 🎛 메인 선택 프로필 렌더 — 선택 변경(refreshSelCard) + 매 프레임(루프) 양쪽에서 호출.
// 구조 시그니처가 바뀔 때만 재빌드(매 프레임 innerHTML 재빌드=클릭 먹힘 방지) · HP 등 연속값은 _mainCmdLive가 인플레이스 갱신
function mainProfileRender(){ const host=document.getElementById('unitCmd'); if(!host||!host.classList.contains('on')) return;
  if(G.mainSheet && G.sel.length===0 && G.selEnemy==null){ renderMainSheet(); return; }   // 🎛 메인 시트 모드(유닛뽑기·업그레이드) — 무선택일 때만 그리드. 지정 중엔 프로필 우선(해제 시 시트 복원)
  host._gSig=undefined;   // 시트→프로필 전환 시 다음 렌더 강제 재빌드
  { const k=(G.selEnemy!=null)?('e'+G.selEnemy):((G.sel||[]).join(',')); if(k!==G._lastSelKey){ G.selType=null; host._cgPage=0; G._lastSelKey=k; } }   // 지정이 실제로 바뀌면 소프트선택(selType)·페이지 리셋 · 칩 탭(G.sel 불변)은 유지
  const m=cmdGridModelForSel(); if(!m) return;
  m.compact=true; m.build=true;   // 건설 탭 프로필과 동일: 간소화(4그리드 1줄) + 건설 카드 스타일
  host.classList.add('simple');   // 건설 시트 .simple과 동일한 126px 고정 높이
  const sig=_mainCmdSig(m);
  if(host._cgSig!==sig){ host._cgSig=sig; m.page=host._cgPage||0; renderCmdGrid(host,m); }
  _mainCmdLive(); }
// 🎰 유닛뽑기 시트 — 하단 프로필 자리(#unitCmd)에 4그리드(유닛1회·에너지·미사일 포탑·에너지 타워). 캔버스 이동 대신 시트 슬라이드업. 셀=runBeacon 직접 실행.
// 하위 구역별 칸 목록 — 하단 네비(GTAB_TREE.Unit)가 고르는 그 키다
const GACHA_SEC_CELLS={ draw:['draw','draw5','energy','energy5'], tower:['buyTurret','buyPhoton'] };
const GACHA_SEC_INFO={ draw:{ name:'유닛 및 가스 뽑기', desc:'길게 누르면 연속 구매' },
                       tower:{ name:'방어 타워 구매',   desc:'길게 누르면 연속 구매' } };
const BLDG_ICON_DIR='assets/icons/buildings/';
const BEACON_ICON_IMG={
  buyTurret:'buildings/bld_turret.webp', buyPhoton:'buildings/bld_cannon.webp',
  draw:'auto/auto_unit.webp',      // 유닛 1회 = 자동 유닛 소환과 같은 뜻 — 한 장을 공유
  energy:'auto/auto_energy.webp',  // 가스 1회 = 자동 가스 변환과 같은 뜻
  draw5:'auto/auto_unit.webp', energy5:'auto/auto_energy.webp',   // ×5 는 같은 그림 + 이름으로 구분(새 에셋을 만들지 않는다)
  gachaUp:'upgrades/up_gacha_up.webp', creditUp:'upgrades/up_mineral_up.webp', perm:'upgrades/up_perm.webp'
};   // 값 = assets/icons/ 하위 경로. 같은 뜻은 새로 만들지 않고 공유한다(SKILL_ICO와 같은 규칙)   // 구매 타워 = 실제 건물 아이콘(미사일 포탑=미사일 터렛 · 에너지 타워=포톤 캐논)
function beaconProHTML(id){ const f=BEACON_ICON_IMG[id];   // 업그레이드 아이콘(wpnBadgeHTML)과 동일 패턴 — 이미지 우선, 없으면 기존 SVG
  if(f) return '<img class="cgIco" src="assets/icons/'+f+'" alt="" draggable="false" data-fb="'+id+'" onerror="_beaconFail(this)">';
  return '<svg viewBox="0 0 24 24">'+beaconIcon(id)+'</svg>'; }
// 파일이 아직 없을 때: 원래 쓰던 비콘 SVG로 교체(빈칸 방지)
function _beaconFail(im){ try{ im.outerHTML='<svg viewBox="0 0 24 24">'+beaconIcon(im.getAttribute('data-fb'))+'</svg>'; }catch(_e){ try{ im.remove(); }catch(_e2){} } }
function _beaconLabel(id){ const bulk=BEACON_BULK[id]; if(bulk) return bulk.name;
  const b=DRAW_BEACONS.find(x=>x.id===id); return (b&&b.name)||id; }
function _gachaSheetModel(){
  const cells=GACHA_SEC_CELLS[_gachaSec]||GACHA_SEC_CELLS.draw;
  const items=cells.map(id=>{ const cost=beaconCost(id), afford=((G.mineral||0)>=cost);
    return { pro:beaconProHTML(id), sn:_beaconLabel(id), cr:cost, en:0, state:afford?'ok':'dim', act:'onpointerdown="gachaHoldStart(\''+id+'\',event)"' }; });
  return { mode:'gacha', title:'유닛 뽑기', icon:'<svg viewBox="0 0 24 24">'+BEACON_ICON.unit+'</svg>', sub:'', compact:true, build:true,
    info:Object.assign({eb:''}, GACHA_SEC_INFO[_gachaSec]||GACHA_SEC_INFO.draw), items:items }; }
function renderGachaSheet(){ const host=document.getElementById('unitCmd'); if(!host) return; host.classList.add('simple');
  const sig='g|'+_gachaSec+'|'+Math.floor(G.mineral||0)+'|'+(host._cgPage||0);
  if(host._gSig!==sig){ host._gSig=sig; host._cgSig=undefined; renderCmdGrid(host, _gachaSheetModel()); } }
// ⚔ 토벌장(보스방) 하단 시트 — 트랙 홈 대신. 4그리드: 파견슬롯1·2(빈=파견 선택 / 채워짐=다중지정 프로필 카드+휴지통) · 전체회수 · 돌아가기.
const _PIN_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.2-6.5-11a6.5 6.5 0 0 1 13 0c0 5.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';
const _RECALL_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15 4 10l5-5"/><path d="M4 10h11a5 5 0 0 1 0 10h-4"/></svg>';
const _BACK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6"/><path d="M3 12h13a5 5 0 0 1 5 5v1"/></svg>';
function _bossArenaSlot(i){ const dep=G.units.filter(u=>u.atBoss), u=dep[i], hasBoss=!!(G.coopBoss&&!G.coopBoss.dead);
  if(u){ const id=u.gmodel||u.id, def=U[u.id]||{}, nm=u.gname||def.name||id;   // 채워짐 = 다중지정 카드 그대로(초상화+이름+휴지통). 파견N·탭=회수 텍스트 없음
    return { pro:unitPortraitHTML(id), sn:nm, metaCls:'lv', state:'ok',
      bottom:'<div class="cgTrash" onpointerdown="event.stopPropagation()" onpointerup="event.stopPropagation()" onclick="bossRecallSlot(event,'+i+')" title="회수">'+uiIco('untype')+'</div>', act:'' }; }
  return { pro:bossIcoHTML('deploy'), sn:'파견', state:hasBoss?'ok':'dim', act:'onclick="bossSlotTap('+i+')"' }; }
// 🏢 포인트방 건물 프로필 — 이름 + 체력 + 처치 포인트(간단). 관리자 건물 프로필과 동일한 build 카드.
const _BLD_ICON_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M4 20h16M6 20V9l6-4 6 4v11M9.5 20v-5h5v5"/></svg>';
// ⚔ 보스방 칸 아이콘 — 이미지 우선, 없으면 원래 쓰던 SVG로 되돌린다(beaconProHTML과 같은 규칙).
// head는 새로 만들지 않고 자동화 해골을 공유한다.
const BOSS_ICON_IMG={ deploy:'boss/boss_deploy.webp', recall:'boss/boss_recall.webp', back:'boss/boss_back.webp', bld:'boss/boss_bld.webp', head:'auto/auto_bossdeploy.webp' };
function bossIcoSvg(k){ return k==='deploy'?('<svg viewBox="0 0 24 24">'+_PIN_SVG+'</svg>') : k==='recall'?_RECALL_SVG : k==='back'?_BACK_SVG : k==='bld'?_BLD_ICON_SVG : pIco('\u{1F480}'); }
function bossIcoHTML(k){ const f=BOSS_ICON_IMG[k]; if(!f) return bossIcoSvg(k);
  return '<img class="cgIco" src="assets/icons/'+f+'" alt="" draggable="false" data-fb="'+k+'" onerror="_bossIcoFail(this)">'; }
function _bossIcoFail(im){ try{ im.outerHTML=bossIcoSvg(im.getAttribute('data-fb')); }catch(_e){ try{ im.remove(); }catch(_e2){} } }
function _bossBldReward(){ const cb=G.coopBoss||{}; const mul=1+((typeof buildLevel==='function'?buildLevel('boss_reward_up'):0)*0.1);
  return Math.max(1, Math.round((cb.lv||1)*mul)); }
function _bossBldProfileModel(){ const cb=G.coopBoss||{};
  const hp=Math.max(0,Math.round(cb.hp||0)), mx=cb.max||0, coins=_bossBldReward();
  const nm=((typeof coinBldgName==='function')?coinBldgName(cb.lv):null)||cb.name||'포인트 시설';
  return { mode:'prod', title:nm, icon:bossIcoHTML('bld'), sub:'포인트 건물', items:[],
    hpsh:_cgHpShStr(hp.toLocaleString()+' / '+mx.toLocaleString(),0,0),
    info:{ eb:'', hideName:true, stats:[ ['단계', 'Lv.'+(cb.lv||1)], ['처치 포인트', '+'+coins+' (전원 동일)'] ], cr:0, en:0 } }; }
function renderBossBldProfile(){ const host=document.getElementById('unitCmd'); if(!host) return; host.classList.add('simple');
  const cb=G.coopBoss||{}; const sig='bbp|'+Math.round(cb.hp||0)+'|'+(cb.max||0)+'|'+(cb.lv||1)+'|'+_bossBldReward();
  if(host._gSig!==sig){ host._gSig=sig; host._cgSig=undefined; renderCmdGrid(host, _bossBldProfileModel()); } }
// 4칸 = [파견1][파견2][빈칸][전체 회수]. '돌아가기' 칸은 없앴다 — 나가기는 하단 네비의 ‹ 하나뿐이다(2026-08-14).
function _bossArenaSheetModel(){ const dep=G.units.filter(u=>u.atBoss);
  const items=[ _bossArenaSlot(0), _bossArenaSlot(1), null,
    { pro:bossIcoHTML('recall'), sn:'전체 회수', state:(dep.length>0?'ok':'dim'), act:'onclick="recallFromBoss(\'all\')"' } ];
  return { mode:'bossArena', title:'포인트방', icon:bossIcoHTML('head'), sub:'', compact:true, build:true,
    info:{ eb:'', name:'포인트 획득 방', desc:'건물 파괴로 포인트 획득 · 모두 동일' }, items:items }; }
function renderBossArenaSheet(){ const host=document.getElementById('unitCmd'); if(!host) return; host.classList.add('simple');
  const dep=G.units.filter(u=>u.atBoss);
  const sig='ba|'+dep.map(u=>u.uid+':'+(u.gmodel||u.id)).join(',')+'|'+(!!(G.coopBoss&&!G.coopBoss.dead)?1:0)+'|'+(host._cgPage||0);
  if(host._gSig!==sig){ host._gSig=sig; host._cgSig=undefined; renderCmdGrid(host, _bossArenaSheetModel()); } }
// 빈 파견 슬롯 탭 → 파견 선택 모드(트랙 유닛 지정 패널 재사용). 채워진 슬롯은 카드 휴지통으로 회수.
function bossSlotTap(i){ if(!(G.coopBoss&&!G.coopBoss.dead)){ toast('ℹ️ 활성 보스가 없습니다'); return; }
  if(bossDeployedCount()>=BOSS_DEPLOY_CAP){ toast('⚠️ 보스방 파견은 최대 '+BOSS_DEPLOY_CAP+'기입니다'); return; }
  startBossDeployPick(); }
function bossRecallSlot(ev,i){ if(ev&&ev.stopPropagation) ev.stopPropagation();
  const dep=G.units.filter(u=>u.atBoss), u=dep[i]; if(u) recallUnitFromBoss(u); }
function recallUnitFromBoss(u){ if(!u||!u.atBoss) return; u.atBoss=false;
  if(typeof _baSel!=='undefined') _baSel=_baSel.filter(id=>id!==u.uid);
  if(typeof playSfx==='function') playSfx('ui_close'); renderBossPanel(); }
// 🎯 파견 선택 모드 — 메인 홈의 '유닛 지정' 패널 그대로. 카드 탭 = 그 종류 1기만 즉시 파견(지정·확정 없음).
function startBossDeployPick(){ G.bossDeployPick=true; G.sel=[]; G.selEnemy=null; _selViaTab=false;
  if(typeof setHomeMode==='function') setHomeMode('select'); else _homeMode='select';
  if(typeof playSfx==='function') playSfx('ui_open'); refreshSelCard(); }
function bossDeployExit(){ G.bossDeployPick=false; G.sel=[]; G.selEnemy=null; _selViaTab=false; refreshSelCard(); }
function bossDeployCancel(){ if(typeof playSfx==='function') playSfx('ui_close'); bossDeployExit(); }
// 카드(종류) 탭 → 그 종류 1기만 파견 후 즉시 4그리드로 복귀
function bossDeployOne(gid){ if(!(G.coopBoss&&!G.coopBoss.dead)){ toast('ℹ️ 활성 보스가 없습니다'); return; }
  if(bossDeployedCount()>=BOSS_DEPLOY_CAP){ toast('⚠️ 보스방 파견은 최대 '+BOSS_DEPLOY_CAP+'기입니다'); bossDeployExit(); return; }
  const u=G.units.find(x=>x.gid===gid && !x.fixed && !x.atBoss);
  if(!u){ toast('ℹ️ 파견할 유닛이 없습니다'); return; }
  deployUnitToBoss(u); if(typeof playSfx==='function') playSfx('place_unit'); bossDeployExit(); }
// ⬆️ 업그레이드 시트 — 하단 프로필 자리에 8칸(2페이지). 1p: 보병·메카닉·스웜·에테리얼 무기 강화(꾹=연속). 2p: 뽑기확률·크레딧획득·(빈)·영구강화(팝업).
const UPG_CATS=[ {wpn:'inf',name:'보병'}, {wpn:'mech',name:'메카닉'}, {wpn:'zrg',name:'스웜'}, {wpn:'pro',name:'에테리얼'} ];
// 하위 구역별 칸 — 하단 네비(GTAB_TREE.Upgrade)가 고르는 그 키다.
// 전에는 7칸을 한 격자에 몰아넣고 1/2 페이지로 넘겼는데, 지금은 구역이 페이지를 대신한다.
const UPG_SEC_INFO={ atk:{ name:'공격력 강화',   desc:'길게 누르면 연속 구매' },
                     luck:{ name:'획득 확률 강화', desc:'뽑기 등급과 미네랄 수급' },
                     perm:{ name:'영구 강화',     desc:'판이 끝나도 남는 강화' } };
function _upgAtkItems(){
  return UPG_CATS.map(c=>{ const lv=(G.atkLv&&G.atkLv[c.wpn])||0, isMax=lv>=UPG_MAX, cost=upgCost(c.wpn), afford=((G.gas||0)>=cost);
    return { pro:wpnBadgeHTML(c.wpn,'#ff3b3b'), sn:c.name, en:cost, cr:0, sub:isMax?'MAX':('Lv.'+lv),
      bottom:'<div class="cgCost">'+(isMax?'':('<span class="cc en">'+resIco('gas')+_cgFmt(cost)+'</span>'))+'</div>',
      state:isMax?'max':(afford?'ok':'dim'), act:isMax?'':('onpointerdown="upgHoldStart(\''+c.wpn+'\',event)"') }; }); }
function _upgLuckItems(){
  const gLv=(G.gachaLuckLv||0), gMax=gLv>=GACHA_UP_MAX, gC=gachaUpCost();
  const cLv=(G.creditLv||0), cMax=cLv>=CREDIT_UP_MAX, cC=creditUpCost();
  return [
    { pro:beaconProHTML('gachaUp'), sn:'뽑기 확률', cr:gC, en:0, sub:gMax?'MAX':('Lv.'+gLv),
      bottom:'<div class="cgCost">'+(gMax?'':('<span class="cc cr">'+resIco('mineral')+_cgFmt(gC)+'</span>'))+'</div>',
      state:gMax?'max':(((G.mineral||0)>=gC)?'ok':'dim'), act:gMax?'':'onclick="buyGachaUp()"' },
    { pro:beaconProHTML('creditUp'), sn:'미네랄 획득', cr:cC, en:0, sub:cMax?'MAX':('Lv.'+cLv),
      bottom:'<div class="cgCost">'+(cMax?'':('<span class="cc cr">'+resIco('mineral')+_cgFmt(cC)+'</span>'))+'</div>',
      state:cMax?'max':(((G.mineral||0)>=cC)?'ok':'dim'), act:cMax?'':'onclick="buyCreditUp()"' } ]; }
function _upgPermItems(){
  return [{ pro:beaconProHTML('perm'), sn:'영구 강화', cr:0, en:0, state:'ok', act:'onclick="openPointUpgrade()"' }]; }
function _upgradeSheetModel(){
  const items=(_upgSec==='luck')?_upgLuckItems():(_upgSec==='perm')?_upgPermItems():_upgAtkItems();
  return { mode:'upg', title:'업그레이드', icon:pIco('PERM'), sub:'', compact:true, build:true,
    info:Object.assign({eb:''}, UPG_SEC_INFO[_upgSec]||UPG_SEC_INFO.atk), items:items }; }
function renderUpgradeSheet(){ const host=document.getElementById('unitCmd'); if(!host) return; host.classList.add('simple');
  const sig='u|'+_upgSec+'|'+((G.atkLv&&[G.atkLv.inf,G.atkLv.mech,G.atkLv.zrg,G.atkLv.pro].join('.'))||'')+'|'+(G.gachaLuckLv||0)+'|'+(G.creditLv||0)+'|'+Math.floor(G.mineral||0)+'|'+Math.floor(G.gas||0)+'|'+(host._cgPage||0);
  if(host._gSig!==sig){ host._gSig=sig; host._cgSig=undefined; renderCmdGrid(host, _upgradeSheetModel()); } }
// ═══ 공통 관전 플레이어 시트 빌더(단일 소스) — 협동/대전(versus)을 옵션으로. 네모·오토배틀·향후 유즈맵 공용 ═══
//   cfg: { me, active[], names{}, versus, team(n), color(n), portrait(n,o), nameOf(n), badgeOf(n,o), watchingOf(n),
//          selOf(n,isMe), pickAttr(n), selfPickable, selfState, mode, title, icon, sub, info }
//   o = {isMe, enemy, watching, col} (카드별 상태). versus=true면 team(n)!==team(me) = 적(잠금).
function playerSheetModel(cfg){
  const me=cfg.me, active=(cfg.active&&cfg.active.length)?cfg.active:[me], names=cfg.names||{};
  const myTeam=cfg.versus?cfg.team(me):null;
  const items=active.map(function(n){
    const isMe=(n===me), enemy=cfg.versus?(cfg.team(n)!==myTeam):false, watching=cfg.watchingOf?!!cfg.watchingOf(n):false;
    const clickable=!enemy && (isMe?(cfg.selfPickable!==false):true), col=cfg.color?cfg.color(n):'#7fd0ff';
    const o={isMe:isMe, enemy:enemy, watching:watching, col:col};
    return { pro:cfg.portrait?cfg.portrait(n,o):('<span class="pemoji">'+n+'P</span>'),
      sn:cfg.nameOf?cfg.nameOf(n):(names[n]||(n+'P')),
      tr:cfg.badgeOf?cfg.badgeOf(n,o):(isMe?'현재':(n+'P')), metaCls:'lv',
      state:enemy?'dim':(clickable?((isMe&&cfg.selfState)?cfg.selfState:'ok'):'max'),
      sel:watching||(cfg.selOf?!!cfg.selOf(n,isMe):false),
      act:clickable?cfg.pickAttr(n):'' }; });
  return { mode:cfg.mode||'players', title:cfg.title||'플레이어', icon:cfg.icon||pIco('👥'), sub:cfg.sub||'',
    compact:true, build:true, info:cfg.info||{ eb:'플레이어', hideName:true, desc:'' }, items:items }; }
// 👥 네모(협동) 플레이어 시트 — 나 빼고 전부 관전 가능. 셀 탭 = 그 플레이어 화면.
function _playersSheetModel(){ const me=G.myPlayer||1;
  // 아군/적군은 팀이 갈리는 판에서만 나뉜다(gameHasVersus). 개인전·협동은 전원 아군이라 하위 네비 자체가 안 뜨고
  // _plSec 는 'ally' 로 남으므로 아래 필터는 전원 통과 = 지금까지와 같은 목록이다.
  const versus=(typeof gameHasVersus==='function')&&gameHasVersus(), teams=G.teams||{};
  const list=(G.activePlayers||[1,2,3,4,5,6,7,8]).filter(function(n){
    if(!versus) return true;
    const foe=(teams[n]!==teams[me]);
    return (_plSec==='foe')?foe:!foe; });
  return playerSheetModel({ me:me, active:list, versus:versus, team:function(n){ return teams[n]; },
    selfPickable:false, selfState:'max',
    nameOf:function(n){ return (typeof playerName==='function'?playerName(n):('P'+n))+(n===me?' (나)':''); },
    badgeOf:function(n,o){ return o.isMe?'현재':'관전'; },
    selOf:function(n,isMe){ return isMe && n===G.curPlayer; },
    portrait:function(n){ return '<span class="pemoji">'+n+'P</span>'; },
    pickAttr:function(n){ return 'onclick="viewPlayerFromSheet('+n+')"'; },
    mode:'players', title:'플레이어', icon:pIco('👥'), sub:'다른 플레이어 화면 보기',
    info:{ eb:'플레이어', name:'다른 플레이어 관전', desc:'플레이어를 눌러 그 화면으로 이동' } }); }
function renderPlayersSheet(){ const host=document.getElementById('unitCmd'); if(!host) return; host.classList.add('simple');
  const sig='p|'+_plSec+'|'+(G.myPlayer||1)+'|'+((G.activePlayers||[]).join('.'))+'|'+(G.curPlayer||0)+'|'+(host._cgPage||0);
  if(host._gSig!==sig){ host._gSig=sig; host._cgSig=undefined; renderCmdGrid(host, _playersSheetModel()); } }
function viewPlayerFromSheet(n){ G.curPlayer=n; if(typeof playSfx==='function') playSfx('ui_open'); switchTab('Players', document.querySelector('.tab[data-tab="Players"]')); }
// 💀 보스 시트 — 개인보스 소환(4종) 전용. 포인트방(파견·회수·토벌장)은 우상단 공용보스 바 클릭 팝업으로 분리.
function _bossSkullSVG(col){ return '<svg viewBox="0 0 24 24" style="color:'+(col||'#ff9aa6')+'"><path d="M12 2.5c-4 0-6.5 2.8-6.5 6.4 0 2.3 1.1 3.7 2.2 4.7v2.2c0 .7.5 1.1 1.2 1.1.4 1.1 1.6 1.9 3.1 1.9s2.7-.8 3.1-1.9c.7 0 1.2-.4 1.2-1.1v-2.2c1.1-1 2.2-2.4 2.2-4.7 0-3.6-2.5-6.4-6.5-6.4z" fill="currentColor" opacity=".22"/><path d="M12 2.5c-4 0-6.5 2.8-6.5 6.4 0 2.3 1.1 3.7 2.2 4.7v2.2c0 .7.5 1.1 1.2 1.1.4 1.1 1.6 1.9 3.1 1.9s2.7-.8 3.1-1.9c.7 0 1.2-.4 1.2-1.1v-2.2c1.1-1 2.2-2.4 2.2-4.7 0-3.6-2.5-6.4-6.5-6.4z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="9.3" cy="9.2" r="1.5" fill="currentColor"/><circle cx="14.7" cy="9.2" r="1.5" fill="currentColor"/></svg>'; }
function _bossSheetModel(){
  const coinMult=(DIFFICULTY[G.difficulty]||DIFFICULTY.normal).coinMult||1, autoAvail=autoUsable('pboss');
  const items=PBOSS_TYPES.map(function(pt){
    const unlocked=pbossUnlocked(pt), active=G.enemies.some(e=>e.pboss&&e.pbId===pt.id), cd=Math.ceil((G.pbossCds&&G.pbossCds[pt.id])||0);
    const autoOn=!!(G.auto&&G.auto.pboss&&G.auto.pboss[pt.id]);
    let state='ok', tr=autoOn?'⟳':'';
    if(!unlocked){ state='dim'; tr=pIco('🔒','sm'); }
    else if(active){ state='dim'; tr=autoOn?'⟳⚔':'⚔'; }
    else if(cd>0){ state='dim'; tr=(autoOn?'⟳ ':'')+cd+'s'; }
    // 소환은 무료(코스트 표기 생략 — 크레딧 가격으로 오인 방지) · 하단 줄엔 처치 보상을 '+' 초록으로(획득 신호)
    return { pro:_bossSkullSVG(pt.col), sn:pt.name, cr:0, en:0, tr:tr, metaCls:'lv', state:state, sel:autoOn,
      bottom:'<div class="cgCost cgRwd" title="처치 보상: 포인트 '+Math.round(pt.bonus*coinMult)+' · 에너지 '+(pt.egy||0)+'"><span>+'+COIN_SM+Math.round(pt.bonus*coinMult)+'</span></div>',
      act:'onpointerdown="bossHoldStart(\''+pt.id+'\',event)"' }; });
  const info={ eb:'', name:'개인보스 소환', desc:autoAvail?'길게 = 자동소환':'셀을 눌러 소환' };
  return { mode:'boss', title:'개인보스', icon:bossIcoHTML('head'), sub:'', compact:true, build:true, info:info, items:items }; }
function renderBossSheet(){ const host=document.getElementById('unitCmd'); if(!host) return; host.classList.add('simple');
  const sig='b|'+PBOSS_TYPES.map(pt=>(pbossUnlocked(pt)?1:0)+''+(G.enemies.some(e=>e.pboss&&e.pbId===pt.id)?1:0)+Math.ceil((G.pbossCds&&G.pbossCds[pt.id])||0)+((G.auto&&G.auto.pboss&&G.auto.pboss[pt.id])?'a':'')).join('')+'|'+(host._cgPage||0);
  if(host._gSig!==sig){ host._gSig=sig; host._cgSig=undefined; renderCmdGrid(host, _bossSheetModel()); } }
// 보스 셀: 탭=개인보스 소환 · 길게(0.5s)=자동소환 토글(자동 개인보스 해금 시). 손 떼기 처리는 문서 전역에서.
let _bossHold=null;
function bossHoldStart(id, ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  bossHoldClear(); _bossHold={id:id, held:false};
  const pt=PBOSS_TYPES.find(t=>t.id===id);
  if(autoUsable('pboss') && pt && pbossUnlocked(pt)){
    _bossHold.t=setTimeout(function(){ if(_bossHold&&_bossHold.id===id){ _bossHold.held=true; togglePbossAuto(null, id);
      const h=document.getElementById('unitCmd'); if(h){ h._gSig=undefined; renderBossSheet(); } } }, 500); } }
function bossHoldEnd(){ if(!_bossHold) return; const id=_bossHold.id, held=_bossHold.held; bossHoldClear(); if(!held) summonPersonalBoss(id); }
function bossHoldClear(){ if(_bossHold){ if(_bossHold.t) clearTimeout(_bossHold.t); _bossHold=null; } }
['pointerup','pointercancel'].forEach(e=>document.addEventListener(e, bossHoldEnd));
window.addEventListener('blur', bossHoldClear);
// 🎛 메인 시트 모드 디스패처(유닛뽑기·업그레이드·플레이어·보스 …) — 매 프레임/선택변경 시 해당 그리드 렌더
function renderMainSheet(){ if(G.mainSheet==='gacha') renderGachaSheet(); else if(G.mainSheet==='upgrade') renderUpgradeSheet(); else if(G.mainSheet==='players') renderPlayersSheet(); else if(G.mainSheet==='boss') renderBossSheet(); else if(G.mainSheet==='auto') renderAutoSheet(); }
// 하단 탭 하이라이트 = 활성 섹션(메인/유닛뽑기/업그레이드/플레이어). 게임 화면과 무관하게 섹션 탭만 표시.
function _setBottomTab(tab){ document.querySelectorAll('#tabs .tab').forEach(function(t){ t.classList.toggle('on', t.getAttribute('data-tab')===tab); }); }
// ══ 인게임 하단 탭 = 2층(최상위 5칸 → 구역 전용) ═══════════════════════════
// HOME 네비(NAV_TREE + navPaint)와 **같은 구조·같은 칸**이다 — 하위 칸은 `_navCell()` 로 만든다.
// ⛔ 여기에 새 버튼 스타일이나 두 번째 탭 띠를 만들지 말 것. 생김새는 .navIt 하나가 단일 소스.
// 최상위 .tab 마크업은 건드리지 않는다: 내려가면 CSS(#tabs.drill .tab)가 숨기고, 올라오면 그대로 살아난다.
//   sub.cur 가 가리키는 키와 같은 칸이 .cur 로 표시된다. show() 가 false 인 하위는 아예 안 나온다.
//   하위가 하나도 없는 구역(전투실험·건설 등 관리자 탭)은 내려가지 않는다.
const GTAB_TREE={
  // ⚠ '유닛 지정'은 여기 없다 — 아무 구역도 안 고른 **기본 상태**(gameRestHome)가 그 자리다.
  //   메인 = 유닛을 처분·정리하는 묶음(판매·조합·자동화).
  // 자동화는 _homeMode 가 아니라 시트 모드(G.mainSheet==='auto')다 — cur 에서 그것부터 본다
  Main:    { cur:()=>(G.mainSheet==='auto'?'auto':_homeMode), reset:()=>mainGoMode('sell'), subs:[
      { k:'sell',    label:'유닛 판매', ico:'coin',   act:()=>mainGoMode('sell') },   // ← 첫 칸(reset 대상)
      // 조합은 늘 자리를 지킨다 — 조합할 게 없으면 칸이 사라지는 게 아니라 판이 '3개 필요'라고 알린다
      { k:'combine', label:'유닛 조합', ico:'photon', act:()=>mainGoMode('combine') },
      // 자동화 = 옛 '전송 옆 AUTO 배너'. 표시 조건도 그 배너가 쓰던 것 그대로(하나라도 해금됐을 때)
      { k:'auto',    label:'자동화',   ico:'cpu',    act:()=>openAutoSheet(),
        show:()=>autoAnyOwned() } ] },
  Unit:    { cur:()=>_gachaSec, reset:()=>setGachaSec('draw'), subs:[
      { k:'draw',  label:'뽑기',     ico:'gift',   act:()=>setGachaSec('draw') },
      { k:'tower', label:'타워구매', ico:'sunken', act:()=>setGachaSec('tower') } ] },
  Upgrade: { cur:()=>_upgSec, reset:()=>setUpgSec('atk'), subs:[
      { k:'atk',  label:'공격력',   ico:'boost', act:()=>setUpgSec('atk') },
      { k:'luck', label:'확률',     ico:'rand',  act:()=>setUpgSec('luck') },
      { k:'perm', label:'영구강화', ico:'upg',   act:()=>setUpgSec('perm') } ] },
  Boss:    { cur:()=>(G.bossOpen?'arena':'pboss'), subs:[
      { k:'pboss', label:'개인보스', ico:'dungeon', act:()=>{ if(G.bossOpen) closeBossArena(); openBossSheet(); } },
      // 포인트방은 '섹션'이 아니라 화면 전환이다 — 공용 보스가 살아 있을 때만 나온다
      { k:'arena', label:'포인트방', ico:'flag', act:()=>openBossArena(),
        show:()=>!!(G.coopBoss && !G.coopBoss.dead) } ] },
  // 아군/적군은 대전(팀이 갈리는 판)에서만 뜻이 있다 — 개인전·협동은 전원 아군이라 하위를 두지 않는다
  Players: { cur:()=>_plSec, reset:()=>setPlSec('ally'), subs:[
      { k:'ally', label:'아군', ico:'friend', act:()=>setPlSec('ally') },
      { k:'foe',  label:'적군', ico:'cpu',   act:()=>setPlSec('foe') } ],
      show:()=>gameHasVersus() },
};
// ══ 오토배틀(직스) 하단 탭 트리 ══
// 같은 페인터를 쓰고 표만 갈아 끼운다 — 칸 생김새·‹ 동작·리셋 규칙이 네모와 하나다.
//   전투는 탭이 아니라 **무선택 기본 화면**이다(‹ 가 여기로 돌아온다).
const STK_TREE={
  // 🏗 건설지 = 관리자 건설 화면(#vBuild + G.tech). '강화'는 그 화면 위에서 하단 시트만 바뀐다.
  Build:   { cur:()=>(STK&&STK.supSheet?'upg':'build'), reset:()=>stkGoBuild(), subs:[
      { k:'build', label:'건설', ico:'build', act:()=>stkGoBuild() },
      { k:'upg',   label:'강화', ico:'boost', act:()=>stkGoUpg() } ] },
  // 💥 특수무기 = 화면 이동 없이 하단 시트만(전장을 계속 본다)
  Upgrade: { cur:()=>(STK&&STK.supPage==='wpnUse'?'use':'buy'), reset:()=>stkGoWpn('buy'), subs:[
      { k:'buy', label:'구입', ico:'coin', act:()=>stkGoWpn('buy') },
      { k:'use', label:'사용', ico:'boost', act:()=>stkGoWpn('use') } ] },
  // 👁 관전은 하위가 없다 — 옛 동작(시트 토글) 그대로
};
let _gtabDrill='';   // 내려가 있는 구역('' = 최상위 칸들)
// 이 구역이 지금 실제로 보여줄 하위 목록(show() 통과분). 0개면 내려갈 것이 없다.
// 지금 모드의 트리 — 네모 인게임은 GTAB_TREE, 오토배틀은 STK_TREE.
// ⚠ 같은 탭 키(Build/Upgrade)가 모드마다 다른 화면을 가리키므로 표를 갈아 끼워야 한다.
function gtabTree(){ return (typeof G!=='undefined' && G.strike) ? STK_TREE : GTAB_TREE; }
function gtabSubs(tab){ const sec=gtabTree()[tab];
  // 관리자 샌드박스는 같은 탭 이름이 또 다른 화면(이펙트 랩 등)이라 내려가지 않는다.
  if(typeof G!=='undefined' && G.sandbox) return [];
  if(!sec || (sec.show && !sec.show())) return [];
  return sec.subs.filter(t=>!t.show || t.show()); }
function gtabPaint(){ const b=document.getElementById('tabs'); if(!b) return;
  b.querySelectorAll('.navIt').forEach(e=>e.remove());        // 지난 하위 칸 걷어내기
  const subs=_gtabDrill?gtabSubs(_gtabDrill):[];
  b.classList.toggle('drill', subs.length>0);
  if(!subs.length){ _gtabDrill=''; return; }
  const sec=gtabTree()[_gtabDrill], cur=sec.cur?sec.cur():null;
  let h=_navCell('nav','back','뒤로','back','navBk','gtabBack()');
  for(const t of subs) h+=_navCell('sub', t.k, t.label, t.ico, (cur===t.k?'cur':''), "gtabSub('"+t.k+"')");
  b.insertAdjacentHTML('beforeend', h);
  if(typeof paintIcons==='function') paintIcons(b); }
// 최상위 칸을 눌렀을 때 — 화면 전환은 이미 각 open*() 가 했고, 여기서는 층만 정한다.
// ⚠ 구역에 '들어올 때'는 늘 첫 하위로 되돌린다 — 안 그러면 타워구매를 보다 나갔다 다시 들어와도
//   타워구매가 열려 있어서, 구역 이름과 보이는 내용이 어긋난다(사용자가 짚은 것).
//   하위 칸을 누르는 경로(gtabSub)는 gtabDrill 을 안 지나므로 그때는 유지된다.
function gtabDrill(tab){ const sec=gtabTree()[tab], was=_gtabDrill;
  _gtabDrill=gtabSubs(tab).length?tab:'';
  // ⚠ '밖에서 들어올 때'만 되돌린다(was!==tab). 이미 그 구역에 있는데 되돌리면
  //   자동화(openMainSheet('auto',…) → gtabDrill('Main'))가 곧바로 판매로 튕겨 나간다.
  if(_gtabDrill && was!==_gtabDrill && sec && sec.reset) sec.reset();
  gtabPaint(); }
function gtabSub(k){ const subs=gtabSubs(_gtabDrill), t=subs.find(x=>x.k===k); if(!t) return;
  if(typeof playSfx==='function') playSfx('ui_tab');
  t.act(); gtabPaint(); }
// ‹ = 기본 상태로 돌아간다. 층만 올리면 '보스 구역에 있으면서 최상위 네비를 보는' 어중간한 상태가 남는다
// (하단은 보스 시트인데 네비는 최상위 — 실제로 그랬다). HOME 네비의 navBack 이 openHome() 을 부르는 것과 같은 뜻.
function gtabBack(){ if(typeof playSfx==='function') playSfx('ui_back');
  if(typeof G!=='undefined' && G.strike){ strikeRestHome(); return; }   // 오토배틀 = 전투 화면이 기본
  gameRestHome(); }
// 🏠 기본 상태 — 아무 구역도 고르지 않았을 때의 하단. 내용은 '유닛 지정'이고 네비는 어느 칸도 안 켜진다.
//   ⚠ switchTab 이 안에서 gtabDrill 을 부르므로, 층·하이라이트 정리는 반드시 그 뒤에 한다.
function gameRestHome(){
  // ⚠ 포인트방은 '화면'이 아니라 전장 위 오버레이(#bossPanel)다 — G.tab 은 계속 'Main' 이라
  //   아래 switchTab 을 안 지나고, 그러면 열린 채로 남는다. 여기서 직접 걷는다.
  if(G.bossOpen && typeof closeBossArena==='function') closeBossArena();
  if(G.tab!=='Main') switchTab('Main', document.querySelector('.tab[data-tab="Main"]'));
  G.mainSheet=null; G.sel=[]; G.selEnemy=null; G.selType=null; _selViaTab=false; G.sheetDown=false;
  setHomeMode('select');
  _setBottomTab(''); _gtabDrill=''; gtabPaint();
  document.body.classList.add('sheetOpen');
  if(typeof _syncSheetLift==='function'){ requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); }
  refreshSelCard(); }
// 대전 판인가 — 나와 팀이 다른 플레이어가 실제로 있는가. 네모(협동)는 전원 같은 편이라 항상 false.
function gameHasVersus(){ if(typeof G==='undefined' || !G.teams) return false;
  const me=G.myPlayer||1, mine=G.teams[me];
  return (G.activePlayers||[]).some(n=>G.teams[n]!==undefined && G.teams[n]!==mine); }
// 자동화 항목을 하나라도 해금했는가 — 옛 #autoFab 의 표시 조건과 같은 식이다
function autoAnyOwned(){ if(typeof autoUtilOwned!=='function' || typeof G==='undefined' || G.phase!=='playing') return false;
  const o=autoUtilOwned(); return !!(o.combine||o.unit||o.energy||o.place||o.bossdeploy); }
// 판매/조합으로 전환 — 자동화 시트를 보고 있었다면 그 시트만 걷어낸다.
// ⚠ openMainHome() 을 부르면 안 된다: 이미 메인 구역에 있으므로 '재탭 = 시트 접기' 로 새어 하단이 내려간다.
function mainGoMode(m){
  if(typeof G!=='undefined' && G.mainSheet!=null){ G.mainSheet=null; G.sheetDown=false;
    document.body.classList.add('sheetOpen'); }
  setHomeMode(m);
  if(typeof refreshSelCard==='function') refreshSelCard(); }
// 구역별 '지금 고른 하위'
let _gachaSec='draw', _upgSec='atk', _plSec='ally';
function setGachaSec(k){ _gachaSec=k; const h=document.getElementById('unitCmd'); if(h){ h._gSig=undefined; h._cgPage=0; } renderGachaSheet(); }
function setUpgSec(k){ _upgSec=k; const h=document.getElementById('unitCmd'); if(h){ h._gSig=undefined; h._cgPage=0; } renderUpgradeSheet(); }
function setPlSec(k){ _plSec=k; const h=document.getElementById('unitCmd'); if(h){ h._gSig=undefined; h._cgPage=0; } renderPlayersSheet(); }
// 하단 탭 버튼 → 화면 이동 대신 메인 뷰 유지 + 하단 섹션만 전환(모드별) + 탭 하이라이트 이동. 관리자 샌드박스는 기존 탭 동작 유지.
function openMainSheet(mode, el, sbTab){
  if(G.sandbox && sbTab && sbTab!=='Upgrade'){ switchTab(sbTab, el||document.querySelector('.tab[data-tab="'+sbTab+'"]')); return; }   // 업그레이드는 전체화면 뷰 폐지 → 관리자도 하단 시트
  if(G.tab==='Main' && G.mainSheet===mode && G.sel.length===0 && G.selEnemy==null){   // 활성 섹션 재탭(무선택일 때만) = 하단 시트 내리기/올리기 토글. 유닛 지정 중이면 아래로 진행 → 지정 해제 + 섹션 표시
    const open=document.body.classList.toggle('sheetOpen'); G.sheetDown=!open;   // 접힘상태 기록(매프레임 refreshSelCard가 덮어쓰지 않도록)
    if(typeof _syncSheetLift==='function'){ requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); }
    if(typeof playSfx==='function') playSfx('ui_open'); return; }
  if(G.tab!=='Main') switchTab('Main', document.querySelector('.tab[data-tab="Main"]'));   // 다른 뷰(건설 등)에서 왔으면 메인 뷰 복귀
  G.sel=[]; G.selEnemy=null; G.selType=null; G.mainSheet=mode; G.sheetDown=false; _setBottomTab(sbTab); gtabDrill(sbTab);   // 이 섹션으로 전환 + 하이라이트 이동 + 그 구역 하위 네비로
  document.body.classList.add('sheetOpen');   // 섹션 전환 = 시트 올림(직전에 토글로 내려놨을 수 있으므로 명시)
  if(typeof playSfx==='function') playSfx('ui_open'); refreshSelCard(); }
// 메인 탭 = 유닛 판매/조합/자동화 묶음. '유닛 지정'은 여기 없다 — 그건 무선택 기본 상태(gameRestHome)다.
// 그래서 다른 구역에서 메인을 누르면 **첫 하위(유닛 판매)** 로 들어간다(기본 상태로 가는 건 ‹ 다).
function openMainHome(el){
  if(G.strike){ switchTab('Main', el||document.querySelector('.tab[data-tab="Main"]')); return; }   // 직스: 전투 탭 → 직스 라우팅
  if(G.sandbox){ switchTab('Main', el||document.querySelector('.tab[data-tab="Main"]')); return; }
  // 이미 메인 구역에 내려가 있는데 또 눌렀다 = 하단 시트 내리기/올리기
  // ⚠ 조건이 'G.mainSheet==null' 이면 기본 상태(유닛 지정)에서 메인을 눌러도 토글로 새어 구역에 못 들어간다.
  if(G.tab==='Main' && _gtabDrill==='Main' && G.sel.length===0 && G.selEnemy==null){
    const open=document.body.classList.toggle('sheetOpen'); G.sheetDown=!open;
    if(typeof _syncSheetLift==='function'){ requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); }
    if(typeof playSfx==='function') playSfx('ui_open'); return; }
  if(G.tab!=='Main') switchTab('Main', document.querySelector('.tab[data-tab="Main"]'));
  G.sel=[]; G.selEnemy=null; G.selType=null; _selViaTab=false; G.sheetDown=false;
  if(G.mainSheet!=='auto') G.mainSheet=null;   // 자동화를 보고 있었다면 그대로 유지
  _setBottomTab('Main'); gtabDrill('Main');    // ← 밖에서 들어왔으면 여기서 첫 하위(유닛 판매)로 되돌린다
  document.body.classList.add('sheetOpen');
  if(typeof playSfx==='function') playSfx('ui_open'); refreshSelCard(); }
function openGachaSheet(el){ if(G.strike){ switchTab('Unit', el||document.querySelector('.tab[data-tab="Unit"]')); return; } openMainSheet('gacha', el, 'Unit'); }   // 직스: 건설지 탭
function openUpgradeSheet(el){ if(G.strike){ switchTab('Upgrade', el||document.querySelector('.tab[data-tab="Upgrade"]')); return; } openMainSheet('upgrade', el, 'Upgrade'); }   // 직스: 보급 탭
function openAutoSheet(el){ openMainSheet('auto', el, 'Main'); }   // 메인 구역의 하위 '자동화' → 하단 자동화 그리드(최상위 탭은 메인 유지)
// ⚙ 자동화 설정 시트 — 팝업 대신 하단 그리드(on/off 셀). 켜두면 유지되는 것들이라 여기서 한 번 설정.
const AUTO_ICON_DIR='assets/icons/auto/';
// 자동화 아이콘 — 이미지 우선(auto_<kind>.webp), 없으면 기존 라인SVG 그대로(beaconProHTML·wpnBadgeHTML과 같은 패턴)
// data-fbcls="" → 폴백을 예전 모양(pIco 기본 22px) 그대로 유지. 파일을 넣으면 자동으로 교체된다.
function autoIcoHTML(kind, fb){ return '<img class="cgIco" src="'+AUTO_ICON_DIR+'auto_'+kind+'.webp" alt="" draggable="false" data-fb="'+(fb||'⚙️')+'" data-fbcls="" onerror="_icoFail(this)">'; }
const AUTO_SHEET_DEFS=[
  ['unit','유닛 소환','🎲'],
  ['combine','유닛 조합','⚛️'],
  ['energy','가스 변환','⚡'],
  ['bossdeploy','보스 파견','💀'],
  ['place','유닛 배치','🎯'] ];
function _autoSheetModel(){ const o=autoUtilOwned(); if(!G.auto) G.auto={unit:false,combine:false,energy:false,pboss:{}};
  const items=AUTO_SHEET_DEFS.map(function(d){ const kind=d[0], owned=!!o[kind], on=!!G.auto[kind];
    return { pro:autoIcoHTML(kind,d[2]), sn:d[1], state:owned?'ok':'dim', sel:owned&&on,   // 이름 아래 토글 스위치(.sel=켜짐) · 셀 전체 클릭으로 토글
      bottom: owned ? '<div class="cgSwWrap"><span class="cgSw"></span></div>' : '<div class="cgSwWrap lk">'+pIco('🔒','sm')+'</div>',
      act:owned?('onclick="toggleAuto(\''+kind+'\')"'):'onclick="toast(\'🔒 포인트 연구소에서 해금\')"' }; });
  // 유닛 배치 ON일 때만: 오른쪽(2페이지 2번 슬롯)에 화살표(구역) 표시 토글 셀
  if(o.place && G.auto.place){ const shown=(G.rallyShow!==false);
    items.push({ pro:autoIcoHTML('rally','🚩'), sn:'구역 표시', state:'ok', sel:shown,
      bottom:'<div class="cgSwWrap"><span class="cgSw"></span></div>', act:'onclick="toggleRallyShow(event)"' }); }
  return { mode:'auto', title:'자동화 설정', icon:pIco('⚙️'), sub:'', compact:true, build:true,
    info:{ hideName:true, desc:'버튼을 눌러 켜기/끄기' }, items:items }; }
// ═══ 🏕 캠프 「아무것도 안 골랐을 때」 요약 — 하단 프로필 구역 ═══════════
//   캠프는 시트를 늘 열어 두는데, 지금은 아무것도 안 고르면 **본부를 대신 골라** 준다
//   (19-camp.js campSyncSheet). 그러면 늘 본부 카드만 보여서 "고르지 않은 상태"가 없다.
//   대신 여기서 **기지 전체 요약**을 보여 준다 — 유즈맵 하단이 늘 내 캐릭터를 보여 주는 것과 같은 자리다.
//   ⚠ 캠프 상태는 **읽기만** 한다(19-camp.js 는 다른 작업자 영역).
function _campIdleModel(){
  const C=(typeof campState==='function')?campState():null;
  const T=(typeof G!=='undefined')?G.tech:null;
  const f=(typeof fmtCur==='function')?fmtCur:(n=>String(Math.floor(n||0)));
  const dg=C?Math.max(1,Math.min(10,C.dg||1)):1;
  const wk=(T&&T.ents)?T.ents.filter(e=>e.type==='worker').length:0;
  const rate=(C&&C.rate>0)?C.rate:0;
  const st=[];
  st.push(['터치 획득', (typeof campTapGain==='function')?f(campTapGain()):'-']);
  st.push(['자동 수급', rate? (f(rate)+'/초') : '측정 중']);
  st.push(['일꾼',      wk+'기']);
  st.push(['인구',      T? ((T.sup||0)+' / '+(T.supCap||0)) : '-']);
  st.push(['던전 배수', (typeof campDgMul==='function')?('×'+campDgMul(dg).toFixed(1)):'-']);
  st.push(['채취 배수', (typeof campGatherMul==='function')?('×'+campGatherMul().toFixed(1)):'-']);
  if(typeof campUpgLv==='function'){
    st.push(['터치 강화', 'Lv.'+campUpgLv('tap')]);
    st.push(['채취 강화', 'Lv.'+campUpgLv('gather')]); }
  // ⛔ 제목에 **던전 이름을 쓰지 않는다** — 던전은 좌상단 칩이 이미 말한다(같은 것을 두 번 말하게 된다).
  //    대신 이 구역이 무엇인지를 자간 넓은 작은 라벨로 말한다(kicker · 로딩창 LOADING 과 같은 어법).
  return { mode:'upg', compact:true, build:true, wide:true,   // 빈 슬롯 4칸이 의미 없다 → 안쪽 전체를 쓴다
    title:'MY BASE', kicker:true,
    info:{ hideName:true, statsWide:true, stats:st },
    items:[] }; }
// 값이 바뀔 때만 다시 그린다 — 캠프 틱은 매 프레임 돌아서 그냥 그리면 입력이 끊긴다
function _campIdleSig(){
  const C=(typeof campState==='function')?campState():null;
  const T=(typeof G!=='undefined')?G.tech:null;
  return 'ci|'+(C?(C.dg||1):0)+'|'+(C?(C.upg&&C.upg.tap||0):0)+'|'+(C?(C.upg&&C.upg.gather||0):0)
    +'|'+((C&&C.rate>0)?C.rate.toFixed(1):0)
    +'|'+(T?((T.ents||[]).filter(e=>e.type==='worker').length):0)+'|'+(T?(T.sup||0):0)+'|'+(T?(T.supCap||0):0); }
// 캠프가 부르는 입구. host 를 안 주면 캠프 시트 본문(#btSheetBody)에 그린다.
function renderCampIdleSheet(host){
  const el=host||document.getElementById('btSheetBody'); if(!el) return;
  const sig=_campIdleSig()+'|'+(el._cgPage||0);
  // ⚠ **지금 그려진 것이 요약인지**도 본다. 건물 카드를 보다가 해제하면 값은 그대로라 서명이 같은데,
  //   화면에는 건물 카드가 남아 있다 — 서명만 보면 영영 안 그려진다.
  const mine=!!(el._cgModel && el._cgModel.kicker);
  if(mine && el._gSig===sig) return;
  el._gSig=sig; el._cgSig=undefined; renderCmdGrid(el, _campIdleModel()); }

function renderAutoSheet(){ const host=document.getElementById('unitCmd'); if(!host) return; host.classList.add('simple');
  const sig='auto|'+autoSig()+'|'+(host._cgPage||0);
  if(host._gSig!==sig){ host._gSig=sig; host._cgSig=undefined; renderCmdGrid(host, _autoSheetModel()); } }
// 💀 보스 진입점(하단 보스 탭 · 기타 진입) → 하단 보스 시트. 탭 하이라이트=Boss.
function openBossSheet(el){
  if(G.sandbox) return;   // 관리자 샌드박스에선 보스 미사용(네모네모 전용 · 탭도 숨김)
  if(G.tab==='Main' && G.mainSheet==='boss' && G.sel.length===0 && G.selEnemy==null){   // 활성 섹션 재탭(무선택일 때만) = 하단 시트 내리기/올리기 토글
    const open=document.body.classList.toggle('sheetOpen'); G.sheetDown=!open;
    if(typeof _syncSheetLift==='function'){ requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); }
    if(typeof playSfx==='function') playSfx('ui_open'); return; }
  if(G.tab!=='Main') switchTab('Main', document.querySelector('.tab[data-tab="Main"]'));
  G.sel=[]; G.selEnemy=null; G.selType=null; G.mainSheet='boss'; G.sheetDown=false; _setBottomTab('Boss'); gtabDrill('Boss');   // 보스 탭 하이라이트 + 하위 네비(개인보스·포인트방)
  document.body.classList.add('sheetOpen');
  if(typeof playSfx==='function') playSfx('ui_open'); refreshSelCard(); }
// 커스텀 초상화 이미지(유닛/건물 id → 파일). 있으면 3D/라인아트 대신 사용.
const PORTRAIT_DIR='assets/portraits/'; const PORTRAIT_VER='?v=4';
const _PI_RAW={
  marine:  PORTRAIT_DIR+'ranger_portrait.webp',     // 레인저
  ghost:   PORTRAIT_DIR+'phantom_portrait.webp',    // 팬텀
  goliath: PORTRAIT_DIR+'strider_portrait.webp',    // 스트라이더
  hydra:   PORTRAIT_DIR+'reaper_portrait.webp',     // 리퍼
  dragoon: PORTRAIT_DIR+'sentinel_portrait.webp',   // 센티넬
  archon:  PORTRAIT_DIR+'void_portrait.webp',       // 보이드
  turret:  PORTRAIT_DIR+'guardtower_portrait.webp', // 미사일 포탑(건물)
  photon:  PORTRAIT_DIR+'energyspire_portrait.webp',// 에너지 스파이어(건물)
  citizen: PORTRAIT_DIR+'civilian_portrait.webp',   // 시민
  beholder:PORTRAIT_DIR+'beholder_portrait.webp',   // 비홀더
  observer:PORTRAIT_DIR+'observer_portrait.webp',   // 옵저버(적)
  // 신규 가챠 유닛(전설/초월) — 키 = gmodel(전용 모델 키)
  machinegun:PORTRAIT_DIR+'machinegun_portrait.webp',  // 발칸
  tank:      PORTRAIT_DIR+'tank_portrait.webp',        // 브레이커
  blade:     PORTRAIT_DIR+'blade_portrait.webp',       // 워든
  thornqueen:PORTRAIT_DIR+'thornqueen_portrait.webp',  // 베놈퀸
  skyguard:  PORTRAIT_DIR+'skyguard_portrait.webp',    // 템페스트
  skydancer: PORTRAIT_DIR+'skydancer_portrait.webp',   // 스카이댄서
  matron:    PORTRAIT_DIR+'matron_portrait.webp',      // 매트론
  racer:     PORTRAIT_DIR+'racer_portrait.webp',       // 레이서(에픽·유니크)
  snapper:   PORTRAIT_DIR+'snapper_portrait.webp',     // 스내퍼(에픽·유니크)
  // 적 공중유닛(네모네모) — 샌드박스 아군외형 + 이펙트 랩/도감 초상화
  hellfire:   PORTRAIT_DIR+'hellfire_portrait.webp',    // 헬파이어
  pelican:    PORTRAIT_DIR+'pelican_portrait.webp',     // 펠리컨
  dreadnought:PORTRAIT_DIR+'dreadnought_portrait.webp', // 드레드노트
  kronos:     PORTRAIT_DIR+'kronos_portrait.webp',      // 크로노스
  seraph:     PORTRAIT_DIR+'seraph_portrait.webp',      // 세라프
  archangel:  PORTRAIT_DIR+'archangel_portrait.webp',   // 아크엔젤
  falcon:     PORTRAIT_DIR+'falcon_portrait.webp',      // 팔콘
  overlord:   PORTRAIT_DIR+'overlord_portrait.webp',    // 제플린
  stinger:    PORTRAIT_DIR+'stinger_portrait.webp',     // 스팅어
  venom:      PORTRAIT_DIR+'venom_portrait.webp',       // 베놈
  medusa:     PORTRAIT_DIR+'medusa_portrait.webp',      // 메두사
  aegis:      PORTRAIT_DIR+'aegis_portrait.webp',       // 이지스(개인보스)
  wyvern:     PORTRAIT_DIR+'wyvern_portrait.webp',      // 와이번(개인보스)
  behemoth:   PORTRAIT_DIR+'behemoth_portrait.webp',    // 베히모스(개인보스)
  // 일꾼 3종족
  worker_human:PORTRAIT_DIR+'worker_human_portrait.webp', // 유니온 일꾼
  worker_light:PORTRAIT_DIR+'worker_light_portrait.webp', // 에테리얼 일꾼
  worker_swarm:PORTRAIT_DIR+'worker_swarm_portrait.webp', // 스웜 일꾼
  // 🆕 2026-09-01 — 초상이 없어 아이콘 레퍼런스도 못 만들던 둘. 초상부터 새로 뽑았다.
  broodling:  PORTRAIT_DIR+'broodling_portrait.webp',   // 스웜링(소환수)
  dark_archon:PORTRAIT_DIR+'dark_archon_portrait.webp',  // 다크보이드
};
const PORTRAIT_IMG={}; for(const _k in _PI_RAW) PORTRAIT_IMG[_k]=_PI_RAW[_k]+PORTRAIT_VER;   // 캐시버스트 버전 부착(배경 제거 새 이미지 로드)
(function(){ for(const _k in _PI_RAW){ const _pi=new Image(); _pi.src=_PI_RAW[_k]+PORTRAIT_VER; } })();   // 전체 초상화 프리로드(첫 표시 지연 없애기)
// 프로필 초상화 HTML: 커스텀 이미지 있으면 <img>, 없으면 라인아트 SVG
// 🎨 유닛 초상 = **판 아이콘 우선**(건물의 _techBldgPortrait 과 같은 규칙 · 2026-08-31).
//   ⭐ 여기가 단일 소스다 — 게임 안 프로필·오토배틀·유닛 뽑기·이펙트 랩이 전부 이 함수를 부른다.
//     그래서 아이콘 배선을 화면마다 넣지 않는다(넣으면 화면마다 갈린다).
//   ⭐ 파일만 넣으면 뜬다 — `units/un_<키>.webp` 가 없으면 onerror 가 **기존 3D 초상**으로 되돌리고,
//     초상도 없으면 라인 SVG 로 떨어진다. 아이콘이 없는 유닛도 화면이 비지 않는다.
//   ⛔ 아이콘 유무 목록을 코드에 적지 말 것 — 파일을 넣고 빼는 것만으로 갈려야 한다.
// 🔁 **같은 그림을 두 번 뽑지 않는다**(assets/icons/README.md 「기존 것부터 확인」).
//   방어 포탑은 유닛이자 건물이라 건물 아이콘이 이미 있다 — 그것을 그대로 빌린다.
//   ⛔ 파일을 복사해 두지 말 것: 한쪽만 고치면 둘이 갈린다.
const UNIT_ICO_ALIAS={ turret:'buildings/bld_turret', photon:'buildings/bld_cannon' };
function unitPortraitHTML(id){
  if(!id) return unitSVG(id);
  const p = PORTRAIT_IMG[id];
  const rel = UNIT_ICO_ALIAS[id] || ('units/un_'+id);
  return '<img class="portImg unIco" src="assets/icons/'+rel+'.webp" alt="" draggable="false"'
    + (p ? (' data-p="'+p+'" onerror="_unIcoFb(this)"')
         : ' data-uid="'+id+'" onerror="_unSvgFb(this)"') + '>'; }
// 아이콘이 없다 → **초상으로 되돌린다**(이모지·SVG 로 떨어지지 않게)
function _unIcoFb(im){ try{ im.classList.remove('unIco'); im.removeAttribute('onerror');
  im.src=im.getAttribute('data-p'); }catch(_e){ try{ im.remove(); }catch(_e2){} } }
// 아이콘도 초상도 없다 → 원래 라인 SVG
// 🎨 **색이 있는 초상을 먼저** 쓴다 (2026-09-03 사용자 확정 · 생산 표시용).
//   ⚠ unitPortraitHTML 은 회색 프로필(icons/units/un_*)이 먼저다 — 카드·헤더·대기열은 그것이 맞다.
//     하지만 맵 위에 작게 뜨는 자리에서는 **색이 있어야 한눈에 들어온다.**
//   ⭐ 그림표는 PORTRAIT_IMG 하나를 그대로 쓴다(새 표를 만들지 않는다).
//     없는 유닛이면 공용 초상 체인(unitPortraitHTML)으로 넘긴다.
function unitFaceColorHTML(id){
  if(!id) return '';
  const p = (typeof PORTRAIT_IMG !== 'undefined') ? PORTRAIT_IMG[id] : null;
  if(p) return '<img class="portImg unIco" src="' + p + '" alt="" draggable="false"'
    + ' data-uid="' + id + '" onerror="_unSvgFb(this)">';
  return (typeof unitPortraitHTML === 'function') ? unitPortraitHTML(id) : '';
}
function _unSvgFb(im){ try{ im.outerHTML=unitSVG(im.getAttribute('data-uid')); }catch(_e){ try{ im.remove(); }catch(_e2){} } }
// 초상화 칩 내부 HTML(박스+개수+이름)
// (구 chipHTML/unitHpHTML 제거 — 종류 칩·유닛별 HP는 커맨드 그리드 모델이 담당)
function selectAllOfTier(tier){ const ids=G.units.filter(u=>!u.fixed&&!u.atBoss&&u.gtier===tier).map(u=>u.uid);
  if(ids.length){ G.sel=capSelTypes(ids,true); G.selEnemy=null; refreshSelCard(); } }   // 그 등급 전체 한번에 선택(30 제한 없음·이동용)
// (구 buildSelChips/updateSelHp 제거 — 다중 선택 칩·유닛별 HP는 커맨드 그리드 모델 _mainTypeModel/_mainMixedModel이 담당)
// ── 유닛 명령(홀드/공격이동/반복이동/스킬) ──
function selUnits(){ return G.sel.map(id=>G.units.find(u=>u.uid===id)).filter(u=>u&&!u.fixed); }
// 목표 지점 주변에 유닛별 대형 슬롯 배정(겹쳐 몰리지 않게)
function formationSlots(us, cx, cy){
  if(us.length<=1) return [{x:cx,y:cy}];
  const r=(us.reduce((a,u)=>a+collideR(u),0)/us.length)*2.1;
  const offs=[{dx:0,dy:0}]; let ring=1;
  while(offs.length<us.length){ const n=Math.floor(Math.PI*2*ring*0.9)||6;
    for(let k=0;k<n && offs.length<us.length;k++){ const a=(k/n)*Math.PI*2+ring*0.5; offs.push({dx:Math.cos(a)*ring*r, dy:Math.sin(a)*ring*r}); } ring++; }
  return us.map((u,i)=>{ const o=offs[i]; return clampInner(cx+o.dx/GW, cy+o.dy/GH); });
}
// 적 추적 시 유닛별 포위 오프셋(픽셀) — 같은 적을 둘러싸도록
function assignFormOffsets(us){
  if(!us.length) return;
  if(us.length===1){ us[0]._fofs={dx:0,dy:0}; return; }
  const r=(us.reduce((a,u)=>a+collideR(u),0)/us.length)*2.2;
  const offs=[{dx:0,dy:0}]; let ring=1;
  while(offs.length<us.length){ const n=Math.floor(Math.PI*2*ring*0.9)||6;
    for(let k=0;k<n && offs.length<us.length;k++){ const a=(k/n)*Math.PI*2+ring*0.5; offs.push({dx:Math.cos(a)*ring*r, dy:Math.sin(a)*ring*r}); } ring++; }
  us.forEach((u,i)=>u._fofs=offs[i]);
}
function setPatrolTarget(tx,ty){ const us=selUnits(); const slots=formationSlots(us,tx,ty);
  us.forEach((u,i)=>{ const s=slots[i]; u.patrol={ax:u.x,ay:u.y,bx:s.x,by:s.y}; u._patTo='b'; u.cmd='hold'; u.focusTarget=null; u.moveTo=null; }); }
function selTransport(){ if(typeof G==='undefined'||G.sel.length!==1) return null; const u=G.units.find(x=>x.uid===G.sel[0]); return (u&&isTransport(u))?u:null; }
function updateTransportBtns(){ const el=document.getElementById('transportCmd'); if(!el) return; const t=selTransport();
  if(!t){ el.style.display='none'; return; } el.style.display='flex';
  const bb=document.getElementById('cmdBoard'), ub=document.getElementById('cmdUnload');
  if(bb){ bb.innerHTML=pIco('🛬','md')+' 태우기 <span style="font-size:.76em;opacity:.5;font-weight:600">'+(t.cargo?t.cargo.length:0)+'/'+transportCap(t)+'</span>'; bb.classList.toggle('arm',!!G.boardArm); }
  if(ub){ ub.innerHTML=pIco('🛫','md')+' 내리기'; ub.classList.toggle('arm',!!G.unloadArm); } }
function armBoard(){ const t=selTransport(); if(!t) return; G.boardArm=(G.boardArm===t.uid)?false:t.uid; G.unloadArm=false; G.focusArm=false; G.patrolArm=false; updateTransportBtns();
  if(G.boardArm) addChat('','🛬 태우기: 드래그로 태울 유닛들을 지정하세요.'); }
function armUnload(){ const t=selTransport(); if(!t) return; G.unloadArm=!G.unloadArm; G.boardArm=false; G.focusArm=false; G.patrolArm=false; updateTransportBtns();
  if(G.unloadArm) addChat('','🛫 내리기: 화면에서 내릴 곳을 지정하세요.'); }
function setFocusTarget(eid){ const e=G.enemies.find(x=>x.eid===eid); const us=selUnits();
  for(const u of us){ u.cmd='focus'; u.focusTarget=eid; u.patrol=null; u.atkTarget=null; u._chasing=false; u.moveTo=null; }
  assignFormOffsets(us);   // 포위 대형
  addChat('','ℹ️ 지정공격: '+(e?e.name:'적')+' 집중 공격.'); }
const SKILL_ICON={ adr:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>' };  // 아드레날린=번개
function useSkill(){ const us=selUnits(); if(!us.length) return;
  let used=0; for(const u of us){ const def=U[u.id]; if(def.skill && (u.skCd||0)<=0){ u.adr=def.skill.dur; u.skCd=def.skill.cd; used++; } }
  if(used){ const nm=U[us[0].id].skill.name; addChat('',nm+' 발동! ('+used+'기)'); if(typeof playSfx==='function') playSfx('skill'); } updateCmdRow(); updateSkillFab(); }
// ════════════════════════════════════════════════════════════════
// 🪄 유닛 스킬 프레임워크(관리자/재사용 유즈맵 기본 틀) — 스타식 액티브/토글/오라 스킬.
//   · SKILLS: 스킬 정의 레지스트리(kind=target_ground|target_unit|toggle|aura). 새 유즈맵은 여기에 항목만 추가.
//   · UNIT_SKILLS: 유닛(모델키) → 보유 스킬 배열. 하단 선택 패널 '여분 구역'(#skillBar)에 버튼 표시.
//   · 시전=castSkill → 지정형은 armed 후 맵 클릭(fireSkillGround). 쿨다운/에너지=stepSkills, 시각=drawSkillFx.
//   · 전투 유즈맵은 hitEnemy 훅(_skStormDamage)으로 실제 피해; 관리자(적 없음)에선 순수 연출.
// ════════════════════════════════════════════════════════════════
const SKILL_EN_REGEN=8;    // 에너지 재생(초당) — maxEn>0 유닛 공통
const DETECT_RANGE=0.20;  // 탐지 유닛(와쳐·제플린·터렛 등) 은신 감지 반경(넓게·상시 유지)
const HEAL_RANGE=0.14;    // 메딕 치유 사거리(자동/지정 공통)
const PERMA_CLOAK={ dark_templar:true };   // 상시 은신 유닛(스킬 아님) — 다크템플러
const HEALER={ medic:true };               // 자동/지정 치유 유닛
const BIONIC={ marine:1, ghost:1, medic:1, machinegun:1 };   // 바이오닉(치유 대상) — 유니온 보병(확장 가능)
SKILL_ICON.psi_storm='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h9l-2.4 5H18l-9 11 2.2-8H5z"/></svg>';   // 스톰=번개 구름
SKILL_ICON.heal='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/></svg>';   // 치유=십자
SKILL_ICON.psi_cloak='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z"/></svg>';   // 차원은폐=방패
SKILL_ICON.stim='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2h2v6h6v2h-6v6h4l-5 6-5-6h4v-6H5V8h6z"/></svg>';   // 스팀팩=아드레날린 화살
SKILL_ICON.ensnare='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>';   // 인스네어=거미줄
SKILL_ICON.spider_mine='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="11" cy="14" r="7"/><path d="M11 4V1M4 14H1M21 14h-3M5 8L3 6M17 8l2-2"/></svg>';   // 마인=지뢰
SKILL_ICON.lockdown='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7a5 5 0 0110 0v3h1.5v11h-13V10zm2 0h6V7a3 3 0 00-6 0z"/></svg>';   // 락다운=자물쇠
SKILL_ICON.nuke='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 7.2L14.8 14H9.2zM7 15h10l-2 4-3-2-3 2z"/></svg>';   // 핵=방사능
SKILL_ICON.siege='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h18v3H3zM5 10h6l3-4h4l-2 4h2v2H5zM6 16v3H4v-3zM20 16v3h-2v-3z"/></svg>';   // 시즈=포탑
SKILL_ICON.yamato='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 017 7c0 3-2 5-2 7l-5 6-5-6c0-2-2-4-2-7a7 7 0 017-7zm0 4a3 3 0 100 6 3 3 0 000-6z"/></svg>';   // 야마토=충전포
SKILL_ICON.emp='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L5 13h5l-1 9 9-12h-5z"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".5"/></svg>';   // EMP=전자펄스
SKILL_ICON.broodling='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2 3 2 5 0 7-2-2-2-4 0-7zM5 9c3 1 4 3 3 6-3-1-4-3-3-6zM19 9c1 3 0 5-3 6-1-3 0-5 3-6zM12 13c2 3 2 6 0 9-2-3-2-6 0-9z"/></svg>';   // 브루들링=포자
// ── 🔮 에테리얼(프로토스) 마법 ──
SKILL_ICON.hallucination='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="10" r="4"/><circle cx="15" cy="14" r="4" opacity=".55"/></svg>';   // 할루시네이션=겹친 환영
SKILL_ICON.feedback='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-5z" opacity=".5"/><path d="M12 6l1.5 3 3 .4-2.2 2.1.6 3.1L12 16.3 9.1 17.7l.6-3.1L7.5 12.4l3-.4z"/></svg>';   // 피드백=마나 소각
SKILL_ICON.maelstrom='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4a8 8 0 108 8M12 8a4 4 0 104 4"/></svg>';   // 메일스트롬=소용돌이 마비
SKILL_ICON.mind_control='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a5 5 0 00-5 5c0 1.3.5 2.5 1.3 3.4C7 12.3 6 14 6 16a6 6 0 0012 0c0-2-1-3.7-2.3-4.6A5 5 0 0012 3z" opacity=".5"/><circle cx="12" cy="15" r="2"/></svg>';   // 마인드컨트롤=뇌
SKILL_ICON.disruption_web='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/><circle cx="12" cy="12" r="4"/></svg>';   // 디스럽션웹=거미줄 결계
SKILL_ICON.stasis='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 4-3 2-3-2zM12 22l-3-4 3-2 3 2zM2 12l4-3 2 3-2 3zM22 12l-4 3-2-3 2-3z" opacity=".85"/><path d="M9 9h6v6H9z" opacity=".4"/></svg>';   // 스테이시스=크리스탈
SKILL_ICON.recall='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 7 4 12l5 5M4 12h11a5 5 0 015 5"/></svg>';   // 리콜=순간이동 화살
// ── 🦎 스웜(저그) 마법 ──
SKILL_ICON.parasite='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" stroke-width="1.4"/></svg>';   // 패러사이트=기생 눈
SKILL_ICON.dark_swarm='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 14a4 4 0 010-8 5 5 0 019.6-1A4 4 0 0118 14z" opacity=".8"/><circle cx="8" cy="17" r="1.3"/><circle cx="12" cy="18" r="1.3"/><circle cx="16" cy="17" r="1.3"/></svg>';   // 다크스웜=먹구름
SKILL_ICON.plague='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9" opacity=".3"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="2"/></svg>';   // 플레이그=역병
SKILL_ICON.consume='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-3 3-3 6 0 9 3-3 3-6 0-9zM6 13c3 1 4 3 3 6-3-1-4-3-3-6zM18 13c-3 1-4 3-3 6 3-1 4-3 3-6z" opacity=".85"/></svg>';   // 컨슘=포식
// ── 🛡 유니온(테란) 마법 ──
SKILL_ICON.irradiate='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2.5"/><path d="M12 4a8 8 0 013 1.5l-3 5zM19 15a8 8 0 01-2.5 2.5l-4-4zM5 15a8 8 0 002.5 2.5l4-4z" opacity=".7"/></svg>';   // 이레디에이트=방사능
SKILL_ICON.defensive_matrix='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M8 12l3 3 5-6"/></svg>';   // 디펜시브 매트릭스=보호막 방패
SKILL_ICON.restoration='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21a9 9 0 10-9-9"/><path d="M3 12l3-3M3 12l3 3M9 9h4a3 3 0 010 6H9"/></svg>';   // 레스토레이션=해제 회전
SKILL_ICON.optical_flare='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" opacity=".3"/><circle cx="12" cy="12" r="3"/><path d="M12 5V2M12 22v-3M5 12H2M22 12h-3" stroke="currentColor" stroke-width="1.4"/></svg>';   // 옵티컬 플레어=섬광 눈
// ── 🏢 건물 스킬 ──
SKILL_ICON.scan='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>';   // 스캐너 스윕=탐색
SKILL_ICON.recharge='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V5z" opacity=".3"/><path d="M13 6l-4 6h3l-1 5 4-6h-3z"/></svg>';   // 쉴드 충전=번개 방패
const SKILLS={
  // 하이템플러: 사이오닉 스톰 — 지정 지점 광역 지속 피해(연출: 보라 뇌운+번개)
  psi_storm:{ key:'psi_storm', name:'번개 폭풍', kind:'target_ground', energy:75, cd:12, dur:3, radius:0.075, dmg:14,
    arm:'⚡ 번개 폭풍: 떨어뜨릴 지점을 클릭하세요.' },
  // 메딕: 지정 힐 — 아군 1기를 지정해 따라다니며 치료(미지정 시 근처 부상 바이오닉 자동 치료)
  heal:{ key:'heal', name:'치유', kind:'target_unit', energy:0, drain:10, hps:24, range:HEAL_RANGE,
    arm:'✚ 치유: 따라다니며 치료할 아군을 클릭하세요.' },
  // 아비터(크로노스): 차원 은폐 — 오라(범위 내 아군 은신)
  psi_cloak:{ key:'psi_cloak', name:'은신 장막', kind:'aura', energy:0, radius:0.12, cloakAllies:true },
  // 레인저(마린): 스팀팩 — 자기 강화(공속·이속↑, 체력 소모). 전투 유즈맵 훅: u.buff.stim
  stim:{ key:'stim', name:'광폭화', kind:'self', cd:10, dur:6, atkMul:1.5, spdMul:1.4, hpCost:10 },
  // 메두사(퀸): 인스네어 — 지정 지역 적 둔화(가스). 훅: e.slowT
  ensnare:{ key:'ensnare', name:'점착 가스', kind:'target_ground', energy:0, enSc:75, cd:60, dur:10, radius:0.11, slow:0.5,
    arm:'🕸 점착 가스: 퍼뜨릴 지점을 클릭하세요.' },
  // 레이서(벌처): 스파이더 마인 — 매설 후 적 접근 시 폭발(광역). 훅: 근접 적 감지
  spider_mine:{ key:'spider_mine', name:'지뢰', kind:'target_ground', energy:0, cd:30, r:0.06, trig:0.045, dmg:60,
    arm:'💣 지뢰: 매설 지점을 클릭하세요.' },
  // ── 유니온 배치 ──
  // 팬텀(고스트): 락다운 — 지정 적 정지(기계 무력화). 훅: e.stunT
  lockdown:{ key:'lockdown', name:'봉쇄', kind:'target_enemy', energy:0, enSc:100, cd:30, dur:5, arm:'🔒 봉쇄: 정지시킬 적을 클릭하세요.' },
  // 팬텀(고스트): 핵 공격 — 지정 지점에 지연 후 대형 폭발
  nuke:{ key:'nuke', name:'핵 폭격', kind:'target_ground', energy:0, cd:300, delay:3.5, radius:0.15, dmg:400, arm:'☢ 핵 폭격: 투하 지점을 클릭하세요.' },
  // 브레이커(탱크): 시즈 모드 — 토글(사거리·공격↑, 정지). 훅: 이동불가
  siege:{ key:'siege', name:'공성 모드', kind:'toggle', energy:0, atkMul:1.8, rngMul:1.6 },
  // 드레드노트: 야마토 포 — 지정 적에 고정 대형 피해(즉발)
  yamato:{ key:'yamato', name:'집중포', kind:'target_enemy', energy:0, enSc:150, cd:12, dmg:260, arm:'💥 집중포: 조준할 적을 클릭하세요.' },
  // 이지스: EMP — 지정 지역 에너지·보호막 소거
  emp:{ key:'emp', name:'EMP', kind:'target_ground', energy:0, enSc:100, cd:10, radius:0.13, arm:'⚡ EMP: 지점을 클릭하세요.' },
  // 메두사(퀸): 브루들링 — 스폰 브루들링 연구 해제. 지정 적 즉사 + 그 자리에 스웜링 2기
  broodling:{ key:'broodling', name:'유충 폭발', kind:'target_enemy', energy:0, enSc:150, cd:12, spawn:2, arm:'🐛 유충 폭발: 즉사시킬 적을 클릭하세요.' },
  // ── 🔮 에테리얼(프로토스) 마법 — 관리자=SC 마나(enSc), 네모 게임=0(제외) ──
  hallucination:{ key:'hallucination', name:'환영', kind:'target_unit', energy:0, enSc:100, cd:10, count:2, arm:'👥 환영: 환영을 만들 아군을 클릭하세요.' },   // 하이세이지 — 대상 환영 2기
  feedback:{ key:'feedback', name:'마나 소각', kind:'target_enemy', energy:0, enSc:50, cd:8, arm:'💥 마나 소각: 마나를 태울 대상을 클릭하세요.' },   // 다크보이드 — 대상 마나 소각+피해
  maelstrom:{ key:'maelstrom', name:'마비 폭풍', kind:'target_ground', energy:0, enSc:100, cd:60, dur:5, radius:0.1, arm:'🌀 마비 폭풍: 지점을 클릭하세요.' },   // 다크보이드 — 범위 마비
  mind_control:{ key:'mind_control', name:'정신 지배', kind:'target_enemy', energy:0, enSc:150, cd:120, arm:'🧠 정신 지배: 장악할 대상을 클릭하세요.' },   // 다크보이드 — 장악(자신 쉴드 0)
  disruption_web:{ key:'disruption_web', name:'교란 결계', kind:'target_ground', energy:0, enSc:125, cd:20, dur:3, radius:0.11, arm:'🕸️ 교란 결계: 지점을 클릭하세요.' },   // 팔콘 — 지상 결계
  stasis:{ key:'stasis', name:'빙결', kind:'target_ground', energy:0, enSc:100, cd:30, dur:3, radius:0.1, arm:'🧊 빙결: 지점을 클릭하세요.' },   // 크로노스 — 범위 정지+무적
  recall:{ key:'recall', name:'순간이동', kind:'target_ground', energy:0, enSc:150, cd:12, radius:0.18, arm:'↩️ 순간이동: 소환할 지점을 클릭하세요.' },   // 크로노스 — 근처 아군 순간이동
  // ── 🦎 스웜(저그) 마법 — 메두사(군단여왕) ──
  parasite:{ key:'parasite', name:'감염', kind:'target_enemy', energy:0, enSc:75, cd:6, arm:'🦠 감염: 기생시킬 적을 클릭하세요.' },   // 적 기생 → 시야 공유(영구)
  dark_swarm:{ key:'dark_swarm', name:'암흑 장막', kind:'target_ground', energy:0, enSc:100, cd:80, dur:8, radius:0.13, arm:'☁️ 암흑 장막: 지점을 클릭하세요.' },   // 범위 내 아군 = 원거리 피해 0
  plague:{ key:'plague', name:'역병', kind:'target_ground', energy:0, enSc:150, cd:12, dur:6, radius:0.11, dps:18, arm:'🩸 역병: 지점을 클릭하세요.' },   // 범위 HP 지속 감소(체력 1까지, 쉴드 무시 안 함)
  consume:{ key:'consume', name:'포식', kind:'target_unit', energy:0, enSc:0, cd:2, gain:50, arm:'🍽 포식: 잡아먹을 아군 유닛을 클릭하세요.' },   // 아군 잡아먹어 마나 +50
  // ── 🛡 유니온(테란) 마법 — 이지스(사이언스 베슬)·메딕 ──
  irradiate:{ key:'irradiate', name:'방사능', kind:'target_enemy', energy:0, enSc:75, cd:8, dur:8, dps:30, arm:'☢ 방사능: 씌울 적을 클릭하세요.' },   // 대상 지속 피해(생체)
  defensive_matrix:{ key:'defensive_matrix', name:'보호막', kind:'target_unit', energy:0, enSc:100, cd:6, absorb:250, arm:'🛡 보호막: 보호할 아군을 클릭하세요.' },   // 아군에 250 흡수 보호막
  restoration:{ key:'restoration', name:'정화', kind:'target_unit', energy:0, enSc:50, cd:5, arm:'✳ 정화: 해로운 효과를 치료할 아군을 클릭하세요.' },   // 아군 디버프 해제
  optical_flare:{ key:'optical_flare', name:'섬광탄', kind:'target_enemy', energy:0, enSc:75, cd:6, dur:20, arm:'👁 섬광탄: 실명시킬 적을 클릭하세요.' },   // 적 시야 축소+디텍터 무력화
  // ── 🏢 건물 스킬 ──
  scan:{ key:'scan', name:'스캐너 스윕', kind:'target_ground', energy:0, enSc:50, cd:1, radius:0.15, dur:5, arm:'📡 스캐너 스윕: 밝힐 지점을 클릭하세요.', bldg:1 },   // 컴셋 = 지점 시야+탐지(일시)
  // 🔋 쉴드 충전 — ⚠ **캠프에서는 체력 회복이다**(사용자 확정 2026-08-28).
  //   캠프 설계 능력치가 실드를 체력에 합쳐 `sh=0` 으로 만들어(에테리얼도 마찬가지) 충전할 실드가 없다.
  //   `healPct` 가 있으면 최대 체력의 그만큼을 회복한다. `rate`(실드 충전)는 캠프 밖 전용이다.
  recharge:{ key:'recharge', name:'쉴드 충전', kind:'target_unit', energy:0, enSc:0, cd:300, rate:2, healPct:0.25, arm:'🔋 쉴드 충전: 충전할 아군을 클릭하세요.', bldg:1 },   // 쉴드 배터리 = 마나1→쉴드2
};
const BLDG_EN={ comsat:200, battery:200 };   // ⚡ 마나 보유 건물(생산 직후 50 · 자연 회복)
const BLDG_SKILLS={ comsat:['scan'], battery:['recharge'] };   // 건물별 스킬(프로필 카드)
// 📖 스킬 한 줄 설명 — 롱프레스 팝업(단일 소스). 없으면 sk.arm/기본 문구로 폴백.
const SKILL_DESC={
  psi_storm:'에너지 75. 좁은 범위에 3초간 초당 28(총 84) 피해.',
  heal:'지정 아군을 따라다니며 초당 24 회복(초당 에너지 10 소모, 미지정 시 근처 부상병 자동).',
  psi_cloak:'무료(오라). 넓은 범위 아군을 상시 은신.',
  stim:'체력 10을 소모해 6초간 공격 속도 1.5배·이동 속도 1.4배.',
  ensnare:'에너지 75. 넓은 범위 적을 8초간 둔화(이속·공속 50%↓).',
  spider_mine:'지정 지점에 지뢰를 매설, 적 접근 시 좁은 범위 폭발 피해 60. 기본 3개 충전, 사용 시마다 하나씩 소모(0이면 비활성).',
  lockdown:'에너지 100 소모. 기계 적 하나를 6초간 완전히 멈춤.',
  nuke:'충전된 핵을 지정 지점에 투하, 3.5초 뒤 넓은 범위 폭발 피해 400(에너지 무료).',
  siege:'켜면 공격력 1.8배·사거리 1.6배, 이동 불가(다시 누르면 해제).',
  yamato:'에너지 150 소모. 적 하나에게 즉시 피해 260.',
  emp:'에너지 100 소모. 넓은 범위 안 적의 에너지·보호막을 모두 제거.',
  broodling:'에너지 150. 지정한 적을 즉사시키고 그 자리에 스웜링 2기 생성.',
  hallucination:'에너지 100. 지정 아군의 가짜 분신 2기 생성(피해 0, 20초 후 소멸).',
  feedback:'에너지 50. 지정한 적의 남은 마나를 태우고 그만큼 피해(보호막 무시).',
  maelstrom:'에너지 100. 넓은 범위 생체 적을 6초간 마비.',
  mind_control:'에너지 150. 적 하나를 영구 아군으로(시전 시 자신 보호막 0).',
  disruption_web:'에너지 125. 넓은 범위 지상 유닛 공격을 8초간 무력화.',
  stasis:'에너지 100. 넓은 범위 유닛을 6초간 정지+무적(피아 모두).',
  recall:'에너지 150. 넓은 범위 아군을 시전자 위치로 순간이동.',
  parasite:'에너지 75. 지정한 적에 기생해 그 유닛 시야를 영구 공유.',
  dark_swarm:'에너지 100. 넓은 범위를 8초간 덮어 안의 아군이 받는 원거리 피해 0.',
  plague:'에너지 150. 넓은 범위 적을 6초간 초당 18(총 108) 피해(최소 1까지).',
  consume:'무료. 아군 유닛을 잡아먹어 에너지 +50 회복.',
  irradiate:'에너지 75 소모. 지정한 적에 8초간 총 240 피해(생체).',
  defensive_matrix:'에너지 100 소모. 지정 아군에 250 피해를 흡수하는 보호막.',
  restoration:'에너지 50 소모. 지정 아군의 해로운 상태 효과를 제거.',
  optical_flare:'에너지 75 소모. 지정한 적 시야를 20초간 줄이고 탐지 무력화.',
  parasite_note:'', scan:'지정 지점을 잠시 밝히고 은신 유닛을 탐지.', recharge:'지정한 아군의 보호막을 마나로 충전.' };
function _skillDesc(key){ const sk=(typeof SKILLS!=='undefined')?SKILLS[key]:null; return (SKILL_DESC[key]||(sk&&sk.arm)||'특수 능력'); }
// 🔮 스킬 마나 소모 단일 틀 — 관리자 페이지(샌드박스)=SC 가이드값(enSc), 네모네모 게임=기존 energy 그대로(제외). 표시·판정·차감 모두 이걸 사용
function _skCost(sk){ return (typeof G!=='undefined'&&G.sandbox&&sk&&sk.enSc!=null)?sk.enSc:((sk&&sk.energy)||0); }
// 🔻 스킬 카드 하단 코스트 줄 — HP 소모(아드레날린)=H10, 마나=E50. 크레딧/에너지 카드 코스트와 동일 스타일(.cc)
function _skCostHTML(sk){ if(!sk) return ''; if(sk.hpCost>0) return '<span class="cc hp">H'+sk.hpCost+'</span>'; const c=_skCost(sk); return c>0?('<span class="cc en">E'+c+'</span>'):''; }
// 모델키(gmodel||id) → 스킬 키 목록. 하단 선택 패널 '여분 구역'에 버튼 표시.
// 다크템플러=상시 은신(PERMA_CLOAK)·와쳐/제플린=상시 탐지(U.detector) → 스킬 버튼 없음(패시브)
const UNIT_SKILLS={ high_templar:['psi_storm','hallucination'], medic:['heal','restoration','optical_flare'], kronos:['psi_cloak','stasis','recall'], marine:['stim'], medusa:['ensnare','parasite'], defiler:['dark_swarm','plague','consume'], racer:['spider_mine'],
  ghost:['lockdown','nuke'], tank:['siege'], dreadnought:['yamato'], aegis:['emp','irradiate','defensive_matrix'],
  dark_archon:['feedback','maelstrom','mind_control'], falcon:['disruption_web'] };   // 🔮 에테리얼 마법 유닛
function unitSkillKeys(u){ if(!u) return []; let ks=(UNIT_SKILLS[u.gmodel||u.id]||UNIT_SKILLS[u.id]||[]).slice();
  if((u.gmodel||u.id)==='medusa' && typeof G!=='undefined' && G.tech && G.tech.research && G.tech.research.swarm_broodling && ks.indexOf('broodling')<0) ks.push('broodling');   // 🐛 스폰 브루들링 연구 시 브루들링 스킬 부여
  return ks; }
function _skKey(u){ return (u&&(u.gmodel||u.id))||''; }
function isCloaked(u){ return !!(u&&(PERMA_CLOAK[_skKey(u)] || (u.skillOn&&u.skillOn.cloak) || u._fieldCloak)); }   // 상시/토글/오라 은신
function isDetector(u){ const d=u&&(typeof U!=='undefined')&&U[_skKey(u)]; return !!(d&&d.detector); }   // 탐지 유닛(U.detector)
// (구 renderSkillBar/castSkill 제거 — 스킬은 커맨드 그리드 카드 + mainCastSkill이 담당)
function _sbFoeAt(x,y){ const L=_skFoes(); let best=null, bd=0.055*0.055; for(const e of L){ if(e.dead||e.x==null) continue; const dx=e.x-x, dy=e.y-y, d=dx*dx+dy*dy; if(d<=bd){ bd=d; best=e; } } return best; }   // 탭 지점 근처 적 픽
function fireSkillEnemy(uid,key,foe){ const u=G.units.find(z=>z.uid===uid); const sk=SKILLS[key]; if(!u||!sk||!foe) return;
  { const _c=_skCost(sk); if(_c>0){ if((u.en||0)<_c) return; u.en-=_c; } }
  u.skillCd=u.skillCd||{}; u.skillCd[key]=sk.cd||0; G.skillFx=G.skillFx||[];
  if(key==='lockdown'){ foe.stunT=Math.max(foe.stunT||0, sk.dur||6); G.skillFx.push({type:'lock', x:foe.x, y:foe.y, t:0, dur:sk.dur||6, foe:foe}); }
  else if(key==='yamato'){ G.skillFx.push({type:'beam', sx:u.x, sy:u.y-0.02, x:foe.x, y:foe.y, t:0, dur:0.55}); _skHurt(foe, sk.dmg, uid); }
  else if(key==='broodling'){ const fx=foe.x, fy=foe.y; if(foe.hp!=null){ foe.hp=0; } foe.dead=true; foe._killer=u.uid;   // 🐛 대상 즉사 + 그 자리 스웜링 2기
    for(let n=0;n<(sk.spawn||2);n++){ _spawnBroodling(u, fx, fy); } G.skillFx.push({type:'boom', x:fx, y:fy, t:0, dur:0.4, r:0.05}); }
  else if(key==='feedback'){ const burn=Math.round(foe.en||0); foe.en=0; if(burn>0) _skHurt(foe, burn, uid); G.skillFx.push({type:'boom', x:foe.x, y:foe.y, t:0, dur:0.45, r:0.035}); }   // 💥 마나 소각 + 소각량만큼 쉴드무시 피해
  else if(key==='mind_control'){ if(u.team==='foe') foe.team='foe'; else delete foe.team; foe.target=null; foe._aggro=null; foe.moveTo=null; u.sh=0;   // 🧠 장악(팀 전환) + 시전자 쉴드 0
    G.skillFx.push({type:'beam', sx:u.x, sy:u.y-0.02, x:foe.x, y:foe.y, t:0, dur:0.6}); }
  else if(key==='parasite'){ foe._parasited=1; foe._revealed=1; G.skillFx.push({type:'boom', x:foe.x, y:foe.y, t:0, dur:0.4, r:0.025}); }   // 🦠 기생 → 시야 공유(영구)
  else if(key==='irradiate'){ foe._irradT=sk.dur||8; foe._irradDps=sk.dps||30; foe._irradBy=uid; foe._revealed=1; G.skillFx.push({type:'emp', x:foe.x, y:foe.y, t:0, dur:0.5, r:0.04}); }   // ☢ 방사능 지속 피해(생체)
  else if(key==='optical_flare'){ foe._blind=sk.dur||20; foe._noDetect=1; G.skillFx.push({type:'boom', x:foe.x, y:foe.y, t:0, dur:0.4, r:0.03}); }   // 👁 실명(시야 축소·디텍터 무력화)
  if(typeof playSfx==='function')playSfx('skill'); if(typeof addChat==='function') addChat('', sk.name+' 시전!'); refreshSelCard();
}
function _skEmp(x,y,r){ const L=_skFoes(), r2=r*r; for(const e of L){ if(e.dead) continue; const dx=e.x-x, dy=e.y-y; if(dx*dx+dy*dy<=r2){ if(e.sh!=null) e.sh=0; e.en=0; e.empT=1.5; } } }
function fireSkillUnit(uid,key,tgtUid){ const u=G.units.find(z=>z.uid===uid), t=G.units.find(z=>z.uid===tgtUid); const sk=SKILLS[key]; if(!u||!t||!sk||t===u) return;
  { const _c=_skCost(sk); if(_c>0){ if((u.en||0)<_c) return; u.en-=_c; u.skillCd=u.skillCd||{}; u.skillCd[key]=sk.cd||0; } }
  if(key==='heal'){ u.healFocus=tgtUid; }   // 지정 힐: 따라다니며 이 유닛만 치료
  else if(key==='consume'){ if(t.maxHp!=null) t.hp=0; t.dead=true; t._killer=u.uid;   // 🍽 아군 잡아먹기 → 마나 +gain
    if(u.maxEn>0) u.en=Math.min(u.maxEn,(u.en||0)+(sk.gain||50)); G.skillFx=G.skillFx||[]; G.skillFx.push({type:'boom', x:t.x, y:t.y, t:0, dur:0.4, r:0.03}); }
  else if(key==='defensive_matrix'){ t._matrix=(t._matrix||0)+(sk.absorb||250); G.skillFx=G.skillFx||[]; G.skillFx.push({type:'emp', x:t.x, y:t.y, t:0, dur:0.5, r:0.045}); }   // 🛡 흡수 보호막
  else if(key==='restoration'){ t.stunT=0; t.slowT=0; t.empT=0; t.ensnared=0; t._parasited=0; t._irradT=0; t._blind=0; t._plagued=0; G.skillFx=G.skillFx||[]; G.skillFx.push({type:'boom', x:t.x, y:t.y, t:0, dur:0.35, r:0.03}); }   // ✳ 디버프 해제
  else if(key==='hallucination'){ G.skillFx=G.skillFx||[]; const n=sk.count||2;   // 👥 대상 환영 n기(0 공격·일정시간 후 소멸)
    for(let i=0;i<n;i++){ const off=(i?1:-1)*0.02; const c=initUnitStats({uid:G.idSeq++, id:t.id, hero:false, lv:1, x:t.x+off, y:t.y+0.012, cd:0, fixed:false});
      if(t.gmodel){ c.gmodel=t.gmodel; if(typeof _btModelStats==='function') _btModelStats(c,t.gmodel); } c.gname=(t.gname||''); c._illusion=true; c._illT=20; c.dmg=0; c.en=0; c.maxEn=0; if(t.team==='foe') c.team='foe';
      G.units.push(c); if(window.M3D&&M3D.spawnModel){ try{ M3D.spawnModel(c); }catch(_e){} } }
    G.skillFx.push({type:'boom', x:t.x, y:t.y, t:0, dur:0.4, r:0.03}); }
  if(typeof playSfx==='function')playSfx('skill'); if(typeof addChat==='function') addChat('', sk.name+': 대상 지정'); refreshSelCard();
}
function _healApply(u,t,dt){ if(u.maxEn>0){ if((u.en||0)<=0) return false; u.en=Math.max(0,u.en-10*dt); } if(t.maxHp){ t.hp=Math.min(t.maxHp,(t.hp!=null?t.hp:t.maxHp)+24*dt); } return true; }
function fireSkillGround(uid,key,x,y){ const u=G.units.find(z=>z.uid===uid); const sk=SKILLS[key]; if(!u||!sk) return;
  { const _c=_skCost(sk); if(_c>0){ if((u.en||0)<_c) return; u.en-=_c; } }
  u.skillCd=u.skillCd||{}; u.skillCd[key]=sk.cd||0; G.skillFx=G.skillFx||[];
  if(key==='psi_storm') G.skillFx.push({type:'storm', x:x, y:y, t:0, dur:sk.dur, r:sk.radius, dmg:sk.dmg, owner:uid});
  else if(key==='ensnare') G.skillFx.push({type:'ensnare', x:x, y:y, t:0, dur:sk.dur, r:sk.radius, slow:sk.slow, owner:uid});
  else if(key==='spider_mine') G.skillFx.push({type:'mine', x:x, y:y, t:0, dur:1e9, r:sk.r, trig:sk.trig, dmg:sk.dmg, owner:uid, armT:1.0});
  else if(key==='nuke') G.skillFx.push({type:'nuke', x:x, y:y, t:0, dur:(sk.delay||3.5)+0.9, delay:sk.delay||3.5, r:sk.radius, dmg:sk.dmg, owner:uid, boomed:false});
  else if(key==='emp'){ G.skillFx.push({type:'emp', x:x, y:y, t:0, dur:0.6, r:sk.radius}); _skEmp(x,y,sk.radius); }
  else if(key==='maelstrom'){ const L=_skFoes(), r=sk.radius||0.1, r2=r*r; for(const e of L){ if(e.dead) continue; const dx=e.x-x,dy=e.y-y; if(dx*dx+dy*dy<=r2) e.stunT=Math.max(e.stunT||0, sk.dur||6); } G.skillFx.push({type:'storm', x:x, y:y, t:0, dur:sk.dur||6, r:r, dmg:0, owner:uid}); }   // 🌀 범위 적 마비(생체) — 보라 연출(피해 0)
  else if(key==='disruption_web') G.skillFx.push({type:'ensnare', x:x, y:y, t:0, dur:sk.dur||8, r:sk.radius||0.11, slow:0.5, owner:uid});   // 🕸️ 지상 결계 = 범위 적 무력화(둔화 근사)
  else if(key==='stasis'){ const r=sk.radius||0.1, r2=r*r; for(const e of (G.units||[])){ if(e.fixed||e===u) continue; const dx=e.x-x,dy=e.y-y; if(dx*dx+dy*dy<=r2){ e.stunT=Math.max(e.stunT||0, sk.dur||6); e._stasis=sk.dur||6; } } G.skillFx.push({type:'emp', x:x, y:y, t:0, dur:sk.dur||6, r:r}); }   // 🧊 범위 유닛 정지+무적(아군/적)
  else if(key==='recall'){ const r=sk.radius||0.18, r2=r*r, foeCaster=(u.team==='foe'); let n=0; for(const a of (G.units||[])){ if(a.fixed||a===u||((a.team==='foe')!==foeCaster)) continue; const dx=a.x-x,dy=a.y-y; if(dx*dx+dy*dy<=r2){ const off=(n%2?1:-1)*0.02*(1+((n/2)|0)); a.x=Math.max(0.02,Math.min(0.98,u.x+off)); a.y=Math.max(0.04,Math.min(0.96,u.y+0.03+0.012*((n/2)|0))); a.moveTo=null; a.target=null; n++; } } G.skillFx.push({type:'boom', x:x, y:y, t:0, dur:0.5, r:0.04}); G.skillFx.push({type:'boom', x:u.x, y:u.y, t:0, dur:0.5, r:0.04}); }   // ↩️ 근처 아군 → 시전자 위치로 순간이동
  else if(key==='dark_swarm'){ const r2=(sk.radius||0.13)*(sk.radius||0.13), foeCaster=(u.team==='foe'); for(const a of (G.units||[])){ if(a.fixed) continue; if((a.team==='foe')!==foeCaster) continue; const dx=a.x-x,dy=a.y-y; if(dx*dx+dy*dy<=r2) a._darkSwarm=sk.dur||8; } G.skillFx.push({type:'dswarm', x:x, y:y, t:0, dur:sk.dur||8, r:sk.radius||0.13}); }   // ☁️ 범위 아군 원거리 피해 무효(지속 갱신)
  else if(key==='plague') G.skillFx.push({type:'plague', x:x, y:y, t:0, dur:sk.dur||6, r:sk.radius||0.11, dps:sk.dps||18, owner:uid});   // 🩸 범위 HP 지속 감소(체력 1까지)
  if(typeof playSfx==='function')playSfx('skill'); if(typeof addChat==='function') addChat('', sk.name+' 시전!'); refreshSelCard();
}
function _skFoes(){ if(G.sandbox && G.tab==='Battle' && G.units){ return G.units.filter(u=>u.team==='foe' && !(u.maxHp&&(u.hp!=null?u.hp:u.maxHp)<=0)); } const a=G.enemies||[], b=G.sbFoes; return (b&&b.length)?(a.length?a.concat(b):b):a; }   // 전투실험=적팀 실유닛 / 그 외=실전 적+더미
function _skHurt(e,dmg,owner){ if(e._stasis>0||e._darkSwarm>0) return;   // 🧊 스테이시스 무적 / ☁️ 다크스웜 = 원거리·스킬 피해 무효
  if(e._matrix>0){ const a=Math.min(e._matrix,dmg); e._matrix-=a; dmg-=a; if(dmg<=0) return; }   // 🛡 디펜시브 매트릭스 흡수
  if(e.eid!=null){ try{ _atkUid=owner; }catch(_){} if(typeof hitEnemy==='function') hitEnemy(e,dmg); }   // 정규 적=hitEnemy(방어/실드/킬귀속)
  else { e.hp-=dmg; e.flash=0.12; if(e.hp<=0) e.dead=true; } }   // 실험 더미=직접 피해
function _skPlague(f){ const L=_skFoes(); if(!L.length) return; const r2=f.r*f.r, dmg=(f.dps||18)*0.5;   // 🩸 체력만 감소(쉴드 무시), 1까지 · 0.5초 간격
  for(const e of L){ if(e.dead) continue; const dx=e.x-f.x, dy=e.y-f.y; if(dx*dx+dy*dy<=r2){ const hp=(e.hp!=null?e.hp:e.maxHp); if(hp>1){ e.hp=Math.max(1, hp-dmg); e.flash=0.1; } } } }
function _skStormDamage(f){ const L=_skFoes(); if(!L.length) return; const r2=f.r*f.r;   // 범위 내 대상 지속 피해
  for(const e of L){ if(e.dead) continue; const dx=e.x-f.x, dy=e.y-f.y; if(dx*dx+dy*dy<=r2) _skHurt(e, f.dmg, f.owner); } }
function _skEnsnare(f){ const L=_skFoes(); if(!L.length) return; const r2=f.r*f.r;   // 범위 내 대상 둔화
  for(const e of L){ if(e.dead) continue; const dx=e.x-f.x, dy=e.y-f.y; if(dx*dx+dy*dy<=r2){ e.slowT=Math.max(e.slowT||0, 1.2); e.ensnared=1; } } }
function _skMineTrigger(f){ const L=_skFoes(); const r2=f.trig*f.trig;   // 접근한 대상 감지
  for(const e of L){ if(e.dead) continue; const dx=e.x-f.x, dy=e.y-f.y; if(dx*dx+dy*dy<=r2) return e; } return null; }
function _skMineBoom(f){ G.skillFx=G.skillFx||[]; G.skillFx.push({type:'boom', x:f.x, y:f.y, t:0, dur:0.4, r:f.r}); const L=_skFoes(), r2=f.r*f.r;   // 폭발 연출 + 광역 피해
  for(const e of L){ if(e.dead) continue; const dx=e.x-f.x, dy=e.y-f.y; if(dx*dx+dy*dy<=r2) _skHurt(e, f.dmg, f.owner); }
  if(typeof playSfx==='function') playSfx('boom'); }
function _skAura(u, key, sk){ if(!G.units) return; const r2=(sk.radius||0.12)*(sk.radius||0.12);
  if(sk.cloakAllies){ for(const a of G.units){ if(a.fixed) continue; const dx=a.x-u.x, dy=a.y-u.y; if(dx*dx+dy*dy<=r2) a._fieldCloak=true; } }   // 오라 은신: 범위 내 아군
  if(sk.detect && G.enemies){ for(const e of G.enemies){ if(e.dead) continue; const dx=e.x-u.x, dy=e.y-u.y; if(dx*dx+dy*dy<=r2) e._revealed=true; } }   // 탐지 훅: 범위 내 적 표식(전투 유즈맵용)
}
const MEDUSA_BROOD_CD=8, MEDUSA_BROOD_MAX=6, MEDUSA_BROOD_LIFE=60;   // 메두사 스웜링: 8초당 1기, 최대 6기, 60초 지속(체력 점감 후 소멸)
function _spawnBroodling(m, x, y){ if(typeof G==='undefined'||!G.units) return null; if(G.idSeq==null) G.idSeq=1;   // 메두사(m) 팀 스웜링 1기 생산(x,y 지정 시 그 자리)
  const bx=(x!=null?x:m.x)+(Math.random()-0.5)*0.03, by=(y!=null?y:m.y+0.02)+(Math.random()-0.5)*0.02;
  const child=initUnitStats({uid:G.idSeq++, id:'hydra', hero:false, lv:1, x:bx, y:by, cd:0, fixed:false});
  child.gmodel='broodling'; if(typeof _btModelStats==='function') _btModelStats(child,'broodling'); child.gname='스웜링'; child._broodOwner=m.uid;
  child._broodLife=MEDUSA_BROOD_LIFE; child._broodHp0=child.maxHp||30;   // 60초 수명 · 기준 체력(점감 표시)
  if(m.team==='foe') child.team='foe'; G.units.push(child);
  if(window.M3D&&M3D.spawnModel){ try{ M3D.spawnModel(child); }catch(_e){} } return child; }
function stepSkills(dt){ if(typeof G==='undefined'||!G.units) return; G._skT=(G._skT||0)+dt;
  for(const u of G.units){ u._fieldCloak=false; u._healTgt=null; }   // 오라 은신·치유 대상 매 프레임 초기화
  for(const u of G.units){ if(u.fixed) continue;
    if(u.maxEn>0) u.en=Math.min(u.maxEn,(u.en||0)+(G.sandbox?(1/1.2):SKILL_EN_REGEN)*dt);   // 에너지 재생 · 샌드박스(건설·전투실험)=SC 1.2초당 1 / 실게임=SKILL_EN_REGEN
    if(u.skillCd){ for(const k in u.skillCd){ if(u.skillCd[k]>0) u.skillCd[k]=Math.max(0,u.skillCd[k]-dt); } }
    if(u.skillOn){ for(const k in u.skillOn){ if(!u.skillOn[k]) continue; const sk=SKILLS[k]; if(!sk) continue;
      if(sk.drain&&u.maxEn>0){ u.en-=sk.drain*dt; if(u.en<=0){ u.en=0; u.skillOn[k]=false; continue; } }
      if(sk.kind==='aura') _skAura(u, k, sk); } }
    if(u.buff){ for(const k in u.buff){ const bf=u.buff[k]; if(bf&&bf.t>0){ bf.t-=dt; if(bf.t<=0) delete u.buff[k]; } } }   // 자기 강화(스팀팩 등) 지속시간
    if(u._stasis>0){ u._stasis-=dt; u.moving=false; }   // 🧊 스테이시스 = 정지+무적(지속)
    if(u._darkSwarm>0){ u._darkSwarm-=dt; }   // ☁️ 다크스웜 보호(존 안에서 매프레임 갱신 → 벗어나면 만료)
    if(u._blind>0){ u._blind-=dt; if(u._blind<=0) u._noDetect=0; }   // 👁 옵티컬 플레어 실명
    if(u._irradT>0){ u._irradT-=dt; const hp=(u.hp!=null?u.hp:u.maxHp); if(hp>1) u.hp=Math.max(1, hp-(u._irradDps||30)*dt); u.flash=0.08; if(u._irradT<=0) u._irradDps=0; }   // ☢ 이레디에이트 지속 피해(체력만, 1까지)
    if(u._illusion){ u._illT=(u._illT||0)-dt; if(u._illT<=0) u.dead=true; }   // 👥 환영 = 수명 만료 시 소멸
    if(HEALER[_skKey(u)]){ let t=null;   // 메딕: 지정 힐(따라다니며 1명) or 자동(근처 부상 바이오닉)
      if(u.healFocus){ t=G.units.find(z=>z.uid===u.healFocus && !z.dead && !z.fixed); if(!t) u.healFocus=null; }
      if(t){ const dx=t.x-u.x, dy=t.y-u.y, d=Math.hypot(dx,dy)||0.0001;
        if(d>HEAL_RANGE*0.8) u.moveTo={ x:t.x-(dx/d)*HEAL_RANGE*0.55, y:t.y-(dy/d)*HEAL_RANGE*0.55 };   // 사거리 밖 → 접근(따라다님)
        if(d<=HEAL_RANGE && _healApply(u,t,dt)) u._healTgt=t.uid; }
      else { let best=null, bd=HEAL_RANGE*HEAL_RANGE;   // 자동: 근처 부상 바이오닉 중 최근접
        for(const a of G.units){ if(a===u||a.fixed||a.dead||!BIONIC[_skKey(a)]) continue; if(!a.maxHp||(a.hp!=null?a.hp:a.maxHp)>=a.maxHp) continue; const dx=a.x-u.x, dy=a.y-u.y, dd=dx*dx+dy*dy; if(dd<=bd){ bd=dd; best=a; } }
        if(best && _healApply(u,best,dt)) u._healTgt=best.uid; } }
  }
  for(let i=G.units.length-1;i>=0;i--){ const u=G.units[i]; if(u._illusion&&u.dead){ if(window.M3D&&M3D.removeModel){ try{ M3D.removeModel(u); }catch(_e){} } G.units.splice(i,1); if(G.sel) G.sel=G.sel.filter(id=>id!==u.uid); } }   // 👥 소멸한 환영 제거
  for(const u of G.units){ u._cloaked=isCloaked(u); u._detected=false; u._detAlly=false; u._detFoe=false; }   // 은신·팀별 탐지 초기화
  for(const d of G.units){ if(!isDetector(d)||d.dead) continue; const r2=DETECT_RANGE*DETECT_RANGE; const _dT=(d.team==='foe')?'foe':'ally';   // 탐지기 소속팀에만 은신 노출
    for(const u of G.units){ if(!u._cloaked) continue; const dx=u.x-d.x, dy=u.y-d.y; if(dx*dx+dy*dy<=r2){ u._detected=true; if(_dT==='foe') u._detFoe=true; else u._detAlly=true; } } }
  { const _meds=[]; for(const u of G.units){ if(!u.fixed && (u.gmodel||u.id)==='medusa' && (u.hp!=null?u.hp:u.maxHp)>0) _meds.push(u); }   // 메두사 스웜링 자동 생성(8초/1기, 최대 6기)
    for(const m of _meds){ m._broodT=(m._broodT||0)+dt; if(m._broodT>=MEDUSA_BROOD_CD){ m._broodT=0;
      let alive=0; for(const c of G.units){ if(c._broodOwner===m.uid && !c.dead) alive++; } if(alive<MEDUSA_BROOD_MAX) _spawnBroodling(m); } }
    for(let i=G.units.length-1;i>=0;i--){ const c=G.units[i]; if(c._broodOwner==null) continue;   // 🐛 스웜링 수명(60초 체력 점감→소멸) + 소유 메두사 추종(유휴 시)
      c._broodLife=(c._broodLife==null?MEDUSA_BROOD_LIFE:c._broodLife)-dt;
      const _h0=c._broodHp0||c.maxHp||30; if(c.maxHp) c.hp=Math.max(1,Math.round(_h0*Math.max(0,c._broodLife)/MEDUSA_BROOD_LIFE));
      if(c._broodLife<=0){ if(window.M3D&&M3D.dropModels){ try{ M3D.dropModels([c.uid]); }catch(_e){} } G.units.splice(i,1); if(G.sel) G.sel=G.sel.filter(id=>id!==c.uid); continue; }
      const own=G.units.find(z=>z.uid===c._broodOwner&&!z.dead); if(own && !c.atkTarget && !c._chasing){ const dx=own.x-c.x, dy=own.y-c.y, d=Math.hypot(dx,dy); if(d>0.1) c.moveTo={x:own.x-(dx/d)*0.06, y:own.y-(dy/d)*0.06}; } } }
  if(G.skillFx&&G.skillFx.length){ for(let i=G.skillFx.length-1;i>=0;i--){ const f=G.skillFx[i]; f.t+=dt;
    if(f.type==='storm'){ f.boltT=(f.boltT||0)-dt; if(f.boltT<=0){ f.boltT=0.05; (f.bolts=f.bolts||[]).push({a:Math.random()*6.28, rr:Math.random(), t:0}); }
      if(f.bolts){ for(let b=f.bolts.length-1;b>=0;b--){ f.bolts[b].t+=dt; if(f.bolts[b].t>0.24) f.bolts.splice(b,1); } }
      f.dmgAcc=(f.dmgAcc||0)+dt; if(f.dmgAcc>=0.5){ f.dmgAcc-=0.5; _skStormDamage(f); } }
    else if(f.type==='ensnare'){ f.slowAcc=(f.slowAcc||0)+dt; if(f.slowAcc>=0.3){ f.slowAcc-=0.3; _skEnsnare(f); } }
    else if(f.type==='plague'){ f.pAcc=(f.pAcc||0)+dt; if(f.pAcc>=0.5){ f.pAcc-=0.5; _skPlague(f); } }   // 🩸 플레이그 지속 피해
    else if(f.type==='dswarm'){ const r2=f.r*f.r; for(const a of (G.units||[])){ if(a.fixed) continue; const dx=a.x-f.x,dy=a.y-f.y; if(dx*dx+dy*dy<=r2) a._darkSwarm=0.2; } }   // ☁️ 다크스웜: 범위 내 유닛 원거리 피해 무효(매프레임 갱신)
    else if(f.type==='mine'){ if(f.armT>0) f.armT-=dt; else if(_skMineTrigger(f)){ _skMineBoom(f); f._done=true; } }
    else if(f.type==='nuke'){ if(!f.boomed && f.t>=f.delay){ f.boomed=true; G.skillFx.push({type:'boom', x:f.x, y:f.y, t:0, dur:0.9, r:f.r*1.5}); const L=_skFoes(), r2=f.r*f.r; for(const e of L){ if(e.dead) continue; const dx=e.x-f.x, dy=e.y-f.y; if(dx*dx+dy*dy<=r2) _skHurt(e, f.dmg, f.owner); } if(typeof playSfx==='function') playSfx('boom'); } }
    else if(f.type==='lock'){ if(f.foe && !f.foe.dead){ f.x=f.foe.x; f.y=f.foe.y; } else f._done=true; }
    if(f._done||f.t>=f.dur) G.skillFx.splice(i,1);
  } } }
function _skW2S(wx,wy,W,H){ const v=(typeof G!=='undefined')&&G.view; let x=wx,y=wy; if(v&&v.zoom&&v.zoom!==1){ x=(wx-v.x)*v.zoom+0.5; y=(wy-v.y)*v.zoom+0.5; } return {x:x*W, y:y*H, z:(v&&v.zoom)||1}; }
function _skHasUnitFx(){ if(!G.units) return false; for(const u of G.units){ if(u._cloaked||u._healTgt||isDetector(u)||(u.buff&&u.buff.stim&&u.buff.stim.t>0)||(u.skillOn&&u.skillOn.siege)) return true; if(u.skillOn){ for(const k in u.skillOn){ if(u.skillOn[k]&&SKILLS[k]&&SKILLS[k].kind==='aura') return true; } } } return false; }
function drawSkillFx(){ if(typeof G==='undefined') return; const hasFx=!!(G.skillFx&&G.skillFx.length); if(!hasFx && !_skHasUnitFx() && !(G.sbFoes&&G.sbFoes.length)) return;
  const cv=document.getElementById('cvFx'); if(!cv) return; const ctx=cv.getContext('2d'); if(!ctx) return; const W=cv.width, H=cv.height;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  if(hasFx)
  for(const f of G.skillFx){ if(f.type!=='storm') continue; const p=_skW2S(f.x,f.y,W,H); const R=f.r*W*p.z;
    const life=f.t/f.dur, fade=life<0.15?(life/0.15):(life>0.8?((1-life)/0.2):1);
    const g=ctx.createRadialGradient(p.x,p.y,R*0.15,p.x,p.y,R); g.addColorStop(0,'rgba(160,130,255,0.42)'); g.addColorStop(1,'rgba(90,60,200,0)');
    ctx.globalAlpha=0.55*fade; ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,R,0,6.28); ctx.fill();
    ctx.globalAlpha=0.5*fade; ctx.strokeStyle='#c8b4ff'; ctx.lineWidth=1.4;   // 소용돌이 뇌운
    for(let s=0;s<3;s++){ ctx.beginPath(); const ph=f.t*3.2+s*2.1; for(let a=0;a<6.3;a+=0.35){ const rr=R*(0.28+0.6*(a/6.3)); const xx=p.x+Math.cos(a+ph)*rr, yy=p.y+Math.sin(a+ph)*rr*0.62; a?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);} ctx.stroke(); }
    if(f.bolts){ ctx.strokeStyle='#efe6ff'; for(const b of f.bolts){ const bl=1-b.t/0.24; if(bl<=0) continue; ctx.globalAlpha=bl*fade; ctx.lineWidth=1+bl*1.6;
      const bx=p.x+Math.cos(b.a)*R*b.rr, by=p.y+Math.sin(b.a)*R*b.rr*0.62; let zx=bx, zy=by-R*0.9; ctx.beginPath(); ctx.moveTo(zx,zy);
      for(let seg=0;seg<3;seg++){ zx+=(b.a*13%7-3); zy+=R*0.3; ctx.lineTo(zx,zy);} ctx.lineTo(bx,by); ctx.stroke(); } }
  }
  const _T=(G._skT||0), _selArr=(G.sel||[]);
  if(hasFx) for(const f of G.skillFx){ const p=_skW2S(f.x,f.y,W,H);   // 인스네어 가스 / 스파이더 마인 / 폭발
    if(f.type==='ensnare'){ const R=f.r*W*p.z, life=f.t/f.dur, fade=life>0.85?((1-life)/0.15):1;
      ctx.globalAlpha=0.16*fade; const g=ctx.createRadialGradient(p.x,p.y,R*0.1,p.x,p.y,R); g.addColorStop(0,'rgba(196,158,66,.6)'); g.addColorStop(1,'rgba(150,120,40,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(p.x,p.y,R,R*0.62,0,0,6.28); ctx.fill();
      ctx.globalAlpha=0.3*fade; ctx.strokeStyle='#e8c060'; ctx.lineWidth=1; for(let s=0;s<6;s++){ const an=s*1.047+_T*0.25; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+Math.cos(an)*R,p.y+Math.sin(an)*R*0.62); ctx.stroke(); } for(let ring=1;ring<=2;ring++){ const rf=R*ring/2.4; ctx.beginPath(); ctx.ellipse(p.x,p.y,rf,rf*0.62,0,0,6.28); ctx.stroke(); } }
    else if(f.type==='mine'){ const rr=6*p.z, blink=(f.armT>0)?(Math.sin(_T*8)>0):(Math.sin(_T*18)>0);
      ctx.globalAlpha=0.92; ctx.fillStyle='#3a3f2a'; ctx.beginPath(); ctx.ellipse(p.x,p.y,rr,rr*0.6,0,0,6.28); ctx.fill();
      ctx.globalAlpha=1; ctx.fillStyle=blink?'#ff5030':'#5a1e14'; ctx.beginPath(); ctx.arc(p.x,p.y-rr*0.2,rr*0.3,0,6.28); ctx.fill();
      if(blink){ ctx.globalAlpha=0.5; ctx.strokeStyle='#ff6040'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(p.x,p.y-rr*0.2,rr*0.75,0,6.28); ctx.stroke(); } }
    else if(f.type==='boom'){ const life=f.t/f.dur, R=f.r*W*p.z*(0.4+life*1.3); ctx.globalAlpha=Math.max(0,1-life); const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,R); g.addColorStop(0,'rgba(255,242,186,.95)'); g.addColorStop(0.5,'rgba(255,140,50,.6)'); g.addColorStop(1,'rgba(120,40,10,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,R,0,6.28); ctx.fill(); }
    else if(f.type==='nuke'){ const pre=Math.min(1,f.t/f.delay), R=f.r*W*p.z; ctx.globalAlpha=0.45+0.35*Math.abs(Math.sin(f.t*10)); ctx.strokeStyle='#ff5030'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(p.x,p.y,R*(1.25-pre*0.6),0,6.28); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x-R*0.55,p.y); ctx.lineTo(p.x+R*0.55,p.y); ctx.moveTo(p.x,p.y-R*0.55); ctx.lineTo(p.x,p.y+R*0.55); ctx.stroke(); ctx.globalAlpha=0.95; ctx.fillStyle='#ffce4a'; ctx.font='bold '+Math.round(13*p.z)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText('☢ '+Math.max(0,Math.ceil(f.delay-f.t)), p.x, p.y-R*0.72); }
    else if(f.type==='lock'){ const rr=11*p.z; ctx.globalAlpha=0.65; ctx.strokeStyle='#ffd24a'; ctx.lineWidth=1.8; for(let s=0;s<2;s++){ const rot=f.t*3+s*Math.PI; ctx.beginPath(); ctx.arc(p.x,p.y,rr+s*3, rot, rot+4.2); ctx.stroke(); } ctx.globalAlpha=0.9; ctx.fillStyle='#ffe27a'; ctx.font='bold '+Math.round(11*p.z)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText('🔒', p.x, p.y+4*p.z); }
    else if(f.type==='emp'){ const life=f.t/f.dur, R=f.r*W*p.z*(0.3+life*1.1); ctx.globalAlpha=Math.max(0,1-life); const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,R); g.addColorStop(0,'rgba(180,230,255,.8)'); g.addColorStop(0.6,'rgba(90,160,255,.5)'); g.addColorStop(1,'rgba(40,80,200,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,R,0,6.28); ctx.fill(); ctx.globalAlpha=Math.max(0,0.8-life); ctx.strokeStyle='#bfe6ff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(p.x,p.y,R,0,6.28); ctx.stroke(); }
    else if(f.type==='beam'){ const s=_skW2S(f.sx,f.sy,W,H), life=f.t/f.dur, aa=Math.max(0,1-life); ctx.globalAlpha=aa*0.7; ctx.strokeStyle='#ffca50'; ctx.lineWidth=4+6*(1-life); ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(p.x,p.y); ctx.stroke(); ctx.globalAlpha=aa; ctx.strokeStyle='#fff6d0'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(p.x,p.y); ctx.stroke(); const R2=18*p.z*(0.3+life); ctx.globalAlpha=aa*0.85; const g2=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,R2); g2.addColorStop(0,'rgba(255,240,180,.9)'); g2.addColorStop(1,'rgba(255,120,40,0)'); ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(p.x,p.y,R2,0,6.28); ctx.fill(); } }
  // 탐지 원(와쳐·제플린 등) — 넓은 시안 원 + 레이더 스윕, 상시 유지
  for(const d of G.units){ if(!isDetector(d)||d.dead) continue; const p=_skW2S(d.x,d.y,W,H), R=DETECT_RANGE*W*p.z;
    ctx.globalAlpha=0.13; ctx.strokeStyle='#7fe0ff'; ctx.lineWidth=1.4; ctx.setLineDash([7,7]); ctx.lineDashOffset=-_T*18; ctx.beginPath(); ctx.ellipse(p.x,p.y,R,R*0.62,0,0,6.28); ctx.stroke(); ctx.setLineDash([]);
    const sa=(_T*1.4)%6.28, g=ctx.createLinearGradient(p.x,p.y,p.x+Math.cos(sa)*R,p.y+Math.sin(sa)*R*0.62); g.addColorStop(0,'rgba(127,224,255,.16)'); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.globalAlpha=1; ctx.strokeStyle=g; ctx.lineWidth=R*0.5; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+Math.cos(sa)*R,p.y+Math.sin(sa)*R*0.62); ctx.stroke(); }
  // 차원 은폐 오라 링(아비터=보라)
  for(const u of G.units){ if(!u.skillOn) continue; for(const k in u.skillOn){ if(!u.skillOn[k]) continue; const sk=SKILLS[k]; if(!sk||sk.kind!=='aura') continue;
    const p=_skW2S(u.x,u.y,W,H), R=(sk.radius||0.12)*W*p.z; ctx.globalAlpha=0.22; ctx.strokeStyle='#c8b0ff'; ctx.lineWidth=1.4; ctx.setLineDash([6,6]); ctx.lineDashOffset=_T*20; ctx.beginPath(); ctx.ellipse(p.x,p.y,R,R*0.62,0,0,6.28); ctx.stroke(); ctx.setLineDash([]); } }
  // 은신 일렁임: 미탐지·미선택 은신 유닛만(3D 모델 완전 투명 → 배경만 미세 왜곡)
  for(const u of G.units){ if(!u._cloaked || u._detected || _selArr.indexOf(u.uid)>=0) continue; const p=_skW2S(u.x,u.y,W,H), rad=((typeof unitRadius==='function'?unitRadius(u):14))*p.z, ph=_T*2.2+(u.uid||0);
    ctx.globalAlpha=0.07+0.03*Math.sin(ph); const g=ctx.createRadialGradient(p.x,p.y-rad*0.5,rad*0.15,p.x,p.y-rad*0.5,rad*1.25); g.addColorStop(0,'rgba(170,220,255,.42)'); g.addColorStop(0.6,'rgba(140,190,255,.12)'); g.addColorStop(1,'rgba(120,170,255,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y-rad*0.5,rad*1.25,0,6.28); ctx.fill();
    ctx.globalAlpha=0.11; ctx.strokeStyle='#bfe6ff'; ctx.lineWidth=1; for(let s=0;s<2;s++){ const yb=p.y-rad*1.0+s*rad*0.8; ctx.beginPath(); for(let xx=-rad;xx<=rad;xx+=4){ const yy=yb+Math.sin(xx*0.4+ph*2+s)*1.6; (xx===-rad)?ctx.moveTo(p.x+xx,yy):ctx.lineTo(p.x+xx,yy);} ctx.stroke(); } }
  // 치유 빔(자동/지정 공통) + 대상 회복 반짝
  for(const u of G.units){ if(!u._healTgt) continue; const t=G.units.find(z=>z.uid===u._healTgt); if(!t) continue; const a=_skW2S(u.x,u.y-0.02,W,H), b=_skW2S(t.x,t.y-0.02,W,H);
    ctx.globalAlpha=0.5; ctx.strokeStyle='#7fffcf'; ctx.lineWidth=2.6; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    ctx.globalAlpha=0.9; ctx.strokeStyle='#eafff6'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    for(let s=0;s<3;s++){ const rr=((_T*30+s*13)%26), px=b.x+Math.sin(_T*5+s*2.1)*7, py=b.y-rr; ctx.globalAlpha=Math.max(0,0.7-rr/30); ctx.strokeStyle='#8affd0'; ctx.lineWidth=1.7; ctx.beginPath(); ctx.moveTo(px-3,py); ctx.lineTo(px+3,py); ctx.moveTo(px,py-3); ctx.lineTo(px,py+3); ctx.stroke(); } }
  // 시즈 모드: 붉은 포진 링 + 지지대
  for(const u of G.units){ if(!u.skillOn||!u.skillOn.siege) continue; const p=_skW2S(u.x,u.y,W,H), rad=((typeof unitRadius==='function'?unitRadius(u):14))*p.z;
    ctx.globalAlpha=0.42; ctx.strokeStyle='#ff8a5a'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(p.x,p.y,rad*1.15,rad*1.15*0.5,0,0,6.28); ctx.stroke();
    ctx.globalAlpha=0.28; ctx.lineWidth=1.5; for(let s=0;s<4;s++){ const an=s*1.57+_T*0.4; ctx.beginPath(); ctx.moveTo(p.x+Math.cos(an)*rad*0.75,p.y+Math.sin(an)*rad*0.38); ctx.lineTo(p.x+Math.cos(an)*rad*1.35,p.y+Math.sin(an)*rad*0.68); ctx.stroke(); } }
  // 스팀팩 등 자기 강화: 붉은 발밑 링 + 상승 스팀
  for(const u of G.units){ if(!u.buff||!u.buff.stim||u.buff.stim.t<=0) continue; const p=_skW2S(u.x,u.y,W,H), rad=((typeof unitRadius==='function'?unitRadius(u):14))*p.z, uid=(u.uid||0);
    ctx.globalAlpha=0.3; ctx.strokeStyle='#ff6a5a'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.ellipse(p.x,p.y,rad*0.9,rad*0.9*0.5,0,0,6.28); ctx.stroke();
    ctx.fillStyle='#ff8a6a'; for(let s=0;s<3;s++){ const yy=p.y-((_T*22+s*9)%22), xx=p.x+Math.sin(_T*3+s*2+uid)*rad*0.5; ctx.globalAlpha=Math.max(0,0.26-((_T*22+s*9)%22)/90); ctx.beginPath(); ctx.arc(xx,yy,2+s*0.6,0,6.28); ctx.fill(); } }
  // 전투 실험 더미(2D 적) — 정규 적 시스템과 분리
  if(G.sbFoes&&G.sbFoes.length&&G.tab==='Battle'){ ctx.globalCompositeOperation='source-over';
    for(const e of G.sbFoes){ if(e.dead) continue; const p=_skW2S(e.x,e.y,W,H), rr=(e.r||0.02)*W*p.z;
      ctx.globalAlpha=1; ctx.fillStyle=(e.flash>0)?'#ffd0d0':((e.slowT>0)?'#c08a40':'#c83a3a'); ctx.strokeStyle='#3a0808'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(p.x,p.y,rr,0,6.28); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#2a0000'; ctx.beginPath(); ctx.arc(p.x-rr*0.35,p.y-rr*0.18,rr*0.16,0,6.28); ctx.arc(p.x+rr*0.35,p.y-rr*0.18,rr*0.16,0,6.28); ctx.fill();
      const w=rr*2, hpR=Math.max(0,Math.min(1,e.hp/(e.maxHp||1))); ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(p.x-w/2,p.y-rr-7,w,4); ctx.fillStyle=hpR>0.5?'#7fe07f':(hpR>0.25?'#e0c040':'#e05050'); ctx.fillRect(p.x-w/2,p.y-rr-7,w*hpR,4);
      if(e.slowT>0){ ctx.globalAlpha=0.5; ctx.strokeStyle='#e8c060'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(p.x,p.y,rr+3,0,6.28); ctx.stroke(); } } }
  ctx.restore(); }
// ════════════════════════════════════════════════════════════════
// 🧪 스프라이트 유닛 실험장(관리자 Battle 탭) — 3D 모델을 프리렌더한 8방향 스프라이트 프로토타입(레인저)
//   걷기=총 내림 / 정지=총 내림 / 공격=총 듦 (자세는 손 본에 부착된 총이 애니를 따라감 · 베이크 결과)
// ════════════════════════════════════════════════════════════════
// 시트 규격은 유닛 모델 키로 찾는다 — 관리자 실험장과 던전 전장이 '같은 표'를 본다(단일 소스).
// 시트를 새로 구우면 여기 한 줄만 추가하면 두 곳에 동시에 반영된다.
const SPR_UNITS={
  marine:{ cell:96, dirs:8, dispBase:96,
    states:{ idle:{frames:8,fps:8,loop:1}, walk:{frames:8,fps:12,loop:1}, attack:{frames:6,fps:14,loop:0} },
    url:{ idle:'assets/sprites/marine/idle.png', walk:'assets/sprites/marine/walk.png', attack:'assets/sprites/marine/attack.png' } },
};
function sprSheet(key){ return SPR_UNITS[key]||null; }
const SPR_MARINE=SPR_UNITS.marine;   // 실험장이 쓰던 이름(그대로 유지 — 같은 객체다)
let _spr=null, _sprRaf=0, _sprLast=0, _sprScale=1.15, _sprSpin=null;
const SPR_SPEED=125;   // px/s
function sprLabActive(){ return !!(typeof G!=='undefined' && G.sandbox && G.tab==='Battle'); }
function _sprArenaRect(){ const a=document.getElementById('sprArena'); return a?a.getBoundingClientRect():{width:360,height:480}; }
function sprLabStart(){ const lab=document.getElementById('sprLab'); if(!lab) return; lab.classList.add('on');
  const btc=document.getElementById('btCtl'); if(btc) btc.style.display='none';   // 옛 전투 컨트롤 숨김(대체)
  const r=_sprArenaRect(); if(!_spr) _spr={x:r.width/2,y:r.height*0.55,tx:r.width/2,ty:r.height*0.55,dir:0,state:'idle',frame:0,ft:0};
  sprApply(); _sprLast=performance.now(); cancelAnimationFrame(_sprRaf); _sprRaf=requestAnimationFrame(sprLoop); }
function sprLabStop(){ const lab=document.getElementById('sprLab'); if(lab) lab.classList.remove('on'); cancelAnimationFrame(_sprRaf); _sprRaf=0; if(_sprSpin){clearInterval(_sprSpin);_sprSpin=null;} }
function sprLoop(now){ if(!sprLabActive()){ sprLabStop(); return; } const dt=Math.min(0.05,(now-_sprLast)/1000); _sprLast=now; sprTick(dt); _sprRaf=requestAnimationFrame(sprLoop); }
function sprDir(nx,ny){ const a=Math.atan2(nx,-ny); let d=Math.round(a/(Math.PI/4)); return ((d%8)+8)%8; }   // 화면 이동벡터 → 8방향(북=0, 시계)
function sprTick(dt){ const u=_spr; if(!u) return;
  if(u.state==='attack'){ const st=SPR_MARINE.states.attack, spf=1/st.fps; u.ft+=dt; while(u.ft>=spf){ u.ft-=spf; u.frame++; if(u.frame>=st.frames){ u.state='idle'; u.frame=0; break; } } sprRender(); sprHud(); return; }
  const dx=u.tx-u.x, dy=u.ty-u.y, d=Math.hypot(dx,dy);
  if(d>3 && !_sprSpin){ u.state='walk'; const nx=dx/d, ny=dy/d; u.x+=nx*SPR_SPEED*dt; u.y+=ny*SPR_SPEED*dt; u.dir=sprDir(nx,ny); }
  else if(!_sprSpin){ u.state='idle'; }
  const st=SPR_MARINE.states[u.state], spf=1/st.fps; u.ft+=dt; while(u.ft>=spf){ u.ft-=spf; u.frame=(u.frame+1)%st.frames; }
  sprRender(); sprHud(); }
function sprRender(){ const el=document.getElementById('sprUnit'), u=_spr; if(!el||!u) return;
  const DS=Math.round(SPR_MARINE.dispBase*_sprScale), st=SPR_MARINE.states[u.state];
  el.style.width=DS+'px'; el.style.height=DS+'px';
  el.style.backgroundImage="url('"+SPR_MARINE.url[u.state]+"')";
  el.style.backgroundSize=(st.frames*DS)+'px '+(SPR_MARINE.dirs*DS)+'px';
  el.style.backgroundPosition=(-u.frame*DS)+'px '+(-u.dir*DS)+'px';
  el.style.left=u.x+'px'; el.style.top=u.y+'px'; }
function sprHud(){ const h=document.getElementById('sprHud'); if(h&&_spr) h.textContent=_spr.state+' · dir '+_spr.dir; }
function sprApply(){ sprRender(); sprHud(); }
function _sprStopSpin(){ if(_sprSpin){ clearInterval(_sprSpin); _sprSpin=null; } }
function sprLabTap(e){ if(!_spr) return; const r=_sprArenaRect(); _sprStopSpin(); _spr.tx=e.clientX-r.left; _spr.ty=e.clientY-r.top; }
function sprLabSet(s){ if(!_spr) return; _sprStopSpin(); _spr.state=s; _spr.frame=0; _spr.ft=0; if(s==='idle'){ _spr.tx=_spr.x; _spr.ty=_spr.y; } sprApply(); }
function sprLabWalkDemo(){ if(!_spr) return; _sprStopSpin(); const r=_sprArenaRect(); _spr.tx=Math.random()*r.width*0.7+r.width*0.15; _spr.ty=Math.random()*r.height*0.55+r.height*0.28; }
function sprLabAttack(){ if(!_spr) return; _sprStopSpin(); _spr.state='attack'; _spr.frame=0; _spr.ft=0; sprApply(); }
function sprLabSpin(){ if(!_spr) return; if(_sprSpin){ _sprStopSpin(); return; } _spr.state='idle'; _spr.tx=_spr.x; _spr.ty=_spr.y; _spr.frame=0;
  _sprSpin=setInterval(()=>{ if(!_spr){return;} _spr.dir=(_spr.dir+1)%8; sprApply(); },420); }
function sprLabReset(){ _sprStopSpin(); const r=_sprArenaRect(); _spr={x:r.width/2,y:r.height*0.55,tx:r.width/2,ty:r.height*0.55,dir:0,state:'idle',frame:0,ft:0}; sprApply(); }
function sprLabScale(v){ _sprScale=parseFloat(v)||1.15; sprRender(); }
// ════════════════════════════════════════════════════════════════
// ⚔ 전투 실험(관리자 전용) — 자립형 더미 적(G.sbFoes, 정규 적/트랙과 분리). 스킬·치유·은신 실전 검증용.
//   · 스킬 훅(_skFoes)이 sbFoes를 대상으로 → 스톰/인스네어/마인 등 즉시 작동
//   · 더미는 아군에게 접근·접촉 피해(치유·메딕 검증) / 아군은 사거리 내 더미에 기본 DPS
// ════════════════════════════════════════════════════════════════
function _sbUnitRange(u){ const d=Ueff(u); if((d.dmg||0)<=0) return 0; let r=d.melee?0.06:(d.range||0.18); if(u.skillOn&&u.skillOn.siege) r*=(SKILLS.siege.rngMul||1.6); return r; }   // 사거리=U.range(원거리) 반영 → 긴 사거리=선제공격 · 무공격(dmg0)=미공격 · 시즈=사거리↑
function _sbUnitDps(u){ const d=Ueff(u); const dmg=d.dmg||0, cd=(d.cd||20)/60; let dps=dmg>0?dmg/Math.max(0.2,cd):0; if(u.skillOn&&u.skillOn.siege) dps*=(SKILLS.siege.atkMul||1.8); if(u.buff){ for(const _k in u.buff){ const _b=u.buff[_k]; if(_b&&_b.t>0&&_b.atkMul) dps*=_b.atkMul; } } return dps; }   // 시즈·자기버프(스팀팩)=공격↑
function sbCombatSpawn(n){ if(typeof G==='undefined'||!G.units) return; const k=n||5;
  const pool=_btRosterFlat().filter(it=>{ const id=(it.gm&&typeof U[it.gm]!=='undefined')?it.gm:it.b; return !(typeof FXLAB_NOATK!=='undefined'&&FXLAB_NOATK.has(it.gm||id)); });   // 공격형만(수송·지원·시전형 제외)
  if(!pool.length) return;
  for(let i=0;i<k;i++){ const it=pool[(Math.random()*pool.length)|0], sid=((it.gm&&typeof U[it.gm]!=='undefined')?it.gm:it.b); btAddFoe(sid, it.gm||'', it.n, true); }
  G.sbCombat=true; sbCombatUiSync(); if(typeof toast==='function') toast('적군 '+k+'기 무작위 소환'); }
function sbCombatToggle(){ if(typeof G==='undefined') return; G.sbCombat=!G.sbCombat;
  if(G.sbCombat){ if(!(G.units&&G.units.some(u=>u.team==='foe'))) sbCombatSpawn(5); _btSnapshot(); }   // 전투 시작 시점 배치 저장(리셋=재대결)
  sbCombatUiSync(); if(typeof toast==='function') toast(G.sbCombat?'전투 실험 시작':'전투 정지'); }
function sbCombatHurt(){ if(typeof G==='undefined'||!G.units) return; let n=0; for(const u of G.units){ if(u.fixed||u.team==='foe'||!u.maxHp) continue; u.hp=Math.max(1,Math.round(u.maxHp*0.35)); n++; } if(typeof toast==='function') toast('아군 '+n+'기 체력 35%로 손상(치유·메딕 검증)'); }
function sbCombatReset(){ if(typeof G==='undefined') return; G.sbFoes=[]; G.sbCombat=false;
  if(G.btFx){ G.btFx.shots.length=0; G.btFx.impacts.length=0; G.btFx.melee.length=0; G.btFx.smoke.length=0; if(G.btFx.flashes)G.btFx.flashes.length=0; }
  if(G.btPend) G.btPend.length=0;
  if(!_btRestore()){ if(G.units) for(const u of G.units){ if(u.maxHp) u.hp=u.maxHp; if(u.maxSh) u.sh=u.maxSh; } }   // 스냅샷 있으면 원편성 재생성, 없으면 HP만 회복
  if(G.units) for(const u of G.units){ u._btCd=0; if(u._fxL) u._fxL.vnJet=null; if(u.buff) u.buff={}; if(u.skillCd) u.skillCd={}; u.healFocus=null; if(u.skillOn) u.skillOn={}; u._sbEngage=false; u.moveTo=null; }
  if(G.skillFx) G.skillFx.length=0; G.sel=[]; sbCombatUiSync(); if(typeof toast==='function') toast('전투 실험 리셋'); }
function _btSnapshot(){ if(!G.btUnits) return; G._btSnap=G.btUnits.map(u=>({id:u.id, gmodel:u.gmodel, gname:u.gname, team:u.team, x:u.x, y:u.y, hero:!!u.hero, lv:u.lv||1})); }   // 전투 시작 편성 저장
function _btRestore(){ if(!G._btSnap||!G.btUnits) return false; if(G.idSeq==null)G.idSeq=1;
  const arr=G._btSnap.map(sn=>{ const u=initUnitStats({uid:G.idSeq++, id:sn.id, hero:sn.hero, lv:sn.lv, x:sn.x, y:sn.y, cd:0, fixed:false}); if(sn.gmodel)u.gmodel=sn.gmodel; u.gname=sn.gname; if(sn.team)u.team=sn.team; u._btCd=0; return u; });
  G.btUnits.length=0; for(const u of arr) G.btUnits.push(u); if(G.tab==='Battle') G.units=G.btUnits;
  if(window.M3D&&M3D.clearGameModels) M3D.clearGameModels(); return true; }
function sbCombatUiSync(){ const t=document.getElementById('btCtlToggle'); const on=!!(typeof G!=='undefined'&&G&&G.sbCombat);   // 전투실험 화면 오버레이 컨트롤
  if(t){ t.textContent=on?'⏸ 정지':'▶ 전투'; t.classList.toggle('on',on); }
  const c=document.getElementById('btCtlCount'); if(c&&typeof G!=='undefined'&&G&&G.units){ let fo=0,al=0; for(const u of G.units){ if(u.fixed) continue; if(u.maxHp&&(u.hp!=null?u.hp:u.maxHp)<=0) continue; if(u.team==='foe')fo++; else al++; } c.textContent='적 '+fo+' · 아군 '+al; } }
// ── 관리자 전투를 기본 공통 자료(base_stats)로 전환 — 게임 id → [hp, shield, armor, atk, rng(SC타일)]
//    (구 SB_U 수동 밸런스 오버라이드는 base_stats 전환으로 완전히 덮여 제거됨. 네모는 원본 U 그대로) ──
const BASE_UNIT={
  worker_human:[60,0,0,5,1], marine:[40,0,0,6,4], machinegun:[50,0,1,16,2], medic:[60,0,1,0,0], ghost:[45,0,0,10,7], racer:[80,0,0,20,5], tank:[150,0,1,30,7], goliath:[125,0,1,12,5], skyguard:[120,0,0,20,5], pelican:[150,0,1,0,0], hellfire:[200,0,2,48,6], aegis:[200,0,1,0,0], dreadnought:[500,0,3,25,6],
  worker_swarm:[40,0,0,5,1], overlord:[200,0,0,0,0], snapper:[35,0,0,5,1], hydra:[80,0,0,10,4], thornqueen:[125,0,1,20,6], wyvern:[120,0,0,9,3], stinger:[25,0,0,110,1], medusa:[120,0,0,0,0], defiler:[80,0,1,0,0], ultralisk:[400,0,1,20,1], behemoth:[150,0,2,20,8], venom:[250,0,2,25,6], broodling:[30,0,0,6,1],
  worker_light:[20,20,0,5,1], blade:[100,60,1,16,1], dragoon:[100,80,1,20,4], high_templar:[40,40,0,0,0], dark_templar:[80,40,1,40,1], archon:[10,350,0,30,2], dark_archon:[25,200,0,0,2], seraph:[80,60,1,0,0], observer:[40,20,0,0,0], falcon:[150,100,0,8,4], skydancer:[120,80,1,5,5], archangel:[300,150,4,6,8], kronos:[200,150,1,10,5], larva:[100,80,0,100,8] };   // larva=리버(에테리얼 공성, 스캐럽) — 콜로서스 데이터 · dark_archon=다크보이드(임시)
// 일꾼 앵커: 사거리·공속은 base_stats 그대로가 아니라 "현재 일꾼값 = base 1단위" 비율로 통일(전투가 과하게 안 달라지게)
const SB_ANCHOR_RANGE=0.035;   // 일꾼 현재 사거리 0.035 ÷ base 1타일 → 유닛 사거리 = base타일 × 0.035
const SB_ANCHOR_CD=40/15;      // 일꾼 현재 공속 cd40 ÷ base 15프레임 → 유닛 cd = base프레임 × (40/15)
function _baseUnitOv(s, key){ const c=BASE_UNIT[key]; if(!c) return s;   // base_stats 파생 오버라이드(관리자 전투 전용)
  s.hp=c[0]; s.shield=c[1]; s.armor=c[2];
  s.dmg=c[3]; s.up=Math.max(1,Math.round(c[3]*0.4)); s.hdmg=c[3]*2; s.hup=Math.max(1,Math.round(c[3]*0.8));
  s.range=+(c[4]*SB_ANCHOR_RANGE).toFixed(3);
  const bcd=(typeof BASE_CD!=='undefined')?BASE_CD[key]:null; if(bcd&&bcd>0) s.cd=Math.round(bcd*SB_ANCHOR_CD);
  if(s.airDmg!=null&&s.airDmg>0){ s.airDmg=c[3]; s.airUp=Math.max(1,Math.round(c[3]*0.4)); s.hairDmg=c[3]*2; s.hairUp=Math.max(1,Math.round(c[3]*0.8)); }
  return s; }
function Udef(key){ const b=U[key]; if(!b) return b;
  if(typeof G==='undefined'||!G.sandbox||G.strike) return b;   // 네모·직스: 기본 U 그대로(무영향)
  return _baseUnitOv(Object.assign({},b), key); }   // 유효 스탯(관리자=base_stats 전환, 사거리·공속=일꾼앵커 비율)
function Ueff(u){ return Udef(u.gmodel||u.id)||Udef(u.id)||{}; }
function _sbTeam(u){ return (u&&u.team==='foe')?'foe':'ally'; }
// 유닛별 공격 가능 레이어(랩 규칙 반영). 키=gmodel||id
const SB_ATK_MODE={
  stinger:'air', hellfire:'air', venom:'air',   // 공중 전용
  behemoth:'gnd', snapper:'gnd', broodling:'gnd', ultralisk:'gnd', dark_templar:'gnd', blade:'gnd', thornqueen:'gnd', tank:'gnd', machinegun:'gnd', racer:'gnd', worker_human:'gnd', worker_light:'gnd', worker_swarm:'gnd',   // 지상 전용(근접·시즈·러커·가디언·일꾼)
  marine:'both', ghost:'both', goliath:'both', dragoon:'both', archon:'both', hydra:'both', skyguard:'both', wyvern:'both', falcon:'both', skydancer:'both', dreadnought:'both', kronos:'both', archangel:'both',   // 대공+지상
  // 🐺 페럴 — RACES.md §2 '공격 대상' 열 그대로. ⚠ 이 표가 없으면 기본값이 '지상 전용'이라 공중 유닛을 **영영 못 때린다**(오각형이 성립하지 않던 원인).
  worker_feral:'gnd', wolfrunner:'gnd', thornspitter:'gnd', hornedcharger:'gnd', clawfighter:'gnd', stalkercat:'gnd', alphawolf:'gnd', wyvernrider:'gnd',
  howlslinger:'air', skytalon:'air',
  venomfang:'both', stormroc:'both', primalbeast:'both',
  // 🗿 콜로서스 — RACES.md §3
  worker_col:'gnd', gunner:'gnd', twincannon:'gnd', siegecolossus:'gnd',
  flakbattery:'air', arclight:'air',
  guardwalker:'both', railgun:'both', skylance:'both', orbitalanchor:'both', worldbreaker:'both'
};
function _sbAtkMode(u){ const mk=u.gmodel||u.id, id=u.id;
  if((typeof FXLAB_NOATK!=='undefined')&&(FXLAB_NOATK.has(mk)||FXLAB_NOATK.has(id))) return {air:false, gnd:false};   // 비전투(수송·지원·시전형·메두사)
  const m=SB_ATK_MODE[mk]||SB_ATK_MODE[id];
  if(m==='air') return {air:true, gnd:false};
  if(m==='gnd') return {air:false, gnd:true};
  if(m==='both') return {air:true, gnd:true};
  return {air:(typeof FXLAB_AA!=='undefined'&&FXLAB_AA.has(id)), gnd:true};   // 기본: 지상 + (대공 베이스면 공중)
}
function _sbStingerKamikaze(u, tgt, dt, units, myTeam, MM){   // 스팅어(자폭충): 실제 이동속도로 돌진 → 접촉 시 자폭(중심 최대~외곽 최소) → 소멸
  const dx=tgt.x-u.x, dy=tgt.y-u.y, d=Math.hypot(dx,dy)||1e-4; u.face=Math.atan2(dx,dy);
  const _rs=((U[u.gmodel||u.id]||U[u.id]||{}).size||16), _rt=((U[tgt.gmodel||tgt.id]||U[tgt.id]||{}).size||16), hit=Math.max(0.03,(_rs+_rt)*0.62/(GW||390));   // 접촉(양 유닛 충돌반경 합) 시 즉시 자폭
  if(d>hit){ u.moving=true;
    const def=U[u.gmodel||u.id]||U[u.id]||{}, spd=(def.moveSpd||0.3)*(MM||3)*dt;
    const cl=(typeof clampInner==='function')?clampInner(u.x+(dx/d)*spd, u.y+(dy/d)*spd):{x:u.x+(dx/d)*spd,y:u.y+(dy/d)*spd};
    u.x=cl.x; u.y=cl.y;
    if(!G._balSim && G.btFx&&G.btFx.smoke){ u._sgTr=(u._sgTr||0)-dt; if(u._sgTr<=0){ u._sgTr=0.03; const cc=(window.M3D&&M3D.centerAt)?M3D.centerAt(u.uid):null;
      G.btFx.smoke.push({x:(cc?cc.x:u.x)-(dx/d)*0.012, y:(cc?cc.y:u.y)-(dy/d)*0.012, vx:(Math.random()-0.5)*0.01, vy:(Math.random()-0.5)*0.01, life:1, r0:0.7, col:'#8fbf5a', ex:2.2, af:0.4, dk:3.4}); } }   // 산성 궤적
  } else {   // 자폭
    const cc=(window.M3D&&M3D.centerAt)?M3D.centerAt(u.uid):null, bx=cc?cc.x:u.x, by=cc?cc.y:u.y;
    u._fxL=u._fxL||{}; u._fxL.store=G.btFx; if(!G._balSim && typeof fxLabStingerBlast==='function') fxLabStingerBlast(u._fxL, u, bx, by);   // 랩 자폭 연출 재사용
    const R=0.06, base=_sbUnitDps(u)*1.4;
    for(const o of units){ if(o===u||o.fixed||_sbTeam(o)===myTeam||(o.maxHp&&(o.hp!=null?o.hp:o.maxHp)<=0)) continue;
      const od=Math.hypot(o.x-u.x,o.y-u.y); if(od<=R){ let dm=base*(1-0.6*od/R); if(o.sh>0){ if(dm<=o.sh){o.sh-=dm;dm=0;} else {dm-=o.sh;o.sh=0;} } if(dm>0) o.hp=(o.hp!=null?o.hp:o.maxHp)-dm; o.flash=0.12; } }   // 광역 데미지(중심 최대→외곽 최소)
    if(!G._balSim && typeof playUnitAttack==='function') playUnitAttack('stinger');
    if(!G._balSim && window.M3D&&M3D.dropModels){ try{ M3D.dropModels([u.uid]); }catch(_e){} }
    u.hp=0; u._sbExploded=true;   // 자폭=사망(중복 death boom 억제)
  }
}
// ══ 상성 엔진: 데미지 타입 × 유닛 크기(스타크래프트식) ══════════════════
// 타입: normal(전부100%) · concussive(진동: 소100·중50·대25) · explosive(폭발: 대100·중75·소50)
// 크기: s(소형)·m(중형)·l(대형). ⚠ 프로토스식 쉴드는 크기 무관 100%(공식은 _sbEffAtk에서 sh>0 처리)
// 상성표: 증폭까지 포함(좋은 상성=보너스, 나쁜 상성=페널티, 중형=중립) → 상성이 승패를 좌우.
//   진동(對人): 소형 +50% / 대형 반감    ·    폭발(對大): 대형 +50% / 소형 반감    ·    일반: 상성 없음
const TYPE_VS_SIZE={ normal:{s:1,m:1,l:1}, concussive:{s:1.5,m:1,l:0.5}, explosive:{s:0.5,m:1,l:1.5} };
// 유닛 전투 분류(model3d/기본 id 기준) — dt=공격 데미지타입, sz=피격 크기. 밸런싱 단일 소스.
const UNIT_COMBAT_CLASS={
  // 유니온 — 만능 툴박스(진동 대인 + 폭발 대형 혼합)
  marine:{dt:'normal',sz:'s'}, ghost:{dt:'concussive',sz:'s'}, machinegun:{dt:'concussive',sz:'s'},
  racer:{dt:'concussive',sz:'m'}, goliath:{dt:'explosive',sz:'l'}, tank:{dt:'explosive',sz:'l'},
  skyguard:{dt:'normal',sz:'l'}, hellfire:{dt:'explosive',sz:'l'}, dreadnought:{dt:'explosive',sz:'l'},
  // 스웜 — 다수 물량(일반 다수) + 폭발 산성 소수
  snapper:{dt:'normal',sz:'s'}, hydra:{dt:'concussive',sz:'m'}, thornqueen:{dt:'explosive',sz:'m'},
  matron:{dt:'normal',sz:'l'}, venom:{dt:'explosive',sz:'m'}, stinger:{dt:'explosive',sz:'s'},
  medusa:{dt:'normal',sz:'m'}, broodling:{dt:'normal',sz:'s'}, ultralisk:{dt:'normal',sz:'l'},
  wyvern:{dt:'explosive',sz:'l'}, behemoth:{dt:'explosive',sz:'l'},   // (로스터 외 프리미엄/모프 — 분류 유지)
  // 에테리얼 — 대형 폭발 브루저 + 진동 암살
  blade:{dt:'normal',sz:'s'}, dragoon:{dt:'explosive',sz:'l'}, archon:{dt:'normal',sz:'l'},
  falcon:{dt:'explosive',sz:'m'}, skydancer:{dt:'concussive',sz:'m'}, kronos:{dt:'explosive',sz:'l'},
  archangel:{dt:'explosive',sz:'l'}, dark_templar:{dt:'concussive',sz:'s'}, larva:{dt:'normal',sz:'l'},
  // 🐺 페럴 — "큰 사냥감을 찢는다": 주력 근접이 **폭발형**(대형 특효·소형 반감) + 몸은 **소형**.
  //   이 두 줄이 오각형의 페럴 변 세 개를 만든다 — 대형 소수(에테리얼·콜로서스)에 강하고, 소형 물량(스웜)·대인 사격(유니온)에 약하다.
  worker_feral:{dt:'normal',sz:'s'}, wolfrunner:{dt:'explosive',sz:'s'}, thornspitter:{dt:'normal',sz:'s'},
  clawfighter:{dt:'explosive',sz:'s'}, hornedcharger:{dt:'explosive',sz:'m'}, howlslinger:{dt:'concussive',sz:'s'},
  venomfang:{dt:'normal',sz:'m'}, stalkercat:{dt:'normal',sz:'s'}, alphawolf:{dt:'normal',sz:'m'},
  wyvernrider:{dt:'normal',sz:'m'}, skytalon:{dt:'normal',sz:'m'}, stormroc:{dt:'explosive',sz:'l'},
  primalbeast:{dt:'explosive',sz:'l'}, packshaman:{dt:'normal',sz:'s'}, hawkeye:{dt:'normal',sz:'s'}, windcarrier:{dt:'normal',sz:'l'},
  // 🗿 콜로서스 — 폭발형 포열 + 큰 몸. 대형에 강하고 소형(스웜·페럴)에 반감되는 것이 이 종족의 값이다.
  worker_col:{dt:'normal',sz:'s'}, gunner:{dt:'explosive',sz:'m'}, guardwalker:{dt:'normal',sz:'m'},
  twincannon:{dt:'explosive',sz:'m'}, flakbattery:{dt:'concussive',sz:'m'}, railgun:{dt:'explosive',sz:'l'},
  arclight:{dt:'concussive',sz:'m'}, siegecolossus:{dt:'explosive',sz:'l'}, skylance:{dt:'explosive',sz:'l'},
  orbitalanchor:{dt:'explosive',sz:'l'}, worldbreaker:{dt:'explosive',sz:'l'},
  spotterdrone:{dt:'normal',sz:'s'}, stasistech:{dt:'normal',sz:'s'}, supplylifter:{dt:'normal',sz:'l'} };
function _uClass(u){ return u&&(UNIT_COMBAT_CLASS[u.id]||UNIT_COMBAT_CLASS[u.gmodel]); }
function _sbTypeMul(atk, tgt){ const A=_uClass(atk); if(!A||A.dt==='normal') return 1;   // 무분류·일반형=100%
  const B=_uClass(tgt); const sz=(B&&B.sz)||'m'; const row=TYPE_VS_SIZE[A.dt];   // 대상 크기(미분류=중형 취급)
  return (row&&row[sz]!=null)?row[sz]:1; }
function _sbTypeMulSize(atk, sz){ const A=_uClass(atk); if(!A||A.dt==='normal') return 1; const row=TYPE_VS_SIZE[A.dt]; return (row&&row[sz]!=null)?row[sz]:1; }   // 크기 지정 상성 배수(건물=대형 'l' 판정 등)
function stepSbCombat(dt){ if(typeof G==='undefined'||!G.sandbox||G.tab!=='Battle'||!G.sbCombat||!G.units||!G.units.length) return;   // ⚔ 양방향 실전 전투(적팀=team:'foe')
  const units=G.units; if(!G.btFx) G.btFx=FX.store(); if(!G.btPend) G.btPend=[]; const _dmgAcc={};   // 동시 데미지(처리순서 편향 제거)
  const _alive=u=>!(u.maxHp&&(u.hp!=null?u.hp:u.maxHp)<=0), _MM=(typeof MOVE_MUL!=='undefined'?MOVE_MUL:1);
  for(const u of units){
    u._sbEngage=false;
    if(u.fixed||!_alive(u)||isTransport(u)) continue;   // 수송선=전투 안 함
    if(u.slowT>0) u.slowT=Math.max(0,u.slowT-dt); if(u.empT>0) u.empT=Math.max(0,u.empT-dt); if(u.stunT>0){ u.stunT=Math.max(0,u.stunT-dt); u.moving=false; continue; }   // 상태이상: 둔화·EMP 감쇠 / 락다운=정지(공격·이동 없음)
    const myTeam=_sbTeam(u);
    const _mode=_sbAtkMode(u); if(!_mode.air && !_mode.gnd) continue;   // 공격 불가(메두사·수송선·시전형 등)
    let tgt=null, td=1e9;
    for(const o of units){ if(o===u||o.fixed||!_alive(o)||_sbTeam(o)===myTeam) continue;
      const _oAir=(typeof FXLAB_AIR!=='undefined'&&FXLAB_AIR.has(o.gmodel||o.id));
      if(_oAir? !_mode.air : !_mode.gnd) continue;   // 공중전용/지상전용: 공격 가능한 레이어의 대상만
      if(isCloaked(o) && !(myTeam==='ally'? o._detAlly : o._detFoe)) continue;   // 🫥 은신: 우리 팀 탐지기 없으면 조준 불가
      const dx=o.x-u.x, dy=o.y-u.y, d=dx*dx+dy*dy; if(d<td){ td=d; tgt=o; } }   // 상대팀 최근접(공격 가능 대상)
    if(!tgt) continue;
    if((u.gmodel||u.id)==='stinger'){ u._sbEngage=true; _sbStingerKamikaze(u, tgt, dt, units, myTeam, _MM); continue; }   // 스팅어: 돌진 후 자폭
    const rng=_sbUnitRange(u); if(rng<=0) continue;   // 무공격 유닛=교전 안 함(자유 분리)
    const dist=Math.sqrt(td); u._sbEngage=true; if(u._btCd>0) u._btCd-=dt;
    if(dist<=rng){   // 사거리 내 → 정지·조준
      u.face=Math.atan2(tgt.x-u.x, tgt.y-u.y); u.moving=false;
      // ── 데미지: 부드러운 DPS(매 프레임) — 밸런스용(이산 발사 타이밍 영향 제거) ──
      const _ad=Ueff(u), _atk=(_ad.dmg||1)+_upgAtk(u), _rate=60/Math.max(0.2,(_ad.cd||22));   // 유효 공격력 + 무기티어 · 초당공격횟수
      // 대상별 실효 DPS = max(0.5, (공격력 × 타입상성) − 방어력) × 공속. 쉴드 있으면 상성 무시(100%)·shArmor 사용
      const _eff=(o)=>{ const _od=Ueff(o), _oarm=((o.sh>0)?(_od.shArmor||0):(_od.armor||0))+_upgDef(o), _mul=(o.sh>0)?1:_sbTypeMul(u,o);
        return Math.max(0.5, _atk - _oarm)*_mul*_rate; };   // 스타식: (공격−방어) 먼저, 상성은 그 뒤에 곱함
      if(_ad.splash){ const _SR=0.05; for(const o of units){ if(o.fixed||_sbTeam(o)===myTeam||!_alive(o)) continue; const _sx=o.x-tgt.x,_sy=o.y-tgt.y; if(_sx*_sx+_sy*_sy<=_SR*_SR){ _dmgAcc[o.uid]=(_dmgAcc[o.uid]||0)+_eff(o)*dt; o.flash=0.12; } } }   // 스플래시(광역): 주변 적 각자 크기 상성으로 동시 타격
      else { _dmgAcc[tgt.uid]=(_dmgAcc[tgt.uid]||0)+_eff(tgt)*dt; tgt.flash=0.12; }   // 단일 대상
      // ── 시각 발사 케이던스 = base_stats 공속(실제 DPS와 동일 리듬) ──
      if(!G._balSim && !(u._btCd>0)){ const cd=(typeof fxLabStats==='function')?Math.max(0.42,fxLabStats(u.id,u.gmodel).cd):0.6; u._btCd=cd; u.fireSeq=(u.fireSeq||0)+1;
        if(typeof playUnitAttack==='function') playUnitAttack(u.gmodel||u.id);
        const sz=_fxUnitSize(u.gmodel||u.id), _os=FXLAB.scale; FXLAB.scale=BT_FX_ZOOM;   // 이펙트 크기 = 실제 모델 크기(SCALE) 기준
        const tgtAir=(typeof FXLAB_AIR!=='undefined'&&FXLAB_AIR.has(tgt.gmodel||tgt.id));
        u._fxL=u._fxL||{}; u._fxL.store=G.btFx; u._fxL.pend=G.btPend; unitFireFx(u._fxL, u, tgt.x, tgt.y, sz, tgtAir); FXLAB.scale=_os; }   // 만들어 둔 발사 이펙트 그대로
    } else if(!u.moveTo){   // 사거리 밖 → 접근(직접 이동 · 수동 이동명령 있으면 양보)
      const def=U[u.id]||{}, dx=tgt.x-u.x, dy=tgt.y-u.y, d=dist||1e-4, _sl=(u.slowT>0)?0.45:1, spd=(def.moveSpd||0.13)*_MM*dt*_sl;   // 둔화 시 감속
      const cl=(typeof clampInner==='function')?clampInner(u.x+(dx/d)*spd, u.y+(dy/d)*spd):{x:u.x+(dx/d)*spd,y:u.y+(dy/d)*spd};
      u.x=cl.x; u.y=cl.y; u.moving=true; u.face=Math.atan2(dx,dy);
    }
  }
  for(const u of units){ const d=_dmgAcc[u.uid]; if(!d) continue; let dmg=d;   // 동시 데미지 적용(실드 우선)
    if(u.sh>0){ if(dmg<=u.sh){ u.sh-=dmg; dmg=0; } else { dmg-=u.sh; u.sh=0; } } if(dmg>0) u.hp=(u.hp!=null?u.hp:u.maxHp)-dmg; }
  _sbReapDead(); }
function _sbReapDead(){ if(!(typeof G!=='undefined'&&G.sandbox&&G.tab==='Battle'&&G.units)) return;   // 사망 유닛 정리(양팀) — 전투 OFF 중 스킬 사망 포함
  const units=G.units;
  for(let i=units.length-1;i>=0;i--){ const u=units[i]; if(u.fixed) continue; if(u.maxHp&&(u.hp!=null?u.hp:u.maxHp)<=0){
    if(!G._balSim){ G.skillFx=G.skillFx||[]; if(!u._sbExploded) G.skillFx.push({type:'boom', x:u.x, y:u.y, t:0, dur:0.35, r:0.03});
      if(window.M3D&&M3D.dropModels) M3D.dropModels([u.uid]); }
    G.sel=(G.sel||[]).filter(id=>id!==u.uid); units.splice(i,1); } } }
// ══ ⚖ 밸런스 자동검증 — 실제 전투코드(stepSbCombat)를 헤드리스로 대량 대결 → 동수 승패표 ══
const _BAL_RCOL={union:'#5aa8ff',swarm:'#9fd356',aetherial:'#ffc040',feral:'#c98b5a',colossus:'#9aa6b2'}, _BAL_RKO={union:'유니온',swarm:'스웜',aetherial:'에테리얼',feral:'페럴',colossus:'콜로서스'};
function _balCombatUnits(){ const out=[]; if(typeof SANDBOX_ROSTER==='undefined') return out;
  for(const race in SANDBOX_ROSTER){ for(const it of SANDBOX_ROSTER[race]){ const key=(it.gm&&U[it.gm])?it.gm:it.b; const d=(typeof Udef==='function'?Udef(key):U[key])||{};
    if((typeof FXLAB_NOATK!=='undefined')&&(FXLAB_NOATK.has(it.gm)||FXLAB_NOATK.has(it.b))) continue;   // 지원·수송·무공격 제외
    if(/worker_/.test(key)||(d.dmg||0)<=0) continue;   // 일꾼·무공격 제외
    out.push({key, base:it.b, gm:it.gm, name:it.n, race}); } }
  return out; }
function _balCost(key){ return (typeof STK_UNITS!=='undefined' && STK_UNITS[key] && STK_UNITS[key].cost)? STK_UNITS[key].cost : 150; }   // 유닛 비용(직스 기준 — 유일한 비용 정의처)
function _balCount(item, mode, budget, N){ if(mode==='cost') return Math.max(1, Math.min(20, Math.round(budget/_balCost(item.key)))); return N; }   // 동일비용=budget/비용 · 동수=N
function _balArmy(item, team, N, x0){ const arr=[]; if(G.idSeq==null)G.idSeq=1; const sid=(item.gm&&U[item.gm])?item.gm:item.base;
  for(let i=0;i<N;i++){ const col=(i/8)|0, row=i%8;   // 8기 단위 열 배치(대규모 물량 대응)
    const x=(team==='ally')?Math.max(0.05,0.22-col*0.05):Math.min(0.95,0.78+col*0.05), y=0.12+row*0.085;
    const u=initUnitStats({uid:G.idSeq++, id:sid, hero:false, lv:1, x:x, y:y, cd:0, fixed:false});
    if(item.gm) u.gmodel=item.gm; u.gname=item.name; u.team=team; u._btCd=0; u._detAlly=true; u._detFoe=true; u.moveTo=null; u.slowT=0; u.stunT=0; u.empT=0;   // 은신 무력화(순수 전투력 측정)
    arr.push(u); } return arr; }
function _balDuel(A, B, opts){ const na=_balCount(A,opts.mode,opts.budget,opts.N), nb=_balCount(B,opts.mode,opts.budget,opts.N);
  const ally=_balArmy(A,'ally',na,0.2), foe=_balArmy(B,'foe',nb,0.8); G.units=ally.concat(foe);
  const dt=0.1; let t=0;
  while(t<20){ t+=dt; stepSbCombat(dt); let a=0,f=0; for(const u of G.units){ if(u.maxHp&&(u.hp!=null?u.hp:u.maxHp)<=0) continue; if(u.team==='foe')f++; else a++; } if(a===0||f===0) break; }
  let a=0,f=0; for(const u of G.units){ if(u.maxHp&&(u.hp!=null?u.hp:u.maxHp)<=0) continue; if(u.team==='foe')f++; else a++; }
  return a>f?1:(f>a?-1:0); }
function runBalanceSim(mode){ if(typeof G==='undefined'||G._balSimRunning) return; mode=(mode==='count')?'count':'cost';   // 기본=동일비용
  const units=_balCombatUnits(); if(units.length<2){ if(typeof toast==='function') toast('전투 유닛이 부족합니다'); return; }
  const opts={mode, budget:1000, N:5}, sv={units:G.units, tab:G.tab, comb:G.sbCombat, bal:G._balSim, sel:(G.sel||[]).slice(), idSeq:G.idSeq};
  G._balSim=true; G._balSimRunning=true; G.tab='Battle'; G.sbCombat=true; G.sel=[];
  const rec={}; units.forEach(u=>rec[u.key]={name:u.name,race:u.race,w:0,d:0,l:0});
  const pairs=[]; for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++) pairs.push([i,j]);
  let pi=0; _balOpenPanel(); _balShowProgress(0, pairs.length);
  function _balRestore(){ G.units=sv.units; G.tab=sv.tab; G.sbCombat=sv.comb; G._balSim=sv.bal; G.sel=sv.sel; G._balSimRunning=false; if(window.M3D&&M3D.clearGameModels) M3D.clearGameModels(); }   // 원상복구(정상·에러 공통)
  function chunk(){ try{ const t0=Date.now();
      while(pi<pairs.length && Date.now()-t0<45){ const pr=pairs[pi++]; const r=_balDuel(units[pr[0]],units[pr[1]],opts); const a=units[pr[0]].key,b=units[pr[1]].key;
        if(r>0){rec[a].w++;rec[b].l++;} else if(r<0){rec[a].l++;rec[b].w++;} else {rec[a].d++;rec[b].d++;} }
      _balShowProgress(pi, pairs.length);
      if(pi<pairs.length){ setTimeout(chunk,0); return; }
      _balRestore(); _balRenderResults(rec, units, opts);
    }catch(err){ _balRestore(); const b=document.getElementById('balBody'); if(b) b.innerHTML='<div style="padding:22px;color:#ff9a9a">검증 오류: '+((err&&err.message)||err)+'</div>'; } }
  setTimeout(chunk,0); }
function _balOpenPanel(){ const p=document.getElementById('balPanel'); if(p) p.classList.remove('hide'); }
function closeBalPanel(){ const p=document.getElementById('balPanel'); if(p) p.classList.add('hide'); }
function _balShowProgress(done,total){ const b=document.getElementById('balBody'), s=document.getElementById('balSub'); if(!b) return;
  const pct=total?Math.round(done/total*100):0; if(s) s.textContent='검증 중 '+done+'/'+total;
  b.innerHTML='<div style="padding:26px 4px;text-align:center;color:#bcd">실제 전투코드로 동수 대결 시뮬 중…<div style="margin-top:12px;height:12px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#5aa8ff,#9fd356);transition:width .1s"></div></div><div style="margin-top:8px;font:700 13px var(--font-num)">'+pct+'%</div></div>'; }
function _balModeBtns(mode){ function bt(m,lb){ const on=(mode===m); return '<button onclick="runBalanceSim(\''+m+'\')" style="flex:1;padding:7px 4px;border-radius:7px;cursor:pointer;font-weight:800;font-size:11px;border:1px solid '+(on?'#5aa8ff':'var(--metal-edge)')+';'+(on?'background:linear-gradient(180deg,#2a6cbb,#163a6e);color:#fff':'background:rgba(255,255,255,.05);color:#9aabbc')+'">'+lb+'</button>'; }
  return '<div style="display:flex;gap:6px;margin-bottom:8px">'+bt('cost','💰 동일비용 1000')+bt('count','⚔ 동수 5v5')+'</div>'; }
function _balRenderResults(rec, units, opts){ const b=document.getElementById('balBody'), s=document.getElementById('balSub'); if(!b) return; const mode=opts.mode;
  const rows=units.map(u=>({...u, ...rec[u.key], score:rec[u.key].w-rec[u.key].l})).sort((x,y)=>y.score-x.score);
  const maxAbs=Math.max(1,...rows.map(r=>Math.abs(r.score)));
  const races={}; for(const race in _BAL_RKO){ const us=rows.filter(r=>r.race===race); if(us.length) races[race]=us.reduce((a,r)=>a+r.score,0)/us.length; }
  if(s) s.textContent=units.length+'종 · '+(units.length*(units.length-1)/2)+'대결';
  let html=_balModeBtns(mode)+'<div class="balRaceRow">';
  for(const race in races){ html+='<div class="rc" style="border-color:'+_BAL_RCOL[race]+'55"><span style="font-size:11px;color:'+_BAL_RCOL[race]+'">'+_BAL_RKO[race]+'</span><b style="color:'+_BAL_RCOL[race]+'">'+(races[race]>0?'+':'')+races[race].toFixed(1)+'</b><span style="font-size:9px;color:#8899aa">평균점수</span></div>'; }
  html+='</div><div style="font-size:10px;color:#8899aa;margin:2px 0 8px">'+(mode==='cost'?'💰 <b>동일비용 1000크레딧</b>씩 뽑아 대결 (×N=구매 수량 · 직스 비용 기준)':'⚔ <b>동수 5v5</b> — 한 마리 순수 전투력')+' · 초록=강세 빨강=약세</div>';
  for(const r of rows){ const w=Math.abs(r.score)/maxAbs*50, col=r.score>=0?'#5ad18a':'#e07070', side=r.score>=0?'left:50%':'right:50%';
    const tag=(mode==='cost')?('<span style="color:#8899aa;font-size:9px;font-weight:600">×'+_balCount(r,'cost',opts.budget,opts.N)+'</span>'):'';
    html+='<div class="balRow"><span class="bn" style="color:'+_BAL_RCOL[r.race]+'">'+r.name+' '+tag+'</span>'
      +'<span class="bbar"><span style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.25)"></span><i style="'+side+';width:'+w+'%;background:'+col+'"></i></span>'
      +'<span class="bsc" style="color:'+col+'">'+(r.score>0?'+':'')+r.score+' <span style="color:#7a8;font-size:9px">'+r.w+'/'+r.l+'</span></span></div>'; }
  b.innerHTML=html; }
// 개인 보스 해금 감지(등급 4종 전체 보유 → 잠금 해제): 채팅 알람 + 버튼 알림 점등
function checkPbossUnlocks(){
  if(G.phase!=='playing') return;
  if(!G._pbWasUnlocked) G._pbWasUnlocked={};
  for(const pt of PBOSS_TYPES){ const u=pbossUnlocked(pt);
    if(u && !G._pbWasUnlocked[pt.id]){   // 잠금 → 해금 전환
      addChat('', '🔓 개인보스 '+pt.name+' 해금!', pt.col||'#ffd24a', true);   // 짧게(채팅 짤림 방지)
      if(typeof playSfx==='function') playSfx('hero_merge'); }
    G._pbWasUnlocked[pt.id]=u; }
}
// 개인 보스 진입 UI(하단 보스 탭): 표시/배지 실시간 갱신. (구 우하단 FAB·팝업은 보스 시트로 흡수되어 제거됨)
function updatePbossFab(){
  if(!G.pbossCds) G.pbossCds={};
  const tab=document.getElementById('bossTab'); if(!tab) return;
  const show=(typeof G!=='undefined' && !G.sandbox && G.phase==='playing');   // 관리자 샌드박스에선 보스 탭 숨김(네모네모 전용)
  const disp=show?'':'none'; if(tab.style.display!==disp) tab.style.display=disp;
  if(!show) return;
  // 탭 우상단 배지 = 지금 소환 가능한(해금·쿨0·미활동) 보스 수. 소환하면 줄고, 0이면 숨김.
  let readyCount=0;
  for(const pt of PBOSS_TYPES){ const cdL=G.pbossCds[pt.id]||0;
    const active=G.enemies.some(e=>e.pboss&&e.pbId===pt.id);
    if(pbossUnlocked(pt) && cdL<=0 && !active) readyCount++; }
  const anyReady=readyCount>0;
  const cnt=document.getElementById('bossTabDot');
  if(cnt){ const t=anyReady?String(readyCount):''; if(cnt.textContent!==t) cnt.textContent=t; cnt.classList.toggle('show', anyReady); } }
function togglePbossAuto(ev, id){ if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  if(!autoUsable('pboss')){ toast('🔒 자동 개인 보스 업그레이드 필요'); return; }
  if(!G.auto) G.auto={unit:false,combine:false,energy:false,pboss:{}}; if(!G.auto.pboss) G.auto.pboss={};
  G.auto.pboss[id]=!G.auto.pboss[id];
  const pt=PBOSS_TYPES.find(t=>t.id===id);
  toast('⟳ '+(pt?pt.name:'')+' 자동 소환 '+(G.auto.pboss[id]?'ON':'OFF'));
  if(typeof playSfx==='function') playSfx('ui_open');
  if(typeof saveAutoCfg==='function') saveAutoCfg(); }
// ── 메인 자동화 묶음 버튼/팝업(자동 조합·유닛·에너지) ──
function autoUtilOwned(){ return {combine:autoUsable('combine'), unit:autoUsable('unit'), energy:autoUsable('energy'), place:autoUsable('place'), bossdeploy:autoUsable('bossdeploy')}; }
function autoSig(){ const o=autoUtilOwned(); const a=G.auto||{}; return ''+(a.combine?1:0)+(a.unit?1:0)+(a.energy?1:0)+(a.place?1:0)+(a.bossdeploy?1:0)+(o.combine?1:0)+(o.unit?1:0)+(o.energy?1:0)+(o.place?1:0)+(o.bossdeploy?1:0)+(G.rallyShow!==false?1:0); }
// 자동화는 전송 옆 배너(#autoFab)에서 메인 구역의 하위 칸으로 옮겼다(2026-08-14).
// 매 프레임 도는 자리라 해금 여부가 '바뀐 순간'에만 네비를 다시 그린다 — 아니면 DOM을 매 프레임 갈아엎는다.
let _autoOwnedSig=null;
function updateAutoFab(){ if(!G.auto) G.auto={unit:false,combine:false,energy:false,pboss:{}};
  const own=autoAnyOwned(); if(own===_autoOwnedSig) return;
  _autoOwnedSig=own;
  if(typeof gtabPaint==='function' && _gtabDrill==='Main') gtabPaint(); }
function toggleAuto(kind){ const o=autoUtilOwned(); if(!o[kind]){ toast('🔒 업그레이드 필요'); return; }
  if(!G.auto) G.auto={unit:false,combine:false,energy:false,pboss:{}};
  G.auto[kind]=!G.auto[kind];
  // 자동 유닛 소환 ↔ 자동 에너지 변환 = 상호 배타(둘은 같은 크레딧을 두고 경쟁 → 동시 ON 금지)
  if(G.auto[kind] && (kind==='unit'||kind==='energy')){ const other=(kind==='unit')?'energy':'unit'; if(G.auto[other]){ G.auto[other]=false; toast('⟳ '+(other==='unit'?'자동 유닛 소환':'자동 에너지 변환')+' OFF (동시 사용 불가)'); } }
  toast('⟳ '+({combine:'자동 조합',unit:'자동 유닛 소환',energy:'자동 에너지 변환',place:'자동 유닛 배치',bossdeploy:'자동 보스 파견'}[kind])+' '+(G.auto[kind]?'ON':'OFF'));
  if(typeof playSfx==='function') playSfx('ui_open');
  if(typeof saveAutoCfg==='function') saveAutoCfg();
  if(G.mainSheet==='auto' && typeof renderAutoSheet==='function') renderAutoSheet(); }   // 열린 자동화 시트 즉시 갱신
function toggleRallyShow(ev){ if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  G.rallyShow=(G.rallyShow===false);   // 토글(기본 표시)
  toast('ℹ️ 구역 표시 '+(G.rallyShow?'ON':'OFF'));
  if(typeof renderRallyArrows==='function') renderRallyArrows();
  if(typeof saveAutoCfg==='function') saveAutoCfg();
  if(G.mainSheet==='auto' && typeof renderAutoSheet==='function') renderAutoSheet(); }   // 열린 자동화 시트 즉시 갱신
function updateSkillFab(){ const fab=document.getElementById('skillFab'); if(!fab) return;
  if(typeof G==='undefined'||G.tab!=='Main'||G.selEnemy!=null){ fab.classList.add('hide'); return; }
  const us=selUnits().filter(u=>U[u.id]&&U[u.id].skill);
  if(!us.length){ fab.classList.add('hide'); return; }
  fab.classList.remove('hide'); const sk=U[us[0].id].skill;
  const ico=document.getElementById('sfIco'); if(ico.dataset.k!==sk.key){ ico.innerHTML=SKILL_ICON[sk.key]||''; ico.dataset.k=sk.key; }
  document.getElementById('sfName').textContent=sk.name;
  const cd=Math.min.apply(null, us.map(u=>u.skCd||0)), active=us.some(u=>(u.adr||0)>0);
  fab.classList.toggle('active',active);
  document.getElementById('sfCd').textContent = cd>0?Math.ceil(cd):'';
  document.getElementById('sfOver').style.height = cd>0?Math.min(100,(cd/sk.cd)*100)+'%':'0'; }
function updateCmdRow(){ const row=document.getElementById('cmdRow'); if(!row) return;
  const us=selUnits();   // 선택된 비고정 유닛 전체(단일/다중 공통)
  if(G.selEnemy!=null || us.length===0){ row.style.display='none'; return; }
  row.style.display='flex';
  // 모드 하이라이트: 선택 유닛이 모두 같은 모드일 때만 켬
  const patOn=us.every(u=>!!u.patrol);
  const focusOn=!patOn&&us.every(u=>u.cmd==='focus');
  const atkOn=!patOn&&!focusOn&&us.every(u=>u.cmd==='attack');
  const holdOn=us.every(u=>!u.patrol&&u.cmd!=='attack'&&u.cmd!=='focus');
  document.getElementById('cmdHold').classList.toggle('on',holdOn);
  document.getElementById('cmdAtk').classList.toggle('on',atkOn);
  const foc=document.getElementById('cmdFocus'); if(foc){ foc.classList.toggle('on',focusOn); foc.classList.toggle('arm',!!G.focusArm); }
  const pat=document.getElementById('cmdPat'); pat.classList.toggle('on',patOn); pat.classList.toggle('arm',!!G.patrolArm);
  // 전체선택: 단일 종류(같은 id+영웅+레벨)이고 건물 아닐 때만
  const types=new Set(us.map(u=>u.id+'|'+(u.hero?1:0)+'|'+(u.lv||1)));
  const all=document.getElementById('scAllBtn'); if(all) all.style.display=(types.size===1 && !isBuilding(us[0].id))?'flex':'none';
}
function selectOne(uid){ _selViaTab=false; G.sel=[uid]; G.selEnemy=null; refreshSelCard(); }
const MAX_SEL_TYPES=8;   // 다중 선택은 최대 8종류(초상화 4칸×2줄)
const MAX_PER_TYPE=30;   // 종류당 최대 30마리 (4종류 × 30 = 최대 120마리)
function isBuilding(id){ return !!(U[id] && U[id].moveSpd===0); }   // 건물(미사일 포탑·스파이어)=이동속도0 → 드래그 다중선택 제외(개별선택만)
// 선택 유닛을 종류(id+영웅+레벨)별로 묶어 최대 4종류 + 종류당 30마리로 제한. 건물 제외.
// 종류 우선순위: 유닛 수 많은 순 → 같으면 더 비싼(cost↑) 순. (5종류면 가장 적은 종류 탈락)
function capSelTypes(uids, noPerCap){   // noPerCap=true → 종류당 30 제한 해제(지정 패널 '전부 선택'용. 드래그 박스는 30 유지)
  const groups={}, order=[];
  uids.forEach(uid=>{ const u=G.units.find(x=>x.uid===uid); if(!u||u.fixed||(!u.gid&&isBuilding(u.id))) return;   // 실제 구조물만 제외(구조물 프록시 가챠 유닛은 일반 유닛)
    const key=(u.gid||u.gmodel||u.id)+'|'+(u.hero?1:0)+'|'+(u.lv||1);   // 선택 칩 분류와 동일 키(등급 다르면 다른 종류)
    if(!groups[key]){ groups[key]={uids:[], cost:(U[u.id]?U[u.id].cost:0),
      tr:(u.gtier&&typeof GACHA_TIER_ORDER!=='undefined')?GACHA_TIER_ORDER.indexOf(u.gtier):-1}; order.push(key); }   // tr=등급 순위(높을수록 상위)
    groups[key].uids.push(uid);
  });
  let keep=order, msg='';
  if(order.length>MAX_SEL_TYPES){
    keep=order.slice().sort((a,b)=> groups[b].uids.length-groups[a].uids.length || groups[b].tr-groups[a].tr || groups[b].cost-groups[a].cost)   // ①마릿수 ②등급 ③가격
              .slice(0,MAX_SEL_TYPES);
    msg=MAX_SEL_TYPES+'종류까지만 선택됩니다';
  }
  const keepSet=new Set(keep); let out=[];
  order.forEach(k=>{ if(!keepSet.has(k)) return;
    let arr=groups[k].uids;
    if(!noPerCap && arr.length>MAX_PER_TYPE){ arr=arr.slice(0,MAX_PER_TYPE); msg='한 종류당 최대 '+MAX_PER_TYPE+'마리'; }  // 종류당 30 제한(드래그)
    out.push(...arr);
  });
  if(msg) toast(msg);
  return out;
}
// 현재 선택된 종류의 유닛 전체 선택(맵 전체) — '전체 선택' 버튼(단일종류 뷰 + 1마리 카드)
function selectAllOfType(){ if(G.sel.length===0) return;
  const u0=G.units.find(x=>x.uid===G.sel[0]); if(!u0||isBuilding(u0.id)) return;
  const key=(u0.gid||u0.gmodel||u0.id)+'|'+(u0.hero?1:0)+'|'+(u0.lv||1);
  const all=G.units.filter(u=>!isBuilding(u.id) && ((u.gid||u.gmodel||u.id)+'|'+(u.hero?1:0)+'|'+(u.lv||1))===key).map(u=>u.uid);
  _selViaTab=false; G.sel=capSelTypes(all,true); G.selEnemy=null; refreshSelCard();   // '전체 선택' → 30 제한 없이 전부
}
function selectMany(uids){ _selViaTab=false; G.sel=capSelTypes(uids,true); G.selEnemy=null; refreshSelCard(); }   // 드래그=종류당 전부 선택(HP바 표시만 30 제한)
function selectEnemy(eid){ _selViaTab=false; G.sel=[]; G.selEnemy=eid; refreshSelCard(); }  // 적은 1마리만
function deselectUnit(){ G.sel=[]; G.selEnemy=null; refreshSelCard(); }
// 현재 선택 유닛과 '같은 종류(같은 id+영웅여부+레벨)' 전체 선택
// 유닛뽑기: 시계 배치 유닛 + 중앙 시민 DOM 렌더
// 시계 유닛 + 시민 div를 1회 생성(탭 진입 시). 이후엔 위치만 갱신해서 부드럽게 이동.
const COIN_SVG='<svg viewBox="0 0 24 24" width="10" height="10" style="flex:0 0 auto"><circle cx="12" cy="12" r="9" fill="#ffd24a" stroke="#ffe6a0" stroke-width="1.6"/><path d="M14.8 8.8A4.4 4.4 0 1 0 14.8 15.2" fill="none" stroke="#7a5a12" stroke-width="2.6" stroke-linecap="round"/></svg>';
const COIN_SM='<svg viewBox="0 0 24 24" width="9" height="9" style="flex:0 0 auto"><circle cx="12" cy="12" r="9" fill="#ffd24a" stroke="#ffe6a0" stroke-width="1.6"/><path d="M14.8 8.8A4.4 4.4 0 1 0 14.8 15.2" fill="none" stroke="#7a5a12" stroke-width="2.6" stroke-linecap="round"/></svg>';
function beaconCostLabel(id){
  if(id==='pboss'){ return (G.pbossCd>0) ? ('<span class="dzCd">'+Math.ceil(G.pbossCd)+'s</span>') : '<span class="dzGo">소환</span>'; }   // 개인 보스=쿨다운/소환
  return beaconMaxed(id) ? '<span class="dzMax">MAX</span>' : (COIN_SVG+beaconCost(id)); }   // 최대 레벨이면 MAX
function updateBeaconLabels(){ for(const b of DRAW_BEACONS){ const dz=document.getElementById('drawZoneEl_'+b.id); if(!dz) continue;
    const nm=dz.querySelector('.dzName'); if(nm) nm.textContent=beaconName(b);
    const cs=dz.querySelector('.dzCost'); if(cs) cs.innerHTML=beaconCostLabel(b.id); }
  const rm=document.getElementById('rateMini'); if(rm) rm.innerHTML=rateMiniHTML(); renderOpsManual(); renderGachaActions(); }
// 유닛뽑기 하단 액션 버튼 — 누르면 시민이 그 비콘으로 이동해 자동 실행(건설식 UX)
function renderGachaActions(){ const el=document.getElementById('gachaActions'); if(!el || typeof DRAW_BEACONS==='undefined') return;
  el.innerHTML=DRAW_BEACONS.map(b=>{ const maxed=(typeof beaconMaxed==='function')&&beaconMaxed(b.id), cost=(typeof beaconCost==='function')?beaconCost(b.id):0, nm=(typeof beaconName==='function')?beaconName(b):(b.name||'');
    return '<button class="gaBtn" onclick="gachaActionCmd(\''+b.id+'\')"><span class="gaNm">'+escHtml(nm)+'</span><span class="gaCost">'+(maxed?'MAX':(cost?('⛁'+cost):'-'))+'</span></button>'; }).join(''); }
function gachaActionCmd(id){ if(G.tab!=='Unit') return; const b=(typeof DRAW_BEACONS!=='undefined')&&DRAW_BEACONS.find(x=>x.id===id); if(!b) return;
  if(typeof moveCitizenTo==='function') moveCitizenTo(b.x, b.y, b.id);   // 시민을 그 비콘으로 → 도착 시 자동 실행
  if(typeof playSfx==='function') playSfx('ui_tab'); }
// 생산고 운용 안내(현황) — 뽑기 확률 / 크레딧 확률 / 미사일 포탑 수 / 스파이어 수 (SC 콘솔 카드)
function renderOpsManual(){ const el=document.getElementById('opsManual'); if(!el) return;
  const gN=(typeof G!=='undefined'&&G.units)?G.units.filter(u=>u.id==='turret').length:0;   // 보유 미사일 포탑 수
  const sN=(typeof G!=='undefined'&&G.units)?G.units.filter(u=>u.id==='photon').length:0;   // 보유 스파이어 수
  const cell=function(c,ico,name,right){ return '<div class="omCell" style="--c:'+c+'"><svg class="omIco" viewBox="0 0 24 24">'+ico+'</svg>'
    +'<div class="omTx"><b>'+name+'</b></div><span class="omLv" style="color:'+c+'">'+right+'</span></div>'; };
  const rows=cell(BEACON_THEME.gachaUp['--neon'], beaconIcon('gachaUp'), '뽑기 확률', 'Lv'+(G.gachaLuckLv||0))
    +cell(BEACON_THEME.creditUp['--neon'], beaconIcon('creditUp'), '크레딧 확률', 'Lv'+(G.creditLv||0))
    +cell(BEACON_THEME.buyTurret['--neon'], beaconIcon('buyTurret'), '미사일 포탑', gN+'개')
    +cell(BEACON_THEME.buyPhoton['--neon'], beaconIcon('buyPhoton'), '에너지 타워', sN+'개');
  el.innerHTML='<div class="omHead"><span class="omBar"></span>생산고 운용 안내</div><div class="omGrid">'+rows+'</div>'; }
function buildClock(){ const v=document.getElementById('vUnit');
  v.querySelectorAll('.shopUnit,.citizen,.drawZone,.rateMini').forEach(n=>n.remove());
  // 뽑기 비콘 3종(단발/10연차/에너지) — 시민이 올라서면 해당 뽑기
  DRAW_BEACONS.forEach(b=>{ const dz=document.createElement('div'); dz.className='drawZone'+(beaconBadge(b.id)?' big':''); dz.id='drawZoneEl_'+b.id; dz.dataset.bid=b.id;
    dz.style.left=(b.x*100)+'%'; dz.style.top=(b.y*100)+'%';
    const th=BEACON_THEME[b.id]; if(th) for(const k in th) dz.style.setProperty(k, th[k]);
    const badge=beaconBadge(b.id);
    dz.innerHTML='<div class="dzRing"><div class="dzFx"></div></div>'
      +'<svg class="dzGlyph" viewBox="0 0 24 24">'+beaconIcon(b.id)+'</svg>'+(badge?'<span class="dzBadge">'+badge+'</span>':'')
      +'<div class="dzLabel"><span class="dzName">'+beaconName(b)+'</span><span class="dzCost">'+beaconCostLabel(b.id)+'</span></div>';
    v.appendChild(dz); });
  // 뽑기 확률 — 화면 안에 작게 상시 표시
  const rm=document.createElement('div'); rm.className='rateMini'; rm.id='rateMini'; rm.innerHTML=rateMiniHTML();
  v.appendChild(rm);
  const c=document.createElement('div'); c.className='citizen'; c.id='citizenEl';
  const citModel=!!(window.M3D && window.M3D.hasModel && window.M3D.hasModel('citizen')) && !(typeof G!=='undefined'&&G.opt&&G.opt.model3d===false);  // 3D 시민 있으면 이모지 프레임 숨김(3D 끄면 표시)
  c.innerHTML=(citModel?'':'<div class="cframe">'+citizenSVG()+'</div>')+'<div class="cn">시민</div>';
  v.appendChild(c);
  renderClock(); renderOpsManual();   // 탭 진입 시 생산고 안내 바로 표시(구매 전에도)
}
// 매 프레임: 시민 위치 + 목표 유닛 강조만 갱신(div 재생성 없음).
function renderClock(){ const c=document.getElementById('citizenEl'); if(!c) return;
  c.style.left=(G.citizen.x*100)+'%'; c.style.top=(G.citizen.y*100)+'%';
  DRAW_BEACONS.forEach(b=>{ const dz=document.getElementById('drawZoneEl_'+b.id);
    if(dz) dz.classList.toggle('active', G.citizen.onPad===b.id || G.citizen.buyId===b.id); });
  const pz=document.getElementById('drawZoneEl_pboss');   // 개인 보스 쿨다운 라벨 실시간 갱신
  if(pz){ const cs=pz.querySelector('.dzCost'); if(cs){ const nw=beaconCostLabel('pboss'); if(cs.innerHTML!==nw) cs.innerHTML=nw; } }
}
// 확률 미니 패널(상시 표시) HTML — 등급별 % 한 줄씩
function rateMiniHTML(){ const w=gachaWeights();   // 현재 적용 확률(뽑기확률↑ 반영)
  const up=(G.gachaLuckLv||0)>0?' <span style="color:#c69bff">+'+G.gachaLuckLv+'</span>':'';
  return '<div class="rmTitle">'+pIco('📊','md')+' 뽑기 확률'+up+'</div>'
  + GACHA_TIER_ORDER.map(function(t){ const p=w[t]*100;
      return '<div class="rmRow"><span style="color:'+(TIER_COLOR[t]||'#fff')+'">'+GACHA_TIERS[t].name+'</span><span>'+(p<1?p.toFixed(2):p.toFixed(1))+'%</span></div>'; }).join(''); }
// 시민 이동 명령. 구매는 '패드 통과' 시 자동(passOverBuy). 여기선 목표만 설정.
function moveCitizenTo(x,y,buyId){ const c=G.citizen; c.gx=x; c.gy=y; c.buyId=buyId||null;
  document.getElementById('prodHint').style.display='none'; renderClock(); }
// 시민이 패드 위를 '지나가기만 해도' 그 유닛 구매. 패드당 1회(벗어났다 다시 들어오면 재구매).
function passOverBuy(){ const c=G.citizen; if(!GW||!GH) return;   // 시민이 뽑기 비콘에 올라서면 해당 뽑기
  const b=beaconUnder(c.x,c.y,0.075);
  if(!b){ c.onPad=null; return; }
  if(c.onPad===b.id) return;               // 연속 중복 방지(벗어났다 다시 올라서야 재뽑기)
  c.onPad=b.id;
  const min0=G.mineral; runBeacon(b.id);   // 모든 비콘은 성공 시 크레딧을 소모(실패=부족/공간초과 토스트)
  if(G.mineral<min0){ c.x=CITIZEN_HOME.x; c.y=CITIZEN_HOME.y; c.onPad=null;   // 성공 → 중앙 아래로 복귀
    if(!uHold){ c.gx=null; c.gy=null; c.buyId=null; } }
}
// 시민 위치 갱신(루프). 목표로 이동 + 패드 통과 시 자동 구매.
let uHold=null;  // 유닛뽑기 꾹 누르기 중인 위치(정규화 {x,y}) — 홈화면 유닛이동과 동일 방식
// 누른 지점이 어느 유닛 패드 위인지(없으면 -1)
// 시민 이동: 누른 지점으로 계속 이동(유닛/빈곳 구분 없음). 이동 중 구역을 '밟는 순간' 즉시 구매 + 중앙 텔레포트.
// 계속 누르고 있으면 텔레포트 후 다시 누른 곳으로 이동 → 경로상 같은 구역을 또 밟아 반복 구매.
function stepCitizen(dt){ const c=G.citizen; if(G.tab!=='Unit') return;
  if(uHold){ c.gx=uHold.x; c.gy=uHold.y; const _hb=beaconUnder(uHold.x,uHold.y,0.11); c.buyId=_hb?_hb.id:null; }  // 누른 곳으로 이동(뽑기 비콘이면 강조)
  if(c.gx!=null){ const dx=c.gx-c.x, dy=c.gy-c.y, dist=Math.hypot(dx,dy), spd=0.55*dt;
    if(dist<0.012){ c.x=c.gx; c.y=c.gy; c.gx=null; c.gy=null; c.buyId=null; }  // 도착 시 목표 비움(누르고 있으면 다음 프레임 uHold로 재설정)
    else { c.x+=dx/dist*Math.min(spd,dist); c.y+=dy/dist*Math.min(spd,dist); } }
  passOverBuy();   // 구역을 밟으면 즉시 구매 + 중앙 텔레포트
  renderClock(); drawProd();
}
// 계열(wpn)별 무기 형태 글리프(금색 원형 배지 안에 들어감) — 취소 아이콘 같은 느낌
// 무기 계열 업그레이드 아이콘 — 실제 업그레이드 아이콘 이미지(assets/icons/upgrades) 우선, 없으면 아래 라인 SVG 폴백
const UPG_ICON_DIR='assets/icons/upgrades/';
const WPN_ICON_IMG={   // 계열 → 실제 공격력 업그레이드 아이콘
  inf:  'up_inf_atk.webp',    // 보병 = 돌격소총
  mech: 'up_veh_atk.webp',    // 메카닉 = 포신(캐논)
  zrg:  'up_melee_atk.webp',  // 스웜 = 갈고리 발톱
  pro:  'up_gnd_wpn.webp',    // 에테리얼 = 사이오닉 블레이드
};
// 폴백용 라인 스타일 24뷰박스(currentColor). 이미지가 없는 계열에만 쓰인다.
const WPN_ICON={
  inf:  '<path d="M3.6 11.8h11.6v2.8H3.6z"/><path d="M15.2 12.6h5"/><path d="M7.2 11.8V9.4h2.6v2.4"/><path d="M11.2 14.6 9.4 18.4"/><path d="M4.6 14.6v2.4"/>',   // 보병 = 소총
  mech: '<path d="M12 2.6c1.7 1.9 2.6 3.9 2.6 6v6.6H9.4V8.6c0-2.1.9-4.1 2.6-6z"/><path d="M9.4 10.6 6.2 13.8v3.6l3.2-2.4M14.6 10.6l3.2 3.2v3.6l-3.2-2.4"/><path d="M10.4 15.2v2.2M13.6 15.2v2.2"/><path d="M12 18.4c.9 1 1.4 2 1.4 3-.5-.5-.9-.8-1.4-.8s-.9.3-1.4.8c0-1 .5-2 1.4-3z"/>',   // 메카닉 = 미사일 탄두
  pro:  '<path d="M9.6 20.2 7 17.6l1.8-1.8 2.6 2.6z"/><path d="M11 14.4 8.6 16.8"/><path d="M11.4 18.4 20 9.8"/><path d="M10.2 17.2 18.8 8.6"/><path d="M17.4 7.2 21.4 11.2"/>',   // 에테리얼 = 광선검(빔 세이버)
  zrg:  '<path d="M12 2.8c1.9 4.4 2.9 8.1 2.9 11.2 0 2.4-1 4.4-2.9 6.2-1.9-1.8-2.9-3.8-2.9-6.2 0-3.1 1-6.8 2.9-11.2z"/><path d="M9.3 10.4 5.8 8.2M14.7 10.4l3.5-2.2M9.2 14.6 5.6 16.6M14.8 14.6l3.6 2"/>',   // 스웜 = 가시
};
function wpnBadgeHTML(wpn,col){ const f=WPN_ICON_IMG[wpn];   // 초상(unitPortraitHTML)과 동일 패턴 — 이미지 우선, 없으면 SVG
  if(f) return '<img class="cgIco" src="'+UPG_ICON_DIR+f+'" alt="" draggable="false">';
  const g=WPN_ICON[wpn]||WPN_ICON.inf;
  return '<svg class="cgIco" viewBox="0 0 24 24" width="100%" height="100%" '+'style="color:'+(col||'currentColor')+'" '+'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+g+'</svg>'; }
// ── 업그레이드 설정(유즈맵별로 바꿔 끼움) ──
const UPG_MAX=299;   // 업그레이드 최대 레벨 (이 유즈맵=299, 일반 맵은 3 등으로 설정)
const UPG_TIME=0;    // 업그레이드 1회 완료까지 걸리는 시간(초). 0=즉시 완료(네모네모 디펜스: 로딩 없음)
function upgCost(wpn){ return UPG_COST; }   // 정액 5 에너지(에너지 수급 하향으로 밸런스)
// 건물별 업그레이드 항목 목록 — 추후 방어력 등 추가 시 배열에 push만 하면 슬롯이 자동 추가됨
// ══ 재사용 커맨드 그리드 컴포넌트(업그레이드·생산·건설 공용) — model 객체만 만들어 renderCmdGrid로 넘기면 됨 ══
//   model = { mode:'upg'|'prod'|'build', title, icon(초상화 HTML), sub, status, statusIdle,
//     items:[{ pro(초상화 HTML), sn(이름), cr(크레딧), en(에너지), meta(우상단 배지), metaCls:'lv'?, state:'ok'|'dim'|'busy'|'max'|'empty', sel, act(이벤트 속성 문자열) }],
//     info:{ eb, name, desc, stats:[[라벨,값]] | val:{cur,nxt,unit}, progLabel, progVal, prog, cr, en, time }, page }
function _cgFmt(n){ n=n||0; return n>=10000?((n/1000).toFixed(n>=100000?0:1)+'K'):(''+n); }
function _cgCost(cr,en,ce){ { const _p=(typeof techCostView==='function')?techCostView(cr,en):null; if(_p){ cr=_p.cr; en=_p.en; } }   // 오토배틀: 지갑이 하나(골드) → 에너지 비용을 크레딧으로 환산해 표기(단일 지점)
  // 건설 카드는 **미네랄(윗줄)·가스(아랫줄) 두 자리를 언제나 예약**한다 — 값이 없다고 줄을 빼면
  //   칸마다 재화가 다른 높이에 찍혀 눈이 자리를 못 잡는다. 비는 만큼은 글자·아이콘 치수로 흡수한다.
  let h=''; if(ce){ h+='<span class="cc cr">'+(cr?(resIco('mineral')+_cgFmt(cr)):'')+'</span>'
      +'<span class="cc en">'+(en?(resIco('gas')+_cgFmt(en)):'')+'</span>'; return h; }
  if(cr) h+='<span class="cc cr">'+resIco('mineral')+_cgFmt(cr)+'</span>'; if(en) h+='<span class="cc en">'+resIco('gas')+_cgFmt(en)+'</span>'; return h; }   // 무료 표기 제거(빈칸)
function _cgHpShStr(hp,sh,en){ let s=''; if(sh) s+='<span class="shv"><i class="stAb">S</i>'+sh+'</span>'; if(hp!=null&&hp!=='') s+='<span class="hpv"><i class="stAb">H</i>'+hp+'</span>'; if(en) s+='<span class="env"><i class="stAb">E</i>'+en+'</span>'; return s; }   // 헤더: 쉴드(S)→HP(H)→마나(E) · 약자 프리픽스(아이콘 없음)
function _cgHpShDual(hp,sh,en){ let s=''; if(sh) s+='<span class="shv"><i class="stAb">S</i>'+sh+'/'+sh+'</span>'; if(hp!=null&&hp!=='') s+='<span class="hpv"><i class="stAb">H</i>'+hp+'/'+hp+'</span>'; if(en) s+='<span class="env"><i class="stAb">E</i>'+en+'/'+en+'</span>'; return s; }   // 유닛 헤더: 쉴드→HP→마나(현재/기본)
function _cgSlotHTML(it, build){ if(!it||it.state==='empty') return '<div class="cgSlot empty"></div>';
  const cls='cgSlot '+(it.state==='busy'?'busy':it.state==='dim'?'dim':it.state==='max'?'max':'')+(it.sel?' sel':'')+(it.cls?(' '+it.cls):'');
  const meta=(it.tr!=null&&it.tr!=='')?('<div class="cgMeta '+(it.metaCls||'')+'">'+it.tr+'</div>'):((!build&&it.meta)?('<div class="cgMeta '+(it.metaCls||'')+'">'+it.meta+'</div>'):'');   // tr=건설 카드에서도 보이는 우상단 배지(업그레이드 다음 단계 등) · 그 외 건설 카드=메타 제거
  const bot=(it.bottom!=null)?it.bottom:('<div class="cgCost">'+_cgCost(it.cr,it.en,build)+'</div>');   // 🧱 bottom = 커스텀 하단 줄(벙커 HP 등)
  return '<div class="'+cls+'"'+(it.act?(' '+it.act):'')+'>'+meta+'<div class="cgPro">'+(it.pro||'')+'</div><div class="cgName">'+(it.sn||'')+'</div>'+((it.sub!=null&&it.sub!=='')?('<div class="cgSub">'+it.sub+'</div>'):'')+bot+'</div>'; }
function _cgInfoHTML(d){ if(!d) return '<div class="cgEb">정보</div><div class="cgDd">항목을 선택하세요</div>';
  let val=''; if(d.stats) val='<div class="cgStats'+(d.statsScroll?' cgScr':'')+(d.statsWide?' cgWide':'')+'">'+d.stats.map(s=>'<div class="cgStat"><span>'+s[0]+'</span><b>'+s[1]+'</b></div>').join('')+'</div>';
  else if(d.val&&!d.val.sm) val='<div class="cgVal"><span class="cur">'+d.val.cur+'</span><span class="arw">▸</span><span class="nxt">'+d.val.nxt+'</span><span class="u">'+(d.val.unit||'')+'</span></div>';
  const valSm=(d.val&&d.val.sm)?('<div class="cgVal sm"><span class="cur">'+d.val.cur+'</span><span class="arw">▸</span><span class="nxt">'+d.val.nxt+'</span></div>'):'';   // sm=진행 바 아래 작게(업그레이드 단계)
  let q=''; if(d.queue){ const cap=d.qcap||5, lbl=d.qlabel||'대기열', have=d.queue.filter(Boolean).length;
    q='<div class="cgQlbl">'+lbl+' '+have+'/'+cap+'</div><div class="cgQ">'+d.queue.map((s,i)=>s?('<div class="qs'+(s.front?' front':'')+(s.ready?' rdy':'')+'"'+(s.act?(' '+s.act+' title="탭 = 취소(100% 환불)"'):(s.ready?'':' onclick="techCancelQueue(event,'+i+')" title="탭 = 취소(100% 환불)"'))+'><span class="qpro">'+(s.pro||'')+'</span>'+(s.front?'<i class="qb" style="width:'+Math.max(0,s.prog||0)+'%"></i>':'')+'</div>'):'<div class="qs empty"></div>').join('')+'</div>'; }
  let ul=''; if(d.units){ ul='<div class="cgUnits">'+d.units.map(u=>{ if(u.more!=null) return '<div class="cgUMore">+'+u.more+'</div>';
    const r=Math.max(0,Math.min(1,u.hp/(u.maxHp||1)));
    return '<div class="cgUChip" data-uid="'+(u.uid!=null?u.uid:u.eid)+'" '+(u.act||('onclick="techSubSelectOne(event,'+u.eid+')"'))+' title="이 유닛만 지정"><i class="cgUFill" style="width:'+(r*100)+'%;background:'+hpBarColor(r)+'"></i><em class="cgUHp">'+Math.round(u.hp)+'/'+Math.round(u.maxHp||0)+'</em></div>';
  }).join('')+'</div>'; }   // 👥 유닛별 HP 칩 그리드 — 얇은 HP 선(비율↓=빨강) + 칩 중앙 HP 수치(40/40), 탭=개별 지정 · 12↑도 그리드 스크롤(프로필 높이 고정)
  return (d.eb?'<div class="cgEb">'+d.eb+'</div>':'')+(d.hideName?'':'<div class="cgDn">'+(d.name||'')+'</div>')+(d.desc?'<div class="cgDd">'+d.desc+'</div>':'')+val
    +(d.progLabel?('<div class="cgProg"><div class="pl"><span>'+d.progLabel+(d.progTime?' <em class="pt">'+d.progTime+'</em>':'')+'</span><b>'+(d.progVal||'')+'</b></div><div class="cgBar"><i style="width:'+Math.max(4,d.prog||0)+'%"></i></div>'+(d.qbar?('<div class="cgQBar"'+(d.qbar.cancel!=null?' onclick="techCancelQueue(event,'+d.qbar.cancel+')" title="탭 = 마지막 예약 취소(100% 환불)" style="cursor:pointer"':'')+' aria-label="대기열 '+(d.qbar.n||0)+'/5"><i style="width:'+Math.max(0,d.qbar.fill||0)+'%'+(d.qbar.color?(';background:'+d.qbar.color):'')+'"></i></div>'):'')+valSm+'</div>'):'')+q+ul
    +'<div class="cgDcost">'+_cgCost(d.cr,d.en)+(d.time?'<span class="time">'+d.time+'</span>':'')+'</div>'; }
function renderCmdGrid(host, m){ const el=(typeof host==='string')?document.getElementById(host):host; if(!el||!m) return;
  const PER=m.compact?4:8; let _items;   // 간소화=4칸/페이지, 전체=8칸/페이지
  { const raw=m.items||[], adn=raw.filter(it=>it&&it._addon);   // 🔗 부속 카드는 항상 그리드 맨 끝 슬롯에 고정(앞의 빈 칸은 그대로, 부속만 마지막 페이지 끝으로)
    if(adn.length){ const reg=raw.filter(it=>it&&!it._addon), T=Math.max(PER, Math.ceil((reg.length+adn.length)/PER)*PER), arr=new Array(T).fill(null);
      for(let i=0;i<reg.length;i++) arr[i]=reg[i]; for(let i=0;i<adn.length;i++) arr[T-adn.length+i]=adn[i]; _items=arr; }
    else _items=raw; }   // 부속 없음 = 슬롯 위치 보존(간소화도 빈 칸 유지) → 5개↑는 페이지로 넘어가며 그리드 위치 그대로(예: 5·8 → 다음 페이지 1·4)
  const total=_items.length, pages=Math.max(1,Math.ceil(total/PER));
  let pg=(((m.page!=null?m.page:(el._cgPage||0))%pages)+pages)%pages; el._cgPage=pg; m.page=pg; el._cgModel=m;   // 순환(1페이지서 ◀=마지막 · 마지막서 ▶=1페이지)
  const start=pg*PER, cells=[]; for(let k=0;k<PER;k++) cells.push(_cgSlotHTML(_items[start+k], m.build));
  let dots=''; for(let p=0;p<pages;p++) dots+='<span class="dot'+(p===pg?' on':'')+'"></span>';
  const pager=(pages>1)?('<div class="cgPage"><button onclick="_cgTurn(this,-1)">◀</button><span class="dots">'+dots+'</span><span class="pn">'+(pg+1)+' / '+pages+'</span><button onclick="_cgTurn(this,1)">▶</button></div>'):'';
  const pill=m.status?('<span class="cgPill'+(m.statusIdle?' idle':'')+'">'+m.status+'</span>'):'';
  // 🎛 판 밖 오른쪽 위 트레이 = [🔙 되돌아가기][일꾼 수·랠리·부양·전체지정].
  //   되돌아가기가 **맨 왼쪽**이다 — '나가는 문'이라 손이 먼저 닿는 쪽에 둔다.
  //   ⚠ 머리줄에 두지 않는다: 버튼 높이가 머리줄을 밀어 올려 그리드가 그만큼 짧아지고, 조작 버튼이 두 곳으로 갈린다.
  const tray=(m.back||'')+(m.topRight||'');
  el.innerHTML='<div class="cmdG" data-mode="'+(m.mode||'upg')+'" data-compact="'+(m.compact?1:0)+'" data-build="'+(m.build?1:0)+'">'
    +(tray?('<div class="cgTopOut">'+tray+'</div>'):'')
    // 🏕 m.kicker = 제목을 **자간 넓은 작은 라벨**로 낮춘다(로딩창 LOADING 과 같은 어법).
    //    줄은 있되 무게가 없어, 고른 것이 있을 때와 자리는 같으면서 조용하다. 옵션이 없으면 지금까지 그대로.
    +'<div class="cgHead'+(m.kicker?' kick':'')+'"><div class="cgTtl">'
      +(m.kicker ? ('<div class="cgKick">'+(m.title||'')+'</div>')
                 : ('<div class="cgN">'+(m.title||'')+'</div>'+(m.hpsh?'<div class="cgHpsh">'+m.hpsh+'</div>':(m.sub?'<div class="cgS">'+m.sub+'</div>':''))))
      +'</div>'+pill+pager+'</div>'   // 머리줄 = [제목 HP/실드 / 설명][상태칩][◀페이지▶]
    // 🏕 m.wide = 그리드를 안 쓰고 **카드 안쪽 전체**를 정보로 쓴다(빈 슬롯이 의미 없는 요약 카드용).
    //    ⚠ 옵션이 없으면 지금까지와 똑같이 동작한다 — 다른 시트에 영향이 없다.
    +(m.wide
      ? ('<div class="cgBody"><div class="cgInfo wide">'+_cgInfoHTML(m.info)+'</div></div></div>')
      : ('<div class="cgBody"><div class="cgInfo">'+_cgInfoHTML(m.info)+'</div><div class="cgCol"><div class="cgGrid">'+cells.join('')+'</div></div></div></div>'));
  if(m.build){ const nms=el.querySelectorAll('.cgName'); for(const nm of nms){ let fs=10; nm.style.fontSize=fs+'px'; let g=0; while(nm.scrollWidth>nm.clientWidth+0.5 && fs>6 && g++<12){ fs-=0.5; nm.style.fontSize=fs+'px'; } } } }   // 이름 생략(...) 대신 폰트 축소로 한 줄에 전부
function _cgTurn(btn,delta){ let h=btn; while(h && !h._cgModel) h=h.parentElement; if(!h||!h._cgModel) return; h._cgModel.page=(h._cgPage||0)+delta; renderCmdGrid(h,h._cgModel); }
// 업그레이드 모델 빌더(현재 무기 강화 데이터 → 커맨드 그리드)
// 생산 모델 빌더(STK 건물 → 유닛 그리드). actFn(unitId)→이벤트 속성 문자열(미지정 시 미리보기만)
// 건설 모델 빌더(STK 건물 목록 → 건물 그리드·페이지 자동). actFn(bldgKey)→이벤트 속성 문자열
// 연구 시작 — 에너지 차감 후 타이머 가동(완료까지 다른 업그레이드 잠금). UPG_TIME=0이면 즉시
function research(wpn){
  if(G.research) return;                                       // 동시 1개만(즉시모드라 사실상 미발생)
  if((G.atkLv[wpn]||0)>=UPG_MAX) return;                       // 최대 레벨 — 알림 없이 무시
  const _uc=upgCost(wpn);
  if(G.gas<_uc){ if(typeof playSfxT==='function') playSfxT('upgrade_denied',130); toast('⚡ 에너지 부족 (다음 업글 '+_uc+' E)'); return; }   // 부족 — 알림음+토스트
  if(typeof playSfxT==='function') playSfxT('upgrade_press',80);   // 업그레이드 누름(상호작용)
  G.gas-=_uc; updateHud();
  if(UPG_TIME<=0){ finishResearch(wpn); return; }              // 즉시 완료 모드
  G.research={ wpn:wpn, t:UPG_TIME, dur:UPG_TIME, cost:_uc };            // 타이머 가동
}
function finishResearch(wpn){ G.atkLv[wpn]=(G.atkLv[wpn]||0)+1;   // 업그레이드 완료 — 채팅 알림 없이 슬롯 레벨로만 표시
  if(typeof playSfxT==='function') playSfxT('upgrade',80);   // 완료음(길게 누르기 연사 시 쓰로틀)
  G.research=null; }
// 길게 누르기 연속 업그레이드: 즉시 1회 → 0.5초 유지 시 0.05초마다 반복. 슬롯이 재렌더돼도 전역 타이머라 안 끊김
let _upgHold=null;
function upgHoldStart(wpn, ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  research(wpn);                       // 즉시 1회
  upgHoldStop();
  _upgHold={wpn:wpn};
  _upgHold.delay=setTimeout(()=>{ if(_upgHold&&_upgHold.wpn===wpn) _upgHold.rep=setInterval(()=>research(wpn),50); }, 500); }   // 0.5초 후부터 0.05초마다 연속 업그레이드
function upgHoldStop(){ if(_upgHold){ clearTimeout(_upgHold.delay); if(_upgHold.rep) clearInterval(_upgHold.rep); _upgHold=null; } }
['pointerup','pointercancel'].forEach(e=>document.addEventListener(e, upgHoldStop));   // 손 떼면 어디서든 중단
window.addEventListener('blur', upgHoldStop);
// 🎰 유닛뽑기: 셀 길게 누르면 연속 구매 — 즉시 1회 + 0.5초 후부터 0.5초마다 뗄 때까지. 크레딧 부족 시 중단.
let _gachaHold=null;
function gachaHoldStart(id, ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  runBeacon(id);   // 즉시 1회(짧게 탭)
  gachaHoldStop();
  _gachaHold={id:id};
  _gachaHold.delay=setTimeout(function(){ if(!_gachaHold||_gachaHold.id!==id) return;
    if((G.mineral||0)<beaconCost(id)){ gachaHoldStop(); return; }
    runBeacon(id);   // 0.5초 시점 첫 연속 구매
    _gachaHold.rep=setInterval(function(){
      if((G.mineral||0)<beaconCost(id)){ gachaHoldStop(); return; }   // 크레딧 부족 → 연속 중단
      runBeacon(id); }, 100); }, 500); }   // 이후 100ms마다(업그레이드 50ms의 2배 = 절반 속도)
function gachaHoldStop(){ if(_gachaHold){ clearTimeout(_gachaHold.delay); if(_gachaHold.rep) clearInterval(_gachaHold.rep); _gachaHold=null; } }
['pointerup','pointercancel'].forEach(e=>document.addEventListener(e, gachaHoldStop));
window.addEventListener('blur', gachaHoldStop);
// 매 프레임 연구 타이머 진행(루프에서 호출) — 탭과 무관하게 백그라운드 진행
function tickResearch(dt){ if(!G.research) return;
  G.research.t-=dt;
  if(G.research.t<=0){ finishResearch(G.research.wpn); return; }
  if(G.tab==='Upgrade'){   // 업글 탭이면 좌측 진행바/수치·초상화 진행바만 갱신(전체 재렌더 X)
    const p=Math.round((1-G.research.t/G.research.dur)*100);
    const pb=document.querySelector('.cmdG .cgBar i'); if(pb) pb.style.width=p+'%';
    const pv=document.querySelector('.cmdG .cgProg .pl b'); if(pv) pv.textContent=p+'%';
    const pt=document.querySelector('.cmdG .cgDcost .time'); if(pt) pt.textContent=G.research.t.toFixed(1)+'s 남음';
  }
}
// 8인 플레이어 구분색 — 파랑/빨강/노랑/초록/보라/주황/갈색/흰색(스타 정통 팔레트)
//   본체 틴트가 색조뿐 아니라 채도·명도까지 플레이어별로 가져가므로, 색조만으로는 불가능한
//   갈색(주황과 같은 색조 + 어둡고 탁함)·흰색(무채색)도 확실히 구분됨 → 분홍·연두·청록 불필요
//   각 hex의 HSL이 그대로 틴트 파라미터가 됨(단일 소스): H=색조 · S=채도 · L=명도 배율(L/0.58)
const PLAYER_VIEW_COLORS=['#4570d3','#d6292f','#eadb3e','#2ba143','#ad5cd6','#ed691d','#6d422c','#dfe0e2'];
function renderPlayers(){ const g=document.getElementById('plGrid'); g.innerHTML='';
  const mine=G.myPlayer||1;
  // ⚠ 자리 판정은 slotState() 하나가 갖는다 — 여기서 activePlayers/eliminated 를 직접 뒤지지 말 것
  for(let n=1;n<=8;n++){ const st=slotState(n), isMe=(st==='me'), present=slotWatchable(n);
    const elim=(st==='dead');   // 입장했다가 탈락/이탈한 자리(색 유지·어둡게) — 빈 자리(empty)와 같게 취급된다
    const el=document.createElement('div');
    el.className='plbtn'+(isMe?' mine':(present?((st==='done'?' done':(st==='away'?' away':''))+(n===G.curPlayer?' me':'')):(elim?' gone':' off')));   // 나=mine · 활성=관전가능(현재관전=me) · 승리정지=done · 연결끊김=away · 탈락=gone · 빈자리=off
    const showColor=(isMe||present||elim);   // 빈 자리만 무채색(흰색 계열)
    el.style.setProperty('--pc', showColor?PLAYER_VIEW_COLORS[(n-1)%PLAYER_VIEW_COLORS.length]:'#b6bdc8');
    const _bo=!isMe && present && G.coopState && G.coopState[n] && G.coopState[n].bo;   // 상대가 토벌장 보는 중
    const _away=(st==='away')?(' <span title="연결 끊김 — 돌아오기를 기다리는 중">📡</span>'):'';   // 자리를 잡아 둔 상태
el.innerHTML='<div class="plnum">'+n+'P</div><div class="plst">'+(isMe?escHtml(myNick()):(present?(escHtml(playerName(n))+_away+(_bo?(' <span title="보스방 입장 중">'+pIco('👹','sm')+'</span>'):'')):(elim?escHtml(playerName(n)):'빈 자리')))+'</div>';
    if(!isMe && present) el.onclick=()=>{ G.curPlayer=n; renderPlayers(); drawPlayer(); updateSpecLabel(); };   // 입장한 다른 플레이어만 관전 가능   // 죽은 자리·빈 자리는 클릭 불가
    g.appendChild(el);
  } }
function updatePlayerCounts(){ const active=G.activePlayers||[];   // Players 탭에서 실시간 적 수 갱신
  for(const n of active){ const e=document.getElementById('plcnt-'+n); if(!e) continue; const c=playerEnemyCount(n);
    e.textContent='적 '+c; e.style.color = c>=WARN2?'#ff6b6b' : (c>=WARN1?'#ffb14d' : '#9aa6b2'); } }
// ── 배속 투표(만장일치=최저 배속) ──
   // 나(1) + 봇 7명
function ensureVote(){ if(!G.vote){ G.vote={1:1,2:2,3:4,4:4,5:4,6:2,7:4,8:1}; G._voteT=4; computeSpeed(); } }
function computeSpeed(){ ensureVote();
  let sp;
  if(typeof coopActive==='function' && coopActive()){   // 협동: 전원 투표 중 최소(만장일치로만 가속)
    // ⚠ 죽은 자리는 투표에서 뺀다 — 안 빼면 없는 사람이 계속 1배속에 표를 던져 판이 영원히 1배속에 묶인다
    sp=Infinity; Object.keys(G.coopNumToUid||{}).forEach(k=>{ const n=+k;
      if(typeof slotDead==='function' && slotDead(n)) return;
      const v=(G.coopSpeed&&G.coopSpeed[n])||1; if(v<sp) sp=v; }); if(sp===Infinity) sp=1;
  } else sp=G.vote[G.myPlayer||1]||1;
  G.speedMul=sp;
  const r=document.getElementById('voteResult'); if(r) r.textContent=sp+'x';
  const n=document.getElementById('spdNow'); if(n) n.textContent=sp+'x';
  G._lastSpeed=sp; return sp; }
function castVote(spd){ ensureVote(); const old=G.speedMul; G.vote[G.myPlayer||1]=spd;
  if(coopActive()){ G.coopSpeed[G.myPlayer||1]=spd; coopSend('speed',{mul:spd}); }   // 내 투표 전파(전원 최소로 결정)
  computeSpeed();
  if(coopActive() && G.speedMul!==old) addChat('', 'ℹ️ 게임 배속 '+old+'배 → '+G.speedMul+'배');   // 효과 배속 변경 시 전원 알림
  renderVote(); }
function renderVote(){ ensureVote(); const me=G.myPlayer||1, myv=G.vote[me]||1;
  [1,2,4].forEach(s=>{ const c=document.getElementById('vc-'+s); if(c) c.innerHTML=''; });
  function chip(num, spd){ const c=document.getElementById('vc-'+spd); if(!c) return;
    const ch=document.createElement('div'); ch.className='vChip'+(num===me?' me':'');
    ch.style.setProperty('--pc', PLAYER_VIEW_COLORS[(num-1)%PLAYER_VIEW_COLORS.length]); ch.textContent=num; ch.title=(num===me?'나 ':'')+'(P'+num+')'; c.appendChild(ch); }   // 플레이어 색 + 번호
  if(coopActive() && G.coopNumToUid){ Object.keys(G.coopNumToUid).forEach(k=>{ const num=+k; chip(num, num===me?myv:((G.coopSpeed&&G.coopSpeed[num])||1)); }); }   // 협동: 파티원 투표 토큰 모두 표시
  else chip(me, myv);   // 단독: 내 토큰만
  const activeS = coopActive()? G.speedMul : myv;   // 강조 칸 = 현재 진행 배속(협동=전원 최소)
  [1,2,4].forEach(s=>{ const col=document.getElementById('vcol-'+s); if(col) col.classList.toggle('active', s===activeS); }); }
function tickVote(dt){}   // 배속은 내 선택만 — 봇 투표 제거
// ── 설정 팝업(소리/비디오/임무목표/배속) ──
function openSettings(){ const p=document.getElementById('settingsPop'); if(!p) return;
  clearTimeout(p._closeT); p.classList.remove('hide','closing','appCtx');   // ⚠ 밖과 같은 처리 — 닫는 중에 다시 열면 예약된 감추기를 취소한다
  // ⛔ fxPop 을 부르지 말 것 — .fxPop 의 fxPopOn 은 카드 배율(--setScale=.8)을 모른 채
  //   scale(1) 로 끝내, 꽉 찬 카드가 떴다가 툭 줄어든다. 등장 애니는 setCardIn 하나다.
  if(typeof syncSndUI==='function') syncSndUI();
  if(typeof applyVideo==='function') applyVideo();
  if(typeof updatePauseBtn==='function') updatePauseBtn();
  _renderMission();   // 임무 목표 = 현재 유즈맵 기준으로 채움
  if(typeof renderVote==='function') renderVote(); }
// 임무 목표 본문 렌더 — 유즈맵별 MISSION, 없으면 유즈맵 특징(feats)/소개로 대체
function _renderMission(){ const box=document.getElementById('body-mission'); if(!box) return;
  const m=(typeof MAP!=='undefined'&&MAP)?MAP:null, ms=(m&&MISSION[m.id])||null;
  const block=(lbl,items)=>'<div class="missBlock"><div class="missLbl">'+lbl+'</div><ul class="missList">'
    +items.map(x=>'<li>'+x+'</li>').join('')+'</ul></div>';
  if(ms){ box.innerHTML=block('목표',ms.goal)+(ms.ctrl&&ms.ctrl.length?block('조작',ms.ctrl):''); return; }
  if(m&&m.feats&&m.feats.length){ box.innerHTML=block('이 유즈맵', m.feats.map(f=>'<b>'+escHtml(f.kw)+'</b> '+escHtml(f.tx))); return; }
  box.innerHTML=block('이 유즈맵', [escHtml((m&&(m.long||m.desc))||'준비 중인 유즈맵입니다.')]); }
// 로비/로그인 화면 설정(게임 항목 숨김, 소리/비디오 + 로그아웃)
function openAppSettings(){ const p=document.getElementById('settingsPop'); if(!p) return;
  clearTimeout(p._closeT); p.classList.remove('hide','closing');   // ⚠ 닫는 중에 다시 열면 예약된 감추기를 취소한다
  p.classList.add('appCtx');
  // ⛔ fxPop 을 부르지 말 것 — .fxPop 의 fxPopOn 은 카드 배율(--setScale=.8)을 모른 채
  //   scale(1) 로 끝내, 꽉 찬 카드가 떴다가 툭 줄어든다. 등장 애니는 setCardIn 하나다.
  const lo=document.getElementById('setLogout'); if(lo) lo.style.display=(typeof AUTH!=='undefined'&&AUTH.user)?'':'none';   // 로그인 상태에서만 로그아웃
  // 계정 연결은 '클라우드에 올라간 게스트'만 할 수 있다(로컬 게스트는 붙일 uid 가 없다)
  const lk=document.getElementById('setLink'); if(lk) lk.style.display=(typeof authCanLink==='function'&&authCanLink())?'':'none';
  if(typeof syncSndUI==='function') syncSndUI();
  setPaintMe();
  { const v=document.getElementById('setVer'); if(v) v.textContent='v'+APP_VER; }
  if(typeof applyVideo==='function') applyVideo(); }   // 소리는 상단 고정 스위치라 따로 펼칠 것이 없다
// ── 설정 머리줄의 내 프로필 — 배지가 계정 상태이자 **계정 연결 입구**다 ──
//   ⚠ 초상·닉은 만들지 말고 기존 것을 쓴다: avatarHTML() · myNick() (단일 소스 규칙)
function setPaintMe(){ const el=document.getElementById('setMe'); if(!el) return;
  const u=(typeof AUTH!=='undefined' && AUTH.user) || null;
  const nick=(typeof myNick==='function')?myNick():'나';
  const tag=(u&&u.tag)?('#'+u.tag):'';
  // ⚠ '계정 없음'과 '정식 계정'을 가르는 것은 u 의 유무다 — u 가 null 인데 정식 계정으로 읽으면
  //   계정이 없는 사람에게 연결 입구가 사라진다(실제로 그랬다).
  const acct=!!(u && !u.guest);
  // 정식 계정이면 배지는 그냥 표시다(누를 곳이 없다). 그 외에는 눌러서 계정으로 간다.
  const badge = acct ? '<em class="setMeTag">계정</em>'
    : '<button class="setMeTag go" onclick="setAcctGo()">'
      +(!u ? '로그인' : ((typeof authCanLink==='function'&&authCanLink()) ? '게스트 연결' : '게스트'))+' ›</button>';
  // 정식 계정이 아니면(게스트·미로그인) 초상도 자리표시로 — 배지 글자와 그림이 같은 말을 한다
  el.innerHTML=(typeof avatarHTML==='function'?avatarHTML(nick,'',null,!acct):'')
    +'<span class="setMeN">'+escHtml(nick)+(tag?'<i>'+escHtml(tag)+'</i>':'')+'</span>'+badge; }
// 게스트 → 계정. 클라우드 게스트는 uid 를 그대로 두고 붙일 수 있고(진행도 유지),
// 로컬 게스트(supabase 폴백)는 붙일 uid 가 없다 — 그 사실을 숨기지 않고 알린다.
function setAcctGo(){
  if(typeof authCanLink==='function' && authCanLink()){ closeSettings(); openAuthLink(); return; }
  toast('이 게스트는 이 기기에만 저장돼 있어 진행도를 옮길 수 없어요. 새 계정으로 시작합니다.');
  closeSettings(); if(typeof openAuth==='function') openAuth(); }
// 닉네임 변경 — 서버(auth 메타 + profiles.nick)와 로컬 세션을 함께 맞춘다.
//   ⚠ 프레즌스에도 다시 실어야 남들 목록의 내 이름이 바뀐다(sbEnsureProfile 과 같은 마무리).
async function setNickSave(){
  const inp=document.getElementById('setNickInp'), hint=document.getElementById('setNickHint'); if(!inp) return;
  const v=(inp.value||'').trim();
  if(v.length<2 || v.length>12){ if(hint) hint.textContent='닉네임은 2~12자여야 합니다.'; return; }
  if(v===myNick()){ closeSetSub(); return; }
  if(hint) hint.textContent='변경 중…';
  try{
    if(typeof sbReady==='function' && sbReady()){
      const up=await _sb.auth.updateUser({ data:{ nick:v } }); if(up.error) throw up.error;
      const pr=await _sb.from('profiles').update({ nick:v }).eq('id', AUTH.user.uid); if(pr.error) throw pr.error; }
    AUTH.user.nick=v; try{ _lsSet('nm_session', AUTH.user); }catch(e){}
    if(typeof updateMyNameTag==='function') updateMyNameTag();
    if(typeof RT!=='undefined' && RT.active && RT.lobby){ try{ RT.lobby.track(_rtTrackPayload()); }catch(e){} }
    setPaintMe(); closeSetSub(); toast('닉네임을 바꿨어요');
  }catch(e){ if(hint) hint.textContent=(e.message||'변경에 실패했어요'); } }
// 설정 하위 팝업 — 리스트 항목 하나당 한 화면.
// ⚠ 본문은 복사하지 않고 보관함(#setStash)에서 통째로 옮겨 쓴 뒤 닫을 때 돌려놓는다.
// 껍데기 항목(계정·언어·패치노트·개인정보·문의)은 걷어냈다 — 뒤에 붙은 것이 없으면 리스트에 두지 않는다.
//   채팅 표시는 '열어 보는 화면'이 아니라 껐다 켜는 것이라 상단 스위치로 올렸다.
const SET_SUB={ vid:'비디오 설정', mission:'임무 목표', disc:'디스코드', spd:'게임 배속', nick:'닉네임 변경' };
const SET_SUB_BODY={ vid:'body-vid', mission:'body-mission', spd:'body-spd', nick:'body-nick' };   // 옮겨 쓰는 기존 본문
let _setSubKey='';
function openSetSub(k){ const bd=document.getElementById('setSubBody');
  if(!bd||!SET_SUB[k]) return;
  closeSetSub();                                   // 열려 있는 것을 먼저 돌려놓는다
  _setSubKey=k;
  // 문맥(게임 밖 = .appCtx)을 그대로 물려준다 — 껍데기 규칙(붉은 선·44px ✕)이 하위 팝업에도 걸린다
  { const par=document.getElementById('settingsPop'), sub=document.getElementById('setSubPop');
    if(par&&sub) sub.classList.toggle('appCtx', par.classList.contains('appCtx')); }
  document.getElementById('setSubTitle').textContent=SET_SUB[k];
  const moveId=SET_SUB_BODY[k];
  if(moveId){ const el=document.getElementById(moveId);
    if(el){ el.style.display='block'; bd.appendChild(el); } }   // 통째로 옮긴다(복사 아님)
  else bd.innerHTML='<div class="setSoon">준비 중입니다</div>';
  if(k==='mission' && typeof _renderMission==='function') _renderMission();
  if(k==='spd' && typeof renderVote==='function') renderVote();
  if(k==='nick'){ const i=document.getElementById('setNickInp'), h=document.getElementById('setNickHint');
    if(i) i.value=myNick(); if(h) h.textContent=''; }
  popShow('setSubPop'); playSfx('ui_open'); }
function closeSetSub(){ const bd=document.getElementById('setSubBody');
  if(!bd) return;
  const moveId=SET_SUB_BODY[_setSubKey];
  if(moveId){ const el=document.getElementById(moveId), st=document.getElementById('setStash');
    if(el&&st){ el.style.display=''; st.appendChild(el); } }   // 보관함으로 돌려놓는다
  bd.innerHTML=''; _setSubKey='';
  popHide('setSubPop'); }
// 게임 밖 설정은 흐려지며 닫힌다(로그인과 같은 박자). 인게임은 예전대로 즉시 닫는다.
function closeSettings(){ closeSetSub();
  const p=document.getElementById('settingsPop');
  // ⭐ 2026-08-26: .appCtx 조건을 뺐다 — 설정 창 생김새를 두 문맥 공통으로 통일하면서
  //   닫기만 밖에서 부드럽고 안에서 뚝 끊기던 것을 맞췄다(여는 쪽은 CSS 가 이미 공통).
  if(p && !p.classList.contains('hide') && typeof _cssMs==='function'){
    clearTimeout(p._closeT); p.classList.add('closing');
    p._closeT=setTimeout(function(){ p.classList.remove('closing'); p.classList.add('hide'); }, _cssMs('--t-swap', .22));
    return; }
  popHide('settingsPop'); }
const PAUSE_MAX=3;
function togglePause(){
  if(!G.paused){   // 일시정지 시도 — 횟수 제한
    if((G.pauseUsed||0)>=PAUSE_MAX){ addChat('','⚠️ 일시정지 횟수를 모두 사용했습니다. (최대 '+PAUSE_MAX+'회)'); updatePauseBtn(); return; }
    G.pauseUsed=(G.pauseUsed||0)+1; G.paused=true;
    const ga=document.getElementById('gameArea'); if(ga) ga.classList.add('gray');   // 무채색(설정 나가도 유지)
    addChat('',(coopActive()?myNick():('플레이어 P'+(G.myPlayer||1)))+'님이 일시정지를 사용하였습니다.');
    _botUnpauseT=5+Math.random()*7;   // 잠시 후 다른 플레이어가 해제할 수 있음
  } else {         // 재개
    G.paused=false; const ga=document.getElementById('gameArea'); if(ga) ga.classList.remove('gray');
    addChat('',(coopActive()?myNick():('플레이어 P'+(G.myPlayer||1)))+'님이 일시정지를 해제하였습니다.');
    _botUnpauseT=0;
  }
  if(coopActive()) coopSend('pause',{paused:G.paused, nick:myNick()});   // 협동: 일시정지 공유
  updatePauseBtn(); }
// 공유 일시정지: 누구나 걸고 누구나 풀 수 있음(다른 플레이어=봇 시뮬)
let _botUnpauseT=0, _botPauseT=30;
function tickPauseSim(dt){
  if(G.phase!=='playing'||G.coop) return;   // 협동: 실제 플레이어가 제어
  const others=(G.activePlayers||[]).filter(n=>n!==(G.myPlayer||1));   // 나 외 입장 플레이어
  if(!others.length) return;   // 혼자면 시뮬 없음
  if(G.paused){   // 일시정지 중 → 잠시 후 다른 플레이어가 해제
    if(_botUnpauseT>0){ _botUnpauseT-=dt; if(_botUnpauseT<=0) botSetPause(false, others); }
  } else {        // 진행 중 → 가끔 다른 플레이어가 일시정지
    _botPauseT-=dt; if(_botPauseT<=0){ _botPauseT=35+Math.random()*55;
      if(Math.random()<0.5) botSetPause(true, others); } }
}
function botSetPause(p, others){
  if(G.paused===p) return;
  const n=others[Math.floor(Math.random()*others.length)];
  G.paused=p; const ga=document.getElementById('gameArea'); if(ga) ga.classList.toggle('gray', p);
  addChat('','ℹ️ 플레이어 P'+n+'가 일시정지를 '+(p?'사용':'해제')+'하였습니다.');
  if(p) _botUnpauseT=5+Math.random()*7;   // 봇이 걸면 잠시 후 누군가 해제
  updatePauseBtn();
}
function updatePauseBtn(){
  const btn=document.getElementById('setPauseBtn'), lbl=document.getElementById('pauseLbl'), ico=btn&&btn.querySelector('.pIco');
  const remain=PAUSE_MAX-(G.pauseUsed||0);
  if(btn){ btn.classList.toggle('paused',G.paused); btn.classList.toggle('disabled', !G.paused && remain<=0); }
  if(lbl) lbl.textContent = G.paused ? '재개' : ('일시정지 ('+remain+'회 남음)');
  if(ico) ico.innerHTML = (G.paused?MSG_ICO['▶']:MSG_ICO['⏸']).d; }
function exitGame(){
  if(typeof closeSettings==='function') closeSettings();   // 설정 팝업 닫기(확인창이 위에 뜨도록)
  // ⚔ 오토배틀도 **나갈 때 통계를 보여 준다**(2026-08-31 · 네모네모와 같은 흐름).
  //   ⛔ 캠프(STK.camp)는 제외 — 캠프는 오토배틀 엔진을 빌려 쓸 뿐이라 판이 끝난 것이 아니다.
  if(G && G.strike){
    if(typeof STK!=='undefined' && STK && STK.camp){ strikeEnd(); return; }
    G.phase='quit'; if(typeof bgmStop==='function') bgmStop();
    if(typeof openResultScreen==='function'){ openResultScreen(); return; }
    strikeEnd(); return; }
  const p=document.getElementById('exitConfirm'); if(p){ p.classList.remove('hide'); if(typeof fxPop==='function') fxPop(p.querySelector('.ecCard')); }   // 진행 중이든 아니든 확인부터
}
function confirmExitGame(){ closeExitConfirm();
  if(G && G.phase==='playing'){
    // ⚠ 일부러 나가는 것은 **끊김과 구분해서** 알린다 — 안 알리면 상대는 AWAY_MS 동안 빈 자리를 잡고 기다린다
    if(typeof coopSend==='function') coopSend('bye', { num:G.myPlayer||1, nick:(typeof myNick==='function')?myNick():'' });
    G.phase='quit';   // 진행 중 = 현재까지의 결과로 종료
    if(G.bossOpen && typeof closeBossArena==='function') closeBossArena();   // showOverlay가 하던 정리(보스 팝업/바/BGM)를 여기서 수행
    if(typeof updateCoopBossBar==='function') updateCoopBossBar();
    if(typeof bgmStop==='function') bgmStop();
    if(typeof openResultScreen==='function'){ openResultScreen(); return; }   // 게임종료 오버레이 확인 단계 생략 → 바로 종합 정보(결과) 화면
    if(typeof showOverlay==='function'){ showOverlay(); return; } return; }   // 폴백(통계 미사용 맵 등)
  location.reload(); }
function closeExitConfirm(){ popHide('exitConfirm'); }
// (setExpand 삭제 — 항목을 제자리에서 펼치던 옛 방식. 지금은 openSetSub 가 하위 팝업으로 연다)
function refreshModelViews(){  /* 3D on/off 시 유닛뽑기·업그레이드 DOM 아이콘 폴백 갱신 */
  try{ if(typeof buildClock==='function') buildClock(); }catch(e){}
  }
function setModel3d(on){ G.opt=G.opt||{sfx:true,bgm:true}; G.opt.model3d=on;
  const fb=document.getElementById('flag-m3d'); if(fb) fb.textContent=on?'ON':'OFF';
  const cv=document.getElementById('cvMarine'); if(cv && !on) cv.style.display='none';   /* 켜기는 렌더 루프가 탭에 맞춰 처리 */
  refreshModelViews(); }
function segOn(id,val){ const c=document.getElementById(id); if(!c) return; c.querySelectorAll('.segBtn').forEach(b=>b.classList.toggle('on', b.dataset.v===val||b.dataset.q===val)); }
function applyVideo(){ G.opt=G.opt||{sfx:true,bgm:true};   // 그래픽 품질 = 절전/고화질 2단계(기본 고화질)
  const q=(G.opt.quality==='saver')?'saver':'high';
  segOn('seg-q', q);
  const qh=document.getElementById('qHint'); if(qh){
    qh.textContent = q==='saver' ? '절전모드 — 오토배틀 전장만 해상도·이펙트를 낮춰 배터리 절약'
      : '고화질 — 오토배틀 전장을 더 선명하게(건설지·다른 화면엔 영향 없음)';
    qh.classList.toggle('save', q==='saver'); }
  // ⚠ 기본값 판정을 fxLevel()과 맞춰야 한다. 예전엔 여기서만 `G.opt.fx!=='full'`로 봐서
  //    fx가 아직 없는 새 프로필이면 설정을 한 번 여는 것만으로 body.lite(그림자·블러 전부 제거)가
  //    켜졌다 — 화면엔 '고화질'이라고 떠 있는데 이펙트만 사라지는 상태였다.
  document.body.classList.toggle('lite', fxLevel()!=='full'); }
function setQuality(q){ G.opt=G.opt||{sfx:true,bgm:true}; q=(q==='saver')?'saver':'high'; G.opt.quality=q;
  // 해상도(전장 렌더 배율)는 setup·M3D.sync가 quality로 직접 계산 — 여기선 이펙트/모델만 일괄 적용
  if(q==='saver'){ G.opt.model3d=true; G.opt.fx='min'; G.opt.fps=60; G.opt.lite3d=true; }
  else           { G.opt.model3d=true; G.opt.fx='full'; G.opt.fps=0;  G.opt.lite3d=false; }
  setModel3d(G.opt.model3d); applyVideo(); }
function _bgmApplyVol(){ if(_bgm.audio) _bgm.audio.volume=_bgmVol(); }   // 현재 재생 중 BGM에 즉시 반영
// 스위치 하나가 상태 전부다 — 볼륨 슬라이더는 폐기했다(SND.bgm/SND.sfx 값은 기준 볼륨으로 계속 쓴다).
function _sndPaintBar(k){ const fb=document.getElementById('flag-'+k);
  if(fb) fb.classList.toggle('on', SND[k+'On']!==false); }
// 켜기/끄기 토글
function toggleSnd(key){ SND[key+'On']=!SND[key+'On']; _sndSave();
  if(key==='bgm') _bgmApplyVol();
  if(key==='chat') _chatApplyShow();
  if(key==='wake') wakeApply();
  _sndPaintBar(key); }
// ── 햅틱 — UI 탭에 짧은 진동. 소리와 **독립**이다(음소거 중에도 진동은 남는다) ──
//   ⚠ playSfx 안쪽이 아니라 맨 앞에서 부른다 — 볼륨 0이면 playSfx 가 곧바로 return 하기 때문.
function hapt(ms){ if(SND.vibOn===false) return;
  try{ if(navigator.vibrate) navigator.vibrate(ms||9); }catch(e){} }
// ── 화면 항상 켜기(Wake Lock) ──
//   ⚠ 잠금은 탭이 숨으면 브라우저가 **자동으로 푼다** — 돌아왔을 때 다시 잡아 줘야 켜 둔 것이 유지된다.
//   ⚠ 지원하지 않는 브라우저에서는 스위치 줄 자체를 감춘다(꺼도 켜도 아무 일 없는 스위치를 두지 않는다).
let _wakeLock=null;
function wakeSupported(){ try{ return !!(navigator.wakeLock && navigator.wakeLock.request); }catch(e){ return false; } }
async function wakeApply(){
  if(!wakeSupported()) return;
  if(SND.wakeOn===false || !SND.wakeOn){ if(_wakeLock){ try{ await _wakeLock.release(); }catch(e){} _wakeLock=null; } return; }
  if(_wakeLock) return;
  try{ _wakeLock=await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', function(){ _wakeLock=null; }); }
  catch(e){ _wakeLock=null; console.warn('wakeLock', e.message||e); } }
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible') wakeApply(); });
// 채팅 끄기 = 플레이어 채팅·입력창·로비 채팅만 감춘다.
//   시스템 알림(.cmsg.sys)은 뽑기 결과·패배 경고를 나르므로 끄지 않는다.
function _chatApplyShow(){ if(document.body) document.body.classList.toggle('chatOff', SND.chatOn===false); }
// 열 때 SND 값으로 스위치 3개 동기화
function syncSndUI(){ ['sfx','bgm','chat','vib','wake'].forEach(_sndPaintBar);
  const wr=document.getElementById('qrow-wake'); if(wr) wr.style.display=wakeSupported()?'':'none'; }
// ── 채팅(메인-하단 사이) — 로컬 입력 + 다른 플레이어 가짜 메시지(임시) ──
function escHtml(s){ return String(s).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); }
let _lastSysMsg='', _lastSysT=-1e9;   // 시스템 알림 중복 억제 상태(toast·addChat 공통)
// 시스템 메시지 앞 이모지 → 아이콘으로 교체(호출부는 그대로 두고 렌더에서 한 번에 처리)
function _msgIco(t){ const s=String(t||'');
  for(const k in MSG_ICO){ if(s.indexOf(k)===0) return { ico:MSG_ICO[k].d, rest:s.slice(k.length).replace(/^\s+/,'') }; }
  const s2=s.replace(/^([⚠⛔✅✓])️?\s*/, '');   // 변이형(⚠/⛔ 등 VS16 없는 형태)
  if(s2!==s){ const k=s.charAt(0); const hit=MSG_ICO[k]||MSG_ICO[k+'️']; if(hit) return { ico:hit.d, rest:s2 }; }
  return { ico:'', rest:s }; }
function addChat(sender, text, color, silent){ const box=document.getElementById('chatLog'); if(!box) return;
  if(sender===''){ const _n=(typeof performance!=='undefined'&&performance.now)?performance.now():0; const _k=(text||'').replace(/^▸\s*/,''); if(_k===_lastSysMsg && _n-_lastSysT<2000) return; _lastSysMsg=_k; _lastSysT=_n; }   // 같은 시스템 알림 2초 내 1회(중복·협동 에코 억제)
  if(!silent && typeof playNotify==='function') playNotify();   // 채팅·배속·일시정지 알람음(자원 토스트는 silent로 무음)
  const d=document.createElement('div'); d.className='cmsg'+(sender?'':' sys');
  const _mi=sender?{ico:'',rest:text}:_msgIco(text);   // 시스템 메시지 앞 이모지 → 라인 아이콘
  d.innerHTML = sender ? '<b style="color:'+(color||'#7fc8ff')+'">'+escHtml(sender)+'</b> '+escHtml(text)
                       : _mi.ico+escHtml(_mi.rest);   // 시스템 알림 = 색 통일(.cmsg.sys) · 강조는 아이콘 색으로만
  box.appendChild(d); while(box.children.length>6) box.removeChild(box.firstChild);
  setTimeout(()=>{ d.classList.add('fade'); setTimeout(()=>{ if(d.parentNode) d.remove(); }, 900); }, 6000); }  // 일정시간 후 페이드 아웃
function sendChat(){ const f=document.getElementById('chatField'); const t=(f.value||'').trim(); if(!t) return;
  const col=PLAYER_VIEW_COLORS[((G.myPlayer||1)-1)%PLAYER_VIEW_COLORS.length];
  addChat(myNick(), t, col); if(coopActive()) coopSend('gchat',{nick:myNick(), text:t, color:col});   // 협동: 채팅 공유
  f.value=''; f.focus(); }
function tickFakeChat(dt){ }   // 가짜 채팅 제거(실제 채팅만 사용)
// ── 채팅바 접기/펴기 ──────────────────────────────────────────────────────────
// 평소엔 말풍선 아이콘만 떠 전장을 덜 가린다. 누르면 [∨ | 입력 | 전송] 이 열린다.
// ⚠ 왼쪽 ∨ 가 **열려도 남는 것**이 이 설계의 핵심이다 — 접는 법을 따로 배울 필요가 없다.
// 접히는 계기는 셋: ∨ 를 다시 누름 · Esc · 전장(바깥)을 눌러 입력칸이 포커스를 잃음.
// 전송은 접지 않는다(연달아 치는 게 보통이다) — sendChat 이 입력칸에 포커스를 되돌린다.
let _chatHold=0;   // 채팅바 안을 마지막으로 누른 시각 — 전송 탭이 만드는 blur 를 '바깥 탭'으로 오해하지 않게 한다
function chatIsFold(){ const b=document.getElementById('chatBar'); return !b || b.classList.contains('fold'); }
function chatOpenBar(){ const b=document.getElementById('chatBar'); if(!b || !b.classList.contains('fold')) return;
  b.classList.remove('fold'); const f=document.getElementById('chatField'); if(f) setTimeout(()=>f.focus(),60); }   // 폭 전환이 시작된 뒤 포커스(모바일 키보드가 접힌 칸을 잡지 않게)
function chatFoldBar(){ const b=document.getElementById('chatBar'); if(!b || b.classList.contains('fold')) return;
  b.classList.add('fold'); const f=document.getElementById('chatField'); if(f) f.blur(); }                          // 입력 중이던 글은 남긴다 — 다시 열면 이어 쓴다
function chatToggle(){ chatIsFold() ? chatOpenBar() : chatFoldBar(); }
function initChat(){ const f=document.getElementById('chatField'), b=document.getElementById('chatBar');
  if(f) f.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); sendChat(); }
                                          else if(e.key==='Escape'){ e.preventDefault(); chatFoldBar(); } });
  if(b) b.addEventListener('pointerdown',()=>{ _chatHold=Date.now(); },true);
  if(f) f.addEventListener('blur',()=>{ setTimeout(()=>{ if(Date.now()-_chatHold>400) chatFoldBar(); },160); }); }

// ── 토스트 ──
// 스타크래프트식: 알림을 팝업 대신 채팅에 시스템 메시지로 표시(같은 메시지 연속 도배는 억제)
function toast(msg){ if(!msg) return; addChat('', msg, null, true); }   // 시스템 토스트 — 중복 억제는 addChat(시스템 메시지)에서 공통 처리
// 채팅 안 쓰는 플로팅 알림(화면 하단 중앙에 잠깐 떴다 사라짐)
// 적 누적 경고(150/190기) — 임계 통과 시 1회만, 히스테리시스로 도배 방지
function checkEnemyWarn(n){
  if(n>=WARN2){ if(!G._w2){ G._w2=true; addChat('', '⚠️ 적 '+WARN2+'기 누적! 곧 탈락합니다 ('+n+'/'+mapCfg('loseCount',LOSE_COUNT)+')'); if(typeof playSfx==='function') playSfx('warn'); } } else if(n<WARN2-8) G._w2=false;
  if(n>=WARN1){ if(!G._w1){ G._w1=true; addChat('', '⚠️ 적 '+WARN1+'기 누적! 위험 ('+n+'/'+mapCfg('loseCount',LOSE_COUNT)+')'); if(typeof playSfx==='function') playSfx('warn'); } } else if(n<WARN1-8) G._w1=false;
}

// ── 오버레이 ──
// 게임 플레이 중에만 하단 콘솔(#bot)을 노출. 타이틀/방찾기/로비 등 메뉴 화면에서는 숨김.
function setInGame(on){ const p=document.getElementById('phone'); if(p) p.classList.toggle('inGame', !!on); if(on && typeof navShow==='function') navShow(null); document.body.classList.toggle('sheetOpen', !!on); if(typeof _syncSheetLift==='function') requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); }   // 게임 진입 = 하단 시트 기본 오픈(시작 탭 메인)
// 하단 시트가 밀어 올리는 높이. ⚠ 구역마다 **시트가 다른 요소다** — 보통은 `.bp.on`,
// 건설 구역은 `#btSheet`(bottom:0 · z-index 30). 둘을 갈라 재지 않으면 건설에서 채팅바가 시트 밑에 깔린다.
function _syncSheetLift(){ const B=document.body, ph=document.getElementById('phone');
  if(B.classList.contains('cstMode')){                                   // 🏗 건설 구역
    if(ph && ph.classList.contains('campMode')){ document.documentElement.style.setProperty('--sheetH','0px'); return; }   // 캠프는 채팅이 없다
    const bs=document.getElementById('btSheet');
    const h=(bs && bs.classList.contains('open')) ? (bs.offsetHeight||0) : 0;
    document.documentElement.style.setProperty('--sheetH', h+'px'); return; }
  const open=B.classList.contains('sheetOpen');
  if(open){ const p=document.querySelector('.bp.on'); const h=p?(p.offsetHeight||0):0; if(h<20) return;   // 리렌더 중 순간 높이 0/저값 무시(사이드 배너 깜빡임 방지) — 이전 값 유지
    document.documentElement.style.setProperty('--sheetH', h+'px'); }
  else document.documentElement.style.setProperty('--sheetH', '0px'); }   // 닫힘 = 0(사이드 배너 원위치)
function closeSheet(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); document.body.classList.remove('sheetOpen'); _syncSheetLift(); }   // 빈-탭 → 하단 시트 닫힘
// 이번 판 획득 요약 1회 계산(해금 감지 포함)
function _runSummary(){ if(G._runSum) return G._runSum;
  // 📅 일일 — 유즈맵 1판 종료. 이 함수는 판당 1회만 계산되므로 여기가 유일한 계측 지점이다(중도 나가기는 제외).
  if(typeof dqNote==='function' && G.phase!=='quit'){ dqNote('umRun',1); if(G.phase==='won') dqNote('umWin',1); }
  if(G.strike){ const S=(typeof STK!=='undefined'&&STK)?STK:{}, me=S.me||{};   // 직스: 라운드·코인 대신 결과·처치·플레이타임
    G._runSum={ strike:true, result:(G.phase==='won')?'win':'lose', kills:(me.kills||0), time:(S.t||0), gold:Math.floor(me.gold||0) }; }
  else {
    const hadDiff=(typeof PLAYER_META!=='undefined'&&PLAYER_META.clearedDifficulty)||'';
    const hadInf=(typeof infiniteUnlocked==='function')&&infiniteUnlocked();
    recordRunResult();
    const nowDiff=(typeof PLAYER_META!=='undefined'&&PLAYER_META.clearedDifficulty)||'';
    const nowInf=(typeof infiniteUnlocked==='function')&&infiniteUnlocked();
    let nextName=''; if(nowDiff!==hadDiff){ const nx=DIFF_RANK[DIFF_RANK.indexOf(nowDiff)+1]; if(nx&&DIFFICULTY[nx]) nextName=DIFFICULTY[nx].name; }
    G._runSum={ coins:bankRunPoints(), kills:G.kills||0, round:G.round, time:G.timeSec, newDiff:nextName, infNew:(!hadInf&&nowInf) };
  }
  // ⚠ 보상 지급은 두 갈래가 **끝난 뒤 한 곳**에서 한다. 예전엔 직스 분기가 먼저 return 해서
  //   오토배틀이 앵커 보상을 통째로 못 받았다(umProgress 의 직스 분기가 죽은 코드였다).
  if(G.strike) G._runSum.coins=bankRunPoints();   // ◎ 포인트는 맵을 가리지 않는다(네모는 위 분기에서 이미 적립)
  G._runSum.prof=(typeof profRunReward==='function')?profRunReward():null;   // 🧍 사냥터 재화 = 유즈맵 앵커 보상
  // 🏁 첫 클리어 마일스톤 — 이겼을 때만, 맵×난이도마다 평생 1회. 무한모드는 클리어가 없어 제외.
  if(G.phase==='won' && !mapCfg('infinite') && typeof umFirstClaim==='function')
    G._runSum.first=umFirstClaim(MAP&&MAP.id, G.strike?UM_STK_FIRST:G.difficulty);
  return G._runSum; }
function fmtTime(sec){ sec=Math.max(0,Math.floor(sec||0)); const m=Math.floor(sec/60), s=sec%60; return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
function _ovBtnTx(btn,txt){ const t=btn&&btn.querySelector('.ovBtnTx'); if(t) t.textContent=txt; }   // 라벨만 교체(진행 바 유지)
// ══════════════════════════════════════════════════════════════
//  종료 결과 화면(승/패/나감) — 게임 **진입** 화면(#gsRoot)의 짝
//  ⛔ 시작 안내(.ovCard)와 섞지 말 것. 같은 #ov 안에 있지만 다른 화면이다.
//  ⚠ 버튼은 새로 만들지 않는다 — #ovBtns 를 rsBtnHost 로 **옮겨** 쓴다(핸들러·자동 진행 바가 그대로 산다).
// ══════════════════════════════════════════════════════════════
let _rsTimers=[], _rsRaf=[], _rsAnimating=false;
function _rsClearAnim(){ _rsTimers.forEach(clearTimeout); _rsTimers=[];
  _rsRaf.forEach(id=>cancelAnimationFrame(id)); _rsRaf=[]; _rsAnimating=false; }
// 목표값 심기 — ⚠ **애니메이션이 시작될 때가 아니라 화면을 세울 때** 심는다.
//   아직 차례가 안 온 줄도 목표를 알고 있어야 건너뛰기(rsSkip)가 그 값으로 바로 갈 수 있다
//   (안 그러면 아직 안 센 재화가 「+0」 으로 굳는다 — 실제로 그랬다).
function _rsAim(el, to, pre){ if(!el) return; pre=pre||'';
  el.dataset.to=String(to||0); el.dataset.pre=pre; el.textContent=pre+fmtCur(0); }
// 숫자 세어 올리기 — 1 에서 data-to 까지.
function _rsCount(el, ms){ if(!el) return;
  const to=+el.dataset.to||0, pre=el.dataset.pre||'';
  if(to<=0){ el.textContent=pre+fmtCur(0); return; }
  const t0=(typeof performance!=='undefined'?performance.now():Date.now());
  const step=()=>{ const now=(typeof performance!=='undefined'?performance.now():Date.now());
    const k=Math.min(1,(now-t0)/ms), e=1-Math.pow(1-k,3);          // easeOutCubic — 빠르게 붙고 부드럽게 멎는다
    el.textContent=pre+fmtCur(Math.max(1,Math.round(to*e)));
    if(k<1) _rsRaf.push(requestAnimationFrame(step)); };
  _rsRaf.push(requestAnimationFrame(step)); }
function _rsSettle(){ document.querySelectorAll('#rsCard [data-to]').forEach(el=>{
  el.textContent=(el.dataset.pre||'')+fmtCur(+el.dataset.to||0); }); }
// 화면을 한 번 누르면 애니메이션을 건너뛰고 즉시 최종값으로 간다
function rsSkip(){ if(!_rsAnimating) return false;
  _rsClearAnim(); _rsSettle();
  const ov=document.getElementById('ov'); if(ov) ov.classList.add('rsDone');
  document.querySelectorAll('#rsCard .rsAnim').forEach(e=>e.classList.add('on'));
  _rsShowBtns(); return true; }
// 버튼 옮기기 — ⚠ **화면을 세울 때** 옮긴다. 마지막에 옮기면 그때 자리가 생겨 위 내용이 밀린다(실제로 그랬다).
//   보이는 것만 마지막에 한다(.rsAnim → .on).
function _rsMountBtns(){ const host=document.getElementById('rsBtnHost'), btns=document.getElementById('ovBtns');
  if(host&&btns&&btns.parentNode!==host) host.appendChild(btns); }
function _rsShowBtns(){ _rsMountBtns();
  const h=document.getElementById('rsBtnHost'); if(h) h.classList.add('on');
  if(typeof _ovStartAuto==='function') _ovStartAuto(); }   // 자동 진행은 **애니메이션이 끝난 뒤에** 센다
function _rsRow(label,val,cls){ return '<div class="rsRow rsAnim'+(cls?' '+cls:'')+'"><b>'+escHtml(label)+'</b>'
  +'<em>'+val+'</em></div>'; }
function _rsCur(k,ko,id){ return '<div class="rsCurC rsAnim"><span class="rsCurI">'
  +((typeof resIco==='function')?resIco(ko):'')+'</span><span class="rsCurL">'+ko+'</span>'
  +'<b class="rsCurV" id="'+id+'">+0</b></div>'; }
// 결과 화면을 세우고 등장 애니메이션을 돌린다. kind: 'won' | 'lost' | 'quit'
function rsShow(kind){ const ov=document.getElementById('ov'); if(!ov) return;
  _rsClearAnim(); _ovClearAuto();
  const S=_runSummary(), inf=mapCfg('infinite'), won=(kind==='won'), quit=(kind==='quit');
  ov.classList.add('rsOn'); ov.classList.remove('rsDone','win','lose');
  if(won&&!quit) ov.classList.add('win'); else if(!won&&!quit&&!inf) ov.classList.add('lose');
  const tt=document.getElementById('rsTtl');
  tt.textContent = inf?'기록 종료':(won?'VICTORY':(quit?'게임 종료':'DEFEAT'));
  // 메타 한 줄 — 난이도 배지 + 맵 이름 + 플레이 시간(진입 화면의 머리줄과 같은 구성)
  const D=(typeof DIFFICULTY!=='undefined'&&DIFFICULTY[G.difficulty])||null;
  document.getElementById('rsMeta').innerHTML=
    (D?'<span class="rsDiff">'+escHtml(D.name)+'</span>':'')
    +escHtml((MAP&&MAP.name)||'')+' · '+fmtTime(S.time||G.timeSec||0);
  // 게임 안에서 벌어진 것 + 게임 내 포인트
  //   ⚠ 값은 전부 이미 있는 것만 쓴다(_runSummary / G). 없는 값을 지어내지 말 것.
  const rounds=inf?String(G.round||0):((G.round||0)+' / '+mapCfg('rounds',TOTAL_ROUNDS));
  // ⚔ 오토배틀은 라운드·포인트가 없다 — 승패와 최종 자원으로 읽는다(옛 #resultScreen 의 직스 분기와 같은 줄).
  let rows = (G.strike)
    ? (_rsRow('결과', quit?'중도 종료':(won?'승리':'패배'))   // ⚠ 나가기는 승패가 아니다 — '패배'로 적으면 이긴 판도 진 것처럼 읽힌다
     + _rsRow('처치','<span data-cnt="kills">0</span>')
     + _rsRow('최종 자원', fmtCur(S.gold||0),'hi'))
    : (_rsRow('라운드', rounds)
     + _rsRow('처치','<span data-cnt="kills">0</span>')
     + _rsRow('획득 포인트','<span data-cnt="coins">0</span>','hi'));
  if(S.prof) rows+=_rsRow('내 캐릭터 XP','<span data-cnt="xp">0</span>'+(S.prof.ups?(' · Lv.'+S.prof.level):''));
  // 📋 아래 줄들은 **옛 통계 화면(#resultScreen)이 갖고 있던 것**이다 — 화면을 한 장으로 합치면서
  //   여기로 옮겼다(2026-08-31). ⛔ 다시 두 화면으로 가르지 말 것: 같은 값을 두 번 보여 주게 된다.
  if(S.newDiff) rows+=_rsRow('난이도 해금', escHtml(S.newDiff),'hi');
  if(S.infNew)  rows+=_rsRow('모드 해금','무한 모드','hi');
  if(!G.strike) rows+=_rsRow('보유 포인트','◎ '+(((typeof PLAYER_META!=='undefined')&&PLAYER_META.coins)||0));
  if(S.prof && S.prof.dayMul<1)
    rows+=_rsRow('오늘 '+S.prof.day+'판째','보상 '+Math.round(S.prof.dayMul*100)+'% — 하루 '+UM_DAY_FULL+'판까지 전액');
  if(S.first){ const f=S.first,
      tk=[['gear','장비'],['pet','펫'],['ally','동료']].filter(t=>f[t[0]]).map(t=>t[1]+' ×'+f[t[0]]).join(' · ');
    rows+=_rsRow('🏁 첫 클리어', fmtCur(f.pcoin)+' M · '+fmtCur(f.gas)+' G','hi')
        + _rsRow('첫 클리어 보너스','💎 '+f.gem+(tk?(' · '+tk):''),'hi'); }
  document.getElementById('rsRows').innerHTML=rows;
  document.getElementById('rsCur').innerHTML=_rsCur('min','미네랄','rsCurMin')+_rsCur('gas','가스','rsCurGas');
  if(typeof paintIcons==='function') paintIcons(document.getElementById('rsCard'));
  // ── 등장 순서 ──
  const el=q=>document.getElementById('rsCard').querySelector(q);
  const seq=[]; let t=0;
  seq.push([t, ()=>tt.classList.add('on')]);                       t+=170;
  seq.push([t, ()=>document.getElementById('rsMeta').classList.add('on')]); t+=150;
  const rowEls=[...document.querySelectorAll('#rsRows .rsRow')];
  const cs0=[...document.querySelectorAll('#rsCur .rsCurC')];
  rowEls.forEach(r=>{ const k=r.querySelector('[data-cnt]'); if(!k) return;
    const n=k.dataset.cnt;
    _rsAim(k, (n==='kills')?(S.kills||0):(n==='coins')?(S.coins||0):(S.prof?S.prof.xp:0), (n==='kills')?'':'+'); });
  cs0.forEach((c,ix)=>_rsAim(c.querySelector('.rsCurV'),
    (ix===0)?((S.prof&&S.prof.pc)||0):((S.prof&&S.prof.gas)||0), '+'));
  rowEls.forEach(r=>{ seq.push([t, ()=>{ r.classList.add('on');
      _rsCount(r.querySelector('[data-cnt]'), 420); }]); t+=95; });
  t+=140;
  cs0.forEach(c=>{ seq.push([t, ()=>{ c.classList.add('on');
      _rsCount(c.querySelector('.rsCurV'), 680); }]); t+=130; });
  t+=560;   // 마지막 재화가 다 세어질 때까지 기다렸다가 버튼
  seq.push([t, ()=>{ _rsAnimating=false; _rsShowBtns(); }]);
  [...document.querySelectorAll('#rsCard .rsAnim')].forEach(e=>e.classList.remove('on'));
  _rsMountBtns();
  const host=document.getElementById('rsBtnHost'); if(host) host.classList.remove('on');
  _rsAnimating=true;
  seq.forEach(([ms,fn])=>_rsTimers.push(setTimeout(fn, ms)));
}
function rsHide(){ const ov=document.getElementById('ov'); if(!ov) return;
  _rsClearAnim(); ov.classList.remove('rsOn','rsDone','win','lose');
  const btns=document.getElementById('ovBtns'), card=ov.querySelector('.ovCard');
  if(btns&&card&&btns.parentNode!==card) card.appendChild(btns); }   // 버튼을 시작 안내 카드로 돌려놓는다
function showOverlay(){ const ov=document.getElementById('ov'),tt=document.getElementById('ovTitle'),dd=document.getElementById('ovDesc'),bt=document.getElementById('ovBtn');
  const bt2=document.getElementById('ovBtn2');
  if(G.bossOpen && typeof closeBossArena==='function') closeBossArena();   // 게임 종료 → 보스 팝업 닫기
  if(typeof updateCoopBossBar==='function') updateCoopBossBar();   // 게임 종료 → 보스 바 숨김
  if((G.phase==='won'||G.phase==='lost'||G.phase==='quit') && typeof bgmStop==='function') bgmStop();   // 게임 종료 → 인게임 BGM 정지
  ov.classList.remove('hide');
  { const ac=(typeof MAP_ACCENT!=='undefined'&&MAP&&MAP_ACCENT[MAP.id])||'#7f93b0'; ov.style.setProperty('--mapAccent', ac); }   // 카드 강조색 = 맵 아이덴티티(팝업·시작 화면과 통일)
  if(G.phase==='ready'){   // 시작 안내 = 메뉴 화면(자체 우주 배경)
    rsHide();   // 결과 화면을 걷고 버튼을 시작 안내 카드로 돌려놓는다
    ov.classList.add('spaceBg'); setInGame(false);
    tt.textContent=MAP.name; tt.style.color='';
    dd.style.display=''; dd.textContent=MAP.desc+'.\n유닛 구매 → 배치 → 합성으로 영웅을 키우고\n'+(mapCfg('infinite')?'끝없이 밀려오는 적을 최대한 오래 막아내세요!':(mapCfg('rounds',TOTAL_ROUNDS)+'라운드를 클리어!'));
    _ovBtnTx(bt,'멀티플레이'); bt2.style.display='none'; _ovClearAuto();   // 시작 안내엔 자동 진행 없음
    const ovc0=ov.querySelector('.ovCard'); if(ovc0) ovc0.classList.remove('win','lose');
  } else {   // 승/패/종료 = **결과 화면**(판 없는 전면 · 진입 화면의 짝). 확인 → 통계 전체 화면
    ov.classList.remove('spaceBg');   // 자체 배경 제거 → 뒤로 게임이 비침
    const ovc=ov.querySelector('.ovCard'); if(ovc) ovc.classList.remove('win','lose');
    _ovBtnTx(bt,'나가기');                                        // 이 화면이 곧 통계다 — 다음 단계가 없으므로 '확인'이 아니라 '나가기'
                                                                  // ⚠ 자동 진행은 rsShow 가 **애니메이션이 끝난 뒤** 시작한다
    bt2.style.display=''; bt2.textContent='관전하기';              // 확인 옆 = 창을 닫고 최종 전장 보기(멀티는 팀 관전)
    rsShow(G.phase);                                              // 제목 → 기록 줄 → 캠프 재화 순서로 등장 + 수치 카운트업
  }
}
// 통계 화면 = **결과 화면 한 장**(P7안 · #ov + rsShow). 2026-08-31 사용자 확정.
//   ⛔ 통계를 위한 **두 번째 화면을 다시 만들지 말 것.** 옛 창(#resultScreen · ovStatRow ·
//     resultToLobby)은 같은 값을 두 번 보여 주던 구조라 마크업·CSS·함수까지 통째로 지웠다.
//   ⚠ 여기서 화면을 새로 그리지 않는다 — 그리는 곳은 showOverlay() 하나다(단일 소스).
function openResultScreen(){ if(!mapCfg('stats') && !(typeof G!=='undefined'&&G&&G.strike)){ overlayToLobby(); return; }
  if(typeof showOverlay==='function') showOverlay(); else overlayToLobby(); }
function overlayToLobby(){
  if(typeof clearRun==='function') clearRun();   // 판이 끝났다 = 저장본 폐기(끝난 판을 복구하면 안 된다)
  MAP_CFG_OVR=null;   // 로비 복귀 = 방 설정 반납(다음 판에 새면 밸런스가 조용히 어긋난다)
  _ovClearAuto(); document.getElementById('ov').classList.add('hide');   // 로비로 돌아가기(승/패 공통)
  if(typeof G!=='undefined'&&G&&G.strike && typeof STK!=='undefined') STK=null;
  // 🖥 게임 크롬을 여기서 끈다 — **결과 화면이 떠 있는 동안은 켜 둔 채**다(뒤로 전장이 비치는 것이 P7안의 의도).
  //   ⚠ 빠지면 로비로 나가는 순간 전장·하단 탭이 그대로 드러난 채 로딩 막대만 뜬다(실측 프레임으로 확인).
  if(typeof setInGame==='function') setInGame(false);
  // 🧹 잔상 금지 — 3D 는 화면들이 **공유**한다. 돌려줄 때 지우지 않으면 로딩·유즈맵 배경에
  //   이 판의 미네랄·유닛이 그대로 떠 있다(실측 프레임: 로딩 화면에 미네랄 6덩이가 남았다).
  //   ⛔ 숨기지 말고 **지운다** — 숨긴 것은 어딘가에서 다시 켜지면 도로 나타난다.
  //   ⚠ 지우기는 **지운 뒤 한 번 더 그려야** 완성된다 — clearGameModels 는 scene 에서 빼기만 하고
  //     캔버스에는 마지막 프레임이 박제된 채 남는다(js/08-hunt.js 예열 정리와 같은 처방).
  if(window.M3D && M3D.clearGameModels){ try{ M3D.clearGameModels();
    if(M3D.sync) M3D.sync([], 300, 300, .016, [], [], null, null); }catch(e){} }
  if(window.M3D && M3D.clearIdlePools){ try{ M3D.clearIdlePools(); }catch(e){} }
  if(typeof resetGameChrome==='function') resetGameChrome();   // 크롬 원복은 단일 소스로
  if(typeof stopGameCoop==='function') stopGameCoop(); if(typeof rtRoomClose==='function') rtRoomClose();
  // 🎬 결과 화면 → **유즈맵으로 곧장**(2026-08-31 사용자 확정).
  //   ⛔ 로딩 화면을 다시 끼우지 말 것 — 그 화면은 키 아트(#titleBg)와 STAR WAR 로고
  //     (#titleMark)를 켜는데, 그 둘은 화면과 따로 0.42초에 걸쳐 꺼져 유즈맵 목록 위로 비쳤다.
  //     여기서 기다릴 것도 없다 — openMapSelect() 는 동기다(막대는 순전히 연출이었다).
  G=newGame(); openMapSelect(); }
function overlaySpectate(){ _ovClearAuto(); document.getElementById('ov').classList.add('hide'); setInGame(true);   // 관전하기 = 창을 닫고 전장 보기(자동 진행 취소)
  if(typeof coopActive==='function' && coopActive()){ const pt=document.querySelector('.tab[data-tab="Players"]'); if(pt) pt.click(); } }   // 멀티만 팀 관전 탭으로
// ── 결과 화면 → 로비 자동 진행(상호작용 없으면 스스로 넘어감) ──
const OV_AUTO_MS=10000;   // ⚠ 5초였다 — 통계가 이 화면 안으로 들어오며 읽을 양이 늘어 옛 통계 창과 같은 10초로 맞췄다
function _barRun(el, ms, on){ if(!el) return;
  el.classList.remove('run'); el.style.animation='none'; void el.offsetWidth; el.style.animation='';
  if(on){ el.style.setProperty('--autoDur',(ms/1000)+'s'); el.classList.add('run'); } }
let _ovAutoT=null;
function _ovClearAuto(){ if(_ovAutoT){ clearTimeout(_ovAutoT); _ovAutoT=null; } _barRun(document.getElementById('ovAutoBar'),0,false); }
function _ovStartAuto(){ _ovClearAuto(); _barRun(document.getElementById('ovAutoBar'), OV_AUTO_MS, true);
  _ovAutoT=setTimeout(function(){ _ovAutoT=null; _ovConfirm(); }, OV_AUTO_MS); }
// 나가기 = 곧바로 로비. 통계가 이 화면 안으로 들어왔으므로 다음 단계가 없다(2026-08-31).
function _ovConfirm(){ _ovClearAuto(); overlayToLobby(); }
// 결과 화면을 한 번 누르면 등장 애니메이션을 건너뛰고 즉시 최종값으로 간다.
// ⚠ 캡처 단계로 잡지 말 것 — 버튼을 눌렀을 때 버튼이 먼저 동작해야 한다.
document.getElementById('ov').addEventListener('click', function(e){
  if(e.target && e.target.closest && e.target.closest('#ovBtns')) return;   // 버튼은 제 일을 한다
  rsSkip(); });
document.getElementById('ovBtn').onclick=()=>{
  if(G.phase==='ready'){ openRooms(); return; }   // 멀티플레이 → 방 찾기
  _ovConfirm();                                   // 확인 → 통계(또는 로비)
};
document.getElementById('ovBtn2').onclick=()=>{ overlaySpectate(); };   // 관전하기
// ── 방 찾기(룸 리스트) ──
const ROOM_TITLES=['초보만 ㄱㄱ','무한 고수방','1라운드부터','막판러시 ㄱ','즐겜 환영','영웅 키우기','풀방 가즈아','연습 같이해요','고인물 전용','협동 클리어','랭커 모임','쫄?'];
let _roomList=[];
function perfNow(){ return (typeof performance!=='undefined'&&performance.now)?performance.now():(window._rtFake=(window._rtFake||0)+16); }
let _roomsTimer=null;
function startRoomsTick(){ stopRoomsTick(); _roomsTimer=setInterval(tickRooms,1000); }
function stopRoomsTick(){ if(_roomsTimer){ clearInterval(_roomsTimer); _roomsTimer=null; } }
function tickRooms(){ if(!_roomList||document.getElementById('rooms').classList.contains('hide')){ stopRoomsTick(); return; }
  const now=perfNow(); let changed=false;
  for(let i=_roomList.length-1;i>=0;i--){ const r=_roomList[i];   // 게임 시작 10초 뒤 목록에서 제거
    if(r.status==='playing'&&r.gameEndAt&&now>=r.gameEndAt){ _roomList.splice(i,1); changed=true; } }
  const waits=_roomList.filter(r=>r.status==='wait'&&r.cur>=2);   // 대기방 일부가 게임 시작 → 10초 후 사라짐
  if(waits.length&&Math.random()<0.18){ const r=waits[Math.floor(Math.random()*waits.length)]; r.status='playing'; r.round=1; r.gameEndAt=now+10000; changed=true; }
  if(changed){ renderRoomList(); const rc=document.getElementById('roomCount'); if(rc) rc.textContent=_roomList.length; }
}
function openRooms(){ setInGame(false); document.getElementById('ov').classList.add('hide'); document.getElementById('lobby').classList.add('hide');
  if(typeof navShow==='function') navShow(null);   // 전체 화면 = 하단 네비도 덮는다(뒤로는 화면 안 ◀가 맡는다)
  const rm=document.getElementById('rooms'); rm.classList.remove('hide'); if(typeof playScreenFx==='function') playScreenFx(rm);
  _roomFilter='all'; renderRmFilter(); _rmNumClose();   // 진입 시 필터·방번호 줄 초기화
  if(rtRoomsActive()){ rtRoomsEnsure(); rtRoomsSync(); }   // 실제 방 목록(presence) — 시뮬 정지
  else { buildRoomList(); startRoomsTick(); } }
function backToTitle(){ stopRoomsTick(); document.getElementById('rooms').classList.add('hide'); openMapSelect(); }   // 방찾기 뒤로 → 유즈맵 선택

