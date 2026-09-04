/* 99-attic.js — 🗄 다락(휴지통)
 *
 * **지금 화면에서 도달할 수 없는 코드**를 여기로 모은다. 지우지 않는 이유는
 * `GAME_DIRECTION.md` §5 가 「유보는 삭제가 아니다 — 코드와 아트를 지우지 말 것」이라
 * 못박고 있어서다. 되살릴 때의 자산이다.
 *
 * ⭐ 왜 파일을 나눴나 — 살아 있는 코드와 죽은 코드가 한 파일에 섞여 있으면,
 *    다른 작업자가 그 파일을 열었을 때 **어느 쪽이 지금 쓰는 것인지 알 수 없다.**
 *    실제로 옛 화면·옛 디자인이 여러 번 되살아났다. 자리를 갈라 두면 그 혼동이 없다.
 *
 * ⚠ 이 파일은 **맨 마지막에 로드된다.** 아무도 여기 것을 부르지 않으므로 순서가 무의미하고,
 *    거꾸로 여기 것이 살아 있는 코드를 부르는 것은 런타임이라 문제가 없다.
 *    ⛔ 다른 `<script>` 태그의 순서는 건드리지 않았다(전역 하나를 공유하는 구조다).
 *
 * ⛔ 여기 있는 것을 **다시 부르지 말 것.** 되살리려면 `ATTIC.md` 를 먼저 읽고,
 *    그 항목이 왜 잠겼는지 확인한 뒤 원래 파일로 되돌린다. 스모크가 되살아남을 잡는다.
 *
 * 무엇이 왜 여기 있는지는 → `ATTIC.md`
 */

// ── [js/04-profile.js] profBuyItem
function profBuyItem(tierId){ const p=PROF(), T=profItemTier(tierId);
  if(!T.cost || p.pcoin<T.cost) return null;
  if(profItems().length>=PROF_INV_MAX) return null;
  const sl=profSlots(); if(!sl.length) return null;
  const it=profMakeItem(sl[Math.floor(Math.random()*sl.length)], Math.max(1, dgMaxFloor()), tierId);
  if(!profAddItem(it)) return null;
  p.pcoin-=T.cost; saveMeta(); return it; }

// ── [js/04-profile.js] profRebGrant
function profRebGrant(lv){ return profRebGrantAt(lv); }   // 옛 이름 호환(인자가 회차→레벨로 바뀌었다)

// ── [js/04-profile.js] profPetMats
function profPetMats(){ const p=PROF(), out=[];
  for(const id in (p.pets||{})){ if(!PROF_PETS[id]) continue; const d=p.pets[id].dup||0;
    if(d>0) out.push({id:id, dup:d, pt:profPetPt(id)}); }
  return out.sort((a,b)=>b.pt-a.pt); }

// ── [js/04-profile.js] profClaimOffline
function profClaimOffline(){ const p=PROF(), now=Date.now(), last=p.idle.lastClaimTs||p.lastSeenTs||now;
  const mins=Math.max(0, Math.min((now-last)/60000, profOfflineCapMin())), gained=Math.round(profIdleRate()*mins*profOfflineRate());
  p.idle.lastClaimTs=now; p.lastSeenTs=now; if(gained>0){ profGainCoin(gained); saveMeta(); } return gained; }

// ── [js/08-hunt.js] HB_DG_ATK
function HB_DG_ATK(dg){ return hbCurve(HB_ROUND_ATK, dg, 1); }   // 적 공격

// ── [js/08-hunt.js] HB_DG_XP
function HB_DG_XP (dg){ return hbCurve(HB_ROUND_XP , dg, 1); }   // 경험치

// ── [js/08-hunt.js] _mgK
function _mgK(){ return _gearTab==='pet' ? 'pet' : 'ally'; }

// ── [js/08-hunt.js] twApplyChar
function twApplyChar(){ const c=CHAR(), b=document.querySelector('#twAvatar .twAvBody');   // 아바타 겉모습 = 현재 캐릭터 종류
  if(b) b.textContent=(c && PROF_CLASSES[c.cls] && PROF_CLASSES[c.cls].ico) || '🧍'; }

// ── [js/08-hunt.js] profPickSlot
function profPickSlot(slot){ profSlotTap(slot); }        // 예전 이름 유지(외부 호출)

// ── [js/14-input-fx.js] btAdd
function btAdd(sid, gm, name){ if(typeof G==='undefined') return; G.btUnits=G.btUnits||[]; if(G.idSeq==null) G.idSeq=1;
  const n=G.btUnits.filter(u=>u.team!=='foe').length, c=n%4, r=(n/4)|0;   // 아군만 카운트 → 좌측 격자
  const u=initUnitStats({uid:G.idSeq++, id:sid, hero:false, lv:1, x:0.10+c*0.05, y:0.44+r*0.052, cd:0, fixed:false});
  if(gm){ u.gmodel=gm; _btModelStats(u, gm); } u.gname=name;
  if(u.maxEn>0) u.en=Math.min(50,u.maxEn);   // 🔮 마나: 마법 유닛 생산 직후 50(SC) → stepSkills가 자연 회복
  G.btUnits.push(u); if(G.tab==='Battle') G.units=G.btUnits;   // 전투실험 중이면 즉시 전장에 반영
  if(typeof toast==='function') toast(name+' 배치'); }

