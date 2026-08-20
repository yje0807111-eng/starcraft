/* ============================================================================
 * 두 클라이언트 통합 테스트 — 멀티가 **상대 시점에서도** 맞는지 본다
 *
 * 왜 필요한가: 스모크의 협동 테스트는 전부 `G.coopChan={send(){...}}` 라
 * **보내는 것만** 잡는다. 보내는 모양과 받는 모양이 어긋나도 절대 못 잡는다 —
 * 그 어긋남이 곧 '멀티가 조용히 죽는' 방식이다.
 *
 * 어떻게: Supabase 대신 **가짜 채널**을 양쪽 페이지에 심고, A 가 send 한 것을
 * Node 가 B 의 핸들러로 실제로 넣어 준다. startGameCoop 의 진짜 배선과 모든
 * 수신 핸들러가 그대로 돈다.
 *   ✅ 잡히는 것: 앱 쪽 프로토콜(번호·색·채팅·관전·전파·재접속·투표·대역폭 계약)
 *   ❌ 못 잡는 것: Supabase 자체의 전달 지연·서버 쿼터·인증 — 그건 실기기 둘로만 된다.
 * ========================================================================== */

// 가짜 Realtime — 양쪽 페이지에 심는다. 앱의 전역(_sb·AUTH·RT·_lobbyRoom)을 그대로 바꾼다.
const SHIM = `(uid, nick) => {
  const chans = {};
  window.__duoDeliver = function(m){
    const c = chans[m.topic]; if(!c) return;
    const fire = (k, ev) => (c.h[k]||[]).forEach(cb => { try{ cb(ev); }catch(e){ console.warn('duo handler', e); } });
    if(m.kind === 'broadcast') fire('broadcast:' + m.event, { payload: m.payload });
    else if(m.kind === 'join'){ c.presence[m.uid] = [m.state]; fire('presence:join', { newPresences:[m.state] }); fire('presence:sync', {}); }
    else if(m.kind === 'leave'){ const st = (c.presence[m.uid]||[])[0]; delete c.presence[m.uid];
      fire('presence:leave', { leftPresences:[st || {uid:m.uid}] }); fire('presence:sync', {}); }
  };
  function mkChan(topic){
    const c = { topic, state:'joined', h:{}, presence:{},
      on(type, filt, cb){ const k = type + ':' + ((filt && filt.event) || ''); (this.h[k] = this.h[k] || []).push(cb); return this; },
      subscribe(cb){ const self=this; setTimeout(function(){ self.state='joined'; if(cb) cb('SUBSCRIBED'); }, 0); return this; },
      send(m){ window.__duoOut({ topic:this.topic, kind:'broadcast', event:m.event, payload:m.payload }); return Promise.resolve('ok'); },
      track(st){ this.presence[uid] = [st]; window.__duoOut({ topic:this.topic, kind:'join', uid:uid, state:st }); return Promise.resolve('ok'); },
      untrack(){ delete this.presence[uid]; window.__duoOut({ topic:this.topic, kind:'leave', uid:uid }); return Promise.resolve('ok'); },
      presenceState(){ return this.presence; } };
    chans[topic] = c; return c;
  }
  _sb = { channel:(t)=>mkChan(t), getChannels:()=>Object.keys(chans).map(k=>chans[k]),
          removeChannel(c){ if(!c) return; try{ c.untrack(); }catch(e){} delete chans[c.topic]; } };
  AUTH.user = { uid:uid, nick:nick, email:null, anon:false, guest:false };
  RT.active = true;
  window.__duoChans = chans;
}`;

// 판 시작 — 양쪽이 같은 슬롯 배정을 받는다(방장 payload 가 권위인 실제 규칙과 같다)
const START = `(myNum) => {
  _lobbyRoom = { real:true, num:7, name:'duo', host:'P_a', hostUid:'uid_a' };
  _selMap = USEMAPS.nemo;
  startGameNow([1,2], myNum, { 1:'P_a', 2:'P_b' });
  G.loading = false; G.paused = false;
  startGameCoop([{ num:1, uid:'uid_a' }, { num:2, uid:'uid_b' }]);
  return { my:G.myPlayer, coop:!!G.coop };
}`;

