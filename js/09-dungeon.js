/* ============================================================================
 * 09-dungeon.js — 던전 — 캐릭터가 직접 싸우는 전용 화면
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ============================================================================
// ⚔ 던전 — 캐릭터가 직접 싸우는 전용 화면
// ⛔ 유즈맵(네모네모·직스)과 완전 분리. G / step / loop / U / GACHA_* / mapCfg /
//    metaBonus 를 한 줄도 참조하지 않는다. 적 표·밸런스·루프·렌더를 전부 자체 보유.
//    스모크 '던전: 유즈맵 상태 미접촉'이 이 규칙을 정적(소스 검사)·동적(G 스냅샷)으로 지킨다.
// ============================================================================
const DG_WAVES=3;                    // 층당 웨이브 수(마지막은 보스)
const DG_W=320, DG_H=380;            // 전장 자체 좌표계(px). 가로는 고정, 세로는 화면 비율로 맞춘다(DG.h)
const DG_GAP=0.8;                    // 웨이브 사이 간격(초)
const DG_SEP=32;                     // 적끼리 최소 간격(px) — 없으면 전부 한 점에 포개진다
// 던전 전용 적 표 — 유즈맵 유닛 정의(U/GACHA_UNITS)와 무관.
// range = 공격 사거리 겸 '접근을 멈추는 거리'라, 근접이라도 스프라이트 반지름(약 14) 두 개분은 띄워야 겹치지 않는다.
const DG_FOES={
  slime: { name:'슬라임', ico:'🟢', hp:34,  atk:5,  spd:34, range:30, cd:1.2 },
  bat:   { name:'박쥐',   ico:'🦇', hp:24,  atk:8,  spd:64, range:28, cd:0.9 },
  golem: { name:'석상',   ico:'🗿', hp:88,  atk:13, spd:22, range:33, cd:1.7 },
  wraith:{ name:'망령',   ico:'👻', hp:48,  atk:12, spd:46, range:88, cd:1.5 },
  keeper:{ name:'수문장', ico:'👹', hp:240, atk:24, spd:28, range:38, cd:1.3, boss:true },
};
const DG_SKILLS={                    // 직업 계열별 1스킬
  ranger:{ name:'집중 사격', ico:'🎯', cd:9,  dur:3.5, tip:'공격 속도 2배' },
  scout: { name:'질풍',     ico:'💨', cd:9,  dur:3.5, tip:'이동·공격 속도 상승' },
  warden:{ name:'수호',     ico:'🛡',  cd:11, dur:4.5, tip:'받는 피해 절반' },
};
// ── 종류별 보상 ────────────────────────────────────────────────────────────
// ⚠ 아래 두 배수는 **아직 실측 전이다**(BALANCE.md §5 A5). 바꿨으면 거기 표도 갱신할 것.
const DG_CUR_MUL=6;       // 일반 토벌 = '대량' 지급 배수(다른 종류가 주는 기본 재화 대비)
const DG_GAS_RATE=0.35;   // 일반 토벌이 주는 가스 = 그 미네랄의 이 비율
// 🎟 뽑기권도 **단계가 깊을수록 더 많이** 나온다 (2026-08-20 사용자 확정).
//   "초반은 적게 주지만 라운드가 올라갈수록 조금씩 더해지면서 상위 라운드로 갈수록 더 많은 보상."
//   ⛔ 항상 1장으로 되돌리지 말 것 — 그러면 깊이 갈 이유가 재화밖에 안 남아 종류를 나눈 뜻이 반쯤 사라진다.
const DG_TIX_STEP=5;   // 이 단계마다 1장씩 더 (1~5단계=1장 · 6~10=2장 · …)
function dgTixN(floor){ return 1+Math.floor((Math.max(1,floor|0)-1)/DG_TIX_STEP); }
function dgFloorReward(floor, id){ const n=Math.max(1, floor|0), d=dgDef(id);
  const base=Math.round(40+n*22);
  const r={ floor:n, id:d.id, pc:base, gas:0, xp:Math.round(25+n*14), tixKind:null, tixN:0 };
  if(d.rw.cur){ r.pc=Math.round(base*DG_CUR_MUL); r.gas=Math.round(base*DG_CUR_MUL*DG_GAS_RATE); }
  if(d.rw.tix){ r.tixKind=d.rw.tix; r.tixN=dgTixN(n); }
  return r; }
// 보상 지급 — **입장(전투 클리어)과 소탕(이전 단계 즉시)이 같은 한 곳을 지난다.**
// ⚠ 두 벌로 나누면 반드시 어긋난다: 옛 코드가 실제로 그랬고, 소탕만 뽑기권을 못 받아
//   "장비 토벌을 소탕하면 장비권이 안 나오는" 상태였다(2026-08-20 사용자 지적으로 발견).
function dgGrantReward(r){ const p=PROF(), c=CHAR(); if(!p||!r) return r;
  p.pcoin=(p.pcoin||0)+r.pc; if(r.gas) p.gas=(p.gas||0)+r.gas;
  if(r.tixKind && r.tixN>0) dgAddTicket(r.tixKind, r.tixN);
  if(c){ profGainXp(c, r.xp); profApplyLevelUps(c); }
  return r; }
// 보상 한 줄(사람이 읽는 문구) — 표에서만 나온다
function dgRewardText(r){ if(!r) return '';
  let h=resIco('mineral','gi')+' <b>'+r.pc.toLocaleString()+'</b>';
  if(r.gas) h+=' · '+resIco('gas','gi')+' <b>'+r.gas.toLocaleString()+'</b>';
  if(r.tixKind && r.tixN>0) h+=' · '+resIco('ticket_'+r.tixKind,'gi')+' <b>'+r.tixN+'</b>';
  return h; }
// ── 단계 진행도는 **종류마다 따로** 쌓인다(2026-08-20 확정) ─────────────────
// 보상 성격이 다르니 "오늘은 장비 파러 간다"가 성립해야 한다. 공유하면 새 종류를 열자마자
// 고단계로 시작해 그 종류의 보상이 한 번에 쏟아진다.
// ⚠ 옛 저장의 c.dgFloor 하나는 '일반 토벌' 기록이다 — v11 마이그레이션이 옮기고 지운다.
function dgFloors(){ const c=CHAR(); if(!c) return null;
  if(!c.dgFloors || typeof c.dgFloors!=='object') c.dgFloors={};
  for(const d of DG_DUNGEONS) if(typeof c.dgFloors[d.id]!=='number') c.dgFloors[d.id]=0;
  return c.dgFloors; }
// 인자 없음 = **전 종류 최고 단계**. 장비 등급·관문 표시가 이걸 본다(종류가 늘수록 자연히 깊어진다).
function dgMaxFloor(id){ const f=dgFloors(); if(!f) return 0;
  if(id) return f[id]||0;
  let m=0; for(const d of DG_DUNGEONS){ const v=f[d.id]||0; if(v>m) m=v; } return m; }
function dgSetFloor(id, n){ const f=dgFloors(); if(f && n>(f[id]||0)) f[id]=n; }
const DG_LV_PER_FLOOR=2;                 // 레벨 N당 한 층씩 열린다(장비 슬롯과 같은 성장 축)
function dgFloorCap(){ const c=CHAR(); return c? 1+Math.floor((c.level-1)/DG_LV_PER_FLOOR) : 1; }
function dgFloorReqLv(floor){ return 1+(floor-1)*DG_LV_PER_FLOOR; }
function dgWaveFoes(floor, wave){
  if(wave>=DG_WAVES) return ['keeper'];
  const pool=(floor<3)?['slime','bat']:(floor<6)?['slime','bat','golem']:['bat','golem','wraith'];
  const n=Math.min(6, 2+Math.floor(floor/2)+(wave>1?1:0));
  const out=[]; for(let i=0;i<n;i++) out.push(pool[(floor+wave+i)%pool.length]);
  return out; }
function dgFoeStat(key, floor){ const f=DG_FOES[key], k=Math.pow(1.28, floor-1);
  return { key:key, name:f.name, ico:f.ico, boss:!!f.boss, hpMax:Math.round(f.hp*k),
           atk:Math.round(f.atk*k*0.92), spd:f.spd, range:f.range, cd:f.cd }; }
// 캐릭터 스탯 → 전투 수치. '스펙업이 체감되는' 유일한 환산 지점이다.
// 던전 스펙 — 사냥터와 '같은 기본 스탯'에서 나온다(2026-08-18).
//   옛 식은 pow/vit/foc/agi 를 직접 읽었는데, 그 네 키가 장비 전용이 되면서 업그레이드·포인트가
//   던전에만 반영되지 않는 구멍이 생겼다. 배수는 옛 체감을 그대로 맞춘 값이다.
const DG_SPEC_MUL={ atk:1.6, hp:1.35, cd:1.5 };
function dgMySpec(){ const st=hbCharStats();
  return { hpMax:Math.round(st.hpMax*DG_SPEC_MUL.hp), atk:Math.round(st.atk*DG_SPEC_MUL.atk),
           crit:Math.min(0.5, st.crit),
           spd:52*(csVal('aspd')/100), range:52, cd:Math.max(0.34, st.cd*DG_SPEC_MUL.cd) }; }

let DG=null, _dgRaf=0, _dgLast=0;
// ⏩ 자동 전투 배속 — 한 판이 12~20초다(2026-08-20 실측: 1단계 12.4s · 5단계 19.9s).
//    10배면 1.2~2.0초에 끝난다 = 사용자 요구 "거의 1초정도".
//    ⛔ dgStep(dt*배속) 로 올리지 말 것 — 충돌·사거리 판정이 샌다. hbPump 와 같은 규칙(같은 dt 를 여러 번).
const DG_AUTO_SPEED=10;
// ══ 사냥터 엔진 위의 토벌 (4단계 · 2026-08-20) ═══════════════════════════════════════
// 자동 전투는 **사냥터 엔진**(HBS.dg)으로 돈다 — 이동·카이팅·스킬·3D 를 두 번 만들지 않기 위해서다.
// ⚠ 옛 DG 엔진(dgStep/dgRender)은 아직 '직접 전투' 화면이 쓴다. 5단계에서 그쪽도 옮긴다.
// 결과는 hbSettle/hbDie 분기가 아래 둘을 부른다.
function dgHbWin(S){ const c=CHAR(), id=S.dgId, r=dgFloorReward(S.floor, id);
  const prevMax=dgMaxFloor(id);
  const sl=(typeof profSlots==='function')?profSlots():[];
  r.item=(sl.length && Math.random()<DG_DROP_P) ? profAddItem(profMakeItem(sl[Math.floor(Math.random()*sl.length)], S.floor)) : null;
  dgGrantReward(r);
  if(c && S.floor>prevMax) dgSetFloor(id, S.floor);
  if(S.needKey) dgSpendKey(id);                        // 완료 시에만 소모(실패는 미소모)
  if(typeof dqNote==='function') dqNote('dgWin',1);
  profSyncUnlocks(); saveMeta();
  dgHbDone(S, true, r); }
function dgHbLose(S){ dgHbDone(S, false, null); }
// 결과 알림 — 자동은 화면이 없으므로 토스트로. 허브가 열려 있으면 새로 그린다.
function dgHbDone(S, won, r){ const d=dgDef(S.dgId), fl=S.floor, manual=!S.auto;
  if(typeof dgHbEnd==='function') dgHbEnd();
  if(manual) dgFightRestore();                          // 🎮 직접 전투였으면 화면을 사냥터로 되돌린다
  if(typeof playSfx==='function') playSfx(won?'hero_merge':'ui_close');
  if(typeof toast==='function'){
    if(won){ let tx='⚔ '+d.name+' '+fl+'단계 클리어 · +'+r.pc.toLocaleString()+' M';
      if(r.gas) tx+=' · +'+r.gas.toLocaleString()+' G';
      if(r.tixN) tx+=' · 🎟 +'+r.tixN;
      toast(tx+' · +'+r.xp+' XP'); }
    else toast('⚔ '+d.name+' '+fl+'단계 실패 — 🗝 열쇠는 소모되지 않았습니다'); }
  if(typeof updateCurBar==='function') updateCurBar();
  if(manual) openDungeonHub();                          // 직접 전투는 허브로 돌아온다
  else { renderDungeonHub(); if(_dgSheetId) renderDgSheet(); } }
// 토벌이 지금 돌고 있나 — 자동이 도는 중에 또 누르면 판이 덮인다
function dgBusy(){ return !!(DG || (typeof HBS!=='undefined' && HBS.dg && HBS.dg.on)); }
// ══ 🎮 직접 전투(5단계) — 사냥터 화면(HOME)을 **그대로 빌린다** ═══════════════════════════
// ⛔ 두 번째 전투 화면을 만들지 말 것(단일 소스). 빌린 화면에서 사냥터 것만 CSS(.dgFight)로 걷는다.
// 🧹 3D 는 공용이다 — 빌릴 때와 돌려줄 때 **양쪽에서** 지운다. 한쪽만 하면 반대 방향 전환에서 잔상이 샌다.
function dg3dWipe(){ if(!window.M3D) return;
  try{ M3D.clearGameModels && M3D.clearGameModels(); }catch(e){}
  try{ M3D.clearIdlePools && M3D.clearIdlePools(); }catch(e){} }
function dgFightEnter(floor, id, key){
  const cv=document.getElementById('hbCv'); if(!cv) return false;
  if(typeof openHome==='function') openHome();          // 사냥터 화면이 곧 전장이다
  if(HBS.hunt) HBS.hunt.bg=true;                        // 사냥터는 배경으로 — 시뮬은 hbPumpAll 이 계속 민다
  const S=dgHbStart(floor, id, { auto:false, key:!!key, cv:cv });
  if(!S) return false;
  hbUse('dg');                                          // 화면이 보는 세션을 토벌로 옮긴다
  document.body.classList.add('dgFight');
  dg3dWipe();                                           // 🧹 빌릴 때 — 사냥터가 만든 모델을 지우고 시작
  hbWith('dg', ()=>{ hbResize(); hbHud(); });
  if(typeof renderHbBar==='function') renderHbBar();
  hbKick();                                             // 그리기 재개
  return true; }
// 화면을 사냥터로 되돌린다 — 포기·클리어·실패가 전부 여기를 지난다(되돌리기를 여러 벌 두지 않는다)
function dgFightRestore(){
  if(!document.body.classList.contains('dgFight')) return;
  document.body.classList.remove('dgFight');
  hbUse('hunt');
  dg3dWipe();                                           // 🧹 돌려줄 때 — 토벌이 만든 모델을 지운다
  if(HBS.hunt){ HBS.hunt.bg=false; HBS.hunt.lastSim=performance.now(); }
  hbWith('hunt', ()=>{ hbResize(); hbHud(); });
  if(typeof renderHbBar==='function') renderHbBar();
  hbKick(); }
// 포기 — 전투를 버린다. ⚠ 열쇠는 소모하지 않는다(완료할 때만 쓴다는 규칙 그대로).
function dgFightGiveUp(){ const S=HBS.dg; if(!S) return;
  hbSetSess('dg', null); dgFightRestore();
  if(typeof playSfx==='function') playSfx('ui_close');
  if(typeof toast==='function') toast('⚔ 토벌을 포기했습니다 — 🗝 열쇠는 소모되지 않았습니다');
  openDungeonHub(); }
// opt: { auto:자동 전투(화면 없이 배속) · id:토벌 종류 · key:완료 시 열쇠 소모 }
// ⚠ id/key 를 **여기서** 심는다 — 자동은 이 함수 안에서 판이 끝날 수도 있어, 호출부에서
//   dgStart(...) 뒤에 심으면 이미 dgWin 이 지나간 뒤가 된다(보상이 엉뚱한 종류로 들어간다).
function dgStart(floor, opt){ const c=CHAR(); if(!c) return false;
  const o=opt||{}, sp=dgMySpec();
  DG={ floor:floor, wave:0, gap:0.3, over:0, reward:null, _els:null,
       auto:!!o.auto, dgId:o.id||'normal', needKey:!!o.key,
       h:DG_H, me:{ x:DG_W/2, y:DG_H-46, hp:sp.hpMax, sp:sp, t:0 }, skill:{ cd:0, left:0 }, foes:[] };
  if(DG.auto){ DG.h=DG_H; DG.me.y=DG.h-46; dgStartLoop(); return true; }   // 자동 = 화면에 안 들어간다
  showAppScreen('dgScreen');
  const ar=document.getElementById('dgArena');
  if(ar){ ar.innerHTML='';
    const w=ar.clientWidth||0, hh=ar.clientHeight||0;
    if(w>0&&hh>0) DG.h=Math.round(DG_W*hh/w); }   // 가로 배율 하나로 그리므로 세로 논리 크기를 화면 비율에 맞춘다
  DG.me.y=DG.h-46;
  dgRender(); dgStartLoop(); return true; }
function dgSpawnWave(){ DG.wave++;
  const keys=dgWaveFoes(DG.floor, DG.wave);
  DG.foes=keys.map((k,i)=>{ const f=dgFoeStat(k, DG.floor);
    return Object.assign(f, { id:'f'+DG.wave+'_'+i, hp:f.hpMax, t:0.4+i*0.15,
      x:34+((i+0.5)/keys.length)*(DG_W-68), y:34+((i%2)*30) }); }); }
// 한 프레임 전진 — rAF(dgTick)와 스모크가 같은 함수를 쓴다(헤드리스는 rAF가 안 돈다)
function dgStep(dt){ if(!DG || DG.over) return;
  const me=DG.me, sp=me.sp, cls=(CHAR()||{}).cls, buff=DG.skill.left>0;
  const guard=(cls==='warden'&&buff), haste=(cls!=='warden'&&buff)?2:1, dash=(cls==='scout'&&buff)?1.5:1;
  if(DG.skill.cd>0)   DG.skill.cd=Math.max(0, DG.skill.cd-dt);
  if(DG.skill.left>0) DG.skill.left=Math.max(0, DG.skill.left-dt);
  if(!DG.foes.length){ DG.gap-=dt;
    if(DG.gap<=0){ if(DG.wave>=DG_WAVES){ dgWin(); return; } dgSpawnWave(); DG.gap=DG_GAP; }
    dgRender(); return; }
  let t=null, td=1e9;                                        // 가장 가까운 적을 향해
  for(const f of DG.foes){ const d=Math.hypot(f.x-me.x, f.y-me.y); if(d<td){ td=d; t=f; } }
  // 🤖 자동 = **제자리에서** 싸운다(사용자 확정). 적이 알아서 오므로 판은 끝난다.
  //    직접 전투가 이동·후퇴·카이팅으로 이길 확률을 올리는 것이 두 갈래를 나눈 이유다 —
  //    ⛔ 자동에도 접근 이동을 켜면 둘이 같아져서 '직접'을 고를 이유가 사라진다.
  if(DG.auto && DG.skill.cd<=0 && DG.foes.length) dgSkill();   // 스킬도 자동 사용
  if(td>sp.range){ if(!DG.auto){ const k=Math.min(1, sp.spd*dash*dt/Math.max(td,1e-6));
      me.x+=(t.x-me.x)*k; me.y+=(t.y-me.y)*k; } }
  else { me.t-=dt*haste;
    if(me.t<=0){ me.t=sp.cd;
      const crit=Math.random()<sp.crit, dmg=Math.round(sp.atk*(crit?2:1));
      t.hp-=dmg; dgHit(t.x, t.y, dmg, crit?'crit':'me');
      if(t.hp<=0) DG.foes=DG.foes.filter(f=>f!==t); } }
  for(const f of DG.foes){ const d=Math.hypot(me.x-f.x, me.y-f.y);
    if(d>f.range){ const k=Math.min(1, f.spd*dt/Math.max(d,1e-6)); f.x+=(me.x-f.x)*k; f.y+=(me.y-f.y)*k; }
    else { f.t-=dt;
      if(f.t<=0){ f.t=f.cd;
        const dmg=Math.max(1, Math.round(f.atk*(guard?0.5:1)));
        me.hp-=dmg; dgHit(me.x, me.y, dmg, 'foe');
        if(me.hp<=0){ me.hp=0; dgLose(); return; } } } }
  for(let i=0;i<DG.foes.length;i++) for(let j=i+1;j<DG.foes.length;j++){   // 적끼리 밀어내기(최대 6기라 O(n²)로 충분)
    const a=DG.foes[i], b=DG.foes[j], dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
    if(d>1e-3 && d<DG_SEP){ const k=(DG_SEP-d)/d*0.5; a.x-=dx*k; a.y-=dy*k; b.x+=dx*k; b.y+=dy*k; } }
  for(const f of DG.foes){ f.x=Math.max(14, Math.min(DG_W-14, f.x)); f.y=Math.max(14, Math.min(DG.h-14, f.y)); }
  me.x=Math.max(14, Math.min(DG_W-14, me.x)); me.y=Math.max(14, Math.min(DG.h-14, me.y));
  dgRender(); }
const DG_DROP_P=0.55;   // 층 클리어 시 장비가 떨어질 확률
function dgWin(){ const c=CHAR(), p=PROF(), id=(DG&&DG.dgId)||'normal', r=dgFloorReward(DG.floor, id);
  DG.over=1; DG.reward=r;
  const sl=profSlots();   // 층이 깊을수록 고등급·고레벨(profMakeItem이 층을 레벨로 받는다)
  r.item=(sl.length && Math.random()<DG_DROP_P) ? profAddItem(profMakeItem(sl[Math.floor(Math.random()*sl.length)], DG.floor)) : null;
  const prevMax=dgMaxFloor(id);                                     // ⚠ '그 종류'의 최고 단계와 견준다
  dgGrantReward(r);                                                 // 재화·가스·뽑기권·XP 는 전부 여기서
  if(c && DG.floor>prevMax) dgSetFloor(id, DG.floor);
  if(DG.needKey && DG.dgId && typeof dgSpendKey==='function') dgSpendKey(DG.dgId);   // 완료 시 열쇠 1 소모(실패 시 미소모)
  if(typeof dqNote==='function') dqNote('dgWin',1);                 // 📅 일일 — 토벌 단계 클리어
  profSyncUnlocks(); saveMeta(); dgStopLoop(); dgRender(); }
function dgLose(){ DG.over=-1; dgStopLoop(); dgRender(); }
function dgSkill(){ if(!DG || DG.over || DG.skill.cd>0) return;
  const S=DG_SKILLS[(CHAR()||{}).cls] || DG_SKILLS.ranger;
  DG.skill.cd=S.cd; DG.skill.left=S.dur;
  if(typeof playSfx==='function') playSfx('ui_open'); dgRender(); }
function dgToHub(){ dgStopLoop(); DG=null; openHome(); openDungeonHub(); }   // 전투 종료 → HOME 복귀 후 토벌 팝업
// ── 🗝 던전 열쇠(매일 09:00 보충 · 던전별 2개 · 완료 시에만 소모) · 🎟 뽑기권 · 던전 허브 ──
const DG_KEY_DAILY=2;   // 던전마다 하루 열쇠 수(09:00 리셋)
// ── 토벌 종류(단일 소스) — 종류를 늘릴 땐 여기 한 줄 + TIX_KINDS 한 칸 ──────────────
// 종류를 가르는 것은 **보상 성격**이다: 일반 = 재화 대량 / 나머지 = 그 종류의 뽑기권.
// ⚠ reqLv(해금 레벨)와 단계 상한(dgFloorCap → DG_LV_PER_FLOOR)은 **다른 문**이다.
//   열려도 단계가 안 열릴 수 있고, 그 반대도 된다. 둘을 한 값으로 합치지 말 것.
const DG_DUNGEONS=[
  {id:'normal', name:'일반 토벌', ico:'⚔️', reqLv:1,   tint:'#2f4a72', sub:'미네랄·가스 대량', rw:{cur:1}},
  {id:'gear',   name:'장비 토벌', ico:'🛡️', reqLv:10,  tint:'#6a4a24', sub:'장비 뽑기권',     rw:{tix:'gear'}},
  {id:'pet',    name:'펫 토벌',   ico:'🐾', reqLv:30,  tint:'#2f6a52', sub:'펫 뽑기권',       rw:{tix:'pet'}},
  {id:'ally',   name:'동료 토벌', ico:'🤝', reqLv:50,  tint:'#6a2f4a', sub:'동료 뽑기권',     rw:{tix:'ally'}},
  {id:'rune',   name:'룬 토벌',   ico:'🔮', reqLv:100, tint:'#54366a', sub:'룬 뽑기권',       rw:{tix:'rune'}} ];
function dgDef(id){ return DG_DUNGEONS.find(x=>x.id===id) || DG_DUNGEONS[0]; }
function _dgDayKey(){ const d=new Date(); const day=new Date(d.getFullYear(),d.getMonth(),d.getDate()); if(d.getHours()<9) day.setDate(day.getDate()-1); return day.getTime(); }
function dgKeyN(id){ const p=PROF(); if(!p) return 0; if(!p.dgKeys) p.dgKeys={};
  const dk=_dgDayKey(); let e=p.dgKeys[id]; if(!e || e.day!==dk){ e={n:DG_KEY_DAILY, day:dk}; p.dgKeys[id]=e; } return e.n; }
function dgSpendKey(id){ if(dgKeyN(id)<=0) return false; PROF().dgKeys[id].n--; saveMeta(); return true; }
function dgAddTicket(kind,n){ const p=PROF(); if(!p.tickets) p.tickets=emptyTickets(); p.tickets[kind]=(p.tickets[kind]||0)+(n||1); }
// ⛔ 옛 dgAwardTickets 는 없앴다 — 지급 입구가 둘이면 반드시 어긋난다(실제로 소탕이 빠져 있었다).
//    권종·수량은 dgFloorReward() 가 정하고, 지급은 dgGrantReward() 한 곳이 한다.
function openDungeonHub(){ if(typeof loadMeta==='function') loadMeta();
  profEnsureChar();   // 캐릭터가 없으면 조용히 기본 유닛을 지급한다(선택 화면 없음)
  const home=document.getElementById('homeScreen');
  if(home && home.classList.contains('hide')) openHome();                        // 토벌은 HOME 위 팝업 — 다른 화면에서 부르면 먼저 HOME으로
  dgCloseSheet(); popShow('dgHubScreen'); renderDungeonHub();

  if(typeof playSfx==='function') playSfx('ui_open');
  if(typeof paintIcons==='function') paintIcons(document.getElementById('dgHubScreen')); }
function closeDungeonHub(){ dgCloseSheet(); popHide('dgHubScreen');
  if(typeof playSfx==='function') playSfx('ui_close'); }
// ── 목록 조각들 — 값은 전부 표(DG_DUNGEONS)와 공식(dgFloorReward)에서 나온다 ⛔ 하드코딩 금지 ──
const DG_ICO_DIR='assets/icons/dungeons/';
// 던전 아이콘 — 파일이 있으면 그것, 없으면 표의 이모지로 떨어진다(beaconProHTML·uiIco 와 같은 규칙).
function dgIcoHTML(d){ return '<span class="dgIco"><img src="'+DG_ICO_DIR+'dg_'+d.id+'.webp" alt="" draggable="false"'
  +' data-fb="'+escHtml(d.ico)+'" onerror="_dgIcoFail(this)"></span>'; }
function _dgIcoFail(im){ try{ const p=im.parentNode; if(p) p.textContent=im.getAttribute('data-fb')||''; }
  catch(_e){ try{ im.remove(); }catch(_e2){} } }
// 🗝 열쇠 — ui_key.webp 가 들어오면 자동 교체. ⛔ 이모지를 박지 말 것(DESIGN.md 재화 아이콘 규칙)
const _DG_KEY_SVG='<svg viewBox="0 0 24 24"><circle cx="8.5" cy="8.5" r="4.2"/><path d="M11.6 11.6 20 20M17 17l-2 2M20 20l1.4-1.4"/></svg>';
function dgKeyHTML(n, max){ return '<span class="dgKey"><img src="assets/icons/ui/ui_key.webp" alt="" draggable="false" onerror="_dgKeyFail(this)">'
  +'<span>'+n+'<s>/'+(max||DG_KEY_DAILY)+'</s></span></span>'; }
function _dgKeyFail(im){ try{ im.outerHTML=_DG_KEY_SVG; }catch(_e){ try{ im.remove(); }catch(_e2){} } }
// 한 버튼이 주는 것 — 재화 아이콘 + 수치를 세로로. 없으면 '—'
function dgValsHTML(r){ if(!r) return '<div class="dgVals off"><span>—</span></div>';
  let h='<div class="dgVals"><span>'+resIco('mineral','ri')+r.pc.toLocaleString()+'</span>';
  if(r.gas) h+='<span>'+resIco('gas','ri')+r.gas.toLocaleString()+'</span>';
  if(r.tixKind && r.tixN>0) h+='<span>'+resIco('ticket_'+r.tixKind,'ri')+r.tixN+'</span>';
  return h+'</div>'; }
// ⚔ 토벌 목록 행 — **허브와 시트가 같은 함수를 쓴다**(단일 소스).
//   mode 'hub'  = 버튼 둘 + 각 버튼이 주는 값
//   mode 'sheet'= 버튼 없음 + 입장 보상만(시트에서는 '어떻게 싸울지'만 고른다)
// ⛔ 시트용 행을 따로 만들지 말 것 — 두 벌이 되면 반드시 어긋난다(CLAUDE.md 단일 소스 원칙).
function dgRowHTML(d, mode){ const c=CHAR(); if(!c) return '';
  const lock=c.level<d.reqLv; d.reqLvLocked=lock;
  const mx=lock?0:dgMaxFloor(d.id), k=lock?0:dgKeyN(d.id);
  const nx=mx+1, okLv=nx<=dgFloorCap();
  const canSwp=!lock && mx>0 && k>0, canEnt=!lock && okLv && k>0;
  const rSwp=(!lock && mx>0)? dgFloorReward(mx, d.id) : null;
  const rEnt=(!lock && okLv)? dgFloorReward(nx, d.id) : null;
  let h='<div class="roomItem dgRow'+(lock?' locked':'')+'" style="--dc:'+d.tint+'">'
    +dgIcoHTML(d)
    +'<div class="riMain"><div class="riName"><u>'+escHtml(d.name)+'</u>'
      +'<span class="dgStg">'+(lock?('Lv.'+d.reqLv):(mode==='sheet'? nx+'단계' : (mx? mx+'단계':'미개척')))+'</span></div>'
    +'<div style="margin-top:5px">'+(lock?'':dgKeyHTML(k))+'</div></div>';
  if(mode==='sheet'){ h+=dgValsHTML(rEnt); }        // 시트 = 이번에 받을 것 하나만
  else { const at=' onclick="event.stopPropagation();';
    h+='<div class="dgBtnW"><button class="actBtn"'+(canSwp?'':' disabled')+at+'dgSweep(\''+d.id+'\')">소탕</button>'
       +dgValsHTML(canSwp?rSwp:null)+'</div>'
      +'<div class="dgBtnW"><button class="actBtn'+(canEnt?' pri':'')+'"'+(canEnt?'':' disabled')+at+'dgOpenSheet(\''+d.id+'\')">'
       +(lock?'잠김':(okLv?'입장':'Lv.'+dgFloorReqLv(nx)))+'</button>'
       +dgValsHTML(canEnt?rEnt:null)+'</div>'; }
  return h+'</div>'; }
function renderDungeonHub(){ const body=document.getElementById('dgHubBody'); if(!body) return;
  if(!CHAR()) return;
  let h='<div class="dgHubHead">토벌 열쇠는 <b>매일 09:00</b>에 보충됩니다. 열쇠는 토벌을 완료할 때만 소모됩니다.</div>';
  h+='<div class="rmList">'+DG_DUNGEONS.map(d=>dgRowHTML(d,'hub')).join('')+'</div>';
  // 🎟 보유 뽑기권 — 종류가 늘어도 여기는 안 고친다(TIX_KINDS 가 단일 소스)
  const tx=(PROF()&&PROF().tickets)||{};
  h+='<div class="dgTix">'+TIX_KINDS.map(k=>resIco('ticket_'+k,'gi')+'<b>'+(tx[k]||0)+'</b>').join(' ')+'</div>';
  body.innerHTML=h;
  if(typeof paintIcons==='function') paintIcons(body); }
// 던전 팝업 — 이전 스테이지 소탕 + 입장
let _dgSheetId=null;
function dgOpenSheet(id){ const d=DG_DUNGEONS.find(x=>x.id===id), c=CHAR(); if(!d||!c) return;
  if(c.level<d.reqLv){ if(typeof toast==='function') toast('Lv.'+d.reqLv+'부터 열립니다'); return; }
  _dgSheetId=id; renderDgSheet(); const s=document.getElementById('dgSheet');
  if(s){ s.classList.remove('hide'); if(typeof fxPop==='function') fxPop(s.querySelector('.dgSheetCard')); }
  if(typeof playSfx==='function') playSfx('ui_open'); }
function dgCloseSheet(){ const s=document.getElementById('dgSheet'); if(s) s.classList.add('hide'); _dgSheetId=null; }
function renderDgSheet(){ const d=DG_DUNGEONS.find(x=>x.id===_dgSheetId), c=CHAR(); if(!d||!c) return;
  // ⚠ 단계는 **그 종류의** 기록을 본다 — dgMaxFloor() 를 인자 없이 부르면 전 종류 최고가 나와,
  //   장비 토벌을 처음 열었는데 일반 토벌 12단계 다음이 뜬다(실제로 그럴 뻔했다).
  const mx=dgMaxFloor(d.id), nx=mx+1, k=dgKeyN(d.id), okLv=nx<=dgFloorCap();
  // 🎨 S4 — 방금 누른 그 행을 시트 안에 **그대로** 얹는다(dgRowHTML 공용). 맥락이 자리로 이어진다.
  const host=document.getElementById('dgSheetRow'); if(host) host.innerHTML=dgRowHTML(d,'sheet');
  const card=document.querySelector('#dgSheet .dgSheetCard');
  if(card) card.style.setProperty('--acc', d.tint);   // 제목 아래 헤어라인만 그 토벌 색을 받는다
  // 소탕은 목록 행으로 올라갔다 — 시트에는 '어떻게 싸울지'만 남는다.
  { const bS=document.getElementById('dgSheetSweep'); if(bS) bS.disabled=!(mx>0 && k>0); }
  const gate=okLv?(k>0?'':'열쇠 없음'):('Lv.'+dgFloorReqLv(nx)+' 필요');
  for(const [bid,sub] of [['dgSheetAuto','제자리 · 즉시'],['dgSheetEnter','이동·카이팅 · 확률↑']]){
    const b=document.getElementById(bid); if(!b) continue;
    b.disabled=!(okLv && k>0);
    b.classList.toggle('pri', bid==='dgSheetEnter' && okLv && k>0);   // 직접 = 주 동작(붉은 밑변 광원)
    const i=b.querySelector('i'); if(i) i.textContent=gate||sub; }
  if(typeof paintIcons==='function') paintIcons(document.getElementById('dgSheet')); }
function dgSheetEnter(auto){ const d=DG_DUNGEONS.find(x=>x.id===_dgSheetId); if(!d) return;
  if(dgBusy()){ if(typeof toast==='function') toast('⚔ 이미 토벌이 진행 중입니다'); return; }
  const nx=dgMaxFloor(d.id)+1;
  if(nx>dgFloorCap()){ if(typeof toast==='function') toast('Lv.'+dgFloorReqLv(nx)+'부터 도전할 수 있습니다'); return; }
  if(dgKeyN(d.id)<1){ if(typeof toast==='function') toast('🗝 열쇠가 없습니다(매일 09:00 보충)'); return; }
  dgCloseSheet(); if(typeof playSfx==='function') playSfx('ui_open');
  // 둘 다 사냥터 엔진이다 — 다른 것은 '화면을 빌리는가'와 '배속·자동 스킬'뿐.
  if(auto){ if(typeof toast==='function') toast('⚔ '+d.name+' '+nx+'단계 자동 전투…');
    dgHbStart(nx, d.id, { auto:true, key:true }); return; }
  dgFightEnter(nx, d.id, true); }
// 이전 단계 토벌(소탕) — 그 종류의 최고 단계 보상을 즉시 지급. 전투 없음.
// 이전 단계 토벌(소탕) — 목록 행에서 바로 실행한다(시트를 안 지난다).
// 계획서 원문: "이전 스테이지 토벌 시 **해당 스테이지의 보상이 즉시 지급**" — 입장과 같은 표·같은 지급을 쓴다.
// 다른 것은 '전투가 없다'와 '이미 깬 단계까지만'뿐 — 소탕=천장에서 수확 / 입장=천장을 민다.
function dgSweep(id){ const d=DG_DUNGEONS.find(x=>x.id===id), c=CHAR(), p=PROF(); if(!d||!c||!p) return;
  if(c.level<d.reqLv){ if(typeof toast==='function') toast('Lv.'+d.reqLv+'부터 열립니다'); return; }
  const mx=dgMaxFloor(id); if(mx<1){ if(typeof toast==='function') toast('클리어한 단계가 없습니다'); return; }
  if(dgKeyN(id)<1){ if(typeof toast==='function') toast('🗝 열쇠가 없습니다(매일 09:00 보충)'); return; }
  dgSpendKey(id); const r=dgGrantReward(dgFloorReward(mx, id));
  profSyncUnlocks(); saveMeta();
  if(typeof playSfx==='function') playSfx('hero_merge');
  if(typeof toast==='function') toast('🗝 '+d.name+' '+mx+'단계 소탕 · +'+r.pc.toLocaleString()+' M'
    +(r.gas?(' · +'+r.gas.toLocaleString()+' G'):'')
    +(r.tixN?(' · 🎟 +'+r.tixN):'')+' · +'+r.xp+' XP');
  if(typeof updateCurBar==='function') updateCurBar();
  renderDungeonHub(); if(_dgSheetId) renderDgSheet(); }
// 옛 이름 — 시트 버튼이 사라졌지만 스모크·저장 호환으로 남긴다
function dgSheetSweep(){ if(_dgSheetId) dgSweep(_dgSheetId); }
function dgAgain(next){ const did=(DG&&DG.dgId)||'normal', floor=(DG?DG.floor:dgMaxFloor(did))+(next?1:0);
  if(floor>dgFloorCap()){ if(typeof toast==='function') toast('Lv.'+dgFloorReqLv(floor)+'부터 도전할 수 있습니다'); return; }
  if(dgKeyN(did)<1){ if(typeof toast==='function') toast('🗝 열쇠가 없습니다(매일 09:00 보충)'); return; }
  const wasAuto=!!(DG&&DG.auto);
  if(typeof playSfx==='function') playSfx('ui_open'); dgStart(floor, { auto:wasAuto, id:did, key:true }); }
function dgTick(ts){ if(!DG){ _dgRaf=0; return; }
  const dt=_dgLast? Math.min(0.05,(ts-_dgLast)/1000) : 0.016; _dgLast=ts;
  const sub=DG.auto? DG_AUTO_SPEED : 1;
  for(let i=0;i<sub;i++){ dgStep(dt); if(!DG||DG.over) break; }   // 배속 = 같은 dt 를 여러 번
  if(DG && !DG.over) _dgRaf=requestAnimationFrame(dgTick);
  else { _dgRaf=0; if(DG && DG.auto) dgAutoDone(); } }
// 자동 전투가 끝났다 — 화면이 없으니 결과는 토스트로 알리고 허브를 새로 그린다.
function dgAutoDone(){ if(!DG) return;
  const won=DG.over>0, fl=DG.floor, r=DG.reward, d=dgDef(DG.dgId);
  DG=null; dgStopLoop();
  if(typeof playSfx==='function') playSfx(won?'hero_merge':'ui_close');
  if(typeof toast==='function'){
    if(won){ let tx='⚔ '+d.name+' '+fl+'단계 클리어 · +'+r.pc.toLocaleString()+' M';
      if(r.gas) tx+=' · +'+r.gas.toLocaleString()+' G';
      if(r.tixN) tx+=' · 🎟 +'+r.tixN;
      toast(tx+' · +'+r.xp+' XP'); }
    else toast('⚔ '+d.name+' '+fl+'단계 실패 — 🗝 열쇠는 소모되지 않았습니다'); }
  renderDungeonHub(); if(_dgSheetId) renderDgSheet(); }
function dgStartLoop(){ if(_dgRaf) return; _dgLast=0; _dgRaf=requestAnimationFrame(dgTick); }
function dgStopLoop(){ if(_dgRaf){ cancelAnimationFrame(_dgRaf); _dgRaf=0; } }

// ── 렌더 계층 — DOM을 만지는 곳은 여기(dgRender/dgHit)뿐이다. 3D로 갈아끼울 땐 이 둘만 교체하면 된다 ──
function _dgScale(ar){ return (ar.clientWidth||DG_W)/DG_W; }
function dgHit(x, y, n, kind){ const ar=document.getElementById('dgArena'); if(!ar) return;
  const sc=_dgScale(ar), d=document.createElement('div');
  d.className='dgDmg '+kind; d.textContent=(kind==='foe'?'-':'')+n;
  d.style.left=((x+(Math.random()*18-9))*sc)+'px'; d.style.top=(y*sc)+'px'; ar.appendChild(d);
  setTimeout(()=>{ if(d.parentNode) d.parentNode.removeChild(d); }, 620); }
function _dgUnit(ar, els, id, cls, ico){ let e=els[id];
  if(!e){ e=document.createElement('div'); e.className='dgU '+cls;
    e.innerHTML='<span class="dgIco">'+ico+'</span><i class="dgHp"><b></b></i>';
    ar.appendChild(e); els[id]=e; }
  return e; }
function dgRender(){ if(!DG) return;
  const ar=document.getElementById('dgArena'); if(!ar) return;
  const sc=_dgScale(ar), els=DG._els||(DG._els={}), live={};
  const c=CHAR(), ico=(c && PROF_CLASSES[c.cls] && PROF_CLASSES[c.cls].ico) || '🧍';
  live.me=1; const me=_dgUnit(ar, els, 'me', 'me', ico);
  me.style.left=(DG.me.x*sc)+'px'; me.style.top=(DG.me.y*sc)+'px';
  me.classList.toggle('buff', DG.skill.left>0);
  me.querySelector('.dgHp b').style.width=Math.max(0,(DG.me.hp/DG.me.sp.hpMax*100))+'%';
  for(const f of DG.foes){ live[f.id]=1;
    const e=_dgUnit(ar, els, f.id, 'foe'+(f.boss?' boss':''), f.ico);
    e.style.left=(f.x*sc)+'px'; e.style.top=(f.y*sc)+'px';
    e.querySelector('.dgHp b').style.width=Math.max(0,(f.hp/f.hpMax*100))+'%'; }
  for(const k in els) if(!live[k]){ if(els[k].parentNode) els[k].parentNode.removeChild(els[k]); delete els[k]; }
  const w=document.getElementById('dgWave'); if(w) w.textContent=DG.floor+'층 · '+Math.max(1,DG.wave)+'/'+DG_WAVES;
  const ht=document.getElementById('dgHpTxt'); if(ht) ht.textContent=Math.ceil(DG.me.hp);
  const hb=document.getElementById('dgHpBar'); if(hb) hb.style.width=Math.max(0,(DG.me.hp/DG.me.sp.hpMax*100))+'%';
  const S=DG_SKILLS[(c||{}).cls]||DG_SKILLS.ranger;
  const si=document.getElementById('dgSkillIco'); if(si) si.textContent=S.ico;
  const sb=document.getElementById('dgSkillBtn');
  if(sb){ sb.classList.toggle('off', DG.skill.cd>0); sb.classList.toggle('on', DG.skill.left>0);
    const cd=document.getElementById('dgSkillCd');
    if(cd){ const on=DG.skill.cd>0; cd.textContent=on? Math.ceil(DG.skill.cd) : ''; cd.style.display=on?'flex':'none'; } }
  const rs=document.getElementById('dgResult');
  if(rs){ if(!DG.over) rs.classList.add('hide');
    else { rs.classList.remove('hide');
      rs.innerHTML = (DG.over>0)
        ? '<div class="dgRCard"><div class="dgRT ok">'+DG.floor+'단계 클리어!</div><div class="dgRS">'+dgRewardText(DG.reward)+' · +'+DG.reward.xp+' XP'
          +(DG.reward.item? ('<br><b style="color:'+(TIER_COLOR[DG.reward.item.tier]||'#fff')+'">'+profItemName(DG.reward.item)+'</b> 획득') : '')+'</div>'
          +'<div class="dgRBtns"><button class="twBtn" onclick="dgAgain(true)">다음 단계 🗝1</button><button class="twBtn" onclick="dgToHub()">던전으로</button></div></div>'
        : '<div class="dgRCard"><div class="dgRT bad">패배</div><div class="dgRS">'+DG.floor+'층 '+DG.wave+'웨이브에서 쓰러졌습니다</div>'
          +'<div class="dgRBtns"><button class="twBtn" onclick="dgAgain(false)">재도전 🗝1</button><button class="twBtn" onclick="dgToHub()">던전으로</button></div></div>'; } } }
// 현재 빌드 레벨 → 게임 효과(개인 적용). 게임 시작 시 G.metaB에 캐시.
//  team_* = 전체 강화: 협동에선 파티 중 '최고 레벨'이 모두에게 적용(인원수 인플레 방지). 솔로면 내 레벨.
const _TEAM_IDS=['team_atk','team_aspd','team_enemy_hp','team_enemy_def','team_credit','team_luck'];
function teamLevel(id){ let mx=buildLevel(id);
  const ix=_TEAM_IDS.indexOf(id);
  if(ix>=0 && typeof G!=='undefined' && G && G.coopTeamB){ for(const k in G.coopTeamB){ const v=(G.coopTeamB[k]||[])[ix]||0; if(v>mx) mx=v; } }
  return mx; }
function teamEffLv(id){ return _metaEffFromRaw(META_BUILDS[id], teamLevel(id)); }   // 팀 최고레벨 + 초월 배율 적용
function metaBonus(){ const L=id=>metaEffLv(id), T=id=>teamEffLv(id);   // 효과 = 초월 배율 반영 레벨(일반=그대로, 초월=×2/×4/×8)
  return {
    creditMul:   1 + L('credit_gain')*0.05,
    energyMul:   1 + L('energy_gain')*0.05,
    interestCap: L('interest_cap')*100,   // 이자 정산 보유 크레딧 인정 한도 보너스(기본 한도는 맵 cfg)
    atkMul:      1 + L('unit_atk_up')*0.025 + T('team_atk')*0.01,
    aspdMul:     Math.max(0.42, 1 - L('unit_aspd')*0.02 - T('team_aspd')*0.01),   // 공격 쿨다운 배율(낮을수록 빠름) + 팀 공속
    enemyHpMul:  Math.max(0.3, 1 - L('enemy_hp_down')*0.02 - T('team_enemy_hp')*0.01),
    enemyArmor:  L('enemy_def_down')*1 + T('team_enemy_def')*0.5,
    enemySlowMul:1,   // 적 이속 감소 업그레이드 제거(개인·팀) → 배율 고정
    unitCap:     0,   // 최대 유닛은 100 고정(증가 업그레이드 제거)
    startCredit: L('start_credit')*25 + T('team_credit')*10,
    startEnergy: L('start_energy')*10,
  startTurret: L('start_turret'),
    guaranteed:  L('guaranteed'),
    luck:        L('gacha_luck'),
    teamLuck:    T('team_luck'),   // 팀 고등급 확률(레전드+ 가중)
    energyDrawMul: 1 + L('energy_draw_bonus')*0.10,   // 에너지 뽑기 추가 획득
    gachaDoubleP:  L('gacha_double')*0.01,             // 유닛 뽑기 시 1기 추가 확률
    pbossRewardMul:1 + L('pboss_reward')*0.05,         // 개인 보스 처치 보상 배율
    pbossCdMul:    Math.max(0.4, 1 - L('pboss_cd')*0.025),   // 개인 보스 쿨다운 배율
    rbossHpMul:  Math.max(0.3, 1 - L('rboss_hp_down')*0.02),   // 라운드 보스(10·20·30) 체력 배율
    rbossDmgMul: 1 + L('rboss_dmg_up')*0.02,                   // 라운드 보스에 주는 피해 배율
    towerMul:    1 + L('tower_power')*0.20,   // 타워 공격력 배율(타워 강화 — 초월 단계가 종결 강화 역할)
    autoUnit:    L('auto_unit')>0,      // 자동화 해금 플래그(인게임 토글로 on/off)
    autoCombine: L('auto_combine')>0,
    autoEnergy:  L('auto_energy')>0,
    autoPboss:   L('auto_pboss')>0,
    autoBossdeploy: L('auto_bossdeploy')>0,
    autoPlace:   L('auto_place')>0,
  };
}
function gainMineral(n){ G.mineral += Math.round(n*((G.metaB&&G.metaB.creditMul)||1)*(1+(G.creditLv||0)*CREDIT_UP_STEP)); }   // 메타 크레딧↑ × 내실 크레딧획득↑(Lv당 +8%)
function gainGas(n){ G.gas += Math.round(n*((G.metaB&&G.metaB.energyMul)||1)); }            // 메타: 에너지 획득↑
function maxUnits(){ return mapCfg('maxUnits',MAX_UNITS) + ((G.metaB&&G.metaB.unitCap)||0); }                  // 메타: 유닛 수 증가
// 게임 종료 정산: 이번 판에서 모은 포인트(G.points)에 난이도 배율을 곱해 계정에 누적·저장(1회만).
// 포인트(◎ = 다음 판 업그레이드 화폐)은 '월드보스(공용 보스)' 처치로만 획득 — coopBossDown()이 G.points에 적립.
   // 이번 판 적립 포인트(월드보스 처치 합) = 정산 대상
// ◎ 포인트 = **유즈맵에서만 나오는 재화**다(사냥터에서는 한 톨도 안 나온다). 그래서 환생 관문의 열쇠가 된다.
//   ⚠ 예전엔 네모 월드보스 처치로만 나와서 획득 경로가 너무 좁았다 → **모든 맵이 판 끝에 성과만큼** 준다.
const UM_POINT_RUN=12;   // 판당 기준 포인트(진행도·난이도로 오르내린다)
function bankRunPoints(){ if(G._pointsBanked) return G._bankedAmt||0; G._pointsBanked=true;
  const cm=umDiffMul();
  const run=Math.round(UM_POINT_RUN * Math.max(UM_PROG_MIN, Math.min(1, umProgress())) * cm);   // 판 성과
  const gained=Math.round((G.points||0)*cm) + run;   // + 월드보스 처치 포인트(네모 전용, 큰 몫)
  if(gained>0){ PLAYER_META.coins=(PLAYER_META.coins||0)+gained; saveMeta(); }
  G._bankedAmt=gained; return gained; }
const DIFF_RANK=['easy','normal','hard','hell','nightmare'];
function diffClearedRank(){ try{ const c=PLAYER_META&&PLAYER_META.clearedDifficulty; return c?DIFF_RANK.indexOf(c):-1; }catch(e){ return -1; } }   // 클리어한 최고 난이도 랭크(-1=없음)
function diffUnlocked(d){ const r=DIFF_RANK.indexOf(d); if(r<=0) return true; return diffClearedRank()>=r-1; }   // 이지=항상 · 그 외=바로 앞 난이도 클리어 시 개방
function infiniteUnlocked(){ try{ return diffClearedRank() >= 1; }catch(e){ return false; } }   // 무한모드 = 노말 클리어 시(하드와 함께) 개방
function recordRunResult(){ try{
    if(typeof PLAYER_META==='undefined' || !PLAYER_META) return;
    const r=G.round||0;
    if(mapCfg('infinite')){ if(r>(PLAYER_META.highestRound||0)){ PLAYER_META.highestRound=r; saveMeta(); } }   // 무한모드: 최고 라운드 기록
    if(G.phase==='won' && !mapCfg('infinite')){   // 캠페인 클리어: 클리어 난이도 갱신(무한 해금 판정용)
      const cur=DIFF_RANK.indexOf(G.difficulty), had=(PLAYER_META.clearedDifficulty?DIFF_RANK.indexOf(PLAYER_META.clearedDifficulty):-1);   // ''=미클리어(-1) → 이지 클리어도 기록
      if(cur>had){ PLAYER_META.clearedDifficulty=G.difficulty; saveMeta(); } }
  }catch(e){} }
// 메타 빌드 레벨업(포인트 차감)
function buildUpgrade(id){ const b=META_BUILDS[id]; if(!b) return false;
  if(b.deferred){ toast('🔒 준비 중인 빌드입니다'); return false; }
  const lv=buildLevel(id); if(lv>=b.max){ toast('⚠️ 최대 레벨입니다'); return false; }
  const cost=metaNextCost(id, lv); if((PLAYER_META.coins||0)<cost){ toast('🪙 포인트 부족 (필요 '+cost+')'); return false; }
  PLAYER_META.coins-=cost; PLAYER_META.buildLevels[id]=lv+1; saveMeta();
  if(typeof G!=='undefined' && G){ G.metaB=metaBonus(); if(typeof updateHud==='function') updateHud(); }   // 즉시 적용(이번 판 효과 재계산) — 시작 자원/유닛 등 시작 한정은 다음 판부터
  if(typeof playSfx==='function') playSfx('ui_confirm'); return true; }

// ── 공학소(인게임 업그레이드 구역 건물) — 영구 강화 리스트. PLAYER_META 데이터, 구매 시 G.metaB 재계산으로 즉시 적용(시작 자원/유닛만 다음 판) ──
let _ptGroup='eco';
const _PT_TABS=[['team','전체'],['eco','경제'],['prod','생산'],['combat','전투'],['coop','보스']];
const _PT_NOTE={
  eco:'미네랄·가스 수급 강화 · 즉시 적용 (시작 자원은 다음 판)',
  prod:'뽑기·시작유닛 + 자동화 해금 · 즉시 적용 (시작 유닛은 다음 판)',
  combat:'아군 화력·공속·적 약화 (초월 단계 = 종결 강화) · 즉시 적용',
  team:'전체 강화 · 협동에서 파티 중 최고 레벨이 모두에게 적용',
  coop:'월드 보스 공략 + 개인 보스 보상·쿨감 강화'
};
// 공학소 선택 → 팝업으로 영구 강화 리스트 표시(하단 구역이 좁아 팝업 사용)
function openPointUpgrade(){ loadMeta(); _ptGroup='eco';
  renderPtTabs(); renderPt();
  popShow('pointPanel'); }
function closePointUpgrade(){ popHide('pointPanel'); }
function setPtGroup(g){ _ptGroup=g; renderPtTabs(); renderPt(); }
// 카테고리 아이콘(메인 하단 네비와 톤 통일 · 24/1.7/currentColor 라인)
const _PT_ICO={
  eco:'<circle cx="12" cy="12" r="8"/><path d="M14.4 9.6a3.3 3.3 0 1 0 0 4.8"/>',                          // 경제=코인
  prod:'<circle cx="9.5" cy="8.5" r="3"/><path d="M4 19.5c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2"/><path d="M18.5 4v5M16 6.5h5"/>',   // 생산=유닛 뽑기(인물+)
  combat:'<path d="M5 5 15 15M19 5 9 15M14.5 15.5 17.5 18.5M9.5 15.5 6.5 18.5"/>',                          // 전투=교차 검
  team:'<rect x="3.8" y="3.8" width="7" height="7" rx="1.6"/><rect x="13.2" y="3.8" width="7" height="7" rx="1.6"/><rect x="3.8" y="13.2" width="7" height="7" rx="1.6"/><rect x="13.2" y="13.2" width="7" height="7" rx="1.6"/>',   // 전체=ALL 텍스트(다른 아이콘 크기에 맞춤)
  coop:'<path d="M12 3.6c-3.9 0-6.9 2.8-6.9 6.5 0 2.2 1 3.9 2.5 4.9v3.4h8.8V15c1.5-1 2.5-2.7 2.5-4.9 0-3.7-3-6.5-6.9-6.5z"/><circle cx="9.4" cy="10.4" r="1.15"/><circle cx="14.6" cy="10.4" r="1.15"/><path d="M10.6 18.4v2M13.4 18.4v2"/>' };  // 보스=해골
// 탭 띠 = 공용 세그먼트 바(segNavHTML). ⛔ 새 탭 띠를 만들지 말 것 — 아이콘 없이 글자만이 이 컴포넌트의 규칙이다.
function renderPtTabs(){ const box=document.getElementById('ptTabs'); if(!box) return;
  const i=Math.max(0, _PT_TABS.findIndex(function(t){ return t[0]===_ptGroup; }));
  box.innerHTML=segNavHTML(_PT_TABS.map(function(t){ return { label:t[1] }; }), i,
    function(k){ return "setPtGroup('"+_PT_TABS[k][0]+"')"; }); }
function renderPt(){ const list=document.getElementById('ptList'); if(!list) return;
  if(TEMP_COIN_TEST) PLAYER_META.coins=9999999;   // [임시] 포인트 항상 넉넉(상점 렌더 시 보충)
  const cE=document.getElementById('ptCoins'); if(cE) cE.textContent=PLAYER_META.coins||0;
  let rows='', _lastSect=null;
  for(const id in META_BUILDS){ const b=META_BUILDS[id]; if(b.group!==_ptGroup) continue;
    if(b.sect && b.sect!==_lastSect){ _lastSect=b.sect; rows+='<div class="ptSect"><span class="ptSectBar"></span>'+b.sect+'</div>'; }   // 섹션 헤더(세분화)
    const lv=buildLevel(id), n=metaNMax(b), maxed=lv>=b.max, cost=metaNextCost(id,lv), deferred=!!b.deferred, poor=(PLAYER_META.coins||0)<cost;
    const nextTrans=!maxed && lv>=n;   // 다음 강화가 초월 레벨
    // 레벨 표기는 강화 버튼 안(비용 아래)으로 — 이름줄 폭을 수치 힌트에 양보
    const lvTxt=(lv>n)?('초월'+(lv-n)):(lv+' / '+b.max);
    let btn;
    if(deferred) btn='<button class="ptBtn" disabled><b>준비중</b></button>';
    else if(maxed) btn='<button class="ptBtn maxed" disabled><b>MAX</b><i class="ptBtnLv">'+lvTxt+'</i></button>';
    else btn='<button class="ptBtn'+(poor?' poor':'')+(nextTrans?' trans':'')+'" onclick="doPtUp(\''+id+'\')"><b>'+cost+'P</b><i class="ptBtnLv'+(lv>n?' trans':'')+'">'+lvTxt+'</i></button>';
    const vh=ptValHint(id,b,lv);   // 수치 변화 힌트(이름 오른쪽)
    rows+='<div class="ptRow'+(deferred?' deferred':'')+(_ptGroup==='team'?' team':'')+'">'
      +'<div class="ptInfo"><div class="ptNameRow"><span class="ptName">'+b.name+'</span>'+(vh?'<span class="ptVal">'+vh+'</span>':'')+'</div>'
      +ptPips(lv,b.max,n)+'</div>'
      +btn+'</div>';
  }
  if(!rows) rows='<div class="ptEmpty">항목 없음</div>';
  list.innerHTML=rows;
}
// 공학소 ? 상세 정보 — 자잘한 설명(정산 방식 + 현재 카테고리 항목별 효과)을 별도 팝업으로 분리.
function openPtHelp(){ const body=document.getElementById('ptHelpBody'); if(!body) return;
  let h='<div class="phGen">판이 끝나면 모은 <b>포인트(P)</b>가 정산되고, 강화하면 <b>이번 판에 즉시 적용</b>됩니다. (시작 자원·유닛은 다음 판부터)</div>';
  const tab=(_PT_TABS.find(t=>t[0]===_ptGroup)||[])[1]||'';
  h+='<div class="phSect">'+tab+(_PT_NOTE[_ptGroup]?' · '+_PT_NOTE[_ptGroup]:'')+'</div>';
  for(const id in META_BUILDS){ const b=META_BUILDS[id]; if(b.group!==_ptGroup) continue;
    h+='<div class="phItem"><b>'+b.name+'</b> — '+b.desc+'</div>'; }
  body.innerHTML=h; popShow('ptHelpPop'); if(typeof playSfx==='function') playSfx('ui_open'); }
function closePtHelp(){ popHide('ptHelpPop'); }
// 항목별 수치 변화 힌트 — 시작 크레딧: 250→275 · 시작 포탑: 포탑 공격력 N · 나머지: 누적 효과(+/%)
function ptValHint(id, b, lv){ const maxed=lv>=b.max;
  if(id==='start_turret'){ const t=(typeof U!=='undefined'&&U.turret)?U.turret:null; return t?('포탑 공격력 '+t.dmg):''; }
  if(b.max===1) return '';   // 토글 해금 = 수치 표기 없음
  const m=b.desc.match(/([+-]?\d+(?:\.\d+)?)(%?)\s*\/\s*Lv/); if(!m) return '';
  const step=parseFloat(m[1]), pct=(m[2]==='%');
  const num=x=>Number.isInteger(x)?(''+x):x.toFixed(1);
  let base=null;
  if(id==='start_credit') base=(typeof mapCfg==='function'?mapCfg('startCredits',START_MIN):250);
  else if(id==='start_energy') base=(typeof mapCfg==='function'?mapCfg('startEnergy',START_GAS):0);
  const cur=lv*step, nxt=(lv+1)*step, ARW='<i class="ptArw">→</i>';   // 화살표=중앙정렬용 별도 span
  if(base!=null){ const cv=base+cur, nv=base+nxt; return maxed?num(cv):(num(cv)+ARW+num(nv)); }
  const sgn=x=>((x>0?'+':'')+num(x)+(pct?'%':''));
  return maxed?sgn(cur):(sgn(cur)+ARW+sgn(nxt)); }
// 레벨 세그먼트 pip — 채워진 칸 시안(초월 단계는 연보라). 칸 많으면(>12) 얇게.
function ptPips(lv, max, n){ const N=Math.max(1,max), norm=(n!=null?n:N);
  let s='<div class="ptPips'+(N>12?' mini':'')+'">';
  for(let i=0;i<N;i++){ const on=i<lv, tr=on&&i>=norm; s+='<i class="'+(tr?'on tr':(on?'on':''))+'"></i>'; }
  return s+'</div>'; }
function doPtUp(id){ if(buildUpgrade(id)) renderPt(); }

// ── 상시 공용 보스(협동/솔로) ──
const BOSS_VIEW={x:0,y:0};    // 보스방 드래그 패닝 오프셋(px)
const BOSS_FEET_FRAC=0.41;    // 보스(건물) 발이 닿는 화면 세로 비율 — 위로(하단 시트 답답함 완화)
// 유닛 이동 가능 구역(이전 값) — 이 영역을 덮도록 타일(플랫폼)을 더 크게 설정
function bossWalkBounds(){ return {lo:0.10, hi:0.90, top:0.31, bot:0.55}; }   // 가로로 넓고 세로로 짧은 이동 범위(포인트방) · 위로
const BOSS_PLATFORM={x:0.05,y:0.21,w:0.90,h:0.40};   // 포인트방 플랫폼 — 가로로 길게 · 위로(이동가능 0.10~0.90 × 0.31~0.55 감쌈)
function coopBossPlayers(){ return (typeof coopActive==='function'&&coopActive()&&G.coopNumToUid)?Math.max(1,Object.keys(G.coopNumToUid).length):1; }
function coopBossMaxHp(lv){
  const diff=(DIFFICULTY[G.difficulty]||DIFFICULTY.normal).bossHp||1;   // 보스 전용 난이도 계수(트랙 enemyHp와 분리 — enemyHp를 낮춰도 보스/포인트 인플레 안 되게)
  const hpDown=Math.max(0.4, 1 - buildLevel('boss_hp_down')*0.015);
  // 월드보스: 단계마다 ×2, 5단계부터 추가 ×2 가속(후반 벽) → 이지·솔로 45k·90k·180k·360k·1.44M·5.76M·23M.
  // 초반 base를 높여(45k) 강한 유닛도 1~4단계를 즉사시키지 못함(월드보스 체감). 봇시뮬: 중간메타 ~4단계·만렙 ~6~8단계 캡.
  // 멀티는 ×players로 확장(인원수만큼 딜도 늘어 1인분 유지).
  const late=Math.pow(2.0, Math.max(0, lv-4));
  return Math.round(45000*diff*coopBossPlayers()*Math.pow(2.0, lv-1)*late*hpDown);
}
// 🏢 포인트방 순차 파괴: 레벨마다 다른 건물(부수면 다음 레벨 = 다음 건물). 관리자 건설 구역 건물들(cb_ 모델 · nemo 전체 로드) 그대로 사용. 전투/멀티는 coopBoss 하나 그대로.
const COIN_BLDG_SEQ=[   // 3종족 건설 건물 순환 — 유니온 → 스웜 → 에테리얼
  'cb_union_command_center','cb_union_barracks','cb_union_engineering_bay','cb_union_academy','cb_union_armory',
  'cb_union_factory','cb_union_starport','cb_union_science_facility','cb_union_bunker','cb_union_missile_turret',
  'cb_swarm_hatchery','cb_swarm_lair','cb_swarm_hive','cb_swarm_spawning_pool','cb_swarm_evolution_chamber',
  'cb_swarm_hydralisk_den','cb_swarm_queens_nest','cb_swarm_ultralisk_cavern','cb_swarm_greater_spire',
  'cb_aetherial_nexus','cb_aetherial_gateway','cb_aetherial_stargate','cb_aetherial_forge','cb_aetherial_cybernetics_core',
  'cb_aetherial_templar_archives','cb_aetherial_robotics_facility','cb_aetherial_fleet_beacon','cb_aetherial_arbiter_tribunal',
];
function coinBldgId(lv){ lv=lv||((G.coopBoss&&G.coopBoss.lv)||1); const n=COIN_BLDG_SEQ.length; return COIN_BLDG_SEQ[((lv-1)%n+n)%n]; }
function coinBldgName(lv){ const id=coinBldgId(lv);   // 건물 한글명 = 건설 트리에서 조회(cb_모델키 ↔ TECH_MODEL 매핑)
  try{ for(const race of ['union','swarm','aetherial']){ const bs=((typeof TECH_TREE!=='undefined'&&TECH_TREE[race])||{}).buildings||[];
    for(const b of bs){ const mk=(typeof TECH_MODEL!=='undefined'&&(TECH_MODEL[race]||{})[b.k]); if(mk&&('cb_'+mk)===id) return b.name; } } }catch(_e){}
  return '포인트 시설'; }
function makeCoopBoss(lv){ const max=coopBossMaxHp(lv);
  return { lv:lv, hp:max, max:max, dead:false, name:coinBldgName(lv) }; }   // 포인트방 = 현 레벨 건물(부수면 다음 건물)
function spawnCoopBoss(lv){ G.coopBoss=makeCoopBoss(lv); updateCoopBossBar(); }
// 적에게 데미지를 줄 때 공용 보스 체력 차감(기여도 시스템 제거)
// ⚠ 공격 1회마다 보내면 안 된다 — 유닛 평균 공격속도가 초당 2.02회라 파견 10기면 초당 20건이 넘고,
//   이건 전장 스냅(10Hz)과 **별도로** 나간다. 누적해서 COOP_BOSSDMG_MS 마다 한 번만 보낸다.
//   보스 HP 는 어차피 권위자(coopAuthNum)가 pstate 의 bs 로 수렴시키므로 정밀도 손해가 없다.
const COOP_BOSSDMG_MS=150;
let _bdAcc=0, _bdNum=0, _bdLast=0;
function coopBossDmgFlush(){
  if(_bdAcc>0 && typeof coopActive==='function' && coopActive()) coopSend('bossdmg',{ amt:_bdAcc, num:_bdNum });
  _bdAcc=0; _bdLast=Date.now(); }
function coopBossDamage(amt, num, remote){ const cb=G.coopBoss; if(!cb||cb.dead) return;
  cb.hp=Math.max(0, cb.hp-amt);
  if(!remote && typeof coopActive==='function' && coopActive()){
    _bdAcc+=amt; _bdNum=num;
    if(Date.now()-_bdLast>=COOP_BOSSDMG_MS) coopBossDmgFlush(); }   // 첫 타는 _bdLast=0 이라 즉시 나간다
  if(cb.hp<=0){ coopBossDmgFlush(); coopBossDown(); }               // 처치 순간은 남은 누적을 즉시 보낸다
  updateCoopBossBar(); }
function coopBossDown(){ const cb=G.coopBoss; if(!cb||cb.dead) return; cb.dead=true;
  const rewardMul=1+buildLevel('boss_reward_up')*0.1;
  const pts=Math.max(1, Math.round(cb.lv*rewardMul));   // n번째 보스 = nP (포인트의 유일한 수입원)
  G.points += pts;   // 게임 종료 시 정산되는 포인트에 합산
  if(typeof playSfx==='function') playSfx('win');
  addChat('', '👹 월드 보스 ['+cb.name+'] 처치! +'+pts+' 🪙', '#ff8a9a', true);
  const nextLv=cb.lv+1;
  if(G._coopBossT) clearTimeout(G._coopBossT);
  G._coopBossT=setTimeout(()=>{ if(G.phase==='playing'){ spawnCoopBoss(nextLv); if(typeof playSfxT==='function') playSfxT('boss',1500); } }, 2500);   // 상시: 더 강한 보스 재등장 + 등장음
  updateCoopBossBar(); }
function updateCoopBossBar(){ const bar=document.getElementById('coopBossBar'); if(!bar) return;
  const cb=G.coopBoss; const bldHp=document.getElementById('bossBldHp');
  if(G.bossOpen){   // 🏢 포인트방: 상단 보스바 대신 건물 아래 HP바(기존 .bldHp 재사용)
    bar.classList.add('hide');
    const show=(cb && !cb.dead && G.phase==='playing');
    if(bldHp){ bldHp.style.display=show?'block':'none';
      if(show){ const hpR=Math.max(0,Math.min(1,cb.hp/cb.max));   // 건설 구역 건물 바(.bentBar + _barsHTML) 그대로 재사용 — 포인트방 건물은 HP만(쉴드·마나 없음)
        let fill=bldHp.querySelector('.uH i'); if(!fill){ bldHp.innerHTML=_barsHTML({ hpR:hpR, hpCol:hpBarColor(hpR), shR:null, enR:null }); fill=bldHp.querySelector('.uH i'); }
        if(fill){ fill.style.width=(hpR*100)+'%'; fill.style.background=hpBarColor(hpR); }
        bldHp.style.left='50%'; bldHp.style.top=(BOSS_FEET_FRAC*100+8).toFixed(1)+'%'; bldHp.style.width='40%'; } }   // 건물 발밑보다 더 아래
    return; }
  if(bldHp) bldHp.style.display='none';
  const show=(cb && !cb.dead && G.tab==='Main' && G.phase==='playing');
  bar.classList.toggle('hide', !show); if(!show) return;
  const pct=Math.max(0, cb.hp/cb.max*100);
  const fill=document.getElementById('cbFill'); if(fill) fill.style.width=pct+'%';
  const nm=document.getElementById('cbName'); if(nm) nm.textContent=cb.name;
  const hp=document.getElementById('cbHp'); if(hp) hp.textContent=Math.ceil(cb.hp).toLocaleString()+' / '+cb.max.toLocaleString();
}
// ── 보스방 파견 (최대 2기, 지정 유닛만) ──
const BOSS_DEPLOY_CAP=2;
function bossDeployedCount(){ return G.units.filter(u=>u.atBoss).length; }
function updateBossPickBtn(){ const b=document.getElementById('bossPickBtn'); if(!b) return;
  const full=bossDeployedCount()>=BOSS_DEPLOY_CAP;
  b.classList.toggle('on', !!G.bossPickArm && !full);
  b.disabled=full; b.classList.toggle('bdFull', full);
  const lab=b.querySelector('.bdLabel'); if(lab) lab.textContent = full ? '가득참' : '파견'; }
// 특정 유닛 1기를 보스방에 파견
function deployUnitToBoss(u){ if(!u||u.fixed||u.atBoss) return false;
  if(bossDeployedCount()>=BOSS_DEPLOY_CAP){ toast('⚠️ 보스방 파견은 최대 '+BOSS_DEPLOY_CAP+'기입니다'); return false; }
  u.atBoss=true; u.bcd=0; u.moving=false; u.cmd='hold'; u.patrol=null; u.atkTarget=null; u.focusTarget=null; u.moveTo=null;   // 트랙 상태 초기화
  G.sel=(G.sel||[]).filter(id=>id!==u.uid);   // 메인 선택에서 제외
  const k=bossDeployedCount();   // 이미 파견된 수(이번 포함) → 초기 진형 슬롯
  const sp=bossDeploySpot(G.myPlayer||1, k-1);   // 플레이어별 시계방향 슬롯(서로 안 겹침)
  u.bx=sp.x; u.by=sp.y; u.btx=null; u.bty=null;   // 아레나 좌표(플랫폼 내, 직접 이동 가능)
  if(typeof playSfx==='function') playSfx('place_unit');
  toast('✓ 보스방 파견 ('+k+'/'+BOSS_DEPLOY_CAP+')'); renderBossPanel(); return true; }
// 플레이어별 파견 진입 위치 — 보스 중심 시계방향 8슬롯(P1=정면 아래, 번호 순서대로 45°씩), 플레이어끼리 안 겹침
function bossDeploySpot(num, idx){ const B=bossWalkBounds();
  const cx=0.5, cy=(B.top+B.bot)/2+0.03, rx=0.26, ry=0.15;
  const ang=Math.PI/2 + (((num||1)-1)%8)*(Math.PI/4);
  const a=ang + (idx-(BOSS_DEPLOY_CAP-1)/2)*0.34;   // 같은 플레이어 유닛은 슬롯 주변에 살짝 벌림
  return { x:Math.max(B.lo,Math.min(B.hi, cx+Math.cos(a)*rx)),
           y:Math.max(B.top,Math.min(B.bot, cy+Math.sin(a)*ry)) };
}
// 아레나 내 유닛 좌표(직접 이동값 우선, 없으면 진형)
function bossUnitXY(u,i,n){ return (u.bx!=null)?{x:u.bx,y:u.by}:bossUnitPos(i,n); }
// 토벌장에 표시할 전체 유닛 = 내 파견 + 다른 플레이어 파견(협동, 10Hz 스냅을 보간해 부드럽게)
function bossArenaUnits(){ const mine=G.units.filter(u=>u.atBoss);
  if(!G.coopBossU) return mine;
  const out=mine.slice(), now=Date.now(), me=G.myPlayer||1;
  for(const k in G.coopBossU){ if(+k===me) continue;
    const sn=G.coopBossU[k]; if(!sn||!sn.cur||!sn.cur.length) continue;
    if(now-sn.t>3000) continue;   // 오래된 스냅(이탈/연결 끊김)은 표시 안 함
    const f=Math.max(0,Math.min(1,(now-sn.t)/110));   // 10Hz 스냅 선형 보간
    const pm={}; (sn.prev||[]).forEach(u=>{ pm[u.uid]=u; });
    sn.cur.forEach(u=>{ const q=pm[u.uid];
      out.push(q?Object.assign({},u,{bx:q.bx+(u.bx-q.bx)*f, by:q.by+(u.by-q.by)*f}):u); });
  }
  return out; }
function recallFromBoss(n){ const sent=G.units.filter(u=>u.atBoss);
  const cnt=(n==='all')?sent.length:Math.min(n,sent.length);
  for(let i=0;i<cnt;i++){ sent[i].atBoss=false; if(typeof _baSel!=='undefined') _baSel=_baSel.filter(id=>id!==sent[i].uid); }
  if(cnt>0 && typeof playSfx==='function') playSfx('ui_close');
  renderBossPanel(); }
function renderBossPanel(){ const s=document.getElementById('bdSent'), t=document.getElementById('bdTotal');
  if(s) s.textContent=bossDeployedCount(); if(t) t.textContent=BOSS_DEPLOY_CAP;
  if(typeof updateBossPickBtn==='function') updateBossPickBtn();
  if(typeof updateDeselTop==='function') updateDeselTop(); }
// ── 유닛 판매 (등급 선택 → 초상화 클릭 = 1마리씩 판매) ──
const SELL_VALUE={ common:15, rare:50, epic:130, unique:320, legend:850, transcend:2800 };   // 초월 추가(없으면 기본20에 헐값 판매됨). 갓=판매불가
const NO_SELL_TIERS=new Set(['god']);   // 갓만 판매 불가(초월은 판매·조합 가능)
function unitSellValue(u){ const base=(u&&u.gtier&&mapCfg('sellValue',SELL_VALUE)[u.gtier])||20;
  const ret=1+(buildLevel('sell_return')*0.05); return Math.round(base*ret); }
function sellUnit(u){ if(!u||u.fixed) return false;
  if((function(v){return v.has?v.has(u.gtier):v.includes(u.gtier)})(mapCfg('noSellTiers',NO_SELL_TIERS))){ toast('⚠️ 갓 등급은 판매할 수 없습니다'); return false; }
  if(u.atBoss){ toast('⚠️ 보스방 파견 유닛은 회수 후 판매하세요'); return false; }
  const val=unitSellValue(u); G.mineral+=val;
  const i=G.units.indexOf(u); if(i>=0) G.units.splice(i,1);
  if(window.M3D && M3D.dropModels) M3D.dropModels([u.uid]);
  G.sel=(G.sel||[]).filter(id=>id!==u.uid);
  if(typeof playSfx==='function') playSfx('ui_confirm');
  toast('💰 판매 +'+val+' M'); renderUnits(); updateHud(); return true; }
let _sellTier=null, _sellSig='';
// ── 유닛 조합(전 범위 — 합체존/버튼 제거): 하단 [판매|조합] 토글 패널 ──
let _homeMode='select', _combTier=null, _combSig=''; let _selTierH=null, _selSig='', _selViaTab=false;
const LEGEND_TO_TRANSCEND={};   // 3-같은 레시피 역매핑(machinegun_l→phantom_t 등)
for(const _res in TRANSCEND_RECIPE){ const _m=TRANSCEND_RECIPE[_res]; if(_m.length===3 && _m[0]===_m[1] && _m[1]===_m[2]) LEGEND_TO_TRANSCEND[_m[0]]=_res; }
function combineResultFor(gid,gtier){ const nt=SIMPLE_COMBINE_TIERS[gtier]; if(nt) return {type:'simple', nextTier:nt};
  if(LEGEND_TO_TRANSCEND[gid]) return {type:'transcend', id:LEGEND_TO_TRANSCEND[gid]}; return null; }   // 전부 단순 3개 조합(갓=최종=null) · 레시피 폐지(LEGEND_TO_TRANSCEND 빈 맵)
function ownedCombineGroups(){ const grp={};   // gid별 묶음(고정·파견 제외) — 3개 이상 & 조합 결과 있는 것만
  for(const u of G.units){ if(u.fixed||u.atBoss||!u.gid) continue; (grp[u.gid]=grp[u.gid]||[]).push(u); }
  const out={}; for(const gid in grp){ if(grp[gid].length>=3 && combineResultFor(gid, grp[gid][0].gtier)) out[gid]=grp[gid]; } return out; }
function setHomeMode(m){ if(m==='boss') m='select'; _homeMode=m; _sellSig=''; _combSig=''; _selSig='';
  if(typeof gtabPaint==='function') gtabPaint();   // 하단 네비의 .cur 이동(판 안에 탭 줄은 없다)
  renderHomeLeft(); }
function renderHomeLeft(){ if(_homeMode==='select') renderSelectPanel(); else if(_homeMode==='combine') renderCombinePanel(); else renderSellPanel(); updateCombDot(); }
// 조합 가능 여부가 바뀌면 하단 네비의 '유닛 조합' 칸이 생기거나 사라진다(GTAB_TREE.Main.subs[].show)
// 조합 칸은 늘 있으므로 여기서 쫓아내지 않는다 — 조합할 게 없으면 판이 '같은 유닛 3개 필요'라고 알린다.
function updateCombDot(){}
function setCombTier(t){ _combTier=t; _combSig=''; renderCombinePanel(); }
function combineOneOfType(gid, quiet){
  const list=G.units.filter(u=>u.gid===gid && !u.fixed && !u.atBoss); if(list.length<3) return;
  const res=combineResultFor(gid, list[0].gtier); if(!res) return;
  const pick=list.slice(0,3), con=new Set(pick.map(x=>x.uid));
  const cx=pick.reduce((a,u)=>a+u.x,0)/3, cy=pick.reduce((a,u)=>a+u.y,0)/3;   // 합쳐진 자리(무게중심) — 재배치 불필요
  _consumeUnits(con);
  let outId; if(res.type==='transcend') outId=res.id;
  else { const pool=gachaUnitsOfTier(res.nextTier); outId=pool[Math.floor(Math.random()*pool.length)].id; }
  spawnGachaUnit(outId, cx, cy); const tg=GACHA_UNITS[outId];
  if(!quiet){ toast((res.type==='transcend'?'✦ ':'⭐ ')+tg.displayName+' '+GACHA_TIERS[tg.tier].name+(res.type==='transcend'?' 강림!':' 진화!'));
    if(typeof playSfx==='function') playSfx('hero_merge'); }
  _combSig=''; _sellSig=''; refreshSelCard(); renderUnits(); updateHud(); renderHomeLeft(); }
function renderCombinePanel(){ const tiersBox=document.getElementById('hsTiers'), grid=document.getElementById('hsGrid'); if(!tiersBox||!grid) return;
  const groups=ownedCombineGroups(), gids=Object.keys(groups);
  const tierSet=GACHA_TIER_ORDER.filter(t=>gids.some(g=>groups[g][0].gtier===t));
  if(!tierSet.length){ if(_combSig!=='∅'){ tiersBox.innerHTML=''; grid.innerHTML='<div class="hsEmpty">조합할 유닛이 없습니다 (같은 유닛 3개 필요)</div>'; _combSig='∅'; } _combTier=null; return; }
  if(!_combTier || tierSet.indexOf(_combTier)<0) _combTier=tierSet[0];
  const sig=_combTier+'|'+gids.map(g=>groups[g][0].gtier+':'+g+':'+groups[g].length).sort().join(',');
  if(sig===_combSig) return; _combSig=sig;
  tiersBox.innerHTML=tierSegHTML(tierSet, _combTier, 'setCombTier');
  let cells='';
  for(const gid of gids){ const list=groups[gid]; if(list[0].gtier!==_combTier) continue; const gu=GACHA_UNITS[gid]; if(!gu) continue;
    const res=combineResultFor(gid, list[0].gtier);
    const to=(res.type==='transcend')?'transcend':res.nextTier;   // 초월도 등급표에 있으므로 키 그대로 넘긴다
    const rtName=GACHA_TIERS[to]?GACHA_TIERS[to].name:to;
    cells+=_hsCardHTML(gid, gu.displayName, "combineOneOfType('"+gid+"')",
      gu.displayName+' ×3 → '+rtName, list.length, [_hsUpRow(list[0].gtier, to)]);
  }
  grid.innerHTML=cells;
}
// ── 🃏 유닛 카드 한 장 — 지정·판매·조합이 **같은 마크업**을 쓴다(칸을 세 번 만들지 말 것) ──
// 수량(×N)은 초상 좌상단 뱃지(.hsCnt)다. 초상 아래로는 [이름] + rows: 지정=[] · 판매=[가격] · 조합=[등급 화살표]
function _hsThumbHTML(gid){ const pk=GACHA_MODEL[gid]||GACHA_PROXY[gid], img=PORTRAIT_IMG[pk];
  return '<div class="hsThumb">'+(img?('<img src="'+img+'" draggable="false">')
    :(typeof unitSVG==='function'?unitSVG(GACHA_PROXY[gid]||'marine'):''))+'</div>'; }
function _hsCardHTML(gid, name, act, title, qty, rows){
  return '<button class="hsCell" onclick="'+act+'" title="'+escHtml(title)+'">'+_hsThumbHTML(gid)
    +'<span class="hsCnt">×'+qty+'</span>'
    +'<div class="hsInfo"><span class="hsName">'+escHtml(name)+'</span>'+(rows||[]).join('')+'</div></button>'; }
function _hsPrice(v){ return '<span class="hsVal">'+resIco('mineral','riSm')+'+'+v+'</span>'; }
// 조합 결과 = "현재등급 → 다음등급". 등급색은 공용 TIER_COLOR 를 인라인 변수로만 받는다.
function _hsUpRow(from, to){
  return '<span class="hsUp" style="--cf:'+(TIER_COLOR[from]||'#fff')+'"><i>'+GACHA_TIERS[from].name+'</i>'
    +'<em>›</em><b style="color:'+(TIER_COLOR[to]||'#fff')+'">'+(GACHA_TIERS[to]?GACHA_TIERS[to].name:to)+'</b></span>'; }
function selectByGid(gid){ if(G.bossDeployPick){ bossDeployOne(gid); return; }   // 🎯 파견 선택 모드: 카드 탭 = 그 종류 1기만 파견(지정 안 함)
  _selViaTab=true; const ids=G.units.filter(u=>!u.fixed&&!u.atBoss&&u.gid===gid).map(u=>u.uid);
  if(ids.length){ G.sel=capSelTypes(ids,true); G.selEnemy=null; refreshSelCard(); } }   // 프로필 클릭 → 그 종류 전부 지정(30 제한 없음)
function setSelTier(t){ if(G.bossDeployPick){ _selTierH=t; _selSig=''; renderSelectPanel(); return; }   // 파견 모드: 등급 탭 = 표시 등급만 전환(지정 안 함)
  _selViaTab=true; _selTierH=t; _selSig=''; selectAllOfTier(t); }   // 등급 탭 → 그 등급 전체 지정 + 종류 표시(refreshSelCard가 패널 갱신)
function renderSelectPanel(){ const tiersBox=document.getElementById('hsTiers'), grid=document.getElementById('hsGrid'); if(!tiersBox||!grid) return;
  const live=G.units.filter(u=>!u.fixed&&!u.atBoss&&u.gid);
  const byTier={}; for(const u of live){ (byTier[u.gtier]=byTier[u.gtier]||[]).push(u); }
  const tierSet=GACHA_TIER_ORDER.filter(t=>byTier[t]);
  if(!tierSet.length){ if(_selSig!=='∅'){ tiersBox.innerHTML=''; grid.innerHTML='<div class="hsEmpty">지정할 유닛이 없습니다</div>'; _selSig='∅'; } _selTierH=null; return; }
  if(!_selTierH || tierSet.indexOf(_selTierH)<0) _selTierH=tierSet[0];
  const byGid={}; for(const u of byTier[_selTierH]){ (byGid[u.gid]=byGid[u.gid]||[]).push(u); }
  const sig=_selTierH+'|'+live.map(u=>u.gtier+':'+u.gid).sort().join(',');
  if(sig===_selSig) return; _selSig=sig;
  tiersBox.innerHTML=tierSegHTML(tierSet, _selTierH, 'setSelTier');
  let cells='';
  const _go=Object.keys(byGid).sort((a,b)=>byGid[b].length-byGid[a].length);   // 마릿수 많은 순(왼쪽부터)
  for(const gid of _go){ const list=byGid[gid], gu=GACHA_UNITS[gid]; if(!gu) continue;
    cells+=_hsCardHTML(gid, gu.displayName, "selectByGid('"+gid+"')",
      gu.displayName+' '+list.length+'기 지정', list.length, []);
  }
  grid.innerHTML=cells;
}
function ownedSellUnits(){ return G.units.filter(u=>!u.fixed && !u.atBoss && u.gid && !(function(v){return v.has?v.has(u.gtier):v.includes(u.gtier)})(mapCfg('noSellTiers',NO_SELL_TIERS))); }
function setSellTier(t){ _sellTier=t; _sellSig=''; renderSellPanel(); }
function sellOneOfType(gid){ const u=G.units.find(x=>x.gid===gid && !x.fixed && !x.atBoss); if(u) sellUnit(u); _sellSig=''; renderSellPanel(); }
function renderSellPanel(){ const tiersBox=document.getElementById('hsTiers'), grid=document.getElementById('hsGrid'); if(!tiersBox||!grid) return;
  const owned=ownedSellUnits();
  const tierSet=GACHA_TIER_ORDER.filter(t=>owned.some(u=>u.gtier===t));
  if(!tierSet.length){ if(_sellSig!=='∅'){ tiersBox.innerHTML=''; grid.innerHTML='<div class="hsEmpty">판매할 유닛이 없습니다</div>'; _sellSig='∅'; } _sellTier=null; return; }
  if(!_sellTier || tierSet.indexOf(_sellTier)<0) _sellTier=tierSet[0];
  const sig=_sellTier+'|'+owned.map(u=>u.gtier+':'+u.gid).sort().join(',');   // 구성 변화 시에만 재렌더(클릭 끊김 방지)
  if(sig===_sellSig) return; _sellSig=sig;
  tiersBox.innerHTML=tierSegHTML(tierSet, _sellTier, 'setSellTier');
  const byGid={}; for(const u of owned){ if(u.gtier!==_sellTier) continue; (byGid[u.gid]=byGid[u.gid]||[]).push(u); }
  let cells='';
  const _go=Object.keys(byGid).sort((a,b)=>byGid[b].length-byGid[a].length);   // 마릿수 많은 순(왼쪽부터)
  for(const gid of _go){ const list=byGid[gid], gu=GACHA_UNITS[gid]; if(!gu) continue;
    const val=unitSellValue(list[0]);
    cells+=_hsCardHTML(gid, gu.displayName, "sellOneOfType('"+gid+"')",
      gu.displayName+' 판매 +'+val, list.length, [_hsPrice(val)]);
  }
  grid.innerHTML=cells;
}
// 파견 유닛 진형 좌표(정규화) — 보스 앞쪽 바닥에 줄지어 섬. drawBoss·M3D.syncBoss 공용
function bossUnitPos(i,n){ const PER=7; const rows=Math.max(1,Math.ceil(n/PER)); const row=Math.floor(i/PER);
  const inRow=Math.min(PER,n-row*PER), idx=i-row*PER;
  const spanX=Math.min(0.46, 0.07*Math.max(1,inRow-1)+0.05);
  const x=0.5 + (inRow===1?0:((idx/(inRow-1))-0.5))*spanX;
  const gap=Math.min(0.05, 0.1/rows); const y=0.50 + row*gap;
  return {x,y}; }
// 보스 구역 바닥 — 화산: 바깥은 화산암(badlands), 보스가 서는 중앙은 용암(ash+발광)
function drawBossFloor(ctx,ox,oy,bw,bh,t,fy){
  const R=16, lw=Math.max(9,Math.min(bw,bh)*0.05), Ri=Math.max(4,R-lw*0.5);
  // 안쪽 = 지형 바닥(메인 맵 톤) + 은은한 금색 중앙 발광(포인트방 분위기)
  ctx.save(); ctx.beginPath(); rRpath(ctx,ox,oy,bw,bh,R); ctx.clip();
  ctx.fillStyle=mkPat(ctx,TILE_BAD,BAD_TILE)||'#241410'; ctx.fillRect(ox,oy,bw,bh);
  const gg=ctx.createRadialGradient(ox+bw/2,oy+bh*0.52,4,ox+bw/2,oy+bh*0.52,Math.max(bw,bh)*0.45);
  gg.addColorStop(0,'rgba(255,205,80,.13)'); gg.addColorStop(1,'rgba(255,205,80,0)');
  ctx.fillStyle=gg; ctx.fillRect(ox,oy,bw,bh); ctx.restore();
  // 테두리 = 어두운 절벽(ash) + 그림자
  ctx.save(); ctx.beginPath(); rRpath(ctx,ox,oy,bw,bh,R); rRpath(ctx,ox+lw,oy+lw,bw-2*lw,bh-2*lw,Ri); ctx.clip('evenodd');
  ctx.fillStyle=mkPat(ctx,TILE_ASH,ASH_TILE)||'#1a0a06'; ctx.fillRect(ox,oy,bw,bh);
  ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(ox,oy,bw,bh); ctx.restore();
  ctx.save(); ctx.beginPath(); rRpath(ctx,ox+lw,oy+lw,bw-2*lw,bh-2*lw,Ri); ctx.lineWidth=lw*0.4; ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.stroke(); ctx.restore();
  // 🪙 포인트방 = 금색 발광 테두리(안쪽 밝은 림 + 바깥 은은한 금색)
  ctx.save(); ctx.beginPath(); rRpath(ctx,ox+lw*0.5,oy+lw*0.5,bw-lw,bh-lw,Ri); ctx.lineWidth=1.5; ctx.strokeStyle='rgba(255,216,104,.6)'; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.beginPath(); rRpath(ctx,ox,oy,bw,bh,R); ctx.lineWidth=2.5; ctx.strokeStyle='rgba(255,198,70,.4)'; ctx.stroke(); ctx.restore();
}
let BAW=0,BAH=0;   // 토벌장 캔버스 크기(메인 GW/GH와 분리 — 두 화면 좌표계 독립)
// 🪙 포인트방 분위기 입자(맵 주변 우주에 느리게 떠오르는 금빛) — 결정적 분포(프레임마다 재랜덤 없음)
const COIN_MOTES=(function(){ const a=[]; for(let k=0;k<16;k++){ const f=n=>((k+1)*n)%1;
  a.push({ x:0.03+0.94*f(0.3701), y:f(0.2903), rise:0.006+0.006*f(0.531), sp:0.25+0.45*f(0.191), tw:0.7+1.3*f(0.413), ph:k*0.77, r:0.7+1.5*f(0.611) }); } return a; })();
function drawCoinMotes(ctx,W,H,t){ ctx.save(); ctx.globalCompositeOperation='lighter';
  for(let k=0;k<COIN_MOTES.length;k++){ const mo=COIN_MOTES[k];
    const mx=(mo.x + Math.sin(t*mo.sp+mo.ph)*0.018)*W, my=((mo.y + (t*mo.rise))%1)*H;
    const a=0.06+0.06*(0.5+0.5*Math.sin(t*mo.tw+mo.ph));
    ctx.fillStyle='rgba(255,206,96,'+a.toFixed(3)+')'; ctx.beginPath(); ctx.arc(mx,my,mo.r,0,6.283); ctx.fill(); }
  ctx.restore(); }
function drawBoss(dt){ const {ctx,W,H}=setup('cvBoss'); BAW=W;BAH=H; dt=dt||0;
  const t=(G.timeSec||0), MN=Math.min(W,H);
  // ── 우주 배경(메인 맵과 동일) ──
  if(TILE_SPACE.complete && TILE_SPACE.naturalWidth){ ctx.fillStyle=mkPat(ctx,TILE_SPACE,SPACE_TILE)||'#05060d'; ctx.fillRect(0,0,W,H); }
  else bg(ctx,W,H,'#0b0612','#04030a');
  spaceVignette(ctx,W,H);
  drawCoinMotes(ctx,W,H,t);   // 🪙 맵 주변 금빛 입자(플랫폼이 중앙을 덮음 → 주변만 보임)
  // ── 보스 구역 플랫폼(타일=유닛 이동 범위와 동일 좌표) ──
  const ox=W*BOSS_PLATFORM.x, oy=H*BOSS_PLATFORM.y, bw=W*BOSS_PLATFORM.w, bh=H*BOSS_PLATFORM.h;
  const cx=W*0.5, fy=H*BOSS_FEET_FRAC, br=MN*0.08, by=fy-MN*0.1;
  drawBossFloor(ctx,ox,oy,bw,bh,t,fy);
  const cb=G.coopBoss;
  if(cb && !cb.dead){
    // 건물 발 그림자만(붉은 용암 후광 제거) — 3D 모델은 cvMarine로 이 위에 렌더
    ctx.fillStyle='rgba(0,0,0,.34)'; ctx.beginPath(); ctx.ellipse(cx,fy+4,br*0.95,br*0.3,0,0,6.283); ctx.fill();
    // ── 파견 유닛: 발 그림자(모션은 3D, 공격 이펙트는 withBossFx의 전용 배열) ──
    const sent=bossArenaUnits(); const n=sent.length;   // 발 그림자는 3D 공통 그림자가 담당 — 여기선 원격 닉네임만
    if(n){ for(let i=0;i<n;i++){ const p=bossUnitXY(sent[i],i,n); const ux=p.x*W, uy=p.y*H;
        if(sent[i].remote){   // 다른 플레이어 유닛: 발밑에 플레이어색 닉네임
          const pn=sent[i].pnum||2, pc=(typeof PLAYER_VIEW_COLORS!=='undefined')?PLAYER_VIEW_COLORS[(pn-1)%PLAYER_VIEW_COLORS.length]:'#7fc8ff';
          ctx.fillStyle=pc; ctx.font='600 9px sans-serif'; ctx.textAlign='center';
          ctx.fillText((G.playerNames&&G.playerNames[pn])||('P'+pn), ux, uy+14); } }
    }
  } else {
    ctx.fillStyle='rgba(220,210,210,.82)'; ctx.font='700 14px '+FONT_NUM; ctx.textAlign='center';
    ctx.fillText('보스 처치! 곧 더 강한 보스가 등장합니다…', cx, fy);
  }
  ctx.textAlign='left';
}
document.addEventListener('pointerdown', function(ev){ const m=document.getElementById('msScopeMenu'); if(!m||m.classList.contains('hide'))return; if(ev.target.closest&&ev.target.closest('#msScopeDD'))return; if(typeof _msScopeClose==='function') _msScopeClose(); }, true);   // 로비 채팅 범위 팝다운 바깥 클릭 닫기
document.addEventListener('pointerdown', function(ev){ const m=document.getElementById('lbMenu'); if(!m||m.classList.contains('hide'))return; if(ev.target.closest&&(ev.target.closest('#lbMenu')||ev.target.closest('.lbSlot.tapmenu')))return; if(typeof _lbMenuClose==='function') _lbMenuClose(); }, true);   // 대기실 슬롯 메뉴 바깥 클릭 닫기
function updateBossViewBtn(){ const b=document.getElementById('bossViewBtn'); if(b){ b.textContent=G.bossOpen?'메인':'보스방'; b.classList.toggle('viewing', !!G.bossOpen); } }
// ── 토벌장 전용 이펙트 저장소 — 메인 트랙 이펙트와 완전 분리(두 화면이 서로 영향 없음) ──
const _FX_KEYS=['shots','impacts','muzzles','sparks','beams','debris'];
function _baFxStore(){ if(!G.baFx) G.baFx={shots:[],impacts:[],muzzles:[],sparks:[],beams:[],debris:[]}; return G.baFx; }
// fn 실행 동안 G.shots 등 이펙트 배열을 토벌장 전용으로 바꿔치기 → fireAttack/drawFx/advanceFx를 그대로 재사용
function withBossFx(fn){ const st=_baFxStore(), sv={};
  _FX_KEYS.forEach(k=>{ sv[k]=G[k]; G[k]=st[k]; });
  G._baFire=true;   // 토벌장 발사 컨텍스트: fire 함수들의 트랙 적 자동 탐색 금지
  try{ fn(); } finally{ G._baFire=false; _FX_KEYS.forEach(k=>{ st[k]=G[k]; G[k]=sv[k]; }); } }
function _clearFxArrays(){ const st=_baFxStore(); _FX_KEYS.forEach(k=>{ st[k].length=0; }); }   // 토벌장 전용만 클리어(메인 이펙트 보존)
function openBossArena(){ if(!G.coopBoss) return; BOSS_VIEW.x=0; BOSS_VIEW.y=0; G.bossOpen=true; _clearFxArrays();
  if(window.M3D && M3D.cstEnsure){ try{ M3D.cstEnsure(COIN_BLDG_SEQ.map(id=>id.slice(3))); }catch(_e){} }   // 🏢 건설 건물 SCALE 정규화(cfg.s) 확정 — 모델은 이미 로드됨(nemo 전체 로드)이라 즉시
  const vb=document.getElementById('vBoss'); if(vb) vb.classList.add('on');   // 아레나 캔버스 활성
  const bp=document.getElementById('bossPanel'); if(bp) bp.classList.remove('hide');
  const bar=document.getElementById('coopBossBar'); if(bar) bar.classList.add('bossMode');   // 화면 중앙 상단 보스 체력바
  if(typeof refreshSelCard==='function') refreshSelCard();   // 하단 = 보스방 4그리드로 즉시 전환
  updateBossViewBtn(); if(typeof playSfx==='function') playSfx('ui_open'); }
function closeBossArena(){ G.bossOpen=false; G.bossDeployPick=false; G.bossBldSel=false; G.sel=[]; if(typeof _baSel!=='undefined') _baSel=[]; _clearFxArrays();
  const vb=document.getElementById('vBoss'); if(vb && G.tab!=='Boss') vb.classList.remove('on');
  const bp=document.getElementById('bossPanel'); if(bp) bp.classList.add('hide');
  const bar=document.getElementById('coopBossBar'); if(bar) bar.classList.remove('bossMode');
  if(typeof refreshSelCard==='function') refreshSelCard();   // 하단 = 트랙 홈(지정/판매/조합)으로 복원
  updateBossViewBtn(); if(typeof playSfx==='function') playSfx('ui_close'); }
// ── 토벌장 유닛 컨트롤(메인 맵과 동일: 클릭 선택 / 드래그 박스 선택 / 이동 / 해제) ──
let _baSel=[];                       // 선택된 파견 유닛 uid
let _ba={box:null,cmd:null,dragU:null,moved:false};
function bossArenaPoint(e){ const v=document.getElementById('vBoss').getBoundingClientRect(); const t=(e.touches&&e.touches[0])||e;
  return {x:(t.clientX-v.left)/v.width, y:(t.clientY-v.top)/v.height}; }
function bossUnitUnder(p){ let best=Infinity,hit=null; for(const u of G.units){ if(!u.atBoss||u.bx==null) continue;
  const d=Math.hypot((u.bx-p.x)*(BAW||GW),(u.by-p.y)*(BAH||GH)); if(d<30 && d<best){ best=d; hit=u; } } return hit; }
function bossAssignMove(p){ const sel=_baSel.map(id=>G.units.find(u=>u.uid===id&&u.atBoss)).filter(Boolean); const n=sel.length; if(!n) return;
  const B=bossWalkBounds(); const tx=Math.max(B.lo,Math.min(B.hi,p.x)), ty=Math.max(B.top,Math.min(B.bot,p.y));
  sel.forEach(function(u,i){ const off=(n>1?(i-(n-1)/2)*0.09:0); u.btx=Math.max(B.lo,Math.min(B.hi,tx+off)); u.bty=ty; }); }
function drawBossBox(){ let el=document.getElementById('bossSelBox'); const host=document.getElementById('bossPanel'); if(!host) return;
  if(!el){ el=document.createElement('div'); el.id='bossSelBox'; host.appendChild(el); }
  const b=_ba.box, x=Math.min(b.x0,b.x1),y=Math.min(b.y0,b.y1),w=Math.abs(b.x1-b.x0),h=Math.abs(b.y1-b.y0);
  el.style.cssText='position:absolute;border:1px solid #46f06a;background:rgba(70,240,106,.14);pointer-events:none;z-index:23;left:'+(x*100)+'%;top:'+(y*100)+'%;width:'+(w*100)+'%;height:'+(h*100)+'%'; }
function clearBossBox(){ const el=document.getElementById('bossSelBox'); if(el) el.remove(); _ba.box=null; }
function bossDeselect(){ _baSel=[]; if(typeof G!=='undefined') G.bossBldSel=false; }
// 포인트방 건물 히트박스(정규화): 중앙 상단 몸통 + 발밑
function _bossBldHit(p){ return Math.abs(p.x-0.5)<0.16 && p.y>(BOSS_FEET_FRAC-0.20) && p.y<(BOSS_FEET_FRAC+0.04); }   // 포인트방 건물(중앙 1채) 히트박스
function onBossArenaDown(e){ if(!G.bossOpen) return; if(e.target&&e.target.closest&&e.target.closest('#deselTop,#coopBossBar,.bossDeployBar')) return;
  const p=bossArenaPoint(e); _ba.moved=false;
  const u=bossUnitUnder(p);
  if(!u && !_baSel.length && G.coopBoss && !G.coopBoss.dead && _bossBldHit(p)){   // 건물 탭 → 지정(프로필)
    G.bossBldSel=true; _ba.box=null; _ba.dragU=null; _ba.cmd=null; if(typeof playSfx==='function') playSfx('ui_open'); refreshSelCard(); e.preventDefault(); return; }
  if(u){ if(_baSel.indexOf(u.uid)<0) _baSel=[u.uid]; G.bossBldSel=false; _ba.dragU=u; _ba.cmd=null; _ba.box=null; }   // 유닛 클릭 → 선택(드래그 시 이동)
  else if(_baSel.length){ _ba.cmd={issued:false}; bossAssignMove(p); _ba.box=null; _ba.dragU=null; }  // 선택 상태 + 빈 곳 → 이동
  else { G.bossBldSel=false; _ba.box={x0:p.x,y0:p.y,x1:p.x,y1:p.y}; _ba.dragU=null; _ba.cmd=null; }    // 빈 곳 → 박스 선택(건물 지정 해제)
  e.preventDefault(); }
function onBossArenaMove(e){ if(!G.bossOpen||(!_ba.box&&!_ba.cmd&&!_ba.dragU)) return; const p=bossArenaPoint(e); _ba.moved=true;
  if(_ba.box){ _ba.box.x1=p.x; _ba.box.y1=p.y; drawBossBox(); e.preventDefault(); return; }
  if(_ba.dragU && !_ba.cmd) _ba.cmd={issued:false};   // 유닛 누른 채 끌면 이동 명령
  if(_ba.cmd && !_ba.cmd.issued){ bossAssignMove(p); e.preventDefault(); } }
function onBossArenaUp(){
  if(_ba.cmd){ _ba.cmd.issued=true; _ba.cmd=null; _ba.dragU=null; return; }
  if(_ba.box){ const b=_ba.box, x0=Math.min(b.x0,b.x1),y0=Math.min(b.y0,b.y1),x1=Math.max(b.x0,b.x1),y1=Math.max(b.y0,b.y1); clearBossBox();
    if(_ba.moved && (x1-x0>0.02||y1-y0>0.02)){ _baSel=G.units.filter(u=>u.atBoss&&u.bx>=x0&&u.bx<=x1&&u.by>=y0&&u.by<=y1).map(u=>u.uid); }
    else bossDeselect();   // 빈 곳 탭 = 선택 해제
    _ba.dragU=null; return; }
  _ba.dragU=null; }
{ const _bp=document.getElementById('bossPanel');
  if(_bp){ _bp.addEventListener('pointerdown',onBossArenaDown); }
  document.addEventListener('pointermove',onBossArenaMove);
  ['pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev,onBossArenaUp)); }

