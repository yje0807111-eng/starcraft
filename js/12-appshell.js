/* ============================================================================
 * 12-appshell.js — 앱 셸 — 인증 · 유즈맵 선택 · 모드 선택 · BGM/SFX
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ===================== 앱 셸: 인증 / 유즈맵 / 모드 선택 =====================
// ── 인증(Supabase 연동 + 로컬 계정 폴백) ──
const SUPABASE_CONFIG = {  // ★ Supabase 프로젝트의 URL + anon key를 채우면 실제 인증으로 전환됩니다(없으면 로컬 계정 모드).
  url: 'https://hsfobclnrqnbwslzczpb.supabase.co',   // 베이스 URL(/rest/v1 제외) — supabase-js가 경로를 붙임
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzZm9iY2xucnFuYndzbHpjenBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjY0MjgsImV4cCI6MjA5NjMwMjQyOH0.oqJuTufhRxwdQzfSxFLMKUxuDH2nTg82UKjyCi_MiuM'
};
const AUTH = { mode:'local', user:null };
let _sb=null;
function _lsGet(k,d){ try{ const v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch(e){ return d; } }
function _lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function sbUser(u){ const meta=u.user_metadata||{};
  const nick = meta.nick || (u.email ? u.email.split('@')[0] : ('게스트'+String(u.id||'').replace(/-/g,'').slice(0,4)));
  // 익명 = 게스트다. 여기 한 곳에서 정하므로 세션 복원(새로고침) 뒤에도 게스트 판정이 유지된다.
  return { email:u.email||null, nick, uid:u.id, anon:!!u.is_anonymous, guest:!!u.is_anonymous }; }
async function initAuth(){
  if(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey){
    try{
      // ⚠ 정확한 버전으로 고정한다 — '@2' 로 두면 esm.sh 가 내보내는 최신 2.x 로 어느 날 조용히 바뀐다
      //   (three.js 는 three@0.160.0 으로 이미 고정돼 있는데 이것만 안 돼 있었다).
      //   ⚠ esm.sh 는 단일 장애점이다 — 여기가 막히면 인증·방·소셜이 통째로 죽는다(게임 자체는 로컬이라 돌아간다).
      //   ⚠ realtime-js 2.112.x 에는 **클라이언트 쪽 전송 제한이 없다**(eventsPerSecond·throttle 모두 없음).
      //      한도는 Supabase 프로젝트의 서버 쿼터뿐이라, 많이 쏘면 클라이언트가 막아 주는 게 아니라 서버가 끊는다.
      //      그래서 송신 빈도는 우리가 직접 줄인다 — ARCHITECTURE §8 「대역폭 규칙」.
      const m=await import('https://esm.sh/@supabase/supabase-js@2.112.3');
      _sb=m.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey); AUTH.mode='supabase';
      const { data }=await _sb.auth.getSession();   // 자동 로그인: 저장된 세션 복원(같은 기기 재실행 — 정식 계정만)
      // ⚠ 기다리는 동안 사용자가 게스트로 들어갔을 수 있다 — 세션이 없을 때 null 로 덮으면 방금 들어온 사람이 팅긴다.
      const u=data&&data.session&&data.session.user;
      if(u) AUTH.user=sbUser(u);   // 세션이 없으면 현재 값을 그대로 둔다
      if(AUTH.user){ await sbEnsureProfile(); await sbSyncMetaOnLogin(); }   // 프로필 보정 + 계정 메타(포인트) 로드
      _sb.auth.onAuthStateChange((_e,sess)=>{
        if(sess&&sess.user){ AUTH.user=sbUser(sess.user); sbEnsureProfile(); return; }
        if(AUTH.user&&AUTH.user.local) return;   // ⚠ '로컬' 게스트만 보호한다. 익명 게스트는 진짜 세션이 있어 이 이벤트를 받아야 한다
        AUTH.user=null; });
      return;
    }catch(e){ console.warn('Supabase 초기화 실패 → 로컬 계정 모드', e); AUTH.mode='local'; }
  }
  if(!AUTH.user) AUTH.user = _lsGet('nm_session', null);   // 로컬 모드: 저장된 세션 자동 복원(이미 들어왔으면 그대로)
}
const ID_DOMAIN='nemonemo.app';   // 아이디를 Supabase 이메일 인증으로 처리하기 위한 합성 도메인(실제 메일 아님)
// 이미 진짜 이메일이면 그대로 쓴다 — 이메일로 가입한 계정만 재설정 메일을 받을 수 있다.
function idToEmail(id){ const v=String(id).trim();
  if(v.indexOf('@')>=0) return v.toLowerCase();
  return v.toLowerCase().replace(/[^a-z0-9._-]/g,'') + '@' + ID_DOMAIN; }
async function authSignUp(id,pw,nick){ nick=(nick||id);   // 닉네임=게임 내 표시명(아이디는 로그인 전용)
  if(AUTH.mode==='supabase'){ const {data,error}=await _sb.auth.signUp({email:idToEmail(id),password:pw,options:{data:{nick}}});
    if(error) throw new Error(/registered|already|exists/i.test(error.message||'')?'이미 사용 중인 아이디입니다.':(error.message||'회원가입에 실패했습니다.'));
    if(data.session){ AUTH.user=sbUser(data.session.user); await sbEnsureProfile(); await sbSyncMetaOnLogin(); return; }   // 즉시 로그인(이메일 확인 off 필요)
    throw new Error('가입은 됐지만 즉시 로그인이 안 됩니다 (대시보드에서 이메일 확인 OFF 필요).'); }
  const users=_lsGet('nm_users',{}); if(users[id]) throw new Error('이미 사용 중인 아이디입니다.');
  users[id]={pw, nick}; _lsSet('nm_users',users); AUTH.user={id, nick}; _lsSet('nm_session',AUTH.user); }
async function authSignIn(id,pw){
  if(AUTH.mode==='supabase'){ const {data,error}=await _sb.auth.signInWithPassword({email:idToEmail(id),password:pw});
    if(error) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.'); AUTH.user=sbUser(data.user); await sbEnsureProfile(); await sbSyncMetaOnLogin(); return; }
  const users=_lsGet('nm_users',{}); const u=users[id];
  if(!u || u.pw!==pw) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
  AUTH.user={id, nick:u.nick}; _lsSet('nm_session',AUTH.user); }
async function authSignOut(){ if(AUTH.mode==='supabase'){ try{ await _sb.auth.signOut(); }catch(e){} }
  AUTH.user=null; try{ localStorage.removeItem('nm_session'); }catch(e){} }
// 내 표시 닉네임(로그인/게스트). 미로그인 시 '나'로 폴백.
function myNick(){ return (AUTH && AUTH.user && AUTH.user.nick) || '나'; }
// 플레이어 번호 → 표시 닉네임(내 번호=내 닉, 나머지=게임 시작 시 배정된 이름)
function playerName(n){ if(typeof G!=='undefined' && n===(G.myPlayer||1)) return myNick();
  return (typeof G!=='undefined' && G.playerNames && G.playerNames[n]) || ('P'+n); }
// ── 전환/팝업 FX ──
// 화면 전환: HUD 스캔 와이프 + 홀로그램 디졸브
// 화면 전환 = 즉시. 디졸브·스캔 와이프는 걷어냈다(요청) — 전환마다 화면이 흐려지고 붉은 선이 지나가던 것.
function playScreenFx(){ }
// 팝업/모달 등장: 홀로그램 파워온 + 테두리 점화
function fxPop(card){ if(!card) return; card.classList.remove('fxPop'); void card.offsetWidth; card.classList.add('fxPop');
  clearTimeout(card._fxT); card._fxT=setTimeout(()=>card.classList.remove('fxPop'),200); }
// ── 앱 화면 전환 ──
const APP_SCREENS=['opening','auth','mapSelect','modeSheet','homeScreen','townScreen','dgScreen','shopScreen','gearScreen','upgScreen','researchScreen','questScreen'];   // ⚠ 여기 없는 화면은 showAppScreen 이 영영 안 켠다
// 💠 공용 재화 바를 띄우는 화면(RPG/허브 + 유즈맵 선택). 로그인·타이틀·캐릭터생성·인게임은 제외.
// 화면 제목은 재화 바 왼쪽에 붙는다(유즈맵과 같은 방식) — 화면 안에 가운데 제목을 또 두지 않는다.
// 여기 한 곳에서만 정한다. 화면마다 curSetTitle을 부르면 새 화면에서 빠뜨린다.
const SCREEN_TITLE={ upgScreen:'캐릭터', gearScreen:'정비', shopScreen:'상점' };
const CUR_SCREENS=['homeScreen','townScreen','mapSelect','modeSheet','dgScreen','shopScreen','gearScreen','upgScreen','researchScreen','questScreen'];   // 이 화면들은 공용 재화 바를 쓴다
// 그중 바를 '판'이 아니라 배경 위 숫자로 두는 화면(.curBar.bare) — 배경이 상단까지 이어져 보여야 하는 곳
const BARE_CUR_SCREENS=['homeScreen','townScreen','mapSelect','shopScreen','gearScreen','upgScreen','researchScreen','questScreen'];   // 재화 바를 '판'이 아니라 배경 위 숫자로 — 상단 줄이 겹쳐 답답해진다(구분선 없이 배경이 이어진다)
function curSetTitle(t){ const e=document.getElementById('curTitle'); if(!e) return;
  e.classList.remove('asChip'); e.textContent=t||''; }   // 재화 바 왼쪽 제목(화면별) — 칩(asChip)이 붙어 있었다면 걷고 글자로 되돌린다
// 🏕 캠프 좌상단 던전 칩 — 재화 바 왼쪽 빈 슬롯(#curTitle)에 얹힌다(목업 docs/mock/camp-dungeon-onechip-8.html 7안).
//   ⛔ 캠프 파일(19-camp.js)은 다른 작업자 영역이라 손대지 않는다 — 여기서 상태를 **읽기만** 한다.
//   ⭐ 무엇을 보여줄지는 이 함수 하나가 정한다(단일 소스). 캠프에 라운드가 생기면 여기 한 곳만 고친다.
//   ⚠ 지금 캠프 상태(p.camp)에는 **라운드 칸이 없다** — 있는 것은 던전(dg 1~10)뿐이다.
//      그래서 둘째 줄은 「던전 3/10」이다. C.rnd 가 생기는 순간 자동으로 「라운드 n/99」로 바뀐다.
function campChipInfo(){
  if(typeof campIsOn!=='function' || !campIsOn()) return null;
  const C=(typeof campState==='function')?campState():null; if(!C) return null;
  const dg=Math.max(1, Math.min(CAMP_CHIP_DG_MAX, C.dg||1));
  const d=(typeof hbDun==='function')?hbDun(dg):null;
  const hasRnd=(typeof C.rnd==='number');
  return { name:(d&&d.name)||('던전 '+dg),
           lab: hasRnd?'라운드':'던전',
           cur: hasRnd?C.rnd:dg,
           max: hasRnd?CAMP_CHIP_RND_MAX:CAMP_CHIP_DG_MAX }; }
const CAMP_CHIP_DG_MAX=10;      // 던전 1~10 (HB_DUNGEONS 길이와 같다)
const CAMP_CHIP_RND_MAX=99;     // 던전 하나 = 99라운드 (라운드가 생겼을 때만 쓰인다)
// 칩 마크업 — 왼쪽 광원 띠 + 두 줄(이름 / 라벨·숫자·진행 막대)
function curChipHTML(o){
  const pct=Math.max(0, Math.min(100, (o.cur/o.max)*100));
  return '<i class="cdRail"></i><span class="cdBody">'
    +'<span class="cdNm">'+escHtml(o.name)+'</span>'
    +'<span class="cdSub"><i class="cdLab">'+escHtml(o.lab)+'</i>'
    +'<b class="cdN">'+o.cur+'</b><i class="cdDim">/'+o.max+'</i>'
    +'<span class="cdBar"><i style="width:'+pct.toFixed(1)+'%"></i></span></span></span>'; }
// 칩을 그리거나 걷는다. updateCurBar() 가 부른다 — 캠프가 수입마다 그걸 부르므로 따로 타이머를 두지 않는다.
function curPaintChip(){ const e=document.getElementById('curTitle'); if(!e) return;
  const o=campChipInfo();
  if(!o){ if(e.classList.contains('asChip')){ e.classList.remove('asChip'); e.textContent=''; } return; }
  e.classList.add('asChip'); e.innerHTML=curChipHTML(o); }
function curShow(on){ const b=document.getElementById('curBar'), p=document.getElementById('phone');
  if(b) b.classList.toggle('hide', !on); if(p) p.classList.toggle('curOn', !!on); }
// 💠 재화 표기 — 던전 보상 배수가 24^(dg-1)라 상위 던전에서는 자릿수가 폭주한다.
//   그대로 두면 우측 정렬된 숫자가 왼쪽으로 자라 좌상단 프로필을 덮는다(실제로 겹쳤다).
//   10만부터 축약한다 — 5자리까지는 콤마 표기를 그대로 둬야 초반 수치를 정확히 읽을 수 있고,
//   6자리부터 줄여야 좌상단 프로필(≈138px)과 부딪히지 않는다(실측: '646,228' 3개면 3px 겹쳤다).
// ⚠ 던전·라운드 곡선이 지수라 재화가 아주 커진다(던전 3 = 1e12 돌파 · 던전 10 = 1e56 대).
//    옛 표(K/M/B/T)는 T에서 끊겨 그 위가 통째로 원시 숫자로 쏟아졌다 → 3자리 단위로 이어 붙인다.
// ⭐ 이름은 'Cur'지만 **모든 큰 수의 단일 표기기**다(2026-08-19) — 재화뿐 아니라 공격력·체력·전투력·
//    피해 숫자·업그레이드 비용이 전부 이걸 지난다. 환생 포인트가 복리라 전투 수치도 1e20 을 넘는다.
//    ⛔ 축약기를 새로 만들지 말 것 — 두 벌이 되면 화면마다 표기가 갈린다.
const CUR_ABBR=1e5;
const CUR_SUF=['','K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc',
               'UD','DD','TD','QaD','QiD','SxD','SpD','OcD','NoD','Vg'];
function fmtCur(n){ n=Math.floor(n||0);
  if(!isFinite(n)) return '∞';
  if(n<CUR_ABBR) return n.toLocaleString('en-US');
  const t=Math.floor(Math.log10(n)/3);
  if(t>=CUR_SUF.length) return n.toExponential(2);      // 표를 넘어서면 지수 표기(자릿수는 계속 읽힌다)
  let t2=t, x=n/Math.pow(10,t2*3);
  if(x>=999.5 && t2+1<CUR_SUF.length){ t2++; x=n/Math.pow(10,t2*3); }   // 999,999 가 "1000K"로 새던 경계
  return x.toFixed(1)+CUR_SUF[t2]; }   // ⭐ 소수 한 자리 고정 — 자릿수가 들쭉날쭉하면 표에서 줄이 흔들린다
function updateCurBar(){ if(!PLAYER_META||!PLAYER_META.profile) return;
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  // 🏕 캠프에서는 **캠프 재화**를 보여 준다 — 관리자 재화 줄(.bres)을 숨겼으므로 이 줄이 유일한 표시다.
  //    ⛔ 줄을 두 개 두지 않는다(어느 쪽이 진짜인지 알 수 없어진다).
  const _camp = (typeof campIsOn==='function' && campIsOn() && typeof G!=='undefined' && G.tech) ? G.tech : null;
  set('curMin', fmtCur(_camp ? (_camp.credit||0) : profMineral()));
  set('curGas', fmtCur(_camp ? (_camp.energy||0) : profGas()));
  if(_camp) set('curPop', (_camp.sup||0) + '/' + (_camp.supCap||0));   // 🏕 인구 — 캠프에서만 보인다
  set('curGem', fmtCur(profGem()));
  curPaintChip(); }   // 🏕 좌상단 던전 칩도 같은 박자로 갱신된다(캠프가 수입마다 이 함수를 부른다)
// 🎬 화면 전환 크로스페이드 (2026-08-23)
// ⚠ `.appScreen.hide` 는 `display:none` 이다. 나가는 화면에 .hide 를 바로 걸면 전환이 뚝 끊긴다 —
//   var(--t-screen) 동안 남겨 두고 겹쳐 넘긴다.
// ⛔ **위에 덮이는 화면 하나만** 페이드한다. 둘 다 페이드하면 양쪽이 반투명인 순간이 생겨
//    그 아래 게임 판(유즈맵 배경)이 잠깐 비친다 — 실제로 그랬다(2026-08-23).
//    #opening 은 z-90 으로 항상 다른 화면 위다. 아래 화면은 즉시 불투명하게 세워 두면 틈이 없다.
// ⛔ 여기 목록은 **전환을 마친 화면만** 넣는다(DESIGN.md §4 touch-it-fix-it). 전 화면 일괄 적용 금지.
const FADE_SCREENS=['opening'];
// 🖼 타이틀 키 아트(--titleArt)를 배경으로 쓰는 화면. **페이드 목록과 다른 표다** —
//    페이드는 위에 덮이는 것만, 위상 이어받기는 그림을 쓰는 화면 전부가 필요하다.
const ART_SCREENS=['opening','auth'];
function _cssMs(name, def){ const v=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)); return ((v||def)*1000); }
function _fadeMs(){ return _cssMs('--t-screen', .42); }
// 아래 화면을 붙잡아 두는 시간 — 로그인 속 내용이 흐려지는 데 더 걸리므로 **긴 쪽**에 맞춘다.
// 짧은 쪽에 맞추면 버튼이 사라지는 도중에 화면이 통째로 감춰져 뚝 끊긴다.
function _holdMs(){ return Math.max(_fadeMs(), _cssMs('--t-auth', .95)); }
// 🔡 로그인 속 내용(버튼·폼) 여닫기 — 화면 자체와 따로 논다.
// ⚠ 한 프레임 뒤에 켜야 한다: 화면이 display:none 에서 막 나온 참이라 같은 프레임에 켜면 전이가 안 돈다.
function authContentShow(on){ const a=document.getElementById('auth'); if(!a) return;
  if(on){ a.classList.remove('inView'); void a.offsetWidth;   // 투명 상태를 확정시킨 뒤에 켜야 전이가 돈다
    requestAnimationFrame(function(){ a.classList.add('inView'); }); }
  else a.classList.remove('inView'); }
function screenFadeIn(el){ if(!el) return;
  clearTimeout(el._fadeT); el.classList.remove('fxOut','hide');
  el.classList.remove('fxIn'); void el.offsetWidth; el.classList.add('fxIn'); }   // 같은 화면을 다시 열 때도 처음부터
// 🫱 아래 화면 붙잡기 — 위에서 로딩이 **떠오르는 동안** 자리를 지킨다.
// ⚠ 여기가 없으면 아래 화면이 즉시 사라지고 위는 아직 투명해서, 그 틈으로 바탕이 드러난다.
//    디졸브의 핵심은 "겹쳐 있는 구간"이지 양쪽을 같이 흐리는 게 아니다.
function screenHold(el){ if(!el || el.classList.contains('hide')) return;
  clearTimeout(el._fadeT);
  el._fadeT=setTimeout(function(){ el.classList.add('hide'); }, _holdMs()); }
function screenFadeOut(el){ if(!el || el.classList.contains('hide')) return;
  // 워프(게임 진입)·카운트다운은 자기 연출이 따로 있다 — 페이드를 겹치지 않는다
  if(el.classList.contains('warp')||el.classList.contains('counting')){ el.classList.add('hide'); return; }
  clearTimeout(el._fadeT); el.classList.remove('fxIn'); el.classList.add('fxOut');
  el._fadeT=setTimeout(function(){ el.classList.add('hide'); el.classList.remove('fxOut'); }, _fadeMs()); }
// 🖼 공유 키 아트 층(#titleBg) 켜기/끄기.
// 그림은 화면마다 그리지 않는다 — **한 장을 깔아 두고 끄지 않는다.** 화면이 바뀌어도 그 요소가
// 그대로라 호흡 애니가 리셋되지 않는다(예전엔 전환마다 0% 로 되돌아가 그림이 툭 튀었다).
// ⚠ display 로 껐다 켜면 애니가 다시 시작한다 — opacity 로만 여닫는다(CSS #titleBg).
// 층은 셋이다 — 그림(#titleBg) · 로고(#titleMark) · 검은 판(#titleBlack).
// 평소엔 그림+로고가 같이 켜지지만, 게임으로 들어갈 때는 **그림만 먼저 걷고 로고를 남긴다.**
function titleArtShow(on){ const ph=document.getElementById('phone'); if(!ph) return;
  ph.classList.toggle('artBg', !!on); ph.classList.toggle('artMark', !!on);
  if(!on) ph.classList.remove('artBlack'); }
const _sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TITLE_BLACK_HOLD=380;   // 검은 화면에서 머무는 시간(ms)
// 🎬 게임으로 들어가는 마무리 ①: 그림과 막대를 걷어 **로고만 남은 검은 화면**으로.
async function titleToBlack(){
  const ph=document.getElementById('phone'); if(!ph) return;
  ph.classList.add('artBlack');          // 검은 판이 떠오르는 동안
  ph.classList.remove('artBg');          // 그림은 걷힌다 — 둘이 같은 시간이라 자연스레 검게 바뀐다
  const op=document.getElementById('opening'); if(op) screenFadeOut(op);   // 막대도 함께
  await _sleep(_fadeMs()+TITLE_BLACK_HOLD);
}
// 🎬 마무리 ②: 게임 화면이 뒤에 선 뒤에 부른다 — 검은 판과 로고가 **함께** 사라지며 화면이 드러난다.
function titleOutroEnd(){ const ph=document.getElementById('phone'); if(!ph) return;
  ph.classList.remove('artBlack','artMark'); }
function showAppScreen(id){ setInGame(false);
  if(typeof navShow==='function') navShow(null);   // 하단 네비는 기본 숨김 — openHome/openTown이 다시 켠다
  if(typeof hbStop==='function') hbStop();         // 홈 배경 전투도 기본 정지 — openHome이 다시 켠다
  // 🏕 캠프도 같은 규칙 — 화면을 옮기면 저장하고 걷는다(openHome 이 다시 켠다).
  //    ⚠ 안 걷으면 G.tab='Build' 가 남아 유즈맵·마을이 건설 맵을 계속 그린다.
  //    campExit 은 캠프가 켜져 있을 때만 동작한다(관리자 탭·오토배틀 판을 덮어쓰지 않게).
  if(typeof campExit==='function') campExit();
  // ⚠ 마을은 '반납'만으로 부족하다 — twTick이 살아 있으면 매 프레임 캔버스를 다시 빌려 간다.
  // 루프를 세운 뒤에 반납해야 실제로 돌아온다. 단 마을로 들어가는 중이면 끄면 안 된다
  // (openTown이 _townOpen을 켜고 나서 이 함수를 부른다 — 끄면 마을 3D가 안 뜬다).
  if(id!=='townScreen' && typeof _townOpen!=='undefined' && _townOpen && typeof twLeave==='function') twLeave();
  if(typeof tw3dDetach==='function') tw3dDetach();
  for(const id of ['hbRoundSheet','hbBoostModal','hbGrowModal','hbInfoModal','hbDailySheet','hbAttSheet']){ const el=document.getElementById(id); if(el) el.classList.add('hide'); }
  // 소셜 팝업(#phone 에 붙어 z-index 110)은 화면을 바꿔도 남아 화면을 덮는다 — 여기서 함께 접는다
  for(const id of ['ptFindOv','foAddOv','ptInviteOv','foCtxOv']){ const el=document.getElementById(id); if(el) el.classList.add('hide'); }
  if(id!=='mapSelect' && id!=='modeSheet' && typeof stopMapLive==='function') stopMapLive();   // 유즈맵 화면 떠나면 실시간 갱신 정지
  ['ov','lobby','rooms','createPanel','pwPanel'].forEach(x=>{const e=document.getElementById(x); if(e)e.classList.add('hide');});
  titleArtShow(ART_SCREENS.indexOf(id)>=0);   // 키 아트를 쓰는 화면에서만 공유 배경을 켠다
  const overlayIn=FADE_SCREENS.indexOf(id)>=0;   // 들어오는 것이 '위에 덮이는' 화면인가
  APP_SCREENS.forEach(s=>{ const e=document.getElementById(s); if(!e) return;
    const fade=FADE_SCREENS.indexOf(s)>=0;
    // ⚠ 켜는 화면은 **먼저 예약된 감추기를 취소**한다 — 로딩으로 갔다가 금방 돌아오면
    //    앞서 걸린 붙잡기 타이머가 뒤늦게 터져 방금 켠 화면을 도로 숨긴다(실제로 그랬다).
    if(s===id){ clearTimeout(e._fadeT); e._fadeT=null;
      if(fade) screenFadeIn(e); else e.classList.remove('hide'); }
    else if(fade) screenFadeOut(e);        // 위에 있던 로딩 → 흐려지며 걷힌다
    else if(overlayIn) screenHold(e);      // 로딩이 떠오르는 중 → 아래는 그대로 버틴다(틈 없음)
    else e.classList.add('hide'); });
  authContentShow(id==='auth');   // ⚠ 화면을 **켠 뒤에** 부른다 — display:none 상태에서 걸면 전이가 안 돈다
  const _cur=CUR_SCREENS.indexOf(id)>=0; curShow(_cur); curSetTitle(SCREEN_TITLE[id]||''); if(_cur) updateCurBar();   // 💠 공용 재화 바
  { const cb=document.getElementById('curBar');                                    // HOME만 배경 위 숫자(.bare) — 다른 화면은 판 그대로
    if(cb) cb.classList.toggle('bare', BARE_CUR_SCREENS.indexOf(id)>=0); }
  const tgt=document.getElementById(id); if(tgt && id!=='opening') playScreenFx(tgt); }   // 전환 FX(부팅 로딩 제외)
function hideAppScreens(){ if(typeof stopMapLive==='function') stopMapLive(); curShow(false);
  // 🏕 캠프도 같은 이유로 여기서 걷는다 — 캠프는 공용 3D 캔버스(#cvMarine)를 HOME 안으로 **빌려 간다.**
  //    안 돌려주면 던전·유즈맵이 그걸 자기 자리로 되돌릴 때 엉뚱한 부모(#homeScreen)를 원위치로 삼는다
  //    (스모크 「던전: 빌려 쓴 공용 3D 캔버스를 반드시 돌려놓는다」가 이걸 잡는다).
  if(typeof campExit==='function') campExit();
  if(typeof hbStop==='function') hbStop();   // ⚠ 게임 진입 경로 — 여기서 안 멈추면 공용 3D 캔버스(#cvMarine)가 HOME에 남아 유즈맵 3D가 사라진다
  // ⚠ 마을은 '반납'만으로 부족하다 — twTick이 살아 있으면 매 프레임 캔버스를 다시 빌려 간다.
  // 루프를 세운 뒤에 반납해야 실제로 돌아온다(안 그러면 마을→유즈맵에서 3D가 통째로 사라진다).
  if(typeof _townOpen!=='undefined' && _townOpen && typeof twLeave==='function') twLeave();
  if(typeof tw3dDetach==='function') tw3dDetach();
  APP_SCREENS.forEach(s=>{ const e=document.getElementById(s); if(e) e.classList.add('hide'); }); }
// ── 유즈맵 크롬 초기화(단일 소스) ──────────────────────────────────────────────
// 맵마다 자기 화면만 켜다 보면 이전 맵의 잔재가 다음 맵에 그대로 남는다(관리자 탭·직스 패널·숨겨진 안내 등).
// 게임 진입(startGameNow)과 로비 복귀 경로가 전부 이 함수 하나를 거쳐 nemo 기본 크롬으로 되돌린다. 새 맵을 추가할 때도 여기만 보면 된다.
const _CHROME_SHOW=['shopProfile','prodHint','gachaActions','opsManual'];   // 맵별 코드가 '숨기기만' 하는 것들 → 기본은 보임
const _CHROME_ADMIN=['battleTab','buildTab'];                                         // 관리자 샌드박스 전용 탭 → 기본은 숨김
function resetGameChrome(){
  if(typeof strikeSetTabLabels==='function' && typeof STK_NEMOLABEL!=='undefined'){ strikeSetTabLabels(STK_NEMOLABEL); strikeSetTabOrder(null); }   // 탭 라벨·순서 원복
  if(typeof strikeHideNemoChrome==='function') strikeHideNemoChrome(false);   // 직스 크롬 해제(nemo HUD 복귀)
  if(typeof fxLabDeactivate==='function') fxLabDeactivate();                  // 관리자 이펙트 랩 해제
  _CHROME_SHOW.forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display=''; });
  _CHROME_ADMIN.forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });
  { const sl=document.getElementById('specLabel'); if(sl) sl.innerHTML=''; }         // 직스 리더보드(#stLead) 잔존 제거
  { const si=document.getElementById('stSelInfo'); if(si){ si.classList.add('hide'); si.innerHTML=''; } }
  { const r=document.getElementById('stResult'); if(r){ try{ r.remove(); }catch(_){ } } }
}
// 게임 진입/종료 시 잠깐 노출되는 로딩 화면(#opening 재사용). display 토글로 로딩바 애니 재생됨.
// ⏳ 로딩 막대 단일 소스 — **항상 100%까지 찬 뒤 0.2초 있다가 넘어간다**(2026-08-19).
//   ⚠ 예전엔 막대(CSS `opLoad 1.6s`)와 화면 전환(showLoading 의 1.1~1.3초 타이머)이 **따로 돌았다**.
//     타이머가 먼저 끝나 막대가 80% 쯤에서 잘린 채 넘어갔다 — 두 개를 한 곳으로 묶는다.
//     전환은 반드시 opBarDone() 의 약속을 기다릴 것. 새 타이머를 따로 두지 말 것.
const LOAD_HOLD=200;   // 100% 를 보여 주는 시간(ms) — 0 이면 다 찼는지 모르고 튕겨 들어간다
const LOAD_FILL=700;   // 막대가 0→100% 로 차는 기본 시간. 실제 로딩이 더 빨라도 이만큼은 보여 준다
const BOOT_AUTH_P=0.35; // 부팅 막대에서 '인증까지' 가 차지하는 구간 — 나머지 0.35~1 은 데우기가 채운다
// (구 LOAD_SNAP 폐지 2026-08-20 — 마지막 칸을 CSS 전환으로 채우다가 프레임이 없으면 0 에 멈췄다. 이제 즉시 채운다)
let _opBar=null;
function _opBarEls(){ const op=document.getElementById('opening');
  return op ? { op:op, bar:op.querySelector('.opBar'), tx:op.querySelector('.opLoading') } : null; }
// 막대를 0 에서 다시 시작한다. dur = 시간만으로 차는 데 걸리는 시간(실제 진행률이 앞서면 그쪽을 따른다)
function opBarStart(dur){ const e=_opBarEls(); if(!e) return null;
  opBarReset();
  const st={ t0:performance.now(), dur:Math.max(200, dur||LOAD_FILL), real:0, raf:0, dead:false, bar:e.bar, tx:e.tx };
  if(st.bar){ st.bar.style.animation='none'; st.bar.style.transition='none'; st.bar.style.width='0%'; }
  const step=()=>{ if(st.dead) return;
    const byTime=Math.min(1,(performance.now()-st.t0)/st.dur);
    const p=Math.max(byTime*0.985, st.real);   // 시간·실제 중 앞선 쪽 · 0.985 = 마지막 칸은 opBarDone 이 채운다
    if(st.bar) st.bar.style.width=(p*100).toFixed(1)+'%';
    if(st.tx) st.tx.innerHTML=Math.round(p*100)+'<s>%</s>';   // .opLoading = 큰 숫자(라벨 LOADING 은 마크업이 갖는다)
    st.raf=requestAnimationFrame(step); };
  step(); _opBar=st; return st; }
function opBarReal(p){ if(_opBar) _opBar.real=Math.max(0,Math.min(1,p||0)); }   // 실제 진행률(모델 로드 등)
// 100% 를 채우고 LOAD_HOLD 만큼 보여 준 뒤 resolve. 아직 최소 시간이 안 됐으면 그만큼 더 기다린다.
function opBarDone(){ const st=_opBar;
  return new Promise(res=>{
    if(!st){ setTimeout(res, LOAD_HOLD); return; }
    const wait=Math.max(0, st.dur-(performance.now()-st.t0));
    setTimeout(()=>{ st.dead=true; cancelAnimationFrame(st.raf);
      // ⚠ 마지막 100% 는 **전환 없이 즉시** 채운다(2026-08-20).
      //    CSS 전환은 프레임이 있어야 진행된다 — 탭이 가려지면 rAF 도 전환도 멈춰서
      //    막대가 0 에 남은 채 화면만 넘어갔다(실측: 인라인 width:100% 인데 계산값 0px).
      //    rAF 가 도는 평상시엔 이미 98.5% 까지 차 있어 눈에 띄는 점프가 없다.
      if(st.bar){ st.bar.style.transition='none'; st.bar.style.width='100%'; }
      if(st.tx) st.tx.innerHTML='100<s>%</s>';
      setTimeout(res, LOAD_HOLD); }, wait); }); }
function opBarReset(){ if(_opBar){ _opBar.dead=true; cancelAnimationFrame(_opBar.raf); _opBar=null; }
  const e=_opBarEls(); if(!e) return;
  if(e.bar){ e.bar.style.animation=''; e.bar.style.transition=''; e.bar.style.width=''; }
  if(e.tx) e.tx.innerHTML='0<s>%</s>'; }
// 부팅 막대는 **스크립트가 읽히는 순간** 시작한다 — bootApp 은 window.load 라
// 그것만 기다리면 그 사이 막대가 비어 있다(전에는 CSS 가짜 애니가 돌다가 0 으로 되돌아갔다).
// ⚠ 공유 키 아트도 **여기서** 켠다. 부팅 로딩은 마크업에 그냥 떠 있어서 showAppScreen 을 안 거친다 —
//    거기서만 켜면 첫 화면이 배경 없이 새까맣게 나오고, 투명해진 로딩 아래로 채팅바까지 비친다(실제로 그랬다).
try{ if(document.getElementById('opening')){ titleArtShow(true); opBarStart(1400); } }catch(e){}
function showLoading(done, ms){ const op=document.getElementById('opening'); if(!op){ if(typeof done==='function') done(); return; }
  op.classList.remove('counting'); titleArtShow(true); screenFadeIn(op);   // 배경은 그대로 두고 막대만 떠오른다
  const tok=(op._loadTok=(op._loadTok||0)+1);   // 그 사이 새 로딩이 시작되면 옛 약속은 버린다
  opBarStart(ms);
  opBarDone().then(()=>{ if(op._loadTok!==tok) return;
    // 다음 화면을 **먼저** 세우고, 그 위에서 로딩만 걷어낸다 — 검은 한 프레임이 안 생긴다.
    if(typeof done==='function') done();
    screenFadeOut(op);
    setTimeout(()=>{ if(op._loadTok===tok) opBarReset(); }, _fadeMs()+40); }); }   // 막대 되감기는 사라진 뒤에
// 로딩 화면 미니맵 썸네일(네모=미니맵, 그 외=아이콘)
// 유즈맵 썸네일(팝업·게임 시작 화면 공용 단일 소스): 네모=미니맵, 그 외=맵 아이콘
// 🖼 유즈맵 키 아트 — 던전 배경(HB_BG_DIR)과 같은 구조: 코드가 경로를 조립하고 파일은 맵 id 로 찾는다.
//   ⚠ 그림이 없는 맵(임시·관리자)은 층을 **비운다**. 미니맵을 늘려 대신 채우지 않는다 —
//     같은 그림 두 장은 '배경이 없어서 늘린' 티가 난다(2026-08-18).
const UMAP_BG_DIR='assets/backgrounds/usemaps/';
const UMAP_BG={ nemo:1, nemo_inf:'nemo', cpu:1, sunken:1, marine:1, temple:1, photon:1 };   // 값 1 = 파일명이 id 와 같음 · 문자열 = 다른 파일을 공유
function mapBgUrl(m){ if(!m) return ''; const v=UMAP_BG[m.id]; if(!v) return '';
  return UMAP_BG_DIR+(v===1?m.id:v)+'.webp'; }
function _mapBgInto(el, m){ if(!el) return; const u=mapBgUrl(m);
  el.style.backgroundImage = u ? "url('"+u+"')" : ''; }
function _mapThumbInto(el, m, extra){ if(!el) return;
  const base='moThumb'+(extra?' '+extra:'');
  const _mm=(typeof mapMinimap==='function')?mapMinimap(m):null;
  if(_mm){ el.className=base+' mm'; el.innerHTML=_mm; }
  else { el.className=base; el.innerHTML='<span class="mmIco">'+((m&&typeof mapIco==='function')?mapIco(m):'')+'</span>'; } }
// 시작 화면 설명 = 유즈맵 팝업과 같은 특징 리스트(핵심 3줄). 특징이 없으면 한 줄 소개로 폴백.
function _mapGuideHTML(m){ if(!m) return '';
  if(m.feats && m.feats.length) return _featRowsHTML(m.feats, 3);
  return escHtml(m.desc||''); }
// 지금 접속한 플레이어 목록(단일 소스) — 없으면 나 혼자
function _gsList(){ return (typeof G!=='undefined'&&G.activePlayers&&G.activePlayers.length)?G.activePlayers:[1]; }
function _gsSolo(){ return _gsList().length<=1; }
// 팀 배정 = 대기실과 같은 기준(앞 절반 1팀 / 뒤 절반 2팀). 팀이 없는 맵이면 0.
function _gsTeamOf(p){ if(!(typeof lobbyTeams==='function' && lobbyTeams())) return 0;
  const list=_gsList(), mx=(typeof _lobbyMax!=='undefined'&&_lobbyMax)?_lobbyMax:Math.max.apply(null,list.concat([2]));
  return p<=Math.ceil(mx/2) ? 1 : 2; }
// 플레이어 카드 덱 — 협동은 4장씩 두 줄, 팀전은 팀마다 한 줄(윗변이 팀 색).
// ⛔ 새 카드 마크업을 만들지 말 것: 초상은 공용 avatarHTML(), 준비는 .rdy 한 클래스가 전부다.
function _renderGsPlayers(){ const deck=document.getElementById('gsDeck'), root=document.getElementById('gsRoot');
  if(!deck||!root) return;
  const list=_gsList(), solo=_gsSolo(), teams=!solo && (typeof lobbyTeams==='function') && lobbyTeams();
  root.classList.toggle('solo', solo); root.classList.toggle('teamed', !!teams);
  _gsPaintCount(list);
  if(solo){ deck.innerHTML=''; return; }   // 혼자면 덱 자체가 없다
  const card=function(p){ const rdy=!!(_gsReady&&_gsReady.has(p));
    const nm=(typeof playerName==='function')?playerName(p):('P'+p);
    return '<div class="gsCd'+(rdy?' rdy':'')+'" data-p="'+p+'" title="'+escHtml(nm)+'">'
      +((typeof avatarHTML==='function')?avatarHTML(nm):'<span class="fAva"></span>')
      +'<b>'+escHtml(nm)+'</b><em>'+(rdy?'READY':'…')+'</em></div>'; };
  const row=function(ps){ return '<div class="gsRow">'+ps.map(card).join('')+'</div>'; };
  if(teams){ deck.innerHTML=[1,2].map(function(t){ const g=list.filter(function(p){ return _gsTeamOf(p)===t; });
      if(!g.length) return '';
      return '<div class="gsT'+t+'"><div class="gsTlb">'+t+'팀<s></s></div>'+row(g)+'</div>'; }).join(''); return; }
  deck.innerHTML=row(list.slice(0,4))+(list.length>4?row(list.slice(4)):''); }
// 하단 표기 — 여럿이면 '준비 n/N', 혼자면 로딩 진행률(혼자서 '준비'는 뜻이 없다)
function _gsPaintCount(list){ const op=document.getElementById('opening');
  const lb=document.getElementById('gsCntLb'), n=document.getElementById('gsCntN'), fill=document.getElementById('gsBarFill');
  if(!op||!n||!fill||!op.classList.contains('ready')) return;
  list=list||_gsList();
  // ① 로딩 단계 — 혼자든 여럿이든 막대는 **로딩 진행률**이다. 다 차야 시작 버튼이 열린다(2026-08-19)
  if(_gsLoading){ const pc=Math.round((_gsSoloPct||0)*100);
    if(lb) lb.textContent='LOADING'; n.innerHTML=pc+'<s>%</s>'; fill.style.width=pc+'%'; return; }
  // ② 로딩이 끝난 뒤 — 혼자면 '누르면 들어간다', 여럿이면 준비 인원
  if(_gsSolo()){ if(lb) lb.textContent='준비 완료 — 시작을 누르세요'; n.innerHTML='100<s>%</s>'; fill.style.width='100%'; return; }
  const rdy=list.filter(function(p){ return _gsReady&&_gsReady.has(p); }).length;
  if(lb) lb.textContent='전원 준비하면 바로 진입합니다';
  n.innerHTML=rdy+'<s>/'+list.length+'</s>';
  fill.style.width=Math.round(rdy/Math.max(1,list.length)*100)+'%'; }
// 시작 버튼 → 준비완료 UI(체크)로 전환
function _gsMarkMeReadyUI(){ const b=document.getElementById('opStart'), t=document.getElementById('opStartTxt');
  if(b){ b.disabled=true; b.classList.add('done'); }
  if(t && !_gsSolo()) t.innerHTML='<svg class="opChk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.4 4.4L19 7"/></svg>준비 완료'; }
// 내가 시작(준비완료) 버튼을 누름 — 전원 준비 시 즉시 시작(빠른 경로)
function gsReadyMe(){ if(typeof G==='undefined'||!_gsReady) return; const me=(G.myPlayer||1);
  if(_gsReady.has(me)) return;
  _gsMarkMeReadyUI(); _gsSet(me); }
const GS_LOAD_MS=800;     // 진입 로딩 막대의 **최소** 시간(ms) — 실제 로딩이 더 빨라도 이만큼은 보여 준다
const GS_LOAD_MAX=15000;  // 안전판 — 실제 로딩이 이 시간을 넘으면 막대를 100% 로 열어 준다(사용자를 가두지 않는다)
const GS_READY_MS=5000;   // 준비 대기 시간(단일 소스) — 시작 버튼 진행 표시·자동 시작·상대 준비 시차가 모두 이 값을 따름
const GS_HOLD_MS=500;     // 전원 준비 → 전환 시작까지 잠깐 머무는 시간
const GS_WARP_MS=750;     // 서서히 흐려지며 게임으로 들어가는 전환 길이(CSS --gsWarp와 동일)
// 진행 표시가 다 차면 자동 준비완료 → 1초 뒤 게임 시작
function _gsAutoReady(){ if(typeof G==='undefined'||!_gsReady) return; const me=(G.myPlayer||1);
  if(!_gsReady.has(me)){ _gsReady.add(me); _gsMarkMeReadyUI(); _renderGsPlayers(); }   // 자동 준비완료(즉시 종료 X)
  _gsTimers.push(setTimeout(_gsFinish, 1000)); }   // 1초 뒤 시작
function _gsSet(p){ if(!_gsReady) return; _gsReady.add(p); _renderGsPlayers();
  const list=(G.activePlayers&&G.activePlayers.length)?G.activePlayers:[1];
  if(list.every(function(x){ return _gsReady.has(x); })){   // 전원 준비 → 0.5초 머문 뒤 전환(즉시 잘리지 않게)
    const op=document.getElementById('opening'); if(op){ if(op._holdT) return; op._holdT=setTimeout(function(){ op._holdT=null; _gsFinish(); }, GS_HOLD_MS); _gsTimers.push(op._holdT); }
    else _gsFinish(); } }
let _gsReady=null, _gsTimers=[], _gsDone=null, _gsSoloPct=0;   // _gsSoloPct = 진입 로딩 진행률(0~1)
let _gsLoading=false;     // 로딩 단계인가 — true 면 막대는 LOADING%, 시작 버튼은 잠김
// ⚠ 타이머 통에는 setInterval 도 들어간다({__iv}) — clearTimeout 만 돌리면 개인 로딩 진행률이 계속 돈다
function _gsClearTimers(){ _gsTimers.forEach(function(t){ if(t&&t.__iv) clearInterval(t.__iv); else clearTimeout(t); }); _gsTimers=[]; }
// 3·2·1 종료 → 준비 단계(시작 버튼이 채워지는 동안 다른 플레이어도 준비)
// ⏳ ① 로딩 단계 — 막대가 0→100% 로 **빠르게** 찬다. 그동안 시작 버튼은 잠겨 있다(2026-08-19).
//    예전엔 버튼이 처음부터 눌려서 막대도 버튼도 뜻이 없었다(막대는 그냥 5초 타이머였다).
//    이제 막대가 '아직 들어갈 수 없다'는 뜻을 갖고, 다 차는 순간 버튼이 열린다 → 준비 단계로 넘어간다.
function _gsEnterLoading(){ const op=document.getElementById('opening'); if(!op) return;
  op.classList.add('ready');            // 카드 덱·하단 표기를 켠다(진행 표시 .timing 은 아직)
  _gsLoading=true; _gsSoloPct=0;
  const sb=document.getElementById('opStart'); if(sb){ sb.disabled=true; }   // 잠김 모습은 공용 .actBtn:disabled 가 갖는다
  _renderGsPlayers();
  // ── 실제 로딩과 연결 ─────────────────────────────────────────────
  // 그 맵의 3D 모델(MAP_ASSETS)을 받는다. loadMapModels 는 **아직 없는 것만** 큐잉하므로
  // 로그인 때 이미 데워졌으면 즉시 끝나고(총 0개) 최소 시간만 남는다 — 두 번째 진입이 느려지지 않는다.
  let real=0, realDone=false;
  const mid=(typeof _selMap!=='undefined' && _selMap) ? _selMap.id : null;
  if(mid && window.M3D && M3D.loadMapModels){
    try{ M3D.loadMapModels(mid, function(){ real=1; realDone=true; },
                                function(d,t){ if(!t){ real=1; realDone=true; } else real=d/t; }); }
    catch(e){ real=1; realDone=true; }
  } else { real=1; realDone=true; }
  const t0=(typeof performance!=='undefined'?performance.now():0);
  const iv=setInterval(function(){
    const el=(typeof performance!=='undefined'?performance.now():t0+GS_LOAD_MS)-t0;
    const byTime=Math.min(1, el/GS_LOAD_MS);
    // ⚠ 둘 중 **늦은 쪽**을 따른다 — 실제가 끝나도 최소 시간은 채우고(깜빡임 방지),
    //    최소 시간이 지나도 실제가 안 끝났으면 기다린다(막대가 거짓말하지 않는다).
    _gsSoloPct=Math.min(byTime, realDone?1:Math.max(0,real));
    if(el>=GS_LOAD_MAX) _gsSoloPct=1;   // 안전판 — 모델 하나가 영영 안 오면 사용자를 가둔다
    _gsPaintCount();
    if(_gsSoloPct>=1){ clearInterval(iv); _gsLoading=false;
      if(sb) sb.disabled=false;         // ← 100% 가 된 다음에야 누를 수 있다
      _gsEnterReady(); } }, 30);
  _gsTimers.push({__iv:iv}); }
// ② 준비 단계 — 로딩이 끝난 뒤에만 들어온다. 시작 버튼 진행 표시(자동 시작)가 여기서 돈다.
function _gsEnterReady(){ const op=document.getElementById('opening'); op.classList.add('ready'); _renderGsPlayers();   // 원 표시를 준비 인원으로 전환
  op.style.setProperty('--gsDur', (GS_READY_MS/1000)+'s');                      // CSS 진행 표시 길이 = JS 대기 시간과 동일
  _gsPaintCount();
  const bar=document.querySelector('#opStart .opStartBar'); if(bar){ bar.style.animation='none'; void bar.offsetWidth; bar.style.animation=''; }  // 진행 표시 애니 재시작
  op.classList.add('timing');                                                   // 진행 표시 시작
  const list=(G.activePlayers&&G.activePlayers.length)?G.activePlayers:[1], me=(G.myPlayer||1);
  list.forEach(function(p){ if(p===me) return;                                  // 다른 플레이어: 대기 시간 안에서 시차를 두고 준비
    _gsTimers.push(setTimeout(function(){ _gsSet(p); }, GS_READY_MS*0.16+Math.random()*GS_READY_MS*0.72)); });
  _gsTimers.push(setTimeout(_gsAutoReady, GS_READY_MS));                        // 다 차면 자동 준비완료
}
// 카운트다운/준비 단계에서 나가기 = 시작 취소 → 유즈맵 선택(게임 정리는 기존 종료 경로 재사용)
function gsQuitToMaps(){ const op=document.getElementById('opening'); if(!op) return;
  clearTimeout(op._loadT); clearTimeout(op._cdEnd); clearTimeout(op._holdT); op._holdT=null; _gsClearTimers(); op._finished=false; _gsDone=null;
  _gsLoading=false; { const sb=document.getElementById('opStart'); if(sb) sb.disabled=false; }   // 잠금이 남으면 다음 진입에서 못 누른다
  op.classList.remove('counting','ready','timing','warp');
  if(typeof G!=='undefined'&&G) G.loading=false;
  if(typeof G!=='undefined'&&G&&G.strike){ G.strike=false; STK=null; }   // 직스: 카운트다운 중 나가기(크롬 원복은 overlayToLobby의 resetGameChrome이 담당)
  if(typeof setInGame==='function') setInGame(false);
  if(typeof playSfx==='function') playSfx('ui_close');
  overlayToLobby(); }   // G 리셋·코옵 종료·방 닫기 → 로딩 → 유즈맵 선택
// 게임 시작 화면: 곧바로 준비 단계(3·2·1 카운트 없음) → 워프 전환
// 머리줄 배지 = 이 판이 어떤 판인지 한 조각. 팀전이면 대진(4 vs 4), 아니면 난이도.
// ⛔ 초록을 쓰지 말 것 — 이 화면에서 초록은 '준비 완료' 전용이다(카드 밑변).
function _gsHeadHTML(m){
  const list=_gsList(), teams=(typeof lobbyTeams==='function') && lobbyTeams() && list.length>1;
  if(teams){ const a=list.filter(function(p){ return _gsTeamOf(p)===1; }).length, b=list.length-a;
    const cus=!!(typeof _lobbyRoom!=='undefined' && _lobbyRoom && _lobbyRoom.opts);   // 방장이 손댄 방이면 알려 준다
    return { bd:'<span class="gsBd vs"><s></s>'+a+'<span style="opacity:.5;margin:0 2px">vs</span>'+b+'<s class="b"></s></span>'
               +(cus?'<span class="gsBd cus">사용자 지정</span>':''),
             tx:list.length+'인 대전 · 2팀' }; }
  const noDiff=!!(m&&m.noDiff), D=(typeof DIFFICULTY!=='undefined')&&DIFFICULTY[(typeof _selDiff!=='undefined')?_selDiff:'easy'];
  if(noDiff||!D) return { bd:'', tx:(m&&m.desc)||'' };
  const hp=(D.enemyHp/DIFFICULTY.easy.enemyHp).toFixed(1);
  return { bd:'<span class="gsBd">'+escHtml(D.name)+'</span>', tx:'적 HP ×'+hp+' · 포인트 ×'+D.coinMult }; }
function gameStartCountdown(done){ const op=document.getElementById('opening');
  if(!op||!document.getElementById('gsRoot')){ if(typeof done==='function') done(); return; }
  clearTimeout(op._loadT); clearTimeout(op._cdEnd); clearTimeout(op._holdT); op._holdT=null; _gsClearTimers(); op._finished=false; _gsDone=done||null;
  const m=(typeof _selMap!=='undefined' && _selMap) ? _selMap : null;
  { const ac=(m && typeof MAP_ACCENT!=='undefined' && MAP_ACCENT[m.id])||'#7f93b0'; op.style.setProperty('--mapAccent', ac); }
  // 배경 = 유즈맵 키 아트(팝업·목록과 같은 단일 소스). 그림이 없는 맵은 비워 둔다 — 미니맵으로 대신 채우지 않는다.
  { const art=document.getElementById('gsArt'); if(art) _mapBgInto(art, m); }
  { const nm=document.getElementById('gsName'); if(nm) nm.textContent=m?m.name:''; }
  { const ln=document.getElementById('gsLine'), h=_gsHeadHTML(m);
    if(ln) ln.innerHTML=h.bd+'<span>'+escHtml(h.tx)+'</span>'; }
  { const fe=document.getElementById('gsFeat');   // 특징 = 유즈맵 팝업과 같은 리스트(_featRowsHTML)
    if(fe){ const has=!!(m&&m.feats&&m.feats.length);
      fe.className='gsFeat'+(has?' moFeats':'');   // ⚠ .moFeats 를 안 붙이면 아이콘 판·간격이 통째로 죽는다
      fe.innerHTML=_mapGuideHTML(m); } }
  if(typeof paintIcons==='function') paintIcons(op);
  _gsSoloPct=0; _gsLoading=false;   // 로딩 단계는 _gsEnterLoading 이 다시 켠다
  _gsReady=new Set(); _renderGsPlayers();
  const sb=document.getElementById('opStart'), st=document.getElementById('opStartTxt');
  if(sb){ sb.disabled=false; sb.classList.remove('done'); } if(st){ st.textContent=_gsSolo()?'전투 시작':'준비 완료'; }
  op.classList.remove('hide','warp','ready','timing'); op.classList.add('counting');
  titleArtShow(false);   // 진입 카운트다운은 자기 아트(.gsArt)를 쓴다 — 타이틀 그림을 뒤에 두지 않는다
  { const fill=document.getElementById('gsBarFill'); if(fill) fill.style.width='0%'; }
  _gsEnterLoading(); }   // 로딩 단계부터 — 막대가 100% 가 되면 스스로 준비 단계로 넘어간다
// 준비 완료(전원 또는 5초 자동) → 워프 전환 후 게임 진행
function _gsFinish(){ const op=document.getElementById('opening'); if(!op||op._finished) return; op._finished=true; _gsLoading=false;
  _gsTimers.forEach(function(t){ if(t&&t.__iv) clearInterval(t.__iv); else clearTimeout(t); }); _gsTimers=[];
  op.style.setProperty('--gsWarp', (GS_WARP_MS/1000)+'s');   // CSS 전환 길이 = JS 대기 시간과 동일
  op.classList.add('warp');   // 'ready' 유지한 채 서서히 흐려지며 게임 안으로
  op._cdEnd=setTimeout(function(){ op.classList.add('hide'); op.classList.remove('warp','counting','ready','timing'); op._finished=false;
    if(typeof G!=='undefined'&&G) G.loading=false;                     // 로딩 종료 → 게임 타이머 10초부터 진행
    if(typeof bgmStart==='function') bgmStart('ingame');               // 라운드 시작 → 인게임 BGM(로비 BGM 정지)
    if(typeof _gsDone==='function') _gsDone(); }, GS_WARP_MS); }
// ── 부팅 흐름: 오프닝 → 로그인 화면 ──
//   저장된 세션이 있어도 화면은 반드시 거친다(자동 로그인 안 함). 빈 칸으로 로그인 = 그 세션 그대로 입장.
async function bootApp(){
  // ⚠ initAuth 는 esm.sh 에서 supabase 를 받아오는 네트워크 대기다.
  //   아이콘은 인증과 무관하므로 먼저 칠한다 — 뒤에 두면 회선이 느릴 때 한참 뒤에 나타난다.
  if(typeof paintIcons==='function') paintIcons(document);   // data-ico → 라인아트 아이콘을 문서 전체에 1회
  // ⚠ 여기서 opBarStart 를 다시 부르지 말 것 — 막대는 스크립트가 읽힐 때 이미 시작했다.
  //   다시 부르면 0 으로 되돌아가 사용자에겐 '로딩이 두 번' 도는 것으로 보인다.
  opBarReal(0.15);
  await initAuth();
  opBarReal(BOOT_AUTH_P);      // 인증까지 끝 — 나머지 구간은 데우기(enterAfterWarm)가 이어 채운다
  // 오프닝 걷어내기 → 로그인/회원가입.
  // ⚠ 그 사이 다른 화면으로 이미 넘어갔다면 건드리지 않는다 — 무조건 openAuth()를 부르면
  //    사용자가 보고 있던 화면을 로그인 화면이 덮어버린다(스모크가 간헐 실패했다).
  { const op=document.getElementById('opening');
    if(op && op.classList.contains('hide')) return;                 // 이미 다른 화면으로 넘어갔다
    if(AUTH.user){ enterAfterWarm(); return; }                      // 세션이 살아 있으면 로그인 화면을 건너뛴다(막대를 **이어서** 쓴다)
    await opBarDone();                                              // 로그인 화면으로 갈 때만 여기서 막대를 끝낸다
    openAuth();                                                     // 로딩은 페이드로 걷히고 로그인이 겹쳐 들어온다
    setTimeout(opBarReset, _fadeMs()+40); } }                       // ⚠ 막대를 먼저 0 으로 되감으면 사라지는 동안 그게 보인다
// 🧍 방치 하트비트: 앱 켜져 있으면 60초마다 100% 자동 적립(유즈맵과 무관)
try{ setInterval(profIdleTick, 60000); }catch(e){}
window.addEventListener('beforeunload', function(){ try{ profStampSeen(); }catch(e){} });   // 종료 시 시각 스탬프(다음 접속 오프라인 정산 기준)
// ── 로그인 화면 ──
// ── 로그인 화면 = 방식 선택 허브(①) + 로그인/회원가입 폼(②) 두 단계 ──
// 폼은 한 벌뿐이다. 아이디냐 이메일이냐는 _authKind 하나로만 갈린다 — 폼을 두 벌 만들지 말 것.
let _authTab='login', _authKind='id';
// 게스트 → 정식 계정 '연결' 모드. 같은 폼을 쓰되 제출만 authLinkAccount 로 간다(폼을 또 만들지 않는다).
let _authLink=false;
function openAuthLink(){ if(!authCanLink()) return;
  _authLink=true; openAuth(); }   // 연결 안내 문구는 authShowHub 가 세운다(한 곳)
function authLinkCancel(){ _authLink=false; if(typeof openHome==='function') openHome(); }
const AUTH_WAYS={ id:{label:'아이디', ico:'user'}, email:{label:'이메일', ico:'mail'}, guest:{label:'게스트', ico:'user'} };
function authRememberWay(k){ try{ _lsSet('nm_last_auth', k); }catch(e){} }   // 재방문 때 그 방식 폼으로 바로 연다
function authLastWay(){ const k=_lsGet('nm_last_auth', null); return AUTH_WAYS[k]? k : null; }
// 허브로 — '다른 방법으로'와 최초 진입이 같은 상태로 수렴한다
// 🔀 로그인 **안에서** 내용을 바꿀 때(허브↔폼 · 로그인↔회원가입)는 짧게 흐렸다가 되돌린다.
// 그냥 바꾸면 뚝 끊기고, 화면 등장 속도(--t-auth)로 끌면 답답하다 → --t-swap 을 따로 둔다.
// ⚠ 화면이 아직 안 떠 있으면(openAuth 가 여는 중) 바로 실행한다 — 안 그러면 첫 화면이 늦게 뜬다.
// ⚠ 중첩 호출(폼 열기가 안에서 모드도 바꾼다)은 한 번만 흐린다.
// 🔀 로그인 **안에서** 내용이 바뀔 때(허브↔폼)는 진짜 디졸브 — 둘이 잠깐 겹친다.
// ⚠ 본문을 미뤘다가 실행하면 '사라진 뒤 나타나는' 순차 페이드가 된다. 본문은 **즉시** 실행하고,
//    방금 사라진 판만 흐름에서 빼 같은 자리에 남겨 둔다(그 위에 새 판이 겹쳐 뜬다).
// ⚠ 재진입 방지 플래그다. 미뤄 둔 본문이 같은 함수를 다시 부르므로 '바쁨'으로 막으면 영영 안 바뀐다.
let _authSwapRun=false;
function authSwapDefer(fn, args){
  const a=document.getElementById('auth');
  if(_authSwapRun || !a || a.classList.contains('hide') || !a.classList.contains('inView')) return false;
  const ms=_cssMs('--t-swap', .22);
  // 판(허브↔폼)은 겹쳐서, 입력칸(탭 전환으로 늘고 주는 것)은 높이와 함께 흐른다
  const panels=[document.getElementById('authHub'), document.getElementById('authForm')];
  const fields=[document.getElementById('authNick'), document.getElementById('authPw2')];
  const was=panels.map(p=>!!p && !p.classList.contains('hide'));
  // ⚠ 자리는 **본문 실행 전에** 재 둔다 — 실행 뒤엔 이미 숨겨져 offsetTop 이 0 이다.
  //    .authIn 은 위(로고 밑)에 붙어 있으므로 **윗변에서의 거리**로 잡아야 화면에서 안 움직인다.
  const box=document.querySelector('.authIn');
  const geo=panels.map(function(p){ if(!p || p.classList.contains('hide') || !box) return null;
    return { top: p.offsetTop, h: p.offsetHeight }; });
  const wasF=fields.map(p=>!!p && !p.classList.contains('hide'));
  _authSwapRun=true; try{ fn.apply(null, args||[]); } finally { _authSwapRun=false; }
  panels.forEach(function(p,i){ if(!p) return;
    const now=!p.classList.contains('hide');
    if(was[i] && !now){                       // 방금 사라진 판 → 잠깐 남겨 겹친다
      clearTimeout(p._ghostT);
      // ⚠ 흐름에서 빼기 **전에** 있던 자리를 재서 그대로 박는다 — 안 그러면 판이 움직이며 흐려진다
      p.classList.remove('hide','swapNew');
      if(geo[i]){ p.style.top=geo[i].top+'px'; p.style.height=geo[i].h+'px'; }
      p.classList.add('swapGhost');
      p._ghostT=setTimeout(function(){ p.classList.remove('swapGhost');
        p.style.top=''; p.style.height=''; p.classList.add('hide'); }, ms);
    } else if(!was[i] && now){                // 방금 나타난 판 → 그 위에 겹쳐 뜬다
      clearTimeout(p._newT);
      p.classList.remove('swapGhost','swapNew'); void p.offsetWidth; p.classList.add('swapNew');
      p._newT=setTimeout(function(){ p.classList.remove('swapNew'); }, ms+60);
    }});
  fields.forEach(function(p,i){ if(!p) return;
    const now=!p.classList.contains('hide');
    if(wasF[i] && !now){ clearTimeout(p._ghostT);
      p.classList.remove('hide','fieldNew'); p.classList.add('fieldGhost');
      p._ghostT=setTimeout(function(){ p.classList.remove('fieldGhost'); p.classList.add('hide'); }, ms);
    } else if(!wasF[i] && now){ clearTimeout(p._newT);
      p.classList.remove('fieldGhost','fieldNew'); void p.offsetWidth; p.classList.add('fieldNew');
      p._newT=setTimeout(function(){ p.classList.remove('fieldNew'); }, ms+60); }});
  return true; }   // ⚠ 본문은 이미 위에서 실행했다 — false 를 주면 호출부가 한 번 더 실행한다
function authShowHub(){ if(authSwapDefer(authShowHub)) return;
  document.getElementById('authHub').classList.remove('hide');
  document.getElementById('authForm').classList.add('hide');
  // ⚠ 부제는 로고 블록의 'BATTLE ARENA' 다 — 안내 문구로 덮지 말 것(로고가 무너진다).
  //    연결 모드 안내는 아래 #authErr 가 맡는다.
  // 연결 모드엔 게스트로 다시 들어갈 이유가 없다 — 아이디/이메일만 남긴다
  document.getElementById('authGuest').classList.toggle('hide', _authLink);
  document.getElementById('wayGoogle').classList.toggle('hide', _authLink);
  // 라벨만 갈아 끼운다.
  //   ⛔ innerHTML 을 통째로 덮어쓰지 말 것(예전엔 아이콘 span 을 그렇게 다시 그렸다).
  { const put=(id,tx)=>{ const b=document.getElementById(id); if(b) b.textContent=tx; };   // 행은 글자 하나뿐이다(번호·화살표 폐지)
    put('wayId',   _authLink?'아이디로 연결':'아이디로 로그인');
    put('wayEmail',_authLink?'이메일로 연결':'이메일로 로그인'); }
  { const e=document.getElementById('authErr');
    e.classList.toggle('info', _authLink);
    e.textContent=_authLink?'게스트 진행도를 계정에 연결합니다':''; } }
function authOpenForm(kind, quiet){ if(authSwapDefer(authOpenForm,[kind,quiet])) return;
  _authKind=(kind==='email')?'email':'id';
  const f=document.getElementById('authId');
  if(_authKind==='email'){ f.type='email'; f.removeAttribute('maxlength'); f.autocomplete='email';
    f.placeholder='이메일 주소'; }
  else { f.type='text'; f.setAttribute('maxlength','16'); f.autocomplete='username';
    f.placeholder='아이디 (로그인용 · 영문·숫자 3~16자)'; }
  f.value='';
  document.getElementById('authHub').classList.add('hide');
  document.getElementById('authForm').classList.remove('hide');
  authMode('login');
  if(!quiet && typeof playSfx==='function') playSfx('ui_open'); }
function authBackToHub(){ authShowHub(); if(typeof playSfx==='function') playSfx('ui_close'); }
// 아직 못 붙인 방식 — 동작하는 척하지 않는다(Supabase 대시보드에 provider 설정이 있어야 켜진다)
function authWayLocked(){ const err=document.getElementById('authErr'); if(!err) return;
  err.classList.add('info'); err.textContent='Google 로그인은 아직 준비 중입니다. 아이디·이메일·게스트로 시작해 주세요.'; }
function openAuth(){
  document.getElementById('authId').value=''; document.getElementById('authPw').value='';
  document.getElementById('authNick').value=''; document.getElementById('authPw2').value='';
  // 다시 로그인해야 하는 상황이면 방식을 또 고르게 하지 않는다 — 마지막에 쓴 경로의 폼을 바로 연다.
  // (게스트는 고를 것이 없으니 허브로 — 한 번만 누르면 들어간다)
  const last=_authLink? null : authLastWay();
  _authKind='id'; authMode('login');
  if(last && last!=='guest') authOpenForm(last, true); else authShowHub();
  showAppScreen('auth');
  // 로그인 화면에 머무는 동안 미리 데운다 — 여기서 끝나면 로그인 버튼을 눌렀을 때 로딩이 거의 없다.
  // 한 프레임에 모델 하나씩이라 입력·애니메이션을 막지 않는다.
  setTimeout(()=>{ try{ warmAll(); }catch(e){} }, 400);
  if(typeof paintIcons==='function') paintIcons(document.getElementById('auth'));   // data-ico → 아이콘(부팅 시점에만 의존하지 않게)
  authLockHeight();   // 화면이 보이는 상태에서 실측해야 한다(display:none이면 높이가 0)
  if(typeof bgmStart==='function') bgmStart('lobby'); }   // 로그인 화면부터 로비 BGM
function authMode(m){ if(authSwapDefer(authMode,[m])) return;
  _authTab=m;
  const K=(_authKind==='email')?'이메일':'아이디';
  const tb=document.getElementById('authTabs');
  if(tb){ tb.classList.toggle('hide', _authLink);   // 연결 모드는 고를 탭이 없다
    tb.innerHTML=segNavHTML([{label:'로그인'},{label:'회원가입'}], m==='login'?0:1,
      function(k){ return "authMode('"+(k?'signup':'login')+"')"; }); }
  const wantFull = _authLink || m==='signup';       // 닉네임·비밀번호 확인이 필요한 형태
  document.getElementById('authNick').classList.toggle('hide', !wantFull);
  document.getElementById('authPw2').classList.toggle('hide', !wantFull);
  document.getElementById('authBtn').textContent = _authLink?'계정 연결':(m==='login'?'로그인':'가입하기');
  // ⚠ 부제(.authSub)는 로고 블록의 'BATTLE ARENA' 로 고정이다(2026-08-20) — 화면 안내로 쓰지 말 것.
  //    무엇을 하는 중인지는 탭 바(로그인/회원가입)와 버튼 글자가 이미 말한다.
  // 비밀번호 재설정은 진짜 메일함이 있는 이메일 계정에서만 뜻이 있다(아이디는 가짜 주소라 메일이 안 간다)
  const note=document.getElementById('authNote');
  if(note) note.classList.toggle('hide', _authLink || m!=='login');
  const later=document.getElementById('authLater');
  if(later) later.classList.toggle('hide', !_authLink);
  document.getElementById('authErr').textContent=''; }
// 카드 높이를 상태와 무관하게 같게 — 가장 긴 화면을 실측해 min-height로 고정한다.
// (허브·로그인·가입은 줄 수가 달라 그냥 두면 카드가 늘었다 줄었다 한다. 고정값을 적으면 문구가 바뀔 때 어긋나므로 실측한다.)
function authLockHeight(){ const form=document.getElementById('authForm'), hub=document.getElementById('authHub');
  if(!form||!hub) return;
  const keepTab=_authTab, keepHub=!hub.classList.contains('hide');
  form.style.setProperty('--authH','0px');
  hub.classList.add('hide'); form.classList.remove('hide');   // 숨은 채로는 높이가 0이라 재려면 잠깐 보여야 한다
  let max=0;
  for(const m of ['login','signup']){ authMode(m); max=Math.max(max, form.getBoundingClientRect().height); }
  authMode(keepTab);
  if(keepHub) authShowHub();
  form.style.setProperty('--authH', Math.ceil(max)+'px'); }
async function authSubmit(){
  const id=(document.getElementById('authId').value||'').trim(), pw=document.getElementById('authPw').value||'';
  const err=document.getElementById('authErr');
  err.classList.remove('info');   // 안내문 뒤에 진짜 오류가 오면 빨강으로 되돌린다
  // 빈 칸 바로 입장은 없앴다 — 체험 입장은 '게스트로 시작하기' 버튼이 맡는다.
  if(_authKind==='email'){ if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(id)){ err.textContent='이메일 주소 형식이 올바르지 않습니다.'; return; } }
  else if(!/^[A-Za-z0-9._-]{3,16}$/.test(id)){ err.textContent='아이디는 영문·숫자 3~16자입니다.'; return; }
  if(pw.length<6){ err.textContent='비밀번호는 6자 이상이어야 합니다.'; return; }
  try{
    if(_authLink || _authTab==='signup'){ const nick=(document.getElementById('authNick').value||'').trim(), pw2=document.getElementById('authPw2').value||'';
      if(nick.length<2){ err.textContent='닉네임을 2자 이상 입력하세요.'; return; }
      if(pw!==pw2){ err.textContent='비밀번호가 일치하지 않습니다.'; return; }
      if(_authLink){ await authLinkAccount(id,pw,nick); _authLink=false;
        if(typeof toast==='function') toast('계정이 연결됐습니다');
        if(typeof openHome==='function') openHome(); return; }   // 진행도는 그대로 — 다시 데울 필요가 없다
      await authSignUp(id,pw,nick);
    } else { await authSignIn(id,pw); }
    authRememberWay(_authKind);
    await enterAfterWarm();   // 로그인·가입 성공 → 로딩(데우기 완료)까지 마치고 HOME. 부팅 흐름과 도착지를 통일한다.
  }catch(e){ err.textContent = (e&&e.message)||'인증에 실패했습니다.'; }
}
function authGuestUser(){ AUTH.user={email:'', nick:'게스트'+(1000+Math.floor(Math.random()*9000)), guest:true, local:true};
  _lsSet('nm_session',AUTH.user); return AUTH.user; }   // 로컬 게스트(폴백) — 이 기기에만 남는다
// 게스트도 진짜 계정을 갖는다: Supabase 익명 로그인 → uid 가 생겨 클라우드 저장·소셜이 켜지고,
// 나중에 authLinkAccount()로 같은 uid 를 유지한 채 정식 계정이 된다.
// ⚠ 대시보드에서 Anonymous sign-in 이 꺼져 있으면 실패한다 → 그때는 예전처럼 로컬 게스트로 떨어진다(입장은 항상 된다).
async function authGuestStart(){
  if(AUTH.mode==='supabase' && _sb){
    try{ const {data,error}=await _sb.auth.signInAnonymously();
      if(!error && data && data.user){ AUTH.user=sbUser(data.user);
        await sbEnsureProfile(); await sbSyncMetaOnLogin(); return AUTH.user; }
    }catch(e){ console.warn('익명 로그인 실패 → 로컬 게스트', e); } }
  return authGuestUser(); }
async function authGuest(){ await authGuestStart(); authRememberWay('guest'); enterAfterWarm(); }
// 게스트 → 정식 계정. uid 를 그대로 두고 이메일·비밀번호만 붙이므로 진행도가 따라온다.
function authIsGuest(){ return !!(AUTH.user && AUTH.user.guest); }
function authCanLink(){ return !!(AUTH.mode==='supabase' && _sb && AUTH.user && AUTH.user.uid && AUTH.user.guest); }
async function authLinkAccount(idOrEmail, pw, nick){
  if(!authCanLink()) throw new Error('이 게스트는 이 기기에만 저장돼 있어 계정 연결을 지원하지 않습니다.');
  if(pw.length<6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
  const {error}=await _sb.auth.updateUser({ email:idToEmail(idOrEmail), password:pw,
    data:{ nick:(nick||'').trim()||AUTH.user.nick } });
  if(error) throw new Error(/registered|already|exists/i.test(error.message||'')?'이미 사용 중인 아이디·이메일입니다.':(error.message||'계정 연결에 실패했습니다.'));
  const {data}=await _sb.auth.getUser();
  if(data&&data.user){ AUTH.user=sbUser(data.user); AUTH.user.guest=false; }
  await sbEnsureProfile();
  authRememberWay(String(idOrEmail).indexOf('@')>=0?'email':'id');
  return AUTH.user; }
// ⚠ 아이디 계정은 idToEmail()로 만든 가짜 주소라 실제 메일함이 없다 → 복구 메일을 보낼 수 없다.
//    이메일로 가입한 계정에서만 진짜로 재설정 메일이 간다. 아이디 계정은 안내만 한다(동작하는 척하지 않는다).
async function authFindPw(){ const err=document.getElementById('authErr'); if(!err) return;
  err.classList.add('info');
  if(_authKind!=='email'){
    err.textContent='아이디 계정은 메일함이 없어 재발급을 보낼 수 없습니다. 이메일로 가입하면 재설정이 가능합니다.'; return; }
  const to=(document.getElementById('authId').value||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)){ err.textContent='재설정 메일을 받을 이메일 주소를 먼저 입력하세요.'; return; }
  if(AUTH.mode!=='supabase' || !_sb){ err.textContent='지금은 오프라인 모드라 메일을 보낼 수 없습니다.'; return; }
  try{ const {error}=await _sb.auth.resetPasswordForEmail(to);
    if(error) throw error;
    err.textContent=to+' 로 재설정 메일을 보냈습니다. 메일함을 확인해 주세요.';
  }catch(e){ err.classList.remove('info'); err.textContent=(e&&e.message)||'재설정 메일을 보내지 못했습니다.'; } }
function doLogout(){ _authLink=false; if(typeof hbEnd==='function') hbEnd();   // 전투 완전 종료 — 배경 시뮬이 다음 계정까지 따라가지 않게
  if(typeof bgmStop==='function') bgmStop(); if(typeof rtStop==='function') rtStop(); authSignOut().then(openAuth); }
// ── 유즈맵 데이터 ──
// ⚠ 설정 > 버전에 그대로 뜬다. package.json 의 version 과 손으로 맞춘다(빌드 단계가 없는 단일 파일이라 자동화가 없다).
const APP_VER='1.0.0';
const MAPS=Object.values(USEMAPS);   // 맵 선택 화면 목록(레지스트리에서 파생)
// ── 라인아트 아이콘(인게임과 동일 스타일: viewBox 24, stroke=currentColor) ──
const _svg=(b,extra)=>'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'+(extra||'')+'>'+b+'</svg>';
const ICO={
  user:_svg('<circle cx="12" cy="8" r="3.3"/><path d="M5.5 20c0-3.6 2.9-6.3 6.5-6.3s6.5 2.7 6.5 6.3"/>'),
  fav:_svg('<path d="M12 3.7l2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.6 7 19.2l1-5.6-4.1-4 5.6-.8z"/>'),
  pop:_svg('<path d="M12 3.4c2.9 3.1 5.3 5.4 5.3 9.1A5.3 5.3 0 0 1 12 17.9a5.3 5.3 0 0 1-5.3-5.4c0-1.7.7-3.1 1.9-4.4.4 1 1.1 1.6 2.1 1.8-.6-2.3.2-4.6 1.6-6.4z"/><path d="M12 18a2.7 2.7 0 0 0 2.7-2.8c0-1.4-1-2.3-1.8-3.2-.6.8-1.5 1-1.9 1.9-.5-.3-.7-.8-.7-1.4-.7.7-1 1.6-1 2.6A2.7 2.7 0 0 0 12 18z"/>'),
  new:_svg('<path d="M12 3.8l1.7 5.1 5.1 1.7-5.1 1.7L12 17.4l-1.7-5.1L5.2 10.6 10.3 8.9z"/><path d="M18.6 14.6l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z"/>'),
  rec:_svg('<path d="M7.2 11l3-6c1.2 0 2.1.9 2.1 2.1V10h4.4c1.1 0 1.8.9 1.6 2l-1.4 5.4c-.2.8-.9 1.4-1.7 1.4H7.2z"/><rect x="3.8" y="11" width="3.4" height="8.8" rx="1"/>'),
  chat:_svg('<rect x="3.4" y="4.6" width="17.2" height="12.4" rx="3.2"/><path d="M8.2 17v3.2L12.4 17"/><path d="M7.6 9.2h8.8M7.6 12.2h5.6"/>'),
  party:_svg('<path d="M4.2 20.2l4.2-10.4 6.2 6.2z"/><path d="M8.7 12.4l5.6-5.5"/><path d="M14.6 4.9l.45 1.75 1.75.45-1.75.45-.45 1.75-.45-1.75-1.75-.45 1.75-.45z"/><path d="M18.7 10.4l.32 1.25 1.25.32-1.25.32-.32 1.25-.32-1.25-1.25-.32 1.25-.32z"/>'),
  friend:_svg('<circle cx="8.6" cy="8.8" r="3.1"/><path d="M3.3 19.4c0-3 2.4-5.1 5.3-5.1s5.3 2.1 5.3 5.1"/><circle cx="16.6" cy="9.6" r="2.3"/><path d="M15.4 14.6c2.6.2 4.9 2 4.9 4.6"/>'),
  // 유즈맵 썸네일
  nemo:_svg('<rect x="4" y="4" width="16" height="16" rx="2.2"/><rect x="9" y="9" width="6" height="6" rx="1"/>'),
  sunken:_svg('<path d="M12 20.5V12"/><path d="M12 13.5C12 10 9.7 7.7 6.6 7.7 6.6 11.2 8.9 13.5 12 13.5z"/><path d="M12 12.6c0-3 2-5 4.8-5 0 3-2 5-4.8 5z"/>'),
  marine:_svg('<path d="M3.8 9.2h10.4v3H8.6l-1.1 3.2H5.4l1.1-3.2H3.8z" fill="currentColor" stroke="none"/><rect x="14.2" y="9.2" width="4.6" height="2.1" rx=".4" fill="currentColor" stroke="none"/><path d="M9 9.2V7.4h3v1.8"/>'),
  temple:_svg('<path d="M3.8 9.2 12 4.6l8.2 4.6"/><path d="M5.6 9.6v7.4M9.4 9.6v7.4M14.6 9.6v7.4M18.4 9.6v7.4"/><path d="M4 17.4h16M4.6 19.6h14.8"/>'),
  cpu:_svg('<rect x="7" y="7" width="10" height="10" rx="1.6"/><rect x="10" y="10" width="4" height="4" rx=".6"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/>'),
  photon:_svg('<circle cx="9.6" cy="10" r="4.6"/><circle cx="14.4" cy="14" r="4.6"/>'),
  rand:_svg('<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/>'),
  hero:_svg('<path d="M5 6h14l-1.6 9.5a2 2 0 0 1-2 1.7H8.6a2 2 0 0 1-2-1.7z"/><path d="M9 6V4.6h6V6M9.5 19.8h5"/>'),
  maze:_svg('<rect x="4" y="4" width="16" height="16" rx="1.6"/><path d="M8 4v8h4M8 16h8M16 8v8M12 8V4"/>'),
  map:_svg('<path d="M9 5 4.5 6.8v12L9 17l6 1.8 4.5-1.8v-12L15 6.8z"/><path d="M9 5v12M15 6.8v12"/>'),
  search:_svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15 19.5 19.5"/>'),
  invite:_svg('<circle cx="9" cy="8" r="3.2"/><path d="M3.6 19c0-3 2.4-5.2 5.4-5.2 1 0 1.9.2 2.7.6"/><path d="M17.5 13.5v5M15 16h5"/>'),
  join:_svg('<path d="M10.5 4.5H6.4c-1 0-1.7.8-1.7 1.7v11.6c0 1 .8 1.7 1.7 1.7h4.1"/><path d="M14 8.3l3.7 3.7-3.7 3.7"/><path d="M17.5 12H8.5"/>'),
  mail:_svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4.6 7.4 12 12.4 19.4 7.4"/>'),
  trash:_svg('<path d="M5 7h14"/><path d="M9 7V5.3c0-.7.5-1.3 1.2-1.3h3.6c.7 0 1.2.6 1.2 1.3V7"/><path d="M6.6 7l.8 11.4c.1.9.8 1.6 1.7 1.6h6c.9 0 1.6-.7 1.7-1.6L17.4 7"/><path d="M10 10.5v6M14 10.5v6"/>'),
  flag:_svg('<path d="M6 4v16"/><path d="M6 5h10.5l-2.2 3.2 2.2 3.2H6"/>'),
  solo:_svg('<rect x="2.5" y="7.5" width="19" height="10" rx="5"/><path d="M6.6 11.2v3M5.1 12.7h3"/><circle cx="15.6" cy="11.6" r="1.05" fill="currentColor" stroke="none"/><circle cx="17.9" cy="13.6" r="1.05" fill="currentColor" stroke="none"/>'),
  globe:_svg('<circle cx="12" cy="12" r="8.3"/><path d="M3.7 12h16.6"/><path d="M12 3.7c2.5 2.3 2.5 14.3 0 16.6c-2.5-2.3-2.5-14.3 0-16.6z"/>'),
  lock:_svg('<rect x="5.2" y="10.5" width="13.6" height="9.3" rx="2"/><path d="M8.2 10.5V8.2a3.8 3.8 0 0 1 7.6 0v2.3"/><circle cx="12" cy="14.6" r="1.25" fill="currentColor" stroke="none"/><path d="M12 15.5v2.1"/>'),
  // 부스트 — 번개. 좌상단 줄에 쓴다
  boost:_svg('<path d="M13.4 2.6 5.2 13.4h5.3l-1 8 8.3-10.8h-5.3z"/>'),
  // 건설 — 쌓아 올린 블록. 전장 바의 '건설' 버튼에 쓴다
  build:_svg('<path d="M3.8 20.2h16.4"/><path d="M6.2 20.2v-6.4h5v6.4"/><path d="M13 20.2V9.4h5v10.8"/>'),
  // 강화 — 네비 3번 칸. 위로 올라가는 화살표 하나(24그리드 공용 규칙)
  upg:_svg('<path d="M12 19.2V6.4"/><path d="M6.4 12 12 6.4l5.6 5.6"/>'),
  home:_svg('<path d="M4 10.6 12 4l8 6.6"/><path d="M6.4 9.6V19h11.2V9.6"/><path d="M10 19v-5h4v5"/>'),
  bag:_svg('<path d="M4.6 8.4h14.8L18.6 20H5.4z"/><path d="M9 8.4V6.6a3 3 0 0 1 6 0v1.8"/>'),
  dungeon:_svg('<path d="M4.5 4.5 15 15"/><path d="M19.5 4.5 9 15"/><path d="M9 15 6 18l-1.5-.5"/><path d="M15 15 18 18l1.5-.5"/><path d="M3.5 6.5 6.5 3.5"/><path d="M20.5 6.5 17.5 3.5"/>'),   // ⚔ 던전(크로스드 소드)
  gift:_svg('<rect x="4" y="9.4" width="16" height="10.6" rx="1.6"/><path d="M3.2 9.4h17.6M12 9.4V20"/><path d="M12 9.4C10.6 6 9.4 5 8.2 5a2 2 0 0 0 0 4.4M12 9.4C13.4 6 14.6 5 15.8 5a2 2 0 0 1 0 4.4"/>'),
  // 📅 출석 — 달력. 머리줄(진한 띠 대신 가로선)과 도장 두 칸으로 '채워 가는 판'을 읽히게 한다
  cal:_svg('<rect x="3.8" y="5.4" width="16.4" height="14.4" rx="2"/><path d="M3.8 9.6h16.4"/>'
    +'<path d="M8.2 3.6v3.4M15.8 3.6v3.4"/>'
    +'<rect x="6.6" y="12" width="3.2" height="3" rx=".6" fill="currentColor" stroke="none"/>'
    +'<rect x="11.4" y="12" width="3.2" height="3" rx=".6"/>'),
  back:_svg('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),                     // ‹ 돌아가기(최상위 네비로)
  armor:_svg('<path d="M12 3.4 5 6v6.1c0 4 2.9 7.1 7 8.5 4.1-1.4 7-4.5 7-8.5V6z"/><path d="M9.3 11.9l1.9 2 3.5-3.8"/>'),   // 장비
  coin:_svg('<circle cx="12" cy="12" r="7.6"/><path d="M12 8.2v7.6M10 10.2h3a1.8 1.8 0 0 1 0 3.6h-2a1.8 1.8 0 0 0 0 3.6h3"/>'),   // 재화
  box:_svg('<path d="M12 3.6 4.4 7.4v9.2L12 20.4l7.6-3.8V7.4z"/><path d="M4.4 7.4 12 11.2l7.6-3.8M12 11.2v9.2"/>'),   // 패키지
  paw:_svg('<ellipse cx="8" cy="9" rx="1.7" ry="2.2"/><ellipse cx="12" cy="7.6" rx="1.7" ry="2.3"/><ellipse cx="16" cy="9" rx="1.7" ry="2.2"/><path d="M12 12.2c2.6 0 4.6 1.8 4.6 3.9S14.6 20.4 12 20.4 7.4 18.2 7.4 16.1 9.4 12.2 12 12.2z"/>')   // 펫
};
function mapIco(m){ return ICO[m.id] || ICO.map; }
// 카드 썸네일: 메인화면 미니맵(보드) — 용암 테두리 보드 + 지면 + 합체존
// 네모네모: 사각 트랙 미니맵 — 지형/그리드/발광 트랙/스폰·적·유닛/합체존
const NEMO_MINIMAP='<svg class="mmBg" viewBox="0 0 48 48" fill="none">'
  +'<defs><radialGradient id="mmG" cx="50%" cy="40%" r="62%"><stop offset="0" stop-color="#4aa8ff" stop-opacity=".18"/><stop offset="1" stop-color="#4aa8ff" stop-opacity="0"/></radialGradient></defs>'
  +'<rect x="2.5" y="2.5" width="43" height="43" rx="9" fill="#0b111a"/>'                       /* 내부 스크린(라운드·주변 패널 톤) */
  +'<rect x="2.5" y="2.5" width="43" height="43" rx="9" fill="url(#mmG)"/>'                      /* 맵 강조색 글로우 */
  +'<g stroke="#1b2a3b" stroke-width=".5"><path d="M15 5V43M24 5V43M33 5V43M5 15H43M5 24H43M5 33H43"/></g>'  /* 은은한 격자 */
  +'<rect x="11" y="11" width="26" height="26" rx="6" fill="none" stroke="#4aa8ff" stroke-width="3.4" opacity=".13"/>'  /* 트랙 글로우 */
  +'<rect x="11" y="11" width="26" height="26" rx="6" fill="none" stroke="#63b4ff" stroke-width="1.5" stroke-dasharray="2.4 2" stroke-linecap="round"/>'  /* 트랙(적 이동 경로) */
  +'<circle cx="11" cy="11" r="2.1" fill="#8fd0ff"/><circle class="mmPulse" cx="11" cy="11" r="3.4" fill="none" stroke="#8fd0ff" stroke-width=".7"/>'  /* 스폰(펄스) */
  +'<circle cx="24" cy="11" r="1.3" fill="#cfe9ff"/><circle cx="37" cy="23" r="1.3" fill="#cfe9ff"/><circle cx="19" cy="37" r="1.2" fill="#cfe9ff"/>'  /* 적(경로 위) */
  +'<rect x="19.8" y="19.8" width="8.4" height="8.4" rx="2.3" fill="#122232" stroke="#4aa8ff" stroke-width="1.4"/><circle cx="24" cy="24" r="1.6" fill="#bfe4ff"/>'  /* 본진 코어 */
  +'</svg>';
