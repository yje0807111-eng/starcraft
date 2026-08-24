/* ============================================================================
 * 10-engine.js — 유즈맵 엔진 — 게임 상태 · 캔버스/트랙 · 유닛/적 로직 · 프레임 업데이트 · DOM 렌더
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ============================================================================
// 게임 상태
// ============================================================================
function newGame(){ return {
  phase:'ready', round:1, kills:0, timeSec:0, speedMul:1, difficulty:'normal',
  view:{x:0.5, y:0.5, zoom:1}, viewT:{x:0.5, y:0.5, zoom:1},   // view=렌더(보간) / viewT=핀치 목표. zoom1·중심0.5=항등(기존과 동일)
  mineral:mapCfg('startCredits',START_MIN), gas:mapCfg('startEnergy',START_GAS), atkLv:{inf:0,mech:0,pro:0,zrg:0}, // 계열별 공격 업글 레벨
  points:0, _pointsBanked:false,   // 이번 판에서 모은 포인트(월드보스 처치 합) — 게임 종료 시 포인트으로 정산 → 다음 판 강화
  coopBoss:null, bossOpen:false, bossPickArm:false,   // 상시 공용 보스 + 토벌장 팝업 + 지정 파견
  units:[], enemies:[], beams:[], shots:[], impacts:[], muzzles:[], debris:[], pendingHits:[], recalls:[], sparks:[], pendSpawn:[], // 이펙트 + 명중대기 + 출현이펙트/대기 + 스파크
  toSpawn:0, spawnTimer:0, roundGap:0,
  roundPhase:'prep', roundTime:10,   // 'prep'(준비 10s) → 'active'(라운드 1:00), 카운트다운
  tab:'Main', sel:[], selEnemy:null, prodB:null, techB:null, curPlayer:2, myPlayer:1,   // myPlayer=내 슬롯(멀티 대기실 순서로 할당 예정), curPlayer=관전 중인 플레이어
  mergeMode:false, idSeq:1, eSeq:1,
  gachaLuckLv:0, creditLv:0,   // 내실 업그레이드: 뽑기 확률↑ / 크레딧 획득↑
  pbossCds:{},                 // 개인 보스 소환 쿨다운(보스 id별 개별, 초 / 소환 시 240=4분)
  auto:{unit:false, combine:false, energy:false, pboss:{}},   // 자동화 on/off 토글(해금 업그레이드 보유 시에만 동작)
  citizen:{x:CITIZEN_HOME.x, y:CITIZEN_HOME.y, gx:null, gy:null, buyId:null}, // 유닛뽑기 시민(셀렉터)
}; }
let G=newGame();

// ============================================================================
// 캔버스 + 트랙
// ============================================================================
const DPR=Math.min(devicePixelRatio||1,2);
function setup(id, scale){ const cv=document.getElementById(id),p=cv.parentElement;
  const w=p.offsetWidth,h=p.offsetHeight;
  const eff=DPR*(scale!=null?scale:1);   // 렌더 배율 — 기본 네이티브(건설지·다른 화면). 직스 전장만 호출부에서 배율 전달
  const W=Math.max(1,Math.round(w*eff)), H=Math.max(1,Math.round(h*eff));
  const ctx=cv.getContext('2d');
  if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; }   // 크기 변할 때만 재할당
  else { ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height); }   // 같으면 클리어만(저비용)
  ctx.setTransform(eff,0,0,eff,0,0); return {ctx,W:w,H:h}; }
// SF 배경: 깊은 그라데이션 + 미세 격자(두 단계) + 코너 패널 마커 + 비네팅
function bg(ctx,W,H,c1,c2){ const g=ctx.createRadialGradient(W/2,H*0.42,0,W/2,H*0.42,Math.max(W,H)*0.85);
  g.addColorStop(0,c1);g.addColorStop(1,c2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // 미세 격자(촘촘) + 굵은 격자(드문드문)
  ctx.lineWidth=1;
  ctx.strokeStyle='rgba(74,168,255,.035)';
  for(let x=0;x<W;x+=22){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.strokeStyle='rgba(74,168,255,.07)';
  for(let x=0;x<W;x+=88){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=88){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  // 비네팅(가장자리 어둡게)
  const v=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.max(W,H)*0.72);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');ctx.fillStyle=v;ctx.fillRect(0,0,W,H); }
// 모서리 패널 마커(SF UI 코너 브래킷)
function rR(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
const BOARD_X_INSET=0.075;  // 좌우 여백 비율(작게 → 가로로 넓게)
const BOARD_AR=0.66;        // 보드 세로/가로 비율(<1 = 가로로 긴 직사각형)
let GW=0,GH=0; // 게임영역 픽셀 크기
const BOARD_Y_LIFT=0.08;   // 보드를 수직 중앙에서 위로(하단 시트 올라올 때 답답함 완화)
function geom(W,H){ const inset=W*BOARD_X_INSET, bw=W-inset*2, bh=bw*BOARD_AR, side=Math.min(bw,bh);
  return {inset, bw, bh, side, ox:(W-bw)/2, oy:(H-bh)/2 - H*BOARD_Y_LIFT}; }  // bw=가로(넓게), bh=세로(짧게), side=장식 기준(min)
// 유닛이 머물 수 있는 트랙 안쪽 영역(비율). 트랙선보다 조금 안쪽까지만 허용.
const UNIT_PAD=18; // 트랙선에서 안쪽 여유(px)
function innerBounds(){ if(typeof G!=='undefined' && G.sandbox) return { minX:0.04, maxX:0.96, minY:0.05, maxY:0.95 };   // 샌드박스: 보이는 땅 전체를 이동/배치 영역으로
  const {ox,oy,bw,bh}=geom(GW,GH); const pad=UNIT_PAD;
  return { minX:(ox+pad)/GW, maxX:(ox+bw-pad)/GW, minY:(oy+pad)/GH, maxY:(oy+bh-pad)/GH }; }
function clampInner(x,y){ const b=innerBounds();
  return { x:Math.max(b.minX,Math.min(b.maxX,x)), y:Math.max(b.minY,Math.min(b.maxY,y)) }; }
function trackCenter(){ const {ox,oy,bw,bh}=geom(GW,GH); return { x:(ox+bw/2)/GW, y:(oy+bh/2)/GH }; }
// ── 배경 타일(공간 배경 + 프로토스 바닥) — canvas createPattern 반복 ──
const TILE_SPACE=new Image(); TILE_SPACE.src='assets/tiles/space_bg.webp?v=3';
const TILE_INSTALL=new Image(); TILE_INSTALL.src='assets/tiles/installation.webp';  // 유닛뽑기 배경(시설 격납고 금속 바닥)
TILE_INSTALL.onload=()=>{ if(typeof G!=='undefined' && G.tab==='Unit') drawProd(); };  // 로드되면 뽑기 화면 다시 그림
const TILE_PLATFORM=new Image(); TILE_PLATFORM.src='assets/tiles/space_platform.webp?v=3';  // 우주 정거장 금속(업그레이드 플랫폼)
// 비콘 발판 이미지(원형 금속 패드, 네이비 배경 → 그릴 때 원형 클립으로 코너 제거)
// 합체 베이·유닛뽑기 슬롯 모두 동일한 합성 비콘 사용(진영 구분 없이 통일)
// 합성 비콘은 3D 모델(beacon_synthesis.glb)로 렌더 — M3D 씬에서 합체 베이·유닛 슬롯에 배치(아래 module)
const SPACE_TILE=380;  // 타일 한 칸 크기(px) — 원본 2048이라 줄여서 반복(별 반복감 완화)
// 지형 타일 — 바깥=badlands(흙) + 가장자리 ashworld(용암절벽)
const TILE_BAD=new Image(); TILE_BAD.src='assets/tiles/badlands.webp?v=3';
const TILE_ASH=new Image(); TILE_ASH.src='assets/tiles/ashworld.webp?v=3';
const BAD_TILE=300, ASH_TILE=260;   // 패턴 한 칸 크기(px)
// 결정적 해시(셀좌표→0..1) — 시드 기반 지형 변형용(고정, 깜빡임 없음)
function hsh(x,y,s){ const v=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453; return v-Math.floor(v); }
// 시드 노이즈 오버레이: 영역을 셀로 나눠 셀마다 어둡게/밝게 부드러운 블롭 → 단순 반복 깨기
function terrainNoise(ctx, x0,y0,w,h, cell, seed){
  const c0=Math.floor(x0/cell), c1=Math.ceil((x0+w)/cell), r0=Math.floor(y0/cell), r1=Math.ceil((y0+h)/cell);
  for(let cy=r0;cy<r1;cy++) for(let cx=c0;cx<c1;cx++){
    const rnd=hsh(cx,cy,seed), rnd2=hsh(cx,cy,seed+9.3);
    const px=cx*cell+rnd*cell, py=cy*cell+rnd2*cell, rr=cell*(0.5+rnd*0.7);
    const dark=rnd<0.55, a=(dark?0.32:0.13)*(0.4+rnd2*0.6);
    const g=ctx.createRadialGradient(px,py,0,px,py,rr);
    g.addColorStop(0, dark?`rgba(0,0,0,${a})`:`rgba(214,206,214,${a})`); g.addColorStop(1,'rgba(0,0,0,0)');  // 중립 라이트(흙·보라 둘다 OK)
    ctx.fillStyle=g; ctx.beginPath();ctx.arc(px,py,rr,0,6.28);ctx.fill();
  }
}
// ── 정적 지형 바닥: 오프스크린에 1회 그려 매 프레임 재사용(캐시). 동적 요소(적·이펙트)는 위에 따로 ──
// 구조: 바깥=우주(space_bg) / 안쪽 플랫폼=지형(badlands)이 우주에 떠 있고 테두리는 용암 절벽(ashworld)
let _floorCv=null,_floorCtx=null,_floorW=0,_floorH=0,_floorReady=false;
function tilesReady(){ return [TILE_BAD,TILE_ASH,TILE_SPACE].every(t=>t.complete&&t.naturalWidth); }
function mkPat(ctx,img,tile){ const p=ctx.createPattern(img,'repeat'); if(p&&p.setTransform){const s=tile/img.naturalWidth;p.setTransform(new DOMMatrix([s,0,0,s,0,0]));} return p; }
// 깊은 우주 비네팅 + 은은한 성운 — 별 타일 반복감을 줄이고 가장자리를 어둡게
function spaceVignette(ctx,W,H){
  const g=ctx.createRadialGradient(W/2,H*0.5,Math.min(W,H)*0.12, W/2,H*0.5,Math.max(W,H)*0.72);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(2,3,12,.8)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const neb=[[0.2,0.26,'rgba(40,70,140,.06)'],[0.8,0.2,'rgba(120,50,130,.05)'],[0.72,0.82,'rgba(40,90,120,.05)']];
  for(const[fx,fy,col]of neb){ const cx=fx*W,cy=fy*H,rr=Math.min(W,H)*0.5, ng=ctx.createRadialGradient(cx,cy,0,cx,cy,rr);
    ng.addColorStop(0,col); ng.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=ng; ctx.fillRect(0,0,W,H); }
  ctx.restore();
}
function buildFloor(W,H){ if(!tilesReady()) return false;
  if(!_floorCv){_floorCv=document.createElement('canvas');_floorCtx=_floorCv.getContext('2d');}
  _floorCv.width=Math.round(W*DPR);_floorCv.height=Math.round(H*DPR); const ec=_floorCtx; ec.setTransform(DPR,0,0,DPR,0,0); ec.clearRect(0,0,W,H);
  const {bw,bh,side,ox,oy}=geom(W,H), R=18, lw=Math.max(11,side*0.05), Ri=Math.max(4,R-lw*0.5); // R=모서리반경, lw=용암절벽 두께, Ri=안쪽 반경
  // ── 바깥 = 우주 ──
  ec.fillStyle=mkPat(ec,TILE_SPACE,SPACE_TILE)||'#05060d'; ec.fillRect(0,0,W,H);
  spaceVignette(ec,W,H);
  // ── 안쪽 플랫폼 바닥 = 지형(badlands, 유닛들이 서 있는 공간) ──
  ec.save(); ec.beginPath(); rRpath(ec,ox,oy,bw,bh,R); ec.clip();
  ec.fillStyle=mkPat(ec,TILE_BAD,BAD_TILE)||'#1c1812'; ec.fillRect(ox,oy,bw,bh);
  terrainNoise(ec,ox,oy,bw,bh,70,3.0);                                    // 시드 변형(반복 깨기)
  // 플랫폼 중앙 살짝 밝게(빛 받는 느낌)
  const lg=ec.createRadialGradient(ox+bw/2,oy+bh/2,0,ox+bw/2,oy+bh/2,Math.max(bw,bh)*0.55);
  lg.addColorStop(0,'rgba(150,130,110,.1)'); lg.addColorStop(1,'rgba(0,0,0,0)'); ec.fillStyle=lg; ec.fillRect(ox,oy,bw,bh);
  ec.restore();
  // ── 플랫폼 테두리 = 용암 절벽(라운드 사각 프레임 → 4모서리 자연 처리) ──
  ec.save(); ec.beginPath();
  rRpath(ec,ox,oy,bw,bh,R);                       // 바깥 라운드 사각
  rRpath(ec,ox+lw,oy+lw,bw-2*lw,bh-2*lw,Ri);      // 안쪽 라운드 사각
  ec.clip('evenodd');                                 // 두 사각 사이 = 테두리 링만
  ec.fillStyle=mkPat(ec,TILE_ASH,ASH_TILE)||'#2a0d08'; ec.fillRect(ox,oy,bw,bh);
  terrainNoise(ec,ox,oy,bw,bh,42,5.0);
  ec.restore();
  // ── 절벽 입체감: 안쪽 면 드롭섀도(아래로 떨어지는 절벽) ──
  ec.save(); ec.beginPath(); rRpath(ec,ox+lw,oy+lw,bw-2*lw,bh-2*lw,Ri);
  ec.lineWidth=lw*0.4; ec.strokeStyle='rgba(0,0,0,.45)'; ec.stroke();        // 절벽 그림자
  ec.restore();
  return true;
}
const RECALL_DUR=0.95; // 몬스터 출현(아비터 리콜식) 이펙트 지속(초) — 에너지가 모였다 출현
const AIR_HIT_OFF=24;  // 공중 유닛(부유) 피격 이펙트를 위로 올리는 보정(px)
const HIT_R=12;        // 유도 발사체 명중 판정 반경(px)
const MUZZLE_FWD=22;   // 총 든 유닛 총구 위치: 유닛 중앙에서 전방(px)
const MUZZLE_SIDE=7;   // 오른손 쪽 측면 오프셋(px)
const TOP_MUZZLE={turret:true, photon:true};  // 상단 포드 발사 구조물(미사일/플라즈마가 위쪽 발사구에서)
const BODY_MUZZLE={dragoon:true};  // 몸 안쪽(코어)에서 발사하는 유닛 — 회전 안 하므로 중앙에서 발사
const BODY_MUZZLE_UP=16;  // 코어 발사 높이(발 기준 위로, 몸통 중심)
const SHOULDER_MUZZLE={goliath:true};  // 어깨 미사일 포드에서 발사(골리앗) — 발사 연기 동반
const SHOULDER_UP=28;     // 어깨 포드 높이(발 기준 위로, px)
const SHOULDER_SIDE=12;   // 좌우 어깨 간격(px) — 방향 무관 고정(양 어깨에서 발사)
const LAUNCHER_UP=28;  // 상단 포드 발사구 높이(px) — 포드 개구부(앞·위)
const LAUNCHER_FWD=16; // 상단 포드 발사구 전방 오프셋(px)
const PHOTON_ORB_UP=34; // 포토케논 동그란 수정(에너지 충전·발사) 높이(px) — 모델 축소에 맞춰 더 낮춰 수정에서 발사되게
const HYDRA_MOUTH_UP=30; // 히드라 침 발사 높이(발 기준 위로, px) — 얼굴/머리 쪽에서 뱉도록
// #rrggbb + 알파 → rgba 문자열(그라데이션용)
function hexA(h,a){ const n=parseInt(h.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
// 총구 스파크 생성(총구 위치 mx,my에서 전방 nx,ny 콘 형태로 튀는 불꽃)
function spawnSparks(mx,my,nx,ny,col){
  const n=5+Math.floor(Math.random()*3);
  for(let i=0;i<n;i++){ const sp=Math.random()*0.9-0.45, ca=Math.cos(sp), sa=Math.sin(sp);
    const dx=nx*ca-ny*sa, dy=nx*sa+ny*ca, spd=140+Math.random()*200;
    G.sparks.push({x:mx,y:my,vx:dx*spd,vy:dy*spd,life:1,len:3+Math.random()*5,color:i%3?'#fff2a0':'#ffd060'}); }
  G.sparks.push({x:mx,y:my,vx:0,vy:0,life:1,flash:true,color:'#fff7c8'}); // 중심 작은 섬광
}
// 발사 연기(어깨 포드 발사 시) — 부드러운 회색 구름(glow) + 위로 피어오르는 연기 입자
function spawnSmoke(mx,my,nx,ny){
  for(let k=0;k<3;k++){ const ang=Math.atan2(ny,nx)+Math.PI+(Math.random()-0.5)*1.1, sp=14+Math.random()*26;
    const sh=k%2; // 짙은 코어 + 옅은 가장자리 두 톤
    G.sparks.push({x:mx+(Math.random()-0.5)*5,y:my+(Math.random()-0.5)*4,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-34,life:0.8,smoke:true,r0:3+Math.random()*2.5,color:sh?'#5a5a66':'#787884',dk:2.4,fr:0.95}); } // 모델 위로 높이 피어오름(옅게)짙은 회색 연기(추가 축소)
}
// 둘레거리 d(0~1) → 픽셀좌표
function posAt(d,W,H){ const {bw,bh,ox,oy}=geom(W,H); const t=((d%1)+1)%1,total=2*(bw+bh); let dist=t*total;
  if(dist<bw)return{x:ox+dist,y:oy}; dist-=bw;
  if(dist<bh)return{x:ox+bw,y:oy+dist}; dist-=bh;
  if(dist<bw)return{x:ox+bw-dist,y:oy+bh}; dist-=bw;
  return{x:ox,y:oy+bh-dist}; }
// 합체존 = 안쪽 사각의 우하단 구석 지정 구역(사각 베이)
const MZ_FRAC=0.30;     // 합체존 한 변 = 안쪽 사각 변 대비 비율
function mergeRect(W,H){ const {ox,oy,bw,bh,side}=geom(W,H); const z=side*MZ_FRAC;
  const lw=Math.max(11,side*0.05);   // 용암 테두리 두께(buildFloor와 동일) — 안쪽 타일 경계 기준
  return { x:ox+bw-lw-z, y:oy+bh-lw-z, w:z, h:z }; }   // 외곽을 안쪽 타일 경계(용암 안쪽 모서리)에 딱 맞춤
function zoneCenter(){ const r=mergeRect(GW,GH); return { x:(r.x+r.w/2)/GW, y:(r.y+r.h/2)/GH }; }

// 적 형상 그리기 — 자체 제작 네온 벡터 도형. shape: orb/blob/jet/ship/capital
function drawEnemyShape(ctx,x,y,r,shape,color,t,ph){
  ctx.save(); ctx.translate(x,y);
  ctx.lineJoin='round'; ctx.lineCap='round';
  const stroke=(w,c,a)=>{ ctx.globalAlpha=a==null?1:a; ctx.strokeStyle=c; ctx.lineWidth=w; ctx.stroke(); };
  const fillP=(c,a)=>{ ctx.globalAlpha=a==null?1:a; ctx.fillStyle=c; ctx.fill(); };
  switch(shape){
    case 'orb': { // 정찰 구체 — 코어 + 회전 링
      ctx.beginPath();ctx.arc(0,0,r*0.6,0,6.28);fillP(color,.85);
      ctx.beginPath();ctx.arc(0,0,r*0.6,0,6.28);stroke(1.6,'#fff',.9);
      ctx.save();ctx.rotate(t*1.6+ph);ctx.scale(1,0.4);
      ctx.beginPath();ctx.arc(0,0,r*1.05,0,6.28);stroke(1.4,color,.7);ctx.restore();
      break; }
    case 'blob': { // 유기체 — 꿈틀거리는 둥근 몸체 + 촉수
      ctx.beginPath(); const seg=10;
      for(let i=0;i<=seg;i++){ const a=6.283*i/seg; const wob=1+0.16*Math.sin(a*3+t*4+ph); const rr=r*0.85*wob;
        const px=Math.cos(a)*rr, py=Math.sin(a)*rr*0.92; i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
      ctx.closePath(); fillP(color,.55); ctx.beginPath();
      for(let i=0;i<=seg;i++){ const a=6.283*i/seg; const wob=1+0.16*Math.sin(a*3+t*4+ph); const rr=r*0.85*wob;
        const px=Math.cos(a)*rr, py=Math.sin(a)*rr*0.92; i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
      ctx.closePath(); stroke(1.6,'#fff',.85);
      ctx.beginPath();ctx.arc(0,0,r*0.28,0,6.28);fillP('#fff',.8); break; }
    case 'jet': { // 비행기 — 전진 화살 + 후퇴익
      ctx.beginPath();ctx.moveTo(r*1.1,0);ctx.lineTo(-r*0.5,r*0.85);ctx.lineTo(-r*0.15,0);ctx.lineTo(-r*0.5,-r*0.85);ctx.closePath();
      fillP(color,.7); stroke(1.6,'#fff',.9);
      ctx.beginPath();ctx.moveTo(-r*0.15,0);ctx.lineTo(-r*0.9,0);stroke(1.4,color,.8); break; }
    case 'ship': { // 수송정 — 둥근 모서리 선체 + 측면 엔진
      ctx.beginPath(); rRpath(ctx,-r*0.95,-r*0.6,r*1.9,r*1.2,r*0.4);
      fillP(color,.6); ctx.beginPath(); rRpath(ctx,-r*0.95,-r*0.6,r*1.9,r*1.2,r*0.4); stroke(1.8,'#fff',.85);
      ctx.beginPath();ctx.arc(-r*0.55,0,r*0.18,0,6.28);ctx.arc(r*0.55,0,r*0.18,0,6.28);fillP('#fff',.9); break; }
    case 'capital': { // 대형 전함 — 육각 코어 + 외곽 무장 + 펄스
      const pls=1+0.08*Math.sin(t*5+ph);
      ctx.beginPath(); for(let i=0;i<6;i++){ const a=6.283*i/6+0.52; const px=Math.cos(a)*r*1.05*pls,py=Math.sin(a)*r*1.05*pls; i?ctx.lineTo(px,py):ctx.moveTo(px,py);} ctx.closePath();
      fillP(color,.5); ctx.beginPath(); for(let i=0;i<6;i++){ const a=6.283*i/6+0.52; const px=Math.cos(a)*r*1.05*pls,py=Math.sin(a)*r*1.05*pls; i?ctx.lineTo(px,py):ctx.moveTo(px,py);} ctx.closePath(); stroke(2.2,'#fff',.9);
      ctx.beginPath();ctx.moveTo(-r*0.9,0);ctx.lineTo(r*0.9,0);stroke(1.4,'#fff',.6);
      ctx.beginPath();ctx.arc(0,0,r*0.3,0,6.28);fillP('#fff',.85); break; }
    default: { ctx.beginPath();ctx.arc(0,0,r*0.6,0,6.28);fillP(color,.8);stroke(1.6,'#fff',.9); }
  }
  ctx.globalAlpha=1; ctx.restore();
}
function rRpath(ctx,x,y,w,h,r){ ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
// 고정 구조물 자리 표시: 채워진 자리=실선 링, 빈 자리=점선 링(그 위에 무채색 고스트 모델이 섬 → 비활성 느낌)
function drawFixedSlots(ctx,W,H){
  for(const id of FIXED_IDS){ const slots=FIXED_SLOTS[id]; const used=G.units.filter(u=>u.id===id).length;
    const col=id==='turret'?'90,170,230':'98,208,255'; const rr=Math.min(W,H)*0.026;
    slots.forEach((p,i)=>{ const x=p.x*W, y=p.y*H, locked=i>=used;
      ctx.save();
      ctx.strokeStyle='rgba('+col+','+(locked?.28:.55)+')'; ctx.lineWidth=1.5; ctx.setLineDash(locked?[3,4]:[]);
      ctx.beginPath(); ctx.arc(x,y,rr,0,6.28); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    });
  }
}
// 스폰 포탈(닫힌 상태 — 차원문이 '열리기 전' 어두운 장치 느낌): 어두운 보이드 + 천천히 도는 림/소용돌이
function drawSpawnPortal(ctx,ox,oy){ const t=(typeof G!=='undefined'?G.timeSec:0)||0, pr=12, breathe=0.5+0.5*Math.sin(t*1.5);
  ctx.save();
  // 어두운 보이드(노멀 블렌딩 — 가운데가 빨려드는 어둠)
  ctx.globalCompositeOperation='source-over';
  const gv=ctx.createRadialGradient(ox,oy,0,ox,oy,pr);
  gv.addColorStop(0,'rgba(14,2,6,0.92)'); gv.addColorStop(0.65,'rgba(34,5,12,0.6)'); gv.addColorStop(1,'rgba(34,5,12,0)');
  ctx.fillStyle=gv; ctx.beginPath();ctx.arc(ox,oy,pr,0,6.28);ctx.fill();
  // 발광 요소(가산 블렌딩)
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=0.32+0.22*breathe; ctx.strokeStyle='rgba(255,64,86,1)'; ctx.lineWidth=1.8;   // 림 글로우(은은한 호흡)
  ctx.beginPath();ctx.arc(ox,oy,pr-1.5,0,6.28);ctx.stroke();
  for(let k=0;k<2;k++){ const a0=t*(0.9+k*0.5)+k*3.1;                                            // 안쪽 회전 호(소용돌이)
    ctx.globalAlpha=0.22; ctx.strokeStyle='rgba(255,96,118,1)'; ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(ox,oy,pr*0.45+k*3.2, a0, a0+2.0);ctx.stroke(); }
  ctx.globalAlpha=0.35+0.25*breathe; ctx.fillStyle='rgba(255,120,135,1)';                       // 중심 코어(약한 맥동)
  ctx.beginPath();ctx.arc(ox,oy,1.8,0,6.28);ctx.fill();
  ctx.restore();
}
// 몬스터 출현(아비터 리콜식): 바깥에서 에너지/연기가 나선으로 모여들었다가 빛이 터지며 출현
function drawRecallSpawn(ctx,ox,oy,rc){ const life=Math.max(0,rc.life), p=1-life;   // p:0(시작)→1(출현)
  const boss=rc.boss, col=boss?'255,120,40':(rc.special?'255,205,90':'210,46,74');
  const gather=Math.min(1,p/0.62);             // 0→1: 에너지 모임
  const flash=Math.max(0,(p-0.6)/0.4);         // 후반 개방 플래시
  ctx.save(); ctx.globalCompositeOperation='lighter';
  // 모여드는 연기/에너지(바깥→중심 나선)
  const N=boss?18:12, maxR=boss?36:26;
  for(let k=0;k<N;k++){ const a=k/N*6.283 + p*3.4 + (k%3)*0.7;
    const rr=(1-gather)*maxR+3;
    const px=ox+Math.cos(a)*rr, py=oy+Math.sin(a)*rr*0.82;
    const sz=(3.4+gather*3.4)*(boss?1.5:1)*(0.55+life*0.45);
    ctx.globalAlpha=life*0.6*(0.4+gather*0.6);
    const gp=ctx.createRadialGradient(px,py,0,px,py,sz);
    gp.addColorStop(0,'rgba('+col+',0.9)'); gp.addColorStop(0.55,'rgba('+col+',0.4)'); gp.addColorStop(1,'rgba('+col+',0)');   // 부드러운 연기 덩어리
    ctx.fillStyle=gp; ctx.beginPath();ctx.arc(px,py,sz,0,6.28);ctx.fill(); }
  // 중심 응축 글로우(모일수록 커짐)
  const cr=3+gather*(boss?13:9); ctx.globalAlpha=life*0.75*gather;
  const gg=ctx.createRadialGradient(ox,oy,0,ox,oy,cr);
  gg.addColorStop(0,'rgba(255,235,238,'+(0.85*life)+')'); gg.addColorStop(0.5,'rgba('+col+','+(0.5*life)+')'); gg.addColorStop(1,'rgba('+col+',0)');
  ctx.fillStyle=gg; ctx.beginPath();ctx.arc(ox,oy,cr,0,6.28);ctx.fill();
  // 개방 플래시 + 퍼지는 링(출현 순간)
  if(flash>0){ ctx.globalAlpha=(1-flash)*life*0.95; ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(ox,oy,2+flash*4,0,6.28);ctx.fill();
    ctx.globalAlpha=(1-flash)*0.55; ctx.strokeStyle='rgba('+col+',1)'; ctx.lineWidth=2.2;
    ctx.beginPath();ctx.arc(ox,oy,6+flash*(boss?26:17),0,6.28);ctx.stroke(); }
  ctx.restore();
}
// 이펙트 레벨: 'full'(기본)=전부 / 'min'=발사체만 / 'off'=전부 제거
function fxLevel(){ return (typeof G!=='undefined'&&G.opt&&G.opt.fx)||'full'; }
function fxLite(){ return fxLevel()!=='full'; }   // min·off → 빔/타격/스파크/연기/총구/충전/가동파티클 생략
function fxOff(){ return fxLevel()==='off'; }      // off → 발사체까지 제거
function drawMain(cvId){ const {ctx,W,H}=setup(cvId||'cvMain');
  // 🛡 숨겨진 캔버스(0×0)에는 그리지 않는다. buildFloor 가 0크기 캔버스를 만들어 두면
  //    다음 줄의 drawImage 가 InvalidStateError 를 던진다 — 화면에 안 보이는 채로 예외만 쌓인다.
  //    다른 뷰(건설 등)가 켜져 있어 #cvMain 이 접혀 있을 때 실제로 그랬다.
  //    ⚠ GW/GH 도 이때는 갱신하지 않는다 — 0 이 새면 좌표 계산이 통째로 망가진다.
  if(!W || !H) return;
  GW=W;GH=H;
  if(typeof G!=='undefined' && G.sandbox){ const _va=viewApply(ctx,W,H); if(G.tab==='Battle') drawBattleGround(ctx,W,H); else drawSandboxGround(ctx,W,H); viewRestore(ctx,_va); return; }
  const _vapply=viewApply(ctx,W,H);   // 화면 줌/팬 변환 시작(기본 뷰면 미적용)
  const {side,ox,oy}=geom(W,H); const R=10;
  // 정적 지형 바닥(우주 배경 + 떠 있는 지형 플랫폼 + 용암 절벽 테두리) — 캐시에서 1회 빌드 후 매 프레임 재사용
  if(_floorW!==W||_floorH!==H||!_floorReady){ _floorReady=buildFloor(W,H); _floorW=W;_floorH=H; }
  if(_floorReady) ctx.drawImage(_floorCv,0,0,W,H);
  else bg(ctx,W,H,'#0a0c16','#03040a');   // 타일 로딩 전 폴백(우주)
  drawBeacon(ctx,W,H);      // 합체 베이 비콘 발판(바닥, 유닛 아래)
  drawFixedSlots(ctx,W,H);  // 고정 구조물 자리(빈칸=잠금)
  // ── 스폰 포탈(닫힌 장치 — '열리기 전' 느낌의 어두운 차원문) ──
  drawSpawnPortal(ctx,ox,oy);
  // ── 몬스터 스폰: 아비터 리콜식(에너지/연기가 소용돌이로 모였다가 유닛 출현) ──
  for(const rc of G.recalls){ drawRecallSpawn(ctx,ox,oy,rc); }
  // ── 공격 이펙트(가산 합성으로 발광) ── (저화질/절전 시 생략: 빔/타격/스파크/파편/리콜/연기)
  if(!fxLite()){
  ctx.save(); ctx.globalCompositeOperation='lighter';
  // 빔(유닛색·굵기)
  for(const b of G.beams){ const col=b.color||'#9be7ff', a=Math.max(0,b.life);
    ctx.globalAlpha=a; ctx.strokeStyle=col; ctx.lineWidth=(b.w||2)+2.5; ctx.globalAlpha=a*0.35;
    ctx.beginPath();ctx.moveTo(b.x1,b.y1);ctx.lineTo(b.x2,b.y2);ctx.stroke(); // 외곽 글로우
    ctx.globalAlpha=a; ctx.lineWidth=(b.w||2); ctx.beginPath();ctx.moveTo(b.x1,b.y1);ctx.lineTo(b.x2,b.y2);ctx.stroke(); }
  // 투사체는 3D 모델 위(별도 오버레이 캔버스 #cvFx)에서 그림 — drawFx()
  // 타격/폭발
  for(const m of G.impacts){ const a=Math.max(0,m.life), rr=m.r*(1.2-a*0.5);
    if(m.slash){ // 낫 베기 — 호가 휘두르며 지나가는 잔상(선두 밝게)
      const prog=1-a, half=1.15, a0=m.ang-half+prog*2*half, span=0.9;
      ctx.lineCap='round';
      ctx.globalAlpha=a*0.85; ctx.strokeStyle=m.color; ctx.lineWidth=4*a+1;
      ctx.beginPath(); ctx.arc(m.x,m.y,m.r,a0-span,a0); ctx.stroke();          // 베기 잔상 호
      ctx.globalAlpha=a; ctx.strokeStyle='#f2ffe0'; ctx.lineWidth=1.6*a+0.5;
      ctx.beginPath(); ctx.arc(m.x,m.y,m.r,a0-span*0.45,a0); ctx.stroke();      // 밝은 날 선두
      ctx.lineCap='butt'; continue; }
    if(m.glow){ const g=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,rr);  // 소프트 그라데이션 폭발(중심 밝고 가장자리 페이드)
      g.addColorStop(0,hexA(m.color,a*0.55)); g.addColorStop(0.45,hexA(m.color,a*0.22)); g.addColorStop(1,hexA(m.color,0));
      ctx.globalAlpha=1; ctx.fillStyle=g; ctx.beginPath();ctx.arc(m.x,m.y,rr,0,6.28);ctx.fill(); continue; }
    ctx.globalAlpha=a*0.8; ctx.fillStyle=m.color;
    if(m.ring){ ctx.globalAlpha=a; ctx.strokeStyle=m.color; ctx.lineWidth=2.5; ctx.beginPath();
      if(m.ell) ctx.ellipse(m.x,m.y,rr,rr*0.45,0,0,6.28); else ctx.arc(m.x,m.y,rr,0,6.28);   // ell=바닥 데칼(원근 타원)
      ctx.stroke(); }
    else { ctx.beginPath();ctx.arc(m.x,m.y,rr*0.5,0,6.28);ctx.fill(); } }
  // 총구 섬광은 drawFx(#cvFx, 모델 위)에서 — 거치무기(터렛/포토) 발사구가 모델에 안 가리도록
  // 총구 스파크(총기 유닛: 불꽃 튐)
  for(const s of G.sparks){ const a=Math.max(0,s.life); ctx.globalAlpha=a;
    if(s.smoke){ continue; }  // 연기는 가산합성 밖에서 노멀 블렌딩으로(짙은 회색) 따로 그림
    else if(s.flash){ ctx.fillStyle=s.color; ctx.beginPath();ctx.arc(s.x,s.y,2.4*a+0.6,0,6.28);ctx.fill(); }
    else { const m=Math.hypot(s.vx,s.vy)||1, ex=s.vx/m, ey=s.vy/m; ctx.strokeStyle=s.color; ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x-ex*s.len, s.y-ey*s.len);ctx.stroke(); } }
  // 사망 파편(발광 조각)
  for(const f of G.debris){ const a=Math.max(0,f.life); ctx.globalAlpha=a; ctx.strokeStyle=f.color; ctx.lineWidth=1.8;
    ctx.save(); ctx.translate(f.x,f.y); ctx.rotate(f.rot); ctx.beginPath(); ctx.moveTo(-f.len,0); ctx.lineTo(f.len,0); ctx.stroke(); ctx.restore(); }
  // (포토케논 에너지 충전·유닛 소환 워프인은 drawFx에서 — 3D 모델 위에 보이도록)
  ctx.restore();
  // 발사 연기(노멀 블렌딩 — 짙은 회색 구름이 피어오르며 커짐)
  for(const s of G.sparks){ if(!s.smoke) continue; const a=Math.max(0,s.life);
    ctx.globalAlpha=a*0.38; ctx.fillStyle=s.color; const rr=(s.r0||4)*(1+(1-a)*2.6);
    ctx.beginPath();ctx.arc(s.x,s.y,rr,0,6.28);ctx.fill(); }
  ctx.globalAlpha=1;
  } // /fxLite — 전투 이펙트 생략
  // 적(형상별 네온 도형) + 체력/쉴드 바
  const T=G.timeSec;
  for(const e of G.enemies){ const p=posAt(e.d,W,H);
    e._fogHidden=fogEnabled()&&fogVisAt(p.x/W,p.y/H)!==2; if(e._fogHidden) continue;   // 🌫️ 활성 시야 밖 적 숨김(2D 도형·HP바) — 3D는 M3D.sync가 같은 플래그로 숨김
    const base=e.boss?11:8;
    const punch=1+(e.hit||0)*0.35; const r=base*punch; // 피격 시 순간 확대
    const col=e.special?'#ffd24a':(e.boss?COL.boss:COL.enemy);   // 스페셜=금색
    if(!e.model3d){  // 2D 네온 적(3D 모델 적은 WebGL이 렌더 → 도형 생략)
      if(e.maxSh>0 && e.sh>0){ ctx.save(); ctx.globalCompositeOperation='lighter';   // 실드 피격 막
        ctx.globalAlpha=0.25+0.6*(e.shHit||0); ctx.strokeStyle='#5ad1ff'; ctx.lineWidth=1.6;
        ctx.beginPath();ctx.arc(p.x,p.y,r*1.45,0,6.28);ctx.stroke(); ctx.restore(); }
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=0.5; drawEnemyShape(ctx,p.x,p.y,r*1.25,e.shape,col,T,e.ph||0); ctx.restore(); // 외곽 글로우
      drawEnemyShape(ctx,p.x,p.y,r,e.shape, e.flash>0?'#fff':col, T, e.ph||0);
      if(e.flash>0){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=e.flash/4*0.7;
        ctx.fillStyle='#fff'; ctx.beginPath();ctx.arc(p.x,p.y,r*0.9,0,6.28);ctx.fill(); ctx.restore(); }
    }
    // 체력/실드 바: 평소 숨김 → 선택된 적만 표시
    if(G.selEnemy===e.eid){
      const bw=base*2.6; const hpR=Math.max(0,e.hp/e.maxHp), shR=e.maxSh>0?Math.max(0,e.sh/e.maxSh):0;
      const by=p.y-(e.model3d?46:base+8); ctx.globalAlpha=1;
      ctx.fillStyle='#222a36';ctx.fillRect(p.x-bw/2,by,bw,3);
      ctx.fillStyle=hpR>.4?'#46f06a':'#ff5c5c';ctx.fillRect(p.x-bw/2,by,bw*hpR,3);
      if(e.maxSh>0){ ctx.fillStyle='#13314a';ctx.fillRect(p.x-bw/2,by-4,bw,2.5);
        ctx.fillStyle='#5ad1ff';ctx.fillRect(p.x-bw/2,by-4,bw*shR,2.5); }
    }
  }
  if(G.opt&&G.opt.model3d===false) drawUnits2D(ctx,W,H);   // 3D 끈 경우(저화질/절전) 2D 마커로 유닛 표시
  if(fogEnabled()) drawFog(ctx,W,H);   // 🌫️ 전장의 안개 오버레이(지형·2D 이펙트 위, 유닛/줌 변환 안쪽)
  viewRestore(ctx,_vapply);   // 화면 줌/팬 변환 종료
}
// 3D 오버레이 OFF일 때 캔버스에 직접 그리는 유닛/적 2D 마커(저사양·절전용)
function drawUnits2D(ctx,W,H){ ctx.save();
  const pcol=PLAYER_VIEW_COLORS[(((G.tab==='Players'?G.curPlayer:(G.myPlayer||1))-1))%PLAYER_VIEW_COLORS.length];   // 플레이어 색(테두리)
  for(const u of G.units){ const def=U[u.id]; if(!def) continue; const x=u.x*W, y=u.y*H, col=def.color||'#7fdcff', r=u.hero?7:5.5;
    ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=.32; ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(x,y,r*1.7,0,6.28); ctx.fill();
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,r,0,6.28); ctx.fill();
    ctx.strokeStyle=pcol; ctx.lineWidth=1.7; ctx.beginPath(); ctx.arc(x,y,r+0.7,0,6.28); ctx.stroke();   // 플레이어색 테두리
    if(u.hero){ ctx.fillStyle='#fff5b0'; ctx.beginPath(); ctx.arc(x,y-r-3,2,0,6.28); ctx.fill(); }
    if(G.sel&&G.sel.indexOf(u.uid)>=0){ ctx.strokeStyle='#cfeaff'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.ellipse(x,y+r*0.4,r*1.5,r*0.7,0,0,6.28); ctx.stroke(); } }
  for(const e of G.enemies){ if(!e.model3d) continue; const p=posAt(e.d,W,H), col=e.boss?COL.boss:COL.enemy, r=e.boss?10:7;
    ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=.4; ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(p.x,p.y,r*1.6,0,6.28); ctx.fill();
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
    ctx.fillStyle=e.flash>0?'#fff':col; ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=1.3;
    ctx.beginPath(); ctx.arc(p.x,p.y,r,0,6.28); ctx.fill(); ctx.stroke(); }
  ctx.restore(); }
// 발광 원형 착륙 패드(심플). active=시민이 올라선/향하는 패드(밝게)
function drawPad(ctx,cx,cy,rx,active){
  const ry=rx*0.5; const col=active?'130,225,255':'74,168,255';
  const g=ctx.createRadialGradient(cx,cy,2,cx,cy,rx);
  g.addColorStop(0,'rgba(40,100,160,'+(active?0.55:0.32)+')'); g.addColorStop(1,'rgba(8,20,38,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,6.28); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle='rgba('+col+','+(active?1:.8)+')'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,6.28); ctx.stroke();
  ctx.restore();
}
// 유닛뽑기 배경 = 시설 격납고 금속 바닥(installation 타일) + 어둡게/비네팅(유닛·비콘 돋보이게)
// 시설 금속 바닥(installation) + 틴트/비네팅/조명 — 유닛뽑기·업그레이드 공용. tint/light로 톤 구분
function drawFacilityFloor(ctx,W,H,tint,light,tileImg){
  const img=tileImg||TILE_INSTALL;
  if(img.complete && img.naturalWidth){
    const tile=210, p=ctx.createPattern(img,'repeat');
    if(p&&p.setTransform){ const s=tile/img.naturalWidth; p.setTransform(new DOMMatrix([s,0,0,s,0,0])); }
    ctx.fillStyle=p||'#0a1820'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=tint||'rgba(4,11,19,.62)'; ctx.fillRect(0,0,W,H);            // 톤 틴트(전체 어둡게)
    const v=ctx.createRadialGradient(W/2,H*0.42,Math.min(W,H)*0.22,W/2,H*0.5,Math.max(W,H)*0.7);
    v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.78)');   // 비네팅(가장자리 어둡게)
    ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
    ctx.save(); ctx.globalCompositeOperation='lighter';                       // 상단 은은한 시설 조명
    const lt=ctx.createLinearGradient(0,0,0,H*0.5); lt.addColorStop(0,light||'rgba(80,150,210,.06)'); lt.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=lt; ctx.fillRect(0,0,W,H*0.5); ctx.restore();
  } else { bg(ctx,W,H,'#0a1820','#050c14'); }
}
function drawShopBg(ctx,W,H){ drawFacilityFloor(ctx,W,H); drawBeaconPads(ctx,W,H); }   // 유닛뽑기(차가운 톤) + 비콘 바닥 패드
// 비콘 발밑 금속 플랫폼 + 중앙 시민 대기 구역 — 비콘이 공간에 '놓여' 보이게
function drawBeaconPads(ctx,W,H){
  for(const b of DRAW_BEACONS){ const x=b.x*W, y=b.y*H+6, big=!!beaconBadge(b.id);
    const r=big?40:32;
    const g=ctx.createRadialGradient(x,y,r*0.2,x,y,r);
    g.addColorStop(0,'rgba(30,33,40,.92)'); g.addColorStop(.8,'rgba(16,18,24,.94)'); g.addColorStop(1,'rgba(8,9,13,.96)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(x,y,r,r*0.6,0,0,6.283); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(x,y,r*0.68,r*0.6*0.68,0,0,6.283); ctx.stroke();   // 테두리는 DOM 네온 링이 담당
  }
  const cx=CITIZEN_HOME.x*W, cy=CITIZEN_HOME.y*H+5;   // 시민 대기 구역(점선 링)
  ctx.save(); ctx.setLineDash([5,5]); ctx.strokeStyle='rgba(120,170,220,.16)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.ellipse(cx,cy,26,15,0,0,6.283); ctx.stroke(); ctx.restore();
}
function drawProd(){ const {ctx,W,H}=setup('cvUnit'); drawShopBg(ctx,W,H);
  GW=W;GH=H; const rx=Math.min(W,H)*0.11;
  // 뽑기 비콘: 3D가 준비되면 M3D가 렌더, 아니면 글로우 패드 폴백
  const m3dOff=(G.opt&&G.opt.model3d===false);
  const b3d=window.M3D && M3D.beaconReady && M3D.beaconReady() && !m3dOff;
  if(!b3d) DRAW_BEACONS.forEach(b=>drawPad(ctx, b.x*W, b.y*H, rx, G.citizen.onPad===b.id));   // 3D 미준비 시 2D 패드
}
// 업그레이드 플랫폼 — 통일 타일(우주 정거장 금속) 라운드 사각, 우주에 떠 있는 느낌
// (삭제) 업그레이드 가동 파티클(UPG_EMIT/drawUpgFx) — 건물 화면 폐지로 제거.
// ══ 화면이 꺼져 있던 시간 — 따라잡기 / 판 포기 ═══════════════════════
// loop() 의 dt 는 100ms 로 잘려 있다. 그래서 탭이 숨겨져 있던 동안 게임 시간은 흐르지 않고
// 돌아오면 그 자리에서 이어졌다. 이제는 **그 시간을 실제로 돌린다** — 그동안 명령을 못 냈으니
// 적이 쌓인 채로 이어받는다(실측: 30초치 ≈ 1,800스텝 ≈ 0.2초).
// AWAY_MS(30초)를 넘기면 실수가 아니라 의도적 이탈로 본다 — 보상도 기록도 없이 로비로.
//   ⚠ 이 한계는 상대가 내 자리를 잡아 두는 시간(killSlot 대기)과 **같은 값**이어야 한다.
let _hiddenAt=0;
function nemoRunning(){ return !!(typeof G!=='undefined' && G && G.phase==='playing' && !G.sandbox && !G.strike); }
function nemoOnHide(){ if(!nemoRunning()) return; _hiddenAt=Date.now(); saveRun(); }   // 탭이 죽을 수도 있다 — 숨는 순간 판을 저장한다
function nemoOnShow(){ const t=_hiddenAt; _hiddenAt=0;
  clearRun();   // 탭이 살아서 돌아왔다 = 저장본은 필요 없다(다음에 숨을 때 다시 쓴다)
  if(!t || !nemoRunning()) return;
  const away=Date.now()-t;
  if(away>AWAY_MS){ abandonRun(away); return; }
  nemoCatchUp(away); }
// 숨겨져 있던 만큼 시뮬을 몰아서 돌린다. 배속을 곱해야 실제로 흐른 게임 시간과 같아진다.
function nemoCatchUp(ms){ if(!nemoRunning()) return;
  const dt=1/60, cap=AWAY_MS/1000;
  const secs=Math.min(ms/1000, cap)*(G.speedMul||1);
  const n=Math.round(secs/dt); if(n<6) return;   // 0.1초 미만은 원래 루프가 삼킨다
  const e0=G.enemies.length, r0=G.round;
  G._catchUp=true;   // 따라잡는 동안 효과음을 끈다 — 1,800스텝치가 한꺼번에 터진다(채팅은 남긴다: 무슨 일이 있었는지 읽을 수 있게)
  try{ for(let i=0;i<n;i++){ if(!nemoRunning()) break; if(typeof tickResearch==='function') tickResearch(dt); step(dt); } }
  finally{ G._catchUp=false; }
  if(typeof addChat==='function') addChat('', '⏱ 자리를 비운 '+Math.round(ms/1000)+'초를 따라잡았습니다 — 라운드 '+r0+'→'+G.round+' · 적 '+e0+'→'+G.enemies.length+'기', '#ffd24a', true); }
// 30초를 넘겨 돌아왔다 = 의도적 이탈. 보상도, 판 기록도 없다.
function abandonRun(ms){ if(typeof G==='undefined'||!G) return;
  if(typeof coopSend==='function') coopSend('bye', { num:G.myPlayer||1, nick:(typeof myNick==='function')?myNick():'' });   // 남들은 기다리지 말고 바로 지운다
  G._pointsBanked=true; G._bankedAmt=0; G._runSum=null;   // 정산 차단 — 이 판은 없던 것으로(포인트·기록·일일 계측 전부)
  G.phase='quit';
  if(typeof toast==='function') toast('⚠️ '+Math.round(ms/1000)+'초 넘게 자리를 비워 판에서 나왔습니다 — 보상과 기록이 없습니다');
  if(typeof overlayToLobby==='function') overlayToLobby(); }   // 결과창을 거치지 않는다(_runSummary 가 돌면 판으로 인정된다)
// ══ 판 상태 저장/복구 — 탭이 죽어도 30초는 이어진다 ═════════════════
// 화면을 내리면(홈·앱 전환·화면 잠금) 모바일 브라우저가 그 탭을 **통째로 버리는 일이 흔하다**.
// 그러면 돌아왔을 때 페이지가 처음부터 다시 뜨고 G 가 사라진다 — 따라잡기(nemoCatchUp)로도
// 못 살린다. 그래서 숨을 때 판을 저장해 두고, 돌아와서 30초 안이면 그대로 복구한다.
//   ⚠ 한계도 AWAY_MS 하나를 쓴다 — 탭이 살아 있든 죽었든 사용자에겐 같은 규칙이어야 한다.
const RUN_SAVE_KEY='nm_run';
function saveRun(){ if(!nemoRunning()) return;
  try{
    // ⚠ 채널 객체·타이머 id 는 직렬화할 수 없다(순환 참조로 통째로 실패한다) — 빼고 저장한다
    const g=JSON.stringify(G, (k,v)=>(k==='coopChan'||k==='coopStateT'||k==='_runSum')?undefined:v);
    if(typeof _lsSet==='function') _lsSet(RUN_SAVE_KEY, { t:Date.now(), g:g,
      mapId:(typeof MAP!=='undefined'&&MAP&&MAP.id)||'nemo',
      cfg:(typeof MAP_CFG_OVR!=='undefined')?MAP_CFG_OVR:null,
      room:(typeof _lobbyRoom!=='undefined'&&_lobbyRoom)?_lobbyRoom:null,
      diff:(typeof _selDiff!=='undefined')?_selDiff:null });
  }catch(e){ console.warn('saveRun', e); } }
function clearRun(){ try{ localStorage.removeItem('nm_run'); }catch(e){} }
// 부팅 때 한 번 — 복구했으면 true(그러면 HOME 으로 끌어가지 않는다)
function tryRestoreRun(){
  let sv=null;
  try{ sv=(typeof _lsGet==='function')?_lsGet(RUN_SAVE_KEY,null):null; }catch(e){}
  clearRun();   // ⛔ 읽는 즉시 지운다 — 깨진 저장이 부팅을 **영원히** 막는 사태를 원천봉쇄한다
  if(!sv||!sv.g) return false;
  const age=Date.now()-(sv.t||0);
  if(age>AWAY_MS){   // 30초 초과 = 의도적 이탈. 보상도 기록도 없다(abandonRun 과 같은 규칙)
    if(typeof toast==='function') toast('⚠️ '+Math.round(age/1000)+'초 넘게 자리를 비워 판이 사라졌습니다 — 보상과 기록이 없습니다');
    return false; }
  try{
    const g=JSON.parse(sv.g);
    if(!g || g.phase!=='playing') return false;
    _selMap=(typeof USEMAPS!=='undefined' && USEMAPS[sv.mapId]) || USEMAPS.nemo;
    MAP=_selMap; if(typeof applyMapBalance==='function') applyMapBalance();
    MAP_CFG_OVR=sv.cfg||null;
    if(sv.room && typeof _lobbyRoom!=='undefined') _lobbyRoom=sv.room;
    if(sv.diff && typeof _selDiff!=='undefined') _selDiff=sv.diff;
    if(typeof resetGameChrome==='function') resetGameChrome();
    if(typeof bgmStop==='function') bgmStop();
    G=g; G.loading=false; G.paused=false;
    G.coop=false; G.coopChan=null; G.coopStateT=null;   // 채널은 새로 붙여야 한다(아래에서 시도)
    const ov=document.getElementById('ov'); if(ov) ov.classList.add('hide');
    const lb=document.getElementById('lobby'); if(lb) lb.classList.add('hide');
    if(typeof setInGame==='function') setInGame(true);
    if(typeof _setBottomTab==='function') _setBottomTab(G.tab||'Main');
    if(typeof renderUnits==='function') renderUnits();
    if(typeof updateHud==='function') updateHud();
    if(typeof placeMergeZone==='function') placeMergeZone();
    if(typeof updateCoopBossBar==='function') updateCoopBossBar();
    nemoCatchUp(age);   // 탭이 죽어 있던 시간도 똑같이 따라잡는다
    // 협동이었으면 채널에 다시 붙어 본다 — 실패해도 혼자 이어서 하면 되므로 판을 막지 않는다
    if(sv.room && G.coopSlotInfo && typeof startGameCoop==='function'){ try{ startGameCoop(G.coopSlotInfo); }catch(e){} }
    if(typeof addChat==='function') addChat('', '↻ 판을 복구했습니다 — 자리를 비운 '+Math.round(age/1000)+'초를 이어서 진행합니다.', '#ffd24a', true);
    return true;
  }catch(e){ console.warn('tryRestoreRun', e);
    try{ G=newGame(); }catch(_e){}   // 반쯤 복구된 상태로 두지 않는다 — 깨끗이 되돌리고 평소 부팅으로
    return false; } }
// ══ 게임 종료 — 승/패 공통 단일 출구 ══════════════════════════════
// ⚠ 상대에게 알리지 않으면 상대 화면에서 내가 **영원히 살아 있는 것으로** 보인다
//   (내 브로드캐스트는 phase!=='playing' 이면 멈추므로 마지막 값에 얼어붙는다).
//  · 패배 = 내 자리가 **죽은 자리**가 된다 — 유닛·적·투사체를 전부 지운다.
//  · 승리 = **게임 전체가 정지**한다 — 유닛은 그대로 서 있고 시간만 멈춘다(관전용).
//    step(dt) 는 phase!=='playing' 이면 안 도므로 새 유닛·새 적은 어느 쪽이든 안 생긴다.
function nemoGameOver(result){ if(typeof G==='undefined'||!G) return;
  if(G._overSent) return; G._overSent=result;   // 판당 1회
  if(typeof coopBossDmgFlush==='function') coopBossDmgFlush();   // 남은 보스 데미지 누적분을 흘려보낸 뒤 끝낸다
  if(typeof coopSend==='function') coopSend('over', { result:result, round:G.round||0 });
  if(result==='lost') clearMyField(); }
// 내 전장을 비운다 — 배열을 직접 비운다(사망 처리 함수를 타면 킬·보상이 늘어난다)
function clearMyField(){ if(typeof G==='undefined'||!G) return;
  ['units','enemies','pendSpawn','shots','beams','muzzles','impacts','sparks','debris','recalls','pendingHits']
    .forEach(k=>{ if(Array.isArray(G[k])) G[k].length=0; });
  G.sel=[]; G.selEnemy=null;
  if(typeof renderUnits==='function') renderUnits();                             // DOM 유닛 카드 정리
  if(window.M3D && window.M3D.clearGameModels) window.M3D.clearGameModels(); }    // 3D 잔상 제거(숨기지 말고 지운다)
function drawPlayer(){ drawMain('cvPlayer'); }   // 실제 전장 렌더(관전 라벨은 좌상단 DOM #specLabel)
// 죽은 자리·빈 자리 관전 — 배경(트랙)만 그리고 그 위엔 아무것도 없다.
// ⚠ 이 분기가 없으면 drawPlayer() 로 떨어져 **내 유닛·내 적**이 남의 자리에 그려진다(옛 동작).
//   renderSpectate 와 같은 수법: 배열을 잠깐 비워서 그리고 원상복구한다.
function renderEmptySlot(){ if(typeof G==='undefined'||!G) return;
  const sv={ units:G.units, enemies:G.enemies, shots:G.shots, beams:G.beams, muzzles:G.muzzles,
             sel:G.sel, selEnemy:G.selEnemy, impacts:G.impacts, sparks:G.sparks, debris:G.debris, recalls:G.recalls };
  G.units=[]; G.enemies=[]; G.shots=[]; G.beams=[]; G.muzzles=[];
  G.sel=[]; G.selEnemy=null; G.impacts=[]; G.sparks=[]; G.debris=[]; G.recalls=[];
  // ⚠ 캔버스가 아직 크기를 못 받았을 수 있다(탭 전환 첫 프레임) — 그리기 실패가 프레임 루프를 끊지 않게 막는다
  try{ drawMain('cvPlayer'); }catch(e){ console.warn('renderEmptySlot', e); } finally{ Object.assign(G, sv); }
  if(window.M3D && window.M3D.clearGameModels) window.M3D.clearGameModels();   // 3D 잔상 제거(숨기지 말고 지운다)
  const mcv=document.getElementById('cvMarine'); if(mcv) mcv.style.display='none';
  const fcv=document.getElementById('cvFx');     if(fcv) fcv.style.display='none'; }
// 관전 라벨 갱신(좌상단 킬 아래) — 플레이어 탭에서만, 플레이어색으로
function updateSpecLabel(){ const el=document.getElementById('specLabel'); if(!el) return;
  if(G.tab==='Players'){ const pc=PLAYER_VIEW_COLORS[(G.curPlayer-1)%PLAYER_VIEW_COLORS.length];
    el.style.setProperty('--pc',pc); el.innerHTML=pIco('👁','sm')+' '+escHtml(playerName(G.curPlayer))+' 관전'; el.classList.add('on'); }
  else el.classList.remove('on'); }

// 전투 미니맵: 트랙 + 적/유닛을 도트로 축소 표시(메인 외 탭에서 전투 모니터링)
function drawMiniMap(){
  const cv=document.getElementById('miniMap'); if(!cv||!GW||!GH) return;
  const {ctx,W,H}=setup('miniMap');
  ctx.clearRect(0,0,W,H);
  const sx=W/GW, sy=H/GH; const {ox,oy,bw,bh}=geom(GW,GH);
  // 미세 그리드(아주 은은)
  ctx.strokeStyle='rgba(120,180,220,.04)'; ctx.lineWidth=1;
  for(let i=1;i<4;i++){ const gx=W*i/4, gy=H*i/4;
    ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke(); }
  // 트랙(플랫폼) — 은은한 채움 + 얇은 외곽선
  const tx=ox*sx, ty=oy*sy, tw=bw*sx, th=bh*sy;
  rR(ctx,tx,ty,tw,th,2); ctx.fillStyle='rgba(16,36,54,.26)'; ctx.fill();
  rR(ctx,tx,ty,tw,th,2); ctx.strokeStyle='rgba(0,229,255,.28)'; ctx.lineWidth=0.7; ctx.stroke();
  // 합체존(점선)
  const mr=mergeRect(GW,GH); ctx.save(); ctx.setLineDash([2,2]); ctx.strokeStyle='rgba(255,192,64,.6)'; ctx.lineWidth=1;
  ctx.strokeRect(mr.x*sx, mr.y*sy, mr.w*sx, mr.h*sy); ctx.restore();
  // 스폰 포인트(정적 점)
  if(!G.sandbox){ ctx.fillStyle=COL.enemy; ctx.beginPath(); ctx.arc(ox*sx, oy*sy, 2, 0, 6.28); ctx.fill(); }   // 적 스폰 점(샌드박스 제외)
  // 유닛/적 — 단색 도트(내 유닛=파랑, 적사이드=빨강)
  for(const u of G.units){ ctx.fillStyle='#4aa8ff';   // 샌드박스 포함 전부 아군색(메인 유닛=내 유닛)
    ctx.beginPath(); ctx.arc(u.x*W, u.y*H, u.hero?2.4:1.6, 0, 6.28); ctx.fill(); }
  for(const e of G.enemies){ const p=posAt(e.d,GW,GH); ctx.fillStyle=e.special?'#ffd24a':(e.boss?COL.boss:'#ff5566');
    ctx.beginPath(); ctx.arc(p.x*sx, p.y*sy, e.boss?2.6:1.7, 0, 6.28); ctx.fill(); }
  // 외곽 라인(아주 얇고 은은하게 — HUD 시안 톤, 배경과 거의 동화)
  rR(ctx,0.5,0.5,W-1,H-1,2); ctx.strokeStyle='rgba(0,229,255,.22)'; ctx.lineWidth=0.5; ctx.stroke();
}

// 합체 베이 = 바닥 발광 구역(영역 표시) + 가운데 작은 3D 비콘(M3D가 렌더). 여기선 바닥 구역 데칼만 그림
function drawBeacon(ctx,W,H){ return;   /* 합체존 제거 — 전 범위 조합(하단 조합 패널) */ const r=mergeRect(W,H), cx=r.x+r.w/2, cy=r.y+r.h/2;
  const rad=Math.min(r.w,r.h)*0.16;   // 사각 영역 모서리 둥글기
  ctx.save(); ctx.globalCompositeOperation='lighter';
  // 바닥 발광 구역(사각, 은은) — '여기에 유닛을 모아라' 영역
  const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(r.w,r.h)*0.62);
  g.addColorStop(0,'rgba(255,80,80,.12)'); g.addColorStop(0.6,'rgba(230,60,60,.05)'); g.addColorStop(1,'rgba(200,50,50,0)');
  ctx.fillStyle=g; ctx.beginPath(); rRpath(ctx,r.x,r.y,r.w,r.h,rad); ctx.fill();
  // 점선 사각 경계 1개(정적 — 깜빡임 없음)
  ctx.strokeStyle='rgba(255,95,95,.5)'; ctx.lineWidth=1.5;
  ctx.setLineDash([6,5]); ctx.beginPath(); rRpath(ctx,r.x,r.y,r.w,r.h,rad); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // 3D 비콘이 아직이면(로드 전) 중앙에 작은 절차적 비콘 폴백(사각, 1개)
  if(!(window.M3D && M3D.beaconReady && M3D.beaconReady())){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const ins=Math.min(r.w,r.h)*0.3; ctx.strokeStyle='rgba(255,110,110,.4)'; ctx.lineWidth=2; ctx.beginPath(); rRpath(ctx,r.x+ins,r.y+ins,r.w-2*ins,r.h-2*ins,rad*0.6); ctx.stroke();
    ctx.restore();
  }
}
// 합체존 DOM 위치 갱신
function placeMergeZone(){ const mz=document.getElementById('mergeZone'); if(mz) mz.style.display='none'; }   // 합체존 제거

