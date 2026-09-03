/* ============================================================================
 * gasex-shot.mjs — ⛽→💠 정제소 프로필의 가스 교환 카드를 눈으로 본다 (2026-09-02)
 *
 * ⚠ 스모크는 「카드가 모델에 들어갔나」만 잰다 — 실제로 그리드에 어떻게 앉는지는 못 본다.
 *   (아이콘 크기가 128px 로 튀어 줄을 밀어낸 사고가 채굴 시트에서 있었다.)
 * 사용: CHROME_PATH=... node scripts/gasex-shot.mjs
 * ========================================================================== */
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
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844 });
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`, { waitUntil: 'load' });
await pg.waitForFunction('typeof campEnter==="function"', { timeout: 30000 });
// 캠프로 들어간다
await pg.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷');
  openHome(); });
await new Promise(r => setTimeout(r, 900));
await pg.evaluate(() => { if(typeof campHasRace==='function' && !campHasRace() && typeof campPickRace==='function') campPickRace(); });
await new Promise(r => setTimeout(r, 1500));
// 가스 건물을 찾아 심고 지정한다 — 실제 배치 흐름을 다 밟지 않고 프로필만 본다
const info = await pg.evaluate(() => {
  const race = G.tech.race, tree = (typeof TECH_TREE!=='undefined' ? TECH_TREE[race] : null);
  // ⚠ 건물 표는 `buildings` **배열**이다(bldgs 객체가 아니다 — 여기서 한 번 헛짚었다)
  const list = (tree && tree.buildings) || [];
  const gb = list.find(x => x && x.gas);
  if(!gb) return { err:'가스 건물을 못 찾음 · 건물 '+list.length+'개' };
  const gk = gb.k;
  // 수입을 쟀다고 치고 가스를 준다 — 안 그러면 카드가 잠긴 모습만 나온다
  const C = campState(); if(C) C.rate = 12000/60;
  G.tech.energy = 240;
  const e = { eid: 90001, type:'bldg', bk: gk, bt: 0, x: 4, y: 4, cx: 4, cy: 4, hp: 750, maxHp: 750 };
  G.tech.ents.push(e); G.tech.sel = e.eid; G.tech.selU = [];
  const sh = G.tech.sheet || (G.tech.sheet = {}); sh.open = true; sh.sec = 'ent';
  if(typeof techUIRender === 'function') techUIRender();
  const bd = (typeof techGetBldg==='function') ? techGetBldg(race, gk) : null;
  const m = (typeof techBldgPlainModel==='function' && bd) ? techBldgPlainModel(bd, e) : null;
  return { race, gk, gas: !!(bd&&bd.gas), card: !!(m && (m.items||[]).filter(Boolean)
    .some(x => x && x.sn === '가스 교환')), rate: C ? C.rate : 0 };
});
console.log(JSON.stringify(info));
await new Promise(r => setTimeout(r, 700));
const out = path.join(ROOT, 'scratch_shot_gasex.png');
await pg.screenshot({ path: out });
console.log('📸 scratch_shot_gasex.png');
console.log(errs.length ? ('⚠ 예외 ' + errs.length + '건: ' + errs[0]) : '✅ 예외 없음');
await b.close(); server.close();