const CPU_MINIMAP='<svg class="mmBg" viewBox="0 0 48 48" fill="none">'
  +'<defs><radialGradient id="mmGC" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#22d3ee" stop-opacity=".18"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient></defs>'
  +'<rect x="2.5" y="2.5" width="43" height="43" rx="9" fill="#0b111a"/>'                       /* 내부 스크린(라운드·주변 패널 톤) */
  +'<rect x="2.5" y="2.5" width="43" height="43" rx="9" fill="url(#mmGC)"/>'                     /* 맵 강조색 글로우 */
  +'<g stroke="#1b2a3b" stroke-width=".5"><path d="M15 5V43M24 5V43M33 5V43M5 15H43M5 24H43M5 33H43"/></g>'  /* 은은한 격자 */
  +'<path d="M12.5 35.5L35.5 12.5" stroke="#22d3ee" stroke-width="3.4" opacity=".13" stroke-linecap="round"/>'  /* 진격로 글로우 */
  +'<path d="M12.5 35.5L35.5 12.5" stroke="#5ee7f7" stroke-width="1.5" stroke-dasharray="2.4 2" stroke-linecap="round"/>'  /* 진격로(아군↔적 본진) */
  +'<rect x="6.4" y="32.4" width="9.2" height="9.2" rx="2.5" fill="#122232" stroke="#22d3ee" stroke-width="1.4"/><circle cx="11" cy="37" r="1.6" fill="#bfefff"/>'  /* 아군 본진 */
  +'<rect x="32.4" y="6.4" width="9.2" height="9.2" rx="2.5" fill="#221319" stroke="#ff5a6a" stroke-width="1.4"/><circle cx="37" cy="11" r="1.6" fill="#ffd0d6"/>'  /* 적 본진 */
  +'<circle cx="19" cy="29" r="1.3" fill="#9fe8ff"/><circle cx="29" cy="19" r="1.3" fill="#ffb3bd"/>'  /* 2차 신전(양 진영) */
  +'<circle cx="24" cy="24" r="1.9" fill="#ffd24a"/><circle class="mmPulse" cx="24" cy="24" r="3.4" fill="none" stroke="#ffd24a" stroke-width=".7"/>'  /* 중립 신전(펄스) */
  +'</svg>';
