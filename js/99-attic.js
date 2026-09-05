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


// ── [js/19-camp.js] campRebToShop — 환생 화면에서 상점으로 (2026-09-04 유보)
// 💳 환생 팩 버튼의 「보러 가기」가 부르던 길. 그 자리를 **광고 버튼**이 가져가면서 끊겼다.
//   팩은 이제 상점(추천 칸)에서만 산다. ⛔ 환생 화면에 파는 길을 다시 내지 말 것.
function campRebToShop(){ campRebClose();
  if(typeof openShop === 'function') openShop();
  if(typeof setShopSec === 'function') setShopSec('reco'); }

// ── [js/02-gacha.js] tierName
function tierName(id){ return (GACHA_TIERS[id]||{}).name || '일반'; }

// ── [js/04-profile.js] profRecordRp
// ⚠ 기록 기반 환생 포인트는 폐지했다(2026-08-19). 그건 '마지막 환생 뒤에는 레벨이 멈춘다'는
//    유한 사다리 전제에서 필요했던 보조 축인데, 환생이 무한이 된 지금은 그 상태가 없다.
//    깊이 민 보상은 환생 자체(레벨 비례 배수·포인트)가 이미 준다 — 두 벌로 두면 같은 진행을 두 번 센다.
//    ⛔ 되살리지 말 것. 필요하면 profRebGrantAt 의 계수(PROF_REB_RP_K)를 키우는 쪽이 맞다.
function profRecordRp(){ return 0; }

// ── [js/04-profile.js] ticketN
function ticketN(kind){ const p=PROF(); return (p.tickets&&p.tickets[kind])||0; }

// ── [js/05-home.js] hbOpenRounds
function hbOpenRounds(){ const el=document.getElementById('hbRoundSheet'); if(!el) return;
  const H=hbHunt();
  _hbPick={ dg:(_hb?_hb.dg:H.dg)||1, round:(_hb?_hb.round:H.round)||1 };
  el.classList.remove('hide'); renderRoundSheet();
  if(typeof paintIcons==='function') paintIcons(el);
  if(typeof playSfx==='function') playSfx('ui_open');
  // 여백은 칸 높이·컨테이너 높이로 결정된다 → 보인 뒤에 재야 한다(숨은 동안은 높이가 0)
  requestAnimationFrame(()=>{ if(!_hbPick) return; hbRdPad(); hbRdCenter(_hbPick.round,false); }); }

// ── [js/05-home.js] hbRdScrolled
// 스크롤이 멎으면 가운데 칸이 곧 선택이다(짧게 기다렸다가 한 번만 확정한다)
function hbRdScrolled(){ clearTimeout(_hbRdT); _hbRdT=setTimeout(hbRdSettle, 110); }

// ── [js/05-home.js] hbPickDg
// 던전 넘기기 — 열려 있는 것만 건너뛴다. 라운드는 그 던전의 최고 도달로 맞춘다.
function hbPickDg(d){ if(!_hbPick) return;
  for(let n=_hbPick.dg+d; n>=1 && n<=HB_DG_MAX; n+=d){ if(!hbDgOpen(n)) continue;
    _hbPick.dg=n; _hbPick.round=hbBest(n); renderRoundSheet();
    requestAnimationFrame(()=>{ if(!_hbPick) return; hbRdPad(); hbRdCenter(_hbPick.round,false); });
    if(typeof playSfx==='function') playSfx('ui_tab'); return; } }

// ── [js/05-home.js] hbPickGo
// [이동] — 여기서만 실제로 옮긴다
function hbPickGo(){ if(!_hbPick) return; const H=hbHunt(), d=_hbPick.dg, r=_hbPick.round;
  if(d!==H.dg){ H.dg=d; hbEnsureModels(d);
    if(_hb){ _hb.dg=d; _hb._pat=null; } }                 // 바닥 타일 패턴 캐시 무효화(던전이 바뀌었다)
  H.round=r; saveMeta();
  if(_hb){ _hb.round=r; _hb.wave=1; _hb.phase='fight'; _hb.buf={min:0,gas:0,xp:0,kills:0};
    _hb.foes.length=0; _hb.pend.length=0; _hb.char.hp=_hb.char.hpMax; hbSpawnWave(); }
  if(typeof playSfx==='function') playSfx('ui_confirm');
  hbHud(); hbCloseRounds(); }

// ── [js/05-home.js] hbGoDungeon
// 던전 이동 — 그 던전에서 도달했던 라운드부터 다시 시작한다
function hbGoDungeon(d){ const H=hbHunt();
  d=Math.max(1,Math.min(HB_DG_MAX,d|0)); if(!hbDgOpen(d)) return;
  H.dg=d; H.round=Math.max(1,H.best[d]||1); saveMeta();
  hbEnsureModels(d);                                 // ⚔ 그 던전 적 3종 3D 모델만 지연 로드
  if(_hb){ _hb.dg=d; _hb.round=H.round; _hb.wave=1; _hb.phase='fight'; _hb.buf={min:0,gas:0,xp:0,kills:0};
    _hb._pat=null;                                   // 바닥 타일 패턴 캐시 무효화(던전이 바뀌었다)
    _hb.foes.length=0; _hb.pend.length=0; _hb.char.hp=_hb.char.hpMax; hbSpawnWave(); }
  if(typeof playSfx==='function') playSfx('ui_open');
  renderRoundSheet(); hbHud(); }

// ── [js/05-home.js] hbSetClimb
function hbSetClimb(v){ const H=hbHunt(); H.climb=!!v; H.climbChosen=1; saveMeta(); renderRoundSheet(); hbHud();
  if(typeof playSfx==='function') playSfx('ui_tab'); }

// ── [js/05-home.js] hbRoundStep
// ◀▶ ±1 — 가장 잦은 동작이라 시트를 거치지 않는다. 1 ~ 최고 도달 사이로 가둔다.
function hbRoundStep(d){ const H=hbHunt(), cur=(_hb?_hb.round:(H.round||1));
  if(hbSetRound(cur+(d|0)) && !document.getElementById('hbRoundSheet').classList.contains('hide')) renderRoundSheet(); }

// ── [js/06-daily.js] dqDoneN
// ── 퀘스트 수령 ──
function dqDoneN(){ const D=dqState(); if(!D) return 0;
  return D.q.filter(function(e){ const Q=DQ_BY[e.id]; return Q && e.n>=Q.goal; }).length; }