// ── [js/18-strike.js] strikeWpnTotal
function strikeWpnTotal(){ const S=STK; if(!S||!S.me||!S.me.wpn) return 0;
  return STK_WEAPONS.reduce((n,w)=>n+(S.me.wpn[w.k]||0),0); }

// ── [js/04-profile.js] profUnlockNeed
// 표시용 — 해금에 필요한 레벨(문구에 숫자를 손으로 박지 말 것)
function profUnlockNeed(id){ const u=PROF_UNLOCKS.find(x=>x.id===id); return u? u.lv : 0; }

// ── [js/05-home.js] hbGoRound
// 목록에서 고르기 = 이동 + 시트 닫기
function hbGoRound(n){ hbSetRound(n); renderRoundSheet(); hbCloseRounds(); }

// ── [js/06-daily.js] dqRwTx
function dqRwTx(rw){ if(!rw) return '';
  const t=[]; const ri=function(k,v){ return '<span class="dqRw">'+resIco(k,'dqRi')+fmtCur(v)+'</span>'; };
  if(rw.pcoin) t.push(ri('mineral',rw.pcoin));
  if(rw.gas)   t.push(ri('gas',rw.gas));
  if(rw.gem)   t.push(ri('gem',rw.gem));
  for(const k in DQ_TK) if(rw[k]) t.push('<span class="dqRw">'+resIco('ticket_'+k,'dqRi')+DQ_TK[k]+' ×'+rw[k]+'</span>');   // '뽑기권'은 🎟 이 말한다
  return t.join(''); }

// ── [js/08-hunt.js] hbRoundK
// 옛 이름 — 던전 1 기준. ⛔ 새 코드는 hbCurve 를 쓸 것(던전 기울기를 반영한다).
function hbRoundK(mul,round){ return Math.pow(mul, Math.max(0,(round||1)-1)); }

// ── [js/09-dungeon.js] dgStgHTML
// 단계 배지 — 12단계 / 미개척 / Lv.50 이 같은 자리에서 읽힌다
function dgStgHTML(d, mx){ return '<span class="dgStg">'+(d.reqLvLocked? ('Lv.'+d.reqLv) : (mx? mx+'단계' : '미개척'))+'</span>'; }

// ── [js/12-appshell.js] authIsGuest
// 게스트 → 정식 계정. uid 를 그대로 두고 이메일·비밀번호만 붙이므로 진행도가 따라온다.
function authIsGuest(){ return !!(AUTH.user && AUTH.user.guest); }

// ── [js/12-appshell.js] playerLeave
// 게임 중 플레이어 탈락 → 죽은 자리로(옛 이름 유지 — 호출부가 여럿)
function playerLeave(n){ killSlot(n, 'lost'); }

// ── [js/14-input-fx.js] _btPickerHTML
// ⚔ 아군 배치 피커(전투실험 탭) — 종족별 유닛 버튼. 누르면 전장 좌측 진형에 추가
function _btPickerHTML(addFn){ let html=''; if(typeof SANDBOX_ROSTER==='undefined') return html;
  SANDBOX_RACE_ORDER.forEach(function(race){ const arr=SANDBOX_ROSTER[race]||[]; if(!arr.length) return;
    html+='<div class="btpRaceHead">'+(SANDBOX_RACE_KO[race]||race)+'</div>';
    arr.forEach(function(it){ const disp=it.gm||it.b, sid=((it.gm&&typeof U[it.gm]!=='undefined')?it.gm:it.b);
      html+='<button class="btpCard" onclick="'+addFn+'(\''+sid+'\',\''+(it.gm||'')+'\',\''+it.n+'\')"><span class="btpPic">'+((typeof unitPortraitHTML==='function')?unitPortraitHTML(disp):'')+'</span><span class="btpNm">'+it.n+'</span></button>'; }); });
  return html; }

// ── [js/08-hunt.js] tw3dReady
function tw3dReady(){ return !!(window.M3D && M3D.ready && M3D.ready()
  && !(typeof G!=='undefined' && G.opt && G.opt.model3d===false)); }

// ── [js/08-hunt.js] tw3dAttach
function tw3dAttach(){ const cv=document.getElementById('cvMarine'), host=document.getElementById('twMap');
  if(!cv||!host||_tw3dHome) return;
  if(_hb3dHome && typeof hb3dDetach==='function') hb3dDetach();   // 남이 쓰고 있으면 먼저 돌려받는다
  _tw3dHome=cv3dHome(cv);                                    // 돌려놓을 자리(공용 기억)
  cv.style.zIndex='3';                                       // 바닥·구역 위 · 상단 바 아래
  host.appendChild(cv);
  if(window.M3D && M3D.clearGameModels){ try{ M3D.clearGameModels(); }catch(e){} }
  if(window.M3D && M3D.clearIdlePools){ try{ M3D.clearIdlePools(); }catch(e){} } }   // HOME과 같이 잔상 풀도 삭제

