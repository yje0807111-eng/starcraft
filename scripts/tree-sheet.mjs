/* ============================================================================
 * tree-sheet.mjs — 🎨 환생 트리 아이콘 대조판 (2026-09-02)
 *
 * `docs/mock/tree-icons.html` 을 그대로 찍는다. 그림 · 계열 이름 · 코드 키 · 모티프가
 * 한 장에 같이 보여서 **어느 그림이 어느 계열에 붙었는지** 눈으로 검산할 수 있다.
 *   ⚠ 이름표 없이 아이콘만 늘어놓으면 33개 중 하나가 어긋나도 못 찾는다.
 *   ⭐ 표의 단일 소스는 ART.md §15-4 다 — 거기와 HTML 이 어긋나면 HTML 을 고친다.
 * 사용: CHROME_PATH=... node scripts/tree-sheet.mjs [출력.png]
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || path.join(ROOT, 'docs', 'mock', 'tree-icons.png');
const MIME = { '.html':'text/html', '.css':'text/css', '.webp':'image/webp', '.png':'image/png', '.js':'text/javascript' };
const server = http.createServer((q, s) => { try {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const f = path.join(ROOT, p);
  if(!f.startsWith(ROOT)){ s.writeHead(403); return s.end(); }
  if(!fs.existsSync(f)){ s.writeHead(404); return s.end('nf'); }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
} catch(e){ s.writeHead(500); s.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new',
  args: ['--no-sandbox', '--disable-gpu-sandbox'] });
const pg = await b.newPage();
await pg.setViewport({ width: 900, height: 1400, deviceScaleFactor: 2 });
await pg.goto(`http://127.0.0.1:${server.address().port}/docs/mock/tree-icons.html`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 400));
// ⚠ 안 열린 그림은 빈 칸으로 조용히 지나간다 — 반드시 세어서 알린다
const broken = await pg.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.src));
if(broken.length) console.log('⚠ 안 열린 그림 ' + broken.length + '개: ' + broken.slice(0,3).join(', '));
else console.log('✓ 그림 ' + (await pg.evaluate(() => document.images.length)) + '장 전부 열림');
await pg.screenshot({ path: OUT, fullPage: true });
console.log('📸 ' + path.relative(ROOT, OUT));
await b.close(); server.close();