// ── [js/07-home-upgrade.js] hbOpenMates
// 🤝 동료 — 영입(첫 구매)·강화(같은 버튼)·출전 토글. 옛 전직 트리가 여기로 옮겨 왔다.
function hbOpenMates(){ const el=document.getElementById('hbMateModal'); if(!el) return;
  el.classList.remove('hide'); renderMateModal(); if(typeof playSfx==='function') playSfx('ui_open'); }

// ── [js/07-home-upgrade.js] hbCloseMates
function hbCloseMates(){ _mateFeedT=null; const el=document.getElementById('hbMateModal'); if(el) el.classList.add('hide'); }

// ── [js/07-home-upgrade.js] hbCloseGrow
function hbCloseGrow(){ const el=document.getElementById('hbGrowModal'); if(el) el.classList.add('hide'); }

// ── [js/07-home-upgrade.js] profStatParts
// ── C. 스탯 출처 내역 — "어디를 올려야 이득인가"를 화면에서 알 수 있게 ──
// profStat()의 계산식을 그대로 분해한다(식이 바뀌면 여기도 같이 고칠 것 — 값을 두 번 계산하지 않도록 합계는 profStat로 검산).
// 장비가 주는 스탯의 분해(부위별 합) — 지금은 장비만 남았으므로 이름 그대로 '장비 몫'이다.
// 스탯 출처 표는 이걸 쓰지 않는다(csAxis 가 축 단위로 답한다). 장비 화면 검증용으로 남긴다.
function profStatParts(k){ const c=CHAR(); if(!c) return null;
  let gear=0;
  for(const slot in c.unit.gear){ const it=profFindItem(c.unit.gear[slot]); if(!it) continue;
    const g=PROF_GEAR[slot]; if(g && g.stat===k) gear+=it.main;
    for(const o of it.opts) if(o.k===k) gear+=o.v; }
  return { gear:gear, total:profStat(k) }; }

// ── [js/07-home-upgrade.js] hbOpenInfo
function hbOpenInfo(){ const el=document.getElementById('hbInfoModal'); if(!el) return;
  if(typeof chrReturnBody==='function') chrReturnBody();   // 캐릭터 화면이 빌려 갔으면 되찾는다
  el.classList.remove('hide'); renderInfoModal(); if(typeof playSfx==='function') playSfx('ui_open'); }

// ── [js/07-home-upgrade.js] hbCloseInfo
function hbCloseInfo(){ const el=document.getElementById('hbInfoModal'); if(el) el.classList.add('hide'); }

// ── [js/07-home-upgrade.js] openQuest
function openQuest(){    _navOpenShell('questScreen','quest'); }

// ── [js/08-hunt.js] HB_DG_MUL
function HB_DG_MUL(dg){ return HB_DG_HP(dg); }             // 옛 이름 호환

// ── [js/08-hunt.js] hbStart
function hbStart(){ const cv=document.getElementById('hbCv'); if(!cv) return;
  hbUse('hunt');                                      // ⚠ 사냥터 화면이므로 포인터를 사냥터 세션으로 — 토벌을 보다 왔을 수 있다
  if(_hb && _hb.on){                                  // 이미 돌고 있던 판 — 라운드·웨이브·적을 그대로 이어받는다
    _hb.bg=false; _hb.cv=cv; _hb.ctx=cv.getContext('2d'); _hb._pat=null;
    _hb.vTop=0; _hb.vBot=0;                           // 카메라는 새 레이아웃으로 '즉시' 맞춘다(보간하면 돌아온 순간 어긋나 보인다)
    hbSyncChar();                                     // 자리를 비운 사이 산 업그레이드·레벨·포인트를 반영
    if(!_hbTick) _hbTick=setInterval(hbPumpAll,50);
    _hb.lastSim=performance.now();
    if(!_hbRaf) _hbRaf=requestAnimationFrame(hbFrame);
    hbResize(); hbHud(); renderHbBar(); return; }
  const H=hbHunt(), st=hbCharStats();
  hbSetSess('hunt', { on:true, mode:'hunt', speed:1, lastSim:performance.now(),
    cv, ctx:cv.getContext('2d'), w:0,h:0,d:1, vTop:0, vBot:0, cx:0, cy:0, k:1, t:0,
    dg:H.dg||1, round:H.round||1, wave:1, phase:'fight', waveT:hbWaveTime(1), gapT:0, downT:0,
    pend:[], pendT:0, foes:[], chests:[], fx:null, floats:[], kills:0, rt0:0, charDir:4, charFace:0, atkT:0,
    allies:[], turrets:[], bunkers:[], pets:[], skT:{nova:0,heal:0,slow:0}, slowT:0, skDirty:false,
    buf:{min:0,gas:0,xp:0,kills:0},
    char:{ x:0,y:0, hp:st.hpMax, hpMax:st.hpMax, atk:st.atk, cd:st.cd, crit:st.crit, critDmg:st.critDmg,
           range:st.range, regen:st.regen, cdT:0, hitT:9,
           shd:st.shdMax, shdMax:st.shdMax, shdReg:st.shdReg,
           lifest:st.lifest, knock:st.knock, chestDmg:st.chestDmg, multiC:st.multiC, multiN:st.multiN,
           bncC:st.bncC, bncN:st.bncN, scritC:st.scritC, scritM:st.scritM,
           mspd:st.mspd, rrng:st.rrng } });
  hbUse('hunt');
  hbEnsureModels(_hb.dg);                            // ⚔ 현재 던전 적 모델 준비(없으면 이모지로 시작)
  hbResize(); hbLayoutAllies(); hbSpawnWave(); hbHud(); renderHbBar();
  _hb.lastSim=performance.now();
  _hbRaf=requestAnimationFrame(hbFrame);            // 그리기
  if(!_hbTick) _hbTick=setInterval(hbPumpAll,50); }  // 진행 보장(세션 전부)

// ── [js/08-hunt.js] mapToHub
function mapToHub(){ if(typeof stopRoomsTick==='function') stopRoomsTick(); if(typeof playSfx==='function') playSfx('ui_close'); openHome(); }   // 유즈맵 선택 → 메인(HOME)으로 복귀