// ── [js/08-hunt.js] tw3dList
function tw3dList(){ const ch=(typeof CHAR==='function')?CHAR():null;
  const mdl=hbCharMdl();   // 내가 고른 캐릭터의 유닛(3D·이펙트와 같은 단일 소스)
  if(!_tw3dU || _tw3dU.id!==mdl) _tw3dU={ uid:'tw1', id:mdl, x:.5, y:.5, face:0, moving:false, fireSeq:0, size:13, hidden:false };
  _tw3dU.x=.5; _tw3dU.y=.5;                                  // 화면 정중앙 고정
  _tw3dU.face=(_twChar.face<0)? -Math.PI/2 : Math.PI/2;      // 좌우 바라보기
  _tw3dU.moving=(_twChar.mode!==null);                        // 걷는 중이면 달리기 모션
  return [_tw3dU]; }

// ── [js/08-hunt.js] tw3dFrame
function tw3dFrame(dt){
  const cv=document.getElementById('cvMarine'), body=document.querySelector('#twAvatar .twAvBody');
  if(!tw3dReady()){ if(body) body.style.display=''; return; }   // 3D 끄면 이모지 아바타로 폴백
  if(!cv) return;
  tw3dAttach(); cv.style.display='block';
  if(body) body.style.display='none';                        // 3D가 나오면 이모지는 숨긴다(둘이 겹치지 않게)
  try{ M3D.sync(tw3dList(), _twVW, _twVH, dt, [], [], null, 1.15); }catch(e){}   // 던전과 같은 호출 규약
}

// ── [js/08-hunt.js] setFriendFilter
function setFriendFilter(fil){ _friendFil=fil;
  renderHubFriendTabs();
  renderFriends(); if(typeof playSfx==='function') playSfx('ui_tab'); }

// ── [js/08-hunt.js] renderFriends
function renderFriends(){ const box=document.getElementById('hubFriends'); if(!box) return; box.innerHTML='';
  let on=0; HUB_FRIENDS.forEach(f=>{ if(f.status!=='offline') on++; });
  const list=HUB_FRIENDS.filter(_friendMatch);
  if(!list.length){ box.innerHTML = HUB_FRIENDS.length
    ? '<div class="hsEmpty">이 조건에 맞는 친구가 없어요.<br><span class="hsEmptySub">다른 탭을 눌러 보세요.</span></div>'
    : '<div class="hsEmpty">아직 친구가 없어요.<br><span class="hsEmptySub">같이 플레이한 사람을 친구로 추가하면<br>여기에서 바로 초대할 수 있어요.</span></div>'; }
  else list.forEach(f=>{ const i=HUB_FRIENDS.indexOf(f);
    const el=document.createElement('div'); el.className='frRow'+(f.status==='offline'?' off':'');
    el.innerHTML='<span class="frAv">'+f.av+'<i class="frDot '+f.status+'"></i></span>'
      +'<span class="frMain"><span class="frName">'+escHtml(f.name)+(f.close?'<span class="frFav">★</span>':'')+'</span><span class="frAct">'+_frActHTML(f)+'</span></span>'
      +'<span class="frChat">'+_FR_CHAT_SVG+'</span>';
    el.onclick=()=>openDM(i); box.appendChild(el); });
  const c=document.getElementById('hubFriendOn'); if(c) c.textContent=on; }

// ── [js/08-hunt.js] renderHubFriendTabs
function renderHubFriendTabs(){ const box=document.getElementById('hubFriendTabs'); if(!box) return;
  const i=Math.max(0, HUB_FRIEND_FILS.findIndex(f=>f[0]===_friendFil));
  box.innerHTML=segNavHTML(HUB_FRIEND_FILS.map(function(f){ return { label:f[1] }; }), i,
    function(k){ return "setFriendFilter('"+HUB_FRIEND_FILS[k][0]+"')"; }); }

// ── [js/08-hunt.js] _friendMatch
function _friendMatch(f){ if(_friendFil==='all') return true; if(_friendFil==='close') return !!f.close; return (f.act&&f.act.type===_friendFil); }

// ── [js/08-hunt.js] _ptFmt
function _ptFmt(m){ m=Math.max(0,Math.round(m||0)); if(m<60) return m+'분'; const h=Math.floor(m/60), mm=m%60; return h+'시간'+(mm?' '+mm+'분':''); }

// ── [js/08-hunt.js] _frActHTML
function _frActHTML(f){ const a=f.act||{};
  if(f.status==='offline') return '<span class="frActTx">'+escHtml(a.label||'오프라인')+'</span>';
  const badge=a.type==='rpg'?'<span class="frBadge rpg">RPG</span>':'<span class="frBadge usemap">USEMAP</span>';
  if(f.status==='away'){   // 온라인이지만 게임 내 5분+ 무터치 → 게임 표기 + 오른쪽에 (자리비움 - N분)
    let pre=''; if(a.type==='usemap') pre=(a.map?a.map+' ':'')+'플레이 중 '; else if(a.map) pre=a.map+' ';
    return badge+'<span class="frActTx">'+escHtml(pre)+'<span class="frAway">(자리비움 - '+(a.idle||5)+'분)</span></span>'; }
  if(a.type==='rpg')       // RPG = 플레이타임만 표기
    return badge+'<span class="frActTx">'+(a.pt?escHtml('('+_ptFmt(a.pt)+')'):'플레이 중')+'</span>';
  const body=escHtml((a.map?a.map+' ':'')+'플레이 중');   // USEMAP = 게임명 + '플레이 중'(통일)
  const pt=a.pt?' <span class="frPt">('+_ptFmt(a.pt)+')</span>':'';   // 플레이타임 괄호
  return badge+'<span class="frActTx">'+body+pt+'</span>'; }

