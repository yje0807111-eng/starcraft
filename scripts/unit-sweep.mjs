/* 한 클립에서 후보 구간 여러 개를 뽑아 한 장으로 비교한다 — 눈으로 고르기 위한 도구.
 *
 *   node scripts/unit-sweep.mjs <영상> <출력폴더> [후보수=5]
 *
 * 왜 필요한가: 자동 선택 지표(--best 의 다리/몸통 점수, 크기·밝기 흔들림)로는
 * '걸음이 이어지는가'를 못 잡는다. 실제로 점수 1.51(최고)인 구간이 두 프레임만
 * 화질이 튀어 끊겨 보인 적이 있고, 그때 눈으로 고른 구간이 훨씬 나았다.
 * 그래서 후보를 나란히 깔아 주기만 하고 판단은 사람이 한다.
 *
 * 스트라이드 길이는 unit-frames.mjs 가 재 준 값을 --stride 로 넘긴다.
 * 안 넘기면 클립 길이/6 을 쓴다(대충 6걸음이 흔한 길이).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [VID, OUT, Ns] = process.argv.slice(2);
if (!VID || !OUT) { console.error('사용: node scripts/unit-sweep.mjs <영상> <출력폴더> [후보수=5] [--stride 초]'); process.exit(2); }
const N = parseInt(Ns && !Ns.startsWith('--') ? Ns : '5', 10);
const si = process.argv.indexOf('--stride');
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const FRAMES = path.join(HERE, 'unit-frames.mjs');

// 길이·스트라이드는 --scan 한 번으로 얻는다
const scan = execFileSync(process.execPath, [FRAMES, VID, '--scan'], { encoding: 'utf8' });
const dur = parseFloat((scan.match(/·\s*([\d.]+)초/) || [])[1] || '6');
const stride = si > 0 ? parseFloat(process.argv[si + 1])
  : parseFloat((scan.match(/한 스트라이드\s*([\d.]+)초/) || [])[1] || (dur / 6).toFixed(2));
console.log('길이 ' + dur.toFixed(2) + '초 · 스트라이드 ' + stride.toFixed(2) + '초 · 후보 ' + N + '개');

fs.mkdirSync(OUT, { recursive: true });
const starts = [];
for (let i = 0; i < N; i++) starts.push(+((dur - stride) * (i / (N - 1)) * 0.98).toFixed(2));

const dirs = [];
for (const s of starts) {
  const d = path.join(OUT, 't' + s.toFixed(2));
  execFileSync(process.execPath, [FRAMES, VID, '--out', d, '--from', String(s),
    '--to', (s + stride).toFixed(2), '--frames', '8', '--size', '256'], { stdio: 'ignore' });
  dirs.push({ d, s });
  console.log('  ✓ ' + s.toFixed(2) + ' ~ ' + (s + stride).toFixed(2));
}

const T = 200, tiles = [];
for (let r = 0; r < dirs.length; r++) {
  const fl = fs.readdirSync(dirs[r].d).filter(f => /^f\d+\.png$/.test(f)).sort();
  for (let i = 0; i < fl.length; i++) {
    const lbl = '<svg width="' + T + '" height="' + T + '"><text x="4" y="18" font-size="15" fill="#ff0" ' +
      'font-family="monospace">' + dirs[r].s.toFixed(2) + '.' + i + '</text></svg>';
    tiles.push({ input: await sharp(path.join(dirs[r].d, fl[i])).resize(T, T, { fit: 'contain', background: '#00000000' })
      .composite([{ input: Buffer.from(lbl), top: 0, left: 0 }]).png().toBuffer(), top: r * T, left: i * T });
  }
}
const sheet = path.join(OUT, '_sweep.jpg');
await sharp({ create: { width: 8 * T, height: dirs.length * T, channels: 3, background: '#6e6e6e' } })
  .composite(tiles).jpeg({ quality: 86 }).toFile(sheet);
console.log('\n✓ ' + sheet + '  — 줄마다 시작 시각. 걸음이 가장 매끄러운 줄을 고른다.');
