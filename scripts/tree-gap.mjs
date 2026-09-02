/* ============================================================================
 * tree-gap.mjs — 🌌 갈래끼리 얼마나 겹치나 (2026-09-02)
 *
 * ⚠ 배치를 눈으로만 고치면 한쪽을 떼는 순간 다른 쪽이 붙는다. 숫자로 같이 본다.
 *   재는 것: **다른 갈래에 속한 별 사이의 최단 거리**(월드 단위) — 작을수록 겹친다.
 *   ⭐ 그림은 scripts/tree-shot.mjs 가 맡는다. 둘을 함께 볼 것.
 * 사용: CHROME_PATH=... node scripts/tree-gap.mjs
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 let f=path.join(ROOT,p==='/'?'sc-ums-web.html':p); if(!f.startsWith(ROOT)){s.writeHead(403);return s.end();}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:'new',protocolTimeout:300000,
  args:['--mute-audio','--no-sandbox','--disable-gpu-sandbox']});
const pg=await b.newPage(); await pg.setViewport({width:390,height:844});
await pg.goto(`http://127.0.0.1:${server.address().port}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof campTreePos==="function"',{timeout:30000});
const out=await pg.evaluate(()=>{
  const L=[];
  // ⭐ 그리지 않고 **좌표 함수만** 부른다 — 화면 상태에 안 흔들린다.
  const pts=[];
  for(const Ln of CAMP_RT_LINES)
    for(let n=1,mx=campRtMax(Ln.k); n<=mx; n++){ const p=campTreePos(Ln.k,n);
      pts.push({br:Ln.br, k:Ln.k, n, x:p.x, y:p.y}); }
  for(const bk in CAMP_TREE_BR){ if(campRtIsChain(bk)) continue;
    const p=campTreeBrPos(bk); pts.push({br:bk,k:'br',n:0,x:p.x,y:p.y});
    for(const g of CAMP_RT_GRP_KEYS){ if(!campRtGpLive(bk,g)) continue;
      const q=campTreeGpPos(bk,g); pts.push({br:bk,k:'gp'+g,n:0,x:q.x,y:q.y}); } }
  const brs=Object.keys(CAMP_TREE_BR);
  L.push('별 '+pts.length+'개 · 갈래 각도: '+brs.map(b=>b+' '+(CAMP_TREE_BR[b].a/Math.PI).toFixed(2)+'π(r'+CAMP_TREE_BR[b].rk+')').join(' · '));
  L.push('');
  L.push('■ 갈래끼리 최단 거리 (작을수록 겹친다 · 별 지름은 26~30)');
  const pairs=[];
  for(let i=0;i<brs.length;i++) for(let j=i+1;j<brs.length;j++){
    const A=pts.filter(p=>p.br===brs[i]), B=pts.filter(p=>p.br===brs[j]);
    let best=1e9, who='';
    for(const a of A) for(const c of B){ const d=Math.hypot(a.x-c.x,a.y-c.y);
      if(d<best){ best=d; who=a.k+':'+a.n+' ↔ '+c.k+':'+c.n; } }
    pairs.push({p:brs[i]+' ↔ '+brs[j], d:best, who}); }
  pairs.sort((x,y)=>x.d-y.d);
  for(const p of pairs) L.push('  '+(p.d<34?'⛔':(p.d<50?'⚠ ':'✅'))+' '+p.p.padEnd(16)+' '+p.d.toFixed(0).padStart(4)+'   ('+p.who+')');
  // 같은 갈래 안에서도 너무 붙은 것
  L.push('');
  L.push('■ 같은 갈래 안 최단 거리');
  for(const bk of brs){ const A=pts.filter(p=>p.br===bk); let best=1e9, who='';
    for(let i=0;i<A.length;i++) for(let j=i+1;j<A.length;j++){
      const d=Math.hypot(A[i].x-A[j].x,A[i].y-A[j].y);
      if(d<best){ best=d; who=A[i].k+':'+A[i].n+' ↔ '+A[j].k+':'+A[j].n; } }
    L.push('  '+(best<34?'⛔':(best<50?'⚠ ':'✅'))+' '+bk.padEnd(8)+' '+best.toFixed(0).padStart(4)+'   ('+who+')'); }
  // 전체 경계 — 화면 비율(가로:세로 = 430:840)에 맞나
  { let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    for(const p of pts){ x0=Math.min(x0,p.x); x1=Math.max(x1,p.x); y0=Math.min(y0,p.y); y1=Math.max(y1,p.y); }
    L.push('');
    L.push('■ 전체 경계 '+(x1-x0).toFixed(0)+'×'+(y1-y0).toFixed(0)
      +' (가로÷세로 '+((x1-x0)/(y1-y0)).toFixed(2)+' · 화면은 0.51 — 1 보다 크면 가로가 남아 세로가 빈다)'); }
  return L;
});
console.log(out.join('\n'));
await b.close(); server.close();