// ── [js/08-hunt.js] openTownPanel
function openTownPanel(zone){ const _z=TOWN_PANELS[zone];
  if(_z && _z.screen && TOWN_ZONE_SCREEN[_z.screen]){ _twChar.mode=null; _twPtr=null; return TOWN_ZONE_SCREEN[_z.screen](); }   // 전용 화면 구역
  _twZone=zone; _twChar.mode=null; _twPtr=null;   // 시설에 들어가면 걸음을 멈춘다
  const card=document.querySelector('#townPanel .twCard');
  if(card) card.classList.toggle('gearFull', zone==='gear');   // 장비창만 카드 높이를 고정해 위/아래 구역을 나눈다
  const t=document.getElementById('tpTitle'), z=TOWN_PANELS[zone]; if(t) t.textContent=(z&&z.title)||'시설';
  refreshTownPanel(); popShow('townPanel'); bagScrollHint(); }   // 숨은 동안은 높이가 0이라 표시 후 한 번 더 재본다

// ── [js/08-hunt.js] setChrSec
function setChrSec(k){ if(!CHR_SECS[k]) return; _chrSec=k;
  if(typeof _lpPicking!=='undefined') _lpPicking=false;   // 화면을 옮기면 '고르는 중'은 남기지 않는다
  renderChr();
  if(typeof navPaint==='function') navPaint(); }

// ── [js/08-hunt.js] openUpgScreen
function openUpgScreen(){ if(typeof loadMeta==='function') loadMeta();
  profEnsureChar();
  if(typeof twLeave==='function') twLeave();
  showAppScreen('upgScreen'); navShow('upg'); renderChr();
  if(typeof paintIcons==='function') paintIcons(document.getElementById('upgScreen')); }

// ── [js/08-hunt.js] openGear
function openGear(){ if(typeof loadMeta==='function') loadMeta();
  profEnsureChar();   // 캐릭터가 없으면 조용히 기본 유닛을 지급한다(선택 화면 없음)
  if(typeof twLeave==='function') twLeave();                                     // 마을에서 들어왔으면 루프·팝업 정리
  _gearPick=null; _gearSel=null;
  showAppScreen('gearScreen'); navShow('gear'); renderGear();
  if(typeof paintIcons==='function') paintIcons(document.getElementById('gearScreen')); }

// ── [js/08-hunt.js] setGearTab
function setGearTab(v){ if(_gearTab===v) return; _gearTab=v; _gearPick=null; _gearSel=null;
  if(typeof playSfx==='function') playSfx('ui_tab');
  if(typeof navPaint==='function') navPaint();   // 탭 띠는 하단 네비로 갔다 — 표시는 거기서 한다
  renderGear(); }

// ── [js/08-hunt.js] profGearPageStep
function profGearPageStep(d){ profGearPageAt(PROF_GEAR_PAGES.findIndex(p=>p.id===_gearPage)+d); }

// ── [js/09-dungeon.js] dgEnter
function dgEnter(floor){ if(floor>dgFloorCap()){ showTownToast('Lv.'+dgFloorReqLv(floor)+'부터 도전할 수 있습니다'); return; }
  dgStopLoop(); closeTownPanel(); twStopLoop(); _townOpen=false;
  if(typeof playSfx==='function') playSfx('ui_open'); dgStart(floor); }

// ── [js/09-dungeon.js] dgFlee
function dgFlee(){ dgToHub(); }

// ── [js/12-appshell.js] sdStartInf
function sdStartInf(){ if(!_sdOk('inf')){ if(typeof lobbyToast==='function') lobbyToast('🔒 노말을 클리어하면 열립니다'); return; }
  startSoloInfinite(); }

// ── [js/12-appshell.js] setCpDiff
function setCpDiff(d){ if(!DIFFICULTY[d]) return; _createDiff=d; _createInf=false; renderCpDiff(); if(typeof playSfx==='function') playSfx('ui_tab'); }

// ── [js/19-camp.js] campEnterDungeon
// 캠프(0) → 던전으로 내려간다. 인자가 없으면 **최고 기록 다음 칸**이 아니라 던전 1부터.
function campEnterDungeon(dg){ const C = campState(); if(!C) return 0;
  const n = Math.max(1, Math.min(CAMP_DG_MAX, (dg | 0) || 1));
  C.dg = n; C.cleared = 0; campSave();
  if(typeof campBarReset === 'function') campBarReset();
  campSkin();                                        // 🎨 바닥을 그 던전 그림으로 (아래 ⛔)
  return n; }

// ── [js/19-camp.js] campBest
function campBest(dg){ const C = campState(); return (C && C.best && C.best[dg | 0]) | 0; }

// ── [js/19-camp.js] campPatchRefinery
function campPatchRefinery(){
  if(_campRefHome || typeof G === 'undefined' || !G.tech || typeof TECH_TREE === 'undefined') return;
  const t = TECH_TREE[G.tech.race]; if(!t) return;
  const b = (t.buildings || []).find(function(x){ return x.gas; }); if(!b) return;
  _campRefHome = { b: b, had: b.research || null };
  b.research = (b.research || []).concat([CAMP_REF_RES]); }

// ── [js/19-camp.js] campRtReset
// 초기화 — 산 것을 전부 물리고 포인트를 100% 돌려받는다. 비용은 젬(GEM.md §4).
//   ⚠ 마디 값도 함께 돌려준다 — 안 그러면 되돌릴수록 포인트가 샌다.
function campRtReset(){ const C = campState(); if(!C) return 0;
  const b = campRtBag(); let back = 0;
  if(b.root) back += CAMP_RT_ROOT_COST;
  for(const bk in CAMP_TREE_BR){
    if(b[CAMP_RT_BR_KEY(bk)]) back += CAMP_RT_BR_COST;
    for(const g of CAMP_RT_GRP_KEYS) if(b[CAMP_RT_GP_KEY(bk, g)]) back += CAMP_RT_GP_COST; }
  for(const L of CAMP_RT_LINES){ const n = b[L.k] | 0;
    for(let i = 1; i <= n; i++) back += campRtCost(L.k, i); }
  C.rbTree = { _m2:1 }; C.rbPts = (C.rbPts || 0) + back; campSave(); return back; }

// ── [js/19-camp.js] campTreeSpark
// ⛔ **x·y 를 반드시 숫자로 되돌린다.** 부르는 쪽(campTreeGem)이 toFixed 한 **문자열**을 넘긴다 —
//   그대로 두면 `x - r` 은 숫자인데 `x + r` 은 **문자열 이어붙이기**가 되어
//   "67.3" + 22.75 → "67.322.75" 같은 값이 나오고, SVG 경로 파서가 그걸 두 수로 쪼개 읽어
//   도형이 통째로 망가진다(실측 2026-09-02: 반짝임 하나가 12×216px 짜리 **긴 세로선**으로 그려졌다).
function campTreeSpark(x, y, r, col, op){
  x = +x; y = +y;
  return '<path d="M' + (x - r) + ' ' + y + ' L' + (x + r) + ' ' + y +
    ' M' + x + ' ' + (y - r) + ' L' + x + ' ' + (y + r) + '" class="ctSp" stroke="' + col +
    '" opacity="' + (op || .5).toFixed(2) + '"/>'; }

