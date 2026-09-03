/* rune-shot.mjs — 💠 룬 구역 화면을 찍는다(트리 디자인을 맞출 기준) */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2' };
const server = http.createServer((q, s) => { try {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const f = path.join(ROOT, p === '/' ? 'sc-ums-web.html' : p);
  if(!f.startsWith(ROOT)){ s.writeHead(403); return s.end(); }
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end('nf'); }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
} catch(e){ s.writeHead(500); s.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new',
  protocolTimeout: 300000, args: ['--mute-audio','--no-sandbox','--disable-gpu-sandbox'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`, { waitUntil: 'load' });
await pg.waitForFunction('typeof campRuneEnter==="function"', { timeout: 30000 });
await pg.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); });
await new Promise(r => setTimeout(r, 900));
await pg.evaluate(() => { if(typeof campHasRace==='function' && !campHasRace() && typeof campPickRace==='function') campPickRace(); });
await new Promise(r => setTimeout(r, 1400));
await pg.evaluate(() => { const C = campState(); C.best = { 10:50 }; campRuneEnter('slot'); });
await new Promise(r => setTimeout(r, 900));
await pg.screenshot({ path: path.join(ROOT, 'scratch_shot_rune.png') });
console.log('📸 scratch_shot_rune.png');
await b.close(); server.close();
