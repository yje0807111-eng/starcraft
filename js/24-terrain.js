/* ═══════════════════════════════════════════════════════════════════════════
 * 🗺 지형층 — 벽 · 언덕(고원) · 램프                                (2026-09-10)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⭐ **왜 있나** — 그동안 「벽」을 바닥이 통째로 들어간 완성 타일로 만들려 했다.
 *    그러면 바닥 종류마다 벽 세트를 다시 뽑아야 하고(바닥 3 × 벽 12 = 36장),
 *    언덕이 들어오면 (바닥 × 벽 × 높이) 로 곱해진다. 그래서 층을 나눈다:
 *      ① 바닥 = 통 텍스처(.bmapFloor)      ② **지형 = 이 파일**(투명 배경)
 *      ③ 건물·유닛 = 3D(#techMap3d)
 *
 * 📐 **격자는 안개와 같은 것을 쓴다**(FOG_COLS × 범위 비례 rows).
 *    ⛔ 지형용 격자를 따로 만들지 말 것 — 시야 차단(2단계)이 `f.height` 를 읽는데
 *      두 격자가 어긋나면 「보이는 절벽」과 「가리는 절벽」이 한 칸씩 밀린다.
 *
 * 🎨 **그림은 「네 조각 오토타일」이다.** 한 칸을 1/4 씩 넷으로 나누고, 각 조각은
 *    이웃 셋(가로·세로·대각)만 보고 다섯 모양 중 하나를 고른다:
 *      바깥모서리(out) · 가장자리 가로(ev) · 가장자리 세로(eh) · 채움(fill) · 안쪽모서리(in)
 *    그래서 **그림 12칸(3×3 블록 + 안쪽모서리 4개)** 이면 256가지 배치가 전부 나온다.
 *    ⛔ 회전으로 조각을 아끼지 말 것 — 빛의 방향이 같이 돌아 위아래가 뒤집힌다.
 *
 * ⚡ **지형은 안 변한다 → 한 번 굽고(bake) 매 프레임엔 한 장만 그린다.**
 *    ⛔ 조각을 매 프레임 그리지 말 것: 칸 하나에 4번 × 48×80칸 = 15,000 번이다.
 *
 * 🚧 **1단계는 그림만이다.** 시야 차단(2)·길막기(3)는 아직 배선하지 않았다 —
 *    지금 `techFogInit` 은 캠프에서 `flat:true` 로 불린다(23-camp-dungeon campFogSync).
 *
 * ⚠ **고원 자리는 배경 그림과 같은 자리다**(ART.md §17 「위 8~27% 가 적 고원」 · gy −0.45~−0.15).
 *   지금은 배경에 고원이 **그려져** 있으므로 여기서 또 그리면 두 겹이 된다 → 그래서
 *   같은 줄에 맞춰 그려 겹쳐 보이게 한다. 바닥이 타일로 바뀌면(5단계) 이 층만 남는다.
 *   ⛔ 고원 줄을 여기서 새로 정하지 말 것 — 23-camp-dungeon CAMP_FOE_ROW 와 한 몸이다.
 */

// ── 격자 ──────────────────────────────────────────────────────────────────
const TERR_CELL_PX  = 32;    // 구운 그림에서 칸 하나의 픽셀(원본 해상도)
const TERR_BAKE_MAX = 2048;  // 구운 그림의 최대 변(모바일 메모리) — 넘으면 칸 픽셀을 줄인다
const TERR_FACE_K   = 0.62;  // 절벽 앞면 높이 = 칸 높이 × 이 값

// 🏔 적 고원의 **아래 끝** — 위쪽은 지도 끝까지 전부 고지다.
//   값은 ART.md §17 그림의 고원 밑변(gy −0.15 언저리)과 같은 줄이다. 적 기지(CAMP_FOE_ROW −0.43~+0.02)의
//   위쪽 절반이 여기 선다. ⛔ 여기서 새 줄을 정하지 말 것 — 23-camp-dungeon CAMP_FOE_ROW 와 한 몸이다.
const TERR_PLATEAU_Y1 = -0.13;
// 🚪 램프 — 고원으로 올라가는 길. ⛔ 빼지 말 것: 3단계에서 절벽이 길을 막으면 램프가 유일한 통로다.
const TERR_RAMP_W  = 3;      // 램프 폭(칸)
const TERR_RAMP_N  = 2;      // 램프 개수
/* 🧱 벽 — **적 기지와 내 격자 사이의 통로에만** 둔다.
 *   ⛔ 내 격자(techY0 = 0.18 아래)에는 절대 두지 말 것 — 건물을 짓는 자리다.
 *   ⛔ 적 기지 줄(CAMP_FOE_ROW · 맨 아래가 tower1 = +0.02)과 겹치지 말 것 —
 *     겹치면 벽이 적 건물 위에 선다(2026-09-10 실측: 병영·미사일 포탑 자리에 벽이 났다).
 *   ⚠ 그래서 지금 쓸 수 있는 띠는 **0.05 ~ 0.16 뿐**이다(약 5줄). 적 기지 안에도 벽을 두려면
 *     배치 생성기(campFoeLayout)가 자리를 비워 줘야 한다 — 4단계의 몫이다. */
const TERR_WALL_ZONE = { y0:0.05, y1:0.16 };
const TERR_WALL_N    = 4;    // 덩어리 수
const TERR_WALL_W    = 4;    // 덩어리 최대 가로(칸) — 2 + 0~이 값
const TERR_WALL_H    = 3;    // 덩어리 최대 세로(칸)
const TERR_EDGE_MAX  = 4;    // 고원 아래 가장자리가 오르내리는 최대 칸