// ============================================================================
// 유닛/적 로직
// ============================================================================
// 베테랑시(무한모드 인런 무한 성장): 누적 킬로 계급↑ — 계급당 +4% 공격력(캡 없음). 사망 시 유닛이 사라지며 리셋.
//  계급 L 도달 누적 킬 = 5·L·(L+1) (L1=10, L2=30, L3=60 …)
function vetLevel(u){ const k=(u&&u.kills)||0; return k<10?0:Math.floor((Math.sqrt(1+0.8*k)-1)/2); }
function vetMul(u){ return 1 + vetLevel(u)*0.04; }
   // 다음 계급까지 누적 킬 목표
function unitDmg(u){ const p=unitDmgParts(u); let t=p.total; if(u && mapCfg('infinite')) t*=vetMul(u); return t; }
function infIncomeMul(){ if(!mapCfg('infinite')||(G.round||0)<=30) return 1; return Math.pow(mapCfg('infIncomeLoop',1.5),(G.round-30)/30); }   // 무한모드: 라운드 깊을수록 크레딧/에너지 수입↑(적 성장보다 완만)
// 공격력 분해: {base:기본, up:업그레이드 추가분, total:합계, wlv:계열 업글 레벨}
/* UNIT_PWR → NEMO_BAL.unitPwr */   // 유닛 개별 공격력 배율(적게·강하게 — 상한 50→35 보정)
function unitDmgParts(u){ if(typeof G!=='undefined' && G.sandbox && !G.strike){ const _b=(u.hero?HERO_STAT_MUL:1); const base=Math.round((Ueff(u).dmg||0)*_b); return {base, up:0, total:base, wlv:0}; }   // 관리자: base_stats 공격력 그대로(가챠·업글 배율 없음 — 전투 DPS와 동일)
  const d=U[u.id]; const wlv=(G.atkLv&&G.atkLv[gachaWpn(u)])||0;
  const lv=(1+((u.lv||1)-1)*0.6)*gachaTierMul(u)*((G.metaB&&G.metaB.atkMul)||1)*UNIT_PWR*((G.teamAtk)||1);   // 등급·메타·개별 강화 + 팀 공격버프
  const ov=GDMG_OVR[u.gid];   // 구조물 프록시 가챠 유닛의 기본치 교정
  const base=Math.round((ov?ov.dmg:(u.hero?d.hdmg:d.dmg))*lv);
  const upMul=(u&&u.gtier&&UP_TIER_MUL[u.gtier])||1;   // 등급이 오를수록 업글 1회 증가폭도 커짐
  let total=(u.id==='turret'||u.id==='photon') ? base : base+Math.round((ov?ov.up:(u.hero?d.hup:d.up))*wlv*1.2*upMul);   // 타워: 무기 업그레이드 비례 상승 제거(초반 강·고정)
  if(u.id==='turret'||u.id==='photon'){ total=Math.round(total*((G.metaB&&G.metaB.towerMul)||1)); }   // 타워 강화(메타)로 성장
  return {base, up:total-base, total, wlv}; }