// ── [js/19-camp.js] campRebHours
function campRebHours(mul){ return CAMP_REB_T10 * Math.pow(Math.max(1, mul), -CAMP_REB_TEXP); }

// ── [js/19-camp.js] campRebHourTx
function campRebHourTx(h){ return (h >= 10) ? (Math.round(h) + '시간') : (h.toFixed(1) + '시간'); }

// ── [js/19-camp.js] campTreeIsCut
// 고른 별의 모든 정보 — 이름 · 진행도 · 설명 · 지금값▶다음값 · 다음 단계 예고 ·
//   비용 · 사고 나면 남는 포인트 · 사기. ⭐ 한 곳에 모은다(2026-09-01 사용자 확정).
//   ⚠ 값·설명은 지어내지 않는다 — 효과 사다리(CAMP_RT_LADDER · CAMP_RT_CUT)에서 그대로 꺼낸다.
function campTreeIsCut(k){ const L = campRtLine(k); return !!L && L.br === 'enemy'; }

// ── [js/19-camp.js] campTreeViewP
// 지금 화면 한가운데에 있는 월드점 — 애니의 출발점이다
function campTreeViewP(){ const v = _campTreeView;
  return { x: -v.x / v.z, y: -v.y / v.z }; }

// ── [js/19-camp.js] campBldSnap
// 프레임 전 건물 체력을 떠 둔다 → strikeStepUnits 뒤에 깎인 만큼을 배율로 증폭한다.
//   ⭐ 이 방식인 이유: 적이 구조물에 넣는 피해는 18-strike.js 안에서 `front.hp -= …` 로
//     직접 빠져 가로챌 훅이 없다. ⛔ 18-strike.js 는 고치지 않는다(오토배틀 공유).
//   ⚠ 내 건물을 때리는 것은 적뿐이다(아군은 같은 편을 안 친다) — 그래서 감소분 = 적 피해다.
function campBldSnap(){
  if(!CAMPB || !CAMPB._bld) return null;
  const m = new Map();
  for(const b of CAMPB._bld) if(b && !b.dead) m.set(b, b.hp);
  return m; }

// ── [js/19-camp.js] campBldAmp
function campBldAmp(snap){
  if(!snap || CAMP_FOE_BLD_MUL === 1) return 0;
  let hit = 0;
  for(const [b, hp0] of snap){
    const d = hp0 - b.hp;                       // 이번 프레임에 깎인 양
    if(!(d > 0)) continue;
    hit += d;
    b.hp = hp0 - d * CAMP_FOE_BLD_MUL;
    if(b.hp <= 0){ b.hp = 0; b.dead = true; } }
  return hit; }

// ── [js/19-camp.js] campFoeTierOf
// 이 id 가 몇 티어인가 — 없으면 0. (구성이 실제로 지켜지는지 재는 데 쓴다)
function campFoeTierOf(id){
  if(!id || !CAMPB) return 0;
  const T = CAMP_FOE_TIER[CAMPB.ai.race] || CAMP_FOE_TIER.terran;
  if(T.t1.indexOf(id) >= 0) return 1;
  if(T.t2.indexOf(id) >= 0) return 2;
  if(T.t3.indexOf(id) >= 0) return 3;
  return 0;
}

// ── [js/19-camp.js] campPostSnap
function campPostSnap(){
  if(!CAMPB || !CAMPB.me) return;
  for(const u of CAMPB.me.units){ if(u.dead) continue; u._sx = u.x; u._sy = u.y; } }

// ── [js/19-camp.js] campPostStep
function campPostStep(dt){
  if(!CAMPB || !CAMPB.me || typeof strikeMoveToward !== 'function') return 0;
  const R2 = CAMP_POST_R * CAMP_POST_R; let n = 0;
  campWithStk(function(){
    for(const u of CAMPB.me.units){ if(u.dead) continue;
      if(campInBunker(u)) continue;               // 🧱 벙커에 탄 유닛은 campBunkerStep 이 붙든다
      if(!u._post) u._post = { x:u.x, y:u.y };     // 자리가 없으면 지금 자리를 자리로 삼는다
      // ⚔ 싸우는 중이면 복귀보다 전투가 먼저다.
      // ⛔ **표적 번호가 있다는 것만으로 판단하지 말 것.** 적이 죽어도 u.tgtUid 는 그대로 남는다 —
      //   그러면 「싸우는 중」으로 오해해 **영영 자리로 안 돌아온다**(브라우저 실측 2026-08-28).
      if(u.tgtUid && strikeFindUnit(CAMPB.ai.units, u.tgtUid)){
        u._idleT = 0; u._homeT = 0; continue; }    // 전투 중 — 시계를 되감고 손을 뗀다
      // ⏳ 전투가 없어진 지 얼마나 됐나 — 바로 돌아가지 않는다(적이 곧 다시 붙을 수 있다)
      u._idleT = (u._idleT || 0) + dt;
      if(u._idleT < CAMP_RETURN_DELAY) continue;
      const p = u._post, dx = p.x - u.x, dy = p.y - u.y;
      if(dx * dx + dy * dy <= R2){ u.moving = false; u._homeT = 0; continue; }   // 이미 자리
      // ⛔ **몰아서 밀지 않는다** (2026-08-31). 처음엔 0.5초치를 한 프레임에 밀었다가
      //   유닛이 **308px 씩 순간이동**했다(실측 37회). 복귀 목표는 _post 로 고정이라
      //   간격을 둘 이유도 없다 — 매 프레임 dt 만큼 정상 속도로 걸어온다.
      // ⭐ **복귀는 빠르게**(2026-08-30 사용자 확정) — 싸우러 나갔다 오는 길이라 굼뜨면
      //   다음 무리가 올 때까지 자리를 못 잡는다. 속도 상수를 건드리지 않고 dt 를 키운다.
      //   ⚠ 배수는 1.8 이라 한 프레임 이동이 0.09초치 — 순간이동으로 보이지 않는다.
      strikeMoveToward(u, p.x, p.y, dt * CAMP_RETURN_K); n++; }
    if(n && typeof strikeSeparate === 'function') strikeSeparate();  // 겹친 것을 밀어낸다(공용 함수)
  });
  return n; }