let CAMPT = null;            // 지금 지형. 던전 밖에서는 null

// ── 만들기 ────────────────────────────────────────────────────────────────
// ⚠ rows 는 **안개가 정한 것을 그대로 받는다**(campTerrSync) — 안 받으면 한 칸씩 밀린다.
function campTerrInit(wy0, wy1, rows){
  const cols = FOG_COLS, n = cols * rows;
  CAMPT = { cols:cols, rows:rows, wy0:wy0, wy1:wy1,
            h:new Uint8Array(n),   // 높이 0=저지 1=고지
            r:new Uint8Array(n),   // 램프 0/1 — 고지이면서 아래에서 올라올 수 있는 칸
            w:new Uint8Array(n),   // 벽 0/1
            bake:null, sig:'' };
  return CAMPT; }
// ⚠ 칸 → 월드 좌표(campTerrCellX/Y)는 **2단계에서** 온다(시야·길막기가 그때 쓴다).
//   ⛔ 미리 만들어 두지 말 것 — 죽은 코드 래칫(npm test)이 잡는다.
function campTerrRowAt(wy){ const T = CAMPT; return Math.round(((wy - T.wy0) / (T.wy1 - T.wy0)) * T.rows - 0.5); }

/* 🎲 배치는 생성기가 뽑는다 — 규칙은 고정이고 자리만 씨앗이다(적 기지 campFoeLayout 과 같은 규약).
 *   ⛔ Math.random 을 쓰지 말 것: 저장·복원하면 지형이 바뀌고 스모크가 못 잰다. */
function campTerrGen(dg, seed){
  const T = CAMPT; if(!T) return null;
  // 🧹 **비우고 시작한다** — 같은 지형에 두 번 부르면 램프·벽이 **쌓인다**(2026-09-11 실측: 램프 12 → 22 → 33).
  //   보통은 campTerrInit 이 새 배열을 주지만, 검사·재생성은 같은 지형에 다시 부른다.
  T.h.fill(0); T.r.fill(0); T.w.fill(0); T.bake = null; T._blk = null; T._flow = null;
  const R = campFoeRng((seed >>> 0) ^ 0x9E3779B9 ^ ((dg | 0) * 2654435761));
  const C = T.cols, W = T.rows;
  // 🏔 고원 — **위 끝에서** 아래 가장자리까지 통째로 고지다.
  //   ⛔ 위쪽에 띠의 북쪽 경계를 만들지 말 것: 지도 한가운데 가로줄 절벽이 생겨 「벽」으로 보인다.
  const py0 = 0, py1 = Math.min(W - 1, campTerrRowAt(TERR_PLATEAU_Y1));
  for(let ty = py0; ty <= py1; ty++){ const row = ty * C; for(let tx = 0; tx < C; tx++) T.h[row + tx] = 1; }
  // ⛰ 아래 가장자리는 **계단**이다 — 한 칸씩만 오르내린다.
  //   ⛔ 열마다 따로 굴리지 말 것(2026-09-10 실측): 1칸짜리 이·저가 번갈아 나와 **빗살**로 보였다.
  let cut = 1;
  for(let tx = 0; tx < C; tx++){
    if(R() < 0.42) cut = Math.max(0, Math.min(TERR_EDGE_MAX, cut + (R() < 0.5 ? -1 : 1)));
    for(let k = 0; k < cut; k++){ const ty = py1 - k; if(ty > py0) T.h[ty * C + tx] = 0; } }
  // 🚪 램프 — 고원 아래 가장자리에 통로를 낸다
  for(let i = 0; i < TERR_RAMP_N; i++){
    const cx = Math.floor(2 + R() * (C - 4 - TERR_RAMP_W));
    for(let tx = cx; tx < cx + TERR_RAMP_W && tx < C; tx++){
      let ty = py1; while(ty > py0 && !T.h[ty * C + tx]) ty--;              // 그 열의 실제 고원 밑변
      for(let k = 0; k < 2 && ty - k >= py0; k++){ const i2 = (ty - k) * C + tx; T.h[i2] = 1; T.r[i2] = 1; } } }
  // 🧱 벽 — 통로에 덩어리 몇 개
  const wy0 = Math.max(py1 + 2, campTerrRowAt(TERR_WALL_ZONE.y0)), wy1 = Math.min(W - 2, campTerrRowAt(TERR_WALL_ZONE.y1));
  const blobs = [];
  if(wy1 > wy0) for(let i = 0; i < TERR_WALL_N; i++){
    // 덩어리는 **네모**다 — 한 칸씩 흩어 놓으면 지형이 아니라 얼룩으로 보인다(2026-09-10 실측)
    const bw = 2 + Math.floor(R() * TERR_WALL_W), bh = 1 + Math.floor(R() * TERR_WALL_H);
    const bx = Math.floor(1 + R() * Math.max(1, C - bw - 2)), by = wy0 + Math.floor(R() * Math.max(1, wy1 - wy0 - bh + 1));
    const cells = [];
    for(let y = by; y < by + bh && y <= wy1; y++) for(let x = bx; x < bx + bw && x < C; x++){
      const i2 = y * C + x; if(!T.w[i2]){ T.w[i2] = 1; cells.push(i2); } }
    blobs.push(cells); }
  // 🚧 **길이 막히면 안 된다** — 릴레이 던전은 적이 나한테 와야 성립한다.
  //   막혔으면 마지막에 놓은 덩어리부터 걷어 내고 다시 잰다(⛔ 「그냥 두기」 금지).
  while(blobs.length && !campTerrConnected()){ const b = blobs.pop(); for(const i2 of b) T.w[i2] = 0; }
  T.bake = null;
  return T; }

