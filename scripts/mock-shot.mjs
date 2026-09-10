/* ============================================================================
 * mock-shot.mjs — 🖼 docs/mock 의 목업 HTML 을 그림(PNG)으로 굽는다
 *   ⚠ 목업은 **눈으로 보고 고르는 것**이라 그림이 함께 있어야 한다(DESIGN.md §5.5).
 *   ⚠ 로컬 서버로 띄운다 — file:// 은 ../../assets 상대 경로가 막힌다.
 * 사용: node scripts/mock-shot.mjs docs/mock/이름.html [폭]
 * ========================================================================== */
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
import http from 'node:http'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const REL = process.argv[2]; const W = +(process.argv[3] || 1000);
if(!REL){ console.error('사용: node scripts/mock-shot.mjs docs/mock/이름.html [폭]'); process.exit(2); }
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp',
  '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((q,s)=>{ try{
  const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end(); }
  s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(s);
}catch(e){ s.writeHead(500); s.end(); } });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const CHROME=['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',process.env.CHROME_PATH||'']
  .filter(Boolean).find(p=>fs.existsSync(p));
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
await p.setViewport({width:W,height:1200,deviceScaleFactor:2});
await p.goto('http://127.0.0.1:'+server.address().port+'/'+REL.replace(/\\/g,'/'),{waitUntil:'networkidle0'});
const h=await p.evaluate(()=>document.body.scrollHeight);
await p.setViewport({width:W,height:Math.ceil(h)+16,deviceScaleFactor:2});
await new Promise(r=>setTimeout(r,300));
const out=path.join(ROOT, REL.replace(/\.html$/,'.png'));
await p.screenshot({path:out});
await b.close(); server.close();
console.log('구움 · '+path.relative(ROOT,out)+' ('+W+'×'+h+')');
