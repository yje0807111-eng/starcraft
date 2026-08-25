#!/usr/bin/env node
// 환생 곡선 계산기 — HUNT_R1.md §4-1 · §4-2 · §4-4 · §4-6 · §6-1 의 표를 만드는 원본.
// 숫자를 바꾸려면 여기 상수를 고치고 다시 돌린 뒤 문서 표를 갱신할 것.
//   node scripts/rebirth-curve.mjs            전체 표
//   node scripts/rebirth-curve.mjs 3.5 4.5    던전 문턱 · 티어 배수를 바꿔서 비교

// --- 난이도 (§6-1) : 라운드는 완만하게 · 던전 문턱은 크게 ---
const RB0      = 1.07;                                 // 던전 1 라운드 밑
const RB_STEP  = 0.003;                                // 던전당 라운드 밑 상승폭
const DG_STEP  = Number(process.argv[2] ?? 3);         // 던전 문턱 (앞 던전 50라운드분 위에 얹는 배수)

// --- 미네랄 배율 (§6-1) : 라운드당 증가폭이 던전마다 커진다 ---
// ⛔ ×2^(던전-1) 로 두면 던전 5 부터 문턱에서 배율이 '내려간다'(라운드 보너스가 계단을 앞지른다).
//    그래서 난이도와 같은 방식으로 「앞 던전 R50 × 문턱」에서 이어붙인다.
const M_BASE   = 1.5;                                  // 던전 1 R1
const M_STEP   = 1.5;                                  // 미네랄 문턱 (앞 던전 R50 대비)
const M_C0     = 0.0067;                               // 던전 1 의 라운드당 증가 비율
const M_C_STEP = 0.004;                                // 던전당 그 비율이 얼마나 커지는가

// --- 환생 보상 (§4-2) : 기준량은 재화가 키우고, 깊이 배수는 완만하게 ---
const V0       = 1e6;                                  // 기준선 = 누적 100만 (첫 환생 관문 · 플레이 약 10시간)
const GAS_RATE = 8;                                    // 재화점수에서 가스 1 = 미네랄 몇인가
const P_DG     = 1.35;                                 // 포인트 던전 배수
const P_RD     = 1.012;                                // 포인트 라운드 배수
const K_MUL    = 0.8, MUL_MIN = 0.2;                   // 획득 배수 = max(MUL_MIN, K × log10(난이도))

// --- 트리 (§4-4) ---
const TIER_MUL = Number(process.argv[3] ?? 4);         // 티어당 노드 기준값 배수
const TIER_N   = 20, NODE_BASE = 2;
const TRIES    = 6;                                    // 티어 하나를 몇 회 환생으로 채운다고 보는가
const ROUNDS   = 50, DUNGEONS = 10;
// 티어 안 8노드의 등급 구성 — 일반 티어 4·3·1, 이정표 티어(5의 배수)는 귀함이 극상으로 바뀐다
const GRADE      = { 흔함: 0.5, 보통: 1, 귀함: 3, 극상: 10 };
const MIX        = { 흔함: 4, 보통: 3, 귀함: 1 };
const MIX_MILE   = { 흔함: 4, 보통: 3, 극상: 1 };
const isMile     = t => t % 5 === 0;
const tierFactor = t => Object.entries(isMile(t) ? MIX_MILE : MIX).reduce((a,[g,n]) => a + GRADE[g]*n, 0);

const rbase   = d => RB0 + (d - 1) * RB_STEP;
const dgStep  = d => Math.pow(rbase(d - 1), ROUNDS - 1) * DG_STEP;
function diff(d, r){ let x = 1; for(let k = 2; k <= d; k++) x *= dgStep(k); return x * Math.pow(rbase(d), r - 1); }
const mCoef    = d => M_C0 + (d - 1) * M_C_STEP;
const M_BASE_D = (() => { const b = [0, M_BASE];
  for(let d = 2; d <= DUNGEONS; d++) b[d] = b[d-1] * (1 + (ROUNDS-1)*mCoef(d-1)) * M_STEP;
  return b; })();
const mineral  = (d, r) => M_BASE_D[d] * (1 + (r - 1) * mCoef(d));
// 재화 누적은 난이도에 비례한다고 본다 — 그 난이도를 이길 군대를 미네랄로 사기 때문. ⚠ 실측 필요(§5 D)
const wealth   = (d, r) => V0 * diff(d, r);
const gainPts  = (d, r) => Math.sqrt(wealth(d, r) / V0) * Math.pow(P_DG, d - 1) * Math.pow(P_RD, r - 1);
const gainMul  = (d, r) => Math.max(MUL_MIN, K_MUL * Math.log10(diff(d, r)));
const nodeBase = t => NODE_BASE * Math.pow(TIER_MUL, t - 1);
const tierCost = t => nodeBase(t) * tierFactor(t);

