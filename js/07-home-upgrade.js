/* ============================================================================
 * 07-home-upgrade.js — 동료 · 방치 수입 · 환생 UI · 사냥터 업그레이드 · 하단 네비
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// 🤝 동료 — 영입(첫 구매)·강화(같은 버튼)·출전 토글. 옛 전직 트리가 여기로 옮겨 왔다.
function hbOpenMates(){ const el=document.getElementById('hbMateModal'); if(!el) return;
  el.classList.remove('hide'); renderMateModal(); if(typeof playSfx==='function') playSfx('ui_open'); }
function hbCloseMates(){ _mateFeedT=null; const el=document.getElementById('hbMateModal'); if(el) el.classList.add('hide'); }
// 확률 표기 — 갓은 1단계에서 0.0001% 라, 소수점 1자리로 찍으면 전부 '0.0%'로 뭉개진다.
function fmtOdds(v){ const x=v*100;
  const d = x>=10?0 : x>=1?1 : x>=0.1?2 : x>=0.01?3 : 4;
  return x.toFixed(d)+'%'; }
let _mateFeedT=null;      // 합성 재료를 고르는 중인 대상 동료 id(없으면 목록만 보여 준다)
function renderMateModal(){ const box=document.getElementById('hbMateBody'); if(!box) return;
  const party=hbParty(), tk=hbMateTicket();
  let h='';
  // ① 뽑기 — 뽑기권으로만 영입한다. 지금 확률과 다음 단계까지 남은 횟수를 같이 보여 준다.
  { const pr=hbGachaProbs(), nx=hbGachaNext();
    h+='<div class="hbGrowLbl">동료 뽑기 <span class="hbStars">Lv.'+hbGachaLv()+'</span></div>';
    h+='<div class="hbRow"><span class="hbRowIco">'+resIco('ticket_ally')+'</span>'
      +'<span class="hbRowTx"><b>동료 뽑기권 <i>'+tk+'</i></b><em>'
      +(nx? ('다음 단계까지 '+nx.left+'회 — Lv.'+nx.lv+'가 되면 상위 등급이 더 열립니다') : '최고 단계')
      +'</em></span>'
      +'<button class="hbRowBtn" onclick="hbDoMateRoll()"'+(tk>0?'':' disabled')+'>뽑기</button></div>';
    h+='<div class="hbRow"><span class="hbRowIco">💎</span>'
      +'<span class="hbRowTx"><b>뽑기권 구매</b><em>엘리트 처치 · 맵의 상자 · 라운드 보너스로도 얻습니다</em></span>'
      +'<button class="hbRowBtn" onclick="doBuyTicket(&#39;ally&#39;)"'+(profGem()>=TICKET_GEM.ally?'':' disabled')+'>💎 '+TICKET_GEM.ally+'</button></div>';
    h+='<div class="mateOdds">';
    for(const t of GACHA_TIER_ORDER){ const v=pr[t]||0;
      h+='<span class="mateOdd'+(v>0?'':' off')+'" style="color:'+(v>0?TIER_COLOR[t]:'#5a5a5a')+'">'
        +GACHA_TIERS[t].name+' <b>'+(v>0? fmtOdds(v) : '—')+'</b></span>'; }
    h+='</div>'; }
  // ② 합성 — 중복 동료를 직접 골라 넣는다
  if(_mateFeedT){ const M=HB_MATES[_mateFeedT], mats=hbMateMats();
    h+='<div class="hbGrowLbl">'+M.name+' 강화 — 재료 고르기</div>';
    h+='<div class="hbRow"><span class="hbRowIco">'+M.ico+'</span><span class="hbRowTx">'
      +'<b>Lv.'+hbMateLv(_mateFeedT)+' → '+(hbMateLv(_mateFeedT)+1)+'</b>'
      +'<em>재료 '+hbMateFed(_mateFeedT)+' / '+hbMateNeed(_mateFeedT)+'</em></span>'
      +'<button class="hbRowBtn alt" onclick="hbMateFeedEnd()">닫기</button></div>';
    if(!mats.length) h+='<div class="hbRow"><span class="hbRowTx"><em>중복으로 얻은 동료가 없습니다 — 뽑기에서 겹치면 재료가 됩니다</em></span></div>';
    for(const m of mats){ const MM=HB_MATES[m.id];
      h+='<div class="hbRow"><span class="hbRowIco">'+MM.ico+'</span>'
        +'<span class="hbRowTx"><b style="color:'+TIER_COLOR[MM.tier]+'">'+MM.name+' <i>×'+m.dup+'</i></b>'
        +'<em>'+GACHA_TIERS[MM.tier].name+' · 재료 '+m.pt+'</em></span>'
        +'<button class="hbRowBtn" onclick="hbDoMateFeed(&#39;'+m.id+'&#39;)">넣기</button></div>'; }
    box.innerHTML=h; _mateNote(party); return; }
  // ③ 보유 목록
  h+='<div class="hbGrowLbl">보유 동료</div>';
  let own=0;
  for(const id in HB_MATES){ if(!hbMateOwned(id)) continue; own++;
    const M=HB_MATES[id], out=party.indexOf(id)>=0, dup=hbMateDup(id);
    h+='<div class="hbRow"><span class="hbRowIco">'+M.ico+'</span>'
      +'<span class="hbRowTx"><b style="color:'+TIER_COLOR[M.tier]+'">'+M.name+(out?' <i>출전</i>':'')+(dup?' <i>중복 '+dup+'</i>':'')+'</b>'
      +'<em>'+GACHA_TIERS[M.tier].name+' · Lv.'+hbMateLv(id)+' · 위력 '+Math.round(hbMateDps(id)*100)+'% · '+M.tip+'</em></span>'
      +'<button class="hbRowBtn alt" onclick="hbDoMateToggle(&#39;'+id+'&#39;)">'+(out?'대기':'출전')+'</button>'
      +'<button class="hbRowBtn" onclick="hbMateFeedStart(&#39;'+id+'&#39;)">강화</button></div>'; }
  if(!own) h+='<div class="hbRow"><span class="hbRowTx"><em>아직 없습니다 — 뽑기권으로 영입하세요</em></span></div>';
  // ④ 아직 못 얻은 동료(도감) — 무엇을 노리는지 보여야 뽑을 맛이 난다
  h+='<div class="hbGrowLbl">미보유</div>';
  for(const id in HB_MATES){ if(hbMateOwned(id)) continue; const M=HB_MATES[id];
    h+='<div class="hbRow lock"><span class="hbRowIco">'+M.ico+'</span>'
      +'<span class="hbRowTx"><b style="color:'+TIER_COLOR[M.tier]+'">'+M.name+'</b>'
      +'<em>'+GACHA_TIERS[M.tier].name+' · '+M.tip+'</em></span></div>'; }
  box.innerHTML=h; _mateNote(party); }
function _mateNote(party){ const nt=document.getElementById('hbMateNote'); if(!nt) return;
  nt.textContent='출전 '+party.length+'/'+hbMateMax()+'명 — 함께 싸웁니다. 중복으로 얻은 동료는 다른 동료의 강화 재료가 됩니다.'
    ; }
function hbDoMateRoll(){ const r=hbMateRoll();
  if(!r){ hmToast('동료 뽑기권이 없습니다'); return; }
  const M=HB_MATES[r.id];
  hmToast((r.isNew?'🎉 ':'♻ ')+GACHA_TIERS[M.tier].name+' '+M.name+(r.isNew?' 영입!':' — 중복 → 강화 재료'));
  if(typeof playSfx==='function') playSfx('ui_open');
  renderMateModal(); renderHome(); }
function hbMateFeedStart(id){ _mateFeedT=id; renderMateModal(); }
function hbMateFeedEnd(){ _mateFeedT=null; renderMateModal(); }
function hbDoMateFeed(matId){ const t=_mateFeedT; if(!t) return;
  const r=hbMateFeed(t, matId);
  if(!r){ hmToast('재료가 없습니다'); return; }
  if(typeof r==='number') hmToast('✦ '+HB_MATES[t].name+' Lv.'+hbMateLv(t)+' 달성');
  if(typeof playSfx==='function') playSfx('ui_tab');
  renderMateModal(); renderHome(); }
function hbDoMateToggle(id){ if(!hbMateToggle(id)){ hmToast('출전 정원이 찼습니다'); return; }
  if(typeof playSfx==='function') playSfx('ui_tab');
  renderMateModal(); }
// 건설 — 보유 수를 늘리면 즉시 전장에 배치된다
// 건설 팝업은 없앴다(main) — 업그레이드 패널 '건물' 구역 카드를 누르면 바로 배치 모드로 들어간다.
// ⚠ 사는 즉시 자동 배치가 아니라 **타일에 직접 놓는다**(2026-08-12 확정) — 벙커마다 동료를 따로 넣으려면 개별 실체여야 한다.
function hbBuy(k){ const B=HB_STRUCT[k], p=PROF(); if(!B||!_hb) return;
  if(hbStructN(k)>=hbBuildMax(k)) return;
  if(Math.floor(p.pcoin||0)<hbBuildCost(k)){ hmToast('미네랄이 부족합니다'); return; }
  const c=hbFreeCell(k); if(!c){ hmToast('빈 자리가 없습니다'); return; }
  hbArmStart(k, c[0], c[1]); }
// 실제 설치 — 배치 확정·마이그레이션·스모크가 모두 이 하나를 지난다(단일 소스)
function hbPlaceStruct(k,gx,gy){ const B=HB_STRUCT[k], p=PROF(); if(!B) return false;
  if(hbStructN(k)>=hbBuildMax(k)) return false;
  if(!hbCanPlace(k,gx,gy)) return false;
  const cost=hbBuildCost(k);
  if(Math.floor(p.pcoin||0)<cost) return false;
  p.pcoin-=cost; hbBase().tiles[hbKey(gx,gy)]={k:k}; saveMeta();
  hbLayoutBase();
  if(typeof dqNote==='function') dqNote('build',1);   // 📅 일일 — 기지에 건물 짓기
  if(typeof updateCurBar==='function') updateCurBar();
  return true; }
// 부스트 — 시간제. 남은 시간은 초 단위로 보여준다.
function hbOpenBoost(){ const el=document.getElementById('hbBoostModal'); if(!el) return;
  el.classList.remove('hide'); renderBoostModal(); if(typeof playSfx==='function') playSfx('ui_open'); }
function hbCloseBoost(){ const el=document.getElementById('hbBoostModal'); if(el) el.classList.add('hide'); }
function renderBoostModal(){ const box=document.getElementById('hbBoostBody'); if(!box) return;
  const coin=Math.floor(PROF().pcoin||0);
  box.innerHTML=Object.keys(HB_BOOSTS).map(function(k){ const B=HB_BOOSTS[k], on=hbBoostOn(k);
    return '<div class="hbRow"><span class="hbRowIco">'+B.ico+'</span>'
      +'<span class="hbRowTx"><b>'+B.name+(on?' <i>'+hbBoostLeft(k)+'s</i>':'')+'</b><em>'+B.tip+'</em></span>'
      +'<button class="hbRowBtn" onclick="hbBuyBoost(&#39;'+k+'&#39;)"'+((coin<B.cost)?' disabled':'')+'>'
      +(on?'연장 ':'')+fmtCur(B.cost)+' 미네랄</button></div>'; }).join(''); }
function hbBuyBoost(k){ const B=HB_BOOSTS[k], p=PROF(); if(!B) return;
  if(Math.floor(p.pcoin||0)<B.cost){ hmToast('미네랄이 부족합니다'); return; }
  const H=hbHunt(); if(!H.boostT) H.boostT={};
  p.pcoin-=B.cost;
  H.boostT[k]=Math.max(Date.now(), H.boostT[k]||0) + B.sec*1000;    // 이미 걸려 있으면 연장
  saveMeta();
  if(typeof dqNote==='function') dqNote('boost',1);   // 📅 일일 — 부스트 사용
  if(typeof playSfx==='function') playSfx('ui_open');
  if(typeof updateCurBar==='function') updateCurBar();
  renderBoostModal(); renderHbBar(); }
// ── A. 방치·오프라인 수입 = 자동사냥 실적 기준 ──
// 훈련장 고정 배율(0.6~1.0 × 파워)은 자동사냥 수입의 1/8 수준이라 사실상 죽어 있었다.
// 이제 '라운드를 깰 때 실제로 번 속도'를 지수이동평균으로 기록하고 그것으로 정산한다.
const HB_RATE_EMA=.3;                       // 새 기록을 얼마나 반영할지(0=고정, 1=마지막 판만)
function hbNoteRate(min, sec){ if(!(sec>0)) return;
  const H=hbHunt(), v=min/sec;
  H.rate = H.rate ? H.rate*(1-HB_RATE_EMA)+v*HB_RATE_EMA : v; }
// ── B. 진화·환생 — 마을 광장까지 안 가고 HOME에서 ──
//   전직은 폐지됐다(2026-08-12) — 그 자리는 동료 영입(HB_MATES)이 대신한다.
// 성장 배지(!) — '지금 할 수 있는 게 있다'는 신호. 진입점 자체는 항상 열려 있다(좌상단 아이콘).
function hbGrowHas(){ const c=(typeof CHAR==='function')?CHAR():null; if(!c) return false;
  return profCanRebirth(c) || rpFree(c)>0; }   // 환생할 수 있거나 · 안 찍은 환생 포인트가 있거나
function hbOpenGrow(){ const el=document.getElementById('hbGrowModal'); if(!el) return;
  if(typeof chrReturnBody==='function') chrReturnBody();   // 캐릭터 화면이 빌려 갔으면 되찾는다
  el.classList.remove('hide'); renderGrowModal(); if(typeof playSfx==='function') playSfx('ui_open'); }
function hbCloseGrow(){ const el=document.getElementById('hbGrowModal'); if(el) el.classList.add('hide'); }
function renderGrowModal(){ const box=document.getElementById('hbGrowBody'); if(!box) return;
  const c=CHAR(); if(!c) return;
  let h='<div class="hbRoundNote" style="padding:0 0 8px">Lv.'+c.level
    +' · 환생 <b>'+(c.reb||0)+'</b>회 · 보유 환생 포인트 <b>'+rpFree(c)+'</b>/'+rpTotal(c)+'</div>';
  // 🔁 환생 — 레벨 곡선이 무거워지는 지점에서 '되감고 배수를 얻는' 축.
  h+='<div class="hbGrowLbl">환생 <span class="hbStars">'
    +(c.reb?('×'+profXpMul(c).toFixed(2)+' 경험치 · ×'+profCoinMul(c).toFixed(2)+' 미네랄'):'—')+'</span></div>';
  // ⭐ '몇 회차'가 아니라 **지금 레벨에서 얼마를 받는가**를 말한다 — 보상이 레벨에서 나오기 때문이다.
  //    밀수록 숫자가 커지는 게 화면에서 보여야 "조금 더 밀자"가 성립한다.
  { const need=profRebNextLv(c), N=profRebDone(c)+1, can=profCanRebirth(c);
    const pNeed=profRebPoint(c), pHave=((typeof PLAYER_META!=='undefined'&&PLAYER_META.coins)||0);
    const lvOk=((c.level|0)>=need);
    const gain=profRebGainAt(c.level), rp=profRebGrantAt(c.level);
    h+='<div class="hbRow"><span class="hbRowIco">'+stIco('rebirth','🔁')+'</span>'
      +'<span class="hbRowTx"><b>'
      +(can ? ('Lv.'+c.level+' 환생 — 경험치 ×'+(profXpMul(c)+gain).toFixed(2)+' · 미네랄 ×'
               +(profCoinMul(c)+PROF_REB_COIN_R*gain).toFixed(2))
            : (N+'회차 환생'))+'</b>'
      +'<em>'+(can ? ('레벨·레벨 포인트·<b>미네랄 업그레이드·미네랄·던전/라운드</b>가 처음으로 돌아갑니다. <b>깼던 구간은 열려 있어</b> 곧장 되돌아갈 수 있습니다. 해금·기록·장비·펫·환생 포인트는 그대로.'
                      +'<br>받는 것: 환생 포인트 +'+rp+' · 배수 +'+gain.toFixed(2)+' — <b>더 밀수록 커집니다</b>')
                  : (lvOk ? ('◎ 포인트 '+pNeed+' 필요 (보유 '+pHave+') — 포인트는 <b>유즈맵에서만</b> 나옵니다')
                          : ('Lv.'+need+' 필요 — Lv.'+PROF_REB_MIN_LV+'부터 언제든, 몇 번이든 할 수 있습니다'
                             +(pNeed>0?(' · ◎ 포인트 '+pNeed):''))))+'</em></span>'
      +'<button class="hbRowBtn" onclick="hbDoRebirth()"'+(can?'':' disabled')+'>환생</button></div>'; }
  // 🔁 환생 포인트 — 환생으로만 얻고 환생해도 안 사라진다. 줄 모양은 스탯 화면의 레벨 포인트와 같은 컴포넌트.
  h+=_ptListHTML('rp', c);
  box.innerHTML=h; }
// 포인트 목록(레벨 포인트 · 환생 포인트 공용) — 두 벌로 만들면 반드시 어긋난다.
//   kind='lp' → unit.pts / lpMul(선형 배수)   ·   kind='rp' → unit.rpts / rpMul(복리 배수)
function _ptListHTML(kind, c){ const rp=(kind==='rp');
  const free = rp? rpFree(c) : lpFree(c), spent = rp? rpSpent(c) : lpSpent(c);
  let h='<div class="hbGrowLbl">'+(rp?'환생 포인트':'레벨 포인트')
    +' <span class="hbTblSub">'+(rp? ('1p = +'+Math.round(RP_STEP*100)+'% · 같은 곳에 또 찍으면 값이 오른다 · 환생해도 남는다')
                                   : ('레벨 1회 = '+LP_PER_LEVEL+'p · 1p = +'+Math.round(LP_STEP*100)+'% · 환생하면 함께 돌아갑니다'))+'</span></div>';
  // 자동·초기화 = 사냥터 수량 버튼(×1/×10/MAX)과 같은 물성. 새 버튼 물성을 만들지 않는다.
  //   자동은 레벨 포인트에만 둔다 — 환생 포인트는 회차마다 몇 점씩 들어오는 '고르는' 축이다.
  h+='<div class="lpHead"><span class="lpFree'+(free?' on':'')+'">남은 포인트 <b>'+free+'</b></span>'
    +'<span class="lpBtns">'
    +(rp? '' : ('<span class="hmUpQty lpQ au"><button class="hmUpQ'+((lpAutoOn(c)||_lpPicking)?' on':'')
                +'" onclick="lpAutoBtn()">'+lpAutoBtnTx(c)+'</button></span>'))
    +'<span class="hmUpQty lpQ rs"><button class="hmUpQ on" onclick="ptDoReset(\''+kind+'\')"'
    +(spent?'':' disabled')+'>초기화</button></span></span></div>';
  // ⛔ 카드 마크업을 베끼지 말 것 — 사냥터 업그레이드와 '같은 함수'(hmUpCardHTML)를 부른다.
  //    val▸next = 이 1점으로 배수가 어디까지 가는지 · lv = 지금 찍은 칸 · cost = 값
  // ⚠ 카드는 감싸는 칸(.lpCell) 안에 그대로 들어간다 — 카드 함수(hmUpCardHTML)의 트리는 안 건드린다.
  //    고르는 중일 때만 이 칸이 '눌리는 자리'가 된다.
  const pick=(!rp && _lpPicking), auto=(rp? '' : lpAutoKey(c));
  h+='<div class="lpList'+(pick?' picking':'')+'"'+(auto? (' data-auto="'+auto+'"') : '')+'>';
  for(const S of LP_STATS){ const n=rp? rpPts(S.k,c) : lpPts(S.k,c);
    const cost=ptCost(kind, S.k, c);
    h+='<span class="lpCell'+(auto===S.k?' on':'')+'"'
      +(pick? (' onclick="lpAutoSet(&#39;'+S.k+'&#39;)"') : '')+'>'
      +hmUpCardHTML({ key:S.k, ico:_icoPathImg(S.ico), name:S.name, off:free<cost,
        val:_ptShow(kind, S.k, n), next:_ptShow(kind, S.k, n+1),
        lv:'LV.'+n, cost:'-'+cost+'p',
        act:'ptTap(&#39;'+kind+'&#39;,&#39;'+S.k+'&#39;)' })
      +'</span>'; }
  return h+'</div>'; }
// 실행 — 마을 렌더러를 부르지 않는다(HOME에서는 마을 DOM이 숨어 있어 토스트가 안 보인다)
function hbAfterGrow(msg){ if(_hb){ hbSyncChar();
    _hb.floats.push({x:0,y:-40,tx:msg,cl:'#5dff8f',t:0}); }
  if(typeof playSfx==='function') playSfx('ui_open');
  if(typeof updateCurBar==='function') updateCurBar();
  renderGrowModal(); renderHome(); if(typeof hbHud==='function') hbHud(); }
// 🔁 환생 — 되돌릴 수 없으므로 반드시 확인을 받는다
function hbDoRebirth(){ const c=CHAR(); if(!c || !profCanRebirth(c)) return;
  const N=profRebDone(c)+1, gain=profRebGainAt(c.level);
  if(typeof confirm==='function' && !confirm(
      'Lv.'+c.level+' 에서 '+N+'회차 환생을 합니다.\n\n'
     +'· 레벨·레벨 포인트 → 1\n· 미네랄 업그레이드 레벨 → 0\n· 보유 미네랄 → 0\n· 던전/라운드 → 1-1 (깬 구간은 열려 있습니다)\n\n'
     +'남는 것: 업그레이드 해금 · 최고 기록 · 환생 포인트 · 장비 · 펫\n'
     +'받는 것: 환생 포인트 +'+profRebGrantAt(c.level)
     +' · 경험치 ×'+(profXpMul(c)+gain).toFixed(2)
     +' · 미네랄 ×'+(profCoinMul(c)+PROF_REB_COIN_R*gain).toFixed(2)+'\n\n'
     +'※ 더 높은 레벨에서 누를수록 배수가 커집니다.\n\n계속할까요?')) return;
  if(!profRebirth(c)) return;
  // ⚠ 되돌아갈 수 있다는 걸 알려 준다 — 모르면 1-1 부터 손으로 걸어 올라간다.
  { const H=hbHunt(); let bd=1,br=1;
    for(const d in H.best){ const dd=+d, rr=Math.min(HB_ROUND_MAX,H.best[d]||1);
      if(hbProg(dd,rr)>hbProg(bd,br)){ bd=dd; br=rr; } }
    if(hbProg(bd,br)>1 && typeof toast==='function')
      toast('🔁 환생 완료 — 최고 기록 '+bd+'-'+br+' 까지 열려 있습니다 (좌상단 깃발에서 이동)'); }
  if(_hb){ _hb.dg=hbHunt().dg; _hb.round=1; _hb.wave=1; _hb.phase='fight'; _hb._pat=null;
    _hb.foes.length=0; _hb.pend.length=0; _hb.chests&&(_hb.chests.length=0);
    if(typeof hbEnsureModels==='function') hbEnsureModels(_hb.dg);
    hbSyncChar(true); _hb.char.hp=_hb.char.hpMax; hbSpawnWave(); }
  hbAfterGrow('환생! 경험치 ×'+profXpMul(c).toFixed(2)); }
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
function hbOpenInfo(){ const el=document.getElementById('hbInfoModal'); if(!el) return;
  if(typeof chrReturnBody==='function') chrReturnBody();   // 캐릭터 화면이 빌려 갔으면 되찾는다
  el.classList.remove('hide'); renderInfoModal(); if(typeof playSfx==='function') playSfx('ui_open'); }
function hbCloseInfo(){ const el=document.getElementById('hbInfoModal'); if(el) el.classList.add('hide'); }
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
// ── D. 레벨 해금 확장 — 해금이 실제로 무언가를 열도록 배선 ──
// 🔓 장착/출전 칸 — 펫·동료 모두 **0칸에서 시작해 미네랄로 하나씩 연다**(2026-08-14 확정).
//   최대 3칸이고 레벨 해금이 아니다 — 그래서 PROF_UNLOCKS 의 pet_slot3·4, ally_plus 는 전부 삭제됐다.
//   ⚠ 여는 값을 두 곳에 적지 말 것. MG_SLOT_COST 한 줄이 전부다.
const MG_SLOT_MAX=3;
const MG_SLOT_COST=[500, 6000, 60000];   // 1·2·3번째 칸을 여는 미네랄
function mgSlotCost(n){ return MG_SLOT_COST[n]||0; }
function profPetSlots(){ const p=PROF(); return Math.max(0, Math.min(MG_SLOT_MAX, p.petSlots||0)); }
function hbBuildMax(k){ const B=HB_STRUCT[k]; if(!B) return 0;
  let m=B.max;
  // ⚠ 'ally'는 없어졌다 — 동료 정원은 hbMateMax()가 따로 정한다(3칸 고정)
  if(k==='turret'&& profHasUnlock('turret_plus')) m+=2;
  return m; }
// 접기는 없앴다(2026-08-19) — 늘 펴 두는 구역이라 접는 칸이 자리만 먹었다.
// ⚠ .hmUpg.down 스타일은 마을 패널이 아직 쓰므로 남겨 둔다.

// 해금 — 한 번 지불하면 그 업그레이드가 열린다(레벨은 0부터)
function hmUnlockUpg(k){ const p=PROF(), U=HB_UPG[k]; if(!U || hbUpgOwned(k)) return;
  if(Math.floor(p.pcoin||0)<U.u){ hmToast('미네랄이 부족합니다'); return; }
  p.pcoin-=U.u; hbHunt().unl[k]=1; saveMeta();
  if(typeof playSfx==='function') playSfx('ui_confirm');   // 해금은 '확정' 음 — 강화음과 구분된다
  if(typeof updateCurBar==='function') updateCurBar(); renderHome(); hmUpgWon(k); }
function hmUpgTab(c){ hbHunt().upgCat=c; if(typeof playSfx==='function') playSfx('ui_tab'); saveMeta(); renderHome(); }
// 한 칸을 눌러 돌린다 — 1 → 10 → MAX → 1
// ══ 🤖 자동 업그레이드 ══════════════════════════════════════════════════════════
//   켜 두면 살 수 있는 것 중 **가장 싼 것**을 계속 산다. '눌러 놓고 유즈맵 가는' 구역이라
//   미네랄이 쌓인 채로 놀지 않게 하는 게 목적이다.
//   ⭐ 대상을 고르게 하지 않는 이유: 업그레이드가 31종·4구역이라 하나만 고르면 나머지가 놀고,
//      싼 것부터 사면 저절로 고르게 오른다(가격이 곧 우선순위다).
//   ⚠ 해금(HB_UPG[k].u)도 '살 수 있는 것'에 포함된다 — 안 그러면 잠긴 칸이 영영 안 열린다.
//   ⚠ 한 틱에 무한히 사지 않는다(HM_AUTO_MAX) — 미네랄이 많으면 프레임이 통째로 멈춘다.
const HM_AUTO_MAX=12;
function hmAutoOn(){ return !!hbHunt().upgAuto; }
function hmAutoToggle(){ const H=hbHunt(); H.upgAuto=H.upgAuto?0:1;
  if(typeof playSfx==='function') playSfx('ui_tab');
  if(typeof saveMeta==='function') saveMeta();
  if(H.upgAuto) hmAutoUpgTick();
  renderHome(); }
// 지금 살 수 있는 것 중 가장 싼 키(없으면 '')
function hmAutoNext(){ const coin=Math.floor((PROF()||{}).pcoin||0);
  let best='', bc=Infinity;
  for(const k in HB_UPG){ const c=hmUpgCost(k);
    if(c<=coin && c<bc){ bc=c; best=k; } }
  return best; }
// 한 번에 최대 HM_AUTO_MAX 개. 실제로 산 개수를 돌려준다.
// ⚠ hmBuyUpg/hmUnlockUpg 를 쓰면 안 된다 — 매번 renderHome()과 소리를 부른다(초당 수십 번).
//    조용한 경로로 사고, 산 게 있을 때만 '한 번' 다시 그린다.
function hmAutoUpgTick(){ if(!hmAutoOn()) return 0;
  const p=PROF(); let n=0;
  for(; n<HM_AUTO_MAX; n++){ const k=hmAutoNext(); if(!k) break;
    if(hbUpgOwned(k)){ if(!hmBuyUpgQuiet(k, true)) break; }
    else { const U=HB_UPG[k]; if(Math.floor(p.pcoin||0)<U.u) break;
      p.pcoin-=U.u; hbHunt().unl[k]=1; } }
  if(n>0){ saveMeta();
    if(typeof hbSyncChar==='function') hbSyncChar();
    if(typeof updateCurBar==='function') updateCurBar();
    if(typeof renderHome==='function') renderHome(); }
  return n; }
function hmAutoPaint(){ const el=document.getElementById('hmUpgAuto'); if(!el) return;
  el.innerHTML='<button class="hmUpQ'+(hmAutoOn()?' on':'')+'" onclick="hmAutoToggle()">자동</button>'; }
// ══════════════════════════════════════════════════════════════════════════════
// 💠 이 칸을 지금 살 수 있는가 — 값이 모자라면 true(꺼짐).
//   ⛔ 판정을 두 벌로 두지 말 것: 그릴 때(renderHome)와 다시 칠할 때(hmUpgAfford)가 갈리면
//      '회색인데 눌리는 버튼'이 생긴다. key 는 업그레이드 키 또는 건설 카드의 'b_<종류>'.
function hmUpgCost(key){
  if(String(key).indexOf('b_')===0){ const bk=key.slice(2);
    return hbStructN(bk)>=hbBuildMax(bk) ? Infinity : hbBuildCost(bk); }   // 최대면 살 수 없다
  const U=HB_UPG[key]; if(!U) return Infinity;
  return hbUpgOwned(key) ? hbUpgPlan(key).sum : U.u; }
function hmUpgOff(key){ return Math.floor((PROF()||{}).pcoin||0) < hmUpgCost(key); }
// 재화는 처치마다 늘어나는데 카드를 통째로 다시 그리면 너무 비싸다 → 살 수 있는지만 다시 칠한다.
//   ⚠ 이게 없으면 미네랄이 충분해져도 화면을 떠났다 와야 버튼이 열린다(2026-08-19 버그).
function hmUpgAfford(){ const gr=document.getElementById('hmUpgGrid'); if(!gr) return 0;
  let n=0;
  for(const btn of gr.querySelectorAll('.hmUpBtn[data-k]')){
    const off=hmUpgOff(btn.dataset.k);
    if(btn.classList.contains('off')!==off){ btn.classList.toggle('off', off); n++; } }
  return n; }
function hmUpgQtyCycle(){ const H=hbHunt(), q=H.upgQty||1;
  H.upgQty=(q===1)?10:((q===10)?'max':1);
  if(typeof playSfx==='function') playSfx('ui_tab'); saveMeta(); renderHome(); }
function hmBuyUpg(k){ const p=PROF(); if(!HB_UPG[k]) return;
  if(!hbUpgOwned(k)) return hmUnlockUpg(k);        // 잠긴 칸은 같은 버튼이 해금을 맡는다
  const P=hbUpgPlan(k), cost=P.sum;
  if(Math.floor(p.pcoin||0)<cost){ hmToast('미네랄이 부족합니다'); return; }
  p.pcoin-=cost; hbHunt().upg[k]=(hbHunt().upg[k]||0)+P.n; saveMeta();
  if(typeof dqNote==='function') dqNote('upg',P.n);   // 📅 일일 — 업그레이드(한 번에 여러 레벨을 사면 그만큼)
  if(typeof playSfxT==='function') playSfxT('upgrade', 60);   // 연타해도 소리가 겹치지 않게
  hbSyncChar(k==='hp'?12:0);                                    // 전투 중 즉시 반영(현재 체력은 유지·상한만 확장)
  if(typeof updateCurBar==='function') updateCurBar(); renderHome(); hmUpgWon(k);
  { const el=document.querySelector('#hmUpgGrid .hmUp[data-k="'+k+'"] .hmUpVl');
    if(el && el.firstChild && el.firstChild.nodeType===3)
      hmUpCount(el.firstChild, k, (hbHunt().upg[k]||0)-P.n, hbHunt().upg[k]||0, 320); }
  if(typeof hbHud==='function') hbHud(); }
// ── 손맛 3종 ──
// 숫자가 튀어오른다 — 값이 '바뀜었다'가 아니라 '올랐다'로 읽히게
function hmUpCount(el, k, from, to, ms){ if(!el) return;
  const t0=(typeof performance!=='undefined'?performance.now():Date.now()), dur=ms||320;
  const step=function(){ const now=(typeof performance!=='undefined'?performance.now():Date.now());
    const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);        // easeOutCubic
    el.textContent=hbUpgVal(k, from+(to-from)*e);
    if(p<1) requestAnimationFrame(step); };
  requestAnimationFrame(step); }
// 누르는 동안엔 그 칸의 글자만 고친다(13칸 전체 + 이미지 재생성은 끊긴다)
function hmUpgTouch(k){ const el=document.querySelector('#hmUpgGrid .hmUp[data-k="'+k+'"]'); if(!el) return;
  const lv=hbHunt().upg[k]||0, P=hbUpgPlan(k), coin=Math.floor((PROF()||{}).pcoin||0);
  const vl=el.querySelector('.hmUpVl'), bl=el.querySelector('.hmUpBl'), bc=el.querySelector('.hmUpBc'), bt=el.querySelector('.hmUpBtn');
  if(vl) vl.innerHTML=hbUpgVal(k,lv)+HM_ARW+'<b class="nx">'+hbUpgVal(k,lv+P.n)+'</b>';
  if(bl) bl.innerHTML='LV.'+lv+HM_ARW+'<b class="nx">'+(lv+P.n)+'</b>';
  if(bc) bc.innerHTML=resIco('mineral')+fmtCur(P.sum);
  if(bt) bt.classList.toggle('off', coin<P.sum);
  if(typeof updateCurBar==='function') updateCurBar(); }
// 길게 누르면 연타 — 350ms 뒤부터 시작해 점점 빨라진다(200→60ms)
let _hmHold=null, _hmPt=null;
function hmHoldStop(){ if(!_hmHold) return; clearTimeout(_hmHold.t); const k=_hmHold.k, any=_hmHold.n>0;
  _hmHold=null;
  if(any){ if(typeof saveMeta==='function') saveMeta(); renderHome(); hmUpgWon(k); if(typeof hbHud==='function') hbHud(); } }
function hmHoldStart(k){
  hmHoldStop();
  _hmHold={k:k, n:0, d:200};
  const tick=function(){ if(!_hmHold||_hmHold.k!==k) return;
    const lv0=hbHunt().upg[k]||0;
    if(!hmBuyUpgQuiet(k)){ hmHoldStop(); return; }
    _hmHold.n++;
    const el=document.querySelector('#hmUpgGrid .hmUp[data-k="'+k+'"] .hmUpVl');
    hmUpgTouch(k);
    if(el) hmUpCount(el.firstChild&&el.firstChild.nodeType===3?el.firstChild:el, k, lv0, hbHunt().upg[k]||0, 180);
    _hmHold.d=Math.max(60, _hmHold.d*0.82);
    _hmHold.t=setTimeout(tick, _hmHold.d); };
  _hmHold.t=setTimeout(tick, 350); }
// 구매 1회 — 화면을 다시 그리지 않는다(연타용). 샀으면 true
// silent=true 면 소리도 안 낸다 — 자동 업그레이드는 초당 수십 번 사서 소리가 기관총이 된다.
function hmBuyUpgQuiet(k, silent){ const p=PROF(), U=HB_UPG[k]; if(!p||!U) return false;
  if(!hbUpgOwned(k)) return false;
  const P=hbUpgPlan(k); if(Math.floor(p.pcoin||0)<P.sum) return false;
  p.pcoin-=P.sum; hbHunt().upg[k]=(hbHunt().upg[k]||0)+P.n;
  if(typeof dqNote==='function') dqNote('upg',P.n);   // 📅 일일 — 길게 눌러 연타로 사는 쪽도 같은 계측
  if(!silent && typeof playSfxT==='function') playSfxT('upgrade', 60);
  return true; }
// 포인터 흐름: down 에서 1회 + 연타 시작 / up·cancel 에서 정지. click 은 안 쓴다.
function hmUpgBindHold(){ const gr=document.getElementById('hmUpgGrid'); if(!gr||gr._holdBound) return;
  gr._holdBound=1;
  gr.addEventListener('pointerdown', function(e){ const b=e.target.closest('.hmUpBtn'); if(!b) return;
    const k=b.dataset.k; if(!k || !HB_UPG[k]) return;   // 건설(수량) 카드는 제 onclick 이 맡는다 — 연타 대상이 아니다
    _hmPt={x:e.clientX, y:e.clientY};
    const lv0=hbHunt().upg[k]||0, owned=hbUpgOwned(k);
    hmBuyUpg(k);                                  // 첫 번은 평소대로(해금 포함)
    if(owned && (hbHunt().upg[k]||0)>lv0) hmHoldStart(k);   // 산 경우에만 연타
  });
  // 끌기 시작 = 스크롤 의도 → 연타 취소(구매가 새는 걸 막는다)
  gr.addEventListener('pointermove', function(e){ if(!_hmHold||!_hmPt) return;
    if(Math.abs(e.clientX-_hmPt.x)>8 || Math.abs(e.clientY-_hmPt.y)>8) hmHoldStop(); });
  // 키보드 Enter · 프로그램 .click() 경로 — 진짜 포인터 클릭(detail≥1)은 위에서 이미 처리했다
  gr.addEventListener('click', function(e){ if(e.detail!==0) return;
    const b=e.target.closest('.hmUpBtn'); if(b&&b.dataset.k) hmBuyUpg(b.dataset.k); });
  const stop=function(){ hmHoldStop(); };
  gr.addEventListener('pointerup', stop);
  gr.addEventListener('pointercancel', stop);
  gr.addEventListener('pointerleave', stop);
  window.addEventListener('pointerup', stop);
  window.addEventListener('blur', stop); }
// 방금 오른 칸만 한 번 번찍 — renderHome() 이 새로 그린 뒤에 붙여야 한다
function hmUpgWon(k){ const el=document.querySelector('#hmUpgGrid .hmUp[data-k="'+k+'"]'); if(!el) return;
  el.classList.remove('won'); void el.offsetWidth; el.classList.add('won');
  setTimeout(function(){ el.classList.remove('won'); }, 560); }
function hmToast(msg){ if(typeof showTownToast==='function') showTownToast(msg);
  else if(typeof lobbyToast==='function') lobbyToast(msg); }

// ── 하단 6칸 네비게이션 ──
// 화면마다 바를 새로 만들지 않는다 — #phone 위에 하나만 두고 여기서 표시·활성 탭을 정한다.
// ══ 하단 네비 = 2층(최상위 구역 → 구역 전용) ══════════════════════════
// 최상위 5칸에서 구역을 누르면 그 구역 전용 네비로 내려간다: [‹][구역][하위…].
// '‹ 돌아가기' = 사냥터 화면 + 최상위 네비(홈이 허브).
// ⚠ 마크업은 손으로 쓰지 않는다 — 이 표가 단일 소스이고 navPaint()가 칸을 만든다.
//   sub.cur 가 있는 구역(정비·유즈맵)은 '지금 고른 것'이 있어 하위 한 칸이 .cur 로 표시된다.
//   sub.cur 가 없는 구역(사냥터)은 하위가 전부 '여는 동작'이라 선택 표시가 없다.
//   하위가 없는 구역(강화·상점)은 내려가지 않는다 — [‹][상점] 2칸은 빈 껍데기라서.
const NAV_TREE=[
  // 사냥터 = 기본 화면이자 최상위 그 자체 — 눌러도 내려가지 않는다(하위는 화면 상단 버튼줄이 맡는다)
  // 사냥터 = 기본 화면이자 '‹ 뒤로'가 돌아가는 곳. 칸은 두지 않는다(noCell) — 다른 구역이 내려갈 때
  //   자기 이름 칸을 빼는 것과 같은 규칙이다. ⚠ 항목 자체는 남겨야 navShow('home')·navBack() 이 찾는다.
  { k:'home', label:'사냥터', ico:'home', noCell:true, go:()=>openHome(), subs:[] },
  // 캐릭터 — '나 자신'에 관한 것. 내용은 아직 비어 있다(옛 '강화' 자리).
  { k:'upg',  label:'캐릭터', ico:'user', go:()=>openUpgScreen(), cur:()=>_chrSec, reset:()=>setChrSec('stat'), subs:[
      { k:'stat',  label:'스탯', ico:'user',  act:()=>setChrSec('stat') },
      { k:'reb',   label:'환생', ico:'fav',   act:()=>setChrSec('reb') },
      { k:'skill', label:'스킬', ico:'boost', act:()=>setChrSec('skill') } ] },
  { k:'gear', label:'정비', ico:'bag', go:()=>openGear(), cur:()=>_gearTab, reset:()=>setGearTab('gear'), subs:[
      { k:'gear', label:'장비', ico:'armor', act:()=>setGearTab('gear') },
      { k:'pet',  label:'펫',   ico:'paw',   act:()=>setGearTab('pet') },
      { k:'ally', label:'동료', ico:'party', act:()=>setGearTab('ally') } ] },
  // 유즈맵: 정렬(인기·신규·추천·즐겨찾기)은 화면 위 띠로 되돌렸고, 하단은 소셜이 맡는다.
  //   ⛔ 소셜 UI 를 새로 만들지 않는다 — 이미 있는 #twChat 시트(.msSocial 채팅·파티·친구)를 연다.
  { k:'map',  label:'유즈맵', ico:'map', go:()=>twGoMap(), cur:()=>_mapSocial, reset:()=>mapOpenSocial('chat'), subs:[
      { k:'chat',   label:'채팅', ico:'chat',   act:()=>mapOpenSocial('chat') },
      { k:'friend', label:'친구', ico:'friend', act:()=>mapOpenSocial('friend') },
      { k:'party',  label:'파티', ico:'party',  act:()=>mapOpenSocial('party') } ] },
  { k:'shop', label:'상점', ico:'gift', go:()=>openShop(), cur:()=>_shopSec, reset:()=>setShopSec('deal'), subs:[
      { k:'deal', label:'한정구매', ico:'flag',  act:()=>setShopSec('deal') },
      { k:'draw', label:'뽑기',    ico:'gift',  act:()=>setShopSec('draw') },
      { k:'res',  label:'재화',    ico:'coin',  act:()=>setShopSec('res') },
      { k:'pack', label:'패키지',  ico:'box',   act:()=>setShopSec('pack') },
      { k:'gem',  label:'충전',    ico:'boost', act:()=>setShopSec('gem') } ] },
];
const navSec=(k)=>NAV_TREE.find(x=>x.k===k)||null;
let _navSec='', _navDrill='';   // 지금 구역 / 내려가 있는 구역('' = 최상위)
// attr = 'nav'(구역) / 'sub'(구역 안 항목). 같은 키가 두 층에 있을 수 있어(정비 구역 = 장비 하위 = gear) 나눈다.
function _navCell(attr,k,label,ico,cls,fn){
  return '<button class="navIt'+(cls?' '+cls:'')+'" data-'+attr+'="'+k+'" onclick="'+fn+'">'
    +'<span data-ico="'+ico+'"></span>'+label+'</button>'; }
function navPaint(){ const b=document.getElementById('navBar'); if(!b) return;
  const sec=navSec(_navSec);
  let h='';
  if(_navDrill && sec){
    h+=_navCell('nav','back','뒤로','back','navBk','navBack()');   // 구역 이름 칸은 두지 않는다 — 하위에 자리를 준다
    const cur=sec.cur?sec.cur():null;
    for(const t of sec.subs) h+=_navCell('sub', t.k, t.label, t.ico, (cur===t.k?'cur':''), "navSub('"+t.k+"')");
  } else {
    for(const x of NAV_TREE){ if(x.noCell) continue;   // 사냥터는 칸이 없다 — 거기 있을 땐 아무 칸도 켜지지 않는다
      h+=_navCell('nav', x.k, x.label, x.ico, (x.k===_navSec?'on':''), "navGo('"+x.k+"')"); }
  }
  b.innerHTML=h;
  b.classList.toggle('drill', !!_navDrill);
  if(typeof paintIcons==='function') paintIcons(b); }
// 화면 전환이 부르는 쪽 — 구역이 바뀌면 최상위로 올라온다(같은 구역이면 내려간 상태를 지킨다)
function navShow(tab){ const b=document.getElementById('navBar'); if(!b) return;
  b.classList.toggle('hide', !tab);
  // ⚠ null 은 '숨김'일 뿐 '구역을 떠남'이 아니다 — 여기서 상태를 지우면
  //   showAppScreen 이 항상 navShow(null) 을 먼저 부르므로 내려간 상태가 매번 풀린다(마을 진입에서 밟았다).
  if(!tab) return;
  if(_navSec!==tab){ _navSec=tab; _navDrill=''; }   // 다른 구역으로 갔다 = 최상위로
  navPaint(); }
// 최상위 칸 — 화면으로 이동하고, 하위가 있으면 그 구역 네비로 내려간다
function navGo(tab){ if(typeof playSfx==='function') playSfx('ui_tab');
  if(tab==='town'){ openHome(); return navShow('home'); }   // 마을 폐지 — 옛 진입점은 HOME으로
  const sec=navSec(tab); if(!sec) return;
  const was=_navDrill;
  sec.go();                                   // 화면 이동(안에서 navShow 를 부르며 _navDrill 을 비운다)
  if(!sec.subs.length) return;
  // 구역에 '밖에서 들어올 때'는 늘 첫 하위로 되돌린다 — 유즈맵 하단 탭바(gtabDrill)와 같은 규칙.
  // 안 그러면 정비의 '펫'을 보다 나갔다 다시 들어와도 펫이 열려 있어 구역 이름과 내용이 어긋난다.
  // ⚠ sec.go() 가 이미 그 구역 내용을 그렸으므로 reset 은 반드시 그 뒤에(렌더까지 하는 setter 로) 부른다.
  if(was!==tab && sec.reset) sec.reset();
  _navDrill=tab; navPaint(); }
// 구역 전용 칸
function navSub(k){ const sec=navSec(_navDrill); if(!sec) return;
  const t=sec.subs.find(x=>x.k===k); if(!t) return;
  if(typeof playSfx==='function') playSfx('ui_tab');
  t.act(); navPaint(); }
// 유즈맵 소셜 — 화면 하단 상주 구역(#msSocialDock). 시트를 열지 않는다.
//   ⛔ 소셜 DOM(.msSocial)은 하나뿐: 유즈맵에 들어올 때 도크로 옮겨 쓰고(mapDockSocial),
//     마을 채팅 시트(twOpenChat)가 열릴 때 제자리(#twChat)로 돌려놓는다. id 기반 함수들이 그대로 동작한다.
let _mapSocial='chat';   // 기본 = 채팅
function mapDockSocial(){ const dock=document.getElementById('msSocialDock'), so=document.querySelector('.msSocial');
  if(!dock||!so) return;
  if(so.parentNode!==dock) dock.appendChild(so);
  if(!_mapSocial) _mapSocial='chat';
  mapDockApply();
  if(typeof setBottomTab==='function') setBottomTab(_mapSocial); }
function mapOpenSocial(bt){ _mapSocial=bt;
  mapDockSet(true);   // 네비에서 채팅·친구·파티를 고른 것 = 펴 달라는 뜻
  if(typeof setBottomTab==='function') setBottomTab(bt);
  navPaint(); }
// ── 소셜 도크 접기/펴기 ──────────────────────────────────────────────
//  유즈맵 선택은 「고르는 화면」이라 기본은 접힘이다 — 목록이 화면을 거의 다 쓴다.
//  ⚠ 접힌 줄의 내용은 #msChat 의 마지막 줄을 **복제**한다. 채팅을 두 번 그리지 않는다.
const MAPDOCK_KEY='nm_mapdock';
let _mapDockOpen=(typeof _lsGet==='function') ? !!_lsGet(MAPDOCK_KEY,false) : false;
function mapDockApply(){ const dock=document.getElementById('msSocialDock'); if(!dock) return;
  dock.classList.toggle('collapsed', !_mapDockOpen);
  if(!_mapDockOpen) mapDockPeek(); }
function mapDockSet(open){ if(_mapDockOpen===!!open){ mapDockApply(); return; }
  _mapDockOpen=!!open; if(typeof _lsSet==='function') _lsSet(MAPDOCK_KEY,_mapDockOpen); mapDockApply(); }
function mapDockToggle(){ mapDockSet(!_mapDockOpen);
  if(typeof playSfx==='function') playSfx(_mapDockOpen?'ui_open':'ui_close');
  if(_mapDockOpen){ const c=document.getElementById('msChat'); if(c) c.scrollTop=c.scrollHeight; } }
// 접힌 줄 갱신 — 채팅이 한 줄 늘 때마다 addGlobalMsg/addWhisperMsg 가 불러 준다.
function mapDockPeek(){ const peek=document.getElementById('msDockPeek'); if(!peek) return;
  const box=document.getElementById('msChat');
  // ⚠ 지금 범위(전체/파티/친구)에서 **실제로 보이는** 줄만 센다 — .msChat 의 표시 필터와 같은 규칙이다.
  //   전부 세면 파티 범위인데 전체 채팅 마지막 줄이 접힌 줄에 뜬다.
  const sc=(box&&box.dataset.scope)||'all';
  const lines=box? box.querySelectorAll('.mcLine.sc-'+sc+', .mcLine.whisper') : null;
  const last=(lines&&lines.length)? lines[lines.length-1] : null;
  if(!last){ peek.textContent='채팅'; return; }
  peek.innerHTML=last.innerHTML; }   // 복제 — 이름·구분자·본문 서식이 채팅과 그대로 같다
// ‹ 돌아가기 = 사냥터 화면 + 최상위 네비
function navBack(){ if(typeof playSfx==='function') playSfx('ui_back');
  openHome(); _navDrill=''; navPaint(); }
