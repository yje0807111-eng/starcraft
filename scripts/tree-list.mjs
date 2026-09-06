/* tree-list.mjs — 🌳 환생 트리에 지금 무엇이 들어 있나 (2026-09-02)
 * ⛔ 문서에서 옮겨 적지 말 것 — 실제 함수를 불러서 뽑는다(표와 코드가 어긋나 있을 수 있다).
 * 사용: CHROME_PATH=... node scripts/tree-list.mjs */
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
await pg.waitForFunction('typeof campRtCost==="function"',{timeout:30000});
const out=await pg.evaluate(()=>{
  const L=[]; const N=n=>{ if(!isFinite(n)) return '∞';
    for(const [s,v] of [['조',1e12],['억',1e8],['만',1e4]]) if(n>=v) return (n/v).toFixed(n/v<10?1:0)+s;
    return String(Math.round(n)); };
  const P=(s,n)=>{ let w=0; for(const c of String(s)) w+= (c.charCodeAt(0)>0x2000?2:1);
    return String(s)+' '.repeat(Math.max(0,n-w)); };
  const src=String(campRtMul)+String(campRtCut)+'';
  // 배선 확인 — 그 계열의 f 나 키가 코드 어디선가 실제로 쓰이나
  const all=[campTapGain,campGatherMul,campSupAdd,campRtFoeMul,campHoldMs,campFevPct,campFevMul,campFevSec]
    .map(f=>String(f)).join('\n');
  const brNm={enemy:'적 약화',econ:'재화 획득',start:'시작 도움',army:'아군 강화'};
  L.push('■ 갈래 4 · 묶음 '+Object.keys(CAMP_TREE_BR).length*CAMP_RT_GRP_KEYS.length+' · 계열 '+CAMP_RT_LINES.length
    +' · 살 수 있는 칸 '+campTreeTotal()+'개');
  for(const bk of ['start','econ','army','enemy']){
    const lines=CAMP_RT_LINES.filter(x=>x.br===bk);
    L.push('');
    L.push('════ '+brNm[bk]+' ('+bk+') · 계열 '+lines.length+(campRtIsChain(bk)?' · ⛓ 사슬':'')+' ════');
    for(const g of CAMP_RT_GRP_KEYS){
      const gl=lines.filter(x=>x.grp===g); if(!gl.length) continue;
      L.push('  ─ 묶음 '+g+' ─');
      for(const x of gl){
        const mx=campRtMax(x.k);
        const vals=[]; for(let n=1;n<=mx;n++) vals.push(campTreeVal(x.k,n));
        const cost=[]; for(let n=1;n<=mx;n++) cost.push(N(campRtCost(x.k,n)));
        L.push('    '+P(x.nm,16)+P('['+x.k+']',12)+P(campRtGrade(x.k,1),4)+mx+'차');
        L.push('        값  '+vals.join(' → '));
        L.push('        값어치 '+cost.join(' · ')+' 포인트');
        if(x.pa) L.push('        선행 '+x.pa);
        L.push('        뜻  '+(x.ds||'').replace(/<[^>]+>/g,'').replace('{}','__'));
      } } }
  return L;
});
console.log(out.join('\n'));
await b.close(); server.close();