/* 🚧 **무엇이 길을 막나** — 한 곳에서 정한다(흐름장·연결성 검사·스모크가 같은 자를 쓴다).
 *   ① 벽 · ② **절벽의 테두리**(고지인데 4방향 중 저지가 하나라도 있는 칸).
 *   ⭐ 절벽을 「고원 전체」로 잡으면 적 기지가 통째로 장애물 안에 들어가 아군이 못 간다.
 *     막아야 하는 것은 **면이 아니라 경계**다 — 고원 안은 걸어 다닐 수 있어야 한다.
 *   🚪 **램프는 뚫려 있다** — 그것이 올라가는 유일한 길이다(⛔ 램프를 막으면 던전이 멈춘다).
 *   ⚠ 지도 **밖**은 「높다」로 친다 — 안 그러면 지도 네 변이 통째로 절벽이 된다. */
function campTerrHiAt(tx, ty){
  const T = CAMPT;
  if(tx < 0 || ty < 0 || tx >= T.cols || ty >= T.rows) return 1;   // 밖 = 높다
  return T.h[ty * T.cols + tx] > 0 ? 1 : 0; }
function campTerrBlockedAt(tx, ty){
  const T = CAMPT, i = ty * T.cols + tx;
  if(T.w[i]) return true;                       // 🧱 벽
  if(!T.h[i] || T.r[i]) return false;           // 저지·램프는 안 막는다
  return !campTerrHiAt(tx - 1, ty) || !campTerrHiAt(tx + 1, ty)
      || !campTerrHiAt(tx, ty - 1) || !campTerrHiAt(tx, ty + 1); }   // ⛰ 절벽 테두리
/* 🛤 **전장이 실제로 닿는 칸의 범위**(레인 상자 · 격자 좌표).
 *   ⚠ 지형 격자는 gx 0~1 · gy wy0~1 을 다 갖지만, **전장은 그만큼 못 간다**:
 *     `campG2W` 가 x 를 `0.5+(gx-0.5)/CAMP_LANE_W` 로 펴고 `strikeMoveToward` 가 0~world 로 자르므로
 *     격자 x 0.06 보다 왼쪽·0.94 보다 오른쪽은 **전부 같은 자리로 접힌다**. 세로도 마찬가지다(t 가 잘린다).
 *   ⛔ 이 범위를 흐름장에서 빼지 말 것 — 실측(2026-09-11): 유닛이 gx 0.06 에 서서 **gx 0.01 로 가라는
 *     지시를 30초 동안 받았다.** 갈 수 없는 칸이라 영영 안 움직였다(8판 중 1판). */
function campTerrLane(){
  const w = (typeof CAMP_LANE_W !== 'undefined') ? CAMP_LANE_W : 0.88;
  const top = (typeof CAMP_LANE_TOP !== 'undefined') ? CAMP_LANE_TOP : -0.26;
  const bot = (typeof CAMP_LANE_BOT !== 'undefined') ? CAMP_LANE_BOT : 0.62;
  const tmin = (typeof CAMP_LANE_TMIN !== 'undefined') ? CAMP_LANE_TMIN : (-0.14 / 0.72);
  return { x0: 0.5 - w / 2, x1: 0.5 + w / 2, y0: top + tmin * (bot - top), y1: bot }; }
/* 막힌 칸 표 — 흐름장·직선 판정·연결성 검사가 **같은 표**를 본다(한 번만 만든다).
 *   ⚠ 「지형이 막는가」(`campTerrBlockedAt`)와 다른 자다 — 여기엔 **레인 밖**이 함께 들어간다. */
function campTerrMask(){
  const T = CAMPT; if(!T) return null;
  if(T._blk) return T._blk;
  const C = T.cols, W = T.rows, m = new Uint8Array(C * W), L = campTerrLane(), span = T.wy1 - T.wy0;
  for(let ty = 0; ty < W; ty++){ const gy = T.wy0 + ((ty + 0.5) / W) * span;
    const outY = (gy < L.y0 || gy > L.y1);
    for(let tx = 0; tx < C; tx++){ const gx = (tx + 0.5) / C;
      m[ty * C + tx] = (outY || gx < L.x0 || gx > L.x1 || campTerrBlockedAt(tx, ty)) ? 1 : 0; } }
  T._blk = m; return m; }
/* 레인 안에 **칸 중심**이 들어오는 행의 위·아래 끝.
 *   ⚠ 「gy 가 든 행」으로 잡으면 안 된다 — 마스크는 **중심**으로 판단하므로 한 행 어긋나
 *     목표 행이 통째로 막힌 행이 되어 **연결성 검사가 늘 실패한다**(2026-09-11 실측 300/300). */
function campTerrLaneRows(){
  const T = CAMPT, L = campTerrLane(), span = T.wy1 - T.wy0;
  const inLane = ty => { const gy = T.wy0 + ((ty + 0.5) / T.rows) * span; return gy >= L.y0 && gy <= L.y1; };
  let hi = 0; while(hi < T.rows && !inLane(hi)) hi++;
  let lo = T.rows - 1; while(lo >= 0 && !inLane(lo)) lo--;
  return { hi: hi, lo: lo }; }
/* 🚧 내 쪽 끝에서 적 쪽 끝까지 갈 수 있나 — 4방향 flood fill.
 *   ⚠ **절벽도 함께 본다** — 벽만 보면 「램프가 벽에 막혔다」를 못 잡는다.
 *   ⚠ **레인 안에서만 잰다**(campTerrMask) — 격자 맨 아랫줄·맨 윗줄은 전장이 못 가는 자리다.
 *     거기서 출발하면 늘 「막혔다」가 나와 생성기가 벽을 전부 걷어 낸다. */
