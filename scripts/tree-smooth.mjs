/* ============================================================================
 * tree-smooth.mjs — 🖐 환생 트리 팬·줌이 실제로 부드러운가 (2026-09-02)
 *
 * ⚠ 「부드럽다」를 눈으로만 판단하면 안 된다. **프레임마다 뷰 값을 받아 적어**
 *   한 프레임에 튀는지(계단) 여러 프레임에 걸쳐 붙는지(곡선)를 본다.
 *   이 프로젝트는 움직임을 숫자 없이 좇다가 여러 번 헛짚었다(CLAUDE.md).
 * 사용: CHROME_PATH=... node scripts/tree-smooth.mjs
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
await pg.waitForFunction('typeof campRebEnter==="function"', { timeout: 30000 });
await pg.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); });
await new Promise(r => setTimeout(r, 900));
await pg.evaluate(() => { if(typeof campHasRace==='function' && !campHasRace() && typeof campPickRace==='function') campPickRace(); });
await new Promise(r => setTimeout(r, 1200));
await pg.evaluate(() => { const C = campState();
  C.rbTree = { root:1, _m2:1, 'br:econ':1, 'gp:econ가':1, gather:3, gas:2 };
  campRebEnter('tree'); });
await new Promise(r => setTimeout(r, 900));

// 프레임마다 뷰를 받아 적는다
const rec = async (label, act) => {
  // ⚠ 정지 플래그는 **루프를 시켜 놓기 전에** 내린다. 뒤에 내리면 앞 케이스의 true 를 보고
  //   즉시 끝나 버린다 — 게다가 큐에 남은 rAF 하나가 살아남는 타이밍에는 값이 나와서
  //   「어떤 케이스는 되고 어떤 케이스는 0」 이라는 경쟁 상태가 된다(실제로 그랬다).
  await pg.evaluate(() => { window.__tr = []; window.__trStop = false;
    (function loop(){
      if(window.__trStop) return; const v = _campTreeView;
      window.__tr.push({ x:+v.x.toFixed(2), y:+v.y.toFixed(2), z:+v.z.toFixed(4) });
      requestAnimationFrame(loop); })(); });
  await act();
  await new Promise(r => setTimeout(r, 900));
  const tr = await pg.evaluate(() => { window.__trStop = true; return window.__tr; });
  // 값이 실제로 바뀐 프레임만 세고, 프레임당 변화폭을 본다
  const zs = tr.map(o => o.z), xs = tr.map(o => o.x);
  let zStep = 0, xStep = 0, nz = 0, nx = 0, zMax = 0, xMax = 0;
  for(let i = 1; i < tr.length; i++){
    const dz = Math.abs(zs[i] - zs[i-1]), dx = Math.abs(xs[i] - xs[i-1]);
    if(dz > 1e-4){ nz++; zStep += dz; zMax = Math.max(zMax, dz); }
    if(dx > 0.02){ nx++; xStep += dx; xMax = Math.max(xMax, dx); }
  }
  console.log('■ ' + label);
  console.log('  프레임 ' + tr.length + ' · z 가 움직인 프레임 ' + nz +
    (nz ? (' · 한 프레임 최대 Δz ' + zMax.toFixed(4) + ' · 전체 ' + zs[0] + '→' + zs[zs.length-1]) : ''));
  console.log('  x 가 움직인 프레임 ' + nx +
    (nx ? (' · 한 프레임 최대 Δx ' + xMax.toFixed(1) + ' · 전체 ' + xs[0] + '→' + xs[xs.length-1]) : ''));
  return { nz, nx, zMax, xMax };
};

const R = {};
R.wheel = await rec('🖱 휠 한 번(확대)', async () => {
  await pg.evaluate(() => { const svg = document.getElementById('ctSvg'); const r = svg.getBoundingClientRect();
    svg.dispatchEvent(new WheelEvent('wheel', { deltaY:-120, clientX:r.left+r.width/2,
      clientY:r.top+r.height/2, bubbles:true, cancelable:true })); }); });
R.drag = await rec('🖐 드래그(옆으로 밀기)', async () => {
  await pg.evaluate(async () => { const svg = document.getElementById('ctSvg');
    const r = svg.getBoundingClientRect(), cx = r.left+r.width/2, cy = r.top+r.height/2;
    const ev = (t, x, y) => svg.dispatchEvent(new PointerEvent(t, { pointerId:1, clientX:x, clientY:y,
      bubbles:true, cancelable:true, isPrimary:true }));
    svg.setPointerCapture = () => {};
    ev('pointerdown', cx, cy);
    for(let i = 1; i <= 10; i++){ ev('pointermove', cx - i*8, cy); await new Promise(r2 => setTimeout(r2, 16)); }
    ev('pointerup', cx - 80, cy); }); });

// ⚠ 케이스마다 **같은 자리에서 출발**시킨다 — 앞 케이스가 남긴 배율에서 시작하면
//   「확대가 0프레임」 같은 값이 나와 원인을 잘못 짚는다(실제로 한 번 그랬다).
const reset = async () => { await pg.evaluate(() => { campTreeFit(true); campTreeViewSync(); });
  await new Promise(r => setTimeout(r, 250)); };
await reset();
R.tap = await rec('⭐ 별을 누른다(확대 + 가운데로)', async () => {
  await pg.evaluate(() => campTreeTap('gather', 1)); });
R.desel = await rec('⊘ 선택 해제(물러난다)', async () => {
  await pg.evaluate(() => campTreeDesel()); });

console.log('');
console.log('⭐ 판정 — 「부드럽다」 = 값이 **여러 프레임에 걸쳐** 붙는다는 뜻이다.');
console.log('  휠: z 가 움직인 프레임 ' + R.wheel.nz + (R.wheel.nz >= 5 ? ' ✓ 곡선' : ' ✗ 한 번에 튄다'));
console.log('  드래그: 손을 뗀 뒤에도 x 가 이어서 움직여야 한다 — 움직인 프레임 ' + R.drag.nx +
  (R.drag.nx >= 12 ? ' ✓' : ' ✗ 너무 적다'));
console.log('  별 누르기: z ' + R.tap.nz + '프레임 · 한 프레임 최대 Δz ' + R.tap.zMax.toFixed(4) +
  ' · x ' + R.tap.nx + '프레임 최대 Δx ' + R.tap.xMax.toFixed(1) +
  ((R.tap.zMax < 0.06 && R.tap.xMax < 12) ? ' ✓ 매끄럽다' : ' ✗ 한 프레임이 크게 튄다'));
console.log('  해제: z ' + R.desel.nz + '프레임 · 한 프레임 최대 Δz ' + R.desel.zMax.toFixed(4) +
  ' · x ' + R.desel.nx + '프레임 최대 Δx ' + R.desel.xMax.toFixed(1) +
  ((R.desel.zMax < 0.06 && R.desel.xMax < 12) ? ' ✓ 매끄럽다' : ' ✗ 한 프레임이 크게 튄다'));
console.log(errs.length ? ('⚠ 예외 ' + errs.length + '건: ' + errs[0]) : '✅ 예외 없음');
await b.close(); server.close();
