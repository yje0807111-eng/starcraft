/* ============================================================================
 * 05-home.js — HOME 대시보드 · 던전/라운드 고르기 · 스킬 바
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ── 🏠 HOME 대시보드 ──
// ⚠ 화면은 세 덩어리뿐이다 — ①수입 줄 · ②매치 화면(빈 자리) · ③POWER UPGRADES(스탯 4종).
//    실제 데이터에 붙은 것은 ①과 ③. ②는 시스템이 없어 문구만 있는 빈 판이다.
// POWER UPGRADES = 캐릭터 스탯 4종(실제). 아이콘·표기만 참고 이미지 문법을 따른다.

function openHome(){ loadMeta();
  // 토벌 허브는 '화면'이 아니라 HOME 위에 덮는 팝업(.hbModal)이라 화면 전환으로는 안 닫힌다 —
  // 열어 둔 채 네비 HOME을 누르면 그대로 HOME을 가린다. 여기서 걷어낸다.
  if(typeof closeDungeonHub==='function') closeDungeonHub();
  profEnsureChar();   // 캐릭터가 없으면 조용히 기본 유닛을 지급한다(선택 화면 없음)
  if(typeof bgmStart==='function') bgmStart('lobby');
  showAppScreen('homeScreen'); navShow('home'); renderHome();
  // 🏕 캠프(2026-08-23) — HOME 을 열면 바로 캠프다. 종족을 아직 안 골랐으면 선택 시트가 뜬다.
  // ⛔ 아래 hbStart() 는 **지우지 않았다**. 옛 사냥터(웨이브 방어)를 되살리려면 이 두 줄을 맞바꾼다.
  //    hbStart();   // 배경 전투(웨이브 방어) 시작 — 캠프로 대체됨
  if(typeof campOpen==='function') campOpen();
  if(typeof paintIcons==='function') paintIcons(document.getElementById('homeScreen')); }

// 사냥터 업그레이드 표시 보조물
const HM_ARW='<svg class="hmArw" viewBox="0 0 24 24"><path d="M6 12h11M13 7.5 17.5 12 13 16.5"/></svg>';
// (사냥터 업그레이드 카드의 자물쇠는 2026-08-19 **아예 뺐다** — `해금 필요` 글자와 죽은 색이 이미 잠김을 말한다.
//  자물쇠 그림이 필요한 곳은 칸 하나가 통째로 잠긴 자리(정비 펫·동료 칸)뿐이고, 거기서는 `stIco('lock','🔒')` 를 쓴다.)
// 아이콘은 전부 기존 에셋 재사용 — 'upgrades/up_x' 처럼 폴더까지 담겨 있다
// 경로형 아이콘 — 키에 하위폴더까지 들어 있는 표기('upgrades/up_range'). HB_UPG.ico 와 LP_STATS.ico 가 같이 쓴다.
function _icoPathImg(path, fb){ return '<img class="icoImg" src="'+ICO_DIR+path+'.webp" alt="" draggable="false" data-fb="'+(fb||'⚙')+'" data-fbcls="" onerror="_icoFail(this)">'; }
function hbUpgIco(k){ return _icoPathImg(HB_UPG[k].ico); }
// 이름을 [본체 + 작은 보조어]로 쪼개다 — 폭도 벌고 훑어보기도 쉽다
const HM_SUF=['확률','배수','계수','재생','표적','수','흡수'];
// ═══ 업그레이드/건설 카드 한 장 — 단일 소스 ═══
//  사냥터(renderHome)와 마을(_vgShop)이 둘 다 이 함수만 부른다.
//  ⚠ 마크업을 베껴 두 번째 구현을 만들지 말 것. 새 화면이 필요하면 인자만 늘린다.
//  o = { ico, name, val, next, lv, cost, off, lock, key }
//    val→next 가 있으면 제목 아래에 '값 ▸ 다음값' 으로 화살표가 붙는다.
//  ⚠ 버튼 윗줄은 '지금 레벨'만 적는다(2026-08-18). 예전엔 'LV.8 ▸ 12' 였는데,
//    바로 위에서 이미 값이 어떻게 변하는지 화살표로 말하고 있어 같은 말이 두 번이었다.
function hmUpCardHTML(o){
  const arw=(a,b)=>(b==null||b==='')?a:(a+HM_ARW+'<b class="nx">'+b+'</b>');
  const head=o.lock ? '<span class="hmUpLk">'+(o.lockTx||'해금 필요')+'</span>'
                    : '<span class="hmUpVl">'+arw(o.val,o.next)+'</span>';
  const foot='<span class="hmUpBl">'+(o.lock?stIco('lock','🔒'):o.lv)+'</span>'
            +'<span class="hmUpBc">'+o.cost+'</span>';
  return '<div class="hmUp'+(o.lock?' lk':'')+'" data-k="'+o.key+'">'
    +'<span class="hmUpIco">'+o.ico+'</span>'
    +'<span class="hmUpTx"><b class="hmUpName">'+o.name+'</b>'+head+'</span>'
    +'<button class="hmUpBtn'+(o.off?' off':'')+'" data-k="'+o.key+'"'+(o.act?' onclick="'+o.act+'"':' data-sfx=""')+'>'+foot+'</button>'
    +'</div>'; }
function hmUpgName(n){ const i=n.indexOf(' (');
  if(i>=0) return n.slice(0,i)+'<span class="p"> '+n.slice(i+1)+'</span>';
  const j=n.lastIndexOf(' ');
  if(j>0 && HM_SUF.indexOf(n.slice(j+1))>=0) return n.slice(0,j)+'<span class="p"> '+n.slice(j+1)+'</span>';
  return n; }
function renderHome(){ try{
  const p=PROF(); if(!p) return;
  if(typeof updateCurBar==='function') updateCurBar();       // 💠 재화는 전부 공용 재화 바(#curBar)로 이관
  const gr=document.getElementById('hmUpgGrid');
  // 🧱 건설 모드 = 이 패널이 통째로 '건설' 구역이 된다. 탭 띠·수량은 숨기고 제목만 바꾼다.
  { const bd=!!(_hb&&_hb.build), card=document.querySelector('#homeScreen .hmUpg'),
      ttl=document.querySelector('#homeScreen .hmUpgTtl');
    if(card) card.classList.toggle('bd', bd);
    if(ttl) ttl.textContent = bd ? '건설' : '사냥터 업그레이드';
    if(bd){ if(gr) gr.innerHTML=HB_BUILD_KEYS.map(hbBuildCardHTML).join('');
      if(card) card.classList.remove('down');   // 접혀 있었으면 펴 준다 — 건설인데 안 보이면 막힌다
      renderHomeStats(); return; } }
  if(gr){ const u=hbHunt().upg, coin=Math.floor(p.pcoin||0), cat=hbHunt().upgCat||'char';
    // 탭 띠 — 장비창 섹션 바와 같은 컴포넌트(segNavHTML). 새 탭 띠를 만들지 말 것
    const tb=document.getElementById('hmUpgTabs');
    if(tb){ const ci=Math.max(0, HB_UPG_CAT.findIndex(function(c){ return c[0]===cat; }));
      // 글자만 — 아이콘을 같이 넣으면 아이콘+글자가 한 덩어리로 가운데 정렬돼 글자가 중앙에서 밀린다
      tb.innerHTML=segNavHTML(HB_UPG_CAT.map(function(c){ return { label:c[1], col:c[2] }; }), ci,
        function(k){ return 'hmUpgTab(&#39;'+HB_UPG_CAT[k][0]+'&#39;)'; }); }
    // 수량 1 / 10 / MAX
    hmAutoPaint();
    const qb=document.getElementById('hmUpgQty'), q=hbHunt().upgQty||1;
    if(qb) qb.innerHTML='<button class="hmUpQ on" onclick="hmUpgQtyCycle()">'
      +(q==='max'?'MAX':('×'+q))+'</button>';
    // 카드 — 해금한 것을 위로(쓸 수 있는 것이 먼저 보여야 한다)
    const keys=Object.keys(HB_UPG).filter(function(k){ return HB_UPG[k].cat===cat })
      .sort(function(a,b){ return (hbUpgOwned(b)?1:0)-(hbUpgOwned(a)?1:0); });
    // ⚠ 건설 카드는 여기 없다 — 여긴 '지어진 것의 스활을 올리는' 곳이다.
    //   짓는 것은 전장 위 버튼(renderHbBar → hbBuy)에서 한다 — 어떤 자리에 놓을지 고라야 하므로 필드 옆에 있어야 한다.
    gr.innerHTML=keys.map(function(k){ const U=HB_UPG[k], lv=u[k]||0, own=hbUpgOwned(k);
      let _hd;
      if(own){ const P=hbUpgPlan(k);
        _hd={ v:hbUpgVal(k,lv), n:hbUpgVal(k,lv+P.n), l:'LV.'+lv,
              c:resIco('mineral')+fmtCur(P.sum) }; }
      else _hd={ c:resIco('mineral')+fmtCur(U.u) };
      return hmUpCardHTML({ key:k, ico:hbUpgIco(k), name:hmUpgName(U.name), off:hmUpgOff(k),
        lock:!own, val:_hd.v, next:_hd.n, lv:_hd.l, cost:_hd.c }); }).join('');
    hmUpgBindHold(); }
  hmUpgSnapGrid();
  renderHomeStats();
  const card=document.querySelector('#homeScreen .hmUpg');
  if(card) card.classList.remove('down');   // 접기 폐지 — 옛 저장에 upgDown 이 남아 있어도 늘 펴 둔다
}catch(e){} }
// 칸 폭을 정수로 못 박는다 — 1fr 로 두면 (안쪽폭 - 간격)이 홀수일 때 칸이 185.5px 같은 반 픽셀이 되고,
// 세로 테두리가 기기 픽셀 격자에 안 맞아 한쪽 변만 두 픽셀로 번진다(왼쪽 칸의 오른쪽 변만 흐려 보였다).
// justify-content:start 로 남는 소수는 오른쪽 끝 여백으로 보낸다 — 가운데로 나누면 격자 전체가 다시 반 픽셀로 밀린다.
function hmUpgSnapGrid(){ const g=document.getElementById('hmUpgGrid'); if(!g) return;
  const cs=getComputedStyle(g), gap=parseFloat(cs.columnGap)||0;
  const inner=g.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if(!(inner>0)) return;
  const col=Math.floor((inner-gap)/2); if(!(col>0)) return;
  g.style.justifyContent='start';
  g.style.gridTemplateColumns=col+'px '+col+'px'; }
// 레벨업으로 받은 스탯 포인트 — 남았을 때만 줄이 뜬다. 배분은 공용 profAllocStat()(마을 광장과 같은 함수).
// 진화·환생 신호 — 하단 패널의 줄이 아니라 상단 성장 버튼의 ! 배지.
//   (줄로 두면 조건이 찰 때마다 패널 높이가 흔들렸다 — 2026-08-14 이동)
function renderHomeStats(){ const dot=document.getElementById('hbGrowDot'); if(!dot) return;
  // ☰ 의 ! = 더보기 안에 '지금 할 수 있는 것'이 있다는 신호. 안을 열면 어느 칸인지 각자의 점이 알려 준다.
  const has=((typeof hbGrowHas==='function') && hbGrowHas()) || ((typeof dqHas==='function') && dqHas());
  dot.classList.toggle('show', !!has); }
// 4칸(2행)까지만 보이게 — 칸 높이는 글꼴·문구에 따라 변하므로 실측해서 넣는다(값을 박으면 어긋난다)
// 높이는 CSS 에서 2.7줄로 고정된다(탭마다 개수가 달라도 패널이 안 흔들리도록).
// ── 라운드 선택 · 반복/등반 ──
// 최고 도달 라운드(hunt.best[dg])까지만 고를 수 있다. 라운드를 바꾸면 진행 중인 판은 버리고 새로 시작한다.
function hbBest(dg){ const H=hbHunt(); return Math.max(1, Math.min(HB_ROUND_MAX, H.best[dg||H.dg]||1)); }
// 던전 N 해금 = 던전 N-1에서 HB_DG_UNLOCK 라운드 도달. 던전 1은 항상 열려 있다.
function hbDgOpen(dg){ return HB_DG_ALL_OPEN || dg<=1 || (hbHunt().best[dg-1]||0)>=HB_DG_UNLOCK; }
function hbEliteChance(dg,round){ return Math.min(HB_ELITE_MAX, hbProg(dg,round)*0.012); }
// ── 던전·라운드 고르기 ────────────────────────────────────────────────────
// ⚠ 고르는 즉시 이동하지 않는다 — _hbPick 에 '초안'을 담고 [이동]을 눌러야 적용된다.
//   던전은 ◀▶ 로 한 장씩, 라운드는 세로 피커(아래가 1라운드)에서 가운데 띠에 멈춘 것이 선택된다.
let _hbPick=null, _hbRdT=null;
const HB_RD_H=40, HB_RD_GAP=6;                       // 피커 한 칸 높이 · 간격 → 이동 간격은 둘의 합
function hbRdPitch(){ return HB_RD_H+HB_RD_GAP; }
// 피커 맨 윗 칸 = 최고 도달, 단 '다음 마일스톤'이 더 위면 거기까지 잠긴 칸으로 보여 준다(도전정신).
function hbRdTop(dg,round){ const b=hbBest(dg); return Math.min(HB_ROUND_MAX, Math.max(b, hbNextRw(dg,round||b)||0)); }
function hbOpenRounds(){ const el=document.getElementById('hbRoundSheet'); if(!el) return;
  const H=hbHunt();
  _hbPick={ dg:(_hb?_hb.dg:H.dg)||1, round:(_hb?_hb.round:H.round)||1 };
  el.classList.remove('hide'); renderRoundSheet();
  if(typeof paintIcons==='function') paintIcons(el);
  if(typeof playSfx==='function') playSfx('ui_open');
  // 여백은 칸 높이·컨테이너 높이로 결정된다 → 보인 뒤에 재야 한다(숨은 동안은 높이가 0)
  requestAnimationFrame(()=>{ if(!_hbPick) return; hbRdPad(); hbRdCenter(_hbPick.round,false); }); }
function hbCloseRounds(){ const el=document.getElementById('hbRoundSheet'); if(el) el.classList.add('hide');
  _hbPick=null; clearTimeout(_hbRdT); _hbRdT=null;
  if(typeof playSfx==='function') playSfx('ui_close'); }
// 위아래 여백 = (보이는 높이 - 칸 높이)/2. 이게 있어야 첫·마지막 칸도 가운데에 설 수 있다.
function hbRdPad(){ const sc=document.getElementById('hbRdScroll'); if(!sc) return;
  const pad=Math.max(0,(sc.clientHeight-HB_RD_H)/2);
  sc.style.paddingTop=pad+'px'; sc.style.paddingBottom=pad+'px'; }
// 라운드 → 스크롤 위치. 목록은 큰 수가 위라 인덱스 = (최대 - 라운드).
function hbRdCenter(round, smooth){ const sc=document.getElementById('hbRdScroll'); if(!sc||!_hbPick) return;
  const top=hbRdTop(_hbPick.dg,_hbPick.round), i=Math.max(0,Math.min(top-1, top-round));
  sc.scrollTo({ top:i*hbRdPitch(), behavior:smooth?'smooth':'auto' }); }
// 스크롤이 멎으면 가운데 칸이 곧 선택이다(짧게 기다렸다가 한 번만 확정한다)
function hbRdScrolled(){ clearTimeout(_hbRdT); _hbRdT=setTimeout(hbRdSettle, 110); }
function hbRdSettle(){ const sc=document.getElementById('hbRdScroll'); if(!sc||!_hbPick) return;
  const top=hbRdTop(_hbPick.dg,_hbPick.round), best=hbBest(_hbPick.dg);
  const i=Math.max(0,Math.min(top-1, Math.round(sc.scrollTop/hbRdPitch())));
  let r=top-i;
  if(r>best){ r=best; hbRdCenter(r,true); }        // 잠긴 목표 칸에 멈췄으면 고를 수 있는 데까지 되돌린다
  if(r===_hbPick.round) return;
  _hbPick.round=r; hbRdMark(); if(typeof playSfx==='function') playSfx('ui_tab'); }
// 강조만 갈아 끼운다 — 목록을 다시 그리면 스크롤이 튄다
function hbRdMark(){ const sc=document.getElementById('hbRdScroll'); if(!sc||!_hbPick) return;
  for(const b of sc.querySelectorAll('.hbRd')) b.classList.toggle('on', +b.dataset.r===_hbPick.round);
  hbPickNote(); }
// 칸을 눌러 고르면 그 칸이 가운데로 미끄러져 온다
function hbRdTap(r){ if(!_hbPick) return; _hbPick.round=r; hbRdMark(); hbRdCenter(r,true);
  if(typeof playSfx==='function') playSfx('ui_tab'); }
// 던전 넘기기 — 열려 있는 것만 건너뛴다. 라운드는 그 던전의 최고 도달로 맞춘다.
function hbPickDg(d){ if(!_hbPick) return;
  for(let n=_hbPick.dg+d; n>=1 && n<=HB_DG_MAX; n+=d){ if(!hbDgOpen(n)) continue;
    _hbPick.dg=n; _hbPick.round=hbBest(n); renderRoundSheet();
    requestAnimationFrame(()=>{ if(!_hbPick) return; hbRdPad(); hbRdCenter(_hbPick.round,false); });
    if(typeof playSfx==='function') playSfx('ui_tab'); return; } }
// [이동] — 여기서만 실제로 옮긴다
function hbPickGo(){ if(!_hbPick) return; const H=hbHunt(), d=_hbPick.dg, r=_hbPick.round;
  if(d!==H.dg){ H.dg=d; hbEnsureModels(d);
    if(_hb){ _hb.dg=d; _hb._pat=null; } }                 // 바닥 타일 패턴 캐시 무효화(던전이 바뀌었다)
  H.round=r; saveMeta();
  if(_hb){ _hb.round=r; _hb.wave=1; _hb.phase='fight'; _hb.buf={min:0,gas:0,xp:0,kills:0};
    _hb.foes.length=0; _hb.pend.length=0; _hb.char.hp=_hb.char.hpMax; hbSpawnWave(); }
  if(typeof playSfx==='function') playSfx('ui_confirm');
  hbHud(); hbCloseRounds(); }
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
// 안내 줄은 없앴다(2026-08-14) — 칸 안의 🎁/✓·최고 표시로 충분하고, 세 줄짜리 설명이 피커를 눌렀다.
function hbPickNote(){}
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
function hbSetClimb(v){ const H=hbHunt(); H.climb=!!v; H.climbChosen=1; saveMeta(); renderRoundSheet(); hbHud();
  if(typeof playSfx==='function') playSfx('ui_tab'); }
// 라운드 이동의 실제 동작 — 시트를 여닫지 않는다(화살표 ±1과 목록 선택이 함께 쓴다)
function hbSetRound(n){ const H=hbHunt(), best=hbBest(H.dg);
  n=Math.max(1,Math.min(Math.min(best,HB_ROUND_MAX),n|0)); if(n===H.round && _hb && _hb.round===n) return false;
  H.round=n; saveMeta();
  if(_hb){ _hb.round=n; _hb.wave=1; _hb.phase='fight'; _hb.buf={min:0,gas:0,xp:0,kills:0};
    _hb.foes.length=0; _hb.pend.length=0; _hb.char.hp=_hb.char.hpMax; hbSpawnWave(); }
  if(typeof playSfx==='function') playSfx('ui_open');
  hbHud(); return true; }
// ◀▶ ±1 — 가장 잦은 동작이라 시트를 거치지 않는다. 1 ~ 최고 도달 사이로 가둔다.
function hbRoundStep(d){ const H=hbHunt(), cur=(_hb?_hb.round:(H.round||1));
  if(hbSetRound(cur+(d|0)) && !document.getElementById('hbRoundSheet').classList.contains('hide')) renderRoundSheet(); }
// ── Phase 4 UI — 스킬 바(전장 하단) + 부스트 팝업(라운드 팝업과 같은 .hbModal 재사용) ──
// 🧱 건설 카드 한 장 — 하단 패널이 건설 구역이 될 때 쓴다. 카드 규격은 업그레이드와 같은 hmUpCardHTML.
//    누르면 그 자리에서 배치 모드로 들어간다(hbBuy → hbArmStart).
function hbBuildCardHTML(bk){
  const B=HB_STRUCT[bk], n=hbStructN(bk), mx=hbBuildMax(bk), full=n>=mx, cost=hbBuildCost(bk), M=hbAllyMul();
  const coin=Math.floor(((typeof PROF==='function'&&PROF())||{}).pcoin||0);
  // 값 = 지금 이 종류가 내는 총량. ⚠ 벽은 화력이 없다 — 화력 수치를 붙이면 거짓말이라 '칸 수'로 낸다.
  const tot=function(c){ return (bk==='wall')   ? (c+'칸')
                             : (bk==='bunker') ? Math.round(hbCharStats().hpMax*M.bunker.hp*c)
                                               : Math.round(M.turret.dps*100*c)+'%'; };
  return hmUpCardHTML({ key:'b_'+bk,
    ico:'<img class="icoImg" src="'+ICO_DIR+'buildings/'+B.ico+'.webp" alt="" draggable="false">', name:B.name,
    off:hmUpgOff('b_'+bk), lock:full, lockTx:'최대 '+mx+(bk==='wall'?'칸':'기'),
    val:tot(n), next:full?null:tot(n+1), lv:'LV.'+n,
    cost:resIco('mineral')+fmtCur(cost),
    act:full?null:('hbBuy(&#39;'+bk+'&#39;)') }); }
// 더보기 > 건설 = 즉시 건설 모드. 하단 업그레이드 패널이 그대로 '건설' 구역이 된다(팝업·드롭다운 없음).
// 나가는 길은 오른쪽 위 ⊘(#hbBuildStop) 하나 — hbBuildExit()가 모드도 끄고 하단도 되돌린다.
function hbBuildStart(){ if(!_hb) return;
  hbBuildEnter(); hbArmBtns(); renderHome();
  if(typeof playSfx==='function') playSfx('ui_open'); }
// ☰ 더보기 — 사냥터에서만. 다른 화면에서는 같은 버튼이 그대로 설정을 연다.
// ⚠ ☰ 는 두 개가 겹쳐 있다 — 게임 HUD의 #settingsBtn(hudTopRow)과 재화 바의 #curSettingsBtn.
//    사냥터에서는 재화 바 쪽이 위에 있어 그쪽이 눌린다. 그래서 둘 다 이 함수를 거치게 한다.
//    (한쪽만 고치면 "눌러도 설정만 나온다"가 된다 — 실제로 그랬다)
// fb: 사냥터가 아닐 때의 갈 곳 — 'app'이면 앱 화면 설정, 아니면 유즈맵 설정.
// 열려 있으면 같은 자리가 X 다 — 그 X 만이 닫는 유일한 방법이다
function hbMoreOn(){ const el=document.getElementById('hbMoreSheet');
  return !!(el && !el.classList.contains('hide')); }
function hbMoreBtns(){ return ['curSettingsBtn','settingsBtn']
  .map(function(id){ return document.getElementById(id); }).filter(Boolean); }
function hudTopMenu(fb){ const hs=document.getElementById('homeScreen');
  if(hbMoreOn()) return hbCloseMore();
  if(hs && !hs.classList.contains('hide') && typeof hbOpenMore==='function') return hbOpenMore();
  if(fb==='app' && typeof openAppSettings==='function') return openAppSettings();
  openSettings(); }
function hbOpenMore(){ const el=document.getElementById('hbMoreSheet'); if(!el) return;
  renderHbMore(); el.classList.remove('hide');
  { const box=document.getElementById('hbMoreBox'), ph=document.getElementById('phone');
    // 실제로 눌린 ☰ 아래에 붙인다 — 두 개가 겹쳐 있으므로 보이는 쪽을 고른다
    const btns=['curSettingsBtn','settingsBtn'].map(function(id){ return document.getElementById(id); })
      .filter(function(b){ return b && b.getClientRects().length; });
    if(box && ph && btns.length){ const r=btns[0].getBoundingClientRect(), p=ph.getBoundingClientRect();
      // 테두리 1px 만큼 끌어올려 두 선을 정확히 포갠다 — 그냥 붙이면 1px+1px 이 2줄로 보인다
      box.style.top=(Math.round(r.bottom-p.top)-1)+'px';
      box.style.right=Math.round(p.right-r.right)+'px'; } }
  hbMoreBtns().forEach(function(b){ b.classList.add('on'); b.title='닫기'; });
  if(typeof playSfx==='function') playSfx('ui_open'); }
function hbCloseMore(){ const el=document.getElementById('hbMoreSheet'); if(el) el.classList.add('hide');
  hbMoreBtns().forEach(function(b){ b.classList.remove('on'); b.title='더보기'; });
  if(typeof playSfx==='function') playSfx('ui_close'); }
// 시트를 닫고 나서 연다 — 배치(건설)처럼 필드를 눌러야 하는 것이 시트에 가리면 안 된다
function hbMoreGo(fn){ hbCloseMore(); setTimeout(function(){ try{ fn(); }catch(e){} }, 60); }
// ☰ 더보기 칸 (2026-08-25 정리) — 캠프에서 **실제로 도는 것**만 남겼다.
// ⛔ 뺀 것의 코드는 지우지 않았다(유보는 삭제가 아니다 · GAME_DIRECTION §5). 길만 닫았다:
//   · 마을(town)   — 5구역 중 상점은 하단 네비와 같은 화면 · 캐릭터/장비는 §5-B 유보 · 관문은 토벌(§5-D)
//   · 성장(grow)   — 환생·진화는 §5-A 유보
//   · 건설(build)  — **이미 죽은 칸이었다**: hbBuildStart() 가 `if(!_hb) return` 이라 캠프에선 아무 일도 안 한다
//   · 토벌(dg)     — §5-D 유보(도달 불가)
//   · 일일 퀘스트  — 14종 중 9종이 옛 사냥터 계측이라 캠프에선 거의 안 찬다 → **가이드**로 바꿨다
// ⚠ 부스트는 남겼지만 **지금 효과가 없다** — 수입·공격 배율이 옛 사냥터 전투에만 걸려 있고
//   캠프 수급(campTapGain/campGatherMul)에는 안 들어간다. 캠프 쪽에서 걸어 줘야 산다.
const HB_MORE=[
  {k:'guide',  ico:'flag',    name:'가이드',      sub:'무엇을 할지 순서대로'},
  {k:'att',    ico:'cal',     name:'출석',        sub:'4주 캘린더'},
  {k:'boost',  ico:'boost',   name:'부스트',      sub:'일시 강화'},
  {k:'set',    ico:'',        name:'설정',        sub:''},
];
function renderHbMore(){ const g=document.getElementById('hbMoreGrid'); if(!g) return;
  g.innerHTML=HB_MORE.map(function(it){
    const off='';
    // 배지(!) — '지금 받을 게 있다'만 알린다. 판정은 각 시스템이 갖고 여기선 묻기만 한다.
    // ⚠ 글자를 넣지 않는다 — 이 격자는 아이콘만(이름은 title/aria-label). 점은 CSS 로만 그린다.
    const dot=((it.k==='guide' && typeof guideOn==='function'  && guideOn())
            || (it.k==='daily' && typeof dqQHas==='function'   && dqQHas())
            || (it.k==='att'   && typeof dqAttHas==='function' && dqAttHas())
            || (it.k==='grow'  && typeof hbGrowHas==='function' && hbGrowHas())) ? '<i class="hbGrowDot show"></i>' : '';
    // 설정은 아이콘 세트에 톱니가 없어 직접 그린다. ☰ 와 같은 그림을 쓰면 '메뉴 안의 메뉴'로 보인다.
    const ico=it.ico ? '<span data-ico="'+it.ico+'"></span>'
      : '<i class="hbMoreSvg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="butt">'
        +'<circle cx="12" cy="12" r="6.1"/>'      // 몸통 링 — 이게 없으면 태양이 된다
        +'<circle cx="12" cy="12" r="2.1"/>'      // 축 구멍
        +'<path d="M12 3.2v2.6M12 18.2v2.6M3.2 12h2.6M18.2 12h2.6'
        +      'M5.9 5.9l1.9 1.9M16.2 16.2l1.9 1.9M18.1 5.9l-1.9 1.9M7.8 16.2l-1.9 1.9"/>'   // 이빨은 링 바깥으로만
        +'</svg></i>';
    const tip=it.name+(it.sub?' — '+it.sub:'');
    return '<button class="hbMoreIt" data-k="'+it.k+'" onclick="hbMoreTap(&#39;'+it.k+'&#39;)"'+off
      +' title="'+tip+'" aria-label="'+tip+'">'+dot+ico+'</button>'; }).join('');
  if(typeof paintIcons==='function') paintIcons(g); }
function hbMoreTap(k){
  if(k==='guide') return hbMoreGo(function(){ if(typeof openGuide==='function') openGuide(); });
  if(k==='daily') return hbMoreGo(function(){ if(typeof openDaily==='function') openDaily(); });   // ⛔ 칸에서만 뺐다 — 함수는 살아 있다
  if(k==='att')   return hbMoreGo(function(){ if(typeof openAtt==='function') openAtt(); });
  if(k==='set')   return hbMoreGo(function(){
    if(typeof openAppSettings==='function') openAppSettings();   // 앱 문맥(.appCtx) — 인게임 설정에는 배속·게임 나가기가 있다
    else openSettings(); });
  if(k==='build') return hbMoreGo(function(){ if(typeof hbBuildStart==='function') hbBuildStart(); });
  if(k==='dg')    return hbMoreGo(function(){ if(typeof openDungeonHub==='function') openDungeonHub(); });
  if(k==='boost') return hbMoreGo(function(){ if(typeof hbOpenBoost==='function') hbOpenBoost(); });
  if(k==='town')  return hbMoreGo(function(){ if(typeof openVillage==='function') openVillage(); });
  if(k==='grow')  return hbMoreGo(function(){ if(typeof hbOpenGrow==='function') hbOpenGrow(); }); }