const MAP_MINIMAP={ nemo:()=>NEMO_MINIMAP, nemo_inf:()=>NEMO_MINIMAP, cpu:()=>CPU_MINIMAP };   // 유즈맵별 미니맵 썸네일(단일 소스 — 팝업·카드·시작 화면 공용)
function mapMinimap(m){ const f=m&&MAP_MINIMAP[m.id]; return f?f():null; }
function mapThumbHTML(m){ const mm=mapMinimap(m); return mm
  ? '<div class="mapThumb mm">'+mm+'</div>'                                 // 미니맵 보유 맵(네모·오토배틀)
  : '<div class="mapThumb"><span class="mmIco">'+mapIco(m)+'</span></div>'; }   // 그 외: 아이콘 박스
// 맵별 아이덴티티 색(아이콘·좌측바·썸네일 글로우에만 — 카드 크롬은 중립 유지 → 통일성). 없으면 중립 폴백.
const MAP_ACCENT={ nemo:'#4aa8ff', sunken:'#5dff8f', marine:'#ffb14d', temple:'#b98cff', cpu:'#22d3ee', nemo_inf:'#ff9a6b', admin:'#9aa6b2' };
// 유즈맵별 임무 목표(설정 > 임무 목표). 없는 맵은 유즈맵 특징(feats)으로 대체 표시.
const MISSION={
  nemo:{ goal:['<b>30라운드</b>까지 트랙을 지키면 승리','<b>10·20·30 라운드</b> 보스는 제한시간 안에 처치','살아남은 적이 <b>200기</b>가 되면 패배'],
    ctrl:['<b>시민</b>으로 유닛을 뽑아 맵에 <b>드래그</b>해 배치','같은 유닛 <b>3기</b>를 모아 상위 등급으로 조합','<b>업그레이드·타워</b>로 병력 강화'] },
  cpu:{ goal:['<b>적 본진</b>을 먼저 파괴하면 승리','내 <b>본진</b>이 파괴되면 패배'],
    ctrl:['<b>일꾼</b>으로 자원을 모아 건물을 건설','건물에 <b>유닛을 배정</b>하면 자동으로 출격','라운드마다 자원을 굴려 <b>병력</b>을 불림'] }
};
// 상태 점(대기=초록 링, 게임=빨강 채움) — 작아서 색으로 의미 전달
const ICO_WAIT='<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.4" fill="none" stroke="#5dff8f" stroke-width="3.4"/></svg>';
const ICO_PLAY='<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.2" fill="#ff6b6b"/></svg>';
function paintIcons(root){ (root||document).querySelectorAll('[data-ico]').forEach(el=>{ const k=el.dataset.ico; if(ICO[k]) el.innerHTML=ICO[k]; });
  paintArrows(root); }
// ── ◀▶ 방향 버튼(공용) — '모서리 컷 + 테두리만'. 게임 화면의 방향·증감 버튼은 전부 이걸 쓴다.
// ⚠ clip-path 로 자르면 테두리까지 잘려 잘린 변에 선이 안 남는다 → 외곽선을 SVG 로 직접 그린다.
//   바깥쪽 두 귀만 깎아 '방향'을 형태가 말하게 한다(DESIGN §0 — 라운드 대신 모서리를 잘라낸다).
const ARW_SVG={
  l:'<svg class="arwFrame" viewBox="0 0 30 30" aria-hidden="true"><path d="M9 .5H29.5V29.5H9L.5 15Z"/></svg>'
   +'<svg class="arwIco" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  r:'<svg class="arwFrame" viewBox="0 0 30 30" aria-hidden="true"><path d="M21 .5H.5V29.5H21L29.5 15Z"/></svg>'
   +'<svg class="arwIco" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' };
function paintArrows(root){ (root||document).querySelectorAll('[data-arw]').forEach(el=>{
  const k=el.dataset.arw; if(ARW_SVG[k] && !el.firstChild) el.innerHTML=ARW_SVG[k]; }); }
// 유즈맵별 실시간 접속 인원(대기중=로비/방찾기, 게임중=인게임) — 시뮬레이션
const _mapLive={};
function initMapLive(){ if(!_mapLive.__rpg){ const b=900+Math.round(Math.random()*700); _mapLive.__rpg={wait:0, play:b}; }   // RPG 접속자(맵과 같은 시뮬 표에 보관)
  MAPS.forEach(m=>{ if(_mapLive[m.id]) return;
  const base=Math.max(40, Math.round(m.pop*(0.5+Math.random()*0.5)));
  const play=Math.round(base*(0.55+Math.random()*0.2));
  _mapLive[m.id]={wait:Math.max(0,base-play), play}; }); }
function liveTotal(m){ const o=_mapLive[m.id]||{wait:0,play:0}; return o.wait+o.play; }
function liveText(m){ const o=_mapLive[m.id]||{wait:0,play:0};
  const rooms=Math.max(1, Math.round(o.wait/8));
  return '<span class="mlStat">'+ICO_WAIT+'<b>'+_kfmt(o.wait)+'</b><em>명 대기</em></span>'
    +'<span class="mlStat"><b>'+_kfmt(rooms)+'</b><em>개 대기방</em></span>'; }
function tickMapLive(){ for(const id in _mapLive){ const o=_mapLive[id];
    o.wait=Math.max(0, o.wait+Math.round((Math.random()-0.5)*Math.max(3, o.wait*0.05)));
    o.play=Math.max(0, o.play+Math.round((Math.random()-0.5)*Math.max(4, o.play*0.05))); }
  MAPS.forEach(m=>{ const e=document.getElementById('mlive-'+m.id); if(e) e.innerHTML=liveText(m); });
  updateMapBanner(); }
function updateMapBanner(){ const b=document.getElementById('msBanner'); if(!b) return;
  let w=0,p=0; for(const id in _mapLive){ w+=_mapLive[id].wait; p+=_mapLive[id].play; }
  b.innerHTML='<span class="bnStat bnWait">'+ICO_WAIT+'<b>'+_kfmt(w)+'</b><em>대기</em></span>'
    +'<span class="bnStat bnPlay">'+ICO_PLAY+'<b>'+_kfmt(p)+'</b><em>게임</em></span>'
    +'<span class="bnStat bnAll">'+ICO.friend+'<b>'+_kfmt(w+p)+'</b><em>접속</em></span>'; }
let _mapLiveT=null;
function startMapLive(){ stopMapLive(); _mapLiveT=setInterval(tickMapLive, 2600); startGlobalChat(); }
function stopMapLive(){ if(_mapLiveT){ clearInterval(_mapLiveT); _mapLiveT=null; } stopGlobalChat(); }
// ── 전체 채팅(유즈맵 선택 로비) ──
const GLOBAL_CHATTER=['ㅎㅇ 다들~','같이 하실 분','네모네모 재밌네요','용병키우기 고수 계신가요?','풀방 가즈아','초보 환영합니다','지금 인원 많네요 ㅋㅋ','가시탑 ㄱㄱ','친추 받아요','3렙인데 잘 부탁','오늘 잘 풀린다','파티 2명 구함','성소공성전 해보신 분?','ㅇㅈ','반가워요~','오토배틀 한판 ㄱㄱ','방 만들었어요 들어오세요','gg 또 만나요'];
let _gChatT=null;
let _chatScope='all';
const _MS_SCOPE_KO={all:'전체',party:'파티',friend:'친구'};
function setChatScope(sc){ _chatScope=sc;
  const dd=document.getElementById('msScopeDD'); if(dd) dd.dataset.sc=sc;
  const lbl=document.getElementById('msScopeLbl'); if(lbl) lbl.textContent=(_MS_SCOPE_KO[sc]||sc);
  document.querySelectorAll('#msScopeMenu .msScopeOpt').forEach(o=>o.classList.toggle('on', o.dataset.sc===sc));
  const c=document.getElementById('msChat'); if(c){ c.dataset.scope=sc; c.scrollTop=c.scrollHeight; }
  const inp=document.getElementById('msChatInput'); if(inp) inp.placeholder='메시지 입력…'; }   // 범위는 왼쪽 배지가 표시(문구 중복 제거)
function _msScopeClose(){ const m=document.getElementById('msScopeMenu'); if(m) m.classList.add('hide'); const d=document.getElementById('msScopeDD'); if(d) d.classList.remove('open'); }
function toggleMsScope(ev){ if(ev){ ev.stopPropagation(); ev.preventDefault(); } const m=document.getElementById('msScopeMenu'), d=document.getElementById('msScopeDD'); if(!m||!d) return;
  const willOpen=m.classList.contains('hide'); m.classList.toggle('hide', !willOpen); d.classList.toggle('open', willOpen); if(typeof playSfx==='function') playSfx('ui_tab'); }
function pickMsScope(sc){ _msScopeClose(); if(typeof setChatScope==='function') setChatScope(sc); }
// 줄의 시각 — **맨 앞에 넣지만 `float:right` 라 오른쪽 끝에 붙는다**(친구 행의 상태와 같은 자리).
//   ⚠ flex 로 오른쪽에 붙이면 본문이 익명 flex 아이템이 되어 길어질 때 줄바꿈이 깨진다 — float 여야 본문이 감싸 흐른다.
function _mcTime(){ const d=new Date();
  return '<em class="mcT">'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+'</em>'; }
function addGlobalMsg(who, text, cls, scope){ const box=document.getElementById('msChat'); if(!box) return;
  const d=document.createElement('div'); d.className='mcLine sc-'+(scope||'all')+(cls?(' '+cls):'');
  d.innerHTML=_mcTime()+(who?'<span class="mcWho">'+escHtml(who)+'</span><span class="mcSep"> : </span>':'')+escHtml(text);
  box.appendChild(d); while(box.children.length>60) box.removeChild(box.firstChild);
  box.scrollTop=box.scrollHeight; }
