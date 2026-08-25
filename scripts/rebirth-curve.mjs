#!/usr/bin/env node
// 환생 곡선 계산기 — HUNT_R1.md §4-2 · §4-4 · §6-1 의 표를 만드는 원본.
// 숫자를 바꾸려면 여기 상수를 고치고 다시 돌린 뒤 문서 표를 갱신할 것.
//   node scripts/rebirth-curve.mjs            기본값
//   node scripts/rebirth-curve.mjs 0.006 4.5  라운드밑 상승폭 · 티어 배수 바꿔서 비교

const RB0        = 1.09;                       // 던전 1 라운드 밑
const RB_STEP    = Number(process.argv[2] ?? 0.004);  // 던전당 라운드 밑 상승폭
const DG_STEP    = 1.5;                        // 던전 문턱 (앞 던전 50라운드분 위에 얹는 배수)
const TIER_MUL   = Number(process.argv[3] ?? 4);      // 티어당 노드 비용 배수
const TIER_N     = 20, NODES_PER_TIER = 8, NODE_BASE = 2;
const TRIES      = 6;                          // 티어 하나를 몇 회 환생으로 채운다고 보는가
const ROUNDS     = 50, DUNGEONS = 10;
const K_MUL      = 0.8;                        // 획득 배수 = K × log10(난이도)

const rbase = d => RB0 + (d - 1) * RB_STEP;
const dgStep = d => Math.pow(rbase(d - 1), ROUNDS - 1) * DG_STEP;
function diff(d, r){ let x = 1; for(let k = 2; k <= d; k++) x *= dgStep(k); return x * Math.pow(rbase(d), r - 1); }
const gainMul = (d, r) => K_MUL * Math.log10(diff(d, r));
const gainPts = (d, r) => 2 * Math.sqrt(diff(d, r));
const nodeCost = t => NODE_BASE * Math.pow(TIER_MUL, t - 1);

const F = n => { if(n < 1e4) return n.toFixed(n < 100 ? (n < 10 ? 2 : 1) : 0);
  for(const [s, v] of [['해',1e20],['경',1e16],['조',1e12],['억',1e8],['만',1e4]]) if(n >= v) return (n/v).toFixed(1)+s;
  return n.toFixed(0); };
const pad = (s, n) => String(s).padEnd(n);

console.log(`라운드밑 ${RB0} → ${rbase(DUNGEONS).toFixed(3)} (+${RB_STEP}/던전) · 던전 문턱 ×${DG_STEP} · 티어당 ×${TIER_MUL}\n`);

console.log('=== 던전별 (§6-1-0) ===');
console.log('던전  라운드밑  라운드1칸  R1포인트   R50포인트  포인트계단  R50난이도');
for(let d = 1; d <= DUNGEONS; d++){
  const step = d === 1 ? '-' : (gainPts(d,1)/gainPts(d-1,ROUNDS)).toFixed(2)+'배';
  console.log(`D${pad(d,4)}${pad(rbase(d).toFixed(3),9)} ${pad('+'+(Math.sqrt(rbase(d))*100-100).toFixed(1)+'%',10)} ${pad(F(gainPts(d,1)),10)} ${pad(F(gainPts(d,ROUNDS)),10)} ${pad(step,11)} ${F(diff(d,ROUNDS))}`);
}

console.log('\n=== 환생 보상 (§4-2) ===');
console.log('도달       난이도       획득배수   획득포인트');
for(const [d, r] of [[3,1],[3,50],[5,50],[7,50],[9,50],[10,25],[10,50]])
  console.log(`D${pad(d+' R'+r,10)}${pad(F(diff(d,r)),13)}+${pad(gainMul(d,r).toFixed(2),10)}${F(gainPts(d,r))}`);

console.log('\n=== 티어가 열리는 시점 (§4-4-3) ===');
let cum = 0;
for(let t = 1; t <= TIER_N; t++){
  cum += nodeCost(t) * NODES_PER_TIER;
  let reach = '— (10던전 안에서 못 연다)';
  outer: for(let d = 1; d <= DUNGEONS; d++) for(let r = 1; r <= ROUNDS; r++)
    if(gainPts(d, r) * TRIES >= cum){ reach = `던전 ${d} R${r}`; break outer; }
  console.log(`T${pad(t,3)} 노드 ${pad(F(nodeCost(t)),10)} 누적 ${pad(F(cum),10)} → ${reach}`);
}
