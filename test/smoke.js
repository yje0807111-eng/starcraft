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
  await step('탭 바 단일 소스: 친구 시트 = 유즈맵 하단', ()=>{
    const hub=$('hubFriendTabs'); skipIf(!hub,'친구 시트 탭 없음');
    assert(hub.classList.contains('msTabs2'),'친구 시트가 공용 탭 바(.msTabs2)를 안 씀');
    const map=document.querySelector('#mapSelect .msTabs2');   // 유즈맵 하단 바를 정확히 지정(로그인 화면도 같은 컴포넌트를 쓴다)
    assert(map,'유즈맵 하단 탭 바를 못 찾음');
    const hb=hub.querySelectorAll('button'), mb=map.querySelectorAll('button');
    assert(hb.length && mb.length,'탭 버튼이 없음');
    hb.forEach(b=>assert(b.classList.contains('msTab2'), '허브 탭 버튼에 .msTab2 없음: '+b.textContent.trim()));
    // 허브는 두꺼운 변형 — 복제가 아니라 같은 컴포넌트의 크기 변형이어야 한다(크기 override가 유즈맵 하단으로 새면 안 됨).
    const pad=e=>parseFloat(getComputedStyle(e).paddingTop);
    assert(pad(hb[1])>pad(mb[1]),'허브 소셜 바가 유즈맵 하단보다 두껍지 않음: '+pad(hb[1])+' vs '+pad(mb[1]));
    assert(pad(mb[1])<=10,'유즈맵 하단까지 두꺼워짐(변형이 새어나감): '+pad(mb[1]));
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
    gb.click(); await sleep(120);
    assert(visible($('townScreen'))||visible($('charScreen')),'게스트 버튼을 눌렀는데 메인(마을/캐릭터 생성)으로 안 감');
    assert(!visible($('auth')),'로그인 화면이 안 닫힘');
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
    assert(document.querySelectorAll('#navBar .navIt').length===5,'하단 네비가 5칸이 아님(HOME·던전·마을·유즈맵·상점)');
    { const navs=[...document.querySelectorAll('#navBar .navIt')].map(x=>x.dataset.nav).join(',');
      assert(navs==='home,dungeon,town,map,shop','네비 구성이 다름: '+navs);
      // data-nav는 옛 이름(dungeon) 그대로 두고 표기만 '토벌' — 코드 식별자를 바꾸면 다른 채팅 작업과 충돌한다
      assert(document.querySelector('#navBar .navIt[data-nav=dungeon]').textContent.indexOf('토벌')>=0,'던전 탭 표기가 토벌이 아님'); }
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='home','HOME 탭이 활성이 아님');
    // 실데이터에 붙은 곳 = POWER UPGRADES(영구 업그레이드 6종 — 미네랄 구매·스탯 포인트 흡수)
    assert(document.querySelectorAll('.hmUp').length===6,'업그레이드가 6칸이 아님');
    // 4칸(2행)만 보이고 나머지는 스크롤 — 카드가 화면을 다 먹지 않게
    { const gr=$('hmUpgGrid'), cell=gr.querySelector('.hmUp');
      const ch=cell.getBoundingClientRect().height, rows=Math.round((gr.clientHeight-16+8)/(ch+8));
      assert(rows===2,'업그레이드가 2행(4칸)이 아님: '+rows+'행');
      assert(gr.scrollHeight-gr.clientHeight>10,'나머지 칸이 스크롤되지 않음'); }
    // 접으면 헤더만 남고 전장이 그만큼 넓어진다(캐릭터가 내려온다)
    // ⚠ 접힘은 max-height 전환(.28s)이라 토글 직후엔 아직 높다 — 전환이 끝난 뒤 재야 한다.
    //   캐릭터 y도 매 프레임 목표를 좇는 형태라 hbResize를 여러 번 돌려 수렴시킨다.
    { const settle=async()=>{ await sleep(400); for(let i=0;i<40;i++) hbResize(); };
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
    assert(!visible($('navBar')),'유즈맵 화면에서 네비가 남아 있음');
    mapToHub(); await sleep(80);
    assert(visible($('homeScreen')),'유즈맵에서 뒤로 갔는데 HOME으로 안 옴 [DBG 보이는화면='+
      [...document.querySelectorAll('.appScreen')].filter(e=>visible(e)).map(e=>e.id).join(',')+
      ' CHAR='+(!!CHAR())+' AUTH='+(AUTH.user?(AUTH.user.uid||AUTH.user.id||AUTH.user.nick):'null')+']');
    navGo('town'); await sleep(80);
    assert(visible($('townScreen')) && visible($('navBar')),'네비 마을이 안 열림 [DBG 보이는화면='+
      [...document.querySelectorAll('.appScreen')].filter(e=>visible(e)).map(e=>e.id).join(',')+
      ' nav='+visible($('navBar'))+' CHAR='+(!!CHAR())+']');
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='town','마을 탭이 활성이 아님');
    // 던전 탭 = 관문(던전 선택) 패널 · 상점 탭 = 뽑기집 (전용 화면은 이후 단계)
    navGo('dungeon'); await sleep(60);
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='dungeon','던전 탭이 활성이 아님');
    navGo('shop'); await sleep(60);
    assert(document.querySelector('#navBar .navIt.on').dataset.nav==='shop','상점 탭이 활성이 아님');
    openHome(); await sleep(60);
    return 'HOME 카드 1개 + 네비 5칸(home·던전·마을·유즈맵·상점) ok'; });
  // 폰트 3종 — 제목 Do Hyeon · 본문 IBM Plex Sans KR · 숫자 Rajdhani.
  // ⚠ 실제 렌더가 아니라 CSS만 잰다(헤드리스에선 웹폰트를 못 받을 수 있어 렌더 비교는 못 믿는다).
  await step('폰트: 제목/본문/숫자가 토큰으로 갈린다', async()=>{
    const root=getComputedStyle(document.documentElement);
    const ti=root.getPropertyValue('--font-ti'), ko=root.getPropertyValue('--font-ko'), num=root.getPropertyValue('--font-num');
    // 한글은 제목·본문이 '같은 가족'이다(다른 가족을 섞으면 글자 폭 비율이 달라 따로 논다) → 굵기로 가른다
    assert(/IBM Plex Sans KR/.test(ti),'제목 토큰이 IBM Plex Sans KR이 아님: '+ti);
    assert(/IBM Plex Sans KR/.test(ko),'본문 토큰이 IBM Plex Sans KR이 아님: '+ko);
    assert(/Rajdhani/.test(num),'숫자 토큰에 Rajdhani가 없음: '+num);
    assert(ti!==num && ko!==num,'숫자 폰트가 한글과 안 갈림');
    // 웹폰트를 실제로 불러오는가 — @import 한 줄에 둘 다 있어야 한다
    const imp=[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch(e){return []}})
      .filter(r=>r.type===CSSRule.IMPORT_RULE).map(r=>r.href).join(' ');
    for(const f of ['Rajdhani','IBM+Plex+Sans+KR'])
      assert(imp.indexOf(f)>=0, f+'를 웹폰트로 안 불러옴: '+imp);
    // 본문 굵기(400~600)까지 받아와야 제목 700과 대비가 생긴다
    assert(/IBM\+Plex\+Sans\+KR:wght@[^&]*400/.test(imp),'본문 굵기를 안 받아옴: '+imp);
    // 개별 규칙에 폰트 이름을 박아두면 토큰이 무의미해진다
    let hard=0, sample='';
    for(const sh of document.styleSheets){ let rules; try{rules=sh.cssRules}catch(e){continue}
      for(const r of rules||[]){ const ff=r.style&&r.style.fontFamily;
        if(ff && /Rajdhani|Do Hyeon|IBM Plex|Apple SD Gothic/.test(ff)){ hard++; if(!sample) sample=r.selectorText+' → '+ff; } } }
    assert(hard===0,'개별 규칙에 폰트 이름이 박혀 있음('+hard+'곳): '+sample);
    // 제목 위계 = 굵기. IBM Plex Sans KR은 700이 최대라 800/900이 남으면 가짜 볼드가 된다
    openHome(); await sleep(60);
    const head=document.querySelector('.hmUpgHead'), hs=getComputedStyle(head);
    assert(/IBM Plex Sans KR/.test(hs.fontFamily),'제목에 제목 폰트가 안 걸림: '+hs.fontFamily);
    const hw=parseInt(hs.fontWeight,10);
    assert(hw===700,'제목 굵기가 700이 아님(800↑이면 가짜 볼드): '+hw);
    // 본문은 제목보다 가벼워야 위계가 산다
    const body=document.querySelector('.hmUpLv'), bw=parseInt(getComputedStyle(body).fontWeight,10);
    assert(bw<hw,'본문이 제목만큼 굵어 위계가 없음: 본문 '+bw+' / 제목 '+hw);
    // 제목은 본문보다 확실히 커야 한다(같은 가족이라 크기까지 같으면 구분이 안 된다)
    const hsz=parseFloat(hs.fontSize), bsz=parseFloat(getComputedStyle(body).fontSize);
    assert(hsz-bsz>=3,'제목이 본문보다 충분히 크지 않음: 제목 '+hsz+' / 본문 '+bsz);
    return '제목 IBM Plex Sans KR 700/'+hsz+'px · 본문 400/'+bsz+'px · 숫자 Rajdhani'; });
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
    openHome(); await sleep(80);
    assert(_hb && _hb.on,'전투가 시작 안 됨');
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
    // ② 적 누적: 화력 0으로 20초를 흘리면 다음 웨이브와 합쳐진다
    _hb.char.atk=0; _hb.char.hp=1e9; _hb.char.hpMax=1e9; _hb.char.regen=0;
    _hb.phase='fight'; _hb.wave=1; _hb.foes.length=0; _hb.pend.length=0; hbSpawnWave();
    const n1=_hb.foes.length+_hb.pend.length;
    for(let i=0;i<560;i++) hbStep(0.05);   // 28초 = 웨이브1(20s)+간격(3s)+웨이브2 스폰 후
    assert(_hb.wave===2,'20초 뒤 다음 웨이브로 안 넘어감: wave '+_hb.wave);
    assert(_hb.foes.length+_hb.pend.length>n1,'미처치 적이 누적되지 않음: '+(_hb.foes.length+_hb.pend.length)+' ≤ '+n1);
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
    openMapSelect(); await sleep(60); assert(!_hb.on,'홈을 떠났는데 루프가 살아 있음');
    openHome(); await sleep(60); assert(_hb.on,'재진입 시 재개 안 됨');
    return rep; });
  // 레벨업 보상(스탯 포인트)은 메인 화면에서 바로 찍혀야 한다 — 마을까지 걸어가야 하면 성장 축의 절반이 숨는다.
  await step('자동사냥: 레벨업 스탯을 HOME에서 배분', async()=>{ skipIf(typeof hmAllocStat!=='function','HOME 스탯 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60);
    const c=CHAR(); c.statPoints=0; renderHome();
    assert(!visible($('hmStatRow')),'포인트가 없는데 스탯 줄이 보임');
    // 레벨업 = 포인트 지급
    const lv0=c.level; c.xp=profXpForLevel(c.level)+1;
    assert(profApplyLevelUps(c)>0,'레벨업이 안 됨');
    assert(c.level===lv0+1 && c.statPoints===PROF_PT_PER_LV,'레벨업 보상이 스탯 포인트가 아님: '+c.statPoints);
    renderHome();
    assert(visible($('hmStatRow')),'포인트가 있는데 스탯 줄이 안 보임');
    assert(document.querySelectorAll('#hmStatRow .hmStat').length===PROF_STATS.length,'스탯 칸 수가 다름');
    // 찍으면 스탯·전투 수치에 즉시 반영
    const pow0=profStat('pow'), atk0=_hb.char.atk;
    document.querySelector('#hmStatRow .hmStat').click();
    assert(profStat('pow')===pow0+1,'스탯이 안 올랐음');
    assert(c.statPoints===PROF_PT_PER_LV-1,'포인트가 안 깎임');
    assert(_hb.char.atk>atk0,'전투 중 공격력에 반영되지 않음: '+atk0+' → '+_hb.char.atk);
    return 'Lv'+c.level+' · 포인트 '+c.statPoints; });
  // Phase 4 — 스킬 · 부스트 · 동료/펫 · 건설(터렛·벙커)
  await step('자동사냥: 스킬·부스트·동료·건설', async()=>{ skipIf(typeof hbUseSkill!=='function','Phase4 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    const p=PROF(); p.pcoin=999999; hbHunt().build={}; hbHunt().boostT={};
    p.pets={slime:1}; p.equip=['slime']; hbLayoutAllies();
    // ① 건설 — 사면 즉시 전장에 선다 · 최대치를 넘지 않는다 · 값이 오른다
    const c0=hbBuildCost('ally'); hbBuy('ally');
    assert(hbBuildN('ally')===1 && _hb.allies.length===1,'동료가 배치되지 않음');
    assert(hbBuildCost('ally')>c0,'다음 구매 비용이 안 오름');
    hbBuy('turret'); hbBuy('bunker');
    assert(_hb.turrets.length===1 && _hb.bunkers.length===1,'터렛/벙커가 배치되지 않음');
    for(let i=0;i<HB_BUILD.bunker.max+3;i++) hbBuy('bunker');
    assert(hbBuildN('bunker')===HB_BUILD.bunker.max,'최대치를 넘겨 지어짐: '+hbBuildN('bunker'));
    assert(_hb.pets.length===1,'장착 펫이 전장에 안 나옴');
    // ② 아군 화력 — 같은 상황을 아군 없이/있이 돌려 처치 수를 비교한다
    //    ⚠ 아군 발사 주기는 캐릭터 쿨다운(c.cd)을 공유한다 — 캐릭터를 막으면 아군도 멈춰서 그 방식으론 못 잰다
    const runWave=()=>{ _hb.round=1; _hb.wave=1; _hb.phase='fight';
      _hb.foes.length=0; _hb.pend.length=0; hbSpawnWave();
      const k=_hb.kills; for(let i=0;i<120;i++) hbStep(0.05); return _hb.kills-k; };
    hbHunt().build={}; PROF().equip=[]; hbLayoutAllies();
    const solo=runWave();
    hbHunt().build={ally:HB_BUILD.ally.max, turret:HB_BUILD.turret.max}; hbLayoutAllies();
    const withAllies=runWave();
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
    assert(document.querySelectorAll('#hbBar .hbSk').length===Object.keys(HB_SKILLS).length+2,'스킬 바 버튼 수가 다름');
    hbHunt().boostT={}; hbHunt().build={}; hbLayoutAllies();
    return '동료·터렛·벙커·펫 배치 ok · 스킬 3종 · 부스트 연장 ok'; });
  // Phase 2 — 던전 1~10 해금 · 엘리트 · 장비 뽑기권(드랍 + 소비처)
  await step('자동사냥: 던전 해금 · 엘리트 · 뽑기권', async()=>{ skipIf(typeof hbGoDungeon!=='function','던전 선택 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openHome(); await sleep(60); _hb.manual=true;
    // ① 해금 — 던전1만 열려 있고, 10라운드 도달해야 던전2가 열린다
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
  await step('용어 분리: 자동사냥=던전 / 옛 콘텐츠=토벌', async()=>{ skipIf(typeof openDungeonHub!=='function','토벌 허브 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    const nav=document.querySelector('#navBar .navIt[data-nav=dungeon]');
    assert(nav && nav.textContent.indexOf('토벌')>=0,'네비 탭이 토벌이 아님: '+(nav&&nav.textContent));
    openDungeonHub(); await sleep(80);
    const hub=document.getElementById('dgHubBody');
    assert(visible(hub),'토벌 허브가 안 열림');
    assert(hub.textContent.indexOf('던전')<0,'토벌 화면에 던전 표기가 남음: '+hub.textContent.slice(0,60));
    assert(hub.textContent.indexOf('토벌')>=0,'토벌 표기가 없음');
    openHome(); await sleep(80);
    assert(document.getElementById('hbRound').textContent.indexOf('던전')>=0,'자동사냥은 던전 표기를 유지해야 함');
    return '네비 토벌 · HOME 던전'; });
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
  await step('친구: 마을 상단 바에서 열림', async()=>{ skipIf(typeof twOpenSocial!=='function','친구 시트 없음');
    if(typeof CHAR==='function' && !CHAR()){ profCreateChar('ranger','스모크'); saveMeta(); }
    openTown(); await sleep(60);
    const fb=document.querySelector('#townScreen .twBar [aria-label="친구"]');
    assert(fb && visible(fb),'마을 상단 바에 친구 진입점이 없음');
    assert(fb.querySelector('svg'),'친구 버튼 아이콘이 안 그려짐(data-ico 미치환)');
    fb.click(); await sleep(60);
    assert(visible($('twSocial')),'친구 시트가 안 열림');
    const n=document.querySelectorAll('#hubFriends .frRow').length;
    assert(n>0,'친구 목록이 비어 있음');
    twCloseSocial(); assert(!visible($('twSocial')),'친구 시트가 안 닫힘');
    return n+'명'; });
  await step('유즈맵 선택 → 네모네모 모드 팝업', ()=>{ openMapSelect(); openModeSheet(USEMAPS.nemo_inf||USEMAPS.nemo);
    const mo=document.querySelector('#modeSheet .moCard'); assert(visible(mo),'moCard 안 보임');
    const w=mo.getBoundingClientRect().width; assert(w>200&&w<400,'moCard 폭 이상: '+w); closeModeSheet(); return 'w='+w; });
  await step('방찾기 열림+목록', ()=>{ openRooms(); const rm=document.querySelector('#rooms .rmCard'); assert(visible(rm),'rmCard 안 보임');
    const n=$('roomList').children.length; assert(n>0,'방 목록 비어있음'); $('rooms').classList.add('hide'); return n+'개 방'; });
  await step('마을 입장: 캐릭터 생성 → 그대로 입장', ()=>{ skipIf(typeof openCharScreen!=='function','캐릭터 시스템 없음');
    PROF().chars.length=0; PROF().curId=''; saveMeta();   // 이전 실행이 남긴 캐릭터를 지우고 첫 진입 상태로
    //   ⚠ saveMeta() 필수 — openCharScreen()이 loadMeta()로 저장소를 다시 읽어 되살린다
    openCharScreen();   // 허브 삭제: 캐릭터 화면이 마을의 앞단
    assert(visible($('charScreen')),'마을 입장 시 캐릭터 화면이 안 뜸');
    assert($('csTitle').textContent.indexOf('만들기')>=0,'캐릭터가 없는데 생성 화면이 아님: '+$('csTitle').textContent);
    const inp=$('ccName'); assert(inp,'이름 입력칸 없음'); inp.value='테스트';
    charDoCreate('warden');
    const c=CHAR(); assert(c,'캐릭터가 안 만들어짐');
    assert(c.cls==='warden' && c.name==='테스트','생성 결과 불일치: '+c.cls+'/'+c.name);
    assert(_townOpen,'생성 후 마을로 안 들어감');
    assert(document.querySelector('#twAvatar .twAvBody').textContent===PROF_CLASSES.warden.ico,'아바타가 캐릭터 종류를 안 따라감');
    return c.name+'('+PROF_JOBS[c.unit.jobId].name+')'; });
  // 마을: 월드 좌표계 + 카메라. 헤드리스는 rAF가 멈춰 있어 twStep(dt)을 직접 pump한다.
  await step('마을: 월드 카메라 + 캐릭터 중앙 고정', ()=>{ skipIf(typeof openTown!=='function','마을 없음');
    openTown();
    const map=$('twMap'), w=$('twWorld'); assert(w,'#twWorld 없음');
    const mr=map.getBoundingClientRect();
    assert(Math.abs(parseFloat(w.style.width)-mr.width*TW_WORLD_W_MUL)<2,'월드 폭이 화면×'+TW_WORLD_W_MUL+'가 아님: '+w.style.width);
    assert(parseFloat(w.style.width)>parseFloat(w.style.height),'가로로 긴 월드가 아님');
    assert(w.querySelectorAll('.twZone').length===Object.keys(TOWN_ZONES).length,'구역 아이콘 수 불일치');
    const shown=Object.keys(TOWN_ZONES).filter(id=>!_twEdgeEl[id].classList.contains('hide'));
    assert(['plaza','charmake','charsel'].every(id=>shown.indexOf(id)<0),'화면 안에 보이는 구역인데 가장자리 표시가 뜸: '+shown.join(','));
    assert(['gacha','gate','gear','gym'].every(id=>shown.indexOf(id)>=0),'화면 밖 모서리 구역의 가장자리 표시가 없음: '+shown.join(','));
    const t0=w.style.transform, g=twZonePx('gacha'); twSetTarget(g[0],g[1]);
    for(let i=0;i<60;i++) twStep(0.016);
    assert(w.style.transform!==t0,'월드(배경)가 안 움직임');
    const av=$('twAvatar').getBoundingClientRect();
    const dx=Math.abs((av.left+av.width/2)-(mr.left+mr.width/2)), dy=Math.abs((av.top+av.height/2)-(mr.top+mr.height/2));
    assert(dx<3&&dy<3,'아바타가 화면 중앙에서 벗어남: '+dx.toFixed(1)+','+dy.toFixed(1));
    assert($('twAvatar').classList.contains('walk'),'이동 중인데 걷기 모션 클래스 없음');
    return '월드 '+w.style.width+'×'+w.style.height; });
  await step('마을: 멀리서 구역을 지정하면 걸어가서 열림', ()=>{ skipIf(typeof openTown!=='function','마을 없음');
    closeTownPanel();
    townGo('gacha');   // 화면 밖 구역 지정 — 아이콘/가장자리 표시 탭과 같은 경로
    assert(_twGoZone==='gacha','구역 지정이 안 됨');
    let n=0; while(_twChar.mode!==null && n<4000){ twStep(0.016); n++; }
    assert(n<4000,'목적지에 도착하지 못함');
    assert(visible($('townPanel')),'지정한 구역에 도착했는데 시설 팝업이 안 열림');
    assert($('tpTitle').textContent.indexOf('뽑기집')>=0,'팝업 제목 불일치: '+$('tpTitle').textContent);
    twLeave(); return n+'프레임 이동'; });
  await step('마을: 지정하지 않으면 안 열림(스쳐 지남·겹쳐 섬)', ()=>{ skipIf(typeof twSetTarget!=='function','마을 없음');
    openTown(); closeTownPanel();
    const c=twZonePx('charmake');
    _twChar.x=c[0]+220; _twChar.y=c[1];                    // ① 생성소 정중앙을 관통해 지나가기
    twSetTarget(c[0]-220, c[1]);
    let through=false, n=0;
    while(_twChar.mode!==null && n<4000){ twStep(0.016); n++;
      if(Math.hypot(c[0]-_twChar.x,c[1]-_twChar.y)<=TW_ZONE_R) through=true;
      assert(!visible($('townPanel')),'지나가는 중에 팝업이 열림'); }
    assert(through,'경로가 생성소 반경을 통과하지 않음 — 테스트가 무의미');
    twSetTarget(c[0], c[1]);                               // ② 땅을 눌러 구역 위에 정확히 겹쳐 서기
    n=0; while(_twChar.mode!==null && n<4000){ twStep(0.016); n++; }
    for(let i=0;i<30;i++) twStep(0.016);                   // 멈춘 뒤에도 계속 안 열려야 한다
    assert(!visible($('townPanel')),'구역 위에 겹쳐 섰다고 팝업이 열림');
    townGo('charmake');                                    // ③ 그 자리에서 구역을 누르면 열린다
    assert(visible($('townPanel')) && _twZone==='charmake','겹쳐 선 채로 구역을 눌렀는데 안 열림');
    closeTownPanel(); twLeave(); return '통과·겹침=무반응 / 지정=열림'; });
  await step('캐릭터 UI 단일 소스: 입장 화면 = 마을 구역', ()=>{ skipIf(typeof renderCharSelect!=='function','캐릭터 시스템 없음');
    assert(TOWN_ZONES.charsel.render()===renderCharSelect(),'보관소 구역이 입장 화면과 다른 마크업을 그림(복제 의심)');
    assert(TOWN_ZONES.charmake.render()===renderCharCreate(),'생성소 구역이 입장 화면과 다른 마크업을 그림(복제 의심)');
    return '동일'; });
  await step('캐릭터: 성장은 따로 · 재화와 펫은 공용', ()=>{ skipIf(typeof profCreateChar!=='function','캐릭터 시스템 없음');
    const p=PROF(); p.pcoin=1000; p.pets={wolf:{count:1}}; p.equip=['wolf'];
    const a=CHAR(); a.statPoints=3; assert(profAllocStat('pow'),'스탯 분배 실패');
    const powA=profStat('pow'), spA=a.statPoints;
    const b=profCreateChar('scout','둘째'); assert(b,'두 번째 캐릭터 생성 실패');
    assert(CHAR().id===b.id,'새로 만든 캐릭터가 선택되지 않음');
    assert(PROF().pcoin===1000,'재화가 캐릭터를 따라감(공용이어야 함): '+PROF().pcoin);
    assert(PROF().equip.length===1,'펫 장착이 캐릭터를 따라감(공용이어야 함)');
    assert(b.statPoints===0 && b.level===1,'새 캐릭터가 성장을 물려받음');
    assert(profSelectChar(a.id),'되돌아가기 실패');
    assert(a.statPoints===spA && profStat('pow')===powA,'되돌아온 캐릭터의 성장이 바뀜');
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
  await step('네비바: 설정은 항상 오른쪽 끝', ()=>{ skipIf(typeof strikeSetTabOrder!=='function','strikeSetTabOrder 없음');
    const par=$('tabs'), set=$('settingsBtn'); skipIf(!par||!set,'네비바 없음');
    const last=()=>par.lastElementChild===set;
    strikeSetTabOrder(['Main','Build','Upgrade','Players']);   // 직스 진입 시 순서
    assert(last(),'직스 순서 적용 후 설정이 끝이 아님');
    strikeSetTabOrder(null);                                   // 네모 복귀(resetGameChrome 경로)
    assert(last(),'원복 후 설정이 끝이 아님');
    return '위치 ok'; });
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