export async function runDuo(browser, baseUrl){
  const rep = [];
  const t = async (name, fn) => { const t0 = Date.now();
    try{ const d = await fn(); rep.push({ name, ok:true, detail: d==null?'':String(d), ms:Date.now()-t0 }); }
    catch(e){ rep.push({ name, ok:false, detail:String(e && e.message || e).slice(0,300), ms:Date.now()-t0 }); } };
  const must = (c, m) => { if(!c) throw new Error(m); };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const A = await browser.newPage(), B = await browser.newPage();
  const errs = [];
  for(const [n,p] of [['A',A],['B',B]]){
    await p.setViewport({ width:390, height:844 });
    p.on('pageerror', e => errs.push(n + ': ' + String(e.message||e).slice(0,140)));
  }
  try{
    // 중계 — A 가 보낸 것을 B 에게, B 가 보낸 것을 A 에게 **실제로 넣는다**
    await A.exposeFunction('__duoOut', m => B.evaluate(x => window.__duoDeliver(x), m).catch(()=>{}));
    await B.exposeFunction('__duoOut', m => A.evaluate(x => window.__duoDeliver(x), m).catch(()=>{}));

    for(const p of [A,B]){ await p.goto(baseUrl, { waitUntil:'load' }); await p.waitForFunction('typeof G!=="undefined"', { timeout:20000 }); }
    await A.evaluate('(' + SHIM + ')("uid_a","P_a")');
    await B.evaluate('(' + SHIM + ')("uid_b","P_b")');
    const ra = await A.evaluate('(' + START + ')(1)'), rb = await B.evaluate('(' + START + ')(2)');
    await wait(400);

    await t('두 클라이언트가 같은 판에 붙는다', async () => {
      must(ra.coop && rb.coop, '협동 채널이 안 붙었다: A=' + ra.coop + ' B=' + rb.coop);
      must(ra.my === 1 && rb.my === 2, '내 번호가 어긋난다: A=' + ra.my + ' B=' + rb.my);
      return 'A=1P · B=2P';
    });

    await t('2P 시점: 상대 화면에서 내 번호와 색이 맞는다', async () => {
      const seen = async (p) => p.evaluate(() => ({
        n2u: G.coopNumToUid, u2n: G.coopUidToNum,
        colorOf: n => PLAYER_VIEW_COLORS[(n-1) % PLAYER_VIEW_COLORS.length],
        c1: PLAYER_VIEW_COLORS[0], c2: PLAYER_VIEW_COLORS[1],
        st1: slotState(1), st2: slotState(2) }));
      const a = await seen(A), b = await seen(B);
      must(a.u2n.uid_b === 2 && b.u2n.uid_a === 1, '상대 번호가 어긋난다: A가 본 B=' + a.u2n.uid_b + ' · B가 본 A=' + b.u2n.uid_a);
      must(a.c1 === b.c1 && a.c2 === b.c2, '색 표가 양쪽에서 다르다');
      must(a.st2 === 'live' && b.st1 === 'live', '상대가 live 가 아니다: A→B=' + a.st2 + ' B→A=' + b.st1);
      return 'B는 A화면에서 2P(' + a.c2 + ') · A는 B화면에서 1P(' + b.c1 + ')';
    });

    await t('채팅: A가 친 말이 B 화면에 뜬다', async () => {
      const txt = '테스트합니다' + Date.now() % 1000;
      await A.evaluate(s => { const f = document.getElementById('chatField'); f.value = s; sendChat(); }, txt);
      await wait(300);
      const got = await B.evaluate(() => (document.getElementById('chatBox') || document.body).textContent);
      must(got.indexOf(txt) >= 0, 'B 화면에 A의 말이 없다');
      return '"' + txt + '" 전달됨';
    });

    await t('관전: B가 보는 것은 A의 전장이지 자기 전장이 아니다', async () => {
      await A.evaluate(() => { G.units.length = 0;
        for(let i=0;i<7;i++) G.units.push(initUnitStats({ uid:G.idSeq++, id:'marine', hero:false, lv:1, x:.2+i/40, y:.4, cd:0 })); });
      await B.evaluate(() => { G.units.length = 0;
        G.units.push(initUnitStats({ uid:G.idSeq++, id:'marine', hero:false, lv:1, x:.9, y:.9, cd:0 }));
        G.tab = 'Players'; G.curPlayer = 1; coopWatchSync(); });   // ⚠ 프레임 루프에 기대지 않는다(헤드리스 두 번째 페이지는 rAF 가 throttle 된다)
      await wait(250);
      await A.evaluate(() => { G._pstateN = 0; for(let i=0;i<5;i++) coopBroadcastState(); });
      await wait(250);
      const r = await B.evaluate(() => { const n = specRemoteBoard();
        return { n:n, mine:G.units.length, board: n ? buildInterpBoard(n).units.length : -1,
                 uid: n ? (buildInterpBoard(n).units[0]||{}).uid : null }; });
      must(r.n === 1, 'B가 A를 관전하고 있지 않다(A가 전장 데이터를 안 보냈다): ' + r.n);
      must(r.board === 7, '상대 유닛 수가 다르다: ' + r.board + ' (A는 7기)');
      must(r.mine === 1, 'B 자기 유닛이 바뀌었다: ' + r.mine);
      must(String(r.uid).indexOf('r1_') === 0, '관전 보드의 유닛이 A 것이 아니다: ' + r.uid);
      return 'A 7기를 그린다(내 1기와 섞이지 않음)';
    });

    await t('대역폭: 관전을 끄면 A가 전장 데이터를 빼고 보낸다', async () => {
      await A.evaluate(() => { const c = window.__duoChans['game-7'];
        if(!c.__hooked){ const s = c.send.bind(c); c.send = m => { if(m.event === 'pstate') window.__lastPl = m.payload; return s(m); }; c.__hooked = 1; } });
      const pump = async () => { await A.evaluate(() => { window.__lastPl = null; G._pstateN = 0;
          for(let i=0;i<5;i++) coopBroadcastState(); });   // 아무도 안 볼 땐 5틱에 한 번만 나간다
        return A.evaluate(() => window.__lastPl); };
      const on = await pump();
      must(on, '관전 중인데 pstate 자체가 안 나갔다');
      must(on.u && on.e, '관전 중인데 전장 데이터를 안 보낸다');
      await B.evaluate(() => { G.tab = 'Main'; G.curPlayer = G.myPlayer; coopWatchSync(); });
      await wait(250);
      const off = await pump();
      must(off, '관전이 없을 때 pstate 가 아예 안 나갔다(지표는 계속 보내야 한다)');
      must(!off.u && !off.e, '아무도 안 보는데 전장 데이터를 보낸다');
      const cut = Math.round(100 - JSON.stringify(off).length / JSON.stringify(on).length * 100);
      return '관전 O ' + JSON.stringify(on).length + 'B → 관전 X ' + JSON.stringify(off).length + 'B (' + cut + '% 절감)';
    });

    await t('프레임 루프가 관전 신호를 실제로 보낸다', async () => {
      const ok = await A.evaluate(() => /coopWatchSync/.test(String(loop)));
      must(ok, '프레임 루프에 coopWatchSync 호출이 없다 — 탭을 바꿔도 상대가 모른다');
      return 'loop 안에 있음';
    });

    await t('배속 투표: 양쪽이 같은 값으로 수렴한다(전원 최소)', async () => {
      await A.evaluate(() => castVote(4));
      await B.evaluate(() => castVote(2));
      await wait(400);
      const a = await A.evaluate(() => G.speedMul), b = await B.evaluate(() => G.speedMul);
      must(a === 2 && b === 2, '배속이 안 맞는다: A=' + a + ' B=' + b);
      return '4 · 2 → 양쪽 2배속';
    });

    await t('공용 보스: A가 때린 만큼 B의 보스도 닳는다', async () => {
      await A.evaluate(() => { G.coopBoss = { lv:1, hp:10000, max:10000, dead:false, name:'t' }; });
      await B.evaluate(() => { G.coopBoss = { lv:1, hp:10000, max:10000, dead:false, name:'t' }; });
      await A.evaluate(() => { for(let i=0;i<20;i++) coopBossDamage(50, 1, false); coopBossDmgFlush(); });
      await wait(400);
      const b = await B.evaluate(() => G.coopBoss.hp);
      must(b < 10000, 'B의 보스가 안 닳았다: ' + b);
      must(b === 9000, '합산 데미지가 어긋난다: ' + (10000 - b) + ' (1000 이어야 한다)');
      return 'A 20타(1000) → B 보스 ' + b;
    });

    await t('재접속: B가 끊기면 A는 자리를 잡아 두고, 돌아오면 잇는다', async () => {
      await B.evaluate(() => { const c = window.__duoChans['game-7']; _sb.removeChannel(c); });
      await wait(400);
      const away = await A.evaluate(() => slotState(2));
      must(away === 'away', '끊겼는데 자리를 안 잡아 뒀다: ' + away);
      const kept = await A.evaluate(() => !!G.coopBoard[2] || true);
      await B.evaluate(() => startGameCoop([{ num:1, uid:'uid_a' }, { num:2, uid:'uid_b' }]));
      await wait(600);
      const back = await A.evaluate(() => slotState(2));
      must(back === 'live', '돌아왔는데 복귀가 안 됐다: ' + back);
      return 'away → live 복귀' + (kept ? '' : '');
    });

    await t('패배 전파: A가 지면 B 화면에서 A 자리가 죽는다', async () => {
      await A.evaluate(() => nemoGameOver('lost'));
      await wait(400);
      const r = await B.evaluate(() => ({ st: slotState(1), board: !!G.coopBoard[1], cnt: playerEnemyCount(1) }));
      must(r.st === 'dead', 'A가 졌는데 B화면에서 안 죽었다: ' + r.st);
      must(!r.board, '죽은 자리의 보드가 남아 있다');
      must(r.cnt === 0, '죽은 자리의 적 수가 0이 아니다: ' + r.cnt);
      return 'dead · 보드 삭제 · 적 0';
    });

    await t('페이지 예외 없음', async () => { must(errs.length === 0, errs.slice(0,3).join(' / ')); return '0건'; });
  } finally { await A.close().catch(()=>{}); await B.close().catch(()=>{}); }
  return rep;
}
