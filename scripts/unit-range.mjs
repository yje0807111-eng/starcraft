/* 클립을 프레임으로 깔아 놓고 구간을 눈으로 고르는 페이지를 만든다
 *
 *   node scripts/unit-range.mjs <출력.html> <라벨>=<영상> [<라벨>=<영상> …] [--n 72]
 *
 * 왜 필요한가: 정지 시트로는 '여기서 여기까지가 한 바퀴인가'를 볼 수 없다.
 * 자동 선택(--best·--refine)도 걸음이 이어지는지는 못 잡는다(SPRITES.md §4).
 * 그래서 사람이 고르되, 고르는 데 필요한 두 가지를 화면이 대신 봐 준다:
 *   ① 고른 구간만 즉시 반복 재생 — 이어지는지 눈으로 확인된다
 *   ② 시작을 정하면 각 프레임이 그 시작과 얼마나 닮았는지 막대로 표시 —
 *      막대가 짧은 칸이 곧 '한 바퀴 돈 지점'이다
 *
 * 결과 HTML 은 자체 완결형이라 그냥 열거나 아티팩트로 올리면 된다.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const OUT = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const pairs = argv.slice(1).filter(a => a.includes('=') && !a.startsWith('--'));
const N = parseInt(opt('n', '72'), 10);
if (!OUT || !pairs.length) {
  console.error('사용: node scripts/unit-range.mjs <출력.html> <라벨>=<영상> [<라벨>=<영상> …] [--n 72]');
  process.exit(2);
}
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH || ''].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('크롬을 찾을 수 없습니다. CHROME_PATH로 지정하세요.'); process.exit(2); }

// unit-frames.mjs 와 같은 배경 제거(마젠타 색조 판정 + 언매팅)
const KEY_LO = 40, KEY_HI = 90;
const c8 = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
async function cutout(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels, bg = [data[0], data[1], data[2]];
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2], key = (r + b) / 2 - g;
    let a = 255;
    if (key >= KEY_HI) a = 0;
    else if (key > KEY_LO) a = Math.round(255 * (KEY_HI - key) / (KEY_HI - KEY_LO));
    data[i + 3] = a;
    if (a === 0) continue;
    if (a < 255) { const A = Math.max(a / 255, 0.15), f = 1 - a / 255;
      data[i] = c8((r - f * bg[0]) / A); data[i + 1] = c8((g - f * bg[1]) / A); data[i + 2] = c8((b - f * bg[2]) / A);
    } else if (key > 0) { const d = Math.min(key, 24); data[i] = c8(r - d); data[i + 2] = c8(b - d); }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer();
}

async function grabClip(vid) {
  const ext = path.extname(vid).toLowerCase();
  const MIME = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4' };
  const server = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<!doctype html><meta charset=utf-8><video id=v muted playsinline preload=auto></video>'); }
    if (p !== '/v') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'video/mp4', 'Content-Length': fs.statSync(vid).size });
    fs.createReadStream(vid).pipe(res);
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
    const shots = await page.evaluate(({ targets }) => new Promise((res, rej) => {
      const v = document.getElementById('v'), out = [], cv = document.createElement('canvas');
      const grab = () => { cv.width = cv.height = 256;
        cv.getContext('2d').drawImage(v, 0, 0, v.videoWidth, v.videoHeight, 0, 0, 256, 256);
        out.push({ t: v.currentTime, png: cv.toDataURL('image/png') }); };
      setTimeout(() => rej(new Error('timeout')), 240000);
      const id = setInterval(() => {
        while (out.length < targets.length && v.currentTime >= targets[out.length]) grab();
        if (out.length >= targets.length || v.ended) { while (out.length < targets.length) grab();
          clearInterval(id); v.pause(); res(out); } }, 16);
      v.playbackRate = 1; v.play().catch(e => { clearInterval(id); rej(e); });
    }), { targets });
    return { dur, shots };
  } finally { await browser.close(); server.close(); }
}

const clips = [];
for (const p of pairs) {
  const i = p.indexOf('='), label = p.slice(0, i), vid = p.slice(i + 1);
  if (!fs.existsSync(vid)) { console.error('영상 없음: ' + vid); process.exit(3); }
  process.stdout.write(label + ' … ');
  const { dur, shots } = await grabClip(vid);
  const frames = [], small = [];
  for (const s of shots) {
    const cut = await cutout(Buffer.from(s.png.split(',')[1], 'base64'));
    frames.push({ t: +s.t.toFixed(3),
      src: 'data:image/webp;base64,' + (await sharp(cut).resize(200, 200, { fit: 'contain', background: '#00000000' })
        .webp({ quality: 78, alphaQuality: 80 }).toBuffer()).toString('base64') });
    small.push(await sharp(cut).resize(96, 96, { fit: 'contain', background: '#00000000' }).ensureAlpha().raw().toBuffer());
  }
  // 프레임끼리 얼마나 닮았는지 — 시작을 고르면 '한 바퀴 돈 지점'이 이 표에서 드러난다
  const dif = (a, b) => { let t = 0;
    for (let i = 0; i < a.length; i += 4) { const wa = a[i + 3] / 255, wb = b[i + 3] / 255;
      t += Math.abs(a[i] * wa - b[i] * wb) + Math.abs(a[i + 1] * wa - b[i + 1] * wb) +
           Math.abs(a[i + 2] * wa - b[i + 2] * wb) + Math.abs(a[i + 3] - b[i + 3]); }
    return t / (a.length / 4) / 4; };
  const m = [];
  for (let i = 0; i < small.length; i++) { const row = [];
    for (let j = 0; j < small.length; j++) row.push(+dif(small[i], small[j]).toFixed(1));
    m.push(row); }
  clips.push({ label, dur: +dur.toFixed(2), frames, sim: m });
  console.log(frames.length + '장');
}

const html = `<title>구간 고르기</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root{--ground:#0e1013;--panel:#161a20;--panel-2:#1d222a;--line:#2a313b;--line-hi:#3c4653;
    --bone:#e6e2d8;--muted:#8a929d;--dim:#5b636e;--jade:#4f9270;--amber:#d19a3f;--amber-dim:#7a5a24;--r:3px;
    --fd:'Rajdhani',system-ui,sans-serif;--fb:'IBM Plex Sans',system-ui,sans-serif;--fm:'IBM Plex Mono',ui-monospace,monospace}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ground);color:var(--bone);font-family:var(--fb);font-size:14px;line-height:1.55;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:1240px;margin:0 auto;padding:24px 20px 60px}
  h1{font-family:var(--fd);font-weight:700;font-size:28px;margin:0 0 6px;letter-spacing:.02em}
  header{border-bottom:1px solid var(--line);padding-bottom:14px}
  header p{margin:0;color:var(--muted);font-size:13.5px;max-width:66ch}
  header b{color:var(--amber);font-weight:500}
  h2{font-family:var(--fd);font-weight:700;font-size:20px;margin:32px 0 10px;letter-spacing:.02em}
  h2 span{color:var(--muted);font-weight:600;font-size:13px;font-family:var(--fm)}

  .clip{display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px;align-items:start}
  @media (max-width:860px){.clip{grid-template-columns:minmax(0,1fr)}}
  .prev{background:#0a0c0f;border:1px solid var(--line);border-radius:var(--r);position:relative;aspect-ratio:1/1;overflow:hidden}
  .prev img{position:absolute;inset:6px;width:calc(100% - 12px);height:calc(100% - 12px);object-fit:contain;opacity:0}
  .prev img.on{opacity:1}
  .prev .hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dim);
    font-family:var(--fd);font-size:15px;text-align:center;padding:20px}
  .info{font-family:var(--fm);font-size:11.5px;color:var(--muted);margin-top:8px;line-height:1.7;
    font-variant-numeric:tabular-nums}
  .info b{color:var(--amber);font-weight:500}
  .info .ok{color:var(--jade)}
  .info .bad{color:#d1683f}

  .strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:4px}
  .f{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:2px;
    aspect-ratio:1/1;cursor:pointer;padding:0;overflow:hidden}
  .f:hover{border-color:var(--line-hi)}
  .f:focus-visible{outline:2px solid var(--amber);outline-offset:1px}
  .f img{position:absolute;inset:2px;width:calc(100% - 4px);height:calc(100% - 4px);object-fit:contain}
  .f .t{position:absolute;top:1px;left:3px;font-family:var(--fm);font-size:9px;color:var(--dim);z-index:2}
  .f.inrange{background:var(--panel-2);border-color:var(--amber-dim)}
  .f.start{border-color:var(--amber);border-width:2px}
  .f.end{border-color:var(--jade);border-width:2px}
  .f .bar{position:absolute;left:2px;right:2px;bottom:2px;height:3px;background:var(--line);z-index:2}
  .f .bar i{display:block;height:100%;background:var(--jade)}
  .f .tag{position:absolute;bottom:6px;left:0;right:0;text-align:center;font-family:var(--fd);
    font-weight:700;font-size:11px;z-index:3}
  .f.start .tag{color:var(--amber)}
  .f.end .tag{color:var(--jade)}

  .bar2{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 4px}
  button.btn{font-family:var(--fd);font-weight:600;font-size:12.5px;background:var(--panel-2);color:var(--bone);
    border:1px solid var(--line-hi);border-radius:var(--r);padding:4px 11px;cursor:pointer}
  button.btn:hover{background:#252c35;border-color:var(--amber-dim)}
  button.btn:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
  input[type=range]{width:130px;accent-color:var(--amber)}
  .val{font-family:var(--fm);font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
  .result{margin-top:34px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:15px}
  .result h3{font-family:var(--fd);font-weight:600;font-size:12px;letter-spacing:.09em;text-transform:uppercase;
    color:var(--amber);margin:0 0 9px}
  pre{margin:0;font-family:var(--fm);font-size:12.5px;white-space:pre-wrap;line-height:1.7;color:var(--bone)}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<div class="wrap">
  <header>
    <h1>구간 고르기</h1>
    <p>프레임을 <b>한 번 누르면 시작</b>, <b>다시 누르면 끝</b>입니다. 고르는 즉시 그 구간만 반복 재생되니
      이어지는지 바로 보입니다. 시작을 정하면 각 칸 아래 <b>초록 막대</b>가 뜨는데, <b>막대가 짧을수록 그 칸이
      시작과 닮은 것</b> — 곧 한 바퀴 돈 지점입니다. 막대가 가장 짧은 칸을 끝으로 잡으면 매끄럽게 이어집니다.</p>
  </header>
  <div id="host"></div>
  <div class="result"><h3>결과</h3><pre id="out">아직 고른 것이 없습니다.</pre></div>
</div>
<script>
const CLIPS = ${JSON.stringify(clips)};
let fps = 10, playing = true, tick = 0;
const state = {};
const host = document.getElementById('host');

CLIPS.forEach((c, ci) => {
  state[ci] = { a: null, b: null, imgs: [], cells: [] };
  const h = document.createElement('h2');
  h.innerHTML = c.label + ' <span>' + c.dur.toFixed(2) + '초 · ' + c.frames.length + '장</span>';
  host.appendChild(h);
  const wrap = document.createElement('div'); wrap.className = 'clip';
  const left = document.createElement('div');
  const prev = document.createElement('div'); prev.className = 'prev';
  prev.innerHTML = '<div class="hint">프레임을 눌러 시작을 고르세요</div>';
  c.frames.forEach(f => { const im = new Image(); im.src = f.src; im.alt = ''; prev.appendChild(im); state[ci].imgs.push(im); });
  left.appendChild(prev);
  const info = document.createElement('div'); info.className = 'info'; info.id = 'info' + ci;
  left.appendChild(info);
  const bar = document.createElement('div'); bar.className = 'bar2';
  bar.innerHTML = '<button class="btn" data-clear="' + ci + '">지우기</button>';
  left.appendChild(bar);
  wrap.appendChild(left);

  const strip = document.createElement('div'); strip.className = 'strip';
  c.frames.forEach((f, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'f';
    b.innerHTML = '<span class="t">' + f.t.toFixed(2) + '</span><span class="bar"><i></i></span><span class="tag"></span>';
    const im = new Image(); im.src = f.src; im.alt = ''; b.insertBefore(im, b.firstChild);
    b.addEventListener('click', () => choose(ci, i));
    strip.appendChild(b); state[ci].cells.push(b);
  });
  wrap.appendChild(strip);
  host.appendChild(wrap);
});

function choose(ci, i){
  const s = state[ci];
  if (s.a === null || s.b !== null){ s.a = i; s.b = null; }
  else if (i === s.a){ s.a = null; }
  else { s.b = i; if (s.b < s.a){ const t = s.a; s.a = s.b; s.b = t; } }
  paintClip(ci); report();
}
function paintClip(ci){
  const c = CLIPS[ci], s = state[ci];
  const sim = s.a !== null ? c.sim[s.a] : null;
  const mx = sim ? Math.max.apply(null, sim) || 1 : 1;
  s.cells.forEach((cell, i) => {
    cell.classList.toggle('start', i === s.a);
    cell.classList.toggle('end', i === s.b);
    cell.classList.toggle('inrange', s.a !== null && s.b !== null && i > s.a && i < s.b);
    cell.querySelector('.tag').textContent = i === s.a ? '시작' : (i === s.b ? '끝' : '');
    const bar = cell.querySelector('.bar'), fill = bar.firstChild;
    if (!sim || i === s.a){ bar.style.opacity = 0; }
    else { bar.style.opacity = 1; fill.style.width = Math.round(sim[i] / mx * 100) + '%';
      fill.style.background = sim[i] < mx * 0.22 ? 'var(--jade)' : (sim[i] < mx * 0.45 ? 'var(--amber)' : 'var(--line-hi)'); }
  });
  const inf = document.getElementById('info' + ci);
  if (s.a === null){ inf.innerHTML = ''; document.querySelectorAll('.prev .hint')[ci].style.display = ''; return; }
  document.querySelectorAll('.prev .hint')[ci].style.display = 'none';
  if (s.b === null){ inf.innerHTML = '시작 <b>' + c.frames[s.a].t.toFixed(2) + '초</b> · 끝을 고르세요'; return; }
  const seam = c.sim[s.a][s.b], row = c.sim[s.a].slice().sort((x, y) => x - y);
  const best = row[1];
  const good = seam <= best * 1.35;
  inf.innerHTML = '<b>--from ' + c.frames[s.a].t.toFixed(2) + ' --to ' + c.frames[s.b].t.toFixed(2) + '</b>' +
    '<br>길이 ' + (c.frames[s.b].t - c.frames[s.a].t).toFixed(2) + '초 · ' + (s.b - s.a) + '칸' +
    '<br>이음새 ' + seam.toFixed(1) + ' <span class="' + (good ? 'ok' : 'bad') + '">' +
    (good ? '✔ 잘 이어진다' : '⚠ 더 닮은 칸이 있다 — 막대가 짧은 칸을 보세요') + '</span>';
}
function report(){
  let s = '';
  CLIPS.forEach((c, ci) => { const st = state[ci];
    if (st.a === null || st.b === null) return;
    s += c.label + '\\n  --from ' + c.frames[st.a].t.toFixed(2) + ' --to ' + c.frames[st.b].t.toFixed(2) +
      '  (길이 ' + (c.frames[st.b].t - c.frames[st.a].t).toFixed(2) + '초 · 이음새 ' + c.sim[st.a][st.b].toFixed(1) + ')\\n'; });
  document.getElementById('out').textContent = s || '아직 고른 것이 없습니다.';
}
document.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
  const ci = +b.dataset.clear; state[ci].a = null; state[ci].b = null; paintClip(ci); report(); }));

let last = 0, acc = 0;
function loop(t){
  if (playing){ if (last){ acc += t - last; const step = 1000 / fps;
    while (acc >= step){ acc -= step; tick++;
      CLIPS.forEach((c, ci) => { const s = state[ci];
        const a = s.a === null ? 0 : s.a, b = s.b === null ? (s.a === null ? c.frames.length - 1 : s.a) : s.b;
        const n = Math.max(1, b - a + 1), cur = a + (tick % n);
        s.imgs.forEach((im, i) => im.classList.toggle('on', i === cur)); }); } } last = t; } else last = 0;
  requestAnimationFrame(loop);
}
CLIPS.forEach((c, ci) => paintClip(ci));
requestAnimationFrame(loop);
</script>`;

fs.writeFileSync(OUT, html);
console.log('\n✓ ' + OUT + '  ' + (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + 'MB');