function addWhisperMsg(fromNick, toNick, text){ const box=document.getElementById('msChat'); if(!box) return;
  const d=document.createElement('div'); d.className='mcLine whisper';
  d.innerHTML=_mcTime()+'<span class="mcWhisper">'+escHtml(fromNick)+'<span class="mcArrow"> → </span>'+escHtml(toNick)+'</span><span class="mcSep"> : </span>'+escHtml(text);
  box.appendChild(d); while(box.children.length>60) box.removeChild(box.firstChild); box.scrollTop=box.scrollHeight; }
function findFriendByNick(nick){ const lo=(nick||'').toLowerCase(); for(const k in _friendIndex){ const f=_friendIndex[k]; if(f && (f.nick||'').toLowerCase()===lo) return f; } return null; }
async function sendWhisper(nick, msg){ const f=findFriendByNick(nick);
  if(RT.active && f && !f.temp && f.id){   // 실연동: messages 테이블에 저장 → 상대에게 실시간 전달
    try{ await _sb.from('messages').insert({ sender:myUid(), recipient:f.id, body:msg }); }catch(e){ console.warn('귓속말 전송 실패',e); lobbyToast('귓속말 전송 실패'); return; } }
  addWhisperMsg(myNick(), f?f.nick:nick, msg); }   // 보낸사람(나) → 받은사람
function sendGlobalChat(){ const inp=document.getElementById('msChatInput'); if(!inp) return; const t=(inp.value||'').trim(); if(!t) return;
  if(t[0]==='/'){ const m=t.slice(1).match(/^(\S+)\s+(?:-\s*)?([\s\S]+)$/);   // /닉네임 [-] 내용  → 귓속말(상대에게만)
    if(m && m[2].trim()){ sendWhisper(m[1], m[2].trim()); inp.value=''; return; }
    addGlobalMsg(null, '귓속말은  /닉네임 내용  형식으로 입력하세요', 'sys'); inp.value=''; return; }
  const sc=_chatScope;
  if(sc==='party' && !(typeof RT!=='undefined' && RT.partyId) && !(_party && _party.members && _party.members.length>1)){ lobbyToast('파티에 참여 중이 아닙니다'); return; }
  addGlobalMsg(myNick(), t, 'me', sc);
  if(RT.active && RT.lobby){ try{ RT.lobby.send({type:'broadcast', event:'chat', payload:{uid:myUid(), nick:myNick(), text:t, scope:sc, partyId:(sc==='party'?RT.partyId:null)}}); }catch(e){} }
  inp.value=''; }
function whisperFriend(id){ const f=_friendIndex[id]; if(!f) return; setBottomTab('chat');
  const inp=document.getElementById('msChatInput'); if(inp){ inp.value='/'+f.nick+' '; inp.focus(); const v=inp.value; try{ inp.setSelectionRange(v.length,v.length); }catch(e){} }
  lobbyToast(f.nick+'님에게 귓속말 작성'); }
function seedGlobalChat(){ const box=document.getElementById('msChat'); if(!box || box.children.length) return;
  const names=LOBBY_NAMES.slice().sort(()=>Math.random()-0.5);
  for(let i=0;i<4;i++) addGlobalMsg(names[i%names.length], GLOBAL_CHATTER[Math.floor(Math.random()*GLOBAL_CHATTER.length)]); }
function _gChatNext(){ _gChatT=setTimeout(()=>{ const n=LOBBY_NAMES[Math.floor(Math.random()*LOBBY_NAMES.length)];
  addGlobalMsg(n, GLOBAL_CHATTER[Math.floor(Math.random()*GLOBAL_CHATTER.length)]); _gChatNext(); }, 2600+Math.random()*3200); }
function startGlobalChat(){ stopGlobalChat(); if(RT.active) return; seedGlobalChat(); _gChatNext(); }   // 실시간 연결 시 봇 채팅 미사용
function stopGlobalChat(){ if(_gChatT){ clearTimeout(_gChatT); _gChatT=null; } }
// ══════════════════════════════════════════════════════════════
//  Supabase Realtime 소셜 모듈 (접속상태/로비채팅/귓속말DM/파티)
// ══════════════════════════════════════════════════════════════
const RT={ active:false, lobby:null, db:null, presence:{}, partyId:null };
let _rtStatus={ status:'online', map:'', since:0 }, _rtTouchT=null;
function myUid(){ return AUTH && AUTH.user && AUTH.user.uid; }
function _rtTrackPayload(){ return { uid:myUid(), nick:myNick(), tag:(AUTH.user&&AUTH.user.tag)||'', status:_rtStatus.status, map:_rtStatus.map, since:_rtStatus.since||Date.now() }; }
async function rtStart(){ if(!sbReady() || RT.active) return; RT.active=true; _rtStatus={ status:'online', map:'', since:Date.now() };
  try{
    RT.lobby=_sb.channel('lobby', { config:{ presence:{ key:myUid() } } });
    RT.lobby.on('presence',{event:'sync'}, rtRebuildPresence)
      .on('broadcast',{event:'chat'}, function(m){ const p=(m&&m.payload)||{}; if(p.uid===myUid()) return; const sc=p.scope||'all';
        if(sc==='party'){ if(RT.partyId && RT.partyId===p.partyId) addGlobalMsg(p.nick, p.text, null, 'party'); }
        else if(sc==='friend'){ if(_friendIndex[p.uid]) addGlobalMsg(p.nick, p.text, null, 'friend'); }
        else addGlobalMsg(p.nick, p.text, null, 'all'); })
      .on('broadcast',{event:'party_room'}, function(m){ const p=(m&&m.payload)||{}; if(p.partyId && p.partyId===RT.partyId && p.from!==myUid()) followPartyRoom(p.room); })
      .on('broadcast',{event:'party_start'}, function(m){ const p=(m&&m.payload)||{}; if(p.partyId && p.partyId===RT.partyId && p.from!==myUid()){ const lb=document.getElementById('lobby'); if(lb && !lb.classList.contains('hide')) lobbyStart(); } })
      .on('broadcast',{event:'roomchat'}, function(m){ const p=(m&&m.payload)||{}; if(p.from===myUid()) return;   // 대기실 채팅 공유
        const lb=document.getElementById('lobby'); if(lb && !lb.classList.contains('hide') && _lobbyRoom && _lobbyRoom.num===p.num) addLobbyMsg(p.nick, p.text, p.color); })
      .subscribe(function(st){ if(st==='SUBSCRIBED'){ RT.lobby.track(_rtTrackPayload()); } });
    RT.db=_sb.channel('db-'+myUid())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'party_invites',filter:'to_uid=eq.'+myUid()}, function(e){ onPartyInvite(e.new); })
      .on('postgres_changes',{event:'*',schema:'public',table:'party_members'}, function(e){ const r=e.new||e.old||{}; if(RT.partyId && r.party_id===RT.partyId) rtSyncParty(); })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'recipient=eq.'+myUid()}, function(e){ onIncomingDM(e.new); })
      .subscribe();
    rtTouchLastSeen(); if(_rtTouchT) clearInterval(_rtTouchT); _rtTouchT=setInterval(rtTouchLastSeen, 60000);
  }catch(e){ console.warn('rtStart 실패', e); RT.active=false; } }
function rtStop(){ try{ if(RT.lobby) _sb.removeChannel(RT.lobby); if(RT.db) _sb.removeChannel(RT.db); }catch(e){}
  RT.lobby=null; RT.db=null; RT.active=false; RT.presence={}; RT.partyId=null; if(_rtTouchT){ clearInterval(_rtTouchT); _rtTouchT=null; } }
async function rtTouchLastSeen(){ if(!sbReady()) return; try{ await _sb.from('profiles').update({ last_seen:new Date().toISOString() }).eq('id', myUid()); }catch(e){} }
function rtRebuildPresence(){ if(!RT.lobby) return; let st={}; try{ st=RT.lobby.presenceState(); }catch(e){ return; }
  const map={}; Object.keys(st).forEach(function(k){ const s=st[k]&&st[k][0]; if(s&&s.uid) map[s.uid]={ status:s.status||'online', map:s.map||'', since:s.since||Date.now() }; });
  RT.presence=map; if(_bottomTab==='friend') renderFriendList(); else if(_bottomTab==='party') renderPartyTab(); }
async function rtSetStatus(status, mapName){ _rtStatus={ status:status||'online', map:mapName||'', since:Date.now() };
  try{ if(RT.lobby) await RT.lobby.track(_rtTrackPayload()); }catch(e){} }
const _nickCache={};
async function resolveNick(uid){ if(!uid) return '상대';
  const f=_friendIndex[uid]; if(f&&f.nick) return f.nick;
  if(_nickCache[uid]) return _nickCache[uid];
  try{ const {data}=await _sb.from('profiles').select('nick').eq('id',uid).maybeSingle(); if(data&&data.nick){ _nickCache[uid]=data.nick; return data.nick; } }catch(e){}
  return '상대'; }
async function onIncomingDM(row){ if(!row) return;
  const nick=await resolveNick(row.sender);   // 보낸 사람 닉네임(친구 아니어도 프로필에서 조회)
  addWhisperMsg(nick, myNick(), row.body); if(_bottomTab!=='chat') lobbyToast(nick+'님의 귓속말 도착'); }   // 보낸사람 → 받은사람(나)
// ── 파티(테이블 + 실시간) ──
async function rtEnsurePartyDB(){ if(RT.partyId) return RT.partyId;
  const ins=await _sb.from('parties').insert({ leader:myUid() }).select('id').single(); if(ins.error) throw ins.error;
  RT.partyId=ins.data.id;
  await _sb.from('party_members').insert({ party_id:RT.partyId, uid:myUid(), nick:myNick(), tag:(AUTH.user&&AUTH.user.tag)||'' });
  return RT.partyId; }
async function rtSyncParty(){ if(!RT.partyId) return;
  try{ const mem=await _sb.from('party_members').select('uid,nick,tag').eq('party_id', RT.partyId);
    const par=await _sb.from('parties').select('leader').eq('id', RT.partyId).single();
    const leader=par.data&&par.data.leader;
    if(!mem.data || !mem.data.length){ _party=null; RT.partyId=null; }
    else _party={ members:mem.data.map(function(m){ return { uid:m.uid, nick:m.nick, tag:m.tag, leader:m.uid===leader }; }) };
    if(_bottomTab==='party') renderPartyTab();
  }catch(e){ console.warn('파티 동기화 실패', e); } }
function onPartyInvite(row){ if(!row) return; showPartyInvitePrompt(row); }
function showPartyInvitePrompt(row){ const host=document.getElementById('mapSelect'); if(!host) return;
  let ov=document.getElementById('ptPromptOv');
  if(!ov){ ov=document.createElement('div'); ov.id='ptPromptOv'; ov.className='foCtxOv'; host.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.classList.add('hide'); }); }
  ov.classList.remove('hide');
  ov.innerHTML='<div class="foCtxCard"><div class="foCtxHead">'+avatarHTML(row.from_nick||'?','fAva','online')
    +'<span class="foCtxName">'+escHtml(row.from_nick||'친구')+'<span class="fTag"> 님의 파티 초대</span></span></div>'
    +'<button class="foCtxBtn favon" onclick="rtAcceptInvite(\''+row.id+'\',\''+row.party_id+'\')">'+ICO.join+'<span>파티 참가</span></button>'
    +'<button class="foCtxBtn warn" onclick="rtDeclineInvite(\''+row.id+'\')">'+ICO.flag+'<span>거절</span></button></div>'; }
async function rtAcceptInvite(inviteId, partyId){ popHide('ptPromptOv');
  try{ if(RT.partyId && RT.partyId!==partyId) await rtLeavePartyDB();   // 기존 파티 떠나기
    RT.partyId=partyId;
    await _sb.from('party_members').insert({ party_id:partyId, uid:myUid(), nick:myNick(), tag:(AUTH.user&&AUTH.user.tag)||'' });
    await _sb.from('party_invites').update({ status:'accepted' }).eq('id', inviteId);
    await rtSyncParty(); setBottomTab('party'); lobbyToast('파티에 참가했어요');
  }catch(e){ console.warn('파티 참가 실패', e); lobbyToast('파티 참가 실패'); } }
async function rtDeclineInvite(inviteId){ popHide('ptPromptOv');
  try{ await _sb.from('party_invites').update({ status:'declined' }).eq('id', inviteId); }catch(e){} }
async function rtLeavePartyDB(){ if(!RT.partyId) return; try{ await _sb.from('party_members').delete().eq('party_id', RT.partyId).eq('uid', myUid()); }catch(e){} RT.partyId=null; }
// ── 파티와 함께 방 입장 ──
function iAmPartyLeader(){ return !!(_party && _party.members && _party.members.some(function(m){ return m.uid===myUid() && m.leader; })); }
function inPartyNow(){ return !!(_party && _party.members && _party.members.length>1); }   // 2명 이상이면 파티 상태
function partySize(){ return inPartyNow() ? _party.members.length : 1; }
function rtSendPartyRoom(room){ if(!RT.active || !RT.lobby || !RT.partyId) return;
  try{ RT.lobby.send({ type:'broadcast', event:'party_room', payload:{ partyId:RT.partyId, from:myUid(), room:Object.assign({ party:true }, room) } }); }catch(e){} }
function followPartyRoom(room){ if(!room) return;
  if(typeof rtSetStatus==='function') rtSetStatus('ingame', room.map||'');
  lobbyToast('파티장이 방에 입장 — 함께 입장합니다');
  hideAppScreens(); openLobby(Object.assign({}, room, { party:true, joining:true })); }
// ── Supabase 소셜: 프로필(닉#코드) + 친구 ──
function sbReady(){ return AUTH.mode==='supabase' && _sb && AUTH.user && AUTH.user.uid; }
function randTag(){ return ('000'+Math.floor(Math.random()*10000)).slice(-4); }   // 4자리 개별 코드
function tagHTML(nick, tag){ return '<span class="foNick">'+escHtml(nick||'(알수없음)')+(tag?'<span class="foTag">#'+escHtml(tag)+'</span>':'')+'</span>'; }
async function sbEnsureProfile(){ if(!sbReady()) return;
  try{ const {data}=await _sb.from('profiles').select('nick,tag').eq('id',AUTH.user.uid).maybeSingle();
    if(!data){ const tag=randTag(); await _sb.from('profiles').insert({id:AUTH.user.uid, nick:AUTH.user.nick, tag}); AUTH.user.tag=tag; }
    else { const patch={}; if(data.nick!==AUTH.user.nick) patch.nick=AUTH.user.nick; if(!data.tag) patch.tag=randTag();
      if(Object.keys(patch).length) await _sb.from('profiles').update(patch).eq('id',AUTH.user.uid);
      AUTH.user.tag = data.tag || patch.tag; } }
  catch(e){ console.warn('ensureProfile', e.message||e); }
  if(typeof updateMyNameTag==='function') updateMyNameTag();   // 코드 로드 후 헤더 갱신
  if(typeof RT!=='undefined' && RT.active && RT.lobby){ try{ RT.lobby.track(_rtTrackPayload()); }catch(e){} } }   // 프레즌스에 코드 반영
// ── 메타(포인트·강화) 서버 저장: profiles.meta(jsonb)에 계정별 저장 → 다른 기기에서도 포인트·강화 유지 ──
async function sbSaveMeta(){ if(!sbReady()||!(AUTH.user&&AUTH.user.uid)) return;
  try{ await _sb.from('profiles').update({ meta: PLAYER_META }).eq('id', AUTH.user.uid); }
  catch(e){ console.warn('메타 서버 저장 실패(profiles.meta jsonb 컬럼 필요)', e.message||e); } }
let _metaSaveT=null;
function sbSaveMetaDebounced(){ if(!sbReady()||!(AUTH.user&&AUTH.user.uid)) return; clearTimeout(_metaSaveT); _metaSaveT=setTimeout(sbSaveMeta, 1500); }
async function sbSyncMetaOnLogin(){ if(!sbReady()||!(AUTH.user&&AUTH.user.uid)) return;
  try{ const {data}=await _sb.from('profiles').select('meta').eq('id',AUTH.user.uid).maybeSingle();
    const sm=data&&data.meta;
    if(sm && typeof sm==='object'){ PLAYER_META=Object.assign(defaultMeta(), sm); if(!PLAYER_META.buildLevels) PLAYER_META.buildLevels={};
      migrateProfile();   // ⚠ 서버 메타는 구버전(ver2, 캐릭터 1명)일 수 있다 — 여기서 안 올리면 마을에 들어가기 전까지 CHAR()가 null이라 판 보상 경험치가 사라진다
      try{ localStorage.setItem(metaKey(), JSON.stringify(PLAYER_META)); }catch(e){} }   // 서버 메타 우선 → 로컬 캐시
    else { await sbSaveMeta(); }   // 서버에 없으면 현재(로컬) 메타 업로드
    if(typeof G!=='undefined' && G) G.metaB=metaBonus(); }
  catch(e){ console.warn('메타 서버 로드 실패', e.message||e); } }
async function sbSearchUser(query){ query=(query||'').trim(); if(!query) return [];
  let q=_sb.from('profiles').select('id,nick,tag').neq('id',AUTH.user.uid).limit(12);
  const h=query.lastIndexOf('#');
  if(h>0) q=q.eq('nick',query.slice(0,h).trim()).eq('tag',query.slice(h+1).replace(/[^0-9]/g,''));   // 닉#코드 = 정확 검색
  else q=q.eq('nick',query);   // 닉만 = 동명이인 전부(코드로 구분)
  const {data,error}=await q; if(error) throw error; return data||[]; }
async function sbSendFriendReq(targetId){ const {error}=await _sb.from('friendships').insert({requester:AUTH.user.uid, addressee:targetId, status:'pending'}); if(error) throw error; }
async function sbRespondReq(fid, accept){ if(accept){ const {error}=await _sb.from('friendships').update({status:'accepted'}).eq('id',fid); if(error) throw error; }
  else { const {error}=await _sb.from('friendships').delete().eq('id',fid); if(error) throw error; } }
async function sbRemoveFriend(fid){ const {error}=await _sb.from('friendships').delete().eq('id',fid); if(error) throw error; }
async function sbLoadFriends(){
  const {data,error}=await _sb.from('friendships').select('id,requester,addressee,status').or('requester.eq.'+AUTH.user.uid+',addressee.eq.'+AUTH.user.uid);
  if(error) throw error; const rows=data||[];
  const others=[...new Set(rows.map(r=> r.requester===AUTH.user.uid? r.addressee : r.requester))];
  let profs={}; if(others.length){ const {data:pd}=await _sb.from('profiles').select('id,nick,tag,last_seen').in('id',others); (pd||[]).forEach(p=>profs[p.id]={nick:p.nick,tag:p.tag,last_seen:p.last_seen}); }
  const friends=[], incoming=[], outgoing=[];
  for(const r of rows){ const oid=r.requester===AUTH.user.uid? r.addressee : r.requester, pr=profs[oid]||{nick:'(알수없음)',tag:''};
    const item={fid:r.id,id:oid,nick:pr.nick,tag:pr.tag,last_seen:pr.last_seen};
    if(r.status==='accepted') friends.push(item);
    else if(r.addressee===AUTH.user.uid) incoming.push(item);
    else outgoing.push(item); }
  return {friends, incoming, outgoing}; }
function updateFriendBadge(n){ const b=document.getElementById('msFriendBadge'); if(!b) return; if(n>0){ b.textContent=n; b.classList.remove('hide'); } else b.classList.add('hide'); }
async function refreshFriendBadge(){ if(!sbReady()) return; try{ const {incoming}=await sbLoadFriends(); updateFriendBadge(incoming.length); }catch(e){} }
// ── 친구 오버레이 ──
// 하단 영역 탭 전환(채팅/파티/친구)
let _bottomTab='chat';
function setBottomTab(t){ _bottomTab=t;
  if(t!=='party'){ if(typeof closePartyInvite==='function') closePartyInvite(); if(typeof closePartyFind==='function') closePartyFind(); }
  if(t!=='friend'){ if(typeof closeFriendCtx==='function') closeFriendCtx(); if(typeof closeFriendAdd==='function') closeFriendAdd(); }
  document.querySelectorAll('.msTab2').forEach(b=>b.classList.toggle('on', b.dataset.bt===t));
  const wrap=document.getElementById('msChatWrap'), chat=document.getElementById('msChat'), panel=document.getElementById('msPanelBody');
  if(!wrap||!chat||!panel) return;
  if(t==='chat'){ wrap.style.display='flex'; panel.style.display='none'; chat.scrollTop=chat.scrollHeight; }
  else { wrap.style.display='none'; panel.style.display='block';
    // ⛔ 게시판을 자동으로 띄우지 않는다 — 탭을 누를 때마다 판이 덮여 내 파티가 안 보였다.
    //    들어가는 길은 머리줄의 '파티 찾기' 버튼 하나뿐이다.
    if(t==='party') renderPartyTab();
    else renderFriendList(); } }
   // 구버전 호환
// ── 임시 친구(기능 확인용) + 파티(내가 초대하면 무조건 수락) ──
const _tempFriends=[
  {uid:'tmp_nan',   nick:'단짝',   tag:'0042', status:'online',  fav:true},
  {uid:'tmp_yeon',  nick:'연습친구', tag:'0001', status:'online',  fav:true},
  {uid:'tmp_old',   nick:'옛친구',  tag:'0107', status:'offline'},
  {uid:'tmp_guild', nick:'길드원',  tag:'0233', status:'offline'} ];
function tempFriendItems(){ return _tempFriends.map(t=>({fid:'temp_'+t.uid, id:t.uid, nick:t.nick, tag:t.tag, temp:true, status:t.status, fav:t.fav, busy:t.busy})); }
// 모의 데이터용 id 해시(실제 프레즌스 백엔드 전까지)
function _fh(f,salt){ const id=(f&&(f.id||f.uid||f.fid))||''; let s=salt>>>0; for(let i=0;i<id.length;i++) s=(s*31+id.charCodeAt(i))>>>0; return s; }
// 친구 접속 상태 — online/ingame/offline (실연동 시 RT.presence 우선)
function presenceOf(f){ if(f && f.status) return f.status;   // 명시(임시친구)
  const id=f&&(f.id||f.uid);
  if(typeof RT!=='undefined' && RT.active && id && !(f&&f.temp)){ const p=RT.presence[id]; return p? (p.status||'online') : 'offline'; }
  const r=_fh(f,0)%3; return r===0?'online':(r===1?'ingame':'offline'); }
function statusRank(st){ return st==='online'?0:(st==='ingame'?1:2); }
function statusLabel(st){ return st==='online'?'접속중':(st==='ingame'?'게임중':'오프라인'); }
function friendBusy(f){ if(f && f.busy!=null) return !!f.busy; if(presenceOf(f)!=='online') return false;
  if(typeof RT!=='undefined' && RT.active && !(f&&f.temp)) return false;   // 실연동: 타인의 파티 상태는 추적 안 함
  return _fh(f,5)%4===0; }
function getFriendFavs(){ return _lsGet('nm_friend_favs', {}); }
function friendFav(f){ const id=f&&(f.id||f.uid); const favs=getFriendFavs(); if(id && favs[id]!==undefined) return !!favs[id]; return !!(f&&f.fav); }   // 사용자 지정 우선, 없으면 기본값
function toggleFavFriend(id){ const favs=getFriendFavs(); favs[id]=!friendFav(_friendIndex[id]||{id}); _lsSet('nm_friend_favs',favs);
  if(_bottomTab==='friend') renderFriendList(); const ov=document.getElementById('ptInviteOv'); if(ov && !ov.classList.contains('hide')) renderPartyInviteList(); }
function ingameMapName(f){ const id=f&&(f.id||f.uid);
  if(typeof RT!=='undefined' && RT.active && id){ const p=RT.presence[id]; if(p&&p.map) return p.map; }
  const real=MAPS.slice(0,6); return real[_fh(f,3)%real.length].name; }
function playTimeText(f){ let m; const id=f&&(f.id||f.uid);
  if(typeof RT!=='undefined' && RT.active && id){ const p=RT.presence[id]; if(p&&p.since) m=Math.max(1, Math.floor((Date.now()-p.since)/60000)); }
  if(m==null) m=1+_fh(f,11)%119;
  return m<60 ? m+'분째' : Math.floor(m/60)+'시간 '+(m%60)+'분째'; }
function lastSeenText(f){ let m;
  if(f && f.last_seen){ m=Math.max(0, Math.floor((Date.now()-new Date(f.last_seen).getTime())/60000)); }
  else if(typeof RT!=='undefined' && RT.active && !(f&&f.temp)){ return '오래 전'; }   // 실연동인데 기록 없음
  else m=_fh(f,7)%2880;
  if(m<1) return '방금'; if(m<60) return m+'분 전'; if(m<1440) return Math.floor(m/60)+'시간 전'; return Math.floor(m/1440)+'일 전'; }
// 닉 기반 색상 이니셜 아바타
function avatarColor(nick){ let s=0,n=nick||'?'; for(let i=0;i<n.length;i++) s=(s*31+n.charCodeAt(i))>>>0; const h=s%360;
  return {bg:'hsl('+h+' 42% 25%)', fg:'hsl('+h+' 78% 80%)', bd:'hsl('+h+' 55% 44%)'}; }
function avatarInitial(nick){ const t=(nick||'?').trim(); return t? t[0] : '?'; }
// 게스트·닉 없음 = 이니셜 대신 **자리표시 초상**. 다른 아이콘과 계열이 다르다(원형 디스크 · 평면 2톤 · 저채도) —
//   옆 줄의 색 이니셜 원보다 조용해야 '아직 아무도 아니다'로 읽힌다.
// ⚠ 파일이 없으면 `onerror` 가 <img> 만 지우고 **밑에 깔린 이니셜이 그대로 드러난다** — 칸이 비지 않는다.
//   (아이콘 README 의 폴백 철학과 같다: 파일을 넣는 순간 그 자리만 교체된다)
const AVATAR_GUEST_SRC='assets/icons/av_guest.webp';
function avatarHTML(nick, cls, st, guest){ const c=avatarColor(nick); const dot=st?'<span class="fAvaDot fDot-'+st+'"></span>':'';
  const anon=!!guest || !String(nick||'').trim();
  // ⚠ 색은 **인라인**으로 나간다 — CSS 로 `.fAva.guest{border-color:…}` 를 써 봐야 인라인에 진다(실제로 남색 링이 남았다).
  //   자리표시일 때는 여기서 바로 중성색을 쓴다. 닉 색은 '사람을 구분하는 색'이라 아직 아무도 아닌 자리에 쓰면 안 된다.
  const sty=anon ? 'background:#20252c;color:#77828f;border-color:rgba(255,255,255,.10)'
                 : 'background:'+c.bg+';color:'+c.fg+';border-color:'+c.bd;
  return '<span class="fAva '+(anon?'guest ':'')+(cls||'')+'" style="'+sty+'">'
    +escHtml(avatarInitial(nick))
    +(anon?'<img class="fAvaImg" src="'+AVATAR_GUEST_SRC+'" alt="" draggable="false" onerror="this.remove()">':'')
    +dot+'</span>'; }
// 친구 상태 한 줄 설명(접속중/게임중·맵·시간/오프라인·마지막접속/파티중)
function friendStatusSub(f){ const st=presenceOf(f); if(friendBusy(f)) return '다른 파티에 있음';
  if(st==='online') return '접속 중'; if(st==='ingame') return ingameMapName(f)+' · '+playTimeText(f); return '마지막 접속 '+lastSeenText(f); }
// 아바타 + 2줄 메타(상태 표시) 공통 행 — right에 우측 버튼/라벨 전달
function friendCellHTML(f, right, rowAttrs){ const st=presenceOf(f), fav=friendFav(f);
  return '<div class="foRow ptRow'+(st==='offline'?' off':'')+'" '+(rowAttrs||'')+' data-nm="'+escHtml((f.nick+'#'+(f.tag||'')).toLowerCase())+'">'
    +avatarHTML(f.nick,'fAva',st)
    +'<span class="fMeta"><span class="fL1">'+escHtml(f.nick)+'<span class="fTag">#'+escHtml(f.tag||'----')+'</span>'+(fav?'<span class="fStar" title="즐겨찾기">★</span>':'')+'</span>'
    +'<span class="fL2 fL2-'+st+'">'+escHtml(friendStatusSub(f))+'</span></span>'+(right||'')+'</div>'; }
// 접속 상태가 1순위 — 목록이 '밝은 상자 → 어두운 상자'로 자연히 갈린다(섹션 라벨을 없앤 대가).
// 즐겨찾기는 같은 상태 안에서만 위로 올린다.
function friendSortCmp(a,b){ return statusRank(presenceOf(a))-statusRank(presenceOf(b)) || (friendFav(a)?0:1)-(friendFav(b)?0:1); }
// 친구 행 우측 액션(즐겨찾기 토글 / 파티 초대·참가 / 귓속말)
function friendActions(f){ const id=f.id||f.uid, st=presenceOf(f), busy=friendBusy(f);
  let h='<span class="foActs">';
  if(busy) h+='<button class="foAct" title="파티 참가" onclick="joinFriendParty(\''+id+'\')">'+ICO.join+'</button>';
  else if(st==='online' && !inParty(id)) h+='<button class="foAct" title="파티 초대" onclick="partyInvite(\''+id+'\')">'+ICO.invite+'</button>';
  else h+='<button class="foAct dis" title="초대 불가" disabled>'+ICO.invite+'</button>';
  h+='<button class="foAct" title="메시지 보내기" onclick="whisperFriend(\''+id+'\')">'+ICO.mail+'</button>';
  return h+'</span>'; }
function joinFriendParty(id){ const f=_friendIndex[id]; lobbyToast((f?f.nick:'친구')+'님의 파티에 참가 신청을 보냈어요'); }
// whisperFriend는 전체 채팅 영역에서 정의됨
// 프로필 꾹 누르기 → 컨텍스트 메뉴(프로필 삭제 / 사용자 신고)
let _lpTimer=null;
function lpStart(ev, id){ if(ev.target && ev.target.closest && ev.target.closest('button')) return; lpEnd();
  _lpTimer=setTimeout(function(){ _lpTimer=null; openFriendCtx(id); }, 500); }
function lpEnd(){ if(_lpTimer){ clearTimeout(_lpTimer); _lpTimer=null; } }
function openFriendCtx(id){ const f=_friendIndex[id]; if(!f) return; const host=document.getElementById('mapSelect'); if(!host) return;
  let ov=document.getElementById('foCtxOv');
  if(!ov){ ov=document.createElement('div'); ov.id='foCtxOv'; ov.className='foCtxOv'; host.appendChild(ov);
    ov.addEventListener('click', e=>{ if(e.target===ov) closeFriendCtx(); }); }
  ov.classList.remove('hide');
  const fav=friendFav(f);
  ov.innerHTML='<div class="foCtxCard"><div class="foCtxHead">'+avatarHTML(f.nick,'fAva',presenceOf(f))
    +'<span class="foCtxName">'+escHtml(f.nick)+'<span class="fTag">#'+escHtml(f.tag||'----')+'</span></span></div>'
    +'<button class="foCtxBtn'+(fav?' favon':'')+'" onclick="ctxToggleFav(\''+id+'\')">'+ICO.fav+'<span>'+(fav?'즐겨찾기 해제':'즐겨찾기 추가')+'</span></button>'
    +'<button class="foCtxBtn" onclick="ctxDeleteFriend(\''+id+'\')">'+ICO.trash+'<span>프로필 삭제</span></button>'
    +'<button class="foCtxBtn warn" onclick="ctxReportFriend(\''+id+'\')">'+ICO.flag+'<span>사용자 신고</span></button></div>'; }
function ctxToggleFav(id){ const f=_friendIndex[id]; const wasFav=friendFav(f||{id}); closeFriendCtx(); toggleFavFriend(id);
  lobbyToast(wasFav?'즐겨찾기를 해제했어요':'즐겨찾기에 추가했어요'); }
function closeFriendCtx(){ popHide('foCtxOv'); }
function ctxDeleteFriend(id){ const f=_friendIndex[id]; closeFriendCtx(); if(!f) return;
  if(f.temp){ const i=_tempFriends.findIndex(t=>t.uid===id); if(i>=0) _tempFriends.splice(i,1); lobbyToast(f.nick+' 친구를 삭제했어요'); if(_bottomTab==='friend') renderFriendList(); }
  else { friendRemove(f.fid); lobbyToast(f.nick+' 친구를 삭제했어요'); } }
function ctxReportFriend(id){ const f=_friendIndex[id]; closeFriendCtx(); lobbyToast((f?f.nick:'사용자')+'님을 신고했어요'); }
// 로비 토스트
let _toastT=null;
function lobbyToast(msg){ const host=document.getElementById('mapSelect')||document.body;
  let t=document.getElementById('lobbyToast'); if(!t){ t=document.createElement('div'); t.id='lobbyToast'; t.className='lobbyToast'; host.appendChild(t); }
  t.textContent=msg; t.classList.add('show'); if(_toastT) clearTimeout(_toastT); _toastT=setTimeout(function(){ t.classList.remove('show'); }, 1800); }
let _friendIndex={};
function indexFriends(arr){ (arr||[]).forEach(f=>{ if(f&&(f.id||f.uid)) _friendIndex[f.id||f.uid]=f; }); }
async function loadAllFriends(){ let real=[]; if(sbReady()){ try{ const {friends}=await sbLoadFriends(); real=friends; }catch(e){} }
  const all=real.concat(tempFriendItems()); indexFriends(all); return all; }