// ── [js/19-camp.js] campEngageStep
function campEngageStep(dt){
  if(!CAMPB || !CAMPB.me || typeof strikeMoveToward !== 'function') return 0;
  if(typeof strikeFindUnit !== 'function') return 0;
  // ① 표적별로 붙은 아군을 모은다
  const byTgt = new Map();
  for(const u of CAMPB.me.units){
    if(u.dead || !u.tgtUid) continue;
    if(campInBunker(u)) continue;              // 🧱 벙커에 탄 유닛은 나가지 않는다(무너졌으면 나간다)
    if(!byTgt.has(u.tgtUid)) byTgt.set(u.tgtUid, []);
    byTgt.get(u.tgtUid).push(u); }
  if(!byTgt.size) return 0;
  let n = 0;
  campWithStk(function(){
    for(const pair of byTgt){
      const list = pair[1];
      const t = strikeFindUnit(CAMPB.ai.units, pair[0]);
      if(!t || t.dead) continue;                       // 죽은 표적은 campPostStep 이 복귀로 처리한다
      list.sort(function(a, b){ return (a.uid < b.uid) ? -1 : (a.uid > b.uid) ? 1 : 0; });
      const cnt = list.length;
      for(let i = 0; i < cnt; i++){
        const u = list[i], rng = u.rng || 0;
        if(rng <= 0) continue;                          // 안 때리는 유닛(의무병 등)은 건드리지 않는다
        // ⛔ **사거리 끝을 「지키려」 하지 않는다 — 뒤로는 안 물러난다** (2026-08-31 사용자 지적).
        //   ⚠ 증상: 「유닛들이 멈췄다 갔다 한다. 적이 몰려오면 도망 다니는 것처럼 보인다.」
        //   ⭐ 원인: 목표를 늘 `표적에서 rng×0.85` 로 잡으니, **적이 다가오면 그 거리를 지키려고
        //     뒤로 밀려났다.** 적 사거리는 아군보다 짧아(campFoeRngCap) 계속 붙으러 오는데
        //     아군은 계속 물러나니 **매 프레임 방향이 뒤집힌다.**
        //     실측(마린 10기 · 30초): 방향 뒤집힘 **유닛당 33.9회** · 표적 바뀜은 2.1회뿐 —
        //     표적이 흔들려서가 아니라 **거리 유지 때문**이라는 뜻이다.
        //   ⭐ 그래서 **다가가는 데만** 쓴다: 이미 그보다 가까우면 지금 거리를 그대로 둔다.
        //     각도(부채꼴·링)는 그대로 계산되므로 옆으로 벌리는 것은 계속 된다.
        //   ⚠ 이 식은 예전에 한 번 33% 로 실패했었다(시도 ②). 그때는 **레인저가 3칸**이라
        //     사거리 자체가 짧았고 층 배치도 없었다 — 조건이 다르다.
        // ⛔ `Math.min(지금거리, …)` 로 「뒤로 안 간다」를 만들지 말 것 — **세 번 실패했다.**
        //   도착 판정을 90 으로 넓힌 뒤에도 43% 였다(그 전엔 0% · 33%).
        //   앞줄이 멈추면 뒷줄이 갈 곳이 없다는 구조는 무엇과 조합해도 그대로다.
        const want = rng * (u.melee ? CAMP_ENG_MELEE : CAMP_ENG_RANGED);
        // 기준 각도 — **자기 자리 쪽**이다. 아군은 아래(자기 진영)에서 올려다보므로
        // 원거리는 그 방향을 중심으로 벌려야 적 뒤로 돌아가지 않는다.
        const home = u._post || u;
        const base = Math.atan2(home.y - t.y, home.x - t.x);
        let ang;
        if(u.melee){
          ang = base + (i - (cnt - 1) / 2) * (Math.PI * 2 / Math.max(1, cnt));   // ㉠ 둘러싸기
        } else {
          // ㉡ 부채꼴 — 간격이 각도로 얼마인지 거리에서 역산한다(멀수록 좁은 각도로 충분하다)
          const step = Math.min(CAMP_ENG_ARC / Math.max(1, cnt), 2 * Math.asin(Math.min(0.9, CAMP_ENG_GAP / (2 * Math.max(1, want)))));
          ang = base + (i - (cnt - 1) / 2) * step; }
        let gx = t.x + Math.cos(ang) * want, gy = t.y + Math.sin(ang) * want;
        // 🚧 **자리에서 멀리 나가지 않는다** (2026-08-30 사용자 확정).
        //   ⛔ 그냥 두면 적을 **따라 들어간다** — 표적이 멀수록 멀리 쫓아가서 자리가 무너지고,
        //     전선이 계속 움직여 **벙커·포탑 같은 고정 방어가 아무 뜻이 없어진다**
        //     (실측 2026-08-30: 벙커에 태운 판이 안 태운 판보다 늘 느렸다 · 실효 0.45 vs 1.4).
        //   ⭐ 원하는 그림은 「제자리에서 조금만 나가 도와주고 자리를 지킨다」다.
        //     그래서 목표 자리를 **_post 로부터 CAMP_ENG_OUT 안**으로 자른다.
        //   ⚠ 사거리가 안 닿으면 그냥 안 닿는 채로 둔다 — 그것이 「자리를 지킨다」의 뜻이다.
        //     적이 결국 자리 쪽으로 오므로 기다리면 만난다(적은 내 건물을 치러 내려온다).
        //   ⭐ 상한은 **층마다 다르다**(campEngageOut) — 뒤로 밀린 긴 사거리 유닛은 덜 나가고,
        //     앞줄의 짧은 사거리 유닛은 더 나간다. 그래야 긴 유닛이 앞을 막아도 짧은 유닛이 닿는다.
        { const home = u._post, lim = campEngageOut(u);
          if(home){ const ox = gx - home.x, oy = gy - home.y, od = Math.hypot(ox, oy);
            if(od > lim){ gx = home.x + ox / od * lim;
                          gy = home.y + oy / od * lim; } } }
        const dx = gx - u.x, dy = gy - u.y;
        if(dx * dx + dy * dy <= CAMP_ENG_OK * CAMP_ENG_OK){ u.moving = false; continue; }
        // ⏱ **간격은 「목표 계산」에 건다 — 이동은 매 프레임 정상 속도로** (2026-08-31).
        //   ⛔ 처음엔 이동 자체를 가끔만 하고 **0.4초치를 한 프레임에 몰아서** 밀었다.
        //     그래서 유닛이 **훅훅 튀었다** — 실측: 자리 잡기에서 순간이동 236회(최대 203px).
        //     사용자가 화면에서 「튕기면서 순간이동한다」고 본 것이 이것이다.
        //   ⭐ 떨림의 원인은 **목표가 매 프레임 바뀌는 것**이지 이동이 잦은 게 아니다.
        //     그러니 목표만 CAMP_ENG_TICK 마다 갱신하고, **이동은 매 프레임 dt 만큼** 한다.
        //     → 이동량이 정상이라 안 튀고, 목표가 안정적이라 덜 떨린다.
        u._engT = (u._engT || 0) - dt;
        if(u._engT <= 0 || u._engGx == null){ u._engT = CAMP_ENG_TICK; u._engGx = gx; u._engGy = gy; }
        const tx = u._engGx, ty = u._engGy;
        const ddx = tx - u.x, ddy = ty - u.y;
        if(ddx * ddx + ddy * ddy <= CAMP_ENG_OK * CAMP_ENG_OK){ u.moving = false; continue; }
        if(u._sx != null){ u.x = u._sx; u.y = u._sy; }   // strike 가 옮긴 것을 무르고
        strikeMoveToward(u, tx, ty, dt); n++; } }        // ⭐ dt — 몰아서 밀지 않는다
    if(n && typeof strikeSeparate === 'function') strikeSeparate();
  });
  return n; }

