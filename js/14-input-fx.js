/* ============================================================================
 * 14-input-fx.js — HUD · 입력(드래그/줌팬) · 수송 · 이동 물리 · 트레일/발사 이펙트 · 루프 · 샌드박스
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ── HUD ──
function fmt(s){ const m=Math.floor(s/60),x=Math.floor(s%60); return String(m).padStart(2,'0')+':'+String(x).padStart(2,'0'); }
// 상단 HUD 표기(단일 소스) — 자원 3종 + 좌상단 시계. nemo·오토배틀 등 모든 맵이 이 두 함수만 호출한다(형식이 갈라지지 않게).
function hudSetRes(cr, en, pop, popMax){ const set=(id,html)=>{ const e=document.getElementById(id); if(e) e.innerHTML=html; };
  set('hMin', cr);                    // 미네랄 — 단위 표기는 아이콘이 대신한다
  set('hGas', en);                    // 가스
  set('hPop', pop+'/'+popMax); }      // 커맨드 포인트
function hudSetTime(sec){ const e=document.getElementById('hTime'); if(e) e.textContent=fmt(Math.max(0,Math.ceil(sec||0))); }
function updateHud(){
  document.getElementById('hRound').textContent=G.round;
  document.getElementById('hRoundMax').textContent='/'+mapCfg('rounds',TOTAL_ROUNDS);
  document.getElementById('hKill').textContent=G.kills;
  hudSetTime(G.roundTime);   // 라운드 카운트다운(준비/전투 동일 표시)
  if(G.tab==='Players') updatePlayerCounts();
  hudSetRes(G.mineral, G.gas, G.units.filter(u=>!u.fixed).length, maxUnits());
}

// ── 입력: 유닛 드래그 (메인 탭) ──
let drag=null;
function evPos(e){ const v=document.getElementById('vMain').getBoundingClientRect();
  const t=e.touches?e.touches[0]:e; let x=(t.clientX-v.left)/v.width, y=(t.clientY-v.top)/v.height;
  const vw=(typeof G!=='undefined')&&G.view; if(vw&&vw.zoom&&vw.zoom!==1){ x=(x-0.5)/vw.zoom+vw.x; y=(y-0.5)/vw.zoom+vw.y; }   // 화면좌표→월드좌표(줌/팬 역변환)
  return {x:x, y:y}; }
// 유닛 위 정확 판정(반경 내)
function hitUnitPrecise(x,y){ let best=1e9,hit=null;
  for(const u of G.units){ if(u.atBoss) continue; const d=Math.hypot((u.x-x)*GW,(u.y-y)*GH); if(d<=unitRadius(u)+6 && d<best){ best=d; hit=u; } } return hit; }
const GRAB_PAD=6;    // 그랩 여유(px) — 유닛 위를 정확히 눌러야 잡힘(지정 구역을 좁게 유지)
function grabUnit(x,y){ let bestAir=1e9,hitAir=null, bestGnd=1e9,hitGnd=null;
  const _liftPx=(window.M3D&&M3D.airLiftPx)?M3D.airLiftPx():0;   // 공중유닛 부양 화면 px
  for(const u of G.units){ if(u.atBoss) continue;
    const _air=(typeof FXLAB_AIR!=='undefined' && FXLAB_AIR.has(u.gmodel||u.id));   // 공중유닛
    const _uy=u.y*GH - (_air?_liftPx:0);   // 공중은 부양한 만큼 위(모델 위치)에서 잡힘
    const d=Math.hypot((u.x-x)*GW, _uy-y*GH);
    if(d<=unitRadius(u)+GRAB_PAD){ if(_air){ if(d<bestAir){bestAir=d;hitAir=u;} } else if(d<bestGnd){bestGnd=d;hitGnd=u;} } }
  return hitAir||hitGnd;   // 공중 우선(겹치면 공중 먼저 잡혀 치우고 지상 잡기)
}
// 적 위 판정(트랙 좌표 → 픽셀). 가장 가까운 적 1마리
function hitEnemyPrecise(x,y){ let best=1e9,hit=null;
  for(const e of G.enemies){ const p=posAt(e.d,GW,GH); const d=Math.hypot(p.x-x*GW,p.y-y*GH); if(d<=10 && d<best){ best=d; hit=e; } } return hit; }   // 적 클릭 판정 24→10(아군 그랩보다 좁게)
// 드래그/박스 상태
let dragSet=[];      // 함께 이동 중인 유닛 배열(유닛 직접 끌기)
let lastP=null;      // 직전 포인터(델타 계산)
let box=null;        // 박스선택 {x0,y0,x1,y1}
let cmdMove=null;    // 이동 명령 목표 {x,y} — 선택 유닛들이 이쪽으로 걸어감
let _tpHold=null;   // 롱프레스 하차 감시: {pt(하차지점), ids(수송기), px/py(누른지점), aT(수송기별 도착 후 경과)}
const TP_ARRIVE_HOLD=0.3, TP_DROP_R=18;   // 도착·정지 후 계속 눌러야 하차하는 시간(초) / 도착 판정 반경(px)
const MOVE_MUL=3.0;  // 이동속도 배율(유닛 def.moveSpd × 이 값/초). 느리게/빠르게 조절
const AIR_ACCEL=5.0;   // 공중유닛 관성 가속(낮을수록 더 굼뜨고 반동 큼)
const AIR_ARRIVE=0.05; // 공중유닛 목표 근처 감속 시작 거리(정규화)
const GA_MAX=40, GA_MIN=10, GA_SLOPE=2.7;   // 지상 관성: 작은 유닛=GA_MAX(거의 즉시) → 큰 유닛=GA_MIN(약한 관성). SCALE 비례
let moved=false;
let _downTime=0;   // 포인터 다운 시각(빈-탭 빠름 판정용 — 하단 시트 닫기)
// ── 화면 줌/팬(두 손가락) — nemo·관리자 공용. zoom1·중심0.5=항등(기존 동작 유지) ──
const NEMO_MAXZOOM=3;
let _nptrs=new Map(), _nemoPinch=null, _fxPinch=null;   // _fxPinch: 이펙트 랩 두 손가락 줌(FXLAB.scale)
function viewApply(ctx,W,H){ const v=(typeof G!=='undefined')&&G.view; if(!v||(v.zoom===1&&v.x===0.5&&v.y===0.5)) return false;   // 기본 뷰=변환 생략(오버헤드·위험 0)
  ctx.save(); ctx.translate(W/2,H/2); ctx.scale(v.zoom,v.zoom); ctx.translate(-v.x*W,-v.y*H); return true; }
function viewRestore(ctx,applied){ if(applied) ctx.restore(); }
function nemoClampView(){ const v=G.viewT; if(!v) return; v.zoom=Math.max(1,Math.min(NEMO_MAXZOOM,v.zoom));
  if(v.zoom<=1.0001){ v.x=0.5; v.y=0.5; return; }
  const half=0.5/v.zoom; v.x=Math.max(half,Math.min(1-half,v.x)); v.y=Math.max(half,Math.min(1-half,v.y)); }
function nemoViewTick(dt){ const v=G.view, t=G.viewT; if(!v||!t) return; const k=Math.min(1,dt*9);   // 부드러운 줌/팬(직스 zoomCur식 보간)
  v.zoom+=(t.zoom-v.zoom)*k; v.x+=(t.x-v.x)*k; v.y+=(t.y-v.y)*k;
  if(Math.abs(v.zoom-t.zoom)<0.003 && Math.abs(v.x-t.x)<0.002 && Math.abs(v.y-t.y)<0.002){ v.zoom=t.zoom; v.x=t.x; v.y=t.y; } }
function _nptScreen(e){ const v=document.getElementById('vMain').getBoundingClientRect(); return {x:e.clientX-v.left, y:e.clientY-v.top}; }
function _nemoPinchStart(){ const p=[..._nptrs.values()]; box=null; drag=null; cmdMove=null; dragSet=[]; clearBox();   // 단일 제스처 취소
  const v=G.viewT||(G.viewT={x:0.5,y:0.5,zoom:1});
  _nemoPinch={ d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1, zoom:v.zoom, cx:(p[0].x+p[1].x)/2, cy:(p[0].y+p[1].y)/2, vx:v.x, vy:v.y }; }
function _nemoPinchMove(){ const p=[..._nptrs.values()]; if(p.length<2||!_nemoPinch) return; const v=G.viewT, r=document.getElementById('vMain').getBoundingClientRect();
  const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y), z=Math.max(1,Math.min(NEMO_MAXZOOM,_nemoPinch.zoom*d/_nemoPinch.d)); v.zoom=z;
  const cx=(p[0].x+p[1].x)/2, cy=(p[0].y+p[1].y)/2, dcx=(cx-_nemoPinch.cx)/(r.width||1), dcy=(cy-_nemoPinch.cy)/(r.height||1);
  v.x=_nemoPinch.vx-dcx/z; v.y=_nemoPinch.vy-dcy/z; nemoClampView(); }
function onDown(e){ if(G.strike){ strikeOnDown(e); return; } if((G.tab!=='Main'&&G.tab!=='Battle')||G.phase!=='playing'||G.bossOpen) return;
  _nptrs.set(e.pointerId, _nptScreen(e));
  if(_nptrs.size>=2){ _nemoPinchStart(); if(e.cancelable)e.preventDefault(); return; }   // 두 손가락 = 줌/팬(단일 제스처 취소)
  const p=evPos(e); moved=false; _downTime=(e&&e.timeStamp)||0;
  if(G.bossPickArm){   // 보스 지정 파견: 유닛 클릭 → 그 유닛 1기 파견 후 모드 해제(한 번 누름=한 기)
    const up=hitUnitPrecise(p.x,p.y);
    if(up && !up.fixed) deployUnitToBoss(up);
    G.bossPickArm=false; updateBossPickBtn(); e.preventDefault(); return; }
  if(G.skillArm && G.sel.length>0){   // 🪄 지정형 스킬: 지점(스톰) 또는 아군(치유) 클릭 시전
    const _sk=SKILLS[G.skillArm.key];
    if(_sk && _sk.kind==='target_enemy'){ const foe=(typeof _sbFoeAt==='function')?_sbFoeAt(p.x,p.y):null;
      if(foe) fireSkillEnemy(G.skillArm.uid, G.skillArm.key, foe); G.skillArm=null;
      refreshSelCard(); if(e.cancelable)e.preventDefault(); return; }
    if(_sk && _sk.kind==='target_unit'){ const tu=(typeof hitUnitPrecise==='function')?hitUnitPrecise(p.x,p.y):null;
      if(tu && !tu.fixed) fireSkillUnit(G.skillArm.uid, G.skillArm.key, tu.uid); G.skillArm=null;
      refreshSelCard(); if(e.cancelable)e.preventDefault(); return; }
    const cl=(typeof clampInner==='function')?clampInner(p.x,p.y):{x:p.x,y:p.y};
    fireSkillGround(G.skillArm.uid, G.skillArm.key, cl.x, cl.y); G.skillArm=null;
    refreshSelCard(); if(e.cancelable)e.preventDefault(); return; }
  if(G.focusArm && G.sel.length>0){   // 지정공격: 적 클릭 → 그 적 집중 공격
    const en0=hitEnemyPrecise(p.x,p.y);
    if(en0){ setFocusTarget(en0.eid); G.focusArm=false; updateCmdRow(); e.preventDefault(); return; }
    G.focusArm=false; }
  if(G.patrolArm && G.sel.length>0 && !hitUnitPrecise(p.x,p.y) && !hitEnemyPrecise(p.x,p.y)){   // 반복이동: 빈 곳 클릭 → 왕복 목표 지정
    setPatrolTarget(p.x,p.y); G.patrolArm=false; updateCmdRow(); e.preventDefault(); return; }
  G.patrolArm=false;
  if(G.unloadArm){ const _tu=G.units.find(x=>x.uid===G.sel[0]);   // 내리기: 빈 곳 클릭 → 그 지점으로 비행 후 도착 하차
    if(_tu && isTransport(_tu)){ const cl=clampInner(p.x,p.y); _tu._dropAt={x:cl.x,y:cl.y}; _tu.pickupQueue=null; _tu._rvBoard=null; _tu.cmd='hold'; _tu.patrol=null; if(typeof addChat==='function') addChat('','🛫 하차 지점으로 이동 후 한 마리씩 내립니다'); }
    G.unloadArm=false; updateTransportBtns(); e.preventDefault(); return; }
  if(G.boardArm){ box={x0:p.x,y0:p.y,x1:p.x,y1:p.y}; drag=null; dragSet=[]; cmdMove=null; e.preventDefault(); return; }   // 태우기: 드래그로 탑승 대상 지정(박스)
  const u=grabUnit(p.x,p.y);
  if(u && isTransport(u) && !G.sel.includes(u.uid)){   // 선택 유닛 지정 상태에서 수송기 탭 = 집결 탑승(중앙에서 만나 탑승)
    const _mem=G.sel.map(id=>G.units.find(x=>x.uid===id)).filter(m=>m&&canBoard(u,m)&&(m.team||null)===(u.team||null));
    if(_mem.length){ startRvBoard(u,_mem); box=null; drag=null; dragSet=[]; cmdMove=null; if(e.cancelable)e.preventDefault(); return; } }
  const grabSelf=u && G.sel.includes(u.uid);   // 잡은 게 이미 선택된 유닛(그룹 이동용)
  const multi=G.sel.length>1;                  // 다중 선택 상태
  if(u && multi && !grabSelf){ // 다중 선택 중 다른 유닛 위 클릭 → 그 유닛 무시하고 그 지점으로 이동
    cmdMove={x:p.x,y:p.y,issued:false}; assignFormation(p.x,p.y); box=null; drag=null; dragSet=[]; _tpHoldArm(p.x,p.y);
  } else if(u){ // 단일 선택(다른 유닛 클릭=재선택) 또는 그룹 내 유닛 잡기 → 선택 + 떼지 않고 드래그하면 이동
    if(!grabSelf) selectOne(u.uid);   // 이미 선택된 그룹의 한 명을 잡으면 그룹 전체 유지(다중 이동)
    drag=u.fixed?null:u; lastP=p; cmdMove=null; dragSet=[]; box=null;
  } else { const en=hitEnemyPrecise(p.x,p.y);
    if(en){ selectEnemy(en.eid); drag=null; dragSet=[]; box=null; cmdMove=null; }  // 적 직접 클릭 → 그 적 1마리 선택
    else if(G.sel.length>0){ // 아군 선택됨 + 빈 곳 → 이동 명령
      cmdMove={x:p.x,y:p.y,issued:false}; assignFormation(p.x,p.y); box=null; drag=null; dragSet=[]; _tpHoldArm(p.x,p.y);
    } else { // 선택 없음 + 빈 곳 → 박스 선택
      box={x0:p.x,y0:p.y,x1:p.x,y1:p.y}; drag=null; dragSet=[]; cmdMove=null;
    }
  }
  e.preventDefault();
}
function onMove(e){ if(G.strike){ strikeOnMove(e); return; } if(G.tab!=='Main'&&G.tab!=='Battle') return;
  if(_nptrs.has(e.pointerId)) _nptrs.set(e.pointerId, _nptScreen(e));
  if(_nemoPinch && _nptrs.size>=2){ _nemoPinchMove(); if(e.cancelable)e.preventDefault(); return; }   // 두 손가락 = 줌/팬
  if((drag||cmdMove||box) && e.cancelable) e.preventDefault();   // 활성 제스처면 즉시 팬 가로채기 차단(미세 이동에서도) → 모바일 슬라이드 이동 끊김 방지
  const p=evPos(e); moved=true;
  if(_tpHold){ const _hdx=(p.x-_tpHold.px)*GW, _hdy=(p.y-_tpHold.py)*GH; if(Math.hypot(_hdx,_hdy)>12) _tpHold=null; }   // 롱프레스 하차: 12px 이상 드래그하면 취소(=일반 이동)
  if(box){ box.x1=p.x; box.y1=p.y; drawBox(); return; }
  // 유닛을 누른 채 움직이면 → 직접 끌기 대신 '이동 명령' 시작(이동속도대로 따라옴)
  if(drag && !cmdMove){ if(lastP && Math.hypot((p.x-lastP.x)*GW,(p.y-lastP.y)*GH)<8) return;   // 미세 떨림 무시(탭=선택만)
    cmdMove={x:p.x,y:p.y,issued:false}; assignFormation(p.x,p.y); }
  if(cmdMove && !cmdMove.issued){ cmdMove.x=p.x; cmdMove.y=p.y; assignFormation(p.x,p.y); e.preventDefault(); return; } // 누른 채 목표 갱신
}
// 박스 시각화
function drawBox(){ let el=document.getElementById('selBox');
  if(!el){ el=document.createElement('div'); el.id='selBox'; document.getElementById('vMain').appendChild(el); }
  let x=Math.min(box.x0,box.x1),y=Math.min(box.y0,box.y1),w=Math.abs(box.x1-box.x0),h=Math.abs(box.y1-box.y0);
  const v=G.view; if(v&&v.zoom&&v.zoom!==1){ x=(x-v.x)*v.zoom+0.5; y=(y-v.y)*v.zoom+0.5; w*=v.zoom; h*=v.zoom; }   // 월드→화면(줌/팬)
  el.style.cssText='position:absolute;border:1px solid #46f06a;background:rgba(70,240,106,.14);pointer-events:none;z-index:15;'
    +'left:'+(x*100)+'%;top:'+(y*100)+'%;width:'+(w*100)+'%;height:'+(h*100)+'%';
}
function clearBox(){ const el=document.getElementById('selBox'); if(el) el.remove(); box=null; }
// 놓는 순간: 그 자리가 다른 유닛과 겹치면, 가장 가까운 '빈 자리'로 옮긴다(억지로 끼워넣기 방지).
let settling=null;
// (x,y)가 자기 외 모든 유닛과 안 겹치는지
// (x,y) 근처에서 가장 가까운 빈 자리를 나선형으로 탐색
function onUp(e){
  if(G.strike){ strikeOnUp(e); return; }
  _tpHold=null;   // 롱프레스 하차: 손 떼면 취소(도착 후 0.3초 유지 전에 떼면 하차 안 함)
  if(e) _nptrs.delete(e.pointerId);
  if(_nemoPinch){ if(_nptrs.size<2){ _nemoPinch=null; } box=null; drag=null; cmdMove=null; dragSet=[]; return; }   // 줌/팬 중이었으면 단일 제스처 마무리 생략
  if(cmdMove){ // 이동 명령: 손 떼도 목표 유지 → 도착까지 계속 이동(스타식). 클리어 안 함.
    cmdMove.issued=true; drag=null; dragSet=[]; lastP=null; return;
  }
  if(box){ // 박스 선택 종료
    const sx=box.x0, sy=box.y0;  // 드래그 시작점
    const x0=Math.min(box.x0,box.x1),y0=Math.min(box.y0,box.y1),x1=Math.max(box.x0,box.x1),y1=Math.max(box.y0,box.y1);
    clearBox();
    if(G.boardArm){ const _t=G.units.find(u=>u.uid===G.boardArm);   // 태우기: 박스 안(또는 탭한) 아군 탑승
      if(_t){ let _tg=(moved&&(x1-x0>0.01||y1-y0>0.01)) ? G.units.filter(u=>canBoard(_t,u)&&u.x>=x0&&u.x<=x1&&u.y>=y0&&u.y<=y1) : (function(){var o=grabUnit(sx,sy); return (o&&canBoard(_t,o))?[o]:[];})();
        _t.pickupQueue=(_t.pickupQueue||[]).concat(_tg); _t._dropAt=null; _t._rvBoard=null; if(typeof addChat==='function') addChat('','🛬 '+_tg.length+'기 호출 — 펠리컨이 한 마리씩 태우러 갑니다'); G.sel=[_t.uid]; refreshSelCard(); }
      G.boardArm=false; updateTransportBtns(); drag=null; dragSet=[]; lastP=null; return; }
    if(moved && (x1-x0>0.01||y1-y0>0.01)){
      const inBox=G.units.filter(u=>!(u.fixed||(!u.gid&&isBuilding(u.id)))&&!u.atBoss&&u.x>=x0&&u.x<=x1&&u.y>=y0&&u.y<=y1).map(u=>u.uid);  // 실제 구조물·토벌장 파견 제외
      if(inBox.length){ selectMany(inBox); }   // 아군이 1마리라도 있으면 아군 우선(적 무시)
      else { // 적만 있으면 → 시작점에서 가장 가까운 적 1마리만
        let best=Infinity, pick=null;
        for(const e of G.enemies){ const p=posAt(e.d,GW,GH), ex=p.x/GW, ey=p.y/GH;
          if(ex>=x0&&ex<=x1&&ey>=y0&&ey<=y1){ const dd=Math.hypot((ex-sx)*GW,(ey-sy)*GH); if(dd<best){best=dd;pick=e;} } }
        if(pick) selectEnemy(pick.eid); else deselectUnit();
      }
    } else { deselectUnit();   // 빈 곳 탭 = 선택 해제
      if(G.tab!=='Battle' && document.body.classList.contains('sheetOpen') && e && (e.timeStamp-_downTime)<400 && typeof closeSheet==='function') closeSheet();   // 빈 땅을 빠르게 탭했다 뗌 = 하단 시트 내려감. 단 전투실험 피커는 도구 팔레트라 유지(탭 재탭으로만 여닫음)
    }
    drag=null; dragSet=[]; lastP=null; return;
  }
  // 유닛 탭(이동 없음)은 선택만 유지. 직접 끌기 정착 로직 제거됨.
  drag=null; dragSet=[]; lastP=null;
}
// 대형 배치: 클릭 지점(cx,cy) 주변에 선택 유닛마다 '서로 다른 목표 칸'을 배정.
//  한 점에 다 모이지 않고 동심원으로 퍼져서 비비적임 방지.
function assignFormation(cx,cy){
  { const cl=clampInner(cx,cy); cx=cl.x; cy=cl.y; }   // 맵 밖 클릭은 경계 안으로 보정 → 닿지 못할 목표로 벽에 무한히 비비는 현상 방지
  const sel=G.sel.map(uid=>G.units.find(u=>u.uid===uid)).filter(Boolean).filter(u=>!u.fixed);
  if(!cmdMove) return; cmdMove.slots={};
  // 이동 목표는 '명령 당시 선택된 유닛'에만 부여(u.moveTo) → 선택을 바꿔도 기존 명령은 그 유닛이 끝까지 수행, 새 유닛은 새 명령 때만 이동
  for(const u of sel){ u.cmd='hold'; u.patrol=null; u.atkTarget=null; u.focusTarget=null; u._chasing=false; if(isTransport(u)){ u.pickupQueue=null; u._dropAt=null; u._rvBoard=null; } else if(u._rvBoard!=null){ const _rt=G.units.find(x=>x.uid===u._rvBoard); if(_rt&&_rt._rvBoard) _rt._rvBoard.ids=_rt._rvBoard.ids.filter(id=>id!==u.uid); u._rvBoard=null; } }   // 수동 이동 = 홀드(수송선=태우기/내리기/집결 취소, 멤버=집결 이탈)
  if(sel.length===1){ sel[0].moveTo={x:cx,y:cy}; cmdMove.slots[sel[0].uid]={x:cx,y:cy}; return; }
  // 평균 충돌 반경 기반 간격
  const r=(sel.reduce((a,u)=>a+collideR(u),0)/sel.length)*2.1;
  const slots=[{dx:0,dy:0}]; let ring=1;
  while(slots.length<sel.length){ const n=Math.floor(Math.PI*2*ring*0.9)||6;
    for(let k=0;k<n && slots.length<sel.length;k++){ const a=(k/n)*Math.PI*2 + ring*0.5;
      slots.push({dx:Math.cos(a)*ring*r, dy:Math.sin(a)*ring*r}); } ring++; }
  // 가까운 유닛에 가까운 칸 배정(간단히 순서대로)
  sel.forEach((u,i)=>{ const _air=(typeof FXLAB_AIR!=='undefined'&&FXLAB_AIR.has(u.gmodel||u.id));
    if(_air){ u.moveTo={x:cx,y:cy}; cmdMove.slots[u.uid]={x:cx,y:cy}; }   // 공중=한 지점 스택(스타식 겹치기)
    else { const s=slots[i]; const t=clampInner(cx+s.dx/GW, cy+s.dy/GH); u.moveTo={x:t.x,y:t.y}; cmdMove.slots[u.uid]={x:t.x,y:t.y}; } });   // 지상=대형 슬롯
}
// ── 펠리컨 수송(탑승/하차) — 탑승=G.units에서 빼고 모델 제거→cargo 보관 / 하차=좌표 주고 재추가 ──
const TRANSPORT_CAP={ pelican:8, overlord:8, seraph:8 };   // 수송 유닛별 정원(모델키 gmodel||id) — 유니온 펠리컨 / 스웜 제플린(overlord) / 에테리얼 세라프
function transportCap(u){ return (u&&TRANSPORT_CAP[u.gmodel||u.id])||0; }
function isTransport(u){ return transportCap(u)>0; }
function canBoard(t,u){ if(!t||!u||u===t||u.fixed||u.atBoss) return false; if(isTransport(u)) return false; if(typeof FXLAB_AIR!=='undefined' && FXLAB_AIR.has(u.gmodel||u.id)) return false; if(isBuilding(u.id)&&!u.gid) return false; return (t.cargo?t.cargo.length:0) < transportCap(t); }   // 공중유닛 탑승 불가(지상유닛만)
function boardUnit(t,u){ if(!canBoard(t,u)){ if((t.cargo?t.cargo.length:0)>=transportCap(t)) toast('⚠️ 수송 정원 가득'); return; }
  t.cargo=t.cargo||[]; u.moveTo=null; u.cmd=null; u.patrol=null; u.atkTarget=null; u.focusTarget=null; u._chasing=false; u.moving=false; u._mvStuck=0; u._mvPrevD=null;
  t.cargo.push(u);
  const i=G.units.indexOf(u); if(i>=0) G.units.splice(i,1);
  if(window.M3D && M3D.dropModels) M3D.dropModels([u.uid]);
  G.sel=(G.sel||[]).filter(id=>id!==u.uid);
  if(typeof playSfx==='function') playSfx('ui_confirm');
  renderUnits(); if(typeof updateHud==='function') updateHud(); if(typeof updateTransportBtns==='function') updateTransportBtns(); }
// 집결 탑승(rendezvous): 선택 유닛 지정 상태에서 수송기 탭 → 수송기·유닛 모두 중앙 지점으로 이동해 만나 탑승
function startRvBoard(t, members){ if(!t||!members||!members.length) return;
  const avail=Math.max(0, transportCap(t)-((t.cargo&&t.cargo.length)||0));   // 남은 정원
  const boarders=members.slice(0, avail), leftover=members.slice(avail);     // 태울 유닛 / 정원 초과로 못 탄 유닛
  if(!boarders.length){ if(typeof toast==='function') toast('⚠️ 수송 정원 가득'); return; }
  let cx=0, cy=0; boarders.forEach(m=>{ cx+=m.x; cy+=m.y; }); cx/=boarders.length; cy/=boarders.length;
  const mp=(typeof clampInner==='function')?clampInner((t.x+cx)/2,(t.y+cy)/2):{x:(t.x+cx)/2,y:(t.y+cy)/2};   // 수송기·(탈)유닛 중앙
  t._rvBoard={ ids: boarders.map(m=>m.uid), mx:mp.x, my:mp.y }; t.pickupQueue=null; t._dropAt=null; t.cmd=null;
  boarders.forEach(m=>{ m.moveTo={x:mp.x,y:mp.y}; m._rvBoard=t.uid; m.cmd=null; m.patrol=null; m.atkTarget=null; m.focusTarget=null; m._chasing=false; });
  t.moveTo={x:mp.x,y:mp.y};
  if(typeof addChat==='function') addChat('','🛬 '+boarders.length+'기 집결 탑승'+(leftover.length?(' · 잔여 '+leftover.length+'기(다른 수송기 지정)'):'')+' — 중앙에서 만나 탑승');
  if(typeof playSfx==='function') playSfx('ui_confirm');
  // 못 탄 유닛을 선택 유지 → 다른 수송기 바로 지정 / 전부 태웠으면 선택 해제
  if(leftover.length && typeof selectMany==='function') selectMany(leftover.map(m=>m.uid));
  else if(typeof deselectUnit==='function') deselectUnit();
  else { G.sel=(leftover.length?leftover.map(m=>m.uid):[]); if(typeof refreshSelCard==='function') refreshSelCard(); } }
// 롱프레스 하차: 화물 실은 수송기(들) 선택 후 목적지를 꾹 누른 채 유지 → 그 지점 이동·정지 후에도 계속(TP_ARRIVE_HOLD초 이상) 누르고 있으면 그때 하차. 도착 전/후 0.3초 전에 떼면 이동만.
function _tpHoldArm(x,y){ _tpHold=null; if(!(typeof G!=='undefined'&&G.sel&&G.sel.length)) return;
  const ids=G.sel.filter(id=>{ const u=G.units.find(v=>v.uid===id); return u&&isTransport(u)&&u.cargo&&u.cargo.length; });
  if(!ids.length) return;   // 화물 실은 선택 수송기 없으면 감시 안 함(일반 이동만)
  const cl=(typeof clampInner==='function')?clampInner(x,y):{x:x,y:y};
  _tpHold={ pt:cl, ids:ids, px:x, py:y, aT:{} }; }
function _tpHoldTick(dt){ if(!_tpHold||typeof G==='undefined'||!G.units) return;
  const pt=_tpHold.pt;
  for(let i=_tpHold.ids.length-1;i>=0;i--){ const uid=_tpHold.ids[i], t=G.units.find(v=>v.uid===uid);
    if(!t||!isTransport(t)||!(t.cargo&&t.cargo.length)){ _tpHold.ids.splice(i,1); delete _tpHold.aT[uid]; continue; }
    const arrived = Math.hypot((t.x-pt.x)*(GW||390),(t.y-pt.y)*(GH||600)) <= TP_DROP_R && !t.moveTo;   // 지점 도착·정지
    if(arrived){ _tpHold.aT[uid]=(_tpHold.aT[uid]||0)+dt;
      if(_tpHold.aT[uid]>=TP_ARRIVE_HOLD){   // 도착 후 계속 0.3초 유지 → 하차
        t._dropAt={x:pt.x,y:pt.y}; t._dropT=0; t.pickupQueue=null; t._rvBoard=null; t.cmd='hold'; t.patrol=null;
        _tpHold.ids.splice(i,1); delete _tpHold.aT[uid];
        if(typeof playSfx==='function') playSfx('ui_confirm');
        if(typeof navigator!=='undefined' && navigator.vibrate){ try{ navigator.vibrate(20); }catch(_e){} }
        if(typeof addChat==='function') addChat('','🛫 수송기 도착 — 하차'); } }
    else _tpHold.aT[uid]=0;   // 미도착/이동중 → 리셋(도착 후 연속 유지만 인정)
  }
  if(!_tpHold.ids.length) _tpHold=null; }
// 수송선 자동 운항: 태우기=유닛 머리 위로 한 마리씩 가서 탑승 / 내리기=지점 도착 후 한 마리씩 방출
const PICK_R=22, DROP_R=16, DROP_GAP=0.07;
function dropOne(t,pt){ if(!t.cargo||!t.cargo.length) return; const u=t.cargo.shift();
  const k=t._dropN=(t._dropN||0)+1, ring=1+Math.floor(k/8), a=(k%8)/8*6.283+ring*0.6, rad=ring*collideR(u)*2.2;
  const c=clampInner(pt.x+Math.cos(a)*rad/GW, pt.y+Math.sin(a)*rad/GH);
  u.x=c.x; u.y=c.y; u.moveTo=null; u.moving=false; u.cmd=null; u._mvStuck=0; u._mvPrevD=null; G.units.push(u);
  if(!t.cargo.length) t._dropN=0; renderUnits(); if(typeof updateHud==='function') updateHud(); if(typeof updateTransportBtns==='function') updateTransportBtns(); }
function stepTransports(dt){ if(!GW||!GH) return;
  for(const t of G.units){ if(!isTransport(t)) continue;
    if(t._rvBoard){   // 집결 탑승: 수송기·유닛 모두 중앙으로 → 근접 시 탑승
      const R=t._rvBoard; R.ids=R.ids.filter(uid=>!!G.units.find(x=>x.uid===uid));   // 탑승/사망분 제거(boardUnit이 G.units에서 뺌)
      if(!R.ids.length || (t.cargo&&t.cargo.length>=transportCap(t))){ t._rvBoard=null; t.moveTo=null; continue; }
      t.moveTo={x:R.mx,y:R.my};
      for(const uid of R.ids.slice()){ const u=G.units.find(x=>x.uid===uid); if(!u) continue;
        if(Math.hypot((u.x-t.x)*GW,(u.y-t.y)*GH)<=PICK_R){ boardUnit(t,u); }
        else if(u._rvBoard===t.uid && !u.moveTo){ u.moveTo={x:R.mx,y:R.my}; } }
      continue; }
    if(t.pickupQueue && t.pickupQueue.length){   // 태우기: 큐의 유닛에게 차례로 비행 → 머리 위 도달 시 탑승
      let tgt=null; while(t.pickupQueue.length){ const u=t.pickupQueue[0]; if(G.units.indexOf(u)<0){ t.pickupQueue.shift(); continue; } tgt=u; break; }
      if(!tgt || (t.cargo&&t.cargo.length>=transportCap(t))){ t.pickupQueue=null; t.moveTo=null; continue; }
      if(Math.hypot((tgt.x-t.x)*GW,(tgt.y-t.y)*GH)<=PICK_R){ boardUnit(t,tgt); t.pickupQueue.shift(); if(t.pickupQueue&&!t.pickupQueue.length){ t.pickupQueue=null; t.moveTo=null; } }
      else t.moveTo={x:tgt.x,y:tgt.y};
      continue; }
    if(t._dropAt){   // 내리기: 지점 도착 후 한 마리씩 빠르게 방출
      if(Math.hypot((t._dropAt.x-t.x)*GW,(t._dropAt.y-t.y)*GH)<=DROP_R){ t.moveTo=null; t._dropT=(t._dropT||0)-dt;
        if(t._dropT<=0){ if(t.cargo&&t.cargo.length){ dropOne(t,t._dropAt); t._dropT=DROP_GAP; } else { t._dropAt=null; t._dropT=0; } } }
      else t.moveTo={x:t._dropAt.x,y:t._dropAt.y}; }
  } }
// 비행체 엔진 분사(이동 중) — 기체 뒤쪽에서 청백 추진염
const ENG_COL={ skydancer_t:['#2e7bff','#74a8ff'] };   // 비행체 엔진 분사색(기본=청백, 스카이댄서=파랑)
function emitEngineExhaust(u, x, y, mx, my, dt){
  u._engT=(u._engT||0)-dt; if(u._engT>0) return; u._engT=0.035;
  const ec=ENG_COL[u.gid]||['#9fd6ff','#e8f6ff'];
  for(let q=0;q<2;q++){ const j=(Math.random()-0.5)*6;
    G.sparks.push({x:x-mx*11-my*j, y:y-my*11+mx*j,
      vx:-mx*130+(Math.random()-0.5)*34, vy:-my*130+(Math.random()-0.5)*34,
      life:0.2+Math.random()*0.1, flash:true, color:q?ec[0]:ec[1]}); }
}
// ─── 공용 유닛 이동 물리(단일 출처) — 관성·유닛 회피·목표 감속·정착·이동방향 응시. 메인·건설 등 모든 구역이 이 함수를 그대로 호출 ───
// u에 x,y,vx,vy,face,moving,_mvStuck,_mvPrevD를 직접 갱신. tgt={x,y}. sizeKey=스탯/크기 키(U[]), airKey=공중판정·모델스케일 키.
// o:{ GW,GH, clamp(x,y)->{x,y}, staticN:[{ref,x,y,sizeKey,airKey}](회피할 정지 유닛), transport, extraSteer(dirx,diry)->{sx,sy}|null(건물 회피 등) }
// 반환: {done:true} 도착·정착 / {done:false,mx,my,air} 이동 중
function stepUnitMove(u, tgt, sizeKey, airKey, dt, o){
  const def=U[sizeKey]||{};
  const AY=o.ay||1;   // ay = 화면 세로/가로 비율. 정규화 좌표계가 정사각이 아닐 때(건설지) 세로가 더 빨라지는 것을 막는다.
  let dx=tgt.x-u.x, dy=(tgt.y-u.y)*AY; const d=Math.hypot(dx,dy);
  const _air=(typeof FXLAB_AIR!=='undefined' && FXLAB_AIR.has(airKey));   // 공중유닛 = 관성 이동
  if(d<=0.012){ u.vx=0; u.vy=0; u._mvStuck=0; u._mvPrevD=null; return {done:true}; }   // 도착
  if(u._mvPrevD!=null && d > u._mvPrevD-0.0006) u._mvStuck=(u._mvStuck||0)+dt; else u._mvStuck=0;   // 혼잡·클램프로 못 가까워지면 정착(공중은 더 관대)
  u._mvPrevD=d;
  if(!o.noStuck && u._mvStuck>(_air?1.6:0.6)){ u.vx=0; u.vy=0; u._mvStuck=0; u._mvPrevD=null; return {done:true}; }   // noStuck=추적 목표(직스): 가까워지지 않아도 포기하지 않는다
  let dirx=dx/d, diry=dy/d, sx=0, sy=0;
  if(!o.transport && o.staticN) for(const n of o.staticN){ if(n.ref===u) continue;   // 정지 유닛 회피(같은 레이어만 — 지상↔공중은 통과)
    if((typeof FXLAB_AIR!=='undefined' && FXLAB_AIR.has(n.airKey))!==_air) continue;
    const ox=(n.x-u.x)*o.GW, oy=(n.y-u.y)*o.GH, od=Math.hypot(ox,oy);
    const avoidR=((((U[sizeKey]||{}).size)||14)*0.62 + (((U[n.sizeKey]||{}).size)||14)*0.62)*2.4*(o.avoidMul!=null?o.avoidMul:1);   // avoidMul=회피 반경 배율(건설 맵은 축소 → 한 점으로 촘촘히 모임)
    if(od>0.01 && od<avoidR){ const w=1-od/avoidR, _rm=(o.radialMul!=null?o.radialMul:1); sx-=(ox/od)*w*_rm; sy-=(oy/od)*w*_rm;   // 밀어내기(radialMul<1 = 겹침 방지는 분리 단계에 맡기고 약하게)
      if((ox/od)*dirx+(oy/od)*diry>0.25){ const tx=-diry, ty=dirx, side=(tx*ox+ty*oy)>=0?-1:1; sx+=tx*side*w*1.6; sy+=ty*side*w*1.6; } }   // 전방 장애물 → 접선으로 비킴
  }
  if(o.steerMax!=null){ const sl=Math.hypot(sx,sy);   // 회피력 상한 — 전진 성분(크기 1)을 절대 뒤집지 못하게 해서 앞뒤로 튕기는 극한주기를 없앤다
    if(sl>o.steerMax){ const k2=o.steerMax/sl; sx*=k2; sy*=k2; } }
  if(o.extraSteer){ const es=o.extraSteer(dirx,diry); if(es){ sx+=es.sx; sy+=es.sy; } }   // 건설: 건물 회피(공중은 아래 mx=dirx로 자동 무시 → 위로 비행)
  let mx, my;
  if(_air && !o.airAvoid){ mx=dirx; my=diry; } else { mx=dirx+sx; my=diry+sy; const ml=Math.hypot(mx,my)||1; mx/=ml; my/=ml; }   // 지상=회피 반영 / 공중=목표 직선(airAvoid=공중도 서로 비켜서 표적을 감싼다)
  const maxSpd=(def.moveSpd||0.13)*MOVE_MUL*(u._skSpdMul||1)*(o.spdMul||1); let dvx=mx*maxSpd, dvy=my*maxSpd;   // 🪄 스킬 배율(스팀팩 1.4× · 인스네어 0.5×) — 미설정=1
  if(d<AIR_ARRIVE && !o.noSlow){ const _f=d/AIR_ARRIVE; dvx*=_f; dvy*=_f; }   // 목표 근처 감속(안착) — noSlow=중간 경유점(감속 없이 모퉁이 통과)
  const _sz=(window.M3D&&M3D.scaleOf)?M3D.scaleOf(airKey):13;
  const _acc=_air?AIR_ACCEL:Math.max(GA_MIN, GA_MAX-(_sz-11)*GA_SLOPE);   // 공중=강한 관성 / 지상=크기 클수록 관성↑
  const _k=Math.min(1, _acc*dt); u.vx=(u.vx||0)+(dvx-(u.vx||0))*_k; u.vy=(u.vy||0)+(dvy-(u.vy||0))*_k;
  const cl=o.clamp(u.x+u.vx*dt, u.y+u.vy*dt/AY); u.x=cl.x; u.y=cl.y; u.moving=true;   // 속도는 화면 기준 → y만 좌표계로 환산
  if(def.model3d){ const _spd=Math.hypot(u.vx,u.vy);
    if(_spd>0.0004 || u.face==null || !o.faceHold){ const _tf=(_spd>0.0004)?Math.atan2(u.vx,u.vy):Math.atan2(mx,my);
      if(o.faceRate!=null && u.face!=null){ let _dA=((_tf-u.face+Math.PI*3)%(Math.PI*2))-Math.PI, _lim=o.faceRate*dt;   // 회전 속도 제한(rad/s) — 방향이 흔들려도 모델은 부드럽게
        if(_dA>_lim) _dA=_lim; else if(_dA<-_lim) _dA=-_lim; u.face=_tf-(((_tf-(u.face+_dA))+Math.PI*3)%(Math.PI*2)-Math.PI); }
      else u.face=Math.round(_tf/(Math.PI/8))*(Math.PI/8); } }   // 이동방향 응시(π/8 스냅) · faceHold=거의 멈췄으면 방향 유지
  return {done:false, mx, my, air:_air};
}
// 이동 명령: 각 유닛이 자기 대형 칸으로 걸어감. 물리는 공용 stepUnitMove.
function stepCmdMove(dt){
  for(const u of G.units) u.moving=false;   // 매 프레임 초기화(멈춘 유닛은 공격 가능)
  const movers=G.units.filter(u=>u.moveTo&&!u.fixed&&!u.atBoss);   // 이동 명령이 살아있는 유닛만
  if(!movers.length){ if(cmdMove&&cmdMove.issued) cmdMove=null; return; }
  const moverSet=new Set(movers.map(u=>u.uid));   // 이동 중 유닛끼리는 회피 제외(대형 유지)
  const staticN=[]; for(const o2 of G.units){ if(moverSet.has(o2.uid)) continue; staticN.push({ref:o2, x:o2.x, y:o2.y, sizeKey:o2.id, airKey:o2.gmodel||o2.id}); }
  let moving=false;
  for(const u of movers){
    const r=stepUnitMove(u, u.moveTo, u.id, u.gmodel||u.id, dt, { GW, GH, clamp:clampInner, staticN, transport:isTransport(u) });
    if(r.done){ u.moveTo=null; continue; }   // 도착·정착 → 명령 종료
    moving=true;
    if(AIR_FLOAT_GIDS[u.gid]) emitEngineExhaust(u, u.x*GW, u.y*GH-16, r.mx, r.my, dt);   // 비행체: 엔진 분사
  }
  if(!moving && cmdMove&&cmdMove.issued) cmdMove=null; // 전원 도착 → 제스처 상태 종료. (renderUnits는 메인 루프가 매 프레임 호출 — 여기서 중복 호출하면 배속×유닛수만큼 낭비)
}
const vm=document.getElementById('vMain');
// 포인터 이벤트 + 포인터 캡처(마우스·터치 통합):
// 유닛을 처음 지정하는 순간 하단 패널 DOM이 default→unit으로 바뀌는데, 모바일에선 이 변화가
// 진행 중인 터치를 취소시켜 이후 move가 끊겼다(=새로 지정한 유닛이 슬라이드를 따라오지 못함).
// pointerdown 때 vMain이 포인터를 '캡처'하면 손가락 밑 DOM이 바뀌어도 move/up을 끝까지 받는다.
vm.addEventListener('pointerdown', function(e){ try{ vm.setPointerCapture(e.pointerId); }catch(_){ } onDown(e); });
vm.addEventListener('pointermove', onMove);
vm.addEventListener('pointerup', function(e){ onUp(e); try{ vm.releasePointerCapture(e.pointerId); }catch(_){ } });
vm.addEventListener('pointercancel', function(e){ onUp(e); });
vm.addEventListener('wheel', function(e){ if(G.strike){ strikeWheel(e); return; }   // 🖱 휠 줌 — 직스 전장 / 네모 전장(커서 위치 기준, 모바일 핀치 대체)
  if(!G.viewT||!G.view) return; if(e.cancelable) e.preventDefault();
  const r=vm.getBoundingClientRect(), sx=(e.clientX-r.left)/(r.width||1), sy=(e.clientY-r.top)/(r.height||1), t=G.viewT;
  const wx=t.x+(sx-0.5)/t.zoom, wy=t.y+(sy-0.5)/t.zoom;
  t.zoom=Math.max(1,Math.min((typeof NEMO_MAXZOOM!=='undefined'?NEMO_MAXZOOM:3), t.zoom*(e.deltaY>0?0.9:1.1)));
  t.x=wx-(sx-0.5)/t.zoom; t.y=wy-(sy-0.5)/t.zoom;
  if(typeof nemoClampView==='function') nemoClampView(); }, {passive:false});
{ const vb=document.getElementById('vBuild');   // 🖱 건설 화면: 휠 = 줌 / 가운데 버튼·Shift+드래그 = 화면 이동(모바일 두 손가락 대체)
  if(vb){ vb.addEventListener('wheel', function(e){ if(typeof techWheel==='function') techWheel(e); }, {passive:false});
    vb.addEventListener('auxclick', function(e){ if(e.button===1) e.preventDefault(); });
    vb.addEventListener('mousedown', function(e){ if(e.button===1) e.preventDefault(); }); } }

// ── 유닛뽑기: 꾹 누르기(홈화면 유닛이동과 동일) — 누른 지점으로 시민 계속 이동. 유닛 위면 패드↔중앙 왕복 반복구매 ──
function unitHoldPos(e){ const v=document.getElementById('vUnit').getBoundingClientRect();
  const t=e.changedTouches?e.changedTouches[0]:(e.touches?e.touches[0]:e);
  return {x:Math.max(.04,Math.min(.96,(t.clientX-v.left)/v.width)), y:Math.max(.04,Math.min(.96,(t.clientY-v.top)/v.height))}; }
// 유닛뽑기: 비콘/유닛 프로필을 하단에 표시(메인 단일카드와 동일). 표시 전용(G.shopSel과 별개)
function showShopProfile(id){ const def=U[id]; if(!def) return;
  document.getElementById('prodHint').style.display='none';
  const card=document.getElementById('shopProfile'); card.style.display='flex';   // 프로필=상단, 생산고 안내는 그대로 아래에 유지
  document.getElementById('bpUnit').classList.add('profOn');   // 프로필 표시 → 생산고 안내 카드 컴팩트
  document.getElementById('spPortrait').innerHTML=unitPortraitHTML(id);
  document.getElementById('spName').textContent=def.name;
  document.getElementById('spType').textContent='';   // 타입 라인 제거(직업은 초상화 하단 배지로)
  const pseudo={id:id};   // 인스턴스 없는 신규 유닛 → 풀스탯 표시
  document.getElementById('spHp').innerHTML=scHpHTML(pseudo);
  document.getElementById('spStats').innerHTML=scStatBoxesHTML(pseudo); fitStatNumbers();
  document.querySelectorAll('#vUnit .shopUnit').forEach(el=>el.classList.toggle('sel', SHOP_UNITS[+el.dataset.idx]===id));
}
function clearShopProfile(){
  const card=document.getElementById('shopProfile'); if(card) card.style.display='none';   // 안내(opsManual)는 항상 표시 — 따로 토글 안 함
  const bpu=document.getElementById('bpUnit'); if(bpu) bpu.classList.remove('profOn');   // 프로필 없음 → 생산고 안내 카드 확장
  const ph=document.getElementById('prodHint'); if(ph) ph.style.display='none';
  document.querySelectorAll('#vUnit .shopUnit.sel').forEach(el=>el.classList.remove('sel'));
}
// 시민 선택/드래그 시 하단에 시민 프로필 표시(가챠 안내 바 대신)
function showCitizenProfile(){ const card=document.getElementById('shopProfile'); if(!card) return;
  const ph=document.getElementById('prodHint'); if(ph) ph.style.display='none';
  card.style.display='flex';   // 프로필=상단, 생산고 안내는 아래에 유지
  document.getElementById('bpUnit').classList.add('profOn');   // 프로필 표시 → 생산고 안내 카드 컴팩트
  document.getElementById('spPortrait').innerHTML=unitPortraitHTML('citizen');
  document.getElementById('spName').textContent='시민';
  document.getElementById('spType').textContent='유닛 생산 일꾼';
  document.getElementById('spHp').innerHTML='<div class="czDesc">뽑기 비콘으로 이동해 <b>랜덤 유닛</b>을 뽑습니다 <span class="czCost">◎'+mapCfg('gachaCost',GACHA_COST)+'</span></div>';
  document.getElementById('spStats').innerHTML='';
}
// 우상단 취소키 표시 갱신(메인=아군/적 / 유닛뽑기=시민 선택 여부)
function updateDeselTop(){ const d=document.getElementById('deselTop'); if(!d) return;
  if(G.bossOpen){ d.classList.toggle('on', !!G.bossDeployPick || !!G.bossBldSel || (typeof _baSel!=='undefined' && _baSel.length>0)); return; }   // 토벌장: 메인과 동일한 취소 버튼 재사용
  if(G.tab==='Unit') d.classList.remove('on');   // 유닛뽑기: 시민 선택해도 취소 버튼 표시 안 함
  else if(G.tab==='Upgrade') d.classList.toggle('on', !!G.techB);
  else d.classList.toggle('on', G.sel.length>0 || G.selEnemy!=null); }   // 메인/플레이어 공통
// 유닛뽑기 선택: 'citizen'(시민) | 유닛 id(비콘 유닛=정보) | null(무선택)
function selectShop(sel){ G.shopSel=sel;
  if(sel==='citizen'){ showCitizenProfile(); }    // 시민 선택/드래그: 하단에 시민 프로필
  else if(sel){ showShopProfile(sel); }           // 비콘 유닛 선택: 그 유닛 정보(이동 X)
  // 하이라이트: 시민 or 비콘
  document.querySelectorAll('#vUnit .shopUnit').forEach(el=>el.classList.toggle('sel', SHOP_UNITS[+el.dataset.idx]===sel));
  const c=document.getElementById('citizenEl'); if(c) c.classList.toggle('selc', sel==='citizen');
  updateDeselTop();
}
function clearShopSel(){ G.shopSel=null; uHold=null;
  const cz=G.citizen; if(cz){ cz.gx=null; cz.gy=null; cz.buyId=null; }   // 시민 이동 중단
  clearShopProfile();
  document.querySelectorAll('#vUnit .shopUnit.sel').forEach(el=>el.classList.remove('sel'));
  const c=document.getElementById('citizenEl'); if(c) c.classList.remove('selc');
  updateDeselTop();
}
// 취소키 클릭 → 탭별 선택 해제
function cancelSelect(){ if(G.bossOpen){ if(G.bossDeployPick){ bossDeployCancel(); return; } if(typeof bossDeselect==='function') bossDeselect(); return; }   // 토벌장: 파견 선택 모드=취소 / 그 외=아레나 유닛 선택 해제
  if(G.tab==='Unit'){ clearShopSel(); return; }
  if(G.tab==='Upgrade') return;
  if(G.tab==='Players'){ if(typeof clearPlayerSel==='function') clearPlayerSel(); return; }
  deselectUnit(); }
// 시민 이동 명령(빈 곳 클릭/드래그 → 그 지점으로, 유닛 위 지나가면 구매). 손 떼도 목표 유지(메인 이동명령식)
function moveCitizenCmd(p){ uHold=p; const c=G.citizen; if(c){ c.gx=p.x; c.gy=p.y; const _hb=beaconUnder(p.x,p.y,0.11); c.buyId=_hb?_hb.id:null; } }
function drawShopBox(b){ let el=document.getElementById('shopBox');
  if(!el){ el=document.createElement('div'); el.id='shopBox'; document.getElementById('vUnit').appendChild(el); }
  const x=Math.min(b.x0,b.x1),y=Math.min(b.y0,b.y1),w=Math.abs(b.x1-b.x0),h=Math.abs(b.y1-b.y0);
  el.style.cssText='position:absolute;border:1px solid #46f06a;background:rgba(70,240,106,.14);pointer-events:none;z-index:15;'
    +'left:'+(x*100)+'%;top:'+(y*100)+'%;width:'+(w*100)+'%;height:'+(h*100)+'%'; }
function clearShopBox(){ const el=document.getElementById('shopBox'); if(el) el.remove(); }
// 유닛뽑기 입력 = 메인 체계: 진입 무선택. 시민 클릭=시민 선택 / 비콘 클릭=그 유닛 선택(정보) / 시민 선택+빈곳=이동(구매) / 빈곳 드래그=박스 / 빈곳 탭=해제
let _shopStart=null, _shopMoved=false, _shopBox=null, _shopGrab=false;
// 유닛 정보 클릭 판정 — 작은 반경(유닛 아이콘 부근만). 비콘 가장자리 클릭은 '빈 곳'으로 → 시민 이동 가능
function onUnitDown(e){ if(G.tab!=='Unit') return;
  if(G.sandbox){   // 이펙트 랩: 시민 셀렉터 비활성. 두 손가락 = 맵 줌(FXLAB.scale) 직접 확대/축소
    _nptrs.set(e.pointerId, _nptScreen(e));
    if(_nptrs.size>=2){ const p=[..._nptrs.values()]; _fxPinch={ d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1, scale:FXLAB.scale||1 }; if(e.cancelable)e.preventDefault(); }
    return; }
  if(e.cancelable) e.preventDefault();
  const p=unitHoldPos(e); _shopStart=p; _shopMoved=false; _shopBox=null; _shopGrab=false;
  const c=G.citizen, onCit = c && Math.hypot((p.x-c.x)*GW,(p.y-c.y)*GH) < Math.min(GW,GH)*0.055;
  if(onCit){ selectShop('citizen'); _shopGrab=true; }         // 시민 짚기 → 선택 + 떼지 않고 스와이프하면 즉시 이동
  else if(G.shopSel==='citizen'){ moveCitizenCmd(p); }      // 시민 선택됨 + 빈곳/비콘 → 시민 이동(비콘이면 구매). 비콘 유닛은 클릭 안됨(정보는 i 버튼)
  else { _shopBox={x0:p.x,y0:p.y,x1:p.x,y1:p.y}; drawShopBox(_shopBox); }  // 무선택 + 빈곳 → 박스
  updateDeselTop();
}
function onUnitMove(e){ if(G.tab!=='Unit') return;
  if(G.sandbox){   // 이펙트 랩: 두 손가락 핀치 → FXLAB.scale(맵/줌) 갱신
    if(_nptrs.has(e.pointerId)) _nptrs.set(e.pointerId, _nptScreen(e));
    if(_fxPinch && _nptrs.size>=2){ const p=[..._nptrs.values()]; const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
      const z=Math.max(0.45, Math.min(2.4, _fxPinch.scale*d/_fxPinch.d)); if(typeof fxLabSetScale==='function') fxLabSetScale(z); if(e.cancelable)e.preventDefault(); }
    return; }
  if(e.cancelable) e.preventDefault();
  const p=unitHoldPos(e);
  if(_shopStart && Math.hypot(p.x-_shopStart.x,p.y-_shopStart.y)>0.012) _shopMoved=true;
  if(_shopBox){ _shopBox.x1=p.x; _shopBox.y1=p.y; drawShopBox(_shopBox); return; }
  // 시민을 짚은 채(또는 선택된 시민) 움직이면 즉시 따라 이동(메인 유닛과 동일)
  if(G.shopSel==='citizen' && (_shopGrab||uHold) && _shopMoved) moveCitizenCmd(p);
}
function onUnitUp(e){
  if(G.sandbox){ if(e) _nptrs.delete(e.pointerId); if(_nptrs.size<2) _fxPinch=null; return; }   // 이펙트 랩: 시민 셀렉터 비활성 / 핀치 종료
  if(_shopBox){ const b=_shopBox; clearShopBox(); _shopBox=null;
    const c=G.citizen, x0=Math.min(b.x0,b.x1),x1=Math.max(b.x0,b.x1),y0=Math.min(b.y0,b.y1),y1=Math.max(b.y0,b.y1);
    if(_shopMoved && c && c.x>=x0&&c.x<=x1&&c.y>=y0&&c.y<=y1) selectShop('citizen');  // 드래그 박스에 시민 들어오면 선택
    else clearShopSel();   // 빈 곳 탭/빈 박스 = 해제
    _shopStart=null; uHold=null; _shopGrab=false; return; }
  uHold=null; _shopStart=null; _shopGrab=false;   // 시민은 목표(c.gx)까지 계속 이동 후 정지
}
const vu=document.getElementById('vUnit');
// 포인터 캡처(마우스·터치 통합): 시민을 짚는 순간 vUnit이 포인터를 잡아 손가락 밑 DOM이 바뀌어도 끝까지 추적 → 짚고 스와이프 즉시 이동
vu.addEventListener('pointerdown', function(e){ try{ vu.setPointerCapture(e.pointerId); }catch(_){ } onUnitDown(e); });
vu.addEventListener('pointermove', onUnitMove);
vu.addEventListener('pointerup', function(e){ onUnitUp(e); try{ vu.releasePointerCapture(e.pointerId); }catch(_){ } });
vu.addEventListener('pointercancel', function(e){ onUnitUp(e); });

// ── 플레이어(관전) 탭: 전장 유닛 클릭=그 유닛 1마리 정보(적군처럼 단일). 드래그=박스 안 최근접 1마리. 이동 명령 없음(내 유닛 아님) ──
function evPosIn(viewId,e){ const v=document.getElementById(viewId).getBoundingClientRect();
  const t=e.changedTouches?e.changedTouches[0]:(e.touches?e.touches[0]:e);
  return {x:(t.clientX-v.left)/v.width, y:(t.clientY-v.top)/v.height}; }
// 관전 유닛 프로필 = 메인 단일 프로필과 동일 커맨드 그리드(읽기전용: 스킬 카드 비활성 → 남의 유닛 시전 방지)
function _specUnitModel(u){ const def=U[u.id]||{};
  const cards=(typeof _mainSkillCards==='function')?_mainSkillCards([u]).map(function(it){ return Object.assign({}, it, {act:'', state:'dim'}); }):[];
  return { mode:'prod', compact:true, build:true, title:gNameStar(u,def)+(u.hero?' [영웅]':''), icon:_mainPort(u), hpsh:_mainHpsh(u),
    sub:pIco('👁','sm')+' '+((typeof playerName==='function')?playerName(G.curPlayer):('P'+G.curPlayer))+' 관전', items:cards,
    info:{ eb:'', hideName:true, stats:_mainUnitStatList(u) } }; }
function renderSpecProfile(u){ const host=document.getElementById('playerProfile'); if(!host||!host.classList.contains('on')) return;
  host.classList.add('simple');   // 다른 하단 시트와 동일 규격(간소화 4그리드 1줄) — 빠져 있어 폐지된 2줄 기본값으로 떨어지고 있었다
  const rb=(typeof specRemoteBoard==='function')&&specRemoteBoard();   // 관전=상대 공격 업글 레벨로 스탯 계산
  const _sv=(rb && G.coopUpg && G.coopUpg[rb]) ? G.atkLv : undefined; if(_sv!==undefined) G.atkLv=G.coopUpg[rb];
  try{ const sig='spec|'+u.uid+'|'+Math.round(u.hp||0)+'|'+Math.round(u.sh||0)+'|'+(host._cgPage||0);   // HP/실드 변하면만 재빌드(라이브 갱신)
    if(host._gSig!==sig){ host._gSig=sig; host._cgSig=undefined; renderCmdGrid(host, _specUnitModel(u)); } }
  finally{ if(_sv!==undefined) G.atkLv=_sv; } }
function showPlayerProfile(u){ if(!U[u.id]) return;
  document.getElementById('plGridWrap').style.display='none';
  const host=document.getElementById('playerProfile'); host.classList.add('on','simple'); host._gSig=undefined; renderSpecProfile(u); }
// 관전 중 상호작용 대상 유닛 목록(상대=실시간 보드, 나=내 유닛)
function _plUnitList(){ const rb=(typeof specRemoteBoard==='function')&&specRemoteBoard();
  return rb && G.coopBoard && G.coopBoard[rb] ? (G.coopBoard[rb].units||[]) : G.units; }
function selectPlayerUnit(uid){ const u=_plUnitList().find(x=>x.uid===uid); if(!u){ clearPlayerSel(); return; }
  G.sel=[uid]; G.specSel=uid; G.selEnemy=null; showPlayerProfile(u); updateDeselTop();   // 단일(M3D 림 표시)
}
function clearPlayerSel(){ G.sel=[]; G.specSel=null; const c=document.getElementById('playerProfile'); if(c){ c.classList.remove('on'); c._gSig=undefined; }
  const w=document.getElementById('plGridWrap'); if(w) w.style.display=''; updateDeselTop(); }
let _plStart=null, _plBox=null, _plMoved=false;
function _hitPlayerUnit(x,y){ let best=1e9,hit=null; for(const u of _plUnitList()){ const d=Math.hypot((u.x-x)*GW,(u.y-y)*GH); if(d<=unitRadius(u)+6 && d<best){ best=d; hit=u; } } return hit; }
function onPlayerDown(e){ if(G.tab!=='Players') return; e.preventDefault();
  const p=evPosIn('vPlayers',e); _plStart=p; _plMoved=false; _plBox=null;
  const u=_hitPlayerUnit(p.x,p.y);                            // 관전 중이면 상대 유닛 대상
  if(u){ selectPlayerUnit(u.uid); }                          // 유닛 클릭 → 1마리 정보
  else { _plBox={x0:p.x,y0:p.y,x1:p.x,y1:p.y}; drawPlBox(_plBox); }  // 빈 곳 → 박스 시작
}
function onPlayerMove(e){ if(G.tab!=='Players'||!_plBox) return; e.preventDefault();
  const p=evPosIn('vPlayers',e); _plMoved=true; _plBox.x1=p.x; _plBox.y1=p.y; drawPlBox(_plBox); }
function onPlayerUp(){ if(!_plBox){ _plStart=null; return; }
  const b=_plBox; clearPlBox(); _plBox=null;
  if(_plMoved){ const x0=Math.min(b.x0,b.x1),x1=Math.max(b.x0,b.x1),y0=Math.min(b.y0,b.y1),y1=Math.max(b.y0,b.y1);
    let best=Infinity,pick=null; for(const u of _plUnitList()){ if(u.x>=x0&&u.x<=x1&&u.y>=y0&&u.y<=y1){ const d=Math.hypot((u.x-b.x0)*GW,(u.y-b.y0)*GH); if(d<best){best=d;pick=u;} } }
    if(pick) selectPlayerUnit(pick.uid); else clearPlayerSel(); }   // 박스 안 최근접 1마리
  else clearPlayerSel();   // 빈 곳 탭 = 해제
  _plStart=null; }
function drawPlBox(b){ let el=document.getElementById('plBox');
  if(!el){ el=document.createElement('div'); el.id='plBox'; document.getElementById('vPlayers').appendChild(el); }
  const x=Math.min(b.x0,b.x1),y=Math.min(b.y0,b.y1),w=Math.abs(b.x1-b.x0),h=Math.abs(b.y1-b.y0);
  el.style.cssText='position:absolute;border:1px solid #ff6a6a;background:rgba(255,90,90,.12);pointer-events:none;z-index:15;'
    +'left:'+(x*100)+'%;top:'+(y*100)+'%;width:'+(w*100)+'%;height:'+(h*100)+'%'; }
function clearPlBox(){ const el=document.getElementById('plBox'); if(el) el.remove(); }
const vp=document.getElementById('vPlayers');
vp.addEventListener('mousedown',onPlayerDown); vp.addEventListener('mousemove',onPlayerMove); window.addEventListener('mouseup',onPlayerUp);
vp.addEventListener('touchstart',onPlayerDown,{passive:false}); vp.addEventListener('touchmove',onPlayerMove,{passive:false}); vp.addEventListener('touchend',onPlayerUp);

// (삭제) 업그레이드 탭 건물 화면 — 건물 타일·선택 박스·업그레이드 목록 패널. 하단 업그레이드 시트(renderUpgradeSheet)와 완전 중복이라 폐지.

// 투사체 오버레이(#cvFx, 3D 모델 위) — 미사일/탄이 유닛 몸에 가려지지 않도록 최상단에 그림
// ── 이동 트레일: 모델별 테마 레시피(전 공중유닛 + 레이서/브레이커) — 랩·메인 공용(완전 동일) ──
const BT_FX_ZOOM=1.4;   // ⚔ 전장 발사 이펙트 줌(메인 모델 스케일 기준 — 랩 scale1 대비 1/0.72 보정)
const TRAIL_FX={   // glow=발광 화염/에너지(가산), 그 외=연무(확산·source-over). mode:center=부양 몸 중앙 / anchor=발밑 앵커
  racer:{every:.022,n:2,mode:'anchor',by:-.004,back:.016,glow:1,col:['#4ab4ff'],core:'#cfe6ff',r0:.4,rv:.45,dk:4.6,kick:.012,kv:.012,sv:.006,jit:.004},   // 레이서: 푸른 엔진화염(지상)
  jet:  {every:.02, n:2,mode:'center',back:.016,glow:1,col:['#5ab0ff','#bfe0ff'],core:'#eaf4ff',r0:.4,rv:.4,dk:4.4,kick:.014,kv:.012,sv:.008,jit:.005},   // 테란 비행: 청백 엔진 배기
  jetP: {every:.02, n:2,mode:'center',back:.034,side:.012,glow:1,col:['#5ab0ff','#bfe0ff'],core:'#eaf4ff',r0:.4,rv:.4,dk:4.4,kick:.014,kv:.012,sv:.006,jit:.004},   // 펠리컨: 더 뒤에서 좌우 2갈래(트윈 엔진)
  jetH: {every:.02, n:2,mode:'center',back:.016,side:.006,glow:1,col:['#5ab0ff','#bfe0ff'],core:'#eaf4ff',r0:.4,rv:.4,dk:4.4,kick:.014,kv:.012,sv:.005,jit:.004},   // 헬파이어: 트윈 엔진(아주 살짝만 벌림)
  jetD: {every:.018,n:2,mode:'center',back:.028,side:.007,glow:1,col:['#5ab0ff','#bfe0ff'],core:'#eaf4ff',r0:.56,rv:.42,dk:4.4,kick:.014,kv:.012,sv:.005,jit:.004},   // 드레드노트: 더 뒤 + 좁은 간격 트윈 + 두껍게(강력, 길이는 동일=dk 유지)
  tank: {every:.05, n:1,mode:'anchor',by:-.012,back:.022,col:['#3a3a42','#4e4e58'],ex:3.0,af:.5,r0:.6,rv:.5,dk:1.6,kick:.008,kv:.01,up:.018,uv:.012,jit:.006},   // 브레이커: 검은 배기 연기(지상)
  psiC: {every:.03, n:1,mode:'center',back:.015,glow:1,col:['#8fe0ff','#dff2ff'],core:'#eafaff',r0:.5,rv:.45,dk:3.2,kick:.006,kv:.008,up:.01,uv:.008,sv:.008,jit:.006},   // 프로토스: 청록 사이오닉 잔광
  psiG: {every:.03, n:1,mode:'center',back:.015,glow:1,col:['#ffd98a','#fff0c8'],core:'#fff6df',r0:.55,rv:.5,dk:3.0,kick:.006,kv:.008,up:.01,uv:.008,sv:.008,jit:.006},   // 프로토스 상위: 금빛 사이오닉
  spore:{every:.035,n:1,mode:'center',back:.014,col:['#9a6fd0','#7250a0'],ex:2.2,af:.4,r0:.7,rv:.6,dk:2.8,kick:.004,kv:.006,sv:.008,jit:.006},   // 저그 유기체: 보라 포자 연무
  acid: {every:.025,n:1,mode:'center',back:.012,col:['#8fbf5a','#6f9e3c'],ex:2.2,af:.4,r0:.7,rv:.6,dk:3.4,kick:.005,kv:.006,sv:.008,jit:.005},   // 저그 독: 초록 산성 연무
};
const TRAIL_UNIT={   // 모델키 → 트레일 레시피
  racer:'racer', tank:'tank',
  pelican:'jetP', hellfire:'jetH', dreadnought:'jetD', skyguard:'jet', aegis:'jet',   // 테란 비행(펠리컨·헬파이어=트윈 / 드레드노트=강력 트윈)
  seraph:'psiC', falcon:'psiC', observer:'psiC', skydancer:'psiC', archangel:'psiG', kronos:'psiG',   // 에테리얼 비행
  overlord:'spore', medusa:'spore', wyvern:'spore', venom:'acid', behemoth:'acid', stinger:'acid',   // 스웜 비행
};
const MOVE_TRAIL_GM=new Set(Object.keys(TRAIL_UNIT));
function emitMoveTrail(store, gm, o, dx, dy, zf, dt){ const key=TRAIL_UNIT[gm]; if(!key||!store||!store.smoke) return; const R=TRAIL_FX[key]; if(!R) return;
  o._mtT=(o._mtT||0)+dt; if(o._mtT<R.every) return; o._mtT=0;
  let ox=o.x, oy=o.y;
  if(R.mode==='center'){ const c=(window.M3D&&M3D.centerAt)?M3D.centerAt(o.uid):null; if(c){ ox=c.x; oy=c.y; } else oy=o.y-0.05; }   // 부양 유닛: 떠 있는 몸 중앙에서
  const bk=(R.back||.015)*zf; ox-=dx*bk; oy-=dy*bk+(R.by?R.by*zf:0);   // 진행 반대쪽(뒤) + 앵커 y보정
  for(let k=0;k<(R.n||1);k++){ const kk=(R.kick||0)+Math.random()*(R.kv||0);
    const sgn=R.side?((R.n===2)?(k?1:-1):(Math.random()<0.5?1:-1))*R.side*zf:0, sox=ox+(-dy)*sgn, soy=oy+dx*sgn;   // side=진행 수직 좌/우 갈래(트윈)
    const p={ x:sox+(Math.random()-0.5)*(R.jit||0), y:soy+(Math.random()-0.5)*(R.jit||0),
      vx:-dx*kk+(Math.random()-0.5)*(R.sv||0), vy:-dy*kk-(R.up||0)-Math.random()*(R.uv||0)+(Math.random()-0.5)*(R.sv||0),
      life:1, r0:(R.r0||.5)+Math.random()*(R.rv||.4), col:R.col[(Math.random()*R.col.length)|0], dk:R.dk||2 };
    if(R.glow){ p.glow=true; p.core=R.core; } else { p.ex=R.ex||2.4; p.af=R.af||0.4; }
    store.smoke.push(p); } }
// ⚔ 전장 발사 이펙트: unitFireFx로 쌓인 G.btFx를 advance+draw(cvFx 위 오버레이, 지연피격 pend 처리)
function drawBattleFx(dt){ if(typeof FX==='undefined') return; if(!G.btFx) G.btFx=FX.store(); if(!G.btPend) G.btPend=[];
  for(let i=G.btPend.length-1;i>=0;i--){ const p=G.btPend[i]; p.t-=dt; if(p.t<=0){ FX.spawn(G.btFx, p.id, p.sx, p.sy, p.tx, p.ty, p.opt); G.btPend.splice(i,1); } }
  if(G.btUnits) for(const _u of G.btUnits){ if(_u._fxL && _u._fxL.vnJet) tickUnitFx(_u._fxL, dt); }   // 연속 이미터(베놈 가스) 틱
  FX.advance(G.btFx, dt);
  const cvf=document.getElementById('cvFx'); if(!cvf) return; const ctx=cvf.getContext('2d');
  FX.drawShots(ctx, G.btFx, (x,y)=>({x:x*GW, y:y*GH}), BT_FX_ZOOM); }
// 메인·관전: 실제 유닛 이동에 랩과 동일한 트레일 적용(cvFx 위 오버레이 — drawFx 다음에 호출)
function stepMoveTrails(dt){ if(typeof FX==='undefined'||typeof emitMoveTrail!=='function') return;
  if(!G._mvFx) G._mvFx=FX.store();
  if(!fxOff()) for(const u of G.units){ const gm=u.gmodel||u.id; if(!u.moving||!MOVE_TRAIL_GM.has(gm)) continue;
    const vx=u.vx||0, vy=u.vy||0, sp=Math.hypot(vx,vy);
    if(sp>0.004){ emitMoveTrail(G._mvFx, gm, u, vx/sp, vy/sp, 1, dt); }
    else if(typeof u.face==='number'){ emitMoveTrail(G._mvFx, gm, u, Math.sin(u.face), Math.cos(u.face), 1, dt); } }   // 속도 없으면 바라보는 방향 기준
  FX.advance(G._mvFx, dt);
  const cv=document.getElementById('cvFx'); if(!cv) return; const ctx=cv.getContext('2d');
  FX.drawShots(ctx, G._mvFx, (x,y)=>({x:x*GW, y:y*GH}), 1.0); }
function drawFx(){ const {ctx,W,H}=setup('cvFx');  // setup이 캔버스 크기 재설정=자동 클리어
  ctx.save(); ctx.globalCompositeOperation='lighter';
  if(!fxOff()) for(const s of G.shots){ ctx.fillStyle=s.color; ctx.strokeStyle=s.color;   // 이펙트 끔: 발사체도 생략 (유닛 축소에 맞춰 ~0.82 작게)
    if(s.kind==='jetmsl'){ const m2=Math.hypot(s.vx,s.vy)||1, jx=s.vx/m2, jy=s.vy/m2;
      ctx.globalAlpha=.35; ctx.strokeStyle='#9fc8ff'; ctx.lineWidth=0.9; ctx.beginPath(); ctx.moveTo(s.x-jx*18,s.y-jy*18); ctx.lineTo(s.x-jx*5,s.y-jy*5); ctx.stroke();   // 배기 꼬리
      ctx.globalAlpha=1; ctx.strokeStyle='#eef6ff'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(s.x-jx*5,s.y-jy*5); ctx.lineTo(s.x+jx*4,s.y+jy*4); ctx.stroke();   // 얇은 탄체
      ctx.strokeStyle=s.color;
    } else if(s.kind==='nukefall'){ const tl=22;
      ctx.globalAlpha=.5; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(s.x,s.y-tl); ctx.lineTo(s.x,s.y); ctx.stroke();
      ctx.globalAlpha=.45; ctx.beginPath(); ctx.arc(s.x,s.y,6,0,6.283); ctx.fill();
      ctx.globalAlpha=1; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s.x,s.y,3.2,0,6.283); ctx.fill(); ctx.fillStyle=s.color;
    } else if(s.kind==='plasma'){ const oR=s.orbR||0;
      if(oR){ // 대구체: 방사형 그라데이션 플라즈마 — 흰 핵이 본색으로 녹아들며 가장자리는 부드럽게 사라짐
        const gR=oR*2.1, g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,gR);
        g.addColorStop(0,'rgba(255,255,255,0.95)'); g.addColorStop(0.22,hexA(s.color,0.9));
        g.addColorStop(0.55,hexA(s.color,0.45)); g.addColorStop(1,hexA(s.color,0));
        ctx.globalAlpha=1; ctx.fillStyle=g; ctx.beginPath();ctx.arc(s.x,s.y,gR,0,6.28);ctx.fill(); ctx.fillStyle=s.color;
        const fa=Math.random()*6.28; ctx.strokeStyle='#eadcff'; ctx.lineWidth=1.2; ctx.globalAlpha=.6;   // 지직 플리커
        ctx.beginPath(); ctx.moveTo(s.x+Math.cos(fa)*oR*0.7,s.y+Math.sin(fa)*oR*0.7); ctx.lineTo(s.x+Math.cos(fa)*(oR*1.7+Math.random()*4),s.y+Math.sin(fa)*(oR*1.7+Math.random()*4)); ctx.stroke(); ctx.globalAlpha=1;
      } else { ctx.globalAlpha=.4; ctx.beginPath();ctx.arc(s.x,s.y,5.8,0,6.28);ctx.fill();
        ctx.globalAlpha=1; ctx.beginPath();ctx.arc(s.x,s.y,2.9,0,6.28);ctx.fill(); }
    } else if(s.kind==='needle'){ ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.vy,s.vx));
      ctx.globalAlpha=.85; ctx.fillStyle=s.color;                                                 // 가늘고 뾰족한 침(미사일 X)
      ctx.beginPath(); ctx.moveTo(4.5,0); ctx.lineTo(-4,0.7); ctx.lineTo(-4,-0.7); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if(s.kind==='missile'){ ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.vy,s.vx));
      const lf=Math.min(1,(s.t||0)/0.1);   // 발사 직후 0.1s는 화염 억제 — 어깨엔 연기만(빨간 화염 원 방지)
      ctx.globalAlpha=.5*lf; ctx.fillStyle='#ff8a3c'; ctx.fillRect(-6.5,-1.2,4,2.4);   // 화염 배기(짧게)
      ctx.globalAlpha=.9*lf; ctx.fillStyle='#ffd27a'; ctx.fillRect(-4.5,-0.9,3.2,1.8); // 화염 코어
      ctx.globalAlpha=1; ctx.fillStyle=s.color; ctx.fillRect(-1.6,-1.3,5,2.6);      // 미사일 본체
      ctx.fillStyle='#fff'; ctx.fillRect(2,-1,2,2);                                  // 탄두
      ctx.restore();
    } else if(s.kind==='sniper'){ ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(Math.atan2(s.vy,s.vx));
      ctx.globalAlpha=.4; ctx.fillStyle='#bfe9ff'; ctx.fillRect(-23,-0.8,23,1.5);
      ctx.globalAlpha=1; ctx.fillStyle='#ffffff'; ctx.fillRect(-6.5,-1,9,2);
      ctx.globalAlpha=1; ctx.fillStyle='#eafdff'; ctx.beginPath();ctx.arc(1.6,0,1.3,0,6.28);ctx.fill();
      ctx.restore();
    } else if(s.kind==='bullet'){ ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(Math.atan2(s.vy,s.vx));
      ctx.globalAlpha=.35; ctx.fillStyle=s.color; ctx.fillRect(-10.5,-0.9,10.5,1.7);
      ctx.globalAlpha=.9; ctx.fillStyle='#fff7c0'; ctx.fillRect(-4,-0.9,5.7,1.8);
      ctx.globalAlpha=1; ctx.fillStyle='#fffbe8'; ctx.beginPath();ctx.arc(1.2,0,1.5,0,6.28);ctx.fill();
      ctx.restore();
    } else if(s.kind==='mg'){ ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(Math.atan2(s.vy,s.vx));   // 레이서: 얇은 기관총 탄(가는 트레이서)
      ctx.globalAlpha=.3; ctx.fillStyle=s.color; ctx.fillRect(-10,-0.45,10,0.9);    // 가는 꼬리(길게 — 연속감)
      ctx.globalAlpha=1;  ctx.fillStyle='#fff7d8'; ctx.fillRect(-1.6,-0.55,3.6,1.1); // 밝은 탄두
      ctx.restore();
    } else if(s.kind==='shell'){ ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(Math.atan2(s.vy,s.vx));   // 브레이커: 무거운 포탄
      ctx.globalAlpha=.45; ctx.fillStyle='#ffae4d'; ctx.fillRect(-9,-1.4,5,2.8);          // 추진 화염 꼬리
      ctx.globalAlpha=1; ctx.fillStyle='#b8a878'; ctx.beginPath(); ctx.ellipse(0,0,3.6,2.5,0,0,6.28); ctx.fill();   // 포탄 본체
      ctx.fillStyle='#fff2c0'; ctx.beginPath(); ctx.arc(2.4,0,1.1,0,6.28); ctx.fill();     // 탄두 광점
      ctx.restore();
    } else if(s.kind==='mgf'){ ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(Math.atan2(s.vy,s.vx));   // 발칸: 주황 화염 트레이서(레이서와 차별)
      ctx.globalAlpha=.3;  ctx.fillStyle='#ff7a2c'; ctx.fillRect(-12,-0.7,12,1.4);   // 주황 화염 꼬리
      ctx.globalAlpha=.85; ctx.fillStyle='#ffb23c'; ctx.fillRect(-5.5,-0.7,6.5,1.4); // 밝은 불꽃
      ctx.globalAlpha=1;   ctx.fillStyle='#fff2c0'; ctx.fillRect(-1.6,-0.8,3.6,1.6); // 흰 탄두
      ctx.restore();
    } else { ctx.globalAlpha=1; ctx.beginPath();ctx.arc(s.x,s.y,2,0,6.28);ctx.fill(); } }
  // 총구 섬광·포토 충전(저화질/절전 시 생략)
  if(!fxLite()){
  for(const z of G.muzzles){ const a=Math.max(0,z.life); ctx.globalAlpha=a*0.6; ctx.fillStyle=z.color;
    ctx.beginPath();ctx.arc(z.x,z.y,(z.r||4)*a*1.6+2,0,6.28);ctx.fill();        // 외곽 발광
    ctx.globalAlpha=a; ctx.fillStyle='#ffffff'; ctx.beginPath();ctx.arc(z.x,z.y,(z.r||4)*a*0.6+1,0,6.28);ctx.fill(); }  // 밝은 코어
  // 포토케논 충전 구슬 — 같은 자리에 여러 개 쌓여도 한 번만 그림(겹쳐서 과하게 밝아지지 않게, 상한 1.5×)
  const _phGrp={};
  for(const u of G.units){ if(u.id!=='photon'||u.gid||!u.cdMax) continue; const def=U.photon;   // u.gid=가챠 유닛(스카이댄서 등)은 포토캐논 충전 오브 제외
    const ux=u.x*W, uy=u.y*H, rng=def.range*Math.min(W,H); let inR=false;
    for(const e of G.enemies){ const p=posAt(e.d,W,H); if(Math.hypot(p.x-ux,p.y-uy)<=rng){inR=true;break;} }
    // 충전 중이거나 최근 0.8초내 타겟 있었으면 계속 표시(적이 사거리 들락날락해도 안 깜빡)
    if(inR) u._th=50; else u._th=Math.max(0,(u._th||0)-1);
    const showT=(u.cd>0||u._th>0)?1:0; u._cv=(u._cv||0)+(showT-(u._cv||0))*0.15;
    if(u._cv<0.03) continue;
    const key=Math.round(ux)+','+Math.round(uy); const grp=_phGrp[key]||(_phGrp[key]={cnt:0,u:u,cv:0});
    grp.cnt++; if(u._cv>=grp.cv){ grp.cv=u._cv; grp.u=u; }   // 가장 충전된 개체 기준으로 한 번만
  }
  for(const key in _phGrp){ const grp=_phGrp[key], u=grp.u, boost=Math.min(1.5, 1+0.07*(grp.cnt-1));   // 쌓일수록 살짝만 밝게(상한 1.5×)
    const ux=u.x*W, uy=u.y*H, vis=u._cv, ch=Math.max(0,Math.min(1, 1-u.cd/u.cdMax)), mx=ux, my=uy-PHOTON_ORB_UP;
    const cv2=0.35+0.65*ch, e2=Math.pow(cv2,1.5), R=(5+e2*13)*(1+0.12*(boost-1)), a=cv2*vis*boost;  // 부드러운 그라데이션 구슬
    const g=ctx.createRadialGradient(mx,my,0, mx,my,R);
    g.addColorStop(0,   hexA('#dffbff', 0.5*a));   // 코어(연한 흰빛)
    g.addColorStop(0.4, hexA('#7fdcff', 0.28*a));  // 청록
    g.addColorStop(1,   hexA('#3aa8ff', 0));       // 가장자리 투명
    ctx.globalAlpha=1; ctx.fillStyle=g; ctx.beginPath();ctx.arc(mx,my,R,0,6.28);ctx.fill();
    for(let k=0;k<7;k++){ const ang=k/7*6.28 + G.timeSec*4, rr=(1-ch)*20+6;   // 바깥에서 구슬로 빨려드는 입자(은은)
      ctx.globalAlpha=ch*0.35*vis; ctx.fillStyle='#cdf3ff';
      ctx.beginPath();ctx.arc(mx+Math.cos(ang)*rr, my+Math.sin(ang)*rr, 1.4,0,6.28);ctx.fill(); }
  }
  } // /fxLite — 총구/충전 생략
  ctx.restore();
}
// ── 루프 ──
// ===== [admin 샌드박스] 게임 진행 없이 평지에 유닛 진열 — 기본값 편집 작업대 =====
function drawBattleGround(ctx,W,H){   // ⚔ 전용 전장: 어두운 격전지 + 좌(아군)·우(적) 존 + 격자 + 대치선 + 비네트
  const g=ctx.createLinearGradient(0,0,W,0); g.addColorStop(0,'#0c1420'); g.addColorStop(0.5,'#0a0d12'); g.addColorStop(1,'#1a0e10'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.globalAlpha=0.06; ctx.strokeStyle='#6f8fb0'; ctx.lineWidth=1; const gs=Math.max(28,W/16);
  for(let x=0;x<W;x+=gs){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); } for(let y=0;y<H;y+=gs){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); } ctx.restore();
  ctx.save(); ctx.globalCompositeOperation='lighter';
  let lg=ctx.createRadialGradient(W*0.14,H*0.5,0,W*0.14,H*0.5,W*0.42); lg.addColorStop(0,'rgba(60,120,220,.10)'); lg.addColorStop(1,'rgba(60,120,220,0)'); ctx.fillStyle=lg; ctx.fillRect(0,0,W,H);
  let rg=ctx.createRadialGradient(W*0.88,H*0.5,0,W*0.88,H*0.5,W*0.42); rg.addColorStop(0,'rgba(210,60,60,.10)'); rg.addColorStop(1,'rgba(210,60,60,0)'); ctx.fillStyle=rg; ctx.fillRect(0,0,W,H); ctx.restore();
  ctx.save(); ctx.globalAlpha=0.12; ctx.strokeStyle='#cfe0ff'; ctx.setLineDash([6,8]); ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(W*0.52,H*0.06); ctx.lineTo(W*0.52,H*0.94); ctx.stroke(); ctx.restore();
  const v=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.75); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.5)'); ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.globalAlpha=0.55; ctx.font='bold 10px '+FONT_NUM; ctx.textBaseline='top';
  ctx.fillStyle='#7fb0ff'; ctx.textAlign='left'; ctx.fillText('◈ 아군 배치', 8, 8);
  ctx.fillStyle='#ff8a8a'; ctx.textAlign='right'; ctx.fillText('적 더미 ▶', W-8, 8); ctx.restore(); }
function _btRosterFlat(){ const out=[]; if(typeof SANDBOX_ROSTER==='undefined') return out;
  (typeof SANDBOX_RACE_ORDER!=='undefined'?SANDBOX_RACE_ORDER:Object.keys(SANDBOX_ROSTER)).forEach(function(race){ (SANDBOX_ROSTER[race]||[]).forEach(function(it){ out.push(it); }); }); return out; }
function _btModelStats(u, gm){ const d=Udef(gm); if(!d) return; const m=(u.hero?HERO_STAT_MUL:1)*gachaTierMul(u);   // 전투실험 전용: HP/실드/에너지도 gmodel 기준 → 공격 정의와 일치(프랑켄슈타인 방지)
  u.maxHp=Math.round((d.hp||0)*m); u.hp=u.maxHp; u.maxSh=Math.round((d.shield||0)*m); u.sh=u.maxSh; u.maxEn=d.energy||0; u.en=u.maxEn;
  if((d.shield||0)>0){ const _s=_upgShield(u); if(_s){ u.maxSh+=_s; u.sh=u.maxSh; } } }   // 🛡 에테리얼 실드 티어(생성 시 적용 · 무기/방어는 라이브)
function btAddFoe(sid, gm, name, quiet){ if(typeof G==='undefined') return; G.btUnits=G.btUnits||[]; if(G.idSeq==null) G.idSeq=1;
  const n=G.btUnits.filter(u=>u.team==='foe').length, c=n%4, r=(n/4)|0;   // 적군만 카운트 → 우측 격자
  const u=initUnitStats({uid:G.idSeq++, id:sid, hero:false, lv:1, x:0.90-c*0.05, y:0.44+r*0.052, cd:0, fixed:false});
  if(gm){ u.gmodel=gm; _btModelStats(u, gm); } u.gname=name||''; u.team='foe';   // 적팀 표식
  if(u.maxEn>0) u.en=Math.min(50,u.maxEn);   // 🔮 마나: 생산 직후 50(SC)
  G.btUnits.push(u); if(G.tab==='Battle') G.units=G.btUnits;
  if(!quiet && typeof toast==='function') toast((name||sid)+' [적] 배치'); }
function btClear(){ if(typeof G==='undefined'||!G.btUnits) return; G.btUnits.length=0; if(G.tab==='Battle') G.units=G.btUnits; G.sel=[]; if(window.M3D&&M3D.clearGameModels) M3D.clearGameModels(); if(typeof toast==='function') toast('전장 비움'); }
function drawSandboxGround(ctx,W,H){
  ctx.fillStyle=(typeof mkPat==='function' && mkPat(ctx,TILE_BAD,BAD_TILE)) || '#241410';
  ctx.fillRect(0,0,W,H);
  if(typeof terrainNoise==='function') terrainNoise(ctx,0,0,W,H,80,3.0);
  const g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.72);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.28)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  if(typeof G!=='undefined' && G._sandboxRows && !(G.sandbox && G.tab==='Unit')){ ctx.save(); ctx.font='bold 11px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';   // 이펙트 랩(Unit)에선 종족 행 라벨 숨김
    G._sandboxRows.forEach(function(row){ const ly=row.y*H;
      ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(W*0.02,ly+H*0.06); ctx.lineTo(W*0.98,ly+H*0.06); ctx.stroke();
      ctx.fillStyle='rgba(255,224,160,.92)'; ctx.shadowColor='#000'; ctx.shadowBlur=4; ctx.fillText(row.label, W*0.03, ly); ctx.shadowBlur=0;
    }); ctx.restore(); }
}
// ═══ 공용 유닛 로스터(단일 출처) — 메인(관리자)·이펙트랩·건설 등 모든 구역이 이 하나를 참조. 유닛 추가/이름 변경은 여기 한 곳만 고치면 전 구역 반영 ═══
// key = 유닛 식별자(= U/모델 키 · 스탯=Udef(key)/TECH_SPEC) · n = 표시 이름. 아군/적은 배치 상황이 정하는 것 — 유닛 고유 속성 아님
const RACE_ROSTER={
  union:[{n:'정비공',key:'worker_human'},{n:'레인저',key:'marine'},{n:'화력병',key:'machinegun'},{n:'의무병',key:'medic'},{n:'저격수',key:'ghost'},{n:'레이서',key:'racer'},{n:'공성전차',key:'tank'},{n:'기갑병',key:'goliath'},{n:'전투기',key:'skyguard'},{n:'수송선',key:'pelican'},{n:'지원 정찰기',key:'aegis'},{n:'폭격기',key:'hellfire'},{n:'전함',key:'dreadnought'}],
  swarm:[{n:'생산자',key:'worker_swarm'},{n:'수송충',key:'overlord'},{n:'척후병',key:'snapper'},{n:'스파이크',key:'hydra'},{n:'가시여왕',key:'thornqueen'},{n:'자폭충',key:'stinger'},{n:'비행충',key:'wyvern'},{n:'군단여왕',key:'medusa'},{n:'오염술사',key:'defiler'},{n:'산성충',key:'venom'},{n:'포격충',key:'behemoth'},{n:'스웜링',key:'broodling'},{n:'돌격괴수',key:'ultralisk'}],
  aetherial:[{n:'생산자',key:'worker_light'},{n:'센티넬',key:'dragoon'},{n:'광전사',key:'blade'},{n:'보이드',key:'archon'},{n:'팔콘',key:'falcon'},{n:'수송선',key:'seraph'},{n:'요격기',key:'skydancer'},{n:'모함',key:'archangel'},{n:'정찰기',key:'observer'},{n:'전함',key:'kronos'},{n:'다크세이지',key:'dark_templar'},{n:'하이세이지',key:'high_templar'},{n:'공성체',key:'larva'}],
  // 🐺 페럴 · 🗿 콜로서스 — RACES.md 로스터 그대로. 일꾼이 첫 자리(다른 종족과 같은 규약)
  feral:[{n:'채집수',key:'worker_feral'},{n:'추격수',key:'wolfrunner'},{n:'가시 사수',key:'thornspitter'},{n:'포식수',key:'clawfighter'},{n:'돌진수',key:'hornedcharger'},{n:'대공 투석수',key:'howlslinger'},{n:'맹독수',key:'venomfang'},{n:'암살수',key:'stalkercat'},{n:'주술사',key:'packshaman'},{n:'우두머리',key:'alphawolf'},{n:'정찰조',key:'hawkeye'},{n:'수송조',key:'windcarrier'},{n:'폭격 기수',key:'wyvernrider'},{n:'하늘 사냥수',key:'skytalon'},{n:'뇌격수',key:'stormroc'},{n:'원시 군주',key:'primalbeast'}],
  colossus:[{n:'조립 드론',key:'worker_col'},{n:'포대병',key:'gunner'},{n:'가드 워커',key:'guardwalker'},{n:'트윈 캐논',key:'twincannon'},{n:'플랙 배터리',key:'flakbattery'},{n:'관측 드론',key:'spotterdrone'},{n:'레일건 플랫폼',key:'railgun'},{n:'정지장 기술자',key:'stasistech'},{n:'아크 라이트',key:'arclight'},{n:'보급 비행정',key:'supplylifter'},{n:'시즈 콜로서스',key:'siegecolossus'},{n:'스카이 랜스',key:'skylance'},{n:'궤도 앵커',key:'orbitalanchor'},{n:'월드 브레이커',key:'worldbreaker'}],
};
function _rosterName(key){ for(const r in RACE_ROSTER){ const f=RACE_ROSTER[r].find(u=>u.key===key); if(f) return f.n; } return (typeof U!=='undefined'&&U[key]&&U[key].name)||key; }   // 공용 표시 이름(전 구역 통일)
// SANDBOX_ROSTER(관리자 메인 배치)는 공용 로스터에서 생성 — b/gm 모두 key(모델=스탯 키). 출력은 기존과 동일
const SANDBOX_ROSTER=(function(){ const o={}; for(const r in RACE_ROSTER){ o[r]=RACE_ROSTER[r].map(u=>({n:u.n, b:u.key, gm:u.key})); } return o; })();
// 관리자 샌드박스 진열 순서 — 여기 있는 종족만 화면에 깔린다.
// ⚠ 오토배틀 종족 목록(STK_RACE_ORDER)과 **다른 표다**. 페럴·콜로서스는 관리자에서 확정하는 중이라
//    여기엔 있고 저기엔 없다 — 저쪽에 넣는 것은 유닛·건물이 확정된 뒤의 별도 작업이다.
const SANDBOX_RACE_ORDER=['union','swarm','aetherial','feral','colossus'];   // 일꾼은 각 종족 첫 자리
const SANDBOX_RACE_KO={union:'유니온 (인간)',swarm:'스웜 (군체)',aetherial:'에테리얼 (외계)',feral:'페럴 (수인)',colossus:'콜로서스 (거신)'};
// 관리자 진열 — 종족·유닛이 늘어도 **한 화면에 들어오게** 간격을 역산한다.
// ⚠ 예전엔 dy(0.072)·gap(0.04)이 상수였다. 3종족 39기 기준으로 맞춘 값이라 페럴·콜로서스를 더하자
//    아래 두 종족이 채팅바·네비 밑으로 밀려 나갔다(2026-08-20). 총 줄 수에서 나눠 쓰도록 바꿨다.
const SB_TOP=0.14, SB_BOT=0.90, SB_DY_MAX=0.072, SB_GAP_R=0.55;   // 위·아래 여백 · 줄 간격 상한 · 종족 사이 간격(줄 간격 배수)
function placeSandboxUnits(){
  if(G.idSeq==null) G.idSeq=1; G.units.length=0; G._sandboxRows=[];
  const COLS=5;
  const races=SANDBOX_RACE_ORDER.filter(function(r){ return (SANDBOX_ROSTER[r]||[]).length; });
  const rows=races.reduce(function(n,r){ return n+Math.ceil(SANDBOX_ROSTER[r].length/COLS); }, 0);
  // 전체 높이 = 줄들 + 종족 사이 틈. 상한을 두어 종족이 적을 땐 예전과 같은 간격을 유지한다.
  const dy=Math.min(SB_DY_MAX, (SB_BOT-SB_TOP)/Math.max(1, rows+(races.length-1)*SB_GAP_R));
  const gap=dy*SB_GAP_R;
  let yc=SB_TOP;
  races.forEach(function(race){
    const arr=SANDBOX_ROSTER[race];
    G._sandboxRows.push({label:SANDBOX_RACE_KO[race]||race, y:yc-dy*0.7});
    const subRows=Math.ceil(arr.length/COLS);
    arr.forEach(function(it, i){
      const c=i%COLS, r=(i/COLS)|0;
      const x=0.20+(c/(COLS-1))*0.70, y=yc+r*dy;
      const _sid=(it.gm && typeof U[it.gm]!=='undefined') ? it.gm : it.b;   // 모델 전용 스탯 있으면 사용
      const u=initUnitStats({uid:G.idSeq++, id:_sid, hero:false, lv:1, x:x, y:y, cd:0, fixed:false});
      if(it.gm) u.gmodel=it.gm; u.gname=it.n;
      G.units.push(u);
    });
    yc += subRows*dy + gap;
  });
}
function enterSandbox(){
  if(typeof bgmStop==='function') bgmStop();
  // 게임에 들어가면 앱 화면(HOME·마을…)을 반드시 닫는다. 안 닫으면 두 화면이 겹친 상태가 되어
  // 공용 3D 캔버스도 안 돌아오고(마을에 남는다), 유즈맵이 그리면 안 되는 화면으로 판정된다.
  // 실제 게임 진입(startGameNow 경로)은 이미 hideAppScreens를 거치는데 샌드박스만 빠져 있었다.
  if(typeof hideAppScreens==='function') hideAppScreens();
  G=newGame(); G.phase='playing'; G.sandbox=true; G.tab='Main'; G.loading=false; G.roundPhase='idle'; G.paused=false;
  G.enemies.length=0;
  if(window.M3D && window.M3D.clearGameModels) window.M3D.clearGameModels();
  if(typeof setInGame==='function') setInGame(true);   // 하단 콘솔(#bot) 틀 표시
  { const bt=document.getElementById('battleTab'); if(bt) bt.style.display=''; }   // 전투실험 탭 노출(관리자 샌드박스 전용)
  { const bt2=document.getElementById('buildTab'); if(bt2) bt2.style.display=''; }   // 건설 테스트 탭 노출(관리자 샌드박스 전용)
  placeSandboxUnits();
  if(typeof updateHud==='function') updateHud();
  if(typeof drawMain==='function') drawMain();
  if(typeof refreshSelCard==='function') refreshSelCard();   // 관리자 메인 초기 상태: 무선택 → 홈 패널 숨김 + 시트 내려감
}
let last=performance.now();
// 공용 3D 캔버스(#cvMarine)를 HOME이나 마을이 빌려 갔으면 유즈맵은 그것을 그리면 안 된다.
// 안 그러면 두 곳이 같은 씬에 서로 다른 유닛 목록을 밀어넣어, 한쪽 sync가 dying으로 지운 모델을
// 다른 쪽 sync가 매 프레임 다시 만든다. 실측: HOME 복귀 후 샌드박스 유닛 38개가 계속 재생성되며
// 프레임마다 55ms씩 먹었다(= "유즈맵에서 나와 RPG로 가면 랙" 의 정체).
// loop는 화면과 무관하게 계속 도는 전역 rAF라, 소유권을 여기서 확인하는 수밖에 없다.
// 유즈맵 화면이 지금 앞에 있는가.
//  · #phone.inGame — 샌드박스 진입에서 안 켜질 때가 있어 못 믿는다
//  · #gameArea 가시성 — HOME이 떠 있어도 계속 보인다(게임 크롬은 다른 방식으로 감춤)
//  → 앱 화면(HOME·마을·로비…)이 하나라도 열려 있으면 유즈맵이 아니다. showAppScreen이 정확히
//    하나만 열고 hideAppScreens가 전부 닫으므로 이게 유일하게 믿을 수 있는 신호다.
function nemoScreenOn(){ if(typeof APP_SCREENS==='undefined') return true;
  for(const id of APP_SCREENS){ const e=document.getElementById(id);
    if(e && !e.classList.contains('hide')) return false; }
  return true; }
// 유즈맵이 공용 캔버스를 그려도 되는가. 보이는데 남이 들고 있으면 되찾아온다
// (마을에서 곧장 게임으로 들어가면 캔버스가 twMap에 남아 유즈맵 3D가 통째로 사라지던 버그도 이걸로 막힌다).
function nemoOwns3D(){
  const borrowed=(typeof _hb3dHome!=='undefined' && _hb3dHome) || (typeof _tw3dHome!=='undefined' && _tw3dHome);
  if(!nemoScreenOn()) return false;                       // 안 보이면 그리지 않는다
  if(borrowed){                                            // 보이는데 남이 들고 있다 → 반납시킨다
    if(typeof _hb3dHome!=='undefined' && _hb3dHome && typeof hb3dDetach==='function') hb3dDetach();
    if(typeof _tw3dHome!=='undefined' && _tw3dHome && typeof tw3dDetach==='function') tw3dDetach();
    const cv=document.getElementById('cvMarine'); if(cv) cv.style.display='block'; }
  return true; }
function loop(now){
  const cap=(G.opt&&G.opt.fps)|0;   // FPS 제한(0=무제한). 게임시간은 누적 dt로 유지
  if(cap>0 && (now-last) < (1000/cap - 1.5)){ requestAnimationFrame(loop); return; }
  const dt=Math.min(now-last,100)/1000; last=now;
  if(typeof G!=='undefined' && G._balSimRunning){ requestAnimationFrame(loop); return; }   // ⚖ 밸런스 검증 중: 렌더·틱 정지(헤드리스 시뮬이 G.units 점유)
  if(typeof window!=='undefined') window.__sandbox=!!(typeof G!=='undefined'&&G&&G.sandbox);   // 샌드박스 플래그(M3D 모듈 참조)
  if(typeof window!=='undefined') window.__strike=!!(typeof G!=='undefined'&&G&&G.strike);   // 직스 플래그(고정슬롯 고스트 숨김용)
  if(G.strike){ strikeFrame(dt); requestAnimationFrame(loop); return; }   // 컴퓨터가 싸운다: nemo 로직 우회, 직스 프레임만
  if(G.view&&G.viewT) nemoViewTick(dt);   // 화면 줌/팬 부드러운 보간(일시정지 무관)
  tickFakeChat(dt);   // 다른 플레이어 가짜 채팅(임시)
  tickPresence(dt);   // 플레이어 이탈(관전 버튼 비활성화)
  tickVote(dt);       // 배속 투표(봇 성향 변화) — 일시정지와 무관하게 진행
  tickPauseSim(dt);   // 공유 일시정지: 다른 플레이어가 해제/일시정지(일시정지와 무관하게 진행)
  // 유즈맵 화면이 아니면 여기서 끝 — 아래는 전장 시뮬과 렌더뿐이라 안 보이는 동안 돌릴 이유가 없다.
  // 위의 채팅·이탈·투표·일시정지 틱은 로비/방에서도 필요해서 이 줄 앞에 둔다.
  // 실측: HOME에서 이걸 안 막으면 60 → 47fps (숨은 전장 39유닛의 DOM·캔버스 갱신 비용).
  if(!nemoScreenOn()){ requestAnimationFrame(loop); return; }
  if(!G.paused && !G.loading){      // 일시정지/로딩(카운트다운) 중: 게임 진행(전투/연구/시민/이동/물리) 정지, 렌더·UI는 유지
    tickResearch(dt);   // 업그레이드 연구 타이머(진행 중이면 카운트다운, 완료 시 레벨업)
    const _sm=(G.phase==='playing')?G.speedMul:1;   // 배속: 적/시간뿐 아니라 내 유닛·시민 이동도 동일 배속
    for(let k=0;k<_sm;k++){
      if(G.phase==='playing' && !G.sandbox) step(dt);
      if(G.tab==='Unit' && !G.sandbox) stepCitizen(dt);   // 시민 이동(도착 시 구매) — 랩에선 정지
      if(G.tab==='Main'||G.tab==='Battle'){ stepTransports(dt); stepCmdMove(dt); separateUnits(); }   // 수송선 운항 + 내 유닛 이동명령 + 겹침 방지(전투실험 포함)
    }
    stepAuto(dt);   // 자동화 유틸(0.33초 틱) — 배속과 무관하게 실시간 기준
    if((G.tab==='Main'||G.tab==='Battle') && typeof _tpHoldTick==='function') _tpHoldTick(dt);   // 롱프레스 하차: 도착 후 유지 감시
    if(typeof stepSbCombat==='function') stepSbCombat(dt*_sm);   // ⚔ 전투 실험(양방향) — 배속(_sm) 반영(이동·쿨다운 동일 배속, stepSkills 앞)
    if(typeof stepSkills==='function') stepSkills(dt);   // 🪄 유닛 스킬(쿨다운·에너지·스톰 연출) — 샌드박스 포함(step 우회 대비)
    if(typeof _sbReapDead==='function') _sbReapDead();   // 전투실험: 스킬 사망 유닛 정리(전투 OFF 포함)

  }
  if(G.tab==='Main' && !G.sel.length && !G.selEnemy){ renderBossPanel(); renderHomeLeft(); }   // (메인)홈 파견/판매 — 유닛 DOM(renderUnits)은 아래 refreshSelCard가 매 프레임 호출
  // 선택된 적: 죽으면 해제, 살아있으면 상태창 HP/실드 실시간 갱신
  if(G.selEnemy!=null){ const se=G.enemies.find(x=>x.eid===G.selEnemy);
    if(!se) deselectUnit(); }   // 적 프로필 HP 실시간 갱신은 아래 mainProfileRender가 담당
  // 플레이어(관전) 탭: 선택 유닛 HP 실시간 갱신 / 죽으면 해제
  if(G.tab==='Players' && G.sel.length===1){ const pu=(typeof _plUnitList==='function'?_plUnitList():G.units).find(x=>x.uid===G.sel[0]);
    if(!pu) clearPlayerSel(); else { const pf=document.getElementById('playerProfile'); if(pf && pf.classList.contains('on')) renderSpecProfile(pu); } }
  refreshSelCard();   // 🪄 선택 프로필·스킬 바·명령 행 실시간(sig 캐시로 저비용) — 내부에서 updateCmdRow/updateSkillFab/updateAutoFab/mainProfileRender/renderUnits까지 호출하므로 루프에서 중복 호출 금지
  if(typeof sbCombatUiSync==='function') sbCombatUiSync();   // ⚔ 전투 실험 컨트롤 표시/상태(관리자 Main)
  if(!G.sandbox) checkPbossUnlocks();// 개인 보스 해금 감지(채팅 알람 + 버튼 알림)
  updatePbossFab();   // 개인 보스 소환 FAB(메인·쿨다운 실시간)
  { const gd=document.getElementById('gachaDex'); if(gd) gd.classList.toggle('hide', !!G.sandbox); }   // 가챠 도감(레전드·god 포함)은 네모네모 전용 → 관리자 샌드박스에선 숨김

  updatePcFab();      // 🎨 플레이어 색 확인 FAB — 관리자 샌드박스 메인 전용(네모네모 게임엔 미노출)
  if(typeof renderRallyArrows==='function') renderRallyArrows();   // 자동 배치 ON 시 등급별 랠리 화살표(드래그)
  updateHud();
  // 아군 유닛 림 색: 플레이어 구역 관전 시 관전 플레이어 색(+또렷하게), 그 외엔 내 색(은은)
  if(window.M3D && window.M3D.setPlayerRim){ if(G.tab==='Players') window.M3D.setPlayerRim(PLAYER_VIEW_COLORS[(G.curPlayer-1)%PLAYER_VIEW_COLORS.length], 0.9); else window.M3D.setPlayerRim(PLAYER_VIEW_COLORS[((G.myPlayer||1)-1)%PLAYER_VIEW_COLORS.length]); }   // 플레이어 구분=테두리(림) 색 하나로만 · 관전은 구별용으로 조금 더 강하게(0.9)
  const _specNum = (typeof specRemoteBoard==='function') ? specRemoteBoard() : null;   // 관전 중인 상대 번호
  if(typeof coopWatchSync==='function') coopWatchSync();   // 관전 대상이 바뀌었으면 알린다(바뀔 때만 전송)
  // 관전 전환(내 화면 ↔ 상대 화면) 시 이전 모델 즉시 제거(쓰러지는 사망모션 없이 바로 사라짐)
  const _deadSlot = (G.tab==='Players' && typeof slotState==='function' && slotState(G.curPlayer)!=='me' && !_specNum);   // 죽은/빈 자리 = 아무것도 없는 전장
  if(G.tab==='Main'||G.tab==='Players'){ const src=_specNum?('s'+_specNum):(_deadSlot?'dead':'main');
    if(src!==G._renderSrc){ if(window.M3D&&window.M3D.clearGameModels) window.M3D.clearGameModels(); if(typeof clearPlayerSel==='function') clearPlayerSel(); G._renderSrc=src; } }
  if(G.bossOpen){   // 공용 보스 토벌장 팝업 — 탭과 무관하게 아레나 렌더(위에 vBoss/컨트롤)
    drawBoss(dt); renderBossPanel(); updateCoopBossBar();
    const mcv=document.getElementById('cvMarine');
    if(window.M3D && window.M3D.ready() && !(G.opt&&G.opt.model3d===false)){ mcv.style.display='block'; window.M3D.syncBoss(BAW||GW, BAH||GH, dt); }
    else if(mcv) mcv.style.display='none';
    const fcv=document.getElementById('cvFx'); if(fcv){ fcv.style.display='block'; withBossFx(drawFx); }   // 토벌장 전용 이펙트만 렌더(메인 이펙트와 분리)
  }
  else if(G.tab==='Players' && _specNum){ renderSpectate(_specNum, dt); }   // 관전: 상대 보드를 3D+이펙트로 그대로 렌더
  else if(_deadSlot){ renderEmptySlot(); }   // 탈락·이탈·미입장 자리 — 유닛도 적도 새 생성도 없다
  else if(G.sandbox && G.tab==='Unit'){ fxLabRender(dt); }   // 🎆 이펙트 테스트베드(관리자 Unit 탭)
  else if(G.tab==='Build'){ renderBuildTab(dt); }   // 🏗 건설 탭(관리자·오토배틀 공용 단일 소스)
  else {
    if(G.tab==='Main'||G.tab==='Battle') drawMain();
    else if(G.tab==='Players') drawPlayer();
    else drawMiniMap();
    const mcv=document.getElementById('cvMarine');
    if(window.M3D && window.M3D.ready() && nemoOwns3D()){ const show=(G.tab==='Main'||G.tab==='Battle'||G.tab==='Unit'||G.tab==='Players') && !(G.opt&&G.opt.model3d===false); mcv.style.display=show?'block':'none';
      if(G.tab==='Main'||G.tab==='Battle'||G.tab==='Players'){
        window.__nemoView=!(G.sandbox||G.strike);   // 고정 슬롯 고스트는 네모네모 본편에서만(샌드박스·직스 제외)
        try{ window.M3D.sync(G.units, GW, GH, dt, G.sel, G.enemies, G.selEnemy, ((G.sandbox&&G.pcheck)?(G.pcScale||1):null), G.view); } finally{ window.__nemoView=false; } }   // 🎨 색 확인(관리자 샌드박스 전용)만 유닛 확대
      else if(G.tab==='Unit') window.M3D.syncShop(GW, GH, dt);
      }
    const fcv=document.getElementById('cvFx');  // 투사체 오버레이(메인·관전) / 업그레이드 가동 파티클
    if(G.tab==='Main'||G.tab==='Battle'||G.tab==='Players'){ fcv.style.display='block'; drawFx(); if(typeof drawSkillFx==='function') drawSkillFx(); stepMoveTrails(dt); if(G.tab==='Battle'&&typeof drawBattleFx==='function') drawBattleFx(dt); }   // 이동 트레일 + 스킬 + ⚔ 전장 발사 이펙트
    else if(G.tab==='Upgrade'){ fcv.style.display='none'; }
    else fcv.style.display='none';
  }
  requestAnimationFrame(loop);
}

// 🏗 건설 탭 렌더 — 건설 시간 진행 + 배치 건물/유닛 3D. nemo(관리자) 건설 탭과 오토배틀 건설지가 이 함수 하나를 공유한다.
function renderBuildTab(dt){
  {
    if(G.tech && typeof techTick==='function') techTick(dt);   // ⏱ 건설·생산 시간 진행
    const mcv=document.getElementById('cvMarine');
    if(window.M3D && window.M3D.ready() && G.tech && !(G.opt&&G.opt.model3d===false)){
      const race=G.tech.race;
      if(window.M3D.cstEnsure && G._cstLoaded!==race){ G._cstLoaded=race; window.M3D.cstEnsure(Object.values((typeof TECH_MODEL!=='undefined'&&TECH_MODEL[race])||{})); }
      if(window.M3D.ensureUnits && G._cstULoaded!==race){ G._cstULoaded=race; window.M3D.ensureUnits((typeof _techRaceUnitKeys==='function')?_techRaceUnitKeys(race):[]); }   // 일꾼·생산 유닛 3D 모델 로드
      if(window.M3D.cstEnsureRes && !G._cstResLoaded){ G._cstResLoaded=true; window.M3D.cstEnsureRes(); }   // 💎⛽ 자원 노드·운반 3D 모델 로드(1회)
      mcv.style.display='block';
      const _map=document.getElementById('cstMain'); const W=(_map&&_map.clientWidth)||GW||360, H=(_map&&_map.clientHeight)||GH||420; GW=W; GH=H;
      const _v=(G.tech&&G.tech.view)||{x:0.5,y:0.5,zoom:1};
      // 건물 base를 footprint 하단(중심 + ½h 아래)에 맞춤 → 건물이 자기 타일 위에 딱 올라감. yoff -3 = 모델 하단을 footprint 하단선보다 1px 위로(Y_DROP 2 보정)
      const _BLIFT=-3, _cwpx=_techCW()*W*_v.zoom;   // 셀 폭(px)
      const _cellK=_techCW()/((TECH_GRID.x1-TECH_GRID.x0)/TECH_GRID.cols);   // 격자 칸 크기 비(관리자 20칸 기준) — 건물은 발판에 맞춰 줄지만 유닛은 고정 크기라, 같은 비율을 곱해 맵이 달라도 건물 대비 유닛 크기가 같게 유지
      // 🗂 깊이 정렬 = 타일 행 기준(연속 y가 아님). 행마다 간격을 둬서 뒤 타일 건물이 앞 타일 유닛을 메시 두께로 덮지 못하게 함.
      // 같은 행이면 유닛·라바·알이 건물보다 앞(+0.5행) — 건물 바로 아래 칸에서 스폰되는 알/라바가 항상 보이도록.
      // ⚠ 카메라(z=800, near/far -2000~2000) 가시 범위 -1200~2800 안에 전 행이 들어와야 함 → 총 행수로 간격을 나눠 산출
      const _ZROWS=Math.max(1,(typeof _techRows==='function')?_techRows():28), _ZSTEP=Math.min(60, 2600/(_ZROWS+1));
      const _zOf=(wy,isB)=>{ const _r=Math.floor((wy-techY0())/_techCH()); return -1000+(_r+(isB?0:0.5))*_ZSTEP; };
      const _ZTOP=-1000+(_ZROWS+1)*_ZSTEP;   // 전 건물보다 앞(=공중 유닛 전용 평면). 가시범위(-1200~2800) 안
      // ✈ 공중 유닛 = 지상 정렬과 분리된 상단 평면. 건물 위를 지날 때 모델에 묻히지 않고 위로 지나감(공중끼리는 행 순서 유지)
      const _zAir=(wy)=>{ const _r=Math.floor((wy-techY0())/_techCH()); return _ZTOP+_r*_ZSTEP*0.5; };
      // 🥚 알은 자기를 낳은 해처리보다 반드시 앞 — 같은 행이라도 해처리 메시에 묻히지 않게 그 건물 z보다 한 칸 앞으로
      const _zEgg=(e)=>{ let z=_zOf(e.y,false); if(e.hatch!=null){ const _h=G.tech.ents.find(x=>x.eid===e.hatch&&x.type==='bldg');
        if(_h){ const _hf=(typeof _techFoot==='function')?_techFoot(race,_h.bk):{w:2,h:2}; const _hz=_zOf(_h.y+(_hf.h/2)*_techCH(),true);
          if(z<=_hz) z=_hz+_ZSTEP*0.5; } } return z; };   // 부모 해처리 앞으로 끌어올림(다른 건물과의 정렬은 그대로)
      const list=[]; for(const e of (G.tech.ents||[])){ if(e.type!=='bldg') continue; const mk=(TECH_MODEL[race]||{})[e.bk]; if(!mk) continue; const _cfg=(typeof CST_BLDG_CFG!=='undefined')?CST_BLDG_CFG[mk]:null; const _bf=(typeof _techFoot==='function')?_techFoot(race,e.bk):{w:2,h:2}; const _by=e.y+(_bf.h/2)*_techCH(); const _bp=(e.bt>0)?(e.waiting?0:Math.max(0,Math.min(1,1-e.bt/(e.btMax||1)))):null; list.push({uid:'cst_'+race+'_'+mk+'_'+e.eid, id:'cb_'+mk, x:(e.x-_v.x)*_v.zoom+0.5, y:(_by-_v.y)*_v.zoom+0.5, face:((race==='swarm')?0:(typeof CST_YAW!=='undefined'?CST_YAW:0))+((_cfg&&_cfg.f)||0), yoff:_BLIFT, dy:((_cfg&&_cfg.dy)||0), lift:(e._liftH||0)*TECH_LIFT_PX, fitW:_bf.w*_cwpx*CST_BVIS, sel:(G.tech&&G.tech.sel===e.eid), buildP:_bp, hidden:techFogHidden(e.x,e.y), z:_zOf(_by,true)}); }   // 🛫 lift=_liftH만큼 위로(fitW 지면고정 후 적용) · fitW=footprint 폭(px) · hidden=🌫️활성 시야 밖
      if(G.tech.arm && G.tech.armXY){ const _gmk=(TECH_MODEL[race]||{})[G.tech.arm]; if(_gmk && M3D.hasModel && M3D.hasModel('cb_'+_gmk)){ const _gcfg=(typeof CST_BLDG_CFG!=='undefined')?CST_BLDG_CFG[_gmk]:null; const _gf=(typeof _techFoot==='function')?_techFoot(race,G.tech.arm):{w:2,h:2}; const _gy=G.tech.armXY.y+(_gf.h/2)*_techCH(); list.push({uid:'__bghost__', id:'cb_'+_gmk, x:(G.tech.armXY.x-_v.x)*_v.zoom+0.5, y:(_gy-_v.y)*_v.zoom+0.5, face:((race==='swarm')?0:(typeof CST_YAW!=='undefined'?CST_YAW:0))+((_gcfg&&_gcfg.f)||0), yoff:_BLIFT, dy:((_gcfg&&_gcfg.dy)||0), fitW:_gf.w*_cwpx*CST_BVIS, ghost:true, z:_zOf(_gy,true) }); } }   // 반투명 회색 예비 건물(배치 미리보기)
      for(const e of (G.tech.ents||[])){ if(e.type!=='unit'&&e.type!=='worker'&&e.type!=='larva'&&e.type!=='egg') continue; if(e._inGas) continue; const mk=(typeof _techEntModel==='function')?_techEntModel(e):null; if(!mk) continue;   // 🚶 일꾼·생산 유닛·🐛라바·🥚알 3D(가스 채취 중=건물 안, 숨김)
        const _selu=(G.tech.sel===e.eid)||(G.tech.selU&&G.tech.selU.indexOf(e.eid)>=0);
        const _isAir=(typeof FXLAB_AIR!=='undefined')&&FXLAB_AIR.has(mk);   // 공중 유닛: 메인과 동일한 고정 부양(syncBuild airlift)
        list.push({uid:'tu_'+e.eid, id:mk, x:(e.x-_v.x)*_v.zoom+0.5, y:(e.y-_v.y)*_v.zoom+0.5, face:(e.face||0), yoff:(typeof TECH_UNIT_YOFF!=='undefined'?TECH_UNIT_YOFF:6), moving:(e.tx!=null), working:(e.type==='worker'&&!!e._working), sel:_selu, airlift:_isAir, yawFix:true, scl:(typeof TECH_USCALE!=='undefined'?TECH_USCALE:1)*((e.type==='worker')?TECH_WVIS:TECH_UVIS)*_cellK, hidden:techFogHidden(e.x,e.y), noShadow:_isAir, z:(_isAir?_zAir(e.y):(e.type==='egg'?_zEgg(e):_zOf(e.y,false)))}); }   // scl=건물 대비 유닛 절반 크기 · hidden=🌫️활성 시야 밖 · noShadow=공중 유닛은 3D 원형 그림자 끄고 DOM 지면 그림자로 대체   // face = 이동방향 + 모델별 정면 보정(메인과 동일)
      if(M3D.hasModel && M3D.hasModel('res_cn')){   // 💎⛽ 자원 3D: 미네랄 노드 · 가스 노드 · 일꾼 운반물(안개 시야 밖이면 숨김)
        for(const m of (G.tech.minerals||[])){ list.push({uid:'mn_'+m.eid, id:'res_cn', x:(m.x-_v.x)*_v.zoom+0.5, y:(m.y-_v.y)*_v.zoom+0.5, face:Math.PI, sel:!!(G.tech.selRes&&G.tech.selRes.kind==='mineral'&&G.tech.selRes.eid===m.eid), hidden:techFogHidden(m.x,m.y), z:_zOf(m.y,false)}); }   // 미네랄 180° 회전 · sel=유닛/건물과 동일한 3D 하단 링
        const _gasB=G.tech.ents.some(be=>be.type==='bldg'&&((techGetBldg(race,be.bk)||{}).gas));
        if(!_gasB && !techWallet()){ const _gx=TECH_GRID.x0+(TECH_GAS.c0+TECH_GAS.w/2)*_techCW(), _gy=techY0()+(TECH_GAS.r0+TECH_GAS.h-0.55)*_techCH(); list.push({uid:'gz_res', id:'res_en', x:(_gx-_v.x)*_v.zoom+0.5, y:(_gy-_v.y)*_v.zoom+0.5, face:Math.PI/2, fitW:TECH_GAS.w*_cwpx, sel:!!(G.tech.selRes&&G.tech.selRes.kind==='gas'), hidden:techFogHidden(_gx,_gy), z:_zOf(_gy,false)}); }   // 가스 건물 없을 때만 · sel=3D 하단 링
        for(const e of (G.tech.ents||[])){ if(e.type==='worker'&&e._carry&&!e._inGas){ const _cf=e.face||0, _cd=0.014; list.push({uid:'carry_'+e.eid, id:((e._cKind||e._gKind)==='gas'?'res_ec':'res_cc'), x:((e.x+Math.sin(_cf)*_cd)-_v.x)*_v.zoom+0.5, y:((e.y+Math.cos(_cf)*_cd)-_v.y)*_v.zoom+0.5, yoff:-3, hidden:techFogHidden(e.x,e.y), z:_zOf(e.y,false)+1}); } }   // 운반 청크 = 일꾼 정면(진행 방향) 앞·손 높이 — 앞에서 들고 가는 느낌
      }
      window.M3D.syncBuild(list, W, H, dt, _v.zoom);
    // ⛔ 캠프 진입 애니(.campIn) 중에는 끄지 않는다 — 끄는 순간 그 프레임에 애니가 죽어
    //    맵만 다가오고 3D 층은 멈춘 채로 남는다(3D 가 늦게 뜨면 건물이 도중에 뚝 나타난다).
    } else if(mcv && !mcv.classList.contains('campIn')) mcv.style.display='none';
    const _fcv=document.getElementById('cvFx');   // 이동 트레일(메인과 동일 이펙트) — 3D 표시 중일 때만
    if(_fcv){ if(mcv.style.display==='block' && typeof techMoveTrails==='function'){ _fcv.style.display='block'; techMoveTrails(dt); } else _fcv.style.display='none'; }
  }
}
window.addEventListener('resize',()=>{ if(G.strike) return; if(G.tab==='Main'){drawMain();} if(G.tab==='Unit'&&!G.sandbox){drawProd();renderClock();} if(G.tab==='Upgrade')drawUpg(); if(G.tab==='Players')drawPlayer(); });
window.addEventListener('load',()=>{ drawMain(); updateHud(); bootApp(); initChat(); if(typeof _sfxInit==='function') _sfxInit(); if(typeof buildGachaDex==='function') buildGachaDex(); requestAnimationFrame(loop); });

// ════════════════════════════════════════════════════════════════
// 컴퓨터가 싸운다(직스) — nemo 셸(상단 HUD·하단 탭·미니맵·채팅·프로필) 재사용 게임플레이 모듈.
// 전투는 #cvMain에 2D 렌더. loop() 최상단 if(G.strike) 분기로 nemo 로직을 건너뛰고 strikeFrame 실행.
// ════════════════════════════════════════════════════════════════
let STK=null, _stkDrag=null, _stkPtrs=new Map(), _stkPinch=null;
// 크기 비교용 샘플 유닛(임시) — 다음 단계에서 실제 전투 유닛으로 대체. nm 없으면 U[id].name 폴백
const STRIKE_SAMPLE=[{id:'marine'},{id:'ghost'},{id:'hydra'},{id:'dragoon'},{id:'goliath'},{id:'archon'},{id:'tank',nm:'중전차'},{id:'skyguard',nm:'템페스트'}];
// 전장 줌 한계: 최소(가장 축소)=1.2, 기본 시작=1.2, 최대(가장 확대)=2.5
const STK_MINZOOM=1.2, STK_DEFZOOM=1.2, STK_MAXZOOM=2.5, BUILD_MAXZOOM=3;
// 오토배틀 전장 렌더 배율 — 고화질=3D 살짝 슈퍼샘플(1.2×)·2D 네이티브 / 절전=저해상도(0.6×). 오직 직스 전장에만 적용, 건설지·다른 맵·초상엔 안 준다
const STK_RES={ high:{cv:1, gl:1.2}, saver:{cv:0.6, gl:0.6} };
function strikeResMode(){ return (typeof G!=='undefined'&&G.opt&&G.opt.quality==='saver')?'saver':'high'; }
const STK_MAP_PAD=0.22;      // 전장 사방 여백(화면 높이 비율) — 맵을 그만큼 확장해서 여유 공간 확보
const STK_FX_SPAN=1400;      // 유닛별 이펙트 좌표계: 월드 1400 = 관리자 화면 폭 1.0 (오프셋·크기를 관리자와 같은 체감으로)
const STK_UNIT_SCALE=1.35;   // 직스 전투 유닛 3D 확대 배율(신전 제외) — 전장에서 잘 보이게
const BUILD_UNIT=48;         // 건설 건물 크기 = 스냅 격자(월드/풋프린트 칸) — fp가 정수 비율이라 격자에 딱 맞게 타일링
// 종족(컴퓨터가 싸운다): 진입 시 선택 → 그 종족 유닛만 소환. units=현 보유 전투유닛 기준 로스터
// (프로토스·저그는 다음 단계에서 가챠 유닛으로 보강 예정 — 균형)
// 직스 전용 유닛 스탯(네모 U 테이블과 독립 — 단독 밸런스 튜닝). hp/dmg/rng/spd=절대값(월드 0..4800 픽셀), cd=초, splash=광역 반경(px), melee=근접
const STK_UNITS={
  // 🛡 유니온 — 보병·기계 (저가 원거리 / 기계 탱커 / 공성) · 공격 이펙트는 ATK_STYLE(공용 FX 코어)에서 id로 매핑
  marine:    {name:'레인저',    ico:'🪖', cost:100, hp:130, dmg:16, rng:200, cd:0.85, spd:340, size:14},
  medic:     {name:'의무병',    ico:'💉', cost:110, hp:140, dmg:0, rng:0, cd:0, spd:340, size:14},   // 무공격 지원 — HEALER 분기로 바이오닉 치유(strikeHealStep)
  goliath:   {name:'기갑병', ico:'⚙️', cost:220, hp:380, dmg:35, rng:235, cd:1.30, spd:155, size:21},   // 개별튜닝: 종족내 과약(0.79) → dmg30→35
  tank:      {name:'공성전차',   ico:'🛡', cost:350, hp:430, dmg:72, rng:330, cd:2.30, spd:115, size:24, splash:160},
  // 🔮 에테리얼 — 사이오닉 (원거리 포격 / 근접 돌격 / 광역 탱커)
  dragoon:   {name:'센티넬',    ico:'🤖', cost:200, hp:350, dmg:24, sdmg:32, scd:1.0, rng:245, cd:1.25, spd:230, size:18},   // 개별튜닝: 종족내 과강(1.82) → hp380→350·sdmg38→32
  blade:     {name:'광전사',      ico:'⚔️', cost:120, hp:240, dmg:22, sdmg:26, rng:49,  cd:0.80, spd:340, size:17, melee:true},   // 개별튜닝: 종족내 극단 과강(2.90) → hp360→240·sdmg42→26(2차 폴리시)
  archon:    {name:'보이드',    ico:'🔮', cost:340, hp:400, dmg:34, rng:130, cd:1.05, spd:185, size:23, splash:120},
  // 🦎 스웜 — 유기체 (저가 원거리 / 근접 다수 / 도트 공성)
  hydra:     {name:'스파이크',      ico:'🦎', cost:110, hp:215, dmg:24, rng:215, cd:0.95, spd:300, size:17},   // 개별튜닝: 종족내 과약(0.45) → dmg18→24
  matron:    {name:'여제', ico:'🧬', cost:210, hp:410, dmg:22, rng:49,  cd:0.95, spd:205, size:22, melee:true},   // 개별튜닝: 종족내 과강(1.48) → hp470→410·dmg26→22
  thornqueen:{name:'가시여왕',   ico:'🐛', cost:330, hp:360, dmg:52, rng:300, cd:1.70, spd:125, size:22, splash:150},   // 개별튜닝: 종족내 과약(0.39) → dmg42→52
  // ── 건설지 확장 유닛(직스 밸런스) — 모델 기존 재사용 ──
  ghost:     {name:'저격수',      ico:'👻', cost:130, hp:150, dmg:28, sdmg:34, scd:0.9, rng:260, cd:1.40, spd:300, size:15},   // 유니온 저격 보병 · 밸런스: hp150·실효공격34·실효쿨0.9(scd, 공속↑)
  snapper:   {name:'척후병',    ico:'🐛', cost:90,  hp:150, dmg:19, rng:41, cd:0.70, spd:360, size:15, melee:true},   // 스웜 고속 소형 다수(근접) · 개별튜닝: 과약(0.32) → hp130→150·dmg14→19
  stinger:   {name:'자폭충',    ico:'🐝', cost:160, hp:90,  dmg:52, rng:210, cd:1.60, spd:300, size:15, splash:120},   // 스웜 광역 유리대포 · 개별튜닝: 과약(0.35) → dmg40→52
  falcon:    {name:'팔콘',      ico:'🦅', cost:150, hp:170, dmg:22, rng:240, cd:1.00, spd:320, size:17},   // 에테리얼 기동 원거리
  // ── 관리자 맵 유닛 이식(건설지 확장) — id=gmodel 키 → 모델·이펙트·부양 자동 연결 ──
  // 🛡 유니온 확장
  machinegun:{name:'화력병',      ico:'🔫', cost:130, hp:210, dmg:11, sdmg:22, rng:210, cd:0.45, spd:200, size:18},   // 고속 기관총 · 밸런스 버프: hp180→210·실효공격→22(sdmg)
  racer:     {name:'레이서',    ico:'🏍', cost:120, hp:210, dmg:22, sdmg:30, rng:190, cd:0.90, spd:330, size:18},   // 경량 고속 차량 · 밸런스 버프: hp150→210·실효공격→30(sdmg)
  skyguard:  {name:'전투기',  ico:'✈️', cost:200, hp:280, dmg:28, sdmg:44, rng:250, cd:1.10, spd:300, size:20},   // 공중 전투기 · 밸런스: 실효공격54→44(sdmg) 미세 너프
  hellfire:  {name:'폭격기',  ico:'🔥', cost:220, hp:240, dmg:34, sdmg:50, rng:240, cd:1.40, spd:240, size:18, splash:130},   // 공중 미사일(광역) · 밸런스 버프: hp200→240·실효공격→50(sdmg)
  dreadnought:{name:'전함',ico:'💥', cost:360, hp:560, dmg:60, sdmg:48, rng:300, cd:2.20, spd:130, size:24, splash:150},   // 공중 중포함 · 밸런스: 무패라 hp620→560·실효공격52→48(sdmg)
  aegis:     {name:'지원 정찰기',    ico:'🛡', cost:480, hp:1400,dmg:14, rng:230, cd:1.20, spd:110, size:22},   // 공중 방벽(초고체력 저공격)
  // 🦎 스웜 확장
  venom:     {name:'산성충',      ico:'🐛', cost:130, hp:200, dmg:29, rng:230, cd:1.00, spd:260, size:18},   // 공중 산성 포자 · 개별튜닝: 과약(0.42) → dmg22→29
  medusa:    {name:'군단여왕',    ico:'🐍', cost:240, hp:400, dmg:34, rng:240, cd:1.30, spd:180, size:20, splash:120},   // 밸런스: 33% → hp340→400   // 공중 사이오닉 광역
  wyvern:    {name:'비행충',    ico:'🐲', cost:420, hp:720, dmg:70, sdmg:95, rng:250, cd:1.30, spd:240, size:22},   // 공중 준보스(모프 유닛·희소) · 강한 프리미엄 유지: hp720·실효공격95(sdmg)
  behemoth:  {name:'포격충',  ico:'🦣', cost:620, hp:650, dmg:95, sdmg:105, rng:300, cd:2.40, spd:120, size:26, splash:180},   // 밸런스: 최종테크 곡선폭증 완화 hp900→650·실효공격150→105(sdmg)   // 공중 대형 보스(광역)
  // 🔮 에테리얼 확장
  skydancer: {name:'요격기',ico:'💃', cost:180, hp:240, dmg:24, rng:250, cd:1.00, spd:320, size:18},   // 공중 고속 기동
  archangel: {name:'모함',  ico:'👼', cost:420, hp:460, dmg:32, sdmg:28, scd:1.4, rng:280, cd:1.60, spd:140, size:24, splash:150},   // 공중 성채(광역) · 개별튜닝: 종족내 과약(0.48) → sdmg18→28
  kronos:    {name:'전함',  ico:'⏳', cost:340, hp:520, dmg:42, rng:300, cd:1.80, spd:150, size:22, splash:140},   // 공중 시공 포격(광역)
  // ── 신규 전투 유닛(6a7cff7 이식) — 근접형 3종 · 지원형(메딕·라바·하이템플러)은 무공격이라 직스 생산 제외(연습 랩 전용) ──
  broodling:  {name:'스웜링',  ico:'🐛', cost:70,  hp:105,  dmg:17, rng:60, cd:0.60, spd:380, size:12, melee:true},   // 스웜 초저가 고속 근접 다수 · 개별튜닝: 극단 과약(0.10) → hp80→105·dmg12→17
  ultralisk:  {name:'돌격괴수',ico:'🐂', cost:560, hp:1100, dmg:80, rng:80, cd:1.40, spd:150, size:26, melee:true},   // 스웜 대형 근접 보스(고체력)
  dark_templar:{name:'다크세이지', ico:'🌑', cost:210, hp:240,  dmg:48, rng:62, cd:1.05, spd:320, size:15, melee:true},   // 에테리얼 고화력 고속 근접 암살
  // ── 🐺 페럴(수인) — 최단 사거리 · 최고 기동 · 광폭화(처치 스택). RACES.md §5 의 hp/cost 를 그대로 옮긴 것 ──
  //    ⚠ rng/cd/spd 는 표시값이다. 실전투는 strikeUnitStats 가 U 에서 환산한다(U.range×850 · U.cd/22 · U.moveSpd×1800).
  //    ⚠ 대공 전용 유닛(U.dmg=0 · airDmg 만 있음)은 오토배틀에 공중/지상 구분이 없어(RACES.md §9-4) sdmg 로 실효 공격을 준다.
  wolfrunner:   {name:'추격수',    ico:'🐕', cost:95,  hp:170, dmg:14, rng:38,  cd:0.82, spd:432, size:15, melee:true},
  thornspitter: {name:'가시 사수',   ico:'🦔', cost:105, hp:150, dmg:16, rng:170, cd:1.09, spd:324, size:15},
  clawfighter:  {name:'포식수', ico:'🦡', cost:130, hp:250, dmg:20, rng:38,  cd:0.91, spd:414, size:16, melee:true},
  hornedcharger:{name:'돌진수',   ico:'🐗', cost:190, hp:360, dmg:26, rng:43,  cd:1.27, spd:396, size:19, melee:true},
  howlslinger:  {name:'대공 투석수', ico:'🐒', cost:140, hp:190, dmg:30, sdmg:30, rng:187, cd:1.18, spd:324, size:16},   // 대공 전용(U.dmg 0) → sdmg=airDmg
  venomfang:    {name:'맹독수',     ico:'🐍', cost:150, hp:300, dmg:18, rng:153, cd:1.00, spd:360, size:17},
  stalkercat:   {name:'암살수',    ico:'🦗', cost:200, hp:330, dmg:28, rng:43,  cd:0.82, spd:504, size:16, melee:true},
  alphawolf:    {name:'우두머리',    ico:'🐺', cost:280, hp:520, dmg:34, rng:43,  cd:0.91, spd:432, size:20, melee:true},
  wyvernrider:  {name:'폭격 기수',ico:'🦅',cost:330, hp:640, dmg:44, rng:136, cd:1.00, spd:468, size:20},
  skytalon:     {name:'하늘 사냥수', ico:'🦇', cost:290, hp:520, dmg:38, sdmg:38, rng:170, cd:0.73, spd:540, size:18},   // 대공 전용(U.dmg 0) → sdmg=airDmg
  stormroc:     {name:'뇌격수',   ico:'🌩', cost:430, hp:820, dmg:58, rng:187, cd:1.18, spd:396, size:24, splash:130},
  // ── 🗿 콜로서스(거신) — 최장 사거리 · 전개(deploy) · 최소 사거리(minRange). 붙으면 무력해지는 것이 페럴 상성의 축 ──
  gunner:       {name:'포대병',      ico:'🔩', cost:120, hp:210, dmg:22, rng:221, cd:1.36, spd:252, size:16},
  guardwalker:  {name:'가드 워커',   ico:'🦿', cost:140, hp:400, dmg:20, rng:51,  cd:1.00, spd:360, size:18, melee:true},
  twincannon:   {name:'트윈 캐논',   ico:'🎯', cost:250, hp:420, dmg:34, rng:255, cd:1.55, spd:216, size:20, splash:120},
  flakbattery:  {name:'플랙 배터리', ico:'🎆', cost:190, hp:330, dmg:36, sdmg:36, rng:238, cd:0.91, spd:234, size:18},   // 대공 전용(U.dmg 0) → sdmg=airDmg
  railgun:      {name:'레일건 플랫폼',ico:'📡',cost:400, hp:500, dmg:46, rng:306, cd:1.82, spd:180, size:21},
  arclight:     {name:'아크 라이트', ico:'⚡', cost:250, hp:520, dmg:30, sdmg:30, rng:204, cd:0.73, spd:468, size:18},   // 대공 전용(U.dmg 0) → sdmg=airDmg
  siegecolossus:{name:'시즈 콜로서스',ico:'🗿',cost:620, hp:900, dmg:88, rng:374, cd:2.36, spd:198, size:24, splash:150},
  skylance:     {name:'스카이 랜스', ico:'🔱', cost:450, hp:760, dmg:50, rng:255, cd:1.27, spd:324, size:22, splash:140},
};
const STK_RACES={
  terran:  { key:'terran',  name:'유니온',   sub:'인간', desc:'보병·기계', col:'#4aa8ff', icon:'🛡️', units:['marine','ghost','machinegun','racer','goliath','tank','skyguard','hellfire','dreadnought'] },
  protoss: { key:'protoss', name:'에테리얼', sub:'외계', desc:'사이오닉', col:'#ffc040', icon:'🔮', units:['blade','dragoon','archon','falcon','skydancer','kronos','archangel','dark_templar'] },
  zerg:    { key:'zerg',    name:'스웜',     sub:'군체', desc:'유기체',   col:'#9fd356', icon:'🦎', units:['hydra','snapper','thornqueen','matron','venom','stinger','medusa','broodling','ultralisk'] },
  // 🐺🗿 오각형 상성 2종족(RACES.md §1) — 키가 RACE_OF/TECH_TREE와 같다(기존 3종족만 terran/zerg/protoss 별칭을 쓴다)
  feral:   { key:'feral',   name:'페럴',     sub:'수인', desc:'야수 무리', col:'#c98b5a', icon:'🐺', units:['wolfrunner','thornspitter','clawfighter','hornedcharger','howlslinger','venomfang','stalkercat','alphawolf','wyvernrider','skytalon','stormroc'] },
  colossus:{ key:'colossus',name:'콜로서스', sub:'거신', desc:'중장 포격', col:'#9aa6b2', icon:'🗿', units:['gunner','guardwalker','twincannon','flakbattery','railgun','arclight','siegecolossus','skylance'] },
};
const STK_RACE_ORDER=['terran','zerg','protoss','feral','colossus'];   // 표시 순서: 유니온 · 스웜 · 에테리얼 · 페럴 · 콜로서스 (관리자와 통일)
// 종족별 생산 건물(스타식 이름) → 건물마다 출격 주기에 배정 유닛을 지정 수량만큼 자동 생산
// fp:[w,h] = 건물 풋프린트(칸 단위, 30×20 그리드). 비율 다양화: 2×2(1:1)·2×3(1:1.5)·3×2·3×3·3×4(1.5:2)·4×3·4×4·4×5(2:2.5 최대)
const STK_BUILDINGS={
  terran:[
    {key:'supply',  name:'보급소',        ico:'🏠', cost:250, fp:[3,2], produces:[{id:'marine',     n:3}]},
    {key:'barracks',name:'병영',          ico:'🏛', cost:320, fp:[4,4], produces:[{id:'ghost',      n:2}]},
    {key:'bunker',  name:'벙커',          ico:'🧱', cost:300, fp:[3,2], produces:[{id:'machinegun', n:2}]},
    {key:'machshop',name:'정비소',        ico:'🏍', cost:320, fp:[4,3], produces:[{id:'racer',      n:2}]},
    {key:'factory', name:'기갑 공장',      ico:'🏭', cost:440, fp:[4,4], produces:[{id:'goliath',    n:2}]},
    {key:'armory',  name:'무기고',        ico:'🛠', cost:480, fp:[3,2], produces:[{id:'tank',       n:1}]},
    {key:'starport',name:'비행장',        ico:'✈️', cost:460, fp:[4,4], produces:[{id:'skyguard',   n:2}]},
    {key:'missile', name:'미사일 베이',   ico:'🚀', cost:500, fp:[3,2], produces:[{id:'hellfire',   n:2}]},
    {key:'vessel',  name:'배슬 야드',     ico:'💥', cost:640, fp:[4,3], produces:[{id:'dreadnought',n:1}]},
    {key:'aegis',   name:'이지스 도크',   ico:'🛡', cost:760, fp:[3,2], produces:[{id:'aegis',      n:1}]},
  ],
  zerg:[
    {key:'pool',    name:'번식지',        ico:'🥚', cost:250, fp:[3,2], produces:[{id:'hydra',      n:3}]},
    {key:'creep',   name:'점막탑',        ico:'🟢', cost:240, fp:[3,2], produces:[{id:'snapper',    n:3}]},
    {key:'den',     name:'스파이크 덴',     ico:'🕳', cost:340, fp:[4,3], produces:[{id:'venom',      n:2}]},
    {key:'garden',  name:'가시 정원',     ico:'🌵', cost:420, fp:[4,4], produces:[{id:'thornqueen', n:2}]},
    {key:'spire',   name:'첨탑',          ico:'🗼', cost:440, fp:[4,4], produces:[{id:'stinger',    n:2}]},
    {key:'gspire',  name:'거대 첨탑',     ico:'🐍', cost:520, fp:[3,2], produces:[{id:'medusa', n:1}]},
    {key:'cavern',  name:'울트라 케이번', ico:'🦴', cost:480, fp:[4,4], produces:[{id:'matron',     n:1}]},
    {key:'nest',    name:'비행충 소굴',   ico:'🐲', cost:720, fp:[4,3], produces:[{id:'wyvern',     n:1}]},
    {key:'pit',     name:'포격충 굴',   ico:'🦣', cost:840, fp:[4,4], produces:[{id:'behemoth',   n:1}]},
    {key:'broodnest',name:'스웜링 둥지', ico:'🐛', cost:220, fp:[3,2], produces:[{id:'broodling',  n:4}]},
    {key:'ultracav',name:'돌격괴수 소굴',ico:'🐂', cost:820, fp:[4,4], produces:[{id:'ultralisk',  n:1}]},
  ],
  protoss:[
    {key:'gateway', name:'지상 차원문',       ico:'🌀', cost:250, fp:[3,2], produces:[{id:'blade',     n:3}]},
    {key:'core',    name:'사이버 코어',       ico:'💠', cost:340, fp:[4,3], produces:[{id:'dragoon',   n:2}]},
    {key:'robo',    name:'로봇 제작소',       ico:'🤖', cost:440, fp:[4,4], produces:[{id:'archon',    n:1}]},
    {key:'stargate',name:'공중 차원문',       ico:'✨', cost:420, fp:[4,4], produces:[{id:'falcon',    n:2}]},
    {key:'beacon',  name:'함대 관제',         ico:'💃', cost:460, fp:[3,2], produces:[{id:'skydancer', n:2}]},
    {key:'tribunal',name:'심판정',            ico:'⏳', cost:580, fp:[4,3], produces:[{id:'kronos',    n:1}]},
    {key:'sanctum', name:'아크엔젤 성소',     ico:'👼', cost:700, fp:[4,4], produces:[{id:'archangel', n:1}]},
    {key:'archives',name:'기록 보관소',       ico:'🌑', cost:360, fp:[4,3], produces:[{id:'dark_templar', n:2}]},
  ],
  // 🐺 페럴 · 🗿 콜로서스 — cost = 골드 환산(m + g×1.2, RACES.md §9-1b). 배출 유닛·수량의 단일 소스는 TECH_BLDG_UNIT 이고 여기는 관전 데모용 표시.
  feral:[
    {key:'bonepile', name:'뼈 무덤',      ico:'🦴', cost:110, fp:[3,2], produces:[{id:'wolfrunner',  n:3}]},
    {key:'clawpit',  name:'발톱 구덩이',  ico:'🕳', cost:175, fp:[3,2], produces:[{id:'clawfighter', n:2}]},
    {key:'spitpit',  name:'투척 구덩이',  ico:'🪃', cost:185, fp:[4,3], produces:[{id:'venomfang',   n:2}]},
    {key:'huntpen',  name:'사냥 우리',    ico:'🏕', cost:190, fp:[4,3], produces:[{id:'thornspitter',n:2}]},
    {key:'windcliff',name:'바람 절벽',    ico:'🪶', cost:270, fp:[4,4], produces:[{id:'wyvernrider', n:1}]},
    {key:'alphaden', name:'알파 소굴',    ico:'🐺', cost:320, fp:[4,4], produces:[{id:'alphawolf',   n:1}]},
    {key:'beastpit', name:'야수 구덩이',  ico:'🦁', cost:440, fp:[4,5], produces:[{id:'stormroc',    n:1}]},
  ],
  colossus:[
    {key:'strut',    name:'지지 기둥',    ico:'🏗', cost:85,  fp:[3,2], produces:[{id:'gunner',      n:3}]},
    {key:'assembly', name:'조립 공장',    ico:'⚙️', cost:125, fp:[4,3], produces:[{id:'guardwalker', n:2}]},
    {key:'ballistics',name:'탄도 연구소', ico:'📐', cost:150, fp:[3,2], produces:[{id:'twincannon',  n:1}]},
    {key:'flakworks',name:'대공 공작소',  ico:'🎆', cost:215, fp:[4,3], produces:[{id:'flakbattery', n:1}]},
    {key:'skydock',  name:'상공 도크',    ico:'🛰', cost:270, fp:[4,4], produces:[{id:'skylance',    n:1}]},
    {key:'heavyyard',name:'중장비 야드',  ico:'🛠', cost:430, fp:[4,4], produces:[{id:'siegecolossus',n:1}]},
  ],
};
// 건물 key → 3D 모델 키(건물 모델 추가 시 여기에 매핑). 매핑/로드 전엔 2D 렌더로 폴백.
// (제거) STK_BUILD_REQ·_stkBuiltKeys/_stkReqMet/_stkBuildName — 구 건설 선행조건(관리자 TECH_TREE.req/_techReqMet으로 대체)
// 건물 key → 관리자 건설 3D 모델 키(cb_ 접두 = 관리자 TECH_MODEL/CST_BLDG_CFG와 동일 에셋). 미매핑·미로드 시 2D 이모지 폴백.
const STK_BUILD_MODEL={
  // 테란 → 유니온
  command:'cb_union_command_center', supply:'cb_union_supply_depot', barracks:'cb_union_barracks', bunker:'cb_union_bunker',
  machshop:'cb_union_machine_shop', factory:'cb_union_factory', armory:'cb_union_armory', starport:'cb_union_starport',
  missile:'cb_union_missile_turret', vessel:'cb_union_science_facility',
  // 저그 → 스웜
  hatchery:'cb_swarm_hatchery', pool:'cb_swarm_spawning_pool', creep:'cb_swarm_creep_colony', den:'cb_swarm_hydralisk_den',
  garden:'cb_swarm_sunken_colony', spire:'cb_swarm_spire', gspire:'cb_swarm_greater_spire', cavern:'cb_swarm_ultralisk_cavern', nest:'cb_swarm_queens_nest',
  // 프로토스 → 에테리얼
  nexus:'cb_aetherial_nexus', gateway:'cb_aetherial_gateway', core:'cb_aetherial_cybernetics_core', robo:'cb_aetherial_robotics_facility',
  stargate:'cb_aetherial_stargate', beacon:'cb_aetherial_fleet_beacon', tribunal:'cb_aetherial_arbiter_tribunal', archives:'cb_aetherial_templar_archives', sanctum:'cb_aetherial_temple_of_adun',
};
// (제거) STK_WORKER_MODEL·STK_MAIN — 구 오토배틀 전용 건설 잔해(관리자 G.tech 통합으로 미사용)