// 공중공격 분해(airDmg 있는 유닛만). 없으면 null.
function unitAirParts(u){ const d=U[u.id]; if(d.airDmg==null) return null;
  if(typeof G!=='undefined' && G.sandbox && !G.strike){ const _b=(u.hero?HERO_STAT_MUL:1); const e=Ueff(u); const base=Math.round((e.airDmg!=null?e.airDmg:0)*_b); return {base, up:0, total:base}; }   // 관리자: base_stats 공중공격력
  const wlv=(G.atkLv&&G.atkLv[gachaWpn(u)])||0; const lv=(1+((u.lv||1)-1)*0.6)*gachaTierMul(u)*((G.metaB&&G.metaB.atkMul)||1);   // 등급 배율 + 메타 공격력↑
  const ov=GDMG_OVR[u.gid];   // 오버라이드 유닛은 공중=지상 동일
  const aD=ov?ov.dmg:(u.hero?(d.hairDmg!=null?d.hairDmg:d.airDmg):d.airDmg);
  const aU=ov?ov.up:(u.hero?(d.hairUp!=null?d.hairUp:d.airUp):d.airUp);
  const base=Math.round(aD*lv); let total=(u.id==='turret'||u.id==='photon') ? base : base+Math.round(aU*wlv*1.2);   // 타워: 업그레이드 비례 상승 제거(초반 강·고정)
  if(u.id==='turret'||u.id==='photon'){ total=Math.round(total*((G.metaB&&G.metaB.towerMul)||1)); }   // 타워 강화(메타)
  return {base, up:total-base, total}; }
function inZone(u){ const r=mergeRect(GW,GH); const px=u.x*GW, py=u.y*GH;
  return px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h; }

function buyUnit(id){
  const def=U[id]; if(!def) return;
  // 고정 구조물(터렛·포토캐논): 다음 빈 자리에 1개씩 배치(잠금 해제)
  if(isFixed(id)){
    const slots=FIXED_SLOTS[id]; const used=G.units.filter(u=>u.id===id).length;
    const stack=FIXED_STACK[id];
    if(!stack && used>=slots.length){ toast('⚠️ '+def.name+' 자리가 가득 찼습니다'); return; }
    if(G.mineral<def.cost) return;
    G.mineral-=def.cost; const p=stack?slots[0]:slots[used];  // 겹치기=항상 한 자리
    G.units.push(initUnitStats({uid:G.idSeq++, id, hero:false, lv:1, x:p.x, y:p.y, cd:0, fixed:true}));
    if(typeof playSfx==='function') playSfx('buy_unit');
    renderUnits(); updateHud(); return;
  }
  if(G.units.filter(u=>!u.fixed).length>=maxUnits()){ toast('⚠️ 커맨드 포인트 최대 ('+maxUnits()+')'); return; }
  if(G.mineral<def.cost) return;
  G.mineral-=def.cost;
  // 소환 위치 = 맵 중앙(약간의 랜덤 오프셋). 트랙 안쪽으로 클램프.
  const ctr=trackCenter(); const sp=clampInner(ctr.x+(Math.random()-.5)*.08, ctr.y+(Math.random()-.5)*.08);
  G.units.push(initUnitStats({uid:G.idSeq++, id, hero:false, lv:1, x:sp.x, y:sp.y, cd:0}));
  if(typeof playSfx==='function') playSfx('buy_unit');
  renderUnits(); updateHud();
}
// ── 내실 업그레이드(비콘): 뽑기 확률↑ / 크레딧 획득↑ ──
const GACHA_UP_MAX=8, CREDIT_UP_MAX=8;   // 상한 하향(스노볼 차단)
const GACHA_UP_STEP=0.06;   // 레벨당 상위(비일반) 등급 가중 +6% (3중 스택 고려해 8→6 하향)
const CREDIT_UP_STEP=0.05;  // 레벨당 크레딧 획득 +5%(↓8) — 경제 복리 스노볼 완화
function gachaUpCost(){ return 80 + (G.gachaLuckLv||0)*20; }   // 처음 80, 업글당 +20
function creditUpCost(){ return 80 + (G.creditLv||0)*20; }     // 처음 80, 업글당 +20
function buyGachaUp(){ if(G.phase!=='playing'){ toast('⚠️ 게임 중에만 가능합니다'); return; }
  if((G.gachaLuckLv||0)>=GACHA_UP_MAX){ toast('⚠️ 뽑기 확률 최대 레벨'); return; }
  const c=gachaUpCost(); if(G.mineral<c) return;
  G.mineral-=c; G.gachaLuckLv=(G.gachaLuckLv||0)+1;
  if(typeof playSfx==='function') playSfx('ui_confirm'); toast('🎲 뽑기 확률↑ Lv'+G.gachaLuckLv+' — 상위 등급 확률 증가'); updateHud(); updateBeaconLabels(); }
function buyCreditUp(){ if(G.phase!=='playing'){ toast('⚠️ 게임 중에만 가능합니다'); return; }
  if((G.creditLv||0)>=CREDIT_UP_MAX){ toast('⚠️ 크레딧 획득 최대 레벨'); return; }
  const c=creditUpCost(); if(G.mineral<c) return;
  G.mineral-=c; G.creditLv=(G.creditLv||0)+1;
  if(typeof playSfx==='function') playSfx('ui_confirm'); toast('💰 크레딧 획득↑ Lv'+G.creditLv+' — 크레딧 +'+Math.round(G.creditLv*CREDIT_UP_STEP*100)+'%'); updateHud(); updateBeaconLabels(); }
// ── 가챠 뽑기(2단계) — 기존 시민 상점 대체 ──
// 현재 적용 확률(메타 luck + 게임 내 뽑기확률↑ 반영, 합=1로 정규화). 룰렛·확률표 공용.
function gachaWeights(){ const luck=(G.metaB&&G.metaB.luck)||0, teamLuck=(G.metaB&&G.metaB.teamLuck)||0, gLv=(G.gachaLuckLv||0);
  const w={}; for(const t of GACHA_TIER_ORDER) w[t]=GACHA_TIERS[t].prob;
  // 세 소스(비콘 gLv=비일반 전체 / 메타 luck·팀 teamLuck=레전드+)가 모두 곱연산 → 풀스택 폭주 방지로 상한(cap) 적용.
  const midMul=Math.min(1+gLv*GACHA_UP_STEP, 1.6);                                       // rare~unique: 비콘만, ×1.6 상한
  const hiMul =Math.min((1+gLv*GACHA_UP_STEP)*(1+luck*0.02)*(1+teamLuck*0.01), 3.0);     // legend+: 비콘×메타×팀, ×3.0 상한
  for(const t of ['rare','epic','unique']) w[t]*=midMul;
  for(const t of ['legend','transcend','god']) w[t]*=hiMul;
  let sum=0; for(const t of GACHA_TIER_ORDER) sum+=w[t]; for(const t of GACHA_TIER_ORDER) w[t]/=sum; return w; }
function gachaRollTier(){ const w=gachaWeights();
  let r=Math.random(); for(const t of GACHA_TIER_ORDER){ r-=w[t]; if(r<=0) return t; } return 'common'; }
function gachaUnitsOfTier(t){ const r=mapCfg('roster','all');   // 맵 로스터: 'all'이면 카탈로그 전체
  return Object.values(GACHA_UNITS).filter(u=>u.tier===t && (r==='all'||r.includes(u.id))); }
// 가챠 유닛 1기 생성(프록시 성능 + 전용 모델 + 등급 메타). 뽑기·조합 공용.
function spawnGachaUnit(gid, x, y){ const gu=GACHA_UNITS[gid]; if(!gu) return null;
  const proxy=GACHA_PROXY[gid]||'marine';
  const u=initUnitStats({uid:G.idSeq++, id:proxy, hero:false, lv:1, x, y, cd:0,
    gid, gtier:gu.tier, gname:gu.displayName, gmodel:GACHA_MODEL[gid]||null});
  G.units.push(u);
  _autoJoinTierSel(u);   // 등급 전체 지정 상태면 새로 생긴 같은 등급 유닛도 지정에 자동 포함(조합/뽑기로 늘어나도 함께 이동)
  if(typeof autoPlaceOn==='function' && autoPlaceOn()){ rallyAssignSlot(u, gu.tier); const p=rallySlotPos(gu.tier, u._slot); u.moveTo={x:p.x,y:p.y}; }   // 자동 배치 ON: 새 유닛만 자기 고정 슬롯으로(기존 유닛 불변)
  return u; }
// 새 유닛 u가 생성될 때: 현재 선택이 'u의 등급 전체 지정'이면 u도 선택에 편입(무상태 판정 → 부분/혼합 지정은 제외)
function _autoJoinTierSel(u){ if(!u||u.fixed||u.atBoss||!u.gid||!u.gtier) return;
  if(!G.sel||!G.sel.length || G.selEnemy!=null) return;
  const sel=G.sel.map(id=>G.units.find(x=>x.uid===id)).filter(s=>s&&!s.fixed&&!s.atBoss);
  if(sel.length<1 || !sel.every(s=>s.gtier===u.gtier)) return;   // 선택이 전부 u와 같은 등급이 아니면 제외
  const existSameTier=G.units.filter(x=>x!==u && !x.fixed && !x.atBoss && x.gtier===u.gtier).length;
  if(sel.length!==existSameTier) return;   // 그 등급 '전체'를 지정한 상태일 때만(부분 지정 제외)
  if(G.sel.indexOf(u.uid)<0) G.sel.push(u.uid); }
function drawGacha(){
  if(G.phase!=='playing'){ toast('⚠️ 게임 중에만 뽑기 가능합니다'); return; }
  if(G.units.filter(u=>!u.fixed).length>=maxUnits()){ toast('⚠️ 커맨드 포인트 최대 ('+maxUnits()+')'); return; }
  if(G.mineral<mapCfg('gachaCost',GACHA_COST)) return;
  G.mineral-=mapCfg('gachaCost',GACHA_COST);
  let tier=gachaRollTier();
  if(G.guarTickets>0){ if(tier==='common') tier='rare'; G.guarTickets--; }   // 확정 뽑기권: 레어+ 보장
  const pool=gachaUnitsOfTier(tier); const gu=pool[Math.floor(Math.random()*pool.length)];
  const ctr=trackCenter(); const sp=clampInner(ctr.x+(Math.random()-.5)*.08, ctr.y+(Math.random()-.5)*.08);
  spawnGachaUnit(gu.id, sp.x, sp.y);
  // 메타 '추가 생산': 확률로 같은 등급 1기 더(유닛 칸 여유 시)
  const _gd=(G.metaB&&G.metaB.gachaDoubleP)||0;
  if(_gd>0 && Math.random()<_gd && G.units.filter(u=>!u.fixed).length<maxUnits()){
    const gu2=pool[Math.floor(Math.random()*pool.length)], sp2=clampInner(ctr.x+(Math.random()-.5)*.1, ctr.y+(Math.random()-.5)*.1);
    spawnGachaUnit(gu2.id, sp2.x, sp2.y); addChat('', '➕ 추가 생산! ['+GACHA_TIERS[tier].name+'] '+gu2.displayName, TIER_COLOR[tier]||'#fff', true); }
  if(typeof playSfx==='function') playSfx(GACHA_TIERS[tier].serverNotify?'hero_merge':'buy_unit');
  const _gcol=TIER_COLOR[tier]||'#fff', _gtn=GACHA_TIERS[tier].name;   // 뽑기 결과 → 등급 색상 채팅 알람(뽑기 사운드가 있으니 silent)
  if(GACHA_TIERS[tier].serverNotify) addChat('', '🎉 ['+_gtn+'] '+gu.displayName+' 획득!', _gcol, true);   // 레전드+ 강조
  else addChat('', '🎲 ['+_gtn+'] '+gu.displayName+' 획득', _gcol, true);   // 모든 등급 표시(뽑은 유닛 확인용)
  renderUnits(); updateHud();
}
// ── 에너지 뽑기 — 크레딧을 내고 랜덤 에너지 획득(에너지 수급 다양화). 에너지 획득 메타 반영 ──
const ENERGY_DRAW_COST=40;
function energyDraw(){
  if(G.phase!=='playing'){ toast('⚠️ 게임 중에만 가능합니다'); return; }
  if(G.mineral<mapCfg('energyDrawCost',ENERGY_DRAW_COST)) return;
  G.mineral-=mapCfg('energyDrawCost',ENERGY_DRAW_COST);
  const r=Math.random(); let base,lbl,col;
  if(r<0.55){ base=4;  lbl='';        col='#9aa6b2'; }
  else if(r<0.85){ base=7;  lbl='👍';      col='#6ff0a0'; }
  else if(r<0.97){ base=12; lbl='✨ 행운'; col='#5ad1ff'; }
  else { base=22; lbl='💥 대박'; col='#ffd24a'; }
  base=Math.round(base*((G.metaB&&G.metaB.energyDrawMul)||1));   // 메타: 에너지 뽑기 강화
  const before=G.gas; gainGas(base); const real=G.gas-before;   // 에너지 획득 메타(energyMul) 반영
  if(typeof playSfx==='function') playSfx(base>=12?'hero_merge':'buy_unit');
  const box=document.getElementById('gachaResult');
  if(box){ box.style.setProperty('--gc', col);
    box.innerHTML='<span class="grTier" style="color:'+col+'">⚡ 에너지 뽑기 '+lbl+'</span>'
      +'<span class="grName" style="color:'+col+'">+'+real+' 에너지</span>'
      +'<span class="grType">보유 '+G.gas+'</span>';
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); }
  toast('⚡ 에너지 뽑기'+(lbl?' '+lbl:'')+' +'+real+' E (보유 '+G.gas+' E)');
  updateHud();
}

// ── 10연차 묶음 뽑기 — 10회 한 번에, 레어+ 1개 확정. 10칸 여유 필요. 할인가 ──
   // 5연차: 단발 30×5=150 → 145 소폭 할인(단발 반복보다 싸게)

// ── 고급 유닛 뽑기 1회 — 비싼 대신 레어+ 보장, 에픽+ 확률 대폭 상승 ──

// ── 에너지 뽑기 10회 — 에너지 뽑기를 10회 한 번에(할인) ──
   // 단발 40×10=400 → 할인
// 에너지 전환(전액) — 보유 크레딧을 한 번에 전부 에너지로 변환
function energyDrawAll(){
  if(G.phase!=='playing'){ toast('⚠️ 게임 중에만 가능합니다'); return; }
  const cost=mapCfg('energyDrawCost',ENERGY_DRAW_COST);
  if(G.mineral<cost) return;
  const n=Math.floor(G.mineral/cost); G.mineral-=n*cost;
  let total=0, jack=0;
  for(let i=0;i<n;i++){ const r=Math.random(); let base;
    if(r<0.55) base=4; else if(r<0.85) base=7; else if(r<0.97){ base=12; } else { base=22; jack++; }
    base=Math.round(base*((G.metaB&&G.metaB.energyDrawMul)||1));
    const before=G.gas; gainGas(base); total+=G.gas-before; }
  if(typeof playSfx==='function') playSfx('hero_merge');
  const col='#00e5ff', box=document.getElementById('gachaResult');
  if(box){ box.style.setProperty('--gc', col);
    box.innerHTML='<span class="grTier" style="color:'+col+'">⚡ 에너지 전환 ×'+n+(jack?' 💥'+jack:'')+'</span>'
      +'<span class="grName" style="color:'+col+'">+'+total+' 에너지</span>'
      +'<span class="grType">크레딧 '+(n*cost)+' 소모</span>';
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); }
  toast('⚡ 크레딧 '+(n*cost)+' C → +'+total+' E (보유 '+G.gas+' E)');
  updateHud();
}

// ── 자동화 유틸(해금 업그레이드 + 인게임 on/off 토글) — 0.33초마다 1틱(한 번에 폭주 방지) ──
let _autoAcc=0;
const AUTO_INT=0.33;
// 예시(프리뷰) 모드: true면 포인트 업그레이드 미해금이어도 자동화 토글을 켜고 동작시켜 볼 수 있음(테스트용).
// 정식 게이팅으로 되돌리려면 false로만 바꾸면 됨.
const AUTO_PREVIEW=true;
function autoUsable(kind){ if(AUTO_PREVIEW) return true; const mb=G.metaB||{};
  return kind==='combine'?!!mb.autoCombine : kind==='unit'?!!mb.autoUnit : kind==='energy'?!!mb.autoEnergy : kind==='pboss'?!!mb.autoPboss : kind==='place'?!!mb.autoPlace : kind==='bossdeploy'?!!mb.autoBossdeploy : false; }
function stepAuto(dt){
  if(G.phase!=='playing' || !G.auto) return;
  _autoAcc+=dt; if(_autoAcc<AUTO_INT) return; _autoAcc=0;
  const a=G.auto;
  if(autoUsable('combine') && a.combine) autoCombineStep();   // 조합 먼저(유닛 칸 확보)
  if(autoUsable('unit')    && a.unit)    autoDrawStep();
  if(autoUsable('energy')  && a.energy)  autoEnergyStep();
  if(autoUsable('pboss')   && a.pboss)   autoPbossStep();
  if(autoUsable('bossdeploy') && a.bossdeploy) autoBossDeployStep();
}
// 자동 보스 파견: 월드보스 생존 시, 빈 슬롯을 '가장 강한' 유닛(최고 공격력)으로 채움
function autoBossDeployStep(){ if(!G.coopBoss || G.coopBoss.dead) return;
  while(bossDeployedCount()<BOSS_DEPLOY_CAP){
    let best=null, bp=-1;
    for(const u of G.units){ if(u.fixed||u.atBoss) continue; const p=(typeof unitDmg==='function'?unitDmg(u):0); if(p>bp){ bp=p; best=u; } }
    if(!best || !deployUnitToBoss(best)) break;   // 보낼 유닛 없거나 파견 실패 시 종료
  } }
// ── 자동 유닛 배치 = 등급별 '랠리 화살표' ──
// 켜면 등급별 화살표가 메인에 뜨고(드래그로 배치), 새 유닛은 중앙에서 생성돼 자기 등급 화살표로 걸어감.
const RALLY_TIERS=['common','rare','epic','unique','legend','transcend','god'];
const TIER_KO={common:'일반',rare:'레어',epic:'에픽',unique:'유니크',legend:'레전드',transcend:'초월',god:'갓'};
function ensureRally(){ if(!G.rally) G.rally={};
  RALLY_TIERS.forEach(function(t,i){ if(!G.rally[t]){ const c=clampInner(0.30+i*0.067, 0.30); G.rally[t]={x:c.x,y:c.y}; } });
  return G.rally; }
// 자동설정·랠리 위치 영속(판 사이 유지 — 매번 세팅 불필요)
function saveAutoCfg(){ try{ if(typeof _lsSet==='function') _lsSet('nm_autocfg', { auto:G.auto||null, rally:G.rally||null, rallyShow:G.rallyShow }); }catch(e){} }
function loadAutoCfg(){ try{ const c=(typeof _lsGet==='function')?_lsGet('nm_autocfg',null):null; if(c&&typeof c==='object'){
  if(c.rally&&typeof c.rally==='object') G.rally=c.rally; } }catch(e){} }   // 자동 토글·보스 자동소환·자동 배치 모두 매판 OFF — 랠리(배치 화살표) 위치만 기억
function autoPlaceOn(){ return !!(G.auto && G.auto.place && typeof autoUsable==='function' && autoUsable('place')); }
// 랠리 슬롯: 유닛별 '고정 슬롯 인덱스'(u._slot)로 헥스 패킹 → 서로 겹치지 않는 자리에 정착(분리 churn 없음)
function rallySlotPos(t, i){ ensureRally(); const r=G.rally[t]; const M=Math.min(GW||420,GH||300); const sp=28/M;   // 슬롯 간격(겹침 방지)
  let cx=Math.max(0.1,Math.min(0.9,r.x)), cy=Math.max(0.12,Math.min(0.88,r.y));   // 중심 살짝 안쪽(구석 쏠림 완화)
  if(i<=0) return clampInner(cx,cy);
  let ring=1, idx=i-1; while(idx>=ring*6){ idx-=ring*6; ring++; }   // 1번부터 링(6·12·18…)으로 채움
  const a=(idx/(ring*6))*Math.PI*2 + ring*0.45;
  return clampInner(cx+Math.cos(a)*ring*sp, cy+Math.sin(a)*ring*sp*0.92); }
function rallyAssignSlot(u, t){ if(u._slot!=null) return u._slot;   // 비어있는 가장 낮은 슬롯 번호 부여(죽은 슬롯 재사용)
  const used=new Set(G.units.filter(function(x){ return x!==u && !x.fixed && !x.atBoss && x.gtier===t && x._slot!=null; }).map(function(x){ return x._slot; }));
  let i=0; while(used.has(i)) i++; u._slot=i; return i; }
function rallyTier(t){ ensureRally(); if(!G.rally[t]) return;   // 그 등급 전 유닛을 자기 슬롯으로(화살표 드래그 시 전체 재집결)
  G.units.forEach(function(u){ if(!u.fixed && !u.atBoss && u.gtier===t){ rallyAssignSlot(u,t); const p=rallySlotPos(t,u._slot); u.moveTo={x:p.x,y:p.y}; } }); }
function attachRallyDrag(el, t){ let drag=false;
  el.addEventListener('pointerdown', function(e){ e.stopPropagation(); e.preventDefault(); drag=true; try{el.setPointerCapture(e.pointerId);}catch(_){ } });
  el.addEventListener('pointermove', function(e){ if(!drag) return; e.stopPropagation(); e.preventDefault();
    const host=document.getElementById('vMain'); if(!host) return; const rc=host.getBoundingClientRect();
    const c=clampInner((e.clientX-rc.left)/rc.width, (e.clientY-rc.top)/rc.height);
    ensureRally(); G.rally[t]={x:c.x,y:c.y}; el.style.left=(c.x*100)+'%'; el.style.top=(c.y*100)+'%'; });
  function end(e){ if(!drag) return; drag=false; if(e) e.stopPropagation(); rallyTier(t); if(typeof saveAutoCfg==='function') saveAutoCfg(); }   // 같은 등급 유닛 대형 재집결 + 위치 저장(판 사이 유지)
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); }
function renderRallyArrows(){ const host=document.getElementById('vMain'); if(!host) return;
  const show=autoPlaceOn() && G.rallyShow!==false;   // 자동배치 ON + 화살표 표시 ON. 모든 등급 표시(미보유도 미리 배치 가능)
  if(!show){ document.querySelectorAll('.rallyArrow').forEach(function(el){ el.style.display='none'; }); return; }
  ensureRally();
  RALLY_TIERS.forEach(function(t){ let el=document.getElementById('rally_'+t);
    if(!el){ el=document.createElement('div'); el.id='rally_'+t; el.className='rallyArrow';
      el.innerHTML='<svg class="raIco" viewBox="0 0 24 24"><path d="M12 4v12" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M6.5 11.5L12 17l5.5-5.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="raLbl">'+(TIER_KO[t]||t)+'</span>';
      el.style.setProperty('--rc', TIER_COLOR[t]||'#fff'); attachRallyDrag(el, t); host.appendChild(el); }
    el.style.display='flex'; const r=G.rally[t]; el.style.left=(r.x*100)+'%'; el.style.top=(r.y*100)+'%'; });
}
// 자동 조합: 가장 낮은 등급부터 1건. 전 등급 단순 조합(갓=최종은 대상 없음 → 자연 제외)
function autoCombineStep(){
  const groups=ownedCombineGroups(); let bestGid=null, bestRank=99;
  for(const gid in groups){ const list=groups[gid]; const res=combineResultFor(gid, list[0].gtier);
    if(!res || res.type!=='simple') continue;   // 레전드→초월은 자동 안 됨
    const rank=GACHA_TIER_ORDER.indexOf(list[0].gtier);
    if(rank<bestRank){ bestRank=rank; bestGid=gid; } }
  if(bestGid) combineOneOfType(bestGid, true);
}
// 자동 유닛 뽑기: 1기(칸·크레딧 충분할 때). 레전드+만 채팅 알림(도배 방지)
function autoDrawStep(){
  if(G.units.filter(u=>!u.fixed).length>=maxUnits()) return;
  const cost=mapCfg('gachaCost',GACHA_COST); if(G.mineral<cost) return;
  G.mineral-=cost;
  let tier=gachaRollTier();
  if(G.guarTickets>0){ if(tier==='common') tier='rare'; G.guarTickets--; }
  const pool=gachaUnitsOfTier(tier); const gu=pool[Math.floor(Math.random()*pool.length)];
  const ctr=trackCenter(); const sp=clampInner(ctr.x+(Math.random()-.5)*.08, ctr.y+(Math.random()-.5)*.08);
  spawnGachaUnit(gu.id, sp.x, sp.y);
  const _gd=(G.metaB&&G.metaB.gachaDoubleP)||0;
  if(_gd>0 && Math.random()<_gd && G.units.filter(u=>!u.fixed).length<maxUnits()){
    const gu2=pool[Math.floor(Math.random()*pool.length)], sp2=clampInner(ctr.x+(Math.random()-.5)*.1, ctr.y+(Math.random()-.5)*.1);
    spawnGachaUnit(gu2.id, sp2.x, sp2.y); }
  if(GACHA_TIERS[tier].serverNotify) addChat('', '🎉 ['+GACHA_TIERS[tier].name+'] '+gu.displayName+' (자동)', TIER_COLOR[tier]||'#fff', true);
  renderUnits(); updateHud();
}
// 자동 에너지 변환: 보유 크레딧 전액을 조용히 변환(틱마다 새로 번 크레딧만큼 변환됨)
function autoEnergyStep(){
  const cost=mapCfg('energyDrawCost',ENERGY_DRAW_COST);
  const n=Math.floor(G.mineral/cost); if(n<=0) return; G.mineral-=n*cost;
  for(let i=0;i<n;i++){ const r=Math.random(); let base; if(r<0.55)base=4; else if(r<0.85)base=7; else if(r<0.97)base=12; else base=22;
    base=Math.round(base*((G.metaB&&G.metaB.energyDrawMul)||1)); gainGas(base); }
  updateHud();
}
// 자동 개인 보스: 토글된 보스 중 해금·쿨0·미활동인 것 소환
function autoPbossStep(){
  if(!G.auto.pboss) return; if(!G.pbossCds) G.pbossCds={};
  for(const pt of PBOSS_TYPES){
    if(!G.auto.pboss[pt.id]) continue;
    if((G.pbossCds[pt.id]||0)>0) continue;
    if(G.enemies.some(e=>e.pboss && e.pbId===pt.id)) continue;
    if(!pbossUnlocked(pt)) continue;
    summonPersonalBoss(pt.id);   // 내부에서 해금·쿨·활동 재검증 + 쿨다운 설정
  }
}

// ── 테스트 도감: 유닛뽑기 탭에 28종 등급별 카드 렌더(탭=즉시 소환) ──
function buildGachaDex(){
  const box=document.getElementById('gachaDex'); if(!box) return;
  let h='<div class="gxTop"><div class="gxTitle">유닛 도감 <small>탭하면 소환</small></div>'
    +'<div class="gxRoll" data-sfx="confirm" onclick="drawGacha()">'+pIco('🎲','md')+' 랜덤 뽑기</div></div>';
  for(const t of GACHA_TIER_ORDER){
    const col=TIER_COLOR[t]||'#fff';
    h+='<div class="gxRow" style="--tc:'+col+'"><div class="gxTag">'+GACHA_TIERS[t].name+'</div><div class="gxCells">';
    for(const gu of gachaUnitsOfTier(t)){
      const pk=GACHA_MODEL[gu.id]||GACHA_PROXY[gu.id];   // 전용 모델키 우선, 없으면 프록시
      const img=PORTRAIT_IMG[pk];
      const thumb=img?('<img src="'+img+'" alt="" draggable="false">'):unitSVG(GACHA_PROXY[gu.id]||'marine');
      h+='<div class="gxCell" onclick="testSpawnGacha(\''+gu.id+'\')"><div class="gxThumb">'+thumb+'</div>'
        +'<div class="gxName">'+escHtml(gu.displayName)+'</div>'
        +'<div class="gxStar" style="color:'+col+'">'+tierStars(gu.tier)+'</div></div>';
    }
    h+='</div></div>';
  }
  box.innerHTML=h;
}
// 테스트용: 특정 가챠 유닛 1기를 비용 없이 즉시 소환(트랙 중앙 근처). 메인 탭에서 동작/공격 확인.
function testSpawnGacha(gid){
  if(G.phase!=='playing'){ toast('⚠️ 게임 중에만 소환할 수 있습니다'); return; }
  if(G.units.filter(u=>!u.fixed).length>=maxUnits()){ toast('⚠️ 커맨드 포인트 최대 ('+maxUnits()+')'); return; }
  const gu=GACHA_UNITS[gid]; if(!gu) return;
  const proxy=GACHA_PROXY[gid]||'marine';
  const ctr=trackCenter(); const sp=clampInner(ctr.x+(Math.random()-.5)*.08, ctr.y+(Math.random()-.5)*.08);
  const u=initUnitStats({uid:G.idSeq++, id:proxy, hero:false, lv:1, x:sp.x, y:sp.y, cd:0,
    gid:gid, gtier:gu.tier, gname:gu.displayName, gmodel:GACHA_MODEL[gid]||null});
  G.units.push(u);
  if(typeof playSfx==='function') playSfx('buy_unit');
  const col=TIER_COLOR[gu.tier]||'#fff';
  addChat('', '🎲 [테스트] '+gu.displayName+' 소환 — 메인 탭에서 확인', col, true);
  renderUnits(); updateHud();
}
function _consumeUnits(con){ G.units=G.units.filter(x=>!con.has(x.uid)); G.sel=G.sel.filter(uid=>!con.has(uid));
  if(window.M3D&&M3D.dropModels) M3D.dropModels([...con]); }   // 합성 소비: 유닛/선택/3D모델 제거