// ── [js/19-camp.js] campLeash
// 🪢 **목줄** — **자기 자리**에서 CAMP_LEASH 보다 멀어지면 그 선까지 끌어당긴다.
//   ⛔ 「인식 거리를 넓힌다」만 하고 이걸 빼면 적 본진까지 쫓아간다. 그러면 아군이 흩어져
//     각개격파되고, 적이 건물을 때리는데 아군은 저 위에 있는 그림이 된다.
//   ⚠ 속도를 깎지 않고 **위치만** 자른다 — 이동 로직(stepUnitMove)은 공용이라 건드리지 않는다.
function campLeash(){
  if(!CAMPB || !CAMPB.me) return 0;
  const L2 = CAMP_LEASH * CAMP_LEASH; let n = 0;
  const fb = campRallyPoint();                     // 자리가 아직 없는 유닛만 옛 기준을 쓴다
  for(const u of CAMPB.me.units){ if(u.dead) continue;
    const r = u._post || fb; if(!r) continue;
    const dx = u.x - r.x, dy = u.y - r.y, d2 = dx * dx + dy * dy;
    if(d2 <= L2) continue;
    const d = Math.sqrt(d2) || 1;
    u.x = r.x + dx / d * CAMP_LEASH; u.y = r.y + dy / d * CAMP_LEASH; n++; }
  return n;
}

// ── [js/19-camp.js] campDown
// 누워 있는(부활 대기) 유닛 수 — 승패 판정이 쓴다
function campDown(){ return (CAMPB && CAMPB._down) ? CAMPB._down.length : 0; }

// ── [js/19-camp.js] campHasRace
function campHasRace(){ const C = campState(); return !!(C && C.race); }

// ── [js/19-camp.js] campCost
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
  const _d = campUpgDisc();   // 🌳 「업그레이드 비용」 — 건물·유닛 값도 캠프가 매긴다
  return { m: Math.round(m * CAMP_COST_K * _d), g: Math.round(g * CAMP_COST_K * _d), lv: L };
}

// ── [js/19-camp.js] campMileMul
function campMileMul(lv){
  let mul = 1, m = CAMP_MILE_FIRST;
  while(lv >= m && mul < 1e12){ mul *= 2; m = (m === CAMP_MILE_FIRST) ? CAMP_MILE_SECOND : m * 2; }
  return mul;
}

// ── [js/19-camp.js] campTapAt
// 눌린 곳이 광맥인가 — 맞으면 캐고 true
// ⚠ human=true 는 **실제 사람 이벤트로 들어온 탭**에만 준다(아래 리스너). 그때만 감쇠를 잰다 —
//   벤치·스모크가 직접 부르는 탭까지 감쇠하면 측정값이 오염된다.
function campTapAt(clientX, clientY, human){
  if(!_campOn || typeof G === 'undefined' || !G.tech) return false;
  if(typeof _btRect !== 'function' || typeof _techS2W !== 'function' || typeof _techMineralAt !== 'function') return false;
  const r = _btRect(); if(!r || !r.width || !r.height) return false;
  const sx = (clientX - r.left) / r.width, sy = (clientY - r.top) / r.height;
  if(sx < 0 || sx > 1 || sy < 0 || sy > 1) return false;
  if(sy < 0.13) return false;                       // 상단바 — techPtrDown 과 같은 규약
  const w = _techS2W(sx, sy);
  const m = _techMineralAt(w.x, w.y); if(!m || m.amount <= 0) return false;
  campFevRoll();                                    // ⚡ 광맥 탭도 같은 판정
  let gain = Math.min(campTapGain(), m.amount);     // 매장량보다 많이 캘 수는 없다
  if(human){ gain = Math.max(1, Math.floor(gain * campTapHuman(clientX, clientY))); }   // 🤖 리듬·좌표 감쇠
  m.amount -= gain;
  G.tech.credit = (G.tech.credit || 0) + gain;
  _campTapAcc += gain;                              // 이 몫에는 채취 배수를 걸지 않는다(위 참고)
  _campTapEarn += gain;                             // 📊 표시용(경제와 무관)
  const C = campState(); if(C) C.tapped = (C.tapped || 0) + 1;   // 실측용 — 손 축이 얼마나 쓰였나
  if(typeof updateCurBar === "function") updateCurBar();
  else if(typeof techUIRender === 'function') techUIRender();
  return true;
}

// ── [js/19-camp.js] campMineOpen
function campMineOpen(){ openCampMine(); }   // 별칭 — 호출부가 어느 이름을 쓰든 통하게

// ── [js/19-camp.js] campHQ
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

// ── [js/22-camp-rune.js] campRuneMaxRound
function campRuneMaxRound(){ const per = (typeof CAMP_ROUND_MAX !== 'undefined') ? CAMP_ROUND_MAX : 50;
  const dgs = (typeof CAMP_DG_MAX !== 'undefined') ? (CAMP_DG_MAX | 0) : 10;
  return per * Math.max(1, dgs); }

