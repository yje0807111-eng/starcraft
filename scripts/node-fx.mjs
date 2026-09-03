/* ============================================================================
 * node-fx.mjs — 🚪 마디 15개가 각각 무엇을 주는가 (2026-09-02)
 *
 * ⚠ 표만 보고 답하면 틀린다. 마디 몫은 `campRtMul`·`campRtCut` 을 **지나는 계열에만** 닿는다.
 *   ⛔ 「campRtMul(k) 값이 변하나」로 재면 안 된다 — 그 값을 **안 쓰는 계열이 있다.**
 *     피버 넷·채굴 속도·인구 상한·업그레이드 비용·버팀은 제 표(CAMP_FEV_* · CAMP_RT_DISC …)를
 *     campRtHas 로 직접 꺼내 쓴다. 그래서 campRtMul 은 변해도 게임에는 안 닿는다.
 *     (여기서 한 번 그렇게 재서 「전부 닿는다」는 틀린 답을 냈다.)
 *   ⭐ 그래서 **소스에서 `campRtMul('X')` 호출을 뽑아** 실제 소비 계열을 정한다 —
 *     계열이 배선되거나 끊기면 저절로 따라온다. `campRtCut` 은 enemy 갈래를 통째로 돈다.
 * 사용: CHROME_PATH=... node scripts/node-fx.mjs
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
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`, { waitUntil: 'load' });
await pg.waitForFunction('typeof campRtNodeAdd==="function"', { timeout: 30000 });
await pg.evaluate(() => { if(typeof CHAR==='function' && !CHAR()) profCreateChar('ranger','샷'); openHome(); });
await new Promise(r => setTimeout(r, 900));
await pg.evaluate(() => { if(typeof campHasRace==='function' && !campHasRace() && typeof campPickRace==='function') campPickRace(); });
await new Promise(r => setTimeout(r, 1200));

// ⭐ 실제 소비 계열 — 소스에서 뽑는다(하드코딩하면 배선이 바뀔 때 조용히 어긋난다)
const SRC = fs.readdirSync(path.join(ROOT, 'js')).filter(x => x.endsWith('.js'))
  .map(x => fs.readFileSync(path.join(ROOT, 'js', x), 'utf8')).join(" ");
// ⚠ 정규식으로 찾지 않는다 — 이 파일을 만드는 쪽에서 백슬래시가 한 번 벗겨져 괄호가
//   그룹으로 해석된 적이 있다. 문자열 자르기가 그런 사고를 안 낸다.
// ⭐ 마디 몫이 들어가는 길은 **둘**이다:
//   campRtMul   — 기준이 1 인 축(배수형). 마디 몫을 **더한다**.
//   campRtNodeMul — 기준이 1 이 아닌 축(확률·시간·간격·할인·인구). 마디 몫을 **곱한다**.
const LIVE = [];
for(const fn of ['campRtMul(', 'campRtNodeMul(']){
  const Q = String.fromCharCode(39), MARK = fn + Q;
  let i = 0;
  while((i = SRC.indexOf(MARK, i)) >= 0){
    const j = SRC.indexOf(Q, i + MARK.length);
    if(j < 0) break;
    const k = SRC.slice(i + MARK.length, j);
    if(/^[A-Za-z]+$/.test(k) && LIVE.indexOf(k) < 0) LIVE.push(k);
    i = j; } }
console.log('⭐ 마디 몫이 닿는 계열 ' + LIVE.length + '개: ' + LIVE.join(' '));
console.log('   (적 약화 8계열은 campRtCut 을 갈래째 돌아 전부 닿는다)');
console.log('');
const out = await pg.evaluate(LIVEIN => {
  const C = campState(); const keep = JSON.parse(JSON.stringify(C.rbTree || {}));
  // 계열 하나의 「지금 값」을 꺼내는 길 — 계열마다 다르다
  // ⚠ 「값이 변하나」가 아니라 **「그 값을 쓰는가」**로 가른다
  const live = k => { const L = campRtLine(k); if(!L) return false;
    return L.br === 'enemy' || LIVEIN.indexOf(k) >= 0; };
  const res = [];
  try {
    for(const bk in CAMP_TREE_BR){
      if(campRtIsChain(bk)) continue;
      const B = CAMP_TREE_BR[bk];
      // ── 갈래 마디
      const lines = CAMP_RT_LINES.filter(L => L.br === bk);
      const hit = lines.filter(L => live(L.k)).map(L => L.nm);
      const miss = lines.filter(L => !live(L.k)).map(L => L.nm);
      res.push({ kind:'갈래', br:B.nm, col:B.col, pct:Math.round(CAMP_RT_NODE_BR*100),
                 cost:CAMP_RT_BR_COST, hit, miss });
      // ── 묶음 마디
      for(const g of CAMP_RT_GRP_KEYS){
        if(!campRtGpLive(bk, g)) continue;
        const gl = CAMP_RT_LINES.filter(L => L.br === bk && L.grp === g);
        const hit2 = gl.filter(L => live(L.k)).map(L => L.nm);
        const miss2 = gl.filter(L => !live(L.k)).map(L => L.nm);
        res.push({ kind:'묶음 ' + g, br:B.nm, col:B.col, pct:Math.round(CAMP_RT_NODE_GP*100),
                   cost:CAMP_RT_GP_COST, hit:hit2, miss:miss2 });
      }
    }
  } finally { C.rbTree = keep; }
  return res;
}, LIVE);
let n = 0;
for(const r of out){ n++;
  console.log('■ ' + r.br + ' — ' + r.kind + ' 마디 (' + r.cost + 'pt · +' + r.pct + '%)');
  console.log('   닿는다: ' + (r.hit.length ? r.hit.join(' · ') : '(없다)'));
  if(r.miss.length) console.log('   ⚠ 안 닿는다: ' + r.miss.join(' · '));
}
console.log('\n마디 ' + n + '개');
await b.close(); server.close();