// ── [js/08-hunt.js] openDM
function openDM(i){ const f=HUB_FRIENDS[i]; if(!f) return; _dmFriend=i;
  const nm=document.getElementById('dmName'); if(nm) nm.textContent=f.name;
  const av=document.getElementById('dmAv'); if(av) av.innerHTML=f.av+'<i class="dmStat '+f.status+'" id="dmStat"></i>';
  const st=document.getElementById('dmStTx'); if(st) st.textContent=(f.status==='active'?'온라인':(f.status==='away'?'자리 비움':'오프라인'));
  if(!_dmMsgs[i]) _dmMsgs[i]=_seedDM(f);
  renderDM();
  const el=document.getElementById('dmChat'); if(el) el.classList.remove('hide');
  if(typeof playSfx==='function') playSfx('ui_open'); }

// ── [js/08-hunt.js] closeDM
function closeDM(){ const el=document.getElementById('dmChat'); if(el) el.classList.add('hide'); if(typeof playSfx==='function') playSfx('ui_tab'); }

// ── [js/08-hunt.js] renderDM
function renderDM(){ const body=document.getElementById('dmBody'); if(!body) return; const msgs=_dmMsgs[_dmFriend]||[];
  body.innerHTML=msgs.map(m=> m.sys ? ('<div class="dmSys">'+escHtml(m.t)+'</div>') : ('<div class="dmMsg '+(m.me?'me':'them')+'">'+escHtml(m.t)+'</div>')).join('');
  body.scrollTop=body.scrollHeight; }

// ── [js/08-hunt.js] sendDM
function sendDM(){ const inp=document.getElementById('dmInput'); if(!inp||_dmFriend<0) return; const t=inp.value.trim(); if(!t) return;
  const f=HUB_FRIENDS[_dmFriend], msgs=_dmMsgs[_dmFriend]||(_dmMsgs[_dmFriend]=[]);
  msgs.push({me:1,t}); inp.value=''; renderDM();
  if(f && f.status!=='offline'){ setTimeout(()=>{ if(_dmFriend<0) return; msgs.push({me:0,t:_DM_REPLIES[(Math.random()*_DM_REPLIES.length)|0]}); renderDM(); }, 650+Math.random()*700); } }

// ── [js/08-hunt.js] _seedDM
function _seedDM(f){ if(f.status==='offline') return [{sys:1,t:'오프라인 상태예요. 보낸 메시지는 접속하면 전달돼요.'}];
  const a=f.act||{};
  if(f.status==='away') return [{sys:1,t:(a.map?a.map+'에서 ':'')+(a.idle||5)+'분간 조작이 없어 자리비움 상태예요.'}];
  let g='안녕! 뭐해?';
  if(a.type==='usemap') g='지금 '+(a.map||'유즈맵')+' 하는 중! 같이 할래?';
  else if(a.type==='rpg') g='마을에서 캐릭터 키우는 중이야 ㅎㅎ';
  return [{me:0,t:g}]; }

// ── [js/08-hunt.js] townState
function townState(){ const p=PROF(); if(!p.town) p.town={ built:[] }; return p.town; }   // built = [{k, ts}]

// ── [js/08-hunt.js] townCountOf
function townCountOf(k){ return townState().built.filter(b=>b.k===k).length; }

// ── [js/08-hunt.js] townCost
function townCost(k){ const B=TOWN_BLDG[k], m=Math.pow(TOWN_COST_MUL, townCountOf(k)), c={};
  for(const r in B.cost) c[r]=Math.ceil(B.cost[r]*m); return c; }

// ── [js/08-hunt.js] townCanPay
function townCanPay(c){ return (!c.min||profMineral()>=c.min) && (!c.gas||profGas()>=c.gas); }

// ── [js/08-hunt.js] townPay
function townPay(c){ const p=PROF(); if(c.min) p.pcoin=(p.pcoin||0)-c.min; if(c.gas) p.gas=(p.gas||0)-c.gas; }

// ── [js/08-hunt.js] townStock
// 쌓인 양 = 경과 시간 x 초당 산출(저장 한도까지). 타이머를 돌리지 않고 볼 때 계산한다.
function townStock(b){ const B=TOWN_BLDG[b.k]; if(!B||!B.out) return 0;
  return Math.min(B.cap, (Date.now()-(b.ts||Date.now()))/1000*B.rate); }

// ── [js/08-hunt.js] townBuy
function townBuy(k){ const S=townState(), B=TOWN_BLDG[k]; if(!B) return;
  if(S.built.length>=TOWN_SLOTS.length){ showTownToast('빈 터가 없습니다'); return; }
  const c=townCost(k);
  if(!townCanPay(c)){ showTownToast('재화가 부족합니다'); return; }
  townPay(c); S.built.push({ k:k, ts:Date.now() });
  if(typeof playSfx==='function') playSfx('bldg_terran');
  saveMeta(); renderVillage(); showTownToast(B.name+' 건설 완료'); }