function campTerrConnected(){
  const T = CAMPT; if(!T) return true;
  T._blk = null;                       // 벽이 방금 바뀌었다 — 표를 다시 만든다
  const C = T.cols, W = T.rows, m = campTerrMask(), R = campTerrLaneRows();
  const yLo = R.lo, yHi = R.hi;   // 아래(나) ↔ 위(적)
  const seen = new Uint8Array(C * W), q = [];
  for(let tx = 0; tx < C; tx++){ const i = yLo * C + tx; if(!m[i]){ seen[i] = 1; q.push(i); } }
  for(let p = 0; p < q.length; p++){ const i = q[p], x = i % C, y = (i / C) | 0;
    if(y <= yHi) return true;
    const nb = [x > 0 ? i - 1 : -1, x < C - 1 ? i + 1 : -1, y > 0 ? i - C : -1, y < W - 1 ? i + C : -1];
    for(const j of nb){ if(j < 0 || seen[j] || m[j]) continue; seen[j] = 1; q.push(j); } }
  return false; }

// ── 오토타일 ──────────────────────────────────────────────────────────────
/* 조각 하나의 모양 — 이웃 셋(가로 a · 세로 b · 대각 c)만 본다.
 *   ⛔ 8방향 비트마스크(47조각)로 되돌리지 말 것: 그림이 네 배로 늘어난다. */
function campTerrShape(a, b, c){
  if(!a && !b) return 'out';        // 둘 다 없다 → 바깥 모서리
  if(a && !b)  return 'ev';         // 위(아래)가 없다 → 가로 가장자리
  if(!a && b)  return 'eh';         // 왼(오른)이 없다 → 세로 가장자리
  return c ? 'fill' : 'in'; }       // 대각까지 있으면 채움, 없으면 안쪽 모서리
/* 모양 + 조각 위치(k: 0=좌상 1=우상 2=좌하 3=우하) → 그림 시트의 칸 [열, 행]
 *   시트는 4열 × 3행이다:  (0,0)좌상 (1,0)위 (2,0)우상 (3,0)안쪽모서리
 *                          (0,1)왼   (1,1)속 (2,1)오른
 *                          (0,2)좌하 (1,2)아래 (2,2)우하 */
function campTerrSrc(shape, k){
  const rx = (k & 1) ? 1 : 0, dy = (k & 2) ? 1 : 0;
  if(shape === 'fill') return [1, 1];
  if(shape === 'in')   return [3, 0];
  if(shape === 'out')  return [rx ? 2 : 0, dy ? 2 : 0];
  if(shape === 'eh')   return [rx ? 2 : 0, 1];
  return [1, dy ? 2 : 0]; }

/* 🎨 **그림 시트 — 지금은 코드로 그린다**(1단계).
 *   ⭐ 진짜 그림으로 바꿀 때 손댈 곳은 이 함수 하나다: 같은 4×3 배치의 이미지를 돌려주면 된다.
 *   ⛔ 다른 곳에서 조각을 직접 그리지 말 것 — 두 벌이 되면 교체가 불가능해진다. */
/* ⚠ **고원 윗면은 반투명이다.** 지금 바닥은 배경 그림 한 장이고 거기 고원이 이미 **그려져** 있다
 *   (ART.md §17). 불투명하게 채우면 그림을 통째로 덮어 커다란 회청색 판이 된다(2026-09-10 실측).
 *   그래서 **가장자리와 절벽 앞면만 또렷하게** 그리고 윗면은 살짝 밝히기만 한다 —
 *   RTS 의 절벽이 원래 그렇게 읽힌다(면이 아니라 테와 앞면이 높이를 말한다).
 *   ⛔ 바닥이 타일로 바뀌기 전에는(5단계) 불투명으로 되돌리지 말 것.
 * 🧱 **벽은 불투명이다** — 벽은 지형이 아니라 그 위에 선 물건이다. */
const TERR_SKIN = {
  hi:   { top:'rgba(120,140,170,.16)', face:'#232935', edge:'rgba(176,196,224,.50)', line:'rgba(8,11,17,.72)', lip:'rgba(198,216,240,.62)' },
  ramp: { top:'rgba(150,175,205,.26)', face:'#2c3442', edge:'rgba(200,220,245,.62)', line:'rgba(8,11,17,.60)', lip:'rgba(214,232,255,.72)' },
  wall: { top:'#3a3f4a',               face:'#20242c', edge:'#69748a',               line:'#12151b',          lip:'#7d89a0' } };