const F = n => { if(n < 1e4) return n.toFixed(n < 100 ? (n < 10 ? 2 : 1) : 0);
  for(const [s, v] of [['해',1e20],['경',1e16],['조',1e12],['억',1e8],['만',1e4]]) if(n >= v) return (n/v).toFixed(1)+s;
  return n.toFixed(0); };
const P = (s, n) => String(s).padEnd(n);

console.log(`라운드밑 ${RB0} → ${rbase(DUNGEONS).toFixed(3)} (+${RB_STEP}/던전) · 던전 문턱 ×${DG_STEP} · 티어당 ×${TIER_MUL}`);
console.log(`포인트 = √(재화점수 ÷ ${F(V0)}) × ${P_DG}^(던전-1) × ${P_RD}^(라운드-1)  ·  재화점수 = 누적 미네랄 + 누적 가스 × ${GAS_RATE}`);

console.log('\n=== A. 던전별 (§4-6-A) ===');
console.log('던전 라운드밑 문턱  미네랄R1   미네랄R50  R50÷R1  난이도R1     난이도R50    포인트R1   포인트R50');
for(let d = 1; d <= DUNGEONS; d++)
  console.log(`D${P(d,3)} ${P(rbase(d).toFixed(3),8)} ${P(d===1?'-':'×'+(diff(d,1)/diff(d-1,ROUNDS)).toFixed(2),6)} ${P('×'+mineral(d,1).toFixed(2),10)} ${P('×'+mineral(d,ROUNDS).toFixed(2),10)} ${P((mineral(d,ROUNDS)/mineral(d,1)).toFixed(2)+'배',7)} ${P(F(diff(d,1)),12)} ${P(F(diff(d,ROUNDS)),12)} ${P(F(gainPts(d,1)),10)} ${F(gainPts(d,ROUNDS))}`);

console.log('\n=== B. 던전 안에서 라운드가 오를 때 (§4-6-B) ===');
for(const d of [1, 5, DUNGEONS]){
  console.log(` 던전 ${d} (라운드밑 ${rbase(d).toFixed(3)} · 난이도 +${((rbase(d)-1)*100).toFixed(1)}%/칸 · 미네랄 +${F(M_BASE_D[d]*mCoef(d))}/칸 · 포인트 +${(Math.sqrt(rbase(d))*P_RD*100-100).toFixed(1)}%/칸 · 50라운드 누적 난이도 ×${F(Math.pow(rbase(d),ROUNDS-1))})`);
  console.log('   라운드  미네랄배율  적 난이도    환생 포인트');
  for(const r of [1,10,20,30,40,50])
    console.log(`   R${P(r,7)}${P('×'+mineral(d,r).toFixed(2),12)}${P(F(diff(d,r)),13)}${F(gainPts(d,r))}`);
}

console.log('\n=== C. 환생 보상 격자 — 「획득 배수 / 획득 포인트」 (§4-6-C) ===');
process.stdout.write('던전   '); for(const r of [1,10,20,30,40,50]) process.stdout.write(P('R'+r,17)); console.log();
for(let d = 1; d <= DUNGEONS; d++){ process.stdout.write(P('D'+d,7));
  for(const r of [1,10,20,30,40,50]) process.stdout.write(P(`+${gainMul(d,r).toFixed(2)} / ${F(gainPts(d,r))}`,17)); console.log(); }

console.log('\n=== D. 티어 비용과 열리는 시점 (§4-4-3) ===');
console.log('티어 기준값     흔함×0.5   보통×1     귀함×3     극상×10    티어총합   누적       열리는 시점  그때 환생');
let cum = NODE_BASE;   // 시작점 노드
for(let t = 1; t <= TIER_N; t++){
  const b = nodeBase(t); cum += tierCost(t);
  let open = `D${DUNGEONS} R${ROUNDS} 이후`, tries = '-';
  outer: for(let d = 1; d <= DUNGEONS; d++) for(let r = 1; r <= ROUNDS; r++)
    if(gainPts(d, r) * TRIES >= cum){ open = `던전 ${d} R${r}`; tries = (tierCost(t)/gainPts(d,r)).toFixed(1)+'회'; break outer; }
  console.log(`T${P(t,3)} ${P(F(b),10)} ${P(F(b*0.5)+' ×4',10)} ${P(F(b)+' ×3',10)} ${P(isMile(t)?'-':F(b*3)+' ×1',10)} ${P(isMile(t)?F(b*10)+' ×1':'-',10)} ${P(F(tierCost(t)),10)} ${P(F(cum),10)} ${P(open,12)} ${tries}`);
}
console.log(`\n트리 전체 ${F(cum)} 포인트 · 노드 ${1 + TIER_N*8}개 (시작점 1 + ${TIER_N}티어 × 8)`);
console.log(`마지막 티어 T${TIER_N} 은 던전 ${DUNGEONS} R${ROUNDS} 에서 ${(tierCost(TIER_N)/gainPts(DUNGEONS,ROUNDS)).toFixed(1)}회 환생 — 의도된 최종 반복 구간이다.`);