// ── [js/08-hunt.js] townCollect
function townCollect(i){ const S=townState(), b=S.built[i]; if(!b) return;
  const B=TOWN_BLDG[b.k], amt=Math.floor(townStock(b)); if(!B.out||amt<1) return;
  const p=PROF(); if(B.out==='min') p.pcoin=(p.pcoin||0)+amt; else p.gas=(p.gas||0)+amt;
  b.ts=Date.now(); if(typeof playSfx==='function') playSfx('ui_open');
  saveMeta(); renderVillage(); if(typeof renderTownBar==='function') renderTownBar(); }

// ── [js/08-hunt.js] townCollectAll
function townCollectAll(){ const S=townState(); let n=0;
  for(let i=0;i<S.built.length;i++){ if(Math.floor(townStock(S.built[i]))>=1){ townCollect(i); n++; } }
  if(!n && typeof showTownToast==='function') showTownToast('아직 모인 것이 없습니다'); }

// ── [js/08-hunt.js] openVillage
// 마을 화면 — 배경 그림은 그대로 쓰고, 그 위에 슬롯과 하단 구매 바를 얹는다(걸어다니지 않는다)
function openVillage(){ loadMeta(); profEnsureChar();
  _townOpen=true; showAppScreen('townScreen'); navShow('home');   // 사냥터에서 온 화면 — 네비는 그대로 두고 '사냥터' 탭 활성
  document.body.classList.add('vgMode');   // 마을 전용 상단 바(.twBar)를 숨겨 재화 바 하나만 보이게
  vgMoveHud(true);
  const w=document.getElementById('twWorld'); if(w){ w.style.width='100%'; w.style.height='100%'; w.style.transform='none'; }
  const av=document.getElementById('twAvatar'); if(av) av.style.display='none';
  renderVillage(); renderTownBar();
  if(typeof paintIcons==='function') paintIcons(document.getElementById('townScreen'));
  clearInterval(_vgTick); _vgTick=setInterval(()=>{ if(_townOpen) renderVillage(); }, 1000); }

// ── [js/08-hunt.js] leaveVillage
function leaveVillage(){ _townOpen=false; clearInterval(_vgTick); _vgTick=0;
  document.body.classList.remove('vgMode'); vgMoveHud(false); }

// ── [js/08-hunt.js] vgMoveHud
// 좌상단 프로필은 사냥터의 것을 그대로 빌려 온다 — 복제하면 값이 어긋난다(단일 소스 원칙).
function vgMoveHud(into){ const hud=document.querySelector('.hbHudTop'); if(!hud) return;
  const dst=document.getElementById(into?'townScreen':'homeScreen'); if(!dst) return;
  dst.insertBefore(hud, dst.firstChild); }

// ── [js/08-hunt.js] vgBack
function vgBack(){ leaveVillage(); openHome(); }   // 우상단 돌아가기

// ── [js/08-hunt.js] renderVillage
function renderVillage(){ const w=document.getElementById('twWorld'); if(!w||!_townOpen) return;
  const S=townState();
  let html='';
  TOWN_SLOTS.forEach((s,i)=>{ const b=S.built[i], B=b?TOWN_BLDG[b.k]:null;
    html+='<div class="vgSlot'+(b?'':' empty')+'" style="left:'+s.x+'%;top:'+s.y+'%"'+(b?' onclick="townCollect('+i+')"':'')+'>';
    if(B){ const amt=Math.floor(townStock(b)), full=amt>=B.cap;
      if(amt>=1) html+='<span class="vgBadge'+(full?' full':'')+'">'+_vgResIco(B.out)+amt+'</span>';
      html+='<div class="vgPad"><img class="vgIco" src="'+ICO_DIR+'buildings/'+B.ico+'.webp" alt=""></div>'
          + '<span class="vgNm">'+B.name+'</span>'; }
    else html+='<div class="vgPad"></div>';
    html+='</div>'; });
  const g=document.getElementById('twGround');
  w.innerHTML='<div class="twGround" id="twGround"></div>'+html;
  _vgShop(); }

// ── [js/08-hunt.js] _vgShop
// 마을 하단 = 사냥터 업그레이드 패널과 같은 규격. 클래스를 새로 만들지 않고 .hmCard/.hmUpgHead/.hmUpgGrid/.hmUp을 그대로 쓴다.
function _vgShop(){ let el=document.getElementById('vgShop');
  if(!el){ el=document.createElement('div'); el.id='vgShop'; el.className='vgShop';
    document.getElementById('townScreen').appendChild(el); }
  const S=townState(), full=S.built.length>=TOWN_SLOTS.length;
  let cards='';
  for(const k in TOWN_BLDG){ const B=TOWN_BLDG[k], c=townCost(k), n=townCountOf(k), off=!townCanPay(c)||full;
    let cost=resIco('mineral')+fmtCur(c.min);
    if(c.gas) cost=resIco('gas')+fmtCur(c.gas);   // 가스 건물은 가스만(카드 한 줄 규격)
    cards+=hmUpCardHTML({ key:k, off:off,
      ico:'<img class="icoImg" src="'+ICO_DIR+'buildings/'+B.ico+'.webp" alt="" draggable="false">',
      name:B.name, val:(B.rate*n).toFixed(2)+'/s', next:(B.rate*(n+1)).toFixed(2)+'/s',   // 지금 총 산출 → 하나 더 지었을 때
      lv:'LV.'+n, cost:cost,
      act:'townBuy(&#39;'+k+'&#39;)' }); }
  el.innerHTML='<div class="hmCard hmUpg">'
    +'<button class="hmUpgHead" onclick="townCollectAll()" aria-label="전부 수집">'
    +'<b class="hmUpgTtl">마을 건설</b><i class="hmUpgChev"></i></button>'
    +'<div class="hmUpgBar"><span class="hmUpgTabs"></span>'
    +'<span class="hmUpQty">'+S.built.length+' / '+TOWN_SLOTS.length+' 터</span></div>'
    +'<div class="hmUpgGrid">'+cards+'</div></div>'; }

