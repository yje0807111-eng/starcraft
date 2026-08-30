/* ============================================================================
 * camp-analyze.mjs — camp-bench 출력에서 성장 지수와 순환을 뽑는다 (2026-08-29)
 *
 * ⚠ 왜 따로 두는가 — 벤치는 **재는 도구**이고 이건 **읽는 도구**다.
 *   같은 출력을 여러 번 다시 계산하게 되는데, 그때마다 손으로 세면 틀린다.
 *
 * ⭐ 뽑는 것 셋 (sc-3 요청 · HUNT_R1 §4-2-0 검증용)
 *   ① 한 던전에 **머무는 동안**의 성장 지수      ← 던전 이동이 안 섞인 값
 *   ② 던전 이동을 포함한 **전체** 지수            ← 지금 쓰이는 3.4 와 비교
 *   ③ 던전별 순환 — 몇 번 내려갔다 올라와야 뚫리는가 · 한 순환에 걸린 시간
 *
 * ⛔ 「그럴듯한 값」을 그대로 믿지 않는다 — 표본이 적으면 적다고 찍는다.
 *
 * 사용: node scripts/camp-analyze.mjs <벤치출력파일>
 * ========================================================================== */
import fs from 'node:fs';

const FILE = process.argv[2];
if(!FILE || !fs.existsSync(FILE)){ console.error('사용: node scripts/camp-analyze.mjs <벤치출력파일>'); process.exit(2); }
// ⚠ 진행 줄은 \r 로 덮어쓰며 찍힌다 — 개행으로 바꿔야 한 줄씩 읽힌다
const TXT = fs.readFileSync(FILE, 'utf8').replace(/\r/g, '\n');
const LINES = TXT.split('\n');

// ── ① 진행 줄 → 던전 타임라인 ──────────────────────────────────────────
//   "  342.3분 · D2R50 · 번돈 … 아군 83(대기 0) · 깬라운드 537"
const prog = [];
for(const l of LINES){
  const m = l.match(/([0-9.]+)분 · D(\d+)R(\d+) ·.*?아군 (\d+)\(대기 (\d+)\)/);
  if(m) prog.push({ t:+m[1], dg:+m[2], r:+m[3], me:+m[4], wait:+m[5] });
}

// 던전이 바뀌는 지점만 남긴다(같은 던전이 이어지면 한 덩이)
const spans = [];
for(const p of prog){
  const last = spans[spans.length - 1];
  if(!last || last.dg !== p.dg) spans.push({ dg:p.dg, t0:p.t, t1:p.t, rMax:p.r });
  else { last.t1 = p.t; if(p.r > last.rMax) last.rMax = p.r; }
}