function campTerrSheet(kind, px){
  const S = TERR_SKIN[kind] || TERR_SKIN.wall;
  const cv = document.createElement('canvas'); cv.width = px * 4; cv.height = px * 3;
  const x = cv.getContext('2d'), E = Math.max(2, Math.round(px * 0.12));
  // 12칸: 어느 변이 바깥으로 드러나는가
  const EXP = [['tl'], ['t'], ['tr'], ['in'], ['l'], [], ['r'], null, ['bl'], ['b'], ['br'], null];
  for(let row = 0; row < 3; row++) for(let col = 0; col < 4; col++){
    const e = EXP[row * 4 + col]; if(e === null) continue;
    const ox = col * px, oy = row * px;
    x.fillStyle = S.top; x.fillRect(ox, oy, px, px);
    const t = e[0] || '';
    if(t === 'in'){                                    // 안쪽 모서리 — 네 귀퉁이를 조금씩 파낸다
      x.fillStyle = S.line;
      for(const [qx, qy] of [[0,0],[1,0],[0,1],[1,1]]) x.fillRect(ox + qx * (px - E), oy + qy * (px - E), E, E);
      continue; }
    const up = t.indexOf('t') === 0, dn = t.indexOf('b') === 0, lf = t.indexOf('l') >= 0, rt = t.indexOf('r') >= 0;
    x.fillStyle = S.edge;                              // 드러난 변에 밝은 테(빛은 늘 위에서 온다)
    if(up) x.fillRect(ox, oy, px, E);
    if(lf) x.fillRect(ox, oy, E, px);
    if(rt) x.fillRect(ox + px - E, oy, E, px);
    x.fillStyle = S.line;                              // 그 바깥에 어두운 선
    if(up) x.fillRect(ox, oy, px, Math.max(1, E * 0.35));
    if(dn) x.fillRect(ox, oy + px - Math.max(1, E * 0.5), px, Math.max(1, E * 0.5));
    if(lf) x.fillRect(ox, oy, Math.max(1, E * 0.35), px);
    if(rt) x.fillRect(ox + px - Math.max(1, E * 0.35), oy, Math.max(1, E * 0.35), px); }
  return cv; }

// ── 굽기 ──────────────────────────────────────────────────────────────────
function campTerrCellPx(){ const T = CAMPT;
  return Math.max(8, Math.min(TERR_CELL_PX, Math.floor(TERR_BAKE_MAX / Math.max(T.cols, T.rows)))); }
/* 지형 전체를 오프스크린 캔버스 한 장에 그린다 — **지형이 바뀔 때만** 부른다.
 *   📏 `_terrBakes` 는 **몇 번 구웠나**다(스모크가 잰다). 프레임마다 늘면 서명이 흔들린다는 뜻이고,
 *     그러면 1200×2000 캔버스가 매 프레임 새로 생겨 화면이 멎는다(2026-09-10 에 실제로 그랬다). */
let _terrBakes = 0;
function campTerrBake(){
  _terrBakes++;
  const T = CAMPT; if(!T) return null;
  const px = campTerrCellPx(), q = px / 2, C = T.cols, W = T.rows;
  const cv = document.createElement('canvas'); cv.width = C * px; cv.height = W * px;
  const x = cv.getContext('2d');
  const sheets = { hi:campTerrSheet('hi', px), ramp:campTerrSheet('ramp', px), wall:campTerrSheet('wall', px) };
  // 한 겹 그리기 — same(tx,ty) 가 「이 칸이 이 재료인가」
  const layer = (same, sheet) => {
    for(let ty = 0; ty < W; ty++) for(let tx = 0; tx < C; tx++){
      if(!same(tx, ty)) continue;
      for(let k = 0; k < 4; k++){
        const dx = (k & 1) ? 1 : -1, dy = (k & 2) ? 1 : -1;
        const s = campTerrShape(same(tx + dx, ty), same(tx, ty + dy), same(tx + dx, ty + dy));
        const src = campTerrSrc(s, k), sx = src[0] * px + ((k & 1) ? q : 0), sy = src[1] * px + ((k & 2) ? q : 0);
        x.drawImage(sheet, sx, sy, q, q, tx * px + ((k & 1) ? q : 0), ty * px + ((k & 2) ? q : 0), q, q); } } };
  const inB = (tx, ty) => tx >= 0 && ty >= 0 && tx < C && ty < W;
  const hiAt = (tx, ty) => inB(tx, ty) && T.h[ty * C + tx] > 0;
  layer(hiAt, sheets.hi);
  // 🏔 절벽 앞면 — 아래 칸이 낮은 곳에만. **이게 없으면 높이로 안 읽힌다.**
  const face = Math.round(px * TERR_FACE_K);
  for(let ty = 0; ty < W; ty++) for(let tx = 0; tx < C; tx++){
    if(!hiAt(tx, ty) || hiAt(tx, ty + 1)) continue;
    const ramp = T.r[ty * C + tx] > 0, S = TERR_SKIN[ramp ? 'ramp' : 'hi'], lip = Math.max(1, px * 0.09);
    x.fillStyle = S.face; x.fillRect(tx * px, (ty + 1) * px, px, face);
    x.fillStyle = S.lip;  x.fillRect(tx * px, (ty + 1) * px, px, lip);                       // 윗입술 — 「여기서 떨어진다」
    x.fillStyle = S.line; x.fillRect(tx * px, (ty + 1) * px + face - lip, px, lip); }        // 발치 그늘
  const wallAt = (tx, ty) => inB(tx, ty) && T.w[ty * C + tx] > 0;
  layer(wallAt, sheets.wall);
  // 🧱 벽도 앞면을 갖는다 — 평평한 판은 「못 지나간다」로 안 읽힌다(2026-09-10 실측)
  { const S = TERR_SKIN.wall, wf = Math.round(px * TERR_FACE_K * 0.8), lip = Math.max(1, px * 0.09);
    for(let ty = 0; ty < W; ty++) for(let tx = 0; tx < C; tx++){
      if(!wallAt(tx, ty) || wallAt(tx, ty + 1)) continue;
      x.fillStyle = S.face; x.fillRect(tx * px, (ty + 1) * px, px, wf);
      x.fillStyle = S.lip;  x.fillRect(tx * px, (ty + 1) * px, px, lip);
      x.fillStyle = S.line; x.fillRect(tx * px, (ty + 1) * px + wf - lip, px, lip); } }
  T.bake = cv; return cv; }