// ── [js/22-camp-rune.js] campRuneNextAt
// 다음 칸이 열리는 라운드(전부 열렸으면 0)
function campRuneNextAt(kind){ const tb = RUNE_SLOT_R[kind] || []; const b = campRuneBestRound();
  for(const r of tb) if(b < r) return r; return 0; }

// ── [js/22-camp-rune.js] runeGradeOf
function runeGradeOf(key){ return runeParse(key).gd; }

// ── [js/22-camp-rune.js] campRuneSwapOn
function campRuneSwapOn(){ return !!_runeSwapKey; }

// ── [js/22-camp-rune.js] _runeCellVeil
function _runeCellVeil(kind, i, on){
  _runeVeil = on ? _runeVeilKey(kind, i) : '';
  const el = _runeCellEl(kind, i);      // 이미 그려져 있으면 지금 것도 맞춘다
  if(el) el.classList.toggle('veil', !!on); }

// ── [js/05-home.js] hbCloseRounds
function hbCloseRounds(){ const el=document.getElementById('hbRoundSheet'); if(el) el.classList.add('hide');
  _hbPick=null; clearTimeout(_hbRdT); _hbRdT=null;
  if(typeof playSfx==='function') playSfx('ui_close'); }

// ── [js/05-home.js] hbRdPad
// 위아래 여백 = (보이는 높이 - 칸 높이)/2. 이게 있어야 첫·마지막 칸도 가운데에 설 수 있다.
function hbRdPad(){ const sc=document.getElementById('hbRdScroll'); if(!sc) return;
  const pad=Math.max(0,(sc.clientHeight-HB_RD_H)/2);
  sc.style.paddingTop=pad+'px'; sc.style.paddingBottom=pad+'px'; }

// ── [js/05-home.js] hbRdSettle
function hbRdSettle(){ const sc=document.getElementById('hbRdScroll'); if(!sc||!_hbPick) return;
  const top=hbRdTop(_hbPick.dg,_hbPick.round), best=hbBest(_hbPick.dg);
  const i=Math.max(0,Math.min(top-1, Math.round(sc.scrollTop/hbRdPitch())));
  let r=top-i;
  if(r>best){ r=best; hbRdCenter(r,true); }        // 잠긴 목표 칸에 멈췄으면 고를 수 있는 데까지 되돌린다
  if(r===_hbPick.round) return;
  _hbPick.round=r; hbRdMark(); if(typeof playSfx==='function') playSfx('ui_tab'); }

// ── [js/05-home.js] renderRoundSheet
function renderRoundSheet(){ const H=hbHunt(), sc=document.getElementById('hbRdScroll'); if(!sc) return;
  if(!_hbPick) _hbPick={ dg:(_hb?_hb.dg:H.dg)||1, round:(_hb?_hb.round:H.round)||1 };
  const dg=_hbPick.dg, best=hbBest(dg);
  _hbPick.round=Math.max(1,Math.min(best,_hbPick.round));
  // 던전 카드 — 배경 그림은 전장이 쓰는 것과 같은 파일(새 에셋을 만들지 않는다)
  { const card=document.getElementById('hbPickCard'), D=hbDun(dg);
    if(card){ card.className='hbDgc';
      card.innerHTML='<div class="hbDgcArt" style="background-image:url(\''+HB_BG_DIR+'dg'+dg+'.webp\')"></div>'
        +'<div class="hbDgcTx"><b>던전 '+dg+' · '+D.name+'</b><em>최고 도달 '+best+' 라운드</em></div>'; } }
  { const pv=document.getElementById('hbPickPrev'), nx=document.getElementById('hbPickNext');
    const has=(d)=>{ for(let n=dg+d;n>=1&&n<=HB_DG_MAX;n+=d) if(hbDgOpen(n)) return true; return false; };
    if(pv) pv.disabled=!has(-1); if(nx) nx.disabled=!has(1); }
  // 라운드 — 큰 수가 위, 1이 맨 아래. 최고 도달까지 고를 수 있고, 그 위의 '다음 마일스톤'은 잠긴 목표로만 보인다.
  let h='';
  for(let i=hbRdTop(dg,_hbPick.round);i>=1;i--){ const rw=hbRoundRw(dg,i), got=rw&&hbRwGot(dg,i), far=i>best;
    h+='<button class="hbRd'+(i===_hbPick.round?' on':'')+(far?' far':'')+'" data-r="'+i+'"'
      +(far?' disabled':(' onclick="hbRdTap('+i+')"'))+'>'+i
      +(i===best&&best>1?'<u>최고</u>':'')+(rw?('<u>'+(got?'✓':'🎁')+'</u>'):'')+'</button>'; }
  sc.innerHTML=h;
  hbPickNote();
  const r=document.getElementById('hbModeRep'), c=document.getElementById('hbModeClm');
  if(r) r.classList.toggle('on', !H.climb); if(c) c.classList.toggle('on', !!H.climb); }

// ── [js/05-home.js] hbSetRound
// 라운드 이동의 실제 동작 — 시트를 여닫지 않는다(화살표 ±1과 목록 선택이 함께 쓴다)
function hbSetRound(n){ const H=hbHunt(), best=hbBest(H.dg);
  n=Math.max(1,Math.min(Math.min(best,HB_ROUND_MAX),n|0)); if(n===H.round && _hb && _hb.round===n) return false;
  H.round=n; saveMeta();
  if(_hb){ _hb.round=n; _hb.wave=1; _hb.phase='fight'; _hb.buf={min:0,gas:0,xp:0,kills:0};
    _hb.foes.length=0; _hb.pend.length=0; _hb.char.hp=_hb.char.hpMax; hbSpawnWave(); }
  if(typeof playSfx==='function') playSfx('ui_open');
  hbHud(); return true; }

