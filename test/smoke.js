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
    assert(visible($('authId')) && visible($('authPw')),'아이디/비밀번호 입력칸이 없음');
    assert($('authNick').classList.contains('hide'),'로그인 탭인데 닉네임 칸이 보임');
    // 탭은 허브·유즈맵과 같은 공용 컴포넌트를 쓴다(로그인 화면만 별도 세그먼트 금지)
    var lt=$('segLogin');
    assert(lt.classList.contains('msTab2'),'로그인 탭이 공용 탭(.msTab2)이 아님: '+lt.className);
    assert(document.querySelector('.authTabs').classList.contains('msTabs2'),'탭 바가 .msTabs2가 아님');
    assert(lt.querySelector('svg'),'탭 아이콘이 없음(paintIcons 누락)');
    var ac=getComputedStyle(document.querySelector('.authCard'));
    // 배경이 단색이든 그라데든, 뒤 배경이 비치지 않을 만큼 불투명해야 한다
    var acAlpha=(ac.backgroundImage.indexOf('gradient')>=0)
      ? Math.min.apply(null,(ac.backgroundImage.match(/rgba([^)]*)/g)||['rgba(0,0,0,1)']).map(function(c){var m=c.match(/[0-9.]+/g);return parseFloat(m[3]||1);}))
      : parseFloat((ac.backgroundColor.match(/[0-9.]+/g)||[])[3]||0);
    assert(acAlpha>0.6,'로그인 카드가 투명해 배경과 겹침(alpha '+acAlpha+')');
    assert(ac.boxShadow!=='none','로그인 카드에 질감(그림자)이 없음');
    assert(ac.clipPath && ac.clipPath!=='none','로그인 카드 외곽이 각진 HUD 형태가 아님');
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
    openAuth(); $('authId').value=''; $('authPw').value='';
    await authSubmit(); await sleep(120);
    assert(visible($('auth')),'빈 칸인데 로그인 화면을 벗어남(자동 입장이 남아 있음)');
    assert(!visible($('hubScreen')),'빈 칸인데 게임 선택으로 넘어감');
    assert(($('authErr').textContent||'').length>0,'빈 칸인데 안내가 없음');
    const gb=$('authGuest'); assert(gb && visible(gb),'게스트로 시작하기 버튼이 없음');
    gb.click();
    // 게스트 입장도 로딩(#opening에서 3D 데우기)을 거친다 — 끝날 때까지 기다린다.
    // ⚠ 이 대기는 넉넉해야 한다: 실기기(GPU)에선 1초 안이지만 헤드리스 소프트웨어 렌더러(swiftshader)에선
    //   3D 예열에 10초 넘게 걸린다. 4초로 뒀다가 '게스트가 안 들어간다'고 잘못 실패했다(앱은 정상).
    for(let i=0;i<120 && !(visible($('townScreen'))||visible($('charScreen'))||visible($('homeScreen'))); i++) await sleep(250);
    assert(visible($('townScreen'))||visible($('charScreen'))||visible($('homeScreen')),'게스트 버튼을 눌렀는데 메인으로 안 감');
    assert(!visible($('auth')),'로그인 화면이 안 닫힘');
    for(let i=0;i<40 && !AUTH.user; i++) await sleep(50);   // 로딩 게이트를 거치면 몇 프레임 늦게 채워질 수 있다
    assert(AUTH.user,'입장했는데 유저가 비어 있음');
    return AUTH.user.nick||AUTH.user.id; });
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
    assert($('opening').classList.contains('hide'),'부팅 후에도 오프닝이 안 감춰짐');
    openHome(); await sleep(40);
    return '가드 있음 · openAuth는 화면을 덮는다(=가드가 필요하다)'; });
  // 메인 화면 = RPG 마을. 허브(게임 선택)는 삭제됐고, 유즈맵은 마을 하단 버튼으로만 들어간다.
  // 메인 화면 = HOME 대시보드. 허브는 삭제됐고, 화면 이동은 전역 하단 네비(#navBar) 하나로만 한다.
  await step('메인 = HOME 대시보드 · 하단 네비로 화면 이동', async()=>{ skipIf(typeof openHome!=='function','HOME 없음');
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
    assert(document.querySelectorAll('#navBar .navIt').length===5,'하단 네비가 5칸이 아님(사냥터·정비·강화·유즈맵·상점)');
    { const navs=[...document.querySelectorAll('#navBar .navIt')].map(x=>x.dataset.nav).join(',');
      assert(navs==='home,upg,gear,map,shop','네비 구성이 다름: '+navs);
      // 토벌은 네비에서 빠지고 HOME 팝업이 됐다 — 2번 칸은 정비(장비·펫·동료)
      assert(document.querySelector('#navBar .navIt[data-nav=upg]').textContent.indexOf('캐릭터')>=0,'2번 칸 표기가 캐릭터가 아님'); }
    // ⚠ .hide 가 실제로 숨기는지 — id 선택자에 display 를 주면 .appScreen.hide(클래스 2개)를 이겨
    //   화면이 안 숨고 다른 화면 위를 덮어 클릭을 전부 먹는다(강화 화면이 실제로 그랬다).
    { const shown=[];
      for(const el of document.querySelectorAll('.appScreen.hide'))
        if(getComputedStyle(el).display!=='none') shown.push(el.id||el.className);
      assert(!shown.length,'.hide 인데 안 숨는 화면: '+shown.join(', ')); }
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='home','HOME 탭이 활성이 아님');
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
      // 짓는 입구는 전장 위 '건설' 한 칸 — 누르면 목록이 펴진다
      { assert(document.querySelectorAll('#hbBuildWrap .hbRoundBtn').length===1,'좌상단 건설 버튼이 없음');
        assert(!document.querySelector('#hbBuildWrap .hbBdMenu'),'누르지도 않았는데 건설 목록이 열려 있음');
        hbToggleBuild();
        const it=[...document.querySelectorAll('#hbBuildWrap .hbBdMenu .hbBdIt')];
        assert(it.length===HB_BUILD_KEYS.length,'건설 목록이 '+HB_BUILD_KEYS.length+'개가 아님: '+it.length);
        assert(it.every(b=>b.querySelector('img')),'건설 목록에 건물 아이콘이 없음');
        hbToggleBuild();
        assert(!document.querySelector('#hbBuildWrap .hbBdMenu'),'다시 눌렀는데 목록이 안 닫힘');
        // 토벌·부스트·건설은 ☰ 더보기 시트로 갔다(2026-08-12) — 좌상단에는 없다
        assert(!document.getElementById('hbDgBtn')&&!document.getElementById('hbBoostBtn'),'토벌·부스트가 아직 좌상단에 있음');
        assert(typeof hbOpenMore==='function','더보기가 없는데 좌상단에서도 빠졌다 — 들어갈 길이 사라진다'); }
      assert(typeof hbOpenBuild!=='function','건설 팝업이 아직 남아 있음(패널로 흡수됐어야 한다)');
      hmUpgTab(before); }
    // 수량은 한 칸을 눌러 돌린다 — 1 → 10 → MAX → 1. 폭은 라벨이 바뀌어도 고정
    { const qs=document.querySelectorAll('.hmUpQ');
      assert(qs.length===1,'수량은 한 칸이어야 함: '+qs.length+'개');
      const box=document.querySelector('.hmUpQty'), w0=Math.round(box.getBoundingClientRect().width);
      const seen=[];
      for(let i=0;i<4;i++){ seen.push(document.querySelector('.hmUpQ').textContent);
        assert(Math.round(document.querySelector('.hmUpQty').getBoundingClientRect().width)===w0,'수량 칸 폭이 변함');
        hmUpgQtyCycle(); }
      assert(seen.join(',')==='×1,×10,MAX,×1','수량 순환이 1→10→MAX→1이 아님: '+seen.join(','));
      hbHunt().upgQty=1; renderHome(); }   // 뒤 검사(1회 구매)가 오염되지 않게 되돌린다
    { const n=document.querySelectorAll('.hmUp').length, all=Object.keys(HB_UPG).length;
      assert(n>0 && n<all,'현재 탭만 그려야 하는데 '+n+'/'+all+'칸');
      // 잠긴 칸은 값·레벨 대신 자물쇠 — 해금 전에 사면 안 된다
      assert(document.querySelectorAll('.hmUp.lk').length>0,'잠긴 업그레이드가 하나도 없음(해금제가 안 걸림)');
      assert(hbUpgOwned('atk') && hbUpgOwned('aspd'),'데미지·공격속도는 처음부터 열려 있어야 함'); }
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
    // 접으면 헤더만 남고 전장이 그만큼 넓어진다(캐릭터가 내려온다)
    // ⚠ 접힘은 max-height 전환(.28s)이라 토글 직후엔 아직 높다 — 전환이 끝난 뒤 재야 한다.
    //   캐릭터 y도 매 프레임 목표를 좇는 형태라 hbResize를 여러 번 돌려 수렴시킨다.
    // ⚠ 헤드리스에선 CSS 전환이 프레임 없이는 진행되지 않아 시작값에 멈춘다(실브라우저는 정상).
    //   시간에 기대지 말고 대기 중인 애니메이션을 확정시킨 뒤 잰다 — '접으면 넓어지는가'만 검사하면 된다.
    { const settle=async()=>{ await sleep(320);
        if(document.getAnimations) for(const a of document.getAnimations()){ try{ a.finish(); }catch(e){} }
        for(let i=0;i<40;i++) hbResize(); };
      const yOpen=_hb.cy, botOpen=_hb.vBot, kOpen=_hb.k;
      hmToggleUpg(); await settle();
      assert(document.querySelector('.hmUpg').classList.contains('down'),'접힘 상태가 안 됨');
      assert(getComputedStyle($('hmUpgGrid')).transitionDuration!=='0s','접힘에 애니메이션이 없음');
      assert(_hb.vBot>botOpen+40,'접었는데 전장이 안 넓어짐: '+Math.round(botOpen)+' → '+Math.round(_hb.vBot));
      assert(_hb.cy>yOpen+20,'접었는데 전장 중심이 안 내려옴');
      // 위치만이 아니라 배율까지 바뀌어야 한다 — 적·글자·링이 캐릭터와 같은 비율로 커진다
      assert(_hb.k>kOpen*1.15,'접었는데 전장 배율이 안 커짐: '+kOpen.toFixed(2)+' → '+_hb.k.toFixed(2));
      hmToggleUpg(); await settle();
      assert(!document.querySelector('.hmUpg').classList.contains('down'),'다시 펴지지 않음');
      assert(Math.abs(_hb.vBot-botOpen)<8,'다시 폈는데 전장이 원래대로 안 돌아옴');
      assert(Math.abs(_hb.k-kOpen)<0.03,'다시 폈는데 배율이 원래대로 안 돌아옴: '+_hb.k.toFixed(2)); }
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
    assert(!document.querySelector('#mapSelect .msHeadL .twBack'),'유즈맵 좌상단 뒤로가기 버튼이 아직 있음');
    mapToHub(); await sleep(80);
    assert(visible($('homeScreen')),'유즈맵에서 뒤로 갔는데 HOME으로 안 옴 [DBG 보이는화면='+
      [...document.querySelectorAll('.appScreen')].filter(e=>visible(e)).map(e=>e.id).join(',')+
      ' CHAR='+(!!CHAR())+' AUTH='+(AUTH.user?(AUTH.user.uid||AUTH.user.id||AUTH.user.nick):'null')+']');
    navGo('town'); await sleep(80);   // 마을 폐지 — 옛 진입점은 HOME으로 리다이렉트된다
    assert(visible($('homeScreen')) && visible($('navBar')),'마을 진입이 HOME으로 안 감 [DBG 보이는화면='+
      [...document.querySelectorAll('.appScreen')].filter(e=>visible(e)).map(e=>e.id).join(',')+']');
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='home','HOME 탭이 활성이 아님');
    // 정비 탭 = 장비·펫·동료 전용 화면 · 상점 탭 = 상점 전용 화면
    navGo('gear'); await sleep(60);
    // 정비·유즈맵·상점은 내려가므로 구역 칸(.on)이 없다 — 화면과 하위 칸으로 확인한다
    assert(visible($('gearScreen')),'네비 정비가 화면을 안 엶');
    assert(document.querySelectorAll('#navBar .navIt[data-sub]').length===3,'정비 하위가 3칸이 아님');
    navGo('shop'); await sleep(60);
    assert(document.querySelectorAll('#navBar .navIt[data-sub]').length===5,'상점 하위가 5칸이 아님');
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
    //   그래서 Jua 표본은 .hmUpgHead 가 아니라 상점 제목(.shopTitle)에서 잰다.
    openShop(); await sleep(60);
    const head=document.querySelector('#shopScreen .shopTitle'), hs=getComputedStyle(head);
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
    if(typeof dgEnter==='function'){ dgEnter(1); assert(shown(),'던전에 재화 바가 없음'); openTown(); }
    openHome(); await sleep(40);
    return '미네랄=pcoin(12,345) · 가스/젬 · 홈/유즈맵/마을/던전 상시'; });
  // 자동사냥(라운드 머신) — 던전과 같은 격리 규칙. hbStep을 직접 돌린다(rAF 비의존).
  await step('자동사냥: 라운드 정산·적 누적·사망 하강·격리', async()=>{ skipIf(typeof hbStart!=='function','자동사냥 없음');
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
    saveMeta();                                   // 기준점 — 여기까지는 저장돼 있다
    _hb.saveT=0; _hb.foes.length=0; _hb.phase='fight'; _hb.waveT=99;
    _hb.char.atk=1e9; _hb.char.range=1e9; _hb.char.cd=.05; _hb.char.cdT=0;   // 확실히 잡도록(사망 부활로 스탯이 돌아와 있다)
    const pcBase=PROF().pcoin;
    _hb.foes.push({ico:'🟢',mdl:'snapper',x:5,y:0,hp:1,hpMax:1,atk:0,spd:0,cdT:9,elite:false});
    for(let i=0;i<60 && PROF().pcoin<=pcBase;i++) hbStep(0.05);
    assert(PROF().pcoin>pcBase,'검사 준비 실패: 처치 보상이 안 들어옴');
    { const sv=JSON.parse(localStorage.getItem(metaKey())||'{}');
      assert(((sv.profile&&sv.profile.pcoin)||0)<PROF().pcoin-1e-9,
        '검사 준비 실패: 이미 저장돼 있어 저장 누락을 잡을 수 없다'); }
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
    assert(!visible($('opening')),'로딩 화면이 안 닫힘');
    const bar=$('opening').querySelector('.opBar');
    assert(!bar || !bar.style.width,'로딩 막대 인라인 폭이 남음 — 다음 로딩이 100%에서 시작한다');
    return ids.length+'종 · 잔여 0'; });
  // 유즈맵 루프는 전역 rAF라 화면을 떠나도 계속 돈다. 그대로 두면 HOME/마을이 빌려 간 공용 3D
  // 캔버스에 자기 유닛 목록을 계속 밀어넣어, 한쪽이 dying으로 지운 모델을 다른 쪽이 매 프레임 다시
  // 만든다(실측: 샌드박스 유닛 38개 재생성 반복 · HOME 60 → 47fps).
  // 모델 개수가 아니라 '누가 sync를 부르는가'를 본다 — 앞 스텝의 상태에 안 흔들린다.
  await step('HOME/마을에서는 유즈맵이 3D를 그리지 않는다', async()=>{
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
    if(typeof openTown==='function'){ openTown(); await sleep(500);
      const town=await spy(700);
      assert(town.nemo===0,'마을인데 유즈맵이 sync를 '+town.nemo+'번 부름');
      if(typeof twLeave==='function') twLeave(); }
    hbStop();
    return 'HOME sync '+home.total+'회 · 유즈맵 침범 0회'; });
  // 회복 구역 표시 — hbDrawHeal이 hbFloor '뒤'에 와야 한다. 앞에 두면 배경 그림이 그대로 덮어
  // 아무것도 안 보인다(실제로 그랬다). 그리는 순서는 코드를 봐선 놓치기 쉬우니 픽셀로 본다.
  await step('사냥터: 중앙 회복 구역이 배경 위에 보인다', async()=>{
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
  await step('웨이브 실패: 시간 초과 → 3초 뒤 1웨이브 · 가운데 · 최대 체력', async()=>{
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
  await step('더보기: 사냥터 ☰ = 판 모음 · 유즈맵 ☰ = 설정', async()=>{
    skipIf(typeof hbOpenMore!=='function','더보기 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(600);
    // ⚠ 이 파일에는 전역 .hide 규칙이 없다(요소마다 선언). 안 만들면 '항상 떠 있는' 상태가 된다.
    assert(!visible($('hbMoreSheet')),'더보기가 처음부터 떠 있음 — .hbMoreWrap.hide 규칙 누락');
    // 좌상단 줄에서 빠졌는지 — 판 여는 것이 두 곳에 있으면 어디를 눌러야 할지 모른다
    const row=[...document.querySelector('.hbIcoRow').children].filter(visible)
      .map(e=>e.getAttribute('aria-label')||e.id);
    for(const gone of ['토벌','부스트']) assert(row.indexOf(gone)<0,'좌상단에 '+gone+'이 남아 있음: '+row.join(','));
    assert(!visible(document.querySelector('#hbBuildWrap > .hbRoundBtn')),'좌상단에 건설 버튼이 남아 있음');
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
    // 건설을 고르면 시트가 닫히고 메뉴가 화면 안에 뜬다(필드를 눌러 배치해야 하므로)
    PROF().pcoin=99999;
    document.querySelector('#hbMoreGrid [data-k="build"]').click(); await sleep(250);
    assert(!visible($('hbMoreSheet')),'건설을 골랐는데 시트가 안 닫힘');
    const menu=document.querySelector('.hbBdMenu'); assert(visible(menu),'건설 메뉴가 안 열림');
    { const m=menu.getBoundingClientRect(), ph=$('phone').getBoundingClientRect();
      assert(m.left>=ph.left-1 && m.right<=ph.right+1 && m.bottom<=ph.bottom+1,'건설 메뉴가 화면 밖으로 나감'); }
    if(typeof hbToggleBuild==='function') hbToggleBuild();
    // 유즈맵에서는 같은 버튼이 설정이어야 한다
    hbStop(); enterSandbox(); await sleep(700);
    $('settingsBtn').click(); await sleep(200);
    assert(visible($('settingsPop')),'유즈맵 ☰ 가 설정을 안 엶');
    assert(!visible($('hbMoreSheet')),'유즈맵에서 더보기가 열림');
    $('settingsPop').classList.add('hide');
    return '항목 '+its.length+'개 · ☰ 아래 2칸 드롭다운 · 유즈맵은 설정 유지'; });
  // 📦 상자 — 맵을 돌아다닐 이유. '공격 대상'이라 사거리 안에 있어야 부순다.
  await step('상자: 사거리 안일 때만 부수고 · 적이 우선 · 보상은 섞여 나온다', async()=>{
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
  // 사냥터 맵 — 그림이 덮는 범위와 걸어갈 수 있는 범위가 같아야 한다.
  // 예전엔 필드(±900×±620)가 그림보다 훨씬 넓어서 걸어 나가면 검은 바닥이 나왔다.
  await step('사냥터: 걸을 수 있는 범위 = 그림이 덮는 범위', async()=>{
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
  await step('던전 배경: 이미지 cover 맞춤 · 없으면 타일 폴백', async()=>{
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
    c.level=30; c.unit.level=30; c.unit.stats={pow:20,vit:15,foc:10,agi:8};
    p.pets={wolf:1}; p.equip=['wolf'];
    // ① 분해값의 합이 실제 profStat과 일치해야 한다(식이 갈라지면 여기서 잡힌다)
    for(const k of PROF_STATS){ const P=profStatParts(k);
      const sum=Math.round((P.job+P.alloc+P.level+P.evo+P.gear)*(1+P.petPct/100));
      assert(sum===P.total,PROF_STAT_NAME[k]+' 분해합이 profStat과 다름: '+sum+' vs '+P.total);
      assert(P.level===c.unit.level,'레벨 기여가 안 맞음'); }
    assert(profStatParts('pow').petPct>0,'펫 보너스가 내역에 안 잡힘');
    // ② 정보 팝업 — 좌상단 HUD로 연다
    const hud=$('hbHud'); assert(hud && hud.tagName==='BUTTON','HUD가 누를 수 있는 버튼이 아님');
    hbOpenInfo(); await sleep(40);
    assert(visible($('hbInfoModal')),'캐릭터 정보 팝업이 안 열림');
    assert(document.querySelectorAll('#hbInfoBody .hbTbl').length>=2,'스탯/전투 수치 표가 없음');
    assert($('hbInfoBody').textContent.indexOf('파워')>=0,'파워 표기가 없음');
    hbCloseInfo();
    // ③ 파워 해금 — 표시만 하는 항목이 없어야 한다(전부 실제 상한을 바꾼다)
    p.unlocks={};
    const b4={pet:profPetSlots(), ally:hbMateMax(), tur:hbBuildMax('turret'), off:profOfflineCapMin()};
    p.unlocks={pet_slot3:1, ally_plus:1, turret_plus:1, pet_slot4:1, idle_12h:1};
    assert(profPetSlots()>b4.pet,'펫 슬롯 해금이 반영 안 됨: '+b4.pet+' → '+profPetSlots());
    assert(hbMateMax()>b4.ally,'동료 정원 해금이 반영 안 됨: '+b4.ally+' → '+hbMateMax());
    assert(hbBuildMax('turret')>b4.tur,'터렛 최대 해금이 반영 안 됨');
    assert(profOfflineCapMin()>b4.off,'오프라인 상한 해금이 반영 안 됨');
    // 해금 표의 모든 항목이 실제로 쓰이는지(코드에 배선된 id인지)
    const wired=['idle_arena','evolve','idle_8h','pet_slot3','ally_plus','turret_plus','pet_slot4','idle_12h'];
    for(const u of PROF_UNLOCKS) assert(wired.indexOf(u.id)>=0,'배선 안 된 해금 항목: '+u.id);
    p.unlocks={}; profSyncUnlocks();
    return '해금 '+PROF_UNLOCKS.length+'단계 · 파워 '+profPower(); });
  // 방치 수입 기준을 자동사냥 실적으로 · 성장(진화·환생)을 HOME에서
  await step('자동사냥: 방치 수입 기준 · HOME 성장(진화·환생)', async()=>{ skipIf(typeof hbNoteRate!=='function','미적용');
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
    for(const id in PROF_JOBS) assert(!PROF_JOBS[id].next,'직업 트리(next)가 아직 남아 있음: '+id);
    assert(Object.keys(PROF_JOBS).length===Object.keys(PROF_CLASSES).length,'직업이 뿌리 3종이 아님');
    // ④ 환생 — 조건이 차면 상단 성장 버튼에 ! 배지(패널 안 줄은 폐기 — 높이가 흔들렸다 · 2026-08-14)
    c.level=PROF_REB_EVERY; c.unit.level=PROF_REB_EVERY; p.pcoin=50000;
    renderHome();
    assert(visible($('hbGrowDot')),'환생 가능한데 성장 배지(!)가 안 보임');
    assert(!document.getElementById('hmStatRow'),'옛 성장 줄이 아직 패널에 있음');
    renderGrowModal();
    assert($('hbGrowBody').textContent.indexOf('환생')>=0,'성장 팝업에 환생이 없음');
    // ⑤ 진화 잠금 안내는 레벨 기준(옛 '파워 350' 문구가 남아 있으면 안 된다)
    const r=profEvolveReq();
    if(!r.unlock) assert($('hbGrowBody').textContent.indexOf('Lv.'+profUnlockNeed('evolve'))>=0,'진화 잠금 안내가 레벨 기준이 아님');
    assert($('hbGrowBody').textContent.indexOf('파워 350')<0,'옛 파워 문구가 남음');
    hbCloseGrow();
    // ⑥ 할 게 없으면 배지는 꺼진다 — 단 버튼 진입점은 그대로 남아야 한다
    c.level=1; c.unit.level=1; p.pcoin=0; renderHome();
    assert(!visible($('hbGrowDot')),'할 게 없는데 성장 배지가 남아 있음');
    { hbOpenMore(); await sleep(100);
      assert(document.querySelector('#hbMoreGrid [data-k="grow"]'),'성장 항목까지 사라짐(항상 열려 있어야 한다)');
      hbCloseMore(); }
    return '실측 '+p.hunt.rate.toFixed(2)+'/s · 직업 '+PROF_JOBS[CHAR().unit.jobId].name; });
  // Phase 4 — 스킬 · 부스트 · 동료/펫 · 건설(터렛·벙커)
  await step('자동사냥: 스킬·부스트·동료·건설', async()=>{ skipIf(typeof hbUseSkill!=='function','Phase4 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const p=PROF(); p.pcoin=999999; hbHunt().build={}; hbHunt().boostT={};
    p.pets={slime:1}; p.equip=['slime']; hbLayoutAllies();
    // ① 동료 — 뽑기로 얻고, 중복을 재료로 넣어 강화한다(미네랄 강화는 없어졌다)
    const H0=hbHunt(); H0.mates={}; H0.party=[]; H0.mateN=0;
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
    const runWave=()=>{ _hb.round=40; _hb.wave=1; _hb.phase='fight'; setSpec();
      _hb.foes.length=0; _hb.pend.length=0; hbSpawnWave();
      // 사거리가 근접(34)이라 적이 화면 밖에서 걸어 들어올 시간이 필요하다 — 6초로는 도착 전에 끝난다
      const k=_hb.kills; for(let i=0;i<300;i++) hbStep(0.05); return _hb.kills-k; };
    hbHunt().build={}; hbHunt().mates={}; hbHunt().party=[]; PROF().equip=[]; hbLayoutAllies();
    const solo=runWave();
    { hbHunt().base={tiles:{},open:99}; hbLayoutBase();
      let c; for(let i=0;i<HB_STRUCT.turret.max && (c=hbFreeCell('turret')); i++) hbPlaceStruct('turret',c[0],c[1]); }
    for(const id of Object.keys(HB_MATES).slice(0,hbMateMax())){ hbHunt().mates[id]={lv:1,dup:0}; hbHunt().party.push(id); }
    hbLayoutAllies();
    const withAllies=runWave();
    assert(solo>0,'측정 불가 — 캐릭터 혼자 하나도 못 잡음(라운드가 너무 셈)');
    assert(withAllies>solo,'아군을 세워도 화력이 안 늘어남: '+solo+' → '+withAllies);
    // 측정 뒤 원복 — 잔적뿐 아니라 '캐릭터 위치'도 되돌린다.
    // 적 출현 위치는 캐릭터 기준이라(hbPlaceFoe), 캐릭터가 구석에 서 있으면 스폰이 화면 경계에 몰려
    // 뒤따르는 '스킬 바 위 스폰 금지' 검사가 엉뚱하게 실패한다.
    _hb.round=1; _hb.wave=1; _hb.phase='fight'; _hb.foes.length=0; _hb.pend.length=0;
    { const c=_hb.char; c.x=0; c.y=0; c.tx=0; c.ty=0; c.mv=0; }
    hbHunt().mates={}; hbHunt().party=[]; hbLayoutAllies();
    return '동료·터렛·벙커·펫 배치 ok · 스킬 3종 · 부스트 연장 ok'; });
  // 🧱 기지 격자 — 타일이 단일 소스. 저장 왕복 · 겹침/범위 · 봉쇄 금지 · 옛 개수형 이관.
  await step('기지 격자: 배치·저장 왕복·겹침/범위·봉쇄 금지', async()=>{ skipIf(typeof hbPlaceStruct!=='function','기지 격자 없음');
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
  await step('벙커: 유닛 구매(벙커별)·동료 1·상한·화력·업그레이드', async()=>{ skipIf(typeof hbBunkerAssign!=='function','벙커 주둔 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const p=PROF(); p.pcoin=9e6;
    const _cSave={..._hb.char};   // ⚠ 아래에서 위치·사거리를 바꾼다 — 뒤 스텝들은 원점·정상 스탯을 가정한다
    // 동료 5명 출전(로스터 앞에서부터) · 기지 초기화
    const H=hbHunt(); H.upg.bkatk=0; H.mates={}; H.party=[];
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
  await step('설정 버튼: HOME에서 눌리고 · 캐릭터가 안 움직인다', async()=>{ skipIf(typeof openAppSettings!=='function','앱 설정 없음');
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
  await step('필드 이동: 드래그 추종 · 손 떼면 정지 · 스크롤 안 뺏김', async()=>{ skipIf(typeof hbFieldMove!=='function','필드 포인터 없음');
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
  await step('건설 모드: 라운드 정지·초기화 · 연속 배치 · 방향 이어가기', async()=>{ skipIf(typeof hbBuildEnter!=='function','건설 모드 없음');
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
  await step('미로: 벽 통과 금지 · 적이 돌아서 온다 · 열린 곳은 직진', async()=>{ skipIf(typeof hbBakeField!=='function','경로탐색 없음');
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
  // 🧱 3D 건물 — 이 환경엔 three.js(CDN)가 없어 M3D가 아예 없다. 목록 생성 로직만 스텁으로 검사한다.
  await step('기지 3D: sync 목록에 건물이 실린다(화면 밖 컬링)', async()=>{ skipIf(typeof hb3dStructs!=='function','3D 구조물 없음');
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
  await step('자동사냥: 던전 해금 · 엘리트 · 뽑기권', async()=>{ skipIf(typeof hbGoDungeon!=='function','던전 선택 없음');
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
    hbOpenRounds(); await sleep(40);
    const chips=document.querySelectorAll('#hbDgRow .hbDg');
    assert(chips.length===HB_DG_MAX,'던전 칩이 '+HB_DG_MAX+'개가 아님: '+chips.length);
    assert(chips[2].classList.contains('lock'),'던전3이 잠금 표시가 아님');
    hbGoDungeon(2);
    assert(hbHunt().dg===2 && _hb.dg===2,'던전 이동이 반영되지 않음');
    assert(_hb.round===HB_DG_UNLOCK||_hb.round===1,'이동 후 라운드가 이상함: '+_hb.round);
    hbCloseRounds(); hbGoDungeon(1); hbGoRound(1);
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
      assert(D.foes && D.foes.length===3, at+' 적이 3종이 아님');
      for(const f of D.foes){
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
    const f1=HB_DUNGEONS[0].foes.map(f=>f.mdl).join(), f2=HB_DUNGEONS[1].foes.map(f=>f.mdl).join();
    assert(f1!==f2,'던전 1과 2의 적이 같음 — 옮겨도 같은 곳으로 느껴진다');
    // 모델 키 오타 검사. MODELS는 모듈 스코프라 전역에서 못 본다 → M3D.modelKeys()로 카탈로그를 받아 대조한다.
    // ⚠ M3D가 없으면(three.js를 못 받는 환경) 검사를 '통과'시키지 말고 그렇게 밝힌다 — 헛도는 검사가 제일 위험하다
    let keyChk='M3D 없음(모델 키 미검증)';
    if(window.M3D && M3D.modelKeys){ const cat=new Set(M3D.modelKeys());
      for(const D of HB_DUNGEONS) for(const f of D.foes)
        assert(cat.has(f.mdl),'던전'+D.dg+'('+D.name+') 모델 키가 카탈로그에 없음: '+f.mdl);
      keyChk='모델 키 '+new Set(HB_DUNGEONS.flatMap(d=>d.foes.map(f=>f.mdl))).size+'종 확인'; }
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
      hbHunt().mates[mid]={lv:1,dup:0}; hbHunt().party=[mid]; hbLayoutAllies();
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
    // 토벌 입구는 네비가 아니라 HOME 스킬 바의 버튼 하나뿐 — 없어지면 들어갈 길이 사라진다
    openHome(); await sleep(80);
    // 토벌 입구는 ☰ 더보기 시트 안의 항목 하나 — 하단 바에는 스킬만 남았다(2026-08-12)
    assert(typeof hbOpenMore==='function','더보기가 없음');
    hbOpenMore(); await sleep(120);
    assert(document.querySelector('#hbMoreGrid [data-k="dg"]'),'더보기에 토벌 항목이 없음 — 들어갈 길이 사라진다');
    hbCloseMore();
    assert(![...document.querySelectorAll('#hbBar .hbSk')].some(b=>b.textContent.indexOf('토벌')>=0),
      '하단 바에 토벌이 남아 있음');
    hbOpenMore(); await sleep(100);
    document.querySelector('#hbMoreGrid [data-k="dg"]').click(); await sleep(250);   // 시트가 닫히고 허브가 열린다
    const hub=document.getElementById('dgHubBody');
    assert(visible(hub),'토벌 허브가 안 열림');
    assert(hub.textContent.indexOf('던전')<0,'토벌 화면에 던전 표기가 남음: '+hub.textContent.slice(0,60));
    assert(hub.textContent.indexOf('토벌')>=0,'토벌 표기가 없음');
    // 허브는 '화면'이 아니라 HOME 위 팝업이라 화면 전환으로 안 닫힌다 — HOME으로 돌아오면 걷어내야 한다
    openHome(); await sleep(80);
    assert(!visible($('dgHubScreen')),'HOME으로 돌아왔는데 토벌 허브 팝업이 HOME을 덮은 채 남음');
    assert(document.getElementById('hbRound').textContent.indexOf('던전')>=0,'자동사냥은 던전 표기를 유지해야 함');
    return '네비 토벌 · HOME 던전'; });
  // HOME 좌상단 HUD — 프로필은 상세하게 맨 위 왼쪽에 고정 · 킬수는 없음 · 라운드 조절은 전용 아이콘 버튼.
  await step('HOME HUD: 좌상단 프로필 상세 · 킬수 없음 · 라운드는 아이콘 버튼', async()=>{
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
    // ④ 라운드 조절 = 던전 제목 구역을 누른다(2026-08-14 · 깃발 아이콘은 폐지)
    const rb=$('hbMid');
    assert(rb && getComputedStyle(rb).pointerEvents!=='none','던전 제목이 눌리지 않음');
    assert(/hbOpenRounds/.test(rb.getAttribute('onclick')||''),'던전 제목에 라운드 선택이 안 걸림');
    assert(!$('hbRoundBtn'),'옛 깃발 버튼이 남아 있음');
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
    rb.click(); await sleep(60);
    assert(visible($('hbRoundSheet')),'아이콘을 눌렀는데 라운드 팝업이 안 열림');
    hbCloseRounds();
    // ⑤ 이름 충돌 금지 — 인게임 홈 하단 탭 줄(.hbTop)이 좌상단 규칙에 먹히면 세로로 무너진다
    { const tabs=document.querySelector('.hbTop.hsTabs'); assert(tabs,'인게임 홈 탭 줄(.hbTop.hsTabs)이 없음');
      const cs=getComputedStyle(tabs);
      assert(cs.position!=='absolute','인게임 탭 줄이 좌상단 규칙에 오염됨(position)');
      assert(cs.flexDirection==='row','인게임 탭 줄이 좌상단 규칙에 오염됨(flex-direction='+cs.flexDirection+')'); }
    return '좌상단 고정(+'+Math.round(tr.left-ph.left)+','+Math.round(tr.top-ph.top)+') · 킬수 없음 · 아이콘 팝업 ok'; });
  // 라운드 선택 — 최고 도달까지만 고를 수 있고, 반복/등반이 클리어 후 행동을 가른다.
  await step('자동사냥: 라운드 선택 · 반복/등반', async()=>{ skipIf(typeof hbOpenRounds!=='function','라운드 선택 없음');
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
    // 칸 수 = 최고 도달 · 단 '다음 마일스톤'까지는 목표로 한 칸 더 보여 준다(도전정신 — 못 고르게 잠근다)
    const cells=document.querySelectorAll('#hbRoundGrid .hbRd');
    const want=Math.max(hbBest(1), hbNextRw(1,_hb.round)||0);
    assert(cells.length===want,'선택지 수가 규칙과 다름: '+cells.length+' vs '+want+'(최고 '+hbBest(1)+' · 다음 보상 '+hbNextRw(1,_hb.round)+')');
    for(const cell of cells){ const n=parseInt(cell.textContent,10);
      assert((n>hbBest(1))===cell.disabled,'라운드 '+n+' 잠금 상태가 최고 도달과 안 맞음(disabled='+cell.disabled+')'); }
    assert(document.querySelector('#hbRoundGrid .hbRd.on').textContent.replace(/\D+$/,'')===String(_hb.round),'현재 라운드가 강조되지 않음');
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
    assert(Object.keys(PROF_JOBS).length===3,'직업이 뿌리 3종이 아님: '+Object.keys(PROF_JOBS).length);
    for(const id in PROF_JOBS){ assert(PROF_CLASSES[id],'뿌리가 아닌 직업이 남음: '+id);
      assert(!PROF_JOBS[id].next && !PROF_JOBS[id].tier,'직업 트리 잔재(next/tier): '+id); }
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
    const H=hbHunt(); H.mates={}; H.party=[]; H.mateN=0; p.tickets={gear:0,pet:0,ally:0};
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
    const p=PROF(); p.pets={}; p.equip=[]; p.petN=0; p.tickets={gear:0,pet:0,ally:0}; p.pcoin=0;
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
    assert(PROF_JOBS[c.unit.jobId],'없어진 직업이 그대로 남음: '+c.unit.jobId);
    assert(c.unit.jobId==='ranger','뿌리로 안 돌아감: '+c.unit.jobId);
    assert(((p.hunt.mates||{}).sniper||{}).lv>=1,'전직해 뒀던 직업이 동료로 안 들어옴');
    assert((p.hunt.party||[]).indexOf('sniper')>=0,'받은 동료가 출전 목록에 없음');
    assert(c.unit.evoStars===1,'진화★가 사라짐');
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
    assert(profXpForLevel(PROF_LV_SOFT+30) > profXpForLevel(PROF_LV_SOFT)*8,'후반이 충분히 무거워지지 않음');
    // ③ 경계에서 튀지 않는다(두 식이 이어져야 한다)
    { const a=profXpForLevel(PROF_LV_SOFT-1), b=profXpForLevel(PROF_LV_SOFT);
      assert(b>a && b<a*1.3,'구간 경계에서 필요 경험치가 튐: '+a+' → '+b); }
    // ④ 곡선은 단조 증가 — 어느 지점에서도 쉬워지면 안 된다
    for(let l=1;l<200;l++) assert(profXpForLevel(l+1)>=profXpForLevel(l),'Lv'+l+'에서 곡선이 내려감');
    return '30레벨 누적 '+c30n.toLocaleString()+'(옛 '+c30o.toLocaleString()+') · 이후 레벨당 ×'+PROF_XP_GEO; });

  await step('환생: 25레벨마다 · 깊이 밀수록 배수↑ · 계정 축은 유지', ()=>{ skipIf(typeof profRebirth!=='function','환생 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; const c=profCreateChar('ranger','환생');
    // ① 문턱 미만이면 못 한다
    c.level=PROF_REB_EVERY-1;
    assert(!profCanRebirth(c),'문턱 미만인데 환생이 가능함');
    assert(profRebirth(c)===0,'문턱 미만인데 환생이 실행됨');
    assert(c.level===PROF_REB_EVERY-1,'실패한 환생이 레벨을 건드림');
    // ② 문턱에서 1단계 · 계정 축(미네랄 업그레이드)과 장비·진화는 그대로
    const H=hbHunt(); H.upg.atk=7; c.unit.evoStars=2;
    c.level=PROF_REB_EVERY; c.xp=123;
    assert(profCanRebirth(c),'문턱인데 환생이 안 됨');
    assert(profRebirth(c)===1,'문턱에서 1단계가 아님');
    assert(c.level===1 && c.xp===0,'환생 뒤 레벨·경험치가 1/0이 아님: Lv'+c.level+' xp'+c.xp);
    assert(c.unit.level===1,'환생 뒤 유닛 레벨이 안 돌아감');
    assert(hbHunt().upg.atk===7,'환생이 계정 축(미네랄 업그레이드)을 지움');
    assert(c.unit.evoStars===2,'환생이 진화★를 지움');
    const mul1=profXpMul(c);
    assert(Math.abs(mul1-(1+PROF_REB_GAIN))<1e-9,'1단계 배수가 다름: '+mul1);
    // ③ 깊이 밀고 환생할수록 많이 받는다 — 2배 레벨 = 2단계
    c.level=PROF_REB_EVERY*2;
    assert(profRebirth(c)===2,'2배 레벨인데 2단계가 아님');
    assert(Math.abs(profXpMul(c)-(1+PROF_REB_GAIN*3))<1e-9,'누적 배수가 다름: '+profXpMul(c));
    // ④ 배수가 '실제 지급'에 붙는다 — 지급 경로가 profGainXp 한 곳인지까지 본다
    c.xp=0; const got=profGainXp(c,100);
    assert(Math.abs(got-100*profXpMul(c))<1e-6,'지급에 배수가 안 붙음: '+got);
    assert(Math.abs(c.xp-got)<1e-6,'지급값과 누적값이 다름');
    return '1단계 ×'+mul1.toFixed(2)+' → 3단계 누적 ×'+profXpMul(c).toFixed(2); });

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

  await step('라운드 보상: 마일스톤 최초 1회 · 팝업에서 미리 확인', async()=>{ skipIf(typeof hbRoundRw!=='function','라운드 보상 없음');
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
    assert(document.querySelectorAll('#hbRoundGrid .hbRd.rw').length>=1,'팝업에 마일스톤 표시가 없음');
    assert(($('hbRoundNote').textContent||'').indexOf('라운드 '+nx)>=0,'팝업 안내에 다음 보상이 안 적힘');
    hbCloseRounds();
    return '간격 '+HB_RW_EVERY+' · 최초 1회 · 던전별 분리 ok'; });

  // 친구 목록은 네비 밖(마을 상단 바)에서 연다 — 네비 칸 수가 바뀌어도 진입점이 사라지지 않게 지킨다.
    await step('유즈맵 선택 → 네모네모 모드 팝업', ()=>{ openMapSelect(); openModeSheet(USEMAPS.nemo_inf||USEMAPS.nemo);
    const mo=document.querySelector('#modeSheet .moCard'); assert(visible(mo),'moCard 안 보임');
    const w=mo.getBoundingClientRect().width; assert(w>200&&w<400,'moCard 폭 이상: '+w); closeModeSheet(); return 'w='+w; });
  await step('방찾기 열림+목록', ()=>{ openRooms(); const rm=document.querySelector('#rooms .rmCard'); assert(visible(rm),'rmCard 안 보임');
    const n=$('roomList').children.length; assert(n>0,'방 목록 비어있음'); $('rooms').classList.add('hide'); return n+'개 방'; });
    // 마을: 월드 좌표계 + 카메라. 헤드리스는 rAF가 멈춰 있어 twStep(dt)을 직접 pump한다.
      // 🎁 상점 = 팝업이 아니라 전용 화면. 네비·마을 구역 두 경로 모두 같은 화면으로 간다.
  await step('하단 네비 2층: 구역 → 전용 네비 → 돌아가기', async()=>{
    const read=()=>[...document.querySelectorAll('#navBar .navIt')].map(e=>e.dataset.nav||('~'+e.dataset.sub));
    openHome(); await sleep(40);
    // ① 최상위 = 5구역. NAV_TREE 가 단일 소스이므로 순서도 표에서 온다
    assert(read().join(',')==='home,upg,gear,map,shop','최상위 네비가 5구역이 아님: '+read().join(','));
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='home','사냥터가 활성이 아님');
    // ② 사냥터는 내려가지 않는다 — 하위는 화면 상단 버튼줄이 맡는다
    navGo('home'); await sleep(40);
    assert(read().join(',')==='home,upg,gear,map,shop','사냥터를 눌렀는데 내려감: '+read().join(','));
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
    assert(read().join(',')==='home,upg,gear,map,shop','돌아가기 후 최상위가 아님: '+read().join(','));
    // ⑥ 상점 = 5구역 · 유즈맵 = 소셜 3구역(정렬은 화면 위 띠로 되돌렸다)
    navGo('shop'); await sleep(60);
    assert(read().join(',')==='back,~deal,~draw,~res,~pack,~gem','상점 전용 네비가 아님: '+read().join(','));
    navGo('map'); await sleep(60);
    assert(read().join(',')==='back,~chat,~friend,~party','유즈맵 전용 네비가 아님: '+read().join(','));
    assert(document.querySelector('#navBar .navIt.cur').dataset.sub==='chat','유즈맵 기본 하위가 채팅이 아님');
    assert(document.querySelectorAll('#msSortTabs .msSortTab').length===4,'유즈맵 정렬 띠가 화면 위로 안 돌아옴');
    // ⑦ 소셜 = 유즈맵 하단 상주 구역(#msSocialDock). 시트가 아니라 항상 화면 몫을 차지한다.
    //    ⛔ DOM(.msSocial)은 하나뿐 — 도크에 '옮겨' 온 것이어야 한다(복제 검사)
    { const dock=$('msSocialDock');
      assert(dock && visible(dock),'소셜 도크가 유즈맵 화면에 없음');
      assert(dock.getBoundingClientRect().height>=150,'소셜 도크가 화면 몫을 못 받음');
      assert(document.querySelectorAll('.msSocial').length===1,'소셜 DOM 이 복제됨');
      assert(dock.querySelector('.msSocial'),'소셜이 도크로 안 옮겨짐');
      assert(!visible(dock.querySelector('.msTabs2')),'도크 안 탭 띠가 네비와 중복 노출됨');
      assert(visible(dock.querySelector('#msChatWrap')),'기본(채팅)인데 채팅 창이 안 보임'); }
    navSub('party'); await sleep(40);
    assert(document.querySelector('#twChat.hide'),'파티를 눌렀는데 마을 시트가 열림(도크가 맡아야 한다)');
    assert(getComputedStyle($('msPanelBody')).display!=='none','파티 패널이 안 보임');
    assert(document.querySelector('#navBar .navIt.cur').dataset.sub==='party','소셜 선택 표시가 안 따라옴');
    // 마을 채팅 시트가 열리면 소셜을 되찾아 가고, 유즈맵에 다시 오면 도크로 돌아온다
    openTown(); await sleep(40); twOpenChat(); await sleep(40);
    assert(document.querySelector('#twChat .msSocial'),'마을 시트가 소셜을 못 되찾음');
    assert(visible(document.querySelector('#twChat .msTabs2')),'마을 시트에선 탭 띠가 보여야 함(네비에 소셜 칸이 없다)');
    twCloseChat(); navGo('map'); await sleep(60);
    assert($('msSocialDock').querySelector('.msSocial'),'유즈맵 복귀 시 소셜이 도크로 안 돌아옴');
    navSub('chat');   // 상태 정리(기본 채팅)
    // ⑧ 판형: 최상위 등폭 · 뒤로 = 정사각 · 하위 선택(.cur) = 최상위 선택(.on)과 같은 판·링
    navBack(); await sleep(40);
    { const ws=[...document.querySelectorAll('#navBar .navIt')].map(e=>e.getBoundingClientRect().width);
      assert(Math.max(...ws)-Math.min(...ws)<1.5,'최상위 칸이 등폭이 아님: '+ws.map(w=>w|0).join(','));
      const on=getComputedStyle(document.querySelector('#navBar .navIt.on'));
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
    return '등폭 5칸 · 뒤로 48² · 소셜 도크 상주';
  });

  await step('상점: 전용 화면(팝업 아님) · 네비/마을 구역 두 경로', async()=>{ skipIf(typeof openShop!=='function','상점 화면 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','상점'); saveMeta(); }
    navGo('shop'); await sleep(60);
    assert(visible($('shopScreen')),'네비 상점이 전용 화면을 안 엶');
    assert(!visible($('townPanel')),'상점이 아직 팝업으로 열림');
    assert(!visible($('townScreen')),'상점인데 마을 화면이 남아 있음');
    assert(document.querySelector('#shopBody .shopTitle'),'상점 제목줄이 없음');
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
    for(const sel of ['.shopTitle','.shopHead','.shopTag','.shopBuy']){ const e=document.querySelector('#shopBody '+sel)||document.querySelector(sel);
      if(e) assert(+getComputedStyle(e).fontWeight<=700, sel+' 굵기가 700 초과(가짜 볼드): '+getComputedStyle(e).fontWeight); }
    assert(document.querySelectorAll('#navBar .navIt[data-sub]').length===5,'상점 하위가 5칸이 아님');
    // 마을 구역(뽑기집)도 팝업이 아니라 같은 화면으로
    openTown(); await sleep(40); openTownPanel('gacha'); await sleep(60);
    assert(visible($('shopScreen')) && !visible($('townPanel')),'마을 구역이 아직 팝업으로 열림');
    openHome(); await sleep(40);
    return '전용 화면 · 두 경로 ok'; });
  // 🧰 정비 = 장비·펫·동료 전용 화면. 내용은 전부 기존 렌더러 재사용(단일 소스) — 복제본이 생기면 여기서 걸린다.
  await step('정비: 전용 화면 · 장비/펫/동료 탭 · 렌더러 재사용', async()=>{ skipIf(typeof openGear!=='function','정비 화면 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','정비'); saveMeta(); }
    navGo('gear'); await sleep(60);
    assert(visible($('gearScreen')),'네비 정비가 전용 화면을 안 엶');
    assert(!visible($('townPanel')) && !visible($('townScreen')),'정비인데 마을이 남아 있음');
    // 탭 띠는 화면에서 걷어내고 하단 네비로 올렸다(2026-08-14) — 같은 UI 를 두 군데 두지 않는다
    assert(!document.getElementById('gearTabs'),'정비 화면에 옛 탭 띠가 남아 있음');
    assert(document.querySelectorAll('#navBar .navIt[data-sub]').length===3,'정비 하위가 네비에 3칸이 아님');
    assert(document.querySelector('#navBar .navIt.cur').dataset.sub==='gear','기본 하위가 장비가 아님');
    // ① 장비 = 마을 장비창과 같은 renderProfGear() — 아바타(페이퍼돌) + 가방이 그대로 나와야 한다
    assert(document.querySelector('#gearBody .gearWrap'),'장비 탭에 장비창이 없음');
    assert(document.querySelector('#gearBody .bagBody'),'장비 탭에 가방이 없음');
    { const ref=renderProfGear().replace(/\s+/g,'');
      assert(ref.indexOf('gearWrap')>=0 && document.getElementById('gearBody').innerHTML.replace(/\s+/g,'').slice(0,40)===ref.slice(0,40),
        '정비 장비 탭이 renderProfGear()와 다름(복제 의심)'); }
    // ② 펫 = 상점 '보유 펫'과 같은 _shopPetPanel()
    setGearTab('pet'); await sleep(40);
    assert(document.querySelector('#navBar .navIt.cur').dataset.sub==='pet','펫 하위가 활성이 아님');
    { const ref=_shopPetPanel().replace(/\s+/g,'');
      assert(document.getElementById('gearBody').innerHTML.replace(/\s+/g,'').slice(0,60)===ref.slice(0,60),
        '정비 펫 탭이 _shopPetPanel()과 다름(복제 의심)'); }
    // ③ 동료 = 아직 시스템 없음 → HOME 건설로 보내는 자리
    setGearTab('ally'); await sleep(40);
    assert(document.querySelectorAll('#gearBody .shopPanel').length>=1,'동료 탭이 비어 있음');
    assert(document.querySelector('#gearBody').textContent.indexOf('동료')>=0,'동료 탭에 동료 표기가 없음');
    setGearTab('gear');
    // 굵기 700 상한(DESIGN.md §2)
    for(const sel of ['#gearScreen .shopTitle','#navBar .navIt']){ const e=document.querySelector(sel);
      if(e) assert(+getComputedStyle(e).fontWeight<=700, sel+' 굵기가 700 초과(가짜 볼드): '+getComputedStyle(e).fontWeight); }
    openHome(); await sleep(40);
    return '하위 3칸 · renderProfGear/_shopPetPanel 재사용 ok'; });
      await step('캐릭터: 성장은 따로 · 재화와 펫은 공용', ()=>{ skipIf(typeof profCreateChar!=='function','캐릭터 시스템 없음');
    const p=PROF(); p.pcoin=1000; p.pets={wolf:{count:1}}; p.equip=['wolf'];
    const a=CHAR(); a.unit.stats.pow=(a.unit.stats.pow||0)+12;   // 성장 흔적을 직접 넣는다(찍는 경로는 없앴다)
    const powA=profStat('pow'), spA=a.statPoints||0;
    const b=profCreateChar('scout','둘째'); assert(b,'두 번째 캐릭터 생성 실패');
    assert(CHAR().id===b.id,'새로 만든 캐릭터가 선택되지 않음');
    assert(PROF().pcoin===1000,'재화가 캐릭터를 따라감(공용이어야 함): '+PROF().pcoin);
    assert(PROF().equip.length===1,'펫 장착이 캐릭터를 따라감(공용이어야 함)');
    assert(!b.statPoints && b.level===1 && profStat('pow')!==powA,'새 캐릭터가 성장을 물려받음');
    assert(profSelectChar(a.id),'되돌아가기 실패');
    assert((a.statPoints||0)===spA && profStat('pow')===powA,'되돌아온 캐릭터의 성장이 바뀜');
    return '슬롯 '+PROF().chars.length+'/'+PROF_MAX_CHARS; });
  await step('캐릭터 삭제: 재화는 환급 · 경험치는 소멸 · 장비는 가방에 남음', ()=>{ skipIf(typeof profDeleteChar!=='function','캐릭터 삭제 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; p.items.length=0; p.pcoin=100000; p.unlocks={evolve:true};
    const c=profCreateChar('ranger','환급'); assert(c,'캐릭터 생성 실패');
    const before=p.pcoin;
    c.unit.level=30; c.level=30;                         // 진화 레벨 요건 충족(전직은 폐지됨)
    assert(profEvolve(),'진화 실패');
    const spent=before-p.pcoin; assert(spent>0,'지출이 0');
    const it=profAddItem(profMakeItem('weapon',3,'rare')); assert(profEquipItem(it.iid),'장비 장착 실패');
    c.xp=999; c.level=12; c.statPoints=7;                 // 경험치로 얻은 것 — 환급 대상이 아니어야 한다
    assert(profRefundOf(c)===spent,'환급액이 쓴 재화와 다름(장비가 섞였는지 확인): '+profRefundOf(c)+' vs '+spent);
    _charDelId=c.id;                                      // 확인 UI(무엇을 잃고 얻는지)
    const html=renderCharSelect(); _charDelId=null;
    assert(html.indexOf('삭제할까요')>=0 && html.indexOf('P 반환')>=0 && html.indexOf('경험치 소멸')>=0,'삭제 확인 UI가 안 나옴');
    const cash=p.pcoin, got=profDeleteChar(c.id);
    assert(got===spent,'삭제 환급액 불일치: '+got);
    assert(p.pcoin===cash+spent,'재화가 안 돌아옴: '+p.pcoin);
    assert(p.chars.length===0 && CHAR()===null,'캐릭터가 안 지워짐');
    assert(profItems().length===1 && !profItemHolder(it.iid),'장비가 사라졌거나 장착이 안 풀림');
    return '지출 '+spent+'P → 전액 환급 · 장비는 가방에 남음'; });
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
    profCreateChar('scout','B');                          // 새 캐릭터가 현재 선택된다
    assert(profItems().length===1,'가방이 캐릭터를 따라감(계정 공용이어야 함)');
    assert(!profEquipItem(it.iid),'다른 캐릭터가 장착 중인데 장착됨');
    assert(profScrapItem(it.iid)===-1,'장착 중인데 분해됨');
    assert(profSelectChar(a.id) && profEquipItem(it.iid),'A로 돌아가 해제 실패');
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
    openTown(); openTownPanel('gear');                        // openTown이 loadMeta로 다시 읽으므로 CHAR()는 이 뒤에 잡는다
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
    assert(eq.querySelector('.pdLv').textContent==='4','슬롯에 아이템 레벨이 안 뜸');
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
    const ks=Object.keys(PROF_GEAR), ts=PROF_ITEM_TIERS.map(t=>t.id);
    for(let i=0;i<26;i++) profAddItem(profMakeItem(ks[i%ks.length], 1+(i%5), ts[i%ts.length]));
    saveMeta(); _gearPick=null; _gearSel=null;
    openTown(); openTownPanel('gear'); CHAR().level=40; refreshTownPanel();
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
    // 분류 칩 — 고른 분류의 장비만 남아야 한다
    const cats=body.querySelectorAll('.bagHead .bagCat');
    assert(cats.length===PROF_BAG_CATS.length,'가방 분류 칩 수 불일치: '+cats.length);
    assert(body.querySelector('.bagCat.on').textContent===PROF_BAG_CATS[0].name,'기본 분류가 전체가 아님');
    profBagCat('acc');
    const accItems=profItems().filter(i=>PROF_GEAR[i.slot].part==='acc').length;
    assert($('tpBody').querySelectorAll('.igCell').length===accItems,'분류를 골라도 다른 분류가 같이 나옴');
    assert(accItems>0 && accItems<profItems().length,'분류 검사용 표본이 치우침');
    profBagCat('');
    assert($('tpBody').querySelectorAll('.igCell').length===profItems().length,'전체로 안 돌아옴');
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
  await step('장비창: DESIGN.md 규칙(라운드 토큰 · 시안 1곳 · 1px 테두리)', ()=>{
    skipIf(typeof profPickSlot!=='function','장비창 없음');
    const p=PROF(); p.chars.length=0; p.curId=''; p.items.length=0;
    profCreateChar('ranger','룰');
    const ks=Object.keys(PROF_GEAR), ts=PROF_ITEM_TIERS.map(t=>t.id);
    for(let i=0;i<14;i++) profAddItem(profMakeItem(ks[i%ks.length], 1+(i%5), ts[i%ts.length]));
    saveMeta(); _gearPick=null; _gearSel=null; _gearCat=''; _gearPage=PROF_GEAR_PAGES[0].id;
    openTown(); openTownPanel('gear'); CHAR().level=40; refreshTownPanel();
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
    profGearPageAt(1); profBagCat('acc');
    r=scan(); assert(!r.cyan.length,'섹션/분류가 시안을 채움: '+r.cyan.slice(0,4).join(', '));
    profBagCat(''); profGearPageAt(0);
    // 아이템을 고르면 그 칸 하나만 시안(공용 .twBtn 제외 — 마을 전체 전환 때 처리)
    profSelItem(profItems()[2].iid);
    r=scan();
    const own=r.cyan.filter(c=>String(c).indexOf('twBtn')<0);
    assert(own.length===1 && String(own[0]).indexOf('igCell')>=0,
      '선택 시 시안이 정확히 고른 칸 하나가 아님: '+JSON.stringify(own));
    // 숫자는 Rajdhani + tabular-nums
    for(const sel of ['.gearSum b','.gsSub','.igCell .igLv']){ const e=body.querySelector(sel);
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
    const cc=CHAR(); cc.level=6; cc.dgFloor=2;                  // Lv6 → 3단계 개방, 2단계까지 클리어
    const p=PROF(); p.dgKeys={}; p.tickets={gear:0,pet:0,ally:0}; saveMeta();
    openDungeonHub();
    assert(visible($('dgHubScreen')),'던전 허브가 안 열림');
    assert(document.querySelectorAll('#dgHubBody .dgCard').length===3,'던전 카드가 3개가 아님');
    assert(document.querySelectorAll('#dgHubBody .dgCard.lock').length===2,'장비·룬 던전이 Lv6에서 잠겨 있어야 함');
    assert(dgKeyN('normal')===DG_KEY_DAILY,'일반 던전 열쇠 초기값 불일치: '+dgKeyN('normal'));
    // 팝업 열기 → 소탕 = 열쇠 1 소모 + 미네랄 증가
    dgOpenSheet('normal'); assert(!$('dgSheet').classList.contains('hide'),'던전 팝업이 안 열림');
    const k0=dgKeyN('normal'), m0=Math.floor(PROF().pcoin); dgSheetSweep();
    assert(dgKeyN('normal')===k0-1,'소탕이 열쇠를 안 씀');
    assert(Math.floor(PROF().pcoin)>m0,'소탕이 미네랄을 안 줌');
    // 열쇠 0이면 입장이 전투로 진입하지 않는다
    PROF().dgKeys.normal.n=0; dgOpenSheet('normal'); dgSheetEnter();
    assert(!visible($('dgScreen')),'열쇠 0인데 입장이 진행됨');
    // 뽑기권 = 새 단계 클리어 시 적립
    const t0=(PROF().tickets||{}).gear||0; dgAwardTickets(3);
    assert(((PROF().tickets||{}).gear||0)===t0+1,'뽑기권이 안 쌓임');
    dgCloseSheet(); openHome();
    return '카드3·팝업·소탕·열쇠게이트·뽑기권 ok'; });
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
    const snap=()=>JSON.stringify({p:G.phase,u:G.units.length,e:G.enemies.length,c:G.credits,
      m:G.mineral,g:G.gas,r:G.round,t:G.tab,s:G.mainSheet,k:G.kills});
    const before=snap();
    const p=PROF(); p.chars.length=0; p.curId=''; const c=profCreateChar('warden','던전');
    c.unit.stats={pow:40,vit:40,foc:0,agi:10};                 // 1층은 확실히 이기는 스펙
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
    assert(CHAR().dgFloor===1,'최고 층이 기록되지 않음');
    return n+'프레임 · +'+r.pc+'P/+'+r.xp+'XP'; });
  await step('던전: 스펙이 오르면 같은 층이 빨리 끝남', ()=>{ skipIf(typeof dgStart!=='function','던전 없음');
    const run=(stats)=>{ const p=PROF(); p.chars.length=0; p.curId='';
      const c=profCreateChar('ranger','T'); c.unit.stats=stats;   // foc=0 → 치명타 없음 = 결정적
      dgStart(1); dgStopLoop(); let n=0; while(DG && !DG.over && n<20000){ dgStep(0.016); n++; }
      const o=DG.over; DG=null; return {over:o, n:n}; };
    const weak=run({pow:12,vit:40,foc:0,agi:0}), strong=run({pow:60,vit:40,foc:0,agi:0});
    assert(weak.over>0 && strong.over>0,'비교하려면 둘 다 이겨야 함: '+weak.over+'/'+strong.over);
    assert(strong.n < weak.n*0.9,'공격력을 올렸는데 클리어가 안 빨라짐: '+weak.n+'→'+strong.n);
    return weak.n+' → '+strong.n+'프레임'; });
  await step('캐릭터 이름은 HTML로 해석되지 않음', ()=>{ skipIf(typeof profCreateChar!=='function','캐릭터 시스템 없음');
    const p=PROF(); p.chars.length=0; p.curId='';
    profCreateChar('scout','<b>x</b>');                 // 이름은 사용자 입력 — innerHTML에 그대로 들어가면 안 된다
    const host=document.createElement('div');
    host.innerHTML=renderCharSelect();
    assert(host.textContent.indexOf('<b>x</b>')>=0,'보관소에서 이름이 마크업으로 해석됨');
    host.innerHTML=renderProfStats();
    assert(host.textContent.indexOf('<b>x</b>')>=0,'광장에서 이름이 마크업으로 해석됨');
    return '이스케이프 확인'; });
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
  await step('전체 선택 → 프로필 표시', ()=>{ G.sel=G.units.map(u=>u.uid); refreshSelCard();
    assert($('unitCmd').classList.contains('on'),'unitCmd off'); return G.sel.length+'기 선택'; });
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
  await step('무기 업그레이드 구매', ()=>{ skipIf(typeof upgCost!=='function'||typeof buyGachaUp!=='function','업그레이드 API 없음');
    hackCredits(); const b=G.gachaLuckLv||0; buyGachaUp(); assert((G.gachaLuckLv||0)===b+1,'gachaLuckLv 미증가'); return 'Lv'+G.gachaLuckLv; });
  await step('보스 탭 표시/배지 갱신', ()=>{ updatePbossFab(); const bt=$('bossTab');
    assert(bt.style.display!=='none','게임 중인데 보스 탭 숨김'); return 'dot="'+($('bossTabDot')||{}).textContent+'"'; });
  await step('보스 시트 = 개인보스만(포인트방 분리)', ()=>{ openMainHome(); const bt=$('bossTab'); bt.click();
    const txt=$('unitCmd').innerText; assert(/개인보스/.test(txt),'보스 시트 아님');
    assert(!/유닛 파견|토벌장/.test(txt),'보스 시트에 포인트방 셀이 남음'); openMainHome(); return 'ok'; });
  await step('보스바 클릭 → 토벌장 직행(맵 영역 전환)', ()=>{ skipIf(typeof openBossArena!=='function','없음'); skipIf(!G.coopBoss,'공용보스 없음(맵 설정)');
    assert(!$('pointRoomPop'),'구 포인트방 팝업이 남아있음(보스바=직행이어야 함)');
    assert(!$('mapName'),'구 맵이름(#mapName)이 남아있음');
    assert($('coopBossBar').getAttribute('onclick').includes('openBossArena'),'보스바가 아레나로 직행 안 함');
    $('coopBossBar').click(); assert(G.bossOpen===true,'토벌장 미진입');
    assert(visible($('bossPanel')),'아레나 컨트롤 패널 숨김'); return 'ok'; });
  await step('아레나 4그리드 + 카드탭=1기 즉시 파견', ()=>{ skipIf(!G.bossOpen,'아레나 아님');
    assert(!$('baCtl') && !$('baBackBtn') && !$('bossDeployBar'),'구 상단버튼/확정바가 안 지워짐');
    refreshSelCard(); const host=$('unitCmd'); assert(host.classList.contains('on'),'하단 시트 비활성');
    let txt=host.innerText; assert(/전체 회수/.test(txt) && /돌아가기/.test(txt),'4그리드 라벨 누락');
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
    const items=[...document.querySelectorAll('#settingsPop .setMenu .setItem')];
    const keys=items.map(e=>(e.getAttribute('onclick')||'').replace(/[^a-z]/g,''));
    assert(items.length===3,'설정 리스트는 3개여야 한다(비디오·임무·디스코드): '+items.length);
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
        for(const v of c.borderRadius.split(/[\s\/]+/))
          if(v && v!=='0px' && v!=='50%' && OK.indexOf(v)<0) bad.push((e.className||e.tagName)+'='+v);
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
}

// ── 그룹: sandbox (관리자) ──
async function groupSandbox(){
  await step('샌드박스 진입', async()=>{ skipIf(typeof enterSandbox!=='function','없음'); enterSandbox(); await sleep(300);
    assert(G.sandbox===true,'sandbox 플래그'); return 'units='+G.units.length; });
  await step('샌드박스 탭 구성(전투실험·건설 표시, 보스 숨김)', ()=>{ updatePbossFab();
    assert($('battleTab').style.display!=='none','battleTab 숨김'); assert($('buildTab').style.display!=='none','buildTab 숨김');
    assert($('bossTab').style.display==='none','bossTab이 샌드박스에 노출'); return 'ok'; });
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
}

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
