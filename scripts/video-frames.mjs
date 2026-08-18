/* 영상 → 던전 배경 움직임 프레임(dgN_f1..f4.webp)
 *
 *   node scripts/video-frames.mjs <영상경로> <던전번호> [프레임수=4]
 *   예) node scripts/video-frames.mjs C:/Users/Home/Downloads/dg1.mp4 1
 *
 * ffmpeg 없이 크롬 디코더를 쓴다(이 저장소는 이미 puppeteer-core + 크롬을 쓴다).
 *
 * ⚠ 시크(currentTime 점프)를 쓰지 않는다. AI 생성 영상·화면 녹화본 중에는 색인이 없어
 *   시크가 영영 안 끝나는 파일이 있다(실제로 걸렸다). 대신 재생하면서 지나가는 프레임을
 *   잡는다 — 어떤 파일이든 되고, 5초 클립이면 몇 초면 끝난다.
 *
 * 영상 전 구간을 균등하게 샘플링한다. 화면에서는 1→2→3→4→3→2 핑퐁으로 돌아서
 * 영상의 마지막과 첫 프레임이 달라도 이음새가 생기지 않는다.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';

const [VID, DG, NF] = [process.argv[2], parseInt(process.argv[3], 10), parseInt(process.argv[4] || '4', 10)];
if (!VID || !DG) { console.error('사용: node scripts/video-frames.mjs <영상경로> <던전번호> [프레임수=4]'); process.exit(2); }
if (!fs.existsSync(VID)) { console.error('영상이 없습니다: ' + VID); process.exit(2); }

const OUT = 'assets/backgrounds/dungeons';
const SIZE = 1024, QUALITY = 80;
// 배속은 길이에 맞춰 정한다 — 짧은 클립을 빨리 돌리면 16ms 폴링이 목표 시각을 지나쳐
// 프레임 간격이 들쭉날쭉해진다(1초 클립 4배속에서 0.07/0.62/0.69/1.01로 뽑혔다).
// 어떤 길이든 벽시계로 약 2초가 걸리게 맞추면 폴링 표본이 120개쯤 확보된다.
const WALL = 2, rateFor = d => Math.max(0.5, Math.min(4, d / WALL));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH || ''].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('크롬을 찾을 수 없습니다. CHROME_PATH로 지정하세요.'); process.exit(2); }

const VMIME = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.ogv': 'video/ogg' };
const ext = path.extname(VID).toLowerCase();
if (!VMIME[ext]) { console.error('지원하지 않는 형식: ' + ext + ' (mp4/webm/mov)'); process.exit(2); }

// 페이지와 영상을 '같은 출처'로 서빙한다 — 다른 출처면 캔버스가 오염돼 toDataURL이 막힌다
// (setContent로 만든 about:blank 페이지 + http 영상 조합에서 실제로 걸렸다). file://도 같은 이유로 안 된다.
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (p === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset=utf-8><video id=v muted playsinline preload=auto></video>'); }
  if (p !== '/v') { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': VMIME[ext], 'Content-Length': fs.statSync(VID).size });
  fs.createReadStream(VID).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const SRC = '/v';   // 페이지와 같은 출처(상대 경로)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--mute-audio', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });

  // 처음부터 다시 재생하려면 src를 다시 물린다 — 시크로 되감으면 색인 없는 파일에서 멈춘다
  const reload = () => page.evaluate(src => new Promise((res, rej) => {
    const v = document.getElementById('v');
    v.onerror = () => rej(new Error('영상을 열 수 없습니다(코덱 미지원?)'));
    v.onloadeddata = () => res({ w: v.videoWidth, h: v.videoHeight, d: v.duration });
    v.src = src + '?t=' + Math.random(); v.load();
    setTimeout(() => rej(new Error('영상 로드 시간 초과')), 30000);
  }), SRC);

  const info = await reload();
  console.log(`영상 ${info.w}x${info.h}`);
  if (Math.abs(info.w / info.h - 1) > 0.02) console.log(`⚠ 1:1이 아닙니다(${(info.w / info.h).toFixed(3)}) — 가운데를 잘라 정사각으로 맞춥니다`);

  // ① 길이 재기 — 메타데이터에 없으면(녹화본 등) 한 번 훑어서 마지막 프레임 시각을 쓴다
  let dur = (isFinite(info.d) && info.d > 0) ? info.d : null;
  if (dur === null) {
    dur = await page.evaluate(rate => new Promise((res, rej) => {
      const v = document.getElementById('v'); let last = 0;
      setTimeout(() => rej(new Error('길이 측정 시간 초과')), 60000);
      const id = setInterval(() => { last = Math.max(last, v.currentTime); if (v.ended) { clearInterval(id); res(last); } }, 16);
      v.playbackRate = rate; v.play().catch(e => { clearInterval(id); rej(e); });
    }), 8);
    await reload();
  }
  console.log(`길이 ${dur.toFixed(2)}초 → ${NF}프레임`);

  // ② 재생하면서 목표 시각을 지날 때마다 한 장씩
  const targets = Array.from({ length: NF }, (_, i) => dur * (NF === 1 ? 0.5 : i / (NF - 1)) * 0.98);
  const shots = await page.evaluate(({ targets, rate }) => new Promise((res, rej) => {
    const v = document.getElementById('v'), out = [];
    const cv = document.createElement('canvas');
    const grab = () => {
      const s = Math.min(v.videoWidth, v.videoHeight);          // 가운데 정사각 크롭
      cv.width = cv.height = s;
      cv.getContext('2d').drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, s, s);
      out.push({ t: v.currentTime, png: cv.toDataURL('image/png') });
    };
    setTimeout(() => rej(new Error('프레임 수집 시간 초과')), 60000);
    // rVFC는 헤드리스에서 안 온다(합성 없음) → 16ms 폴링. drawImage는 디코딩된 현재 프레임을 그대로 준다.
    const id = setInterval(() => {
      try {
        while (out.length < targets.length && v.currentTime >= targets[out.length]) grab();
        if (out.length >= targets.length || v.ended) {
          while (out.length < targets.length) grab();   // 끝까지 갔는데 모자라면 마지막 장으로 채움
          clearInterval(id); v.pause(); res(out); }
      } catch (e) { clearInterval(id); rej(new Error('프레임 캡처 실패: ' + (e && e.message || e))); }
    }, 16);
    v.playbackRate = rate;
    v.play().catch(e => { clearInterval(id); rej(e); });
  }), { targets, rate: rateFor(dur) });

  for (let i = 0; i < shots.length; i++) {
    const buf = Buffer.from(shots[i].png.split(',')[1], 'base64');
    const out = path.join(OUT, `dg${DG}_f${i + 1}.webp`);
    await sharp(buf).resize(SIZE, SIZE, { fit: 'cover' }).webp({ quality: QUALITY }).toFile(out);
    console.log(`✓ ${out}  t=${shots[i].t.toFixed(2)}s  ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
  }
  // 프레임 간 변화량을 알려 준다 — 크면 안개·구름 같은 게 화면을 가로질렀다는 뜻이다.
  // (실제로 'drifting haze'를 프롬프트에 넣었다가 바닥이 가려진 적이 있다.)
  const px = [];
  for (const sh of shots)
    px.push(await sharp(Buffer.from(sh.png.split(',')[1], 'base64')).resize(256, 256).removeAlpha().raw().toBuffer());
  const dif = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
  const ds = []; let worst = 0;
  for (let i = 1; i < px.length; i++) { const d = dif(px[i - 1], px[i]); ds.push(d.toFixed(1)); worst = Math.max(worst, d); }
  console.log(`\n프레임 간 변화: ${ds.join(' · ')} (0~255 평균)`);
  console.log(worst > 3
    ? '⚠ 변화가 큽니다 — 안개·구름·빛줄기가 화면을 가로질렀을 수 있습니다. 프레임을 눈으로 확인하세요.'
    : '✔ 미세한 움직임만 있습니다(바닥이 가려지지 않음).');
  console.log(`\n완료 — dg${DG}에 넣었습니다. 정지 그림 dg${DG}.webp가 없어도 첫 프레임이 바탕이 됩니다.`);
} finally { await browser.close(); server.close(); }