let _party=null, _invitableCache=[];
function ensureParty(){ if(!_party) _party={members:[{uid:(AUTH.user&&AUTH.user.uid)||'me', nick:myNick(), tag:(AUTH.user&&AUTH.user.tag)||'', leader:true}]}; return _party; }
function inParty(uid){ return ensureParty().members.some(m=>m.uid===uid); }
const PARTY_MAX=8;
// '파티를 꾸린 상태'인가 — 이름이 붙었거나(만들기·참가) 나 말고 누가 더 있으면 파티다.
// 파티 탭에 들어왔을 때 게시판을 자동으로 띄울지 여기서 갈린다.
function hasParty(){ return !!(_party && (_party.name || _party.members.length>1)); }
function iAmLeader(){ const m=_party&&_party.members&&_party.members[0]; return !_party || !!(m&&m.leader&&m.uid===myUid2()); }
function myUid2(){ return (AUTH.user&&AUTH.user.uid)||'me'; }
async function partyInvite(uid){ const f=_invitableCache.find(x=>x.id===uid) || _friendIndex[uid]; if(!f) return; if(inParty(uid)) return;
  if(RT.active && !f.temp && f.id){   // 실연동: 초대장 전송 → 상대가 수락해야 합류
    try{ await rtEnsurePartyDB();
      const mem=await _sb.from('party_members').select('uid',{count:'exact',head:true}).eq('party_id',RT.partyId);
      if((mem.count||1)>=PARTY_MAX){ lobbyToast('파티가 가득 찼어요'); return; }
      await _sb.from('party_invites').insert({ party_id:RT.partyId, from_uid:myUid(), from_nick:myNick(), to_uid:f.id });
      await rtSyncParty(); lobbyToast(f.nick+'님에게 파티 초대를 보냈어요');
    }catch(e){ console.warn('파티 초대 실패',e); lobbyToast('파티 초대 실패'); }
    const ov0=document.getElementById('ptInviteOv'); if(ov0 && !ov0.classList.contains('hide')) renderPartyInviteList();
    return; }
  ensureParty(); if(_party.members.length>=PARTY_MAX){ lobbyToast('파티가 가득 찼어요'); return; }   // 임시친구: 로컬 즉시 합류
  _party.members.push({uid:f.id, nick:f.nick, tag:f.tag, leader:false}); lobbyToast(f.nick+'님을 파티에 초대했어요');
  if(_bottomTab==='party') renderPartyTab(); else if(_bottomTab==='friend') renderFriendList();
  const ov=document.getElementById('ptInviteOv'); if(ov && !ov.classList.contains('hide')) renderPartyInviteList(); }
async function partyKick(uid){ if(RT.active && RT.partyId){ try{ await _sb.from('party_members').delete().eq('party_id',RT.partyId).eq('uid',uid); await rtSyncParty(); }catch(e){ console.warn(e); } return; }
  if(!_party) return; _party.members=_party.members.filter(m=>m.leader||m.uid!==uid); renderPartyTab(); }
async function partyDisband(){ closePartyInvite();
  if(RT.active && RT.partyId){ try{ await _sb.from('parties').delete().eq('id',RT.partyId); }catch(e){ console.warn(e); } RT.partyId=null; }
  pbLeave();                       // 게시판에 올라가 있던 자리도 되돌린다
  _party=null; renderPartyTab(); }
async function renderPartyTab(){ const body=document.getElementById('msPanelBody'); if(!body) return;
  // 게스트도 본다 — 로컬 파티 + 임시 친구 초대는 sb 없이 동작한다(실연동 초대만 rtEnsurePartyDB 쪽에서 갈린다)
  ensureParty();
  // ⛔ 빈 자리를 칸으로 늘어놓지 않는다(2026-08-18). 1명일 때 '＋ 친구 초대'가 **일곱 번** 반복돼
  //   본문의 대부분이 정보 0인 반복 문구였다. 사람만 칸으로 두고, 빈 자리는 아래 한 줄이 대신 말한다.
  let cells='';
  _party.members.forEach(function(m){ cells+='<div class="ptSlot fill'+(m.leader?' leader':'')+'">'
      +avatarHTML(m.nick,'ptAva')
      +'<span class="ptName"><b class="ptNick">'+escHtml(m.nick)+'</b><em class="ptRole">'+(m.leader?'파티장':'#'+(m.tag||'----'))+'</em></span>'
      +((m.leader||!iAmLeader())?'':'<button class="ptKick" onclick="partyKick(\''+m.uid+'\')" title="내보내기">✕</button>')
      +'</div>'; });
  const open=PARTY_MAX-_party.members.length;
  const invite = open ? '<div class="ptInviteLine" onclick="openPartyInvite()"><span class="ptAddAv">+</span>'
    +'<span>친구 초대</span><em>빈자리 '+open+'</em></div>' : '';
  // 머리 = [파티 이름 n/8] … [파티 찾기] [해제|나가기]. 게시판(이전 단계)으로 가는 길을 늘 열어 둔다.
  const lead=iAmLeader();
  const dis=hasParty() ? '<button class="ptDisband" onclick="partyDisband()">'+(lead?'파티 해제':'파티 나가기')+'</button>' : '';
  body.innerHTML='<div class="ptHead"><span class="ptTitle">'+escHtml(_party.name||'내 파티')+' <b>'+_party.members.length+'</b> / '+PARTY_MAX+'</span>'
    +'<span class="ptHeadBtns"><button class="ptFind" onclick="openPartyFind()">파티 찾기</button>'+dis+'</span></div>'
    +'<div class="ptGrid">'+cells+'</div>'+invite; }
// ══════════════════════════════════════════════════════════════════════════
// 🎪 파티 게시판 — 파티 탭의 '이전 단계'
// ──────────────────────────────────────────────────────────────────────────
//  · 유즈맵과 무관한 **자유 파티**다. 사람을 먼저 모으고 뭘 할지는 모여서 정한다
//    (그래서 한 파티로 여러 맵을 몰려다닐 수 있다).
//  · 파티 탭에 들어왔는데 파티가 없으면 이 게시판이 먼저 뜬다 → 찾아 들어가거나 만든다.
//  · ⚠ 서버 parties 테이블에는 이름·공개 칼럼이 없다. 지금은 로컬 게시판(임시친구와 같은 결)이고,
//    실연동은 parties 에 name/open 을 추가한 뒤 pbRooms()/pbJoin() 둘만 갈아 끼우면 된다.
// ══════════════════════════════════════════════════════════════════════════
const PB_DEMO=[
  {id:'pb1', name:'초보 환영 파티',  mates:['별빛','도토리','한여름']},
  {id:'pb2', name:'네모네모 같이',   mates:['각설탕','폭풍전야','미르','청현','노을']},
  {id:'pb3', name:'같이 돌실 분',    mates:['라온']},
  {id:'pb4', name:'가시탑 정복대',   mates:['흑기사','바람돌이','세인','유월','단하','겨울잠','솔']},
  {id:'pb5', name:'풀방 갑니다',     mates:['해준','민트초코','가랑비','토리','설아','은하','우주','한별']},
  {id:'pb6', name:'오토배틀 연구소', mates:['계산기','전략가']},
  {id:'pb7', name:'조용히 하실 분',  mates:['묵묵']},
  {id:'pb8', name:'유즈맵 순례단',   mates:['방랑','나침반','오후세시','기록자']},
];
let _pbRooms=null, _pbMaking=false;
function pbRooms(){ if(!_pbRooms) _pbRooms=PB_DEMO.map(function(r){ return {id:r.id, name:r.name, mates:r.mates.slice()}; });
  return _pbRooms; }
function pbFind(id){ return pbRooms().filter(function(r){ return r.id===id; })[0]||null; }
function pbMineId(){ return (_party&&_party.pbId)||null; }
// 내가 들어가 있으면 한 명 더 센다. 내가 만든 방은 실제 파티 인원이 곧 정원이다.
function pbCount(r){ if(r.mine) return (_party&&_party.members.length)||1;
  return r.mates.length + (r.joined?1:0); }
// 게시판에서 내 자리를 뺀다 — 방을 옮기거나 파티를 해제할 때 양쪽에서 부른다(한쪽만 하면 인원이 샌다)
function pbLeave(){ const id=pbMineId(); if(!id) return; const r=pbFind(id); if(!r) return;
  if(r.mine) _pbRooms=_pbRooms.filter(function(x){ return x!==r; }); else r.joined=false; }
function pbMeMember(lead){ return {uid:myUid2(), nick:myNick(), tag:(AUTH.user&&AUTH.user.tag)||'', leader:!!lead}; }
function pbJoin(id){ const r=pbFind(id); if(!r) return;
  if(pbMineId()===r.id) return;
  if(pbCount(r)>=PARTY_MAX){ lobbyToast('파티가 가득 찼어요'); return; }
  pbLeave();                                   // 다른 파티에 있었다면 먼저 빠진다
  r.joined=true;
  _party={ pbId:r.id, name:r.name,
    members:r.mates.map(function(nk,i){ return {uid:'pb_'+r.id+'_'+i, nick:nk, tag:'', leader:i===0}; }).concat([pbMeMember(false)]) };
  closePartyFind(); renderPartyTab(); if(typeof playSfx==='function') playSfx('ui_confirm');
  lobbyToast('"'+r.name+'" 파티에 참가했어요'); }
function pbToggleMake(){ _pbMaking=!_pbMaking; renderPartyFind(); }
function pbCreate(){ const inp=document.getElementById('pbNameInput');
  const name=((inp&&inp.value)||'').trim().slice(0,18) || (myNick()+'님의 파티');
  pbLeave();
  _party={ pbId:'pb_my', name:name, members:[pbMeMember(true)] };
  _pbRooms=pbRooms().filter(function(r){ return r.id!=='pb_my'; });
  _pbRooms.unshift({id:'pb_my', name:name, mates:[myNick()], mine:true});
  _pbMaking=false; closePartyFind(); renderPartyTab();
  if(typeof playSfx==='function') playSfx('ui_confirm');
  lobbyToast('"'+name+'" 파티를 만들었어요 · 친구를 초대해 보세요'); }
// ── 게시판 팝업 = 방 찾기(#rooms)를 그대로 빌린 판 ──
//   카드·목록·하단 버튼이 전부 같은 컴포넌트라, '방을 고르는 손'이 '파티를 고르는 손'과 같아진다.
//   방 번호 줄(.rmNum)은 파티엔 번호가 없으므로 '이름으로 찾기'가 맡고,
//   파티 만들기를 누르면 같은 줄이 이름 입력으로 바뀐다(따로 판을 하나 더 띄우지 않는다).
let _pbQuery='';
function openPartyFind(){ _lobbyOv('ptFindOv', closePartyFind, 'pfOv'); renderPartyFind();
  if(typeof playSfx==='function') playSfx('ui_open'); }
function closePartyFind(){ _pbMaking=false; _pbQuery=''; popHide('ptFindOv'); }
function pbRefresh(){ renderPartyFind(); lobbyToast('파티 목록을 새로 고쳤어요'); }
function pbQuick(){ const r=pbVisible().filter(function(x){ return pbCount(x)<PARTY_MAX && pbMineId()!==x.id; })[0];
  if(!r){ lobbyToast('바로 들어갈 수 있는 파티가 없어요'); return; }
  pbJoin(r.id); }
function pbVisible(){ const q=(_pbQuery||'').trim().toLowerCase();
  return pbRooms().filter(function(r){ return !q || r.name.toLowerCase().indexOf(q)>=0; }); }
function pbSetQuery(v){ _pbQuery=v||''; pbPaintList(); }
// 목록만 다시 그린다 — 입력 중에 판 전체를 갈아 끼우면 포커스가 날아간다
function pbPaintList(){ const el=document.getElementById('pbList'); if(!el) return;
  const rooms=pbVisible();
  el.innerHTML = rooms.length ? rooms.map(pbRowHTML).join('')
    : '<div class="rmEmpty">'+(_pbQuery?'그런 이름의 파티가 없습니다':'열려 있는 파티가 없습니다 · 파티 만들기로 시작해 보세요')+'</div>';
  const c=document.getElementById('pbCount'); if(c) c.textContent=rooms.length; }
// 줄 = 방 목록(.roomItem)과 같은 규격: 왼쪽 이름/파티장 · 오른쪽 인원/상태
function pbRowHTML(r){ const n=pbCount(r), mine=pbMineId()===r.id, full=n>=PARTY_MAX;
  const joinable=!mine && !full;
  return '<div class="roomItem'+(joinable?'':' locked')+'"'+(joinable?' onclick="pbJoin(&#39;'+r.id+'&#39;)"':'')+'>'
    +'<div class="riMain"><div class="riName">'+escHtml(r.name)+'</div>'
    +'<div class="riSub">파티장 - '+escHtml(r.mates[0]||myNick())+'</div></div>'
    +'<div class="riRight"><div class="riCnt'+(full?' full':'')+'">'+n+'/'+PARTY_MAX+'</div>'
    +'<div class="riStat '+(mine?'wait':(full?'play':'wait'))+'">'+(mine?'참가 중':(full?'가득참':'모집중'))+'</div></div></div>'; }
function renderPartyFind(){ const ov=document.getElementById('ptFindOv'); if(!ov) return;
  // 방 번호 줄(.rmNum)의 두 얼굴 — 평소엔 이름 검색, 만들기 모드에선 이름 입력
  const numRow = _pbMaking
    ? '<div class="rmNum"><input id="pbNameInput" type="text" placeholder="파티 이름" maxlength="18" autocomplete="off"'
      +' onkeydown="if(event.key===&#39;Enter&#39;)pbCreate()"><button onclick="pbCreate()">만들기</button></div>'
    : '<div class="rmNum"><input id="pbFindInput" type="text" placeholder="파티 이름으로 찾기" maxlength="18" autocomplete="off"'
      +' oninput="pbSetQuery(this.value)"></div>';
  ov.innerHTML='<div class="rmCard">'
    +'<div class="rmHead"><span class="rmTitle">파티 찾기</span>'
    +'<span class="rmHeadR"><span class="rmOnline">파티 <b id="pbCount">0</b>개</span></span></div>'
    + numRow
    +'<div class="rmList" id="pbList"></div>'
    +'<div class="rmBtns">'
    +'<button class="actBtn sq" onclick="closePartyFind()" title="닫기" aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>'
    +'<button class="actBtn" onclick="pbToggleMake()">'+(_pbMaking?'취소':'파티 만들기')+'</button>'
    +'<button class="actBtn pri" onclick="pbQuick()">빠른 참가</button>'
    +'<button class="actBtn sq" onclick="pbRefresh()" title="새로고침" aria-label="새로고침"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 12a8.4 8.4 0 0 1 14.5-5.8M20.4 12a8.4 8.4 0 0 1-14.5 5.8"/><path d="M18.4 2.9v3.6h-3.6M5.6 21.1v-3.6h3.6"/></svg></button>'
    +'</div></div>';
  pbPaintList();
  if(_pbMaking){ const i=document.getElementById('pbNameInput');
    if(i){ i.value=myNick()+'님의 파티'; setTimeout(function(){ try{ i.focus(); i.select(); }catch(e){} },30); } }
  else { const i=document.getElementById('pbFindInput'); if(i && _pbQuery) i.value=_pbQuery; } }
// ── 로비 팝업 껍데기(공용) ──
// ⚠ #phone 에 붙인다 — 소셜은 유즈맵 도크와 마을 시트를 오가므로 화면 하나에 매달면 반대쪽에서 안 보인다.
//   .top 은 시트(63)·네비(62) 위로 올리는 변형.
// 로비 팝업 닫기 버튼 — 친구 초대·친구 추가가 함께 쓴다(SVG를 두 번 베끼지 않는다).
// 모양은 HOME 팝업 .hbmX 와 같은 것 — 게임 전체가 같은 닫기 글리프를 쓴다.
function _ovXBtn(fn){ return '<button class="ptInviteX" onclick="'+fn+'" aria-label="닫기">'
  +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'
  +'<path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"/></svg></button>'; }
function _lobbyOv(id, onClose, cls){ let ov=document.getElementById(id);
  if(!ov){ ov=document.createElement('div'); ov.id=id; ov.className=cls||'ptInviteOv top';
    (document.getElementById('phone')||document.body).appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) onClose(); }); }
  ov.classList.remove('hide'); return ov; }
// ── ＋ 친구 추가 팝업 — 검색·요청 보내기. 입력 id(#foSearch/#foSearchResult)는 그대로라
//    friendSearch()/friendAdd() 를 손대지 않고 재사용한다.
function openFriendAdd(){ const ov=_lobbyOv('foAddOv', closeFriendAdd);
  ov.innerHTML='<div class="ptInviteCard">'
    +'<div class="ptInviteHead"><span>친구 추가</span>'+_ovXBtn('closeFriendAdd()')+'</div>'
    +'<div class="ptInviteSearch"><div class="foAdd">'
    +'<input id="foSearch" placeholder="닉네임 또는 닉#코드" maxlength="30" autocomplete="off" onkeydown="if(event.key===\'Enter\')friendSearch()">'
    +'<button class="actBtn pri foSearchBtn" onclick="friendSearch()">검색</button></div></div>'
    +'<div class="ptInviteList"><div id="foSearchResult">'
    +'<div class="foEmpty">닉#코드로 정확히 입력하면 바로 찾을 수 있어요</div></div></div></div>';
  const inp=document.getElementById('foSearch'); if(inp) setTimeout(function(){ try{ inp.focus(); }catch(e){} },30);
  if(typeof playSfx==='function') playSfx('ui_open'); }
function closeFriendAdd(){ popHide('foAddOv'); }
// 친구 초대 팝업
function openPartyInvite(){ const host=document.getElementById('mapSelect'); if(!host) return;
  let ov=document.getElementById('ptInviteOv');
  if(!ov){ ov=document.createElement('div'); ov.id='ptInviteOv'; ov.className='ptInviteOv'; host.appendChild(ov);
    ov.addEventListener('click', e=>{ if(e.target===ov) closePartyInvite(); }); }
  ov.classList.remove('hide'); renderPartyInviteList(); }
function closePartyInvite(){ popHide('ptInviteOv'); _inviteQuery=''; }
let _inviteQuery='';
async function renderPartyInviteList(){ const ov=document.getElementById('ptInviteOv'); if(!ov) return;
  ensureParty();
  const all=await loadAllFriends(); _invitableCache=all.filter(f=>!inParty(f.id));
  const full=_party.members.length>=PARTY_MAX;
  const head='<div class="ptInviteHead"><span>친구 초대</span>'+_ovXBtn('closePartyInvite()')+'</div>';
  const searchRow='<div class="ptInviteSearch"><input id="ptInviteInput" placeholder="이름 또는 #코드로 검색" maxlength="30" autocomplete="off" oninput="filterInviteRows(this.value)"></div>';
  let list;
  if(full){ list='<div class="foEmpty">파티가 가득 찼어요 ('+PARTY_MAX+'/'+PARTY_MAX+')</div>'; }
  else if(!_invitableCache.length){ list='<div class="foEmpty">초대할 수 있는 친구가 없어요</div>'; }
  else { _invitableCache.sort(friendSortCmp);   // 즐겨찾기 상단 고정 → 접속중→게임중→오프라인
    list=_invitableCache.map(f=>{ const st=presenceOf(f), busy=friendBusy(f);
      const right = (st==='online'&&!busy) ? '<button class="foAdd2" onclick="partyInvite(\''+f.id+'\')">초대</button>'
        : '<span class="fStatLbl fStat-'+(busy?'busy':st)+'">'+(busy?'파티 중':statusLabel(st))+'</span>';
      return friendCellHTML(f, right);
    }).join('')+'<div class="foEmpty ptNoMatch" style="display:none">검색 결과가 없어요</div>'; }
  ov.innerHTML='<div class="ptInviteCard">'+head+searchRow+'<div class="foList ptInviteList">'+list+'</div></div>';
  const inp=document.getElementById('ptInviteInput'); if(inp && _inviteQuery){ inp.value=_inviteQuery; filterInviteRows(_inviteQuery); } }
function filterInviteRows(q){ _inviteQuery=q; const ov=document.getElementById('ptInviteOv'); if(!ov) return;
  const qq=(q||'').trim().toLowerCase(); const rows=ov.querySelectorAll('.ptInviteList .foRow'); let vis=0;
  rows.forEach(function(r){ const m=!qq || (r.getAttribute('data-nm')||'').indexOf(qq)>=0; r.style.display=m?'':'none'; if(m) vis++; });
  const nm=ov.querySelector('.ptNoMatch'); if(nm) nm.style.display=(rows.length && vis===0)?'':'none'; }
async function renderFriendList(){ const body=document.getElementById('msPanelBody'); if(!body) return;
  // 게스트도 본다 — 임시 친구(_tempFriends)로 전체 레이아웃이 그려진다. 실계정 목록·요청만 로그인 시 합류.
  // ⛔ 맨 위는 목록이다 — 친구 추가(검색)는 헤더 오른쪽 ＋ 로 들어간 팝업이 맡는다.
  body.innerHTML =
    '<div class="ptHead"><span class="ptTitle">친구 <i class="onN" id="foCount">(온라인 0)</i></span>'
    +'<span class="ptHeadBtns"><button class="ptFind foAddBtn" onclick="openFriendAdd()">친구 추가</button></span></div>'
    +'<div id="foReqSec"></div>'
    +'<div id="foFriends" class="foList"><div class="foEmpty">불러오는 중…</div></div>';
  paintIcons(body);
  try{ const {friends,incoming}=sbReady()? await sbLoadFriends() : {friends:[],incoming:[]};
    const reqEl=document.getElementById('foReqSec');
    reqEl.innerHTML = incoming.length ? '<div class="foSecLbl">받은 친구 요청 <b>'+incoming.length+'</b></div><div class="foList">'+incoming.map(r=>
      '<div class="foRow">'+tagHTML(r.nick,r.tag)+'<span class="foBtns"><button class="foAccept" onclick="friendRespond(\''+r.fid+'\',true)">수락</button><button class="foDecline" onclick="friendRespond(\''+r.fid+'\',false)">거절</button></span></div>').join('')+'</div>' : '';
    const allF=friends.concat(tempFriendItems()); indexFriends(allF); allF.sort(friendSortCmp);   // 즐겨찾기→접속중→게임중
    const fRow=function(f){ const id=f.id||f.uid;
      const rowAttrs='onpointerdown="lpStart(event,\''+id+'\')" onpointerup="lpEnd()" onpointerleave="lpEnd()" oncontextmenu="return false"';
      return friendCellHTML(f, friendActions(f), rowAttrs); };
    // 한 목록 — 정렬이 이미 온라인→오프라인이고, 오프라인은 .foRow.off(어두운 상자)로 갈린다
    document.getElementById('foFriends').innerHTML =
      allF.length ? allF.map(fRow).join('') : '<div class="foEmpty">아직 친구가 없어요</div>';
    { const c=document.getElementById('foCount');   // 총원이 아니라 **접속 중**을 센다(오프라인은 어두운 상자로 이미 보인다)
      if(c) c.textContent='(온라인 '+allF.filter(function(f){ return presenceOf(f)!=='offline'; }).length+')'; }
    updateFriendBadge(incoming.length);
  }catch(e){ const f=document.getElementById('foFriends'); if(f) f.innerHTML='<div class="foEmpty">불러오기 실패</div>'; console.warn(e.message||e); } }
async function friendSearch(){ const inp=document.getElementById('foSearch'), res=document.getElementById('foSearchResult'); if(!inp||!res) return;
  const q=(inp.value||'').trim(); if(!q){ res.innerHTML=''; return; }
  if(!sbReady()){ res.innerHTML='<div class="foEmpty">친구 검색은 로그인 후 사용할 수 있어요</div>'; return; }
  res.innerHTML='<div class="foEmpty">검색 중…</div>';
  try{ const list=await sbSearchUser(q);
    res.innerHTML = list.length ? '<div class="foList">'+list.map(u=>'<div class="foRow found">'+tagHTML(u.nick,u.tag)+'<button class="foAdd2" onclick="friendAdd(\''+u.id+'\')">친구 요청</button></div>').join('')+'</div>'
      : '<div class="foEmpty">"'+escHtml(q)+'" 사용자를 찾을 수 없어요 (닉#코드로 정확히 입력해보세요)</div>';
  }catch(e){ res.innerHTML='<div class="foEmpty">검색 실패</div>'; } }
async function friendAdd(id){ const res=document.getElementById('foSearchResult');
  try{ await sbSendFriendReq(id); if(res) res.innerHTML='<div class="foEmpty">친구 요청을 보냈어요 ✓</div>'; }
  catch(e){ const dup=(e.message||'').toLowerCase().includes('duplicate'); if(res) res.innerHTML='<div class="foEmpty">'+(dup?'이미 요청했거나 친구예요':'요청 실패')+'</div>'; } }
async function friendRespond(fid, accept){ try{ await sbRespondReq(fid, accept); renderFriendList(); }catch(e){ console.warn(e.message||e); } }
async function friendRemove(fid){ try{ await sbRemoveFriend(fid); renderFriendList(); }catch(e){ console.warn(e.message||e); } }
let _mapSort='pop';
function getFavs(){ return _lsGet('nm_favs', {}); }
function toggleFav(id,ev){ if(ev) ev.stopPropagation(); const f=getFavs(); if(f[id]) delete f[id]; else f[id]=Date.now(); _lsSet('nm_favs',f); renderMaps(); }
function updateMyNameTag(){ const n=document.getElementById('msNick'); if(!n) return;
  const nick=(AUTH.user&&AUTH.user.nick)||'게스트', tag=(AUTH.user&&AUTH.user.tag)||'';
  n.innerHTML=escHtml(nick)+(tag?'<span class="msUserTag">#'+escHtml(tag)+'</span>':''); }
// ===== BGM (로비/인게임 셋 전환, 랜덤 재생 → 곡 종료 시 다시 랜덤, 반복) =====
// 단일 오디오 엘리먼트만 사용 → 로비/인게임 BGM이 절대 겹쳐 재생되지 않음.
let BGM_VOLUME = 0.30;            // ★ 로비 BGM 볼륨. 여기서 조절.
let BGM_GAME_VOLUME = 0.27;       // ★ 인게임 BGM 볼륨. 여기서 조절.
const BGM_SETS = {
  lobby:  ['lobby_1.mp3','lobby_2.mp3','lobby_3.mp3'],
  ingame: ['ingame_1.mp3','ingame_2.mp3','ingame_3.mp3']
};
const BGM_DIR = 'assets/audio/bgm/';
const _bgm = { audio:null, set:null, pendingGesture:false };
let _bgmLast = -1;
// 전역 사운드 설정(로비/로그인/인게임 공통). 100 = 현재 기준 볼륨.
// ⚠ 새 스위치를 넣을 때는 **여기 초기값을 반드시 같이 넣는다** — 없으면 `!undefined`=true 라
//   첫 탭이 '켜짐 → 켜짐'으로 헛돌고 스위치가 한 번 안 먹는다.
const SND = { bgm:100, sfx:100, bgmOn:false, sfxOn:false, chatOn:true, vibOn:true, wakeOn:false };   // chatOn = 플레이어 채팅 표시 · vibOn = 햅틱 · wakeOn = 화면 항상 켜기   // (임시) 기본 음소거 — 되돌리려면 bgmOn/sfxOn을 true로
(function(){ try{ const s=JSON.parse(localStorage.getItem('nm_snd')); if(s&&typeof s==='object') Object.assign(SND,s); }catch(e){} SND.bgmOn=false; SND.sfxOn=false; _chatApplyShow(); })();   // (임시) 시작 시 강제 음소거 — 되돌릴 때 이 강제 두 줄만 제거
function _sndSave(){ try{ localStorage.setItem('nm_snd', JSON.stringify(SND)); }catch(e){} }
function _bgmTracks(){ return BGM_SETS[_bgm.set] || []; }
function _bgmVol(){ const base=(_bgm.set==='ingame'?BGM_GAME_VOLUME:BGM_VOLUME);
  return base * (SND.bgmOn ? Math.max(0,Math.min(150,SND.bgm))/100 : 0); }   // 사용자 배경음악 볼륨(100=기준) 반영
function _bgmPick(){ const tr=_bgmTracks(); if(!tr.length) return null; let i=Math.floor(Math.random()*tr.length);
  if(tr.length>1 && i===_bgmLast) i=(i+1+Math.floor(Math.random()*(tr.length-1)))%tr.length;   // 직전 곡 연속 회피
  _bgmLast=i; return BGM_DIR+tr[i]; }
function _bgmPlayNext(){ if(!_bgm.set||!_bgm.audio) return; const a=_bgm.audio; const src=_bgmPick(); if(!src) return;
  a.src=src; a.volume=_bgmVol(); const p=a.play(); if(p&&p.catch) p.catch(()=>_bgmArmGesture()); }
function _bgmArmGesture(){ if(_bgm.pendingGesture) return; _bgm.pendingGesture=true;   // 자동재생 차단 시 첫 입력에 재생
  const h=()=>{ document.removeEventListener('pointerdown',h); document.removeEventListener('keydown',h); _bgm.pendingGesture=false;
    if(_bgm.set&&_bgm.audio){ const p=_bgm.audio.play(); if(p&&p.catch) p.catch(()=>{}); } };
  document.addEventListener('pointerdown',h); document.addEventListener('keydown',h); }
// setName: 'lobby' | 'ingame'. 다른 셋이면 이전 곡 확실히 정지 후 새 셋 랜덤 재생.
function bgmStart(setName){ setName=setName||'lobby';
  if(_bgm.set===setName && _bgm.audio && !_bgm.audio.paused) return;            // 같은 셋 재생 중이면 유지
  if(!_bgm.audio){ const a=new Audio(); a.preload='auto'; a.addEventListener('ended',_bgmPlayNext); _bgm.audio=a; }
  else { try{ _bgm.audio.pause(); }catch(e){} }                                 // 이전 BGM 확실히 정지(겹침 방지)
  _bgm.set=setName; _bgmLast=-1; _bgmPlayNext(); }
function bgmStop(){ _bgm.set=null; if(_bgm.audio){ try{ _bgm.audio.pause(); }catch(e){} try{ _bgm.audio.currentTime=0; }catch(e){} } }
      // 로비 볼륨 런타임 조절
  // 인게임 볼륨 런타임 조절

// ===== 효과음(Web Audio — 즉시 재생 + 겹침 재생, 종류별 세분화) =====
let SFX_VOLUME = 0.45;            // ★ 효과음 기준 볼륨(0.4~0.5, BGM보다 약간 크게). 여기서 조절.
const SFX_DIR = 'assets/audio/sfx/';
// ── 효과음 파일 목록(확정) — assets/audio/sfx/ 에 넣으면 자동 연동 ──
const SFX_FILES = {
  // A. UI ('click' = 일반 버튼 기본음 = button_click.mp3)
  click:'button_click.mp3', ui_tab:'ui_tab.mp3', ui_open:'ui_open.mp3', ui_close:'ui_close.mp3',
  ui_confirm:'ui_confirm.mp3', ui_denied:'ui_denied.mp3', ui_toggle:'ui_toggle.mp3', ui_dropdown:'ui_dropdown.mp3',
  notify:'notify.mp3',   // 게임 내 채팅·배속·일시정지 알람음(없으면 클릭음 폴백)
  // B. 게임플레이
  buy_unit:'unit_buy.mp3', enemy_spawn:'enemy_spawn.mp3', hero_merge:'hero_merge.mp3', place_unit:'place_unit.mp3', upgrade:'upgrade.mp3',
  death_terran:'death_terran.mp3', death_zerg:'death_zerg.mp3', death_protoss:'death_protoss.mp3',   // 종족별 적 처치음
  bldg_terran:'bldg_terran.mp3', bldg_protoss:'bldg_protoss.mp3', bldg_zerg:'bldg_zerg.mp3',   // 종족별 건물 작동음(선택 시)
  upgrade_press:'upgrade_press.mp3', upgrade_denied:'upgrade_denied.mp3',   // 업그레이드 상호작용(완료음은 upgrade)
  // 유닛별 공격음(8종)
  attack_ghost:'attack_ghost.mp3', attack_dragoon:'attack_dragoon.mp3', attack_hydra:'attack_hydra.mp3', attack_marine:'attack_marine.mp3',
  attack_goliath:'attack_goliath.mp3', attack_archon:'attack_archon.mp3', attack_turret:'attack_turret.mp3', attack_photon:'attack_photon.mp3',
  game_start:'game_start.mp3',   // 로딩 화면 '시작' 버튼 전용음
  round_start:'round_start.mp3', boss:'boss.mp3', warn:'warn.mp3', win:'win.mp3', lose:'lose.mp3',
  skill:'skill.mp3', speed:'speed.mp3'
};
const SFX_FALLBACK_SRC = 'assets/audio/sfx/button_click.mp3';   // 기존 클릭음 = UI 폴백
const _sfx = { ctx:null, bufs:{}, fallback:null, started:false };
function _sfxInit(){ if(_sfx.ctx) return;
  try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; _sfx.ctx=new AC(); }catch(e){ return; }
  _sfxLoadAll(); }
function _sfxDecode(url, cb){ fetch(url).then(r=>{ if(!r.ok) throw 0; return r.arrayBuffer(); })
  .then(b=>_sfx.ctx.decodeAudioData(b)).then(buf=>cb(buf)).catch(()=>{}); }
function _sfxLoadAll(){ if(!_sfx.ctx||_sfx.started) return; _sfx.started=true;
  _sfxDecode(SFX_FALLBACK_SRC, b=>{ _sfx.fallback=b; });                       // 폴백(button_click)
  Object.keys(SFX_FILES).forEach(name=>_sfxDecode(SFX_DIR+SFX_FILES[name], b=>{ _sfx.bufs[name]=b; })); }