function combine(){
  const inz=G.units.filter(u=>inZone(u)&&!u.hero&&!u.fixed);
  // 1) (레시피 폐지 — TRANSCEND_RECIPE 빈 맵이라 이 루프는 건너뜀. 참조 안전용으로 유지)
  const cnt={}; for(const u of inz){ if(u.gid) cnt[u.gid]=(cnt[u.gid]||0)+1; }
  for(const res in TRANSCEND_RECIPE){ const need={}; TRANSCEND_RECIPE[res].forEach(id=>need[id]=(need[id]||0)+1);
    if(Object.keys(need).every(id=>(cnt[id]||0)>=need[id])){
      const con=new Set(); for(const id in need){ let n=need[id]; for(const u of inz){ if(u.gid===id && n>0 && !con.has(u.uid)){ con.add(u.uid); n--; } } }
      _consumeUnits(con); const c=zoneCenter(); spawnGachaUnit(res, c.x, c.y);
      const tg=GACHA_UNITS[res]; toast('✦ '+tg.displayName+' '+GACHA_TIERS[tg.tier].name+' 강림!');
      if(typeof playSfx==='function') playSfx('hero_merge');
      refreshSelCard(); renderUnits(); updateHud(); return true;
    }
  }
  // 2) 단순 조합 — 같은 유닛 3개 → 다음 등급 랜덤(갓=최종 제외) / 레거시=영웅
  const grp={}; for(const u of inz){ const key=u.gid||('@'+u.id); (grp[key]=grp[key]||[]).push(u); }
  for(const k in grp){ const g=grp[k]; if(g.length<3) continue; const pick=g.slice(0,3), base=pick[0], con=new Set(pick.map(x=>x.uid));
    if(base.gid){ const nt=SIMPLE_COMBINE_TIERS[base.gtier]; if(!nt) continue;   // 단순조합 대상 아님(갓=최종) → 다른 그룹 시도
      const pool=gachaUnitsOfTier(nt), tgt=pool[Math.floor(Math.random()*pool.length)];   // 다음 등급 랜덤 1종
      _consumeUnits(con); const c=zoneCenter(); spawnGachaUnit(tgt.id, c.x, c.y);
      toast('⭐ '+tgt.displayName+' '+GACHA_TIERS[nt].name+' 진화!');
    } else {   // 레거시 → 영웅
      _consumeUnits(con); const c=zoneCenter();
      G.units.push(initUnitStats({uid:G.idSeq++,id:base.id,hero:true,lv:1,x:c.x,y:c.y,cd:0}));
      toast('⭐ '+U[base.id].name+' 영웅 탄생!');
    }
    if(typeof playSfx==='function') playSfx('hero_merge'); refreshSelCard(); renderUnits(); updateHud(); return true;
  }
  // 3) 안내
  const stuck=Object.values(grp).some(g=>g.length>=3 && g[0].gid && !SIMPLE_COMBINE_TIERS[g[0].gtier]);
  toast(stuck ? 'ℹ️ 갓은 최종 등급이라 더 조합되지 않습니다' : 'ℹ️ 합체존에 같은 유닛 3개를 모으세요');
  return false;
}

function roundDef(r){ const m=MON[Math.min(Math.max(1,r),MON.length)-1]; return m; }
const ENEMY_MODEL={ '옵저버':'observer', '오버로드':'overlord',   // 적 이름 → 3D 모델 id(있으면 3D 렌더, 없으면 네온 도형)
  '발키리':'hellfire', '드랍쉽':'pelican', '배틀':'dreadnought',
  '아비터':'kronos', '셔틀':'seraph', '케리어':'archangel', '스카웃':'falcon',
  '스커지':'stinger', '디바우러':'venom', '퀸':'medusa',
  '레이스':'skyguard', '커세어':'skydancer' };   // 레이스·커세어=기존 모델 재사용
try{ window.ENEMY_MODEL=ENEMY_MODEL; }catch(e){}   // M3D 모듈(별도 스코프) tintModel 폴백용
// 적/보스 표시 이름 — 모델 id → 한글 이름(스타크래프트명 대신 새 기함 이름). 매핑 없으면 적 한글명 그대로.
const MODEL_NAME_KR={ hellfire:'헬파이어', pelican:'펠리컨', dreadnought:'드레드노트', kronos:'크로노스', seraph:'세라프', archangel:'아크엔젤', falcon:'팔콘', stinger:'스팅어', venom:'베놈', medusa:'메두사',
  observer:'와처', overlord:'제플린', skyguard:'템페스트', skydancer:'스카이댄서', racer:'레이서', machinegun:'발칸', snapper:'스내퍼' };   // 옵저버→와처, 오버로드→제플린, 레이스→템페스트, 커세어→스카이댄서
function enemyName(n){ const mdl=ENEMY_MODEL[n]; return (mdl&&((U[mdl]&&U[mdl].name)||MODEL_NAME_KR[mdl]))||n; }   // 관리자 유닛 이름(U) 우선 → MODEL_NAME_KR 폴백
// 라운드 보스 3D 모델 풀(공중유닛 순환) — 보스 라운드마다 다른 기함. 모델 미로드 맵에선 null→2D capital 폴백.
const BOSS_AIR=['archangel','kronos','dreadnought','pelican','venom','medusa','seraph','hellfire','falcon','stinger'];
const BOSS_SCALE_E=2.0;   // 라운드 보스 모델 확대 배율(일반 적 대비)
function roundBossModel(){ const every=mapCfg('bossEvery',BOSS_EVERY); const bi=Math.max(0,Math.floor(G.round/every)-1)%BOSS_AIR.length;
  const cand=BOSS_AIR[bi]; return (window.M3D && M3D.hasModel && M3D.hasModel(cand)) ? cand : null; }   // 로드된 경우만 3D
const SPAWN_LEAD=0.58;   // 출현 이펙트 시작 → 실제 등장(에너지 모임 후 플래시 시점)까지 지연(초)
// ── 개인 보스 4종(고정 난이도 — 라운드 무관, 등급별 도전) ──
const PBOSS_TYPES=[
  // hp=고정 체력 / ar=방어 / rec=권장 전투 등급(표시용) / unlock=해금에 필요한 '현재 보유 전체 수집' 등급 / bonus·egy=처치 보상
  // 업그레이드 0에서도 권장 등급을 모으면 충분히 잡히도록 체력을 낮춤. 보스별 쿨다운은 개별(G.pbossCds). 보상은 더 축소.
  {id:'easy',  name:'와이번',   model:'wyvern',   rec:'레어~에픽',   unlock:'time', unlockSec:60, hp:18000,   ar:0,   bonus:100, egy:10, col:'#b8c0cc'},   // 첫 보스=해금조건 없이 게임 시작 60초 후 소환 가능
  {id:'mid',   name:'이지스',   model:'aegis',    rec:'유니크',      unlock:'rare',   hp:95000,   ar:60,  bonus:150, egy:18, col:'#b06bff'},
  {id:'upper', name:'베히모스', model:'behemoth', rec:'유니크~초월', unlock:'epic',   hp:300000,  ar:280, bonus:200, egy:26, col:'#ff8a3b'},
  {id:'super', name:'크로노스', model:'kronos',   rec:'초월',        unlock:'unique', hp:720000,  ar:500, bonus:250, egy:36, col:'#ff2bd6'},   // 모선(SC2) 대신 크로노스 재사용
];
// 개인 보스 해금: 해당 등급 가챠 유닛 4종을 '현재(이번 판)' 모두 보유하면 열림.
function pbossUnlockNeed(pt){ return (typeof gachaUnitsOfTier==='function')?gachaUnitsOfTier(pt.unlock).map(u=>u.id):[]; }
function pbossUnlockProgress(pt){
  if(pt.unlock==='time'){ const sec=pt.unlockSec||60; return {time:true, sec:sec, have:Math.min(sec,Math.floor(G.timeSec||0)), total:sec}; }   // 시간 해금: 진행도=경과초
  const need=pbossUnlockNeed(pt);
  const have=new Set(G.units.map(u=>u.gid).filter(Boolean));
  return {have:need.filter(g=>have.has(g)).length, total:need.length}; }
function pbossUnlocked(pt){ if(!G.pbUnlockedOnce) G.pbUnlockedOnce={};
  if(G.pbUnlockedOnce[pt.id]) return true;   // 한 번 해금되면 유닛을 조합해 없애도 다시 잠기지 않음
  const live=(pt.unlock==='time') ? (G.timeSec||0)>=(pt.unlockSec||60) : (function(){ const p=pbossUnlockProgress(pt); return p.total>0 && p.have>=p.total; })();
  if(live) G.pbUnlockedOnce[pt.id]=true;
  return live; }
function spawnEnemy(opts){ opts=opts||{}; const pt=opts.pbType||null; const pboss=!!opts.pboss||!!pt, boss=!!opts.boss||pboss, special=!!opts.special; const m=roundDef(G.round);
  const idn=(!boss&&!special&&!pboss&&G.round>20)?MON[((G.round-21)%9+9)%9]:m;   // R21~29: 겉모습(이름·모델·도형·종족)만 R1~9 순환 · 스탯(hp/sh/ar)은 m 유지
  const mb=G.metaB||{};   // 메타 강화: 적 체력/방어/이속 감소(개인)
  const _D=(DIFFICULTY[G.difficulty]||DIFFICULTY.normal);
  const _inf=mapCfg('infinite'); const _effR=_inf?Math.min(G.round,30):G.round;   // 무한모드: 라운드 램프는 R30에서 고정, 이후 루프 배수로 연속 성장
  let _infMul=1;
  if(_inf){ if(G.round>30) _infMul=Math.pow(mapCfg('infLoopHpMul',2.2),(G.round-30)/30);   // 30라운드마다 ×infLoopHpMul (연속 곡선)
    const _sc=mapCfg('infSoftCap',200); if(G.round>_sc) _infMul*=Math.pow(mapCfg('infWallMul',1.4),G.round-_sc); }   // 소프트캡: 200 이후 급가속 → 자연 탈락
  const hpMul=_D.enemyHp*(mb.enemyHpMul||1)*TEMPO_HP_MUL
  *Math.pow(HP_RAMP_BASE, Math.max(0, _effR-4))
  *(G.round<10?EARLY_HP_MUL:(G.round<13?1.3:1))
  *(_D.enemyHp<=1 ? (EARLY3_BOOST[G.round]||1) : 1);   // ×템포 ×초반보정(R10 이전 ×1.7) ×초반 라운드 부스트(R1~4, 이지/노말만 — 1레어 솔로 방지)
  // 라운드 보스(필수처치)는 enemyHp(나이트=320배)면 처치 불가 → 완만한 bossHp 계수(1.0~3.0)로 분리. 초반보정 제외.
  const bossMul=(_D.bossHp||1)*(mb.enemyHpMul||1)*TEMPO_HP_MUL;   // 라운드 램프는 bossHp(r) 곡선에 포함 → 여기선 난이도(bossHp계수)·템포·메타만
  const coinMult=_D.coinMult||1;
  const hp = pt ? pt.hp : Math.round((boss ? bossHp(_effR)*bossMul*((mb.rbossHpMul)||1) : m.hp*hpMul) * _infMul);   // 개인보스=고정 / 라운드보스 / 일반 (무한모드=×_infMul 루프 성장)
  const sh = pt ? 0 : (boss?0:Math.round(m.sh*hpMul));
  const mod=(!boss && !special && !pt && G.roundMod)?ROUND_MODS[G.roundMod]:null;   // 라운드 모디파이어(일반 적만)
  let ar = pt ? pt.ar : Math.max(0, (boss?Math.round(m.ar*0.5):m.ar) - (mb.enemyArmor||0));   // 보스 방어=그 라운드의 절반(등급 관문은 일반 라운드가 담당)
  let spd = (0.018+(boss?0:0.004))*(mb.enemySlowMul||1);
  if(mod){ if(mod.spd) spd*=mod.spd; if(mod.ar) ar=Math.round(ar*mod.ar); }
  if(!boss && idn && idn.n==='스커지') spd*=1.5;   // 스커지: 고속 비행(자폭형) — 이동속도 ↑
  const _rbm = (boss && !pboss) ? roundBossModel() : null;   // 라운드 보스 전용 3D 모델(공중유닛, 로드된 경우만)
  const _ptm = (pt && pt.model && window.M3D && M3D.hasModel && M3D.hasModel(pt.model)) ? pt.model : null;   // 개인보스 3D 모델(공중유닛, 로드된 경우만)
  const e={eid:G.eSeq++, d:0, hp:hp, maxHp:hp, sh:sh, maxSh:sh, ar:ar,   // 개인 보스도 일반 적처럼 시작지점(d=0)에서 등장 후 트랙 따라 이동
    regen:(mod&&mod.regen)||0, split:(mod&&mod.split&&Math.random()<0.6)?1:0,   // 재생/분열 모디파이어
    speed:spd, boss:boss, special:special, pboss:pboss, pbId:pt?pt.id:null, life:pboss?120:null, pbCol:pt?pt.col:null,
    bonus:pt?Math.round(pt.bonus*coinMult*((mb.pbossRewardMul)||1)):0, bonusE:pt?Math.round((pt.egy||0)*((mb.pbossRewardMul)||1)):0,   // 처치 보상(coinMult×메타 개인보스 보상)
    flash:0, name:pt?pt.name:((boss&&!pboss)?((U[_rbm]&&U[_rbm].name)||MODEL_NAME_KR[_rbm]||'보스'):(special?'스페셜':enemyName(idn.n))),   // 라운드 보스=관리자 유닛명, 일반=관리자 유닛명(R21~29=R1~9 겉모습)
    shape:boss?'capital':enemyShape(idn.n), race:enemyRace(idn.n), ph:(G.eSeq*0.7)%6.283, hit:0,
    model3d: pt ? _ptm : ((boss&&!pboss)?_rbm:(boss?null:(ENEMY_MODEL[idn.n]||null))), bossScale:(_ptm||_rbm)?BOSS_SCALE_E:undefined};   // 개인보스=전용 모델 / 라운드보스=공중 기함 / 일반=기존(R21~29=R1~9 모델)
  G.recalls.push({life:1, boss:boss, special:special});   // ① 출현 이펙트(에너지 모임) 먼저 시작
  G.pendSpawn.push({t:SPAWN_LEAD, e:e});                   // ② 모임 완료(플래시) 시점에 실제 등장(효과음도 이때)
}
// ── 개인 보스 소환(4종): 고정 난이도 보스 1마리. 2분 배회 후 소멸, 처치 시 보너스 크레딧. 쿨다운·1마리 제한 전체 공유 ──
function summonPersonalBoss(typeId){
  const pt=PBOSS_TYPES.find(t=>t.id===typeId); if(!pt) return;
  if(!G.pbossCds) G.pbossCds={};
  if(G.phase!=='playing'){ toast('⚠️ 게임 중에만 소환 가능합니다'); return; }
  if(!pbossUnlocked(pt)){
    if(pt.unlock==='time'){ const rem=Math.max(0,(pt.unlockSec||60)-Math.floor(G.timeSec||0)); toast('🔒 게임 시작 '+(pt.unlockSec||60)+'초 후 소환 가능 (남은 '+rem+'초)'); }
    else { const g=(GACHA_TIERS[pt.unlock]||{}).name||pt.unlock; const pr=pbossUnlockProgress(pt); toast('🔒 '+g+' 전체 보유 시 해금 ('+pr.have+'/'+pr.total+')'); }
    return; }
  if(G.enemies.some(e=>e.pboss && e.pbId===typeId)){ toast('⚠️ 이미 이 보스가 활동 중입니다'); return; }
  if((G.pbossCds[typeId]||0)>0){ toast('🔒 '+pt.name+' 재소환까지 '+Math.ceil(G.pbossCds[typeId])+'초'); return; }
  G.pbossCds[typeId]=Math.round(240*((G.metaB&&G.metaB.pbossCdMul)||1));   // 4분 쿨다운 × 메타 쿨감(보스별 개별)
  spawnEnemy({pbType:pt});
  if(typeof playSfxT==='function') playSfxT('boss',1500);
  const coinMult=(DIFFICULTY[G.difficulty]||DIFFICULTY.normal).coinMult||1;
  toast('☠ '+pt.name+' 소환');
}

let _atkUid=null;   // 현재 데미지 출처 유닛 uid(킬 카운트용)
const ARMOR_K=300;   // 방어력 비율 감쇄: 실효딜 = 딜 × K/(K+방어)
// ── 특성(trait) 전투 적용 ──
const TRAIT={ slowT:1.2, slowMul:0.6, debuffT:2.0, arDown:2, vuln:0.20, psnDmg:6,
  atkBuffPer:0.10, atkBuffCap:0.6, spdBuffPer:0.10, spdBuffCap:0.5 };
let _atkCacheUid=-2, _atkCacheU=null, _dotHit=false;
function curAttacker(){ if(_atkUid!==_atkCacheUid){ _atkCacheUid=_atkUid; _atkCacheU=(_atkUid!=null)?G.units.find(u=>u.uid===_atkUid):null; } return _atkCacheU; }
function applyAttackerTraits(e){ const a=curAttacker(); if(!a||!a.gid) return; const def=GACHA_UNITS[a.gid]; const tr=def&&def.traits; if(!tr||!tr.length) return;
  for(const t of tr){
    if(t==='slow'){ e.slowT=Math.max(e.slowT||0,TRAIT.slowT); e.slowMul=TRAIT.slowMul; }
    else if(t==='def_down'){ e.arDown=TRAIT.arDown; e.arDownT=TRAIT.debuffT; }
    else if(t==='armor_pierce'){ e.vuln=TRAIT.vuln; e.vulnT=TRAIT.debuffT; }
    else if(t==='poison'){ e.psnStk=Math.min(RPSN_MAX,(e.psnStk||0)+1); e.psnT=RPSN_DUR; e.psnDmg=Math.max(e.psnDmg||0,TRAIT.psnDmg); e.psnUid=a.uid; }
  }
}
function hitEnemy(e,dmg){ if(!_dotHit) applyAttackerTraits(e);   // 직격 시 특성 디버프(독 틱 재진입 제외)
  if(e.boss && !e.pboss && G.metaB && G.metaB.rbossDmgMul) dmg*=G.metaB.rbossDmgMul;   // 메타: 라운드 보스(10·20·30)에 주는 피해 증가
  if(e.vulnT>0) dmg*=(1+(e.vuln||0));                            // 마깍(취약)=받는 피해↑
  const ar=Math.max(0,(e.ar||0)-(e.arDown||0));                 // 방깍=유효 방어↓
  let d=Math.max(1, Math.round(dmg*ARMOR_K/(ARMOR_K+ar)));      // 비율 방어 모델
  e.flash=4; e.hit=1; e.shHit=e.sh>0?1:0;
  if(e.sh>0){ if(d<=e.sh){ e.sh-=d; return; } d-=e.sh; e.sh=0; } e.hp-=d;
  if(e.hp<=0 && e._killer==null) e._killer=_atkUid; }   // 마지막에 치명타를 낸 유닛 = 킬 귀속
// 적 사망 폭발: 확장 링 2겹 + 코어 플래시 + 사방 파편
function deathBurst(e){ const p=posAt(e.d,GW,GH); const col=e.boss?COL.boss:COL.enemy; const big=e.boss?1.8:1;
  if(e.boss){   // 보스=임팩트 유지(살짝만 절제·빠른 페이드)
    G.impacts.push({x:p.x,y:p.y,life:1,r:30,color:'#fff',ring:true,dk:7});
    G.impacts.push({x:p.x,y:p.y,life:1,r:22,color:col,ring:true,dk:7});
    G.impacts.push({x:p.x,y:p.y,life:1,r:18,color:col,dk:8});   // 코어 플래시
  } else {      // 일반 적=작은 단일 링 + 작은 코어(자연스러운 퍽)
    G.impacts.push({x:p.x,y:p.y,life:1,r:10,color:col,ring:true,dk:10});
    G.impacts.push({x:p.x,y:p.y,life:1,r:5,color:'#fff',dk:11});
  }
  const n=e.boss?14:4; for(let i=0;i<n;i++){ const a=(6.283*i/n)+(e.ph||0); const sp=(55+(i%3)*30)*big;
    G.debris.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,rot:a,spin:(i%2?4:-4),len:(e.boss?5:2.4)*big,color:col}); } }

// ============================================================================
// 프레임 업데이트
// ============================================================================
// 유닛 명령 AI: 홀드(기본·정지) / 공격이동(가까운 적 추적) / 반복이동(두 지점 왕복) + 스킬 타이머
function unitAI(dt){ const M=Math.min(GW,GH);
  for(const u of G.units){
    if(u.skCd>0) u.skCd=Math.max(0,u.skCd-dt);
    if(u.adr>0) u.adr=Math.max(0,u.adr-dt);
    if(u.atBoss){ u.moving=false; continue; }   // 토벌장 파견 유닛은 트랙 AI 제외
    if(u.fixed){ u.moving=false; continue; }
    if(u.moveTo) continue;  // 수동 이동 명령 수행 중 → AI 스킵(선택 여부 무관)
    const def=U[u.id]; let tx=null,ty=null;
    if(u.patrol){
      if(u._patWait>0){ u._patWait-=dt; }   // 끝지점에서 대기(0.5초) → 정지
      else { const p=u.patrol, goB=(u._patTo!=='a'), gx=goB?p.bx:p.ax, gy=goB?p.by:p.ay;
        if(Math.hypot(u.x-gx,u.y-gy)<0.022){ u._patTo=goB?'a':'b'; u._patWait=0.5; }   // 도착 → 0.5초 머문 뒤 반환
        else { tx=gx; ty=gy; } } }
    else if(u.cmd==='focus'){   // 지정공격: 지정한 적 1기를 죽을 때까지 추적(리쉬 없음 — 사거리 밖이어도 따라감) — 포위
      const tgt=u.focusTarget!=null?G.enemies.find(e=>e.eid===u.focusTarget):null;
      if(!tgt){ u.cmd='hold'; u.focusTarget=null; u._chasing=false; }   // 대상 사망 → 홀드 복귀
      else { const ux=u.x*GW,uy=u.y*GH, range=def.range*M, p=posAt(tgt.d,GW,GH), dd=Math.hypot(p.x-ux,p.y-uy);
        if(dd>range) u._chasing=true; else if(dd<range*0.7) u._chasing=false;
        if(u._chasing){ const o=u._fofs||{dx:0,dy:0}, cl=clampInner((p.x+o.dx)/GW,(p.y+o.dy)/GH); tx=cl.x; ty=cl.y; } } }
    else if(u.cmd==='attack'){ const ux=u.x*GW,uy=u.y*GH, range=def.range*M;
      // 사거리 안 가장 가까운 적만 대상(전 범위 쏠림 X — 사거리 밖 적은 안 쫓음)
      let tgt=null, best=range*range;
      for(const e of G.enemies){ const p=posAt(e.d,GW,GH); const d2=(p.x-ux)*(p.x-ux)+(p.y-uy)*(p.y-uy); if(d2<=best){best=d2;tgt=e;} }
      u.atkTarget = tgt?tgt.eid:null;
      if(tgt){ const p=posAt(tgt.d,GW,GH), o=u._fofs||{dx:0,dy:0}, cl=clampInner((p.x+o.dx)/GW,(p.y+o.dy)/GH); tx=cl.x; ty=cl.y; u._chasing=true; }  // 사거리 안 적 포위 위치로 이동
      else u._chasing=false; }   // 사거리 안 적 없으면 정지(쫓아가지 않음)
    if(tx==null){ u.moving=false; continue; }
    const dx=tx-u.x, dy=ty-u.y, d=Math.hypot(dx,dy);
    if(d<0.006){ u.moving=false; continue; }
    let dirx=dx/d, diry=dy/d;
    // 다른 유닛 회피 조향: 밀치지 않고 옆으로 돌아감(전방 장애물은 접선으로 비킴)
    let sx=0, sy=0;
    for(const o of G.units){ if(o===u) continue;
      const ox=(o.x-u.x)*GW, oy=(o.y-u.y)*GH, od=Math.hypot(ox,oy);
      const avoidR=(collideR(u)+collideR(o))*2.4;
      if(od>0.01 && od<avoidR){ const w=1-od/avoidR;
        sx-=(ox/od)*w; sy-=(oy/od)*w;                                  // 밀어내기(반발)
        if((ox/od)*dirx+(oy/od)*diry>0.25){ const tnx=-diry, tny=dirx, side=(tnx*ox+tny*oy)>=0?-1:1; sx+=tnx*side*w*1.6; sy+=tny*side*w*1.6; }  // 전방 → 접선으로 돌아감
      }
    }
    let mx=dirx+sx, my=diry+sy; const ml=Math.hypot(mx,my)||1; mx/=ml; my/=ml;
    const spd=(def.moveSpd||0.13)*MOVE_MUL*dt;
    const cl=clampInner(u.x+mx*Math.min(spd,d), u.y+my*Math.min(spd,d)); u.x=cl.x; u.y=cl.y; u.moving=true;
    if(def.model3d){ const fa=Math.atan2(mx,my); u.face=Math.round(fa/(Math.PI/8))*(Math.PI/8); }
      if(AIR_FLOAT_GIDS[u.gid]) emitEngineExhaust(u, u.x*GW, u.y*GH-16, mx, my, dt); }   // 비행체: 엔진 분사
}
// 전투 단계 시작(준비단계 통과 or 라운드 전환 공통)
// ── 적 다양화: 라운드 모디파이어 + 보스 패턴(소환/광폭화) + 분열 ──
const ROUND_MODS={
  swift:   { name:'신속', desc:'적 이동속도 ↑',    color:'#5dd6ff', spd:1.35 },
  armored: { name:'강철', desc:'적 방어력 ↑',      color:'#b0b8c4', ar:1.5 },
  regen:   { name:'재생', desc:'적이 체력을 회복',  color:'#5dff8f', regen:0.02 },
  swarm:   { name:'무리', desc:'적이 더 많이 등장', color:'#ffb14d', count:1.25 },
  elite:   { name:'정예', desc:'쓰러지면 분열하는 적', color:'#ff6bd6', split:true },
};
const ROUND_MOD_KEYS=Object.keys(ROUND_MODS);
function rollRoundMod(){ if(isBossRound(G.round)) return null; if(G.round<3) return null;   // 보스/초반 제외
  if(Math.random()<0.5) return null;   // 50% 무난
  return ROUND_MOD_KEYS[Math.floor(Math.random()*ROUND_MOD_KEYS.length)]; }
function announceRoundMod(){}   // 라운드 특성은 상단 배지(⚠특성명)로 상시 표시 — 채팅 알림 제거(알림 도배 방지)
function _mkAdd(d, hp, ar, spd, name, shape, race){ return {eid:G.eSeq++, d:((d||0)+1)%1, hp:hp, maxHp:hp, sh:0, maxSh:0, ar:ar||0,
  speed:spd, boss:false, special:false, pboss:false, life:null, flash:4, name:name||'적', shape:shape||'orb', race:race||'union', ph:(G.eSeq*0.7)%6.283, hit:0, model3d:null }; }
const BOSS_SUMMON_INT=12;   // 보스 소환 간격(초) — 필수처치 2분 라운드라 절제
function bossSummon(boss){ const m=roundDef(G.round), hp=Math.round(m.hp*0.5);
  for(let k=0;k<2;k++){ const e=_mkAdd((boss.d||0)+(Math.random()-0.5)*0.05, hp, 0, 0.024, '스커지', enemyShape('스커지'), enemyRace('스커지')); e.model3d=ENEMY_MODEL['스커지']||'stinger'; G.enemies.push(e); } }   // 보스 소환 = 스커지(3D 모델). 알림 채팅 없음 — 소환된 적은 화면에 보임
function splitEnemy(e){ const hp=Math.round((e.maxHp||e.hp)*0.4);
  for(let k=0;k<2;k++){ const ne=_mkAdd((e.d||0)+(k?0.015:-0.015), hp, Math.round((e.ar||0)*0.5), (e.speed||0.02)*1.15, e.name, e.shape, e.race); ne.model3d=e.model3d||null; G.enemies.push(ne); } }   // 분열 적도 부모 3D 모델 상속(2D 방지)
function beginActivePhase(){ G.roundPhase='active'; G.roundTime=isBossRound(G.round)?BOSS_ROUND_TIME:mapCfg('roundTime',ROUND_TIME); G.spawnTimer=0; G.pendSpawn.length=0;
  if(typeof playSfx==='function') playSfx(isBossRound(G.round)?'boss':'round_start');   // 라운드/보스 시작음
  if(isBossRound(G.round)){ G.roundMod=null; G.toSpawn=0; spawnEnemy({boss:true}); if(typeof playSfxT==='function') playSfxT('boss',1500); }   // 보스 라운드: 보스 1마리만(자체 패턴)
  else { G.roundMod=rollRoundMod(); let epr=mapCfg('enemiesPerRound',ENEMIES_PER_ROUND);
    if(G.roundMod && ROUND_MODS[G.roundMod].count) epr=Math.round(epr*ROUND_MODS[G.roundMod].count);   // 무리=수 증가
    G.toSpawn=epr; G.specialAt=1+Math.floor(Math.random()*epr); announceRoundMod(); } }
