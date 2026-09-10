const fs=require('fs');
const rep=(F,a,b,t)=>{let s=fs.readFileSync(F,'utf8');
 if(s.split(a).length!==2){console.error('MISS '+t);process.exit(1);}
 fs.writeFileSync(F,s.replace(a,b));};

/* ── ① 던전 부제 — 이름과 같은 표에서 온다 ── */
rep('js/12-appshell.js',
`function campDgDesc(dg){ return CAMP_DG_DESC[Math.max(0, Math.min(CAMP_DG_MAX, dg | 0))] || ''; }`,
`// 🏰 **부제도 이름과 같은 표에서 온다**(2026-09-10). 개편이 이름을 CAMP_DG 로 옮기면서 부제는
//   옛 10던전 표(CAMP_DG_DESC)에 남아, 목록에 「버려진 전초기지 / 스웜 종족의 한적한 터전 외곽」처럼
//   **종족이 어긋난 줄**이 떴다(실측). 이름이 campDgName 한 곳에서 오듯 부제도 그렇다.
//   ⚠ CAMP_DG_DESC 는 캠프(0) 한 줄 때문에 남는다 — 던전 쪽은 이제 안 읽는다.
function campDgDesc(dg){
  const i = Math.max(0, dg | 0);
  if(i > 0 && typeof CAMP_DG !== 'undefined' && CAMP_DG[i] && CAMP_DG[i].desc) return CAMP_DG[i].desc;
  return CAMP_DG_DESC[Math.min(CAMP_DG_DESC.length - 1, i)] || ''; }`,'부제');

/* ── ② 튜토리얼 던전 안내 — 이름·부제를 그 표에서 ── */
rep('js/06-daily.js',
`// 🗺 던전 고르기 안내 — 이름과 배율을 **표에서 꺼낸다**(값이 바뀌면 문구도 따라온다).
//   ⛔ 「감염된 둥지 1.5~2.0」 을 손으로 적지 말 것 — CAMP_MINE 이 단일 소스다(HUNT_R1 §6-1-0-1).
function _tutoDgTip(){
  let nm = '던전 ' + TUTO_DG, mul = '';
  try{ if(typeof hbDun==='function'){ const d=hbDun(TUTO_DG); if(d && d.name) nm=d.name; } }catch(_e){}
  try{ if(typeof campDgMulTx==='function') mul=campDgMulTx(TUTO_DG); }catch(_e){}
  const jo = (typeof josaEul==='function') ? josaEul(nm) : '를';
  return nm + jo + ' 선택합니다' + (mul ? ('\n미네랄 획득 배율 ' + mul.replace(/×/g,'')) : ''); }`,
`// 🗺 던전 고르기 안내 — 이름과 한 줄 설명을 **화면과 같은 함수**에서 꺼낸다.
//   ⛔ hbDun(08-hunt 의 옛 10던전 표)을 쓰지 말 것 — 순서가 달라 **말풍선과 목록의 이름이 어긋났다**
//     (2026-09-10 · 던전 개편이 이름을 campDgName 으로 옮겼다. 같은 실수를 던전 칩이 먼저 했다).
//   ⛔ 획득 배율을 문구에 적지 말 것 — 목록 카드 오른쪽이 이미 말하고, 개편으로 오르는 축이 바뀌었다.
function _tutoDgTip(){
  let nm = '던전 ' + TUTO_DG, ds = '';
  try{ if(typeof campDgName==='function') nm = campDgName(TUTO_DG) || nm; }catch(_e){}
  try{ if(typeof campDgDesc==='function') ds = campDgDesc(TUTO_DG) || ''; }catch(_e){}
  const jo = (typeof josaEul==='function') ? josaEul(nm) : '를';
  return nm + jo + ' 선택합니다' + (ds ? ('\n' + ds) : ''); }`,'던전안내');

/* ── ③ 진입 버튼 — 글자를 화면에서 읽는다 ── */
rep('js/06-daily.js',
`  { id:'dgGo',   goal:1,  tip:'하단의 이동 버튼을 눌러 던전을 이동합니다',`,
`  { id:'dgGo',   goal:1,  tip:()=>('하단의 「' + _tutoGoLabel() + '」 버튼을 눌러 던전에 들어갑니다'),`,'진입');
rep('js/06-daily.js',
`function _tutoDgTip(){`,
`// 🚪 진입 버튼의 **글자는 화면이 정한다**(campDropRender) — 「이동」이었다가 개편으로 「진입」이 됐다.
//   ⛔ 문구에 손으로 박지 말 것: 버튼 글자가 바뀌면 안내가 곧바로 거짓말이 된다(2026-09-10 실제로 그랬다).
function _tutoGoLabel(){
  const b = document.querySelector('#campDrop .cdGo');
  const t = b ? String(b.textContent||'').trim() : '';
  return t || '진입'; }
function _tutoDgTip(){`,'버튼글자');

/* ── ④ 마지막 안내 — 라운드가 아니라 부순 건물 ── */
rep('js/06-daily.js',
`  { id:'outro',  goal:1,  tip:'라운드가 오를수록 재화 획득 배수가 늘어납니다',`,
`  // 🏰 **라운드가 없어졌다**(2026-09-09 개편) — 진행은 「부순 진행 건물 수」이고 배수도 그걸 따라 오른다.
  //   ⛔ 「라운드가 오를수록」으로 되돌리지 말 것: 화면 어디에도 라운드가 없다.
  { id:'outro',  goal:1,  tip:()=>('적 건물을 부술수록 재화 획득 배수가 늘어납니다\n진행 건물 '
      + ((typeof CAMP_DG_STEPS!=='undefined')?CAMP_DG_STEPS:6) + '채를 부수면 완주'),`,'마지막');
console.log('ok');