// ── [js/08-hunt.js] _vgResIco
function _vgResIco(out){ return resIco(out==='min'?'mineral':'gas'); }

// ── [js/08-hunt.js] openTown
// 걸어다니던 마을 화면은 폐지됐다. 옛 진입점은 전부 사냥터(HOME)로 보낸다.
// ⚠ 이동 엔진(twStep/twCamApply/twClampWall)은 남아 있지만 아무도 켜지 않는다.
function openTown(){ loadMeta(); profEnsureChar();   // 없으면 조용히 지급
  _townOpen=false; twStopLoop(); openHome(); return; }

// ── [js/08-hunt.js] twOpenChat
// 👥 친구 시트 — 허브에서 옮겨온 목록을 그대로 쓴다
function twOpenChat(){ const el=document.getElementById('twChat'); if(!el) return;   // 💬 채팅 시트(마을)
  const so=document.querySelector('.msSocial');
  if(so && so.parentNode!==el) el.appendChild(so);   // 유즈맵 도크에 가 있으면 시트로 되찾아온다(단일 DOM)
  twCloseSocial(); el.classList.remove('hide');
  // ⚠ 탭 띠는 마크업이 아니라 렌더러가 그린다 — 안 부르면 띠가 통째로 빈다(2026-08-27 회귀)
  if(typeof renderSocialTabs==='function') renderSocialTabs();
  if(typeof paintIcons==='function') paintIcons(el); if(typeof playSfx==='function') playSfx('ui_open');
  const c=document.getElementById('msChat'); if(c) c.scrollTop=c.scrollHeight; }

// ── [js/08-hunt.js] twOpenSocial
function twOpenSocial(){ twCloseChat(); const el=document.getElementById('twSocial'); if(!el) return;
  el.classList.remove('hide');
  renderHubFriendTabs();   // 띠는 마크업이 아니라 여기서 그린다(공용 세그먼트 바)
  if(typeof renderFriends==='function') renderFriends();
  if(typeof paintIcons==='function') paintIcons(el); if(typeof playSfx==='function') playSfx('ui_open'); }

// ── [js/08-hunt.js] twLayout
// ── 월드/카메라 ──
// 건물 그림 채우기 — 3D 로드 전에는 이모지가 그대로 보이고, 준비되면 교체된다
// 화면 밖 구역을 화면 가장자리에 표시 — 월드가 넓어 구역이 안 보일 때 어디로 가야 할지 알려준다.
// 월드 픽셀 크기 산출 + 구역 배치. 화면 크기가 바뀌면 캐릭터 좌표도 비례로 옮겨 상대 위치를 지킨다.
function twLayout(){ const map=document.getElementById('twMap'), w=document.getElementById('twWorld'); if(!map||!w) return;
  const r=map.getBoundingClientRect(); _twVW=r.width; _twVH=r.height; _twVL=r.left; _twVT=r.top;
  const nw=Math.round(r.width*TW_WORLD_W_MUL), nh=Math.round(r.height*TW_WORLD_H_MUL);
  if(_twW&&_twH&&(nw!==_twW||nh!==_twH)){ const sx=nw/_twW, sy=nh/_twH;
    _twChar.x*=sx; _twChar.y*=sy; _twChar.tx*=sx; _twChar.ty*=sy; }
  _twW=nw; _twH=nh; w.style.width=nw+'px'; w.style.height=nh+'px'; }

// ── [js/08-hunt.js] twClampWall
// 성벽 안으로 가두기 — 축별 클램프 + 그 좌표계에서의 마름모 컷. 팔각형은 볼록이라 목적지만 가두면 경로도 안 샌다.
function twClampWall(wx,wy){
  let u=Math.max(-1,Math.min(1, (wx/_twW*2-1)/TW_WALL_X)), v=Math.max(-1,Math.min(1, (wy/_twH*2-1-TW_WALL_DY)/TW_WALL_Y));
  const lim=2-TW_WALL_CUT*2, s=Math.abs(u)+Math.abs(v);
  if(s>lim){ const k=lim/s; u*=k; v*=k; }   // 모서리 밖이면 중심 쪽으로 당겨 벽면에 붙인다
  return [ (u*TW_WALL_X+1)/2*_twW, (v*TW_WALL_Y+TW_WALL_DY+1)/2*_twH ]; }

// ── [js/08-hunt.js] twScreenToWorld
function twScreenToWorld(cx,cy){ return [ _twChar.x+(cx-_twVL)-_twVW/2, _twChar.y+(cy-_twVT)-_twVH/2 ]; }   // 캐릭터가 화면 중앙이므로 = 캐릭터 + (터치점 - 화면중앙)

