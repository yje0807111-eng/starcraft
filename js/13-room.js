/* ============================================================================
 * 13-room.js — 실제 방 시스템(Supabase Realtime) · 대기실 · 대기실 채팅 · 자리 교체
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ============================================================================
// ★ 실제 방 시스템 — Supabase Realtime presence 기반(DB 테이블 불필요)
//   · 'rooms' 채널: 방장이 자기 방 정보를 presence로 게시. 연결이 끊기면 자동
//     소멸하므로 유령 방이 남지 않는다. 다른 유저는 같은 채널을 구독만 해서
//     실시간 방 목록을 받는다.
//   · 'room-{번호}' 채널: 대기실. 입장자가 presence(uid/nick/ready/입장시각)로
//     슬롯을 차지하고, broadcast(rchat=채팅, start=게임 시작, close=방 닫힘).
//   · RT 미연결(오프라인/로컬 계정)이면 기존 봇 시뮬 방으로 폴백.
// ============================================================================
const RTROOM={ listChan:null, chan:null, num:null, host:false, meta:null, started:false, joinT:0, overN:0 };
// 대기실 presence 에 싣는 내 상태. ⚠ track 은 **덮어쓰기**라 매번 전부 실어야 한다 —
//   일부만 보내면 나머지(입장 시각 t 등)가 지워져 슬롯 순서가 뒤바뀐다.
function rtRoomMe(){ return { uid:myUid(), nick:myNick(), ready:true, host:!!RTROOM.host,
  race:(typeof _selRace!=='undefined' && _selRace) || 'terran', t:RTROOM.joinT||Date.now() }; }
// 내 종족이 바뀌면 presence 를 다시 실어 상대 화면에도 반영한다
function rtRoomSetRace(){ if(!RTROOM.chan) return;
  try{ RTROOM.chan.track(rtRoomMe()); }catch(e){ console.warn('rtRoomSetRace', e); } }
function rtRoomsActive(){ return typeof RT!=='undefined' && RT.active && _sb; }
// 방 목록 채널 구독(1회) — presence sync로 _roomList 실시간 갱신
function rtRoomsEnsure(){ if(!rtRoomsActive() || RTROOM.listChan) return;
  try{
    RTROOM.listChan=_sb.channel('rooms', { config:{ presence:{ key:myUid() } } });
    RTROOM.listChan.on('presence',{event:'sync'}, rtRoomsSync).subscribe(st=>{
      if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'){   // 목록 채널 끊김 → 3초 후 재구독(방장이면 방 정보 재게시)
        try{ _sb.removeChannel(RTROOM.listChan); }catch(e){} RTROOM.listChan=null;
        setTimeout(()=>{ if(rtRoomsActive()){ rtRoomsEnsure(); if(RTROOM.meta) setTimeout(()=>rtRoomPublish(RTROOM.meta), 800); } }, 3000); } });
  }catch(e){ console.warn('rtRoomsEnsure', e); RTROOM.listChan=null; } }
function rtRoomsSync(){ if(!RTROOM.listChan) return;
  try{
    const st=RTROOM.listChan.presenceState()||{};
    const rooms=[];
    Object.keys(st).forEach(uid=>{ (st[uid]||[]).forEach(m=>{ if(m&&m.num) rooms.push(Object.assign({real:true},m)); }); });
    rooms.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    _roomList=rooms;
    const rm=document.getElementById('rooms');
    if(rm && !rm.classList.contains('hide')) renderRoomList();
  }catch(e){ console.warn('rtRoomsSync', e); } }
// 방장: 방 정보 게시/갱신(presence 재track = 갱신)
function rtRoomPublish(meta){ RTROOM.meta=meta; if(!RTROOM.listChan) return;
  try{ RTROOM.listChan.track(meta); }catch(e){ console.warn('rtRoomPublish', e); toast('⚠️ 방 정보 전송에 실패했습니다'); } }
function rtRoomClose(){ if(!RTROOM.host && !RTROOM.meta) return;
  try{ if(RTROOM.listChan) RTROOM.listChan.untrack(); }catch(e){}
  RTROOM.meta=null; RTROOM.host=false; }
// 대기실 채널 입장(방장/참가자 공통)
function rtRoomJoin(num, asHost){ rtRoomLeaveChan(); RTROOM.num=num; RTROOM.host=!!asHost; RTROOM.started=false; RTROOM.overN=0;
  try{
    const topic='room-'+num;
    try{ (_sb.getChannels()||[]).forEach(c=>{ if(c.topic===topic||c.topic==='realtime:'+topic) _sb.removeChannel(c); }); }catch(e){}
    RTROOM.chan=_sb.channel(topic, { config:{ broadcast:{ self:false }, presence:{ key:myUid() } } });
    RTROOM.chan
      .on('presence',{event:'sync'}, rtRoomSync)
      .on('broadcast',{event:'rchat'}, m=>{ const q=m.payload; if(q&&q.uid!==myUid()) addLobbyMsg(q.nick||'?', q.text, q.color); })
      .on('broadcast',{event:'start'}, m=>rtRoomOnStart(m.payload))
      .on('broadcast',{event:'close'}, m=>rtRoomKicked('방장이 방을 닫았습니다'))
      .subscribe(st=>{ if(st==='SUBSCRIBED'){
          RTROOM.joinT=Date.now();   // 내 입장 시각 — 종족을 다시 track 할 때도 순서가 안 흔들리게 보존한다
          try{ RTROOM.chan.track(rtRoomMe()); }catch(e){}
        } else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'){ toast('⚠️ 대기실 연결이 불안정합니다'); } });
  }catch(e){ console.warn('rtRoomJoin', e); toast('⚠️ 방 입장에 실패했습니다'); rtRoomLeaveChan(); } }
function rtRoomLeaveChan(){ if(RTROOM.chan){ try{ _sb.removeChannel(RTROOM.chan); }catch(e){} RTROOM.chan=null; } RTROOM.num=null; }
// 대기실 presence → 슬롯 구성(입장 시각 순, 방장=P1)
function rtRoomSync(){ if(!RTROOM.chan || !_lobbyRoom || !_lobbyRoom.real) return;
  if(document.getElementById('lobby').classList.contains('hide')) return;   // 게임 진입 후 sync 무시
  try{
    const st=RTROOM.chan.presenceState()||{};
    let mem=[]; Object.keys(st).forEach(uid=>{ const m=(st[uid]||[])[0]; if(m&&m.uid) mem.push(m); });
    mem.sort((a,b)=>(b.host?1:0)-(a.host?1:0) || (a.t||0)-(b.t||0));   // 방장 먼저, 그 다음 입장순
    // ⚠ 정원은 **여기서** 강제한다. joinRoom 의 사전 검사는 방장이 presence 로 게시한 cur 를 보는 것이라
    //   갱신 지연·동시 입장에 뚫린다(2인 방에 5명이 들어가 그대로 시작됐다).
    //   모든 클라이언트가 같은 presence 를 같은 규칙(방장 먼저 → 입장순)으로 정렬하므로 판정이 일치한다.
    const cap=Math.max(2, Math.min(8, _lobbyMax||8));
    if(mem.length>cap && mem.findIndex(m=>m.uid===myUid())>=cap){
      RTROOM.overN=(RTROOM.overN||0)+1;                       // 어긋난 sync 한 번으로 튕기지 않게 두 번 연속일 때만
      if(RTROOM.overN>=2){ rtRoomKicked('방이 가득 찼습니다'); return; } }
    else RTROOM.overN=0;
    mem=mem.slice(0,cap);
    // 방장 이탈 감지(참가자만): 방장이 presence에서 사라지면 방이 닫힌 것
    if(!RTROOM.host && _lobbyRoom.hostUid && !mem.some(m=>m.uid===_lobbyRoom.hostUid)){ rtRoomKicked('방장이 방을 나갔습니다'); return; }
    const before=_lobbySlots.filter(Boolean).length;
    _lobbySlots=[null,null,null,null,null,null,null,null];
    mem.forEach((m,k)=>{ _lobbySlots[k]={ name:'P'+(k+1), label:m.nick, uid:m.uid, me:m.uid===myUid(), bot:false, ready:m.ready!==false, host:!!m.host,
      race:(m.race && STK_RACES[m.race]) ? m.race : undefined }; });   // 상대 종족 = presence 값(없으면 renderLobby 가 배정)
    renderLobby(); updateLobbyStart();
    const now=mem.length;
    if(before && now>before){ addLobbyMsg('', (mem[now-1].nick||'플레이어')+'님이 입장하였습니다.'); if(typeof playSfxT==='function') playSfxT('notify',400); }
    else if(before && now<before) addLobbyMsg('', '플레이어가 나갔습니다.');
    if(RTROOM.host && RTROOM.meta && RTROOM.meta.cur!==now){ RTROOM.meta.cur=now; rtRoomPublish(RTROOM.meta); }   // 목록 인원 갱신
  }catch(e){ console.warn('rtRoomSync', e); } }
// 참가자가 방에서 쫓겨남(방장 이탈/방 닫힘) → 방 목록으로
function rtRoomKicked(msg){ rtRoomLeaveChan();
  document.getElementById('lobby').classList.add('hide');
  toast('ℹ️ '+(msg||'방이 닫혔습니다')); openRooms(); }
// 방장의 시작 신호 수신(참가자) — 슬롯 배정은 방장 payload가 권위
function rtRoomOnStart(p){ if(!_lobbyRoom || !_lobbyRoom.real || RTROOM.started) return; RTROOM.started=true;
  const slots=(p&&p.slots)||[]; if(!slots.length){ RTROOM.started=false; return; }
  const active=slots.map(x=>x.num), names=(p&&p.names)||{};
  let myNum=0; slots.forEach(x=>{ if(x.uid===myUid()) myNum=x.num; });
  if(!myNum){ rtRoomKicked('게임 시작 명단에 없습니다'); return; }
  if(p.diff && DIFFICULTY[p.diff]) _selDiff=p.diff;
  // 방장이 정한 판 조건이 권위다 — 대전 설정·무한 여부·내 종족을 받아 적용한다.
  // ⚠ startGameNow 는 _lobbyRoom.opts 를 보고 MAP_CFG_OVR 을 심으므로 **그 전에** 넣어야 한다.
  _lobbyRoom.opts = p.opts || null;
  if(p.inf && USEMAPS.nemo_inf) _selMap=USEMAPS.nemo_inf;
  { const mine=slots.find(function(x){ return x.uid===myUid(); });
    if(mine && mine.race && STK_RACES[mine.race]) _selRace=mine.race; }
  document.getElementById('lobby').classList.add('hide');
  startGameNow(active, myNum, names);
  startGameCoop(slots);
  setTimeout(rtRoomLeaveChan, 600); }   // 시작 후 대기실 채널 정리(게임은 game-{번호} 채널)

// ── 멀티플레이 대기실(로비) ──
const LOBBY_NAMES=['Striker','GG준비됨','리퍼장인','Crystalize','보이드킹','노바777','Sentinel','막눈'];
let _lobbyT=null, _lobbySlots=[];
let _lobbyMax=8, _lobbyLock=[];   // 방 정원(2~8) · 호스트가 잠근 빈 슬롯 인덱스
let _lobbyRoom=null;
function openLobby(room){ _lobbyRoom=room||{name:'나의 대기실',host:'나',joining:false,startCount:1};
  _lobbyMax=Math.max(2,Math.min(8, _lobbyRoom.max||8)); _lobbyLock=[];   // 정원 확정 + 잠금 초기화
  // 파티장이면 파티원도 같은 방으로 호출(실연동 파티)
  if(typeof RT!=='undefined' && RT.active && iAmPartyLeader() && _party && _party.members && _party.members.length>1){
    _lobbyRoom.party=true; if(_selMap) _lobbyRoom.map=_selMap.name; if(!_lobbyRoom._followed) rtSendPartyRoom(_lobbyRoom); }
  if(_lobbyRoom.diff && DIFFICULTY[_lobbyRoom.diff]) _selDiff=_lobbyRoom.diff;   // 방 난이도를 이 게임에 적용
  if(_lobbyRoom.inf && USEMAPS.nemo_inf) _selMap=USEMAPS.nemo_inf;   // ♾️ 무한 방 = 이 게임 맵을 무한 디펜스로(호스트·참가자 공통 진입점)
  else if(_selMap && _selMap.id==='nemo_inf' && !_lobbyRoom.inf && USEMAPS.nemo) _selMap=USEMAPS.nemo;   // 일반 방 = 되돌림
  stopRoomsTick(); setInGame(false);
  document.getElementById('ov').classList.add('hide'); document.getElementById('rooms').classList.add('hide');
  const _lb=document.getElementById('lobby'); _lb.classList.remove('hide'); if(typeof playScreenFx==='function') playScreenFx(_lb);
  const tt=document.querySelector('.lbTitle'); if(tt) tt.textContent=_lobbyRoom.name;   // 방 이름을 제목으로
  const dN=_lobbyRoom.inf?'♾️ 무한 모드':(DIFFICULTY[_lobbyRoom.diff]||DIFFICULTY[_selDiff]||DIFFICULTY.normal).name, dC=_lobbyRoom.inf?'#b06bff':(DIFF_COLOR[_lobbyRoom.diff||_selDiff]||'#888');
  renderLobbyHeadR();   // 방 번호 + 배지(난이도 / 대진)
  const cb=document.getElementById('lbChat'); if(cb) cb.innerHTML='';
  if(_lobbyRoom.real){   // 실제 방: 슬롯은 room 채널 presence가 구성(rtRoomSync), 봇 없음
    _lobbySlots=[null,null,null,null,null,null,null,null];
    renderLobby(); updateLobbyStart();
    addLobbyMsg('', myNick()+'님이 입장하였습니다.');
    return; }
  startLobbySim(_lobbyRoom);
  startLobbyChat(); }
function leaveLobby(){ stopLobbySim(); stopLobbyChat();
  if(_lobbyRoom && _lobbyRoom.real){   // 실제 방: 방장이 나가면 방 자체가 닫힘을 통지
    if(RTROOM.host){ try{ if(RTROOM.chan) RTROOM.chan.send({type:'broadcast', event:'close', payload:{from:myUid()}}); }catch(e){} rtRoomClose(); }
    rtRoomLeaveChan(); }
  document.getElementById('lobby').classList.add('hide'); openRooms(); }   // 나가기 → 방 목록
function lobbyStart(){ const players=_lobbySlots.filter(Boolean); if(players.length<2||!players.every(s=>s.ready)) return;
  if(_lobbyRoom && _lobbyRoom.real){   // 실제 방: 방장만 시작 가능, 슬롯 배정을 payload로 전파(권위=방장)
    if(!RTROOM.host || RTROOM.started) return; RTROOM.started=true;
    const slots=[], names={}; let myNum=1;
    // ⚠ 종족은 **슬롯마다** 실어야 한다 — 각자 다른 것을 고르므로 방 단위 값이 아니다
    _lobbySlots.forEach((sl,i)=>{ if(sl){ slots.push({num:i+1, uid:sl.uid, race:sl.race||undefined}); names[i+1]=sl.me?myNick():(sl.label||sl.name); if(sl.me) myNum=i+1; } });
    try{ if(RTROOM.chan) RTROOM.chan.send({type:'broadcast', event:'start',
      payload:{slots:slots, names:names, diff:_lobbyRoom.diff, inf:!!_lobbyRoom.inf, opts:_lobbyRoom.opts||null, from:myUid()}}); }catch(e){ toast('⚠️ 시작 신호 전송 실패'); RTROOM.started=false; return; }
    if(RTROOM.meta){ RTROOM.meta.status='playing'; RTROOM.meta.round=1; rtRoomPublish(RTROOM.meta); }   // 목록에 '게임중' 표시
    document.getElementById('lobby').classList.add('hide');
    startGameNow(slots.map(x=>x.num), myNum, names);
    startGameCoop(slots);
    setTimeout(rtRoomLeaveChan, 600);
    return; }
  // 파티방 방장이 누르면 파티원에게 시작 신호 전파(파티원은 스스로 시작 안 함)
  if(_lobbyRoom && _lobbyRoom.party && typeof iAmPartyLeader==='function' && iAmPartyLeader() && RT.active && RT.lobby){
    try{ RT.lobby.send({type:'broadcast', event:'party_start', payload:{ partyId:RT.partyId, from:myUid() }}); }catch(e){} }
  const active=[]; let myNum=1; const names={}; const slotInfo=[];
  _lobbySlots.forEach((s,i)=>{ if(s){ active.push(i+1); if(s.me){ myNum=i+1; names[i+1]=myNick(); } else names[i+1]=s.label||s.name; slotInfo.push({num:i+1, uid:s.uid}); } });   // 입장 순서대로 슬롯 번호 + 닉네임 + uid
  stopLobbySim(); stopLobbyChat();
  document.getElementById('lobby').classList.add('hide');   // 대기실 숨김(실제 방 경로와 동일) — 직스/오토배틀은 opening 오버레이가 없어 안 가리면 대기실이 게임 위에 남음
  startGameNow(active, myNum, names);
  if(_lobbyRoom && _lobbyRoom.party) startGameCoop(slotInfo); }   // 파티 게임이면 실시간 동기화 시작
function startLobbySim(room){ room=room||{joining:false,startCount:1,host:'나'};
  const names=LOBBY_NAMES.slice().sort(()=>Math.random()-0.5); let ni=0;
  _lobbySlots=[null,null,null,null,null,null,null,null];
  if(room.party && _party && _party.members && _party.members.length){   // 파티와 함께 입장: 파티원이 슬롯 차지
    const mem=_party.members.slice(0,8).sort((a,b)=>(b.leader?1:0)-(a.leader?1:0));   // 파티장 우선(P1)
    mem.forEach((m,k)=>{ _lobbySlots[k]={ name:'P'+(k+1), label:m.nick, uid:m.uid, me:m.uid===myUid(), bot:false, ready:true, host:!!m.leader }; });
    renderLobby(); updateLobbyStart();
    addLobbyMsg('', '파티원 '+mem.length+'명이 함께 입장했습니다.');
    return;   // 파티방은 봇 입장 시뮬 없음
  }
  if(room.joining){   // 기존 방 참여: 호스트부터 채움 순서대로, 나는 그다음 빈 자리
    const existing=Math.max(1,Math.min(_lobbyMax-1,room.startCount||2)), ord=lobbyFillOrder();
    for(let k=0;k<existing;k++){ const si=ord[k];
      _lobbySlots[si]={name:'P'+(si+1), label:k===0?room.host:names[ni++%names.length], bot:true, ready:true, host:k===0}; }
    { const mi=ord[existing]; _lobbySlots[mi]={me:true, name:'P'+(mi+1), ready:true, host:false}; }   // 나 = 채움 순서상 다음 자리
  } else {   // 방 생성: 내가 첫 자리 호스트
    _lobbySlots[lobbyFillOrder()[0]]={me:true, name:'P1', ready:true, host:true};
  }
  renderLobby(); updateLobbyStart();
  addLobbyMsg('', myNick()+'님이 입장하였습니다.');   // 내 입장부터 표시(기존 입장자는 생략, 이후 입장자만 안내)
  const cur=_lobbySlots.filter(Boolean).length;
  const target=Math.min(_lobbyMax, cur + (room.joining? Math.floor(Math.random()*3) : 1+Math.floor(Math.random()*5)));   // 추가 입장(정원 이내)
  _lobbyT=setInterval(()=>{
    const empty=lobbyNextSlot(), filled=_lobbySlots.filter(Boolean).length;   // 팀 맵이면 양 팀 번갈아 채움(잠긴 자리 제외)
    if(empty<0 || filled>=target){ stopLobbySim(); updateLobbyStart(); return; }
    const slot={name:'P'+(empty+1),label:names[ni++%names.length],bot:true,ready:false,joining:true};
    _lobbySlots[empty]=slot; renderLobby(); updateLobbyStart();
    setTimeout(()=>{ if(_lobbySlots.indexOf(slot)>=0){ slot.joining=false; slot.ready=true; renderLobby(); updateLobbyStart();
      addLobbyMsg('', (slot.label||slot.name)+'님이 입장하였습니다.'); } }, 450+Math.random()*700);
  }, 850);
}
let _autoStartT=null;
function stopLobbySim(){ if(_lobbyT){ clearInterval(_lobbyT); _lobbyT=null; } if(_autoStartT){ clearTimeout(_autoStartT); _autoStartT=null; } }   // 채팅은 대기실 떠날 때만(leaveLobby/lobbyStart) 정지
// ── 대기실 채팅 ──
const LOBBY_CHATTER=['반갑습니다','gl hf','다들 준비됐나요?','ㅎㅇ','이 맵 좋네요','초보인데 잘 부탁','ㄱㄱ 빨리','풀방 가즈아','몇 라운드까지 가봤어요?','오늘 잘 풀리길','ㅎㅎ 화이팅','시작하면 합체부터'];
let _lobbyChatT=null;
function lbMeInfo(){ const i=_lobbySlots.findIndex(s=>s&&s.me); return {col:PLAYER_VIEW_COLORS[(i<0?0:i)%PLAYER_VIEW_COLORS.length]}; }
function addLobbyMsg(name, text, color){ const box=document.getElementById('lbChat'); if(!box) return;
  const d=document.createElement('div'); d.className='lbMsg'+(name?'':' sys');
  d.innerHTML = name ? '<b style="color:'+(color||'#9fb0c2')+'">'+escHtml(name)+'</b> '+escHtml(text) : escHtml(text);
  box.appendChild(d); while(box.children.length>40) box.removeChild(box.firstChild); box.scrollTop=box.scrollHeight; }
function sendLobbyChat(){ const f=document.getElementById('lbChatField'); const t=(f.value||'').trim(); if(!t) return;
  const col=lbMeInfo().col; addLobbyMsg(myNick(), t, col);
  if(_lobbyRoom && _lobbyRoom.real && RTROOM.chan){   // 실제 방 대기실: room 채널로 공유
    try{ RTROOM.chan.send({type:'broadcast', event:'rchat', payload:{uid:myUid(), nick:myNick(), text:t, color:col}}); }catch(e){ toast('⚠️ 채팅 전송 실패'); } }
  else if(_lobbyRoom && _lobbyRoom.party && typeof RT!=='undefined' && RT.active && RT.lobby){   // 파티 대기실: 실시간 공유
    try{ RT.lobby.send({type:'broadcast', event:'roomchat', payload:{from:myUid(), num:_lobbyRoom.num, nick:myNick(), text:t, color:col}}); }catch(e){} }
  f.value=''; f.focus(); }
function startLobbyChat(){ stopLobbyChat();
  if(_lobbyRoom && _lobbyRoom.party) return;   // 파티 대기실: 봇 채팅 없이 실제 채팅만
  _lobbyChatT=setInterval(()=>{ const bots=_lobbySlots.filter(s=>s&&s.bot&&!s.joining); if(!bots.length) return;
    const b=bots[Math.floor(Math.random()*bots.length)], i=_lobbySlots.indexOf(b);
    addLobbyMsg(b.label||b.name, LOBBY_CHATTER[Math.floor(Math.random()*LOBBY_CHATTER.length)], PLAYER_VIEW_COLORS[i%PLAYER_VIEW_COLORS.length]);
  }, 2800+Math.random()*2600); }
function stopLobbyChat(){ if(_lobbyChatT){ clearInterval(_lobbyChatT); _lobbyChatT=null; } }
// 대기실 종족: 직스(컴퓨터가 싸운다) 맵에서만 활성. 그 외(네모네모 등)는 칸은 있되 잠금
function lobbyRaceEnabled(){ return !!(_selMap && _selMap.cfg && _selMap.cfg.mode==='strike'); }
// (구 경로 openLobbyRace — 칩 아래 종족 드롭다운 — 는 2026-08-19 삭제. 종족 입구는 공용 탭 띠(setLobbyRace) 하나뿐이고,
//  드롭다운 하위계(showRaceMenu/#raceMenu)도 이것이 유일한 입구여서 함께 걷어냈다.)
// 머리줄 오른쪽 = 방 번호 + 배지 한 개. 팀전이면 대진(4 vs 4), 아니면 난이도.
function renderLobbyHeadR(){ const rm=document.getElementById('lbRoom'); if(!rm) return;
  const priv=(_lobbyRoom&&_lobbyRoom.visibility==='private')?'🔒 ':'';
  const num=(_lobbyRoom&&_lobbyRoom.num)?('#'+_lobbyRoom.num):'';
  let bd='';
  if(lobbyTeams()){ const half=Math.ceil(_lobbyMax/2);
    bd='<span class="lbBd" style="--dc:#c6cdd6"><s></s>'+half+' vs '+(_lobbyMax-half)+'<s class="b"></s></span>'; }
  else if(mapHasDiff()){ const inf=!!(_lobbyRoom&&_lobbyRoom.inf);
    const dN=inf?'∞ 무한':(DIFFICULTY[(_lobbyRoom&&_lobbyRoom.diff)||_selDiff]||DIFFICULTY.normal).name;
    const dC=inf?'#b06bff':(DIFF_COLOR[(_lobbyRoom&&_lobbyRoom.diff)||_selDiff]||'#888');
    bd='<span class="lbBd" style="--dc:'+dC+'">'+escHtml(dN)+'</span>'; }
  if(_lobbyRoom && _lobbyRoom.opts) bd+='<span class="lbBd" style="--dc:#ffb14d">사용자 지정</span>';   // 기본 밸런스가 아닌 방
  rm.innerHTML=priv+num+' '+bd; }
// 이 방의 조건 — 오토배틀이면 대전 설정(사용자 지정이면 그 값), 아니면 난이도 수치.
// 방 만들기의 .cpVs 와 같은 자리·같은 모양이라 두 화면이 형제로 읽힌다.
function renderLobbyCond(){ const box=document.getElementById('lbCond'); if(!box) return;
  const cell=(nm,v,c)=>'<span><i>'+nm+'</i><b'+(c?' style="--vc:'+c+'"':'')+'>'+v+'</b></span>';
  if(lobbyTeams()){   // 오토 배틀 — 방장이 정한 값이 있으면 그것이 이긴다(없으면 맵 기본값)
    const o=(_lobbyRoom&&_lobbyRoom.opts)||null, base=(USEMAPS.cpu&&USEMAPS.cpu.cfg)||{};
    const g=(k,d)=>(o&&o[k]!==undefined)?o[k]:(base[k]!==undefined?base[k]:d);
    const cus=!!o, ac=cus?'#ffb14d':'#5aa9ff';
    box.style.setProperty('--cc', ac);
    box.innerHTML='<div class="lbCondSt">'
      +cell('라운드', g('cycleTime',20)+'초', cus?'#ffd9a8':'')
      +cell('시작 골드', g('startGold',450), cus?'#ffd9a8':'')
      +cell('라운드 수입', g('incomeBase',50), cus?'#ffd9a8':'')
      +cell('본진 체력', '×'+((o&&o.hpMul!==undefined)?o.hpMul.toFixed(1):'1.0'), cus?'#ffd9a8':'')
      +'</div>'; return; }
  if(!mapHasDiff()){ box.innerHTML=''; box.style.removeProperty('--cc'); return; }
  const inf=!!(_lobbyRoom&&_lobbyRoom.inf);
  if(inf){ box.style.setProperty('--cc','#b06bff');
    box.innerHTML='<div class="lbCondSt">'+cell('모드','∞ 무한','#d9c4ff')+cell('난이도','NORMAL')+cell('정원',_lobbyMax+'명')+'</div>'; return; }
  const dk=(_lobbyRoom&&_lobbyRoom.diff)||_selDiff, D=DIFFICULTY[dk]||DIFFICULTY.normal;
  const col=DIFF_COLOR[dk]||'#888', atk=(D.enemyHp/DIFFICULTY.easy.enemyHp).toFixed(1);
  box.style.setProperty('--cc', col);
  box.innerHTML='<div class="lbCondSt">'+cell('난이도', escHtml(D.name), col)
    +cell('적 HP','×'+atk)+cell('포인트','×'+D.coinMult)+cell('정원',_lobbyMax+'명')+'</div>'; }
// 내 종족 = 공용 탭 띠 한 줄(segNavHTML). 종족이 없는 유즈맵은 그 자리가 안내문으로 바뀐다.
// ⛔ 여기 전용 종족 UI 를 새로 만들지 말 것 — 관리자·인게임과 같은 STK_RACES/STK_RACE_ORDER 를 본다.
function renderLobbyRace(){ const box=document.getElementById('lbRaceSec'); if(!box) return;
  if(!lobbyRaceEnabled()){
    box.innerHTML='<span class="lbRaceLb">내 종족</span><div class="lbRaceLk">'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
      +'이 유즈맵은 종족을 쓰지 않습니다 — 모두 같은 조건으로 시작합니다</div>'; return; }
  const me=_lobbySlots.find(function(s){ return s&&s.me; });
  const cur=(me&&me.race)||_selRace||'terran';
  const i=Math.max(0, STK_RACE_ORDER.indexOf(cur));
  box.innerHTML='<span class="lbRaceLb">내 종족</span>'
    +segNavHTML(STK_RACE_ORDER.map(function(k){ const R=STK_RACES[k];
        return { label:R.name, col:(typeof hexChannels==='function')?hexChannels(R.col):'' }; }), i,
      function(k){ return 'setLobbyRace(&#39;'+STK_RACE_ORDER[k]+'&#39;)'; }); }
function setLobbyRace(k){ if(!STK_RACES[k]) return;
  const me=_lobbySlots.find(function(s){ return s&&s.me; }); if(me) me.race=k;
  _selRace=k; renderLobby(); renderLobbyRace();
  if(typeof rtRoomSetRace==='function') rtRoomSetRace();   // 실방이면 presence 를 다시 실어 상대 화면에도 반영
  if(typeof playSfx==='function') playSfx('ui_tab'); }
// 팀전 유즈맵(cfg.teams) = 앞 절반 1팀 / 뒤 절반 2팀. 자리를 옮기면 팀도 따라 바뀜
function lobbyTeams(){ return !!(_selMap && _selMap.cfg && _selMap.cfg.teams); }   // MAP(=플레이 중 맵)이 아니라 선택한 맵 기준 — 안 그러면 직전 게임의 맵이 대기실에 남는다
// 입장 순서: 팀 맵이면 두 팀을 번갈아(1,5,2,6,3,7,4,8) 채워 인원이 한쪽으로 쏠리지 않게
function lobbyFillOrder(){ const n=_lobbyMax, half=Math.ceil(n/2), out=[];
  if(!lobbyTeams()){ for(let i=0;i<n;i++) out.push(i); return out; }
  for(let i=0;i<half;i++){ out.push(i); if(half+i<n) out.push(half+i); }
  return out; }
// 다음에 채울 빈 자리(잠긴 자리는 건너뜀). 없으면 -1
function lobbyNextSlot(){ for(const i of lobbyFillOrder()){ if(!_lobbySlots[i] && _lobbyLock.indexOf(i)<0) return i; } return -1; }
function slotTeam(i){ return i < Math.ceil(_lobbyMax/2) ? 1 : 2; }
function renderLobby(){ const g=document.getElementById('lbGrid'); if(!g) return; g.innerHTML='';
  renderLobbyCond(); renderLobbyRace(); renderLobbyHeadR();
  const raceOn=lobbyRaceEnabled();   // 슬롯 높이는 .lbSlot에서 전 맵 공통 → 종족 칩 유무와 무관하게 창 크기 고정
  const teams=lobbyTeams(), half=Math.ceil(_lobbyMax/2);
  g.classList.toggle('teamed', teams);
  const meSlot=_lobbySlots.find(s=>s&&s.me), meHost=!!(meSlot&&meSlot.host);
  for(let i=0;i<_lobbyMax;i++){ const s=_lobbySlots[i], col=PLAYER_VIEW_COLORS[i%PLAYER_VIEW_COLORS.length], locked=(_lobbyLock.indexOf(i)>=0);
    if(teams && (i===0||i===half)){ const hd=document.createElement('div'); hd.className='lbTeamSep t'+(i?2:1);
      hd.innerHTML='<b>'+(i?'2팀':'1팀')+'</b>'; g.appendChild(hd); }   // 팀 구분 = 얇은 선 + 작은 라벨
    const el=document.createElement('div'); el.className='lbSlot'+(s?'':' empty')+(s&&s.me?' me':'')+((!s&&locked)?' locked':'')+(teams?(' tm'+slotTeam(i)):''); el.style.setProperty('--pc',col);
    if(s){ const stt = s.host?'호스트' : (s.joining?'입장 중…' : (s.ready?'준비 완료':'대기'));
      const cls = s.host?'host' : (s.ready?'ok':'');
      if(!s.race) s.race = s.me ? (STK_RACES[_selRace]?_selRace:'terran') : strikeRandomRace();   // 종족 지연 배정(나=선택값, 봇=랜덤)
      const R=STK_RACES[s.race]||STK_RACES.terran;
      // 칩은 **읽기 전용**이다 — 내 종족을 바꾸는 곳은 위 띠 하나뿐(두 입구를 두면 어디를 눌러야 할지 모른다)
      const chip = raceOn
        ? '<div class="lbRace'+(s.me?' me':'')+'" style="'+raceVars(R.col)+'"><span class="lrDot"></span><span class="lrNm">'+R.name+'</span></div>'
        : '';   // 종족이 없는 유즈맵 = 칩 없음(위 띠가 '잠김'을 대신 말한다)
      el.innerHTML='<div class="lbNum">'+(i+1)+'</div><div class="lbInfo"><span class="lbName">'+escHtml(s.me?myNick():(s.label||s.name))+'</span><span class="lbStat '+cls+'">'+stt+'</span></div>'+chip;
      if(_swapReq && _swapReq.to===i) el.classList.add('swapWait');   // 교체 요청 대기 중
      if(!s.me){ el.classList.add('tapmenu'); el.onclick=(e)=>openSlotMenu(i,e); }   // 남의 프로필 탭 → 교체/친구추가/추방 메뉴
    } else {   // 빈 슬롯: 탭하면 메뉴(이동/잠금). 잠김이면 표시.
      const _lkIco='<svg class="lbLockIco" viewBox="0 0 24 24"><path fill="currentColor" d="M5 10.4h14c.9 0 1.6.7 1.6 1.6v6.4c0 .9-.7 1.6-1.6 1.6H5c-.9 0-1.6-.7-1.6-1.6V12c0-.9.7-1.6 1.6-1.6z"/><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M7.6 10.4V7a4.4 4.4 0 0 1 8.8 0v3.4"/></svg>';   // 이모지 대신 아이콘(메뉴와 통일)
      el.innerHTML='<div class="lbNum">'+(i+1)+'</div><div class="lbEmptyMid">'+(locked?'<span class="lbLockTxt">'+_lkIco+'잠긴 자리</span>':'<span class="lbEmpty">빈 자리</span>')+'<span class="lbSlotCaret">▾</span></div>';
      el.classList.add('tapmenu'); el.onclick=(e)=>openSlotMenu(i,e);
    }
    g.appendChild(el);
  }
}
function moveToSlot(i){ if(i<0||i>=_lobbyMax||_lobbySlots[i]) return; if(_lobbyLock.indexOf(i)>=0){ if(typeof toast==='function') toast('🔒 잠긴 자리입니다'); return; }
  const j=_lobbySlots.findIndex(s=>s&&s.me); if(j<0||j===i) return;
  _lobbySlots[i]=_lobbySlots[j]; _lobbySlots[j]=null; if(typeof playSfx==='function') playSfx('ui_confirm'); renderLobby(); updateLobbyStart(); }
// ── 자리 교체 요청 ── 사람이 있는 자리를 탭 → 요청 → 상대가 수락하면 서로 자리를 맞바꾼다.
// 봇(시뮬 플레이어)은 1~3초 뒤 자동 응답(대부분 수락). 실방이면 상대에게 요청을 보낸다.
let _swapReq=null;   // {from,to,t} 진행 중인 내 요청(중복 방지)
function requestSwap(i){ const me=_lobbySlots.findIndex(x=>x&&x.me), t=_lobbySlots[i];
  if(me<0||i===me||!t||t.me) return;
  if(_swapReq){ if(typeof toast==='function') toast('⚠️ 이미 교체를 요청했습니다'); return; }
  const nm=t.label||t.name;
  _swapReq={ from:me, to:i };
  if(typeof addLobbyMsg==='function') addLobbyMsg('', nm+'님에게 자리 교체를 요청했습니다.');
  if(typeof playSfx==='function') playSfx('ui_confirm');
  renderLobby();
  if(_lobbyRoom&&_lobbyRoom.real&&typeof rtRoomSwapReq==='function'&&t.uid){ try{ rtRoomSwapReq(t.uid, me, i); }catch(e){} return; }   // 실방: 상대 응답 대기
  _swapReq.timer=setTimeout(function(){ answerSwap(Math.random()<0.8); }, 1000+Math.random()*2000);   // 봇: 잠시 뒤 자동 응답
}
// 교체 응답 처리(수락=자리 맞바꿈). 실방에서는 상대 응답이 이 함수를 부른다.
function answerSwap(ok){ const r=_swapReq; if(!r) return; if(r.timer) clearTimeout(r.timer); _swapReq=null;
  const a=_lobbySlots[r.from], b=_lobbySlots[r.to];
  if(!ok||!a||!b){ if(typeof addLobbyMsg==='function') addLobbyMsg('', '자리 교체가 거절되었습니다.');
    if(typeof playSfx==='function') playSfx('ui_denied'); renderLobby(); return; }
  _lobbySlots[r.from]=b; _lobbySlots[r.to]=a;   // 서로 맞바꿈(팀은 자리를 따라감)
  if(typeof addLobbyMsg==='function') addLobbyMsg('', (b.label||b.name)+'님과 자리를 바꿨습니다.');
  if(typeof playSfx==='function') playSfx('ui_confirm');
  renderLobby(); updateLobbyStart(); }
function toggleSlotLock(i){ const me=_lobbySlots.find(s=>s&&s.me); if(!(me&&me.host)){ if(typeof toast==='function') toast('호스트만 가능합니다'); return; } if(_lobbySlots[i]) return;
  const k=_lobbyLock.indexOf(i); if(k>=0) _lobbyLock.splice(k,1); else _lobbyLock.push(i); if(typeof playSfx==='function') playSfx('ui_toggle'); renderLobby(); updateLobbyStart(); }
function kickSlot(i){ const me=_lobbySlots.find(s=>s&&s.me); if(!(me&&me.host)){ if(typeof toast==='function') toast('호스트만 가능합니다'); return; }
  const s=_lobbySlots[i]; if(!s||s.host||s.me) return; const nm=s.label||s.name;
  if(_lobbyRoom&&_lobbyRoom.real&&typeof rtRoomKickUid==='function'&&s.uid){ try{ rtRoomKickUid(s.uid); }catch(e){} }   // 실방: 추방 통지(가능 시)
  _lobbySlots[i]=null; if(typeof playSfx==='function') playSfx('ui_denied'); if(typeof addLobbyMsg==='function') addLobbyMsg('', nm+'님을 추방했습니다.'); renderLobby(); updateLobbyStart(); }
function lobbyAddFriend(i){ const s=_lobbySlots[i]; if(!s) return; const nm=s.label||s.name;
  if(s.uid && typeof friendAdd==='function'){ try{ friendAdd(s.uid); }catch(e){} }
  if(typeof toast==='function') toast('👤 '+nm+'님에게 친구 요청을 보냈습니다'); }
function _lbMenuClose(){ const m=document.getElementById('lbMenu'); if(m) m.classList.add('hide'); }
// 슬롯 메뉴 아이콘(라인 스타일 · 대기실 톤 통일)
const _LM_ICO={   // 채움(filled) 글리프 — 외곽선 아이콘의 '테두리 속 테두리' 느낌 제거
  move:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.1 5.3 19.8 12l-6.7 6.7-1.3-1.3 4.5-4.5H4.4v-1.8h11.9l-4.5-4.5z"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 10.4h14c.9 0 1.6.7 1.6 1.6v6.4c0 .9-.7 1.6-1.6 1.6H5c-.9 0-1.6-.7-1.6-1.6V12c0-.9.7-1.6 1.6-1.6z"/><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M7.6 10.4V7a4.4 4.4 0 0 1 8.8 0v3.4"/></svg>',
  unlock:'<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 10.4h14c.9 0 1.6.7 1.6 1.6v6.4c0 .9-.7 1.6-1.6 1.6H5c-.9 0-1.6-.7-1.6-1.6V12c0-.9.7-1.6 1.6-1.6z"/><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M7.6 10.4V7a4.4 4.4 0 0 1 8.4-1.8"/></svg>',
  friend:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9.2" cy="7.8" r="3.5"/><path d="M2.9 19.4c0-3.2 2.8-5.6 6.3-5.6s6.3 2.4 6.3 5.6z"/><path d="M18.2 8.6h1.7v2.5h2.5v1.7h-2.5v2.5h-1.7v-2.5h-2.5v-1.7h2.5z"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.4 8.4h13M14.2 5.2 17.6 8.4l-3.4 3.2"/><path d="M19.6 15.6h-13M9.8 12.4 6.4 15.6l3.4 3.2"/></svg>',
  kick:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9.2" cy="7.8" r="3.5"/><path d="M2.9 19.4c0-3.2 2.8-5.6 6.3-5.6s6.3 2.4 6.3 5.6z"/><path d="m17.1 10.6 1.9 1.9 1.9-1.9 1.2 1.2-1.9 1.9 1.9 1.9-1.2 1.2-1.9-1.9-1.9 1.9-1.2-1.2 1.9-1.9-1.9-1.9z"/></svg>'
};
function openSlotMenu(i, ev){ if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  const meSlot=_lobbySlots.find(s=>s&&s.me), meHost=!!(meSlot&&meSlot.host), s=_lobbySlots[i], locked=(_lobbyLock.indexOf(i)>=0), opts=[];
  // 액션색 = 채도 낮춘 톤(어두운 각진 패널에 묻히도록)
  if(!s){ if(!locked) opts.push({t:'이 자리로 이동', ic:_LM_ICO.move, ac:'138,170,200', fn:'moveToSlot('+i+')'});
    if(meHost) opts.push({t:locked?'잠금 해제':'자리 잠금', ic:locked?_LM_ICO.unlock:_LM_ICO.lock, ac:locked?'134,190,150':'198,164,104', fn:'toggleSlotLock('+i+')'}); }
  else if(!s.me){ if(!s.joining) opts.push({t:'자리 교체 요청', ic:_LM_ICO.swap, ac:'138,170,200', fn:'requestSwap('+i+')'});
    opts.push({t:'친구 추가', ic:_LM_ICO.friend, ac:'134,190,150', fn:'lobbyAddFriend('+i+')'});
    if(meHost && !s.host) opts.push({t:'추방', ic:_LM_ICO.kick, ac:'206,112,112', fn:'kickSlot('+i+')', danger:true}); }
  const m=document.getElementById('lbMenu'); if(!m || !opts.length){ _lbMenuClose(); return; }
  m.innerHTML=opts.map(o=>{ const ac=o.ac||'152,166,182';
    return '<button class="lbMenuOpt'+(o.danger?' danger':'')+'" onclick="'+o.fn+';_lbMenuClose()">'
      +'<span class="lmIco" style="--ac:rgb('+ac+')">'+(o.ic||'')+'</span>'
      +'<span class="lmTx">'+o.t+'</span></button>'; }).join('');
  m.classList.remove('hide');
  const px=(ev&&ev.clientX)||120, py=(ev&&ev.clientY)||120, vw=window.innerWidth, vh=window.innerHeight, mw=m.offsetWidth, mh=m.offsetHeight;
  m.style.left=Math.max(6,Math.min(px, vw-mw-6))+'px'; m.style.top=Math.max(6,Math.min(py+4, vh-mh-6))+'px';   // 클릭 지점 근처(화면 안으로 클램프)
  if(typeof playSfx==='function') playSfx('ui_tab'); }
function updateLobbyStart(){ const players=_lobbySlots.filter(Boolean), cnt=players.length, allReady=players.every(s=>s.ready);
  const meSlot=_lobbySlots.find(s=>s&&s.me), meHost=!!(meSlot&&meSlot.host);
  const btn=document.getElementById('lbStart');
  const cntEl=document.getElementById('lbCount'); if(cntEl) cntEl.innerHTML=cnt+'<s>/'+_lobbyMax+'</s>';   // 헤더: 현재/정원
  if(meHost){   // 방장: 직접 시작
    if(btn){ const ok=cnt>=2&&allReady; btn.disabled=!ok; btn.textContent=ok?'게임 시작':'대기 중…'; }   // 잠김 모습은 공용 .actBtn:disabled 가 갖는다
  } else {   // 참가자: 시작 불가(방장만)
    const ready=cnt>=2 && allReady && _lobbyT===null;
    if(btn){ btn.disabled=true; btn.textContent='방장 대기 중'; }
    // 파티방: 방장이 시작 신호를 보낼 때까지 대기(자동 시작 안 함). 일반 시뮬방만 자동 시작.
    if(!(_lobbyRoom && (_lobbyRoom.party||_lobbyRoom.real)) && ready && !_autoStartT){ _autoStartT=setTimeout(()=>{ _autoStartT=null;
      if(document.getElementById('lobby').classList.contains('hide')) return;
      const p=_lobbySlots.filter(Boolean); if(p.length>=2 && p.every(s=>s.ready)) lobbyStart(); }, 2200); }
  } }