// ── 화면에 그리기 ──────────────────────────────────────────────────────────
/* 캔버스는 **`.bmap` 안 · z-index 1**(⛰ 옛 .bHill 과 같은 자리 = 「지형은 엔티티 아래」).
 *   ⚠ `renderBuildTab` 이 #cstMain 을 innerHTML 로 통째로 갈아 끼우므로 매 프레임 사라진다 —
 *     같은 요소를 **다시 꽂는다**(떼어 낸 캔버스는 그림을 그대로 갖고 있다). ⛔ 새로 만들지 말 것. */
let _terrCv = null;
function campTerrCanvas(){
  const map = document.querySelector('#cstMain .bmap'); if(!map) return null;
  if(!_terrCv){ _terrCv = document.createElement('canvas'); _terrCv.className = 'bmapTerr'; }
  if(_terrCv.parentNode !== map){ const fl = map.querySelector('.bmapFloor');
    if(fl && fl.nextSibling) map.insertBefore(_terrCv, fl.nextSibling); else map.insertBefore(_terrCv, map.firstChild); }
  return _terrCv; }
/* 🌫 켜고 끄기 — 던전이면 만들고 캠프(집)면 버린다. campFogSync 와 같은 규약. */
function campTerrOn(){ return (typeof campDgN === 'function') && campDgN() > 0; }
/* ⭐ **범위는 안개에서 받아 온다**(`G.tech.fog.wy0/wy1`).
 *   ⛔ `campFogTop()` 을 여기서 다시 부르지 말 것 — 그 값은 적 기지 배치의 흔들림을 타서
 *     프레임마다 미세하게 달라진다. 서명이 그때마다 바뀌면 **매 프레임 다시 굽는다**
 *     (1200×2000 캔버스 + 조각 15,000개 · 2026-09-10 에 스모크가 통째로 멎었다).
 *   ⭐ 덤으로 **격자가 안개와 정확히 같아진다** — 2단계(시야 차단)의 전제다. */
function campTerrSync(){
  const f = (typeof G !== 'undefined' && G.tech) ? G.tech.fog : null;
  // ⚠ 안개가 **꺼져 있어도** 지형은 남는다 — 격자만 빌리는 것이지 안개에 딸린 층이 아니다.
  //   (던전인가는 campTerrOn 이 판단한다 · 던전에 들어가면 campFogSync 가 늘 먼저 판다.)
  if(!campTerrOn() || !f){
    CAMPT = null; if(_terrCv && _terrCv.parentNode) _terrCv.parentNode.removeChild(_terrCv);
    // 🧹 **집으로 돌아왔으면 안개의 고저도 걷는다**(2026-09-10 스모크가 잡았다).
    //   `campFogSync` 는 캠프에서 `f.on=false` 로 끄기만 하고 배열은 그대로 둔다 — 그러면
    //   **절벽이 데이터에 남아** 나중에 안개를 켜는 순간(관리자 탭·다음 던전) 없는 벽이 시야를 막는다.
    //   ⚠ **우리가 심어 둔 것일 때만** 지운다 — 안 그러면 관리자 탭의 테스트 언덕(TECH_HILL)까지 지운다.
    if(_terrPushed && f){ f.height.fill(0); _terrPushed = false; }
    return false; }
  const C0 = (typeof campState === 'function') ? campState() : null;
  const dg = campDgN(), seed = (C0 && C0.foeSeed) || 1;
  const wy0 = (f.wy0 == null ? 0 : f.wy0), wy1 = (f.wy1 == null ? 1 : f.wy1);
  const sig = dg + '/' + seed + '/' + f.cols + 'x' + f.rows + '/' + wy0.toFixed(4);
  if(CAMPT && CAMPT.sig === sig) return true;
  campTerrInit(wy0, wy1, f.rows); campTerrGen(dg, seed); CAMPT.sig = sig;
  campTerrPushHeight(f);   // 👁 지형이 새로 생겼으면 안개의 고저도 갈아 끼운다(씨앗이 바뀌면 절벽 자리도 바뀐다)
  return true; }
/* ══ 👁 시야 차단 — 안개에 고저를 준다 (2026-09-10 · 2단계) ═══════════════════════════
 *   ⭐ **막는 일은 이미 엔진이 한다** — `_fogReveal` 의 `if(!air && fogHeightAt(...)>vh) continue;`
 *     한 줄이 「저지 → 고지」를 이미 자르고 있었다. 지금까지 그 배열이 **비어 있었을 뿐**이다
 *     (캠프는 `techFogInit(..., {flat:true})` 로 관리자 테스트 언덕조차 꺼 두었다).
 *     그래서 2단계에 새로 만든 것은 **배열을 채우는 함수 둘**뿐이다. ⛔ 차단 규칙을 새로 짜지 말 것.
 *   🚪 **램프는 「낮은 쪽」으로 친다.** 비탈이니 아래에서 보이는 것이 맞고, 그래야 올라갈 길이 보인다.
 *     ⛔ 램프를 고지로 치지 말 것 — 통로가 통째로 어둠에 잠겨 「어디로 올라가나」가 사라진다.
 *     ⚠ 그래서 램프 위에 선 유닛은 아직 고원을 못 본다. 램프를 다 올라 **고원 칸을 밟는 순간**
 *       시야가 열린다 — 능선을 넘는 그 느낌이 의도한 것이다.
 *   ⚠ 공중 유닛은 지형을 무시한다(엔진이 `air` 로 이미 가른다). */
