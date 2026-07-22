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
  await step('유즈맵 선택 → 네모네모 모드 팝업', ()=>{ openMapSelect(); openModeSheet(USEMAPS.nemo_inf||USEMAPS.nemo);
    const mo=document.querySelector('#modeSheet .moCard'); assert(visible(mo),'moCard 안 보임');
    const w=mo.getBoundingClientRect().width; assert(w>200&&w<400,'moCard 폭 이상: '+w); closeModeSheet(); return 'w='+w; });
  await step('방찾기 열림+목록', ()=>{ openRooms(); const rm=document.querySelector('#rooms .rmCard'); assert(visible(rm),'rmCard 안 보임');
    const n=$('roomList').children.length; assert(n>0,'방 목록 비어있음'); $('rooms').classList.add('hide'); return n+'개 방'; });
}

// ── 그룹: game (솔로 무한) ──
async function groupGame(){
  await step('솔로 시작', async()=>{ skipIf(!USEMAPS.nemo_inf,'nemo_inf 맵 없음'); startSoloInfinite(); await sleep(400); G.loading=false;
    assert(G.phase==='playing','phase='+G.phase); return 'ok'; });
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
  await step('개인보스 소환(해금 시)', ()=>{ const pt=(typeof PBOSS_TYPES!=='undefined')&&PBOSS_TYPES.find(p=>pbossUnlocked(p));
    skipIf(!pt,'해금된 개인보스 없음'); const b=G.enemies.length, bp=(G.pendSpawn||[]).length; summonPersonalBoss(pt.id);
    // 적은 pendSpawn 대기열을 거쳐 등장 — 소환 접수는 쿨다운 설정 + 대기열/적 증가로 판정
    assert((G.pbossCds[pt.id]||0)>0,'쿨다운 미설정(소환 거부됨)');
    assert(G.enemies.length>b || (G.pendSpawn||[]).length>bp,'적/대기열 미증가'); return pt.name; });
  await step('포인트 강화 팝업', ()=>{ skipIf(typeof openPointUpgrade!=='function','없음'); openPointUpgrade();
    assert(visible(document.querySelector('#pointPanel .ppHead, .ppHead')),'ppHead 안 보임'); closePointUpgrade(); return 'ok'; });
  await step('설정 팝업', ()=>{ openSettings(); assert(visible($('settingsPop')),'settingsPop 안 보임'); closeSettings(); return 'ok'; });
  await step('유닛 판매(홈 판매 API)', ()=>{ skipIf(typeof sellUnit!=='function','sellUnit 없음');
    const u=G.units.find(x=>!x.fixed && !x.hero && !x.atBoss); skipIf(!u,'판매할 유닛 없음'); const b=G.units.length;
    sellUnit(u);   // 유닛 객체를 받는다(uid 아님)
    assert(G.units.length===b-1,'판매 후 수 변화 없음 '+b+'→'+G.units.length); return 'ok'; });
}

// ── 그룹: sandbox (관리자) ──
async function groupSandbox(){
  await step('샌드박스 진입', async()=>{ skipIf(typeof enterSandbox!=='function','없음'); enterSandbox(); await sleep(300);
    assert(G.sandbox===true,'sandbox 플래그'); return 'units='+G.units.length; });
  await step('샌드박스 탭 구성(전투실험·건설 표시, 보스 숨김)', ()=>{ updatePbossFab();
    assert($('battleTab').style.display!=='none','battleTab 숨김'); assert($('buildTab').style.display!=='none','buildTab 숨김');
    assert($('bossTab').style.display==='none','bossTab이 샌드박스에 노출'); return 'ok'; });
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