function _sfxVol(){ return SFX_VOLUME * (SND.sfxOn ? Math.max(0,Math.min(150,SND.sfx))/100 : 0); }   // 효과음 설정(켜기/볼륨) 반영
// 효과음별 개별 볼륨 배율(기본 1). 여기서 특정 효과음만 키우거나 줄임.
const SFX_GAIN = { buy_unit:0.38, enemy_spawn:1.2, death_terran:0.3, death_zerg:0.3, death_protoss:0.3,
  attack_dragoon:0.30, attack_archon:0.30, attack_photon:0.30,                                  // 프로토스 공격음(조금 키움)
  attack_ghost:0.14, attack_marine:0.14, attack_goliath:0.14, attack_turret:0.14 };             // 테란 공격음(조금 줄임). 기타 기본 0.18
// 종류별 재생. 파일 없으면: UI(ui_*)는 클릭음으로 폴백, 게임 이벤트는 무음(파일 추가 시 자동 활성화).
function playSfx(name){ if(typeof G!=='undefined' && G && G._catchUp) return;   // 따라잡는 중: 수십 개가 한꺼번에 터진다
  if(typeof name==='string' && name.indexOf('ui_')===0) hapt(9);   // 햅틱은 소리보다 먼저 — 음소거여도 진동은 남는다
  const g=(SFX_GAIN[name]!=null)?SFX_GAIN[name]:((typeof name==='string'&&name.indexOf('attack_')===0)?0.18:1);
  const v=_sfxVol()*g; if(v<=0) return;
  if(!_sfx.ctx) _sfxInit(); const ctx=_sfx.ctx; if(!ctx) return;
  if(ctx.state==='suspended'){ try{ ctx.resume(); }catch(e){} }
  let buf=_sfx.bufs[name];
  if(!buf && typeof name==='string' && (name.indexOf('ui_')===0 || name==='notify')) buf=_sfx.fallback;   // UI·알림은 클릭음 폴백
  if(!buf) return;
  try{ const s=ctx.createBufferSource(); s.buffer=buf;            // 매번 새 소스 → 겹침 재생
    const g=ctx.createGain(); const vol=Math.min(1,v), now=ctx.currentTime, dur=buf.duration||0;
    if(dur>0.03){                                                  // 양 끝 클릭 방지용 짧은 페이드 인/아웃
      const fi=Math.min(0.006, dur*0.25), fo=Math.min(0.012, dur*0.3);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol, now+fi);
      g.gain.setValueAtTime(vol, now+Math.max(fi, dur-fo));
      g.gain.linearRampToValueAtTime(0, now+dur);
    } else g.gain.value=vol;
    s.connect(g); g.connect(ctx.destination); s.start(now); }catch(e){} }
   // 하위호환 별칭
let _notifyLast=0;
function playNotify(){ const now=Date.now(); if(now-_notifyLast<140) return; _notifyLast=now; playSfx('notify'); }   // 알림음(연타 방지 쓰로틀)
let _enSpawnLast=0;
function playEnemySpawn(){ const now=Date.now(); if(now-_enSpawnLast<70) return; _enSpawnLast=now; playSfx('enemy_spawn'); }   // 적군 생산음(고속 배속 동시 스폰 겹침 방지)
let _enDeathLast=0;
function playEnemyDeath(race){ const now=Date.now(); if(now-_enDeathLast<70) return; _enDeathLast=now;   // 대량 처치 시 겹침 방지(전역 쓰로틀)
  playSfx('death_'+(race||'terran')); }   // 종족별 처치음
const _atkLast={};
function playUnitAttack(id){ const now=Date.now(); if(now-(_atkLast[id]||0)<110) return; _atkLast[id]=now; playSfx('attack_'+id); }   // 유닛별 공격음(같은 유닛 다수 동시 발사 시 겹침 방지)
const _sfxTLast={};
function playSfxT(name, ms){ const now=Date.now(); if(now-(_sfxTLast[name]||0)<(ms||90)) return; _sfxTLast[name]=now; playSfx(name); }   // 이름별 쓰로틀(길게 누르기 연사 방지)
   // 효과음 기준 볼륨 런타임 조절용
// 버튼 종류 판별 → 알맞은 UI 효과음 선택(data-sfx로 개별 지정 가능)
function _sfxForEl(el){
  if(el.dataset && el.dataset.sfx) return el.dataset.sfx;
  if(el.classList.contains('locked')) return 'ui_denied';
  if(el.matches('.tab, .msTab2, .msScopeBtn')) return 'ui_tab';                                   // 탭 전환
  if(el.matches('.msSortCur, .msSortOpt')) return 'ui_dropdown';                                  // 정렬 드롭다운
  if(el.matches('.segBtn, .setSw, .cpSegBtn, .msTab2, .voteCol')) return 'ui_toggle';        // 켜기↔끄기/세그먼트/배속
  if(el.matches('.moClose, .setX, .actBtn.sub, .ecCancel')) return 'ui_close';   // 닫기/취소/뒤로
  if(el.matches('.opStart, .moBtn, .actBtn.pri, .ecGo, .authBtn, .authGuest, #chatSend, .msChatSend')) return 'ui_confirm';  // 시작·만들기·전송·확정
  return 'click';                                                                                  // 일반 버튼 기본음
}
// 모든 버튼/탭/메뉴/모달에 위임 바인딩 — 누르는 순간(pointerdown) 즉시 재생
const _SFX_BTN_SEL = 'button, .tab, .btn, .mergeBig, .setItem, .moClose, .mapStar, .voteCol';
document.addEventListener('pointerdown', function(e){
  const t = e.target && e.target.closest ? e.target.closest(_SFX_BTN_SEL) : null;
  if(!t) return; if(t.disabled && !t.classList.contains('locked')) return;
  playSfx(_sfxForEl(t));
}, true);
function openMapSelect(){ updateMyNameTag(); bgmStart('lobby'); loadMeta();
  if(TEMP_COIN_TEST){ PLAYER_META.buildLevels={}; PLAYER_META.coins=9999999; saveMeta(); }   // [임시] 로비 진입(게임 나갔다 오면) 시 포인트 상점 업그레이드 초기화(저장까지 → 상점 재오픈 loadMeta가 덮어쓰지 않게)   // 계정별 메타 성장 데이터 로드(메인/로비 진입 시 로비 BGM)
  if(sbReady()){ rtStart(); rtSetStatus('online',''); }   // 실시간 소셜 연결 + 로비 상태
  initMapLive(); showAppScreen('mapSelect'); navShow('map'); curSetTitle('유즈맵 선택'); paintIcons(document.getElementById('mapSelect')); renderMapSortTabs(); renderMaps(); startMapLive();
  mapDockSocial();   // 소셜(채팅·친구·파티)을 화면 하단 상주 구역으로   // 하단 네비로 이동(좌상단 뒤로가기 없음)
  if(typeof refreshFriendBadge==='function') refreshFriendBadge(); }   // 기본 탭은 mapDockSocial 이 맞춘다
const _SORT_LBL={pop:'인기순',new:'신규',rec:'추천',fav:'즐겨찾기'};
const MAP_SORTS=[['pop','인기순'],['new','신규'],['rec','추천'],['fav','즐겨찾기']];
// 정렬 띠 — 사냥터 업그레이드 탭과 **같은 함수**(segNavHTML)로 그린다. 새 탭 띠를 만들지 말 것.
// 글자만 — 아이콘을 같이 넣으면 아이콘+글자가 한 덩어리로 가운데 정렬돼 글자가 중앙에서 밀린다(사냥터와 같은 이유).
function renderMapSortTabs(){ const tb=document.getElementById('msSortTabs'); if(!tb) return;
  const i=Math.max(0, MAP_SORTS.findIndex(function(c){ return c[0]===_mapSort; }));
  tb.innerHTML=segNavHTML(MAP_SORTS.map(function(c){ return { label:c[1] }; }), i,
    function(k){ return 'setMapSort(&#39;'+MAP_SORTS[k][0]+'&#39;)'; }); }
function setMapSort(s){ _mapSort=s;
  renderMapSortTabs();   // 정렬은 화면 위 띠가 맡는다
  const di=document.getElementById('msSortDDi'); if(di && ICO[s]) di.innerHTML=ICO[s];                          // 옛 드롭다운 흔적(있으면 갱신)
  const lb=document.getElementById('msSortLbl'); if(lb) lb.textContent=_SORT_LBL[s]||s;
  document.querySelectorAll('#msSortMenu .msSortOpt').forEach(b=>b.classList.toggle('on', b.dataset.v===s));
  closeSortMenu(); renderMaps(); }
function closeSortMenu(){ const dd=document.getElementById('msSortDD'), menu=document.getElementById('msSortMenu');
  if(menu) menu.classList.add('hide'); if(dd) dd.classList.remove('open'); document.removeEventListener('click', _sortMenuOutside); }
function _sortMenuOutside(e){ const dd=document.getElementById('msSortDD'); if(dd && !dd.contains(e.target)) closeSortMenu(); }
function _kfmt(n){ return n>=1000 ? (n/1000).toFixed(1)+'k' : (''+n); }
function renderMaps(){ const list=document.getElementById('msList'); if(!list) return; const favs=getFavs();
  let arr=MAPS.slice().filter(m=>!m.hidden);   // 숨김 맵(무한=난이도 팝업으로 진입) 제외
  if(_mapSort==='fav') arr=arr.filter(m=>favs[m.id]);
  else if(_mapSort==='pop') arr.sort((a,b)=>liveTotal(b)-liveTotal(a));   // 인기순=현재 접속 인원
  else if(_mapSort==='new') arr.sort((a,b)=>(b.isNew?1:0)-(a.isNew?1:0)||liveTotal(b)-liveTotal(a));
  else if(_mapSort==='rec') arr.sort((a,b)=>(b.rec?1:0)-(a.rec?1:0)||liveTotal(b)-liveTotal(a));
  if(_mapSort!=='fav') arr.sort((a,b)=>(favs[b.id]?1:0)-(favs[a.id]?1:0));   // 즐겨찾기는 항상 상단 고정
  list.innerHTML='';
  if(!arr.length){ list.innerHTML='<div class="msEmpty">⭐ 즐겨찾기한 유즈맵이 없습니다.<br>맵 카드의 별(☆)을 눌러 추가하세요.</div>'; updateMapBanner(); return; }
  arr.forEach(m=>{ const el=document.createElement('div'); el.className='mapItem';
    { const _ac=MAP_ACCENT[m.id]; if(_ac) el.style.setProperty('--mapAccent', _ac); }   // 맵별 아이덴티티 색
    const nm=escHtml(m.name)+(m.isNew?' <span class="mapTag new">신규</span>':'');
    el.innerHTML=mapThumbHTML(m)
      +'<div class="mapMain"><div class="mapName">'+nm+'</div><div class="mapDesc">'+escHtml(m.desc)+'</div>'
        +'<div class="mapLive" id="mlive-'+m.id+'">'+liveText(m)+'</div></div>'
      +'<div class="mapStar'+(favs[m.id]?' on':'')+'">'+ICO.fav+'</div>';
    el.querySelector('.mapStar').onclick=(e)=>toggleFav(m.id,e);
    el.onclick=()=>{ if(m.playable===false){ lobbyToast('아직 준비 중인 유즈맵입니다'); return; }
      if(m.cfg&&m.cfg.infinite&&!infiniteUnlocked()){ lobbyToast('🔒 노말 난이도를 클리어하면 해금됩니다'); return; }
      openModeSheet(m); };
    list.appendChild(el);
  });
  updateMapBanner();
}
// ── 모드 선택(개인/멀티) ──
let _selMap=null;
// ── 난이도 선택(2단계) ──
let _selDiff='normal';
let _selRace='terran';   // 컴퓨터가 싸운다(직스): 내가 고른 종족(테란/프로토스/저그)
const DIFF_COLOR={ easy:'#5dff8f', normal:'#4aa8ff', hard:'#ffb14d', hell:'#ff5c5c', nightmare:'#c45cff' };
function renderDiffBtns(){ const box=document.getElementById('moDiffBtns'); if(!box) return; box.innerHTML='';
  DIFFICULTY_ORDER.forEach(d=>{ const D=DIFFICULTY[d]; const b=document.createElement('div');
    b.className='moDiffBtn'+(d===_selDiff?' on':''); b.style.setProperty('--dc', DIFF_COLOR[d]||'#fff');
    b.innerHTML='<span class="ddN">'+D.name+'</span><span class="ddC">포인트 ×'+D.coinMult+'</span>';
    b.onclick=()=>setDiff(d); box.appendChild(b); });
  const h=document.getElementById('moDiffHint'); if(h){ const D=DIFFICULTY[_selDiff]; h.textContent='적 강도 ×'+(D.enemyHp/DIFFICULTY.easy.enemyHp).toFixed(1)+' · 포인트 ×'+D.coinMult; }
}
function setDiff(d){ if(!DIFFICULTY[d]) return; _selDiff=d; renderDiffBtns(); if(typeof playSfx==='function') playSfx('ui_confirm'); }
// 모드시트 설명 = 구역별 아이콘(라인 스타일 · 맵 강조색으로 틴트)
const _MO_FEAT_SVG={
  merge:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4z"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l7 2.6v5c0 4.2-2.9 7.4-7 8.9-4.1-1.5-7-4.7-7-8.9v-5z"/></svg>',
  growth:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15.5l5-5 3.2 3.2L20 6.5"/><path d="M15.5 6.5H20V11"/></svg>',
  boss:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5l3.6 3L12 5l4.4 6.5 3.6-3-1.7 9.5H5.7z"/></svg>',
  coop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.6" r="2.7"/><path d="M3.8 18.5c0-2.8 2.3-4.7 5.2-4.7s5.2 1.9 5.2 4.7"/><circle cx="16.7" cy="9.2" r="2"/><path d="M15.4 14c2.3.3 4.4 1.9 4.4 4.5"/></svg>',
  build:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5"/></svg>',
  sword:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18l3-3M4 20l2-2M14.5 4H20v5.5l-9 9-5.5-5.5z"/><path d="M13 11l3 3"/></svg>',
  target:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></svg>',
  coin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M14.4 9.6a3.3 3.3 0 1 0 0 4.8"/></svg>'
};
// 유즈맵 특징 리스트 행 — 유즈맵 팝업·게임 시작 화면 공용(단일 소스)
function _featRowsHTML(feats, limit){
  const list=(feats||[]).slice(0, limit||(feats||[]).length);
  return list.map(f=>'<div class="moFeat"><span class="mfIco">'+(_MO_FEAT_SVG[f.ic]||'')+'</span><span class="mfTx"><b>'+escHtml(f.kw)+'</b>'+escHtml(f.tx)+'</span></div>').join('');
}
function openModeSheet(m){ _selMap=m; renderDiffBtns();
  { const card=document.querySelector('#modeSheet .moCard'); if(card){ const ac=(typeof MAP_ACCENT!=='undefined'&&MAP_ACCENT[m.id])||'#7f93b0'; card.style.setProperty('--mapAccent', ac); } }   // 팝업 강조색 = 맵별 아이덴티티(카드와 통일)
  document.getElementById('moMap').textContent=m.name;
  { const dEl=document.getElementById('moDesc');   // 설명 = 구역별 아이콘 리스트(feats) 우선, 없으면 문단(long)
    if(dEl){ if(m.feats && m.feats.length){ dEl.className='moDesc moFeats';
        dEl.innerHTML=_featRowsHTML(m.feats); }
      else { dEl.className='moDesc'; dEl.textContent=m.long||(m.desc+' · '+m.players+'인'); } } }
  { const mt=document.getElementById('moMeta'); if(mt){ const on=(typeof liveTotal==='function')?liveTotal(m):0;   // 메타 칩: 접속·추천/신규 (인원은 feats에서 안내 → 칩 제거)
    let h='';
    if(m.rec) h+='<span class="moChip rec">추천</span>';
    if(m.isNew) h+='<span class="moChip new">신규</span>';
    h+='<span class="moChip live"><i class="mcDot"></i>'+(on||0).toLocaleString('en-US')+'명 접속</span>';   // 접속 인원 = 추천/신규 뒤(오른쪽), 천단위 콤마(8,300명)
    mt.innerHTML=h; } }
  _mapThumbInto(document.getElementById('moThumb'), m);   // 큰 미니맵/아이콘(시작 화면과 공용)
  _mapBgInto(document.getElementById('moWash'), m);   // 뒤 배경 = 맵 전용 키 아트(없으면 빈 층)
  const party=(typeof inPartyNow==='function') && inPartyNow();   // 파티 중이면 개인플레이 잠금
  const soloOff=!!m.soloOff;   // 이 유즈맵은 멀티 전용(개인 플레이 없음)
  const solo=document.querySelector('#modeSheet .moSolo');
  if(solo){ const lock=party||soloOff; solo.disabled=lock; solo.classList.toggle('locked', lock);
    // 잠금 시 = 잠금 아이콘 + 짧은 상태만(라벨 생략 → 카드 폭 안에 수납), 평상시 = 개인 플레이
    solo.innerHTML = lock
      ? '<span data-ico="lock"></span>'+(soloOff?'멀티 전용':'파티 중')
      : '<span data-ico="solo"></span>개인 플레이'; }
  if(typeof paintIcons==='function') paintIcons(document.getElementById('modeSheet'));
  const ms=document.getElementById('modeSheet'); ms.classList.remove('hide'); if(typeof fxPop==='function') fxPop(ms.querySelector('.moCard')); if(typeof playSfx==='function') playSfx('ui_open');
  _moFitInfo(document.getElementById('moDesc')); }   // 내용 양과 무관하게 카드 크기 고정(설명 칸만 축소)
// 설명 칸을 남은 높이에 맞춤 — 내용이 많으면 카드를 늘리지 말고 비율을 줄여 칸 안에 수납
// ⚠ 상수로 못 박지 않는다: 시네마틱으로 바뀐 뒤 칸 높이는 '카드 높이 - 제목 자리 - 버튼'이고,
//    카드 높이 --popH 는 min(564px,90%) 라 짧은 기기에서는 실제로 줄어든다.
const _MO_INFO_H=306;   // 폴백(측정 실패 시) = 564 카드 기준 값
function _moFitInfo(box){
  if(!box) return;
  box.style.height='';   // 먼저 비워야 부모(.moBody, flex:1)의 남은 높이를 잰다
  let H=_MO_INFO_H;
  const par=box.parentElement;
  if(par){ const cs=getComputedStyle(par);
    const inner=par.clientHeight - (parseFloat(cs.paddingTop)||0) - (parseFloat(cs.paddingBottom)||0);
    if(inner>40) H=Math.round(inner); }   // 헤드리스·숨김 상태에선 0이 나온다 → 폴백
  box.style.height=H+'px';
  box.style.setProperty('--mfS','1'); box.style.setProperty('--mfG','9px');
  if(box.scrollHeight<=H) return;
  if(box.classList.contains('moFeats')){
    for(const g of [7,5,4]){ box.style.setProperty('--mfG',g+'px'); if(box.scrollHeight<=H) return; }   // 1) 간격 먼저(텍스트 가독성 우선)
  }
  for(let s=98; s>=70; s-=2){ box.style.setProperty('--mfS',(s/100).toFixed(2)); if(box.scrollHeight<=H) return; }   // 2) 아이콘·텍스트를 같은 비율로 축소
}
function closeModeSheet(){ popHide('modeSheet'); }
function chooseSolo(){ if(_selMap && _selMap.soloOff){ if(typeof lobbyToast==='function') lobbyToast('이 유즈맵은 멀티플레이 전용입니다'); return; }   // 멀티 전용 맵 = 개인 플레이 차단
  if(typeof inPartyNow==='function' && inPartyNow()){ if(typeof lobbyToast==='function') lobbyToast('파티 중에는 멀티플레이만 가능합니다'); return; }
  closeModeSheet();
  const m=_selMap;
  if(m && (m.id==='nemo' || m.id==='nemo_inf')){ openSoloDiff(); return; }   // 난이도 선택은 네모네모 디펜스 전용
  if(m && m.cfg && m.cfg.mode==='strike'){ openRaceSelect(); return; }       // 컴퓨터가 싸운다(오토 배틀): 종족만 선택 후 시작
  _startSoloNow(); }                                                          // 관리자 테스트(샌드박스)·기타: 난이도 없이 바로 시작
// ── 종족 선택 팝업(재사용): 솔로(맵→종족→난이도) + 멀티 대기실(카드 칩→팝업) 공용 ──
let _racePickCb=null;
// 종족색 → CSS 변수(rgba 변형) 문자열. SC 네온 콘솔 행 스타일에 주입
function _rcHex(hex){ hex=(hex||'#8a93a0').replace('#',''); if(hex.length===3) hex=hex.replace(/(.)/g,'$1$1');
  return [parseInt(hex.slice(0,2),16)||138, parseInt(hex.slice(2,4),16)||147, parseInt(hex.slice(4,6),16)||160]; }
function raceVars(col){ const c=_rcHex(col), rgb=c[0]+','+c[1]+','+c[2];
  return '--rc:'+col+';--rc14:rgba('+rgb+',.14);--rc42:rgba('+rgb+',.42);--rc65:rgba('+rgb+',.65)'; }
function openRacePicker(current, onPick){ _racePickCb=onPick||null;
  const box=document.getElementById('raceSelBtns'); if(box){ box.innerHTML='';
    STK_RACE_ORDER.forEach(k=>{ const R=STK_RACES[k]; const b=document.createElement('div');
      b.className='raceOpt'+(k===current?' on':''); b.setAttribute('style', raceVars(R.col));
      b.innerHTML='<span class="roNm">'+R.name+'</span>'   // 이름(괄호 서브명 제거) + 특성 + 우측 화살표 — 난이도 카드와 동일 언어
        +(R.desc?'<span class="roDesc">'+R.desc+'</span>':'')
        +'<svg class="roGo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
      b.onclick=()=>pickRace(k); box.appendChild(b); }); }
  const p=document.getElementById('raceSelPanel'); if(p){ p.classList.remove('hide'); if(typeof fxPop==='function') fxPop(p.querySelector('.cpCard')); } if(typeof playSfx==='function') playSfx('ui_open'); }
function openRaceSelect(){ openRacePicker(_selRace, function(k){ _selRace=k; _startSoloNow(); }); }   // 솔로: 난이도 후 종족 확정 → 게임 시작
// (인라인 종족 드롭다운 showRaceMenu/hideRaceMenu/#raceMenu 는 2026-08-19 삭제 — 유일한 입구였던
//  대기실 칩 경로(openLobbyRace)가 공용 탭 띠로 대체되면서 통째로 고아가 됐다.)
function closeRaceSelect(){ popHide('raceSelPanel'); _racePickCb=null; }
function pickRace(k){ if(!STK_RACES[k]) return; if(typeof playSfx==='function') playSfx('ui_confirm'); const cb=_racePickCb; _racePickCb=null; popHide('raceSelPanel'); if(cb) cb(k); }
// 개인 플레이 난이도 선택 팝업(고르면 즉시 시작)
// ── 개인 플레이 난이도 = 세그먼트 바로 고르고 상세에서 확인 후 시작(2026-08-19) ──
//   ⛔ 목록을 훑어 바로 시작하던 방식은 폐지 — 오탭으로 시작되고, 난이도끼리 비교가 안 됐다.
//   잠긴 난이도도 **고를 수는 있다**(무엇이 필요한지 보여 준다) — 시작 버튼만 잠긴다.
let _sdPick='easy';
// 난이도 한 줄 — 수치만으로는 '나한테 맞는지'를 못 고른다
const SD_DESC={ easy:'처음이라면 여기서 · 규칙을 익히는 단계',
  normal:'기본 난이도 · 대부분 여기서 시작합니다',
  hard:'메타 업그레이드가 어느 정도 쌓여야 버팁니다',
  hell:'거의 만렙 · 운영 실수를 봐주지 않습니다',
  nightmare:'최종 단계 · 초월까지 갖춰야 넘어갑니다' };
function _sdRGB(hex){ const h=(hex||'#ffffff').replace('#',''); 
  return [0,2,4].map(function(i){ return parseInt(h.substr(i,2),16); }).join(','); }
// 탭에는 난이도만 — 무한 모드는 아래 별도 줄이 맡는다(노말 고정이라 난이도 축이 아니다)
function _sdList(){ return DIFFICULTY_ORDER.map(function(d){ return {k:d, name:DIFFICULTY[d].name, col:DIFF_COLOR[d]}; }); }
function _sdHasInf(){ return !!(_selMap && _selMap.id==='nemo' && USEMAPS.nemo_inf); }
function _sdOk(k){ return (k==='inf') ? ((typeof infiniteUnlocked!=='function')||infiniteUnlocked())
                                      : ((typeof diffUnlocked!=='function')||diffUnlocked(k)); }
function sdStartInf(){ if(!_sdOk('inf')){ if(typeof lobbyToast==='function') lobbyToast('🔒 노말을 클리어하면 열립니다'); return; }
  startSoloInfinite(); }
function _sdPrevKo(k){ if(k==='inf') return 'NORMAL';
  const r=DIFF_RANK.indexOf(k); return (r>0 && DIFFICULTY[DIFF_RANK[r-1]]) ? DIFFICULTY[DIFF_RANK[r-1]].name : ''; }
function sdPick(i){ const L=_sdList(); if(!L[i]) return; _sdPick=L[i].k; renderSoloDiff();
  if(typeof playSfx==='function') playSfx('ui_tab'); }
// 스테퍼 = ±1 이동. 양 끝에서는 멈춘다(순환하지 않는다 — 난이도는 순서가 있는 축이라 끝이 있어야 위치가 읽힌다)
function sdStepBy(d){ const L=_sdList(); let i=L.findIndex(function(x){ return x.k===_sdPick; });
  if(i<0) i=0; const n=i+d; if(n<0||n>=L.length) return; sdPick(n); }
function renderSoloDiff(){ const nav=document.getElementById('sdNav'), det=document.getElementById('sdDet');
  if(!nav||!det) return;
  const L=_sdList(); let i=L.findIndex(function(x){ return x.k===_sdPick; }); if(i<0){ i=0; _sdPick=L[0].k; }
  const cur=L[i], ok=_sdOk(cur.k);
  // 잠긴 난이도는 회색으로 물들인다 — 색이 살아 있으면 '고를 수 있다'로 읽힌다
  const col = ok ? cur.col : '#5a626c';
  [nav,det].forEach(function(el){ el.style.setProperty('--dc', col); el.style.setProperty('--dcRGB', _sdRGB(col)); });
  // ◀ 이름 ▶ + 위치 점. 화살표는 공용 .arwBtn(paintIcons 가 글리프를 채운다)
  nav.innerHTML='<div class="sdStepRow">'
    +'<button class="arwBtn" data-arw="l" id="sdPrev" onclick="sdStepBy(-1)" aria-label="이전 난이도"'+(i>0?'':' disabled')+'></button>'
    +'<div class="sdStepTx">'+escHtml(cur.name)+'</div>'
    +'<button class="arwBtn" data-arw="r" id="sdNext" onclick="sdStepBy(1)" aria-label="다음 난이도"'+(i<L.length-1?'':' disabled')+'></button>'
    +'</div><div class="sdDots">'+L.map(function(x,j){ return '<i class="'+(j===i?'on':'')+'"></i>'; }).join('')+'</div>';
  if(typeof paintArrows==='function') paintArrows(nav);
  let body;
  if(!ok){ body='<div class="sdLock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
      +escHtml(_sdPrevKo(cur.k))+' 클리어 시 잠금 해제</div>'; }
  else { const D=DIFFICULTY[cur.k], hp=(D.enemyHp/DIFFICULTY.easy.enemyHp).toFixed(1);
    body='<div class="sdStats"><span class="sdStat e"><i>적 HP</i><b>×'+hp+'</b></span>'
        +'<span class="sdStat c"><i>포인트 획득량</i><b>×'+D.coinMult+'</b></span></div>'
        +'<div class="sdDesc">'+(SD_DESC[cur.k]||'')+'</div>'; }
  // 머리에 지금 고른 맵을 얹는다 — '무엇을 어느 난이도로' 가 한 화면에 있다
  const mapHead='<div class="sdMap"><span class="moThumb" id="sdThumb"></span>'
    +'<span class="sdMapTx"><b>'+escHtml((_selMap&&_selMap.name)||'')+'</b>'
    +'<em>'+escHtml((_selMap&&_selMap.desc)||'')+'</em></span></div>';
  det.innerHTML=mapHead+'<div class="sdBody">'+body+'</div>'
    +'<button class="actBtn pri sdGo" id="sdGo" onclick="sdStart()"'+(ok?'':' disabled')+'>'
    +(ok ? '이 난이도로 시작' : '잠겨 있습니다')+'</button>';
  if(typeof _mapThumbInto==='function') _mapThumbInto(document.getElementById('sdThumb'), _selMap);
  // 무한 모드 줄 — 이 맵에 있을 때만
  { const el=document.getElementById('sdInf'); if(el){ const has=_sdHasInf(), iok=_sdOk('inf');
      el.classList.toggle('hide', !has); el.classList.toggle('lk', !iok);
      if(has) el.innerHTML='<b>∞ 무한 모드</b><em>'+(iok?'노말 고정 · 끝없이 도전':'NORMAL 클리어 시 개방')+'</em>'; } } }
function sdStart(){ if(!_sdOk(_sdPick)) return; startSoloWithDiff(_sdPick); }
function openSoloDiff(){
  // 처음 열 때는 **해금된 것 중 가장 높은 난이도**를 고른 상태로 — 매번 EASY 부터 넘기지 않게
  { const L=_sdList().filter(function(x){ return _sdOk(x.k); });
    _sdPick = L.length ? L[L.length-1].k : 'easy'; }
  renderSoloDiff();
  const p=document.getElementById('soloDiffPanel'); if(p){ p.classList.add('noDim'); p.classList.remove('hide');   // 화면전환: 배경 딤 유지(페이드 생략)
    const card=p.querySelector('.cpCard'); if(card){ card.classList.remove('fxPop','fxPush');   // 난이도 선택 = 효과 없이 즉시(요청)
      const ac=(typeof MAP_ACCENT!=='undefined'&&_selMap&&MAP_ACCENT[_selMap.id])||'#7f93b0';
      card.style.setProperty('--mapAccent', ac); } }   // 방금 고른 맵의 액센트를 이어받는다 — 두 팝업이 한 흐름으로 읽힌다
  if(typeof playSfx==='function') playSfx('ui_open'); }
function closeSoloDiff(){ popHide('soloDiffPanel'); }
function startSoloInfinite(){ if(!USEMAPS.nemo_inf) return; _selMap=USEMAPS.nemo_inf; closeSoloDiff(); _startSoloNow(); }   // 무한 모드 시작(테스트 단계: 해금 게이트 미적용)
function startSoloWithDiff(d){ if(DIFFICULTY[d]) _selDiff=d; closeSoloDiff();
  if(_selMap && _selMap.cfg && _selMap.cfg.mode==='strike'){ openRaceSelect(); return; }   // 직스: 난이도 후 종족 선택 팝업 → 시작
  _startSoloNow(); }
function _startSoloNow(){ if(_selMap&&_selMap.id&&typeof _lsSet==='function') try{ _lsSet('nm_recentMap', _selMap.id); }catch(e){}   // 허브 '최근 플레이' 표시용
  if(typeof rtSetStatus==='function') rtSetStatus('ingame', _selMap&&_selMap.name); hideAppScreens(); if(typeof playSfx==='function') playSfx('ui_confirm'); startGameNow([1],1); }
function chooseMulti(){ if(typeof rtSetStatus==='function') rtSetStatus('ingame', _selMap&&_selMap.name); closeModeSheet(); hideAppScreens(); openRooms(); }            // 멀티 → 방 찾기
function refreshRooms(){ buildRoomList(); }
function newRoomNum(){ let num; do{ num=1000+Math.floor(Math.random()*9000); }while(_roomList&&_roomList.some(r=>r.num===num)); return num; }
function buildRoomList(){ _roomList=[];
  const n=5+Math.floor(Math.random()*8);   // 5~12개 방 (6개 초과 시 내부 스크롤)
  const titles=ROOM_TITLES.slice().sort(()=>Math.random()-0.5), hosts=LOBBY_NAMES.slice().sort(()=>Math.random()-0.5);
  const diffs=['easy','easy','normal','normal','normal','hard','hard','hell'];   // 난이도 가중 분포
  const now=perfNow();
  for(let i=0;i<n;i++){ const playing=Math.random()<0.35;
    const cur=playing?(2+Math.floor(Math.random()*6)):(1+Math.floor(Math.random()*7));
    const priv=Math.random()<0.3;   // 약 30% 비공개(목록엔 보이지만 비밀번호 필요)
    _roomList.push({num:newRoomNum(), name:titles[i%titles.length], host:hosts[i%hosts.length], cur:Math.min(8,cur), max:8, status:playing?'playing':'wait', round:playing?(1+Math.floor(Math.random()*TOTAL_ROUNDS)):0, visibility:priv?'private':'public', pw:priv?(''+(1000+Math.floor(Math.random()*9000))):'',
      diff:diffs[Math.floor(Math.random()*diffs.length)],
      opts:(!mapHasDiff() && Math.random()<0.3) ? Object.assign(stkOptDefaults(),{cycleTime:10,startGold:700,incomeBase:70,hpMul:0.7}) : null,
      gameEndAt:playing?(now+1000+Math.random()*9000):0});   // 게임중 방: 시작 후 10초 내 목록에서 사라짐
  }
  renderRoomList(); }
function diffBadge(d){ const D=DIFFICULTY[d]||DIFFICULTY.normal; return '<span class="riDiff" style="--dc:'+(DIFF_COLOR[d]||'#888')+'">'+D.name+'</span>'; }
let _roomFilter='all';
function setRoomFilter(f){ _roomFilter=f;
  if(typeof playSfx==='function') playSfx('ui_tab'); renderRoomList(); }