// ═══════════════════════ 🌫️ 전장의 안개(Fog of War) — Phase 1 코어 ═══════════════════════
// 맵별 토글: cfg.fog='full'(안개 켬) / 'off'(전부 보임, 기본). 격자 48×48(정규 0-1 맵).
// state 칸: 0=미탐색(검정) · 1=탐색(회색 안개, 지형만 기억) · 2=활성(밝음, 적 실시간). height=타일 고저(저지→고지 시야 차단).
const FOG_COLS=48, FOG_ROWS=48;
const TECH_HILL={ x0:0.075, y0:0.70, x1:0.33, y1:0.915, h:1 };   // ⛰ 건설 구역 좌하단 언덕(고지대, 월드 사각) — 고저 시야 테스트: 저지→고지 차단
// 👁 SC1 종족별 시야 범위(타일) — 건설 구역 유닛·건물. 미지정 유닛=7, 건물=8. 실제 격자 셀 반경 = 타일×FOG_SIGHT_SCALE
const FOG_SIGHT_SCALE=0.85, FOG_SIGHT_TILE_DEFAULT=7, FOG_BLDG_TILE_DEFAULT=8;
const TECH_SIGHT={
  union:{ unit:{ worker_human:7, marine:7, machinegun:7, medic:9, ghost:9, racer:8, tank:10, goliath:8, skyguard:7, pelican:8, hellfire:8, aegis:10, dreadnought:11, nuke:0 },
          bldg:{ command:10, bunker:10, turret:11 } },        // 미지정 건물=8 · 커맨드·벙커=10 · 터렛(디텍터)=11
  swarm:{ unit:{ worker_swarm:7, overlord:9, snapper:5, hydra:6, thornqueen:8, wyvern:7, stinger:5, medusa:10, venom:10, behemoth:11, ultralisk:7, broodling:5, larva:4 },
          bldg:{ hatchery:10, lair:10, hive:10, sunken:10, spore:10 } },   // 미지정 건물=8 · 본진·방어타워=10
  aetherial:{ unit:{ worker_light:8, blade:7, dragoon:8, high_templar:8, dark_templar:7, seraph:8, observer:9, skydancer:8, falcon:9, archangel:9, kronos:9, archon:8, reaver:10 },
              bldg:{ nexus:10, cannon:11 } } };               // 미지정 건물=8 · 넥서스=10 · 포톤캐논(디텍터)=11
function _techUnitSight(race,uid){ const t=TECH_SIGHT[race]&&TECH_SIGHT[race].unit[uid]; return (t!=null)?t:FOG_SIGHT_TILE_DEFAULT; }
function _techBldgSight(race,bk){ const t=TECH_SIGHT[race]&&TECH_SIGHT[race].bldg[bk]; return (t!=null)?t:FOG_BLDG_TILE_DEFAULT; }
function _fogSightCells(tiles){ return Math.max(2, Math.round((tiles||FOG_SIGHT_TILE_DEFAULT)*FOG_SIGHT_SCALE)); }   // SC 타일 → 안개 격자 셀 반경
// 🛫 테란(유니온) 건물 부양(Lift-off) — 본체 생산·테크 6종만. 부양=공중 판정(지형 무시 시야) + 기능 정지 + 애드온 분리 + 아주 느린 이동. (전투/HP/수리는 이 관리 탭엔 없어 제외)
const LIFT_BLDG={ command:1, barracks:1, engbay:1, factory:1, starport:1, scifac:1 };
const TECH_LIFT_SPD=0.06;   // 부양 건물 이동속도(월드/초) — 아주 느림(오버로드급)
const TECH_LIFT_T=2;        // 상승·하강 애니 시간(초) — 다 뜨면 이동 가능 / 다 내리면 생산 가능
const TECH_LIFT_PX=20;      // 부양 최대 높이(px, 3D + 히트박스 상승) — 살짝만 떠오르게(이전의 2/5)
function _techCanLift(bk){ return G.tech && G.tech.race==='union' && !!LIFT_BLDG[bk]; }
function fogEnabled(){ return !!(typeof G!=='undefined' && G.fog && G.fog.on); }
function fogInit(){ const on=(mapCfg('fog','off')==='full'), cols=FOG_COLS, rows=FOG_ROWS;
  G.fog={ on, cols, rows, state:new Uint8Array(cols*rows), height:new Uint8Array(cols*rows), t:0 };
  const hm=mapCfg('heightMap',null); if(hm) fogLoadHeight(hm);   // 맵 제공 고저(없으면 평지=전부 0)
  if(on) fogComputeVision(); }   // 시작 즉시 1회 점등(내 유닛 주변)
function fogLoadHeight(hm){ const f=G.fog; if(!f) return;   // hm: (tx,ty,cols,rows)→h 함수 | 2D 배열
  for(let ty=0;ty<f.rows;ty++){ for(let tx=0;tx<f.cols;tx++){ let h=0;
    if(typeof hm==='function') h=hm(tx,ty,f.cols,f.rows)||0;
    else if(Array.isArray(hm)){ const row=hm[Math.floor(ty/f.rows*hm.length)]; h=Array.isArray(row)?(row[Math.floor(tx/f.cols*row.length)]||0):(row||0); }
    f.height[ty*f.cols+tx]=h|0; } } }
function fogHeightAt(tx,ty,fog){ const f=fog||((typeof G!=='undefined')&&G.fog); if(!f) return 0; if(tx<0||ty<0||tx>=f.cols||ty>=f.rows) return 0; return f.height[ty*f.cols+tx]||0; }
function _fogTile(nx,ny,fog){ const f=fog||G.fog; return { tx:Math.max(0,Math.min(f.cols-1,Math.floor(nx*f.cols))), ty:Math.max(0,Math.min(f.rows-1,Math.floor(ny*f.rows))) }; }
function fogVisAt(nx,ny){ if(!fogEnabled()) return 2; const f=G.fog, t=_fogTile(nx,ny,f); return f.state[t.ty*f.cols+t.tx]; }   // 토글 off=항상 활성(전부 보임)
function _fogReveal(nx,ny,sight,air,fog,asp){ const f=fog||G.fog, t=_fogTile(nx,ny,f), vh=air?255:fogHeightAt(t.tx,t.ty,f);
  const rx=Math.max(1,sight), ry=Math.max(1,sight*(asp||1)), rxi=Math.ceil(rx), ryi=Math.ceil(ry);   // 화면상 원형이 되도록 세로 반경을 화면비(W/H)로 보정(정사각 격자가 세로 화면에 늘어나는 것 상쇄)
  for(let dy=-ryi;dy<=ryi;dy++){ const ty=t.ty+dy; if(ty<0||ty>=f.rows) continue; const nyd=dy/ry;
    for(let dx=-rxi;dx<=rxi;dx++){ const nxd=dx/rx; if(nxd*nxd+nyd*nyd>1) continue; const tx=t.tx+dx; if(tx<0||tx>=f.cols) continue;
      if(!air && fogHeightAt(tx,ty,f)>vh) continue;   // 저지→고지 차단(공중 유닛은 지형 무시)
      f.state[ty*f.cols+tx]=2; } } }   // 활성(타원 영역 → 화면에선 원)
function _fogViewers(){ const out=[]; if(!G.units) return out;
  for(const u of G.units){ if(!u) continue; const def=(typeof U!=='undefined'&&U[u.id])||{}; const tiles=def.sight||(u.fixed?FOG_BLDG_TILE_DEFAULT:FOG_SIGHT_TILE_DEFAULT); out.push({nx:u.x, ny:u.y, sight:_fogSightCells(tiles), air:!!(def.air||def.flying)}); }
  return out; }   // 내 유닛·고정 구조물이 시야 밝힘(적은 시야 안 밝힘) · def.sight=SC 타일(미지정=기본)
function fogComputeVision(){ const f=G&&G.fog; if(!f||!f.on) return; const asp=(typeof GW!=='undefined'&&GW&&GH)?GW/GH:1;
  for(let i=0;i<f.state.length;i++){ if(f.state[i]===2) f.state[i]=1; }   // 활성(2)→탐색(1) 강등 후 재점등
  for(const v of _fogViewers()) _fogReveal(v.nx, v.ny, v.sight, v.air, f, asp); }
function _fogBuffer(f){ if(!f._buf){ f._buf=document.createElement('canvas'); f._buf.width=f.cols; f._buf.height=f.rows; f._bx=f._buf.getContext('2d'); f._bi=f._bx.createImageData(f.cols,f.rows); }   // 저해상도 안개 버퍼(칸=1px) → 확대 시 양선형 보간으로 부드럽게
  const _tgt=(s)=>(s===0)?247:(s===1?128:0);   // 미탐색=247 / 탐색=128 / 활성=0(투명)
  if(!f.ren||f.ren.length!==f.state.length){ f.ren=new Float32Array(f.state.length); for(let i=0;i<f.state.length;i++) f.ren[i]=_tgt(f.state[i]); }   // 렌더 알파(부드러운 전이) — 최초엔 상태와 일치
  const now=(typeof performance!=='undefined'&&performance.now)?performance.now():0, dts=f._renT?Math.min(0.1,(now-f._renT)/1000):0.016; f._renT=now;
  const FADE=1-Math.exp(-dts/0.4);   // 어두워짐 시상수 ≈0.4s(살짝 늘어짐) · 밝아짐은 즉시
  const d=f._bi.data;
  for(let i=0,p=0;i<f.state.length;i++,p+=4){ const tg=_tgt(f.state[i]); let r=f.ren[i];
    if(tg<=r) r=tg; else r+=(tg-r)*FADE; f.ren[i]=r;   // 밝아짐(알파↓)=즉시 스냅 / 어두워짐(알파↑)=지연 페이드
    d[p]=2; d[p+1]=3; d[p+2]=8; d[p+3]=r; }
  f._bx.putImageData(f._bi,0,0); return f._buf; }
function drawFog(ctx,W,H){ const f=G&&G.fog; if(!f||!f.on) return;   // 🌫️ 안개 오버레이 — 검정=미탐색 / 회색=탐색 / 투명=활성. 저해상도 버퍼를 양선형 확대 → 부드러운 그라데이션
  const buf=_fogBuffer(f), sm=ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high';
  const _blur=Math.max(2,(W/f.cols)*0.9), _hf=('filter'in ctx); if(_hf) ctx.filter='blur('+_blur.toFixed(1)+'px)';   // 시야 테두리 더 둥글고 부드럽게
  ctx.drawImage(buf, 0, 0, W, H); if(_hf) ctx.filter='none'; ctx.imageSmoothingEnabled=sm; }
// ── 🌫️ 건설 구역(관리 탭) 전장의 안개 — G.tech.fog(메인과 독립). 🌫️ 버튼으로 토글, 내 워커·건물이 시야 밝힘 ──
function techFogInit(on){ if(!G.tech) return; const cols=FOG_COLS, rows=FOG_ROWS;
  const height=new Uint8Array(cols*rows), H=TECH_HILL;   // ⛰ 좌하단 언덕 = 고지대(height h)
  for(let ty=0;ty<rows;ty++){ const wy=(ty+0.5)/rows; for(let tx=0;tx<cols;tx++){ const wx=(tx+0.5)/cols;
    if(wx>=H.x0&&wx<=H.x1&&wy>=H.y0&&wy<=H.y1) height[ty*cols+tx]=H.h; } }
  G.tech.fog={ on:!!on, cols, rows, state:new Uint8Array(cols*rows), height, t:0 };
  if(on) techFogCompute(); }
function techFogEnabled(){ return !!(G.tech && G.tech.fog && G.tech.fog.on); }
function techFogVisAt(nx,ny){ if(!techFogEnabled()) return 2; const f=G.tech.fog, t=_fogTile(nx,ny,f); return f.state[t.ty*f.cols+t.tx]; }
function techFogHidden(nx,ny){ return techFogEnabled() && techFogVisAt(nx,ny)!==2; }
function techFogCompute(){ const f=G.tech&&G.tech.fog; if(!f||!f.on) return; const race=G.tech.race;
  const map=document.getElementById('cstMain'); const asp=(map&&map.clientWidth&&map.clientHeight)?map.clientWidth/map.clientHeight:0.62;   // 화면비 보정(세로 화면 → 원형 시야)
  const cpt=_techCW()*f.cols;   // 게임 타일 1칸 = 안개 셀 수(x). 시야값(타일)을 실제 크기로 — 점막·파일런과 동일한 "본체 + 반지름" 알고리즘
  for(let i=0;i<f.state.length;i++){ if(f.state[i]===2) f.state[i]=1; }   // 활성→탐색 강등
  for(const e of G.tech.ents){ if(!e) continue;
    if(e.type==='worker'){ const rt=_techUnitSight(race,TECH_WORKER[race])+0.5; _fogReveal(e.x,e.y,rt*cpt,false,f,asp); }                     // 워커: 반지름=시야+본체½
    else if(e.type==='bldg'){ const ft=_techFoot(race,e.bk)||{w:2,h:2}; const rt=_techBldgSight(race,e.bk)+Math.max(ft.w,ft.h)/2; _fogReveal(e.x,e.y,rt*cpt,!!e._lifted,f,asp); }   // 건물: 반지름=시야+본체½ · 부양=공중(지형 무시)
    else if(e.type==='unit'){ const rt=_techUnitSight(race,e.uid)+0.5; _fogReveal(e.x,e.y,rt*cpt,!!(typeof _techAirOf==='function'&&_techAirOf(e)),f,asp); } }
  if(G.tech._scans) for(const s of G.tech._scans){ if(s.t>0) _fogReveal(s.x,s.y,s.r*f.cols,true,f,asp); } }   // 📡 스캐너 스윕: 지점 시야(지형 무시)
function techFogDraw(){ const cv=document.getElementById('cstFog'); if(!cv) return;
  const map=document.getElementById('cstMain'); const W=(map&&map.clientWidth)||GW||360, H=(map&&map.clientHeight)||GH||420;
  if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; }
  const ctx=cv.getContext('2d'); ctx.clearRect(0,0,W,H);
  const f=G.tech&&G.tech.fog; if(!f||!f.on) return;
  const buf=_fogBuffer(f), tl=_techW2S(0,0), br=_techW2S(1,1);   // 격자 전체(월드 0~1)를 뷰 변환 사각으로 → 양선형 확대(부드러움)
  ctx.save(); ctx.beginPath(); ctx.rect(0,34,W,H-34); ctx.clip();   // 상단바(탭·자원) 위엔 안개 안 그림
  ctx.imageSmoothingEnabled=true; if(ctx.imageSmoothingQuality) ctx.imageSmoothingQuality='high';
  const _cellPx=(br.x-tl.x)*W/f.cols, _blur=Math.max(2,_cellPx*0.9), _hf=('filter'in ctx); if(_hf) ctx.filter='blur('+_blur.toFixed(1)+'px)';   // 시야 테두리 더 둥글고 부드럽게
  ctx.drawImage(buf, tl.x*W, tl.y*H, (br.x-tl.x)*W, (br.y-tl.y)*H);
  if(_hf) ctx.filter='none'; ctx.restore(); }
function techFog(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(!G.tech) return;
  if(!G.tech.fog) techFogInit(); G.tech.fog.on=!G.tech.fog.on; if(G.tech.fog.on) techFogCompute();
  if(typeof playSfx==='function') playSfx('ui_open'); techUIRender(); }