// ── ② 30분 표 → 성장 지수 ──────────────────────────────────────────────
//   "  120  | D2R33 |     123456 |    789 |    456 |     12 |    1234 | 85"
const slow = [];
for(const l of LINES){
  const m = l.match(/^\s*(\d+)\s+\|\s*D(\d+)R(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([0-9.]+)\s*\|\s*(\d+)\s*$/);
  if(m) slow.push({ t:+m[1], dg:+m[2], r:+m[3], min:+m[4], gas:+m[5], res:+m[6], ref:+m[7], dps:+m[8], me:+m[9] });
}

// 지수 — y = k·t^n 이면 n = Δln(y) / Δln(t). 두 끝점으로 잰다.
function expo(a, b, key){
  if(!a || !b || a.t <= 0 || b.t <= a.t) return null;
  const y0 = a[key], y1 = b[key];
  if(!(y0 > 0) || !(y1 > 0)) return null;
  return Math.log(y1 / y0) / Math.log(b.t / a.t);
}

console.log('■ 표본 — 진행 ' + prog.length + '줄 · 30분 표 ' + slow.length + '행 · 던전 구간 ' + spans.length + '개');
if(!slow.length) console.log('  ⚠ 30분 표가 없다(측정이 중간에 끊겼을 수 있다) — 지수는 건너뛴다');

// ── ①  한 던전에 머무는 동안의 지수 ────────────────────────────────────
console.log('');
console.log('■ ① 한 던전에 머무는 동안의 성장 지수 (던전 이동 없음)');
console.log('던전 | 구간(분)      | 표본 | 명목DPS      | 지수 n (DPS ∝ t^n)');
{
  const byDg = new Map();
  for(const s of slow){ if(!byDg.has(s.dg)) byDg.set(s.dg, []); byDg.get(s.dg).push(s); }
  let any = false;
  for(const [dg, rows] of [...byDg.entries()].sort((a, b) => a[0] - b[0])){
    if(rows.length < 2){ console.log(String(dg).padStart(4) + ' | 표본 ' + rows.length + '개 — 지수를 못 낸다'); continue; }
    const a = rows[0], b = rows[rows.length - 1];
    const n = expo(a, b, 'dps');
    any = true;
    console.log(String(dg).padStart(4) + ' | ' + String(a.t + '~' + b.t).padEnd(13) + ' | '
      + String(rows.length).padStart(4) + ' | ' + String(a.dps + ' → ' + b.dps).padEnd(12) + ' | '
      + (n == null ? '—' : n.toFixed(2))
      + (rows.length < 4 ? '   ⚠ 표본이 적다' : ''));
  }
  if(!any) console.log('  ⚠ 어느 던전도 30분 표본이 둘 이상 아니다 — 머무는 구간이 짧았다는 뜻이다');
}

// ── ②  전체 지수 ───────────────────────────────────────────────────────
console.log('');
console.log('■ ② 전체 지수 (던전 이동 포함 — 지금 쓰이는 3.4 와 비교할 값)');
if(slow.length >= 2){
  const a = slow[0], b = slow[slow.length - 1];
  for(const [k, nm] of [['dps', '명목 DPS'], ['res', '연구 총Lv'], ['min', '미네랄 누적'], ['gas', '가스 누적']]){
    const n = expo(a, b, k);
    console.log('  ' + nm.padEnd(12) + ' ' + String(a[k]).padStart(10) + ' → ' + String(b[k]).padStart(12)
      + '  · 지수 ' + (n == null ? '—' : n.toFixed(2)));
  }
  console.log('  (구간 ' + a.t + '~' + b.t + '분)');
} else console.log('  ⚠ 표본 부족');

// ── ③  던전별 순환 ─────────────────────────────────────────────────────
console.log('');
console.log('■ ③ 순환 — 몇 번 내려갔다 올라와야 뚫리는가');
{
  const deep = Math.max(...spans.map(s => s.dg), 0);
  console.log('  가장 깊이 간 던전: **D' + deep + '**');
  const byDg = new Map();
  for(const s of spans){ if(!byDg.has(s.dg)) byDg.set(s.dg, []); byDg.get(s.dg).push(s); }
  console.log('던전 | 방문 | 머문 시간(분) 합 | 한 번당 평균 | 도달 최고 라운드');
  for(const [dg, ss] of [...byDg.entries()].sort((a, b) => a[0] - b[0])){
    if(dg === 0) continue;
    const tot = ss.reduce((a, s) => a + (s.t1 - s.t0), 0);
    const rMax = Math.max(...ss.map(s => s.rMax));
    console.log(String(dg).padStart(4) + ' | ' + String(ss.length).padStart(4) + ' | '
      + String(tot.toFixed(1)).padStart(16) + ' | ' + String((tot / ss.length).toFixed(1)).padStart(12)
      + ' | R' + rMax);
  }
  // 가장 깊은 던전을 몇 번 두드렸나 — 「환생 없이 뚫는 비용」의 직접 값
  const top = byDg.get(deep) || [];
  if(top.length){
    console.log('');
    console.log('  ⭐ D' + deep + ' 재도전 ' + top.length + '번 · 진입 시각(분): '
      + top.map(s => s.t0.toFixed(0)).join(' → '));
    if(top.length > 1){
      const gaps = [];
      for(let i = 1; i < top.length; i++) gaps.push(top[i].t0 - top[i - 1].t0);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      console.log('  ⭐ 한 순환(다시 D' + deep + '에 오기까지) 평균 **' + avg.toFixed(1) + '분** · 각각 '
        + gaps.map(g => g.toFixed(0)).join(' · ') + '분');
    }
  }
}

// ── 벽 ─────────────────────────────────────────────────────────────────
{
  const i = LINES.findIndex(l => l.indexOf('🧱 벽 —') >= 0);
  console.log('');
  if(i >= 0){ console.log('■ 벽'); for(let k = i; k < Math.min(i + 6, LINES.length); k++) if(LINES[k].trim()) console.log('  ' + LINES[k].trim()); }
  else console.log('■ 벽 — 출력에 벽 절이 없다(측정이 끝까지 안 갔거나 벽을 안 만났다)');
}