let _terrPushed = false;   // 우리가 안개에 고저를 심어 두었나(집으로 돌아갈 때 걷기 위해)
function campTerrPushHeight(fog){
  const f = fog || ((typeof G !== 'undefined' && G.tech) ? G.tech.fog : null);
  const T = CAMPT;
  if(!f || !T || T.cols !== f.cols || T.rows !== f.rows) return 0;
  let n = 0;
  for(let i = 0; i < f.height.length; i++){
    const h = T.r[i] ? 0 : T.h[i];   // 🚪 램프 = 비탈 → 낮은 쪽
    f.height[i] = h; if(h) n++; }
  _terrPushed = true;
  return n; }
/* 👁 **엔진이 부르는 훅** — `techFogInit` 이 격자를 새로 판 직후. 캠프 밖에서는 스스로 빠진다.
 *   ⚠ 여기서 `campTerrSync` 만 부르고 끝내면 안 된다 — 지형 서명이 그대로면 sync 는 아무것도
 *     안 하는데, **안개는 방금 새로 파여 높이가 0**이다. 그래서 늘 다시 밀어 넣는다. */
function campTerrHeightFill(f){
  if(!f || !campTerrSync()) return 0;
  return campTerrPushHeight(f); }

/* ══ 🚶 길막기 — 전장 흐름장 (2026-09-11 · 3단계) ══════════════════════════════════
 * ⛔ **먼저 두 번 실패했다. 되돌리기 전에 여기를 읽을 것.**
 *   ① 2026-09-05 — 건물을 「원형 장애물」로 만들어 국소 회피에 맡겼다 → **아군이 갇혔다**
 *     (의무병이 아군에게서 1152 → 1387 로 멀어졌다 · 19-camp.js 3017). 길찾기가 없으면 뒤로 길이 안 난다.
 *   ② 2026-09-10 — 지형을 **`_techNavRects` 에 얹어** 기지의 A\*(`_techFindPath`)를 빌리려 했다 →
 *     **또 갇혔다.** 원인은 그 함수가 **기지 격자 전용**이라는 것이다: 노드를 고를 때 `p[1]>0.12` 로
 *     거르므로(16-build.js) **격자 위 지형의 꼭짓점이 전부 버려진다** — 장애물은 보되 **돌아갈 모서리가
 *     하나도 안 생긴다.** 실측 A/B 6판: 지형 끔 6/6 전진 · 지형 켬 **4/6**(두 판은 반대로 가서 굳었다).
 *   ⛔ 그래서 지형을 `_techNavRects` 에 넣지 말 것. 16-build.js 도 못 고친다(관리자 탭·오토배틀 공유).
 *
 * ⭐ **그래서 전장은 제 길찾기를 갖는다 — 지형 격자 위의 흐름장이다.**
 *   목적지 칸마다 **BFS 거리 지도**를 한 장 만들고(캐시), 유닛은 제 칸에서 **내리막**만 따라간다.
 *   · 유닛 수에 비례하지 않는다(지도 한 장을 전군이 나눠 읽는다)
 *   · y 제한이 없다(격자 위 적 기지까지 같은 격자다)
 *   · 지형은 안 변하니 목적지당 **한 번만** 계산한다
 *   ⚠ **목표를 바꾸기만 한다** — 그 뒤의 건물 회피(`_techFindPath`)는 그대로 돈다. 두 길찾기가
 *     각자 제 일만 한다: 지형은 흐름장, 건물은 A\*. ⛔ 하나로 합치려 하지 말 것.
 *   ⚠ **밀어내기는 하지 않는다** — 억지로 밀려 들어간 유닛도 흐름을 타고 스스로 나온다(①의 교훈).
 */
const TERR_WAY_STEPS = 28;    // 흐름을 따라 앞을 내다보는 칸 수(끈 당기기)
const TERR_FLOW_KEEP = 8;     // 들고 있는 흐름장 수(목적지별)
const TERR_SEG_MAX   = 160;   // 직선 판정에서 찍어 보는 점의 상한

function campTerrIdxAt(gx, gy){
  const T = CAMPT; if(!T) return -1;
  const C = T.cols, W = T.rows;
  const x = Math.floor(gx * C), y = Math.floor(((gy - T.wy0) / (T.wy1 - T.wy0)) * W);
  return (x < 0 || y < 0 || x >= C || y >= W) ? -1 : y * C + x; }
function campTerrCellMid(i){
  const T = CAMPT, C = T.cols, W = T.rows;
  return { gx: ((i % C) + 0.5) / C, gy: T.wy0 + ((((i / C) | 0) + 0.5) / W) * (T.wy1 - T.wy0) }; }
/* 직선이 지형에 막히나 — 칸 해상도로 찍어 본다(⚠ 매 프레임 유닛마다 불린다: 상한을 둔다). */
function campTerrSegBlocked(x0, y0, x1, y1){
  const T = CAMPT; if(!T) return false;
  const m = campTerrMask(), C = T.cols, W = T.rows, span = T.wy1 - T.wy0;
  const n = Math.max(2, Math.min(TERR_SEG_MAX,
    Math.ceil(Math.max(Math.abs(x1 - x0) * C, (Math.abs(y1 - y0) / span) * W) * 1.5)));
  for(let k = 0; k <= n; k++){ const t = k / n;
    const x = Math.floor((x0 + (x1 - x0) * t) * C);
    const y = Math.floor((((y0 + (y1 - y0) * t) - T.wy0) / span) * W);
    if(x < 0 || y < 0 || x >= C || y >= W) continue;
    if(m[y * C + x]) return true; }
  return false; }
