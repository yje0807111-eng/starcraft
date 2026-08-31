/* ============================================================================
 * 18-strike.js — 직스(오토배틀) — 전장 배경 · 특수무기 · 라이프사이클 · 전투 시뮬 · FX 랩
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// 카메라 고정 타일 패턴(전장 지형) — 월드 원점(0,0)이 화면 (ox,oy)에 오도록 패턴 변환
// 패턴 캐시(모바일 성능) — createPattern은 1회만, 매 프레임엔 setTransform만
const _stkPat={}, _stkVig={};
function strikePattern(ctx,img){ if(!img||!img.complete||!img.naturalWidth) return null; const k=img.src; if(!_stkPat[k]) _stkPat[k]=ctx.createPattern(img,'repeat'); return _stkPat[k]; }
function strikeDrawGround(ctx,W,H,S,scale){ strikeAssetsReady();   // 여기서 처음 받기 시작한다(부팅에 안 건다)
  const img=STRIKE_GROUND, tilePx=460*scale;
  const _wx=(0-S.cam.x)*scale+W/2, _wy=(0-S.cam.y)*scale+H/2, _wp=S.world*scale;   // 월드 사각형(화면 좌표) — 바깥은 여백
  ctx.fillStyle='#05080c'; ctx.fillRect(0,0,W,H);   // 맵 바깥 여백(빈 공간)
  ctx.save(); ctx.beginPath(); ctx.rect(_wx,_wy,_wp,_wp); ctx.clip();   // 지형·진영 워시는 맵 안쪽에만
  const ox=(0-S.cam.x)*scale+W/2, oy=(0-S.cam.y)*scale+H/2, p=strikePattern(ctx,img);
  if(p&&tilePx>4){ const s=tilePx/img.naturalWidth; if(p.setTransform) p.setTransform(new DOMMatrix([s,0,0,s,ox,oy])); ctx.fillStyle=p; } else ctx.fillStyle='#1a1d14';
  ctx.fillRect(0,0,W,H);
  // ⭐ 매크로 오버레이 — 월드 전체 크기의 부드러운 얼룩 지도를 얹어 **타일 반복감을 깬다**(2026-08-30).
  //    타일은 어디를 봐도 같아서 넓게 보면 되풀이가 그대로 읽힌다. 이 한 장이 지형에 지역성을 준다.
  //    soft-light 라 밝기만 흔들고 색은 타일이 갖는다 — 그래서 오버레이는 흐릿해도 된다(768px).
  if(_imgOk(STRIKE_MACRO)){ ctx.save(); ctx.globalCompositeOperation='soft-light'; ctx.globalAlpha=0.85;
    ctx.drawImage(STRIKE_MACRO,_wx,_wy,_wp,_wp); ctx.restore(); }
  // 영역 워시: 좌하(유니온/파랑) ↔ 우상(적/빨강) 진영색으로 은은히 물듦(전황 감각)
  const gw=ctx.createLinearGradient(0,H,W,0);
  gw.addColorStop(0,'rgba(70,150,230,.11)'); gw.addColorStop(0.5,'rgba(0,0,0,0)'); gw.addColorStop(1,'rgba(230,80,92,.11)');
  ctx.fillStyle=gw; ctx.fillRect(0,0,W,H);
  ctx.restore();   // 클립 해제(비네팅·태양광은 화면 전체)
  { ctx.save(); ctx.strokeStyle='rgba(150,190,230,.16)'; ctx.lineWidth=Math.max(1.2, 2*scale*6); ctx.strokeRect(_wx,_wy,_wp,_wp);   // 맵 경계 마감
    ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.lineWidth=Math.max(1, 1*scale*6); ctx.strokeRect(_wx-1,_wy-1,_wp+2,_wp+2); ctx.restore(); }
  // 비네팅 + 태양광(따뜻한 사선 조명): W,H 바뀔 때만 재생성(캐시)
  const vk=W+'x'+H; if(_stkVig.k!==vk){ const v=ctx.createRadialGradient(W/2,H*0.5,Math.min(W,H)*0.3,W/2,H*0.5,Math.max(W,H)*0.75); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.42)'); _stkVig.k=vk; _stkVig.v=v;
    const su=ctx.createRadialGradient(W*0.3,H*0.2,0,W*0.3,H*0.2,Math.max(W,H)*0.95); su.addColorStop(0,'rgba(255,238,198,.11)'); su.addColorStop(0.5,'rgba(255,228,188,.035)'); su.addColorStop(1,'rgba(255,228,188,0)'); _stkVig.su=su; }
  ctx.fillStyle=_stkVig.su; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=_stkVig.v; ctx.fillRect(0,0,W,H); }
// 사각 영역을 타일 패턴으로 채움(건설 보드)
function strikeTileRect(ctx,x,y,w,h,img,tilePx){ ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  const p=strikePattern(ctx,img); if(p){ const s=tilePx/img.naturalWidth; if(p.setTransform) p.setTransform(new DOMMatrix([s,0,0,s,x,y])); ctx.fillStyle=p; } else ctx.fillStyle='#16242e';
  ctx.fillRect(x,y,w,h); ctx.restore(); }
// ── 전장 배경 데코(코너 채움) + 떠다니는 먼지 — 1회 시드 생성 후 재사용(성능) ──
function _stkRnd(seed){ let s=seed>>>0; return function(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
function strikeGenScenery(world){ const rnd=_stkRnd(20260701), props=[];
  for(let i=0;i<80;i++){ const rx=rnd(), ry=rnd(); if(Math.abs(rx+ry-1)<0.30) continue;   // 중앙 레인(반대각선) 밴드 회피 → 빈 코너만 채움
    // ⛔ crater 는 뺐다(2026-08-30 사용자) — 스프라이트가 「털 난 구멍」처럼 보였다.
    //    폴백 그리기 코드와 분기는 남겨 둔다(되살리려면 여기 분포만 되돌리면 된다).
    const kk=rnd(), t=kk<0.5?'rock':(kk<0.82?'tuft':'bone');
    // v = 스프라이트 시트의 어느 칸(2×2 네 변형). 같은 그림이 수십 개 깔리면 눈에 띄어서 넷을 돌린다.
    props.push({x:rx*world, y:ry*world, r:0.6+rnd()*1.3, t:t, a:rnd()*6.28, v:Math.floor(rnd()*4)}); }
  const motes=[]; for(let i=0;i<34;i++) motes.push({x:rnd()*world, y:rnd()*world, ph:rnd()*6.28, sp:0.3+rnd()*0.5, amp:60+rnd()*90});
  return {props:props, motes:motes}; }
// 데코 스프라이트의 화면 크기 — 옛 선 그리기의 반지름(rock 13·crater 17·tuft 9·bone 8)에서 따왔고,
// 그림이 칸을 꽉 채우지 않아 1.3배쯤 키웠다. 값 = 반지름(=span), 최종 지름은 그 두 배.
const STK_DECO_SPAN={ rock:17, crater:22, tuft:12, bone:11 };
const STK_DECO_MIN ={ rock:4,  crater:6,  tuft:3,  bone:3  };   // 아주 멀 때도 안 사라지게 하는 최소치(px)
function strikeDrawScenery(ctx,w2s,scale,S,W,H){ if(!S.dec) S.dec=strikeGenScenery(S.world); const D=S.dec, t=S.t||0;
  ctx.save();
  for(const o of D.props){ const p=w2s(o.x,o.y); if(p.x<-50||p.x>W+50||p.y<-50||p.y>H+50) continue; const s=o.r*scale;
    // ⭐ 스프라이트가 있으면 그것으로 그린다(2026-08-30). 아래 선 그리기는 **폴백**이다 —
    //    이미지가 아직 안 왔거나 못 받았을 때만 쓰인다. 지우지 말 것.
    const _im=STRIKE_DECO[o.t];
    if(_imgOk(_im)){ const span=(STK_DECO_SPAN[o.t]||26)*s+STK_DECO_MIN[o.t];
      const sx=(o.v%2)*STK_DECO_CELL, sy=((o.v>>1)&1)*STK_DECO_CELL;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(o.a);
      ctx.drawImage(_im, sx,sy,STK_DECO_CELL,STK_DECO_CELL, -span,-span, span*2,span*2);
      ctx.restore(); continue; }
    if(o.t==='rock'){ const R=13*s+3; ctx.fillStyle='rgba(78,69,52,.72)'; ctx.strokeStyle='rgba(28,24,16,.55)'; ctx.lineWidth=1;
      ctx.beginPath(); for(let k=0;k<6;k++){ const a=o.a+k*1.047, rr=R*(0.78+0.22*Math.sin(o.a*3+k)); const xx=p.x+Math.cos(a)*rr, yy=p.y+Math.sin(a)*rr*0.72; k?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='rgba(126,113,86,.5)'; ctx.beginPath(); ctx.ellipse(p.x-R*0.24,p.y-R*0.22,R*0.42,R*0.28,0,0,6.28); ctx.fill(); }
    else if(o.t==='crater'){ const R=17*s+5; ctx.fillStyle='rgba(0,0,0,.26)'; ctx.beginPath(); ctx.ellipse(p.x,p.y,R,R*0.6,0,0,6.28); ctx.fill();
      ctx.strokeStyle='rgba(102,84,54,.5)'; ctx.lineWidth=Math.max(1,2*scale); ctx.beginPath(); ctx.ellipse(p.x,p.y,R*0.9,R*0.53,0,0,6.28); ctx.stroke(); }
    else if(o.t==='tuft'){ ctx.strokeStyle='rgba(104,128,60,.55)'; ctx.lineWidth=Math.max(1,1.6*scale); const R=9*s+2; for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.moveTo(p.x+k*2.2,p.y); ctx.lineTo(p.x+k*2.6,p.y-R); ctx.stroke(); } }
    else { ctx.strokeStyle='rgba(184,176,152,.5)'; ctx.lineWidth=Math.max(1,1.8*scale); const R=8*s+2; ctx.beginPath(); ctx.moveTo(p.x-R,p.y-R*0.5); ctx.lineTo(p.x+R,p.y+R*0.5); ctx.moveTo(p.x-R,p.y+R*0.5); ctx.lineTo(p.x+R,p.y-R*0.5); ctx.stroke(); } }
  ctx.fillStyle='rgba(222,212,182,.15)';   // 떠다니는 먼지(다이나믹)
  for(const m of D.motes){ const p=w2s(m.x+Math.sin(t*m.sp+m.ph)*m.amp, m.y+Math.cos(t*m.sp*0.7+m.ph)*m.amp*0.6); if(p.x<0||p.x>W||p.y<0||p.y>H) continue; ctx.beginPath(); ctx.arc(p.x,p.y,1.5+Math.sin(t*2+m.ph)*0.6,0,6.28); ctx.fill(); }
  ctx.restore(); }
const STK_TABLABEL ={ Build:'건설지', Upgrade:'특수무기', Players:'관전' };   // 건설지 = 관리자 건설 탭(Build) 그대로 사용 · 전투는 탭이 아니라 기본 화면
// ⚠ 인게임 탭 이름의 **실제 소스는 이 표**다 — startGameNow 가 strikeSetTabLabels(STK_NEMOLABEL) 로
//    마크업 글자를 덮어쓴다. 마크업(#tabs 의 .tab 안 글자)은 게임 시작 전에만 보이므로 둘을 같이 고칠 것.
const STK_NEMOLABEL={ Main:'관리', Unit:'유닛뽑기', Upgrade:'업그레이드', Players:'플레이어', Build:'건설' };
const STK_TECH_RACE={ terran:'union', zerg:'swarm', protoss:'aetherial', feral:'feral', colossus:'colossus' };   // 직스 종족 → 관리자 건설 트리 종족(신규 2종족은 키가 같다)
function stkTechRace(r){ return STK_TECH_RACE[r]||r; }   // ⚠ TECH_BLDG_UNIT·TECH_TREE·STK_RACE_SPAWN 는 전부 '건설 트리 종족 키'다. STK 종족 키로 바로 찾으면 조용히 빈 표가 나온다.
const STK_TECH_COLS=48;      // 오토배틀 건설지 가로 칸 수(관리자 20칸 → 보드처럼 넓게, 이전 32칸의 1.5배)
const STK_TECH_ROWS=30;      // 세로 칸 수(이전 12칸의 2.5배) — 밴드 높이는 이 행 수로 산출
const STK_TECH_TOP=0.14;     // 밴드 위 경계 — 위쪽 진입 불가 구역은 얇게, 아래쪽을 넓게 남겨 하단 프로필 시트와 겹치지 않게
const STK_TECH_EXT=1.5;      // 광산 최대 강화 시 기본 건설지 '아래로' 열리는 추가 구역(기본 대비 배수)
const STK_TECH_WORKERS=4;    // 오토배틀 시작 일꾼 수
const STK_FLOOR_CELLS=4;     // 바닥 타일 1개가 덮는 격자 칸 수(오토배틀 건설지)
const STK_TECH_BUILD_T=1;    // 오토배틀 건설 시간(초) — 건물 종류 무관 동일
const STK_TECH_PAD=0.13;     // 이동 여유 — 구역 경계에 딱 붙지 않고 화면의 13%만큼 더 밀 수 있게
const STK_TECH_LIFT=0.10;    // 화면에서 밴드를 이만큼 위로(하단 시트가 올라와도 건설 구역이 화면 중앙에 오도록)
const STK_TECH_ZOOM=1.95;    // 진입 시 확대 배율 — 건설 구역이 넓어진 만큼(가로 1.5배) 축소해서 한눈에
// 오토배틀 건설지 초기 상태: 본진+정비공을 좌상단에 붙여 놓고, 그 둘을 화면 중앙에 확대해서 보여준다
function strikeTechLayout(){ if(!G.tech) return; const race=G.tech.race, cw=_techCW(), ch=_techCH();
  const hq=G.tech.ents.find(e=>e.type==='bldg'), wk=G.tech.ents.find(e=>e.type==='worker');
  if(hq){ const f=_techFoot(race,hq.bk)||{w:4,h:3};
    const sp=_techSnap(TECH_GRID.x0+(f.w/2+1)*cw, techY0()+(f.h/2+1)*ch, f.w, f.h);   // 좌상단(격자 스냅)
    hq.x=sp.cx; hq.y=sp.cy;
    if(wk){ wk.x=hq.x+(f.w/2+0.8)*cw; wk.y=hq.y+(f.h/2+0.6)*ch; }   // 일꾼은 본진 오른쪽 아래(같은 화면에 함께)
    const cx=hq.x+(wk?(wk.x-hq.x)/2:0), cy=hq.y+(wk?(wk.y-hq.y)/2:0);
    const _vy=cy+STK_TECH_LIFT/STK_TECH_ZOOM;   // 하단 프로필 시트를 피해 건설 구역을 화면 위쪽으로(초기 뷰만)
    G.tech.view={x:cx, y:_vy, zoom:STK_TECH_ZOOM}; G.tech.viewT={x:cx, y:_vy, zoom:STK_TECH_ZOOM};
    _techClampView(G.tech.view); _techClampView(G.tech.viewT); } }
function strikeNewState(){ const W=mapCfg('world',4800), hp=mapCfg('baseHp',7500), inc=mapCfg('incomeBase',150), mc=mapCfg('mineCost',300), mi=mapCfg('mineIncome',120);   // ⚠ 이건 cfg 미지정 맵용 기본값 — 오토배틀은 USEMAPS.cpu.cfg.baseHp가 이깁니다(신전 체력은 거기서 조정할 것)
  const sHp=mapCfg('secHp',Math.round(hp*0.5)), cHp=mapCfg('centralHp',Math.round(hp*0.35));   // 2차=메인×0.5(3750) · 중앙=메인×0.35(2625) — 메인 비례 상승
  // 레인: me 메인 → me 2차 → 중앙 중립 → ai 2차 → ai 메인 (대각선 한 줄). t=0.27/0.5/0.73 지점
  return { t:0, over:null, round:1,
    world:W, cycleTime:mapCfg('cycleTime',30), cycleT:mapCfg('cycleTime',30),
    incomeBase:inc, mineIncome:mi,
    // 진영별 경제(me=나, ai=컴퓨터). 광산/돈 리더보드용. shield=중립 신전 보상 쉴드(다음 단계 전투에서 적용)
    me:{ name:'나', compCol:(typeof PLAYER_VIEW_COLORS!=='undefined'?PLAYER_VIEW_COLORS[0]:'#4570d3'), base:{x:W*0.115,y:W*0.885, hp:hp, max:hp, dead:false}, hp:hp, max:hp, shield:0, gold:mapCfg('startGold',3000), earned:0, mines:0, mineCost:mc, atkLv:0, hpLv:0, wpn:{}, units:[], buildings:[],
         sec:{x:W*0.339,y:W*0.661, hp:sHp, max:sHp, dead:false} },   // 좌하단 메인 + 2차 신전 / compCol=아군 컴퓨터(생산자) 색 / atkLv·hpLv=유닛강화, wpn=특수무기 재고(종류별)
    ai:{ name:'컴퓨터', compCol:(typeof PLAYER_VIEW_COLORS!=='undefined'?PLAYER_VIEW_COLORS[1]:'#d6292f'), base:{x:W*0.885,y:W*0.115, hp:hp, max:hp, dead:false}, hp:hp, max:hp, shield:0, gold:mapCfg('startGold',3000), earned:0, mines:0, mineCost:mc, atkLv:0, hpLv:0, wpn:{}, units:[], buildings:[], aiT:0,
         sec:{x:W*0.661,y:W*0.339, hp:sHp, max:sHp, dead:false} },   // 우상단 메인 + 2차 신전 / compCol=적군 컴퓨터 색
    central:{x:W*0.5,y:W*0.5, hp:cHp, max:cHp, owner:null, dead:false},   // 중앙 중립 보너스 신전(깬 팀 메인에 쉴드)
    cam:{x:W/2,y:W/2}, zoom:STK_DEFZOOM, viewWorld:Math.round(2600/STK_DEFZOOM), cw:0, ch:0, sel:null, userCam:false,
    build:{ W:2400, H:1800, cols:32, rows:24, cam:{x:1200,y:900}, zoom:1.15, zoomCur:1.15, _sc:1, _ox:0, _oy:0, cells:[], worker:null, placing:null },   // 건설 보드(4:3, 그리드 32×24 칸=75) — 화면 커버+팬(전체가 한 화면에 안 들어옴) + 생산 건물(cells,풋프린트)·일꾼
    leadT:0, leadIdx:0, sizeCmp:false, cmpUnits:null };
}
function strikeMineYield(side){ const S=STK; return S.mineIncome; }   // 광산 1개당 고정 수입
function strikeIncome(side){ const S=STK; if(!S) return 0; side=side||S.me; return S.incomeBase + side.mines*strikeMineYield(side); }
// 보급 강화 비용(레벨별 누증) — 유닛 공격/체력, 채굴, 폭탄
const STK_MINE_CAP=5, STK_BOMB_CAP=3;   // 광산·특수무기 보유 상한(표기를 n/max로 통일)
const STK_MINE_STEP0=100, STK_MINE_STEPD=50;   // 첫 증가폭 100, 살 때마다 증가폭이 +50씩 커진다
function strikeMineBuy(side){ side.mineCost=(side.mineCost||200)+(side._mineStep||STK_MINE_STEP0);
  side._mineStep=(side._mineStep||STK_MINE_STEP0)+STK_MINE_STEPD; }
function strikeUpCost(kind, lv){ const B={atk:120, hp:120}; return Math.round((B[kind]||300)*Math.pow(1.55, lv||0)); }
function strikeKillGold(e){ return Math.max(1, Math.min(5, Math.round((e&&e.maxHp||130)/250))); }   // 처치 보상(티어 비례)
const STK_BOMB_COST=150, STK_BOMB_DMG=520, STK_BOMB_R=520;   // 폭탄: 비용/피해/반경
// 💥 특수무기 — **이 표 하나가 단일 소스**다(구입 그리드·사용 그리드·효과 분기가 전부 여기서 나온다).
// ⚠ 효과는 시뮬에 새 필드를 만들지 않는다. 이미 있는 것만 쓴다:
//    광역 피해=hp · 정지=u.wait(소환 직후 대기와 같은 필드) · 회복=hp.
//    새 상태이상을 넣고 싶으면 strikeStepUnits 를 먼저 읽고 거기 있는 것을 재사용할 것.
// ⚠ 아래 상수는 표의 desc 가 참조하므로 반드시 표보다 먼저 온다(TDZ).
const STK_EMP_DUR=3.5;                       // EMP 정지 시간(초)
const STK_HEAL_F=0.35;                       // 재생 필드 회복량(최대 체력 비율)
const STK_ORBIT_DMG=780, STK_ORBIT_R=760;    // 궤도 포격: 폭탄보다 1.5× 피해 · 1.46× 반경
// `sk` = assets/icons/skills/sk_<sk>.webp — 뜻이 같은 스킬 아이콘을 그대로 빌린다(파일을 복사하지 말 것).
//   파일이 없으면 _icoFail 이 ico 이모지로 되돌리므로, 아이콘을 나중에 넣어도 칸이 비지 않는다.
const STK_WEAPONS=[
  { k:'bomb',  name:'폭탄',      ico:'💣', sk:'bomb',    cls:'ic-danger', cost:STK_BOMB_COST, cap:3,
    desc:'가장 밀집한 적 무리에 투하 — 반경 안 광역 피해' },
  { k:'emp',   name:'EMP',       ico:'⚡', sk:'emp',     cls:'ic-info',   cost:120, cap:3,
    desc:'적 전군을 '+STK_EMP_DUR+'초 멈춘다 — 피해는 없다' },
  { k:'orbit', name:'궤도 포격', ico:'☄',  sk:'yamato',  cls:'ic-danger', cost:240, cap:2,
    desc:'폭탄보다 넓고 강하게 — 가장 밀집한 곳을 때린다' },
  { k:'heal',  name:'재생 필드', ico:'✚',  sk:'heal',    cls:'ic-gold',   cost:110, cap:3,
    desc:'내 전군의 체력을 '+Math.round(STK_HEAL_F*100)+'% 회복한다' },
];
const STK_WPN=k=>STK_WEAPONS.find(w=>w.k===k)||null;
function strikeWpnHave(k){ const S=STK; return (S&&S.me&&S.me.wpn&&S.me.wpn[k])||0; }
// 유닛 강화 배율(소환 시 적용) — 공격 +12%/Lv, 체력 +16%/Lv
// 종족 전투 파워 배수(hp·공격 동시) — 배출 배수(테마)는 고정하고 이 값으로 종족 균형을 맞춘다. 밸런싱 단일 소스.
const STK_RACE_POWER={ union:1.00, swarm:1.00, aetherial:1.00, feral:1.00, colossus:1.00 };   // 종족 세기는 스탯(공격·체력)으로만 조절 — 전역 파워 배수는 중립(1). 상성이 승패를 결정하도록.
function _racePow(side){ return (side && STK_RACE_POWER[side.race]) || 1; }
function strikeAtkMul(side){ return (1 + (side.atkLv||0)*0.12) * _racePow(side); }
function strikeHpMul(side){ return (1 + (side.hpLv||0)*0.16) * _racePow(side); }
function strikeApplyHpUpg(side){ const S=STK; if(!S||!side) return;   // 글로벌 체력 업그레이드 — 이미 소환된 유닛의 최대 체력도 즉시 상향(비율 유지)
  const m=strikeHpMul(side), prev=side._hpMulApplied||1; if(m===prev) return; side._hpMulApplied=m;
  const k=m/prev; for(const u of side.units){ if(u.dead) continue; const r=u.maxHp?u.hp/u.maxHp:1;
    u.maxHp=Math.round(u.maxHp*k); u.hp=Math.round(u.maxHp*r);
    if(u.maxSh){ const sr=u.sh/u.maxSh; u.maxSh=Math.round(u.maxSh*k); u.sh=Math.round(u.maxSh*sr); } } }   // 실드도 함께 상향(비율 유지)
// 진영 리더보드(광산 수 → 돈 순). leadIdx로 5초마다 회전 표시
function strikeRanked(){ const S=STK; return [S.me,S.ai].slice().sort((a,b)=> (b.mines-a.mines) || (b.gold-a.gold)); }

// ── 라이프사이클 ──
// 🧭 탭 순서 — 직스는 건설지를 두 번째로. 네모 진입 시 원래 순서로 복원(원본 순서는 최초 1회만 기록).
let _navOrder0=null;
function strikeSetTabOrder(order){ const el0=document.querySelector('.tab[data-tab]'); if(!el0) return;
  const par=el0.parentNode; if(!par) return;
  const tabs=[].slice.call(par.querySelectorAll('.tab[data-tab]'));
  if(!_navOrder0) _navOrder0=tabs.map(t=>t.getAttribute('data-tab'));
  const want=order||_navOrder0, seen={};
  want.forEach(function(k){ const t=tabs.find(x=>x.getAttribute('data-tab')===k); if(t){ par.appendChild(t); seen[k]=1; } });
  tabs.forEach(function(t){ if(!seen[t.getAttribute('data-tab')]) par.appendChild(t); });   // 목록에 없는 탭은 뒤로
  const set=par.querySelector('#settingsBtn'); if(set) par.appendChild(set); }   // ⚠ 설정 버튼은 data-tab이 없어 위 목록에 안 잡힌다 —
  // 재배치가 appendChild(=뒤로 보내기)라 그냥 두면 나머지 탭이 전부 그 뒤로 가서 설정이 맨 왼쪽으로 밀린다. 항상 마지막에 붙여 오른쪽 끝 고정.
function strikeSetTabLabels(map){ for(const t in map){ const el=document.querySelector('.tab[data-tab="'+t+'"]'); if(!el) continue;
  const span=el.querySelector('#unitTabLbl');   // Unit 탭은 라벨이 <span>에 들어있음 → 텍스트노드 덧붙이기(겹침) 대신 스팬 갱신
  if(span){ span.textContent=map[t]; continue; }
  let tn=null; el.childNodes.forEach(n=>{ if(n.nodeType===3 && n.textContent.trim()) tn=n; });
  if(tn) tn.textContent=map[t]; else el.appendChild(document.createTextNode(map[t])); } }
function strikeHideNemoChrome(on){ ['coopBossBar','skillFab','deselTop','cvMarine','cvFx','miniWrap','defaultCmd','zoneLabel','chatBar'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display=on?'none':''; });   // unitCmd 제외: 직스 선택 프로필(커맨드 그리드) 호스트로 사용 → .on 클래스로 표시 제어 · chatBar 숨김(전투화면 하단 비움)
  { const uc=document.getElementById('unitCmd'); if(uc){ uc.classList.remove('on','simple'); uc.innerHTML=''; uc._stkSig=null; uc.style.display=''; } }   // 진입/종료 시 초기화(인라인 display 잔존 제거)
  const kill=document.querySelector('#hudL .kill'); if(kill) kill.style.display=on?'none':'';
  const stage=document.querySelector('#hudL .stage'); if(stage) stage.style.display=on?'none':'';   // 좌상단 ROUND 숨김
  // nemo 하단 패널의 비-직스 자식 숨김(직스 패널만 보이게)
  ['shopProfile','prodHint','opsManual'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display=on?'none':''; });   // 켜기/끄기 대칭 — 안 그러면 직스를 한 번 하고 나온 뒤 nemo 안내가 계속 숨겨진다
  { const ut=document.querySelector('.tab[data-tab="Unit"]'), bt=document.getElementById('buildTab');   // 건설지 = 관리자 건설 탭(Build)을 그대로 노출, nemo 유닛뽑기 탭은 숨김
    if(ut) ut.style.display=on?'none':''; if(bt) bt.style.display=on?'':'none'; }
  // ⚔ 전투는 **탭이 아니라 무선택 기본 화면**이다(2026-08-14) — 최상위는 [건설지][특수무기][관전] 셋뿐.
  //   보스는 네모 전용 탭이다 — 직스로 넘어올 때 켜져 있으면 그대로 남는다(updatePbossFab 이 네모에서만 돈다).
  { const mt=document.querySelector('.tab[data-tab="Main"]'); if(mt) mt.style.display=on?'none':'';
    const bt=document.getElementById('bossTab'); if(bt) bt.style.display='none'; }
  if(!on) document.body.classList.remove('cstMode','stkCst');
}
function strikeStart(activePlayers, myNum, names){ if(typeof bgmStop==='function') bgmStop();
  G=newGame(); G.strike=true; G.phase='playing'; G.tab='Main'; G.sel=[]; G.selEnemy=null;
  G.activePlayers=(activePlayers&&activePlayers.length)?activePlayers.slice():[1]; G.myPlayer=myNum||1; G.playerNames=names||{};   // 로딩화면 플레이어 목록·닉네임(네모와 동일)
  STK=strikeNewState();
  STK.me.race=(STK_RACES[_selRace]?_selRace:'terran'); STK.ai.race=strikeRandomRace();   // 내 종족=선택, 상대=랜덤 → 각자 그 종족 유닛만 소환
  { const b=STK.build; b.cam.x=b.W*0.25; b.cam.y=b.H*0.25; }   // 관전 보드 카메라만 초기화(내 건설은 G.tech가 담당)
  if(STK.sizeCmp){   // 크기 비교용 샘플 유닛: 중앙 신전 주변 4×2 그리드(월드 좌표)
    const W=STK.world, sp=560, cols=4;
    STK.cmpUnits=STRIKE_SAMPLE.map((s,i)=>{ const c=i%cols, r=Math.floor(i/cols);
      return { uid:'cmp_'+s.id, id:s.id, nm:s.nm, x:W*0.5+(c-1.5)*sp, y:W*0.5+(r-0.5)*sp }; });
    if(window.M3D && M3D.loadMapModels) M3D.loadMapModels('cpu', ()=>{});
  }
  if(typeof techUIInit==='function') techUIInit(stkTechRace(STK.me.race));   // 🏗 건설지 = 관리자 건설 시스템(G.tech)을 내 종족으로 초기화
  if(G.tech) G.tech.minerals=[];   // 오토배틀은 채취 경제 미사용 → 자원 노드 없음(일꾼은 건설만)
  if(G.tech){ const _wk=G.tech.ents.find(e=>e.type==='worker');   // 시작 일꾼 4기(기본 1기 + 3기)
    for(let i=1;i<STK_TECH_WORKERS;i++) G.tech.ents.push({eid:G.tech.eseq++, type:'worker', x:(_wk?_wk.x:0.3)+i*_techCW()*1.2, y:(_wk?_wk.y:0.4)}); }
  strikeTechLayout();              // 본진·정비공 좌상단 배치 + 확대 진입
  techSyncWallet();
  if(typeof hideAppScreens==='function') hideAppScreens();
  if(typeof setInGame==='function') setInGame(true);
  strikeHideNemoChrome(true);
  if(STK.sizeCmp){ const mcv=document.getElementById('cvMarine'); if(mcv) mcv.style.display='block'; }   // 3D 유닛 오버레이 캔버스 켜기
  strikeSetTabLabels(STK_TABLABEL); strikeSetTabOrder(['Build','Upgrade','Players']);   // 전투 탭은 숨김(무선택 기본 화면)
  const mn=document.getElementById('mapName'); if(mn) mn.textContent='◈ 오토 배틀';
  strikeRestHome();   // 전투 = 무선택 기본 화면에서 시작
  G.loading=true;   // 로딩 동안 시뮬 정지(네모와 동일 — 오프닝 워프 후 진행)
  if(typeof gameStartCountdown==='function') gameStartCountdown();   // 네모와 동일한 게임 진입 로딩 화면(맵 썸네일·특징 설명·플레이어·준비) — 설명은 cpu.feats(오토배틀용)
  else if(typeof showLoading==='function') showLoading(null);   // 폴백
  if(typeof playSfx==='function') playSfx('game_start');
}
function strikeEnd(){ if(!STK && !(G&&G.strike)) return;
  { const r=document.getElementById('stResult'); if(r){ try{ r.remove(); }catch(_){ } } }   // 결과 오버레이 정리
  if(G) G.strike=false; STK=null; _stkPtrs.clear(); _stkPinch=null;
  if(typeof resetGameChrome==='function') resetGameChrome();   // 탭 라벨·직스 크롬·선택 정보·리더보드 정리(단일 소스)
  if(typeof playSfx==='function') playSfx('ui_close');
  if(typeof openMapSelect==='function') openMapSelect();
}

// ── 프레임/시뮬 ──
function strikeFrame(dt){ const S=STK; if(!S) return; strikeStep(dt*(G.speedMul||1));   // 게임 배속(설정 배속 시스템 반영) — 로딩/종료 중엔 strikeStep 내부에서 정지
  // 👁 관전 중(specView) = 탭보다 우선. 어느 탭이든 vMain에 그 플레이어 건설을 렌더(건설지에서 열었어도 카드 선택 시 그 플레이어 화면).
  { const _spec=!!S.specView; if(_spec!==S._specGview){ S._specGview=_spec; const _bld=(G.tab==='Build');
      document.querySelectorAll('.gview').forEach(v=>v.classList.toggle('on', v.id===((_spec||!_bld)?'vMain':'vBuild'))); } }
  if(S.specView){ const _mcv=document.getElementById('cvMarine'); if(_mcv) _mcv.style.display='none';   // 관전=2D 빌드맵(전투 3D 오버레이 숨김)
    strikeDrawBuildMap(strikeSpecView(S.specView)); strikeTempleTick(dt); strikeHud(); strikeLeaderboard(dt);
    if(G.tab==='Build'){ if(S.specSheet&&typeof techPanelRender==='function'){ S._spT=(S._spT||0)-dt; if(S._spT<=0){ S._spT=0.22; techPanelRender(); } } }
    else { S._siT=(S._siT||0)-dt; if(S._siT<=0){ S._siT=0.22; strikeRenderSelInfo(); } }
    return; }
  if(G.tab==='Build'){ techSyncWallet(); renderBuildTab(dt); strikeHud();
    if(S.supSheet||S.specSheet){ S._spT=(S._spT||0)-dt; if(S._spT<=0){ S._spT=0.22; if(typeof techPanelRender==='function') techPanelRender(); } }   // 📦 보급/관전 시트 수치 갱신
    return; }   // 🏗 건설지 = 관리자 건설 탭과 동일한 렌더·틱(단일 소스)
  strikeDrawMain();
  { const U=STK._fxU; if(U){ if(U.pend&&U.pend.length){ for(let i=U.pend.length-1;i>=0;i--){ const p=U.pend[i]; p.t-=dt; if(p.t<=0){ FX.spawn(U.store,p.id,p.sx,p.sy,p.tx,p.ty,p.opt); U.pend.splice(i,1); } } }
    if(typeof tickUnitFx==='function') tickUnitFx(U, dt); if(FX.advance) FX.advance(U.store, dt); } }   // 유닛별 이펙트 진행(대기 발사·가스 이미터 등)
  strikeTempleTick(dt); strikeHud(); strikeLeaderboard(dt); strikeSync3D(dt);
  if(G.tab==='Main'){ S._siT=(S._siT||0)-dt; if(S._siT<=0){ S._siT=0.22; strikeRenderSelInfo(); } } }   // 선택 정보 라이브 갱신(HP)
// 직스 3D 오버레이 — 신전(메인/2차/중립, 항상) + 크기비교 샘플유닛(sizeCmp일 때). 카메라 좌표→정규화, M3D.sync로 cvMarine 렌더(전투 탭, 맵 스케일 연동)
// 해상도는 자동조절하지 않고 설정(절전/고화질)으로 고정 — 전장 배율은 STK_RES/strikeResMode가 담당(M3D.sync·strikeDrawMain)
function strikeSync3D(dt){ const S=STK; if(!S) return; const mcv=document.getElementById('cvMarine');
  const ok3d=window.M3D && M3D.ready && M3D.ready() && !(G.opt&&G.opt.model3d===false);
  // (제거) 구 건설 3D 분기 — 건설지 3D는 renderBuildTab(관리자와 동일 경로)이 담당
  const on=(G.tab==='Main' && ok3d);
  if(!on){ if(mcv) mcv.style.display='none'; return; }
  if(mcv) mcv.style.display='block';
  const W=S.cw||1, H=S.ch||1, scale=Math.min(W,H)/S.viewWorld;
  const k=Math.min(1, Math.max(0.05, (2600/3)/S.viewWorld));   // 맵 스케일 연동
  const w2n=function(wx,wy){ const sx=(wx-S.cam.x)*scale+W/2, sy=(wy-S.cam.y)*scale+H/2; return {x:sx/W, y:sy/H}; };
  const list=[];
  const TT=[['tmpMeMain',S.me.base,'temple_main'],['tmpAiMain',S.ai.base,'temple_main'],['tmpMeSec',S.me.sec,'temple_stone'],['tmpAiSec',S.ai.sec,'temple_stone'],['tmpCentral',S.central,'temple_neutral']];
  for(const t of TT){ const o=t[1], n=w2n(o.x,o.y); o._mk=t[2];   // _mk = 이 신전의 3D 모델 키(프로필 초상 단일 소스에서 사용)
    const _ta=strikeTempleAlpha(o); if(_ta<=0) continue;   // 다 사라진 신전은 3D도 넘기지 않는다
    list.push({uid:t[0], id:t[2], x:n.x, y:n.y, fixed:true, face:-0.42, dead:!!o.dead, fade:_ta,
      ringCol:(!o.dead && S.selTemple===o)?'#ffd24a':null}); }   // 지정한 신전만 노란 하단 링(파괴되면 지정 불가 → 링 없음)
  if(S.sizeCmp && S.cmpUnits){ for(const u of S.cmpUnits){ const n=w2n(u.x,u.y); list.push({uid:u.uid, id:u.id, x:n.x, y:n.y}); } }
  for(const side of ['me','ai']){ const foe=(side==='ai');   // 진영 구분 = 본체 색(rimCol=플레이어색 · 적군은 적색 틴트)만 사용
    // 상시 팀색 하단 링은 제거 — 대군에서 링이 바닥을 덮어 유닛이 안 보였다. 하단 링은 '지정 표시' 전용(단일 소스 인스턴스 링).
    for(const u of S[side].units){ const n=w2n(u.x,u.y);
      if(n.x<-STK_CULL||n.x>1+STK_CULL||n.y<-STK_CULL||n.y>1+STK_CULL) continue;   // ⚡ 화면 밖 = 3D 생략(보이지 않으므로 시각 변화 없음)
      list.push({uid:u.uid, id:u.id, x:n.x, y:n.y, face:u.face, moving:u.moving, rimCol:u.pcol, scl:STK_UNIT_SCALE, fireSeq:(u.fireSeq||0),
        selCol:(foe?0xff5c5c:undefined)}); } }   // 지정 링 색 — 아군=기본 청록 / 적군=빨강   // fireSeq = 공격 모션(관리자와 동일 규약)
  const _sel=(S.selAllies||[]).slice(), _selE=(S.selEnemy&&!S.selEnemy.dead)?S.selEnemy:null;   // 지정 표시 = 관리자·네모와 같은 3D 하단 링(단일 소스)   // moving=이동모션
  if(_selE) _sel.push(_selE.uid);   // 적군도 같은 하단 링으로 표시 — 직스는 양 진영이 한 목록(units)이라 sync의 enemies 경로를 안 탄다
  M3D.sync(list, W, H, dt, _sel, [], _selE, k); }
// 건물 탭 전용: 내 전용 건설 맵(전장 아님). 화면 1/4 직사각형, 깔끔한 금속 타일 + 건설 격자
function strikeDrawBuildMap(spec){ const S=STK; if(!S) return; const cvEl=document.getElementById('cvMain'); if(!cvEl) return;   // spec={cells,col,label} → 관전 모드(다른 플레이어 건설)
  const r=setup('cvMain'); const ctx=r.ctx, W=r.W, H=r.H; GW=W; GH=H; S.cw=W; S.ch=H;
  ctx.fillStyle='#05080c'; ctx.fillRect(0,0,W,H);
  const b=S.build, fit=Math.max(W/b.W, H/b.H), sc=fit*(b.zoomCur||b.zoom);   // fit=커버(화면 꽉 채움) → zoom=1에서도 전체가 안 보이고 팬으로 이동. 여백/레터박스 없음
  strikeBuildClamp(b,sc,W,H);
  const ox=W/2-b.cam.x*sc, oy=H/2-b.cam.y*sc, pw=b.W*sc, ph=b.H*sc;
  b._sc=sc; b._ox=ox; b._oy=oy;
  const use3d=(!spec && window.M3D && M3D.ready && M3D.ready() && !(G.opt&&G.opt.model3d===false));   // 3D면 일꾼/모델보유 건물은 cvMarine(syncBuild)이 렌더 → 2D 생략
  // 타일 바닥(어둡고 단조롭게 — 나중에 건물이 잘 보이게)
  strikeTileRect(ctx, ox,oy, pw,ph, STRIKE_BUILDTILE, Math.max(10, (b.W/8)*sc));
  ctx.save(); ctx.beginPath(); ctx.rect(ox,oy,pw,ph); ctx.clip(); ctx.fillStyle='rgba(7,11,16,.62)'; ctx.fillRect(ox,oy,pw,ph); ctx.restore();   // 어둡게+패턴 차분
  // (그리드·테두리·프레임·구역 하이라이트 제거 — 요청) 건물은 자유 배치, 위치는 드래그 실루엣으로 안내
  const mc=spec?(spec.col||'#7fd0ff'):(S.me.compCol||'#7fd0ff'), cells=(spec&&spec.cells)||[];   // 관전 전용(내 건설은 관리자 건설 화면)
  for(const c of cells){ const fw=(c.w||60)*sc, fh=(c.h||60)*sc, cx=ox+c.x*sc, cy=oy+c.y*sc, built=c.built>=1,
    rx=cx-fw/2, ry=cy-fh/2, rr=Math.min(fw,fh)*0.14;
    const _mk=STK_BUILD_MODEL[c.type&&c.type.key], has3d=use3d&&_mk&&M3D.hasModel(_mk);   // 3D 모델 보유 건물이면 본체는 syncBuild가 렌더 → 2D 본체 생략
    ctx.save();
    if(!has3d){
      if(built){ ctx.globalAlpha=0.5; ctx.strokeStyle=mc; ctx.lineWidth=Math.max(2,Math.min(fw,fh)*0.1); _strkRR(ctx,rx-1,ry-1,fw+2,fh+2,rr); ctx.stroke(); ctx.globalAlpha=1; }   // 완성 건물 외곽 소프트 글로우
      ctx.globalAlpha=built?1:0.5; ctx.fillStyle=built?'rgba(30,52,84,.94)':'rgba(48,78,116,.5)'; _strkRR(ctx,rx,ry,fw,fh,rr); ctx.fill();
      ctx.globalAlpha=built?1:0.75; ctx.strokeStyle=mc; ctx.lineWidth=Math.max(1.5,Math.min(fw,fh)*0.05); _strkRR(ctx,rx,ry,fw,fh,rr); ctx.stroke();
      ctx.globalAlpha=1; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=Math.max(12,Math.min(fw,fh)*0.5)+'px sans-serif'; ctx.fillStyle='#fff'; ctx.fillText(c.type.ico, cx, cy);
    }
    if(!built){ const bw=fw*0.82, by2=ry+fh+5; ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(cx-bw/2,by2,bw,5); ctx.fillStyle='#6fe89a'; ctx.fillRect(cx-bw/2,by2,bw*c.built,5); }   // 건설 진행바(3D여도 표시)
    ctx.restore(); }
  // 일꾼 — 3D면 syncBuild가 렌더(2D 생략). 2D 폴백: 종족색 원반 + 일꾼 이모지
  if(!spec && !use3d){ const _wid={terran:'worker_human',zerg:'worker_swarm',protoss:'worker_light'}[S.me.race]||'worker_human';
    const _wico=(typeof U!=='undefined'&&U[_wid]&&U[_wid].icon)||'🔧', _wcol=(STK_RACES[S.me.race]&&STK_RACES[S.me.race].col)||'#ffd24a';
    for(const wk of (b.workers||[])){ const wx=ox+wk.x*sc, wy=oy+wk.y*sc, wr=Math.max(7,30*sc);
      if(wk.task){ const tx=ox+wk.task.x*sc, ty=oy+wk.task.y*sc; ctx.strokeStyle='rgba(255,210,74,.4)'; ctx.setLineDash([5,4]); ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(wx,wy); ctx.lineTo(tx,ty); ctx.stroke(); ctx.setLineDash([]); }
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(wx,wy+wr*0.55,wr*0.9,wr*0.38,0,0,6.28); ctx.fill();   // 그림자
      ctx.globalAlpha=0.92; ctx.fillStyle=_wcol; ctx.beginPath(); ctx.arc(wx,wy,wr,0,6.28); ctx.fill(); ctx.globalAlpha=1;   // 종족색 원반
      ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(wx,wy,wr,0,6.28); ctx.stroke();
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=Math.max(9,wr*1.15)+'px sans-serif'; ctx.fillText(_wico,wx,wy);   // 종족 일꾼 이모지
      ctx.restore(); } }
  // 상단 텍스트 전부 제거(골드는 우상단 크레딧 표시로 충분) — 관전 시에만 대상 라벨
  if(spec){ ctx.textBaseline='alphabetic'; ctx.font='700 13px '+FONT_NUM; ctx.textAlign='center';
    ctx.fillStyle=spec.col; ctx.fillText('👁 '+spec.label, W/2, Math.max(54, oy-12)); ctx.textAlign='left'; }
}
// 건설 보드 카메라 클램프 — 보드가 화면보다 작으면 중앙, 크면 가장자리 넘어 못 가게
function strikeBuildClamp(b,sc,W,H){ const hvx=(W/sc)/2, hvy=(H/sc)/2;
  b.cam.x = (b.W<=hvx*2) ? b.W/2 : Math.max(hvx, Math.min(b.W-hvx, b.cam.x));
  b.cam.y = (b.H<=hvy*2) ? b.H/2 : Math.max(hvy, Math.min(b.H-hvy, b.cam.y)); }
function strikeStep(dt){ const S=STK; if(!S) return; if(S.over) return; if(G&&G.loading) return; S.t+=dt;   // 종료·로딩(오프닝) 중 시뮬·소환 정지
  strikeStepUnits(dt);   // 전투 시뮬(소환·진격·교전·신전 타격)
  S.cycleT-=dt;
  if(S.cycleT<=0){ S.cycleT+=S.cycleTime; S.round++;
    { const im=strikeIncome(S.me), ia=strikeIncome(S.ai);   // 라운드 수입(양 진영)
      S.me.gold+=im; S.ai.gold+=ia;
      S.me.earned=(S.me.earned||0)+im; S.ai.earned=(S.ai.earned||0)+ia; }   // 📊 누적 수입 — umProgress()가 '얼마나 굴렸나'를 여기서 역산한다
    strikeAiEconomy(); strikeSpawnWave();   // 출격 주기마다 유닛 일괄 소환(중앙 타이머 0초 시점)
  }
  { const ter=strikeTerritory(); if(S.terBlue==null){ S.terBlue=ter.blue; S.terRed=ter.red; } const k=Math.min(1,dt*1.4);   // 영역 경계 부드럽게 슬라이드
    S.terBlue+=(ter.blue-S.terBlue)*k; S.terRed+=(ter.red-S.terRed)*k; }
  const baseView=(G.tab==='Unit')?1700:2600, tv=baseView/S.zoom;
  S.viewWorld += (tv-S.viewWorld)*Math.min(1,dt*4);
  S.build.zoomCur += ((S.build.zoom||1)-(S.build.zoomCur||1))*Math.min(1,dt*8);   // 건설 줌 부드럽게(전투화면과 동일 보간)
  if(S.userCam && (S.t-(S.lastCam||0))>5) S.userCam=false;   // 마지막 조작 5초 후 자동 전장 복귀(줌은 유지)
  if(G.tab==='Unit' || !S.userCam){   // 건물뷰=내 진영 고정 / 전투뷰=교전 팔로우(사용자 패닝 전까지)
    if(G.tab==='Unit'){ const k=Math.min(1,dt*5.5); S.cam.x+=(S.me.base.x-S.cam.x)*k; S.cam.y+=(S.me.base.y-S.cam.y)*k; S._fx=null; }
    else {   // 전투뷰 = 최대 격전지를 '끊김 없이 천천히' 트래킹
      S._fT=(S._fT||0)-dt;
      if(S._fT<=0 || !S._fc){ S._fT=STK_CAM_FT; S._fc=strikeFocus(); }   // 격전지 재계산(주기적 — 매 프레임은 낭비)
      const f=S._fc;
      if(S._fx==null){ S._fx=f.x; S._fy=f.y; }
      const tk=Math.min(1, dt*STK_CAM_LAG); S._fx+=(f.x-S._fx)*tk; S._fy+=(f.y-S._fy)*tk;   // 목표점 1차 필터(격전지가 바뀌어도 급전환 없음)
      // ⚠ 데드존으로 목표를 '얼리지' 않는다 — 멈췄다 튀는 원인이었다. 속도 제한 글라이드로 항상 조금씩 흐른다.
      const dx=S._fx-S.cam.x, dy=S._fy-S.cam.y, d=Math.hypot(dx,dy);
      if(d>0.5){ const step=Math.min(d, Math.min(STK_CAM_SPD, d*STK_CAM_EASE)*dt);
        S.cam.x+=dx/d*step; S.cam.y+=dy/d*step; }
    }
  }
  strikeClampCam();
}
// AI 경제: 광산 우선 투자 + 가끔 유닛 강화(플레이어 보급과 대등하게 스케일)
function strikeAiEconomy(){ const S=STK, ai=S.ai;
  if(ai.gold>=ai.mineCost && ai.mines<STK_MINE_CAP && Math.random()<0.7){ ai.gold-=ai.mineCost; ai.mines++; strikeMineBuy(ai); return; }
  if(Math.random()<0.5){ const k=Math.random()<0.5?'atk':'hp', lv=(k==='atk'?ai.atkLv:ai.hpLv), cost=strikeUpCost(k,lv);   // 유닛 공격/체력 강화
    if(ai.gold>=cost && lv<8){ ai.gold-=cost; if(k==='atk') ai.atkLv++; else ai.hpLv++; return; } } }
// 카메라가 맵 밖으로 못 나가게 클램프(검은 화면 방지)
// (제거) strikeSheetPx — 미사용 헬퍼(하단 UI 가림 픽셀 계산, 호출부 없음)
function strikeClampCam(){ const S=STK; if(!S||!S.cw) return; const scale=Math.min(S.cw,S.ch)/S.viewWorld;
  const hx=(S.cw/scale)/2, hy=(S.ch/scale)/2, W=S.world, c=W/2;
  const _pad=(S.ch/scale)*STK_MAP_PAD;   // 맵 바깥 여백 = 화면 높이의 일정 비율(상하좌우 동일) → 가장자리 유닛도 화면 안쪽에서 본다
  S.cam.x = (hx*2>=W+_pad*2) ? c : Math.max(hx-_pad, Math.min(W-hx+_pad, S.cam.x));
  S.cam.y = (hy*2>=W+_pad*2) ? c : Math.max(hy-_pad, Math.min(W-hy+_pad, S.cam.y));
  // 대각 밴드 제한 — 액션은 me↔ai 반대각선에 집중. 좌상단/우하단 빈 코너로 못 가게
  const dx=S.cam.x-c, dy=S.cam.y-c, SQ=Math.SQRT1_2;
  let a=(dx-dy)*SQ, b=(dx+dy)*SQ;   // a=레인 방향, b=수직(빈 코너) 방향
  const A=W*0.56+_pad, B=W*0.14+_pad;
  a=Math.max(-A,Math.min(A,a)); b=Math.max(-B,Math.min(B,b));
  S.cam.x = c+(a+b)*SQ; S.cam.y = c+(b-a)*SQ; }
// 좌상단: 진영별 광산/돈 5초마다 회전(광산 많은 순→돈 많은 순)
function strikeLeaderboard(dt){ const S=STK; S.leadT-=dt; const ranked=strikeRanked();
  if(S.leadT<=0){ S.leadT+=5; S.leadIdx=(S.leadIdx+1)%ranked.length; }
  const p=ranked[S.leadIdx%ranked.length]; const sl=document.getElementById('specLabel'); if(!sl||!p) return;
  const rank=S.leadIdx%ranked.length+1;
  sl.innerHTML='<span id="stLead"><span class="lp">#'+rank+' '+p.name+'</span> <span class="lm">⛏'+p.mines+'</span> <span class="lg">💰'+Math.floor(p.gold)+'</span></span>'; }
// 🎥 자동 카메라 — 목표점(격전지) 선정 + 추적 상수
const STK_CAM_HYST=0.6;    // 보던 격전지가 최고 밀집도의 60% 이상이면 유지(전선 사이 왕복 방지)
const STK_CAM_FT=0.25;     // 격전지 재계산 주기(초) — 매 프레임 O(아군×적군)이라 비싸고, 추적이 느려서 더 자주 볼 필요가 없다
const STK_CAM_LAG=0.8;     // 목표점 1차 필터(작을수록 급전환을 더 흡수)
const STK_CAM_SPD=150;     // 카메라 최대 추적 속도(월드/초) — 천천히 흐르게
const STK_CAM_EASE=0.9;    // 목표에 가까울수록 감속(도착 시 진동 방지)
function strikeFocus(){ const S=STK; if(!S) return {x:0,y:0}; const c=S.world/2;
  const me=S.me.units, ai=S.ai.units;
  // 1) 교전 지점 수집: 적↔아군 근접 쌍의 중점(근접도 가중)
  const pts=[], ENG=1000, ENG2=ENG*ENG;
  for(const a of me){ if(a.dead) continue; let bd=ENG2, bn=null;
    for(const b of ai){ if(b.dead) continue; const dx=b.x-a.x, dy=b.y-a.y, d=dx*dx+dy*dy; if(d<bd){ bd=d; bn=b; } }
    if(bn) pts.push({x:(a.x+bn.x)/2, y:(a.y+bn.y)/2, w:1-Math.sqrt(bd)/ENG}); }
  // 2) 가장 큰 격전지 '하나'를 고른다. ⚠ 전체 가중 평균을 쓰면 안 된다 —
  //    외곽에 한두 기가 붙기만 해도 중심이 끌려가고, 전선이 둘이면 그 사이 빈 공간을 비춘다.
  //    밀집도 최대 지점(모드)을 찾고, 그 반경 안의 점만 평균해서 클러스터 중심을 낸다.
  if(pts.length){ const R2=620*620;
    let best=null, bestD=-1;
    for(const p of pts){ let dens=0; for(const q of pts){ const dx=p.x-q.x, dy=p.y-q.y; if(dx*dx+dy*dy<R2) dens+=q.w; }
      p._d=dens; if(dens>bestD){ bestD=dens; best=p; } }
    // 히스테리시스: 보던 격전지가 아직 최고의 STK_CAM_HYST 이상이면 유지 — 비슷한 규모 둘 사이를 왔다갔다 하지 않게
    if(S._fcx!=null){ let cur=0;
      for(const q of pts){ const dx=S._fcx-q.x, dy=S._fcy-q.y; if(dx*dx+dy*dy<R2) cur+=q.w; }
      if(cur>=bestD*STK_CAM_HYST){ best={x:S._fcx, y:S._fcy}; } }
    let wx=0, wy=0, ws=0;   // 선택된 클러스터 '안'의 점만 평균(바깥 소규모 교전은 무시)
    for(const p of pts){ const dx=p.x-best.x, dy=p.y-best.y; if(dx*dx+dy*dy>=R2) continue;
      const w=p.w*(p._d||1); wx+=p.x*w; wy+=p.y*w; ws+=w; }
    if(ws>0.0001){ S._fcx=wx/ws; S._fcy=wy/ws; return {x:S._fcx, y:S._fcy}; } }
  const all=me.concat(ai); if(!all.length) return {x:c,y:c};   // 교전 전(대치) → 전체 평균
  let sx=0,sy=0; for(const u of all){ sx+=u.x; sy+=u.y; } return {x:sx/all.length, y:sy/all.length}; }

// ── 전투 시뮬(1차): 양 진영이 주기적으로 종족 유닛 소환 → 대각 진격 → 자동 교전 → 적 신전 타격 ──
const WORKER_KR={worker_human:'유니온 일꾼',worker_light:'에테리얼 일꾼',worker_swarm:'스웜 일꾼'};   // 신규 일꾼 표시명
function strikeUnitName(id){ return (STK_UNITS[id]&&STK_UNITS[id].name)||(WORKER_KR[id])||(typeof MODEL_NAME_KR!=='undefined'&&MODEL_NAME_KR[id])||(U[id]&&U[id].name)||id; }   // 직스 유닛 표시명(신규 유닛 포함)
// 인지 거리 = 사거리×1.6, 단 하한 340(근접도 인식)·상한 560(장거리 과도추격 방지)
// 오토배틀 전용 이동속도 오버라이드 — 공성전차 0.07 / 기갑병(구 스트라이더) 0.08은 다른 유닛(0.13~0.19) 대비 2배 이상 느려
// 전선에 도착하기 전에 전투가 끝난다. 여전히 최저속이되 따라는 갈 수 있는 값으로.
const STK_SPD_OVR={ tank:0.13, goliath:0.13 };
const STK_ACQ_FAR=1.4;   // 교전 판단 반경 배율(획득·유지 공통) — 두 곳에서 다른 값을 쓰면 위 문제가 재발한다
const STK_INR_T=0.12;    // '사거리 안 표적' 전체 재탐색 주기(초). 표적을 들고 있는 동안은 O(1) 검증만 하고 이 스캔을 건너뛴다.
                         //   대군에서 유닛마다 매 프레임 격자 질의를 돌리는 게 시뮬 최대 비용이었다. 0.12초 = 최대 7프레임 지연(체감 없음).
                         //   피격 시에는 _inrT=0으로 즉시 재탐색시켜 반응성을 유지한다.
function strikeAcq(rng){ return Math.max(560, Math.min(900, rng*1.9)); }   // 인지 범위 — 신전 공격 중에도 접근한 적을 놓치지 않게 넓힘(구 340~560)
// 유닛 전투 수치 = 관리자 유닛 카탈로그(U)를 단일 소스로 환산. 오토배틀 고유값은 체력·크기·스플래시·근접 여부만.
const STK_RNG_MUL=850, STK_SPD_MUL=1800, STK_CD_DIV=22;   // U(정규화) → 오토배틀 월드 단위 환산 계수
// 유닛 몸 반지름 = 3D 모델의 실제 표시 반경(발밑 링과 같은 규격). 사거리·겹침 간격·회피가 모두 이 값 하나를 쓴다.
//   표 값(STK_UNITS.size)은 모델과 최대 2배까지 어긋나 있었다(여제 -45% · 저격수 -53% · 돌격괴수 +19%).
//   K는 기존 평균 밀도를 보존하도록 실측으로 산출(평균 size / 평균 모델 반경).
const STK_BODY_K=1.12; const _stkBodyR={};
function strikeBodyR(id){ if(_stkBodyR[id]!=null) return _stkBodyR[id];
  const fp=(window.M3D&&M3D.footprintOf)?M3D.footprintOf(id):null;   // 모델 미로드 시에는 캐시하지 않고 표 값으로 대체(다음 소환 때 재시도)
  if(fp) return (_stkBodyR[id]=Math.max(6, Math.round(fp*STK_BODY_K)));
  return (STK_UNITS[id]&&STK_UNITS[id].size)||14; }
// 🔮 마법 이식 — 관리자 페이지의 SKILLS/UNIT_SKILLS를 그대로 사용. 오토배틀은 자동 시전.
//   제외: 순간이동·환영·핵(사용자 결정 — 자동 시전에 부적합하거나 판정 오염 위험)
const STK_SKILL_OFF={ recall:1, hallucination:1, nuke:1 };
const STK_EN_REGEN=1/1.2;   // 원본 SC 마나 재생(1.2초당 1)
function strikeSkillKeys(u){ if(typeof unitSkillKeys!=='function') return [];
  return unitSkillKeys({id:u.id, gmodel:u.gm||u.id}).filter(k=>!STK_SKILL_OFF[k] && (typeof SKILLS!=='undefined') && SKILLS[k]); }
// ⏱ **캠프 전장은 스킬 비용이 쿨타임 하나다**(HUNT_R1 §3-4-3 · 2026-08-28 확정).
//   ⭐ 캠프는 방치형 자동 전투라 누가 마나를 보고 있지 않다 — 마나·체력을 **무시**하고
//     「쿨이 돌면 쓴다」로 판단한다. 오토배틀은 그대로 원본 SC 마나를 쓴다.
//   ⛔ `SKILLS` 표를 캠프에서 덮어쓰는 방식으로 되돌리지 말 것 — 표는 관리자 탭·오토배틀과
//     **공유**라, 캠프에 들어갔다 나오기 전에 오토배틀이 돌면 **마나 없이 난사**한다.
//     여기서 `S.camp` 를 보는 것이 새는 길이 없는 유일한 방법이다(`strikeCheckOver` 와 같은 방식).
const STK_SK_CD_DEF = 5;   // 🏕 캠프에서 쿨이 없는 스킬의 기본 쿨(초) — 없으면 판정 주기(0.4초)마다 계속 나간다
function _stkCampSk(){ return !!(typeof STK !== 'undefined' && STK && STK.camp); }
// 🐌 둔화 배수 — 둔화 중이면 이동이 느려진다. ⛔ 공격 속도에는 걸지 않는다(원본 SC 인스네어와 다름).
const STK_SLOW_MUL = 0.5;
function strikeSlowMul(u){ return (u && u.slowT > 0) ? STK_SLOW_MUL : 1; }
function strikeSkillCost(sk){ if(_stkCampSk()) return 0;
  return (sk && sk.enSc!=null) ? sk.enSc : ((sk&&sk.energy)||0); }   // 오토배틀 = 원본 SC 마나(enSc)
function strikeSkillHpCost(sk){ return _stkCampSk() ? 0 : ((sk && sk.hpCost) || 0); }
// ⏱ **캠프는 「지속이 끝난 뒤부터」 쿨을 센다**(사용자 확정 2026-08-28).
//   ⭐ 스킬을 쓰면 `dur` 만큼 효과가 이어지고, **그것이 끝나야** 쿨이 돌기 시작한다.
//     그래서 실제 주기는 `dur + cd` 다 — 광폭화면 6초 지속 + 10초 쿨 = 16초마다 한 번.
//   ⛔ 쿨을 시전 순간부터 세지 말 것 — 지속이 쿨보다 길면 **효과가 끊기지 않고 겹친다.**
//   ⚠ 오토배틀은 원본 그대로(시전 순간부터) 센다. 여기서 갈린다.
function strikeSkillCd(sk, dflt){ const c = (sk && sk.cd) || 0;
  if(!_stkCampSk()) return c > 0 ? c : (dflt || 0);
  return (c > 0 ? c : STK_SK_CD_DEF) + ((sk && sk.dur) || 0); }
function strikeSkillDrain(sk){ return _stkCampSk() ? 0 : ((sk && sk.drain) || 0); }
function strikeSkillAtkMul(u){ let m=1; const b=u.buff||{}, on=u.skillOn||{};
  if(b.stim>0) m*=(SKILLS.stim.atkMul||1); if(on.siege) m*=(SKILLS.siege.atkMul||1); return m; }
function strikeRngMul(u){ return (u.skillOn&&u.skillOn.siege)?(SKILLS.siege.rngMul||1):1; }
// ══ 🐺 광폭화(페럴 고유) — 아군이 처치할 때마다 **진영 전체** 스택 +1. 스택당 공속 +1%·이속 +0.5%.
//    전투가 끊기면 감쇠한다. ⚠ 진영 값이지 유닛 값이 아니다 — 페럴이 아닌 진영은 스택이 안 쌓인다.
const STK_FRZ_CAP=20, STK_FRZ_CD=0.01, STK_FRZ_SPD=0.005, STK_FRZ_HOLD=3.0, STK_FRZ_DECAY=1.6;   // 상한 · 스택당 공속/이속 · 유지(초) · 초당 감쇠
function strikeFrenzy(sd){ return (sd&&sd.race==='feral')?(sd._frz||0):0; }
function strikeFrzCdMul(u,sd){ return 1/(1+STK_FRZ_CD*strikeFrenzy(sd)); }     // 공속↑ = 쿨 ↓
function strikeFrzSpdMul(u,sd){ return 1+STK_FRZ_SPD*strikeFrenzy(sd); }
function strikeFrzKill(sd){ if(!sd||sd.race!=='feral') return; sd._frz=Math.min(STK_FRZ_CAP,(sd._frz||0)+1); sd._frzT=STK_FRZ_HOLD; }
function strikeFrzStep(sd,dt){ if(!sd||sd.race!=='feral'||!sd._frz) return;
  if((sd._frzT=(sd._frzT||0)-dt)<=0) sd._frz=Math.max(0, sd._frz-STK_FRZ_DECAY*dt); }
// (제거) strikeSpdMul — 미사용(스팀 속도 로직은 14x 인라인으로 중복)
// 종족 스탯 정규화 배율 — 파워 배수(중립1) 대신 "세기를 스탯으로" 조절하는 단일 노브.
//   스폰 수 차이(스웜 다수·에테리얼 소수)를 상쇄해 army 밸런스 ~50%. hp·공격 양쪽에 곱(전투 소스 strikeUnitStats에만 반영 → 표시=전투 일치).
// ⚠ 2026-08-20 오각형 편입 때 실제 엔진 자동 플레이(양 진영 AI · 테크 깊이 2~7 · 판당 승패)로 다시 쟀다.
//   그 전까지 AI 진영은 종족 키 불일치로 웨이브마다 **무작위 2기**만 냈다(strikeSpawnForPlayer). 그 버그를 고치자
//   기존 값(swarm 0.83 · aetherial 1.15)이 실제 대전에서 스웜 22% · 에테리얼 92% 로 무너져서 함께 재조정했다.
//   ⛔ 여기 값을 손대면 RACES.md §8 표를 다시 재고 갱신할 것 — 해석적 추정은 이 프로젝트에서 여러 번 빗나갔다.
const STK_RACE_STAT={ union:1.00, swarm:0.94, aetherial:1.22, feral:1.00, colossus:1.12 };   // 오각형 상성 기준(RACES.md §6)
function strikeUnitStats(id){ const s=STK_UNITS[id], d=U[id]||{};
  const rs=(typeof RACE_OF!=='undefined'&&STK_RACE_STAT[RACE_OF[id]])||1;   // 종족 세기 배율(스탯)
  const rng=(d.range!=null?d.range:0.2)*STK_RNG_MUL;                       // 사거리
  const dmg=((s&&s.sdmg!=null)?s.sdmg:(d.dmg!=null?d.dmg:15))*rs;          // 공격력 — strike 오버라이드(sdmg) 우선 × 종족배율
  const cd=Math.max(0.45,(s&&s.scd!=null)?s.scd:((d.cd!=null?d.cd:22)/STK_CD_DIV));   // 공격속도(쿨) — strike 전용 오버라이드(scd, 초) 우선(nemo 무영향)
  const spd=(STK_SPD_OVR[id]!=null?STK_SPD_OVR[id]:(d.moveSpd!=null?d.moveSpd:0.19))*STK_SPD_MUL;   // 이동속도(직스 오버라이드 우선)
  const armor=((s&&s.sarmor!=null)?s.sarmor:(d.armor||0));        // 방어 — strike 오버라이드(sarmor) 우선, 없으면 U
  const shield=((s&&s.sshield!=null)?s.sshield:(d.shield||0));    // 실드 — strike 오버라이드(sshield) 우선, 없으면 U
  const sharmor=((s&&s.sharmor!=null)?s.sharmor:(d.shArmor||0));  // 실드 전용 방어(방어와 별도)
  // 🗿 최소 사거리·전개 — 사거리와 **같은 배율**로 환산해야 대역이 어긋나지 않는다(RACES.md §5)
  const minRng=(d.minRange||0)*STK_RNG_MUL, dep=(d.deploy||0);
  if(s){ return { hp:Math.round(s.hp*rs), dmg:dmg, rng:rng, cdMax:cd, spd:spd, armor:armor, shield:shield, sharmor:sharmor,   // 체력·공격 × 종족배율
      color:d.color||'#cfd6e2', size:strikeBodyR(id), splash:s.splash||0, melee:!!s.melee, acq:strikeAcq(rng), minRng:minRng, dep:dep }; }
  return { hp:Math.round((d.hp||40)*3*rs), dmg:dmg, rng:rng, cdMax:cd, spd:spd, armor:armor, shield:shield, sharmor:sharmor,   // 폴백(오토배틀 전용값 없는 유닛) — 체력만 U에서 환산 × 종족배율
    color:d.color||'#cfd6e2', size:d.size||13, splash:0, melee:false, acq:strikeAcq(rng), minRng:minRng, dep:dep }; }
function strikeHit(tgt, rawAtk, atk){   // 표준 데미지 적용: 실드 먼저(상성 무시) → 체력((공격−방어)×상성)
  if(tgt.sh>0){ const d=Math.max(0.5, rawAtk-(tgt.shArmor||0));   // 실드 상태: 상성 무시 · 실드 전용 방어
    if(d<=tgt.sh){ tgt.sh-=d; return; } tgt.hp-=(d-tgt.sh); tgt.sh=0; return; }   // 실드 초과분만 체력으로
  tgt.hp -= Math.max(0.5, rawAtk-(tgt.armor||0)) * _sbTypeMul(atk, tgt); }   // (공격−방어) 먼저, 상성은 그 뒤
function strikeSpawnPads(side){ const S=STK, b=S[side].base, D=360, CS=180;   // 메인신전 양 옆 네모 스폰존(strikeDrawSpawnPad와 동일 위치)
  return side==='me' ? [{x:b.x-D+CS,y:b.y-D-CS},{x:b.x+D+CS,y:b.y+D-CS}] : [{x:b.x-D-CS,y:b.y-D+CS},{x:b.x+D-CS,y:b.y+D+CS}]; }
function strikeSpawnUnit(side, forceId){ const S=STK, me=S[side]; if(!me||me.units.length>=STK_UNIT_CAP && STK_UNIT_CAP>0) return;   // 진영당 상한(3D 성능 고려)
  const ids=(STK_RACES[me.race]||STK_RACES.terran).units; if(!ids.length) return;
  const id=forceId||ids[(Math.random()*ids.length)|0], st=strikeUnitStats(id);
  const pads=strikeSpawnPads(side), pad=pads[(Math.random()*pads.length)|0], c=S.world/2;
  const x=pad.x+(Math.random()-.5)*260, y=pad.y+(Math.random()-.5)*260;   // 네모 스폰존 안에서 출현
  const pcol=me.compCol||((typeof PLAYER_VIEW_COLORS!=='undefined')?PLAYER_VIEW_COLORS[(side==='me')?0:1]:'#cfd6e2');   // 본체색=팀 대표 컴퓨터(생산자) 색 1개(개별 플레이어색 X — 그건 관전 화면에서)
  const _hpM=strikeHpMul(me), _hp=Math.round(st.hp*_hpM), _dmg=st.dmg, _sh=Math.round((st.shield||0)*_hpM);   // 체력·실드 소환 시 반영(파워/체력강화) · 공격력은 사용 시점 · 방어는 뺄셈이라 flat
  me.units.push({uid:'su'+(S.uidSeq=(S.uidSeq||0)+1), id:id, side:side, x:x, y:y, pcol:pcol,
    maxEn:((U[id]||{}).energy||0), en:((U[id]||{}).energy||0), skillCd:{}, skillOn:{}, buff:{},
    hp:_hp, maxHp:_hp, armor:st.armor||0, sh:_sh, maxSh:_sh, shArmor:st.sharmor||0, dmg:_dmg, rng:st.rng, acq:st.acq, splash:st.splash||0, melee:!!st.melee, tgtUid:null, cd:Math.random()*st.cdMax, cdMax:st.cdMax, spd:st.spd, color:st.color, size:st.size,
    minRng:st.minRng||0, dep:st.dep||0, depT:st.dep||0,   // 🗿 최소 사거리 · 전개(정지 후 사격까지 지연) — depT 는 남은 전개 시간
    _flank:(Math.random()<0.5?1:-1),   // 좌우 전개 선호(대칭 혼잡 시 분산 방향)
    wait:0.5, face:Math.atan2(c-x, c-y), dead:false}); }   // 인지범위/광역/근접 스탯 반영 / 0.5초 대기 후 진격
const STK_RALLY_D=560, STK_RALLY_R=150;   // 소환 후 집결 지점(본진 앞 대각선 거리) · 집결 완료 판정 반경
function strikeRallyPoint(side){ const S=STK, b=S[side].base, cx=S.world/2, cy=S.world/2;   // 본진 → 중앙 방향 레인 위
  const dx=cx-b.x, dy=cy-b.y, d=Math.hypot(dx,dy)||1; return {x:b.x+dx/d*STK_RALLY_D, y:b.y+dy/d*STK_RALLY_D}; }
// 공중 유닛 = 지상 충돌·건물 통과.
// ⚡ 결과는 유닛 id에만 의존하고 id/gm은 생성 후 바뀌지 않으므로 최초 1회만 판정해 굳힌다 —
//    분리(회피) 루프에서 쌍마다 불려 600기 기준 프레임당 10만 회 이상 호출되던 지점.
function strikeIsAir(u){ if(!u) return false;
  if(u._air===undefined){ const k=u.gm||u.id; u._air=!!(k && typeof FXLAB_AIR!=='undefined' && FXLAB_AIR.has(k)); }
  return u._air; }
// 💉 무공격 지원 유닛(HEALER=의무병) — 스스로 표적을 잡지 않고 부상 아군 바이오닉을 따라다니며 치유한다.
//   치유 대상이 없으면 가장 가까운 전투 아군을 따라 전진해 본대에서 떨어지지 않는다.
const STK_HEAL_HPS=22, STK_HEAL_RNG=110, STK_HEAL_SEEK=900, STK_HEAL_EN=0.5;   // 초당 회복 · 치유 사거리 · 탐색 반경 · 회복 1당 에너지
// ⏱ **캠프의 치유는 「3초 치유 → 5초 쉬기」다**(사용자 확정 2026-08-28).
//   ⭐ 원래는 **마나가 닳을 때까지** 이어지는 방식이었다. 캠프는 마나를 안 보므로
//     그대로 두면 무한 치유가 된다 — 다른 스킬과 같은 규칙(지속 뒤 쿨)으로 맞춘다.
//   ⚠ 이 경로는 **의무병 전용**이다(`SKILLS.heal` 은 `_stkApplyAlly` 에서 의무병을 빼고 있다).
//     둘을 헷갈리지 말 것 — 화면에서 도는 치유는 이쪽이다.
//   ⚠ 남은 시간을 `u.buff`/`u.skillCd` 에 두지 않는다 — 거기는 `strikeSkillTick` 이
//     따로 깎아서 **두 번 깎인다**. 여기서만 쓰는 `_healDur`/`_healCd` 로 둔다.
const STK_HEAL_DUR = 3;      // 🏕 한 번 시작하면 이어지는 시간(초)
const STK_HEAL_CD  = 5;      // 🏕 지속이 끝난 뒤 쉬는 시간(초)
function strikeHealStep(u, me, dt){
  const camp = _stkCampSk();
  if(camp){                                  // ⏱ 마나가 아니라 쿨로 돈다
    if((u._healCd||0) > 0) u._healCd = Math.max(0, u._healCd - dt);
    else if((u._healDur||0) > 0){ u._healDur = Math.max(0, u._healDur - dt);
      if(u._healDur <= 0) u._healCd = STK_HEAL_CD; } }   // ⛔ 지속이 끝나야 쿨이 돈다
  let t=null, td=Infinity;   // ① 가장 가까운 부상 바이오닉
  for(const a of me.units){ if(a===u || a.dead || a.hp>=a.maxHp || !BIONIC[a.gm||a.id]) continue;
    const dx=a.x-u.x, dy=a.y-u.y, d2=dx*dx+dy*dy; if(d2<td){ td=d2; t=a; } }
  if(t && td<=STK_HEAL_SEEK*STK_HEAL_SEEK){
    if(td>STK_HEAL_RNG*STK_HEAL_RNG){ strikeMoveToward(u, t.x, t.y, dt); return; }
    u.moving=false; u.face=Math.atan2(t.x-u.x, t.y-u.y);
    if(camp){
      if((u._healCd||0) > 0) return;                            // 쉬는 중 — 곁에 붙어만 있는다
      if((u._healDur||0) <= 0) u._healDur = STK_HEAL_DUR;       // 새로 시작
      t.hp = Math.min(t.maxHp, t.hp + STK_HEAL_HPS*dt); return; }
    let amt=STK_HEAL_HPS*dt;
    if(u.maxEn>0){ amt=Math.min(amt, (u.en||0)/STK_HEAL_EN); u.en=Math.max(0,(u.en||0)-amt*STK_HEAL_EN); }   // 에너지 소진 시 치유 중단
    t.hp=Math.min(t.maxHp, t.hp+amt); return; }
  let f=null, fd=Infinity;   // ② 치유할 대상이 없으면 본대를 따라간다
  for(const a of me.units){ if(a===u || a.dead || HEALER[a.gm||a.id]) continue;
    const dx=a.x-u.x, dy=a.y-u.y, d2=dx*dx+dy*dy; if(d2<fd){ fd=d2; f=a; } }
  if(f && fd>STK_HEAL_RNG*STK_HEAL_RNG) strikeMoveToward(u, f.x, f.y, dt); else u.moving=false; }
// ⚡ u쪽 항(사거리×배수 + 내 반경)은 프레임 안에서 불변 → 유닛당 프레임 1회만 계산하고 재사용.
//    표적 탐색 루프에서 600기 기준 프레임당 7만 회 이상 불리던 지점(호출마다 typeof + 함수호출 + 곱셈이 있었다).
function strikeReach(u,t){ const _t=(typeof STK!=='undefined'&&STK)?STK.t:0;
  if(u._rchT!==_t){ u._rchT=_t; u._rchU=u.rng*((typeof strikeRngMul==='function')?strikeRngMul(u):1)+(u.size||14)*0.95; }
  return u._rchU + ((t&&t.size)||14)*0.95; }   // 유효 사거리 = 사거리 + 두 유닛 반경(겹침 방지 간격보다 넉넉하게 — 밀려나도 계속 타격)
const STK_UNIT_CAP=0;   // 진영당 유닛 상한 — 0=무제한(인구 제한 없음)
const STK_CELL=105;          // 전장 1칸(월드) — 신전 점유 구역 계산 기준
function strikeTempleCells(o){ const S=STK; return (S&&o===S.central)?2:4; }   // 메인·2차=4×4 / 중립=2×2
function strikeTempleHalf(o){ return strikeTempleCells(o)*STK_CELL/2; }
// 신전은 정사각형(반폭 = strikeTempleHalf) — 원으로 재면 모서리 쪽에서 필요보다 깊이 파고든다.
function strikeTempleGap(t,x,y){ const h=strikeTempleHalf(t), dx=Math.abs(x-t.x)-h, dy=Math.abs(y-t.y)-h;   // 표면까지의 실제 최단거리
  return Math.hypot(Math.max(0,dx), Math.max(0,dy)); }
function strikeTempleR(t,ang){ const h=strikeTempleHalf(t);   // 중심에서 그 방향 표면까지의 거리(정사각형)
  return h/Math.max(0.0001, Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)))); }
function strikeTempleRects(){ const S=STK; if(!S) return []; const out=[];
  for(const t of [S.me.base,S.ai.base,S.me.sec,S.ai.sec,S.central]){ if(!t||t.dead) continue;
    const h=strikeTempleHalf(t); out.push({o:t, x:t.x, y:t.y, hw:h, hh:h}); } return out; }
const STK_MOVE_SPAN=1800;   // 이동 물리 좌표계: 월드 1800 = 공용 함수 1.0 (U.moveSpd 환산과 일치)
// 유닛 이동 = 관리자·네모와 같은 공용 물리(stepUnitMove: 관성·정지유닛 회피·목표 감속·정착·이동방향 응시)
// ── 공유 흐름장(flow field) ───────────────────────────────────────────────
//  목적지마다 격자 비용지도를 '한 번' 만들고, 전 유닛이 자기 칸의 방향만 O(1)로 읽는다.
//  유닛별 경로탐색이 아니라 전군이 지도 한 장을 공유 → 경로가 흔들리지 않고, 유닛 수에 비례하지 않는다.
//  장애물 = 살아있는 신전(원)만. 다른 유닛은 여기 넣지 않는다(지역 회피·겹침 해소가 담당).
const STK_FF_CELL=64,    // 격자 크기(월드)
      STK_FF_CLR=26,     // 신전 주위 여유(평균 유닛 반지름)
      STK_FF_NEAR=420,   // 이 거리 밖에서만 흐름장 사용(가까우면 접근 로직이 담당)
      STK_FF_LOOK=260;   // 흐름 방향으로 몇 만큼 앞을 목표로 삼을지
let _stkFFC=new Map(), _stkFFSig='', _stkFFS=null, _stkGK=0;
function strikeGoalKey(o){ if(o._gk==null) o._gk=++_stkGK; return o._gk; }   // 신전은 uid가 없다 → 안정적인 키 부여
function _ffSig(){ const S=STK; let s='';
  for(const t of [S.me.base,S.ai.base,S.me.sec,S.ai.sec,S.central]) s+=(t&&!t.dead)?'1':'0'; return s; }   // 신전이 부서지면 지도 재생성
function strikeFlowField(goal){ const S=STK; if(!S||!goal||goal.dead) return null;
  if(_stkFFS!==S){ _stkFFS=S; _stkFFC.clear(); _stkFFSig=''; }   // 새 판 = 캐시 폐기
  const sig=_ffSig(); if(sig!==_stkFFSig){ _stkFFC.clear(); _stkFFSig=sig; }
  const key=strikeGoalKey(goal); let f=_stkFFC.get(key); if(f) return f;
  const N=Math.ceil(S.world/STK_FF_CELL), CO=[];
  for(const R of strikeTempleRects()){ if(R.o!==goal) CO.push(R); }   // 목표 신전 자신은 장애물에서 제외(그 앞까지 가야 하므로)
  const INF=0x3fffffff, cost=new Int32Array(N*N).fill(INF), blk=new Uint8Array(N*N);
  for(let cy=0;cy<N;cy++) for(let cx=0;cx<N;cx++){ const px=(cx+0.5)*STK_FF_CELL, py=(cy+0.5)*STK_FF_CELL;
    for(let i=0;i<CO.length;i++){ const R=CO[i], dx=px-R.x, dy=py-R.y, rr=R.hw+STK_FF_CLR;
      if(dx*dx+dy*dy<rr*rr){ blk[cy*N+cx]=1; break; } } }
  const buckets=[]; let maxB=0;   // Dial's 알고리즘(비용 10/14 정수 → 버킷 큐, 힙 없이 O(칸))
  const push=(i,c)=>{ cost[i]=c; (buckets[c]||(buckets[c]=[])).push(i); if(c>maxB) maxB=c; };
  const gr=strikeTempleHalf(goal)+70;   // 시드 = 목표 신전을 둘러싼 링 전체(중심은 장애물 안이라 못 쓴다)
  const x0=Math.max(0,Math.floor((goal.x-gr)/STK_FF_CELL)), x1=Math.min(N-1,Math.floor((goal.x+gr)/STK_FF_CELL));
  const y0=Math.max(0,Math.floor((goal.y-gr)/STK_FF_CELL)), y1=Math.min(N-1,Math.floor((goal.y+gr)/STK_FF_CELL));
  for(let cy=y0;cy<=y1;cy++) for(let cx=x0;cx<=x1;cx++){ const i=cy*N+cx; if(blk[i]) continue;
    const px=(cx+0.5)*STK_FF_CELL, py=(cy+0.5)*STK_FF_CELL;
    if(Math.hypot(px-goal.x,py-goal.y)<=gr) push(i,0); }
  const DX=[1,-1,0,0,1,1,-1,-1], DY=[0,0,1,-1,1,-1,1,-1], DC=[10,10,10,10,14,14,14,14];
  for(let c=0;c<=maxB;c++){ const b=buckets[c]; if(!b) continue;
    for(let bi=0;bi<b.length;bi++){ const i=b[bi]; if(cost[i]!==c) continue;   // 이미 더 싼 값으로 갱신됐으면 건너뜀
      const cx=i%N, cy=(i/N)|0;
      for(let k=0;k<8;k++){ const nx=cx+DX[k], ny=cy+DY[k]; if(nx<0||ny<0||nx>=N||ny>=N) continue;
        const ni=ny*N+nx; if(blk[ni]) continue; const nc=c+DC[k];
        if(nc<cost[ni]) push(ni,nc); } } }
  f={N:N, cost:cost, blk:blk}; _stkFFC.set(key,f); return f; }
function strikeFlowDir(f,x,y){ if(!f) return null;   // 자기 칸에서 비용이 가장 낮은 이웃 방향
  const N=f.N, cx=Math.floor(x/STK_FF_CELL), cy=Math.floor(y/STK_FF_CELL);
  if(cx<0||cy<0||cx>=N||cy>=N) return null;
  const DX=[1,-1,0,0,1,1,-1,-1], DY=[0,0,1,-1,1,-1,1,-1];
  let bc=f.cost[cy*N+cx], bx=0, by=0;
  for(let k=0;k<8;k++){ const nx=cx+DX[k], ny=cy+DY[k]; if(nx<0||ny<0||nx>=N||ny>=N) continue;
    const ni=ny*N+nx; if(f.blk[ni]) continue; const c=f.cost[ni];
    if(c<bc){ bc=c; bx=DX[k]; by=DY[k]; } }
  if(!bx&&!by) return null; const d=Math.hypot(bx,by)||1; return {x:bx/d, y:by/d}; }
// ── 유닛 간격의 단일 기준(반지름 단일 소스) ────────────────────────────────
//  겹침 최소거리 = (a.size+b.size)*STK_SEP  ←  이 값 하나에서 회피 반경도 파생된다.
//  회피 시작 = 겹침거리의 1.25배가 되도록 환산: 공용식 (0.62+0.62)*2.4=1.488 → STK_AVOID=1.3*1.25/1.488
const STK_SEP=1.3, STK_AVOID=1.09;
// 공중은 같은 층끼리 더 겹칠 수 있다(스타 원작도 공중 유닛은 서로 파고든다) — 뒤로 밀려 사거리 밖으로 나가는 것을 막는다.
//   회피 반경도 같은 비율로 줄여야(간격의 1.25배 유지) 밀어내기와 간격이 서로 싸우지 않는다.
const STK_SEP_AIR=0.95, STK_AVOID_AIR=+(STK_AVOID*(0.95/1.3)).toFixed(3);
// 표적 배분: 한 표적에 붙을 수 있는 인원은 '그 표적 주위 둘레 ÷ 내 간격'으로 정해진다(원거리는 넉넉, 근접은 적다).
const STK_PG_WIN=0.45, STK_PG_HOLD=0.5, STK_PG_TRY=0.22;   // 진행도 판정 창 / 못 나아갈 때 서 있는 시간 / 재시도 시간
const STK_STEER_MAX=0.85,   // 회피력 상한(<1) — 전진 성분을 뒤집지 못하게 해 앞뒤 진동을 원천 차단
      STK_RADIAL=0.5;       // 회피의 '밀어내기' 성분 배율 — 겹침 방지는 strikeSeparate가 담당하므로 절반만
const STK_GIVEUP=1.5,   // 이 시간 동안 표적에 다가가지 못하면 표적을 포기하고
      STK_BLIST=2.5;    // 이 시간 동안 그 표적을 다시 고르지 않는다
// 접근 지점: 대상 중심에서 반경 r인 링 위의 점. 전진이 멈추면 링을 따라 옆으로 쓸어 빈 자리를 찾는다.
//  (대열에 막혀 좌우 회피력이 상쇄되는 국소 최소점 탈출 — 경로탐색 없이 목표점 하나로 해결)
const STK_SWEEP_RATE=0.9, STK_SWEEP_MAX=Math.PI*0.9, STK_SWEEP_A0=0.5;   // 우회 각속도(rad/s) · 최대 각 · 시작 각
const STK_ANCH_LOCK=1.6;   // 접근 반경의 이 배율 안으로 들어오면 공격 방향을 고정(그 뒤로는 밀려도 되돌아온다)
const STK_BLK_T=0.6, STK_SWEEP_IN=40;   // 전진이 이 시간 이상 멈추면 우회 시작 · 우회 중 안쪽으로 파고드는 폭
function strikeApproachPt(u, cx, cy, r, key, dt){
  const dx=u.x-cx, dy=u.y-cy, cd=Math.hypot(dx,dy)||1;
  if(u._pck!==key){ u._pck=key; u._pcd=null; u._blk=0; u._swp=0; u._swpT=0; u._anch=null; }   // 대상이 바뀌면 진행도·기준 방향 초기화
  if(u._pcd!=null && cd < u._pcd-0.5) u._blk=0; else u._blk=(u._blk||0)+dt;   // 중심에 가까워지고 있으면 전진 중
  u._pcd=cd;
  if(u._swp){ if(cd < u._swpD-STK_SWEEP_IN){ u._swp=0; u._swpT=0; } }   // 충분히 파고들었으면 우회 종료(이력 — 매 프레임 깜빡이지 않게)
  else if(u._blk>STK_BLK_T){ u._swp=1; u._swpT=0; u._swpD=cd; u._swpS=(Math.random()<0.5)?1:-1; }   // 막힘 확정 → 한쪽 방향으로 우회 시작
  const _bear=Math.atan2(dy,dx);
  if(u._anch==null || cd>r*STK_ANCH_LOCK) u._anch=_bear;   // 도착 전 = 항상 '내 위치에서 가장 가까운 방향' / 도착 후 = 고정
  // 고정 이후에는 군중에 밀려도 기준 방향이 따라가지 않으므로 원래 자리로 되돌아온다(링을 따라 표류하지 않음).
  // 대상이 크게 움직여 다시 멀어지면 위 조건으로 자동 재설정된다.
  let a=u._anch, rr=r;
  if(u._swp){ u._swpT+=dt;
    a+=u._swpS*Math.min(STK_SWEEP_MAX, STK_SWEEP_A0+u._swpT*STK_SWEEP_RATE);   // 접선으로 흘러 대열 바깥을 돌고
    rr=Math.max(r, cd-STK_SWEEP_IN); }                                          // 동시에 조금씩 안으로 = 나선 접근
  return {x:cx+Math.cos(a)*rr, y:cy+Math.sin(a)*rr}; }
// 이동 = 공용 물리(stepUnitMove) 한 번 호출이 전부. 격자 경로탐색·정체감지·대기 상태 없음.
//  전장의 정적 장애물은 신전(원) 5개뿐 → 원형 회피(extraSteer)로 충분하다.
//  다른 유닛은 '경로'가 아니라 '국소 회피 + 겹침 해소'로만 처리한다(스타크래프트와 같은 방식).
function strikeMoveToward(u,tx,ty,dt){ const S=STK; if(!S) return;
  // 🧍 진행도 창: 창 동안 실제 순변위가 거의 없으면 '벽에 밀고 있는' 상태 → 힘을 빼고 선다(제자리 달리기·경련 제거).
  //   대기 후 짧게 다시 시도하므로 자리가 나면 곧바로 들어간다(영구 동결 없음).
  u._pgT=(u._pgT||0)-dt;
  if(u._pgT<=0){ const _net=(u._pgX==null)?1e9:Math.hypot(u.x-u._pgX, u.y-u._pgY);
    if(u._pgHold){ u._pgHold=false; u._pgT=STK_PG_TRY; }                                     // 대기 종료 → 재시도 창
    else { u._pgHold=(_net<Math.max(12,(u.size||14)*0.5)); u._pgT=u._pgHold?STK_PG_HOLD:STK_PG_WIN; }
    u._pgX=u.x; u._pgY=u.y; }
  if(u._pgHold){ u._vx=0; u._vy=0; if(u._mvp){ u._mvp.vx=0; u._mvp.vy=0; } u.moving=false; return; }
  if(u.dep>0) u.depT=u.dep;   // 🗿 움직이면 전개가 다시 걸린다(자리 잡는 시간이 곧 기동 페널티다)
  if(typeof stepUnitMove!=='function'){ const dx=tx-u.x, dy=ty-u.y, d=Math.hypot(dx,dy)||1;   // 폴백(공용 함수 없음)
    u.x+=dx/d*u.spd*dt; u.y+=dy/d*u.spd*dt; u.face=Math.atan2(dx,dy); u.moving=true; return; }
  const SP=STK_MOVE_SPAN, key=u.gm||u.id;
  if(u.skillOn&&u.skillOn.siege){ u.moving=false; return; }   // 공성 모드 = 고정
  const p=u._mvp||(u._mvp={}); p.x=u.x/SP; p.y=u.y/SP; p.vx=u._vx||0; p.vy=u._vy||0; p.face=u.face; p._skSpdMul=(1/((typeof MOVE_MUL!=='undefined')?MOVE_MUL:1))*((u.buff&&u.buff.stim>0)?(SKILLS.stim.spdMul||1):1)*strikeFrzSpdMul(u, S[u.side])*strikeSlowMul(u);   // 🐌 둔화(점착 가스)도 여기서 곱한다   // 공용 함수는 def.moveSpd×MOVE_MUL로 달린다 → 오토배틀 기준 속도(moveSpd×1800)로 환산 · 🐺 광폭화 이속
  const R=(u.size+46)*7, R2=R*R, staticN=[];
  { const _nb=strikeNear(u.x, u.y, R, u._nbBuf||(u._nbBuf=[]));   // ⚡ 격자 근접 질의(전체 순회 제거)
    for(let i=0;i<_nb.length;i++){ const o=_nb[i]; if(o===u||o.dead||o.moving) continue;   // 멈춰 있는 유닛만 회피 대상
      const ox=o.x-u.x, oy=o.y-u.y; if(ox*ox+oy*oy>R2) continue; const ok=o.gm||o.id;
      staticN.push({ref:o, x:o.x/SP, y:o.y/SP, sizeKey:ok, airKey:ok}); } }
  const _lim=S.world/SP, cl=(x,y)=>({x:Math.max(0,Math.min(_lim,x)), y:Math.max(0,Math.min(_lim,y))});
  const _air=strikeIsAir(u), _rects=_air?[]:strikeTempleRects(), _mgn=(u.size||14)*0.7;   // 공중 유닛은 신전 위를 그대로 통과
  const _steer=function(dirx,diry){ let sx=0, sy=0;   // 신전은 원형으로 취급(공격 판정과 동일) → 밀림·재접근 반복 없음
    for(const R of _rects){ const dx=u.x-R.x, dy=u.y-R.y, cd=Math.hypot(dx,dy)||1, d=Math.max(0, cd-R.hw);
      const near=R.hw*0.9; if(d>near) continue; const w=1-d/near, nx=dx/cd, ny=dy/cd;
      sx+=nx*w*1.3; sy+=ny*w*1.3;                                  // 바깥으로
      const tgx=-diry, tgy=dirx, side=(tgx*(R.x-u.x)+tgy*(R.y-u.y))>=0?-1:1; sx+=tgx*side*w*1.0; sy+=tgy*side*w*1.0; }   // 접선으로 돌아가기
    return (sx||sy)?{sx:sx, sy:sy}:null; };
  // noStuck: 직스의 목표는 살아 움직이는 추적 대상 → '가까워지지 않으면 포기'는 해롭다(멈춤·속도 0 → 재가속 버벅임의 원인).
  const r=stepUnitMove(p, {x:tx/SP, y:ty/SP}, key, key, dt, { GW:S.cw||390, GH:S.ch||648, clamp:cl, staticN:staticN, avoidMul:(_air?STK_AVOID_AIR:STK_AVOID), extraSteer:_steer, noStuck:true, airAvoid:true, steerMax:STK_STEER_MAX, radialMul:STK_RADIAL, faceHold:true, faceRate:7 });
  u.x=p.x*SP; u.y=p.y*SP; u._vx=p.vx||0; u._vy=p.vy||0; if(p.face!=null) u.face=p.face; u.moving=!(r&&r.done);
  
  for(const R of _rects){ const dx=u.x-R.x, dy=u.y-R.y, cd=Math.hypot(dx,dy)||1, need=R.hw+_mgn;   // 원형 밀어내기(공격 판정과 같은 경계)
    if(cd<need){ u.x=R.x+dx/cd*need; u.y=R.y+dy/cd*need; } } }
// 🔮 마나·쿨다운·자기 강화 — 관리자 SKILLS 데이터를 그대로 사용(자기강화/오라만 1단계 적용)
function strikeSkillTick(dt){ const S=STK; if(!S||typeof SKILLS==='undefined') return;
  _stkDotTick(S, dt);   // ⏳ 지속 피해 장판·도트 먼저 굴린다
  for(const side of ['me','ai']){ const me=S[side], foe=S[side==='me'?'ai':'me'];
    for(const u of me.units){ if(u.dead) continue;
      if(u.maxEn>0) u.en=Math.min(u.maxEn,(u.en||0)+STK_EN_REGEN*dt);   // 원본 SC 재생률
      if(u.skillCd) for(const k in u.skillCd){ if(u.skillCd[k]>0) u.skillCd[k]=Math.max(0,u.skillCd[k]-dt); }
      if(u.buff){ for(const k in u.buff){ if(u.buff[k]>0){ u.buff[k]-=dt; if(u.buff[k]<0) u.buff[k]=0; } } }
      // ⚠ **비싼 것부터** 시전한다 — 싼 것부터 쓰면 마나가 늘 바닥이라 비싼 스킬이 영영 안 나간다.
      const keys=u._skKeys||(u._skKeys=strikeSkillKeys(u).slice().sort((a,b)=>strikeSkillCost(SKILLS[b]||{})-strikeSkillCost(SKILLS[a]||{})));
      if(!keys.length) continue;
      u._skT=(u._skT||0)-dt; if(u._skT>0) continue; u._skT=0.4;   // 판정 주기(0.4초)
      let nearFoe=null, nd=Infinity;
      for(const e of foe.units){ if(e.dead) continue; const dx=e.x-u.x, dy=e.y-u.y, d2=dx*dx+dy*dy;
        if(d2<nd){ nd=d2; nearFoe=e; } }
      const inFight = nearFoe && nd<=Math.pow(strikeReach(u,nearFoe)*1.2,2);
      for(const k of keys){ const sk=SKILLS[k]; if(!sk) continue;
        const cost=strikeSkillCost(sk); if(cost>0 && (u.en||0)<cost) continue;
        if((u.skillCd&&u.skillCd[k]>0)) continue;
        if(sk.kind==='self'){          // 광폭화 — 교전 시작 시 on
          if(!inFight || (u.buff&&u.buff[k]>0)) continue;
          { const _hc=strikeSkillHpCost(sk); if(_hc && u.hp<=_hc*2) continue;
            u.buff[k]=sk.dur||5; if(_hc) u.hp-=_hc; }
          if(cost>0) u.en-=cost; u.skillCd[k]=strikeSkillCd(sk,0); }
        else if(sk.kind==='toggle'){   // 공성 모드 — 사거리 안에 적이 있으면 on, 없으면 off
          const want=!!(nearFoe && nd<=Math.pow(u.rng*(sk.rngMul||1),2));
          if(!!u.skillOn[k]===want) continue;
          u.skillOn[k]=want; u.skillCd[k]=(sk.cd||1); }
        else if(sk.kind==='aura'){ u.skillOn[k]=true; }   // 은신 장막 — 상시
        // ⭐ **대상을 고르는 스킬** (HUNT_R1 §3-4-2, 2026-08-27)
        //   ⚠ 예전에는 self/toggle/aura 만 처리했다. 그래서 마법 유닛 대부분이 **에너지만 채운 채 서 있었다.**
        //   ⛔ 「대상만 고르면 된다」가 아니었다 — 오토배틀에는 **효과를 적용하는 코드가 아예 없었다.**
        //     그래서 대상 선택 + 효과를 여기서 함께 낸다. 엔진에 걸 곳이 없는 효과(둔화·기절·실명·은신·
        //     순간이동·환영·정신지배·지연 폭격·지뢰 매설)는 **시전하지 않는다** — 에너지만 태우고
        //     아무 일도 안 일어나는 것이 아무것도 안 하는 것보다 나쁘다. 목록은 STK_SK_DEAD.
        else if(sk.kind==='target_unit'){ const t=_stkPickAlly(u, me, sk, k); if(!t) continue;
          if(!_stkApplyAlly(u, t, sk, k, dt)) continue;
          if(cost>0) u.en-=cost; { const _cd=strikeSkillCd(sk,0); if(_cd) u.skillCd[k]=_cd; } }
        else if(sk.kind==='target_enemy'){ const t=_stkPickFoe(u, foe, sk); if(!t) continue;
          if(!_stkApplyFoe(u, t, sk, k)) continue;
          if(cost>0) u.en-=cost; u.skillCd[k]=strikeSkillCd(sk,1); }
        else if(sk.kind==='target_ground'){ const c=_stkPickSpot(u, foe, sk); if(!c) continue;
          if(!_stkApplySpot(u, c, sk, k, foe)) continue;
          if(cost>0) u.en-=cost; u.skillCd[k]=strikeSkillCd(sk,1); }
      } } } }
// ── 🔮 자동 시전 ────────────────────────────────────────────────────────
// ⛔ **엔진에 걸 곳이 없어 시전하지 않는 스킬.** 둔화·기절·실명·은신은 이동/사격 코드가 읽는 값이 없고,
//    순간이동·환영·정신지배는 유닛을 만들거나 진영을 옮겨야 하며, 핵·지뢰는 설치물 시스템이 필요하다.
//    ⚠ 나중에 훅을 만들면 여기서 빼면 된다 — 시전 코드는 이미 준비돼 있다.
// ⛔ **엔진에 걸 곳이 없어 시전하지 않는 스킬** — 마나만 태우고 아무 일도 안 일어나는 것이
//   아무것도 안 하는 것보다 나쁘다. 기능이 생기면 여기서 뺀다.
//   ✅ 뺀 것 — 봉쇄·빙결·마비 폭풍(정지) · 점착 가스(둔화) : 2026-08-28, HUNT_R1 §3-4-4
const STK_SK_DEAD={ nuke:1, spider_mine:1, mind_control:1,
  disruption_web:1, recall:1, hallucination:1, parasite:1, dark_swarm:1,
  optical_flare:1, restoration:1, scan:1, psi_cloak:0 };
const STK_SK_ALLY_HURT=0.9;    // 아군 대상 = 체력 비율이 이보다 낮을 때만(멀쩡한 아군에 쓰지 않는다)
const STK_SK_SPOT_MIN=3;       // 광역 = 적이 이만큼 뭉쳤을 때만(한두 기에 쓰면 낭비)
// ⚠ SKILLS 의 range/radius 는 **건설 화면의 0~1 정규 좌표**다. 오토배틀은 픽셀(world=4800)이라
//    반드시 world 를 곱한다. 안 곱하면 사거리가 0.14픽셀이 되어 아무에게도 안 닿는다.
function _stkSkLen(v){ const S=STK; return (v||0)*((S&&S.world)||4800); }
// ⚠ **마법 전용 유닛은 사거리가 0이다**(하이템플러·이지스 — 평타가 없다). 공격 사거리로 잡으면
//    영원히 시전 못 한다. 그래서 sk.range 가 없으면 **최소 시전 사거리**를 바닥으로 깐다.
const STK_SK_CAST_R=0.13;   // 정규 좌표(원본 SC 마법 사거리 ≈ 9~10칸)
function _stkSkRange(u, sk){ const base=sk.range ? _stkSkLen(sk.range) : (u.rng||0)*1.2;
  return Math.max(base, _stkSkLen(STK_SK_CAST_R)); }
// ⏳ 지속 피해(번개 폭풍·역병·방사능) — 엔진에 장판이 없어서 여기서 목록으로 굴린다.
function _stkDotTick(S, dt){ const D=S._dots; if(!D||!D.length) return;
  for(let i=D.length-1;i>=0;i--){ const z=D[i]; z.left-=dt;
    if(z.tgt){ const t=z.tgt; if(!t.dead){ strikeHit(t, z.dps*dt, z.src); if(t.hp<=0) t.dead=true; } }
    else { const foe=S[z.foe]; if(foe) for(const e of foe.units){ if(e.dead) continue;
        const dx=e.x-z.x, dy=e.y-z.y; if(dx*dx+dy*dy>z.r2) continue;
        strikeHit(e, z.dps*dt, z.src); if(e.hp<=0) e.dead=true; } }
    if(z.left<=0) D.splice(i,1); } }
function _stkDotAdd(S, z){ (S._dots||(S._dots=[])).push(z); }
// ── 🔮 대상 고르기 ──────────────────────────────────────────────────────
// 사거리 안에서 **가장 많이 다친 아군**. ⚠ 포식만 예외 — 아군을 잡아먹으므로 **가장 값싼 아군**을 고른다
//   (체력으로 고르면 다친 전함을 먹는다).
function _stkPickAlly(u, me, sk, key){
  const R=_stkSkRange(u, sk), R2=R*R; let best=null, bv=Infinity;
  for(const a of me.units){ if(a.dead || a===u) continue;
    const dx=a.x-u.x, dy=a.y-u.y; if(dx*dx+dy*dy>R2) continue;
    if(key==='consume'){ const c=(((typeof U!=='undefined')&&U[a.gm||a.id])||{}).cost||((a.maxHp||1)+(a.dmg||0)*10);
      if(c<bv){ bv=c; best=a; } continue; }
    const r=(a.hp||0)/Math.max(1,a.maxHp||a.hp||1);
    if(r>=STK_SK_ALLY_HURT) continue;                 // 멀쩡하면 대상 아님
    if(r<bv){ bv=r; best=a; } }
  return best; }
// 사거리 안에서 **체력이 가장 높은 적**
function _stkPickFoe(u, foe, sk){
  const R=_stkSkRange(u, sk), R2=R*R; let best=null, bv=-1;
  for(const e of foe.units){ if(e.dead) continue;
    const dx=e.x-u.x, dy=e.y-u.y; if(dx*dx+dy*dy>R2) continue;
    const v=(e.hp||0)+(e.sh||0); if(v>bv){ bv=v; best=e; } }
  return best; }
// 사거리 안에서 **적이 가장 많이 뭉친 지점**. 적이 STK_SK_SPOT_MIN 미만이면 쓰지 않는다.
function _stkPickSpot(u, foe, sk){
  const R=_stkSkRange(u, sk), R2=R*R, rad=_stkSkLen(sk.radius||0.08), rad2=rad*rad, near=[];
  for(const e of foe.units){ if(e.dead) continue;
    const dx=e.x-u.x, dy=e.y-u.y; if(dx*dx+dy*dy<=R2) near.push(e); }
  if(near.length<STK_SK_SPOT_MIN) return null;
  let best=null, bn=0;
  for(const c of near){ let n=0;
    for(const e of near){ const dx=e.x-c.x, dy=e.y-c.y; if(dx*dx+dy*dy<=rad2) n++; }
    if(n>bn){ bn=n; best=c; } }
  return (bn>=STK_SK_SPOT_MIN) ? {x:best.x, y:best.y, n:bn} : null; }
// ── 🔮 효과 내기 ────────────────────────────────────────────────────────
//   ⛔ 낼 수 없으면 false 를 돌려 **시전 자체를 취소**한다(에너지를 쓰지 않는다).
function _stkApplyAlly(u, t, sk, key, dt){
  if(STK_SK_DEAD[key]) return false;
  if(sk.hps){ if(HEALER[u.gm||u.id]) return false;   // 💉 의무병은 strikeHealStep 이 이미 치유한다(두 번 걸지 않는다)
    if((t.hp||0)>=(t.maxHp||0)) return false;
    t.hp=Math.min(t.maxHp||t.hp, (t.hp||0)+sk.hps*dt);
    { const _dr=strikeSkillDrain(sk); if(_dr) u.en=Math.max(0,(u.en||0)-_dr*dt); }
    return true; }
  if(sk.absorb){ if((t.sh||0)>0) return false;       // 🛡 보호막 — 실드로 얹는다(strikeHit 이 실드를 먼저 깎는다)
    t.sh=sk.absorb; t.maxSh=Math.max(t.maxSh||0, sk.absorb); return true; }
  if(sk.rate){ if((t.sh||0)>=(t.maxSh||0)) return false;   // 🔋 쉴드 충전 — 마나 1 → 실드 2
    const add=Math.min(sk.rate*10, (t.maxSh||0)-(t.sh||0)); if(add<=0) return false;
    t.sh=(t.sh||0)+add; return true; }
  if(key==='consume'){ if(!t||t===u) return false;   // 🍽 포식 — 값싼 아군을 먹고 마나
    if((u.en||0)>=(u.maxEn||0)*0.6) return false;    //   마나가 넉넉하면 아군을 죽이지 않는다
    t.dead=true; u.en=Math.min(u.maxEn||0,(u.en||0)+(sk.gain||50)); return true; }
  return false; }
function _stkApplyFoe(u, t, sk, key){
  if(STK_SK_DEAD[key]) return false;
  if(key==='broodling'){ t.hp=0; t.sh=0; t.dead=true; return true; }        // 🐛 즉사(스웜링 2기 소환은 미구현)
  if(key==='feedback'){ const en=t.en||0; if(en<=0) return false;           // 💥 마나 소각 — 남은 마나만큼 피해
    t.en=0; strikeHit(t, en, u); if(t.hp<=0) t.dead=true; return true; }
  if(key==='lockdown'){ if((t.stunT||0)>0) return false;                   // ⛔ 봉쇄 — 이미 멎은 적에 겹치지 않는다
    t.stunT=sk.dur||5; return true; }
  if(sk.dps){ _stkDotAdd(STK, {tgt:t, dps:sk.dps, left:sk.dur||1, src:u}); return true; }   // ☢ 방사능
  if(sk.dmg){ strikeHit(t, sk.dmg, u); if(t.hp<=0) t.dead=true; return true; }               // 💥 집중포
  return false; }
function _stkApplySpot(u, c, sk, key, foe){
  if(STK_SK_DEAD[key]) return false;
  const rad=_stkSkLen(sk.radius||0.08), r2=rad*rad;
  if(key==='emp'){ let n=0;                                   // ⚡ EMP — 범위 안 마나·실드 소거
    for(const e of foe.units){ if(e.dead) continue; const dx=e.x-c.x, dy=e.y-c.y; if(dx*dx+dy*dy>r2) continue;
      if((e.en||0)>0||(e.sh||0)>0){ e.en=0; e.sh=0; n++; } }
    return n>0; }
  // ⛔ **정지** — 빙결·마비 폭풍. 범위 안 적이 그 자리에 멎는다.
  //   ⚠ 이미 멎어 있는 적에게는 겹치지 않는다 — 두 시전이 겹치면 사실상 영구 정지가 된다.
  if(key==='stasis' || key==='maelstrom'){ let n=0;
    for(const e of foe.units){ if(e.dead || (e.stunT||0)>0) continue;
      const dx=e.x-c.x, dy=e.y-c.y; if(dx*dx+dy*dy>r2) continue;
      e.stunT=sk.dur||3; n++; }
    return n>0; }
  // 🐌 **둔화** — 점착 가스. 느려질 뿐 계속 싸운다(정지와 다르다).
  if(key==='ensnare'){ let n=0;
    for(const e of foe.units){ if(e.dead) continue;
      const dx=e.x-c.x, dy=e.y-c.y; if(dx*dx+dy*dy>r2) continue;
      e.slowT=Math.max(e.slowT||0, sk.dur||8); n++; }
    return n>0; }
  const dps=sk.dps||sk.dmg; if(!dps) return false;
  _stkDotAdd(STK, {x:c.x, y:c.y, r2:r2, dps:dps, left:sk.dur||1, src:u, foe:foe===STK.me?'me':'ai'});   // ⚡ 번개 폭풍 · 🩸 역병
  return true; }
const STK_SD_AT=900, STK_SD_DPS=12, STK_SD_RAMP=0.02;   // 15분 후 시작 · 초당 피해(시간이 지날수록 가속)
function strikeSuddenDeath(dt){ const S=STK; if(!S||S.over||S.stress) return;   // 🧪 관측 모드는 서든 데스 없음(끝나면 안 됨)
  // 🏕 캠프 전장도 서든 데스 없음(strikeCheckOver 의 S.camp 가드와 같은 예외 · 2026-08-29).
  //   캠프는 S.t 가 전장 수명 내내 누적되어(라운드마다 리셋되지 않는다) 15분이 넘으면
  //   내 본부가 저절로 녹는다 — 실측(던전 2 R26)에서 「본부 HP 0」의 원인이 이것이었다.
  if(S.camp) return;
  const t=(S.t||0)-STK_SD_AT; if(t<=0) return;
  if(!S._sdMsg){ S._sdMsg=true; if(typeof strikeToast==='function') strikeToast('☠ 서든 데스 — 양 진영 메인 신전이 무너지기 시작합니다'); }
  const d=(STK_SD_DPS+t*STK_SD_RAMP)*dt;
  for(const sd of ['me','ai']){ const b=S[sd].base; if(!b||b.dead) continue;
    b.hp-=d; if(b.hp<=0){ b.hp=0; b.dead=true; } }
  strikeCheckOver(); }
const STK_TEMPLE_FADE=6;   // 신전 파괴 후 완전히 사라지기까지(초) — 서서히 흐려진다
function strikeTempleAlpha(o){ if(!o||!o.dead) return 1;   // 1=멀쩡 … 0=사라짐
  return Math.max(0, 1 - (o.deadT||0)/STK_TEMPLE_FADE); }
function strikeCheckOver(){ const S=STK; if(S.over) return;
  // ⛔ **캠프 전장(S.camp)은 오토배틀 승패 처리를 타지 않는다.**
  //    캠프는 strikeStepUnits 를 빌려 쓰는데, 그 안의 이 함수가 오토배틀의 게임오버를 돌린다:
  //      결과 화면 → 10초 뒤 overlayToLobby → G=newGame()
  //    실측에서 캠프 6분에 G 가 통째로 갈려 판이 사라졌다(BALANCE.md §3-2).
  //    캠프의 승패는 campCombatStep 이 따로 본다(적 전멸 / 본부 관통).
  if(S.camp) return;
  if(S.me.base.hp<=0) S.over='lose'; else if(S.ai.base.hp<=0) S.over='win';
  if(S.over){ if(typeof toast==='function') toast(S.over==='win'?'⚔️ 승리! 적 메인 신전 파괴':'💥 패배 — 메인 신전 붕괴');
    G.phase=(S.over==='win')?'won':'lost';   // 네모와 동일한 승패 오버레이 → 통계 화면 흐름 재사용
    document.body.classList.remove('sheetOpen'); const uc=document.getElementById('unitCmd'); if(uc){ uc.classList.remove('on'); uc.innerHTML=''; uc._stkSig=null; }   // 하단 프로필 정리
    if(typeof playSfx==='function') playSfx(S.over==='win'?'win':'lose');
    if(typeof showOverlay==='function') showOverlay(); } }
// (제거) strikeBuildOcc~strikeStepBuild — 구 오토배틀 전용 건설 구현. 건설지는 관리자 건설 시스템(G.tech)으로 통합됨
// 건물 풋프린트 → 월드 크기(자유 배치). fp:[w,h] 비율 × BUILD_UNIT. 미지정 시 4×4
function strikeFootprint(t){ const f=(t&&t.fp)||[4,4]; return {w:f[0]*BUILD_UNIT, h:f[1]*BUILD_UNIT}; }
// (제거) strikeCanPlace~strikePickBuild — 구 오토배틀 전용 건설 구현. 건설지는 관리자 건설 시스템(G.tech)으로 통합됨
// ═══ 공용 FX 코어(모든 유즈맵 공통 유닛별 공격 이펙트) ═══
// 유닛 id → 공격 스타일. 네모 발사체 비주얼을 그대로 — 한 곳에서 정의해 어느 맵이든 같은 느낌.
const ATK_STYLE={
  marine:    {kind:'bullet', color:'#ffe2a0', burst:3, burstGap:0.007, tr:0.5},   // 레인저: 트레일 가시도 ↓(여러발처럼 보임 완화)
  skyguard:  {kind:'bullet', color:'#ffe2a0', lng:2.7, hd:0.55, wd:0.8, spd:2.5},   // 템페스트: 더 얇고 길고 빠른 레이저(고속=즉시 명중)
  dreadnought:{kind:'bullet', color:'#ff7a66', core:'#ffffff', lng:3.6, hd:0.8, wd:1.3, spd:2.6, fz:1.6},   // 드레드노트: 배틀크루저식 대구경 레이저 — 템페스트보다 길고 두껍게·백색 코어·강한 머즐
  ghost:     {kind:'sniper', color:'#eafdff', spd:1.8},   // 팬텀: 저격탄 고속
  racer:     {kind:'bullet', color:'#ffe2a0', tr:0.5},   // 레이서: 앞 좌/우 총 각 1발 + 트레일 가시도 ↓
  striderSMG:{kind:'mg',     color:'#ffe2a0', burst:5, burstGap:0.025},   // 스트라이더 지상: 손 기관단총 연사
  goliath:   {kind:'missile',color:'#5ad1ff'},
  dragoon:   {kind:'plasma', color:'#7fb8ff', spd:0.78, szm:0.88, ramp:0.13},   // 센티넬: 푸른 구체 — 초반 잠깐 느리다 금방 최고속(램프 0.13s)
  archon:    {kind:'voidburst', color:'#dcb6ff', hit:0.4},   // 보이드: 손 앞 급성장 에너지 구체 → 넓은 영역 에너지 필. hit=손 뻗는 시점(0.4s) — 모션과 위상 고정 결합
  hydra:     {kind:'needle', color:'#9fd356'},
  tank:      {kind:'shell',  color:'#d8c8a0', spd:2.2},   // 브레이커: 포탄 얇고 고속·단일 타격
  blade:     {kind:'psicut', color:'#9fe8d8', melee:true, hit:0.3},   // 워든: 사이오닉 검격(테이퍼 칼자국+백열 심+에너지 파편) — 검이 지나가는 타이밍(0.3s)
  matron:    {kind:'claw',   color:'#ffd2cf', melee:true},
  thornqueen:{kind:'needle', color:'#bfe89a', count:3, boom:6},
  worker_human:{kind:'push', color:'#dfe7f2', melee:true, hit:0.3},   // 유니온 일꾼: 펀치 — hit초 뒤(타격 순간=0.55s 펀치의 신전 피크) 피격
  worker_swarm:{kind:'spit', color:'#a6e23c', count:3, boom:6},   // 스웜 일꾼: 독 가래를 여러 갈래로 뱉음
  worker_light:{kind:'shock', color:'#bfe6ff', beam:true, hold:1.3, op:0.42},   // 에테리얼 일꾼: 프로브식 지속 전기 아크(op=흐리게)
  // ── 관리자 맵 유닛 이식 이펙트(무기 타입별) — 기존 _default(총알) 대체 ──
  machinegun:{kind:'mg',     color:'#ffe2a0', burst:4, burstGap:0.03},   // 발칸: 기관총 연사
  hellfire:  {kind:'missile',color:'#ff9a5a'},   // 헬파이어: 화염 미사일
  aegis:     {kind:'bullet', color:'#bfe4ff'},   // 이지스: 방어포
  snapper:   {kind:'scythe', color:'#a8e05a', melee:true},   // 스내퍼: 낫 교차 베기(유기체 초록)
  stinger:   {kind:'missile',color:'#c8e89a'},   // 스팅어: 산성 미사일
  venom:     {kind:'spit', color:'#a6e23c'},   // 베놈: 입에서 독 가래 분사 + 감염 잔류(랩 전용 함수 발사)
  broodling: {kind:'claw',  color:'#9fd356', melee:true},   // 브루들링: 근접 할큄
  ultralisk: {kind:'claw',  color:'#c8e89a', melee:true},   // 울트라리스크: 근접 대형 칼날
  dark_templar:{kind:'psicut', color:'#7fe0b8', melee:true, x2:true, mul:1.25, hit:0.3},   // 다크템플러: X자 이중 사이오닉 검격+충격 링 — 워든보다 크고 강한 타격감
  medic:     {kind:'heal', color:'#bfe6ff'},   // 메딕: 치유(무공격 — 라벨용)
  larva:     {kind:'-', color:'#a8472e'},   // 라바: 무공격(라벨용)
  high_templar:{kind:'psi', color:'#ffd24a'},   // 하이템플러: 시전형(무공격 — 라벨용)
  medusa:    {kind:'psi',    color:'#c7a0ff'},   // 메두사: 사이오닉
  wyvern:    {kind:'shuriken', color:'#bfe89a'},   // 와이번: 회전 표창 3쿠션 튕김(랩 전용 함수 발사)
  behemoth:  {kind:'porb', color:'#a6e23c'},   // 베히모스(가디언): 꼬리에서 뭉친 독구슬 — 독연기 꼬리 + 착탄 독폭발(랩 전용 함수 발사)
  falcon:    {kind:'beam', color:'#6ec8ff', lng:3.0, hd:0.85, wd:0.9, spd:2.6},   // 팔콘: 파란 에너지 파동 빔(FxLab에선 날개 트윈 평행 발사)
  skydancer: {kind:'spark', color:'#9fd0ff'},   // 스카이댄서: 원거리 즉발(푸른 스파크) — 투사체·연결 없음, 발사구 미세 스파크 + 타격 지점 범위 스파크
  archangel: {kind:'plasma', color:'#ffd66a'},   // 아크엔젤: 플라즈마 포
  kronos:    {kind:'plasma', color:'#ffcf6a'},   // 크로노스: 시공 플라즈마
  _default:  {kind:'bullet', color:'#ffe2a0'},
};
// store={shots,impacts,melee}. 좌표는 해당 맵의 월드 단위. 그리기는 toScreen 변환 + sz(픽셀 스케일)만 맵이 공급.
const FX={
  sizeMul:1,   // 전역 크기 노브(이펙트 랩에서 조정 → 전 맵 즉시 반영)
  REF:18,      // 기준 유닛 월드크기 — 이펙트 크기 = sz × (유닛크기/REF). 큰 유닛=큰 이펙트
  store(){ return {shots:[], impacts:[], melee:[], deaths:[], smoke:[], flashes:[], hitK:1}; },   // hitK = 피격·사망 이펙트 세기(1=기본). 유즈맵별로 낮출 수 있게 스토어 단위로 둔다(공용 코어는 손대지 않음)
  spawn(store, id, sx,sy, tx,ty, opts){ if(!store) return; opts=opts||{}; const st=ATK_STYLE[id]||ATK_STYLE._default, col=opts.color||st.color;
    const szf=(opts.unitSize||FX.REF)/FX.REF*(st.szm||1);   // 유닛 크기 비례 계수 × 스타일별 크기 배율(szm)
    const dx=tx-sx, dy=ty-sy, dist=Math.hypot(dx,dy)||1, ang=Math.atan2(dy,dx);
    if(st.melee){ const _mm=st.mul||1, _pw=st.x2?2:1;
      store.melee.push({x:tx,y:ty,ang:ang,life:1,kind:st.kind,col:col,szf:szf*_mm,op:st.op,pw:_pw,sd:(store._sd=((store._sd||0)+1)&255)});
      if(st.x2) store.melee.push({x:tx,y:ty,ang:ang+1.75,life:1,kind:st.kind,col:col,szf:szf*_mm*0.92,op:st.op,pw:_pw,delay:0.09,sd:(store._sd=((store._sd||0)+1)&255)});   // X자 두 번째 베기(시차)
      return; }
    if(st.beam){ store.melee.push({kind:st.kind||'psi',x0:sx,y0:sy,x:tx,y:ty,life:1,col:col,szf:szf,op:st.op,sd:(store._sd=((store._sd||0)+1)&255),dk:(st.hold?1/st.hold:null)}); return; }
    if(st.kind==='spark'){   // 원거리 즉발(스카이댄서): 투사체·연결 없음 — 발사구 미세 스파크 + 타격 지점 범위 스파크(독립 2개)
      store.melee.push({kind:'sparkM',x:sx,y:sy,life:1,col:col,szf:szf,sd:(store._sd=((store._sd||0)+1)&255),dk:3.4});    // 발사구: 에너지 장전(공격 사이클 내내 보이게)
      store.melee.push({kind:'spark', x:tx,y:ty,life:1,col:col,szf:szf,sd:(store._sd=((store._sd||0)+1)&255),dk:3.2});  // 타격 지점: 연한 범위 스파크
      return; }
    if(st.kind==='voidburst'){   // 보이드: 손에서 고속 사이오닉 볼트 발사 → 꽂히는 순간 대상 지역이 에너지로 차오름(시전→타격 인과 연결, 직접 쏘는 느낌)
      const _vT=Math.max(0.05, dist/3.8), _vsp=dist/_vT;   // 비행 시간: 근거리 최소 0.05s(눈에 보이게), 원거리 고속(3.8/s)
      store.shots.push({x:sx,y:sy,vx:Math.cos(ang)*_vsp,vy:Math.sin(ang)*_vsp,t:0,dur:_vT+0.05,kind:'plasma',color:col,boom:3,szf:szf*0.4,mx:sx,my:sy,dist:dist,ex:tx,ey:ty,noflash:1});   // 손→대상 사이오닉 볼트(작고 밝게)
      store.melee.push({kind:'voidQ',x:tx,y:ty,life:1,col:col,szf:szf,sd:(store._sd=((store._sd||0)+1)&255),dk:3.2,delay:_vT});          // 볼트 도착 순간 급성장 구체
      store.melee.push({kind:'voidA',x:tx,y:ty,life:1,col:col,szf:szf,sd:(store._sd=((store._sd||0)+1)&255),dk:2.1,delay:_vT+0.14});   // 구체를 따라 영역 에너지 필
      return; }
    if(st.kind==='spit'){ const strands=st.count||5; if(store.shots.length>200) store.shots.splice(0, store.shots.length-200);   // 스웜 일꾼: 독 가래 여러 갈래(거리÷비행시간=스케일 독립)
      for(let i=0;i<strands;i++){ const a=ang+(i-(strands-1)/2)*0.24+(Math.random()-0.5)*0.18, dj=dist*(0.60+Math.random()*0.22), td=0.08+Math.random()*0.05, sp=dj/td;
        store.shots.push({x:sx,y:sy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,dur:td,kind:'spit',color:col,boom:st.boom||6,szf:szf*0.65*(0.7+Math.random()*0.7),delay:i*0.012+Math.random()*0.02,mx:sx,my:sy,dist:dj,ex:null,ey:null,noflash:true,wob:(Math.random()-0.5)*3.4}); }
      return; }
    const speed=(opts.speed||2600)*(st.spd||1), dur=Math.min(0.6,Math.max(0.05,dist/speed))+(st.ramp?st.ramp*0.45:0), n=st.count||1, burst=st.burst||1, bgap=st.burstGap||0.05;   // ramp 있으면 초반 감속분만큼 수명 보정
    if(store.shots.length>200) store.shots.splice(0, store.shots.length-200);
    for(let b=0;b<burst;b++) for(let i=0;i<n;i++){ const a=ang+(n>1?(i-(n-1)/2)*0.13:0);
      store.shots.push({x:sx,y:sy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,t:0,dur:dur,kind:st.kind,color:col,boom:st.boom||4,szf:szf,delay:b*bgap,mx:sx,my:sy,dist:dist,ex:sx+Math.cos(a)*dist,ey:sy+Math.sin(a)*dist,lng:st.lng||1,hd:st.hd||1,wd:st.wd||1,tr:(st.tr==null?1:st.tr),core:st.core,fz:st.fz,ramp:st.ramp}); } },
  death(store, x,y, opts){ if(!store) return; opts=opts||{}; const szf=(opts.unitSize||FX.REF)/FX.REF, col=opts.color||'#ffd0a0', parts=[];
    const _pn=(opts.parts==null?9:opts.parts);   // 파편 수(대군 전투에선 줄인다)
    for(let i=0;i<_pn;i++){ const a=Math.random()*6.283; parts.push({a:a, sp:42+Math.random()*70, len:4+Math.random()*5, col:(i%3===0?'#ffe6b0':col)}); }
    store.deaths.push({x:x,y:y,life:1,col:col,szf:szf,parts:parts}); },   // 통합 죽음 이펙트(섬광 링 + 코어 + 파편)
  smoke(store, x,y){ if(!store||!store.smoke) return;   // 어깨 포드 발사 연기(골리앗 등) — 위로 피어오르는 회색 구름
    for(let k=0;k<3;k++){ store.smoke.push({x:x+(Math.random()-0.5)*0.012, y:y, vx:(Math.random()-0.5)*0.03, vy:-0.05-Math.random()*0.045, life:1, r0:2.4+Math.random()*2, col:(k%2?'#5a5a66':'#7a7a86')}); } },
  advance(store, dt){ if(!store) return;
    const sh=store.shots; for(let i=sh.length-1;i>=0;i--){ const s=sh[i]; if(!s._fired){ if(s.delay>0){ s.delay-=dt; if(s.delay>0) continue; } s._fired=true; if(store.flashes && !s.noflash) store.flashes.push({x:s.mx,y:s.my,life:1,szf:s.szf||1,ang:Math.atan2(s.vy,s.vx),fz:s.fz}); } if(s.wob){ const cw=Math.cos(s.wob*dt), sw=Math.sin(s.wob*dt), nvx=s.vx*cw-s.vy*sw, nvy=s.vx*sw+s.vy*cw; s.vx=nvx; s.vy=nvy; } s.t+=dt; if(s.kind==='missile'&&s.ex!=null){ const _ta=Math.atan2(s.ey-s.y,s.ex-s.x), _ca=Math.atan2(s.vy,s.vx); let _da=_ta-_ca; _da=Math.atan2(Math.sin(_da),Math.cos(_da)); const _mt=7*dt, _na=_ca+Math.max(-_mt,Math.min(_mt,_da)), _msp=Math.hypot(s.vx,s.vy); s.vx=Math.cos(_na)*_msp; s.vy=Math.sin(_na)*_msp; const _dtg=Math.hypot(s.ex-s.x,s.ey-s.y); if(s._pd!=null && _dtg>s._pd && s._pd<0.2) s._boom=1; s._pd=_dtg; /* 목표 지나침(선회 반경 내 재접근 불가)=즉시 기폭 */ if(store.smoke && !s.notrail){ s.trailT=(s.trailT||0)-dt; if(s.trailT<=0){ s.trailT=0.03; store.smoke.push({x:s.x,y:s.y,vx:0,vy:0,life:1,r0:0.5*(s.szf||1),col:'#ff9a4c',core:'#ffd9a0',glow:true,dk:5,ex:1.0,af:0.5}); } } } if(s.grav) s.vy+=s.grav*dt; if(s.gt&&store.smoke){ s.trailT=(s.trailT||0)-dt; if(s.trailT<=0){ s.trailT=0.035; store.smoke.push({x:s.x,y:s.y,vx:(Math.random()-0.5)*0.008,vy:(Math.random()-0.5)*0.008,life:1,r0:(0.5+Math.random()*0.4)*(s.szf||1),col:'#7ca83c',ex:1.8,af:0.32,dk:2.8}); } }   // 포물선 + 독 연기 꼬리(gt 플래그)
      const _rf=(s.ramp&&s.t<s.ramp)?(0.34+0.66*Math.pow(s.t/s.ramp,1.6)):1;   // 가속 램프: 초반 잠깐 느리게 → 금방 최고속(이후 일정)
      s._dn=Math.hypot(s.vx,s.vy)*dt*_rf; s.x+=s.vx*dt*_rf; s.y+=s.vy*dt*_rf;
      if(s.landY!=null && s.vy>0 && s.y>=s.landY){ s.y=s.landY; store.impacts.push({x:s.x,y:s.landY,life:1,kind:(s.imk||s.kind),col:s.color,boom:s.boom||4,szf:s.szf||1,ang:Math.atan2(s.vy,s.vx),sd:(store._sd=((store._sd||0)+1)&255)}); sh.splice(i,1); continue; }   // 낙하 착지=꽂힘
      if((s.dist!=null && Math.hypot(s.x-s.mx,s.y-s.my)>=s.dist) || s.t>=s.dur || s._boom || (s.kind==='missile'&&s.ex!=null&&Math.hypot(s.x-s.ex,s.y-s.ey)<0.012)){ const _ix=(s.ex!=null?s.ex:s.x), _iy=(s.ey!=null?s.ey:s.y); store.impacts.push({x:_ix,y:_iy,life:1,kind:(s.imk||s.kind),col:s.color,boom:s.boom||4,szf:s.szf||1,ang:Math.atan2(s.vy,s.vx),sd:(store._sd=((store._sd||0)+1)&255)}); sh.splice(i,1); } }
    const im=store.impacts; for(let i=im.length-1;i>=0;i--){ im[i].life-=dt*(im[i].kind==='stab'?5.5:4.5); if(im[i].life<=0) im.splice(i,1); }   // stab(가시 박힘)=타격 즉시 사라짐
    const me=store.melee; for(let i=me.length-1;i>=0;i--){ const M=me[i]; if(M.delay>0){ M.delay-=dt; continue; } M.age=(M.age||0)+dt; M.life-=dt*(M.dk||5); if(M.life<=0) me.splice(i,1); }   // delay=발동 지연(보이드 버스트 등)
    const de=store.deaths; for(let i=de.length-1;i>=0;i--){ de[i].life-=dt*2.2; if(de[i].life<=0) de.splice(i,1); }
    const sm=store.smoke; if(sm) for(let i=sm.length-1;i>=0;i--){ const p=sm[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; if(!p.vk) p.vy*=0.95; p.life-=dt*(p.dk||1.7); if(p.life<=0) sm.splice(i,1); }   // vk=속도 유지(가스 스트림 등)
    const fl=store.flashes; if(fl) for(let i=fl.length-1;i>=0;i--){ fl[i].life-=dt*11; if(fl[i].life<=0) fl.splice(i,1); } },
  drawShots(ctx, store, toScreen, sz){ if(!store) return; sz=sz*(FX.sizeMul||1); ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
    if(store.smoke) for(const p of store.smoke){ const c=toScreen(p.x,p.y), L=Math.max(0,p.life), z=sz*0.9;   // 발사 연기(회색) / 엔진 분사(glow=푸른 발광)
      if(p.glow){ const r=(p.r0+(1-L)*1.1)*z; ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=L*0.5; ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(c.x,c.y,r,0,6.283); ctx.fill(); ctx.globalAlpha=L*0.75; ctx.fillStyle=(p.core||'#cfe6ff'); ctx.beginPath(); ctx.arc(c.x,c.y,r*0.4,0,6.283); ctx.fill(); }
      else { const r=(p.r0+(1-L)*(p.ex||7))*z; ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=L*(p.af||0.42); ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(c.x,c.y,r,0,6.283); ctx.fill(); } }
    ctx.globalAlpha=1;
    if(store.flashes) for(const fS of store.flashes){ const c=toScreen(fS.x,fS.y), L=Math.max(0,fS.life), _fz=(fS.fz||1), z=sz*(fS.szf||1)*_fz, fa=fS.ang||0, _fa=Math.min(1,_fz+0.3); ctx.globalCompositeOperation='lighter'; ctx.lineCap='round'; ctx.strokeStyle='#ffd779'; const _sp=[[0,4.5,1.2],[0.42,2.5,0.85],[-0.42,2.5,0.85],[1.5,1.3,0.65],[-1.5,1.3,0.65]]; for(let _q=0;_q<_sp.length;_q++){ const _a=fa+_sp[_q][0], _len=_sp[_q][1]*z*(0.4+L*0.7); ctx.globalAlpha=L*0.82*_fa; ctx.lineWidth=_sp[_q][2]*z; ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.lineTo(c.x+Math.cos(_a)*_len, c.y+Math.sin(_a)*_len); ctx.stroke(); } ctx.globalAlpha=L*0.95*_fa; ctx.fillStyle='#fff7d0'; ctx.beginPath(); ctx.arc(c.x,c.y,1.0*z*(0.4+L*0.7),0,6.283); ctx.fill(); }
    const _pxn=toScreen(1,0).x-toScreen(0,0).x;   // 정규화→px(가로) — 프레임 이동거리 환산
    for(const s of store.shots){ if(s.delay>0) continue; const c=toScreen(s.x,s.y), z=sz*(s.szf||1); ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.translate(c.x,c.y); ctx.rotate(Math.atan2(s.vy,s.vx)); ctx.scale(z,z);
      if(s._dn && (s.kind==='bullet'||s.kind==='sniper'||s.kind==='mg'||s.kind==='shell'||s.kind==='shuriken')){ const _tu=Math.min(52, s._dn*_pxn/Math.max(0.001,z)); if(_tu>8){ ctx.globalAlpha=0.3*(s.tr==null?1:s.tr); ctx.strokeStyle=s.color; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(-_tu,0); ctx.stroke(); ctx.globalAlpha=1; } }   // 프레임 간 이동 잔상 연결(빠른 탄이 점선처럼 여러발로 보이는 것 방지 → 하나의 연속 궤적)
      FX._shot(ctx,s); ctx.restore(); }
    ctx.globalCompositeOperation='lighter';
    const _hk=(store.hitK==null?1:store.hitK);   // 피격·사망 세기
    for(const im of store.impacts){ const c=toScreen(im.x,im.y), L=Math.max(0,im.life), p=1-L, z=sz*(im.szf||1)*_hk; ctx.save(); ctx.translate(c.x,c.y);
      if(im.kind==='shell'){ ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=L*0.45; ctx.fillStyle='#fff2c0'; ctx.beginPath(); ctx.arc(0,0,(1.2+p*1.4)*z,0,6.283); ctx.fill();   // 옅은 화염 코어
        ctx.globalAlpha=L*0.16; ctx.fillStyle='#ff9a3c'; ctx.beginPath(); ctx.arc(0,0,(2.0+p*2.6)*z,0,6.283); ctx.fill(); }   // 아주 옅은 글로우(산탄 제거)
      else if(im.kind==='stab'){ ctx.globalCompositeOperation='source-over'; ctx.rotate(im.ang||0);   // 가시 박힘(단순·현실적): 박힌 가시 + 자상 + 튀김 — 오래 남음
        ctx.globalAlpha=Math.min(1,L*1.4)*0.85; ctx.strokeStyle='#4c7a20'; ctx.lineWidth=1.4*z; ctx.beginPath(); ctx.moveTo(-2.0*z,0); ctx.lineTo(3.0*z,0); ctx.stroke();   // 자상 선(진입 방향)
        ctx.globalAlpha=Math.min(1,L*1.4); ctx.fillStyle='#9fd356'; ctx.beginPath(); ctx.moveTo(3.2*z,0); ctx.lineTo(0.4*z,0.9*z); ctx.lineTo(0.4*z,-0.9*z); ctx.closePath(); ctx.fill();   // 박혀 남은 가시(삼각)
        ctx.globalAlpha=Math.min(1,L*1.4); ctx.fillStyle='#eaffc0'; ctx.beginPath(); ctx.arc(0.4*z,0,0.75*z,0,6.283); ctx.fill();   // 박힌 점 하이라이트
        const g0=Math.min(1,(1-L)*5); for(let q=0;q<4;q++){ const an=(q-1.5)*0.5, dd=(1.2+p*2.6)*z; ctx.globalAlpha=L*0.55*g0; ctx.fillStyle='#79a828'; ctx.beginPath(); ctx.arc(2.6*z+Math.cos(an)*dd*0.5, Math.sin(an)*dd, 0.5*z, 0, 6.283); ctx.fill(); } }   // 앞쪽 미세 체액 튀김
      else if(im.kind==='needle'){ ctx.globalAlpha=L; ctx.strokeStyle=im.col; ctx.lineWidth=1.3*z; for(let q=0;q<5;q++){ const a=q*1.3+p, len=(4+p*6)*z; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*len,Math.sin(a)*len); ctx.stroke(); } }
      else if(im.kind==='bullet'||im.kind==='mg'){ ctx.globalCompositeOperation='lighter';   // 실제 피탄 — 희미한 작은 섬광 + 진행방향 짧은 비산(뭉침 방지)
        ctx.globalAlpha=L*0.4; ctx.fillStyle='#fff0c4'; ctx.beginPath(); ctx.arc(0,0,1.2*z*(0.5+L*0.7),0,6.283); ctx.fill();
        ctx.globalAlpha=L*0.45; ctx.strokeStyle=im.col||'#ffce86'; ctx.lineWidth=0.7*z; const ia=im.ang||0, sd=im.sd||0;
        for(let q=0;q<4;q++){ const a=ia+(q-1.5)*0.55+((sd*5+q*11)%9-4)*0.05, d0=(0.8+p*2.5)*z, d1=d0+(2.4+p*4)*z*(0.7+((sd+q*7)%5)/8); ctx.beginPath(); ctx.moveTo(Math.cos(a)*d0,Math.sin(a)*d0); ctx.lineTo(Math.cos(a)*d1,Math.sin(a)*d1); ctx.stroke(); } }
      else if(im.kind==='spit'){ ctx.globalCompositeOperation='source-over'; const sd=im.sd||0, gc=im.col||'#a6e23c';
        ctx.globalAlpha=L*0.16; ctx.fillStyle=gc; ctx.beginPath(); ctx.arc(0,0,(1.2+p*2.6)*z,0,6.283); ctx.fill();
        ctx.globalAlpha=L*0.45; ctx.fillStyle=gc; ctx.beginPath(); ctx.arc(0,0,(0.7+p*1.1)*z,0,6.283); ctx.fill();
        ctx.globalAlpha=L*0.4; ctx.fillStyle='#5f9e1e'; for(let q=0;q<3;q++){ const _a=q*2.1+sd*0.4, _d=(1+p*3.5)*z*(0.5+((sd+q*7)%5)/6), _r=(0.4+((sd*3+q*5)%4)/4*0.6)*z; ctx.beginPath(); ctx.arc(Math.cos(_a)*_d,Math.sin(_a)*_d,_r,0,6.283); ctx.fill(); } }
      else if(im.kind==='plasma'){ const psd=((im.x*11)|0)%7; ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';   // 플라즈마 구체 타격: 구체가 터지듯 — 푸른 톤·살짝 투명
        ctx.globalAlpha=L*0.5;  ctx.fillStyle=im.col||'#7fb8ff'; ctx.beginPath(); ctx.arc(0,0,(1.6+p*3.2)*z,0,6.283); ctx.fill();   // 팽창하는 반투명 코어
        ctx.globalAlpha=L*0.26; ctx.fillStyle=im.col||'#7fb8ff'; ctx.beginPath(); ctx.arc(0,0,(2.6+p*5.0)*z,0,6.283); ctx.fill();   // 외곽 글로우
        ctx.globalAlpha=L*0.42*(1-p*0.4); ctx.strokeStyle='#cfe6ff'; ctx.lineWidth=0.6*z; ctx.beginPath(); ctx.arc(0,0,(2.0+p*4.8)*z,0,6.283); ctx.stroke();   // 옅은 파열 링
        ctx.globalAlpha=L*0.5; ctx.fillStyle='#cfe6ff';   // 터져 나가는 방울(연푸른, 바깥으로 흩어짐)
        for(let q=0;q<5;q++){ const an=q*1.256+psd*0.23, dd2=(1.2+p*4.0)*z; ctx.beginPath(); ctx.arc(Math.cos(an)*dd2,Math.sin(an)*dd2,Math.max(0.1,(0.55-p*0.25))*z,0,6.283); ctx.fill(); } }
      else if(im.kind==='beam'){ const bsd=((im.x*13)|0)%7; ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';   // 팔콘 빔 타격: 또렷한 에너지 히트
        ctx.globalAlpha=L*0.85; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(0,0,(1.1+p*1.2)*z,0,6.283); ctx.fill();   // 밝은 타격 코어
        ctx.globalAlpha=L*0.38; ctx.fillStyle=im.col||'#6ec8ff'; ctx.beginPath(); ctx.arc(0,0,(2.2+p*4.0)*z,0,6.283); ctx.fill();   // 퍼지는 에너지 글로우
        ctx.globalAlpha=L*0.7*(1-p*0.4); ctx.strokeStyle=im.col||'#6ec8ff'; ctx.lineWidth=0.7*z; ctx.beginPath(); ctx.arc(0,0,(1.6+p*5.2)*z,0,6.283); ctx.stroke();   // 확장 링
        ctx.globalAlpha=L*0.6; ctx.strokeStyle='#dff2ff'; ctx.lineWidth=0.5*z;
        for(let q=0;q<4;q++){ const an=q*1.57+bsd*0.2, l1=(1.5+p*3.0)*z;   // 튀는 스파크 4가닥
          ctx.beginPath(); ctx.moveTo(Math.cos(an)*l1*0.4,Math.sin(an)*l1*0.4); ctx.lineTo(Math.cos(an)*l1,Math.sin(an)*l1); ctx.stroke(); } }
      else if(im.kind==='shurikenHit'){ ctx.globalCompositeOperation='lighter';   // 표창 그레이즈: 작고 자연스러운 타격(과한 섬광 X)
        ctx.globalAlpha=L*0.5; ctx.fillStyle='#eaffc0'; ctx.beginPath(); ctx.arc(0,0,(0.7+p*0.6)*z,0,6.283); ctx.fill();
        ctx.globalAlpha=L*0.32; ctx.strokeStyle=im.col||'#bfe89a'; ctx.lineWidth=0.55*z;
        for(let q=0;q<3;q++){ const a2=(im.ang||0)+(q-1)*0.5, d0=(0.5+p*1.0)*z, d1=d0+(1.2+p*1.6)*z; ctx.beginPath(); ctx.moveTo(Math.cos(a2)*d0,Math.sin(a2)*d0); ctx.lineTo(Math.cos(a2)*d1,Math.sin(a2)*d1); ctx.stroke(); } }
      else if(im.kind==='sniper'){ ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=L*0.4; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(0,0,(0.9+p*1.1)*z,0,6.283); ctx.fill();   // 희미한 흰 타격 코어
        ctx.globalAlpha=L*0.14; ctx.fillStyle=im.col||'#eafdff'; ctx.beginPath(); ctx.arc(0,0,(1.8+p*3.0)*z,0,6.283); ctx.fill(); }   // 아주 옅은 글로우
      else { ctx.globalAlpha=L*0.9; ctx.fillStyle='#fff6d8'; ctx.beginPath(); ctx.arc(0,0,3.5*z*(0.5+p),0,6.283); ctx.fill(); }
      ctx.restore(); }
    for(const m of store.melee){ if(m.delay>0) continue; const L=Math.max(0,m.life), z=sz*(m.szf||1);
      if(m.kind==='psi'){ const a=toScreen(m.x0,m.y0), b=toScreen(m.x,m.y); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=L; ctx.strokeStyle=m.col; ctx.lineWidth=1.8*z;
        ctx.beginPath(); ctx.moveTo(a.x,a.y); const seg=4; for(let q=1;q<=seg;q++){ const t=q/seg, jx=a.x+(b.x-a.x)*t+(((m.sd*7+q*13)%9)-4)*z, jy=a.y+(b.y-a.y)*t+(((m.sd*5+q*11)%9)-4)*z; ctx.lineTo(jx,jy); } ctx.stroke();
        ctx.globalAlpha=L*0.85; ctx.strokeStyle='#fff'; ctx.lineWidth=0.8*z; ctx.stroke();
        ctx.globalAlpha=L*0.5; ctx.strokeStyle=m.col; ctx.lineWidth=1.4*z; ctx.beginPath(); ctx.arc(b.x,b.y,18*z*(1-L*0.5),0,6.283); ctx.stroke(); }
      else if(m.kind==='shock'){ const a=toScreen(m.x0,m.y0), b=toScreen(m.x,m.y), fI=Math.min(1,L*5)*(m.op||1), fsd=(m.sd||0)+(((m.age||0)*26)|0)*13, flick=0.72+((fsd*29)%100)/100*0.28; ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';   // 지속 감전(프로브식): fI=유지 밝기(op=흐리게), fsd=프레임 시드, flick=강도 플리커
        for(let w=0;w<2;w++){ ctx.globalAlpha=fI*0.5*flick; ctx.strokeStyle=m.col; ctx.lineWidth=(1.15-w*0.4)*z; ctx.beginPath(); ctx.moveTo(a.x,a.y); for(let q=1;q<5;q++){ const t=q/5; ctx.lineTo(a.x+(b.x-a.x)*t+(((fsd*7+q*13+w*29)%11)-5)*z*0.8, a.y+(b.y-a.y)*t+(((fsd*5+q*17+w*23)%11)-5)*z*0.8); } ctx.lineTo(b.x,b.y); ctx.stroke(); }   // 손→대상 전기 아크 2가닥(매 프레임 지그재그 재추첨=찌릿찌릿)
        ctx.globalAlpha=fI*0.85*flick; ctx.strokeStyle='#ffffff'; ctx.lineWidth=0.45*z; ctx.beginPath(); ctx.moveTo(a.x,a.y); for(let q=1;q<5;q++){ const t=q/5; ctx.lineTo(a.x+(b.x-a.x)*t+(((fsd*11+q*7)%9)-4)*z*0.6, a.y+(b.y-a.y)*t+(((fsd*13+q*5)%9)-4)*z*0.6); } ctx.lineTo(b.x,b.y); ctx.stroke();   // 흰 코어 아크
        ctx.globalAlpha=fI*0.6*flick; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(a.x,a.y,0.9*z,0,6.283); ctx.fill();   // 손 충전 글로우
        ctx.globalAlpha=fI*(0.55+0.35*flick); ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(b.x,b.y,1.35*z,0,6.283); ctx.fill();   // 대상 감전 코어(플리커)
        ctx.globalAlpha=fI*0.65*flick; ctx.strokeStyle=m.col; ctx.lineWidth=0.7*z; for(let q=0;q<5;q++){ const an=q*1.256+((fsd*3+q)%7)*0.14, ln=(2.6+((fsd+q*5)%4)*1.1)*z; ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x+Math.cos(an)*ln*0.5+(((fsd*5+q*7)%7)-3)*z*0.5, b.y+Math.sin(an)*ln*0.5+(((fsd*3+q*11)%7)-3)*z*0.5); ctx.lineTo(b.x+Math.cos(an)*ln, b.y+Math.sin(an)*ln); ctx.stroke(); } }   // 대상 주위 잔전격(매 프레임 재추첨)
      else if(m.kind==='spark'||m.kind==='sparkM'){ const b=toScreen(m.x,m.y), mzl=(m.kind==='sparkM');   // 즉발 스파크: 발사구(미세)/타격 지점(범위) — 그라데이션 코어 + 플라즈마 촉수
        const fI=Math.min(1,L*4)*(mzl?0.85:0.7), fsd=(m.sd||0)+(((m.age||0)*30)|0)*17, R=(mzl?3.4:12)*z, Rg=R*0.55;   // 발사구=또렷한 장전(공격 중 티 나게) / 타격=적당히
        const cr=parseInt((m.col||'#ffe08a').slice(1,3),16), cg=parseInt((m.col||'#ffe08a').slice(3,5),16), cb=parseInt((m.col||'#ffe08a').slice(5,7),16);
        ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
        if(mzl){ const p=Math.min(1,(m.age||0)*4);   // 발사구: 에너지 장전 — 바깥 입자가 중심으로 수렴 + 코어가 점점 밝아짐
          ctx.fillStyle=m.col; for(let q=0;q<6;q++){ const an=q*1.047+(m.sd||0)*0.31+((fsd*3+q)%5)*0.06, dd=R*2.4*(1-p*0.92);   // 수렴 입자
            ctx.globalAlpha=fI*(0.25+0.45*p); ctx.beginPath(); ctx.arc(b.x+Math.cos(an)*dd, b.y+Math.sin(an)*dd*0.8, 0.42*z, 0, 6.283); ctx.fill(); }
          ctx.globalAlpha=fI*0.55*p; ctx.strokeStyle=m.col; ctx.lineWidth=0.6*z; ctx.beginPath(); ctx.arc(b.x,b.y,R*1.6*(1-p*0.75),0,6.283); ctx.stroke();   // 수축 링(또렷)
          const gm=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,R*(0.5+0.7*p));   // 커지며 밝아지는 코어(충전)
          gm.addColorStop(0,'rgba(255,255,255,'+(fI*(0.3+0.65*p))+')'); gm.addColorStop(0.5,'rgba('+cr+','+cg+','+cb+','+(fI*(0.2+0.4*p))+')'); gm.addColorStop(1,'rgba('+cr+','+cg+','+cb+',0)');
          ctx.globalAlpha=1; ctx.fillStyle=gm; ctx.beginPath(); ctx.arc(b.x,b.y,R*(0.5+0.7*p),0,6.283); ctx.fill(); }
        if(!mzl){ ctx.save(); ctx.translate(b.x,b.y); ctx.scale(1,0.38);   // 범위 표시: 납작 타원형 그라데이션 장판(크고 진하게)
          const Rp=R*1.15, ge=ctx.createRadialGradient(0,0,0,0,0,Rp);
          ge.addColorStop(0,'rgba('+cr+','+cg+','+cb+','+(0.62*fI)+')'); ge.addColorStop(0.7,'rgba('+cr+','+cg+','+cb+','+(0.3*fI)+')'); ge.addColorStop(1,'rgba('+cr+','+cg+','+cb+',0)');
          ctx.globalAlpha=1; ctx.fillStyle=ge; ctx.beginPath(); ctx.arc(0,0,Rp,0,6.283); ctx.fill(); ctx.restore();
        const rp=Math.min(1,(m.age||0)*5);   // 타격 펄스: 선명한 확장 링(스트로크만 → 유닛 안 가림, 공격 순간 가독성)
        ctx.globalAlpha=(1-rp)*fI*0.9; ctx.strokeStyle='#ffffff'; ctx.lineWidth=0.9*z; ctx.beginPath(); ctx.arc(b.x,b.y,R*(0.15+0.85*rp),0,6.283); ctx.stroke();
        ctx.globalAlpha=(1-rp)*fI*0.5; ctx.strokeStyle=m.col; ctx.lineWidth=1.8*z; ctx.beginPath(); ctx.arc(b.x,b.y,R*(0.15+0.85*rp)*0.96,0,6.283); ctx.stroke();
        const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,Rg);   // 그라데이션(중앙일수록 밝게)
        g.addColorStop(0,'rgba(255,255,255,'+(0.5*fI)+')'); g.addColorStop(0.3,'rgba('+cr+','+cg+','+cb+','+(0.25*fI)+')'); g.addColorStop(1,'rgba('+cr+','+cg+','+cb+',0)');
        ctx.globalAlpha=1; ctx.fillStyle=g; ctx.beginPath(); ctx.arc(b.x,b.y,Rg,0,6.283); ctx.fill();
        const n=7; for(let q=0;q<n;q++){ const an=q*(6.283/n)+((fsd*3+q)%7)*0.18, ln=R*(0.42+((fsd+q*5)%5)*0.1);   // 플라즈마 촉수(곡선·재추첨 일렁) — 타격 지점 전용
          const ex2=b.x+Math.cos(an)*ln, ey2=b.y+Math.sin(an)*ln,
                mx2=b.x+Math.cos(an)*ln*0.55+(((fsd*5+q*7)%9)-4)*z*0.45, my2=b.y+Math.sin(an)*ln*0.55+(((fsd*3+q*11)%9)-4)*z*0.45;
          ctx.globalAlpha=fI*0.22; ctx.strokeStyle=m.col; ctx.lineWidth=0.7*z; ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.quadraticCurveTo(mx2,my2,ex2,ey2); ctx.stroke();   // 플라즈마 글로우(은은)
          ctx.globalAlpha=fI*0.32; ctx.strokeStyle='#ffffff'; ctx.lineWidth=0.32*z; ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.quadraticCurveTo(mx2,my2,ex2,ey2); ctx.stroke();   // 흰 심(희미)
          ctx.globalAlpha=fI*0.25; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(ex2,ey2,0.4*z,0,6.283); ctx.fill(); } } }   // 촉수 끝 방울(미세)
      else if(m.kind==='voidQ'){ const b=toScreen(m.x,m.y), p=Math.min(1,(m.age||0)*5.5), fI=Math.min(1,L*4);   // 보이드 차지: 손 앞에서 빠르게 커지는 에너지 구체 + 회전 궤도 링
        const cr=parseInt((m.col||'#dcb6ff').slice(1,3),16), cg=parseInt((m.col||'#dcb6ff').slice(3,5),16), cb=parseInt((m.col||'#dcb6ff').slice(5,7),16), r0=(0.7+2.4*p)*z;
        ctx.globalCompositeOperation='lighter';
        const gq=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,r0*1.9);   // 성장 글로우(중앙 강한 빛)
        gq.addColorStop(0,'rgba(255,255,255,'+(0.8*fI*p)+')'); gq.addColorStop(0.4,'rgba('+cr+','+cg+','+cb+','+(0.45*fI*p)+')'); gq.addColorStop(1,'rgba('+cr+','+cg+','+cb+',0)');
        ctx.globalAlpha=1; ctx.fillStyle=gq; ctx.beginPath(); ctx.arc(b.x,b.y,r0*1.9,0,6.283); ctx.fill();
        ctx.globalAlpha=fI*(0.45+0.5*p); ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(b.x,b.y,r0*0.5,0,6.283); ctx.fill();   // 코어 구체
        const oa=(m.age||0)*10+(m.sd||0);   // 궤도 링 2개(회전 타원 — 홀로그램 느낌)
        ctx.globalAlpha=fI*0.55*p; ctx.strokeStyle=m.col; ctx.lineWidth=0.42*z;
        ctx.beginPath(); ctx.ellipse(b.x,b.y,r0*1.25,r0*0.45,oa,0,6.283); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(b.x,b.y,r0*1.25,r0*0.45,oa+1.9,0,6.283); ctx.stroke(); }
      else if(m.kind==='voidA'){ const b=toScreen(m.x,m.y), p=Math.min(1,(m.age||0)*3.4), pe=1-Math.pow(1-p,3), fI=Math.min(1,L*3)*0.8;   // 보이드 버스트: 넓은 영역이 에너지로 차오름(ease-out 팽창)
        const cr=parseInt((m.col||'#dcb6ff').slice(1,3),16), cg=parseInt((m.col||'#dcb6ff').slice(3,5),16), cb=parseInt((m.col||'#dcb6ff').slice(5,7),16), R=14*z, Rc=R*(0.18+0.82*pe);
        ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
        ctx.save(); ctx.translate(b.x,b.y); ctx.scale(1,0.4);   // 바닥 장판(납작 타원, 은은)
        const gp=ctx.createRadialGradient(0,0,0,0,0,R*1.05);
        gp.addColorStop(0,'rgba('+cr+','+cg+','+cb+','+(0.4*fI)+')'); gp.addColorStop(0.7,'rgba('+cr+','+cg+','+cb+','+(0.18*fI)+')'); gp.addColorStop(1,'rgba('+cr+','+cg+','+cb+',0)');
        ctx.globalAlpha=1; ctx.fillStyle=gp; ctx.beginPath(); ctx.arc(0,0,R*1.05,0,6.283); ctx.fill(); ctx.restore();
        const ga=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,Rc);   // 팽창하며 채워지는 에너지 필
        ga.addColorStop(0,'rgba(255,255,255,'+(0.34*fI)+')'); ga.addColorStop(0.55,'rgba('+cr+','+cg+','+cb+','+(0.24*fI)+')'); ga.addColorStop(1,'rgba('+cr+','+cg+','+cb+','+(0.05*fI)+')');
        ctx.globalAlpha=1; ctx.fillStyle=ga; ctx.beginPath(); ctx.arc(b.x,b.y,Rc,0,6.283); ctx.fill();
        ctx.globalAlpha=fI*0.85*(1-pe*0.55); ctx.strokeStyle='#ffffff'; ctx.lineWidth=0.8*z; ctx.beginPath(); ctx.arc(b.x,b.y,Rc,0,6.283); ctx.stroke();   // 파면(가장자리 흰 링)
        ctx.globalAlpha=fI*0.4*(1-pe*0.4); ctx.strokeStyle=m.col; ctx.lineWidth=1.7*z; ctx.beginPath(); ctx.arc(b.x,b.y,Rc*0.965,0,6.283); ctx.stroke();   // 파면 색 글로우
        for(let k2=1;k2<=2;k2++){ const rr=Rc*(1-k2*0.27); if(rr<=0) continue;   // 내부 리플(따라오는 동심원)
          ctx.globalAlpha=fI*0.22; ctx.strokeStyle=m.col; ctx.lineWidth=0.5*z; ctx.beginPath(); ctx.arc(b.x,b.y,rr,0,6.283); ctx.stroke(); } }
      else if(m.kind==='infect'){ const c=toScreen(m.x,m.y), age=m.age||0, fI=Math.min(1,L*2.5)*0.85;   // 감염(디바우러 산성 포자): 대상 주위 독 연기 구름 — 소용돌이치며 위로 떠오르는 안개
        ctx.globalCompositeOperation='source-over';
        for(let q=0;q<6;q++){ const an=(m.sd||0)*0.7+q*1.047+age*(0.5+(q%3)*0.22), dd=(1.5+(q%3)*1.1)*z;   // 퍼프별 위상·회전속도 다르게(소용돌이)
          const px2=c.x+Math.cos(an)*dd, py2=c.y+Math.sin(an)*dd*0.75-age*0.5*z, pr=(2.2+(q%4)*0.8)*z*(0.8+age*0.25);   // 천천히 위로 떠오르며 팽창
          const g2=ctx.createRadialGradient(px2,py2,0,px2,py2,pr);
          g2.addColorStop(0,'rgba(124,168,60,'+(0.34*fI)+')'); g2.addColorStop(0.6,'rgba(94,128,50,'+(0.18*fI)+')'); g2.addColorStop(1,'rgba(94,128,50,0)');
          ctx.globalAlpha=1; ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(px2,py2,pr,0,6.283); ctx.fill(); }   // 부드러운 안개 퍼프(경계 없는 그라데이션)
        ctx.globalAlpha=fI*0.5; ctx.fillStyle='#b8d878'; for(let q=0;q<3;q++){ const an=(m.sd||0)+q*2.1+age*2.2, dd=(1.2+(q%2))*z; ctx.beginPath(); ctx.arc(c.x+Math.cos(an)*dd, c.y+Math.sin(an)*dd*0.7-age*0.4*z, 0.35*z, 0, 6.283); ctx.fill(); } }   // 구름 속 떠다니는 포자 점
      else if(m.kind==='boom'){ const c=toScreen(m.x,m.y), p=1-L, R=16*z;   // 자폭 범위딜: 중심(최대)→외곽(최소) 그라데이션 + 확장 블라스트 링, 터지며 페이드
        ctx.globalCompositeOperation='lighter';
        const rg=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,R*(0.4+p*0.85));
        rg.addColorStop(0,'rgba(255,255,255,'+(0.85*L)+')'); rg.addColorStop(0.32,'rgba(200,232,154,'+(0.55*L)+')'); rg.addColorStop(0.68,'rgba(140,180,90,'+(0.26*L)+')'); rg.addColorStop(1,'rgba(140,180,90,0)');
        ctx.globalAlpha=1; ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(c.x,c.y,R*(0.4+p*0.85),0,6.283); ctx.fill();
        ctx.globalAlpha=L*0.8; ctx.strokeStyle='#eaffc0'; ctx.lineWidth=1.6*z; ctx.beginPath(); ctx.arc(c.x,c.y,R*(0.5+p*0.7),0,6.283); ctx.stroke();
        ctx.globalAlpha=L*0.35; ctx.strokeStyle='#c8e89a'; ctx.lineWidth=1*z; ctx.beginPath(); ctx.arc(c.x,c.y,R*(0.3+p*0.55),0,6.283); ctx.stroke();
        ctx.globalAlpha=L*0.9; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(c.x,c.y,3.2*z*(1-p*0.6),0,6.283); ctx.fill(); }
      else if(m.kind==='push'){ const c=toScreen(m.x,m.y), p=1-L, z2=z, sd=m.sd||0; ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=L*0.78; ctx.fillStyle='#fff3e2'; ctx.beginPath(); ctx.arc(c.x,c.y,(0.55+L*1.9)*z2,0,6.283); ctx.fill(); ctx.globalAlpha=L*0.3; ctx.fillStyle='#ffb066'; ctx.beginPath(); ctx.arc(c.x,c.y,(1.2+p*2.9)*z2,0,6.283); ctx.fill(); ctx.globalAlpha=L*0.68; ctx.strokeStyle='#ffd7a0'; ctx.lineCap='round'; for(let _q=0;_q<6;_q++){ const _a=m.ang+(_q-2.5)*0.42+((sd*7+_q*13)%7-3)*0.05, _len=(2.3+p*4.8)*z2*(0.65+((sd+_q*5)%4)/4*0.7); ctx.lineWidth=(1.05-_q*0.07)*z2; ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.lineTo(c.x+Math.cos(_a)*_len,c.y+Math.sin(_a)*_len); ctx.stroke(); } }
      else if(m.kind==='scythe'){ // 대상 직격 베기: 얇게 시작→두껍게 끝나는 곡선 슬래시(칼자국) + 피 튀김
        const c=toScreen(m.x,m.y), p=1-L, g=Math.min(1,p*6), ba=m.ang+0.5, len=(11+p*4)*z, curve=0.42;
        const ux=Math.cos(ba), uy=Math.sin(ba), px2=-uy, py2=ux;   // 베기 축 + 수직(곡률)
        // 곡선 슬래시: 여러 세그먼트를 두께 테이퍼(가늘→굵→가늘)로 채워 실제 벤 자국처럼
        const slashFill=(col, wid, alpha)=>{ ctx.globalAlpha=alpha; ctx.fillStyle=col; ctx.beginPath();
          const N=14; for(let s=0;s<=N;s++){ const t=s/N, tt=(t-0.5)*2, along=(t-0.5)*len, bow=(1-tt*tt)*curve*len, w=wid*(Math.pow(1-Math.abs(tt),0.6));
            const cx=c.x+ux*along+px2*bow, cy=c.y+uy*along+py2*bow; if(s===0) ctx.moveTo(cx+px2*w,cy+py2*w); else ctx.lineTo(cx+px2*w,cy+py2*w); }
          for(let s=N;s>=0;s--){ const t=s/N, tt=(t-0.5)*2, along=(t-0.5)*len, bow=(1-tt*tt)*curve*len, w=wid*(Math.pow(1-Math.abs(tt),0.6));
            const cx=c.x+ux*along+px2*bow, cy=c.y+uy*along+py2*bow; ctx.lineTo(cx-px2*w,cy-py2*w); } ctx.closePath(); ctx.fill(); };
        ctx.globalCompositeOperation='lighter';
        slashFill(m.col, (2.4-p*1.5)*z, L*0.4);        // 초록 잔광(굵게)
        slashFill('#f4ffe0', (1.0-p*0.7)*z, L*0.92);   // 밝은 칼자국 심
        ctx.globalAlpha=L*0.8*g; ctx.fillStyle='#f4ffe0'; ctx.beginPath(); ctx.arc(c.x,c.y,1.2*z*g,0,6.28); ctx.fill();   // 타격 섬광
        // 피 튀김(베기 방향으로 흩뿌림) — 자연 합성
        ctx.globalCompositeOperation='source-over';
        for(let q=0;q<8;q++){ const an=ba+(q-3.5)*0.3+((m.sd*7+q*13)%7-3)*0.05, dd=(1.5+p*8.0)*z*(0.5+((m.sd+q*5)%5)/5), rr=(0.95-p*0.6)*z*(0.55+((m.sd*3+q*7)%4)/4);
          if(rr<=0.05) continue; ctx.globalAlpha=L*(0.72-p*0.4); ctx.fillStyle=(q%3===0)?'#c8f07a':'#7fae2c';   // 초록빛 체액(밝은/짙은)
          ctx.beginPath(); ctx.ellipse(c.x+Math.cos(an)*dd, c.y+Math.sin(an)*dd, rr*1.6, rr*0.7, an, 0, 6.28); ctx.fill(); } }
      else if(m.kind==='psicut'){ // 사이오닉 검격(워든/다크템플러): 테이퍼 곡선 칼자국 + 백열 심 + 에너지 파편. pw2(다크템플러)=더 크고 강한 타격+충격 링
        const c=toScreen(m.x,m.y), p=1-L, g=Math.min(1,p*6), pw=m.pw||1, ba=m.ang+0.5, len=(10+pw*2.5+p*4)*z, curve=0.4;
        const ux=Math.cos(ba), uy=Math.sin(ba), px2=-uy, py2=ux;
        const slashFill=(col2, wid, alpha)=>{ ctx.globalAlpha=alpha; ctx.fillStyle=col2; ctx.beginPath();
          const N=14; for(let s2=0;s2<=N;s2++){ const t=s2/N, tt=(t-0.5)*2, along=(t-0.5)*len, bow=(1-tt*tt)*curve*len, w=wid*(Math.pow(1-Math.abs(tt),0.6));
            const cx=c.x+ux*along+px2*bow, cy=c.y+uy*along+py2*bow; if(s2===0) ctx.moveTo(cx+px2*w,cy+py2*w); else ctx.lineTo(cx+px2*w,cy+py2*w); }
          for(let s2=N;s2>=0;s2--){ const t=s2/N, tt=(t-0.5)*2, along=(t-0.5)*len, bow=(1-tt*tt)*curve*len, w=wid*(Math.pow(1-Math.abs(tt),0.6));
            const cx=c.x+ux*along+px2*bow, cy=c.y+uy*along+py2*bow; ctx.lineTo(cx-px2*w,cy-py2*w); } ctx.closePath(); ctx.fill(); };
        ctx.globalCompositeOperation='lighter';
        slashFill(m.col, (2.2+pw*0.5-p*1.4)*z, L*0.38);      // 색 잔광(강할수록 굵게)
        slashFill('#ffffff', (0.85+pw*0.15-p*0.6)*z, L*0.95); // 백열 칼자국 심
        ctx.globalAlpha=L*0.85*g; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(c.x,c.y,(1.0+pw*0.5)*z*g,0,6.28); ctx.fill();   // 타격 섬광(강할수록 크게)
        for(let q=0;q<6;q++){ const an=ba+(q-2.5)*0.34+((m.sd*7+q*13)%7-3)*0.05, d0=(1.2+p*7.5)*z*(0.5+((m.sd+q*5)%5)/5), l2=(2.0-p*1.2)*z;
          if(l2<=0.1) continue; ctx.globalAlpha=L*(0.6-p*0.3); ctx.strokeStyle=(q%2?m.col:'#ffffff'); ctx.lineWidth=(0.5+pw*0.1)*z; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(c.x+Math.cos(an)*d0, c.y+Math.sin(an)*d0); ctx.lineTo(c.x+Math.cos(an)*(d0+l2), c.y+Math.sin(an)*(d0+l2)); ctx.stroke(); }   // 에너지 파편(베기 방향 비산)
        if(pw>=2){ ctx.globalAlpha=L*0.5*(1-p*0.4); ctx.strokeStyle=m.col; ctx.lineWidth=0.8*z; ctx.beginPath(); ctx.arc(c.x,c.y,(3+p*9)*z,0,6.283); ctx.stroke(); } }   // 강타 충격 링(다크템플러)
      else if(m.kind==='slash'){ // 검격: 대상 위 사선 베기 한 줄(희미·소형, 고정 — 타이밍은 ATK_STYLE.hit 지연)
        const c=toScreen(m.x,m.y), p=1-L, g=Math.min(1,p*7);   // g=등장 팝
        ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(m.ang+0.62);
        ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
        const l=8*z*(0.9+0.1*g);   // 반길이(소형, 확산 없음)
        ctx.globalAlpha=L*0.28; ctx.strokeStyle=m.col;   ctx.lineWidth=1.9*z;  ctx.beginPath(); ctx.moveTo(-l,0); ctx.lineTo(l,0); ctx.stroke();        // 옅은 글로우
        ctx.globalAlpha=L*0.55; ctx.strokeStyle='#ffffff'; ctx.lineWidth=0.7*z; ctx.beginPath(); ctx.moveTo(-l*0.92,0); ctx.lineTo(l*0.92,0); ctx.stroke();   // 희미한 칼날 선
        ctx.restore(); }
      else { const c=toScreen(m.x,m.y), R=20*z, a0=m.ang-0.9, a1=m.ang+0.9; ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=L*0.9; ctx.strokeStyle='#ff8f8f'; ctx.lineWidth=2*z; ctx.beginPath(); ctx.arc(c.x,c.y,R,a0,a1); ctx.stroke(); ctx.lineWidth=1.4*z; ctx.beginPath(); ctx.arc(c.x,c.y,R*0.66,a0,a1); ctx.stroke(); } }   // claw(매트론)
    for(const d of store.deaths){ const c=toScreen(d.x,d.y), L=Math.max(0,d.life), p=1-L, z=sz*(d.szf||1)*_hk; ctx.save(); ctx.translate(c.x,c.y); ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=L*0.8; ctx.strokeStyle='#fff2d0'; ctx.lineWidth=2*z; ctx.beginPath(); ctx.arc(0,0,(6+p*34)*z,0,6.283); ctx.stroke();   // 섬광 링
      ctx.globalAlpha=L*0.6; ctx.fillStyle=d.col; ctx.beginPath(); ctx.arc(0,0,10*z*L,0,6.283); ctx.fill();   // 코어 플래시
      for(const pt of d.parts){ const dd=pt.sp*p*z, px=Math.cos(pt.a)*dd, py=Math.sin(pt.a)*dd; ctx.globalAlpha=L; ctx.strokeStyle=pt.col; ctx.lineWidth=1.4*z;   // 파편
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px-Math.cos(pt.a)*pt.len*z, py-Math.sin(pt.a)*pt.len*z); ctx.stroke(); }
      ctx.restore(); }
    ctx.restore(); },
  _shot(ctx,s){ switch(s.kind){   // 네모 발사체 레시피(원점 기준, 이미 회전·스케일됨)
    case 'bullet': { const L=s.lng||1, W=s.wd||1; ctx.globalAlpha=.28; ctx.fillStyle=s.color; ctx.fillRect(-6.5*L,-0.6*W,6.5*L,1.2*W);
      ctx.globalAlpha=.85; ctx.fillStyle=s.core||'#ffe2a0'; ctx.fillRect(-2.4*L,-0.55*W,0.8+2.4*L,1.1*W);
      ctx.globalAlpha=1; ctx.fillStyle='#fff2cf'; ctx.beginPath();ctx.arc(0.6,0,1.1*(s.hd||1),0,6.28);ctx.fill(); break; }
    case 'beam': { const L=s.lng||3, W=s.wd||1; ctx.globalCompositeOperation='lighter';   // 에너지 파동 빔(팔콘): 부드러운 글로우 + 둥근 에너지 헤드
      ctx.globalAlpha=.3;  ctx.fillStyle=s.color; ctx.fillRect(-7*L,-1.15*W,7*L,2.3*W);       // 넓은 색 글로우
      ctx.globalAlpha=.75; ctx.fillStyle=s.color; ctx.fillRect(-6*L,-0.6*W,6*L,1.2*W);        // 빔 본체
      ctx.globalAlpha=.95; ctx.fillStyle='#eaf8ff'; ctx.fillRect(-4.6*L,-0.28*W,4.6*L,0.56*W); // 흰 코어
      ctx.globalAlpha=.9;  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.ellipse(0.4,0,1.6*(s.hd||1),0.95*(s.hd||1),0,0,6.28); ctx.fill(); break; }   // 둥근 파동 헤드
    case 'mg': ctx.globalAlpha=.25; ctx.fillStyle=s.color; ctx.fillRect(-5,-0.22,5,0.44);
      ctx.globalAlpha=1; ctx.fillStyle='#fff7d8'; ctx.fillRect(-1.2,-0.28,2.6,0.56); break;
    case 'sniper': ctx.globalAlpha=.3; ctx.fillStyle=s.color; ctx.beginPath(); ctx.moveTo(1.5,-0.6); ctx.lineTo(1.5,0.6); ctx.lineTo(-24,0.05); ctx.lineTo(-24,-0.05); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=.92; ctx.fillStyle='#e6f6ff'; ctx.beginPath(); ctx.moveTo(2.2,-0.45); ctx.lineTo(2.2,0.45); ctx.lineTo(-8,0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.ellipse(1.8,0,1.9,0.72,0,0,6.28); ctx.fill();
      ctx.globalAlpha=.85; ctx.fillStyle='#eafdff'; ctx.beginPath(); ctx.arc(2.8,0,0.55,0,6.28); ctx.fill(); break;
    case 'missile': { const lf=Math.min(1,(s.t||0)/0.05);
      ctx.globalAlpha=.5*lf; ctx.fillStyle='#ff8a3c'; ctx.fillRect(-6.5,-1.2,4,2.4);
      ctx.globalAlpha=.9*lf; ctx.fillStyle='#ffd27a'; ctx.fillRect(-4.5,-0.9,3.2,1.8);
      ctx.globalAlpha=1; ctx.fillStyle=s.color; ctx.fillRect(-1.6,-1.3,5,2.6);
      ctx.fillStyle='#fff'; ctx.fillRect(2,-1,2,2); break; }
    case 'needle': { const W=s.wd||1; ctx.globalAlpha=.9; ctx.fillStyle=s.color;
      ctx.beginPath(); ctx.moveTo(4.5,0); ctx.lineTo(-4,0.7*W); ctx.lineTo(-4,-0.7*W); ctx.closePath(); ctx.fill();
      if(W>1.2){ ctx.globalAlpha=1; ctx.fillStyle='#f2ffcf'; ctx.beginPath(); ctx.moveTo(4.5,0); ctx.lineTo(-1.2,0.35*W); ctx.lineTo(-1.2,-0.35*W); ctx.closePath(); ctx.fill(); } break; }   // 굵은 가시=밝은 심 추가
    case 'shell': ctx.globalAlpha=.4; ctx.fillStyle='#ffae4d'; ctx.fillRect(-5.5,-0.5,3.5,1.0);
      ctx.globalAlpha=1; ctx.fillStyle='#b8a878'; ctx.beginPath(); ctx.ellipse(0,0,2.4,0.9,0,0,6.28); ctx.fill();
      ctx.fillStyle='#fff2c0'; ctx.beginPath(); ctx.arc(1.6,0,0.7,0,6.28); ctx.fill(); break;
    case 'plasma': ctx.globalAlpha=.4; ctx.fillStyle=s.color; ctx.beginPath();ctx.arc(0,0,5.8,0,6.28);ctx.fill();
      ctx.globalAlpha=1; ctx.beginPath();ctx.arc(0,0,2.9,0,6.28);ctx.fill(); break;
    case 'spit': ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.5; ctx.strokeStyle=s.color; ctx.lineCap='round'; ctx.lineWidth=0.7; ctx.beginPath(); ctx.moveTo(-6.5,0); ctx.lineTo(-0.3,0); ctx.stroke();
      ctx.globalAlpha=.9; ctx.fillStyle=s.color; ctx.beginPath(); ctx.ellipse(0,0,3.0,0.85,0,0,6.28); ctx.fill();
      ctx.globalAlpha=.55; ctx.fillStyle='#5f9e1e'; ctx.beginPath(); ctx.ellipse(-0.6,0,1.6,0.4,0,0,6.28); ctx.fill();
      ctx.globalAlpha=.8; ctx.fillStyle='#eaffb0'; ctx.beginPath(); ctx.arc(1.2,-0.15,0.45,0,6.28); ctx.fill(); break;
    case 'porb': { ctx.globalAlpha=.30; ctx.fillStyle=s.color; ctx.beginPath(); ctx.arc(0,0,3.4,0,6.28); ctx.fill();   // 독구슬: 겉 글로우
      ctx.globalAlpha=1; ctx.fillStyle='#5f9e1e'; ctx.beginPath(); ctx.arc(0,0,2.2,0,6.28); ctx.fill();   // 짙은 몸체
      ctx.fillStyle=s.color; ctx.beginPath(); ctx.arc(0,0,1.5,0,6.28); ctx.fill();   // 본색 코어
      ctx.globalAlpha=.85; ctx.fillStyle='#eaffb0'; ctx.beginPath(); ctx.arc(0.7,-0.7,0.5,0,6.28); ctx.fill(); break; }   // 하이라이트(뭉친 구슬)
    case 'shuriken': { const spin=(s.t||0)*(s.spinRate||18);   // 삼각수리검: 중심에서 뻗은 얇고 긴 못 형태 블레이드 3개(120도)
      ctx.save(); ctx.rotate(spin);
      for(let bq=0;bq<3;bq++){ ctx.save(); ctx.rotate(bq*2.0944);
        ctx.globalAlpha=1; ctx.fillStyle=s.color; ctx.beginPath(); ctx.moveTo(3.4,0); ctx.lineTo(-0.75,0.15); ctx.lineTo(-0.75,-0.15); ctx.closePath(); ctx.fill();   // 완전히 얇은 못 형태 블레이드
        ctx.globalAlpha=1; ctx.fillStyle='#eaffc0'; ctx.beginPath(); ctx.moveTo(2.6,0); ctx.lineTo(-0.35,0.06); ctx.lineTo(-0.35,-0.06); ctx.closePath(); ctx.fill();   // 밝은 심(더욱 얇게)
        ctx.restore(); }
      ctx.globalAlpha=.95; ctx.fillStyle='#f6ffe0'; ctx.beginPath(); ctx.arc(0,0,0.2,0,6.283); ctx.fill();   // 중심 리벳(축소)
      ctx.restore(); break; }
    default: ctx.globalAlpha=1; ctx.fillStyle=s.color; ctx.beginPath();ctx.arc(0,0,2,0,6.28);ctx.fill(); } }
};
// 피격·사망 연출 세기 — 오토배틀은 수백 기가 동시에 싸워 기본값이면 화면이 이펙트로 덮인다
const STK_HIT_K=0.5;        // 피격 이펙트 크기 배율(1=공용 기본)
const STK_DEATH_PARTS=5;    // 사망 파편 수(공용 기본 9)
function strikeFx(u,tx,ty){ const S=STK; if(!S) return; if(!S.fx||!S.fx.shots){ S.fx=FX.store(); S.fx.hitK=STK_HIT_K; }
  // 유닛별 공격 이펙트 = 관리자(이펙트 랩·전투실험)와 같은 디스패치(unitFireFx). 전용 스토어는 정규화(0~1) 좌표계.
  if(typeof unitFireFx==='function'){
    if(!S._fxU){ S._fxU={ store:FX.store(), pend:[], vnJet:null }; S._fxU.store.hitK=STK_HIT_K; }
    const _W=STK_FX_SPAN, _pu={ uid:u.uid, id:u.id, gmodel:u.gm||u.gmodel, x:u.x/_W, y:u.y/_W, size:u.size, face:u.face };
    try{ unitFireFx(S._fxU, _pu, tx/_W, ty/_W, u.size, false); return; }catch(e){}
  }
  FX.spawn(S.fx, u.id, u.x,u.y, tx,ty, {speed:2600, unitSize:u.size}); }   // 폴백(디스패치 불가 시 기본 발사체)
function strikeFindUnit(arr,uid){ if(!uid) return null; for(const u of arr){ if(u.uid===uid&&!u.dead) return u; } return null; }
// 주변 아군 가담 — ⚠ 공격자를 실제로 때릴 수 있는 아군만 부른다.
// (지상 전용 유닛이 공중 공격자를 표적으로 잡아봐야 다음 판단에서 취소돼 한 프레임 낭비일 뿐이고,
//  정작 대공 가능한 아군은 안 불려 오는 상태였다 → 대공 가능한 아군에게 넘기는 것이 목적)
function strikeAlert(allies, attackerUid, ax, ay, r, atkAir){ const r2=r*r;
  for(const a of allies){ if(a.dead||a.wait>0||a.tgtUid) continue;
    if(atkAir!=null && a._atk && !(atkAir? a._atk.air : a._atk.gnd)) continue;   // 못 때리는 아군은 부르지 않음
    const dx=a.x-ax, dy=a.y-ay; if(dx*dx+dy*dy<=r2){ a.tgtUid=attackerUid; a._acqT=0; a._inrT=0; } } }   // _inrT=0 → 사거리 안 재탐색도 즉시
// ═══ 🧪 대규모 전투 관측 모드(임시 · 정상 플레이 경로는 건드리지 않음) ═══
//   `strikeStress(n)` = 신전을 사실상 무적으로 만들어 게임이 끝나지 않게 하고,
//   양 진영이 **같은 티어 표**로 웨이브마다 n기씩 소환하며 계속 싸운다(전력 대등 → 순수 전투 관측).
//   라운드가 오를수록 상위 티어로 올라가 후반에 대규모·고화력 전투가 된다. `strikeStress(0)`으로 해제.
const STK_STRESS_HP=200;        // 신전 체력 배수(끝나지 않게)
const STK_STRESS_STEP=2;        // 티어 1단계 상승에 필요한 웨이브 수
const STK_TIERS={               // 종족이 달라도 같은 인덱스 = 같은 급 — "비슷한 공격력·단계"
  terran: [['marine'],['marine','machinegun'],['machinegun','medic','racer'],['racer','goliath','tank'],
           ['tank','goliath','ghost'],['tank','skyguard','hellfire'],['hellfire','dreadnought','aegis']],
  zerg:   [['snapper'],['snapper','hydra'],['hydra','broodling','venom'],['venom','thornqueen','stinger'],
           ['thornqueen','matron','stinger'],['matron','medusa','ultralisk'],['ultralisk','medusa','behemoth']],
  protoss:[['blade'],['blade','dragoon'],['dragoon','falcon','dark_templar'],['falcon','archon','skydancer'],
           ['archon','skydancer','dark_templar'],['archon','kronos','archangel'],['archangel','kronos','skydancer']],
  feral:  [['wolfrunner'],['wolfrunner','thornspitter'],['thornspitter','clawfighter','hornedcharger'],['clawfighter','howlslinger','venomfang'],
           ['venomfang','stalkercat','alphawolf'],['alphawolf','wyvernrider','skytalon'],['wyvernrider','skytalon','stormroc']],
  colossus:[['gunner'],['gunner','guardwalker'],['guardwalker','twincannon','flakbattery'],['twincannon','flakbattery','arclight'],
           ['arclight','railgun','skylance'],['railgun','skylance','siegecolossus'],['skylance','siegecolossus','railgun']] };
function _stkTierList(side){ const S=STK, t=STK_TIERS[S[side].race]||STK_TIERS.terran;
  const i=Math.min(t.length-1, Math.floor((S.round||0)/STK_STRESS_STEP));
  return t[i].filter(u=>STK_UNITS[u]) .length ? t[i].filter(u=>STK_UNITS[u]) : ['marine']; }
function strikeStress(n){ const S=STK; if(!S) return '오토배틀이 아닙니다';
  S.stress=Math.max(0, n|0);
  if(S.stress && !S._stressHp){ S._stressHp=true;   // 체력 부풀리기는 1회만(중복 호출 방지)
    for(const t of [S.me.base, S.me.sec, S.ai.base, S.ai.sec, S.central]){ if(!t) continue;
      t.max=Math.round((t.max||t.hp||1)*STK_STRESS_HP); t.hp=t.max; t.dead=false; t.deadT=0; }
    S.me.max=S.me.base.max; S.me.hp=S.me.base.hp; S.ai.max=S.ai.base.max; S.ai.hp=S.ai.base.hp;
    S.over=null; G.phase='playing'; }
  return '전투 관측 모드 '+(S.stress?('ON — 웨이브마다 진영별 '+S.stress+'기, '+STK_STRESS_STEP+'웨이브마다 티어 상승'):'OFF'); }
function strikeSpawnStress(){ const S=STK, n=S.stress|0;
  for(const side of ['me','ai']){ const list=_stkTierList(side);
    for(let i=0;i<n;i++) strikeSpawnUnit(side, list[(Math.random()*list.length)|0]); } }
// ── 🔄 팀 순환 출격 ─────────────────────────────────────────────────────────
// 사이클마다 각 팀에서 "한 명"씩 차례로 출격한다. 8인 예: 1팀 1,2,3,4 / 2팀 5,6,7,8 →
//   1주기 1·5 → 2주기 2·6 → 3주기 3·7 … 팀 인원이 다르면 각 팀이 독립적으로 랩어라운드(2:3이면 1·5 → 2·6 → 1·7).
//   이탈(탈락)한 플레이어는 건너뛰고 다음 사람이 채운다(G.activePlayers 기준).
const STK_TEAM_HALF=4;   // 로비 slotTeam과 동일 기준(8인 맵: 앞 절반 1~4=1팀 · 뒤 절반 5~8=2팀)
function strikeTeamOf(num){ return (num<=STK_TEAM_HALF)?1:2; }
function strikeSplitTeams(active){ const t1=active.filter(n=>strikeTeamOf(n)===1), t2=active.filter(n=>strikeTeamOf(n)===2);
  if(t1.length && t2.length) return [t1,t2];
  const h=Math.ceil(active.length/2); return [active.slice(0,h), active.slice(h)]; }   // 폴백: 팀 배정이 없는 경우(솔로·테스트)는 번호 앞뒤 절반
// 진영별 플레이어 로스터 — 내 팀=me · 상대 팀=ai. 로컬 플레이어만 실제 건설지(G.tech)로 생산하고 나머지는 시뮬.
function strikeBuildRosters(){ const S=STK; if(!S) return;
  const active=(G.activePlayers&&G.activePlayers.length)?G.activePlayers.slice():[G.myPlayer||1];
  const my=G.myPlayer||1, tt=strikeSplitTeams(active), t1=tt[0], t2=tt[1];
  const mine=(t1.indexOf(my)>=0)?t1:((t2.indexOf(my)>=0)?t2:t1), foe=(mine===t1)?t2:t1;
  const mk=(nums,race)=>nums.map(n=>({num:n, race:race, local:(n===my)}));   // 종족은 진영 대표 종족(팀=세력) — 플레이어별로 나누려면 이 필드만 바꾸면 됨
  S.me.roster=mk(mine, S.me.race); S.ai.roster=mk(foe, S.ai.race);
  if(!S.me.roster.length) S.me.roster=[{num:my, race:S.me.race, local:true}];
  if(!S.ai.roster.length) S.ai.roster=[{num:0, race:S.ai.race, local:false}];   // 솔로·테스트: 가상 상대 1명
  S.me.turnIdx=-1; S.ai.turnIdx=-1; }
// 다음 차례(활성 플레이어만 · 랩어라운드 · 이탈자 건너뜀)
function strikeNextTurn(side){ const S=STK, me=S[side], r=me.roster||[]; if(!r.length) return null;
  const act=G.activePlayers;
  for(let k=1;k<=r.length;k++){ const i=(((me.turnIdx|0)+k)%r.length+r.length)%r.length, e=r[i];
    if(e.num && act && act.length && act.indexOf(e.num)<0) continue;   // 나간 플레이어 건너뜀
    me.turnIdx=i; return e; }
  return null; }
// 한 플레이어 몫 출격 — 로컬=내 건설지의 완성 건물이 한번에 생산(미완성·파괴 건물 제외) · 원격/AI=그 종족 건물 구성으로 시뮬
function strikeSpawnForPlayer(side, e){ const S=STK; let n=0;
  const _emit=(race,bk)=>{ const uid=techBldgUnit(race,bk); if(!uid) return;
    const cnt=techBldgCount(race,bk);
    for(let k=0;k<cnt;k++){ const b4=S[side].units.length; strikeSpawnUnit(side, uid); if(S[side].units.length<=b4) break; n++; } };   // 진영 상한 도달 → 중단
  if(e.local && G.tech && G.tech.ents){
    const race=G.tech.race;
    // 🏕 캠프는 **건물 수만큼 공짜로 배출하지 않는다**(e.noEmit). 값을 안 내고 나오는 병력이 있으면
    //   반복 구매(×1.15)도 인구 상한도 의미가 없다 — 여기로 다 새 버린다.
    //   ⛔ 오토배틀은 이 배출이 병력 공급의 전부다. 플래그 없이 지우지 말 것.
    if(!e.noEmit) for(const b of G.tech.ents){ if(b.type!=='bldg' || (b.bt||0)>0 || b._dead) continue; _emit(race, b.bk); }   // 🏭 미완성(bt>0)·파괴(_dead) 건물은 생산에서 제외
    const out=G.tech.ents.filter(x=>x.type==='unit' && STK_UNITS[x.uid]);   // 🏗 건설지에서 완성해 둔 유닛도 함께 출격(일꾼·라바·알은 남김)
    for(const x of out){ const i=G.tech.ents.indexOf(x); if(i>=0) G.tech.ents.splice(i,1);
      G.tech.sup=Math.max(0,(G.tech.sup||0)-(x.pop||0));   // 전장으로 나가면 건설지 인구 반환
      G.tech.units[x.uid]=Math.max(0,(G.tech.units[x.uid]||0)-1);
      strikeSpawnUnit(side, x.uid); n++; }
    if(out.length && G.tab==='Build' && typeof techUIRender==='function') techUIRender();
    return n; }
  // 🤖 원격/AI 플레이어 = 그 종족 건물 구성으로 배출. 규모는 로컬 플레이어의 완성 생산건물 수에 연동(난이도 균형 유지).
  //   ⚠ e.race 는 직스 종족 키(terran/zerg/protoss)라 그대로 찾으면 표가 비어 폴백 2기만 나왔다(오각형 측정 전 발견한 버그).
  const arace=stkTechRace(e.race);
  const keys=Object.keys(TECH_BLDG_UNIT[arace]||{}); if(!keys.length) return 0;
  let pb=0; if(G.tech && G.tech.ents){ const mr=G.tech.race; for(const b of G.tech.ents){ if(b.type==='bldg' && (b.bt||0)<=0 && !b._dead && techBldgUnit(mr,b.bk)) pb++; } }
  pb=Math.max(2, pb);   // 최소 2
  for(let i=0;i<pb;i++) _emit(arace, keys[i%keys.length]);
  return n; }
function strikeSpawnWave(){ const S=STK; if(!S) return;   // 출격 주기: 각 팀에서 이번 차례인 플레이어 1명씩만 출격
  if(S.stress){ strikeSpawnStress(); return; }   // 🧪 관측 모드 = 건물 무시, 양 진영 대칭 소환
  if(!S.me.roster || !S.ai.roster) strikeBuildRosters();   // 최초 1회 구성(이후 이탈은 strikeNextTurn이 건너뜀)
  for(const side of ['me','ai']){ const e=strikeNextTurn(side); if(!e) continue;
    const n=strikeSpawnForPlayer(side, e);
    if(!n){ strikeSpawnUnit(side); strikeSpawnUnit(side); }   // 폴백(전멸 방지)
    if(side==='me' && e.local && (S.me.roster.length>1) && typeof toast==='function') toast('⚔️ 내 차례 — 병력 출격!'); } }
function strikeFrontStruct(side){ const S=STK, foe=S[side==='me'?'ai':'me'];   // 가장 앞 신전: 중립 살아있으면 중립(그 뒤 신전은 못 때림) → 적 2차 → 적 메인
  if(S.central && !S.central.dead) return S.central;
  if(foe.sec && !foe.sec.dead) return foe.sec;
  return foe.base; }
// 영역 테두리 frontier(레인 t: me.base=0 ~ ai.base=1). 신전 파괴 상태로 파랑/빨강 경계가 전진·후퇴
function strikeTerritory(){ const S=STK; let blue=0.25, red=0.75;   // 초기: 각자 2차까지, 중앙 흰색
  const meSecDead=S.me.sec&&S.me.sec.dead, aiSecDead=S.ai.sec&&S.ai.sec.dead, cen=S.central;
  if(cen&&cen.dead){ if(cen.deadBy==='me') blue=0.7; else if(cen.deadBy==='ai') red=0.3; }   // 중립 부순 팀 색이 상대 2차 앞까지
  if(aiSecDead) blue=0.78;   // 적 2차 파괴 → 거기까지
  if(meSecDead) red=0.22;
  if(meSecDead&&aiSecDead){ blue=0.25; red=0.75; }   // 양쪽 2차 다 파괴 → 각자 2차까지, 중앙 흰색
  return {blue:Math.max(0.05,Math.min(0.95,blue)), red:Math.max(0.05,Math.min(0.95,red))}; }
// 레인 진행도 t: me.base=0 … ai.base=1 (중앙≈0.5). 유닛 위치를 레인축에 투영.
function strikeLaneT(x,y){ const S=STK, a=S.me.base, b=S.ai.base, dx=b.x-a.x, dy=b.y-a.y, L=(dx*dx+dy*dy)||1;
  return ((x-a.x)*dx+(y-a.y)*dy)/L; }
// 💥 2차 신전 붕괴 반격 — 방어측 2차가 부서지면, 그 진영 절반(본진↔중앙)에 침투해 있던 적을 순차 폭발로 일소.
//   눈덩이 완화: 2차 상실이 곧바로 메인 함락으로 이어지지 않게, 돌파한 적 본대를 청소해 수비측에 재정비 시간을 준다. 양 진영 공통(각 팀의 방어 반격).
function strikeSecCollapse(victim){ const S=STK; const atkSide=(victim==='me')?'ai':'me', atk=S[atkSide]; if(!atk) return;
  const inHalf=(t)=> (victim==='me') ? (t<0.5) : (t>0.5);   // 방어측 절반(자기 본진~중앙)
  const doomed=atk.units.filter(u=>!u.dead && u._collapseT==null && inHalf(strikeLaneT(u.x,u.y)));
  doomed.sort((p,q)=>{ const tp=strikeLaneT(p.x,p.y), tq=strikeLaneT(q.x,q.y); return (victim==='me')?(tp-tq):(tq-tp); });   // 깊이 침투(본진 쪽)부터 → 중앙 방향으로 파도
  for(let i=0;i<doomed.length;i++){ const u=doomed[i]; u._collapseT=0.05+i*0.035; u.moving=false; u.tgtUid=null; }   // 유닛 간 0.035초 간격 = 빠른 순차 폭발
  if(doomed.length && typeof toast==='function'){
    toast(victim==='me' ? ('💥 2차 신전 붕괴 반격 — 침투한 적 '+doomed.length+'기 소멸')
                        : ('💥 적 2차 붕괴 반격 — 돌파한 아군 '+doomed.length+'기 소멸')); } }
const STK_CULL=0.12;   // 화면 밖 여유(정규화) — 이 밖의 유닛은 3D를 만들지 않는다
const STK_GRID=160;   // 격자 셀(월드) — 최대 상호작용 반경보다 크게
let _stkG=null;
function strikeGridBuild(){ const S=STK; if(!S) return null; const m=new Map();
  const add=(u)=>{ if(u.dead) return; const k=(((u.x/STK_GRID)|0)<<16)^(((u.y/STK_GRID)|0)&0xffff);
    let a=m.get(k); if(!a){ a=[]; m.set(k,a); } a.push(u); };
  for(const u of S.me.units){ u._sd='me'; add(u); }
  for(const u of S.ai.units){ u._sd='ai'; add(u); }
  return (_stkG=m); }
function strikeNear(x,y,r,out){ out.length=0; const m=_stkG||strikeGridBuild(); if(!m) return out;
  const c0=((x-r)/STK_GRID)|0, c1=((x+r)/STK_GRID)|0, r0=((y-r)/STK_GRID)|0, r1=((y+r)/STK_GRID)|0;
  for(let cy=r0;cy<=r1;cy++) for(let cx=c0;cx<=c1;cx++){
    const a=m.get((cx<<16)^(cy&0xffff)); if(!a) continue;
    for(let i=0;i<a.length;i++) out.push(a[i]); }
  return out; }
function _sepVel(u, ux, uy){ const vx=u._vx||0, vy=u._vy||0, into=vx*(-ux)+vy*(-uy);   // 밀려난 반대 방향(=파고들던 방향) 속도 성분만 제거
  if(into>0){ u._vx=vx+ux*into; u._vy=vy+uy*into; if(u._mvp){ u._mvp.vx=u._vx; u._mvp.vy=u._vy; } } }   // 물리가 다음 프레임에 다시 밀고 들어오는 것을 막는다 = 제자리 진동 제거
function strikeSeparate(){ const S=STK; if(!S) return; const all=S.me.units.concat(S.ai.units);   // nemo식 비간섭: 공격/정지 유닛=앵커(안 밀림) → 이동 유닛만 비켜서 돌아감(밀침 떨림 제거)
  const _nb=[];
  for(let it=0; it<3; it++){
    strikeGridBuild();   // ⚡ 반복마다 격자 갱신(위치가 바뀌므로) — 전체 쌍 순회 대신 근접 질의
    for(let i=0;i<all.length;i++){ const a=all[i]; if(a.dead) continue;   // 스폰 대기(wait) 유닛도 분리 대상
      strikeNear(a.x, a.y, (a.size||14)*2*STK_SEP+40, _nb);
      const aAir=strikeIsAir(a), aSepK=(aAir?STK_SEP_AIR:STK_SEP);   // ⚡ a쪽 값은 안쪽 루프에서 불변 → 밖으로 꺼낸다
      for(let j=0;j<_nb.length;j++){ const b=_nb[j]; if(b===a||b.dead) continue;
        if((b.uid||0)<=(a.uid||0)) continue;   // 각 쌍을 한 번만 처리
        if(aAir!==strikeIsAir(b)) continue;   // 레이어가 다르면(공중↔지상) 충돌하지 않음 — 아래로 지나감
        let dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy); const min=(a.size+b.size)*aSepK;   // 간격 단일 기준(회피 반경도 여기서 파생) · 공중은 더 조밀
        if(d<min){ if(d<0.01){ dx=Math.random()-0.5; dy=Math.random()-0.5; d=1; } const p=(min-d), ux=dx/d, uy=dy/d;
          const aFix=!a.moving, bFix=!b.moving;   // 정지(공격/대기) 유닛은 앵커 — 지나가는 유닛이 비켜감
          if(aFix&&!bFix){ b.x+=ux*p; b.y+=uy*p; _sepVel(b, ux, uy); }          // a=정지(공격 중) 앵커 → 이동 중인 b만 돌아감(정지 유닛은 절대 밀리지 않음)
          else if(bFix&&!aFix){ a.x-=ux*p; a.y-=uy*p; _sepVel(a, -ux, -uy); }   // b 앵커 → 이동 중인 a만 돌아감
          else { a.x-=ux*p*0.5; a.y-=uy*p*0.5; b.x+=ux*p*0.5; b.y+=uy*p*0.5; _sepVel(a,-ux,-uy); _sepVel(b,ux,uy); } } } } }   // 둘 다 이동/둘 다 정지 → 절반씩(겹침만 해소)
  strikeTempleClampUnits(); }
function strikeTempleClampUnits(){ const S=STK; if(!S) return; const all=S.me.units.concat(S.ai.units);   // 유닛이 신전을 통과하지 못하게(살아있는 신전만 충돌)
  const tps=[[S.me.base,150],[S.ai.base,150],[S.me.sec,80],[S.ai.sec,80],[S.central,35]];   // 신전별 발자국 반경(월드)
  for(const tp of tps){ const o=tp[0]; if(!o||o.dead) continue; const tr=tp[1];
    for(const u of all){ if(u.dead) continue; let dx=u.x-o.x, dy=u.y-o.y, d=Math.hypot(dx,dy); const min=tr+(u.size||14)*1.5;
      if(d<min){ if(d<0.01){ const ang=Math.random()*6.283; dx=Math.cos(ang); dy=Math.sin(ang); d=1; } const nx=dx/d, ny=dy/d, push=min-d; u.x+=nx*push; u.y+=ny*push; } } } }
function strikeStepUnits(dt){ const S=STK; if(!S||S.over) return;
  strikeGridBuild();   // ⚡ 프레임 1회 격자 구축 — 회피 이웃 질의에 재사용
  for(const side of ['me','ai']){ const me=S[side], foe=S[side==='me'?'ai':'me'], col=side==='me'?'#7fd0ff':'#ff8a96';
    strikeFrzStep(me, dt);   // 🐺 광폭화 감쇠(전투가 끊기면 줄어든다) — 진영당 프레임 1회
    const front=strikeFrontStruct(side);   // 가장 앞 신전 1개만 타겟(뒤 신전은 못 때림)
    const _load=new Map();   // 표적별 현재 배정 인원 — 한 표적에 전군이 몰리는 것을 막는다
    for(const x of me.units){ if(x.tgtUid) _load.set(x.tgtUid,(_load.get(x.tgtUid)||0)+1); }
    for(const u of me.units){ if(u.dead) continue;
      if(u._collapseT!=null){ u._collapseT-=dt; u.moving=false; u._vx=0; u._vy=0;   // 💥 2차 붕괴 반격 대상 — 순차 폭발 대기
        if(u._collapseT<=0){ u.dead=true;
          if(!S.fx||!S.fx.shots){ S.fx=FX.store(); S.fx.hitK=STK_HIT_K; }
          FX.death(S.fx, u.x, u.y, {unitSize:(u.size||14)*1.7, color:'#ffca4a', parts:STK_DEATH_PARTS+8}); }   // 큰 폭발 이펙트
        continue; }
      if(u.wait>0){ u.wait-=dt; u.moving=false; continue; }   // 스폰 후 0.5초 대기(중앙 응시 상태로 정지)
      // ⛔ **정지(stun)** — 봉쇄·빙결·마비 폭풍이 거는 상태(HUNT_R1 §3-4-4).
      //   움직이지도 때리지도 못한다. `u.wait` 와 같은 자리에 두는 이유는 그 아래 전부
      //   (표적 선정·이동·사격)를 통째로 건너뛰어야 하기 때문이다.
      //   ⚠ 지속 시간은 **여기서만** 깎는다. `strikeSkillTick` 의 `u.buff` 루프에 넣으면
      //     두 번 깎여 절반이 된다(치유에서 이미 밟은 함정이다).
      if(u.stunT>0){ u.stunT=Math.max(0,u.stunT-dt); u.moving=false; continue; }
      // 🐌 **둔화(slow)** — 점착 가스가 거는 상태. 정지와 달리 **느려질 뿐** 계속 싸운다.
      //   배수는 `strikeSlowMul` 이 낸다(이동에만 건다 · 공격 속도는 안 건드린다).
      if(u.slowT>0) u.slowT=Math.max(0,u.slowT-dt);
      if(u._btT>0){ u._btT-=dt; if(u._btT<=0) u._btgt=null; }   // 포기했던 표적의 재선정 금지 시간
      if(!u._atk) u._atk=(typeof _sbAtkMode==='function')?_sbAtkMode({id:u.id, gmodel:u.gm}):{air:true,gnd:true};   // 공격 가능 레이어(관리자 전투실험과 동일 규칙)
      const _canHit=(o)=>{ const k=o.gm||o.id, air=(typeof FXLAB_AIR!=='undefined'&&FXLAB_AIR.has(k)); return air?u._atk.air:u._atk.gnd; };
      if(HEALER[u.gm||u.id]){ strikeHealStep(u, me, dt); continue; }   // 💉 무공격 지원 — 표적 선정 전체를 건너뛴다
      if(!u.rallied){ const _rp=strikeRallyPoint(side);   // 소환 직후: 본진 앞 집결 지점에 모였다가 출발(양 옆으로 흩어져 맵 끝을 도는 것 방지)
        if(Math.hypot(_rp.x-u.x,_rp.y-u.y)<=STK_RALLY_R) u.rallied=true;
        else { let _eng=false;
          for(const e of foe.units){ if(e.dead||!_canHit(e)) continue; const _rc=strikeReach(u,e); const _ddx=e.x-u.x,_ddy=e.y-u.y; if(_ddx*_ddx+_ddy*_ddy<=_rc*_rc){ _eng=true; break; } }
          if(!_eng){ strikeMoveToward(u, _rp.x, _rp.y, dt); continue; } } }   // 사거리 안에 적이 있으면 그대로 교전
      let tgt=strikeFindUnit(foe.units, u.tgtUid);   // 현재 타겟
      const _d2=(o)=>{ const dx=o.x-u.x, dy=o.y-u.y; return dx*dx+dy*dy; };
      { let inR=null;   // ① 사거리 안에 때릴 수 있는 적 중 '가장 가까운' 적
        // ⚡ 들고 있던 표적이 아직 사거리 안이면 O(1) 검증만 하고 격자 질의를 건너뛴다(참조로 보관 — uid 재조회는 선형 탐색이라 더 비싸다).
        const _c=u._inrObj;
        if(_c && !_c.dead && _c._sd!==u._sd && _canHit(_c)){ const _rc=strikeReach(u,_c); if(_d2(_c)<=_rc*_rc) inR=_c; }
        if(!inR) u._inrObj=null;
        u._inrT=(u._inrT||0)-dt;
        if(!inR && u._inrT<=0){ u._inrT=STK_INR_T*(0.75+Math.random()*0.5);   // 유닛마다 위상을 흩어 한 프레임에 몰리지 않게
          let inRd=Infinity;
          const _fr=u.rng+120, _fb=strikeNear(u.x,u.y,_fr,u._tgBuf||(u._tgBuf=[]));
          for(let _i=0;_i<_fb.length;_i++){ const e=_fb[_i]; if(e._sd===u._sd||e.dead||!_canHit(e)) continue;
            const d2=_d2(e); const _rc=strikeReach(u,e); if(d2<=_rc*_rc && d2<inRd){ inRd=d2; inR=e; } }
          u._inrObj=inR; }
        if(inR) tgt=inR;
        else {   // ② 사거리 밖: 인지 범위 안 최근접을 주기적으로 재탐색(잦은 전환 방지)
          const _cap=(e)=>Math.max(3, Math.floor(6.2832*strikeReach(u,e)/Math.max(1,(u.size||14)*2*STK_SEP)));   // 그 표적 주위에 내가 설 수 있는 자리 수
          const _okT=(e)=>{ if(u._btT>0 && e.uid===u._btgt) return false;   // 방금 포기한 표적은 잠시 제외
            return ((_load.get(e.uid)||0) - (u.tgtUid===e.uid?1:0)) < _cap(e); };   // 정원이 찼으면 후보에서 제외(나 자신은 빼고 센다)
          const _AR=u.acq*STK_ACQ_FAR, _AR2=_AR*_AR;   // 교전 판단은 이 반경 하나로만 한다(아래 신전 분기와 동일)
          const keep = tgt && _canHit(tgt) && _okT(tgt) && _d2(tgt)<=_AR2;
          u._acqT=(u._acqT||0)-dt;
          if(!keep || u._acqT<=0){ u._acqT=0.35+Math.random()*0.2;
            let bs=Infinity, best=null;
            const _ab=strikeNear(u.x,u.y,_AR,u._acBuf||(u._acBuf=[]));
            for(let _i=0;_i<_ab.length;_i++){ const e=_ab[_i]; if(e._sd===u._sd||e.dead||!_canHit(e)||!_okT(e)) continue;
              const d2=_d2(e); if(d2>_AR2) continue; if(d2<bs){ bs=d2; best=e; } }   // 정원이 남은 적 중 최근접(격자)
            if(best && tgt && best!==tgt && _canHit(tgt) && bs > _d2(tgt)*0.8) best=tgt;   // 눈에 띄게 가깝지 않으면 기존 목표 유지
            // ⚠ 정원(_okT)에 막혀 후보가 없으면 tgt=null → 신전 분기로 빠진다.
            //   그러면 "신전 때리는 무리 옆에 적이 서 있는데 서로 무시"가 된다(정원은 몰림 방지용이지 교전 회피용이 아님).
            //   → 정원을 무시하고 한 번 더 찾는다. 적 유닛이 인지 범위에 있으면 신전보다 항상 먼저.
            if(!best){ let bs2=Infinity, b2=null;
              const _ab2=strikeNear(u.x,u.y,_AR,u._acBuf||(u._acBuf=[]));
              for(let _i=0;_i<_ab2.length;_i++){ const e=_ab2[_i]; if(e._sd===u._sd||e.dead||!_canHit(e)) continue;
                const d2=_d2(e); if(d2>_AR2) continue; if(d2<bs2){ bs2=d2; b2=e; } }
              if(b2) best=b2; }
            if(best) tgt=best; else if(!keep) tgt=null; } } }
      { const _pt=u.tgtUid; u.tgtUid = tgt?tgt.uid:null;   // 표적이 바뀌면 배정 인원도 즉시 갱신(같은 프레임의 뒤 유닛이 정확한 수를 본다)
        if(_pt!==u.tgtUid){ if(_pt&&_load.has(_pt)) _load.set(_pt, Math.max(0,_load.get(_pt)-1));
          if(u.tgtUid) _load.set(u.tgtUid, (_load.get(u.tgtUid)||0)+1); } }
      let _toTemple=!tgt, _fireT=false;   // _toTemple=신전 분기로 처리 · _fireT=표적에 못 닿는 동안 사거리 안 신전을 대신 사격
      if(tgt){ const d=Math.hypot(tgt.x-u.x,tgt.y-u.y);   // 유닛 우선 교전
        // 🗿 최소 사거리 — 이보다 가까우면 **쏠 수 없다**. 뒤로 물러나 거리를 되찾는다.
        //   ⚠ 이것이 '페럴 > 콜로서스'의 핵심이다(RACES.md §1). 물러나면 전개도 다시 걸려 화력이 더 늦는다.
        if(u.minRng>0 && d < u.minRng+(u.size||14)*0.95){
          const _ax=u.x-(tgt.x-u.x), _ay=u.y-(tgt.y-u.y);   // 표적 반대 방향
          strikeMoveToward(u, _ax, _ay, dt); u.depT=u.dep; u._blk=0; }
        else if(d<=strikeReach(u,tgt)){ u.moving=false; u._blk=0; u._swp=0; u.face=Math.atan2(tgt.x-u.x, tgt.y-u.y);
          // 🗿 전개 — 멈춘 뒤 dep 초가 지나야 쏜다. 움직이면 다시 채워진다(strikeMoveToward 가 채운다).
          if(u.depT>0){ u.depT-=dt; }
          else { u.cd-=dt;
          if(u.cd<=0){ u.cd=u.cdMax*strikeFrzCdMul(u,me); u.fireSeq=(u.fireSeq||0)+1; strikeHit(tgt, u.dmg*strikeSkillAtkMul(u)*strikeAtkMul(me), u); strikeFx(u,tgt.x,tgt.y,col);   // fireSeq++ = 3D 공격 모션 · 실드/방어/상성 표준 적용
            { const _uAir=strikeIsAir(u);
              if(!tgt.tgtUid && (!tgt._atk || (_uAir? tgt._atk.air : tgt._atk.gnd))) tgt.tgtUid=u.uid;   // 반격은 때릴 수 있을 때만
              tgt._acqT=0; tgt._inrT=0;                           // 맞으면 즉시 재판단(사거리 안 스캔 주기도 리셋)
              strikeAlert(foe.units, u.uid, tgt.x, tgt.y, 420, _uAir); }   // 주변 아군 가담(때릴 수 있는 아군만)
            if(u.splash>0){ const sr2=u.splash*u.splash, sd=u.dmg*0.6;   // 광역: 타겟 주변 적에게 60% 추가타
              for(const e of foe.units){ if(e===tgt||e.dead) continue; const ex=e.x-tgt.x, ey=e.y-tgt.y; if(ex*ex+ey*ey<=sr2){ strikeHit(e, sd, u); if(e.hp<=0){ e.dead=true; me.kills=(me.kills||0)+1; me.gold+=strikeKillGold(e); strikeFrzKill(me); } } } }   // 실드/방어/대상별 상성 + 🐺 광폭화
            if(tgt.hp<=0){ tgt.dead=true; me.kills=(me.kills||0)+1; me.gold+=strikeKillGold(tgt); strikeFrzKill(me); } } } }   // 처치 집계 + 킬 보상 + 🐺 광폭화 스택
        else { const _gq=(front&&!front.dead)?strikeTempleGap(front,u.x,u.y):1e9;
          // ⚠ 적 표적이 있으면 **접근이 실제로 막혔을 때만** 신전을 때린다.
          //   예전엔 "표적이 아직 사거리 밖"이기만 하면 그 자리에서 신전을 쐈고(_fireT=true),
          //   그 _fireT가 아래 _foeNear(적이 근처면 신전 공격 중단) 가드까지 무력화해
          //   "적이 코앞인데 서로 신전만 두들기는" 상태가 됐다. 이제는 다가가는 것이 우선.
          if(u._atk.gnd && (u._blk||0)>STK_GIVEUP*0.5 && _gq<=u.rng+(u.size||14)*1.05){ _toTemple=true; _fireT=true; }   // 앞이 꽉 차 접근 불가일 때만(놀지 않게)
          else { let _ap=strikeApproachPt(u, tgt.x, tgt.y, strikeReach(u,tgt)*0.9, tgt.uid, dt);
            // 링(표적 주위 사거리 원) 위의 점을 노리는 건 여러 유닛이 한 표적을 둘러싸게 하려는 것인데,
            // 근접·공중에는 표적 앞에서 자리를 찾느라 빙글 도는 동작으로만 나타난다(접근도 2배 느려짐).
            // 겹침은 간격 규칙이 이미 막으므로 이 둘은 표적 중심으로 곧장 간다.
            if(u.melee || strikeIsAir(u)) _ap={x:tgt.x, y:tgt.y};
            if((u._blk||0)>STK_GIVEUP){ u._btgt=tgt.uid; u._btT=STK_BLIST; u._blk=0; u._swp=0; u._pck=null; _toTemple=true; }   // 오래 못 다가감 = 앞이 꽉 참 → 표적 포기하고 신전으로
            else strikeMoveToward(u, _ap.x, _ap.y, dt); } }   // 사거리 링 위로 접근 — 막히면 링을 따라 옆으로 흘러 빈 곳을 찾는다
      }
      if(_toTemple){
        // ⚠ 예전엔 여기서 "인지범위 1.4배 안에 적이 있으면 신전 공격 중단"(_foeNear)을 따로 판정했다.
        //   그런데 표적 획득 반경은 1.0배라, 그 사이 구간의 적은 "때리지 마라"고 막기만 하고 표적으로 주지는 않았다.
        //   결과: 표적 없이 신전 접근 링을 따라 움직여 제자리에서 쏘면 될 것을 앞으로 나가거나 빙글 돌았다.
        //   → 획득 반경을 같은 값으로 통일(STK_ACQ_FAR)해 별도 가드를 없앴다. 적이 있으면 애초에 표적이 잡힌다.
        const _th=strikeTempleHalf(front);
        const _cd=Math.hypot(u.x-front.x, u.y-front.y);   // 중심 거리
        const d=(!u._atk.gnd)?1e9:strikeTempleGap(front,u.x,u.y);   // 사각형 표면까지의 실거리(모서리에서 과도하게 파고드는 문제 제거)
        if(d<=u.rng+(u.size||14)*1.05){ u.moving=false; u._blk=0; u._swp=0; u.face=Math.atan2(front.x-u.x, front.y-u.y); u.cd-=dt;
          if(u.cd<=0){ u.cd=u.cdMax; u.fireSeq=(u.fireSeq||0)+1; front.hp-=u.dmg*strikeSkillAtkMul(u)*strikeAtkMul(me)*_sbTypeMulSize({id:u.id,gmodel:u.gm},'l'); strikeFx(u,front.x,front.y,col); if(front.hp<=0){ front.dead=true; front.deadBy=side;
            if(front===S.me.sec) strikeSecCollapse('me'); else if(front===S.ai.sec) strikeSecCollapse('ai');   // 💥 2차 파괴 = 방어측 반격(침투 적 일소)
            strikeCheckOver(); } } }   // fireSeq++ = 3D 공격 모션 · 건물=대형('l') 상성 적용
        else { const _sr=strikeTempleR(front, Math.atan2(u.y-front.y, u.x-front.x))+u.rng*0.75;   // 그 방향의 사각형 표면 + 사거리 여유
          if(!u._atk.gnd && _cd<=_sr*1.15){ u.moving=false; u._vx=0; u._vy=0; if(u._mvp){ u._mvp.vx=0; u._mvp.vy=0; } u._blk=0; u._swp=0; }
          // ↑ 신전을 때릴 수 없는 유닛(공대공 전용·비전투)은 링에 닿으면 그대로 대기.
          //   때릴 수 없는 대상에는 거리가 영원히 줄지 않아 막힘 타이머가 무한 누적 → 우회가 상시 발동 → 신전 주위를 계속 도는 원인이었다.
          else {
          // 공중 유닛은 신전 형상을 완전히 무시하고 중심으로 직진한다(실제 비행체처럼 위를 그대로 지나감).
          //   접근점(strikeApproachPt)은 "사각형 표면 + 사거리" 링 위의 점 = 지상 충돌 개념이라,
          //   공중에 그대로 쓰면 가장자리를 따라 돌아가는 것처럼 보였다.
          let _ap=strikeIsAir(u) ? {x:front.x, y:front.y}
                                 : strikeApproachPt(u, front.x, front.y, _sr, 'T'+strikeGoalKey(front), dt);
          if(!strikeIsAir(u) && !u._swp && _cd>STK_FF_NEAR){   // 먼 거리 행군 = 공유 흐름장(지형·신전을 알아서 우회) · 공중은 직선 비행
            const _fd=strikeFlowDir(strikeFlowField(front), u.x, u.y);
            if(_fd) _ap={x:u.x+_fd.x*STK_FF_LOOK, y:u.y+_fd.y*STK_FF_LOOK}; }
          strikeMoveToward(u, _ap.x, _ap.y, dt); } } } }   // 근거리는 사거리 링 위로 — 앞이 차면 옆으로 흘러 빈 곳을 찾는다
    const _dead=me.units.filter(u=>u.dead);
    if(_dead.length){ if(!S.fx||!S.fx.shots){ S.fx=FX.store(); S.fx.hitK=STK_HIT_K; }
      for(const du of _dead) FX.death(S.fx, du.x, du.y, {unitSize:(du.size||14)*0.5, color:du.color, parts:STK_DEATH_PARTS}); }   // 400기 난전에서 화면이 이펙트로 덮이지 않게 크기·파편 수를 낮춤
    if(_dead.length && window.M3D && M3D.dropModels){ try{ M3D.dropModels(_dead.map(u=>u.uid)); }catch(e){} }   // 모델 제거
    me.units=me.units.filter(u=>!u.dead); }
  strikeSuddenDeath(dt);   // ☠ 장기전 방지
  strikeSkillTick(dt);   // 🔮 마나 재생·쿨다운·자기강화/오라 자동 시전
  strikeSeparate();   // 유닛 분리(겹침 방지)
  if(S.fx) FX.advance(S.fx, dt);   // 공격 이펙트(공용 FX 코어) 전진·감쇠
}
function strikeDrawTempleHp(ctx,w2s,scale,S){ if(!S) return;   // 신전 HP = 유닛과 동일 규격의 얇은 바(이름·수치 텍스트 없음)
  const list=[S.me.base,S.ai.base,S.me.sec,S.ai.sec,S.central];
  const _sMin=Math.min(S.cw||1,S.ch||1)*STK_MINZOOM/2600, k=Math.max(1, scale/(_sMin||1));   // 유닛 바와 같은 배율 규칙
  for(const o of list){ if(!o||o.dead||o.hp==null) continue;
    const p=w2s(o.x,o.y), hpr=Math.max(0,Math.min(1,o.hp/(o.max||1)));
    const _isMain=(o===S.me.base||o===S.ai.base), half=strikeTempleHalf(o)*scale, bw=Math.max(28*k, half*(_isMain?1.9:1.45)), bx=p.x-bw/2, by=p.y+half*0.62+5*k, b=1*k;   // 바 폭 = 모델 폭(메인 기준) · 2차·중립은 조금 짧게
    ctx.fillStyle='rgba(4,8,12,.92)'; ctx.fillRect(bx-b,by-b,bw+b*2,1*k+b*2);
    ctx.fillStyle=hpBarColor(hpr); ctx.fillRect(bx,by,bw*hpr,1*k); } }
function strikeDrawSelection(ctx,w2s,scale,S){ /* 지정 표시는 하단 3D 링으로 통일(유닛=진영색·선택 시 굵게, 신전=노랑) — 2D 표시 없음 */ }
function strikeUnitRole(id){ const s=STK_UNITS[id]||{}; return s.melee?'근접':(s.splash?'광역':'원거리'); }
// 직스 유닛/건물 선택 프로필 = 관리자(메인) 커맨드 그리드(renderCmdGrid) 재사용 — 모델만 직스 데이터로 구성
//   적=upg(빨강) · 아군/내 구조물=prod(청록) · 중립=build(골드) 로 강조색 통일
function _stkUnitModel(u, side){ const def=STK_UNITS[u.id]||{};
  const race=(side==='ai')?(STK&&STK.ai.race):(STK&&STK.me.race), raceName=(STK_RACES[race]&&STK_RACES[race].name)||'';
  const cd=u.cdMax||u.cd||def.cd||0, spd=cd>0?((1/cd).toFixed(1)+'/s'):'-', teamKo=(side==='ai')?'적군':'아군';
  return { mode:(side==='ai')?'upg':'prod', compact:true, build:true,
    title: escHtml(strikeUnitName(u.id)), icon: unitPortraitHTML(u.id),
    hpsh: _cgHpShStr(Math.round(u.hp)+'/'+Math.round(u.maxHp||def.hp||0), 0, 0),
    items: [],
    info: { eb:'', hideName:true,
      stats: [ ['공격력', ''+Math.round(u.dmg||def.dmg||0)], ['사거리', ''+Math.round(u.rng||def.rng||0)], ['공격속도', spd], ['유형', strikeUnitRole(u.id)] ] } }; }
function _stkTempleModel(o, name){ const S=STK;   // 진영 판별 = 이름이 아니라 객체로(텍스트에서 아군/적군 표기를 없앴으므로)
  const enemy=!!(S&&(o===S.ai.base||o===S.ai.sec)), neut=!!(S&&o===S.central);
  const pct=Math.max(0,Math.round((o.hp/(o.max||1))*100));
  return { mode:enemy?'upg':(neut?'build':'prod'), compact:true, build:true,
    title: escHtml(name),
    icon: bldgPortraitOf(o._mk||'temple_main','🏛'),   // 관리자 건물 프로필과 동일한 초상(3D 모델 이미지)
    hpsh: _cgHpShStr(Math.round(o.hp)+'/'+Math.round(o.max||0)+' ('+pct+'%)', 0, 0),   // 내구도 = 체력 수치 옆 괄호
    items: [],
    info: { eb:'', hideName:true, desc:_stkTempleDesc(o), stats: [] } }; }   // 설명 한 줄만(유형·내구도 항목 제거)
// 신전 설명 — 그 신전이 게임에 미치는 효과만 한 줄로
function _stkTempleDesc(o){ const S=STK; if(!S) return '';
  if(o===S.central) return '마지막으로 파괴한 팀이<br>강력한 유닛을 얻습니다.';
  if(o===S.me.sec||o===S.ai.sec) return '파괴 시 적 유닛이<br>블랙홀로 빨려들어갑니다.';
  if(o===S.ai.base) return '파괴하면<br>즉시 승리합니다.';
  return '파괴되면<br>즉시 패배합니다.'; }
function strikeToggleSupply(on){ const S=STK; if(!S) return;
  S.supSheet=(on==null)?!S.supSheet:!!on; S.supPage=null;
  if(S.supSheet){ S.specSheet=false; S.specView=null; }   // 보급↔관전 상호배타
  const h=document.getElementById('unitCmd'); if(h) h._stkSig=null;
  if(G.tab==='Build' && typeof techPanelRender==='function') techPanelRender();   // 건설지에서는 시트 호스트가 달라 즉시 다시 그린다
  if(typeof playSfx==='function') playSfx('ui_tab'); }
function strikeSupPage(p){ const S=STK; if(!S) return; S.supPage=p||null;
  const h=document.getElementById('unitCmd'); if(h) h._stkSig=null; }
// 👁 관전 시트 — 보급과 동일한 하단 시트 토글(화면 이동 X). 플레이어 카드 선택 시 그 진영 건설을 관전(specView). 시트 내리면 관전 종료(전장 복귀).
function strikeToggleSpec(on){ const S=STK; if(!S) return;
  S.specSheet=(on==null)?!S.specSheet:!!on;
  if(S.specSheet){ S.supSheet=false; } else { S.specView=null; }   // 상호배타 · 내리면 관전 종료
  const h=document.getElementById('unitCmd'); if(h) h._stkSig=null;
  if(G.tab==='Build' && typeof techPanelRender==='function') techPanelRender();
  if(typeof playSfx==='function') playSfx('ui_tab'); }
function strikeSpecPick(n){ const S=STK; if(!S) return;
  const me=(G.myPlayer||1); if((n<=4)!==(me<=4)){ strikeToast('적 진영은 암흑 시야입니다 🌑'); return; }   // 내 팀 아니면 관전 불가
  S.specView=(S.specView===n)?null:n;   // 같은 플레이어 다시 = 전장 복귀
  const h=document.getElementById('unitCmd'); if(h) h._stkSig=null;
  if(G.tab==='Build' && typeof techPanelRender==='function') techPanelRender();
  if(typeof playSfx==='function') playSfx('ui_confirm'); }
// 👁 오토배틀 관전 시트 = 네모(renderPlayers)와 동일한 관전 전용 .plbtn 플레이어 그리드(커맨드 그리드 아님).
//   실제 참가자만(G.activePlayers) · 팀=슬롯 절반(1-4 vs 5-8) · 나=mine(잠금) · 적=off(암흑 시야) · 관전중=me
function _stkSpecGridHTML(){ const S=STK, me=(G.myPlayer||1), myA=(me<=4), names=G.playerNames||{};
  const active=G.activePlayers||[me];   // 네모 renderPlayers 와 동일: 항상 8칸(4×2), 없는 자리는 빈자리
  let h='<div class="plGrid stkSpecGrid">';
  for(let n=1;n<=8;n++){ const isMe=(n===me), present=active.indexOf(n)>=0, enemy=present&&((n<=4)!==myA), ally=present&&!isMe&&!enemy, watching=(S&&S.specView===n);
    const cls='plbtn'+(isMe?' mine':(ally?(watching?' me':''):' off'));   // 나=mine · 아군=관전가능(관전중=me) · 적군/빈자리=off(잠금)
    const col=(isMe||present)?strikePColor(n):'#b6bdc8';   // 빈 자리만 무채색(흰색 계열)
    let nm; if(isMe) nm=escHtml(names[n]||(typeof myNick==='function'?myNick():'나'));
      else if(enemy) nm='적군 🌑'; else if(present) nm=escHtml(names[n]||(n+'P')); else nm='빈 자리';
    const click=ally?(' onclick="strikeSpecPick('+n+')"'):'';   // 입장한 아군만 관전 가능
    h+='<div class="'+cls+'" style="--pc:'+col+'"'+click+'><div class="plnum">'+n+'P</div><div class="plst">'+nm+'</div></div>'; }
  return h+'</div>'; }
// 📦 업그레이드 시트 — 4그리드(① 광산 ② 강화 ④ 특수무기 / 3번은 비움). 구매·강화·투하는 기존 함수를 그대로 호출.
// 카드 표기 통일 — 자리는 **이름 아래 줄(`sub`)**, 네모 업그레이드 카드(_upgAtkItems)와 같은 규약이다.
//   ⚠ 우상단 배지(`tr`)로 되돌리지 말 것: 배지는 초상 위에 떠서 그림을 가리고, 네모와 판이 달라 보인다.
function _stkLv(cur,max){ return (cur>=max)?'MAX':(cur+'/'+max); }
// ── 📦 하단 시트 모델 ────────────────────────────────────────────────────
// 구역·하위는 하단 네비(STK_TREE)가 고르고, 여기서는 그 키에 맞는 그리드만 만든다.
//   건설지 > 강화 = 광산 + 공격력·체력   ·   특수무기 > 구입/사용 = STK_WEAPONS 표
// 칸 자리: [공격력][체력][빈칸][광산] — 유닛 강화가 앞, 경제(광산)는 끝 칸
function _stkUpgModel(){ const S=STK, me=S.me, gold=Math.floor(me.gold||0);
  const items=[];
  // 아이콘은 사냥터 업그레이드(HB_UPG)와 **같은 파일을 빌린다** — 뜻이 같으면 새로 만들지 않는다.
  for(const kv of [['atk','공격력','⚔','up_melee_atk'],['hp','체력','❤','up_carapace']]){
    const k=kv[0], lv=(k==='atk'?me.atkLv:me.hpLv), cost=strikeUpCost(k,lv), full=(lv>=10);
    items.push({ pro:_icoImg('upgrades',kv[3],kv[2]), sn:kv[1], cr:(full?0:cost), sub:_stkLv(lv,10), tip:k,
      state:full?'max':(gold<cost?'dim':'on'), act:full?'':('onclick="strikeUpg(\''+k+'\')"')+_techTipAttr('sup',k) }); }
  items.push({state:'empty'});
  { const mn=(me.mines||0), mfull=(mn>=STK_MINE_CAP);
    items.push({ pro:_icoImg('upgrades','up_mine','⛏'), sn:'광산', cr:mfull?0:me.mineCost, sub:_stkLv(mn, STK_MINE_CAP),
      state:mfull?'max':(gold<me.mineCost?'dim':'on'), act:mfull?'':('onclick="strikeBuyMine()"'+_techTipAttr('sup','mine')) }); }
  return { mode:'prod', compact:true, build:true, title:'강화', icon:pIco('🔧','ic-gold'), items:items,
    info:{ eb:'강화', hideName:true, desc:'수입 '+strikeIncome(me)+'/웨이브<br>카드를 길게 누르면 설명이 나옵니다.' } }; }
function _stkWpnIco(w){ return w.sk ? _icoImg('skills','sk_'+w.sk, w.ico) : pIco(w.ico,w.cls); }   // 구입·사용이 같은 그림을 쓴다
// 🛒 구입 — 표 그대로가 상점 칸이 된다(품목을 여기서 새로 적지 말 것)
function _stkWpnBuyModel(){ const S=STK, me=S.me, gold=Math.floor(me.gold||0);
  const items=STK_WEAPONS.map(function(w){ const have=(me.wpn&&me.wpn[w.k])||0, full=(have>=w.cap);
    return { pro:_stkWpnIco(w), sn:w.name, cr:(full?0:w.cost), sub:_stkLv(have,w.cap),
      state:full?'max':(gold<w.cost?'dim':'on'), act:full?'':('onclick="strikeBuyWpn(\''+w.k+'\')"') }; });
  return { mode:'prod', compact:true, build:true, title:'특수무기 · 구입', icon:pIco('🛒','ic-gold'), items:items,
    info:{ eb:'구입', hideName:true, desc:'골드로 구입해 두고 <b>사용</b>에서 꺼내 쓴다.' } }; }
// 💥 사용 — **구입과 같은 자리에 같은 순서로** 늘어놓는다. 없는 것은 빈 칸이 아니라 '비활성'이다
//   (자리가 비면 산 것과 안 산 것의 위치가 매번 달라져 손이 헷갈린다).
function _stkWpnUseModel(){ const S=STK, me=S.me;
  const own=STK_WEAPONS.filter(w=>((me.wpn&&me.wpn[w.k])||0)>0);
  const items=STK_WEAPONS.map(function(w){ const have=(me.wpn&&me.wpn[w.k])||0;
    return { pro:_stkWpnIco(w), sn:w.name, sub:'×'+have,
      state:have>0?'on':'dim', act:have>0?('onclick="strikeUseWpn(\''+w.k+'\')"'):'' }; });
  return { mode:'prod', compact:true, build:true, title:'특수무기 · 사용', icon:pIco('💥','ic-danger'), items:items,
    info:{ eb:'사용', hideName:true,
      desc:own.length?'칸을 누르면 즉시 발동한다.':'가진 무기가 없습니다 — <b>구입</b>에서 먼저 사세요.' } }; }
function _stkSupplyModel(){ return (STK && STK.supPage==='wpnUse') ? _stkWpnUseModel()
  : (STK && STK.supPage==='wpnBuy') ? _stkWpnBuyModel() : _stkUpgModel(); }
// 📦 보급·관전 시트의 '내용 서명' — 값이 그대로면 다시 그릴 이유가 없다.
//   ⚠ 두 호스트(#unitCmd = 전투/특수무기 · #btSheetBody = 건설지)가 **같은 함수**를 본다.
//     서명을 두 벌로 적으면 한쪽만 갱신되는 화면이 생긴다.
function _stkSheetSig(){ const S=STK; if(!S) return null;
  if(S.specSheet) return 'spec|'+(S.specView||'-')+'|'+((G.activePlayers||[]).join('.'))+'|'+(G.myPlayer||1);
  if(S.supSheet) return 'sup|'+(S.supPage||'-')+'|'+Math.floor(S.me.gold)+'|'+(S.me.mines||0)+'|'+((S.me.atkLv||0)+'-'+(S.me.hpLv||0))
    +'|'+STK_WEAPONS.map(w=>(S.me.wpn&&S.me.wpn[w.k])||0).join('')+'|'+S.me.mineCost;
  return null; }
function strikeRenderSelInfo(){ const S=STK; const host=document.getElementById('unitCmd');
  { const old=document.getElementById('stSelInfo'); if(old && !old.classList.contains('hide')){ old.classList.add('hide'); old.innerHTML=''; } }   // 구 프로필 사용 안 함
  if(!host) return;
  let model=null, sig=null, specHTML=null;
  if(S && S.specSheet){ specHTML=_stkSpecGridHTML(); sig=_stkSheetSig(); }   // 👁 관전 = 전용 .plbtn 그리드(커맨드 그리드 아님)
  else if(S && S.supSheet){ model=_stkSupplyModel(); sig=_stkSheetSig(); }
  else if(S && S.selTemple && !S.selTemple.dead){ const o=S.selTemple, nm=S.selTempleName||'신전'; model=_stkTempleModel(o,nm); sig='t|'+nm+'|'+Math.round(o.hp); }
  else if(S && S.selEnemy && !S.selEnemy.dead){ const u=S.selEnemy; model=_stkUnitModel(u,'ai'); sig='e|'+u.id+'|'+Math.round(u.hp); }
  else if(S){ const u=(S.selAllies||[]).map(uid=>strikeFindUnit(S.me.units,uid)).filter(Boolean)[0]; if(u){ model=_stkUnitModel(u,'me'); sig='a|'+u.id+'|'+Math.round(u.hp); } }
  const has=(specHTML!=null)||!!model;
  if(has){ host.classList.add('on','simple'); host.classList.toggle('stkSpec', specHTML!=null);   // 관전 = 전용 .plbtn 그리드 스타일(높이는 126px 동일)
    if(host._stkSig!==sig){ host._stkSig=sig; if(specHTML!=null) host.innerHTML=specHTML; else renderCmdGrid(host, model); } }
  else if(host._stkSig!=null || host.classList.contains('on')){ host.classList.remove('on','simple','stkSpec'); host._stkSig=null; host.innerHTML=''; }
  // 전투(Main) 탭: 프로필 있을 때만 하단 시트 올림 → 무선택 시 하단 섹션 완전 비움
  if(G.tab==='Main'){ const show=has; if(host._stkShown!==show){ host._stkShown=show; document.body.classList.toggle('sheetOpen', show);
    if(typeof _syncSheetLift==='function'){ requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); } } } }
function strikeDrawFx(ctx,w2s,scale,S){ if(!S||!S.fx) return;   // 공용 FX 코어로 렌더(네모와 동일 비주얼). sz=픽셀 스케일(줌 연동)
  const sz=Math.max(0.8, Math.min(2.6, scale*8.5)); FX.drawShots(ctx, S.fx, w2s, sz);
  if(S._fxU && S._fxU.store){ const _W=STK_FX_SPAN, n2s=(x,y)=>w2s(x*_W, y*_W);
    const szU=Math.max(0.55, Math.min(2.2, (_W*scale)/390));   // 관리자 화면(폭 390px, sz 1.0) 기준으로 환산 → 크기 체감 동일
    FX.drawShots(ctx, S._fxU.store, n2s, szU); } }   // 유닛별 발사 이펙트
function strikeDrawUnits(ctx,w2s,scale,S){ if(!S) return;
  const _sMin=Math.min(S.cw||1,S.ch||1)*STK_MINZOOM/2600;   // 최소 줌에서의 렌더 배율
  const _hpK=Math.max(1, scale/(_sMin||1));   // HP바 배율 = 실제 렌더 배율 기준(줌 보간과 완전히 동기 — 확대/축소 중 울컥임 없음)
  const use3d=(window.M3D && M3D.ready && M3D.ready() && !(G.opt&&G.opt.model3d===false));   // 3D면 모델은 cvMarine에 렌더 → 2D 도트 생략(발밑 진영 링·HP바만)
  for(const side of ['me','ai']){ const ring=side==='me'?'#3aa0ff':'#ff4d5e';   // 파랑=아군 / 빨강=적군(맵 테두리색과 통일)
    for(const u of S[side].units){ const p=w2s(u.x,u.y), rad=Math.max(2.5,(u.size||12)*scale*0.5);
      if(!use3d){   // 3D 끔: 도트 + 진영 링 / 3D 켬: 모델 림(m.rim)이 진영색 담당
        ctx.save(); ctx.lineWidth=1.6; ctx.strokeStyle=ring; ctx.globalAlpha=0.92;
        ctx.beginPath(); ctx.ellipse(p.x, p.y+rad*0.4, rad*1.6, rad*0.72, 0, 0, 6.283); ctx.stroke(); ctx.restore();
        ctx.beginPath(); ctx.arc(p.x,p.y,rad,0,6.283); ctx.fillStyle=u.color||'#cfd6e2'; ctx.fill(); }
      const _mh=u.maxHp||0, _ms=u.maxSh||0, _k=_hpK;
      if((_mh&&u.hp<_mh)||(_ms&&(u.sh||0)<_ms)){ const bw=22*_k, hpr=Math.max(0,Math.min(1,u.hp/(_mh||1))), bx=p.x-bw/2; let by=p.y+5*_k;   // 네모 유닛 바와 동일 규격(쉴드 2 + HP 1, 검은 테두리)
        const _sh=_ms?2*_k:0, _tot=_sh+1*_k, _b=1*_k;
        ctx.fillStyle='rgba(4,8,12,.92)'; ctx.fillRect(bx-_b,by-_b,bw+_b*2,_tot+_b*2);   // 배경(테두리 포함)
        if(_ms){ const shr=Math.max(0,Math.min(1,(u.sh||0)/_ms)); ctx.fillStyle='#5ad1ff'; ctx.fillRect(bx,by,bw*shr,2*_k); by+=2*_k; }   // 🛡 쉴드
        ctx.fillStyle=hpBarColor(hpr); ctx.fillRect(bx,by,bw*hpr,1*_k); } } }   // HP = 가는 선
}

// ── 전장 렌더(#cvMain) ──
function strikeDrawMain(){ const S=STK; if(!S) return; const cvEl=document.getElementById('cvMain'); if(!cvEl) return;
  const r=setup('cvMain', STK_RES[strikeResMode()].cv); const ctx=r.ctx, W=r.W, H=r.H; GW=W; GH=H; S.cw=W; S.ch=H;   // 전장 2D만 배율(절전=0.6·고화질=네이티브)
  const scale=Math.min(W,H)/S.viewWorld;
  const w2s=(x,y)=>({x:(x-S.cam.x)*scale+W/2, y:(y-S.cam.y)*scale+H/2});
  strikeDrawGround(ctx,W,H,S,scale);
  strikeDrawScenery(ctx,w2s,scale,S,W,H);   // 코너 데코(바위·분화구·수풀·뼈) + 떠다니는 먼지
  const nodes=[S.me.base, S.me.sec, S.central, S.ai.sec, S.ai.base].map(o=>w2s(o.x,o.y));
  // 외곽 네온 글로우(채움 아래) → 내부 접합부는 채움에 가려지고 바깥 외곽선만 빛남
  strikeGlowUnderlay(ctx,w2s,scale,S,W,H,nodes);
  // 메인 정사각 플랫폼(길 아래) + 길(위로 연결) → 하나의 타일
  strikeDrawSpawnZone(ctx,w2s,scale,S,W,H,S.me.base.x,S.me.base.y,1750,1750,'#7fe0ff');
  strikeDrawSpawnZone(ctx,w2s,scale,S,W,H,S.ai.base.x,S.ai.base.y,1750,1750,'#ff9aa6');
  strikeDrawLane(ctx, nodes, scale, S, W, H);
  // 유닛 생성 패드: 메인신전 좌상/우하 — 정사각 플랫폼(±875) 안으로, 중앙 쪽으로 이동
  const D=360, CS=180, PS=520;   // D=대각오프셋, CS=중앙쪽 이동, PS=패드크기(D+CS+PS/2=800<875)
  strikeDrawSpawnPad(ctx,w2s,scale,S.me.base.x-D+CS,S.me.base.y-D-CS,PS); strikeDrawSpawnPad(ctx,w2s,scale,S.me.base.x+D+CS,S.me.base.y+D-CS,PS);   // me(좌하단): 오른쪽+위
  strikeDrawSpawnPad(ctx,w2s,scale,S.ai.base.x-D-CS,S.ai.base.y-D+CS,PS); strikeDrawSpawnPad(ctx,w2s,scale,S.ai.base.x+D-CS,S.ai.base.y+D+CS,PS);   // ai(우상단): 왼쪽+아래
  // 진격 화살표(맨 위)
  // strikeLaneArrows(ctx, nodes, scale, 2);   // 진격 화살표 제거(요청)
  // 중립 중앙 신전(금색) → 2차(진영색) → 메인(진영색, 큼). 뒤→앞 순서로 그림
  // 신전: 3D 모델 로드 시 사이드 링+라벨만(본체는 strikeSync3D가 M3D로), 미로드 시 2D 폴백
  const _tmpl=function(o,modelId,col,glow,wr,label,labelCol){
    const has3d=window.M3D && M3D.hasModel && M3D.hasModel(modelId) && !(G.opt&&G.opt.model3d===false);
    if(!has3d){ strikeDrawTemple(ctx,w2s,scale,o.x,o.y,col,glow,wr,{topCol:(modelId==='temple_neutral'?'#fff7da':undefined)}); return; }   // 라벨은 strikeDrawTempleHp 단일 출력(중복 제거)
    const p=w2s(o.x,o.y), rr=Math.max(9,wr*scale*0.58), dd=!!o.dead;
    ctx.save(); if(dd) ctx.globalAlpha=0.4;   // 죽은 신전: 접지/링도 흐리게
    // 접지(모바일 성능: 그라데이션·캐스트섀도 제거 → 솔리드 알파 타원 3겹)
    ctx.fillStyle='rgba(0,0,0,.26)'; ctx.beginPath(); ctx.ellipse(p.x,p.y+rr*0.1,rr*1.75,rr*0.82,0,0,6.283); ctx.fill();     // AO
    ctx.fillStyle='rgba(96,78,52,.4)'; ctx.beginPath(); ctx.ellipse(p.x,p.y,rr*1.22,rr*0.55,0,0,6.283); ctx.fill();           // 사막 돌기단
    ctx.fillStyle='rgba(122,100,68,.32)'; ctx.beginPath(); ctx.ellipse(p.x,p.y-rr*0.04,rr*0.92,rr*0.42,0,0,6.283); ctx.fill();
    if(!dd){ ctx.globalAlpha=.4; ctx.strokeStyle=glow; ctx.lineWidth=Math.max(1.2,2.4*scale);
      ctx.beginPath(); ctx.ellipse(p.x,p.y,rr*1.0,rr*0.46,0,0,6.283); ctx.stroke(); }   // 진영색 글로우 링(살아있을 때만)
    ctx.restore(); };
  _tmpl(S.central,'temple_neutral','#d9b34a','#ffd86a',40,'중립 신전','#ffe28a');
  _tmpl(S.me.sec,'temple_stone','#3a7bff','#7fe0ff',102,'2차 신전','#bfe0ff');
  _tmpl(S.ai.sec,'temple_stone','#ff3b54','#ff9aa6',102,'2차 신전','#ffc2c8');
  _tmpl(S.me.base,'temple_main','#3a7bff','#7fe0ff',210,'메인 신전','#bfe0ff');
  _tmpl(S.ai.base,'temple_main','#ff3b54','#ff9aa6',210,'메인 신전','#ffc2c8');
  strikeDrawTempleHp(ctx,w2s,scale,S);   // 신전 HP 바
  strikeDrawUnits(ctx,w2s,scale,S);   // 전투 유닛(소환·교전) 위에 표시
  strikeDrawFx(ctx,w2s,scale,S);   // 공격 트레이서/임팩트
  strikeDrawSelection(ctx,w2s,scale,S);   // 선택 표시 + 정보
  // 크기 비교 샘플 유닛 라벨(3D 모델은 cvMarine에 strikeSyncCmpUnits가 렌더)
  if(S.sizeCmp && S.cmpUnits){ ctx.save(); ctx.font='800 10px '+FONT_NUM; ctx.textAlign='center';
    for(const u of S.cmpUnits){ const p=w2s(u.x,u.y), nm=u.nm||((typeof U!=='undefined'&&U[u.id]&&U[u.id].name)||u.id);
      ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.78)'; ctx.strokeText(nm,p.x,p.y+22);
      ctx.fillStyle='#eef3fa'; ctx.fillText(nm,p.x,p.y+22); }
    ctx.restore(); }
}
// 메인 신전 주변 개활지(넓은 베이스 광장) — 부드럽게 퍼지는 다져진 사막 땅
// 사막 모랫길(레인) — 노드들을 잇는 폭 넓은 길 + 중앙 바퀴자국 점선
// 외곽 네온 글로우(채움 아래에 깔아 외곽선만 빛나게 — 길+플랫폼 겹침의 내부 접합부는 채움이 가림)
function strikeGlowUnderlay(ctx,w2s,scale,S,W,H,nodes){ ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  const base=Math.max(28,1580*scale), A=nodes[0], B=nodes[nodes.length-1];
  // 길: me 시안 → 중앙(밝게 만남) → ai 레드 그라데이션. (모바일: shadowBlur 제거 → 레이어 스트로크)
  const g=ctx.createLinearGradient(A.x,A.y,B.x,B.y);
  const CY='rgba(127,224,255,', RD='rgba(255,120,138,', WH='rgba(232,238,255,', clamp=v=>Math.max(0.001,Math.min(0.999,v));
  const bf=(S.terBlue!=null?S.terBlue:0.25), rf=(S.terRed!=null?S.terRed:0.75);   // 영역 경계(신전 파괴로 이동)
  g.addColorStop(0, CY+'.92)');
  if(bf<rf-0.02){ g.addColorStop(clamp(bf-0.03), CY+'.9)'); g.addColorStop(clamp(bf+0.03), WH+'.92)'); g.addColorStop(clamp(rf-0.03), WH+'.92)'); g.addColorStop(clamp(rf+0.03), RD+'.9)'); }   // 가운데 흰색(contested)
  else { const mid=(bf+rf)/2; g.addColorStop(clamp(mid-0.03), CY+'.9)'); g.addColorStop(clamp(mid), WH+'.95)'); g.addColorStop(clamp(mid+0.03), RD+'.9)'); }   // 경계에서 바로 만남
  g.addColorStop(1, RD+'.92)');
  const pathL=()=>{ ctx.beginPath(); ctx.moveTo(nodes[0].x,nodes[0].y); for(let i=1;i<nodes.length;i++) ctx.lineTo(nodes[i].x,nodes[i].y); };
  ctx.strokeStyle=g;
  ctx.globalAlpha=.28; ctx.lineWidth=base+Math.max(18,46*scale); pathL(); ctx.stroke();
  ctx.globalAlpha=.55; ctx.lineWidth=base+Math.max(11,28*scale); pathL(); ctx.stroke();
  ctx.globalAlpha=.92; ctx.lineWidth=base+Math.max(5,13*scale); pathL(); ctx.stroke(); ctx.globalAlpha=1;
  // 플랫폼: 진영색 글로우(끝 색과 일치) — 레이어 스트로크
  const ps=1750*scale, rad=ps*0.07, gw=Math.max(8,22*scale);
  const plat=(wx,wy,col,col2)=>{ const c=w2s(wx,wy), x=c.x-ps/2, y=c.y-ps/2;
    ctx.strokeStyle=col2; ctx.lineWidth=gw+Math.max(8,20*scale); _strkRR(ctx,x,y,ps,ps,rad); ctx.stroke();
    ctx.strokeStyle=col; ctx.lineWidth=gw; _strkRR(ctx,x,y,ps,ps,rad); ctx.stroke(); };
  plat(S.me.base.x,S.me.base.y,'rgba(127,224,255,.9)','rgba(127,224,255,.32)'); plat(S.ai.base.x,S.ai.base.y,'rgba(255,130,145,.9)','rgba(255,130,145,.32)');
  ctx.restore(); }
// 신전 잇는 포장 길 — 솔리드 포장 + 양옆만 은은한 외곽(끝은 메인 플랫폼이 딱 덮음)
// 포장(석판) 타일을 화면에 몇 px 로 깔 것인가 — **단일 소스**(레인·소환 구역이 같이 쓴다).
// ⚠ 값을 키우면 돌이 커 보이고 반복 주기가 짧아진다. 460 = 바깥 지형 타일과 같은 크기라
//    두 지면의 「알갱이 크기」가 맞는다(2026-08-30 · 300 일 때 판석이 자갈처럼 잘게 보였다).
const STK_PAVE_TILE=460;
function strikeDrawLane(ctx, pts, scale, S, W, H){ if(!pts||pts.length<2) return; ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  const path=()=>{ ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); };
  const img=STRIKE_PAVE; let pat=strikePattern(ctx,img);
  if(pat&&pat.setTransform&&S){ const tilePx=Math.max(8,STK_PAVE_TILE*scale), s=tilePx/img.naturalWidth, ox=(0-S.cam.x)*scale+W/2, oy=(0-S.cam.y)*scale+H/2; pat.setTransform(new DOMMatrix([s,0,0,s,ox,oy])); }
  const stroke=pat||'rgba(150,140,120,.5)', base=Math.max(28,1580*scale);
  // ⛔ 어두운 테두리(seam)를 없앴다(2026-08-30 사용자). 레인 끝이 lineCap:'round' 라 굵기 절반짜리
  //    **큰 원호**가 되는데, 그 위를 소환 구역(같은 포장)이 덮으면서 **석판 한가운데에 검은 곡선**만 남았다.
  //    포장(석판)과 지형(마른 흙)은 색·무늬가 충분히 달라 테두리 없이도 경계가 읽힌다.
  path(); ctx.strokeStyle=stroke; ctx.lineWidth=base; ctx.stroke();                             // 포장 코어
  path(); ctx.globalAlpha=0.16; ctx.strokeStyle='rgba(18,26,34,1)'; ctx.lineWidth=base; ctx.stroke(); ctx.globalAlpha=1;  // 톤 통일
  ctx.restore(); }
// 바닥 진격 화살표 — 넓게 벌어진 V, 띄엄띄엄, 매우 은은
function strikeLaneArrows(ctx, pts, scale, centerIdx){ const gap=Math.max(48,500*scale), size=Math.max(6,80*scale);
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  for(let si=0; si<pts.length-1; si++){ const a=pts[si], b=pts[si+1]; let dx=b.x-a.x, dy=b.y-a.y; const len=Math.hypot(dx,dy); if(len<1) continue;
    const toward = si<centerIdx, mdx=(toward?dx:-dx)/len, mdy=(toward?dy:-dy)/len, ang=Math.atan2(mdy,mdx);
    const n=Math.floor(len/gap);
    for(let k=1;k<=n;k++){ const t=k*gap/len; if(t>0.92) break; const x=a.x+dx*t, y=a.y+dy*t;
      ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.globalAlpha=.15;
      ctx.strokeStyle='rgba(180,224,255,.85)'; ctx.lineWidth=Math.max(1.2,size*0.2);
      ctx.beginPath(); ctx.moveTo(-size*0.4,-size*0.95); ctx.lineTo(size*0.45,0); ctx.lineTo(-size*0.4,size*0.95); ctx.stroke();   // 넓게 벌어진 V
      ctx.restore(); } }
  ctx.restore(); }
// 지상유닛 보행 가능 영역 = 프로토스 타일(레인 + 메인 소환 정사각). 향후 이동 단계에서 지상유닛 가둠(공중은 예외)
// 둥근 사각 path 헬퍼
function _strkRR(ctx,x,y,w,h,r){ if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); return; }
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
// 메인 신전 주변 — 프로토스 타일 사각 소환 구역(넓게). 원형 개활지 대체
function strikeDrawSpawnZone(ctx,w2s,scale,S,W,H,wx,wy,wWorld,hWorld,glow){
  const c=w2s(wx,wy), pw=wWorld*scale, ph=hWorld*scale, x=c.x-pw/2, y=c.y-ph/2, rad=Math.min(pw,ph)*0.07;
  ctx.save();
  _strkRR(ctx,x-3,y-2,pw+6,ph+8,rad); ctx.fillStyle='rgba(0,0,0,.28)'; ctx.fill();   // 접지 그림자
  _strkRR(ctx,x,y,pw,ph,rad); ctx.save(); ctx.clip();
  const img=STRIKE_PAVE, pat=strikePattern(ctx,img); if(pat){
    if(pat.setTransform){ const tilePx=Math.max(8,STK_PAVE_TILE*scale), s=tilePx/img.naturalWidth, ox=(0-S.cam.x)*scale+W/2, oy=(0-S.cam.y)*scale+H/2; pat.setTransform(new DOMMatrix([s,0,0,s,ox,oy])); }
    ctx.fillStyle=pat; } else ctx.fillStyle='#3a4a52';
  ctx.fillRect(x,y,pw,ph);
  ctx.fillStyle='rgba(16,24,30,.26)'; ctx.fillRect(x,y,pw,ph);   // 톤 통일
  // 소환 격자(은은)
  ctx.strokeStyle='rgba(180,220,255,.08)'; ctx.lineWidth=1; const gx=Math.max(40,260*scale);
  for(let ix=x+gx; ix<x+pw; ix+=gx){ ctx.beginPath(); ctx.moveTo(ix,y); ctx.lineTo(ix,y+ph); ctx.stroke(); }
  for(let iy=y+gx; iy<y+ph; iy+=gx){ ctx.beginPath(); ctx.moveTo(x,iy); ctx.lineTo(x+pw,iy); ctx.stroke(); }
  ctx.restore();   // unclip
  // ⛔ 여기도 어두운 seam 을 뺐다(2026-08-30 · 위 strikeDrawLane 과 같은 이유) — 소환 구역은 레인과
  //    **같은 석판**이라 경계를 그으면 포장 한가운데에 사각 테두리만 남는다. 네온 언더레이가 자리를 알려 준다.
  ctx.restore(); }
// 유닛 생성 패드 — 메인신전 왼쪽위/오른쪽아래. 바닥 타일을 살짝만 어둡게(자연스럽게)
function strikeDrawSpawnPad(ctx,w2s,scale,wx,wy,sw){ const c=w2s(wx,wy), s=Math.max(10,sw*scale), x=c.x-s/2, y=c.y-s/2, rad=s*0.12;
  ctx.save(); _strkRR(ctx,x,y,s,s,rad); ctx.fillStyle='rgba(0,0,0,.2)'; ctx.fill();
  ctx.strokeStyle='rgba(150,185,225,.15)'; ctx.lineWidth=Math.max(1,1.6*scale); ctx.stroke(); ctx.restore(); }
// 신전(메인/2차/중립 공용) — 계단식 마름모 3단. worldR로 크기, opt.label 화면 라벨. (추후 3D 모델 교체)
function strikeDrawTemple(ctx,w2s,scale,wx,wy,col,glow,worldR,opt){ opt=opt||{}; const p=w2s(wx,wy), rr=Math.max(opt.minR||16, worldR*scale);
  ctx.save();
  ctx.fillStyle='rgba(20,26,34,.92)'; ctx.beginPath(); ctx.ellipse(p.x,p.y+rr*0.12,rr*1.15,rr*0.72,0,0,6.283); ctx.fill();   // 기단
  ctx.shadowColor=glow; ctx.shadowBlur=20;
  for(let i=0;i<3;i++){ const k=rr*(1-i*0.26), yo=-i*rr*0.34;   // 신전 본체(3단)
    ctx.fillStyle=i===2?(opt.topCol||'#fff'):col; ctx.globalAlpha=i===2?0.95:(0.78+i*0.08);
    ctx.beginPath(); ctx.moveTo(p.x,p.y-k+yo); ctx.lineTo(p.x+k,p.y+yo); ctx.lineTo(p.x,p.y+k*0.85+yo); ctx.lineTo(p.x-k,p.y+yo); ctx.closePath(); ctx.fill(); }
  ctx.globalAlpha=1; ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,.45)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(p.x,p.y-rr); ctx.lineTo(p.x+rr,p.y); ctx.lineTo(p.x,p.y+rr*0.85); ctx.lineTo(p.x-rr,p.y); ctx.closePath(); ctx.stroke();
  ctx.restore();
  if(opt.label){ ctx.save(); ctx.font='800 11px '+FONT_NUM; ctx.textAlign='center';
    ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.72)'; ctx.strokeText(opt.label,p.x,p.y+rr+14);
    ctx.fillStyle=opt.labelCol||glow; ctx.fillText(opt.label,p.x,p.y+rr+14); ctx.restore(); }
  return p; }

// ── HUD(nemo 상단 재사용): 크레딧=내 골드, 에너지=내 광산, 인구=내 유닛, 시계=출격 ──
function strikeHud(){ const S=STK; if(!S) return;
  // 🏗 건설지도 **같은 HUD**를 쓴다(전용 자원 바 없음). 인구 칸만 그 화면의 뜻으로 바꾼다 —
  //    전장에서는 '내 유닛 수', 건설지에서는 '보급(sup/supCap)'. 나머지 두 칸·시계·☰ 는 그대로 같다.
  const bld=(G.tab==='Build' && G.tech);
  hudSetRes(Math.floor(S.me.gold), S.me.mines,                           // 크레딧=골드 · 에너지=광산
    bld?G.tech.sup:S.me.units.length, bld?G.tech.supCap:'∞');
  hudSetTime(S.cycleT); }                                                // 좌상단 시계 = 출격까지(nemo와 같은 mm:ss)

// ── 탭(nemo 탭+하단 .bp 재사용, 직스 전용 동작) ──
// ══ 오토배틀 하단 탭 ══ 네모와 같은 2층 구조(STK_TREE + 공용 페인터).
//   전투는 탭이 아니라 **무선택 기본 화면**이다 — ‹ 가 여기로 돌아온다.
//   최상위: [건설지][특수무기][관전]
// 화면 전환만 하는 알맹이 — 시트(보급/관전) 처리는 부르는 쪽이 한다.
function _stkShowScreen(id, el){ const S=STK; if(!S) return;
  G.tab=id; S.userCam=false; if(id!=='Players') S.specView=null;   // 관전 종료
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  (el||document.querySelector('.tab[data-tab="'+id+'"]'))?.classList.add('on');
  const _bld=(id==='Build');   // 🏗 건설지 = 관리자 건설 화면(#vBuild + G.tech)을 그대로 사용
  document.body.classList.toggle('cstMode', _bld);
  document.body.classList.toggle('stkCst', _bld);   // 오토배틀 건설지 = 상단 HUD 유지(관리자 건설과 갈리는 지점)
  document.querySelectorAll('.gview').forEach(v=>v.classList.toggle('on', v.id===(_bld?'vBuild':'vMain')));   // 직스 전장 캔버스 ↔ 건설 맵
  document.querySelectorAll('.bp').forEach(p=>p.classList.toggle('on', p.id==='bp'+id));        // 하단 패널은 nemo .bp 재사용
  if(_bld){ techSyncWallet(); if(typeof techUIEnsure==='function') techUIEnsure();   // 관리자와 동일한 맵·일꾼·프로필 렌더
    document.body.classList.add('sheetOpen'); if(typeof _syncSheetLift==='function'){ requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); }
    return; }
  if(typeof techHidePreview==='function') techHidePreview(); if(window.M3D&&M3D.techMap3DStop) M3D.techMap3DStop();   // 건설지 이탈 = 프리뷰·라이브3D 정지
  const zl=document.getElementById('zoneLabel');
  if(zl){ const _m={Main:['⚔️','전장'],Upgrade:['💥','특수무기'],Players:['👁','관전']}[id];
    zl.innerHTML=_m? pIco(_m[0])+'<span class="zlTx">'+_m[1]+'</span>' : ''; }
  // 전투(Main)=선택 있을 때만 하단 프로필 시트 · 그 외 탭=패널 상시 표시
  if(id==='Main'){ const uc=document.getElementById('unitCmd'); if(uc) uc._stkShown=undefined; strikeRenderSelInfo(); }
  else { document.body.classList.add('sheetOpen'); if(typeof _syncSheetLift==='function'){ requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); } } }
// 🏗 건설지 > 건설 — 건설 화면 + **일꾼 자동 지정**(빈 화면으로 들어가지 않게).
//   지정 경로는 techSubSelectOne 과 같다(selU + 시트 열기 + techUIRender) — 새로 만들지 말 것.
function stkGoBuild(){ const S=STK; if(!S) return;
  if(S.supSheet) strikeToggleSupply(false);
  if(S.specSheet) strikeToggleSpec(false);
  if(G.tab!=='Build') _stkShowScreen('Build');
  stkPickWorker();
  if(typeof techPanelRender==='function') techPanelRender(); }
// 맵의 일꾼을 골라 지정한다 — 이미 뭔가 지정돼 있으면 건드리지 않는다(사용자가 고른 것을 덮지 않는다)
function stkPickWorker(){ if(!G.tech) return false;
  const sh=G.tech.sheet||(G.tech.sheet={open:false,sec:null});
  if(G.tech.sel!=null || (G.tech.selU&&G.tech.selU.length)){ sh.open=true; sh.sec='ent'; return true; }
  const wk=(G.tech.ents||[]).find(e=>e.type==='worker'); if(!wk) return false;
  G.tech.sel=null; G.tech.selU=[wk.eid]; G.tech.selRes=null;
  sh.open=true; sh.sec='ent';
  const body=document.getElementById('btSheetBody'); if(body) body._cgPage=0;
  return true; }
// 🏗 건설지 > 강화 — 화면은 건설지 그대로, 하단만 강화 시트(광산·공격력·체력)
function stkGoUpg(){ const S=STK; if(!S) return;
  if(S.specSheet) strikeToggleSpec(false);
  if(G.tab!=='Build') _stkShowScreen('Build');
  if(!S.supSheet) strikeToggleSupply(true);
  strikeSupPage(null);
  if(typeof techPanelRender==='function') techPanelRender(); }
// 💥 특수무기 > 구입/사용 — 화면은 전장을 유지하고 하단 시트만 바꾼다
function stkGoWpn(page){ const S=STK; if(!S) return;
  if(S.specSheet) strikeToggleSpec(false);
  if(G.tab!=='Main') _stkShowScreen('Main');
  strikeClearSel();                       // 무기 시트는 지정 프로필과 자리를 다툰다 — 비우고 연다
  if(!S.supSheet) strikeToggleSupply(true);
  strikeSupPage(page==='use'?'wpnUse':'wpnBuy');
  document.body.classList.add('sheetOpen');
  if(typeof strikeRenderSelInfo==='function') strikeRenderSelInfo(); }
// ⚔ 전투 = 무선택 기본 화면. ‹ 가 여기로 온다(구역·시트·지정을 전부 걷는다)
function strikeRestHome(){ const S=STK; if(!S) return;
  if(S.supSheet) strikeToggleSupply(false);
  if(S.specSheet) strikeToggleSpec(false);
  strikeClearSel();
  if(G.tech){ G.tech.sel=null; G.tech.selU=[]; G.tech.selRes=null;
    if(G.tech.sheet){ G.tech.sheet.open=false; G.tech.sheet.sec=null; } }
  _stkShowScreen('Main');
  _setBottomTab(''); _gtabDrill=''; gtabPaint(); }
function strikeSwitchTab(id,el){ const S=STK; if(!S) return;
  if(id==='Players'){   // 👁 관전 = 하위가 없다 — 옛 동작(시트 토글) 그대로
    if(S.specSheet){ strikeClearSel(); }
    if(G.tab!=='Main') _stkShowScreen('Main');
    strikeToggleSpec();
    _setBottomTab(S.specSheet?'Players':''); _gtabDrill=''; gtabPaint();
    if(typeof playSfx==='function') playSfx('ui_tab'); return; }
  if(id==='Main'){ strikeRestHome(); if(typeof playSfx==='function') playSfx('ui_tab'); return; }
  if(id==='Build' || id==='Upgrade'){
    // 이미 그 구역에 내려가 있는데 또 눌렀다 = 하단 시트 접기(네모 재탭과 같은 뜻)
    if(_gtabDrill===id){ const open=document.body.classList.toggle('sheetOpen');
      if(typeof _syncSheetLift==='function'){ requestAnimationFrame(_syncSheetLift); setTimeout(_syncSheetLift,220); }
      if(typeof playSfx==='function') playSfx('ui_open'); return; }
    _setBottomTab(id); gtabDrill(id);   // ← 첫 하위(건설 / 구입)로 되돌린다
    if(typeof playSfx==='function') playSfx('ui_tab'); return; }
  _stkShowScreen(id, el); if(typeof playSfx==='function') playSfx('ui_tab'); }

// ── 보급(내 진영) — 화면 시설 탭 → 하단 패널 ──
function strikeBuyMine(){ const S=STK; if(!S) return; const me=S.me;
  if((me.mines||0)>=STK_MINE_CAP){ if(typeof playSfx==='function') playSfx('ui_denied'); return; }
  if(me.gold<me.mineCost){ if(typeof playSfx==='function') playSfx('ui_denied'); return; }
  me.gold-=me.mineCost; me.mines++; strikeMineBuy(me);
  if(me.mines>=STK_MINE_CAP && !me._extMsg){ me._extMsg=true; strikeToast('🏗 건설지 확장 — 아래 구역이 열렸습니다');
    if(G.tech && typeof techUIRender==='function') techUIRender(); }
  if(typeof playSfx==='function') playSfx('ui_confirm'); }
function strikeUpg(kind){ const S=STK; if(!S) return; const me=S.me;   // 유닛 공격/체력 강화
  const lv=(kind==='atk'?me.atkLv:me.hpLv), cost=strikeUpCost(kind,lv);
  if(lv>=10){ if(typeof playSfx==='function') playSfx('ui_denied'); return; }
  if(me.gold<cost){ if(typeof playSfx==='function') playSfx('ui_denied'); return; }
  me.gold-=cost; if(kind==='atk') me.atkLv++; else { me.hpLv++; strikeApplyHpUpg(me); }
  if(typeof playSfx==='function') playSfx('ui_confirm'); }
// 🛒 구입 — 종류(k)를 받는다. 재고 상한·골드 판정은 표(STK_WEAPONS)에서만 나온다.
function strikeBuyWpn(k){ const S=STK, w=STK_WPN(k); if(!S||!w) return false; const me=S.me;
  if(!me.wpn) me.wpn={};
  if((me.wpn[k]||0)>=w.cap){ if(typeof playSfx==='function') playSfx('ui_denied'); return false; }
  if(me.gold<w.cost){ if(typeof playSfx==='function') playSfx('ui_denied'); return false; }
  me.gold-=w.cost; me.wpn[k]=(me.wpn[k]||0)+1;
  if(typeof playSfx==='function') playSfx('ui_confirm');
  if(typeof strikeRenderSelInfo==='function') strikeRenderSelInfo();
  return true; }
// 가장 밀집한 적 무리의 중심 — 폭탄·궤도 포격이 같이 쓴다
function _stkDensest(alive, r){ let best=alive[0], bestN=-1, r2=r*r;
  for(const a of alive){ let n=0; for(const b of alive){ const dx=a.x-b.x, dy=a.y-b.y; if(dx*dx+dy*dy<r2) n++; } if(n>bestN){ bestN=n; best=a; } }
  return best; }
function _stkBlast(cx, cy, r, dmg, col, size){ const S=STK, alive=S.ai.units.filter(u=>!u.dead);
  const r2=r*r; let hit=0;
  for(const e of alive){ const dx=e.x-cx, dy=e.y-cy, d2=dx*dx+dy*dy;
    if(d2<=r2){ e.hp-=dmg*(1-Math.sqrt(d2)/r*0.5); if(e.hp<=0) e.dead=true; hit++; } }   // 중심일수록 큰 피해
  if(!S.fx||!S.fx.shots){ S.fx=FX.store(); S.fx.hitK=STK_HIT_K; }
  FX.death(S.fx, cx, cy, {unitSize:size, color:col});   // 연출이 요점이라 파편 수는 기본값 유지
  return hit; }
// 💥 사용 — 표에 있는 종류만 받는다. 효과는 여기 한 곳에서 갈린다.
function strikeUseWpn(k){ const S=STK, w=STK_WPN(k); if(!S||!w) return false;
  const me=S.me; if(!(me.wpn&&me.wpn[k]>0)) return false;
  const alive=S.ai.units.filter(u=>!u.dead);
  if(k==='heal'){
    const mine=me.units.filter(u=>!u.dead);
    if(!mine.length){ strikeToast('회복할 아군이 없습니다'); return false; }
    me.wpn[k]--; let n=0;
    for(const u of mine){ const mx=u.maxHp||u.hp; if(u.hp<mx){ u.hp=Math.min(mx, u.hp+mx*STK_HEAL_F); n++; } }
    if(typeof playSfx==='function') playSfx('ui_confirm'); strikeToast('✚ 재생 필드 — '+n+'기 회복');
  } else {
    if(!alive.length){ strikeToast('사용할 적이 없습니다'); return false; }
    me.wpn[k]--;
    if(k==='emp'){
      // ⚠ 새 상태이상 필드를 만들지 않는다 — 소환 직후 대기에 쓰는 u.wait 를 그대로 쓴다
      //   (strikeStepUnits 가 wait>0 이면 이동·공격을 통째로 건너뛴다).
      for(const e of alive) e.wait=Math.max(e.wait||0, STK_EMP_DUR);
      if(typeof playSfx==='function') playSfx('ui_open'); strikeToast('⚡ EMP — 적 '+alive.length+'기 정지');
    } else {
      const big=(k==='orbit');
      const r=big?STK_ORBIT_R:STK_BOMB_R, dmg=big?STK_ORBIT_DMG:STK_BOMB_DMG;
      const c=_stkDensest(alive, r);
      const hit=_stkBlast(c.x, c.y, r, dmg, big?'#ffd24a':'#ff9a4c', big?86:60);
      if(typeof playSfx==='function') playSfx('boss_hit');
      strikeToast(w.ico+' '+w.name+' — '+hit+'기 타격');
    }
  }
  if(typeof strikeRenderSelInfo==='function') strikeRenderSelInfo();
  return true; }
// 종족별 빌드 메뉴(그 종족 소환 유닛 = 지을 수 있는 생산 건물). STK_UNITS에서 이름·아이콘·비용 도출
function strikeBuildable(race){ const r=race||(STK&&STK.me&&STK.me.race)||'terran';
  return (STK_BUILDINGS[r]||STK_BUILDINGS.terran).map(b=>({key:b.key, name:b.name, ico:b.ico, cost:b.cost, fp:b.fp, produces:b.produces})); }   // 관전 데모 빌드용(fp만 사용)
// (제거) strikeProdLabel·strikeBuildMenu·STK.buildMenu 캐시 — 구 오토배틀 전용 건설. 건설지는 관리자 건설 시스템(G.tech)으로 통합됨
// (제거) _strikeBuildModel~strikeRenderBuild — 구 오토배틀 전용 건설 구현. 건설지는 관리자 건설 시스템(G.tech)으로 통합됨
// 관전: nemo .plbtn/.plGrid(4×2) 재사용. 팀 1-4(아군 파랑) vs 5-8(적군 빨강). 빈 자리=잠금
function strikePColor(slot){ return (typeof PLAYER_VIEW_COLORS!=='undefined')?PLAYER_VIEW_COLORS[(slot-1)%PLAYER_VIEW_COLORS.length]:'#7fd0ff'; }
function strikeSpecBuildCells(slot){ const S=STK; if(!S.specBuilds) S.specBuilds={};   // 데모 건물(추후 실제 멀티 데이터로 교체) — 자유 배치(월드)
  if(!S.specBuilds[slot]){ const b=S.build, cells=[], n=3+(Math.random()*4|0);
    const menu=strikeBuildable(STK_RACE_ORDER[(slot-1)%STK_RACE_ORDER.length]);   // 슬롯별 종족 데모 빌드
    for(let k=0;k<n;k++){ const t=menu[Math.random()*menu.length|0], fp=strikeFootprint(t); let cx,cy,tries=0,ok=false;
      do{ cx=fp.w/2+Math.random()*(b.W-fp.w); cy=fp.h/2+Math.random()*(b.H-fp.h); ok=true; for(const c of cells){ if(Math.abs(cx-c.x)<(fp.w+c.w)/2 && Math.abs(cy-c.y)<(fp.h+c.h)/2){ ok=false; break; } } }while(!ok&&++tries<20);
      if(ok) cells.push({type:t,built:1,x:cx,y:cy,w:fp.w,h:fp.h}); }
    S.specBuilds[slot]=cells; }
  return S.specBuilds[slot]; }
// 내 건설(관전 1P) = 관리자 건설 시스템(G.tech)의 건물을 관전 보드 좌표로 변환
function strikeMyBuildCells(){ const S=STK, b=S&&S.build; if(!b||!G.tech||!G.tech.ents) return [];
  const race=G.tech.race, cw=_techCW(), ch=_techCH(), rows=_techRows(), out=[];
  const cell=Math.min(b.W/techCols(), b.H/rows);   // 칸을 정사각으로(발자국 비율 유지) — 그리드 전체가 보드 안에 들어오게
  for(const e of G.tech.ents){ if(e.type!=='bldg') continue; const bd=techGetBldg(race,e.bk)||{}, f=_techFoot(race,e.bk)||{w:2,h:2};
    out.push({ type:{key:e.bk, name:bd.name||'', ico:bd.ico||'🏢'}, built:(e.bt>0?0:1),
      x:((e.x-TECH_GRID.x0)/cw)*cell, y:((e.y-techY0())/ch)*cell, w:f.w*cell, h:f.h*cell }); }
  return out; }
function strikeSpecView(slot){ const S=STK; const isMe=(slot===(G.myPlayer||1)); const cells=isMe?strikeMyBuildCells():strikeSpecBuildCells(slot);
  return {cells:cells, col:strikePColor(slot), label:(isMe?'내 ':(((G.playerNames&&G.playerNames[slot])||(slot+'P'))+' '))+'건설'}; }
// (제거) strikeSpecSelect/strikeRenderSpec — 구 Players-탭 .plbtn 렌더러. 관전이 하단 시트(_stkSpecGridHTML)로 이동해 진입점 없어짐.
function strikeToast(msg){ if(typeof lobbyToast==='function') lobbyToast(msg); else if(typeof toast==='function') toast(msg); }

// ── 입력(전장 패닝/핀치줌/선택) ──
function strikeViewRect(){ return document.getElementById('vMain').getBoundingClientRect(); }
function strikeScreenToWorld(px,py){ const S=STK, W=S.cw||1, H=S.ch||1, scale=Math.min(W,H)/S.viewWorld;
  return { x:S.cam.x+(px-W/2)/scale, y:S.cam.y+(py-H/2)/scale }; }
function strikeOnDown(e){ const S=STK; if(!S) return; const r=strikeViewRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  _stkPtrs.set(e.pointerId,{x:px,y:py});
  const cam=S.cam, zoom=S.zoom;
  if(_stkPtrs.size>=2){ const p=[..._stkPtrs.values()], cx=(p[0].x+p[1].x)/2, cy=(p[0].y+p[1].y)/2;   // 두 손가락 = 줌+팬
    _stkPinch={ d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1, zoom:zoom, cx:cx, cy:cy, camx:cam.x, camy:cam.y }; _stkDrag=null; }
  else { _stkDrag={ sx:px, sy:py, moved:false, camx:cam.x, camy:cam.y }; } }   // 한 손가락 = 드래그 팬 / 탭 선택
function strikeOnMove(e){ const S=STK; if(!S) return; const r=strikeViewRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  if(_stkPtrs.has(e.pointerId)) _stkPtrs.set(e.pointerId,{x:px,y:py});
  if(_stkPinch && _stkPtrs.size>=2){ const p=[..._stkPtrs.values()], d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y), z=_stkPinch.zoom*d/_stkPinch.d;
    const cx=(p[0].x+p[1].x)/2, cy=(p[0].y+p[1].y)/2, dcx=cx-_stkPinch.cx, dcy=cy-_stkPinch.cy;   // 두 손가락 중심 이동 = 팬
    { S.zoom=Math.min(STK_MAXZOOM, Math.max(STK_MINZOOM, z)); const W=S.cw||1,H=S.ch||1,scale=Math.min(W,H)/S.viewWorld; S.cam.x=_stkPinch.camx-dcx/scale; S.cam.y=_stkPinch.camy-dcy/scale; S.userCam=true; S.lastCam=S.t; strikeClampCam(); } return; }
  if(_stkDrag){ const dx=px-_stkDrag.sx, dy=py-_stkDrag.sy; if(Math.abs(dx)+Math.abs(dy)>6) _stkDrag.moved=true;
    if(_stkDrag.moved){   // 한 손가락 드래그 = 화면 팬(전장/건설 공통)
      { const W=S.cw||1,H=S.ch||1,scale=Math.min(W,H)/S.viewWorld; S.cam.x=_stkDrag.camx-dx/scale; S.cam.y=_stkDrag.camy-dy/scale; S.userCam=true; S.lastCam=S.t; strikeClampCam(); } } } }
function strikeOnUp(e){ const S=STK; if(!S) return; if(e) _stkPtrs.delete(e.pointerId);
  if(_stkPtrs.size<2) _stkPinch=null;
  if(_stkDrag && !_stkDrag.moved){ const r=strikeViewRect();   // 전장 탭(이동 없음)=단일 선택
    const px=(e&&e.clientX!=null?e.clientX:r.left+r.width/2)-r.left, py=(e&&e.clientY!=null?e.clientY:r.top+r.height/2)-r.top;
    const w=strikeScreenToWorld(px,py); strikeSelectAt(w.x,w.y); }
  _stkDrag=null; }
function strikeClearSel(){ const S=STK; S.selAllies=[]; S.selEnemy=null; S.selTemple=null; }
function strikeTempleTick(dt){ const S=STK; if(!S) return;   // 파괴 경과 시간 누적 + 파괴된 신전 지정 해제
  for(const t of strikeTemples()){ const o=t[0]; if(!o||!o.dead) continue;
    o.deadT=(o.deadT||0)+dt;
    if(S.selTemple===o){ S.selTemple=null; S.selTempleName=null; } }   // 파괴되면 지정 불가(지정 중이었으면 즉시 해제)
}
function strikeTemples(){ const S=STK; return [[S.me.base,'메인 신전'],[S.ai.base,'메인 신전'],[S.me.sec,'2차 신전'],[S.ai.sec,'2차 신전'],[S.central,'중립 신전']]; }   // 진영은 색으로만 구분(텍스트 표기 없음)
function strikeSelectAt(wx,wy){ const S=STK; strikeClearSel();
  let bu=null,bud=1e9; for(const u of S.me.units.concat(S.ai.units)){ if(u.dead) continue; const d=(u.x-wx)**2+(u.y-wy)**2; if(d<bud){bud=d;bu=u;} }
  let bt=null,btd=1e9,btn=''; for(const t of strikeTemples()){ const o=t[0]; if(!o||o.dead) continue;   // 신전 = 실제 점유 사각형(4×4 / 2×2) 안에서만 선택
    const h=strikeTempleHalf(o)*1.05; if(Math.abs(wx-o.x)>h || Math.abs(wy-o.y)>h) continue;
    const d=(o.x-wx)**2+(o.y-wy)**2; if(d<btd){ btd=d; bt=o; btn=t[1]; } }
  const uOk=bu&&bud<10000, tOk=!!bt;   // 유닛 ~100 반경 / 신전 = 점유 사각형 내부에서만
  if(uOk && (!tOk || bud<btd)){ if(bu.side==='me') S.selAllies=[bu.uid]; else S.selEnemy=bu; }   // 아군=다중가능(여기선 1) / 적군=최대 1
  else if(tOk){ S.selTemple=bt; S.selTempleName=btn; }
  // 업그레이드 시트가 올라와 있으면 화면(시트 바깥) 탭으로 내린다.
  //   대상을 골랐으면 그 프로필이 뜨고, 빈 곳을 눌렀으면 아무것도 남지 않는다.
  if(S.supSheet) strikeToggleSupply(false);
  strikeRenderSelInfo(); }
function strikeWheel(e){ const S=STK; if(!S) return; if(e.cancelable) e.preventDefault();
  { S.zoom=Math.min(STK_MAXZOOM, Math.max(STK_MINZOOM, S.zoom*(e.deltaY>0?0.9:1.1))); strikeClampCam(); } }

// ════════════════════════════════════════════════════════════════
// 🎆 이펙트 테스트베드(관리자 Unit 탭) — 빈 땅 + 3D 유닛, 공격·이동·죽음 무한 반복.
//   공용 FX 코어 사용 → 여기서 확정한 크기/느낌이 전 유즈맵에 동일 반영.
//   맵/줌 슬라이더가 3D 모델 크기와 이펙트 크기를 함께 스케일 → "작은맵=작게 / 확대=크게" 일관 시연.
// ════════════════════════════════════════════════════════════════
// 이펙트랩 로스터도 공용 RACE_ROSTER에서 생성(id/gm 모두 key) — 메인·건설과 동일 유닛·이름·순서로 통일
const FXLAB_ROSTER=(function(){ const o={}; const src=(typeof RACE_ROSTER!=='undefined')?RACE_ROSTER:{}; for(const r in src){ o[r]=src[r].map(u=>({n:u.n, id:u.key, gm:u.key})); } return o; })();
const FXLAB_RACE_ORDER=['union','swarm','aetherial','feral','colossus'];
const FXLAB_RACE_KO={union:'🛡 유니온',swarm:'🦎 스웜',aetherial:'🔮 에테리얼',feral:'🐺 페럴',colossus:'🗿 콜로서스'};
const FXLAB={ store:null, attId:'marine', attGm:null, scale:1, mode:'attack', phase:'alive', t:0, cd:0, mv:1, ti:0, att:null, dummy:null, bldg:null, air:null };
let _fxLabAttSeq=0;
const FXLAB_AA=new Set(['marine','ghost','goliath','dragoon','archon','hydra']);   // 공중 공격 가능 유닛(나머지는 지상만)
// 비전투(공격 안 함) = U.dmg===0 유닛에서 자동 생성 + 예외(메두사=시전형 퀸, U.dmg>0이나 랩 기본공격 없음). 손 목록 대신 공용 U에서 유도 → 드리프트 제거
const FXLAB_NOATK=(function(){ const s=new Set(['medusa']); if(typeof U!=='undefined') for(const k in U){ if(U[k] && (U[k].dmg||0)===0 && !(U[k].airDmg>0)) s.add(k); } return s; })();   // ⚠ airDmg만 있는 대공 전용(대공 투석수·하늘 사냥수·플랙 배터리·아크 라이트)은 '무공격'이 아니다 — 여기 걸리면 아무것도 못 때린다
const FXLAB_SWITCH_DELAY=0.35;   // 발사 후 방금 쏜 대상을 잠깐 더 바라본 뒤 다음 타겟으로 전환(허공 발사 방지)
const FXLAB_AIR=new Set(['skyguard','skydancer','overlord','observer','pelican','seraph','hellfire','dreadnought','kronos','archangel','falcon','stinger','venom','medusa','wyvern','aegis','behemoth',
  'hawkeye','windcarrier','wyvernrider','skytalon','stormroc',            // 🐺 페럴 공중 5기(RACES.md §2)
  'spotterdrone','supplylifter','arclight','skylance','worldbreaker']);   // 🗿 콜로서스 공중 5기(RACES.md §3)   // 공중(비행) 유닛 단일 출처 — 바닥 위로 부양. 3D 모듈 AIR_FLOAT도 이걸 참조
try{ if(typeof window!=='undefined') window.FXLAB_AIR=FXLAB_AIR; }catch(_e){}   // M3D 모듈(별도 스코프)에서 공중 판정 공용 참조
const FXLAB_AIR_LIFT=0.16;   // 공중유닛 부양 높이(정규화)
const FXLAB_TGT_X=0.70, FXLAB_TGT_Y=0.52;   // 지상 타겟 기준선(시민)
function fxLabStats(id, gm){ const sg=gm&&STK_UNITS[gm]; if(sg){ var _er=(typeof effRange==='function')?effRange(gm,null):null; return {size:_fxUnitSize(gm), cd:Math.max(0.35,_sbBaseCd(gm)), melee:!!sg.melee, rng:(_er!=null)?Math.max(6,_er*600):(sg.rng||120), color:(U[gm]&&U[gm].color)||'#cfd6e2'}; }   // 사거리·공속·크기 = 공용(크기=실제 모델 SCALE 기준)
  const s=STK_UNITS[id], _d=U[gm||id]||{}; const er=effRange(gm||id,(_d.range!=null?_d.range:null));
  if(er!=null) return {size:_fxUnitSize(gm||id), cd:Math.max(0.35,_sbBaseCd(gm||id)), melee:(er>0&&er<=0.15)||!!_d.melee, rng:(er>0)?Math.max(6,er*600):120, color:_d.color||(U[gm||id]&&U[gm||id].color)||'#cfd6e2'};
  if(s) return {size:s.size, cd:s.cd, melee:!!s.melee, rng:s.rng||120, color:(U[id]&&U[id].color)||'#cfd6e2'};
  const d=U[id]||{}; const _melee=!!d.melee||(d.range>0&&d.range<=0.15); const _rng=(d.range>0)?Math.max(6,d.range*600):120;
  return {size:d.size||16, cd:Math.max(0.5,(d.cd||22)/22), melee:_melee, rng:_rng, color:d.color||'#cfd6e2'}; }
function fxZoomF(){ return Math.max(0.12, Math.min(1.7, (FXLAB.scale||1)*0.72))/0.72; }   // 3D 모델 스케일과 동일 비율(맵/줌)
function fxLabAttX(id, gm){ return Math.max(0.06, FXLAB_TGT_X - (fxLabStats(id,gm).rng/600)*fxZoomF()); }   // 사거리 간격을 줌에 맞춰 스케일
function fxLabSpawnScene(){ const _gm=FXLAB.attGm; const a=fxLabStats(FXLAB.attId,_gm);
  FXLAB.att={ uid:'lab_att'+(++_fxLabAttSeq), id:FXLAB.attId, x:fxLabAttX(FXLAB.attId,_gm), y:((window.M3D&&M3D.airFloat&&M3D.airFloat(_gm||FXLAB.attId))?FXLAB_TGT_Y:(FXLAB_AIR.has(_gm||FXLAB.attId)?FXLAB_TGT_Y-FXLAB_AIR_LIFT:FXLAB_TGT_Y)), face:Math.PI/2, moving:false, fireSeq:0, size:a.size, hidden:false };
  if(_gm) FXLAB.att.gmodel=_gm;
  FXLAB.dummy={ uid:'lab_cit', id:'citizen',  x:FXLAB_TGT_X, y:FXLAB_TGT_Y, face:-Math.PI/2, moving:false, fireSeq:0, size:13 };
  FXLAB.bldg ={ uid:'lab_bld', id:'turret',   x:0.80, y:0.62, face:0,          moving:false, fireSeq:0, size:24 };
  FXLAB.air  ={ uid:'lab_air', id:'skyguard', x:0.72, y:0.14, face:Math.PI,     moving:false, fireSeq:0, size:18 }; }
function fxLabClearStore(){ const s=FXLAB.store; if(s){ s.shots.length=0; s.impacts.length=0; s.melee.length=0; s.deaths.length=0; if(s.flashes) s.flashes.length=0; } }
function fxLabSelect(id, gm){ FXLAB.attId=id; FXLAB.attGm=gm||null; FXLAB.bstate=null; FXLAB.sgstate=null; FXLAB.wyPend=null; FXLAB.vnJet=null; if(!FXLAB.store) FXLAB.store=FX.store(); fxLabClearStore();
  if(window.M3D&&M3D.clearGameModels) M3D.clearGameModels(); fxLabSpawnScene(); FXLAB.phase='alive'; FXLAB.t=(FXLAB.mode==='death')?0.9:0; FXLAB.cd=0.2; fxLabRenderGrid(); }
function fxLabSetMode(mode, el){ FXLAB.mode=mode; FXLAB.phase='alive'; FXLAB.t=(mode==='death')?0.9:0; FXLAB.cd=0.2; FXLAB.mv=1; FXLAB.ti=0;
  FXLAB.bstate=null; FXLAB.sgstate=null; FXLAB.wyPend=null; FXLAB.vnJet=null;   // 베놈퀸 잠복/스팅어 자폭/와이번 튕김/베놈 가스 상태 리셋
  if(FXLAB.att){ FXLAB.att.hidden=false; FXLAB.att.moving=false; if(mode!=='move'){ FXLAB.att.x=fxLabAttX(FXLAB.attId,FXLAB.attGm); FXLAB.att.y=((window.M3D&&M3D.airFloat&&M3D.airFloat(FXLAB.attGm||FXLAB.attId))?FXLAB_TGT_Y:(FXLAB_AIR.has(FXLAB.attGm||FXLAB.attId)?FXLAB_TGT_Y-FXLAB_AIR_LIFT:FXLAB_TGT_Y)); } }
  document.querySelectorAll('#fxLabActs .fxlAct').forEach(b=>b.classList.toggle('on', b.getAttribute('data-m')===mode)); }
function fxLabSetScale(v){ FXLAB.scale=+v||1; const e=document.getElementById('fxLabScaleV'); if(e) e.textContent=(+v).toFixed(2);
  if(FXLAB.att && FXLAB.mode!=='move') FXLAB.att.x=fxLabAttX(FXLAB.attId,FXLAB.attGm); }   // 줌 변경 시 사거리 간격 즉시 반영
function fxLabRenderGrid(){ const g=document.getElementById('fxLabGrid'); if(!g) return;
  const selKey=FXLAB.attId+(FXLAB.attGm?':'+FXLAB.attGm:''); let html='', ri=0;
  for(const race of FXLAB_RACE_ORDER){ const list=FXLAB_ROSTER[race]||[]; if(!list.length) continue;
    html+='<div class="fxlRaceHead '+race+(ri===0?' fxrl0':'')+'">'+FXLAB_RACE_KO[race]+'</div>'; ri++;
    for(const u of list){ const key=u.id+(u.gm?':'+u.gm:''), dispId=u.gm||u.id;
      const on=(key===selKey&&!u.todo)?' on':'', todo=u.todo?' todo':'';
      const st=ATK_STYLE[u.gm||u.id]||ATK_STYLE[u.id]||{};
      const click=u.todo?'':'onclick="fxLabSelect(\''+u.id+'\',\''+(u.gm||'')+'\')"';
      html+='<div class="fxlCard'+on+todo+'" '+click+'><div class="pic">'+unitPortraitHTML(dispId)+'</div>';
      html+='<div class="nm">'+escHtml(u.n)+'</div><div class="ks">'+(u.todo?'준비중':st.kind||'')+'</div></div>'; } }
  g.innerHTML=html; }
function fxLabActivate(){ const w=document.getElementById('fxLabWrap'); if(w) w.classList.add('on');
  const acts=document.getElementById('fxLabActs'); if(acts) acts.classList.remove('hide');
  if(typeof FX!=='undefined') FX.sizeMul=1; FXLAB.scale=1;   // 이펙트 크기 항상 1 고정 / 맵 줌은 핀치로(초기 1)
  const lbl=document.getElementById('unitTabLbl'); if(lbl) lbl.textContent='이펙트';
  FXLAB._hid=[]; ['shopProfile','prodHint','gachaActions','opsManual'].forEach(id=>{ const e=document.getElementById(id); if(!e) return;
    FXLAB._hid.push([id, e.style.display]); e.style.display='none'; });   // 랩이 숨긴 것만 기록 → 비활성화 때 원래 값으로 되돌린다
  if(!FXLAB.store) FXLAB.store=FX.store(); if(window.M3D&&M3D.clearGameModels) M3D.clearGameModels(); fxLabSpawnScene(); fxLabRenderGrid(); }
function fxLabDeactivate(){ const w=document.getElementById('fxLabWrap'); if(w) w.classList.remove('on');
  const acts=document.getElementById('fxLabActs'); if(acts) acts.classList.add('hide');
  const lbl=document.getElementById('unitTabLbl'); if(lbl) lbl.textContent='유닛뽑기';
  if(FXLAB._hid){ FXLAB._hid.forEach(([id,d])=>{ const e=document.getElementById(id); if(e) e.style.display=d; }); FXLAB._hid=null; }   // 랩 진입 전 상태로 복구
  FXLAB.att=null; FXLAB.dummy=null; FXLAB.bldg=null; FXLAB.air=null; }
function fxLabStep(dt){ const L=FXLAB; if(!L.att) fxLabSpawnScene(); const a=L.att, st=fxLabStats(L.attId,L.attGm);
  if(L.pend && L.pend.length){ for(let i=L.pend.length-1;i>=0;i--){ const p=L.pend[i]; p.t-=dt; if(p.t<=0){ FX.spawn(L.store, p.id, p.sx, p.sy, p.tx, p.ty, p.opt); L.pend.splice(i,1); } } }   // 지연 피격: 공격 모션의 타격 순간에 FX 생성
  if(L.wyPend && L.wyPend.length){ for(let i=L.wyPend.length-1;i>=0;i--){ const p=L.wyPend[i]; p.t-=dt; if(p.t<=0){ fxLabWyvernLaunchLeg(L, p.from, p.order, p.idx, p.szf); L.wyPend.splice(i,1); } } }   // 와이번 튕김: 실제 튕길 시점에 좌표 재조회 후 다음 다리 발사
  tickUnitFx(L, dt);   // 이미터 틱(베놈 가스 등 — 랩·전장 공용)
  if(L.mode==='move'){ a.moving=true; a.x+=0.17*dt*L.mv; if(a.x>0.60){ a.x=0.60; L.mv=-1; } if(a.x<0.22){ a.x=0.22; L.mv=1; } a.face=Math.atan2(L.mv,0.0001);
    emitMoveTrail(L.store, (L.attGm||L.attId), a, L.mv, 0, fxZoomF(), dt);   // 이동 트레일(레이서/브레이커/스팅어) — 메인과 공용 이미터(완전 동일)
    return; }
  if(L.mode==='death'){ a.moving=false; L.t-=dt;
    if(L.phase==='alive'){ if(L.t<=0){ FX.death(L.store, a.x,a.y, {unitSize:a.size, color:st.color}); a.hidden=true; L.phase='dead'; L.t=0.9; } }
    else { if(L.t<=0){ a.hidden=false; a.uid='lab_att'+(++_fxLabAttSeq); a.fireSeq=0; L.phase='alive'; L.t=1.0; } }
    return; }
  if(FXLAB_NOATK.has(L.attGm||L.attId)){ a.moving=false; return; }   // 비전투 유닛: 공격 없음(대기만)
  if((L.attGm||L.attId)==='thornqueen'){ fxLabThornCycle(L, a, dt); return; }   // 베놈퀸(럴커식): 지상=공격불가 / 잠복 시에만 가시 퍼붓기
  if((L.attGm||L.attId)==='stinger'){ fxLabStingerCycle(L, a, dt); return; }   // 스팅어(자폭충): 공중 전용 — 대상 지역까지 돌진 후 폭발(원점 복귀)
  a.moving=false; const _noAir=(L.attGm==='snapper'||L.attGm==='broodling'||L.attGm==='ultralisk'||L.attGm==='dark_templar'||L.attGm==='behemoth'); const tgts=[L.dummy, L.bldg]; if(FXLAB_AA.has(L.attId)&&L.air&&!((L.attGm||'').indexOf('worker_')===0)&&!_noAir) tgts.push(L.air);   // 일꾼·근접·베히모스(가디언)는 공중 공격 제외
  if((L.attGm||L.attId)==='hellfire'||(L.attGm||L.attId)==='venom'){ tgts.length=0; if(L.air) tgts.push(L.air); if(!tgts.length) return; }   // 헬파이어·베놈: 공중 전용(지상 공격 불가)
  if(L._switchT>0){ L._switchT-=dt; if(L._switchT<=0) L.ti=((L.ti||0)+1)%tgts.length; }   // 텀 경과 후 타겟 전환(발사 직후 즉시 X → 부드러운 전환)
  const tgt=tgts[(L.ti||0)%tgts.length]; if(!tgt) return;
  const _cc=(window.M3D&&M3D.centerAt)?M3D.centerAt(tgt.uid):null; const ty=_cc?_cc.y:((tgt===L.air)?tgt.y-0.05:tgt.y);   // 몸 중앙 조준(발 X)
  const dx=tgt.x-a.x, dy=ty-a.y; a.face=Math.atan2(dx,dy);
  L.cd-=dt; if(L.cd<=0){ L.cd+=Math.max(0.42, st.cd); a.fireSeq=(a.fireSeq||0)+1;   // +=로 나머지 이월 → 발사 간격 정확(모션 루프와 위상 고정, 드리프트 방지)
    const fxId=L.attGm||L.attId;
    if(typeof playUnitAttack==='function') playUnitAttack(fxId);   // 유닛 공격음 재생
    unitFireFx(L, a, tgt.x, ty, st.size, (tgt===L.air));   // 발사 이펙트(랩·전장 공용 디스패치, L=FXLAB 영속 shim)
    L._switchT=FXLAB_SWITCH_DELAY; } }
// 이미터 틱(연속 방출형 이펙트: 베놈 가스) — L=영속 shim(store/vnJet 보유). 랩(FXLAB)·전장(u._fxL) 공용
function tickUnitFx(L, dt){ if(!L||!L.store||!L.store.smoke) return;
  if(L.vnJet){ const J=L.vnJet; J.t-=dt; J.acc+=dt;
    while(J.acc>=0.016){ J.acc-=0.016; for(let k=0;k<5;k++){ const an=J.ang+(Math.random()-0.5)*0.18, v=J.v*(0.85+Math.random()*0.3), trav=(J.ed||0.25)*(0.88+Math.random()*0.24);
      L.store.smoke.push({x:J.mx+(Math.random()-0.5)*0.006, y:J.my+(Math.random()-0.5)*0.006, vx:Math.cos(an)*v, vy:Math.sin(an)*v, vk:1, life:1, r0:(0.45+Math.random()*0.5)*J.szf, col:(Math.random()<0.6?'#7ca83c':'#96c452'), ex:2.6, af:0.4, dk:v/trav}); } }
    if(J.t<=0) L.vnJet=null; } }
// 유닛별 발사 이펙트 디스패치(랩·전투실험 공용) — L=영속 shim(store/pend/vnJet), u=발사 유닛, (tx,ty)=대상, tgtAir=대상 공중여부
function unitFireFx(L, u, tx, ty, size, tgtAir){ const store=L.store; if(!L.pend) L.pend=[]; const pend=L.pend; const id=u.id, fxId=u.gmodel||u.id;
  try{
    if(id==='goliath'&&!u.gmodel){ if(tgtAir) fxLabGoliathFire(L, u, tx, ty, size); else fxLabGoliathGround(L, u, tx, ty, size); }   // 공중=어깨 유도미사일 2발(기존) / 지상=왼손 미사일 1발
    else if(fxId==='racer') fxLabRacerFire(L, u, tx, ty);
    else if(fxId==='skyguard'&&tgtAir) fxLabTempestAir(L, u, tx, ty, size);
    else if(fxId==='hellfire') fxLabHellfireFire(L, u, tx, ty, size);
    else if(fxId==='falcon') fxLabFalconFire(L, u, tx, ty, size);
    else if(fxId==='hydra') fxLabHydraFire(L, u, tx, ty, size);
    else if(fxId==='wyvern') fxLabWyvernFire(L, u, {x:tx,y:ty}, ty, size, 0);   // 전장: 단일 표창(바운스 대상 없음)
    else if(fxId==='venom') fxLabVenomFire(L, u, tx, ty, size);
    else if(fxId==='behemoth') fxLabBehemothFire(L, u, tx, ty, size);
    else { const _dx=tx-u.x, _dy=ty-u.y, _d=Math.hypot(_dx,_dy)||1, _mz=0.03*((size||16)/16);
      let _sx=u.x+(_dx/_d)*_mz, _sy=u.y+(_dy/_d)*_mz-0.024;
      const _mzg=(window.M3D && M3D.muzzleAt)?M3D.muzzleAt(u.uid):null;
      if(_mzg){ const _bl=(fxId==='tank')?0:0.02*fxZoomF(); _sx=_mzg.x+(_dx/_d)*_bl; _sy=_mzg.y+(_dy/_d)*_bl; }
      else if(window.M3D && M3D.airFloat && M3D.airFloat(fxId)){ const _ctr=M3D.centerAt?M3D.centerAt(u.uid):null; if(_ctr){ const _fw=_mz+((fxId==='dreadnought')?0.0127*fxZoomF():0)+((fxId==='skydancer')?0.007*fxZoomF():0); _sx=_ctr.x+(_dx/_d)*_fw; _sy=_ctr.y+(_dy/_d)*_fw; } }
      const _stA=(typeof ATK_STYLE!=='undefined'?(ATK_STYLE[fxId]||ATK_STYLE._default):{}), _opt={speed:(_stA.melee?6.5:(fxId==='marine'?4.5:3.6)), unitSize:size}, _hd=_stA.hit||0;
      if(_hd>0 && pend) pend.push({t:_hd, id:fxId, sx:_sx, sy:_sy, tx:tx, ty:ty, opt:_opt});
      else FX.spawn(store, fxId, _sx, _sy, tx, ty, _opt); }
  }catch(e){} }   // 발사 후 텀: 방금 쏜 대상을 계속 바라보다 전환
function fxLabGoliathFire(L, a, tx, ty, size){   // 스트라이더 공중: 어깨 추적 미사일 2발 — 유도곡선 + 트레일
  if(!L.store||!L.store.shots) return;
  const upN=0.04, sideN=0.025, szf=(size||16)/18*0.73, sp=1.7;
  for(let k=-1;k<=1;k+=2){ const sx=a.x+sideN*k, sy=a.y-upN, baseA=Math.atan2(ty-sy,tx-sx), la=baseA+k*0.7;
    L.store.shots.push({x:sx,y:sy,vx:Math.cos(la)*sp,vy:Math.sin(la)*sp,t:0,dur:1.2,kind:'missile',color:'#5ad1ff',boom:8,szf:szf,mx:sx,my:sy,ex:tx,ey:ty,dist:null,noflash:1});
    FX.smoke(L.store, sx, sy); } }
function fxLabGoliathGround(L, a, tx, ty, size){   // 스트라이더 지상: 왼손(화면 왼쪽)에서 미사일 1발 — 살짝 휘어 타격(유도)
  if(!L.store||!L.store.shots) return;
  const sideN=0.02, downN=0.006, szf=(size||16)/18*0.72, sp=1.9;
  const sx=a.x-sideN, sy=a.y+downN;   // 왼손 위치: 화면 왼쪽·어깨보다 살짝 아래
  const la=Math.atan2(ty-sy,tx-sx)+0.15;   // 왼손에서 나가 약간의 곡선 그리며 타격
  L.store.shots.push({x:sx,y:sy,vx:Math.cos(la)*sp,vy:Math.sin(la)*sp,t:0,dur:1.0,kind:'missile',color:'#5ad1ff',boom:8,szf:szf,mx:sx,my:sy,ex:tx,ey:ty,dist:null,noflash:0});
  FX.smoke(L.store, sx, sy); }
function fxLabTempestAir(L, a, tx, ty, size){   // 템페스트 공중: 얇은 소형 미사일 2발 — 스트라이더 미사일보다 빠르고 작게(궤적 살짝 벌어졌다 수렴)
  if(!L.store||!L.store.shots) return;
  const _c=(window.M3D&&M3D.centerAt)?M3D.centerAt(a.uid):null, ox=_c?_c.x:a.x, oy=_c?_c.y:(a.y-0.03);   // 부양한 기체 중앙에서 발사
  const dx=tx-ox, dy=ty-oy, d=Math.hypot(dx,dy)||1, px=-dy/d, py=dx/d;
  const sideN=0.012, szf=(size||16)/18*0.34, sp=2.8;   // 스트라이더(szf~0.73·sp1.7) 대비 절반 크기·1.6배 속도
  for(let k=-1;k<=1;k+=2){ const sx=ox+px*sideN*k, sy=oy+py*sideN*k, baseA=Math.atan2(ty-sy,tx-sx), la=baseA+k*0.3, ed=Math.hypot(tx-sx,ty-sy)||1;
    L.store.shots.push({x:sx,y:sy,vx:Math.cos(la)*sp,vy:Math.sin(la)*sp,t:0,dur:0.9,kind:'missile',color:'#9fe0ff',boom:4,szf:szf,mx:sx,my:sy,ex:tx,ey:ty,dist:ed*0.99,noflash:1}); } }   // dist로 확실히 명중(고속 통과 방지)
// 스팅어(자폭충): 공중 전용 — 대기 → 대상 지역으로 돌진(정확한 좌표X, 주변 지역) → 도착 시 자폭(범위딜 시각화, 중심=최대~외곽=최소) → 원점 복귀
function fxLabStingerCycle(L, a, dt){ a.moving=false; if(!L.air) return;
  if(L.sgstate==null){ L.sgstate='ready'; L.sgt=0.5; L.sgOrigin={x:a.x,y:a.y}; }
  L.sgt-=dt;
  if(L.sgstate==='ready'){ a.hidden=false; a.moving=false;
    const _cc=(window.M3D&&M3D.centerAt)?M3D.centerAt(L.air.uid):null, ty=_cc?_cc.y:(L.air.y-0.05); a.face=Math.atan2(L.air.x-a.x, ty-a.y);
    if(L.sgt<=0){ L.sgstate='dash';
      const ar=(a.size||14)*0.005;   // 목표=적 유닛 정확한 좌표가 아닌 주변 공격 지역(약간의 산포)
      L.sgTarget={x:L.air.x+(Math.random()-0.5)*ar, y:ty+(Math.random()-0.5)*ar};
      const _bc=(window.M3D&&M3D.centerAt)?M3D.centerAt(a.uid):null, _lift=_bc?Math.max(0,a.y-_bc.y):0;   // 부양 오프셋(앵커−몸 중앙): 공중 유닛은 모델이 앵커보다 위에 떠서 렌더됨
      L.sgAnchor={x:L.sgTarget.x, y:L.sgTarget.y+_lift};   // 앵커 목적지 = 폭발 지점 + 부양 오프셋 → 몸체가 정확히 폭발 지점에서 멈춤(지나침 방지)
      const _spd=(U[a.gmodel||a.id]&&U[a.gmodel||a.id].moveSpd)||0.3;   // 실제 이동속도 그대로 돌진(임의 고속 X) — 이동해서 부딪히는 느낌
      L.sgFrom={x:a.x,y:a.y}; L.sgDur=Math.max(0.25, Math.hypot(L.sgAnchor.x-a.x,L.sgAnchor.y-a.y)/_spd); L.sgT0=L.sgDur; L.sgt=L.sgDur; } }
  else if(L.sgstate==='dash'){ a.hidden=false; a.moving=true;
    const _dst=L.sgAnchor||L.sgTarget;   // 보정된 앵커 목적지(부양 오프셋 반영)
    const p=Math.min(1,1-(L.sgt/L.sgT0)), pe=Math.pow(p,1.55);   // 가속 돌진: 천천히 출발 → 점점 빨라져 박음(총 소요시간=이동속도 기준 유지)
    a.x=L.sgFrom.x+(_dst.x-L.sgFrom.x)*pe; a.y=L.sgFrom.y+(_dst.y-L.sgFrom.y)*pe+Math.sin(p*21)*0.0035*(1-p);   // 유기체 미세 요동 — 접근할수록 잦아듦
    a.face=Math.atan2(_dst.x-L.sgFrom.x, _dst.y-L.sgFrom.y);
    if(L.store&&L.store.smoke){ L._sgTrail=(L._sgTrail||0)-dt; if(L._sgTrail<=0){ L._sgTrail=0.025;
      const _tc=(window.M3D&&M3D.centerAt)?M3D.centerAt(a.uid):null, _ddx=_dst.x-L.sgFrom.x, _ddy=_dst.y-L.sgFrom.y, _ddd=Math.hypot(_ddx,_ddy)||1;   // 연기 원점 = 떠 있는 몸 중앙(앵커=바닥 X)에서 진행 반대쪽
      const _sro2=0.012*fxZoomF(), _sx3=(_tc?_tc.x:a.x)-(_ddx/_ddd)*_sro2, _sy3=(_tc?_tc.y:a.y)-(_ddy/_ddd)*_sro2;   // 뒤 오프셋 줌 비례
      L.store.smoke.push({x:_sx3,y:_sy3,vx:(Math.random()-0.5)*0.01,vy:(Math.random()-0.5)*0.01,life:1,r0:0.7+Math.random()*0.6,col:'#8fbf5a',ex:2.2,af:0.4,dk:3.4}); } }   // 돌진 잔상(옅은 산성 궤적)
    if(L.sgt<=0){ fxLabStingerBlast(L, a, L.sgTarget.x, L.sgTarget.y); if(window.M3D&&M3D.dropModels){ try{ M3D.dropModels([a.uid]); }catch(e){} } a.hidden=true; L.sgstate='gap'; L.sgt=0.5; } }   // 자폭 즉시 모델 제거(죽음 애니/시체 없이 폭발과 함께 소멸)
  else if(L.sgstate==='gap'){ a.hidden=true;
    if(L.sgt<=0){ a.x=L.sgOrigin.x; a.y=L.sgOrigin.y; a.hidden=false; a.uid='lab_att'+(++_fxLabAttSeq); a.fireSeq=0; L.sgstate='ready'; L.sgt=0.5; } } }
function fxLabStingerBlast(L, a, x, y){   // 자폭 범위딜: 중심=최대 데미지, 외곽으로 갈수록 약화 — 스팅어 크기보다 약간 큰 범위까지, 터지며 사라짐
  if(!L.store) return; const szf=(a.size||14)/18;
  L.store.melee.push({kind:'boom', x:x, y:y, life:1, dk:3.3, col:'#c8e89a', szf:szf, sd:(L.store._sd=((L.store._sd||0)+1)&255)});
  if(L.store.smoke){ for(let k=0;k<9;k++){ const an=Math.random()*6.283, sp=0.02+Math.random()*0.04; L.store.smoke.push({x:x,y:y,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,life:1,r0:1.2+Math.random()*1.6,col:(k%2?'#c8e89a':'#7fae4c'),ex:2.6,af:0.42,dk:3.0}); } } }
// 베놈퀸(럴커): 지상=대기(공격 불가) → 땅 파고 잠복 → 잠복 중 가시 폭격 → 지상 복귀 사이클
function fxLabThornCycle(L, a, dt){ a.moving=false;
  if(L.bstate==null){ L.bstate='surface'; L.bt=1.6; }
  L.bt-=dt;
  if(L.bstate==='surface'){ a.hidden=false; a.face=Math.PI/2;   // 지상: 대기(공격 안 함)
    if(L.bt<=0){ L.bstate='digging'; L.bt=0.4; fxLabDigPuff(L, a); } }
  else if(L.bstate==='digging'){ a.hidden=false;   // 파고드는 중(흙먼지)
    if(L.bt<=0){ if(window.M3D&&M3D.dropModels){ try{ M3D.dropModels([a.uid]); }catch(e){} } a.hidden=true; L.bstate='burrowed'; L.bt=3.2; L.cd=0.25; } }   // 모델 즉시 제거(죽음 애니 없이 바로 사라짐)
  else if(L.bstate==='burrowed'){ a.hidden=true;   // 잠복: 주기적으로 가시 폭격
    L.cd-=dt; if(L.cd<=0){ L.cd=Math.max(0.42,fxLabStats(L.attId,L.attGm).cd); fxLabThornBarrage(L, a, L.dummy); }   // 폭격 간격 = base_stats 공속 연동
    if(L.bt<=0){ a.hidden=false; a.uid='lab_att'+(++_fxLabAttSeq); a.fireSeq=0; L.bstate='emerging'; L.bt=0.4; fxLabDigPuff(L, a); } }   // 복귀: 새 uid로 즉시 등장(부활 애니 방지)
  else { a.hidden=false;   // 지상 복귀
    if(L.bt<=0){ L.bstate='surface'; L.bt=1.6; } } }
function fxLabDigPuff(L, a){ if(!L.store||!L.store.smoke) return;   // 땅 파기 흙먼지
  for(let k=0;k<10;k++){ const an=-Math.PI/2+(Math.random()-0.5)*2.4, sp=0.02+Math.random()*0.04;
    L.store.smoke.push({x:a.x+(Math.random()-0.5)*0.03, y:FXLAB_TGT_Y-0.004, vx:Math.cos(an)*sp, vy:Math.sin(an)*sp*0.7, life:1, r0:0.9+Math.random()*0.9, col:(k%2?'#6b5636':'#8a7048'), ex:2.4, af:0.5, dk:2.4}); } }
function fxLabThornBarrage(L, a, tgt){   // 럴커식 라인 폭격: 굴에서 가시가 하늘로 솟았다 포물선으로 낙하, 굴→대상→최대사거리까지 일직선 일정 간격 착지
  if(!L.store||!L.store.shots||!tgt) return;
  const gy=FXLAB_TGT_Y, sx0=a.x, sy0=gy-0.005, dir=Math.sign(tgt.x-sx0)||1;   // dir=공격 방향(가시가 기울어질 쪽)
  const reach=Math.abs(tgt.x-sx0)+0.2, N=9, step=reach/N, szf=(a.size||16)/18*0.72, grav=2.6;   // 대상 지역 + 최대사거리까지
  for(let k=1;k<=N;k++){ const ex=sx0+dir*step*k, peak=0.24+Math.random()*0.05, T=Math.sqrt(8*peak/grav), vxLine=(ex-sx0)/T, vy0=-0.5*grav*T;
    const vxMinLean=(reach*0.35)/T, vx=(Math.abs(vxLine)>vxMinLean?Math.abs(vxLine):vxMinLean)*dir;   // 완전 수직 방지: 가까운 착지점도 공격 방향으로 최소한 확실히 기울게
    L.store.shots.push({x:sx0,y:sy0,vx:vx,vy:vy0,t:0,dur:3,kind:'needle',imk:'stab',color:'#9fd356',boom:3,szf:szf,wd:1.8,grav:grav,landY:gy,delay:(k-1)*0.05,mx:sx0,my:sy0,noflash:1}); }   // 굴→끝까지 순차(투두둑 라인 폭격) → 하늘로 솟았다 낙하 꽂힘
  if(L.store.smoke) for(let k=0;k<6;k++){ const an=-Math.PI/2+(Math.random()-0.5)*1.4; L.store.smoke.push({x:sx0+(Math.random()-0.5)*0.02,y:gy-0.004,vx:Math.cos(an)*0.03,vy:Math.sin(an)*0.03,life:1,r0:0.8,col:'#5a4a30',ex:2,af:0.4,dk:2.6}); } }   // 굴 입구 분출 흙먼지
function fxLabHydraFire(L, a, tx, ty, size){   // 리퍼: 양손에서 가시 다발이 아주 짧은 텀으로 연달아 발사 → 대상 전 범위 랜덤 타격(한 점 X)
  if(!L.store||!L.store.shots) return;
  const _c=(window.M3D&&M3D.centerAt)?M3D.centerAt(a.uid):null, ox0=_c?_c.x:a.x, oy0=_c?_c.y:(a.y-0.02);
  const dx=tx-ox0, dy=ty-oy0, d=Math.hypot(dx,dy)||1, px=-dy/d, py=dx/d;   // 손 좌우(진행 수직)
  const N=3, szf=(size||16)/18*0.85, sp=5.2, R=((size||16)/600)*fxZoomF()*0.5, ho=0.013*fxZoomF();   // 개수 절반·굵게 / R=모델 반경 절반(좁게 모여 확실히 몸통 안에 박힘)
  for(let k=0;k<N;k++){ const hand=(k%2?1:-1), sx=ox0+px*ho*hand, sy=oy0+py*ho*hand;
    const rr=Math.sqrt(Math.random())*R, ra=Math.random()*6.283, ex=tx+Math.cos(ra)*rr, ey=ty+Math.sin(ra)*rr*0.85;   // 대상 모델 내부 랜덤(약간 납작)
    const la=Math.atan2(ey-sy,ex-sx), ed=Math.hypot(ex-sx,ey-sy)||1;
    L.store.shots.push({x:sx,y:sy,vx:Math.cos(la)*sp,vy:Math.sin(la)*sp,t:0,dur:Math.min(0.6,ed/sp),kind:'needle',imk:'stab',color:'#9fd356',boom:3,szf:szf,wd:1.7,delay:k*0.006,mx:sx,my:sy,dist:ed,ex:ex,ey:ey,noflash:1}); }   // 텀 0.006s×3=거의 동시 / wd=굵게 / dist로 모델 내부서 확실히 멈춤
}
function fxLabWyvernCenterY(L, t){ const cc=(window.M3D&&M3D.centerAt)?M3D.centerAt(t.uid):null; return cc?cc.y:((t===L.air)?t.y-0.05:t.y); }
function fxLabWyvernFire(L, a, tgt, ty, size, rng){   // 와이번(뮤탈 리스킨): 꼬리(몸 뒤·아래)에서 회전 표창 발사 — 가까이 있는 대상에만 튕김(최대 3쿠션), 튕길수록 작고 느려짐(약화)
  if(!L.store||!L.store.shots||!tgt) return;
  const bounceMax=Math.max(0.15,(rng||120)/600);   // 튕김 사거리 = 실제 공격 사거리(무한정 튕기지 않음)
  let cur={x:tgt.x,y:ty}; const order=[tgt]; let remain=[L.dummy,L.bldg,L.air].filter(t=>t && t!==tgt);
  for(let step=0;step<2 && remain.length;step++){   // 튕길 순서만 미리 결정(당구식) — 좌표는 각 튕김 발사 직전에 새로 조회(아래)
    remain.sort((p,q)=>Math.hypot(p.x-cur.x,fxLabWyvernCenterY(L,p)-cur.y)-Math.hypot(q.x-cur.x,fxLabWyvernCenterY(L,q)-cur.y));
    const nx=remain[0], ny=fxLabWyvernCenterY(L,nx), d=Math.hypot(nx.x-cur.x,ny-cur.y);
    if(d>bounceMax) break;
    cur={x:nx.x,y:ny}; order.push(nx); remain=remain.filter(t=>t!==nx); }
  const _c=(window.M3D&&M3D.centerAt)?M3D.centerAt(a.uid):null, bx=_c?_c.x:a.x, by=_c?_c.y:(a.y-0.03);
  fxLabWyvernLaunchLeg(L, {x:bx,y:by}, order, 0, (size||16)/18); }
function fxLabWyvernLaunchLeg(L, from, order, idx, szf){   // 튕길 때마다 실제 타격 지점(현재 프레임 기준 좌표)을 다시 조회 — 이전엔 처음에 한 번에 계산해 둬서 나중 튕김(숨쉬기 등으로 위치가 미세하게 변함)이 실제 위치와 어긋났음
  if(!L.store||!L.store.shots||idx>=order.length) return;
  const t=order[idx], tx=t.x, ty=fxLabWyvernCenterY(L,t);   // 지금 이 순간의 실제 좌표(신선)
  let ox=from.x, oy=from.y;
  if(idx===0){ const fx0=tx-ox, fy0=ty-oy, fd0=Math.hypot(fx0,fy0)||1, tailN=0.022*fxZoomF();
    ox=ox-(fx0/fd0)*tailN; oy=oy-(fy0/fd0)*tailN+0.014*fxZoomF(); }   // 1차만 꼬리 오프셋(이후 튕김은 직전 타격 지점에서 그대로 이어짐)
  const dx=tx-ox, dy=ty-oy, d=Math.hypot(dx,dy)||1, spd=3.2, dur=Math.min(0.5,d/spd), sf=Math.max(0.35,szf*(1-idx*0.22));
  L.store.shots.push({x:ox,y:oy,vx:(dx/d)*spd,vy:(dy/d)*spd,t:0,dur:dur+0.05,kind:'shuriken',imk:'shurikenHit',color:'#bfe89a',boom:2,szf:sf,spinRate:22,delay:0,mx:ox,my:oy,dist:d,noflash:1,tr:0.5});
  if(idx+1<order.length){ (L.wyPend=L.wyPend||[]).push({t:dur, from:{x:tx,y:ty}, order:order, idx:idx+1, szf:szf}); } }
function fxLabBehemothFire(L, a, tx, ty, size){   // 베히모스(가디언): 꼬리(떠 있는 몸 최하단)에서 뭉친 독구슬 발사 — 독연기 꼬리 + 착탄 독폭발
  if(!L.store||!L.store.shots) return;
  const _c=(window.M3D&&M3D.centerAt)?M3D.centerAt(a.uid):null, cx0=_c?_c.x:a.x, cy0=_c?_c.y:(a.y-0.05);
  const bot=cy0+(a.y-cy0)*0.45;   // 몸 중앙~지면 앵커의 45% 지점 = 부양한 몸의 최하단(꼬리 높이)
  const dx0=tx-cx0, d0=Math.abs(dx0)||1, sx=cx0-(dx0/d0)*0.008, sy=bot;   // 꼬리(진행 반대쪽으로 살짝)
  const la=Math.atan2(ty-sy,tx-sx), ed=Math.hypot(tx-sx,ty-sy)||1, sp=2.6, szf=(size||16)/18;   // sp=최고속도(가속 램프로 초반 느림→순식간에 최고속, 센티넬식)
  L.store.shots.push({x:sx,y:sy,vx:Math.cos(la)*sp,vy:Math.sin(la)*sp,t:0,dur:3,kind:'porb',color:'#a6e23c',boom:3,szf:szf,mx:sx,my:sy,dist:ed,ex:tx,ey:ty,noflash:1,gt:1,imk:'spit',ramp:0.42}); }   // 독구슬: 가속 램프 + 독연기 꼬리 + 간단 착탄 스플래터(범위 폭발 제거)
function fxLabVenomFire(L, a, tx, ty, size){   // 베놈(디바우러): 화염방사기식 독가스 분사 — 입에서 가스 퍼프를 연속 분출해 덩어리째 던짐(발사체 X) + 대상에 독 구름 잔류
  if(!L.store||!L.store.smoke) return;
  const _c=(window.M3D&&M3D.centerAt)?M3D.centerAt(a.uid):null, ox=_c?_c.x:a.x, oy=_c?_c.y:(a.y-0.03);   // 부양 기체 중앙
  const dx=tx-ox, dy=ty-oy, d=Math.hypot(dx,dy)||1, fw=0.016*fxZoomF();
  const mx=ox+(dx/d)*fw, my=oy+(dy/d)*fw;   // 입(전방)
  const ed=Math.hypot(tx-mx,ty-my)||1, szf=(size||16)/18;
  L.vnJet={t:0.15, acc:0, mx:mx, my:my, ang:Math.atan2(ty-my,tx-mx), v:ed/0.32, szf:szf, ed:ed};   // 가스 분사 이미터: 0.15초에 왈칵 몰아 뱉는 압축 버스트(선단 ~0.32초 도달)
  L.store.melee.push({kind:'infect', x:tx, y:ty, life:1, dk:0.45, col:'#7ca83c', szf:szf, delay:0.3, sd:(L.store._sd=((L.store._sd||0)+1)&255)}); }   // 가스 도달 시점부터 독 구름 잔류(~2.2s)
function fxLabFalconFire(L, a, tx, ty, size){   // 팔콘: 두 날개(바깥쪽)에서 파란 에너지 파동 빔 2발 — 날며 간격 아주 살짝만 좁아짐(수렴 X)
  if(!L.store||!L.store.shots) return;
  const _c=(window.M3D&&M3D.centerAt)?M3D.centerAt(a.uid):null, ox=_c?_c.x:a.x, oy=_c?_c.y:(a.y-0.03);   // 부양 기체 중앙
  const dx=tx-ox, dy=ty-oy, d=Math.hypot(dx,dy)||1, px=-dy/d, py=dx/d;   // 진행 수직(날개 방향)
  const sideN=0.011*fxZoomF(), fwdN=0.022*fxZoomF(), szf=(size||16)/18*0.5, sp=4.6, fx0=dx/d, fy0=dy/d;   // 발사 폭 축소(모델 안) + 전방 오프셋 → 날개 가장 앞 두 지점
  for(let k=-1;k<=1;k+=2){ const sx=ox+px*sideN*k+fx0*fwdN, sy=oy+py*sideN*k+fy0*fwdN;   // 날개 앞끝 좌/우 출발
    const ext=tx+px*sideN*0.8*k, eyt=ty+py*sideN*0.8*k, la=Math.atan2(eyt-sy,ext-sx), ed=Math.hypot(ext-sx,eyt-sy)||1;   // 도착 간격 80% → 아주 살짝만 좁아짐
    L.store.shots.push({x:sx,y:sy,vx:Math.cos(la)*sp,vy:Math.sin(la)*sp,t:0,dur:Math.min(0.6,Math.max(0.05,ed/sp)),kind:'beam',color:'#6ec8ff',boom:4,szf:szf,mx:sx,my:sy,dist:ed,ex:ext,ey:eyt,lng:3.0,hd:0.85,wd:0.9,noflash:1});   // 파란 에너지 빔
    if(L.store.smoke) L.store.smoke.push({x:sx,y:sy,vx:Math.cos(la)*0.04,vy:Math.sin(la)*0.04,life:1,r0:1.0,col:'#8fd4ff',glow:true,dk:6.5,ex:1.8,af:0.3}); } }   // 발사구 에너지 펄스(희미하게)
function fxLabHellfireFire(L, a, tx, ty, size){   // 헬파이어: 스타크 발키리식 로켓 볼리 — 여러 발 시간차 발사, 제각각 곡선 유도, 착탄 산포(미사일당 개별 타격)
  if(!L.store||!L.store.shots) return;
  const _c=(window.M3D&&M3D.centerAt)?M3D.centerAt(a.uid):null, ox=_c?_c.x:a.x, oy=_c?_c.y:(a.y-0.03);   // 부양 기체 중앙
  const dx=tx-ox, dy=ty-oy, d0=Math.hypot(dx,dy)||1, px=-dy/d0, py=dx/d0;
  const N=6, sp=1.5, szf=(size||16)/18*0.46;   // 스트라이더 미사일(1.7)보다 살짝 느리고 작게
  for(let i=0;i<N;i++){ const k=(i%2)?1:-1, off=0.006+((i/2)|0)*0.004;   // 좌/우 포드 번갈아
    const sx=ox+px*off*k, sy=oy+py*off*k;
    const jx=tx+(Math.random()-0.5)*0.035, jy=ty+(Math.random()-0.5)*0.035;   // 유닛 직접 타격 X — 주변 지역 착탄(스플래시)
    const baseA=Math.atan2(jy-sy,jx-sx), la=baseA+k*(0.55+Math.random()*0.5);   // 크게 벌어졌다 유도 수렴(곡선)
    L.store.shots.push({x:sx,y:sy,vx:Math.cos(la)*sp,vy:Math.sin(la)*sp,t:0,dur:1.8,kind:'missile',color:'#ffd9a0',boom:7,szf:szf,delay:i*0.055,mx:sx,my:sy,ex:jx,ey:jy,dist:null,noflash:1,wob:(Math.random()-0.5)*2}); } }   // 시간차 + 미세 흔들림(유기적 곡선) + 지역 폭발
   // 짧고 빠른 버스트(6발·고속탄·짧은 트레이서)
function fxLabRacerFire(L, a, tx, ty){   // 레이서: 오토바이 앞 좌/우 총에서 각 2발(총 4발) — 타겟 방향=바이크 앞
  const dx=tx-a.x, dy=ty-a.y, d=Math.hypot(dx,dy)||1, nx=dx/d, ny=dy/d, px=-ny, py=nx, sz=(a&&a.size)||18;
  const _zf=(typeof fxZoomF==="function")?fxZoomF():1, frontN=0.038*_zf, sideN=0.0055*_zf, upN=0.008*_zf, bx=a.x+nx*frontN, by=a.y+ny*frontN-upN, _dd=Math.max(0.02, d-frontN);   // 바이크 가장 앞(노즈)·간격 좁게·줌 비례
  for(const sgn of [-1,1]){ const gx=bx+px*sideN*sgn, gy=by+py*sideN*sgn; FX.spawn(L.store, 'racer', gx, gy, gx+nx*_dd, gy+ny*_dd, {speed:4.4, unitSize:sz}); }   // 평행 직진(간격 유지, 한 점 수렴 X)
}
function fxLabRender(dt){ const L=FXLAB; if(!L.store) L.store=FX.store(); if(!L.att) fxLabSpawnScene();
  const r=setup('cvUnit'); GW=r.W; GH=r.H; drawSandboxGround(r.ctx, r.W, r.H);   // 빈 땅(cvUnit)
  fxLabStep(dt);
  if(L.att && (L.bstate==='digging'||L.bstate==='burrowed'||L.bstate==='emerging')){   // 베놈퀸 잠복 = 지하 굴(검정 타원) — 지면 캔버스에 직접(3D에 안 가림)
    const _hk=(L.bstate==='digging')?Math.min(1,Math.max(0,1-L.bt/0.4)):(L.bstate==='emerging')?Math.min(1,Math.max(0,L.bt/0.4)):1;   // 굴 등장 계수: 파고들 때 자라나고 나올 때 줄어듦(팝인/팝아웃 방지)
    const mx=L.att.x*r.W, my=FXLAB_TGT_Y*r.H, w=Math.max(0.5,(L.att.size||16)*0.64*L.scale*_hk), h=w*0.4, ctx=r.ctx;   // 굴 반경 = 유닛 크기 비례 × 등장 계수
    ctx.save(); ctx.translate(mx,my); ctx.scale(1,h/w);   // 변환 후 로컬 좌표로 그라데이션 생성(이전엔 중심이 어긋나 투명부만 칠해져 안 보였음)
    const g=ctx.createRadialGradient(0,0,0,0,0,w); g.addColorStop(0,'rgba(0,0,0,.94)'); g.addColorStop(0.7,'rgba(0,0,0,.84)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,w,0,6.283); ctx.fill();
    ctx.strokeStyle='rgba(70,56,38,.6)'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(0,0,w*0.82,0,6.283); ctx.stroke(); ctx.restore(); }
  const mcv=document.getElementById('cvMarine');
  if(window.M3D && M3D.ready() && !(G.opt&&G.opt.model3d===false)){ mcv.style.display='block';
    const list=[]; if(L.att && !L.att.hidden) list.push(L.att); if(L.dummy) list.push(L.dummy); if(L.bldg) list.push(L.bldg); if(L.air) list.push(L.air);
    const k=Math.max(0.12, Math.min(1.7, L.scale*0.72));   // 맵/줌 스케일 → 3D 모델 크기
    M3D.sync(list, r.W, r.H, dt, [], [], null, k); }
  else if(mcv) mcv.style.display='none';
  const fcv=document.getElementById('cvFx');
  if(fcv){ fcv.style.display='block'; const f=setup('cvFx'); FX.advance(L.store, dt);
    FX.drawShots(f.ctx, L.store, (x,y)=>({x:x*f.W, y:y*f.H}), 1.0*L.scale); } }   // 이펙트도 같은 스케일

