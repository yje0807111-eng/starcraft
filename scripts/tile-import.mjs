/* ============================================================================
 * tile-import.mjs — 🧱 받은 바닥 타일 원본(PNG)을 게임 에셋(webp)으로 들인다
 *
 * ⭐ **왜 스크립트인가** — 이 환경에는 sharp/PIL 이 없다. 크로미움의 캔버스로 변환한다.
 * 🩹 **이음매 보정**(--flat): 세로(또는 가로) 방향으로 **전체 밝기 기울기**가 있으면 깔았을 때
 *   줄무늬가 보인다(실측: 금속 갑판 위 55 ↔ 아래 47). 줄별 평균에 직선을 맞춰 그 기울기만 나눈다 —
 *   ⛔ 줄별로 완전히 평탄화하지 말 것: 무늬의 진짜 명암까지 지워져 밋밋해진다.
 *
 * 사용: CHROME_PATH=... node scripts/tile-import.mjs <원본.png> <이름> [--flat] [--size 512]
 *   → assets/tiles/<이름>.webp
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const SRC = argv[0], NAME = argv[1];
if(!SRC || !NAME){ console.error('사용: node scripts/tile-import.mjs <원본.png> <이름> [--flat] [--size 512]'); process.exit(2); }
const FLAT = argv.includes('--flat');
const SIZE = (() => { const i = argv.indexOf('--size'); return i < 0 ? 512 : +argv[i + 1]; })();
const CHROME = process.env.CHROME_PATH;
if(!CHROME || !fs.existsSync(CHROME)){ console.error('CHROME_PATH 를 지정하세요'); process.exit(2); }
if(!fs.existsSync(SRC)){ console.error('원본이 없다: ' + SRC); process.exit(2); }

const srv = http.createServer((q, s) => {
  if(q.url === '/'){ s.writeHead(200, {'content-type':'text/html'}); return s.end('<canvas id=c></canvas>'); }
  try{ const b = fs.readFileSync(SRC); s.writeHead(200, {'content-type':'image/png'}); s.end(b); }
  catch(e){ s.writeHead(404); s.end(''); } });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const br = await puppeteer.launch({ executablePath: CHROME, headless:'new', protocolTimeout:300000, args:['--no-sandbox','--disable-gpu-sandbox'] });
const pg = await br.newPage();
await pg.goto(`http://127.0.0.1:${srv.address().port}/`);
const out = await pg.evaluate(async (size, flat) => {
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('load')); i.src = '/t.png'; });
  const c = document.getElementById('c'); c.width = size; c.height = size;
  const x = c.getContext('2d', { willReadFrequently:true });
  x.imageSmoothingEnabled = true; if(x.imageSmoothingQuality) x.imageSmoothingQuality = 'high';
  x.drawImage(im, 0, 0, size, size);
  const before = {}, after = {};
  const stat = () => { const d = x.getImageData(0, 0, size, size).data;
    const L = i => d[i]*.299 + d[i+1]*.587 + d[i+2]*.114;
    const band = (y0, y1) => { let s = 0, n = 0; for(let y = y0|0; y < (y1|0); y++) for(let px = 0; px < size; px += 2){ s += L((y*size+px)*4); n++; } return s/n; };
    const rowDiff = (a, b) => { let s = 0; for(let px = 0; px < size; px++){ const i=(a*size+px)*4, j=(b*size+px)*4;
      s += Math.abs(d[i]-d[j]) + Math.abs(d[i+1]-d[j+1]) + Math.abs(d[i+2]-d[j+2]); } return s/size/3; };
    let inner = 0, n = 0; for(let y = 6; y < size-6; y += 9){ inner += rowDiff(y, y+1); n++; }
    return { top:+band(0, size*.12).toFixed(1), bot:+band(size*.88, size).toFixed(1),
             seam:+rowDiff(size-1, 0).toFixed(2), inner:+(inner/n).toFixed(2) }; };
  Object.assign(before, stat());
  if(flat){
    // 줄별 평균에 직선을 맞춰 **그 기울기만** 나눈다(무늬의 명암은 남긴다)
    const img = x.getImageData(0, 0, size, size), d = img.data;
    const L = i => d[i]*.299 + d[i+1]*.587 + d[i+2]*.114;
    const rm = new Float64Array(size);
    for(let y = 0; y < size; y++){ let s = 0; for(let px = 0; px < size; px++) s += L((y*size+px)*4); rm[y] = s/size; }
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for(let y = 0; y < size; y++){ sx += y; sy += rm[y]; sxx += y*y; sxy += y*rm[y]; }
    const b = (size*sxy - sx*sy) / (size*sxx - sx*sx), a = (sy - b*sx) / size, mean = sy/size;
    for(let y = 0; y < size; y++){ const f = mean / Math.max(1e-6, a + b*y);
      for(let px = 0; px < size; px++){ const i = (y*size+px)*4;
        d[i] = Math.max(0, Math.min(255, d[i]*f)); d[i+1] = Math.max(0, Math.min(255, d[i+1]*f)); d[i+2] = Math.max(0, Math.min(255, d[i+2]*f)); } }
    x.putImageData(img, 0, 0); }
  Object.assign(after, stat());
  return { w:im.width, h:im.height, before, after, data:c.toDataURL('image/webp', 0.85) };
}, SIZE, FLAT);
const dst = path.join(ROOT, 'assets/tiles', NAME + '.webp');
fs.writeFileSync(dst, Buffer.from(out.data.split(',')[1], 'base64'));
const kb = (fs.statSync(dst).size / 1024).toFixed(0);
console.log(NAME + ': ' + out.w + '×' + out.h + ' → ' + SIZE + ' · ' + kb + 'KB');
console.log('  이음매(작을수록 좋다) ' + out.before.seam + ' → ' + out.after.seam + ' (내부 기준 ' + out.after.inner + ')');
console.log('  위/아래 밝기 ' + out.before.top + '/' + out.before.bot + ' → ' + out.after.top + '/' + out.after.bot);
await br.close(); srv.close();