function step(dt){
  if(G.phase!=='playing') return;
  G.timeSec+=dt;   // 애니메이션용(증가 유지)
  if(fogEnabled()){ G.fog.t+=dt; if(G.fog.t>=0.1){ G.fog.t=0; fogComputeVision(); } }   // 🌫️ 시야 갱신(~10/s, 토글 켜진 맵만)
  // 라운드 타이머(카운트다운): 준비 10초 → 전투 1:00. 0초 도달 시 자동 진행.
  if(G.roundTime==null) G.roundTime=mapCfg('prepTime',PREP_TIME);
  G.roundTime-=dt;
  if(G.roundPhase!=='active'){   // 준비 단계: 유닛 뽑고 대기(첫 라운드 시작 전에만)
    if(G.roundTime<=0) beginActivePhase();
  } else {                       // 전투 단계: 제한시간 종료 시 바로 다음 라운드(준비시간 없음)
    if(G.roundTime<=0){
      if(isBossRound(G.round) && G.enemies.some(e=>e.boss && !e.pboss)){   // 보스 라운드: 2분 내 보스 미처치 → 통과 실패(패배)
        G.phase='lost'; if(typeof addChat==='function') addChat('', '⏱ 보스를 제한시간 내에 처치하지 못해 방어선이 무너졌습니다.'); if(typeof playSfx==='function') playSfx('lose'); showOverlay(); nemoGameOver('lost'); return; }
      const n=G.round+1;
      if(n>mapCfg('rounds',TOTAL_ROUNDS) && !mapCfg('infinite')){ G.phase='won'; if(typeof playSfx==='function') playSfx('win'); showOverlay(); nemoGameOver('won'); return; }
      gainGas(mapCfg('roundClearEnergyBase',1)+Math.floor(G.round*mapCfg('roundClearEnergyPer',0.34)));   // 라운드 클리어 보너스(하향)
    { const _cap=(mapCfg('interestCap',500)+((G.metaB&&G.metaB.interestCap)||0))*infIncomeMul(); const _per=mapCfg('interestPer',100);   // 라운드 정산 이자: 보유 크레딧 100당 N%(한도까지) — 비축 보상(무한=한도 수입배율)
      const _int=Math.floor(Math.min(G.mineral,_cap)/_per)*Math.round(_per*mapCfg('interestRate',0.05));
      if(_int>0){ const _bm=G.mineral; gainMineral(_int); toast('💰 이자 +'+(G.mineral-_bm)+' C (보유 '+_bm+' C)'); } }
      G.round=n; beginActivePhase(); }   // 2라운드부터는 준비시간 없이 즉시 전투
  }
  // 스폰(전투 단계, 일반 라운드만 — 50초 동안 0.5초당 1마리, 1마리는 스페셜)
  if(G.roundPhase==='active' && G.toSpawn>0){ G.spawnTimer-=dt; if(G.spawnTimer<=0){
    spawnEnemy({special: G.toSpawn===G.specialAt}); G.toSpawn--; G.spawnTimer=SPAWN_GAP; } }
  // 대기 스폰: 에너지 모임이 끝나는 시점(플래시)에 실제 적 등장
  for(let i=G.pendSpawn.length-1;i>=0;i--){ const ps=G.pendSpawn[i]; ps.t-=dt;
    if(ps.t<=0){ ps.e.flash=4; G.enemies.push(ps.e); G.pendSpawn.splice(i,1); if(typeof playEnemySpawn==='function') playEnemySpawn(); } }   // 실제 등장 시점에 적군 생산 효과음
  // 적 이동 + 누적 경고/탈락(200기)
  for(const e of G.enemies){ let _sm=(e.slowT>0)?(e.slowMul||0.5):1; if(e.slowT>0) e.slowT-=dt;
    if(e.arDownT>0){ e.arDownT-=dt; if(e.arDownT<=0) e.arDown=0; }   // 방깍 디버프 감쇠
    if(e.vulnT>0){ e.vulnT-=dt; if(e.vulnT<=0) e.vuln=0; }           // 마깍(취약) 디버프 감쇠
    if(e.regen>0 && e.hp<e.maxHp) e.hp=Math.min(e.maxHp, e.hp+e.maxHp*e.regen*dt);   // 재생 모디파이어
    if(e.boss && !e.pboss && !e.enraged && e.hp<=e.maxHp*0.4){ e.enraged=true; e.speed*=1.6; e.flash=10; if(typeof playSfx==='function') playSfx('warn'); }   // 보스 광폭화(HP 40%↓) — 채팅 제거(연출·소리만)
    if(e.stunT>0){ e.stunT-=dt; _sm=0;   // 감전: 제자리 정지
      if(Math.random()<dt*7){ const q=posAt(e.d,GW,GH); const qy=e.model3d?q.y-AIR_HIT_OFF:q.y;
        G.sparks.push({x:q.x+(Math.random()-0.5)*14,y:qy+(Math.random()-0.5)*12,vx:(Math.random()-0.5)*60,vy:(Math.random()-0.5)*60,life:0.14,len:3+Math.random()*3,color:Math.random()<0.5?'#b48bff':'#eadcff'}); } }
    if(e.psnT>0){ e.psnT-=dt; e.psnTick=(e.psnTick||RPSN_TICK)-dt;   // 맹독: 틱마다 중첩×틱데미지
      if(e.psnTick<=0){ e.psnTick=RPSN_TICK; _atkUid=e.psnUid; _dotHit=true; hitEnemy(e,(e.psnStk||1)*(e.psnDmg||1)); _dotHit=false;
        const q=posAt(e.d,GW,GH); const qy=e.model3d?q.y-AIR_HIT_OFF:q.y;   // 독방울 비주얼(초록 낙하)
        G.sparks.push({x:q.x+(Math.random()-0.5)*10,y:qy+(Math.random()-0.5)*8,vx:(Math.random()-0.5)*18,vy:26+Math.random()*22,life:0.3,len:2.5,color:Math.random()<0.5?'#9fd356':'#d6ff7a'}); }
      if(e.psnT<=0){ e.psnStk=0; e.psnDmg=0; } }
    if(e.pboss && e.life!=null) e.life-=dt;   // 개인 보스 수명(2분) 카운트다운
    e.d=(e.d+e.speed*_sm*dt*4)%1; if(e.flash>0) e.flash--; if(e.hit>0) e.hit=Math.max(0,e.hit-dt*5); if(e.shHit>0) e.shHit=Math.max(0,e.shHit-dt*4); }
  if(G.roundPhase==='active'){ for(const e of G.enemies){ if(!e.boss||e.pboss) continue;   // 라운드 보스 주기적 소환
    e.summonT=(e.summonT==null?BOSS_SUMMON_INT:e.summonT)-dt; if(e.summonT<=0){ e.summonT=BOSS_SUMMON_INT; bossSummon(e); } } }
  if(G.pbossCds){ for(const k in G.pbossCds){ if(G.pbossCds[k]>0) G.pbossCds[k]=Math.max(0,G.pbossCds[k]-dt); } }   // 개인 보스 재소환 쿨다운(보스별 개별)
  const _regCnt=G.enemies.reduce((a,e)=>a+(e.pboss?0:1),0);   // 탈락 누적은 일반 적만(개인 보스 제외)
  checkEnemyWarn(_regCnt);
  if(_regCnt>=mapCfg('loseCount',LOSE_COUNT)){ addChat('', '⚠️ '+(G.myPlayer||1)+'번 플레이어가 탈락하였습니다.'); G.phase='lost'; if(typeof playSfx==='function') playSfx('lose'); showOverlay(); nemoGameOver('lost'); return; }
  unitAI(dt);   // 명령 이동(공격이동/반복이동) + 스킬 타이머
  // 보스방 파견 유닛 → 공용 보스 직접 공격(트랙 방어 제외) + 유닛별 공격 이펙트
  if(G.coopBoss && !G.coopBoss.dead){ const sentB=G.units.filter(u=>u.atBoss);
    for(let i=0;i<sentB.length;i++){ const u=sentB[i];
      if(u.btx!=null){ const dx=u.btx-u.bx, dy=u.bty-u.by, d=Math.hypot(dx,dy);
        const sp=((U[u.id]&&U[u.id].moveSpd)||0.13)*MOVE_MUL*dt;   // 메인 트랙과 동일한 유닛별 이동속도
        if(d<0.008){ u.bx=u.btx; u.by=u.bty; u.btx=null; u.bMov=false; }
        else { u.bx+=dx/d*Math.min(sp,d); u.by+=dy/d*Math.min(sp,d); u.bMov=true; u.bMvx=dx/d; u.bMvy=dy/d;
          if(AIR_FLOAT_GIDS[u.gid] && G.bossOpen && BAW){ const ex=u.bx*BAW, ey=u.by*BAH-16, emx=u.bMvx, emy=u.bMvy;
            withBossFx(()=>emitEngineExhaust(u, ex, ey, emx, emy, dt)); }   // 토벌장 이동 분사
          continue; } }   // 이동 중엔 공격 안 함
      else u.bMov=false;
      if(isTransport(u)) continue;   // 수송선: 보스방에서도 공격 안 함
      if(G.bossOpen && BAW && (u.gmodel==='racer'||u.gmodel==='machinegun')){   // 레이서/발칸: cd와 무관한 연속 스트림(메인과 동일)
        const MN2=Math.min(BAW,BAH), bx2=BAW*0.5+(Math.random()-.5)*MN2*0.04, by2=BAH*BOSS_FEET_FRAC-MN2*0.05;
        u._bmgT=(u._bmgT||0)-dt;
        if(u._bmgT<=0){ u._bmgT=(u.gmodel==='racer')?0.032:0.04;
          withBossFx(()=>{ if(u.gmodel==='racer') emitRacerTracer(u, u.bx*BAW, u.by*BAH, bx2, by2);
            else emitVulcanSpray(u, u.bx*BAW, u.by*BAH, bx2, by2); }); } }
      if(u.bcd>0){ u.bcd-=dt*60; continue; }
      const bdef=U[u.id]; let bdmg=unitDmg(u)*(1+buildLevel('boss_atk_up')*0.01);   // 메타: 파견 유닛 보스 데미지 증가
      { const _co=cdOf(u,bdef); if(_co!==bdef.cd && !GDMG_OVR[u.gid]) bdmg*=_co/bdef.cd; }
      coopBossDamage(bdmg, G.myPlayer||1, false); u.fireSeq=(u.fireSeq||0)+1;
      if(G.bossOpen && BAW){ const MN=Math.min(BAW,BAH);   // 토벌장 보는 중: 메인과 동일한 fireAttack 이펙트(전용 배열·전용 좌표계)
        const ux=u.bx*BAW, uy=u.by*BAH, tp={x:BAW*0.5+(Math.random()-.5)*MN*0.05, y:BAH*BOSS_FEET_FRAC-MN*0.04};
        if(typeof playUnitAttack==='function') playUnitAttack(u.id);
        withBossFx(()=>fireAttack(u, bdef, ux, uy, tp, null, bdmg)); }
      u.bcd=cdOf(u,bdef); } }
  // 토벌장 보는 중: 다른 플레이어 파견 유닛의 공격도 같은 이펙트로 재생(데미지는 각자 bossdmg로 공유됨)
  if(G.bossOpen && BAW && G.coopBossU){ const MN=Math.min(BAW,BAH); G._bSeen=G._bSeen||{};
    for(const k in G.coopBossU){ const sn=G.coopBossU[k]; if(!sn||!sn.cur) continue; if(Date.now()-sn.t>3000) continue;
      for(const ru of sn.cur){ const seen=G._bSeen[ru.uid]||0;
        if((ru.fireSeq||0)>seen){ G._bSeen[ru.uid]=ru.fireSeq;
          const rdef=U[ru.id]||U.marine, ux=ru.bx*BAW, uy=ru.by*BAH;
          const tp={x:BAW*0.5+(Math.random()-.5)*MN*0.05, y:BAH*BOSS_FEET_FRAC-MN*0.04};
          withBossFx(()=>fireAttack(ru, rdef, ux, uy, tp, null, 0)); } } } }
  // 팀 특성 버프(공격력/공속) — 보유 유닛의 atk_buff·atkspd_buff 합산(상한)
  { let na=0,ns=0; for(const u of G.units){ if(!u.gid) continue; const d=GACHA_UNITS[u.gid]; const tr=d&&d.traits; if(!tr||!tr.length) continue;
      if(tr.indexOf('atk_buff')>=0) na++; if(tr.indexOf('atkspd_buff')>=0) ns++; }
    G.teamAtk=1+Math.min(na*TRAIT.atkBuffPer,TRAIT.atkBuffCap); G.teamSpd=1+Math.min(ns*TRAIT.spdBuffPer,TRAIT.spdBuffCap); }
  // 유닛 자동 공격
  for(const u of G.units){ if(u.atBoss) continue;   // 보스방 파견 유닛은 트랙 전투 제외
    if(isTransport(u)) continue;   // 수송선: 공격·조준(적 바라보기) 안 함
    const def=U[u.id]; if(u.atkT>0) u.atkT-=dt;
    const ux=u.x*GW, uy=u.y*GH, range=def.range*Math.min(GW,GH)*gachaRangeMul(u);   // 가챠 근접형 사거리 단축
    let tgt=null,best=range*range, tgtX=0,tgtY=0;
    for(const e of G.enemies){ const p=posAt(e.d,GW,GH); const dx=p.x-ux,dy=p.y-uy,d2=dx*dx+dy*dy; if(d2<=best){best=d2;tgt=e;tgtX=p.x;tgtY=p.y;} }
    if(u.cmd==='focus'){   // 지정공격: 지정한 적만(사거리 내일 때) 공격
      const fe=u.focusTarget!=null?G.enemies.find(e=>e.eid===u.focusTarget):null;
      if(fe){ const p=posAt(fe.d,GW,GH); const dx=p.x-ux,dy=p.y-uy; if(dx*dx+dy*dy<=range*range){ tgt=fe; tgtX=p.x; tgtY=p.y; } else tgt=null; } else tgt=null; }
    if(!tgt){   // 사거리 내 적 없음 → 보스(트랙을 돌아 사거리에 잘 안 듦)를 무제한 사거리로 타격. 보스 타격 시에만 사거리 제한 해제
      let bD=Infinity,bE=null,bx=0,by=0;
      for(const e of G.enemies){ if(!e.boss) continue; const p=posAt(e.d,GW,GH); const dx=p.x-ux,dy=p.y-uy,d2=dx*dx+dy*dy; if(d2<bD){ bD=d2; bE=e; bx=p.x; by=p.y; } }
      if(bE){ tgt=bE; tgtX=bx; tgtY=by; } }
    if(def.model3d && tgt && !u.moving){ const fa=Math.atan2(tgtX-ux, tgtY-uy); u.face=Math.round(fa/(Math.PI/8))*(Math.PI/8); }  // 정지 + 대상 바라봄
    if(u.gmodel==='racer'){   // 레이서: 데미지 cd와 무관하게 끊김 없는 기관총 스트림(시각)
      const canShoot = tgt && !(u.moving && u.cmd!=='attack' && u.cmd!=='focus');
      if(canShoot){ u._mgT=(u._mgT||0)-dt; if(u._mgT<=0){ u._mgT=0.032; emitRacerTracer(u,ux,uy,tgtX,tgtY-(tgt.model3d?AIR_HIT_OFF:0)); } }   // ~31발/초 시각(공중 유닛은 부유 위치로 보정)
    }
    if(u.gmodel==='machinegun'){   // 발칸: 매 프레임 랜덤 각도 한 발씩(기관총 난사 — 샷건식 동시발사 아님)
      const canShoot = tgt && !(u.moving && u.cmd!=='attack' && u.cmd!=='focus');
      if(canShoot){ u._mgT=(u._mgT||0)-dt; if(u._mgT<=0){ u._mgT=0.04; emitVulcanSpray(u,ux,uy,tgtX,tgtY-(tgt.model3d?AIR_HIT_OFF:0)); } }   // 양손 2발씩 ≈50발/초 집중포화
    }
    if(u.cd>0){ u.cd-=dt*60; continue; }
    if(u.moving && u.cmd!=='attack' && u.cmd!=='focus') continue;   // 이동 중엔 공격 불가(스타식). 단 공격이동·지정공격은 이동하면서도 공격
    if(tgt){ const tp=posAt(tgt.d,GW,GH); if(tgt.model3d) tp.y-=AIR_HIT_OFF; let dmg=unitDmg(u);  // 공중 적은 부유 위치(위)로 타격
      { const _co=cdOf(u,def); if(_co!==def.cd && !GDMG_OVR[u.gid]) dmg*=_co/def.cd; }   // 쿨다운 오버라이드 → 퍼샷 데미지 비례(DPS 유지). 명시 dmg 오버라이드 유닛은 제외
      const ps=PROJ_SPD[def.atk];
      u.fireSeq=(u.fireSeq||0)+1;  // 발사 카운터(3D 공격모션 트리거)
      if(typeof playUnitAttack==='function') playUnitAttack(u.id);   // 유닛별 공격 효과음(내 유닛)
      _atkUid=u.uid; const _sb=G.shots.length, _pb=G.pendingHits.length, _mb=(G.matronWaves||[]).length;   // 킬 귀속: 이번 공격 출처
      if(u.gid==='ranger_god'){ // 레인저 갓: 사거리 내 최대 5마리에 5발 저격(1마리면 5발 집중)
        fireRangerGodVolley(u,def,ux,uy,dmg);
      } else if(u.gid==='strider_god'){ // 스트라이더 갓: 어깨 포드 미사일 폭격 볼리(최대 6표적, 시간차 낙하, 소광역)
        fireStriderGodBarrage(u,def,ux,uy,dmg);
      } else if(ps && u.gid!=='skydancer_t'){ // 발사체: 대상 적을 끝까지 추적(유도) → 명중 시 데미지. 스카이댄서=즉발 빔(아래 즉발 경로)
        fireAttack(u,def,ux,uy,tp, tgt.eid, dmg);
      } else if(u.gid==='matron_t'){ // 매트론: 가시 연쇄(직격+연쇄 데미지+가시 비주얼)
        matronStartChain(u,tgt,dmg,ux,uy,tp);
      } else { // 즉발(빔/사이오닉): 즉시 데미지
        hitEnemy(tgt,dmg);
        const sR=(u.gid==='skydancer_t')?0.045:(def.splash?SPLASH_R:0);   // 스카이댄서=좁은 광역(에너지 수렴 범위)
        if(sR){ const r2=Math.pow(sR*Math.min(GW,GH),2); const sRatio=(u.gid==='skydancer_t')?0.8:SPLASH_RATIO; for(const e of G.enemies){ if(e===tgt)continue; const p=posAt(e.d,GW,GH); const ey=(e.model3d?p.y-AIR_HIT_OFF:p.y); const dx=p.x-tp.x,dy=ey-tp.y; if(dx*dx+dy*dy<=r2) hitEnemy(e,dmg*sRatio); } }   // tp가 공중 보정된 만큼 비교 위치도 보정(좁은 반경에서 어긋남 방지)
        fireAttack(u,def,ux,uy,tp);
      }
      for(let k=_sb;k<G.shots.length;k++) G.shots[k].uid=u.uid;            // 이번 공격이 만든 발사체에 출처 태깅
      for(let k=_pb;k<G.pendingHits.length;k++) G.pendingHits[k].uid=u.uid;
      for(let k=_mb;k<(G.matronWaves||[]).length;k++) G.matronWaves[k].uid=u.uid;
      const cdv=cdOf(u,def)*(u.adr>0?0.5:1)*((G.metaB&&G.metaB.aspdMul)||1); u.cd=cdv; u.cdMax=cdv; u.atkT=0.6; } }  // 레이서·발칸=초고속 연사. 아드레날린 0.5배. ×메타 공격속도(aspdMul). cdMax=장전 진행도용
  // 명중 대기(발사체) 처리 — 도달 시 데미지 적용
  for(let i=G.pendingHits.length-1;i>=0;i--){ const h=G.pendingHits[i]; h.t+=dt;
    if(h.t>=h.dur){ const e=G.enemies.find(x=>x.eid===h.eid);
      if(e){ _atkUid=h.uid; hitEnemy(e,h.dmg);
        if(h.splash){ const r2=Math.pow(SPLASH_R*Math.min(GW,GH),2); const p=posAt(e.d,GW,GH);
          for(const o of G.enemies){ if(o===e)continue; const q=posAt(o.d,GW,GH); const dx=q.x-p.x,dy=q.y-p.y; if(dx*dx+dy*dy<=r2) hitEnemy(o,h.dmg*SPLASH_RATIO); } } }
      G.pendingHits.splice(i,1); } }
  stepMatronWaves(dt);   // 매트론 가시 연쇄: 시간차 전파(한 마리→주변→그 주변)
  // 처치
  for(let i=G.enemies.length-1;i>=0;i--){ const e=G.enemies[i];
    if(e.pboss && e.hp>0 && e.life!=null && e.life<=0){ toast('☠ '+e.name+' 도주 (미처치)'); deathBurst(e); G.enemies.splice(i,1); if(G.selEnemy===e.eid){G.selEnemy=null;refreshSelCard();} continue; }   // 2분 경과 소멸(보상·불이익 없음)
    if(e.hp<=0){ G.kills++;
    if(e._killer!=null){ const _k=G.units.find(x=>x.uid===e._killer); if(_k) _k.kills=(_k.kills||0)+1; }   // 개별 유닛 킬 카운트
    if(e.pboss){ const bn=e.bonus||0, be=e.bonusE||0; gainMineral(bn); if(be>0) gainGas(be); toast('☠ '+e.name+' 처치 (+'+bn+' M'+(be>0?' / +'+be+' G':'')+')'); if(typeof playSfx==='function') playSfx('hero_merge'); }
    else if(e.boss) toast('☠ 라운드 보스 처치!');
    if(e.special){ const _im=infIncomeMul(), sc=mapCfg('specialCredit',SPECIAL_MIN); gainMineral(Math.round(sc*_im)); gainGas(Math.round(2*_im)); }   // 스페셜=크레딧+에너지(무한=수입배율)
    if(e.boss && !e.pboss){ gainGas(5+Math.floor(G.round/4)); }   // 라운드 보스 처치=에너지 보너스(개인 보스는 크레딧만)
    G._minAcc=(G._minAcc||0)+mapCfg('killCredit',1)*infIncomeMul(); if(G._minAcc>=1){ const _mw=Math.floor(G._minAcc); G._minAcc-=_mw; gainMineral(_mw); }   // 킬 보상(무한=수입배율, 소수 누적)
    G._gasAcc=(G._gasAcc||0)+mapCfg('killEnergy',0.05)*infIncomeMul(); if(G._gasAcc>=1){ const w=Math.floor(G._gasAcc); G._gasAcc-=w; gainGas(w); }   // 킬 드립 에너지(무한=수입배율, 누적)
    if(typeof playEnemyDeath==='function') playEnemyDeath(e.race);   // 종족별 처치음(대량 처치 쓰로틀)
    if(e.split>0) splitEnemy(e);   // 정예(분열): 쓰러지면 체력 40% 적 2마리로
    deathBurst(e); G.enemies.splice(i,1); } }
  // (라운드 진행은 위쪽 제한시간 타이머가 담당 — 클리어로는 넘어가지 않음)
  // 이펙트 수명/이동 — 메인 배열 + 토벌장 전용 배열 각각 전진(서로 영향 없음)
  for(let i=G.recalls.length-1;i>=0;i--){ G.recalls[i].life-=dt/RECALL_DUR; if(G.recalls[i].life<=0) G.recalls.splice(i,1); }
  advanceFx(dt);
  withBossFx(()=>advanceFx(dt));
}
// 이펙트 배열 전진(수명·이동·유도) — step()에서 메인/토벌장 두 컨텍스트로 호출
function advanceFx(dt){
  for(let i=G.beams.length-1;i>=0;i--){ G.beams[i].life-=dt*8; if(G.beams[i].life<=0) G.beams.splice(i,1); }
  for(let i=G.muzzles.length-1;i>=0;i--){ G.muzzles[i].life-=dt*14; if(G.muzzles[i].life<=0) G.muzzles.splice(i,1); }
  for(let i=G.impacts.length-1;i>=0;i--){ const m=G.impacts[i]; m.life-=dt*(m.dk||6); if(m.life<=0) G.impacts.splice(i,1); }
  for(let i=G.debris.length-1;i>=0;i--){ const f=G.debris[i]; f.x+=f.vx*dt; f.y+=f.vy*dt; f.vx*=0.94; f.vy*=0.94; f.rot+=f.spin*dt; f.life-=dt*2.2; if(f.life<=0) G.debris.splice(i,1); }
  for(let i=G.sparks.length-1;i>=0;i--){ const s=G.sparks[i]; s.x+=s.vx*dt; s.y+=s.vy*dt; const fr=s.fr||0.84; s.vx*=fr; s.vy*=fr; s.life-=dt*(s.dk||5.5); if(s.life<=0) G.sparks.splice(i,1); }
  for(let i=G.shots.length-1;i>=0;i--){ const s=G.shots[i];
    if(s.launchT>0){ s.launchT-=dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.vx*=0.93; s.vy*=0.93; continue; }  // 분출 단계: 잠깐 직진(감속) 후 유도 시작(베놈퀸 가시)
    if(s.vt){ // 가상 목표 유도(토벌장): 고정 지점으로 곡선 유도 후 명중 연출 — 데미지 없음(보스 데미지는 별도)
      const dx=s.vt.x-s.x, dy=s.vt.y-s.y, d=Math.hypot(dx,dy)||1;
      if(d<=s.spd*dt+HIT_R){
        if(s.kind==='needle'){ for(let q=0;q<5;q++){ const a=Math.atan2(-dy,-dx)+(Math.random()-0.5)*1.5, sp2=60+Math.random()*120; G.sparks.push({x:s.vt.x,y:s.vt.y,vx:Math.cos(a)*sp2,vy:Math.sin(a)*sp2,life:0.4,len:2+Math.random()*3,color:q%2?'#d6ff7a':'#9fd356'}); } G.impacts.push({x:s.vt.x,y:s.vt.y,life:1,r:6,color:s.color}); }
        else if(s.gboom){ striderGodBoom(s.vt.x,s.vt.y); }                      // 스트라이더 갓 소형 화염 폭발
        else if(s.sboom){ sentinelGodBlast(s.vt.x,s.vt.y,s,null); }             // 센티넬 갓 대폭발(보스장은 연출만 — 내부 _baFire 가드)
        else G.impacts.push({x:s.vt.x,y:s.vt.y,life:1,r:s.boom||14,color:s.color});
        G.shots.splice(i,1); continue;
      }
      if(s.turn){ const tdx=dx/d, tdy=dy/d, sp=Math.hypot(s.vx,s.vy)||s.spd, cdx=s.vx/sp, cdy=s.vy/sp, bl=Math.min(1, dt*s.turn*Math.max(1,70/Math.max(d,1)));   // 근접 선회 부스트(공전 방지)
        let nvx=cdx+(tdx-cdx)*bl, nvy=cdy+(tdy-cdy)*bl, nl=Math.hypot(nvx,nvy)||1; s.vx=nvx/nl*s.spd; s.vy=nvy/nl*s.spd;
      } else { s.vx=dx/d*s.spd; s.vy=dy/d*s.spd; }
      s.x+=s.vx*dt; s.y+=s.vy*dt;
    } else if(s.eid!=null){ // 유도 발사체: 대상 적을 끝까지 추적 → 명중 시 데미지
      const e=G.enemies.find(x=>x.eid===s.eid);
      if(e){ const p=posAt(e.d,GW,GH); if(e.model3d) p.y-=AIR_HIT_OFF;  // 적의 현재 위치(공중 보정)
        s.lkx=p.x; s.lky=p.y;   // 마지막 표적 위치 기억(대상 사망 시 그 자리에서 소멸 — 통과 방지)
        const dx=p.x-s.x, dy=p.y-s.y, d=Math.hypot(dx,dy)||1;
        if(d<=s.spd*dt+HIT_R){ // 명중
          _atkUid=s.uid; hitEnemy(e, s.dmg);
          if(s.psn){ e.psnStk=Math.min(RPSN_MAX,(e.psnStk||0)+1); e.psnT=RPSN_DUR; e.psnDmg=Math.max(e.psnDmg||0,s.psn); e.psnUid=s.uid; }   // 맹독 중첩(상한)·지속 갱신·출처
          if(s.splash){ const r2=Math.pow((s.splashR||SPLASH_R)*Math.min(GW,GH),2); for(const o of G.enemies){ if(o===e)continue; const q=posAt(o.d,GW,GH); const ax=q.x-p.x,ay=q.y-p.y; if(ax*ax+ay*ay<=r2) hitEnemy(o,s.dmg*SPLASH_RATIO); } }
          if(s.kind==='bullet'||s.kind==='sniper'||s.kind==='mg'){ const sn=s.kind==='sniper'; spawnSparks(p.x,p.y,-dx/d,-dy/d,sn?'#eaffff':'#ffe6a0'); G.impacts.push({x:p.x,y:p.y,life:1,r:sn?5:(s.kind==='mg'?2.5:3.5),color:sn?'#eafdff':'#fff6d8'}); }
          else if(s.kind==='needle'){ for(let q=0;q<5;q++){ const a=Math.atan2(-dy,-dx)+(Math.random()-0.5)*1.5, sp=60+Math.random()*120; G.sparks.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.4,len:2+Math.random()*3,color:q%2?'#d6ff7a':'#9fd356'}); } G.impacts.push({x:p.x,y:p.y,life:1,r:6,color:s.color}); }  // 침 박힘 — 초록 점액 튀김
          else if(s.kind==='shell'){ breakerExplosion(p.x,p.y); }   // 브레이커 포탄 — 큰 폭발
          else if(s.sboom){ sentinelGodBlast(p.x,p.y,s,e); }   // 센티넬 갓 — 대광역 폭발+감전(직격은 위에서 적용)
          else if(s.crackle){ sentinelBurst(p.x,p.y,s.color); }   // 센티넬 구체 — 찌릿한 에너지 방출 폭발
          else if(s.gboom){ striderGodBoom(p.x,p.y); }   // 스트라이더 갓 미사일 — 소형 화염 폭발
          else G.impacts.push({x:p.x,y:p.y,life:1,r:s.boom||14,color:s.color});
          G.shots.splice(i,1); continue;
        }
        let ax=p.x, ay=p.y;
        if(s.side){ const sep=Math.min(d*0.22,16), px=-dy/d, py=dx/d; ax=p.x+px*s.side*sep; ay=p.y+py*s.side*sep; }  // 미사일: 좌우로 벌어진 경로(멀수록 벌어지고 가까우면 수렴)
        const adx=ax-s.x, ady=ay-s.y, ad=Math.hypot(adx,ady)||1;
        if(s.turn){ // 부드러운 곡선 유도: 현재 방향을 목표 방향으로 서서히 회전(스냅 X)
          const tdx=adx/ad, tdy=ady/ad, sp=Math.hypot(s.vx,s.vy)||s.spd, cdx=s.vx/sp, cdy=s.vy/sp, bl=Math.min(1, dt*s.turn*Math.max(1,70/Math.max(ad,1)));   // 근접 선회 부스트(공전 방지)
          let nvx=cdx+(tdx-cdx)*bl, nvy=cdy+(tdy-cdy)*bl, nl=Math.hypot(nvx,nvy)||1; s.vx=nvx/nl*s.spd; s.vy=nvy/nl*s.spd;
        } else { s.vx=adx/ad*s.spd; s.vy=ady/ad*s.spd; }
        s.x+=s.vx*dt; s.y+=s.vy*dt;  // 조준점 쪽으로 유도
      } else if(s.lkx!=null){ // 표적 사망 → 죽은 자리로 계속 유도 후 그 자리에서 소멸(통과 방지)
        const dx=s.lkx-s.x, dy=s.lky-s.y, d=Math.hypot(dx,dy)||1;
        if(d<=s.spd*dt+HIT_R){   // 죽은 자리 도달 → 명중 이펙트 후 소멸(데미지 없음 — 대상 이미 사망)
          if(s.sboom){ sentinelGodBlast(s.lkx,s.lky,s,null); }
          else if(s.gboom){ striderGodBoom(s.lkx,s.lky);
            const r2=Math.pow((s.splashR||SPLASH_R)*Math.min(GW,GH),2);   // 갓 발사체: 죽은 자리 폭발도 주변 스플래시 적용
            for(const o of G.enemies){ const q=posAt(o.d,GW,GH); const qy=o.model3d?q.y-AIR_HIT_OFF:q.y;
              const ax=q.x-s.lkx, ay=qy-s.lky; if(ax*ax+ay*ay<=r2) hitEnemy(o,s.dmg*SPLASH_RATIO); } }
          else if(s.kind==='bullet'||s.kind==='sniper'||s.kind==='mg'){ const sn=s.kind==='sniper', sp2=Math.hypot(s.vx,s.vy)||1; spawnSparks(s.lkx,s.lky,-s.vx/sp2,-s.vy/sp2,sn?'#eaffff':'#ffe6a0'); G.impacts.push({x:s.lkx,y:s.lky,life:1,r:sn?5:(s.kind==='mg'?2.5:3.5),color:sn?'#eafdff':'#fff6d8'}); }
          else if(s.kind==='needle'){ for(let q=0;q<5;q++){ const a=Math.random()*6.283, sp2=60+Math.random()*120; G.sparks.push({x:s.lkx,y:s.lky,vx:Math.cos(a)*sp2,vy:Math.sin(a)*sp2,life:0.4,len:2+Math.random()*3,color:q%2?'#d6ff7a':'#9fd356'}); } G.impacts.push({x:s.lkx,y:s.lky,life:1,r:6,color:s.color}); }
          else if(s.kind==='shell'){ breakerExplosion(s.lkx,s.lky); }
          else G.impacts.push({x:s.lkx,y:s.lky,life:1,r:s.boom||14,color:s.color});   // 미사일 등: 그 자리에서 작은 폭발
          G.shots.splice(i,1); continue; }
        const sp=Math.hypot(s.vx,s.vy)||s.spd, cdx=s.vx/sp, cdy=s.vy/sp, bl=Math.min(1,dt*(s.turn||8)*Math.max(1,70/Math.max(d,1)));   // 근접 선회 부스트(공전 방지)
        let nvx=cdx+(dx/d-cdx)*bl, nvy=cdy+(dy/d-cdy)*bl, nl=Math.hypot(nvx,nvy)||1; s.vx=nvx/nl*s.spd; s.vy=nvy/nl*s.spd;
        s.x+=s.vx*dt; s.y+=s.vy*dt;
      } else { s.x+=s.vx*dt; s.y+=s.vy*dt; s.miss=(s.miss||0)+dt; if(s.miss>0.6){ G.shots.splice(i,1); continue; } } // (lkx 미기록 예외) 잠시 직진 후 소멸
    } else { // 비유도(예비)
      s.x+=s.vx*dt; s.y+=s.vy*dt; s.t+=dt;
      if(s.t>=s.dur && s.kind==='nukefall'){   // 핵 착탄: 대형 폭발 + 반경 내 전 적에게 풀데미지
        detonateExplosion(s.tx,s.ty,(s.nR||40)*NUKE_VIS);   // 이펙트는 피해 반경보다 작게(절제)
        if(s.nDmg){ for(const o of G.enemies){ const q=posAt(o.d,GW,GH); const qy=o.model3d?q.y-AIR_HIT_OFF:q.y;
          const dx=q.x-s.tx, dy=qy-s.ty; if(dx*dx+dy*dy<=s.nR*s.nR) hitEnemy(o,s.nDmg); } }
        if(typeof playSfxT==='function') playSfxT('attack_goliath',250);
        G.shots.splice(i,1); continue; }
      if(s.t>=s.dur){ if(!s.cosmetic) G.impacts.push({x:s.tx,y:s.ty,life:1,r:s.boom||14,color:s.color});   // 코스메틱(연사 잔탄)은 폭발 없이 대상에서 소멸
        else if(s.kind==='mg' && Math.random()<0.5){ G.impacts.push({x:s.tx,y:s.ty,life:1,r:2.2,color:'#fff6d8'}); }  // 레이서: 명중 지점 작은 탄착
        else if(s.kind==='mgf'){ if(Math.random()<0.5){ G.impacts.push({x:s.tx,y:s.ty,life:1,r:3,color:'#ffcf8a'}); }   // 발칸: 작은 화염 탄착 + 불티(연속 피격감)
          if(Math.random()<0.4){ G.sparks.push({x:s.tx,y:s.ty,vx:(Math.random()-0.5)*130,vy:(Math.random()-0.5)*130,life:0.16,flash:true,color:Math.random()<0.5?'#ffae4d':'#ff6a2c'}); } }
        G.shots.splice(i,1); continue; }
    }
    if(s.kind==='missile'){ s.trailT=(s.trailT||0)-dt; if(s.trailT<=0){ s.trailT=0.05;  // 트레일 퍼프(간격 두고 — 화염방사 X)
      const mm=Math.hypot(s.vx,s.vy)||1, bx=s.x-s.vx/mm*6, by=s.y-s.vy/mm*6;
      G.sparks.push({x:bx,y:by,vx:0,vy:0,life:0.7,flash:true,color:'#ff9a4c'}); } }
  }
}

