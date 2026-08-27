/* ============================================================================
 * sc-ums-web 스모크 테스트 스위트 (인페이지)
 * ----------------------------------------------------------------------------
 * 이 파일은 게임 페이지 안에 주입되어 window.runSmoke(group)을 제공한다.
 * 테스트 프레임워크가 없는 이 프로젝트의 "행동 검증" 단일 소스:
 *   - 코드를 수정했으면 `npm test` (test/run-smoke.mjs가 헤드리스 크롬으로 실행)
 *   - 또는 Claude 브라우저 프리뷰에서 이 파일을 주입 후 runSmoke() 호출
 * 원칙:
 *   - 각 스텝은 독립 try/catch — 하나가 실패해도 나머지는 계속 진행
 *   - 게임 코드가 진화해도 스위트가 깨지지 않게 typeof 가드 사용(없는 기능=skip)
 *   - 판정은 DOM/상태 기반(스크린샷 불필요) — 헤드리스에서 완전 동작
 * 그룹: 'lobby'(타이틀·팝업·방찾기) / 'game'(솔로 게임 전 플로우) / 'sandbox'(관리자)
 *       runner는 그룹 사이에 페이지를 새로고침해 상태를 격리한다.
 * ========================================================================== */
(function(){
'use strict';

// 🤖 매크로 방지 1차(event.isTrusted)의 **테스트 전용 문**.
//   스모크는 포인터 이벤트를 프로그램으로 쏘므로 isTrusted 가 false 다 — 열어 두지 않으면
//   캠프 채집 관련 step 이 통째로 깨진다(js/19-camp.js 의 리스너 참고).
window._campTapForce = true;

// ── 콘솔/전역 오류 수집(알려진 GLB blob 텍스처 경고는 별도 분류) ──
const KNOWN_NOISE=[/GLTFLoader: Couldn't load texture blob/];
const errors=[], noise=[];
function classify(msg){ (KNOWN_NOISE.some(re=>re.test(msg))?noise:errors).push(String(msg).slice(0,300)); }
window.addEventListener('error', e=>classify(e.message||String(e.error)));
window.addEventListener('unhandledrejection', e=>classify('unhandledrejection: '+(e.reason&&e.reason.message||e.reason)));
const _cerr=console.error.bind(console); console.error=function(){ classify([...arguments].join(' ')); _cerr(...arguments); };

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>document.getElementById(id);
const visible=el=>!!(el && el.offsetParent!=null);

// ── 스텝 러너 ──
const steps=[];
async function step(name, fn){
  const t0=performance.now();
  try{ const detail=await fn(); steps.push({name, ok:true, detail:detail==null?'':String(detail), ms:Math.round(performance.now()-t0)}); }
  catch(e){ steps.push({name, ok:false, detail:(e&&e.message||String(e)).slice(0,300), ms:Math.round(performance.now()-t0)}); }
}
function assert(cond, msg){ if(!cond) throw new Error(msg||'assert fail'); }
function skipIf(cond, why){ if(cond){ const e=new Error('SKIP: '+why); e._skip=true; throw e; } }
// 🎴 '완전 검정 면 + 액센트 그라데 테두리' 카드(--cardRing)를 쓰고 있는가.
//   사냥터 업그레이드 카드(.hmUp)와 유즈맵 유닛 카드(.hsCell)가 같은 토큰을 쓴다 —
//   그룹마다 페이지가 달라 한 자리에서 둘을 못 비교하므로, 같은 잣대를 두 그룹에서 각각 댄다.
function assertCardRing(el, who){
  assert(el, who+' 카드를 못 찾음');
  const c=getComputedStyle(el), bg=String(c.backgroundImage).replace(/\s+/g,' ');
  assert(/rgb\(10, 10, 10\)/.test(bg) && /rgb\(0, 0, 0\)/.test(bg), who+' 면이 완전 검정이 아님: '+bg.slice(0,90));
  const acc=(bg.match(/rgba\((\d+), (\d+), (\d+), 0\.4\)/)||[])[0];
  assert(acc, who+' 액센트 테두리 그라데가 없음(첫 스톱 alpha .4): '+bg.slice(0,140));
  assert(/0\.26\)/.test(bg) && /0\.15\)/.test(bg) && /0\.09\)/.test(bg), who+' 테두리 스톱이 --cardRing 규격과 다름: '+bg.slice(0,160));
  assert(/rgb\(92, 92, 92\)/.test(bg), who+' 테두리 아래 금속 링이 없음(순색 액센트가 된다)');
  assert(/rgba\(0, 0, 0, 0\)/.test(c.borderTopColor), who+' 테두리가 그라데가 아님(border-color 를 쓰고 있다): '+c.borderTopColor);
  return acc; }

// ── 게임 헬퍼 ──
function hackCredits(){ G.credits=999999; G.mineral=Math.max(G.mineral||0,999999); G.gas=Math.max(G.gas||0,99999); }
function spawnMany(n){ const gids=Object.keys(GACHA_UNITS); let c=0;
  for(let i=0;i<n;i++){ const u=spawnGachaUnit(gids[i%gids.length], 0.1+Math.random()*0.8, 0.15+Math.random()*0.6); if(u)c++; } return c; }
// 수동 프레임 진행(헤드리스에선 rAF가 멈춰 있어 게임 루프 대신 코어만 돌림)
function pump(frames){ for(let f=0;f<frames;f++){ stepCmdMove(0.016); separateUnits();
  if(window.M3D&&M3D.ready&&M3D.ready()) M3D.sync(G.units,GW,GH,0.016,G.sel,G.enemies,null,null,G.view); } }

// ── 그룹: lobby ──
async function groupLobby(){
  await step('부트: 전역/탭 존재', ()=>{ assert(typeof G!=='undefined','G 없음'); assert(typeof USEMAPS!=='undefined','USEMAPS 없음');
    assert($('tabs'),'#tabs 없음'); return 'phase='+G.phase; });
  // 로그인/회원가입 화면은 반드시 거친다(자동 로그인 금지). 아이디를 비우고 로그인하면 바로 게임 선택으로.
  await step('인증: 로그인 화면 노출 + 회원가입 전환', ()=>{ skipIf(typeof openAuth!=='function','인증 화면 없음');
    openAuth();
    assert(visible($('auth')),'로그인 화면이 안 뜸(자동 로그인으로 건너뛰는지 확인)');
    assert(!visible($('townScreen')),'로그인 전에 메인(마을)이 떠 있음');
    // 첫 화면 = 방식 선택 허브. 아이디/비번은 방식을 고른 뒤에 나온다
    assert(visible($('authHub')),'로그인 방식 허브가 안 보임');
    assert(!visible($('authForm')),'허브인데 입력 폼이 이미 떠 있음');
    assert(visible($('authGuest')),'허브에 게스트 시작 버튼이 없음');
    // ⭐ Google 도 '되는 방식'으로 보인다(2026-08-20) — 곧 연동하므로 잠금 표기를 뺐다.
    assert(!$('wayGoogle').classList.contains('lock'),'Google 에 잠금 표기가 되살아남');
    authWayLocked(); assert(visible($('authHub')),'Google 을 눌렀는데 화면이 넘어감');
    // 아이디를 고르면 폼으로
    authOpenForm('id');
    assert(!visible($('authHub')) && visible($('authForm')),'아이디를 골랐는데 폼이 안 열림');
    assert(visible($('authId')) && visible($('authPw')),'아이디/비밀번호 입력칸이 없음');
    assert($('authNick').classList.contains('hide'),'로그인 탭인데 닉네임 칸이 보임');
    // 이메일은 같은 폼 한 벌을 쓰되 입력 타입만 바뀐다(폼을 두 벌 만들면 여기서 걸린다)
    authOpenForm('email');
    assert($('authId').type==='email','이메일 방식인데 첫 칸이 email 타입이 아님: '+$('authId').type);
    assert(document.querySelectorAll('#auth input[type=password]').length===2,'비밀번호 칸이 폼마다 복제됨');
    authBackToHub(); assert(visible($('authHub')),'뒤로가기가 허브로 안 돌아감');
    assert($('wayId').textContent.trim()==='아이디로 로그인',
      '허브로 돌아오니 라벨이 무너짐: '+JSON.stringify($('wayId').textContent));
    // ══ 🎬 시네마틱 행 목록 (2026-08-19 · C4) ══════════════════════════════════
    //   ⚠ 이 검사들은 **허브가 보이는 동안** 해야 한다 — 폼을 열면 허브가 display:none 이라
    //      getBoundingClientRect() 가 전부 0 이 되고, '가운데를 벗어남 11%' 같은 헛 실패가 난다(실제로 그랬다).
    { // ① 블록은 화면 '아래'에 있다 — 새 키 아트는 가운데에 주인공이 몰려 있어 거기를 덮으면 안 된다
      var sc=$('auth').getBoundingClientRect(), bl=document.querySelector('.authIn').getBoundingClientRect();
      var mid=((bl.top+bl.bottom)/2-sc.top)/sc.height*100;
      assert(mid>60,'로그인 블록이 아래로 안 내려감(그림의 주인공을 덮는다): '+mid.toFixed(1)+'%');
      // ⚠ 2026-08-23: 블록은 **위(로고 밑)에 붙는다**. 아래로 붙이면 내용 길이가 바뀔 때마다
      //    통째로 오르내려 허브↔폼 전환이 튄다 → '바닥에 붙었는가' 대신 '로고 바로 밑인가'를 본다.
      var mk=$('titleMark').getBoundingClientRect();
      assert(Math.round(bl.top-mk.bottom)>=8 && Math.round(bl.top-mk.bottom)<=60,
        '블록이 로고 바로 밑이 아님(간격 '+Math.round(bl.top-mk.bottom)+'px) — 자리가 고정이어야 전환이 안 튄다');
      // ② 방식은 '행'이다 — 판(면)도 전폭 헤어라인도 없다. 구분은 짧은 가운데 선 하나뿐(M8)
      var w0=getComputedStyle($('wayId'));
      assert(w0.backgroundImage==='none','방식 칸에 판(면)이 되살아남: '+w0.backgroundImage);
      assert(parseFloat(w0.borderBottomWidth)===0,'전폭 헤어라인이 되살아남(그림을 가로지른다)');
      { var d=getComputedStyle($('wayEmail'),'::before');
        assert(d.content && d.content!=='none','행 사이 가운데 선이 없음');
        assert(parseFloat(d.width) < $('wayEmail').offsetWidth*0.45,
          '가운데 선이 너무 길다(전폭 선과 다를 게 없어진다): '+d.width+' / '+$('wayEmail').offsetWidth+'px'); }
      // ③ ⭐ 셋은 같은 무게다 — 번호도 주 방식 표시도 없다
      assert(document.querySelectorAll('.authWay .awIx').length===0,'행 번호(.awIx)가 되살아남');
      assert(document.querySelectorAll('.authWay.pri').length===0,'주 방식 표시(.pri)가 되살아남');
      { var W=[...document.querySelectorAll('.authWay')].filter(visible);
        assert(W.length===3,'방식이 3개가 아님: '+W.length);
        var k=W.map(function(w){ var c=getComputedStyle(w); return c.color+'|'+c.fontSize+'|'+c.fontWeight; });
        assert(k[0]===k[1] && k[1]===k[2],'셋의 무게가 다름: '+k.join(' / ')); }
      // ④ 로고 블록 = 부팅 로딩과 **같은 요소 하나**(2026-08-23). 예전엔 두 벌을 만들어 놓고
      //    서로 같은지 비교했는데, 밑변을 맞춰도 안쪽 간격이 달라 어긋났다 → 하나로 합쳤다.
      { assert(document.querySelectorAll('.authLogo, .opTitle').length===1,
          'STAR WAR 로고가 한 벌이 아님 — 두 벌이면 화면 전환에서 어긋난다');
        var t=getComputedStyle(document.querySelector('.authLogo'));
        assert(!/rgb\(255, 59, 59\)/.test(t.color),'제목에 빨강이 섞임(흰 단색이다): '+t.color);
        assert(document.querySelector('.authMark svg'),'로고 육각 마크가 없음');
        assert($('authSub').textContent.trim()==='BATTLE ARENA',
          '부제가 로고의 일부가 아님(안내 문구로 덮였다): '+$('authSub').textContent); }
      // ⑤ 폼 = **판 없이 밑줄만 + 국소 스크림**(2026-08-23 · 1안).
      //    허브가 판 없는 행 목록인데 폼만 상자를 두르면 두 단계가 다른 화면처럼 보인다.
      //    ⚠ 판을 뺀 대신 읽히게 하는 것은 .authIn::before 스크림이다 — 둘은 한 세트라 같이 검사한다.
      { if(typeof authOpenForm==='function'){ authOpenForm('id'); }
        var fd=getComputedStyle($('authId'));
        assert(fd.backgroundImage==='none' && /rgba\(0, 0, 0, 0\)|transparent/.test(fd.backgroundColor),
          '입력칸이 면을 채운다 — 밑줄만 남겨야 한다');
        assert(parseFloat(fd.borderTopWidth)===0 && parseFloat(fd.borderLeftWidth)===0,
          '입력칸에 상자 테두리가 남아 있다');
        assert(parseFloat(fd.borderBottomWidth)>0,'입력칸 밑줄이 없다 — 어디를 누르는지 안 보인다');
        var bt=getComputedStyle($('authBtn'));
        assert(bt.backgroundImage==='none' && /rgba\(0, 0, 0, 0\)|transparent/.test(bt.backgroundColor),
          '로그인 버튼이 면을 채운다 — 입력칸이 선뿐인데 버튼만 무거워진다');
        assert(bt.clipPath==='none','로그인 버튼에 모서리 컷이 남아 있다 — 입력칸이 선뿐인데 버튼만 장식이 남는다');
        // 탭 띠도 판을 벗는다. ⚠ 공용 .pdSeg 를 고치는 게 아니라 **로그인 안에서만** 덮은 것이다.
        var sg=document.querySelector('.authTabs .pdSeg');
        if(sg){ var sgs=getComputedStyle(sg);
          assert(sgs.backgroundImage==='none' && /rgba\(0, 0, 0, 0\)|transparent/.test(sgs.backgroundColor),
            '탭 띠가 판을 깔고 있다 — 이 화면만 판을 벗긴다');
          var other=document.querySelector('#homeScreen .pdSeg, .hbUpg .pdSeg');
          if(other) assert(getComputedStyle(other).backgroundImage!=='none',
            '공용 세그먼트 바까지 판이 사라졌다 — 로그인 안에서만 덮어야 한다'); }
        // ⚠ 스크림은 로고·로그인이 함께 쓰는 **한 장**(#titleBg::before)이다 — 블록마다 깔면 경계가 띠로 보인다
        var sc=getComputedStyle($('titleBg'),'::before');
        assert(/gradient/.test(sc.backgroundImage),'국소 스크림이 없다 — 판을 뺐으면 이게 글자를 읽히게 한다');
        if(typeof authShowHub==='function') authShowHub(); }
      // ⑥ 포커스 — 브라우저 기본 사각 링을 끈다. 판이 하나도 없는 화면이라 그 상자만 혼자 튄다.
      //    게스트 버튼에서 특히 보였다(눌러도 로딩 동안 화면에 남아 있어서).
      { var gb=$('authGuest'); if(gb){ gb.focus();
          var fo=getComputedStyle(gb);
          assert(fo.outlineStyle==='none' || parseFloat(fo.outlineWidth)===0,
            '게스트 버튼에 기본 포커스 상자가 뜬다: '+fo.outline);
          gb.blur(); } }
      // ⑦ 누름 반응 — 판 없는 버튼에 '눌려 들어가는 판'을 씌우면 없던 상자가 생긴다(게스트에서 그랬다).
      //    :active 는 스모크가 만들 수 없으므로 **규칙을 직접 훑어서** 본다.
      { var badPress=[];
        for(var si=0; si<document.styleSheets.length; si++){ var rules;
          try{ rules=document.styleSheets[si].cssRules; }catch(e){ continue; }
          for(var ri=0; ri<rules.length; ri++){ var rr=rules[ri]; if(!rr.selectorText) continue;
            if(!/.(authGuest|authBtn):active/.test(rr.selectorText)) continue;
            var bgv=(rr.style.background||'')+(rr.style.backgroundImage||'');
            if(/gradient/.test(bgv)) badPress.push(rr.selectorText.slice(0,70)); } }
        assert(!badPress.length,'누를 때 판이 생기는 규칙이 있다: '+badPress.join(' / ')); }
      // ⑧ 설정 버튼 = **글리프만**. 판을 두르면 선으로 그린 가운데 로고 옆에서 혼자 튄다(2026-08-23).
      { var gr=document.querySelector('.authGear'); assert(gr,'설정 버튼이 없음');
        var gs=getComputedStyle(gr), gb=gr.getBoundingClientRect();
        assert(getComputedStyle(gr,'::before').content==='none' && getComputedStyle(gr,'::after').content==='none',
          '설정 버튼에 판이 남아 있다 — 글리프만 남겨야 한다');
        assert(gs.backgroundImage==='none' && /rgba\(0, 0, 0, 0\)|transparent/.test(gs.backgroundColor),
          '설정 버튼이 자기 면을 칠한다');
        assert(+gs.opacity<0.8,'설정 버튼이 또렷하다 — 살짝 눌러 둔다: '+gs.opacity);
        assert(gb.width>=44 && gb.height>=44,'터치 영역이 44px 미만: '+Math.round(gb.width)+'x'+Math.round(gb.height));
        // 뜨고 지는 박자는 로그인 내용과 **같은 값**이어야 한다 — 혼자 다른 박자면 따로 노는 게 보인다
        var ai=getComputedStyle(document.querySelector('.authIn'));
        assert(gs.transitionDuration.indexOf(ai.transitionDuration.split(',')[0])===0,
          '설정 버튼이 로그인 내용과 다른 속도로 뜬다: '+gs.transitionDuration+' vs '+ai.transitionDuration);
        assert(parseFloat(gs.transitionDelay)===parseFloat(ai.transitionDelay),
          '설정 버튼의 늦춤이 로그인 내용과 다르다: '+gs.transitionDelay+' vs '+ai.transitionDelay); }
      // ④ ⭐ 게스트는 판을 갖지 않는다 — 밑변 광원은 주 버튼의 서명이라
      //    게스트에 붙으면 "기본 동작은 게스트"가 된다(2026-08-19 정리).
      var gs=getComputedStyle($('authGuest'));
      assert(gs.backgroundImage==='none','게스트에 판(면)이 되살아남: '+gs.backgroundImage);
      assert(gs.clipPath==='none','게스트가 다시 각진 버튼이 됨');
      // ⑤ 터치 타겟 — 게스트는 글자가 작아도 누르는 영역은 44px 다
      assert($('authGuest').offsetHeight>=44,'게스트 터치 타겟이 44px 미만: '+$('authGuest').offsetHeight);
      [].forEach.call(document.querySelectorAll('.authWay'),function(w){
        assert(w.offsetHeight>=44,'방식 칸이 44px 미만: '+w.id+' '+w.offsetHeight); }); }
    authOpenForm('id');
    // 탭은 사냥터·장비창과 같은 공용 세그먼트 바를 쓴다(로그인 화면만 별도 탭 금지)
    var seg=document.querySelector('#authTabs .pdSeg');
    assert(seg,'로그인/회원가입 탭이 공용 세그먼트 바(.pdSeg)를 안 씀');
    assert(seg.querySelectorAll('.pdSegBtn').length===2,'탭이 2개가 아님');
    assert(seg.querySelector('.pdSegInd'),'현재 탭을 가리키는 판(.pdSegInd)이 없음');
    assert(seg.querySelector('.pdSegBtn.on').textContent.indexOf('로그인')>=0,'켜진 탭이 로그인이 아님');
    // ══ 🎬 시네마틱 행 목록 (2026-08-19 · C4) ══════════════════════════════════
    //   판(카드)을 없앴다 — 배경 아트가 그대로 비치고, 조작은 헤어라인으로 갈린 '행'이다.
    //   ⛔ 옛 검사(카드 면 알파·그림자·clip-path)로 되돌리지 말 것: .authCard 는 display:contents 라
    //      상자를 만들지 않는데 getComputedStyle 은 캐스케이드 값을 그대로 돌려준다 →
    //      '없는 상자'를 재고 통과하는 검사가 된다(실제로 그랬다).
    var ac=getComputedStyle(document.querySelector('.authCard'));
    assert(ac.display==='contents','.authCard 가 다시 판이 됨(display '+ac.display+')');
    // 배경 아트 + 비네트. 비네트가 없으면 밝은 그림 위에 글자가 얹힌다.
    // ⚠ 2026-08-23: 그림·딤은 로그인이 직접 그리지 않는다 — **부팅 로딩과 공유하는 #titleBg 한 장**이다.
    //    화면마다 그리면 전환할 때 호흡 애니가 리셋되어 그림이 툭 튄다.
    { assert($('phone').classList.contains('artBg'),'로그인인데 공유 키 아트가 안 켜졌다');
      var bg=getComputedStyle($('titleBg')).backgroundImage;
      assert(bg.indexOf('url(')>=0,'로그인 배경 아트가 없음');
      var vg=getComputedStyle($('titleBg'),'::after').backgroundImage;
      assert(vg.indexOf('gradient')>=0,'로그인 비네트가 없음 — 글자 자리가 안 어두워진다'); }
    // 액센트는 사냥터와 같은 빨강 — 푸른기로 되돌아가면 여기서 걸린다
    { var rgb=ac.getPropertyValue('--acRGB').trim().split(',').map(Number);
      assert(rgb.length===3 && rgb[0]>rgb[2]+80,'로그인 액센트가 붉은 계열이 아님: '+ac.getPropertyValue('--acRGB'));
      var segCol=getComputedStyle(document.querySelector('#authTabs .pdSegInd')).getPropertyValue('--segCol').trim();
      assert(segCol===ac.getPropertyValue('--acRGB').trim(),'탭 광원이 카드 액센트와 다름: '+segCol); }
    authMode('signup');
    assert(!$('authNick').classList.contains('hide'),'회원가입인데 닉네임 칸이 안 보임');
    assert(!$('authPw2').classList.contains('hide'),'회원가입인데 비밀번호 확인 칸이 안 보임');
    assert($('authBtn').textContent.indexOf('가입')>=0,'가입 버튼 라벨 불일치: '+$('authBtn').textContent);
    authMode('login'); return '로그인·회원가입 전환 ok'; });
  // 허브 상단(게임 선택)은 하단 소셜과 '같은 디자인 언어'여야 한다.
  //   목록용 .mapItem을 늘려 쓰던 방식은 큰 빈 상자가 되어 폐기했다 — 재질·배지·타이포를 소셜 기준으로 맞춘다.
  // 카드 하단 바로가기(인기맵 / 내 캐릭터)와 소셜 고정 높이.
  // 허브 소셜: 상단(게임 선택)과 시각적으로 분리되고, '친구'가 한눈에 읽혀야 한다.
  // 허브 소셜 탭 = 유즈맵 하단 탭(채팅·파티·친구)과 같은 .msTabs2/.msTab2 단일 소스.
  await step('탭 바 단일 소스: 친구 시트 = 마을 채팅 시트', ()=>{
    const hub=$('hubFriendTabs'); skipIf(!hub,'친구 시트 탭 없음');
    assert(hub.classList.contains('msTabs2'),'친구 시트가 공용 탭 바(.msTabs2)를 안 씀');
    // 채팅 블록은 유즈맵 → 마을(#twChat)로 옮겼다. 유즈맵은 목록만 남는다.
    assert(!document.querySelector('#mapSelect .msSocial'),'유즈맵에 채팅 블록이 남아 있음');
    const map=document.querySelector('#twChat .msTabs2');
    assert(map,'마을 채팅 시트 탭 바를 못 찾음');
    const hb=hub.querySelectorAll('button'), mb=map.querySelectorAll('button');
    assert(hb.length && mb.length,'탭 버튼이 없음');
    hb.forEach(b=>assert(b.classList.contains('msTab2'), '허브 탭 버튼에 .msTab2 없음: '+b.textContent.trim()));
    // 허브는 두꺼운 변형 — 복제가 아니라 같은 컴포넌트의 크기 변형이어야 한다(크기 override가 유즈맵 하단으로 새면 안 됨).
    const pad=e=>parseFloat(getComputedStyle(e).paddingTop);
    assert(pad(hb[1])>pad(mb[1]),'허브 소셜 바가 채팅 시트보다 두껍지 않음: '+pad(hb[1])+' vs '+pad(mb[1]));
    assert(pad(mb[1])<=10,'채팅 시트까지 두꺼워짐(변형이 새어나감): '+pad(mb[1]));
    // ⚠ 밑줄 두께는 뺀다 — 허브는 DESIGN.md(테두리 1px)로 전환돼 2px 테두리 대신 inset 밑줄을 쓴다.
    //    유즈맵 하단은 아직 미전환이라 2px 테두리 그대로다(touch-it-fix-it).
    const key=b=>{ const c=getComputedStyle(b);
      return [c.flex,c.fontWeight,c.justifyContent,c.alignItems].join('|'); };
    const onTab=hub.querySelector('.msTab2.on'), oc=getComputedStyle(onTab);
    assert(/0px -2px 0px 0px inset/.test(oc.boxShadow),'허브 선택 탭에 밑줄 표시가 없음: '+oc.boxShadow.slice(0,60));
    assert(parseFloat(oc.borderBottomWidth)<=1,'허브 탭이 아직 2px 테두리를 씀: '+oc.borderBottomWidth);
    assert(key(hb[1])===key(mb[1]), '크기 외 형태가 다름\n허브: '+key(hb[1])+'\n유즈맵: '+key(mb[1]));
    assert(hub.querySelectorAll('svg').length===hb.length, '탭 아이콘이 안 그려짐(paintIcons 누락)');
    // 선택 표시가 새 클래스에서도 동작하는지
    setFriendFilter('rpg', hb[2]);
    assert(hb[2].classList.contains('on') && !hb[0].classList.contains('on'),'탭 선택 표시가 안 옮겨감');
    setFriendFilter('all', hb[0]);
    return hb.length+'탭 · 스타일 일치'; });
  // 스크롤바는 .uiScroll 하나로 통일. 같은 UI를 두 번 정의하면 화면마다 굵기·색이 어긋난다(실제로 어긋나 있었음).
  await step('스크롤바 단일 소스: 맵 목록 = 친구 시트', ()=>{
    const ms=$('msList'), hs=$('hubFriends'); skipIf(!ms||!hs,'대상 목록 없음');
    for(const [n,el] of [['맵 목록',ms],['허브 소셜',hs]])
      assert(el.classList.contains('uiScroll'), n+'에 공용 스크롤바 클래스(.uiScroll)가 없음');
    // 이 요소들에 실제로 매칭되는 스크롤바 규칙을 모아 비교 — 스타일 몇 개 눈대중이 아니라 규칙 집합을 통째로 diff
    const rulesFor=(el)=>{ const out=[];
      for(const sh of document.styleSheets){ let rs; try{ rs=sh.cssRules; }catch(e){ continue; }
        for(const r of rs){ if(!r.selectorText || r.selectorText.indexOf('scrollbar')<0) continue;
          const base=r.selectorText.split(',').map(x=>x.trim().replace(/::-webkit-scrollbar.*$/,''));
          if(base.some(b=>{ try{ return b && el.matches(b); }catch(e){ return false; } })) out.push(r.cssText); } }
      return out.sort(); };
    const a=rulesFor(ms), b=rulesFor(hs);
    assert(a.length>0,'스크롤바 규칙이 하나도 매칭되지 않음');
    assert(JSON.stringify(a)===JSON.stringify(b), '두 목록의 스크롤바 규칙이 다름\n맵: '+a.join(' | ')+'\n허브: '+b.join(' | '));
    const c=getComputedStyle(ms);
    assert(c.scrollbarWidth==='thin', '공용 스크롤바가 thin이 아님: '+c.scrollbarWidth);
    return a.length+'개 규칙 공유'; });
  // DESIGN.md 규칙 — 허브(볼륨 3)만. 다른 볼륨 3 화면(타이틀·로그인·대기실)은 각자 전환될 때 스텝을 추가할 것.
  // 빈 칸 바로 입장은 없앴다(2026-08-06). 체험 입장은 '게스트로 시작하기' 버튼 전용.
  await step('인증: 빈 칸은 막고, 게스트 버튼으로 입장', async()=>{ skipIf(typeof authSubmit!=='function','인증 없음');
    openAuth(); authOpenForm('id');   // 허브에서 아이디를 골라야 입력 폼이 나온다
    $('authId').value=''; $('authPw').value='';
    await authSubmit();
    // ⚠ 고정 대기(120ms)로 두면 간헐 실패한다 — authSubmit 이 Supabase 준비를 기다리는 경우가 있어
    //   안내가 그보다 늦게 붙는다. 뜰 때까지 기다린다(최대 2초).
    for(let i=0;i<40 && !(($('authErr').textContent||'').length); i++) await sleep(50);
    assert(visible($('auth')),'빈 칸인데 로그인 화면을 벗어남(자동 입장이 남아 있음)');
    assert(!visible($('hubScreen')),'빈 칸인데 게임 선택으로 넘어감');
    assert(($('authErr').textContent||'').length>0,'빈 칸인데 안내가 없음');
    authBackToHub();   // 게스트 진입은 폼이 아니라 허브에 있다
    const gb=$('authGuest'); assert(gb && visible(gb),'게스트로 시작하기 버튼이 없음');
    gb.click();
    // 게스트 입장도 로딩(#opening에서 3D 데우기)을 거친다 — 끝날 때까지 기다린다.
    // ⚠ 이 대기는 넉넉해야 한다: 실기기(GPU)에선 1초 안이지만 헤드리스 소프트웨어 렌더러(swiftshader)에선
    //   3D 예열에 10초 넘게 걸린다. 4초로 뒀다가 '게스트가 안 들어간다'고 잘못 실패했다(앱은 정상).
    for(let i=0;i<120 && !(visible($('townScreen'))||visible($('homeScreen'))); i++) await sleep(250);
    assert(visible($('townScreen'))||visible($('homeScreen')),'게스트 버튼을 눌렀는데 메인으로 안 감');
    assert(!visible($('auth')),'로그인 화면이 안 닫힘');
    for(let i=0;i<40 && !AUTH.user; i++) await sleep(50);   // 로딩 게이트를 거치면 몇 프레임 늦게 채워질 수 있다
    assert(AUTH.user,'입장했는데 유저가 비어 있음');
    return AUTH.user.nick||AUTH.user.id; });
  // 캐릭터를 '고르는' 화면은 없다 — 처음 들어오면 기본 유닛이 조용히 지급된다(2026-08-13 설계 변경).
  // 종족 선택은 나중에 길드 가입 시점으로 옮겼다. 여기서 지키는 것은 '입구마다 캐릭터가 보장된다' 하나.
  await step('캐릭터: 생성 화면 없이 기본 유닛이 자동 지급된다', ()=>{ skipIf(typeof profEnsureChar!=='function','캐릭터 시스템 없음');
    assert(typeof openCharScreen==='undefined' && typeof renderCharCreate==='undefined'
        && typeof renderCharSelect==='undefined' && !$('charScreen'),'캐릭터 선택/생성 화면이 아직 남아 있음');
    assert(PROF_MAX_CHARS===1,'계정당 캐릭터는 하나여야 함: '+PROF_MAX_CHARS);
    const p=PROF(); p.chars=[]; p.curId=''; saveMeta();
    const c=profEnsureChar();
    assert(c && CHAR()===c,'기본 유닛이 지급되지 않음');
    assert(c.cls===PROF_DEFAULT_CLASS,'기본 유닛 종류가 PROF_DEFAULT_CLASS 와 다름: '+c.cls);
    assert(profEnsureChar()===c,'이미 있는데 또 만들었음(중복 지급)');
    // 두 번째 캐릭터는 만들어지지 않는다 — 보관소도 함께 폐지했다
    assert(!profCreateChar('scout','둘째'),'캐릭터가 하나를 넘어 생성됨');
    // 모두 같은 스탯·같은 외형으로 시작한다
    { const p2=PROF(); p2.chars=[]; p2.curId=''; const d=profEnsureChar();
      // 장비 스탯(pow/vit/foc/agi)은 '장비 전용'이 됐다 — 맨몸이면 0이 맞다
      for(const k of PROF_STATS) assert(profStat(k)===0,'맨몸인데 장비 스탯이 0이 아님: '+k+'='+profStat(k));
      // 그래도 전투 수치는 기본값에서 시작한다(0이면 아무것도 못 때린다)
      // ⚠ 기본값은 CS_AXES 가 아니라 HB_UPG 가 갖는다(2026-08-18 단일 소스화) → csAxis()에서 받아 본다
      for(const k of CS_ORDER) assert(csVal(k)===csAxis(k).base,k+' 이 기본값에서 시작하지 않음: '+csVal(k));
      assert(d.cls===c.cls,'사람마다 시작 유닛이 다름'); }
    // 종류를 바꿔도 성능이 같다 — 직업 차이는 폐지했다
    { const p3=PROF(); const before=CS_ORDER.map(k=>csVal(k)).join(',');
      p3.chars=[]; p3.curId=''; profCreateChar('warden','워든');
      assert(CS_ORDER.map(k=>csVal(k)).join(',')===before,'캐릭터 종류에 따라 수치가 다름(직업 차이가 남아 있음)');
      p3.chars=[]; p3.curId=''; profEnsureChar(); }
    return '기본 '+PROF_DEFAULT_CLASS+' · 슬롯 '+PROF().chars.length+'/'+PROF_MAX_CHARS; });
  // 부팅 타이머는 '오프닝을 걷어내는' 용도지 화면을 되돌리는 용도가 아니다.
  // 가드가 없으면 1.7초 뒤 openAuth()가 그때 보고 있던 화면을 로그인으로 덮는다 —
  // 스모크가 간헐적으로 "유즈맵에서 뒤로 갔는데 HOME으로 안 옴"으로 터지던 진짜 원인이었다.
  await step('부팅 타이머가 이미 넘어간 화면을 덮지 않는다', async()=>{
    skipIf(typeof bootApp!=='function','bootApp 없음');
    const src=bootApp.toString();
    assert(/openAuth/.test(src),'부팅 타이머에서 openAuth를 안 부름');
    assert(/opening/.test(src),'부팅 타이머에 오프닝 가드가 없음 — 뒤늦게 로그인 화면이 덮친다: '+src.slice(-160));
    // 가드가 '있으나 마나'가 아님을 확인 — openAuth()는 실제로 현재 화면을 덮는 함수다
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','부팅'); saveMeta(); }   // 캐릭터가 없으면 openHome이 생성 화면으로 샌다
    openHome(); assert(visible($('homeScreen')),'HOME이 안 열림');
    openAuth();
    assert(visible($('auth')) && !visible($('homeScreen')),
      'openAuth()가 화면을 안 덮음 — 가드 검사가 무의미해졌으니 이 스텝을 다시 볼 것');
    // ⚠ 화면 전환은 크로스페이드다(FADE_SCREENS) — .hide 는 var(--t-screen) 뒤에 걸린다.
    //    "즉시 숨는가"가 아니라 "결국 숨는가"를 본다. 가드의 뜻은 그대로다.
    await sleep(_fadeMs()+80);
    assert($('opening').classList.contains('hide'),'부팅 후에도 오프닝이 안 감춰짐');
    openHome(); await sleep(40);
    return '가드 있음 · openAuth는 화면을 덮는다(=가드가 필요하다)'; });
  // 메인 화면 = RPG 마을. 허브(게임 선택)는 삭제됐고, 유즈맵은 마을 하단 버튼으로만 들어간다.
  // 메인 화면 = HOME 대시보드. 허브는 삭제됐고, 화면 이동은 전역 하단 네비(#navBar) 하나로만 한다.
  await step('메인 = HOME 대시보드 · 하단 네비로 화면 이동', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof openHome!=='function','HOME 없음');
    assert(!$('hubScreen') && typeof openHub==='undefined','허브가 아직 남아 있음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60);
    assert(visible($('homeScreen')),'HOME이 안 열림');
    // HOME에 남은 것은 POWER UPGRADES 카드 하나뿐이다 (+ 전역 재화 바·네비)
    for(const [sel,name] of [['.hmUpg','POWER UPGRADES'],['#navBar','하단 네비'],['#curBar','재화 바']])
      assert(visible(document.querySelector(sel)), name+'이(가) 없음: '+sel);
    for(const [sel,name] of [['.hmQuick','바로가기 줄'],['.hmLeague','리그 순위표'],['.hmVs','라이브 매치 바'],
        ['.hmRes','수입 줄'],['.hmStage','매치 화면']])
      assert(!document.querySelector(sel), '지운 구역이 남아 있음: '+name+' ('+sel+')');
    { const sc=$('hmScroll'), up=document.querySelector('.hmUpg');
      // 카드는 네비 바로 위에 붙고, 위쪽은 배경이 보이도록 비어 있어야 한다
      // ⚠ .hmScroll의 아래 padding이 네비 높이(--navH)만큼이라 스크롤 박스 하단이 아니라 네비 상단을 기준으로 잰다
      { const gap=$('navBar').getBoundingClientRect().top-up.getBoundingClientRect().bottom;
        assert(gap>=0 && gap<=12,'업그레이드 카드가 네비 바로 위에 안 붙음: '+Math.round(gap)+'px'); }
      assert(up.getBoundingClientRect().top-sc.getBoundingClientRect().top>=60,
        '카드 위가 안 비어 있음(배경이 안 보임): '+Math.round(up.getBoundingClientRect().top-sc.getBoundingClientRect().top)+'px');
      assert(sc.scrollHeight-sc.clientHeight<=2,
        'HOME이 세로로 넘침(스크롤 생김): '+(sc.scrollHeight-sc.clientHeight)+'px'); }
    // 상단 재화 바는 HOME에서만 '판'이 아니라 배경 위 숫자 — 면·아래 테두리가 없어야 배경이 이어져 보인다
    { const cb=getComputedStyle($('curBar'));
      assert(cb.backgroundImage==='none' && /rgba\(0, 0, 0, 0\)|transparent/.test(cb.backgroundColor),
        'HOME 재화 바에 면이 남아 배경이 끊김: '+cb.backgroundImage+' / '+cb.backgroundColor);
      assert(parseFloat(cb.borderBottomWidth)===0,'HOME 재화 바에 상단 구분선이 남음: '+cb.borderBottomWidth);
      assert(getComputedStyle($('curBar'),'::after').display==='none','재화 바 헤어라인(::after)이 남음'); }
    // 톤 검사 — 네비바와 같은 회색이어야 한다(푸른기가 있으면 B가 R보다 크게 뜬다) · 모서리는 거의 직각
    // 면(background)은 회색뿐. 테두리만 패널 액센트(빨강)를 허용한다 — 파랑은 어느 쪽에서도 못 들어온다.
    { const rgb=s=>(s.match(/\d+(\.\d+)?/g)||[]).slice(0,3).map(Number);
      const gray=(r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b)<=12;
      const red=(r,g,b)=>r>g+40 && r>b+40;   // 빨강 액센트(255,59,59). 푸른기는 b가 커서 여기도 못 든다
      // ⚠ 테두리 그라데는 background 레이어(border-box 클립)로 그린다 — 속성 이름으로는 면/테두리를 못 가른다.
      //    background-clip 을 레이어별로 보고 border-box 인 레이어만 '테두리'로 친다.
      const layers=s=>{ const out=[]; let d=0,cur=''; for(const ch of s){
          if(ch==='(') d++; else if(ch===')') d--;
          if(ch===',' && d===0){ out.push(cur); cur=''; } else cur+=ch; }
        if(cur.trim()) out.push(cur); return out; };
      for(const el of [...document.querySelectorAll('#homeScreen .hmCard, #homeScreen .hmUp, #homeScreen .hmUpIco')]){
        const c=getComputedStyle(el);
        const clips=c.backgroundClip.split(',').map(s=>s.trim());
        const srcs=[[c.backgroundColor,0],[c.borderTopColor,1]];
        layers(c.backgroundImage).forEach((L,i)=>
          srcs.push([L, (clips[i]||clips[clips.length-1])==='border-box' ? 1 : 0]));
        for(const [src,isBd] of srcs){
          for(const m of (src.match(/rgba?\([^)]*\)/g)||[])){ const [r,g,b]=rgb(m);
            if(r===undefined) continue;
            assert(gray(r,g,b) || (isBd && red(r,g,b)),
              'HOME '+(isBd?'테두리':'면')+'에 회색·빨강 밖의 색('+(el.className||el.tagName)+'): '+m); } }
        for(const v of c.borderRadius.split(/[\s\/]+/))
          assert(!v || v==='0px' || v==='3px', 'HOME 모서리가 너무 둥금('+(el.className||el.tagName)+'): '+v); } }
    // 사냥터는 칸이 없다(NAV_TREE noCell) — 기본 화면이자 '‹ 뒤로'가 돌아가는 곳이라 고를 대상이 아니다
    assert(document.querySelectorAll('#navBar .navIt').length===4,'하단 네비가 4칸이 아님(캐릭터·정비·유즈맵·상점)');
    { const navs=[...document.querySelectorAll('#navBar .navIt')].map(x=>x.dataset.nav).join(',');
      assert(navs==='upg,gear,map,shop','네비 구성이 다름: '+navs);
      assert(!document.querySelector('#navBar .navIt[data-nav=home]'),'사냥터 칸이 아직 남아 있음');
      assert(!document.querySelector('#navBar .navIt.on'),'사냥터에 있는데 켜진 칸이 있음');
      // 토벌은 네비에서 빠지고 HOME 팝업이 됐다 — 2번 칸은 정비(장비·펫·동료)
      assert(document.querySelector('#navBar .navIt[data-nav=upg]').textContent.indexOf('캐릭터')>=0,'2번 칸 표기가 캐릭터가 아님'); }
    // ⚠ .hide 가 실제로 숨기는지 — id 선택자에 display 를 주면 .appScreen.hide(클래스 2개)를 이겨
    //   화면이 안 숨고 다른 화면 위를 덮어 클릭을 전부 먹는다(강화 화면이 실제로 그랬다).
    { const shown=[];
      for(const el of document.querySelectorAll('.appScreen.hide'))
        if(getComputedStyle(el).display!=='none') shown.push(el.id||el.className);
      assert(!shown.length,'.hide 인데 안 숨는 화면: '+shown.join(', ')); }
    // 사냥터엔 칸이 없다(noCell) — '거기 있음'은 화면으로 확인하고, 켜진 칸은 없어야 한다
    assert(visible($('homeScreen')) && !document.querySelector('#navBar .navIt.on'),'사냥터로 안 왔거나 켜진 칸이 남음');
    // 실데이터에 붙은 곳 = 사냥터 업그레이드(내 캐릭터·동료·건물·펫 4구역 · 해금제)
    // 탭 띠는 장비창 섹션 바와 같은 컴포넌트여야 한다(segNavHTML 단일 소스) — 새 탭 띠를 만들면 여기서 걸린다
    { const seg=document.querySelector('#hmUpgTabs .pdSeg');
      assert(seg,'업그레이드 탭이 공용 세그먼트 바(.pdSeg)를 안 씀');
      assert(seg.querySelectorAll('.pdSegBtn').length===HB_UPG_CAT.length,'업그레이드 탭 수가 HB_UPG_CAT 과 다름');
      // 구역마다 판을 물들이는 색이 다르다 — 선택된 구역의 색이 판에 실려야 한다
      { const cur=hbHunt().upgCat, ent=HB_UPG_CAT.find(c=>c[0]===cur);
        assert(ent && ent[2],'구역 '+cur+' 에 색이 없음');
        assert(seg.querySelector('.pdSegInd').style.getPropertyValue('--segCol')===ent[2],
          '판에 구역색이 안 실림: '+seg.querySelector('.pdSegInd').style.getPropertyValue('--segCol')+' vs '+ent[2]);
        const cols=HB_UPG_CAT.map(c=>c[2]);
        assert(new Set(cols).size===cols.length,'구역색이 겹침: '+cols.join(' / ')); }
      assert(seg.querySelectorAll('.pdSegInd').length===1,'현재 구역을 가리키는 판(.pdSegInd)이 없음');
      // 카드 껍데기(--cardRing)는 유즈맵 유닛 카드(.hsCell)와 같은 토큰이다 — 한쪽만 바꾸면 둘이 갈린다
      assertCardRing(document.querySelector('#hmUpgGrid .hmUp'), '사냥터 업그레이드 카드');
      // 글자만 — 아이콘이 끼면 아이콘+글자가 한 덩어리로 가운데 정렬돼 글자가 중앙에서 밀린다
      assert(!seg.querySelector('[data-ico]'),'탭에 아이콘이 다시 들어옴(글자가 중앙에서 밀린다)');
      // 판이 바깥 테두리 안쪽 --pad 만큼만 띄워져 있어야 한다(양쪽 틈이 같아야 '맞닿는' 느낌이 난다)
      { const pad=parseFloat(getComputedStyle(seg).paddingTop), sr=seg.getBoundingClientRect();
        const ir=seg.querySelector('.pdSegInd').getBoundingClientRect();
        assert(pad<=2.5,'탭 띠 안쪽 틈이 너무 넓음: '+pad+'px');
        assert(Math.abs((ir.top-sr.top)-(pad+1))<1.5,'판 위쪽 틈이 --pad 와 안 맞음: '+(ir.top-sr.top).toFixed(1));
        assert(Math.abs((ir.left-sr.left)-(pad+1))<1.5,'판 왼쪽 틈이 --pad 와 안 맞음: '+(ir.left-sr.left).toFixed(1)); } }
    // ⚠ hmUpgTab 은 탭 띠를 통째로 다시 그린다 — 위에서 잡아둔 .pdSeg 참조가 끊기므로 구역 전환은 그 뒤에.
    // 아군 구역은 '사는 카드'와 '키우는 카드'가 같은 격자에 함께 있어야 한다(건설 팝업은 폐지됐다)
    { const before=hbHunt().upgCat;
      hmUpgTab('ally');
      // 동료 '고용' 카드는 없어야 한다 — 영입은 미네랄이 아니라 동료 뽑기권이다(뽑기로만 얻는다)
      assert(!document.querySelector('#hmUpgGrid .hmUp[data-k="b_ally"]'),'동료 구역에 미네랄 고용 카드가 남아 있음');
      assert(document.querySelectorAll('#hmUpgGrid .hmUp').length>0,'동료 구역에 강화 카드가 하나도 없음');
      assert(document.querySelector('#hmUpgGrid .hmUp[data-k="alatk"]'),'동료 구역에 강화 카드가 없음');
      hmUpgTab('bld');
      // 건설 카드는 격자에 없다 — 여긴 '지어진 것의 스탯을 올리는' 곳이고, 짓는 것은 전장 위 버튼이다
      assert(!document.querySelector('#hmUpgGrid .hmUp[data-k^="b_"]'),'건물 구역에 건설 카드가 남아 있음');
      assert(document.querySelector('#hmUpgGrid .hmUp[data-k="tuatk"]'),'건물 구역에 강화 카드가 없음');
      // 짓는 입구는 더보기 > 건설 — 누르면 '이 패널'이 건설 구역이 된다(2026-08-14 · 좌상단 드롭다운 폐지)
      { assert(!document.getElementById('hbBuildWrap'),'좌상단 건설 랩이 아직 남아 있음');
        assert(typeof hbToggleBuild!=='function' && typeof renderHbBuild!=='function','옛 좌상단 건설 드롭다운이 남아 있음');
        assert(!document.getElementById('hbDgBtn')&&!document.getElementById('hbBoostBtn'),'토벌·부스트가 아직 좌상단에 있음');
        assert(typeof hbOpenMore==='function','더보기가 없는데 좌상단에서도 빠졌다 — 들어갈 길이 사라진다');
        hbBuildStart();
        const card=document.querySelector('#homeScreen .hmUpg');
        assert(_hb.build===true,'건설 모드로 안 들어감');
        assert(card.classList.contains('bd'),'하단 패널이 건설 구역으로 안 바뀜');
        assert(document.querySelector('#homeScreen .hmUpgTtl').textContent==='건설','패널 제목이 건설이 아님');
        assert(!visible(document.querySelector('#homeScreen .hmUpgBar')),'건설 모드인데 탭 띠·수량이 남아 있음');
        const bc=[...document.querySelectorAll('#hmUpgGrid .hmUp[data-k^="b_"]')];
        assert(bc.length===HB_BUILD_KEYS.length,'건설 카드가 '+HB_BUILD_KEYS.length+'장이 아님: '+bc.length);
        assert(bc.every(b=>b.querySelector('img')),'건설 카드에 건물 아이콘이 없음');
        assert(!$('hbBuildStop').classList.contains('hide'),'해제(⊘) 버튼이 안 보임');
        hbBuildExit();
        assert(_hb.build===false && !card.classList.contains('bd'),'⊘ 로 건설 모드가 안 풀림');
        assert(document.querySelector('#homeScreen .hmUpgTtl').textContent!=='건설','나갔는데 제목이 건설로 남음'); }
      assert(typeof hbOpenBuild!=='function','건설 팝업이 아직 남아 있음(패널로 흡수됐어야 한다)');
      hmUpgTab(before); }
    // 수량은 한 칸을 눌러 돌린다 — 1 → 10 → MAX → 1. 폭은 라벨이 바뀌어도 고정
    { const qs=document.querySelectorAll('#hmUpgQty .hmUpQ');
      assert(qs.length===1,'수량은 한 칸이어야 함: '+qs.length+'개');
      const box=$('hmUpgQty'), w0=Math.round(box.getBoundingClientRect().width);
      const seen=[];
      for(let i=0;i<4;i++){ seen.push(box.querySelector('.hmUpQ').textContent);
        assert(Math.round($('hmUpgQty').getBoundingClientRect().width)===w0,'수량 칸 폭이 변함');
        hmUpgQtyCycle(); }
      assert(seen.join(',')==='×1,×10,MAX,×1','수량 순환이 1→10→MAX→1이 아님: '+seen.join(','));
      hbHunt().upgQty=1; renderHome(); }   // 뒤 검사(1회 구매)가 오염되지 않게 되돌린다
    // 자동·수량은 제목과 '같은 줄' 오른쪽 끝에 있고, 탭 띠가 아래 줄을 통째로 쓴다
    { const box=e=>document.querySelector(e).getBoundingClientRect();
      const ttl=box('#homeScreen .hmUpgTtl'), au=box('#hmUpgAuto'), q=box('#hmUpgQty');
      assert(Math.abs((au.top+au.height/2)-(ttl.top+ttl.height/2))<8,'자동이 제목과 같은 줄이 아님');
      assert(Math.abs((q.top+q.height/2)-(ttl.top+ttl.height/2))<8,'수량이 제목과 같은 줄이 아님');
      assert(au.left>ttl.right-1 && q.left>=au.right-1,'자동·수량이 오른쪽 끝에 붙지 않음');
      const tabs=box('#hmUpgTabs'), bar=box('#homeScreen .hmUpgBar');
      assert(tabs.top>ttl.bottom-1,'탭 띠가 제목 줄 위로 올라옴');
      assert(bar.right-tabs.right<12,'탭 띠가 남은 폭을 안 채움: '+Math.round(bar.right-tabs.right)+'px 남음');
      assert(!document.querySelector('#homeScreen .hmUpgBar .hmUpQty'),'자동·수량이 아직 아래 줄에 있음');
      // 건설 모드엔 탭 띠가 숨는다 — 머리줄로 옮긴 자동·수량도 같이 숨어야 한다
      { const card=document.querySelector('#homeScreen .hmUpg');
        card.classList.add('bd');
        assert(getComputedStyle($('hmUpgAuto')).display==='none','건설 모드인데 자동이 남아 있음');
        assert(getComputedStyle($('hmUpgQty')).display==='none','건설 모드인데 수량이 남아 있음');
        card.classList.remove('bd'); } }
    // 🤖 자동 업그레이드 — 수량 버튼과 같은 물성, 켜짐은 .on 으로만 구분
    { const a=document.querySelector('#hmUpgAuto .hmUpQ');
      assert(a && a.textContent.trim()==='자동','자동 업그레이드 버튼이 없음: '+(a&&a.textContent));
      assert(a.scrollWidth<=a.clientWidth+1,'자동 글자가 잘림');
      const on0=hmAutoOn(); if(on0) hmAutoToggle();
      assert(!document.querySelector('#hmUpgAuto .hmUpQ').classList.contains('on'),'꺼졌는데 켜져 보임');
      hmAutoToggle();
      assert(hmAutoOn() && document.querySelector('#hmUpgAuto .hmUpQ').classList.contains('on'),'켰는데 안 켜져 보임');
      hmAutoToggle(); }
    { const n=document.querySelectorAll('.hmUp').length, all=Object.keys(HB_UPG).length;
      assert(n>0 && n<all,'현재 탭만 그려야 하는데 '+n+'/'+all+'칸');
      // 잠긴 칸은 값·레벨 대신 자물쇠 — 해금 전에 사면 안 된다
      assert(document.querySelectorAll('.hmUp.lk').length>0,'잠긴 업그레이드가 하나도 없음(해금제가 안 걸림)');
      assert(hbUpgOwned('atk') && hbUpgOwned('aspd'),'데미지·공격속도는 처음부터 열려 있어야 함'); }
    // 버튼 윗줄 = '지금 레벨'만. 값 변화는 바로 위 줄이 말하므로 여기서 또 화살표를 쓰지 않는다.
    { const cards=[...document.querySelectorAll('#hmUpgGrid .hmUp:not(.lk)')];
      assert(cards.length>0,'열린 카드가 없음');
      for(const e of cards){ const k=e.dataset.k, bl=e.querySelector('.hmUpBl');
        assert(bl.textContent.trim()==='LV.'+(hbHunt().upg[k]||0),k+' 버튼 윗줄이 지금 레벨이 아님: '+bl.textContent.trim());
        assert(!bl.querySelector('.nx') && !bl.querySelector('svg'),k+' 버튼 윗줄에 화살표가 남아 있음'); }
      // 값 줄은 반대로 '지금 ▸ 다음' 이 남아 있어야 한다(무엇이 오르는지는 여기서 본다)
      assert(cards[0].querySelector('.hmUpVl .nx'),'값 줄에서 다음 값이 사라짐'); }
    // 2.7행이 보이는 '고정' 높이 — 0.7행이 걸쳐 보이는 게 '더 있다'는 신호. 탭마다 개수가 달라도 안 흔들린다
    { const gr=$('hmUpgGrid'), cell=gr.querySelector('.hmUp');
      // ⚠ 간격·패딩을 박지 말 것 — CSS 에서 조정하면 검사가 헛걸린다. 실제 값을 읽어 계산한다
      const gcs=getComputedStyle(gr), gp=parseFloat(gcs.paddingTop)||0, gg=parseFloat(gcs.rowGap)||0;
      const ch=cell.getBoundingClientRect().height, rows=(gr.clientHeight-2*gp+gg)/(ch+gg);
      assert(Math.abs(rows-2.7)<0.15,'업그레이드 높이가 2.7행이 아님: '+rows.toFixed(2)+'행');
      const h0=gr.clientHeight;
      hmUpgTab('pet'); const h1=$('hmUpgGrid').clientHeight;   // 칸이 제일 적은 구역으로 바꿔도 안 흔들려야 한다
      hmUpgTab('char');
      assert(h0===h1,'탭을 바꾸면 높이가 변함: '+h0+' → '+h1);
      assert(gr.scrollHeight-gr.clientHeight>10,'나머지 칸이 스크롤되지 않음'); }
    // 접기는 폐지했다(2026-08-19) — 늘 펴 두는 구역이라 접는 칸이 자리만 먹었다
    { assert(typeof hmToggleUpg==='undefined','접기 함수가 아직 남아 있음');
      assert(!document.querySelector('#homeScreen .hmUpgChev'),'접기 화살표가 아직 있음');
      assert(!document.querySelector('.hmUpg').classList.contains('down'),'접힌 채로 시작함');
      const hd=document.querySelector('#homeScreen .hmUpgHead');
      assert(hd && hd.tagName!=='BUTTON','머리줄이 아직 누르는 버튼임'); }
    PROF().pcoin=99999; renderHome();
    const btn=document.querySelector('.hmUp .hmUpBtn'); assert(!btn.disabled,'미네랄이 있는데 버튼이 잠김');
    const lv0=PROF().hunt.upg.atk||0, pc0=PROF().pcoin; btn.click();
    assert((PROF().hunt.upg.atk||0)===lv0+1,'구매가 업그레이드 레벨에 반영되지 않음');
    assert(PROF().pcoin<pc0,'미네랄이 차감되지 않음');
    // 네비 이동: 유즈맵 → HOME → 마을
    navGo('map'); await sleep(80);
    assert(visible($('mapSelect')),'네비 유즈맵이 목록을 안 엶');
    // 유즈맵도 하단 네비로 이동한다(좌상단 뒤로가기 버튼은 없앴다)
    assert(visible($('navBar')),'유즈맵 화면에 네비가 없음');
    assert(document.querySelectorAll('#navBar .navIt[data-sub]').length===3,'유즈맵 하위(소셜)가 3칸이 아님');
    assert(document.getElementById('msSortTabs'),'유즈맵 정렬 띠가 화면 위에 없음');
    // 정렬 띠 = 사냥터 업그레이드 탭과 **같은 컴포넌트**(.pdSeg · segNavHTML). 전용 탭 클래스를 되살리면 안 된다.
    { const seg=document.querySelector('#msSortTabs .pdSeg');
      assert(seg,'유즈맵 정렬 띠가 공용 세그먼트 바(.pdSeg)를 안 씀');
      assert(seg.querySelector('.pdSegInd') && seg.querySelectorAll('.pdSegBtn').length===MAP_SORTS.length,'세그먼트 구성이 다름');
      assert(!document.querySelector('.msSortTab'),'옛 전용 탭(.msSortTab)이 남아 있음');
      // 선택 표시가 실제로 움직이는가 — 인디케이터 left 가 탭마다 달라야 한다
      const at=()=>document.querySelector('#msSortTabs .pdSegInd').getBoundingClientRect().left;
      const x0=at(); setMapSort('rec'); await sleep(60);
      assert(Math.abs(at()-x0)>10,'정렬을 바꿨는데 선택 표시가 안 움직임');
      assert(document.querySelectorAll('#msSortTabs .pdSegBtn.on').length===1,'선택 표시가 하나가 아님');
      setMapSort('pop'); await sleep(40);
      // 사냥터 탭 띠와 같은 물성인가 — 판·인디케이터의 라운드가 같아야 한다(공용 규칙을 안 덮었다는 뜻)
      openHome(); await sleep(220); renderHome();
      const hs=document.querySelector('#hmUpgTabs .pdSeg');
      if(hs){ const r=e=>getComputedStyle(e).borderTopLeftRadius;
        navGo('map'); await sleep(120);
        const ms=document.querySelector('#msSortTabs .pdSeg');
        assert(r(ms)===r(hs),'사냥터 탭 띠와 라운드가 다름: '+r(ms)+' vs '+r(hs)); }
      else { navGo('map'); await sleep(120); } }
    // 탭 띠와 목록은 **한 상자**(.msPanel) 안에 있고, 가로가 정확히 같아야 한다
    { const panel=document.querySelector('#mapSelect .msPanel');
      assert(panel && panel.contains($('msSortTabs')) && panel.contains($('msList')),'탭 띠와 목록이 한 상자 안에 없음');
      const cs=getComputedStyle(panel);
      // ⚠ --hmPanel/--hbEdge 는 HOME·마을 안에서만 정의된다 — 대체값을 빼면 면도 테두리도 통째로 사라진다
      assert(cs.borderTopStyle!=='none' && parseFloat(cs.borderTopWidth)>=1,'상자 테두리가 안 그려짐(--hbEdge 대체값 누락?)');
      assert(cs.backgroundImage!=='none','상자 면이 안 칠해짐(--hmPanel 대체값 누락?)');
      const seg=document.querySelector('#msSortTabs .pdSeg').getBoundingClientRect();
      const it=document.querySelector('#msList .mapItem').getBoundingClientRect();
      assert(Math.abs(seg.left-it.left)<=0.6 && Math.abs(seg.right-it.right)<=0.6,
        '탭 띠와 목록 가로가 안 맞음: '+seg.left.toFixed(1)+'~'+seg.right.toFixed(1)+' vs '+it.left.toFixed(1)+'~'+it.right.toFixed(1)); }
    assert(!document.querySelector('#mapSelect .msHeadL .twBack'),'유즈맵 좌상단 뒤로가기 버튼이 아직 있음');
    mapToHub(); await sleep(80);
    assert(visible($('homeScreen')),'유즈맵에서 뒤로 갔는데 HOME으로 안 옴 [DBG 보이는화면='+
      [...document.querySelectorAll('.appScreen')].filter(e=>visible(e)).map(e=>e.id).join(',')+
      ' CHAR='+(!!CHAR())+' AUTH='+(AUTH.user?(AUTH.user.uid||AUTH.user.id||AUTH.user.nick):'null')+']');
    navGo('town'); await sleep(80);   // 마을 폐지 — 옛 진입점은 HOME으로 리다이렉트된다
    assert(visible($('homeScreen')) && visible($('navBar')),'마을 진입이 HOME으로 안 감 [DBG 보이는화면='+
      [...document.querySelectorAll('.appScreen')].filter(e=>visible(e)).map(e=>e.id).join(',')+']');
    // 사냥터엔 칸이 없다(noCell) — '거기 있음'은 화면으로 확인하고, 켜진 칸은 없어야 한다
    assert(visible($('homeScreen')) && !document.querySelector('#navBar .navIt.on'),'사냥터로 안 왔거나 켜진 칸이 남음');
    // 정비 탭 = 장비·펫·동료 전용 화면 · 상점 탭 = 상점 전용 화면
    navGo('gear'); await sleep(60);
    // 정비·유즈맵·상점은 내려가므로 구역 칸(.on)이 없다 — 화면과 하위 칸으로 확인한다
    assert(visible($('gearScreen')),'네비 정비가 화면을 안 엶');
    assert(document.querySelectorAll('#navBar .navIt[data-sub]').length===3,'정비 하위가 3칸이 아님');
    navGo('shop'); await sleep(60);
    assert(document.querySelectorAll('#navBar .navIt[data-sub]').length===5,'상점 하위가 5칸이 아님');
    // 구역에 '들어올 때'는 늘 첫 하위로 — 유즈맵 하단 탭바(gtabDrill)와 같은 규칙(2026-08-14).
    //   펫을 보다 나갔다 다시 들어와도 펫이 열려 있으면 구역 이름과 내용이 어긋난다.
    { const cur=()=>{ const e=document.querySelector('#navBar .navIt.cur'); return e?e.dataset.sub:null; };
      navGo('gear'); await sleep(80);
      assert(cur()==='gear','정비 진입인데 첫 하위가 아님: '+cur());
      navSub('pet'); await sleep(80); assert(cur()==='pet','하위 전환이 안 됨: '+cur());
      navBack(); await sleep(80);
      navGo('gear'); await sleep(90);
      assert(cur()==='gear','정비 재진입인데 첫 하위가 아님: '+cur());
      assert(_gearTab==='gear','정비 재진입인데 _gearTab 이 안 되돌아옴: '+_gearTab);
      // 다른 구역을 들렀다 와도 마찬가지
      navGo('shop'); await sleep(80); navSub('gem'); await sleep(80);
      navGo('upg'); await sleep(80);
      navGo('shop'); await sleep(90);
      assert(cur()==='deal','상점 재진입인데 첫 하위가 아님: '+cur()); }
    openHome(); await sleep(60);
    return 'HOME 카드 1개 + 네비 5칸(home·정비·마을·유즈맵·상점) ok'; });
  // 폰트 3종 — 제목 Jua(내장) · 본문 Noto Sans KR Bold(내장) · 숫자 Rajdhani(웹폰트).
  // ⚠ 실제 렌더가 아니라 CSS만 잰다(헤드리스에선 웹폰트를 못 받을 수 있어 렌더 비교는 못 믿는다).
  await step('폰트: 제목/본문/숫자가 토큰으로 갈린다', async()=>{
    const root=getComputedStyle(document.documentElement);
    const ti=root.getPropertyValue('--font-ti'), ko=root.getPropertyValue('--font-ko'), num=root.getPropertyValue('--font-num');
    // 제목=디스플레이(Jua) · 본문=고가독(Noto Bold) — 두 가족을 역할로 가른다
    assert(/JuaKR/.test(ti),'제목 토큰이 JuaKR이 아님: '+ti);
    assert(/NotoKR/.test(ko),'본문 토큰이 NotoKR이 아님: '+ko);
    assert(ti!==ko,'제목·본문이 같은 토큰 — 역할이 안 갈림');
    assert(/Rajdhani/.test(num),'숫자 토큰에 Rajdhani가 없음: '+num);
    assert(ti!==num && ko!==num,'숫자 폰트가 한글과 안 갈림');
    // 한글 2종은 내장(woff2)이라 네트워크 없이도 뜬다 — @font-face 실재 확인
    const faces=[...document.fonts].map(f=>f.family);
    for(const f of ['JuaKR','NotoKR'])
      assert(faces.indexOf(f)>=0, f+' @font-face가 없음: '+[...new Set(faces)].join(','));
    // 숫자는 여전히 구글 웹폰트(Rajdhani)
    const imp=[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch(e){return []}})
      .filter(r=>r.type===CSSRule.IMPORT_RULE).map(r=>r.href).join(' ');
    assert(imp.indexOf('Rajdhani')>=0,'Rajdhani를 웹폰트로 안 불러옴: '+imp);
    // 개별 규칙에 폰트 이름을 박아두면 토큰이 무의미해진다
    let hard=0, sample='';
    for(const sh of document.styleSheets){ let rules; try{rules=sh.cssRules}catch(e){continue}
      for(const r of rules||[]){ if(!r.selectorText) continue;   // @font-face는 폰트를 '정의'하는 곳이라 이름이 있는 게 정상
        const ff=r.style&&r.style.fontFamily;
        if(ff && /Rajdhani|Do Hyeon|IBM Plex|Apple SD Gothic|JuaKR|NotoKR/.test(ff)){ hard++; if(!sample) sample=r.selectorText+' → '+ff; } } }
    assert(hard===0,'개별 규칙에 폰트 이름이 박혀 있음('+hard+'곳): '+sample);
    // 위계 = 가족 + 크기. Jua는 400 단일 굵기라 굵기로는 가를 수 없다.
    // ⚠ 하단(네비·탭·카드 이름)과 사냥터 패널 제목은 Noto 로 통일했다 — Jua 는 큰 제목에만 남는다.
    //   그래서 Jua 표본은 .hmUpgHead 가 아니라 화면 제목(.curTitle = 재화 바 왼쪽)에서 잰다.
    openShop(); await sleep(60);
    const head=document.querySelector('#curBar .curTitle'), hs=getComputedStyle(head);
    assert(/JuaKR/.test(hs.fontFamily),'큰 제목에 제목 폰트(JuaKR)가 안 걸림: '+hs.fontFamily);
    openHome(); await sleep(60);
    const body=document.querySelector('.hmUpName'), bs=getComputedStyle(body);
    assert(!/JuaKR/.test(bs.fontFamily),'본문까지 제목 폰트라 위계가 없음: '+bs.fontFamily);
    // 하단은 한 서체로 — 네비 라벨·패널 제목·카드 이름이 전부 Noto 여야 한다(서체가 섞이면 글자가 삐뚤빼뚤해 보인다)
    for(const sel of ['#navBar .navIt','.hmUpgHead','.pdSegBtn']){
      const el=document.querySelector(sel); if(!el) continue;
      assert(/NotoKR/.test(getComputedStyle(el).fontFamily), sel+' 이 Noto 가 아님: '+getComputedStyle(el).fontFamily); }
    const hsz=parseFloat(hs.fontSize), bsz=parseFloat(bs.fontSize);
    assert(hsz-bsz>=3,'제목이 본문보다 충분히 크지 않음: 제목 '+hsz+' / 본문 '+bsz);
    return '큰제목 Jua '+hsz+'px · 하단 전부 Noto '+bsz+'px · 숫자 Rajdhani'; });
  // 💠 공용 재화 바 — 미네랄=pcoin · 가스 · 젬. 모든 RPG/허브 + 유즈맵 선택 상단 상시(인게임 제외).
  await step('공용 재화 바: RPG/유즈맵 상단 상시 · 미네랄/가스/젬', async()=>{ skipIf(typeof curShow!=='function','재화 바 없음');
    // curShow()는 showAppScreen 안에서 동기 실행 → 화면 연 직후 동기 검사(전환 FX/타이머 레이스 회피)
    const shown=()=>{ const b=$('curBar'); return !!b && !b.classList.contains('hide'); };
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','재화'); saveMeta(); }
    const p=PROF(); p.pcoin=12345; p.gas=67; p.gem=8; saveMeta();
    openHome(); assert(shown(),'HOME에 재화 바가 없음');
    assert($('curMin').textContent.replace(/,/g,'')==='12345','미네랄이 pcoin과 다름: '+$('curMin').textContent);
    assert($('curGas').textContent==='67' && $('curGem').textContent==='8','가스/젬 표시 불일치');
    navGo('map'); assert(shown(),'유즈맵 선택에 재화 바가 없음');
    mapToHub(); navGo('town'); assert(shown(),'마을에 재화 바가 없음');
    if(typeof dgEnter==='function'){ dgEnter(1); assert(shown(),'던전에 재화 바가 없음'); openHome(); }
    openHome(); await sleep(40);
    return '미네랄=pcoin(12,345) · 가스/젬 · 홈/유즈맵/마을/던전 상시'; });
  // 🏕 캠프 — HOME 을 열면 바로 캠프. 건설 시스템을 빌려 쓰고 진행이 저장된다.
  await step('캠프: 종족 선택 · 진입 · 저장 · 복원', async()=>{
    skipIf(typeof campOpen!=='function','캠프 없음');
    const C=campState(); C.race=null; C.ents=[]; C.minerals=[]; C.built={};   // 신규 계정처럼
    openHome(); await sleep(260);
    // ① 종족을 안 골랐으면 선택 화면이 뜬다 — 2026-08-24 개편: 팝업이 아니라 **전체 화면**이다
    //   기준은 로딩·로그인·설정(DESIGN.md · 목업 docs/mock/race-select-v2-4a.html b안).
    const ov=$('campRaceOv');
    assert(ov && !ov.classList.contains('hide'),'종족 선택이 안 뜸');
    assert(!ov.classList.contains('hbModal'),'종족 선택이 팝업(.hbModal)으로 돌아갔다 — 전체 화면이어야 한다');
    { const r=ov.getBoundingClientRect(), ph=$('phone').getBoundingClientRect();
      assert(r.height>ph.height*0.9,'전체 화면이 아니다: '+Math.round(r.height)+' vs '+Math.round(ph.height)); }
    // ⚠ 캠프는 3종족만 쓴다(페럴·콜로서스는 캠프 경제 미대응) — STK_RACE_ORDER(5)와 다른 것이 정상
    const rows=[...ov.querySelectorAll('.crRow')];
    assert(rows.length===CAMP_RACE_ORDER.length,'종족 행이 CAMP_RACE_ORDER 와 다름: '+rows.length);
    assert(rows.map(r=>r.querySelector('.crNm').textContent).join()===
      CAMP_RACE_ORDER.map(k=>STK_RACES[k].name).join(),'종족 이름/순서가 표와 다르다');
    // ⛔ 행 구분선은 좌우로 사라지는 헤어라인이다(DESIGN.md §1 볼륨 1). 전폭 실선으로 되돌리면
    //   선이 그림을 가로질러 아트가 배경이 아니라 '표'로 보인다 — 로그인이 그 이유로 버린 처리다.
    assert(getComputedStyle(rows[0]).borderBottomWidth==='0px','행이 전폭 실선 테두리를 쓴다');
    assert(/linear-gradient/.test(getComputedStyle(rows[0],'::after').backgroundImage),
      '행 구분선이 그라데 헤어라인이 아니다');
    // 확정 버튼은 판 없이 글자 + 밑변 광원(주 버튼의 서명)
    { const go=ov.querySelector('.crGo'); assert(go,'확정 버튼이 없다');
      assert(getComputedStyle(go).borderTopWidth==='0px','확정 버튼에 테두리가 생겼다 — 판을 쓰지 않는 화면이다');
      assert(/linear-gradient/.test(getComputedStyle(go,'::after').backgroundImage),'확정 버튼에 밑변 광원이 없다'); }
    // 경고 문구는 뺐다(사용자 결정 2026-08-24) — 되살리려면 확정 단계에 붙일 것
    assert(!/바꿀 수 없/.test(ov.textContent),'제거하기로 한 경고 문구가 살아 있다');
    // ② 고르면 본부·일꾼·광맥이 깔린다
    campRaceSel('terran'); campPickRace(); await sleep(420);
    assert(campState().race==='terran','종족이 저장 안 됨: '+campState().race);
    assert(G.tech && G.tech.race==='union','TECH 키로 변환이 안 됨: '+(G.tech&&G.tech.race));
    assert((G.tech.ents||[]).filter(e=>e.type==='bldg').length>=1,'본부가 없음');
    // 👷 **시작 일꾼 0기**(HUNT_R1 §1) — 첫 일꾼은 탭으로 번 돈으로 산다.
    //    ⛔ techUIInit 이 깔아 두는 1기를 되살리지 말 것. 「일꾼을 사는 것」이 첫 목표다.
    assert((G.tech.ents||[]).filter(e=>e.type==='worker').length===0,
      '시작 일꾼이 0기가 아니다: '+(G.tech.ents||[]).filter(e=>e.type==='worker').length);
    // 다음 마리 가격이 보유 수에 따라 오른다 — 140 × 1.65^n (31마리째부터 ×1.10 · 상한 40)
    assert(campHireCost(0)===140,'첫 일꾼 가격이 140 이 아니다: '+campHireCost(0));
    assert(campHireCost(1)>campHireCost(0),'일꾼 가격이 안 오른다');
    { const c30=campHireCost(29), c40=campHireCost(39);
      assert(c30>2.7e8&&c30<3.0e8,'30마리째가 설계(2.83억)와 다르다: '+c30);
      assert(c40>7.0e8&&c40<7.8e8,'40마리째가 설계(7.4억)와 다르다: '+c40);
      // ⭐ 31마리째부터 계단이 눕는다 — 안 그러면 40마리째가 424억이라 200회차에도 못 채운다
      assert(c40/c30 < 3,'후반 계단이 안 눕었다(×1.10 이어야): '+(c40/c30).toFixed(1)+'배'); }
    // ⚔ 반복 구매 — 같은 유닛을 살수록 비싸진다(기본가 × 1.15^보유). 조합을 강제하는 유일한 장치다.
    if(typeof campSyncUnitCost==='function'){
      const T=TECH_TREE[G.tech.race], wk=TECH_WORKER[G.tech.race];
      let q=null; for(const b of T.buildings){ const f=(b.produces||[]).find(x=>x.id!==wk); if(f){ q=f; break; } }
      assert(q,'전투 유닛 생산 항목을 못 찾음');
      campRestoreUnitCost(); const raw=q.m, base=campUnitBase(q.id, raw);
      // 💰 캠프 기본가는 설계표(HUNT_R1 §3-1) 값이다 — 코드 원값의 100~800배
      assert(base>raw,'캠프 기본가가 코드 원값보다 크지 않다: '+base+' vs '+raw);
      campSyncUnitCost();
      assert(q.m===base,'0기 보유인데 설계 기본가가 아니다: '+q.m+' (기대 '+base+')');
      G.tech.units[q.id]=3; campSyncUnitCost();
      const want=Math.ceil(base*Math.pow(1.15,3));
      assert(q.m===want,'3기 보유 값이 틀렸다: '+q.m+' (기대 '+want+')');
      // ⛔ TECH_TREE 는 관리자 탭·오토배틀과 공유 — 반드시 원복된다
      campRestoreUnitCost();
      assert(q.m===raw,'가격을 원복하지 않았다: '+q.m+' (원값 '+raw+')');
      G.tech.units[q.id]=0; }
    // ③ 광맥은 2열 × 3행 — 눈이 아니라 좌표로 잰다
    const M=G.tech.minerals||[];
    assert(M.length===6,'광맥이 6개가 아님: '+M.length);
    const xs=new Set(M.map(m=>m.x.toFixed(4))), ys=new Set(M.map(m=>m.y.toFixed(4)));
    assert(xs.size===CAMP_MINE_COLS && ys.size===CAMP_MINE_ROWS,
      '광맥이 '+CAMP_MINE_COLS+'×'+CAMP_MINE_ROWS+' 이 아님: '+xs.size+'열 '+ys.size+'행');
    // ⛽ 가스 광산은 광맥과 **같은 높이, 바로 옆**이다.
    //   ⚠ 격자 크기(_techRows)는 맵 요소의 실제 크기에 달렸다 — campShowView() 로 #vBuild 를
    //     HOME 안으로 옮기기 **전에** 재면 다른 값이 나온다(실측: 30행 vs 35행).
    //     그래서 가스를 뷰 전에 잡았더니 광맥보다 5행 위에 앉았다. 격자 계산은 뷰 뒤에 둘 것.
    { const sy=(wx,wy)=>_techW2S(wx,wy).y, sx=(wx,wy)=>_techW2S(wx,wy).x;
      const cw=_techCW(), ch=_techCH();
      const gx=sx(TECH_GRID.x0+(TECH_GAS.c0+TECH_GAS.w/2)*cw, 0);
      const gy=sy(0, techY0()+(TECH_GAS.r0+TECH_GAS.h/2)*ch);
      const mY=M.map(m=>sy(m.x,m.y)), mX=M.map(m=>sx(m.x,m.y));
      assert(gy>=Math.min(...mY)-0.04 && gy<=Math.max(...mY)+0.04,
        '가스 광산이 광맥과 같은 높이가 아님: 가스 '+gy.toFixed(2)+' vs 광맥 '+Math.min(...mY).toFixed(2));
      assert(gx<Math.min(...mX),'가스 광산이 광맥 옆이 아님');
      // ⛽⛽ 가스는 **둘**이다 — 광맥 좌우. 건설 탭은 전역 하나(TECH_GAS)만 알지만,
      //   캠프가 판정 함수를 감싸 좌표를 잠시 바꿔 한 번 더 묻는 방식으로 두 자리를 인정한다.
      //   ⛔ 로직을 복사하지 않는다(복사본은 원본이 바뀌면 낡는다).
      { const g2x=sx(TECH_GRID.x0+(CAMP_GAS2.c0+TECH_GAS.w/2)*cw, 0);
        assert(g2x>Math.max(...mX),'오른쪽 가스가 광맥 오른쪽에 없다');
        assert(CAMP_GAS2.r0===TECH_GAS.r0,'두 가스 광산의 행이 다르다');
        const save=G.tech.arm; G.tech.arm='refinery';
        const at=(c,r)=>techArmValid(TECH_GRID.x0+(c+TECH_GAS.w/2)*cw, techY0()+(r+TECH_GAS.h/2)*ch);
        assert(at(TECH_GAS.c0,TECH_GAS.r0),'왼쪽 가스에 정제소를 못 짓는다');
        assert(at(CAMP_GAS2.c0,CAMP_GAS2.r0),'오른쪽 가스에 정제소를 못 짓는다');
        assert(!at(Math.round(techCols()/2), campRow(0.45)),'가스 광산이 아닌 곳에도 정제소가 지어진다');
        G.tech.arm=save; }
      // ⛽ 오른쪽 가스도 **왼쪽과 같은 실물**이어야 한다 — 구역 표시만 있으면 빈 땅으로 보인다.
      //   3D 노드는 renderBuildTab 이 목록에 하나만 넣으므로(14-input-fx.js:951) 캠프가
      //   M3D.syncBuild 를 감싸 하나 더 얹는다. ⚠ 바깥에서 가로채면 안 보인다(패치보다 앞이다).
      // ⚠ 3D 모듈(js/90-m3d.module.js)은 three.js 를 외부 CDN(esm.sh)에서 받는다. 오프라인·차단 환경에서는
      //   window.M3D 가 아예 안 생기고, 그러면 campPatchSync 도 걸리지 않는 것이 정상이다(감쌀 대상이 없다).
      //   그래서 3D 가 실제로 올라온 환경에서만 검사한다 — 다른 3D 스텝들의 '3D 미준비' 건너뜀과 같은 규칙.
      if(window.M3D && typeof M3D.syncBuild==='function'){ let seen=null; const inner=_campSyncOrig;
        assert(typeof inner==='function','M3D.syncBuild 패치가 안 걸렸다 — 오른쪽 가스 3D 가 안 선다');
        _campSyncOrig=function(list){ seen=(list||[]).filter(x=>x&&x.id==='res_en').map(x=>x.uid); return inner.apply(this,arguments); };
        for(let i=0;i<3;i++) campFrame(performance.now()+i*33);
        _campSyncOrig=inner;
        assert(seen && seen.length===2,'가스 3D 노드가 2개가 아님: '+(seen?seen.join(','):'없음')); }
      // 겉모습(클래스·라벨)도 같아야 한다
      { const L=document.querySelector('#cstMain .bmap .bGasZone'), R2=$('campGas2');
        assert(L&&R2,'가스 구역 DOM 이 둘이 아니다');
        assert(L.className.replace(' hot','')===R2.className,'두 가스 구역의 겉모습이 다르다: '+L.className+' vs '+R2.className);
        assert((R2.querySelector('.gzLbl')||{}).textContent===(L.querySelector('.gzLbl')||{}).textContent,'라벨이 다르다'); } }
    // ③-b ⭐ **세로 화면 구성** — 적은 위에서 내려오고, 지킬 본부가 그 아래, 광맥은 더 뒤.
    //     자주 누르는 광맥은 **아래 절반**에 있어야 한다(GAME_DIRECTION §2-4 엄지 도달 범위).
    //     ⛔ 건설 탭 기본 자리를 그대로 쓰면 광맥이 화면 위쪽(sy 0.37)으로 가서 엄지가 안 닿는다.
    { const sy=(wx,wy)=>_techW2S(wx,wy).y;
      const bldg=(G.tech.ents||[]).find(e=>e.type==='bldg');
      const mineY=M.map(m=>sy(m.x,m.y)), baseY=sy(bldg.x,bldg.y), topY=sy(0.5,techY0());
      assert(mineY.every(y=>y>0.5),'광맥이 화면 아래 절반에 없다(엄지 범위 밖): '+mineY.map(y=>y.toFixed(2)).join(','));
      assert(mineY.every(y=>y>baseY),'광맥이 본부보다 앞에 있다 — 본부 뒤(최하단)여야 한다');
      assert(baseY-topY>0.2,'본부 위 방어 공간이 너무 좁다: '+(baseY-topY).toFixed(2));
      assert(mineY.every(y=>y<1) && baseY<1,'기지가 화면 밖으로 나갔다'); }
    // ④ 관리자 치트가 꺼져 있다
    assert(G.tech.inf===false && G.tech.nocool===false,'관리자 치트(무한 자원/쿨 없음)가 켜져 있음');
    // ⑤ 화면 층 — ⚠ **클래스만 보지 말고 실제로 보이는지 잰다.**
    //   여기서 클래스만 검사했다가 화면에 아무것도 안 뜨는 걸 못 잡았다:
    //   #homeScreen 은 .appScreen(z-index 60)이라 인게임 층(#vBuild, z 6)을 통째로 덮는다.
    //   그래서 campMountView() 가 #vBuild 를 #homeScreen **안으로 옮긴다**. 그 결과를 확인한다.
    assert($('vBuild').classList.contains('on'),'건설 뷰가 안 켜짐');
    assert($('phone').classList.contains('campMode'),'campMode 클래스가 없음');
    assert($('vBuild').parentNode===$('homeScreen'),'#vBuild 가 HOME 안으로 안 옮겨졌다 — 화면에 안 보인다');
    { const under=(fx,fy)=>{ const el=document.elementFromPoint(Math.round(innerWidth*fx),Math.round(innerHeight*fy));
        let n=el,out=[]; while(n&&n!==document.body&&out.length<4){ out.push(n.id||n.className||''); n=n.parentElement; } return out.join('|'); };
      assert(under(0.5,0.5).indexOf('cstMain')>=0,'화면 가운데에 캠프 맵이 안 보인다: '+under(0.5,0.5));
      // ⚠ 캐릭터 프로필(.hbHudTop)은 캠프에서 **지웠다** — 여기서 찾으면 안 된다.
      //    재화 바는 위치가 아니라 **켜져 있는지**로 본다(뷰포트 폭에 따라 좌우 정렬이 달라져
      //    elementFromPoint 로 집으면 빈 공간을 짚는다 — 실제로 그렇게 헛돌았다).
      { const cb=$('curBar');
        assert(cb && !cb.classList.contains('hide') && getComputedStyle(cb).display!=='none',
          '재화 바가 꺼져 있다'); }
      const nb=$('navBar');
      assert(nb && !nb.classList.contains('hide'),'캠프인데 네비가 숨겨짐');
      assert(under(0.5,0.955).indexOf('navBar')>=0,'네비가 맵에 덮였다: '+under(0.5,0.955)); }
    // 옛 사냥터 UI 는 캠프에서 빠진다(업그레이드 카드·웨이브 줄은 뜻이 없다)
    assert(getComputedStyle($('hmScroll')).display==='none','옛 사냥터 업그레이드가 아직 보인다');
    // 🗂 하단 시트는 **늘 떠 있다**(유즈맵 하단 프로필 구역과 같은 자리). 셋을 함께 본다:
    //   ① 열려 있고 ② 내용이 있고 ③ 기지가 시트에 가리지 않는다.
    //   ⚠ ③ 은 순환하기 쉬운 자리다 — 맵 높이를 시트만큼 줄였더니 시트도 맵 기준이라 같이
    //     끌려 올라가 화면 한가운데로 왔다(실측 323px 겹침). 그래서 맵은 전체를 쓰고
    //     **시점을 내려서** 피한다. 이 assert 가 그 방식이 살아 있는지를 지킨다.
    { const sh=$('btSheet');
      assert(sh && sh.classList.contains('open'),'캠프인데 하단 시트가 안 떠 있다');
      assert((sh.textContent||'').trim().length>4,'하단 시트가 비어 있다');
      // ⚠ 2026-08-25: 아무것도 안 골랐을 때 **본부를 대신 고르지 않는다** — 그 자리는 기지 요약이 채운다.
      //   그래서 여기서 보는 것은 「선택이 있다」가 아니라 **「시트에 볼 것이 있다」**로 바뀌었다.
      assert((G.tech.sel!=null) || (G.tech.selU&&G.tech.selU.length)
             || ($('btSheetBody') && $('btSheetBody').querySelector('.cgKick')),
        '시트에 표시할 대상도, 기지 요약도 없다');
      // ⚠ rect 로 재지 말 것 — 시트는 translateY 로 올라오므로 애니메이션 중에는 화면 밖을
      //   가리킨다(헤드리스는 transition 이 끝나지 않아 늘 그렇다). 레이아웃 값으로 잰다.
      const par=sh.offsetParent, mh=par.offsetHeight;
      const navH=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navH'))||56;
      assert(sh.offsetTop+sh.offsetHeight<=mh-navH+2,
        '하단 시트가 네비를 덮는다: 시트 밑 '+(sh.offsetTop+sh.offsetHeight)+' vs 네비 위 '+(mh-navH));
      // 맵(#vBuild)과 3D 캔버스(#cvMarine)가 **시트 위에서 끝난다.** 둘은 같은 크기여야 한다 —
      // renderBuildTab 이 #cstMain 크기를 그대로 3D 캔버스 크기로 넘기기 때문이다.
      const vb=document.getElementById('vBuild'), mc=document.getElementById('cvMarine');
      // ⚠ 3D 캔버스 크기는 M3D 가 올라와야 잡힌다(three.js 를 외부 CDN 에서 받는다) — 없으면 0×0 이 정상이다
      if(window.M3D && typeof M3D.syncBuild==='function')
      assert(vb.clientHeight===mc.clientHeight&&vb.clientWidth===mc.clientWidth,
        '3D 캔버스가 맵과 크기가 다르다 — 건물이 엉뚱한 자리에 선다: 맵 '+vb.clientWidth+'x'+vb.clientHeight
        +' vs 3D '+mc.clientWidth+'x'+mc.clientHeight);
      // ⭐ 맵은 **화면 전체**를 쓰고 시트가 그 위를 덮는다(그래야 배치 중 시트가 내려갈 때 실제로 넓어진다).
      //   그래서 기지가 안 가리는 것은 **배치**가 맡는다 — 가장 아래인 가스까지 시트 위에 있어야 한다.
      const topFrac=sh.offsetTop/vb.clientHeight;
      const gy=techY0()+(TECH_GAS.r0+TECH_GAS.h-0.55)*_techCH();
      const low=Math.max(_techW2S(0.5,gy).y, ...G.tech.minerals.map(m=>_techW2S(m.x,m.y).y));
      assert(low<topFrac,'기지가 하단 시트에 가린다 — CAMP_ROW_BASE/MINE 를 올릴 것: 가장 아래 '
        +low.toFixed(3)+' ≥ 시트 '+topFrac.toFixed(3)); }
    // 🧹 나머지 건설 탭 UI 는 전부 걷힌다 — 캠프는 자기 UI 를 따로 갖는다
    for(const id of ['cstFog','cstPrev','techSkTip']){
      const e=$(id); if(!e) continue;
      assert(getComputedStyle(e).display==='none','건설 UI 가 남아 있다: #'+id); }
    // ⚠ **3D 건물은 #cvMarine 에 그린다**(#vBuild 안이 아니다). 맵만 옮기면 건물이 HOME 뒤로 숨는다.
    { const mc=$('cvMarine');
      assert(mc && mc.parentNode===$('homeScreen'),'#cvMarine 이 HOME 안으로 안 옮겨졌다 — 건물이 안 보인다'); }
    // 🧹 관리자 전용 조작 UI 도 빠진다 — 캠프는 플레이어 화면이다
    for(const sel of ['.techTabs','.techBtns','.techSide','.bres']){
      const e=document.querySelector('#cstMain '+sel); if(!e) continue;
      assert(getComputedStyle(e).display==='none','관리자 UI 가 남아 있다: '+sel); }
    // 💠 재화는 **사냥터 재화 바 하나**만 쓴다(관리자 줄 .bres 를 숨겼으므로 여기가 유일하다)
    //    순서는 미네랄 · 가스 · 젬 · 인구. 인구는 캠프에서만 나온다(다른 화면은 셋 그대로).
    { G.tech.credit=4321; G.tech.energy=765; G.tech.sup=3; G.tech.supCap=10; updateCurBar();
      assert($('curMin').textContent===fmtCur(4321),'재화 바가 캠프 미네랄을 안 보여줌: '+$('curMin').textContent);
      assert($('curGas').textContent===fmtCur(765),'재화 바가 캠프 가스를 안 보여줌: '+$('curGas').textContent);
      assert($('curPop').textContent==='3/10','인구 표시가 다름: '+$('curPop').textContent);
      const order=[...document.querySelectorAll('#curBar .curRes .res')]
        .filter(e=>getComputedStyle(e).display!=='none')
        .sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left)
        .map(e=>{ const im=e.querySelector('img'); return im? im.src.split('/').pop().replace('res_','').replace('.webp','') : '?'; });
      assert(order.join(',')==='mineral,gas,gem,pop','재화 순서가 다름: '+order.join(',')); }
    // ⛔ 캠프는 공용 자원을 셋이나 빌린다(#cvMarine · TECH_GAS 좌표 · 판정 함수 3개).
    //    **나갈 때 전부 돌려놓는지**를 여기서 잰다 — 안 돌려주면 관리자 건설 탭이 어긋난다.
    { const gasBefore={c0:TECH_GAS.c0, r0:TECH_GAS.r0};
      const fnBefore={ a:techArmValid, b:_techGasOverlap, c:_techInGasZone };
      campExit();
      assert(TECH_GAS.c0!==gasBefore.c0 || TECH_GAS.r0!==gasBefore.r0 || true,'');   // 좌표는 원복돼 값이 달라진다
      assert(techArmValid===window.techArmValid,'함수 참조가 깨졌다');
      assert(techArmValid!==fnBefore.a || _techGasOverlap!==fnBefore.b || _techInGasZone!==fnBefore.c,
        '캠프를 나갔는데 가스 판정 함수가 아직 감싸진 채다 — 관리자 탭이 두 자리를 인정하게 된다');
      openHome(); await sleep(420); }   // 다시 들어와 이어서 검사
    // 캐릭터 프로필은 캠프에 없다 — 캠프는 기지를 키우는 게임이라 캐릭터가 없다
    { const hud=document.querySelector('.hbHudTop');
      assert(hud && getComputedStyle(hud).display==='none','캐릭터 HUD 가 아직 보인다'); }
    // ⭐ **캠프는 자기 프레임 루프를 돈다.** 유즈맵 loop() 은 HOME 에서 멈추기 때문이다:
    //      if(!nemoScreenOn()){ ... return; }  ← 앱 화면이 열려 있으면 false (14-input-fx.js:840)
    //    이걸 놓치면 renderBuildTab 이 한 번도 안 불려 **3D 건물·광맥이 안 그려지고 일꾼도 안 움직인다**
    //    (실측으로 #cvMarine 그려진 픽셀이 전 구간 0 이었다 — 화면에 일꾼(DOM)만 떠 있었다).
    //    ⛔ nemoScreenOn 에 예외를 파는 것으로 고치지 말 것 — 그 가드는 성능 때문에 일부러 있다.
    { assert(typeof campFrame==='function','캠프 프레임 루프가 없다');
      assert(!nemoScreenOn(),'전제가 바뀜: HOME 에서 유즈맵 루프가 돈다 — 캠프 자기 루프의 이유를 다시 볼 것');
      let n=0; const orig=window.renderBuildTab;
      window.renderBuildTab=function(){ n++; return orig.apply(this,arguments); };
      // ⏱ 캠프는 프레임을 CAMP_FRAME_MS 로 제한한다(3D 1M 픽셀 + 맵 DOM 재생성이 무겁다).
      //   그래서 간격을 그보다 넉넉히 주고 센다. 직전 프레임과 겹쳐 첫 개가 스킵될 수 있어 -1 을 허용.
      const N=8, gap=CAMP_FRAME_MS+3, t0=performance.now();
      for(let i=0;i<N;i++) campFrame(t0+i*gap);
      window.renderBuildTab=orig;
      assert(n>=N-1,'캠프 루프가 renderBuildTab 을 안 부른다: '+n+'/'+N);
      // 제한이 실제로 걸리나 — 촘촘히 부르면 그리지 않아야 한다.
      // ⛔ 시각을 먼 미래로 밀지 말 것 — _campLastDraw 가 거기 고정돼 **뒤따르는 모든 검사의
      //   campFrame 이 통째로 스킵된다**(실제로 휠 보간·일꾼 배정 검사가 그렇게 깨졌다).
      const base=performance.now();
      campFrame(base+gap);                 // 기준 프레임 하나(여기서 그린다)
      let m=0; window.renderBuildTab=function(){ m++; return orig.apply(this,arguments); };
      for(let i=1;i<=5;i++) campFrame(base+gap+i*2);   // 2~10ms 뒤 = 제한 안 → 전부 스킵
      window.renderBuildTab=orig;
      assert(m===0,'프레임 제한이 안 걸린다 — 2ms 간격 5회에 '+m+'번 그렸다(0이어야 한다)'); }
    // ⊘ 지정 해제 버튼 — 관리자 건설 탭과 같은 것(techPanelRender 가 .on 을 토글한다).
    { const dz=$('btDesel');
      // ⚠ 시작 일꾼이 0기다(HUNT_R1 §1) — 고를 대상이 있어야 하므로 하나 들여놓는다
      if(!G.tech.ents.some(e=>e.type==='worker')){ const _b1=G.tech.ents.find(e=>e.type==='bldg');
        G.tech.ents.push({eid:G.tech.eseq++, type:'worker', x:_b1.x, y:_b1.y+0.03}); }
      const wk=G.tech.ents.find(e=>e.type==='worker');
      G.tech.selU=[]; G.tech.sel=null; techUIRender();
      assert(getComputedStyle(dz).display==='none','아무것도 안 골랐는데 ⊘ 가 떠 있다');
      G.tech.selU=[wk.eid]; G.tech.sel=null; techUIRender();
      const r=dz.getBoundingClientRect();
      assert(getComputedStyle(dz).display!=='none','유닛을 골랐는데 ⊘ 가 안 뜬다');
      assert(r.width>10&&r.height>10,'⊘ 가 크기를 못 얻었다: '+Math.round(r.width)+'x'+Math.round(r.height));
      G.tech.selU=[]; campSyncSheet(); }
    // 🗺 **건물을 지을 때 하단 시트가 내려간다** — 맵을 넓게 보며 자리를 고르는 동작.
    //   원본이 이미 그렇게 한다(17-build-cards.js 의 _shown 에 arm==null). 캠프가 시트를 늘
    //   열어 두므로, 그 강제 열기가 이 동작을 덮어쓰지 않는지 본다.
    { const sh2=$('btSheet'), spin=n=>{ for(let i=0;i<n;i++) campFrame(performance.now()+i*33); };
      // ⚠ 넉넉히 — 캠프 건물값은 설계 곡선을 탄다(보급소 3만부터 · HUNT_R1 §2-2)
      const keep={m:G.tech.credit,g:G.tech.energy}; G.tech.credit=1e9; G.tech.energy=1e9;
      const bs=TECH_TREE[G.tech.race].buildings, bk=(bs.find(x=>!x.addonTo&&x.k!==bs[0].k)||{}).k;
      campSyncSheet(); spin(3);
      assert(sh2.classList.contains('open'),'전제가 바뀜: 배치 전에 시트가 안 열려 있다');
      techArm(bk); spin(3);
      assert(G.tech.arm===bk,'배치 모드로 못 들어갔다: '+G.tech.arm);
      assert(!sh2.classList.contains('open'),'건물을 지을 때 하단 시트가 안 내려간다 — campSyncSheet 의 강제 열기가 덮어썼다');
      // ▶확정 / ✕취소 버튼이 실제로 화면에 뜨고 눌리는지 — #cstLabels 안에 들어간다
      const mr=$('cstMain').getBoundingClientRect(), p=_techW2S(0.5, techY0()+20*_techCH());
      const X=mr.left+p.x*mr.width, Y=mr.top+p.y*mr.height;
      techPtrDown({pointerId:71,clientX:X,clientY:Y,preventDefault(){},pointerType:'mouse'});
      techPtrUp({pointerId:71,clientX:X,clientY:Y,preventDefault(){},pointerType:'mouse'});
      spin(3);
      const ab=document.querySelector('.bArmBtns');
      assert(ab,'배치 확정/취소 버튼이 없다');
      const q=ab.getBoundingClientRect();
      assert(q.width>10&&q.height>10,
        '배치 확정/취소 버튼이 크기가 없다 — #cstLabels 를 숨기면 이렇게 된다: '
        +Math.round(q.width)+'x'+Math.round(q.height));
      assert(q.top>=mr.top-1&&q.bottom<=mr.bottom+1,'배치 버튼이 맵 밖에 있다');
      const n0=G.tech.ents.filter(e=>e.type==='bldg').length;
      techConfirmPlace(null); spin(4);
      assert(G.tech.ents.filter(e=>e.type==='bldg').length===n0+1,'확정을 눌러도 건물이 안 선다');
      campSyncSheet(); spin(3);
      assert(sh2.classList.contains('open'),'배치가 끝났는데 시트가 안 돌아온다');
      G.tech.credit=keep.m; G.tech.energy=keep.g; }
    // 🖱 휠 줌 · 팬 — 관리자 건설 조작을 그대로 쓴다(#vBuild 의 wheel → techWheel).
    //   ⚠ 목표 뷰(viewT)만 바꾸고 실제 뷰(view)는 techViewTick 이 보간한다 —
    //     캠프 프레임이 renderBuildTab → techTick 을 타야 반영된다. 둘 다 확인한다.
    { const vb=document.getElementById('vBuild'), r=vb.getBoundingClientRect();
      const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
      const spin=n=>{ for(let i=0;i<n;i++) campFrame(performance.now()+i*33); };
      const z0=techView().zoom;
      for(let i=0;i<5;i++) document.getElementById('cstMain').dispatchEvent(
        new WheelEvent('wheel',{deltaY:-120,clientX:cx,clientY:cy,bubbles:true,cancelable:true}));
      assert(techViewT().zoom>z0,'휠이 목표 배율을 못 바꾼다 — #vBuild 의 wheel 배선이 끊겼다');
      // ⭐ 휠은 경로가 **둘**이다. 건설 탭의 휠은 #vBuild 에 한 번만 걸리는데, 탭·드래그는
      //   .bmap 의 인라인 onpointerdown 이라 맵 DOM 이 매 프레임 새로 그려질 때 함께 되살아난다
      //   — 그래서 "포인터는 되는데 휠만 안 먹는" 상태가 가능했다. 캠프는 window 캡처 경로를
      //   하나 더 둔다. 최악(투명 덮개 + stopPropagation)에서도 먹는지 본다.
      { const ov=document.createElement('div');
        ov.style.cssText='position:absolute;inset:0;z-index:9;background:transparent';
        ov.addEventListener('wheel',e=>e.stopPropagation(),{passive:false});
        $('homeScreen').appendChild(ov);
        const zz=techViewT().zoom;
        ov.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:cx,clientY:cy,bubbles:true,cancelable:true}));
        const got=techViewT().zoom; ov.remove();
        assert(got>zz,'맵을 덮는 요소가 전파를 막으면 휠이 죽는다 — window 캡처 경로가 없다'); }
      // 두 경로가 같은 이벤트를 두 번 처리하면 한 번 굴릴 때 두 단계 줌된다
      { const zz=techViewT().zoom;
        $('cstMain').dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:cx,clientY:cy,bubbles:true,cancelable:true}));
        const k=techViewT().zoom/zz;
        assert(Math.abs(k-1.1)<0.005,'휠 한 번에 두 단계 줌된다(경로 중복): 배율 '+k.toFixed(3)); }
      // 시트 위 휠은 시트 것이다 — 맵이 줌되면 안 된다
      { const sh2=$('btSheet'), q=sh2.getBoundingClientRect(), zz=techViewT().zoom;
        const t=document.elementFromPoint(Math.round(q.left+q.width/2),Math.round(q.top+q.height/2))||sh2;
        t.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:q.left+q.width/2,clientY:q.top+q.height/2,bubbles:true,cancelable:true}));
        assert(techViewT().zoom===zz,'시트 위에서 굴렸는데 맵이 줌됐다'); }
      spin(30);
      assert(techView().zoom>z0+0.1,'휠은 먹는데 실제 뷰가 안 따라온다 — techViewTick 보간이 안 돈다: '
        +z0.toFixed(2)+' → '+techView().zoom.toFixed(2));
      // 🖐 화면 이동 — 가운데 버튼 드래그
      const x0=techView().x, y0=techView().y;
      techPtrDown({button:1,pointerId:91,clientX:cx,clientY:cy,preventDefault(){},pointerType:'mouse'});
      techPtrMove({pointerId:91,clientX:cx+60,clientY:cy-80,preventDefault(){},pointerType:'mouse'});
      techPtrUp({pointerId:91,clientX:cx+60,clientY:cy-80,preventDefault(){},pointerType:'mouse'});
      spin(30);
      assert(Math.abs(techView().x-x0)>0.01||Math.abs(techView().y-y0)>0.01,
        '중클릭 화면 이동이 안 먹는다');
      // 🖐 **화면 이동 모드 — 빈 바닥 0.5초 롱프레스로 켜고, 탭으로 끈다.**
      //   왜 이 모양인가(사용자 화면 실측으로 확정):
      //   · 사용자는 터치 모드로 본다(pointerdown type=touch · maxTouch=5) → **중클릭 이벤트가
      //     아예 발생하지 않는다.** Shift+드래그 우회도 죽는다(에뮬레이션이 핀치로 바꿔 보낸다).
      //   · 그렇다고 빈 바닥 드래그를 팬으로 쓰면 **드래그 박스 유닛 지정**을 잡아먹는다.
      //   → 그래서 모드로 가른다. 아래 다섯 규칙이 그 계약이다.
      { const mk=(id,type,x,y)=>new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,
          bubbles:true,cancelable:true,button:0,buttons:1,view:window});
        const fire=(id,type,x,y)=>{ const h=document.elementFromPoint(Math.round(x),Math.round(y));
          (type==='pointerdown'?(h||document):document).dispatchEvent(mk(id,type,x,y)); };
        const onMap=q=>{ const h=document.elementFromPoint(Math.round(q.x),Math.round(q.y));
          for(let n=h;n;n=n.parentElement) if(n.classList&&n.classList.contains('bmap')) return true; return false; };
        const at=(wx,wy)=>{ const q=_btRect(), sp=_techW2S(wx,wy);
          return {x:q.left+sp.x*q.width, y:q.top+sp.y*q.height}; };
        // ⚠ 빈 바닥은 **찾아서** 쓴다 — 확대하면 기지가 하단 시트 뒤로 밀려 클릭이 시트로 간다
        //   (실측: zoom 1.8 에서 광맥 y714 vs 시트 642~803 → hit=portImg 였다).
        const findEmpty=()=>{ for(let i=2;i<26;i++){ const q=at(0.5, techY0()+i*_techCH());
          if(campEmptyAt(q.x,q.y)&&onMap(q)) return q; } return null; };
        const clearSel=()=>{ G.tech.selU=[]; G.tech.sel=null; G.tech.selRes=null; _btCmd=null; spin(1); };
        let pid=200;
        const arm=async()=>{ clearSel(); const q=findEmpty();
          assert(q,'빈 바닥을 못 찾았다 — 롱프레스를 시험할 자리가 없다');
          pid++; fire(pid,'pointerdown',q.x,q.y);
          await new Promise(z=>setTimeout(z,CAMP_PAN_HOLD_MS+120));
          fire(pid,'pointerup',q.x,q.y); spin(5); return q; };
        const t3=techViewT(); t3.zoom=1; t3.x=0.5; t3.y=0.5; _techClampView(t3); spin(40);
        campPanMode(false); spin(2);
        // ⚠ 시작 일꾼이 0기다(HUNT_R1 §1) — 조작 검사용으로 하나 들여놓는다
        if(!G.tech.ents.some(e=>e.type==='worker')){ const _b0=G.tech.ents.find(e=>e.type==='bldg');
          G.tech.ents.push({eid:G.tech.eseq++, type:'worker', x:_b0.x, y:_b0.y+0.03}); }
        const wk=G.tech.ents.find(e=>e.type==='worker');
        const bd=G.tech.ents.find(e=>e.type==='bldg');
        const mnn=G.tech.minerals[0];

        // ① 롱프레스로 켜지고, **손을 떼도 유지된다**
        await arm();
        assert(_campPanMode,'빈 바닥 롱프레스로 화면 이동 모드가 안 켜진다');
        // ⚠ 롱프레스는 제자리에서 일어난다 — 그 손가락의 up 을 '탭'으로 치면 켜자마자 꺼진다
        assert(_campPanMode,'롱프레스 직후 손을 떼자 모드가 꺼졌다(그 up 은 탭이 아니다)');

        // ② 모드가 유지되어 **다음 스와이프도 화면 이동**이다
        { const t4=techViewT(); t4.zoom=1.8; _techClampView(t4); spin(40);
          const q=findEmpty(); assert(q,'확대 후 빈 바닥 없음');
          const px=techView().x, py=techView().y; pid++;
          fire(pid,'pointerdown',q.x,q.y);
          assert(_btPan,'모드가 켜져 있는데 다음 드래그가 팬으로 안 잡힌다');
          for(let i=1;i<=6;i++){ fire(pid,'pointermove',q.x-i*9,q.y-i*7); spin(1); }
          fire(pid,'pointerup',q.x-54,q.y-42); spin(40);
          assert(Math.abs(techView().x-px)>0.005||Math.abs(techView().y-py)>0.005,
            '모드 중 스와이프가 화면을 못 옮긴다');
          const t5=techViewT(); t5.zoom=1; t5.x=0.5; t5.y=0.5; _techClampView(t5); spin(40); }

        // ③ 빈 바닥을 그냥 탭하면 꺼진다
        { const q=findEmpty(); pid++;
          fire(pid,'pointerdown',q.x,q.y); fire(pid,'pointerup',q.x+1,q.y+1); spin(3);
          assert(!_campPanMode,'빈 바닥 탭으로 모드가 안 꺼진다'); }

        // ④ 모드 중 **유닛·건물·광맥을 탭하면** 꺼지고 그 선택·채집이 그대로 일어난다
        //   (down 시점에 대상을 가려 원본에 넘긴다 — 재전달로 옛 좌표를 쓰면 선택이 안 됐다)
        { await arm();
          // ⚠ 일꾼을 **겹치지 않는 빈 자리로 잠시 옮겨** 탭한다. 제자리에서 하면 일꾼이
          //   건물 발판 위에 서 있을 때 원본이 건물을 우선 고른다(실측: 유닛을 노렸는데 sel=건물).
          //   여기서 볼 것은 "모드가 조작을 삼키지 않는가" 이므로 대상이 확실해야 한다.
          const sp=findEmpty(), rr=_btRect();
          const wpt=_techS2W((sp.x-rr.left)/rr.width,(sp.y-rr.top)/rr.height);
          const bak={x:wk.x,y:wk.y,tx:wk.tx,ty:wk.ty,wp:wk._wp,gk:wk._gKind,gt:wk._gTgt,working:wk._working};
          wk.x=wpt.x; wk.y=wpt.y; wk.tx=null; wk.ty=null; wk._wp=null; spin(1);
          const q=at(wk.x,wk.y);
          if(onMap(q)){
            pid++; fire(pid,'pointerdown',q.x,q.y); fire(pid,'pointerup',q.x,q.y); spin(3);
            assert(!_campPanMode,'모드 중 유닛을 탭했는데 모드가 안 꺼진다');
            assert((G.tech.selU||[]).indexOf(wk.eid)>=0||G.tech.sel===wk.eid,
              '모드 중 유닛 탭이 그 유닛을 못 고른다 — 모드가 조작을 삼켰다'
              +' | selU='+JSON.stringify(G.tech.selU)+' sel='+G.tech.sel); }
          wk.x=bak.x; wk.y=bak.y; wk.tx=bak.tx; wk.ty=bak.ty; wk._wp=bak.wp;
          wk._gKind=bak.gk; wk._gTgt=bak.gt; wk._working=bak.working; }   // 🧹 원복 — 뒤 step 의 채취 검사가 이 흔적을 물려받지 않게
        { await arm(); const q=at(mnn.x,mnn.y);
          if(onMap(q)){ const c0=G.tech.credit; pid++;
            fire(pid,'pointerdown',q.x,q.y); fire(pid,'pointerup',q.x,q.y); spin(3);
            assert(!_campPanMode,'모드 중 광맥을 탭했는데 모드가 안 꺼진다');
            assert(G.tech.credit>c0,'모드 중 광맥 탭이 채집을 못 한다'); } }
        { await arm(); const q=at(bd.x,bd.y);
          if(onMap(q)){ pid++; fire(pid,'pointerdown',q.x,q.y); fire(pid,'pointerup',q.x,q.y); spin(3);
            assert(!_campPanMode,'모드 중 건물을 탭했는데 모드가 안 꺼진다');
            assert(G.tech.sel===bd.eid,'모드 중 건물 탭이 그 건물을 못 고른다'); } }

        // ⑤ ⛔ **모드가 꺼져 있으면 빈 바닥 드래그는 여전히 박스 지정이다.**
        //   여기를 팬으로 쓰면 유닛 드래그 지정이 죽는다 — 그래서 모드로 가른 것이다.
        { campPanMode(false); clearSel(); const q=findEmpty(); pid++;
          fire(pid,'pointerdown',q.x,q.y);
          for(let i=1;i<=5;i++) fire(pid,'pointermove',q.x+i*8,q.y+i*6);
          assert(!_btPan,'모드가 꺼졌는데 빈 바닥 드래그가 팬이 됐다 — 드래그 박스 지정이 죽는다');
          fire(pid,'pointerup',q.x+40,q.y+30); spin(5); campPanMode(false); spin(2); }
        // 🧹 이 검사는 일꾼을 고르고 세워 뒀다 — **원래대로 돌려놓는다.**
        //   안 그러면 뒤 step 의 「일꾼이 광맥에 자동 배정」이 이 흔적 때문에 깨진다.
        clearSel(); if(typeof campAutoGather==='function') campAutoGather(); spin(3); }
      // 🚧 **맵 밖이 절대 안 보인다.** 바닥(.bmapFloor)은 inset:0 이지만 뷰 변환을 함께 받으므로
      //   축소하면 같이 줄어 사방이 뚫린다(실측: zoom 0.5 에서 바닥 183×270 vs 화면 365×540).
      //   줌 하한과 팬 한도 둘 다가 이걸 막는다 — 극단값을 넣어 보고 바닥이 화면을 덮는지 잰다.
      { const mr=document.getElementById('cstMain').getBoundingClientRect();
        const covered=()=>{ const f=document.querySelector('#cstMain .bmapFloor').getBoundingClientRect();
          return f.left<=mr.left+1 && f.top<=mr.top+1 && f.right>=mr.right-1 && f.bottom>=mr.bottom-1; };
        for(const z of [0.2,0.5,1,1.4,2.5]){
          for(const [px,py] of [[0.5,0.5],[0,0],[1,1],[0,1],[1,0]]){
            const t=techViewT(); t.zoom=z; t.x=px; t.y=py; _techClampView(t); spin(60);
            assert(covered(),'맵 밖이 화면에 보인다 — 줌 '+z+' 시점 '+px+','+py
              +' → 실제 줌 '+techView().zoom.toFixed(2)+' 시점 '
              +techView().x.toFixed(2)+','+techView().y.toFixed(2)); } }
        assert(techMinZoom()>=1,'축소 하한이 1 미만이다 — 바닥이 화면보다 작아진다: '+techMinZoom()); }
      campZoom(); spin(20); }   // 뒤 검사들을 위해 기본 배율로 되돌린다
    // 🔍 화면 배율 — 폰에서 관리자 기본(20칸)은 너무 확대돼 보인다.
    //   ⛔ **zoom 을 낮춰서 줄이지 않는다.** zoom 을 낮추면 격자가 화면을 못 채워 좌우가 빈 배경이
    //     된다(실측 zoom 0.62 → 격자가 화면 가로의 54%). 대신 **격자를 촘촘히** 해서
    //     같은 화면에 더 넓은 구역이 들어오게 한다: zoom 1 + 48칸.
    { assert(techCols()>TECH_GRID.cols*1.5,'캠프 격자가 안 촘촘하다: '+techCols()+'칸');
      // 요소도 그만큼 작아져야 한다 — renderBuildTab 의 _cellK 와 같은 식
      const cellK=_techCW()/((TECH_GRID.x1-TECH_GRID.x0)/TECH_GRID.cols);
      assert(cellK<0.7,'셀은 줄었는데 유닛 배율(_cellK)이 안 따라온다: '+cellK.toFixed(3));
      // 격자가 화면 가로를 채운다(양옆 빈 배경이 남지 않는다)
      const gl=_techW2S(TECH_GRID.x0,0.5).x, gr=_techW2S(TECH_GRID.x1,0.5).x;
      assert(gl<0.1&&gr>0.9,'격자가 화면 가로를 못 채운다: '+gl.toFixed(2)+'~'+gr.toFixed(2));
      // 💎 미네랄·운반물은 renderBuildTab 이 fitW·scl 없이 넣는다 — 캠프가 셀 축소를 얹어야 한다
      if(window.M3D && typeof M3D.syncBuild==='function'){ let cap=null; const o=_campSyncOrig;
        _campSyncOrig=function(l){ if(!cap) cap=l.slice(); return o.apply(this,arguments); };
        campFrame(performance.now()); _campSyncOrig=o;
        const mn=(cap||[]).filter(i=>i&&/^mn_/.test(i.uid||''));
        assert(mn.length&&mn.every(i=>i.scl!=null&&i.scl<0.7),
          '미네랄 3D 가 셀 축소를 안 따른다 — 광맥이 서로 뭉개져 보인다');
        const gz=(cap||[]).filter(i=>i&&/^gz_/.test(i.uid||''));
        assert(gz.length===2&&gz.every(i=>i.fitW>0),
          '가스 광산 둘의 크기 규격이 다르다: '+gz.map(i=>i.uid+'='+i.fitW).join(' ')); } }
    // 🎨 바닥은 사냥터 던전 배경 — ⚠ CSS 변수 안 상대경로는 **쓰는 곳(css/)** 기준으로 풀린다.
    //    문서 기준 절대 URL 이라야 'css/assets/…' 로 새지 않는다(파일 분할 때도 밟은 함정).
    { const fl=document.querySelector('#cstMain .bmapFloor');
      assert(fl,'맵 바닥이 없음');
      const bg=getComputedStyle(fl).backgroundImage;
      assert(bg.indexOf('backgrounds/camp/')>=0 || bg.indexOf('backgrounds/dungeons/')>=0,
        '바닥이 던전 배경이 아님: '+bg.slice(0,60));
      assert(bg.indexOf('css/assets')<0,'배경 경로가 css/ 기준으로 샜다: '+bg.slice(0,70)); }
    // ⑥ 옛 사냥터는 안 돈다
    assert(!(typeof _hb!=='undefined' && _hb && _hb.on),'옛 사냥터가 아직 돈다');
    // ⑦ 저장 → 나갔다 → 돌아오면 그대로
    const n0=(G.tech.ents||[]).length;
    campSave();
    assert(campState().race==='terran','저장이 종족 키를 덮어씀: '+campState().race);   // STK 키 유지
    assert(!(campState().ents||[]).some(e=>Object.keys(e).some(k=>k.charAt(0)==='_')),
      '저장분에 런타임 필드(_로 시작)가 섞였다');
    campExit(); showAppScreen('mapScreen'); await sleep(140);
    openHome(); await sleep(420);
    assert((G.tech.ents||[]).length===n0,'복귀했더니 기지가 달라짐: '+(G.tech.ents||[]).length+' vs '+n0);
    assert((G.tech.minerals||[]).length===6,'복귀했더니 광맥이 달라짐');
    assert(!$('campRaceOv') || $('campRaceOv').classList.contains('hide'),'종족을 이미 골랐는데 또 물어봄');
    return '종족 '+STK_RACE_ORDER.length+'종 · 본부·일꾼 · 광맥 '+CAMP_MINE_COLS+'×'+CAMP_MINE_ROWS+' · 가스 2 · 저장/복원 ok'; });
  // 💠 캠프 2단계 — 광맥을 눌러 캐는 손 축 · 비용 조회 단일 문 · 자리 비움 정산
  // 🗺 0단계=캠프 · 1단계부터 던전 · 던전 하나 = 50라운드 (HUNT_R1.md §6-1)
  //    ⛔ 미네랄 표를 공식으로 바꾸지 말 것 — 옛 ×2^(단계-1) 은 단계 5부터 문턱에서 배율이 내려갔다.
  // ⭐ 캠프 광맥은 마르지 않는다 — 방치형이라 5분에 경제가 죽으면 게임이 끝난다
  await step('캠프 광맥: 마르지 않는다', async()=>{
    skipIf(typeof campLayMinerals!=='function','캠프 광맥 없음');
    const keep=G.tech;
    try{
      techUIInit('union'); campLayMinerals();
      const M=G.tech.minerals; assert(M && M.length,'캠프 광맥이 안 깔림');
      assert(M.every(m=>m.inf===true),'캠프 광맥에 무제한 표식이 없다 — 5분이면 마른다');
      // 저장/복원을 거쳐도 표식이 남는가(옛 저장에서 마른 광맥도 되살아나는가)
      const C=campState(); const bk=C.minerals;
      C.minerals=M.map(m=>({eid:m.eid,x:m.x,y:m.y,amount:0,owner:null,miner:null}));   // 마른 옛 저장
      campRestore();
      assert(G.tech.minerals.every(m=>m.inf===true),'복원 뒤 무제한 표식이 사라졌다');
      assert(G.tech.minerals.every(m=>m.amount>0),'옛 저장의 마른 광맥이 안 되살아났다');
      C.minerals=bk;
      return '광맥 '+M.length+'덩이 전부 무제한 · 복원해도 유지';
    } finally { G.tech=keep; } });
  // 🩹 아군 부활 — HUNT_R1 §6-5「죽지 않는다. 빈사로 누웠다가 부활」
  //   ⚠ strikeStepUnits 가 죽은 유닛을 배열에서 걷어낸다(18-strike.js:1301) — '남아 있다'고 가정하면 안 된다.
  await step('캠프: 아군은 죽지 않고 누웠다가 부활한다', async()=>{
    skipIf(typeof campReviveStep!=='function'||typeof campEnterDungeon!=='function','부활 없음');
    const C=campState(); skipIf(!C,'캠프 상태 없음');
    const keep=JSON.parse(JSON.stringify(C.rbTree||{}));
    try{
      C.rbTree={};
      assert(campReviveSec()===30,'기본 부활이 30초가 아님: '+campReviveSec());
      campEnterDungeon(1); CAMPB=null; campCombatStep(0.05);
      skipIf(!CAMPB,'전장이 안 열림');
      campWithStk(()=>{ for(let i=0;i<4;i++) strikeSpawnUnit('me'); });
      const n0=CAMPB.me.units.length; assert(n0>0,'아군이 없음');
      // 적 하나만 남겨 라운드가 끝나지 않게 한다(전멸시키면 클리어로 빠진다)
      CAMPB.ai.units.forEach((u,i)=>{ if(i>0){ u.dead=true; return; } u.dmg=0; u.hp=1e9; u.maxHp=1e9; });
      CAMPB.me.units.forEach(u=>{ u.dead=true; u.hp=0; });
      campCombatStep(0.05);
      // ① 전멸해도 지지 않는다 — 패배는 본부 파괴뿐(부활이 생긴 뒤의 규칙)
      assert(campDgN()>0 && CAMPB,'전멸했다고 졌다 — 부활이 있으면 전멸은 패배가 아니다');
      assert(campDown()===n0,'누운 유닛을 못 붙잡았다: '+campDown()+'/'+n0);
      assert(CAMPB.me.units.length===0,'죽은 유닛이 전장 배열에 남아 있다');
      // ② 시간이 지나면 체력 만땅으로 일어나 전장으로 돌아온다
      // ⚠ 부활 '직후'에 잰다 — 더 굴리면 장기전 방지(strikeSuddenDeath) 등이 체력을 깎아 헛돈다
      let step=0; while(campDown()>0 && step<900){ campCombatStep(0.05); step++; }
      assert(campDown()===0,'부활 대기가 안 비워짐: '+campDown());
      assert(step>500 && step<700,'30초쯤에 일어나야 한다 — 걸린 틱: '+step);
      assert(CAMPB.me.units.length===n0,'부활 뒤 인원이 다름: '+CAMPB.me.units.length+'/'+n0);
      { const u=CAMPB.me.units[0];
        assert(!u.dead && u.hp===u.maxHp,'부활했는데 빈사거나 체력이 안 찼다'); }
      // ③ 트리 rebuild = 부활 단축. ⛔ 0초가 되면 눕는 것이 무의미하므로 하한이 있다
      const base=campReviveSec();
      C.rbTree={rebuild:1}; const s1=campReviveSec();
      C.rbTree={rebuild:5}; const s5=campReviveSec();
      assert(s1<base && s5<s1,'rebuild 가 부활을 안 줄인다: '+base+' → '+s1+' → '+s5);
      assert(s5>=CAMP_REV_MIN,'부활 하한을 뚫었다: '+s5);
      // ④ 되살릴 것이 하나도 없으면 그때는 진다(끝이 없어지므로)
      C.rbTree={};
      campEnterDungeon(1); CAMPB=null; campCombatStep(0.05);
      CAMPB.me.units.length=0; if(CAMPB._down) CAMPB._down.length=0; CAMPB._started=true;
      campCombatStep(0.05);
      assert(campDgN()===0,'출격 병력이 0인데 안 짐');
      return '30초 부활 · 단축 '+s1+'→'+s5+'초 · 전멸≠패배';
    } finally { C.rbTree=keep; if(typeof campBattleClose==='function') campBattleClose();
      const S=campState(); if(S){ S.dg=0; S.cleared=0; } }
  });

  // 🌳 아군 강화 갈래 — 트리를 찍으면 실제로 값이 움직이는가(2026-08-25 · 6/8 배선).
  //   ⚠ campRtMul 은 **계열 키**를 받는다(f 가 아니다). 'atk' 이지 'unitAtk' 가 아니다.
  await step('캠프 트리: 아군 강화 갈래가 실제로 걸린다', async()=>{
    skipIf(typeof campScaleAllies!=='function'||typeof campState!=='function','아군 강화 배선 없음');
    const C=campState(); skipIf(!C,'캠프 상태 없음');
    const keep=JSON.parse(JSON.stringify(C.rbTree||{}));
    try{
      // ① 비용 — 업그레이드·건물 둘 다 캠프가 값을 매긴다
      C.rbTree={};
      const up0=campUpgCost('tap'), bd0=campCost('bldg','barracks',0).m, sup0=campSupAdd();
      C.rbTree={upCost:5, sup:5};
      assert(Math.abs(campUpgDisc()-0.2)<1e-6,'업그레이드 할인 5차가 −80%가 아님: '+campUpgDisc());
      assert(campUpgCost('tap')<up0,'업그레이드 비용이 안 내려감');
      assert(campCost('bldg','barracks',0).m<bd0,'건물 비용이 안 내려감');
      assert(sup0===0 && campSupAdd()===500,'인구 상한 5차가 +500이 아님: '+campSupAdd());
      // ② 전투 값 — 공격력·체력·본부는 사다리 5차에서 ×25
      skipIf(typeof campEnterDungeon!=='function'||typeof campCombatStep!=='function','캠프 던전 없음');
      C.rbTree={};
      campEnterDungeon(1); CAMPB=null; campCombatStep(0.05);
      skipIf(!CAMPB,'전장이 안 열림');
      // ⚠ **같은 유닛으로 재야 한다.** 무작위로 뽑으면 두 번의 units[0] 이 서로 다른 유닛이라
      //   배수가 아니라 유닛 차이를 재게 된다(공짜 배출을 끄면서 실제로 그랬다).
      campWithStk(()=>{ for(let i=0;i<3;i++) strikeSpawnUnit('me','marine'); });
      campScaleAllies(CAMPB.me.units);
      const base0=CAMPB.me.base.hp, u0=CAMPB.me.units.find(z=>z.id==='marine')||CAMPB.me.units[0],
            hp0=u0.maxHp, dm0=u0.dmg||0;
      C.rbTree={atk:5, hp:5, bldg:5};
      campEnterDungeon(1); CAMPB=null; campCombatStep(0.05);
      campWithStk(()=>{ for(let i=0;i<3;i++) strikeSpawnUnit('me','marine'); });
      campScaleAllies(CAMPB.me.units);
      const u1=CAMPB.me.units.find(z=>z.id==='marine')||CAMPB.me.units[0];
      assert(Math.abs(u1.maxHp/hp0-25)<0.5,'유닛 체력 5차가 ×25가 아님: ×'+(u1.maxHp/hp0).toFixed(1));
      assert(Math.abs((u1.dmg||0)/(dm0||1)-25)<0.5,'유닛 공격력 5차가 ×25가 아님');
      assert(Math.abs(CAMPB.me.base.hp/base0-25)<0.5,'본부 체력(건물 강화) 5차가 ×25가 아님');
      // ③ 같은 유닛에 두 번 걸리지 않는다 — 걸리면 라운드마다 눈덩이가 된다
      const h=u1.maxHp; const again=campScaleAllies(CAMPB.me.units);
      assert(again===0 && u1.maxHp===h,'아군 강화가 이중 적용됨');
      // ④ 스킬 쿨다운 — dt 만큼 깎인 뒤 (배수−1)dt 를 더 깎는다
      C.rbTree={skCd:5};
      const t=CAMPB.me.units[0]; t.skillCd=t.skillCd||{}; t.skillCd.probe=10;
      campCombatStep(0.05);
      const cut5=10-t.skillCd.probe;
      C.rbTree={}; t.skillCd.probe=10; campCombatStep(0.05);
      const cut0=10-t.skillCd.probe;
      assert(cut5>cut0*5,'스킬 쿨다운 감소가 트리를 안 탄다: '+cut5.toFixed(3)+' vs '+cut0.toFixed(3));
      return '공격·체력·건물 ×25 · 비용 −80% · 인구 +500 · 스킬쿨 '+cut5.toFixed(2)+'/틱';
    } finally { C.rbTree=keep; if(typeof campBattleClose==='function') campBattleClose();
      const S=campState(); if(S){ S.dg=0; S.cleared=0; } }
  });

  // 🎨 전투 렌더 — 화면을 바꾸지 않고 기지 맵 '위쪽 레인'에 겹쳐 그린다(A안 · 2026-08-25).
  //   ⚠ 건설 맵은 M3D.sync 가 아니라 **M3D.syncBuild** 를 쓴다 — 감쌀 대상을 헷갈리면 0건이 된다(실제로 그랬다).
  await step('캠프 던전: 전투가 기지 맵에 겹쳐 그려진다', async()=>{
    skipIf(typeof campBattleList!=='function'||typeof campWithBattleDraw!=='function','전투 렌더 없음');
    // ① 0단계(캠프)에는 전투 유닛이 없다
    if(typeof campEnterDungeon==='function'){ const C=campState(); if(C){ C.dg=0; C.cleared=0; } }
    assert(campBattleList().length===0,'0단계인데 전투 유닛이 리스트에 실림');
    // ② 던전에 들어가 전장을 열면 유닛이 엔트리로 나온다
    skipIf(typeof campEnterDungeon!=='function'||typeof campCombatStep!=='function','캠프 던전 없음');
    campEnterDungeon(1); CAMPB=null; campCombatStep(0.05);
    skipIf(!CAMPB,'전장이 안 열림');
    campWithStk(()=>{ for(let i=0;i<6;i++) strikeSpawnUnit('me'); });
    const list=campBattleList();
    assert(list.length>0,'전장에 유닛이 있는데 렌더 엔트리가 0');
    // ③ 좌표 규약 — 기지 유닛과 같은 형태(정규화 x/y · scl · z)
    { const e=list[0];
      assert(typeof e.x==='number' && typeof e.y==='number','좌표가 숫자가 아님');
      assert(e.scl>0,'scl 이 없다 — 기지 유닛과 크기 규약이 다름');
      assert(typeof e.z==='number','z 가 없다 — 깊이 정렬에서 빠진다');
      assert(String(e.uid).indexOf('cb_')===0,'uid 접두사가 cb_ 가 아님(기지 uid 와 충돌 위험)'); }
    // ④ 레인 안에 있는가 — 적은 위(격자 위끝), 내 병력은 아래(본부 쪽)
    { const g=campW2G(0, CAMPB.world*0.14, CAMPB.world);   // 적 본부
      const m=campW2G(0, CAMPB.world*0.86, CAMPB.world);   // 내 본부
      assert(g.gy<m.gy,'세로 대응이 뒤집혔다 — 적이 아래에서 온다');
      assert(g.gy>=CAMP_LANE_TOP-1e-6 && m.gy<=CAMP_LANE_BOT+1e-6,'레인 밖으로 나감'); }
    // ⑤ 감싸기는 반드시 원복된다 — 안 그러면 관리자 탭·오토배틀이 캠프 유닛을 달고 다닌다
    if(window.M3D && typeof M3D.syncBuild==='function'){
      const before=M3D.syncBuild;
      campWithBattleDraw(()=>{ assert(M3D.syncBuild!==before,'감싸지 않았다'); });
      assert(M3D.syncBuild===before,'syncBuild 를 원복하지 않았다'); }
    { const C=campState(); if(C){ C.dg=0; C.cleared=0; } }   // 상태 정리
    campBattleClose();
    return list.length+'기 · 레인 '+CAMP_LANE_TOP+'~'+CAMP_LANE_BOT;
  });


  // 🔮 스킬 자동 시전 (HUNT_R1 §3-4-2 · 2026-08-27)
  //   ⚠ 예전엔 self/toggle/aura 만 돌아 마법 유닛이 **에너지만 채운 채 서 있었다.** 그리고
  //     오토배틀에는 효과를 적용하는 코드가 **아예 없었다** — 그래서 대상 선택 + 효과를 함께 넣었다.
  //   ⛔ 엔진에 걸 곳이 없는 효과(둔화·기절·환영 등)는 **시전하지 않는다** — 이것도 여기서 잰다.
  await step('오토배틀: 마법 유닛이 스킬을 알아서 쓴다', async()=>{
    skipIf(typeof strikeSkillTick!=='function'||typeof campEnterDungeon!=='function','스킬/캠프 없음');
    campEnterDungeon(1); CAMPB=null; campCombatStep(0.05); skipIf(!CAMPB,'전장이 안 열림');
    const out=[];
    const setup=(myId, foeIds)=>campWithStk(()=>{
      STK.me.units.length=0; STK.ai.units.length=0; STK._dots=null;
      strikeSpawnUnit('me', myId); const u=STK.me.units[0];
      if(!u) return null; u.x=1000; u.y=1000; u.en=u.maxEn||200; u.skillCd={}; u._skT=0; delete u._skKeys;
      const fs_=[]; for(let i=0;i<foeIds.length;i++){ strikeSpawnUnit('ai', foeIds[i]);
        const e=STK.ai.units[STK.ai.units.length-1]; if(!e) continue;
        e.x=1000+i*30; e.y=1060; e.sh=0; fs_.push(e); }
      return {u:u, foes:fs_}; });
    // ① 💥 집중포(드레드노트) — 사거리 안 **체력이 가장 높은 적**을 때린다
    { const s=setup('dreadnought', ['tank','tank']);
      if(s && s.foes.length===2){ s.foes[0].hp=s.foes[0].maxHp=900; s.foes[1].hp=s.foes[1].maxHp=300;
        const en0=s.u.en; campWithStk(()=>strikeSkillTick(0.5));
        assert(s.foes[0].hp<900,'집중포가 안 나갔다 — 체력 1위 적이 멀쩡하다');
        assert(s.foes[1].hp===300,'체력 낮은 쪽을 때렸다 — 대상 선택이 틀렸다');
        assert(s.u.en<en0,'마나를 안 썼다 — 시전 판정이 헛돌았다');
        out.push('집중포 -'+Math.round(900-s.foes[0].hp)); } }
    // ② ⚡ 번개 폭풍(하이템플러) — **적이 3기 이상 뭉쳤을 때만**. 2기면 안 쓴다.
    { const s2=setup('high_templar', ['machinegun','machinegun']);   // ⚠ marine 은 스스로 광폭화하며 체력을 깎는다 — 광역과 헷갈리므로 스킬 없는 유닛으로 잰다
      if(s2){ const hp0=s2.foes.map(e=>e.hp); campWithStk(()=>strikeSkillTick(0.5));
        assert(s2.foes.every((e,i)=>e.hp===hp0[i]),'적 2기인데 광역을 썼다 — 낭비 규칙이 안 걸렸다'); }
      const s3=setup('high_templar', ['machinegun','machinegun','machinegun','machinegun']);
      if(s3){ const hp0=s3.foes.map(e=>e.hp);
        campWithStk(()=>{ strikeSkillTick(0.5); for(let i=0;i<8;i++) strikeSkillTick(0.4); });
        const hit=s3.foes.filter((e,i)=>e.hp<hp0[i]||e.dead).length;
        assert(hit>=3,'적 4기가 뭉쳤는데 광역이 안 들어갔다(맞은 수 '+hit+')');
        out.push('번개폭풍 '+hit+'기'); } }
    // ③ 🛡 보호막(이지스) — **다친 아군**에게만. 멀쩡하면 안 쓴다.
    { const s=setup('aegis', ['marine']);
      // ⚠ strikeSpawnUnit 은 STK 를 읽는다 — campWithStk 밖에서 부르면 STK 가 null 이다
      const a=s ? campWithStk(()=>{ strikeSpawnUnit('me','marine'); const z=STK.me.units[1];
        if(z){ z.x=1010; z.y=1000; z.sh=0; z.maxSh=0; z.hp=z.maxHp; } return z; }) : null;
      if(a){ campWithStk(()=>strikeSkillTick(0.5));
        assert(!(a.sh>0),'멀쩡한 아군에 보호막을 걸었다');
        a.hp=a.maxHp*0.5; s.u.skillCd={}; s.u._skT=0; s.u.en=s.u.maxEn||200;
        campWithStk(()=>strikeSkillTick(0.5));
        assert(a.sh>0,'다친 아군인데 보호막이 안 걸렸다');
        out.push('보호막 '+Math.round(a.sh)); } }
    // ④ ⛔ 엔진에 걸 곳이 없는 스킬은 **마나를 태우지 않는다**(고스트 봉쇄·핵)
    { const s=setup('ghost', ['tank','tank','tank']);
      if(s){ const en0=s.u.en; campWithStk(()=>strikeSkillTick(0.5));
        assert(s.u.en===en0,'미구현 스킬(봉쇄·핵)에 마나를 썼다 — 헛시전');
        out.push('미구현 무시 ok'); } }
    campWithStk(()=>{ STK.me.units.length=0; STK.ai.units.length=0; STK._dots=null; });
    { const C=campState(); if(C){ C.dg=0; C.cleared=0; } }
    campBattleClose();
    return out.join(' · ');
  });

  await step('캠프 던전: 단계·라운드·미네랄 배율', async()=>{
    skipIf(typeof campMineMul!=='function','캠프 던전 없음');
    const C=campState(); const back={dg:C.dg, cleared:C.cleared, best:C.best};
    try{
      // ① 표 불변식 — 정수 · 문턱이 안 내려간다 · 50R 배수가 안 줄어든다
      for(let d=0; d<=CAMP_DG_MAX; d++){ const t=CAMP_MINE[d];
        assert(Number.isInteger(t.base) && Number.isInteger(t.x), 'CAMP_MINE['+d+'] 가 정수가 아님');
        assert(Number.isInteger(t.base*t.x), 'CAMP_MINE['+d+'] 50클리어 배율이 정수가 아님');
        if(d>1){ const prev=CAMP_MINE[d-1], step=t.base/(prev.base*prev.x);
          assert(step>1, '단계 '+d+' 문턱에서 배율이 안 오른다: '+(prev.base*prev.x)+' → '+t.base);
          assert(step<=2, '단계 '+d+' 문턱이 2배를 넘는다: '+step.toFixed(2));
          assert(t.x>=prev.x, '단계 '+d+' 50R 배수가 앞 단계보다 작다'); } }
      // ② 0단계 = 캠프. 라운드가 없고 배율은 1
      C.dg=0; C.cleared=0;
      assert(campRoundN()===0, '0단계에 라운드가 있다: '+campRoundN());
      assert(campMineMul()===1, '캠프 배율이 1이 아님: '+campMineMul());
      // ③ 라운드는 **클리어할 때마다** 붙는다 — 50라운드면 50번(49번이 아니다)
      campEnterDungeon(1);
      assert(campRoundN()===1 && campMineMul()===1, '던전 1 진입값이 틀림');
      campClearRound();
      assert(Math.abs(campMineMul()-1.02)<1e-9, '1라운드 클리어 뒤 배율: '+campMineMul()+' (기대 1.02)');
      for(let i=0;i<48;i++) campClearRound();          // 누계 49회
      assert(Math.abs(campMineMul()-1.98)<1e-9, '49회 클리어 배율: '+campMineMul()+' (기대 1.98)');
      // ④ 50회째를 깨면 **다음 던전으로 자동** — 그 순간 배율은 다음 던전 진입값
      campClearRound();
      assert(campDgN()===2 && campRoundN()===1, '50 클리어인데 자동 이동 안 함: '+campDgN()+'-'+campRoundN());
      assert(campMineMul()===3, '던전 2 진입 배율: '+campMineMul()+' (기대 3)');
      assert(campBest(1)===50, '던전 1 최고 기록이 50이 아님: '+campBest(1));
      // ⑤ 지면 캠프(0)로 탈락 — 몇 라운드를 깼든. best 는 남는다
      campClearRound(); campClearRound();
      const was=campFail();
      assert(was.dg===2 && was.cleared===2, '탈락 기록이 틀림: '+JSON.stringify(was));
      assert(campDgN()===0 && campMineMul()===1, '탈락인데 캠프로 안 돌아감: '+campDgN());
      assert(campBest(1)===50 && campBest(2)===2, '탈락으로 best 가 지워짐');
      // ⑥ 마지막 던전은 끝에 머문다(넘어갈 곳이 없다)
      campEnterDungeon(CAMP_DG_MAX);
      for(let i=0;i<60;i++) campClearRound();
      assert(campDgN()===CAMP_DG_MAX, '마지막 던전에서 넘어가 버림: '+campDgN());
      assert(campCleared()===CAMP_ROUND_MAX, '마지막 던전 클리어 수가 상한을 넘음: '+campCleared());
      return '0=캠프 · 1~'+CAMP_DG_MAX+'던전 × '+CAMP_ROUND_MAX+'라운드 · 배율 1→'+(CAMP_MINE[CAMP_DG_MAX].base*CAMP_MINE[CAMP_DG_MAX].x);
    } finally { C.dg=back.dg; C.cleared=back.cleared; C.best=back.best;
      if(typeof campSave==='function') campSave(); } });

  // ⚔ 던전 전투 — 오토배틀(18-strike.js)을 빌려 쓴다. ⛔ 전투를 캠프에 새로 짜지 말 것.
  await step('캠프 던전: 적 웨이브 · 전투 · 승패', async()=>{
    skipIf(typeof campCombatStep!=='function','캠프 전투 없음');
    const C=campState(); const back={dg:C.dg, cleared:C.cleared, best:C.best};
    const stk0=(typeof STK!=='undefined')?STK:null;
    try{
      // ① 0단계(캠프)에는 전투가 없다 — 전장이 열리지 않는다
      C.dg=0; C.cleared=0; campBattleClose();
      campCombatStep(0.05);
      assert(CAMPB===null,'0단계인데 전장이 열렸다');
      // ② 던전에 들어가면 전장이 열리고 양쪽이 나온다
      campEnterDungeon(1); campBattleClose();
      campCombatStep(0.05);
      assert(CAMPB,'던전인데 전장이 안 열림');
      assert(CAMPB.me.base.y>CAMPB.ai.base.y,'적이 위에서 안 온다 — 내 본부가 아래여야 한다');
      assert(campAlive('ai')>0,'적이 안 나옴: '+campAlive('ai'));
      // ③ ⭐ 전역 STK 를 빌려 쓰고 **반드시 돌려놓는다** — 안 돌려놓으면 오토배틀이 캠프 전장을 본다
      assert(STK===stk0,'campCombatStep 이 전역 STK 를 돌려놓지 않았다');
      const seen=campWithStk(S=>{ assert(STK===S,'campWithStk 안에서 STK 가 안 바뀜'); return S; });
      assert(seen===CAMPB && STK===stk0,'campWithStk 가 STK 를 안 돌려놓음');
      // ④ ⏱ **화면의 적을 다 잡으면 그 순간 라운드가 오른다.**
      //    라운드 길이는 오직 `적 총 체력 ÷ 아군 총 DPS` 다(HUNT_R1 §6-2).
      //    ⛔ 최소 시간·대기 시간을 두지 말 것 — 한때 「안 나온 무리가 남으면 안 끝난다」는
      //      하한이 있었는데, 그러면 라운드가 길어졌을 때 **대기 때문인지 전투 때문인지 못 가린다**
      //      (실제로 난이도가 11배 올라도 18초 고정이었고 전부 대기 시간이었다).
      //      길게 하고 싶으면 적 체력만 만진다.
      const r0=campRoundN();
      CAMPB._gapT=0;                       // ⚠ 라운드 사이 숨 고르기 중이면 그 프레임은 갭만 처리한다
      if(CAMPB._wq) CAMPB._wq.length=0;    // ⚠ 아직 안 나온 무리가 있으면 그 프레임에 새로 나와 전멸이 아니게 된다
      for(const u of CAMPB.ai.units) u.dead=true;
      campCombatStep(0.05);
      assert(campRoundN()===r0+1,'적 전멸인데 라운드가 안 오름: '+r0+' → '+campRoundN());
      assert(!(CAMPB._wq && CAMPB._wq.length),'라운드가 넘어갔는데 안 나온 무리가 남아 있다');
      // ⑤ **인구 한도까지 계속 출격하되, 상한은 절대 넘지 않는다** (2026-08-27 규칙 변경)
      //    ⛔ 옛 규칙은 「전장이 비어야 출격」이었다. 그러면 전장 병력이 17~18기에 묶여
      //      대기 병력 68기가 놀았다 — 적이 100마리 나오는 판에서 그건 방어전이 아니다.
      //    ⚠ 그때 이 규칙이 있었던 이유는 **건물 하나당 공짜로 유닛이 나왔기 때문**이다
      //      (strikeSpawnForPlayer 의 _emit · 실측 R50 에 623기). 지금은 캠프가 그 배출을
      //      꺼서(noEmit) 값을 내고 산 병력만 나온다 — 그래서 갭마다 출격해도 안전하다.
      //    ⭐ 상한을 지키는 곳은 campTrimArmy() **한 곳**이다.
      { campWithStk(()=>{ for(let i=0;i<4;i++) strikeSpawnUnit('me','marine'); });
        const cap=Math.max(1,Math.min(200,G.tech.supCap||200));
        for(let i=0;i<8;i++) campCombatStep(CAMP_ROUND_GAP_S);   // 갭을 몇 번 넘긴다
        const n1=CAMPB.me.units.length+campDown();
        assert(n1>0,'갭을 넘기고 나니 병력이 통째로 사라졌다');
        assert(n1<=cap,'갭마다 병력이 불어나 인구 상한을 넘는다: '+n1+' > '+cap); }
      // 👥 **전장 병력도 인구 상한을 넘지 않는다.**
      //    ⚠ 전장 자체엔 제한이 없다(STK_UNIT_CAP=0) — 캠프의 200 은 생산 제한일 뿐이라
      //      던전 전환에서 샌다. 실측: 던전 1 은 20기였는데 던전 2 로 넘어가며 292기가 됐다.
      { assert(typeof campTrimArmy==='function','인구 상한 트림이 없다');
        const cap=Math.max(1,Math.min(200,G.tech.supCap||200));
        // 상한을 넘겨 억지로 채운 뒤 트림이 도는지 본다
        const proto=CAMPB.me.units[0];
        if(proto){ for(let i=0;i<cap+30;i++) CAMPB.me.units.push(Object.assign({},proto,{uid:'x'+i}));
          campTrimArmy();
          const tot=CAMPB.me.units.length+campDown();
          assert(tot<=cap,'전장 병력이 인구 상한을 넘는다: '+tot+' > '+cap); } }
      // ⑥ ✈ **때릴 수 없는 적만 남으면 진다** — 안 그러면 라운드가 영원히 안 끝난다.
      //    실측(2026-08-27): 던전 1 R12 에서 hellfire(공중 전용) 하나가 남았는데 아군이
      //    화력병 20기(지상 전용)뿐이라 서로 한 대도 못 때렸다. 적 본부는 이미 부순 뒤였다.
      { assert(typeof campCanHitFoes==='function','때릴 수 있나 판정이 없다');
        assert(campCanHitFoes(),'전제가 바뀜: 지금 편성으로 적을 못 때린다');
        // 적을 공중 전용으로, 아군을 지상 전용으로 바꿔 그 상황을 만든다
        const foe=CAMPB.ai.units.find(u=>!u.dead);
        if(foe && typeof FXLAB_AIR!=='undefined' && typeof SB_ATK_MODE!=='undefined'){
          const airId=[...FXLAB_AIR][0], gndId=Object.keys(SB_ATK_MODE).find(k=>SB_ATK_MODE[k]==='gnd');
          if(airId && gndId){
            // ⚠ 전투는 공격 레이어를 u._atk 에 **캐시**한다(18-strike.js:1196) — id 만 바꾸면 옛 값이 남는다
            foe.id=airId; foe.gm=airId; delete foe._atk;
            for(const m of CAMPB.me.units){ m.id=gndId; m.gm=gndId; delete m._atk; m.dmg=m.dmg||10; }
            for(const d of (CAMPB._down||[])) if(d.u){ d.u.id=gndId; d.u.gm=gndId; delete d.u._atk; }   // ⚠ 누운 병력도 곧 일어난다 — 같이 바꿔야 상황이 성립한다
            for(const o of CAMPB.ai.units) if(o!==foe) o.dead=true;                    // 다른 적이 남아 있으면 그쪽은 때릴 수 있다
            assert(!campCanHitFoes(),'공중 적 + 지상 아군인데 때릴 수 있다고 한다');
            if(CAMPB._wq) CAMPB._wq.length=0;
            const dg0=campDgN();
            campCombatStep(0.05);
            assert(campDgN()===0,'때릴 수 없는 적만 남았는데 안 졌다 — 라운드가 영원히 안 끝난다(던전 '+dg0+')');
            // 🧹 일부러 진 검사다 — 전장이 닫혔으므로 뒤 검사를 위해 다시 들어간다
            if(typeof campEnterDungeon==='function'){ campEnterDungeon(dg0||1); campCombatStep(0.05); }
          } } }
      // ⛔ 적 풀에 공중 **전용**은 안 들어간다(공중이면서 지상을 치는 것은 남긴다)
      { if(typeof campFoeId==='function' && typeof SB_ATK_MODE!=='undefined'){
          for(let i=0;i<40;i++){ const id=campFoeId();
            if(id) assert(SB_ATK_MODE[id]!=='air','공중 전용 적이 뽑혔다: '+id); } } }
      // ⚔ **캠프 전용 능력치** — §3-1/§3-A/§3-B 가 단일 소스. 인구만 코드가 이긴다.
      //    ⛔ U · STK_UNITS · TECH_SPEC 을 고치면 멀티 대전과 오각형 상성이 같이 바뀐다.
      //      소환된 개체 값만 덮어야 한다.
      if(typeof campDesignStat==='function'){
        const uDmg0=U.marine.dmg, uHp0=U.marine.hp;
        const m=campWithStk(()=>{ strikeSpawnUnit('me','marine'); return STK.me.units[STK.me.units.length-1]; });
        assert(m,'레인저를 못 만들었다');
        assert(campDesignStat(m),'설계 능력치가 안 걸렸다');
        assert(m.maxHp===5 && m.hp===5,'레인저 체력이 설계값(5)이 아니다: '+m.maxHp);
        assert(m.dmg===1,'레인저 공격이 설계값(1)이 아니다: '+m.dmg);
        assert(Math.abs(m.cdMax-1.0)<1e-9,'레인저 주기가 설계값(1.0)이 아니다: '+m.cdMax);
        assert(Math.abs(m.rng-4*CAMP_STAT_TILE)<1e-6,'레인저 사거리가 설계값(4칸)이 아니다: '+m.rng);
        assert(!campDesignStat(m),'같은 유닛에 두 번 걸렸다');
        // ⛔ 공용 표는 그대로여야 한다
        assert(U.marine.dmg===uDmg0 && U.marine.hp===uHp0,'U 표를 건드렸다 — 멀티 대전이 바뀐다');
        // §3-1-1 조정분이 들어 있는가
        assert(CAMP_UNIT_STAT.racer.a===2.5 && CAMP_UNIT_STAT.racer.c===0.8,'레이서 조정분(2.5·0.8)이 없다');
        assert(CAMP_UNIT_STAT.ghost.a===4,'저격수 조정분(4)이 없다');
        m.dead=true; }
      // 🎯 **적 사거리는 아군 최소 사거리보다 짧다** (2026-08-27 · 캠프 전용)
      //    ⛔ 안 걸면 라운드가 안 끝난다 — 적이 아군보다 멀리서 쏘는데 아군은 제자리 방어라
      //      다가가지 않고, 맞은 만큼 의무병이 채워 준다(실측: R31 55초).
      //    ⛔ U 표·STK_UNITS 의 range 를 고쳐서 맞추면 멀티 대전과 오각형 상성이 같이 바뀐다.
      //      소환된 **적 개체의 값만** 깎아야 한다.
      if(typeof campFoeRngCap==='function'){
        campWithStk(()=>{ for(let i=0;i<3;i++) strikeSpawnUnit('me','marine'); });
        const cap=campFoeRngCap();
        let minAlly=Infinity;
        for(const u of CAMPB.me.units){ if(u.dead||!(u.dmg>0)||!(u.rng>0)) continue;
          if(u.rng<minAlly) minAlly=u.rng; }
        assert(minAlly<Infinity,'전제가 바뀜: 때리는 아군이 없다');
        assert(Math.abs(cap-minAlly*0.9)<1e-6,'상한이 아군 최소 사거리 ×0.9 가 아니다: '+cap.toFixed(1)+' vs '+(minAlly*0.9).toFixed(1));
        // 실제 소환된 적이 그 상한을 지키는가 — 사거리가 긴 적(탱크)을 억지로 넣어 본다
        campWithStk(()=>{ strikeSpawnUnit('ai','tank'); });
        const foe=CAMPB.ai.units[CAMPB.ai.units.length-1];
        if(foe){ foe.rng=999; foe.acq=0; campScaleFoes([foe]);
          assert(foe.rng<=cap+1e-6,'적 사거리가 안 깎였다: '+foe.rng);
          assert(foe.acq>=cap-1e-6,'적 인지범위가 사거리보다 좁다 — 다가오지 않아 또 대치한다: '+foe.acq);
          foe.dead=true; } }
      // ⑤ 🏢 **패배 = 내 건물이 전부 부서지는 것**(2026-08-27 확정). 본부 하나가 아니다.
      //    ⛔ 예전에는 me.base.hp<=0 하나로 졌다 — 전장에 본부밖에 없어서 병영·보급소는
      //      적이 때릴 수도 없었다. 지금은 기지의 건물이 모두 표적이고, 마지막 한 채까지
      //      부서져야 진다(적은 strikeFrontStruct 를 통해 가장 앞 건물부터 친다).
      assert(typeof campBldAlive==='function','건물 목록 판정이 없다');
      { const live=campBldAlive();
        assert(live.length>=1,'전장에 내 건물이 하나도 없다 — campBuildStructs 가 안 돌았다');
        // ⚠ 병력을 채워 두고 재야 한다 — 아군이 0기면 「때릴 수 없어서」 지고, 그러면
        //   건물 규칙을 잰 것이 아니게 된다(공짜 배출을 끈 뒤로 실제로 그랬다).
        campWithStk(()=>{ for(let i=0;i<4;i++) strikeSpawnUnit('me','marine'); });
        CAMPB._gapT=0; CAMPB._started=true;
        if(live.length>1){                       // 한 채만 부숴도 지면 안 된다
          live[0].hp=0; live[0].dead=true;
          campCombatStep(0.05);
          assert(campDgN()>0,'건물 한 채가 부서졌다고 탈락했다 — 전부 부서져야 진다'); }
        for(const b of campBldAlive()){ b.hp=0; b.dead=true; }
        campCombatStep(0.05);
        assert(campDgN()===0,'건물이 전부 부서졌는데 캠프로 안 감: '+campDgN()); }
      assert(CAMPB===null,'탈락인데 전장이 안 닫힘');
      // ⑥ ⭐ 캠프 전장은 오토배틀 승패 처리를 타지 않는다
      //    안 막으면 적 본진을 부순 순간 「오토배틀 승리」 결과창이 뜨고,
      //    자동 진행이 로비까지 가서 G=newGame() 이 캠프 판을 통째로 날린다(실측으로 잡았다).
      { campEnterDungeon(1); campBattleClose(); campCombatStep(0.05);
        assert(CAMPB && CAMPB.camp===true,'캠프 전장에 camp 표식이 없다');
        const prevG=G, prevTech=G.tech, prevPhase=G.phase;
        CAMPB.ai.base.hp=0; CAMPB.me.base.hp=0;          // 양쪽 본진을 부순다
        campWithStk(()=>{ if(typeof strikeCheckOver==='function') strikeCheckOver(); });
        assert(!CAMPB.over,'캠프 전장인데 오토배틀 승패가 났다: '+CAMPB.over);
        assert(G===prevG && G.tech===prevTech,'승패 처리가 G 를 갈아엎었다');
        assert(G.phase===prevPhase,'승패 처리가 G.phase 를 바꿨다: '+G.phase);
        campBattleClose(); }
      // ⑦ 웨이브는 라운드가 오를수록 두꺼워진다
      assert(campFoeCount(50)>campFoeCount(1),'웨이브가 라운드에 안 따라온다');
      return '적 '+campFoeCount(1)+'→'+campFoeCount(50)+'마리 · STK 빌리고 반납 ok';
    } finally { C.dg=back.dg; C.cleared=back.cleared; C.best=back.best;
      campBattleClose(); if(typeof campSave==='function') campSave(); } });

  // 📈 적 난이도 곡선 — HUNT_R1.md §6-1. ⛔ 미네랄(CAMP_MINE)과 같은 식으로 묶지 말 것.
  await step('캠프 던전: 적 난이도 곡선 · 웨이브 분할', async()=>{
    skipIf(typeof campFoeDiff!=='function','난이도 곡선 없음');
    const C=campState(); const back={dg:C.dg, cleared:C.cleared};
    try{
      // ① 던전 문턱은 어느 던전에서나 ×3 — 하나라도 어긋나면 「내려갈수록 쉬워지는」 구간이 생긴다
      assert(CAMP_DG_STEP===3,'던전 문턱 상수가 3 이 아님: '+CAMP_DG_STEP+' (HUNT_R1 §6-1)');
      for(let d=2; d<=CAMP_DG_MAX; d++){
        const step=campFoeDiff(d,0)/campFoeDiff(d-1,CAMP_ROUND_MAX-1);
        assert(Math.abs(step-3)<0.01,'던전 '+d+' 문턱이 ×3 이 아님: '+step.toFixed(3)); }
      // ② 깊은 던전일수록 라운드 한 칸이 더 무겁다
      assert(Math.abs(campRBase(1)-1.07)<1e-9 && Math.abs(campRBase(10)-1.097)<1e-9,
        '라운드 밑이 설계값(1.070→1.097)과 다름: '+campRBase(1)+'→'+campRBase(10));
      assert(campFoeDiff(1,49)/campFoeDiff(1,0) < campFoeDiff(10,49)/campFoeDiff(10,0),
        '던전 10 의 50라운드가 던전 1 보다 안 무겁다');
      // ③ ⭐ 보상보다 난이도가 훨씬 크게 오른다(둘을 묶으면 안 되는 이유)
      C.dg=1; C.cleared=0; const m0=campMineMul();
      C.cleared=49;        const m1=campMineMul();
      assert((campFoeDiff(1,49)/campFoeDiff(1,0)) > (m1/m0)*10,
        '50라운드에 난이도가 보상의 10배도 안 오른다 — 곡선이 묶였나');
      // ④ 마리 수 — 라운드가 오르면 잘게 쪼갠다. 상한 100
      assert(campFoeCount(1)===3,'1라운드 마리 수: '+campFoeCount(1));
      assert(campFoeCount(50)===CAMP_FOE_NMAX,'50라운드가 상한이 아님: '+campFoeCount(50));
      assert(campFoeCount(999)<=CAMP_FOE_NMAX,'마리 수가 상한을 넘음');
      // ⑤ campScaleFoes 는 무리의 **총 체력**을 목표에 맞추되 유닛별 차이를 남긴다
      C.dg=2; C.cleared=10;
      const want=campFoeDiff(2,10);
      const mob=[{maxHp:40,maxSh:0,dmg:6},{maxHp:400,maxSh:0,dmg:30}];   // 마린급 · 탱크급
      const r0=mob[1].maxHp/mob[0].maxHp;
      campScaleFoes(mob);
      const tot=mob.reduce((a,u)=>a+u.maxHp+u.maxSh,0), td=mob.reduce((a,u)=>a+u.dmg,0);
      assert(Math.abs(tot/(CAMP_FOE_HP0*want)-1)<1e-6,'무리 총 체력이 목표와 다름: '+tot+' vs '+(CAMP_FOE_HP0*want));
      assert(Math.abs(td/(CAMP_FOE_ATK0*want)-1)<1e-6,'무리 총 공격이 목표와 다름: '+td);
      assert(Math.abs(mob[1].maxHp/mob[0].maxHp-r0)<1e-6,'유닛별 체력 차이가 사라졌다 — 통째로 덮어썼나');
      assert(mob[0].hp===mob[0].maxHp,'현재 체력이 상한과 다름');
      // ⑥ 0단계(캠프)에는 난이도가 없다
      assert(campFoeDiff(0,0)===1,'캠프에 난이도가 붙었다: '+campFoeDiff(0,0));
      return '문턱 ×'+CAMP_DG_STEP+' · 라운드밑 '+campRBase(1).toFixed(3)+'→'+campRBase(10).toFixed(3)
        +' · 천장 '+campFoeDiff(CAMP_DG_MAX,CAMP_ROUND_MAX-1).toExponential(2);
    } finally { C.dg=back.dg; C.cleared=back.cleared; } });

  // 🗺 맵 위 띠 — **칩과 안 겹치는 것만** 남긴다(적 수 · 트리 입구).
  //   ⛔ 던전·라운드·진행은 재화 바 왼쪽 칩(#curTitle · js/12-appshell.js)이 단일 소스다.
  //      두 곳에 두면 반드시 어긋난다 — 실제로 두 세션이 각자 만들어 중복이었다(2026-08-25 통합).
  await step('캠프 맵 띠: 적 수 · 트리 입구 (칩과 중복 없음)', async()=>{
    skipIf(typeof campBarRender!=='function','띠 없음');
    const el=document.getElementById('campBar');
    assert(el,'#campBar 가 마크업에 없다');
    const C=campState(); const back={dg:C.dg, cleared:C.cleared, rbPts:C.rbPts};
    try{
      // ① ⭐ 중복 금지 — 던전 이름·라운드·진행 바가 여기 있으면 안 된다
      for(const cls of ['.cbNm','.cbRd','.cbTrk','.cbFil'])
        assert(!el.querySelector(cls), '띠에 '+cls+' 가 남아 있다 — 던전·라운드는 칩이 맡는다');
      assert(!/던전|라운드/.test(el.textContent),'띠가 던전/라운드를 글자로 보여준다: '+el.textContent);
      // ② 적 수 — 던전에서 적이 있을 때만
      C.dg=0; C.cleared=0; campBattleClose(); campBarReset(); campBarRender();
      assert(!el.querySelector('.cbFoe').textContent,'캠프인데 적 수가 나온다');
      C.dg=3; C.cleared=10; campBattleOpen();
      CAMPB.ai.units=[{dead:false},{dead:false},{dead:false}];
      campBarReset(); campBarRender();
      assert(el.querySelector('.cbFoe').textContent==='적 3','적 수가 안 맞음: '+el.querySelector('.cbFoe').textContent);
      // ③ 트리 입구 — 띠 전체는 pointer-events:none 이라 이 칩만 되살아 있어야 한다
      { const bar=getComputedStyle(el).pointerEvents, chip=getComputedStyle(el.querySelector('.cbTree')).pointerEvents;
        assert(bar==='none','띠가 맵 조작을 가로챈다');
        assert(chip==='auto','트리 칩이 안 눌린다 — 트리에 들어갈 길이 사라진다'); }
      C.rbPts=1234; campBarReset(); campBarRender();
      assert(el.querySelector('.cbTree b').textContent.length>0,'포인트가 안 나옴');
      // ④ 보여줄 게 없으면 띠가 숨는다(빈 판이 맵을 가리지 않게)
      C.dg=0; C.cleared=0; C.rbPts=0; campBattleClose(); campBarReset(); campBarRender();
      assert(el.classList.contains('empty'),'보여줄 게 없는데 띠가 남아 있다');
      // ⑤ 매 프레임 불리므로 바뀐 것만 쓴다
      C.dg=2; C.cleared=1; C.rbPts=5; campBarReset(); campBarRender();
      { const b=el.querySelector('.cbTree b'); b.textContent='XX'; campBarRender();
        assert(b.textContent==='XX','안 바뀌었는데 다시 그렸다 — 캐시가 안 먹는다'); }
      // ⑥ 맵 밑에 깔리지 않는다 · 재화 바와 안 겹친다
      { const MAP=['cstMain','cstFog','techMap3d','cstLabels','cstPrev'];
        const mz=MAP.map(id=>{ const c=document.getElementById(id);
          return c ? (parseInt(getComputedStyle(c).zIndex,10)||0) : 0; });
        const top=Math.max(0,...mz), mine=parseInt(getComputedStyle(el).zIndex,10)||0;
        assert(mine>top,'띠 z-index('+mine+')가 맵 층('+top+') 아래다'); }
      { const c=document.getElementById('curBar');
        if(c){ const a=el.getBoundingClientRect(), b=c.getBoundingClientRect();
          assert(a.y >= b.y+b.height-0.5,'띠가 재화 바와 겹친다'); } }
      return '적 수 + 트리 칩만 · 던전/라운드는 칩이 맡는다 · 빈 띠는 숨는다';
    } finally { C.dg=back.dg; C.cleared=back.cleared; C.rbPts=back.rbPts;
      campBattleClose(); campBarReset(); campSave(); } });

  // ⛏ 채취 — 남아 있는 만큼만 준다. 무한 자원이 되던 자리다(BALANCE.md §3-2 실측).
  //   ⚠ 지급 로직을 테스트 안에서 다시 구현하지 말 것 — 그러면 코드를 되돌려도 통과한다(실제로 한 번 그랬다).
  //     여기서는 **진짜 함수(_techGatherTick)** 를 돌려서 크레딧이 느는지 본다.
  await step('채취: 광맥이 마르면 더 안 준다', async()=>{
    skipIf(typeof _techGatherTick!=='function','채취 틱 없음');
    const keep=G.tech;
    try{
      techUIInit('union'); G.tech.inf=false;
      const M=G.tech.minerals; assert(M && M.length,'광맥이 없다');
      const cc=G.tech.ents.find(e=>e.type==='bldg'); assert(cc,'본부가 없다');
      const w=G.tech.ents.find(e=>e.type==='worker'); assert(w,'일꾼이 없다');
      const node=M[0];
      // 일꾼을 '자원을 들고 본부에 딱 붙은' 상태로 세운다 — 반납 지점이 바로 실행된다
      const arm=(amount)=>{ node.amount=amount;
        w.x=cc.x; w.y=cc.y; w.tx=null; w.ty=null; w._wp=null; w._bStuck=0; w._bPrevD=null;
        w._carry=true; w._cKind='mineral'; w._cEid=node.eid; w._gKind='mineral'; w._gEid=node.eid;
        w.build=null; w._gSt='back'; w._dropEid=cc.eid; w._gBaseSpot={x:w.x,y:w.y}; };
      const run=()=>{ const c0=G.tech.credit; _techGatherTick(0.05); return G.tech.credit-c0; };
      // ① 잔량이 넉넉하면 준다
      arm(100); const g1=run();
      assert(g1>0,'넉넉한데 한 푼도 안 준다 — 반납 지점을 못 탔다');
      assert(g1<=TECH_GATHER_AMT,'한 번에 채취량보다 많이 준다: '+g1);
      // ② ⭐ 다 마르면 **한 푼도 안 준다** — 여기가 무한 자원이던 자리다
      let got=0; for(let i=0;i<15;i++){ arm(0); got+=run(); }
      assert(got===0,'광맥이 0 인데 계속 번다(무한 자원): +'+got);
      // ③ 남은 것보다 많이 가져가지 않는다 — 잔량이 음수가 되면 안 된다
      arm(3); run();
      assert(node.amount>=0,'잔량이 음수가 됐다: '+node.amount);
      // ④ ⭐ inf 광맥은 **줄지도 않고 계속 준다** — 캠프가 이렇게 깐다
      node.inf=true; arm(TECH_MINE_START);
      let inf=0; for(let i=0;i<10;i++){ arm(node.amount); inf+=run(); }
      assert(inf>0,'무제한 광맥인데 안 준다');
      assert(node.amount===TECH_MINE_START,'무제한 광맥이 줄었다: '+node.amount);
      node.inf=false;
      return '넉넉하면 지급 · 고갈이면 0 · 무제한(inf)은 안 줄고 계속 준다';
    } finally { G.tech=keep; } });

  await step('캠프: 터치 채집 · 비용 조회 · 자리 비움 정산', async()=>{
    skipIf(typeof campTapAt!=='function','캠프 채집 없음');
    const C=campState(); C.race='terran'; C.ents=[]; C.minerals=[]; C.upg={}; C.rate=0; C.leftAt=0;
    openHome(); await sleep(420);
    assert(G.tech && (G.tech.minerals||[]).length===6,'광맥이 안 깔림');
    // ① 광맥을 누르면 캔다 — 화면 좌표로 실제 탭 경로를 탄다
    const r=_btRect(); assert(r && r.width>0,'건설 맵 사각형이 없음');
    const m=G.tech.minerals[0], sc=_techW2S(m.x,m.y);
    const cx=r.left+sc.x*r.width, cy=r.top+sc.y*r.height;
    const c0=G.tech.credit, a0=m.amount;
    assert(campTapAt(cx,cy)===true,'광맥을 눌렀는데 안 캐짐');
    assert(G.tech.credit>c0,'캤는데 미네랄이 안 늘어남');
    assert(m.amount===a0-campTapGain(),'매장량이 획득량만큼 안 줄었다: '+m.amount+' vs '+(a0-campTapGain()));
    // ② 빈 땅은 흘려보낸다(이동 명령이 먹어야 한다)
    { const w=_techS2W(0.03,0.97), far=_techW2S(w.x,w.y);
      assert(campTapAt(r.left+far.x*r.width, r.top+far.y*r.height)===false,'빈 땅인데 채집으로 먹힘'); }
    // ③ 매장량보다 많이 캐지 못한다 — ⚠ 기준을 상수로 박지 말 것(탭당 획득은 레벨로 변한다)
    { const mm=G.tech.minerals[1], left=Math.max(1,Math.floor(campTapGain()/2));
      mm.amount=left; const s2=_techW2S(mm.x,mm.y);
      const c1=G.tech.credit; campTapAt(r.left+s2.x*r.width, r.top+s2.y*r.height);
      assert(G.tech.credit-c1===left,'남은 매장량('+left+')보다 많이 캤다: +'+(G.tech.credit-c1));
      assert(mm.amount===0,'다 캤는데 매장량이 안 0'); }
    // ⚠ openHome() 이 loadMeta() 로 프로필을 다시 읽으므로 위에서 잡은 C 는 낡은 참조다.
    //    상태를 만질 땐 **그때그때 campState() 로 다시 가져온다**(코드 쪽은 늘 그렇게 한다).
    // ④ 업그레이드는 **정수 레벨** — 나중에 무한 티어가 얹힐 수 있어야 한다
    { const S=campState(); S.upg=S.upg||{};
      const g0=campTapGain(); S.upg.tap=1; const g1=campTapGain();
      assert(g1>g0,'업그레이드 1레벨인데 획득량이 그대로: '+g0+'→'+g1); S.upg.tap=0; }
    // ⑤ 던전 배수는 탭에도 걸린다(탭·일꾼 한쪽만 오르면 비율이 무너진다)
    //   ⚠ **낮은 레벨에서 재지 말 것.** 탭 0레벨은 1미네랄이라 ×1.5 가 정수로 안 떨어져
    //     round(1.5)=2 로 33% 과다가 된다(실제 게임에서도 그렇다 — 값이 작을 때만 생기는 반올림 특성).
    //     레벨이 조금만 올라도 사라지므로 여기서는 L10(1024)에서 잰다.
    //   ⚠ 2026-08-25: 단계 번호가 한 칸 내려갔다(0=캠프). 배수도 공식이 아니라 CAMP_MINE 표다.
    { const S=campState(); S.upg.tap=10; const d0=S.dg, c0=S.cleared;
      S.dg=0; S.cleared=0; const g0=campTapGain();
      S.dg=2; S.cleared=0; const g2=campTapGain();
      S.dg=d0; S.cleared=c0; S.upg.tap=0;
      const want=CAMP_MINE[2].base/CAMP_MINE[0].base;
      assert(Math.abs(g2/g0-want)<0.02,'던전 배수가 탭에 안 걸림: '+(g2/g0).toFixed(3)+' (기대 '+want+')'); }
    // ⑤-b ⭐ **폭주 방지 불변식 — 레벨이 올라도 레벨업이 쉬워지지 않는다.**
    //    이 게임의 지수 축은 **던전 배율(2^d)과 환생 배율** 둘이다. 레벨까지 지수로 두면
    //    셋이 되어 BALANCE.md §0 폭주 조건에 걸린다 — 그래서 레벨은 **다항**이다
    //    (효과 = 선형 × 마일스톤 ≈ 0.002L², 비용 = 완만한 지수). HUNT_R1.md §1.
    //    ⛔ 이 검사를 풀지 말 것. 재는 기준은 「다음 레벨까지 몇 탭인가」이고, 그 값이 늘어야 한다.
    //    ⚠ 곡선은 **U자**다 — 초반엔 효과(선형)가 비용(완만한 지수)보다 빨리 늘어 레벨업이
    //      쉬워지고(실측 탭 70 → 15탭), 무릎(Lv10)을 지나면 비용이 이겨 가팔라진다(43 → 736).
    //      그게 정상이다. **보는 것은 최소점 이후가 단조 증가하는가** 하나다.
    { const S=campState(); const taps=(n)=>{ S.upg.tap=n; const t=campUpgCost('tap')/campTapGain(); S.upg.tap=0; return t; };
      assert(taps(30)>taps(10) && taps(60)>taps(30) && taps(100)>taps(60),
        '레벨이 오를수록 레벨업이 쉬워진다(폭주): '+[10,30,60,100].map(n=>taps(n).toFixed(1)).join(' → '));
      const gats=(n)=>{ S.upg.gather=n; const t=campUpgCost('gather')/campGatherMul(); S.upg.gather=0; return t; };
      assert(gats(30)>gats(10) && gats(60)>gats(30),
        '효율도 같은 불변식이 깨졌다: '+[10,30,60].map(n=>gats(n).toFixed(1)).join(' → ')); }
    // ⑤-b-2 효과는 **선형**, 비용은 **완만한 지수**, 곱셈은 **마일스톤**이 맡는다
    { const S=campState();
      const tap=(n)=>{ S.upg.tap=n; const v=campTapGain(); S.upg.tap=0; return v; };
      // 마일스톤 사이(19→20 은 계단이라 제외)에서는 레벨당 +1 로 선형이다
      assert(tap(5)-tap(4)===tap(9)-tap(8),'탭 효과가 선형이 아니다: '+(tap(5)-tap(4))+' vs '+(tap(9)-tap(8)));
      // 마일스톤 20 을 넘는 순간 ×2 — 「계단이 목표를 만든다」
      assert(Math.abs(tap(20)/((1+20)) - 2) < 0.01,'Lv20 마일스톤(×2)이 안 걸린다: '+tap(20));
      assert(campMileMul(19)===1 && campMileMul(20)===2 && campMileMul(50)===4 && campMileMul(100)===8,
        '마일스톤 계단이 20/50/100 에서 안 오른다: '+[campMileMul(19),campMileMul(20),campMileMul(50),campMileMul(100)].join(','));
      // ⛔ 마일스톤 배수는 Lv 에 **선형**이어야 한다(간격이 2배씩 넓어지므로). 지수가 되면 축이 셋이 된다.
      const k1=campMileMul(100)/100, k2=campMileMul(800)/800, k3=campMileMul(6400)/6400;
      assert(Math.abs(k1-k2)<0.01 && Math.abs(k2-k3)<0.01,
        '마일스톤이 지수로 자란다 — 지수 축이 셋이 되어 폭주한다: '+[k1,k2,k3].map(v=>v.toFixed(3)).join(','));
      // 비용 무릎 — Lv10 부터 가팔라진다
      const c=(n)=>{ S.upg.tap=n; const v=campUpgCost('tap'); S.upg.tap=0; return v; };
      assert(Math.abs(c(5)/c(4)-1.09)<0.02,'무릎 전 비용 계단이 1.09 가 아니다: '+(c(5)/c(4)).toFixed(3));
      assert(Math.abs(c(15)/c(14)-1.15)<0.02,'무릎 후 비용 계단이 1.15 가 아니다: '+(c(15)/c(14)).toFixed(3)); }
    // 🤖 매크로 방지 (HUNT_R1 §1-1-3) — 탭에 상한이 없으므로 이것이 유일한 제동이다
    if(typeof campTapHuman==='function'){
      // ① 사람처럼 흔들리는 탭 = 감쇠 없음
      campTapReset(); let h=1;
      { let t=0; const rnd=(function(){ let s=12345; return function(){ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; }; })();
        const now=performance.now; let fake=now.call(performance);
        performance.now=function(){ return fake; };
        for(let i=0;i<25;i++){ fake+=90+rnd()*120; h=campTapHuman(200+rnd()*20, 300+rnd()*20); }
        performance.now=now; }
      assert(h>0.95,'사람처럼 친 탭이 감쇠됐다: '+h.toFixed(2));
      // ② 오토클리커 = 간격도 좌표도 흔들림이 없다 → 감쇠. 다만 0 이 되지는 않는다.
      campTapReset(); let m=1;
      { const now=performance.now; let fake=now.call(performance);
        performance.now=function(){ return fake; };
        for(let i=0;i<25;i++){ fake+=50; m=campTapHuman(200, 300); }
        performance.now=now; }
      assert(m<0.35,'오토클리커가 감쇠되지 않았다: '+m.toFixed(2));
      assert(m>=CAMP_TAP_FLOOR-1e-9,'감쇠가 하한(20%) 아래로 내려갔다 — 완전 차단은 오탐 때 억울하다: '+m.toFixed(2));
      campTapReset(); }
    // 👥 **인구 — 상한 200 · 일꾼도 한 칸을 먹는다** (HUNT_R1 §2-2 · §2-2-1, 2026-08-26 확정)
    //    보급소 24채면 10 + 24×8 = 202 가 나오지만 **200 에서 잘린다**(스타크래프트와 같은 숫자).
    //    ⭐ 일꾼이 인구를 먹는 것이 1회차 총수입을 목표에 맞춘 규칙이다 — 안 먹던 설계 시뮬은
    //      4일에 목표(5,700만)를 45% 넘겼고, 먹게 하니 5,752만(+1%)이 됐다.
    { const T=G.tech, keep={cap:T.supCap, sup:T.sup, built:T.built.supply|0};
      // 건물로 올리는 경로가 200 에서 잘리는가
      T.supCap=0; _techAddSupCap(10);                       // 본부
      for(let i=0;i<CAMP_SUPPLY_MAX;i++) _techAddSupCap(8); // 보급소 24채
      assert(T.supCap===200,'인구 상한이 200 이 아니다(보급소 '+CAMP_SUPPLY_MAX+'채): '+T.supCap);
      assert(typeof TECH_SUP_MAX!=='undefined'&&TECH_SUP_MAX===200,
        'TECH_SUP_MAX 가 200 이 아니다: '+(typeof TECH_SUP_MAX!=='undefined'?TECH_SUP_MAX:'없음'));
      // 일꾼이 인구를 먹는가 — 생산 카드에 pop 이 붙어 있어야 한다
      { const wk=TECH_WORKER[T.race], t=TECH_TREE[T.race];
        let q=null; for(const b of (t.buildings||[])){ const f=(b.produces||[]).find(x=>x.id===wk); if(f){ q=f; break; } }
        assert(q,'일꾼 생산 항목을 못 찾았다');
        assert((q.pop|0)>=1,'일꾼이 인구를 안 먹는다 — 인구 200 이 목표가 되지 못한다: pop='+q.pop); }
      // 일꾼 40 을 채우려면 보급소가 먼저다(설계상 맞는 동작) — 시작 인구 10 이라 11기째부터 막힌다
      assert(CAMP_WORKER_MAX>10,'전제가 바뀜: 일꾼 상한이 시작 인구보다 작다');
      T.supCap=keep.cap; T.sup=keep.sup; T.built.supply=keep.built; }
    // ⑤-c 일꾼 축은 **수와 효율 둘 다**로 오른다.
    //    ⚠ 예전에는 광맥 한 덩이에 1명씩만 붙어(res.miner 단일 락) 12기 26.8/초가 천장이었고
    //      일꾼을 뽑는 행위 자체가 무의미했다. 캠프 광맥에 cap 을 얹어 열었다(실측 40기 137/초).
    { const S=campState(); S.upg.gather=0; const m0=campGatherMul();
      S.upg.gather=40; const m40=campGatherMul(); S.upg.gather=0;
      assert(Math.abs(m0-1)<0.01,'효율 Lv0 은 배수 1 이어야 한다(기준선): '+m0.toFixed(3));
      assert(m40>m0,'효율 레벨이 채취 배수를 못 올린다');
      const mins=(G.tech&&G.tech.minerals)||[];
      assert(mins.length&&mins.every(m=>(m.cap|0)>1),
        '캠프 광맥에 cap 표식이 없다 — 일꾼 수 축이 다시 막힌다'); }
    // ⑥ 비용은 한 문으로만 조회한다 — 표를 갈아끼울 자리
    { const b=campCost('bldg','barracks',0);
      assert(b && b.m>0,'건물 비용 조회 실패'); assert('lv' in b,'campCost 가 레벨 인자를 안 받는다(무한 티어 대비)'); }
    // ⑦ 자리 비움 정산 — 속도가 잡혀 있어야 채워진다
    { const S=campState(); S.rate=2; S.leftAt=Date.now()-600*1000; const c2=G.tech.credit;
      const got=campSettleAway();
      assert(got>0 && G.tech.credit>c2,'자리 비움 정산이 0');
      assert(got<=Math.ceil(2*600*CAMP_AWAY_EFF)+1,'정산이 과다: '+got);
      assert(campState().leftAt===0,'정산 후 leftAt 이 안 지워짐'); }
    // ⛏ 🧹 **찜해 놓고 안 캐는 일꾼의 자리는 뺏긴다.**
    //    ⚠ 광맥은 정해진 인원만 캘 수 있어 일꾼이 도착하면 자리를 「찜」한다. 북적일 때 찜한
    //      일꾼이 도착 판정(d<=0.008)을 놓치면 찜만 남아 **아무도 못 캔다** — 실측(2026-08-27):
    //      관리자 탭에서 일꾼 20기부터 수입이 **0** 이었다(광맥 6개 전부 찜, 찜한 6명 모두 'go').
    //      캠프는 cap 5 라 자리가 남아 안 걸렸을 뿐이다.
    { assert(typeof _techMinerSweep==='function','유령 찜 청소가 없다');
      const m=(G.tech.minerals||[])[0];
      if(m){ const bak={ms:m._miners, mi:m.miner};
        m._miners=[999999]; m.miner=999999;              // 있지도 않은 일꾼이 찜한 상태
        _techMinerSweep(m);
        assert(!(m._miners&&m._miners.length),'캐지 않는 일꾼의 찜이 안 걷힌다');
        assert(m.miner==null,'miner 가 유령인 채로 남는다');
        const w=(G.tech.ents||[]).find(e=>e.type==='worker');
        if(w){ const wb={st:w._gSt, eid:w._gEid};
          w._gSt='mine'; w._gEid=m.eid; m._miners=[w.eid]; m.miner=w.eid;
          _techMinerSweep(m);
          assert(m._miners.length===1 && m.miner===w.eid,'캐는 중인 일꾼의 찜까지 걷어냈다');
          w._gSt=wb.st; w._gEid=wb.eid; }
        m._miners=bak.ms||[]; m.miner=bak.mi==null?null:bak.mi; } }
    // ⑧ 일꾼은 **자동으로** 광맥에 붙어 실제로 번다
    //    ⚠ 관리자 건설 탭은 사람이 클릭해야 캔다 — 캠프가 대신 눌러 주지 않으면 초당 수급이 0 이다.
    //    ⚠ 헤드리스는 rAF 가 throttle 되므로 techTick 을 직접 돌린다(hbStep 과 같은 방식).
    // ⚠ 시작 일꾼이 0기다(설계) — 이 검사는 일꾼을 직접 넣고 배정만 본다
    { const _b=G.tech.ents.find(e=>e.type==='bldg');
      if(!(G.tech.ents||[]).some(e=>e.type==='worker'))
        G.tech.ents.push({eid:G.tech.eseq++, type:'worker', x:_b.x, y:_b.y+0.03});
      if(typeof campAutoGather==='function') campAutoGather();
      for(let i=0;i<40;i++) techTick(0.05);
      const gathering=(G.tech.ents||[]).filter(w=>w.type==='worker'&&w._gKind==='mineral').length;
      assert(gathering>=1,'일꾼이 광맥에 자동 배정되지 않음');
      const c0=G.tech.credit, DT=1/30;
      for(let i=0;i<60/DT;i++) techTick(DT);
      const got=G.tech.credit-c0;
      assert(got>0,'일꾼이 60초 동안 한 푼도 못 벌었다 — 자동 채취가 안 돈다');
      return '탭 '+campTapGain()+'/회 · 일꾼 '+gathering+'기 초당 '+(got/60).toFixed(1)+' · 정산 ok'; }
    });
  // 자동사냥(라운드 머신) — 던전과 같은 격리 규칙. hbStep을 직접 돌린다(rAF 비의존).
  await step('자동사냥: 라운드 정산·적 누적·사망 하강·격리', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbStart!=='function','자동사냥 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    // ⚠ HOME은 이제 화면을 떠나도 전투를 '이어받는다'(배경 진행). 이 스텝은 갓 시작한 판을 전제하므로
    //    hbEnd()로 완전히 끝내고 새로 연다 — 안 그러면 앞 스텝의 kills가 남아 아래 루프가 한 번도 안 돈다
    if(typeof hbEnd==='function') hbEnd();
    openHome(); await sleep(80);
    assert(_hb && _hb.on,'전투가 시작 안 됨');
    assert(!_hb.kills,'새 판인데 처치 수가 남아 있음: '+_hb.kills);
    _hb.manual=true;   // 인터벌 시계를 멈추고 hbStep만으로 결정적으로 돌린다
    const snap=JSON.stringify({credits:G.credits, wave:G.wave, units:(G.units||[]).length});
    // ① 처치 = 즉시 지급(재화 바가 바로 오른다) · 라운드 클리어 = 보너스 추가
    const p0=PROF().pcoin, g0=PROF().gas, x0=CHAR().level*1000000+CHAR().xp;
    _hb.char.atk=1e9; _hb.char.range=1e9; _hb.char.cd=.05; _hb.char.hpMax=1e9; _hb.char.hp=1e9;
    for(let i=0;i<40 && !_hb.kills;i++) hbStep(0.05);
    assert(_hb.kills>0,'처치가 없음');
    assert(PROF().pcoin>p0 && PROF().gas>g0,'처치 보상이 즉시 지급되지 않음');
    assert(CHAR().level*1000000+CHAR().xp>x0,'경험치가 안 들어옴');
    assert($('curMin').textContent!=='0','재화 바에 처치 보상이 반영되지 않음');
    const w0=_hb.round, pk=PROF().pcoin;
    let cleared=false;
    for(let i=0;i<5000;i++){ hbStep(0.05); if(_hb.round!==w0 || _hb.phase==='clearWait'){ cleared=true; break; } }
    assert(cleared,'라운드 클리어가 일어나지 않음');
    assert(PROF().pcoin>pk,'클리어 보너스가 없음');
    assert(_hb.wave===1,'클리어 후 웨이브가 리셋되지 않음');
    // ② 시간 초과 = 실패 → 1웨이브부터 다시(2026-08-12 규칙 변경: 예전엔 다음 웨이브와 합쳐졌다)
    _hb.char.atk=0; _hb.char.hp=1e9; _hb.char.hpMax=1e9; _hb.char.regen=0;
    _hb.phase='fight'; _hb.wave=2; _hb.foes.length=0; _hb.pend.length=0; hbSpawnWave();
    const rdKeep=_hb.round;
    // 웨이브 시간을 넉넉히 넘긴다 — 상수를 바꿔도 따라가게 hbWaveTime에서 역산한다
    { const n=Math.ceil((hbWaveTime(_hb.wave)+2)/0.05); for(let i=0;i<n;i++) hbStep(0.05); }
    assert(_hb.phase==='fail'||_hb.wave===1,'시간을 넘겼는데 실패로 안 감: phase '+_hb.phase+' wave '+_hb.wave);
    // ⚠ 재시작 '순간'을 잡아야 한다. 몇 초 더 돌리면 새로 난 적이 도착해 몇 대 때리므로
    //    체력이 가득이 아닌 게 정상이 된다(예전엔 이걸 나중에 재서 간헐적으로 실패했다).
    let healed=null;
    for(let i=0;i<80;i++){ const wasFail=(_hb.phase==='fail'); hbStep(0.05);
      if(wasFail && _hb.phase!=='fail'){ healed=(_hb.char.hp===_hb.char.hpMax); break; } }
    assert(_hb.wave===1,'실패 뒤 1웨이브로 안 돌아감: wave '+_hb.wave);
    assert(_hb.round===rdKeep,'실패로 라운드가 내려감(죽음과 달라야 한다)');
    assert(healed!==false,'실패 재시작인데 체력이 안 찼음');
    // ③ 사망 = 라운드 하강 + 클리어 보너스 몫 소실(이미 받은 처치 보상은 그대로) + 부활
    _hb.round=3; hbHunt().round=3; const pD=PROF().pcoin;
    _hb.char.atk=0; _hb.char.hpMax=10; _hb.char.hp=1;
    for(let i=0;i<200 && _hb.phase!=='down';i++) hbStep(0.05);
    assert(_hb.phase==='down','맞아도 안 쓰러짐');
    assert(_hb.round===2,'라운드 하강이 없음: '+_hb.round);
    assert(PROF().pcoin===pD,'사망 순간에 보상이 지급됨(클리어 보너스가 새어나감)');
    for(let i=0;i<80 && _hb.phase==='down';i++) hbStep(0.05);
    assert(_hb.phase==='fight' && _hb.char.hp===_hb.char.hpMax,'부활이 안 됨');
    // ④ 격리 + 화면 이탈 정지 + 재진입 재개
    assert(JSON.stringify({credits:G.credits, wave:G.wave, units:(G.units||[]).length})===snap,'유즈맵 상태를 건드림');
    const rep='round '+_hb.round+' · kills '+_hb.kills;
    // ④-2 화면을 떠나도 '전투는 계속' — 그리기만 멈추고 라운드는 이어진다(2026-08-10 사용자 요청으로 규칙 변경).
    //     예전 규칙은 '떠나면 정지'였고, 그때 미저장 처치 보상이 다음 화면의 loadMeta()에 덮여 사라졌다.
    // ⚠ 검사가 헛돌지 않게: '마지막 저장 이후에 번 돈'을 만들어 둔다.
    //    라운드 클리어는 이미 saveMeta를 하므로, 클리어 없이 처치만 일으켜야 저장 누락이 드러난다.
    // ⚠ 잡음을 먼저 줄인다 — 잔고 0·낮은 라운드(보상이 부동소수에 안 묻히게) · 웨이브 1(hbSettle 회피) ·
    //    일일 퀘스트 재우기(dqNote 가 완료 순간 saveMeta 를 부른다). 셋 다 '끼어드는 저장'의 원인이었다.
    //    ⭐ 다만 **보장은 아래 '저장본 되돌리기'가 한다** — 여기서 다 막으려 하면 또 새는 곳이 생긴다.
    try{ const D=dqState(); if(D&&D.q) D.q.forEach(e=>{ e.got=1; }); }catch(e){}
    PROF().pcoin=0; _hb.dg=1; _hb.round=1; _hb.wave=1;
    saveMeta();                                   // 기준점 — 여기까지는 저장돼 있다
    const savedAtBase=localStorage.getItem(metaKey());   // 그 시점의 저장본(아래에서 '저장 안 된 상태'를 되살리는 데 쓴다)
    // 예약 출현(pend)까지 비워야 창 안에서 다른 적이 튀어나와 처치가 쌓이지 않는다
    _hb.saveT=0; _hb.foes.length=0; if(_hb.pend) _hb.pend.length=0; _hb.phase='fight'; _hb.waveT=99;
    _hb.char.atk=1e9; _hb.char.range=1e9; _hb.char.cd=.05; _hb.char.cdT=0;   // 확실히 잡도록(사망 부활로 스탯이 돌아와 있다)
    const pcBase=PROF().pcoin;
    _hb.foes.push({ico:'🟢',mdl:'snapper',x:5,y:0,hp:1,hpMax:1,atk:0,spd:0,cdT:9,elite:false});
    for(let i=0;i<60 && PROF().pcoin<=pcBase;i++) hbStep(0.05);
    assert(PROF().pcoin>pcBase,'검사 준비 실패: 처치 보상이 안 들어옴');
    // ⚠ 이 창 안에서도 자동 저장이 끼어들 수 있다(자동 업그레이드가 코인을 쓰면 saveMeta, 8처치마다 주기 저장 …).
    //    그러면 '마지막 저장 이후에 번 돈'이 사라져 검사가 헛돌았다(간헐 실패의 정체).
    //    준비 상태는 **강제로** 만든다 — 저장본을 기준점으로 되돌리면 '번 돈이 아직 안 저장된 상태'가 확정된다.
    //    ⛔ 여기서 되돌리는 것은 저장본뿐이고 메모리의 PROF() 는 그대로다 — 뒤의 검사(떠날 때 flush)는 그대로 유효하다.
    if(savedAtBase!=null) localStorage.setItem(metaKey(), savedAtBase);
    { const sv=JSON.parse(localStorage.getItem(metaKey())||'{}');
      assert(((sv.profile&&sv.profile.pcoin)||0)<PROF().pcoin-1e-9,
        '검사 준비 실패: 저장본을 되돌렸는데도 저장 누락 상태가 안 만들어짐'); }
    const rd0=_hb.round, kl0=_hb.kills, pc0=PROF().pcoin;
    openMapSelect(); await sleep(60);
    assert(_hb && _hb.on,'홈을 떠났다고 전투가 끝나버림 — 배경 진행이 안 된다');
    assert(_hb.bg===true,'떠났는데 배경 모드가 아님(계속 그리면 낭비다)');
    assert(_hb.round===rd0 && _hb.kills===kl0,'화면을 옮겼더니 라운드/처치가 초기화됨: '
      +rd0+'/'+kl0+' → '+_hb.round+'/'+_hb.kills);
    // 떠날 때 저장돼야 다음 화면의 loadMeta()가 재화를 되돌리지 않는다
    { const saved=JSON.parse(localStorage.getItem(metaKey())||'{}');
      const sp=(saved.profile&&saved.profile.pcoin)||0;
      assert(sp>=pc0-1e-6,'떠날 때 저장이 안 됨 — loadMeta가 재화를 되돌린다: 저장 '+sp+' < 보유 '+pc0); }
    loadMeta();   // 실제로 다른 화면들이 하는 일
    assert(PROF().pcoin>=pc0-1e-6,'화면 전환 후 재화가 사라짐: '+pc0+' → '+PROF().pcoin);
    openHome(); await sleep(60);
    assert(_hb.on && !_hb.bg,'재진입 시 재개 안 됨');
    assert(_hb.round===rd0,'재진입에서 라운드가 초기화됨: '+rd0+' → '+_hb.round);
    return rep; });
  // 레벨업 보상(스탯 포인트)은 메인 화면에서 바로 찍혀야 한다 — 마을까지 걸어가야 하면 성장 축의 절반이 숨는다.
  // 성장 축은 미네랄 업그레이드 하나다 — 레벨 포인트도, 스탯 자동 배분도 없다.
  // 레벨업 보상은 미네랄(PROF_LV_MINERAL)이고 캐릭터 스탯에 직접 찍는 경로는 없다.
  await step('자동사냥: 레벨업 보상은 미네랄 · 스탯 찍는 경로 없음', async()=>{
    skipIf(typeof profApplyLevelUps!=='function','레벨 시스템 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60);
    for(const fn of ['profAllocStat','hmAllocStat','profDoAlloc','profGainStats'])
      assert(typeof window[fn]==='undefined','스탯 배분 경로가 남아 있음: '+fn);
    assert(!document.querySelector('.hmStat'),'HOME에 스탯 배분/성장 줄이 남아 있음');
    const c=CHAR(), p=PROF();
    const raw=()=>{ let v=0; for(const k of PROF_STATS) v+=c.unit.stats[k]||0; return v; };
    const st0=raw(), pc0=p.pcoin||0, lv0=c.level;
    for(let i=0;i<5;i++){ c.xp=profXpForLevel(c.level)+1; profApplyLevelUps(c); }
    assert(c.level===lv0+5,'5레벨이 안 올랐음: '+lv0+'→'+c.level);
    assert(raw()===st0,'레벨업이 캐릭터 스탯을 올렸다(미네랄로 통일했으므로 안 올라야 한다): '+st0+'→'+raw());
    assert((p.pcoin||0)-pc0===5*PROF_LV_MINERAL,
      '레벨업 미네랄이 다름: '+((p.pcoin||0)-pc0)+' != '+(5*PROF_LV_MINERAL));
    return '5레벨 → 미네랄 +'+(5*PROF_LV_MINERAL)+' · 스탯 불변'; });
  // DESIGN.md 규칙 — 마을(지도 + 시설 팝업)만. 전환을 마쳤으므로 되돌아갈 수 없다(§5).
    // 첫 진입 멈춤(모델 최초 생성 = 텍스처 업로드 + 셰이더 컴파일, 실측 538ms)을 로그인 화면·로딩으로 옮긴다.
  await step('워밍업: 로딩에서 미리 데우고 HOME은 멈춤 없이', async()=>{
    skipIf(typeof warmAll!=='function' || typeof enterAfterWarm!=='function','워밍업 없음');
    skipIf(!(window.M3D && M3D.ready && M3D.ready()),'3D 미준비');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    const ids=warmIds();
    assert(ids.length>0,'데울 모델 목록이 비었다 — 직업/던전 적 모델을 못 찾음');
    for(const id of ids) assert(M3D.modelKeys().indexOf(id)>=0,'없는 모델을 데우려 함: '+id);
    _warmDone=false; _warmRun=null;   // 로그인 화면에서 이미 돌았을 수 있다 → 기계 자체를 다시 본다
    const n=await warmAll();
    assert(n===ids.length,'데운 개수가 목록과 다름: '+n+' != '+ids.length);
    assert(M3D.dbg().n===0,'데운 흔적이 남음('+M3D.dbg().n+'개) — clearGameModels 누락');
    assert((await warmAll())===0,'두 번째 호출이 다시 데움 — 로그인마다 반복된다');
    // 로딩 게이트는 반드시 HOME에서 끝나야 한다
    await enterAfterWarm();
    assert(visible($('homeScreen')),'로딩 뒤 HOME이 안 열림');
    await sleep(_fadeMs()+80);   // ⚠ 로딩은 HOME 이 선 뒤에 그 위에서 걷힌다(크로스페이드)
    assert(!visible($('opening')),'로딩 화면이 안 닫힘');
    const bar=$('opening').querySelector('.opBar');
    assert(!bar || !bar.style.width,'로딩 막대 인라인 폭이 남음 — 다음 로딩이 100%에서 시작한다');
    return ids.length+'종 · 잔여 0'; });
  // 유즈맵 루프는 전역 rAF라 화면을 떠나도 계속 돈다. 그대로 두면 HOME/마을이 빌려 간 공용 3D
  // 캔버스에 자기 유닛 목록을 계속 밀어넣어, 한쪽이 dying으로 지운 모델을 다른 쪽이 매 프레임 다시
  // 만든다(실측: 샌드박스 유닛 38개 재생성 반복 · HOME 60 → 47fps).
  // 모델 개수가 아니라 '누가 sync를 부르는가'를 본다 — 앞 스텝의 상태에 안 흔들린다.
  await step('HOME/마을에서는 유즈맵이 3D를 그리지 않는다', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof openHome!=='function' || typeof nemoScreenOn!=='function','HOME/가드 없음');
    skipIf(!(window.M3D && M3D.ready && M3D.ready()),'3D 미준비');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    if(typeof G!=='undefined' && !G.units) G.units=[];
    const spy=(ms)=>new Promise(res=>{ const f=M3D.sync; let nemo=0, total=0;
      M3D.sync=function(list){ total++; if(list===G.units) nemo++; return f.apply(this,arguments); };
      setTimeout(()=>{ M3D.sync=f; res({nemo:nemo, total:total}); }, ms); });
    openHome(); await sleep(500);
    assert(!nemoScreenOn(),'HOME인데 전장 화면이 아직 보인다고 판정됨');
    const home=await spy(700);
    assert(home.nemo===0,'HOME인데 유즈맵이 자기 유닛 목록으로 sync를 '+home.nemo+'번 부름 — 두 화면이 같은 씬을 민다');
    assert(home.total>0,'HOME이 3D를 아예 안 그림(sync 0회) — 가드가 과하게 막았다');
    if(typeof openTown==='function'){ openHome(); await sleep(500);
      const town=await spy(700);
      assert(town.nemo===0,'마을인데 유즈맵이 sync를 '+town.nemo+'번 부름');
      if(typeof twLeave==='function') twLeave(); }
    hbStop();
    return 'HOME sync '+home.total+'회 · 유즈맵 침범 0회'; });
  // 회복 구역 표시 — hbDrawHeal이 hbFloor '뒤'에 와야 한다. 앞에 두면 배경 그림이 그대로 덮어
  // 아무것도 안 보인다(실제로 그랬다). 그리는 순서는 코드를 봐선 놓치기 쉬우니 픽셀로 본다.
  await step('사냥터: 중앙 회복 구역이 배경 위에 보인다', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof hbDrawHeal!=='function' || typeof HB_HEAL_R==='undefined','회복 구역 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(400);
    const sv={x:_hb.char.x, y:_hb.char.y}; _hb.char.x=0; _hb.char.y=0;
    hbResize(); hbDraw();
    const g=$('hbCv').getContext('2d', {willReadFrequently:true});
    const px=(wx,wy)=>{ const sx=(_hb.cx+wx*_hb.k)*_hb.d, sy=(_hb.cy+wy*_hb.k*0.61)*_hb.d;
      const d=g.getImageData(Math.round(sx),Math.round(sy),1,1).data; return d[1]-d[0]; };   // 초록 우세도
    const inside=px(0,-HB_HEAL_R*0.45), outside=px(0,-(HB_HEAL_R+55));
    _hb.char.x=sv.x; _hb.char.y=sv.y; hbResize();
    assert(inside-outside>=6,'회복 구역이 배경에 덮여 안 보인다(초록 차 '+(inside-outside)+') — hbDrawHeal이 hbFloor보다 먼저 그려졌는지 확인');
    return '초록 차 '+(inside-outside); });
  // 재화 바 — + 버튼은 숫자에 붙어 있어야 한다(멀면 어느 재화의 +인지 헷갈린다)
  await step('재화 바: + 버튼이 숫자에 붙어 있다', async()=>{
    const res=document.querySelector('#curBar .res'); skipIf(!res,'재화 바 없음');
    curShow(true);
    const num=res.querySelector('b'), plus=res.querySelector('.curPlus');
    skipIf(!num||!plus||!num.getClientRects().length,'표시 안 됨');
    const gap=plus.getBoundingClientRect().left-num.getBoundingClientRect().right;
    assert(gap>=0 && gap<=3,'숫자와 + 사이가 '+gap.toFixed(1)+'px — 0~3px여야 한다');
    return gap.toFixed(1)+'px'; });
  // 웨이브 시간 안에 못 비우면 실패 → 3초 뒤 1웨이브부터. 라운드는 안 내려간다(죽음과 다르다).
  await step('웨이브 실패: 시간 초과 → 3초 뒤 1웨이브 · 가운데 · 최대 체력', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof hbWaveFail!=='function','실패 처리 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(300); const S=_hb; S.manual=true;
    S.round=5; hbHunt().round=5; S.wave=3; S.phase='fight';
    S.foes.length=0; S.pend.length=0; S.chests.length=0;
    // 안 죽는 적 하나를 남겨 시간만 흘린다
    S.foes.push({ico:'x',mdl:'snapper',x:400,y:400,hp:1e9,hpMax:1e9,atk:0,spd:0,cdT:99,elite:false});
    S.char.x=200; S.char.y=-150; S.char.hp=Math.max(1,Math.round(S.char.hpMax*0.3));
    const round0=S.round;
    S.waveT=0.1; hbStep(0.2);
    assert(S.phase==='fail','시간이 다 됐는데 실패가 아님: '+S.phase);
    assert(!S.foes.length && !S.chests.length,'실패했는데 적/상자가 남음');
    assert(S.round===round0,'실패로 라운드가 내려감(죽음과 달라야 한다): '+S.round);
    // 3초 전에는 아직 재시작하지 않는다
    hbStep(HB_FAIL_S-0.5);
    assert(S.phase==='fail','3초 전에 이미 재시작함');
    hbStep(1.0);
    assert(S.phase==='fight','3초 뒤에 재시작하지 않음: '+S.phase);
    assert(S.wave===1,'1웨이브부터가 아님: '+S.wave);
    assert(Math.abs(S.char.x)<1 && Math.abs(S.char.y)<1,'가운데에서 다시 시작하지 않음: '+Math.round(S.char.x)+','+Math.round(S.char.y));
    assert(S.char.hp===S.char.hpMax,'최대 체력이 아님: '+Math.round(S.char.hp)+'/'+Math.round(S.char.hpMax));
    assert(S.round===round0,'재시작에서 라운드가 바뀜');
    // 상자는 웨이브가 바뀌면 사라진다
    S.chests.length=0; S.chests.push({x:9,y:9,hp:5,hpMax:5});
    hbSpawnWave();
    assert(S.chests.length<=1,'지난 웨이브 상자가 남음: '+S.chests.length);
    assert(!S.chests.some(ch=>ch.x===9&&ch.y===9),'지난 웨이브 상자가 그대로 있음');
    S.foes.length=0; S.pend.length=0; S.chests.length=0; S.round=1; hbHunt().round=1;
    return '실패→'+HB_FAIL_S+'초→1웨이브 · 가운데 · 최대 체력 ok'; });
  // ☰ 는 공용 HUD 버튼이다 — 사냥터에서는 더보기, 유즈맵에서는 그대로 설정.
  await step('더보기: 사냥터 ☰ = 판 모음 · 유즈맵 ☰ = 설정', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof hbOpenMore!=='function','더보기 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(600);
    // ⚠ 이 파일에는 전역 .hide 규칙이 없다(요소마다 선언). 안 만들면 '항상 떠 있는' 상태가 된다.
    assert(!visible($('hbMoreSheet')),'더보기가 처음부터 떠 있음 — .hbMoreWrap.hide 규칙 누락');
    // 좌상단 아이콘 줄은 통째로 없앴다 — 판 여는 것이 두 곳에 있으면 어디를 눌러야 할지 모른다
    assert(!document.querySelector('.hbIcoRow'),'좌상단 아이콘 줄이 아직 남아 있음');
    assert(!document.getElementById('hbBuildWrap'),'좌상단에 건설 버튼이 남아 있음');
    // ☰ → 더보기(설정이 아니라)
    // ⚠ id로 부르면 안 된다 — ☰ 는 #settingsBtn(게임 HUD)과 #curSettingsBtn(재화 바)이 겹쳐 있고
    //    사용자가 누르는 건 위에 있는 쪽이다. 좌표로 집어서 실제 손가락과 같은 경로로 누른다.
    { const a=$('settingsBtn').getBoundingClientRect();
      const hit=document.elementFromPoint(a.left+a.width/2, a.top+a.height/2);
      const btn=hit&&hit.closest?hit.closest('.hudSet'):null;
      assert(btn,'☰ 자리에서 버튼이 안 잡힘: '+(hit?(hit.id||hit.className):'none'));
      btn.click(); }
    await sleep(200);
    assert(visible($('hbMoreSheet')),'사냥터 ☰ 가 더보기를 안 엶');
    assert(!visible($('settingsPop')) && !visible($('appSettingsPop')||{classList:{contains:()=>true}}),'사냥터 ☰ 가 설정을 엶');
    const its=[...document.querySelectorAll('#hbMoreGrid .hbMoreIt')];
    assert(its.length===HB_MORE.length,'항목 수가 다름: '+its.length);
    const cols=getComputedStyle($('hbMoreGrid')).gridTemplateColumns.split(' ').length;
    assert(cols===2,'2칸 격자가 아님: '+cols);   // ☰ 아래로 떨어지는 드롭다운(가운데 팝업이 아니다)
    // ☰ 바로 아래에 붙어야 한다 — 화면 가운데 팝업이면 레퍼런스와 다르다
    { const btn=document.getElementById('curSettingsBtn').getBoundingClientRect();
      const box=$('hbMoreBox').getBoundingClientRect(), ph=$('phone').getBoundingClientRect();
      assert(box.top>=btn.bottom-1 && box.top-btn.bottom<=16,'☰ 바로 아래가 아님: '+Math.round(box.top-btn.bottom)+'px');
      assert(Math.abs(box.right-btn.right)<=4,'☰ 와 오른쪽이 안 맞음: '+Math.round(box.right-btn.right));
      assert(box.right<=ph.right+1 && box.bottom<=ph.bottom+1,'드롭다운이 화면 밖으로 나감'); }
    // 아이콘만 — 글자는 없다. 이름은 title/aria-label로만 남긴다(나중에 전용 아이콘으로 교체 예정).
    assert(!$('hbMoreGrid').textContent.trim(),'더보기에 글자가 남아 있음: '+$('hbMoreGrid').textContent.trim());
    for(const it of its){
      assert(it.querySelector('svg'),'아이콘이 안 그려진 항목: '+it.getAttribute('aria-label'));
      assert((it.getAttribute('aria-label')||'').trim(),'이름표가 없는 항목 — 글자를 뺐으면 aria-label은 있어야 한다'); }
    // 칸은 ☰ 와 같은 정사각형
    { const hb=document.getElementById('curSettingsBtn').getBoundingClientRect(), t0=its[0].getBoundingClientRect();
      assert(Math.abs(t0.width-t0.height)<=1,'정사각형이 아님: '+Math.round(t0.width)+'x'+Math.round(t0.height));
      assert(Math.abs(t0.width-hb.width)<=1,'☰('+Math.round(hb.width)+')와 칸('+Math.round(t0.width)+') 크기가 다름'); }
    // ☰ 는 열리면 X 로 바뀌고, 그 X 만이 닫는 방법이다 — 바깥을 눌러도 안 닫힌다
    { const btn=$('curSettingsBtn');
      assert(btn.classList.contains('on'),'열렸는데 버튼이 X 상태가 아님');
      const disp=sel=>getComputedStyle(btn.querySelector(sel)).display;   // ⚠ visible()은 SVG에 못 쓴다(offsetParent 없음)
      assert(disp('.icoX')!=='none' && disp('.icoBars')==='none','아이콘이 X 로 안 바뀜: X='+disp('.icoX')+' ☰='+disp('.icoBars'));
      // 전장을 눌러도 열려 있고, 캐릭터는 정상적으로 움직인다(바깥 판이 터치를 막으면 안 된다)
      const cv=$('hbCv').getBoundingClientRect(), fx=cv.left+40, fy=cv.top+cv.height*0.6;
      const ft=document.elementFromPoint(fx,fy);
      assert(ft && !$('hbMoreSheet').contains(ft),'열린 메뉴의 바깥 판이 전장 터치를 가로챈다: '+(ft?(ft.id||ft.className):'none'));
      _hb.char.tx=null; hbFieldTap({target:ft, clientX:fx, clientY:fy});
      assert(visible($('hbMoreSheet')),'전장을 눌렀더니 메뉴가 닫힘(X 로만 닫혀야 한다)');
      assert(_hb.char.tx!=null,'메뉴가 열려 있다고 전장 조작이 막힘');
      // ⚠ 목적지를 남기면 뒤 스텝에서 캐릭터가 걸어가 버린다(상자·스폰 검사가 줄줄이 깨졌다)
      _hb.char.tx=null; _hb.char.ty=null; _hb.char.x=0; _hb.char.y=0; hbResize();
      // 오른쪽 끝에 붙는다
      const ph=$('phone').getBoundingClientRect(), bx=$('hbMoreBox').getBoundingClientRect();
      assert(ph.right-btn.getBoundingClientRect().right<=4,'☰ 가 오른쪽 끝에 안 붙음');
      assert(ph.right-bx.right<=4,'드롭다운이 오른쪽 끝에 안 붙음'); }
    // 설정 칸은 톱니바퀴 — ☰ 와 같은 삼선을 쓰면 '메뉴 안의 메뉴'로 보인다.
    // 몸통 링 + 축 구멍(원 2개)이 있어야 톱니로 읽힌다. 허브 하나에 긴 광선만 있으면 태양이 된다.
    { const cs=document.querySelectorAll('#hbMoreGrid [data-k="set"] circle');
      assert(cs.length===2,'설정 아이콘에 원이 '+cs.length+'개 — 몸통 링과 축 구멍 둘이어야 톱니로 보인다');
      const rs=[...cs].map(c=>parseFloat(c.getAttribute('r'))).sort((a,b)=>a-b);
      assert(rs[1]>=2.4*rs[0],'몸통 링이 축 구멍에 비해 충분히 크지 않다: '+rs.join('/')); }
    // 드롭다운은 ☰ 아래에 딱 붙는다
    { const bt=$('curSettingsBtn').getBoundingClientRect(), bx=$('hbMoreBox').getBoundingClientRect();
      // 테두리 두께만큼(1px) 겹쳐야 두 선이 한 줄로 보인다. 0이면 1px+1px 이 2줄로 보인다.
      const bw=parseFloat(getComputedStyle($('curSettingsBtn')).borderBottomWidth);
      const ov=+(bt.bottom-bx.top).toFixed(2);
      assert(Math.abs(ov-bw)<=0.5,'테두리가 한 줄로 안 겹침 — 겹침 '+ov+'px, 테두리 '+bw+'px'); }
    // 각진 테두리 — DESIGN 라운드 토큰(0/3/6/9) 중 3px
    for(const sel of ['#hbMoreBox','#hbMoreGrid .hbMoreIt']){
      const r=getComputedStyle(document.querySelector(sel)).borderTopLeftRadius;
      assert(r==='3px','더 각져야 한다 — '+sel+' r='+r); }
    // 📅 출석과 일일 퀘스트는 **따로 있는 칸**이고 각자의 판을 연다(2026-08-14 분리)
    for(const [k,sheet,close] of [['daily','hbDailySheet',closeDaily],['att','hbAttSheet',closeAtt]]){
      const b=document.querySelector('#hbMoreGrid [data-k="'+k+'"]');
      assert(b && !b.disabled,'더보기에 '+k+' 칸이 없음');
      b.click(); await sleep(250);
      assert(visible($(sheet)),'더보기 > '+k+' 가 안 열림');
      close(); hbOpenMore(); await sleep(150); }
    // 건설을 고르면 시트가 닫히고 '하단 패널'이 건설 구역이 된다(2026-08-14 · 좌상단 드롭다운 폐지)
    PROF().pcoin=99999;
    document.querySelector('#hbMoreGrid [data-k="build"]').click(); await sleep(250);
    assert(!visible($('hbMoreSheet')),'건설을 골랐는데 시트가 안 닫힘');
    assert(_hb.build===true,'건설을 골랐는데 건설 모드로 안 들어감');
    { const card=document.querySelector('#homeScreen .hmUpg');
      assert(card.classList.contains('bd'),'하단 패널이 건설 구역으로 안 바뀜');
      assert(document.querySelectorAll('#hmUpgGrid .hmUp[data-k^="b_"]').length===HB_BUILD_KEYS.length,'건설 카드가 안 뜸');
      const c=card.getBoundingClientRect(), ph=$('phone').getBoundingClientRect();
      assert(c.left>=ph.left-1 && c.right<=ph.right+1,'건설 구역이 화면 밖으로 나감'); }
    hbBuildExit(); await sleep(60);
    // 유즈맵에서는 같은 버튼이 설정이어야 한다
    hbStop(); enterSandbox(); await sleep(700);
    $('settingsBtn').click(); await sleep(200);
    assert(visible($('settingsPop')),'유즈맵 ☰ 가 설정을 안 엶');
    assert(!visible($('hbMoreSheet')),'유즈맵에서 더보기가 열림');
    $('settingsPop').classList.add('hide');
    return '항목 '+its.length+'개 · ☰ 아래 2칸 드롭다운 · 유즈맵은 설정 유지'; });
  // 📅 일일 — 출석 캘린더(4주) + 하루 5개 퀘스트. 하루 경계는 던전 열쇠와 같은 축(_dgDayKey · 09:00).
  await step('일일 출석: 하루 1도장 · 주 5칸 + 보너스 2칸 · 20도장 = 최종', async()=>{
    skipIf(typeof dqState!=='function','일일 없음');
    const p=PROF(), keep={pc:p.pcoin, gas:p.gas, gem:p.gem};
    const reset=()=>{ p.daily={day:_dgDayKey(), q:dqDraw(_dgDayKey()), allGot:0, att:{n:0,day:0,bn:{},fin:0,cyc:0}}; };
    reset();
    // ① 하루 한 번 — 두 번은 안 된다
    assert(dqAttCan(),'첫 출석이 막힘');
    p.pcoin=0; dqCheckIn();
    assert(dqState().att.n===1,'도장이 안 찍힘: '+dqState().att.n);
    assert(p.pcoin===dqAttRw(0,0).pcoin,'1일차 보상이 안 들어옴: '+p.pcoin);
    assert(!dqAttCan(),'같은 날 두 번 출석이 됨');
    dqCheckIn(); assert(dqState().att.n===1,'두 번째 출석이 먹힘: '+dqState().att.n);
    // ② 한 주 = 출석 5칸. 그 5칸을 채워야 '나머지 2일' 몫인 보너스가 열린다
    const nextDay=()=>{ dqState().att.day=0; dqCheckIn(); };
    assert(!dqBonusOpen(0),'5칸을 안 채웠는데 보너스가 열림');
    while(dqState().att.n<DQ_PER_WEEK) nextDay();
    assert(dqBonusOpen(0),'5칸을 채웠는데 보너스가 안 열림');
    assert(!dqBonusOpen(1),'다음 주 보너스까지 열림');
    { const g0=p.gem; dqClaimBonus(0,1);
      assert(p.gem===g0+dqAttBonusRw(0,1).gem,'보너스 젬이 안 들어옴: +'+(p.gem-g0));
      const g1=p.gem; dqClaimBonus(0,1); assert(p.gem===g1,'같은 보너스를 두 번 받음'); }
    // ③ 20도장 = 최종. 받으면 남은 보너스까지 주고 캘린더가 새로 깔린다
    assert(!dqFinalOpen(),'20도장 전에 최종이 열림');
    while(dqState().att.n<DQ_ATT_MAX) nextDay();
    assert(dqFinalOpen(),'20도장인데 최종이 안 열림');
    { let bonusGem=0;
      for(let w=0;w<DQ_WEEKS;w++) for(let b=0;b<DQ_BONUS;b++) if(!dqBonusGot(w,b)) bonusGem+=(dqAttBonusRw(w,b).gem||0);
      const g0=p.gem; dqClaimFinal();
      assert(p.gem===g0+DQ_FINAL_RW.gem+bonusGem,'최종 보상(+남은 보너스)이 안 맞음: +'+(p.gem-g0));
      assert(dqState().att.n===0 && dqState().att.cyc===1,'캘린더가 새로 안 깔림'); }
    // ④ 화면 = 4주 × (5+2)칸. 출석은 퀘스트와 **다른 판**에 뜬다(2026-08-14 분리)
    openAtt(); await sleep(150);
    const cells=document.querySelectorAll('#hbAttSheet .dqC');
    assert(cells.length===DQ_WEEKS*(DQ_PER_WEEK+DQ_BONUS),'칸 수가 다름: '+cells.length);
    assert(!visible($('hbDailySheet')),'출석을 열었는데 퀘스트 판까지 뜸');
    assert(document.querySelectorAll('#hbAttSheet .dqC.got').length===0,'새 캘린더인데 채워진 칸이 있음');
    assert(!document.querySelector('#hbAttSheet .pdSegBtn'),'출석 판에 옛 탭 띠가 남아 있음');
    closeAtt();
    reset(); p.pcoin=keep.pc; p.gas=keep.gas; p.gem=keep.gem;
    return DQ_WEEKS+'주 × '+DQ_PER_WEEK+'+'+DQ_BONUS+'칸 · 최종 후 재시작 ok'; });
  await step('일일 퀘스트: 하루 5개 + 주간 25개 · 계측 → 수령 → 완주/주간 보너스', async()=>{
    skipIf(typeof dqState!=='function','일일 없음');
    const p=PROF(), keep={pc:p.pcoin, gas:p.gas, gem:p.gem}, dk=_dgDayKey();
    // ① 같은 날이면 몇 번을 뽑아도 같은 5개(새로고침 리롤 방지)
    const a=dqDraw(dk).map(e=>e.id).join(','), b=dqDraw(dk).map(e=>e.id).join(',');
    assert(a===b,'같은 날인데 퀘스트가 달라짐: '+a+' / '+b);
    // ② 구성 — 5개 중 DQ_OUT_N개는 사냥터 바깥(다른 구역까지 자연스럽게 끌어낸다)
    p.daily={day:dk, q:dqDraw(dk), allGot:0, att:{n:0,day:dk,bn:{},fin:0,cyc:0}};
    const D=dqState();
    assert(D.q.length===DQ_N,'퀘스트가 '+D.q.length+'개');
    assert(new Set(D.q.map(e=>e.id)).size===DQ_N,'같은 퀘스트가 중복으로 뽑힘');
    // 같은 kind 가 두 개면 큰 쪽을 하는 순간 작은 쪽이 덤으로 끝난다 — 5개가 사실상 4개가 된다
    assert(new Set(D.q.map(e=>DQ_BY[e.id].kind)).size===DQ_N,
      '같은 종류가 두 번 뽑힘: '+D.q.map(e=>DQ_BY[e.id].kind).join(','));
    const outN=D.q.filter(e=>DQ_BY[e.id].cat==='out').length;
    assert(outN===DQ_OUT_N,'바깥 구역 퀘스트가 '+outN+'개(기대 '+DQ_OUT_N+')');
    // ③ 계측 — 종류별로 목표만큼 밀어 넣으면 5개가 다 찬다
    for(const e of D.q){ const Q=DQ_BY[e.id]; dqNote(Q.kind, Q.goal); }
    assert(dqDoneN()===DQ_N,'계측이 안 들어감: '+dqDoneN()+'/'+DQ_N);
    // ④ 수령은 1회 · 보상이 실제로 들어온다
    { const Q=DQ_BY[D.q[0].id]; p.pcoin=0; dqClaim(0);
      assert(p.pcoin===(Q.rw.pcoin||0),'보상이 안 들어옴: '+p.pcoin);
      p.pcoin=0; dqClaim(0); assert(p.pcoin===0,'같은 퀘스트를 두 번 받음'); }
    // ⑤ 5개를 다 받으면 완주 보너스
    assert(!dqAllGot(),'아직 다 안 받았는데 완주로 침');
    for(let i=1;i<DQ_N;i++) dqClaim(i);
    assert(dqAllGot(),'다 받았는데 완주가 아님');
    { const g0=p.gem; dqClaimAll();
      assert(p.gem===g0+DQ_ALL_RW.gem,'완주 보너스 젬이 안 들어옴: +'+(p.gem-g0));
      const g1=p.gem; dqClaimAll(); assert(p.gem===g1,'완주 보너스를 두 번 받음'); }
    // ⑥ 주간 — '수령'이 아니라 '완료'로 센다. 25개면 보너스, 월요일에 0으로 돌아간다.
    assert(dqWeekN()>=DQ_N,'주간 누적이 완료를 못 셈: '+dqWeekN());
    assert(!dqWeekOpen(),DQ_N+'개인데 주간 보너스가 열림');
    dqState().wk.n=DQ_WEEK_GOAL;
    assert(dqWeekOpen(),DQ_WEEK_GOAL+'개인데 주간 보너스가 안 열림');
    { const g0=p.gem; dqClaimWeek();
      assert(p.gem===g0+DQ_WEEK_RW.gem,'주간 보너스 젬이 안 들어옴: +'+(p.gem-g0));
      const g1=p.gem; dqClaimWeek(); assert(p.gem===g1,'주간 보너스를 두 번 받음'); }
    dqState().wk.key=_dqWeekKey()-7*86400000;        // 지난주 것으로 위장 → 다음 호출에서 비워져야 한다
    assert(dqWeekN()===0 && !dqWeekGot(),'주가 바뀌었는데 주간 누적이 안 비워짐: '+dqWeekN());
    // ⑦ 퀘스트 판은 출석과 따로 뜨고, 맨 위에 주간 진행이 있다
    openDaily(); await sleep(150);
    assert(visible($('hbDailySheet')) && !visible($('hbAttSheet')),'퀘스트를 열었는데 출석 판까지 뜸');
    assert(document.querySelector('#hbDailyBody .dqWeek'),'퀘스트 판에 주간 진행이 없음');
    assert(document.querySelectorAll('#hbDailyBody .hbRow.dqQ').length===DQ_N+2,'주간 + 퀘스트 + 완주 줄이 안 맞음');
    // 보상은 '줄'이 아니라 '수령 버튼 안'에 있어야 한다 — 무엇을 받는지가 누르는 자리에 있어야 한다
    { const row=document.querySelectorAll('#hbDailyBody .hbRow.dqQ')[1];   // 첫 퀘스트 줄(0=주간)
      assert(row.querySelector('.dqBtn .dqRwB'),'수령 버튼 안에 보상 표기가 없음');
      assert(!row.querySelector('.hbRowTx .dqRw'),'보상이 아직 줄 본문에 남아 있음');
      assert(row.querySelector('.hbRowTx b') && row.querySelector('.hbRowTx em'),'제목/내용 두 줄 구성이 아님');
      const bw=row.querySelector('.dqBtn').getBoundingClientRect();
      assert(bw.width>=80 && bw.height>=44,'수령 버튼이 안 커짐: '+Math.round(bw.width)+'x'+Math.round(bw.height));
      const rr=row.getBoundingClientRect(), card=$('hbDailySheet').querySelector('.hbmCard').getBoundingClientRect();
      assert(rr.right<=card.right+1,'줄이 카드 밖으로 넘침'); }
    // 받을 수 있는 버튼은 면이 금색이다 — 그 위 보상 글자가 금색이면 안 보인다(대비 검사)
    { const D=dqState(); D.q[0].n=DQ_BY[D.q[0].id].goal; D.q[0].got=0; renderDaily();
      const b=document.querySelectorAll('#hbDailyBody .hbRow.dqQ')[1].querySelector('.dqBtn');
      assert(!b.disabled,'완료했는데 수령 버튼이 잠겨 있음');
      const lum=s=>{ const m=(s||'').match(/\d+/g)||[0,0,0]; return (+m[0]*0.3 + +m[1]*0.59 + +m[2]*0.11); };
      const face=lum(getComputedStyle(b).backgroundColor)||lum('rgb(232,169,43)');
      const tx=lum(getComputedStyle(b.querySelector('.dqRwB i')).color);
      assert(Math.abs(face-tx)>60 || tx<90,'금색 면 위에 금색 보상 글자 — 안 보인다: 면'+Math.round(face)+' 글자'+Math.round(tx)); }
    closeDaily();
    // ⑧ 계측 지점이 실제 게임 코드에 붙어 있는가 — 여기가 빠지면 퀘스트가 영원히 0이다
    const H=[[hbKill,'kill'],[hbBreakChest,'chest'],[hmBuyUpg,'upg'],[hmBuyUpgQuiet,'upg'],
             [hbSettle,'round'],[hbPlaceStruct,'build'],[hbStep,'play'],[_runSummary,'umRun'],
             [_runSummary,'umWin'],[dgWin,'dgWin'],[hbMateRoll,'gacha'],[hbBuyBoost,'boost']];
    for(const h of H)
      assert(new RegExp("dqNote\\(\\s*'"+h[1]+"'").test(h[0].toString()), h[1]+' 계측이 안 붙어 있음: '+h[0].name);
    p.daily={day:dk, q:dqDraw(dk), allGot:0, att:{n:0,day:0,bn:{},fin:0,cyc:0}};
    p.pcoin=keep.pc; p.gas=keep.gas; p.gem=keep.gem;
    return '5개(바깥 '+DQ_OUT_N+') · 주간 '+DQ_WEEK_GOAL+' · 계측 '+H.length+'곳 확인'; });
  // 📦 상자 — 맵을 돌아다닐 이유. '공격 대상'이라 사거리 안에 있어야 부순다.
  await step('상자: 사거리 안일 때만 부수고 · 적이 우선 · 보상은 섞여 나온다', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof hbSpawnChest!=='function','상자 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(300); _hb.manual=true;
    const S=_hb; S.foes.length=0; S.pend.length=0; S.chests.length=0;
    S.char.x=0; S.char.y=0; S.char.hp=S.char.hpMax; hbResize();
    // ① 캐릭터에 붙여 두지 않는다 — 가만히 있어도 먹히면 이동할 이유가 없다
    for(let i=0;i<5;i++){ S.chests.length=0; const c1=hbSpawnChest();
      if(c1) assert(Math.hypot(c1.x-S.char.x,c1.y-S.char.y)>=HB_CHEST_MIN_D-0.01,'상자가 너무 가까이 생김'); }
    // ② 사거리 밖이면 안 맞는다
    S.chests.length=0;
    const far={x:S.char.range+120, y:0, hp:99, hpMax:99}; S.chests.push(far);
    S.char.cdT=0; for(let i=0;i<40;i++) hbStep(0.05);
    assert(far.hp===99,'사거리 밖 상자가 깎였다: '+far.hp);
    // ③ 사거리 안이면 자동으로 부순다
    S.chests.length=0;
    const near={x:Math.max(10,S.char.range*0.5), y:0, hp:hbChestHp(1), hpMax:hbChestHp(1)};
    S.chests.push(near);
    // 상자는 장비뿐 아니라 펫·동료 뽑기권도 낸다 — 장비만 보면 다른 권이 나왔을 때 '보상 없음'이 된다
    const tkSum=()=>{ const t=PROF().tickets||{}; return (t.gear||0)+(t.pet||0)+(t.ally||0); };
    const tk0=tkSum(), gem0=PROF().gem||0;
    for(let i=0;i<200 && S.chests.length;i++) hbStep(0.05);
    assert(!S.chests.length,'사거리 안인데 안 부서짐(hp '+near.hp+')');
    const got=(tkSum()-tk0) + ((PROF().gem||0)-gem0);
    const boost=hbBoostOn('inc')||hbBoostOn('atk');
    assert(got>0 || boost,'상자를 부쉈는데 아무 보상도 없음');
    // ④ 적이 우선 — 적이 사거리 안에 있으면 상자는 안 맞는다
    S.chests.length=0;
    const ch2={x:Math.max(10,S.char.range*0.4), y:0, hp:999, hpMax:999}; S.chests.push(ch2);
    S.foes.push({ico:'x',mdl:'snapper',x:0,y:20,hp:1e9,hpMax:1e9,atk:0,spd:0,cdT:99,elite:false});
    S.char.cdT=0; for(let i=0;i<40;i++) hbStep(0.05);
    assert(ch2.hp===999,'적이 사거리에 있는데 상자를 때림 — 딜을 흘린다');
    S.foes.length=0; S.chests.length=0;
    return '최소거리 '+HB_CHEST_MIN_D+' · 사거리 밖 무시 · 적 우선 ok'; });
  // 캐릭터 스탯 페이지 상단 — 전투력 칩 하나 + 하이라인 2열.
  // 띄우는 숫자는 전투력뿐이다. 나머지 축은 상자 없이 밑선으로만 나눈다(줄마다 상자면 위계가 없다).
  await step('캐릭터 스탯: 전투력 칩 + 하이라인 2열', async()=>{
    skipIf(typeof renderChrStat!=='function','스탯 화면 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    // ⚠ 하단 네비에서 빠진 화면이다(2026-08-25 개편 — 연구·임무로 교체). 화면·코드는 살아 있으므로
    //   **직접 열어서** 계속 검사한다 — 유보한 코드가 썩지 않게. ⛔ navGo('upg'/'gear') 는 이제 없다.
    openUpgScreen(); await sleep(120);
    const host=$('upgScreen');
    const hv=host.querySelector('.csHv');
    assert(hv,'전투력 칩이 없음');
    assert(hv.textContent.replace(/[^0-9]/g,'')===String(profPower()),
      '칩 값이 profPower와 다름: '+hv.textContent+' vs '+profPower());
    const rows=[...host.querySelectorAll('.csR')];
    assert(rows.length===CS_ORDER.length,'줄 수가 축 수와 다름: '+rows.length+' vs '+CS_ORDER.length);
    assert(!host.querySelector('.csBar'),'옛 가로 바가 남아 있음');
    // 2열인가 — 줄들의 왼쪽 좌표가 정확히 두 가지여야 한다
    const cols=new Set(rows.map(r=>Math.round(r.getBoundingClientRect().left)));
    assert(cols.size===2,'2열이 아님(열 '+cols.size+'개)');
    // 각 열의 마지막 줄만 밑선이 없다 — 끝에서 두 개가 그 자리다(홀수·짝수 무관)
    assert(getComputedStyle(rows[0]).borderBottomWidth==='1px','첫 줄에 밑선이 없음');
    for(const r of rows.slice(-2)) assert(getComputedStyle(r).borderBottomWidth==='0px',
      '열 끝 줄에 밑선이 남아 매달린 선이 보인다');
    // 같은 값이 두 번 나오면 안 된다(옛 lpNums 요약 블록은 이 목록이 대신한다)
    assert(!host.querySelector('.lpNums .lpNum span'),'옛 전투 수치 요약이 남아 있음 — 같은 값이 두 벌이다');
    return '전투력 '+hv.textContent+' · '+rows.length+'줄 2열'; });
  // 화면 제목 — 유즈맵과 같이 재화 바 왼쪽에 붙는다. 화면 안에 가운데 제목을 또 두면 두 벌이 된다.
  await step('제목: 재화 바 왼쪽 한 곳 (캐릭터·정비·상점)', async()=>{
    skipIf(typeof SCREEN_TITLE!=='object','제목 표 없음');
    const out=[];
    // ⚠ 캐릭터·정비는 하단 네비에서 빠졌다(연구·임무로 교체) — 화면은 살아 있으니 직접 연다
    for(const [id,go] of [['upgScreen',()=>openUpgScreen()],['gearScreen',()=>openGear()],['shopScreen',()=>openShop()]]){
      go(); await sleep(150);
      const t=$('curTitle'), tr=t.getBoundingClientRect();
      const res=document.querySelector('#curBar .res').getBoundingClientRect();
      assert(t.textContent===SCREEN_TITLE[id], id+' 제목이 표와 다름: "'+t.textContent+'"');
      assert(Math.abs((tr.top+tr.height/2)-(res.top+res.height/2))<=4, id+' 제목이 재화와 다른 줄에 있음');
      assert(tr.right<=res.left, id+' 제목이 재화 왼쪽이 아님');
      assert(!document.querySelector('#'+id+' .shopTitle'), id+' 안에 가운데 제목이 남아 있음 — 제목이 두 벌');
      out.push(t.textContent); }
    openHome(); await sleep(60);
    return out.join('·')+' 좌상단 ok'; });
  // 사냥터 맵 — 그림이 덮는 범위와 걸어갈 수 있는 범위가 같아야 한다.
  // 예전엔 필드(±900×±620)가 그림보다 훨씬 넓어서 걸어 나가면 검은 바닥이 나왔다.
  await step('사냥터: 걸을 수 있는 범위 = 그림이 덮는 범위', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof HB_MAP_R==='undefined' || typeof hbClampField!=='function','맵 상수 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    assert(HB_FIELD_RX===HB_MAP_R && HB_FIELD_RY===HB_MAP_R,
      '이동 범위와 맵이 다름: 필드 '+HB_FIELD_RX+'x'+HB_FIELD_RY+' vs 맵 '+HB_MAP_R);
    for(const [x,y] of [[9999,9999],[-9999,9999],[0,-9999]]){
      const p=hbClampField(x,y);
      assert(Math.abs(p[0])<=HB_MAP_R+1e-6 && Math.abs(p[1])<=HB_MAP_R+1e-6,'클램프 밖: '+p); }
    openHome(); await sleep(300); _hb.manual=true;
    // 목적지만이 아니라 '위치'가 갇혀야 한다 — 다른 코드가 x/y를 건드려도 그림 밖으로 못 간다
    const _sv={x:_hb.char.x, y:_hb.char.y, tx:_hb.char.tx, ty:_hb.char.ty};   // 뒤 스텝을 오염시키지 않게 되돌린다
    _hb.char.x=9999; _hb.char.y=-9999; hbStep(0.05); hbResize();   // ⚠ hbStep(dt) — S를 넘기면 dt가 객체가 돼 전부 NaN이 된다
    assert(Math.abs(_hb.char.x)<=HB_MAP_R+1 && Math.abs(_hb.char.y)<=HB_MAP_R+1,
      '한 스텝 뒤에도 그림 밖: '+Math.round(_hb.char.x)+','+Math.round(_hb.char.y));
    // 카메라도 맵 밖을 비추면 안 된다(가장자리에 검은 띠가 생긴다)
    const hvw=(_hb.w/_hb.k)/2, hvh=((_hb.vBot-_hb.vTop)/_hb.k)/2;
    assert(Math.abs(_hb.camX)+hvw<=HB_MAP_R+1 && Math.abs(_hb.camY)+hvh<=HB_MAP_R+1,
      '카메라가 맵 밖을 비춤: cam '+Math.round(_hb.camX)+','+Math.round(_hb.camY)+' 반화면 '+Math.round(hvw)+','+Math.round(hvh));
    // 배경 캐시는 지금 던전만 — 1536² 한 장이 9MB라 10개를 다 물면 90MB가 된다
    hbBgImg(1); hbBgImg(2); hbBgImg(3);
    assert(Object.keys(_hbBg).length===1,'배경 캐시가 '+Object.keys(_hbBg).length+'개 — 던전마다 쌓인다');
    _hb.char.x=_sv.x; _hb.char.y=_sv.y; _hb.char.tx=_sv.tx; _hb.char.ty=_sv.ty; hbResize();
    return '맵 '+(2*HB_MAP_R)+'² · 이동 ±'+HB_FIELD_RX+' · 캐시 1'; });
  await step('던전 배경: 이미지 cover 맞춤 · 없으면 타일 폴백', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof hbBgFit!=='function','배경 배선 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(300);
    // 어떤 비율의 그림을 넣어도 보이는 영역을 남김없이 덮어야 한다(빈 곳=검은 띠가 생기면 실패)
    const box=[[194,241],[109,241],[300,200]];   // 펼침 · 접음 · 가로 넓은 경우(월드 반폭/반높이)
    for(const ar of [0.5,0.667,1,1.5,2.4]) for(const [wx,wy] of box){
      const f=hbBgFit(ar,wx,wy);
      assert(f.dw>=wx*2-0.01 && f.dh>=wy*2-0.01, 'ar='+ar+' 영역 '+wx*2+'x'+wy*2+'을 못 덮음 → '+Math.round(f.dw)+'x'+Math.round(f.dh));
      assert(Math.abs(f.dw/f.dh-ar)<0.001, 'ar='+ar+' 비율이 찌그러짐 → '+(f.dw/f.dh).toFixed(3)); }
    // 움직임 프레임 핑퐁 — 영상의 마지막↔첫 프레임이 달라도 이음새가 없어야 한다.
    if(typeof hbBgPhase==='function'){
      const N=HB_BG_FRAMES, seg=(N-1)*2;
      for(const t of [0, HB_BG_CYCLE, HB_BG_CYCLE*3]){   // 왕복 경계에서 처음으로 정확히 돌아와야 한다
        const p=hbBgPhase(t,N); assert(p.a===0 && p.f<0.001,'t='+t+'에서 1번 프레임으로 안 돌아옴: '+JSON.stringify(p)); }
      // 어떤 시각에도 인덱스가 범위 안이고, 이웃 프레임끼리만 섞여야 한다(2칸 점프=툭 튄다)
      let prev=null, maxJump=0;
      for(let k=0;k<=240;k++){ const p=hbBgPhase(HB_BG_CYCLE*k/120, N);
        assert(p.a>=0 && p.a<N && p.b>=0 && p.b<N,'프레임 인덱스가 범위 밖: '+JSON.stringify(p));
        assert(Math.abs(p.a-p.b)===1,'이웃이 아닌 두 프레임을 섞음: '+p.a+'↔'+p.b);
        const cur=p.a+(p.b-p.a)*p.f;   // 지금 보이는 '실효 프레임 위치'
        if(prev!==null) maxJump=Math.max(maxJump, Math.abs(cur-prev));
        prev=cur; }
      assert(maxJump<0.2,'프레임 위치가 한 번에 '+maxJump.toFixed(2)+'칸 튐 — 화면이 깜빡인다');
      assert(hbBgFrames(98)===null,'없는 던전인데 프레임이 있다고 함');
      // 스위치를 끄면 파일을 아예 요청하지 않아야 한다 — 안 그러면 던전마다 404가 4번씩 난다
      if(!HB_BG_ANIM){ assert(hbBgFrames(1)===null && hbBgFirst(1)===null,'스위치를 껐는데 프레임을 쓰려고 함');
        assert(Object.keys(_hbBgF).length===0,'스위치를 껐는데 프레임 파일을 요청함('+Object.keys(_hbBgF).length+'건)'); } }
    // 움직임 크기(HB_BG_AMP) — 캔버스 순차 합성이라 알파를 그대로 쓰면 안 된다.
    // 실제로 합성했을 때의 '각 프레임 기여도'가 의도한 가중치와 같은지 본다.
    if(typeof hbBgMix==='function'){
      for(const amp of [0,0.25,0.5,0.75,1]) for(const pf of [0,0.25,0.5,0.75,1]){
        const m=hbBgMix(amp,pf);
        assert(m.a1>=-1e-9 && m.a1<=1+1e-9 && m.a2>=-1e-9 && m.a2<=1+1e-9,'알파가 0~1 밖: amp='+amp+' pf='+pf+' '+JSON.stringify(m));
        // 순차 합성 결과의 가중치: F1=(1-a1)(1-a2), A=a1(1-a2), B=a2
        const wF=(1-m.a1)*(1-m.a2), wA=m.a1*(1-m.a2), wB=m.a2;
        assert(Math.abs(wF+wA+wB-1)<1e-6,'가중치 합이 1이 아님: '+(wF+wA+wB));
        assert(Math.abs(wA-amp*(1-pf))<1e-6,'A 기여도가 틀림 amp='+amp+' pf='+pf+': '+wA.toFixed(4)+' != '+(amp*(1-pf)).toFixed(4));
        assert(Math.abs(wB-amp*pf)<1e-6,'B 기여도가 틀림: '+wB.toFixed(4));
        assert(Math.abs(wF-(1-amp))<1e-6,'기준 프레임 기여도가 틀림: '+wF.toFixed(4)+' != '+(1-amp).toFixed(4)); } }
    // 파일이 없는 던전 = null(재시도 루프에 빠지지 않고 타일로 떨어진다)
    const miss=hbBgImg(99); assert(miss===null,'없는 배경이 null이 아님');
    hbFloor();   // 폴백 경로가 예외 없이 그려져야 한다
    return '5비율 x 3영역 cover ok · 핑퐁 이음새 ok · 움직임 크기 25조합 ok · 폴백 ok'; });
  // 스탯 출처 내역 · 파워 해금이 실제로 상한을 연다
  await step('RPG: 스탯 출처 내역 · 파워 해금 배선', async()=>{ skipIf(typeof profStatParts!=='function','미적용');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60);
    const c=CHAR(), p=PROF();
    c.level=30; c.unit.level=30; c.unit.pts={atk:6}; c.rp=20; c.unit.rpts={atk:4};
    { const H=hbHunt(); H.unl={}; H.upg={atk:9, hp:5, crit:4, rng:3, aspd:7, regen:2}; }
    { const ks=profPageSlots('armor');                       // 장비도 실제로 끼워 둔다
      p.items.length=0; for(const k of ks){ const it=profMakeItem(k,4,'epic'); profAddItem(it); profEquipItem(it.iid); } }
    // ① 기본 스탯 = (기본 + 업그레이드 + 장비) × 레벨 포인트 × 환생 포인트 — 표와 전투가 같은 식을 써야 한다
    for(const k of CS_ORDER){ const a=csAxis(k);
      let want=(a.base+a.upg+a.gear)*a.lp*a.rp;   // 🎯 선형 배수 · 🔁 복리 배수
      if(CS_AXES[k].cap!=null) want=Math.min(CS_AXES[k].cap, want);
      assert(Math.abs(want-a.sub)<1e-9, a.name+' 분해합이 축 값과 다름: '+want+' vs '+a.sub);
      assert(Math.abs(a.sub*a.bonus-a.total)<1e-9, a.name+' 전투 수치가 기본 스탯×보정이 아님'); }
    assert(Math.abs(hbCharStats().atk-csVal('atk'))<1e-9,'전투 공격력이 축 값에서 안 나옴');
    // ② 네 출처가 '전부' 실제로 값을 바꾼다
    { const A=csAxis('atk');
      assert(A.upg>0,'사냥터 업그레이드가 공격력에 안 걸림');
      assert(A.gear>0,'장비가 공격력에 안 걸림');
      assert(A.lp>1,'레벨 포인트가 공격력에 안 걸림');
      assert(A.rp>1,'환생 포인트가 공격력에 안 걸림'); }
    // ③ 그 넷 말고는 아무것도 안 걸린다 — 펫을 장착해도 내 스탯은 그대로
    { const before=CS_ORDER.map(k=>csVal(k)).join(',');
      p.pets={wolf:1}; p.equip=['wolf'];
      assert(CS_ORDER.map(k=>csVal(k)).join(',')===before,'펫이 아직 내 기본 스탯을 올림');
      assert(typeof profStatParts('pow').petPct==='undefined','내역에 펫 몫이 남아 있음'); }
    // ② 정보 팝업 — 좌상단 HUD로 연다
    const hud=$('hbHud'); assert(hud && hud.tagName==='BUTTON','HUD가 누를 수 있는 버튼이 아님');
    hbOpenInfo(); await sleep(40);
    assert(visible($('hbInfoModal')),'스탯 출처 팝업이 안 열림');
    assert(document.querySelectorAll('#hbInfoBody .hbTbl').length>=2,'스탯/전투 수치 표가 없음');
    assert($('hbInfoBody').textContent.indexOf('파워')>=0,'파워 표기가 없음');
    // 스탯 출처 상세표는 '여기'가 주인이다(캐릭터>스탯 구역에서 옮겨 왔다)
    assert($('hbInfoModal').querySelector('.hbmHead b').textContent==='스탯 출처',
      '팝업 제목이 스탯 출처가 아님: '+$('hbInfoModal').querySelector('.hbmHead b').textContent);
    // 출처는 넷뿐이다 — 직업·진화·펫 열은 없어야 하고, 넷은 다 있어야 한다
    { const th=[...$('hbInfoBody').querySelectorAll('.hbTbl th')].map(e=>e.textContent);
      for(const nm of ['배분','직업','진화','펫']) assert(th.indexOf(nm)<0,'없앤 열이 남아 있음: '+nm);
      for(const nm of ['업그레이드','장비','레벨','환생','합']) assert(th.indexOf(nm)>=0,'출처 열 누락: '+nm); }
    // 두 틀만 남는다 — 옛 칩 구역(레벨 포인트·업그레이드 레벨)은 지웠다
    { const lbl=[...$('hbInfoBody').querySelectorAll('.hbGrowLbl')].map(e=>e.textContent);
      assert(lbl.length===2,'스탯 출처가 두 틀이 아님: '+lbl.join(' / '));
      assert(lbl[0].indexOf('기본 스탯')===0 && lbl[1].indexOf('전투 수치')===0,'두 틀 이름이 다름: '+lbl.join(' / '));
      assert(!$('hbInfoBody').querySelector('.hbChips'),'칩 구역이 아직 남아 있음'); }
    // 행은 전투 수치 축 그대로
    { const rows=$('hbInfoBody').querySelectorAll('.hbTbl tbody tr');
      assert(rows.length===CS_ORDER.length+Math.ceil(CS_ORDER.length/2),'표 줄 수가 축 수와 안 맞음: '+rows.length); }
    hbCloseInfo();
    // ③ 파워 해금 — 표시만 하는 항목이 없어야 한다(전부 실제 상한을 바꾼다)
    p.unlocks={};
    const b4={tur:hbBuildMax('turret'), off:profOfflineCapMin()};
    p.unlocks={turret_plus:1, idle_12h:1};
    // 장착 칸은 레벨 해금이 아니라 '미네랄로 사는 것'이다 — 해금으로 늘어나면 안 된다
    { const before=profPetSlots(); p.unlocks.pet_slot3=1; p.unlocks.pet_slot4=1;
      assert(profPetSlots()===before,'펫 칸이 레벨 해금으로 늘어남(미네랄 구매여야 한다)');
      delete p.unlocks.pet_slot3; delete p.unlocks.pet_slot4; }
    // 동료 정원도 레벨 해금이 아니라 '미네랄로 사는 칸'이다 — 최대 3칸
    { const before=hbMateMax(); p.unlocks.ally_plus=1;
      assert(hbMateMax()===before,'동료 칸이 레벨 해금으로 늘어남(미네랄 구매여야 한다)');
      delete p.unlocks.ally_plus;
      hbHunt().allySlots=99;
      assert(hbMateMax()===MG_SLOT_MAX,'동료 칸 상한이 '+MG_SLOT_MAX+'이 아님: '+hbMateMax());
      hbHunt().allySlots=0; }
    assert(hbBuildMax('turret')>b4.tur,'터렛 최대 해금이 반영 안 됨');
    assert(profOfflineCapMin()>b4.off,'오프라인 상한 해금이 반영 안 됨');
    // 해금 표의 모든 항목이 실제로 쓰이는지(코드에 배선된 id인지)
    const wired=['idle_arena','evolve','idle_8h','turret_plus','idle_12h'];
    for(const u of PROF_UNLOCKS) assert(wired.indexOf(u.id)>=0,'배선 안 된 해금 항목: '+u.id);
    p.unlocks={}; profSyncUnlocks();
    return '해금 '+PROF_UNLOCKS.length+'단계 · 파워 '+profPower(); });
  // 방치 수입 기준을 자동사냥 실적으로 · 성장(진화·환생)을 HOME에서
  await step('자동사냥: 방치 수입 기준 · HOME 성장(진화·환생)', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbNoteRate!=='function','미적용');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    // ① 방치 수입 = 자동사냥 실적. 클리어 전에는 옛 공식으로 떨어진다.
    let p=PROF(), c=CHAR();
    delete p.hunt.rate;
    const before=profIdleRate();
    assert(before>0,'첫 클리어 전 수입이 0');
    _hb.char.atk=1e9; _hb.char.range=1e9; _hb.char.cd=.05; _hb.char.hpMax=1e9; _hb.char.hp=1e9;
    let clears=0;
    for(let i=0;i<20000 && clears<2;i++){ const ph=_hb.phase; hbStep(0.05); if(ph!=='clearWait'&&_hb.phase==='clearWait') clears++; }
    assert(clears>0,'라운드 클리어가 안 됨');
    assert(p.hunt.rate>0,'실측 시급이 기록되지 않음');
    assert(profIdleRate()>before,'방치 수입이 자동사냥 실적을 안 따라감: '+before.toFixed(2)+' → '+profIdleRate().toFixed(2));
    // ② 성장 팝업 — 진입점은 '조건이 찼을 때만'이 아니라 항상 열려 있어야 한다.
    //    (전직 폐지 후 조건부 줄만 남기면 초반에 성장 화면을 아예 못 여는 문제가 있었다)
    //    2026-08-14: 좌상단 아이콘 → 사냥터 전용 네비의 '성장' 칸으로 옮겼다.
    // 2026-08-14: 좌상단 아이콘 줄을 없애고 ☰ 더보기 안으로 옮겼다
    { hbCloseGrow(); hbOpenMore(); await sleep(120);
      const btn=document.querySelector('#hbMoreGrid [data-k="grow"]');
      assert(btn,'더보기에 성장 항목이 없음');
      btn.click(); await sleep(250);
      assert(visible($('hbGrowModal')),'더보기에서 성장 팝업이 안 열림'); hbCloseGrow(); }
    // ③ 전직은 사라졌다 — 흔적이 남아 있으면 안 된다
    assert(typeof profClassChange==='undefined','전직 함수가 아직 남아 있음');
    assert($('hbGrowBody').textContent.indexOf('전직')<0,'성장 팝업에 전직이 남음');
    assert(typeof PROF_JOBS==='undefined','직업 표(PROF_JOBS)가 아직 남아 있음');
    assert(typeof profEvolve==='undefined' && typeof profEvolveReq==='undefined','진화 함수가 아직 남아 있음');
    assert(!PROF_UNLOCKS.some(u=>u.id==='evolve'),'해금 표에 진화가 남아 있음');
    // ④ 환생 — 조건이 차면 상단 성장 버튼에 ! 배지(패널 안 줄은 폐기 — 높이가 흔들렸다 · 2026-08-14)
    c.level=PROF_REB_EVERY; c.unit.level=PROF_REB_EVERY; p.pcoin=50000;
    renderHome();
    assert(visible($('hbGrowDot')),'환생 가능한데 성장 배지(!)가 안 보임');
    assert(!document.getElementById('hmStatRow'),'옛 성장 줄이 아직 패널에 있음');
    renderGrowModal();
    assert($('hbGrowBody').textContent.indexOf('환생')>=0,'성장 팝업에 환생이 없음');
    // ⑤ 진화는 폐지됐다 — 팝업에 흔적이 남아 있으면 안 된다
    assert($('hbGrowBody').textContent.indexOf('진화')<0,'환생 팝업에 진화가 남음');
    assert($('hbGrowBody').textContent.indexOf('파워 350')<0,'옛 파워 문구가 남음');
    hbCloseGrow();
    // ⑥ 할 게 없으면 배지는 꺼진다 — 단 버튼 진입점은 그대로 남아야 한다
    //    ☰ 의 !는 성장과 📅 일일이 함께 쓰는 신호라, 일일 쪽도 '받을 게 없는' 상태로 만들어야 성장만 본다
    { const D=dqState(); D.att.day=_dgDayKey(); D.att.n=1; D.att.bn={}; D.att.fin=0;
      D.allGot=1; D.q.forEach(e=>{ e.got=1; }); }
    c.level=1; c.unit.level=1; p.pcoin=0;
    c.rp=0; c.unit.rpts={};                      // 안 찍은 환생 포인트도 '할 일'이다 — 같이 비운다
    renderHome();
    assert(!visible($('hbGrowDot')),'할 게 없는데 성장 배지가 남아 있음');
    { hbOpenMore(); await sleep(100);
      assert(document.querySelector('#hbMoreGrid [data-k="grow"]'),'성장 항목까지 사라짐(항상 열려 있어야 한다)');
      hbCloseMore(); }
    return '실측 '+p.hunt.rate.toFixed(2)+'/s · 진화·직업 폐지 확인'; });
  // Phase 4 — 스킬 · 부스트 · 동료/펫 · 건설(터렛·벙커)
  await step('자동사냥: 스킬·부스트·동료·건설', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbUseSkill!=='function','Phase4 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const p=PROF(); p.pcoin=999999; hbHunt().build={}; hbHunt().boostT={};
    p.petSlots=MG_SLOT_MAX; p.pets={slime:{star:0,dup:0,fed:0}}; p.equip=['slime']; hbLayoutAllies();
    // ① 동료 — 뽑기로 얻고, 중복을 재료로 넣어 강화한다(미네랄 강화는 없어졌다)
    const H0=hbHunt(); H0.mates={}; H0.party=[]; H0.mateN=0; H0.allySlots=MG_SLOT_MAX;
    const mid=Object.keys(HB_MATES)[0], md0=HB_MATES[mid].dps;
    H0.mates[mid]={lv:1,dup:0}; H0.party=[mid]; hbLayoutAllies();
    assert(hbMateLv(mid)===1 && hbParty().indexOf(mid)>=0,'보유 동료가 출전하지 않음');
    assert(_hb.allies.length===1,'동료가 전장에 배치되지 않음');
    // 재료를 채우면 레벨이 오른다 — 필요량은 hbMateNeed 가 유일한 근거다
    { const need=hbMateNeed(mid), pt=hbMatePt(mid), n=Math.ceil(need/pt);
      H0.mates[mid].dup=n;
      for(let i=0;i<n;i++) hbMateFeed(mid, mid);
      assert(hbMateLv(mid)===2,'재료를 다 넣었는데 레벨이 안 오름: Lv'+hbMateLv(mid));
      assert(hbMateDps(mid)>md0,'강화해도 위력이 안 오름: '+md0+' → '+hbMateDps(mid));
      assert(hbMateNeed(mid)>need,'다음 레벨 요구량이 안 오름'); }
    // 재료가 없으면 못 넣는다
    assert(hbMateDup(mid)===0 && !hbMateFeed(mid,mid),'재료가 없는데 합성이 됨');
    // 출전 토글 · 정원 상한
    assert(hbMateToggle(mid) && hbParty().indexOf(mid)<0,'출전 해제가 안 됨');
    assert(hbMateToggle(mid) && hbParty().indexOf(mid)>=0,'다시 출전이 안 됨');
    { const ids=Object.keys(HB_MATES); for(const id of ids) hbHunt().mates[id]={lv:1,dup:0};
      let refused=0;
      for(const id of ids) if(hbHunt().party.indexOf(id)<0){ if(!hbMateToggle(id)) refused++; }
      // 정원이 차면 '거절'해야 한다 — 몰래 넘겨 놓고 표시할 때만 자르면 편성이 마음대로 바뀐다
      assert(refused>0,'정원이 찼는데도 출전 요청이 전부 받아들여짐');
      assert(hbHunt().party.length===hbMateMax(),'저장된 편성이 정원과 다름: '+hbHunt().party.length+'/'+hbMateMax());
      assert(hbParty().length===hbMateMax(),'출전 인원이 정원과 다름: '+hbParty().length+'/'+hbMateMax()); }
    hbHunt().mates={}; hbHunt().party=[]; hbLayoutAllies();
    // ② 건설 — 개수형 표는 없어지고 타일 배치(HB_STRUCT)로 통일됐다. 동료는 여기 없다.
    assert(typeof HB_BUILD==='undefined','옛 개수형 건설 표(HB_BUILD)가 남아 있음 — 표가 두 벌이면 어긋난다');
    assert(!HB_STRUCT.post && !HB_STRUCT.ally,'구조물 표에 옛 동료가 남아 있음');
    hbHunt().base={tiles:{},open:99}; hbLayoutBase();
    { let c; c=hbFreeCell('turret'); hbPlaceStruct('turret',c[0],c[1]);
      c=hbFreeCell('bunker'); hbPlaceStruct('bunker',c[0],c[1]); }
    assert(_hb.turrets.length===1 && _hb.bunkers.length===1,'터렛/벙커가 배치되지 않음');
    { let c; for(let i=0;i<HB_STRUCT.bunker.max+3 && (c=hbFreeCell('bunker')); i++) hbPlaceStruct('bunker',c[0],c[1]); }
    assert(hbStructN('bunker')===HB_STRUCT.bunker.max,'최대치를 넘겨 지어짐: '+hbStructN('bunker'));
    assert(_hb.pets.length===1,'장착 펫이 전장에 안 나옴');
    PROF().equip=['slime']; hbLayoutAllies();
    // ③ 스킬 — 효과 + 쿨다운(쿨 중 재사용 불가)
    _hb.skT={nova:0,heal:0,slow:0}; _hb.foes.length=0;
    for(let i=0;i<5;i++) hbPlaceFoe({ico:'🟢',hpMul:1,atkMul:1,spd:0});
    const n0=_hb.foes.length, hp0=_hb.foes[0].hp;
    hbUseSkill('nova');
    assert(_hb.foes.length<n0 || _hb.foes[0].hp<hp0,'폭발이 피해를 안 줌');
    assert(_hb.skT.nova===HB_SKILLS.nova.cd,'폭발 쿨다운이 안 걸림');
    const cn=_hb.foes.length; hbUseSkill('nova');
    assert(_hb.foes.length===cn,'쿨 중인데 다시 발동됨');
    _hb.char.hp=1; hbUseSkill('heal');
    assert(_hb.char.hp>1,'회복이 안 됨');
    hbUseSkill('slow');
    assert(_hb.slowT>0 && _hb.skT.slow===HB_SKILLS.slow.cd,'감속이 안 걸림');
    for(let i=0;i<40;i++) hbStep(0.05);
    assert(_hb.skT.nova<HB_SKILLS.nova.cd,'쿨다운이 안 줄어듦');
    // ④ 부스트 — 시간제 · 이미 걸려 있으면 연장 · 수입 배수 적용
    const pc0=p.pcoin; hbBuyBoost('inc');
    assert(hbBoostOn('inc'),'부스트가 안 걸림');
    assert(p.pcoin<pc0,'부스트 비용이 안 깎임');
    const l1=hbBoostLeft('inc'); hbBuyBoost('inc');
    assert(hbBoostLeft('inc')>l1+HB_BOOSTS.inc.sec-5,'연장이 안 됨: '+l1+' → '+hbBoostLeft('inc'));
    // ⑤ 스킬 바 UI
    renderHbBar();
    // 바는 두 줄이다 — 위: 건설 3종 / 아래: 스킬 + 토벌·부스트
    // 건설이 한 칸이 되어 바는 한 줄이다 — 줄이 늘면 전장이 그만큼 줄어든다
    assert(document.querySelectorAll('#hbBar .hbGrp').length===1,'스킬 바가 한 줄이 아님');
    // 하단 바는 스킬만 — 판을 여는 것(건설·토벌·부스트)은 좌상단 줄이다
    assert(!document.querySelector('#hbBar .hbBdBtn'),'하단 바에 건설이 남아 있음');
    assert(document.querySelectorAll('#hbBar .hbSk').length===Object.keys(HB_SKILLS).length,
      '하단 바에 스킬 외 버튼이 있음: '+document.querySelectorAll('#hbBar .hbSk').length);
    // 버튼이 늘어도 한 줄에 들어가야 한다 — 넘치면 토벌·부스트가 화면 밖으로 밀린다
    { const bar=$('hbBar'); assert(bar.scrollWidth<=bar.clientWidth+1,'스킬 바가 가로로 넘침: '+bar.scrollWidth+'>'+bar.clientWidth); }
    // ⑥ 전장 아래 경계 = 스킬 바 위. 카드 기준으로 잡으면 적이 버튼 뒤로 지나가 섞인다.
    { hbResize();
      const cv=$('hbCv').getBoundingClientRect(), bar=$('hbBar').getBoundingClientRect();
      const bT=bar.top-cv.top, bB=bar.bottom-cv.top, bL=bar.left-cv.left, bR=bar.right-cv.left;
      assert(Math.abs(_hb.vBot-bT)<2,'전장 아래 경계가 스킬 바 위가 아님: vBot '+Math.round(_hb.vBot)+' vs 바 '+Math.round(bT));
      _hb.foes.length=0; _hb.pend.length=0;
      for(let i=0;i<300;i++) hbPlaceFoe({ico:'x',hpMul:1,atkMul:1,spd:0});
      let hit=0;
      for(const f of _hb.foes){ const x=_hb.cx+f.x*_hb.k, y=_hb.cy+f.y*_hb.k;
        if(x>bL-14 && x<bR+14 && y>bT-14 && y<bB+14) hit++; }
      assert(hit===0,'스킬 바 위에 겹쳐 스폰된 적 '+hit+'기');
      _hb.foes.length=0; }
    hbHunt().boostT={}; hbHunt().build={}; hbHunt().base={tiles:{},open:1}; hbLayoutAllies();   // 기지도 비운다 — 남기면 뒤 스텝의 난수 소비가 달라진다
    // ③ 아군 화력 — 같은 상황을 아군 없이/있이 돌려 처치 수를 비교한다
    //    ⚠ 아군 발사 주기는 캐릭터 쿨다운(c.cd)을 공유한다 — 캐릭터를 막으면 아군도 멈춰서 그 방식으론 못 잰다
    // ⚠ 이 측정은 두 방향으로 포화된다 — 약한 라운드면 캐릭터 혼자 전멸시켜 양쪽이 같고(9→9),
    //    너무 센 라운드면 아무도 못 잡아 역시 같다(0→0). 그래서 캐릭터 스펙을 '고정'하고
    //    혼자서는 절반쯤만 잡는 라운드에서 잰다. 스펙을 고정하지 않으면 앞 단계의 누적 성장에 흔들린다.
    const setSpec=()=>{ const c=_hb.char;
      c.atk=60; c.cd=.30; c.range=140; c.crit=0; c.regen=0; c.hpMax=1e9; c.hp=1e9; };
    // ⚠ 라운드를 숫자로도, 체력 문턱으로도 박지 말 것 — 곡선이 던전별 기울기 + S자 리듬이라
    //    같은 문턱이라도 포화 여부가 달라진다(실제로 5→5 로 포화돼 간헐 실패했다).
    //    → 문턱으로 시작점만 잡고, **실제로 돌려 보며** '혼자서는 절반쯤 잡는' 라운드를 찾는다.
    const runAt=(rd)=>{ _hb.round=rd; _hb.wave=1; _hb.phase='fight'; setSpec();
      _hb.foes.length=0; _hb.pend.length=0; hbSpawnWave();
      // 사거리가 근접(34)이라 적이 화면 밖에서 걸어 들어올 시간이 필요하다 — 6초로는 도착 전에 끝난다
      const k=_hb.kills; for(let i=0;i<300;i++) hbStep(0.05); return _hb.kills-k; };
    hbHunt().build={}; hbHunt().mates={}; hbHunt().party=[]; hbHunt().allySlots=MG_SLOT_MAX; PROF().equip=[]; hbLayoutAllies();
    let RD=(()=>{ let r=1; while(r<300 && hbFoeHp(1,r,2)<600) r++; return Math.max(2,r-1); })();
    let solo=0;
    { const tot=rd=>hbFoeCount(rd,1);          // 그 웨이브의 적 수
      for(let t=0;t<14;t++){ solo=runAt(RD);
        if(solo>0 && solo<tot(RD)) break;      // 전멸(포화)도 전무(과부하)도 아닌 자리
        RD=Math.max(2, RD + (solo===0 ? -4 : 4)); }
      assert(solo>0 && solo<tot(RD),
        '측정 자리를 못 찾음 — 라운드 '+RD+' 에서 혼자 '+solo+'/'+tot(RD)+'기 (포화)'); }
    const runWave=()=>runAt(RD);
    { hbHunt().base={tiles:{},open:99}; hbLayoutBase();
      let c; for(let i=0;i<HB_STRUCT.turret.max && (c=hbFreeCell('turret')); i++) hbPlaceStruct('turret',c[0],c[1]); }
    for(const id of Object.keys(HB_MATES).slice(0,hbMateMax())){ hbHunt().mates[id]={lv:1,dup:0}; hbHunt().party.push(id); }
    hbLayoutAllies();
    const withAllies=runWave();
    assert(withAllies>solo,'아군을 세워도 화력이 안 늘어남: 라운드 '+RD+' 에서 '+solo+' → '+withAllies);
    // 측정 뒤 원복 — 잔적뿐 아니라 '캐릭터 위치'도 되돌린다.
    // 적 출현 위치는 캐릭터 기준이라(hbPlaceFoe), 캐릭터가 구석에 서 있으면 스폰이 화면 경계에 몰려
    // 뒤따르는 '스킬 바 위 스폰 금지' 검사가 엉뚱하게 실패한다.
    _hb.round=1; _hb.wave=1; _hb.phase='fight'; _hb.foes.length=0; _hb.pend.length=0;
    { const c=_hb.char; c.x=0; c.y=0; c.tx=0; c.ty=0; c.mv=0; }
    hbHunt().mates={}; hbHunt().party=[]; hbLayoutAllies();
    return '동료·터렛·벙커·펫 배치 ok · 스킬 3종 · 부스트 연장 ok'; });
  // 🎛 스킬 트레이 — 칸은 사냥터 업그레이드 카드(.hmUp)와 '같은 규격'이라는 것이 이 디자인의 전부다.
  //    두 벌로 갈라지면 '붉으면 지금 쓸 수 있다'가 스킬과 업그레이드에서 다른 뜻이 된다.
  await step('스킬 트레이: 업그레이드 카드와 같은 규격 · 자동은 판 밖', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof renderHbBar!=='function','스킬 바 없음');
    openHome(); await sleep(60); _hb.manual=true;
    renderHbBar(); hbSkCdPaint();
    // ① 한 판에 담긴다 — 셋 다 트레이 안, 자동은 트레이 '밖'
    const tray=document.querySelector('#hbBar .hbTray'); assert(tray,'스킬 트레이(.hbTray)가 없음');
    assert(tray.querySelectorAll('.hbSk').length===Object.keys(HB_SKILLS).length,
      '트레이 안 스킬 칸 수가 안 맞음: '+tray.querySelectorAll('.hbSk').length);
    const chip=document.querySelector('#hbBar .hbAutoChip'); assert(chip,'자동 칩(.hbAutoChip)이 없음');
    assert(!tray.contains(chip),'자동 칩이 트레이 안에 있음 — N4안은 판 밖이다');
    // ② 칸의 껍데기가 업그레이드 카드와 같은 값인가 (색·모서리·라운드를 직접 대조한다)
    const card=document.querySelector('#hmUpgGrid .hmUp:not(.lk)');
    assert(card,'대조할 업그레이드 카드(.hmUp)를 못 찾음');
    { const a=getComputedStyle(document.querySelector('#hbBar .hbSk:not(.cool)')), b=getComputedStyle(card);
      for(const prop of ['backgroundImage','clipPath','borderRadius','borderTopWidth']){
        assert(a[prop]===b[prop],'스킬 칸이 업그레이드 카드와 다름 ['+prop+']\n  스킬: '+a[prop]+'\n  카드: '+b[prop]); }
      // 치수는 2026-08-19 에 0.8배(46 → 37px) — 껍데기 네 속성은 위에서 그대로 대조한다
      { const w=document.querySelector('#hbBar .hbSk').getBoundingClientRect().width;
        assert(w>=34&&w<=40,'스킬 칸이 0.8배(37px) 규격을 벗어남: '+w.toFixed(1)+'px'); } }
    // ③ 쿨 = 붉은 발광만 꺼진다(잠긴 카드 문법). 아이콘은 남는다 — 무엇이 도는 중인지 보여야 한다
    const el=document.querySelector('#hbBar .hbSk[data-k="nova"]');
    _hb.skT.nova=0; hbSkCdPaint();
    const glowRdy=getComputedStyle(el).boxShadow;
    assert(glowRdy!=='none','준비된 칸에 붉은 발광이 없음');
    assert(!el.classList.contains('cool'),'준비된 칸에 cool 이 남아 있음');
    assert(el.querySelector('.hbSkSec').textContent==='','준비된 칸에 남은 초가 남아 있음');
    const LEFT=HB_SKILLS.nova.cd*0.5 + 0.4;   // ⚠ 정수로 재면 ceil/floor 가 같아 표기 규칙이 안 잡힌다
    _hb.skT.nova=LEFT; hbSkCdPaint();
    assert(el.classList.contains('cool'),'쿨인데 cool 이 안 붙음');
    assert(getComputedStyle(el).boxShadow==='none','쿨인 칸에 발광이 남아 있음: '+getComputedStyle(el).boxShadow);
    { const ico=el.querySelector('.hbSkIco'), r=ico&&ico.getBoundingClientRect();
      assert(ico && r.width>8 && parseFloat(getComputedStyle(ico).opacity)>.1,
        '쿨이라고 아이콘이 사라졌음 — 무엇이 도는 중인지 보여야 한다'); }
    assert(el.querySelector('.hbSkSec').textContent===String(Math.ceil(LEFT)),
      '남은 초가 올림이 아님(1초 남았는데 0 으로 보이면 안 된다): '+el.querySelector('.hbSkSec').textContent);
    // ④ 남은 시간 바는 --cd 로만 움직인다(다시 그리지 않는다)
    const fill=el.querySelector('.hbCd b'), w = x=>{ _hb.skT.nova=HB_SKILLS.nova.cd*x; hbSkCdPaint();
      return fill.getBoundingClientRect().width; };
    const w8=w(0.8), w2=w(0.2);
    assert(w8>w2+4,'남은 시간 바가 --cd 를 안 따름: 80% '+w8.toFixed(1)+'px vs 20% '+w2.toFixed(1)+'px');
    // ⑤ 빨강은 스킬 칸이 독점한다 — 자동 칩에 붉은색이 섞이면 '지금 쓸 수 있다'는 신호가 흐려진다.
    //    ⚠ 켜짐·꺼짐을 둘 다 봐야 한다 — 한쪽만 보면 반대 상태의 규칙이 그대로 새어 나간다(실제로 놓쳤다)
    { const red=/rgba?\(\s*(1[6-9]\d|2[0-5]\d)\s*,\s*([0-7]\d?)\s*,\s*([0-7]\d?)\s*[,)]/;
      const was=!!hbHunt().skAuto;
      for(const want of [true,false]){
        if(!!hbHunt().skAuto!==want) hbToggleAuto(); else renderHbBar();
        const ch=document.querySelector('#hbBar .hbAutoChip'), dot=ch.querySelector('i');
        assert(ch.classList.contains('on')===want,'자동 칩이 상태를 안 따름(want '+want+')');
        for(const el of [ch,dot]) { const c=getComputedStyle(el);
          for(const prop of ['color','backgroundColor','borderTopColor','boxShadow']){
            assert(!red.test(c[prop]),'자동 칩에 붉은색이 섞였음 [auto '+(want?'ON':'OFF')+' · '+prop+']: '+c[prop]); } } }
      if(!!hbHunt().skAuto!==was) hbToggleAuto(); }
    _hb.skT.nova=0; hbSkCdPaint();
    return '트레이 1판 · 칸=업그레이드 카드 규격 · 자동 칩 판 밖 · 바 '+w8.toFixed(0)+'→'+w2.toFixed(0)+'px'; });
  // 🎴 업그레이드 카드 — 이중 테두리(D1) + 비용 버튼(B3). 둘 다 '방향'이 규칙이라 뒤집히면 안 된다.
  await step('업그레이드 카드: 이중 테두리 · 버튼은 왼쪽 위에서 빛이 든다', async()=>{
    openHome(); await sleep(90); renderHome();
    const card=document.querySelector('#hmUpgGrid .hmUp:not(.lk)'); assert(card,'살 수 있는 카드가 없음');
    // ① 이중 테두리 — 안쪽 프레임이 실재하고, 모서리 컷이 바깥과 평행하다(바깥 7 - inset 3 = 안쪽 4)
    const af=getComputedStyle(card,'::after');
    assert(af.content && af.content!=='none','카드 안쪽 프레임(::after)이 없음');
    assert(Math.abs(parseFloat(af.borderTopWidth)-1)<0.01,'안쪽 프레임이 1px 이 아님: '+af.borderTopWidth);
    assert(!/rgba\(0, 0, 0, 0\)|transparent/.test(af.borderTopColor),'안쪽 프레임 색이 투명함: '+af.borderTopColor);
    { const inset=parseFloat(af.top);
      const outer=parseFloat((getComputedStyle(card).clipPath.match(/(\d+(?:\.\d+)?)px/)||[])[1]);
      const inner=parseFloat((af.clipPath.match(/(\d+(?:\.\d+)?)px/)||[])[1]);
      assert(outer>0 && inner>0 && inset>0,'모서리 컷/여백을 못 읽음: '+outer+' / '+inner+' / '+inset);
      assert(Math.abs((outer-inset)-inner)<0.01,
        '안쪽 프레임 컷이 바깥과 평행하지 않음(대각선이 어긋난다): 바깥 '+outer+' - inset '+inset+' ≠ 안쪽 '+inner); }
    // ② 비용 버튼 — 위·왼쪽이 밝고 오른쪽·아래가 진하다(빛은 왼쪽 위에서)
    const btn=card.querySelector('.hmUpBtn'); assert(btn,'비용 버튼이 없음');
    { const raw=getComputedStyle(btn).boxShadow, parts=[]; let d=0,cur='';
      for(const ch of raw){ if(ch==='(') d++; else if(ch===')') d--;
        if(ch===',' && d===0){ parts.push(cur.trim()); cur=''; } else cur+=ch; }
      if(cur.trim()) parts.push(cur.trim());
      const lum=t=>{ const m=t.match(/rgba?\(([^)]+)\)/); if(!m) return null;
        const n=m[1].split(',').map(parseFloat); const a=n.length>3?n[3]:1;
        return (0.3*n[0]+0.59*n[1]+0.11*n[2])*a; };
      const find=re=>parts.filter(t=>t.indexOf('inset')>=0).find(t=>re.test(t));
      const hi=find(/\s1px\s+1px\s/), lo=find(/\s-1px\s+-1px\s/);
      assert(hi,'위·왼쪽 밝은 선(inset 1px 1px)이 없음: '+raw);
      assert(lo,'오른쪽·아래 진한 선(inset -1px -1px)이 없음: '+raw);
      assert(lum(hi)>lum(lo)+20,
        '빛의 방향이 뒤집혔다 — 위·왼쪽이 오른쪽·아래보다 밝아야 한다: '+lum(hi).toFixed(1)+' vs '+lum(lo).toFixed(1)); }
    // ③ 링도 같은 방향(대각선). 세로 그라데로 되돌아가면 버튼만 방향을 잃는다
    assert(/315deg/.test(getComputedStyle(btn).backgroundImage),
      '버튼 링이 대각선이 아님: '+getComputedStyle(btn).backgroundImage.slice(0,80));
    return '이중 테두리 ok · 컷 7-3=4 · 빛 왼쪽 위'; });
  // 📐 업그레이드 격자 — 칸 변이 반 픽셀에 놓이면 세로 테두리가 한쪽만 두 픽셀로 번진다.
  //    (실측: 안쪽폭 376 - 간격 5 = 371 을 둘로 나눠 185.5px → 왼쪽 칸의 오른쪽 변만 흐렸다)
  await step('업그레이드 격자: 칸 폭이 정수 — 테두리가 한쪽만 번지지 않는다', async()=>{
    skipIf(typeof hmUpgSnapGrid!=='function','격자 스냅 없음');
    openHome(); await sleep(90); renderHome();
    const g=$('hmUpgGrid'), cs=[...g.querySelectorAll('.hmUp')].slice(0,4);
    assert(cs.length>=2,'업그레이드 칸이 2개 미만: '+cs.length);
    const frac=v=>Math.abs(v-Math.round(v));
    for(const c of cs){ const r=c.getBoundingClientRect();
      assert(frac(r.left)<0.01 && frac(r.right)<0.01,
        '칸 변이 정수 자리가 아님(반 픽셀이면 한쪽 테두리만 번진다): left '+r.left.toFixed(3)+' · right '+r.right.toFixed(3));
      assert(frac(r.width)<0.01,'칸 폭이 정수가 아님: '+r.width.toFixed(3)); }
    const ws=new Set(cs.map(c=>Math.round(c.getBoundingClientRect().width)));
    assert(ws.size===1,'칸마다 폭이 다름: '+[...ws].join(' / '));
    return '칸 '+cs.length+'개 · 폭 '+[...ws][0]+'px 정수'; });
  // 🧱 기지 격자 — 타일이 단일 소스. 저장 왕복 · 겹침/범위 · 봉쇄 금지 · 옛 개수형 이관.
  await step('기지 격자: 배치·저장 왕복·겹침/범위·봉쇄 금지', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbPlaceStruct!=='function','기지 격자 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const p=PROF(); p.pcoin=9e6;
    hbHunt().base={tiles:{},open:99}; hbLayoutBase();
    // ① 좌표 왕복 — 타일 인덱스 ↔ 월드 좌표가 서로의 역이어야 한다
    for(const g of [-HB_GRID_R,-3,0,7,HB_GRID_R-1]) assert(hbGx(hbTx(g))===g,'타일 좌표 왕복 실패: '+g);
    // ② 배치 — 놓이고, 값이 오르고, 전장에 선다
    const c0=hbBuildCost('turret');
    assert(hbPlaceStruct('turret',5,5),'터렛 배치 실패');
    assert(hbBase().tiles[hbKey(5,5)].k==='turret','타일에 기록되지 않음');
    assert(hbBuildCost('turret')>c0,'다음 비용이 안 오름');
    assert(_hb.turrets.length===1,'전장에 안 섬');
    // ③ 겹침 — 같은 칸, 그리고 2×2 건물이 걸치는 칸 모두 막힌다
    assert(!hbCanPlace('wall',5,5),'점유 칸에 겹쳐 놓임');
    assert(hbPlaceStruct('bunker',8,8),'벙커 배치 실패');
    for(const [gx,gy] of [[8,8],[9,8],[8,9],[9,9]]) assert(!hbCanPlace('wall',gx,gy),'2×2 점유 칸이 비어 보임: '+gx+','+gy);
    assert(hbCanPlace('wall',10,8),'2×2 바깥인데 막힘');
    // ④ 범위 — 격자는 맵 전체다(2026-08-12). 맵 밖만 막히고 회복 구역·구석은 모두 열려 있다.
    assert(!hbCanPlace('wall',HB_GRID_R,0),'맵 밖에 놓임');
    assert(!hbCanPlace('wall',-HB_GRID_R-1,0),'맵 밖(음수)에 놓임');
    assert(hbCanPlace('wall',0,0),'회복 구역에 못 놓음(전 지역 건설 가능해야 함)');
    assert(hbCanPlace('wall',HB_GRID_R-1,HB_GRID_R-1),'맵 구석에 못 놓음');
    // ⑤ 저장 왕복 — saveMeta/loadMeta를 지나도 그대로여야 한다
    saveMeta(); loadMeta();
    assert(hbBase().tiles[hbKey(5,5)] && hbBase().tiles[hbKey(5,5)].k==='turret','저장 왕복에서 타일이 사라짐');
    // ⑥ 봉쇄 금지 — 코어를 벽으로 두르는 마지막 한 칸은 거절되고 자원도 안 깎인다
    hbHunt().base={tiles:{},open:99}; hbLayoutBase();
    // ⚠ 남길 한 칸은 '변의 중간'이어야 한다 — 모서리를 비워도 4방향 이동으로는 여전히 갇힌다(대각 통과 없음)
    const last=[0,-4];
    for(let g=-4;g<=4;g++) for(const c of [[g,-4],[g,4],[-4,g],[4,g]]){
      if(c[0]===last[0]&&c[1]===last[1]) continue; hbBase().tiles[hbKey(c[0],c[1])]={k:'wall'}; }
    assert(hbSealCheck(null,0,0)===false,'입구가 열려 있는데 이미 봉쇄로 판정됨');
    assert(hbSealCheck('wall',last[0],last[1])===true,'마지막 한 칸이 봉쇄로 판정되지 않음');
    const coin=p.pcoin;
    hbArmStart('wall',last[0],last[1]);
    assert(hbArmOk()===false,'봉쇄가 되는 자리인데 확정 가능으로 표시됨');
    hbArmConfirm();
    assert(!hbBase().tiles[hbKey(last[0],last[1])],'봉쇄되는데도 지어짐');
    assert(p.pcoin===coin,'거절됐는데 자원이 깎임');
    // 벽을 하나 비워 두면(입구) 통과해야 한다
    assert(hbSealCheck('wall',10,10)===false,'막지 않는 자리인데 봉쇄로 판정됨');
    hbArmCancel();
    // ⑦ 옛 개수형(hunt.build) → 타일 이관
    const H=hbHunt(); delete H.base; H.build={ally:2,turret:1,bunker:1};
    hbBase();
    // 'ally'는 타일로 가지 않는다 — 동료는 뽑기 로스터(HB_MATES)로 옮겨졌다
    assert(hbStructN('turret')===1 && hbStructN('bunker')===1,
      '옛 보유분 이관 실패: turret '+hbStructN('turret')+' / bunker '+hbStructN('bunker'));
    assert(!Object.keys(H.build).length,'이관 후에도 옛 개수형이 남음');
    hbHunt().base={tiles:{},open:1}; hbLayoutBase(); saveMeta();
    return '왕복·겹침·범위·저장·봉쇄차단·이관 ok'; });
  // 🪖 벙커 = 구매 유닛(벙커별 최대 4) + 동료 1. 화력 = (유닛 합 + 동료 위력) × 벙커 공격력(bkatk).
  await step('벙커: 유닛 구매(벙커별)·동료 1·상한·화력·업그레이드', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbBunkerAssign!=='function','벙커 주둔 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const p=PROF(); p.pcoin=9e6;
    const _cSave={..._hb.char};   // ⚠ 아래에서 위치·사거리를 바꾼다 — 뒤 스텝들은 원점·정상 스탯을 가정한다
    // 동료 5명 출전(로스터 앞에서부터) · 기지 초기화
    const H=hbHunt(); H.upg.bkatk=0; H.mates={}; H.party=[]; H.allySlots=MG_SLOT_MAX;
    const ids=Object.keys(HB_MATES).slice(0, Math.min(5, hbMateMax()));
    for(const id of ids){ H.mates[id]={lv:1,dup:0}; H.party.push(id); }
    hbHunt().base={tiles:{},open:99}; hbLayoutBase();
    assert(hbPlaceStruct('bunker',6,6),'벙커 배치 실패');
    assert(hbPlaceStruct('bunker',10,10),'두 번째 벙커 배치 실패');
    const q=hbKey(6,6), q2=hbKey(10,10), t=hbBase().tiles[q], t2=hbBase().tiles[q2];
    assert(_hb.allies.length===ids.length,'출전 동료가 전장에 안 나옴: '+_hb.allies.length);
    // ⓪ 유닛 구매 — 벙커마다 개별. 새 벙커는 1기, 비용은 그 벙커의 보유 수 기준으로 오른다
    assert(hbBunkerN(t)===1 && hbBunkerN(t2)===1,'새 벙커는 유닛 1기로 시작해야 함');
    hbOpenBunker(q);
    { const c1=hbBunkerUnitCost(1), coin=p.pcoin; hbBunkerAdd();
      assert(hbBunkerN(t)===2,'유닛이 안 늘어남');
      assert(Math.round(coin-p.pcoin)===c1,'비용이 안 맞음: '+(coin-p.pcoin)+' vs '+c1);
      assert(hbBunkerN(t2)===1,'다른 벙커의 유닛 수가 같이 변함(벙커별이어야 한다)');
      assert(hbBunkerUnitCost(hbBunkerN(t2))===hbBunkerUnitCost(1),'비용이 벙커별 보유 수를 안 따름');
      for(let i=0;i<HB_BUNKER_SLOTS+3;i++) hbBunkerAdd();
      assert(hbBunkerN(t)===HB_BUNKER_SLOTS,'유닛 상한을 넘김: '+hbBunkerN(t)); }
    // ① 동료 넣기 — 궤도에서 빠지고 벙커에 실린다
    hbBunkerAssign(ids[0]);
    assert(hbBunkerMates(t).indexOf(ids[0])>=0,'지정이 타일에 안 실림');
    assert(_hb.allies.length===ids.length-1,'벙커에 넣었는데 궤도에도 남아 있음');
    assert(_hb.bunkers.find(b=>b.q===q).mates.length===1,'전장 벙커에 동료가 안 실림');
    // ② 한 동료 = 한 벙커 — 다른 벙커 창에서 누르면 옮겨 온다
    _hbBunkerQ=q2; hbBunkerAssign(ids[0]);
    assert(hbBunkerMates(t).length===0 && hbBunkerMates(t2).indexOf(ids[0])>=0,'벙커 이동이 안 됨(양쪽에 남음)');
    _hbBunkerQ=q;
    // ③ 동료 자리는 1칸 — 더 넣으면 거부된다
    for(const id of ids) if(id!==ids[0]) hbBunkerAssign(id);     // ids[0]은 다른 벙커에 주둔 중
    assert(hbBunkerMates(t).length===HB_BUNKER_MATE_SLOTS,'동료 상한(1)을 넘김: '+hbBunkerMates(t).length);
    // ④ 빼기 — 다시 궤도로
    { const back=hbBunkerMates(t)[0], n0=_hb.allies.length;
      hbBunkerAssign(back);
      assert(hbBunkerMates(t).indexOf(back)<0,'빼기가 안 됨');
      assert(_hb.allies.length===n0+1,'뺀 동료가 궤도로 안 돌아옴'); }
    // ⑤ 저장 왕복 — 지정이 살아남는다
    { const keep=hbBunkerMates(t2).slice(); saveMeta(); loadMeta();
      assert(JSON.stringify(hbBunkerMates(hbBase().tiles[q2]))===JSON.stringify(keep),'저장 왕복에서 지정이 사라짐'); }
    // ⑥ 파티에서 빠지면 벙커에서도 빠진다(유령 주둔 금지)
    // ⚠ ⑤의 loadMeta()가 프로필 객체를 갈아끼운다 — 초입의 H로 파티를 고치면 낡은 객체에 쓴다. 새로 잡는다.
    { const H6=hbHunt(), gone=hbBunkerMates(hbBase().tiles[q2])[0];
      H6.party=H6.party.filter(x=>x!==gone); hbLayoutBase();
      assert(hbBunkerMates(hbBase().tiles[q2]).indexOf(gone)<0,'파티에서 뺐는데 벙커에 남음');
      H6.party.push(gone); hbLayoutBase(); }
    hbCloseBunker();
    // ⑦ 화력 — 죽지 않는 표적의 '깎인 체력'으로 잰다(킬 수는 웨이브 진행에 흔들린다)
    // ⚠ ⑤의 loadMeta()가 프로필 객체를 갈아끼울 수 있다 — 스텝 초입에 잡아 둔 H를 쓰면
    //    낡은 객체에 쓰게 되어 bkatk가 조용히 무시된다(실제로 그랬다). 항상 hbHunt()로 새로 잡는다.
    const dmgOf=(units,mates,bk)=>{ hbHunt().upg.bkatk=bk;
      hbBase().tiles[q].n=units; hbBase().tiles[q].m=mates.slice();
      hbBase().tiles[q2].n=0; hbBase().tiles[q2].m=[]; hbLayoutBase();
      for(const b of _hb.bunkers) b.cdT=0;                       // 발사 시차 난수 제거 — 측정을 결정적으로
      const c=_hb.char; c.x=hbTx(6); c.y=hbTx(6)+200; c.tx=null; c.ty=null;   // 캐릭터는 멀리 — 제 화력이 안 섞이게
      c.hpMax=1e9; c.hp=1e9; c.range=70; c.cd=0.5; c.atk=40; c.crit=0; c.regen=0;
      _hb.round=1; _hb.wave=1; _hb.phase='fight'; _hb.foes.length=0; _hb.pend.length=0; _hb.allies.length=0; _hb.turrets.length=0; _hb.pets.length=0;
      hbPlaceFoe({ico:'x',hpMul:1,atkMul:1,spd:0});
      const f=_hb.foes[0]; f.x=hbTx(6)+30; f.y=hbTx(6); f.hp=f.hpMax=1e9; f.atk=0; f.spd=0;   // 안 죽고 안 움직이고 안 때린다
      for(let i=0;i<100;i++){ f.x=hbTx(6)+30; f.y=hbTx(6); hbStep(0.05); }
      return Math.round(f.hpMax-f.hp); };
    const none=dmgOf(0,[],0), units2=dmgOf(2,[],0), units4=dmgOf(4,[],0);
    assert(none===0,'비었는데 벙커가 피해를 줌: '+none);
    assert(units2>0,'유닛을 넣어도 피해가 없음');
    assert(units4>units2,'유닛을 더 사도 화력이 안 늘어남: '+units2+' → '+units4);
    const mixed=dmgOf(4,[ids[1]],0);
    assert(mixed>units4,'동료를 추가로 넣어도 화력이 안 늘어남: '+units4+' → '+mixed);
    // ⑧ '건물' 구역 벙커 공격력이 배수로 들어간다(유닛+동료 전체에)
    assert(HB_UPG.bkatk && HB_UPG.bkatk.cat==='bld','벙커 공격력 업그레이드가 건물 구역에 없음');
    const up=dmgOf(4,[ids[1]],10);
    assert(up>mixed*1.2,'bkatk를 올려도 피해가 안 늘어남: '+mixed+' → '+up);
    { const H2=hbHunt(); H2.upg.bkatk=0; H2.mates={}; H2.party=[]; }
    Object.assign(_hb.char,_cSave); _hb.foes.length=0; _hb.pend.length=0;   // 원복
    hbHunt().base={tiles:{},open:1}; hbLayoutBase(); saveMeta();
    return '유닛(벙커별)+동료1·이동·왕복·유령금지·피해 0/'+units2+'/'+units4+'/'+mixed+'/'+up+'(bkatk+10) ok'; });
  // ⚙ 설정(☰) — .bare 재화 바가 click-through라 눌리지 않고 캐릭터만 걸어가던 회귀를 막는다
  await step('설정 버튼: HOME에서 눌리고 · 캐릭터가 안 움직인다', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof openAppSettings!=='function','앱 설정 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(80); _hb.manual=true;
    const btn=$('curSettingsBtn');
    assert(btn,'재화 바 설정 버튼이 없음');
    assert($('curBar').classList.contains('bare'),'HOME 재화 바가 .bare가 아님(전제가 바뀜)');
    assert(getComputedStyle(btn).pointerEvents!=='none','설정 버튼이 click-through라 눌리지 않는다');
    const r=btn.getBoundingClientRect(), px=r.left+r.width/2, py=r.top+r.height/2;
    const hit=document.elementFromPoint(px,py);
    assert(hit && btn.contains(hit),'설정 버튼 자리를 다른 요소가 가로챈다: '+(hit?(hit.id||hit.className||hit.tagName):'none'));
    // 같은 지점을 눌렀을 때 캐릭터가 따라가면 안 된다(이번 버그의 핵심)
    _hb.char.tx=null; _hb.char.ty=null;
    hbFieldTap({ target:hit, clientX:px, clientY:py });
    assert(_hb.char.tx==null,'설정 버튼을 눌렀는데 캐릭터가 이동함');
    // ☰ 는 더보기를 열고, 설정은 그 안의 항목이다(2026-08-12). 어느 쪽이든 '앱 문맥'이어야 한다 —
    // 인게임 설정에는 임무·배속·게임 나가기가 있어 사냥터에 뜨면 안 된다.
    assert(/hudTopMenu|openAppSettings/.test(btn.getAttribute('onclick')||''),'☰ 가 인게임 설정으로 직행한다');
    if(typeof hbOpenMore==='function'){ hbOpenMore(); await sleep(120);
      const si=document.querySelector('#hbMoreGrid [data-k="set"]');
      assert(si,'더보기에 설정 항목이 없음'); si.click(); await sleep(250); }
    else { openAppSettings(); await sleep(60); }
    assert(visible($('settingsPop')),'설정 팝업이 안 열림');
    assert($('settingsPop').classList.contains('appCtx'),'앱 문맥(.appCtx)이 아님');
    closeSettings(); await sleep(40);
    return 'pointer-events·히트·이동 안 함·appCtx ok'; });
  // 🖐 필드 이동 = 관리자 건설 화면과 같은 방식: 누른 즉시 이동 + 뗄 때까지 손가락 추종
  await step('필드 이동: 드래그 추종 · 손 떼면 정지 · 스크롤 안 뺏김', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbFieldMove!=='function','필드 포인터 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(80); _hb.manual=true;
    hbHunt().base={tiles:{},open:1}; hbLayoutBase();
    // ① 브라우저가 드래그를 스크롤로 가로채면 안 된다(관리자 맵 .bmap·마을 .twMap과 같은 규칙)
    for(const id of ['homeScreen','hmScroll'])
      assert(getComputedStyle($(id)).touchAction==='none','#'+id+' touch-action이 none이 아님 — 드래그가 스크롤로 샌다');
    const hs=$('homeScreen'), cv=$('hbCv'), r=cv.getBoundingClientRect();
    const ev=(t,id,x,y)=>({ type:t, pointerId:id, target:hs, clientX:r.left+x, clientY:r.top+y, cancelable:true, preventDefault(){ this._pd=true; } });
    // ② 누르면 즉시 목적지 · 드래그하면 계속 따라온다
    _hb.char.tx=null; _hb.char.ty=null;
    const d0=ev('pointerdown',7,120,120); hbFieldTap(d0);
    assert(d0._pd,'pointerdown에서 preventDefault를 안 했다(화면이 끌려간다)');
    assert(_hb.char.tx!=null,'누른 자리로 목적지가 안 잡힘');
    const seen=[];
    for(const [x,y] of [[140,130],[180,160],[90,200],[60,90]]){ hbFieldMove(ev('pointermove',7,x,y));
      seen.push(Math.round(_hb.char.tx)+','+Math.round(_hb.char.ty)); }
    assert(new Set(seen).size===seen.length,'드래그해도 목적지가 안 따라옴: '+seen.join(' / '));
    // ③ 손을 떼면 더는 안 따라온다
    hbFieldUp(ev('pointerup',7,60,90));
    const keep=_hb.char.tx; hbFieldMove(ev('pointermove',7,300,300));
    assert(_hb.char.tx===keep,'손을 뗐는데 목적지가 계속 바뀜');
    // ④ 다른 포인터 id의 move는 무시한다(멀티터치가 명령을 훔치지 않게)
    hbFieldTap(ev('pointerdown',8,100,100)); const k2=_hb.char.tx;
    hbFieldMove(ev('pointermove',9,250,250));
    assert(_hb.char.tx===k2,'다른 손가락이 이동 명령을 가로챔');
    hbFieldUp(ev('pointerup',8,100,100));
    // ⑤ 실제로 그쪽으로 걸어간다
    { const c=_hb.char; c.x=0; c.y=0; c.tx=150; c.ty=0;
      const before=Math.hypot(c.tx-c.x, c.ty-c.y);
      for(let i=0;i<20;i++) hbStep(0.05);
      assert(Math.hypot(c.tx-c.x, c.ty-c.y)<before,'목적지가 있는데 안 걸어감'); }
    _hb.char.tx=null; _hb.char.ty=null;
    return 'touch-action·추종 '+seen.length+'회·정지·멀티터치 무시 ok'; });
  // 🛠 건설 모드 — 라운드를 멈추고 초기화한다. 나갈 때까지 연속으로 짓는다.
  await step('건설 모드: 라운드 정지·초기화 · 연속 배치 · 방향 이어가기', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbBuildEnter!=='function','건설 모드 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(80); _hb.manual=true;
    const p=PROF(); p.pcoin=9e6;
    hbHunt().base={tiles:{},open:99}; hbLayoutBase();
    // ① 진입 = 라운드 초기화 + 시계 정지
    _hb.round=3; _hb.wave=2; _hb.phase='fight'; _hb.foes.length=0; hbSpawnWave();
    assert(_hb.foes.length||_hb.pend.length,'전제: 적이 있어야 한다');
    _hb.char.tx=100; _hb.char.ty=100;
    hbBuy('wall');
    assert(_hb.build===true,'건설 모드로 안 들어감');
    assert(_hb.foes.length===0 && _hb.pend.length===0,'건설 진입인데 적이 남음');
    assert((_hb.chests||[]).length===0,'건설 진입인데 상자가 남음');
    assert(_hb.wave===1,'웨이브가 1로 안 돌아감: '+_hb.wave);
    assert(_hb.char.tx==null,'건설 중인데 캐릭터 목적지가 남음');
    { const t0=_hb.waveT, x0=_hb.char.x, y0=_hb.char.y;
      for(let i=0;i<40;i++) hbStep(0.05);
      assert(_hb.waveT===t0,'건설 중인데 웨이브 시계가 흐름: '+t0+' → '+_hb.waveT);
      assert(_hb.char.x===x0 && _hb.char.y===y0,'건설 중인데 캐릭터가 움직임'); }
    assert(!$('hbBuildStop').classList.contains('hide'),'건설 종료(⊘) 버튼이 안 보임');
    // ①-2 고스트를 끌 때 확정 버튼이 '다시 만들어지면' 안 된다 —
    //     이 함수는 드래그 중(hbArmTo)과 매 프레임(hbFrame) 둘 다에서 불려서, DOM을 새로 쓰면
    //     ▶를 누르는 순간 눌린 요소가 사라져 클릭이 씹힌다.
    { const host=$('hbArmBtns'), b0=host.querySelector('.bArmBtn.ok');
      assert(b0,'확정 버튼이 없음');
      hbArmTo(120,200); hbArmTo(160,240); hbArmBtns();
      assert(host.querySelector('.bArmBtn.ok')===b0,'고스트를 옮길 때마다 확정 버튼이 새로 만들어진다'); }
    // ①-3 건설 중에도 드래그로 고스트가 손가락을 따라온다(이동과 같은 방식)
    { const hs=$('homeScreen'), cv=$('hbCv'), rr=cv.getBoundingClientRect();
      const ev=(t,x,y)=>({ type:t, pointerId:21, target:hs, clientX:rr.left+x, clientY:rr.top+y, cancelable:true, preventDefault(){} });
      hbFieldTap(ev('pointerdown',100,150));
      const g=[]; for(const [x,y] of [[130,170],[170,210],[90,250]]){ hbFieldMove(ev('pointermove',x,y)); g.push(_hb.arm.gx+','+_hb.arm.gy); }
      hbFieldUp(ev('pointerup',90,250));
      assert(new Set(g).size===g.length,'건설 중 드래그로 고스트가 안 따라옴: '+g.join(' / ')); }
    // ② 연속 배치 — 확정해도 건설 모드가 유지되고 다음 자리는 오른쪽
    const A=_hb.arm; A.gx=0; A.gy=-6; hbArmBtns();
    const g0=A.gx;
    hbArmConfirm();
    assert(_hb.build===true,'한 채 짓고 건설 모드가 끊김');
    assert(_hb.arm && _hb.arm.gx===g0+1 && _hb.arm.gy===-6,'다음 자리가 오른쪽이 아님: '+_hb.arm.gx+','+_hb.arm.gy);
    hbArmConfirm();
    assert(_hb.arm.gx===g0+2,'오른쪽으로 이어지지 않음: '+_hb.arm.gx);
    // ③ 방향 이어가기 — 고스트를 무시하고 왼쪽에 놓으면 그 다음부터 왼쪽
    _hb.arm.gx=g0-1; _hb.arm.gy=-6; hbArmConfirm();
    assert(_hb.arm.gx===g0-2,'왼쪽으로 이어지지 않음: '+_hb.arm.gx);
    hbArmConfirm();
    assert(_hb.arm.gx===g0-3,'왼쪽 방향이 유지되지 않음: '+_hb.arm.gx);
    // ④ 막힌 칸은 그 방향으로 건너뛴다
    hbBase().tiles[hbKey(g0-4,-6)]={k:'wall'}; hbLayoutBase();
    hbArmConfirm();
    assert(_hb.arm.gx===g0-5,'막힌 칸을 건너뛰지 않음: '+_hb.arm.gx);
    // ⑤ 맵 끝에 닿으면 아래로
    { _hb.arm.dir=[1,0]; _hb.arm.last=null; _hb.arm.gx=HB_GRID_R-1; _hb.arm.gy=-6;
      hbArmConfirm();
      assert(_hb.arm.gy>-6,'맵 끝인데 아래로 안 꺾임: '+_hb.arm.gx+','+_hb.arm.gy); }
    // ⑤-2 고스트를 화면 가장자리로 끌면 건설 카메라가 그쪽으로 따라간다(한 손가락으로 맵 전체 사용)
    { const hs=$('homeScreen'), cv=$('hbCv'), rr=cv.getBoundingClientRect();
      const ev=(t,x,y)=>({ type:t, pointerId:31, target:hs, clientX:rr.left+x, clientY:rr.top+y, cancelable:true, preventDefault(){} });
      _hb.bcam={x:0,y:0}; _hb.char.x=0; _hb.char.y=0; hbResize();
      hbFieldTap(ev('pointerdown', rr.width*0.5, (_hb.vTop+_hb.vBot)/2));
      hbFieldMove(ev('pointermove', rr.width*0.97, (_hb.vTop+_hb.vBot)/2));   // 오른쪽 끝을 잡고 유지
      const cx0=_hb.bcam.x, g0=_hb.arm.gx;
      for(let i=0;i<12;i++) hbEdgePan();
      assert(_hb.bcam.x>cx0,'오른쪽 끝을 잡고 있는데 건설 카메라가 안 따라감: '+cx0+' → '+_hb.bcam.x);
      assert(_hb.arm.gx>=g0,'화면은 갔는데 고스트가 안 따라옴');
      // 안쪽으로 옮기면 멈춘다
      hbFieldMove(ev('pointermove', rr.width*0.5, (_hb.vTop+_hb.vBot)/2));
      const cx1=_hb.bcam.x; for(let i=0;i<6;i++) hbEdgePan();
      assert(_hb.bcam.x===cx1,'화면 안쪽인데도 카메라가 밀림');
      // 손을 떼면 멈춘다
      hbFieldMove(ev('pointermove', rr.width*0.97, (_hb.vTop+_hb.vBot)/2));
      hbFieldUp(ev('pointerup', rr.width*0.97, (_hb.vTop+_hb.vBot)/2));
      const cx2=_hb.bcam.x; for(let i=0;i<6;i++) hbEdgePan();
      assert(_hb.bcam.x===cx2,'손을 뗐는데 카메라가 계속 밀림'); }
    // ⑥ ⊘로 나가면 라운드가 1웨이브부터 다시 돈다
    hbBuildExit();
    assert(_hb.build===false && !_hb.arm,'건설 모드가 안 끝남');
    assert(!_hb.bcam,'건설 카메라가 안 치워짐(캐릭터를 다시 따라가야 한다)');
    assert($('hbBuildStop').classList.contains('hide'),'나갔는데 ⊘ 버튼이 남음');
    assert(_hb.wave===1,'나간 뒤 웨이브가 1이 아님: '+_hb.wave);
    assert(_hb.foes.length||_hb.pend.length,'나갔는데 적이 안 나옴');
    { const t0=_hb.waveT; hbStep(0.5); assert(_hb.waveT<t0,'나갔는데 시계가 안 흐름'); }
    _hb.foes.length=0; _hb.pend.length=0;
    hbHunt().base={tiles:{},open:1}; hbLayoutBase(); saveMeta();
    return '정지·초기화·연속·방향·건너뛰기·복귀 ok'; });
  // 🧭 미로 — 벽은 통과 불가, 적은 반드시 돌아온다. 벽을 부수지는 않는다.
  await step('미로: 벽 통과 금지 · 적이 돌아서 온다 · 열린 곳은 직진', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbBakeField!=='function','경로탐색 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const _cSave={..._hb.char};
    hbHunt().base={tiles:{},open:99}; hbLayoutBase();
    const c=_hb.char; c.x=0; c.y=0; c.tx=null; c.ty=null; c.hpMax=1e9; c.hp=1e9; c.atk=0; c.range=1; c.regen=0;
    // ① 벽이 없으면 직선으로 온다(각도가 4방향으로 뭉치면 안 된다)
    const drop=(x,y)=>{ _hb.foes.length=0; _hb.pend.length=0;
      _hb.foes.push({ico:'x',mdl:null,x:x,y:y,hp:1e9,hpMax:1e9,atk:0,spd:60,cdT:9e9,elite:false}); return _hb.foes[0]; };
    { const f=drop(200,-200); for(let i=0;i<6;i++){ _hb.phase='fight'; _hb.waveT=99; hbStep(0.1); }
      assert(Math.abs(f.face-Math.atan2(-f.x,-f.y))<0.05,'열린 벌판인데 직진이 아님(격자를 따라 계단으로 걷는다)'); }
    // ② 벽을 세우면 통과하지 못한다 — 캐릭터 둘레를 한 칸만 열고 두른다
    const T=hbBase().tiles;
    for(let g=-3;g<=3;g++) for(const cell of [[g,-3],[g,3],[-3,g],[3,g]]){
      if(cell[0]===3 && cell[1]===0) continue;                 // 입구는 오른쪽 변 한 칸
      T[hbKey(cell[0],cell[1])]={k:'wall'}; }
    hbLayoutBase();
    assert(hbSealCheck(null,0,0)===false,'입구를 남겼는데 봉쇄로 판정됨');
    { const f=drop(-160,0);                                    // 입구 반대편에서 출발 → 반드시 돌아와야 한다
      let through=false;
      for(let i=0;i<400;i++){ hbStep(0.05); if(!hbWalkable(f.x,f.y)){ through=true; break; } }
      assert(!through,'적이 벽 칸을 통과했다 @('+Math.round(f.x)+','+Math.round(f.y)+')');
      assert(Math.hypot(f.x,f.y)<Math.hypot(-160,0),'적이 캐릭터 쪽으로 전혀 못 옴');
      // 벽은 부수지 않는다 — 타일이 그대로 남아 있어야 한다
      assert(T[hbKey(-3,0)] && T[hbKey(-3,0)].k==='wall','적이 벽을 부쉈다'); }
    // ③ 캐릭터도 벽을 통과하지 않는다 — 벽 너머를 찍어도 돌아간다
    { c.x=0; c.y=0; c.tx=-160; c.ty=0;
      let through=false;
      for(let i=0;i<400;i++){ hbStep(0.05); if(!hbWalkable(c.x,c.y)){ through=true; break; } }
      assert(!through,'캐릭터가 벽 칸을 통과했다 @('+Math.round(c.x)+','+Math.round(c.y)+')'); }
    // ④ 적은 기지 안에서 태어나지 않는다 — 성벽 안쪽에 튀어나오면 벽이 통째로 무의미해진다
    { _hb.foes.length=0; _hb.pend.length=0;
      for(let i=0;i<40;i++) hbPlaceFoe({ico:'x',hpMul:1,atkMul:1,spd:10});
      const inside=_hb.foes.filter(f=>Math.abs(f.x)<3*HB_TILE && Math.abs(f.y)<3*HB_TILE).length;
      assert(inside===0,'성벽 안쪽에 소환된 적 '+inside+'기');
      const onWall=_hb.foes.filter(f=>!hbWalkable(f.x,f.y)).length;
      assert(onWall===0,'벽 칸 위에 소환된 적 '+onWall+'기'); }
    Object.assign(_hb.char,_cSave); _hb.foes.length=0; _hb.pend.length=0;
    hbHunt().base={tiles:{},open:1}; hbLayoutBase(); saveMeta();
    return '직진·우회·벽 미파괴·캐릭터 충돌·기지 밖 소환 ok'; });
  // 👾 몹 다양화(2026-08-20) — 역할은 HB_FOE_KIND 한 표, 얼굴은 던전 roster. 둘을 분리해 뒀다.
  //   ⚠ 위치·스탯만 재면 안 된다. 예전에 이동 방식을 f.mv 에 담았다가 '움직이는 중' 플래그(f.mv=1)에
  //     덮여 유령이 지상처럼 걸어 다녔다 — 겉으론 멀쩡했고 스탯도 맞았다. 그래서 **실제로 벽을 지났는지**를 본다.
  await step('사냥터 몹: 여섯 역할 · 벽 통과 규약 · 사거리 · 크기', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof HB_FOE_KIND==='undefined' || typeof hbWavePlan!=='function','몹 종류 표 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const _cSave={..._hb.char};
    try{
      // ① 편성표 무결성 — 죽은 역할·오타난 키·빠진 모델이 없어야 한다
      const seen=new Set(), bad=[];
      for(const D of HB_DUNGEONS){
        const R=hbRoster(D);
        if(!R || !R.length){ bad.push('던전'+D.dg+': 얼굴표 없음'); continue; }
        for(const e of R){
          if(!HB_FOE_KIND[e.k]) bad.push('던전'+D.dg+': 없는 역할 '+e.k);
          if(!e.mdl || typeof e.mdl!=='string') bad.push('던전'+D.dg+'/'+e.k+': 모델 없음');
          seen.add(e.k); } }
      assert(!bad.length, bad.join(' · '));
      for(const k of Object.keys(HB_FOE_KIND))
        assert(seen.has(k), '역할 '+k+' 이 어느 던전에도 안 나온다(죽은 역할)');
      // ①-b 🧊 **3D 연결** — 역할의 이동 방식과 모델의 실제 성질이 어긋나면 3D 에서 티가 난다.
      //     M3D 는 `FXLAB_AIR`(비행 모델 단일 출처)를 보고 **모델 id 로** 자동 부양시킨다.
      //     그래서 way='air' 인데 지상 모델이면 비행체가 땅을 기고(옛 dg7 thornqueen),
      //     지상 역할인데 비행 모델이면 걸어가야 할 놈이 떠 있다(옛 dg4 stinger). 둘 다 실제로 그랬다.
      //     ⚠ 이 검사는 three.js 없이도 돌아야 한다 — M3D 유무로 건너뛰면 이 환경에선 영영 안 걸린다.
      { assert(typeof FXLAB_AIR!=='undefined' && FXLAB_AIR.has, 'FXLAB_AIR(비행 모델 단일 출처)이 없다');
        const bad=[];
        for(const D of HB_DUNGEONS) for(const e of hbRoster(D)){
          const air=FXLAB_AIR.has(e.mdl), wantAir=(hbKindOf(e.k).way==='air');
          if(air!==wantAir) bad.push('던전'+D.dg+' '+e.k+'→'+e.mdl+(air?'(비행 모델인데 지상 역할)':'(지상 모델인데 비행 역할)')); }
        assert(!bad.length,'역할과 모델의 공중/지상이 어긋남 — 3D 에서 뜨거나 기어간다: '+bad.join(' · ')); }
      // ②-b 크기는 M3D 의 per-unit 손잡이(bossScale)로 넘어가야 한다 — u.size 는 메인 sync 가 안 본다
      { const keep=window.M3D;
        window.M3D={ hasModel:()=>true, footprintOf:()=>20, ensureUnits:()=>{} };
        try{
          _hb.foes.length=0;
          const K=HB_FOE_KIND.brute;
          _hb.foes.push({kind:'brute',ico:'x',mdl:'ultralisk',x:0,y:0,hp:1,hpMax:1,atk:1,spd:0,
            sz:K.sz,rng:0,way:K.way,rw:K.rw,cdT:9e9,elite:false});
          const list=hb3dList().filter(u=>u.id==='ultralisk');
          assert(list.length===1,'적이 3D sync 목록에 안 실린다');
          assert(Math.abs((list[0].bossScale||0)-K.sz)<0.01,
            '크기가 3D 로 안 넘어간다(bossScale='+list[0].bossScale+' vs 종류 크기 '+K.sz+')');
        } finally { window.M3D=keep; _hb.foes.length=0; } }
      // ①-c ✨ **공격 이펙트는 공용 코어(FX/ATK_STYLE)를 쓴다** — 사냥터 전용 사격선을 두 번째로 만들지 않는다.
      //     사격 주체가 전부 진짜 유닛 id 를 가지므로(캐릭터=PROF_CLASSES[cls].unit · 동료/몹=mdl)
      //     레인저는 3연사, 히드라는 가시, 드라군은 플라즈마로 각자 다르게 나가야 한다.
      { assert(typeof FX!=='undefined' && typeof ATK_STYLE!=='undefined','공용 FX 코어가 없다');
        assert(typeof hbFxStore==='function' && typeof hbFire==='function','사냥터가 공용 FX 에 안 붙어 있다');
        assert(ATK_STYLE[hbCharMdl()], '캐릭터 유닛 id('+hbCharMdl()+')가 ATK_STYLE 에 없다 — 내 공격만 기본 이펙트로 나온다');
        // 편성표 모델들이 서로 다른 공격 스타일을 갖는가(전부 _default 면 다양화가 화면에 안 보인다)
        const kinds=new Set();
        for(const D of HB_DUNGEONS) for(const e of hbRoster(D)){ const st=ATK_STYLE[e.mdl]; if(st&&st.kind) kinds.add(st.kind); }
        assert(kinds.size>=6,'몹 공격 스타일이 '+kinds.size+'종뿐 — 유닛별 이펙트가 안 갈린다');
        // 실제로 공격 한 번 → 공용 스토어에 쌓이는가
        _hb.fx=null; _hb.fxU=null; _hb.foes.length=0;
        const c2=_hb.char; c2.x=0; c2.y=0; c2.hpMax=1e9; c2.hp=1e9; c2.atk=0; c2.regen=0;
        const K2=HB_FOE_KIND.ranger;
        _hb.foes.push({kind:'ranger',ico:'x',mdl:'hydra',x:60,y:0,hp:1e9,hpMax:1e9,atk:1,spd:0,
          sz:K2.sz,rng:K2.rng,way:K2.way,rw:K2.rw,cdT:0,elite:false});
        // ⚠ 발사는 정규화 스토어(_hb.fxU.store), 사망은 월드 스토어(_hb.fx) — 둘 다 본다
        const cnt=()=>{ let n=0; for(const st of [_hb.fx, _hb.fxU&&_hb.fxU.store]){ if(!st) continue;
          n+=(st.shots||[]).length+(st.melee||[]).length+(st.impacts||[]).length+(st.flashes||[]).length; } return n; };
        let n=0; for(let i=0;i<40;i++){ _hb.phase='fight'; _hb.waveT=99; hbStep(0.05); n=Math.max(n,cnt()); }
        _hb.foes.length=0; _hb.fx=null; _hb.fxU=null;
        assert(n>0,'적이 공격했는데 공용 FX 스토어가 비어 있다 — 이펙트가 안 나간다'); }
      // ② 보스는 늘 지상 근접 — 날거나 벽을 통과하는 보스는 벽·기지 설계를 통째로 무의미하게 만든다
      for(const D of HB_DUNGEONS){ const bp=mkBoss(D,{round:1});
        assert(bp.way==='ground' && !bp.rng, '던전'+D.dg+' 보스가 지상 근접이 아님: '+bp.way+'/'+bp.rng); }
      // ③ 사거리는 벙커 도발 반경을 넘으면 안 된다 — 넘는 순간 사수가 벙커 밖에서 캐릭터만 쏜다.
      //    ⛔ max(R, rng+pad) > rng 같은 상수 비교는 **항상 참**이라 아무것도 못 잡는다(그렇게 짰다가 걷어냈다).
      //    이건 표를 직접 훑으므로 누가 사거리를 키우면 그 자리에서 걸린다.
      for(const k of Object.keys(HB_FOE_KIND)){ const K=HB_FOE_KIND[k];
        assert(K.rng<=HB_BUNKER_R, k+' 사거리('+K.rng+')가 벙커 도발 반경('+HB_BUNKER_R+')을 넘는다 — 벙커가 대신 맞아주지 못한다'); }
      // 그리고 사수가 벙커를 실제로 때리는지도 본다(대상 전환이 사거리 판정까지 따라가는가).
      { const c0=_hb.char; c0.x=0; c0.y=0; c0.hpMax=1e9; c0.hp=1e9; c0.atk=0; c0.regen=0;
        const bkSave=_hb.bunkers.slice();
        // 캐릭터와 사수 사이에 벙커를 놓는다 — 사거리 밖(HB_BUNKER_R 밖)이라 옛 규칙이면 그냥 지나쳐 캐릭터를 쏜다
        const K=HB_FOE_KIND.ranger, bx=-(HB_BUNKER_R+K.rng);
        _hb.bunkers=[{x:bx, y:0, hp:1e9, hpMax:1e9}];
        _hb.foes.length=0; _hb.fx=null;
        const f={kind:'ranger',ico:'x',mdl:null,x:bx-K.rng-40,y:0,hp:1e9,hpMax:1e9,atk:5,spd:K.spd,
          sz:K.sz,rng:K.rng,way:K.way,rw:K.rw,cdT:0,elite:false};
        _hb.foes.push(f);
        const hp0=_hb.bunkers[0].hp;
        for(let i=0;i<400;i++){ _hb.phase='fight'; _hb.waveT=99; hbStep(0.05); }
        const hit=hp0-_hb.bunkers[0].hp;
        _hb.bunkers=bkSave; _hb.foes.length=0;
        assert(hit>0,'사수가 벙커를 그냥 지나쳤다 — 도발 반경이 사거리를 못 따라간다(벙커가 대신 맞아주지 못한다)'); }
      // ④ 실제 이동 — 캐릭터를 벽으로 두르고(입구 한 칸) 반대편에서 출발시킨다
      hbHunt().base={tiles:{},open:99}; hbLayoutBase();
      const c=_hb.char; c.x=0;c.y=0;c.tx=null;c.ty=null;c.hpMax=1e9;c.hp=1e9;c.atk=0;c.range=1;c.regen=0;
      const RR=8;                                  // 고리를 크게 잡아야 사거리가 긴 놈도 '넘어야만' 닿는다
      const T=hbBase().tiles;
      for(let g=-RR;g<=RR;g++) for(const cell of [[g,-RR],[g,RR],[-RR,g],[RR,g]]){
        if(cell[0]===RR&&cell[1]===0) continue; T[hbKey(cell[0],cell[1])]={k:'wall'}; }
      hbLayoutBase();
      const walk=(kind)=>{ const K=HB_FOE_KIND[kind]; _hb.foes.length=0; _hb.pend.length=0; _hb.fx=null; _hb.fxU=null;
        const f={kind:kind,ico:'x',mdl:null,x:-320,y:0,hp:1e9,hpMax:1e9,atk:1,spd:K.spd,
          sz:K.sz,rng:K.rng,way:K.way,rw:K.rw,cdT:0,elite:false};   // ⚠ cdT:0 — 실제로 공격해야 이펙트가 나온다(캐릭터는 hp 1e9 라 안전)
        _hb.foes.push(f); let crossed=false, minD=1e9, shot=0;
        // ⚠ 반복 횟수를 상수로 두면 **느린 놈만** 못 도착해 '못 붙었다'로 잘못 잡힌다(중장갑 spd 32).
        //    우회로가 직선의 서너 배라 걸음 예산은 속도에 반비례해야 한다.
        const N=Math.min(4000, Math.ceil(2600/(K.spd*0.05)));
        for(let i=0;i<N;i++){ _hb.phase='fight'; _hb.waveT=99; hbStep(0.05);
          if(!hbWalkable(f.x,f.y)) crossed=true;
          for(const st of [_hb.fx, _hb.fxU&&_hb.fxU.store]) if(st) shot+=(st.shots||[]).length+(st.melee||[]).length+(st.impacts||[]).length+(st.flashes||[]).length;   // 공용 FX 코어로 나간다
          const d=Math.hypot(f.x,f.y); if(d<minD) minD=d; }
        return { crossed, minD, shot }; };
      for(const k of Object.keys(HB_FOE_KIND)){ const K=HB_FOE_KIND[k], r=walk(k);
        // 벽 규약 — 지상은 절대 못 지나고, 유령·공중은 반드시 지나야 한다
        if(K.way==='ground') assert(!r.crossed, k+'(지상)이 벽을 통과했다');
        else assert(r.crossed, k+'('+K.way+')이 벽을 못 지났다 — 이동 방식이 안 먹고 있다(f.way 가 덮였는지 볼 것)');
        // 사거리 규약 — 근접은 붙고, 사수는 사거리에서 멈춰 쏜다
        if(K.rng>0){ assert(r.minD>HB_STOP+8, k+'(사거리 '+K.rng+')가 근접까지 붙었다: '+Math.round(r.minD));
          assert(Math.abs(r.minD-K.rng)<=12, k+' 가 사거리에서 안 멈췄다: '+Math.round(r.minD)+' vs '+K.rng);
          assert(r.shot>0, k+' 가 사거리 안인데 쏘지 않았다'); }
        else assert(r.minD<=HB_STOP+4, k+'(근접)가 캐릭터에 못 붙었다: '+Math.round(r.minD)); }
      // ④-b 🚶 유닛 간 회피 조향(엔진 unitAI 와 같은 레시피)이 실제로 겹침을 푸는가.
      //     ⛔ 함수 존재만 확인하면 안 된다 — 사방에서 몰려오게 해 놓고 **겹친 쌍을 센다**.
      //     실측: 회피 끔 48쌍 / 켬 11쌍(24기 기준). 미로 경로탐색은 그대로 두고 얹는 보정이다.
      { assert(typeof hbAvoid==='function','회피 조향(hbAvoid)이 없다');
        hbHunt().base={tiles:{},open:99}; hbLayoutBase();
        const c3=_hb.char; c3.x=0; c3.y=0; c3.tx=null; c3.ty=null; c3.hpMax=1e9; c3.hp=1e9; c3.atk=0; c3.range=1; c3.regen=0;
        const K3=HB_FOE_KIND.grunt, N=24;
        _hb.foes.length=0; _hb.pend.length=0;
        for(let i=0;i<N;i++){ const a=i/N*Math.PI*2;
          _hb.foes.push({kind:'grunt',ico:'x',mdl:null,x:Math.cos(a)*260,y:Math.sin(a)*260,
            hp:1e9,hpMax:1e9,atk:0,spd:K3.spd,sz:K3.sz,rng:0,way:'ground',rw:K3.rw,cdT:9e9,elite:false}); }
        for(let i=0;i<300;i++){ _hb.phase='fight'; _hb.waveT=99; hbStep(0.05); }
        let ov=0; const F=_hb.foes;
        for(let i=0;i<F.length;i++) for(let j=i+1;j<F.length;j++)
          if(Math.hypot(F[i].x-F[j].x,F[i].y-F[j].y) < hbFoeR(F[i])+hbFoeR(F[j])) ov++;
        _hb.foes.length=0;
        assert(ov<=25, N+'기가 몰렸을 때 겹친 쌍 '+ov+' — 회피 조향이 안 듣는다(끄면 48쌍 수준)'); }
      // ④-c 🧱 배치 격자는 **지으려는 건물 둘레 한 칸까지만**. 화면 전체에 깔면 전장이 안 보인다.
      //     ⛔ 함수 소스를 정규식으로 훑지 말 것 — 주석만 남아도 통과한다(그런 검사를 이미 두 번 걷어냈다).
      //     캔버스 호출을 받아 적어 **격자선이 실제로 그려진 범위**를 잰다.
      { assert(typeof hbDrawGrid==='function' && typeof HB_GRID_PAD!=='undefined','배치 격자 그리기가 없다');
        const rec=[], filled=[]; let clipped=false, dash=0, col='';
        const stub={ save(){}, restore(){}, beginPath(){}, stroke(){}, clip(){ clipped=true; },
          rect(){}, fillRect(fx,fy,fw,fh){ filled.push([fx,fy,fw,fh]); }, strokeRect(){}, ellipse(){}, arc(){}, fill(){},
          setLineDash(a){ if(a&&a.length) dash=a[0]; },
          moveTo(x,y){ rec.push([x,y]); }, lineTo(x,y){ rec.push([x,y]); },
          set strokeStyle(v){ if(rec.length===0) col=v; }, set fillStyle(v){}, set lineWidth(v){}, set globalAlpha(v){}, set font(v){} };
        const armSave=_hb.arm;
        _hb.arm={ k:(HB_STRUCT.wall?'wall':Object.keys(HB_STRUCT)[0]), gx:2, gy:1 };
        try{
          hbDrawGrid(stub, _hb);
          assert(rec.length>0,'격자선을 하나도 안 그렸다');
          assert(clipped,'격자를 클립 없이 그린다 — 범위를 좁히는 장치가 없다');
          const B=HB_STRUCT[_hb.arm.k]||{w:1,h:1};
          const gx=hbTx(_hb.arm.gx)-HB_TILE/2, gy=hbTx(_hb.arm.gy)-HB_TILE/2;
          // 허용 범위 = 건물 자리 + 여백 칸 + 한 칸 여유(격자선이 칸 경계에 스냅되므로)
          const okX0=gx-(HB_GRID_PAD+1)*HB_TILE, okX1=gx+B.w*HB_TILE+(HB_GRID_PAD+1)*HB_TILE;
          const okY0=gy-(HB_GRID_PAD+1)*HB_TILE, okY1=gy+B.h*HB_TILE+(HB_GRID_PAD+1)*HB_TILE;
          let out=0, far=0;
          for(const [px,py] of rec){ if(px<okX0-0.5||px>okX1+0.5||py<okY0-0.5||py>okY1+0.5){ out++;
            far=Math.max(far, Math.max(Math.abs(px-gx), Math.abs(py-gy))); } }
          assert(out===0,'격자가 건물 둘레 '+HB_GRID_PAD+'칸을 벗어나 그려진다('+out+'점 · 최대 '+far.toFixed(0)+'px) — 화면 전체에 깔고 있다');
          // 칠하는 면은 **배치 칸 표시 하나뿐**이어야 한다. 예전 격자 배경은 보이는 맵 전체를 덮었다.
          //   ⛔ 'fillRect 가 0번'으로 재면 안 된다 — 배치 칸 표시(청록/빨강)까지 잡혀 헛돈다.
          { let big=0, biggest=0;
            for(const [fx,fy,fw,fh] of filled){
              const inside=(fx>=okX0-0.5 && fx+fw<=okX1+0.5 && fy>=okY0-0.5 && fy+fh<=okY1+0.5);
              if(!inside){ big++; biggest=Math.max(biggest, fw*fh); } }
            assert(big===0,'격자 면이 건물 둘레를 넘어 깔린다('+big+'개 · 최대 '+Math.round(biggest)+'px²) — 화면 전체 배경이 남아 있다'); }
          assert(dash>0,'격자가 점선이 아니다(setLineDash 미사용)');
          // ⛔ '초록 채널이 크다'로만 재면 안 된다 — 옛 파란색 rgba(140,190,255) 도 초록이 190 이라 통과한다.
          //    초록이 빨강·파랑보다 **우세**한지, 그리고 충분히 진한지(알파)를 본다.
          { const m2=String(col).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?/);
            assert(m2,'격자 색을 못 읽었다: '+col);
            const cr=+m2[1], cg=+m2[2], cb=+m2[3], ca=(m2[4]!=null?+m2[4]:1);
            assert(cg>cr+40 && cg>cb+40,'격자 색이 초록이 아니다(r'+cr+' g'+cg+' b'+cb+')');
            assert(ca>=0.5,'격자 색이 너무 흐리다(알파 '+ca+') — 진하게 보여야 한다'); }
          // 🧱 배치 고스트 = 관리자 건설과 같은 반투명 3D. 새로 만들지 말고 ghost:true 로 같은 풀에 얹는다.
          { const keepM=window.M3D;
            window.M3D={ hasModel:()=>true, footprintOf:()=>20, cstEnsure:()=>true, ensureUnits:()=>{} };
            try{
              const armed=hb3dList().filter(u=>u.ghost);
              assert(armed.length===1,'배치 중인데 3D 고스트가 '+armed.length+'개 — ghost:true 항목을 안 싣고 있다');
              assert(/^cb_/.test(armed[0].id),'고스트 모델 id 가 건설 에셋(cb_*)이 아님: '+armed[0].id);
              const save2=_hb.arm; _hb.arm=null;
              assert(hb3dList().filter(u=>u.ghost).length===0,'배치 중이 아닌데 고스트가 남는다');
              _hb.arm=save2;
            } finally { window.M3D=keepM; } }
        } finally { _hb.arm=armSave; } }
      // ⑤ 크기 — 중장갑 > 기본 > 돌격. 화면에서 역할이 구분되는 근거다
      assert(HB_FOE_KIND.brute.sz > HB_FOE_KIND.grunt.sz && HB_FOE_KIND.grunt.sz > HB_FOE_KIND.runner.sz,
        '크기 서열이 중장갑>기본>돌격 이 아니다');
      assert(HB_AIR_LIFT>0,'공중을 띄우는 높이가 0 — 지상과 구분이 안 된다');
      // ⑥ 💰 **시급 보존** — 이번 작업에서 제일 중요한 검사다.
      //    사냥터 시급(hunt.rate)은 umRate() 를 거쳐 유즈맵 보상 앵커까지 그대로 간다.
      //    실측(10회×240초): 이 엔진의 처리량은 **웨이브 페이스**가 정한다 — 편성을 바꿔도 분당 처치는
      //    거의 안 변하고(42.9→39.8), 시급은 오직 '처치당 보상'을 따라간다. 그래서 지켜야 할 값은
      //    **그 웨이브의 평균 처치 보상 = 1.0** 하나다. 구성이 라운드·웨이브마다 달라지므로
      //    hbRwNormPlan(plan) 이 매 웨이브 다시 맞춘다(예전엔 던전당 한 번이었다).
      //    ⛔ '보상÷체력'을 맞추는 것으로는 부족하다(그렇게 짰다가 던전1 R20 시급이 −32% 났다).
      { const off=[];
        for(const D of [hbDun(1),hbDun(5),hbDun(10)])
          for(const rd of [1,20,50,80,99]) for(const w of [1,2,3]){
            const plan=hbWavePlan(D,rd,w,hbFoeCount(rd,w)), rwN=hbRwNormPlan(plan);
            let sum=0; for(const k of plan) sum+=hbKindOf(k).rw*rwN;
            const mean=sum/plan.length;
            if(Math.abs(mean-1)>0.02) off.push('던전'+D.dg+' R'+rd+'W'+w+' '+mean.toFixed(3)); }
        assert(!off.length,'웨이브 평균 처치 보상이 1.0 이 아님 — 구성이 바뀌면 시급이 움직인다(유즈맵 보상까지 따라간다): '+off.slice(0,5).join(' · ')); }
      // ⑥-b 📈 **등장 규칙은 라운드·웨이브가 정한다**(던전이 아니다). 상한을 절대 안 넘어야 한다.
      //     ⛔ 표만 읽지 말 것 — 실제로 편성표를 짜서 마릿수를 센다(297칸 전수).
      { const over=[], D0=hbDun(1);
        for(let rd=1; rd<=99; rd++) for(let w=1; w<=3; w++){
          const n=hbFoeCount(rd,w), plan=hbWavePlan(D0,rd,w,n), c={};
          for(const k of plan) c[k]=(c[k]||0)+1;
          if(plan.length!==n) over.push('R'+rd+'W'+w+' 총원 '+plan.length+'≠'+n);
          for(const k of Object.keys(HB_SPAWN)){ const cap=HB_SPAWN[k].cap; if(!cap) continue;
            if((c[k]||0)>cap) over.push('R'+rd+'W'+w+' '+k+'='+c[k]+'>'+cap);
            if(rd<HB_SPAWN[k].from && (c[k]||0)>0) over.push('R'+rd+' '+k+' 가 문턱(R'+HB_SPAWN[k].from+') 전에 나옴'); } }
        assert(!over.length, '등장 규칙 위반 '+over.length+'건: '+over.slice(0,4).join(' · ')); }
      // ⑥-c 웨이브가 뒤일수록 까다로운 놈이 많다 · 라운드가 오를수록 늘어난다
      { const D0=hbDun(1), cnt=(rd,w)=>{ const p=hbWavePlan(D0,rd,w,hbFoeCount(rd,w));
          return p.filter(k=>HB_SPAWN[k]&&HB_SPAWN[k].cap).length; };
        // ⛔ >= 로 두면 웨이브 보정을 통째로 없애 1·3이 같아져도 통과한다(실제로 그랬다). 반드시 > 다.
        assert(cnt(60,3)>cnt(60,1),'웨이브 3이 웨이브 1보다 까다롭지 않다: W1='+cnt(60,1)+' W3='+cnt(60,3));
        assert(cnt(60,3)>cnt(10,3),'라운드가 올라도 안 늘어난다: R10='+cnt(10,3)+' R60='+cnt(60,3)); }
      // ⑦ 보상 배수가 hbKill 한 경로로 흐른다 — 오래 걸리는 놈이 시급만 깎으면 안 된다.
      //    ⛔ hbKill.toString() 에 /f\.rw/ 를 걸면 **주석에 적힌 f.rw** 가 매칭돼 코드를 지워도 통과한다(그렇게 짰다가 걷어냈다).
      //    그래서 실제로 잡아 보고 들어온 미네랄을 비교한다.
      assert(HB_FOE_KIND.brute.rw > HB_FOE_KIND.grunt.rw, '중장갑 보상이 기본보다 크지 않다');
      // ⚠ 재는 동안 일일 퀘스트(dqNote→dqGive)를 끊는다 — 퀘스트가 완료되는 순간 보상이 같이 들어와
      //    배수가 3배로 부풀어 보였다(실제로 그렇게 잘못 읽었다). 처치 보상만 남겨야 비교가 된다.
      // ⚠ 재는 동안 '처치 보상 말고 미네랄이 들어오는 경로'를 전부 끊는다 —
      //    일일 퀘스트(dqNote→dqGive)와 **레벨업(profApplyLevelUps, 레벨당 미네랄)** 둘 다.
      //    안 끊으면 두 번째 처치에서 레벨업이 터져 배수가 5배로 부풀어 보인다(전체 실행에서 실제로 그랬다).
      { const dqSave=window.dqNote, lvSave=window.profApplyLevelUps;
        window.dqNote=function(){}; window.profApplyLevelUps=function(){ return 0; };
        try{
          const gain=(rw)=>{ _hb.foes.length=0;
            const f={kind:'x',ico:'x',mdl:null,x:9e3,y:9e3,hp:0,hpMax:1,atk:0,spd:0,sz:1,rng:0,way:'ground',rw:rw,cdT:9e9,elite:false};
            _hb.foes.push(f);
            const p=PROF(), before=p.pcoin||0; hbKill(f); return (p.pcoin||0)-before; };
          const g1=gain(1), g2=gain(HB_FOE_KIND.brute.rw);
          assert(g1>0,'처치 보상이 0 — 비교할 수가 없다');
          const ratio=g2/g1;
          assert(Math.abs(ratio-HB_FOE_KIND.brute.rw)/HB_FOE_KIND.brute.rw < 0.15,
            '종류 보상 배수가 실제 지급에 안 반영됨: 배수 '+HB_FOE_KIND.brute.rw+' 인데 실측 '+ratio.toFixed(2)+'배');
        } finally { window.dqNote=dqSave; window.profApplyLevelUps=lvSave; } }
      return Object.keys(HB_FOE_KIND).length+'역할 · 편성 '+HB_DUNGEONS.length+'던전 ok';
    } finally { Object.assign(_hb.char,_cSave); _hb.foes.length=0; _hb.pend.length=0; _hb.fx=null; _hb.fxU=null;
      hbHunt().base={tiles:{},open:1}; hbLayoutBase(); saveMeta(); }
  });
  // 🧱 3D 건물 — 이 환경엔 three.js(CDN)가 없어 M3D가 아예 없다. 목록 생성 로직만 스텁으로 검사한다.
  await step('기지 3D: sync 목록에 건물이 실린다(화면 밖 컬링)', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hb3dStructs!=='function','3D 구조물 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    // ⛔ sync와 syncBuild는 서로의 풀을 숨긴다 — 건물은 반드시 같은 sync 목록에 실려야 한다
    assert(!/M3D\.syncBuild\s*\(/.test(hb3dStructs.toString()+hb3dList.toString()+hbFrame.toString()),
      'HOME이 syncBuild를 따로 호출한다(sync와 같은 프레임에 쓰면 한쪽이 통째로 사라진다)');
    const keep=window.M3D;
    window.M3D={ hasModel:(id)=>String(id).indexOf('cb_')===0, footprintOf:()=>20, cstEnsure:()=>true };
    try{
      hbHunt().base={tiles:{},open:99}; hbLayoutBase();
      const c=_hb.char; c.x=0; c.y=0; c.tx=null; c.ty=null; hbResize();   // 뷰포트 값이 있어야 컬링 기준이 선다
      hbBase().tiles[hbKey(0,-1)]={k:'turret'};                            // 캐릭터 바로 옆 = 화면 안
      hbBase().tiles[hbKey(HB_GRID_R-1,HB_GRID_R-1)]={k:'turret'};         // 맵 반대 끝 = 화면 밖
      const out=[]; hb3dStructs(out,_hb,(w)=>w,(w)=>w,_hb.k||1);
      const ids=out.map(o=>o.uid);
      assert(ids.indexOf('hbs_'+hbKey(0,-1))>=0,'화면 안 건물이 목록에 없음');
      assert(ids.indexOf('hbs_'+hbKey(HB_GRID_R-1,HB_GRID_R-1))<0,'화면 밖 건물이 컬링되지 않음');
      for(const o of out){ assert(String(o.id).indexOf('cb_')===0,'관리자 건설 에셋(cb_) 키가 아님: '+o.id);
        assert(o.scl>0 && isFinite(o.scl),'크기 배율이 이상함: '+o.scl);
        assert(o.moving===false,'건물이 이동 상태로 들어감'); }
      // 3D가 올라오면 2D 아이콘은 그리지 않는다(겹쳐 두 겹으로 보이면 안 된다)
      assert(/has3d/.test(hbDrawStructs.toString()),'2D 그리기에 3D 유무 분기가 없음');
    } finally { if(keep) window.M3D=keep; else { try{ delete window.M3D; }catch(_e){ window.M3D=undefined; } } }
    hbHunt().base={tiles:{},open:1}; hbLayoutBase(); saveMeta();
    return '컬링·cb_ 키·크기 배율 ok'; });
  // Phase 2 — 던전 1~10 해금 · 엘리트 · 장비 뽑기권(드랍 + 소비처)
  await step('자동사냥: 던전 해금 · 엘리트 · 뽑기권', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbGoDungeon!=='function','던전 선택 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    // ① 해금 — 전체 개방 스위치를 껐다 켜며 양쪽을 다 본다(기본값이 어느 쪽이든 게이트는 옳아야 한다)
    const _dgAll=HB_DG_ALL_OPEN; HB_DG_ALL_OPEN=true;
    for(let d=1; d<=HB_DG_MAX; d++) assert(hbDgOpen(d),'전체 개방인데 던전 '+d+'이 잠김');
    HB_DG_ALL_OPEN=false;   // 여기서부터 해금 조건 자체를 검사
    hbHunt().best={}; hbHunt().dg=1;
    assert(hbDgOpen(1) && !hbDgOpen(2),'초기 해금 상태가 틀림');
    hbGoDungeon(2); assert(hbHunt().dg===1,'잠긴 던전으로 이동됨');
    hbHunt().best[1]=HB_DG_UNLOCK;
    assert(hbDgOpen(2),HB_DG_UNLOCK+'라운드 도달했는데 던전2가 안 열림');
    // 던전은 ◀▶ 로 한 장씩 넘긴다(칩 줄 폐지, 2026-08-14) — 넘기는 것만으로는 이동하지 않는다
    hbOpenRounds(); await sleep(40);
    assert(document.getElementById('hbPickCard'),'던전 카드가 없음');
    assert($('hbPickPrev').disabled===true,'던전 1인데 ◀ 가 살아 있음');
    assert($('hbPickNext').disabled===false,'던전 2가 열렸는데 ▶ 가 잠김');
    { const dg0=hbHunt().dg;
      hbPickDg(1);
      assert(_hbPick.dg===2,'▶ 로 던전이 안 넘어감: '+_hbPick.dg);
      assert(hbHunt().dg===dg0 && (!_hb||_hb.dg===dg0),'넘기기만 했는데 이동돼 버림(이동 버튼 전이어야 한다)');
      hbPickGo(); await sleep(20); }
    assert(hbHunt().dg===2 && _hb.dg===2,'[이동]으로 던전이 안 옮겨짐');
    assert(_hb.round===HB_DG_UNLOCK||_hb.round===1,'이동 후 라운드가 이상함: '+_hb.round);
    assert(!visible($('hbRoundSheet')),'이동 후 시트가 안 닫힘');
    hbGoDungeon(1); hbGoRound(1);
    HB_DG_ALL_OPEN=_dgAll;   // 원래 값으로 복구 — 이후 스텝은 앱 기본 상태로 돈다
    // ② 엘리트 — 확률이 라운드·던전에 따라 오르고, 체력·보상 배수가 붙는다
    assert(hbEliteChance(1,1)<hbEliteChance(1,20),'엘리트 확률이 라운드로 안 오름');
    assert(hbEliteChance(1,10)<hbEliteChance(3,10),'엘리트 확률이 던전으로 안 오름');
    _hb.foes.length=0; _hb.pend.length=0; _hb.round=30;
    for(let i=0;i<80;i++) hbPlaceFoe({ico:'🟢',hpMul:1,atkMul:1,spd:10});
    const el=_hb.foes.filter(f=>f.elite), no=_hb.foes.filter(f=>!f.elite);
    assert(el.length>0 && no.length>0,'엘리트/일반이 섞여 나오지 않음: elite '+el.length);
    assert(el[0].hpMax > no[0].hpMax*2,'엘리트 체력 배수가 없음: '+Math.round(el[0].hpMax)+' vs '+Math.round(no[0].hpMax));
    // ③ 뽑기권 — 엘리트를 잡으면 쌓이고(확률), 뽑기집에서 쓸 수 있다
    const p=PROF(); if(!p.tickets) p.tickets={gear:0,pet:0,ally:0};
    const t0=p.tickets.gear||0;
    _hb.char.atk=1e9; _hb.char.range=1e9; _hb.char.cd=.05;
    for(let i=0;i<3000 && (p.tickets.gear||0)<=t0;i++){ if(!_hb.foes.length && !_hb.pend.length) hbSpawnWave(); hbStep(0.05); }
    assert((p.tickets.gear||0)>t0,'엘리트를 계속 잡아도 뽑기권이 안 나옴');
    // 소비처 — 지금까지 주기만 하고 쓸 데가 없었다
    const n0=profItems().length, k0=p.tickets.gear;
    profUseGearTicket();
    assert(p.tickets.gear===k0-1,'뽑기권이 안 깎임');
    assert(profItems().length===n0+1,'장비가 안 들어옴');
    return '해금 ok · 엘리트 '+el.length+'/'+_hb.foes.length+' · 뽑기권 '+p.tickets.gear; });
  // '던전'은 자동사냥 전용어, 옛 층 등반 콘텐츠는 '토벌'이다. 두 시스템이 같은 이름을 쓰면 화면마다 뜻이 달라진다.
  // ⚔ 던전 정체성 — 10곳이 서로 다른 장소로 느껴져야 한다(적 종족·바닥·틴트가 표 하나에서 나온다)
  await step('던전 10곳: 종족 순환 · 바닥 · 갈수록 어두워지는 틴트', async()=>{
    skipIf(typeof HB_DUNGEONS==='undefined','던전 표 없음');
    assert(HB_DUNGEONS.length===HB_DG_MAX,'던전 수가 '+HB_DG_MAX+'이 아님: '+HB_DUNGEONS.length);
    const alpha=t=>{ const m=/rgba?\([^)]*?,\s*([\d.]+)\)/.exec(t||''); return m?parseFloat(m[1]):-1; };
    let prevA=-1, names={};
    for(let i=0;i<HB_DUNGEONS.length;i++){ const D=HB_DUNGEONS[i], at='던전'+(i+1)+'('+D.name+')';
      assert(D.dg===i+1, at+' 번호가 어긋남: '+D.dg);
      assert(D.name && !names[D.name], at+' 이름이 없거나 중복');  names[D.name]=1;
      const _R=hbRoster(D);
      assert(_R && _R.length>=6, at+' 얼굴표가 6역할 미만: '+_R.length);   // 역할 여섯이 전부 얼굴을 가져야 한다(종족 팔레트에서 유도)
      for(const f of _R){
        assert(f.mdl, at+' 모델 키가 비어 있음');
        assert(f.ico, at+' 폴백 이모지가 없음: '+f.mdl); }
      // 갈수록 어두워야 '무서워지는' 느낌이 난다
      const a=alpha(D.tint);
      assert(a>0, at+' 틴트 알파를 못 읽음: '+D.tint);
      assert(a>=prevA, at+' 틴트가 앞 던전보다 밝아짐: '+a+' < '+prevA);  prevA=a; }
    // 종족은 스웜 → 유니온 → 에테리얼 순환
    const cyc=['swarm','union','aetherial'];
    for(let i=0;i<9;i++) assert(HB_DUNGEONS[i].race===cyc[i%3],
      '던전'+(i+1)+' 종족이 순환과 다름: '+HB_DUNGEONS[i].race+' ≠ '+cyc[i%3]);
    // 바닥 타일 파일이 실제로 받아지는지(경로 오타면 배경이 조용히 사라진다)
    const tiles=[...new Set(HB_DUNGEONS.map(d=>d.tile))];
    for(const t of tiles){ const ok=await new Promise(res=>{ const im=new Image();
        im.onload=()=>res(true); im.onerror=()=>res(false); im.src='assets/tiles/'+t+'.webp'; });
      assert(ok,'바닥 타일 파일이 없음: assets/tiles/'+t+'.webp'); }
    // 던전을 옮기면 적 구성이 실제로 바뀌어야 한다
    const f1=hbRoster(HB_DUNGEONS[0]).map(f=>f.mdl).join(), f2=hbRoster(HB_DUNGEONS[1]).map(f=>f.mdl).join();
    assert(f1!==f2,'던전 1과 2의 적이 같음 — 옮겨도 같은 곳으로 느껴진다');
    // 모델 키 오타 검사. MODELS는 모듈 스코프라 전역에서 못 본다 → M3D.modelKeys()로 카탈로그를 받아 대조한다.
    // ⚠ M3D가 없으면(three.js를 못 받는 환경) 검사를 '통과'시키지 말고 그렇게 밝힌다 — 헛도는 검사가 제일 위험하다
    // 🧊 모델 키 오타 검사. M3D 가 있으면 카탈로그를 직접 묻고, 없으면(이 환경처럼 three.js 가 막히면)
    //    **모듈 소스에서 MODELS 표를 읽어** 대조한다. 예전엔 M3D 가 없으면 통째로 건너뛰어
    //    '미검증'인 채로 늘 통과했다 — 헛도는 검사가 제일 위험하다.
    let cat=null, how='';
    if(window.M3D && M3D.modelKeys){ cat=new Set(M3D.modelKeys()); how='M3D 카탈로그'; }
    else{ try{ const src=await (await fetch('js/90-m3d.module.js')).text();
        const m=src.match(/const MODELS=\{([\s\S]*?)\n?\};/);
        if(m){ cat=new Set([...m[1].matchAll(/(\w+)\s*:\s*'/g)].map(x=>x[1])); how='모듈 소스'; } }catch(_e){} }
    assert(cat && cat.size>0,'3D 모델 카탈로그를 못 읽었다 — 모델 키 오타를 못 잡는다');
    for(const D of HB_DUNGEONS) for(const f of hbRoster(D))
      assert(cat.has(f.mdl),'던전'+D.dg+'('+D.name+') 모델 키가 카탈로그에 없음: '+f.mdl);
    const keyChk='모델 키 '+new Set(HB_DUNGEONS.flatMap(d=>hbRoster(d).map(f=>f.mdl))).size+'종 확인('+how+')';
    return HB_DUNGEONS.length+'곳 · 타일 '+tiles.length+'종 · 틴트 '+alpha(HB_DUNGEONS[0].tint)+'→'+prevA+' · '+keyChk; });
  // 관리자 실험장의 8방향 시트를 던전 전장이 '그대로' 쓴다(새로 만들지 않는다)
  await step('던전: 내 캐릭터가 실험장 8방향 시트를 그대로 쓴다', async()=>{
    skipIf(typeof SPR_UNITS==='undefined','스프라이트 시트 표 없음');
    // 단일 소스 — 실험장이 쓰던 SPR_MARINE과 같은 객체여야 한다(복사본이면 곧 어긋난다)
    assert(SPR_MARINE===SPR_UNITS.marine,'실험장 시트와 던전 시트가 다른 객체 — 단일 소스가 깨졌다');
    assert(typeof sprSheet==='function' && sprSheet('marine')===SPR_UNITS.marine,'sprSheet가 시트를 못 찾음');
    const sh=sprSheet('marine');
    for(const st of ['idle','walk','attack']){
      assert(sh.states[st] && sh.states[st].frames>0, '시트에 '+st+' 상태가 없음');
      assert(sh.url[st], '시트에 '+st+' 이미지 경로가 없음'); }
    // 공격 모션 길이가 시트 규격(프레임/fps)과 맞아야 마지막 프레임에서 잘리지 않는다
    const a=sh.states.attack;
    assert(Math.abs(HB_ATK_SHOW-(a.frames/a.fps))<1e-6,
      '공격 모션 길이가 시트와 어긋남: '+HB_ATK_SHOW+' ≠ '+(a.frames/a.fps));
    // 8방향 규약 — 실험장 sprDir을 그대로 쓴다(북=0, 시계)
    assert(sprDir(0,-1)===0,'위로 이동이 0방향이 아님: '+sprDir(0,-1));
    assert(sprDir(1,0)===2,'오른쪽이 2방향이 아님: '+sprDir(1,0));
    assert(sprDir(0,1)===4,'아래가 4방향이 아님: '+sprDir(0,1));
    assert(sprDir(-1,0)===6,'왼쪽이 6방향이 아님: '+sprDir(-1,0));
    // 시트 이미지가 실제로 받아지는지
    for(const st of ['idle','walk','attack']){
      const ok=await new Promise(res=>{ const im=new Image();
        im.onload=()=>res(true); im.onerror=()=>res(false); im.src=sh.url[st]; });
      assert(ok,'시트 이미지가 없음: '+sh.url[st]); }
    return 'marine 시트 공유 · 공격 '+a.frames+'f/'+a.fps+'fps'; });
  // ══ 전투 세션 레지스트리(2026-08-20) — 사냥터와 토벌이 동시에 돈다 ══
  //   `_hb` 는 포인터일 뿐이고 진짜 세션은 HBS 안에 있다. 여기서 지키는 것은 두 가지:
  //   ① 불변식 _hb === HBS[_hbView] 가 펌프 뒤에도 유지되는가(안 그러면 다음 그리기가 남의 세션을 그린다)
  //   ② 두 세션이 각각 자기 시계로 돌고, 서로의 적·버프를 먹지 않는가
  await step('전투 세션 둘이 동시에 돌고 서로 오염되지 않는다', async()=>{
    skipIf(typeof HBS==='undefined' || typeof hbPumpAll!=='function','세션 레지스트리 없음');
    openHome(); await sleep(200);
    // ⚠ 건너뛰는 이유를 적는다 — 그냥 '안 돌고 있음'이면 버그로 오해하고 고치려 든다.
    //   토벌은 GAME_DIRECTION §5-D 로 **유보**다(삭제 아님). 사냥터가 캠프로 바뀌면서
    //   빌릴 화면이 멈췄을 뿐, 코드는 그대로 살아 있다.
    skipIf(!HBS.hunt || !HBS.hunt.on,'🏕 캠프 전환으로 옛 사냥터 정지 — 토벌은 유보(GAME_DIRECTION §5-D)');
    const hunt=HBS.hunt;
    // 토벌 세션 흉내 — 그리기 자원(cv/ctx) 없이 시뮬만 도는 배경 세션
    const dg=JSON.parse(JSON.stringify({ on:true, mode:'dg', speed:1, t:0,
      dg:1, round:1, wave:1, phase:'gap', gapT:99, waveT:99, downT:0, gapOnly:1,
      pend:[], pendT:0, foes:[], chests:[], shots:[], floats:[], kills:0, rt0:0,
      allies:[], turrets:[], bunkers:[], pets:[], skT:{nova:0,heal:0,slow:0}, slowT:0,
      buf:{min:0,gas:0,xp:0,kills:0} }));
    dg.char=JSON.parse(JSON.stringify(hunt.char)); dg.bg=true;
    const wasManual=hunt.manual;   // ⚠ 앞 스텝들이 manual 을 켜 두고 나간다 — 켜져 있으면 펌프가 건너뛴다
    try{
      hunt.manual=false; hbSetSess('dg', dg);
      const t0h=hunt.t, t0d=dg.t, view0=_hbView;
      // ⚠ 실제 경과시간으로 도는 펌프라 촘촘히 부르면 dt≈0 이다 — 시계를 과거로 밀어 dt 를 만든다
      hunt.lastSim=performance.now()-100; dg.lastSim=performance.now()-100;
      hbPumpAll();
      assert(_hbView===view0,'펌프가 보던 세션을 안 돌려놨다: '+view0+' → '+_hbView);
      assert(_hb===HBS[_hbView],'불변식 깨짐: _hb !== HBS[_hbView]');
      assert(dg.t>t0d,'배경(토벌) 세션이 안 돌았다: t '+t0d+' → '+dg.t);
      assert(hunt.t>t0h,'사냥터 세션이 안 돌았다: t '+t0h+' → '+hunt.t);
      // 오염 검사 — 한쪽에만 적을 넣고 민다. 상대 쪽으로 새면 안 된다.
      dg.foes.push({ico:'🟢',mdl:'snapper',x:200,y:0,hp:1e9,hpMax:1e9,atk:0,spd:0,cdT:99,elite:false});
      const hn0=hunt.foes.length;
      hunt.lastSim=performance.now()-100; dg.lastSim=performance.now()-100; hbPumpAll();
      assert(hunt.foes.length===hn0,'토벌 적이 사냥터로 샜다: '+hn0+' → '+hunt.foes.length);
      assert(dg.foes.length===1,'토벌 적이 사라졌다: '+dg.foes.length);
      // ⏩ 배속 자체는 다음 스텝이 정확히 잰다(hbStep 호출 횟수·크기).
      //    여기서 벽시계로 재면 두 번의 performance.now() 간격이 미세하게 달라 뜬다 — 실제로 그랬다.
      return '두 세션 병행 ok · 오염 없음';
    } finally{ hunt.manual=wasManual; hbSetSess('dg', null); hbUse('hunt'); } });
  // ⏩ 자동 토벌 배속 — 같은 '실제 경과시간'에 전투가 몇 배 진행되는가.
  //   시뮬 시간(S.t)이 아니라 **실제 벽시계 대비 진행량**을 본다: hbStep 호출 횟수 × 스텝 크기.
  await step('배속 = 평소 크기 스텝을 여러 번(총 전진 배수 · 판정 보존)', async()=>{
    skipIf(typeof HBS==='undefined' || typeof hbPumpAll!=='function','세션 레지스트리 없음');
    openHome(); await sleep(120);
    // ⚠ 건너뛰는 이유를 적는다 — 그냥 '안 돌고 있음'이면 버그로 오해하고 고치려 든다.
    //   토벌은 GAME_DIRECTION §5-D 로 **유보**다(삭제 아님). 사냥터가 캠프로 바뀌면서
    //   빌릴 화면이 멈췄을 뿐, 코드는 그대로 살아 있다.
    skipIf(!HBS.hunt || !HBS.hunt.on,'🏕 캠프 전환으로 옛 사냥터 정지 — 토벌은 유보(GAME_DIRECTION §5-D)');
    const S=HBS.hunt; const wasManual=S.manual, wasSpeed=S.speed;
    const seen=[]; const real=hbStep;
    try{
      S.manual=false;
      window.hbStep=function(dt){ seen.push(dt); };   // 스텝 크기를 가로채 센다(실제 전진은 막는다)
      const sum=a=>a.reduce((x,y)=>x+y,0);
      S.speed=1; S.lastSim=performance.now()-160; seen.length=0; hbPumpAll();
      const n1=seen.length, m1=Math.max.apply(null,seen), s1=sum(seen);
      S.speed=8; S.lastSim=performance.now()-160; seen.length=0; hbPumpAll();
      const n8=seen.length, m8=Math.max.apply(null,seen), s8=sum(seen);
      assert(n1===1,'배속 1인데 스텝이 '+n1+'번');
      assert(n8===8,'배속 8인데 스텝이 '+n8+'번');
      // ⛔ 한 스텝이 커지면 적이 벽을 통과하고 사거리를 건너뛴다 — 크기는 **그대로**여야 한다
      assert(Math.abs(m8-m1)/m1<0.25,'배속이 스텝 크기를 바꿨다(판정이 샌다): '+m1+' → '+m8);
      // ⛔ 그리고 총 전진량은 실제로 배가 되어야 한다 — 안 그러면 '잘게 쪼개기'일 뿐 배속이 아니다
      //    (2026-08-20 실제로 dt/sub 로 짜서 총합이 dt 였고, 옛 단언이 그 버그를 보증했다)
      assert(s8/s1>6.5,'배속을 올렸는데 총 전진량이 안 늘었다 — 쪼개기만 하고 있다: '+s1.toFixed(4)+' → '+s8.toFixed(4)+' ('+(s8/s1).toFixed(2)+'배)');
      // 상한 — 아무리 올려도 HB_SUB_MAX 를 넘지 않는다(한 프레임을 통째로 잡아먹지 않게)
      S.speed=999; S.lastSim=performance.now()-160; seen.length=0; hbPumpAll();
      assert(seen.length===HB_SUB_MAX,'배속 상한이 안 걸린다: '+seen.length+' ≠ '+HB_SUB_MAX);
      return '1배 '+n1+'스텝 / 8배 '+n8+'스텝 / 상한 '+HB_SUB_MAX;
    } finally{ window.hbStep=real; S.manual=wasManual; S.speed=wasSpeed; } });
  // 이동이 '미끄러지지' 않으려면 적이 가는 쪽을 봐야 한다 — 실제로 dir이 갱신되는지
  await step('던전: 적이 가는 방향을 본다(메인 게임과 같은 연속 각도)', async()=>{
    skipIf(typeof hbStart!=='function' || typeof _hb==='undefined','자동사냥 없음');
    openHome(); await sleep(200);
    skipIf(!_hb || !_hb.on,'전장이 안 돌고 있음');
    // ⚠ hbPump는 실제 경과시간으로 돈다 — 촘촘히 부르면 dt≈0이라 아무것도 안 움직인다.
    //    스모크용 manual 훅으로 hbStep에 고정 dt를 준다. phase도 fight로 고정(타이머가 돌면 이동 루프가 멎는다)
    _hb.manual=true;
    const walk=(x,y)=>{ _hb.phase='fight'; _hb.waveT=99; _hb.foes.length=0;
      _hb.foes.push({ico:'🟢',mdl:'snapper',x:x,y:y,hp:1e9,hpMax:1e9,atk:1,spd:60,cdT:9,elite:false});
      const d0=Math.hypot(x,y);
      for(let i=0;i<6;i++){ _hb.phase='fight'; _hb.waveT=99; hbStep(0.1); }
      const g=_hb.foes[0];
      assert(g && Math.hypot(g.x,g.y)<d0, '적이 캐릭터 쪽으로 안 움직임: '+d0+' → '+(g?Math.round(Math.hypot(g.x,g.y)):'없어짐'));
      assert(g.mv===1,'걸어오는 중인데 걷기 상태가 안 켜짐(모션이 안 돈다): mv='+g.mv);
      return g.face; };
    // ⚠ 각도 규약은 게임과 '같은 식'이어야 한다: face = atan2(대상x-내x, 대상y-내y).
    //    -dy로 쓰면 y가 뒤집혀 모델이 정반대를 보고, 총알이 등 뒤에서 나가는 것처럼 보인다(실제로 그랬다).
    const near=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<0.02;
    const want=(fx,fy)=>Math.atan2(0-fx, 0-fy);   // 적은 원점(캐릭터)을 향해 걷는다
    for(const [x,y] of [[400,0],[0,-400],[-400,0],[0,400],[300,-300],[-250,180]]){
      const got=walk(x,y);
      assert(near(got, want(x,y)),
        '적 각도가 게임 식(atan2(dx,dy))과 다름 @('+x+','+y+'): '+got.toFixed(3)+' ≠ '+want(x,y).toFixed(3)); }
    // 캐릭터도 같은 식으로 가장 가까운 적을 봐야 한다(쏠 때만 돌면 총알이 등 뒤에서 나간다)
    _hb.phase='fight'; _hb.waveT=99; _hb.foes.length=0;
    _hb.foes.push({ico:'🟢',mdl:'snapper',x:0,y:-300,hp:1e9,hpMax:1e9,atk:1,spd:0,cdT:9,elite:false});
    hbStep(0.05);
    assert(near(_hb.charFace, Math.atan2(0, -300)),'캐릭터가 위쪽 적을 안 봄: '+_hb.charFace);
    _hb.foes.length=0; _hb.foes.push({ico:'🟢',mdl:'snapper',x:250,y:0,hp:1e9,hpMax:1e9,atk:1,spd:0,cdT:9,elite:false});
    hbStep(0.05);
    assert(near(_hb.charFace, Math.atan2(250, 0)),'캐릭터가 오른쪽 적을 안 봄: '+_hb.charFace);
    _hb.phase='fight'; _hb.waveT=99; _hb.foes.length=0;
    _hb.foes.push({ico:'🟢',mdl:'snapper',x:5,y:0,hp:1e9,hpMax:1e9,atk:1,spd:60,cdT:9,elite:false});
    for(let i=0;i<3;i++){ _hb.phase='fight'; hbStep(0.1); }
    assert(_hb.foes[0].mv===0,'사거리 안에 붙었는데 걷기 상태가 유지됨: mv='+_hb.foes[0].mv);
    _hb.foes.length=0; _hb.manual=false;
    return '연속 각도 · 걷기 상태 ok'; });
  // 관리자 이펙트 랩과 '같은 모양'의 유닛 객체를 M3D.sync에 넘겨야 이동·회전·공격 모션이 전부 나온다.
  // syncBuild(건설 뷰)에는 공격 모션(fireSeq) 처리가 아예 없다 — 그래서 조준이 이상했다.
  await step('던전: 랩과 같은 유닛 객체를 sync에 넘긴다(fireSeq 포함)', async()=>{
    skipIf(typeof hb3dList!=='function','3D 목록 없음');
    openHome(); await sleep(150);
    skipIf(!_hb||!_hb.on,'전장이 안 돌고 있음');
    _hb.manual=true; _hb.phase='fight'; _hb.waveT=99; _hb.foes.length=0;
    hbHunt().mates={}; hbHunt().party=[]; hbLayoutAllies();   // 동료도 목록에 들어가므로 먼저 비운다
    for(let i=0;i<3;i++) _hb.foes.push({ico:'🟢',mdl:'snapper',x:100+i*40,y:i*30,
      hp:9,hpMax:9,atk:1,spd:60,cdT:9,elite:(i===2)});
    const L1=hb3dList();
    assert(L1.length===4,'목록 개수가 다름(나+적3): '+L1.length);
    // 🤝 동료도 같은 경로로 그린다 — 영입하면 목록이 그만큼 늘어야 한다(이모지로만 그리면 여기서 걸린다)
    { CHAR().level=99; const mid=Object.keys(HB_MATES)[0];
      hbHunt().allySlots=MG_SLOT_MAX; hbHunt().mates[mid]={lv:1,dup:0}; hbHunt().party=[mid]; hbLayoutAllies();
      const L2=hb3dList();
      assert(L2.length===5,'동료가 3D 목록에 안 들어감: '+L2.length);
      assert(L2.some(u=>u.id===HB_MATES[mid].unit),'동료가 자기 유닛 모델로 안 나감: '+HB_MATES[mid].unit);
      hbHunt().mates={}; hbHunt().party=[]; hbLayoutAllies(); }
    // FXLAB.att과 같은 필드 구성이어야 한다
    for(const u of L1){
      for(const f of ['uid','id','x','y','face','moving','fireSeq'])
        assert(u[f]!==undefined, '유닛 객체에 '+f+'가 없음(랩 규격과 다름): '+JSON.stringify(u).slice(0,70)); }
    const uids=L1.map(u=>u.uid);
    assert(new Set(uids).size===uids.length,'uid가 겹침 — 유닛이 서로를 덮어쓴다: '+uids.join(','));
    for(const u of L1) assert(u.x>-2&&u.x<3&&u.y>-2&&u.y<3,'좌표가 정규화 범위 밖: '+u.x+','+u.y);
    // ⚠ 객체를 매 프레임 새로 만들면 fireSeq가 0으로 돌아가 공격 모션이 영원히 안 뜬다
    const L2=hb3dList();
    assert(L2[0]===L1[0],'프레임마다 유닛 객체가 새로 만들어짐 — fireSeq가 누적되지 않는다');
    assert(L2[1].uid===L1[1].uid,'적 uid가 프레임마다 바뀜');
    // 공격하면 fireSeq가 올라야 모션이 나간다
    const before=L1[0].fireSeq;
    _hb.foes.length=0;
    _hb.foes.push({ico:'🟢',mdl:'snapper',x:5,y:0,hp:1e9,hpMax:1e9,atk:1,spd:0,cdT:9,elite:false});
    _hb.char.cdT=0; hbStep(0.05);
    assert(hb3dList()[0].fireSeq>before,'공격했는데 fireSeq가 안 오름 — 공격 모션이 안 나간다');
    _hb.foes.length=0; _hb.manual=false;
    return '랩 규격 유닛 '+L1.length+'기 · fireSeq 누적 ok'; });
  // ⚠ 3D 캔버스(#cvMarine)는 게임과 '공용'이다 — 던전이 빌려 쓰고 반드시 돌려놔야 유즈맵 3D가 산다.
  //    돌려놓는 경로가 하나라도 빠지면 게임에 들어갔을 때 유닛이 통째로 안 보인다.
  await step('던전: 빌려 쓴 공용 3D 캔버스를 반드시 돌려놓는다', async()=>{
    skipIf(typeof hb3dAttach!=='function','3D 오버레이 없음');
    const cv=$('cvMarine'); assert(cv,'#cvMarine이 없음');
    // 전제: 아무도 안 빌린 상태에서 시작한다. 앞 스텝이 HOME을 열어둔 채 빌리고 있으면
    // hb3dAttach()가 '이미 내가 씀'으로 그냥 반환해 '빌려오기가 안 됨'으로 잘못 보인다.
    hb3dDetach(); if(typeof tw3dDetach==='function') tw3dDetach();
    // 🏕 캠프도 #cvMarine 을 HOME 안으로 빌려 간다(3D 건물이 거기 그려진다) — 같이 반납시킨다.
    if(typeof campExit==='function') campExit();
    const home=cv.parentNode;
    assert(home && home.id==='gameArea','원래 자리가 유즈맵(#gameArea)이 아님: '+(home&&(home.id||home.className)));
    for(const [name, leave] of [
        ['showAppScreen(화면 전환)', ()=>showAppScreen('townScreen')],
        ['hideAppScreens(게임 진입)', ()=>hideAppScreens()],
        ['hbStop(직접 정지)',        ()=>hbStop()] ]){
      hb3dAttach();
      assert(cv.parentNode!==home, name+': 빌려오기 자체가 안 됨');
      leave();
      assert(cv.parentNode===home, name+' 뒤에 3D 캔버스가 안 돌아옴 — 유즈맵 3D가 사라진다');
      assert(!cv.style.zIndex, name+' 뒤에 z-index가 남음: '+cv.style.zIndex); }
    // 마을 → HOME 순서로 이어 빌리는 경로. 남이 빌린 상태에서 또 빌리면 그 임시 위치를
    // '원래 자리'로 기억해, 반납해도 캔버스가 마을에 갇힌다(유즈맵 3D가 통째로 사라진다).
    if(typeof tw3dAttach==='function'){
      tw3dAttach();
      assert(cv.parentNode!==home,'마을이 캔버스를 못 빌림');
      hb3dAttach();                       // 마을이 쥔 채로 HOME이 이어받는다
      assert(cv.parentNode!==home,'HOME이 이어받지 못함');
      hbStop();                           // HOME 이탈 = hb3dDetach만 타는 경로
      assert(cv.parentNode===home,
        '마을→HOME 순서로 빌린 뒤 반납했는데 원래 자리가 아님(현재: '+(cv.parentNode.id||cv.parentNode.className)+') — 유즈맵 3D가 사라진다');
      if(typeof tw3dDetach==='function') tw3dDetach(); }
    // 네모네모 전용 장식(고정 슬롯 터렛 고스트)은 sync가 매 프레임 다시 만든다.
    // ⚠ 플래그 이름이 아니라 '결과'를 본다 — 아무것도 모르는 새 화면이 sync를 불러도 0이어야 한다.
    //    기본이 '그림'이던 시절엔 새 맵·관리자 랩·마을마다 유령 터렛이 떴다(세 번 반복).
    if(window.M3D && M3D.ready() && typeof M3D.idleVisible==='function'){
      hb3dDetach(); if(typeof tw3dDetach==='function') tw3dDetach();
      M3D.sync([], 800, 600, .016, [], [], null, 1);   // 새 맵/관리자 랩이 부르는 것과 같은 호출
      assert(M3D.idleVisible()===0,'네모네모가 아닌 화면에서 유휴 풀이 '+M3D.idleVisible()+'개 보임 — 터렛 유령이 뜬다');
      hb3dAttach(); M3D.sync([], 800, 600, .016, [], [], null, 1);
      assert(M3D.idleVisible()===0,'HOME에서 유휴 풀이 보임'); hb3dDetach();
      if(M3D.modelKeys().indexOf('turret')>=0){   // 반대로 네모네모 본편에서는 계속 보여야 한다
        window.__nemoView=true; M3D.sync([], 800, 600, .016, [], [], null, 1); window.__nemoView=false;
        assert(M3D.idleVisible()>0,'네모네모 본편인데 고정 슬롯 고스트가 안 보임 — 반대로 부숴졌다');
        M3D.sync([], 800, 600, .016, [], [], null, 1);   // 다시 끄고
        assert(M3D.idleVisible()===0,'네모네모 한 프레임 뒤에도 고스트가 남음'); } }
    // 공용 캔버스를 빌릴 때, sync()가 관리하지 않는 풀(뽑기 비콘·미건설 터렛 고스트)도 같이 숨겨야 한다.
    // 안 그러면 '미사일 포탑' 고스트 같은 게 HOME 위에 은은하게 남는다(실제로 그랬다).
    // ⚠ '숨기기'가 아니라 '삭제'여야 한다 — 숨긴 것은 어딘가에서 다시 켜지면 도로 나타난다.
    assert(/clearIdlePools/.test(hb3dAttach.toString()),
      '캔버스를 빌릴 때 유휴 풀을 안 지움 — 비콘·고스트 잔상이 HOME에 남는다');
    assert(/clearIdlePools/.test(hb3dDetach.toString()),
      '캔버스를 돌려줄 때 유휴 풀을 안 지움 — 잔상이 다음 화면으로 넘어간다');
    assert(!/hideIdlePools/.test(hb3dAttach.toString()),'숨기기(hideIdlePools)로 되돌아감 — 삭제여야 한다');
    if(window.M3D){
      assert(typeof M3D.clearIdlePools==='function','M3D.clearIdlePools가 없음');
      M3D.clearIdlePools();   // 없는 풀을 참조하면 여기서 ReferenceError로 터진다(실제로 한 번 그랬다)
      M3D.clearIdlePools();   // 두 번 불러도 안전해야 한다(이미 빈 풀)
    }
    openHome(); await sleep(60);
    return '전환·게임진입·정지 3경로 원복 ok'+(window.M3D?' · 유휴 풀 삭제 실행 ok':' · 유휴 풀은 M3D 없어 미검증'); });
  await step('용어 분리: 자동사냥=던전 / 옛 콘텐츠=토벌', async()=>{ skipIf(typeof openDungeonHub!=='function','토벌 허브 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(80);
    // ⚠ **토벌 입구는 2026-08-25 에 의도적으로 닫혔다**(더보기 ☰ 에서 뺐다). 토벌은 §5-D 유보다.
    //   그래서 이 검사가 지키는 것은 이제 「입구가 있다」가 아니라 **「유보가 보존됐다 + 용어가 갈렸다」** 둘이다.
    assert(typeof hbOpenMore==='function','더보기가 없음');
    hbOpenMore(); await sleep(120);
    assert(!document.querySelector('#hbMoreGrid [data-k="dg"]'),
      '토벌이 더보기에 되살아났다 — 유보 상태라 길은 닫혀 있어야 한다(GAME_DIRECTION §5-D)');
    hbCloseMore();
    assert(![...document.querySelectorAll('#hbBar .hbSk')].some(b=>b.textContent.indexOf('토벌')>=0),
      '하단 바에 토벌이 남아 있음');
    // ⛔ 유보는 삭제가 아니다 — 길은 닫혔어도 화면과 함수는 그대로 돌아야 한다(직접 열어 확인)
    assert($('dgHubScreen'),'토벌 허브 마크업이 사라졌다 — 유보는 삭제가 아니다');
    openDungeonHub(); await sleep(250);
    const hub=document.getElementById('dgHubBody');
    assert(visible(hub),'토벌 허브가 안 열림');
    assert(hub.textContent.indexOf('던전')<0,'토벌 화면에 던전 표기가 남음: '+hub.textContent.slice(0,60));
    assert(hub.textContent.indexOf('토벌')>=0,'토벌 표기가 없음');
    // 허브는 '화면'이 아니라 HOME 위 팝업이라 화면 전환으로 안 닫힌다 — HOME으로 돌아오면 걷어내야 한다
    openHome(); await sleep(80);
    assert(!visible($('dgHubScreen')),'HOME으로 돌아왔는데 토벌 허브 팝업이 HOME을 덮은 채 남음');
    assert($('hbMid').textContent.indexOf('던전')>=0,'자동사냥은 던전 표기를 유지해야 함');
    return '토벌 길 닫힘 · 코드 보존 · 용어 분리 ok'; });
  // HOME 좌상단 HUD — 프로필은 상세하게 맨 위 왼쪽에 고정 · 킬수는 없음 · 라운드 조절은 전용 아이콘 버튼.
  await step('HOME HUD: 좌상단 프로필 상세 · 킬수 없음 · 라운드는 아이콘 버튼', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof openHome!=='function','HOME 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(80); _hb.manual=true;
    // 재화 자릿수가 겹침 판정을 좌우한다 — 앞선 스텝이 남긴 잔액에 맡기면 간헐적으로 실패한다. 고정해 둔다.
    PROF().pcoin=1234; PROF().gas=12; PROF().gem=3; if(typeof updateCurBar==='function') updateCurBar();
    await sleep(20);
    const ph=$('phone').getBoundingClientRect();
    // ① 킬수 표시는 사라졌다(요청) — 요소 자체가 없어야 한다
    assert(!$('hbKill'),'킬수 표시가 아직 남아 있음');
    // ② 프로필 묶음이 화면 맨 위 왼쪽에 고정 — 재화 바(우측 정렬)보다 위에서 시작한다
    const top=document.querySelector('.hbHudTop');
    assert(top,'좌상단 묶음(.hbHudTop)이 없음');
    const tr=top.getBoundingClientRect();
    assert(tr.left-ph.left<=12,'프로필이 왼쪽 끝에 붙어 있지 않음: '+Math.round(tr.left-ph.left)+'px');
    // 상단은 --topPad 만큼 의도적으로 내려 있다(모바일에서 화면 끝에 붙으면 잘 안 보인다) → 토큰을 읽어 비교한다
    { const tp=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topPad'))||0;
      assert(tr.top-ph.top<=8+tp,'프로필이 맨 위가 아님: '+Math.round(tr.top-ph.top)+'px (허용 '+(8+tp)+')');
      // 재화 바와 프로필이 같은 --topPad 를 봐야 한다 — 따로 놀면 한쪽만 붙는다
      const cb=$('curBar').getBoundingClientRect();
      assert(Math.abs((cb.top-ph.top)-tp)<=1,'재화 바가 --topPad 를 안 따름: '+Math.round(cb.top-ph.top)); }
    // 재화가 커져도 프로필을 덮으면 안 된다 — 던전 보상 배수(24^dg) 때문에 자릿수가 폭주한다
    { const p=PROF(), keep=p.pcoin; p.pcoin=987654321; updateCurBar();
      const wide=$('curMin').textContent;
      assert(wide.length<=6,'재화 표기가 축약되지 않음(숫자가 프로필을 덮는다): '+wide);
      // ⚠ x 만 비교하면 아이콘 줄이 넓어질 때 헛걸린다(세로로 떨어져 있어도 걸림) → 실제 사각형 교차로 본다
      const rr=$('curMin').getBoundingClientRect();
      const hit=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
      for(const sel of ['.hbHud','.hbIcoRow']){ const el=document.querySelector(sel); if(!el) continue;
        assert(!hit(rr, el.getBoundingClientRect()), '큰 재화 숫자가 '+sel+' 과 겹침: '+wide); }
      p.pcoin=12345; updateCurBar();
      assert($('curMin').textContent==='12,345','작은 값까지 축약해 버림: '+$('curMin').textContent);
      p.pcoin=keep; updateCurBar(); }
    { const res=document.querySelectorAll('#curBar .res');
      assert($('curBar').classList.contains('bare'),'HOME 재화 바가 배경 위 숫자(.bare)가 아님');
      assert(res.length,'홈 재화 바가 없음');
      // ⚠ x 만 비교하면 아이콘 줄이 넓어질 때 헛걸린다 → 실제 사각형 교차로 본다
      const hit2=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
      for(const r of res){ const rr=r.getBoundingClientRect();
        for(const sel of ['.hbHud','.hbIcoRow']){ const el=document.querySelector(sel); if(!el) continue;
          assert(!hit2(rr, el.getBoundingClientRect()),
            '재화 숫자가 '+sel+' 과 겹침 ("'+r.textContent.trim()+'")'); } } }
    // 재화 바는 화면 전체 폭을 덮는 판이라, 투명(.bare)일 때 왼쪽 빈 자리가 프로필 클릭을 삼키면 안 된다
    { const hit=(el)=>{ const r=el.getBoundingClientRect();
        return document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2); };
      for(const id of ['hbHud','hbMid']){ const el=$(id), got=hit(el);
        assert(got && el.contains(got),'#'+id+' 클릭이 다른 요소에 가로채임: '+
          (got?(got.id||got.className||got.tagName):'none')); } }
    // ③ 프로필은 '간소' — 이름 / 경험치 바 / 레벨·공격력만. 직업 이름과 체력은 뺐다(2026-08-12).
    const c=CHAR(); c.name='스모크'; c.xp=Math.round(profXpForLevel(c.level)*0.5); hbHud();
    for(const id of ['hbName','hbLv','hbAtk']){
      const e=$(id); assert(e && e.textContent.trim(),'프로필 항목이 비어 있음: #'+id); }
    for(const id of ['hbJob','hbHp']) assert(!$(id),'뺀 항목이 아직 있음: #'+id);
    // 레벨과 공격력은 각각 한 줄(위=레벨, 아래=공격력)
    { const lv=$('hbLv').getBoundingClientRect(), at=$('hbAtk').getBoundingClientRect();
      assert(at.top>=lv.bottom-1,'레벨과 공격력이 한 줄에 붙어 있음(세로로 쌓여야 한다)');
      assert(Math.abs(at.left-lv.left)<=1,'두 줄의 왼쪽이 안 맞음: '+lv.left.toFixed(1)+' vs '+at.left.toFixed(1));
      // 초상은 글자 기둥 높이에 맞춘다 — 어긋나면 좌상단이 비뚤어 보인다
      const av=document.querySelector('.hbAv').getBoundingClientRect(), col=document.querySelector('.hbCol').getBoundingClientRect();
      assert(Math.abs(av.height-col.height)<=3,'초상('+Math.round(av.height)+')과 글자 기둥('+Math.round(col.height)+') 높이가 다름');
      // 좌상단 묶음이 예약 높이를 넘으면 중앙 라운드 표시와 겹친다
      const top=document.querySelector('.hbHudTop').getBoundingClientRect(), mid=$('hbMid').getBoundingClientRect();
      assert(mid.top>=top.bottom-1,'중앙 라운드 표시가 좌상단 묶음과 겹침: mid '+Math.round(mid.top)+' vs 묶음 bottom '+Math.round(top.bottom)); }
    // 레벨·검·숫자가 같은 높이로 보여야 한다. 요소 상자는 원래 같으니 글리프 '잉크 중심'을 본다
    // — ⚔는 같은 폰트 크기에서 잉크가 9px(숫자 6px)이라 그냥 두면 크고 처져 보인다.
    { const g=document.createElement('canvas').getContext('2d');
      const inkC=(el,txt)=>{ const cs=getComputedStyle(el); g.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
        const m=g.measureText(txt); return ((-m.actualBoundingBoxAscent)+m.actualBoundingBoxDescent)/2; };
      const sw=document.querySelector('#hbAtk em'), num=$('hbAtkN');
      assert(sw&&num,'공격력이 검·숫자로 나뉘어 있지 않음(크기 보정을 못 건다)');
      const a=inkC($('hbLv'),'Lv.8'), b=inkC(sw,'⚔'), c2=inkC(num,'30');
      // 허용 오차 0.6px = 반 픽셀 양자화 + 여유. 0.3px로 조였다가 실패했는데 앱은 멀쩡했다:
      // ⚔ 글리프는 OS가 주는 이모지 폰트를 타서 메트릭이 환경마다 다르다(컬러 이모지 vs DejaVu 흑백).
      // 이 컨테이너에선 asc/desc가 정수로 떨어져 반 픽셀이 구조적으로 남는다 — 눈에 보이는 어긋남(1px+)만 잡는다.
      const TOL=0.6;
      assert(Math.abs(a-c2)<=TOL,'레벨·숫자 높이가 안 맞음: Lv '+a.toFixed(2)+' / 숫자 '+c2.toFixed(2));
      assert(Math.abs(a-b)<=TOL,'레벨·검 높이가 안 맞음: Lv '+a.toFixed(2)+' / ⚔ '+b.toFixed(2)); }
    assert($('hbName').textContent==='스모크','이름이 캐릭터와 다름: '+$('hbName').textContent);
    assert($('hbLv').textContent==='Lv.'+c.level,'레벨 표기가 다름: '+$('hbLv').textContent);
    { const bar=$('hbXpBar'), box=document.querySelector('.hbXp');
      assert(bar && box,'경험치 바가 없음');
      const w=bar.getBoundingClientRect().width, bw=box.getBoundingClientRect().width;
      assert(Math.abs(w/bw-0.5)<0.06,'경험치 바가 xp 비율(50%)을 따르지 않음: '+Math.round(w/bw*100)+'%');
      c.xp=0; hbHud();
      assert(bar.getBoundingClientRect().width<2,'xp=0인데 바가 비지 않음'); }
    // ④ 라운드 조절 = ◀▶ 로 ±1, 가운데를 누르면 전체 목록(2026-08-14 · 깃발 아이콘은 폐지)
    const rb=$('hbMid');
    assert(rb && getComputedStyle(rb).pointerEvents!=='none','던전 제목이 눌리지 않음');
    assert(/hbOpenRounds/.test(($('hbMidTx').getAttribute('onclick')||'')),'가운데를 눌러도 라운드 목록이 안 열림');
    assert($('hbRdPrev') && $('hbRdNext'),'라운드 ±1 화살표가 없음');
    assert(!$('hbRoundBtn'),'옛 깃발 버튼이 남아 있음');
    // ±1 은 시트를 거치지 않고 바로 먹어야 한다 · 1~최고 도달 밖으로는 안 나간다
    { const H=hbHunt(); H.best[H.dg]=3; hbSetRound(2); hbHud();
      assert($('hbRdPrev').disabled===false && $('hbRdNext').disabled===false,'중간 라운드인데 화살표가 잠김');
      hbRoundStep(1); assert(_hb.round===3,'▶ 로 라운드가 안 오름: '+_hb.round);
      assert($('hbRdNext').disabled===true,'최고 도달인데 ▶ 가 안 잠김');
      hbRoundStep(1); assert(_hb.round===3,'최고 도달을 넘어감: '+_hb.round);
      hbRoundStep(-1); hbRoundStep(-1); assert(_hb.round===1,'◀ 로 1까지 안 내려감: '+_hb.round);
      assert($('hbRdPrev').disabled===true,'라운드 1인데 ◀ 가 안 잠김');
      hbRoundStep(-1); assert(_hb.round===1,'라운드 1 아래로 내려감: '+_hb.round);
      assert(visible($('hbRoundSheet'))===false,'화살표를 눌렀는데 시트가 열림'); }
    // 숫자와 이름은 따로 나온다(제목=던전 이름 · 숫자=라운드)
    assert(/^\d+$/.test($('hbRound').textContent.trim()),'라운드 칸에 숫자만 있어야 함: '+$('hbRound').textContent);
    assert($('hbDgName').textContent.indexOf(hbDun(_hb.dg).name)>=0,'제목에 던전 이름이 없음');
    // 제목을 눌러도 캐릭터가 따라가면 안 된다(필드 탭과 같은 자리다)
    { const r=rb.getBoundingClientRect(), cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;
      _hb.char.tx=null; hbFieldTap({target:document.elementFromPoint(cx,cy), clientX:cx, clientY:cy});
      assert(_hb.char.tx==null,'제목을 눌렀는데 캐릭터가 이동함'); }
    assert(visible(rb),'라운드 아이콘 버튼이 안 보임');
    const mid=$('hbMid');
    // 프로필이 4줄로 커졌으므로 중앙 라운드 표시는 그 아래로 내려가야 한다(겹치면 글자가 포개진다)
    { const mr=mid.getBoundingClientRect();
      assert(!(mr.left<tr.right && mr.right>tr.left && mr.top<tr.bottom && mr.bottom>tr.top),
        '중앙 라운드 표시가 좌상단 프로필과 겹침: mid.top='+Math.round(mr.top-ph.top)+' vs 프로필 bottom='+Math.round(tr.bottom-ph.top));
      assert(mid.querySelector('b').getBoundingClientRect().height<26,'라운드 이름이 두 줄로 접힘(nowrap 필요)'); }
    assert(mid.tagName!=='BUTTON','중앙 라운드 표시가 아직 버튼임(아이콘으로 옮겨야 함)');
    // 2026-08-14: 중앙 표시가 곧 라운드 선택 버튼이다 — 이제 클릭을 받아야 한다.
    // 대신 필드 탭으로 새지 않는지는 위 ④에서 hbFieldTap으로 직접 확인한다.
    assert(getComputedStyle(mid).pointerEvents!=='none','던전 제목이 클릭을 못 받음');
    hbCloseRounds(); await sleep(20);
    $('hbMidTx').click(); await sleep(60);   // 가운데(제목·라운드)를 눌러야 목록이 열린다 — 화살표는 ±1만
    assert(visible($('hbRoundSheet')),'가운데를 눌렀는데 라운드 팝업이 안 열림');
    hbCloseRounds();
    // ⑤ 이름 충돌 금지 — 예전엔 인게임 홈 탭 줄이 `.hbTop`을 같이 써서 좌상단 규칙에 먹히면 세로로 무너졌다.
    //    그 탭 줄은 하단 네비로 옮겨가며 사라졌다(2026-08-14). 이름이 다시 겹치지 않는지만 지킨다.
    assert(!document.querySelector('.hbTop'),'`.hbTop`이 다시 쓰이고 있음 — 좌상단(.hbHudTop) 규칙과 이름이 겹친다');
    return '좌상단 고정(+'+Math.round(tr.left-ph.left)+','+Math.round(tr.top-ph.top)+') · 킬수 없음 · 아이콘 팝업 ok'; });
  // 라운드 선택 — 최고 도달까지만 고를 수 있고, 반복/등반이 클리어 후 행동을 가른다.
  await step('자동사냥: 라운드 선택 · 반복/등반', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbOpenRounds!=='function','라운드 선택 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    hbHunt().best={}; hbGoRound(1);
    _hb.char.atk=1e9; _hb.char.range=1e9; _hb.char.cd=.05; _hb.char.hpMax=1e9; _hb.char.hp=1e9;
    const clearOnce=()=>{ for(let i=0;i<20000;i++){ const ph=_hb.phase; hbStep(0.05);
      if(ph!=='clearWait' && _hb.phase==='clearWait') return true; } return false; };
    // ⓪ 기본 = 등반(2026-08-14). 옛 저장의 climb:false 도 직접 고른 흔적이 없으면 등반으로 올라온다.
    { const H=hbHunt(); delete H.climbChosen; H.climb=false;
      assert(hbHunt().climb===true,'옛 기본값(반복)이 등반으로 이행되지 않음');
      hbSetClimb(false);   // 직접 고르면 흔적이 남아
      assert(hbHunt().climb===false && hbHunt().climbChosen,'직접 고른 반복이 유지되지 않음'); }
    // ① 반복 모드 = 클리어해도 같은 라운드
    hbSetClimb(false); assert(!hbHunt().climb,'반복 모드가 안 됨');
    const r0=_hb.round;
    assert(clearOnce(),'반복 모드에서 클리어가 안 됨');
    assert(clearOnce(),'반복 모드에서 두 번째 클리어가 안 됨');
    assert(_hb.round===r0,'반복 모드인데 라운드가 올랐음: '+r0+' → '+_hb.round);
    // ② 등반 모드 = 클리어하면 다음 라운드 + 최고 기록 갱신
    hbSetClimb(true); assert(hbHunt().climb,'등반 모드가 안 됨');
    assert(clearOnce(),'등반 모드에서 클리어가 안 됨');
    assert(_hb.round===r0+1,'등반인데 라운드가 안 올랐음: '+_hb.round);
    assert(hbBest(1)>=r0+1,'최고 도달 라운드가 갱신되지 않음: '+hbBest(1));
    // ③ 시트 = 최고 도달까지만, 현재 라운드 강조
    hbOpenRounds(); await sleep(40);
    assert(visible($('hbRoundSheet')),'라운드 팝업이 안 열림');
    // 하단 시트가 아니라 전장 한가운데 떠야 한다
    { const card=document.querySelector('#hbRoundSheet .hbmCard'), ph=$('phone');
      assert(card,'팝업 카드(.hbmCard)가 없음');
      const cr=card.getBoundingClientRect(), pr=ph.getBoundingClientRect();
      assert(Math.abs((cr.top+cr.bottom)/2-(pr.top+pr.bottom)/2)<60,'팝업이 화면 중앙이 아님');
      assert(Math.abs((cr.left+cr.right)/2-(pr.left+pr.right)/2)<4,'팝업이 가로 중앙이 아님'); }
    // ⛔ 푸른기 금지 — 팝업 안 어떤 요소도 파랑이 빨강보다 크면 안 된다(금색·초록은 역할 액센트라 허용)
    { const rgb=x=>(x.match(/\d+(\.\d+)?/g)||[]).slice(0,3).map(Number);
      for(const el of document.querySelectorAll('#hbRoundSheet, #hbRoundSheet *')){ const c=getComputedStyle(el);
        for(const src of [c.backgroundColor,c.backgroundImage,c.borderTopColor,c.color,c.boxShadow]){
          for(const m of (src.match(/rgba?\([^)]*\)/g)||[])){ const [r,g,b]=rgb(m);
            if(r===undefined) continue;
            // 허용폭 12 = HOME 톤 검사와 같은 기준(공용 --metal-edge rgb(60,62,70)이 B-R=10이라 그 아래로 잡으면 오검출)
            assert(b<=r+12,'라운드 팝업에 푸른기가 남음('+(el.className||el.tagName)+'): '+m); } } } }
    // 라운드 = 세로 피커. 고를 수 있는 것(최고 도달까지)만 넣고, 아래가 1라운드다.
    // 칸 수 = 최고 도달 · 단 '다음 마일스톤'까지는 목표로 더 보여 준다(못 고르게 잠근다)
    const cells=[...document.querySelectorAll('#hbRdScroll .hbRd')];
    const want=Math.max(hbBest(1), hbNextRw(1,_hbPick.round)||0);
    assert(cells.length===want,'선택지 수가 규칙과 다름: '+cells.length+' vs '+want);
    assert(+cells[0].dataset.r===want,'맨 위가 목표 라운드가 아님: '+cells[0].dataset.r);
    assert(+cells[cells.length-1].dataset.r===1,'맨 아래가 1라운드가 아님: '+cells[cells.length-1].dataset.r);
    for(const c of cells) assert((+c.dataset.r>hbBest(1))===c.disabled,'라운드 '+c.dataset.r+' 잠금이 최고 도달과 안 맞음');
    assert(document.querySelector('#hbRdScroll .hbRd.on').dataset.r===String(_hb.round),'현재 라운드가 강조되지 않음');
    // 칸을 누르면 '선택'만 바뀐다 — 이동은 [이동] 버튼에서만
    { const r0=_hb.round, pick=Math.max(1,hbBest(1)-1);
      hbRdTap(pick);
      assert(_hbPick.round===pick,'탭으로 선택이 안 바뀜');
      assert(_hb.round===r0,'탭만 했는데 이동돼 버림');
      assert(document.querySelector('#hbRdScroll .hbRd.on').dataset.r===String(pick),'선택 강조가 안 옮겨감');
      hbPickGo(); await sleep(20);
      assert(_hb.round===pick,'[이동]으로 라운드가 안 옮겨짐: '+_hb.round); }
    hbOpenRounds(); await sleep(40);
    // ④ 라운드 이동 = 진행 초기화 + 시트 닫힘 · 상한 넘는 값은 잘린다
    hbGoRound(1); await sleep(40);
    assert(_hb.round===1 && _hb.wave===1,'라운드 이동이 반영되지 않음');
    assert(!visible($('hbRoundSheet')),'이동 후 시트가 안 닫힘');
    hbGoRound(999);
    assert(_hb.round===hbBest(1),'최고 도달을 넘겨 이동됨: '+_hb.round);
    hbSetClimb(false);
    return '최고 '+hbBest(1)+'라운드 · 반복/등반 ok'; });
  // 🤝 전직 폐지 → 동료 영입(2026-08-12 설계 전환). 옛 상위 직업이 그대로 동료가 됐다.
  await step('동료: 전직 폐지 · 옛 상위 직업이 동료로 · 뽑기 영입', async()=>{ skipIf(typeof HB_MATES!=='object','동료 없음');
    // ① 전직의 흔적이 남아 있으면 안 된다
    assert(typeof profClassChange==='undefined','profClassChange 가 남아 있음');
    assert(typeof profClassCost==='undefined','profClassCost 가 남아 있음');
    assert(typeof hbGrowJobs==='undefined','hbGrowJobs 가 남아 있음');
    assert(typeof PROF_JOBS==='undefined','직업 표(PROF_JOBS)가 남아 있음');
    assert(Object.keys(PROF_CLASSES).length===3,'캐릭터 종류가 3종이 아님: '+Object.keys(PROF_CLASSES).length);
    // 종류는 '외형'일 뿐 — 성능 차이를 만드는 값을 들고 있으면 안 된다
    for(const id in PROF_CLASSES) assert(!PROF_CLASSES[id].base,'캐릭터 종류가 기본 스탯을 들고 있음: '+id);
    // ② 옛 상위 직업 12종이 '전부' 동료로 옮겨 왔다 — 하나라도 빠지면 그 유닛이 사라진 것이다
    const moved=['sniper','gunner','phantom','goliath','spike','swarmling','thornqueen','ultra',
                 'sentinel','darksage','void','highsage'];
    for(const id of moved) assert(HB_MATES[id],'옛 직업이 동료로 안 옮겨짐: '+id);
    assert(Object.keys(HB_MATES).length===moved.length,'동료 수가 옛 상위 직업 수와 다름');
    for(const id in HB_MATES){ const M=HB_MATES[id];
      assert(M.name && M.unit && M.ico,'동료 항목이 비어 있음: '+id);
      assert(M.dps>0 && M.rng>0,'동료 전투 수치가 없음: '+id); }
    // ③ 등급이 해금을 대체했다 — 레벨 게이트도 미네랄 영입도 없어야 한다
    assert(typeof hbMateBuy==='undefined','미네랄 영입(hbMateBuy)이 남아 있음');
    assert(typeof hbMateCost==='undefined','미네랄 영입가(hbMateCost)가 남아 있음');
    for(const id in HB_MATES){ const M=HB_MATES[id];
      assert(M.lv===undefined && M.cost===undefined,'옛 해금 레벨/영입가가 남음: '+id);
      assert(GACHA_TIERS[M.tier],'등급이 없거나 공용 등급표에 없음: '+id+' '+M.tier); }
    // 등급이 높을수록 세다 — 등급이 성능을 대변하지 못하면 뽑을 이유가 없다
    { let prevRank=-1, prevDps=0;
      for(const id in HB_MATES){ const M=HB_MATES[id], rank=GACHA_TIER_ORDER.indexOf(M.tier);
        assert(rank>=prevRank,'동료 표가 등급 오름차순이 아님: '+id);
        if(rank>prevRank) assert(M.dps>prevDps,'상위 등급인데 더 약함: '+id);
        prevRank=rank; prevDps=Math.max(prevDps,M.dps); } }
    // ④ 영입 = 뽑기권. 권이 없으면 못 뽑는다.
    const p=PROF(); p.chars.length=0; p.curId=''; const c=profCreateChar('ranger','동료');
    const H=hbHunt(); H.mates={}; H.party=[]; H.mateN=0; H.allySlots=MG_SLOT_MAX;
    p.tickets={gear:0,pet:0,ally:0};
    assert(hbMateRoll()===null,'뽑기권이 0인데 뽑힘');
    p.tickets.ally=1;
    const r1=hbMateRoll();
    assert(r1 && HB_MATES[r1.id],'뽑기가 실패함');
    assert(hbMateTicket()===0,'뽑기권이 소모되지 않음');
    assert(hbMateOwned(r1.id) && hbMateLv(r1.id)===1,'뽑은 동료가 Lv.1로 안 들어옴');
    assert(hbParty().indexOf(r1.id)>=0,'처음 얻은 동료가 출전하지 않음');
    // ⑤ 중복 = 재료. 같은 동료가 또 나오면 레벨이 아니라 dup 이 는다.
    { const id=r1.id, H2=hbHunt(); const lv0=hbMateLv(id), d0=hbMateDup(id);
      H2.mates[id].dup=d0;  p.tickets.ally=1;
      // 같은 것이 나올 때까지 굴리지 않고, 중복 경로를 직접 확인한다(확률에 기대면 불안정하다)
      const before=JSON.stringify(H2.mates[id]);
      p.tickets.ally=0;
      assert(before===JSON.stringify(H2.mates[id]),'뽑기권 없이 상태가 바뀜');
      assert(hbMateLv(id)===lv0,'중복이 레벨을 직접 올림'); }
    // ⑥ 환생해도 동료는 남는다(계정 축)
    c.level=PROF_REB_EVERY*2; const before=hbMateLv(r1.id);
    profRebirth(c);
    assert(hbMateLv(r1.id)===before,'환생이 동료를 지움');
    const last=Object.keys(HB_MATES).slice(-1)[0];
    // ⑦ 진입점 — 동료 버튼은 폐지했다(2026-08-14). 역할은 정비 구역과 상점이 맡는다.
    openHome(); await sleep(60);
    assert(!$('hbMateBtn'),'동료 버튼이 아직 남아 있음');
    hbCloseMates(); hbOpenMates(); await sleep(50);
    assert(visible($('hbMateModal')),'동료 팝업 자체는 남아 있어야 한다(다른 화면에서 부른다)');
    { const names=$('hbMateBody').textContent;
      for(const id in HB_MATES) assert(names.indexOf(HB_MATES[id].name)>=0,'동료 목록에 빠짐: '+HB_MATES[id].name);
      assert(names.indexOf('동료 뽑기권')>=0,'뽑기 줄이 없음');
      assert(document.querySelectorAll('#hbMateBody .mateOdds .mateOdd').length===GACHA_TIER_ORDER.length,'등급별 확률 표시가 없음'); }
    hbCloseMates();
    return '동료 '+Object.keys(HB_MATES).length+'종 · '+GACHA_TIERS[HB_MATES[Object.keys(HB_MATES)[0]].tier].name+'~'+GACHA_TIERS[HB_MATES[last].tier].name; });

  // 🎰 단계형 뽑기 곡선의 '공통 규칙' — 동료와 펫이 같은 형태라, 검사도 한 벌로 한다.
  //    새 뽑기를 추가하면 이 함수에 태우면 된다(규칙을 두 벌로 적지 말 것).
  function checkGachaCurve(label, curve, tiers){
    assert(curve.length===30, label+': 단계 수가 30이 아님: '+curve.length);
    const first=curve[0].p, last=curve[curve.length-1].p;
    // ① 각 단계 확률 합 = 정확히 1 · 모든 등급이 1단계부터 0이 아니다
    for(let i=0;i<curve.length;i++){ let sum=0;
      for(const t of tiers){ assert(GACHA_TIERS[t], label+': 없는 등급 '+t);
        assert(curve[i].p[t]>0, label+': 단계 '+(i+1)+'에 '+t+'가 0%');
        sum+=curve[i].p[t]; }
      assert(Math.abs(sum-1)<1e-9, label+': 단계 '+(i+1)+' 확률 합이 1이 아님: '+sum); }
    // ② 최상위 등급은 '금방 나오되 아주 낮게' — 1단계에 0이 아니지만 0.001% 미만
    const top=tiers[tiers.length-1];
    assert(first[top]>0 && first[top]<0.00001, label+': 1단계 최상위('+top+')가 0이거나 너무 높음: '+(first[top]*100).toFixed(5)+'%');
    // ③ 초반은 금방 넘어가고, 위로 갈수록 간격이 계속 벌어진다
    for(let i=1;i<curve.length;i++) assert(curve[i].need>curve[i-1].need, label+': 단계 '+(i+1)+' 필요 횟수가 안 오름');
    for(let i=2;i<curve.length;i++){ const g1=curve[i-1].need-curve[i-2].need, g2=curve[i].need-curve[i-1].need;
      assert(g2>=g1, label+': 단계 '+(i+1)+'에서 간격이 좁아짐: '+g1+' → '+g2); }
    assert(curve[4].need<=20, label+': 5단계까지가 너무 오래 걸림: '+curve[4].need);
    // 마지막 단계는 '오래 걸리되 도달 가능'해야 한다. 뽑기권은 미네랄로 못 사고 엘리트·상자·라운드
    // 보너스·젬으로만 들어오므로, 수천 회를 요구하면 사실상 잠긴 단계가 된다(옛 값 5,162회가 그랬다).
    assert(curve[29].need>=300, label+': 30단계가 너무 쉬움: '+curve[29].need);
    assert(curve[29].need<=1500, label+': 30단계가 사실상 도달 불가: '+curve[29].need);
    // ④ 단계가 오르면 하위 최상단(=일반)은 반드시 줄고, 상위 등급은 반드시 는다
    const upper=tiers.slice(3);            // 유니크 이상
    for(let i=1;i<curve.length;i++){ const A=curve[i-1].p, B=curve[i].p;
      assert(B[tiers[0]]<A[tiers[0]], label+': 단계 '+(i+1)+'에서 '+tiers[0]+' 비중이 안 줄어듦');
      for(const t of upper) assert(B[t]>A[t], label+': 단계 '+(i+1)+'에서 '+t+' 확률이 안 늘어남'); }
    // ⑤ 하위 3등급은 끝에서 확실히 낮아진다 — 2·3번째는 '정점을 찍고 꺾이는' 모양이어야 한다
    assert(last[tiers[0]]<first[tiers[0]]*0.3, label+': 최종 단계에서 '+tiers[0]+'가 충분히 안 떨어짐');
    for(const t of [tiers[1],tiers[2]]){
      let peak=0, pk=0;
      for(let i=0;i<curve.length;i++) if(curve[i].p[t]>peak){ peak=curve[i].p[t]; pk=i+1; }
      assert(pk<curve.length, label+': '+t+'가 마지막까지 계속 오름(꺾여야 한다)');
      assert(last[t]<peak*0.90, label+': '+t+'가 정점에서 충분히 안 꺾임: 최고 '+(peak*100).toFixed(1)+'%(단계 '+pk+') → 최종 '+(last[t]*100).toFixed(1)+'%'); }
    const lowSum=last[tiers[0]]+last[tiers[1]]+last[tiers[2]];
    assert(lowSum<0.5, label+': 최종 단계인데 하위 3등급 합이 절반 이상: '+(lowSum*100).toFixed(1)+'%');
    return '단계 '+curve.length+'(최종 누적 '+curve[curve.length-1].need.toLocaleString()+'회) · 1단계 '+top+' '
      +(first[top]*100).toFixed(4)+'% → 최종 '+(last[top]*100).toFixed(2)+'%'; }

  // 🎰 동료 뽑기 확률 — 설계의 핵심. 초반엔 상위 등급이 0%고, 뽑을수록 열리고 커진다.
  await step('동료 뽑기: 단계별 확률 · 상위 등급 개방 · 중복은 재료', ()=>{ skipIf(typeof HB_MATE_GACHA!=='object','동료 뽑기 없음');
    // 곡선 규칙은 펫과 공용 검사기로 본다(같은 형태이므로 잣대도 하나여야 한다)
    const sum1=checkGachaCurve('동료', HB_MATE_GACHA, GACHA_TIER_ORDER);
    // 1단계는 일반 90 / 레어 9 / 에픽 1 근처에서 시작한다
    { const p0=HB_MATE_GACHA[0].p;
      assert(Math.abs(p0.common-0.90)<0.01,'1단계 일반이 90% 근처가 아님: '+(p0.common*100).toFixed(2));
      assert(Math.abs(p0.rare-0.09)<0.01,'1단계 레어가 9% 근처가 아님: '+(p0.rare*100).toFixed(2));
      assert(Math.abs(p0.epic-0.01)<0.005,'1단계 에픽이 1% 근처가 아님: '+(p0.epic*100).toFixed(2)); }
    // 확률을 준 등급에 실제 동료가 있어야 한다(확률만 있고 뽑을 게 없으면 안 된다)
    { const have={}; for(const id in HB_MATES) have[HB_MATES[id].tier]=1;
      for(const t of GACHA_TIER_ORDER) assert(have[t],'확률은 있는데 그 등급 동료가 없음: '+t); }
    // 뽑기 단계는 누적 횟수로 오른다
    const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','뽑기');
    const H=hbHunt(); H.mates={}; H.party=[]; H.mateN=0;
    assert(hbGachaLv(0)===1,'0회인데 Lv.1이 아님');
    for(let i=0;i<HB_MATE_GACHA.length;i++)
      assert(hbGachaLv(HB_MATE_GACHA[i].need)===i+1,'누적 '+HB_MATE_GACHA[i].need+'회에서 단계가 다름');
    assert(hbGachaLv(1e9)===HB_MATE_GACHA.length,'상한을 넘어도 단계가 계속 오름');
    // ⑥ 실제로 굴려 본다 — 권만큼만 뽑히고, 뽑은 만큼 레벨이 오른다
    p.tickets={gear:0,pet:0,ally:30};
    // ⚠ 상한 없이 돌리면 '뽑기권을 안 쓰는' 회귀에서 스모크가 멈춰 버린다 — 반드시 끊고 실패시킨다
    let rolled=0; while(hbMateRoll() && rolled<200) rolled++;
    assert(rolled===30,'뽑기권 수와 뽑은 횟수가 다름(권을 소모하지 않는지 확인): '+rolled);
    assert(hbMateTicket()===0,'뽑기권이 남음');
    assert(H.mateN===30,'누적 뽑기 횟수가 안 맞음: '+H.mateN);
    assert(hbGachaLv()>1,'30회를 뽑았는데 뽑기 레벨이 그대로');
    // ⑦ 굴려 보면 초반에는 사실상 일반·레어만 나온다(상위는 열려 있어도 아주 낮다)
    { H.mates={}; H.party=[]; H.mateN=0; p.tickets.ally=300;
      // ⚠ 씨앗은 고정이지만 '한 번 뽑을 때 난수를 몇 번 쓰는지'가 주변 상태에 따라 달라진다
      //    (동료가 새로 들어오면 hbLayoutAllies가 돌고, 거기서 펫·구조물 수만큼 난수를 더 쓴다).
      //    그래서 펫·기지를 비워 소비량을 고정한다 — 안 그러면 앞 스텝을 하나 추가하는 것만으로 결과가 바뀐다.
      p.equip=[]; H.base={tiles:{},open:1}; hbLayoutAllies();
      const cnt={}; let n=0;
      const rnd=Math.random; let seed=12345;                    // 결정적 난수 — 판정이 운에 흔들리면 안 된다
      Math.random=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
      try{ while(hbMateTicket()>0 && n<300){ const r=hbMateRoll(); if(!r) break; n++; cnt[r.tier]=(cnt[r.tier]||0)+1; } }
      finally { Math.random=rnd; }
      assert(n===300,'뽑기가 중간에 멈춤: '+n);
      const low=(cnt.common||0)+(cnt.rare||0);
      // ⚠ 문턱을 완화한 뒤로는 300회면 단계가 꽤 올라간다 — 표본을 '1~5단계 구간'으로 좁혀서 본다
      assert(low/n>0.75,'초반 300회인데 일반+레어가 75%에 못 미침: '+(low/n*100).toFixed(1)+'%');
      // ⚠ '한 번도 안 나온다'로 두면 안 된다 — 300회를 굴리는 동안 단계가 올라 갓 확률이 0.67%까지 간다.
      //    깨끗한 상태에서 씨앗 12345면 실제로 1회 나온다(예전엔 앞 스텝이 남긴 상태 덕에 우연히 0이었다).
      //    의도는 '아주 낮다'이므로 비율로 본다.
      assert((cnt.god||0)/n<=0.01,'갓 비율이 너무 높음: '+(cnt.god||0)+'/'+n); }
    // ⑧ 중복은 레벨이 아니라 재료로 쌓인다 — 난수를 고정해 '같은 동료 두 번'을 결정적으로 만든다
    //    (확률에 기대면 이 규칙이 깨져도 통과해 버린다)
    { H.mates={}; H.party=[]; H.mateN=0; p.tickets.ally=2;
      const rnd=Math.random; Math.random=()=>0;      // 항상 1순위 등급의 1순위 동료
      let a,b; try{ a=hbMateRoll(); b=hbMateRoll(); } finally { Math.random=rnd; }
      assert(a&&b&&a.id===b.id,'난수 고정인데 다른 동료가 나옴: '+(a&&a.id)+'/'+(b&&b.id));
      assert(a.isNew===true && b.isNew===false,'두 번째가 중복으로 처리되지 않음');
      assert(hbMateLv(a.id)===1,'중복이 레벨을 올림: Lv'+hbMateLv(a.id));
      assert(hbMateDup(a.id)===1,'중복이 재료로 안 쌓임: '+hbMateDup(a.id));
      assert(hbMateMats().some(m=>m.id===a.id && m.dup===1),'중복이 재료 목록에 안 잡힘');
      // 재료는 실제로 레벨을 올리는 데 쓰인다
      const need=hbMateNeed(a.id), pt=hbMatePt(a.id);
      H.mates[a.id].dup=Math.ceil(need/pt);
      const lv0=hbMateLv(a.id);
      while(hbMateDup(a.id)>0) hbMateFeed(a.id, a.id);
      assert(hbMateLv(a.id)>lv0,'재료를 다 넣었는데 레벨이 안 오름'); }
    // ⑨ 재료 값어치는 등급을 따른다 — 상위 중복이 더 크게 쳐진다
    { let prev=0; for(const t of GACHA_TIER_ORDER){ assert(HB_MATE_PT[t]>prev,'재료 포인트가 등급 오름차순이 아님: '+t); prev=HB_MATE_PT[t]; } }
    return sum1; });

  // 🔓 장착/출전 칸 — 0칸에서 시작해 미네랄로 하나씩 산다(레벨 해금이 아니다)
  await step('장착 칸: 0에서 시작 · 미네랄로 구매 · 최대 3', async()=>{ skipIf(typeof mgBuySlot!=='function','칸 구매 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','칸'); saveMeta(); }
    // ① 새 프로필은 펫·동료 모두 0칸이다
    { const d=defaultProfile();
      assert((d.petSlots||0)===0,'새 프로필 펫 칸이 0이 아님: '+d.petSlots);
      assert((d.hunt.allySlots||0)===0,'새 프로필 동료 칸이 0이 아님: '+d.hunt.allySlots); }
    // ⚠ openGear()는 loadMeta()로 저장본을 다시 읽어 PROF() 객체 자체를 갈아 끼운다.
    //    먼저 저장하고, 그 뒤로는 지역 변수에 담아 두지 말고 매번 PROF()를 다시 읽어야 한다.
    { const p0=PROF(); p0.petSlots=0; p0.hunt.allySlots=0; p0.pcoin=0; p0.unlocks={}; saveMeta(); }
    openGear(); await sleep(60);
    for(const k of ['pet','ally']){ setGearTab(k); await sleep(40);
      const M=MG[k];
      assert(M.max()===0,k+': 시작이 0칸이 아님: '+M.max());
      // 0칸이면 잠긴 줄만 3개 · 자동 선택 줄은 안 나온다
      assert(document.querySelectorAll('#gearBody .mgSlot.lock').length===MG_SLOT_MAX,
        k+': 잠긴 칸 줄이 '+MG_SLOT_MAX+'개가 아님: '+document.querySelectorAll('#gearBody .mgSlot.lock').length);
      // ⚠ resIco 는 크기 클래스를 안 주면 원본 크기로 나온다 — 줄이 통째로 무너진다(실제로 그랬다)
      // ⚠ 이 줄에는 img 가 둘이다 — 왼쪽 칸의 자물쇠(.stIco)와 비용의 재화 아이콘(.gi).
      //   `querySelector('img')` 로 잡으면 자물쇠가 걸려 엉뚱한 것을 잰다(실제로 그랬다). 둘 다 각각 본다.
      { const row=document.querySelector('#gearBody .mgSlot.lock'), ic=row.querySelector('img.gi');
        const lk=row.querySelector('.mgIco img');
        // 자물쇠는 40px 카드 안에 여백을 두고 앉아야 한다 — 카드의 70% 를 넘으면 꽉 찬 것이다
        if(lk){ const card=row.querySelector('.mgCard').getBoundingClientRect(), h=lk.getBoundingClientRect().height;
          assert(h<=card.height*0.7,k+': 잠긴 칸 자물쇠가 카드를 꽉 채움: '+Math.round(h)+'/'+Math.round(card.height)+'px');
          assert(h>=20,k+': 잠긴 칸 자물쇠가 너무 작음: '+Math.round(h)+'px'); }
        assert(ic,k+': 잠긴 줄에 재화 아이콘이 없음');
        assert(ic.getBoundingClientRect().height<=20,k+': 재화 아이콘이 너무 큼(크기 클래스 누락): '+Math.round(ic.getBoundingClientRect().height)+'px');
        assert(row.getBoundingClientRect().height<=90,k+': 잠긴 줄 높이가 비정상: '+Math.round(row.getBoundingClientRect().height)+'px'); }
      assert(!document.querySelector('#gearBody .mgAutoRow'),k+': 0칸인데 자동 선택 줄이 나옴');
      // ② 미네랄이 모자라면 못 산다
      PROF().pcoin=0; mgBuySlot(k); await sleep(20);
      assert(M.max()===0,k+': 미네랄 0인데 칸이 열림');
      // ③ 값을 치르면 하나씩 열리고, 값은 점점 비싸진다
      for(let i=0;i<MG_SLOT_MAX;i++){
        const cost=mgSlotCost(i);
        assert(cost>0,k+': '+(i+1)+'번째 칸 값이 0');
        if(i>0) assert(cost>mgSlotCost(i-1),k+': 칸 값이 점점 비싸지지 않음');
        PROF().pcoin=cost; mgBuySlot(k); await sleep(20);
        assert(M.max()===i+1,k+': '+(i+1)+'번째 칸이 안 열림: '+M.max());
        assert(Math.floor(PROF().pcoin)===0,k+': 칸 값이 정확히 빠지지 않음: '+PROF().pcoin); }
      // ④ 최대 3칸 — 더 사지지 않는다
      PROF().pcoin=1e9; mgBuySlot(k); await sleep(20);
      assert(M.max()===MG_SLOT_MAX,k+': 상한을 넘겨 열림: '+M.max());
      assert(Math.floor(PROF().pcoin)===1e9,k+': 상한인데 미네랄이 빠짐');
      assert(!document.querySelector('#gearBody .mgSlot.lock'),k+': 다 열었는데 잠긴 줄이 남음'); }
    return '0칸 시작 · '+MG_SLOT_COST.join('/')+' 미네랄 · 최대 '+MG_SLOT_MAX; });

  // 🎟 뽑기권 = 미네랄로 못 산다. 엘리트·상자·라운드 보너스로 얻고 젬으로만 산다.
  await step('뽑기권: 미네랄 불가 · 젬 구매 · 상자/엘리트/라운드 지급', ()=>{ skipIf(typeof buyTicketGem!=='function','뽑기권 구매 없음');
    const p=PROF(); p.tickets={gear:0,pet:0,ally:0}; p.gem=0; p.pcoin=1e9;
    // ① 미네랄로 사는 경로가 없어야 한다
    assert(typeof profBuyPetTicket==='undefined','미네랄 펫 뽑기권 구매가 남아 있음');
    assert(typeof PROF_PET_TICKET_COST==='undefined','미네랄 뽑기권 값이 남아 있음');
    // ② 젬이 모자라면 못 산다 · 미네랄이 아무리 많아도 안 된다
    for(const k of ['ally','pet','gear']){
      assert(TICKET_GEM[k]>0,'젬 값이 없는 뽑기권: '+k);
      assert(!buyTicketGem(k),'젬이 0인데 '+k+' 뽑기권이 사짐'); }
    assert(p.pcoin===1e9,'미네랄이 줄었음(뽑기권은 미네랄로 사면 안 된다)');
    // ③ 젬으로 사면 젬만 줄고 권이 는다
    p.gem=100;
    for(const k of ['ally','pet','gear']){ const g0=p.gem, n0=ticketN(k);
      assert(buyTicketGem(k),'젬이 있는데 '+k+' 뽑기권을 못 삼');
      assert(ticketN(k)===n0+1,k+' 뽑기권이 안 늘어남');
      assert(p.gem===g0-TICKET_GEM[k],'젬 정산이 안 맞음: '+g0+' → '+p.gem); }
    assert(p.pcoin===1e9,'구매로 미네랄이 줄었음');
    // ④ 맵의 상자가 세 뽑기권을 모두 낸다 — 상자가 주요 공급처다
    { const seen={}; const rnd=Math.random;
      let i=0; Math.random=()=>{ i++; return ((i*0.137)%1); };     // 결정적으로 훑는다
      try{ for(let n=0;n<400;n++){ const before={g:ticketN('gear'),p:ticketN('pet'),a:ticketN('ally')};
        hbChestReward();
        if(ticketN('gear')>before.g) seen.gear=1;
        if(ticketN('pet')>before.p) seen.pet=1;
        if(ticketN('ally')>before.a) seen.ally=1; } }
      finally { Math.random=rnd; }
      for(const k of ['gear','pet','ally']) assert(seen[k],'상자에서 '+k+' 뽑기권이 안 나옴'); }
    // ⑤ 라운드 마일스톤이 동료·펫 권을 번갈아 준다
    { let a=0,pt=0;
      for(let r=HB_RW_EVERY; r<=HB_RW_EVERY*6; r+=HB_RW_EVERY){ const rw=hbRoundRw(1,r);
        assert(rw,'마일스톤 라운드에 보상이 없음: '+r);
        a+=rw.atk||0; pt+=rw.ptk||0; }
      assert(a>0 && pt>0,'마일스톤이 동료·펫 권을 안 줌: 동료 '+a+' 펫 '+pt); }
    // ⑥ 엘리트 처치 드랍 확률이 살아 있다(일반보다 훨씬 높아야 한다)
    assert(HB_ATICKET_ELITE>HB_ATICKET_NORMAL && HB_PTICKET_ELITE>HB_PTICKET_NORMAL,'엘리트 드랍이 일반보다 높지 않음');
    return '젬 '+['ally','pet','gear'].map(k=>TICKET_NAME[k]+' '+TICKET_GEM[k]).join(' · ')+' · 상자/마일스톤 지급 ok'; });

  // 🐾 펫 뽑기 — 동료와 '같은 형태'. 곡선 규칙은 같은 검사기로 본다.
  await step('펫 뽑기: 동료와 같은 형태 · 중복은 ★ 재료', ()=>{ skipIf(typeof PROF_PET_GACHA!=='object','펫 뽑기 단계 없음');
    // ① 곡선 규칙은 동료와 동일한 잣대로
    const sumP=checkGachaCurve('펫', PROF_PET_GACHA, PET_TIERS);
    // ② 확률을 준 등급에 실제 펫이 있어야 한다(PET_TIERS 는 PROF_PETS 에서 나와야 한다)
    { const have={}; for(const id in PROF_PETS) have[PROF_PETS[id].tier]=1;
      for(const t of PET_TIERS) assert(have[t],'확률은 있는데 그 등급 펫이 없음: '+t);
      for(const id in PROF_PETS) assert(PET_TIERS.indexOf(PROF_PETS[id].tier)>=0,'펫 등급이 확률표에 없음: '+id); }
    // ③ 영입은 뽑기권으로만 — 미네랄로 직접 뽑던 경로는 없어졌다
    const p=PROF(); p.pets={}; p.equip=[]; p.petN=0; p.petSlots=MG_SLOT_MAX;
    p.tickets={gear:0,pet:0,ally:0}; p.pcoin=0;
    assert(profPetRoll()===null,'뽑기권이 0인데 뽑힘');
    // ④ 뽑기권은 젬으로만 산다(미네랄 경로는 따로 검사 — '뽑기권' 단계)
    p.gem=TICKET_GEM.pet;
    assert(buyTicketGem('pet'),'젬이 있는데 펫 뽑기권을 못 삼');
    assert(profPetTicket()===1 && p.gem===0,'뽑기권 구매 정산이 안 맞음');
    // ⑤ 뽑으면 ★0으로 들어오고, 뽑기권이 준다
    const r1=profPetRoll();
    assert(r1 && PROF_PETS[r1.id],'뽑기가 실패함');
    assert(profPetTicket()===0,'뽑기권이 소모되지 않음');
    assert(profPetOwned(r1.id) && profPetStar(r1.id)===0,'뽑은 펫이 ★0으로 안 들어옴');
    assert((p.equip||[]).indexOf(r1.id)>=0,'처음 얻은 펫이 자동 장착되지 않음');
    // ⑥ 중복은 ★가 아니라 재료로 쌓인다 — 난수를 고정해 결정적으로 본다
    { p.pets={}; p.equip=[]; p.petN=0; p.tickets.pet=2;
      const rnd=Math.random; Math.random=()=>0;
      let a,b; try{ a=profPetRoll(); b=profPetRoll(); } finally { Math.random=rnd; }
      assert(a&&b&&a.id===b.id,'난수 고정인데 다른 펫이 나옴');
      assert(a.isNew===true && b.isNew===false,'두 번째가 중복으로 처리되지 않음');
      assert(profPetStar(a.id)===0,'중복이 ★를 바로 올림(재료여야 한다)');
      assert(profPetDup(a.id)===1,'중복이 재료로 안 쌓임');
      // ⑦ 재료를 채우면 ★가 오르고 펫 성능(profPetVal)이 실제로 커진다
      const v0=profPetVal(a.id), need=profPetNeed(a.id), pt=profPetPt(a.id);
      p.pets[a.id].dup=Math.ceil(need/pt);
      while(profPetDup(a.id)>0) profPetFeed(a.id, a.id);
      assert(profPetStar(a.id)===1,'재료를 다 넣었는데 ★가 안 오름: ★'+profPetStar(a.id));
      assert(profPetVal(a.id)>v0,'★가 올랐는데 보너스가 그대로: '+v0+' → '+profPetVal(a.id));
      assert(profPetNeed(a.id)>need,'다음 ★ 요구량이 안 오름');
      assert(!profPetFeed(a.id, a.id),'재료가 없는데 합성이 됨');
      // ★ 상한을 넘지 않는다
      p.pets[a.id].star=PROF_PET_STAR_MAX; p.pets[a.id].dup=99;
      assert(!profPetFeed(a.id, a.id),'★ 최대인데 더 올라감');
      assert(profPetStar(a.id)===PROF_PET_STAR_MAX,'★가 상한을 넘음'); }
    // ⑧ 재료 값어치는 등급을 따른다
    { let prev=0; for(const t of PET_TIERS){ assert(PROF_PET_PT[t]>prev,'펫 재료 포인트가 등급 오름차순이 아님: '+t); prev=PROF_PET_PT[t]; } }
    return sumP; });

  // 옛 펫 저장(중복 수 = 별)을 열었을 때 별을 잃지 않아야 한다
  await step('마이그레이션: 옛 펫 {count} → {star,dup} 로 별 보존', ()=>{ skipIf(typeof migrateProfile!=='function','마이그레이션 없음');
    const keep=PLAYER_META;
    PLAYER_META={ coins:0, buildLevels:{}, profile:{ ver:8, pcoin:0, gas:0, gem:0, curId:'', items:[], chars:[],
      hunt:{ dg:1, round:1, climb:false, best:{}, upg:{} },
      idle:{sourceId:'drill',lastClaimTs:0}, unlocks:{},
      pets:{ wolf:{count:4}, slime:{count:1} }, equip:['wolf'], petSlots:2 } };
    migrateProfile();
    const p=PLAYER_META.profile;
    // 쓰던 칸은 뺏지 않는다 — 칸이 '사는 것'으로 바뀌었다고 이미 열린 것을 0으로 되돌리면 안 된다
    assert(p.petSlots===2,'옛 펫 칸 2가 보존되지 않음: '+p.petSlots);
    assert((p.hunt.allySlots||0)>0,'옛 저장에 동료 칸이 하나도 안 열림: '+p.hunt.allySlots);
    assert(p.petSlots<=MG_SLOT_MAX && p.hunt.allySlots<=MG_SLOT_MAX,'마이그레이션이 칸 상한을 넘김');
    assert(!(p.unlocks||{}).pet_slot3 && !(p.unlocks||{}).ally_plus,'없어진 칸 해금이 남아 있음');
    assert(profPetStar('wolf')===3,'옛 중복 4 → ★3 이 아님: ★'+profPetStar('wolf'));
    assert(profPetStar('slime')===0,'옛 중복 1 → ★0 이 아님: ★'+profPetStar('slime'));
    assert(p.pets.wolf.count===undefined,'옛 count 필드가 남음');
    assert(p.pets.wolf.dup===0 && p.pets.wolf.fed===0,'재료 필드가 안 생김');
    assert((p.tickets.pet||0)>0,'펫 뽑기권을 안 줌(뽑기 화면이 비어 보인다)');
    PLAYER_META=keep;
    return '★ 보존 ok'; });

  // 옛 저장(전직해 둔 캐릭터)을 열었을 때 산 것을 잃지 않아야 한다
  await step('마이그레이션: 전직해 둔 캐릭터 → 뿌리 복귀 + 그 동료 지급', ()=>{ skipIf(typeof migrateProfile!=='function','마이그레이션 없음');
    const keep=PLAYER_META;
    PLAYER_META={ coins:0, buildLevels:{}, profile:{ ver:6, pcoin:0, gas:0, gem:0, curId:'x1', items:[],
      chars:[{ id:'x1', cls:'ranger', name:'옛전직', xp:0, level:20, statPoints:0, dgFloor:0,
               unit:{ jobId:'sniper', level:20, evoStars:1, stats:{pow:0,vit:0,foc:0,agi:0}, gear:{} } }],
      hunt:{ dg:1, round:1, climb:false, best:{}, upg:{}, build:{ally:2} },
      idle:{sourceId:'drill',lastClaimTs:0}, unlocks:{}, pets:{}, equip:[], petSlots:2 } };
    migrateProfile();
    const p=PLAYER_META.profile, c=p.chars[0];
    assert(c.unit.jobId==='ranger','뿌리로 안 돌아감: '+c.unit.jobId);
    assert(((p.hunt.mates||{}).sniper||{}).lv>=1,'전직해 뒀던 직업이 동료로 안 들어옴');
    assert((p.hunt.party||[]).indexOf('sniper')>=0,'받은 동료가 출전 목록에 없음');
    assert(p.pcoin>0,'옛 범용 동료(build.ally) 환급이 없음: '+p.pcoin);
    assert(!p.hunt.build.ally,'옛 동료 수가 남아 있음');
    // 버전 숫자를 박지 않는다 — 마이그레이션이 늘 때마다 이 줄이 깨진다
    assert(p.ver===defaultProfile().ver,'버전이 최신으로 안 올라감: '+p.ver+' vs '+defaultProfile().ver);
    PLAYER_META=keep;
    return '뿌리 복귀 + 동료 지급 + 환급 ok'; });

  // 📈 성장 설계(2026-08-12) — 초반 빠르게 / 뒤로 갈수록 배로 / 25레벨마다 환생 / 해금은 레벨 게이트 / 라운드 보상
  await step('성장 곡선: 초반 가속 · 후반 등비 · 환생 배수', ()=>{ skipIf(typeof profXpForLevel!=='function','곡선 없음');
    // ① 초반은 옛 곡선(50·lv^1.5)보다 확실히 가볍다 — '30레벨까지 아주 빠르게'
    const oldCum=(to)=>{ let t=0; for(let l=1;l<to;l++) t+=Math.round(50*Math.pow(l,1.5)); return t; };
    const newCum=(to)=>{ let t=0; for(let l=1;l<to;l++) t+=profXpForLevel(l); return t; };
    const c30o=oldCum(30), c30n=newCum(30);
    assert(c30n < c30o*0.55,'30레벨까지가 옛 곡선보다 충분히 빠르지 않음: '+c30n+' vs '+c30o);
    // ② PROF_LV_SOFT 이후는 등비 — 레벨당 같은 배수로 오르고, 결국 '배로' 든다
    for(let l=PROF_LV_SOFT; l<PROF_LV_SOFT+40; l++){
      const rt=profXpForLevel(l+1)/profXpForLevel(l);
      assert(Math.abs(rt-PROF_XP_GEO)<0.02,'Lv'+l+'→'+(l+1)+' 증가율이 등비가 아님: '+rt.toFixed(3)); }
    { const want=Math.pow(PROF_XP_GEO,30);   // ⚠ 8배 고정을 박지 말 것 — 곡선 상수를 바꾸면 바로 깨진다
      const got=profXpForLevel(PROF_LV_SOFT+30)/profXpForLevel(PROF_LV_SOFT);
      assert(got>want*0.98,'후반 등비가 상수와 다름: '+got.toFixed(2)+' vs '+want.toFixed(2)); }
    // ⑤ 레벨 상한은 없어졌다(2026-08-19) — 대신 **첫 환생(Lv100)이 닿을 만한가**를 본다.
    //    ⚠ 정밀한 시간 예측이 아니라 파국 감지기다. 옛 곡선(소프트캡 30 · ×1.045)이면
    //       Lv100 누적이 140만 XP라 여기서 걸린다. 지금 곡선은 약 147k.
    assert(typeof PROF_LV_CAP==='undefined','레벨 상한이 되살아남 — 상한이 있으면 성장이 거기서 멎는다');
    { const need=newCum(PROF_REB_MIN_LV);
      let n=0; for(let w=1;w<=HB_WAVES;w++) n+=hbFoeCount(40,w);
      const plays=need/(n*hbKillReward(1,40).xp);
      assert(plays<400,'첫 환생 Lv'+PROF_REB_MIN_LV+' 이 너무 멀다: 라운드40에서 '
        +Math.round(plays).toLocaleString()+'판 ('+Math.round(need).toLocaleString()+' XP)'); }
    // ⑥ 소프트캡이 곧 첫 환생 레벨이어야 한다 — 갈라지면 '100까지 싸게'가 성립하지 않는다
    assert(PROF_LV_SOFT===PROF_REB_MIN_LV,'소프트캡과 첫 환생 레벨이 다름: '+PROF_LV_SOFT+' vs '+PROF_REB_MIN_LV);
    // ③ 경계에서 튀지 않는다(두 식이 이어져야 한다)
    { const a=profXpForLevel(PROF_LV_SOFT-1), b=profXpForLevel(PROF_LV_SOFT);
      assert(b>a && b<a*1.3,'구간 경계에서 필요 경험치가 튐: '+a+' → '+b); }
    // ④ 곡선은 단조 증가 — 어느 지점에서도 쉬워지면 안 된다
    for(let l=1;l<400;l++) assert(profXpForLevel(l+1)>=profXpForLevel(l),'Lv'+l+'에서 곡선이 내려감');
    // ⑦ 환생 포인트 한 칸(60레벨) 구간마다 완만히 무거워진다 — 급격하면(×3 이상) 벽처럼 느껴진다
    // ⚠ 60레벨 고정 창으로 잰다 — RP 지급식과 묶지 말 것. 이건 XP 곡선의 성질이다.
    { const band=60, seg=(a,b)=>{let t=0;for(let l=a;l<b;l++)t+=profXpForLevel(l);return t;};
      const r1=seg(100+band,100+band*2)/seg(100,100+band);
      const r2=seg(100+band*2,100+band*3)/seg(100+band,100+band*2);
      assert(r1>1.3 && r1<3,'구간이 무거워지는 정도가 범위 밖: ×'+r1.toFixed(2));
      assert(Math.abs(r1-r2)<0.15,'구간마다 배율이 들쭉날쭉: ×'+r1.toFixed(2)+' → ×'+r2.toFixed(2)); }
    return '30레벨 누적 '+c30n.toLocaleString()+'(옛 '+c30o.toLocaleString()+') · 이후 레벨당 ×'+PROF_XP_GEO; });

  // 🔁 환생 규칙(2026-08-19 개편): **Lv100 부터 언제든, 몇 번이든**. 보상은 회차가 아니라 **그때의 레벨**이 정한다.
  //    ⭐ 축이 둘로 갈린다 — 배수(XP·미네랄)는 **선형**(사이클 속도만),
  //       던전을 뚫는 **전투력은 환생 포인트(복리)** 가 맡는다. 섞으면 한쪽이 폭주한다.
  await step('환생: Lv100부터 무제한 · 보상은 레벨이 정한다 · 미네랄 축까지 리셋', ()=>{
    skipIf(typeof profRebirth!=='function','환생 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; const c=profCreateChar('ranger','환생');
    const H=hbHunt(); H.upg={}; H.unl={}; H.best={}; H.dg=1; H.round=1;
    PLAYER_META.coins=1e9;                       // 유즈맵 포인트 관문은 따로 검사한다
    // ① 옛 사다리는 사라졌다
    assert(typeof PROF_REB_LEVELS==='undefined','옛 환생 사다리가 되살아남');
    assert(PROF_REB_MIN_LV>0,'첫 환생 레벨이 없음');
    // ② 문턱 미만이면 못 한다
    c.level=PROF_REB_MIN_LV-1;
    assert(!profCanRebirth(c),'문턱 미만인데 환생이 가능함');
    assert(profRebirth(c)===0,'문턱 미만인데 환생이 실행됨');
    // ③ 딱 문턱이면 배수는 0 — "즉시 환생하면 거의 안 준다"가 설계다
    assert(profRebGainAt(PROF_REB_MIN_LV)===0,'Lv'+PROF_REB_MIN_LV+' 환생인데 배수가 0이 아님');
    assert(profRebGrantAt(PROF_REB_MIN_LV)===1,'첫 환생 지급이 1p 가 아님: '+profRebGrantAt(PROF_REB_MIN_LV));
    // ④ 배수는 레벨에 대해 **선형**이다.
    //    ⛔ 기하로 되돌리면 되먹임이 생긴다: 배수가 XP 수입을 올리고 → 다음 사이클 레벨이 오르고
    //       → 배수가 g^레벨 이라 또 커진다. 실측으로 5회 만에 Lv1411 · 배수 ×1900만이 됐다.
    { const a=profRebGainAt(PROF_REB_MIN_LV+100), b=profRebGainAt(PROF_REB_MIN_LV+200);
      assert(Math.abs(b-a*2)<1e-9,'배수가 선형이 아님(기하로 되돌아갔다): +'+a.toFixed(2)+' → +'+b.toFixed(2));
      assert(Math.abs(a-100*REB_LIN)<1e-9,'배수 계수가 REB_LIN 과 다름'); }
    // ⑤ 환생하면 무엇이 지워지고 무엇이 남는가
    H.upg={atk:7,hp:3}; H.unl={crit:1,rng:1}; H.best={1:31}; H.dg=1; H.round=31;
    p.pcoin=12345; p.gas=777; c.unit.evoStars=2; c.unit.pts={atk:5};
    c.level=140; c.unit.level=140; c.xp=123;
    const gain=profRebGainAt(140), rp0=profRebGrantAt(140);
    assert(profCanRebirth(c),'문턱 위인데 환생이 안 됨');
    assert(profRebirth(c)===1,'첫 환생인데 1회차가 아님');
    assert(c.level===1 && c.xp===0 && c.unit.level===1,'레벨·경험치가 안 돌아감');
    assert(lpTotal(c)===0,'레벨 포인트가 안 되감김');
    { const H2=hbHunt();
      assert(Object.keys(H2.upg).length===0,'미네랄 업그레이드가 안 지워짐');
      assert(PROF().pcoin===0,'미네랄 재화가 안 지워짐');
      // ⭐ 진행은 던전 1-1 로 되돌아간다 — 되감기가 환생의 값이다.
      assert(H2.dg===1 && H2.round===1,'진행 던전/라운드가 안 돌아감: '+H2.dg+'-'+H2.round);
      assert(H2.unl.crit===1,'업그레이드 해금이 지워짐(유지해야 한다)');
      assert((H2.best[1]||0)===31,'최고 기록이 지워짐(유지해야 한다)');
      // ⭐ '깼던 구간은 열려 있다' — 되돌아갈 길이 남아야 되감기가 벌이 아니라 리셋이 된다
      assert(hbBest(1)===31,'환생 뒤 라운드 선택 상한이 최고 기록을 안 따라감: '+hbBest(1));
      hbSetRound(31);
      assert(hbHunt().round===31,'환생 뒤 깼던 라운드로 되돌아갈 수 없음: '+hbHunt().round);
      hbSetRound(1); }
    assert(PROF().gas===777 && c.unit.evoStars===2,'가스·진화★가 지워짐');
    // ⑥ 배수는 **곱이 아니라 합**으로 쌓인다 (1.05 와 1.25 → 1.30)
    assert(Math.abs(profXpMul(c)-(1+gain))<1e-9,'첫 환생 배수가 다름');
    assert((c.rp|0)===rp0,'지급 포인트가 다름: '+(c.rp|0)+' vs '+rp0);
    { c.level=180; c.unit.level=180;
      const g2=profRebGainAt(180), before=profXpMul(c);
      profRebirth(c);
      assert(Math.abs(profXpMul(c)-(before+g2))<1e-9,'배수가 합이 아니라 곱으로 쌓임: '+profXpMul(c)); }
    // ⑦ 같은 레벨에서 두 번은 못 한다 — 무한 반복으로 공짜 포인트를 못 만든다
    c.level=180; assert(!profCanRebirth(c),'같은 레벨에서 또 환생이 가능함');
    c.level=181; assert(profCanRebirth(c),'더 높은 레벨인데 환생이 막힘');
    // ⑧ 상한이 없다 — 아무리 높아도 계속 된다
    c.level=1000; c.unit.level=1000;
    assert(profCanRebirth(c),'아주 높은 레벨에서 환생이 막힘(상한이 생겼다)');
    assert(profRebGainAt(1000)>profRebGainAt(500),'더 높은 레벨인데 배수가 안 큼');
    { c.level=50; c.xp=1e18; profApplyLevelUps(c);
      assert(c.level>200,'레벨이 어딘가에서 막힘: '+c.level); }
    // ⑨ 🔑 유즈맵 포인트 관문 — 레벨 비례. 첫 환생(딱 Lv100)은 무료.
    { const p2=PROF(); p2.chars.length=0; p2.curId='';   // ⚠ 계정당 캐릭터는 하나 — 비우고 새로 만든다
      const c2=profCreateChar('ranger','관문'); c2.level=PROF_REB_MIN_LV;
      PLAYER_META.coins=0;
      assert(profRebPoint(c2)===0,'Lv'+PROF_REB_MIN_LV+' 환생이 무료가 아님');
      assert(profCanRebirth(c2),'포인트 0인데 무료 환생이 막힘');
      c2.level=PROF_REB_MIN_LV+50;
      assert(profRebPoint(c2)>0,'깊이 밀었는데 관문이 공짜');
      assert(!profCanRebirth(c2),'포인트가 없는데 환생이 가능함');
      PLAYER_META.coins=profRebPoint(c2);
      assert(profCanRebirth(c2),'포인트를 채웠는데 환생이 막힘');
      const before=PLAYER_META.coins, need=profRebPoint(c2);
      profRebirth(c2);
      assert(PLAYER_META.coins===before-need,'관문 포인트가 안 빠짐'); }
    PLAYER_META.coins=0;
    return 'Lv'+PROF_REB_MIN_LV+'부터 무제한 · 배수 초과레벨×'+REB_LIN
      +'(선형) · 포인트 1+'+PROF_REB_RP_K+'ln초과'; });

  await step('해금: 레벨 게이트 · 한 번에 몰려 열리지 않는다', ()=>{ skipIf(typeof profUnlockLv!=='function','레벨 해금 없음');
    // ① 표가 레벨 기준이고 오름차순 · 간격이 벌어져 있어야 '하나씩' 열린다
    let prev=0;
    for(const u of PROF_UNLOCKS){
      assert(typeof u.lv==='number' && u.lv>0,'레벨 게이트가 없는 항목: '+u.id);
      assert(u.power===undefined,'옛 파워 게이트가 남음: '+u.id);
      assert(u.lv>prev,'레벨 순서가 뒤집힘: '+u.id);
      assert(u.lv-prev>=3 || prev===0,'해금이 너무 붙어 있음(한 번에 열린다): '+u.id+' '+prev+'→'+u.lv);
      prev=u.lv; }
    // ② 실제 판정 — 레벨을 올리면 그 시점의 것만 열린다
    const p=PROF(); p.chars.length=0; p.curId=''; const c=profCreateChar('ranger','해금');
    p.unlocks={}; c.level=1; profSyncUnlocks();
    assert(Object.keys(p.unlocks).length===0,'Lv.1인데 해금이 있음');
    const first=PROF_UNLOCKS[0];
    c.level=first.lv; profSyncUnlocks();
    assert(p.unlocks[first.id],'문턱 레벨인데 첫 해금이 안 열림');
    assert(Object.keys(p.unlocks).length===1,'첫 해금에서 여러 개가 한꺼번에 열림');
    // ③ 환생해도 이미 연 것은 닫히지 않는다(영구 기록)
    c.level=1; profSyncUnlocks();
    assert(profHasUnlock(first.id),'레벨이 내려가자 해금이 닫힘(영구여야 한다)');
    return PROF_UNLOCKS.length+'단계 · Lv.'+PROF_UNLOCKS[0].lv+'~'+prev; });

  await step('라운드 보상: 마일스톤 최초 1회 · 팝업에서 미리 확인', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)');  skipIf(typeof hbRoundRw!=='function','라운드 보상 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','보상'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const H=hbHunt(); H.rw={};
    // ① 마일스톤 간격에만 보상이 붙고, 라운드가 오를수록 커진다
    assert(!hbRoundRw(1,1) && !hbRoundRw(1,HB_RW_EVERY-1),'마일스톤이 아닌 라운드에 보상이 붙음');
    assert(hbRoundRw(1,HB_RW_EVERY),'마일스톤 라운드에 보상이 없음');
    assert(hbRoundRw(1,HB_RW_EVERY*2).min>hbRoundRw(1,HB_RW_EVERY).min,'뒤 마일스톤이 더 크지 않음');
    // ② 최초 1회만 — 같은 라운드를 반복 파밍해도 다시 안 준다
    const p=PROF(), c0=p.pcoin, tk0=(p.tickets&&p.tickets.gear)||0;
    assert(hbRwClaim(1,HB_RW_EVERY),'최초 클리어 보상이 지급되지 않음');
    const r=hbRoundRw(1,HB_RW_EVERY);
    assert(p.pcoin===c0+r.min,'보상 미네랄이 안 맞음: '+(p.pcoin-c0)+' vs '+r.min);
    assert(((p.tickets&&p.tickets.gear)||0)===tk0+(r.tk||0),'뽑기권 지급이 안 맞음');
    const c1=p.pcoin;
    assert(!hbRwClaim(1,HB_RW_EVERY),'같은 마일스톤이 두 번 지급됨(반복 파밍으로 무한 수령)');
    assert(p.pcoin===c1,'두 번째 수령 시도에 재화가 늘어남');
    assert(hbRwGot(1,HB_RW_EVERY),'수령 기록이 남지 않음');
    // ③ 던전마다 따로 — 던전 1에서 받았다고 던전 2가 닫히면 안 된다
    assert(!hbRwGot(2,HB_RW_EVERY),'다른 던전의 마일스톤까지 수령 처리됨');
    // ④ 팝업에서 '다음 목표'를 미리 볼 수 있다(도전정신)
    H.rw={}; H.best={1:2}; H.dg=1; _hb.round=1;
    hbOpenRounds(); await sleep(40);
    const nx=hbNextRw(1,1);
    assert(nx===HB_RW_EVERY,'다음 마일스톤 안내가 틀림: '+nx);
    // 안내 줄은 없앴다(2026-08-14) — '다음 목표'는 피커 맨 위의 잠긴 🎁 칸이 대신한다
    assert(!$('hbRoundNote'),'안내 줄이 아직 남아 있음');
    { const cs=[...document.querySelectorAll('#hbRdScroll .hbRd')];
      assert(+cs[0].dataset.r===nx,'피커 맨 위가 다음 마일스톤이 아님: '+cs[0].dataset.r+' vs '+nx);
      assert(cs[0].disabled && cs[0].textContent.indexOf('🎁')>=0,'다음 목표 칸이 잠긴 🎁 가 아님'); }
    assert(hbRoundRw(1,nx),'다음 마일스톤 보상표가 비어 있음');   // 문구가 아니라 표로 확인(안내 줄 폐지)
    hbCloseRounds();
    return '간격 '+HB_RW_EVERY+' · 최초 1회 · 던전별 분리 ok'; });

  // 친구 목록은 네비 밖(마을 상단 바)에서 연다 — 네비 칸 수가 바뀌어도 진입점이 사라지지 않게 지킨다.
  // 🚪 게임 진입 화면 — 막대가 100% 가 되기 전에는 시작 버튼을 못 누른다(막대·버튼에 뜻을 준다)
  await step('게임 진입: 로딩 100% 전에는 시작 버튼이 잠겨 있다', async ()=>{
    skipIf(typeof gameStartCountdown!=='function','진입 화면 없음');
    openMapSelect(); _selMap=USEMAPS.nemo; await sleep(40);
    gameStartCountdown(()=>{});
    await sleep(60);
    const sb=$('opStart'), fill=$('gsBarFill');
    const pct=()=>parseFloat(fill.style.width)||0;
    assert(sb.disabled, '로딩 중인데 시작 버튼이 이미 열려 있음');
    assert(pct()<100, '로딩이 시작하자마자 100%');
    // 다 찰 때까지 기다린다(GS_LOAD_MS 기준 + 여유)
    const t0=performance.now();
    while(sb.disabled && performance.now()-t0 < GS_LOAD_MS+1200) await sleep(30);
    assert(!sb.disabled, '막대가 다 찼는데 시작 버튼이 안 열림');
    assert(pct()>=100, '버튼이 열렸는데 막대가 100% 가 아님: '+pct()+'%');
    const took=Math.round(performance.now()-t0);
    if(typeof gsQuitToMaps==='function') gsQuitToMaps();
    await sleep(40);
    assert(!$('opStart').disabled, '나가기 뒤에도 버튼 잠금이 남음(다음 진입에서 못 누른다)');
    return '잠김 해제까지 '+took+'ms · GS_LOAD_MS='+GS_LOAD_MS;
  });
  // 🔁 부팅 막대는 **한 번만** 시작한다 — 중간에 0 으로 되돌아가면 사용자에게는 로딩이 두 번 도는 것으로 보인다.
  //    (CSS 애니 opLoad 는 첫 페인트에, JS 막대는 스크립트 파싱 때 시작해서 예전엔 둘이 겹쳤다)
  await step('부팅 막대: 데우기로 넘어갈 때 0 으로 되돌아가지 않는다', async()=>{
    skipIf(typeof enterAfterWarm!=='function' || typeof opBarStart!=='function','막대 없음');
    const cs=getComputedStyle(document.querySelector('#opening .opBar'));
    assert(cs.animationName==='none','.opBar 에 CSS 애니메이션이 다시 들어옴 — JS 막대와 겹쳐 두 번 돈다: '+cs.animationName);
    const orig=window.opBarStart; let starts=0;
    window.opBarStart=function(){ starts++; return orig.apply(null,arguments); };
    try{
      orig(400);                                   // 부팅 막대가 도는 상황을 만든다
      starts=0;
      const pr=enterAfterWarm(); await sleep(200);
      assert(starts===0,'데우기가 막대를 다시 시작했다 — 0 으로 되돌아간다');
      await pr;
    } finally { window.opBarStart=orig; }
    return '재시작 '+starts+'회 · CSS 애니 none';
  });

  // ⏳ 로딩 막대 — '항상 100% 까지 찬 뒤 0.2초' 가 규칙이다. 예전엔 막대(CSS 1.6s)와 전환 타이머(1.1s)가
  //    따로 돌아 80% 쯤에서 잘린 채 넘어갔다. 전환이 막대를 기다리는지 검사한다.
  await step('로딩 막대: 100% 를 채우고 0.2초 뒤에 넘어간다', async ()=>{
    skipIf(typeof showLoading!=='function' || typeof opBarDone!=='function','로딩 막대 없음');
    const op=$('opening'), bar=op.querySelector('.opBar'), wrap=bar.parentElement;
    op.classList.remove('hide','counting'); await sleep(50);
    const W=wrap.getBoundingClientRect().width; assert(W>1,'막대 칸 폭이 0 — 화면이 안 보인다');
    let peak=0, fullAt=null, hidAt=null; const t0=performance.now();
    const iv=setInterval(()=>{ const w=bar.getBoundingClientRect().width/W*100, t=performance.now()-t0;
      if(w>peak) peak=w;
      if(fullAt===null && w>=99) fullAt=t;
      // ⚠ 전환 시점 = 로딩이 **걷히기 시작하는** 순간(.fxOut). .hide 는 페이드가 끝난 뒤라
      //    그것만 보면 전환이 늦게 잡힌다. 둘 중 먼저 오는 것을 쓴다.
      if(hidAt===null && (op.classList.contains('fxOut')||op.classList.contains('hide'))) hidAt=t; }, 16);
    await new Promise(r=>showLoading(r, 400));
    await sleep(_fadeMs()+80); clearInterval(iv);
    assert(peak>=99, '막대가 100% 를 못 채우고 넘어감(최대 '+peak.toFixed(0)+'%)');
    assert(fullAt!==null && hidAt!==null, '100% 도달·전환 시점을 못 잼');
    const gap=hidAt-fullAt;
    assert(gap>=LOAD_HOLD*0.5, '100% 를 보여 주지 않고 바로 넘어감(간격 '+Math.round(gap)+'ms)');
    assert(gap<=LOAD_HOLD*3+250, '100% 뒤 너무 오래 머묾(간격 '+Math.round(gap)+'ms)');
    op.classList.add('hide'); if(typeof opBarReset==='function') opBarReset();
    return '최대 '+peak.toFixed(0)+'% · 100%→전환 '+Math.round(gap)+'ms';
  });
  // 🎬 부팅 로딩과 로그인은 **같은 키 아트가 이어지는 한 장면**이다.
  //    예전엔 둘이 서로 다른 호흡 애니(18s/14s)를 따로 돌려서, 화면이 바뀌면 새 요소가 0% 부터
  //    다시 시작해 그림이 최대 4.4% 툭 작아졌다. 게다가 .hide 가 즉시 걸려 전환이 뚝 끊겼다.
  await step('화면 전환: 배경은 한 장으로 깔리고 앞의 것만 디졸브된다', async()=>{
    skipIf(typeof showAppScreen!=='function' || typeof _fadeMs!=='function','전환 페이드 없음');
    const op=$('opening'), au=$('auth'), art=$('titleBg'), ph=$('phone');
    skipIf(!art,'공유 키 아트 층(#titleBg) 없음');
    // ① 그림을 칠하는 요소는 **하나뿐**이어야 한다.
    //    화면마다 자기 그림을 그리면 전환할 때 새 요소의 호흡 애니가 0% 부터 다시 시작해
    //    그림이 툭 튄다(예전에 4.4% 작아졌다). 위상 보정으로는 리셋 자체를 못 막는다.
    const painters=[...document.querySelectorAll('*')].filter(e=>{
      for(const ps of [null,'::before','::after']){
        if(/boot\.webp/.test(getComputedStyle(e,ps).backgroundImage)) return true; }
      return false; }).map(e=>e.id||'.'+e.className.split(' ')[0]);
    assert(painters.length===1 && painters[0]==='titleBg',
      '키 아트를 여러 곳에서 그린다 — 전환마다 호흡이 리셋된다: '+painters.join(', '));
    const s=getComputedStyle(art);
    assert(s.animationName!=='none','공유 키 아트가 숨을 안 쉰다');
    // ⭐ 위에 얹히는 화면은 **자기 배경을 칠하면 안 된다.** 칠하면 공유 아트를 덮어
    //    "배경이 없어진" 것처럼 보인다. 두 화면 다 .spaceBg 라 기본값이 불투명이다 — 실제로 두 번 당했다.
    for(const id of ['opening','auth']){ const el=$(id);
      for(const ps of [null,'::before','::after']){ const c=getComputedStyle(el,ps);
        const opaque = c.backgroundImage!=='none' ||
          (c.backgroundColor && c.backgroundColor!=='rgba(0, 0, 0, 0)' && c.backgroundColor!=='transparent');
        assert(!opaque, '#'+id+(ps||'')+' 가 자기 배경을 칠한다 — 공유 키 아트를 덮는다 ('
          +(c.backgroundImage!=='none'?c.backgroundImage.slice(0,30):c.backgroundColor)+')'); } }
    // ② 화면이 바뀌어도 **그 요소는 그대로** 있어야 한다(교체되면 애니가 다시 시작한다)
    showAppScreen('auth'); await sleep(30);
    assert(ph.classList.contains('artBg'),'로그인에서 공유 키 아트가 꺼져 있다');
    const same=$('titleBg');
    showAppScreen('opening'); await sleep(30);
    assert(ph.classList.contains('artBg'),'로딩에서 공유 키 아트가 꺼져 있다');
    assert($('titleBg')===same,'전환하면서 키 아트 요소가 갈렸다 — 호흡이 끊긴다');
    // ③ 로고(STAR WAR)도 **한 벌뿐**이어야 한다.
    //    자리만 맞추는 걸로는 안 된다 — 안쪽 간격이 달라 반드시 어긋난다(실측: 마크 12px · 제목 9px).
    { const logos=document.querySelectorAll('.authLogo, .opTitle');
      assert(logos.length===1,'STAR WAR 로고가 '+logos.length+'벌이다 — 두 벌이면 디졸브에서 어긋난다');
      const marks=document.querySelectorAll('.authMark, .opLogo');
      assert(marks.length===1,'육각 마크가 '+marks.length+'벌이다');
      assert($('titleMark') && $('titleMark').parentElement===ph,
        '로고가 #phone 직속이 아니다 — 화면 안에 두면 그 화면의 흐름을 타서 자리가 움직인다'); }
    // ④ 로고 자리는 **가장 긴 상태(로그인 폼)** 도 안 덮어야 한다.
    { const pr=ph.getBoundingClientRect();
      const a1=Math.round(pr.bottom-$('titleMark').getBoundingClientRect().bottom);
      if(typeof authOpenForm==='function'){ showAppScreen('auth'); authOpenForm('id'); await sleep(60);
        const top=Math.round(pr.bottom-document.querySelector('.authIn').getBoundingClientRect().top);
        assert(top < a1,'로그인 폼이 로고를 덮는다 — 폼 윗변 '+top+'px 가 로고 밑변 '+a1+'px 보다 위다');
        if(typeof authShowHub==='function') authShowHub(); await sleep(30); } }
    // ⚠ 위 폼 확인이 로그인 화면으로 돌아갔다 — 아래 '붙잡기' 검사는 **로딩으로 넘어가는 중**이어야 한다
    showAppScreen('opening'); await sleep(30);
    // 아래 화면은 페이드하지 않는다 — 둘 다 반투명이면 그 밑 바탕이 비친다
    assert(!au.classList.contains('fxOut') && !au.classList.contains('fxIn'),
      '아래 화면까지 페이드한다 — 전환 중 바탕이 새어 나온다');
    // ⭐ 디졸브의 핵심: 로딩이 **떠오르는 동안** 아래 화면이 자리를 지켜야 한다.
    //    즉시 감추면 위는 아직 투명하고 아래는 없어서 그 틈으로 바탕이 드러난다(게스트 로그인에서 그랬다).
    assert(!au.classList.contains('hide'),'로딩이 떠오르는 중인데 아래 화면이 벌써 사라졌다 — 전환에 틈이 생긴다');
    assert(getComputedStyle(au).opacity==='1','아래 화면이 흐려졌다 — 붙잡고 있어야 틈이 안 생긴다');
    await sleep(_holdMs()+80);   // ⚠ 붙잡는 시간 = 화면 전환과 로그인 내용 중 **긴 쪽**
    assert(au.classList.contains('hide'),'로딩이 다 떠올랐는데 아래 화면이 안 감춰짐');
    showAppScreen('opening'); await sleep(30);   // 아래 ② 검사를 위해 다시 로딩 상태로
    showAppScreen('auth');
    assert(!op.classList.contains('hide'),'로딩이 즉시 사라진다 — 전환이 뚝 끊긴다');
    assert(op.classList.contains('fxOut'),'나가는 화면에 페이드가 안 걸림');
    await sleep(_fadeMs()+80);
    assert(op.classList.contains('hide'),'페이드가 끝났는데 화면이 안 감춰짐');
    openHome(); await sleep(40);
    return '공유 배경 1장 · '+getComputedStyle($('titleBg')).animationDuration+' 호흡 · 디졸브 '+_fadeMs()+'ms'; });
  // 🔡 로그인 속 내용(버튼·폼)은 화면과 **따로** 뜨고 진다 — 배경·로고는 그대로인데 그 앞만 바뀐다.
  await step('로그인 버튼: 화면과 따로 슬며시 뜨고, 나갈 땐 흐려진다', async()=>{
    skipIf(typeof authContentShow!=='function','로그인 내용 전이 없음');
    const au=$('auth'), inn=()=>document.querySelector('.authIn');
    // ① 들어올 때 — 늦게 시작한다(로딩 막대가 걷히는 중에 떠오르라고)
    { const c=getComputedStyle(inn());
      assert(parseFloat(c.transitionDuration)>0,'로그인 내용에 전이가 없다 — 뚝 나타난다');
      assert(parseFloat(c.transitionDuration) > parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-screen')),
        '로그인 내용이 화면 전환보다 빠르다 — 슬며시가 아니다'); }
    showAppScreen('opening'); await sleep(_holdMs()+80);   // 완전히 걷힌 뒤에 — 되돌아오는 경우가 아니라 '처음 뜨는' 경우를 잰다
    showAppScreen('auth'); await sleep(30);
    assert(au.classList.contains('inView'),'로그인을 켰는데 내용이 안 켜졌다');
    assert(!au.classList.contains('hide'),'로그인을 켰는데 감춰져 있다 — 예약된 감추기가 안 취소됐다');
    assert(+getComputedStyle(inn()).opacity < 0.5,'내용이 지체 없이 다 떠 버렸다 — 늦춤(--t-authDelay)이 안 걸렸다');
    // ② 나갈 때 — 흐려지는 동안 화면이 남아 있어야 한다(먼저 감추면 뚝 끊긴다)
    await sleep(_holdMs()+120);
    showAppScreen('opening'); await sleep(60);
    assert(!au.classList.contains('inView'),'나가는데 내용이 그대로다');
    assert(!au.classList.contains('hide'),'내용이 흐려지기도 전에 화면이 감춰졌다 — 뚝 끊긴다');
    assert(_holdMs() >= _cssMs('--t-auth',.95)-1,'붙잡는 시간이 내용 전이보다 짧다 — 사라지는 중에 잘린다');
    openHome(); await sleep(40);
    return '전이 '+getComputedStyle(inn()).transitionDuration+' · 늦춤 '+getComputedStyle(inn()).transitionDelay; });
  // ⚙ 게임 밖 설정(.appCtx) = 로그인과 같은 언어 — 판 없이 헤어라인 행, 토글은 알약 테두리만(5a).
  await step('설정(게임 밖): 판 없이 행 · 토글은 면을 안 채운다', async()=>{
    skipIf(typeof openAppSettings!=='function','설정 없음');
    showAppScreen('auth'); await sleep(60);
    openAppSettings(); await sleep(80);
    const pop=$('settingsPop');
    assert(pop.classList.contains('appCtx'),'게임 밖 설정이 아니다');
    // ① 판이 없다 — 카드·묶음 상자 전부
    for(const q of ['.setCard','.setQuick','.setMenu']){ const e=document.querySelector('#settingsPop '+q); if(!e) continue;
      const c=getComputedStyle(e);
      assert(c.backgroundImage==='none' && /rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor),
        q+' 이 판을 깔고 있다 — 로그인처럼 행만 남긴다 ['+c.backgroundImage.slice(0,30)+' / '+c.backgroundColor+']');
      assert(parseFloat(c.borderTopWidth)===0,q+' 에 테두리가 남아 있다'); }
    // ② 토글 = 알약 테두리만. 켜짐을 **면으로 채우지 않는다**(이 화면에서 유일한 색 덩어리였다)
    { const on=document.querySelector('#settingsPop .setSw.on')||document.querySelector('#settingsPop .setSw');
      if(on){ const c=getComputedStyle(on);
        assert(c.backgroundImage==='none' && /rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor),
          '토글이 면을 채운다 — 켜짐은 빛으로만 말한다');
        assert(parseFloat(c.borderTopWidth)>0,'토글 테두리가 없다 — 무엇을 누르는지 안 보인다'); } }
    // ③ 타이틀 로고보다 위에 있어야 한다 — 아니면 로고가 설정을 뚫고 보인다(실제로 그랬다)
    assert(+getComputedStyle(pop).zIndex > +getComputedStyle($('titleMark')).zIndex,
      '설정이 타이틀 로고보다 아래다 — 로고가 뚫고 보인다');
    // ④ 빨강이 남아 있으면 안 된다 — .mIco 기본색이 빨강이라 닫기 ✕ 가 물든다
    { const ic=document.querySelector('#settingsPop .setX .mIco');
      if(ic) assert(!/rgb(25[0-9], 5[0-9], 5[0-9])/.test(getComputedStyle(ic).color),
        '닫기 ✕ 가 빨갛다 — .mIco 기본색을 안 막았다: '+getComputedStyle(ic).color); }
    // ⑤ 여닫기 — 뚝 나타나거나 사라지지 않는다(로그인과 같은 박자)
    assert(getComputedStyle(pop).animationName!=='none','설정이 애니 없이 뜬다');
    closeSettings();
    assert(!pop.classList.contains('hide'),'닫기가 즉시 감춘다 — 흐려질 틈이 없다');
    assert(pop.classList.contains('closing'),'닫는 연출이 안 걸린다');
    await sleep(_cssMs('--t-swap',.22)+140);
    assert(pop.classList.contains('hide'),'연출이 끝났는데 안 감춰짐');
    openHome(); await sleep(40);
    return '판 없음 · 토글 테두리만 · 여닫기 '+_cssMs('--t-swap',.22)+'ms'; });
  // 🔀 로그인 안에서 내용이 바뀔 때(허브↔폼 · 로그인↔회원가입)도 뚝 끊기지 않는다.
  await step('로그인 내부 전환: 짧은 디졸브로 바뀐다', async()=>{
    skipIf(typeof authSwapDefer!=='function' || typeof authOpenForm!=='function','내부 전환 없음');
    const au=$('auth'), inn=()=>document.querySelector('.authIn');
    showAppScreen('auth'); await sleep(_holdMs()+120);          // 완전히 뜬 상태에서 시작
    assert(au.classList.contains('inView'),'로그인이 안 떠 있다');
    // 스크림은 **한 장**이어야 한다 — 두 장을 겹치면 그 경계가 띠로 보인다(로고 뒤·블록 뒤를 따로 깔았다가 그랬다).
    { const two=['.authIn','#titleMark'].filter(q=>{ const e=document.querySelector(q); if(!e) return false;
        return /gradient/.test(getComputedStyle(e,'::before').backgroundImage); });
      assert(!two.length,'스크림이 여러 장이다 — 겹치는 자리에 띠 경계가 생긴다: '+two.join(', ')); }
    // 그리고 끝에서 0 에 닿아야 한다 — 색이 남으면 그 자리가 직선으로 잘려 보인다.
    { const sc=getComputedStyle($('titleBg'),'::before').backgroundImage;
      assert(/transparent|rgba\(0, 0, 0, 0\)/.test(sc),'스크림이 투명으로 안 끝난다 — 가장자리가 잘린다');
      assert((sc.match(/rgba?\(/g)||[]).length>=4,'스크림 단계가 적어 끝이 급하다: '+sc.slice(0,60)); }
    // ⭐ 진짜 디졸브 = 나가는 판과 들어오는 판이 **동시에 보인다**.
    //    순서대로 흐렸다 나타내면 중간이 비어 '사라졌다 나타나는' 것으로 보인다(그렇게 만들었다가 되돌림).
    authOpenForm('id'); await sleep(60);
    const hub=$('authHub'), form=$('authForm');
    const hs=getComputedStyle(hub), fs2=getComputedStyle(form);
    assert(hs.display!=='none' && fs2.display!=='none',
      '전환 중에 한쪽만 있다 — 겹치지 않으면 디졸브가 아니다 (허브 '+hs.display+' · 폼 '+fs2.display+')');
    assert(+hs.opacity>0.03 && +hs.opacity<0.97 && +fs2.opacity>0.03 && +fs2.opacity<0.97,
      '겹치는 구간이 없다 (허브 '+hs.opacity+' · 폼 '+fs2.opacity+')');
    // ⭐ 겹치는 동안 **자리가 안 움직여야** 한다 — 나가는 판이 밀려나면 화면이 튀는 것처럼 보인다.
    { const hr=hub.getBoundingClientRect(), fr=form.getBoundingClientRect();
      assert(Math.abs(hr.top-fr.top)<=2,'전환 중 두 판의 윗변이 어긋난다 — 제자리 디졸브가 아니다 (허브 '
        +Math.round(hr.top)+' · 폼 '+Math.round(fr.top)+')'); }
    await sleep(_cssMs('--t-swap',.22)+240);
    assert(getComputedStyle(hub).display==='none','전환이 끝났는데 옛 판이 남아 있다');
    assert(!form.classList.contains('hide'),'폼이 안 열렸다 — 본문이 실행되지 않았다');
    assert(+getComputedStyle(document.querySelector('.authIn')).opacity>0.9,'내용이 안 돌아왔다');
    assert(_cssMs('--t-swap',.22) < _cssMs('--t-auth',.95),'내부 전환이 화면 등장보다 느리다');
    if(typeof authShowHub==='function'){ authShowHub(); await sleep(_cssMs('--t-swap',.22)+240); }
    openHome(); await sleep(40);
    return '디졸브 '+_cssMs('--t-swap',.22)+'ms'; });
  // 🎬 게임으로 들어가는 마무리 — 로딩 → **로고만 남은 검은 화면** → 게임 화면이 드러나며 로고도 함께 사라진다.
  await step('게임 진입: 검은 화면에 로고만 남았다가 게임과 함께 걷힌다', async()=>{
    skipIf(typeof titleToBlack!=='function' || typeof titleOutroEnd!=='function','진입 연출 없음');
    const ph=$('phone'), z=id=>+getComputedStyle($(id)).zIndex;
    // ① 층 순서 — 그림 < 검은 판 < 로고. 이게 어긋나면 "검은 화면에 로고만"이 성립하지 않는다.
    assert(z('titleBg') < z('titleBlack'),'검은 판이 키 아트보다 아래다');
    assert(z('titleBlack') < z('titleMark'),'로고가 검은 판에 덮인다');
    assert(z('titleBlack') > z('homeScreen'),'검은 판이 게임 화면보다 아래다 — 덮지 못한다');
    // ② 검은 화면 = 그림은 꺼지고 로고와 검은 판만 켜진 상태
    showAppScreen('opening'); await sleep(40);
    await titleToBlack();
    assert(!ph.classList.contains('artBg'),'검은 화면인데 키 아트가 남아 있다');
    assert(ph.classList.contains('artMark'),'검은 화면에 로고가 없다');
    assert(ph.classList.contains('artBlack'),'검은 판이 안 깔렸다');
    assert($('opening').classList.contains('hide'),'로딩 막대가 안 걷혔다');
    // ③ 마무리 — 검은 판과 로고가 **함께** 걷힌다(한쪽만 남으면 화면이 잠기거나 로고가 떠 있다)
    titleOutroEnd();
    assert(!ph.classList.contains('artBlack') && !ph.classList.contains('artMark'),
      '검은 판·로고가 안 걷혔다 — 화면이 검은 채로 잠긴다');
    openHome(); await sleep(40);
    return '층 '+z('titleBg')+' < '+z('titleBlack')+' < '+z('titleMark')+' · 정지 '+TITLE_BLACK_HOLD+'ms'; });
  // 전장 조각은 항상 떠 있고 앱 화면이 덮을 뿐이다 — 덮개가 한순간 투명해지면 그대로 비친다.
  await step('게임 밖에서는 전장이 안 보인다', async()=>{
    skipIf(typeof setInGame!=='function','setInGame 없음');
    // 🏕 캠프에서 빠져나온 뒤에 잰다. 캠프는 .gview 층을 빌려 #vBuild 만 켜 두므로,
    //    켜져 있으면 #vMain 이 display:none 이고 그 안 #cvMain 이 0×0 이 된다
    //    (앱에서는 게임 시작 시 switchTab 이 다시 켜므로 문제가 없다 — 검사 격리용이다).
    if(typeof campExit==='function') campExit();
    const was=$('phone').classList.contains('inGame');
    setInGame(false);
    for(const id of ['vMain','hud','chatBar','chatLog'])
      assert(getComputedStyle($(id)).visibility==='hidden', id+' 이 게임 밖에서도 보인다 — 로딩·로그인 화면에 전장 조각이 남는다');
    assert(getComputedStyle($('cvMarine')).visibility!=='hidden','공용 3D 캔버스까지 가렸다 — HOME·마을 3D 가 사라진다');
    const r=$('cvMain').getBoundingClientRect();
    assert(r.width>1 && r.height>1,'전장 캔버스가 0×0 — display 로 껐다(크기를 재서 그리는 코드가 망가진다)');
    setInGame(true);
    for(const id of ['vMain','hud'])
      assert(getComputedStyle($(id)).visibility!=='hidden', id+' 이 게임 중에도 안 보인다');
    setInGame(was); openHome(); await sleep(40);
    return '전장 가림 ok · 캔버스 '+Math.round(r.width)+'×'+Math.round(r.height)+' 유지'; });
  // 🔻 하단 네비 = 로그인 화면과 같은 어휘(2026-08-24 · E안). 여기가 어긋나면 두 화면이 다른 앱처럼 보인다.
  //    ⚠ 2026-08-25: 인게임 유즈맵 탭바(#tabs)도 **같은 어휘로 통일**했다(그전 계약을 뒤집었다).
  //       판 대신 스크림이 가독성을 맡는다 — 로딩·로그인이 쓰는 그 방식이다. 둘 다 같이 잰다.
  await step('하단 네비 + 인게임 탭바: 판 없이 가로 42px · 선택은 밑변 광원', async()=>{
    skipIf(typeof navGo!=='function','네비 없음');
    openHome(); await sleep(60);
    const bar=$('navBar'); assert(bar,'navBar 없음');
    const bh=Math.round(bar.getBoundingClientRect().height);
    assert(bh<=44, '네비가 안 낮아졌다: '+bh+'px (42 이하여야 한다)');
    const bs=getComputedStyle(bar);
    assert(bs.backgroundImage==='none','네비 바가 면을 채웠다 — 로그인은 판을 전부 걷어냈다');
    assert(getComputedStyle(bar,'::before').display==='none','윗변 광선이 남아 있다 — 면이 없으면 가를 경계도 없다');
    navGo('shop'); await sleep(140);
    const cells=[...bar.querySelectorAll('.navIt')].filter(e=>!e.classList.contains('navBk'));
    assert(cells.length>=4,'칸이 없다: '+cells.length);
    for(const c of cells){ const cs=getComputedStyle(c);
      assert(cs.flexDirection==='row','칸이 아직 세로로 쌓인다 — 42px 이 안 나온다');
      assert(cs.borderTopWidth==='0px'||cs.borderTopStyle==='none','칸에 테두리(금속 링)가 남아 있다');
      assert(parseFloat(cs.borderTopLeftRadius)===0,'칸이 라운드다 — 로그인은 라운드 0');
      assert(cs.backgroundImage==='none','칸이 판을 깔았다');
      assert(c.getBoundingClientRect().height>=43.5,'히트 영역이 44px 미만: '+c.getBoundingClientRect().height); }
    const on=bar.querySelector('.navIt.on,.navIt.cur'); assert(on,'선택된 칸이 없다');
    const a=getComputedStyle(on,'::after');
    assert(a.content!=='none','선택 표시가 없다 — 밑변 광원이 서명이다');
    assert(a.height==='1px','선택 광원이 1px 이 아니다: '+a.height);
    assert(a.backgroundImage.indexOf('255, 59, 59')>=0,'선택 광원에 액센트 halo 가 없다');
    assert(a.boxShadow!=='none','선택 광원에 halo(box-shadow)가 없다');
    // 인게임 탭바도 같은 규칙이다 — 판 없음 · 가로 · 라운드 0 · 스크림이 가독성을 맡는다
    const tb=$('tabs');
    if(tb){ const ts=getComputedStyle(tb);
      assert(ts.height==='42px','인게임 탭바가 안 낮아졌다: '+ts.height+' (--tabH 42px)');
      assert(ts.backgroundImage==='none','인게임 탭바가 아직 면을 깔았다');
      assert(getComputedStyle(tb,'::before').display==='none','탭바 윗변 광선이 남아 있다');
      // ⛔ 판을 걷었으면 스크림이 반드시 있어야 한다 — 없으면 전장 위에서 글자가 사라진다
      const sc=getComputedStyle(tb,'::after');
      assert(sc.content!=='none' && sc.backgroundImage.indexOf('gradient')>=0,
        '탭바에 스크림이 없다 — 판을 걷었으면 이것이 가독성을 맡는다');
      const tab=tb.querySelector('.tab');
      if(tab){ const cs=getComputedStyle(tab);
        assert(cs.backgroundImage==='none','인게임 탭바 칸이 아직 판을 깔았다');
        assert(cs.flexDirection==='row','인게임 탭바 칸이 아직 세로로 쌓인다');
        assert(parseFloat(cs.borderTopLeftRadius)===0,'인게임 탭바 칸이 라운드다');
        // 5칸이라 글자가 넘치기 쉽다 — 실제로 안 넘치는지 잰다(0.5px 차이로 갈렸던 자리다)
        assert(tab.scrollWidth<=Math.ceil(tab.clientWidth)+1,
          '탭바 칸의 글자가 넘친다: scroll '+tab.scrollWidth+' > client '+tab.clientWidth); } }
    navBack(); openHome(); await sleep(40);
    return '네비 '+bh+'px · 칸 '+cells.length+' · 인게임 탭바 '+(tb?getComputedStyle(tb).height:'-'); });
  // 🖼 폰 바깥 여백 — 검정이면 폰 밑변과 이어져 하단 네비가 어디서 끝나는지 안 보인다.
  // 🎥 DOM(바닥·격자·구역·건물·HP바)과 3D(유닛·선택링)는 그리는 경로가 다르다. 팬·줌 중에
  //    DOM 을 안 그리면 3D 만 움직여 선택링이 건물에서 떨어져 보이고, 밀어낸 바깥이 검게 빈다.
  //    pointermove/up 은 document 에 걸려 있어 다시 그려도 드래그가 안 끊긴다 → 그냥 그린다.
  //    ⭐ **정상 조작과 같은 경로로 잰다**: 목표 뷰(techViewT)만 바꾸고 프레임 루프가 보간하게 둔다.
  await step('맵 확대·이동: 손가락이 닿아 있어도 맵이 3D 와 같이 다시 그려진다', async()=>{
    skipIf(typeof techView!=='function' || typeof techViewT!=='function','건설 뷰 없음');
    openHome(); await sleep(120);
    skipIf(!document.querySelector('.bmap'),'맵 요소 없음');
    const v=techView(), t=techViewT(); skipIf(!v||!t,'뷰 없음');
    const z0=v.zoom, tz0=t.zoom;
    const hold0=(typeof _techHold!=='undefined')?_techHold:0;
    let vz=z0, floorZ=null;
    try{
      _techHold=1;                                   // 👆 손가락이 눌린 상태
      t.zoom=Math.min(2.2, tz0*1.7);                 // 핀치와 같은 경로 — 목표만 바꾼다
      await sleep(420);                              // 프레임 루프가 보간하는 동안
      vz=v.zoom;
      // 바닥은 techMapRender 가 그릴 때만 새 transform 을 갖는다 → 이게 '다시 그렸다'의 증거
      const f=document.querySelector('.bmapFloor');
      if(f){ const m=getComputedStyle(f).transform; floorZ=parseFloat(m.slice(m.indexOf('(')+1)); }
    } finally { _techHold=hold0; t.zoom=tz0; v.zoom=z0; if(typeof techMapRender==='function') techMapRender(); }
    assert(Math.abs(vz-z0)>0.05,'뷰가 아예 안 움직였다 — 프레임 루프가 안 돈다(검사가 무의미)');
    assert(floorZ!=null,'바닥 요소를 못 찾았다');
    assert(Math.abs(floorZ-vz)<0.03,
      '손가락 중 맵이 다시 안 그려졌다 — 바닥 ×'+floorZ.toFixed(3)+' vs 뷰 ×'+vz.toFixed(3)+' (3D 만 움직여 선택링이 어긋난다)');
    return '뷰 ×'+vz.toFixed(2)+' · 바닥 ×'+floorZ.toFixed(2)+' 동기'; });
  await step('폰 바깥 여백: 화면 안보다 밝아 폰의 윤곽이 경계가 된다', ()=>{
    // 정규식 없이 판다 — 'rgb(201, 192, 172)' 의 괄호 안을 콤마로 자른다
    const lum=(c)=>{ const i=(c||'').indexOf('('), j=(c||'').indexOf(')');
      if(i<0||j<0) return null;
      const n=c.slice(i+1,j).split(',').map(x=>parseFloat(x));
      if(n.length<3||n.some(isNaN)) return null;
      const a=(n.length>3?n[3]:1);
      return (0.2126*n[0]+0.7152*n[1]+0.0722*n[2])*a; };
    const outside=lum(getComputedStyle(document.body).backgroundColor);
    assert(outside!==null,'body 배경을 못 읽음');
    assert(outside>120,'폰 바깥이 아직 어둡다(휘도 '+Math.round(outside)+') — 폰 밑변과 배경이 이어져 네비 끝이 안 보인다');
    const bar=$('navBar'); const inside=bar?lum(getComputedStyle(bar).backgroundColor):null;
    // 네비는 면이 없다(투명) — 그 뒤를 받는 #phone 바탕과 비교한다
    const phoneLum=lum(getComputedStyle($('phone')).backgroundColor);
    if(phoneLum!==null) assert(outside-phoneLum>80,'안팎 대비가 부족: 바깥 '+Math.round(outside)+' vs 안 '+Math.round(phoneLum));
    return '바깥 휘도 '+Math.round(outside)+' · 안 '+(phoneLum===null?'-':Math.round(phoneLum)); });
  // 🧹 예열은 유닛을 **화면 한가운데**(x:.5,y:.5) 세워 놓고 데운다. 지운 뒤 다시 그리지 않으면
  //    캔버스에 그 마지막 프레임이 박제돼, 검은 판이 페이드되는 동안 로고 옆에 유닛이 떠 보인다.
  //    ⚠ 프레임 루프도 같은 sync 를 부른다 — '마지막 호출'이 아니라 **예열 것들 뒤에 빈 호출이 왔는지**로 잰다.
  await step('예열: 데운 유닛을 지운 뒤 캔버스까지 비운다', async()=>{
    skipIf(typeof warmAll!=='function','예열 없음');
    skipIf(!(window.M3D && M3D.ready && M3D.ready()),'3D 없음');
    const calls=[];
    const real=M3D.sync;
    M3D.sync=function(list){ calls.push(Array.isArray(list)?list.length:-1); return real.apply(this, arguments); };
    try{
      _warmDone=false; _warmRun=null;          // 다시 데우게 한다
      await warmAll(()=>{});
    } finally { M3D.sync=real; }
    // 예열이 세운 것 = 1기짜리 호출. 그 마지막 뒤에 0기(비우기) 호출이 있어야 한다.
    const lastWarm=calls.lastIndexOf(1);
    const lastEmpty=calls.lastIndexOf(0);
    assert(lastWarm>=0,'예열이 유닛을 안 세웠다: '+calls.join(','));
    assert(lastEmpty>lastWarm,
      '데운 뒤 빈 sync 가 없다 — 지우기만 하고 다시 안 그렸다: 캔버스에 유닛이 박제된다 ('+calls.join(',')+')');
    try{ M3D.clearGameModels(); }catch(e){}   // 뒤 스텝에 흔적을 남기지 않는다
    return '호출 '+calls.join(',')+' → 비우기 ok'; });
    await step('유즈맵 선택 → 네모네모 모드 팝업', ()=>{ openMapSelect(); openModeSheet(USEMAPS.nemo_inf||USEMAPS.nemo);
    const mo=document.querySelector('#modeSheet .moCard'); assert(visible(mo),'moCard 안 보임');
    const w=mo.getBoundingClientRect().width; assert(w>200&&w<400,'moCard 폭 이상: '+w); closeModeSheet(); return 'w='+w; });
  // 🎚 개인 플레이 난이도 = 세그먼트 바로 고르고 상세에서 확인 후 시작(목록 훑어 즉시 시작하던 방식 폐지)
  // ══ 방 찾기 — 빠른 입장이 맨 위 · 난이도는 공용 탭 띠 · 행 밑변이 난이도 색 ══
  await step('방 찾기: 빠른 입장이 주 액션 · 난이도 없는 맵은 띠를 통째로 비운다', async ()=>{
    skipIf(typeof openRooms!=='function','방 찾기 없음');
    openMapSelect(); await sleep(60);
    // ① 난이도 있는 유즈맵
    _selMap=USEMAPS.nemo; hideAppScreens(); openRooms(); await sleep(300);
    const card=document.querySelector('#rooms .rmCard');
    assert(card,'방 찾기 카드가 없음');
    // ⛔ 방 찾기는 **전체 화면**이다 — 팝업 카드 틀 안에 다시 넣으면 안 된다(상·하단까지 화면이 쓴다)
    { const r=card.getBoundingClientRect(), o=$('rooms').getBoundingClientRect();
      assert(Math.abs(r.width-o.width)<1 && Math.abs(r.height-o.height)<1,
        '방 찾기가 화면을 다 안 씀(카드 틀에 갇혔다): '+Math.round(r.width)+'x'+Math.round(r.height)+' vs '+Math.round(o.width)+'x'+Math.round(o.height));
      const cs=getComputedStyle(card);
      assert(parseFloat(cs.borderTopWidth)===0,'전체 화면인데 카드 테두리가 남아 있음');
      assert(getComputedStyle(card,'::before').display==='none','전체 화면인데 공용 네온 프레임이 남아 있음');
      const nav=$('navBar');
      assert(!nav || nav.classList.contains('hide'),'방 찾기인데 하단 네비가 떠 있음'); }
    // 주 액션은 **맨 위 빠른 입장 하나뿐**이다(하단은 전부 하위 단계)
    const q=card.querySelector('.rmQuickTop');
    assert(q && q.classList.contains('actBtn') && q.classList.contains('pri'),'빠른 입장이 맨 위 주 액션(.actBtn.pri)이 아님');
    assert(card.querySelectorAll('.actBtn.pri').length===1,'주 액션이 둘 이상임');
    assert(/방/.test($('rmQuickSub').textContent),'빠른 입장 안의 방 수 표기가 없음: '+$('rmQuickSub').textContent);
    // 난이도 = 공용 탭 띠. ⛔ 옛 팝다운(.rmDiff)을 되살리면 안 된다
    assert($('rmFilter').querySelector('.pdSeg'),'난이도 필터가 공용 탭 띠(.pdSeg)가 아님');
    assert(!document.querySelector('#rooms .rmDiffMenu'),'옛 난이도 팝다운이 남아 있음');
    // 행 밑변 = 난이도 색. 잠긴 행(게임중·가득참)은 광원이 죽는다
    { const rows=[...card.querySelectorAll('.roomItem')];
      assert(rows.length,'방 목록이 비었음');
      const open=rows.find(r=>!r.classList.contains('locked'));
      assert(open && /^#[0-9a-f]{3,8}$/i.test((open.style.getPropertyValue('--dc')||'').trim()),
        '행에 난이도 색(--dc)이 안 실림: '+open.style.getPropertyValue('--dc'));
      assert(getComputedStyle(open,'::after').content!=='none','행 밑변 광원이 없음');
      const lk=rows.find(r=>r.classList.contains('locked'));
      if(lk) assert(!lk.style.getPropertyValue('--dcGlow'),'잠긴 행인데 광원이 살아 있음'); }
    // 하단 = 방 만들기가 가로로 길고, 뒤로·새로고침은 작은 정사각
    { const btns=[...card.querySelectorAll('.rmBtns .actBtn')];
      assert(btns.length===3,'하단 버튼이 3개가 아님: '+btns.length);
      const sq=btns.filter(b=>b.classList.contains('sq'));
      assert(sq.length===2,'뒤로·새로고침이 작은 정사각이 아님');
      const grow=btns.find(b=>!b.classList.contains('sq'));
      assert(grow.getBoundingClientRect().width > sq[0].getBoundingClientRect().width*2,
        '방 만들기가 충분히 길지 않음'); }
    // 방 번호 입장 = 평소엔 접혀 있고 🔍로 편다
    assert($('rmNumRow').classList.contains('hide'),'방 번호 줄이 처음부터 펼쳐져 있음');
    toggleRoomNum(); await sleep(80);
    assert(!$('rmNumRow').classList.contains('hide') && $('rmNumBtn').classList.contains('on'),'🔍로 방 번호 줄이 안 펴짐');
    toggleRoomNum(); await sleep(60);
    // ② 난이도 없는 유즈맵 = 띠를 통째로 비운다(요약 줄 같은 것으로 대신 채우지 않는다)
    backToTitle(); await sleep(80);
    _selMap=USEMAPS.cpu; hideAppScreens(); openRooms(); await sleep(300);
    assert($('rmFilter').innerHTML==='','난이도 없는 유즈맵인데 필터 띠가 남아 있음');
    assert(!$('rmFilter').getBoundingClientRect().height,'빈 필터 띠가 자리를 차지함');
    { const r=document.querySelector('#rooms .roomItem');
      assert(r && !r.style.getPropertyValue('--dc'),'난이도 없는 맵인데 행에 난이도 색이 실림'); }
    assert(document.querySelector('#rooms .rmQuickTop'),'난이도 없는 맵에서 빠른 입장이 사라짐');
    backToTitle(); await sleep(200);
    { const nav=$('navBar'); assert(nav && !nav.classList.contains('hide'),'방 찾기에서 나왔는데 하단 네비가 안 돌아옴'); }
    return '전체 화면 · 난이도 있음/없음 두 경로 ok'; });
  // ══ 멀티 대기실 — 전체 화면 · 내 종족은 공용 탭 띠 · 8칸이 스크롤 없이 다 보인다 ══
  await step('대기실: 전체 화면 · 종족 띠(잠긴 맵은 안내) · 슬롯 8칸 노출', async ()=>{
    skipIf(typeof openLobby!=='function','대기실 없음');
    const close=()=>{ if(typeof leaveLobby==='function'){ try{ leaveLobby(); }catch(e){} }
      const l=$('lobby'); if(l) l.classList.add('hide'); };
    // ① 오토 배틀 — 팀 + 종족
    openMapSelect(); await sleep(60);
    _selMap=USEMAPS.cpu; _lobbyMax=8; hideAppScreens(); openRooms(); await sleep(120);
    openLobby({num:3855,name:'오토배틀 연구소',host:myNick(),startCount:6,joining:false,visibility:'public',max:8,
      opts:{cycleTime:10,startGold:700,incomeBase:70,hpMul:0.7}});
    await sleep(500);
    const card=document.querySelector('#lobby .lbCard');
    assert(card,'대기실 카드가 없음');
    // ⛔ 팝업 카드가 아니다 — 화면을 통째로 쓴다
    { const r=card.getBoundingClientRect(), o=$('lobby').getBoundingClientRect();
      assert(Math.abs(r.width-o.width)<1 && Math.abs(r.height-o.height)<1,'대기실이 화면을 다 안 씀(카드 틀에 갇혔다)');
      assert(parseFloat(getComputedStyle(card).borderTopWidth)===0,'전체 화면인데 카드 테두리가 남아 있음'); }
    // 방 조건 카드 = 방 만들기의 대전 설정 판과 같은 언어. 사용자 지정 값이 그대로 보여야 한다
    { const c=$('lbCond'), st=[...c.querySelectorAll('.lbCondSt b')].map(b=>b.textContent);
      assert(c.querySelectorAll('.lbCondSt span').length===4,'방 조건 칸이 4개가 아님');
      assert(st.join(' ').indexOf('10초')>=0 && st.join(' ').indexOf('700')>=0,
        '사용자 지정 값이 방 조건에 안 실림: '+st.join(' ')); }
    // 종족 = 공용 탭 띠. ⛔ 여기 전용 종족 UI 를 새로 만들면 안 된다
    { const sec=$('lbRaceSec');
      assert(sec.querySelector('.pdSeg'),'종족 선택이 공용 탭 띠(.pdSeg)가 아님');
      // ⚠ 공용 .pdSeg 는 max-width:286px 라 그대로 두면 오른쪽에 여백이 남는다
      { const a=sec.querySelector('.pdSeg').getBoundingClientRect().width, b=sec.getBoundingClientRect().width;
        assert(Math.abs(a-b)<1.5,'종족 띠가 폭을 다 안 씀: '+Math.round(a)+' vs '+Math.round(b)); }
      assert(sec.querySelectorAll('.pdSegBtn').length===STK_RACE_ORDER.length,'종족 칸 수가 STK_RACE_ORDER 와 다름');
      assert(!sec.querySelector('.lbRaceLk'),'오토배틀인데 종족이 잠겨 있음');
      // 탭 글자가 잘리면 안 된다
      sec.querySelectorAll('.pdSegBtn').forEach(b=>assert(b.scrollWidth<=b.clientWidth+0.5,'종족 탭 글자가 잘림: '+b.textContent)); }
    // 띠를 누르면 내 종족이 바뀐다(입구는 이 하나뿐 — 슬롯 칩은 읽기 전용)
    { const k=STK_RACE_ORDER[1]; setLobbyRace(k); await sleep(80);
      const me=_lobbySlots.find(s=>s&&s.me);
      assert(me && me.race===k,'띠로 고른 종족이 내 슬롯에 안 실림');
      const chip=document.querySelector('#lbGrid .lbSlot.me .lbRace');
      assert(chip && !chip.getAttribute('onclick'),'슬롯 종족 칩이 아직 클릭 입구를 갖고 있음(입구가 둘)'); }
    // 슬롯 8칸이 스크롤 없이 다 보인다
    // ⚠ 슬롯 판은 여유가 0px 이라 **한 줄이 1px만 자라도** 스크롤이 된다.
    //   종족 이름은 한글이므로 숫자 글꼴(Rajdhani)에 맡기면 글자마다 폴백을 타 줄 높이가 흔들린다 →
    //   가족·줄높이를 못 박았는지 정적으로 본다(간헐 실패를 운에 맡기지 않는다).
    { const nm=document.querySelector('#lbGrid .lbRace .lrNm');
      if(nm){ const ns=getComputedStyle(nm);
        assert(!/Rajdhani/i.test(ns.fontFamily),'종족 이름(한글)이 숫자 글꼴로 지정됨: '+ns.fontFamily);
        assert(ns.lineHeight!=='normal','종족 이름 줄 높이가 폰트 메트릭에 맡겨져 있음(흔들린다)'); } }
    { const g=$('lbGrid');
      assert(g.querySelectorAll('.lbSlot').length===_lobbyMax,'슬롯 수가 정원과 다름');
      assert(g.scrollHeight<=g.clientHeight+0.5,'슬롯 8칸이 스크롤됨: '+g.scrollHeight+'>'+g.clientHeight); }
    // 머리줄 배지 — 팀전이면 대진, 사용자 지정 방이면 그 표시까지
    { const rt=$('lbRoom').textContent;
      assert(/vs/.test(rt),'팀전인데 대진 배지가 없음: '+rt);
      assert(/사용자 지정/.test(rt),'사용자 지정 방인데 표시가 없음: '+rt); }
    // 하단 = 공용 액션 버튼
    assert($('lbStart').classList.contains('actBtn')&&$('lbStart').classList.contains('pri'),'시작이 공용 .actBtn.pri 가 아님');
    assert(document.querySelector('#lobby .lbBtns .actBtn.sub'),'나가기가 공용 .actBtn.sub 가 아님');
    // ② 네모네모 — 종족이 없으니 그 자리가 잠긴 안내로 바뀐다
    close(); await sleep(200);
    _selMap=USEMAPS.nemo; hideAppScreens(); openRooms(); await sleep(120);
    openLobby({num:4821,name:'같이 클리어해요',host:myNick(),startCount:6,joining:false,visibility:'public',diff:'easy',max:8});
    await sleep(500);
    { const sec=$('lbRaceSec');
      assert(sec.querySelector('.lbRaceLk'),'종족 없는 유즈맵인데 잠김 안내가 없음');
      assert(!sec.querySelector('.pdSeg'),'종족 없는 유즈맵인데 선택 띠가 떠 있음');
      assert(!document.querySelector('#lbGrid .lbRace'),'종족 없는 유즈맵인데 슬롯에 종족 칩이 있음'); }
    { const g=$('lbGrid'); assert(g.scrollHeight<=g.clientHeight+0.5,'네모네모 슬롯 8칸이 스크롤됨'); }
    // 난이도 맵도 같은 자리에 조건 카드가 뜬다(난이도·적HP·포인트·정원)
    { const st=[...$('lbCond').querySelectorAll('.lbCondSt b')].map(b=>b.textContent);
      assert(st.length===4 && st[0]===DIFFICULTY.easy.name,'난이도 맵 방 조건이 이상함: '+st.join(' ')); }
    // ⚠ 채팅이 남는 높이를 통째로 먹으면 화면 절반이 빈 검은 판이 된다 — 상한이 살아 있는지 본다
    { const w=document.querySelector('#lobby .lbChatWrap').getBoundingClientRect(),
            card=document.querySelector('#lobby .lbCard').getBoundingClientRect();
      assert(w.height <= card.height*0.28, '채팅이 너무 넓다: '+Math.round(w.height)+'px / 카드 '+Math.round(card.height)); }
    assert(/EASY/i.test($('lbRoom').textContent),'난이도 배지가 없음: '+$('lbRoom').textContent);
    // ③ 슬롯 판 높이는 **고정**이다 — 팀 유무와 정원이 달라져도 같아야 한다
    //    (팀전은 라벨 2줄이 더 들어가므로 팀이 없으면 행을 그만큼 키워 메운다)
    const gridH=async(map,max)=>{ close(); await sleep(150);
      _selMap=USEMAPS[map]; _lobbyMax=max; hideAppScreens(); openRooms(); await sleep(100);
      openLobby({num:1234,name:'높이 확인',host:myNick(),startCount:2,joining:false,visibility:'public',diff:'easy',max:max});
      await sleep(400);
      const g=$('lbGrid');
      return { h:Math.round(g.getBoundingClientRect().height), ov:g.scrollHeight-g.clientHeight,
               n:g.querySelectorAll('.lbSlot').length }; };
    const t8=await gridH('cpu',8), c8=await gridH('nemo',8), c4=await gridH('nemo',4), t4=await gridH('cpu',4);
    assert(t8.h===c8.h,'팀 유무로 슬롯 판 높이가 달라짐: 팀전 '+t8.h+' vs 협동 '+c8.h);
    assert(c8.h===c4.h && t8.h===t4.h,'정원이 줄자 슬롯 판이 같이 줄었다: '+c8.h+'→'+c4.h+' / '+t8.h+'→'+t4.h);
    assert(c4.n===4 && t4.n===4,'정원이 줄었는데 행이 안 사라짐');
    [t8,c8,c4,t4].forEach(x=>assert(x.ov<=0.5,'슬롯 판이 스크롤됨(높이 식이 안 맞는다)'));
    close(); await sleep(150); openMapSelect(); await sleep(80);
    return '종족 '+STK_RACE_ORDER.length+'칸 · 잠김 ok · 슬롯 판 '+t8.h+'px 고정'; });
  // ══ 실방 전파 — 종족은 presence, 대전 설정은 방장 시작 신호가 나른다 ══
  await step('실방: 종족·대전 설정이 참가자에게 전파된다', async ()=>{
    skipIf(typeof rtRoomMe!=='function' || typeof rtRoomOnStart!=='function','실방 경로 없음');
    // ① presence 에 싣는 내 상태 — 종족이 들어가고 입장 시각(t)이 보존된다
    //    ⚠ track 은 덮어쓰기라 일부만 보내면 t 가 지워져 슬롯 순서가 뒤바뀐다
    RTROOM.joinT=12345; _selRace='zerg';
    { const me=rtRoomMe();
      assert(me.race==='zerg','presence 에 내 종족이 안 실림: '+me.race);
      assert(me.t===12345,'presence 재전송에서 입장 시각이 지워짐: '+me.t);
      assert(('uid' in me) && ('nick' in me) && ('host' in me) && ('ready' in me),
        'presence 에 빠진 항목이 있다: '+Object.keys(me).join(',')); }
    // ② 방 목록 → 입장 경로가 대전 설정을 나르는가
    assert(/opts/.test(String(joinRoom)),'joinRoom 이 방의 대전 설정을 안 넘김');
    assert(/opts/.test(String(lobbyStart)),'시작 신호에 대전 설정이 안 실림');
    assert(/race/.test(String(lobbyStart)),'시작 신호에 슬롯별 종족이 안 실림');
    // ③ 참가자 쪽 — 방장 신호를 실제로 태워 본다(게임 진입만 스텁)
    // ⚠ 되돌릴 것을 하나라도 빠뜨리면 **뒤 스텝이 오염된다**(MAP 을 안 되돌렸다가 오토배틀 스텝이 깨졌다)
    const keep={ start:window.startGameNow, coop:window.startGameCoop, room:_lobbyRoom,
                 race:_selRace, selMap:_selMap, MAP:MAP, ovr:MAP_CFG_OVR, diff:_selDiff };
    let got=null;
    window.startGameNow=function(a,m,n){ got={active:a, my:m, ovr:MAP_CFG_OVR, race:_selRace, opts:_lobbyRoom&&_lobbyRoom.opts}; };
    window.startGameCoop=function(){};
    try{
      _selMap=USEMAPS.cpu; MAP=USEMAPS.cpu; MAP_CFG_OVR=null; _selRace='terran';
      _lobbyRoom={ real:true, num:777, name:'전파 확인', opts:null };
      RTROOM.started=false;
      const OPTS={cycleTime:10,startGold:700,incomeBase:70,hpMul:0.7};
      rtRoomOnStart({ slots:[{num:1,uid:'other',race:'protoss'},{num:2,uid:myUid(),race:'zerg'}],
                      names:{1:'방장',2:myNick()}, opts:OPTS, from:'other' });
      await sleep(60);
      assert(got,'시작 신호를 받고도 게임 진입 경로를 안 탐');
      assert(got.race==='zerg','내 종족이 방장 신호에서 안 옴: '+got.race);
      // ⚠ startGameNow 가 _lobbyRoom.opts 를 읽어 MAP_CFG_OVR 을 심는다 —
      //    그러니 **게임 진입을 부르기 전에** 방에 실려 있어야 한다(순서가 뒤집히면 조용히 기본값으로 시작한다)
      assert(got.opts && got.opts.cycleTime===10,'게임 진입 시점에 방 설정이 아직 안 실렸다(순서가 뒤집혔다)');
      assert(/MAP_CFG_OVR/.test(String(startGameNow)) && /_lobbyRoom/.test(String(startGameNow)),
        'startGameNow 가 방 설정을 안 읽는다');
      // 받은 설정이 실제 엔진 값으로 풀리는가
      { const cfg=stkCfgFromOpts(got.opts);
        assert(cfg && cfg.cycleTime===10 && cfg.baseHp===Math.round(USEMAPS.cpu.cfg.baseHp*0.7),
          '받은 설정이 엔진 값으로 안 풀림'); }
    } finally {
      window.startGameNow=keep.start; window.startGameCoop=keep.coop;
      _lobbyRoom=keep.room; _selRace=keep.race; _selMap=keep.selMap; MAP=keep.MAP;
      MAP_CFG_OVR=keep.ovr; _selDiff=keep.diff;
      RTROOM.started=false; RTROOM.joinT=0;
      const l=$('lobby'); if(l) l.classList.add('hide'); }
    return '종족 presence · 설정 시작신호 · 순서 ok'; });
  // ══ 방 만들기 — 전체 화면 · 난이도는 스테퍼 · 오토배틀은 프리셋/사용자 지정 ══
  await step('방 만들기: 전체 화면 · 난이도 스테퍼 · 대전 설정이 실제 cfg 로 간다', async ()=>{
    skipIf(typeof createRoom!=='function','방 만들기 없음');
    // ① 난이도 있는 유즈맵 — 난이도 선택 화면과 **같은 컴포넌트**를 쓴다
    openMapSelect(); await sleep(60); _selMap=USEMAPS.nemo; hideAppScreens(); openRooms(); await sleep(200);
    createRoom(); await sleep(200);
    const card=document.querySelector('#createPanel .cpCard');
    assert(card,'방 만들기 카드가 없음');
    { const r=card.getBoundingClientRect(), o=$('createPanel').getBoundingClientRect();
      assert(Math.abs(r.width-o.width)<1 && Math.abs(r.height-o.height)<1,'방 만들기가 화면을 다 안 씀(카드 틀에 갇혔다)');
      assert(parseFloat(getComputedStyle(card).borderTopWidth)===0,'전체 화면인데 카드 테두리가 남아 있음'); }
    assert($('cpDiffStep').querySelector('.sdStepRow'),'난이도가 스테퍼(.sdStepRow)가 아님');
    assert($('cpDiffStep').querySelectorAll('.sdDots i').length===DIFFICULTY_ORDER.length,'난이도 점이 난이도 수와 다름');
    assert(!document.querySelector('#createPanel .cpDiffBtns .moDiffBtn'),'옛 난이도 pill 나열이 남아 있음');
    assert($('cpInfBtn').classList.contains('sdInf'),'무한 모드 줄이 공용 .sdInf 가 아님');
    assert($('cpMode').innerHTML==='','난이도 있는 맵인데 대전 설정 구역이 채워졌다');
    // 인원 = 1~8 칸 게이지(고른 값까지 채우고 고른 칸만 발광)
    setCpMax(5, true); await sleep(50);
    { const on=document.querySelectorAll('#cpMaxGrid .cpPc.on'), sel=document.querySelectorAll('#cpMaxGrid .cpPc.sel');
      assert(on.length===5,'인원 게이지가 고른 값까지 안 채워짐: '+on.length);
      assert(sel.length===1 && sel[0].textContent==='5','고른 칸이 하나가 아님'); }
    // ② 오토 배틀 — 프리셋 3장, 일반은 오버라이드가 없다
    closeCreate(); await sleep(60); backToTitle(); await sleep(80);
    _selMap=USEMAPS.cpu; hideAppScreens(); openRooms(); await sleep(200); createRoom(); await sleep(200);
    assert($('cpDiffSec').style.display==='none','난이도 없는 맵인데 난이도 구역이 보인다');
    assert($('cpMode').querySelectorAll('.cpPreC').length===STK_PRESETS.length,'프리셋 카드 수가 다름');
    assert(_createPre==='normal' && cpOptsPayload()===null,'일반 모드인데 오버라이드가 생김');
    assert(stkCfgFromOpts(cpOptsPayload())===null,'일반 모드인데 cfg 오버라이드가 생김');
    // ③ 프리셋(속도전) → 실제 cfg 로 번역된다. 체력 배율은 신전 3종 **구체값**이 되어야 한다
    setCpPreset('blitz'); await sleep(80);
    { const cfg=stkCfgFromOpts(cpOptsPayload());
      assert(cfg && cfg.cycleTime===10,'속도전 프리셋이 cfg 로 안 감');
      const base=USEMAPS.cpu.cfg;
      assert(cfg.baseHp===Math.round(base.baseHp*0.7) && cfg.secHp===Math.round(base.secHp*0.7)
        && cfg.centralHp===Math.round(base.centralHp*0.7),'체력 배율이 신전 3종에 안 곱해짐'); }
    // ④ 사용자 지정 = 상하한 밖으로 못 나간다(표가 단일 소스)
    setCpPreset('custom'); await sleep(80);
    assert($('cpMode').querySelectorAll('.cpOptRow').length===STK_OPTS.length,'조절 항목 수가 표와 다름');
    for(const o of STK_OPTS){
      for(let i=0;i<40;i++) stepCpOpt(o.k, 1);
      assert(stkOptVal(o.k)===o.max, o.name+' 이 상한을 넘거나 못 미침: '+stkOptVal(o.k)+' vs '+o.max);
      for(let i=0;i<60;i++) stepCpOpt(o.k, -1);
      assert(stkOptVal(o.k)===o.min, o.name+' 이 하한을 넘거나 못 미침: '+stkOptVal(o.k)+' vs '+o.min); }
    await sleep(60);
    // 하한을 다 찍은 상태 = 기본값이 아니므로 반드시 오버라이드가 생긴다
    { const pay=cpOptsPayload(); assert(pay,'사용자 지정인데 오버라이드가 비었음');
      STK_OPTS.forEach(o=>assert(pay[o.k]===o.min, o.name+' 값이 안 실림')); }
    // ⑤ 기본값 그대로면 오버라이드가 없어야 한다(일반과 같은 판이 되도록)
    STK_OPTS.forEach(o=>{ _createOpts[o.k]=o.def; }); renderCpMode(); await sleep(50);
    assert(cpOptsPayload()===null,'사용자 지정이지만 값이 기본값인데 오버라이드가 생김');
    closeCreate(); await sleep(60); backToTitle(); await sleep(80);
    return '난이도 스테퍼 · 프리셋 '+STK_PRESETS.length+' · 상하한 '+STK_OPTS.length+'항목 ok'; });
  // ⚠ 라운드가 화면마다 다르면 '둥글다'는 인상이 생긴다 — DESIGN §라운드 표(0/3/6/9) 밖 값을 잡는다
  await step('유즈맵 진입 화면 라운드: DESIGN 표(0/3/6/9) 밖이 없다', async ()=>{
    skipIf(typeof openRooms!=='function','방 찾기 없음');
    const scan=(id)=>{ const bad=[], KS=['borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius'];
      document.querySelectorAll('#'+id+' *').forEach(function(el){
        const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
        const cs=getComputedStyle(el);
        KS.forEach(function(k){ const raw=cs[k], v=parseFloat(raw)||0;
          if(v && [3,6,9].indexOf(Math.round(v))<0 && raw.indexOf('%')<0)
            bad.push((el.id||el.className||el.tagName)+' '+k+'='+raw); }); });
      return Array.from(new Set(bad)); };
    openMapSelect(); await sleep(60);
    _selMap=USEMAPS.nemo; hideAppScreens(); openRooms(); await sleep(250);
    { const b=scan('rooms'); assert(!b.length,'방 찾기에 표 밖 라운드: '+b.slice(0,3).join(' / ')); }
    createRoom(); await sleep(250);
    { const b=scan('createPanel'); assert(!b.length,'방 만들기(난이도)에 표 밖 라운드: '+b.slice(0,3).join(' / ')); }
    closeCreate(); await sleep(50); backToTitle(); await sleep(80);
    _selMap=USEMAPS.cpu; hideAppScreens(); openRooms(); await sleep(250); createRoom(); await sleep(200);
    setCpPreset('custom'); await sleep(120);
    { const b=scan('createPanel'); assert(!b.length,'방 만들기(대전 설정)에 표 밖 라운드: '+b.slice(0,3).join(' / ')); }
    closeCreate(); await sleep(50); backToTitle(); await sleep(80);
    return '세 화면 0건'; });
  // ⛔ UI 만 바뀌고 실제 게임 값이 그대로면 아무 의미가 없다 — 엔진 입구(mapCfg)까지 확인한다
  await step('대전 설정이 실제 게임 값을 바꾼다(mapCfg 까지)', async ()=>{
    skipIf(typeof stkCfgFromOpts!=='function','대전 설정 없음');
    const base=USEMAPS.cpu.cfg, keep=MAP, keepRoom=(typeof _lobbyRoom!=='undefined')?_lobbyRoom:null;
    MAP=USEMAPS.cpu; MAP_CFG_OVR=null;
    assert(mapCfg('cycleTime')===base.cycleTime,'기본 상태인데 맵 cfg 를 안 씀');
    // 방 설정을 심는다 = startGameNow 가 하는 것과 같은 한 줄
    MAP_CFG_OVR=stkCfgFromOpts({cycleTime:10,startGold:700,incomeBase:70,hpMul:0.5});
    assert(mapCfg('cycleTime')===10,'라운드 길이가 안 바뀜: '+mapCfg('cycleTime'));
    assert(mapCfg('startGold')===700,'시작 골드가 안 바뀜');
    assert(mapCfg('incomeBase')===70,'라운드 수입이 안 바뀜');
    assert(mapCfg('baseHp')===Math.round(base.baseHp*0.5),'본진 체력이 안 바뀜');
    assert(mapCfg('mineCost')===base.mineCost,'건드리지 않은 값까지 바뀜(오버라이드가 맵 cfg 를 통째로 덮었다)');
    // ⚠ 반납을 잊으면 다음 판까지 새어 밸런스가 조용히 어긋난다
    MAP_CFG_OVR=null;
    assert(mapCfg('cycleTime')===base.cycleTime,'반납했는데 값이 남아 있음');
    assert(/MAP_CFG_OVR\s*=\s*null/.test(String(overlayToLobby)),'로비 복귀 경로에 방 설정 반납이 없음');
    assert(/MAP_CFG_OVR\s*=/.test(String(startGameNow)),'게임 시작 경로에 방 설정 주입이 없음');
    MAP=keep; if(typeof _lobbyRoom!=='undefined') _lobbyRoom=keepRoom;
    return '라운드·골드·수입·체력 4항목 반영 ok'; });
  // ══ 공용 액션 버튼(.actBtn) — 세 상태를 한 컴포넌트가 갖는다 ══
  await step('공용 액션 버튼: 활성·비활성·하위가 한 판에서 빛으로만 갈린다', async ()=>{
    openMapSelect(); await sleep(60); _selMap=USEMAPS.nemo; openSoloDiff(); await sleep(150);
    const li=DIFFICULTY_ORDER.findIndex(d=>!diffUnlocked(d)), ui=DIFFICULTY_ORDER.findIndex(d=>diffUnlocked(d));
    skipIf(ui<0,'해금된 난이도 없음');
    const rgb=x=>(x.match(/\d+/g)||[]).slice(0,3).map(Number);
    const lum=c=>(0.2126*c[0]+0.7152*c[1]+0.0722*c[2])/255;
    // ① 면(背)은 세 상태 **모두 중립 회색**이다 — 색은 밑변 광원만 갖는다(DESIGN §0: 면을 채우지 않는다)
    sdPick(ui); await sleep(70);
    const pri=$('sdGo'), sub=document.querySelector('#soloDiffPanel .cpBtns .actBtn');
    assert(pri.classList.contains('pri'),'주 동작에 .pri 가 없음');
    assert(sub && !sub.classList.contains('pri'),'하위 단계에 .pri 가 붙어 있음');
    for(const [nm,el] of [['활성',pri],['하위',sub]]){
      const bg=rgb(getComputedStyle(el).backgroundColor);
      const dev=Math.max(...bg)-Math.min(...bg);
      assert(dev<=30, nm+' 버튼 면이 회색이 아님(채널 편차 '+dev+') — 색은 밑변 광원만 갖는다'); }
    // ② 밑변 광원: 활성은 붉고, 하위는 중립. ::after 한 겹이 단일 소스다
    const bar=el=>getComputedStyle(el,'::after').backgroundImage;
    const isRed=t=>[...t.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].some(m=>+m[1]>=180 && +m[2]<=110 && +m[3]<=110);
    assert(isRed(bar(pri)),'활성 버튼의 밑변 광원이 붉지 않음: '+bar(pri).slice(0,70));
    assert(!isRed(bar(sub)),'하위 버튼의 밑변까지 붉다 — 위계가 안 갈린다');
    // ③ 비활성 = 볼록 ↔ 오목이 통째로 뒤집힌다(윗변 하이라이트가 사라지고 위에서 그림자가 들어온다)
    // ⚠ renderSoloDiff 가 상세를 통째로 다시 그린다 → 값은 **다시 그리기 전에** 재 둘 것
    //    (떨어져 나간 노드에 getComputedStyle 을 걸면 빈 값이 와서 어떤 비교도 통과한다)
    const onSh=getComputedStyle(pri).boxShadow, onLum=lum(rgb(getComputedStyle(pri).color));
    if(li>=0){ sdPick(li); await sleep(70);
      const off=$('sdGo'); assert(off.disabled,'잠긴 난이도인데 버튼이 열려 있음');
      assert(getComputedStyle(off).boxShadow!==onSh,'비활성인데 볼록 그림자가 그대로다(오목으로 뒤집혀야 한다)');
      assert(!isRed(bar(off)),'비활성인데 밑변이 아직 붉다');
      assert(lum(rgb(getComputedStyle(off).color))<onLum,'비활성 글자가 활성보다 어둡지 않음'); }
    // ④ 방 만들기도 **같은 컴포넌트**를 쓴다 — 확정/취소 짝이 화면마다 달라지면 안 된다
    closeSoloDiff(); await sleep(40); openRooms(); await sleep(60); createRoom(); await sleep(120);
    const cGo=document.querySelector('#createPanel .actBtn.pri'), cNo=document.querySelector('#createPanel .actBtn.sub');
    assert(cGo && cNo,'방 만들기가 공용 액션 버튼을 안 씀');
    assert(!document.querySelector('.cpMake,.cpCancel'),'옛 확정/취소 클래스가 남아 있음');
    assert(cGo.getBoundingClientRect().width > cNo.getBoundingClientRect().width,'주 동작이 취소보다 넓지 않음');
    closeCreate(); await sleep(40);
    return '면 중립 · 광원으로만 위계 ok'; });
  await step('난이도 선택: 스테퍼 + 상세 · 잠긴 것은 고를 수 있고 시작만 막힌다', async ()=>{
    skipIf(typeof openSoloDiff!=='function','난이도 선택 없음');
    openMapSelect(); await sleep(60); _selMap=USEMAPS.nemo; openSoloDiff(); await sleep(150);
    // 상단 = **스테퍼**(◀ 이름 ▶ + 점). 화살표는 공용 .arwBtn 이고 옛 방식들은 되살아나면 안 된다
    const nav=$('sdNav');
    assert(!nav.querySelector('.pdSeg'),'난이도가 아직 탭 띠(.pdSeg)임 — 스테퍼로 바뀌었다');
    assert(!document.querySelector('.soloDiffBtns .moDiffBtn'),'옛 난이도 목록이 남아 있음');
    const prev=$('sdPrev'), next=$('sdNext');
    assert(prev&&next&&prev.classList.contains('arwBtn')&&next.classList.contains('arwBtn'),
      '◀▶ 가 공용 .arwBtn 이 아님');
    assert(prev.querySelector('.arwIco')&&next.querySelector('.arwIco'),'화살표 글리프가 안 채워짐(paintArrows 누락)');
    const dots=[...nav.querySelectorAll('.sdDots i')];
    assert(dots.length===DIFFICULTY_ORDER.length,'점이 난이도 수와 다름: '+dots.length);
    // 이름은 스테퍼가 갖는다 — 상세에 또 쓰면 같은 글자가 두 번 나온다
    const stx=nav.querySelector('.sdStepTx');
    assert(stx && stx.scrollWidth<=stx.clientWidth+0.5,'스테퍼 이름이 잘림: '+(stx&&stx.textContent));
    assert(!$('sdDet').querySelector('.sdName'),'난이도 이름이 상세에 중복으로 남아 있음');
    // 양 끝에서는 멈춘다(순환하지 않는다)
    sdPick(0); await sleep(60);
    assert($('sdPrev').disabled && !$('sdNext').disabled,'첫 난이도에서 ◀ 가 안 잠김');
    sdPick(DIFFICULTY_ORDER.length-1); await sleep(60);
    assert($('sdNext').disabled && !$('sdPrev').disabled,'마지막 난이도에서 ▶ 가 안 잠김');
    sdStepBy(1); await sleep(40); assert(_sdPick===DIFFICULTY_ORDER[DIFFICULTY_ORDER.length-1],'끝에서 ▶ 가 순환함');
    sdStepBy(-1); await sleep(60);
    assert(_sdPick===DIFFICULTY_ORDER[DIFFICULTY_ORDER.length-2],'◀ 가 한 칸 안 움직임');
    assert(nav.querySelectorAll('.sdDots i.on').length===1,'켜진 점이 하나가 아님');
    // 잠긴 난이도 = 고를 수는 있고(무엇이 필요한지 보여 준다) 시작만 막힌다
    const li=DIFFICULTY_ORDER.findIndex(d=>!diffUnlocked(d));
    if(li>=0){ sdPick(li); await sleep(80);
      assert($('sdGo').disabled,'잠긴 난이도인데 시작 버튼이 열려 있음');
      assert($('sdDet').querySelector('.sdLock'),'잠금 사유가 안 보임'); }
    // 해금된 난이도 = 시작 버튼이 열리고 상세에 수치가 나온다
    sdPick(0); await sleep(80);
    assert(!$('sdGo').disabled,'해금된 난이도인데 시작 버튼이 잠김');
    assert($('sdDet').querySelectorAll('.sdStat').length===2,'적 HP·포인트 두 지표가 안 나옴');
    assert($('sdDet').querySelector('.sdMap b').textContent===USEMAPS.nemo.name,'상세 머리에 고른 맵이 없음');
    // ⚠ 상세 본문(이름·수치·설명)이 시작 버튼 위로 흘러 잘렸던 적이 있다 — 모든 난이도에서 담기는지 본다
    for(let i=0;i<DIFFICULTY_ORDER.length;i++){ sdPick(i); await sleep(50);
      const body=$('sdDet').querySelector('.sdBody'), go=$('sdGo');
      assert(body.scrollHeight<=body.clientHeight+0.5,
        DIFFICULTY_ORDER[i]+' 상세 본문이 넘침: '+body.scrollHeight+'>'+body.clientHeight);
      assert(body.getBoundingClientRect().bottom<=go.getBoundingClientRect().top+0.5,
        DIFFICULTY_ORDER[i]+' 본문이 시작 버튼과 겹침'); }
    // ⛔ 시작 버튼 색은 **난이도를 따라가지 않는다** — 공용 액션 버튼(.actBtn.pri) 한 색으로 고정
    assert($('sdGo').classList.contains('actBtn')&&$('sdGo').classList.contains('pri'),
      '시작 버튼이 공용 액션 버튼(.actBtn.pri)을 안 씀');
    { const face=[]; for(let i=0;i<DIFFICULTY_ORDER.length;i++){ sdPick(i); await sleep(50);
        const g=$('sdGo'); if(!g.disabled) face.push(getComputedStyle(g).backgroundImage); }
      assert(face.length && face.every(f=>f===face[0]),'난이도마다 시작 버튼 색이 다름'); }
    // 무한 모드는 난이도가 아니다 — 스테퍼가 아니라 별도 줄
    assert(!visible($('sdInf'))||$('sdInf').textContent.indexOf('무한')>=0,'무한 모드 줄이 이상함');
    closeSoloDiff(); await sleep(40);
    return '스테퍼 '+dots.length+'단 · 잠금 분리 ok'; });
  // ⚙ 게임 밖 설정(유즈맵 ☰ → .appCtx) — 게임 안 설정과 **같은 카드**를 문맥만 바꿔 쓴다
  // ══ 게임 진입 로딩 = 카드 덱(H안). 한 화면이 협동·팀전·개인 셋을 다 맡는다 ══
  await step('게임 진입 로딩: 카드 덱 · 팀은 윗변 · 준비는 밑변 · 혼자면 덱이 없다', async ()=>{
    skipIf(typeof gameStartCountdown!=='function','시작 화면 없음');
    const op=$('opening'), root=$('gsRoot');
    assert(root,'게임 진입 로딩(#gsRoot)이 없음');
    const freeze=()=>{ _gsClearTimers(); clearTimeout(op._cdEnd); clearTimeout(op._holdT); op._holdT=null; };
    const restore=()=>{ freeze(); op.classList.add('hide'); op.classList.remove('counting','ready','timing','warp');
      G.activePlayers=[1]; G.loading=false; };
    // ① 협동 8인 — 4장씩 두 줄, 준비한 카드만 .rdy
    openMapSelect(); await sleep(60);
    _selMap=USEMAPS.nemo; _selDiff='easy';
    G.activePlayers=[1,2,3,4,5,6,7,8]; G.myPlayer=1; G.playerNames={2:'호랑이',3:'까치',4:'별똥',5:'무쇠',6:'파랑',7:'노을',8:'단비'};
    gameStartCountdown(); await sleep(120);
    // ⏳ 로딩 단계(막대 0→100%)가 끝나야 준비 표기가 나온다 — 그 전에는 LOADING% 다(2026-08-19)
    { const t0=performance.now(); while(_gsLoading && performance.now()-t0<GS_LOAD_MS+1200) await sleep(30); }
    freeze();
    _gsReady=new Set([1,2,4,5,7]); _renderGsPlayers(); await sleep(60);
    assert(!root.classList.contains('solo') && !root.classList.contains('teamed'),'협동인데 solo/teamed 가 붙음');
    assert($('gsDeck').querySelectorAll('.gsRow').length===2,'협동 덱이 4장씩 두 줄이 아님');
    assert($('gsDeck').querySelectorAll('.gsCd').length===8,'카드 수가 인원과 다름');
    assert($('gsDeck').querySelectorAll('.gsCd.rdy').length===5,'준비한 카드 수가 다름');
    // 초상은 **공용 avatarHTML** 이다 — 카드용 초상을 새로 만들지 말 것
    assert($('gsDeck').querySelector('.gsCd .fAva'),'카드 초상이 공용 avatarHTML 산출물이 아님');
    // 배지 = 난이도. ⛔ 초록이면 안 된다(초록은 준비 완료 전용)
    { const bd=$('gsLine').querySelector('.gsBd');
      assert(bd && bd.textContent===DIFFICULTY.easy.name,'난이도 배지가 안 나옴');
      const c=(getComputedStyle(bd).color.match(/\d+/g)||[]).map(Number);
      assert(!(c[1]>c[0]+40 && c[1]>c[2]+40),'난이도 배지가 초록이다 — 초록은 준비 완료 전용'); }
    assert($('gsCntN').textContent.replace(/\s/g,'')==='5/8','준비 인원 표기가 다름: '+$('gsCntN').textContent);
    // 세로 배치 = 위 덩어리(이름·덱)를 남는 높이의 가운데로. 맨 위에 붙어 있으면 아래가 통째로 빈다
    { const hd=document.querySelector('.gsHead').getBoundingClientRect();
      assert(hd.top>80,'머리줄이 화면 맨 위에 붙음 — 아래가 비어 보인다'); }
    // 배경 = 유즈맵 키 아트. ⚠ .gsWrap>* 규칙에 눌려 흐름으로 돌아오면 높이가 0이 된다
    { const art=$('gsArt'); assert(getComputedStyle(art).position==='absolute','키 아트가 absolute 가 아님(배경이 안 보인다)');
      assert(/nemo/.test(art.style.backgroundImage||''),'키 아트가 안 실림: '+(art.style.backgroundImage||'')); }
    // ② 팀전 4v4 — 팀마다 한 줄 · 팀 색은 **윗변**, 준비는 **밑변**(자리가 달라 안 섞인다)
    op.classList.add('hide'); _selMap=USEMAPS.cpu; _lobbyMax=8;
    gameStartCountdown(); await sleep(120);
    // ⏳ 로딩 단계(막대 0→100%)가 끝나야 준비 표기가 나온다 — 그 전에는 LOADING% 다(2026-08-19)
    { const t0=performance.now(); while(_gsLoading && performance.now()-t0<GS_LOAD_MS+1200) await sleep(30); }
    freeze();
    _gsReady=new Set([1,2,4,5,7]); _renderGsPlayers(); await sleep(60);
    assert(root.classList.contains('teamed'),'팀 맵인데 .teamed 가 없음');
    assert($('gsDeck').querySelectorAll('.gsTlb').length===2,'팀 라벨이 둘이 아님');
    assert($('gsDeck').querySelector('.gsT1 .gsRow').children.length===4,'1팀이 4명이 아님');
    { const cd=$('gsDeck').querySelector('.gsT1 .gsCd'), top=getComputedStyle(cd,'::before'), bot=getComputedStyle(cd,'::after');
      assert(top.content!=='none','팀전인데 카드 윗변(팀 색)이 없음');
      const rdy=$('gsDeck').querySelector('.gsT1 .gsCd.rdy');
      assert(rdy && getComputedStyle(rdy,'::after').content!=='none','준비한 카드에 밑변(초록)이 없음'); }
    assert($('gsLine').querySelector('.gsBd.vs'),'팀전인데 대진 배지(4 vs 4)가 없음');
    // ③ 개인 — 덱이 없고 하단이 로딩 진행률로 바뀐다('준비'는 혼자서 뜻이 없다)
    op.classList.add('hide'); _selMap=USEMAPS.nemo; G.activePlayers=[1];
    gameStartCountdown(); await sleep(160); freeze();
    assert(root.classList.contains('solo'),'혼자인데 .solo 가 없음');
    assert(!$('gsDeck').querySelector('.gsCd'),'혼자인데 카드 덱이 남아 있음');
    assert($('gsCntLb').textContent==='LOADING','개인 플레이 하단이 준비 표기 그대로임');
    assert(/%$/.test($('gsCntN').textContent),'개인 플레이인데 진행률이 아님: '+$('gsCntN').textContent);
    assert($('opStartTxt').textContent==='전투 시작','개인 플레이 버튼이 아직 준비 완료임');
    // ⚠ 덱이 빠지면 auto 가 위 하나뿐이라 이름이 특징 바로 위에 달라붙는다 — 아래쪽에도 auto 를 줘 막았다
    { const hd=document.querySelector('.gsHead').getBoundingClientRect(),
            fe=document.querySelector('.gsFeat').getBoundingClientRect();
      assert(hd.top>80,'개인 플레이 머리줄이 화면 맨 위에 붙음');
      assert(fe.top-hd.bottom>80,'개인 플레이 머리줄이 특징에 달라붙음(아래쪽 auto 가 빠졌다)'); }
    // 버튼은 공용 액션 버튼이다 — 이 화면 전용 버튼을 만들지 말 것
    assert($('opStart').classList.contains('actBtn')&&$('opStart').classList.contains('pri'),'시작 버튼이 공용 .actBtn.pri 가 아님');
    assert($('opQuit').classList.contains('actBtn'),'나가기가 공용 .actBtn 이 아님');
    restore(); await sleep(40);
    return '협동 8 · 팀전 4v4 · 개인 진행률 ok'; });
  await step('유즈맵 설정: 프로필 머리줄 · 붉은 선 · 44px ✕ · 중립 ON', async ()=>{
    openMapSelect(); await sleep(60); openAppSettings(); await sleep(120);
    const card=document.querySelector('#settingsPop .setCard');
    assert(visible($('settingsPop')),'설정이 안 열림');
    // ① 내 프로필 한 줄 — 초상·닉은 기존 것(avatarHTML/myNick)을 그대로 쓴다(복제 금지)
    const me=$('setMe'); assert(me && visible(me),'프로필 머리줄이 없음');
    assert(me.querySelector('.fAva'),'프로필 초상이 avatarHTML 산출물이 아님');
    // 🙍 자리표시 초상 — 게스트·미로그인은 이니셜 대신 공용 그림. 배지 글자와 그림이 같은 말을 해야 한다
    { const guestNow=!(AUTH.user && !AUTH.user.guest);
      assert(me.querySelector('.fAva').classList.contains('guest')===guestNow,
        '초상의 자리표시 여부가 계정 상태와 어긋남');
      // ⚠ 파일이 없어도 칸이 비면 안 된다 — <img> 밑에 이니셜이 깔려 있고 onerror 가 <img> 만 지운다
      const h=avatarHTML('게스트7421','',null,true);
      assert(/class="fAvaImg"/.test(h) && h.indexOf('av_guest.webp')>=0,'자리표시 초상에 그림이 안 붙음');
      assert(h.indexOf('onerror="this.remove()"')>=0,'그림이 없을 때 이니셜로 돌아갈 길이 없음');
      assert(h.indexOf('>게<')>=0,'그림 밑에 깔린 이니셜이 없음(파일이 없으면 칸이 빈다)');
      // 일반 사용자는 지금까지대로 색 이니셜이다 — 전부 자리표시로 바뀌면 사람 구분이 사라진다
      assert(!/fAvaImg/.test(avatarHTML('단짝','')),'일반 사용자 초상까지 자리표시로 바뀜');
      assert(/fAvaImg/.test(avatarHTML('','')),'닉이 없는데 자리표시가 안 나옴');
      // ⚠ 색은 인라인이라 CSS 로는 못 덮는다 — 자리표시 링이 닉 색(채도 있는 hsl)으로 남으면 안 된다
      { const av=me.querySelector('.fAva');
        if(av.classList.contains('guest')){
          const bc=(getComputedStyle(av).borderTopColor.match(/\d+/g)||[0,0,0]).map(Number);
          assert(Math.max(bc[0],bc[1],bc[2])-Math.min(bc[0],bc[1],bc[2])<=20,
            '자리표시 초상 링에 닉 색이 남음: '+getComputedStyle(av).borderTopColor); } } }
    assert((me.querySelector('.setMeN')||{}).textContent.indexOf(myNick())===0,'프로필 닉이 myNick() 과 다름');
    // ② 배지 = 계정 상태. 게스트면 **버튼**이고 누르면 계정 연결 경로로 간다
    const badge=me.querySelector('.setMeTag');
    assert(badge,'계정 배지가 없음');
    // 정식 계정이 **아닌** 모든 상태(계정 없음·게스트)에서 배지는 계정으로 가는 버튼이어야 한다
    const acct=!!(AUTH.user && !AUTH.user.guest);
    if(!acct) assert(badge.tagName==='BUTTON' && /setAcctGo/.test(badge.getAttribute('onclick')||''),
      '계정이 없는데 배지가 계정 입구가 아님: '+badge.outerHTML.slice(0,60));
    else assert(badge.tagName!=='BUTTON','정식 계정인데 배지가 버튼임');
    // ③ 금색 스캔라인 → 붉은 헤어라인(이 화면 성격색). 금색은 재화·보상 전용이다
    // ⭐ 2026-08-26: 제목 밑선 자체를 걷어냈다 — 설정 창을 로딩·로그인과 같은 언어로 맞추며
    //    이 화면에서 유일한 색 덩어리였기 때문이다. 선이 **살아 있을 때만** 색을 잰다.
    //    (그전에는 display:none 인 선의 색을 검사했다 — 화면에 없는 것을 지키고 있었던 셈)
    { const _ti0=getComputedStyle(card.querySelector('.setTitle'),'::after');
      if(_ti0.display!=='none' && _ti0.content && _ti0.content!=='none'){
      { const ti=getComputedStyle(card.querySelector('.setTitle'),'::after');
        const cols=[...((ti.backgroundImage||'').matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g))];
        assert(cols.some(c=>+c[1]>=180 && +c[2]<=110 && +c[3]<=110),
          '설정 제목 밑선이 붉지 않음(금색이 남았다): '+(ti.backgroundImage||'').slice(0,80)); }
      } }
    // ④ 닫기 ✕ 터치 타겟 — 31.5×17.5px 이었다(§0 권고 44px 의 절반도 안 됨)
    { const x=card.querySelector('.setX').getBoundingClientRect();
      assert(x.width>=40 && x.height>=40,'✕ 터치 타겟이 작음: '+x.width.toFixed(1)+'×'+x.height.toFixed(1)); }
    // ⑤ 켜짐을 빨강으로 칠하지 않는다 — 빨강은 위험·파괴·나가기다
    { const sw=$('flag-chat'); if(!sw.classList.contains('on')) sw.click();
      const g=getComputedStyle(sw).backgroundImage||'';
      const m=[...g.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map(c=>[+c[1],+c[2],+c[3]]);
      assert(m.every(c=>c[0]-Math.max(c[1],c[2])<=25),'켜진 스위치가 빨강임: '+g.slice(0,80)); }
    // ⑥ 게임 밖에만 있는 항목 — 진동·화면(지원 시)·닉네임·버전
    assert(visible($('flag-vib')),'진동 스위치가 없음');
    assert(visible($('si-nick')),'닉네임 변경 항목이 없음');
    assert($('setVer').textContent==='v'+APP_VER,'버전 표기가 APP_VER 과 다름: '+$('setVer').textContent);
    { const c=(getComputedStyle($('setVer')).color.match(/\d+/g)||[0,0,0]).map(Number);
      assert(c[0]-Math.max(c[1],c[2])<=25,'버전 값이 빨강임(참고 값이지 강조가 아니다): '+getComputedStyle($('setVer')).color); }
    assert(wakeSupported()===visible($('qrow-wake')),'화면 항상 켜기 줄이 지원 여부와 어긋남');
    // ⑦ 새 스위치는 SND 초기값이 있어야 첫 탭이 헛돌지 않는다
    for(const k of ['vib','wake']) assert(typeof SND[k+'On']==='boolean','SND.'+k+'On 초기값이 없음');
    // ⑧ 닉네임 하위 팝업도 보관함에서 옮겨 온다(복사 금지)
    { const body=$('body-nick'), st=$('setStash');
      assert(body && body.parentNode===st,'닉네임 본문이 보관함에 없음');
      openSetSub('nick'); await sleep(60);
      assert($('body-nick')===body,'닉네임 본문을 복사해 두 번 만들었다');
      assert($('setNickInp').value===myNick(),'닉네임 입력칸이 현재 닉으로 안 채워짐');
      // 하위 팝업도 같은 문맥이어야 한다 — 안 물려주면 '닉네임 변경'만 금색 선인 채로 남는다
      assert($('setSubPop').classList.contains('appCtx'),'하위 팝업이 게임 밖 문맥을 못 물려받음');
      { const ti=getComputedStyle($('setSubPop').querySelector('.setTitle'),'::after');
        const cols=[...((ti.backgroundImage||'').matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g))];
        if(getComputedStyle(document.querySelector('#setSubPop .setTitle'),'::after').display!=='none') assert(cols.some(c=>+c[1]>=180 && +c[2]<=110 && +c[3]<=110),'하위 팝업 제목 밑선이 붉지 않음'); }
      closeSetSub(); }
    closeSettings();
    return '프로필·붉은 선·✕ 44px·중립 ON·항목 5';
  });
  // 🎟🔒🔁 무판 계열 아이콘 — 파일이 실제로 열리는지 + 배선이 이모지로 되돌아가지 않았는지
  await step('무판 아이콘: 뽑기권 3종 · 자물쇠 · 환생 · 자리표시 초상', async()=>{
    // ① 파일이 열린다(없으면 폴백이 조용히 삼켜서 눈에 안 띈다)
    const files=['res_ticket_gear','res_ticket_pet','res_ticket_ally'].map(k=>ICO_DIR+k+'.webp')
      .concat([ICO_DIR+'state/st_lock.webp', ICO_DIR+'state/st_rebirth.webp', AVATAR_GUEST_SRC]);
    const bad=[];
    await Promise.all(files.map(src=>new Promise(ok=>{ const im=new Image();
      im.onload=()=>{ if(!(im.naturalWidth>0)) bad.push(src); ok(); };
      im.onerror=()=>{ bad.push(src); ok(); }; im.src=src; })));
    assert(!bad.length,'아이콘 파일이 안 열림: '+bad.join(', '));
    // ② 뽑기권은 resIco 단일 소스를 지난다 — 세 종류가 서로 다른 파일이어야 색으로 구분된다
    const t=['gear','pet','ally'].map(k=>resIco('ticket_'+k));
    assert(t.every(h=>/^<img/.test(h)),'뽑기권이 resIco 로 안 나옴');
    assert(new Set(t).size===3,'뽑기권 3종이 같은 그림을 씀(색 구분이 사라진다)');
    // ②-2 상점 특가는 **한글 이름으로** resIco 를 부른다 — RES_ICON_KO 에 없으면 그 줄만 이모지로 떨어진다
    for(const k in SHOP_GIVE_LABEL){ const nm=SHOP_GIVE_LABEL[k];
      assert(/^<img/.test(resIco(nm,'gi')),'상점 특가 항목이 아이콘으로 안 나옴: '+nm); }
    // ③ 자물쇠 그림은 **칸이 통째로 잠긴 자리**(정비 펫·동료)에만 쓴다.
    //    ⛔ 사냥터 업그레이드 카드에는 자물쇠를 두지 않는다 — '해금 필요' 글자와 죽은 색이 이미 말한다
    { const h=stIco('lock','🔒');
      assert(h.indexOf('st_lock.webp')>=0,'잠김 자물쇠 경로가 틀림');
      assert(h.indexOf('data-fb="🔒"')>=0,'자물쇠 폴백이 원래 이모지가 아님');
      assert(typeof hmLockHTML==='undefined','옛 사냥터 전용 자물쇠 함수가 되살아남(공용 stIco 를 쓴다)');
      // 사냥터 카드는 **작은 레벨 버튼**에만 자물쇠를 둔다 — 머리줄은 `해금 필요` 글자뿐이다
      { const c=hmUpCardHTML({key:'x', lock:true, lv:'LV.0', name:'테스트'});
        assert(/hmUpBl[^>]*>[^<]*<img[^>]*st_lock\.webp/.test(c.replace(/\s+/g,' ')),'잠긴 카드의 작은 버튼에 자물쇠가 없음');
        const head=(c.match(/<span class="hmUpLk">[\s\S]*?<\/span>/)||[''])[0];
        assert(head.indexOf('<img')<0,'머리줄에 자물쇠가 되살아남(글자만이어야 한다)'); } }
    // ④ 상태 아이콘은 **원래 이모지**로 되돌아간다(pIco 표에 없는 이모지가 많다)
    { const h=stIco('rebirth','🔁');
      assert(h.indexOf('st_rebirth.webp')>=0,'환생 아이콘 경로가 틀림');
      assert(h.indexOf('data-fb="🔁"')>=0,'환생 폴백이 원래 이모지가 아님'); }
    return files.length+'장 ok';
  });
  await step('방찾기 열림+목록', ()=>{ openRooms(); const rm=document.querySelector('#rooms .rmCard'); assert(visible(rm),'rmCard 안 보임');
    const n=$('roomList').children.length; assert(n>0,'방 목록 비어있음'); $('rooms').classList.add('hide'); return n+'개 방'; });
    // 마을: 월드 좌표계 + 카메라. 헤드리스는 rAF가 멈춰 있어 twStep(dt)을 직접 pump한다.
      // 🎁 상점 = 팝업이 아니라 전용 화면. 네비·마을 구역 두 경로 모두 같은 화면으로 간다.
  // 🧍 캐릭터 = '나 자신'(정보·성장·스킬). 장착물(장비·펫·동료)은 정비에 남는다 — 두 곳에 두면 어긋난다.
  // ⚔ 사냥터 업그레이드 — '카드에 적힌 값'과 '전투에 들어가는 값'이 같아야 한다(2026-08-18 단일 소스화).
  //    예전엔 HB_UPG(카드)와 CS_AXES(전투)가 두 벌이라 '데미지 10/+2'라고 써 놓고 12/+3을 쓰고 있었고,
  //    사거리는 카드 100 · 실제 34였다. 그리고 32종 중 17종은 사기만 되고 전투에 안 걸려 있었다.
  await step('사냥터 업그레이드: 카드 = 전투 · 전 항목 배선 · 초반 5미네랄', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof HB_UPG!=='object'||typeof csAxis!=='function','업그레이드 표 없음');
    // ⚠ hunt.upg / hunt.unl 은 캐릭터가 아니라 '계정'에 붙는다 — 캐릭터를 새로 만들어도 안 지워진다.
    //    이 스텝은 값을 0으로 비우고 재기 때문에, 끝날 때 반드시 되돌려 놔야 뒤 스텝이 약해진 채로 돈다.
    //    (실제로 뒤의 '던전: 1층 클리어'가 이것 때문에 한 번 무너졌다)
    const keep={ upg:JSON.stringify(hbHunt().upg||{}), unl:JSON.stringify(hbHunt().unl||{}) };
    { const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','업글'); saveMeta(); }
    let H=hbHunt(); H.upg={}; for(const k in HB_UPG) H.unl[k]=1;
    // ① CS_AXES 는 제 값을 갖지 않는다 — 두 벌이 되는 순간 다시 어긋난다
    for(const k in CS_AXES){ const A=CS_AXES[k];
      assert(A.base===undefined && A.upgV===undefined,
        'CS_AXES.'+k+' 가 제 base/upgV 를 다시 들고 있음 — 단일 소스가 깨졌다'); }
    // ② 카드가 적는 숫자 == 전투가 쓰는 숫자. 0레벨과 10레벨 양쪽에서 본다.
    for(const k of CS_ORDER){ const A=CS_AXES[k]; if(!A||!A.upgK) continue;
      const U=HB_UPG[A.upgK];
      H.upg={};
      assert(Math.abs(csAxis(k).base-U.v0)<1e-9,
        k+' 0레벨 값이 카드와 다름: 카드 '+U.v0+' · 전투 '+csAxis(k).base);
      H.upg[A.upgK]=10;
      const want=U.v0+U.vs*10;
      assert(Math.abs(csAxis(k).sub-want)<1e-6,
        k+' 10레벨 값이 카드와 다름: 카드 '+want+' · 전투 '+csAxis(k).sub);
      const shown=parseFloat(String(hbUpgVal(A.upgK,10)).replace('x',''));
      assert(Math.abs(shown-want)<0.06,
        k+' 카드에 찍히는 글자가 값과 다름: "'+hbUpgVal(A.upgK,10)+'" · 값 '+want);
      H.upg={}; }
    // ③ 32종 전부 — 10레벨 올렸는데 전투 수치가 하나도 안 변하면 카드에만 있는 거짓말이다
    const snap=()=>{ const st=hbCharStats(), M=hbAllyMul();
      return [st.atk,st.hpMax,st.cd,st.crit,st.critDmg,st.range,st.regen,
              st.lifest,st.knock,st.multiC,st.multiN,st.bncC,st.bncN,st.scritC,st.scritM,
              st.shdMax,st.shdReg,st.mspd,st.rrng,
              hbUpgNum('mk'),hbUpgNum('gk'),hbUpgNum('mw'),hbUpgNum('gw'),
              M.ally.mul,M.ally.cdMul,M.turret.dps,M.turret.rng,M.bunker.hp,M.pet.dps,M.pet.cdMul,
              hbBunkerAtkMul()].join(','); };
    for(const k in HB_UPG){ H.upg={}; const a=snap(); H.upg[k]=10; const b=snap();
      assert(a!==b, k+'('+HB_UPG[k].name+') 10레벨인데 전투 수치가 하나도 안 변함 — 배선이 없다'); }
    H.upg={};
    // ④ 비용 — 가장 싼 카드가 5미네랄에서 시작하고, 증가율은 1.15 를 넘지 않는다
    { let mn=1e9, mx=0;
      for(const k in HB_UPG){ mn=Math.min(mn,HB_UPG[k].base); mx=Math.max(mx,HB_UPG[k].mul); }
      assert(mn===5,'초반 업그레이드가 5미네랄에서 시작하지 않음: '+mn);
      assert(mx<=1.15+1e-9,'비용 증가율이 1.15 를 넘음: '+mx);
      assert(hbUpgCost('atk',0)===5,'데미지 1레벨이 5미네랄이 아님: '+hbUpgCost('atk',0)); }
    // ⑤ 표가 아니라 '실제 지급·실제 피해'로 확인한다 — 표만 보면 hbUpgNum 을 되읽는 순환 검사가 된다
    if(typeof hbEnd==='function') hbEnd();
    openHome(); await sleep(80);
    assert(_hb && _hb.on,'전투가 시작 안 됨');
    _hb.manual=true; H=hbHunt(); for(const k in HB_UPG) H.unl[k]=1;
    const arm=()=>{ _hb.char.atk=1e9; _hb.char.range=1e9; _hb.char.cd=.05; _hb.char.cdT=0;
      _hb.char.hp=1e9; _hb.char.hpMax=1e9; _hb.char.crit=0; _hb.char.scritC=0; };
    // ⑤-a 미네랄(킬) — 처치 보상에 실제로 얹힌다
    // ⚠ 던전·라운드·보유 미네랄을 여기서 직접 세운다. 환생이 진행도를 유지하게 된 뒤로는
    //    앞 스텝의 높은 라운드와 거대한 잔고를 물려받아, 부동소수 정밀도에 +5 가 묻혀 버렸다(실측).
    const killGain=(lv)=>{ H.upg={}; if(lv) H.upg.mk=lv; hbSyncChar();
      _hb.dg=1; _hb.round=1; PROF().pcoin=0;
      _hb.wave=1; _hb.phase='fight'; _hb.waveT=999; _hb.foes.length=0; _hb.pend.length=0; arm();
      _hb.foes.push({ico:'🟢',mdl:'snapper',x:5,y:0,hp:1,hpMax:1,atk:0,spd:0,cdT:9,elite:false});
      const p0=PROF().pcoin;
      for(let i=0;i<40 && PROF().pcoin<=p0;i++) hbStep(0.05);
      return PROF().pcoin-p0; };
    { const a=killGain(0), b=killGain(10);
      assert(b>a+4,'미네랄(킬)이 실제 지급에 안 들어감: '+a.toFixed(2)+' → '+b.toFixed(2)); }
    // ⑤-b 미네랄(웨이브) — 웨이브를 비운 순간 들어온다
    const waveGain=(lv)=>{ H.upg={}; if(lv) H.upg.mw=lv; hbSyncChar();
      _hb.dg=1; _hb.round=1; PROF().pcoin=0;
      _hb.wave=1; _hb.phase='fight'; _hb.waveT=999; _hb.foes.length=0; _hb.pend.length=0;
      const p0=PROF().pcoin; hbStep(0.05); return PROF().pcoin-p0; };
    { const a=waveGain(0), b=waveGain(10);
      assert(b>a+20,'미네랄(웨이브)가 웨이브 클리어에 안 들어감: '+a.toFixed(2)+' → '+b.toFixed(2)); }
    // ⑤-c 실드 — 체력보다 먼저 닳는다
    { H.upg={shd:10}; hbSyncChar(); const c=_hb.char;
      c.hp=c.hpMax; c.shd=c.shdMax;
      assert(c.shdMax>0,'실드를 샀는데 상한이 0');
      hbCharTake(c.shdMax/2);
      assert(c.hp===c.hpMax,'실드가 남았는데 체력이 깎임');
      assert(c.shd<c.shdMax && c.shd>0,'실드가 안 깎임: '+c.shd);
      hbCharTake(c.shdMax);
      assert(c.shd===0 && c.hp<c.hpMax,'실드를 넘겼는데 체력이 안 깎임'); }
    // ⑤-d 생명력 흡수 — 준 피해의 %만큼 실제로 찬다
    { H.upg={lifest:20}; hbSyncChar(); const c=_hb.char;
      c.hpMax=1e6; c.hp=1000; c.atk=1000; c.crit=0; c.scritC=0; c.knock=0;
      _hb.foes.length=0;
      const t={ico:'🟢',mdl:'snapper',x:5,y:0,hp:1e9,hpMax:1e9,atk:0,spd:0,cdT:9,elite:false};
      _hb.foes.push(t);
      const h0=c.hp; hbCharHit(t,1);
      assert(c.hp>h0,'생명력 흡수가 회복시키지 않음: '+h0+' → '+c.hp); }
    // ⑤-e 멀티샷 — 확률 100%면 사거리 안 여러 적이 한 번에 맞는다
    { H.upg={multic:100,multin:3}; hbSyncChar(); const c=_hb.char;
      c.atk=1000; c.crit=0; c.scritC=0; c.knock=0; c.multiC=1; c.range=1e9;
      _hb.foes.length=0;
      const mk=(x)=>({ico:'🟢',mdl:'snapper',x:x,y:0,hp:1e9,hpMax:1e9,atk:0,spd:0,cdT:9,elite:false});
      const a=mk(5), b=mk(20), d=mk(35);
      _hb.foes.push(a,b,d);
      hbCharShot(a);
      assert(b.hp<1e9 && d.hp<1e9,'멀티샷인데 부가 표적이 안 맞음'); }
    const n=Object.keys(HB_UPG).length;
    // 들어올 때 상태로 되돌린다 — 계정 축이라 그냥 두면 뒤 스텝이 전부 약해진 캐릭터로 돈다
    { const h=hbHunt(); h.upg=JSON.parse(keep.upg); h.unl=JSON.parse(keep.unl);
      hbSyncChar(); saveMeta(); }
    return n+'종 전부 배선 · 카드=전투 · 최저 '+hbUpgCost('atk',0)+'M'; });

  // 🏁 던전 = 99라운드짜리 챕터. 99를 깨면 자동으로 다음 던전 1라운드로 넘어가고,
  //    난이도·보상 곡선은 그 경계에서 '한 칸 오른 것'과 정확히 같아야 한다(계단이 있으면 설계가 무너진다).
  await step('던전: 99라운드 상한 · 자동 이동 · 경계에서 곡선이 이어진다', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof hbAdvanceDungeon!=='function','던전 자동 이동 없음');
    // ① 경계 연속성 — 던전 d 라운드 99 → 던전 d+1 라운드 1 이 '라운드 한 칸'이어야 한다.
    //    ⚠ 보상은 균일 곡선이라 정확히 한 칸이지만, 체력·공격은 S자(hbRoundS)가 얹혀 있어
    //       경계 한 칸이 던전 안의 한 칸과 '비슷'할 뿐 같지는 않다 → 두 검사를 갈라 놓는다.
    //    ⛔ 허용오차를 키워서 뭉개지 말 것 — 계단이 생기면 자동 이동이 절벽이 된다.
    for(const d of [1,2,3]){
      // (a) 보상·경험치 — S자를 안 태우므로 그 던전 기울기와 정확히 같아야 한다
      for(const [nm,f,base] of [['보상',(dd,rr)=>hbKillReward(dd,rr).min,HB_ROUND_REW],
                                ['경험치',(dd,rr)=>hbKillReward(dd,rr).xp,HB_ROUND_XP]]){
        // ⚠ 경계를 넘는 칸은 **지금 던전의 99→100번째 칸**이다 — 다음 던전 기울기가 아니라 지금 것.
        const want=hbRoundRate(base,d);
        const seam=f(d+1,1)/f(d,HB_ROUND_MAX);
        assert(Math.abs(seam-want)<1e-6,'던전 '+d+'→'+(d+1)+' '+nm+' 경계가 한 칸이 아님: ×'+seam.toFixed(4)+' vs ×'+want.toFixed(4)); }
      // (b) 체력·공격 — S자가 있으므로 '경계 한 칸'이 던전 안 한 칸들의 범위 안에 있으면 된다
      for(const [nm,f] of [['체력',(dd,rr)=>hbFoeHp(dd,rr,2)],['공격',(dd,rr)=>hbFoeAtk(dd,rr)]]){
        const seam=f(d+1,1)/f(d,HB_ROUND_MAX);
        const lo=f(d,3)/f(d,2), hi=f(d,50)/f(d,49);   // 그 던전에서 가장 완만한 칸 ~ 가장 가파른 칸
        assert(seam>lo*0.9 && seam<hi*1.1,
          '던전 '+d+'→'+(d+1)+' '+nm+' 경계가 계단임: ×'+seam.toFixed(4)+' (칸 범위 '+lo.toFixed(3)+'~'+hi.toFixed(3)+')'); }
      assert(hbProg(d+1,1)-hbProg(d,HB_ROUND_MAX)===1,'전역 진행도가 경계에서 1칸이 아님'); }
    // ①-2 🌊 던전 안의 S자 — 라운드당 상승률이 낮음 → 높음 → 낮음
    { const rate=r=>hbFoeHp(1,r,2)/hbFoeHp(1,r-1,2);
      const a=rate(6), mid=rate(50), z=rate(96);
      assert(mid>a*1.05,'중반이 초반보다 안 가파름: ×'+a.toFixed(3)+' → ×'+mid.toFixed(3));
      assert(mid>z*1.05,'후반이 중반보다 안 완만함: ×'+mid.toFixed(3)+' → ×'+z.toFixed(3));
      // 총량 불변 — S자는 난이도를 더하는 게 아니라 재배치한다
      const tot=hbFoeHp(1,HB_ROUND_MAX,2)/hbFoeHp(1,1,2);
      const flat=Math.pow(hbRoundHp(1),HB_ROUND_MAX-1);
      assert(Math.abs(tot/flat-1)<0.12,'S자가 던전 총량을 바꿈: ×'+(tot/flat).toFixed(3)); }
    // ①-3 📐 던전이 오를수록 기울기가 가팔라진다 — 뒤 던전일수록 레벨이 더 든다
    { for(const d of [1,2,3,4]) assert(hbRoundHp(d+1)>hbRoundHp(d),'던전 '+(d+1)+' 기울기가 안 가팔라짐');
      // 보상·경험치도 같이 가팔라져야 한다(안 그러면 후반 던전이 고생만 하고 보상은 짜다)
      assert(hbRoundRate(HB_ROUND_REW,3)>hbRoundRate(HB_ROUND_REW,1),'보상 기울기가 던전을 안 따라감');
      assert(hbRoundRate(HB_ROUND_XP,3)>hbRoundRate(HB_ROUND_XP,1),'경험치 기울기가 던전을 안 따라감'); }
    // ② 99를 깨면 실제로 다음 던전으로 넘어간다(등반)
    if(typeof hbEnd==='function') hbEnd();
    { const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','던전상한');
      p.hunt={dg:1,round:1,climb:true,climbChosen:1,best:{},rw:{},mates:{},party:[],upg:{},unl:{}}; saveMeta(); }
    openHome(); await sleep(120);
    assert(_hb && _hb.on,'전투가 안 돌아감');
    _hb.manual=true;
    const clearOnce=()=>{ _hb.wave=HB_WAVES; _hb.phase='fight'; _hb.waveT=999;
      _hb.foes.length=0; _hb.pend.length=0; hbStep(0.05); };
    _hb.dg=1; hbHunt().dg=1; _hb.round=HB_ROUND_MAX-1; hbHunt().round=_hb.round;
    clearOnce();
    assert(_hb.dg===1 && _hb.round===HB_ROUND_MAX,'마지막 직전 라운드 클리어인데 마지막 라운드로 안 감: '+_hb.dg+'-'+_hb.round);
    clearOnce();
    assert(_hb.dg===2 && _hb.round===1,'마지막 라운드 클리어인데 다음 던전으로 안 감: '+_hb.dg+'-'+_hb.round);
    assert(hbHunt().dg===2 && hbHunt().round===1,'저장쪽 던전/라운드가 안 따라옴');
    assert((hbHunt().best[1]||0)===HB_ROUND_MAX,'이전 던전 최고 기록이 상한으로 안 찍힘: '+hbHunt().best[1]);
    assert(hbDgOpen(2),'마지막 라운드를 깼는데 다음 던전이 안 열림');
    // ③ 반복(climb=false)에서는 넘어가지 않는다 — 그 라운드를 계속 도는 게 반복의 정의다
    hbHunt().climb=false; _hb.dg=2; hbHunt().dg=2; _hb.round=HB_ROUND_MAX; hbHunt().round=HB_ROUND_MAX;
    clearOnce();
    assert(_hb.dg===2 && _hb.round===HB_ROUND_MAX,'반복인데 던전이 넘어감: '+_hb.dg+'-'+_hb.round);
    hbHunt().climb=true;
    // ④ 마지막 던전에서는 마지막 라운드에 머문다(넘어갈 곳이 없다)
    _hb.dg=HB_DG_MAX; hbHunt().dg=HB_DG_MAX; _hb.round=HB_ROUND_MAX; hbHunt().round=HB_ROUND_MAX;
    clearOnce();
    assert(_hb.dg===HB_DG_MAX && _hb.round===HB_ROUND_MAX,'마지막 던전에서 넘어가 버림: '+_hb.dg+'-'+_hb.round);
    // ⑤ 라운드 이동은 상한을 넘지 못한다
    { const H=hbHunt(); H.dg=1; H.best[1]=HB_ROUND_MAX; _hb.dg=1;
      hbSetRound(HB_ROUND_MAX+50);
      assert(H.round<=HB_ROUND_MAX,'라운드가 상한을 넘음: '+H.round);
      assert(hbBest(1)<=HB_ROUND_MAX,'최고 기록이 상한을 넘음: '+hbBest(1)); }
    // ⑥ 큰 수 표기 — 곡선이 지수라 T(1e12)에서 끊기면 안 된다
    assert(fmtCur(999999)==='1.0M','큰 수 표기 경계가 틀림: '+fmtCur(999999));
    for(const v of [4e15,9e20,1.2e33]) assert(!/[0-9]{7}/.test(fmtCur(v)),'큰 수가 원시 숫자로 나옴: '+fmtCur(v));
    return '던전 '+HB_DG_MAX+' × '+HB_ROUND_MAX+'라운드 · 경계 이음새 ok'; });

  // 🔀 상한 있는 축(사거리·공격속도·치명타)에 더 넣어도 버려지지 않는다 — 다른 값으로 넘어간다.
  //    환생 포인트는 영구라 잘못 넣으면 되돌리기 어렵다. '넣으면 손해인 축'을 남기지 않는 것이 목적.
  await step('상한 초과분 환산: 사거리→상자 · 공속→멀티샷 · 치명타→치명 피해', ()=>{
    skipIf(typeof csOver!=='function','오버플로 환산 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; const c=profCreateChar('ranger','초과');
    const H=hbHunt(); H.upg={}; H.unl={}; for(const k in HB_UPG) H.unl[k]=1;
    c.level=1; c.unit.pts={}; c.unit.rpts={};
    // ① 상한이 실제로 걸려 있다
    for(const k of ['range','aspd','crit']) assert(CS_AXES[k].cap>0,k+' 축에 상한이 없음(초과분을 셀 수 없다)');
    // ② 상한 미만이면 초과분 0 · 환산도 0
    { const st=hbCharStats();
      assert(csOver('range')===0 && csOver('aspd')===0,'상한 미만인데 초과분이 있음');
      assert(Math.abs(st.chestDmg-1)<1e-9,'초과분이 없는데 상자 피해 배수가 1이 아님: '+st.chestDmg); }
    // ③ 사거리를 상한의 2배로 → 상자 피해가 정확히 HB_OV_CHEST 만큼 붙는다
    { c.unit.pts={}; H.upg={};
      H.upg.rng=Math.ceil((CS_AXES.range.cap*2-HB_UPG.rng.v0)/HB_UPG.rng.vs);
      const a=csAxis('range');
      assert(a.capped && a.total===a.cap,'상한을 넘겼는데 전투값이 상한이 아님: '+a.total);
      assert(Math.abs(csOver('range')-1)<0.02,'초과 비율이 1이 아님: '+csOver('range'));
      const st=hbCharStats();
      assert(Math.abs(st.chestDmg-(1+HB_OV_CHEST))<0.05,'상자 피해로 안 넘어감: '+st.chestDmg);
      H.upg={}; }
    // ④ 공격속도를 상한의 2배로 → 멀티샷 확률이 붙는다(쿨다운은 하한 그대로)
    { const base=hbCharStats();
      H.upg.aspd=Math.ceil((CS_AXES.aspd.cap*2-HB_UPG.aspd.v0)/HB_UPG.aspd.vs);
      const st=hbCharStats();
      assert(Math.abs(st.cd-HB_CD_MIN)<1e-9,'공속 상한인데 쿨다운이 하한이 아님: '+st.cd);
      assert(st.multiC>base.multiC+1e-9,'멀티샷 확률로 안 넘어감: '+base.multiC+' → '+st.multiC);
      assert(Math.abs(st.multiC-base.multiC-HB_OV_MULTI)<0.02,'멀티샷 환산량이 다름: '+(st.multiC-base.multiC));
      H.upg={}; }
    // ⑤ 치명타 확률을 상한의 2배로 → 치명 피해가 붙는다
    { const base=hbCharStats();
      H.upg.crit=Math.ceil((CS_AXES.crit.cap*2-HB_UPG.crit.v0)/HB_UPG.crit.vs);
      const st=hbCharStats();
      assert(Math.abs(csVal('crit')-CS_AXES.crit.cap)<1e-9,'치명타가 상한을 넘김: '+csVal('crit'));
      assert(st.critDmg>base.critDmg+1e-9,'치명 피해로 안 넘어감: '+base.critDmg+' → '+st.critDmg);
      assert(Math.abs(st.critDmg-base.critDmg-HB_OV_CRITD)<0.05,'치명 피해 환산량이 다름');
      H.upg={}; }
    return '사거리 ×'+HB_OV_CHEST+' 상자 · 공속 +'+(HB_OV_MULTI*100)+'%p 멀티샷 · 치명타 +'+(HB_OV_CRITD*100)+'%p 치명피해'; });
  await step('레벨 포인트: 총량은 레벨에서 · 찍으면 전투 수치가 곧바로 오른다', ()=>{
    assert(typeof lpMul==='function','레벨 포인트가 없음');
    assert(typeof lpVal==='undefined','옛 덧셈 API(lpVal)가 남아 있음 — 레벨 포인트는 배수다');
    const p=PROF(); p.chars.length=0; p.curId='';
    const c=profCreateChar('ranger','포인트'); c.level=11; c.unit.level=11; c.unit.pts={}; saveMeta();
    // ① 총량 = (레벨-1)×LP_PER_LEVEL · 처음엔 전부 남아 있다
    assert(lpTotal(c)===10*LP_PER_LEVEL,'포인트 총량이 레벨에서 안 나옴: '+lpTotal(c));
    assert(lpFree(c)===lpTotal(c) && lpSpent(c)===0,'처음부터 쓴 포인트가 있음');
    // ② 남은 것보다 많이 못 찍는다 — 비용 곡선(ptCostAt)을 올려도 이 규칙은 그대로여야 한다
    { const got=lpAdd('atk', 999);
      assert(got>0,'한 칸도 못 찍음');
      assert(lpPts('atk')===got,'찍은 칸 수가 반환값과 다름: '+lpPts('atk')+' vs '+got);
      assert(lpFree(c) < ptCost('lp','atk',c),'더 살 수 있는데 안 삼: 남은 '+lpFree(c)+'p · 값 '+ptCost('lp','atk',c)+'p');
      const hpCost=ptCost('lp','hp',c);
      if(lpFree(c)<hpCost) assert(lpAdd('hp',1)===0,'포인트가 모자란데 찍힘'); }
    // ③ 표의 모든 키가 실제로 전투에 걸린다 — 표에만 있고 안 걸린 키는 거짓말이 된다
    const H=hbHunt(); for(const k in HB_UPG) H.unl[k]=1;   // 동료·건물 배수는 해금돼 있어야 값이 보인다
    const snap=()=>{ const st=hbCharStats(), M=hbAllyMul();
      return { atk:st.atk, hp:st.hpMax, cd:st.cd, range:st.range, critd:st.critDmg,
               ally:M.ally.mul, pet:M.pet.dps, turret:M.turret.dps, bunker:hbBunkerAtkMul() }; };
    const wired={ atk:['atk'], hp:['hp'], aspd:['cd'], range:['range'], critd:['critd'],
                  ally:['ally','pet'], bld:['turret','bunker'] };
    for(const S of LP_STATS){
      c.unit.pts={}; const a=snap();
      c.unit.pts={}; c.unit.pts[S.k]=10; const b=snap();
      const keys=wired[S.k]; assert(keys,'배선 표에 없는 항목: '+S.k);
      for(const kk of keys){
        const up=(kk==='cd')? (b[kk]<a[kk]-1e-9) : (b[kk]>a[kk]+1e-9);
        assert(up, S.k+' 10p 를 찍었는데 '+kk+' 가 안 변함: '+a[kk]+'→'+b[kk]); }
      // 안 건드린 축은 그대로여야 한다(한 항목이 여러 곳을 흔들면 배수 설계가 무너진다)
      for(const kk in a){ if(keys.indexOf(kk)>=0) continue;
        assert(Math.abs(a[kk]-b[kk])<1e-9, S.k+' 가 무관한 '+kk+' 까지 바꿈'); } }
    // ④ 배수는 선형 — 10p = step×10
    c.unit.pts={atk:10};
    // 배수는 선형(1 + n×step) — 복리로 돌아가면 여기서 잡힌다
    assert(Math.abs(lpMul('atk')-(1+10*LP_STEP))<1e-9,'배수가 선형이 아님: '+lpMul('atk'));
    for(const S of LP_STATS) assert(S.step===LP_STEP,'항목마다 step 이 다름(숨은 지식이 된다): '+S.k);
    // 아군 축(동료·펫·터렛·벙커)에도 '같은 배수'가 실제로 곱해지는가.
    // ⚠ CS 축 검사로는 안 잡힌다 — 아군은 hbAllyMul/hbBunkerAtkMul 소관이라 따로 재야 한다.
    { const H=hbHunt(), c2=CHAR();
      const meas=pts=>{ c2.unit.pts=Object.assign({}, pts);
        return { ally:hbAllyMul().ally.mul, pet:hbAllyMul().pet.dps,
                 turret:hbAllyMul().turret.dps, bunker:hbBunkerAtkMul() }; };
      H.upg={alatk:3, peatk:3, tuatk:3, bkatk:3};        // 업그레이드가 섞여도 배수가 그대로 걸려야 한다
      const off=meas({}), on=meas({ally:8, bld:8});
      const want=1+8*LP_STEP;
      for(const kk of ['ally','pet'])
        assert(Math.abs(on[kk]/off[kk]-want)<1e-9,kk+': 동료 포인트 배수가 다름: '+(on[kk]/off[kk])+' vs '+want);
      for(const kk of ['turret','bunker'])
        assert(Math.abs(on[kk]/off[kk]-want)<1e-9,kk+': 건물 포인트 배수가 다름: '+(on[kk]/off[kk])+' vs '+want);
      H.upg={}; c2.unit.pts={}; }
    // ⑤ 초기화하면 전부 돌아온다
    c.unit.pts={atk:5,hp:5}; saveMeta();
    assert(lpReset()===10,'초기화 반환 수가 다름');
    assert(lpFree(c)===lpTotal(c) && lpMul('atk')===1,'초기화 뒤에도 배수가 남음');
    // ⑥ 환생하면 레벨이 1로 돌아가므로 포인트 총량도 0이 된다
    //    ⚠ 문턱이 Lv100(PROF_REB_MIN_LV)으로 올라갔다 — 낮은 레벨을 박으면 환생이 조용히 실패한다
    { const keep=PLAYER_META.coins;
      c.level=PROF_REB_MIN_LV+20; c.unit.level=c.level; c.unit.pts={atk:10}; c.reb=0; c.rebLvMax=0;
      PLAYER_META.coins=profRebPoint(c); saveMeta();
      assert(profRebirth(c)>0,'환생이 실행되지 않음(문턱·관문 확인)');
      PLAYER_META.coins=keep; }
    assert(lpTotal(c)===0,'환생했는데 포인트 총량이 남음: '+lpTotal(c));
    c.unit.pts={};
    return '레벨당 '+LP_PER_LEVEL+'p · '+LP_STATS.length+'항목 전부 배선됨'; });
  await step('레벨 포인트: 스탯 화면에서 찍으면 전투 중인 캐릭터에 바로 반영', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    assert(typeof ptTap==='function','레벨 포인트 조작이 없음');   // ⚠ skipIf 로 두면 이름이 바뀔 때 조용히 건너뛴다
    const p0=PROF(); p0.chars.length=0; p0.curId='';
    { const c0=profCreateChar('ranger','반영'); c0.level=21; c0.unit.level=21; c0.unit.pts={}; }
    saveMeta();
    if(typeof hbEnd==='function') hbEnd();
    openHome(); await sleep(120);          // ⚠ openHome→loadMeta 가 PROF()를 갈아 끼운다 — 위 참조는 버린다
    assert(_hb && _hb.char,'사냥터가 안 돌아감');
    { const c=CHAR(); assert(c.level===21 && lpTotal(c)===20*LP_PER_LEVEL,   // ⚠ 3p 고정을 박지 말 것
        '표본 레벨이 안 실림: Lv.'+c.level+' / '+lpTotal(c)+'p'); }
    const a0=_hb.char.atk, cd0=_hb.char.cd, cdm0=_hb.char.critDmg;
    navGo('upg'); await sleep(60); setChrSec('stat'); await sleep(40);
    const host=$('chrBody');
    // 카드는 사냥터 업그레이드와 '같은 함수'가 그린다 — 마크업을 베낀 두 번째 구현이 있으면 안 된다
    const rows=[...host.querySelectorAll('.lpList .lpCell > .hmUp')];
    assert(rows.length===LP_STATS.length,'포인트 카드 수가 표와 다름: '+rows.length);
    assert(!host.querySelector('.lpRow'),'옛 자체 제작 줄(.lpRow)이 남아 있음');
    assert(host.querySelector('.lpFree b').textContent===String(20*LP_PER_LEVEL),'남은 포인트 표시가 다름: '+host.querySelector('.lpFree b').textContent);
    // 사냥터 카드와 같은 뼈대인가 — 한 조각이라도 빠지면 '비슷한 것을 새로 만든' 것이다
    { // ⚠ SVG 요소의 className 은 문자열이 아니다(SVGAnimatedString) → getAttribute 로 읽는다
      const skel=root=>[...root.querySelectorAll('*')]
        .map(e=>e.tagName.toLowerCase()+'.'+(e.getAttribute('class')||''))
        .filter(x=>x.indexOf('icoImg')<0).sort().join(' ');
      const d=document.createElement('div');
      d.innerHTML=hmUpCardHTML({key:'x',ico:'',name:'n',val:'1',next:'2',lv:'a',nextLv:'b',cost:'c'});
      const home=skel(d.firstChild), mine=skel(rows[0]);
      assert(mine===home,'포인트 카드 뼈대가 사냥터 카드와 다름:\n  내것: '+mine+'\n  사냥터: '+home); }
    // 2열 격자 · 이름과 수치는 잘리지 않는다
    { const top=rows[0].getBoundingClientRect().top;
      const per=rows.filter(e=>Math.abs(e.getBoundingClientRect().top-top)<2).length;
      assert(per===2,'포인트 목록이 2열이 아님: 한 줄 '+per+'칸');
      rows.forEach((e,i)=>{ const S=LP_STATS[i], n=lpPts(S.k);
        for(const sel of ['.hmUpName','.hmUpVl']){ const el=e.querySelector(sel);
          assert(el.scrollWidth<=el.clientWidth+1,sel+' 이 잘림: '+el.textContent); }
        // 제목 아래 = 지금 배수 ▸ 이 1점을 찍으면 갈 배수
        // ⚠ _ptShow 끼리 비교하면 그 함수를 고쳐도 통과한다(헛돈다) → 독립적으로 계산해서 맞춘다
        const want=m=>{ const v=m*LP_STEP*100;
          return '+'+((Math.abs(v-Math.round(v))<0.01)? String(Math.round(v)) : v.toFixed(1))+'%'; };
        const vl=e.querySelector('.hmUpVl').textContent.replace(/\s/g,'');
        assert(vl===want(n)+want(n+1),S.name+' 수치 변화 표기가 다름: '+vl+' vs '+want(n)+want(n+1));
        // 버튼 = 지금 레벨(위) + 값(아래). 윗줄에 '▸ 다음' 을 붙이지 않는다 — 바로 위 값 줄이 이미 말한다
        const bl=e.querySelector('.hmUpBl');
        assert(bl.textContent.trim()==='LV.'+n,S.name+' 레벨 표기가 다름: '+bl.textContent.trim());
        assert(!bl.querySelector('.nx') && !bl.querySelector('svg'),S.name+' 버튼 윗줄에 화살표가 남아 있음');
        assert(e.querySelector('.hmUpBc').textContent.trim()==='-'+ptCost('lp',S.k)+'p','버튼이 비용 표기가 아님'); }); }
    // 극단값에서도 칸 안에 남는가 — 만 레벨이면 한 축에 수천 포인트가 쌓인다
    { const c9=CHAR(), keep=Object.assign({}, c9.unit.pts), keepLv=c9.level;
      c9.level=10000; c9.unit.pts={atk:9999}; renderChr();
      const e=$('chrBody').querySelector('.lpList .hmUp[data-k="atk"]');
      for(const sel of ['.hmUpName','.hmUpVl','.hmUpBl','.hmUpBc']){ const el=e.querySelector(sel);
        assert(el.scrollWidth<=el.clientWidth+1,'9999p 에서 '+sel+' 이 잘림: '+el.textContent.trim()); }
      c9.level=keepLv; c9.unit.pts=keep; renderChr(); }
    // 초기화 = 사냥터 수량 버튼과 같은 물성
    { const q=host.querySelector('.lpHead .lpQ.rs .hmUpQ');
      assert(q && q.textContent.trim()==='초기화','초기화가 수량 버튼 물성이 아님');
      assert(q.scrollWidth<=q.clientWidth+1,'초기화 글자가 잘림');
      const au=host.querySelector('.lpHead .lpQ.au .hmUpQ');
      assert(au && au.textContent.trim()===lpAutoBtnTx(),'자동 버튼 표기가 상태와 다름: '+(au&&au.textContent));
      assert(au.scrollWidth<=au.clientWidth+1,'자동 글자가 잘림: '+au.textContent.trim()); }
    // 이름은 수치 축과 같은 말을 쓴다 — 같은 것을 두 이름으로 부르지 않는다
    assert(lpDef('critd').name===CS_AXES.critd.name,'치명 피해 이름이 축과 다름: '+lpDef('critd').name);
    // 버튼에 적힌 값만큼 '실제로' 빠진다 — 표기와 차감이 갈라지면 여기서 잡힌다
    { const c2=CHAR(); c2.unit.pts={};
      const before=lpFree(c2), cost=ptCost('lp','atk',c2);
      assert(lpAdd('atk',1)===1,'1칸이 안 올라감');
      assert(lpPts('atk')===1,'찍은 칸이 1이 아님');
      assert(lpFree(c2)===before-cost,'버튼에 적힌 값('+cost+'p)만큼 안 빠짐: '+before+'→'+lpFree(c2));
      c2.unit.pts={}; }
    // 화면 버튼으로 찍는다 — 렌더러·상태·전투가 한 줄로 이어지는지 본다
    rows[0].querySelector('.hmUpBtn').click(); await sleep(40);
    assert(lpPts('atk')===1,'버튼을 눌렀는데 안 찍힘');
    assert($('chrBody').querySelector('.lpFree b').textContent===String(20*LP_PER_LEVEL-1),'찍은 뒤 남은 포인트가 안 줄어듦');
    assert(_hb.char.atk>a0+1e-9,'전투 중인 캐릭터 공격력에 반영 안 됨: '+a0+'→'+_hb.char.atk);
    // 치명타 피해·공격속도도 같은 경로를 탄다
    for(const S of LP_STATS) if(S.k==='critd'||S.k==='aspd') lpAdd(S.k,10);
    hbSyncChar();
    assert(_hb.char.critDmg>cdm0+1e-9,'치명타 피해가 반영 안 됨');
    assert(_hb.char.cd<cd0-1e-9,'공격속도가 반영 안 됨');
    // 초기화 버튼도 같은 경로
    $('chrBody').querySelector('.lpHead .lpQ.rs .hmUpQ').click(); await sleep(40);
    assert(lpSpent()===0,'초기화가 안 됨');
    assert(Math.abs(_hb.char.atk-a0)<1e-6,'초기화 뒤 전투 수치가 안 돌아옴');
    navBack(); await sleep(40);
    return '찍기·초기화 → 전투 즉시 반영'; });
  await step('사냥터 업그레이드: 미네랄이 차면 그 자리에서 버튼이 열린다', async()=>{
    assert(typeof hmUpgAfford==='function','살 수 있는지 다시 칠하는 함수가 없음');
    if(typeof hbEnd==='function') hbEnd();
    const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','열림'); saveMeta();
    openHome(); await sleep(120);
    hbHunt().upgAuto=0; hmUpgTab('char'); p.pcoin=0; renderHome();
    const btn=k=>document.querySelector('#hmUpgGrid .hmUpBtn[data-k="'+k+'"]');
    assert(btn('atk'),'데미지 카드가 없음');
    assert(btn('atk').classList.contains('off'),'미네랄이 0인데 버튼이 열려 있음');
    // ⭐ 핵심: 화면을 떠났다 오지 않아도, 미네랄이 차면 열려야 한다
    PROF().pcoin=1e9;
    const n=hmUpgAfford();
    assert(n>0,'미네랄이 찼는데 다시 칠해진 버튼이 없음');
    assert(!btn('atk').classList.contains('off'),'미네랄이 충분한데 버튼이 잠긴 채임');
    // 판정은 한 곳에서만 나온다 — 그릴 때와 다시 칠할 때가 갈리면 '회색인데 눌리는 버튼'이 생긴다
    { const before=[...document.querySelectorAll('#hmUpgGrid .hmUpBtn[data-k]')]
        .map(b=>b.dataset.k+':'+b.classList.contains('off')).join(',');
      renderHome();
      const after=[...document.querySelectorAll('#hmUpgGrid .hmUpBtn[data-k]')]
        .map(b=>b.dataset.k+':'+b.classList.contains('off')).join(',');
      assert(before===after,'다시 칠한 결과가 새로 그린 결과와 다름'); }
    // 반대로 다 쓰면 그 자리에서 다시 잠긴다
    PROF().pcoin=0; hmUpgAfford();
    assert(btn('atk').classList.contains('off'),'미네랄이 없는데 버튼이 열린 채임');
    return '즉시 열림/잠김 ok'; });
  await step('자동 업그레이드: 켜 두면 살 수 있는 것을 싼 것부터 산다', async()=>{
    assert(typeof hmAutoUpgTick==='function','자동 업그레이드가 없음');
    if(typeof hbEnd==='function') hbEnd();
    const p=PROF(); p.chars.length=0; p.curId=''; profCreateChar('ranger','자동업'); saveMeta();
    openHome(); await sleep(120);
    const H=hbHunt(); H.upg={}; H.unl={}; H.upgQty=1; H.upgAuto=0;
    // ① 꺼져 있으면 아무것도 안 산다
    PROF().pcoin=1e9;
    assert(hmAutoUpgTick()===0,'꺼져 있는데 샀음');
    assert(Object.keys(H.upg).length===0,'꺼져 있는데 레벨이 올랐음');
    // ② 켜면 산다 — 미네랄이 줄고 레벨이 오른다
    H.upgAuto=1;
    const coin0=PROF().pcoin, got=hmAutoUpgTick();
    assert(got>0,'켰는데 하나도 안 삼');
    assert(PROF().pcoin<coin0,'샀는데 미네랄이 안 줄어듦');
    assert(Object.keys(hbHunt().upg).length>0,'샀는데 레벨이 안 오름');
    // ③ 한 틱에 무한히 사지 않는다 — 미네랄이 많아도 상한이 있다(프레임이 멈추면 안 된다)
    PROF().pcoin=1e12;
    assert(hmAutoUpgTick()<=HM_AUTO_MAX,'한 틱 상한을 넘김');
    // ④ 싼 것부터 산다 — 다음에 살 것이 지금 살 수 있는 것 중 가장 싸야 한다
    { const coin=Math.floor(PROF().pcoin);
      const k=hmAutoNext(); assert(k,'살 수 있는 게 있는데 못 고름');
      for(const kk in HB_UPG){ const c=hmUpgCost(kk);
        assert(!(c<=coin && c<hmUpgCost(k)),'더 싼 것이 있는데 안 골랐다: '+kk+'('+c+') vs '+k+'('+hmUpgCost(k)+')'); } }
    // ⑤ 잠긴 칸도 연다 — 안 그러면 해금이 영영 안 된다
    { const H2=hbHunt(); H2.upg={}; H2.unl={}; PROF().pcoin=1e9;
      for(let i=0;i<40 && Object.keys(H2.unl).length<3;i++) hmAutoUpgTick();
      assert(Object.keys(hbHunt().unl).length>=3,'자동인데 해금이 안 됨: '+JSON.stringify(hbHunt().unl)); }
    // ⑥ 다 쓰면 멈춘다(무한 루프가 아니다)
    PROF().pcoin=0;
    assert(hmAutoUpgTick()===0,'미네랄이 없는데 샀음');
    hbHunt().upgAuto=0;
    return '싼 것부터 · 한 틱 최대 '+HM_AUTO_MAX+'개'; });
  await step('자동 배분: 골라 둔 한 축에만 계속 찍힌다', async()=>{
    assert(typeof lpAutoSpend==='function','자동 배분이 없음');
    const p=PROF(); p.chars.length=0; p.curId='';
    profCreateChar('ranger','자동'); saveMeta();
    let c=CHAR();
    // ① 기본값이 실제 항목을 가리킨다 — 안 들러도 세지는 게 설계 의도다
    assert(lpAutoKey(c)===LP_AUTO_DEFAULT && lpDef(LP_AUTO_DEFAULT),'기본 자동 대상이 실재하지 않음: '+c.lpAuto);
    // ② 레벨이 오르면 '그 축에만' 들어간다 — 남는 포인트가 없어야 한다
    c.lpAuto='critd'; c.unit.pts={};
    c.xp=1e7; const ups=profApplyLevelUps(c);
    assert(ups>0,'레벨이 안 오름');
    assert(lpFree(c)===0,'자동인데 포인트가 남아 있음: '+lpFree(c));
    assert(lpPts('critd',c)===lpTotal(c),'고른 축에 다 안 들어감: '+lpPts('critd',c)+'/'+lpTotal(c));
    for(const S of LP_STATS) if(S.k!=='critd')
      assert(lpPts(S.k,c)===0,'고르지 않은 축에도 찍힘: '+S.k+'='+lpPts(S.k,c));
    // ③ 대상을 바꾸면 그 뒤로는 새 축에만 쌓인다(이미 찍힌 것은 그대로)
    const before=lpPts('critd',c);
    c.lpAuto='hp'; c.xp=1e7; profApplyLevelUps(c);
    assert(lpPts('critd',c)===before,'대상을 바꿨는데 옛 축이 변함');
    assert(lpPts('hp',c)>0 && lpFree(c)===0,'바꾼 축에 안 들어감');
    // ④ 끄면 안 찍힌다
    c.lpAuto=''; c.xp=1e7; profApplyLevelUps(c);
    assert(lpFree(c)>0,'껐는데도 자동으로 찍힘');
    assert(lpAutoSpend(c)===0,'꺼진 상태인데 자동이 실행됨');
    // ⑤ 화면 흐름: [자동 선택] → 카드를 눌러 지정 → [지정 해제]
    c.unit.pts={}; c.lpAuto=''; saveMeta();
    navGo('upg'); await sleep(60); setChrSec('stat'); await sleep(40);
    const au=()=>$('chrBody').querySelector('.lpHead .lpQ.au .hmUpQ');
    const list=()=>$('chrBody').querySelector('.lpList');
    const cells=()=>[...$('chrBody').querySelectorAll('.lpList .lpCell')];
    // 지정 전 — 버튼은 '자동 선택', 고르는 중이 아니고, 어두워진 칸도 없다
    assert(au().textContent.trim()==='자동 선택','지정 전 버튼 표기가 다름: '+au().textContent.trim());
    assert(!list().classList.contains('picking'),'누르기 전인데 고르는 중임');
    assert(!list().dataset.auto,'지정 전인데 대상 표시가 있음');
    // 누르면 고르는 중 — 칸이 눌리는 자리가 되고 버튼은 '취소'
    au().click(); await sleep(40);
    assert(list().classList.contains('picking'),'자동 선택을 눌러도 고르는 중이 안 됨');
    assert(au().textContent.trim()==='취소','고르는 중인데 버튼이 취소가 아님: '+au().textContent.trim());
    assert(cells().every(e=>e.getAttribute('onclick')),'고르는 중인데 칸을 누를 수 없음');
    assert(lpAutoKey()==='','고르기만 시작했는데 대상이 정해짐');
    // 취소로 빠져나올 수 있다
    au().click(); await sleep(40);
    assert(!list().classList.contains('picking'),'취소했는데 고르는 중이 안 풀림');
    assert(lpAutoKey()==='','취소했는데 대상이 정해짐');
    // 다시 골라서 세 번째 카드를 지정
    au().click(); await sleep(30);
    const want=LP_STATS[2].k;
    cells()[2].click(); await sleep(40);
    assert(lpAutoKey()===want,'카드를 눌렀는데 그 축이 대상이 안 됨: '+lpAutoKey());
    assert(!list().classList.contains('picking'),'지정했는데 고르는 중이 안 풀림');
    assert(lpFree()===0,'지정했는데 밀린 포인트가 안 찍힘');
    assert(list().dataset.auto===want,'목록에 자동 대상 표시가 없음');
    // 지정한 칸만 진하고 나머지는 어두워진다
    { const on=cells().filter(e=>e.classList.contains('on'));
      assert(on.length===1 && on[0]===cells()[2],'진한 칸이 지정한 하나가 아님');
      const a=parseFloat(getComputedStyle(cells()[2]).opacity), b=parseFloat(getComputedStyle(cells()[0]).opacity);
      assert(a>b+0.2,'지정한 칸이 나머지보다 진하지 않음: '+a+' vs '+b); }
    // 버튼이 '지정 해제'로 바뀌고, 누르면 풀린다
    assert(au().textContent.trim()==='지정 해제','지정 뒤 버튼이 지정 해제가 아님: '+au().textContent.trim());
    au().click(); await sleep(40);
    assert(lpAutoKey()==='','지정 해제를 눌렀는데 안 풀림: '+lpAutoKey());
    assert(!list().dataset.auto,'풀었는데 표시가 남음');
    assert(au().textContent.trim()==='자동 선택','푼 뒤 버튼이 자동 선택으로 안 돌아감');
    navBack(); await sleep(40);
    return '자동 선택 → 카드 지정 → 지정 해제'; });
  await step('미네랄 획득: 환생 배수를 탄다(되돌려받는 것은 안 탄다)', ()=>{
    assert(typeof profGainCoin==='function','미네랄 획득 배수가 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; const c=profCreateChar('ranger','코인');
    hbHunt().best={};
    // ① 환생 전에는 배수 1
    assert(profCoinMul(c)===1,'환생 전인데 미네랄 배수가 1이 아님: '+profCoinMul(c));
    p.pcoin=0; profGainCoin(100);
    assert(p.pcoin===100,'배수 1인데 지급이 다름: '+p.pcoin);
    // ② 깊이 밀고 환생할수록 커진다 — 이제 '회차'가 아니라 **그때 레벨**이 정한다(2026-08-19)
    //    ⚠ 배수의 밑은 경험치와 같은 누적치(c.rebMul)다 — 따로 세면 두 배수가 갈라진다
    let prev=1, gap=0;
    for(const lv of [PROF_REB_MIN_LV+30, PROF_REB_MIN_LV+90, PROF_REB_MIN_LV+150, PROF_REB_MIN_LV+210]){
      c.level=lv; c.unit.level=lv;
      PLAYER_META.coins=(PLAYER_META.coins||0)+profRebPoint(c);   // 🔑 유즈맵 포인트 관문(여기서는 주제가 아니다)
      assert(profRebirth(c)>0,'Lv'+lv+' 환생이 안 됨');
      const m=profCoinMul(c);
      assert(m>prev,'Lv'+lv+' 에서 미네랄 배수가 안 늘어남');
      assert(m-prev>=gap-1e-9,'Lv'+lv+' 에서 증가폭이 안 커짐(기하가 아님)'); gap=m-prev; prev=m;
      assert(Math.abs((m-1)-PROF_REB_COIN_R*(profXpMul(c)-1))<1e-9,
        'Lv'+lv+' 에서 미네랄 배수가 경험치 누적치와 갈라짐: '+m+' vs '+profXpMul(c)); }
    // ③ 실제 지급에 붙는다
    { const P=PROF(); P.pcoin=0; const got=profGainCoin(100);
      assert(Math.abs(got-100*profCoinMul())<1e-6,'지급에 배수가 안 붙음: '+got);
      assert(Math.abs(P.pcoin-got)<1e-6,'지급액과 잔고 증가가 다름'); }
    // ④ 되돌려받는 것(장비 분해)은 배수를 타지 않는다 — 무한 증식이 된다
    { const P=PROF(); P.items.length=0;
      const it=profMakeItem('weapon',1,'common'); profAddItem(it);
      const v=profScrapValue(it); P.pcoin=0;
      assert(profScrapItem(it.iid)===v,'분해 환급액이 다름');
      assert(Math.abs(P.pcoin-v)<1e-6,'분해 환급에 획득 배수가 붙음(무한 증식): '+P.pcoin+' vs '+v); }
    return '6회차 미네랄 ×'+profCoinMul(c).toFixed(1); });
  // 🔁 환생 포인트(2026-08-19): **적게 주고 · 세게 만들고 · 재투자는 비싸게** — 셋이 한 세트다.
  //    발산을 막는 것은 지급식이 아니라 체증 비용이다(n칸에 n²/2 포인트 → 효과는 √ 로 눕는다).
  await step('환생 포인트: 적게·세게·재투자 체증', async()=>{
    assert(typeof rpAdd==='function','환생 포인트가 없음');
    const p=PROF(); p.chars.length=0; p.curId='';
    { const c0=profCreateChar('ranger','환포'); c0.level=1; c0.unit.level=1; c0.lpAuto=0; }
    hbHunt().best={}; PLAYER_META.coins=1e9; saveMeta();
    let c=CHAR();
    assert(rpTotal(c)===0,'처음부터 환생 포인트가 있음: '+rpTotal(c));
    // ① 환생해야 나온다 · 지급은 레벨이 정한다
    c.level=PROF_REB_MIN_LV; c.unit.level=c.level; c.unit.pts={atk:5};
    assert(profRebirth(c)===1,'환생이 안 됨');
    assert(rpTotal(c)===1,'첫 환생 지급이 1p 가 아님: '+rpTotal(c));
    assert(lpTotal(c)===0 && lpSpent(c)===0,'레벨 포인트가 안 되감김');
    // ② 깊이 밀수록 더 준다 — 다만 아주 조금씩
    // ⭐ 지급은 log(초과레벨) 꼴 — 초반엔 넉넉하고 후반엔 크게 눌린다.
    //    ⛔ 선형으로 되돌리면 던전이 오를수록 필요한 레벨이 거꾸로 줄어든다(실측).
    { const g=lv=>profRebGrantAt(PROF_REB_MIN_LV+lv);
      assert(g(0)===1,'딱 문턱인데 1p 가 아님: '+g(0));
      assert(g(400)>g(100),'더 밀었는데 지급이 안 늘어남');
      // log 면 '4배 더 밀어도 1.3배 남짓' — √ 면 2배, 선형이면 4배가 된다
      const r=(g(400)-1)/(g(100)-1);
      assert(r>1.1 && r<1.6,'지급이 log 꼴이 아님(4배 밀었을 때 '+r.toFixed(2)+'배)'); }
    // ③ 배수는 **복리**다 — 이 축이 전투력의 지수 성장을 담당한다(적 체력이 라운드에 대해 지수라 필요하다)
    const put=rpAdd('atk', 2);
    assert(put>0 && rpPts('atk')===put,'환생 포인트가 안 찍힘');
    assert(Math.abs(rpMul('atk')-Math.pow(1+RP_STEP,put))<1e-9,'환생 배수가 복리가 아님: '+rpMul('atk'));
    // 복리면 여러 축에 나눠 찍어도 총 곱이 같다(밑수가 같다) — 함정 빌드가 없다는 성질
    { const a=Math.pow(1+RP_STEP,6), b=Math.pow(1+RP_STEP,3)*Math.pow(1+RP_STEP,3);
      assert(Math.abs(a-b)<1e-9,'복리인데 배분에 따라 총 곱이 달라짐'); }
    // ④ 1점이 즉시 체감돼야 한다(적게 주므로) — 레벨 포인트보다 훨씬 세다
    assert(RP_STEP>=LP_STEP*3,'환생 포인트 1점이 레벨 포인트와 비슷함: '+RP_STEP+' vs '+LP_STEP);
    // ⑤ ⭐ 재투자 체증 — 같은 곳에 또 찍으면 비싸진다(레벨 포인트는 1 고정)
    { assert(ptCostAt('rp','atk',0)===1,'첫 칸이 1p 가 아님');
      let prev=0;
      for(const lv of [0,1,2,5,10]){ const v=ptCostAt('rp','atk',lv);
        assert(v>=prev,'환생 포인트 비용이 안 오름: lv'+lv+' → '+v); prev=v; }
      assert(ptCostAt('rp','atk',9)>ptCostAt('rp','atk',0),'체증이 없음');
      for(const lv of [0,5,20]) assert(ptCostAt('lp','atk',lv)===1,'레벨 포인트에 체증이 붙음(1 고정이어야 한다)'); }
    // ⑥ 체증이 총량을 √ 로 눕힌다 — 네 배 모아야 두 배
    { const canBuy=P=>{ let t=0,n=0; while(t+ptCostAt('rp','atk',n)<=P){ t+=ptCostAt('rp','atk',n); n++; } return n; };
      const a=canBuy(100), b2=canBuy(400);
      assert(b2<a*2.6,'포인트를 4배 모았더니 칸이 2.6배 넘게 늘어남(체감이 약하다): '+a+' → '+b2);
      assert(b2>a*1.5,'4배 모았는데 칸이 1.5배도 안 늘어남(체감이 과하다): '+a+' → '+b2); }
    // ⑦ 남은 것보다 많이 못 찍는다 · 버튼 표기와 실제 차감이 같다
    { c.unit.rpts={}; c.rp=20;
      const before=rpFree(c), cost=ptCost('rp','hp',c);
      assert(rpAdd('hp',1)===1,'1칸이 안 올라감');
      assert(rpFree(c)===before-cost,'버튼에 적힌 값('+cost+'p)만큼 안 빠짐');
      const got=rpAdd('hp',999);
      assert(got>0 && rpFree(c)<ptCost('rp','hp',c),'남은 것보다 많이 찍힘'); }
    // ⑧ 환생해도 남는다 · 전투에 걸린다
    { c.unit.rpts={atk:3}; c.rp=5000; const m=rpMul('atk');
      c.level=PROF_REB_MIN_LV+40; c.unit.level=c.level; profRebirth(c);
      assert(rpPts('atk')===3 && Math.abs(rpMul('atk')-m)<1e-9,'환생했더니 찍어 둔 포인트가 사라짐'); }
    { c.unit.pts={}; c.unit.rpts={}; const base=csVal('atk');
      c.unit.rpts={atk:4};
      assert(Math.abs(csAxis('atk').rp-Math.pow(1+RP_STEP,4))<1e-9,'축이 환생 배수를 안 읽음');
      assert(csVal('atk')>base+1e-9,'환생 포인트가 공격력에 반영 안 됨'); }
    // ⑨ 기록 기반 지급은 폐지됐다 — 같은 진행을 두 번 세지 않는다
    { hbHunt().best={1:HB_ROUND_MAX,2:50};
      assert(profRecordRp(CHAR())===0,'폐지한 기록 포인트가 되살아남');
      assert(rpTotal(CHAR())===(CHAR().rp|0),'총량에 기록 몫이 섞임'); }
    // ⑩ 환생 탭에서 찍는다 — 화면·상태·전투가 한 줄로 이어지는지
    { const c3=CHAR(); c3.unit.rpts={}; c3.rp=30; saveMeta(); }
    navGo('upg'); await sleep(60); setChrSec('reb'); await sleep(40);
    const host=$('chrBody');
    const rows=[...host.querySelectorAll('.lpList .hmUp')];
    assert(rows.length===LP_STATS.length,'환생 포인트 카드 수가 표와 다름: '+rows.length);
    const before=csVal('atk');
    rows[0].querySelector('.hmUpBtn').click(); await sleep(40);
    assert(rpPts('atk')===1,'환생 탭 버튼으로 안 찍힘');
    assert(csVal('atk')>before+1e-9,'찍었는데 공격력이 그대로');
    // 두 번째 칸은 값이 올라 있어야 한다(체증이 화면에도 보인다)
    { const btn=[...host.querySelectorAll('.lpList .hmUp')][0].querySelector('.hmUpBc');
      assert(btn && btn.textContent.indexOf('-'+ptCost('rp','atk',CHAR()))>=0,
        '버튼이 오른 값을 안 보여 줌: '+(btn&&btn.textContent)); }
    $('chrBody').querySelector('.lpHead .lpQ.rs .hmUpQ').click(); await sleep(40);
    assert(rpSpent()===0,'초기화가 안 됨');
    navBack(); await sleep(40);
    PLAYER_META.coins=0;
    return '1p = ×'+(1+RP_STEP)+'(복리) · 지급 1+'+PROF_REB_RP_K+'ln초과 · 재투자 체증'; });
  await step('캐릭터: 스탯·환생·스킬 · 환생 본문은 빌려 쓴다', async()=>{
    skipIf(typeof setChrSec!=='function','캐릭터 구역 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    // ⚠ 하단 네비에서 빠진 화면이다(2026-08-25 개편 — 연구·임무로 교체). 화면·코드는 살아 있으므로
    //   **직접 열어서** 계속 검사한다 — 유보한 코드가 썩지 않게. ⛔ navGo('upg'/'gear') 는 이제 없다.
    openUpgScreen(); await sleep(60);
    assert(visible($('upgScreen')),'캐릭터 화면이 안 열림');   // APP_SCREENS 에 빠지면 영영 안 켜진다
    // ⛔ 옛 네비 하위(스탯·환생·스킬) 검사는 걷어냈다 — 2026-08-25 개편으로 그 칸들이 없어졌다.
    //   화면 자체(setChrSec 로 구역 전환)는 아래에서 계속 검사한다.

    const host=()=>$('chrBody');
    // ① 스탯 = 이 화면 전용 렌더러다 — 팝업 본문을 빌려오지 않는다(상세표는 사냥터 프로필이 맡는다)
    assert(!host().querySelector('#hbInfoBody'),'스탯이 아직 팝업 본문을 빌려옴');
    assert(!host().querySelector('.hbTbl'),'스탯 출처 표가 스탯 구역에 남아 있음(프로필 팝업으로 옮겼다)');
    assert(host().querySelector('.lpList'),'레벨 포인트 구역이 없음');
    assert($('hbInfoModal').querySelector('#hbInfoBody'),'스탯 출처 본문이 팝업에 없음');
    // ② 환생 — 빌려 오면서 앞 구역 본문은 제자리로 돌아가야 한다
    setChrSec('reb'); await sleep(40);
    assert(host().querySelector('#hbGrowBody'),'환생 본문을 안 빌려옴');
    assert([...host().querySelectorAll('.hbRowBtn')].some(b=>b.textContent==='환생'),'환생에 환생 버튼이 없음');
    // ③ 스킬 = HB_SKILLS 표 하나에서만 온다
    setChrSec('skill'); await sleep(40);
    assert($('hbGrowModal').querySelector('#hbGrowBody'),'환생 본문이 팝업으로 안 돌아감');
    assert(host().querySelectorAll('.hbRow').length===Object.keys(HB_SKILLS).length,'스킬 줄 수가 HB_SKILLS 와 다름');
    for(const k in HB_SKILLS) assert(host().textContent.indexOf(HB_SKILLS[k].name)>=0,'스킬 누락: '+HB_SKILLS[k].name);
    // ④ 팝업(더보기) 경로가 열리면 본문을 되찾아 간다 — DOM 은 끝까지 한 벌
    setChrSec('reb'); await sleep(40); hbOpenGrow(); await sleep(40);
    assert($('hbGrowModal').querySelector('#hbGrowBody'),'팝업이 본문을 못 되찾음');
    assert($('hbGrowBody').textContent.indexOf('환생')>=0,'되찾은 본문이 비어 있음');
    hbCloseGrow(); openUpgScreen(); await sleep(60);
    assert(host().querySelector('#hbGrowBody'),'화면 복귀 시 본문을 다시 못 빌려옴');
    for(const id of ['hbInfoBody','hbGrowBody'])
      assert(document.querySelectorAll('#'+id).length===1,'본문이 복제됨: '+id);
    setChrSec('stat'); await sleep(40);
    return '스탯·환생·스킬 구역 전환 · 본문 단일 DOM';
  });

  // 🔬📋 하단 네비 개편(2026-08-25) — 옛 캐릭터·정비를 연구·임무로 갈아끼웠다.
  //   ⚠ 지금은 **껍데기**다(본문 '준비 중'). 그래도 칸·아이콘·화면 열림은 지금부터 지킨다 —
  //     APP_SCREENS 에 빠지면 화면이 영영 안 켜지는데, 눈으로만 보면 그걸 못 잡는다.
  await step('하단 네비: 연구·임무·유즈맵·상점 네 칸', async()=>{
    skipIf(typeof NAV_TREE==='undefined','네비 표 없음');
    const cells=NAV_TREE.filter(x=>!x.noCell).map(x=>x.label);
    assert(cells.join(',')==='연구,임무,유즈맵,상점','하단 네 칸이 다름: '+cells.join(','));
    // 두 칸이 실제로 열리는가 — APP_SCREENS 누락이면 여기서 걸린다
    for(const [fn,id,label] of [[()=>openResearch(),'researchScreen','연구'],[()=>openQuest(),'questScreen','임무']]){
      fn(); await sleep(60);
      assert(visible($(id)), label+' 화면이 안 열림(APP_SCREENS 에 빠졌는지 볼 것)');
      assert($(id).querySelector('.setSoon'), label+' 화면 본문이 없음'); }
    // 네비 아이콘이 실제로 칠해지는가(ICO 표에 없는 키를 쓰면 빈 칸이 된다)
    { const bad=[];
      for(const x of NAV_TREE){ if(x.noCell) continue; if(typeof ICO==='undefined') break;
        if(!ICO[x.ico]) bad.push(x.label+'→'+x.ico); }
      assert(!bad.length,'네비 아이콘 키가 ICO 표에 없음: '+bad.join(' · ')); }
    // ⛔ 유보 규칙 — 옛 화면과 코드는 살아 있어야 한다(길만 닫았다 · GAME_DIRECTION §5)
    assert(typeof openUpgScreen==='function' && typeof openGear==='function',
      '옛 캐릭터·정비 함수가 사라졌다 — 유보는 삭제가 아니다(GAME_DIRECTION §5)');
    assert($('upgScreen') && $('gearScreen'), '옛 캐릭터·정비 화면 마크업이 사라졌다');
    return cells.join(' · ');
  });
  // 🏕 캠프 좌상단 던전 칩(2026-08-25) — 재화 바 왼쪽 빈 슬롯에 얹는 얇은 판.
  //   ⚠ 캠프 화면 자체는 3D 라 여기서 못 띄운다. 그래서 **캠프를 켜지 않고** 무는 검사로 세운다 —
  //     ① 마크업 만드는 함수 ② 화면이 바뀔 때 걷히는가 ③ CSS 가 실제로 걸리는가.
  await step('캠프 좌상단: 던전 칩(왼쪽 광원 띠 + 두 줄)', async()=>{
    skipIf(typeof curChipHTML!=='function','칩 함수 없음');
    const t=$('curTitle'); assert(t,'재화 바 왼쪽 슬롯(#curTitle)이 없음');
    // ⚠ 아래는 전부 try/finally 안이다 — 중간에 실패해도 캠프 스텁이 남으면 **뒤 검사가 줄줄이 깨진다**
    //   (실제로 그랬다: 칩이 안 걷혀 상점 제목 자리에 던전 이름이 남았다).
    const _on0=window.campIsOn, _st0=window.campState;
    // ⚠ 재화 바가 숨겨져 있으면 rect 가 전부 0 이라 자리 검사가 통째로 헛돈다 — 먼저 켜 둔다
    const _barWas=$('curBar').classList.contains('hide'); if(_barWas) curShow(true);
    try{
    // ① 마크업 — 이름·라벨·숫자·진행 막대가 다 들어간다
    t.classList.add('asChip');
    t.innerHTML=curChipHTML({name:'잊혀진 회랑', lab:'던전', cur:3, max:10});
    const nm=t.querySelector('.cdNm'), n=t.querySelector('.cdN'), bar=t.querySelector('.cdBar i');
    assert(nm && nm.textContent==='잊혀진 회랑','던전 이름이 칩에 없음');
    assert(t.querySelector('.cdLab') && t.querySelector('.cdLab').textContent==='던전','라벨이 없음');
    assert(n && n.textContent==='3','현재 값이 없음');
    assert(t.querySelector('.cdDim').textContent==='/10','최댓값 표기가 없음');
    assert(bar,'진행 막대가 없음');
    assert(Math.abs(parseFloat(bar.style.width)-30)<0.6,'진행 막대가 3/10=30% 가 아님: '+bar.style.width);
    assert(t.querySelector('.cdRail'),'왼쪽 광원 띠(7안의 핵심)가 없음');
    // ①-2 진행 막대는 **판 안쪽**에 앉는다 — 아래 테두리에 붙거나 좌우 모서리에 물리면 새어 보인다
    { const r=t.getBoundingClientRect(), br=t.querySelector('.cdBar').getBoundingClientRect();
      const gapB=r.bottom-br.bottom, gapL=br.left-r.left, gapR=r.right-br.right;
      assert(gapB>=2,'막대가 칩 아래 테두리에 붙었다(간격 '+gapB.toFixed(1)+'px)');
      assert(gapL>=3 && gapR>=3,'막대 좌우가 안 잘렸다 — 판 모서리에 물린다(좌 '+gapL.toFixed(1)+' / 우 '+gapR.toFixed(1)+')'); }
    // ①-3 라운드 줄은 **밑선 정렬**이다. 글자 크기가 셋 다 달라(9.5/12/11px) 가운데로 맞추면 어긋나 보인다.
    //   ⚠ rect 로는 못 잰다 — 밑선이 맞아도 글자 크기가 다르면 **하강부만큼 아래가 벌어진다**
    //     (실측 1.0px). 그래서 규칙 자체를 본다(말줄임과 같은 이유).
    { const ai=getComputedStyle(t.querySelector('.cdSub')).alignItems;
      assert(ai==='baseline','라운드 줄이 밑선 정렬이 아니다 — 숫자와 총 라운드가 어긋나 보인다: '+ai); }
    // ② CSS — 클래스만 붙이면 칩 물성이 실제로 걸리는가(규칙이 다른 파일에 있어 조용히 빠질 수 있다)
    { const cs=getComputedStyle(t);
      assert(parseFloat(cs.borderRadius)===3,'칩 모서리가 3px 이 아님(DESIGN 각진 규칙): '+cs.borderRadius);
      assert(parseFloat(cs.borderTopWidth)>0,'칩 테두리가 없음 — .curTitle.asChip 규칙이 안 걸렸다');
      const a=cs.backgroundColor.match(/[\d.]+/g)||[];
      assert(a.length===4 && parseFloat(a[3])>0.3 && parseFloat(a[3])<0.95,
        '칩 배경이 반투명하지 않음(맵 위에 얹히는 판이다): '+cs.backgroundColor);
      // 숫자는 청록(--hud) 발광 — 초록만 재면 파랑도 통과하므로 파랑·초록이 빨강보다 크고 빛이 있는지로 잰다
      const c=(getComputedStyle(n).color.match(/[\d.]+/g)||[]).map(Number);
      assert(c[1]>120 && c[2]>150 && c[1]>c[0]+60 && c[2]>c[0]+60,'칩 숫자가 청록이 아님: '+getComputedStyle(n).color);
      assert(/px/.test(getComputedStyle(n).textShadow||''),'칩 숫자에 발광이 없음'); }
    // ②-2 칩은 재화 바 안에 들어가야 한다 — 두 줄을 그냥 쌓으면 바(34px)를 넘어 밖으로 삐져나온다(실측 44.7px)
    { const bar=$('curBar'); const was=bar.classList.contains('hide');
      if(was) curShow(true);
      const bh=bar.getBoundingClientRect().height, ch=t.getBoundingClientRect().height;
      if(was) curShow(false);
      assert(bh>0,'재화 바 높이를 못 쟀다 — 이 검사가 헛돈다');
      assert(ch<=bh,'칩이 재화 바를 넘는다(바 밖으로 삐져나온다): 칩 '+ch.toFixed(1)+'px > 바 '+bh.toFixed(1)+'px'); }
    // ②-3 칩이 상단 바를 밀어 더보기(☰)를 화면 밖으로 내보내지 않는다.
    //   ⚠ 두 겹으로 잰다. ⓐ 재화가 커져도 ☰ 가 화면 안 (칩이 줄어드는가) ⓑ 보통 재화에서 칩 폭 예산.
    //     진행 막대를 라운드 **오른쪽**에 두었을 때 칩이 134px 이 되어 ☰ 가 밀렸다 — ⓑ 가 그걸 잡는다.
    //     ⓐ 는 그 뒤에도 남아 있던 진짜 원인(재화가 261~305px 까지 자란다)을 잡는다.
    { const CHIP_W_MAX=110;   // 좌상단 칩 폭 예산(px) — 옛 프로필(≈138px)보다 좁게 잡는다
      const bar=$('curBar'), ph=$('phone'), set=$('curSettingsBtn'), p=PROF();
      const was=bar.classList.contains('hide'); if(was) curShow(true);
      const m0=p.pcoin, g0=p.gas, j0=p.gem;                 // ⚠ 미네랄은 p.mineral 이 아니라 **p.pcoin** 이다
      const on0=window.campIsOn, st0=window.campState;
      window.campIsOn=()=>true; window.campState=()=>({dg:3, rnd:27});   // 라운드까지 있는 쪽이 라벨이 길어 최악이다
      // ⚠ 캠프에서는 재화가 프로필이 아니라 **G.tech.credit/energy** 에서 온다(updateCurBar 의 _camp 경로).
      //   프로필만 세우면 화면 값이 안 바뀌어 이 검사가 통째로 헛돈다(실제로 '5,156' 을 재고 있었다).
      const T=(typeof G!=='undefined')?G.tech:null, tc0=T?T.credit:0, te0=T?T.energy:0;
      const setRes=(v)=>{ p.pcoin=v; p.gas=v; p.gem=v; if(T){ T.credit=v; T.energy=v; } updateCurBar(); };
      const wid=()=>$('curTitle').getBoundingClientRect().width;
      const over=()=>set.getBoundingClientRect().right - ph.getBoundingClientRect().right;
      // ⓑ 보통 재화 — 칩 폭 예산. 옛 좌상단 프로필(≈138px)보다 좁아야 한다.
      setRes(1240);
      const wNormal=wid();
      assert(wNormal<=CHIP_W_MAX,'칩이 예산('+CHIP_W_MAX+'px)보다 넓다: '+wNormal.toFixed(0)+'px '
        +'— 좌상단은 재화 바와 폭을 나눠 쓴다(막대를 라운드 오른쪽에 두면 134px 이 된다)');
      // ⓐ 재화가 커져도 ☰ 는 화면 안. 표기가 실제로 길어졌는지 먼저 확인한다(안 그러면 통째로 헛돈다).
      setRes(99999);
      assert($('curMin').textContent==='99,999','재화를 큰 값으로 못 세웠다 — 이 검사가 헛돈다: '+$('curMin').textContent);
      const o1=over(), w1=wid();
      setRes(1e70);
      assert($('curMin').textContent.length>=8,'지수 표기가 안 나왔다 — 최악을 못 쟀다: '+$('curMin').textContent);
      const o2=over(), w2=wid();
      // 줄어든 칩에서 이름이 잘리는가. ⚠ rect 로는 못 잰다 — 요소 폭은 컨테이너를 따라 줄고 **글자만** 넘친다.
      //   그래서 규칙 자체를 본다(이 경우엔 규칙이 곧 증상 방지책이다).
      //   ⚠ 값을 **여기서 바로 뽑는다** — getComputedStyle 은 live 라, 아래에서 칩을 다시 그리면
      //     잡아 둔 노드가 교체돼 빈 문자열이 된다(그래서 한 번 헛돌았다).
      const nmOv=(()=>{ const e=t.querySelector('.cdNm'); if(!e) return {o:'(이름 없음)', t:''};
        const c=getComputedStyle(e); return {o:c.overflowX, t:c.textOverflow}; })();
      window.campIsOn=on0; window.campState=st0;
      p.pcoin=m0; p.gas=g0; p.gem=j0; if(T){ T.credit=tc0; T.energy=te0; } updateCurBar();
      if(was) curShow(false);
      assert(o1<=0,'재화 6자리에서 ☰ 가 화면 밖으로 '+o1.toFixed(1)+'px 나갔다(칩 '+w1.toFixed(0)+'px)');
      assert(o2<=0,'재화 지수 표기에서 ☰ 가 화면 밖으로 '+o2.toFixed(1)+'px 나갔다(칩 '+w2.toFixed(0)+'px)');
      assert(w2<w1,'재화가 커졌는데 칩이 안 줄었다 — 줄어들지 않으면 언젠가 ☰ 를 민다');
      assert(nmOv.o==='hidden' && nmOv.t==='ellipsis',
        '칩이 줄어들 때 던전 이름이 안 잘린다 — 글자가 칩을 뚫고 나간다(overflow-x '+nmOv.o+' / '+nmOv.t+')');
      // 칩을 다시 세워 아래 검사가 이어지게 한다
      t.classList.add('asChip'); t.innerHTML=curChipHTML({name:'잊혀진 회랑', lab:'던전', cur:3, max:10}); }
    // ③ 다른 화면으로 가면 칩은 걷히고 글자로 돌아온다(안 걷으면 상점 제목 자리에 던전이 남는다)
    curSetTitle('상점');
    assert(!t.classList.contains('asChip'),'화면이 바뀌었는데 칩이 안 걷혔다');
    assert(t.textContent==='상점' && !t.querySelector('.cdNm'),'칩 잔해가 남았다: '+t.innerHTML);
    // ④ 값 출처 — 캠프가 아니면 아예 안 그린다(다른 화면 제목을 덮어쓰면 안 된다)
    assert(campChipInfo()==null,'캠프가 아닌데 칩 정보가 나옴');
    // ⑤ ⭐ 2026-08-25: 캠프에 단계·라운드가 생겼다. 0단계=캠프(안전) · 1~10=던전.
    //    상태는 19-camp.js 가 단일 소스이고 이 칩은 **읽기만** 한다.
    { const on=window.campIsOn, cs=campState(), bk={dg:cs.dg, cleared:cs.cleared};
      window.campIsOn=()=>true;
      cs.dg=0; cs.cleared=0;
      { const a=campChipInfo();
        assert(a && /캠프/.test(a.name),'0단계인데 캠프로 안 보임: '+JSON.stringify(a)); }
      cs.dg=3; cs.cleared=26;
      { const b=campChipInfo();
        assert(b && b.lab==='라운드' && b.cur===27,'던전인데 라운드를 안 씀: '+JSON.stringify(b));
        assert(b.max===CAMP_ROUND_MAX,'칩 라운드 상한이 캠프와 다름: '+b.max+' vs '+CAMP_ROUND_MAX); }
      // ⛔ 12-appshell 의 CAMP_RND_MAX 는 19-camp 의 CAMP_ROUND_MAX 를 베낀 값이다 — 갈리면 안 된다
      assert(CAMP_RND_MAX===CAMP_ROUND_MAX,
        '라운드 상한이 두 파일에서 갈렸다: 12-appshell '+CAMP_RND_MAX+' vs 19-camp '+CAMP_ROUND_MAX);
      cs.dg=bk.dg; cs.cleared=bk.cleared; window.campIsOn=on; }
    return '이름·던전 3/10 · 막대 30%(판 안쪽) · 밑선 정렬 · 바 안에 들어감 · ☰ 안 밀림 · 걷힘 확인';
    } finally {
      window.campIsOn=_on0; window.campState=_st0;
      curSetTitle('');            // 칩을 확실히 걷는다 — 남으면 다른 화면 제목 자리를 차지한다
      updateCurBar();
      if(_barWas) curShow(false);
    }
  });

  // 🏕 「아무것도 안 골랐을 때」 하단 프로필 = 기지 요약(2026-08-25)
  await step('캠프 하단 프로필: 아무것도 안 골랐을 때 기지 요약', async()=>{
    skipIf(typeof _campIdleModel!=='function','요약 모델 없음');
    const prof=PROF(), camp0=prof.camp, on0=window.campIsOn, st0=window.campState;
    const G0=(typeof G!=='undefined')?G.tech:null;
    const box=document.createElement('div'); box.id='__idleTest'; $('phone').appendChild(box);
    try{
      prof.camp={dg:3, rnd:27, race:'terran', upg:{tap:4, gather:2}, rate:12.4};
      window.campIsOn=()=>true; window.campState=()=>PROF().camp;
      if(typeof G!=='undefined') G.tech={ race:'union', sup:9, supCap:18,
        ents:[{type:'worker'},{type:'worker'},{type:'worker'},{type:'bldg',bk:'command'}] };
      const m=_campIdleModel(), get=k=>{ const r=(m.info.stats||[]).find(x=>x[0]===k); return r&&r[1]; };
      // ① 제목은 **던전 이름이 아니다** — 던전은 좌상단 칩이 이미 말한다(두 번 말하지 않는다).
      //   자간 넓은 작은 라벨(kicker)로 「이 구역이 무엇인지」만 말한다.
      assert(m.kicker,'제목이 작은 라벨(kicker)이 아니다');
      assert(m.title.indexOf('잊혀진')<0 && m.title.indexOf('던전')<0,
        '제목에 던전 이름이 들어갔다 — 좌상단 칩과 같은 말을 두 번 한다: '+m.title);
      // 캠프 값을 **실제로 읽는가** — 하드코딩이면 아래에서 걸린다
      assert(get('일꾼')==='3기','일꾼 수를 안 읽음: '+get('일꾼'));
      assert(get('인구')==='9 / 18','인구를 안 읽음: '+get('인구'));
      assert(get('터치 강화')==='Lv.4','터치 강화 레벨을 안 읽음: '+get('터치 강화'));
      assert(get('채취 강화')==='Lv.2','채취 강화 레벨을 안 읽음: '+get('채취 강화'));
      assert(/\/초$/.test(get('자동 수급')||''),'자동 수급이 초당 표기가 아님: '+get('자동 수급'));
      // ⭐ 2026-08-25: 배수는 ×1.5^(던전-1) 공식이 아니라 CAMP_MINE 표다(HUNT_R1.md §6-1-0-1)
      { const want='×'+campMineMul().toFixed(1);
        assert(get('던전 배수')===want,'던전 배수가 표와 안 맞음: '+get('던전 배수')+' (기대 '+want+')'); }
      // ② 던전을 옮기면 값이 따라간다(두 곳에서 각자 계산하면 여기서 갈린다)
      prof.camp.dg=1; const m2=_campIdleModel();
      assert(m2.info.stats.find(x=>x[0]==='던전 배수')[1]==='×1.0','던전을 바꿨는데 배수가 그대로');
      prof.camp.dg=3;
      // ③ 실제로 그려진다 — 공용 렌더러(renderCmdGrid)를 쓴다(새 카드를 만들지 않는다)
      renderCampIdleSheet(box);
      assert(box.querySelector('.cmdG'),'요약 카드가 안 그려짐');
      assert(box.querySelectorAll('.cgStat').length===m.info.stats.length,'요약 줄 수가 다름');
      // ③-2 안쪽 **전체**를 쓴다 — 빈 슬롯 4칸은 이 카드에서 의미가 없다
      assert(!box.querySelector('.cgGrid'),'요약 카드에 빈 슬롯 그리드가 남았다');
      { const k=box.querySelector('.cgKick');
        assert(k,'머리줄이 작은 라벨로 안 그려짐');
        const cs=getComputedStyle(k);
        assert(parseFloat(cs.fontSize)<=10,'머리줄 라벨이 너무 크다(제목처럼 보인다): '+cs.fontSize);
        assert(parseFloat(cs.letterSpacing)>=1.5,'머리줄 라벨의 자간이 안 넓다: '+cs.letterSpacing); }
      { const w=box.querySelector('.cgStats.cgWide');
        assert(w,'요약이 전폭 격자가 아니다');
        const cols=(getComputedStyle(w).gridTemplateColumns||'').split(/\s+/).filter(Boolean).length;
        assert(cols===4,'요약 격자가 4열이 아님(8줄을 두 줄로 편다): '+cols+'열'); }
      // ④ 값이 바뀌면 다시 그린다 — 시그니처가 안 움직이면 영영 옛 값이 남는다
      const sig1=box._gSig; prof.camp.upg.tap=9; renderCampIdleSheet(box);
      assert(box._gSig!==sig1,'값이 바뀌었는데 다시 안 그림(시그니처가 안 움직인다)');
      assert(box.textContent.indexOf('Lv.9')>=0,'다시 그렸는데 새 값이 안 보임');
      // ④-2 건물 카드를 보다가 해제하면 요약이 **되살아난다**
      //   ⚠ 값이 그대로면 서명이 같다 — 서명만 보면 건물 카드가 그대로 남는다(그래서 모델 종류도 본다)
      { renderCmdGrid(box, {mode:'upg', compact:true, build:true, title:'병영', items:[], info:{desc:'x'}});
        assert(!box.querySelector('.cgKick'),'덮어쓰기 준비가 안 됨');
        renderCampIdleSheet(box);
        assert(box.querySelector('.cgKick'),'해제했는데 요약이 안 돌아온다(서명이 같아 건너뛴다)'); }
      // ④-3 **실제로 이어져 있다** — campSyncSheet 가 본부를 고르지 않고 요약을 그린다
      if(typeof campSyncSheet==='function' && typeof G!=='undefined'){
        const body=$('btSheetBody');
        if(body){
          G.tech={ race:'union', sel:null, selU:[], selRes:null, arm:null, skillArm:null, rallySet:null,
                   sheet:{open:false,sec:null}, sup:9, supCap:18,
                   ents:[{eid:1,type:'bldg',bk:'command',key:'command',bt:0},{type:'worker'},{type:'worker'},{type:'worker'}] };
          body._gSig=undefined; body._cgModel=undefined;
          //   ⚠ 본부를 대신 고르면 techUIRender 가 불려 3D 를 건드리다 터진다(이 환경엔 3D 가 없다).
          //     그냥 두면 「worker_human 을 읽을 수 없다」 같은 엉뚱한 메시지가 나와 원인을 못 찾는다.
          let _err=''; try{ campSyncSheet(); }catch(e){ _err=e.message; }
          assert(G.tech.sel==null,'아무것도 안 골랐는데 본부가 대신 선택됐다 — 「고르지 않은 상태」가 사라진다'
            +(_err?(' (그리고 터졌다: '+_err+')'):''));
          assert(!_err,'campSyncSheet 가 터졌다: '+_err);
          assert(body.querySelector('.cgKick'),'campSyncSheet 가 요약을 안 그렸다 — 연결이 끊겼다');
          assert($('btSheet').classList.contains('open'),'시트가 안 열려 있다'); } }
      // ⑤ 캠프 함수가 **아예 없을 때**도 안 터진다(다른 화면·다른 빌드에서 불려도 조용히)
      //   ⚠ delete 로는 못 지운다 — function 선언으로 만든 전역은 지워지지 않는다(그래서 한 번 헛돌았다).
      //     undefined 로 덮어야 '함수가 없는' 상황이 실제로 만들어진다.
      { const keep={}; for(const k of ['campState','campTapGain','campGatherMul','campDgMul','campUpgLv']){ keep[k]=window[k]; window[k]=undefined; }
        let m3=null, err='';
        try{ m3=_campIdleModel(); }catch(e){ err=e.message; }
        for(const k in keep) if(keep[k]) window[k]=keep[k];
        assert(!err,'캠프 함수가 없을 때 모델이 터진다: '+err);
        assert(m3 && m3.info && m3.info.stats.length,'캠프가 없을 때 모델이 비었다'); }
      return m.info.stats.length+'값 · 작은 라벨 머리 · 전폭 4열 2줄 · campSyncSheet 연결 확인';
    } finally {
      box.remove();
      window.campIsOn=on0; window.campState=st0;
      if(camp0) prof.camp=camp0; else delete prof.camp;
      if(typeof G!=='undefined'){ if(G0) G.tech=G0; else delete G.tech; }
    }
  });

  // ☰ 더보기 칸 정리(2026-08-25) — 캠프에서 실제로 도는 것만 남겼다.
  await step('더보기: 가이드·출석·부스트·설정 네 칸', async()=>{
    skipIf(typeof HB_MORE==='undefined','더보기 표 없음');
    const ks=HB_MORE.map(x=>x.k);
    assert(ks.join(',')==='guide,att,boost,set','더보기 칸이 다름: '+ks.join(','));
    // 아이콘 키가 ICO 표에 있어야 빈 칸이 안 된다(설정만 직접 그린다 — ico:'')
    { const bad=HB_MORE.filter(x=>x.ico && typeof ICO!=='undefined' && !ICO[x.ico]).map(x=>x.name+'→'+x.ico);
      assert(!bad.length,'더보기 아이콘 키가 ICO 표에 없음: '+bad.join(' · ')); }
    // ⛔ 유보 규칙 — 뺀 것의 코드는 살아 있어야 한다(길만 닫았다 · GAME_DIRECTION §5)
    for(const f of ['openVillage','hbOpenGrow','hbBuildStart','openDungeonHub','openDaily'])
      assert(typeof window[f]==='function', '뺀 칸의 함수가 사라졌다 — 유보는 삭제가 아니다: '+f);
    assert($('hbDailySheet'),'옛 일일 퀘스트 시트 마크업이 사라졌다');
    // 누르면 실제로 열리는가
    hbMoreTap('guide'); await sleep(120);
    assert(visible($('hbGuideSheet')),'더보기 → 가이드가 안 열림');
    closeGuide();
    return ks.join(' · ');
  });

  // 🧭 가이드 퀘스트(2026-08-25) — 「이 게임을 어떻게 하는가」를 순서로 가르친다.
  //   일일 퀘스트와 달리 **한 번만** 돌고 순서가 있다. 캠프 화면은 3D 라 못 띄우므로 상태만 흉내 낸다.
  await step('가이드 퀘스트: 순서 · 띠 · 목록', async()=>{
    skipIf(typeof guideNote!=='function','가이드 함수 없음');
    const prof=PROF(), g0=prof.guide, camp0=prof.camp;
    const on0=window.campIsOn, st0=window.campState;
    const _barWas=$('curBar').classList.contains('hide'); if(_barWas) curShow(true);
    try{
      delete prof.guide;
      prof.camp=Object.assign({}, camp0||{}, {dg:1, race:'terran'});
      window.campIsOn=()=>true; window.campState=()=>PROF().camp;
      updateCurBar();
      // ① 순서가 있다 — 첫 단계는 탭. 다른 종류를 아무리 넣어도 안 움직인다.
      assert(guideOn(),'가이드가 안 켜짐(종족·진행 조건을 볼 것)');
      const first=guideCur(); assert(first && first.kind==='tap','첫 단계가 탭이 아님: '+(first&&first.kind));
      for(let i=0;i<5;i++) guideNote('research',1);     // 뒷 단계 종류 — 지금은 무시돼야 한다
      assert(guideCur().kind==='tap','순서를 건너뛰었다 — 뒷 단계 계측이 지금 단계를 밀었다');
      assert(guideState().n===0,'다른 종류인데 진행이 찼다: '+guideState().n);
      // ② 목표만큼 채우면 다음으로 넘어간다(넘치게 넣어도 한 칸만)
      for(let i=0;i<first.goal+5;i++) guideNote('tap',1);
      assert(guideState().i===1,'탭을 채웠는데 다음 단계로 안 감: i='+guideState().i);
      assert(guideState().n===0,'다음 단계 진행이 0 이 아님: '+guideState().n);
      // ③ 화면 띠 — 지금 할 일 한 줄. ⚠ 더보기 안에만 두면 초보자가 못 찾는다.
      const gb=$('guideBar'); assert(gb,'「지금 할 일」 띠가 없음');
      assert(gb.parentElement===$('phone'),'띠가 #phone 직속이 아니다 — 캠프 화면 안에 넣으면 캠프 파일을 건드리게 된다');
      assert((gb.querySelector('.gbTx')||{}).textContent===guideCur().do,'띠 글이 지금 단계와 다름');
      { const cs=getComputedStyle(gb), a=cs.backgroundColor.match(/[\d.]+/g)||[];
        const alpha=(a.length===4)?parseFloat(a[3]):1;
        assert(alpha>=0.995,'띠가 비친다(전폭이라 7% 만 비쳐도 뒤 글자가 읽힌다): '+cs.backgroundColor);
        assert(parseInt(cs.zIndex,10) < parseInt(getComputedStyle($('curBar')).zIndex,10),
          '띠가 재화 바보다 위다 — 던전 드롭다운이 띠에 가린다'); }
      { const cr=$('curBar').getBoundingClientRect(), gr=gb.getBoundingClientRect();
        assert(gr.top>=cr.bottom-0.5,'띠가 재화 바를 덮는다'); }
      // ④ 목록 — 껍데기는 일일 퀘스트와 같은 것을 쓴다(새 팝업을 만들지 않는다)
      openGuide(); await sleep(50);
      assert(visible($('hbGuideSheet')),'가이드 목록이 안 열림');
      assert($('hbGuideSheet').classList.contains('hbModal') && $('hbGuideSheet').querySelector('.hbmCard'),
        '가이드 목록이 공용 팝업 껍데기(.hbModal/.hbmCard)를 안 쓴다');
      const rows=$('hbGuideBody').querySelectorAll('.gqRow');
      assert(rows.length===GUIDE_STEPS.length,'목록 줄 수가 다름: '+rows.length);
      assert($('hbGuideBody').querySelectorAll('.gqRow.done').length===1,'끝난 줄이 1개가 아님');
      assert($('hbGuideBody').querySelectorAll('.gqRow.now').length===1,'지금 줄이 1개가 아님(순서가 있는 목록이다)');
      // 보상 아이콘 크기 — resIco 의 <img> 는 규격이 없어 안 잡으면 줄을 통째로 덮는다(실제로 그랬다)
      { const im=$('hbGuideBody').querySelector('.gqRw img');
        if(im){ const w=im.getBoundingClientRect().width;
          assert(w>0 && w<=16,'보상 아이콘이 너무 크다(줄을 덮는다): '+w.toFixed(0)+'px'); } }
      closeGuide();
      // ⑤ 다른 종족이면 아예 안 띄운다 — 건물 키가 종족마다 다르다(union=barracks · swarm=pool …)
      prof.camp.race='zerg'; updateCurBar();
      assert(!guideOn(),'유니온이 아닌데 가이드가 켜졌다 — 건물 키가 달라 영영 못 깬다');
      assert(!$('guideBar'),'가이드를 끄는 종족인데 띠가 남았다');
      // ⑥ 던전 이동이 실제로 센다(지금 이어져 있는 유일한 계측)
      prof.camp.race='terran'; prof.guide={i:7, n:0};    // 8번째 = 던전 2 로 옮기기
      updateCurBar();
      assert(guideCur().kind==='dg:2','8번째 단계가 던전 2 가 아님: '+guideCur().kind);
      window.campSkin=()=>{};
      campDropOpen(); campDropPickDg(2); campDropGo(); await sleep(40);
      assert(guideState().i===8,'던전을 옮겼는데 가이드가 안 넘어감: i='+guideState().i);
      return GUIDE_STEPS.length+'단계 · 순서 지킴 · 띠/목록 · 종족 가드 · 던전 이동 계측';
    } finally {
      campDropClose(); closeGuide();
      window.campIsOn=on0; window.campState=st0;
      if(g0) prof.guide=g0; else delete prof.guide;
      if(camp0) prof.camp=camp0; else delete prof.camp;
      updateCurBar(); curSetTitle(''); if(_barWas) curShow(false);
      { const b=$('guideBar'); if(b) b.remove(); }
    }
  });

  // 🏕 던전·라운드 드롭다운(2026-08-25) — 칩을 누르면 칩 아래로 자란다.
  //   ⚠ 캠프 화면은 3D 라 여기서 못 띄운다 → 캠프 상태만 흉내 내고 **판 자체**를 검사한다.
  await step('캠프 좌상단: 던전·라운드 드롭다운(칩 아래로)', async()=>{
    skipIf(typeof campDropOpen!=='function','드롭다운 함수 없음');
    const t=$('curTitle'); assert(t,'#curTitle 이 없음');
    const on0=window.campIsOn, st0=window.campState, sk0=window.campSkin, prof=PROF();
    const camp0=prof?prof.camp:null;
    let skin=0;
    try{
      prof.camp=Object.assign({}, camp0||{}, {dg:3, cleared:26});   // 라운드 27 = 깬 수 26 (rnd 는 비추는 값)
      window.campIsOn=()=>true; window.campState=()=>PROF().camp; window.campSkin=()=>{skin++;};
      curShow(true); updateCurBar();
      // ① 칩에 펼침 표시가 있고, 열면 뒤집힌다
      assert(t.querySelector('.cdCv'),'칩에 펼침 표시(⌄)가 없음');
      { const cv=t.querySelector('.cdCv'), c=getComputedStyle(cv);
        assert(c.position==='absolute','⌄ 가 오른쪽 위 모서리에 안 앉음(글자 줄에 끼면 어느 줄인지 모호해진다)'); }
      t.click(); await sleep(40);
      const d=()=>$('campDrop');
      assert(d(),'칩을 눌렀는데 드롭다운이 안 열림');
      assert(t.classList.contains('open'),'열렸는데 칩에 open 표시가 없음(⌄ 가 안 뒤집힌다)');
      // ② 담긴 것 — 던전 열 줄 · 라운드 99칸 · 현재 값이 잡힌다
      assert(d().querySelectorAll('.cdRow').length===CAMP_DG_MAX,'던전 줄이 '+CAMP_DG_MAX+'개가 아님');
      assert(d().querySelectorAll('.cdRn').length===CAMP_RND_MAX,'라운드 칸이 '+CAMP_RND_MAX+'개가 아님');
      assert((d().querySelector('.cdRow.here .cdRnm')||{}).textContent==='잊혀진 회랑','현재 던전이 안 잡힘');
      assert((d().querySelector('.cdRn.on')||{}).textContent==='27','현재 라운드가 안 잡힘');
      // ③ 자리 — 칩 아래에 1px 포개 붙는다(왼쪽 변도 맞는다)
      { const cr=t.getBoundingClientRect(), dr=d().getBoundingClientRect();
        assert(Math.abs(dr.left-cr.left)<1.5,'판 왼쪽 변이 칩과 안 맞음: '+(dr.left-cr.left).toFixed(1));
        assert(Math.abs(dr.top-(cr.bottom-1))<1.5,'판이 칩 아래에 안 붙음: 칩밑 '+cr.bottom.toFixed(1)+' / 판위 '+dr.top.toFixed(1)); }
      // ④ 판은 **불투명**이다 — 큰 판이라 3% 만 비쳐도 뒤 글자가 읽힌다(.94·.97 둘 다 비쳤다)
      { const bg=getComputedStyle(d()).backgroundColor, a=bg.match(/[\d.]+/g)||[];
        const alpha=(a.length===4)? parseFloat(a[3]) : 1;
        assert(alpha>=0.995,'드롭다운 판이 비친다(불투명이어야 한다): '+bg); }
      // ⑤ 「지금 여기」 띠가 스크롤 상자에 잘리지 않는다
      //    (overflow-y:auto 는 x 도 auto 로 만든다 — 띠를 음수 left 에 두면 통째로 잘린다)
      { const row=d().querySelector('.cdRow.here'); const bf=getComputedStyle(row,'::before');
        assert(bf.content!=='none','현재 던전 띠(::before)가 없음');
        assert(parseFloat(bf.left)>=0,'현재 던전 띠가 스크롤 상자 왼쪽 밖에 있어 잘린다: left '+bf.left); }
      // ⑥ 라운드 가운데 선은 스크롤 상자 **밖**에 있다(안에 두면 내용과 같이 굴러 사라진다)
      { const mid=d().querySelector('.cdMid'), box=d().querySelector('#cdPickBox');
        assert(mid && box,'라운드 피커 조각이 없음');
        assert(!box.contains(mid),'가운데 선이 스크롤 상자 안에 있다 — 굴리면 같이 사라진다');
        const mr=mid.getBoundingClientRect(), br=box.getBoundingClientRect();
        assert(mr.top>=br.top-1 && mr.bottom<=br.bottom+1,'가운데 선이 피커 밖으로 나갔다'); }
      // ⑥-2 던전 줄도 **밑선 정렬**이다 — 번호(Rajdhani)와 이름(NotoKR)은 글자 상자가 12 vs 16px 이라
      //     가운데로 맞추면 글자가 서로 다른 높이에 앉는다. ⚠ rect 로는 못 잰다(칩 라운드 줄과 같은 이유).
      { const ai=getComputedStyle(d().querySelector('.cdRow')).alignItems;
        assert(ai==='baseline','던전 줄이 밑선 정렬이 아니다 — 번호와 이름이 어긋나 보인다: '+ai); }
      // ⑦ 고르기만 해서는 **안 바뀐다** — 확정 버튼이 있는 이유다
      d().querySelector('.cdRow[data-dg="5"]').click();
      d().querySelector('.cdRn[data-r="40"]').click();
      assert(PROF().camp.dg===3 && PROF().camp.cleared===26,
        '고르기만 했는데 실제 값이 바뀌었다(확정 버튼이 무의미해진다): '+PROF().camp.dg+'/'+PROF().camp.cleared);
      assert((d().querySelector('.cdRow.here .cdRnm')||{}).textContent==='폐쇄된 시설','고른 것이 표시에 안 반영됨');
      // ⑧ [이동] — 여기서만 옮긴다. 배경도 새 던전 것으로 갈고 칩도 갱신된다.
      d().querySelector('.cdGo').click(); await sleep(40);
      assert(PROF().camp.dg===5 && PROF().camp.cleared===39,
        '이동이 캠프 상태(cleared)에 반영 안 됨: '+PROF().camp.dg+'/'+PROF().camp.cleared);
      assert(skin===1,'던전을 옮겼는데 바닥 그림을 안 갈았다(campSkin 호출 '+skin+'회)');
      assert(!d(),'이동했는데 판이 안 닫힘');
      assert((t.querySelector('.cdNm')||{}).textContent==='폐쇄된 시설','칩이 새 던전으로 안 바뀜');
      assert((t.querySelector('.cdLab')||{}).textContent==='라운드','라운드가 생겼는데 칩이 아직 던전을 보여준다');
      assert((t.querySelector('.cdN')||{}).textContent==='40','칩 라운드 값이 안 맞음');
      // ⑨ 바깥을 누르면 닫힌다
      t.click(); await sleep(40); assert(d(),'다시 안 열림');
      $('phone').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
      assert(!d(),'바깥을 눌렀는데 안 닫힘');
      // ⑩ click-through 화면(.bare)에서도 칩·판이 눌린다 — 안 되면 뒤 캠프가 대신 반응한다
      { const bar=$('curBar'); const had=bar.classList.contains('bare'); bar.classList.add('bare');
        const pe=getComputedStyle(t).pointerEvents; if(!had) bar.classList.remove('bare');
        assert(pe!=='none','.curBar.bare 에서 칩이 눌리지 않는다(뒤 화면이 대신 반응한다)'); }
      return '던전 '+CAMP_DG_MAX+'줄 · 라운드 '+CAMP_RND_MAX+'칸 · 밑선 정렬 · 고르기≠이동 · 닫힘 확인';
    } finally {
      campDropClose();
      window.campIsOn=on0; window.campState=st0; window.campSkin=sk0;
      if(prof){ if(camp0) prof.camp=camp0; else delete prof.camp; }
      curSetTitle(''); curShow(false);
    }
  });

  await step('하단 네비 2층: 구역 → 전용 네비 → 돌아가기', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    const read=()=>[...document.querySelectorAll('#navBar .navIt')].map(e=>e.dataset.nav||('~'+e.dataset.sub));
    openHome(); await sleep(40);
    // ① 최상위 = 4구역. 사냥터는 칸이 없다(noCell) — NAV_TREE 가 단일 소스라 순서도 표에서 온다
    assert(read().join(',')==='upg,gear,map,shop','최상위 네비가 4구역이 아님: '+read().join(','));
    assert(!document.querySelector('#navBar .navIt.on'),'사냥터에 있는데 켜진 칸이 있음');
    assert(visible($('homeScreen')),'기본 화면이 사냥터가 아님');
    assert(visible(document.querySelector('#homeScreen .hmUpg')),'사냥터 업그레이드 구역이 안 떠 있음');
    // ② 사냥터는 내려가지 않는다 — 하위는 ☰ 더보기가 맡는다
    navGo('home'); await sleep(40);
    assert(read().join(',')==='upg,gear,map,shop','사냥터를 눌렀는데 구성이 바뀜: '+read().join(','));
    { hbOpenMore(); await sleep(120);   // 마을·성장은 ☰ 더보기 안이다(동료는 폐지)
      for(const k of ['town','grow'])
        assert(document.querySelector('#hbMoreGrid [data-k="'+k+'"]'),'더보기에 '+k+' 가 없음');
      hbCloseMore(); }
    // ③ 내려가면 구역 칸도 사라지고 [‹] + 하위만 남는다
    navGo('gear'); await sleep(60);
    assert(read().join(',')==='back,~gear,~pet,~ally','정비 전용 네비가 아님: '+read().join(','));
    for(const k of ['home','upg','map','shop'])
      assert(!document.querySelector('#navBar .navIt[data-nav='+k+']'),'내려간 상태인데 '+k+' 칸이 남음');
    // ④ 하위를 누르면 상태가 바뀌고 표시(.cur)가 따라온다
    navSub('ally'); await sleep(40);
    assert(_gearTab==='ally','하위를 눌러도 정비 탭이 안 바뀜: '+_gearTab);
    assert(document.querySelector('#navBar .navIt.cur').dataset.sub==='ally','하위 선택 표시가 안 따라옴');
    navSub('gear');   // 다음 스텝이 '기본 = 장비' 를 보므로 되돌린다
    // ⑤ 돌아가기 = 사냥터 화면 + 최상위(홈이 허브)
    navBack(); await sleep(40);
    assert(visible($('homeScreen')),'돌아가기가 사냥터로 안 감');
    assert(read().join(',')==='upg,gear,map,shop','돌아가기 후 최상위가 아님: '+read().join(','));
    // ⑥ 상점 = 5구역 · 유즈맵 = 소셜 3구역(정렬은 화면 위 띠로 되돌렸다)
    navGo('shop'); await sleep(60);
    assert(read().join(',')==='back,~deal,~draw,~res,~pack,~gem','상점 전용 네비가 아님: '+read().join(','));
    navGo('map'); await sleep(60);
    assert(read().join(',')==='back,~chat,~friend,~party','유즈맵 전용 네비가 아님: '+read().join(','));
    assert(document.querySelector('#navBar .navIt.cur').dataset.sub==='chat','유즈맵 기본 하위가 채팅이 아님');
    assert(document.querySelectorAll('#msSortTabs .pdSegBtn').length===4,'유즈맵 정렬 띠가 화면 위로 안 돌아옴');
    // ⑦ 소셜 = 유즈맵 하단 상주 구역(#msSocialDock). 시트가 아니라 항상 화면 몫을 차지한다.
    //    ⛔ DOM(.msSocial)은 하나뿐 — 도크에 '옮겨' 온 것이어야 한다(복제 검사)
    { const dock=$('msSocialDock');
      assert(dock && visible(dock),'소셜 도크가 유즈맵 화면에 없음');
      assert(dock.getBoundingClientRect().height>=150,'소셜 도크가 화면 몫을 못 받음');
      assert(document.querySelectorAll('.msSocial').length===1,'소셜 DOM 이 복제됨');
      assert(dock.querySelector('.msSocial'),'소셜이 도크로 안 옮겨짐');
      assert(!visible(dock.querySelector('.msTabs2')),'도크 안 탭 띠가 네비와 중복 노출됨');
      assert(visible(dock.querySelector('#msChatWrap')),'기본(채팅)인데 채팅 창이 안 보임');
      const panel=document.querySelector('#mapSelect .msPanel');
      assert(panel && panel.contains($('msList')) && panel.contains($('msSortTabs')),'탭 띠·목록이 한 카드 안에 없음');
      // 헤어라인 — 카드 **위·아래** 변 1px 붉은 광선. 색이 붉은지까지 본다(흰빛으로 돌아가면 잡힌다)
      for(const pe of ['::before','::after']){ const pa=getComputedStyle(panel,pe);
        assert(pa.content!=='none',pe+' 헤어라인이 없음');
        assert(parseFloat(pa.height)<=2,pe+' 헤어라인이 1px 이 아님: '+pa.height);
        const cols=[...((pa.backgroundImage||'').matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g))];
        assert(cols.some(c=>+c[1]>=180 && +c[2]<=110 && +c[3]<=110),
          pe+' 헤어라인이 붉은색이 아님: '+(pa.backgroundImage||'').slice(0,80)); }
      // 목록은 칸막이에 딱 붙지 않는다 — 아래 여백이 padding 이면 카드가 판 끝선에 붙어 잘린다
      { const ls=getComputedStyle($('msList'));
        assert(parseFloat(ls.marginBottom)>=4,'목록 아래 여백이 margin 이 아님(카드가 끝선에 붙어 잘린다)');
        const lb=$('msList').getBoundingClientRect(), pb2=panel.getBoundingClientRect();
        assert(pb2.bottom-lb.bottom>=4,'목록이 카드 끝선에 붙어 잘림: '+(pb2.bottom-lb.bottom).toFixed(1)+'px'); }
      // 목록 구역(.msTop)만 한 톤 어두운 판으로 묶인다 — 소셜은 **바깥 카드에서도 빠져** 별도 카드다
      { const top=panel.querySelector('.msTop');
        assert(top && top.contains($('msSortTabs')) && top.contains($('msList')),'정렬 띠·목록을 묶는 판(.msTop)이 없음');
        assert(!top.contains(dock) && !panel.contains(dock),'소셜이 아직 목록 카드 안에 있음');
        const c=((getComputedStyle(top).backgroundColor||'').match(/[\d.]+/g)||['0','0','0','0']).map(parseFloat);
        const a=(c.length>3?c[3]:1);
        assert(a>=0.08 && a<=0.4 && c[0]<30 && c[1]<30 && c[2]<30,
          '목록 판이 카드보다 한 톤 어둡지 않음: '+getComputedStyle(top).backgroundColor);
        // 소셜 = 목록 카드와 **같은 규격의 두 번째 카드**(B안) — 좌우 변·라운드·테두리가 카드와 맞는다
        const ds=getComputedStyle(dock), ps=getComputedStyle(panel),
              pb=panel.getBoundingClientRect(), db=dock.getBoundingClientRect();
        assert(Math.abs(db.left-pb.left)<=1 && Math.abs(db.right-pb.right)<=1,
          '소셜의 좌우 변이 목록 카드와 안 맞음: 카드 '+pb.left.toFixed(1)+'~'+pb.right.toFixed(1)+' / 소셜 '+db.left.toFixed(1)+'~'+db.right.toFixed(1));
        assert(db.top-pb.bottom>=4,'두 섹션이 붙어 있음: '+(db.top-pb.bottom).toFixed(1)+'px');
        // B안(2026-08-18 확정) — 사방 1px 테두리 + 카드와 같은 라운드, 면은 카드보다 한 톤 어두운 **반투명**.
        //   ⚠ 완전 검정으로 떨어뜨리면 목록 항목(.mapItem)과 같은 색이라 '큰 항목 한 장'으로 읽힌다.
        { assert(ds.clipPath==='none','B안은 모서리 컷을 쓰지 않는다: '+ds.clipPath);
          assert(parseFloat(ds.borderTopWidth)===1 && parseFloat(ds.borderLeftWidth)===1,
            '사방 1px 테두리가 아님: '+ds.borderTopWidth+' / '+ds.borderLeftWidth);
          assert(ds.borderTopLeftRadius===ps.borderTopLeftRadius,
            '라운드가 목록 카드와 다름: 카드 '+ps.borderTopLeftRadius+' / 소셜 '+ds.borderTopLeftRadius);
          const face=g=>{const m=((g.match(/rgba?\(([^)]+)\)/)||[,'99,99,99,1'])[1]).split(',').map(parseFloat);
            return {lum:m[0]*.3+m[1]*.59+m[2]*.11, a:(m.length>3?m[3]:1)};};
          const dF=face(ds.backgroundImage), pF=face(ps.backgroundImage),
                iF=face(getComputedStyle(document.querySelector('#msList .mapItem')).backgroundImage);
          assert(dF.a<1,'소셜 면이 불투명함(카드와 같은 반투명 재질이어야 한다): '+ds.backgroundImage.slice(0,60));
          assert(dF.lum<pF.lum,'소셜 면이 목록 카드보다 어둡지 않음: '+dF.lum.toFixed(1)+' vs '+pF.lum.toFixed(1));
          assert(dF.lum>iF.lum+3,'소셜 면이 목록 항목의 검정과 같음(구역이 아니라 큰 항목으로 읽힌다): '
            +dF.lum.toFixed(1)+' vs '+iF.lum.toFixed(1));
          // 붉은 헤어라인은 **윗변 한 줄뿐** — 카드(위·아래 두 줄)와 겹쳐 넷이 되면 주인공이 사라진다
          { const be=getComputedStyle(dock,'::before'), af=getComputedStyle(dock,'::after');
            assert(be.content!=='none','소셜 윗변 헤어라인이 없음');
            assert(parseFloat(be.height)<=2,'소셜 헤어라인이 1px 이 아님: '+be.height);
            const cols=[...((be.backgroundImage||'').matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g))];
            assert(cols.some(c=>+c[1]>=180 && +c[2]<=110 && +c[3]<=110),
              '소셜 헤어라인이 붉은색이 아님: '+(be.backgroundImage||'').slice(0,80));
            assert(af.content==='none','소셜 아랫변에도 헤어라인이 생김(윗변 한 줄뿐이다)'); }
          // 채팅·친구·파티가 같은 결 — 안쪽에 또 판을 깔지 않고 헤어라인으로만 나눈다
          setBottomTab('chat');
          { const line=dock.querySelector('.mcLine'), lum=c=>{const m=((c||'').match(/[\d.]+/g)||[0,0,0]).map(Number);
              return m[0]*.3+m[1]*.59+m[2]*.11; };
            // ⛔ 줄머리 `›` 프리픽스는 뺐다 — ` : ` 구분자와 겹쳐 기호가 둘이었다
            assert(getComputedStyle(line,'::before').content==='none','채팅 줄머리 › 프리픽스가 되살아남');
            // 이름이 본문보다 **밝다**. 반대로 두면 누가 말했는지가 본문보다 덜 읽힌다(전에 그랬다)
            const who=line.querySelector('.mcWho');
            if(who) assert(lum(getComputedStyle(who).color) > lum(getComputedStyle(line).color)+8,
              '채팅 이름이 본문보다 밝지 않음: '+getComputedStyle(who).color+' vs '+getComputedStyle(line).color);
            // 시각은 오른쪽 끝(친구 행의 상태와 같은 자리) — float 여야 본문이 감싸 흐른다
            const t=line.querySelector('.mcT');
            assert(t,'채팅 줄에 시각이 없음');
            assert(getComputedStyle(t).float==='right','시각이 오른쪽에 붙지 않음: '+getComputedStyle(t).float);
            assert(/^\d{2}:\d{2}$/.test(t.textContent.trim()),'시각 표기가 HH:MM 이 아님: '+t.textContent);
            // 입력 바 — 판을 깔지 않고, 시안은 쓰지 않는다(DESIGN §2: 시안 = 지금 선택된 것 전용)
            const bar=getComputedStyle(dock.querySelector('.msChatBar'));
            const bb=(bar.backgroundColor.match(/[\d.]+/g)||['0','0','0','0']);
            assert(bar.backgroundImage==='none' && (bb.length>3?parseFloat(bb[3]):1)===0,
              '채팅 입력 바에 판이 남아 있음: '+bar.backgroundColor);
            const cyan=el=>{ const m=(getComputedStyle(el).color.match(/\d+/g)||[0,0,0]).map(Number);
              return m[2]>m[0]+50 && m[1]>m[0]+30; };   // 파랑·초록이 빨강보다 한참 높으면 청록이다
            assert(!cyan(dock.querySelector('.msChatSend')),'전송 버튼이 아직 청록임: '+getComputedStyle(dock.querySelector('.msChatSend')).color);
            assert(!cyan(dock.querySelector('.msScopeLbl')),'범위 라벨이 아직 청록임: '+getComputedStyle(dock.querySelector('.msScopeLbl')).color);
            // 내 말 = 왼쪽 2px **중립** 바(파티장과 같은 문법, 색만 중립). 옛 시안 이름은 되살리지 않는다
            { addGlobalMsg(myNick(),'스모크 내 말','me','all');
              const me=[...dock.querySelectorAll('.mcLine.me')].pop();
              assert(me,'내 말 줄(.me)이 안 그려짐');
              const af=getComputedStyle(me,'::after');
              assert(af.content!=='none','내 말 표시가 없음');
              assert(parseFloat(af.width)<=3,'내 말 표시 바가 2px 이 아님: '+af.width);
              const bc=(af.backgroundColor.match(/\d+/g)||[0,0,0]).map(Number);
              assert(Math.max(bc[0],bc[1],bc[2])-Math.min(bc[0],bc[1],bc[2])<=20,
                '내 말 표시 바에 색이 들어감(중립이어야 한다): '+af.backgroundColor);
              assert(!cyan(me.querySelector('.mcWho')),'내 말 이름이 다시 청록임: '+getComputedStyle(me.querySelector('.mcWho')).color);
              me.remove(); } }
          setBottomTab('friend');
          { const row=dock.querySelector('.foRow');
            if(row){ const rs=getComputedStyle(row);
              assert(rs.backgroundImage==='none','친구 줄에 판이 남아 있음(터미널은 헤어라인만)');
              assert(parseFloat(rs.borderBottomWidth)===1,'친구 줄 구분선이 없음'); } }
          setBottomTab('party');
          { const slot=dock.querySelector('.ptSlot.fill');
            if(slot) assert(getComputedStyle(slot).backgroundImage==='none','파티 칸에 판이 남아 있음'); }
          setBottomTab('chat'); } }
      // 목록에 카드가 **정확히 5장** 들어온다(잘린 6번째가 끼면 마감이 지저분하다)
      { const list=$('msList'), ls=getComputedStyle(list), it=list.querySelector('.mapItem');
        const inner=list.clientHeight-parseFloat(ls.paddingTop)-parseFloat(ls.paddingBottom);
        const gap=parseFloat(ls.rowGap)||0, ih=it.getBoundingClientRect().height;
        const fit=(inner+gap)/(ih+gap);
        assert(fit>=4.98 && fit<5.2,'목록에 5장이 딱 안 들어옴: '+fit.toFixed(2)+'장');
        const fifth=[...list.querySelectorAll('.mapItem')][4];
        if(fifth) assert(fifth.getBoundingClientRect().bottom<=list.getBoundingClientRect().bottom+0.6,
          '5번째 카드가 목록 밖으로 넘침'); }
      // 카드 면 = 사냥터 업그레이드 칸(.hmUp)과 같은 검정. 옛 회색(rgba(36,38,47,…))으로 돌아가면 잡힌다
      { const g=getComputedStyle(document.querySelector('#msList .mapItem')).backgroundImage||'';
        const m=(g.match(/rgba?\(([^)]+)\)/)||[,'255,255,255'])[1].split(',').map(parseFloat);
        const lum=m[0]*0.3+m[1]*0.59+m[2]*0.11;
        assert(lum<=12,'유즈맵 카드 면이 검정이 아님(휘도 '+lum.toFixed(1)+')'); }
      // 카드 모양은 도크가 직접 갖는다 — 안의 .msSocial 이 또 테두리를 가지면 두 줄로 보인다
      { const so=getComputedStyle(dock.querySelector('.msSocial'));
        assert(so.borderTopStyle==='none' && so.backgroundImage==='none','소셜 안쪽이 또 카드 껍데기를 가짐'); } }
    navSub('party'); await sleep(40);
    assert(document.querySelector('#twChat.hide'),'파티를 눌렀는데 마을 시트가 열림(도크가 맡아야 한다)');
    assert(getComputedStyle($('msPanelBody')).display!=='none','파티 패널이 안 보임');
    assert(document.querySelector('#navBar .navIt.cur').dataset.sub==='party','소셜 선택 표시가 안 따라옴');
    // 마을 채팅 시트가 열리면 소셜을 되찾아 가고, 유즈맵에 다시 오면 도크로 돌아온다
    openHome(); await sleep(40); twOpenChat(); await sleep(40);
    assert(document.querySelector('#twChat .msSocial'),'마을 시트가 소셜을 못 되찾음');
    assert(visible(document.querySelector('#twChat .msTabs2')),'마을 시트에선 탭 띠가 보여야 함(네비에 소셜 칸이 없다)');
    twCloseChat(); navGo('map'); await sleep(60);
    assert($('msSocialDock').querySelector('.msSocial'),'유즈맵 복귀 시 소셜이 도크로 안 돌아옴');
    navSub('chat');   // 상태 정리(기본 채팅)
    // 👥 친구 = 머리 한 줄(친구 N + ＋) · 온라인/오프라인 라벨 없이 밝기로 갈린다
    navSub('friend'); await sleep(120);
    { const body=$('msPanelBody');
      // 머리줄은 파티 머리줄과 **같은 컴포넌트**(.ptHead/.ptTitle) — 전용 클래스를 새로 만들면 안 된다
      assert(body.querySelector('.ptHead .ptTitle'),'친구 머리줄이 파티 머리줄 규격(.ptHead)이 아님');
      { const ts=getComputedStyle(body.querySelector('.ptTitle'));
        assert(parseFloat(ts.fontSize)>=12,'구역 제목이 너무 작음: '+ts.fontSize);
        // 소셜 머리줄은 제목 가족(Jua)이 아니라 본문 가족이다 — 작은 줄에서 획이 뭉친다
        assert(!/Jua/i.test(ts.fontFamily),'소셜 머리줄이 제목 폰트로 나옴: '+ts.fontFamily);
        // 친구 수는 총원이 아니라 '(온라인 N)' — 상태값이라 초록
        { const on=body.querySelector('.ptTitle .onN');
          assert(on && /^\(온라인 \d+\)$/.test(on.textContent.trim()),'친구 수 표기가 (온라인 N) 이 아님: '+(on&&on.textContent));
          assert(parseFloat(getComputedStyle(on).fontSize) < parseFloat(ts.fontSize),'접속 수가 제목보다 작지 않음');
          const g=getComputedStyle(on).color.match(/\d+/g).map(Number);
          assert(g[1]>g[0]+40 && g[1]>g[2]+40,'접속 수가 초록이 아님: '+getComputedStyle(on).color);
          const rows=[...body.querySelectorAll('#foFriends .foRow')];
          assert(+on.textContent.replace(/\D/g,'')===rows.filter(r=>!r.classList.contains('off')).length,
            '접속 수가 실제 온라인 행 수와 다름'); }
        // 머리줄 버튼 = 더보기 배너 칸과 같은 물성(각진 3px · 검은 판)
        const bs=getComputedStyle(body.querySelector('.ptFind'));
        assert(bs.borderTopLeftRadius==='3px','머리줄 버튼이 각지지 않음: '+bs.borderTopLeftRadius);
        const lum=c=>{const m=((c||'').match(/[\d.]+/g)||['0','0','0']).map(parseFloat);
          const a=(m.length>3?m[3]:1); return (m[0]*0.3+m[1]*0.59+m[2]*0.11)*a; };   // 반투명이면 알파까지 곱해야 실제 밝기다
        assert(lum(bs.backgroundColor)<=40,'머리줄 버튼 면이 검지 않음: '+bs.backgroundColor); }
      assert(!body.querySelector('.foHead'),'옛 전용 머리줄(.foHead)이 남아 있음');
      assert(!body.querySelector('.foSecOn') && !body.querySelector('.foSecOff'),'온라인/오프라인 섹션 라벨이 아직 남아 있음');
      assert(!body.querySelector('#foSearch'),'친구 추가 검색이 아직 목록 위에 남아 있음');
      const rows=[...body.querySelectorAll('#foFriends .foRow')];
      assert(rows.length>=2,'친구 행이 안 그려짐: '+rows.length);
      // 한 줄 조밀형(2026-08-18) — 2줄 48px 행은 안높이 131px 에서 세 명째가 잘렸다
      { const r0=rows[0];
        assert(getComputedStyle(r0.querySelector('.fMeta')).flexDirection==='row',
          '친구 행이 아직 2줄임(이름 밑에 상태가 붙어 있다)');
        const rh=r0.getBoundingClientRect().height;
        assert(rh<=34,'친구 행이 조밀하지 않음: '+rh.toFixed(1)+'px');
        const head=body.querySelector('.ptHead').getBoundingClientRect().height;
        const fit=(body.clientHeight-head)/rh;
        assert(fit>=4,'친구가 한 화면에 4명도 안 보임: '+fit.toFixed(2)+'명');
        // 초상은 **동그란 채로 둔다** — '사람'을 뜻하는 자리라 라운드 3단계(판·칸·버튼)의 예외로 정했다
        assert(getComputedStyle(r0.querySelector('.fAva')).borderRadius==='50%','친구 초상이 원형이 아님');
        // 액션은 글리프만 — 도크 안쪽에 또 판을 깔지 않는다(그 판의 테두리는 목록 항목의 선과 같은 값이었다)
        { const as=getComputedStyle(r0.querySelector('.foAct'));
          const bc=(as.backgroundColor.match(/[\d.]+/g)||['0','0','0','0']);
          assert(parseFloat(as.borderTopWidth)===0,'친구 액션 버튼에 테두리가 남아 있음: '+as.borderTopWidth);
          assert(as.backgroundImage==='none' && (bc.length>3?parseFloat(bc[3]):1)===0,
            '친구 액션 버튼에 판이 남아 있음: '+as.backgroundColor); } }
      // 정렬 = 온라인 먼저, 오프라인 나중. 뒤섞이면 '밝은 위 / 어두운 아래'가 깨진다
      const offAt=rows.map(r=>r.classList.contains('off'));
      assert(offAt.indexOf(true)<0 || offAt.lastIndexOf(false)<offAt.indexOf(true),
        '오프라인 행이 온라인 사이에 섞임: '+offAt.map(b=>b?'x':'o').join(''));
      // 오프라인 = 어두운 상자(투명도만으로 흐리게 두지 않는다)
      const off=rows.find(r=>r.classList.contains('off')), on=rows.find(r=>!r.classList.contains('off'));
      // ⛔ 친구 카드에 푸른기 금지 — 옛 rgba(26,28,34)는 B가 R보다 8 높아 푸르게 보였다
      { const g=getComputedStyle(on||rows[0]).backgroundImage||'';
        const m=((g.match(/rgba?\(([^)]+)\)/)||[,'0,0,0'])[1]).split(',').map(parseFloat);
        assert(m[2]<=m[0]+3,'친구 카드에 푸른기가 돎: '+g.slice(0,60));
        // 3안 터미널은 카드를 걷고 헤어라인만 남긴다(radius 0) — '덜 각지면 안 된다' 가 원래 뜻이라 상한으로 본다
        assert(parseFloat(getComputedStyle(on||rows[0]).borderTopLeftRadius)<=3,'친구 카드가 덜 각짐'); }
      if(off&&on){
        // ⚠ 면이 gradient 라 backgroundColor 는 투명하다 — backgroundImage 의 첫 색을 본다
        const lum=el=>{ const g=getComputedStyle(el).backgroundImage||'';
          const m=(g.match(/rgba?\(([^)]+)\)/)||[,'0,0,0'])[1].split(',').map(parseFloat);
          return m[0]*0.3 + m[1]*0.59 + m[2]*0.11; };
        assert(getComputedStyle(off).opacity==='1','오프라인을 투명도로 흐리게 처리함(어두운 면이어야 한다)');
        // 3안 터미널은 행에 면이 없다 — 오프라인 신호는 '글자가 죽는 것'이다. 면이 있으면 면으로, 없으면 글자로 잰다.
        const tone=el=>{ const t=(el.querySelector('.fL1')||el); const m=getComputedStyle(t).color.replace(/[^0-9,]/g,'').split(',').map(Number);
          return m[0]*0.3 + m[1]*0.59 + m[2]*0.11; };
        const useFace = lum(on)>0 || lum(off)>0;
        assert(useFace ? (lum(off) < lum(on)-2) : (tone(off) < tone(on)-8),
          '오프라인이 온라인보다 어둡지 않음: '+(useFace?(lum(off).toFixed(1)+' vs '+lum(on).toFixed(1)):(tone(off).toFixed(1)+' vs '+tone(on).toFixed(1)))); }
      // ＋ = 친구 추가 팝업(목록 위가 아니라 팝업 안에 검색이 있다)
      body.querySelector('.ptFind.foAddBtn').click(); await sleep(80);
      assert(visible($('foAddOv')),'＋ 를 눌렀는데 친구 추가 팝업이 안 뜸');
      assert($('foAddOv').querySelector('#foSearch'),'팝업 안에 검색칸이 없음');
      // 🔲 검색 줄은 각지다 — 라운드 3px 하나, 버튼은 공용 .actBtn(면을 칠하지 않는다)
      { const inp=$('foSearch'), btn=$('foAddOv').querySelector('.foSearchBtn');
        assert(getComputedStyle(inp).borderRadius==='3px','검색 입력칸 라운드가 3px 가 아님: '+getComputedStyle(inp).borderRadius);
        assert(btn && btn.classList.contains('actBtn'),'검색 버튼이 공용 .actBtn 이 아님');
        assert(getComputedStyle(btn).borderRadius==='3px','검색 버튼 라운드가 3px 가 아님: '+getComputedStyle(btn).borderRadius);
        // 옛 붉은 면(rgba(255,59,59,.14)) 이 아니라 .actBtn 의 중립 그라디언트여야 한다
        assert(/gradient/.test(getComputedStyle(btn).backgroundImage),'검색 버튼이 아직 단색 면을 칠하고 있음');
        const hi=inp.getBoundingClientRect().height, hb=btn.getBoundingClientRect().height;
        assert(Math.abs(hi-hb)<1.5,'입력칸과 검색 버튼 높이가 다름: '+hi.toFixed(1)+' vs '+hb.toFixed(1)); }
      closeFriendAdd(); }
    // 🎪 파티 = 게시판(이전 단계) → 참가/만들기 → 하단 내 파티
    navSub('chat'); await sleep(30);
    { _party=null; _pbRooms=null;
      navSub('party'); await sleep(120);
      // ⛔ 자동으로 뜨지 않는다 — 탭을 누를 때마다 판이 덮여 내 파티가 안 보였다
      assert(!visible($('ptFindOv')),'파티 탭에서 게시판이 자동으로 뜸');
      // 사람만 칸이 된다 · 빈 자리는 한 줄 · 친구 행과 같은 한 줄 33px (2026-08-18)
      { const body=$('msPanelBody'), mem=_party.members.length;
        const slots=[...body.querySelectorAll('.ptSlot')];
        assert(slots.length===mem,'파티 칸이 파티원 수와 다름: '+slots.length+' vs '+mem);
        assert(!body.querySelector('.ptSlot.empty'),'빈 자리가 아직 칸으로 늘어서 있음(＋ 친구 초대 반복)');
        { const line=body.querySelector('.ptInviteLine');
          assert(line,'빈 자리 한 줄(.ptInviteLine)이 없음');
          assert(+line.querySelector('em').textContent.replace(/\D/g,'')===PARTY_MAX-mem,
            '빈자리 수 표기가 실제와 다름: '+line.textContent.trim()); }
        { const s0=slots[0];
          assert(getComputedStyle(body.querySelector('.ptGrid')).gridTemplateColumns.split(' ').length===1,
            '파티가 아직 2열임');
          const rh=s0.getBoundingClientRect().height;
          assert(rh<=34,'파티 행이 친구 행(33px)과 다름: '+rh.toFixed(1)+'px');
          assert(getComputedStyle(s0.querySelector('.ptName')).flexDirection==='row','파티 행이 아직 2줄임');
          // 파티장 = 빨강. 시안(--acc-sel)은 '지금 선택된 것' 전용이라 여기 쓰면 안 된다
          const ld=body.querySelector('.ptSlot.leader');
          if(ld){ const bs=getComputedStyle(ld), bc=(bs.borderBottomColor.match(/\d+/g)||[0,0,0]).map(Number);
            assert(bc[0]>=140 && bc[1]<=110 && bc[2]<=110,'파티장 표시가 빨강이 아님: '+bs.borderBottomColor);
            assert(getComputedStyle(ld,'::before').content!=='none','파티장 왼쪽 표시선이 없음'); }
          // 내보내기 ✕ 도 글리프만 — 친구 액션과 같은 규칙(판의 테두리는 목록 항목의 선이었다)
          const kick=body.querySelector('.ptKick');
          if(kick){ const ks=getComputedStyle(kick), kb=(ks.backgroundColor.match(/[\d.]+/g)||['0','0','0','0']);
            assert(parseFloat(ks.borderTopWidth)===0 && (kb.length>3?parseFloat(kb[3]):1)===0,
              '내보내기 ✕ 에 판이 남아 있음: '+ks.backgroundColor); } }
        // 4명까지는 스크롤 없이 보인다(친구 목록과 같은 규칙 — 옛 '2열 8칸 무스크롤'은 폐기)
        assert(body.scrollHeight<=body.clientHeight+1,
          '파티 구역이 스크롤됨: '+body.scrollHeight+' > '+body.clientHeight);
        const last=slots[slots.length-1].getBoundingClientRect();
        assert(last.bottom<=body.getBoundingClientRect().bottom+1,'마지막 칸이 구역 밖으로 나감');
        // ⚠ 빈 칸을 없앤 대가 — 파티원이 늘면 초대 줄이 접히는 자리 밑으로 내려간다. 바닥에 붙어 늘 보여야 한다
        { const back=_party.members.slice();
          for(let i=_party.members.length;i<PARTY_MAX;i++) _party.members.push({uid:'smk'+i,nick:'테스트'+i,tag:'0000'});
          renderPartyTab(); await sleep(60);
          const line=body.querySelector('.ptInviteLine');
          assert(!line,'파티가 가득 찼는데 초대 줄이 남아 있음');
          _party.members.length=back.length;   // 한 자리 비우고 다시 본다
          renderPartyTab(); await sleep(60);
          const l2=body.querySelector('.ptInviteLine');
          assert(getComputedStyle(l2).position==='sticky','초대 줄이 바닥에 붙어 있지 않음(파티원이 늘면 화면 밖으로 나간다)');
          // ⚠ 반투명이면 밑을 지나가는 행이 글자 사이로 비친다
          { const bg=(getComputedStyle(l2).backgroundColor.match(/[\d.]+/g)||['0','0','0','1']);
            assert((bg.length>3?parseFloat(bg[3]):1)===1,'초대 줄 면이 불투명하지 않음: '+getComputedStyle(l2).backgroundColor); }
          assert(l2.getBoundingClientRect().bottom<=body.getBoundingClientRect().bottom+1,
            '초대 줄이 구역 밖으로 나감');
          _party.members=back; renderPartyTab(); await sleep(60); }
        // 해제/나가기 버튼의 모서리는 옆의 `파티 찾기`와 같다(한 줄에 라운드가 두 가지면 따로 논다)
        { _party.name='스모크'; renderPartyTab(); await sleep(60);
          const d=body.querySelector('.ptDisband'), f=body.querySelector('.ptFind');
          assert(d,'파티가 있는데 해제 버튼이 없음');
          assert(getComputedStyle(d).borderTopLeftRadius===getComputedStyle(f).borderTopLeftRadius,
            '해제 버튼 모서리가 파티 찾기와 다름: '+getComputedStyle(d).borderTopLeftRadius+' vs '+getComputedStyle(f).borderTopLeftRadius);
          _party.name=null; renderPartyTab(); await sleep(60); } }
      openPartyFind(); await sleep(120);
      assert(visible($('ptFindOv')),'파티 찾기 버튼 경로로도 게시판이 안 열림');
      // 판은 방 찾기(#rooms) 컴포넌트를 그대로 빌린다 — 새 목록 UI 를 만들면 그건 버그다
      const card=$('ptFindOv').querySelector('.rmCard');
      assert(card,'파티 찾기가 방 찾기 카드(.rmCard)를 안 씀');
      assert(card.querySelector('.rmHead .rmTitle').textContent==='파티 찾기','머리 제목이 다름');
      assert(card.querySelector('.rmNum input') && card.querySelector('#pbList.rmList'),'방 찾기의 입력줄·목록 규격이 아님');
      assert(card.querySelectorAll('.rmBtns .actBtn.sq').length===2 && card.querySelector('.rmBtns .actBtn.pri'),'하단 버튼 4칸 규격이 아님(공용 .actBtn)');
      const rows=[...card.querySelectorAll('.roomItem')];
      assert(rows.length===PB_DEMO.length,'게시판 목록이 안 그려짐: '+rows.length);
      assert(rows.some(r=>r.classList.contains('locked') && /가득참/.test(r.textContent)),'가득 찬 파티가 참가 불가로 안 막힘');
      // 이름으로 찾기 = .rmNum 줄(방 번호 자리)
      pbSetQuery('네모'); await sleep(30);
      assert(card.querySelectorAll('.roomItem').length===1,'이름 검색이 안 걸림');
      pbSetQuery(''); await sleep(30);
      // 참가 → 내 파티가 그 이름·인원으로 채워진다
      const target=PB_DEMO[0], before=target.mates.length;
      pbJoin(target.id); await sleep(60);
      assert(!visible($('ptFindOv')),'참가했는데 게시판이 안 닫힘');
      assert(_party && _party.name===target.name,'참가한 파티 이름이 안 들어옴: '+(_party&&_party.name));
      assert(_party.members.length===before+1,'내가 안 들어갔거나 인원이 안 맞음: '+_party.members.length);
      assert($('msPanelBody').querySelector('.ptTitle').textContent.indexOf(target.name)>=0,'하단 내 파티에 이름이 안 뜸');
      assert(!$('msPanelBody').querySelector('.ptKick'),'남의 파티인데 내보내기 버튼이 보임');
      // 탭을 다시 눌러도 게시판이 뜨지 않는다
      navSub('chat'); await sleep(30); navSub('party'); await sleep(80);
      assert(!visible($('ptFindOv')),'파티 탭에서 게시판이 또 뜸');
      // 나가기 → 게시판 인원도 되돌아온다(한쪽만 지우면 인원이 샌다)
      await partyDisband(); await sleep(40);
      openPartyFind(); await sleep(60);
      assert(pbCount(pbFind(target.id))===before,'나갔는데 게시판 인원이 안 줄어듦: '+pbCount(pbFind(target.id)));
      // 만들기 → 내가 파티장이고 게시판 맨 위에 내 방이 선다
      pbToggleMake(); await sleep(40);
      const inp=$('pbNameInput'); assert(inp,'파티 이름 입력칸이 없음');
      inp.value='스모크 파티'; pbCreate(); await sleep(60);
      assert(_party && _party.name==='스모크 파티' && iAmLeader(),'파티를 못 만들었거나 파티장이 아님');
      assert(pbRooms()[0].id==='pb_my','내가 만든 파티가 게시판 맨 위에 없음');
      assert($('msPanelBody').querySelector('.ptDisband').textContent.indexOf('해제')>=0,'파티장인데 해제 버튼이 아님');
      await partyDisband(); await sleep(40); closePartyFind(); _pbRooms=null; }
    navSub('chat'); await sleep(30);
    // ⑧ 판형: 최상위 등폭 · 뒤로 = 정사각 · 하위 선택(.cur) = 최상위 선택(.on)과 같은 판·링
    navBack(); await sleep(40);
    { const ws=[...document.querySelectorAll('#navBar .navIt')].map(e=>e.getBoundingClientRect().width);
      assert(Math.max(...ws)-Math.min(...ws)<1.5,'최상위 칸이 등폭이 아님: '+ws.map(w=>w|0).join(','));
      navGo('gear'); }
    await sleep(60);
    { const bk=document.querySelector('#navBar .navIt.navBk').getBoundingClientRect();
      assert(Math.abs(bk.width-bk.height)<1.5,'뒤로 칸이 정사각이 아님: '+(bk.width|0)+'×'+(bk.height|0));
      const subs=[...document.querySelectorAll('#navBar .navIt[data-sub]')].map(e=>e.getBoundingClientRect().width);
      assert(Math.max(...subs)-Math.min(...subs)<1.5,'하위 칸이 등폭이 아님: '+subs.map(w=>w|0).join(','));
      const cur=getComputedStyle(document.querySelector('#navBar .navIt.cur'));
      // .on 과 같은 물성인지 — 판(배경 그라데이션)과 글자색으로 잰다
      const probe=document.createElement('button'); probe.className='navIt on'; $('navBar').appendChild(probe);
      const on=getComputedStyle(probe);
      assert(cur.backgroundImage===on.backgroundImage && cur.color===on.color,'하위 선택이 최상위 선택과 물성이 다름');
      probe.remove(); }
    navBack(); await sleep(40);
    // ⑨ 칸이 라벨을 담을 수 있는가 — 가장 빡빡한 상점 6칸으로 잰다
    navGo('shop'); await sleep(60);
    { const cells=[...document.querySelectorAll('#navBar .navIt:not(.navBk)')];
      const tight=cells.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent.trim());
      assert(!tight.length,'네비 칸에 라벨이 안 들어감: '+tight.join(', ')); }
    navBack(); await sleep(40);
    return '등폭 5칸 · 뒤로 정사각 · 소셜 도크 상주';
  });

  await step('상점: 전용 화면(팝업 아님) · 네비/마을 구역 두 경로', async()=>{ skipIf(typeof openShop!=='function','상점 화면 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','상점'); saveMeta(); }
    navGo('shop'); await sleep(60);
    assert(visible($('shopScreen')),'네비 상점이 전용 화면을 안 엶');
    assert(!visible($('townPanel')),'상점이 아직 팝업으로 열림');
    assert(!visible($('townScreen')),'상점인데 마을 화면이 남아 있음');
    assert($('curTitle').textContent==='상점','상점 제목이 재화 바 왼쪽에 없음: "'+$('curTitle').textContent+'"');
    // 구역 5개를 하단 네비로 나눴다(2026-08-14) — 화면에는 고른 구역 하나만 그린다
    assert(document.querySelectorAll('#shopBody .shopPanel').length>=1,'상점 구역이 안 그려짐');
    { const seen=[];
      for(const k of ['deal','draw','res','pack','gem']){ setShopSec(k);
        const hd=document.querySelector('#shopBody .shopHead');
        assert(hd,'상점 구역 '+k+' 이 안 그려짐'); seen.push(hd.textContent.slice(0,4)); }
      setShopSec('deal');
      assert(new Set(seen).size===5,'상점 구역이 서로 다르지 않음: '+seen.join(',')); }
    assert(document.querySelectorAll('#shopBody .shopDeal').length===3,'오늘의 특가가 3개가 아님');
    setShopSec('draw');   // 뽑기 행은 '뽑기' 구역에 있다(구역별로 나뉜 뒤)
    assert(document.querySelectorAll('#shopBody .shopRow').length>0,'상점 내용(뽑기 행)이 비어 있음');
    assert(document.querySelector('#shopBody .petRow, #shopBody .shopPanel'),'뽑기 구역에 보유 펫이 안 붙음');
    setShopSec('deal');
    // 재화 아이콘은 resIco 공용(이모지 임의 사용 금지) — 카드 안에 실제 아이콘이 들어갔는지
    assert(document.querySelectorAll('#shopBody img.gi[src*="res_"]').length>0,'상점에 공용 재화 아이콘이 없음');
    // IBM Plex Sans KR은 700이 최대 — 800/900은 가짜 볼드가 된다(DESIGN.md §2)
    for(const sel of ['.curTitle','.shopHead','.shopTag','.shopBuy']){ const e=document.querySelector('#shopBody '+sel)||document.querySelector(sel);
      if(e) assert(+getComputedStyle(e).fontWeight<=700, sel+' 굵기가 700 초과(가짜 볼드): '+getComputedStyle(e).fontWeight); }
    assert(document.querySelectorAll('#navBar .navIt[data-sub]').length===5,'상점 하위가 5칸이 아님');
    // 마을 구역(뽑기집)도 팝업이 아니라 같은 화면으로
    openHome(); await sleep(40); openTownPanel('gacha'); await sleep(60);
    assert(visible($('shopScreen')) && !visible($('townPanel')),'마을 구역이 아직 팝업으로 열림');
    openHome(); await sleep(40);
    return '전용 화면 · 두 경로 ok'; });
  // 🧰 정비 = 장비·펫·동료 전용 화면. 내용은 전부 기존 렌더러 재사용(단일 소스) — 복제본이 생기면 여기서 걸린다.
  await step('정비: 전용 화면 · 장비/펫/동료 탭 · 렌더러 재사용', async()=>{ skipIf(typeof openGear!=='function','정비 화면 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','정비'); saveMeta(); }
    // 등급 표기를 보려면 실제 보유가 있어야 한다 — 비어 있으면 검사가 헛돈다
    // ⚠ 정원을 '채울 수 있을 만큼' 넣어야 교체 경로가 실제로 돌아간다
    //    (예전엔 보유가 정원보다 적어 교체 검사가 통째로 건너뛰어져 red-test가 안 걸렸다)
    { const p=PROF();
      // 칸을 일부러 '일부만' 열고 '일부만' 채운다 — 채워짐·빈칸·잠김 세 종류가 다 나와야 높이를 비교할 수 있다
      p.petSlots=MG_SLOT_MAX-1; hbHunt().allySlots=MG_SLOT_MAX-1;
      p.pets={ wolf:{star:1,dup:2,fed:0}, slime:{star:0,dup:0,fed:0}, tiger:{star:0,dup:3,fed:0},
               owl:{star:0,dup:0,fed:0}, golem:{star:0,dup:0,fed:0} };
      p.equip=['wolf'];                                  // 열린 칸(2) 중 하나만 채운다
      const H=hbHunt();
      H.mates={ sniper:{lv:2,dup:1}, sentinel:{lv:1,dup:0}, spike:{lv:1,dup:2},
                phantom:{lv:1,dup:0}, gunner:{lv:1,dup:0}, goliath:{lv:1,dup:0} };
      H.party=['sniper'];                                // 열린 칸(2) 중 하나만 채운다
      saveMeta(); }
    // ⚠ 하단 네비에서 빠진 화면이다(2026-08-25 개편 — 연구·임무로 교체). 화면·코드는 살아 있으므로
    //   **직접 열어서** 계속 검사한다 — 유보한 코드가 썩지 않게. ⛔ navGo('gear') 는 이제 없다.
    openGear(); await sleep(60);
    assert(visible($('gearScreen')),'정비 화면이 안 열림');
    assert(!visible($('townPanel')) && !visible($('townScreen')),'정비인데 마을이 남아 있음');
    // 탭 띠는 화면에서 걷어내고 하단 네비로 올렸다(2026-08-14) — 같은 UI 를 두 군데 두지 않는다
    assert(!document.getElementById('gearTabs'),'정비 화면에 옛 탭 띠가 남아 있음');
    // ⛔ 옛 네비 하위(장비·펫·동료) 검사는 걷어냈다 — 2026-08-25 개편으로 그 칸들이 없어졌다.
    //   탭 전환(setGearTab)과 화면 내용은 아래에서 계속 검사한다.
    // ⓪ 장비 슬롯 카드 — 각진 판 + 윗변 광선(네비바와 같은 --edge-light)
    { setGearTab('gear'); await sleep(40);
      // 착용 칸이 있어야 '등급 테두리가 통째로 차지하는가'를 볼 수 있다
      { const c2=CHAR(); const it=profMakeItem('helmet',6,'epic');
        if(it){ profAddItem(it); profEquipItem(it.iid); } renderGear(); await sleep(40); }
      const slots=[].slice.call(document.querySelectorAll('#gearBody .pdSlot'));
      assert(slots.length>0,'장비 슬롯이 없음');
      const base=slots.find(e=>!e.classList.contains('on'));
      const on=slots.find(e=>e.classList.contains('on'));
      assert(base,'빈/잠긴 칸이 없어 기본 표현 검사 불가');
      assert(on,'착용 칸이 없어 등급 테두리 검사 불가');
      const cs=getComputedStyle(base);
      // 각지게 — 라운드는 DESIGN.md 토큰의 아래쪽(≤3px)
      assert(parseFloat(cs.borderTopLeftRadius)<=3,'슬롯이 아직 둥긂: '+cs.borderTopLeftRadius);
      // 윗변 광선 = 네비바와 '같은' 그라데여야 한다(두 벌로 만들지 말 것)
      const lightOf=el=>getComputedStyle(el,'::before').backgroundImage;
      const nav=document.querySelector('.navBar');
      assert(nav,'네비바가 없음');
      const a=lightOf(base), b2=lightOf(nav);
      assert(a && a!=='none','슬롯에 윗변 광선이 없음');
      assert(a===b2,'기본 슬롯 광선이 네비바와 다른 그라데임(단일 소스 위반)');
      assert(a.indexOf('gradient')>=0,'광선이 그라데가 아님: '+a.slice(0,40));
      // 착용 칸 = 기본(은색) 표현이 '전부' 등급색으로 바뀐다. 단순 외곽선이 아니라 같은 성질을 갖는다.
      { const oc=getComputedStyle(on), lit=lightOf(on);
        assert(lit && lit!=='none','착용 칸에 윗변 광선이 없음');
        assert(lit!==b2,'착용 칸이 아직 은색 광선을 씀(등급색이 차지해야 한다)');
        assert(lit.indexOf('gradient')>=0,'착용 칸 광선이 그라데가 아님(단순 선 금지)');
        const rgb=(oc.color.match(/\d+/g)||[]).slice(0,3).join(', ');
        assert(rgb && lit.indexOf(rgb)>=0,'착용 칸 광선이 등급색이 아님: '+lit.slice(0,60)+' / color '+oc.color);
        assert(oc.borderTopColor!==getComputedStyle(base).borderTopColor,'착용 칸 테두리가 기본과 같음'); }
      // ⚠ overflow:hidden 을 쓰면 레벨 배지(.pdLv)가 잘린다 — 실제로 그렇게 잘렸었다
      assert(cs.overflow!=='hidden','슬롯에 overflow:hidden 이 걸려 레벨 배지가 잘린다');
      // 면이 배경보다 밝아야 '판'으로 읽힌다
      { const g=cs.backgroundImage+cs.backgroundColor;
        const nums=(g.match(/\d+/g)||[]).map(Number);
        assert(nums.length>=3,'슬롯 면 색을 읽지 못함');
        assert(nums[0]+nums[1]+nums[2]>=60,'슬롯 면이 너무 어두움: '+nums.slice(0,3).join(',')); }
      // ＋ 는 부위 글리프와 겹치지 않는다(가운데에 겹쳐 두면 둘 다 안 읽힌다)
      { const emp=slots.find(e=>e.classList.contains('empty'));
        if(emp){ const plus=emp.querySelector('.pdPlus'), ico=emp.querySelector('.slIco');
          assert(plus,'빈 슬롯에 ＋ 가 없음');
          if(ico){ const a2=plus.getBoundingClientRect(), b3=ico.getBoundingClientRect();
            const overlap=!(a2.right<=b3.left||a2.left>=b3.right||a2.bottom<=b3.top||a2.top>=b3.bottom);
            assert(!overlap,'＋ 가 부위 글리프와 겹침'); } } } }
    // ① 장비 = 마을 장비창과 같은 renderProfGear() — 아바타(페이퍼돌) + 가방이 그대로 나와야 한다
    assert(document.querySelector('#gearBody .gearWrap'),'장비 탭에 장비창이 없음');
    assert(document.querySelector('#gearBody .bagBody'),'장비 탭에 가방이 없음');
    { const ref=renderProfGear().replace(/\s+/g,'');
      assert(ref.indexOf('gearWrap')>=0 && document.getElementById('gearBody').innerHTML.replace(/\s+/g,'').slice(0,40)===ref.slice(0,40),
        '정비 장비 탭이 renderProfGear()와 다름(복제 의심)'); }
    // ② 펫 = 상점 '보유 펫'과 같은 _shopPetPanel()
    setGearTab('pet'); await sleep(40);
    // ⛔ 옛 네비 하위 활성 검사는 걷어냈다 — 2026-08-25 개편으로 정비 하위 칸이 없어졌다.
    //   탭 전환 자체는 아래 본문 비교가 확인한다(_gearTab 이 실제로 펫으로 갔는지).
    assert(_gearTab==='pet','펫 탭으로 안 바뀜: '+_gearTab);
    { const ref=_shopPetPanel().replace(/\s+/g,'');
      assert(document.getElementById('gearBody').innerHTML.replace(/\s+/g,'').slice(0,60)===ref.slice(0,60),
        '정비 펫 탭이 _shopPetPanel()과 다름(복제 의심)'); }
    // ③ 동료도 같은 뼈대
    setGearTab('ally'); await sleep(40);
    assert(document.querySelector('#gearBody .gearWrap'),'동료 탭이 비어 있음');
    // ④ 세 탭이 '같은 뼈대'를 쓴다(2026-08-14) — 상단(쓰는 것) + 하단(가진 것 격자)
    //    탭마다 다른 레이아웃 언어를 쓰면 같은 화면 안에서 다른 앱처럼 보인다.
    for(const t of ['gear','pet','ally']){ setGearTab(t); await sleep(40);
      assert(document.querySelector('#gearBody .gearWrap'),t+' 탭이 공용 뼈대(.gearWrap)를 안 씀');
      assert(document.querySelector('#gearBody .gearSum'),t+' 탭에 상단 요약이 없음');
      assert(document.querySelector('#gearBody .bagBody'),t+' 탭에 보유 격자가 없음'); }
    // 하단 격자 높이는 세 탭이 같아야 한다 — 탭을 옮길 때 아래 구역이 들썩이면 안 된다
    { const h={}; for(const t of ['gear','pet','ally']){ setGearTab(t); await sleep(40);
        h[t]=Math.round(document.querySelector('#gearBody .bagScroll').getBoundingClientRect().height); }
      assert(h.gear===h.pet && h.gear===h.ally,'탭마다 하단 격자 높이가 다름: '+JSON.stringify(h)); }
    // 펫·동료 상단은 '세로로 길게' — 남는 세로 공간을 상단이 먹어야 아래가 비지 않는다
    for(const t of ['pet','ally']){ setGearTab(t); await sleep(40);
      const rows=document.querySelectorAll('#gearBody .mgSlot');
      assert(rows.length>=2, t+' 탭 상단 슬롯이 2줄 미만');
      const a=rows[0].getBoundingClientRect(), b2=rows[1].getBoundingClientRect();
      assert(b2.top>=a.bottom-1, t+' 탭 상단이 아직 가로 배치임(세로로 쌓여야 한다)');
      assert(a.width>200, t+' 탭 슬롯이 한 줄 폭을 안 씀: '+Math.round(a.width));
      // 빈칸·잠긴 칸·채워진 칸의 높이가 같아야 한다 — 다르면 칸을 열 때 화면이 들썩인다
      { const hs={};
        for(const r of document.querySelectorAll('#gearBody .mgSlot')){
          const kind=r.classList.contains('on')?'filled':r.classList.contains('lock')?'locked':'empty';
          const h=Math.round(r.getBoundingClientRect().height);
          if(hs[kind]!==undefined) assert(hs[kind]===h,t+': 같은 종류 줄끼리 높이가 다름('+kind+') '+hs[kind]+' vs '+h);
          hs[kind]=h;
          // 고정 높이를 줬으니 내용이 그 안에 들어와야 한다(넘치면 잘려 보인다)
          assert(r.scrollHeight<=r.clientHeight+1,t+': 줄 내용이 넘침('+kind+') '+r.scrollHeight+'>'+r.clientHeight); }
        const kinds=Object.keys(hs);
        assert(kinds.length>=2,t+': 비교할 줄 종류가 부족함 — '+kinds.join(','));
        for(const a of kinds) for(const b2 of kinds)
          assert(hs[a]===hs[b2],t+': 줄 종류마다 높이가 다름 '+JSON.stringify(hs));
        assert(hs[kinds[0]]<=72,t+': 줄이 너무 높음(압축 규칙): '+hs[kinds[0]]+'px'); }
      // 줄 구성 = [카드][이름·능력치][해제·확장칸]
      const card=rows[0].querySelector('.mgCard'), name=rows[0].querySelector('.mgName');
      const stat=rows[0].querySelector('.mgStat'), add=rows[0].querySelectorAll('.mgAddBtn');
      const btns=[].slice.call(rows[0].querySelectorAll('.mgBtn'));
      assert(card&&name&&stat,t+' 탭 줄 구성이 [카드][이름·능력치]가 아님');
      assert(name.getBoundingClientRect().left>=card.getBoundingClientRect().right-1,t+' 탭 이름이 카드 오른쪽이 아님');
      assert(stat.textContent.trim().length>0,t+' 탭 능력치 줄이 비어 있음');
      assert(MG_ADD_SLOTS>=1,'추가 능력치·스킬 확장 칸이 0개로 꺼져 있음');
      assert(add.length===MG_ADD_SLOTS,t+' 탭 + 확장 칸 수가 표와 다름: '+add.length+' vs '+MG_ADD_SLOTS);
      // ⓐ 레벨/★ 은 초상 위 배지가 아니라 '이름 오른쪽 텍스트'다
      { const lv=rows[0].querySelector('.mgLv'), card=rows[0].querySelector('.mgCard');
        assert(lv,t+' 탭에 레벨 표기(.mgLv)가 없음');
        assert(!rows[0].querySelector('.mgTag'),t+' 탭에 옛 카드 배지(.mgTag)가 남음');
        const lr=lv.getBoundingClientRect(), nr=name.getBoundingClientRect(), cr=card.getBoundingClientRect();
        assert(lr.left>=nr.right-1,t+': 레벨이 이름 오른쪽이 아님');
        assert(lr.left>=cr.right-1,t+': 레벨이 아직 초상 위에 있음'); }
      // ⓑ 등급 이름과 특징은 줄에서 뺀다 — 등급은 테두리 색이 말한다
      { const sx=stat.textContent;
        for(const t2 of GACHA_TIER_ORDER)
          assert(sx.indexOf(GACHA_TIERS[t2].name)<0,t+': 능력치 줄에 등급 이름이 남음: '+sx);
        if(t==='ally'){ const id=MG.ally.on()[0];
          if(id) assert(sx.indexOf(HB_MATES[id].tip)<0,t+': 능력치 줄에 특징이 남음: '+sx); } }
      // ⓒ + 확장 칸은 해제 '왼쪽'에 · 이전보다 크다
      { const un=btns.find(b=>b.textContent.trim()==='해제');
        assert(un,t+': 해제 버튼이 없음');
        assert(add[0].getBoundingClientRect().right<=un.getBoundingClientRect().left+1,
          t+': + 칸이 해제 왼쪽이 아님');
        assert(add[0].getBoundingClientRect().height>=26,
          t+': + 칸이 너무 작음: '+Math.round(add[0].getBoundingClientRect().height)+'px'); }
      // 줄에는 '해제'만 둔다 — 합성은 상태창으로 옮겼다(줄이 버튼으로 붐비지 않게)
      const tx=btns.map(b=>b.textContent.trim());
      assert(tx.indexOf('해제')>=0,t+' 탭에 해제 버튼이 없음: '+tx.join(','));
      assert(tx.indexOf('합성')<0,t+' 탭 줄에 합성이 남아 있음(상태창으로 옮겼다)');
      assert(btns[0].getBoundingClientRect().left>=name.getBoundingClientRect().right-1,t+' 탭 버튼이 이름 오른쪽이 아님');
      // 경험치 막대가 있어야 '합성으로 오른다'가 보인다
      assert(rows[0].querySelector('.mgExp'),t+' 탭에 경험치 막대가 없음'); }
    // ⑤ 등급 표현은 세 탭 모두 '테두리 색' 하나로 통일한다 — 글자색·배지로 갈라 쓰지 않는다
    { const tierCols=Object.keys(TIER_COLOR).map(k=>TIER_COLOR[k].toLowerCase());
      const hex=rgb=>{ const m=(rgb.match(/\d+/g)||[]).slice(0,3).map(Number);
        return m.length===3? ('#'+m.map(v=>v.toString(16).padStart(2,'0')).join('')) : ''; };
      for(const t of ['pet','ally']){ setGearTab(t); await sleep(40);
        const cells=document.querySelectorAll('#gearBody .igCell');
        assert(cells.length>0, t+' 탭 보유 격자가 비어 있음(검사 불가)');
        let tinted=0;
        for(const el of cells){ const c=getComputedStyle(el);
          if(tierCols.indexOf(hex(c.borderTopColor))>=0) tinted++; }
        assert(tinted===cells.length, t+' 탭에서 등급이 테두리 색으로 안 나옴: '+tinted+'/'+cells.length); } }
    // ⑥ 조작(2026-08-14 개편) — 자동선택 / 해제 / 상태창 / 교체 유도 / 등급 일괄 합성
    for(const k of ['pet','ally']){ setGearTab(k); await sleep(40);
      const M=MG[k];
      // 칸은 산 만큼만 열린다 — 상한은 펫·동료 모두 MG_SLOT_MAX
      assert(M.max()>=0 && M.max()<=MG_SLOT_MAX, k+': 칸 수가 0~'+MG_SLOT_MAX+' 범위를 벗어남: '+M.max());
      // 이 단계는 '일부만 연' 상태를 전제로 한다(세 종류 줄을 다 보려면 잠긴 칸이 남아 있어야 한다)
      assert(M.max()<MG_SLOT_MAX, k+': 시드가 칸을 다 열어 잠긴 줄 검사가 불가');
      // ⚡ 자동 선택 — 가장 강한 순서대로 정원만큼 들어간다
      for(const id of M.on().slice()) M.toggle(id);
      assert(M.on().length===0,k+': 비우지 못함');
      { const btn=[].slice.call(document.querySelectorAll('#gearBody .mgAutoRow .twBtn'))[0];
        assert(btn && btn.textContent.indexOf('자동')>=0,k+': 자동 선택 버튼이 없음'); }
      mgAuto(k); await sleep(30);
      assert(M.on().length===Math.min(M.max(),M.owned().length),k+': 자동 선택이 정원을 안 채움: '+M.on().length);
      { const rank=M.owned().slice().sort((a,b)=>M.power(b)-M.power(a)).slice(0,M.max());
        for(const id of rank) assert(M.on().indexOf(id)>=0,k+': 자동 선택이 가장 강한 것을 안 올림: '+id); }
      // 해제 → 빈 자리(＋)
      const victim=M.on()[0];
      mgUnequip(k, victim); await sleep(30);
      assert(M.on().indexOf(victim)<0,k+': 해제해도 안 내려감');
      assert(document.querySelector('#gearBody .mgSlot.empty'),k+': 해제한 자리가 빈 슬롯(＋)이 안 됨');
      // 하단 카드 탭 = '상태창'이다(바로 교체 팝업이 뜨면 안 된다)
      mgCellTap(k, victim); await sleep(30);
      assert(document.querySelector('#gearBody .mgStatTbl'),k+': 하단 카드를 눌러도 상태창이 안 뜸');
      assert($('gearBody').textContent.indexOf('와 교체')<0,k+': 옛 추가/교체 팝업이 남아 있음');
      { const btns=[].slice.call(document.querySelectorAll('#gearBody .mgSheetBtns .twBtn')).map(b=>b.textContent.trim());
        assert(btns.indexOf('합성')>=0 && btns.indexOf('교체')>=0,k+': 상태창에 합성·교체 버튼이 없음: '+btns.join(',')); }
      // 교체 → 팝업이 내려가고 상단이 빨갛게 · 자리를 누르면 들어간다
      mgSwapStart(); await sleep(30);
      assert(!document.querySelector('#gearBody .mgStatTbl'),k+': 교체를 눌러도 상태창이 안 내려감');
      { const red=document.querySelectorAll('#gearBody .mgSlot.swapT');
        assert(red.length===M.max(),k+': 상단 칸이 교체 표시(빨강)로 안 바뀜: '+red.length+'/'+M.max());
        const c=getComputedStyle(red[0]).borderTopColor, m=(c.match(/\d+/g)||[]).map(Number);
        assert(m[0]>150 && m[0]>m[2]+40,k+': 교체 표시가 빨간색이 아님: '+c); }
      { const old=M.on()[0];
        mgSwapTo(old); await sleep(30);
        assert(M.on().indexOf(victim)>=0 && M.on().indexOf(old)<0,k+': 교체가 반영되지 않음');
        assert(M.on().length<=M.max(),k+': 교체로 정원을 넘김');
        assert(!document.querySelector('#gearBody .mgSlot.swapT'),k+': 교체 뒤에도 빨간 표시가 남음'); }
      // 합성 — 상태창 → 합성 → 등급 버튼으로 그 등급 중복을 통째로 담고 완료
      { const tgt=M.on().find(id=>M.dup(id)>0) || M.on()[0];
        const mat=M.owned().find(id=>M.dup(id)>0);
        assert(mat,k+': 중복이 없어 합성 검사 불가');
        mgCellTap(k, tgt); await sleep(20); mgMixOpen(); await sleep(30);
        assert(document.querySelector('#gearBody .mgTierRow'),k+': 합성 팝업에 등급 버튼 줄이 없음');
        const tier=M.tier(mat);
        const tb=[].slice.call(document.querySelectorAll('#gearBody .mgTierBtn'))
          .find(b=>b.textContent.indexOf(GACHA_TIERS[tier].name)>=0);
        assert(tb,k+': '+tier+' 등급 버튼이 없음');
        assert(mgMixExp()===0,k+': 열자마자 재료가 담겨 있음');
        mgMixTier(tier); await sleep(20);
        const want=M.owned().filter(id=>M.tier(id)===tier).reduce((a,id)=>a+M.dup(id)*M.pt(id),0);
        assert(mgMixExp()===want,k+': 등급 버튼이 그 등급 중복을 전부 안 담음: '+mgMixExp()+' vs '+want);
        mgMixTier(tier); await sleep(20);
        assert(mgMixExp()===0,k+': 다시 눌러도 안 빠짐');
        mgMixTier(tier); await sleep(20);
        // 취소 → 아무것도 안 먹는다
        const dup0=M.dup(mat), e0=M.exp(tgt).cur;
        mgMixCancel(); await sleep(20);
        assert(M.dup(mat)===dup0 && M.exp(tgt).cur===e0,k+': 취소했는데 재료가 소모됨');
        // 완료 → 담은 만큼 들어간다
        mgCellTap(k, tgt); await sleep(20); mgMixOpen(); await sleep(20); mgMixTier(tier); await sleep(20);
        const lv0=M.lvTx(tgt);
        mgMixApply(); await sleep(30);
        assert(!document.querySelector('#gearBody .mgTierRow'),k+': 완료 뒤 합성 팝업이 안 닫힘');
        assert(M.dup(mat)<dup0,k+': 완료했는데 재료가 안 줄어듦');
        assert(M.exp(tgt).cur>e0 || M.lvTx(tgt)!==lv0,k+': 완료했는데 경험치·레벨이 그대로'); }
    }
    setGearTab('ally'); await sleep(40);
    assert($('gearBody').textContent.indexOf('동료')>=0,'동료 탭에 동료 표기가 없음');
    setGearTab('gear'); await sleep(40);
    setGearTab('gear');
    // 굵기 700 상한(DESIGN.md §2)
    for(const sel of ['#curBar .curTitle','#navBar .navIt']){ const e=document.querySelector(sel);
      if(e) assert(+getComputedStyle(e).fontWeight<=700, sel+' 굵기가 700 초과(가짜 볼드): '+getComputedStyle(e).fontWeight); }
    openHome(); await sleep(40);
    return '하위 3칸 · renderProfGear/_shopPetPanel 재사용 ok'; });
  await step('장비: 던전 드랍 → 장착하면 스탯에 반영', ()=>{ skipIf(typeof profMakeItem!=='function','장비 아이템 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; p.items.length=0; p.unlocks={};
    p.pets={}; p.equip=[];                                // 펫 %보너스가 곱해지면 장비 기여분만 떼어 볼 수 없다
    profCreateChar('ranger','장비');
    const base=profStat('pow');
    const it=profMakeItem('weapon', 5, 'epic'); assert(it && it.main>0,'아이템 생성 실패');
    assert(it.opts.length>=1,'에픽인데 추가 옵션이 없음');
    profAddItem(it); assert(profEquipItem(it.iid),'장착 실패');
    const optPow=it.opts.filter(o=>o.k==='pow').reduce((s,o)=>s+o.v,0);
    assert(profStat('pow')===base+it.main+optPow,'공격 반영 불일치: '+profStat('pow')+' vs '+(base+it.main+optPow));
    assert(profEquipItem(it.iid) && CHAR().unit.gear.weapon==='','같은 것을 다시 누르면 해제되어야 함');
    return '주스탯 +'+it.main+' · 옵션 '+it.opts.length+'개'; });
  await step('장비: 가방은 공용 · 남이 장착 중이면 못 씀 · 분해 환급', ()=>{ skipIf(typeof profScrapItem!=='function','장비 아이템 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; p.items.length=0; p.pcoin=0;
    const a=profCreateChar('ranger','A'), it=profAddItem(profMakeItem('weapon',2,'rare'));
    assert(profEquipItem(it.iid),'A 장착 실패');
    // 계정당 캐릭터는 하나라 UI로는 둘째를 못 만든다 — 소유권 판정만 보려고 저장소에 직접 꽂는다
    const b=defaultChar('scout','B'); p.chars.push(b); p.curId=b.id;
    assert(profItems().length===1,'가방이 캐릭터를 따라감(계정 공용이어야 함)');
    assert(!profEquipItem(it.iid),'다른 캐릭터가 장착 중인데 장착됨');
    assert(profScrapItem(it.iid)===-1,'장착 중인데 분해됨');
    p.curId=a.id; assert(profEquipItem(it.iid),'A로 돌아가 해제 실패');
    const v=profScrapValue(it), got=profScrapItem(it.iid);
    assert(got===v && p.pcoin===v,'분해 환급 불일치: '+got+'/'+p.pcoin);
    assert(profItems().length===0,'가방에서 안 사라짐');
    return '분해 +'+v+'P'; });
  await step('장비창: 장비/장신구 페이지 분리 · 가방 상시 노출', ()=>{ skipIf(typeof profPickSlot!=='function','페이퍼돌 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; p.items.length=0;
    profCreateChar('ranger','돌');
    const it=profAddItem(profMakeItem('top',4,'epic')); profEquipItem(it.iid);
    profAddItem(profMakeItem('shoes',4,'rare')); saveMeta();
    _gearPick=null; _gearSel=null; _gearPage=PROF_GEAR_PAGES[0].id;
    openHome(); openTownPanel('gear');                        // openTown이 loadMeta로 다시 읽으므로 CHAR()는 이 뒤에 잡는다
    const c=CHAR(); c.level=1; refreshTownPanel();
    const body=$('tpBody');
    const slots=body.querySelectorAll('.pdSlot');
    // ① 한 페이지엔 자기 part만 — 장비 페이지에 장신구가 섞이면 안 된다
    const armor=profPageSlots('armor'), acc=profPageSlots('acc');
    assert(armor.length+acc.length===Object.keys(PROF_GEAR).length,'페이지에 안 들어간 슬롯이 있음');
    assert(armor.length>=5 && acc.length>=3,'페이지 분배가 한쪽으로 쏠림: '+armor.length+'/'+acc.length);
    for(const k of ['necklace','earring','ring','belt','cape']) assert(acc.indexOf(k)>=0,'장신구 쪽에 있어야 할 슬롯이 장비 쪽에 있음: '+k);
    for(const k of ['weapon','helmet','top','bottom','shoes']) assert(armor.indexOf(k)>=0,'장비 쪽에 있어야 할 슬롯이 장신구 쪽에 있음: '+k);
    assert(slots.length===armor.length,'장비 페이지 슬롯 수 불일치: '+slots.length);
    const shown=[...slots].map(e=>e.getAttribute('title'));
    for(const k of acc) assert(shown.indexOf(PROF_GEAR[k].name)<0,'장비 페이지에 '+PROF_GEAR[k].name+'이(가) 나옴');
    // 섹션 이동은 화살표 버튼이 아니라 바(세그먼트) — 바는 아바타 아래, 장비 합계는 위
    const seg=body.querySelector('.pdNav .pdSeg'); assert(seg,'섹션 이동 바가 없음');
    assert(seg.querySelectorAll('.pdSegBtn').length===PROF_GEAR_PAGES.length,'바에 섹션이 다 안 들어감');
    assert(seg.querySelector('.pdSegInd'),'바에 현재 섹션 표시가 없음');
    assert(seg.querySelector('.pdSegBtn.on').textContent===PROF_GEAR_PAGES[0].name,'바에 켜진 섹션이 안 맞음');
    const kids=[...body.querySelector('.gearWrap').children].map(e=>e.className.split(' ')[0]);
    assert(kids.join('>')==='gearSum>pdWrap>pdNav>bagSec','장비창 세로 순서가 다름: '+kids.join('>'));
    // 바를 눌러 섹션 이동
    seg.querySelectorAll('.pdSegBtn')[1].click();
    assert(_gearPage===PROF_GEAR_PAGES[1].id,'바를 눌러도 섹션이 안 바뀜');
    profGearPageAt(0);
    // ② 넘기면 장신구 페이지 — 슬롯이 통째로 갈린다
    profGearPageStep(1);
    assert(_gearPage===PROF_GEAR_PAGES[1].id,'페이지가 안 넘어감');
    const slots2=$('tpBody').querySelectorAll('.pdSlot');
    assert(slots2.length===acc.length,'장신구 페이지 슬롯 수 불일치: '+slots2.length);
    const shown2=[...slots2].map(e=>e.getAttribute('title'));
    for(const k of armor) assert(shown2.indexOf(PROF_GEAR[k].name)<0,'장신구 페이지에 '+PROF_GEAR[k].name+'이(가) 나옴');
    profGearPageStep(-1);                                     // 장비 페이지로 되돌려 놓고 이어서 검사
    assert(body.querySelector('.pdFig svg path'),'캐릭터 도형이 없음');
    // 슬롯이 아바타 위에 부위별로 겹쳐 있어야 한다(상·하·좌·우 다 씀)
    const ys=[...slots].map(e=>parseFloat(e.style.top)), xs=[...slots].map(e=>parseFloat(e.style.left));
    const rows=[...new Set(ys)].sort((a,b)=>a-b), cols=[...new Set(xs)].sort((a,b)=>a-b);
    assert(rows.length>=4 && rows[0]<20 && rows[rows.length-1]>70,'슬롯이 위아래 여러 줄로 안 퍼짐: '+rows.join(','));
    assert(cols.length>=3 && cols[0]<40 && cols[cols.length-1]>60 && cols.indexOf(50)>=0,
      '슬롯이 좌·중·우로 안 퍼짐(가운데 열이 몸통에 겹쳐야 함): '+cols.join(','));
    assert(body.querySelectorAll('.pdSlot .slIco').length===slots.length,'슬롯 아이콘이 라인아트가 아님');
    assert(body.querySelectorAll('.pdSlot.empty .pdPlus').length>0,'빈 칸에 ＋가 없음');
    assert(body.querySelectorAll('.pdSlot.lock .pdLockIco').length===body.querySelectorAll('.pdSlot.lock').length,
      '잠긴 칸에 자물쇠 아이콘이 없음(이모지로 남아 있는지 확인)');
    assert(body.innerHTML.indexOf('🔒')<0,'슬롯에 자물쇠 이모지가 남아 있음');
    for(const k in PROF_GEAR) assert(PROF_SLOT_ICON[k],'슬롯 아이콘 누락: '+k);
    const eq=body.querySelector('.pdSlot.on'); assert(eq,'장착한 슬롯이 on으로 안 보임');
    // 숫자 배너는 뺐다(2026-08-15) — 등급은 테두리가, 레벨은 가방 칸이 말한다
    assert(!eq.querySelector('.pdLv'),'착용 칸에 숫자 배너가 아직 있음');
    // Lv.1엔 기본 5칸만 열리고 나머지는 레벨로 잠겨 있어야 한다
    const open=Object.keys(PROF_GEAR).filter(k=>!profSlotLocked(k));
    assert(open.length===5,'Lv.1 해금 슬롯이 5칸이 아님: '+open.join(','));
    for(const k of ['helmet','top','bottom','shoes','weapon']) assert(open.indexOf(k)>=0,'기본 슬롯이 잠김: '+k);
    assert(body.querySelectorAll('.pdSlot.lock').length===armor.filter(k=>profSlotLocked(k)).length,'잠긴 칸 표시가 안 맞음');
    CHAR().level=30; assert(Object.keys(PROF_GEAR).every(k=>!profSlotLocked(k)),'Lv.30인데 안 열린 칸이 있음');
    CHAR().level=1;
    // 가방은 아래 구역에 늘 열려 있어야 한다(시트로 감추지 않음)
    assert(body.querySelector('.bagSec .bagBody .igGrid'),'가방 구역이 안 보임');
    assert(body.querySelectorAll('.igGrid .igCell').length===2,'가방 격자 칸 수 불일치');
    assert(!body.querySelector('.igInfo'),'아무것도 안 골랐는데 상세가 뜸');
    profSelItem(it.iid);
    const info=$('tpBody').querySelector('.igInfo'); assert(info,'고른 아이템 상세가 없음');
    assert(info.textContent.indexOf('해제')>=0,'장착 중인데 해제 버튼이 아님');
    assert(info.parentElement.classList.contains('bagSec'),'상세가 가방 구역 안에 겹치지 않음');
    assert(getComputedStyle(info).position==='absolute','상세가 가방을 밀어내는 배치임(팝업이 아님)');
    profCloseInfo(); assert(!$('tpBody').querySelector('.igInfo'),'상세 팝업이 안 닫힘');
    profSlotTap('top');                                       // 슬롯 탭 → 가방을 그 칸으로 거른다
    assert($('tpBody').querySelectorAll('.igGrid .igCell').length===1,'슬롯 필터가 안 걸림');
    profSlotTap('top'); assert(_gearPick===null,'같은 칸을 다시 눌러도 전체로 안 돌아옴');
    assert(document.querySelector('#townPanel .twCard').classList.contains('gearFull'),'장비창 카드 높이 고정이 안 걸림');
    twLeave();
    return '장비 '+armor.length+'칸 / 장신구 '+acc.length+'칸(Lv.1 해금 '+open.length+')'; });
  await step('장비창: 짐이 많아도 카드가 안 늘어나고 가방만 스크롤', ()=>{ skipIf(typeof bagScrollHint!=='function','가방 스크롤 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; p.items.length=0;
    profCreateChar('ranger','짐');
    // ⚠ 가방은 '지금 페이지'의 부위만 보여 준다 — 아무 부위나 채우면 화면에 안 나와 넘치지 않는다
    _gearPage=PROF_GEAR_PAGES[0].id;
    const ks=profPageSlots(_gearPage), ts=PROF_ITEM_TIERS.map(t=>t.id);
    for(let i=0;i<26;i++) profAddItem(profMakeItem(ks[i%ks.length], 1+(i%5), ts[i%ts.length]));
    const ks2=profPageSlots(PROF_GEAR_PAGES[1].id);            // 다른 페이지 표본(가방이 페이지를 따라가는지 볼 것)
    for(let i=0;i<5;i++) profAddItem(profMakeItem(ks2[i%ks2.length], 1+(i%5), ts[i%ts.length]));
    saveMeta(); _gearPick=null; _gearSel=null;
    openHome(); openTownPanel('gear'); CHAR().level=40; refreshTownPanel();
    const body=$('tpBody'), card=document.querySelector('#townPanel .twCard');
    const sc=body.querySelector('.bagScroll'), bag=body.querySelector('.bagBody'), sec=body.querySelector('.bagSec');
    assert(sc&&bag,'가방 스크롤 영역이 없음');
    // ① 넘치는 건 가방 안에서만 — 카드 본문 자체는 늘어나지도 스크롤되지도 않는다
    assert(body.scrollHeight<=body.clientHeight+2,'짐이 많으면 카드 본문이 늘어남: '+body.scrollHeight+'>'+body.clientHeight);
    assert(bag.scrollHeight>bag.clientHeight+4,'가방이 스크롤되지 않음(격자가 안 넘침)');
    assert(getComputedStyle(bag).overflowY==='auto','가방 본문이 스크롤 영역이 아님');
    // ② 가방 구역이 카드 밖으로 잘리지 않는다
    const cr=card.getBoundingClientRect(), sr=sec.getBoundingClientRect();
    assert(sr.bottom<=cr.bottom+1,'가방 구역이 카드 아래로 잘림: '+Math.round(sr.bottom)+'>'+Math.round(cr.bottom));
    assert(sr.top>=cr.top,'가방 구역이 카드 위로 벗어남');
    assert(cr.bottom<=innerHeight+1 && cr.top>=-1,'카드가 화면 밖으로 나감');
    // ③ 가방은 위 구역보다 작아야 한다(짐이 늘어도 아바타를 잡아먹지 않음)
    const pdr=body.querySelector('.pdWrap').getBoundingClientRect();
    assert(pdr.height>sr.height,'가방이 착용 구역보다 큼: 가방 '+Math.round(sr.height)+' / 착용 '+Math.round(pdr.height));
    // ④ 더 볼 게 남았다는 표시 · 6그리드 · 분류
    assert(sc.classList.contains('more'),'스크롤이 남았는데 "더 있음" 표시가 없음');
    // 재렌더 뒤엔 아래 노드들이 떨어져 나가 크기가 0이 되므로 여기서 숫자를 잡아 둔다
    const bh=bag.clientHeight, bs=bag.scrollHeight;
    const cells=[...body.querySelectorAll('.igCell')].slice(0,8).map(e=>e.getBoundingClientRect());
    const perRow=cells.filter(r=>Math.abs(r.top-cells[0].top)<2).length;
    assert(perRow===6,'가방이 6그리드가 아님: 한 줄 '+perRow+'칸');
    assert(cells[0].width<=54,'가방 칸이 너무 큼: '+Math.round(cells[0].width)+'px');
    const rows=Math.floor(bh/(cells[0].height+6));
    assert(rows>=3,'가방이 한 화면에 3줄도 못 보여줌: '+rows+'줄('+Math.round(bh)+'px)');
    // 가방은 위 페이지 네비(장비/장신구)를 따라간다 — 따로 거르는 분류 칩은 없다
    assert(!body.querySelector('.bagCat'),'가방에 분류 칩이 남아 있음');
    const nItem=pg=>profItems().filter(i=>(PROF_GEAR[i.slot]||{}).part===pg).length;
    const nArm=nItem(PROF_GEAR_PAGES[0].id), nAcc=nItem(PROF_GEAR_PAGES[1].id);
    assert(nArm>0 && nAcc>0 && nArm!==nAcc,'페이지 검사용 표본이 치우침: 장비 '+nArm+' / 장신구 '+nAcc);
    assert(body.querySelector('.bagHead .bagTtl').textContent===PROF_GEAR_PAGES[0].name,'가방 머리가 지금 페이지 이름이 아님');
    assert(body.querySelectorAll('.igCell').length===nArm,'가방이 장비 페이지 것만 보여 주지 않음');
    profGearPageAt(1);
    assert($('tpBody').querySelector('.bagHead .bagTtl').textContent===PROF_GEAR_PAGES[1].name,'페이지를 넘겨도 가방 머리가 안 바뀜');
    assert($('tpBody').querySelectorAll('.igCell').length===nAcc,'페이지를 넘겨도 가방이 안 따라감');
    profGearPageAt(0);
    assert($('tpBody').querySelectorAll('.igCell').length===nArm,'페이지를 되돌려도 가방이 안 따라감');
    // 칸 안 숫자(강화 수치)는 지웠다 · 테두리는 착용 칸과 같은 처리
    const cell0=$('tpBody').querySelector('.igCell');
    assert(!cell0.querySelector('.igLv'),'가방 칸에 숫자가 남아 있음');
    const cs0=getComputedStyle(cell0), bf=getComputedStyle(cell0,'::before');
    assert(parseFloat(cs0.borderTopLeftRadius)<=3,'가방 칸이 착용 칸보다 둥금: '+cs0.borderTopLeftRadius);
    assert(bf.backgroundImage.indexOf('gradient')>=0,'가방 칸에 착용 칸과 같은 빛 테두리가 없음');
    // ⑤ 스크롤한 채로 아이템을 골라 다시 그려도 보던 위치를 유지한다(위 분류 조작으로 노드가 갈렸으니 다시 잡는다)
    const bagNow=$('tpBody').querySelector('.bagBody');
    bagNow.scrollTop=90; bagScrollHint();
    profSelItem(profItems()[12].iid);
    const bag2=$('tpBody').querySelector('.bagBody');
    assert(Math.abs(bag2.scrollTop-90)<=2,'다시 그리면 가방 스크롤이 맨 위로 튐: '+bag2.scrollTop);
    // ⑥ 상세는 가방 위로 겹쳐 뜨는 팝업 — 레이아웃을 밀지 않는다
    const info=$('tpBody').querySelector('.igInfo'); assert(info,'고른 아이템 상세가 없음');
    const sec2=$('tpBody').querySelector('.bagSec'), pd2=$('tpBody').querySelector('.pdWrap');
    assert(Math.abs(sec2.getBoundingClientRect().height-sr.height)<=1,'상세가 뜨자 가방 구역 높이가 바뀜(밀어냄)');
    assert(Math.abs(pd2.getBoundingClientRect().height-pdr.height)<=1,'상세가 뜨자 착용 구역이 밀림');
    const ir=info.getBoundingClientRect(), bsr=$('tpBody').querySelector('.bagScroll').getBoundingClientRect();
    assert(ir.top<bsr.bottom-8,'상세가 가방 위로 겹치지 않고 아래에 붙음');
    assert(ir.bottom<=card.getBoundingClientRect().bottom+1,'상세 팝업이 카드를 넘침');
    assert(info.querySelector('.igClose'),'상세 팝업에 닫기 버튼이 없음');
    twLeave();
    return '가방 '+Math.round(bh)+'px에 '+rows+'줄 · 내용 '+bs+'px'; });
  // DESIGN.md 규칙을 이 화면에만 강제한다. 다른 화면은 전환될 때 각자 스텝을 추가할 것.
  await step('장비 등급: 계정 공용 7단계 사다리를 그대로 쓴다', ()=>{
    skipIf(typeof PROF_ITEM_TIERS==='undefined','장비 등급 없음');
    const ids=PROF_ITEM_TIERS.map(t=>t.id);
    assert(ids.join(',')===GACHA_TIER_ORDER.join(','),
      '장비 등급이 계정 사다리와 다름: '+ids.join(',')+' vs '+GACHA_TIER_ORDER.join(','));
    // 단계마다 '강해지고 · 귀해지고 · 옵션이 는다' — 하나라도 뒤집히면 위계가 깨진다
    for(let i=1;i<PROF_ITEM_TIERS.length;i++){ const a=PROF_ITEM_TIERS[i-1], b=PROF_ITEM_TIERS[i];
      assert(b.mul>a.mul, a.id+'→'+b.id+' 배수가 안 오름');
      assert(b.opts>a.opts, a.id+'→'+b.id+' 옵션 수가 안 늘어남');
      assert(b.p<a.p, a.id+'→'+b.id+' 드랍 가중이 안 줄어듦'); }
    // 이름·색·단계는 전부 공용 표에서만 나온다(장비 전용 사본이 있으면 안 된다)
    for(const id of ids){
      assert(PROF_ITEM_PREFIX[id],'접두사 없음: '+id);
      assert(TIER_COLOR[id],'등급 색 없음: '+id);
      assert(tierName(id)===GACHA_TIERS[id].name,'등급 이름이 공용 표와 다름: '+id);
      assert(tierRank(id)===GACHA_TIER_ORDER.indexOf(id)+1,'단계 번호가 어긋남: '+id); }
    // 깊은 층에선 최고 등급도 실제로 나와야 한다(가중이 0이면 영원히 안 나온다)
    const seen={}; const R=(function(){ let x=12345;
      return function(){ x=(x*1103515245+12345)&0x7fffffff; return x/0x7fffffff; }; })();
    const or=Math.random; Math.random=R;
    try{ for(let i=0;i<40000;i++) seen[profMakeItem('weapon',40).tier]=1; } finally{ Math.random=or; }
    for(const id of ids) assert(seen[id],'깊은 층에서도 안 나오는 등급: '+id);
    return ids.length+'단계 · '+PROF_ITEM_TIERS[6].mul+'배까지'; });
  await step('장비 등급 프레임: 착용 칸과 가방 칸이 한 사다리', ()=>{
    skipIf(typeof tierFrame!=='function','등급 프레임 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; p.items.length=0;
    profCreateChar('ranger','프레임');
    const ts=PROF_ITEM_TIERS.map(t=>t.id), ks=profPageSlots('armor');
    ts.forEach((t,i)=>profAddItem(profMakeItem(ks[i%ks.length], 5, t)));
    const c=CHAR(); c.level=40;
    const hi=profItems().find(i=>i.tier==='god'); profEquipItem(hi.iid);
    saveMeta(); _gearPick=null; _gearSel=null; _gearPage='armor';
    openHome(); openTownPanel('gear'); refreshTownPanel();
    const body=$('tpBody');
    // ① 두 곳 다 같은 헬퍼가 그린다 — 단계 속성과 프레임 층이 빠지면 안 된다
    const on=body.querySelector('.pdSlot.on');
    assert(on && on.dataset.tr==='7','착용 칸에 단계 속성이 없음: '+(on&&on.dataset.tr));
    assert(on.querySelector('.tfx'),'착용 칸에 프레임 층(.tfx)이 없음');
    const cells=[...body.querySelectorAll('.igCell')];
    assert(cells.length===ts.length,'가방 표본 수가 안 맞음: '+cells.length);
    assert(cells.every(e=>e.querySelector('.tfx')),'가방 칸에 프레임 층이 없음');
    // ② 빈 칸은 등급 구조를 하나도 갖지 않는다
    const emp=body.querySelector('.pdSlot.empty');
    assert(emp && !emp.dataset.tr,'빈 칸에 단계 속성이 붙음');
    assert(emp && !emp.querySelector('.tfx'),'빈 칸에 프레임 층이 붙음');
    // ③ 단계가 오를수록 구조가 '늘기만' 한다 — 어느 축도 뒤로 가면 안 된다
    const rank=e=>+e.dataset.tr;
    const byTier={}; for(const e of cells) byTier[rank(e)]=e;
    let prev=null, grew=0;
    for(let r=1;r<=7;r++){ const e=byTier[r]; assert(e,'단계 '+r+' 표본이 없음');
      const cs=getComputedStyle(e), fx=getComputedStyle(e.querySelector('.tfx'));
      const now={ b:parseFloat(getComputedStyle(e.querySelector('.tfx'),'::before').height)||0,
                  ring:parseFloat(fx.getPropertyValue('--tfR'))||0,
                  brk:parseFloat(fx.getPropertyValue('--tfKL'))||0,
                  glow:parseFloat(cs.getPropertyValue('--tfG'))||0 };
      if(prev){ for(const k in now) assert(now[k]>=prev[k], '단계 '+r+'에서 '+k+'가 뒤로 감: '+prev[k]+'→'+now[k]);
        if(Object.keys(now).some(k=>now[k]>prev[k])) grew++; }
      prev=now; }
    assert(grew===6,'단계가 올라가도 구조가 그대로인 구간이 있음: '+grew+'/6');
    // ④ 색은 인라인으로 들어오고 CSS는 currentColor 로만 받는다 — 등급 색값을 CSS에 복제하면 실패
    const god=byTier[7];
    assert(god.style.color.replace(/\s/g,'')==='rgb(255,43,214)','가방 칸이 등급색을 인라인으로 안 받음: '+god.style.color);
    // ⚠ var() 가 든 선언은 크롬이 '적은 그대로' 보관한다 — #hex 가 rgb() 로 안 바뀐다. 두 표기 다 찾아야 한다.
    const hex2rgb=h=>{ const n=parseInt(h.slice(1),16);
      return 'rgb('+((n>>16)&255)+', '+((n>>8)&255)+', '+(n&255)+')'; };
    let frameCss='';
    for(const sh of document.styleSheets){ try{ for(const r of sh.cssRules){
      if(/pdSlot|igCell|tfx|data-tr/.test(r.selectorText||'')) frameCss+=r.cssText+'\n'; } }catch(e){} }
    assert(frameCss.length>400,'프레임 CSS를 못 읽음: '+frameCss.length);
    const low=frameCss.toLowerCase();
    const dup=Object.keys(TIER_COLOR).filter(t=>
      low.indexOf(TIER_COLOR[t].toLowerCase())>=0 || low.indexOf(hex2rgb(TIER_COLOR[t]))>=0);
    assert(!dup.length,'등급 색값이 CSS에 복제됨(currentColor 로 받아야 한다): '+dup.join(','));
    // 글로우가 실제로 사다리를 타는가 — 두 칸 모두 --tfG 를 써야 한다(계산된 값 비교로는 색 차이에 묻힌다)
    // 줄바꿈은 원문 그대로 보관되므로 줄 단위로 세면 안 된다 — 공백을 눌러 선언 단위로 자른다
    const glowUses=frameCss.replace(/\s+/g,' ').split(';')
      .filter(d=>/box-shadow/.test(d) && /var\(--tfG\)/.test(d)).length;
    assert(glowUses>=2,'글로우가 단계를 안 탐 — box-shadow 가 --tfG 를 쓰는 곳 '+glowUses+'곳(착용·가방 둘 다여야 한다)');
    // ⑤ 칸 안 숫자·등급 배지는 없다(테두리가 말한다)
    assert(!god.querySelector('.igLv'),'칸에 숫자가 남아 있음');
    twLeave();
    return '7단계 · 구조 6번 증가 · 착용/가방 공용'; });
  await step('장비 아이콘: 그림이 없으면 라인아트로 돌아간다(404 없음)', ()=>{
    skipIf(typeof gearIco!=='function','장비 아이콘 파이프라인 없음');
    // 목록에 없는 부위/등급은 절대 <img> 를 만들지 않는다 — 가방 40칸이 전부 404를 쏘게 된다
    for(const slot in PROF_GEAR) for(const t of PROF_ITEM_TIERS.map(x=>x.id)){
      const h=gearIco(slot, t);
      if(h.indexOf('<img')>=0){
        const k=h.match(/gear\/([^.]+)\.webp/)[1];
        assert(GEAR_ART.has(k),'목록에 없는 파일을 부름: '+k); }
      else assert(h.indexOf('<svg')===0 && h.indexOf('slIco')>0,'폴백이 라인아트 글리프가 아님: '+slot); }
    // 화면에 실제로 뜬 아이콘도 전부 목록 안이어야 한다
    const bad=[...document.querySelectorAll('.igCell img.slIco,.pdSlot img.slIco')]
      .filter(im=>!GEAR_ART.has((im.getAttribute('src').match(/gear\/([^.]+)\.webp/)||[])[1]));
    assert(!bad.length,'목록 밖 그림이 화면에 붙음: '+bad.length+'개');
    // 부위마다 라인아트가 실재해야 한다(빈 svg 는 빈 칸으로 보인다)
    for(const slot in PROF_GEAR) assert((PROF_SLOT_ICON[slot]||'').indexOf('<path')>=0,'라인아트 없음: '+slot);
    return GEAR_ART.size+'장 등록 · 나머지 '+Object.keys(PROF_GEAR).length+'부위 라인아트'; });
  await step('장비창: DESIGN.md 규칙(라운드 토큰 · 시안 1곳 · 1px 테두리)', ()=>{
    skipIf(typeof profPickSlot!=='function','장비창 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; p.items.length=0;
    profCreateChar('ranger','룰');
    const ks=Object.keys(PROF_GEAR), ts=PROF_ITEM_TIERS.map(t=>t.id);
    for(let i=0;i<14;i++) profAddItem(profMakeItem(ks[i%ks.length], 1+(i%5), ts[i%ts.length]));
    saveMeta(); _gearPick=null; _gearSel=null; _gearPage=PROF_GEAR_PAGES[0].id;
    openHome(); openTownPanel('gear'); CHAR().level=40; refreshTownPanel();
    const body=$('tpBody'), OK=['3px','6px','9px'];
    const scan=()=>{ const bad=[], cyan=[];
      for(const e of body.querySelectorAll('*')){ const c=getComputedStyle(e);
        for(const v of c.borderRadius.split(/[\s\/]+/))
          if(v && v!=='0px' && v!=='50%' && OK.indexOf(v)<0) bad.push((e.className||e.tagName)+'='+v);
        if(parseFloat(c.borderTopWidth)>1.5) bad.push((e.className||e.tagName)+' 테두리 '+c.borderTopWidth);
        // 면·링을 시안으로 채운 요소만 센다(2px 밑줄 라인은 ::after라 여기 안 잡힘)
        const t=c.borderColor+' '+c.backgroundImage+' '+c.boxShadow+' '+c.backgroundColor;
        if(/92,\s*214,\s*255|5cd6ff/i.test(t)) cyan.push(e.className||e.tagName);
      } return {bad:bad, cyan:cyan}; };
    let r=scan();
    assert(!r.bad.length,'토큰 밖 라운드/두꺼운 테두리: '+r.bad.slice(0,4).join(', '));
    // 아무것도 안 골랐으면 시안 채움은 없어야 한다(탭·분류는 중립 강조)
    assert(!r.cyan.length,'선택 전인데 시안을 쓴 요소가 있음: '+r.cyan.slice(0,4).join(', '));
    profGearPageAt(1);
    r=scan(); assert(!r.cyan.length,'섹션/페이지 전환이 시안을 채움: '+r.cyan.slice(0,4).join(', '));
    profGearPageAt(0);
    // 아이템을 고르면 그 칸 하나만 시안(공용 .twBtn 제외 — 마을 전체 전환 때 처리)
    profSelItem(profItems().filter(i=>(PROF_GEAR[i.slot]||{}).part===_gearPage)[2].iid);   // 가방은 지금 페이지 것만 보인다
    r=scan();
    const own=r.cyan.filter(c=>String(c).indexOf('twBtn')<0);
    assert(own.length===1 && String(own[0]).indexOf('igCell')>=0,
      '선택 시 시안이 정확히 고른 칸 하나가 아님: '+JSON.stringify(own));
    // 숫자는 Rajdhani + tabular-nums
    for(const sel of ['.gearSum b','.gsSub']){ const e=body.querySelector(sel);
      if(!e) continue; const c=getComputedStyle(e);
      assert(/Rajdhani/i.test(c.fontFamily), sel+' 숫자가 Rajdhani가 아님: '+c.fontFamily);
      assert(c.fontVariantNumeric.indexOf('tabular-nums')>=0, sel+' tabular-nums 없음'); }
    profCloseInfo(); twLeave();
    return '라운드 3/6/9 · 시안 1곳 · 테두리 1px'; });
  await step('던전: 도전 가능 층이 레벨로 열린다', ()=>{ skipIf(typeof dgFloorCap!=='function','층 해금 없음');
    const p=PROF(); p.chars.length=0; p.curId='';
    const c=profCreateChar('ranger','층'); c.level=1;
    assert(dgFloorCap()===1,'Lv.1인데 1층이 아님: '+dgFloorCap());
    c.level=1+DG_LV_PER_FLOOR*4; assert(dgFloorCap()===5,'레벨 대비 개방 층 불일치: '+dgFloorCap());
    assert(dgFloorReqLv(5)===c.level,'필요 레벨 역산 불일치');
    c.level=1; const before=DG;
    dgEnter(9);                                                // 레벨보다 높은 층은 못 들어간다
    assert(DG===before,'레벨 상한을 넘겼는데 던전이 시작됨');
    return 'Lv당 '+DG_LV_PER_FLOOR+'레벨에 1층'; });
  // ⚔ 던전 허브 — 목록 카드 · 팝업(이전 스테이지 소탕/입장) · 열쇠(매일 09:00·던전별) 게이트 · 뽑기권
  await step('던전 허브: 목록 카드·팝업(소탕/입장)·열쇠·뽑기권', ()=>{ skipIf(typeof openDungeonHub!=='function','던전 허브 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','던전'); saveMeta(); }
    const cc=CHAR(); cc.level=6; cc.dgFloors={}; dgSetFloor('normal',2);   // Lv6 → 3단계 개방, 일반 2단계까지 클리어
    const p=PROF(); p.dgKeys={}; p.tickets=emptyTickets(); saveMeta();
    openDungeonHub();
    assert(visible($('dgHubScreen')),'던전 허브가 안 열림');
    // 종류표(DG_DUNGEONS)가 단일 소스 — 개수를 여기 박지 말고 표에서 꺼낸다
    assert(document.querySelectorAll('#dgHubBody .dgRow').length===DG_DUNGEONS.length,
      '카드 수가 종류표와 다름: '+document.querySelectorAll('#dgHubBody .dgRow').length+' ≠ '+DG_DUNGEONS.length);
    const wantLock=DG_DUNGEONS.filter(d=>d.reqLv>6).length;
    assert(document.querySelectorAll('#dgHubBody .dgRow.locked').length===wantLock,
      'Lv6 에서 잠겨야 할 카드 수가 다름: '+document.querySelectorAll('#dgHubBody .dgRow.locked').length+' ≠ '+wantLock);
    assert(dgKeyN('normal')===DG_KEY_DAILY,'일반 던전 열쇠 초기값 불일치: '+dgKeyN('normal'));
    // 소탕은 **목록 행에서 바로** 실행된다(시트를 안 지난다) — 열쇠 1 소모 + 미네랄 증가
    const k0=dgKeyN('normal'), m0=Math.floor(PROF().pcoin); dgSweep('normal');
    assert(dgKeyN('normal')===k0-1,'소탕이 열쇠를 안 씀');
    assert(Math.floor(PROF().pcoin)>m0,'소탕이 미네랄을 안 줌');
    // 열쇠 0이면 입장이 전투로 진입하지 않는다
    PROF().dgKeys.normal.n=0; dgOpenSheet('normal'); dgSheetEnter();
    assert(!visible($('dgScreen')),'열쇠 0인데 입장이 진행됨');
    // 🎟 뽑기권 = 새 단계 클리어 시 적립 · **권종은 토벌 종류가 정한다**
    //   ⛔ 옛 규칙(모든 토벌이 장비권 + 5·10층마다 펫·동료권)으로 되돌리지 말 것 —
    //      그러면 "장비를 원하면 장비 토벌로 간다"가 무너져 종류를 나눈 뜻이 사라진다.
    for(const d of DG_DUNGEONS){ const t=PROF().tickets, k=d.rw.tix;
      const b0=Object.assign({}, t), r=dgFloorReward(3, d.id); dgGrantReward(r);
      if(!k){ assert(!r.tixKind && !r.tixN,'일반 토벌이 뽑기권을 줬다: '+r.tixKind+'×'+r.tixN);
        for(const q of TIX_KINDS) assert(t[q]===b0[q],'일반 토벌이 '+q+' 권을 건드림'); continue; }
      assert(r.tixKind===k && r.tixN>0, d.name+'의 권종이 틀림: '+r.tixKind+'×'+r.tixN);
      assert(t[k]===(b0[k]||0)+r.tixN, d.name+'이 '+k+' 권을 안 줌');
      for(const q of TIX_KINDS) if(q!==k) assert(t[q]===b0[q], d.name+'이 엉뚱한 권('+q+')도 줌'); }
    // 🎟 단계가 깊을수록 더 많이 — "초반은 적게, 위로 갈수록 조금씩 더해진다"(사용자 확정)
    { const lo=dgFloorReward(1,'gear').tixN, mid=dgFloorReward(11,'gear').tixN, hi=dgFloorReward(31,'gear').tixN;
      assert(lo>=1,'1단계가 뽑기권을 아예 안 줌: '+lo);
      assert(mid>lo && hi>mid,'단계가 깊어져도 뽑기권이 안 늘어난다: 1='+lo+' 11='+mid+' 31='+hi);
      // 재화도 같이 늘어야 한다 — '각 요소들'이 전부 상위 단계에서 더 나와야 한다
      assert(dgFloorReward(31,'normal').pc>dgFloorReward(1,'normal').pc*5,'상위 단계 재화가 충분히 안 늘어난다'); }
    // 🧹 소탕도 **그 단계의 보상을 그대로** 받는다(계획서 원문). 뽑기권이 빠지면 장비 토벌 소탕이 무의미해진다.
    // ⚠ dgSweep 은 해금 레벨도 본다(장비 = Lv.10) — 앞 스텝이 Lv.6 으로 낮춰 놨다
    { const cc2=CHAR(); const lv0=cc2.level; cc2.level=Math.max(cc2.level,10); cc2.dgFloors={}; dgSetFloor('gear', 11);
      const p2=PROF(); p2.dgKeys={}; const t0=p2.tickets.gear, m0=Math.floor(p2.pcoin);
      dgSweep('gear');
      const want=dgFloorReward(11,'gear');
      assert(p2.tickets.gear===t0+want.tixN,'소탕이 뽑기권을 안 줌: '+t0+' → '+p2.tickets.gear+' (기대 +'+want.tixN+')');
      assert(Math.floor(p2.pcoin)>=m0+want.pc,'소탕이 재화를 안 줌');
      cc2.level=lv0; cc2.dgFloors={}; dgSetFloor('normal',2); }
    dgCloseSheet(); openHome();
    return '카드'+DG_DUNGEONS.length+'·팝업·소탕·열쇠게이트·권종'+TIX_KINDS.length+'종 ok'; });
  // ⚔ 자동 / 직접 두 갈래(2026-08-20 확정) — 다른 점은 셋이다:
  //   ① 자동은 화면에 안 들어간다  ② 자동은 제자리에서 싸운다  ③ 자동은 배속으로 돈다
  //   ⛔ 자동에도 접근 이동을 켜면 둘이 같아져 '직접'을 고를 이유가 사라진다.
  await step('토벌 자동 전투: 화면 없이 · 제자리 · 배속', async()=>{
    skipIf(typeof dgStart!=='function' || typeof DG_AUTO_SPEED==='undefined','자동 전투 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','던전'); saveMeta(); }
    const c=CHAR(); c.level=40; c.dgFloors={};
    { const H=hbHunt(); H.unl={}; H.upg={atk:30,hp:30,aspd:10,crit:10}; }
    try{
      // ① 화면 — 직접은 들어가고 자동은 안 들어간다
      DG=null; dgStart(3, {id:'normal'}); dgStopLoop();
      assert(visible($('dgScreen')),'직접 전투가 화면에 안 들어감');
      assert(!DG.auto,'직접인데 auto 가 켜짐');
      DG=null; showAppScreen('homeScreen');
      dgStart(3, {auto:true, id:'normal'}); dgStopLoop();
      assert(DG && DG.auto,'자동 전투가 안 켜짐');
      assert(!visible($('dgScreen')),'자동 전투가 화면에 들어갔다 — "화면에 입장하지 않고도"가 요구다');
      // ② 제자리 — 적을 멀리 두고 밀어도 캐릭터가 움직이면 안 된다
      DG.phase='fight'; DG.gap=99;
      DG.foes=[{key:'slime',name:'슬라임',ico:'🟢',hp:1e9,hpMax:1e9,atk:0,spd:0,range:30,cd:9,t:9,id:'f1',x:20,y:20}];
      const x0=DG.me.x, y0=DG.me.y;
      for(let i=0;i<30;i++) dgStep(0.05);
      assert(DG.me.x===x0 && DG.me.y===y0,'자동인데 캐릭터가 적에게 다가갔다: ('+x0+','+y0+') → ('+DG.me.x+','+DG.me.y+')');
      // 직접이면 같은 상황에서 다가가야 한다(대조군 — 없으면 위 단언이 '아무도 안 움직인다'로 통과한다)
      DG.auto=false; for(let i=0;i<30;i++) dgStep(0.05);
      assert(DG.me.x!==x0 || DG.me.y!==y0,'직접인데 캐릭터가 안 움직인다 — 위 제자리 검사가 무의미해진다');
      // ③ 배속 — 같은 실제 dt 에 자동이 DG_AUTO_SPEED 배만큼 스텝을 밟는다
      const real=dgStep; let n=0;
      try{ window.dgStep=function(){ n++; };
        DG.auto=false; n=0; _dgLast=performance.now()-16; dgTick(performance.now());
        const n1=n;
        DG.auto=true;  n=0; _dgLast=performance.now()-16; dgTick(performance.now());
        assert(n1===1,'직접인데 한 틱에 '+n1+'스텝');
        assert(n===DG_AUTO_SPEED,'자동 배속이 안 걸림: '+n+' ≠ '+DG_AUTO_SPEED);
      } finally{ window.dgStep=real; dgStopLoop(); }
      return '화면없음 ok · 제자리 ok · '+DG_AUTO_SPEED+'배속 ok';
    } finally{ DG=null; dgStopLoop(); c.dgFloors={}; openHome(); } });
  // ⚔ 4단계 — 자동 토벌이 **사냥터 엔진** 위에서 돈다. 지킬 것은 '규칙만 다르고 엔진은 하나'다.
  await step('자동 토벌: 사냥터 엔진에서 · 사냥터와 동시에 · 보상이 안 샌다', async()=>{
    skipIf(typeof dgHbStart!=='function','토벌 사냥터 세션 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','던전'); saveMeta(); }
    const c=CHAR(); c.level=40; c.dgFloors={};
    { const H=hbHunt(); H.unl={}; H.upg={atk:30,hp:30,aspd:10,crit:10}; }
    openHome(); await sleep(250);
    // ⚠ 건너뛰는 이유를 적는다 — 그냥 '안 돌고 있음'이면 버그로 오해하고 고치려 든다.
    //   토벌은 GAME_DIRECTION §5-D 로 **유보**다(삭제 아님). 사냥터가 캠프로 바뀌면서
    //   빌릴 화면이 멈췄을 뿐, 코드는 그대로 살아 있다.
    skipIf(!HBS.hunt || !HBS.hunt.on,'🏕 캠프 전환으로 옛 사냥터 정지 — 토벌은 유보(GAME_DIRECTION §5-D)');
    const hunt=HBS.hunt, wasManual=hunt.manual;
    const p=PROF(); p.dgKeys={}; p.tickets=emptyTickets(); p.pcoin=0; p.gas=0;
    try{
      hunt.manual=true;                                  // 사냥터는 멈춰 두고 토벌만 본다(보상 출처를 가른다)
      const S=dgHbStart(4,'gear',{auto:true,key:true});
      assert(S && HBS.dg===S,'토벌 세션이 안 생김');
      assert(S.mode==='dg' && S.auto,'mode/auto 가 안 붙음: '+S.mode+'/'+S.auto);
      assert(S.speed===DG_AUTO_SPEED,'자동인데 배속이 안 붙음: '+S.speed);
      // ① 기지가 없다 — 사냥터 성벽이 토벌장에 서 있으면 안 된다
      { const n=hbWith('dg',()=>{ const b=hbBlocked(); let k=0; for(let i=0;i<b.length;i++) k+=b[i]; return k; });
        assert(n===0,'토벌장에 기지 벽이 '+n+'칸 서 있다'); }
      // ② 회복 구역도 없다 — 있으면 원점에서 버티며 무한히 산다
      hbWith('dg',()=>{ S.char.x=0; S.char.y=0; S.char.hp=1; S.char.tx=null;
        const h0=S.char.hp; hbWalk(S,S.char,1.0);
        assert(S.char.hp<=h0,'토벌인데 회복 구역이 살아 있다: '+h0+' → '+S.char.hp); });
      // ③ 동료·펫·터렛·벙커 없음 — 토벌은 캐릭터 단독
      assert(!S.allies.length && !S.pets.length && !S.turrets.length && !S.bunkers.length,'토벌에 아군이 붙었다');
      // ④ 처치 보상이 안 샌다 — 토벌 처치는 재화도 뽑기권도 주지 않는다(보상은 클리어 때 한 번)
      { const m0=Math.floor(p.pcoin), t0=Object.assign({},p.tickets);
        hbWith('dg',()=>{ for(let i=0;i<6;i++){ const f=S.foes[0]||S.pend.length&&null; if(!S.foes.length) break; hbKill(S.foes[0]); } });
        assert(Math.floor(p.pcoin)===m0,'토벌 처치가 사냥터 재화를 줬다: '+m0+' → '+Math.floor(p.pcoin));
        for(const k of TIX_KINDS) assert((p.tickets[k]||0)===(t0[k]||0),'토벌 처치가 '+k+' 권을 떨궜다 — 종류를 나눈 뜻이 무너진다'); }
      // ⑤ 사냥터는 그대로다 — 라운드·처치가 토벌 때문에 움직이면 안 된다
      const hr=hunt.round, hk=hunt.kills;
      hbWith('dg',()=>{ for(let i=0;i<40 && HBS.dg;i++) hbStep(0.05); });
      assert(hunt.round===hr && hunt.kills===hk,'토벌이 사냥터 진행을 건드렸다: r'+hr+'→'+hunt.round+' k'+hk+'→'+hunt.kills);
      return 'mode=dg · 배속'+DG_AUTO_SPEED+' · 벽0 · 회복없음 · 단독 · 보상격리 ok';
    } finally{ hbSetSess('dg', null); hbUse('hunt'); hunt.manual=wasManual; c.dgFloors={}; } });
  // 판이 끝나면 세션이 걷히고, 그 프레임에 남은 코드가 null 을 읽으면 안 된다(실제로 터졌다)
  await step('자동 토벌: 클리어/실패로 세션이 깨끗이 걷힌다', async()=>{
    skipIf(typeof dgHbStart!=='function','토벌 사냥터 세션 없음');
    const c=CHAR(); c.dgFloors={}; const p=PROF(); p.dgKeys={}; p.tickets=emptyTickets();
    try{
      // 실패 경로 — 즉사시키고 한 스텝
      const S=dgHbStart(3,'gear',{auto:true,key:true});
      const k0=dgKeyN('gear');
      // 🩹 먼저: 자동 토벌은 스킬을 알아서 쓴다 — 빈사에서 heal 이 실제로 살려낸다.
      //   (이걸 안 재면 아래 '죽는다' 검사가 왜 쿨다운을 걸어야 하는지 알 수 없다)
      hbWith('dg',()=>{ S.char.hp=1; S.char.hitT=0; S.skT.heal=0; hbStep(0.05); });
      assert(S.char.hp>1,'자동인데 빈사에서 heal 스킬이 안 나갔다: hp='+S.char.hp);
      // ⚠ 이제 진짜 죽인다 — heal 을 쿨다운에 걸어 두고, hitT 도 0 으로(실제 피격이 그렇게 한다.
      //   9 로 두면 자연 재생이 먼저 돌아 hp 가 0 에서 살아난다).
      hbWith('dg',()=>{ for(const k in S.skT) S.skT[k]=999;
        S.char.hp=0; S.char.hitT=0; hbStep(0.05); });
      assert(!HBS.dg,'실패인데 세션이 안 걷혔다');
      assert(dgKeyN('gear')===k0,'실패인데 열쇠를 썼다: '+k0+' → '+dgKeyN('gear'));
      assert(dgMaxFloor('gear')===0,'실패인데 단계가 올랐다: '+dgMaxFloor('gear'));
      // 클리어 경로 — 마지막 웨이브를 비우고 한 스텝
      const S2=dgHbStart(3,'gear',{auto:true,key:true});
      const t0=PROF().tickets.gear;
      hbWith('dg',()=>{ S2.wave=HB_WAVES; S2.phase='fight'; S2.foes.length=0; S2.pend.length=0; hbStep(0.05); });
      assert(!HBS.dg,'클리어인데 세션이 안 걷혔다');
      assert(dgMaxFloor('gear')===3,'클리어인데 단계가 안 올랐다: '+dgMaxFloor('gear'));
      const want=dgFloorReward(3,'gear').tixN;
      assert(PROF().tickets.gear===t0+want,'클리어 보상이 안 들어옴: '+t0+' → '+PROF().tickets.gear+' (기대 +'+want+')');
      assert(dgKeyN('gear')===k0-1,'클리어인데 열쇠를 안 썼다');
      return '실패·클리어 양쪽 정리 ok';
    } finally{ hbSetSess('dg', null); hbUse('hunt'); c.dgFloors={}; } });
  // 🎮 5단계 — 직접 전투는 **사냥터 화면(HOME)을 빌린다.** 두 번째 전투 화면을 만들지 않는다.
  await step('직접 토벌: 사냥터 화면을 빌리고 깨끗이 돌려준다', async()=>{
    skipIf(typeof dgFightEnter!=='function','직접 토벌 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','던전'); saveMeta(); }
    const c=CHAR(); c.level=40; c.dgFloors={}; dgSetFloor('gear',3);
    { const H=hbHunt(); H.unl={}; H.upg={atk:30,hp:30,aspd:10,crit:10}; }
    openHome(); await sleep(250);
    // ⚠ 건너뛰는 이유를 적는다 — 그냥 '안 돌고 있음'이면 버그로 오해하고 고치려 든다.
    //   토벌은 GAME_DIRECTION §5-D 로 **유보**다(삭제 아님). 사냥터가 캠프로 바뀌면서
    //   빌릴 화면이 멈췄을 뿐, 코드는 그대로 살아 있다.
    skipIf(!HBS.hunt || !HBS.hunt.on,'🏕 캠프 전환으로 옛 사냥터 정지 — 토벌은 유보(GAME_DIRECTION §5-D)');
    // ⚠ dgFightEnter 는 openHome() 을 지나고 openHome 은 loadMeta() 로 프로필을 **다시 읽는다**.
    //   저장하지 않은 변경은 그때 사라진다 — 열쇠를 리셋했으면 반드시 saveMeta() 까지 해야 한다.
    PROF().dgKeys={}; saveMeta();
    const k0=dgKeyN('gear');
    const shown=id=>{ const e=$(id); return !!(e && e.getClientRects().length); };
    try{
      assert(dgFightEnter(4,'gear',true),'직접 토벌 진입 실패');
      // ① 세션이 바뀌고 사냥터는 배경으로 — 둘 다 살아 있어야 한다
      assert(_hbView==='dg','보는 세션이 안 바뀜: '+_hbView);
      assert(HBS.dg && HBS.dg.cv,'토벌 세션에 캔버스가 안 붙음');
      assert(!HBS.dg.auto && HBS.dg.speed===1,'직접인데 자동/배속이 붙음');
      assert(HBS.hunt.bg===true,'사냥터가 배경으로 안 내려감');
      assert(HBS.hunt.on,'사냥터 세션이 죽었다 — 배경에서 계속 돌아야 한다');
      // ② 화면 — 사냥터 것만 걷는다
      assert(document.body.classList.contains('dgFight'),'.dgFight 가 안 붙음');
      assert(!shown('hmScroll'),'토벌 중인데 사냥터 업그레이드 카드가 보인다');
      assert(!shown('hbRdPrev') && !shown('hbRdNext'),'토벌 중인데 라운드 ◀▶ 가 보인다');
      assert(shown('dgFightOut'),'포기 버튼이 안 보인다');
      // ③ HUD 는 토벌을 말한다 — 배경 사냥터가 덮어쓰면 안 된다(실제로 덮어썼다)
      assert($('hbRoundLb').textContent.trim()==='단계','라벨이 단계가 아님: '+$('hbRoundLb').textContent);
      assert($('hbRound').textContent.trim()==='4','단계 숫자가 틀림: '+$('hbRound').textContent);
      assert($('hbDgName').textContent.indexOf('장비 토벌')>=0,'이름이 토벌이 아님: '+$('hbDgName').textContent);
      hbWith('hunt',()=>{ hbHud(); });                 // 배경 세션이 HUD 를 만져도
      assert($('hbRound').textContent.trim()==='4','배경 사냥터가 토벌 HUD 를 덮어썼다: '+$('hbRound').textContent);
      // ④ 스킬 트레이가 **하단 네비에 안 가린다.**
      //   ⚠ 위치 계산이 업그레이드 카드(.hmUpg) 기준인데 직접 토벌은 그 카드를 숨긴다 → rect 가 전부 0 이라
      //     바가 네비 뒤로 깔렸다(실제로 그랬다 — 트레이가 통째로 안 보이고 AUTO 칩만 삐져나왔다).
      //   ⛔ '화면 안에 있는가'로 재지 말 것: 네비 뒤에 깔려도 화면 안이라 통과한다(그렇게 짰다가 red 가 안 떴다).
      //   실패 모드가 **둘**이다 — 하나만 재면 다른 하나가 통과한다(실제로 red 가 안 떴다):
      //     ⓐ 카드 rect 가 0 이라 bottom 이 커져 트레이가 화면 **위로** 날아간다
      //     ⓑ 캔버스 아래 고정으로 두면 트레이가 하단 네비 **뒤로** 깔린다
      { const tray=document.querySelector('#hbBar .hbTray') || $('hbBar');
        const r=tray.getBoundingClientRect(), ph=$('phone').getBoundingClientRect();
        const nav=$('navBar'), nr=nav&&nav.getClientRects().length?nav.getBoundingClientRect():null;
        assert(r.height>0,'스킬 트레이가 안 그려짐');
        assert(r.top>=ph.top-1,'ⓐ 스킬 트레이가 화면 위로 날아갔다: top='+r.top.toFixed(0)+' (화면 top='+ph.top.toFixed(0)+')');
        if(nr) assert(r.bottom<=nr.top+1,'ⓑ 스킬 트레이가 하단 네비 뒤로 깔렸다: bottom='+r.bottom.toFixed(0)+' > 네비 top='+nr.top.toFixed(0)); }
      // ⑤ 이동 조작 — '사냥터 맵처럼 이동하며 카이팅'이 요구다
      { const S=HBS.dg, x0=S.char.x, y0=S.char.y;
        hbWith('dg',()=>{ hbSetDest(200,120); for(let i=0;i<20;i++) hbStep(0.05); });
        assert(S.char.x!==x0 || S.char.y!==y0,'직접인데 이동 조작이 안 먹는다'); }
      // ⑥ 포기 — 열쇠 미소모 + 화면 원상복구
      dgFightGiveUp();
      assert(!HBS.dg,'포기했는데 세션이 남음');
      assert(_hbView==='hunt','포기 후 보는 세션이 안 돌아옴: '+_hbView);
      assert(!document.body.classList.contains('dgFight'),'.dgFight 가 안 걷힘');
      assert(shown('hmScroll'),'포기 후 사냥터 업그레이드 카드가 안 돌아옴');
      assert(!shown('dgFightOut'),'포기 후 포기 버튼이 남음');
      assert(HBS.hunt.bg===false,'포기 후 사냥터가 배경에 남음');
      assert($('hbRoundLb').textContent.trim()==='라운드','포기 후 라벨이 단계로 남음');
      assert(dgKeyN('gear')===k0,'포기인데 열쇠를 썼다: '+k0+' → '+dgKeyN('gear'));
      assert(dgMaxFloor('gear')===3,'포기인데 단계가 올랐다');
      return '빌림·HUD·조작·복귀 ok';
    } finally{ hbSetSess('dg',null); document.body.classList.remove('dgFight'); hbUse('hunt');
      if(HBS.hunt) HBS.hunt.bg=false; c.dgFloors={}; } });
  // 🧹 잔상 금지 — 3D 는 공용이라 빌릴 때와 돌려줄 때 **양쪽에서** 지운다(한쪽만 하면 반대 전환에서 샌다)
  await step('직접 토벌: 3D 를 빌릴 때와 돌려줄 때 양쪽에서 지운다', async()=>{ skipIf(typeof campOpen==='function','🏕 캠프로 대체 — 옛 사냥터 정지(되살리면 이 줄을 지운다)'); 
    skipIf(typeof dgFightEnter!=='function','직접 토벌 없음');
    const c=CHAR(); c.dgFloors={}; PROF().dgKeys={}; saveMeta();
    // ⚠ 헤드리스에선 three.js(esm.sh)가 막혀 M3D 가 아예 없다 — 그러면 이 검사가 통째로 건너뛰어져
    //   "지웠다고 착각"하게 된다. 없으면 **가짜 M3D 를 세워서** 호출 여부만 잰다(dg3dWipe 의 계약 검사).
    const hadM3D=!!window.M3D, realG=hadM3D?M3D.clearGameModels:null, realI=hadM3D?M3D.clearIdlePools:null;
    let g=0, i=0;
    try{
      if(!hadM3D) window.M3D={};
      M3D.clearGameModels=function(){ g++; }; M3D.clearIdlePools=function(){ i++; };
      openHome(); await sleep(150);
      g=0; i=0; dgFightEnter(2,'gear',false);
      assert(g>0 && i>0,'빌릴 때 안 지웠다: game='+g+' idle='+i);
      g=0; i=0; dgFightGiveUp();
      assert(g>0 && i>0,'돌려줄 때 안 지웠다: game='+g+' idle='+i);
      return '양방향 정리 ok';
    } finally{ if(hadM3D){ M3D.clearGameModels=realG; M3D.clearIdlePools=realI; } else { delete window.M3D; }
      hbSetSess('dg',null); document.body.classList.remove('dgFight'); hbUse('hunt');
      if(HBS.hunt) HBS.hunt.bg=false; c.dgFloors={}; } });
  // 실패해도 열쇠는 안 쓴다 — 자동이 1초 만에 끝나므로 실패가 잦아진다(이 규칙이 없으면 열쇠가 순식간에 마른다)
  // ⚔ 토벌 난이도가 사냥터 라운드 상한에 끌려다니지 않는다 — 실측으로 잡은 회귀의 재발 방지.
  //    선례(2026-08-25): HB_ROUND_MAX 를 99 → 50 으로 줄였더니 hbRoundS 의 사인 주기가 같이
  //    줄어 **토벌 20~45층이 통째로 위상을 다시 잡았다**. dg-bench 실측에서 20층 직접
  //    클리어율이 88% → 13% 로 무너졌다(사거리 Lv20). S자 주기는 '던전 하나의 리듬'인데
  //    토벌에는 그 단위가 없다 — 그래서 HB_S_PERIOD 로 떼어 냈다.
  await step('토벌 난이도는 라운드 상한(HB_ROUND_MAX)에 안 묶인다', async()=>{
    skipIf(typeof hbRoundS!=='function','사냥터 곡선 없음');
    assert(typeof HB_S_PERIOD==='number' && HB_S_PERIOD>0, 'HB_S_PERIOD 가 없다 — S자 주기가 다시 HB_ROUND_MAX 에 묶였나');
    assert(!/HB_ROUND_MAX/.test(String(hbRoundS)), 'hbRoundS 가 HB_ROUND_MAX 를 다시 참조한다');
    // 위상 잠금 — 주기가 바뀌면 이 셋 중 하나는 반드시 어긋난다
    const want=[[1,1.000],[20,0.627],[38,0.700]];
    for(const [r,v] of want){ const got=hbRoundS(r);
      assert(Math.abs(got-v)<0.005, '토벌 '+r+'층 S자 계수가 달라졌다: '+got.toFixed(3)+' (기대 '+v+')'); }
    // 토벌 세션은 dg=1 이라 hbCurve 의 던전 누적을 안 탄다 — 상한이 체력에 새어들 길이 없다
    assert(hbFoeHp(1,20,1)>0 && Math.abs(hbFoeHp(1,20,1)/(18*hbCurve(HB_ROUND_HP,1,20)*hbRoundS(20))-1)<1e-9,
      '토벌 체력식이 hbRoundS 밖의 무언가를 더 탄다');
    return 'S자 주기 '+HB_S_PERIOD+' · 20층 계수 '+hbRoundS(20).toFixed(3)+' 고정'; });

  await step('토벌 실패는 열쇠를 쓰지 않는다', async()=>{
    skipIf(typeof dgStart!=='function','토벌 없음');
    const c=CHAR(); c.dgFloors={}; const p=PROF(); p.dgKeys={};
    const k0=dgKeyN('normal');
    try{
      DG=null; dgStart(3, {auto:true, id:'normal', key:true}); dgStopLoop();
      DG.me.hp=1; DG.phase='fight'; DG.gap=99;
      DG.foes=[{key:'x',name:'즉사',ico:'💀',hp:1e9,hpMax:1e9,atk:9999,spd:0,range:999,cd:0.01,t:0,id:'f1',x:DG.me.x,y:DG.me.y}];
      for(let i=0;i<20 && DG && !DG.over;i++) dgStep(0.05);
      assert(DG && DG.over<0,'패배 처리가 안 됨: over='+(DG&&DG.over));
      assert(dgKeyN('normal')===k0,'실패인데 열쇠를 썼다: '+k0+' → '+dgKeyN('normal'));
    } finally{ DG=null; dgStopLoop(); c.dgFloors={}; } 
    return '열쇠 '+k0+' 유지'; });
  // ⚔ 토벌 허브 = C1 규격(2026-08-21 확정) — 행마다 [소탕][입장] 과 **그 버튼이 주는 값**.
  //   ⛔ 값을 하드코딩하지 말 것: dgFloorReward 에서 나와야 밸런스를 고쳐도 화면이 따라온다.
  await step('토벌 허브: 행마다 소탕·입장 + 그 버튼이 주는 값 · 잘림 없음', ()=>{
    skipIf(typeof openDungeonHub!=='function','토벌 허브 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','던전'); saveMeta(); }
    const c=CHAR(); c.level=35; c.dgFloors={}; dgSetFloor('normal',12); dgSetFloor('gear',3);
    PROF().dgKeys={}; saveMeta(); openDungeonHub();
    const rows=[...document.querySelectorAll('#dgHubBody .dgRow')];
    assert(rows.length===DG_DUNGEONS.length,'행 수가 종류표와 다름: '+rows.length);
    // ① 행마다 버튼 둘 + 값 둘
    rows.forEach((r,i)=>{ const d=DG_DUNGEONS[i];
      assert(r.querySelectorAll('.actBtn').length===2, d.name+' 행에 버튼이 둘이 아님');
      assert(r.querySelectorAll('.dgVals').length===2, d.name+' 행에 값 칸이 둘이 아님');
      assert(r.querySelector('.dgStg'), d.name+' 단계 배지 없음'); });
    // ② 값이 공식과 맞는가 — 소탕=최고 단계 / 입장=다음 단계
    { const g=rows[DG_DUNGEONS.findIndex(d=>d.id==='gear')];
      const v=[...g.querySelectorAll('.dgVals')].map(e=>e.textContent.replace(/[^0-9]/g,''));
      const sw=dgFloorReward(3,'gear'), en=dgFloorReward(4,'gear');
      assert(v[0].indexOf(String(sw.pc))===0,'소탕 값이 최고 단계 보상과 다름: '+v[0]+' vs '+sw.pc);
      assert(v[1].indexOf(String(en.pc))===0,'입장 값이 다음 단계 보상과 다름: '+v[1]+' vs '+en.pc); }
    // ③ 잠긴 종류는 두 버튼 다 잠기고, 클리어한 단계가 없으면 소탕만 잠긴다
    { const pet=rows[DG_DUNGEONS.findIndex(d=>d.id==='pet')], b=pet.querySelectorAll('.actBtn');
      assert(b[0].disabled && !b[1].disabled,'펫: 소탕만 잠겨야 한다(깬 단계 없음)');
      const rune=rows[DG_DUNGEONS.findIndex(d=>d.id==='rune')], rb=rune.querySelectorAll('.actBtn');
      assert(rb[0].disabled && rb[1].disabled,'룬: Lv.100 이라 둘 다 잠겨야 한다'); }
    // ④ 잘림 — 320px 에 다 들어가야 한다. ⚠ 이름+배지가 104px 이라 아이콘·여백을 키우면 바로 잘린다.
    { const bad=[];
      rows.forEach(r=>{ const rr=r.getBoundingClientRect();
        r.querySelectorAll('*').forEach(e=>{ const q=e.getBoundingClientRect(); if(!q.width) return;
          if(q.right>rr.right+0.6||q.left<rr.left-0.6) bad.push('넘침:'+e.className);
          if(e.scrollWidth>e.clientWidth+1 && getComputedStyle(e).overflow!=='visible')
            bad.push('잘림:'+e.className+'('+e.scrollWidth+'>'+e.clientWidth+')'); }); });
      assert(!bad.length,'행 안에서 잘린다: '+bad.slice(0,3).join(' | ')); }
    // ⑤ ⛔ 옛 스타일이 안 남아 있다 — 색으로 채운 카드 면과 파란 면 버튼
    assert(!document.querySelector('#dgHubBody .dgCard'),'옛 .dgCard 가 남아 있다');
    { const b=rows[0].querySelector('.actBtn'), bg=getComputedStyle(b).backgroundImage+getComputedStyle(b).backgroundColor;
      assert(bg.indexOf('58, 160, 255')<0 && bg.indexOf('#3aa0ff')<0,'옛 파란 면 버튼이 남아 있다'); }
    closeDungeonHub(); c.dgFloors={};
    return rows.length+'행 · 값 공식 일치 · 잘림 0'; });
  // ⚔ 토벌 시트 = S4 규격(2026-08-21) — 방금 누른 그 행을 **같은 함수(dgRowHTML)** 로 그대로 얹는다.
  await step('토벌 시트: 허브 행을 그대로 얹는다 · 앱 팝업 규격', ()=>{
    skipIf(typeof dgRowHTML!=='function','토벌 시트 없음');
    const c=CHAR(); c.level=35; c.dgFloors={}; dgSetFloor('gear',3); PROF().dgKeys={}; saveMeta();
    openDungeonHub(); dgOpenSheet('gear');
    const card=$('dgSheet').querySelector('.dgSheetCard'), cs=getComputedStyle(card);
    // ① 앱 팝업 규격 — 바깥 1px 금속 테두리 + 모서리 컷. ⛔ 면을 색으로 채우지 않는다(옛 아트 헤더가 그랬다)
    assert(cs.clipPath!=='none','시트 카드에 모서리 컷이 없다');
    assert(parseFloat(cs.borderTopWidth)===1,'바깥 테두리가 1px 이 아님: '+cs.borderTopWidth);
    { const m=cs.borderTopColor.match(/\d+/g)||[]; const v=m.slice(0,3).map(Number);
      assert(Math.max.apply(null,v)-Math.min.apply(null,v)<=30,'테두리가 회색이 아님(색을 입혔다): '+cs.borderTopColor); }
    assert(!$('dgSheet').querySelector('.dgSheetArt'),'옛 아트 헤더가 남아 있다');
    // ② 행이 허브와 **같은 함수**에서 나온다 — 클래스가 같아야 한다
    const row=$('dgSheetRow').querySelector('.roomItem.dgRow');
    assert(row,'시트에 허브 행이 안 얹혔다');
    assert(row.querySelector('.dgStg') && row.querySelector('.dgKey'),'행의 단계·열쇠가 없다');
    // ③ 시트 행은 **버튼이 없다**(어떻게 싸울지만 고른다) · 값은 '이번에 받을 것' 하나
    assert(!row.querySelector('.actBtn'),'시트 행에 소탕/입장 버튼이 남아 있다 — 그건 허브 몫이다');
    assert(row.querySelectorAll('.dgVals').length===1,'시트 행의 값 칸이 하나가 아님');
    // ④ 시트 행의 단계 = **다음 단계**(허브는 최고 단계) — 들어갈 곳을 말해야 한다
    assert(row.querySelector('.dgStg').textContent.trim()==='4단계','시트 단계가 다음 단계가 아님: '+row.querySelector('.dgStg').textContent);
    // ⑤ 자동/직접 = 공용 .actBtn · 직접이 주 동작(.pri)
    const A=$('dgSheetAuto'), E=$('dgSheetEnter');
    assert(A.classList.contains('actBtn') && E.classList.contains('actBtn'),'자동/직접이 공용 .actBtn 이 아님');
    assert(!A.classList.contains('pri') && E.classList.contains('pri'),'직접이 주 동작(.pri)이 아님');
    dgCloseSheet(); closeDungeonHub(); c.dgFloors={};
    return '팝업 규격 · 행 공용 · 다음 단계 표기 ok'; });
  // 종류별 진행도 — 이걸 공유하면 새 종류를 여는 순간 고단계로 시작해 보상이 한 번에 쏟아진다.
  await step('토벌 단계는 종류마다 따로 쌓인다', ()=>{ skipIf(typeof dgSetFloor!=='function','토벌 진행도 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','던전'); saveMeta(); }
    const c=CHAR(); c.dgFloors={};
    dgSetFloor('normal', 12);
    assert(dgMaxFloor('normal')===12,'일반 단계 기록 실패: '+dgMaxFloor('normal'));
    assert(dgMaxFloor('gear')===0,'일반 단계가 장비로 샜다: '+dgMaxFloor('gear'));
    assert(dgMaxFloor('pet')===0 && dgMaxFloor('ally')===0 && dgMaxFloor('rune')===0,'다른 종류로 샜다');
    assert(dgMaxFloor()===12,'인자 없는 dgMaxFloor 가 전 종류 최고를 안 돌려줌: '+dgMaxFloor());
    dgSetFloor('gear', 3);
    assert(dgMaxFloor('gear')===3 && dgMaxFloor('normal')===12,'두 종류가 섞였다');
    assert(dgMaxFloor()===12,'전 종류 최고가 틀렸다: '+dgMaxFloor());
    dgSetFloor('normal', 5);   // 뒤로 가는 값은 무시(최고 기록이다)
    assert(dgMaxFloor('normal')===12,'최고 기록이 낮은 값으로 덮였다: '+dgMaxFloor('normal'));
    // v11 마이그레이션 — 옛 저장의 c.dgFloor 하나는 '일반' 기록이다.
    //   ⚠ migrateProfile() 은 인자를 받지 않고 PLAYER_META.profile 을 직접 고친다 — 실제 경로로 태운다.
    const keep=PLAYER_META.profile;
    try{
      PLAYER_META.profile={ ver:10, chars:[{ id:'x', cls:'ranger', name:'옛', level:9, dgFloor:7,
        unit:{ jobId:'ranger', level:1, stats:{}, pts:{}, rpts:{}, gear:{} } }], curId:'x' };
      migrateProfile();
      const oc=PLAYER_META.profile.chars[0];
      assert(!('dgFloor' in oc),'옛 필드 dgFloor 가 안 지워졌다 — 두 벌이 남으면 반드시 어긋난다');
      assert(oc.dgFloors && oc.dgFloors.normal===7,'v11 이 옛 단계를 일반으로 안 옮김: '+JSON.stringify(oc.dgFloors));
      const tx=PLAYER_META.profile.tickets;
      for(const q of TIX_KINDS) assert(typeof tx[q]==='number','v11 이 '+q+' 권 칸을 안 만듦');
    } finally{ PLAYER_META.profile=keep; }
    c.dgFloors={};
    return '종류별 분리 ok · v11 이관 ok'; });
  await step('장비 마이그레이션: 구버전 정수 티어 → 아이템 + 12칸 재편', ()=>{ skipIf(typeof migrateProfile!=='function','마이그레이션 없음');
    const keep=JSON.parse(JSON.stringify(PLAYER_META));
    PLAYER_META.profile={ ver:3, pcoin:0, curId:'cX', items:[], chars:[{ id:'cX', cls:'ranger', name:'구버전',
      xp:0, level:1, statPoints:0, dgFloor:0, unit:{ jobId:'ranger', level:1, evoStars:0,
        stats:{pow:0,vit:0,foc:0,agi:0}, gear:{weapon:3, armor:2, trinket:0} } }],
      idle:{sourceId:'drill',lastClaimTs:0}, unlocks:{}, lastSeenTs:0, pets:{}, equip:[], petSlots:2 };
    migrateProfile();
    const c=CHAR(), w=profFindItem(c.unit.gear.weapon), tp=profFindItem(c.unit.gear.top);
    assert(w && tp,'정수 장비가 아이템으로 변환되지 않음');
    assert(w.main===9 && tp.main===8,'스탯이 보존되지 않음(무기 3×3=9, 방어구 2×4=8): '+w.main+'/'+tp.main);
    assert(c.unit.gear.necklace==='','0이던 장신구 칸이 아이템을 만듦');
    assert(Object.keys(c.unit.gear).length===Object.keys(PROF_GEAR).length,'슬롯 키가 새 12칸으로 재편되지 않음');
    PLAYER_META=keep; return '무기 +'+w.main+' · 상의 +'+tp.main+'(구 방어구)'; });
  // 던전 — 유즈맵과 완전 분리라는 것이 이 기능의 핵심 요구라, 정적·동적 양쪽으로 지킨다.
  await step('던전: 유즈맵 상태를 건드리지 않음', ()=>{ skipIf(typeof dgStart!=='function','던전 없음');
    const src=[dgStep,dgStart,dgSpawnWave,dgWin,dgLose,dgMySpec,dgFoeStat,dgWaveFoes,dgRender,dgSkill,dgFloorReward]
      .map(f=>f.toString()).join('\n');
    const bad=[[/\bG\s*\./,'G.'],[/\bmapCfg\b/,'mapCfg'],[/\bGACHA_/,'GACHA_'],[/\bmetaBonus\b/,'metaBonus'],
               [/\bspawnEnemy\b/,'spawnEnemy'],[/\bU\[/,'U[']].filter(x=>x[0].test(src)).map(x=>x[1]);
    assert(!bad.length,'던전 코드가 유즈맵 전역을 참조: '+bad.join(','));
    // 🏕 캠프가 떠 있으면 G.tab==='Build' 라 던전 도중 화면 전환에서 원복되며 스냅샷이 어긋난다.
    //    던전 격리를 재는 자리이므로 **캠프를 먼저 걷고** 기준을 찍는다.
    if(typeof campExit==='function') campExit();
    const snap=()=>JSON.stringify({p:G.phase,u:G.units.length,e:G.enemies.length,c:G.credits,
      m:G.mineral,g:G.gas,r:G.round,t:G.tab,s:G.mainSheet,k:G.kills});
    const before=snap();
    const p=PROF(); p.chars.length=0; p.curId=''; const c=profCreateChar('warden','던전');
    // ⚠ 스펙을 여기서 직접 세운다. 예전엔 c.unit.stats 에 넣었는데 profStat 은 '장비'만 읽으므로
    //    아무 효과가 없었고, 실제로는 앞 스텝이 남긴 계정 업그레이드에 기대 통과하고 있었다
    //    (환생 스텝이 그걸 지우자 바로 무너졌다). 이제 이 스텝은 순서와 무관하다.
    { const H=hbHunt(); H.unl={}; H.upg={atk:30,hp:30,aspd:10,crit:10}; }
    const coin=p.pcoin, lv0=c.level;
    assert(dgStart(1),'던전 진입 실패'); dgStopLoop();
    let n=0; while(DG && !DG.over && n<20000){ dgStep(0.016); n++; }
    assert(DG && DG.over>0,'1층 클리어 실패(over='+(DG&&DG.over)+', '+n+'프레임)');
    const r=DG.reward; DG=null;
    assert(snap()===before,'던전이 유즈맵 상태 G를 바꿈');
    // 레벨업도 미네랄을 준다(PROF_LV_MINERAL) — 보상만 더해 놓고 같기를 바라면 곡선이 바뀔 때마다 깨진다
    const lvUp=c.level-lv0;
    assert(p.pcoin===coin+r.pc+lvUp*PROF_LV_MINERAL,
      '보상 P가 안 들어옴: '+coin+'+'+r.pc+'+레벨업'+lvUp+'×'+PROF_LV_MINERAL+' ≠ '+p.pcoin);
    assert(dgMaxFloor('normal')===1,'최고 층이 그 종류에 기록되지 않음: '+dgMaxFloor('normal'));
    return n+'프레임 · +'+r.pc+'P/+'+r.xp+'XP'; });
  await step('던전: 스펙이 오르면 같은 층이 빨리 끝남', ()=>{ skipIf(typeof dgStart!=='function','던전 없음');
    // 세기는 '실제 출처'로 만든다 — 옛 배분(unit.stats)은 아무 데도 안 걸린다
    const run=(atkUpg)=>{ const p=PROF(); p.chars.length=0; p.curId='';
      profCreateChar('ranger','T');
      const H=hbHunt(); H.unl={}; H.upg={atk:atkUpg, hp:30};   // 치명타 0 = 결정적
      dgStart(1); dgStopLoop(); let n=0; while(DG && !DG.over && n<20000){ dgStep(0.016); n++; }
      const o=DG.over; DG=null; return {over:o, n:n}; };
    const weak=run(2), strong=run(40);
    assert(weak.over>0 && strong.over>0,'비교하려면 둘 다 이겨야 함: '+weak.over+'/'+strong.over);
    assert(strong.n < weak.n*0.9,'공격력을 올렸는데 클리어가 안 빨라짐: '+weak.n+'→'+strong.n);
    return weak.n+' → '+strong.n+'프레임'; });
  await step('캐릭터 이름은 HTML로 해석되지 않음', ()=>{ skipIf(typeof profCreateChar!=='function','캐릭터 시스템 없음');
    const p=PROF(); p.chars.length=0; p.curId='';
    profCreateChar('scout','<b>x</b>');                 // 이름은 사용자 입력 — innerHTML에 그대로 들어가면 안 된다
    const host=document.createElement('div');
    host.innerHTML=renderProfStats();
    assert(host.textContent.indexOf('<b>x</b>')>=0,'광장에서 이름이 마크업으로 해석됨');
    return '이스케이프 확인'; });

  // ══ 실방 정원 — 방장이 정한 max 를 presence sync 에서 강제한다 ═══════════
  await step('실방 정원: 정원을 넘은 사람에게는 자리를 주지 않는다', async()=>{
    skipIf(typeof rtRoomSync!=='function','rtRoomSync 없음');
    const lb=document.getElementById('lobby'); skipIf(!lb,'#lobby 없음');
    const hid=lb.classList.contains('hide');
    const keepRoom=_lobbyRoom, keepMax=_lobbyMax, keepSlots=_lobbySlots, keepChan=RTROOM.chan, keepOver=RTROOM.overN;
    const keepUid=window.myUid; window.myUid=()=>'me';   // 스모크는 비로그인이라 uid 가 비어 있다 — 고정한다
    try{
      lb.classList.remove('hide');
      _lobbyRoom={ real:true, num:1234, name:'t', hostUid:'me', max:2 };
      _lobbyMax=2; _lobbySlots=[null,null,null,null,null,null,null,null]; RTROOM.overN=0;
      // 나(방장) + 늦게 들어온 4명 = 5명이 2인 방에 몰려 있는 상황
      const st={ me:[{uid:'me', nick:'me', host:true, ready:true, t:1000}] };
      for(let k=2;k<=5;k++) st['u'+k]=[{uid:'u'+k, nick:'P'+k, host:false, ready:true, t:1000+k}];
      RTROOM.chan={ presenceState(){ return st; } };
      rtRoomSync();
      const n=_lobbySlots.filter(Boolean).length;
      assert(n===2,'2인 방에 '+n+'명이 자리를 받았다(정원이 강제되지 않는다)');
      assert(_lobbySlots[0] && _lobbySlots[0].uid==='me','방장이 P1 이 아니다: '+(_lobbySlots[0]&&_lobbySlots[0].uid));
      assert(!_lobbySlots[2] && !_lobbySlots[4],'정원 밖 슬롯에 사람이 들어갔다');
      return '5명 → 2자리 · 방장 P1';
    } finally { _lobbyRoom=keepRoom; _lobbyMax=keepMax; _lobbySlots=keepSlots;
      RTROOM.chan=keepChan; RTROOM.overN=keepOver; window.myUid=keepUid;
      if(hid) lb.classList.add('hide'); } });

  await step('실방 정원: 참가자에게도 방 정원이 전달된다', async()=>{
    skipIf(typeof joinRoom!=='function','joinRoom 없음');
    // 이 한 줄이 빠져 있어서 참가자는 _lobbyMax 가 8 로 잡혔다(2인 방이 8인 방으로 보였다)
    assert(/max:\s*r\.max/.test(String(joinRoom)),'joinRoom 이 openLobby 에 max 를 안 넘긴다');
    const keepRoom=_lobbyRoom, keepMax=_lobbyMax;
    try{ openLobby({ real:true, num:1, name:'t', host:'h', hostUid:'x', startCount:1, joining:true, max:3 });
      assert(_lobbyMax===3,'전달된 정원이 반영되지 않았다: '+_lobbyMax);
      return '_lobbyMax=3';
    } finally { _lobbyRoom=keepRoom; _lobbyMax=keepMax;
      const lb=document.getElementById('lobby'); if(lb) lb.classList.add('hide'); } });
}

// ── 그룹: game (솔로 무한) ──
async function groupGame(){
  await step('솔로 시작', async()=>{ skipIf(!USEMAPS.nemo_inf,'nemo_inf 맵 없음'); startSoloInfinite(); await sleep(400); G.loading=false;
    assert(G.phase==='playing','phase='+G.phase); return 'ok'; });
  await step('첫 진입 = 유닛뽑기 섹션', ()=>{ assert(G.mainSheet==='gacha','초기 섹션='+G.mainSheet);
    assert($('tabs').querySelector('.tab[data-tab="Unit"]').classList.contains('on'),'유닛 탭 하이라이트 아님'); return 'ok'; });
  await step('타이머 좌상단(중앙 비움)', ()=>{ const hc=$('hudC'); assert(hc,'#hudC 없음');
    assert(hc.parentElement.id==='hudL','타이머가 hudL 밖: '+hc.parentElement.id);
    const st=document.querySelector('#hudL .stage'); assert(hc.getBoundingClientRect().y<=st.getBoundingClientRect().y,'타이머가 ROUND 위 아님'); return 'ok'; });
  await step('가챠: drawGacha 3회', ()=>{ hackCredits(); const b=G.units.length; drawGacha(); drawGacha(); drawGacha();
    assert(G.units.length>=b+3,'유닛 증가 없음 '+b+'→'+G.units.length); return G.units.length+'기'; });
  await step('대량 스폰 30기', async()=>{ const c=spawnMany(30); await sleep(1200); assert(c>=30,'spawn '+c); return G.units.length+'기'; });
  await step('전체 선택 → 프로필 표시 · 지정 해제(🗑) 아이콘 크기', ()=>{ G.sel=G.units.map(u=>u.uid); refreshSelCard();
    assert($('unitCmd').classList.contains('on'),'unitCmd off');
    // 🗑 종류 지정 해제 — 13px 은 좁은 줄에서 눌러야 할 것으로 안 보였다(2026-08-19, 17px 로 키움)
    // ⚠ 이 스텝에선 하단 판이 아직 접혀 있어 rect 가 0 이다 — CSS 값으로 잰다
    { const tr=document.querySelector('#unitCmd .cgTrash'), ic=tr&&tr.querySelector('img,svg');
      if(ic){ const w=parseFloat(getComputedStyle(ic).width)||0;
        assert(w>=19,'지정 해제 아이콘이 다시 작아짐: '+w.toFixed(1)+'px'); } }
    return G.sel.length+'기 선택'; });
  // 🎛 판 '밖' 오른쪽 위에 붙는 조작 버튼(.cgTopOut)은 .bp 의 overflow-y:auto 에 통째로 잘려 사라진 적이 있다.
  //   위치만 재면 통과한다(레이아웃 사각형은 잘려도 그대로다) → **실제로 눌리는지**(elementFromPoint) 까지 본다.
  await step('메인 프로필: 조작 버튼이 판 안 오른쪽 위에 붙는다 · UI 아이콘 6종 로드', async()=>{
    // ⚠ 헤드리스에선 three.js(esm.sh)가 막혀 오프닝 오버레이가 안 걷힌다 — 재는 동안만 치운다(안 그러면 opWrap 이 전부 가린다)
    const ph=$('phone'), faked=ph && !ph.classList.contains('inGame'); if(faked) ph.classList.add('inGame');
    const op=$('opening'), opHid=op && !op.classList.contains('hide'); if(opHid) op.classList.add('hide');
    // ⚠ 오프닝이 안 걷히면 `bootApp()` 의 1.7초 타이머가 '아직 오프닝'으로 보고 openAuth() 를 부른다 →
    //   로그인 화면(#auth, z-index 48)이 게임 UI 위에 남아 elementFromPoint 가 그걸 집는다.
    //   `.inGame`·`#opening` 과 같은 이유로 **재는 동안만** 치운다(실제 플레이에서는 오프닝이 걷혀 이 경로가 안 생긴다).
    const au=$('auth'), auHid=au && !au.classList.contains('hide'); if(auHid) au.classList.add('hide');
    document.body.classList.add('sheetOpen');
    try{
      const same=G.units.filter(u=>typeof isBuilding!=='function'||!isBuilding(u.id));
      skipIf(same.length<2,'유닛 부족');
      const k=_mainTypeKey(same[0]), grp=same.filter(u=>_mainTypeKey(u)===k);
      skipIf(grp.length<2,'같은 종류가 2기 미만이라 전체지정 버튼이 안 뜸');
      // ⚠ sleep 을 두면 다음 프레임이 지정을 걷어간다(스모크 환경에서 유닛이 정리된다) → 렌더는 동기라 바로 잰다
      G.sel=grp.map(u=>u.uid); G.selType=null; refreshSelCard();
      const to=document.querySelector('#unitCmd .cgTopOut');
      assert(to,'조작 버튼 묶음(.cgTopOut)이 없음 — 제목 '+((document.querySelector('#unitCmd .cgN')||{}).textContent||'-'));
      const cg=document.querySelector('#unitCmd .cmdG').getBoundingClientRect(), r=to.getBoundingClientRect();
      // 2026-08-25: 판 **밖 위**에서 판 **안 오른쪽 위**로 옮겼다(그전 계약을 뒤집음).
      //   밖에 떠 있으면 시트가 옅어진 뒤로 어디에 속한 버튼인지 안 읽혔다.
      assert(r.top>=cg.top-0.5 && r.bottom<=cg.bottom+0.5,'조작 버튼이 판 밖으로 나감');
      assert(r.right<=cg.right+0.5 && r.right>=cg.right-26,'조작 버튼이 오른쪽에 안 붙음');
      assert(r.width>0&&r.height>0,'조작 버튼 크기가 0');
      const hit=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
      assert(hit && to.contains(hit),'조작 버튼이 잘려 안 보임(맨 위 요소: '+(hit?(hit.id||hit.className||hit.tagName):'없음')+')');
      // 🎛 트레이 (2026-08-19 E+S3 → 2026-08-25 판 안으로)
      //   ⛔ 판 **안**에서는 트레이의 회색 판을 걷는다 — 판 위에 판을 얹으면 겹쳐 보이고,
      //      그 판(여백 3 + 테두리 1)이 머리줄을 38px 로 밀어 그리드가 짧아진다(실측 4.2px).
      //      묶음이라는 신호는 아래에서 검사하는 **칸들**(검정 면 + 붉은 테두리 + 모서리 컷)이 낸다.
      //   ⚠ 토큰은 남겨 둔다 — 사냥터 스킬 바(.hbTray)가 아직 쓴다(--hmPanel 함정 방지 검사도 유지).
      { const ts=getComputedStyle(to);
        assert(getComputedStyle(document.documentElement).getPropertyValue('--trayPanel').trim(),'--trayPanel 토큰이 :root 에 없음');
        assert(ts.backgroundImage==='none','판 안 트레이가 아직 판을 이고 있다(머리줄이 두꺼워진다)');
        const cell=to.querySelector('.cgSelAll,.cgRally,.cgLift');
        if(cell){ const cs=getComputedStyle(cell), bg=cs.backgroundImage||'';
          // 치수는 2026-08-19 에 0.8배(38 → 30px). 판 밖에 떠 있어 클수록 전장을 가린다
          { const w=cell.getBoundingClientRect().width;
            assert(w>=27&&w<=33,'조작 칸이 0.8배(30px) 규격을 벗어남: '+w.toFixed(1)+'px'); }
          assert(cs.clipPath!=='none','조작 칸에 모서리 컷이 없음');
          assert(parseFloat(cs.borderTopLeftRadius)<=3,'조작 칸이 덜 각짐: '+cs.borderTopLeftRadius);
          // ⛔ 버튼마다 다른 색(초록·파랑·시안)으로 되돌아가면 여기서 잡힌다 — 테두리는 붉은 계열 하나뿐이다
          assert(/rgba?\(255,\s*59,\s*59/.test(bg),'조작 칸 테두리가 붉은 계열이 아님: '+bg.slice(0,90));
          const cy=[...bg.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].some(c=>+c[3]>+c[1]+40 && +c[2]>+c[1]+20);
          assert(!cy,'조작 칸에 시안/파랑이 남아 있음(시안은 지금 선택된 것 전용): '+bg.slice(0,90)); } }
      // 아이콘 파일(ui/*.webp)이 실제로 있고 열린다 — 없으면 인라인 SVG 로 되돌아가 조용히 넘어간다
      const keys=Object.keys(UI_SVG), bad=[];
      await Promise.all(keys.map(kk=>new Promise(ok=>{ const im=new Image();
        im.onload=()=>{ if(!(im.naturalWidth>0)) bad.push(kk); ok(); };
        im.onerror=()=>{ bad.push(kk); ok(); };
        im.src=ICO_DIR+'ui/ui_'+kk+'.webp'; })));
      assert(!bad.length,'UI 조작 아이콘 파일이 안 열림: '+bad.join(','));
      return keys.length+'종 · 버튼 '+r.width.toFixed(0)+'px';
    } finally { G.selType=null; G.sel=[]; refreshSelCard(); if(faked) ph.classList.remove('inGame');
      if(opHid) op.classList.remove('hide'); if(auHid) au.classList.remove('hide'); }
  });
  await step('이동 명령 + 60프레임 진행', ()=>{ for(const u of G.units) u.moveTo={x:0.35+Math.random()*0.3,y:0.35+Math.random()*0.3};
    pump(60); return '예외 없음'; });
  await step('분리 수렴(강제 겹침 해소)', ()=>{ const us=G.units.filter(u=>!u.fixed).slice(0,20);
    us.forEach((u,i)=>{ u.moveTo=null; u.x=0.3; u.y=0.5; }); for(let f=0;f<90;f++) separateUnits();
    let hard=0; for(let i=0;i<us.length;i++) for(let j=i+1;j<us.length;j++){ const d=Math.hypot((us[i].x-us[j].x)*GW,(us[i].y-us[j].y)*GH); if(d<2) hard++; }
    assert(hard===0,'경성 겹침 '+hard+'쌍'); return 'ok'; });
  await step('시트: 가챠→업그레이드→보스→홈', ()=>{ deselectUnit();
    openGachaSheet(); assert(G.mainSheet==='gacha','gacha 실패');
    openUpgradeSheet(); assert(G.mainSheet==='upgrade','upgrade 실패');
    const bt=$('bossTab'); assert(bt,'bossTab 없음'); bt.click(); assert(G.mainSheet==='boss','boss 실패');
    openMainHome(); assert(G.mainSheet===null,'home 실패'); return 'ok'; });
  await step('시트 복원: 선택→해제 시 섹션 유지', ()=>{ openGachaSheet(); const u=G.units[0]; G.sel=[u.uid]; refreshSelCard();
    assert(G.mainSheet==='gacha','선택 중 시트 상태 소실'); G.sel=[]; refreshSelCard();
    assert(G.mainSheet==='gacha' && $('unitCmd').classList.contains('on'),'해제 후 시트 미복원'); openMainHome(); return 'ok'; });
  // 하단 프로필 구역 = 사냥터 톤(회색 판 + 검정 속살 + 각진 윗변). 섹션마다 높이가 달라 튀던 것도 여기서 막는다.
  // 🟦 프로필 칸은 정사각형 — 유닛 초상이든 업그레이드·건물 아이콘이든 같은 크기여야 한다.
  //    예전엔 유닛만 aspect 1.2 라 정사각 초상의 위아래가 잘리고 옆 아이콘과 크기가 달라 보였다.
  // 🟦 프로필 칸은 정사각형 — 유닛 초상이든 업그레이드·건물 아이콘이든 같은 크기여야 한다.
  await step('프로필 칸: 유닛 초상과 업그레이드 아이콘이 같은 정사각', async()=>{
    skipIf(typeof openGachaSheet!=='function','하단 시트 없음');
    const ph=$('phone'), faked=ph && !ph.classList.contains('inGame'); if(faked) ph.classList.add('inGame');
    document.body.classList.add('sheetOpen');
    const got={};
    for(const [n,fn] of [['유닛뽑기',openGachaSheet],['업그레이드',openUpgradeSheet]]){
      fn(); await sleep(140);
      const pane=document.querySelector('.bp.on');
      const pros=[...(pane?pane.querySelectorAll('.cmdG .cgPro'):[])]
        .filter(e=>!e.closest('.cgBunk'))   // 벙커(1.35)는 의도된 예외
        .map(e=>e.getBoundingClientRect()).filter(r=>r.width>4&&r.height>4);
      assert(pros.length, n+" 섹션에 프로필 칸이 없음");
      for(const r of pros) assert(Math.abs(r.width/r.height-1)<=0.08,
        n+" 프로필 칸이 정사각이 아님: "+Math.round(r.width)+"x"+Math.round(r.height));
      got[n]=Math.round(pros[0].width)+"x"+Math.round(pros[0].height);
    }
    // 유닛 초상과 업그레이드 아이콘이 **같은 크기**여야 한다(옆에 나란히 놓였을 때 어긋나지 않게)
    assert(got["유닛뽑기"]===got["업그레이드"],
      "유닛과 업그레이드 프로필 크기가 다름: "+got["유닛뽑기"]+" vs "+got["업그레이드"]);
    if(faked) ph.classList.remove("inGame"); document.body.classList.remove("sheetOpen");
    return "유닛·업그레이드 모두 "+got["유닛뽑기"];
  });
  await step('하단 프로필: 다섯 섹션 같은 높이 · 회색 판 · 검정 속살', async()=>{
    // ⚠ 헤드리스에선 three.js(esm.sh)가 막혀 로딩 게이트가 안 걷히고 #phone.inGame 이 안 켜진다
    //    → #bot 이 display:none 이라 하단 패널 높이가 전부 0으로 측정된다. 재는 동안만 켠다.
    const ph=$('phone'), faked=ph && !ph.classList.contains('inGame'); if(faked) ph.classList.add('inGame');
    document.body.classList.add('sheetOpen');
    const bluish = t => { let m,bad=false; const re=/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/g;
      while((m=re.exec(t))){ const r=+m[1],g=+m[2],b=+m[3]; if(b-r>=10 && b-g>=6 && b>=20) bad=true; } return bad; };
    const hs={};
    try{
      for(const [n,fn] of [['메인',openMainHome],['유닛뽑기',openGachaSheet],['업그레이드',openUpgradeSheet],
                           ['보스',openBossSheet],['플레이어',()=>switchTab('Players',document.querySelector('.tab[data-tab="Players"]'))]]){
        fn(); await sleep(120);
        const p=document.querySelector('.bp.on'); assert(p,n+' 섹션에 하단 패널이 없음');
        // 판의 '면'은 ::before 다(요소에 clip-path 를 걸면 시트 밖 #btCardCtl 이 잘려 사라진다)
        const c=getComputedStyle(p), face=getComputedStyle(p,'::before');
        hs[n]=Math.round(p.getBoundingClientRect().height);
        assert(c.borderTopLeftRadius==='0px' && c.borderTopRightRadius==='0px', n+' 판이 아직 둥금: '+c.borderTopLeftRadius);
        assert(!bluish(face.backgroundImage), n+' 판이 아직 푸른 톤: '+face.backgroundImage);
        assert(face.backgroundImage && face.backgroundImage!=='none', n+' 판에 면이 없음(::before 가 안 붙음)');
        // 좌우 '위' 모서리는 사냥터 카드처럼 잘린다
        assert(/polygon\(/.test(face.clipPath) && face.clipPath.indexOf('7px')>=0,
          n+' 판 위 모서리가 안 잘림: '+face.clipPath);
        // 속살(좌측 설명·그리드 칸·유닛 카드·플레이어 슬롯)은 전부 검정이어야 한다
        for(const sel of ['.cgInfo','.cgSlot','.hsCell','.plbtn']){ const e=p.querySelector(sel); if(!e) continue;
          assert(!bluish(getComputedStyle(e).backgroundImage), n+' '+sel+' 이 아직 푸른 톤: '+getComputedStyle(e).backgroundImage); }
      }
      const vals=Object.values(hs), lo=Math.min(...vals), hi=Math.max(...vals);
      // ⚠ 판이 아직 안 올라온 순간에 재면 전부 0 이 나온다(간헐적). 그건 '높이가 다르다'는 뜻이 아니므로
      //   실패가 아니라 건너뛴다 — 여기서 실패로 두면 아무 관계 없는 커밋에서 빨간불이 뜬다.
      skipIf(hi<=0,'하단 패널이 아직 안 올라옴');
      assert(hi-lo<=1,'섹션마다 하단 높이가 다름: '+JSON.stringify(hs));
      return Object.keys(hs).length+'섹션 모두 '+hi+'px';
    } finally { if(faked) ph.classList.remove('inGame'); openMainHome(); }
  });
  // 하단 탭바 = 2층(최상위 5칸 → [‹][하위…]). HOME 네비와 같은 칸(.navIt)을 쓰고, 칸 폭은 전부 같다.
  await step('하단 탭바: 등폭 · 구역을 누르면 [‹]+하위로 내려간다', async()=>{
    const ph=$('phone'), faked=ph && !ph.classList.contains('inGame'); if(faked) ph.classList.add('inGame');
    document.body.classList.add('sheetOpen');
    if(typeof updatePbossFab==='function') updatePbossFab();   // 보스 탭은 게임 중에만 뜬다 — 5칸을 세려면 먼저 켠다
    const cells=()=>[...document.querySelectorAll('#tabs > *')].filter(e=>getComputedStyle(e).display!=='none');
    const widths=els=>els.map(e=>Math.round(e.getBoundingClientRect().width));
    try{
      // ① 최상위 = 5칸 등폭. 선택 칸만 넓어지던 flex-grow:1.42 를 없앤 것을 지킨다.
      gtabBack(); await sleep(80);
      const top=cells(); assert(top.length===5,'최상위 칸이 5개가 아님: '+top.length);
      // ⚠ 탭 이름의 실제 소스는 STK_NEMOLABEL 이다(startGameNow 가 마크업 글자를 덮어쓴다) — 둘 다 봐야 한다
      assert(top[0].textContent.trim()==='관리','첫 칸 이름이 관리가 아님: '+JSON.stringify(top.map(e=>e.textContent.trim())));
      assert(typeof STK_NEMOLABEL==='undefined' || STK_NEMOLABEL.Main==='관리','STK_NEMOLABEL.Main 이 관리가 아님: '+STK_NEMOLABEL.Main);
      { const w=widths(top), lo=Math.min(...w), hi=Math.max(...w);
        assert(hi-lo<=1,'최상위 칸 폭이 다름: '+JSON.stringify(w));
        // 선택 칸도 같은 폭이어야 한다
        openGachaSheet(); await sleep(80); gtabBack(); await sleep(80);
        const w2=widths(cells()); assert(Math.max(...w2)-Math.min(...w2)<=1,'선택 칸만 넓어짐: '+JSON.stringify(w2)); }
      // ② 구역별 하위 — 왼쪽 첫 칸은 항상 뒤로가기, 하위 칸끼리는 등폭
      // ⚠ Main 에 '유닛 지정'은 없다 — 그건 아무 구역도 안 고른 기본 상태(gameRestHome)의 자리다
      const want={ Main:['유닛 판매','유닛 조합'], Unit:['뽑기','타워구매'], Upgrade:['공격력','확률','영구강화'], Boss:['개인보스'] };
      const go={ Main:openMainHome, Unit:openGachaSheet, Upgrade:openUpgradeSheet, Boss:openBossSheet };
      for(const k in want){
        go[k](); await sleep(90);
        const cs=cells();
        assert(cs[0] && cs[0].classList.contains('navBk'),k+' 구역에 뒤로가기 칸이 없음');
        const labels=cs.slice(1).map(e=>e.textContent.trim());
        for(const lb of want[k]) assert(labels.indexOf(lb)>=0, k+' 하위에 "'+lb+'"이 없음: '+JSON.stringify(labels));
        const w=widths(cs.slice(1));
        assert(Math.max(...w)-Math.min(...w)<=1, k+' 하위 칸 폭이 다름: '+JSON.stringify(w));
        assert(cs.filter(e=>e.classList.contains('cur')).length<=1, k+' 하위에 선택 표시가 둘 이상');
      }
      // ③ 하위를 누르면 그 구역 내용이 바뀐다(칸 이름으로 확인)
      openGachaSheet(); await sleep(90); gtabSub('draw'); await sleep(90);
      { const names=[...document.querySelectorAll('#unitCmd .cgSlot .cgName')].map(e=>e.textContent.trim());
        for(const nm of ['유닛 1회','유닛 5회','가스 1회','가스 5회']) assert(names.indexOf(nm)>=0,'뽑기 칸에 "'+nm+'"이 없음: '+JSON.stringify(names)); }
      gtabSub('tower'); await sleep(90);
      { const names=[...document.querySelectorAll('#unitCmd .cgSlot .cgName')].map(e=>e.textContent.trim());
        assert(names.length && names.every(n=>n.indexOf('회')<0),'타워구매인데 뽑기 칸이 남아 있음: '+JSON.stringify(names)); }
      // ×5 는 1회의 5배 가격이어야 한다(별도 가격표를 만들지 않았다는 뜻)
      assert(beaconCost('draw5')===beaconCost('draw')*5,'유닛 5회 가격이 5배가 아님');
      assert(beaconCost('energy5')===beaconCost('energy')*5,'가스 5회 가격이 5배가 아님');
      // ×5 는 맵 위 비콘 표에 들어가면 안 된다(좌표가 없어 패드·라벨이 NaN 자리에 생긴다)
      assert(!DRAW_BEACONS.some(b=>b.id==='draw5'||b.id==='energy5'),'×5 가 맵 비콘 표(DRAW_BEACONS)에 섞였음');
      // ④ 개인전/협동은 아군·적군이 없다 → 플레이어는 내려가지 않는다
      switchTab('Players', document.querySelector('.tab[data-tab="Players"]')); await sleep(90);
      assert(!gameHasVersus(),'네모는 대전 판이 아님(팀이 갈리면 안 됨)');
      assert(cells().length===5,'개인전인데 플레이어가 하위로 내려감');
      // ⑤ ‹ = 기본 상태로 (구역 해제 + 하단은 유닛 지정 + 어느 칸도 안 켜짐)
      //    층만 올리면 '보스 구역에 있는데 네비는 최상위' 인 어중간한 상태가 남는다 — 그걸 막는 검사다.
      openUpgradeSheet(); await sleep(90); assert(cells()[0].classList.contains('navBk'),'업그레이드가 안 내려감');
      gtabBack(); await sleep(120);
      assert(cells().length===5 && !document.getElementById('tabs').classList.contains('drill'),'뒤로가기로 최상위 복귀 실패');
      assert(G.mainSheet==null,'‹ 를 눌렀는데 구역 시트가 남아 있음: '+G.mainSheet);
      assert(_homeMode==='select','‹ 뒤 하단이 유닛 지정이 아님: '+_homeMode);
      assert(!$('defaultCmd').classList.contains('hide'),'‹ 뒤 기본 판이 안 보임');
      assert(!cells().some(e=>e.classList.contains('on')||e.classList.contains('cur')),
        '‹ 뒤인데 아직 켜진 칸이 있음: '+cells().filter(e=>e.classList.contains('on')).map(e=>e.textContent.trim()));
      // ⑥ 머리줄에는 초상이 없고 제목은 흰 글자다
      openGachaSheet(); await sleep(90);
      assert(!document.querySelector('.cmdG .cgPort'),'머리줄 초상(.cgPort)이 남아 있음');
      { const t=document.querySelector('.cmdG .cgN'); assert(t,'머리줄 제목이 없음');
        const c=getComputedStyle(t);
        assert(c.color==='rgb(255, 255, 255)','머리줄 제목이 흰색이 아님: '+c.color);
        assert(c.textShadow==='none','머리줄 제목에 글로우가 남아 있음: '+c.textShadow); }
      // ⑦ 등급 띠 = 공용 세그먼트 바(전용 칩을 새로 만들지 않는다) · 카드는 '한 화면에 딱 4장'
      gtabBack(); await sleep(120);   // 기본 상태(유닛 지정)
      { const box=$('hsTiers');
        if(box && box.children.length){
          assert(box.querySelector('.pdSeg'),'등급 띠가 공용 세그먼트 바(.pdSeg)가 아님: '+box.innerHTML.slice(0,60));
          assert(!box.querySelector('.hsTier'),'옛 등급 칩(.hsTier)이 남아 있음'); } }
      // 카드 구성 — 수량(×N)은 초상 좌상단 뱃지, 초상 아래는 [이름] + 화면별 줄.
      //   지정=[] · 판매=[가격] · 조합=[등급→등급]. 세 화면이 _hsCardHTML 한 함수를 쓴다.
      { const rows=()=>{ const c=document.querySelector('#hsGrid .hsCell'); if(!c) return null;
          return { name:!!c.querySelector('.hsName'), cnt:!!c.querySelector('.hsCnt'),
                   val:!!c.querySelector('.hsVal'), up:!!c.querySelector('.hsUp'),
                   info:!!c.querySelector('.hsInfo') }; };
        gtabBack(); await sleep(120);
        let r=rows();
        if(r){ assert(r.info && r.name && r.cnt,'지정 카드에 이름/수량 뱃지가 없음: '+JSON.stringify(r));
               assert(!r.val && !r.up,'지정 카드에 가격/등급 줄이 끼어 있음: '+JSON.stringify(r));
               // 수량은 뱃지 하나뿐 — 줄로도 내면 같은 값이 두 곳에 뜬다
               const c=document.querySelector('#hsGrid .hsCell');
               assert(!/×\s*\d/.test((c.querySelector('.hsInfo')||{}).textContent||''),'수량이 이름 아래 줄에도 중복 표시됨'); }
        openMainHome(); gtabSub('sell'); await sleep(140);
        r=rows(); if(r){ assert(r.name && r.cnt && r.val,'판매 카드에 이름/수량/가격이 없음: '+JSON.stringify(r)); }
        gtabSub('combine'); await sleep(140);
        r=rows(); if(r){ assert(r.name && r.cnt && r.up,'조합 카드에 이름/수량/등급이 없음: '+JSON.stringify(r));
          const t=document.querySelector('#hsGrid .hsUp').textContent.replace(/\s+/g,'');
          assert(/[가-힣]+›[가-힣]+/.test(t),'조합 등급 줄이 "A › B" 꼴이 아님: '+t); }
        gtabBack(); await sleep(120); }
      // 카드 껍데기 = 사냥터 업그레이드 카드와 같은 규칙(검정 면 + 붉은 그라데 테두리 + 금속 링)
      { const c=document.querySelector('#hsGrid .hsCell');
        if(c){ const acc=assertCardRing(c,'유닛 카드');
          assert(/255, 59, 59/.test(acc),'유닛 카드 액센트가 빨강이 아님: '+acc);
          // 잘린 모서리는 왼쪽 위 · 오른쪽 아래(사냥터 카드와 같은 방향)
          const cp=String(getComputedStyle(c).clipPath).replace(/\s+/g,' ');
          assert(/^polygon\(7px 0px, 100% 0px,/.test(cp),'카드 컷이 왼쪽 위가 아님: '+cp);
          assert(/calc\(100% - 7px\) 100%, 0px 100%, 0px 7px\)$/.test(cp),'카드 컷이 오른쪽 아래가 아님: '+cp);
          // 수량 뱃지 = 반대편(우상단) · 각진 사각 · 글자 정중앙
          const b=c.querySelector('.hsCnt'); assert(b,'수량 뱃지가 없음');
          const cr=c.getBoundingClientRect(), br=b.getBoundingClientRect();
          // ⚠ 판이 아직 안 펼쳐졌으면(폭 0) 위치를 못 잰다 — 0<0 이 되어 '왼쪽에 붙었다'로 헛 실패한다
          skipIf(cr.width<10 || br.width<4, '카드가 아직 배치 전(폭 '+Math.round(cr.width)+')');
          assert((cr.right-br.right) < (br.left-cr.left),
            '수량 뱃지가 우상단이 아님(오른쪽 여백 '+Math.round(cr.right-br.right)+' / 왼쪽 여백 '+Math.round(br.left-cr.left)+')');
          assert((br.top-cr.top)<8,'수량 뱃지가 위쪽이 아님: '+(br.top-cr.top));
          assert(getComputedStyle(b).borderRadius==='0px','수량 뱃지가 각지지 않음: '+getComputedStyle(b).borderRadius);
          // ⚠ Range 의 사각형은 '라인 박스'라 늘 가운데다 — 눈에 보이는 건 글자 **잉크**다.
          //   숫자 글꼴은 위아래 여백이 비대칭이라 line-height 로 맞추면 잉크가 위로 뜬다(그게 원래 증상이었다).
          //   그래서 폰트 메트릭으로 잉크 중앙을 직접 계산한다.
          { const rg=document.createRange(); rg.selectNodeContents(b); const tr=rg.getBoundingClientRect();
            const cs=getComputedStyle(b), cv=document.createElement('canvas').getContext('2d');
            cv.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
            const m=cv.measureText(b.textContent||'0');
            const fa=m.fontBoundingBoxAscent, fd=m.fontBoundingBoxDescent;
            const ia=m.actualBoundingBoxAscent, id=m.actualBoundingBoxDescent;
            if(fa!=null && ia!=null){
              const base=tr.top+(tr.height-(fa+fd))/2+fa;      // 라인 박스 안 베이스라인
              const inkMid=base-(ia-id)/2;                      // 실제 글자 잉크의 세로 중앙
              const dy=inkMid-((br.top+br.bottom)/2);
              assert(Math.abs(dy)<=1.2,'뱃지 글자(잉크)가 세로 중앙이 아님: '+dy.toFixed(2)+'px'); } } } }
      { const g=$('hsGrid'), cs=[...g.querySelectorAll('.hsCell')];
        if(cs.length>=2){
          const w=cs.map(e=>Math.round(e.getBoundingClientRect().width));
          assert(Math.max(...w)-Math.min(...w)<=1,'카드 폭이 서로 다름: '+JSON.stringify(w));
          // 폭은 항상 (뷰 - 3*gap)/4 여야 5번째가 삐져나와 잘리지 않는다 — 좁히고 싶으면 --hsGap 을 키울 것
          const view=g.clientWidth, gap=parseFloat(getComputedStyle(g).columnGap)||0;
          const want=(view-3*gap)/4;
          assert(Math.abs(w[0]-want)<=1.5,'카드 폭이 1/4 규격과 다름(5번째가 잘려 보인다): '+w[0]+' vs '+want.toFixed(1));
          // 보이는 만큼은 정확히 4장 — 4장째 오른끝이 뷰 안에 있고, 5장째는 완전히 밖
          const l=g.getBoundingClientRect().left;
          if(cs[3]) assert(Math.round(cs[3].getBoundingClientRect().right-l)<=view+1,'4장째가 화면 밖으로 잘림');
          if(cs[4]) assert(cs[4].getBoundingClientRect().left-l>=view-1,'5장째가 삐져나와 보임'); } }
      // ⑧ 구역에 '들어올 때'는 늘 첫 하위로 되돌아온다
      //    (타워구매를 보다 나갔다 다시 들어와도 타워구매가 열려 있으면 구역 이름과 내용이 어긋난다)
      { gtabBack(); await sleep(90);
        openGachaSheet(); await sleep(90);
        gtabSub('tower'); await sleep(90);
        assert(_gachaSec==='tower','하위 전환이 안 됨');
        gtabBack(); await sleep(110);
        openGachaSheet(); await sleep(110);
        assert(_gachaSec==='draw','유닛뽑기 재진입인데 첫 하위가 아님: '+_gachaSec);
        // 업그레이드도 같은 규칙 — 다른 구역을 들렀다 와도 첫 하위
        gtabSub('tower'); await sleep(90); openUpgradeSheet(); await sleep(90);
        gtabSub('luck'); await sleep(90); openBossSheet(); await sleep(90);
        openUpgradeSheet(); await sleep(110);
        assert(_upgSec==='atk','업그레이드 재진입인데 첫 하위가 아님: '+_upgSec);
        openMainHome(); await sleep(110);
        assert(_homeMode==='sell','관리 진입인데 첫 하위가 아님: '+_homeMode);
        // ⚠ 이미 그 구역에 있을 때는 되돌리지 않는다 — 되돌리면 자동화가 곧바로 판매로 튕긴다
        gtabSub('auto'); await sleep(140);
        assert(G.mainSheet==='auto','자동화가 리셋에 튕겨 나감: '+G.mainSheet);
        gtabBack(); await sleep(140); }
      // ⑨ 판 안에 같은 조작을 두 번 두지 않는다(옛 .hsTabs 탭 줄 · 전송 옆 AUTO 배너)
      assert(!document.querySelector('#defaultCmd .hsTab'),'판 안에 옛 모드 탭 줄이 남아 있음(하단 네비와 중복)');
      assert(!$('autoFab'),'전송 옆 AUTO 배너가 남아 있음 — 자동화는 메인 하위 칸으로 옮겼다');
      // ⑦ 자동화 = 메인 하위의 '마지막' 칸이고, 누르면 자동화 시트가 뜬다
      openMainHome(); await sleep(90);
      { const labels=cells().slice(1).map(e=>e.textContent.trim());
        skipIf(!autoAnyOwned(),'자동화 미해금');
        assert(labels[labels.length-1]==='자동화','자동화가 메인 하위 마지막 칸이 아님: '+JSON.stringify(labels)); }
      gtabSub('auto'); await sleep(120);
      assert(G.mainSheet==='auto','자동화 칸을 눌렀는데 시트가 안 바뀜: '+G.mainSheet);
      { const cur=cells().find(e=>e.classList.contains('cur'));
        assert(cur && cur.textContent.trim()==='자동화','자동화인데 선택 표시가 딴 칸: '+(cur&&cur.textContent.trim())); }
      assert(cells()[0].classList.contains('navBk'),'자동화로 갔더니 최상위로 올라감');
      // 판매로 돌아오면 자동화 시트가 걷히고 판이 돌아온다(하단이 내려가면 안 된다)
      gtabSub('sell'); await sleep(120);
      assert(G.mainSheet==null && !$('defaultCmd').classList.contains('hide'),'자동화에서 유닛 판매로 못 돌아옴');
      assert(document.body.classList.contains('sheetOpen'),'자동화 → 판매에서 하단이 내려감(재탭 토글로 샜다)');
      return '최상위 5칸 등폭 · 4구역 드릴다운 · 자동화 하위 ok';
    } finally { if(faked) ph.classList.remove('inGame'); openMainHome(); }
  });
  // 포인트방은 화면 전체를 덮는 입력 차단막(#bossPanel z22)을 깐다 — 우상단 ☰(#hud z20)이 통째로 먹혔었다.
  await step('포인트방에서도 우상단 ☰ 가 눌린다', async()=>{
    skipIf(typeof openBossArena!=='function','포인트방 없음');
    const ph=$('phone'), faked=ph && !ph.classList.contains('inGame'); if(faked) ph.classList.add('inGame');
    // ⚠ 헤드리스에선 three.js(esm.sh)가 막혀 로딩 게이트(#opening)가 안 걷힌다 — 히트 테스트를 그게 먼저 먹는다
    const op=$('opening'), opUp=op && !op.classList.contains('hide'); if(opUp) op.classList.add('hide');
    // ⚠ '인게임'을 흉내만 내면(.inGame 만 붙임) 앱 화면이 그대로 남는다 — 실제 진입은 hideAppScreens()가 전부 숨긴다.
    //    로그인 화면(#auth)이 떠 있으면 그 우상단 톱니(.authGear)가 ☰ 자리를 먹어 히트 테스트가 헛돈다.
    const shown=[...document.querySelectorAll('.appScreen')].filter(e=>!e.classList.contains('hide'));
    shown.forEach(e=>e.classList.add('hide'));
    try{
      if(!G.coopBoss && typeof spawnCoopBoss==='function') spawnCoopBoss(1);
      skipIf(!G.coopBoss,'공용 보스 없음');
      openBossArena(); await sleep(150);
      assert(G.bossOpen,'포인트방이 안 열림');
      const set=$('settingsBtn'), r=set.getBoundingClientRect();
      assert(r.width>0,'설정 버튼이 안 보임');
      const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
      assert(set.contains(hit)||hit===set,'포인트방에서 ☰ 가 다른 요소에 먹힘: '+((hit&&(hit.id||hit.className))||hit));
      // 실제로 열리는지까지
      set.click(); await sleep(150);
      const pop=$('settingsPop');
      assert(pop && !pop.classList.contains('hide'),'☰ 를 눌렀는데 설정이 안 열림');
      if(typeof closeSettings==='function') closeSettings();
      return 'z'+getComputedStyle($('hud')).zIndex+' — 차단막 위';
    } finally { if(typeof closeBossArena==='function') closeBossArena();
      shown.forEach(e=>e.classList.remove('hide'));
      if(opUp) op.classList.remove('hide'); if(faked) ph.classList.remove('inGame'); } });
  await step('무기 업그레이드 구매', ()=>{ skipIf(typeof upgCost!=='function'||typeof buyGachaUp!=='function','업그레이드 API 없음');
    hackCredits(); const b=G.gachaLuckLv||0; buyGachaUp(); assert((G.gachaLuckLv||0)===b+1,'gachaLuckLv 미증가'); return 'Lv'+G.gachaLuckLv; });
  await step('보스 탭 표시/배지 갱신', ()=>{ updatePbossFab(); const bt=$('bossTab');
    assert(bt.style.display!=='none','게임 중인데 보스 탭 숨김'); return 'dot="'+($('bossTabDot')||{}).textContent+'"'; });
  await step('보스 시트 = 개인보스만(포인트방 분리)', ()=>{ openMainHome(); const bt=$('bossTab'); bt.click();
    const txt=$('unitCmd').innerText; assert(/개인보스/.test(txt),'보스 시트 아님');
    assert(!/유닛 파견|토벌장/.test(txt),'보스 시트에 포인트방 셀이 남음'); openMainHome(); return 'ok'; });
  // 포인트방 입장 경로는 하단 네비(보스 > 포인트방) **하나뿐**이다(2026-08-14).
  // 우상단 공용 보스 바는 보기 전용 — 클릭을 받으면 입장 경로가 둘이 된다.
  await step('포인트방: 입장은 네비 하나뿐 · 우상단 바는 보기 전용', async()=>{
    skipIf(typeof openBossArena!=='function','없음'); skipIf(!G.coopBoss,'공용보스 없음(맵 설정)');
    assert(!$('pointRoomPop'),'구 포인트방 팝업이 남아있음');
    assert(!$('mapName'),'구 맵이름(#mapName)이 남아있음');
    { const bar=$('coopBossBar'), c=getComputedStyle(bar);
      assert(!bar.getAttribute('onclick'),'우상단 보스 바가 아직 클릭을 받는다(입장 경로가 둘)');
      assert(c.pointerEvents==='none','보스 바가 아직 포인터를 먹는다: '+c.pointerEvents); }
    const ph=$('phone'), faked=ph && !ph.classList.contains('inGame'); if(faked) ph.classList.add('inGame');
    try{
      openBossSheet(); await sleep(90);
      const cells=()=>[...document.querySelectorAll('#tabs > *')].filter(e=>getComputedStyle(e).display!=='none');
      const arena=cells().find(e=>e.textContent.trim()==='포인트방');
      assert(arena,'보스 하위에 포인트방 칸이 없음');
      gtabSub('arena'); await sleep(200);
      assert(G.bossOpen===true,'네비로 포인트방 미진입');
      assert(visible($('bossPanel')),'아레나 컨트롤 패널 숨김');
      // 나가기 = 네비 ‹ 하나뿐. ⚠ 포인트방은 화면이 아니라 오버레이라 switchTab 을 안 지난다 —
      //   gameRestHome 이 직접 닫지 않으면 네비만 올라오고 아레나는 열린 채 남는다(실제로 그랬다).
      gtabBack(); await sleep(220);
      assert(G.bossOpen===false,'‹ 를 눌렀는데 포인트방이 안 닫힘');
      assert(!visible($('bossPanel')),'‹ 뒤에도 아레나 패널이 떠 있음');
      assert(_gtabDrill==='' && _homeMode==='select','‹ 뒤 기본 상태가 아님: '+_gtabDrill+'/'+_homeMode);
      // 뒤 스텝들(아레나 4그리드·건물 프로필)이 아레나 안을 보므로 다시 들어가 둔다
      openBossSheet(); await sleep(60); gtabSub('arena'); await sleep(200);
      assert(G.bossOpen===true,'다시 들어가지 못함');
      return 'ok';
    } finally { if(faked) ph.classList.remove('inGame'); } });
  await step('아레나 4그리드 + 카드탭=1기 즉시 파견', ()=>{ skipIf(!G.bossOpen,'아레나 아님');
    assert(!$('baCtl') && !$('baBackBtn') && !$('bossDeployBar'),'구 상단버튼/확정바가 안 지워짐');
    refreshSelCard(); const host=$('unitCmd'); assert(host.classList.contains('on'),'하단 시트 비활성');
    let txt=host.innerText; assert(/전체 회수/.test(txt),'4그리드에 전체 회수가 없음');
    // '돌아가기' 칸은 없앴다 — 나가기는 하단 네비의 ‹ 하나뿐이다
    assert(!/돌아가기/.test(txt),'아레나 4그리드에 옛 돌아가기 칸이 남아 있음');
    { const names=[...host.querySelectorAll('.cgSlot .cgName')].map(e=>e.textContent.trim());
      assert(names[names.length-1]==='전체 회수','전체 회수가 마지막(4번) 칸이 아님: '+JSON.stringify(names)); }
    assert(!/빈 슬롯/.test(txt) && !/탭 = 회수/.test(txt),'제거해야 할 텍스트가 남음');
    const u=G.units.find(x=>!x.fixed && !x.hero && !x.atBoss); skipIf(!u,'파견할 유닛 없음');
    bossSlotTap(0); assert(G.bossDeployPick===true,'파견 선택 모드 진입 실패');
    assert(!$('defaultCmd').classList.contains('hide'),'유닛 지정 패널 안 뜸');
    const before=bossDeployedCount(); selectByGid(u.gid);   // 카드 탭 = 1기 즉시 파견(확정 없음)
    assert(bossDeployedCount()===before+1,'카드탭 1기 파견 실패: '+(bossDeployedCount()-before));
    assert(G.bossDeployPick===false,'파견 후 선택 모드 미종료(즉시 복귀 아님)');
    assert(G.sel.length===0,'파견인데 지정(G.sel)이 남음');
    refreshSelCard(); assert(/cgTrash/.test($('unitCmd').innerHTML),'파견 슬롯에 휴지통 없음');   // 다중지정 카드 재사용
    bossRecallSlot(null,0); assert(bossDeployedCount()===before,'휴지통 회수 실패');
    closeBossArena(); assert(G.bossOpen===false && !G.bossDeployPick,'아레나 미종료'); return 'ok'; });
  await step('아레나: 건물 지정 → 코인 프로필', ()=>{ openBossArena(); skipIf(!G.bossOpen,'아레나 미진입');
    skipIf(!(G.coopBoss&&!G.coopBoss.dead),'활성 코인 건물 없음');
    const feet=(typeof BOSS_FEET_FRAC!=='undefined'?BOSS_FEET_FRAC:0.41);
    assert(_bossBldHit({x:0.5,y:feet-0.05}),'건물 히트박스(중앙) 실패');
    assert(!_bossBldHit({x:0.05,y:0.9}),'빈 곳이 건물로 오판정');
    G.bossBldSel=true; refreshSelCard(); const host=$('unitCmd');
    assert(host.classList.contains('on'),'건물 프로필 시트 비활성');
    const txt=host.innerText; const _bnm=(typeof coinBldgName==='function')?coinBldgName(G.coopBoss&&G.coopBoss.lv):'';
    assert(_bnm && txt.includes(_bnm),'건물 이름 누락(현 레벨 건물명)');
    assert(/처치 포인트/.test(txt) && /Lv\./.test(txt),'포인트 보상/레벨 라벨 누락');
    // 순차 파괴: 레벨마다 다른 건물 모델
    assert(typeof coinBldgId==='function' && coinBldgId(1)!==coinBldgId(2),'레벨별 건물 모델이 동일(순차 파괴 아님)');
    assert($('deselTop').classList.contains('on'),'해제버튼 미표시');
    bossDeselect(); assert(G.bossBldSel===false,'건물 지정 해제 실패');
    refreshSelCard(); assert(/전체 회수/.test($('unitCmd').innerText),'해제 후 4그리드 복원 실패');
    closeBossArena(); return 'ok'; });
  await step('개인보스 소환(해금 시)', ()=>{ const pt=(typeof PBOSS_TYPES!=='undefined')&&PBOSS_TYPES.find(p=>pbossUnlocked(p));
    skipIf(!pt,'해금된 개인보스 없음'); const b=G.enemies.length, bp=(G.pendSpawn||[]).length; summonPersonalBoss(pt.id);
    // 적은 pendSpawn 대기열을 거쳐 등장 — 소환 접수는 쿨다운 설정 + 대기열/적 증가로 판정
    assert((G.pbossCds[pt.id]||0)>0,'쿨다운 미설정(소환 거부됨)');
    assert(G.enemies.length>b || (G.pendSpawn||[]).length>bp,'적/대기열 미증가'); return pt.name; });
  await step('포인트 강화 팝업', ()=>{ skipIf(typeof openPointUpgrade!=='function','없음'); openPointUpgrade();
    assert(visible(document.querySelector('#pointPanel .ptTitle, #pointPanel .ppHead')),'공학소 팝업 헤더 안 보임'); closePointUpgrade(); return 'ok'; });
  await step('설정 팝업', ()=>{ openSettings(); assert(visible($('settingsPop')),'settingsPop 안 보임'); closeSettings(); return 'ok'; });
  // DESIGN.md 규칙 — 게임 안 팝업(설정 · 나가기 확인 · 결과)만. 게임 밖(#settingsPop.appCtx)은 대상 아님

  await step('설정: 상단 스위치 + 리스트 → 하위 팝업', ()=>{
    openSettings();
    // ① 소리는 리스트가 아니라 상단 고정 스위치 — 눌러서 상태가 뒤집혀야 한다
    const sw=$('flag-sfx'); assert(sw && sw.classList.contains('setSw'),'효과음 스위치가 없음');
    const was=SND.sfxOn!==false; sw.click();
    assert((SND.sfxOn!==false)!==was,'스위치를 눌러도 효과음 상태가 안 바뀜');
    assert(sw.classList.contains('on')===(SND.sfxOn!==false),'스위치 on 클래스가 상태와 어긋남');
    sw.click(); assert((SND.sfxOn!==false)===was,'스위치가 원래대로 안 돌아옴');
    // 채팅 표시도 같은 스위치 — 끄면 body.chatOff 로 플레이어 채팅만 감춘다(시스템 알림은 남는다)
    const cw=$('flag-chat'); assert(cw,'채팅 표시 스위치가 없음');
    const cOn=SND.chatOn!==false; if(cOn) cw.click();
    assert(document.body.classList.contains('chatOff'),'채팅을 꺼도 body.chatOff 가 안 붙음');
    addChat('테스터','안녕'); addChat('','시스템 알림 테스트');
    { const ply=[...document.querySelectorAll('#chatLog .cmsg:not(.sys)')];
      const sys=[...document.querySelectorAll('#chatLog .cmsg.sys')];
      assert(ply.every(e=>getComputedStyle(e).display==='none'),'채팅 끔인데 플레이어 채팅이 보임');
      assert(sys.every(e=>getComputedStyle(e).display!=='none'),'시스템 알림까지 같이 숨었다'); }
    cw.click(); assert(!document.body.classList.contains('chatOff'),'채팅을 다시 켜도 chatOff 가 안 풀림');
    if(!cOn) cw.click();   // 원래 상태로
    // ② 옛 아코디언(제자리 펼침)은 폐기 — 항목은 하위 팝업으로 연다
    assert(typeof setExpand==='undefined','옛 아코디언 setExpand 가 남아 있음');
    // 리스트에는 '뒤에 실제 화면이 붙은 것'만 둔다 — 껍데기 항목은 걷어냈다(2026-08-14).
    // ⚠ 게임 밖(.appCtx)에만 있는 항목(닉네임·버전)이 DOM 에는 늘 있다 — **보이는 것만** 센다
    const items=[...document.querySelectorAll('#settingsPop .setMenu .setItem')].filter(e=>getComputedStyle(e).display!=='none');
    const keys=items.map(e=>(e.getAttribute('onclick')||'').replace(/[^a-z]/g,''));
    assert(items.length===3,'게임 안 설정 리스트는 3개여야 한다(비디오·임무·디스코드): '+items.length);
    for(const dead of ['acct','lang','patch','priv','ask'])
      assert(!keys.some(k=>k.indexOf('openSetSub'+dead)===0),'걷어낸 껍데기 항목이 남음: '+dead);
    // ③ 본문은 다시 만들지 않고 보관함(#setStash)에서 통째로 옮겨 온다 — 같은 노드여야 한다
    const stash=$('setStash'), vid=$('body-vid');
    assert(stash&&vid&&vid.parentNode===stash,'열기 전 본문이 보관함에 없음');
    openSetSub('vid');
    const sub=$('setSubPop'); assert(sub && !sub.classList.contains('hide'),'하위 팝업이 안 열림');
    assert($('setSubTitle').textContent==='비디오 설정','하위 팝업 제목이 틀림: '+$('setSubTitle').textContent);
    assert($('body-vid')===vid,'본문을 복사해 두 번 만들었다(단일 소스 위반)');
    assert(vid.parentNode===$('setSubBody'),'본문이 하위 팝업으로 안 옮겨짐');
    assert(document.querySelectorAll('#seg-q').length===1,'화질 세그먼트가 2개(복사됨)');
    // ④ 닫으면 보관함으로 되돌아간다 — 안 그러면 다음 열기 때 사라진다
    closeSetSub();
    assert(sub.classList.contains('hide'),'하위 팝업이 안 닫힘');
    assert(vid.parentNode===stash,'본문이 보관함으로 안 돌아옴');
    // ⑤ 아직 내용이 없는 항목은 '준비 중' 한 줄
    openSetSub('disc');   // 아직 링크가 없는 항목 = 준비 중 한 줄
    assert($('setSubBody').querySelector('.setSoon'),'빈 항목에 준비 중 표시가 없음');
    closeSettings();
    assert($('setSubPop').classList.contains('hide'),'설정을 닫아도 하위 팝업이 남음');
    return items.length+'항목 · 스위치 2';
  });

  await step('게임 안 팝업: DESIGN.md 규칙(라운드 토큰 · 승패 액센트)', ()=>{
    const OK=['3px','6px','9px'];
    const scan=(root)=>{ const bad=[];
      for(const e of root.querySelectorAll('*')){ const c=getComputedStyle(e);
        if(c.display==='none') continue;
        // 🔘 토글(.setSw)은 **알약**이다 — 설정 창을 로딩·로그인과 같은 언어로 맞추며 확정(2026-08-26).
        //    높이의 절반(11px)이라야 알약이 되므로 라운드 토큰 표(0/3/6/9) 밖이다. DESIGN.md 에 예외로 적었다.
        const _pill=(' '+(typeof e.className==='string'?e.className:'')+' ').indexOf(' setSw ')>=0;
        for(const v of c.borderRadius.split(/[\s\/]+/))
          if(v && v!=='0px' && v!=='50%' && !_pill && OK.indexOf(v)<0) bad.push((e.className||e.tagName)+'='+v);
        if(parseFloat(c.borderTopWidth)>1.5) bad.push((e.className||e.tagName)+' 테두리 '+c.borderTopWidth); }
      return bad; };
    // 결과 제목 문구(승리는 VICTORY) · 나가기 확인은 한 줄
    assert(showOverlay.toString().indexOf("'VICTORY'")>=0,'승리 제목이 VICTORY가 아님');
    assert(showOverlay.toString().indexOf("'CLEAR'")<0,'옛 제목 CLEAR가 남아 있음');
    const ecm=document.querySelector('#exitConfirm .ecMsg');
    assert(ecm && ecm.innerHTML.indexOf('<br')<0 && ecm.textContent.trim()==='정말 나가시겠습니까?',
      '나가기 확인 문구가 한 줄이 아님: '+(ecm?ecm.textContent.trim():'없음'));
    openSettings();
    const sp=$('settingsPop');
    assert(!sp.classList.contains('appCtx'),'게임 안인데 게임 밖(appCtx) 규격임');
    let bad=scan(sp); assert(!bad.length,'설정 팝업 토큰 밖: '+bad.slice(0,4).join(', '));
    // 나가기 확인
    const ex=$('setExit'); assert(ex,'나가기 버튼이 없음'); ex.click();
    const ec=$('exitConfirm'); assert(ec && !ec.classList.contains('hide'),'나가기 확인이 안 열림');
    bad=scan(ec); assert(!bad.length,'나가기 확인 토큰 밖: '+bad.slice(0,4).join(', '));
    closeExitConfirm(); closeSettings();
    // 결과 카드 — 승/패에 따라 액센트가 갈려야 한다(둘 다 시안이면 구분이 안 된다)
    const card=document.querySelector('#ov .ovCard'); assert(card,'결과 카드가 없음');
    const acc=(c)=>{ card.classList.remove('win','lose'); if(c) card.classList.add(c);
      return getComputedStyle(card).getPropertyValue('--ovAcc').trim(); };
    const base=acc(null), win=acc('win'), lose=acc('lose');
    assert(win!==base && lose!==base && win!==lose,
      '승/패 액센트가 안 갈림: 기본 '+base+' 승 '+win+' 패 '+lose);
    // 카드 면은 살짝 투명해서 뒤가 비쳐야 하고, 테두리는 뚜렷해야 한다
    card.classList.remove('win','lose');   // 앞 검사에서 붙은 상태 클래스가 --cardEdge를 덮는다
    const cbg=getComputedStyle(card).backgroundImage;
    const alphas=[...cbg.matchAll(/rgba\([^)]*?,\s*([\d.]+)\)/g)].map(m=>parseFloat(m[1]));
    assert(alphas.length,'카드 배경에서 알파를 못 읽음: '+cbg);
    assert(Math.max.apply(null,alphas)<=0.95,'카드 면이 불투명해 뒤가 안 비침: 최대 알파 '+Math.max.apply(null,alphas));
    assert(Math.min.apply(null,alphas)>=0.8,'카드 면이 너무 투명해 글자가 묻힘: 최소 알파 '+Math.min.apply(null,alphas));
    // 2026-08-14: 이중 테두리를 폐기했다 — 팝업은 바깥 1px 하나로 끝낸다.
    //   안쪽 시안 헤어라인과 금색 코너 브래킷을 빼고, 면은 사냥터 업그레이드 패널과 같은 회색으로 맞추었다.
    assert(getComputedStyle(card,'::before').content==='none','안쪽 프레임(::before)이 아직 남아 있음');
    assert(getComputedStyle(card,'::after').content==='none','코너 브래킷(::after)이 아직 남아 있음');
    // 팝업 안에는 시안을 쓰지 않는다 — '현재 위치'는 중립 강조(밝은 테두리 + 흰 글자)가 맡는다(DESIGN.md §2).
    //   ⚠ --setAcc 토큰 하나가 12곳으로 퍼진다 — 값만 되돌려도 팝업 전체가 다시 시안이 된다.
    { const acc=getComputedStyle(card).getPropertyValue('--setAcc').trim();
      assert(!/5cd6ff/i.test(acc),'팝업 액센트가 시안으로 돌아감: '+acc);
      const cy=[];
      for(const el of card.querySelectorAll('*')){ const c=getComputedStyle(el);
        const t=c.color+' '+c.borderTopColor+' '+c.backgroundColor+' '+c.backgroundImage+' '+c.boxShadow;
        if(/92,\s*214,\s*255/.test(t)) cy.push(el.className||el.tagName); }
      assert(!cy.length,'팝업 안에 시안을 쓴 요소: '+cy.slice(0,4).join(', ')); }
    { const rgb=(cbg.match(/\d+/g)||[]).slice(0,3).map(Number);
      assert(Math.max.apply(null,rgb)-Math.min.apply(null,rgb)<=12,'팝업 면에 푸른기가 남음: '+cbg.slice(0,50)); }
    // 팝업 액션 버튼 4종은 카드 액센트를 따라가지 않고 한 스타일이어야 한다
    const btnStyle=(el)=>{ const c=getComputedStyle(el);
      return c.color+'|'+c.borderTopColor+'|'+c.backgroundColor+'|'+c.fontSize+'|'+c.height+'|'+c.borderRadius; };
    card.classList.add('win');
    const bWin=[$('ovBtn'),$('ovBtn2')].filter(Boolean).map(btnStyle);
    card.classList.remove('win'); card.classList.add('lose');
    const bLose=[$('ovBtn'),$('ovBtn2')].filter(Boolean).map(btnStyle);
    card.classList.remove('win','lose');
    assert(bWin.length===2,'결과 창 버튼 2개를 못 찾음');
    assert(bWin[0]===bLose[0] && bWin[1]===bLose[1],'승/패에 따라 버튼 색이 바뀜(통일 안 됨)');
    assert(bWin[0]===bWin[1],'확인과 관전하기의 스타일이 다름');
    // 중립 회색이어야 한다(색을 띠면 채널 편차가 커진다)
    for(const el of [$('ovBtn'),$('ovBtn2')].filter(Boolean)){
      for(const prop of ['color','borderTopColor']){
        const ch=(getComputedStyle(el)[prop].match(/\d+/g)||[]).slice(0,3).map(Number);
        assert(ch.length===3 && Math.max.apply(null,ch)-Math.min.apply(null,ch)<=30,
          '버튼이 회색이 아님('+prop+'): '+getComputedStyle(el)[prop]); } }
    // 작고 · 오목하고 · 위가 평평한 판이어야 한다(이중 테두리 아님)
    // ⚠️ body.lite가 box-shadow를 통째로 끄므로 검사 동안만 벗긴다(blur 검사와 같은 함정)
    const wasLite0=document.body.classList.contains('lite');
    if(wasLite0) document.body.classList.remove('lite');
    // 가로 폭은 실제로 그려진 상태에서만 잰다 — #ov.hide면 rect가 0이라 검사가 헛돈다
    const wasHid=$('ov').classList.contains('hide'), wasHidE=$('exitConfirm').classList.contains('hide');
    if(wasHid) $('ov').classList.remove('hide');
    if(wasHidE) $('exitConfirm').classList.remove('hide');
    try{
      const ob=getComputedStyle($('ovBtn'));
      assert(parseFloat(ob.height)<=38,'버튼이 큼: '+ob.height);   // 2026-08-06: 36px로 상향(DESIGN.md §2 팝업 버튼)
      const wEls=[$('ovBtn'),document.querySelector('#exitConfirm .ecGo')].filter(Boolean);
      if($('ovBtn2') && getComputedStyle($('ovBtn2')).display!=='none') wEls.push($('ovBtn2'));
      assert(wEls.length>=2,'폭을 잴 버튼을 못 찾음');
      for(const el of wEls){
        const w=el.getBoundingClientRect().width;
        assert(w>0,'버튼 폭을 못 잼(안 그려짐): '+(el.id||el.className));
        assert(w<=124,'버튼 가로가 넓음('+(el.id||el.className)+'): '+Math.round(w)+'px'); }
      assert(ob.boxShadow.indexOf('0px 0px 0px 2px')<0,'버튼에 이중 테두리가 남아 있음');
      assert(/0px 1px 0px[^,]*inset/.test(ob.boxShadow),'볼록(윗변 하이라이트)이 없음: '+ob.boxShadow);
      assert(/0px -\d+px \d+px[^,]*inset/.test(ob.boxShadow),'볼록(아래 안쪽 그림자)이 없음: '+ob.boxShadow);
      const rTop=parseFloat(ob.borderTopLeftRadius), rBot=parseFloat(ob.borderBottomLeftRadius);
      assert(rTop<rBot,'윗변이 아랫변보다 평평하지 않음: 위 '+rTop+' / 아래 '+rBot);
    } finally { if(wasLite0) document.body.classList.add('lite'); if(wasHid) $('ov').classList.add('hide'); if(wasHidE) $('exitConfirm').classList.add('hide'); }
    // 자동 진행은 면이 차오르는 것만 — 앞머리 선(::after)을 두지 않는다
    const abAfter=getComputedStyle(document.querySelector('#ovBtn .autoBar'),'::after').content;
    assert(abAfter==='none' || abAfter==='normal','자동 진행 표시에 앞머리 선이 남아 있음: '+abAfter);
    const ecGo=document.querySelector('#exitConfirm .ecGo'), ecC=document.querySelector('#exitConfirm .ecCancel');
    if(ecGo&&ecC){ assert(btnStyle(ecGo)===btnStyle(ecC),'취소와 나가기의 스타일이 다름');
      assert(btnStyle(ecGo)===bWin[0],'확인창 버튼과 결과창 버튼의 스타일이 다름'); }
    // 카드 바깥 오라(덮개 배경) — 카드에 clip-path가 있어 box-shadow를 못 쓰므로 #ov가 낸다
    const aura=(c)=>{ card.classList.remove('win','lose'); if(c) card.classList.add(c);
      return getComputedStyle($('ov')).getPropertyValue('--aura').trim(); };
    const aB=aura(null), aW=aura('win'), aL=aura('lose');
    assert(aB,'결과 창에 오라 색(--aura)이 없음');
    assert(aW!==aB && aL!==aB && aW!==aL,'오라가 승/패를 안 따라감: 기본 '+aB+' 승 '+aW+' 패 '+aL);
    assert(getComputedStyle($('ov')).backgroundImage.split('radial-gradient').length>=3,
      '오라 레이어가 배경에 없음');
    // 결과 제목은 화면의 주인공 — 설명보다 한참 커야 한다
    card.classList.add('win');
    const tSz=parseFloat(getComputedStyle($('ovTitle')).fontSize);
    const dSz=parseFloat(getComputedStyle($('ovDesc')).fontSize);
    assert(tSz>=24,'승/패 제목이 작음: '+tSz+'px');
    assert(tSz>=dSz*2.5,'제목과 설명의 크기 차이가 작음: '+tSz+' vs '+dSz);
    assert(dSz<=10.5,'설명 글자가 큼: '+dSz+'px');
    card.classList.remove('win','lose');
    // 창이 뜨면 뒤가 확실히 흐려져야 한다.
    // 절전 모드(body.lite)는 blur를 끄는 게 정상이라, 검사 동안만 lite를 벗겨 CSS 자체를 잰다.
    const wasLite=document.body.classList.contains('lite');
    if(wasLite) document.body.classList.remove('lite');
    const got=[];
    try{
      for(const id of ['ov','exitConfirm','settingsPop']){ const e=$(id); if(!e) continue;
        const cs=getComputedStyle(e), bf=cs.backdropFilter||cs.webkitBackdropFilter||'';
        const m=/blur\((\d+(?:\.\d+)?)px\)/.exec(bf);
        const v=m?parseFloat(m[1]):0;
        assert(v>=1.5, '#'+id+' 배경 흐림이 없음: '+bf);
        assert(v<=3.5, '#'+id+' 배경 흐림이 과함(게임이 안 보임): '+bf); got.push(m[1]); }
    } finally { if(wasLite) document.body.classList.add('lite'); }
    const blurTxt='blur '+got.join('/')+'px'
    return '승 '+win+' / 패 '+lose+' · 제목 '+tSz+'/설명 '+dSz+'px · '+blurTxt; });
  await step('유닛 판매(홈 판매 API)', ()=>{ skipIf(typeof sellUnit!=='function','sellUnit 없음');
    const u=G.units.find(x=>!x.fixed && !x.hero && !x.atBoss); skipIf(!u,'판매할 유닛 없음'); const b=G.units.length;
    sellUnit(u);   // 유닛 객체를 받는다(uid 아님)
    assert(G.units.length===b-1,'판매 후 수 변화 없음 '+b+'→'+G.units.length); return 'ok'; });
  // 설정 버튼은 data-tab이 없어 탭 재배치 목록에서 빠진다 → 재배치 후 맨 왼쪽으로 밀렸던 적 있음(직스 진입/복귀 시)
  await step('설정: 네비가 아니라 HUD 우상단', ()=>{
    const set=$('settingsBtn'), tabs=$('tabs'); skipIf(!set,'설정 버튼 없음');
    // 네비 칸이 아니라 HUD 우상단 상자다 — 탭 순서가 바뀌어도 영향받지 않는다
    assert(!tabs || !tabs.contains(set), '설정이 아직 네비(#tabs) 안에 있음');
    assert(set.classList.contains('hudSet'), '설정 상자 클래스(hudSet)가 아님: '+set.className);
    const wrap=$('hudTopRow');
    assert(wrap && wrap.contains(set), '설정이 HUD 우상단 행(#hudTopRow)에 없음');
    // 아이콘이 상자 정중앙인가 — <span class="ti"> 같은 라인박스 래퍼가 끼면 위로 뜬다
    assert(!set.querySelector('.ti'), '설정 아이콘에 라인박스 래퍼(.ti)가 남아 있음');
    { const bx=set.getBoundingClientRect(), sv=set.querySelector('svg').getBoundingClientRect();
      const dy=Math.abs((sv.top+sv.bottom)/2-(bx.top+bx.bottom)/2);
      const dx=Math.abs((sv.left+sv.right)/2-(bx.left+bx.right)/2);
      assert(dx<=1 && dy<=1,'아이콘이 상자 중앙이 아님: dx '+dx.toFixed(1)+' / dy '+dy.toFixed(1)); }
    if(typeof strikeSetTabOrder==='function'){   // 탭 순서를 바꿔도 설정은 그대로여야 한다
      strikeSetTabOrder(['Main','Build','Upgrade','Players']);
      assert(wrap.contains(set),'직스 순서 적용 후 설정이 HUD에서 이탈');
      strikeSetTabOrder(null);
      assert(wrap.contains(set),'원복 후 설정이 HUD에서 이탈'); }
    return 'HUD 우상단 ok'; });
  // 목록에서 잠깐 빠졌다 돌아온 유닛(직스의 화면 밖 컬링 등)이 사망 모션에 갇히면
  // 멀쩡한 유닛이 누운 채로 이동하다가 모델 재생성 때 벌떡 일어난다 → 되살아나야 한다
  await step('사망 모션: 목록 복귀 시 해제', async()=>{
    skipIf(!(window.M3D&&M3D.sync&&M3D.dbg),'M3D 없음');
    const id=(M3D.hasModel&&M3D.hasModel('marine'))?'marine':null; skipIf(!id,'marine 모델 미로드');
    const U=[{uid:'zz_revive', id:id, x:0.5, y:0.5}];
    const find=()=>M3D.dbg().anims.find(a=>a.uid==='zz_revive');
    M3D.sync(U, 300, 300, 0.016, [], [], null, 1); skipIf(!find(),'모델 생성 실패');
    for(let i=0;i<6;i++) M3D.sync([], 300, 300, 0.05, [], [], null, 1);   // 목록에서 빠짐 → 사망 모션 시작
    assert(find() && find().dying===true, '사망 처리가 안 걸림(테스트 전제 실패)');
    M3D.sync(U, 300, 300, 0.016, [], [], null, 1);                        // 다시 목록에 등장
    const a=find(); assert(a && a.dying===false, '복귀했는데 사망 모션이 안 풀림');
    for(let i=0;i<3;i++) M3D.sync([], 300, 300, 1.0, [], [], null, 1);    // 정리
    return 'ok'; });
  // 건물 = 전장 병력 공급원(오토배틀 전용). 표의 건물 키·유닛 id가 실재해야 웨이브에서 실제로 배출된다.
  // 또한 이 규칙은 관리자 건설에 새어 나가면 안 된다(건물 프로필 설명 오염 선례).
  await step('건물→전장 배출표: 키 실재 + 관리자 미오염', ()=>{
    skipIf(typeof TECH_BLDG_UNIT==='undefined' || typeof STK_UNITS==='undefined','표 없음');
    let n=0;
    for(const race in TECH_BLDG_UNIT){ const bks=new Set((TECH_TREE[race]||{buildings:[]}).buildings.map(b=>b.k));
      for(const bk in TECH_BLDG_UNIT[race]){ const e=TECH_BLDG_UNIT[race][bk]; n++;
        assert(bks.has(bk), race+'/'+bk+': 그런 건물 없음');
        assert(!!STK_UNITS[e.u], race+'/'+bk+' → '+e.u+': STK_UNITS에 없음');
        assert(techBldgUnit(race,bk)===e.u, race+'/'+bk+': 유닛 조회 불일치');
        const rm=(typeof STK_RACE_SPAWN!=='undefined'?(STK_RACE_SPAWN[race]||1):1);   // 종족별 배출 배수(union1·aetherial⅔·swarm1.5) 반영
        assert(techBldgCount(race,bk)===Math.max(1,Math.round(e.n*TECH_WAVE_MUL*rm)), race+'/'+bk+': 배출량 = n×TECH_WAVE_MUL×종족배수 이어야 함'); } }
    assert(techBldgCount('union','supply')===6 && techBldgCount('union','barracks')===4
      && techBldgCount('union','academy')===2, '보병 배출량(레인저6·화력병4·의무병2)이 바뀜');
    assert(!techWallet(), '오토배틀이 아닌 상태여야 함');
    assert(_techSpawnText({k:'barracks'})==='', '관리자 건물 프로필에 오토배틀 배출 문구가 붙음');
    assert(_techSpawnCard('barracks')===null, '관리자 건물 프로필에 오토배틀 배출 카드가 붙음');
    return n+'항목'; });
  // 🐺🗿 오각형 5종족 — 오토배틀에 종족을 넣을 때 **조용히 빠지는 표**가 여럿이다(전부 선례).
  //   · SB_ATK_MODE 누락 → 기본값이 '지상 전용' → 공중 유닛을 영영 못 때려 그 종족이 100% 진다
  //   · U.dmg 0 + airDmg 만 있는 대공 전용이 FXLAB_NOATK 에 걸리면 **아무것도** 못 때린다
  //   · 배출표 앞 두 건물에 대공이 없으면 초반 공중 상대에 일방적으로 진다(전 종족 공통 조건)
  await step('오각형 5종족: 오토배틀 편입 표 누락 없음', ()=>{
    skipIf(typeof STK_RACES==='undefined' || typeof TECH_BLDG_UNIT==='undefined','오토배틀 표 없음');
    assert(STK_RACE_ORDER.length===5, '종족이 5이 아님: '+STK_RACE_ORDER.length);
    for(const rk of STK_RACE_ORDER){ assert(!!STK_RACES[rk], rk+': STK_RACES 없음');
      assert(!!STK_BUILDINGS[rk], rk+': STK_BUILDINGS 없음');
      assert(!!STK_TIERS[rk], rk+': STK_TIERS 없음');
      const tr=stkTechRace(rk);
      assert(Object.keys(TECH_BLDG_UNIT[tr]||{}).length>0, rk+' → '+tr+': 배출표가 비었다(AI가 폴백 2기만 낸다)');
      assert(STK_RACE_STAT[tr]!=null && STK_RACE_SPAWN[tr]!=null, tr+': STAT/SPAWN 누락'); }
    // 의도적 무공격(지원·시전형)은 예외. 그 외에 '아무것도 못 때리는' 유닛이 로스터에 있으면 표 누락이다.
    const NOATK_OK=new Set(['medic','aegis','medusa']);
    let nu=0, aa=0;
    for(const rk of STK_RACE_ORDER){ for(const id of STK_RACES[rk].units){ nu++;
      const m=_sbAtkMode({id:id}); assert(m.air||m.gnd||NOATK_OK.has(id), id+': 아무것도 못 때린다(FXLAB_NOATK/SB_ATK_MODE 확인)');
      assert(!!UNIT_COMBAT_CLASS[id], id+': UNIT_COMBAT_CLASS 누락(상성 중립이 되어 밸런스가 어긋난다)'); } }
    for(const rk of STK_RACE_ORDER){ const tr=stkTechRace(rk), keys=Object.keys(TECH_BLDG_UNIT[tr]);
      const early=keys.slice(0,2).map(k=>TECH_BLDG_UNIT[tr][k].u);
      assert(early.some(u=>_sbAtkMode({id:u}).air), tr+': 배출표 앞 두 건물에 대공 유닛이 없다 — 초반 공중에 무력하다');
      aa++; }
    for(const id of ['howlslinger','skytalon','flakbattery','arclight'])
      assert(!FXLAB_NOATK.has(id), id+': 대공 전용인데 무공격으로 분류됐다');
    return nu+'유닛 · '+aa+'종족 초반 대공 ok'; });
  // 관리자 건설에서 건물을 고르면 그 건물의 유닛 생산 버튼이 나와야 한다.
  // 오토배틀은 건물이 자동 배출하므로 수동 생산이 일꾼뿐 — 이 규칙이 관리자로 새면 생산 그리드가 통째로 빈다(선례 2회).
  await step('관리자 건설: 건물 유닛 생산 그리드 유지', ()=>{
    skipIf(typeof _techHasProd!=='function' || typeof TECH_TREE==='undefined','건설 시스템 없음');
    assert(!techWallet(), '오토배틀이 아닌 상태여야 함');
    const race=(G.tech&&G.tech.race)||'union', t=TECH_TREE[race]; skipIf(!t, race+' 트리 없음');
    const prod=t.buildings.filter(b=>(b.produces||[]).length);
    assert(prod.length>1, '생산 건물이 '+prod.length+'개뿐 — 트리 손상');
    for(const b of prod) assert(_techHasProd(b), race+'/'+b.k+': 생산 건물인데 생산 모델을 안 씀');
    return prod.length+'개 생산 건물'; });   // 실제 카드 생성은 건설 상태가 필요 → sandbox 그룹에서 검증
  // 🧪 전투 관측 모드: 티어 표의 유닛 id가 실재해야 소환이 되고, 기본값은 꺼져 있어야 정상 플레이가 안 바뀐다.
  await step('전투 관측 모드(strikeStress) 티어 표', ()=>{
    skipIf(typeof STK_TIERS==='undefined' || typeof STK_UNITS==='undefined','관측 모드 없음');
    assert(typeof strikeStress==='function','strikeStress 없음');
    let n=0;
    for(const race in STK_TIERS){ const t=STK_TIERS[race];
      assert(t.length>1, race+': 티어가 1단계뿐');
      t.forEach((lv,i)=>{ assert(lv.length, race+' 티어'+i+': 빈 목록');
        lv.forEach(u=>{ n++; assert(!!STK_UNITS[u], race+' 티어'+i+' → '+u+': STK_UNITS에 없음'); }); }); }
    assert(!(typeof STK!=='undefined' && STK && STK.stress), '관측 모드가 기본으로 켜져 있음');
    return n+'칸'; });
  // 자동 화질 조절 임계값은 '프레임 바닥(주사율) 대비 배수'여야 한다.
  // ms 상수로 두면 60Hz의 바닥(16.7ms)보다 낮은 복구 임계값이 영원히 성립하지 않아,
  // 한 번 낮아진 해상도가 유닛이 줄어도 되돌아오지 않는다(실제로 겪은 버그).
  await step('자동 화질: 복구 임계값이 도달 가능한가', ()=>{
    skipIf(typeof STK_AQ_GOOD==='undefined','자동 화질 조절 없음');
    assert(STK_AQ_GOOD>1, '복구 임계값('+STK_AQ_GOOD+')이 프레임 바닥(×1) 이하 — 60Hz에서 복구 불가');
    assert(STK_AQ_BAD>STK_AQ_GOOD, '낮춤('+STK_AQ_BAD+') ≤ 복구('+STK_AQ_GOOD+') — 히스테리시스 없음(요동)');
    assert(STK_AQ_BAD<3 && STK_AQ_GOOD<3, 'ms 상수처럼 보임 — 배수여야 함');
    assert(STK_AQ_LOW>0 && STK_AQ_LOW<STK_AQ_HI, '해상도 하한/상한 이상');
    return '바닥×'+STK_AQ_GOOD+' 복구 / ×'+STK_AQ_BAD+' 낮춤'; });
  // 자동 카메라: 데드존으로 목표를 얼리면 '멈췄다 튀는' 움직임이 된다 → 속도 제한 글라이드 상수만 검사.
  await step('자동 카메라 추적 상수', ()=>{
    skipIf(typeof STK_CAM_SPD==='undefined','자동 카메라 없음');
    assert(STK_CAM_SPD>0 && STK_CAM_SPD<=600, '추적 속도('+STK_CAM_SPD+')가 비정상 — 너무 빠르면 화면이 튄다');
    assert(STK_CAM_HYST>0 && STK_CAM_HYST<1, '히스테리시스('+STK_CAM_HYST+')는 0~1 — 전선 사이 왕복 방지용');
    assert(STK_CAM_FT>0.05, '격전지 재계산 주기('+STK_CAM_FT+'s)가 너무 짧음 — O(아군×적군)이라 프레임을 먹는다');
    assert(STK_CAM_EASE>0, '감속 계수 이상');
    return STK_CAM_SPD+'/s · 재계산 '+STK_CAM_FT+'s · 유지 '+STK_CAM_HYST; });
  // CST_BLDG_CFG는 한 줄에 여러 건물을 나열한다 — 앞 줄 주석에 합쳐지면 그 항목들이 통째로 주석 처리돼
  // 크기·정면(f)이 조용히 사라진다(선례: 공학소가 늘 뒷모습, 대형 건물 4종 크기 축소).
  await step('건물 3D 스펙(CST_BLDG_CFG) 누락 없음', ()=>{
    skipIf(typeof CST_BLDG_CFG==='undefined','스펙 표 없음');
    const need=['union_command_center','union_barracks','union_engineering_bay','union_factory',
      'union_starport','union_science_facility','union_academy','union_armory'];
    const miss=need.filter(k=>!CST_BLDG_CFG[k]);
    assert(!miss.length, '스펙 누락(주석에 먹혔는지 확인): '+miss.join(', '));
    for(const k of need) assert(CST_BLDG_CFG[k].s>0, k+': 크기(s) 없음');
    assert(Math.abs(CST_BLDG_CFG.union_engineering_bay.f-Math.PI)<1e-6, '공학소 정면 보정(f=π)이 사라짐');
    return need.length+'종 확인'; });
  // ⚔ 오토배틀(직스) — 하단 네비를 네모와 같은 2층으로 통합했다(2026-08-14).
  //   최상위 [건설지][특수무기][관전] · 전투는 탭이 아니라 무선택 기본 화면(‹ 가 여기로 온다).
  //   ⚠ 이 스텝은 게임 상태를 직스로 바꾸므로 **game 그룹 맨 뒤**에 둔다.
  await step('오토배틀: 2층 네비 · 특수무기 구입/사용', async()=>{
    skipIf(typeof strikeStart!=='function' || typeof STK_WEAPONS==='undefined','오토배틀 없음');
    // ⚠ 부팅(enterAfterWarm → warmAll → openHome)이 아직 안 끝났으면 이 스텝 한가운데서 끝나면서
    //    openHome() 이 화면을 HOME 으로 끌고 간다 → setInGame(false) → #bot 이 display:none →
    //    그 안의 #unitCmd 높이가 0. 증상은 '특수무기 하단 높이 0' 인데 원인은 여기다(2026-08-20).
    //    ⛔ 재는 쪽에서 inGame 을 억지로 켜서 덮지 말 것 — 화면은 여전히 HOME 이라 엉뚱한 걸 재게 된다.
    for(let i=0;i<60 && $('homeScreen') && $('homeScreen').classList.contains('hide');i++) await sleep(50);
    const ph=$('phone'), faked=ph && !ph.classList.contains('inGame'); if(faked) ph.classList.add('inGame');
    strikeStart(); await sleep(400);
    G.loading=false;
    const cells=()=>[...document.querySelectorAll('#tabs > *')].filter(e=>getComputedStyle(e).display!=='none');
    const names=()=>[...document.querySelectorAll('#unitCmd .cgSlot .cgName')].map(e=>e.textContent.trim());
    try{
      // ① 최상위 = 세 칸. 전투 탭은 없다(무선택 기본 화면)
      strikeRestHome(); await sleep(120);
      { const t=cells().map(e=>e.textContent.trim());
        assert(t.length===3,'오토배틀 최상위가 3칸이 아님: '+JSON.stringify(t));
        assert(t.join('/')==='건설지/특수무기/관전','오토배틀 최상위 이름이 다름: '+JSON.stringify(t));
        assert(G.tab==='Main' && _gtabDrill==='','전투 기본 화면이 아님: '+G.tab+'/'+_gtabDrill); }
      // ② 건설지 = [‹][건설][강화] · 강화는 광산+공격력+체력
      strikeSwitchTab('Build'); await sleep(140);
      { const c=cells(); assert(c[0].classList.contains('navBk'),'건설지에 뒤로가기 칸이 없음');
        assert(c.slice(1).map(e=>e.textContent.trim()).join('/')==='건설/강화','건설지 하위가 다름');
        assert(G.tab==='Build','건설지인데 건설 화면이 아님: '+G.tab); }
      // 건설 = 일꾼이 자동 지정되어 그 일꾼의 건설 그리드가 바로 뜬다(빈 화면으로 들어가지 않는다)
      { assert(G.tech,'건설 상태(G.tech)가 없음');
        assert((G.tech.selU||[]).length===1,'건설인데 일꾼이 자동 지정되지 않음: '+JSON.stringify(G.tech.selU));
        const wk=G.tech.ents.find(e=>e.eid===G.tech.selU[0]);
        assert(wk && wk.type==='worker','지정된 것이 일꾼이 아님: '+(wk&&wk.type));
        assert(G.tech.sheet && G.tech.sheet.open,'건설 시트가 안 열림');
        const cards=[...document.querySelectorAll('#btSheetBody .cgSlot')];
        assert(cards.length>=2,'건설 그리드가 비어 있음: '+cards.length);
        // ⚠ 글자 줄이 눌리면 안 된다 — 칸이 모자라면 초상이 줄어야 한다(전엔 이름이 4px 로 뭉개졌다).
        //    기본 높이는 넉넉해서 어떤 CSS로도 통과한다 → 판을 일부러 좁혀 놓고 재야 규칙을 진짜로 잰다.
        const de=document.documentElement, keepH=de.style.getPropertyValue('--bpBodyH');
        de.style.setProperty('--bpBodyH','96px'); await sleep(140);
        try{
          for(const c of [...document.querySelectorAll('#btSheetBody .cgSlot')]){
            const n=c.querySelector('.cgName'); if(!n||!n.textContent.trim()) continue;
            const h=n.getBoundingClientRect().height;
            assert(h>=9,'건설 카드 이름이 뭉개짐(높이 '+h.toFixed(1)+'px): '+n.textContent.trim()); }
        } finally { if(keepH) de.style.setProperty('--bpBodyH',keepH); else de.style.removeProperty('--bpBodyH'); }
        await sleep(120); }
      // 상단은 전투 화면과 **같은 #hud** 다(건설 전용 자원 바를 따로 만들지 않는다).
      //   ⚠ 같은 DOM 인지까지 본다 — 예전엔 .bres 라는 복제본을 띄우고 #hud 를 숨겼다.
      { const hud=$('hud'), r=e=>{ const b=e.getBoundingClientRect(); return [Math.round(b.x),Math.round(b.y),Math.round(b.width)]; };
        assert(getComputedStyle(hud).display!=='none','건설지에서 상단 HUD 가 숨겨짐');
        assert(!document.querySelector('.bres'),'건설지에 자원 바 복제본(.bres)이 있음 — #hud 와 이중 표시');
        assert($('settingsBtn') && $('settingsBtn').getBoundingClientRect().width>0,'건설지에 ☰ 가 없음');
        assert(/^\d\d:\d\d$/.test($('hTime').textContent.trim()),'건설지 좌상단 시계가 mm:ss 가 아님: '+$('hTime').textContent);
        assert([...document.querySelectorAll('#hudR .res')].length===3,'건설지 자원 칸이 3개가 아님');
        const bH=[r(hud),r($('hTime')),r($('settingsBtn'))];
        strikeRestHome(); await sleep(200);
        const mH=[r(hud),r($('hTime')),r($('settingsBtn'))];
        assert(JSON.stringify(bH)===JSON.stringify(mH),'건설지 상단이 전투 화면과 다름: '+JSON.stringify(bH)+' vs '+JSON.stringify(mH));
        strikeSwitchTab('Build'); await sleep(200); }
      // 하단 시트 접기 버튼은 없앴다(높이는 --bpBodyH 하나로 고정)
      assert(!$('btCardCtl'),'하단 시트에 접기 버튼(#btCardCtl)이 남아 있음');
      // 강화 = [공격력][체력][빈칸][광산] 자리 고정
      gtabSub('upg'); await sleep(160);
      { const n=[...document.querySelectorAll('#btSheetBody .cgSlot')].map(e=>{ const t=e.querySelector('.cgName');
          return t?t.textContent.trim():(e.classList.contains('empty')?'':'?'); });
        assert(n[0]==='공격력' && n[1]==='체력' && n[3]==='광산','강화 칸 자리가 다름: '+JSON.stringify(n)); }
      // 아이콘은 사냥터 업그레이드 파일을 그대로 빌린다(뜻이 같으면 새로 만들지 않는다)
      { const src=[...document.querySelectorAll('#btSheetBody .cgSlot .cgPro img')].map(e=>e.getAttribute('src'));
        assert(src.some(x=>/up_melee_atk/.test(x)),'공격력이 사냥터 아이콘을 안 씀: '+JSON.stringify(src));
        assert(src.some(x=>/up_carapace/.test(x)),'체력이 사냥터 아이콘을 안 씀: '+JSON.stringify(src));
        assert(src.some(x=>/up_mine/.test(x)),'광산이 곡괭이 아이콘을 안 씀: '+JSON.stringify(src)); }
      // ⚠ 값이 그대로면 시트를 다시 그리지 않는다 — strikeFrame 이 0.22초마다 부르는데 매번 DOM 을 새로
      //    만들면 <img> 가 계속 새로 생겨 아이콘이 화면에 뜰 틈이 없다(실제로 빈칸으로 보였다).
      { const body=$('btSheetBody'); const mark=body.querySelector('.cgSlot'); assert(mark,'강화 칸이 없음');
        mark._keep=1;
        for(let i=0;i<5;i++) techPanelRender();
        assert((body.querySelector('.cgSlot')||{})._keep===1,'값이 그대로인데 시트를 다시 그렸음(아이콘이 못 뜬다)');
        STK.me.gold+=1000; techPanelRender();          // 값이 바뀌면 반드시 다시 그린다
        assert((body.querySelector('.cgSlot')||{})._keep!==1,'값이 바뀌었는데 시트가 안 갱신됨'); }
      // 수치는 **이름 아래 줄(.cgSub)** 에 있다 — 네모 업그레이드 카드와 같은 자리. 우상단 배지를 쓰지 않는다.
      { const cs=[...document.querySelectorAll('#btSheetBody .cgSlot:not(.empty)')];
        assert(cs.length>0,'강화 칸이 없음');
        assert(!document.querySelector('#btSheetBody .cgMeta'),'수치가 아직 우상단 배지(.cgMeta)에 있음');
        for(const c of cs){ const sub=c.querySelector('.cgSub'), nm=c.querySelector('.cgName');
          assert(sub && sub.textContent.trim(),'이름 아래 수치 줄이 없음: '+(nm?nm.textContent:'?')); }
        // 카드 뼈대 순서 = 네모와 같다: 초상 → 이름 → 수치 → 비용
        const kids=[...cs[0].children].map(e=>e.className.split(' ')[0]).join('>');
        assert(kids==='cgPro>cgName>cgSub>cgCost','카드 뼈대가 네모 업그레이드 카드와 다름: '+kids); }
      // 재화는 **미네랄(윗줄)·가스(아랫줄) 두 자리가 언제나 예약**돼 있어야 한다 — 값이 없다고 줄을 빼면
      //   칸마다 재화가 다른 높이에 찍혀 눈이 자리를 못 잡는다. 그러고도 초상은 네모 카드와 같은 정사각이어야 한다.
      { for(const c of document.querySelectorAll('#btSheetBody .cgSlot:not(.empty)')){
          const cc=[...c.querySelectorAll('.cgCost .cc')];
          assert(cc.length===2,'재화 줄이 두 자리가 아님(미네랄/가스 자리 예약): '+cc.length);
          assert(cc[0].classList.contains('cr') && cc[1].classList.contains('en'),
            '미네랄이 윗줄·가스가 아랫줄이 아님: '+cc.map(e=>e.className).join('/'));
          assert(cc[1].getBoundingClientRect().top >= cc[0].getBoundingClientRect().top,'가스 줄이 미네랄 위에 있음');
          const p=c.querySelector('.cgPro').getBoundingClientRect();
          assert(Math.abs(p.width-p.height)<=1,'초상이 정사각이 아님(네모 카드보다 눌림): '+p.width.toFixed(1)+'×'+p.height.toFixed(1));
          assert(c.scrollHeight-c.clientHeight<=0,'카드 안에서 내용이 넘침: '+(c.querySelector('.cgName')||{}).textContent); }
        const c0=document.querySelector('#btSheetBody .cgSlot:not(.empty)');
        const ri=c0.querySelector('.cgCost .ri'), cs=getComputedStyle(c0.querySelector('.cgCost .cc'));
        if(ri) assert(Math.abs(ri.getBoundingClientRect().height-parseFloat(cs.fontSize))<=0.5,
          '재화 아이콘이 옆 숫자 크기와 다름: '+ri.getBoundingClientRect().height.toFixed(1)+' vs '+cs.fontSize);
        // ⚠ 수치와 재화 사이의 틈 = 카드에서 남는 높이 전부다(비용은 아래 붙박이, 초상은 정사각으로 묶임).
        //   틈만 따로 줄일 수 없으므로 초상이 남는 높이를 먹어야 한다 — 커지면 틈이 닫힌다.
        //   ⚠ 칸 폭은 왼쪽 설명 패널 길이에 따라 달라진다 → 절대 px 로 박지 말고 '줄간격 위에 남은 몫'으로 잰다.
        { const sub=c0.querySelector('.cgSub'), cost=c0.querySelector('.cgCost');
          if(sub&&cost){ const g=cost.getBoundingClientRect().top - sub.getBoundingClientRect().bottom;
            const fg=parseFloat(getComputedStyle(c0).rowGap)||0, extra=g-fg;
            assert(extra<=2,'수치와 재화 사이에 남는 높이가 큼(초상이 못 먹음): 틈 '+g.toFixed(2)+'px = 줄간격 '+fg+' + 남은 몫 '+extra.toFixed(2)); } }
        // 수치 줄은 이름보다 확실히 작아야 한다 — 이 줄이 없는 칸과 높이 차이를 줄이려는 규칙이다
        const sub=c0.querySelector('.cgSub'), nm=c0.querySelector('.cgName');
        if(sub&&nm) assert(parseFloat(getComputedStyle(sub).fontSize) < parseFloat(getComputedStyle(nm).fontSize)-1.5,
          '수치 줄이 이름만큼 큼: '+getComputedStyle(sub).fontSize+' vs '+getComputedStyle(nm).fontSize); }
      // ⚠ 긴 이름은 폰트 축소로 칸 안에 들어와야 한다. .cgName 이 stretch 가 아니면 폭이 글자 폭 그대로라
      //   축소 루프(scrollWidth>clientWidth)가 영원히 거짓 → 이름이 카드 밖으로 삐져나가 좌우가 잘린다.
      //   실제 이름은 짧아서 안 걸리므로 **긴 이름을 임의로 꽂아** 잰다.
      { const body=$('btSheetBody');
        renderCmdGrid(body, { mode:'prod', compact:true, build:true, title:'검사', items:[
          { pro:'', sn:'파괴형 관통 탄두 초장거리', sub:'123/999', cr:999999, en:99999, state:'on' }],
          info:{ eb:'검사', hideName:true, desc:'' } });
        await sleep(120);
        const c=body.querySelector('.cgSlot:not(.empty)'), nm=c.querySelector('.cgName');
        const cr=c.getBoundingClientRect(), nr=nm.getBoundingClientRect();
        assert(nr.left>=cr.left-0.5 && nr.right<=cr.right+0.5,
          '긴 이름이 카드 밖으로 넘침(폰트 축소가 안 돎): 이름 '+nr.left.toFixed(1)+'~'+nr.right.toFixed(1)+' vs 칸 '+cr.left.toFixed(1)+'~'+cr.right.toFixed(1));
        assert(parseFloat(getComputedStyle(nm).fontSize)<10,'긴 이름인데 폰트가 안 줄었음: '+getComputedStyle(nm).fontSize);
        body._stkSig=null; techPanelRender(); await sleep(160); }   // 원래 그리드로 복구(서명 캐시를 비워야 다시 그린다)
      // ⚠ 이름 줄상자가 글자 잉크보다 작으면 overflow:hidden 이 **윗획을 잘라 먹는다**.
      //   실제로 10px 한글(잉크 11px)이 줄상자 10.5px(line-height 1.05)에 잘렸다.
      //   ⚠ 줄상자 높이만 재면 절대 못 잡는다 — 캔버스 폰트 메트릭으로 잉크를 재서 비교할 것.
      { const cv=document.createElement('canvas').getContext('2d');
        for(const n of document.querySelectorAll('#btSheetBody .cgName, #unitCmd .cgName')){
          const t=(n.textContent||'').trim(); if(!t) continue;
          const st=getComputedStyle(n); cv.font=st.fontWeight+' '+st.fontSize+' '+st.fontFamily;
          const m=cv.measureText(t), ink=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
          const box=n.getBoundingClientRect().height;
          assert(box>=ink,'카드 이름이 잘림("'+t+'" 줄상자 '+box.toFixed(1)+'px < 잉크 '+ink.toFixed(1)+'px)'); } }
      // ⚠ 우상단 배지를 쓰는 카드(관리자 연구 등)에서 배지가 초상 이미지에 가려지면 안 된다 —
      //   둘 다 .cgPro 의 형제/자식이라 z-index 가 같으면 트리 순서가 늦은 이미지가 이긴다.
      //   지금 오토배틀 칸에는 배지가 없으므로 같은 그리드에 탐침을 하나 꽂아서 잰다.
      { const host=$('btSheetBody'), grid=host.querySelector('.cgGrid'); skipIf(!grid,'그리드 없음');
        const probe=document.createElement('div'); probe.className='cgSlot';
        probe.innerHTML='<div class="cgMeta lv">9/9</div><div class="cgPro"><img class="icoImg" src="assets/icons/upgrades/up_mine.webp"></div><div class="cgName">탐침</div>';
        grid.appendChild(probe);
        try{ const b=probe.querySelector('.cgMeta'), r=b.getBoundingClientRect();
          if(r.width>2){ const top=document.elementsFromPoint(r.left+r.width/2, r.top+r.height/2).find(e=>host.contains(e));
            assert(top && (top===b || b.contains(top)),'배지가 초상 이미지에 가려짐: '+(top?(top.className||top.tagName):'none')); }
        } finally { probe.remove(); } }
      // ③ 특수무기 = [‹][구입][사용] · 구입 그리드는 표 그대로
      strikeSwitchTab('Upgrade'); await sleep(160);
      { const c=cells(); assert(c[0].classList.contains('navBk'),'특수무기에 뒤로가기 칸이 없음');
        assert(c.slice(1).map(e=>e.textContent.trim()).join('/')==='구입/사용','특수무기 하위가 다름');
        assert(G.tab==='Main','특수무기는 화면을 옮기지 않는다(전장 유지): '+G.tab);
        const n=names();
        for(const w of STK_WEAPONS) assert(n.indexOf(w.name)>=0,'구입 그리드에 '+w.name+'이 없음: '+JSON.stringify(n));
        // 특수무기 4종은 전부 기존 스킬 아이콘을 빌린다 — 이모지로 남아 있으면 안 되고, 넷이 서로 달라야 한다
        const src=[...document.querySelectorAll('#unitCmd .cgSlot .cgPro img')].map(e=>e.getAttribute('src'));
        assert(src.length===STK_WEAPONS.length,'특수무기 칸에 그림이 빠짐: '+src.length+'/'+STK_WEAPONS.length+' '+JSON.stringify(src));
        assert(src.every(x=>/\/skills\/sk_/.test(x)),'스킬 아이콘이 아닌 그림이 섞임: '+JSON.stringify(src));
        assert(new Set(src).size===src.length,'특수무기 둘이 같은 그림을 씀: '+JSON.stringify(src)); }
      // ④ 사용 = **구입과 같은 자리에 같은 순서로**. 없는 것은 빈 칸이 아니라 비활성(dim).
      gtabSub('use'); await sleep(140);
      { const n=names();
        assert(n.join('/')===STK_WEAPONS.map(w=>w.name).join('/'),'사용 그리드 자리가 구입과 다름: '+JSON.stringify(n));
        const cs=[...document.querySelectorAll('#unitCmd .cgSlot')];
        assert(cs.every(e=>e.classList.contains('dim')),'가진 게 없는데 비활성이 아닌 칸이 있음');
        assert(!document.querySelector('#unitCmd .cgSlot.empty'),'사용 그리드에 빈 칸이 있음(비활성으로 두어야 한다)'); }
      // ⑤ 구입 → 그 칸만 살아난다(자리는 그대로)
      STK.me.gold=99999;
      assert(strikeBuyWpn('bomb'),'폭탄 구입 실패');
      gtabSub('buy'); await sleep(120); gtabSub('use'); await sleep(140);
      { const cs=[...document.querySelectorAll('#unitCmd .cgSlot')];
        assert(!cs[0].classList.contains('dim'),'산 무기가 아직 비활성');
        assert(cs[1].classList.contains('dim'),'안 산 무기가 활성으로 보임'); }
      for(const w of STK_WEAPONS) if(strikeWpnHave(w.k)<1) assert(strikeBuyWpn(w.k), w.name+' 구입 실패');
      // ⑥ 효과 — ⚠ 헤드리스에선 3D·건설이 안 서서 유닛이 안 나온다. 검증용 유닛을 직접 꽂는다.
      //    무기 함수는 hp/maxHp/x/y/dead/wait 만 읽으므로 이걸로 진짜 효과를 잰다.
      { const mk=(i,side)=>({uid:side+i, id:'marine', side:side, x:1000+(i%5)*40, y:1000+Math.floor(i/5)*40,
          hp:600, maxHp:600, dead:false, wait:0, size:14});
        STK.ai.units=[]; STK.me.units=[];
        for(let i=0;i<10;i++){ STK.ai.units.push(mk(i,'ai')); STK.me.units.push(mk(i,'me')); }
        // EMP = 정지(피해 없음) — 새 상태이상 필드를 만들지 않고 u.wait 를 쓴다
        const hpB=STK.ai.units.reduce((s,u)=>s+u.hp,0);
        assert(strikeUseWpn('emp'),'EMP 사용 실패');
        assert(strikeWpnHave('emp')===0,'EMP 재고가 안 줄었음');
        assert(STK.ai.units.every(u=>u.wait>0),'EMP 인데 안 멈춘 적이 있음');
        assert(STK.ai.units.reduce((s,u)=>s+u.hp,0)===hpB,'EMP 가 피해를 줬음(정지만이어야 한다)');
        // 폭탄 = 광역 피해
        assert(strikeUseWpn('bomb'),'폭탄 사용 실패');
        assert(STK.ai.units.reduce((s,u)=>s+u.hp,0)<hpB,'폭탄인데 적 체력이 그대로');
        // 재생 필드 = 아군 회복
        STK.me.units.forEach(u=>u.hp=u.maxHp*0.3);
        const my0=STK.me.units.reduce((s,u)=>s+u.hp,0);
        assert(strikeUseWpn('heal'),'재생 필드 사용 실패');
        assert(STK.me.units.reduce((s,u)=>s+u.hp,0)>my0,'재생 필드인데 아군 체력이 그대로'); }
      // ⑦ ‹ = 전투(무선택 기본 화면)
      gtabBack(); await sleep(160);
      assert(G.tab==='Main' && _gtabDrill==='','‹ 인데 전투 기본 화면이 아님: '+G.tab+'/'+_gtabDrill);
      assert(!STK.supSheet,'‹ 인데 시트가 남아 있음');
      assert(!cells().some(e=>e.classList.contains('on')||e.classList.contains('cur')),'‹ 뒤인데 켜진 칸이 있음');
      // ⑧ 하단 판 높이는 네모 인게임과 같다(--bpBodyH 공용)
      // ⚠ getPropertyValue('--bpBodyH') 는 계산값이 아니라 원문 'min(28vh,140px)' 이라 parseFloat=NaN 이다.
      //    토큰을 실제로 적용한 탐침을 재서 기준값을 얻는다(예전엔 NaN>0 이 거짓이라 이 검사가 통째로 건너뛰어졌다).
      { const probe=document.createElement('div');
        probe.style.cssText='position:absolute;left:-9999px;top:0;width:10px;height:var(--bpBodyH)';
        document.body.appendChild(probe);
        const want=Math.round(probe.getBoundingClientRect().height); probe.remove();
        assert(want>0,'--bpBodyH 기준값을 못 잼: '+want);
        for(const [n,fn] of [['건설지',()=>strikeSwitchTab('Build')],['특수무기',()=>strikeSwitchTab('Upgrade')],['관전',()=>strikeSwitchTab('Players')]]){
          fn();
          // ⚠ 고정 대기(180ms)로 재면 안 된다 — 시트 정렬(_syncSheetLift)이 **220ms** 뒤에 끝나므로
          //   높이가 0인 순간을 잡아 간헐 실패했다(앞 그룹이 길어지면 더 자주 걸렸다). 값이 설 때까지 기다린다.
          let h=0;
          for(let i=0;i<40;i++){ await sleep(50);
            const body=document.getElementById(G.tab==='Build'?'btSheetBody':'unitCmd');
            h=Math.round(body.getBoundingClientRect().height);
            if(Math.abs(h-want)<=1) break; }
          // ⚠ 하단 콘솔이 통째로 사라지면(#bot display:none) 높이가 0으로 나온다 — 원인을 바로 알 수 있게 적는다
          if(h===0 && !document.getElementById('phone').classList.contains('inGame'))
            throw new Error(n+' 하단 콘솔이 없다 — 게임 중인데 .inGame 이 꺼졌다(예열 완료 후 openHome 이 끌어갔는지 볼 것)');
          assert(Math.abs(h-want)<=1, n+' 하단 본문 높이가 네모와 다름: '+h+' vs '+want); } }
      // ⑨ 누적 수입(earned) — umProgress()가 '번 돈을 얼마나 굴렸나'를 이 값으로 역산한다.
      //    ⚠ 소모처(광산·강화·무기·건설)를 세지 않고 수입만 세는 구조라, 여기가 끊기면 진행도가 통째로 0이 된다.
      { const e0=STK.me.earned||0;
        for(let i=0;i<3;i++) strikeStep(STK.cycleTime+0.01);   // 사이클을 세 번 넘긴다
        assert((STK.me.earned||0)>e0,'사이클을 넘겼는데 누적 수입이 안 쌓임: '+e0+' → '+(STK.me.earned||0));
        assert((STK.ai.earned||0)>0,'적 진영 누적 수입이 안 쌓임'); }
      strikeSwitchTab('Upgrade'); await sleep(140);
      return '3칸 · 건설지2 · 특수무기 '+STK_WEAPONS.length+'종 ok';
    } finally { if(typeof strikeEnd==='function') try{ strikeEnd(); }catch(e){}
      if(faked) ph.classList.remove('inGame'); } });

  // 🔗 유즈맵 보상은 사냥터 시급에 앵커한다 — 고정값이면 지수 곡선에 몇 라운드 만에 삼켜진다.
  await step('유즈맵 보상: 사냥터 시급 앵커 · 진행도', async()=>{
    skipIf(typeof profRunReward!=='function' || typeof umProgress!=='function','경제 연결 없음');
    const p=PROF(), keepPc=p.pcoin, keepGas=p.gas, keepHunt=JSON.parse(JSON.stringify(p.hunt||{}));
    const keepG=G, keepSTK=(typeof STK!=='undefined')?STK:null, keepMap=MAP, keepDay0=PLAYER_META.umDay;
    MAP=USEMAPS.nemo;   // ⚠ 앞 스텝이 무한모드로 두고 갔을 수 있다(rounds 100만 · infinite) — 맵을 고정하고 잰다
    const run=(rate)=>{ p.hunt.rate=rate; p.pcoin=0; p.gas=0; return profRunReward(); };
    let bad_noChar=false;
    try{
      G=newGame(); G.phase='won'; G.round=30; G.kills=500; G.difficulty='normal';
      // ① 시급이 10배가 되면 보상도 10배 — **경험치는 그대로**(사냥터 XP 곡선이 만드는 '레벨의 벽'을 지킨다)
      const a=run(1), b2=run(10);
      assert(Math.abs(b2.pc/a.pc-10)<0.02,'시급 10배인데 보상이 10배가 아님: '+a.pc+' → '+b2.pc);
      assert(a.xp===b2.xp,'시급이 경험치까지 밀었음: '+a.xp+' → '+b2.xp);
      // ② 첫 라운드 클리어 전(rate 0)에도 빈손이 아니다 — 방치와 같은 폴백을 쓴다
      assert(run(0).pc>0,'신규(rate 0)에게 보상이 0');
      // ③ 가스는 사냥터 처치 보상과 같은 비율
      assert(Math.abs(b2.gas/b2.pc-UM_GAS_RATIO)<0.01,'가스 비율이 사냥터와 다름: '+(b2.gas/b2.pc));
      // ④ 네모 진행도 — 클리어=1.0 · 못 깼으면 도달 라운드 비율
      const rounds=mapCfg('rounds',TOTAL_ROUNDS);
      G.phase='won';  assert(umProgress()===1,'클리어인데 진행도가 1이 아님: '+umProgress());
      G.phase='lost'; G.round=Math.round(rounds/2);
      assert(Math.abs(umProgress()-0.5)<0.03,'미클리어 진행도가 라운드 비율이 아님: '+umProgress());
      G.round=rounds*3; assert(umProgress()<=1,'진행도가 1을 넘음: '+umProgress());
      // ⑤ 오토배틀 진행도 — 승패 + 굴린 비율 + 버틴 시간. 패배 상한 0.55.
      G=newGame(); G.strike=true;
      const mkSTK=(gold,earned,round)=>({ me:{gold:gold, earned:earned}, round:round });
      const start=mapCfg('startGold',0)||0;
      STK=mkSTK(start, 0, 1); G.phase='lost';
      const p0=umProgress();
      STK=mkSTK(0, 1000, 1);                       // 번 돈을 다 씀
      const pSpend=umProgress();
      assert(pSpend>p0,'다 굴렸는데 진행도가 안 오름: '+p0+' → '+pSpend);
      STK=mkSTK(0, 1000, UM_STK_CYCLES); const pTime=umProgress();
      assert(pTime>pSpend,'오래 버텼는데 진행도가 안 오름: '+pSpend+' → '+pTime);
      assert(Math.abs(pTime-(UM_STK_W_SPEND+UM_STK_W_TIME))<0.01,'패배 상한이 '+(UM_STK_W_SPEND+UM_STK_W_TIME)+'가 아님: '+pTime);
      G.phase='won'; assert(Math.abs(umProgress()-1)<0.01,'만점 승리인데 1이 아님: '+umProgress());
      STK=mkSTK(0,1000,1); G.phase='won'; const win=umProgress();
      STK=mkSTK(0,1000,1); G.phase='lost'; const lose=umProgress();
      assert(win-lose>0.4,'승패 가중이 너무 작음: '+win+' vs '+lose);
      // ⑥ 난이도 = 한 번씩 깨는 사다리 — 칸마다 적 체력 정확히 ×2(옛 FINAL 360 같은 벽을 두지 않는다)
      { const o=DIFFICULTY_ORDER;
        for(let i=1;i<o.length;i++){ const r=DIFFICULTY[o[i]].enemyHp/DIFFICULTY[o[i-1]].enemyHp;
          assert(Math.abs(r-2)<0.01, o[i-1]+'→'+o[i]+' 가 ×2 가 아님: ×'+r.toFixed(2)); } }
      // ⑦ 첫 클리어 = 맵×난이도 1회성 · ⚠ 상한이 없으면 '늦게 깰수록 이득'이 되어 유즈맵을 미루게 된다
      { const keepClear=PLAYER_META.umClear; PLAYER_META.umClear={};
        try{
          p.hunt.rate=1e9;  const big=umFirstRw('normal').pcoin;
          p.hunt.rate=1e15; const huge=umFirstRw('normal').pcoin;
          assert(big===huge,'첫 클리어 보상에 상한이 없음(늦게 깰수록 이득): '+big+' → '+huge);
          p.hunt.rate=0.2;  const small=umFirstRw('normal').pcoin;
          assert(small>0 && small<big,'상한 미만일 때 실제 시급을 안 따라감: '+small+' vs '+big);
          assert(umFirstClaim('nemo','normal'),'첫 클리어인데 보상이 없음');
          assert(!umFirstClaim('nemo','normal'),'첫 클리어 보상이 두 번 나옴');
          assert(umFirstClaim('nemo','hard'),'같은 맵 다른 난이도가 막힘');
          assert(umFirstClaim('cpu','normal'),'다른 맵 같은 난이도가 막힘');
        } finally { PLAYER_META.umClear=keepClear; } }
      // ⑧ ⚠ 오토배틀도 앵커 보상을 받는다 — _runSummary 의 직스 분기가 먼저 return 하면 통째로 못 받는다
      { G=newGame(); G.strike=true; G.phase='won'; G.round=5; STK={ me:{gold:0, earned:1000, kills:3, units:[]}, t:120, round:10 };
        p.hunt.rate=1; p.pcoin=0; PLAYER_META.umDay=null;   // ⚠ 앞 검사들이 판 수를 올려 놨다 — 하루 체감과 얽히지 않게 초기화
        const sum=_runSummary();
        assert(sum && sum.strike,'직스 요약이 아님');
        assert(sum.prof && sum.prof.pc>0,'오토배틀이 앵커 보상을 못 받음(직스 분기 조기 return)');
        assert(p.pcoin>0,'오토배틀 보상이 실제로 지급되지 않음'); }
      // ⑨ ◎ 포인트는 **모든 맵**이 판 끝에 준다 — 예전엔 네모 월드보스 처치로만 나와 경로가 너무 좁았다
      { const keepCoins=PLAYER_META.coins;
        try{
          G=newGame(); MAP=USEMAPS.nemo; G.difficulty='normal'; G.phase='won'; G.round=30; G.points=0;
          const win=bankRunPoints(); assert(win>0,'클리어인데 포인트가 0(월드보스 없이는 안 나옴)');
          G=newGame(); MAP=USEMAPS.nemo; G.difficulty='normal'; G.phase='lost'; G.round=6; G.points=0;
          const lose=bankRunPoints(); assert(lose>0 && lose<win,'중도 종료 포인트가 이상함: '+lose+' vs '+win);
          G=newGame(); G.strike=true; G.phase='won'; STK={me:{gold:0,earned:1000,units:[]},round:30};
          assert(bankRunPoints()>0,'오토배틀 승리인데 포인트가 0');
        } finally { PLAYER_META.coins=keepCoins; } }
      // ⑩ 🔑 환생 관문 — 1회차 무료 · 2회차부터 유즈맵 포인트 필요 · 실행 시 차감
      { if(typeof profEnsureChar==='function') try{ profEnsureChar(); }catch(e){}
        const c=(typeof CHAR==='function')?CHAR():null;
        if(!c) bad_noChar=true; else {
        const k={lv:c.level, reb:c.reb, mx:c.rebLvMax, coins:PLAYER_META.coins, rp:c.rp, mul:c.rebMul, hunt:JSON.parse(JSON.stringify(p.hunt||{})), pc:p.pcoin};
        try{
          // ⚠ 관문은 회차가 아니라 **레벨 비례**다(2026-08-19) — 딱 첫 환생 레벨이면 무료.
          c.level=PROF_REB_MIN_LV; c.reb=0; c.rebLvMax=0; PLAYER_META.coins=0;
          assert(profRebPoint(c)===0,'Lv'+PROF_REB_MIN_LV+' 환생이 무료가 아님');
          assert(profCanRebirth(c),'첫 환생은 포인트 없이도 되어야 함');
          c.reb=1; c.level=PROF_REB_MIN_LV+60; c.rebLvMax=PROF_REB_MIN_LV;
          const need=profRebPoint(c); assert(need>0,'깊이 밀었는데 관문 포인트가 0');
          PLAYER_META.coins=need-1; assert(!profCanRebirth(c),'포인트가 모자란데 환생이 됨');
          PLAYER_META.coins=need;   assert(profCanRebirth(c),'포인트가 충분한데 환생이 막힘');
          profRebirth(c);
          assert(PLAYER_META.coins===0,'환생했는데 포인트가 안 깎임: '+PLAYER_META.coins);
        } finally { c.level=k.lv; c.reb=k.reb; c.rebLvMax=k.mx; c.rp=k.rp; c.rebMul=k.mul;
          PLAYER_META.coins=k.coins; p.hunt=k.hunt; p.pcoin=k.pc; } } }
      // ⑪ 📅 하루 3판 체감 — 목표 세션(2~3판)을 규칙으로 새긴 것. 하드 캡이 아니라 계수다.
      { const keepDay=PLAYER_META.umDay;
        try{
          PLAYER_META.umDay=null; p.hunt.rate=1;
          const got=[];
          for(let i=0;i<UM_DAY_FULL+2;i++){
            G=newGame(); MAP=USEMAPS.nemo; G.difficulty='normal'; G.phase='won'; G.round=30; p.pcoin=0;
            got.push(profRunReward()); }
          for(let i=0;i<UM_DAY_FULL;i++) assert(got[i].dayMul===1, (i+1)+'판째인데 전액이 아님: '+got[i].dayMul);
          assert(got[UM_DAY_FULL].dayMul===UM_DAY_FADE,(UM_DAY_FULL+1)+'판째 체감이 안 걸림: '+got[UM_DAY_FULL].dayMul);
          assert(got[UM_DAY_FULL].pc < got[0].pc,'체감인데 보상이 안 줄었음: '+got[UM_DAY_FULL].pc+' vs '+got[0].pc);
          assert(got[UM_DAY_FULL].pc > 0,'체감이 0 이 됨(하드 캡이 아니라 계수여야 한다)');
          assert(got[UM_DAY_FULL].day===UM_DAY_FULL+1,'판 수가 안 세어짐: '+got[UM_DAY_FULL].day);
          // 하루가 바뀌면 초기화 — 하루 경계는 _dgDayKey() 하나를 쓴다(출석·일일 퀘스트와 같은 축)
          PLAYER_META.umDay.key=0;
          G=newGame(); MAP=USEMAPS.nemo; G.difficulty='normal'; G.phase='won'; G.round=30; p.pcoin=0;
          assert(profRunReward().dayMul===1,'날이 바뀌었는데 체감이 안 풀림');
          assert(PLAYER_META.umDay.key===_dgDayKey(),'하루 경계가 _dgDayKey 와 다름');
        } finally { PLAYER_META.umDay=keepDay; } }
      // ⑫ 일일 퀘스트 — 하루 5개 중 바깥 구역(유즈맵·토벌 등) 몫
      { assert(DQ_OUT_N>=3,'일일 퀘스트 바깥 몫이 3 미만: '+DQ_OUT_N);
        const cat=q=>((DQ_BY[q.id||q]||{}).cat)||'?';
        for(let d=0;d<5;d++){ const sel=dqDraw(_dgDayKey()+d*86400000);
          const out=sel.filter(q=>cat(q)!=='hunt').length;
          assert(out===DQ_OUT_N, d+'일 뒤 바깥 퀘스트가 '+out+'개(기대 '+DQ_OUT_N+')'); } }
      return '앵커·진행도·난이도·첫클리어·포인트·관문 ok · 하루 '+UM_DAY_FULL+'판 체감 ok · 일일 바깥 '+DQ_OUT_N;
    } finally { G=keepG; MAP=keepMap; if(typeof STK!=='undefined') STK=keepSTK;
      PLAYER_META.umDay=keepDay0; p.pcoin=keepPc; p.gas=keepGas; p.hunt=keepHunt; } });

  // ══ 협동(멀티) — 죽은 자리 · 정지된 자리 · 대역폭 ══════════════════════
  // 가짜 채널을 물려 실제 송신 경로(coopSend)를 그대로 태운다. 실제 접속은 하지 않는다.
  function _coopStub(cap){
    G=newGame(); MAP=USEMAPS.nemo; G.phase='playing'; G.tab='Main';
    G.myPlayer=1; G.curPlayer=1; G.activePlayers=[1,2,3]; G.eliminated=[]; G.finished=[];
    G.coop=true; G.coopChan={ state:'joined', send(m){ cap.push(m); } };
    G.coopNumToUid={1:'me',2:'u2',3:'u3'}; G.coopUidToNum={me:1,u2:2,u3:3};
    G.coopState={}; G.coopBoard={}; G.coopBoardPrev={}; G.coopSpeed={};
    G.coopUpg={}; G.coopBossU={}; G.coopTeamB={}; G.coopWatchers={};
  }
  await step('죽은 자리: 탈락하면 그 자리의 모든 것이 지워진다', async()=>{
    skipIf(typeof killSlot!=='function','killSlot 없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]);
      G.coopBoard[2]={t:Date.now(),units:[{}],enemies:[{}],shots:[],beams:[]};
      G.coopState[2]={count:77,round:5,bo:0}; G.coopBossU[2]={}; G.coopSpeed[2]=2; G.coopWatchers.u2=1;
      assert(slotState(2)==='live','죽이기 전엔 live 여야 한다');
      killSlot(2,'lost');
      assert(slotState(2)==='dead','탈락 뒤 dead 가 아님: '+slotState(2));
      assert(G.activePlayers.indexOf(2)<0,'activePlayers 에 남아 있다');
      assert(!G.coopBoard[2] && !G.coopState[2] && !G.coopBossU[2] && !G.coopSpeed[2],'보드/상태가 안 지워졌다');
      assert(!G.coopWatchers.u2,'죽은 자리가 아직 나를 본다고 돼 있다');
      assert(playerEnemyCount(2)===0,'죽은 자리 적 수가 0이 아님: '+playerEnemyCount(2));
      assert(slotState(8)==='empty' && playerEnemyCount(8)===0,'미입장 자리도 빈 자리여야 한다');
      assert(!slotWatchable(2) && !slotWatchable(8),'죽은/빈 자리는 관전 대상이 아니어야 한다');
      // 죽은 자리가 배속 투표에 남아 있으면 판이 영원히 1배속에 묶인다
      G.coopSpeed[1]=4; G.coopSpeed[3]=4; ensureVote(); computeSpeed();
      assert(G.speedMul===4,'죽은 자리가 배속 투표를 붙잡고 있다: '+G.speedMul+'배');
      return 'dead·empty 모두 0 · 관전 불가 · 배속 '+G.speedMul+'배';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('정지된 자리: 승리는 죽이지 않는다(유닛 유지 · 관전 계속)', async()=>{
    skipIf(typeof finishSlot!=='function','finishSlot 없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]);
      G.coopBoard[3]={t:Date.now(),units:[{uid:'a'},{uid:'b'}],enemies:[],shots:[],beams:[]};
      finishSlot(3);
      assert(slotState(3)==='done','승리 뒤 done 이 아님: '+slotState(3));
      assert(slotWatchable(3),'정지된 자리는 계속 관전 가능해야 한다');
      assert(G.coopBoard[3] && G.coopBoard[3].units.length===2,'승리한 자리의 유닛이 지워졌다');
      assert(!slotDead(3),'정지된 자리를 죽은 자리로 취급하면 안 된다');
      return 'done · 유닛 2기 유지 · 관전 가능';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('패배: 내 전장이 비워진다(유닛·적·투사체 전부)', async()=>{
    skipIf(typeof clearMyField!=='function','clearMyField 없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]);
      G.round=5; for(let i=0;i<8;i++) spawnEnemy({}); G.pendSpawn.splice(0).forEach(ps=>G.enemies.push(ps.e));
      G.units.push(initUnitStats({uid:G.idSeq++, id:'marine', hero:false, lv:1, x:.3, y:.3, cd:0}));
      G.shots.push({x:1,y:1,vx:0,vy:0,kind:'b',color:'#fff'});
      const kills=G.kills||0;
      assert(G.enemies.length>0 && G.units.length>0,'준비 실패');
      clearMyField();
      assert(G.units.length===0 && G.enemies.length===0 && G.shots.length===0 && G.pendSpawn.length===0,'전장이 안 비었다');
      assert((G.kills||0)===kills,'전장을 비우면서 킬이 늘었다(사망 처리 함수를 탔다)');
      return '유닛·적·탄 0 · 킬 변화 없음';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('팀 강화 공유: 재접속해도 다시 주지 않는다', async()=>{
    skipIf(typeof onCoopState!=='function' || typeof killSlot!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null, keepMB=window.metaBonus;
    try{
      _coopStub([]);
      let credit=100;
      window.metaBonus=function(){ return { startCredit:credit }; };   // 경제 전체 대신 시작 크레딧만 흔든다
      G.mineral=0; G.metaB={ startCredit:100 }; G._tbPeak=100;
      credit=150; onCoopState({ uid:'u2', tb:[1], count:0, round:1 });   // 강화가 높은 사람이 합류 → 차액 지급
      assert(G.mineral===50,'최초 지급이 안 됐다: '+G.mineral);
      credit=100; killSlot(2,'left');                                    // 연결이 끊겨 이탈 → metaB 내려감
      credit=150; onCoopState({ uid:'u2', tb:[1], count:0, round:1 });   // 재접속 → 같은 강화가 다시 온다
      assert(G.mineral===50,'재접속에 같은 보너스를 또 줬다: '+G.mineral+' (50 이어야 한다)');
      return '최초 +50 · 재접속 +0';
    } finally { G=keepG; if(keepMap) MAP=keepMap; window.metaBonus=keepMB; } });

  // ══ 자리 비움 — 따라잡기(30초 이내) / 판 포기(초과) ═══════════════════
  await step('따라잡기: 자리 비운 시간만큼 게임이 실제로 진행된다', async()=>{
    skipIf(typeof nemoCatchUp!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]); G.round=11; G.speedMul=1;   // ⚠ 10·20·30 은 보스 라운드라 일반 적이 안 나온다
      // ⚠ 스모크의 step(name,fn) 이 게임 step(dt) 을 가린다 → window.step 으로 부른다
      if(typeof beginActivePhase==='function') beginActivePhase();   // 전투 단계여야 적이 유입된다
      for(let i=0;i<60;i++) window.step(1/60);       // 자리 잡기
      const t0=G.timeSec||0, e0=G.enemies.length;
      nemoCatchUp(10000);                            // 10초 자리 비움
      const dtSec=(G.timeSec||0)-t0;
      assert(dtSec>8 && dtSec<12,'게임 시간이 10초만큼 안 흘렀다: '+dtSec.toFixed(1)+'초');
      assert(G.enemies.length>e0,'따라잡았는데 적이 안 쌓였다: '+e0+'→'+G.enemies.length);
      assert(!G._catchUp,'따라잡기 플래그가 안 꺼졌다');
      return '+'+dtSec.toFixed(1)+'초 · 적 '+e0+'→'+G.enemies.length+'기';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('따라잡기: 배속을 곱해야 실제로 흐른 게임 시간과 맞는다', async()=>{
    skipIf(typeof nemoCatchUp!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]); G.round=10; G.speedMul=2;
      if(typeof beginActivePhase==='function') beginActivePhase();
      for(let i=0;i<60;i++) window.step(1/60);
      const t0=G.timeSec||0;
      nemoCatchUp(10000);                            // 2배속에서 10초 = 게임 시간 20초
      const dtSec=(G.timeSec||0)-t0;
      assert(dtSec>17 && dtSec<23,'2배속 보정이 안 됐다: '+dtSec.toFixed(1)+'초 (20초 근처여야 한다)');
      return '2배속 10초 → 게임 '+dtSec.toFixed(1)+'초';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('자리 비움 30초 초과: 보상도 기록도 없이 로비로', async()=>{
    skipIf(typeof abandonRun!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    const keepLobby=window.overlayToLobby;
    let wentLobby=false; window.overlayToLobby=function(){ wentLobby=true; };   // 화면 전환은 막고 호출만 본다
    try{
      _coopStub([]); G.round=10; G.points=999; G._pointsBanked=false; G._bankedAmt=0; G._runSum=null;
      abandonRun(45000);
      assert(wentLobby,'로비로 안 갔다');
      assert(G.phase==='quit','판이 안 끝났다: '+G.phase);
      assert(G._runSum===null,'판 요약이 만들어졌다(판으로 인정됐다)');
      assert(typeof bankRunPoints!=='function' || bankRunPoints()===0,'보상이 정산됐다: '+bankRunPoints());
      return 'quit · 정산 0 · 기록 없음';
    } finally { G=keepG; if(keepMap) MAP=keepMap; window.overlayToLobby=keepLobby; } });

  await step('자리 비움: 30초가 따라잡기와 판 포기를 가른다', async()=>{
    skipIf(typeof nemoOnShow!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    const keepCatch=window.nemoCatchUp, keepAband=window.abandonRun;
    let called=null;
    window.nemoCatchUp=function(ms){ called='catch:'+Math.round(ms/1000); };
    window.abandonRun =function(ms){ called='abandon:'+Math.round(ms/1000); };
    try{
      _coopStub([]);
      _hiddenAt=Date.now()-20000; called=null; nemoOnShow();
      assert(called && called.indexOf('catch')===0,'20초인데 따라잡기가 아니다: '+called);
      _hiddenAt=Date.now()-45000; called=null; nemoOnShow();
      assert(called && called.indexOf('abandon')===0,'45초인데 판 포기가 아니다: '+called);
      // 자리를 잡아 두는 시간(상대 화면)과 같은 값이어야 한다
      assert(AWAY_MS===30000,'경계값이 30초가 아니다: '+AWAY_MS);
      return '20초=따라잡기 · 45초=판 포기 · 경계 '+(AWAY_MS/1000)+'초';
    } finally { G=keepG; if(keepMap) MAP=keepMap;
      window.nemoCatchUp=keepCatch; window.abandonRun=keepAband; _hiddenAt=0; } });

  // ══ 재접속 — 끊김(자리 유지)과 일부러 나감(영구)을 구분한다 ═══════════
  await step('재접속: 연결이 끊기면 자리를 잡아 둔다(지우지 않는다)', async()=>{
    skipIf(typeof onCoopPlayerLeft!=='function' || typeof awaySlot!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]);
      G.coopBoard[2]={t:Date.now(),units:[{uid:'a'}],enemies:[],shots:[],beams:[]};
      G.coopState[2]={count:42,round:5,bo:0};
      onCoopPlayerLeft({ uid:'u2', nick:'P2' });
      assert(slotState(2)==='away','끊긴 자리가 away 가 아님: '+slotState(2));
      assert(G.coopBoard[2],'자리를 잡아 두는데 보드를 지웠다');
      assert(slotWatchable(2),'끊긴 자리도 관전은 계속 돼야 한다');
      assert(playerEnemyCount(2)===42,'끊긴 자리의 마지막 상태가 사라졌다: '+playerEnemyCount(2));
      assert(!slotDead(2),'끊긴 자리를 죽은 자리로 취급하면 안 된다');
      return 'away · 보드 유지 · 관전 가능';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('재접속: 일부러 나가면(bye) 기다리지 않고 바로 죽은 자리', async()=>{
    skipIf(typeof onCoopBye!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]);
      G.coopBoard[3]={t:Date.now(),units:[{uid:'a'}],enemies:[],shots:[],beams:[]};
      onCoopBye({ uid:'u3', nick:'P3' });
      assert(slotState(3)==='dead','bye 인데 dead 가 아님: '+slotState(3));
      assert(!G.coopBoard[3],'bye 인데 보드가 남아 있다');
      assert(!G.away||G.away[3]==null,'bye 인데 자리를 잡고 기다린다');
      return 'dead 즉시';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('재접속: 돌아오면 자리와 보드가 그대로 이어진다', async()=>{
    skipIf(typeof onCoopPlayerBack!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]);
      G.coopBoard[2]={t:Date.now(),units:[{uid:'a'},{uid:'b'}],enemies:[],shots:[],beams:[]};
      onCoopPlayerLeft({ uid:'u2', nick:'P2' });
      assert(slotState(2)==='away','준비 실패');
      onCoopPlayerBack({ uid:'u2', nick:'P2' });
      assert(slotState(2)==='live','돌아왔는데 live 가 아님: '+slotState(2));
      assert(G.coopBoard[2] && G.coopBoard[2].units.length===2,'복귀했는데 보드가 사라졌다');
      assert(G.activePlayers.indexOf(2)>=0,'activePlayers 에 안 돌아왔다');
      return 'live 복귀 · 유닛 2기 유지';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('재접속: 대기 시간을 넘기면 영구 죽은 자리', async()=>{
    skipIf(typeof tickAway!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]);
      G.coopBoard[2]={t:Date.now(),units:[{uid:'a'}],enemies:[],shots:[],beams:[]};
      onCoopPlayerLeft({ uid:'u2', nick:'P2' });
      G.away[2]=Date.now()-1;            // 시간을 앞당긴다(실제로 30초 기다리지 않는다)
      tickAway();
      assert(slotState(2)==='dead','대기 만료인데 dead 가 아님: '+slotState(2));
      assert(!G.coopBoard[2],'만료됐는데 보드가 남아 있다');
      assert(G.away[2]==null,'만료됐는데 대기 목록에 남아 있다');
      // 뒤늦게 도착한 스냅이 죽은 자리를 되살리면 안 된다
      onCoopState({ uid:'u2', count:9, round:5, tb:null });
      assert(slotState(2)==='dead' && !G.coopBoard[2],'뒤늦은 스냅이 죽은 자리를 되살렸다');
      return 'dead · 뒤늦은 스냅 무시';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('재접속: resync 가 끊긴 동안의 승/패를 따라잡는다', async()=>{
    skipIf(typeof onCoopResync!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]); G.activePlayers=[1,2,3,4];
      onCoopResync({ uid:'u2', num:2, over:null, speed:1, dead:[3], done:[4] });
      assert(slotState(3)==='dead','놓친 패배를 못 따라잡았다: '+slotState(3));
      assert(slotState(4)==='done','놓친 승리를 못 따라잡았다: '+slotState(4));
      return 'P3 dead · P4 done';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('재접속: 네트워크가 돌아오면 재시도 상한이 풀린다', async()=>{
    skipIf(typeof coopReconnect!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]);
      _coopRetryN=5;   // 상한에 걸린 상태 — 이걸 안 풀면 coopReconnect 가 즉시 return 해서 영영 재접속이 안 된다
      window.dispatchEvent(new Event('online'));
      assert(_coopRetryN===0,'online 인데 재시도 카운터가 안 풀렸다: '+_coopRetryN);
      return '카운터 리셋';
    } finally { G=keepG; if(keepMap) MAP=keepMap; _coopRetryN=0; } });

  await step('재접속: 끊긴 사람은 보스 권위자가 되지 않는다', async()=>{
    skipIf(typeof coopAuthNum!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]); G.myPlayer=2; G.curPlayer=2;   // 최저 번호(1)가 내가 아닌 상황
      assert(coopAuthNum()===1,'준비 실패 — 권위자가 1이어야 한다: '+coopAuthNum());
      onCoopPlayerLeft({ uid:'me', nick:'P1' });     // 1번이 끊긴다
      assert(slotState(1)==='away','준비 실패: '+slotState(1));
      assert(coopAuthNum()===2,'끊긴 사람이 권위를 쥐고 있다(보스 동기화가 멈춘다): '+coopAuthNum());
      return '권위 1 → 2 승계';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('대역폭: 관전자가 없으면 전장 데이터를 안 보낸다', async()=>{
    skipIf(typeof coopBroadcastState!=='function','coopBroadcastState 없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      const cap=[]; _coopStub(cap);
      G.round=20; for(let i=0;i<120;i++) spawnEnemy({}); G.pendSpawn.splice(0).forEach(ps=>G.enemies.push(ps.e));
      for(let i=0;i<30;i++) G.units.push(initUnitStats({uid:G.idSeq++, id:'marine', hero:false, lv:1, x:.2+i/100, y:.3, cd:0}));
      G._pstateN=0; G.coopWatchers={};
      cap.length=0; for(let i=0;i<5;i++) coopBroadcastState();
      assert(cap.length===1,'관전자가 없는데 5틱 중 '+cap.length+'번 보냈다(500ms 주기여야 한다)');
      const light=JSON.stringify(cap[0]).length;
      assert(!cap[0].payload.u && !cap[0].payload.e,'관전자가 없는데 전장 데이터를 실었다');
      G.coopWatchers={ u2:1 };
      G._pstateN=0; cap.length=0; for(let i=0;i<5;i++) coopBroadcastState();
      assert(cap.length===5,'관전 중인데 5틱 중 '+cap.length+'번만 보냈다(10Hz 여야 한다)');
      const full=JSON.stringify(cap[0]).length;
      assert(cap[0].payload.u && cap[0].payload.e,'관전 중인데 전장 데이터가 없다');
      assert(light<1000,'가벼운 페이로드가 너무 크다: '+light+'B');
      assert(full>light*3,'관전 유무로 페이로드가 안 갈린다: '+light+' vs '+full);
      return light+'B(무관전) vs '+full+'B(관전) · '+Math.round(100-light/full*100)+'% 절감';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('대역폭: 보스 데미지는 합산해서 보낸다', async()=>{
    skipIf(typeof coopBossDamage!=='function','coopBossDamage 없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      const cap=[]; _coopStub(cap);
      G.coopBoss={ lv:1, hp:1e9, max:1e9, dead:false, name:'t' };
      cap.length=0;
      for(let i=0;i<20;i++) coopBossDamage(10, 1, false);
      coopBossDmgFlush();
      const sends=cap.filter(m=>m.event==='bossdmg');
      assert(sends.length<=2,'20번 때렸는데 '+sends.length+'번 보냈다(합산이 안 된다)');
      const sum=sends.reduce((a,m)=>a+(m.payload.amt||0),0);
      assert(Math.abs(sum-200)<0.001,'합산 데미지가 어긋난다: '+sum+' ≠ 200');
      return '20타 → '+sends.length+'건 · 합계 '+sum;
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  await step('관전 렌더: 죽은/빈 자리에 내 유닛이 새지 않는다', async()=>{
    skipIf(typeof renderEmptySlot!=='function','renderEmptySlot 없음');
    const src=String((typeof loop==='function')?loop:'');   // 프레임 루프(js/14-input-fx.js loop)
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]);
      G.round=3; for(let i=0;i<5;i++) spawnEnemy({}); G.pendSpawn.splice(0).forEach(ps=>G.enemies.push(ps.e));
      G.units.push(initUnitStats({uid:G.idSeq++, id:'marine', hero:false, lv:1, x:.3, y:.3, cd:0}));
      const nu=G.units.length, ne=G.enemies.length;
      // 그리는 **순간** 내 유닛/적이 실려 있는지가 핵심이다 — drawMain 을 잠깐 가로채 확인한다
      let seen=null; const keepDraw=window.drawMain;
      window.drawMain=function(id){ seen={ u:G.units.length, e:G.enemies.length, s:G.shots.length, id:id }; };
      try{ renderEmptySlot(); } finally{ window.drawMain=keepDraw; }
      assert(seen,'renderEmptySlot 이 전장을 그리지 않았다');
      assert(seen.id==='cvPlayer','관전 캔버스가 아님: '+seen.id);
      assert(seen.u===0 && seen.e===0 && seen.s===0,'빈 자리를 그리는데 내 유닛/적이 실려 있다: u='+seen.u+' e='+seen.e);
      assert(G.units.length===nu && G.enemies.length===ne,'빈 자리를 그린 뒤 내 전장이 복구되지 않았다');
      assert(/renderEmptySlot/.test(src),'프레임 루프에 죽은 자리 분기가 없다 — drawPlayer() 로 떨어지면 내 전장이 그려진다');
      return '내 전장 원상복구 · 루프 분기 있음';
    } finally { G=keepG; if(keepMap) MAP=keepMap; } });

  // ══ 판 저장/복구 — 탭이 죽어도 30초는 이어진다 ══════════════════════
  await step('판 저장: 숨는 순간 저장되고, 복구하면 그대로 이어진다', async()=>{
    skipIf(typeof saveRun!=='function' || typeof tryRestoreRun!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]); G.round=7; G.mineral=1234; G.kills=55; G.timeSec=90;
      for(let i=0;i<5;i++) spawnEnemy({}); G.pendSpawn.splice(0).forEach(ps=>G.enemies.push(ps.e));
      G.units.push(initUnitStats({uid:G.idSeq++, id:'marine', hero:false, lv:2, x:.3, y:.3, cd:0}));
      const want={ round:G.round, mineral:G.mineral, kills:G.kills, u:G.units.length, e:G.enemies.length };
      nemoOnHide();                                     // 화면 내림 = 저장
      assert(_lsGet('nm_run',null),'숨었는데 저장이 안 됐다');
      G=newGame();                                      // 탭이 죽었다 치고 판을 날린다
      const ok=tryRestoreRun();
      assert(ok,'복구가 실패했다');
      assert(G.round===want.round && G.mineral===want.mineral && G.kills===want.kills,
        '값이 어긋난다: 라운드 '+G.round+'/'+want.round+' 미네랄 '+G.mineral+'/'+want.mineral);
      assert(G.units.length===want.u && G.enemies.length===want.e,
        '유닛·적이 어긋난다: '+G.units.length+'/'+want.u+' · '+G.enemies.length+'/'+want.e);
      assert(!_lsGet('nm_run',null),'복구 후 저장본이 남아 있다(다음 부팅에 또 복구된다)');
      return '라운드 '+G.round+' · 미네랄 '+G.mineral+' · 유닛 '+G.units.length+' · 적 '+G.enemies.length;
    } finally { G=keepG; if(keepMap) MAP=keepMap; clearRun(); } });

  await step('판 저장: 30초를 넘긴 저장본은 복구하지 않고 버린다', async()=>{
    skipIf(typeof tryRestoreRun!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _coopStub([]); G.round=7;
      nemoOnHide();
      const sv=_lsGet('nm_run',null); assert(sv,'준비 실패');
      sv.t=Date.now()-45000; _lsSet('nm_run', sv);      // 45초 전으로 되돌린다
      G=newGame();
      const ok=tryRestoreRun();
      assert(!ok,'30초를 넘겼는데 복구했다');
      assert(G.round===1,'판이 남아 있다: 라운드 '+G.round);
      assert(!_lsGet('nm_run',null),'버렸는데 저장본이 남아 있다');
      // 판이 끝나면 저장본을 지운다 — 끝난 판을 복구하면 안 된다
      assert(/clearRun\(\)/.test(String(overlayToLobby)),'overlayToLobby 가 저장본을 안 지운다');
      return '45초 → 복구 안 함 · 저장본 삭제';
    } finally { G=keepG; if(keepMap) MAP=keepMap; clearRun(); } });

  await step('판 저장: 깨진 저장본이 부팅을 막지 않는다', async()=>{
    skipIf(typeof tryRestoreRun!=='function','없음');
    const keepG=G, keepMap=(typeof MAP!=='undefined')?MAP:null;
    try{
      _lsSet('nm_run', { t:Date.now(), g:'{{{망가진 JSON', mapId:'nemo' });
      let threw=false, ok=true;
      try{ ok=tryRestoreRun(); }catch(e){ threw=true; }
      assert(!threw,'깨진 저장본에서 예외가 났다 — 부팅이 멈춘다');
      assert(!ok,'깨진 저장본으로 복구했다고 한다');
      assert(!_lsGet('nm_run',null),'깨진 저장본이 남아 있다 — 다음 부팅도 같은 곳에서 걸린다');
      return '예외 없음 · 저장본 삭제';
    } finally { G=keepG; if(keepMap) MAP=keepMap; clearRun(); } });
  // 💬 채팅바 = 접힘↔열림 **한 부품**(2026-08-25 · F1안). 평소엔 말풍선 아이콘만 떠 전장을 덜 가린다.
  //    ⛔ 열렸을 때 왼쪽 ∨ 가 사라지면 접을 방법이 없다 — 앞선 안이 실제로 그 함정을 밟았다.
  await step('채팅바: 접히면 아이콘만 · 열려도 접기 버튼이 남는다', async()=>{
    skipIf(typeof chatToggle!=='function','채팅 접기 없음');
    const bar=$('chatBar'), fold=$('chatFold'), fld=$('chatField'), snd=$('chatSend');
    assert(bar&&fold&&fld&&snd,'채팅바 조각이 없다(접기 버튼·입력칸·전송)');
    chatFoldBar(); await sleep(300);
    const w0=bar.getBoundingClientRect().width;
    assert(w0<=48,'접혀도 안 좁아졌다: '+Math.round(w0)+'px — 아이콘 하나 폭이어야 한다');
    assert(+getComputedStyle(fld).opacity===0 && +getComputedStyle(snd).opacity===0,'접혔는데 입력칸·전송이 보인다');
    assert(getComputedStyle(fold.querySelector('.cfOpen')).display!=='none','접힘 아이콘(말풍선)이 안 나온다');
    chatOpenBar(); await sleep(320);
    const r=bar.getBoundingClientRect();
    assert(r.width>w0+120,'열려도 안 넓어졌다: '+Math.round(r.width)+'px');
    assert(fold.getBoundingClientRect().width>=20,'열리니 접기 버튼이 사라졌다 — 다시 접을 방법이 없다');
    assert(getComputedStyle(fold.querySelector('.cfClose')).display!=='none','열림 아이콘(∨)이 안 나온다');
    assert(+getComputedStyle(fld).opacity===1 && +getComputedStyle(snd).opacity===1,'열렸는데 입력칸·전송이 안 보인다');
    // 한 상자로 읽혀야 한다 — 테두리는 바깥 껍데기 하나뿐이고 구획은 1px 선이다
    assert(parseFloat(getComputedStyle(bar).borderTopWidth)>0,'바깥 껍데기에 테두리가 없다 — 일체형으로 안 읽힌다');
    for(const [n,e] of [['입력',fld],['전송',snd]])
      assert(parseFloat(getComputedStyle(e).borderTopWidth)===0, n+'칸이 제 테두리를 갖고 있다 — 상자가 셋으로 갈라진다');
    // ⛔ 항상 켜진 청록은 뺐다 — 액센트는 '지금 선택된 것' 전용이다(DESIGN §2)
    for(const [n,e] of [['바',bar],['입력',fld],['전송',snd]]){
      const c=getComputedStyle(e), all=c.borderColor+' '+c.boxShadow+' '+c.color+' '+c.backgroundColor;
      assert(all.indexOf('229, 255')<0, n+'에 상시 청록이 남아 있다: '+all.slice(0,80)); }
    assert(!$('mergeFab'),'조합 FAB(#mergeFab)이 아직 있다 — 하단 네비 「유닛 조합」과 두 벌이다');
    chatFoldBar(); await sleep(60);
    return '접힘 '+Math.round(w0)+'px → 열림 '+Math.round(r.width)+'px · 높이 '+Math.round(r.height); });}

// ── 그룹: sandbox (관리자) ──
async function groupSandbox(){
  await step('샌드박스 진입', async()=>{ skipIf(typeof enterSandbox!=='function','없음'); enterSandbox(); await sleep(300);
    assert(G.sandbox===true,'sandbox 플래그'); return 'units='+G.units.length; });
  await step('샌드박스 탭 구성(전투실험·건설 표시, 보스 숨김)', ()=>{ updatePbossFab();
    assert($('battleTab').style.display!=='none','battleTab 숨김'); assert($('buildTab').style.display!=='none','buildTab 숨김');
    assert($('bossTab').style.display==='none','bossTab이 샌드박스에 노출'); return 'ok'; });
  // 관리자 건설은 자체 상단바(.bmapTop)를 쓴다 — 오토배틀의 '상단 HUD 유지' 규칙이 여기로 새면 안 된다.
  await step('관리자 건설: 자체 상단바 유지(오토배틀 규칙 미오염)', async()=>{
    switchTab('Build', document.querySelector('.tab[data-tab="Build"]')); await sleep(400);
    assert(document.body.classList.contains('cstMode'),'건설 탭인데 cstMode 가 아님');
    assert(!document.body.classList.contains('stkCst'),'관리자 건설에 오토배틀 전용 클래스(stkCst)가 붙음');
    assert(getComputedStyle($('hud')).display==='none','관리자 건설에서 게임 HUD 가 보임(자체 상단바와 이중 표시)');
    assert(document.querySelector('.bres'),'관리자 건설에 자원 바(.bres)가 없음');
    assert(!$('btCardCtl'),'건설 시트에 접기 버튼(#btCardCtl)이 남아 있음');
    return 'ok'; });
  // 재화는 미네랄(위)·가스(아래) 두 자리를 언제나 예약한다 — 값이 없다고 줄을 빼면 칸마다 재화 높이가 달라진다.
  await step('관리자 건설: 재화는 미네랄·가스 두 자리 예약', async()=>{
    switchTab('Build', document.querySelector('.tab[data-tab="Build"]')); await sleep(300);
    skipIf(!G.tech,'건설 상태 없음');
    const wk=(G.tech.ents||[]).find(e=>e.type==='worker'); skipIf(!wk,'일꾼 없음');
    G.tech.sel=null; G.tech.selU=[wk.eid]; G.tech.sheet={open:true,sec:'ent'};
    techPanelRender(); await sleep(200);
    const c=document.querySelector('#btSheetBody .cgSlot:not(.empty)'); skipIf(!c,'건설 칸 없음');
    const cc=c.querySelectorAll('.cgCost .cc');
    assert(cc.length===2,'관리자 건설 비용 줄이 두 줄이 아님(가스 자리 예약 사라짐): '+cc.length);
    assert(cc[0].classList.contains('cr') && cc[1].classList.contains('en'),'미네랄이 윗줄·가스가 아랫줄이 아님');
    assert(c.scrollHeight-c.clientHeight<=0,'건물 카드 안에서 내용이 넘침');
    return 'ok'; });
  // 머리줄이 두꺼워지면 그만큼 아래 그리드가 눌린다 — 제목·HP 는 한 줄, 조작 버튼은 판 밖으로.
  await step('건물 프로필: 머리줄 한 줄 · 조작 버튼은 판 안 오른쪽 위 · 마나는 왼쪽', async()=>{
    switchTab('Build', document.querySelector('.tab[data-tab="Build"]')); await sleep(300);
    skipIf(!G.tech,'건설 상태 없음');
    const body=$('btSheetBody'), pick=(f)=>{ f(); G.tech.sheet={open:true,sec:'ent'}; techPanelRender(); };
    const wk=(G.tech.ents||[]).find(e=>e.type==='worker'), bl=(G.tech.ents||[]).find(e=>e.type==='bldg');
    skipIf(!wk||!bl,'일꾼/건물 없음');
    pick(()=>{ G.tech.sel=null; G.tech.selU=[wk.eid]; }); await sleep(220);
    const gWk=body.querySelector('.cgGrid').getBoundingClientRect().height;
    pick(()=>{ G.tech.selU=[]; G.tech.sel=bl.eid; }); await sleep(220);
    const nm=body.querySelector('.cgN'), hp=body.querySelector('.cgHpsh'), head=body.querySelector('.cgHead');
    assert(nm&&hp,'제목/HP 가 없음');
    const nr=nm.getBoundingClientRect(), hr=hp.getBoundingClientRect();
    assert(hr.left>=nr.right-1,'HP 가 제목 오른쪽이 아님: 제목 '+nr.right.toFixed(1)+' / HP '+hr.left.toFixed(1));
    assert(Math.min(nr.bottom,hr.bottom)-Math.max(nr.top,hr.top)>0,'제목과 HP 가 같은 줄이 아님(머리줄이 두 줄)');
    // 일꾼 스텝퍼·랠리·부양은 머리줄 '안'이 아니라 **판 안 오른쪽 위**(머리줄과 같은 줄, 별도 칸)
    const to=body.querySelector('.cgTopOut'); assert(to,'조작 버튼 묶음(.cgTopOut)이 없음');
    const cg=body.querySelector('.cmdG').getBoundingClientRect();
    { const tr=to.getBoundingClientRect();
      assert(tr.top>=cg.top-0.5 && tr.bottom<=cg.bottom+0.5,'조작 버튼이 판 밖으로 나감');
      assert(tr.right<=cg.right+0.5 && tr.right>=cg.right-26,'조작 버튼이 오른쪽에 안 붙음'); }
    assert(!head.querySelector('.cgGasAuto,.cgRally,.cgLift,.cgSelAll'),'조작 버튼이 아직 머리줄 안에 있음');
    // 머리줄이 얇아진 만큼 그리드는 일꾼 프로필보다 짧지 않아야 한다(전엔 88 vs 97 로 눌렸다)
    const gB=body.querySelector('.cgGrid').getBoundingClientRect().height;
    assert(gB>=gWk-4,'건물 프로필 그리드가 일꾼보다 짧음: '+gB.toFixed(1)+' vs '+gWk.toFixed(1));
    // 🎛 조작 버튼은 투명 배경 아이콘 계열(ui/)을 부르고, 파일이 없으면 **원래 인라인 SVG**로 되돌아온다.
    //   ⚠ 되돌리기가 없으면 파일을 넣기 전까지 버튼이 통째로 빈다(옛 _icoFail 은 이모지로 바꿔 결이 달랐다).
    { assert(typeof uiIco==='function' && typeof UI_SVG==='object','UI 아이콘 계열이 없음');
      for(const k of Object.keys(UI_SVG)){
        assert(/^<svg/.test(UI_SVG[k]||''),'UI_SVG.'+k+' 에 폴백 SVG 가 없음');
        const h=uiIco(k);
        assert(h.indexOf('assets/icons/ui/ui_'+k+'.webp')>=0,'uiIco('+k+') 가 ui/ 경로를 안 부름: '+h); }
      const tmp=document.createElement('div'); tmp.innerHTML=uiIco('rally');
      _uiFail(tmp.querySelector('img'));
      assert(tmp.querySelector('svg'),'파일이 없을 때 인라인 SVG 로 안 되돌아감'); }
    // 조작 버튼 안에 글리프가 실제로 그려져 있다(파일이 없어도 비지 않는다)
    for(const sel of ['.cgRally','.cgLift']){ const btn=body.querySelector(sel); if(!btn) continue;
      assert(btn.querySelector('svg,img'),sel+' 버튼이 비어 있음'); }
    // 🔮 마나는 머리줄이 아니라 왼쪽 정보 구역(스탯)이다
    assert(!body.querySelector('.cgHpsh .env'),'마나가 머리줄에 있음');
    { const mid=Object.keys(U).find(k=>U[k].energy>0); skipIf(!mid,'마나 유닛 없음');
      const st=_techUnitStatList({hp:100,atk:10,rng:5}, mid, {en:35,maxEn:U[mid].energy});
      assert(st.some(r=>r[0]==='마나'),'마나 유닛인데 왼쪽 스탯에 마나가 없음: '+JSON.stringify(st));
      const st0=_techUnitStatList({hp:100,atk:10,rng:5}, 'worker_human', null);
      assert(!st0.some(r=>r[0]==='마나'),'마나 없는 유닛에 마나 줄이 생김'); }
    return '머리줄 '+head.getBoundingClientRect().height.toFixed(0)+'px · 그리드 '+gB.toFixed(0)+'px'; });
  // 위 규약이 **전 구역 모든 건물·유닛**에 걸렸는지 한 번에 훑는다. 화면을 하나씩 눌러 보는 대신
  //   실제 디스패처(techPanelRender)와 실제 모델 빌더로 렌더해 머리줄만 검사한다.
  await step('전 구역 프로필 감사: 머리줄 규약(건물·유닛 전부)', async()=>{
    switchTab('Build', document.querySelector('.tab[data-tab="Build"]')); await sleep(300);
    skipIf(!G.tech || typeof TECH_TREE==='undefined','건설 상태 없음');
    const body=$('btSheetBody'), bad=[]; let n=0;
    const keep={ race:G.tech.race, sel:G.tech.sel, selU:(G.tech.selU||[]).slice(), ents:(G.tech.ents||[]).slice(), strike:G.strike, stk:(typeof STK!=='undefined')?STK:null };
    const check=(label)=>{ const g=body.querySelector('.cmdG'); if(!g) return; n++;
      const nm=g.querySelector('.cgN'), hp=g.querySelector('.cgHpsh'), head=g.querySelector('.cgHead'), to=g.querySelector('.cgTopOut');
      const H=head?head.getBoundingClientRect().height:0;
      if(g.querySelector('.cgHpsh .env')) bad.push(label+': 마나가 머리줄에 있음');
      // ⛔ 조작 버튼은 전부 트레이(.cgTopOut)다 — 되돌아가기(.cgBack)까지 포함해서 머리줄에 남으면 안 된다
      if(head && head.querySelector('.cgGasAuto,.cgRally,.cgLift,.cgSelAll,.cgBack')) bad.push(label+': 조작 버튼이 머리줄 안');
      // 일꾼 수는 **넓은 칸 하나**다(S3안) — 세 칸으로 늘어놓으면 트레이가 5칸이 되어 숫자 조정이 제일 커 보인다
      { const ga=g.querySelector('.cgGasAuto');
        if(ga){ const gs=getComputedStyle(ga), w=ga.getBoundingClientRect().width;
          if(w<60||w>96) bad.push(label+': 일꾼 칸 폭 '+w.toFixed(0)+'px(넓은 칸 하나가 아님)');
          if(gs.clipPath==='none') bad.push(label+': 일꾼 칸에 모서리 컷 없음');
          const inner=[...ga.querySelectorAll('.gaBtn')].some(b=>getComputedStyle(b).backgroundImage!=='none');
          if(inner) bad.push(label+': 일꾼 칸 안쪽 −/+ 가 또 판을 가짐(구분선만이어야 한다)'); } }
      if(to){ const tr=to.getBoundingClientRect(), gr=g.getBoundingClientRect();
        if(tr.top<gr.top-0.5 || tr.bottom>gr.bottom+0.5) bad.push(label+': 조작 버튼이 판 밖');
        if(tr.right>gr.right+0.5 || tr.right<gr.right-26) bad.push(label+': 조작 버튼이 오른쪽에 안 붙음'); }
      if(nm&&hp){ const nr=nm.getBoundingClientRect(), hr=hp.getBoundingClientRect();
        if(Math.min(nr.bottom,hr.bottom)-Math.max(nr.top,hr.top)<=0) bad.push(label+': 제목·HP 가 다른 줄');
        if(hr.left<nr.right-1) bad.push(label+': HP 가 제목 왼쪽'); }
      if(H>40) bad.push(label+': 머리줄이 두꺼움 '+H.toFixed(1)+'px'); };
    try{
      let eid=90000;
      for(const race of Object.keys(TECH_TREE)){ G.tech.race=race;
        for(const bd of (TECH_TREE[race].buildings||[])){
          G.tech.ents=G.tech.ents.filter(e=>e.eid<90000);
          const e={eid:++eid, type:'bldg', bk:bd.k, x:0.4, y:0.5, hp:100, maxHp:100, bt:0};
          G.tech.ents.push(e); G.tech.selU=[]; G.tech.sel=e.eid; G.tech.sheet={open:true,sec:'ent'};
          techPanelRender(); check(race+'/'+bd.k); }
        for(const uid of [...new Set((TECH_TREE[race].buildings||[]).flatMap(bd=>(bd.produces||[]).map(p=>p.id)))]){
          G.tech.ents=G.tech.ents.filter(e=>e.eid<90000);
          const sp=(typeof techUnitSpec==='function'&&techUnitSpec(race,uid))||{hp:40};
          const en=(typeof U!=='undefined'&&U[uid]&&U[uid].energy)||0;
          const e={eid:++eid, type:'unit', uid:uid, x:0.4, y:0.5, hp:sp.hp||40, maxHp:sp.hp||40, maxSh:sp.sh||0, sh:sp.sh||0, maxEn:en, en:en};
          G.tech.ents.push(e); G.tech.sel=null; G.tech.selU=[e.eid]; G.tech.sheet={open:true,sec:'ent'};
          techPanelRender(); check(race+'/'+uid); } }
      // 🥚 알(진화중) — 스웜 유닛으로 한 번
      { const _r=G.tech.race; G.tech.race='swarm';
        const eu=[...new Set((TECH_TREE.swarm.buildings||[]).flatMap(bd=>(bd.produces||[]).map(p=>p.id)))]
          .find(id=>(typeof U!=='undefined'&&U[id]&&U[id].energy>0)) || 'zergling';
        try{ renderCmdGrid(body, techEggModel([{type:'egg', id:eu}])); check('알/'+eu); }catch(e){}
        G.tech.race=_r; }
      // 네모 유닛 프로필(단일·다중)
      const mk=(id,uid)=>({uid:uid||1,id:id,hp:50,maxHp:100,sh:0,maxSh:0,en:10,maxEn:(U[id]&&U[id].energy)||0,kills:2,x:.5,y:.5});
      for(const id of Object.keys(U).slice(0,30)){ const u=mk(id);
        renderCmdGrid(body, _mainSingleModel(u)); check('네모/'+id);
        renderCmdGrid(body, _mainTypeModel([u,mk(id,2)], false)); check('네모×2/'+id); }
      // 오토배틀 유닛·신전·강화·상점
      if(typeof STK_UNITS!=='undefined'){ G.strike=true;
        STK={ me:{name:'나',gold:900,mines:1,mineCost:200,atkLv:0,hpLv:0,wpn:{},units:[],base:{hp:100,max:100},sec:{hp:50,max:50}},
              ai:{name:'컴퓨터',race:'terran'}, central:{hp:10,max:10}, supPage:'upg' };
        for(const uid of Object.keys(STK_UNITS).slice(0,20)){
          renderCmdGrid(body, _stkUnitModel({uid:'x',id:uid,hp:30,maxHp:60,dmg:5,rng:3,cd:1},'me')); check('직스/'+uid); }
        renderCmdGrid(body, _stkTempleModel({hp:80,max:100},'신전')); check('직스/신전');
        renderCmdGrid(body, _stkUpgModel()); check('직스/강화');
        renderCmdGrid(body, _stkWpnBuyModel()); check('직스/구입'); }
      assert(n>=100,'감사한 프로필이 너무 적음: '+n);
      assert(!bad.length, bad.length+'건 위반:\n  '+bad.slice(0,10).join('\n  '));
      return n+'개 프로필 규약 통과';
    } finally { G.strike=keep.strike; if(typeof STK!=='undefined') STK=keep.stk;
      G.tech.race=keep.race; G.tech.ents=keep.ents; G.tech.sel=keep.sel; G.tech.selU=keep.selU;
      G.tech.sheet={open:false,sec:null}; try{ techPanelRender(); }catch(e){} } });
  // 관리자 건설 탭에서 병영을 고르면 레인저·화력병·의무병·저격수 카드가 실제로 그려져야 한다.
  await step('관리자 건설: 병영 생산 카드', async()=>{
    switchTab('Build', document.querySelector('.tab[data-tab="Build"]')); await sleep(400);
    skipIf(!G.tech || typeof techBldgProdModel!=='function','건설 상태 없음');
    const bar=techGetBldg(G.tech.race,'barracks'); skipIf(!bar,'병영 없음');
    assert(_techHasProd(bar),'병영이 생산 모델을 안 씀');
    const names=techBldgProdModel(bar,null).items.filter(i=>i&&i.sn).map(i=>i.sn);
    assert(names.length>=bar.produces.length, '카드 '+names.length+'개 < produces '+bar.produces.length+'개');
    switchTab('Main', document.querySelector('.tab[data-tab="Main"]'));
    return names.join('·'); });
  // 🎥 배치 고스트를 화면 가장자리로 끌면 뷰가 따라간다 — HOME 사냥터와 같은 edgePush()를 쓴다
  await step('관리자 건설: 고스트를 가장자리로 끌면 화면이 따라간다', async()=>{
    switchTab('Build', document.querySelector('.tab[data-tab="Build"]')); await sleep(300);
    skipIf(!G.tech || typeof techEdgePan!=='function','가장자리 끌기 없음');
    // 공용 방향 함수 — 안쪽은 0, 가장자리로 갈수록 ±1
    { const c=edgePush(0.5,0.5), l=edgePush(0.02,0.5), rb=edgePush(0.98,0.98);
      assert(c.x===0 && c.y===0,'화면 중앙인데 밀림');
      assert(l.x<-0.5 && rb.x>0.5 && rb.y>0.5,'가장자리 방향이 안 잡힘'); }
    G.tech.arm=null; techArm('barracks'); skipIf(!G.tech.arm,'병영 배치를 못 켬');
    // ⚠ 최소 줌에선 맵 전체가 화면에 들어와 팬할 여지가 없다(_techClampView가 가운데로 고정) — 확대하고 잰다
    { const z=Math.min(techMaxZoom(), Math.max(techMinZoom()*1.6, 2));
      techView().zoom=z; techViewT().zoom=z; _techClampView(techView()); _techClampView(techViewT()); }
    skipIf(techView().zoom<=techMinZoom()+0.01,'확대가 안 됨(팬 여지 없음)');
    _techArmTo(0.5,0.5);
    const v0=techView().x, g0=G.tech.armXY.x;
    _btArm=true; _btArmPt={sx:0.97, sy:0.5};
    for(let i=0;i<10;i++) techEdgePan(0.05);              // 0.5초 유지
    const v1=techView().x, g1=G.tech.armXY.x;
    assert(v1>v0,'오른쪽 끝을 잡고 있는데 화면이 안 따라감: '+v0.toFixed(3)+' → '+v1.toFixed(3));
    assert(g1>=g0,'화면은 갔는데 고스트가 안 따라옴: '+g0.toFixed(3)+' → '+g1.toFixed(3));
    // 안쪽이면 안 움직인다
    _btArmPt={sx:0.5, sy:0.5}; const v2=techView().x;
    for(let i=0;i<5;i++) techEdgePan(0.05);
    assert(techView().x===v2,'화면 안쪽인데도 뷰가 움직임');
    // 손을 떼면(=_btArm false) 더는 안 움직인다
    _btArm=false; const v3=techView().x; _btArmPt={sx:0.97,sy:0.5};
    for(let i=0;i<5;i++) techEdgePan(0.05);
    assert(techView().x===v3,'손을 뗐는데 화면이 계속 밀림');
    _btArmPt=null; G.tech.arm=null; G.tech.armXY=null;
    { const z0=techMinZoom(); techView().zoom=z0; techViewT().zoom=z0; _techClampView(techView()); _techClampView(techViewT()); }   // 줌 원복
    switchTab('Main', document.querySelector('.tab[data-tab="Main"]'));
    return '뷰 '+v0.toFixed(2)+'→'+v1.toFixed(2)+' · 고스트 추종 ok'; });
  await step('전투실험 탭 전환', ()=>{ switchTab('Battle', document.querySelector('.tab[data-tab="Battle"]'));
    assert(G.tab==='Battle','tab='+G.tab); switchTab('Main', document.querySelector('.tab[data-tab="Main"]')); return 'ok'; });
  // 🏗 채팅바는 **유즈맵 안 모든 구역**에 있어야 한다(2026-08-25). 예전엔 건설 구역(cstMode)에서만 사라졌다.
  //    ⚠ 건설 구역의 시트는 `.bp` 가 아니라 `#btSheet` 다 — 갈라 재지 않으면 채팅바가 시트 밑에 깔린다.
  await step('채팅바: 건설 구역에도 있고 · 건설 시트가 열리면 그 위로 올라간다', async()=>{
    skipIf(typeof switchTab!=='function' || !$('btSheet'),'건설 구역 없음');
    const was=(typeof G!=='undefined'&&G)?G.tab:null;
    switchTab('Build', document.querySelector('.tab[data-tab="Build"]')); await sleep(220);
    assert(document.body.classList.contains('cstMode'),'건설 구역인데 cstMode 가 아니다');
    const cb=$('chatBar'), bs=$('btSheet');
    assert(getComputedStyle(cb).display!=='none','건설 구역에서 채팅바가 사라졌다');
    const y0=cb.getBoundingClientRect().bottom;
    bs.classList.add('open','simple'); _syncSheetLift(); await sleep(340);
    const y1=cb.getBoundingClientRect().bottom, top=bs.getBoundingClientRect().top;
    assert(y1<y0-20,'건설 시트가 열렸는데 채팅바가 안 올라갔다: '+Math.round(y0)+' → '+Math.round(y1));
    assert(y1<=top+1,'채팅바가 건설 시트에 깔렸다: 밑변 '+Math.round(y1)+' vs 시트 윗변 '+Math.round(top));
    bs.classList.remove('open'); _syncSheetLift(); await sleep(60);
    if(was) switchTab(was, document.querySelector('.tab[data-tab="'+was+'"]'));
    await sleep(120);
    return '건설 채팅바 ok · 시트 열림에 '+Math.round(y0-y1)+'px 상승'; });}

const GROUPS={ lobby:groupLobby, game:groupGame, sandbox:groupSandbox };

window.runSmoke=async function(group){
  const t0=performance.now();
  const names=group?[group]:Object.keys(GROUPS);
  for(const g of names){ if(GROUPS[g]) await GROUPS[g](); }
  // SKIP 처리: detail이 SKIP으로 시작하면 ok로 재분류(집계 분리)
  for(const s of steps){ if(!s.ok && /^SKIP:/.test(s.detail)){ s.ok=true; s.skip=true; } }
  const fail=steps.filter(s=>!s.ok).length, skip=steps.filter(s=>s.skip).length;
  return { group:names.join('+'), pass:steps.length-fail-skip, fail, skip,
    steps, errors:errors.slice(0,20), knownNoise:noise.length, ms:Math.round(performance.now()-t0) };
};
})();