// ── [js/07-home-upgrade.js] renderInfoModal
function renderInfoModal(){ const box=document.getElementById('hbInfoBody'); if(!box) return;
  const c=CHAR(); if(!c) return;
  let h='<div class="hbRoundNote" style="padding:0 0 8px">'+escHtml(c.name)+' · Lv.'+c.level
    +' · 파워 <b>'+profPower()+'</b>'+(c.reb?(' · 환생 '+c.reb+'회'):'')+'</div>';
  // ① 기본 스탯 — 출처는 넷뿐이다. 가산(업그레이드·장비)은 숫자로, 배수(레벨·환생 포인트)는 %로 적는다.
  //    열 순서 = 계산 순서((기본+업그레이드+장비) × 레벨 × 환생) — 읽는 대로 계산되게 둔다.
  h+='<div class="hbGrowLbl">기본 스탯 <span class="hbTblSub">업그레이드 · 장비 · 레벨 · 환생</span></div>'
    +'<table class="hbTbl"><thead><tr><th>스탯</th><th>기본</th><th>업그레이드</th><th>장비</th><th>레벨</th><th>환생</th><th>합</th></tr></thead><tbody>';
  const pc=v=>((v-1)>1e-9)? ('+'+Math.round((v-1)*100)+'%') : '-';
  // ⚠ 열마다 반올림하면 '0 + 10 → 9.6' 처럼 합이 안 맞아 보인다(체력회복 1.2/레벨). 소수는 소수로 적는다.
  // ⚠ 큰 수는 fmtCur 로 넘긴다 — 이 표는 열이 좁아 원시 숫자가 들어오면 통째로 밀린다
  const n1=v=>(Math.abs(v)>=1e5)? fmtCur(v)
            : ((Math.abs(v-Math.round(v))<0.05)? String(Math.round(v)) : v.toFixed(1));
  for(const k of CS_ORDER){ const a=csAxis(k);
    h+='<tr><td class="l">'+a.name+'</td><td>'+n1(a.base)+'</td>'
      +'<td>'+(a.upg? ('+'+n1(a.upg)) : '-')+'</td>'
      +'<td>'+(a.gear? ('+'+n1(a.gear)) : '-')+'</td>'
      +'<td>'+pc(a.lp)+'</td><td>'+pc(a.rp)+'</td>'
      +'<td class="s">'+csFmt(k, a.sub)+(a.capped?' <i>상한</i>':'')+'</td></tr>'; }
  h+='</tbody></table>';
  // ② 전투 수치 = 기본 스탯 × 추가 보정(장비 어빌리티 % · 펫/동료 패시브). 원천이 생기면 csBonus 가 답한다.
  h+='<div class="hbGrowLbl">전투 수치 <span class="hbTblSub">기본 스탯 + 추가 보정</span></div>'
    +'<table class="hbTbl"><tbody>';
  for(let i=0;i<CS_ORDER.length;i+=2){ h+='<tr>';
    for(const k of CS_ORDER.slice(i,i+2))
      h+='<td class="l">'+CS_AXES[k].name+'</td><td class="s">'+csFmt(k, csVal(k))+'</td>';
    if(CS_ORDER.slice(i,i+2).length<2) h+='<td></td><td></td>';
    h+='</tr>'; }
  h+='</tbody></table>';
  if(!csHasBonus()) h+='<div class="hbRoundNote" style="padding:6px 0 0">추가 보정 원천이 아직 없습니다 — 장비 어빌리티·펫/동료 패시브가 생기면 여기에 얹힙니다.</div>';
  box.innerHTML=h; }

// ── [js/08-hunt.js] HB_DG_HP
// ⚠ 아래 넷은 '던전 시작까지의 누적 배수'다 — hbCurve(base,dg,1) 과 같다(옛 이름 호환).
function HB_DG_HP (dg){ return hbCurve(HB_ROUND_HP , dg, 1); }   // 적 체력

// ── [js/19-camp.js] openCampMine
function openCampMine(){
  const el = document.getElementById('campMineSheet'); if(!el) return;
  el.classList.remove('hide'); campMineRender();
  if(typeof playSfx === 'function') playSfx('ui_open');
}

// ── [js/05-home.js] hbDgOpen
// 던전 N 해금 = 던전 N-1에서 HB_DG_UNLOCK 라운드 도달. 던전 1은 항상 열려 있다.
function hbDgOpen(dg){ return HB_DG_ALL_OPEN || dg<=1 || (hbHunt().best[dg-1]||0)>=HB_DG_UNLOCK; }

// ── [js/05-home.js] hbRdTap
// 칸을 눌러 고르면 그 칸이 가운데로 미끄러져 온다
function hbRdTap(r){ if(!_hbPick) return; _hbPick.round=r; hbRdMark(); hbRdCenter(r,true);
  if(typeof playSfx==='function') playSfx('ui_tab'); }

// ── [js/08-hunt.js] csHasBonus
function csHasBonus(){ for(const k of CS_ORDER) if(Math.abs(csBonus(k)-1)>1e-9) return true; return false; }

// ── [js/05-home.js] hbRdCenter
// 라운드 → 스크롤 위치. 목록은 큰 수가 위라 인덱스 = (최대 - 라운드).
function hbRdCenter(round, smooth){ const sc=document.getElementById('hbRdScroll'); if(!sc||!_hbPick) return;
  const top=hbRdTop(_hbPick.dg,_hbPick.round), i=Math.max(0,Math.min(top-1, top-round));
  sc.scrollTo({ top:i*hbRdPitch(), behavior:smooth?'smooth':'auto' }); }

// ── [js/05-home.js] hbRdMark
// 강조만 갈아 끼운다 — 목록을 다시 그리면 스크롤이 튄다
function hbRdMark(){ const sc=document.getElementById('hbRdScroll'); if(!sc||!_hbPick) return;
  for(const b of sc.querySelectorAll('.hbRd')) b.classList.toggle('on', +b.dataset.r===_hbPick.round);
  hbPickNote(); }

// ── [js/05-home.js] hbRdPitch
function hbRdPitch(){ return HB_RD_H+HB_RD_GAP; }

// ── [js/05-home.js] hbRdTop
// 피커 맨 윗 칸 = 최고 도달, 단 '다음 마일스톤'이 더 위면 거기까지 잠긴 칸으로 보여 준다(도전정신).
function hbRdTop(dg,round){ const b=hbBest(dg); return Math.min(HB_ROUND_MAX, Math.max(b, hbNextRw(dg,round||b)||0)); }

// ── [js/05-home.js] hbPickNote
// 안내 줄은 없앴다(2026-08-14) — 칸 안의 🎁/✓·최고 표시로 충분하고, 세 줄짜리 설명이 피커를 눌렀다.
function hbPickNote(){}

// ── [js/08-hunt.js] hbNextRw
// 다음으로 노릴 마일스톤(아직 안 받은 것 중 가장 가까운 것) — 팝업 안내 문구용
function hbNextRw(dg,from){ const best=hbBest(dg);
  for(let r=HB_RW_EVERY; r<=Math.max(best,from||1)+HB_RW_EVERY*4; r+=HB_RW_EVERY)
    if(!hbRwGot(dg,r)) return r;
  return 0; }