// ── 유닛별 공격 이펙트 발사 ──
//  rifle: 가는 저격 빔 + 총구섬광 / bullet: 빠른 작은 탄 / spike: 가시 투사체
//  plasma: 큰 플라즈마 구체(잔광) / missile: 2발 미사일 / psi: 즉발 사이오닉 폭발
const RACER_BULLET_SPD = 820;   // 레이서 탄속
// 레이서: 데미지 탄 1발(유도) + 발사 섬광. 연속 스트림은 emitRacerTracer가 매 프레임 별도로 뿜음
function fireRacerMG(u,def,ux,uy,tp,eid,dmg){
  const dist=Math.hypot(tp.x-ux,tp.y-uy)||1, nx=(tp.x-ux)/dist, ny=(tp.y-uy)/dist, ang=Math.atan2(ny,nx);
  const mx=ux+nx*MUZZLE_FWD, my=uy+ny*MUZZLE_FWD-3, spd=RACER_BULLET_SPD;
  const md0=Math.hypot(tp.x-mx,tp.y-my)||1;
  G.shots.push({x:mx,y:my,tx:tp.x,ty:tp.y,vx:nx*spd,vy:ny*spd,t:0,dur:md0/spd,color:'#fff2c0',boom:4,kind:'mg',ang:ang,eid:eid,dmg:dmg,splash:!!def.splash,spd:spd});
}
// 레이서 연속 기관총 시각 스트림 — 데미지 cd와 무관하게 매우 짧은 간격으로 얇은 탄을 뿜어 끊김 없는 스트림
function emitRacerTracer(u, ux, uy, tx, ty){
  const dx=tx-ux, dy=ty-uy, d=Math.hypot(dx,dy)||1, nx=dx/d, ny=dy/d;
  const mx=ux+nx*MUZZLE_FWD, my=uy+ny*MUZZLE_FWD-3, spd=RACER_BULLET_SPD;
  const jit=(Math.random()-0.5)*2.4, sx=mx-ny*jit, sy=my+nx*jit, md=Math.hypot(tx-sx,ty-sy)||1;
  G.shots.push({x:sx,y:sy,tx:tx,ty:ty,vx:nx*spd,vy:ny*spd,t:0,dur:md/spd,color:'#ffdf8a',kind:'mg',ang:Math.atan2(ny,nx),cosmetic:true});  // 대상 지점에서 정확히 소멸(관통 X)
  if(Math.random()<0.16){ G.muzzles.push({x:mx,y:my,life:1,color:'#ffe6a0',r:2}); }  // 총구 깜빡(빈도·크기 축소 — 다수 모일 때 과밝음 방지, 스파크 제거)
}
// 스내퍼: 앞다리 낫 베기 — 근접 베기 느낌의 슬래시 호(즉발 피해). 리퍼(가시)와 차별화
function fireSnapperSlash(u,def,ux,uy,tp,eid,dmg){
  const dist=Math.hypot(tp.x-ux,tp.y-uy)||1, nx=(tp.x-ux)/dist, ny=(tp.y-uy)/dist, ang=Math.atan2(ny,nx);
  // 즉발 피해(베기) — spike 발사체 대신 직접 적용
  if(eid!=null){ const e=G.enemies.find(x=>x.eid===eid);
    if(e){ hitEnemy(e,dmg);
      if(def.splash){ const r2=Math.pow(SPLASH_R*Math.min(GW,GH),2);
        for(const o of G.enemies){ if(o===e)continue; const q=posAt(o.d,GW,GH); const ax=q.x-tp.x,ay=q.y-tp.y; if(ax*ax+ay*ay<=r2) hitEnemy(o,dmg*SPLASH_RATIO); } } } }
  // 스내퍼 앞쪽 휘두름 호(두 낫 교차)
  const sx=ux+nx*9, sy=uy+ny*9-4;
  G.impacts.push({x:sx,y:sy,life:1,r:13,color:'#9be05a',slash:true,ang:ang-0.5,dk:11});
  G.impacts.push({x:sx,y:sy,life:1,r:13,color:'#9be05a',slash:true,ang:ang+0.5+Math.PI,dk:11});  // 반대 방향 교차 낫
  // ── 적 타격: 교차 X 베기 + 충격 글로우/링 + 직선 자국 + 점액 분출 ──
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:15,color:'#caff8c',slash:true,ang:ang+Math.PI*0.5,dk:9});   // 베기 한 줄
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:15,color:'#d6ff8c',slash:true,ang:ang-Math.PI*0.5,dk:9});   // 교차 베기(X)
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:24,color:'#9be05a',glow:true,dk:9});                          // 초록 베기 글로우
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:18,color:'#eaffd0',ring:true,dk:11});                         // 충격 링
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:6,color:'#fff',dk:10});                                       // 흰 코어 섬광
  // 직선 베기 자국(밝은 짧은 선)
  const gl=17, ga=ang+0.5;
  G.beams.push({x1:tp.x-Math.cos(ga)*gl,y1:tp.y-Math.sin(ga)*gl,x2:tp.x+Math.cos(ga)*gl,y2:tp.y+Math.sin(ga)*gl,life:1,color:'#f2ffe0',w:2.4});
  // 베인 자리 초록 점액 분출(가닥 + 방울)
  for(let k=0;k<13;k++){ const a2=ang+(Math.random()-0.5)*1.9, sp=110+Math.random()*170;
    G.sparks.push({x:tp.x,y:tp.y,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp,life:0.32+Math.random()*0.18,len:3+Math.random()*5,color:k%3?'#d6ff7a':'#7fc23a'}); }
  for(let k=0;k<5;k++){ const a2=ang+(Math.random()-0.5)*2.2, sp=60+Math.random()*120;
    G.sparks.push({x:tp.x,y:tp.y,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp,life:0.4,flash:true,color:'#bfff7a'}); }
}
// 보이드: 치도리식 압축 전기 — 바깥에서 빨려드는 스파크 + 들쭉날쭉 번개 아크(레이저 X). psi=즉발이라 시각 전용
function fireVoidChidori(u,def,ux,uy,tp){
  const tx=tp.x, ty=tp.y, c1='#bfe6ff', c2='#7fb8ff', core='#eaf6ff';
  // 압축: 바깥에서 중심으로 빨려드는 전기 스트릭
  for(let k=0;k<11;k++){ const a=Math.random()*6.28, r=16+Math.random()*16, sp=r*7;
    G.sparks.push({x:tx+Math.cos(a)*r,y:ty+Math.sin(a)*r,vx:-Math.cos(a)*sp,vy:-Math.sin(a)*sp,life:0.22,len:4+Math.random()*4,color:k%2?c1:c2,dk:7}); }
  // 압축된 전기 코어 + 충격 링
  G.impacts.push({x:tx,y:ty,life:1,r:17,color:c1,glow:true,dk:9});
  G.impacts.push({x:tx,y:ty,life:1,r:7,color:core,dk:11});
  G.impacts.push({x:tx,y:ty,life:1,r:13,color:c1,ring:true,dk:12});
  // 치도리 번개 아크(들쭉날쭉 가닥 방사)
  const N=7;
  for(let k=0;k<N;k++){ const a=k/N*6.28+Math.random()*0.6, len=11+Math.random()*13, seg=3; let px=tx,py=ty;
    for(let s=1;s<=seg;s++){ const f=s/seg, ex=tx+Math.cos(a)*len*f+(Math.random()-0.5)*8, ey=ty+Math.sin(a)*len*f+(Math.random()-0.5)*8;
      G.beams.push({x1:px,y1:py,x2:ex,y2:ey,life:0.8,color:s===seg?c2:core,w:s===seg?1:1.5}); px=ex; py=ey; } }
  // 보이드→대상 순간 방전(끊긴 번개)
  let px=ux,py=uy-8; const seg2=4, dx=tx-px, dy=ty-py;
  for(let s=1;s<=seg2;s++){ const f=s/seg2, ex=ux+dx*f+(Math.random()-0.5)*11, ey=(uy-8)+dy*f+(Math.random()-0.5)*11;
    G.beams.push({x1:px,y1:py,x2:ex,y2:ey,life:0.55,color:core,w:1.4}); px=ex; py=ey; }
  // 사방 튀는 전기 스파크
  for(let k=0;k<6;k++){ const a=Math.random()*6.28, sp=80+Math.random()*120;
    G.sparks.push({x:tx,y:ty,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.28,flash:true,color:core}); }
}
// 리퍼: 양손에서 가시가 투두둑 3연타로 발사 — 각 가시 dmg/3, 약간의 시차로 3타 명중
function fireReaperSpikes(u,def,ux,uy,tp,eid,dmg){
  const dist=Math.hypot(tp.x-ux,tp.y-uy)||1, nx=(tp.x-ux)/dist, ny=(tp.y-uy)/dist;
  const spd=PROJ_SPD.spike||560, handUp=7, handSide=7, each=(eid!=null)?dmg/3:0;
  for(let k=0;k<3;k++){
    const side=(k%2?1:-1);                                  // 좌·우 손 번갈아
    const hx=ux - ny*handSide*side, hy=(uy-handUp) + nx*handSide*side;
    const back=k*14;                                        // 뒤로 스태거 → 도착 시차(투두둑 3타)
    const sx=hx-nx*back, sy=hy-ny*back, md=Math.hypot(tp.x-sx,tp.y-sy)||1, dx=(tp.x-sx)/md, dy=(tp.y-sy)/md;
    G.shots.push({x:sx,y:sy,tx:tp.x,ty:tp.y,vx:dx*spd,vy:dy*spd,t:0,dur:md/spd,color:def.color,boom:5,kind:'needle',ang:Math.atan2(dy,dx),eid:eid,dmg:each,splash:!!def.splash,spd:spd});
    // 손끝 발사 분사 가닥(투두둑)
    G.sparks.push({x:hx,y:hy,vx:nx*130,vy:ny*130,life:0.12,len:3,color:k%2?'#d6ff7a':'#7fc23a',fr:0.85,dk:3});
  }
}
// 센티넬 구체 명중 — 단순 원형 폭발 대신 미세 에너지 방출 + 찌릿한 전기 크래클(절제)
function sentinelBurst(x,y,color){
  const c=color||'#b48bff';
  G.impacts.push({x:x,y:y,life:1,r:16,color:c,glow:true,dk:8});       // 소프트 에너지 방출
  G.impacts.push({x:x,y:y,life:1,r:6,color:'#eadcff',dk:10});         // 밝은 코어
  G.impacts.push({x:x,y:y,life:1,r:11,color:c,ring:true,dk:11});      // 얇은 링 1겹
  for(let k=0;k<4;k++){ const a=k/4*6.28+Math.random()*0.6, len=8+Math.random()*7, seg=2; let px=x,py=y;   // 찌릿 크래클 4가닥(작게)
    for(let s=1;s<=seg;s++){ const f=s/seg, ex=x+Math.cos(a)*len*f+(Math.random()-0.5)*5, ey=y+Math.sin(a)*len*f+(Math.random()-0.5)*5;
      G.beams.push({x1:px,y1:py,x2:ex,y2:ey,life:0.6,color:s===seg?c:'#eadcff',w:1}); px=ex; py=ey; } }
  for(let k=0;k<6;k++){ const a=Math.random()*6.28, sp=50+Math.random()*70;   // 미세 에너지 입자(은은)
    G.sparks.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.3,flash:true,color:k%2?c:'#eadcff'}); }
}
// 센티넬: 몸 안 코어에 에너지가 모였다가 구체를 발사. 명중 시 sentinelBurst(찌릿 방출)
// 리퍼 갓: 초고속 단일 침 연사 — 직격은 약하고, 맞을 때마다 맹독 중첩(상한 RPSN_MAX)이 본딜
const RPSN_MAX=8;     // 독 중첩 상한(공용 보스 안전장치)
const RPSN_DUR=3;     // 독 지속(초) — 재명중 시 갱신
const RPSN_TICK=0.5;  // 독 틱 간격(초)
function fireReaperGodNeedle(u,def,ux,uy,tp,eid,dmg){
  const c=def.color, j=(Math.random()-0.5)*5;   // 손끝 좌우 흔들림(속사 느낌)
  const mx=ux+j, my=uy-12;
  const md=Math.hypot(tp.x-mx,tp.y-my)||1, nx=(tp.x-mx)/md, ny=(tp.y-my)/md, spd=720;
  G.sparks.push({x:mx,y:my,vx:nx*90,vy:ny*90,life:0.08,len:3,color:'#d6ff7a'});   // 짧은 발사 스냅
  const _nd={x:mx,y:my,tx:tp.x,ty:tp.y,vx:nx*spd,vy:ny*spd,t:0,dur:md/spd,color:c,boom:4,kind:'needle',
    ang:Math.atan2(ny,nx),dmg:dmg,spd:spd,psn:Math.max(1,Math.round(dmg*0.7))};   // psn=스택당 틱 데미지
  if(eid!=null) _nd.eid=eid; else _nd.vt={x:tp.x,y:tp.y};   // 보스장·원격: 가상 목표
  G.shots.push(_nd);
}
// 센티넬 갓: 코어에 크게 충전 → 느린 대형 에너지 구체 발사 → 명중 시 대광역 풀데미지 + 반경 내 감전 정지
const SGOD_BLAST_R=0.13;   // 폭발 반경(보드 비율)
const SGOD_STUN=1.3;       // 감전 정지 시간(초) — 보스는 0.5초
function fireSentinelGodOrb(u,def,ux,uy,tp,eid,dmg){
  const c=def.color, mx=ux, my=uy-BODY_MUZZLE_UP;
  for(let k=0;k<14;k++){ const a=Math.random()*6.28, r=14+Math.random()*12, sp=r*4;   // 대충전: 더 많이·더 크게 모임
    G.sparks.push({x:mx+Math.cos(a)*r,y:my+Math.sin(a)*r,vx:-Math.cos(a)*sp,vy:-Math.sin(a)*sp,life:0.22,len:2.5+Math.random()*2.5,color:k%2?c:'#d8c4ff',dk:6}); }
  G.impacts.push({x:mx,y:my,life:1,r:7,color:'#eadcff',dk:9});   // 코어 섬광(충전 완료)
  const spd=150, md=Math.hypot(tp.x-mx,tp.y-my)||1, nx=(tp.x-mx)/md, ny=(tp.y-my)/md;
  const tly=tp.y;   // 발사 시점 표적 위치(비행 중 사망 대비)
  const _orb={x:mx,y:my,tx:tp.x,ty:tp.y,vx:nx*spd,vy:ny*spd,t:0,dur:9,color:c,kind:'plasma',orbR:9,
    dmg:dmg,spd:spd,sboom:true,lkx:tp.x,lky:tly};
  if(eid!=null) _orb.eid=eid; else _orb.vt={x:tp.x,y:tp.y};   // 보스장·원격: 가상 목표로 비행 후 폭발 연출
  G.shots.push(_orb);
}
function sentinelGodBlast(x,y,sh,excl){   // 대광역 폭발 + 감전: 반경 내 전 적 풀데미지(직격 제외) + 정지
  const R=SGOD_BLAST_R*Math.min(GW,GH), r2=R*R, c=sh.color||'#b48bff';
  if(!G._baFire) for(const o of G.enemies){ const q=posAt(o.d,GW,GH); const qy=o.model3d?q.y-AIR_HIT_OFF:q.y;
    const ax=q.x-x, ay=qy-y; if(ax*ax+ay*ay>r2) continue;
    if(o!==excl) hitEnemy(o,sh.dmg);
    o.stunT=Math.max(o.stunT||0, o.boss?0.5:SGOD_STUN);   // 감전 정지(보스 단축)
    G.sparks.push({x:q.x,y:qy,vx:0,vy:0,life:0.25,flash:true,color:'#d8c4ff'}); }
  // 폭발 비주얼: 보랏빛 전기 폭발 — 글로우 + 링 + 지직 전기 가닥
  G.impacts.push({x:x,y:y,life:1,r:R*0.95,color:c,glow:true,dk:5});
  G.impacts.push({x:x,y:y,life:1,r:R*0.5,color:'#eadcff',glow:true,dk:6});
  G.impacts.push({x:x,y:y,life:1,r:R,color:'#d8c4ff',ring:true,dk:7});
  G.impacts.push({x:x,y:y,life:1,r:7,color:'#fff',dk:9});
  for(let k=0;k<10;k++){ const a=k/10*6.28+Math.random()*0.5, rr=R*(0.3+Math.random()*0.65);   // 지직 전기 가닥(방사)
    G.sparks.push({x:x+Math.cos(a)*rr,y:y+Math.sin(a)*rr,vx:Math.cos(a)*60,vy:Math.sin(a)*60,life:0.2+Math.random()*0.15,len:4+Math.random()*5,color:k%2?c:'#eadcff'}); }
  if(typeof playSfxT==='function') playSfxT('attack_dragoon',220);
}
function fireSentinelOrb(u,def,ux,uy,tp,eid,dmg){
  const c=def.color, mx=ux, my=uy-BODY_MUZZLE_UP;   // 몸통 코어
  for(let k=0;k<6;k++){ const a=Math.random()*6.28, r=10+Math.random()*8, sp=r*5;   // 충전: 바깥→코어로 모이는 에너지
    G.sparks.push({x:mx+Math.cos(a)*r,y:my+Math.sin(a)*r,vx:-Math.cos(a)*sp,vy:-Math.sin(a)*sp,life:0.15,len:2+Math.random()*2,color:k%2?c:'#d8c4ff',dk:8}); }
  G.impacts.push({x:mx,y:my,life:1,r:4,color:'#eadcff',dk:12});   // 발사 코어 섬광(작게) — 몸통 원형 글로우·머즐 제거
  const spd=PROJ_SPD.plasma||240, md=Math.hypot(tp.x-mx,tp.y-my)||1, nx=(tp.x-mx)/md, ny=(tp.y-my)/md;
  G.shots.push({x:mx,y:my,tx:tp.x,ty:tp.y,vx:nx*spd,vy:ny*spd,t:0,dur:md/spd,color:c,boom:14,kind:'plasma',eid:eid,dmg:dmg,splash:!!def.splash,spd:spd,crackle:true});
}
// 발칸: 근거리 기관총 범위 공격 — 전방 콘 안 모든 적 타격(AOE). 시각 스프레이는 emitVulcanSpray가 매 프레임 랜덤 분사
const VULCAN_CONE=1.1;   // 전방 콘 반각(±63°)
function fireVulcanSpray(u,def,ux,uy,tp,eid,dmg){
  const dist=Math.hypot(tp.x-ux,tp.y-uy)||1, nx=(tp.x-ux)/dist, ny=(tp.y-uy)/dist;
  if(G._baFire){   // 토벌장: 트랙 적 탐색 금지 — 보스 몸 여러 지점에 화염 탄착(메인의 다수 피격 느낌)
    for(let b=0;b<3;b++){ const bx2=tp.x+(Math.random()-0.5)*26, by2=tp.y+(Math.random()-0.5)*18;
      G.impacts.push({x:bx2,y:by2,life:1,r:7,color:'#ff8a3c',glow:true,dk:12});
      G.impacts.push({x:bx2,y:by2,life:1,r:3.2,color:'#fff2c0',dk:13});
      for(let q=0;q<3;q++){ const a2=Math.atan2(-ny,-nx)+(Math.random()-0.5)*1.5, sp=90+Math.random()*90;
        G.sparks.push({x:bx2,y:by2,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp,life:0.2,flash:true,color:q%2?'#ffae4d':'#ff6a2c'}); } }
    return; }
  const range=def.range*Math.min(GW,GH)*gachaRangeMul(u), coneCos=Math.cos(VULCAN_CONE);
  for(const e of G.enemies){ const p=posAt(e.d,GW,GH); const ay=(e.model3d?p.y-AIR_HIT_OFF:p.y);
    const ex=p.x-ux, ey=ay-uy, ed=Math.hypot(ex,ey)||1;
    if(ed>range || (ex/ed)*nx+(ey/ed)*ny<coneCos) continue;
    hitEnemy(e, dmg);
    // 피격 화염 버스트(주황 글로우 + 흰 코어 + 불티)
    G.impacts.push({x:p.x,y:ay,life:1,r:7,color:'#ff8a3c',glow:true,dk:12});
    G.impacts.push({x:p.x,y:ay,life:1,r:3.2,color:'#fff2c0',dk:13});
    for(let q=0;q<3;q++){ const a2=Math.atan2(-ny,-nx)+(Math.random()-0.5)*1.5, sp=90+Math.random()*90;
      G.sparks.push({x:p.x,y:ay,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp,life:0.2,flash:true,color:q%2?'#ffae4d':'#ff6a2c'}); }
  }
}
// 발칸 연속 스프레이(시각) — 양손 총구 2개에서 목표로 집중포화(난사 X). 데미지 cd와 무관하게 매 프레임
function emitVulcanSpray(u, ux, uy, tx, ty){
  const dx=tx-ux, dy=ty-uy, d=Math.hypot(dx,dy)||1, nx=dx/d, ny=dy/d;
  const spd=780, fwd=MUZZLE_FWD, side=9;
  const fx=ux+nx*fwd, fy=uy+ny*fwd-3;   // 몸 전방 기준점
  for(let s=-1;s<=1;s+=2){   // 좌·우 두 총구에서 각각 목표로
    const hx=fx-ny*side*s, hy=fy+nx*side*s;
    const jx=tx+(Math.random()-0.5)*7, jy=ty+(Math.random()-0.5)*7;   // 목표 근처 미세 지터(집중포화)
    const ddx=jx-hx, ddy=jy-hy, dd=Math.hypot(ddx,ddy)||1;
    G.shots.push({x:hx,y:hy,tx:jx,ty:jy,vx:ddx/dd*spd,vy:ddy/dd*spd,t:0,dur:dd/spd,color:'#ffb23c',kind:'mgf',ang:Math.atan2(ddy,ddx),cosmetic:true});   // 주황 화염 탄
    if(Math.random()<0.55){ G.impacts.push({x:hx,y:hy,life:1,r:5.5,color:'#ff8a3c',glow:true,dk:13}); }   // 총구 화염(주황 글로우)
    if(Math.random()<0.6){ G.sparks.push({x:hx,y:hy,vx:nx*150+(Math.random()-0.5)*70,vy:ny*150+(Math.random()-0.5)*70,life:0.16+Math.random()*0.1,flash:true,color:Math.random()<0.5?'#ffae4d':'#ff6a2c'}); }   // 불티(ember)
  }
}
// 브레이커 포탄 폭발 — 화염구 + 충격파 + 파편 + 연기
// ── 템페스트(초월): 제트기 포격 — 얇은 미사일 1발이 고속 직선으로 날아가 꽂힘 ──
function fireTempestMissile(u,def,ux,uy,tp,eid,dmg){
  const sy=uy-18;   // 높은 부양 고려(기체 높이에서 발사)
  const dx=tp.x-ux, dy=tp.y-sy, d=Math.hypot(dx,dy)||1, nx=dx/d, ny=dy/d;
  G.shots.push({x:ux+nx*14, y:sy+ny*14, tx:tp.x, ty:tp.y, vx:nx*1150, vy:ny*1150, t:0, dur:d/1150,
    kind:'jetmsl', color:'#dff0ff', eid:eid, dmg:dmg, splash:!!def.splash, spd:1150, boom:11});   // 유도지만 초고속이라 사실상 직선
}
// ── 스카이댄서(초월): 커세어 뉴트론 플레어 — 원거리 즉발 에너지 빔(무선 펄스 느낌) ──
function fireSkydancerBeam(u,def,ux,uy,tp){
  const fy=uy-16;   // 부양한 기체
  const dx=tp.x-ux, dy=tp.y-fy, d=Math.hypot(dx,dy)||1, nx=dx/d, ny=dy/d;
  const cx=ux+nx*13, cy=fy+ny*13;   // 기체 바로 앞 에너지 모임점
  // ① 스카이댄서 앞: 파란 에너지가 안으로 빨려들며 모임(웅웅 글로우 — 발사 트레일 없음)
  for(let k=0;k<8;k++){ const a=Math.random()*6.28, r=9+Math.random()*8, sp=r*6;
    G.sparks.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,vx:-Math.cos(a)*sp,vy:-Math.sin(a)*sp,life:0.16+Math.random()*0.06,len:2+Math.random()*2,color:k%2?'#5fa8ff':'#bfe0ff',dk:8}); }
  G.impacts.push({x:cx,y:cy,life:1,r:10,color:'#4f9bff',glow:true,dk:13});   // 모임 글로우
  G.impacts.push({x:cx,y:cy,life:1,r:4.5,color:'#dff0ff',dk:14});            // 코어
  // ② 적 몸: 에너지가 사방에서 모여들어 피격(무선 — 중간 비행 없음)
  for(let k=0;k<9;k++){ const a=Math.random()*6.28, r=12+Math.random()*12, sp=r*7;
    G.sparks.push({x:tp.x+Math.cos(a)*r,y:tp.y+Math.sin(a)*r,vx:-Math.cos(a)*sp,vy:-Math.sin(a)*sp,life:0.2,len:3+Math.random()*3,color:k%2?'#5fa8ff':'#bfe0ff',dk:7}); }
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:15,color:'#7fc0ff',ring:true,dk:11});   // 충격 링
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:9,color:'#5fa8ff',glow:true,dk:10});    // 에너지 글로우
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:4,color:'#eaf6ff',dk:12});             // 코어 섬광
}
// ── 매트론(초월): 가시 연쇄 — 한 대상을 친 뒤 주변 적을 타고 가시가 자라며 퍼짐 ──
const MATRON_SLOW_T=1.5, MATRON_SLOW_MUL=0.5;   // 슬로우 지속(초)·이동배율
function matronSlow(e){ e.slowT=MATRON_SLOW_T; e.slowMul=MATRON_SLOW_MUL; }
function matronSwing(ux,uy,ang){   // 팔 휘두름 — 초록 크레센트 슬래시 호(근접 스윕)
  G.impacts.push({x:ux,y:uy,life:1,r:19,color:'#9be05a',slash:true,ang:ang-0.7,dk:8});
  G.impacts.push({x:ux,y:uy,life:1,r:19,color:'#caff8c',slash:true,ang:ang-0.2,dk:10});
  for(let k=0;k<5;k++){ const a=ang+(Math.random()-0.5)*1.1, sp=90+Math.random()*70;
    G.sparks.push({x:ux,y:uy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.2,len:3+Math.random()*3,color:k%2?'#d6ff7a':'#7fc23a'}); }
}
function matronSlashHit(x,y,ang){   // 적 피격 — 교차 슬래시 + 슬로우 표시 링(청록)
  G.impacts.push({x:x,y:y,life:1,r:13,color:'#9be05a',slash:true,ang:ang+0.8,dk:9});
  G.impacts.push({x:x,y:y,life:1,r:13,color:'#caff8c',slash:true,ang:ang-0.8,dk:9});
  G.impacts.push({x:x,y:y,life:1,r:11,color:'#6fe0c0',ring:true,dk:11});   // 슬로우 링
}
// ── 레인저 갓: 사거리 내 최대 5마리 겨냥 5발 저격(대상<5면 남는 탄을 가까운 대상에 분배, 1마리면 5발 집중) ──
// 스트라이더 갓: 어깨 포드에서 미사일 6발을 쏘아 올려 시간차로 낙하 폭격(최대 6표적 라운드로빈, 1마리면 6발 집중)
function fireStriderGodBarrage(u,def,ux,uy,dmg){
  const MN=Math.min(GW,GH), range=def.range*MN*gachaRangeMul(u), r2=Math.pow(range*1.4,2), SHOTS=6;   // 표적 탐색은 사거리 ×1.4 — 선두만 사거리에 든 순간에도 뒤따르는 적까지 분산
  const inR=[];
  for(const e of G.enemies){ const p=posAt(e.d,GW,GH); const ay=e.model3d?p.y-AIR_HIT_OFF:p.y;
    const dx=p.x-ux, dy=ay-uy, d2=dx*dx+dy*dy; if(d2<=r2) inR.push({e,d2}); }
  if(!inR.length) return;
  inR.sort((a,b)=>a.d2-b.d2);
  const tgts=inR.slice(0,SHOTS);
  for(let k=0;k<SHOTS;k++){ const t=tgts[k%tgts.length], side=(k%2)?1:-1;
    const sx=ux+SHOULDER_SIDE*side, sy=uy-SHOULDER_UP;
    const tq=posAt(t.e.d,GW,GH), tly=t.e.model3d?tq.y-AIR_HIT_OFF:tq.y;   // 발사 시점 표적 위치(상승 중 표적 사망 대비)
    const ivx=side*26+(Math.random()-0.5)*36, ivy=-(150+Math.random()*60);   // 위로 쏘아 올림 → 감속 후 유도 낙하
    G.shots.push({x:sx,y:sy,vx:ivx,vy:ivy,t:0,dur:9,color:def.color,boom:13,kind:'missile',
      ang:Math.atan2(ivy,ivx),eid:t.e.eid,dmg:dmg,spd:300,turn:7,launchT:0.14+k*0.08,
      gboom:true,splash:true,splashR:0.055,lkx:tq.x,lky:tly}); }
  spawnSmoke(ux-SHOULDER_SIDE,uy-SHOULDER_UP,0,-1); spawnSmoke(ux+SHOULDER_SIDE,uy-SHOULDER_UP,0,-1);   // 어깨별 발사 연기(볼리당 1회)
}
function striderGodBoom(x,y){   // 소형 화염 폭발(미사일 1발) — 디토네이터 핵보다 한참 작게
  G.impacts.push({x:x,y:y,life:1,r:16,color:'#ff8a3c',glow:true,dk:7});
  G.impacts.push({x:x,y:y,life:1,r:7,color:'#fff',dk:9});
  G.impacts.push({x:x,y:y,life:1,r:13,color:'#ffcaa0',ring:true,dk:10});
  for(let q=0;q<5;q++){ const a=Math.random()*6.28, sp=60+Math.random()*100;
    G.sparks.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.28,flash:true,color:q%2?'#ffae4d':'#fff2c0'}); }
}
function fireRangerBullet(u,ux,uy,tx,ty,eid,dmg){
  const dx=tx-ux, dy=ty-uy, d=Math.hypot(dx,dy)||1, nx=dx/d, ny=dy/d, spd=PROJ_SPD.rifle||900;
  const jx=(Math.random()-0.5)*3, mx=ux+nx*10-ny*jx, my=uy-6+ny*10+nx*jx;   // 총구(살짝 분산)
  G.muzzles.push({x:mx,y:my,life:1,color:'#cfe8ff',r:2});   // 작은 총구 섬광
  G.shots.push({x:mx,y:my,tx:tx,ty:ty,vx:nx*spd,vy:ny*spd,t:0,dur:d/spd,color:'#eaf6ff',boom:7,kind:'sniper',ang:Math.atan2(ny,nx),eid:eid,dmg:dmg,spd:spd});
}
function fireRangerGodVolley(u,def,ux,uy,dmg){
  const MN=Math.min(GW,GH), range=def.range*MN*gachaRangeMul(u), r2=range*range, SHOTS=5;
  const inR=[];
  for(const e of G.enemies){ const p=posAt(e.d,GW,GH); const ay=e.model3d?p.y-AIR_HIT_OFF:p.y;
    const dx=p.x-ux, dy=ay-uy, d2=dx*dx+dy*dy; if(d2<=r2) inR.push({e,x:p.x,y:ay,d2}); }
  if(!inR.length) return;
  inR.sort((a,b)=>a.d2-b.d2);
  const tgts=inR.slice(0,SHOTS);   // 가까운 순 최대 5마리
  for(let sIdx=0;sIdx<SHOTS;sIdx++){ const t=tgts[sIdx % tgts.length];   // 라운드로빈: 1마리면 5발 모두 그 마리
    fireRangerBullet(u,ux,uy-3,t.x,t.y,t.e.eid,dmg); }
}
const MATRON_HOP=0.07;     // 연쇄 전파 간격(초) — 한 마디씩 시간차로 번짐
const MATRON_CHAIN_R=0.17; // 한 마디가 번지는 거리(min(GW,GH) 비율) — 조금 떨어진 적에게도 번짐
const MATRON_MAXGEN=5;     // 최대 전파 세대
const MATRON_BRANCH=2;     // 한 적에서 동시에 번지는 가지 수
const MATRON_DECAY=0.6;    // 세대마다 데미지 감쇠 — 연쇄가 멀어질수록 급격히 약해짐
function matronStartChain(u,tgt,dmg,ux,uy,tp){   // 팔 휘두름 → 첫 대상부터 시간차 연쇄 시작
  const a0=Math.atan2(tp.y-(uy-14), tp.x-ux);
  matronSwing(ux,uy-14,a0);
  G.matronWaves=G.matronWaves||[];
  G.matronWaves.push({ hit:new Set(), claimed:new Set([tgt.eid]),
    pending:[{eid:tgt.eid, px:ux, py:uy-14, dmg:dmg, t:0, gen:0, ang:a0}] });   // 첫 대상=즉시(t:0)
}
// 매 프레임: 도래한 연쇄 마디를 터뜨리고 → 주변 미타격 적으로 다음 세대 예약(이미 맞은/예약된 적 제외)
function stepMatronWaves(dt){
  if(!G.matronWaves||!G.matronWaves.length) return;
  const chainR2=Math.pow(MATRON_CHAIN_R*Math.min(GW,GH),2);
  for(let w=G.matronWaves.length-1; w>=0; w--){ const wave=G.matronWaves[w];
    for(let i=wave.pending.length-1; i>=0; i--){ const p=wave.pending[i]; p.t-=dt;
      if(p.t>0) continue; wave.pending.splice(i,1);
      const e=G.enemies.find(x=>x.eid===p.eid);
      if(!e || wave.hit.has(p.eid)) continue;
      const pos=posAt(e.d,GW,GH), ey=e.model3d?pos.y-AIR_HIT_OFF:pos.y;
      _atkUid=wave.uid; hitEnemy(e,p.dmg); matronSlow(e); wave.hit.add(p.eid);
      if(p.gen>0) G.beams.push({x1:p.px,y1:p.py,x2:pos.x,y2:ey,life:1,color:'#9be05a',w:1.5});   // 부모→이 적 에너지 줄기
      matronSlashHit(pos.x, ey, p.ang||0);
      if(p.gen<MATRON_MAXGEN){   // 다음 세대: 가까운 미타격·미예약 적 MATRON_BRANCH개로 번짐
        const cand=[];
        for(const o of G.enemies){ if(wave.claimed.has(o.eid)) continue;
          const q=posAt(o.d,GW,GH), oy=o.model3d?q.y-AIR_HIT_OFF:q.y, dx=q.x-pos.x, dy=oy-ey, d2=dx*dx+dy*dy;
          if(d2<=chainR2) cand.push({o,q,oy,d2,dx,dy}); }
        cand.sort((a,b)=>a.d2-b.d2);
        for(let k=0;k<Math.min(MATRON_BRANCH,cand.length);k++){ const c=cand[k]; wave.claimed.add(c.o.eid);
          wave.pending.push({eid:c.o.eid, px:pos.x, py:ey, dmg:p.dmg*MATRON_DECAY, t:MATRON_HOP, gen:p.gen+1, ang:Math.atan2(c.dy,c.dx)}); }
      }
    }
    if(!wave.pending.length) G.matronWaves.splice(w,1);
  }
}
// ── 디토네이터(초월): 핵 투하 — 경고 마커 → 탄두 수직 낙하 → 대형 광역 폭발 ──
const NUKE_R=0.23;     // 피해 반경(min(GW,GH) 비율) — 광범위
const NUKE_VIS=0.65;   // 폭발 이펙트 크기 = 피해 반경의 65%(시각은 절제, 범위는 넓게)
const NUKE_FALL=0.62;  // 낙하 시간(초)
function fireDetonateNuke(u,def,ux,uy,tp,eid,dmg){
  const MN=Math.min(GW,GH), R=NUKE_R*MN;
  G.muzzles.push({x:ux,y:uy-10,life:1,color:'#ffd2d2',r:6});                       // 발사 신호
  G.sparks.push({x:ux,y:uy-12,vx:0,vy:-220,life:0.25,len:9,color:'#ffb4b4'});
  const wd=1/NUKE_FALL*0.95;                                                       // 경고 데칼(낙하 시간 동안 유지) — 피해 반경, 바닥 타원
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:R,color:'#ff5c5c',ring:true,ell:true,dk:wd});
  const MNF=MN*0.52, fy=tp.y-MNF, spd=MNF/NUKE_FALL;
  G.shots.push({x:tp.x,y:fy,tx:tp.x,ty:tp.y,vx:0,vy:spd,t:0,dur:NUKE_FALL,kind:'nukefall',color:'#ffe2c0',spd:spd,
    nDmg:(G._baFire?0:dmg), nR:R});   // 토벌장은 연출만(보스 데미지는 파견 루프가 적용)
}
function detonateExplosion(x,y,R){
  G.impacts.push({x:x,y:y,life:1,r:R*1.05,color:'#fff',ring:true,ell:true,dk:5});           // 흰 충격파(바닥 데칼)
  G.impacts.push({x:x,y:y,life:1,r:R*0.8,color:'#ffcaa0',ring:true,ell:true,dk:6.5});       // 2차 링(바닥 데칼)
  G.impacts.push({x:x,y:y,life:1,r:R*0.66,color:'#ff8a3c',glow:true,dk:4.5});      // 화염구
  G.impacts.push({x:x,y:y,life:1,r:R*0.34,color:'#ffd27a',glow:true,dk:5.5});
  G.impacts.push({x:x,y:y,life:1,r:R*0.2,color:'#fff',dk:6});                      // 코어 섬광
  for(let k=0;k<14;k++){ const a=k/14*6.28+Math.random()*0.4, sp=120+Math.random()*160;
    G.debris.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,rot:a,spin:(k%2?5:-5),len:3.5+Math.random()*3.5,color:k%2?'#ffae4d':'#ff6a2c'}); }
  for(let k=0;k<12;k++){ const a=Math.random()*6.28, sp=80+Math.random()*180;
    G.sparks.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.35,flash:true,color:Math.random()<0.5?'#ffd2a0':'#ff6a2c'}); }
  for(let k=0;k<6;k++){ G.sparks.push({x:x+(Math.random()-0.5)*R*0.3,y:y,vx:(Math.random()-0.5)*30,vy:-(120+Math.random()*120),life:0.5,len:5+Math.random()*5,color:'#ffb887',fr:0.92,dk:2.6}); }   // 버섯 기둥(위로 솟는 불티)
}
function breakerExplosion(x,y){
  G.impacts.push({x:x,y:y,life:1,r:34,color:'#ff8a3c',glow:true,dk:6});   // 화염구
  G.impacts.push({x:x,y:y,life:1,r:18,color:'#ffd27a',glow:true,dk:7});
  G.impacts.push({x:x,y:y,life:1,r:10,color:'#fff',dk:8});                // 흰 코어
  G.impacts.push({x:x,y:y,life:1,r:24,color:'#ffcaa0',ring:true,dk:9});   // 충격파 링
  for(let k=0;k<10;k++){ const a=k/10*6.28+Math.random()*0.4, sp=90+Math.random()*120;   // 파편
    G.debris.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,rot:a,spin:(k%2?5:-5),len:3+Math.random()*3,color:k%2?'#ffae4d':'#ff6a2c'}); }
  for(let k=0;k<8;k++){ const a=Math.random()*6.28, sp=70+Math.random()*130;   // 불티
    G.sparks.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.3,flash:true,color:Math.random()<0.5?'#ffae4d':'#fff2c0'}); }
  for(let k=0;k<4;k++){ const a=Math.random()*6.28, sp=18+Math.random()*26;   // 연기
    G.sparks.push({x:x+(Math.random()-0.5)*8,y:y+(Math.random()-0.5)*8,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-18,life:0.85,smoke:true,r0:5+Math.random()*3,color:Math.random()<0.5?'#3a3a44':'#5a5a66',dk:1.9,fr:0.95}); }
}
// 브레이커: 탱크 주포 — 포구에서 무거운 포탄 발사, 명중 시 큰 폭발(AOE)
function fireBreakerShell(u,def,ux,uy,tp,eid,dmg){
  const dist=Math.hypot(tp.x-ux,tp.y-uy)||1, nx=(tp.x-ux)/dist, ny=(tp.y-uy)/dist, ang=Math.atan2(ny,nx);
  const mx=ux+nx*MUZZLE_FWD*1.2, my=uy+ny*MUZZLE_FWD*1.2-4;   // 포구(전방)
  // 발사 머즐 블라스트 + 포연
  G.muzzles.push({x:mx,y:my,life:1,color:'#ffd9a0',r:12}); G.muzzles.push({x:mx,y:my,life:1,color:'#fff',r:6});
  G.impacts.push({x:mx,y:my,life:1,r:14,color:'#ff9a3c',ring:true,dk:9});
  spawnSparks(mx,my,nx,ny,'#ffd27a'); spawnSparks(mx,my,nx,ny,'#fff');
  for(let k=0;k<3;k++){ const a=ang+Math.PI+(Math.random()-0.5)*0.8, sp=20+Math.random()*30;
    G.sparks.push({x:mx,y:my,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.7,smoke:true,r0:4+Math.random()*3,color:'#4a4a54',dk:2.2,fr:0.95}); }
  // 포탄 발사(유도·AOE) — 빠른 탄속(미사일보다 빠르게)
  const spd=540, md=Math.hypot(tp.x-mx,tp.y-my)||1;
  G.shots.push({x:mx,y:my,tx:tp.x,ty:tp.y,vx:nx*spd,vy:ny*spd,t:0,dur:md/spd,color:'#d8c8a0',boom:30,kind:'shell',ang:ang,eid:eid,dmg:dmg,splash:true,spd:spd});
}
// 워든: 검으로 베기 — 깔끔한 단일 검광 슬래시(즉발 근접). 검광=흰+보라
function fireBladeSlash(u,def,ux,uy,tp,eid,dmg){
  const dist=Math.hypot(tp.x-ux,tp.y-uy)||1, nx=(tp.x-ux)/dist, ny=(tp.y-uy)/dist, ang=Math.atan2(ny,nx);
  if(eid!=null){ const e=G.enemies.find(x=>x.eid===eid);   // 즉발 베기 피해
    if(e){ hitEnemy(e,dmg);
      if(def.splash){ const r2=Math.pow(SPLASH_R*Math.min(GW,GH),2);
        for(const o of G.enemies){ if(o===e)continue; const q=posAt(o.d,GW,GH); const ax=q.x-tp.x,ay=q.y-tp.y; if(ax*ax+ay*ay<=r2) hitEnemy(o,dmg*SPLASH_RATIO); } } } }
  const c='#bfe6ff', core='#ffffff';   // 검광(흰+청 — 레이저검과 통일)
  // ── 워든 주변 검 휘두름 호(스윙 궤적) — 몸을 감싸며 베는 큰 호 + 밝은 날 잔상 ──
  const cy=uy-8;
  G.impacts.push({x:ux,y:cy,life:1,r:22,color:c,slash:true,ang:ang-0.7,dk:9});
  G.impacts.push({x:ux,y:cy,life:1,r:20,color:core,slash:true,ang:ang+0.1,dk:11});
  for(let k=0;k<6;k++){ const aa=ang-0.7+(k/6)*1.7, rr=18;   // 휘두름 궤적 스파크
    G.sparks.push({x:ux+Math.cos(aa)*rr,y:cy+Math.sin(aa)*rr,vx:Math.cos(aa+1.3)*110,vy:Math.sin(aa+1.3)*110,life:0.16,flash:true,color:k%2?core:c}); }
  // ── 타겟 타격 이팩트(직선·베기 X) — 섬광 + 발광 + 충격 링 + 사방 파편 ──
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:17,color:c,glow:true,dk:9});
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:11,color:core,glow:true,dk:11});
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:14,color:c,ring:true,dk:12});
  G.impacts.push({x:tp.x,y:tp.y,life:1,r:5,color:core,dk:12});
  for(let k=0;k<11;k++){ const a2=Math.random()*6.28, sp=100+Math.random()*130;   // 사방 파편(타격 버스트)
    G.sparks.push({x:tp.x,y:tp.y,vx:Math.cos(a2)*sp,vy:Math.sin(a2)*sp,life:0.2+Math.random()*0.1,flash:true,color:k%2?core:c}); }
}
// 베놈퀸: 등에서 가시가 사방으로 분출 → 사거리 내 모든 적에게 몹당 일정 수량 유도(유도탄). 각 적 = 풀 데미지
function fireThornQueen(u,def,ux,uy,tp,eid,dmg){
  if(G._baFire){   // 토벌장: 트랙 적 탐색 금지 — 메인과 동일한 '등 가시 분출→유도' 연출을 보스 주변 가상 지점으로
    const spdB=PROJ_SPD.spike||560, backUp=14;
    const vts=[]; for(let k=0;k<4;k++) vts.push({x:tp.x+(Math.random()-0.5)*34, y:tp.y+(Math.random()-0.5)*24});
    for(const t of vts){ for(let k=0;k<3;k++){
      const sx=ux+(Math.random()-0.5)*6, sy=uy-backUp+(Math.random()-0.5)*4;
      const dtx=t.x-sx, dty=t.y-sy, dl=Math.hypot(dtx,dty)||1;
      let ivx=(dtx/dl)*0.7+(Math.random()-0.5)*0.5, ivy=(dty/dl)*0.7-0.55+(Math.random()-0.5)*0.5;
      const il=Math.hypot(ivx,ivy)||1; ivx/=il; ivy/=il;
      G.shots.push({x:sx,y:sy,tx:0,ty:0,vx:ivx*spdB*0.28,vy:ivy*spdB*0.28,t:0,dur:3,
        color:def.color,boom:5,kind:'needle',ang:Math.atan2(ivy,ivx),vt:{x:t.x,y:t.y},spd:spdB,turn:11,launchT:0.1+k*0.05+Math.random()*0.04}); } }
    G.impacts.push({x:ux,y:uy-backUp,life:1,r:13,color:'#9fd356',glow:true,dk:8});
    for(let k=0;k<16;k++){ const a=-Math.PI/2+(Math.random()-0.5)*1.4, sp=50+Math.random()*100;
      G.sparks.push({x:ux+(Math.random()-0.5)*6,y:uy-backUp,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.14+Math.random()*0.16,len:3+Math.random()*4,color:k%2?'#d6ff7a':'#7fc23a'}); }
    return; }
  const range=def.range*Math.min(GW,GH)*gachaRangeMul(u), seekR2=Math.pow(range*1.4,2);   // 표적 탐색은 사거리 ×1.4 — 선두 1마리에 전탄 집중 방지
  let targets=[];
  for(const e of G.enemies){ const p=posAt(e.d,GW,GH); const ay=e.model3d?p.y-AIR_HIT_OFF:p.y;
    const dx=p.x-ux, dy=ay-uy, d2=dx*dx+dy*dy; if(d2<=seekR2) targets.push({e,x:p.x,y:ay,d2}); }
  if(!targets.length && eid!=null){ const e=G.enemies.find(x=>x.eid===eid); if(e){ const p=posAt(e.d,GW,GH); targets.push({e,x:p.x,y:(e.model3d?p.y-AIR_HIT_OFF:p.y),d2:0}); } }
  if(!targets.length) return;
  targets.sort((a,b)=>a.d2-b.d2); if(targets.length>8) targets.length=8;   // 가까운 8마리까지(과다 방지)
  const per=3, eachDmg=dmg/per, spd=PROJ_SPD.spike||560, backUp=14;   // 등 뒤 윗쪽에서 솟아나온 뒤 유도
  for(const t of targets){ for(let k=0;k<per;k++){
    const sx=ux+(Math.random()-0.5)*6, sy=uy-backUp+(Math.random()-0.5)*4;   // 등 뒤 윗쪽
    // 초기 방향 = 목표쪽(70%) + 위쪽 살짝(30%) + 약간 랜덤 → 살짝 뿜어졌다 자연스럽게 유도(크게 안 돌아감)
    const dtx=t.x-sx, dty=t.y-sy, dl=Math.hypot(dtx,dty)||1;
    let ivx=(dtx/dl)*0.7 + (Math.random()-0.5)*0.5, ivy=(dty/dl)*0.7 - 0.55 + (Math.random()-0.5)*0.5;
    const il=Math.hypot(ivx,ivy)||1; ivx/=il; ivy/=il;
    // launchT = 등에서 천천히 솟아나오는(emerge) 단계 후 유도 가속(가시별로 시차 두어 순차 등장)
    G.shots.push({x:sx,y:sy,tx:0,ty:0,vx:ivx*spd*0.28,vy:ivy*spd*0.28,t:0,dur:3,
      color:def.color,boom:5,kind:'needle',ang:Math.atan2(ivy,ivx),eid:t.e.eid,dmg:eachDmg,spd:spd,turn:11,launchT:0.1+k*0.05+Math.random()*0.04}); } }
  // 등 뒤 윗쪽 분출 연출: 솟구치는 가닥(많이) + 짧은 초록 글로우
  G.impacts.push({x:ux,y:uy-backUp,life:1,r:13,color:'#9fd356',glow:true,dk:8});
  for(let k=0;k<16;k++){ const a=-Math.PI/2+(Math.random()-0.5)*1.4, sp=50+Math.random()*100;
    G.sparks.push({x:ux+(Math.random()-0.5)*6,y:uy-backUp,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.14+Math.random()*0.16,len:3+Math.random()*4,color:k%2?'#d6ff7a':'#7fc23a'}); }
}
function fireAttack(u,def,ux,uy,tp,eid,dmg){
  if(u.gid==='ranger_god'){ // 레인저 갓(보스장·원격): 5발 저격 볼리를 표적 지점 주변으로
    for(let k=0;k<5;k++){ const tx=tp.x+(Math.random()-0.5)*26, ty=tp.y+(Math.random()-0.5)*18;
      const dx=tx-ux, dy=ty-(uy-6), d=Math.hypot(dx,dy)||1, nx=dx/d, ny=dy/d, spd=PROJ_SPD.rifle||900;
      G.muzzles.push({x:ux+nx*10,y:uy-6+ny*10,life:1,color:'#cfe8ff',r:2});
      G.shots.push({x:ux+nx*10,y:uy-6+ny*10,tx:tx,ty:ty,vx:nx*spd,vy:ny*spd,t:0,dur:d/spd,color:'#eaf6ff',boom:7,kind:'sniper',ang:Math.atan2(ny,nx),spd:spd}); }
    return; }
  if(u.gid==='strider_god'){ // 스트라이더 갓(보스장·원격): 어깨 6발 폭격 볼리 → 표적 지점 낙하 폭발
    for(let k=0;k<6;k++){ const side=(k%2)?1:-1, sx=ux+SHOULDER_SIDE*side, sy=uy-SHOULDER_UP;
      const tx=tp.x+(Math.random()-0.5)*30, ty=tp.y+(Math.random()-0.5)*20;
      const ivx=side*26+(Math.random()-0.5)*36, ivy=-(150+Math.random()*60);
      G.shots.push({x:sx,y:sy,vx:ivx,vy:ivy,t:0,dur:9,color:def.color,boom:13,kind:'missile',
        ang:Math.atan2(ivy,ivx),vt:{x:tx,y:ty},spd:300,turn:7,launchT:0.14+k*0.08,gboom:true}); }
    spawnSmoke(ux-SHOULDER_SIDE,uy-SHOULDER_UP,0,-1); spawnSmoke(ux+SHOULDER_SIDE,uy-SHOULDER_UP,0,-1);
    return; }
  if(u.gid==='phantom_t'){ fireDetonateNuke(u,def,ux,uy,tp,eid,dmg); return; }   // 디토네이터: 핵 투하(장거리 광역 한방)
  if(u.gid==='skyguard_t'){ fireTempestMissile(u,def,ux,uy,tp,eid,dmg); return; }   // 템페스트: 제트기 포격 — 얇은 고속 직선 미사일 1발
  if(u.gid==='skydancer_t'){ fireSkydancerBeam(u,def,ux,uy,tp); return; }   // 스카이댄서: 커세어식 원거리 에너지 빔(즉발)
  if(u.gid==='matron_t'){ const a=Math.atan2(tp.y-(uy-14),tp.x-ux); matronSwing(ux,uy-14,a); matronSlashHit(tp.x,tp.y,a); return; }   // 매트론: 팔 휘두름(데미지·연쇄는 트랙 전투에서)
  if(u.gmodel==='thornqueen'){ fireThornQueen(u,def,ux,uy,tp,eid,dmg); return; }   // 베놈퀸: 등 가시 사방 유도
  if(u.gmodel==='blade'){ fireBladeSlash(u,def,ux,uy,tp,eid,dmg); return; }   // 워든: 검 베기
  if(u.gmodel==='tank'){ fireBreakerShell(u,def,ux,uy,tp,eid,dmg); return; }   // 브레이커: 탱크 포탄
  if(u.gmodel==='machinegun'){ fireVulcanSpray(u,def,ux,uy,tp,eid,dmg); return; }   // 발칸: 근거리 기관총 AOE
  if(u.gmodel==='racer'){ fireRacerMG(u,def,ux,uy,tp,eid,dmg); return; }   // 레이서 전용 기관총 이펙트
  if(u.gid==='sentinel_god'){ fireSentinelGodOrb(u,def,ux,uy,tp,eid,dmg); return; }   // 센티넬 갓: 느린 대구체 → 광역 폭발+감전
if(u.id==='dragoon' && u.gmodel!=='blade'){ fireSentinelOrb(u,def,ux,uy,tp,eid,dmg); return; }   // 센티넬(dragoon·워든 제외) 충전 구체
  if(u.gmodel==='snapper'){ fireSnapperSlash(u,def,ux,uy,tp,eid,dmg); return; }   // 스내퍼 전용 낫 베기
  if(u.gid==='reaper_god'){ fireReaperGodNeedle(u,def,ux,uy,tp,eid,dmg); return; }   // 리퍼 갓: 초고속 단일 침 + 맹독 중첩
  if(u.id==='hydra'){ fireReaperSpikes(u,def,ux,uy,tp,eid,dmg); return; }   // 리퍼(hydra·스내퍼 제외) 손 가시 3연타
  if(gachaBase(u)==='void'){ fireVoidChidori(u,def,ux,uy,tp); return; }   // 보이드 전용 치도리(즉발이라 시각 전용)
  const c=def.color, dist=Math.hypot(tp.x-ux,tp.y-uy)||1, nx=(tp.x-ux)/dist, ny=(tp.y-uy)/dist;
  // 유도 페이로드: 발사체가 대상(eid)을 추적하다 명중하면 dmg 적용
  const hom = (eid!=null) ? {eid:eid, dmg:dmg, splash:!!def.splash, spd:(PROJ_SPD[def.atk]||0)} : {};
  // model3d 발사 유닛은 앞쪽 총구/포구에서 발사. 손총(마린/고스트)=오른쪽 측면, 거치무기(터렛/골리앗/포토)=중앙 전방.
  const muzUnit = def.model3d && (def.atk==='bullet'||def.atk==='rifle'||def.atk==='missile'||def.atk==='plasma');
  let mx=ux, my=uy;
  if(muzUnit){
    if(u.id==='photon'){ // 포토케논: 동그란 수정에서 에너지 방출(모였다 터져나가는 느낌)
      mx=ux; my=uy-PHOTON_ORB_UP;
      const pc=G.units.reduce((a,x)=>a+(x.id==='photon'?1:0),0);
      if(pc<=1 || Math.random()<1/pc){   // 같은 자리에 쌓여도 발사 섬광은 볼리당 평균 1번만(겹쳐서 과하게 안 밝게)
        G.impacts.push({x:mx,y:my,life:1,r:15,color:c,ring:true});       // 방출 충격 링(작게)
        G.impacts.push({x:mx,y:my,life:1,r:9,color:'#9be9ff',glow:true}); // 구슬 발광 방출
        G.impacts.push({x:mx,y:my,life:1,r:4.5,color:'#fff'});           // 코어 섬광
        G.muzzles.push({x:mx,y:my,life:1,color:'#cffaff'});
        for(let k=0;k<6;k++){ const a=k/6*6.28; G.sparks.push({x:mx,y:my,vx:Math.cos(a)*90,vy:Math.sin(a)*90,life:0.55,flash:true,color:'#bff0ff'}); } // 사방 방출 스파크(작게)
      }
    } else if(TOP_MUZZLE[u.id]){ // 상단 포드(터렛) 발사구 — 총구 화염 섬광(모델 위 #cvFx) + 충격 링
      mx=ux+nx*LAUNCHER_FWD; my=uy+ny*LAUNCHER_FWD-LAUNCHER_UP;
      spawnSparks(mx,my,nx,ny,'#ffd27a'); spawnSparks(mx,my,nx,ny,'#fff');  // 총구 불꽃
      G.muzzles.push({x:mx,y:my,life:1,color:'#ffd9a0',r:13});  // 큰 총구 화염 섬광
      G.muzzles.push({x:mx,y:my,life:1,color:'#fff',r:7});      // 흰 코어 플래시
      G.impacts.push({x:mx,y:my,life:1,r:16,color:c,ring:true}); // 발사 충격 링
    } else if(BODY_MUZZLE[u.id]){ // 몸 안쪽 코어에서 발사(회전 안 하는 드라군) — 차징 글로우 후 발사
      mx=ux; my=uy-BODY_MUZZLE_UP;
      G.impacts.push({x:mx,y:my,life:1,r:12,color:c,glow:true});  // 코어 충전 발광(은은)
      G.muzzles.push({x:mx,y:my,life:1,color:c});
    } else if(SHOULDER_MUZZLE[u.id]){ // 어깨 포드에서 발사(골리앗) — 좌우 어깨 고정(방향 무관), 연기는 발사 케이스에서 어깨별로
      mx=ux; my=uy-SHOULDER_UP;
    } else {
      if(u.id==='ghost'){ mx=ux; my=uy-BODY_MUZZLE_UP*0.55; }   // 팬텀: 몸 중심에서 발사(측면 오프셋 제거 — 좌향 시 허공 발사 방지)
      else { const side=(def.atk==='bullet'||def.atk==='rifle')?MUZZLE_SIDE:0;
        mx=ux+nx*MUZZLE_FWD+ny*side; my=uy+ny*MUZZLE_FWD-nx*side; }
      if(def.atk==='rifle'){ spawnSparks(mx,my,nx,ny,'#eaffff'); G.muzzles.push({x:mx,y:my,life:1,color:'#eaffff'}); }
      else if(def.atk==='bullet'){ spawnSparks(mx,my,nx,ny,c); }
      else G.muzzles.push({x:mx,y:my,life:1,color:c});
    }
  }
  else if(def.atk!=='spike'){ G.muzzles.push({x:ux,y:uy,life:1,color:c}); }  // 히드라(침)는 발밑 둥근 머즐 없음 — 얼굴쪽 분사로 대체
  switch(def.atk){
    case 'rifle': { // 저격: 빠른 긴 트레이서 탄(총구 끝에서)
      const md=Math.hypot(tp.x-mx,tp.y-my)||1;
      G.shots.push({x:mx,y:my,tx:tp.x,ty:tp.y,vx:nx*900,vy:ny*900,t:0,dur:md/900,color:'#dff6ff',boom:6,kind:'sniper',ang:Math.atan2(ny,nx),...hom}); break; }
    case 'bullet': { // 작은 탄 투사체(빠름) — 총구 끝(mx,my)에서 적을 향해
      const md=Math.hypot(tp.x-mx,tp.y-my)||1;
      G.shots.push({x:mx,y:my,tx:tp.x,ty:tp.y,vx:nx*640,vy:ny*640,t:0,dur:md/640,color:'#ffe2a0',boom:8,kind:'bullet',...hom}); break; }  // 따뜻한 탄색(파랑 X)
    case 'spike': { // 히드라: 침 분사 — 짧은 분사 가닥 + 가는 침 여러 발이 대상으로 날아감(1발 데미지)
      const my0=uy-HYDRA_MOUTH_UP, baseAng=Math.atan2(ny,nx), spd=PROJ_SPD.spike;   // 머리(얼굴)에서 발사
      // 분사 가닥(코스메틱): 부채꼴로 살짝 뿜어졌다 곧바로 흩어져 사라짐(끝까지 가지 않음)
      for(let k=0;k<8;k++){ const a=baseAng+(Math.random()-0.5)*0.95, sp=spd*(0.2+Math.random()*0.28);  // 느리게 = 짧게만 나아감
        G.sparks.push({x:ux+(Math.random()-0.5)*3,y:my0+(Math.random()-0.5)*3,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.12+Math.random()*0.15,len:3+Math.random()*4,color:k%2?'#d6ff7a':'#7fc23a',fr:0.85,dk:3.0}); }  // 금방 페이드
      // 대상으로 날아가는 가는 침 3발(가운데=데미지, 양옆=코스메틱) — 입 양옆에서 적에게 수렴
      G.shots.push({x:ux,y:my0,tx:tp.x,ty:tp.y,vx:nx*spd,vy:ny*spd,t:0,dur:dist/spd,color:c,boom:6,kind:'needle',ang:baseAng,...hom});
      for(let k=-1;k<=1;k+=2){ const sx=ux-ny*5*k, sy=my0+nx*5*k, md=Math.hypot(tp.x-sx,tp.y-sy)||1, dx=(tp.x-sx)/md, dy=(tp.y-sy)/md;
        G.shots.push({x:sx,y:sy,tx:tp.x,ty:tp.y,vx:dx*spd,vy:dy*spd,t:0,dur:md/spd,color:c,boom:3,kind:'needle',ang:Math.atan2(dy,dx)}); }
      break; }
    case 'plasma': { // 에너지 구체(느림, 잔광) — 포구(전방)에서
      const md=Math.hypot(tp.x-mx,tp.y-my)||1;
      G.shots.push({x:mx,y:my,tx:tp.x,ty:tp.y,vx:nx*240,vy:ny*240,t:0,dur:md/240,color:c,boom:18,kind:'plasma',...hom}); break; }
    case 'missile': { // 미사일 — 어깨(골리앗) 또는 포구에서 2발, 적 추적
      const sh=SHOULDER_MUZZLE[u.id];
      const mhom=(eid!=null)?{...hom,dmg:dmg/2}:{};  // 2발 합산이 dmg가 되도록 분할(이중타격 방지)
      for(let k=-1;k<=1;k+=2){
        const sx = sh ? (ux + SHOULDER_SIDE*k) : (mx - ny*8*k);   // 어깨: 좌우 고정 / 그 외: 발사방향 수직 분산
        const sy = sh ? (uy - SHOULDER_UP)     : (my + nx*8*k);
        const md0=Math.hypot(tp.x-sx,tp.y-sy)||1, dx=(tp.x-sx)/md0, dy=(tp.y-sy)/md0;
        if(sh) spawnSmoke(sx,sy,dx,dy);   // 어깨에 발사 연기(피어오름)
        const lx = sh ? sx+dx*18 : sx, ly = sh ? sy+dy*18 : sy;   // 미사일은 어깨 앞쪽에서 점화 — 어깨에 화염 원이 안 생기게(연기만)
        const md=Math.hypot(tp.x-lx,tp.y-ly)||1, ddx=(tp.x-lx)/md, ddy=(tp.y-ly)/md;
        G.shots.push({x:lx,y:ly,tx:tp.x,ty:tp.y,vx:ddx*240,vy:ddy*240,t:0,dur:md/240,color:c,boom:13,kind:'missile',ang:Math.atan2(ddy,ddx),side:k,...mhom});
      } break; }
    case 'psi': { // 사이오닉(스타 아칸): 은은한 그라데이션 폭발 + 미세 전기 크래클(선 느낌 최소화)
      const pc='#7fe3ff', pc2='#cfeaff';   // 청록/연한 흰빛(모델 오라색과 일치)
      // 본체→타겟 가는 글로우 연결(은은하게 1겹만)
      G.beams.push({x1:ux,y1:uy-8,x2:tp.x,y2:tp.y,life:0.7,color:pc,w:1.6});
      // 타격: 소프트 그라데이션 폭발(링 대신 부드러운 발광 — 중심 밝고 가장자리 자연 페이드)
      G.impacts.push({x:tp.x,y:tp.y,life:1,r:46,color:pc,glow:true});
      G.impacts.push({x:tp.x,y:tp.y,life:1,r:26,color:pc2,glow:true});
      // 미세 전기 크래클(짧고 흐릿한 꺾인 호 몇 가닥)
      for(let k=0;k<4;k++){ const a=k/4*6.28+0.5+Math.random()*0.4, len=16+Math.random()*10;
        const ex=tp.x+Math.cos(a)*len, ey=tp.y+Math.sin(a)*len;
        const jx=(tp.x+ex)/2+(Math.random()-0.5)*8, jy=(tp.y+ey)/2+(Math.random()-0.5)*8;
        G.beams.push({x1:tp.x,y1:tp.y,x2:jx,y2:jy,life:0.55,color:pc2,w:1});
        G.beams.push({x1:jx,y1:jy,x2:ex,y2:ey,life:0.55,color:pc2,w:1}); }
      break; }
    default:
      G.beams.push({x1:ux,y1:uy,x2:tp.x,y2:tp.y,life:1,color:c,w:2,hero:u.hero});
  }
}

