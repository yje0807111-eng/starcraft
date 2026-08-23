/* 클립에서 '머리가 가장 얌전한 구간'을 찾는다
 *
 *   node scripts/unit-calm.mjs <영상> [--win 1.4] [--n 120] [--head 0.30]
 *
 *   --win <초>    찾을 구간 길이(기본 1.4)
 *   --n <N>       훑는 표본 수(기본 120)
 *   --head <0~1>  '머리'로 볼 피사체 위쪽 비율(기본 0.30)
 *
 * 왜 필요한가: 후면 뷰는 다리가 몸에 가려 걷기가 거의 안 보인다. 그러면 생성기가
 * 움직일 것을 찾다가 가장 크고 또렷한 부위 — 머리·뿔 — 을 흔든다. 프롬프트로 여러 번
 * 막아 봤지만 완전히는 안 잡혔다(SPRITES.md §6).
 *
 * 클립 전체가 흔들려도 **덜 흔들리는 1~2초**는 있다. 여기서는 두 띠를 따로 재서
 *   머리띠 변화 ↓  (작을수록 좋다)  ·  다리띠 변화 ↑  (클수록 좋다)
 * 둘을 함께 보고 좋은 구간을 추천한다.
 *
 * ⚠ 추천은 참고다. 최종 판단은 unit-range.mjs 로 만든 페이지에서 눈으로 한다.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const VID = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
if (!VID || !fs.existsSync(VID)) {
  console.error('사용: node scripts/unit-calm.mjs <영상> [--win 1.4] [--n 120] [--head 0.30]');
  process.exit(2);
}
const WIN = parseFloat(opt('win', '1.4')), N = parseInt(opt('n', '120'), 10);
const HEAD = parseFloat(opt('head', '0.30')), P = 200;

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH || ''].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('크롬을 찾을 수 없습니다.'); process.exit(2); }

const ext = path.extname(VID).toLowerCase();
const MIME = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4' };
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (p === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset=utf-8><video id=v muted playsinline preload=auto></video>'); }
  if (p !== '/v') { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'video/mp4', 'Content-Length': fs.statSync(VID).size });
  fs.createReadStream(VID).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--mute-audio', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'load' });
  const info = await page.evaluate(() => new Promise((res, rej) => { const v = document.getElementById('v');
    v.onloadeddata = () => res({ d: v.duration }); v.onerror = () => rej(new Error('열기 실패'));
    v.src = '/v?t=' + Math.random(); v.load(); setTimeout(() => rej(new Error('timeout')), 30000); }));
  const dur = info.d;
  const targets = Array.from({ length: N }, (_, i) => dur * (i / N) * 0.995);
  const shots = await page.evaluate(({ targets, P }) => new Promise((res, rej) => {
    const v = document.getElementById('v'), out = [], cv = document.createElement('canvas');
    const grab = () => { cv.width = cv.height = P;
      cv.getContext('2d').drawImage(v, 0, 0, v.videoWidth, v.videoHeight, 0, 0, P, P);
      out.push({ t: v.currentTime, png: cv.toDataURL('image/png') }); };
    setTimeout(() => rej(new Error('timeout')), 240000);
    const id = setInterval(() => {
      while (out.length < targets.length && v.currentTime >= targets[out.length]) grab();
      if (out.length >= targets.length || v.ended) { while (out.length < targets.length) grab();
        clearInterval(id); v.pause(); res(out); } }, 16);
    v.playbackRate = 1; v.play().catch(e => { clearInterval(id); rej(e); });
  }), { targets, P });

  const raws = [], boxes = [];
  for (const s of shots) {
    const raw = await sharp(Buffer.from(s.png.split(',')[1], 'base64')).removeAlpha().raw().toBuffer();
    const bg = [raw[0], raw[1], raw[2]];
    let x0 = P, y0 = P, x1 = -1, y1 = -1;
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const o = (y * P + x) * 3;
      if (Math.abs(raw[o] - bg[0]) + Math.abs(raw[o + 1] - bg[1]) + Math.abs(raw[o + 2] - bg[2]) > 90) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    raws.push(raw); boxes.push({ x0, y0, x1, y1 });
  }
  // 띠별 프레임 간 변화
  const headD = [], legD = [];
  for (let i = 0; i < raws.length - 1; i++) {
    const b = boxes[i], h = b.y1 - b.y0 + 1;
    const headEnd = b.y0 + Math.round(h * HEAD), legStart = b.y1 - Math.round(h * 0.30);
    let sh = 0, nh = 0, sl = 0, nl = 0;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const o = (y * P + x) * 3;
      const d = Math.abs(raws[i][o] - raws[i + 1][o]) + Math.abs(raws[i][o + 1] - raws[i + 1][o + 1]) +
                Math.abs(raws[i][o + 2] - raws[i + 1][o + 2]);
      if (y <= headEnd) { sh += d; nh++; }
      if (y >= legStart) { sl += d; nl++; }
    }
    headD.push(sh / Math.max(1, nh)); legD.push(sl / Math.max(1, nl));
  }
  const dt = dur / N, W = Math.max(3, Math.round(WIN / dt));
  const rows = [];
  for (let s = 0; s + W < headD.length; s++) {
    let hh = 0, ll = 0;
    for (let k = s; k < s + W; k++) { hh += headD[k]; ll += legD[k]; }
    rows.push({ t: s * dt, head: hh / W, leg: ll / W });
  }
  const hAll = rows.map(r => r.head), lAll = rows.map(r => r.leg);
  const hMin = Math.min(...hAll), hMax = Math.max(...hAll);
  console.log('길이 ' + dur.toFixed(2) + '초 · 창 ' + WIN.toFixed(2) + '초 · 머리띠 = 피사체 위 ' + (HEAD * 100).toFixed(0) + '%');
  console.log('머리 흔들림 ' + hMin.toFixed(1) + ' ~ ' + hMax.toFixed(1) + ' (클립 안에서 ' + (hMax / Math.max(0.1, hMin)).toFixed(1) + '배 차이)');
  console.log('\n시작(초)  머리흔들림           다리움직임   다리/머리');
  const step = Math.max(1, Math.round(0.4 / dt));
  for (let i = 0; i < rows.length; i += step) { const r = rows[i];
    const bar = '█'.repeat(Math.max(1, Math.round((r.head - hMin) / Math.max(0.1, hMax - hMin) * 22)));
    console.log('  ' + r.t.toFixed(2).padStart(5) + '   ' + r.head.toFixed(1).padStart(5) + ' ' + bar.padEnd(23) +
      r.leg.toFixed(1).padStart(5) + '   ' + (r.leg / Math.max(0.1, r.head)).toFixed(2)); }
  const best = rows.slice().sort((a, b) => (b.leg / Math.max(0.1, b.head)) - (a.leg / Math.max(0.1, a.head))).slice(0, 5);
  console.log('\n=== 다리는 움직이고 머리는 조용한 구간 (위 5개) ===');
  for (const r of best)
    console.log('  --from ' + r.t.toFixed(2) + ' --to ' + (r.t + WIN).toFixed(2) +
      '   머리 ' + r.head.toFixed(1) + ' · 다리 ' + r.leg.toFixed(1) + ' · 비율 ' + (r.leg / Math.max(0.1, r.head)).toFixed(2));
  console.log('\n⚠ 추천은 참고다. unit-range.mjs 페이지에서 이음새까지 보고 최종 결정할 것.');
} finally { await browser.close(); server.close(); }
