/* ============================================================================
 * 15-tech-data.js — 테크트리 데이터 · 상세 스펙 · 커맨드 그리드 어댑터
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ══ 테크트리 데이터(SC1 구조 → 게임 로스터·개명 유닛 매핑) ══
//   자원: SC1 미네랄→크레딧(m,◈) / 가스→에너지(g,⚡) · 신규 이중자원 없음(기존 재화 재활용)
//   b = 건물 { k,name,ico, m,g(건설비), req[](선행 건물키), supply,gas,lift,detector, addonTo(애드온 부착 대상),
//             produces:[{id,name,m,g,pop,req[]}], research:[{k,name,desc,m,g} | {k,name,desc,tier:[[m,g]..]}] }
const TECH_TREE={};
TECH_TREE.union={ name:'유니온', res:{m:'크레딧', g:'에너지'}, buildings:[
  // ── 기본·자원 ──
  { k:'command', name:'본부', ico:'🏢', m:180, g:0, supply:10, req:[], lift:true,
    produces:[{id:'worker_human', name:'정비공', m:50, g:0, pop:1}] },
  { k:'supply', name:'보급소', ico:'🏠', m:100, g:0, supply:8, req:['command'] },
  { k:'refinery', name:'정제소', ico:'🛢', m:100, g:0, gas:true, req:['command'] },
  // ── 보병(바이오닉)·방어 ──
  { k:'barracks', name:'병영', ico:'🏛', m:150, g:0, req:['command'], lift:true,
    produces:[
      {id:'marine', name:'레인저', m:50, g:0, pop:1},
      {id:'machinegun', name:'화력병', m:50, g:25, pop:1, req:['academy']},   // 파이어뱃
      {id:'medic', name:'의무병', m:50, g:25, pop:1, req:['academy']},
      {id:'ghost', name:'저격수', m:25, g:75, pop:1, req:['scifac','covert']} ] },
  { k:'academy', name:'훈련소', ico:'🎓', m:150, g:0, req:['barracks'],
    research:[
      {k:'u238', name:'강화 탄환', desc:'레인저 사거리 +1', m:150, g:150},
      {k:'stim', name:'광폭화', desc:'레인저·화력병 이속·공속↑(체력 소모)', m:100, g:100},
      {k:'flare', name:'섬광탄', desc:'의무병 실명 섬광 스킬', m:100, g:100},
      {k:'restore', name:'정화', desc:'의무병 디버프 해제', m:100, g:100},
      {k:'caduceus', name:'마나 증폭', desc:'의무병 최대 에너지 +50', m:150, g:150} ] },
  { k:'engbay', name:'공학소', ico:'⚙️', m:125, g:0, req:['command'], lift:true,
    research:[
      {k:'inf_atk', name:'보병 공격력', desc:'레인저·화력병·저격수 공격 +1/티어', tier:[[100,100],[175,175],[250,250]]},
      {k:'inf_def', name:'보병 방어력', desc:'보병 방어 +1/티어', tier:[[100,100],[175,175],[250,250]]} ] },
  { k:'bunker', name:'벙커', ico:'🧱', m:100, g:0, req:['barracks'] },
  { k:'turret', name:'미사일 포탑', ico:'📡', m:75, g:0, req:['engbay'], detector:true },
  // ── 기갑(메카)·공중 ──
  { k:'factory', name:'기갑 공장', ico:'🏭', m:200, g:100, req:['barracks'], lift:true,
    produces:[
      {id:'racer', name:'레이서', m:75, g:0, pop:2},                        // 벌처
      {id:'tank', name:'공성전차', m:150, g:100, pop:2, req:['machshop']},   // 시즈 탱크
      {id:'goliath', name:'기갑병', m:100, g:50, pop:2, req:['armory']} ] },
  { k:'machshop', name:'정비소', ico:'🛠', m:50, g:50, addonTo:'factory',
    research:[
      {k:'ion', name:'이동 강화', desc:'레이서 이동속도↑', m:100, g:100},
      {k:'mine', name:'지뢰', desc:'레이서 지뢰 3개 사용', m:100, g:100},
      {k:'siege', name:'공성 모드', desc:'공성전차 장거리 포격 모드', m:150, g:150},
      {k:'charon', name:'대공 강화', desc:'기갑병 대공 사거리↑', m:150, g:150} ] },
  { k:'armory', name:'무기고', ico:'⚔️', m:100, g:50, req:['factory'],
    research:[
      {k:'veh_atk', name:'차량 공격력', desc:'레이서·공성전차·기갑병 +/티어', tier:[[100,100],[175,175],[250,250]]},
      {k:'veh_def', name:'차량 방어력', desc:'차량 방어 +/티어', tier:[[100,100],[175,175],[250,250]]},
      {k:'air_atk', name:'함선 공격력', desc:'전투기·폭격기·전함 +/티어', tier:[[100,100],[175,175],[250,250]]},
      {k:'air_def', name:'함선 방어력', desc:'함선 방어 +/티어', tier:[[150,150],[225,225],[300,300]]} ] },
  { k:'starport', name:'비행장', ico:'🚀', m:150, g:100, req:['factory'], lift:true,
    produces:[
      {id:'skyguard', name:'전투기', m:150, g:100, pop:2},                                  // 레이스
      {id:'pelican', name:'수송선', m:100, g:100, pop:2, req:['control']},                     // 드랍십
      {id:'aegis', name:'지원 정찰기', m:100, g:225, pop:2, req:['control','scifac']},              // 사이언스 베슬
      {id:'hellfire', name:'폭격기', m:250, g:125, pop:3, req:['control','armory']},          // 발키리
      {id:'dreadnought', name:'전함', m:400, g:300, pop:6, req:['control','physics']} ] },// 배틀크루저
  { k:'control', name:'관제탑', ico:'🗼', m:50, g:50, addonTo:'starport',
    research:[
      {k:'cloak_w', name:'은신', desc:'전투기 은신 스킬', m:150, g:150},
      {k:'apollo', name:'마나 증폭', desc:'전투기 최대 에너지 +50', m:150, g:150} ] },
  // ── 고급 기술 ──
  { k:'scifac', name:'연구소', ico:'🔬', m:100, g:150, req:['starport'], lift:true,
    research:[
      {k:'emp', name:'EMP', desc:'대상 지역 에너지·보호막 소거', m:200, g:200},
      {k:'irradiate', name:'방사능', desc:'생체 유닛 지속 방사능 피해', m:200, g:200},
      {k:'titan', name:'마나 증폭', desc:'지원 정찰기 최대 에너지 +50', m:150, g:150} ] },
  { k:'covert', name:'특수 작전실', ico:'👁️', m:50, g:50, addonTo:'scifac',
    research:[
      {k:'lockdown', name:'봉쇄', desc:'기계 유닛 일정시간 마비', m:200, g:200},
      {k:'cloak_g', name:'은신', desc:'저격수 은신 스킬', m:100, g:100},
      {k:'ocular', name:'시야 강화', desc:'저격수 시야·사거리 +1', m:100, g:100},
      {k:'moebius', name:'마나 증폭', desc:'저격수 최대 에너지 +50', m:150, g:150} ] },
  { k:'physics', name:'화력 연구소', ico:'🌌', m:50, g:50, addonTo:'scifac',
    research:[
      {k:'yamato', name:'집중포', desc:'전함 단일 대상 강력 포격', m:200, g:200},
      {k:'colossus', name:'마나 증폭', desc:'전함 최대 에너지 +50', m:150, g:150} ] },
  { k:'comsat', name:'통신소', ico:'📡', m:50, g:50, addonTo:'command', req:['academy'], detector:true },
  { k:'nuke', name:'핵 격납고', ico:'☢️', m:50, g:50, addonTo:'command', req:['covert'],
    produces:[{id:'nuke', name:'핵미사일', m:200, g:200, pop:8}] },
]};
TECH_TREE.swarm={ name:'스웜', res:{m:'크레딧', g:'에너지'}, buildings:[
  // ── 1티어(해처리 단계) ──
  { k:'hatchery', name:'부화장', ico:'🥚', m:180, g:0, supply:1, req:[], evolveTo:'lair',
    produces:[   // 스타식: 모든 유닛=해처리에서 생산, 테크 건물이 해금(파괴 시 재잠금)
      {id:'worker_swarm', name:'생산자', m:50, g:0, pop:1},
      {id:'overlord', name:'수송충', m:100, g:0, pop:0, supply:8, detector:true},
      {id:'snapper', name:'척후병', m:50, g:0, pop:1, req:['pool']},
      {id:'hydra', name:'스파이크', m:75, g:25, pop:1, req:['hydraden']},
      {id:'wyvern', name:'비행충', m:100, g:100, pop:2, req:['spire']},
      {id:'stinger', name:'자폭충', m:25, g:75, pop:1, req:['spire']},
      {id:'medusa', name:'군단여왕', m:100, g:100, pop:2, req:['queensnest']},
      {id:'ultralisk', name:'돌격괴수', m:200, g:200, pop:4, req:['ultracavern']}],
    research:[{k:'burrow', name:'매복', desc:'지상 유닛 잠복', m:100, g:100}] },
  { k:'extractor', name:'채취기', ico:'🛢', m:50, g:0, gas:true, req:['hatchery'] },
  { k:'pool', name:'번식지', ico:'🧫', m:150, g:0, req:['hatchery'], unlocks:['snapper'],   // 저글링 해금(생산=해처리)
    research:[
      {k:'metabolic', name:'이속 강화', desc:'척후병 이동속도↑', m:100, g:100},
      {k:'adrenal', name:'광폭화', desc:'척후병 공격속도↑', m:200, g:200, req:['hive']} ] },
  { k:'evochamber', name:'진화장', ico:'🧬', m:50, g:0, req:['hatchery'],
    research:[
      {k:'melee_atk', name:'근접 공격력', desc:'척후병·스웜링·돌격괴수 +/티어', tier:[[100,100],[150,150],[200,200]]},
      {k:'range_atk', name:'원거리 공격력', desc:'스파이크·가시여왕 +/티어', tier:[[100,100],[150,150],[200,200]]},
      {k:'gnd_def', name:'지상 방어력', desc:'모든 지상 +/티어', tier:[[150,150],[225,225],[300,300]]} ] },
  { k:'hydraden', name:'스파이크 굴', ico:'🐍', m:100, g:50, req:['pool'], unlocks:['hydra','thornqueen'],   // 리퍼·럴커 해금
    research:[
      {k:'muscle', name:'이속 강화', desc:'스파이크 이동속도↑', m:150, g:150},
      {k:'grooved', name:'사거리 강화', desc:'스파이크 사거리 +1', m:150, g:150},
      {k:'lurker', name:'여왕 변태', desc:'스파이크→가시여왕 변태 가능', m:200, g:200, req:['lair']} ] },
  { k:'creep', name:'점막탑', ico:'🩸', m:75, g:0, req:['hatchery'], evolveTo:['sunken','spore'] },
  { k:'sunken', name:'가시탑', ico:'🦑', m:50, g:0, req:['pool'], evolveOnly:true },
  { k:'spore', name:'포자탑', ico:'🍄', m:50, g:0, req:['evochamber'], detector:true, evolveOnly:true },
  // ── 2티어(레어 단계) ──
  { k:'lair', name:'소굴', ico:'👁️', m:150, g:100, req:['pool'], evolveOnly:true, evolveTo:'hive',
    research:[
      {k:'pneuma', name:'비행 가속', desc:'수송충 이동속도↑', m:150, g:150},
      {k:'antennae', name:'시야 강화', desc:'수송충 시야↑', m:150, g:150},
      {k:'ventral', name:'수송 능력 개발', desc:'수송충 수송(드랍) 가능', m:200, g:200} ] },
  { k:'spire', name:'첨탑', ico:'🦇', m:200, g:150, req:['lair'], unlocks:['wyvern','stinger'], evolveTo:'gspire',   // 와이번·스팅어 해금 · 거대 첨탑로 진화
    research:[
      {k:'fly_atk', name:'비행 공격력', desc:'비행충·자폭충·포격충 +/티어', tier:[[100,100],[175,175],[250,250]]},
      {k:'fly_def', name:'비행 방어력', desc:'비행 방어 +/티어', tier:[[150,150],[225,225],[300,300]]} ] },
  { k:'queensnest', name:'여왕 둥지', ico:'👑', m:150, g:150, req:['lair'], unlocks:['medusa'],   // 메두사(퀸) 해금
    research:[
      {k:'ensnare', name:'점착 가스', desc:'적 이동·공속 감소', m:100, g:100},
      {k:'broodling', name:'유충 폭발', desc:'적 생체 즉사+스웜링 생성', m:100, g:100},
      {k:'gamete', name:'마나 증폭', desc:'군단여왕 최대 에너지 +50', m:150, g:150} ] },
  // ── 3티어(하이브 단계) ──
  { k:'hive', name:'대군락', ico:'🌋', m:200, g:150, req:['queensnest'], evolveOnly:true },
  { k:'gspire', name:'거대 첨탑', ico:'🦅', m:100, g:150, req:['hive','spire'], unlocks:['behemoth'], evolveOnly:true },   // 가디언 해금 · 첨탑에서 진화
  { k:'defilermound', name:'오염 둥지', ico:'🦂', m:100, g:100, req:['hive'], unlocks:['venom'],   // 디파일러 해금
    research:[
      {k:'consume', name:'포식', desc:'아군 잡아먹어 에너지 +50', m:100, g:100},
      {k:'plague', name:'역병', desc:'광역 지속 체력 감소', m:200, g:200},
      {k:'metasynaptic', name:'마나 증폭', desc:'산성충 최대 에너지 +50', m:150, g:150} ] },
  { k:'ultracavern', name:'돌격괴수 굴', ico:'🦏', m:150, g:200, req:['hive'], unlocks:['ultralisk'],   // 저거너트 해금
    research:[
      {k:'anabolic', name:'이속 강화', desc:'돌격괴수 이동속도↑', m:200, g:200},
      {k:'chitinous', name:'방어 강화', desc:'돌격괴수 방어력 +2', m:150, g:150} ] },
  { k:'nydus', name:'땅굴', ico:'🕳', m:150, g:0, req:['hive'] },
]};
TECH_TREE.aetherial={ name:'에테리얼', res:{m:'크레딧', g:'에너지'}, buildings:[
  // ── 순서: 넥서스·파일런·게이트웨이·어시밀레이터·포지·포톤캐논·사이버코어·쉴드배터리·스타게이트·플릿비콘·트리뷰널·로보·로보베이·옵저버터리·시타델·아카이브 ──
  { k:'nexus', name:'본거지', ico:'🔷', m:180, g:0, supply:9, req:[],
    produces:[{id:'worker_light', name:'생산자', m:50, g:0, pop:1}] },                // 프로브
  { k:'pylon', name:'동력탑', ico:'🔮', m:100, g:0, supply:8, req:[] },               // 동력장
  { k:'gateway', name:'지상 차원문', ico:'⛩️', m:250, g:0, req:['nexus'],
    produces:[
      {id:'blade', name:'광전사', m:100, g:0, pop:2},                                   // 질럿
      {id:'dragoon', name:'센티넬', m:125, g:50, pop:2, req:['cyber']},               // 드라군
      {id:'high_templar', name:'하이세이지', m:50, g:150, pop:2, req:['archives']},    // 하이세이지 → 보이드로 진화(TECH_MORPH)
      {id:'dark_templar', name:'다크세이지', m:125, g:100, pop:2, req:['archives']}] },  // 다크세이지 → 다크보이드로 진화(TECH_MORPH)
  { k:'assimilator', name:'융합소', ico:'🛢', m:100, g:0, gas:true, req:[] },
  { k:'forge', name:'강화소', ico:'⚒️', m:150, g:0, req:['nexus'],
    research:[
      {k:'gnd_wpn', name:'지상 무기', desc:'광전사·센티넬·보이드 +/티어', tier:[[100,100],[150,150],[200,200]]},
      {k:'gnd_arm', name:'지상 방어', desc:'지상 방어 +/티어', tier:[[100,100],[150,150],[200,200]]},
      {k:'shield', name:'실드 강화', desc:'모든 유닛 실드 +/티어', tier:[[200,200],[300,300],[400,400]]} ] },
  { k:'cannon', name:'에너지 타워', ico:'☄️', m:150, g:0, req:['forge'], detector:true },
  { k:'cyber', name:'사이버 코어', ico:'⚙️', m:200, g:0, req:['gateway'],
    research:[
      {k:'singularity', name:'사거리 강화', desc:'센티넬 사거리↑', m:150, g:150},
      {k:'air_wpn', name:'공중 무기', desc:'팔콘·요격기·모함·전함 +/티어', tier:[[100,100],[175,175],[250,250]]},
      {k:'air_arm', name:'공중 방어', desc:'공중 방어 +/티어', tier:[[150,150],[225,225],[300,300]]} ] },
  { k:'battery', name:'쉴드 충전', ico:'🔋', m:100, g:0, req:['gateway'] },
  // ── 스타게이트·공중군 ──
  { k:'stargate', name:'공중 차원문', ico:'🛸', m:150, g:150, req:['cyber'],
    produces:[
      {id:'falcon', name:'팔콘', m:150, g:100, pop:2},                                 // 커세어
      {id:'skydancer', name:'요격기', m:275, g:125, pop:3},                        // 스카웃
      {id:'archangel', name:'모함', m:350, g:250, pop:6, req:['fleet']},            // 캐리어
      {id:'kronos', name:'전함', m:100, g:350, pop:4, req:['tribunal']}] },         // 아비터
  { k:'fleet', name:'함대 관제', ico:'📡', m:300, g:200, req:['stargate'],
    research:[
      {k:'apial', name:'시야 강화', desc:'요격기 시야↑', m:100, g:100},
      {k:'gravitic_scout', name:'이속 강화', desc:'요격기 이동속도↑', m:200, g:200},
      {k:'carrier_cap', name:'요격기 증설', desc:'요격기 최대 4→8', m:100, g:100},
      {k:'disruption', name:'교란 결계', desc:'팔콘: 지상 공격 무력화 그물', m:200, g:200},
      {k:'argus_jewel', name:'마나 증폭', desc:'팔콘 최대 에너지 +50', m:100, g:100} ] },
  { k:'tribunal', name:'심판정', ico:'💎', m:200, g:150, req:['stargate','archives'],
    research:[
      {k:'recall', name:'순간이동', desc:'아군 대규모 순간이동', m:150, g:150},
      {k:'stasis', name:'빙결', desc:'범위 유닛 무적·행동불가', m:150, g:150},
      {k:'khaydarin_core', name:'마나 증폭', desc:'전함 최대 에너지 +50', m:150, g:150} ] },
  // ── 로보틱스 ──
  { k:'robo', name:'로봇 제작소', ico:'🤖', m:200, g:200, req:['cyber'],
    produces:[
      {id:'seraph', name:'수송선', m:200, g:0, pop:2},                                // 셔틀(수송)
      {id:'observer', name:'정찰기', m:25, g:75, pop:1, req:['observatory'], detector:true},  // 옵저버
      {id:'reaver', name:'공성체', m:200, g:100, pop:4, req:['robobay']}] },               // 리버(스캐럽 내부 큐)
  { k:'robobay', name:'로봇 정비소', ico:'🔧', m:150, g:100, req:['robo'],
    research:[
      {k:'gravitic_shuttle', name:'이속 강화', desc:'수송선 이동속도↑', m:200, g:200},
      {k:'reaver_cap', name:'탄약 증설', desc:'공성체 스캐럽 최대 5→10', m:200, g:200} ] },
  { k:'observatory', name:'관측소', ico:'🔭', m:50, g:100, req:['robo'],
    research:[
      {k:'gravitic_obs', name:'이속 강화', desc:'정찰기 이동속도↑', m:150, g:150},
      {k:'sensor', name:'시야 강화', desc:'정찰기 시야↑', m:150, g:150} ] },
  { k:'citadel', name:'성채', ico:'🏯', m:150, g:100, req:['cyber'],
    research:[{k:'legs', name:'이속 강화', desc:'광전사 이동속도↑ (발업)', m:150, g:150}] },
  { k:'archives', name:'기록 보관소', ico:'📚', m:150, g:200, req:['citadel'],
    research:[
      {k:'storm', name:'번개 폭풍', desc:'하이세이지 범위 번개', m:200, g:200},
      {k:'hallucination', name:'환영', desc:'가짜 유닛 생성', m:150, g:150},
      {k:'khaydarin', name:'마나 증폭', desc:'하이세이지 최대 에너지 +50', m:150, g:150},
      {k:'mindcontrol', name:'정신 지배', desc:'적 유닛 영구 탈취', m:200, g:200},
      {k:'maelstrom', name:'마비 폭풍', desc:'생체 유닛 일정시간 마비', m:100, g:100},
      {k:'argus', name:'마나 증폭', desc:'다크보이드 최대 에너지 +50', m:150, g:150} ] },
]};
// ═══════════════════════════════════════════════════════════════════════════════
// 🐺 페럴(수인) — RACES.md §2 건물표를 코드로 확정 (2026-08-20)
//   정체성: 단거리 고기동 교전자. 고유 메커니즘 「광폭화」(처치마다 팩 전체 공속·이속↑).
//   ⚠ 광폭화 로직은 **아직 없다** — 광폭 코어 연구 항목만 자리를 잡아 둔다.
//   ⚠ 건물 비용은 RACES.md 의 m/g 를 그대로 옮겼다(초반 정렬로 조정된 값 포함: 뼈 무덤 110·사냥 우리 190·발톱 구덩이 175).
//   생산 구조는 **유니온식**(건물마다 자기 유닛을 뽑는다) — 스웜의 '본진 집중 생산'이 아니다.
TECH_TREE.feral={ name:'페럴', res:{m:'크레딧', g:'에너지'}, buildings:[
  // ── 기본·자원 ──
  { k:'denrock', name:'둥지 바위', ico:'🪨', m:180, g:0, supply:10, req:[],
    produces:[{id:'worker_feral', name:'채집수', m:50, g:0, pop:1}] },
  { k:'bonepile', name:'뼈 무덤', ico:'🦴', m:110, g:0, supply:8, req:['denrock'],
    produces:[{id:'wolfrunner', name:'추격수', m:50, g:0, pop:1}] },
  { k:'gasmaw', name:'수액 아귀', ico:'🫗', m:75, g:0, gas:true, req:['denrock'] },
  // ── 생산 ──
  { k:'huntpen', name:'사냥 우리', ico:'🏕', m:190, g:0, req:['denrock'],
    produces:[{id:'thornspitter', name:'가시 사수', m:75, g:0, pop:1}] },
  { k:'clawpit', name:'발톱 구덩이', ico:'🕳', m:175, g:0, req:['bonepile'],
    produces:[{id:'clawfighter', name:'포식수', m:75, g:25, pop:1}] },
  { k:'spitpit', name:'투척 구덩이', ico:'🪃', m:125, g:50, req:['huntpen'],
    produces:[
      {id:'howlslinger', name:'대공 투석수', m:75, g:25, pop:1},
      {id:'venomfang', name:'맹독수', m:100, g:75, pop:2, req:['frenzycore']}] },
  { k:'alphaden', name:'알파 소굴', ico:'🐺', m:200, g:100, req:['clawpit'],
    produces:[
      {id:'hornedcharger', name:'돌진수', m:100, g:25, pop:2},
      {id:'stalkercat', name:'암살수', m:125, g:50, pop:2},
      {id:'alphawolf', name:'우두머리', m:200, g:150, pop:4, req:['frenzycore']}] },
  { k:'shamanhut', name:'샤먼 오두막', ico:'🔮', m:150, g:100, req:['huntpen'],
    produces:[
      {id:'packshaman', name:'주술사', m:100, g:100, pop:2},
      {id:'hawkeye', name:'정찰조', m:75, g:75, pop:1, detector:true}],
    research:[
      {k:'bloodhowl', name:'혈의 포효', desc:'팩 전체 공격속도 +30%(일시)', m:150, g:150},
      {k:'huntstart', name:'사냥 개시', desc:'광폭화 감쇠 정지', m:200, g:200, req:['beastpit']} ] },
  { k:'windcliff', name:'바람 절벽', ico:'🪶', m:150, g:100, req:['alphaden'],
    produces:[
      {id:'windcarrier', name:'수송조', m:100, g:100, pop:2},
      {id:'wyvernrider', name:'폭격 기수', m:150, g:100, pop:3},
      {id:'skytalon', name:'하늘 사냥수', m:125, g:125, pop:2}] },
  { k:'beastpit', name:'야수 구덩이', ico:'🦁', m:200, g:200, req:['windcliff'],
    produces:[
      {id:'stormroc', name:'뇌격수', m:250, g:200, pop:6},
      {id:'primalbeast', name:'원시 군주', m:400, g:300, pop:8}],
    research:[{k:'leapstrike', name:'도약 강습', desc:'근접 유닛 도약 이동', m:200, g:200}] },
  // ── 업그레이드·보조·방어 ──
  { k:'bloodaltar', name:'혈흔 제단', ico:'🩸', m:125, g:0, req:['denrock'],
    research:[
      {k:'fer_melee_atk', name:'근접 공격력', desc:'추격수·포식수·우두머리 등 +/티어', tier:[[100,100],[150,150],[200,200]]},
      {k:'fer_range_atk', name:'원거리 공격력', desc:'가시 사수·대공 투석수 등 +/티어', tier:[[100,100],[150,150],[200,200]]},
      {k:'fer_gnd_def', name:'지상 방어력', desc:'모든 지상 +/티어', tier:[[150,150],[225,225],[300,300]]} ] },
  { k:'frenzycore', name:'광폭 코어', ico:'💢', m:150, g:100, req:['clawpit'],
    research:[
      {k:'frenzy_cap', name:'광폭화 상한', desc:'스택 상한 20→30', m:150, g:150},
      {k:'frenzy_gain', name:'광폭화 획득', desc:'처치당 스택 +2', m:200, g:200},
      {k:'frenzy_hold', name:'감쇠 지연', desc:'전투 이탈 후 유지 시간↑', m:150, g:150} ] },
  { k:'totem', name:'뼈 토템', ico:'🗿', m:75, g:0, req:['bonepile'] },
  { k:'thornburrow', name:'가시 굴', ico:'🌵', m:75, g:0, req:['clawpit'] },
  { k:'scentden', name:'후각 소굴', ico:'👃', m:100, g:50, req:['huntpen'], detector:true },
]};
// ═══════════════════════════════════════════════════════════════════════════════
// 🗿 콜로서스(거신) — RACES.md §3 건물표를 코드로 확정 (2026-08-20)
//   정체성: 초장사정 + 전개. 붙으면 무력(최소 사거리).
//   ⚠ deploy·minRange 로직은 **아직 없다** — U 에 필드만 확정해 뒀고 여기선 연구 항목으로만 잡는다.
TECH_TREE.colossus={ name:'콜로서스', res:{m:'크레딧', g:'에너지'}, buildings:[
  // ── 기본·자원 ──
  { k:'corefoundry', name:'코어 파운드리', ico:'🏭', m:180, g:0, supply:10, req:[],
    produces:[{id:'worker_col', name:'조립 드론', m:50, g:0, pop:1}] },
  { k:'strut', name:'지지 기둥', ico:'🏗', m:85, g:0, supply:8, req:['corefoundry'],
    produces:[{id:'gunner', name:'포대병', m:50, g:0, pop:1}] },
  { k:'gasrig', name:'가스 시추탑', ico:'🛢', m:100, g:0, gas:true, req:['corefoundry'] },
  // ── 생산 ──
  { k:'assembly', name:'조립 공장', ico:'⚙️', m:125, g:0, req:['corefoundry'],
    produces:[{id:'guardwalker', name:'가드 워커', m:75, g:25, pop:2}] },
  { k:'flakworks', name:'대공 공작소', ico:'🎆', m:125, g:75, req:['assembly'],
    produces:[
      {id:'flakbattery', name:'플랙 배터리', m:100, g:50, pop:2},
      {id:'arclight', name:'아크 라이트', m:125, g:100, pop:2, req:['skydock']}] },
  { k:'heavyyard', name:'중장비 야드', ico:'🛠', m:250, g:150, req:['ballistics'],
    produces:[
      {id:'railgun', name:'레일건 플랫폼', m:150, g:150, pop:3},
      {id:'siegecolossus', name:'시즈 콜로서스', m:250, g:200, pop:5}] },
  { k:'stasislab', name:'정지장 연구소', ico:'🧊', m:150, g:150, req:['assembly'],
    produces:[{id:'stasistech', name:'정지장 기술자', m:100, g:100, pop:2}],
    research:[
      {k:'stasisfield', name:'정지장', desc:'적 일정 시간 정지(무적)', m:150, g:150},
      {k:'guardshield', name:'수호 보호막', desc:'아군에 보호막 부여', m:200, g:200} ] },
  { k:'skydock', name:'상공 도크', ico:'🛰', m:150, g:100, req:['assembly'],
    produces:[
      {id:'spotterdrone', name:'관측 드론', m:75, g:50, pop:1, detector:true},
      {id:'supplylifter', name:'보급 비행정', m:100, g:100, pop:2},
      {id:'skylance', name:'스카이 랜스', m:200, g:150, pop:4, req:['heavyyard']}] },
  { k:'orbitallink', name:'궤도 링크', ico:'📡', m:250, g:250, req:['heavyyard'],
    produces:[
      {id:'orbitalanchor', name:'궤도 앵커', m:250, g:250, pop:6},
      {id:'worldbreaker', name:'월드 브레이커', m:400, g:350, pop:8}],
    research:[{k:'orbitaldrop', name:'궤도 낙하', desc:'지정 지점 궤도 폭격', m:200, g:200}] },
  // ── 업그레이드·보조·방어 ──
  { k:'ballistics', name:'탄도 연구소', ico:'📐', m:150, g:0, req:['strut'],
    produces:[{id:'twincannon', name:'트윈 캐논', m:125, g:50, pop:2}],
    research:[
      {k:'longbarrel', name:'사거리 강화', desc:'포격 유닛 사거리 +5%/티어', tier:[[100,100],[150,150],[200,200]]},
      {k:'minrange_cut', name:'근접 조준', desc:'최소 사거리 −30%', m:150, g:150} ] },
  { k:'armorworks', name:'장갑 공작소', ico:'🛡', m:125, g:0, req:['corefoundry'],
    research:[
      {k:'col_atk', name:'공격력', desc:'모든 유닛 +/티어', tier:[[100,100],[175,175],[250,250]]},
      {k:'col_def', name:'방어력', desc:'모든 유닛 +/티어', tier:[[150,150],[225,225],[300,300]]} ] },
  { k:'servobay', name:'기동 정비소', ico:'🔧', m:100, g:50, req:['assembly'],
    research:[
      {k:'servo_spd', name:'구동계 강화', desc:'이동속도 +15%', m:150, g:150},
      {k:'fastdeploy', name:'긴급 전개', desc:'전개 시간 −50%', m:200, g:200},
      {k:'redeploy', name:'전술 재배치', desc:'단거리 순간이동', m:200, g:200, req:['orbitallink']} ] },
  { k:'watchtower', name:'관측탑', ico:'🗼', m:75, g:0, req:['corefoundry'], detector:true },
  { k:'bastion', name:'요새 포탑', ico:'🏰', m:125, g:0, req:['ballistics'] },
]};
// ══ 테크트리 상세 스펙(SC1 기반, B안=실제 수치) — 건물{hp,ar,size,t(초)} / 유닛{hp,ar,sh,atk,at(공격형),rng,spd,t,abil} ══
//   at: norm(일반형)·conc(진동형)·expl(폭발형)·'-'(무공격)
const TECH_SPEC={};
TECH_SPEC.union={
  bldg:{ command:{hp:1500,ar:1,size:[4,3],t:120}, comsat:{hp:500,ar:1,t:40}, nuke:{hp:600,ar:1,t:40},
    supply:{hp:500,ar:1,size:[3,2],t:40}, refinery:{hp:750,ar:1,size:[4,2],t:40},
    barracks:{hp:1000,ar:1,size:[4,3],t:80}, engbay:{hp:850,ar:1,size:[4,3],t:60}, academy:{hp:600,ar:1,size:[3,2],t:80},
    bunker:{hp:350,ar:1,size:[3,2],t:30}, turret:{hp:200,ar:0,size:[2,2],t:30},
    factory:{hp:1250,ar:1,size:[4,3],t:80}, machshop:{hp:750,ar:1,t:40},
    starport:{hp:1300,ar:1,size:[4,3],t:70}, control:{hp:500,ar:1,t:40}, armory:{hp:750,ar:1,size:[3,2],t:80},
    scifac:{hp:850,ar:1,size:[4,3],t:60}, covert:{hp:750,ar:1,t:40}, physics:{hp:600,ar:1,t:40} },
  unit:{
    worker_human:{hp:60,ar:0,sh:0,atk:5,at:'norm',rng:1,t:20,abil:'수리'},
    marine:{hp:40,ar:0,sh:0,atk:6,at:'norm',rng:4,t:24,abil:'스팀팩'},
    machinegun:{hp:50,ar:1,sh:0,atk:16,at:'conc',rng:2,t:24,abil:'스팀팩·스플래시'},
    medic:{hp:60,ar:1,sh:0,atk:0,at:'-',rng:0,t:30,abil:'힐·플레어·리스토레이션'},
    ghost:{hp:45,ar:0,sh:0,atk:10,at:'conc',rng:7,t:50,abil:'핵·클로킹·락다운'},
    racer:{hp:80,ar:0,sh:0,atk:20,at:'conc',rng:5,t:30,abil:'스파이더 마인'},
    tank:{hp:150,ar:1,sh:0,atk:30,at:'expl',rng:7,t:50,abil:'시즈 85·스플·사거리12'},
    goliath:{hp:125,ar:1,sh:0,atk:12,at:'norm',rng:5,t:40,abil:'대공 20(폭발)·사거리→8'},
    skyguard:{hp:120,ar:0,sh:0,atk:20,at:'expl',rng:5,t:60,abil:'클로킹'},
    pelican:{hp:150,ar:1,sh:0,atk:0,at:'-',rng:0,t:50,abil:'수송'},
    hellfire:{hp:200,ar:2,sh:0,atk:48,at:'expl',rng:6,t:50,abil:'공중전용 스플래시'},
    aegis:{hp:200,ar:1,sh:0,atk:0,at:'-',rng:0,t:80,abil:'디텍터·매트릭스·EMP·이레디에이트'},
    dreadnought:{hp:500,ar:3,sh:0,atk:25,at:'norm',rng:6,t:133,abil:'야마토 260'},
    nuke:{hp:0,ar:0,sh:0,atk:0,at:'-',rng:0,t:75,abil:'핵미사일'} }
};
TECH_SPEC.swarm={   // 저그: 건물 자동재생·유닛 자동재생(점막), 실드 없음
  bldg:{ hatchery:{hp:1250,ar:1,size:[4,3],t:100}, extractor:{hp:750,ar:1,size:[4,2],t:40},
    pool:{hp:750,ar:1,size:[3,2],t:80}, evochamber:{hp:750,ar:1,size:[3,2],t:40}, hydraden:{hp:850,ar:1,size:[3,2],t:40},
    creep:{hp:400,ar:1,size:[2,2],t:20}, sunken:{hp:300,ar:1,size:[2,2],t:20,atk:40}, spore:{hp:400,ar:1,size:[2,2],t:20,atk:15},
    lair:{hp:1800,ar:1,size:[4,3],t:60}, spire:{hp:600,ar:1,size:[2,2],t:120}, queensnest:{hp:850,ar:1,size:[3,2],t:60},
    hive:{hp:2500,ar:1,size:[4,3],t:70}, gspire:{hp:1000,ar:1,size:[2,2],t:60}, defilermound:{hp:850,ar:1,size:[3,2],t:60},
    ultracavern:{hp:600,ar:1,size:[3,2],t:80}, nydus:{hp:250,ar:1,size:[2,2],t:40} },
  unit:{
    worker_swarm:{hp:40,ar:0,sh:0,atk:5,at:'norm',rng:1,t:20,abil:'건물 변태'},
    overlord:{hp:200,ar:0,sh:0,atk:0,at:'-',rng:0,t:40,abil:'디텍터·수송(연구)'},
    snapper:{hp:35,ar:0,sh:0,atk:5,at:'norm',rng:1,t:28,abil:'2기 생산·발업·아드레날린'},
    hydra:{hp:80,ar:0,sh:0,atk:10,at:'expl',rng:4,t:28,abil:'사거리+1·럴커 변태'},
    thornqueen:{hp:125,ar:1,sh:0,atk:20,at:'norm',rng:6,t:40,abil:'버로우 공격·일직선 스플'},
    wyvern:{hp:120,ar:0,sh:0,atk:9,at:'norm',rng:3,t:40,abil:'바운스 9-3-1'},
    stinger:{hp:25,ar:0,sh:0,atk:110,at:'norm',rng:1,t:28,abil:'2기 생산·공중전용 자폭'},
    medusa:{hp:120,ar:0,sh:0,atk:0,at:'-',rng:0,t:50,abil:'패러사이트·브루들링·인스네어'},
    defiler:{hp:80,ar:1,sh:0,atk:0,at:'-',rng:0,t:50,abil:'다크 스웜·플레이그·컨슘'},   // 디파일러(오염술사) — 임시
    venom:{hp:250,ar:2,sh:0,atk:25,at:'expl',rng:6,t:40,abil:'공중전용 포자 디버프(디바우러)'},
    behemoth:{hp:150,ar:2,sh:0,atk:20,at:'norm',rng:8,t:40,abil:'지상 전용 폭격'},
    ultralisk:{hp:400,ar:1,sh:0,atk:20,at:'norm',rng:1,t:60,abil:'방업 시 방어+2'},
    broodling:{hp:30,ar:0,sh:0,atk:6,at:'norm',rng:1,t:20,abil:'브루들링(일정시간 후 소멸)'} }
};
TECH_SPEC.aetherial={   // 프로토스: 건물·유닛 실드 자동재생(기본 방어 0, 건물 방어 1)
  bldg:{ nexus:{hp:750,sh:750,ar:1,size:[4,3],t:120}, pylon:{hp:300,sh:300,ar:1,size:[2,2],t:30}, assimilator:{hp:450,sh:450,ar:1,size:[4,2],t:40},
    forge:{hp:550,sh:550,ar:1,size:[3,3],t:40}, cannon:{hp:100,sh:100,ar:1,size:[2,2],t:50,atk:20},
    gateway:{hp:500,sh:500,ar:1,size:[4,3],t:60}, battery:{hp:200,sh:200,ar:1,size:[2,2],t:30}, cyber:{hp:500,sh:500,ar:1,size:[3,3],t:60},
    citadel:{hp:450,sh:450,ar:1,size:[3,3],t:60}, archives:{hp:500,sh:500,ar:1,size:[3,3],t:60},
    robo:{hp:500,sh:500,ar:1,size:[3,3],t:80}, robobay:{hp:450,sh:450,ar:1,size:[3,3],t:30}, observatory:{hp:250,sh:250,ar:1,size:[3,2],t:30},
    stargate:{hp:600,sh:600,ar:1,size:[4,3],t:70}, fleet:{hp:500,sh:500,ar:1,size:[3,3],t:60}, tribunal:{hp:500,sh:500,ar:1,size:[3,3],t:60} },
  unit:{
    worker_light:{hp:20,ar:0,sh:20,atk:5,at:'norm',rng:1,t:20,abil:'건물 소환'},
    blade:{hp:100,ar:1,sh:60,atk:16,at:'norm',rng:1,t:40,abil:'발업(다리 강화)'},
    dragoon:{hp:100,ar:1,sh:80,atk:20,at:'expl',rng:4,t:50,abil:'사거리 4→6'},
    high_templar:{hp:40,ar:0,sh:40,atk:0,at:'-',rng:0,t:50,abil:'아칸 합체·스톰·할루시네이션'},
    dark_templar:{hp:80,ar:1,sh:40,atk:40,at:'norm',rng:1,t:50,abil:'영구 은신·다크아칸 합체'},
    seraph:{hp:80,ar:1,sh:60,atk:0,at:'-',rng:0,t:60,abil:'수송·속업'},
    observer:{hp:40,ar:0,sh:20,atk:0,at:'-',rng:0,t:40,abil:'디텍터·영구 은신'},
    skydancer:{hp:120,ar:1,sh:80,atk:5,at:'expl',rng:5,t:40,abil:'공중전용 스플·디스럽션 웹(커세어)'},
    falcon:{hp:150,ar:0,sh:100,atk:8,at:'norm',rng:4,t:80,abil:'지8·대공 28(폭발)·속업(스카웃)'},
    archangel:{hp:300,ar:4,sh:150,atk:6,at:'norm',rng:8,t:140,abil:'인터셉터 최대 8기'},
    kronos:{hp:200,ar:1,sh:150,atk:10,at:'expl',rng:5,t:160,abil:'클로킹 필드·리콜·스테이시스'},
    archon:{hp:10,ar:0,sh:350,atk:30,at:'norm',rng:2,t:20,abil:'하이세이지 2 융합·스플'},
    dark_archon:{hp:25,ar:0,sh:200,atk:0,at:'-',rng:0,t:20,abil:'마인드 컨트롤·메일스트롬·피드백'},   // 다크보이드(다크아칸) — 무공격 마법 · 임시 스탯
    reaver:{hp:100,ar:0,sh:80,atk:100,at:'norm',rng:8,t:70,abil:'스캐럽 최대 10기'},   // 리버
    larva:{hp:100,ar:0,sh:80,atk:100,at:'norm',rng:8,t:70,abil:'스캐럽 100→125·스플'} }
};
// 🐺 페럴 — 유기체 진지. 건물 체력은 유니온 대비 −15%(가벼운 대신 싸다)이고 방어는 0~1.
//   ⚠ unit 표는 비워 둔다 — techUnitSpec 이 U 에서 합성한다(수치 이중관리 금지).
//   ⚠ bldg 를 비우면 프로필 머리줄에 HP 대신 설명이 들어가 두 줄로 감긴다(스모크가 40px 규약으로 잡는다).
TECH_SPEC.feral={
  bldg:{ denrock:{hp:1300,ar:1,size:[4,3],t:110}, bonepile:{hp:450,ar:0,size:[3,2],t:35}, gasmaw:{hp:650,ar:1,size:[4,2],t:40},
    huntpen:{hp:900,ar:1,size:[4,3],t:70}, clawpit:{hp:850,ar:1,size:[3,2],t:60}, spitpit:{hp:800,ar:1,size:[3,2],t:50},
    alphaden:{hp:1000,ar:1,size:[4,3],t:80}, shamanhut:{hp:700,ar:0,size:[3,2],t:60}, windcliff:{hp:900,ar:1,size:[4,3],t:70},
    beastpit:{hp:1200,ar:2,size:[4,3],t:90},
    bloodaltar:{hp:750,ar:1,size:[3,2],t:50}, frenzycore:{hp:800,ar:1,size:[3,2],t:60},
    totem:{hp:300,ar:0,size:[2,2],t:25}, thornburrow:{hp:350,ar:1,size:[2,2],t:25,atk:30}, scentden:{hp:400,ar:0,size:[2,2],t:30} },
  unit:{}
};
// 🗿 콜로서스 — 기계 요새. 건물 체력이 전 종족 최고(+15%)이고 방어 2가 기본. 대신 비싸고 느리다.
TECH_SPEC.colossus={
  bldg:{ corefoundry:{hp:1700,ar:2,size:[4,3],t:130}, strut:{hp:550,ar:2,size:[3,2],t:40}, gasrig:{hp:850,ar:2,size:[4,2],t:45},
    assembly:{hp:1200,ar:2,size:[4,3],t:75}, flakworks:{hp:950,ar:2,size:[3,2],t:60}, heavyyard:{hp:1450,ar:2,size:[4,3],t:95},
    stasislab:{hp:900,ar:1,size:[3,2],t:70}, skydock:{hp:1100,ar:2,size:[4,3],t:70}, orbitallink:{hp:1500,ar:2,size:[4,3],t:100},
    ballistics:{hp:950,ar:2,size:[3,2],t:60}, armorworks:{hp:900,ar:2,size:[3,2],t:55}, servobay:{hp:800,ar:2,size:[3,2],t:50},
    watchtower:{hp:400,ar:1,size:[2,2],t:30}, bastion:{hp:450,ar:2,size:[2,2],t:35,atk:45} },
  unit:{}
};
function techUnitSpec(race,id){ const s=TECH_SPEC[race]; const cur=(s&&s.unit&&s.unit[id]);
  const b=(typeof Udef==='function')?Udef(id):(typeof U!=='undefined'?U[id]:null);
  const _sb=(typeof G!=='undefined'&&G.sandbox&&!G.strike);
  const _tiles=(v)=>(v>0?Math.round(v/((typeof SB_ANCHOR_RANGE!=='undefined')?SB_ANCHOR_RANGE:0.035)):0);   // 내부 사거리 → SC 타일(메인 배너·base_stats와 동일 환산)
  if(cur){ if(_sb && b) return Object.assign({}, cur, { hp:b.hp||0, sh:b.shield||0, ar:b.armor||0, atk:b.dmg||0, rng:_tiles(b.range) });   // 관리자: 전투 수치(체력·실드·방어·공격·사거리)는 base_stats 단일 출처로 덮어씀 — 능력·빌드시간·공격타입 등 카드 전용 메타만 유지(수치 이중관리·드리프트 방지)
    return cur; }
  if(!b) return null;   // 커스텀·신규 로스터 유닛: 공용 U/Udef에서 합성(별도 표 없어도 표시 통일)
  return { hp:b.hp||0, ar:b.armor||0, sh:b.shield||0, atk:b.dmg||0, at:'norm', rng:_tiles(b.range),  t:15, abil:'' }; }
function techBldgSpec(race,k){ const s=TECH_SPEC[race]; return (s&&s.bldg&&s.bldg[k])||null; }
// ── 테크트리 → 커맨드 그리드 모델 어댑터(재사용) ──
function techGetBldg(race,k){ const t=TECH_TREE[race]; return t&&t.buildings.find(b=>b.k===k); }
// 🏭 건물 → 전장으로 배출하는 유닛. 건물 1채 = 유닛 1종, 출격 주기마다 1기씩 무료 배출(건물 수가 곧 생산력).
//   배치 기준: 건물 누적비용(선행 포함)이 오를수록 강한 유닛. 전투력 지표 pow = DPS × √유효체력 ÷ 10.
//   제외: 비행충(pow 412 — 곡선 이탈) · 저격수(pow 10) · 지원 정찰기(공격력 0) 등 자동 배출에 부적합한 유닛.
//   마릿수(n)는 '건물당 웨이브 기여도 ≈ TECH_WAVE_POW'가 되도록 산정 — 싼 건물은 여러 기, 고급 건물은 소수 정예.
//   기여도 = pow × n. pow는 실측값(주석)이며, 상한 8기(3D 성능)·하한 1기.
//   ⚠ 실제 배출량 = n × TECH_WAVE_MUL. 전투 규모를 키울 땐 개별 n이 아니라 이 배수를 올린다 —
//     한 건물만 올리면 그 건물이 최적해가 되어 조합이 붕괴한다(같은 비율로 커져야 건물 간 서열이 유지됨).
const TECH_WAVE_POW=47;   // 웨이브 20초 기준(30초 시절 70 → 2/3)
const TECH_WAVE_MUL=2;    // 전역 배출 배수. 2 = 보급소 레인저 6 · 병영 화력병 4 · 훈련소 의무병 2
const STK_BLDG_LOCK={ bunker:1, turret:1, thornburrow:1, bastion:1 };   // 🔒 오토배틀에서만 건설 불가(방어 건물 — 담당 유닛 없음). 관리자 건설 목록은 그대로.
const TECH_BLDG_UNIT={
  union:{      // 부속(관제탑·특수작전실·화력연구소)도 배출원 · 정비소는 공성전차 업그레이드 전용이라 제외
    supply:{u:'marine', n:3},         // 보급소 100 · pow 19 → 57
    barracks:{u:'machinegun', n:2},   // 병영 150 · pow 22 → 44
    academy:{u:'medic', n:1},         // 훈련소 150 · 무공격 치유 지원(바이오닉 회복)
    engbay:{u:'racer', n:2},          // 공학소 125 · pow 24 → 48
    factory:{u:'tank', n:1},          // 기갑공장 300 · pow 51 → 51
    armory:{u:'goliath', n:1},        // 무기고 150 · pow 43 → 43
    starport:{u:'skyguard', n:1},     // 비행장 250 · pow 83 → 83
    control:{u:'hellfire', n:1},      // 부속 100 · pow 44 → 44
    scifac:{u:'aegis', n:1},          // 연구소 250 · 공중 방벽(초고체력 저공격)
    covert:{u:'ghost', n:2},          // 부속 100 · pow 10 → 20 (무력화 스킬은 마법 시스템 미구현)
    physics:{u:'dreadnought', n:1} }, // 부속 100 · pow 68 → 68
  swarm:{
    pool:{u:'snapper', n:3},          // 500 · pow 17 → 68
    hydraden:{u:'hydra', n:2},        // 650 · pow 22 → 66
    queensnest:{u:'thornqueen', n:1}, // 1050 · pow 33 → 66
    spire:{u:'stinger', n:1},         // 1100 · pow 29 → 58
    defilermound:{u:'medusa', n:1},   // 1600 · pow 62 → 62
    ultracavern:{u:'ultralisk', n:1}, // 1750 · pow 136 → 136 (최종 테크 — 곡선 위)
    gspire:{u:'behemoth', n:1} },     // 2000 · pow 277 → 277 (최종 테크 — 곡선 위)
  aetherial:{
    gateway:{u:'dragoon', n:2},       // 550 · pow 25 → 75
    cyber:{u:'falcon', n:1},          // 750 · pow 38 → 76
    citadel:{u:'blade', n:1},         // 1000 · pow 52 → 52
    stargate:{u:'skydancer', n:1},    // 1050 · pow 55 → 55
    robo:{u:'archon', n:1},           // 1150 · pow 47 → 94
    archives:{u:'dark_templar', n:1}, // 1350 · pow 65 → 65
    fleet:{u:'archangel', n:1} },     // 1550 · pow 77 → 77
  // 🐺 페럴 — 최단 사거리·최고 기동. 위와 같은 규칙(pow=DPS×√체력÷10, 기여도 pow×n ≈ TECH_WAVE_POW)
  feral:{
    bonepile:{u:'wolfrunner',   n:3},   // 뼈 무덤 110 · pow 21 → 63
    spitpit:{u:'venomfang',     n:2},   // 투척 구덩이 185 · pow 29 → 58 · ⚠ 페럴의 첫 대공 — 다른 네 종족은 전부 첫 두 건물에 대공이 있다. 여기가 밀리면 공중 유닛에 일방적으로 진다
    huntpen:{u:'thornspitter',  n:2},   // 사냥 우리 190 · pow 17 → 34   (대공 투석수=대공 전용이라 지상전에서 무력 → 배출은 지상+공중인 맹독수이 맡는다)
    clawpit:{u:'clawfighter',   n:2},   // 발톱 구덩이 175 · pow 33 → 66
    alphaden:{u:'alphawolf',    n:1},   // 알파 소굴 320 · pow 80 → 80
    windcliff:{u:'wyvernrider', n:1},   // 바람 절벽 270 · pow 105 → 105
    beastpit:{u:'stormroc',     n:1} }, // 야수 구덩이 440 · pow 132 → 132 (최종 테크 — 곡선 위)
  // 🗿 콜로서스 — 최장 사거리·전개. 소수정예(SPAWN 0.75)라 같은 n이라도 실제 배출은 적다
  colossus:{
    strut:{u:'gunner',          n:3},   // 지지 기둥 85 · pow 26 → 78
    assembly:{u:'guardwalker',  n:2},   // 조립 공장 125 · pow 45 → 90
    ballistics:{u:'twincannon', n:1},   // 탄도 연구소 150 · pow 51 → 51
    flakworks:{u:'flakbattery', n:1},   // 대공 공작소 215 · pow 81 → 81
    skydock:{u:'skylance',      n:1},   // 상공 도크 270 · pow 122 → 122
    heavyyard:{u:'siegecolossus',n:1} } };   // 중장비 야드 430 · pow 125 → 125
function _techBU(race,bk){ return (TECH_BLDG_UNIT[race]||{})[bk]||null; }
function techBldgUnit(race, bk){ const e=_techBU(race,bk);
  return (e && typeof STK_UNITS!=='undefined' && STK_UNITS[e.u]) ? e.u : null; }
// 종족 평준화: 건물당 배출 수를 종족별로 스케일 — 유니온 기준(1.0) · 에테리얼 소수정예(2/3) · 스웜 물량(1.5배)
const STK_RACE_SPAWN={ union:1, aetherial:0.85, swarm:1.25, feral:1.10, colossus:0.75 };   // 종족 배출 수 배수(완화) — 스웜=다수/에테리얼=소수 정체성. 스탯 배율(STK_RACE_STAT)이 이 수 차이를 상쇄해 army 밸런스 ~50%.
function techBldgCount(race, bk){ const e=_techBU(race,bk); const rm=(STK_RACE_SPAWN[race]||1); return Math.max(1, Math.round(((e&&e.n)||1)*TECH_WAVE_MUL*rm)); }
// 기본 공통 자료(data/base_stats.md) — SC 원본 공격 쿨다운 프레임(cd, 작을수록 빠름·24f=1s) / 이동 픽셀(mv, 클수록 빠름). 게임 id 기준.
const BASE_CD={  // 0=공격 없음(수송·시전·자폭 등)
  worker_human:15, marine:15, machinegun:22, medic:0, ghost:22, racer:30, tank:37, goliath:22, skyguard:22, pelican:0, hellfire:64, aegis:0, dreadnought:30,
  worker_swarm:22, overlord:0, snapper:8, hydra:15, thornqueen:37, wyvern:30, stinger:0, medusa:0, defiler:0, ultralisk:15, behemoth:30, venom:100,
  worker_light:22, blade:22, dragoon:30, high_templar:0, dark_templar:30, archon:30, dark_archon:0, seraph:0, larva:60, observer:0, falcon:22, skydancer:8, archangel:30, kronos:45 };
// 유닛 직책/이름/스탯(유닛·일꾼 패널 헤더+왼쪽) — 일꾼=생산자, 그 외 UNIT_CLS 병과
function _techRoleOf(uid){ if(uid==='worker_human'||uid==='worker_swarm'||uid==='worker_light') return '생산자'; return (typeof UNIT_CLS!=='undefined'&&UNIT_CLS[uid])||''; }
function _techRealName(race,uid){ if(typeof _rosterName==='function'){ const rn=_rosterName(uid); if(rn && rn!==uid) return rn; }   // 공용 로스터 이름 우선(키만 되돌아오면=미등록 → 트리 이름 사용)
  const bs=(TECH_TREE[race]||{}).buildings||[]; for(const b of bs){ for(const p of (b.produces||[])){ if(p.id===uid) return p.name||uid; } } return uid; }
// 건설 테크트리에 공용 로스터의 모든 유닛이 생산 가능하도록 보정 — 트리에 없는 유닛은 주 생산 건물에 자동 추가(로스터에 유닛 넣으면 건설에도 자동 반영, 향후 구역도 동일 원칙)
function _techEnsureRoster(race){ const t=TECH_TREE[race]; if(!t||t._rosterSynced) return; t._rosterSynced=true;
  const roster=(typeof RACE_ROSTER!=='undefined'&&RACE_ROSTER[race])||[]; if(!roster.length) return;
  const have=new Set(); for(const b of t.buildings) for(const p of (b.produces||[])) have.add(p.id);
  let main=null,mx=-1; for(const b of t.buildings){ const n=(b.produces||[]).length; if(n>mx){ mx=n; main=b; } }   // 유닛을 가장 많이 뽑는 건물 = 주 생산 건물
  if(!main) return; main.produces=main.produces||[];
  for(const r of roster){ const key=r.key; if(!key||have.has(key)||/^worker/.test(key)||key==='broodling'||key==='larva') continue;   // 일꾼·스웜링(브루들링=메두사 소환 전용)·라바(리버 중복 키)는 자동 생산 제외
    if(typeof TECH_MORPH!=='undefined' && Object.keys(TECH_MORPH).some(src=>TECH_MORPH[src].some(m=>m.to===key))) continue;   // 🧬 2차 변태 전용 유닛(베놈퀸·베놈·베히모스)은 직접 생산 제외
    const u=(typeof U!=='undefined'&&U[key])||{}; main.produces.push({id:key, name:r.n, m:(u.cost||50), g:0, pop:1}); have.add(key); } }
function _techUnitStatList(spec,uid,ent){ const _spd=(spec.atk&&(typeof _sbBaseCd==='function'))?((1/_sbBaseCd(uid)).toFixed(1)+'/s'):'-';   // 공격속도 = base_stats 공속(/s) — 메인 배너와 동일 표시
  const out=[['공격력', spec.atk?(''+spec.atk):'무공격'], ['사거리', spec.rng!=null?(''+spec.rng):'-'], ['공격속도', _spd], ['처치','0']];
  const me=(ent&&ent.maxEn>0)?ent.maxEn:((typeof U!=='undefined'&&U[uid]&&U[uid].energy)||0);   // 🔮 마나 = 머리줄이 아니라 여기(왼쪽 정보 구역)
  if(me>0) out.push(['마나', Math.round((ent&&ent.en!=null)?ent.en:me)+'/'+Math.round(me)]);
  return out; }
function _techUnitPortrait(id){ return (typeof unitPortraitHTML==='function'&&unitPortraitHTML(id))||pIco('🔧'); }
// 🏢 건물 초상 = 그 건물의 실제 3D 모델 렌더 이미지(M3D.bldgImage — key별 1회 캐시, 준비되면 techUIRender로 자동 갱신).
// 유닛 초상(_techUnitPortrait)과 동일한 portImg 규격 · 모델 없음/미로드/3D 끔 = 기존 이모지 폴백
// 🎨 생성 아이콘 연결 — 파일명이 키와 1:1이라 경로만 만들면 된다. 없는 키는 기존 표시로 자동 폴백.
const ICO_DIR='assets/icons/';
function _icoImg(sub, key, fb){ return '<img class="icoImg" src="'+ICO_DIR+sub+'/'+key+'.webp" alt="" draggable="false" data-fb="'+(fb||'\u{1F527}')+'" onerror="_icoFail(this)">'; }
// 상태 표시 아이콘(state/) — 잠김·환생처럼 '재화도 스킬도 아닌' 것. 파일이 없으면 **원래 이모지 글자**로 돌아간다
//   (`pIco` 표에 없는 이모지가 많아 공용 폴백을 쓰면 스패너가 뜬다).
function stIco(key, fb){ return '<img class="stIco" src="'+ICO_DIR+'state/st_'+key+'.webp" alt="" draggable="false"'
  +' data-fb="'+(fb||'')+'" onerror="this.outerHTML=this.getAttribute(\'data-fb\')||\'\'">'; }
// 아이콘 파일이 없으면(404) 빈칸이 남던 것 → 공용 라인SVG로 교체. 새 아이콘을 넣기 전에도 자리가 비지 않는다(단일 소스: pIco 재사용)
function _icoFail(im){ try{ const c=im.getAttribute('data-fbcls'); im.outerHTML=pIco(im.getAttribute('data-fb')||'\u{1F527}', c==null?'icoFb':c); }catch(_e){ try{ im.remove(); }catch(_e2){} } }
// 연구 73종 → 아이콘 23종. 효과가 같은 것끼리 하나를 공유한다.
const UPG_ICO={
  inf_atk:'inf_atk', veh_atk:'veh_atk', air_atk:'air_atk',
  melee_atk:'melee_atk', range_atk:'range_atk', fly_atk:'air_atk',
  gnd_wpn:'gnd_wpn', air_wpn:'air_wpn',
  inf_def:'inf_def', veh_def:'veh_def', air_def:'air_def',
  gnd_def:'gnd_def', fly_def:'fly_def', gnd_arm:'gnd_arm', air_arm:'air_arm', shield:'shield',
  caduceus:'mana', apollo:'mana', titan:'mana', moebius:'mana', colossus:'mana', gamete:'mana',
  metasynaptic:'mana', argus_jewel:'mana', khaydarin_core:'mana', khaydarin:'mana', argus:'mana',
  ion:'speed', metabolic:'speed', muscle:'speed', anabolic:'speed', legs:'speed', pneuma:'speed',
  gravitic_scout:'speed', gravitic_shuttle:'speed', gravitic_obs:'speed',
  ocular:'sight', antennae:'sight', apial:'sight', sensor:'sight',
  u238:'range', grooved:'range', singularity:'range', charon:'range',
  burrow:'burrow', lurker:'morph', ventral:'transport', carrier_cap:'transport', reaver_cap:'transport',
  chitinous:'carapace' };
function upgIcoHTML(k, fallback){ const f=UPG_ICO[k]; return f? _icoImg('upgrades','up_'+f,'🔬') : (fallback||pIco('🔬')); }
// 스킬 🠒 아이콘 별칭 — 뜻이 같은 스킬끼리 한 장을 공유한다(UPG_ICO와 같은 규칙). 파일을 복사하지 말고 여기에 한 줄 추가할 것.
const SKILL_ICO={ nuke:'bomb' };   // 핵 폭격 = 폭탄 아이콘 공유
function skillIcoHTML(k, fallback){ return (typeof SKILLS!=='undefined'&&SKILLS[k])? _icoImg('skills','sk_'+(SKILL_ICO[k]||k),'✨') : (fallback||pIco('✨')); }
function bldgPortraitOf(mk, ico){   // 건물 초상 단일 소스: 3D 모델 이미지 → 없으면 아이콘(관리자 건물·직스 신전 공용)
  const img=(mk&&window.M3D&&M3D.bldgImage&&!(G.opt&&G.opt.model3d===false))?M3D.bldgImage(mk):null;
  return img?('<img class="portImg" src="'+img+'" alt="" draggable="false">'):(pIco(ico||'🏢')); }
function _techBldgPortrait(bk, ico){ if(bk) return _icoImg('buildings','bld_'+bk,ico||'🏢');   // 생성 아이콘 우선
  const race=G.tech.race, mk=(typeof TECH_MODEL!=='undefined'&&TECH_MODEL[race])?TECH_MODEL[race][bk]:null;
  return bldgPortraitOf(mk, ico); }
