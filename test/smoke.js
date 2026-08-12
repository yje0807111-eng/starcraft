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
    { const rgb=s=>(s.match(/\d+(\.\d+)?/g)||[]).slice(0,3).map(Number);
      for(const el of [...document.querySelectorAll('#homeScreen .hmCard, #homeScreen .hmUp, #homeScreen .hmUpIco')]){
        const c=getComputedStyle(el);
        for(const src of [c.backgroundColor, c.backgroundImage, c.borderTopColor]){
          for(const m of (src.match(/rgba?\([^)]*\)/g)||[])){ const [r,g,b]=rgb(m);
            if(r===undefined) continue;
            assert(Math.max(r,g,b)-Math.min(r,g,b)<=12,
              'HOME에 푸른기가 남음('+(el.className||el.tagName)+'): '+m); } }
        for(const v of c.borderRadius.split(/[\s\/]+/))
          assert(!v || v==='0px' || v==='3px', 'HOME 모서리가 너무 둥금('+(el.className||el.tagName)+'): '+v); } }
    assert(document.querySelectorAll('#navBar .navIt').length===4,'하단 네비가 4칸이 아님(HOME·정비·유즈맵·상점) — 마을은 폐지됐다');
    { const navs=[...document.querySelectorAll('#navBar .navIt')].map(x=>x.dataset.nav).join(',');
      assert(navs==='home,gear,map,shop','네비 구성이 다름: '+navs);
      // 토벌은 네비에서 빠지고 HOME 팝업이 됐다 — 2번 칸은 정비(장비·펫·동료)
      assert(document.querySelector('#navBar .navIt[data-nav=gear]').textContent.indexOf('정비')>=0,'2번 탭 표기가 정비가 아님'); }
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='home','HOME 탭이 활성이 아님');
    // 실데이터에 붙은 곳 = 사냥터 업그레이드(공격/방어/유틸 3탭 · 해금제)
    assert(document.querySelectorAll('.hmUpTab').length===3,'업그레이드 탭이 3개가 아님');
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
      const ch=cell.getBoundingClientRect().height, rows=(gr.clientHeight-16+8)/(ch+8);
      assert(Math.abs(rows-2.7)<0.15,'업그레이드 높이가 2.7행이 아님: '+rows.toFixed(2)+'행');
      const h0=gr.clientHeight;
      hmUpgTab('def'); const h1=$('hmUpgGrid').clientHeight;
      hmUpgTab('atk');
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
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='map','유즈맵 탭이 활성이 아님');
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
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='gear','정비 탭이 활성이 아님');
    assert(visible($('gearScreen')),'네비 정비가 화면을 안 엶');
    navGo('shop'); await sleep(60);
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='shop','상점 탭이 활성이 아님');
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
    openHome(); await sleep(60);
    const head=document.querySelector('.hmUpgHead'), hs=getComputedStyle(head);
    assert(/JuaKR/.test(hs.fontFamily),'제목에 제목 폰트(JuaKR)가 안 걸림: '+hs.fontFamily);
    const body=document.querySelector('.hmUpName'), bs=getComputedStyle(body);
    assert(!/JuaKR/.test(bs.fontFamily),'본문까지 제목 폰트라 위계가 없음: '+bs.fontFamily);
    const hsz=parseFloat(hs.fontSize), bsz=parseFloat(bs.fontSize);
    assert(hsz-bsz>=3,'제목이 본문보다 충분히 크지 않음: 제목 '+hsz+' / 본문 '+bsz);
    return '제목 Jua '+hsz+'px · 본문 Noto '+bsz+'px · 숫자 Rajdhani'; });
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
    for(let i=0;i<440;i++) hbStep(0.05);   // 22초 — 웨이브 시간(20s)을 넘긴다
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
    assert(!document.querySelector('#hmStatRow .hmStat:not(.grow)'),'HOME에 스탯 배분 버튼이 남아 있음');
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
  // 웨이브 시간(20s) 안에 못 비우면 실패 → 3초 뒤 1웨이브부터. 라운드는 안 내려간다(죽음과 다르다).
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
    const tk0=((PROF().tickets&&PROF().tickets.gear)||0), gem0=PROF().gem||0;
    for(let i=0;i<200 && S.chests.length;i++) hbStep(0.05);
    assert(!S.chests.length,'사거리 안인데 안 부서짐(hp '+near.hp+')');
    const got=(((PROF().tickets&&PROF().tickets.gear)||0)-tk0) + ((PROF().gem||0)-gem0);
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
    const b4={pet:profPetSlots(), ally:hbBuildMax('post'), tur:hbBuildMax('turret'), off:profOfflineCapMin()};   // ally_plus 해금 = 동료 초소(post) 상한
    p.unlocks={pet_slot3:1, ally_plus:1, turret_plus:1, pet_slot4:1, idle_12h:1};
    assert(profPetSlots()>b4.pet,'펫 슬롯 해금이 반영 안 됨: '+b4.pet+' → '+profPetSlots());
    assert(hbBuildMax('post')>b4.ally,'동료 최대 해금이 반영 안 됨');
    assert(hbBuildMax('turret')>b4.tur,'터렛 최대 해금이 반영 안 됨');
    assert(profOfflineCapMin()>b4.off,'오프라인 상한 해금이 반영 안 됨');
    // 해금 표의 모든 항목이 실제로 쓰이는지(코드에 배선된 id인지)
    const wired=['idle_arena','evolve','idle_8h','pet_slot3','ally_plus','turret_plus','pet_slot4','idle_12h'];
    for(const u of PROF_UNLOCKS) assert(wired.indexOf(u.id)>=0,'배선 안 된 해금 항목: '+u.id);
    p.unlocks={}; profSyncUnlocks();
    return '해금 '+PROF_UNLOCKS.length+'단계 · 파워 '+profPower(); });
  // 방치 수입 기준을 자동사냥 실적으로 · 전직/진화를 HOME에서
  await step('자동사냥: 방치 수입 기준 · HOME 전직/진화', async()=>{ skipIf(typeof hbNoteRate!=='function','미적용');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    // ① 방치 수입 = 자동사냥 실적. 클리어 전에는 옛 공식으로 떨어진다.
    const p=PROF(), c=CHAR();
    delete p.hunt.rate;
    const before=profIdleRate();
    assert(before>0,'첫 클리어 전 수입이 0');
    _hb.char.atk=1e9; _hb.char.range=1e9; _hb.char.cd=.05; _hb.char.hpMax=1e9; _hb.char.hp=1e9;
    let clears=0;
    for(let i=0;i<20000 && clears<2;i++){ const ph=_hb.phase; hbStep(0.05); if(ph!=='clearWait'&&_hb.phase==='clearWait') clears++; }
    assert(clears>0,'라운드 클리어가 안 됨');
    assert(p.hunt.rate>0,'실측 시급이 기록되지 않음');
    assert(profIdleRate()>before,'방치 수입이 자동사냥 실적을 안 따라감: '+before.toFixed(2)+' → '+profIdleRate().toFixed(2));
    // ② 전직 — 조건을 채우면 HOME 성장 줄에 배지가 뜨고, 팝업에서 바로 된다
    c.level=25; c.unit.level=25; c.statPoints=0; p.pcoin=50000;
    renderHome();
    assert(visible($('hmStatRow')),'전직 가능한데 성장 줄이 안 보임');
    assert(document.querySelector('.hmStat.grow'),'성장 배지가 없음');
    hbOpenGrow(); await sleep(40);
    assert(visible($('hbGrowModal')),'성장 팝업이 안 열림');
    const j0=CHAR().unit.jobId;
    const btn=[].slice.call(document.querySelectorAll('#hbGrowBody .hbRowBtn')).filter(function(x){ return !x.disabled && x.textContent==='전직'; })[0];
    assert(btn,'전직 버튼이 활성화되지 않음');
    btn.click();
    assert(CHAR().unit.jobId!==j0,'전직이 반영되지 않음');
    assert(_hb.char.atk>0,'전투 수치가 갱신되지 않음');
    // ③ 진화 — 조건 미달이면 잠금 안내가 뜬다(파워 350)
    const r=profEvolveReq();
    if(!r.unlock) assert($('hbGrowBody').textContent.indexOf('파워 350')>=0,'진화 잠금 안내가 없음');
    hbCloseGrow();
    // ④ 할 게 없으면 성장 줄은 숨는다
    p.pcoin=0; CHAR().statPoints=0; renderHome();
    assert(!visible($('hmStatRow')),'할 게 없는데 성장 줄이 남아 있음');
    return '실측 '+p.hunt.rate.toFixed(2)+'/s · 전직 '+PROF_JOBS[CHAR().unit.jobId].name; });
  // Phase 4 — 스킬 · 부스트 · 동료/펫 · 건설(터렛·벙커)
  await step('자동사냥: 스킬·부스트·동료·건설', async()=>{ skipIf(typeof hbUseSkill!=='function','Phase4 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const p=PROF(); p.pcoin=999999; hbHunt().boostT={};
    // 🧱 기지는 타일이 단일 소스다. 테스트는 전 구역을 열고 시작한다(open을 크게 = 맵 전체 해금)
    const wipe=()=>{ hbHunt().base={tiles:{},open:99}; hbLayoutBase(); };
    const fill=(k,n)=>{ let c; for(let i=0;i<n && (c=hbFreeCell(k)); i++) hbPlaceStruct(k,c[0],c[1]); };
    wipe(); p.pets={slime:1}; p.equip=['slime']; hbLayoutAllies();
    // ① 건설 — 타일에 놓으면 즉시 전장에 선다 · 최대치를 넘지 않는다 · 값이 오른다
    const c0=hbBuildCost('post'); fill('post',1);
    assert(hbStructN('post')===1 && _hb.allies.length===1,'동료 초소가 배치되지 않음');
    assert(hbBuildCost('post')>c0,'다음 구매 비용이 안 오름');
    fill('turret',1); fill('bunker',1);
    assert(_hb.turrets.length===1 && _hb.bunkers.length===1,'터렛/벙커가 배치되지 않음');
    fill('bunker',HB_STRUCT.bunker.max+3);
    assert(hbStructN('bunker')===HB_STRUCT.bunker.max,'최대치를 넘겨 지어짐: '+hbStructN('bunker'));
    assert(_hb.pets.length===1,'장착 펫이 전장에 안 나옴');
    // ② 아군 화력 — 같은 상황을 아군 없이/있이 돌려 처치 수를 비교한다
    //    ⚠ 아군 발사 주기는 캐릭터 쿨다운(c.cd)을 공유한다 — 캐릭터를 막으면 아군도 멈춰서 그 방식으론 못 잰다
    const runWave=()=>{ _hb.round=1; _hb.wave=1; _hb.phase='fight';
      _hb.foes.length=0; _hb.pend.length=0; hbSpawnWave();
      // 사거리가 근접(34)이라 적이 화면 밖에서 걸어 들어올 시간이 필요하다 — 6초로는 도착 전에 끝난다
      const k=_hb.kills; for(let i=0;i<300;i++) hbStep(0.05); return _hb.kills-k; };
    // 구조물은 코어(회복 구역) 밖에만 지을 수 있으므로, 비교는 '기지 안에 서 있는' 상황에서 한다.
    // 회복이 안 닿는 자리라 체력을 크게 잡아 사망으로 결과가 뒤집히지 않게 한다 — 재는 것은 화력뿐이다.
    const HG=6, spot=[hbTx(HG),hbTx(HG)];
    const _cSave={...(_hb.char)};   // ⚠ 뒤 스텝들은 캐릭터가 원점에 정상 체력으로 있다고 가정한다 — 반드시 되돌린다
    // 스탯을 고정한다 — 앞 스텝이 남긴 값(사거리 1e9 등)에 맡기면 솔로가 혼자 다 잡아 차이가 안 난다
    const runAt=()=>{ const c=_hb.char; c.x=spot[0]; c.y=spot[1]; c.tx=null; c.ty=null;
      c.hpMax=1e9; c.hp=1e9; c.range=80; c.cd=0.6; c.atk=6; c.crit=0; c.regen=0; return runWave(); };
    wipe(); PROF().equip=[]; hbLayoutAllies();
    const solo=runAt();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) hbPlaceStruct('post',HG+dx,HG+dy);
    for(const [dx,dy] of [[1,1],[-1,-1],[1,-1],[-1,1]]) hbPlaceStruct('turret',HG+dx,HG+dy);
    assert(_hb.allies.length&&_hb.turrets.length,'초소·터렛이 캐릭터 옆에 안 세워짐');
    const withAllies=runAt();
    Object.assign(_hb.char,_cSave); _hb.foes.length=0; _hb.pend.length=0;   // 원복(위치·체력·목적지)
    assert(withAllies>solo,'아군을 세워도 화력이 안 늘어남: '+solo+' → '+withAllies);
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
    assert(document.querySelectorAll('#hbBar .hbSk').length===Object.keys(HB_SKILLS).length+3,'스킬 바 버튼 수가 다름(스킬 + 건설·토벌·부스트)');
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
    hbHunt().boostT={}; hbHunt().base={tiles:{},open:99}; hbLayoutAllies();
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
    const B=hbBase();
    assert(hbStructN('post')===2 && hbStructN('turret')===1 && hbStructN('bunker')===1,
      '옛 보유분 이관 실패: post '+hbStructN('post')+' / turret '+hbStructN('turret')+' / bunker '+hbStructN('bunker'));
    assert(!Object.keys(H.build).length,'이관 후에도 옛 개수형이 남음');
    hbHunt().base={tiles:{},open:1}; hbLayoutBase(); saveMeta();
    return '왕복·겹침·범위·저장·봉쇄차단·이관 ok'; });
  // 🪖 벙커 = 주둔 유닛만큼 쏜다. 유닛 화력 = 캐릭터 공격력 × 비율 × 방어탭 bkatk.
  await step('벙커: 주둔 유닛 추가·상한·화력·업그레이드 반영', async()=>{ skipIf(typeof hbBunkerAdd!=='function','벙커 주둔 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const p=PROF(); p.pcoin=9e6;
    const _cSave={..._hb.char};   // ⚠ 아래에서 위치·사거리를 바꾼다 — 뒤 스텝들은 원점·정상 스탯을 가정한다
    hbHunt().base={tiles:{},open:99}; hbHunt().upg.bkatk=0; hbLayoutBase();
    assert(hbPlaceStruct('bunker',6,6),'벙커 배치 실패');
    const q=hbKey(6,6), t=hbBase().tiles[q];
    assert(hbBunkerN(t)===1,'새 벙커는 유닛 1기로 시작해야 함: '+hbBunkerN(t));
    assert(_hb.bunkers.length===1 && _hb.bunkers[0].n===1,'전장 벙커에 주둔 수가 안 실림');
    // ① 유닛 추가 — 값이 깎이고 수가 는다
    hbOpenBunker(q);
    const c1=hbBunkerUnitCost(1), coin=p.pcoin; hbBunkerAdd();
    assert(hbBunkerN(t)===2,'유닛이 안 늘어남');
    assert(Math.round(coin-p.pcoin)===c1,'비용이 안 맞음: '+(coin-p.pcoin)+' vs '+c1);
    assert(hbBunkerUnitCost(2)>c1,'다음 유닛 비용이 안 오름');
    // ② 상한 — 넘겨서 눌러도 SLOTS를 안 넘는다
    for(let i=0;i<HB_BUNKER_SLOTS+3;i++) hbBunkerAdd();
    assert(hbBunkerN(t)===HB_BUNKER_SLOTS,'주둔 상한을 넘김: '+hbBunkerN(t));
    hbCloseBunker();
    // ③ 화력 — 킬 수는 웨이브 진행에 흔들린다. 죽지 않는 표적 하나를 세워 '깎인 체력'을 직접 잰다.
    // ⚠ 벙커 사거리도 캐릭터 사거리를 따른다(hbUnitFire) — 캐릭터 사거리를 0으로 두면 벙커도 못 쏜다
    const dmgOf=(n,bk)=>{ hbHunt().upg.bkatk=bk; t.n=n; hbLayoutBase();
      const c=_hb.char; c.x=hbTx(6); c.y=hbTx(6)+200; c.tx=null; c.ty=null;   // 캐릭터는 멀리 — 제 화력이 안 섞이게
      c.hpMax=1e9; c.hp=1e9; c.range=70; c.cd=0.5; c.atk=40; c.crit=0; c.regen=0;
      _hb.round=1; _hb.wave=1; _hb.phase='fight'; _hb.foes.length=0; _hb.pend.length=0; _hb.allies.length=0; _hb.turrets.length=0; _hb.pets.length=0;
      hbPlaceFoe({ico:'x',hpMul:1,atkMul:1,spd:0});
      const f=_hb.foes[0]; f.x=hbTx(6)+30; f.y=hbTx(6); f.hp=f.hpMax=1e9; f.atk=0; f.spd=0;   // 안 죽고 안 움직이고 안 때린다
      for(let i=0;i<100;i++){ f.x=hbTx(6)+30; f.y=hbTx(6); hbStep(0.05); }
      return Math.round(f.hpMax-f.hp); };
    const none=dmgOf(0,0), some=dmgOf(HB_BUNKER_SLOTS,0);
    assert(none===0,'유닛이 없는데 벙커가 피해를 줌: '+none);
    assert(some>0,'벙커에 유닛을 넣어도 피해가 없음');
    // ④ 방어 탭 업그레이드가 실제 피해에 배수로 들어간다
    assert(HB_UPG.bkatk && HB_UPG.bkatk.cat==='def','벙커 공격력 업그레이드가 방어 탭에 없음');
    const up=dmgOf(HB_BUNKER_SLOTS,10);
    assert(up>some*1.2,'bkatk를 올려도 피해가 안 늘어남: '+some+' → '+up);
    hbHunt().upg.bkatk=0;
    Object.assign(_hb.char,_cSave); _hb.foes.length=0; _hb.pend.length=0;   // 원복
    hbHunt().base={tiles:{},open:1}; hbLayoutBase(); saveMeta();
    return '주둔 1시작·추가·상한 '+HB_BUNKER_SLOTS+'·피해 0/'+some+'/'+up+'(bkatk+10) ok'; });
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
    for(let i=0;i<3;i++) _hb.foes.push({ico:'🟢',mdl:'snapper',x:100+i*40,y:i*30,
      hp:9,hpMax:9,atk:1,spd:60,cdT:9,elite:(i===2)});
    const L1=hb3dList();
    assert(L1.length===4,'목록 개수가 다름(나+적3): '+L1.length);
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
    const ent=[...document.querySelectorAll('#hbBar .hbSk')].filter(b=>b.textContent.indexOf('토벌')>=0);
    assert(ent.length===1,'HOME 토벌 버튼이 1개가 아님: '+ent.length);
    ent[0].click(); await sleep(80);
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
    assert(tr.top-ph.top<=8,'프로필이 맨 위가 아님: '+Math.round(tr.top-ph.top)+'px');
    { const res=document.querySelectorAll('#curBar .res');
      assert($('curBar').classList.contains('bare'),'HOME 재화 바가 배경 위 숫자(.bare)가 아님');
      assert(res.length,'홈 재화 바가 없음');
      for(const r of res){ const rr=r.getBoundingClientRect();
        assert(rr.left>=tr.right-1,'재화 숫자가 프로필과 겹침'); } }
    // 재화 바는 화면 전체 폭을 덮는 판이라, 투명(.bare)일 때 왼쪽 빈 자리가 프로필 클릭을 삼키면 안 된다
    { const hit=(el)=>{ const r=el.getBoundingClientRect();
        return document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2); };
      for(const id of ['hbHud','hbRoundBtn']){ const el=$(id), got=hit(el);
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
    // ④ 라운드 조절 = 전용 아이콘 버튼(텍스트 구역을 누르는 방식은 폐지)
    const rb=$('hbRoundBtn');
    assert(rb && rb.tagName==='BUTTON','라운드 선택 아이콘 버튼(#hbRoundBtn)이 없음');
    assert(rb.querySelector('svg'),'아이콘 버튼에 SVG 아이콘이 없음(이모지 금지)');
    assert(top.contains(rb),'라운드 아이콘이 좌상단 묶음 안에 없음');
    assert(visible(rb),'라운드 아이콘 버튼이 안 보임');
    const mid=$('hbMid');
    // 프로필이 4줄로 커졌으므로 중앙 라운드 표시는 그 아래로 내려가야 한다(겹치면 글자가 포개진다)
    { const mr=mid.getBoundingClientRect();
      assert(!(mr.left<tr.right && mr.right>tr.left && mr.top<tr.bottom && mr.bottom>tr.top),
        '중앙 라운드 표시가 좌상단 프로필과 겹침: mid.top='+Math.round(mr.top-ph.top)+' vs 프로필 bottom='+Math.round(tr.bottom-ph.top));
      assert(mid.querySelector('b').getBoundingClientRect().height<26,'라운드 이름이 두 줄로 접힘(nowrap 필요)'); }
    assert(mid.tagName!=='BUTTON','중앙 라운드 표시가 아직 버튼임(아이콘으로 옮겨야 함)');
    assert(getComputedStyle(mid).pointerEvents==='none','중앙 표시가 아직 클릭을 먹음');
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
    const cells=document.querySelectorAll('#hbRoundGrid .hbRd');
    assert(cells.length===hbBest(1),'선택지가 최고 도달과 다름: '+cells.length+' vs '+hbBest(1));
    assert(document.querySelector('#hbRoundGrid .hbRd.on').textContent===String(_hb.round),'현재 라운드가 강조되지 않음');
    // ④ 라운드 이동 = 진행 초기화 + 시트 닫힘 · 상한 넘는 값은 잘린다
    hbGoRound(1); await sleep(40);
    assert(_hb.round===1 && _hb.wave===1,'라운드 이동이 반영되지 않음');
    assert(!visible($('hbRoundSheet')),'이동 후 시트가 안 닫힘');
    hbGoRound(999);
    assert(_hb.round===hbBest(1),'최고 도달을 넘겨 이동됨: '+_hb.round);
    hbSetClimb(false);
    return '최고 '+hbBest(1)+'라운드 · 반복/등반 ok'; });
  // 친구 목록은 네비 밖(마을 상단 바)에서 연다 — 네비 칸 수가 바뀌어도 진입점이 사라지지 않게 지킨다.
    await step('유즈맵 선택 → 네모네모 모드 팝업', ()=>{ openMapSelect(); openModeSheet(USEMAPS.nemo_inf||USEMAPS.nemo);
    const mo=document.querySelector('#modeSheet .moCard'); assert(visible(mo),'moCard 안 보임');
    const w=mo.getBoundingClientRect().width; assert(w>200&&w<400,'moCard 폭 이상: '+w); closeModeSheet(); return 'w='+w; });
  await step('방찾기 열림+목록', ()=>{ openRooms(); const rm=document.querySelector('#rooms .rmCard'); assert(visible(rm),'rmCard 안 보임');
    const n=$('roomList').children.length; assert(n>0,'방 목록 비어있음'); $('rooms').classList.add('hide'); return n+'개 방'; });
    // 마을: 월드 좌표계 + 카메라. 헤드리스는 rAF가 멈춰 있어 twStep(dt)을 직접 pump한다.
      // 🎁 상점 = 팝업이 아니라 전용 화면. 네비·마을 구역 두 경로 모두 같은 화면으로 간다.
  await step('상점: 전용 화면(팝업 아님) · 네비/마을 구역 두 경로', async()=>{ skipIf(typeof openShop!=='function','상점 화면 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','상점'); saveMeta(); }
    navGo('shop'); await sleep(60);
    assert(visible($('shopScreen')),'네비 상점이 전용 화면을 안 엶');
    assert(!visible($('townPanel')),'상점이 아직 팝업으로 열림');
    assert(!visible($('townScreen')),'상점인데 마을 화면이 남아 있음');
    assert(document.querySelector('#shopBody .shopTitle'),'상점 제목줄이 없음');
    assert(document.querySelectorAll('#shopBody .shopPanel').length>=3,'상점 구역 패널이 3개 미만');
    assert(document.querySelectorAll('#shopBody .shopDeal').length===3,'오늘의 특가가 3개가 아님');
    assert(document.querySelectorAll('#shopBody .shopRow').length>0,'상점 내용(뽑기 행)이 비어 있음');
    // 재화 아이콘은 resIco 공용(이모지 임의 사용 금지) — 카드 안에 실제 아이콘이 들어갔는지
    assert(document.querySelectorAll('#shopBody img.gi[src*="res_"]').length>0,'상점에 공용 재화 아이콘이 없음');
    // IBM Plex Sans KR은 700이 최대 — 800/900은 가짜 볼드가 된다(DESIGN.md §2)
    for(const sel of ['.shopTitle','.shopHead','.shopTag','.shopBuy']){ const e=document.querySelector('#shopBody '+sel)||document.querySelector(sel);
      if(e) assert(+getComputedStyle(e).fontWeight<=700, sel+' 굵기가 700 초과(가짜 볼드): '+getComputedStyle(e).fontWeight); }
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='shop','상점 탭이 활성이 아님');
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
    assert(document.querySelectorAll('#gearTabs .msSortTab').length===3,'정비 탭이 3개가 아님');
    assert(document.querySelector('#gearTabs .msSortTab.on').dataset.v==='gear','기본 탭이 장비가 아님');
    // ① 장비 = 마을 장비창과 같은 renderProfGear() — 아바타(페이퍼돌) + 가방이 그대로 나와야 한다
    assert(document.querySelector('#gearBody .gearWrap'),'장비 탭에 장비창이 없음');
    assert(document.querySelector('#gearBody .bagBody'),'장비 탭에 가방이 없음');
    { const ref=renderProfGear().replace(/\s+/g,'');
      assert(ref.indexOf('gearWrap')>=0 && document.getElementById('gearBody').innerHTML.replace(/\s+/g,'').slice(0,40)===ref.slice(0,40),
        '정비 장비 탭이 renderProfGear()와 다름(복제 의심)'); }
    // ② 펫 = 상점 '보유 펫'과 같은 _shopPetPanel()
    setGearTab('pet'); await sleep(40);
    assert(document.querySelector('#gearTabs .msSortTab.on').dataset.v==='pet','펫 탭이 활성이 아님');
    { const ref=_shopPetPanel().replace(/\s+/g,'');
      assert(document.getElementById('gearBody').innerHTML.replace(/\s+/g,'').slice(0,60)===ref.slice(0,60),
        '정비 펫 탭이 _shopPetPanel()과 다름(복제 의심)'); }
    // ③ 동료 = 아직 시스템 없음 → HOME 건설로 보내는 자리
    setGearTab('ally'); await sleep(40);
    assert(document.querySelectorAll('#gearBody .shopPanel').length>=1,'동료 탭이 비어 있음');
    assert(document.querySelector('#gearBody').textContent.indexOf('동료')>=0,'동료 탭에 동료 표기가 없음');
    setGearTab('gear');
    // 굵기 700 상한(DESIGN.md §2)
    for(const sel of ['#gearScreen .shopTitle','#gearTabs .msSortTab']){ const e=document.querySelector(sel);
      if(e) assert(+getComputedStyle(e).fontWeight<=700, sel+' 굵기가 700 초과(가짜 볼드): '+getComputedStyle(e).fontWeight); }
    openHome(); await sleep(40);
    return '3탭 · renderProfGear/_shopPetPanel 재사용 ok'; });
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
    c.unit.level=30;                                     // 전직·진화 레벨 요건 충족
    assert(profClassChange('sniper'),'전직 실패');
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
    const coin=p.pcoin;
    assert(dgStart(1),'던전 진입 실패'); dgStopLoop();
    let n=0; while(DG && !DG.over && n<20000){ dgStep(0.016); n++; }
    assert(DG && DG.over>0,'1층 클리어 실패(over='+(DG&&DG.over)+', '+n+'프레임)');
    const r=DG.reward; DG=null;
    assert(snap()===before,'던전이 유즈맵 상태 G를 바꿈');
    assert(p.pcoin===coin+r.pc,'보상 P가 안 들어옴');
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
    // 강조는 바깥이 아니라 안쪽 프레임(::before)이 맡는다 — 바깥은 금속 엣지 그대로
    const fc=getComputedStyle(card,'::before').borderTopColor;
    const fa=/rgba?\([^)]*?,\s*([\d.]+)\)/.exec(fc);
    assert(fa && parseFloat(fa[1])>=0.4,'안쪽 프레임이 흐림: '+fc);
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
