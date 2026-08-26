/* ============================================================================
 * 90-m3d.module.js — 유닛 3D 모델(Three.js) — M3D
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
import * as THREE from 'https://esm.sh/three@0.160.0';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'https://esm.sh/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

const MODELS={ marine:'marine.glb', goliath:'goliath.glb', ghost:'ghost.glb', archon:'archon.glb', dragoon:'dragoon.glb', hydra:'hydralisk.glb', observer:'observer.glb', overlord:'overlord.glb',
  turret:'buildings/union/union_turret.glb', photon:'buildings/aetherial/aetherial_photon_cannon.glb',
  acad:'buildings/union/union_academy.glb', arm:'buildings/union/union_armory.glb', forge:'buildings/aetherial/aetherial_forge.glb', evo:'buildings/swarm/swarm_evolution_chamber.glb', pointlab:'buildings/union/union_engineering_bay.glb',
  temple_main:'buildings/temple_main.glb', temple_stone:'buildings/temple_stone.glb', temple_neutral:'buildings/temple_neutral.glb',   // 직스 신전(메인/2차/중립)
  res_cn:'models/neutral/resource_credit_node.glb', res_en:'models/neutral/resource_energy_node.glb', res_cc:'models/neutral/resource_credit_carry.glb', res_ec:'models/neutral/resource_energy_carry.glb',   // 💎 크레딧노드 ⛽ 에너지노드 · 🎒 운반(크레딧/에너지) — 건설구역 자원 3D
  // 적 공중 유닛 모델(네모네모 디펜스): 발키리·드랍쉽·배틀·아비터·셔틀·케리어·스카웃·스커지·디바우러·퀸
  hellfire:'hellfire.glb', pelican:'pelican.glb', dreadnought:'dreadnought.glb', kronos:'kronos.glb', seraph:'seraph.glb',
  archangel:'archangel.glb', falcon:'falcon.glb', stinger:'stinger.glb', venom:'venom.glb', medusa:'medusa.glb',
  wyvern:'wyvern.glb', aegis:'aegis.glb', behemoth:'behemoth.glb',   // 개인보스(공중유닛): 뮤탈→와이번 / 사이언스베슬→이지스 / 가디언→베히모스 (super=kronos 재사용)
  citizen:'civilian.glb',  // 아군/적 + 방어구조물 + 업그레이드 건물 + 유닛뽑기 시민(셀렉터)
  // 신규 가챠 유닛 전용 모델(전설/초월)
  machinegun:'machinegun.glb', tank:'tank.glb', blade:'blade.glb', skyguard:'skyguard.glb', skydancer:'skydancer.glb', matron:'matron.glb', thornqueen:'thornqueen.glb',
  racer:'racer.glb', snapper:'snapper.glb', worker_human:'worker_human.glb', worker_light:'worker_light.glb', worker_swarm:'worker_swarm.glb',
  medic:'mender.glb', broodling:'broodling.glb', larva:'aetherial_reaver.glb', reaver:'aetherial_reaver.glb', swarm_larva:'swarm_larva.glb', swarm_egg:'Egg.glb', ultralisk:'ultralisk.glb', dark_templar:'dark_templar.glb', high_templar:'high_templar.glb' };   // larva 키(도감·전투)·reaver 키(건설존 uid) 모두 리버 모델 · swarm_larva=스웜 라바 · swarm_egg=변태 중 알
const CLOAK_MODELS={ observer:true };  // 클로킹(반투명) 적용 모델만(옵저버). 오버로드 등은 불투명
const AURA_UNITS={ archon:true };      // 공중 부유 + 에너지 오라(아칸 — 사이오닉 에너지 생명체)
const AURA_LIFT=0.14;                  // 부유 기본 높이(모델높이 비율) — 아주 약간 떠 있음
const AURA_COL1=0x5fd8ff, AURA_COL2=0xb070ff;  // 오라 색(청록 외피 + 보라 코어)
const HOVER_AMP=0.13;     // 공중 유닛 상하 부유 진폭(모델높이 비율) — 크게(둥실)
// 공중 유닛 멤버십 = FXLAB_AIR(단일 출처)에서 생성. 더 이상 수동 동기화 안 함(값 미사용, 존재 여부만). window 미가용 시 폴백 목록.
const AIR_FLOAT=(function(){ const o={}; const s=(typeof window!=='undefined'&&window.FXLAB_AIR);
  if(s&&s.forEach){ s.forEach(k=>{ o[k]=1; }); return o; }
  ['skyguard','skydancer','overlord','observer','pelican','seraph','hellfire','dreadnought','kronos','archangel','falcon','stinger','venom','medusa','wyvern','aegis','behemoth'].forEach(k=>{ o[k]=1; }); return o; })();
const AIR_LIFT_PX=28;     // 공중유닛 부양 높이(화면 px 기준, 모델·스케일 무관 — 전 공중유닛 동일 고도). 정지 부양(흔들림 없음)
const HOVER_SPD=2.6;      // 부유 속도
const HOVER_WOBBLE=0.10;  // 공중 유닛 기우뚱 흔들(라디안)
const HOVER_BASE=14;      // 지면에서 띄우는 높이(px)
const ENEMY_DEATH=0.4;    // 적 사망 축소 시간(초)
const CLOAK_DELAY=0.5;    // 스폰 후 반투명(클로킹)까지(초) — 스타 옵저버
const CLOAK_OPACITY=0.5;  // 클로킹 시 불투명도(↑=덜 투명)
const GUN_FOR={ marine:'marine_gun.glb', ghost:'ghost_gun.glb' };  // 손에 부착할 총(총만 있는 정적 메시)
const RUN_FOR={ marine:'marine_run.glb', ghost:'ghost_run.glb', goliath:'goliath_run.glb', dragoon:'dragoon_run.glb', hydra:'hydralisk_run.glb', thornqueen:'thornqueen_run.glb', citizen:'civilian_run.glb', blade:'blade_run.glb', worker_human:'worker_human_run.glb', worker_light:'worker_light_run.glb', worker_swarm:'worker_swarm_run.glb',
  archon:'archon_run.glb', medic:'mender_run.glb', broodling:'broodling_run.glb', larva:'aetherial_reaver_run.glb', reaver:'aetherial_reaver_run.glb', ultralisk:'ultralisk_run.glb', dark_templar:'dark_templar_run.glb', high_templar:'high_templar_run.glb' };  // 이동 시 재생할 달리기 모델(리깅+클립) · larva·reaver=리버 달리기 · swarm_larva는 이동 안 함(달리기 없음)
const RUN_CLIP='Rifle_Charge_inplace';      // 이동 클립 이름(없으면 첫 클립 사용)
const ATTACK_FOR={ blade:'blade_attect.glb', snapper:'snapper_attack.glb', worker_human:'worker_human_punch.glb', archon:'archon_attack.glb', dark_templar:'dark_templar_attack.glb', medic:'mender_healling.glb' };   // dragoon 공격 모션 제거(이펙트만 — 요청). 메딕=치유 모션
const STAY_FOR={ marine:'marine_stay.glb', ghost:'ghost_stay.glb', goliath:'goliath_stay.glb', hydra:'hydralisk_stay.glb', worker_human:'worker_human_stay.glb', worker_light:'worker_light_stay.glb', archon:'archon_stay.glb', medic:'mender_stay.glb', high_templar:'high_templar_stay.glb' };   // 정지(대기) 애니
const WORK_FOR={ worker_human:'worker_human_work.glb', worker_light:'worker_light_work.glb' };   // 건설(작업) 애니 — 일꾼이 건물 지을 때 재생(스웜 일꾼은 미보유 → 절차적 폴백)
const RUN_SCALE_MUL=0.9;
const RUN_SCALE_OVR={worker_swarm:0.85, dragoon:1.08, thornqueen:0.81, ultralisk:0.93};   // 달리기 모델 크기 점프 보정(모델별 — 정지/이동 크기 일치, 픽셀 실측 기반). 달리기 포즈가 다리 펼쳐 커 보이는 만큼 축소
const IDLE_SCALE_OVR={larva:1.4, worker_swarm:0.87};   // 대기(inner) 모델만 크기 보정 — 이동 모델과 대기 크기 불일치 교정(larva=대기가 작아 확대 / worker_swarm=대기가 커서 축소). run은 base.h 정규화라 무관 · 논리 크기·충돌엔 영향 없음
const INNER_YAW_OFF={larva:Math.PI*1.5};   // 대기(inner) 모델 내장 정면 보정 — 이동 GLB와 정면이 다른 유닛(공성체=270°). 정지 시 이동 방향과 다른 곳 보는 것 교정
// metalness=1 어두운 금속 재질이라 발광맵 없이 렌더되면 몸체가 검게 뜨는 유닛들 → 자기 베이스맵을 발광맵으로 부여해 색을 살림.
//   ⓐ 이동(run) 모델엔 발광맵이 있으나 대기 모델엔 없어 색이 갈리는 유닛(hydra·thornqueen·worker_swarm·broodling·ultralisk) — 이동과 색 통일
//   ⓑ 이동 모델 자체가 없는 정적 유닛인데 같은 이유로 검게 뜨는 유닛(venom·stinger) — 검정 부위 색 복원
const IDLE_GLOW=new Set(['hydra','thornqueen','worker_swarm','broodling','ultralisk','venom','stinger','medusa',
  'dragoon','archon','blade','worker_light','dark_templar','high_templar','larva']);   // 에테리얼: 이동 모델엔 발광맵이 있으나 대기 모델엔 없어 색이 갈리는 유닛들
const IDLE_GLOW_INT=0.45;   // 대기 발광 강도(이동 모델은 0.6이나 전체 베이스맵을 쓰므로 약간 낮춰 통일)
const IDLE_GLOW_INT_OVR={venom:0.95, stinger:0.8, thornqueen:0.95, medusa:0.8};   // 개별 상향: 검정이 짙거나 더 밝게 요청된 유닛
const ATK_SCALE_OVR={ snapper:1.12 };   // 공격 모델 크기 보정(스내퍼: 공격 시 작아지지 않게 평상시 크기로)
// 유닛별 총 부착 설정(길이/손위치/회전) — 모델마다 손 위치가 달라 개별 지정
const GUN_CFG={
  marine:{ len:1.5, pos:{x:0.34, y:0.98, z:0.30}, rot:{x:0, y:Math.PI/2, z:0} },
  ghost: { len:1.65, pos:{x:-0.28, y:1.4, z:0.26}, rot:{x:0, y:Math.PI/2, z:0}, reload:true }, // 저격: 발사 텀에 장전(총 내렸다 올림)
};
const GUN_RECOIL=0.22;    // 발사 시 총 뒤로 킥(모델 단위)
 // 고정 구조물(터렛/포토) 발사 시 뒤로 반동(모델 단위)
const RELOAD_DIP=0.5;     // 장전 시 총 내리는 양(모델 단위)
const RELOAD_TILT=0.9;    // 장전 시 총구 아래로 기울이는 각(라디안)
const RELOAD_WIN=0.2;     // 장전(총 내림) 구간 폭 — 작을수록 들고 조준하는 시간이 김
const SCALE={ marine:12, goliath:16, ghost:12, archon:18, dragoon:14, hydra:14, observer:13, overlord:22, turret:25, photon:25, acad:19, arm:19, forge:19, evo:19, pointlab:19, temple_main:105, temple_stone:55, temple_neutral:30, citizen:13,
  hellfire:17, pelican:18, dreadnought:22, kronos:20, seraph:16, archangel:22, falcon:16, stinger:10, venom:17, medusa:18,   // 적 공중 유닛(초기값 — 보면서 조정). stinger(스커지)=약간 작게
  wyvern:16, aegis:18, behemoth:20,   // 개인보스 모델(초기값 — bossScale 2배 적용됨)
  racer:20, tank:22, blade:18, thornqueen:20, skyguard:17, skydancer:17, worker_human:13, worker_light:11, worker_swarm:8.8,
  medic:12, broodling:9, larva:8, reaver:8, swarm_larva:7, swarm_egg:11, ultralisk:24, dark_templar:13, high_templar:12 };  // 유닛별 화면 스케일. 초월 비행체(템페스트·스카이댄서)=대형 · swarm_larva=작은 라바 · swarm_egg=알(라바보다 큼)
  // (구)타입별 색 — 현재는 플레이어색으로 통일(아래 PLAYER_COLOR)
// 플레이어 색(스타크래프트식) — 한 플레이어의 모든 유닛·구조물을 같은 색으로 통일(아군 구별용)
// PLAYER_VIEW_COLORS(45° 균등 배치)와 동일한 값 — 두 표가 어긋나면 기본 틴트 색과 실제 플레이어색이 달라짐
const PLAYER_PALETTE={ blue:0x4570d3, red:0xd6292f, yellow:0xeadb3e, green:0x2ba143, purple:0xad5cd6, orange:0xed691d, brown:0x6d422c, white:0xdfe0e2 };
let PLAYER_COLOR=PLAYER_PALETTE.blue;   // 현재 플레이어 통일색(키만 바꾸면 전체 색 변경)
const PLAYER_MODELS=new Set(['marine','ghost','goliath','dragoon','hydra','archon','turret','photon',
  'machinegun','tank','blade','thornqueen','skyguard','skydancer','matron','racer','snapper','worker_human','worker_light','worker_swarm',
  'medic','broodling','larva','reaver','swarm_larva','swarm_egg','ultralisk','dark_templar','high_templar']);  // 플레이어 소유(전장) 모델 — 플레이어색 림 적용(가챠 전용 모델 포함)
const RING_OP=0.9;        // 선택 링 불투명도
      // 모델 색 틴트 강도(0=원본, 1=완전 색칠) — 진한 색은 발광이 아닌 이 값으로(단단하게)
      // 플레이어색 발광(은은하게 — 마린/고스트처럼 부드러운 빛)
const RIM_INT=1.5;        // 플레이어색 외곽 림 강도(은은) — 작아도 실루엣이 플레이어색으로
const RIM_POW=3.0;        // 림 폭(클수록 얇게) — 최대한 얇게(본체 색을 안 가리도록)
const RIM_WHITE=0.0;      // 림 색을 흰색 쪽으로 섞는 정도(0=순수 플레이어색 → 색 선명하게 드러남)
const RIM_MUL={aegis:1.8};  // 유닛별 림 강도 배율 — 원반형 등 평평한 유닛은 프레넬 림이 약해 개별 부스트(얇아도 보이게)
const ENEMY_RIM=0xff3322; // 적 유닛 림 색(선명한 적색 — 눈에 잘 띄되 옅은 분홍보다 덜 밝음)
const NEUTRAL_RIM=0xbfe0ff; // 구조물/기타 림 색(차가운 흰빛)
// 아군 유닛 공용 림 색(Color 객체 1개를 모든 아군 재질이 공유 → setPlayerRim으로 한번에 색 전환: 플레이어 구역 관전용)
const playerRim=new THREE.Color(PLAYER_COLOR).lerp(new THREE.Color(0xffffff), RIM_WHITE);
const rimIntU={value:RIM_INT};   // 아군 림 강도 공유 uniform(관전 화면에선 키워서 플레이어색 구별 또렷하게)
const subRimIntU={value:0};      // 림 미사용(위와 동일 방침) — 구분은 본체 틴트로만
function setPlayerRim(hex, intensity){ playerRim.set(hex).lerp(new THREE.Color(0xffffff), RIM_WHITE); rimIntU.value=(intensity!=null?intensity:RIM_INT); setPlayerTint(hex); }   // 플레이어 색 전환 = 본체 틴트 색 전환
const BEACON_RIM=new THREE.Color(0xff3b3b);   // 비콘 테두리(빨강 림) — 은은한 가장자리 포인트(유닛 안 가리게 약하게)
const beaconRimIntU={value:0.15};
const MODEL_SCALE=13;     // 기본 스케일(미지정 유닛) — 보드 축소(INSET 0.245)에 맞춰 추가 ~0.85 축소
const Y_DROP=2;           // 점 기준 수직 보정(px)
const VIEW_TILT=0.65;     // 카메라 부감(작게=서 있게 보임, 0=정면). 모델은 세워두고 이 각도만큼만 기울여 내려다봄 — 더 위에서 본 각도로 상향(0.42→0.65)
const ROT_OFFSET=0;       // 모델 정면(+Z 가정)과 실제 forward 차이 보정(yaw, 필요시 조정)
const MODEL_YAW_OFF={ forge:Math.PI, turret:Math.PI/2, racer:Math.PI/2, tank:Math.PI/2, skyguard:Math.PI/2, skydancer:Math.PI/2,
  falcon:Math.PI/2, pelican:Math.PI/2, kronos:Math.PI/2 };  // 모델별 yaw 보정. 터렛/레이서/브레이커 +90°. falcon·pelican·kronos(아비터, 신규 방향성 기체): 동체 수직이라 옆으로 진행 → +90° 회전 보정
// 업그레이드 탭 건물 → 건설 구역 대응 모델키(+swarm 여부). 각도를 건설 구역과 통일하기 위한 매핑.
const UPG_BUILD_KEY={ acad:{k:'union_academy',swarm:false}, arm:{k:'union_armory',swarm:false}, forge:{k:'aetherial_forge',swarm:false}, evo:{k:'swarm_evolution_chamber',swarm:true}, pointlab:{k:'union_engineering_bay',swarm:false} };
function upgBldgYaw(id){
  if(id && id.indexOf('cb_')===0){ const bk=id.slice(3);   // 🏢 건설 건물(cb_): 건설 구역과 동일 = (swarm?0:CST_YAW)+CST_BLDG_CFG[key].f
    const cfg=(typeof window!=='undefined'&&window.CST_BLDG_CFG)?window.CST_BLDG_CFG[bk]:null;
    const base=(bk.indexOf('swarm_')===0)?0:((typeof window!=='undefined'&&window.CST_YAW!=null)?window.CST_YAW:-0.52);
    return base+((cfg&&cfg.f)||0); }
  const map=UPG_BUILD_KEY[id];   // 업그레이드 탭 건물 → 건설 공식과 동일
  if(map){ const cfg=(typeof window!=='undefined'&&window.CST_BLDG_CFG)?window.CST_BLDG_CFG[map.k]:null;
    const base=map.swarm?0:((typeof window!=='undefined'&&window.CST_YAW!=null)?window.CST_YAW:-0.52);
    return base+((cfg&&cfg.f)||0); }
  return (MODEL_YAW_OFF[id]||0)+0.5; }   // 미매핑 건물 폴백(기존 3/4 뷰)
const NO_TURN={};  // 몸을 돌리지 않는 유닛(현재 없음)
const TURN_MOVE_ONLY={ dragoon:true };  // 이동 중에만 회전(정지·공격 시 몸 고정) — 센티넬
const RIM_RO_MUL={ racer:0.6, res_en:0.5 };  // 모델별 선택링 반경 배율. 레이서=축소 · res_en(에너지 광산)=발판 넓어 링 과대 → 리파이너리급으로 축소
// ── 코드 기반 애니메이션 파라미터 ──
const BREATHE_AMP=0;      // idle 숨쉬기 진폭(모델높이 비율) — 바닥 고정(제자리 모션은 별도 추가 예정)
const BREATHE_SPD=2.2;    // 숨쉬기 속도
const LEAN_DECAY=7;       // 발사 펄스(반동/섬광/떨림) 복귀 속도
const TREMBLE=0.045;      // 발사 시 미세 떨림 진폭(모델높이 비율) — 상체 숙임 대신
// 걷기 모션(이동 중) — 정적 메시라 상하 통통 + 좌우 흔들 + 전방 기울기로 표현
const WALK_SPD=11;        // 발걸음 빈도
const WALK_BOB=0.05;      // 상하 통통 진폭(모델높이 비율)
const WALK_SWAY=0.07;     // 좌우 흔들(라디안)
const WALK_LEAN=0.12;     // 이동 방향으로 살짝 기울기(라디안)
const DEATH_DUR=0.6;      // death 뒤로 쓰러지는 시간(초)
const DEATH_ANG=Math.PI*0.5; // 쓰러진 각도(≈90°, 등으로 눕기)
const DEAD_HOLD=2.0;      // 쓰러진 뒤 유지 후 제거(초)
const ROT_SPD=12;         // 적 방향 회전(yaw) 보간 속도

let renderer, scene, camera, ready=false;
const bases={};           // id -> {scene, off:{x,y,z}, h}
const guns={};            // id -> 총 scene
const runs={};            // id -> {scene, clips, off, h} 달리기 모델
const atks={};            // id -> {scene, clips, off, h} 공격 애니 모델(워든 검 베기 등)
const stays={};           // id -> {scene, clips, off, h} 정지(대기) 애니 모델
const works={};           // id -> {scene, clips, off, h} 건설(작업) 애니 모델
const swords={};          // id -> 검 scene(워든)
// 워든 쌍검: 손 본(LeftHand/RightHand)에 부착. 튜닝값
const ATK_SPEED=2.0;                           // 워든 검 베기 애니 배속(빠르게 쓱)
const ATK_FRACTION=0.5;                        // 공격 애니 중 첫 스윙만 재생(뒤 스윙 컷 — 허공 휘적임 방지)
const ATK_SPEED_OVR={ worker_human:1.4, blade:2.8, snapper:1.9, archon:3.0 };       // 유닛별 공격 배속(일꾼=자연 / 워든=빠른 / 스내퍼=부드럽게 / 보이드=3s 캐스트→1s)
const ATK_LOOP={ archon:true };   // 공격 모션 연속 루프 유닛 — 공격 간격과 모션 주기를 맞춰(1s=1s) 리셋 없이 이어 재생(끊김 제거)
const ATK_FRACTION_OVR={ worker_human:1.05, blade:1.0, snapper:1.0, archon:1.15 };   // 유닛별 스윙 비율(전체 재생 — 중간 컷 끊김 제거). 보이드 1.15=atkT 버퍼(다음 공격까지 모션 유지, 루프라 재생엔 영향 없음)
const SWORD_LEN=0.62;                          // 검 길이(모델높이 비율, anim 단위)
const SWORD_HAND_POS={x:0, y:0, z:0};          // 손 본 기준 추가 오프셋(본 로컬)
const SWORD_HAND_ROT={x:0, y:0, z:0};          // 칼끝 방향 보정(라디안)
const SWORD_GRIP=0.1;                          // 손잡이 끝에서 그립까지(칼날 길이 비율) — 손이 손잡이를 쥐게
const SWORD_HILT_AT_MIN=true;                  // 손잡이가 칼날 축의 min쪽이면 true(아니면 false로 뒤집기)
// 검을 손 본에 부착(쌍검). model=리깅 클론(runInner/atkInner)
function attachSwords(model, baseH){
  if(!swords.blade) return;
  model.updateMatrixWorld(true);
  ['RightHand','LeftHand'].forEach(bn=>{
    let bone=null; model.traverse(o=>{ if(o.isBone && o.name===bn) bone=o; });
    if(!bone) return;
    const sw=cloneSkinned(swords.blade);
    const sb=new THREE.Box3().setFromObject(sw);
    const dx=sb.max.x-sb.min.x, dy=sb.max.y-sb.min.y, dz=sb.max.z-sb.min.z, slong=Math.max(.001, Math.max(dx,dy,dz));
    const ax=(dy>=dx&&dy>=dz)?'y':(dx>=dz?'x':'z');   // 칼날(긴) 축
    // 짧은 축은 중앙 정렬, 긴 축은 손잡이쪽 끝+그립을 원점(손)에 맞춤
    const off={x:-(sb.min.x+sb.max.x)/2, y:-(sb.min.y+sb.max.y)/2, z:-(sb.min.z+sb.max.z)/2};
    off[ax] = SWORD_HILT_AT_MIN ? -(sb.min[ax]+SWORD_GRIP*slong) : -(sb.max[ax]-SWORD_GRIP*slong);
    sw.position.set(off.x, off.y, off.z);
    const bws=new THREE.Vector3(); bone.getWorldScale(bws); const bs=(Math.abs(bws.x)+Math.abs(bws.y)+Math.abs(bws.z))/3 || 1;
    const holder=new THREE.Group(); holder.add(sw);   // 그립 보정된 검을 홀더로 감싸 손 본에 부착
    holder.scale.setScalar((baseH*SWORD_LEN)/(slong*bs));
    holder.rotation.set(SWORD_HAND_ROT.x, SWORD_HAND_ROT.y, SWORD_HAND_ROT.z);
    holder.position.set(SWORD_HAND_POS.x, SWORD_HAND_POS.y, SWORD_HAND_POS.z);
    bone.add(holder);   // 검은 공유 재질(로드 시 플레이어색 림 적용)을 그대로 사용 → 양검 모두 색 변함
  });
}
const models=new Map();   // uid -> {holder,view,yaw,anim,id,h,breathe,lean,seenSeq,dying,deadT}
// ── 선택링 인스턴스 배치: 다중 선택 시 유닛마다 개별 링 메시(=드로우콜)를 그리면 수백 기 선택에서 CPU 병목 →
//    정규화 링 지오메트리 1개를 InstancedMesh로 그려 전체 선택링을 드로우콜 1개로 합침(색·반지름은 인스턴스별)
const RING_MAX=600;   // 동시 표시 가능한 선택링 수(유닛 상한 100의 여유분)
let ringInst=null;
const _ringQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(VIEW_TILT-Math.PI/2,0,0));   // 지면(부감 틸트) 방향 — 개별 rim(view틸트+rotX-90°)과 동일
const _ringM=new THREE.Matrix4(), _ringP=new THREE.Vector3(), _ringS=new THREE.Vector3(), _ringC=new THREE.Color();
function ensureRingInst(){ if(ringInst) return ringInst;
  const g=new THREE.RingGeometry(0.93,1,36);   // 반경 1로 정규화 — 인스턴스 스케일=화면 반지름 px(폭≈개별 rim과 동급)
  const mt=new THREE.MeshBasicMaterial({transparent:true, opacity:RING_OP, side:THREE.DoubleSide, depthWrite:false});
  ringInst=new THREE.InstancedMesh(g, mt, RING_MAX);
  ringInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ringInst.frustumCulled=false; ringInst.renderOrder=1;   // 그림자(renderOrder 0) 위에 그려짐 보장
  ringInst.count=0; scene.add(ringInst); return ringInst; }
function _ringPush(n, x, y, r, col, z){ const R=ensureRingInst(); if(n>=RING_MAX) return n;
  _ringP.set(x,y,(z||0)-1); _ringS.set(r,r,1); _ringM.compose(_ringP,_ringQ,_ringS);   // z=유닛 깊이 - 1(깊이 정렬 도입 후 링이 앞 유닛에 가려 사라지지 않게)
  R.setMatrixAt(n,_ringM); R.setColorAt(n,_ringC.set(col)); return n+1; }
// ── 그림자 인스턴스 배치: 유닛·적마다 상시 떠 있는 발밑 그림자 원(=드로우콜)을
//    불투명도 그룹별 InstancedMesh 2개(지상 0.22 / 공중 0.26)로 합침 ──
const _SH_COS=Math.cos(VIEW_TILT);
let shInstA=null, shInstB=null;   // A=지상(0.22) B=공중(0.26)
function _mkShInst(op){ const g=new THREE.CircleGeometry(1,26);
  const mt=new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:op, depthWrite:false});
  const im=new THREE.InstancedMesh(g,mt,RING_MAX); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled=false; im.count=0; scene.add(im); return im; }
function _shadowInstPass(){   // 게임 모델(models+토벌장 원격) 전체 — 개별 그림자 메시는 숨기고 인스턴스로 대체
  if(!shInstA){ shInstA=_mkShInst(0.22); shInstB=_mkShInst(0.26); }
  let a=0,b=0;
  for(const map of [models, bossRemoteModels]) for(const [,m] of map){ const sh=m.shadow; if(!sh) continue;
    if(sh.visible) sh.visible=false;   // 개별 메시 상시 숨김(전시 풀 모델은 영향 없음 — 게임 모델 맵만)
    if(!m.holder.visible) continue;
    const sc=m.holder.scale.x, r=(sh.geometry.parameters&&sh.geometry.parameters.radius||0.5)*sc;
    _ringP.set(m.holder.position.x, m.holder.position.y + sh.position.y*sc*_SH_COS, m.holder.position.z-2);   // 유닛과 같은 깊이(살짝 뒤) — 지면 그림자
    _ringS.set(r,r,1); _ringM.compose(_ringP,_ringQ,_ringS);
    const air=sh.material.opacity>0.24;   // AIR_FLOAT 분기가 0.26으로 올려둔 모델=공중 그룹
    if(air){ if(b<RING_MAX) shInstB.setMatrixAt(b++,_ringM); }
    else   { if(a<RING_MAX) shInstA.setMatrixAt(a++,_ringM); }
  }
  shInstA.count=a; shInstB.count=b;
  if(a) shInstA.instanceMatrix.needsUpdate=true;
  if(b) shInstB.instanceMatrix.needsUpdate=true;
}
// ── 렌더 프로파일(벤치 전용, 기본 off) — sync의 JS 루프 시간과 renderer.render 시간을 분리 측정 ──
let _prof=null;
// ── 대군 애니메이션 스태거: 유닛이 많으면 스킨드 믹서를 N프레임에 1회(dt 누적)로 갱신한다.
//    ★ 갱신을 건너뛴 프레임엔 스켈레톤(본 행렬 계산 + 본 텍스처 GPU 업로드)도 같이 멈춘다.
//    본 포즈가 그대로이므로 화면은 완전히 동일한데, three.js 렌더 비용의 큰 몫이 사라진다.
//    (믹서만 건너뛰면 three.js가 매 프레임 skeleton.update()를 그대로 호출해 효과가 거의 없음)
const MIX_N2=60, MIX_N3=150;   // 이 유닛 수를 넘으면 각각 2프레임·3프레임에 1회 갱신
let _syncTick=0, _mixStride=1, _modelSeq=0, _mixForce=0;   // _mixForce = 벤치용 강제 분산값(0=자동)
function _mixStrideFor(n){ if(_mixForce) return _mixForce;
  if(typeof G!=='undefined'&&G.opt&&G.opt.lite3d) return 3;   // 저사양 모드는 항상 최대 분산
  return n>MIX_N3?3:(n>MIX_N2?2:1); }
function _skels(m){ if(m._skels) return m._skels; const a=[];   // 이 모델이 쓰는 스켈레톤 목록(모델당 1회 수집)
  for(const r of [m.inner,m.runInner,m.stayInner,m.workInner,m.atkInner]){ if(!r) continue;
    r.traverse(o=>{ if(o.isSkinnedMesh&&o.skeleton) a.push(o.skeleton); }); }
  for(const s of a){ if(s._u0) continue; s._u0=s.update; s.update=function(){ if(!this._hold) this._u0(); }; }   // three.js가 매 프레임 부르는 갱신을 홀드 플래그로 차단
  return (m._skels=a); }
function _mixHold(m, hold){ const a=_skels(m); for(let i=0;i<a.length;i++) a[i]._hold=hold; }
function _mixStep(m, mixer, dt){ if(!mixer) return;
  if(_mixStride<2){ if(m._skels&&m._skels.length&&m._skels[0]._hold) _mixHold(m,false);   // 분산 해제(유닛이 줄었을 때) — 홀드 잔재 정리
    if(m._mdt){ dt+=m._mdt; m._mdt=0; } mixer.update(dt); return; }
  if(m._mixPh==null) m._mixPh=_modelSeq++;   // 모델마다 고정 위상 → 갱신 프레임이 고르게 흩어짐(한 프레임에 몰리지 않음)
  m._mdt=(m._mdt||0)+dt;
  if((_syncTick+m._mixPh)%_mixStride===0){ mixer.update(m._mdt); m._mdt=0; }
  else _mixHold(m, true); }
// ── 자세(어느 내장 모델을 보여줄지) 단일 소스 ──
// 어느 내장 모델(정지/달리기/대기/공격 GLB)을 보여줄지의 규칙을 한곳에 모은 것.
// 분기마다 따로 적어두면 "달리기인데 총이 남아있다" 같은 어긋남이 생긴다.
const POSE_MIXER={ run:'runMixer', atk:'atkMixer', stay:'stayMixer', static:null };
function poseOf(m, id, moving, atkT){
  if(!moving && id==='worker_light' && m.runInner) return 'run';   // 에테리얼 일꾼: 제자리에서도 run 모션(두 팔 앞으로)
  if(!moving && atkT>0 && m.atkInner) return 'atk';                // 공격 모션(정지 시 1회)
  if(moving) return m.runInner?'run':'static';                     // 달리기 모델 없으면 정적 모델 + 절차적 걷기
  if(id==='blade' && m.runInner) return 'run';                     // 워든 정지 = 리깅 모델 frame0 고정
  return m.stayInner?'stay':'static';
}
// 🔫 총(별도 정적 메시)은 유닛당 드로우콜을 하나 더 쓴다. 대군에서는 이게 렌더 비용의 25%까지 차지한다.
//   화면상 유닛이 이 높이보다 작으면 총은 몇 픽셀짜리 얼룩이라 그리지 않는다 — 직스(대군)에서만 적용.
//   네모는 유닛이 23~32px라 항상 총이 보인다(실측). 직스는 기본 13~15px·줌인 26px → 줌인하면 다시 보인다.
const GUN_MIN_PX=20;
function poseShow(m, which){   // 총은 정지·대기 자세에서만(달리기/공격 GLB엔 총이 이미 들어있음)
  if(m.inner)    m.inner.visible=(which==='static');
  if(m.runInner) m.runInner.visible=(which==='run');
  if(m.stayInner)m.stayInner.visible=(which==='stay');
  if(m.atkInner) m.atkInner.visible=(which==='atk');
  if(m.gun){ const _big=!(typeof G!=='undefined'&&G.strike) || (m.h*(m.holder?m.holder.scale.x:1))>=GUN_MIN_PX;
    m.gun.visible=(which==='static'||which==='stay') && _big; }
}
// (제거) walkPose — 미사용 절차적 걷기 헬퍼(호출부 없음)

const bossRemoteModels=new Map();   // 토벌장 원격(다른 플레이어) 유닛 모델 — 게임 모델 사망 스윕과 분리
const shopModels=new Map();   // 유닛뽑기 슬롯 전시용 모델(uid -> model). 게임 모델과 분리(사망 스윕 영향 없음)
const ghostModels=new Map();  // 비활성 고정 슬롯(미건설 터렛/포토) 고스트 — 무채색·축소(아직 비활성 느낌)
const buildModels=new Map();  // 직스 건설지 전용 전시 모델(일꾼·건물) — 게임/전시 풀과 분리(사망 스윕 무관)
const buildGhostModels=new Map();  // 건설 배치 예비 건물(반투명 회색 3D 고스트) — 모델 id별 캐시
// 건설 그리드 폭 맞춤 보정 배율 — bbox에 안테나·돌출부가 포함돼 몸통이 footprint보다 좁아 보이는 모델만 >1로 키움(스크린샷 실측 튜닝)
const CB_FIT_MUL={ cb_union_command_center:1.2, cb_union_supply_depot:1.05, cb_union_refinery:1.1, cb_union_academy:1.08, cb_union_armory:1.12, cb_union_missile_turret:1.15, cb_union_machine_shop:1.1, cb_swarm_extractor:1.1, cb_aetherial_pylon:0.85, cb_aetherial_photon_cannon:1.18 };   // 파일런 살짝 작게 · 포톤 캐논 살짝 크게
try{ window.CB_FIT_MUL=CB_FIT_MUL; }catch(_e){}
const GHOST_SCALE=0.62;       // 고스트 크기 배율(실제보다 작게)
let beaconBase=null;          // 합성 비콘 3D 모델 베이스(scene/off/h/w)
const beaconInsts=new Map();  // 비콘 인스턴스(key 'bay' / 'shop0..7' -> {holder,view,inner,w})
let bossModel=null;           // 공용 보스 3D 모델(임의 유닛 1종)
const BOSS_MODEL='archon';    // 공용 보스 폴백 모델(공중 기함 미로드 시)
const BOSS_MODEL_AIR='dreadnought';   // 공용 보스 = 공중 기함(배틀크루저). 로드 시 우선 사용
const BOSS_MODEL_BLD='pointlab';   // 🏢 포인트방 = 부술 건물(공학소). 로드 시 최우선 — 지상 고정 렌더
const BOSS_SCALE_MUL=2.0;     // 보스 확대 배율(유닛보다 크되 과하지 않게)
const BOSS_BLD_SCALE_MUL=4; // 건물 보스 확대 배율(튜닝값 · 업그레이드 모델용)
const COIN_CB_SCALE_MUL=2.4; // 건설(cb_) 건물 배율 — SCALE=cfg.s/max(h,w) 정규화 후, 포인트방 표시 크기 배율
const SHOP_SCALE_MUL=1.16;    // 슬롯 전시 모델·시민 크기 배율 — 유닛/시민 살짝 키움
const SHOP_BW_MUL=1.7;        // 슬롯 비콘 폭 배율(min*0.10 * 이값) — 유닛 축소에 맞춰 비콘도 ~0.85 축소
  // 유닛뽑기: 유닛을 비콘 단(deck) 위로 올리는 높이(비콘 폭 대비)
// 유닛뽑기 화면 전용 크기 보정(비콘 위에 적절히 보이게) — 작은건 키우고, 큰건 비콘 밖으로 안 나가게 축소
const CITIZEN_SHOP_MUL=1.22;   // 유닛뽑기 시민 크기 배율(조금 더 크게)
          // 전시 모델 회전(턴테이블) 속도(rad/s)
const BLDG_SCALE_MUL=1.5;    // 업그레이드 건물 전시 크기 배율(5건물+섹션 구분 들어가게 약간 축소)
          // 건물 전시 회전 속도(천천히)
const DPR=Math.min(devicePixelRatio||1,2);

// 인게임 조명 구성(단일 소스) — 오프스크린 렌더 등 다른 씬에서도 같은 광원을 재현할 수 있게 함수로 둔다.
function addGameLights(sc){
  sc.add(new THREE.AmbientLight(0xffffff,1.25));   // 환경광이 채움 → 앰비언트 낮춰 대비 확보
  const d1=new THREE.DirectionalLight(0xffffff,1.9); d1.position.set(0.5,1,0.9); sc.add(d1);
  const d2=new THREE.DirectionalLight(0xbfe0ff,0.7); d2.position.set(-0.6,0.3,-0.5); sc.add(d2);
  const d3=new THREE.DirectionalLight(0xffffff,0.6); d3.position.set(0,0.4,-1); sc.add(d3); // 정면 보강광
}
function init(){
  const cv=document.getElementById('cvMarine'); if(!cv) return;
  renderer=new THREE.WebGLRenderer({canvas:cv, alpha:true, antialias:true});
  renderer.setPixelRatio(DPR); renderer.setClearColor(0x000000,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25;   // 필름 톤매핑 — 워시아웃 줄이고 입체감·하이라이트↑
  scene=new THREE.Scene();
  // 환경광(IBL): RoomEnvironment 기반 부드러운 반사 → 금속·플라스틱 재질이 평면적으로 안 보이게(품질 핵심)
  try{ const _pmrem=new THREE.PMREMGenerator(renderer); scene.environment=_pmrem.fromScene(new RoomEnvironment(renderer),0.04).texture; }catch(_){ }
  addGameLights(scene);
  camera=new THREE.OrthographicCamera(0,1,1,0,-2000,2000); camera.position.set(0,0,800);
  ready=true;   // 렌더러 준비 즉시 가동 — 모델은 로드되는 대로 하나씩 등장(올-오어-나싱 30초 블랙아웃 제거). sync는 미로드 모델을 자동 스킵
  const L=new GLTFLoader();
  let pending=Object.keys(MODELS).length+Object.keys(GUN_FOR).length+Object.keys(RUN_FOR).length+Object.keys(ATTACK_FOR).length+Object.keys(STAY_FOR).length+Object.keys(WORK_FOR).length+2;  // +1=비콘 +1=워든 검
  const done=()=>{ if(--pending<=0){ ready=true;   // 전체 로드 완료 → 2D 폴백 쓰던 화면(건물/시민) 1회 재렌더로 3D 전환
    try{ if(typeof G!=='undefined'){ if(G.tab==='Unit'&&typeof buildClock==='function') buildClock(); } }catch(e){} } };
  // 합성 비콘 3D 모델(합체 베이·유닛 슬롯 발판) — 유닛과 같은 씬에 렌더
  L.load('/assets/beacons/beacon_synthesis.glb', g=>{ const s=g.scene; const box=new THREE.Box3().setFromObject(s);
    beaconBase={ scene:s, off:{x:(box.max.x+box.min.x)/2, y:box.min.y, z:(box.max.z+box.min.z)/2}, h:Math.max(.001,box.max.y-box.min.y), w:Math.max(.001,Math.max(box.max.x-box.min.x, box.max.z-box.min.z)) };
    dimBeacon(s);   // 채도/발광 낮춰 유닛이 돋보이게
    done();
  }, undefined, e=>{ console.warn('beacon.glb load fail', e); done(); });
  for(const id in MODELS){ const path='/assets/'+(MODELS[id].includes('/')?MODELS[id]:'models/'+MODELS[id]); L.load(path, g=>{
      const s=g.scene; const box=new THREE.Box3().setFromObject(s);
      bases[id]={ scene:s, off:{x:(box.max.x+box.min.x)/2, y:box.min.y, z:(box.max.z+box.min.z)/2}, h:Math.max(.001,box.max.y-box.min.y), w:Math.max(.001, Math.max(box.max.x-box.min.x, box.max.z-box.min.z)) };
      tintModel(s, id);   // 타입별 색 입혀 캐릭터 구분
      done();
    }, undefined, e=>{ console.warn(id+'.glb load fail', e); done(); }); }
  for(const id in GUN_FOR){ L.load('/assets/models/'+GUN_FOR[id], g=>{ guns[id]=g.scene; rimModel(g.scene, unitRim(id)); done(); }, undefined, e=>{ console.warn(GUN_FOR[id]+' load fail', e); done(); }); }  // 총도 타입색 림으로 빛나게
  L.load('/assets/models/blade_sword.glb', g=>{ swords.blade=g.scene; applySwordRim(g.scene, playerRim); done(); }, undefined, e=>{ console.warn('blade_sword.glb load fail', e); done(); });  // 워든 검 — 전용 림(넓은 프레넬+베이스 글로우)으로 양검 다 플레이어색
  for(const id in RUN_FOR){ L.load('/assets/models/'+RUN_FOR[id], g=>{
      const s=g.scene; s.updateWorldMatrix(true,true);   // 스킨드 메시 bbox는 부정확 → 본 위치로 크기/발 계산
      let mn=1e9,mx=-1e9,cx=0,cz=0,nb=0;
      s.traverse(o=>{ if(o.isBone){ const w=new THREE.Vector3(); o.getWorldPosition(w); if(w.y<mn)mn=w.y; if(w.y>mx)mx=w.y; cx+=w.x; cz+=w.z; nb++; } });
      if(!nb){ const b=new THREE.Box3().setFromObject(s); mn=b.min.y; mx=b.max.y; cx=(b.min.x+b.max.x)/2; cz=(b.min.z+b.max.z)/2; nb=1; }
      runs[id]={ scene:s, clips:g.animations, off:{x:cx/nb, y:mn, z:cz/nb}, h:Math.max(.001,mx-mn) };
      tintModel(s, id);   // 이동(달리기) 모델도 정적 모델과 동일하게 색+림 적용
      done();
    }, undefined, e=>{ console.warn(RUN_FOR[id]+' load fail', e); done(); }); }
  for(const id in STAY_FOR){ L.load('/assets/models/'+STAY_FOR[id], g=>{
      const s=g.scene; s.updateWorldMatrix(true,true);
      let mn=1e9,mx=-1e9,cx=0,cz=0,nb=0;
      s.traverse(o=>{ if(o.isBone){ const w=new THREE.Vector3(); o.getWorldPosition(w); if(w.y<mn)mn=w.y; if(w.y>mx)mx=w.y; cx+=w.x; cz+=w.z; nb++; } });
      if(!nb){ const b=new THREE.Box3().setFromObject(s); mn=b.min.y; mx=b.max.y; cx=(b.min.x+b.max.x)/2; cz=(b.min.z+b.max.z)/2; nb=1; }
      stays[id]={ scene:s, clips:g.animations, off:{x:cx/nb, y:mn, z:cz/nb}, h:Math.max(.001,mx-mn) };
      tintModel(s, id);
      done();
    }, undefined, e=>{ console.warn(STAY_FOR[id]+' load fail', e); done(); }); }
  for(const id in WORK_FOR){ L.load('/assets/models/'+WORK_FOR[id], g=>{   // 건설(작업) 애니 — 정지/이동 모델과 동일 방식(본 위치로 크기·발 계산)
      const s=g.scene; s.updateWorldMatrix(true,true);
      let mn=1e9,mx=-1e9,cx=0,cz=0,nb=0;
      s.traverse(o=>{ if(o.isBone){ const w=new THREE.Vector3(); o.getWorldPosition(w); if(w.y<mn)mn=w.y; if(w.y>mx)mx=w.y; cx+=w.x; cz+=w.z; nb++; } });
      if(!nb){ const b=new THREE.Box3().setFromObject(s); mn=b.min.y; mx=b.max.y; cx=(b.min.x+b.max.x)/2; cz=(b.min.z+b.max.z)/2; nb=1; }
      works[id]={ scene:s, clips:g.animations, off:{x:cx/nb, y:mn, z:cz/nb}, h:Math.max(.001,mx-mn) };
      tintModel(s, id);
      done();
    }, undefined, e=>{ console.warn(WORK_FOR[id]+' load fail', e); done(); }); }
  for(const id in ATTACK_FOR){ L.load('/assets/models/'+ATTACK_FOR[id], g=>{
      const s=g.scene; s.updateWorldMatrix(true,true);
      let mn=1e9,mx=-1e9,cx=0,cz=0,nb=0;
      s.traverse(o=>{ if(o.isBone){ const w=new THREE.Vector3(); o.getWorldPosition(w); if(w.y<mn)mn=w.y; if(w.y>mx)mx=w.y; cx+=w.x; cz+=w.z; nb++; } });
      if(!nb){ const b=new THREE.Box3().setFromObject(s); mn=b.min.y; mx=b.max.y; cx=(b.min.x+b.max.x)/2; cz=(b.min.z+b.max.z)/2; nb=1; }
      atks[id]={ scene:s, clips:g.animations, off:{x:cx/nb, y:mn, z:cz/nb}, h:Math.max(.001,mx-mn) };
      tintModel(s, id);
      done();
    }, undefined, e=>{ console.warn(ATTACK_FOR[id]+' load fail', e); done(); }); }
}

// ── 본 서브트리 렌더 순회 제외 ──
// three.js는 매 프레임 씬 전체를 순회(projectObject)하며 그릴 것을 고르는데, 본(Bone)은 그려지지 않으면서도
// 개수가 압도적이다(400기 전투 = 씬 오브젝트 11,800개 중 본이 7,300개). visible=false면 그 서브트리를
// 통째로 건너뛴다. 스키닝에 필요한 본 월드행렬은 updateMatrixWorld가 계산하고 이쪽은 visible을 보지 않으므로
// 화면 결과는 완전히 동일하다.
// ⚠ 손 본에 검 등 메시를 붙인 모델(워든)은 그 메시까지 사라지므로 제외 — 자동 판정(본 아래 메시 유무).
function hideBoneRoots(root){ if(!root) return;
  root.traverse(o=>{ if(!o.isBone || (o.parent&&o.parent.isBone)) return;   // 본 트리의 최상단만 검사
    let hasMesh=false; o.traverse(c=>{ if(c!==o && (c.isMesh||c.isSkinnedMesh)) hasMesh=true; });
    if(!hasMesh){ o.visible=false; o._boneRoot=true; } }); }
// 총을 손 위치에 부착(정적 메시 — 본 없으니 모델 로컬 좌표로 직접 배치). anim 자식 → yaw/숙임/사망 따라감
function attachGun(anim, id){
  if(!guns[id]) return null;
  const cfg=GUN_CFG[id]||GUN_CFG.marine;
  const gun=cloneSkinned(guns[id]);
  const gb=new THREE.Box3().setFromObject(gun); const glong=Math.max(.001, Math.max(gb.max.x-gb.min.x, gb.max.y-gb.min.y, gb.max.z-gb.min.z));
  gun.scale.setScalar(cfg.len/glong);
  gun.rotation.set(cfg.rot.x, cfg.rot.y, cfg.rot.z);
  const pivot=new THREE.Group(); pivot.position.set(cfg.pos.x, cfg.pos.y, cfg.pos.z); pivot.add(gun);  // 반동/장전은 pivot 이동·회전
  anim.add(pivot);
  return pivot;   // 총구 섬광은 2D 스파크(게임 캔버스)
}

// 🎨 플레이어 구분 틴트 — 같은 유닛이라도 소유 플레이어 색으로 본체를 물들여 구분(적/아군 구분 아님, 슬롯별 색)
//   HSV로 분해해 명도(V)는 원본 그대로 두고 색조(H)·채도(S)만 플레이어색으로 끌어옴
//   → 단색 lerp와 달리 재질의 음영·굴곡 디테일이 그대로 살아있으면서 색은 확실히 플레이어색이 됨
// 플레이어 hex → 틴트 파라미터(색조 · 채도 · 명도배율). 팔레트 hex의 HSL이 곧 파라미터(단일 소스)
//   채도·명도까지 실어야 갈색(주황과 같은 색조인데 어둡고 탁함)·흰색(무채색)을 8색에 쓸 수 있다
// ⚠ 튜닝은 반드시 인게임 조명(ACES 톤매핑 1.25 + RoomEnvironment + 4광원)에서 재야 한다.
//   건물 초상 렌더러에는 자동 노출이 있어 실제보다 채도가 높게 보인다 — 대조표만 보고 낮추면 인게임에서 회색이 된다.
//   인게임 실측 평균 채도: SGAIN 1.00 → 0.382 · 0.88 → 0.319 · 0.72 → 0.237(회색으로 무너짐)
// ACES 톤매핑이 채도를 크게 깎으므로, 팔레트 채도를 그대로 넣으면(1.0) 액센트가 0.40까지 떨어져 탁해진다.
//   1.35로 미리 올려 두면 톤매핑 후 팔레트 색 그대로 복원된다 — 실측 액센트 채도:
//   1.00 → 0.40(탁함) · 1.35 → 0.62(파랑0.64 빨강0.81 노랑0.83 주황0.91) · 1.70 → 0.76(과함)
//   갈색 0.39·흰색 0.19는 배율을 곱해도 낮게 남아 "탁한 갈색·무채색 흰색" 성격이 유지된다
const TINT_SGAIN=1.35;   // 전체가 연해 보이는 조절은 채도가 아니라 아래 액센트 마스크 면적으로 한다
const TINT_VREF=0.58;    // 명도 배율의 기준 L(이 밝기면 배율 1.0)
// 채도 완화 — 쨍한 색만 조금 낮추고, 원래 탁한 색(갈색·흰색)은 건드리지 않는다.
//   갈색은 "낮은 채도"가 정체성이라 같이 낮추면 회색이 되어 다른 색과 구분이 사라진다.
const TINT_SOFT=0.85;    // 고채도 색에 적용할 배율(1.0=완화 없음)
const TINT_SOFT_LO=0.45; // 이 채도 이하는 완화 0%(갈색 0.42·흰색 0.05 → 원본 유지)
const TINT_SOFT_HI=0.65; // 이 채도 이상은 완화 100%(빨강 0.68·노랑 0.80·주황 0.85)
// ⚠ getHSL()은 기본이 working(선형) 색공간이라 채도가 부풀고 명도가 눌린다(빨강: sRGB S.68 L.50 → 선형 S.94 L.35).
//    그러면 갈색·주황이 둘 다 고채도로 뭉개져 구분이 사라지므로 반드시 sRGB 기준으로 읽는다.
function _tintTargetOf(hex){ const c=new THREE.Color(hex); const hsl={}; c.getHSL(hsl, THREE.SRGBColorSpace);
  const t=Math.max(0, Math.min(1, (hsl.s-TINT_SOFT_LO)/(TINT_SOFT_HI-TINT_SOFT_LO)));   // 팔레트 채도에 비례한 완화량
  const soft=1+(TINT_SOFT-1)*(t*t*(3-2*t));                                             // smoothstep
  return new THREE.Vector3(hsl.h, Math.min(1, hsl.s*TINT_SGAIN*soft), Math.max(0.5, Math.min(1.2, hsl.l/TINT_VREF))); }
// 공유 uniform: 화면의 모든 내 모델이 한 번에 색 전환(관전 시 대상 플레이어 색으로 즉시 스왑)
const playerTintU={value:_tintTargetOf(PLAYER_COLOR)};
function setPlayerTint(hex){ playerTintU.value.copy(_tintTargetOf(hex)); }
function _tintable(id){ if(typeof id!=='string') return false;
  if(id.indexOf('res_')===0 || id.indexOf('temple')===0) return false;   // 중립 자원 노드·신전 = 소유자 없음
  const _EM=(typeof ENEMY_MODEL!=='undefined')?ENEMY_MODEL:((typeof window!=='undefined'&&window.ENEMY_MODEL)||{});
  if(Object.values(_EM).includes(id)) return false;   // NPC 웨이브 적(플레이어 소속 아님) → 원본 색 유지해야 내 유닛과 구분됨
  return true; }
// 색조·채도는 항상 100% 치환한다(비율 상수 없음) — 부분 치환은 중간 색조(분홍 등)를 만들어
// 플레이어색이 아닌 색이 나오므로, 세기 조절은 오직 아래 액센트 마스크 면적으로만 한다
const TINT_VMAX=0.88;         // 명도 상한 — 과노출로 흰색에 뜨는 것만 억제(너무 낮추면 전체가 어두워짐)
// 액센트가 안 걸린 "본체"의 채도 배율. 원본 그대로 두면 유닛마다 원 텍스처 색이 달라
//   같은 플레이어인데도 유닛별로 전체 인상이 제각각이 된다 → 본체를 중성 회색으로 눌러 통일하고
//   색 정보는 액센트에만 남긴다(회색 본체 + 플레이어색 포인트 = 유닛 간 톤 일치).
//   0.28로는 부족했다 — 원본이 강한 파랑인 탱크·전투기는 여전히 파랗게 남아 마린·골리앗(빨강)과 갈렸다.
//   0.10이면 어떤 유닛이든 본체가 사실상 회색이 되어, 색 정보는 액센트(플레이어색)에만 남는다.
const TINT_UBASE=0.10;        // 유닛 본체 채도 배율(0=완전 무채색, 1=원본 유지)
const TINT_AE_BASE=0.25;      // 에테리얼 유닛 본체 채도 배율 — 회색 느낌(1=원본색). 다른 종족(TINT_UBASE 0.10)보다는 덜 회색
const TINT_SW_BASE=0.5;       // 스웜 유닛 본체 채도 배율 — 약간 회색감(1=원본색)
const TINT_AE_SAT=1.4;        // 에테리얼 포인트(액센트) 채도 상향 — 본체는 원본색 유지, 포인트 색만 더 진하게(채도↑). 값이 클수록 완전 파랑/빨강에 가까워짐(1=플레이어 채도 그대로)
const TINT_AE_VMUL=0.55;      // 에테리얼 포인트 명도 배율 — 반사값을 눌러 유니온처럼 음영 있는 금속 톤(하드클립 대신 스케일이라 밝은 부위도 그라데이션 유지 → 질감↑). 본체는 base=1.0라 무관
const TINT_AE_BAND=0.13;      // 에테리얼 포인트 마스크 전이 폭 — 공통(0.06)보다 넓혀 색 경계를 부드럽게(그라데이션)
// 🎯 액센트 마스크 — 전체를 물들이지 않고 "포인트로만" 넣기 위한 범위.
//   원본 알베도에서 이미 채색된 부분(도색 패널·라이트)만 플레이어색이 되고, 회색 금속·콘크리트는 원본 유지.
//   스타 원작의 팀컬러 영역과 같은 결과 — 원작자가 칠해둔 자리가 곧 팀컬러 자리가 된다.
//   마스크는 조명 전 알베도 채도로 계산해야 한다(조명 후에는 환경광 색이 전체에 섞여 마스크가 무의미해짐).
//   마스크를 흑백으로 렌더해 실측한 평균 적용 면적: 0.16~0.42 → 74%(거의 전체) · 0.42~0.68 → 44%
//   · 0.55~0.80 → 28%(포인트로 적당) · 0.65~0.88 → 17%(첨탑·팩토리는 1~2%까지 떨어져 소유주 판별 불가)
//   경계는 좁을수록 좋다 — 넓으면 액센트가 0.5~0.9의 어중간한 마스크로 칠해져 색이 탁해진다(0.55~0.80 → 0.58~0.68로 좁혀 순도 0.373→0.403)
// 모델마다 텍스처 채도 분포가 완전히 달라서(마린 3.6% ↔ 스카이가드 34%) 공통 임계값으로는 절대 통일이 안 된다.
//   → 모델별로 "칠해지는 면적이 18%(전함 기준)가 되는 채도 임계값"을 오프라인 탐색해 표로 박았다.
//   측정은 마스크를 흑백 렌더 → sRGB→선형 역변환 후 평균(감마 보정 없이 재면 floor 0.04가 0.22로 부풀려짐).
const TINT_BAND=0.06;         // 마스크 전이 폭 — 좁을수록 경계가 또렷해 얼룩덜룩함이 줄어든다
const TINT_M0S={
  marine:0.40, ghost:0.18, medic:0.30, worker_human:0.62, machinegun:0.43, racer:0.52, tank:0.60,
  goliath:0.52, skyguard:0.63, hellfire:0.32, pelican:0.56, dreadnought:0.61, aegis:0.15,
  hydra:0.33, snapper:0.34, thornqueen:0.32, matron:0.47, overlord:0.41, stinger:0.60, venom:0.45,
  medusa:0.42, wyvern:0.33, behemoth:0.40, worker_swarm:0.32, broodling:0.20, ultralisk:0.44, swarm_larva:0.55,
  dragoon:0.91, archon:0.71, blade:0.72, skydancer:0.67, kronos:0.79, seraph:0.81, archangel:0.82,
  falcon:0.82, observer:0.84, worker_light:0.81, dark_templar:0.31, high_templar:0.41, reaver:0.90, larva:0.76,
  cb_union_command_center:0.60, cb_union_supply_depot:0.47, cb_union_refinery:0.41, cb_union_barracks:0.64,
  cb_union_academy:0.48, cb_union_engineering_bay:0.57, cb_union_bunker:0.57, cb_union_missile_turret:0.63,
  cb_union_factory:0.49, cb_union_machine_shop:0.57, cb_union_armory:0.45, cb_union_starport:0.52,
  cb_union_control_tower:0.64, cb_union_science_facility:0.63, cb_union_covert_ops:0.59,
  cb_union_physics_lab:0.55, cb_union_comsat_station:0.49, cb_union_nuclear_silo:0.52,
  cb_swarm_hatchery:0.48, cb_swarm_extractor:0.47, cb_swarm_spawning_pool:0.56, cb_swarm_evolution_chamber:0.45,
  cb_swarm_hydralisk_den:0.46, cb_swarm_creep_colony:0.35, cb_swarm_sunken_colony:0.37, cb_swarm_spore_colony:0.18,
  cb_swarm_lair:0.34, cb_swarm_spire:0.40, cb_swarm_queens_nest:0.49, cb_swarm_hive:0.34,
  cb_swarm_greater_spire:0.35, cb_swarm_defiler_mound:0.41, cb_swarm_ultralisk_cavern:0.45, cb_swarm_nydus_canal:0.39,
  cb_aetherial_nexus:0.77, cb_aetherial_pylon:0.90, cb_aetherial_gateway:0.67, cb_aetherial_assimilator:0.70,
  cb_aetherial_forge:0.81, cb_aetherial_photon_cannon:0.76, cb_aetherial_cybernetics_core:0.81,
  cb_aetherial_shield_battery:0.85, cb_aetherial_stargate:0.72, cb_aetherial_fleet_beacon:0.88,
  cb_aetherial_arbiter_tribunal:0.74, cb_aetherial_robotics_facility:0.75, cb_aetherial_robotics_support_bay:0.76,
  cb_aetherial_observatory:0.68, cb_aetherial_temple_of_adun:0.85, cb_aetherial_templar_archives:0.84 };
const TINT_M0_DEF=0.58;       // 표에 없는 모델의 기본 임계값
const TINT_MFLOOR=0.02;       // 마스크 하한 — 거의 0(본체를 깔끔한 회색으로 두기 위해)
// 보병(작고 원본이 어두운 모델)만 액센트가 검붉게 죽는다 — 원본 음영을 그대로 곱하기 때문.
//   ⚠ 이 하한을 전 유닛에 걸면 차량·공중까지 색이 진해진다(그렇게 했다가 되돌림) → 보병에만 적용한다.
const TINT_IMIN=0.16;         // 보병 액센트 명도 하한(그 외 유닛·건물은 0 = 원본 음영 그대로)
// 유닛 액센트 명도 압축 — 원본 텍스처 밝기가 모델마다 달라(비행충=밝음→파스텔 / 스내퍼=어두움→검붉음)
//   같은 플레이어색인데 진하기·재질감이 제각각으로 보임. 중간값(VMID)으로 당겨 유니온 수준으로 수렴.
const TINT_VMID=0.50;         // 수렴 기준 명도(유니온 금속류의 중간 명도)
const TINT_VKEEP=0.60;        // 원본 음영 유지율(1=압축 없음, 0=완전 평탄) — 디테일은 남기고 밝기만 수렴
const TINT_VFLOOR=0.0;        // 명도 하한 없음 — 검정 방지용 회색 들어올림 제거(대비 유지, 어두운 부위는 원래대로)
const TINT_INF_IDS=new Set(['marine','ghost','medic','worker_human','worker_swarm','worker_light',
  'broodling','stinger','dark_templar','high_templar']);   // 스펙 size ≤ 15 소형 보병
// 건물 모델 판정 — 건설용 사본(cb_) + 메인 맵의 방어/업그레이드 구조물 키
const TINT_BLDG_IDS=new Set(['turret','photon','acad','arm','forge','evo','pointlab']);
// 틴트 종류: 'b'=건물 · 'i'=보병(명도 하한만 추가) · 'u'=그 외 유닛
//   셋 다 "포인트 칠" 방식은 동일하고, 보병만 어두워서 액센트 명도 하한이 붙는다.
function _tintKind(id){ if(typeof id!=='string') return 'u';
  if(id.indexOf('cb_')===0 || TINT_BLDG_IDS.has(id)) return 'b';
  return TINT_INF_IDS.has(id) ? 'i' : 'u'; }
// 모델 종족 판정 — 유닛=RACE_OF / 건물=cb_ 접두사. 명도 압축을 유니온만 제외(유니온=기준·이전버전 유지)하려고 씀
function _tintRace(id){ if(typeof id!=='string') return null;
  if(id.indexOf('cb_')===0){ const m=id.slice(3);
    return m.indexOf('union_')===0?'union':m.indexOf('swarm_')===0?'swarm':m.indexOf('aetherial_')===0?'aetherial':null; }
  const R=(typeof RACE_OF!=='undefined')?RACE_OF:((typeof window!=='undefined'&&window.RACE_OF)||{});
  return R[id]||null; }
// 에테리얼 유닛(건물 제외) — 본체 원본색 + 포인트만 도색(음영 유지·부드러운 경계)
function _aeUnit(id){ return typeof id==='string' && id.indexOf('cb_')!==0 && id.indexOf('aetherial')!==0 && _tintRace(id)==='aetherial'; }
// 프래그먼트 셰이더에 HSV 틴트 삽입 — 알베도가 아니라 "조명까지 반영된 최종 색"에 적용.
//   (알베도 단계에서는 조명 후 밝기를 알 수 없어, 밝게 조명되는 건물만 하얗게 뜨는 문제가 있었다)
//   톤매핑 이후로 옮겨도 채도 차이가 없어(0.236→0.230) 표준 위치인 톤매핑 앞을 유지한다.
// 명도(V)는 원본 음영을 유지한 채 플레이어 명도배율만 곱함 → 모델 굴곡·디테일은 그대로
function _toneChunk(){ return '\nuniform vec3 toneT;\n'
  +'vec3 _r2h(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)), d/(q.x+1e-10), q.x); }\n'
  +'vec3 _h2r(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }\n'; }
// ① 알베도 단계: 도색된 부분만 골라내는 마스크를 만들어 둔다(조명 전이라 원본 의도가 그대로 남아 있음)
//   임계값은 모델별 표(TINT_M0S) — 전 모델이 같은 면적(18%)으로 칠해지도록 미리 계산해 둔 값
function _tintM0(id){ if(typeof id!=='string') return TINT_M0_DEF;
  const v=TINT_M0S[id]; if(v!=null) return v;
  const c=TINT_M0S['cb_'+id]; if(c!=null) return c;                       // 초상 렌더는 cb_ 접두사 없이 들어온다
  return TINT_M0S[id.replace(/^cb_/,'')]!=null ? TINT_M0S[id.replace(/^cb_/,'')] : TINT_M0_DEF; }
function _toneMask(id){ const m0=_tintM0(id), m1=Math.min(1, m0+(_aeUnit(id)?TINT_AE_BAND:TINT_BAND));
  return 'float _tintM=max('+TINT_MFLOOR.toFixed(2)+', smoothstep('+m0.toFixed(2)+', '+m1.toFixed(2)+', _r2h(diffuseColor.rgb).y));'; }
// ② 조명 후 단계: "완전히 틴트된 색"을 먼저 만들고, 마스크로 원본과 섞는다(면적만 마스크가 결정).
//   ⚠ 마스크를 색조 회전량에 곱하면 안 된다 — 마스크 0.5인 곳은 파랑→빨강 중간인 '분홍'이 되어
//     플레이어색이 아닌 엉뚱한 색이 나온다. 회전은 항상 100%로 하고, 섞는 비율만 마스크로 조절해야
//     액센트가 팔레트 색 그대로(완전 파랑·완전 빨강·완전 노랑) 나온다.
const TINT_AEGIS_LIGHTEN=1.3;   // 지원정찰기(aegis) 액센트 명도 부스트 — 색을 조금 연하게(밝게), 모함(archangel) 수준
const TINT_BASE_OVR={aegis:1.0, archangel:1.0};   // 유닛별 본체 채도 오버라이드 — aegis·archangel은 원본 금속 질감 유지 위해 채도 원본(1.0), 포인트만 도색
function _toneApply(kind, race, id){
  let base=(kind==='b')?1.0:(race==='aetherial'?TINT_AE_BASE:race==='swarm'?TINT_SW_BASE:TINT_UBASE);   // 에테리얼·스웜=약간 회색(부분 채도↓), 유니온보다 덜하게
  if(kind!=='b' && typeof id==='string' && TINT_BASE_OVR[id]!=null) base=TINT_BASE_OVR[id];   // 유닛별 회색 오버라이드
  // 명도 압축 사용 안 함 — 3종족(유니온·스웜·에테리얼) 모두 압축 없이 원본 음영 그대로(같은 경로). 압축은 대비를 죽여 색이 연해짐
  const compress=false;
  const aeUnit=(race==='aetherial' && kind!=='b');   // 에테리얼 유닛: 포인트에 명도 배율·채도 상향(base=1.0인 archangel은 본체 무관, 액센트만 통일)
  return '{ vec3 _hs=_r2h(outgoingLight);\n'
  +(aeUnit?('  _hs.z*='+TINT_AE_VMUL.toFixed(2)+';\n'):'')   // 포인트 명도 배율(스케일) → 밝은 부위도 음영 유지, 유니온처럼 어두운 금속 톤
  +'  vec3 _base=outgoingLight;\n'
  +((base<1)?('  { vec3 _b=_hs; _b.y*='+base.toFixed(2)+'; _base=_h2r(_b); }\n'):'')   // 본체 채도↓
  +'  _hs.x=toneT.x;\n'                                                        // 색조 = 플레이어 색조로 완전 치환
  +'  _hs.y='+(aeUnit?'min(1.0, toneT.y*'+TINT_AE_SAT.toFixed(2)+')':'toneT.y')+';\n'   // 채도 = 플레이어 채도(에테리얼 포인트는 채도↑로 더 진하게)
  +'  _hs.z='+(compress?'max(_hs.z,'+TINT_VFLOOR.toFixed(2)+')':'_hs.z')+';\n'   // 스웜·에테리얼: 액센트도 검정 방지 하한
  +'  _hs.z=clamp(_hs.z, '+((kind==='i')?TINT_IMIN:0).toFixed(2)+', '+TINT_VMAX.toFixed(2)+');\n'
  +((id==='aegis')?('  _hs.z=min('+TINT_VMAX.toFixed(2)+', _hs.z*'+TINT_AEGIS_LIGHTEN.toFixed(2)+');\n'):'')   // aegis: 액센트 명도↑ → 색 연하게(모함 수준)
  // 스웜·에테리얼: 액센트 명도를 유니온 기준(VMID)으로 압축 — 원본 텍스처가 밝은/어두운 모델의 진하기 편차를 유니온에 수렴
  +(compress?('  _hs.z='+TINT_VMID.toFixed(2)+'+(_hs.z-'+TINT_VMID.toFixed(2)+')*'+TINT_VKEEP.toFixed(2)+';\n'):'')
  +'  _hs.z*=toneT.z;\n'                                                       // × 플레이어 명도배율(갈색=어둡게, 흰색=밝게)
  +'  outgoingLight=mix(_base, _h2r(_hs), _tintM); }'; }                       // 회색 본체 ↔ 플레이어색 액센트
function _toneInject(shader, tone, id){ shader.uniforms.toneT=tone;   // tone=uniform 객체 자체(공유 or 인스턴스 전용)
  shader.fragmentShader=_toneChunk()+shader.fragmentShader;
  const mAnchor=(shader.fragmentShader.indexOf('#include <alphamap_fragment>')>=0)?'#include <alphamap_fragment>':'#include <alphatest_fragment>';
  shader.fragmentShader=shader.fragmentShader.replace(mAnchor, mAnchor+'\n'+_toneMask(id));   // 마스크는 알베도 확정 직후에 계산
  const anchor=(shader.fragmentShader.indexOf('#include <opaque_fragment>')>=0)?'#include <opaque_fragment>':'#include <output_fragment>';   // three 버전별 최종 출력 청크
  shader.fragmentShader=shader.fragmentShader.replace(anchor, _toneApply(_tintKind(id), _tintRace(id), id)+'\n'+anchor); }
function addTone(mat, tone, id){ if(!tone || !('emissive' in mat)) return;
  // ⚠ three는 customProgramCacheKey가 없으면 재질 파라미터로 프로그램을 캐싱한다.
  //   NPC 공유 모델(레이스·전함 등)은 베이스가 "림만(틴트 없음)"으로 먼저 컴파일돼 있어,
  //   복제 후 틴트 onBeforeCompile을 걸어도 캐시된 림-전용 프로그램을 재사용해 틴트가 무시됐다(공중유닛 색 안 바뀜).
  //   모델별 고유 키를 줘서 틴트 프로그램을 새로 컴파일하게 한다(임계값·kind가 id로 결정되므로 id로 충분).
  mat.customProgramCacheKey=()=>'ptint_'+(id||'');
  mat.onBeforeCompile=(shader)=>{ _toneInject(shader, tone, id); }; mat.needsUpdate=true; }
// NPC 웨이브 적과 모델을 공유하는 유닛(레이스·발키리·드랍쉽·배틀 등)은 베이스 재질에 틴트를 걸 수 없다
//   — 걸면 적 웨이브까지 내 색으로 물든다. 그래서 "플레이어가 소유한 인스턴스"에만 재질을 복제해 틴트한다.
//   공유 uniform(playerTintU)을 그대로 쓰므로 1P~8P 전환도 똑같이 즉시 반영된다.
function applyPlayerTintInst(m, id){ if(!m||m._pTint) return;
  const _EM=(typeof ENEMY_MODEL!=='undefined')?ENEMY_MODEL:((typeof window!=='undefined'&&window.ENEMY_MODEL)||{});
  if(!Object.values(_EM).includes(id)) return;   // 베이스에서 이미 틴트된 모델은 그대로
  m._pTint=true;
  const fix=function(root){ if(!root) return; root.traverse(o=>{ if(!o.isMesh||!o.material) return;
    const arr=Array.isArray(o.material), ms=arr?o.material:[o.material];
    const out=ms.map(mat=>{ if(!mat||!('emissive' in mat)) return mat; const c=mat.clone(); addRim(c, playerRim, rimIntU, playerTintU, id); return c; });   // 틴트 + 플레이어색 림(공유 모델도 게임/건설서 림 표시)
    o.material=arr?out:out[0]; }); };
  fix(m.inner); fix(m.runInner); fix(m.atkInner); fix(m.stayInner); }
// 인스턴스 전용 틴트(직스 등 한 화면에 여러 플레이어) — 재질 복제 후 자기 색 uniform 부여
function applyTeamTint(m, hex){ if(!m||m._teamTint===hex) return; m._teamTint=hex;
  const u={value:_tintTargetOf(hex)};
  const fix=function(root){ if(!root) return; root.traverse(o=>{ if(!o.isMesh||!o.material) return;
    const arr=Array.isArray(o.material), ms=arr?o.material:[o.material];
    const out=ms.map(mat=>{ if(!mat||!('emissive' in mat)) return mat; const c=mat.clone(); addTone(c, u, (m&&m.id)||''); return c; });
    o.material=arr?out:out[0]; }); };
  fix(m.inner); fix(m.runInner); fix(m.atkInner); fix(m.stayInner); }
function toneModel(root, id){ if(!_tintable(id)) return;
  root.traverse(o=>{ if(!o.isMesh) return; const ms=Array.isArray(o.material)?o.material:[o.material];
    ms.forEach(m=>{ if(m&&!m._toned){ addTone(m, playerTintU, id); m._toned=true; } }); }); }
// 모델 재질을 타입색 쪽으로 살짝 칠하고 약한 발광 부여(클론들이 재질 공유 → 베이스 1회만 적용)
function tintModel(root, id){
  // 본체는 원본 자연색 유지, 테두리(림)만 소유자 색으로 은은하게 발광 — 아군=플레이어색 / 적=붉은빛 / 기타=차가운 흰빛
  const isPlayer = PLAYER_MODELS.has(id) || (typeof window!=='undefined' && window.__sandbox);   // 샌드박스: 적 모델도 동일(아군) 림으로 통일
  const _EM = (typeof ENEMY_MODEL!=='undefined') ? ENEMY_MODEL : ((typeof window!=='undefined'&&window.ENEMY_MODEL)||{});
  const isEnemy = Object.values(_EM).includes(id);  // observer/overlord
  const rim = isPlayer ? playerRim   // 아군은 공용 림 색(관전 시 한번에 색 전환 가능)
                       : new THREE.Color(isEnemy ? ENEMY_RIM : NEUTRAL_RIM);
  const intU = isPlayer ? rimIntU : subRimIntU;   // 적·기타는 고정 은은(관전 부스트 영향 X) — 내 유닛처럼
  const isTemple = (typeof id==='string') && id.indexOf('temple')===0;   // 직스 신전 → 사막 톤으로 통일
  const _tone = _tintable(id) ? playerTintU : null;   // 플레이어 구분 틴트(중립 자원·신전 제외)
                      // 건물/유닛에 따라 액센트 마스크 임계값이 다름
  root.traverse(o=>{ if(!o.isMesh) return; const ms=Array.isArray(o.material)?o.material:[o.material];
    ms.forEach(m=>{ if(!m||m._tinted) return;
      if(isTemple && m.color){   // 채도↓ + 사막 warm 톤 곱 + 약간 어둡게 → 배경 사막과 한 덩어리
        const l=m.color.r*0.299+m.color.g*0.587+m.color.b*0.114;
        m.color.lerp(new THREE.Color(l,l,l), 0.4);          // 채도 40% 감소
        m.color.multiply(new THREE.Color(0.82,0.72,0.55));  // 사막 톤 + 어둡게
        if('emissiveIntensity' in m) m.emissiveIntensity*=0.55;
        if('roughness' in m) m.roughness=Math.min(1, (m.roughness==null?0.7:m.roughness)+0.18);   // 무광에 가깝게(거친 돌)
      }
      if('envMapIntensity' in m) m.envMapIntensity = isTemple?0.32:0.55;   // 신전은 반사 더 낮춰 사막 톤 유지
      if(m.color && typeof id==='string' && id.indexOf('cb_')===0){
        if(id==='cb_swarm_extractor'){ m.color.r*=1.24; m.color.g*=1.10; m.color.b*=1.26; }   // 익스트랙터: 원래 어둡고 초록 → 밝기↑·초록기↓
        else { m.color.r*=1.045; m.color.g*=1.02; m.color.b*=1.05; }                          // 그 외 건설 건물(전 종족): 익스트랙터와 같은 성격(밝기↑·초록기↓)을 아주 연하고 미세하게만
      }
      if(m.emissive && m.emissive.r>0.85 && m.emissive.g>0.85 && m.emissive.b>0.85 && ((m.emissiveIntensity==null)||m.emissiveIntensity>0.05)){
        if(!m.emissiveMap){ m.emissive.setRGB(0,0,0); }   // 맵 없는 균일 흰색 발광 = 모델 전체가 하얗게 뜸(워시아웃) → 제거
        else if('emissiveIntensity' in m){ m.emissiveIntensity=Math.min(m.emissiveIntensity==null?1:m.emissiveIntensity, 0.6); }   // ⚠ 맵이 있으면 선택적 발광(균열·발광부만) → null 하면 그 부위가 검정 디퓨즈만 남아 검게 뜸(산성충·돌격괴수 등). 맵 유지하고 강도만 완화
        m.needsUpdate=true; }
      // 대기 모델 색 살리기: 이동(run) 모델엔 발광맵이 있으나 대기(idle) 모델엔 없어 칙칙 → 자기 베이스맵을 발광맵으로 부여해 통일.
      //   조건 '베이스맵 있음 & 발광맵 없음'이 이동 모델(발광맵 보유)을 자연 제외 → 대기 모델에만 적용됨.
      else if(IDLE_GLOW.has(id) && m.map && !m.emissiveMap && ('emissiveIntensity' in m) && m.emissive){
        m.emissiveMap=m.map; m.emissive.setRGB(1,1,1); m.emissiveIntensity=(IDLE_GLOW_INT_OVR[id]||IDLE_GLOW_INT); m.needsUpdate=true; }
      if(typeof id==='string'&&id.indexOf('res_')===0){ if('envMapIntensity' in m) m.envMapIntensity=0.28; if('emissiveIntensity' in m && m.emissiveIntensity) m.emissiveIntensity*=0.4; if(m.emissive) m.emissive.multiplyScalar(0.4); if(id==='res_cn' && m.color) m.color.multiplyScalar(0.62); }   // 자원 노드(res_)=림·발광 없이 자연 톤 · 미네랄은 톤 더 낮춤(너무 밝음)
      else if(!(typeof id==='string'&&id.indexOf('cb_')===0)) addRim(m, rim, intU, _tone, id);   // 건설 건물(cb_)은 림 생략 / 그 외 프레넬 림
      else addTone(m, _tone, id);                                                                // 건설 건물(cb_): 림 없이 플레이어 틴트만
      m._tinted=true; }); });
}
// 색칠 없이 림만 입힘(총 등 — 타입색 테두리만 발광)
function rimModel(root, rimColor){ root.traverse(o=>{ if(!o.isMesh) return; const ms=Array.isArray(o.material)?o.material:[o.material];
  ms.forEach(m=>{ if(!m||m._tinted) return; addRim(m, rimColor); m._tinted=true; }); }); }
// 샌드박스: 적 표시 유닛을 아군처럼 — 머티리얼 복제 후 공용 플레이어 림만 적용(본체 틴트 없음 · 베이스/일반게임 무영향)
// 샌드박스(관리자): 모든 유닛이 내 소유 → 인스턴스 재질 복제 후 플레이어 틴트 적용.
//   ⚠ 예전엔 여기서 addRim(림)을 걸었는데, 그게 틴트의 onBeforeCompile을 덮어써 색이 안 바뀌었다.
//   이제 addTone(플레이어색 틴트)을 걸어야 ENEMY_MODEL 공유 모델(옵저버·오버로드 등)까지 색이 전환된다.
function sandboxAllyFix(m, id){ if(!m||m._sbAlly) return; m._sbAlly=true;
  const fix=function(root){ if(!root) return; root.traverse(o=>{ if(!o.isMesh||!o.material) return;
    const arr=Array.isArray(o.material), ms=arr?o.material:[o.material];
    const out=ms.map(mat=>{ if(!mat||!('emissive' in mat)) return mat; const c=mat.clone(); addRim(c, playerRim, rimIntU, playerTintU, id); return c; });   // 틴트 + 플레이어색 림(작을 때 색 식별) — addRim이 _toneInject 먼저 걸어 색 전환도 정상
    o.material=arr?out:out[0]; }); };
  fix(m.inner); fix(m.runInner); fix(m.atkInner); fix(m.stayInner); }
// 직스 적군 본체 적색 틴트는 제거 — 림과 마찬가지로 모델 원본 외형 그대로 표시(구분은 HP 바·UI로)
// 밝은 림 색 — 아군은 플레이어색, 그 외 중립
function unitRim(id){ return PLAYER_MODELS.has(id) ? playerRim : new THREE.Color(NEUTRAL_RIM); }
// 재질 셰이더에 프레넬 림(가장자리 발광) 주입 — 시점 기준 실루엣이 항상 빛나 배경과 분리(MeshStandard/Physical)
function addRim(mat, rimColor, intU, tone, id){
  if(!('emissive' in mat)) return;   // 빛 받는 재질만(basic 등 제외)
  if(tone) mat.customProgramCacheKey=()=>'ptint_'+(id||'');   // 모델별 틴트 임계값이 프로그램에 박히므로 고유 키(캐시 충돌·재사용 방지)
  mat.onBeforeCompile=(shader)=>{
    if(tone) _toneInject(shader, tone, id);   // 플레이어 액센트 틴트 → 그 위에 림
    shader.uniforms.rimColor={value:rimColor};
    shader.uniforms.rimInt=intU||rimIntU;   // 아군=rimIntU(관전 부스트) / 적·기타=subRimIntU(고정 은은)
    shader.uniforms.rimPow={value:RIM_POW};
    shader.fragmentShader='uniform vec3 rimColor;\nuniform float rimInt;\nuniform float rimPow;\n'+shader.fragmentShader;
    const _rmul=(typeof RIM_MUL!=='undefined'&&RIM_MUL[id])||1;   // 평평한 유닛(aegis 등) 림 강도 개별 부스트
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  float _rim=pow(1.0-max(dot(normalize(normal), vec3(0.0,0.0,1.0)),0.0), rimPow);\n  totalEmissiveRadiance += rimColor*_rim*rimInt*'+_rmul.toFixed(2)+';');
  };
  mat.needsUpdate=true;
}
// 검 전용 림 — 납작한 칼날도 각도 무관하게 플레이어색이 보이도록 넓은 프레넬 + 은은한 베이스 글로우
function addSwordRim(mat, rimColor){
  if(!('emissive' in mat)) return;
  mat.onBeforeCompile=(shader)=>{
    shader.uniforms.rimColor={value:rimColor};
    shader.uniforms.rimInt=rimIntU;
    shader.fragmentShader='uniform vec3 rimColor;\nuniform float rimInt;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  float _rim=pow(1.0-max(dot(normalize(normal), vec3(0.0,0.0,1.0)),0.0), 1.0);\n  totalEmissiveRadiance += rimColor*(_rim + 0.25)*rimInt;');  // 넓은 림 + 0.25 베이스(양면 모두 색)
  };
  mat.needsUpdate=true;
}
function applySwordRim(root, rimColor){ root.traverse(o=>{ if(!o.isMesh) return; const ms=Array.isArray(o.material)?o.material:[o.material];
  ms.forEach(m=>{ if(m&&!m._swrim){ addSwordRim(m, rimColor); m._swrim=true; } }); }); }
// 인스턴스별 재질 복제(클로킹 등 개별 투명도용) — 공유재질이면 한 마리만 바꿔도 전체 영향이라 복제
function cloneMats(obj){ const list=[];
  const cl=(mm)=>{ const c=mm.clone(); c.transparent=true; c.onBeforeCompile=mm.onBeforeCompile; c.needsUpdate=true; return c; };  // 림(onBeforeCompile) 유지
  obj.traverse(o=>{ if(!o.isMesh) return;
    if(Array.isArray(o.material)){ o.material=o.material.map(mm=>{ const c=cl(mm); list.push(c); return c; }); }
    else if(o.material){ o.material=cl(o.material); list.push(o.material); } });
  return list; }
// 🪄 클로킹 렌더: 아군 모델을 런타임 반투명/투명 처리(적 클로킹과 동일한 재질복제+opacity 방식)
//   targetOp=1 정상 · 0.42 감지/선택(반투명 유령) · 0.0 미감지(완전 투명, 배경 일렁임은 cvFx)
function _applyCloak(m, targetOp, dt){ if(!m||!m.anim) return;
  if(!m._cloakMats){ if(targetOp>=1) return; try{ m._cloakMats=cloneMats(m.anim); }catch(e){ m._cloakMats=null; return; } m._cloakOp=1; }
  const cur=(m._cloakOp==null?1:m._cloakOp), nx=cur+(targetOp-cur)*Math.min(1, dt*6); m._cloakOp=nx;
  for(const mt of m._cloakMats){ mt.transparent=true; mt.opacity=nx; mt.depthWrite=nx>0.6; }
  if(m.shadow){ m.shadow.visible=nx>0.05; if(m.shadow.material) m.shadow.material.opacity=0.26*Math.min(1,nx*1.6); }   // 완전 투명 시 그림자까지 숨김(상대 시점 미노출)
  if(m.rim && nx<=0.02) m.rim.visible=false;   // 완전 투명 시 선택링도 숨김(미감지=완전 은폐)
}


// 그룹 구조: holder(화면위치·크기) → view(카메라 부감 tilt) → yaw(적 방향 회전) → anim(절차적) → inner(모델, 발 y=0)
// 오라용 방사형 그라데이션 텍스처(중심 밝은 청록 → 보라 → 가장자리 투명) — 1회 생성 후 공유
let _auraTex=null;
function auraTexture(){ if(_auraTex) return _auraTex;
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,0, 64,64,64);
  gr.addColorStop(0.00,'rgba(232,252,255,0.95)');
  gr.addColorStop(0.28,'rgba(120,214,255,0.50)');
  gr.addColorStop(0.60,'rgba(150,110,255,0.20)');
  gr.addColorStop(1.00,'rgba(150,110,255,0.00)');
  g.fillStyle=gr; g.fillRect(0,0,128,128);
  _auraTex=new THREE.CanvasTexture(c); return _auraTex;
}
// 사망 모션이 걸렸던 모델을 되살린다 — 쓰러짐 각도·축소 등 사망 루프가 건드린 값을 전부 원복.
// (목록에서 잠깐 빠졌다 돌아오는 경우: 직스의 화면 밖 컬링 등)
// 화면 깊이 = 관리자 건설맵(syncBuild)과 같은 규칙: **화면 아래일수록 앞**(z 큼).
// 전부 z=0이면 유닛과 신전이 같은 깊이에서 다퉈, 겹칠 때 유닛이 신전에 파묻힌다.
// 공중 유닛은 지상 무엇보다도 항상 앞(하늘을 나는 것이 건물에 가리면 안 됨).
// 직교 카메라 near/far = -2000..2000 (카메라 z=800) → 유효 z 범위 -1200..2800. 아래 값은 그 안.
const Z_AIR=2200, Z_AIR_K=0.2, Z_GND_K=2.5;
function _zOf(u, id, worldY, H){ const ny=(H-worldY)/Math.max(1,H);   // 0=화면 위 … 1=화면 아래
  return AIR_FLOAT[id] ? (Z_AIR + ny*H*Z_AIR_K) : (ny*H*Z_GND_K); }
function reviveModel(m, id){
  m.dying=false; m.deadT=0; m.lean=0;
  if(m.anim){ m.anim.rotation.x=0; m.anim.position.y=0; }
  m.holder.scale.setScalar((SCALE[id]||MODEL_SCALE)*(m.bossScale||1));   // 적 사망은 축소로 표현 → 스케일 복구
}
function makeModel(id){
  const base=bases[id]; if(!base) return null;
  const inner=cloneSkinned(base.scene);
  const _isc=(typeof IDLE_SCALE_OVR!=='undefined'&&IDLE_SCALE_OVR[id])||1;   // 대기 모델 확대(이동 크기 맞춤)
  if(_isc!==1) inner.scale.setScalar(_isc);
  const _iyaw=(typeof INNER_YAW_OFF!=='undefined'&&INNER_YAW_OFF[id])||0;   // 대기 모델 내장 정면 보정(이동 GLB와 다른 유닛)
  if(_iyaw) inner.rotation.y=_iyaw;
  { const ax=base.off.x*_isc, ay=base.off.y*_isc, az=base.off.z*_isc, c=Math.cos(_iyaw), s=Math.sin(_iyaw);
    inner.position.set(-(ax*c+az*s), -ay, ax*s-az*c); }  // -R_y(off): 회전·스케일 후에도 수평중앙 + 발 y=0 유지
  const anim=new THREE.Group(); anim.add(inner);             // 절차적 애니(숨쉬기/공격숙임/사망)
  // 에너지 오라(아칸): 소프트 헤일로 + 프레넬 에너지 보호막 셸 — 가장자리만 빛나고 중심은 투명한 버블(감싸는 느낌)
  let aura=null;
  if(AURA_UNITS[id]){ aura=[]; const cy=base.h*0.52;
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:auraTexture(),blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,transparent:true,opacity:0.22}));
    halo._base=base.h*1.8; halo.scale.set(halo._base,halo._base,1); halo.position.y=cy; anim.add(halo); aura.push(halo);   // 은은한 헤일로(빌보드)
    const shMat=new THREE.ShaderMaterial({ transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.FrontSide,
      uniforms:{ uT:{value:Math.random()*6.28}, uC1:{value:new THREE.Color(AURA_COL1)}, uC2:{value:new THREE.Color(AURA_COL2)} },
      vertexShader:'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; vV=-mv.xyz; vY=position.y; gl_Position=projectionMatrix*mv; }',
      fragmentShader:'varying vec3 vN; varying vec3 vV; varying float vY; uniform float uT; uniform vec3 uC1; uniform vec3 uC2; void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.3); float pulse=0.8+0.2*sin(uT*2.0); float band=0.10*sin(vY*26.0+uT*2.6)*f; vec3 col=mix(uC1,uC2,0.5+0.5*sin(uT*0.6)); float a=f*0.75*pulse+0.035+band; gl_FragColor=vec4(col*(0.55+f*0.9), a); }' });   // 프레넬 가장자리 발광 + 흐르는 파동 + 시안↔보라 색 흐름
    const shell=new THREE.Mesh(new THREE.SphereGeometry(base.h*0.55, 32, 24), shMat);
    shell.position.y=cy; shell._mat=shMat; anim.add(shell); aura.push(shell);   // 에너지 보호막 버블
  }
  let gun=null;
  if(GUN_FOR[id]) gun=attachGun(anim, id);                   // 오른손에 총 부착
  // 이동용 달리기 모델(리깅+클립) — 정적 마린과 크기 맞춰 anim에 추가, 평소 숨김
  let runInner=null, runMixer=null;
  if(RUN_FOR[id] && runs[id]){ const rb=runs[id], s=(base.h/rb.h)*RUN_SCALE_MUL*((typeof RUN_SCALE_OVR!=='undefined'&&RUN_SCALE_OVR[id])||1);
    runInner=cloneSkinned(rb.scene); runInner.scale.setScalar(s);
    runInner.position.set(-rb.off.x*s, -rb.off.y*s, -rb.off.z*s); runInner.visible=false; anim.add(runInner);
    runMixer=new THREE.AnimationMixer(runInner);
    let clip=THREE.AnimationClip.findByName(rb.clips, RUN_CLIP)||rb.clips[0];
    if(clip){ clip=clip.clone(); clip.tracks=clip.tracks.filter(t=>t.name.endsWith('.quaternion')); // 회전만(이동·크기 변동 제거)
      runMixer.clipAction(clip).play(); }
    if(id==='blade'){ rimModel(runInner, unitRim(id)); attachSwords(runInner, base.h); }
    else if(id==='worker_human'||id==='worker_light'||id==='worker_swarm'){ rimModel(runInner, unitRim(id)); }   // 일꾼 달리기 모델도 림 유지
  }   // 워든 이동: 림 + 쌍검(손 본)
  // 정지(대기) 애니 모델 — 이동 안 할 때 재생(절차적 호흡 대체)
  let stayInner=null, stayMixer=null;
  if(typeof STAY_FOR!=='undefined' && STAY_FOR[id] && stays[id]){ const sb=stays[id], ss=(base.h/sb.h)*RUN_SCALE_MUL*((typeof RUN_SCALE_OVR!=='undefined'&&RUN_SCALE_OVR[id])||1);
    stayInner=cloneSkinned(sb.scene); stayInner.scale.setScalar(ss);
    stayInner.position.set(-sb.off.x*ss, -sb.off.y*ss, -sb.off.z*ss); stayInner.visible=false; anim.add(stayInner);
    stayMixer=new THREE.AnimationMixer(stayInner);
    let sclip=sb.clips[0]; if(sclip){ sclip=sclip.clone(); sclip.tracks=sclip.tracks.filter(t=>t.name.endsWith('.quaternion')); stayMixer.clipAction(sclip).play(); }
    if(id==='worker_human'||id==='worker_light'||id==='worker_swarm'){ rimModel(stayInner, unitRim(id)); }
  }
  // 건설(작업) 애니 모델 — 일꾼이 건물 지을 때 반복 재생(정지 모델과 동일 구성)
  let workInner=null, workMixer=null;
  if(typeof WORK_FOR!=='undefined' && WORK_FOR[id] && works[id]){ const wb=works[id], ws=(base.h/wb.h)*RUN_SCALE_MUL*((typeof RUN_SCALE_OVR!=='undefined'&&RUN_SCALE_OVR[id])||1);
    workInner=cloneSkinned(wb.scene); workInner.scale.setScalar(ws);
    workInner.position.set(-wb.off.x*ws, -wb.off.y*ws, -wb.off.z*ws); workInner.visible=false; anim.add(workInner);
    workMixer=new THREE.AnimationMixer(workInner);
    let wclip=wb.clips[0]; if(wclip){ wclip=wclip.clone(); wclip.tracks=wclip.tracks.filter(t=>t.name.endsWith('.quaternion')); workMixer.clipAction(wclip).play(); }   // 회전만(제자리 작업)
    if(id==='worker_human'||id==='worker_light'||id==='worker_swarm'){ rimModel(workInner, unitRim(id)); }
  }
  // 공격 애니 모델(워든 검 베기) — 공격 시 1회 재생
  let atkInner=null, atkMixer=null, atkAction=null, atkDur=0.45;
  if(ATTACK_FOR[id] && atks[id]){ const ab=atks[id], s=(base.h/ab.h)*((typeof ATK_SCALE_OVR!=='undefined'&&ATK_SCALE_OVR[id])||RUN_SCALE_MUL);
    atkInner=cloneSkinned(ab.scene); atkInner.scale.setScalar(s);
    atkInner.position.set(-ab.off.x*s, -ab.off.y*s, -ab.off.z*s); atkInner.visible=false; anim.add(atkInner);
    atkMixer=new THREE.AnimationMixer(atkInner);
    let clip=ab.clips[0];
    if(clip){ const _aspd=(typeof ATK_SPEED_OVR!=='undefined'&&ATK_SPEED_OVR[id])||ATK_SPEED, _afr=(typeof ATK_FRACTION_OVR!=='undefined'&&ATK_FRACTION_OVR[id])||ATK_FRACTION; atkDur=(id==='worker_human')?1.7:((clip.duration||0.45)*_afr/_aspd); clip=clip.clone(); let _rootB=null; if(id==='worker_human'||id==='blade'||id==='snapper'){ atkInner.traverse(o=>{ if(!_rootB && o.isBone && !(o.parent&&o.parent.isBone)) _rootB=o.name; }); } clip.tracks=clip.tracks.filter(t=>t.name.endsWith('.quaternion') && !(_rootB && t.name===_rootB+'.quaternion')); // 회전만(제자리). 루트 본 회전 제외(일꾼·워든·스내퍼: 몸통이 돌아간 채 끝나 방향 튀는 문제 방지)
      atkAction=atkMixer.clipAction(clip); if(typeof ATK_LOOP!=='undefined'&&ATK_LOOP[id]){ atkAction.setLoop(THREE.LoopRepeat,Infinity); } else { atkAction.setLoop(THREE.LoopOnce,1); atkAction.clampWhenFinished=true; } atkAction.timeScale=(id==='worker_human')?((clip.duration||1)/0.55):_aspd; }   // 배속(유닛별) — 일꾼: 잽(0.55s 완결) 후 정지 / ATK_LOOP=연속 루프
    if(id==='blade'){ rimModel(atkInner, unitRim(id)); attachSwords(atkInner, base.h); }
    else if(id==='worker_human' && inner){   // 유니온 엔지니어 공격(펀치) GLB는 베이스 텍스처(webp)가 손상돼 디코드 실패 → 맵이 없어 흰색으로 렌더됨(공격모션에서만 하얗게 뜨는 원인). 정상인 정지(idle) 워커 머티리얼을 펀치 모델 메시에 그대로 입혀 색·텍스처를 통일(같은 캐릭터 재익스포트라 UV 동일)
      let _im=null; inner.traverse(o=>{ if(!_im && o.isMesh && o.material) _im=Array.isArray(o.material)?o.material[0]:o.material; });
      if(_im) atkInner.traverse(o=>{ if(o.isMesh) o.material=_im; }); } }   // 워든 공격: 림 + 쌍검(손 본)
  const yaw=new THREE.Group(); yaw.add(anim);                // 적 방향으로 제자리 회전(세운 채 yaw)
  const view=new THREE.Group(); view.add(yaw); view.rotation.x=VIEW_TILT;  // 카메라 부감(소량, 발끝 기준)
  // 발밑 선택 링(스타식 셀렉션 써클) — 선택(드래그) 시에만 표시. 링 폭은 모든 유닛 동일(시각적 두께 균일), 반지름만 유닛 크기 비례
  const ro=0.5*base.w*1.15*(RIM_RO_MUL[id]||1);
  const ri=Math.max(0, ro - 0.75/(SCALE[id]||MODEL_SCALE));  // 동일 시각폭: band = 0.75 / holder_scale
  const rim=new THREE.Mesh(new THREE.RingGeometry(ri, ro, 36),
    new THREE.MeshBasicMaterial({color:0x37e0c8, transparent:true, opacity:RING_OP, side:THREE.DoubleSide, depthWrite:false}));
  rim.rotation.x=-Math.PI/2; rim.position.y=0.02; rim.visible=false; view.add(rim);
  // 바닥 그림자(모든 유닛 공통) — 발밑 은은한 원
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.5*base.w*0.92, 26),
    new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.22, depthWrite:false}));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=0.012; view.add(shadow);
  const holder=new THREE.Group(); holder.add(view); holder.scale.setScalar(SCALE[id]||MODEL_SCALE);
  for(const r of [inner, runInner, stayInner, workInner, atkInner]) hideBoneRoots(r);   // 본 서브트리를 렌더 순회에서 제외(검·프롭 부착 모델은 자동 제외)
  scene.add(holder);
  let muzzlePt=null; if(id==='tank'){ muzzlePt=new THREE.Object3D(); muzzlePt.position.set(-base.h*1.08, base.h*0.84, 0); yaw.add(muzzlePt); }   // 탱크 포구 기준점(yaw=조준방향 따라 회전) — 포신 끝(높이 포함) 화면 캘리브레이션 값
  return { holder, view, yaw, anim, rim, gun, muzzlePt, aura, shadow, auraT:Math.random()*6.28, gunBase:(GUN_CFG[id]?{...GUN_CFG[id].pos}:{x:0,y:0,z:0}), reload:!!(GUN_CFG[id]&&GUN_CFG[id].reload), inner, runInner, runMixer, stayInner, stayMixer, workInner, workMixer, atkInner, atkMixer, atkAction, atkDur, atkT:0, id, h:base.h, face:undefined, breathe:Math.random()*6.28, lean:0, seenSeq:0, dying:false, deadT:0 };
}

// 비콘 톤다운 — 채도/밝기/발광을 낮춰 유닛이 비콘 위에서 돋보이게(쨍한 색 완화). 로드 시 1회.
function dimBeacon(root){ root.traverse(o=>{ if(!o.isMesh) return; const ms=Array.isArray(o.material)?o.material:[o.material];
  ms.forEach(m=>{ if(!m||m._bdim) return; m._bdim=true;
    if(m.color) m.color.multiplyScalar(0.6);                 // 본체 어둡게
    if(m.emissive) m.emissive.multiplyScalar(0.5);           // 네온 발광 절반
    if('emissiveIntensity' in m && m.emissiveIntensity) m.emissiveIntensity*=0.5;
    m.transparent=true; m.opacity=Math.min(m.opacity!=null?m.opacity:1, 0.9);  // 살짝 가라앉힘
    addRim(m, BEACON_RIM, beaconRimIntU);   // 유닛처럼 가장자리 림 발광(테두리 포인트)
  }); }); }
// 합성 비콘 3D 인스턴스 — 바닥 발판 프롭(유닛과 동일 부감 tilt, 회전 안 함). z를 멀리 뒤로 → 항상 유닛 아래
function makeBeacon(){ if(!beaconBase) return null;
  const inner=cloneSkinned(beaconBase.scene);
  inner.position.set(-beaconBase.off.x, -beaconBase.off.y, -beaconBase.off.z);  // 수평중앙 + 바닥 y=0
  const view=new THREE.Group(); view.add(inner); view.rotation.x=VIEW_TILT;     // 유닛과 같은 부감
  const holder=new THREE.Group(); holder.add(view); holder.renderOrder=-2; scene.add(holder);
  return { holder, view, inner, w:beaconBase.w };
}
// 재질을 무채색(그레이스케일)+감광으로 — 비활성 고스트용. 림 주입 대신 알베도 채도 제거
function desatMat(mat){
  if(!('emissive' in mat)){ return; }
  if(mat.emissive) mat.emissive.setScalar(0);
  mat.onBeforeCompile=(shader)=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n  { float _g=dot(diffuseColor.rgb, vec3(0.299,0.587,0.114)); diffuseColor.rgb=vec3(_g)*0.46; }');  // 채도 0 + 어둡게
  };
  mat.customProgramCacheKey=()=>'ghost';   // 림 재질과 다른 프로그램으로 분리(셰이더 캐시 충돌 방지)
  mat.transparent=true; mat.opacity=0.2; mat.depthWrite=false; mat.needsUpdate=true;   // 거의 배경 수준 반투명(실루엣만 — 미해금)
}
// 파괴된 신전 재질 — 무채색 + 반투명(폐허처럼 비활성). desatMat보다 덜 투명(실루엣이 보이게)
function dimDeadMat(mat){ if(!('emissive' in mat)) return;
  if(mat.emissive) mat.emissive.setScalar(0);
  mat.onBeforeCompile=(shader)=>{ shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\n  { float _g=dot(diffuseColor.rgb, vec3(0.299,0.587,0.114)); diffuseColor.rgb=vec3(_g)*0.5; }'); };   // 채도 0 + 어둡게(회색)
  mat.customProgramCacheKey=()=>'deadtmpl'; mat.transparent=true; mat.opacity=0.5; mat.needsUpdate=true; }
// 비활성 고정 슬롯 고스트 — 무채색·축소·정적(아직 안 지어진 자리)
function makeGhost(id){
  const m=makeModel(id); if(!m) return null;
  if(m.gun) m.gun.visible=false; if(m.runInner) m.runInner.visible=false; if(m.rim) m.rim.visible=false;
  if(m.aura) for(const a of m.aura) a.visible=false;
  const mats=cloneMats(m.inner); for(const mt of mats) desatMat(mt);   // 인스턴스 전용 재질 → 무채색
  m.holder.scale.setScalar((SCALE[id]||MODEL_SCALE)*GHOST_SCALE);
  m.holder.visible=false; m.isGhost=true; return m;
}
// 건설 배치 예비 건물 고스트 — 실물 크기 + 완전 반투명 회색(밝은 무채색·투명, 텍스처 무시)
function makeBuildGhost(id){
  const m=makeModel(id); if(!m) return null;
  if(m.gun) m.gun.visible=false; if(m.runInner) m.runInner.visible=false; if(m.rim) m.rim.visible=false;
  if(m.aura) for(const a of m.aura) a.visible=false;
  const mats=cloneMats(m.inner);
  for(const mt of mats){ if('emissive' in mt && mt.emissive) mt.emissive.setScalar(0);
    mt.onBeforeCompile=(sh)=>{ sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n  { float _g=dot(diffuseColor.rgb, vec3(0.299,0.587,0.114)); diffuseColor.rgb=mix(vec3(0.66,0.68,0.72), vec3(_g), 0.2); }'); };   // 텍스처 거의 무시 → 균일한 밝은 회색
    mt.customProgramCacheKey=()=>'bghost'; mt.transparent=true; mt.opacity=0.42; mt.depthWrite=false; mt.needsUpdate=true; }
  m.holder.visible=false; m.isGhost=true; return m;
}
// ── 유닛 3D 모델 → 2D 흑백 포트레잇(오프스크린 렌더, id별 1회 캐시) ──
let _pRend=null,_pScene=null,_pCam=null; const _pCache={};
// ⚔ 던전 적 스프라이트 — 같은 GLB를 '원래 재질 그대로' 투명 PNG로 굽는다.
// unitPortrait()는 흰 실루엣+검은 선(UI 칩용)이라 전장에 그대로 쓰면 적이 전부 흰 종이처럼 보인다.
// 자동사냥 전장은 2D 캔버스라 3D를 직접 못 얹는다 → 한 번 구워서 drawImage로 쓴다(모델당 1회).
// dir = 관리자 실험장(sprDir)과 같은 8방향 규약(북=0, 시계). 방향별로 한 장씩 구워 캐시한다.
// 정지 이미지 하나로 8방향을 다 쓰면 어느 쪽으로 걸어도 같은 그림이라 '미끄러지는' 느낌이 난다.
const _sCache={}; let _sRend=null,_sScene=null,_sCam=null;
const SPRITE_DIRS=8, SPRITE_TILT=0.65, SPRITE_YAW0=Math.PI;   // 시트 프로토타입과 같은 부감 각도
function unitSprite(id, dir){
  const d=((dir|0)%SPRITE_DIRS+SPRITE_DIRS)%SPRITE_DIRS, ck=id+'#'+d;
  if(_sCache[ck]!==undefined) return _sCache[ck];
  const base=bases[id]; if(!base) return null;        // 아직 로드 전 → 호출부가 이모지로 폴백
  try{
    if(!_sRend){
      _sRend=new THREE.WebGLRenderer({alpha:true, antialias:true, preserveDrawingBuffer:true});
      _sRend.setPixelRatio(1); _sRend.setSize(128,128); _sRend.setClearColor(0x000000,0);
      _sScene=new THREE.Scene();
      _sScene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2f3a, 2.1));
      const dl=new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(2,3,2); _sScene.add(dl);
      _sCam=new THREE.PerspectiveCamera(30,1,0.05,100);
    }
    const grp=new THREE.Group(), body=cloneSkinned(base.scene);
    body.position.set(-base.off.x,-base.off.y,-base.off.z);
    const anim=new THREE.Group(); anim.add(body);
    const box=new THREE.Box3().setFromObject(anim), c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
    anim.position.set(-c.x,-c.y,-c.z); grp.add(anim);
    grp.scale.setScalar(1.5/(Math.max(sz.x,sz.y,sz.z)||1));
    grp.rotation.y=SPRITE_YAW0 + d*(Math.PI*2/SPRITE_DIRS);   // 8방향
    _sScene.add(grp);
    const ty=Math.tan(SPRITE_TILT)*3.1;                       // 부감 = 실험장 시트와 같은 기울기
    _sCam.position.set(0,ty,3.1); _sCam.lookAt(0,0,0);
    _sRend.render(_sScene,_sCam);
    const url=_sRend.domElement.toDataURL('image/png');
    _sScene.remove(grp); _disposeObj3D(grp);
    _sCache[ck]=url; return url;
  }catch(e){ console.warn('sprite fail',id,e); _sCache[ck]=null; return null; }
}
function unitPortrait(id){
  if(_pCache[id]!==undefined) return _pCache[id];     // 캐시(실패=null 도 캐시)
  const base=bases[id]; if(!base) return null;         // 아직 로드 전 → 폴백(SVG)
  try{
    if(!_pRend){
      _pRend=new THREE.WebGLRenderer({alpha:true, antialias:true, preserveDrawingBuffer:true});
      _pRend.setPixelRatio(1); _pRend.setSize(256,256); _pRend.setClearColor(0x000000,0);
      _pScene=new THREE.Scene();
      _pCam=new THREE.PerspectiveCamera(32,1,0.05,100);
    }
    // 단조로운 라인아트: 큰 특징(높은 임계각 모서리)만 흰 선으로. 레인저·팬텀은 총 합침.
    const anim=new THREE.Group();
    const body=cloneSkinned(base.scene); body.position.set(-base.off.x,-base.off.y,-base.off.z); anim.add(body);
    const GUNVIS={marine:1, ghost:1};                  // 총까지 합쳐 보일 유닛
    if(GUNVIS[id] && guns[id]) attachGun(anim, id);    // 게임과 동일 위치로 총 부착
    // 흰색 실루엣(밝게, 외각이 또렷) + 검은 특징선(머리/팔다리/무기 등 큰 구분만)
    const EDGE_THRESH={ goliath:74, dragoon:74, archon:74 };   // 기계·결정 유닛은 더 높여(선 더 줄임)
    const thr=EDGE_THRESH[id]||60;
    anim.traverse(o=>{ if(o.isMesh){
      o.material=new THREE.MeshBasicMaterial({color:0xffffff, polygonOffset:true, polygonOffsetFactor:1.4, polygonOffsetUnits:1.4});  // 흰색 실루엣 fill
      try{ const eg=new THREE.EdgesGeometry(o.geometry, thr);   // 큰 모서리만 → 검은 특징선
        o.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({color:0x111111}))); }catch(e){}
    }});
    const box=new THREE.Box3().setFromObject(anim), c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
    const maxd=Math.max(sz.x,sz.y,sz.z)||1;
    const grp=new THREE.Group(); anim.position.set(-c.x,-c.y,-c.z); grp.add(anim);
    grp.scale.setScalar(1.42/maxd); grp.rotation.y=0.6;  // 살짝 작게(여백) + 3/4 뷰
    _pScene.add(grp);
    _pCam.position.set(0,0.15,3.0); _pCam.lookAt(0,0,0);
    _pRend.render(_pScene,_pCam);
    const url=_pRend.domElement.toDataURL('image/png');
    _pScene.remove(grp);
    _pCache[id]=url; return url;
  }catch(e){ console.warn('portrait fail',id,e); _pCache[id]=null; return null; }
}
// ── 유즈맵 확장 토대: 맵별 3D 에셋 명세 + 지연 로드/해제(VRAM 절약) ──
// MAP_ASSETS: 맵 id → 그 맵이 쓰는 body 모델 키 배열. '*'=전체(현재 nemo). 신규 맵은 필요한 키만 나열.
const MAP_ASSETS = {
  nemo: '*',
  cpu: ['temple_main','temple_stone','temple_neutral','marine','ghost','hydra','dragoon','goliath','archon','tank','skyguard'],   // 직스: 신전(3종) + 샘플/전투 유닛 모델
  // sunken: ['goliath','turret','photon', ...],   // 예: 맵 구현 시 이 맵에 필요한 모델만 나열 → 진입 시 그것만 로드
};
function mapModelKeys(mapId){ const a=MAP_ASSETS[mapId]; if(a==='*'||!a) return Object.keys(MODELS).filter(function(k){return k.slice(0,3)!=='cb_';}); return a.filter(k=>MODELS[k]); }
function _disposeObj3D(root){ if(!root) return; root.traverse(o=>{
  if(o.geometry && o.geometry.dispose) o.geometry.dispose();
  const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
  for(const m of ms){ if(!m) continue; for(const k in m){ const v=m[k]; if(v&&v.isTexture&&v.dispose) v.dispose(); } if(m.dispose) m.dispose(); }
}); }
// 지정 모델 키들을 로드(이미 로드된 건 스킵). body 모델 한정(가장 큰 텍스처). onDone(로드 수) 콜백
const MODEL_LOAD_CONC=6;   // 동시 GLB 로드 상한 — 대량 동시 로드 시 텍스처 blob 디코드 실패 방지 + 로딩 안정화
function ensureModels(keys, onDone, onProg){ const L=new GLTFLoader();
  const q=[]; for(const id of keys){ if(!bases[id] && MODELS[id]) q.push(id); }   // 미로드분만 큐잉
  const total=q.length; let doneN=0, idx=0, active=0;
  // 로딩 화면(#opening)이 떠 있는 동안 실제 로딩 진행률을 막대에 먹인다.
  // ⚠ width 를 직접 쓰지 않는다 — 막대는 opBarStart 의 rAF 가 몰고 있어서 서로 덮어쓴다(2026-08-19).
  const bumpBar=()=>{ const op=document.getElementById('opening'); if(!op||op.classList.contains('hide')) return;
    if(typeof opBarReal==='function') opBarReal(doneN/(total||1)); };
  if(total===0){ if(onProg) try{ onProg(0,0); }catch(e){} if(onDone) onDone(0); return 0; }
  const fin=()=>{ active--; doneN++; bumpBar(); if(onProg) try{ onProg(doneN,total); }catch(e){}
    if(doneN>=total){ if(onDone) onDone(total); } else pump(); };
  const loadOne=(id)=>{
    const path='/assets/'+(MODELS[id].includes('/')?MODELS[id]:'models/'+MODELS[id]);
    L.load(path, g=>{ const s=g.scene; const box=new THREE.Box3().setFromObject(s);
      bases[id]={ scene:s, off:{x:(box.max.x+box.min.x)/2,y:box.min.y,z:(box.max.z+box.min.z)/2}, h:Math.max(.001,box.max.y-box.min.y), w:Math.max(.001,Math.max(box.max.x-box.min.x,box.max.z-box.min.z)) };
      tintModel(s,id); fin();
    }, undefined, e=>{ console.warn('ensureModels fail',id,e); fin(); });
  };
  const pump=()=>{ while(active<MODEL_LOAD_CONC && idx<total){ active++; loadOne(q[idx++]); } };
  bumpBar(); pump(); return total; }
// 지정 모델 키들을 메모리에서 해제(scene 제거 + geometry/texture dispose) — 맵 떠날 때 VRAM 회수
function disposeModels(keys){ let n=0; for(const id of keys){
  if(bases[id]){ _disposeObj3D(bases[id].scene); delete bases[id]; n++; }
  if(guns[id]){ _disposeObj3D(guns[id]); delete guns[id]; }
  if(runs[id]){ _disposeObj3D(runs[id].scene); delete runs[id]; }
} return n; }
// ── 건설 섹션 건물 3D 프리뷰(회전 뷰) — M3D 게임 씬/네모 MODELS·VRAM과 분리된 자체 로더·렌더러 ──
const CST_GLB={
  swarm_creep_colony:'buildings/swarm/swarm_creep_colony.glb', swarm_defiler_mound:'buildings/swarm/swarm_defiler_mound.glb', swarm_evolution_chamber:'buildings/swarm/swarm_evolution_chamber.glb', swarm_extractor:'buildings/swarm/swarm_extractor.glb', swarm_greater_spire:'buildings/swarm/swarm_greater_spire.glb', swarm_hatchery:'buildings/swarm/swarm_hatchery.glb', swarm_hive:'buildings/swarm/swarm_hive.glb', swarm_hydralisk_den:'buildings/swarm/swarm_hydralisk_den.glb', swarm_infested_command_center:'buildings/swarm/swarm_infested_command_center.glb', swarm_lair:'buildings/swarm/swarm_lair.glb', swarm_nydus_canal:'buildings/swarm/swarm_nydus_canal.glb', swarm_queens_nest:'buildings/swarm/swarm_queens_nest.glb', swarm_spawning_pool:'buildings/swarm/swarm_spawning_pool.glb', swarm_spire:'buildings/swarm/swarm_spire.glb', swarm_spore_colony:'buildings/swarm/swarm_spore_colony.glb', swarm_sunken_colony:'buildings/swarm/swarm_sunken_colony.glb', swarm_ultralisk_cavern:'buildings/swarm/swarm_ultralisk_cavern.glb',
  aetherial_arbiter_tribunal:'buildings/aetherial/aetherial_arbiter_tribunal.glb', aetherial_assimilator:'buildings/aetherial/aetherial_assimilator.glb', aetherial_cybernetics_core:'buildings/aetherial/aetherial_cybernetics_core.glb', aetherial_fleet_beacon:'buildings/aetherial/aetherial_fleet_beacon.glb', aetherial_forge:'buildings/aetherial/aetherial_forge.glb', aetherial_gateway:'buildings/aetherial/aetherial_gateway.glb', aetherial_nexus:'buildings/aetherial/aetherial_nexus.glb', aetherial_observatory:'buildings/aetherial/aetherial_observatory.glb', aetherial_photon_cannon:'buildings/aetherial/aetherial_photon_cannon.glb', aetherial_pylon:'buildings/aetherial/aetherial_pylon.glb', aetherial_robotics_facility:'buildings/aetherial/aetherial_robotics_facility.glb', aetherial_robotics_support_bay:'buildings/aetherial/aetherial_robotics_support_bay.glb', aetherial_shield_battery:'buildings/aetherial/aetherial_shield_battery.glb', aetherial_stargate:'buildings/aetherial/aetherial_stargate.glb', aetherial_templar_archives:'buildings/aetherial/aetherial_templar_archives.glb', aetherial_temple_of_adun:'buildings/aetherial/aetherial_temple_of_adun.glb',
  union_academy:'buildings/union/union_academy.glb', union_armory:'buildings/union/union_armory.glb', union_barracks:'buildings/union/union_barracks.glb', union_bunker:'buildings/union/union_bunker.glb', union_command_center:'buildings/union/union_command_center.glb', union_comsat_station:'buildings/union/union_comsat_station.glb', union_control_tower:'buildings/union/union_control_tower.glb', union_covert_ops:'buildings/union/union_covert_ops.glb', union_engineering_bay:'buildings/union/union_engineering_bay.glb', union_factory:'buildings/union/union_factory.glb', union_machine_shop:'buildings/union/union_machine_shop.glb', union_missile_turret:'buildings/union/union_missile_turret.glb', union_nuclear_silo:'buildings/union/union_nuclear_silo.glb', union_physics_lab:'buildings/union/union_physics_lab.glb', union_refinery:'buildings/union/union_refinery.glb', union_science_facility:'buildings/union/union_science_facility.glb', union_starport:'buildings/union/union_starport.glb', union_supply_depot:'buildings/union/union_supply_depot.glb'
};
let _cvRend=null,_cvScene=null,_cvCam=null,_cvGrp=null,_cvRAF=0,_cvCanvas=null,_cvTok=0; const _cvCache={};
function _cvInit(canvas){ if(_cvRend&&_cvCanvas===canvas) return; _cvCanvas=canvas;
  _cvRend=new THREE.WebGLRenderer({canvas:canvas, alpha:true, antialias:true}); _cvRend.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  _cvScene=new THREE.Scene(); _cvCam=new THREE.PerspectiveCamera(34,1,0.05,200);
  _cvScene.add(new THREE.HemisphereLight(0xdfeaff,0x2a3340,1.25)); const dl=new THREE.DirectionalLight(0xffffff,1.15); dl.position.set(3,5,4); _cvScene.add(dl);
  const dl2=new THREE.DirectionalLight(0x88aaff,0.5); dl2.position.set(-3,2,-2); _cvScene.add(dl2); }
function _cvResize(){ if(!_cvRend||!_cvCanvas) return; const w=_cvCanvas.clientWidth||150,h=_cvCanvas.clientHeight||150; _cvRend.setSize(w,h,false); _cvCam.aspect=w/h; _cvCam.updateProjectionMatrix(); }
function _cvPlace(scene){ if(_cvGrp){ _cvScene.remove(_cvGrp); _cvGrp=null; }
  const model=scene.clone(true); const box=new THREE.Box3().setFromObject(model), c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
  const maxd=Math.max(sz.x,sz.y,sz.z)||1; model.position.set(-c.x,-c.y,-c.z);
  const grp=new THREE.Group(); grp.add(model); grp.scale.setScalar(2.0/maxd); grp.rotation.y=0.5; _cvScene.add(grp); _cvGrp=grp;
  _cvCam.position.set(0,0.55,3.2); _cvCam.lookAt(0,0.02,0); }
function cstShowModel(canvas,key){ if(!canvas||!CST_GLB[key]) return; _cvInit(canvas); _cvResize(); const tok=++_cvTok;
  if(_cvCache[key]){ _cvPlace(_cvCache[key]); } else { new GLTFLoader().load('/assets/'+CST_GLB[key], g=>{ _cvCache[key]=g.scene; if(tok===_cvTok) _cvPlace(g.scene); }, undefined, e=>console.warn('cst glb fail',key,e)); }
  if(!_cvRAF){ const loop=()=>{ _cvRAF=requestAnimationFrame(loop); if(_cvGrp) _cvGrp.rotation.y+=0.011; if(_cvRend&&_cvScene&&_cvCam) _cvRend.render(_cvScene,_cvCam); }; loop(); } }
function cstStopModel(){ if(_cvRAF){ cancelAnimationFrame(_cvRAF); _cvRAF=0; } if(_cvGrp){ _cvScene.remove(_cvGrp); _cvGrp=null; } }
// 건설 맵: 건물 glb → 3D 렌더 이미지(맵에 실제 모델로 배치, key별 1회 캐시 · 준비되면 맵 갱신)
const _bldgImgCache={}; let _biRend=null,_biScene=null,_biCam=null,_biHemi=null,_biDl=null,_biDl2=null;
const BI_FIT=1.45*0.8;   // 초상 안에서 모델이 차지하는 크기(작을수록 여백↑ — 건물 실루엣 구분용) · ×0.8 축소
const BI_TILT=VIEW_TILT+0.08, BI_DIST=3.0;   // 초상 부감 = 인게임 VIEW_TILT(0.65)와 같은 방향, +0.08rad만 더 위에서 내려다봄(살짝 드라마틱). 정면 회전(yaw)은 인게임 CST_YAW+건물별 f를 그대로 사용
// 종족별 초상 조명(모델 키 접두사 기준) — 원본 텍스처가 어두워 실루엣이 뭉개지므로 종족별로 보정. 평균 휘도 ≈70 목표
const BI_LIGHT={ base:{hemi:1.3, dl:1.2, dl2:0.55}, union:{hemi:2.9, dl:2.5, dl2:1.1}, swarm:{hemi:2.4, dl:2.1, dl2:0.95}, aetherial:{hemi:2.6, dl:2.3, dl2:1.0} };
const BI_LUM=68, BI_AE_STEPS=3, BI_AE_MAX=3.2;   // 자동 노출: 목표 평균 휘도 · 보정 반복 횟수 · 조명 배율 상한(과노출 방지)
// 현재 렌더 결과의 불투명 픽셀 평균 휘도(0~255). 캔버스를 축소 샘플링해 저비용으로 측정
let _biLumCv=null, _biLumCx=null;
function _biLum(){ try{
  if(!_biLumCv){ _biLumCv=document.createElement('canvas'); _biLumCv.width=_biLumCv.height=48; _biLumCx=_biLumCv.getContext('2d',{willReadFrequently:true}); }
  _biLumCx.clearRect(0,0,48,48); _biLumCx.drawImage(_biRend.domElement,0,0,48,48);
  const d=_biLumCx.getImageData(0,0,48,48).data; let sum=0,n=0;
  for(let i=0;i<d.length;i+=4){ if(d[i+3]<40) continue; sum+=(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]); n++; }
  return n?(sum/n):0; }catch(e){ return 0; } }
function bldgImage(key){ if(_bldgImgCache[key]!==undefined) return _bldgImgCache[key]; if(!CST_GLB[key]){ _bldgImgCache[key]=null; return null; } _bldgImgCache[key]=null;
  new GLTFLoader().load('/assets/'+CST_GLB[key], g=>{ try{
    if(!_biRend){ _biRend=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true}); _biRend.setPixelRatio(1); _biRend.setSize(240,240); _biRend.setClearColor(0x000000,0);
      _biScene=new THREE.Scene(); _biHemi=new THREE.HemisphereLight(0xdfeaff,0x2a3340,1.3); _biScene.add(_biHemi); _biDl=new THREE.DirectionalLight(0xffffff,1.2); _biDl.position.set(3,5,4); _biScene.add(_biDl); _biDl2=new THREE.DirectionalLight(0x88aaff,0.55); _biDl2.position.set(-3,2,-2); _biScene.add(_biDl2);
      _biCam=new THREE.PerspectiveCamera(30,1,0.05,100); }
    const _L=BI_LIGHT[String(key).split('_')[0]]||BI_LIGHT.base;   // 종족별 조명(키 접두사 union_/swarm_/aetherial_) — 렌더 직전 적용, key당 1회 렌더라 서로 간섭 없음
    _biHemi.intensity=_L.hemi; _biDl.intensity=_L.dl; _biDl2.intensity=_L.dl2;
    const model=g.scene; toneModel(model, key);   // 인게임과 동일한 플레이어 틴트(채도 상한 포함)
    const box=new THREE.Box3().setFromObject(model), c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3()), maxd=Math.max(sz.x,sz.y,sz.z)||1;
    const _cfg=(typeof window!=='undefined'&&window.CST_BLDG_CFG)?window.CST_BLDG_CFG[key]:null;   // 인게임 건설 맵과 동일한 정면 회전: (스웜=0 / 그 외=CST_YAW) + 건물별 f
    const _yaw=((String(key).indexOf('swarm_')===0)?0:((typeof window!=='undefined'&&window.CST_YAW!=null)?window.CST_YAW:0))+((_cfg&&_cfg.f)||0);
    model.position.set(-c.x,-c.y,-c.z); const grp=new THREE.Group(); grp.add(model); grp.scale.setScalar(BI_FIT/maxd); grp.rotation.y=_yaw;
    _biScene.add(grp); _biCam.position.set(0, Math.sin(BI_TILT)*BI_DIST, Math.cos(BI_TILT)*BI_DIST); _biCam.lookAt(0,0,0);
    // 💡 자동 노출: 렌더 → 불투명 픽셀 평균 휘도 측정 → 목표(BI_LUM)보다 어두우면 조명을 올려 재렌더(원본 텍스처가 검은 건물 보정)
    let _mul=1; _biRend.render(_biScene,_biCam);
    for(let _p=0; _p<BI_AE_STEPS; _p++){ const _lum=_biLum(); if(_lum<=0 || _lum>=BI_LUM) break;
      _mul=Math.min(BI_AE_MAX, _mul*Math.min(1.7, BI_LUM/_lum));   // 한 번에 과보정하지 않도록 단계 제한
      _biHemi.intensity=_L.hemi*_mul; _biDl.intensity=_L.dl*_mul; _biDl2.intensity=_L.dl2*_mul;
      _biRend.render(_biScene,_biCam); }
    _bldgImgCache[key]=_biRend.domElement.toDataURL('image/png'); _biScene.remove(grp); if(typeof _disposeObj3D==='function') _disposeObj3D(grp);
    if(typeof window.techUIRender==='function') window.techUIRender();
  }catch(e){ console.warn('bldgImage fail',key,e); _bldgImgCache[key]=null; } }, undefined, e=>{ console.warn('bldgImage load fail',key,e); _bldgImgCache[key]=null; });
  return null; }
// ── 건설 맵 라이브 3D: 배치된 건물 실모델을 맵 위에 아이소메트릭으로 렌더(언프로젝트로 배치칸 정렬) ──
let _tmRend=null,_tmScene=null,_tmCam=null,_tmRAF=0,_tmCanvas=null,_tmRing=null; const _tmModels={}, _tmGlb={};
function _tmInit(canvas){ if(_tmRend&&_tmCanvas===canvas) return; _tmCanvas=canvas;
  _tmRend=new THREE.WebGLRenderer({canvas:canvas, alpha:true, antialias:true}); _tmRend.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  _tmScene=new THREE.Scene();
  _tmScene.add(new THREE.HemisphereLight(0xf2f6ff,0x30363f,1.7)); const dl=new THREE.DirectionalLight(0xffffff,2.0); dl.position.set(2.5,6,3.5); _tmScene.add(dl); const dl2=new THREE.DirectionalLight(0x9fc0ff,0.85); dl2.position.set(-3,2.5,-2.5); _tmScene.add(dl2); const dl3=new THREE.DirectionalLight(0xffffff,0.6); dl3.position.set(0,1,-4); _tmScene.add(dl3);
  _tmCam=new THREE.OrthographicCamera(-0.5,0.5,0.5,-0.5,-12,24); _tmCam.position.set(0,2.7,1.75); _tmCam.up.set(0,1,0); _tmCam.lookAt(0,0,0);
  const rg=new THREE.Mesh(new THREE.RingGeometry(0.092,0.118,40), new THREE.MeshBasicMaterial({color:0x5aa8ff,transparent:true,opacity:0.9,side:THREE.DoubleSide})); rg.rotation.x=-Math.PI/2; rg.visible=false; _tmScene.add(rg); _tmRing=rg; }
function _tmResize(){ if(!_tmRend||!_tmCanvas) return; const w=_tmCanvas.clientWidth||300,h=_tmCanvas.clientHeight||300; _tmRend.setSize(w,h,false); const asp=w/h,V=1.18; _tmCam.top=V/2; _tmCam.bottom=-V/2; _tmCam.left=-V/2*asp; _tmCam.right=V/2*asp; _tmCam.updateProjectionMatrix(); _tmCam.updateMatrixWorld(); }
function _tmGround(ex,ey){ const v=new THREE.Vector3(ex*2-1,-(ey*2-1),-1).unproject(_tmCam); const dir=new THREE.Vector3(0,0,-1).applyQuaternion(_tmCam.quaternion).normalize(); if(Math.abs(dir.y)<1e-5) return v; const t=-v.y/dir.y; return v.add(dir.multiplyScalar(t)); }
function _tmLoad(mk,cb){ if(_tmGlb[mk]){ cb(_tmGlb[mk]); return; } new GLTFLoader().load('/assets/'+CST_GLB[mk], g=>{ _tmGlb[mk]=g.scene; cb(g.scene); }, undefined, e=>console.warn('tm glb fail',mk,e)); }
function techMap3DSync(){ if(typeof G==='undefined'||!G.tech) return; const canvas=document.getElementById('techMap3d'); if(!canvas) return; _tmInit(canvas); _tmResize();
  const race=G.tech.race, ents=(G.tech.ents||[]).filter(e=>e.type==='bldg'), seen={};
  for(const e of ents){ seen[e.eid]=1; const mk=(typeof TECH_MODEL!=='undefined'&&TECH_MODEL[race])?TECH_MODEL[race][e.bk]:null; if(!mk||!CST_GLB[mk]) continue;
    let m=_tmModels[e.eid];
    if(!m||m._mk!==mk){ if(m) _tmScene.remove(m); m=new THREE.Group(); m._mk=mk; _tmModels[e.eid]=m; _tmScene.add(m);
      _tmLoad(mk, sc=>{ if(_tmModels[e.eid]!==m) return; const model=sc.clone(true); const box=new THREE.Box3().setFromObject(model), c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3()), maxd=Math.max(sz.x,sz.y,sz.z)||1; model.position.set(-c.x,-box.min.y,-c.z); model.scale.setScalar(0.125/maxd); m.add(model); }); }
    const p=_tmGround(e.x,e.y); if(p) m.position.copy(p); m.rotation.set(0,0.62,0); }
  for(const id in _tmModels){ if(!seen[id]){ _tmScene.remove(_tmModels[id]); delete _tmModels[id]; } }
  if(_tmRing){ const se=(G.tech.sel!=null)?ents.find(e=>e.eid===G.tech.sel):null; if(se){ const rp=_tmGround(se.x,se.y); if(rp){ _tmRing.position.copy(rp); _tmRing.position.y=0.006; } _tmRing.visible=true; } else _tmRing.visible=false; }
  if(!_tmRAF){ const loop=()=>{ _tmRAF=requestAnimationFrame(loop); if(_tmRend&&_tmScene&&_tmCam) _tmRend.render(_tmScene,_tmCam); }; loop(); } }
function techMap3DStop(){ if(_tmRAF){ cancelAnimationFrame(_tmRAF); _tmRAF=0; } for(const id in _tmModels){ if(_tmScene) _tmScene.remove(_tmModels[id]); delete _tmModels[id]; } if(_tmRing) _tmRing.visible=false; }
Object.keys(CST_GLB).forEach(function(k){ if(!MODELS['cb_'+k]) MODELS['cb_'+k]=CST_GLB[k]; });   // 건설 건물 → 게임 MODELS(cb_) 등록(네모 '*' 로딩 제외)
window.M3D={
  ready:()=>ready,
  cstShow:(canvas,key)=>cstShowModel(canvas,key),   // 건설 섹션 건물 3D 프리뷰(회전)
  bldgImage:(key)=>bldgImage(key),   // 건물 glb → 맵 배치용 3D 렌더 이미지(dataURL/null)
  techMap3DSync:()=>techMap3DSync(),   // 건설 맵 라이브 3D: 배치 건물 실모델 렌더/동기화
  techMap3DStop:()=>techMap3DStop(),
  cstEnsure:(keys,cb)=>{ const orig=(keys||[]); const ks=orig.map(k=>'cb_'+k).filter(k=>MODELS[k]); ensureModels(ks, function(n){ for(const bk of orig){ const k='cb_'+bk; const b=bases[k]; if(!b) continue; const _cfg=(typeof window!=='undefined'&&window.CST_BLDG_CFG)?window.CST_BLDG_CFG[bk]:null; SCALE[k]=(_cfg&&_cfg.s?_cfg.s:55)/Math.max(b.h||1,b.w||1); } if(cb) cb(n); }); return true; },   // 건설 건물 로드 → 고정 스펙(s) 또는 자동 크기
  cstStop:()=>cstStopModel(),
  ensureUnits:(keys,cb)=>ensureModels((keys||[]).filter(k=>MODELS[k]), cb),   // 건설 맵 3D 유닛(일꾼·생산 유닛) 모델 지연 로드
  cstEnsureRes:(cb)=>{ const tgt={res_cn:18, res_en:50, res_cc:8, res_ec:8}; const ks=Object.keys(tgt).filter(k=>MODELS[k]);   // 자원 3D(미네랄·가스 노드 + 운반) 로드 → 목표 화면크기로 SCALE
    ensureModels(ks, function(n){ for(const k of ks){ const b=bases[k]; if(b) SCALE[k]=tgt[k]/Math.max(b.h||1,b.w||1); } if(cb) cb(n); }); return true; },
  hasModel:(id)=>!!bases[id],   // 실제 로드 완료 여부(로드 전엔 false → 2D/SVG 폴백 표시). MODELS 카탈로그가 아니라 bases(로드분) 기준
  // ⚠ 공용 캔버스를 빌려 쓰는 화면은 반드시 이걸 먼저 부른다.
  // sync()가 관리하지 않는 풀(뽑기 비콘·미건설 고스트·배치 고스트·건설 전시)은 그냥 두면
  // '미사일 포탑 고스트' 같은 잔상이 남는다. **숨기지 말고 지운다** — 숨기기는 어딘가에서 다시 켜지면
  // 도로 나타나지만, 지우면 나타날 수가 없다. 각 풀은 전부 '없으면 만든다'라서 원래 화면으로 돌아가면 재생성된다.
  clearIdlePools:()=>{
    const wipe=(pool)=>{ for(const [k,m] of [...pool]){ const h=m&&(m.holder||m);
      if(h&&h.parent) h.parent.remove(h); else if(h) scene.remove(h);
      try{ _disposeObj3D(h); }catch(e){} pool.delete(k); } };
    wipe(beaconInsts); wipe(ghostModels); wipe(buildGhostModels); wipe(buildModels); },
  // 지금 화면에 '보이는' 유휴 풀(고정 슬롯 고스트·비콘) 개수 — 다른 화면에 새면 0이 아니게 된다
  idleVisible:()=>{ let n=0; for(const [,g] of ghostModels) if(g&&g.holder&&g.holder.visible) n++;
    for(const [,b] of beaconInsts) if(b&&b.holder&&b.holder.visible) n++; return n; },
  modelKeys:()=>Object.keys(MODELS),   // 카탈로그(로드 여부 무관) — 던전 표 같은 '모델 키 오타' 검사가 실제로 걸리게 하려면 이게 필요하다
  modelCatalog:(id)=>!!MODELS[id],   // 카탈로그 존재 여부(필요 시)
  // ── 유즈맵별 에셋 지연 로드/해제(확장 토대) ──
  loadMapModels:(mapId,cb,onProg)=>ensureModels(mapModelKeys(mapId), cb, onProg),   // 그 맵 모델만 로드(이미 있으면 스킵) · onProg(받은수,전체)
  keepOnlyMap:(mapId)=>{ const keep=new Set(mapModelKeys(mapId)); const drop=Object.keys(bases).filter(k=>!keep.has(k)); return disposeModels(drop); },  // 그 맵 외 모델 VRAM 해제
  disposeModels:(keys)=>disposeModels(keys),
  loadedKeys:()=>Object.keys(bases),
  mapModelKeys:(mapId)=>mapModelKeys(mapId),
  portrait:(id)=>unitPortrait(id),   // 3D 모델 → 2D 흑백 포트레잇 dataURL(없으면 null)
  unitSprite:(id,dir)=>unitSprite(id,dir),   // 3D 모델 → 원래 재질 그대로 구운 8방향 전장 스프라이트 dataURL(없으면 null · 던전 적)
  muzzleAt:(uid)=>{ const m=models.get(uid); return (m&&m.muzzleN)?m.muzzleN:null; },   // 총구(3D 총 위치) 2D 정규화 좌표 — 각도 무관 머즐 FX
  airFloat:(id)=>!!AIR_FLOAT[id],   // 이 모델이 공중(고정 부양) 유닛인지 — 랩 att.y 판정용(모듈 스코프 AIR_FLOAT 노출)
  airLiftPx:()=>((typeof AIR_LIFT_PX!=='undefined'?AIR_LIFT_PX:0)*Math.cos(typeof VIEW_TILT!=='undefined'?VIEW_TILT:0)),   // 공중유닛 부양 화면 px(잡기 히트박스 보정)
  scaleOf:(id)=>(typeof SCALE!=='undefined'?(SCALE[id]||MODEL_SCALE):13),   // 모델 시각 크기(관성 크기비례용)
  footprintOf:(id)=>{ const b=bases[id]; if(!b) return null;   // 모델의 실제 표시 반경(발밑 선택 링 바깥 반지름과 동일 규격) — 사거리·간격을 '모델 전 범위' 기준으로 맞출 때 사용
    return 0.5*b.w*1.15*(RIM_RO_MUL[id]||1)*(SCALE[id]||MODEL_SCALE); },
  centerAt:(uid)=>{ const m=models.get(uid)||buildModels.get(uid); return (m&&m.centerN)?m.centerN:null; },   // 유닛 몸 중앙 2D 좌표(메인·건설 공용) — 발이 아닌 몸통 조준·트레일 원점용
  sync(units, W, H, dt, sel, enemies, selEnemy, scaleMul, view){
    if(!ready||!W||!H) return;
    if(_prof) _prof.t0=performance.now();
    // 3D 렌더 해상도: 직스 전장만 quality 배율(고화질=1.2× 슈퍼샘플·절전=0.6×). 네모 등 다른 게임(G.strike 거짓)은 네이티브 고정
    { const _ss=(typeof G!=='undefined'&&G.strike)?(STK_RES[strikeResMode()].gl):1;
      const _pr=Math.min(devicePixelRatio||1,2)*_ss;
      if(Math.abs(renderer.getPixelRatio()-_pr)>0.001){ renderer.setPixelRatio(_pr); renderer._w=0; } }
    if(renderer._w!==W||renderer._h!==H){ renderer.setSize(W,H,false); renderer._w=W;renderer._h=H; }
    { const vz=(view&&view.zoom)||1, vx=(view&&view.x!=null)?view.x:0.5, vy=(view&&view.y!=null)?view.y:0.5;   // 화면 줌/팬 → 직교 카메라 프러스텀(전체 3D가 한 번에 줌/팬). 기본=항등
      const cxw=vx*W, cyw=H-vy*H, hw=(W/2)/vz, hh=(H/2)/vz;
      camera.left=cxw-hw; camera.right=cxw+hw; camera.top=cyw+hh; camera.bottom=cyw-hh; camera.updateProjectionMatrix(); }
    for(const [,m] of shopModels) m.holder.visible=false;            // 메인 탭: 전시 모델 숨김
    for(const [,m] of buildModels) m.holder.visible=false;           // 건설지 전시 모델 숨김
    if(bossModel) bossModel.holder.visible=false;
    for(const [,m] of bossRemoteModels) m.holder.visible=false;                    // 보스 모델 숨김
    for(const [,m] of models) m.holder.visible=true;                 // 게임 모델 다시 표시(다른 탭서 숨겼던 것 복원)
    const _mid=u=>u.gmodel||u.id;                                    // 유닛 모델 id(가챠 전용 모델 우선)
    const uList=units.filter(u=>MODELS[_mid(u)]);                     // 3D 아군
    const eList=(enemies||[]).filter(e=>e.model3d && MODELS[e.model3d]); // 3D 적
    const selSet=new Set(sel||[]);
    let ringN=0;   // 이번 프레임 인스턴스 선택링 수(아군 루프에서 _ringPush로 채움)
    _syncTick++; _mixStride=_mixStrideFor(uList.length);   // 대군·저사양 = 스킨드 애니(+스켈레톤) 갱신을 2~3프레임에 1회로 분산
    const live=new Set();
    for(const u of uList) live.add(u.uid);
    for(const e of eList) live.add('e'+e.eid);
    // 사라진(죽은) 모델 → 사망 모션
    for(const [key,m] of models){ if(!live.has(key)&&!m.dying){ m.dying=true; m.deadT=0; m.lean=0; } }
    // ⚠ "목록에서 빠짐"이 곧 사망은 아니다. 직스는 화면 밖 유닛을 잘라내(STK_CULL) 목록에서 빼므로,
    //   화면 밖으로 나갔다 2초(DEAD_HOLD) 안에 돌아온 유닛은 사망 모션이 걸린 모델을 그대로 재사용하게 된다.
    //   그 상태로 두면 자세 분기가 세워놓은 것을 아래 사망 루프가 매 프레임 다시 눕혀서
    //   "멀쩡한 유닛이 누운 채로 이동하다가 모델이 제거·재생성될 때 벌떡 일어나는" 현상이 된다. → 되살아나면 해제.
    // 🧱 배치 고스트(반투명 회색 예비 건물) — **syncBuild 와 같은 풀·같은 생성자**를 쓴다.
    //   사냥터(HOME)는 메인 sync 하나로 전부 그리므로(syncBuild 를 같은 프레임에 부르면 서로를 지운다)
    //   관리자 건설의 고스트를 여기서도 쓸 수 있게 열어 둔 것이다. 항목에 ghost:true 를 넣으면 된다.
    { const seenG=new Set();
      for(const it of uList){ if(!it.ghost || !MODELS[it.id]) continue;
        let g=buildGhostModels.get(it.id);
        if(!g){ g=makeBuildGhost(it.id); if(!g) continue; g.kind='buildghost'; buildGhostModels.set(it.id,g); }
        seenG.add(it.id); g.holder.visible=true; if(g.inner) g.inner.visible=true; if(g.shadow) g.shadow.visible=false;
        if(it.face!=null) g.yaw.rotation.y=it.face + (MODEL_YAW_OFF[it.id]||0);
        g.holder.scale.setScalar((SCALE[it.id]||MODEL_SCALE)*(scaleMul||1)*(it.scl||1));
        g.holder.position.set(it.x*W, (H-it.y*H)-Y_DROP-(it.yoff||0), (it.z!=null?it.z:it.y*H*2.5));
        g.holder.rotation.x=it.pitch||0; }
      for(const [k,g] of buildGhostModels){ if(!seenG.has(k)) g.holder.visible=false; } }
    // ── 아군 유닛 ──
    for(const u of uList){ if(u.ghost) continue;   // 고스트는 위에서 따로 그렸다(유닛 풀에 넣지 않는다)
      const _id=_mid(u); let m=models.get(u.uid); if(!m){ m=makeModel(_id); if(!m) continue; m.kind='unit'; models.set(u.uid,m); }
      if(m.dying) reviveModel(m, _id);
      if(u.rimCol) applyTeamTint(m, u.rimCol);   // 한 화면에 여러 플레이어(직스) → 인스턴스별 플레이어색 틴트
      else if(typeof window!=='undefined' && window.__sandbox) sandboxAllyFix(m, _id);   // 샌드박스: 전 유닛 내 소유 → 인스턴스 틴트(ENEMY_MODEL 공유 모델 포함)
      else applyPlayerTintInst(m, _id);          // 실게임: NPC와 모델 공유(레이스·드랍쉽 등) → 내 유닛 인스턴스만 틴트
      if(u.atBoss){ m.holder.visible=false; continue; }   // 보스방 파견 유닛은 트랙에 표시 안 함
      const px=u.x*W, worldY=H-u.y*H;
      const _ds=(u.dead&&u.fixed)?0.82:1;   // 파괴 시 약간 움츠러듦
      const _us=u.scl||1;                   // 유닛별 추가 배율(직스 전투 유닛 확대 등) — 신전엔 미적용
      const _hs=(SCALE[_id]||MODEL_SCALE)*(scaleMul||1)*_ds*_us;   // 이번 프레임 holder 스케일 = 화면 px 배율
      const _ro=(m.rim.geometry.parameters&&m.rim.geometry.parameters.outerRadius)||1;
      if(u.ringCol){ m.rim.visible=true; m.rim.material.color.set(u.ringCol); m.rim.material.opacity=RING_OP;
        m.rim.scale.setScalar(selSet.has(u.uid)?1.22:1); }   // 직스: 발밑 링 = 선택 링 규격을 상시 표시(색=진영) · 내가 지정한 유닛만 굵게
      else { m.rim.visible=false;   // 일반 선택링 → 인스턴스 배치(다중 선택 시 전체 1드로우콜)
        if(selSet.has(u.uid)){   // 선택링 색: 영웅=금색 / 가챠=등급색(유닛도감과 동일) / 일반=청록
          const _tc=(u.gtier && typeof TIER_COLOR!=='undefined')?TIER_COLOR[u.gtier]:null;
          ringN=_ringPush(ringN, px, worldY-Y_DROP, _ro*_hs, (u.selCol!=null?u.selCol:(u.hero?0xffc24a:(_tc||0x37e0c8))), _zOf(u,_id,worldY,H));   // selCol = 호출부 지정색(직스 적군=빨강)
        } }
      // 영웅 상시 식별: 발밑 은은한 금색 링 + 미세한 반짝임(눈에 띄지 않게)
      if(u.hero){
        if(!m.heroRing){ const ro=(m.rim.geometry.parameters&&m.rim.geometry.parameters.outerRadius)||1;
          const hr=new THREE.Mesh(new THREE.RingGeometry(ro*0.78, ro*0.9, 40),
            new THREE.MeshBasicMaterial({color:0xffc24a, transparent:true, opacity:0.2, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending}));
          hr.rotation.x=-Math.PI/2; hr.position.y=0.028; m.view.add(hr); m.heroRing=hr; }
        m.heroRing.visible=true; m.heroT=(m.heroT||0)+dt;
        m.heroRing.material.opacity=0.13+Math.abs(Math.sin(m.heroT*2.1))*0.15;   // 천천히 반짝(은은)
      } else if(m.heroRing){ m.heroRing.visible=false; }
      if((u.fireSeq||0)>(m.seenSeq||0)){ m.seenSeq=u.fireSeq; m.lean=1; m.swing=1;   // m.swing=워든 검 휘두름 트리거
        if(m.atkAction){ if(typeof ATK_LOOP!=='undefined'&&ATK_LOOP[m.id]){ m.atkAction.time=0; if(!m.atkAction.isRunning()) m.atkAction.play(); } else { m.atkAction.reset(); m.atkAction.play(); } m.atkT=m.atkDur; } }   // 루프 유닛(보이드)=발사마다 위상 0 재동기(시작=끝 포즈, 무단절) → 모션·이펙트 고정 결합
      m.lean=(m.lean||0)*Math.max(0, 1-dt*LEAN_DECAY);
      // 공격 모션 타이머: 이동 중이면 즉시 취소, 아니면 매 프레임 감소(공격 끊기면 모션도 종료 — 허공 베기 방지)
      if(u.moving) m.atkT=0; else if(m.atkT>0) m.atkT-=dt;
      if(typeof u.face==='number' && !NO_TURN[_id] && (!TURN_MOVE_ONLY[_id] || u.moving)){ const tgt=u.face+ROT_OFFSET+(MODEL_YAW_OFF[_id]||0);  // TURN_MOVE_ONLY(센티넬)=이동 중에만 회전
        let d=tgt-m.yaw.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d));
        m.yaw.rotation.y += d*Math.min(1, dt*ROT_SPD); }
      if(m._skels||_mixStride>1) _mixHold(m,false);   // 스켈레톤 홀드 해제(이번 프레임 갱신 대상이면 _mixStep이 다시 건다)
      const _pose=poseOf(m, _id, !!u.moving, m.atkT||0);   // 어느 내장 모델을 보여줄지 = 단일 소스
      poseShow(m, _pose);
      if(!u.moving && _id==='worker_light' && m.runInner){   // 에테리얼 일꾼: 제자리 run 모션 상시(두 팔 앞으로) — 끊김 없이
        m.anim.position.set(0,0,0); m.anim.rotation.x=0; m.anim.rotation.z=0;
        _mixStep(m, m.runMixer, dt);
      } else if(!u.moving && m.atkT>0 && m.atkInner){   // 워든 검 베기 공격 애니(정지 시 1회 재생)
        m.anim.position.set(0,0,0); m.anim.rotation.x=0; m.anim.rotation.z=0;
        _mixStep(m, m.atkMixer, dt);   // (atkT 감소는 위에서 일괄 처리)
      } else if(u.moving && m.runInner){          // 달리기 모델(클립 재생)
        m.anim.position.set(0,0,0); m.anim.rotation.x=0; m.anim.rotation.z=0;
        _mixStep(m, m.runMixer, dt);
      } else if(u.moving){                  // 달리기 모델 없는 유닛 → 절차적 걷기
        m.walk = (m.walk||0) + dt*WALK_SPD;
        m.anim.position.x = 0;
        if(_id==='tank'||_id==='racer'){ m.anim.position.y = Math.abs(Math.sin(m.walk))*m.h*WALK_BOB*0.3; m.anim.rotation.z=0; m.anim.rotation.x=0; }   // 탱크·레이서(차량): 앞뒤/좌우 흔들림 없이 미세 상하만
        else { m.anim.position.y = Math.abs(Math.sin(m.walk))*m.h*WALK_BOB; m.anim.rotation.z = Math.sin(m.walk*0.5)*WALK_SWAY; m.anim.rotation.x = WALK_LEAN; }
      } else if(_id==='blade' && m.runInner){   // 워든 정지: 리깅 모델 frame0 고정(내장검 있는 정적 blade.glb 미사용)
        m.anim.position.set(0,0,0); m.anim.rotation.set(0,0,0);
        m.runMixer.setTime(0);
      } else if(m.stayInner){              // 정지: 대기(idle) 애니 재생(정지 모델엔 총이 없어 부착총 유지)
        m.anim.position.set(0,0,0); m.anim.rotation.set(0,0,0);
        _mixStep(m, m.stayMixer, dt);
      } else {                              // 정지: 정적 모델 + 숨쉬기/발사 떨림
        m.breathe += dt*BREATHE_SPD;
        const tr = u.fixed ? 0 : m.lean*TREMBLE*m.h;                    // 구조물(터렛/포토)은 떨림 없음(움찔 제거)
        const bob = u.fixed ? 0 : Math.sin(m.breathe)*m.h*BREATHE_AMP;  // 구조물은 숨쉬기 없음
        m.anim.position.x = (Math.random()-0.5)*tr;
        m.anim.position.y = bob + (Math.random()-0.5)*tr;
        m.anim.position.z = 0;                                          // 구조물 발사 반동 제거(움찔 없음)
        m.anim.rotation.x = 0;
        m.anim.rotation.z += (0-m.anim.rotation.z)*Math.min(1, dt*8);
      }
      if(AURA_UNITS[_id]){ // 아칸: 아주 약간 공중 부유(이동/정지 무관) — 본체만 띄움(선택링은 지면 유지)
        m.hover=(m.hover||0)+dt*HOVER_SPD;
        m.anim.position.x = Math.sin(m.hover*0.8+1.3)*m.h*0.03;
        m.anim.position.y = m.h*AURA_LIFT + Math.sin(m.hover)*m.h*HOVER_AMP*0.5;
        m.anim.rotation.z = Math.sin(m.hover*0.6)*0.035; m.anim.rotation.x = 0;
      }
      if(AIR_FLOAT[_id]){ // 공중 비행체: 고정 화면높이 부양(크기·모델 무관 — 전 공중유닛 동일 고도). 정지 부양(흔들림 없음)
        const _scA=(SCALE[_id]||MODEL_SCALE);
        m.anim.position.x = 0;
        m.anim.position.y = AIR_LIFT_PX/_scA;   // 고정 px 부양(÷스케일 → 화면상 균일)
        m.anim.rotation.z = 0; m.anim.rotation.x = 0;
        if(m.shadow) m.shadow.material.opacity=0.26;   // 그림자 농도 고정
      }
      if(m.aura){ m.auraT+=dt; const a=m.aura;  // 에너지 오라: 헤일로 맥동 + 프레넬 보호막 버블
        const p=1+Math.sin(m.auraT*2.0)*0.05, b=a[0]._base*p;
        a[0].scale.set(b,b,1); a[0].material.opacity=0.17+Math.abs(Math.sin(m.auraT*1.6))*0.08;  // 헤일로
        for(let q=1;q<a.length;q++){ const g=a[q]; if(!g._mat) continue;
          if(g._mat.uniforms&&g._mat.uniforms.uT) g._mat.uniforms.uT.value=m.auraT;   // 보호막 파동·색 흐름 시간
          const s2=1+Math.sin(m.auraT*1.4)*0.025; g.scale.setScalar(s2); }   // 보호막 미세 호흡
      }
      if(m.gun){ // 반동(뒤로 킥) + 장전(발사 텀에 총 내렸다 올림 — reload 유닛만)
        let rl=0; if(m.reload && u.cdMax){ const p=Math.max(0,Math.min(1,(u.cd||0)/u.cdMax));
          const t=1-Math.min(1, Math.abs(p-0.5)/RELOAD_WIN); rl=t*t*(3-2*t); }  // 중앙에서만 잠깐 내림 → 나머지는 들고 조준
        m.gun.position.set(m.gunBase.x, m.gunBase.y - rl*RELOAD_DIP, m.gunBase.z - m.lean*GUN_RECOIL);
        m.gun.rotation.x = rl*RELOAD_TILT; }
      m.holder.position.set(px, worldY - Y_DROP, _zOf(u, _id, worldY, H));
      if(u.dead&&u.fixed){ if(!m._deadDim){ m._deadDim=true; if(m.rim) m.rim.visible=false; m._deadMats=cloneMats(m.inner); for(const mt of m._deadMats) dimDeadMat(mt); }   // 파괴된 신전: 무채색 반투명(1회 적용)
        if(u.fade!=null && m._deadMats) for(const mt of m._deadMats){ mt.transparent=true; mt.depthWrite=false; mt.opacity=(mt._dimOp==null?(mt._dimOp=mt.opacity):mt._dimOp)*u.fade; } }   // 그 뒤 서서히 사라짐(파괴 잔해가 전장에 계속 남지 않게)
      if(m.holder.scale.x!==_hs) m.holder.scale.setScalar(_hs);   // 맵 스케일 연동 + 파괴 축소 + 유닛 배율
      if(u._cloaked || m._cloakMats){ const _vis=(u._detected || (selSet&&selSet.has(u.uid))); _applyCloak(m, u._cloaked?(_vis?0.42:0.0):1, dt); }   // 🪄 은신: 감지/선택=반투명, 미감지=투명
      if(typeof window!=='undefined' && window.__sandbox && m.muzzlePt){ m.muzzlePt.updateWorldMatrix(true,false); const _mw=m.muzzlePt.getWorldPosition(new THREE.Vector3()); _mw.project(camera); m.muzzleN={ x:_mw.x*0.5+0.5, y:0.5-_mw.y*0.5 }; }   // 포구 기준점(3D) 투영 — 각도 완전 대응
      else if(typeof window!=='undefined' && window.__sandbox && m.gun && m.gun.visible){ m.gun.updateWorldMatrix(true,false); const _gw=m.gun.getWorldPosition(new THREE.Vector3()); _gw.project(camera); m.muzzleN={ x:_gw.x*0.5+0.5, y:0.5-_gw.y*0.5 }; } else m.muzzleN=null;   // 총구 2D 투영(각도 무관 머즐 원점)
      if(typeof window!=='undefined' && window.__sandbox && m.anim){ const _cc=new THREE.Box3().setFromObject(m.anim).getCenter(new THREE.Vector3()); _cc.project(camera); m.centerN={ x:_cc.x*0.5+0.5, y:0.5-_cc.y*0.5 }; } else m.centerN=null;   // 몸 중앙 2D 투영(발 X — 조준 타겟)
    }
    // ── 적 유닛(공중: 부유 + 진행방향 회전) ──
    for(const e of eList){ const key='e'+e.eid; let m=models.get(key); if(!m){ m=makeModel(e.model3d); if(!m) continue; m.kind='enemy'; m.age=0; if(CLOAK_MODELS[m.id]) m.mats=cloneMats(m.inner); models.set(key,m); }
      if(m.dying) reviveModel(m, m.id);   // 목록에 다시 들어온 적 = 사망 축소를 되돌린다  // 클로킹 모델만 투명재질(나머지는 불투명 유지)
      const p=posAt(e.d,W,H), p2=posAt(e.d+0.0015,W,H);     // 현재/직후 위치 → 진행방향
      m.rim.visible = (selEnemy!=null && selEnemy===e.eid); // 선택 시에만 링
      const fa=Math.atan2(p2.x-p.x, p2.y-p.y)+(MODEL_YAW_OFF[m.id]||0);  // 시계방향 이동 방향 바라봄(+모델보정)
      let d=fa-m.yaw.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); m.yaw.rotation.y += d*Math.min(1, dt*ROT_SPD);
      m.breathe += dt*HOVER_SPD;                            // 공중 부유(둥실둥실)
      m.anim.position.y = Math.sin(m.breathe)*m.h*HOVER_AMP;            // 상하 부유
      m.anim.position.x = Math.sin(m.breathe*0.8+1.7)*m.h*HOVER_AMP*0.45; // 좌우 살짝 표류
      m.anim.rotation.z = Math.sin(m.breathe*0.6)*HOVER_WOBBLE;        // 기우뚱 흔들
      m.anim.rotation.x = 0;
      m.holder.position.set(p.x, (H-p.y) - Y_DROP + HOVER_BASE, 0);  // 지면에서 띄움
      if(e.bossScale){ m.bossScale=e.bossScale; m.holder.scale.setScalar((SCALE[m.id]||MODEL_SCALE)*e.bossScale); }   // 라운드 보스: 모델 확대(일반 적보다 크게)
      if(m.shadow) m.shadow.position.y = -HOVER_BASE/(SCALE[m.id]||MODEL_SCALE);   // 그림자는 지면에(부유 높이만큼 내림)
      // 스폰 0.5초 뒤 반투명(클로킹) — 옵저버 등 지정 모델만, 인스턴스별 개별 타이밍
      m.age=(m.age||0)+dt; const to=(CLOAK_MODELS[m.id] && m.age>=CLOAK_DELAY)?CLOAK_OPACITY:1;
      if(m.mats) for(const mt of m.mats) mt.opacity += (to-mt.opacity)*Math.min(1, dt*5);
      m.holder.visible = !e._fogHidden;   // 🌫️ 활성 시야 밖 적 3D 모델 숨김(사망 처리 X — live 유지)
    }
    // ── 사망 진행/제거 (아군=뒤로 쓰러짐 / 적=축소) ──
    // (되살리기는 위 두 루프에서 reviveModel로 처리 — 사망 모션이 진행 중이던 값들을 전부 원복)
    for(const [key,m] of [...models]){ if(!m.dying) continue; m.deadT+=dt;
      if(m.kind==='enemy'){ const pp=Math.min(1, m.deadT/ENEMY_DEATH);
        m.holder.scale.setScalar((SCALE[m.id]||MODEL_SCALE)*(m.bossScale||1)*(1-pp));   // 보스도 확대 유지하며 축소
        if(m.deadT>=ENEMY_DEATH){ scene.remove(m.holder); models.delete(key); } }
      else { const p=Math.min(1, m.deadT/DEATH_DUR), e=1-Math.pow(1-p,3);
        m.anim.rotation.x = -e*DEATH_ANG; m.anim.position.y = 0;
        if(m.deadT>=DEAD_HOLD){ scene.remove(m.holder); models.delete(key); } }
    }
    // ── 비활성 고정 슬롯 고스트(무채색·축소) — 아직 안 지어진 터렛/포토캐논 자리 ──
    // ⚠ 고정 슬롯 고스트(미건설 터렛/포토)는 '네모네모 게임 전용 장식'이다.
    //    ⛔ 기본은 '안 그린다'. 그리려는 쪽(네모네모 본편·관전)만 __nemoView로 켠다 — 화이트리스트.
    //    예전엔 반대(기본 켜짐 + 끄는 목록)였고, sync를 빌려 쓰는 화면이 생길 때마다 목록에 자기를
    //    추가해야 했다. 잊으면 새 맵·새 화면에 터렛 유령이 그대로 떴다(세 번 반복됐다).
    if(typeof window==='undefined' || !window.__nemoView){ for(const [,g] of ghostModels) g.holder.visible=false; }   // 기본: 안 보임
    else if(typeof FIXED_IDS!=='undefined'){ const gLive=new Set();
      for(const id of FIXED_IDS){ if(!MODELS[id]) continue;
        const slots=FIXED_SLOTS[id], used=units.filter(u=>u.id===id).length;
        const stack=(typeof FIXED_STACK!=='undefined')&&FIXED_STACK[id], emptyIdx=[];
        if(stack){ if(used===0) emptyIdx.push(0); }                  // 스택형(포토): 0개일 때만 한 자리
        else for(let i=used;i<slots.length;i++) emptyIdx.push(i);    // 터렛: 안 채운 자리마다
        for(const i of emptyIdx){ const key=id+':'+i; gLive.add(key);
          let g=ghostModels.get(key); if(!g){ g=makeGhost(id); if(!g) continue; ghostModels.set(key,g); }
          g.holder.visible=true;
          g.breathe=(g.breathe||0)+dt*BREATHE_SPD*0.4; if(g.anim) g.anim.position.y=Math.sin(g.breathe)*g.h*0.004; // 거의 정지
          const p=slots[i]; g.holder.position.set(p.x*W, (H-p.y*H)-Y_DROP, 0);
        }
      }
      for(const [key,g] of ghostModels){ if(!gLive.has(key)) g.holder.visible=false; }
    }
    // ⛔ 합체 베이 3D 비콘은 걷어냈다(2026-08-25) — 매 프레임 만들어 놓고 곧바로 숨기던 껍데기였다.
    for(const [,b] of beaconInsts) b.holder.visible=false;   // 다른 탭의 shop 비콘 인스턴스는 숨김
    if(ringInst){ ringInst.count=ringN;   // 인스턴스 선택링 커밋(0=전부 숨김)
      if(ringN){ ringInst.instanceMatrix.needsUpdate=true; if(ringInst.instanceColor) ringInst.instanceColor.needsUpdate=true; } }
    _shadowInstPass();   // 발밑 그림자 일괄 커밋(모델별 그림자 메시 대체 — 드로우콜 2개)
    if(_prof){ const t1=performance.now(); _prof.loop=t1-_prof.t0;
      scene.updateMatrixWorld(true); const t2=performance.now(); _prof.mw=t2-t1;   // 씬그래프(본 포함) 월드행렬 갱신 — 렌더러가 내부에서 하는 일을 미리 해 비용 분리
      if(_prof.objs==null||(_syncTick&31)===0){ let c=0,b=0; scene.traverse(o=>{ c++; if(o.isBone) b++; }); _prof.objs=c; _prof.bones=b; }
      renderer.render(scene,camera); _prof.render=performance.now()-t2;
      _prof.calls=renderer.info.render.calls; _prof.tris=renderer.info.render.triangles; _prof.progs=renderer.info.programs?renderer.info.programs.length:0; return; }
    renderer.render(scene,camera);
  },
  // 유닛뽑기 탭: 각 슬롯(CLOCK_POS) 위에 실제 3D 모델을 세움(턴테이블 회전). 게임 모델과 분리된 shopModels 사용.
  syncShop(W, H, dt){
    if(!ready||!W||!H) return;
    if(renderer._w!==W||renderer._h!==H){ renderer.setSize(W,H,false);
      camera.left=0;camera.right=W;camera.top=H;camera.bottom=0;camera.updateProjectionMatrix(); renderer._w=W;renderer._h=H; }
    for(const [,m] of models) m.holder.visible=false;   // 게임 모델 숨김
    if(ringInst) ringInst.count=0;   // 인스턴스 선택링도 함께 숨김
    if(shInstA){ shInstA.count=0; shInstB.count=0; }   // 인스턴스 그림자도 숨김
    for(const [,m] of buildModels) m.holder.visible=false;
    for(const [,m] of ghostModels) m.holder.visible=false;
    // 전시 유닛 모델 전부 숨김(가챠로 전환 — 8유닛 시계 제거)
    for(const [k,m] of shopModels){ if(k!=='__cit') m.holder.visible=false; }
    if(bossModel) bossModel.holder.visible=false;
    for(const [,m] of bossRemoteModels) m.holder.visible=false;
    // 뽑기 비콘(3D) — DOM 테두리 패드 안에 비치도록 위치마다 1개씩
    if(beaconBase){ const bw=Math.min(W,H)*0.13*SHOP_BW_MUL*0.55; const shown={};
      DRAW_BEACONS.forEach(beaconDef=>{ const key='draw_'+beaconDef.id; shown[key]=true;
        let bz=beaconInsts.get(key); if(!bz){ bz=makeBeacon(); if(bz) beaconInsts.set(key,bz); }
        if(bz){ bz.holder.visible=true; bz.holder.scale.setScalar(bw/bz.w);
          bz.holder.position.set(beaconDef.x*W, (H-beaconDef.y*H), -300); } });
      for(const [k,b] of beaconInsts){ if(!shown[k]) b.holder.visible=false; }
    }
    // 시민(셀렉터): 이동 방향 보며 달리기, 정지 시 idle (턴테이블 회전 X)
    if(MODELS.citizen && typeof G!=='undefined' && G.citizen){
      let cm=shopModels.get('__cit'); if(!cm){ cm=makeModel('citizen'); if(cm){ cm.kind='shop'; shopModels.set('__cit',cm); } }
      if(cm){ cm.holder.visible=true; cm.rim.visible=(typeof G!=='undefined' && G.shopSel==='citizen');   // 시민 선택 시에만 링(메인 유닛과 동일)
        cm.holder.scale.setScalar((SCALE.citizen||MODEL_SCALE)*SHOP_SCALE_MUL*CITIZEN_SHOP_MUL);
        const cx=G.citizen.x, cy=G.citizen.y, dx=cx-(cm._lx!=null?cm._lx:cx), dy=cy-(cm._ly!=null?cm._ly:cy);
        const moving=Math.hypot(dx,dy)>0.0012; cm._lx=cx; cm._ly=cy;
        if(moving){ const fa=Math.atan2(dx,dy); let d=fa-cm.yaw.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); cm.yaw.rotation.y+=d*Math.min(1,dt*ROT_SPD); }
        if(moving && cm.runInner){ if(cm.inner)cm.inner.visible=false; cm.runInner.visible=true; if(cm.gun)cm.gun.visible=false; cm.anim.position.set(0,0,0); cm.anim.rotation.x=0; cm.anim.rotation.z=0; cm.runMixer.update(dt); }
        else { if(cm.inner)cm.inner.visible=true; if(cm.runInner)cm.runInner.visible=false; cm.breathe+=dt*BREATHE_SPD; cm.anim.position.y=Math.sin(cm.breathe)*cm.h*BREATHE_AMP; cm.anim.position.x=0; cm.anim.rotation.z=0; cm.anim.rotation.x=0; }
        cm.holder.position.set(cx*W, (H-cy*H)-Y_DROP, 0);
      }
    }
    renderer.render(scene,camera);
  },
  // 직스 건설지 탭: 일꾼(+3D 모델 보유 건물)을 화면 정규화 좌표에 3D로 세움. buildModels 풀(게임/전시와 분리).
  syncBuild(list, W, H, dt, scaleMul){
    if(!ready||!W||!H) return;
    { const _pr=Math.min(devicePixelRatio||1,2); if(Math.abs(renderer.getPixelRatio()-_pr)>0.001){ renderer.setPixelRatio(_pr); renderer._w=0; } }   // 건설지는 항상 네이티브 — 전장이 올린 슈퍼샘플 배율을 물려받지 않게 명시 리셋
    if(renderer._w!==W||renderer._h!==H){ renderer.setSize(W,H,false); renderer._w=W;renderer._h=H; }
    camera.left=0;camera.right=W;camera.top=H;camera.bottom=0;camera.updateProjectionMatrix();
    for(const [,m] of models) m.holder.visible=false;
    if(ringInst) ringInst.count=0;   // 인스턴스 선택링도 함께 숨김
    if(shInstA){ shInstA.count=0; shInstB.count=0; }   // 인스턴스 그림자도 숨김
    for(const [,m] of shopModels) m.holder.visible=false;
    for(const [,m] of ghostModels) m.holder.visible=false;
    for(const [,m] of buildGhostModels) m.holder.visible=false;
    for(const [,b] of beaconInsts) b.holder.visible=false;
    if(bossModel) bossModel.holder.visible=false;
    for(const [,m] of bossRemoteModels) m.holder.visible=false;
    const seen=new Set(), seenGhost=new Set(), mul=scaleMul||0.5;
    for(const it of (list||[])){ if(!MODELS[it.id]) continue;
      if(it.ghost){ let g=buildGhostModels.get(it.id); if(!g){ g=makeBuildGhost(it.id); if(!g) continue; g.kind='buildghost'; buildGhostModels.set(it.id,g); }   // 반투명 회색 예비 건물
        seenGhost.add(it.id); g.holder.visible=true; if(g.inner)g.inner.visible=true; if(g.shadow) g.shadow.visible=false;   // 원형 그림자 숨김(사각 footprint가 지면 역할 · 하단 넘침 방지)
        if(it.face!=null) g.yaw.rotation.y=it.face + (MODEL_YAW_OFF[it.id]||0);
        g.holder.scale.setScalar((SCALE[it.id]||MODEL_SCALE)*mul*(it.scl||1));
        g.holder.position.set(it.x*W, (H-it.y*H)-Y_DROP-(it.yoff||0), (it.z!=null?it.z:it.y*H*2.5)); g.holder.rotation.x=it.pitch||0;   // z=화면 아래일수록 앞(painter 정렬 — 겹칠 때 아래 건물이 위 건물을 가림)
        if(it.fitW){ const _fw=it.fitW*(CB_FIT_MUL[it.id]||1); g.holder.updateWorldMatrix(true,true); let _bb=new THREE.Box3().setFromObject(g.yaw); const _pw=_bb.max.x-_bb.min.x; if(_pw>0.5){ g.holder.scale.multiplyScalar(_fw/_pw); g.holder.updateWorldMatrix(true,true); _bb=new THREE.Box3().setFromObject(g.yaw); } g.holder.position.y += ((H-it.y*H)+1) - _bb.min.y - (it.dy||0); }   // 폭을 footprint에 꽉 맞춤(모델별 보정 배율) + 실제 최하단을 footprint 하단 1px 위로
        continue; }
      seen.add(it.uid);
      let m=buildModels.get(it.uid); if(m && m._mid!==it.id){ if(m.holder&&m.holder.parent) m.holder.parent.remove(m.holder); buildModels.delete(it.uid); m=null; }   // 종족 전환 시 eid 재사용으로 이전 종족 모델이 남던 버그 방지(모델 키 불일치 → 재생성)
      if(!m){ m=makeModel(it.id); if(!m) continue; m.kind='build'; m._mid=it.id; buildModels.set(it.uid,m); }
      applyPlayerTintInst(m, it.id);   // 건설 구역도 전부 내 유닛 → NPC 공유 모델(레이스·드랍쉽 등)에 인스턴스 틴트
      m.holder.visible=!it.hidden; if(m.rim){ m.rim.visible=!!it.sel&&!it.hidden; if(it.sel) m.rim.scale.setScalar(1.12); } if(m.shadow) m.shadow.visible=((it.fitW||it.noShadow)?false:true)&&!it.hidden;   // 🌫️ it.hidden=활성 시야 밖 → 숨김 · 그리드 건물(fitW)·공중 유닛(noShadow)은 원형 그림자 숨김(DOM 그림자로 대체)
      if(it.hidden){ continue; }   // 시야 밖: 위치/애니 갱신 생략(숨김 유지)
      if(it.working && m.workInner){ if(m.inner)m.inner.visible=false; if(m.runInner)m.runInner.visible=false; m.workInner.visible=true; if(m.gun)m.gun.visible=false; if(m.atkInner)m.atkInner.visible=false; m.anim.position.set(0,0,0); m.anim.rotation.set(0,0,0); if(m.workMixer) m.workMixer.update(dt); }   // 🔨 건설(작업) 모션 — 일꾼이 건물 지을 때
      else if(it.moving && m.runInner){ if(m.inner)m.inner.visible=false; m.runInner.visible=true; if(m.workInner)m.workInner.visible=false; if(m.gun)m.gun.visible=false; if(m.atkInner)m.atkInner.visible=false; m.anim.position.set(0,0,0); m.anim.rotation.set(0,0,0); if(m.runMixer) m.runMixer.update(dt); }   // 이동: 달리기 모션
      else if(it.moving){ if(m.inner)m.inner.visible=true; if(m.runInner)m.runInner.visible=false; if(m.workInner)m.workInner.visible=false; if(m.gun)m.gun.visible=true; m.walk=(m.walk||0)+dt*WALK_SPD; m.anim.position.set(0,Math.abs(Math.sin(m.walk))*m.h*WALK_BOB,0); m.anim.rotation.z=Math.sin(m.walk*0.5)*WALK_SWAY; }   // 이동(달리기 모델 없음): 절차적 걷기
      else { if(m.inner)m.inner.visible=true; if(m.runInner)m.runInner.visible=false; if(m.workInner)m.workInner.visible=false; if(m.gun)m.gun.visible=true; m.anim.position.set(0,0,0); m.anim.rotation.set(0,0,0); }   // 정지
      if(it.airlift && AIR_FLOAT[it.id]){ m.anim.position.x=0; m.anim.position.y=AIR_LIFT_PX/(SCALE[it.id]||MODEL_SCALE); m.anim.rotation.z=0; m.anim.rotation.x=0; if(m.shadow) m.shadow.material.opacity=0.26; }   // 공중 비행체: 메인 sync와 동일한 고정 부양(airlift 플래그 있을 때만 — 직스 등 기존 호출 무영향)
      if(it.face!=null){ const _tgt=it.face + (it.yawFix?(MODEL_YAW_OFF[it.id]||0):0);   // yawFix=모델별 정면 보정(템페스트·레이서·팔콘 등 옆으로 틀어지는 모델 +90° 등)
        if(it.yawFix){ let _d=_tgt-m.yaw.rotation.y; _d=Math.atan2(Math.sin(_d),Math.cos(_d)); m.yaw.rotation.y+=_d*Math.min(1,dt*ROT_SPD); }   // 메인 sync와 동일: 부드럽게 회전 보간(끊김 방지)
        else m.yaw.rotation.y=_tgt; }
      m.holder.scale.setScalar((SCALE[it.id]||MODEL_SCALE)*mul*(it.scl||1));
      m.holder.position.set(it.x*W, (H-it.y*H)-Y_DROP-(it.yoff||0), (it.z!=null?it.z:it.y*H*2.5));   // yoff=화면 아래로 내림 · z=화면 아래일수록 앞(겹칠 때 아래 건물이 앞에 보임)
      m.holder.rotation.x = it.pitch||0;   // 건물 사선 틸트(SC식 부감) — 미지정=0(기존 동작 유지)
      if(it.fitW){ const _fw=it.fitW*(CB_FIT_MUL[it.id]||1); m.holder.updateWorldMatrix(true,true); let _bb=new THREE.Box3().setFromObject(m.yaw); const _pw=_bb.max.x-_bb.min.x; if(_pw>0.5){ m.holder.scale.multiplyScalar(_fw/_pw); m.holder.updateWorldMatrix(true,true); _bb=new THREE.Box3().setFromObject(m.yaw); } m.holder.position.y += ((H-it.y*H)+1) - _bb.min.y + (it.lift||0) - (it.dy||0); }   // 폭을 footprint에 꽉 맞춤 + 최하단을 footprint 하단으로 + 🛫 lift(부양 높이) 적용
      if(it.buildP!=null){   // 🏗 건설 중: 하단→상단 채움(월드 Y) + 유닛보다 뒤(z)에 그려 겹쳐도 유닛이 보임
        if(!m._bldMats){ try{ m._bldMats=cloneMats(m.anim); if(m._bldMats) for(const _mt of m._bldMats){ const _orig=_mt.onBeforeCompile; _mt._fillY={value:-1e9}; _mt._flashY={value:-1e9}; _mt._flashI={value:0};   // 채움선 + 완성 빛 스윕 유니폼
          _mt.onBeforeCompile=(sh)=>{ if(_orig) _orig(sh); sh.uniforms.uFillY=_mt._fillY; sh.uniforms.uFlashY=_mt._flashY; sh.uniforms.uFlashI=_mt._flashI;   // 원래 림 셰이더 유지 + 채움/빛 게이팅
            sh.vertexShader='varying float vBldWY;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n  vBldWY=(modelMatrix*vec4(transformed,1.0)).y;');
            sh.fragmentShader='uniform float uFillY;\nuniform float uFlashY;\nuniform float uFlashI;\nvarying float vBldWY;\n'+sh.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n  gl_FragColor.a *= mix(0.12, 1.0, step(vBldWY, uFillY));\n  float _fb=max(0.0, 1.0 - abs(vBldWY-uFlashY)/24.0);\n  gl_FragColor.rgb += vec3(0.55,0.85,1.0)*(_fb*_fb)*uFlashI;'); };   // 채움선 아래=원색/위=옅은 투명 · 빛 밴드=아래→위 스윕
          _mt.transparent=true; _mt.depthWrite=false; _mt.needsUpdate=true; } }catch(_e){ m._bldMats=null; } }
        m.holder.updateWorldMatrix(true,true); const _bbb=new THREE.Box3().setFromObject(m.yaw); const _bpv=Math.max(0,Math.min(1,it.buildP)); const _fy=_bbb.min.y+_bpv*(_bbb.max.y-_bbb.min.y);   // 채움선 = 바닥→꼭대기 완료율 비례
        if(m._bldMats) for(const _mt of m._bldMats){ if(_mt._fillY) _mt._fillY.value=_fy; if(_mt._flashI) _mt._flashI.value=0; _mt.transparent=true; _mt.depthWrite=false; }
        m.holder.position.z=-100;   // 유닛(z≥0)보다 뒤 → 건설 중 겹쳐도 유닛이 안 가려짐
        m._wasBuilding=true; if(m.shadow) m.shadow.visible=false; }
      else {   // 완성됨: 정상 깊이(유닛을 가릴 수 있음). 방금 완성됐으면 아래→위 빛 스윕 1회
        if(m._wasBuilding && m._bldMats){ m._flashT=0; m._wasBuilding=false; }
        if(m._flashT!=null && m._bldMats){   // ✨ 완성 빛 스윕(아래→위 한 번)
          m._flashT+=dt; const _FD=0.6, _ft=m._flashT/_FD;
          if(_ft>=1){ for(const _mt of m._bldMats){ if(_mt._flashI)_mt._flashI.value=0; if(_mt._fillY)_mt._fillY.value=1e9; _mt.transparent=false; _mt.depthWrite=true; } m._flashT=null; m._bldMats=null; }
          else { m.holder.updateWorldMatrix(true,true); const _fbb=new THREE.Box3().setFromObject(m.yaw); const _sweepY=_fbb.min.y+_ft*((_fbb.max.y-_fbb.min.y)+24);
            for(const _mt of m._bldMats){ if(_mt._fillY)_mt._fillY.value=1e9; if(_mt._flashY)_mt._flashY.value=_sweepY; if(_mt._flashI)_mt._flashI.value=1.7*(1.0-_ft*0.4); _mt.transparent=false; _mt.depthWrite=true; } } } }
      if(m.anim && typeof it.id==='string' && it.id.indexOf('cb_')!==0){ m.holder.updateWorldMatrix(false,true); const _cc=new THREE.Box3().setFromObject(m.anim).getCenter(new THREE.Vector3()); _cc.project(camera); m.centerN={ x:_cc.x*0.5+0.5, y:0.5-_cc.y*0.5 }; } else m.centerN=null;   // 유닛(건물 cb_ 제외) 몸 중앙 2D 투영 — 이동 트레일 원점(메인 sync와 동일, 팬·줌·부양 정확 반영)
    }
    for(const [k,m] of buildModels){ if(!seen.has(k)) m.holder.visible=false; }
    for(const [k,g] of buildGhostModels){ if(!seenGhost.has(k)) g.holder.visible=false; }
    renderer.render(scene,camera);
  },
  // 공용 보스 토벌장: 보스 1종 + 파견 유닛(실제 3D 모델)이 무대에 서서 교전
  syncBoss(W, H, dt){
    if(!ready||!W||!H) return;
    if(renderer._w!==W||renderer._h!==H){ renderer.setSize(W,H,false);
      camera.left=0;camera.right=W;camera.top=H;camera.bottom=0;camera.updateProjectionMatrix(); renderer._w=W;renderer._h=H; }
    if(ringInst) ringInst.count=0;   // 인스턴스 선택링 숨김(게임 화면 전용)
    for(const [,m] of shopModels) m.holder.visible=false;
    for(const [,m] of ghostModels) m.holder.visible=false;
    for(const [,b] of beaconInsts) b.holder.visible=false;
    const px=BOSS_VIEW.x||0, py=BOSS_VIEW.y||0;
    const feetWorldY=H*(1-BOSS_FEET_FRAC), bossSX=W*0.5+px, bossScreenY=H*BOSS_FEET_FRAC;
    const alive=(typeof G!=='undefined' && G.coopBoss && !G.coopBoss.dead);
    // ── 보스 ──
    const _cbId = (typeof coinBldgId==='function') ? coinBldgId() : BOSS_MODEL_BLD;   // 🏢 순차 파괴: 레벨마다 다른 유니온 테크 건물(부수면 다음 레벨=다음 건물)
    const bossId = bases[_cbId] ? _cbId : (bases[BOSS_MODEL_AIR] ? BOSS_MODEL_AIR : BOSS_MODEL);   // 포인트방=현 레벨 건물(로드 시) / 공중 기함 / archon 폴백
    const bossBld=(bossId===_cbId);   // 건물 = 지상 고정(부양·흔들림 없음)
    if(MODELS[bossId] && alive){
      let m=bossModel; if(m && m.id!==bossId){ scene.remove(m.holder); bossModel=null; m=null; }   // 모델 바뀌면 교체(레벨업 = 다음 건물)
      if(!m){ m=makeModel(bossId); if(m){ m.kind='boss'; bossModel=m; } }
      if(m){ m.holder.visible=true; if(m.inner)m.inner.visible=true; if(m.runInner)m.runInner.visible=false; if(m.gun)m.gun.visible=(!bossBld);
        if(m.rim){ if(bossBld){ const selB=(typeof G!=='undefined'&&G.bossBldSel); m.rim.visible=!!selB; if(selB) m.rim.scale.setScalar(1.12); } else m.rim.visible=false; }   // 포인트방 건물 하단링 = 건설 구역과 완전 동일(기본 teal 셀렉션 링·scale 1.12·지정 시에만)
        { const _isCb=bossId.indexOf('cb_')===0; m.holder.scale.setScalar((SCALE[bossId]||MODEL_SCALE)*(bossBld?(_isCb?COIN_CB_SCALE_MUL:BOSS_BLD_SCALE_MUL):BOSS_SCALE_MUL)); }
        m.yaw.rotation.y = bossBld ? upgBldgYaw(bossId) : (MODEL_YAW_OFF[bossId]||0);   // 건물 = 건설 구역과 각도 통일(CST_YAW+f · 대각 3/4 뷰)
        if(bossBld){ m.anim.position.set(0,0,0); m.anim.rotation.set(0,0,0); }   // 건물: 지상 고정
        else { m.breathe=(m.breathe||0)+dt*HOVER_SPD*0.7;   // 공중 기함(폴백) = 부유
          m.anim.position.set(Math.sin(m.breathe*0.8+1.7)*m.h*HOVER_AMP*0.3, m.h*0.6 + Math.sin(m.breathe)*m.h*HOVER_AMP, 0);
          m.anim.rotation.set(0,0,Math.sin(m.breathe*0.6)*HOVER_WOBBLE*0.6); }
        m.holder.position.set(bossSX, feetWorldY - py - Y_DROP, 0); }
    } else if(bossModel){ bossModel.holder.visible=false; }
    // ── 파견 유닛: 실제 모델이 진형으로 무대에 서서 보스를 향함 ──
    const depAll=(typeof bossArenaUnits==='function' && typeof G!=='undefined')?bossArenaUnits():((typeof G!=='undefined')?G.units.filter(u=>u.atBoss):[]);
    const dep=depAll.filter(u=>MODELS[u.gmodel||u.id]);
    const liveB=new Set(dep.map(u=>u.uid));
    for(const [key,mm] of models){ if(!liveB.has(key)) mm.holder.visible=false; }   // 비파견 유닛 숨김
    for(const [key,mm] of bossRemoteModels){ if(!liveB.has(key)) mm.holder.visible=false; }   // 회수/이탈한 원격 유닛 숨김
    for(let i=0;i<dep.length;i++){ const u=dep[i]; const _id=u.gmodel||u.id;
      const mMap=u.remote?bossRemoteModels:models;   // 원격 유닛은 전용 맵(메인 사망 스윕 비대상)
      let mu=mMap.get(u.uid); if(!mu){ mu=makeModel(_id); if(!mu) continue; mu.kind='unit'; mMap.set(u.uid,mu); }
      mu.holder.visible=true; if(mu.heroRing) mu.heroRing.visible=false;
      if(mu.rim){ if(u.remote){ mu.rim.visible=true;   // 원격: 플레이어색 림으로 식별
          const pc=(typeof PLAYER_VIEW_COLORS!=='undefined')?PLAYER_VIEW_COLORS[((u.pnum||2)-1)%PLAYER_VIEW_COLORS.length]:'#7fc8ff';
          mu.rim.material.color.set(pc); }
        else { const seld=(typeof _baSel!=='undefined' && _baSel.indexOf(u.uid)>=0); mu.rim.visible=seld; if(seld) mu.rim.material.color.setHex(0x46f06a); } }
      mu.holder.scale.setScalar(SCALE[_id]||MODEL_SCALE);
      const p=bossUnitXY(u,i,dep.length), uSX=p.x*W+px;
      mu.holder.position.set(uSX, (H-p.y*H)-Y_DROP-py, 0);
      // 이동 감지: 내 유닛=bMov 플래그(이동 명령), 원격 유닛=프레임 간 위치 변화
      const scrY=p.y*H;
      let mvx=0,mvy=0,isMov=false;
      if(u.remote){ const lx=(mu._lx!=null)?mu._lx:uSX, ly=(mu._ly!=null)?mu._ly:scrY;
        mvx=uSX-lx; mvy=scrY-ly; isMov=Math.hypot(mvx,mvy)>Math.max(0.4, dt*W*0.04); }
      else { isMov=!!u.bMov; mvx=u.bMvx||0; mvy=u.bMvy||0; }
      mu._lx=uSX; mu._ly=scrY;
      if(!NO_TURN[_id]){ const fa=isMov? Math.atan2(mvx,mvy) : Math.atan2(bossSX-uSX, bossScreenY-scrY);   // 이동 중=진행 방향, 정지=보스 바라봄
        const tgt=fa+ROT_OFFSET+(MODEL_YAW_OFF[_id]||0); let d=tgt-mu.yaw.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); mu.yaw.rotation.y+=d*Math.min(1,dt*ROT_SPD); }
      if((u.fireSeq||0)>(mu.seenSeq||0)){ mu.seenSeq=u.fireSeq; mu.lean=1; if(mu.atkAction){ if(typeof ATK_LOOP!=='undefined'&&ATK_LOOP[mu.id]){ mu.atkAction.time=0; if(!mu.atkAction.isRunning()) mu.atkAction.play(); } else { mu.atkAction.reset(); mu.atkAction.play(); } mu.atkT=mu.atkDur; } }
      mu.lean=(mu.lean||0)*Math.max(0,1-dt*LEAN_DECAY);
      if(isMov) mu.atkT=0; else if(mu.atkT>0) mu.atkT-=dt;   // 이동 중 공격모션 취소(메인과 동일)
      if(isMov && mu.runInner){            // 달리기 모델(클립 재생) — 메인과 동일
        if(mu.inner)mu.inner.visible=false; mu.runInner.visible=true; if(mu.gun)mu.gun.visible=false; if(mu.atkInner)mu.atkInner.visible=false;
        mu.anim.position.set(0,0,0); mu.anim.rotation.x=0; mu.anim.rotation.z=0;
        if(mu.runMixer) mu.runMixer.update(dt);
      } else if(isMov){                    // 달리기 모델 없는 유닛 → 절차적 걷기(메인과 동일)
        if(mu.inner)mu.inner.visible=true; if(mu.runInner)mu.runInner.visible=false; if(mu.gun)mu.gun.visible=true; if(mu.atkInner)mu.atkInner.visible=false;
        mu.walk=(mu.walk||0)+dt*WALK_SPD;
        mu.anim.position.x=0; mu.anim.position.y=Math.abs(Math.sin(mu.walk))*mu.h*WALK_BOB;
        mu.anim.rotation.z=Math.sin(mu.walk*0.5)*WALK_SWAY; mu.anim.rotation.x=WALK_LEAN;
      } else if(mu.atkT>0 && mu.atkInner){ if(mu.inner)mu.inner.visible=false; if(mu.runInner)mu.runInner.visible=false; if(mu.gun)mu.gun.visible=false; mu.atkInner.visible=true; mu.anim.position.set(0,0,0); mu.anim.rotation.set(0,0,0); mu.atkMixer.update(dt); }
      else { if(mu.inner)mu.inner.visible=true; if(mu.runInner)mu.runInner.visible=false; if(mu.gun)mu.gun.visible=true; if(mu.atkInner)mu.atkInner.visible=false;
        mu.breathe=(mu.breathe||0)+dt*BREATHE_SPD; mu.anim.position.y=Math.sin(mu.breathe)*mu.h*BREATHE_AMP; mu.anim.position.x=0; mu.anim.rotation.set(0,0,0); }
      if(AIR_FLOAT[_id]){ const _scA=(SCALE[_id]||MODEL_SCALE);   // 공중 비행체: 토벌장에서도 동일 정지 부양
        mu.anim.position.y=AIR_LIFT_PX/_scA;
        mu.anim.rotation.z=0;
        if(mu.shadow) mu.shadow.material.opacity=0.26; }
    }
    _shadowInstPass();   // 파견/원격 유닛 발밑 그림자(인스턴스) — 메인과 동일 경로
    renderer.render(scene,camera);
  }
};
init();
window.M3D.matDbg=(uid)=>{ const m=models.get(uid); if(!m) return null; const dump=(root)=>{ const out=[]; if(!root) return out; root.traverse(o=>{ if(!o.isMesh) return; const ms=Array.isArray(o.material)?o.material:[o.material]; ms.forEach(mt=>{ if(!mt) return; out.push({nm:mt.name||"", type:mt.type, color:mt.color?"#"+mt.color.getHexString():null, emis:mt.emissive?"#"+mt.emissive.getHexString():null, emisInt:mt.emissiveIntensity, emisMap:!!mt.emissiveMap, map:!!mt.map, metal:mt.metalness, rough:mt.roughness, envInt:mt.envMapIntensity, tinted:!!mt._tinted}); }); }); return out; };
  return {inner:dump(m.inner), run:dump(m.runInner), stay:dump(m.stayInner), atk:dump(m.atkInner)}; };   // 재질 디버그(정지/이동 룩 차이 진단용)
window.M3D.dbg=()=>({ n:models.size, ready, loaded:Object.keys(bases), rings:(ringInst?ringInst.count:0), anims:[...models].map(([uid,m])=>({uid,id:m.id,dying:m.dying,yaw:+m.yaw.rotation.y.toFixed(2),px:Math.round(m.h*m.holder.scale.x),pos:[Math.round(m.holder.position.x),Math.round(m.holder.position.y)], z:Math.round(m.holder.position.z)})) });   // px = 화면상 모델 높이
window.M3D.prof=(on)=>{ if(on!==undefined) _prof=on?(_prof||{}):null; return _prof; };   // 렌더 프로파일 on/off — {loop, render} 최근 프레임 ms(벤치 전용)
window.M3D.mixForce=(n)=>{ _mixForce=n|0; return _mixForce; };   // 애니 분산값 강제(0=자동) — 벤치 A/B 전용
window.M3D.boneVis=(on)=>{ let n=0; for(const [,m] of models) for(const r of [m.inner,m.runInner,m.stayInner,m.workInner,m.atkInner]){ if(!r) continue;
  r.traverse(o=>{ if(o._boneRoot){ o.visible=!!on; n++; } }); } return n; };   // 본 서브트리 순회 제외 on/off — 벤치 A/B 전용
window.M3D.setPlayerRim=setPlayerRim;   // 아군 림 색 전환(플레이어 구역 관전: 관전 플레이어 색으로)
window.M3D.dropModels=(uids)=>{ for(const uid of uids){ const m=models.get(uid); if(m){ scene.remove(m.holder); models.delete(uid); } } };  // 즉시 제거(합성 소모 유닛 — 사망모션 생략)
window.M3D.clearGameModels=()=>{ for(const [uid,m] of [...models]){ scene.remove(m.holder); models.delete(uid); } };   // 전체 즉시 제거(관전 전환 — 사망모션 생략)
window.M3D.beaconReady=()=>!!beaconBase;   // 3D 비콘 로드 완료 여부(2D 폴백 판단용)