// ============================================================================
// DOM 렌더 (유닛/건물)
// ============================================================================
const _uEls=new Map();   // uid -> {el,sig} — 유닛 DOM 캐시(매 프레임 위치만 갱신, 내용은 변할 때만 재구성)
function renderUnits(){ const v=document.getElementById('vMain'); if(!v) return;
  const _vw=(typeof G!=='undefined'&&G.view)||{x:0.5,y:0.5,zoom:1}, _vz=_vw.zoom||1;   // 🎥 화면 줌/팬 = 캔버스·3D와 동일한 렌더 뷰(G.view)를 DOM 유닛에도 적용
  const live=new Set();
  for(const u of G.units){ if(u.atBoss) continue;   // 보스방 파견 유닛은 트랙에 표시 안 함
    live.add(u.uid);
    const def=U[u.id]; const r=unitRadius(u), box=Math.round(r*2), seld=G.sel.includes(u.uid);
    let rec=_uEls.get(u.uid);
    if(!rec || !rec.el.isConnected){ const el=document.createElement('div'); el.dataset.uid=u.uid; v.appendChild(el); rec={el:el, sig:null}; _uEls.set(u.uid, rec); }
    const el=rec.el;
    { const _sx=(u.x-_vw.x)*_vz+0.5, _sy=(u.y-_vw.y)*_vz+0.5;   // 월드→화면(뷰 변환) — 줌/팬 시 캔버스·3D와 어긋나지 않게
      if(rec.lx!==_sx){ el.style.left=(_sx*100)+'%'; rec.lx=_sx; }   // 위치는 변한 프레임에만 기록(정지 유닛 대량일 때 스타일 무효화 방지)
      if(rec.ly!==_sy){ el.style.top=(_sy*100)+'%'; rec.ly=_sy; }
      if(rec.lz!==_vz){ el.style.transform='translate(-50%,-50%)'+(_vz!==1?(' scale('+_vz.toFixed(4)+')'):''); rec.lz=_vz; } }   // 크기도 줌에 맞춰(라벨·HP바 포함)
    const maxHp=u.maxHp||1, hpR=Math.max(0,Math.min(1,(u.hp!=null?u.hp:maxHp)/maxHp));
    const maxSh=u.maxSh||0, shR=maxSh>0?Math.max(0,Math.min(1,(u.sh!=null?u.sh:maxSh)/maxSh)):0;
    const maxEn=u.maxEn||0, enR=maxEn>0?Math.max(0,Math.min(1,(u.en!=null?u.en:maxEn)/maxEn)):0;   // ⚡ 마나(에너지)
    const _foe=(u.team==='foe'), _showBar=seld||(G.tab==='Battle'&&G.sandbox);   // 전투실험: 양팀 HP 상시 표시
    const sig=u.id+'|'+box+'|'+(seld?1:0)+'|'+(_foe?'F':'A')+'|'+(u.hero?(u.lv||1):0)+'|'+(_showBar?(Math.round(hpR*40)+','+Math.round(shR*40)+','+Math.round(enR*40)):'')+'|c'+(u.cargo?u.cargo.length:0);
    if(sig===rec.sig) continue;   // 모양 그대로 → DOM 재구성 생략(리플로우 방지)
    rec.sig=sig;
    el.className='unit'+(seld?' sel':'')+(_foe?' foe':'');
    const star=u.hero?(' '+'★'.repeat(Math.min(u.lv||1,3))):'';
    const pad=Math.round(r*0.42);
    let barH='';
    if(_showBar){ const hpCol=_foe?'#ff5a5a':hpBarColor(hpR);
      barH=_barsHTML({ w:box, hpR, hpCol, shR:maxSh>0?shR:null, enR:maxEn>0?enR:null }); }
    const _m3k=u.gmodel||def.model3d;   // 이 유닛이 쓸 3D 모델 키(가챠 전용 우선)
    const has3d=!!_m3k && !(G.opt&&G.opt.model3d===false) && window.M3D && window.M3D.hasModel && window.M3D.hasModel(_m3k);  // 모델이 실제 로드됐을 때만 투명(WebGL이 그림). 로드 전엔 SVG 폴백
    const iconHTML=has3d?'':unitSVG(u.id);
    const lblHTML = seld ? '<div class="ulbl'+(u.hero?' hero':'')+'">'+gNameStar(u,def)+star+'</div>' : '';   // 이름은 선택(지정) 시에만 표시
    const cargoH = (isTransport(u) && !seld) ? ('<div style="text-align:center;font-size:8px;font-weight:600;color:#9fd6ff;opacity:.8;text-shadow:0 1px 1px #000;line-height:1;margin-top:0">▲'+(u.cargo?u.cargo.length:0)+'/'+transportCap(u)+'</div>') : '';   // 수송 탑승수 뱃지(작게·선택 시 숨김 — 하단 패널 표시)
    el.innerHTML='<div class="ubox'+(u.hero?' hero':'')+(has3d?' model3d':'')+'" style="width:'+box+'px;height:'+box+'px;color:'+def.color+';padding:'+pad+'px">'+iconHTML+'</div>'+barH+lblHTML+cargoH;
  }
  for(const [uid,rec] of _uEls){ if(!live.has(uid)){ rec.el.remove(); _uEls.delete(uid); } }   // 죽은/파견된 유닛 정리
}
// 유닛 분리: 서로 겹치면 밀어냄(매 프레임).
//  · 드래그 중인 유닛이 낀 쌍은 제외(옮기는 동안 다른 유닛 안 밀림)
//  · 놓은 직후 '정착 중' 유닛은 자기만 비킴(겹친 기존 유닛은 안 밀림)
// 공용 겹침 분리 1패스(메인·건설 공용 코어) — 같은 레이어만(공중↔지상 통과), 공중=완만(0.012=천천히 벌어지며 자리 찾기)·지상=즉시(0.5). settle=정착중(자기만 비킴). 반환=정착 유닛이 밀렸는지.
// items:[{ref(.x/.y 갱신 대상), r(충돌반경 px), air, fixed, settle}]
function separatePass(items, GWv, GHv){ let still=false;
  const n=items.length; if(n<2) return false;
  // 공간 해시 그리드: 이웃 셀의 쌍만 검사(O(n²)→O(n)) — 밀어내기 로직 자체는 기존과 동일.
  // 셀 크기=최대 충돌지름 → 겹칠 수 있는 쌍(d<A.r+B.r≤셀)은 반드시 인접 3×3 셀 안에 있음
  let maxR=0; for(let i=0;i<n;i++){ if(items[i].r>maxR) maxR=items[i].r; }
  const cs=Math.max(8, maxR*2), inv=1/cs, grid=new Map();
  for(let i=0;i<n;i++){ const it=items[i];
    it._cx=Math.floor(it.ref.x*GWv*inv); it._cy=Math.floor(it.ref.y*GHv*inv);
    const k=it._cx+it._cy*4096; let b=grid.get(k); if(!b){ b=[]; grid.set(k,b); } b.push(i); }
  for(let i=0;i<n;i++){ const A=items[i];
    for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){
      const bucket=grid.get((A._cx+ox)+(A._cy+oy)*4096); if(!bucket) continue;
      for(const j of bucket){ if(j<=i) continue; const B=items[j];
        if(A.air!==B.air) continue;   // 지상↔공중은 서로 안 밀어냄(다른 레이어 = 통과)
        const a=A.ref, b=B.ref, ax=a.x*GWv,ay=a.y*GHv,bx=b.x*GWv,by=b.y*GHv;
        let dx=bx-ax, dy=by-ay, d=Math.hypot(dx,dy); const min=A.r+B.r;
        if(d<min){ if(d<0.01){ dx=Math.random()-.5; dy=Math.random()-.5; d=1; }
          const push=(min-d), nx=dx/d, ny=dy/d;
          if(A.fixed&&B.fixed){}
          else if(A.fixed){ b.x+=nx*push/GWv; b.y+=ny*push/GHv; }
          else if(B.fixed){ a.x-=nx*push/GWv; a.y-=ny*push/GHv; }
          else if(A.settle){ a.x-=nx*push/GWv; a.y-=ny*push/GHv; still=true; }
          else if(B.settle){ b.x+=nx*push/GWv; b.y+=ny*push/GHv; still=true; }
          else { const _pf=(A.air&&B.air)?0.012:0.5; a.x-=nx*push*_pf/GWv; a.y-=ny*push*_pf/GHv; b.x+=nx*push*_pf/GWv; b.y+=ny*push*_pf/GHv; }
        } } } }
  return still; }
function separateUnits(){ if(!GW||!GH) return; const us=G.units; if(us.length<2) return;
  const isDrag=u=>dragSet.length&&dragSet.indexOf(u)>=0;   // 직접 드래그 중 유닛: 분리 제외
  const walk=new Set(); for(const u of us){ if(u.moveTo) walk.add(u); }   // 이동명령 수행 중: 제외(대형+stepUnitMove 회피가 처리)
  const _airHeld=u=>(cmdMove&&!cmdMove.issued&&cmdMove.slots&&cmdMove.slots[u.uid]&&(typeof FXLAB_AIR!=='undefined')&&FXLAB_AIR.has(u.gmodel||u.id));   // 공중: 이동명령 누르는 동안 스택
  const skip=u=>u.atBoss||isDrag(u)||walk.has(u)||isTransport(u)||(u.gmodel||u.id)==='stinger'||_airHeld(u);
  const items=[]; for(const u of us){ if(skip(u)) continue; items.push({ref:u, r:collideR(u), air:(typeof FXLAB_AIR!=='undefined'&&FXLAB_AIR.has(u.gmodel||u.id)), fixed:!!u.fixed, settle:!!(settling&&settling.uid===u.uid)}); }
  let stillOverlap=false;
  for(let iter=0; iter<3; iter++){ if(separatePass(items, GW, GH)) stillOverlap=true;
    for(const it of items){ if(it.fixed) continue; const cl=clampInner(it.ref.x,it.ref.y); it.ref.x=cl.x; it.ref.y=cl.y; } }
  if(settling && !stillOverlap) settling=null;
}
// (삭제) renderBldgs — 업그레이드 탭 건물 타일 렌더. 건물 화면 폐지로 호출처가 사라져 함께 제거.