// ── [js/08-hunt.js] twSetTarget
function twSetTarget(wx,wy){ const _p=twClampWall(wx,wy); _twChar.tx=_p[0]; _twChar.ty=_p[1]; _twChar.mode='to'; _twGoZone=null; }

// ── [js/08-hunt.js] twTapFx
function twTapFx(wx,wy){ const w=document.getElementById('twWorld'); if(!w) return;
  const d=document.createElement('div'); d.className='twTapFx'; d.style.left=wx+'px'; d.style.top=wy+'px';
  w.appendChild(d); setTimeout(()=>{ if(d.parentNode) d.parentNode.removeChild(d); }, 520); }

// ── [js/08-hunt.js] twCamApply
// 카메라 = 월드 transform 한 줄. 아바타는 DOM상 고정이고 걷기/방향 클래스만 바뀐다.
function twCamApply(){ const w=document.getElementById('twWorld'); if(!w) return;
  w.style.transform='translate3d('+(_twVW/2-_twChar.x).toFixed(1)+'px,'+(_twVH/2-_twChar.y).toFixed(1)+'px,0)';
  const av=document.getElementById('twAvatar'); if(av) av.classList.toggle('walk', _twChar.mode!==null);
  const f=document.getElementById('twAvFlip'); if(f) f.classList.toggle('l', _twChar.face<0);
  }

// ── [js/08-hunt.js] twStep
// 한 프레임 전진. rAF(twTick)와 스모크가 같은 함수를 쓴다(헤드리스는 rAF가 멈춰 있어 수동 호출이 필요).
function twStep(dt){ if(!_twW) return;
  const c=_twChar;
  if(_twPtr && !_twPtr.hold && Date.now()-_twPtr.t>TW_TAP_MS) _twPtr.hold=true;   // 가만히 누르고 있어도 꾹 누르기로 전환(move 이벤트가 안 오므로 여기서 판정)
  if(_twPtr && _twPtr.hold){ const dx=_twPtr.x-(_twVL+_twVW/2), dy=_twPtr.y-(_twVT+_twVH/2), d=Math.hypot(dx,dy);
    if(d>4){ c.mode='dir'; c.dx=dx/d; c.dy=dy/d; _twGoZone=null; } else if(c.mode==='dir') c.mode=null; }
  let mx=0,my=0;
  if(c.mode==='dir'){ mx=c.dx; my=c.dy; }
  else if(c.mode==='to'){ const ax=c.tx-c.x, ay=c.ty-c.y, d=Math.hypot(ax,ay);
    if(d<=TW_ARRIVE){ c.x=c.tx; c.y=c.ty; c.mode=null; } else { mx=ax/d; my=ay/d; } }
  if(mx||my){ let s=TW_SPEED*dt;
    if(c.mode==='to') s=Math.min(s, Math.hypot(c.tx-c.x,c.ty-c.y));
    c.x=Math.max(0,Math.min(_twW,c.x+mx*s)); c.y=Math.max(0,Math.min(_twH,c.y+my*s));
    if(mx>0.05) c.face=1; else if(mx<-0.05) c.face=-1; }
  twCamApply(); tw3dFrame(dt); }

// ── [js/08-hunt.js] twTick
// 시설은 '내가 지정한 구역'에 도착했을 때만 열린다.
// 옆을 스쳐 지나가는 것도, 땅을 눌러 걸어가 그 위에 겹쳐 서는 것도 열지 않는다 — 구역을 직접 눌러야 한다.
function twTick(ts){ if(!_townOpen){ _twRaf=0; return; }
  const dt=_twLast? Math.min(0.05,(ts-_twLast)/1000) : 0.016; _twLast=ts;
  twStep(dt); _twRaf=requestAnimationFrame(twTick); }

// ── [js/08-hunt.js] twStartLoop
function twStartLoop(){ if(_twRaf) return; _twLast=0; _twRaf=requestAnimationFrame(twTick); }

// ── [js/08-hunt.js] twPtrDown
// ── 입력: 탭 = 그 지점으로 이동 / 꾹 누르기 = 손가락 방향으로 계속 이동 ──
function twPtrDown(e){ if(!_townOpen) return;
  if(e.target && e.target.closest && e.target.closest('.twZone,.twEdge')) return;   // 구역 아이콘·방향 표시는 자체 클릭(townGo)이 처리
  _twPtr={ id:e.pointerId, x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY, t:Date.now(), hold:false };
  const map=document.getElementById('twMap'); if(map){ try{ map.setPointerCapture(e.pointerId); }catch(_){} } }

// ── [js/08-hunt.js] twPtrMove
function twPtrMove(e){ if(!_twPtr || e.pointerId!==_twPtr.id) return;
  _twPtr.x=e.clientX; _twPtr.y=e.clientY;
  if(!_twPtr.hold && Math.hypot(e.clientX-_twPtr.sx, e.clientY-_twPtr.sy)>TW_TAP_PX) _twPtr.hold=true; }

// ── [js/08-hunt.js] twPtrUp
function twPtrUp(e){ if(!_twPtr || e.pointerId!==_twPtr.id) return;
  const p=_twPtr; _twPtr=null;
  if(p.hold){ if(_twChar.mode==='dir') _twChar.mode=null; return; }   // 꾹 누르기였으면 떼는 순간 정지
  const w=twScreenToWorld(p.x,p.y); twSetTarget(w[0],w[1]); twTapFx(w[0],w[1]); }

