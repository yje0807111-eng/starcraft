/* ============================================================================
 * 01-data.js — 유닛/밸런스 실값(엑셀) · 유닛 SVG 아이콘 · 유즈맵 레지스트리
 * sc-ums-web.html 에서 분리(2026-08-20). 로드 순서 = 파일명 번호 순.
 * ⛔ 순서를 바꾸거나 파일을 합치지 말 것 — 전역 스코프를 공유하는 통짜 코드다.
 * ========================================================================== */
// ============================================================================
// 데이터 — 엑셀(스타 유즈맥.xlsx) 실값
// ============================================================================
// 캔버스(2D ctx.font)용 숫자 폰트 — CSS의 --font-num과 같은 값이지만 캔버스는 var()를 못 읽어 여기 따로 둔다.
// 폰트를 바꿀 땐 :root의 --font-num과 이 상수를 같이 고칠 것.
const FONT_NUM='Rajdhani,"IBM Plex Sans KR","Apple SD Gothic Neo",sans-serif';
// ── 시스템 메시지 아이콘 ── 이모지 대신 라인 아이콘(24/1.7/currentColor) 한 벌.
// 색은 빨강(--neon) 통일, 상태색만 예외: 성공=초록 · 자원=금색
const _MI=(p,c)=>({d:'<svg class="mIco'+(c?' '+c:'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'});
const MSG_ICO={
  '⚠️':_MI('<path d="M12 4.4 21 19.6H3z"/><path d="M12 10v4.1"/><circle cx="12" cy="17.2" r=".95" fill="currentColor" stroke="none"/>'),
  '⛔':_MI('<circle cx="12" cy="12" r="8.3"/><path d="M6.2 6.2 17.8 17.8"/>'),
  '🔒':_MI('<rect x="5.4" y="10.6" width="13.2" height="9" rx="2"/><path d="M8.4 10.6V8.4a3.6 3.6 0 0 1 7.2 0v2.2"/>'),
  '⏸':_MI('<path d="M9.5 6.5v11M14.5 6.5v11"/>'),
  '↩':_MI('<path d="M9.4 7.2 5 11.6l4.4 4.4"/><path d="M5 11.6h9.2a4.4 4.4 0 0 1 0 8.8H12"/>'),
  '⛏':_MI('<path d="M4.6 19.4 13 11"/><path d="M6.2 8.2a9 9 0 0 1 11.6 0"/><path d="M6.2 8.2 11 13"/><path d="M17.8 8.2 13 13"/>'),
  '📦':_MI('<path d="M4.6 8.4 12 5l7.4 3.4v7.2L12 19l-7.4-3.4z"/><path d="M4.6 8.4 12 11.8l7.4-3.4"/><path d="M12 11.8V19"/>'),
  '▶':_MI('<path d="M8.5 6 18 12 8.5 18Z"/>'),
  '🔓':_MI('<rect x="5.4" y="10.6" width="13.2" height="9" rx="2"/><path d="M8.4 10.6V8.4a3.6 3.6 0 0 1 6.6-1.9"/>','ok'),
  '✓':_MI('<path d="M5 12.6 9.4 17 19 7.4"/>','ok'),
  '💰':_MI('<circle cx="12" cy="12" r="8"/><path d="M14.4 9.6a3.3 3.3 0 1 0 0 4.8"/>','coin'),
  '🪙':_MI('<circle cx="12" cy="12" r="8"/><path d="M14.4 9.6a3.3 3.3 0 1 0 0 4.8"/>','coin'),
  '🎲':_MI('<rect x="4.3" y="4.3" width="15.4" height="15.4" rx="3.4"/><circle cx="9" cy="9" r="1.05" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.05" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.05" fill="currentColor" stroke="none"/>'),
  '👤':_MI('<circle cx="12" cy="8.2" r="3.2"/><path d="M5.6 19.6c0-3.5 2.9-6.1 6.4-6.1s6.4 2.6 6.4 6.1"/>'),
  '🤝':_MI('<circle cx="9" cy="8.6" r="2.7"/><path d="M3.8 18.9c0-2.8 2.3-4.8 5.2-4.8s5.2 2 5.2 4.8"/><circle cx="16.8" cy="9.2" r="2.1"/><path d="M15.5 14.2c2.4.3 4.6 2 4.6 4.6"/>'),
  '☠':_MI('<path d="M4 8.6 7.6 11.7 12 5.2l4.4 6.5L20 8.6l-1.7 9.6H5.7z"/>'),
  '💀':_MI('<path d="M12 3.4a7.2 7.2 0 0 1 7.2 7.2c0 2.4-1.2 3.8-2.2 4.8v2.6a1.6 1.6 0 0 1-1.6 1.6H8.6A1.6 1.6 0 0 1 7 18v-2.6c-1-1-2.2-2.4-2.2-4.8A7.2 7.2 0 0 1 12 3.4z"/><circle cx="9.4" cy="11" r="1.5"/><circle cx="14.6" cy="11" r="1.5"/><path d="M10.6 15.6h2.8"/>'),
  '👹':_MI('<path d="M4 8.6 7.6 11.7 12 5.2l4.4 6.5L20 8.6l-1.7 9.6H5.7z"/>'),
  '🎉':_MI('<path d="M12 3.6l1.7 5 5 1.7-5 1.7L12 17l-1.7-5-5-1.7 5-1.7z"/><path d="M18.6 15l.55 1.7 1.7.55-1.7.55-.55 1.7-.55-1.7-1.7-.55 1.7-.55z"/>'),
  '➕':_MI('<path d="M12 5.6v12.8M5.6 12h12.8"/>','ok'),
  '🚪':_MI('<path d="M14.2 4.6H6.8v14.8h7.4"/><path d="M10.8 12h8.6M16.2 8.8 19.4 12l-3.2 3.2"/>'),
  '🌑':_MI('<path d="M3.5 12S6.9 6.4 12 6.4s8.5 5.6 8.5 5.6-3.4 5.6-8.5 5.6S3.5 12 3.5 12z"/><path d="M4.2 4.2 19.8 19.8"/>'),
  // ── 스킬 사용 안내(대상 지정) ──
  '☢':_MI('<circle cx="12" cy="12" r="8.3"/><path d="M12 12 8.4 5.8M12 12l7.2 0M12 12l-3.6 6.2"/>'),
  '🐛':_MI('<path d="M8.4 9.4a3.6 3.6 0 0 1 7.2 0v5a3.6 3.6 0 0 1-7.2 0z"/><path d="M8.4 11H5M8.4 14H5M15.6 11H19M15.6 14H19M10 6l-1.4-2M14 6l1.4-2"/>'),
  '✚':_MI('<path d="M12 6v12M6 12h12"/>','ok'),
  '🕸':_MI('<path d="M12 3.8v16.4M3.8 12h16.4M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8"/><path d="M12 8.2 15.8 12 12 15.8 8.2 12z"/>'),
  '💣':_MI('<circle cx="10.8" cy="14.4" r="5.6"/><path d="M14.8 10.4 17.4 7.8M17.4 7.8h2.8M17.4 7.8V5"/>'),
  '🛡':_MI('<path d="M12 3.5 19 6.1v5.2c0 4.2-2.9 7.4-7 8.7-4.1-1.3-7-4.5-7-8.7V6.1z"/>'),
  '🌀':_MI('<path d="M12 4.4a7.6 7.6 0 1 1-7.4 9.2"/><path d="M12 8.2a3.8 3.8 0 1 0 3.7 4.6"/>'),
  '🧠':_MI('<path d="M9.4 5.2a3 3 0 0 0-3 3 2.8 2.8 0 0 0-.6 5.2v1.4a3.4 3.4 0 0 0 6.2 1.9V6.6a3 3 0 0 0-2.6-1.4z"/><path d="M14.6 5.2a3 3 0 0 1 3 3 2.8 2.8 0 0 1 .6 5.2v1.4a3.4 3.4 0 0 1-6.2 1.9"/>'),
  '🧊':_MI('<path d="M12 3.6 19.4 7.8v8.4L12 20.4 4.6 16.2V7.8z"/><path d="M12 12v8.4M12 12 4.6 7.8M12 12l7.4-4.2"/>'),
  '🦠':_MI('<circle cx="12" cy="12" r="6.6"/><circle cx="10" cy="10.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.2" cy="13.4" r="1.1" fill="currentColor" stroke="none"/><path d="M12 5.4V3.4M18.6 12h2M12 18.6v2M5.4 12h-2"/>'),
  '☁':_MI('<path d="M7.4 17.6a3.8 3.8 0 0 1 .3-7.6 5.2 5.2 0 0 1 10 1.2 3.2 3.2 0 0 1-.5 6.4z"/>'),
  '🩸':_MI('<path d="M12 4.2c3 3.6 5.4 6.2 5.4 9.2A5.4 5.4 0 0 1 12 18.8a5.4 5.4 0 0 1-5.4-5.4c0-3 2.4-5.6 5.4-9.2z"/>'),
  '🍽':_MI('<path d="M7 4.2v7.2a2.2 2.2 0 0 0 4.4 0V4.2M9.2 11.4v8.4"/><path d="M16.4 4.2c-1.6 1.2-2.2 3-2.2 5s.7 2.6 2.2 2.8v7.8"/>'),
  '✳':_MI('<path d="M12 4.6v14.8M5.6 8.3l12.8 7.4M18.4 8.3 5.6 15.7"/>','ok'),
  '📡':_MI('<path d="M5.2 18.8 12 6.4l6.8 12.4z"/><path d="M8 14.6h8"/><path d="M15.4 4.6a5.6 5.6 0 0 1 4 4"/>'),
  '🔋':_MI('<rect x="3.4" y="8" width="14.4" height="8" rx="2"/><path d="M20.6 10.6v2.8"/><path d="m11.4 9.6-2.2 3.4h3l-2 3.2"/>'),
  // ── 뽑기·강화 결과 ──
  '💥':_MI('<path d="m12 3.4 2.2 4.8 5-1.4-1.6 5 4.2 3.2-4.9 1.4.6 5-4.3-2.6-4.3 2.6.6-5-4.9-1.4L4.8 11.8 3.2 6.8l5 1.4z"/>','coin'),
  '✨':_MI('<path d="M11 4.2 12.6 8.4 16.8 10 12.6 11.6 11 15.8 9.4 11.6 5.2 10l4.2-1.6z"/><path d="m17.8 14.6.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>'),
  '👍':_MI('<path d="M6.8 10.8h2.4v8.4H6.8z"/><path d="M9.2 11.4 12.4 4.8a2 2 0 0 1 1.8 2.2v2.4h3.6a1.7 1.7 0 0 1 1.6 2.2l-1.4 5a1.8 1.8 0 0 1-1.7 1.4H9.2z"/>','ok'),
  '⭐':_MI('<path d="M12 4 14 9.2 19.6 9.6 15.3 13.2 16.6 18.6 12 15.6 7.4 18.6 8.7 13.2 4.4 9.6 10 9.2z"/>','coin'),
  '✦':_MI('<path d="M12 3.4c.6 4.2 1.9 5.5 6.1 6.1-4.2.6-5.5 1.9-6.1 6.1-.6-4.2-1.9-5.5-6.1-6.1 4.2-.6 5.5-1.9 6.1-6.1z"/><path d="M12 18.2v2.4"/>','coin'),
  '⚡':_MI('<path d="M13.4 3.6 6.6 13.2h4.6l-1 7.2 6.8-9.6h-4.6z"/>'),
  'ℹ️':_MI('<circle cx="12" cy="12" r="8.3"/><path d="M12 11v5.2"/><circle cx="12" cy="7.9" r=".95" fill="currentColor" stroke="none"/>'),
  // ── 커맨드 그리드 초상 · 구역 라벨 ──
  '⚙️':_MI('<circle cx="12" cy="12" r="3.2"/><path d="M12 3.6v2.4M12 18v2.4M4.6 12H7M17 12h2.4M6.7 6.7l1.7 1.7M15.6 15.6l1.7 1.7M17.3 6.7l-1.7 1.7M8.4 15.6l-1.7 1.7"/>'),
  '⚛️':_MI('<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="8.4" ry="3.4"/><ellipse cx="12" cy="12" rx="8.4" ry="3.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8.4" ry="3.4" transform="rotate(120 12 12)"/>'),
  '⬆️':_MI('<path d="M12 19.4V5M6.4 10.6 12 5l5.6 5.6"/>'),
  'PERM':_MI('<path d="M12 2.8 19.6 6v6c0 4.6-3.1 8-7.6 9.2C7.5 20 4.4 16.6 4.4 12V6z"/><path d="M12 8.2v7"/><path d="M9 11.2 12 8.2l3 3"/><path d="M8.6 17.4h6.8"/>'),   // 영구 강화 = 방패 위 상승 화살 + 기반선
  '🎯':_MI('<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>'),
  '👥':_MI('<circle cx="9" cy="8.6" r="2.8"/><path d="M3.7 19c0-2.9 2.3-4.9 5.3-4.9s5.3 2 5.3 4.9"/><circle cx="16.9" cy="9.2" r="2.1"/><path d="M15.5 14.4c2.4.3 4.7 2 4.7 4.6"/>'),
  '👷':_MI('<circle cx="12" cy="12.4" r="2.8"/><path d="M5.6 19.6c0-3.2 2.9-5.4 6.4-5.4s6.4 2.2 6.4 5.4"/><path d="M5.8 8.6a6.2 6.2 0 0 1 12.4 0z"/><path d="M4.4 8.6h15.2"/>'),
  '💎':_MI('<path d="M7.4 4.4h9.2l3.8 5-8.4 10.2L3.6 9.4z"/><path d="M3.6 9.4h16.8M9.2 9.4 12 19.6 14.8 9.4M7.4 4.4 9.2 9.4M16.6 4.4 14.8 9.4"/>'),
  '💨':_MI('<path d="M3.6 8.6h9.6a2.6 2.6 0 1 0-2.6-2.6"/><path d="M3.6 12.6h13a2.6 2.6 0 1 1-2.6 2.6"/><path d="M3.6 16.6h6.8"/>'),
  '🔧':_MI('<path d="M15.2 4.4a5 5 0 0 0-6.1 6.6L4 16.1a2 2 0 0 0 2.8 2.8l5.1-5.1a5 5 0 0 0 6.6-6.1l-2.8 2.8-2.4-2.4z"/>'),
  '🔬':_MI('<path d="M9.6 4.6h3.2v6.2H9.6z"/><path d="M11.2 10.8a5.6 5.6 0 1 0 5 2.9"/><path d="M5.4 19.8h13.2"/>'),
  '🕳':_MI('<ellipse cx="12" cy="14.6" rx="7.6" ry="4.4"/><ellipse cx="12" cy="14.6" rx="3.4" ry="1.9"/><path d="M4.6 12.6C5.4 8.4 8.4 5.4 12 5.4s6.6 3 7.4 7.2"/>'),
  '🚩':_MI('<path d="M6.4 20.4V4.2"/><path d="M6.4 5.2h11.2l-2.4 3.6 2.4 3.6H6.4z"/>'),
  '🛫':_MI('<path d="M3.6 19.4h16.8"/><path d="M4.4 12.6 6.8 12l3.4 1.6 4.4-5.6a1.8 1.8 0 0 1 2.9 2.1l-3.1 5.5-9.2 1.6z"/>'),
  '🛬':_MI('<path d="M3.6 19.4h16.8"/><path d="M19.6 15.4 18.4 13l-2.6-2.8-.6-7a1.8 1.8 0 0 0-3.3 1.2l.6 6.3-5.4-1.5-.9 2.4z"/>'),
  '🏢':_MI('<path d="M5.4 20.4V4.6h9.2v15.8"/><path d="M14.6 9.6h4v10.8"/><path d="M8 8h3.4M8 11.6h3.4M8 15.2h3.4"/><path d="M3.6 20.4h16.8"/>'),
  '🧬':_MI('<path d="M7 3.6c0 5.6 10 6.8 10 12.4a4.2 4.2 0 0 1-4.6 4.4"/><path d="M17 3.6c0 5.6-10 6.8-10 12.4a4.2 4.2 0 0 0 4.6 4.4"/><path d="M8.4 7.6h7.2M8.4 16.4h7.2"/>'),
  '🏗':_MI('<path d="M4.6 20.4V4.6l11.8 6.4"/><path d="M4.6 9.4 12 13.4M4.6 14.4 9 16.8"/><path d="M3.4 20.4h17.2"/><path d="M16.4 11v9.4"/>'),
  '📦':_MI('<path d="M3.8 7.6 12 4.2l8.2 3.4v8.8L12 19.8l-8.2-3.4z"/><path d="M3.8 7.6 12 11l8.2-3.4M12 11v8.8"/>'),
  '👁':_MI('<path d="M3.5 12S6.9 6.6 12 6.6s8.5 5.4 8.5 5.4-3.4 5.4-8.5 5.4S3.5 12 3.5 12z"/><circle cx="12" cy="12" r="2.6"/>'),
  '📍':_MI('<path d="M12 20.6s6.4-6 6.4-10.2a6.4 6.4 0 1 0-12.8 0C5.6 14.6 12 20.6 12 20.6z"/><circle cx="12" cy="10.2" r="2.4"/>'),
  '📊':_MI('<path d="M4.4 19.6h15.2"/><path d="M7.4 19.6v-6M12 19.6V6.4M16.6 19.6v-9"/>'),
  '⚔️':_MI('<path d="M5.4 4.4h3l9.2 9.2-3 3z"/><path d="M18.6 4.4h-3L6.4 13.6l3 3z"/><path d="M4.6 19.4l2.6-2.6M19.4 19.4l-2.6-2.6"/>'),
  '✕':_MI('<path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"/>'),
  '🗑':_MI('<path d="M4.6 6.8h14.8"/><path d="M9.4 6.8V4.6h5.2v2.2"/><path d="M6.6 6.8l.9 12.2a1.6 1.6 0 0 0 1.6 1.4h5.8a1.6 1.6 0 0 0 1.6-1.4l.9-12.2"/><path d="M10.4 10.4v6.4M13.6 10.4v6.4"/>'),
  '❤':_MI('<path d="M12 19.8S4.4 15.2 4.4 9.9A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7.6 2.3c0 5.3-7.6 9.9-7.6 9.9z"/>','ok')
};
// 커맨드 그리드·라벨용 초상: 표에 있으면 아이콘, 없으면 원래 문자 그대로
function pIco(e,cls){ const h=MSG_ICO[e]||MSG_ICO[e+'️']; return h? '<span class="pIco'+(cls?' '+cls:'')+'">'+h.d+'</span>' : '<span class="pemoji">'+e+'</span>'; }
const COL={track:'#4aa8ff',enemy:'#ff4455',boss:'#ffc040',accent:'#ff3b3b'};

// 유닛(공격유닛): 가격M / 기본공격 / 업글당공격 / 영웅기본 / 영웅업글당. 사거리·쿨다운=게임용 보정.
// 건물별 생산 유닛 배치 — 설계서 §3-2 건물 구조에 엑셀 유닛을 매핑.
// size = 유닛 반경(px). 스타처럼 유닛마다 다름(마린 작고 골리앗/아칸 큼). 영웅은 ×1.25.
// wpn = 무기/종족 계열(업그레이드 묶음). atk = 공격 이펙트 타입(유닛마다 고유).
//  atk: 'rifle'(저격빔) 'bullet'(연사탄) 'spike'(가시) 'plasma'(플라즈마구체) 'missile'(쌍연미사일) 'psi'(사이오닉폭발)
// ── 확정 스탯 스키마(스타크래프트식) ──
//  전투/공격: dmg·up·hdmg·hup(공격력/업글), range(사거리), cd(공격쿨=프레임), splash
//  생존: hp(체력) armor(방어력) shield(보호막,0=없음) energy(에너지,0=비시전) moveSpd(이동속도,비율/초)
//  ※ hp/armor/shield/energy/moveSpd 는 추후 전투형 유즈맵용 기본값(엑셀 아님, 조정 가능).
// ===== [공유 베이스] 유닛 기본 정의 (외형·공격방식·기본 체력/공격력/사거리) — 모든 유즈맵 공유. 기본 스탯은 여기서 재설정 =====
const U = {
  ghost:   {name:'저격수', icon:'👻', cost:3,  dmg:21, up:15, hdmg:42, hup:50, range:.28, cd:46, splash:false, color:'#c0c0d8', size:15, wpn:'inf',  atk:'rifle',   hp:45,  armor:0, shield:0,   energy:200, moveSpd:.19, model3d:'ghost'},
  dragoon: {name:'센티넬', icon:'🤖', cost:5,  dmg:20, up:15, hdmg:44, hup:37, range:.26, cd:30, splash:false, color:'#b48bff', size:18, wpn:'pro',  atk:'plasma',  hp:100, armor:1, shield:80,  shArmor:1, energy:0,   moveSpd:.13, model3d:'dragoon'},
  hydra:   {name:'스파이크', icon:'🦎', cost:6,  dmg:18, up:6,  hdmg:36, hup:30, range:.24, cd:26, splash:false, color:'#9fd356', size:17, wpn:'zrg',  atk:'spike',   hp:80,  armor:0, shield:0,   energy:0,   moveSpd:.17, model3d:'hydra'},
  marine:  {name:'레인저',   icon:'🪖', cost:7,  dmg:17, up:9,  hdmg:34, hup:22, range:.22, cd:22, splash:false, color:'#4aa8ff', size:14, wpn:'inf',  atk:'bullet',  hp:40,  armor:0, shield:0,   energy:0,   moveSpd:.19, model3d:'marine'},
  goliath: {name:'기갑병', icon:'⚙️', cost:9,  dmg:30, up:30, hdmg:80, hup:80, range:.26, cd:30, splash:false, color:'#5ad1ff', size:21, wpn:'mech', atk:'missile', hp:125, armor:1, shield:0,   energy:0,   moveSpd:.08, airDmg:25, airUp:25, hairDmg:70, hairUp:70, model3d:'goliath'},
  archon:  {name:'보이드',   icon:'🔮', cost:10, dmg:30, up:20, hdmg:45, hup:55, range:.16, cd:28, splash:true,  color:'#ffc040', size:23, wpn:'pro',  atk:'psi',     hp:10,  armor:0, shield:350, shArmor:1, energy:0,   moveSpd:.10, model3d:'archon'},
  // 방어 구조물(디텍터) — 엑셀: 터렛 공격75 / 포토캐논 공격321. moveSpd:0(고정)
  turret:  {name:'미사일 포탑',     icon:'🗼', cost:200, dmg:192,  up:20, hdmg:384, hup:40, range:.26, cd:34, splash:false, color:'#9fd6ff', size:11, wpn:'mech', atk:'missile', hp:200, armor:2, shield:0,   energy:0, moveSpd:0, detector:true, airDmg:192, airUp:20, hairDmg:384, hairUp:40, model3d:'turret'},
  photon:  {name:'에너지 타워', icon:'🔵', cost:400, dmg:346, up:40, hdmg:540, hup:80, range:.24, cd:40, splash:false, color:'#62d0ff', size:12, wpn:'pro',  atk:'plasma',  hp:100, armor:0, shield:100, shArmor:1, energy:0, moveSpd:0, detector:true, model3d:'photon'},
  // ───── 관리자 샌드박스 전용 유닛 스탯(보직별) — 추가형, 네모 게임플레이 무영향 ─────
  racer: {name:'레이서', icon:'🔧', cost:0, dmg:21, up:8, hdmg:42, hup:17, range:0.15, cd:24, splash:false, color:'#4aa8ff', size:18, wpn:'mech', atk:'bullet', hp:76, armor:1, shield:0, energy:0, moveSpd:0.19, model3d:'racer'},   // 샌드박스 전용 · 종족밸런스 ×0.80
  machinegun: {name:'화력병', icon:'🔥', cost:55, dmg:12, up:5, hdmg:0, hup:0, range:0.09, cd:16, splash:true, color:'#ff7a3c', size:18, wpn:'mech', atk:'bullet', hp:55, armor:1, shield:0, energy:0, moveSpd:0.16, model3d:'machinegun'},   // 파이어뱃(배럭스 바이오닉·근접 화염 스플래시)
  tank: {name:'공성전차', icon:'🔧', cost:0, dmg:58, up:23, hdmg:115, hup:46, range:0.34, cd:52, splash:true, color:'#4aa8ff', size:22, wpn:'mech', atk:'shell', hp:144, armor:2, shield:0, energy:0, moveSpd:0.07, model3d:'tank'},   // 샌드박스 전용 · 종족밸런스 ×0.80
  blade: {name:'광전사', icon:'🔮', cost:110, dmg:33, up:13, hdmg:64, hup:25, range:0.05, melee:true, cd:24, splash:false, color:'#ffc040', size:18, wpn:'pro', atk:'slash', hp:156, armor:1, shield:48, shArmor:1, energy:0, moveSpd:0.18, model3d:'blade'},   // 첫 전투유닛(질럿) · 최강 개체 · 종족밸런스 ×1.20
  matron: {name:'여제', icon:'🐛', cost:0, dmg:52, up:21, hdmg:104, hup:42, range:0.05, melee:true, cd:26, splash:true, color:'#a8472e', size:23, wpn:'zrg', atk:'psi', hp:420, armor:3, shield:0, energy:0, moveSpd:0.15, airDmg:40, airUp:16, hairDmg:80, hairUp:32, model3d:'matron'},   // 샌드박스 전용(보직 스탯)
  thornqueen: {name:'가시여왕', icon:'🐛', cost:0, dmg:24, up:10, hdmg:48, hup:19, range:0.24, cd:30, splash:true, color:'#a8472e', size:20, wpn:'zrg', atk:'spike', hp:130, armor:1, shield:0, energy:0, moveSpd:0.13, model3d:'thornqueen'},   // 샌드박스 전용(보직 스탯)
  snapper: {name:'척후병', icon:'🐛', cost:40, dmg:12, up:6, hdmg:25, hup:10, range:0.042, melee:true, cd:18, splash:false, color:'#a8472e', size:17, wpn:'zrg', atk:'spike', hp:56, armor:0, shield:0, energy:0, moveSpd:0.19, model3d:'snapper'},   // 첫 전투유닛(저글링급) · 종족밸런스 ×1.17
  skyguard: {name:'전투기', icon:'🔧', cost:0, dmg:54, up:22, hdmg:108, hup:43, range:0.27, cd:24, splash:false, color:'#4aa8ff', size:20, wpn:'mech', atk:'missile', hp:260, armor:2, shield:0, energy:0, moveSpd:0.24, airDmg:54, airUp:22, hairDmg:108, hairUp:43, model3d:'skyguard'},   // 샌드박스 전용(보직 스탯)
  skydancer: {name:'요격기', icon:'🔮', cost:0, dmg:26, up:10, hdmg:52, hup:21, range:0.25, cd:16, splash:false, color:'#ffc040', size:18, wpn:'pro', atk:'plasma', hp:210, armor:2, shield:100, shArmor:1, energy:0, moveSpd:0.25, airDmg:26, airUp:10, hairDmg:52, hairUp:21, model3d:'skydancer'},   // 샌드박스 전용(보직 스탯)
  hellfire: {name:'폭격기', icon:'🔧', cost:0, dmg:42, up:17, hdmg:84, hup:34, range:0.24, cd:30, splash:true, color:'#4aa8ff', size:18, wpn:'mech', atk:'missile', hp:150, armor:1, shield:0, energy:0, moveSpd:0.22, model3d:'hellfire'},   // 샌드박스 전용(보직 스탯)
  pelican: {name:'수송선', icon:'🔧', cost:0, dmg:0, up:0, hdmg:0, hup:0, range:0, cd:40, splash:false, color:'#4aa8ff', size:20, wpn:'mech', atk:'bullet', hp:220, armor:2, shield:0, energy:0, moveSpd:0.26, model3d:'pelican'},   // 샌드박스 전용(보직 스탯)
  dreadnought: {name:'전함', icon:'🔧', cost:0, dmg:52, up:21, hdmg:104, hup:42, range:0.3, cd:42, splash:false, color:'#4aa8ff', size:24, wpn:'mech', atk:'shell', hp:520, armor:3, shield:0, energy:0, moveSpd:0.14, airDmg:44, airUp:18, hairDmg:88, hairUp:35, model3d:'dreadnought'},   // 샌드박스 전용(보직 스탯)
  kronos: {name:'전함', icon:'🔮', cost:0, dmg:36, up:14, hdmg:72, hup:29, range:0.31, cd:40, splash:true, color:'#ffc040', size:22, wpn:'pro', atk:'plasma', hp:440, armor:2, shield:170, shArmor:1, energy:200, moveSpd:0.15, airDmg:30, airUp:12, hairDmg:60, hairUp:24, model3d:'kronos'},   // 샌드박스 전용(보직 스탯) · 에너지=아비터(스테이시스·리콜)
  seraph: {name:'수송선', icon:'🔮', cost:0, dmg:0, up:0, hdmg:0, hup:0, range:0, cd:40, splash:false, color:'#ffc040', size:18, wpn:'pro', atk:'bullet', hp:120, armor:1, shield:40, shArmor:1, energy:0, moveSpd:0.24, model3d:'seraph'},   // 샌드박스 전용(보직 스탯)
  archangel: {name:'모함', icon:'🔮', cost:0, dmg:22, up:9, hdmg:44, hup:18, range:0.3, cd:16, splash:true, color:'#ffc040', size:24, wpn:'pro', atk:'plasma', hp:560, armor:3, shield:200, shArmor:1, energy:0, moveSpd:0.12, airDmg:22, airUp:9, hairDmg:44, hairUp:18, model3d:'archangel'},   // 샌드박스 전용(보직 스탯)
  falcon: {name:'팔콘', icon:'🔮', cost:0, dmg:24, up:10, hdmg:48, hup:19, range:0.24, cd:18, splash:false, color:'#ffc040', size:17, wpn:'pro', atk:'plasma', hp:130, armor:1, shield:50, shArmor:1, energy:200, moveSpd:0.26, airDmg:24, airUp:10, hairDmg:48, hairUp:19, model3d:'falcon'},   // 샌드박스 전용(보직 스탯) · 에너지=커세어(디스럽션 웹)
  observer: {name:'정찰기', icon:'🔮', cost:0, dmg:0, up:0, hdmg:0, hup:0, range:0.18, cd:34, splash:false, color:'#ffc040', size:14, wpn:'pro', atk:'bullet', hp:35, armor:0, shield:0, energy:0, moveSpd:0.26, detector:true, model3d:'observer'},   // 샌드박스 전용(보직 스탯)
  overlord: {name:'수송충', icon:'🐛', cost:0, dmg:0, up:0, hdmg:0, hup:0, range:0.16, cd:40, splash:false, color:'#a8472e', size:20, wpn:'zrg', atk:'bullet', hp:110, armor:1, shield:0, energy:0, moveSpd:0.1, detector:true, model3d:'overlord'},   // 샌드박스 전용(보직 스탯)
  stinger: {name:'자폭충', icon:'🐛', cost:0, dmg:70, up:28, hdmg:140, hup:56, range:0.13, cd:50, splash:true, color:'#a8472e', size:14, wpn:'zrg', atk:'missile', hp:15, armor:0, shield:0, energy:0, moveSpd:0.3, airDmg:70, airUp:28, hairDmg:140, hairUp:56, model3d:'stinger'},   // 샌드박스 전용(보직 스탯)
  venom: {name:'산성충', icon:'🐛', cost:0, dmg:20, up:8, hdmg:40, hup:16, range:0.24, cd:24, splash:false, color:'#a8472e', size:18, wpn:'zrg', atk:'spike', hp:140, armor:1, shield:0, energy:0, moveSpd:0.18, airDmg:46, airUp:18, hairDmg:92, hairUp:37, model3d:'venom'},   // 샌드박스 전용(보직 스탯)
  medusa: {name:'군단여왕', icon:'🐛', cost:0, dmg:40, up:16, hdmg:80, hup:32, range:0.26, cd:26, splash:true, color:'#a8472e', size:20, wpn:'zrg', atk:'psi', hp:300, armor:2, shield:0, energy:200, moveSpd:0.16, airDmg:40, airUp:16, hairDmg:80, hairUp:32, model3d:'medusa'},   // 샌드박스 전용(보직 스탯) · 에너지=군단여왕(패러사이트·인스네어·브루들링)
  defiler: {name:'오염술사', icon:'🦠', cost:0, dmg:0, up:0, hdmg:0, hup:0, range:0, cd:40, splash:false, color:'#8fb04a', size:18, wpn:'zrg', atk:'psi', hp:80, armor:1, shield:0, energy:200, moveSpd:0.14, model3d:'defiler'},   // 디파일러(다크스웜·플레이그·컨슘) — 무공격 마법 · 임시 2D(defiler SVG)
  aegis: {name:'지원 정찰기', icon:'🛰️', cost:160, dmg:0, up:0, hdmg:0, hup:0, range:0, cd:40, splash:false, color:'#7fd6ff', size:20, wpn:'mech', atk:'bullet', hp:200, armor:1, shield:0, energy:200, moveSpd:0.13, detector:true, model3d:'aegis'},   // 과학함(디텍터·서포트: 디펜시브매트릭스/이레디에이트/EMP)
  wyvern: {name:'비행충', icon:'🐛', cost:0, dmg:120, up:48, hdmg:240, hup:96, range:0.28, cd:20, splash:false, color:'#a8472e', size:22, wpn:'zrg', atk:'spike', hp:2200, armor:5, shield:0, energy:0, moveSpd:0.25, airDmg:120, airUp:48, hairDmg:240, hairUp:96, model3d:'wyvern'},   // 샌드박스 전용(보직 스탯)
  behemoth: {name:'포격충', icon:'🐛', cost:0, dmg:190, up:76, hdmg:380, hup:152, range:0.46, cd:50, splash:true, color:'#a8472e', size:26, wpn:'zrg', atk:'shell', hp:3200, armor:6, shield:0, energy:0, moveSpd:0.1, airDmg:110, airUp:44, hairDmg:220, hairUp:88, model3d:'behemoth'},   // 샌드박스 전용(보직 스탯)
  worker_human: {name:'정비공', icon:'🔧', cost:50, dmg:4, up:2, hdmg:8, hup:3, range:0.035, cd:40, splash:false, melee:true, color:'#4aa8ff', size:13, wpn:'mech', atk:'slash', hp:30, armor:0, shield:0, energy:0, moveSpd:0.14, model3d:'worker_human'},   // 샌드박스 전용(보직 스탯)
  worker_light: {name:'생산자', icon:'🔮', cost:50, dmg:4, up:2, hdmg:8, hup:3, range:0.035, cd:40, splash:false, melee:true, color:'#ffc040', size:12, wpn:'pro', atk:'slash', hp:30, armor:0, shield:0, energy:0, moveSpd:0.15, model3d:'worker_light'},   // 일꾼 1:1:1(hp30/dmg4/cd40)
  worker_swarm: {name:'생산자', icon:'🐛', cost:50, dmg:4, up:2, hdmg:8, hup:3, range:0.035, cd:40, splash:false, melee:true, color:'#a8472e', size:13, wpn:'zrg', atk:'slash', hp:30, armor:0, shield:0, energy:0, moveSpd:0.14, model3d:'worker_swarm'},   // 일꾼 1:1:1(hp30/dmg4/cd40)
  medic: {name:'의무병', icon:'🔧', cost:0, dmg:0, up:0, hdmg:0, hup:0, range:0, cd:40, splash:false, color:'#4aa8ff', size:13, wpn:'inf', atk:'bullet', hp:60, armor:1, shield:0, energy:200, moveSpd:0.19, model3d:'medic'},   // 샌드박스 전용(보직 스탯) — 치유 지원(무공격)
  broodling: {name:'스웜링', icon:'🐛', cost:0, dmg:6, up:2, hdmg:12, hup:4, range:0.035, cd:22, splash:false, melee:true, color:'#a8472e', size:10, wpn:'zrg', atk:'slash', hp:30, armor:0, shield:0, energy:0, moveSpd:0.25, model3d:'broodling'},   // 샌드박스 전용(보직 스탯)
  larva: {name:'공성체', icon:'🛸', cost:0, dmg:40, up:16, hdmg:80, hup:32, range:0.28, cd:70, splash:true, color:'#ffc040', size:18, wpn:'pro', atk:'psi', hp:100, armor:0, shield:80, energy:0, moveSpd:0.09, model3d:'larva'},   // 리버(에테리얼 공성, 스캐럽 스플래시). 관리자 전투=base_stats 오버라이드. 모델 larva.glb
  ultralisk: {name:'돌격괴수', icon:'🐛', cost:0, dmg:65, up:26, hdmg:130, hup:52, range:0.045, cd:35, splash:false, melee:true, color:'#a8472e', size:26, wpn:'zrg', atk:'slash', hp:800, armor:4, shield:0, energy:0, moveSpd:0.2, model3d:'ultralisk'},   // 샌드박스 전용(보직 스탯)
  dark_templar: {name:'다크세이지', icon:'🔮', cost:0, dmg:80, up:32, hdmg:160, hup:64, range:0.04, cd:42, splash:false, melee:true, color:'#ffc040', size:14, wpn:'pro', atk:'slash', hp:80, armor:1, shield:80, shArmor:1, energy:0, moveSpd:0.19, model3d:'dark_templar'},   // 샌드박스 전용(보직 스탯)
  high_templar: {name:'하이세이지', icon:'🔮', cost:0, dmg:0, up:0, hdmg:0, hup:0, range:0, cd:40, splash:false, color:'#ffc040', size:12, wpn:'pro', atk:'psi', hp:40, armor:0, shield:40, shArmor:1, energy:200, moveSpd:0.12, model3d:'high_templar'},   // 샌드박스 전용(보직 스탯) — 시전형(무공격)
  dark_archon: {name:'다크보이드', icon:'🌑', cost:0, dmg:0, up:0, hdmg:0, hup:0, range:0, cd:40, splash:false, color:'#b47aff', size:22, wpn:'pro', atk:'psi', hp:25, armor:0, shield:200, shArmor:1, energy:200, moveSpd:0.10, model3d:'dark_archon'},   // 다크아칸(마인드컨트롤·메일스트롬·피드백) — 무공격 마법 · 임시 2D(dark_archon SVG, 아칸 3D 재사용 안 함)
  // ═══════════════════════════════════════════════════════════════════════════
  // 🐺 페럴(수인) · 🗿 콜로서스(거신) — RACES.md 설계를 코드로 확정 (2026-08-20)
  //   ⚠ 지금은 **관리자 페이지 전용**이다 — 샌드박스 진열 + 건설(TECH_TREE)까지만.
  //      오토배틀(STK_*)에는 **아직 넣지 않았다**. 관리자에서 유닛·건물을 확정한 뒤에 옮긴다.
  //   수치는 RACES.md §5 「유닛 실수치」 그대로다. 바꾸려면 거기부터 고칠 것(문서가 단일 소스).
  //   ⛔ model3d 를 임의로 붙이지 말 것 — 에셋이 없어 2D 폴백으로 그린다(있는 척하면 빈 모델이 뜬다).
  // ── 🐺 페럴: 단거리 고기동 교전자. 사거리 대역 0.14~0.22(전 종족 최단) ──
  worker_feral:  {name:'채집수',   icon:'🪲', cost:0, dmg:4,   up:2,  hdmg:8,   hup:4,  range:0.035, cd:40, splash:false, melee:true, color:'#c98b5a', size:12, wpn:'fer', atk:'slash', hp:30,   armor:0, shield:0, energy:0,   moveSpd:0.16},
  wolfrunner:    {name:'추격수', icon:'🐕', cost:0, dmg:14,  up:6,  hdmg:28,  hup:12, range:0.045, cd:18, splash:false, melee:true, color:'#c98b5a', size:15, wpn:'fer', atk:'slash', hp:60,   armor:0, shield:0, energy:0,   moveSpd:0.24},
  thornspitter:  {name:'가시 사수', icon:'🦔', cost:0, dmg:16,  up:6,  hdmg:32,  hup:12, range:0.20,  cd:24, splash:false, color:'#c98b5a', size:15, wpn:'fer', atk:'spike', hp:55,   armor:0, shield:0, energy:0,   moveSpd:0.18},
  clawfighter:   {name:'포식수', icon:'🦡', cost:0, dmg:20, up:8, hdmg:40,  hup:16, range:0.045, cd:20, splash:false, melee:true, color:'#c98b5a', size:16, wpn:'fer', atk:'slash', hp:90,   armor:0, shield:0, energy:0,   moveSpd:0.23},
  hornedcharger: {name:'돌진수', icon:'🐗', cost:0, dmg:26,  up:10, hdmg:52,  hup:20, range:0.05,  cd:28, splash:false, melee:true, color:'#c98b5a', size:19, wpn:'fer', atk:'slash', hp:130,  armor:1, shield:0, energy:0,   moveSpd:0.22},
  howlslinger:   {name:'대공 투석수', icon:'🐒', cost:0, dmg:0,  up:0,  hdmg:0,   hup:0,  range:0.22,  cd:26, splash:false, color:'#c98b5a', size:16, wpn:'fer', atk:'spike', hp:70,   armor:0, shield:0, energy:0,   moveSpd:0.18, airDmg:30, airUp:12, hairDmg:60, hairUp:24},
  venomfang:     {name:'맹독수',   icon:'🐍', cost:0, dmg:18,  up:7,  hdmg:36,  hup:14, range:0.18,  cd:22, splash:false, color:'#c98b5a', size:17, wpn:'fer', atk:'spike', hp:110,  armor:1, shield:0, energy:0,   moveSpd:0.20, airDmg:18, airUp:7,  hairDmg:36, hairUp:14},
  stalkercat:    {name:'암살수', icon:'🦗', cost:0, dmg:28,  up:11, hdmg:56,  hup:22, range:0.05,  cd:18, splash:false, melee:true, color:'#c98b5a', size:16, wpn:'fer', atk:'slash', hp:120,  armor:0, shield:0, energy:0,   moveSpd:0.28},
  packshaman:    {name:'주술사',   icon:'🔮', cost:0, dmg:0,   up:0,  hdmg:0,   hup:0,  range:0,     cd:40, splash:false, color:'#c98b5a', size:14, wpn:'fer', atk:'psi',   hp:80,   armor:1, shield:0, energy:200, moveSpd:0.19},
  alphawolf:     {name:'우두머리', icon:'🐺', cost:0, dmg:34,  up:14, hdmg:68,  hup:28, range:0.05,  cd:20, splash:false, melee:true, color:'#c98b5a', size:20, wpn:'fer', atk:'slash', hp:220,  armor:2, shield:0, energy:0,   moveSpd:0.24},
  hawkeye:       {name:'정찰조', icon:'🦉', cost:0, dmg:0,   up:0,  hdmg:0,   hup:0,  range:0,     cd:40, splash:false, color:'#c98b5a', size:14, wpn:'fer', atk:'psi',   hp:90,   armor:0, shield:0, energy:200, moveSpd:0.28, detector:true},
  windcarrier:   {name:'수송조', icon:'🪶', cost:0, dmg:0, up:0,  hdmg:0,   hup:0,  range:0,     cd:40, splash:false, color:'#c98b5a', size:20, wpn:'fer', atk:'spike', hp:180,  armor:1, shield:0, energy:0,   moveSpd:0.25},
  wyvernrider:   {name:'폭격 기수', icon:'🦅', cost:0, dmg:44, up:18, hdmg:88, hup:36, range:0.16, cd:22, splash:false, color:'#c98b5a', size:20, wpn:'fer', atk:'spike', hp:300,  armor:2, shield:0, energy:0,   moveSpd:0.26},
  skytalon:      {name:'하늘 사냥수', icon:'🦇', cost:0, dmg:0,  up:0,  hdmg:0,   hup:0,  range:0.20,  cd:16, splash:false, color:'#c98b5a', size:18, wpn:'fer', atk:'spike', hp:240,  armor:1, shield:0, energy:0,   moveSpd:0.30, airDmg:38, airUp:15, hairDmg:76, hairUp:30},
  stormroc:      {name:'뇌격수', icon:'🌩', cost:0, dmg:58,  up:23, hdmg:116, hup:46, range:0.22,  cd:26, splash:true,  color:'#c98b5a', size:24, wpn:'fer', atk:'psi',   hp:620,  armor:3, shield:0, energy:200, moveSpd:0.22, airDmg:58, airUp:23, hairDmg:116, hairUp:46},
  primalbeast:   {name:'원시 군주', icon:'🐯', cost:0, dmg:110, up:44, hdmg:220, hup:88, range:0.14,  cd:24, splash:false, color:'#c98b5a', size:26, wpn:'fer', atk:'slash', hp:1900, armor:5, shield:0, energy:0,   moveSpd:0.24, airDmg:110, airUp:44, hairDmg:220, hairUp:88},
  // ── 🗿 콜로서스: 초장사정 + 전개. 사거리 대역 0.24~0.44(전 종족 최장) ──
  //   deploy(전개 초) · minRange(최소 사거리)는 **아직 로직이 없다** — 필드만 확정해 둔다(RACES.md §5 「신규 필드」).
  worker_col:    {name:'조립 드론', icon:'🔩', cost:0, dmg:4,   up:2,  hdmg:8,   hup:4,  range:0.035, cd:40, splash:false, melee:true, color:'#9aa6b2', size:12, wpn:'col', atk:'slash',  hp:35,   armor:0, shield:0,  energy:0,   moveSpd:0.15},
  gunner:        {name:'포대병',   icon:'💣', cost:0, dmg:22,  up:9,  hdmg:44,  hup:18, range:0.26,  cd:30, splash:false, color:'#9aa6b2', size:16, wpn:'col', atk:'shell',  hp:75,   armor:1, shield:0,  energy:0,   moveSpd:0.14, deploy:1.2, minRange:0.07},
  guardwalker:   {name:'가드 워커', icon:'🛡', cost:0, dmg:20,  up:8,  hdmg:40,  hup:16, range:0.06,  cd:22, splash:false, melee:true, color:'#9aa6b2', size:18, wpn:'col', atk:'bullet', hp:140,  armor:2, shield:0,  energy:0,   moveSpd:0.20, airDmg:20, airUp:8, hairDmg:40, hairUp:16},
  twincannon:    {name:'트윈 캐논', icon:'🔫', cost:0, dmg:34,  up:14, hdmg:68,  hup:28, range:0.30,  cd:34, splash:false, color:'#9aa6b2', size:20, wpn:'col', atk:'shell',  hp:150,  armor:2, shield:0,  energy:0,   moveSpd:0.12, deploy:1.4, minRange:0.10},
  flakbattery:   {name:'플랙 배터리', icon:'🎆', cost:0, dmg:0,  up:0,  hdmg:0,   hup:0,  range:0.28,  cd:20, splash:false, color:'#9aa6b2', size:18, wpn:'col', atk:'missile', hp:120, armor:1, shield:0,  energy:0,   moveSpd:0.13, airDmg:36, airUp:14, hairDmg:72, hairUp:28},
  spotterdrone:  {name:'관측 드론', icon:'📡', cost:0, dmg:0,   up:0,  hdmg:0,   hup:0,  range:0,     cd:40, splash:false, color:'#9aa6b2', size:14, wpn:'col', atk:'bullet', hp:90,   armor:0, shield:0,  energy:0,   moveSpd:0.24, detector:true},
  railgun:       {name:'레일건 플랫폼', icon:'⚡', cost:0, dmg:46, up:18, hdmg:92, hup:36, range:0.36, cd:40, splash:false, color:'#9aa6b2', size:21, wpn:'col', atk:'rifle',  hp:180,  armor:2, shield:0,  energy:0,   moveSpd:0.10, airDmg:46, airUp:18, hairDmg:92, hairUp:36, deploy:1.6, minRange:0.12},
  stasistech:    {name:'정지장 기술자', icon:'🧊', cost:0, dmg:0, up:0,  hdmg:0,   hup:0,  range:0,     cd:40, splash:false, color:'#9aa6b2', size:14, wpn:'col', atk:'plasma', hp:100,  armor:1, shield:60, shArmor:1, energy:200, moveSpd:0.16},
  arclight:      {name:'아크 라이트', icon:'✴️', cost:0, dmg:0,  up:0,  hdmg:0,   hup:0,  range:0.24,  cd:16, splash:false, color:'#9aa6b2', size:18, wpn:'col', atk:'plasma', hp:200,  armor:2, shield:0,  energy:0,   moveSpd:0.26, airDmg:30, airUp:12, hairDmg:60, hairUp:24},
  supplylifter:  {name:'보급 비행정', icon:'🚁', cost:0, dmg:0,  up:0,  hdmg:0,   hup:0,  range:0,     cd:40, splash:false, color:'#9aa6b2', size:20, wpn:'col', atk:'bullet', hp:240,  armor:2, shield:0,  energy:0,   moveSpd:0.24},
  siegecolossus: {name:'시즈 콜로서스', icon:'🗿', cost:0, dmg:88, up:35, hdmg:176, hup:70, range:0.44, cd:52, splash:true, color:'#9aa6b2', size:24, wpn:'col', atk:'shell',  hp:420,  armor:4, shield:0,  energy:0,   moveSpd:0.11, deploy:1.6, minRange:0.12},
  skylance:      {name:'스카이 랜스', icon:'🛰', cost:0, dmg:50,  up:20, hdmg:100, hup:40, range:0.30,  cd:28, splash:false, color:'#9aa6b2', size:22, wpn:'col', atk:'plasma', hp:380,  armor:3, shield:0,  energy:200, moveSpd:0.18, airDmg:50, airUp:20, hairDmg:100, hairUp:40},
  orbitalanchor: {name:'궤도 앵커', icon:'⚓', cost:0, dmg:120, up:48, hdmg:240, hup:96, range:0.40,  cd:60, splash:true,  color:'#9aa6b2', size:24, wpn:'col', atk:'shell',  hp:700,  armor:5, shield:0,  energy:200, moveSpd:0.05, airDmg:120, airUp:48, hairDmg:240, hairUp:96},
  worldbreaker:  {name:'월드 브레이커', icon:'🌋', cost:0, dmg:175, up:70, hdmg:350, hup:140, range:0.40, cd:50, splash:true, color:'#9aa6b2', size:26, wpn:'col', atk:'shell', hp:2600, armor:6, shield:0,  energy:0,   moveSpd:0.12, airDmg:175, airUp:70, hairDmg:350, hairUp:140},
};
// ── 사거리 일괄 조정(모든 유즈맵 공통 단일 소스) ──────────────────────────────
// 전 유닛 +15%, 그리고 유닛 크기 대비 최소 사거리 보장(근접·초단거리 유닛이 겹침 방지 간격에 막혀 못 때리던 문제).
// U를 직접 보정하므로 네모·관리자·오토배틀이 모두 같은 값을 쓴다.
const RANGE_MUL=1.15, RANGE_MIN_K=0.0045;   // 최소 사거리 = size × RANGE_MIN_K
try{ for(const _k in U){ const _d=U[_k]; if(!_d||_d.range==null||_d.range<=0) continue;
  let _r=_d.range*RANGE_MUL;
  if(!_d.melee){ const _mn=(_d.size||14)*RANGE_MIN_K; if(_r<_mn) _r=_mn; }   // 근접 유닛은 최소 사거리 제외 — 붙어서 때리는 느낌 유지(교전은 유효 사거리 보정으로 해결)
  _d.range=Math.round(_r*10000)/10000; } }catch(_e){}
const HERO_STAT_MUL=2; // 영웅은 체력/보호막 2배(기본값, 조정 가능)
// 유닛 인스턴스에 생존 스탯 초기화(현재=최대). 추후 전투형 맵에서 u.hp 등을 깎으면 됨.
function initUnitStats(u){ const d=(typeof Udef==='function'?Udef(u.id):U[u.id]); const m=(u.hero?HERO_STAT_MUL:1)*gachaTierMul(u);   // 등급 배율 반영
  u.maxHp=Math.round(d.hp*m); u.hp=u.maxHp;
  u.maxSh=Math.round(((u.gid==='matron_t'?0:d.shield)||0)*m); u.sh=u.maxSh;   // 매트론=실드 없음
  u.maxEn=d.energy||0; u.en=u.maxEn;
  return u; }
function unitRadius(u){ return U[u.id].size; } // 그림 반경(영웅도 같은 크기)

// ── 유닛 벡터 아이콘(SVG) — 자체 제작 네온 실루엣. 24x24 viewBox, currentColor 사용 ──
const UNIT_SVG = {
  // (벡터 초상 없던 유닛 보강 — 3D 이미지가 없을 때 빈 칸으로 나오던 것들)
  medic:'<path d="M12 3.6a4 4 0 0 1 4 4v1.2h1.6a2 2 0 0 1 2 2v6.6a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2v-6.6a2 2 0 0 1 2-2H8V7.6a4 4 0 0 1 4-4z" fill="currentColor" opacity=".22"/><path d="M12 3.6a4 4 0 0 1 4 4v1.2h1.6a2 2 0 0 1 2 2v6.6a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2v-6.6a2 2 0 0 1 2-2H8V7.6a4 4 0 0 1 4-4z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M12 11.2v5.2M9.4 13.8h5.2" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  broodling:'<path d="M9 8.4a3 3 0 0 1 6 0v5.4a3 3 0 0 1-6 0z" fill="currentColor" opacity=".22"/><path d="M9 8.4a3 3 0 0 1 6 0v5.4a3 3 0 0 1-6 0z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M9 10.2H5.6M9 13H5.6M15 10.2h3.4M15 13h3.4M10.4 5.8 9.2 3.6M13.6 5.8l1.2-2.2M10.6 16.6l-1.4 3M13.4 16.6l1.4 3" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  larva:'<path d="M5.2 14.6c0-3.4 3-6.2 6.8-6.2s6.8 2.8 6.8 6.2-3 4.6-6.8 4.6-6.8-1.2-6.8-4.6z" fill="currentColor" opacity=".22"/><path d="M5.2 14.6c0-3.4 3-6.2 6.8-6.2s6.8 2.8 6.8 6.2-3 4.6-6.8 4.6-6.8-1.2-6.8-4.6z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8.6 12.2h6.8M8 15.4h8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M9.6 8.6 8.6 5.4M14.4 8.6l1-3.2" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  ultralisk:'<path d="M4.8 15.4c0-3.6 3.2-6.4 7.2-6.4s7.2 2.8 7.2 6.4-3.2 4.4-7.2 4.4-7.2-.8-7.2-4.4z" fill="currentColor" opacity=".22"/><path d="M4.8 15.4c0-3.6 3.2-6.4 7.2-6.4s7.2 2.8 7.2 6.4-3.2 4.4-7.2 4.4-7.2-.8-7.2-4.4z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6.8 9.6 3.6 4.8M17.2 9.6l3.2-4.8M9.8 8.8 8.6 4.2M14.2 8.8l1.2-4.6" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  dark_templar:'<path d="M12 3.4 15.2 9l-3.2 11.2L8.8 9z" fill="currentColor" opacity=".22"/><path d="M12 3.4 15.2 9l-3.2 11.2L8.8 9z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6.2 9.8 12 7.6l5.8 2.2" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  high_templar:'<path d="M12 3.6c2.8 0 4.8 2 4.8 4.8 0 2-1 3-1.6 4.2-.5 1-.6 2-.6 3.2H9.4c0-1.2-.1-2.2-.6-3.2-.6-1.2-1.6-2.2-1.6-4.2 0-2.8 2-4.8 4.8-4.8z" fill="currentColor" opacity=".22"/><path d="M12 3.6c2.8 0 4.8 2 4.8 4.8 0 2-1 3-1.6 4.2-.5 1-.6 2-.6 3.2H9.4c0-1.2-.1-2.2-.6-3.2-.6-1.2-1.6-2.2-1.6-4.2 0-2.8 2-4.8 4.8-4.8z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M9.6 18h4.8M10.2 20.4h3.6" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  // 고스트: 후드 형상 + 눈
  ghost:'<path d="M12 3c-3.3 0-5.5 2.6-5.5 6v8.5l2-1.6 1.7 1.6 1.8-1.6 1.8 1.6 1.7-1.6 2 1.6V9c0-3.4-2.2-6-5.5-6z" fill="currentColor" opacity=".22"/><path d="M12 3c-3.3 0-5.5 2.6-5.5 6v8.5l2-1.6 1.7 1.6 1.8-1.6 1.8 1.6 1.7-1.6 2 1.6V9c0-3.4-2.2-6-5.5-6z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="9.7" cy="9.5" r="1.1" fill="currentColor"/><circle cx="14.3" cy="9.5" r="1.1" fill="currentColor"/>',
  // 드라군: 4각 보행기계
  dragoon:'<path d="M12 4l5 4v5l-5 3-5-3V8z" fill="currentColor" opacity=".2"/><path d="M12 4l5 4v5l-5 3-5-3V8z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="10" r="2" fill="currentColor"/><path d="M7 13l-3 5M17 13l3 5M9 15l-2 5M15 15l2 5" stroke="currentColor" stroke-width="1.1" fill="none"/>',
  // 히드라: 가시 달린 유기체
  hydra:'<path d="M12 4c-3 0-5 2.4-5 6 0 4 2.5 8 5 10 2.5-2 5-6 5-10 0-3.6-2-6-5-6z" fill="currentColor" opacity=".2"/><path d="M12 4c-3 0-5 2.4-5 6 0 4 2.5 8 5 10 2.5-2 5-6 5-10 0-3.6-2-6-5-6z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 9L4 7M17 9l3-2M7.5 12l-3 .5M16.5 12l3 .5" stroke="currentColor" stroke-width="1.1"/><circle cx="12" cy="9.5" r="1.4" fill="currentColor"/>',
  // 마린: 헬멧+바이저 + 라이플
  marine:'<path d="M12 4a5 5 0 00-5 5v4a5 5 0 005 5 5 5 0 005-5V9a5 5 0 00-5-5z" fill="currentColor" opacity=".2"/><path d="M12 4a5 5 0 00-5 5v4a5 5 0 005 5 5 5 0 005-5V9a5 5 0 00-5-5z" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="8.5" y="9" width="7" height="2.4" rx="1" fill="currentColor"/><path d="M16 13l4 2" stroke="currentColor" stroke-width="1.4"/>',
  // 골리앗: 2족 워커+쌍포
  goliath:'<rect x="7" y="6" width="10" height="8" rx="1.5" fill="currentColor" opacity=".2"/><rect x="7" y="6" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 6V3.5M11 6V4M16 8h4M16 11h4" stroke="currentColor" stroke-width="1.3"/><path d="M9 14l-2 6M15 14l2 6" stroke="currentColor" stroke-width="1.2"/>',
  // 아칸: 에너지 다이아 + 방전
  archon:'<path d="M12 3l5 9-5 9-5-9z" fill="currentColor" opacity=".25"/><path d="M12 3l5 9-5 9-5-9z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 6v2M12 16v2M8.5 12l-2 0M15.5 12l2 0" stroke="currentColor" stroke-width="1" opacity=".8"/>',
  // 다크보이드(다크아칸): 역다이아 + 어두운 코어 + 방전
  dark_archon:'<path d="M12 3l5 9-5 9-5-9z" fill="currentColor" opacity=".4"/><path d="M12 3l5 9-5 9-5-9z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 10.5l3 3M13.5 10.5l-3 3" stroke="currentColor" stroke-width="1"/>',
  // 디파일러: 유기체 몸통 + 촉수 + 포자(임시 2D)
  defiler:'<ellipse cx="12" cy="13" rx="6" ry="4.5" fill="currentColor" opacity=".28"/><ellipse cx="12" cy="13" rx="6" ry="4.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 10c-1-2-1-3 0-4M17 10c1-2 1-3 0-4M12 8.5c-.6-2-.6-3.4 0-5" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="9.5" cy="13" r="1" fill="currentColor"/><circle cx="14.5" cy="13" r="1" fill="currentColor"/><path d="M8 17l-1.5 3M12 18v3M16 17l1.5 3" stroke="currentColor" stroke-width="1.2"/>',
  // 터렛: 받침 + 회전포탑 + 미사일 포드
  turret:'<path d="M6 20h12l-2-4H8z" fill="currentColor" opacity=".2"/><path d="M6 20h12l-2-4H8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="9" y="8" width="6" height="6" rx="1.5" fill="currentColor" opacity=".25"/><rect x="9" y="8" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M15 9.5l4-1.5M15 12l4 1" stroke="currentColor" stroke-width="1.3"/><path d="M12 8V4" stroke="currentColor" stroke-width="1.2"/>',
  // 포토캐논: 받침 + 결정 코어 + 방전
  photon:'<path d="M7 20h10l-1.5-4h-7z" fill="currentColor" opacity=".2"/><path d="M7 20h10l-1.5-4h-7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 3l3.5 5-3.5 7-3.5-7z" fill="currentColor" opacity=".3"/><path d="M12 3l3.5 5-3.5 7-3.5-7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="12" cy="8.5" r="1.5" fill="currentColor"/>',
};
// 벡터 초상이 없으면 빈 칸 대신 아이콘 폴백(3D 이미지도 없을 때만 쓰임)
function unitSVG(id){ if(UNIT_SVG[id]) return '<svg viewBox="0 0 24 24" width="100%" height="100%">'+UNIT_SVG[id]+'</svg>';
  const e=(typeof U!=='undefined'&&U[id]&&U[id].icon)||'';
  return (typeof pIco==='function') ? pIco(e||'🔧') : '<svg viewBox="0 0 24 24" width="100%" height="100%"></svg>'; }
// 시민 벡터 아이콘(자체 제작) — 헬멧형 머리 + 어깨, 작업복 라인
function citizenSVG(){ return '<svg viewBox="0 0 24 24" width="100%" height="100%">'
  +'<path d="M4.5 21c0-4.2 3.4-7 7.5-7s7.5 2.8 7.5 7z" fill="#ffe6a0"/>'
  +'<path d="M4.5 21c0-4.2 3.4-7 7.5-7s7.5 2.8 7.5 7z" fill="none" stroke="#8a6b16" stroke-width="1" stroke-linejoin="round"/>'
  +'<circle cx="12" cy="7.2" r="3.7" fill="#ffe6a0" stroke="#8a6b16" stroke-width="1"/>'
  +'<path d="M9.2 18.5v2.5M14.8 18.5v2.5" stroke="#8a6b16" stroke-width="1" opacity=".7"/>'
  +'<path d="M12 14v3.2" stroke="#8a6b16" stroke-width="1" opacity=".6"/></svg>'; }
// 충돌(분리) 판정용 반경 — 그림보다 작게 잡아 유닛끼리 더 촘촘히 붙게.
function collideR(u){ const s=U[u.id]; return (s?s.size:14) * 0.62; }   // 스펙 없는 표시용 유닛(색확인 swarm_larva 등)도 루프가 안 죽게 기본 14
// 합성 사다리(가격 오름차순) — 같은 유닛 3개 → 다음 등급 영웅

// 유닛뽑기: 유닛을 시계처럼 원형 배치. 중앙 시민(셀렉터)이 이동→통과 시 구매.
const SHOP_UNITS=['ghost','dragoon','hydra','marine','goliath','archon','turret','photon']; // 시계 순서
// 유닛 슬롯 좌표 = 프레임 배치(상단1 · 좌3 · 우3 · 하단1). 가운데는 시민. SHOP_UNITS 순서대로 채움.
const CLOCK_POS=(function(){ const lx=.19, rx=.81, ys=[.305,.50,.695]; return [
  {x:.5, y:.235},                                  // 0 상단 1개(고스트) — 시계 HUD에 안 가리게 아래로
  {x:lx,y:ys[0]},{x:lx,y:ys[1]},{x:lx,y:ys[2]},    // 1~3 왼쪽 3개(드라군·히드라·마린)
  {x:rx,y:ys[0]},{x:rx,y:ys[1]},{x:rx,y:ys[2]},    // 4~6 오른쪽 3개(골리앗·아칸·터렛)
  {x:.5, y:.74},                                   // 7 하단 1개(포토캐논) — 위로 좁힘
]; })();
const CITIZEN_HOME={x:.5,y:.5}; // 시민 기본 위치(보드 중앙)
    // 하위호환 유지
// 유닛뽑기 비콘 — 좌측 줄(유닛 뽑기) / 우측 줄(에너지 뽑기). 시민이 올라서면 해당 뽑기 실행.
const DRAW_BEACONS=[
  // 좌측 줄(4줄): 미사일 포탑 / 스파이어 / 유닛 1회 / 에너지 1회 (간격 약간 띄움)
  {id:'buyTurret', x:.20, y:.18, name:'미사일 포탑', core:'🗼'},
  {id:'buyPhoton', x:.20, y:.37, name:'에너지 타워', core:'◉'},
  {id:'draw',      x:.20, y:.55, name:'유닛 1회', core:'?'},
  {id:'energy',    x:.20, y:.71, name:'가스 1회', core:'⚡'},
  // 우측 줄: 뽑기 확률↑ / 크레딧 획득↑ (확률표는 우상단 → 아래쪽에 배치해 겹침 방지)
  {id:'gachaUp',  x:.77, y:.55, name:'뽑기 확률↑', core:'%'},
  {id:'creditUp', x:.77, y:.71, name:'미네랄 획득↑', core:'C'},
];
// 비콘별 색 테마(인라인 CSS 변수로 기존 .drawZone 스타일 재사용). 유닛 1·10회=기본 빨강.
const BEACON_THEME={   // 디자인 토큰과 통일: 유닛=네온 레드(기본), 고급=골드(재화/희귀), 에너지=HUD 시안(E 재화색)
  premium: {'--neon':'#ffd24a','--neon-soft':'rgba(255,210,74,.55)','--neon-glow':'rgba(255,210,74,.42)'},
  energy:  {'--neon':'#00e5ff','--neon-soft':'rgba(0,229,255,.5)','--neon-glow':'rgba(0,229,255,.38)'},
  energyAll:{'--neon':'#00e5ff','--neon-soft':'rgba(0,229,255,.5)','--neon-glow':'rgba(0,229,255,.38)'},
  gachaUp: {'--neon':'#b06bff','--neon-soft':'rgba(176,107,255,.55)','--neon-glow':'rgba(176,107,255,.42)'},   // 뽑기확률↑=퍼플(상위등급색)
  creditUp:{'--neon':'#ffd24a','--neon-soft':'rgba(255,210,74,.55)','--neon-glow':'rgba(255,210,74,.42)'},     // 크레딧획득↑=골드(재화색)
buyTurret:{'--neon':'#9fd6ff','--neon-soft':'rgba(159,214,255,.5)','--neon-glow':'rgba(159,214,255,.38)'},
buyPhoton:{'--neon':'#62d0ff','--neon-soft':'rgba(98,208,255,.5)','--neon-glow':'rgba(98,208,255,.38)'},
pboss:   {'--neon':'#ff3b3b','--neon-soft':'rgba(255,59,59,.6)','--neon-glow':'rgba(255,59,59,.45)'},   // 개인 보스=위협 레드
};
// ×5 = 하단 시트 전용 칸. **맵 위 비콘(DRAW_BEACONS)에는 넣지 않는다** — 그 표는 좌표가 필수라
// 좌표 없는 항목을 넣으면 패드·라벨·툴팁이 전부 NaN 자리에 생긴다.
// 가격표도 따로 만들지 않는다: 1회 값 × 배수. 이 표 하나가 ×5의 단일 소스다.
const BEACON_BULK={ draw5:{base:'draw', n:5, name:'유닛 5회'}, energy5:{base:'energy', n:5, name:'가스 5회'} };
function beaconCost(id){ const bulk=BEACON_BULK[id]; if(bulk) return beaconCost(bulk.base)*bulk.n;
  return id==='gachaUp'?gachaUpCost() : id==='creditUp'?creditUpCost() : id==='pboss'?0
  : id==='energy'||id==='energyAll'?mapCfg('energyDrawCost',ENERGY_DRAW_COST)
  : id==='buyTurret'?U.turret.cost : id==='buyPhoton'?U.photon.cost : mapCfg('gachaCost',GACHA_COST); }
function beaconName(b){ if(b.id==='gachaUp') return b.name+' Lv'+(G.gachaLuckLv||0); if(b.id==='creditUp') return b.name+' Lv'+(G.creditLv||0); return b.name; }
function beaconMaxed(id){ return (id==='gachaUp' && (G.gachaLuckLv||0)>=GACHA_UP_MAX) || (id==='creditUp' && (G.creditLv||0)>=CREDIT_UP_MAX); }
function runBeacon(id){ const bulk=BEACON_BULK[id];
  // ×5 = 1회를 그대로 n번 — 확률·비용·인구 한도 판정을 전부 원래 경로가 한다(재구현 금지)
  if(bulk){ let ok=false; for(let i=0;i<bulk.n;i++){ if((G.mineral||0)<beaconCost(bulk.base)) break; if(runBeacon(bulk.base)!==false) ok=true; } return ok; }
  if(id==='gachaUp') return buyGachaUp(); if(id==='creditUp') return buyCreditUp();
  if(id==='pboss') return summonPersonalBoss();
  if(id==='energy') return energyDraw();
  if(id==='energyAll') return energyDrawAll();
  if(id==='buyTurret') return buyUnit('turret'); if(id==='buyPhoton') return buyUnit('photon'); return drawGacha(); }
function nearBeacon(b,x,y,mult){ if(!GW||!GH) return false; return Math.hypot((b.x-x)*GW,(b.y-y)*GH) < Math.min(GW,GH)*(mult||0.085); }
function beaconUnder(x,y,mult){ for(const b of DRAW_BEACONS){ if(nearBeacon(b,x,y,mult)) return b; } return null; }
   // 하위호환: 아무 비콘이나 근처면 true
// 비콘 위 떠 있는 아이콘(동그란 링 대신). currentColor=비콘 테마색.
const BEACON_ICON={
  unit:'<path d="M12 3.2a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2zM5.4 20.5c0-3.7 3-6.2 6.6-6.2s6.6 2.5 6.6 6.2z" fill="currentColor"/>',
  premium:'<path d="M12 1.8l2.5 6.6 6.7.3-5.2 4.2 1.8 6.5L12 16.1l-5.6 3.3 1.8-6.5L3 8.7l6.7-.3z" fill="currentColor"/>',
  energy:'<path d="M13.4 2L4.5 13.4h5.2L8.6 22l9-11.7h-5.4z" fill="currentColor"/>',
  gachaUp:'<rect x="3.4" y="9" width="11.6" height="11.6" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="6.9" cy="12.5" r="1.15" fill="currentColor"/><circle cx="11.5" cy="17.1" r="1.15" fill="currentColor"/><circle cx="9.2" cy="14.8" r="1.15" fill="currentColor"/><path d="M14.6 8.2 20.4 2.4M16.6 2.4h3.8v3.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',  // 별+상승(확률↑)
  creditUp:'<circle cx="10.4" cy="14.2" r="6.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12.6 11.8a3 3 0 1 0 0 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15.4 8.2 21 2.6M17.4 2.6h3.6v3.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',  // 포인트+상승화살(획득↑)
tower:'<path d="M9 3h6v3l-1.5 1v6.5h2.5L18 21H6l2-7.5h2.5V7L9 6z" fill="currentColor"/>',
spire:'<path d="M12 2.6a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8zM8.5 13h7L17 21H7z" fill="currentColor"/>',
pboss:'<path d="M12 2.5c-4 0-6.5 2.8-6.5 6.4 0 2.3 1.1 3.7 2.2 4.7v2.2c0 .7.5 1.1 1.2 1.1.4 1.1 1.6 1.9 3.1 1.9s2.7-.8 3.1-1.9c.7 0 1.2-.4 1.2-1.1v-2.2c1.1-1 2.2-2.4 2.2-4.7 0-3.6-2.5-6.4-6.5-6.4z" fill="currentColor" opacity=".22"/><path d="M12 2.5c-4 0-6.5 2.8-6.5 6.4 0 2.3 1.1 3.7 2.2 4.7v2.2c0 .7.5 1.1 1.2 1.1.4 1.1 1.6 1.9 3.1 1.9s2.7-.8 3.1-1.9c.7 0 1.2-.4 1.2-1.1v-2.2c1.1-1 2.2-2.4 2.2-4.7 0-3.6-2.5-6.4-6.5-6.4z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="9.3" cy="9.2" r="1.5" fill="currentColor"/><circle cx="14.7" cy="9.2" r="1.5" fill="currentColor"/><path d="M10.4 16.5v2M12 16.7v2.1M13.6 16.5v2" stroke="currentColor" stroke-width="1"/>',
};
function beaconIcon(id){ if(id==='perm') return '<path d="M12 2.8 19.6 6v6c0 4.6-3.1 8-7.6 9.2C7.5 20 4.4 16.6 4.4 12V6z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 8.2v7M9 11.2 12 8.2l3 3M8.6 17.4h6.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';
  if(id==='gachaUp') return BEACON_ICON.gachaUp; if(id==='creditUp') return BEACON_ICON.creditUp;
if(id==='pboss') return BEACON_ICON.pboss;
if(id==='energy') return BEACON_ICON.energy;
if(id==='buyTurret') return BEACON_ICON.tower; if(id==='buyPhoton') return BEACON_ICON.spire; return BEACON_ICON.unit; }
function beaconBadge(id){ return ''; }
// 고정 방어 구조물 자리(터렛=모서리, 포토캐논=변 중앙). 살 때마다 다음 빈 자리에 하나씩(잠금 해제).
const FIXED_SLOTS={
  // 터렛 = 보드 위/아래 우주 위에서 사격(5자리: TL·TR·BL + 상단중앙 + 하단중앙). 5시 자리는 포토캐논용으로 비움
  turret:[{x:.11,y:.205},{x:.89,y:.205},{x:.11,y:.81},{x:.5,y:.205},{x:.5,y:.81}],
  photon:[{x:.9,y:.81}],   // 포토캐논 = 5시(우하단 우주) 한 자리(무제한 겹치기)
};
const FIXED_STACK={photon:true};  // true=한 자리에 무제한 겹쳐서 구매
const FIXED_IDS=['turret','photon'];
const isFixed=id=>FIXED_IDS.indexOf(id)>=0;

// 업그레이드 건물 — 무기/종족 계열별 공격력 업글(스타크래프트식). 가스 3가스 고정(엑셀).
//  wpn = 담당 계열. 그 계열 유닛 전체의 공격력이 함께 오름.
// (삭제) TECH / TECH_POS / WPN_COL / BLDG_SVG — 업그레이드 탭 건물 화면 전용 데이터. 화면 폐지로 참조처가 사라져 함께 제거.
// 무기 계열 강화는 UPG_CATS(보병·메카닉·스웜·에테리얼) + 하단 업그레이드 시트가 단일 소스.
const UPG_COST=5; // 계열당 1레벨 = 가스 5(점증, upgCost) — 초기 비용

// 몬스터 18라운드(엑셀): 이름 / 체력 / 쉴드 / 방어력. 보스=10라운드. 커세어(5)는 엑셀 빈칸→임시.
// 라운드별 적(행=라운드). ar=등급 관문: 그 라운드 의도 등급의 한방뎀 ~55%(하위 등급은 1뎀).
// hp+sh=물량 관문: 의도 등급 조합 팀이 라운드 시간 내 겨우 전멸시키는 총량. (엑셀 초안 폐기 — 등급 성장 곡선 기준 재설계)
const MON=[
  {n:'옵저버',  hp:35,   sh:0,    ar:0},     // R1  일반
  {n:'오버로드',hp:55,   sh:0,    ar:0},     // R2  일반
  {n:'스커지',  hp:70,   sh:15,   ar:8},     // R3  일반+업글
  {n:'레이스',  hp:95,   sh:35,   ar:22},    // R4  레어 관문
  {n:'커세어',  hp:130,  sh:80,   ar:35},    // R5  레어
  {n:'셔틀',    hp:180,  sh:120,  ar:55},    // R6  레어+업글
  {n:'발키리',  hp:290,  sh:140,  ar:80},    // R7  에픽 진입
  {n:'디바우러',hp:430,  sh:190,  ar:110},   // R8  에픽 관문
  {n:'드랍쉽',  hp:620,  sh:270,  ar:150},   // R9  에픽+업글
  {n:'스카웃',  hp:800,  sh:430,  ar:190},   // R10 에픽~유니크
  {n:'커세어',  hp:1050, sh:580,  ar:250},   // R11 유니크 관문
  {n:'아비터',  hp:1400, sh:780,  ar:235},   // R12 유니크 (방어 250상한, 비율감쇄 모델)
  {n:'발키리',  hp:1900, sh:1000, ar:240},   // R13 유니크+업글
  {n:'케리어',  hp:2400, sh:1350, ar:244},   // R14 레전드 관문
  {n:'스카웃',  hp:3100, sh:1750, ar:247},   // R15 레전드
  {n:'드랍쉽',  hp:4000, sh:2300, ar:249},   // R16 레전드+업글
  {n:'배틀',    hp:6500, sh:3500, ar:250},   // R17 레전드 한계(초월 진입 압박)
  {n:'아비터',  hp:8100, sh:4400, ar:250},   // R18 초월 진입
  {n:'퀸',      hp:10000,sh:5500, ar:250},   // R19 초월
  {n:'배틀',    hp:13000,sh:7000, ar:250},   // R20 초월 조합 관문(갓은 여유)
];
// 적 형상 분류(이름 기준). 자체 제작 도형 — 공중기/유기체/비행정/대형.
const ENEMY_SHAPE={
  '옵저버':'orb','오버로드':'blob','레이스':'jet','아비터':'ship','커세어':'jet',
  '셔틀':'ship','디바우러':'blob','드랍쉽':'ship','케리어':'ship','배틀':'capital',
  '스커지':'orb','발키리':'jet','스카웃':'jet','퀸':'blob',
};
function enemyShape(n){ return ENEMY_SHAPE[n]||'orb'; }
// 적 종족(처치음 분리용) — 이름(스타크래프트 유닛) 기준 테란/저그/프로토스
const ENEMY_RACE={
  '옵저버':'protoss','오버로드':'zerg','레이스':'terran','아비터':'protoss','커세어':'protoss',
  '셔틀':'protoss','디바우러':'zerg','드랍쉽':'terran','케리어':'protoss','배틀':'terran',
  '스커지':'zerg','발키리':'terran','스카웃':'protoss','퀸':'zerg',
};
function enemyRace(n){ return ENEMY_RACE[n]||'terran'; }
// ============================================================================
// ★ 유즈맵 레지스트리 — 스타크래프트식 구조
//   엔진(유닛 카탈로그 U/GACHA_UNITS · 선택/이동/공격 시스템 · 공통 UI)은 고정이고,
//   각 유즈맵은 여기에 표시 정보 + cfg(규칙 설정)만 등록한다.
//   엔진은 mapCfg(key, 엔진기본값)으로 현재 맵 설정을 읽는다 → 새 유즈맵을 만들 때
//   엔진 코드는 건드리지 않고 cfg만 작성하면 된다.
//   cfg 키: rounds(총 라운드) roundTime prepTime startCredits startEnergy maxUnits
//           killCredit(킬 보상) gachaCost energyDrawCost sellValue noSellTiers(배열)
//           coopBoss(공용보스 사용) roster('all' 또는 사용 유닛 id 배열)
// ============================================================================
// =====================================================================
//  구조: [공유 베이스] = 엔진·렌더·3D·UI 셸·유닛 기본 정의 (모든 유즈맵 공유)
//        [유즈맵 모듈]  = 등급·가챠·적 밸런스·경제 (맵마다 다름/없을 수 있음)
//        맵별 값 → USEMAPS[id].cfg (+ cfg.bal). 엔진은 mapCfg()/applyMapBalance()로 주입.
// =====================================================================
const USEMAPS={
  nemo:  { id:'nemo',   name:'네모네모 디펜스', desc:'유닛을 뽑고 합성해 트랙의 적을 막는 협동 디펜스', long:'유닛을 뽑아 같은 유닛 3개를 합치면 더 높은 등급으로 진화합니다. 사각 트랙을 도는 적을 막아내고, 라운드마다 모은 자원으로 경제와 화력을 강화하며 버티세요. 10라운드마다 나오는 월드보스를 함께 잡으면 포인트을 얻어 영구 강화까지. 혼자서도, 최대 8인 협동으로도 즐길 수 있습니다.',
           feats:[ {ic:'merge',kw:'합성',tx:'같은 유닛 3개 → 상위 등급'}, {ic:'shield',kw:'디펜스',tx:'트랙을 도는 적 막기'}, {ic:'growth',kw:'성장',tx:'라운드마다 경제·화력 강화'}, {ic:'boss',kw:'월드보스',tx:'협동 처치로 포인트·영구 강화'}, {ic:'coop',kw:'협동',tx:'솔로 또는 최대 8인'} ],
           players:'1-8', pop:9820, icon:'🟥', rec:true,  isNew:false, playable:true,
           cfg:{ stats:true,   // 종료 후 통계 화면 사용(필요한 맵만)
                 rounds:30, roundTime:90, prepTime:10, startCredits:250, startEnergy:0, maxUnits:100,
                 killCredit:1, killEnergy:0.03, specialCredit:12, gachaCost:50, energyDrawCost:50, coopBoss:true, roster:'all',
                 enemiesPerRound:100, bossEvery:10, loseCount:200,
                 interestPer:100, interestRate:0.10, interestCap:1000, roundClearEnergyBase:2, roundClearEnergyPer:0.5 } },
  sunken:{ id:'sunken', name:'가시탑 디펜스', desc:'가시탑으로 길목을 막는 타워 디펜스', players:'1-8', pop:8730, icon:'🌿', rec:true,  isNew:false, playable:false, cfg:{} },
  marine:{ id:'marine', name:'용병 키우기',     desc:'용병을 성장시켜 최강으로 키우는 RPG', players:'1-6', pop:7610, icon:'🔫', rec:true,  isNew:false, playable:false, cfg:{} },
  temple:{ id:'temple', name:'성소 공성전',     desc:'상대 성소를 먼저 파괴하는 공성전',     players:'2-8', pop:6240, icon:'🏛️', rec:false, isNew:true,  playable:false, cfg:{} },
  cpu:   { id:'cpu',    name:'오토 배틀', desc:'건물에 유닛을 배정해 출격시켜 적 본진을 부수는 경제 전투', long:'건물마다 유닛을 배정하면 자동으로 출격해 적과 싸웁니다. 라운드 사이 자원을 굴려 병력을 불리고 배치를 다듬어, 상대보다 빠르게 경제를 키우는 쪽이 유리합니다. 적 본진을 먼저 무너뜨리면 승리. 최대 8인 대전.',
           feats:[ {ic:'build',kw:'배정',tx:'건물에 유닛 → 자동 출격'}, {ic:'coin',kw:'경제',tx:'라운드마다 자원 굴려 병력↑'}, {ic:'target',kw:'승리',tx:'적 본진 먼저 파괴'}, {ic:'sword',kw:'대전',tx:'최대 8인 실시간 전투'} ],
           players:'1-8', pop:5180, icon:'⚔️', rec:true, isNew:true,  playable:true, soloOff:true, noDiff:true,   // 오토배틀 = 멀티 전용(개인 플레이 잠금) · 대인전이라 난이도 없음
          cfg:{ mode:'strike', stats:true, teams:true,   // 종료 후 통계 화면 · 대기실 2팀 분할
                cycleTime:20, heroAt:10, baseHp:13500, secHp:6750, centralHp:4500, startGold:450, incomeBase:50, mineIncome:15, mineCost:200, world:4800 } },   // 신전 체력 ×1.5(눈덩이 완화 — 한 교전이 즉시 게임을 끝내지 않게. 측정: 매치 +5%·결착률 0.96 유지·밸런스 불변)
  photon:{ id:'photon', name:'포탑 겹치기',      desc:'방어 포탑을 겹쳐 쌓아 버티기',       players:'1-4', pop:4090, icon:'🔵', rec:false, isNew:false, playable:false, cfg:{} },
  tmp1:  { id:'tmp1',   name:'랜덤 디펜스 (임시)', desc:'임시 등록 유즈맵',               players:'1-8', pop:2600, icon:'🎲', rec:false, isNew:true,  playable:false, cfg:{} },
  tmp2:  { id:'tmp2',   name:'영웅 아레나 (임시)', desc:'임시 등록 유즈맵',               players:'2-8', pop:1900, icon:'⚔️', rec:false, isNew:false, playable:false, cfg:{} },
  tmp3:  { id:'tmp3',   name:'미로 탈출 (임시)',   desc:'임시 등록 유즈맵',               players:'1-4', pop:1200, icon:'🌀', rec:false, isNew:false, playable:false, cfg:{} },
};
// 🌫️ [임시] 전장의 안개 테스트 맵 — nemo 복제 + cfg.fog:'full'(시야 시스템 확인용, 확인 후 제거 예정)
try{ USEMAPS.fogtest = { id:'fogtest', name:'🌫️ 안개 테스트', desc:'전장의 안개·시야 시스템 확인용(임시)', players:'1-8', pop:9999, icon:'🌫️', rec:false, isNew:true, playable:true, hidden:true,   // 유즈맵 목록에서 숨김(관리자 페이지 안개로 충분)
  cfg: Object.assign({}, USEMAPS.nemo.cfg, { fog:'full' }) }; }catch(e){}
let MAP=USEMAPS.nemo;   // 현재 플레이 중인 유즈맵(게임 시작 시 _selMap으로 설정)
// ===== [nemo 유즈맵 모듈] 밸런스 (등급 배율·적 HP 스케일) — 맵마다 다름. 새 맵은 이 구조를 복제해 cfg.bal로 오버라이드 =====
const NEMO_BAL = {
  tierMul:    { common:1.0, rare:3, epic:10, unique:33, legend:105, transcend:340, god:950 },   // 등급 기본 데미지·체력 배율
  upTierMul:  { common:1.0, rare:1.2, epic:4.5, unique:13, legend:34, transcend:115, god:300 },  // 등급별 업글 1회 증가폭 배율
  unitPwr:    1.3,    // 유닛 개별 공격력 배율
  earlyHpMul: 1.7,    // R10 이전 적 HP 추가 배율
  early3Boost:{1:3.6, 2:3.1, 3:2.7, 4:2.35, 5:2.0, 6:1.7, 7:1.4, 8:1.18},   // 초반 라운드 HP 부스트(이지/노말)
  tempoHpMul: 1.35,   // 라운드 1:30 교전시간 보정
  hpRampBase: 1.14,   // 라운드당 적 HP 램프 밑수
};
try{ USEMAPS.nemo.cfg.bal = NEMO_BAL; }catch(e){}   // nemo 모듈에 연결
// [공유 베이스] 엔진이 참조하는 '활성 맵 밸런스' — 게임 시작 시 applyMapBalance()로 주입(기본 nemo)
let TIER_MUL=NEMO_BAL.tierMul, UP_TIER_MUL=NEMO_BAL.upTierMul, UNIT_PWR=NEMO_BAL.unitPwr,
    EARLY_HP_MUL=NEMO_BAL.earlyHpMul, EARLY3_BOOST=NEMO_BAL.early3Boost, TEMPO_HP_MUL=NEMO_BAL.tempoHpMul, HP_RAMP_BASE=NEMO_BAL.hpRampBase;
function applyMapBalance(){ const b=(MAP&&MAP.cfg&&MAP.cfg.bal)||NEMO_BAL;
  TIER_MUL=b.tierMul; UP_TIER_MUL=b.upTierMul; UNIT_PWR=b.unitPwr; EARLY_HP_MUL=b.earlyHpMul; EARLY3_BOOST=b.early3Boost; TEMPO_HP_MUL=b.tempoHpMul; HP_RAMP_BASE=b.hpRampBase; }
// ===== [admin 유즈맵] 관리자용 — nemo 복제본(독립 cfg·밸런스). 복제 후 cfg.bal만 바꾸면 nemo와 분리됨 =====
const ADMIN_BAL = JSON.parse(JSON.stringify(NEMO_BAL));   // nemo 밸런스 깊은 복제(독립 — 여기서 조정해도 nemo 영향 없음)
try{ USEMAPS.admin = { id:'admin', name:'관리자용 (테스트)', desc:'밸런스·기능 테스트 전용 — nemo 복제본(독립 조정)', players:'1-8', pop:0, icon:'🛠️', rec:false, isNew:false, playable:true,
  cfg: Object.assign({}, USEMAPS.nemo.cfg, { bal:ADMIN_BAL, mode:'sandbox' }) }; }catch(e){}
// 무한 디펜스 — nemo 엔진 재사용 + 무한 루프(노말 고정). 해금: 노말 클리어.
try{ USEMAPS.nemo_inf = { id:'nemo_inf', name:'무한 디펜스', desc:'노말 난이도로 끝없이 이어지는 무한 라운드 — 얼마나 오래 버티나', players:'1', pop:0, icon:'♾️', rec:false, isNew:true, playable:true, hidden:true,
  cfg: Object.assign({}, USEMAPS.nemo.cfg, { infinite:true, rounds:999999, infLoopHpMul:2.2, infIncomeLoop:1.5, infSoftCap:200, infWallMul:1.4, fixedDiff:'normal' }) }; }catch(e){}
// 🎛 방 설정 오버라이드 — 방장이 정한 '사용자 지정' 값이 여기 실린다.
// ⚠ 유즈맵 cfg 를 직접 고치지 말 것(다음 판까지 남는다). 게임 시작 때 심고 끝나면 지운다.
let MAP_CFG_OVR=null;
function mapCfg(k,def){ if(MAP_CFG_OVR && MAP_CFG_OVR[k]!==undefined) return MAP_CFG_OVR[k];
  const c=MAP&&MAP.cfg, v=c?c[k]:undefined; return v===undefined?def:v; }

// ── 엔진 기본값(유즈맵 cfg 미지정 시 사용) ──
const TOTAL_ROUNDS=30;                    // 총 30라운드(보스: 5·10·…·30). 적 정의(MON)는 부족분 마지막 것 반복(R21+ = R20 적 + 라운드 램프로 가속)
const ENEMIES_PER_ROUND=100;               // 일반 라운드 적 수 = 99 + 스페셜 1
const SPAWN_GAP=0.8;                        // 적 스폰 간격(초) → 100마리×0.8s=80초 스폰 후 10초 정리시간
const PREP_TIME=10;                        // 라운드 시작 전 준비(유닛 뽑기) 시간(초)
const ROUND_TIME=90;                       // 라운드 제한시간 1:30(초). 80초 스폰(0.8s×100) + 10초 정리
const BOSS_ROUND_TIME=120;                  // 보스 라운드 제한시간 2:00 — 필수처치이므로 더 길게
const BOSS_EVERY=10;                        // 10라운드마다 보스 라운드(보스 1마리만)
/* EARLY_HP_MUL → NEMO_BAL.earlyHpMul */   // R10 이전 적 HP 추가 배율(초반 안전마진 축소)
/* EARLY3_BOOST → NEMO_BAL.early3Boost */   // 초반 라운드(R1~4) HP 추가 부스트, R5부터 1.0. 이지/노말에서만 — 1레어 솔로 방지·멀티유닛 유도
/* TEMPO_HP_MUL → NEMO_BAL.tempoHpMul */  // 라운드 1:30(교전시간 1.5배)에 대한 적 체력 보정(이지 ~5/10 목표, 봇시뮬 48%)
const LOSE_COUNT=200;                       // 트랙 200기 누적 시 탈락(게임아웃)
const WARN1=150, WARN2=185;                 // 적 누적 경고 임계치(탈락선 200 비례)
const SPECIAL_MIN=25;                       // 스페셜 유닛 처치 시 크레딧 보너스
function isBossRound(r){ return r % mapCfg('bossEvery',BOSS_EVERY) === 0; }
function bossHp(r){ return Math.round(60*Math.pow(r,3.2)); }   // 라운드 보스 기본 HP=매끈한 곡선(MON 점프 회피). 난이도/템포는 bossMul. R10≈95k·R20≈870k·R30≈3.3M(×bossMul)
const START_MIN=120, START_GAS=0;
const MAX_UNITS=100;                       // 인구 기본 상한. 메타 '유닛 수 증가'로 +N
const SPLASH_R=.08, SPLASH_RATIO=.5;
// 발사체 속도(px/s) — fireAttack 비주얼 속도와 일치해야 데미지 타이밍이 모션과 맞음. (rifle·psi=즉발은 없음)
const PROJ_SPD={bullet:640, spike:560, plasma:240, missile:240, rifle:900};