// 난이도 필터 = 공용 탭 띠(segNavHTML). 난이도가 없는 유즈맵(대인전)에서는 **띠 자체를 비운다** —
// 빈 자리에 요약 줄 같은 것을 대신 채우지 않는다(요청, 2026-08-19).
const RM_FILTERS=[{k:'all',label:'전체'},{k:'easy',label:'EASY'},{k:'normal',label:'NORMAL'},{k:'hard',label:'HARD'},{k:'hell',label:'HELL'}];
function renderRmFilter(){ const box=document.getElementById('rmFilter'); if(!box) return;
  if(!(typeof mapHasDiff==='function' && mapHasDiff())){ box.innerHTML=''; return; }   // 대인전 = 난이도 개념 없음
  const i=Math.max(0, RM_FILTERS.findIndex(function(f){ return f.k===_roomFilter; }));
  box.innerHTML=segNavHTML(RM_FILTERS.map(function(f){ return {label:f.label}; }), i, function(k){ return 'pickRmDiff(\''+RM_FILTERS[k].k+'\')'; }); }
function pickRmDiff(f){ if(typeof setRoomFilter==='function') setRoomFilter(f); renderRmFilter(); }
// 방 번호 입장(친구 방)은 자주 쓰는 동작이 아니라 평소엔 접어 둔다 — 우상단 🔍로 편다
function toggleRoomNum(){ const row=document.getElementById('rmNumRow'), btn=document.getElementById('rmNumBtn');
  if(!row) return; const open=row.classList.contains('hide');
  row.classList.toggle('hide', !open); if(btn) btn.classList.toggle('on', open);
  if(open){ const f=document.getElementById('roomNumField'); if(f) setTimeout(function(){ try{ f.focus(); }catch(e){} },30); }
  if(typeof playSfx==='function') playSfx('ui_tab'); }
function _rmNumClose(){ const row=document.getElementById('rmNumRow'), btn=document.getElementById('rmNumBtn');
  if(row) row.classList.add('hide'); if(btn) btn.classList.remove('on');
  const f=document.getElementById('roomNumField'); if(f) f.value=''; }
function renderRoomList(){ const list=document.getElementById('roomList'); if(!list) return; list.innerHTML='';
  const shown=(_roomFilter==='all')?_roomList:_roomList.filter(r=>r.diff===_roomFilter);   // 난이도 필터
  const rc=document.getElementById('roomCount'); if(rc) rc.textContent=shown.length;
  const need=partySize();
  if(!shown.length){ { const q=document.getElementById('rmQuickSub'); if(q) q.textContent='들어갈 방 없음'; }
    const e=document.createElement('div'); e.className='rmEmpty'; e.textContent=(_roomFilter==='all')?'대기 중인 방이 없습니다 · 새로고침 또는 방 만들기':'해당 난이도의 방이 없습니다'; list.appendChild(e); return; }
  { const q=document.getElementById('rmQuickSub');   // 빠른 입장 버튼 안의 부제 = 지금 들어갈 수 있는 방 수
    if(q){ const w=shown.filter(r=>r.status==='wait' && (r.max-r.cur)>=need).length;
      q.textContent = w? ('대기 중 '+w+'방') : '들어갈 방 없음'; } }
  shown.forEach(r=>{ const full=r.cur>=r.max, waiting=r.status==='wait', fits=(r.max-r.cur)>=need, joinable=waiting&&!full&&fits, priv=r.visibility==='private';
    const el=document.createElement('div'); el.className='roomItem'+(joinable?'':' locked');
    // 밑변 광원 = 난이도 색. 난이도가 없는 유즈맵은 안 실어 주고 중립 흰선으로 둔다(.actBtn 기본형)
    if(mapHasDiff()){ const c=DIFF_COLOR[r.diff]||'#888';
      el.style.setProperty('--dc', c); if(joinable) el.style.setProperty('--dcGlow', c); }
    el.innerHTML='<div class="riMain"><div class="riName">'+(mapHasDiff()?diffBadge(r.diff):'')+'<span class="riNum">#'+r.num+'</span>'+(priv?'<span class="riLock">🔒</span>':'')+escHtml(r.name)+'</div><div class="riSub">방장 - '+escHtml(r.host)+(r.opts?' · <span class="riOpt">사용자 지정</span>':'')+(need>1&&waiting&&!full&&!fits?' · <span class="riOver">파티 자리 부족</span>':'')+'</div></div>'
      +'<div class="riRight"><div class="riCnt'+(full?' full':'')+'">'+r.cur+'/'+r.max+'</div><div class="riStat '+(waiting?'wait':'play')+'">'+(waiting?(full?'가득참':'대기중'):(r.round?('게임중 '+r.round+'R'):'게임중'))+'</div></div>';
    if(joinable) el.onclick=()=> priv? openPwPrompt(r) : joinRoom(r);
    else if(waiting && !full && !fits) el.onclick=()=>{ if(typeof playSfx==='function') playSfx('ui_denied'); toast('⚠️ 파티 인원이 초과되었습니다 (남은 자리 '+(r.max-r.cur)+' / 필요 '+need+')'); };
    list.appendChild(el);
  });
}
function joinRoom(r){ if(r.status!=='wait'||r.cur>=r.max) return;
  const need=partySize(), free=r.max-r.cur;   // 파티 전원이 들어갈 자리 필요
  if(need>free){ if(typeof playSfx==='function') playSfx('ui_denied'); toast('⚠️ 파티 인원이 초과되었습니다 (남은 자리 '+free+' / 필요 '+need+')'); return; }
  if(r.real && rtRoomsActive()){   // 실제 방: 대기실 채널 presence로 입장
    rtRoomJoin(r.num, false);
    // ⚠ max 를 빼먹으면 참가자는 _lobbyMax 가 8 로 잡혀 **방 정원을 모른 채** 대기실을 그린다(2인 방이 8인 방으로 보였다)
    openLobby({real:true, num:r.num, name:r.name, host:r.host, hostUid:r.hostUid, startCount:r.cur, joining:true, visibility:r.visibility, diff:r.diff, inf:r.inf, max:r.max, opts:r.opts||null}); return; }
  openLobby({num:r.num, name:r.name, host:r.host, startCount:r.cur, joining:true, diff:r.diff, inf:r.inf, opts:r.opts||null}); }   // (오프라인 폴백) 시뮬 방
function quickJoin(){ const need=partySize(), wait=_roomList.filter(r=>r.status==='wait'&&(r.max-r.cur)>=need);
  if(!wait.length){ if(need>1){ toast('⚠️ 파티가 들어갈 빈 자리가 있는 방이 없습니다'); return; } createRoom(); return; }   // 빈 방 없으면 새로 생성(혼자일 때)
  joinRoom(wait[Math.floor(Math.random()*wait.length)]); }
// 방 번호로 입장(친구의 비공개 방 포함)
function joinByNumber(){ const f=document.getElementById('roomNumField'); if(!f) return;
  const num=parseInt((f.value||'').replace(/\D/g,''),10);
  if(!num||num<1000){ toast('ℹ️ 방 번호 4자리를 입력하세요'); f.focus(); return; }
  const r=_roomList.find(x=>x.num===num);
  if(r){ if(r.status!=='wait'||r.cur>=r.max){ if(typeof playSfx==='function') playSfx('ui_denied'); toast(r.cur>=r.max?'⚠️ 방이 가득 찼습니다':'⚠️ 이미 게임 중인 방입니다'); return; }
    if(partySize()>(r.max-r.cur)){ if(typeof playSfx==='function') playSfx('ui_denied'); toast('⚠️ 파티 인원이 초과되었습니다 (남은 자리 '+(r.max-r.cur)+' / 필요 '+partySize()+')'); return; }
    f.value=''; if(r.visibility==='private') openPwPrompt(r); else joinRoom(r); return; }
  if(rtRoomsActive()){ toast('⚠️ 해당 번호의 방을 찾을 수 없습니다'); f.value=''; return; }   // 실방 모드: 없는 방은 없는 것
  // 목록에 없는 번호 → 친구의 비공개 방으로 입장(시뮬)
  f.value='';
  const host=LOBBY_NAMES[Math.floor(Math.random()*LOBBY_NAMES.length)];
  openLobby({num:num, name:'#'+num+' 방', host:host, startCount:1+Math.floor(Math.random()*4), joining:true, visibility:'private', diff:['easy','normal','normal','hard','hell'][Math.floor(Math.random()*5)]}); }
// 방 만들기 모달
let _createVis='public', _createDiff='easy', _createMax=8, _createInf=false;
// 최대 인원 = 1~8 칸 게이지. 고른 값까지 조용히 채우고 **고른 칸 하나만** 밑변이 발광한다.
// ⛔ 여덟 칸이 다 빛나면 뭘 골랐는지 안 보인다 — 채움과 선택을 다른 세기로 갈라 둘 것.
function setCpMax(m, silent){ m=Math.max(2,Math.min(8,m|0)); _createMax=m;
  const v=document.getElementById('cpMaxVal'); if(v) v.textContent=m+'명';
  const g=document.getElementById('cpMaxGrid');
  if(g){ let h=''; for(let i=1;i<=8;i++){ h+='<button type="button" class="cpPc'+(i<=m?' on':'')+(i===m?' sel':'')
      +'" onclick="setCpMax('+i+')"'+(i<2?' disabled':'')+'>'+i+'</button>'; } g.innerHTML=h; }
  if(!silent && typeof playSfx==='function') playSfx('ui_toggle'); }
// 난이도 = 난이도 선택 화면(#soloDiffPanel)과 **같은 컴포넌트**: ◀ 이름 ▶ + 점 + 상세 판 + 무한 모드 줄.
// ⛔ 여기에만 있는 난이도 UI 를 새로 만들지 말 것 — 두 화면이 어긋난다(옛 .cpDiffBtns pill 나열은 폐지).
function renderCpDiff(){ const nav=document.getElementById('cpDiffStep'), det=document.getElementById('cpDiffInfo');
  if(!nav||!det) return;
  const L=DIFFICULTY_ORDER, i=Math.max(0, L.indexOf(_createDiff)), col=DIFF_COLOR[L[i]]||'#fff';
  nav.style.setProperty('--dc', col); det.style.setProperty('--cc', col);
  nav.innerHTML='<div class="sdStepRow">'
    +'<button type="button" class="arwBtn" data-arw="l" onclick="stepCpDiff(-1)" aria-label="이전 난이도"'+(i>0?'':' disabled')+'></button>'
    +'<div class="sdStepTx">'+escHtml(DIFFICULTY[L[i]].name)+'</div>'
    +'<button type="button" class="arwBtn" data-arw="r" onclick="stepCpDiff(1)" aria-label="다음 난이도"'+(i<L.length-1?'':' disabled')+'></button>'
    +'</div><div class="sdDots">'+L.map(function(_,j){ return '<i class="'+(j===i?'on':'')+'"></i>'; }).join('')+'</div>';
  if(typeof paintArrows==='function') paintArrows(nav);
  const D=DIFFICULTY[L[i]], atk=(D.enemyHp/DIFFICULTY.easy.enemyHp).toFixed(1);
  det.innerHTML='<div class="cpVsSt"><span><i>적 HP</i><b>×'+atk+'</b></span>'
    +'<span><i>포인트 획득량</i><b>×'+D.coinMult+'</b></span></div>'
    +'<div class="cpVsNote">'+((typeof SD_DESC!=='undefined'&&SD_DESC[L[i]])||'')+'</div>';
  det.classList.toggle('dim', !!_createInf);   // 무한 모드가 켜지면 난이도는 뜻이 없다(노말 고정)
  const el=document.getElementById('cpInfBtn');
  if(el){ el.className='sdInf'+(_createInf?' on':'');
    el.innerHTML='<b>∞ 무한 모드</b><em>'+(_createInf?'켜짐 · 노말 고정':'노말 고정 · 끝없이 도전')+'</em>'; } }
function stepCpDiff(d){ const L=DIFFICULTY_ORDER, i=L.indexOf(_createDiff), n=i+d;
  if(n<0||n>=L.length) return; setCpDiff(L[n]); }
function setCpDiff(d){ if(!DIFFICULTY[d]) return; _createDiff=d; _createInf=false; renderCpDiff(); if(typeof playSfx==='function') playSfx('ui_tab'); }
function setCpInf(){ _createInf=!_createInf; renderCpDiff(); if(typeof playSfx==='function') playSfx('ui_confirm'); }   // 무한 모드 토글 = 난이도 대신 무한(노말 고정)
function mapHasDiff(){ return !(typeof _selMap!=='undefined' && _selMap && _selMap.noDiff); }   // 대인전 유즈맵 = 난이도 개념 없음
// ══════════ 🎛 오토 배틀 대전 설정 — 방장이 정하고 방 전원에게 적용된다 ══════════
// ⚠ **상하한은 이 표 한 곳에서만 정한다.** 슬라이더·스테퍼·프리셋·검증이 전부 여기를 본다.
//   값을 바꾸면 밸런스가 바뀐다 — 기본값은 USEMAPS.cpu.cfg 와 같아야 한다(일반 모드 = 오버라이드 없음).
const STK_OPTS=[
  {k:'cycleTime', name:'라운드 길이', unit:'초', def:20,  min:10,  max:40,   step:5},
  {k:'startGold', name:'시작 골드',   unit:'G',  def:450, min:200, max:1000, step:50},
  {k:'incomeBase',name:'라운드 수입', unit:'G',  def:50,  min:25,  max:100,  step:5},
  {k:'hpMul',     name:'본진 체력',   unit:'',   def:1,   min:0.5, max:2,    step:0.1, mul:true},   // 신전 3종에 함께 곱한다
];
const STK_OPT_BY={}; STK_OPTS.forEach(function(o){ STK_OPT_BY[o.k]=o; });
// 프리셋 = 대부분이 여기서 끝난다. custom 만 아래 세부가 열린다.
const STK_PRESETS=[
  {id:'normal', name:'일반',        sub:'기본 밸런스',  ov:null},
  {id:'blitz',  name:'속도전',      sub:'10초 · 골드↑', ov:{cycleTime:10,startGold:700,incomeBase:70,hpMul:0.7}},
  {id:'custom', name:'사용자 지정', sub:'직접 조절',    ov:'custom'},
];
let _createPre='normal', _createOpts=null;   // _createOpts = 사용자 지정 값(키→값). 일반/프리셋이면 null
function stkOptClamp(k,v){ const o=STK_OPT_BY[k]; if(!o) return v;
  v=Math.max(o.min, Math.min(o.max, v));
  return o.mul ? Math.round(v*10)/10 : Math.round(v); }
function stkOptDefaults(){ const out={}; STK_OPTS.forEach(function(o){ out[o.k]=o.def; }); return out; }
function stkOptVal(k){ const o=STK_OPT_BY[k]; if(!o) return 0;
  return (_createOpts && _createOpts[k]!==undefined) ? _createOpts[k] : o.def; }
function stkOptText(k,v){ const o=STK_OPT_BY[k]; if(v===undefined) v=stkOptVal(k);
  return o.mul ? ('×'+v.toFixed(1)) : (v+(o.unit||'')); }
// 지금 고른 것 → 방에 실을 값. 일반(기본값 그대로)이면 null 이라 맵 cfg 가 그대로 이긴다.
function cpOptsPayload(){ const pre=STK_PRESETS.find(function(p){ return p.id===_createPre; });
  if(!pre || pre.ov===null) return null;
  const src = (pre.ov==='custom') ? (_createOpts||stkOptDefaults()) : Object.assign(stkOptDefaults(), pre.ov);
  const out={}; let any=false;
  STK_OPTS.forEach(function(o){ const v=stkOptClamp(o.k, src[o.k]); out[o.k]=v; if(v!==o.def) any=true; });
  return any ? out : null; }
// 방 설정 → 엔진 cfg 오버라이드. hpMul 은 신전 3종에 곱해 **구체값**으로 바꿔 둔다(엔진은 배율을 모른다).
function stkCfgFromOpts(o){ if(!o) return null;
  const base=(typeof USEMAPS!=='undefined' && USEMAPS.cpu && USEMAPS.cpu.cfg) || {}, out={};
  ['cycleTime','startGold','incomeBase'].forEach(function(k){ if(o[k]!==undefined) out[k]=o[k]; });
  const m=o.hpMul;
  if(m!==undefined && m!==1){ out.baseHp=Math.round((base.baseHp||13500)*m);
    out.secHp=Math.round((base.secHp||6750)*m); out.centralHp=Math.round((base.centralHp||4500)*m); }
  return Object.keys(out).length ? out : null; }
// 한 판 예상 길이 — 라운드 길이 × 예상 라운드 수(체력이 두꺼울수록 오래 간다). 감을 주는 값이지 규칙이 아니다.
function stkEstMin(o){ o=o||{}; const ct=o.cycleTime||STK_OPT_BY.cycleTime.def, hp=o.hpMul||1,
    inc=o.incomeBase||STK_OPT_BY.incomeBase.def;
  const rounds=Math.round(26*hp*(STK_OPT_BY.incomeBase.def/inc));
  return Math.max(2, Math.round(ct*rounds/60)); }
function setCpPreset(id){ if(!STK_PRESETS.some(function(p){ return p.id===id; })) return;
  _createPre=id; if(id==='custom' && !_createOpts) _createOpts=stkOptDefaults();
  renderCpMode(); if(typeof playSfx==='function') playSfx('ui_tab'); }
function stepCpOpt(k,d){ const o=STK_OPT_BY[k]; if(!o) return;
  if(!_createOpts) _createOpts=stkOptDefaults();
  _createOpts[k]=stkOptClamp(k, _createOpts[k]+d*o.step);
  renderCpMode(); if(typeof playSfx==='function') playSfx('ui_toggle'); }
function renderCpMode(){ const box=document.getElementById('cpMode'); if(!box) return;
  if(mapHasDiff()){ box.innerHTML=''; return; }   // 난이도 있는 유즈맵은 이 구역을 안 쓴다
  const cus=(_createPre==='custom'), pay=cpOptsPayload()||stkOptDefaults();
  let h='<span class="cpLabel">대전 설정</span><div class="cpPre">'
    +STK_PRESETS.map(function(p){ return '<button type="button" class="cpPreC'+(p.id===_createPre?' on':'')
      +(p.id==='custom'?' cu':'')+'" onclick="setCpPreset(\''+p.id+'\')"><b>'+p.name+'</b><i>'+p.sub+'</i></button>'; }).join('')
    +'</div>';
  if(!cus){   // 프리셋 = 결과를 카드로 보여 준다(난이도 상세 판과 같은 자리·모양)
    h+='<div class="cpVs"><div class="cpVsBd"><span class="vsDot"></span>4<em>vs</em>4<span class="vsDot b"></span></div>'
      +'<div class="cpVsSt">'+STK_OPTS.map(function(o){ return '<span><i>'+o.name+'</i><b>'+stkOptText(o.k,pay[o.k])+'</b></span>'; }).join('')
      +'</div><div class="cpVsNote">인원이 8명이면 4 대 4로 자동 편성 · 한 판 약 '+stkEstMin(pay)+'분</div></div>';
  } else {    // 사용자 지정 = 같은 자리에서 스테퍼로 조절. 범위 밖은 눌러도 안 움직인다
    h+='<div class="cpVs cu"><div class="cpOptRows">'
      +STK_OPTS.map(function(o){ const v=stkOptVal(o.k);
        return '<div class="cpOptRow"><b>'+o.name+'</b>'
          +'<span class="cpOptSt"><button type="button" class="arwBtn" data-arw="l" onclick="stepCpOpt(\''+o.k+'\',-1)" aria-label="줄이기"'+(v<=o.min?' disabled':'')+'></button>'
          +'<span class="cpOptV">'+stkOptText(o.k,v)+'</span>'
          +'<button type="button" class="arwBtn" data-arw="r" onclick="stepCpOpt(\''+o.k+'\',1)" aria-label="늘리기"'+(v>=o.max?' disabled':'')+'></button></span>'
          +'<em class="cpOptRng">'+stkOptText(o.k,o.min)+' ~ '+stkOptText(o.k,o.max)+'</em></div>'; }).join('')
      +'</div><div class="cpVsNote">밸런스 범위 안에서만 움직입니다 · 한 판 약 '+stkEstMin(pay)+'분</div></div>';
  }
  box.innerHTML=h;
  if(typeof paintArrows==='function') paintArrows(box); }
function createRoom(){ const nm=document.getElementById('cpName'); if(nm) nm.value=''; const pw=document.getElementById('cpPw'); if(pw) pw.value=''; setRoomVis('public'); _createDiff='easy'; _createInf=false; renderCpDiff(); setCpMax(8, true);
  _createPre='normal'; _createOpts=null; renderCpMode();   // 대전 설정은 항상 '일반'에서 시작한다
  { const hd=mapHasDiff(), ds=document.getElementById('cpDiffSec'), cd=document.querySelector('#createPanel .cpCard');
    if(ds) ds.style.display=hd?'':'none'; if(cd) cd.classList.toggle('noDiff', !hd); }   // 난이도 구역 표시 여부
  const cp=document.getElementById('createPanel'); cp.classList.remove('hide');   // 방 찾기 → 방 만들기는 즉시 전환(팝업 효과 없음)
  if(typeof paintIcons==='function') paintIcons(cp); if(nm) nm.focus(); }
function closeCreate(){ popHide('createPanel'); }
function setRoomVis(v){ _createVis=v;
  document.querySelectorAll('#cpVis .cpSegBtn').forEach(b=>b.classList.toggle('on', b.dataset.v===v));
  const w=document.getElementById('cpPwWrap'); if(w) w.classList.toggle('hide', v!=='private');
  const h=document.getElementById('cpHint'); if(h){ h.style.color=''; h.textContent=''; } }   // 안내 텍스트 제거(에러만 표시)
function confirmCreate(){ const nmEl=document.getElementById('cpName');
  const name=((nmEl&&nmEl.value)||'').trim()||'나의 대기실';
  let pw=''; if(_createVis==='private'){ const pwEl=document.getElementById('cpPw'); pw=((pwEl&&pwEl.value)||'').replace(/\s/g,'');
    if(!pw){ const h=document.getElementById('cpHint'); if(h){ h.textContent='비공개 방은 비밀번호를 설정해야 합니다.'; h.style.color='#ff6b6b'; } if(pwEl) pwEl.focus(); return; } }
  closeCreate();
  if(rtRoomsActive()){   // 실제 방 생성: rooms 채널에 게시 + 대기실 채널 입장
    const meta={ num:newRoomNum(), name:name, host:myNick(), hostUid:myUid(), cur:1, max:_createMax, status:'wait',
                 visibility:_createVis, pw:pw, diff:_createDiff, inf:_createInf, opts:cpOptsPayload(), createdAt:Date.now() };
    rtRoomsEnsure(); rtRoomPublish(meta); rtRoomJoin(meta.num, true);
    openLobby(Object.assign({real:true, joining:false, startCount:1}, meta)); return; }
  openLobby({num:newRoomNum(), name:name, host:myNick(), startCount:1, joining:false, visibility:_createVis, pw:pw, diff:_createDiff, inf:_createInf, max:_createMax, opts:cpOptsPayload()}); }   // (오프라인 폴백) 시뮬 방
// 비공개 방 비밀번호 입력
let _pwRoom=null;
function openPwPrompt(r){ _pwRoom=r;
  document.getElementById('pwRoomName').textContent='#'+r.num+'  '+r.name;
  const f=document.getElementById('pwField'); if(f){ f.value=''; } document.getElementById('pwErr').textContent='';
  const pp=document.getElementById('pwPanel'); pp.classList.remove('hide'); if(typeof fxPop==='function') fxPop(pp.querySelector('.cpCard')); if(typeof playSfx==='function') playSfx('ui_open'); if(typeof paintIcons==='function') paintIcons(pp); if(f) f.focus(); }
function closePw(){ popHide('pwPanel'); _pwRoom=null; }
function submitPw(){ if(!_pwRoom) return; const f=document.getElementById('pwField');
  const v=((f&&f.value)||'').replace(/\s/g,'');
  if(v===_pwRoom.pw){ const r=_pwRoom; closePw(); joinRoom(r); }
  else { if(typeof playSfx==='function') playSfx('ui_denied'); document.getElementById('pwErr').textContent='비밀번호가 일치하지 않습니다.'; if(f){ f.value=''; f.focus(); } } }
function startGameNow(activePlayers, myNum, names){
  MAP=(typeof _selMap!=='undefined' && _selMap && USEMAPS[_selMap.id]) || USEMAPS.nemo; if(typeof applyMapBalance==='function') applyMapBalance();   // 현재 유즈맵 확정 + 맵별 밸런스 주입
  // 방장이 정한 대전 설정 — 없으면 null 이라 맵 cfg 가 그대로 이긴다
  MAP_CFG_OVR = (typeof stkCfgFromOpts==='function' && typeof _lobbyRoom!=='undefined' && _lobbyRoom)
    ? stkCfgFromOpts(_lobbyRoom.opts) : null;
  if(typeof resetGameChrome==='function') resetGameChrome();   // 이전 맵 잔재 제거 후 각 모드가 자기 크롬을 켠다(진입 시점 초기화 = 종료 경로와 무관하게 항상 깨끗)
  if(mapCfg('mode')==='strike'){ strikeStart(activePlayers, myNum, names); return; }   // 직스 모드 → 독립 모듈(nemo 우회). (3D 에셋은 추후 단계에서 loadMapModels)
  if(mapCfg('mode')==='sandbox'){ enterSandbox(); return; }   // 관리자용 샌드박스 — 게임 진행 X, 유닛 진열·기본값 편집
  if(typeof bgmStop==='function') bgmStop();   // 게임 진입 시 로비 BGM 정지
  G=newGame(); G.phase='playing'; G.difficulty=(mapCfg('fixedDiff')||_selDiff); G.roundPhase='prep'; G.roundTime=mapCfg('prepTime',PREP_TIME); G.toSpawn=0;
  if(typeof loadAutoCfg==='function') loadAutoCfg();   // 저장된 자동설정·랠리 위치 복원(판 사이 유지)
  G.loading=true;   // 로딩(카운트다운/준비) 동안 게임 시간 정지 → 시작하면 10초부터
  G.activePlayers = (activePlayers&&activePlayers.length)? activePlayers.slice() : [1,2,3,4,5,6,7,8];   // 입장한 플레이어
  G.myPlayer = myNum||1;   // 입장 순서로 배정된 내 번호
  G.playerNames = names || {};   // 플레이어 번호별 닉네임(로비에서 전달)
  // ── 메타 빌드 효과 적용(개인) ──
  G.metaB = metaBonus();                                  // 이번 판 효과 캐시
  G.mineral += G.metaB.startCredit; G.gas += G.metaB.startEnergy;   // 시작 크레딧/에너지 지급
  G.guarTickets = G.metaB.guaranteed;                     // 확정 뽑기권(레어+ 보장)
  if(mapCfg('coopBoss',true)) spawnCoopBoss(1);            // 공용 보스(맵 설정으로 켜고 끔)
  for(let ti=0; ti<(G.metaB.startTurret||0) && ti<FIXED_SLOTS.turret.length; ti++){ const tp=FIXED_SLOTS.turret[ti];   // 메타: 시작 포탑(레벨당 1기, 최대 3기 무료 배치)
    G.units.push(initUnitStats({uid:G.idSeq++, id:'turret', hero:false, lv:1, x:tp.x, y:tp.y, cd:0, fixed:true})); }
  initPlayerSim();         // 다른 플레이어 트랙 적 누적 시뮬 초기화
  if(typeof fogInit==='function') fogInit();   // 🌫️ 전장의 안개 초기화(맵별 cfg.fog 토글 — 기본 off)
  _leaveT=20+Math.random()*20;
  document.getElementById('ov').classList.add('hide');
  const lb=document.getElementById('lobby'); if(lb) lb.classList.add('hide');
  setInGame(true);
  G.mainSheet='gacha'; _setBottomTab('Unit');   // 첫 진입 기본 섹션 = 유닛뽑기(하단 시트 + 탭 하이라이트)
  renderUnits(); updateHud(); placeMergeZone();
  gameStartCountdown();   // G 셋업 후: 미니맵+설명 / 3·2·1 / 플레이어·시작 준비(폰 전체 덮음)
}
// ══ 자리(슬롯) 상태 — 단일 소스 ══════════════════════════════
// 관전 그리드·관전 렌더·적 카운트·3D 가 전부 이 함수 하나만 본다.
//   me    = 나
//   live  = 게임 중인 다른 플레이어(관전 가능)
//   dead  = 탈락했거나 나간 자리 → **죽은 자리**. 아무것도 그리지 않는다.
//   empty = 애초에 아무도 안 들어온 자리 → 죽은 자리와 같게 취급
// ⛔ 여기 말고 다른 곳에서 activePlayers/eliminated 를 직접 뒤져 판정하지 말 것.
function slotState(n){ n=+n; if(!n) return 'empty';
  if(n===((typeof G!=='undefined'&&G&&G.myPlayer)||1)) return 'me';
  if(((G&&G.finished)||[]).indexOf(n)>=0) return 'done';   // 승리 = 정지된 자리(유닛은 그대로 · 관전만 가능)
  if(G&&G.away&&G.away[n]!=null) return 'away';            // 연결 끊김 = 자리를 잡아 둔 상태(AWAY_MS 안에 돌아오면 복귀)
  const act=(G&&G.activePlayers)||null;
  if(!act) return 'live';                                  // 명단 자체가 없는 화면(샌드박스 등) = 옛 동작 유지
  if(act.indexOf(n)>=0) return 'live';
  if(((G&&G.eliminated)||[]).indexOf(n)>=0) return 'dead';
  return 'empty'; }
function slotDead(n){ const st=slotState(n); return st==='dead'||st==='empty'; }   // 아무것도 그리지 않는 자리
function slotWatchable(n){ const st=slotState(n); return st==='live'||st==='done'||st==='away'; }   // 관전 가능한 자리
// ══ 재접속 ═══════════════════════════════════════════════════
// ⚠ presence leave 는 '일부러 나감'과 '연결 끊김'을 구분하지 못한다 — 둘 다 같은 신호다.
//   그래서 일부러 나갈 땐 bye 를 따로 쏘고, bye 없이 사라진 것은 **끊긴 것으로 보고 자리를 잡아 둔다**.
const AWAY_MS=30000;   // 이 시간 안에 돌아오면 자리 복귀. 넘기면 영구 죽은 자리.
// 연결이 끊긴 자리 — 지우지 않는다. 보드를 얼려 두고 관전은 계속 되게 한다.
function awaySlot(n, nick){ n=+n; if(!n||typeof G==='undefined'||!G) return;
  if(n===(G.myPlayer||1)) return;
  if(slotState(n)!=='live') return;                        // 이미 죽었거나·정지했거나·away 면 건드리지 않는다
  (G.away=G.away||{})[n]=Date.now()+AWAY_MS;
  addChat('', '📡 '+(nick||('P'+n))+'님의 연결이 끊겼습니다 — '+Math.round(AWAY_MS/1000)+'초 안에 돌아오면 이어집니다.');
  if(G.tab==='Players'){ if(typeof renderPlayers==='function') renderPlayers();
    if(typeof updateSpecLabel==='function') updateSpecLabel(); } }
// 돌아왔다 — 자리 복귀. 보드는 지운 적이 없으니 그대로 이어진다.
function reviveSlot(n, nick){ n=+n; if(!n||typeof G==='undefined'||!G) return false;
  if(!G.away || G.away[n]==null) return false;
  delete G.away[n];
  if((G.activePlayers=G.activePlayers||[]).indexOf(n)<0) G.activePlayers.push(n);
  addChat('', '✓ '+(nick||('P'+n))+'님이 돌아왔습니다.');
  if(typeof computeSpeed==='function') computeSpeed();
  if(typeof renderVote==='function') renderVote();
  if(G.tab==='Players'){ if(typeof renderPlayers==='function') renderPlayers();
    if(typeof updatePlayerCounts==='function') updatePlayerCounts();
    if(typeof updateSpecLabel==='function') updateSpecLabel(); }
  return true; }
// 대기 시간 초과 검사 — tickPresence(매 프레임, phase 무관)에서 돈다
function tickAway(){ if(typeof G==='undefined'||!G||!G.away) return;
  const now=Date.now();
  for(const k in G.away){ if(G.away[k]<=now){ const n=+k; delete G.away[n];
      addChat('', '📡 P'+n+'님이 돌아오지 못했습니다.');
      killSlot(n,'lost'); } } }
// 승리한 자리 — 죽이지 않는다. 마지막 스냅을 그대로 얼려 두고 관전만 계속 되게 한다.
function finishSlot(n, nick){ n=+n; if(!n||typeof G==='undefined'||!G) return;
  if(n===(G.myPlayer||1)) return;
  if((G.finished=G.finished||[]).indexOf(n)>=0) return;
  G.finished.push(n);
  addChat('', '🏁 '+(nick||('P'+n))+'님이 방어에 성공했습니다 — 그 자리는 정지되었습니다.');
  if(G.tab==='Players'){ if(typeof renderPlayers==='function') renderPlayers();
    if(typeof updateSpecLabel==='function') updateSpecLabel(); } }
