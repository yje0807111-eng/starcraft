/* ============================================================================
 * 스모크 테스트 러너 — `npm test`
 * 내장 정적 서버로 리포 루트를 서빙하고, 시스템 크롬(헤드리스)에서
 * sc-ums-web.html을 열어 test/smoke.js를 주입, 그룹별(새 페이지=상태 격리)로
 * runSmoke()를 실행해 결과 표를 출력한다. 실패가 있으면 exit 1.
 *
 * 사용:
 *   npm test                — 전 그룹(lobby/game/sandbox)
 *   node test/run-smoke.mjs game   — 특정 그룹만
 *   HEADFUL=1 npm test      — 창 띄워서(디버깅)
 * ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const CHROME_CANDIDATES=[
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH||'',
].filter(Boolean);
const CHROME=CHROME_CANDIDATES.find(p=>fs.existsSync(p));
if(!CHROME){ console.error('크롬을 찾을 수 없습니다. CHROME_PATH 환경변수로 지정하세요.'); process.exit(2); }

const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary',
  '.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  try{
    const p=decodeURIComponent(new URL(req.url,'http://x').pathname);
    let f=path.join(ROOT, p==='/'?'sc-ums-web.html':p);
    if(!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  }catch(e){ res.writeHead(500); res.end(String(e)); }
});

const groupsArg=process.argv[2];
const GROUPS=(groupsArg && groupsArg!=='duo')?[groupsArg]:(groupsArg==='duo'?[]:['lobby','game','sandbox']);
const SMOKE_SRC=fs.readFileSync(path.join(ROOT,'test','smoke.js'),'utf8');

await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PORT=server.address().port;
const browser=await puppeteer.launch({ executablePath:CHROME, headless:process.env.HEADFUL?false:'new',
  args:['--mute-audio','--disable-gpu-sandbox','--no-sandbox'] });

let anyFail=false; const allReports=[];
try{
  for(const g of GROUPS){
    const page=await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({width:390,height:844,deviceScaleFactor:1});
    const pageErrors=[];
    page.on('pageerror', e=>pageErrors.push(String(e.message||e).slice(0,200)));
    await page.goto(`http://127.0.0.1:${PORT}/sc-ums-web.html`, {waitUntil:'load'});
    await page.evaluate(SMOKE_SRC);
    await page.waitForFunction('typeof G!=="undefined"', {timeout:15000});
    await new Promise(r=>setTimeout(r,800));   // 초기 모델/폰트 로드 여유
    const report=await page.evaluate(gg=>window.runSmoke(gg), g);
    report.pageErrors=pageErrors.slice(0,10);
    allReports.push(report);
    await page.close();
  }
  // ── 두 클라이언트 통합(멀티) — 그룹 지정이 없을 때만. 상대 시점까지 본다.
  //    스모크는 가짜 채널로 '보내는 것'만 잡는다. 보내는 모양과 받는 모양이 어긋나는
  //    (= 멀티가 조용히 죽는) 경우는 여기서만 잡힌다.
  if(!groupsArg || groupsArg==='duo'){
    const { runDuo }=await import('./duo.mjs');
    const steps=await runDuo(browser, `http://127.0.0.1:${PORT}/sc-ums-web.html`);
    allReports.push({ group:'duo(2인)', steps,
      pass:steps.filter(s=>s.ok).length, fail:steps.filter(s=>!s.ok).length, skip:0,
      ms:steps.reduce((a,s)=>a+s.ms,0), knownNoise:0, errors:[], pageErrors:[] });
  }
}finally{ await browser.close(); server.close(); }

// ── 결과 출력 ──
for(const r of allReports){
  console.log(`\n■ 그룹 [${r.group}]  pass ${r.pass} / fail ${r.fail} / skip ${r.skip}  (${r.ms}ms, 알려진 GLB경고 ${r.knownNoise}건)`);
  for(const s of r.steps){
    const mark=s.skip?'◌':(s.ok?'✔':'✘');
    console.log(`  ${mark} ${s.name}${s.detail?'  — '+s.detail:''}`);
  }
  if(r.errors.length){ console.log('  ⚠ 콘솔 오류:'); r.errors.forEach(e=>console.log('    · '+e)); }
  if(r.pageErrors&&r.pageErrors.length){ console.log('  ⚠ 페이지 예외:'); r.pageErrors.forEach(e=>console.log('    · '+e)); }
  if(r.fail>0 || r.errors.length || (r.pageErrors&&r.pageErrors.length)) anyFail=true;
}
console.log('\n'+(anyFail?'❌ 스모크 실패':'✅ 스모크 전체 통과'));
process.exit(anyFail?1:0);
