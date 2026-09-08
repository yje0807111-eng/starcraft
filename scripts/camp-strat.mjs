/* ============================================================================
 * camp-strat.mjs — 🎯 **「고를 게 있나」를 잰다** (2026-09-08 · 사용자 방향 확정)
 *
 * 왜 만들었나 — 이 게임의 설계 문서(GAME_DIRECTION §2-1)는 핵심 재미를 **「판단」**
 * (무엇을 지을까 · 무엇을 연구할까)이라고 못박아 놨다. 그런데 그것을 **한 번도 잰 적이 없다.**
 * camp-bench 의 옛 「구매 정책 A/B/C」는 셋 다 같은 ROI 순위를 쓰고 「돈이 모자랄 때
 * 기다리나」만 달라서, 갈릴 수가 없는 셋이었다.
 *
 * 무엇을 재나 — 서로 **진짜로 다른** 전략(camp-bench 의 STRATS)을 나란히 돌려
 *   ① 갈림도  결과가 얼마나 벌어지나 (최대÷최소)
 *   ② 벽      4분 넘긴 라운드 · 못 깬 지점
 *   ③ 첫 30분 그 시점에 어디까지 갔나
 * 를 한 표로 낸다.
 *
 * 📖 **읽는 법**  ⛔ 「갈림도가 클수록 좋다」가 아니다.
 *   갈림도 ≈1     무엇을 골라도 같다 → **판단이 없다**(지금 의심하는 것)
 *   갈림도 크다   한 전략만 정답 → **지배 빌드**(GAME_DIRECTION §2-5 안티 목표)
 *   그 사이       고를 이유가 있다 ← 목표
 *   ⚠ 그리고 **판마다 흔들린다**(전투 Math.random 43곳). SEED 를 주고 짝지어 볼 것.
 *
 * 사용:
 *   CHROME_PATH=... node scripts/camp-strat.mjs [시뮬분] [시작던전] [SEED]
 *   STRATS=bal,eco,army   — 돌릴 전략만 고른다(기본: 전부)
 *
 * ⚠ **벤치는 한 번에 하나씩** 돌린다(camp-bench 머리말) — 여기서도 순차로 돈다.
 *   그래서 오래 걸린다: 전략 7개 × 시뮬분. 90분짜리 7개면 몇 시간이다.
 * ========================================================================== */
import { spawn } from 'node:child_process';
import path from 'node:path'; import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const MINS = +(process.argv[2] || 45);
const DG0  = +(process.argv[3] || 1);
const SEED = +(process.argv[4] || 0);
const ALL  = ['e20', 'e35', 'e50', 'e65', 'e80', 'tap', 'gath', 'work', 'nors'];
const LIST = (process.env.STRATS || '').trim()
  ? process.env.STRATS.split(',').map(x => x.trim()).filter(Boolean) : ALL;

const run = (strat) => new Promise((res) => {
  const t0 = Date.now();
  const env = { ...process.env, STRAT: strat };
  if (SEED > 0) env.SEED = String(SEED);
  const p = spawn(process.execPath, [path.join(ROOT, 'scripts', 'camp-bench.mjs'), String(MINS), String(DG0)],
    { cwd: ROOT, env });
  let out = '', tail = '';
  p.stdout.on('data', d => { out += d; tail = (tail + d).slice(-4000); });
  p.stderr.on('data', d => { out += d; });
  p.on('close', () => {
    const m = /«BENCH» (\{.*\})/.exec(out);
    const secs = Math.round((Date.now() - t0) / 1000);
    if (!m) { console.log(`  ✘ ${strat} — 결과 줄이 없다(${secs}초). 마지막 출력:\n${tail.split('\n').slice(-6).map(l => '     ' + l).join('\n')}`);
      return res(null); }
    let j = null; try { j = JSON.parse(m[1]); } catch (e) { }
    if (!j) { console.log(`  ✘ ${strat} — 결과 줄을 못 읽었다`); return res(null); }
    // ⚠ 30분 표본은 **실제로 30분 근처**일 때만 인정한다 — 짧은 판에서 가장 가까운 표본을
    //   그냥 쓰면 3분짜리 값이 「30분 위치」로 둔갑한다(2026-09-08 실측에서 그랬다).
    if (j.m30 && Math.abs(j.m30.t - 1800) > 120) j.m30 = null;
    j.secs = secs;
    console.log(`  · ${strat.padEnd(5)} D${j.dg}R${j.round} · 번 돈 ${j.earn.toLocaleString()}`
      + (j.wall ? ` · 🧱 D${j.wall.dg}R${j.wall.r}` : '') + (j.froze ? ' · 🧊 얼어붙음' : '') + `  (${secs}초)`);
    res(j);
  });
});

console.log(`🎯 전략 갈림도 — ${MINS}시뮬분 · 던전 ${DG0} 시작` + (SEED ? ` · SEED ${SEED}` : ' · 씨앗 없음(판마다 흔들린다)'));
console.log(`   전략 ${LIST.length}개를 **하나씩** 돌린다(벤치는 겹치면 멎는다).\n`);

const rows = [];
for (const s of LIST) { const r = await run(s); if (r) rows.push(r); }