// 자리를 죽인다 — 탈락(lost)·이탈(left) 이 **같은 정리**를 탄다.
// ⚠ 숨기는 게 아니라 지운다(CLAUDE.md 「잔상 금지」) — 남겨 두면 관전 보드가 얼어붙은 채로 계속 보인다.
function killSlot(n, reason, nick){ n=+n; if(!n||typeof G==='undefined'||!G) return;
  if(n===(G.myPlayer||1)) return;                                   // 내 자리는 여기서 죽이지 않는다(패배 처리는 따로)
  const i=(G.activePlayers||[]).indexOf(n);
  if(i<0 && (G.eliminated||[]).indexOf(n)>=0) return;               // 이미 죽은 자리 — 중복 처리 금지
  if(i>=0) G.activePlayers.splice(i,1);
  if((G.eliminated=G.eliminated||[]).indexOf(n)<0) G.eliminated.push(n);
  const hadTeam=!!(G.coopTeamB && G.coopTeamB[n]);
  ['coopBoard','coopBoardPrev','coopState','coopBossU','coopTeamB','coopSpeed','coopUpg','vote'].forEach(k=>{ if(G[k]) delete G[k][n]; });
  if(G.away) delete G.away[n];                                       // 죽은 자리는 더 이상 돌아올 자리가 아니다
  if(G.coopWatchers && G.coopNumToUid && G.coopNumToUid[n]) delete G.coopWatchers[G.coopNumToUid[n]];   // 죽은 자리는 더 이상 나를 보지 않는다
  if(G.pSim && G.pSim[n]) G.pSim[n].dead=true;                      // 봇 시뮬도 같은 규칙
  if(hadTeam && typeof metaBonus==='function') G.metaB=metaBonus(); // 이탈자 팀 강화 제외 → 재계산(이미 준 미네랄은 회수하지 않는다)
  if(G.curPlayer===n){                                              // 이 자리를 보고 있었으면 내 화면으로
    const other=(G.activePlayers||[]).filter(x=>x!==(G.myPlayer||1));
    G.curPlayer=other[0]||(G.myPlayer||1);
    if(window.M3D && window.M3D.clearGameModels) window.M3D.clearGameModels();   // 남의 유닛 모델 잔상 제거
    if(G.tab==='Players'){ if(typeof drawPlayer==='function') drawPlayer(); if(typeof updateSpecLabel==='function') updateSpecLabel(); } }
  addChat('', reason==='left' ? ('ℹ️ '+(nick||('P'+n))+'님이 게임에서 나갔습니다.')
                              : ('⚠️ '+n+'번 플레이어가 탈락하였습니다.'));
  if(typeof computeSpeed==='function') computeSpeed();
  if(typeof renderVote==='function') renderVote();
  if(G.tab==='Players'){ if(typeof renderPlayers==='function') renderPlayers();
    if(typeof updatePlayerCounts==='function') updatePlayerCounts();
    if(typeof updateSpecLabel==='function') updateSpecLabel(); } }
// 게임 중 플레이어 탈락 → 죽은 자리로(옛 이름 유지 — 호출부가 여럿)
function playerLeave(n){ killSlot(n, 'lost'); }
let _leaveT=1e9;
// ── 멀티 플레이어 시뮬레이션: 각 플레이어 트랙의 적 누적 수(나는 실제 G.enemies, 나머지는 시뮬) ──
function initPlayerSim(){ G.pSim={}; const mine=G.myPlayer||1;
  (G.activePlayers||[]).forEach(n=>{ if(n===mine) return;
    G.pSim[n]={ count:0, skill:0.78+Math.random()*0.55, w1:false, w2:false, dead:false }; }); }
function playerEnemyCount(n){ const mine=G.myPlayer||1;
  if(n===mine) return G.enemies.length;
  if(slotDead(n)) return 0;   // 죽은 자리·빈 자리 = 아무것도 없다(마지막 값이 얼어붙어 남지 않게)
  if(G.coop && G.coopState && G.coopState[n]) return G.coopState[n].count;   // 협동: 실제 상대 적 수
  const s=G.pSim&&G.pSim[n]; return s? Math.round(s.count) : 0; }
function tickPlayerSim(dt){ if(G.phase!=='playing'||!G.pSim||G.coop) return;   // 협동: 시뮬 대신 실제 상태 사용
  const ed=dt*(G.speedMul||1);   // 게임 속도 반영
  const spawning=(G.roundPhase==='active' && !isBossRound(G.round) && G.roundTime>mapCfg('roundTime',ROUND_TIME)-80);  // 전투 첫 80초 유입
  const arrival=spawning ? (1/SPAWN_GAP) : 0;   // 초당 적 유입(=1.25)
  for(const k in G.pSim){ const n=+k, s=G.pSim[k]; if(s.dead) continue;
    const clear=Math.max(0, s.skill*0.78 - G.round*0.016);   // 초당 처리량(라운드↑일수록 버거움)
    s.count=Math.max(0, s.count + (arrival-clear)*ed);
    if(s.count>=WARN2){ if(!s.w2){ s.w2=true; addChat('', '⚠️ '+n+'번 플레이어 적 '+WARN2+'기 누적!'); } } else if(s.count<WARN2-10) s.w2=false;
    if(s.count>=WARN1){ if(!s.w1){ s.w1=true; addChat('', '⚠️ '+n+'번 플레이어 적 '+WARN1+'기 누적'); } } else if(s.count<WARN1-10) s.w1=false;
    if(s.count>=mapCfg('loseCount',LOSE_COUNT)){ s.dead=true; killSlot(n,'lost'); }   // 200 누적 → 죽은 자리
  } }
function tickPresence(dt){ tickPlayerSim(dt); tickAway(); }   // 루프 훅 → 플레이어 시뮬 + 재접속 대기 만료
// ══ 협동(파티) 게임 실시간 동기화: 배속/일시정지/채팅/관전상태 공유 ══
function coopActive(){ return !!(typeof G!=='undefined' && G && G.coop && G.coopChan); }
let _netFailT=0;
function netFail(){ const now=Date.now(); if(now-_netFailT<5000) return; _netFailT=now;   // 5초 스로틀
  if(typeof toast==='function') toast('⚠️ 네트워크 전송 실패 — 연결 상태를 확인하세요'); }
// 협동 권위자 = 접속 중인 가장 낮은 번호(이탈 시 자동 승계). 보스 HP 등 공유 상태의 기준
function coopAuthNum(){ if(!G||!G.coopNumToUid) return (G&&G.myPlayer)||1;
  // ⚠ 연결이 끊긴(away)·죽은 자리는 권위자가 될 수 없다 — 그 사람이 최저 번호면 보스 HP 동기화가 통째로 멈춘다
  const nums=Object.keys(G.coopNumToUid).map(Number).filter(n=>n===(G.myPlayer||1) || slotState(n)==='live');
  return nums.length?Math.min.apply(null,nums):(G.myPlayer||1); }
// 협동 채널 재접속(지수 백오프, 최대 5회). 게임 중 끊겼을 때만
let _coopRetryN=0;
function coopReconnect(){ if(!G || G.phase!=='playing' || !G.coopSlotInfo) return;
  if(_coopRetryN>=5){ addChat('', '⚠️ 재접속에 실패했습니다. 협동 동기화 없이 계속 진행합니다.'); return; }
  _coopRetryN++;
  if(_coopRetryN===1) addChat('', '⚠️ 연결이 끊겼습니다 — 재접속 시도 중…');
  setTimeout(()=>{ if(G && G.phase==='playing' && G.coopSlotInfo) startGameCoop(G.coopSlotInfo); }, 1500*_coopRetryN); }
// 브라우저 네트워크 상태 — 끊김 알림 + 복귀 시 자동 재접속
window.addEventListener('offline', ()=>{ if(typeof toast==='function') toast('⚠️ 네트워크 연결이 끊겼습니다'); });
// 탭이 버려지기 직전 — visibilitychange 가 안 오는 경로(앱 종료·탭 정리)에서도 판을 남긴다
window.addEventListener('pagehide', ()=>{ try{ if(typeof saveRun==='function') saveRun(); }catch(e){} });
document.addEventListener('visibilitychange', ()=>{   // 백그라운드 탭: 10Hz 송신 정지(대역·배터리 절약), 복귀 시 재개
  if(document.hidden){ if(typeof profStampSeen==='function') profStampSeen();   // 🧍 숨김 = 방치 시각 스탬프(오프라인 정산 기준)
    if(typeof nemoOnHide==='function') nemoOnHide();   // 유즈맵 판: 자리 비운 시각 기록(돌아올 때 따라잡기/판 포기 판정)
    if(typeof G!=='undefined' && G && G.coopStateT){ clearInterval(G.coopStateT); G.coopStateT=null; } }
  else {
    if(typeof nemoOnShow==='function') nemoOnShow();   // ⚠ 먼저 부른다 — 30초 초과면 여기서 판을 접고 로비로 간다
    if(typeof G!=='undefined' && G && !G.coopStateT && typeof coopActive==='function' && coopActive()){ G.coopStateT=setInterval(coopBroadcastState, 100); } } });
window.addEventListener('online', ()=>{ if(typeof toast==='function') toast('✓ 네트워크가 다시 연결되었습니다');
  _coopRetryN=0;   // ⚠ 리셋하지 않으면 상한(5회)에 걸린 채라 coopReconnect 가 즉시 return 한다 — 네트워크가 돌아와도 영영 재접속이 안 됐다
  if(G && G.phase==='playing' && G.coopSlotInfo && !coopActive()) coopReconnect();
  if(typeof RTROOM!=='undefined' && RTROOM.listChan===null && typeof rtRoomsActive==='function' && rtRoomsActive()) rtRoomsEnsure(); });
function onCoopBossDmg(p){ if(!p||p.uid===myUid()) return; const num=(G.coopUidToNum&&G.coopUidToNum[p.uid])||p.num||0;
  if(typeof coopBossDamage==='function') coopBossDamage(p.amt||0, num, true); }
// ══ 관전 신호 — 전장 데이터를 '보는 사람이 있을 때만' 보내기 위한 것 ══════
// ⚠ 이게 없으면 아무도 안 보는데도 유닛·적·탄 전부를 10Hz 로 계속 뿌린다
//   (실측: R30 에서 한 번에 11.3KB · 8인방이면 각자 초당 790KB 를 받는다).
// 바뀔 때만 보낸다 — 프레임마다 비교만 하므로 공짜다.
function coopWatchSync(){ if(typeof coopActive!=='function'||!coopActive()) return;
  const t=(G.tab==='Players' && G.curPlayer!==(G.myPlayer||1)) ? (G.curPlayer||0) : 0;
  if(t===G._watchSent) return; G._watchSent=t; coopSend('watch',{ num:t }); }
function onCoopWatch(p){ if(!p||p.uid===myUid()) return; (G.coopWatchers=G.coopWatchers||{})[p.uid]=+p.num||0; }
// 나를 보고 있는 사람이 하나라도 있나
function iAmWatched(){ const me=G.myPlayer||1, w=G.coopWatchers; if(!w) return false;
  for(const k in w){ if(w[k]===me) return true; } return false; }
// 누군가 토벌장을 열고 있나 — 열려 있으면 파견 유닛(bu)과 보스 상태를 제때 보내야 한다
function anyBossArenaOpen(){ if(G.bossOpen) return true;
  const st=G.coopState||{}; for(const k in st){ if(st[k]&&st[k].bo) return true; } return false; }
// 상대 판 종료 수신 — 이게 없으면 상대가 져도 내 화면에선 영원히 살아 있다
function onCoopOver(p){ if(!p||p.uid===myUid()) return;
  const num=(G.coopUidToNum&&G.coopUidToNum[p.uid])||p.num; if(!num) return;
  if(p.result==='won') finishSlot(num);            // 승리 = 정지(유닛 그대로 · 계속 관전 가능)
  else killSlot(num, 'lost'); }                    // 패배 = 죽은 자리(전부 지운다)
function startGameCoop(slotInfo){ stopGameCoop();
  if(!(typeof RT!=='undefined' && RT.active && _lobbyRoom && (_lobbyRoom.party||_lobbyRoom.real))) return;
  const ids=(slotInfo||[]).filter(s=>s.uid); if(ids.length<2) return;   // 실제 파티원 2명 이상만
  G.coop=true; G.coopSlotInfo=ids.slice(); G.coopNumToUid={}; G.coopUidToNum={}; G.coopState={}; G.coopBoard={}; G.coopBoardPrev={}; G.coopSpeed={}; G.coopUpg={}; G.coopBossU={}; G.coopTeamB={};
  G._tbPeak=(G.metaB&&G.metaB.startCredit)||0;   // 팀 강화 소급 지급의 기준선(재접속 중복 지급 방지)
  ids.forEach(s=>{ G.coopNumToUid[s.num]=s.uid; G.coopUidToNum[s.uid]=s.num; });
  const sid=(_lobbyRoom&&_lobbyRoom.num)||(RT.partyId)||'g';   // 방 번호로 동일 채널(양쪽 공유)
  const topic='game-'+sid;
  try{ (_sb.getChannels()||[]).forEach(c=>{ if(c.topic===topic||c.topic==='realtime:'+topic) _sb.removeChannel(c); }); }catch(e){}   // 재진입 시 기존 채널 정리
  try{
    G.coopChan=_sb.channel(topic, { config:{ broadcast:{ self:false }, presence:{ key:myUid() } } });
    G.coopChan.on('broadcast',{event:'speed'}, m=>onCoopSpeed(m.payload))
      .on('broadcast',{event:'pause'}, m=>onCoopPause(m.payload))
      .on('broadcast',{event:'gchat'}, m=>onCoopChat(m.payload))
      .on('broadcast',{event:'pstate'}, m=>onCoopState(m.payload))
      .on('broadcast',{event:'bossdmg'}, m=>onCoopBossDmg(m.payload))   // 공용 보스 데미지 공유
      .on('broadcast',{event:'over'}, m=>onCoopOver(m.payload))   // 상대 판 종료(패배=죽은 자리 · 승리=정지된 자리)
      .on('broadcast',{event:'watch'}, m=>onCoopWatch(m.payload))   // 누가 누구를 관전 중인가(전장 데이터 송신 여부를 정한다)
      .on('broadcast',{event:'bye'}, m=>onCoopBye(m.payload))       // 일부러 나감(끊김과 구분)
      .on('broadcast',{event:'hello'}, m=>onCoopHello(m.payload))   // 누가 재접속했다 → 내가 아는 것을 답한다
      .on('broadcast',{event:'resync'}, m=>onCoopResync(m.payload)) // 끊긴 동안 지나간 사건 복구
      .on('presence',{event:'join'}, e=>{ (e.newPresences||[]).forEach(s=>onCoopPlayerBack(s)); })   // 재접속 감지
      .on('presence',{event:'leave'}, e=>{ (e.leftPresences||[]).forEach(s=>onCoopPlayerLeft(s)); })   // 이탈 감지 — 끊김으로 보고 자리를 잡아 둔다
      .subscribe(function(st){ if(st==='SUBSCRIBED'){ try{ G.coopChan.track({uid:myUid(), num:G.myPlayer||1, nick:myNick()}); }catch(e){}
        ensureVote(); G.vote[G.myPlayer||1]=1; G.coopSpeed[G.myPlayer||1]=1; coopSend('speed',{mul:1}); computeSpeed();
        G._watchSent=-1;   // 재구독 = 관전 대상 다시 알린다(안 하면 상대가 '아무도 안 본다'로 오해한다)
        if(G._coopJoined) coopSend('hello',{ num:G.myPlayer||1 });   // 첫 입장이 아니면 = 재접속 → 놓친 것을 받아온다
        G._coopJoined=true;
        if(_coopRetryN){ _coopRetryN=0; addChat('', '✓ 재접속 완료 — 협동 동기화가 복구되었습니다.'); }
      } else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'){ coopReconnect(); } });   // 끊김 → 백오프 재접속(CLOSED는 의도적 종료라 제외
    G.coopStateT=setInterval(coopBroadcastState, 100);   // 10Hz 스냅 → 보간/외삽으로 매끄럽게
  }catch(e){ console.warn('startGameCoop', e); G.coop=false; G.coopChan=null; } }
function stopGameCoop(){ if(typeof G==='undefined'||!G) return;
  if(G.coopChan){ try{ _sb.removeChannel(G.coopChan); }catch(e){} G.coopChan=null; }
  if(G.coopStateT){ clearInterval(G.coopStateT); G.coopStateT=null; } G.coop=false; }
function coopSend(ev, payload){ if(!coopActive()) return;
  if(G.coopChan.state && G.coopChan.state!=='joined') return;   // 채널 join 전/끊김 중엔 송신 보류(REST 폴백 방지)
  try{ G.coopChan.send({type:'broadcast', event:ev, payload:Object.assign({uid:myUid()}, payload)}); }catch(e){ netFail(); } }
function onCoopSpeed(p){ if(!p||p.uid===myUid()) return; const num=G.coopUidToNum[p.uid]; const old=G.speedMul;
  if(num) G.coopSpeed[num]=p.mul;   // 상대 투표 기록
  computeSpeed();   // 효과 배속 = 전원 투표 최소
  if(G.speedMul!==old){ addChat('', 'ℹ️ 게임 배속 '+old+'배 → '+G.speedMul+'배'); if(typeof playSfxT==='function') playSfxT('speed',300); }
  if(typeof renderVote==='function') renderVote(); }
// presence 에서 사라졌다 — **끊긴 것으로 본다**(일부러 나갔으면 bye 가 먼저 온다).
// ⛔ 여기서 바로 killSlot 하지 말 것: 지하철 순단에도 판에서 영구 제외돼 버린다.
function onCoopPlayerLeft(s){ if(!s||s.uid===myUid()) return;
  const num=(G.coopUidToNum&&G.coopUidToNum[s.uid])||s.num;
  awaySlot(num, s.nick); }
// presence 에 다시 나타났다 — 잡아 둔 자리면 복귀시킨다
function onCoopPlayerBack(s){ if(!s||s.uid===myUid()) return;
  const num=(G.coopUidToNum&&G.coopUidToNum[s.uid])||s.num;
  reviveSlot(num, s.nick); }
// 일부러 나갔다(나가기 확인) — 기다리지 않고 바로 영구 죽은 자리
function onCoopBye(p){ if(!p||p.uid===myUid()) return;
  const num=(G.coopUidToNum&&G.coopUidToNum[p.uid])||p.num; if(!num) return;
  if(G.away) delete G.away[num];
  killSlot(num, 'left', p.nick); }
// ══ 재접속 따라잡기 — 끊긴 동안 지나간 '일회성 사건'을 복구한다 ═════════
// 현재 상태(적 수·보드)는 pstate 가 곧 채우지만, 승/패/나감·배속 투표는 그때 한 번 지나가고 만다.
// 돌아온 쪽이 hello 를 쏘면 각자 자기가 아는 것을 resync 로 한 번 답한다.
function onCoopHello(p){ if(!p||p.uid===myUid()) return;
  coopSend('resync', {
    over: (G.phase==='won') ? 'won' : ((G.phase==='lost'||G.phase==='quit') ? 'lost' : null),
    speed: (G.coopSpeed&&G.coopSpeed[G.myPlayer||1]) || (G.vote&&G.vote[G.myPlayer||1]) || 1,
    dead: (G.eliminated||[]).slice(), done: (G.finished||[]).slice(), num:(G.myPlayer||1) }); }
function onCoopResync(p){ if(!p||p.uid===myUid()) return;
  const me=G.myPlayer||1, num=(G.coopUidToNum&&G.coopUidToNum[p.uid])||p.num;
  // 내가 이미 판에서 빠졌다면(너무 늦게 돌아옴) 더 이상 이 판에 끼어들지 않는다
  if((p.dead||[]).indexOf(me)>=0){
    addChat('', '⚠️ 연결이 끊긴 동안 판에서 제외되었습니다 — 협동 동기화를 멈춥니다.');
    if(typeof stopGameCoop==='function') stopGameCoop(); return; }
  (p.dead||[]).forEach(n=>{ if(n!==me) killSlot(n,'lost'); });    // 둘 다 멱등이라 중복 호출은 무해하다
  (p.done||[]).forEach(n=>{ if(n!==me) finishSlot(n); });
  if(num){
    if(p.speed) (G.coopSpeed=G.coopSpeed||{})[num]=p.speed;
    if(p.over==='won') finishSlot(num); else if(p.over==='lost') killSlot(num,'lost'); }
  if(typeof computeSpeed==='function') computeSpeed();
  if(typeof renderVote==='function') renderVote();
  if(G.tab==='Players' && typeof renderPlayers==='function') renderPlayers(); }
function onCoopPause(p){ if(!p||p.uid===myUid()) return; if(G.paused===p.paused) return;
  G.paused=p.paused; const ga=document.getElementById('gameArea'); if(ga) ga.classList.toggle('gray', p.paused);
  addChat('', 'ℹ️ '+(p.nick||'상대')+'님이 일시정지를 '+(p.paused?'사용':'해제')+'하였습니다.'); updatePauseBtn(); }
function onCoopChat(p){ if(!p||p.uid===myUid()) return; if(typeof playNotify==='function') playNotify(); addChat(p.nick||'상대', p.text, p.color||'#7fc8ff'); }
function onCoopState(p){ if(!p||p.uid===myUid()) return; const num=G.coopUidToNum[p.uid]; if(!num) return;
  if(slotDead(num)) return;   // 영구히 죽은 자리에서 뒤늦게 온 스냅 — 되살리지 않는다(재접속은 away/presence join 이 맡는다)
  if(p.w!==undefined) (G.coopWatchers=G.coopWatchers||{})[p.uid]=+p.w||0;   // watch 이벤트를 놓쳐도 여기서 복구된다
  const boPrev=G.coopState[num]&&G.coopState[num].bo;
  G.coopState[num]={ count:p.count||0, round:p.round||0, bo:p.bo?1:0 };
  if((p.bo?1:0)!==(boPrev||0) && G.tab==='Players' && typeof renderPlayers==='function') renderPlayers();   // 토벌장 입퇴장 배지 갱신
  // ⚠ 전장 데이터(u)가 없는 = '아무도 안 볼 때 오는 가벼운 스냅'이다. 기존 보드를 빈 배열로 덮으면
  //   관전을 켠 순간 화면이 비어 버린다 — 그럴 땐 보드를 건드리지 않고 지표(count/round/bs/tb)만 받는다.
  if(p.u){
  const pf='r'+num+'_';   // 내 유닛/적 키와 충돌 방지(M3D 모델 추적용)
  const snap={ t:Date.now(),
    units:(p.u||[]).map(a=>({id:a[0], uid:pf+a[1], x:a[2], y:a[3], hero:!!a[4], fireSeq:a[5]||0, hp:a[6], maxHp:a[7], sh:a[8], maxSh:a[9], en:a[10], maxEn:a[11], lv:a[12]||1})),
    enemies:(p.e||[]).map(a=>({d:a[0], boss:!!a[1], special:!!a[2], shape:a[3], ph:a[4]||0, eid:pf+a[5], model3d:a[6]||null})),
    shots:(p.s||[]).map(a=>({x:a[0], y:a[1], vx:a[2], vy:a[3], kind:a[4], color:a[5]})),
    beams:(p.b||[]).map(a=>({x1:a[0], y1:a[1], x2:a[2], y2:a[3], color:a[4], w:a[5], life:a[6]})) };
  // 관전 중인 상대의 발사 감지 → 해당 유닛 공격음(playUnitAttack 자체 110ms 쓰로틀)
  if(G.tab==='Players' && G.curPlayer===num && typeof playUnitAttack==='function'){
    const prevB=G.coopBoard[num]; if(prevB){ const pm={}; prevB.units.forEach(x=>pm[x.uid]=x.fireSeq||0);
      for(const x of snap.units){ if((x.fireSeq||0)>(pm[x.uid]||0)){ playUnitAttack(x.id); break; } } } }   // 스냅당 1회(소음 방지)
  G.coopBoardPrev[num]=G.coopBoard[num]; G.coopBoard[num]=snap;   // 직전/현재 스냅(보간용)
  }
  if(p.atk) (G.coopUpg=G.coopUpg||{})[num]=p.atk;   // 상대 공격 업그레이드 레벨
  // 전체 강화(팀 공유): 상대 레벨 수신 → 최고 레벨 기준으로 효과 재계산. 시작 크레딧이 늘면 차액 소급 지급
  if(p.tb){ const cur=(G.coopTeamB=G.coopTeamB||{})[num];
    if(!cur || cur.join(',')!==p.tb.join(',')){ G.coopTeamB[num]=p.tb;
      const before=(G.metaB&&G.metaB.startCredit)||0;
      G.metaB=metaBonus();
      // ⚠ '이번에 오른 만큼'을 그대로 주면 안 된다 — 연결이 불안정한 사람이 나갔다 들어올 때마다
      //   metaB 가 내려갔다 다시 올라가서 **같은 보너스를 몇 번이고 다시 준다**(판마다 미네랄이 조용히 불어난다).
      //   지금까지 지급 근거가 된 최고치를 기억해 두고, 그보다 높아진 만큼만 준다.
      const peak=(G._tbPeak!=null)?G._tbPeak:before;
      const diff=G.metaB.startCredit-Math.max(peak, before);
      if(diff>0){ G.mineral+=diff; if(typeof updateHud==='function') updateHud();
        addChat('', '🤝 전체 강화 공유 적용 — 시작 미네랄 +'+diff+' M', '#ffd24a', true); }
      G._tbPeak=Math.max(peak, before, G.metaB.startCredit); } }
  // 상대 토벌장 파견 유닛 스냅(보간용 직전/현재) — 토벌장 화면에 함께 표시
  { const prevB=(G.coopBossU=G.coopBossU||{})[num];
    G.coopBossU[num]={ t:Date.now(), prev:prevB&&prevB.cur,
      cur:(p.bu||[]).map(a=>({ gmodel:a[0], id:a[1], uid:'b'+num+'_'+a[2], bx:a[3], by:a[4], hero:!!a[5], fireSeq:a[6]||0, gid:a[7]||null, remote:true, pnum:num })) }; }
  // 보스 권위 동기화: 권위자(최저 번호)의 보스 상태로 수렴 — 레벨 다르면 교체, HP는 2% 이상 어긋날 때만 보정(잔떨림 방지)
  if(p.bs && num===coopAuthNum() && num!==(G.myPlayer||1)){ const b=p.bs;
    if(!G.coopBoss || G.coopBoss.lv!==b[2]){ if(typeof spawnCoopBoss==='function' && G.phase==='playing') spawnCoopBoss(b[2]); }
    if(G.coopBoss){ G.coopBoss.max=b[1];
      if(Math.abs(G.coopBoss.hp-b[0])>Math.max(50, b[1]*0.02)) G.coopBoss.hp=Math.max(0,b[0]);
      if(b[3] && !G.coopBoss.dead) coopBossDown(); }
    if(typeof updateCoopBossBar==='function') updateCoopBossBar(); }
  if(G.tab==='Players' && typeof updatePlayerCounts==='function') updatePlayerCounts(); }
function coopBroadcastState(){ if(!coopActive()||G.phase!=='playing') return;
  // ⚠ 전장 데이터(u/e/s/b)는 **관전 중인 사람이 있을 때만** 싣는다 — 쓰는 곳이 관전 화면뿐이다.
  //   보는 사람이 없으면 페이로드가 11.3KB → 164B 로 줄고 주기도 10Hz → 2Hz 가 된다(실측).
  const watched=iAmWatched(), bossOn=anyBossArenaOpen(), fast=watched||bossOn;
  G._pstateN=(G._pstateN||0)+1;
  if(!fast && (G._pstateN%5)) return;   // 아무도 안 볼 땐 5틱(=500ms)에 한 번만
  const bs=(coopAuthNum()===(G.myPlayer||1) && G.coopBoss)?[Math.round(G.coopBoss.hp), G.coopBoss.max, G.coopBoss.lv, G.coopBoss.dead?1:0]:0;   // 권위자만 보스 상태 동봉
  const tb=_TEAM_IDS.map(id=>buildLevel(id));   // 내 전체 강화 레벨(팀 공유 — 최고 레벨 적용)
  const pl={ count:G.enemies.length, round:G.round, atk:G.atkLv||{}, bs:bs, tb:tb,
             bo:G.bossOpen?1:0, w:(G._watchSent||0) };   // w = 내가 보고 있는 자리(이벤트를 놓쳐도 여기서 복구된다)
  if(watched){   // 관전 중인 사람이 있을 때만 — 여기가 페이로드의 98%다
    pl.u=G.units.map(x=>[x.id, x.uid, +x.x.toFixed(3), +x.y.toFixed(3), x.hero?1:0, x.fireSeq||0, Math.round(x.hp||0), Math.round(x.maxHp||0), Math.round(x.sh||0), Math.round(x.maxSh||0), Math.round(x.en||0), Math.round(x.maxEn||0), x.lv||1]);
    pl.e=G.enemies.map(x=>[+x.d.toFixed(4), x.boss?1:0, x.special?1:0, x.shape, +(x.ph||0).toFixed(2), x.eid, x.model3d||0]);
    pl.s=G.shots.map(x=>[+x.x.toFixed(1), +x.y.toFixed(1), +(x.vx||0).toFixed(1), +(x.vy||0).toFixed(1), x.kind, x.color]);
    pl.b=G.beams.map(x=>[+x.x1.toFixed(1), +x.y1.toFixed(1), +x.x2.toFixed(1), +x.y2.toFixed(1), x.color, x.w||2, +(x.life||0).toFixed(2)]); }
  if(bossOn)   // 토벌장이 열려 있을 때만 — 내 파견 유닛(gid 포함 · 초월·갓 이펙트 재생)
    pl.bu=G.units.filter(x=>x.atBoss).map(x=>[x.gmodel||x.id, x.id, x.uid, +(x.bx!=null?x.bx:0.5).toFixed(3), +(x.by!=null?x.by:0.54).toFixed(3), x.hero?1:0, x.fireSeq||0, x.gid||0]);
  coopSend('pstate', pl); }
function specRemoteBoard(){ return (coopActive() && G.tab==='Players' && G.curPlayer!==(G.myPlayer||1) && G.coopBoard && G.coopBoard[G.curPlayer]) ? G.curPlayer : null; }
function _clerp(a,b,f){ return a+(b-a)*f; }
function _clerpWrap(a,b,f){ let d=b-a; if(d>0.5)d-=1; else if(d<-0.5)d+=1; let v=a+d*f; if(v<0)v+=1; else if(v>=1)v-=1; return v; }   // 트랙 d(0~1 순환) 경계 래핑 보간
// 직전·현재 스냅을 보간(유닛/적) + 투사체는 속도로 외삽 → 끊김 없는 관전 보드 생성
function buildInterpBoard(num){ const cur=G.coopBoard[num]; if(!cur) return {units:[],enemies:[],shots:[],beams:[]};
  const prev=G.coopBoardPrev&&G.coopBoardPrev[num];
  const now=Date.now(), span=(prev&&cur.t>prev.t)?(cur.t-prev.t):0;
  const f= span? Math.max(0,Math.min(1,(now-cur.t)/span)) : 1;   // 한 스냅 지연 보간(0=prev,1=cur)
  let units=cur.units, enemies=cur.enemies;
  if(prev){ const pu={}; prev.units.forEach(u=>pu[u.uid]=u);
    units=cur.units.map(u=>{ const q=pu[u.uid]; return q? Object.assign({},u,{x:_clerp(q.x,u.x,f),y:_clerp(q.y,u.y,f)}) : u; });
    const pe={}; prev.enemies.forEach(e=>pe[e.eid]=e);
    enemies=cur.enemies.map(e=>{ const q=pe[e.eid]; return q? Object.assign({},e,{d:_clerpWrap(q.d,e.d,f)}) : e; }); }   // 한 바퀴 경계(1→0)에서 역주행 점프 방지
  // 투사체: 속도(px/초)로 외삽 → 매끄럽게 비행.
  // ⚠ 한 스냅 간격까지만 외삽한다 — 상대가 이겨서 정지했거나 끊기면 (now-cur.t) 가 무한정 커져
  //   탄이 화면 밖으로 영원히 날아간다(정지된 자리는 멈춰 있어야 한다).
  const el=Math.min((now-cur.t)/1000, span? span/1000 : 0.15);
  const shots=(cur.shots||[]).map(s=>({x:s.x+(s.vx||0)*el, y:s.y+(s.vy||0)*el, vx:s.vx, vy:s.vy, kind:s.kind, color:s.color}));
  return { units, enemies, shots, beams:cur.beams||[] }; }
// 관전: 상대 보드 데이터로 통째 교체 후 메인 게임과 동일하게 3D + 이펙트 렌더
function renderSpectate(num, dt){ const board=buildInterpBoard(num);
  const sv={ units:G.units, enemies:G.enemies, shots:G.shots, beams:G.beams, muzzles:G.muzzles, sel:G.sel, selEnemy:G.selEnemy, recalls:G.recalls, impacts:G.impacts, sparks:G.sparks, debris:G.debris };
  G.units=board.units; G.enemies=board.enemies; G.shots=board.shots; G.beams=board.beams;
  G.sel=[]; G.selEnemy=null; G.muzzles=[]; G.recalls=[]; G.impacts=[]; G.sparks=[]; G.debris=[];   // 내 공격 이펙트 leak 방지
  try{ drawPlayer();
    const mcv=document.getElementById('cvMarine');
    if(window.M3D && window.M3D.ready() && !(G.opt&&G.opt.model3d===false) && nemoOwns3D()){ if(mcv) mcv.style.display='block';
      window.__nemoView=!(G.sandbox||G.strike);   // 고정 슬롯 고스트는 네모네모 본편에서만
      try{ window.M3D.sync(G.units, GW, GH, dt, G.specSel?[G.specSel]:[], G.enemies, null, null, G.view); } finally{ window.__nemoView=false; } }   // 선택한 상대 유닛 림 표시
    else if(mcv) mcv.style.display='none';
    const fcv=document.getElementById('cvFx'); if(fcv){ fcv.style.display='block'; drawFx(); }   // 투사체 이펙트
  }catch(e){ console.warn('spectate', e); }
  finally{ Object.assign(G, sv); } }
