/* ============================================================================
 * 03-meta.js — 메타 성장 — 데이터 + 저장/로드
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ============================================================================
// 메타 성장 시스템 — 데이터 레이어 (1단계: 데이터 + 저장/로드만. 게임플레이 연결은 다음 단계)
//   설계서: "네모네모 디펜스 — 메타 성장 시스템 설계서"
//   ※ 포인트=영구(계정별), 빌드 효과=개인 적용 예정, coop 그룹=데이터만(효과 보류)
// ============================================================================
// 🎚 난이도 = **한 번씩 깨는 마일스톤 사다리**다(2026-08-19 재설계). 칸마다 적 체력 정확히 ×2 —
//   '메타를 한 겹 더 쌓으면 다음 칸'이 눈에 보이게. 끝없는 도전은 무한모드(highestRound)가 맡는다.
//   ⛔ 옛 곡선(HARD 3.5 · HELL 8 · FINAL 360)으로 되돌리지 말 것: NORMAL→HARD 가 ×4.4,
//     HELL→FINAL 이 ×45 라 사실상 통과 불가 구간이었고, 그래서 아무도 안 갔다.
//   coinMult 는 그대로 두고 **반복 보상의 난이도 배율(umDiffMul)로도 같은 값을 재사용**한다.
const DIFFICULTY = {
  easy:   { name:'EASY',   enemyHp:0.5, enemyAtk:1.0, coinMult:1.0, bossHp:1.0 },
  normal: { name:'NORMAL', enemyHp:1.0, enemyAtk:1.2, coinMult:1.5, bossHp:1.2 },
  hard:   { name:'HARD',   enemyHp:2.0, enemyAtk:1.5, coinMult:2.0, bossHp:1.6 },
  hell:   { name:'HELL',   enemyHp:4.0, enemyAtk:1.8, coinMult:2.5, bossHp:2.2 },
  nightmare:{ name:'FINAL',enemyHp:8.0, enemyAtk:2.2, coinMult:3.0, bossHp:2.8 },
};
const DIFFICULTY_ORDER = ['easy','normal','hard','hell','nightmare'];
// 보스 처치 포인트(기본, 난이도 coinMult 적용 전). 표에 없는 라운드는 라운드 비례 폴백.
// 메타 빌드 정의(설계서 4번). group: util / power / coop. 다음레벨 비용 = floor(start * rate^level)
// start=1레벨 비용 기준값, nMax=일반 레벨 수, max=일반+초월(초월 3레벨·효과 ×2/×4/×8). 비용은 metaNextCost(완만 감소배율) 참조.
const META_BUILDS = {   // 탭(group) → 섹션(sect) 2단 분류. 같은 sect끼리 묶여 헤더로 구분됨
  // ── 경제 (시작 자원 → 자원 획득) ──
  start_credit:  { name:'시작 미네랄', desc:'시작 시 미네랄 지급 (+25/Lv)',   start:15, nMax:10, max:10, group:'eco', sect:'시작 자원' },
  start_energy:  { name:'시작 가스', desc:'시작 시 가스 지급 (+10/Lv)',   start:15, nMax:10, max:10, group:'eco', sect:'시작 자원' },
  start_turret:  { name:'시작 포탑',   desc:'시작 시 미사일 포탑 배치 (+1기/Lv, 최대 3기)', start:100, costs:[100,250,500], nMax:3, max:3, group:'eco', sect:'시작 자원' },
  credit_gain:   { name:'미네랄 획득', desc:'인게임 미네랄 획득 증가 (+5%/Lv)', start:25, nMax:10, max:10, group:'eco', sect:'자원 획득' },
  energy_gain:   { name:'가스 획득', desc:'인게임 가스 획득 증가 (+5%/Lv)', start:25, nMax:10, max:10, group:'eco', sect:'자원 획득' },
  interest_cap:  { name:'이자 상한',   desc:'라운드 정산 이자 +10/Lv (보유 인정 한도 +100/Lv)', start:30, nMax:10, max:10, group:'eco', sect:'자원 획득' },
  // ── 생산(뽑기·자동화) ──
  gacha_luck:    { name:'고등급 확률', desc:'레전드+ 뽑기 확률 가중 (+2%/Lv)', start:20, nMax:10, max:10, group:'prod', sect:'뽑기' },
  gacha_double:  { name:'추가 생산',   desc:'뽑기 시 1기 추가 확률 (+1%/Lv)',  start:18, nMax:10, max:10, group:'prod', sect:'뽑기' },
  // 자동화 해금(생산 섹션 통합) — 1회 구매로 인게임 on/off 토글 해금
  auto_unit:    { name:'자동 유닛 소환',  desc:'유닛 자동 뽑기 토글 해금 (0.33초마다 1기)',          start:250, nMax:1, max:1, group:'prod', sect:'자동화' },
  auto_combine: { name:'자동 조합',       desc:'낮은 등급부터 자동 조합 토글 해금 (레전드까지·0.33초)', start:250, nMax:1, max:1, group:'prod', sect:'자동화' },
  auto_energy:  { name:'자동 가스 변환', desc:'미네랄→가스 자동 변환 토글 해금 (0.33초마다)',      start:220, nMax:1, max:1, group:'prod', sect:'자동화' },
  auto_pboss:   { name:'자동 개인 보스',   desc:'개인 보스를 쿨마다 자동 소환 토글 해금 (보스별 on/off)', start:400, nMax:1, max:1, group:'prod', sect:'자동화' },
  auto_place:   { name:'자동 유닛 배치',   desc:'새 유닛을 트랙에 자동 정렬 토글 해금 (가운데 쌓임 방지)', start:200, nMax:1, max:1, group:'prod', sect:'자동화' },
  auto_bossdeploy:{ name:'자동 보스 파견', desc:'가장 강한 유닛을 포인트방 보스에 자동 파견 토글 해금 (빈 슬롯 채움)', start:300, nMax:1, max:1, group:'prod', sect:'자동화' },
  // ── 전투(아군 강화 · 적 약화) — 모두 10레벨 ──
  unit_atk_up:   { name:'공격력 증가',  desc:'유닛 공격력 증가 (+2.5%/Lv)', start:18, nMax:10, max:10, group:'combat', sect:'아군 강화' },
  unit_aspd:     { name:'공격 속도',    desc:'아군 공격 속도 증가 (+2%/Lv)', start:18, nMax:10, max:10, group:'combat', sect:'아군 강화' },
  enemy_hp_down: { name:'적 체력 감소', desc:'내 트랙 적 체력 감소 (-2%/Lv)', start:18, nMax:10, max:10, group:'combat', sect:'적 약화' },
  enemy_def_down:{ name:'적 방어 감소', desc:'내 트랙 적 방어력 감소 (-1/Lv)', start:15, nMax:10, max:10, group:'combat', sect:'적 약화' },
  // ── 전체 강화(팀 공유) — 모두 20레벨 ──
  team_atk:      { name:'전체 공격력',   desc:'모든 유닛 공격력 증가 (+1%/Lv)',  start:8, nMax:20, max:20, group:'team', sect:'팀 강화' },
  team_aspd:     { name:'전체 공격속도', desc:'모든 유닛 공격 속도 증가 (+1%/Lv)', start:8, nMax:20, max:20, group:'team', sect:'팀 강화' },
  team_luck:     { name:'전체 고등급 확률', desc:'모든 플레이어 레전드+ 뽑기 가중 (+1%/Lv)', start:8, nMax:20, max:20, group:'team', sect:'팀 강화' },
  team_credit:   { name:'전체 시작 미네랄',desc:'모든 플레이어 시작 미네랄 (+10/Lv)', start:8, nMax:20, max:20, group:'team', sect:'팀 강화' },
  team_enemy_hp: { name:'전체 적 체력',  desc:'모든 적 체력 감소 (-1%/Lv)', start:8, nMax:20, max:20, group:'team', sect:'팀 적 약화' },
  team_enemy_def:{ name:'전체 적 방어', desc:'모든 적 방어력 감소 (-0.5/Lv)',  start:8, nMax:20, max:20, group:'team', sect:'팀 적 약화' },
  boss_hp_down:  { name:'포인트방 체력 감소', desc:'포인트방 보스 체력 감소 (-1.5%/Lv)', start:8, nMax:20, max:20, group:'team', sect:'포인트방' },
  boss_atk_up:   { name:'파견 유닛 피해', desc:'파견 유닛의 포인트방 보스 피해 증가 (+1%/Lv)', start:8, nMax:20, max:20, group:'team', sect:'포인트방' },
  // ── 보스(월드·개인·라운드) — 모두 10레벨 ──
  boss_reward_up:{ name:'포인트방 보상', desc:'포인트방 보스 처치 포인트 보상 증가 (+10%/Lv)', start:20, nMax:10, max:10, group:'coop', sect:'포인트방' },
  pboss_reward:  { name:'개인보스 보상', desc:'개인 보스 처치 보상 증가 (+5%/Lv)', start:20, nMax:10, max:10, group:'coop', sect:'개인 보스' },
  pboss_cd:      { name:'개인보스 쿨감', desc:'개인 보스 재소환 쿨다운 감소 (-2.5%/Lv)', start:20, nMax:10, max:10, group:'coop', sect:'개인 보스' },
  rboss_hp_down: { name:'라운드보스 체력', desc:'10·20·30라운드 보스 체력 감소 (-2%/Lv)', start:20, nMax:10, max:10, group:'coop', sect:'라운드 보스' },
  rboss_dmg_up:  { name:'라운드보스 피해', desc:'10·20·30라운드 보스에 주는 피해 증가 (+2%/Lv)', start:20, nMax:10, max:10, group:'coop', sect:'라운드 보스' },
};
// 비용 곡선: 일반 레벨 = start×(lv+1) (선형 — 1단계 start, 2단계 2×start … 딱 떨어지는 가격), 초월 레벨 = 일반 누적×[..] (5단위 반올림).
const META_COST_POW=1.0;
const META_TRANS_COST=[2.5,5,9];   // 초월 3레벨 비용 배수(일반 누적 대비) — 진짜 훨씬 비싸게(합 ≈16.5×)
function metaNMax(b){ return (b&&b.nMax!=null)?b.nMax:(b?b.max:0); }
function metaNormalTotal(b){ const n=metaNMax(b); let t=0; for(let i=0;i<n;i++) t+=Math.round(b.start*Math.pow(i+1,META_COST_POW)); return t; }
function metaNextCost(buildId, level){ const b=META_BUILDS[buildId]; if(!b) return null;
  const lv=(level==null)?buildLevel(buildId):level; if(lv>=b.max) return null;
  if(b.costs) return (b.costs[lv]!=null)?b.costs[lv]:null;   // 레벨별 고정 비용 배열(급격한 곡선용)
  const n=metaNMax(b);
  if(lv<n) return Math.round(b.start*Math.pow(lv+1, META_COST_POW));   // 일반 구간(선형 → start의 배수)
  return Math.round(metaNormalTotal(b)*(META_TRANS_COST[lv-n]||1.5)/5)*5; }  // 초월 구간(일반 누적의 배수, 5단위 반올림)
// 빌드 효과 레벨: 일반=레벨 그대로, 초월 k단계=일반최대 nMax×2^k(효과가 ×2/×4/×8로 점프)
function _metaEffFromRaw(b, lv){ if(!b) return lv; const n=metaNMax(b); return (lv<=n)?lv:n*Math.pow(2, lv-n); }
function metaEffLv(id){ return _metaEffFromRaw(META_BUILDS[id], buildLevel(id)); }
   // 다음 강화가 초월 레벨인지
// 플레이어 메타(계정별 영구 데이터)
// 🧍 개인 프로필 RPG(1단계) 기본값 — 유즈맵 경제와 완전 분리(재화명 pcoin, coins 아님). 자세한 규칙은 PROF_* 블록 참조.
// 계정 공용(재화·펫·해금·방치) + 캐릭터별(chars[]: 레벨·경험치·스탯·장비·진화)로 나뉜다.
// 🎟 뽑기권 종류(단일 소스) — 토벌 종류(DG_DUNGEONS)와 짝이다. 늘릴 땐 **둘을 같이** 늘린다.
//   ⚠ 여기서 DG_DUNGEONS 를 참조할 수 없다 — 09-dungeon.js 는 이 파일보다 뒤에 로드된다.
const TIX_KINDS=['gear','pet','ally','rune'];
function emptyTickets(){ const t={}; for(const k of TIX_KINDS) t[k]=0; return t; }
function defaultProfile(){ return { ver:11, pcoin:0, gas:0, gem:0, chars:[], curId:'', items:[],
  hunt:{ dg:1, round:1, climb:true, best:{}, rw:{}, mates:{}, party:[], mateN:0, allySlots:0, upg:{atk:0,rng:0,aspd:0,crit:0,hp:0,regen:0} },   // ⚔ 자동사냥(HOME) 진행·마일스톤 수령 · 기본 = 등반(rw)·영구 업그레이드
  idle:{ sourceId:'drill', lastClaimTs:0 }, unlocks:{}, lastSeenTs:0,
  dgKeys:{}, tickets:emptyTickets(),   // 🗝 토벌 종류별 열쇠(매일 09:00 보충) · 🎟 뽑기권(장비/펫/동료/룬)
  daily:{ day:0, q:[], allGot:0, wk:{key:0,n:0,got:0}, att:{n:0, day:0, bn:{}, fin:0, cyc:0} },   // 📅 일일 — 출석 캘린더 + 오늘의 퀘스트 + 주간 누적(dqState가 스스로 보정한다)
  pets:{}, equip:[], petSlots:0, petN:0 }; }   // 🐾 펫(중복=별)·장착 칸(0에서 시작해 미네랄로 연다)
// 계정 영구 재화(공용 재화 바) — 미네랄=pcoin(기존 이름 유지)·가스·젬. 없던 프로필도 0으로 살려 읽는다.
function profMineral(){ const p=PROF(); return Math.floor(p&&p.pcoin||0); }
function profGas(){ const p=PROF(); return Math.floor(p&&p.gas||0); }
function profGem(){ const p=PROF(); return Math.floor(p&&p.gem||0); }
function defaultChar(cls, name){ const C=PROF_CLASSES[cls]||PROF_CLASSES.ranger, id=(PROF_CLASSES[cls]?cls:'ranger');
  return { id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), cls:id, name:(name||C.name),
    xp:0, level:1, statPoints:0, dgFloors:{}, reb:0, rebMul:0, rp:0, lpAuto:LP_AUTO_DEFAULT,   // ⚔ 토벌 단계는 **종류별**(dgFloors) · 🔁 환생 횟수 · 환생 포인트 · 🤖 자동 배분 대상
    unit:{ jobId:id, level:1, stats:{pow:0,vit:0,foc:0,agi:0}, pts:{}, rpts:{}, gear:_emptyGear() } }; }
function defaultMeta(){ return { coins:0, buildLevels:{}, highestRound:0, clearedDifficulty:'', profile:defaultProfile() }; }   // clearedDifficulty:''=아무것도 클리어 안 함(이지만 개방)
let PLAYER_META = defaultMeta();
const TEMP_COIN_TEST=false;   // [임시] 포인트 상점 밸런스 테스트 — 포인트 무한 + 로비 진입 시 업그레이드 초기화. 끝나면 false 또는 이 블록 제거.
function metaKey(){ const u=(typeof AUTH!=='undefined' && AUTH.user) ? AUTH.user : null;
  return 'nm_meta_' + (u ? (u.uid || u.email || u.nick || 'guest') : 'guest'); }
// ⚠ 화면 함수들은 대부분 loadMeta()를 '먼저' 부르고 그 다음 showAppScreen(→hbStop)을 부른다.
//    그래서 hbStop에서만 저장하면 이미 지워진 값을 저장하게 된다(처치 재화가 사라지던 진짜 이유).
//    저장 안 된 전투 보상이 있으면 여기서 먼저 flush한다 — 모든 화면이 이 한 곳을 지난다.
function loadMeta(){ if(_hbDirty){ _hbDirty=false; try{ saveMeta(); }catch(e){} }
  try{ const raw=localStorage.getItem(metaKey());
  PLAYER_META = raw ? Object.assign(defaultMeta(), JSON.parse(raw)) : defaultMeta();
  if(!PLAYER_META.buildLevels) PLAYER_META.buildLevels={};
  migrateProfile(); }catch(e){ PLAYER_META=defaultMeta(); }
  return PLAYER_META; }
// 얕은 병합(로컬/서버) 대비: profile 블록 보정 + 내부 신규 키 back-fill(ver 기준). 손상돼도 기본값으로 복구.
function migrateProfile(){ const d=defaultProfile();
  if(!PLAYER_META.profile || typeof PLAYER_META.profile!=='object'){ PLAYER_META.profile=d; return; }
  const p=PLAYER_META.profile;
  for(const k in d){ if(p[k]===undefined) p[k]=d[k]; }                 // 최상위 키 채움
  if(!Array.isArray(p.chars)) p.chars=[];
  if((p.ver||0)<3 && p.unit){                                          // ver2 = 캐릭터 1명 구조 → 첫 슬롯으로 승격
    const c=defaultChar('ranger','캐릭터');
    c.xp=p.xp||0; c.level=p.level||1; c.statPoints=p.statPoints||0; c.unit=p.unit;
    p.chars.push(c); p.curId=c.id; }
  delete p.unit; delete p.xp; delete p.level; delete p.statPoints;      // 캐릭터별로 옮겨간 필드
  // ⚠ 순서 주의 — fixChar()가 '없어진 직업'을 조용히 뿌리로 되돌린다. 그 뒤에 두면 옛 직업을 볼 수 없어
  //    동료를 못 준다(실제로 그렇게 짰다가 스모크가 잡았다). 반드시 fixChar 앞에서 변환할 것.
  // v7 전직 폐지 — 상위 직업으로 전직해 둔 캐릭터는 뿌리로 되돌리고, 그 직업을 '동료'로 무료 지급한다.
  //   (돈 주고 산 것을 그냥 없애지 않는다.) 옛 범용 동료(build.ally)는 이름 있는 동료로 대체됐으니 환급.
  if((p.ver||0)<7){
    const H=p.hunt||(p.hunt={}); if(!H.mates) H.mates={}; if(!Array.isArray(H.party)) H.party=[];
    for(const c of p.chars){ const jid=c.unit&&c.unit.jobId;
      if(jid && PROF_JOB_MIG.indexOf(jid)<0){           // 뿌리가 아니면 = 옛 상위 직업
        if(HB_MATES[jid]){ const ex=H.mates[jid];                    // 보유 표기는 v8 형식({lv,dup})으로 바로 쓴다
          H.mates[jid]=(ex&&typeof ex==='object')? ex : {lv:Math.max(1, (typeof ex==='number'?ex:0)), dup:0};
          if(!(H.mates[jid].lv>0)) H.mates[jid].lv=1;
          if(H.party.indexOf(jid)<0) H.party.push(jid); }
        c.unit.jobId=PROF_CLASSES[c.cls]?c.cls:'ranger'; } }
    if(H.build && H.build.ally){ p.pcoin=(p.pcoin||0)+150*H.build.ally*2; H.build.ally=0; }   // 옛 동료 구매액 대략 환급
    H.party=H.party.slice(0,5); }
  for(const c of p.chars) fixChar(c);
  if(!Array.isArray(p.items)) p.items=[];
  if((p.ver||0)<4){                                                    // ver3 = 슬롯당 정수 티어 → 동등 성능 아이템으로 변환(스탯 손실 없음)
    const OLD_PER={weapon:3, armor:4, trinket:2};
    for(const c of p.chars){ const gr=c.unit&&c.unit.gear; if(!gr) continue;
      for(const slot in gr){ const n=gr[slot];
        if(typeof n==='number' && n>0){
          const it={ iid:'it'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), slot:slot,
                     tier:'common', lv:1, main:n*(OLD_PER[slot]||3), opts:[], legacy:true };
          p.items.push(it); gr[slot]=it.iid; }
        else if(typeof n!=='string') gr[slot]=''; } } }
  if((p.ver||0)<5){                                                    // ver4 = 3슬롯(무기·방어구·장신구) → 12슬롯 재편
    const MAP={weapon:'weapon', armor:'top', trinket:'necklace'};
    for(const it of p.items) if(MAP[it.slot]) it.slot=MAP[it.slot];
    for(const c of p.chars){ const old=c.unit.gear||{}, ng=_emptyGear();
      for(const k in old){ const nk=MAP[k]; if(nk && old[k]) ng[nk]=old[k]; }
      c.unit.gear=ng; } }
  if(p.chars.length && !p.chars.some(c=>c.id===p.curId)) p.curId=p.chars[0].id;
  if(!p.idle) p.idle=d.idle; else for(const k in d.idle) if(p.idle[k]===undefined) p.idle[k]=d.idle[k];
  if(!p.unlocks) p.unlocks={};
  if(!p.pets||typeof p.pets!=='object') p.pets={};                 // 🐾 펫
  if(!Array.isArray(p.equip)) p.equip=[]; if(typeof p.petSlots!=='number') p.petSlots=0;
  // v6 자동사냥: 스탯 포인트 체계 흡수 — 배분 스탯 → 대응 업그레이드 레벨(캐릭터 중 최대),
  //   남은 포인트 → 미네랄 환급(1pt=20). migrated 표식으로 1회만(부팅 저장 이후엔 재실행 안 됨).
  if(p.hunt && !p.hunt.migrated){ p.hunt.migrated=1;
    const M={pow:'atk',vit:'hp',foc:'crit',agi:'aspd'};
    for(const c of p.chars){ if(!c||!c.unit||!c.unit.stats) continue;
      for(const k in M) p.hunt.upg[M[k]]=Math.max(p.hunt.upg[M[k]]||0, c.unit.stats[k]||0);
      for(const k in M) c.unit.stats[k]=0;      // ⚠ 옮겼으면 비운다 — 안 비우면 같은 스탯이 두 번 반영된다
      if(c.unit.statAcc) delete c.unit.statAcc;   // 자동 상승 시절의 소수점 잔여도 정리
      if(c.statPoints>0){ p.pcoin=(p.pcoin||0)+c.statPoints*20; c.statPoints=0; } } }
  // v8 동료를 뽑기 방식으로 — 보유 표기를 {lv,dup}로 바꾸고, 미네랄로 사 뒀던 레벨은 그대로 인정한다.
  //   뽑기권 소비처가 생겼으므로 처음 열 때 몇 장 쥐여 준다(안 그러면 뽑기 화면이 비어 보인다).
  if((p.ver||0)<8){ const H=p.hunt||(p.hunt={});
    if(H.mates) for(const id in H.mates){ const v=H.mates[id];
      if(typeof v==='number') H.mates[id]={lv:Math.max(1,v), dup:0};
      else if(!v || typeof v!=='object') delete H.mates[id];
      else { v.lv=Math.max(1,v.lv||1); v.dup=v.dup||0; } }
    if(typeof H.mateN!=='number') H.mateN=0;
    if(!p.tickets) p.tickets=emptyTickets();
    p.tickets.ally=(p.tickets.ally||0)+HB_MATE_START_TICKETS; }
  // v9 펫 뽑기를 동료와 같은 형태로 — 옛 보유 표기 {count:N} 을 {star:N-1, dup:0} 로 옮긴다.
  //   ⚠ 별은 '중복 수 − 1'이었다. 그 값을 그대로 star 로 옮겨야 펫 성능(profPetVal)이 안 깎인다.
  if((p.ver||0)<9){
    if(p.pets) for(const id in p.pets){ const v=p.pets[id];
      if(!v || typeof v!=='object'){ delete p.pets[id]; continue; }
      if(v.star===undefined) v.star=Math.max(0,(v.count||1)-1);
      if(v.dup===undefined) v.dup=0; if(v.fed===undefined) v.fed=0;
      delete v.count; }
    if(typeof p.petN!=='number') p.petN=0;
    if(!p.tickets) p.tickets=emptyTickets();
    p.tickets.pet=(p.tickets.pet||0)+PROF_PET_START_TICKETS; }
  // v10 장착 칸을 '미네랄로 사는 것'으로 — 이미 쓰고 있던 칸은 뺏지 않는다(산 것을 잃지 않는다).
  //   옛 기본값은 펫 2칸이었고 동료는 정원 3이 그냥 열려 있었다.
  if((p.ver||0)<10){
    const H=p.hunt||(p.hunt={});
    p.petSlots=Math.max(0, Math.min(MG_SLOT_MAX, (typeof p.petSlots==='number')?p.petSlots:2));
    if(typeof H.allySlots!=='number') H.allySlots=Math.min(MG_SLOT_MAX, Math.max(3,(H.party||[]).length));
    if(p.unlocks){ delete p.unlocks.pet_slot3; delete p.unlocks.pet_slot4; delete p.unlocks.ally_plus; } }
  // v11 토벌 단계를 **종류별**로 — 옛 c.dgFloor 하나는 '일반 토벌' 기록이다(그때는 일반만 열려 있었다).
  //   ⚠ fixChar() 는 위(line 138)에서 이미 돌아 dgFloors 를 빈 객체로 심어 놨다 — 여기서 값을 채운다.
  //   🎟 룬 뽑기권 칸도 이때 생긴다(없으면 렌더가 undefined 를 찍는다).
  if((p.ver||0)<11){
    for(const c of (p.chars||[])){ if(!c) continue;
      if(!c.dgFloors || typeof c.dgFloors!=='object') c.dgFloors={};
      if(c.dgFloor && !c.dgFloors.normal) c.dgFloors.normal=c.dgFloor;
      delete c.dgFloor; }                       // 옮겼으면 지운다 — 두 벌이 남으면 반드시 어긋난다
    if(!p.tickets) p.tickets=emptyTickets();
    for(const k of TIX_KINDS) if(typeof p.tickets[k]!=='number') p.tickets[k]=0; }
  p.ver=d.ver; }
// 캐릭터 1건 보정(신규 키 back-fill + 폐기된 직업 id 복구)
function fixChar(c){ const d=defaultChar(c&&c.cls, c&&c.name);
  if(!PROF_CLASSES[c.cls]) c.cls='ranger';
  for(const k in d) if(c[k]===undefined) c[k]=d[k];
  if(!c.unit) c.unit=d.unit; else { for(const k in d.unit) if(c.unit[k]===undefined) c.unit[k]=d.unit[k];
    if(!c.unit.stats) c.unit.stats=Object.assign({},d.unit.stats); else for(const k in d.unit.stats) if(c.unit.stats[k]===undefined) c.unit.stats[k]=0;
    if(!c.unit.gear)  c.unit.gear =Object.assign({},d.unit.gear);  else for(const k in d.unit.gear)  if(c.unit.gear[k]===undefined)  c.unit.gear[k]='';
    // 🎯 레벨 포인트(LP_STATS) — 옛 unit.stats(배분)와 '다른' 필드다. 그건 마이그레이션이 0으로 비운다.
    if(!c.unit.pts  || typeof c.unit.pts !=='object') c.unit.pts ={};
    if(!c.unit.rpts || typeof c.unit.rpts!=='object') c.unit.rpts={}; }   // 🔁 환생 포인트(영구)
  // 🤖 자동 배분은 0/1 이었다가 '대상 축의 키'가 됐다(2026-08-19) — 켜져 있던 저장은 기본 축으로 옮긴다
  if(c.lpAuto===1 || c.lpAuto===true) c.lpAuto=LP_AUTO_DEFAULT;
  else if(!LP_STATS.some(S=>S.k===c.lpAuto)) c.lpAuto='';
  c.unit.jobId=c.cls;   // 직업 폐지 — jobId 는 캐릭터 종류를 따라가는 흔적 필드일 뿐이다
  return c; }
function PROF(){ return PLAYER_META.profile || (PLAYER_META.profile=defaultProfile()); }   // 안전 접근자
function CHAR(){ const p=PROF(); if(!p.chars||!p.chars.length) return null;                // 현재 조종 중인 캐릭터(없으면 null)
  return p.chars.find(c=>c.id===p.curId) || p.chars[0]; }
function saveMeta(){ try{ localStorage.setItem(metaKey(), JSON.stringify(PLAYER_META)); }catch(e){}
  if(typeof sbSaveMetaDebounced==='function') sbSaveMetaDebounced(); }   // 로컬 + 계정(서버) 동시 저장
function buildLevel(id){ return (PLAYER_META.buildLevels && PLAYER_META.buildLevels[id]) || 0; }