/* 목적지 칸 → 거리 지도(BFS). ⚠ 목적지가 막힌 칸이면(건물이 절벽 테두리에 섰다) **둘레에서** 시작한다. */
function campTerrFlow(goal){
  const T = CAMPT; if(!T) return null;
  if(!T._flow) T._flow = new Map();
  const hit = T._flow.get(goal); if(hit) return hit;
  const C = T.cols, W = T.rows, n = C * W, m = campTerrMask();
  const dist = new Int32Array(n).fill(-1), q = [];
  const seed = i => { if(i >= 0 && i < n && dist[i] < 0 && !m[i]){ dist[i] = 0; q.push(i); } };
  seed(goal);
  if(!q.length){ const gx = goal % C, gy = (goal / C) | 0;
    for(let r = 1; r <= 4 && !q.length; r++)
      for(let dy = -r; dy <= r; dy++) for(let dx = -r; dx <= r; dx++){
        if(Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = gx + dx, y = gy + dy; if(x < 0 || y < 0 || x >= C || y >= W) continue;
        seed(y * C + x); } }
  for(let p = 0; p < q.length; p++){
    const i = q[p], x = i % C, y = (i / C) | 0, d = dist[i] + 1;
    if(x > 0    && dist[i - 1] < 0 && !m[i - 1]){ dist[i - 1] = d; q.push(i - 1); }
    if(x < C - 1 && dist[i + 1] < 0 && !m[i + 1]){ dist[i + 1] = d; q.push(i + 1); }
    if(y > 0    && dist[i - C] < 0 && !m[i - C]){ dist[i - C] = d; q.push(i - C); }
    if(y < W - 1 && dist[i + C] < 0 && !m[i + C]){ dist[i + C] = d; q.push(i + C); } }
  if(T._flow.size >= TERR_FLOW_KEEP) T._flow.delete(T._flow.keys().next().value);
  T._flow.set(goal, dist);
  return dist; }
function _terrDownhill(i, d){
  const T = CAMPT, C = T.cols, W = T.rows, x = i % C, y = (i / C) | 0;
  let best = -1, bd = d[i];
  const try_ = j => { if(j >= 0 && j < C * W && d[j] >= 0 && d[j] < bd){ bd = d[j]; best = j; } };
  if(x > 0) try_(i - 1); if(x < C - 1) try_(i + 1);
  if(y > 0) try_(i - C); if(y < W - 1) try_(i + C);
  return best; }
/* 🚶 **다음에 향할 지점** — 지형이 직선을 안 막으면 `null`(아무것도 안 바꾼다).
 *   막으면 흐름을 따라가며 **직선이 통하는 가장 먼 칸**을 돌려준다(끈 당기기 — 계단식 경로 제거). */
function campTerrWay(gA, gB){
  const T = CAMPT; if(!T) return null;
  if(!campTerrSegBlocked(gA.gx, gA.gy, gB.gx, gB.gy)) return null;
  const goal = campTerrIdxAt(gB.gx, gB.gy), from = campTerrIdxAt(gA.gx, gA.gy);
  if(goal < 0 || from < 0) return null;
  const d = campTerrFlow(goal); if(!d) return null;
  let cur = from;
  if(d[cur] < 0){                       // 내가 막힌 칸에 밀려 들어갔다 → 가장 가까운 갈 수 있는 칸으로
    const C = T.cols, W = T.rows, x = cur % C, y = (cur / C) | 0; let pick = -1, pd = 1e9;
    for(let r = 1; r <= 3 && pick < 0; r++)
      for(let dy = -r; dy <= r; dy++) for(let dx = -r; dx <= r; dx++){
        const nx = x + dx, ny = y + dy; if(nx < 0 || ny < 0 || nx >= C || ny >= W) continue;
        const j = ny * C + nx; if(d[j] < 0 || d[j] >= pd) continue; pd = d[j]; pick = j; }
    if(pick < 0) return null; cur = pick; }
  let best = -1, first = -1, step = cur;
  for(let k = 0; k < TERR_WAY_STEPS; k++){
    const nx = _terrDownhill(step, d); if(nx < 0) break; step = nx;
    if(first < 0) first = nx;
    const p = campTerrCellMid(step);
    if(campTerrSegBlocked(gA.gx, gA.gy, p.gx, p.gy)) break;   // 여기서부터는 안 보인다 → 앞의 것이 답
    best = step;
    if(d[step] === 0) break; }
  /* ⚠ **한 칸도 안 보여도 포기하지 않는다.** 벽에 바싹 붙어 서면 바로 옆 칸의 **중심까지도**
   *   선이 벽 모서리를 스쳐 「안 보인다」가 된다. 거기서 null 을 주면 직선으로 벽을 밀고,
   *   이동 물리의 진행도 창(`_pgHold`)이 걸려 **그대로 선다**(실측 8판 중 1판 · 2026-09-11).
   *   바로 옆 칸은 어차피 붙어 있으니 그냥 준다 — 한 걸음이라도 흐름을 타면 곧 풀린다. */
  if(best < 0) best = first;
  return best < 0 ? null : campTerrCellMid(best); }

/* 매 프레임 — 구운 그림 한 장을 뷰 사각형에 확대해 그린다(techFogDraw 와 같은 식). */
function campTerrDraw(){
  if(!campTerrSync()) return false;
  const cv = campTerrCanvas(), map = document.getElementById('cstMain'); if(!cv || !map) return false;
  const W = map.clientWidth || 360, H = map.clientHeight || 480;
  if(cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
  const x = cv.getContext('2d'); x.clearRect(0, 0, W, H);
  const T = CAMPT, bake = T.bake || campTerrBake(); if(!bake) return false;
  const tl = _techW2S(0, T.wy0), br = _techW2S(1, T.wy1);
  x.imageSmoothingEnabled = true;
  x.drawImage(bake, tl.x * W, tl.y * H, (br.x - tl.x) * W, (br.y - tl.y) * H);
  return true; }
