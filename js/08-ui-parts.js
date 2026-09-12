/* ============================================================================
 * 08-ui-parts.js — 옛 08-hunt.js 에서 **살아남은 부품**만 남긴 파일 (2026-09-10)
 * ⛔ 사냥터·토벌·마을·정비 본체는 js/99-attic.js 로 갔다(ATTIC.md 「🏘 마을」).
 *    HOME 메인이 캠프로 바뀌면서(2026-08-23) 화면에 나오지 않게 된 코드다.
 * 여기 남은 것은 **다른 구역이 실제로 부르는 것**뿐이다:
 *   ① 던전 이름표(HB_DUNGEONS·hbDun) — 캠프·상단 칩이 이름과 종족을 여기서 읽는다
 *   ② edgePush                        — 관리자 건설·캠프가 같은 함수를 쓴다
 *   ③ 공용 3D 캔버스 자리 기억 + 예열  — 부팅(로딩 → 캠프) 경로
 *   ④ 로그아웃 확인
 *   ⑤ 재화 아이콘 resIco               — 단일 소스(CLAUDE.md 레지스트리)
 *   ⑥ 캠프 상점                        — 하단 네비 「상점」
 *   ⑦ segNavHTML                       — 탭 띠 단일 소스(레지스트리)
 * ⛔ 파일을 합치거나 로드 순서를 바꾸지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
const HB_DUNGEONS=[
  {dg:1,  race:'swarm',     name:'감염된 둥지',   tile:'badlands',          tint:'rgba(38,54,26,.30)'},
  {dg:2,  race:'union',     name:'버려진 전초기지', tile:'terran_tile_light', tint:'rgba(30,38,52,.32)'},
  {dg:3,  race:'aetherial', name:'잊혀진 회랑',   tile:'protoss_floor',     tint:'rgba(34,30,58,.34)'},
  {dg:4,  race:'swarm',     name:'산란장',       tile:'badlands',          tint:'rgba(40,44,20,.42)'},
  {dg:5,  race:'union',     name:'폐쇄된 시설',   tile:'installation',      tint:'rgba(26,32,44,.46)'},
  {dg:6,  race:'aetherial', name:'봉인된 성소',   tile:'protoss_floor',     tint:'rgba(30,24,58,.50)'},
  {dg:7,  race:'swarm',     name:'군단의 심장',   tile:'ashworld',          tint:'rgba(52,20,16,.54)'},
  {dg:8,  race:'union',     name:'함대 정박지',   tile:'space_platform',    tint:'rgba(20,26,40,.58)'},
  {dg:9,  race:'aetherial', name:'공허의 문',     tile:'protoss_floor',     tint:'rgba(26,14,46,.62)'},
  {dg:10, race:'abyss',     name:'심연',         tile:'space_bg',          tint:'rgba(30,8,14,.66)'},
];
function hbDun(dg){ return HB_DUNGEONS[Math.min(HB_DUNGEONS.length, Math.max(1, dg||1))-1]; }
const HB_DG_MAX=10;                 // 던전 1~10
// 순수 시뮬 한 스텝 — rAF와 분리(스모크가 직접 부른다). phase: fight/gap/fail/clearWait/down
// 탭한 곳으로 걸어간다 + 중앙 회복 구역. 적은 이미 캐릭터를 쫓으므로 전투는 알아서 따라온다.
// ═══ 🎥 가장자리 끌기 — 건물 고스트를 화면 끝으로 끌면 카메라가 그쪽으로 따라간다 ═══
// 한 손가락만으로 맵을 넓게 쓰게 해 준다. HOME 사냥터와 관리자 건설 화면이 **같은 함수**를 쓴다.
// 반환 = -1..1 방향 세기(가장자리에 가까울수록 ±1, 안쪽이면 0).
const EDGE_PAD=0.16, EDGE_SPD=0.9;   // 감지 폭(화면 비율) · 초당 이동(보이는 화면의 배수)
function edgePush(fx,fy){
  const f=(v)=>{ if(v<EDGE_PAD) return -(1-Math.max(0,v)/EDGE_PAD);
                 if(v>1-EDGE_PAD) return (1-Math.max(0,1-v)/EDGE_PAD); return 0; };
  return { x:f(fx), y:f(fy) }; }
// 공용 3D 캔버스(#cvMarine)는 유즈맵(#gameArea) 소유다 — HOME·마을이 잠깐 빌려 쓴다.
// ⚠ '원래 자리'는 여기 한 곳에서만 기억한다. 남이 빌린 상태에서 또 빌리면 그 임시 위치를
//    원래 자리로 착각해, 반납해도 캔버스가 남의 화면에 갇힌다(실제로 그랬다 — 유즈맵 3D가 사라짐).
let _cv3dHome=null;
// ── 첫 진입 멈춤 없애기: 미리 데워 두기 ─────────────────────────────────────
// 모델을 '처음' 만들 때 텍스처 GPU 업로드 + 셰이더 컴파일이 한꺼번에 일어난다
// (실측: HOME 첫 진입에서 5개 만드는 프레임 504ms + 다음 프레임 148ms).
// 두 번째부터는 4ms라, 비용은 개수가 아니라 '처음'에 붙는다 → 로그인 화면·로딩으로 옮긴다.
// ⚠ 한 프레임에 하나씩만 만든다. 한꺼번에 하면 로그인 화면이 그만큼 얼어붙는다.
let _warmDone=false, _warmRun=null;
function warmIds(){ const ids=[];
  try{ for(const k in PROF_CLASSES){ const u=PROF_CLASSES[k]&&PROF_CLASSES[k].unit;
    if(u && ids.indexOf(u)<0) ids.push(u); } }catch(e){}          // 어떤 직업으로 들어와도 준비돼 있게
  try{ const dg=(typeof hbHunt==='function' && hbHunt().dg)||1;
    for(const f of hbDun(dg).foes) if(f.mdl && ids.indexOf(f.mdl)<0) ids.push(f.mdl); }catch(e){}
  return ids; }
// 📊 **예열의 단계 배분**(2026-09-12 · 사용자 신고 「99% 에서 한참」 · 「캠프에서 또 따로따로 로딩」).
//   옛 예열은 **모델 한 줄만** 보고했다 — 그 앞의 두 대기(그림 받기 · three.js 모듈)가 무보고라
//   막대가 멈춰 보였고, 실측에서 three.js 대기 하나가 10.3초 중 10초를 먹었다.
//   ⭐ 이제 네 구간이 각자 제 몫만큼 막대를 민다. 합이 1 이다.
//   ⛔ 구간을 지우거나 0 으로 만들지 말 것 — 그 구간이 길어지면 다시 「멈춘 막대」가 된다.
const WARM_BAND={ img:0.12, m3d:0.33, mdl:0.30, camp:0.25 };
const CAMP_WARM_MAX=9000;   // 🏕 캠프 자산 예열을 기다리는 **전체** 상한(ms) — 넘으면 그냥 들어간다(첫 프레임이 조금 늦게 채워질 뿐)
function warmAll(onStep){
  if(_warmDone) return Promise.resolve(0);
  if(_warmRun) return _warmRun;
  _warmRun=(async()=>{
    // 진행률은 0~1 로 만들고 100 눈금으로 넘긴다(부르는 쪽이 n/t 로 받는다)
    let _base=0;
    const rep=(f)=>{ if(!onStep) return; const p=Math.max(0,Math.min(1,_base+f));
      try{ onStep(Math.round(p*100), 100); }catch(e){} };
    const band=(k)=>{ _base=Math.min(1,_base+WARM_BAND[k]); rep(0); };
    // 🖼 **그림 미리 받기는 3D 와 무관하다 — 3D 대기보다 먼저 한다.**
    //    ⛔ 이걸 아래 3D 대기 뒤에 두지 말 것. 3D 가 없는 기기·환경에서는 그 앞의 early return 에
    //       걸려 **그림을 한 장도 안 받는다** — 정작 3D 가 없을수록 종족 판이 검게 뜬다.
    //       (헤드리스에서 실제로 그랬다: M3D 자체가 없어 예열이 통째로 건너뛰어졌다.)
    // 🏕 로딩이 걷힌 자리에 종족 판이 오는데, 그림을 그때 처음 받으면 어두운 그라데이션(.crPrev)만
    //    보이다가 뒤늦게 채워진다 — 그것이 「검게 한 번 깜빡인다」의 정체였다(2026-08-27).
    // ⛔ 캠프 바닥 그림(camp.webp)은 여기서 미리 디코드하지 **않는다** — 넣어 봤다가 뺐다(2026-08-27).
    //    종족 선택 화면에 닿는 시점이면 그 그림은 **이미 로드·디코드가 끝나 있다**(실측 decode 0.2ms).
    //    미리 해 봐야 캠프 첫 프레임은 그대로였다: 안 함 255~262ms / 미리 함 256~259ms — 차이 없음.
    // ⚠ **받을 때까지 기다린다.** src 만 걸고 지나가면 예열이 끝난 뒤에도 아직 오는 중이라
    //    종족 판이 여전히 검게 떴다 채워진다(실측: 세 장 중 한둘이 미완).
    //    ⛔ 그렇다고 무한정 기다리지 말 것 — 한 장이 실패하면 부팅이 멎는다. 3초로 끊는다.
    rep(0);
    try{ if(typeof CAMP_RACE_ORDER !== 'undefined' && typeof campRaceArt === 'function'){
      const _ims=[];
      for(const _rk of CAMP_RACE_ORDER){
        const _a=new Image(); _a.src=campRaceArt(_rk); _ims.push(_a);
        if(typeof campRaceIcon === 'function'){ const _i=new Image(); _i.src=campRaceIcon(_rk); _ims.push(_i); } }
      await Promise.race([
        Promise.all(_ims.map(function(im){ return im.complete ? null
          : new Promise(function(r){ im.addEventListener('load',r,{once:true}); im.addEventListener('error',r,{once:true}); }); })),
        new Promise(function(r){ setTimeout(r,3000); })]);
    } }catch(e){}
    band('img');
    // ⏳ **three.js 모듈 대기에도 진행률을 준다.** 이건 esm.sh 에서 three 를 받아오는 네트워크
    //   대기라 회선이 느릴수록 길어진다 — 무보고로 두면 그 시간만큼 막대가 통째로 멈춘다
    //   (실측: 이 대기 하나가 예열 10.3초 중 10초였다).
    //   ⚠ 언제 끝날지 모르므로 **점근**으로 민다(다 차지 않고 다가가기만 한다).
    for(let i=0;i<200 && !(window.M3D&&M3D.ready&&M3D.ready()); i++){
      rep(WARM_BAND.m3d*(1-Math.exp(-i/70)));   // ⚠ 시정수를 넉넉히 — 짧으면 대기 후반이 평평해진다(실측 6.6초 정지)
      await new Promise(r=>setTimeout(r,50)); }
    if(!(window.M3D&&M3D.ready&&M3D.ready())){ rep(1); _warmDone=true; return 0; }   // 3D가 없으면 **모델은** 데울 것도 없다
    band('m3d');
    try{ hbBgImg((typeof hbHunt==='function' && hbHunt().dg)||1); }catch(e){}   // 배경 그림도 미리 받아 둔다
    const ids=warmIds(); let n=0;
    for(const id of ids){
      await new Promise(r=>requestAnimationFrame(()=>r()));
      try{ M3D.sync([{uid:'_warm', id:id, x:0.5, y:0.5, face:0, moving:false, size:1}], 300, 300, .016, [], [], null, null); }catch(e){}
      n++; rep(WARM_BAND.mdl*(n/(ids.length||1))); }
    band('mdl');
    await new Promise(r=>requestAnimationFrame(()=>r()));
    // 🧹 데운 흔적을 지운다 — GPU 캐시는 남는다(그게 목적).
    // ⚠ clearGameModels() 는 scene.remove() 만 한다. **다시 그리지 않으면 캔버스에는 마지막 프레임이
    //    그대로 박제된다** — 예열 유닛은 x:.5, y:.5 즉 화면 한가운데 서 있었다. 그 뒤 검은 판이
    //    페이드로 덮이는 동안(--t-screen) 반투명한 그 사이로 비쳐, 로고 옆에 유닛이 공중에 뜬 것처럼
    //    보였다(2026-08-24). 빈 목록으로 sync 를 한 번 더 돌려 캔버스를 실제로 비운다
    //    (sync 는 끝에서 renderer.render 를 부른다 — '지우기'는 지운 뒤 한 번 더 그려야 완성된다).
    //    ⛔ 뒤에 rAF 를 하나 더 두지 말 것 — renderer.render 는 동기라 기다릴 이유가 없는데,
    //       그 한 프레임 사이에 게임 루프가 sync 를 불러 모델을 도로 만든다(스모크가 잡았다).
    try{ M3D.clearGameModels();
         M3D.sync([], 300, 300, .016, [], [], null, null); }catch(e){}
    // 🏕 **캠프가 첫 프레임에 쓸 것을 여기서 미리 받는다**(2026-09-12 사용자 신고
    //   「로그인해서 캠프에 오면 요소들이 따로따로 로딩된다」).
    //   원인: 캠프 건물(cb_*)·일꾼·자원 노드는 renderBuildTab(14-input-fx)이 **첫 프레임에**
    //   cstEnsure/ensureUnits/cstEnsureRes 로 그제야 불러왔다 — 로딩이 끝난 뒤에 받는 것이라
    //   기지가 하나씩 나타났다. 같은 함수를 **로딩 화면에서 미리** 부른다.
    //   ⚠ 여기서 부르는 것은 renderBuildTab 의 그 함수 그대로다 — 두 번째 로더를 만들지 않는다.
    //   ⚠ 첫 바퀴 종족은 유니온 고정이라 기본값이 'union' 이다(CLAUDE.md 「캠프 종족」).
    //   ⛔ 빼지 말 것 — 빼면 캠프 첫 프레임이 다시 조각조각 채워진다.
    try{
      const _race=(typeof campTechRace==='function' && typeof campState==='function' && campState())
        ? campTechRace(campState().race||'terran') : 'union';
      const _bk=(typeof TECH_MODEL!=='undefined' && TECH_MODEL[_race]) ? Object.values(TECH_MODEL[_race]) : [];
      const _uk=(typeof _techRaceUnitKeys==='function') ? _techRaceUnitKeys(_race) : [];
      // ⚠ 상한은 **셋을 합쳐 하나**다 — 단계마다 따로 두면 하나가 멎었을 때 그 몇 배가 쌓인다.
      const _dead=performance.now()+CAMP_WARM_MAX;
      const _wait=(fn)=>new Promise(res=>{ let done=false;
        const fin=()=>{ if(done) return; done=true; res(); };
        try{ if(!fn(fin)) fin(); }catch(e){ fin(); }
        setTimeout(fin, Math.max(0, _dead-performance.now())); });
      if(_bk.length && M3D.cstEnsure){ await _wait(fin=>M3D.cstEnsure(_bk, fin)); }
      rep(WARM_BAND.camp*0.5);
      if(_uk.length && M3D.ensureUnits){ await _wait(fin=>M3D.ensureUnits(_uk, fin)); }
      rep(WARM_BAND.camp*0.8);
      if(M3D.cstEnsureRes){ await _wait(fin=>M3D.cstEnsureRes(fin)); }
    }catch(e){}
    band('camp'); rep(0);
    _warmDone=true; return n; })();
  return _warmRun; }
// 로그인/게스트 → 로딩 화면(#opening 재사용)에서 데우기를 끝낸 뒤 HOME으로.
// 새 로딩 UI를 만들지 않는다 — 부팅 때 쓰는 그 화면의 막대와 문구를 그대로 쓴다.
// 🎬 **로딩 → 검은 판 → 캠프**(2026-09-12 · 한 길만 남았다).
//   ⛔ 옛 「로딩 → 종족 선택」 갈래(RACE_HOLD_MS·RACE_FADE_MS·raceIn)를 되살리지 말 것 —
//     종족 선택 화면은 다락으로 갔고(2026-09-09 · 첫 바퀴는 유니온 고정), 그 갈래가 남아 있어서
//     **첫 진입이 「로딩 100% 로 한참 머물다 띡 하고 캠프로 끊기는」** 것이 됐다(2026-09-12 사용자 신고).
//     원인은 둘이었다: ① 종족이 아직 없다는 이유로 검은 판을 안 씌우고 짧은 전환(raceIn)만 걸었다
//     ② 그 길 끝의 titleOutroEnd 가 **campRaceToCamp 가 막 올린 검은 판을 곧바로 걷어** 캠프가 그대로 드러났다.
async function enterAfterWarm(){
  const op=document.getElementById('opening');
  showAppScreen('opening');
  // 막대는 공용 규칙(opBarStart/Real/Done)이 몬다.
  // ⚠ 부팅에서 이어서 오면 **그 막대를 그대로 잇는다** — 여기서 0 으로 되돌리면 사용자에겐
  //   '로딩이 두 번' 도는 것으로 보인다(2026-08-19). 로그인·게스트로 들어올 때만 새로 시작한다.
  const cont = (typeof _opBar!=='undefined' && _opBar);
  const base = cont ? BOOT_AUTH_P : 0;
  if(!cont) opBarStart();
  await warmAll((n,t)=>opBarReal(base+(1-base)*(t?n/t:1)));
  await opBarDone();
  // 🎬 **검은 화면 + 로고는 「게임이 실제로 시작되는 지점」에 쓴다.**
  //    종족을 아직 안 골랐으면 여기가 그 지점이 아니다 — 로딩에서 종족 선택으로 **바로 디졸브**하고,
  //    검은 화면은 종족을 고른 뒤(campPickRace)가 맡는다. 안 그러면 검은 화면이 두 번 나온다:
  //    로딩→검정→종족선택→(다시)캠프 — 그 사이가 깜빡이는 것처럼 보였다(2026-08-27).
  // 🎬 **종족 선택으로 가는 길은 단순 디졸브 하나다**(2026-08-27 재작성).
  //   로딩이 100% 로 잠깐 머문 뒤(RACE_HOLD_MS) 앞판이 걷히고, 그 다음 종족 판이 든다(RACE_FADE_MS).
  //   ⚠ **겹치지 않는다** — 크로스페이드를 여러 길이로 만들어 봤지만 겹치는 구간이 계속 거슬렸다(2026-08-27).
  //   ⛔ 검은 화면을 끼우지 말 것 — 그건 「게임이 실제로 시작되는 지점」(종족을 고른 뒤)의 몫이다.
  //   ⛔ 로딩만 먼저 걷고 기다리지 말 것 — 그 사이 키 아트만 남아 「배경이 깜빡」인다.
  //   ⛔ 로고·키 아트를 따로따로 다른 속도로 걷지 말 것 — 한 화면이 조각나 보인다.
  //   ⭐ 실제로 걷는 일은 openHome() → showAppScreen 이 이미 다 한다(로딩 fadeOut +
  //     titleArtShow(false) 로 키 아트·로고). 여기서는 **잠깐 머무는 것**만 맡는다.
  // ⭐ 갈래가 없다 — 로딩이 100% 에서 **검은 판으로 덮이고** 그 아래에서 캠프가 선다.
  if(typeof titleToBlack==='function') await titleToBlack();
  // ⛔ 막대는 **로딩 판이 검은 판에 덮인 뒤에** 되돌린다. 먼저 부르면 100% 이던 막대가
  //    아직 화면에 보이는 채로 0% 로 뚝 떨어진다(2026-08-27 프레임 확인: 1648ms 에 「LOADING 0%」).
  //    위 titleToBlack 을 기다린 참이라 지금은 이미 덮여 있다.
  opBarReset();
  // ⚠ 예열은 오래 걸린다(헤드리스 소프트웨어 렌더러에선 20초를 넘긴다). 그 사이 사용자가 이미
  //    **게임에 들어가 있으면 끌어오지 않는다** — 무조건 openHome() 을 부르면 게임 중에
  //    setInGame(false) 가 걸려 하단 콘솔(#bot)이 통째로 사라진다(스모크가 간헐 실패했다).
  //    bootApp() 의 '이미 다른 화면으로 넘어갔으면 건드리지 않는다' 와 같은 규칙이다.
  //    ⛔ '#opening 이 감춰졌으면 return' 으로 넓게 잡지 말 것 — 예열 중 다른 경로가 오프닝을
  //       내리는 경우가 있어 정상 진입까지 막힌다(실제로 게스트가 HOME 에 못 갔다).
  // ⚠ 어느 갈래로 빠지든 검은 판·로고는 반드시 걷는다 — 안 걷으면 화면이 검은 채로 잠긴다.
  { const ph=document.getElementById('phone'); if(ph && ph.classList.contains('inGame')){ if(typeof titleOutroEnd==='function') titleOutroEnd(); return; } }
  // 화면을 내린 사이 탭이 죽었을 수 있다 — 30초 안이면 그 판을 그대로 이어받는다(실패하면 평소대로 HOME)
  // ⛔ 부팅 경로다 — 여기서 예외가 나면 사용자가 HOME 에 영영 못 간다. 한 겹 더 감싼다.
  try{ if(typeof tryRestoreRun==='function' && tryRestoreRun()){ if(typeof titleOutroEnd==='function') titleOutroEnd(); return; } }catch(e){ console.warn('tryRestoreRun', e); }
  // 🏳 **검은 판을 이미 올려 두었다는 표시** — `showAppScreen` 이 곧 `titleArtShow(false)` 로 그 클래스를 떼므로
  //   클래스만 봐서는 campRaceToCamp 가 알 수 없다. 알려 주면 거기서 **덮는 시간을 건너뛰고 머물기만** 한다
  //   (안 알려 주면 페이드가 두 번이라 검은 화면이 2.2초로 늘어진다 · 실측 2026-09-12).
  window._campBootBlack = true;
  openHome();
  window._campBootBlack = false;
  // 🏕 **캠프 첫 진입 연출이 시작됐으면 마무리를 그쪽에 넘긴다**(2026-09-12).
  //   `campOpen` 은 종족이 없으면 `campRaceToCamp` 로 들어가고, 그것이 **검은 판을 유지한 채**
  //   캠프를 세운 뒤 제 손으로 걷으며 튜토리얼까지 띄운다. 여기서 titleOutroEnd 를 부르면
  //   그 검은 판이 곧바로 걷혀 **아직 그리는 중인 캠프가 그대로 드러난다**(= 「띡」 하고 끊기는 느낌).
  if(typeof campIntroOn==='function' && campIntroOn()) return;
  // 🎨 (옛 주석) 종족 선택으로 갈 때는 키 아트를 조금 더 남긴다.
  //    openHome → showAppScreen 이 titleArtShow(false) 로 키 아트를 로딩과 **같은 시간에** 걷는데,
  //    그때 종족 판은 아직 반투명이라 그 아래 키 아트(boot.webp — 전투 장면)가 그대로 드러난다.
  //    「그 사이에 사냥터 배경이 스친다」가 그것이었다(2026-08-27).
  //    종족 판이 다 찬 뒤에 걷으면 그때는 가려져 있어 보이지 않는다.
  // 🎬 느린 전환 클래스는 다 걷힌 뒤에 뗀다(다음 화면 전환이 느려지지 않게)
  //   ⚠ 넉넉히 기다렸다 뗀다. 로딩 판을 걷는 애니메이션(fxOut)은 기본 길이(--t-screen .7s)로 잡혀 있어서,
  //     그 시간이 지나기 전에 클래스를 떼면 남은 구간이 다시 계산돼 **다 사라진 판이 살짝 돌아온다**(실측 0.01).
  if(typeof titleOutroEnd==='function') titleOutroEnd(); }   // 게임 화면이 선 뒤 — 검은 판과 로고가 함께 걷힌다
// ── 🏘 마을(메인 화면) UI ──
// 🚪 메인(마을) 뒤로가기 = 로그아웃 확인 — 되돌아갈 곳이 로그인뿐이다
function askLogout(){ const p=document.getElementById('logoutPanel'); if(!p) return;
  p.classList.remove('hide'); if(typeof fxPop==='function') fxPop(p.querySelector('.ecCard'));
  if(typeof paintIcons==='function') paintIcons(p); if(typeof playSfx==='function') playSfx('ui_open'); }
function closeLogout(){ const p=document.getElementById('logoutPanel'); if(p) p.classList.add('hide'); }
// ── ❓ 공용 확인창 ────────────────────────────────────────────────────────
// 🧩 **확인창은 한 컴포넌트다**(CLAUDE.md 「확인 팝업」) — `.ecCard` + `.ecTitle`/`.ecMsg`/`.ecBtns`.
//   여기 것은 그 컴포넌트를 **틀로 한 번만** 세워 두고 내용만 갈아 끼우는 자리다.
//   ⛔ 화면마다 확인창 마크업을 새로 쓰지 말 것 — 옛 방식(#exitConfirm·#logoutPanel)은 마크업이
//     제각각이라 버튼 색·간격을 고칠 때마다 세 곳을 따라다녀야 했다.
//   ⚠ `#phone` 직속 + z-index 121 — 룬·환생 같은 구역 화면(120) 위에 떠야 한다.
//   ⚠ 되돌릴 수 없는 주 동작은 붉은 글자(.ecGo)가 규약이다.
let _uiAskGo=null;
function uiAsk(o){ const O=o||{}; const ph=document.getElementById('phone'); if(!ph) return;
  let p=document.getElementById('uiAsk');
  if(!p){ p=document.createElement('div'); p.id='uiAsk'; p.className='hide';
    p.innerHTML='<div class="ecCard"><div class="ecTitle"></div><div class="ecMsg"></div>'
      + '<div class="ecBtns"><button class="ecCancel" type="button">취소</button>'
      + '<button class="ecGo" type="button"></button></div></div>';
    p.addEventListener('click', e=>{ if(e.target===p) uiAskClose(); });
    p.querySelector('.ecCancel').addEventListener('click', uiAskClose);
    p.querySelector('.ecGo').addEventListener('click', ()=>{ const f=_uiAskGo; uiAskClose(); if(f) try{ f(); }catch(e){} });
    ph.appendChild(p); }
  p.querySelector('.ecTitle').textContent=O.title||'';
  p.querySelector('.ecMsg').innerHTML=O.msg||'';
  p.querySelector('.ecGo').textContent=O.go||'확인';
  p.querySelector('.ecCancel').textContent=O.cancel||'취소';
  _uiAskGo=O.onGo||null;
  p.classList.remove('hide');
  if(typeof fxPop==='function') fxPop(p.querySelector('.ecCard'));
  if(typeof paintIcons==='function') paintIcons(p);
  if(typeof playSfx==='function') playSfx('ui_open'); }
function uiAskClose(){ const p=document.getElementById('uiAsk'); if(p) p.classList.add('hide'); _uiAskGo=null; }
function doLogoutNow(){ closeLogout();
  if(typeof closeSettings==='function') closeSettings();   // 확인창 뒤에 설정창이 열린 채로 남는다 — 함께 닫는다
  if(typeof doLogout==='function') doLogout(); else openAuth(); }
function showTownToast(msg){ const t=document.getElementById(gearOpen()?'gearToast':shopOpen()?'shopToast':'twToast'); if(!t) return; t.textContent=msg; t.classList.remove('hide');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.add('hide'), 2600); }
// ── 🎁 상점(전용 화면) ─────────────────────────────────────────────────────
// 팝업이 아니라 독립 화면이다. 내용 렌더러는 renderProfGacha() 하나뿐(단일 소스) — 마크업을 복제하지 말 것.
function shopOpen(){ const e=document.getElementById('shopScreen'); return !!(e && !e.classList.contains('hide')); }
function openShop(){ if(typeof loadMeta==='function') loadMeta();
  profEnsureChar();   // 캐릭터가 없으면 조용히 기본 유닛을 지급한다(선택 화면 없음)
  if(typeof twLeave==='function') twLeave();                                     // 마을에서 들어왔으면 루프·팝업 정리
  showAppScreen('shopScreen'); navShow('shop'); renderShop();
  if(typeof paintIcons==='function') paintIcons(document.getElementById('shopScreen')); }
function renderShop(){ const body=document.getElementById('shopBody'); if(!body) return;
  const old=body.querySelector('.bagBody'), keep=old?old.scrollTop:0;
  body.innerHTML=(SHOP_SECS[_shopSec]||SHOP_SECS.deal)();
  const nb=body.querySelector('.bagBody'); if(nb&&keep) nb.scrollTop=keep; }
function gearOpen(){ const e=document.getElementById('gearScreen'); return !!(e && !e.classList.contains('hide')); }
// 뽑기집: 펫 뽑기 + 보유 펫 장착
// ── 💠 재화 아이콘 단일 소스 ────────────────────────────────────────────────
// ⛔ 새 UI에서 미네랄·가스·젬·인구를 표시할 땐 **반드시 resIco()**를 쓴다. 이모지를 임의로 넣지 말 것.
//    한글 이름으로도 찾는다 — resIco('미네랄') === resIco('mineral').
// 🎟 뽑기권 3종도 여기 있다 — 세는 물건이라 재화와 같은 자리·같은 함수로 그린다(`resIco('ticket_pet')`).
//   ⚠ 이모지 🎟 를 새로 박지 말 것: 세 종류가 색으로만 갈리는데 이모지는 하나뿐이라 구분이 사라진다.
const RES_ICON={ mineral:'res_mineral', gas:'res_gas', gem:'res_gem', pop:'res_pop',
  ticket_gear:'res_ticket_gear', ticket_pet:'res_ticket_pet', ticket_ally:'res_ticket_ally',
  ticket_rune:'res_ticket_rune' };
// 파일이 아직 없는 것만 여기 적는다 — 없으면 이 글리프로 떨어지고, 파일을 넣으면 자동으로 교체된다
// (beaconProHTML·_shopArtFail 과 같은 규칙). ⛔ 표에 이모지를 직접 박지 말 것.
const RES_ICO_FB={ ticket_rune:'🔮' };
// ⚠ 한글 이름도 열쇠다 — 상점 특가는 `SHOP_GIVE_LABEL` 의 **한글 이름으로** `resIco()` 를 부른다.
//   여기 세 줄이 없으면 그 줄만 이모지 폴백(🎟)으로 떨어져 세 종류가 같은 그림이 된다.
const RES_ICON_KO={ '미네랄':'mineral', '가스':'gas', '젬':'gem', '인구':'pop',
  '장비 뽑기권':'ticket_gear', '펫 뽑기권':'ticket_pet', '동료 뽑기권':'ticket_ally',
  '룬 뽑기권':'ticket_rune' };
function resIco(k, cls){ const key=RES_ICON[k]?k:(RES_ICON_KO[k]||''), id=RES_ICON[key];
  if(!id) return '';
  const fb=RES_ICO_FB[key], c=(cls||'ri');
  return '<img class="'+c+'" src="assets/icons/'+id+'.webp" alt=""'
       + (fb? ' data-fb="'+fb+'" onerror="_resIcoFail(this)"' : '') + '>'; }
function _resIcoFail(im){ try{ im.outerHTML='<span class="'+(im.className||'ri')+'">'+(im.getAttribute('data-fb')||'')+'</span>'; }
  catch(_e){ try{ im.remove(); }catch(_e2){} } }

// ══ 🏕 캠프 상점 (2026-08-31 재편) ═══════════════════════════════════════
// ⛔ 앞의 상점은 **옛 사냥터 기준**이었다. 파는 것 전부가 캠프에 안 닿았다:
//   · 펫·장비·동료 꾸러미 → 그 시스템들이 유보(GAME_DIRECTION §5-B)라 쓸 데가 없다
//   · 자원·가스 꾸러미   → **다른 지갑**(PROF().pcoin)에 들어갔다. 캠프는 자기 지갑을 쓴다.
//     실측(2026-08-31): 프로필 지갑 +5555 → 캠프 재화 그대로. 사도 캠프에서 못 썼다.
// ⭐ 그래서 **파는 것을 캠프에 실제로 닿는 것만** 남기고 두 칸으로 줄였다.
// ⛔ 옛 구역 코드(_shopDealHTML·_shopDrawHTML·SHOP_DEAL_POOL)는 **지우지 않았다** —
//    화면에서만 뺐다(GEM.md §5 「⑤ 를 지우지 말 것」). 펫·장비·동료가 되살아나면 함께 살아난다.

// 💎 젬으로 사는 것 — **캠프 지갑**으로 들어간다(campAddRes 가 유일한 입구).
// ⭐ **고정 숫자를 팔지 않는다**(2026-08-31 사용자 확정). 파는 단위는 「지금 내 수입의 n 시간치」다.
//   회차가 돌면 수입이 몇 배씩 뛰어 「미네랄 5만」 같은 값은 곧 아무 의미가 없어진다.
//   양은 campTimeAmt(초, 종류) 가 **실측 속도에서 계산하고 유효숫자 두 자리로 반올림**한다.
// ⚠ 캠프에 5초 이상 머문 적이 없으면 속도가 0 이라 팔지 않는다 — 화면이 그 이유를 말한다.
// 🔬 **젬 값과 한도는 실측으로 정했다** (2026-08-31 · 40분 벤치 · GIFT_S 옵션)
//   | 20분 시점에 준 것 | 그때 부의 | 40분 최종 | 라운드 |
//   |---|---|---|---|
//   | 없음(대조군) | — | 70.9만 | D1R19 |
//   | 8시간치 | **23.8배** | 1,450만 | D1R25 (환생 가능) |
//   | 24시간치 | **71.4배** | 4,263만 | D1R35 (환생 가능) |
//   ⛔ **어떤 시간치든 「논 시간」보다 길면 게임을 통째로 건너뛴다.** 8시간치조차 그랬다.
//   ⇒ 안전장치 둘을 건다:
//     ① **플레이 상한** — 이 회차에 논 시간(campPlayS)보다 긴 시간치는 **못 산다**
//     ② **하루 한도** — 상한을 넘겼어도 반복 구매로는 못 부순다(모바일 관례이기도 하다)
const SHOP_GEM_BUY=[
  {id:'min30', nm:'미네랄', kind:'min', secs:1800,  gem:20,  cap:3},
  {id:'min4h', nm:'미네랄', kind:'min', secs:14400, gem:60,  cap:2},
  {id:'min24', nm:'미네랄', kind:'min', secs:86400, gem:180, cap:1},
  {id:'gas4h', nm:'가스',   kind:'gas', secs:14400, gem:30,  cap:2},
  {id:'gas24', nm:'가스',   kind:'gas', secs:86400, gem:90,  cap:1},
  {id:'boost', nm:'부스터', soon:true, desc:'시간제 강화 — 시스템이 아직 없습니다'},
];
// 하루 한도 — 날짜가 바뀌면 스스로 비워진다(shopState 와 같은 날짜 키를 쓴다)
function shopDayBuys(){ const p=PROF(); const dk=(typeof _dgDayKey==='function')?_dgDayKey():0;
  if(!p.shopBuy || p.shopBuy.day!==dk) p.shopBuy={day:dk, n:{}};
  return p.shopBuy.n; }
function shopLeft(d){ if(!d.cap) return 99; return Math.max(0, d.cap - (shopDayBuys()[d.id]|0)); }
// 아직 못 사는 이유 — 있으면 그 문장을 돌려준다(없으면 '')
function shopWhyLock(d){
  if(d.soon) return d.desc||'준비 중';
  const play=(typeof campPlayS==='function')?campPlayS():0;
  if(play < d.secs){
    // ⚠ 남은 시간을 늘 「시간」으로 올리면 **30분치인데 「1시간 더」**가 되어 앞뒤가 안 맞는다.
    const rem=d.secs-play;
    const need = rem>=3600 ? (Math.ceil(rem/3600)+'시간') : (Math.max(1,Math.ceil(rem/60))+'분');
    return need+' 더 플레이하면 열립니다'; }
  if(shopLeft(d)<=0) return '오늘 한도를 다 썼습니다';
  if(!(shopGemAmt(d)>0)) return '수입을 아직 못 쟀습니다';
  return ''; }
// 「30분치」 · 「24시간치」 — 사람이 읽는 이름
// ⚠ 24시간을 「1일치」로 줄이지 않는다(사용자 표현이 「24시간치」다) — 30분·4시간과
//   **같은 단위**로 읽혀야 셋이 한 줄에서 비교된다.
function shopSpanName(secs){
  return secs < 3600 ? Math.round(secs/60)+'분치' : Math.round(secs/3600)+'시간치'; }
function shopGemAmt(d){
  if(d.soon || typeof campTimeAmt!=='function') return 0;
  return campTimeAmt(d.secs, d.kind==='gas'?'gas':'min'); }
// 표기 — campNum 은 늘 소수 한 자리를 붙이는데(「1300.0만」), 여기 값은 이미
// **유효숫자 두 자리로 반올림된 것**이라 소수점이 거짓 정밀도로 보인다. 「.0」만 뗀다.
// ⛔ campNum 자체를 고치지 않는다 — 게임 전역 표기라 다른 화면이 함께 바뀐다.
function shopAmtTx(n){
  const t=(typeof campNum==='function') ? campNum(n) : Math.floor(n).toLocaleString('en-US');
  return t.split('.0만').join('만').split('.0억').join('억'); }
function shopBuyGemRes(id){
  const d=SHOP_GEM_BUY.find(x=>x.id===id); if(!d||d.soon) return;
  const why=shopWhyLock(d); if(why){ showTownToast(why); return; }
  const amt=shopGemAmt(d);
  if(profGem()<d.gem){ showTownToast('💎 젬이 부족합니다'); return; }
  const p=PROF(); p.gem=(p.gem||0)-d.gem;
  shopDayBuys()[d.id]=(shopDayBuys()[d.id]|0)+1;   // 하루 한도 차감
  campAddRes(d.kind==='gas'?0:amt, d.kind==='gas'?amt:0);
  if(typeof saveMeta==='function') saveMeta();
  if(typeof playSfx==='function') playSfx('hero_merge');
  renderShop(); showTownToast('💠 '+d.nm+' '+shopAmtTx(amt)+' 지급'); }
function shopBuyPack(id){
  const d=(typeof campPackDef==='function')?campPackDef(id):null; if(!d) return;
  if(d.soon){ showTownToast('준비 중입니다'); return; }
  if(typeof campPackOwn==='function' && campPackOwn(id)){ showTownToast('이미 보유 중입니다'); return; }
  showTownToast('💳 결제는 준비 중입니다');   // ⚠ 실제 결제 연동 전 — 지급도 하지 않는다
}
// ① 추천 — 현금 결제 팩. 젬이 함께 들어 있다.
function _shopRecoHTML(){
  if(typeof CAMP_PACKS==='undefined') return _shopSoonHTML('추천');
  let h='<div class="shopPanel"><div class="shopHead">추천<em>한 번만 구매</em></div><div class="shopBody">';
  h+='<div class="shopNote">재화 획득 배수는 <b>서로 더해집니다</b> — 곱하지 않아 후반이 안정적입니다</div>';
  for(const P of CAMP_PACKS){
    const own=(typeof campPackOwn==='function') && campPackOwn(P.id);
    h+='<div class="shopRow"><div class="twRowInfo"><div class="twRowName">'+P.nm
      +(P.gem?(' <span class="twStars">'+resIco('gem','gi')+' '+P.gem+'</span>'):'')+'</div>'
      +'<div class="twRowSub'+((P.soon||own)?' lock':'')+'">'+(P.desc||'')+'</div></div>'
      +'<button class="twBtn" onclick="shopBuyPack(&#39;'+P.id+'&#39;)"'+((P.soon||own)?' disabled':'')+'>'
      +(own?'보유 중':(P.soon?'준비 중':P.won))+'</button></div>';
  }
  h+='</div></div>';
  return h; }
// ② 젬 상점 — 충전 + 그 젬으로 캠프 재화를 산다(한 화면에 둔다)
function _shopGemShopHTML(){
  let h=_shopGemHTML();   // 충전 줄은 기존 것을 그대로 쓴다(단일 소스)
  h+='<div class="shopPanel"><div class="shopHead">젬으로 구매<em>캠프 재화</em></div><div class="shopBody">';
  h+='<div class="shopNote">구매한 재화는 <b>캠프 지갑</b>으로 들어갑니다</div>';
  // ⚠ 못 사는 칸은 **왜인지**를 그 자리에 적는다(잠긴 채 이유가 없으면 버그처럼 보인다).
  for(const d of SHOP_GEM_BUY){
    const why=shopWhyLock(d), amt=shopGemAmt(d);
    const can=!why && profGem()>=d.gem;
    const nm=d.soon? d.nm : (d.nm+' '+shopSpanName(d.secs));
    const left=(!d.soon && d.cap) ? shopLeft(d) : -1;
    const sub=why ? why
      : ('약 '+shopAmtTx(amt)+' — 지금 수입 기준'
         + (left>=0 ? (' · 오늘 '+left+'/'+d.cap) : ''));
    h+='<div class="shopRow"><div class="twRowInfo"><div class="twRowName">'+nm+'</div>'
      +'<div class="twRowSub'+(can?'':' lock')+'">'+sub+'</div></div>'
      +'<button class="twBtn" onclick="shopBuyGemRes(&#39;'+d.id+'&#39;)"'+(can?'':' disabled')+'>'
      +(d.soon?'준비 중':(resIco('gem','gi')+' '+d.gem))+'</button></div>';
  }
  h+='</div></div>';
  return h; }
const SHOP_SECS={ reco:_shopRecoHTML, gem:_shopGemShopHTML };
let _shopSec='reco';
function setShopSec(k){ if(!SHOP_SECS[k]) return; _shopSec=k;
  if(typeof renderShop==='function') renderShop();
  if(typeof navPaint==='function') navPaint(); }
// 장비창 = 위(아바타 + 부위별 슬롯) / 아래(가방) 두 구역. 가방은 늘 열려 있고 각 구역이 따로 스크롤한다.
// 섹션 이동 바(세그먼트) — 화살표 버튼이 아니라 바에서 골라 넘긴다. 목록은 PROF_GEAR_PAGES 한 곳에서만 온다.
// ── 세그먼트 이동 바(단일 소스) ─────────────────────────────────────────────
// 한 구역으로 묶고 그 안에서 나뉘는 네비. 장비창 섹션 바(장비·장신구)와 사냥터 업그레이드 탭(공격·방어·유틸)이
// 같은 컴포넌트를 쓴다 — 새 탭 띠를 만들지 말고 이 함수를 부를 것.
//   items: [{label, ico?}]  ·  i: 현재 index  ·  act(k): k번째 버튼의 onclick 문자열
// 액센트(선택 표시 밑줄)는 화면이 정한다 — 기본 시안, 사냥터 패널(.hmUpg)은 자기 빨강으로 덮는다.
function segNavHTML(items, i, act){ const n=items.length;
  const col=(items[i]&&items[i].col)||'';   // 구역색(R,G,B) — 판을 아래로 물들이는 데 쓴다. 없으면 화면 기본값
  let h='<div class="pdSeg" style="--n:'+n+'"><i class="pdSegInd" style="left:calc(var(--pad) + '+i+'*(100% - 2*var(--pad))/'+n+')'
    +(col?';--segCol:'+col:'')+'"></i>';
  items.forEach(function(it,k){ h+='<button class="pdSegBtn'+(k===i?' on':'')+'" onclick="'+act(k)+'">'
    +(it.ico?'<span data-ico="'+it.ico+'"></span>':'')+it.label
    +(it.tail||'')+'</button>'; });   // tail = 버튼 안 끝에 덧붙이는 것(친구 탭의 안 읽은 배지)
  return h+'</div>'; }
