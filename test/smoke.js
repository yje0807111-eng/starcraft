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
  await step('마을 입장: 캐릭터 생성 → 그대로 입장', ()=>{ skipIf(typeof openCharScreen!=='function','캐릭터 시스템 없음');
    PROF().chars.length=0; PROF().curId='';           // 이전 실행이 남긴 캐릭터를 지우고 첫 진입 상태로
    hubGoTown();
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
    assert(['gacha','gate','shop','gym'].every(id=>shown.indexOf(id)>=0),'화면 밖 모서리 구역의 가장자리 표시가 없음: '+shown.join(','));
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
    townToHub(); return n+'프레임 이동'; });
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
    closeTownPanel(); townToHub(); return '통과·겹침=무반응 / 지정=열림'; });
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
  await step('장비 마이그레이션: 구버전 정수 티어 → 아이템(스탯 유지)', ()=>{ skipIf(typeof migrateProfile!=='function','마이그레이션 없음');
    const keep=JSON.parse(JSON.stringify(PLAYER_META));
    PLAYER_META.profile={ ver:3, pcoin:0, curId:'cX', items:[], chars:[{ id:'cX', cls:'ranger', name:'구버전',
      xp:0, level:1, statPoints:0, dgFloor:0, unit:{ jobId:'ranger', level:1, evoStars:0,
        stats:{pow:0,vit:0,foc:0,agi:0}, gear:{weapon:3, armor:2, trinket:0} } }],
      idle:{sourceId:'drill',lastClaimTs:0}, unlocks:{}, lastSeenTs:0, pets:{}, equip:[], petSlots:2 };
    migrateProfile();
    const c=CHAR(), w=profFindItem(c.unit.gear.weapon), ar=profFindItem(c.unit.gear.armor);
    assert(w && ar,'정수 장비가 아이템으로 변환되지 않음');
    assert(w.main===9 && ar.main===8,'스탯이 보존되지 않음(무기 3×3=9, 방어구 2×4=8): '+w.main+'/'+ar.main);
    assert(c.unit.gear.trinket==='','0이던 슬롯이 아이템을 만듦');
    PLAYER_META=keep; return '무기 +'+w.main+' · 방어구 +'+ar.main; });
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