const ok = rows.filter(r => !r.froze);
if (!ok.length) { console.log('\n⛔ 쓸 수 있는 판이 없다.'); process.exit(1); }
// ⛔ **갈림도는 kind:'play' 로만 잰다.** 절단(탭만·채취만…)을 섞으면 「그 기둥을 뽑으면 망한다」가
//   「지배 전략이 있다」로 둔갑한다 — 2026-09-08 첫 실측에서 실제로 그렇게 틀렸다(×117 로 찍혔다).
const play = ok.filter(r => (r.kind || 'play') === 'play');
const abl  = ok.filter(r => r.kind === 'abl');

// 📊 표 — 사람이 읽는 순서: 어디까지 갔나 · 얼마나 벌었나 · 벽 · 첫 30분
const F = n => (n == null ? '-' : n.toLocaleString());
console.log('\n■ 📊 전략별 결과   (🔪 = 절단 실험 · 갈림도에 안 넣는다)');
console.log('전략   | 이름          | 끝난 곳  | 번 돈        | 30분 위치 | 30분 부 | 벽              | 10분+ 라운드');
for (const r of rows) {
  const nm = (r.kind === 'abl' ? '🔪 ' : '') + (r.nm || r.strat);
  console.log(r.strat.padEnd(6) + '| ' + nm.padEnd(13) + ' | '
    + ('D' + r.dg + 'R' + r.round).padEnd(8) + ' | ' + F(r.earn).padStart(12) + ' | '
    + (r.m30 ? ('D' + r.m30.dg + 'R' + r.m30.r) : '-').padEnd(9) + ' | '
    + (r.m30 ? F(r.m30.w) : '-').padStart(7) + ' | '
    + (r.wall ? ('D' + r.wall.dg + 'R' + r.wall.r + ' ' + Math.round(r.wall.sec / 60) + '분') : '없음').padEnd(15) + ' | '
    + (r.warns && r.warns.length ? r.warns.join(' ') : '없음')
    + (r.froze ? '   🧊 표본 제외' : ''));
}

// ① 갈림도 — 결과가 얼마나 벌어지나
const spread = (rowsIn, get) => {
  const v = rowsIn.map(get).filter(x => x != null && isFinite(x));
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  return { lo, hi, x: lo > 0 ? hi / lo : Infinity,
    loS: rowsIn.find(r => get(r) === lo).strat, hiS: rowsIn.find(r => get(r) === hi).strat };
};
// 진행도 = 던전과 라운드를 한 숫자로(던전 하나 = 라운드 50 어치).
//   ⚠ +1 은 **던전에 한 번도 못 들어간 판(D0R0)** 때문이다 — 0 이면 갈림도가 ÷0 이 된다.
//   그 판은 「아무 데도 못 갔다」라는 결과이지 표본 오류가 아니므로 빼지 않고 바닥값으로 둔다.
const prog = r => r.dg * 50 + r.round + 1;
console.log(`\n■ 🎯 갈림도 — 「고를 게 있나」  (사람이 고를 법한 ${play.length}개로만 잰다)`);
for (const [lab, get] of [['진행(던전R)', prog], ['번 돈', r => r.earn], ['30분 부', r => r.m30 && r.m30.w]]) {
  const s = spread(play, get);
  if (!s) { console.log('  ' + lab + ': 표본 부족'); continue; }
  console.log(`  ${lab.padEnd(11)} ×${s.x.toFixed(2)}   최저 ${s.loS}(${F(Math.round(s.lo))}) → 최고 ${s.hiS}(${F(Math.round(s.hi))})`);
}
if (abl.length) { console.log('\n■ 🔪 절단 — 이 기둥을 뽑으면 어떻게 되나 (「무엇이 게임을 떠받치나」)');
  const base = play.find(r => r.strat === 'e50') || play[0];
  for (const r of abl) console.log(`  ${(r.nm||r.strat).padEnd(10)} D${r.dg}R${r.round} · 번 돈 ${F(r.earn)}`
    + (base ? `   (기준 ${base.strat} 대비 진행 ×${(prog(r)/prog(base)).toFixed(2)} · 돈 ×${(r.earn/Math.max(1,base.earn)).toFixed(2)})` : '')
    + (r.wall ? `  🧱 D${r.wall.dg}R${r.wall.r} ${Math.round(r.wall.sec/60)}분` : '')); }
{ const s = spread(play, prog);
  const dead = ok.filter(r => r.dg === 0);
  console.log('\n■ 📖 읽기  (기준 = 진행도. 던전 하나 = 라운드 50 어치)');
  if (!s) console.log('  표본이 둘 미만이라 못 잰다.');
  else {
    const x = s.x;
    if (x < 1.15) console.log('  ⛔ **판단이 없다.** 무엇을 골라도 같은 곳에 도착한다 — 지금 의심하던 그대로다.');
    else if (x > 3) console.log(`  ⚠ **지배 전략이 있다**(${s.hiS} — 최저 ${s.loS}의 ×${x.toFixed(1)}). 나머지를 고를 이유가 없다 — 그것도 판단이 아니다.`);
    else console.log(`  ✅ 전략에 따라 ×${x.toFixed(2)} 갈린다(${s.loS} → ${s.hiS}) — 고를 이유가 있는 범위다.`); }
  if (dead.length) console.log(`  ⚠ 던전에 한 번도 못 들어간 전략: ${dead.map(r => r.strat).join(', ')} — 「못 간다」는 결과다(표본 오류가 아니다).`);
  console.log('  ⚠ 판마다 흔들린다(전투 난수 43곳). 한 번의 표로 결론짓지 말 것 — SEED 를 바꿔 두세 벌 볼 것.');
}