// ── [js/08-hunt.js] renderTownIdle
function renderTownIdle(){ renderTownBar(); const tp=document.getElementById('townPanel'); if(_twZone==='gym' && tp && !tp.classList.contains('hide')) refreshTownPanel(); }

// ── [js/19-camp.js] campMineHit — 광맥을 눌렀나(판정만)
// 광맥 탭으로 채굴 모드에 들어가던 시절의 판정기다. 2026-09-02 사용자 확정으로 그 문을 닫아
// (채굴은 「MY BASE」 요약판의 채굴 버튼으로만 켠다) 호출자가 사라졌다.
// ⛔ 되살리려면 ATTIC.md 를 먼저 읽을 것 — 켜는 문이 둘이 되면 광맥을 고르려는 탭이 채굴로 먹힌다.
function campMineHit(clientX, clientY){
  if(!_campOn || typeof G === 'undefined' || !G.tech) return false;
  if(typeof _btRect !== 'function' || typeof _techS2W !== 'function' || typeof _techMineralAt !== 'function') return false;
  if(G.tech.arm) return false;                      // 🧱 건물 배치 중에는 열지 않는다
  const r = _btRect(); if(!r || !r.width || !r.height) return false;
  const sx = (clientX - r.left) / r.width, sy = (clientY - r.top) / r.height;
  if(sx < 0 || sx > 1 || sy < 0 || sy > 1) return false;
  if(sy < 0.13) return false;                       // 상단바 — techPtrDown 과 같은 규약
  const w = _techS2W(sx, sy);
  const m = _techMineralAt(w.x, w.y);
  return !!(m && m.amount > 0);
}

// ── [js/22-camp-rune.js] _runeRowHTML — 옛 목록형 룬 칸(줄 두 개)
// 일반·유니크를 가로 줄 두 개로 늘어놓던 렌더러다. 2026-09-03 사용자 확정으로 룬 화면이
// **성좌 판**(SVG 한 장 · 유니크가 중심, 일반 8칸이 고리)으로 바뀌며 호출자가 사라졌다.
// ⛔ 되살리면 같은 화면을 두 번 그리게 된다 — 스모크 「성좌 판이 없다」가 잡는다.
function _runeRowHTML(kind, label){
  const tb = RUNE_SLOT_R[kind] || [], open = campRuneSlots(kind), eq = campRuneEq(kind);
  const next = campRuneNextAt(kind);
  let h = '<div class="rnSec"><div class="rnSecH"><span class="rnSecT">' + label + '</span>'
    + '<span class="rnSecN">' + open + ' / ' + tb.length + '</span></div><div class="rnSlots">';
  for(let i = 0; i < tb.length; i++){
    if(i >= open){   // 🔒 잠긴 칸 — **왜 잠겼는지 적는다**(이유가 없으면 버그처럼 보인다)
      h += '<button class="rnSlot lk" type="button" disabled><i class="rnLk">🔒</i>'
        + '<span class="rnLkR">R' + tb[i] + '</span></button>'; continue; }
    const key = eq[i];
    const sel = (_runePickKind === kind && _runePick === i) ? ' sel' : '';
    if(!key){ h += '<button class="rnSlot em' + sel + '" type="button" onclick="campRunePick(\'' + kind + '\',' + i + ')">+</button>'; continue; }
    const p = runeParse(key), gc = (RUNE_GD[p.gd] || {}).col || '#8b95a5';
    h += '<button class="rnSlot on' + sel + '" type="button" style="--rg:' + gc + '"'
      + ' onclick="campRunePick(\'' + kind + '\',' + i + ')">'
      + '<span data-ico="' + p.def.ico + '"></span>'
      + '<span class="rnSlN">' + p.def.nm.replace('의 룬', '') + '</span>'
      + '<span class="rnSlV">' + runeValTx(key) + '</span></button>'; }
  h += '</div>';
  if(next) h += '<div class="rnNext">다음 칸은 <b>R' + next + '</b> 에 열립니다</div>';
  return h + '</div>'; }

// ── [js/19-camp.js] campRoundMul
// 💠 **질주의 룬 — 웨이브 대기 배수.** 다음 무리가 빨리 오면 라운드가 짧아진다.
function campRoundMul(){ return (typeof campRuneMul === 'function') ? campRuneMul('round') : 1; }


// ── [js/19-camp.js] campTreePayHTML — 별 시트의 **비용 한 줄** (2026-09-04 유보)
// 💠 값이 주인공(24px)이고 금색 마름모가 앞에 섰다. 시트를 「머리 한 줄」로 바꾸면서
//   값이 **이름 줄 오른쪽**으로 올라가 이 줄이 통째로 사라졌다(목업 camp-tree-sheet-8 ④안).
//   ⛔ 마름모(.ctPip)는 이 게임의 다른 어디에도 없는 도형이라 되살리지 않는다.
function campTreePayHTML(cost, pts){
  return '<div class="ctPay"><span class="ctPip"></span>' +
    '<span class="ctCv">' + campNum(cost) + '</span>' +
    '<span class="ctHave">point 필요</span></div>'; }
