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

// 🚪 브라우저를 켜기 전에 **정적 검사** 한 번 — 「여는 함수는 있는데 부르는 곳이 없는 것」을 잡는다.
//    선례: 마을을 다락으로 보내자 로그아웃 확인창이 고아가 됐다(화면은 멀쩡한데 들어갈 길이 사라짐 · 2026-08-27).
//    스모크는 화면을 직접 열어 검사하므로 이런 「입구만 사라진 것」을 못 잡는다.
{ const { execFileSync }=await import('node:child_process');
  try{ const out=execFileSync(process.execPath, [path.join(ROOT,'scripts','attic-orphans.mjs')],
        { cwd:ROOT, encoding:'utf8' });
    console.log(out.trim().split('\n').map(l=>'  '+l).join('\n'));
  }catch(e){
    console.log((e.stdout||'').trim().split('\n').map(l=>'  '+l).join('\n'));
    console.error('\n❌ 고아 입구 검사 실패 — 위 목록을 먼저 보세요.');
    process.exit(1); }
  // 🗄 죽은 코드 래칫(2026-09-05 · ATTIC.md §5) — 아무도 안 부르는 함수 · 어디에도 없는 CSS 클래스가
  //    test/dead-known.json 밖에서 새로 생기면 여기서 멈춘다. 다락 이사가 한 번짜리로 끝나고
  //    옛 CSS 가 살아 있는 척하며 새 화면에 재사용되던 것(사용자 지적)을 막는 유일한 장치다.
  try{ const out=execFileSync(process.execPath, [path.join(ROOT,'scripts','dead-audit.mjs')],
        { cwd:ROOT, encoding:'utf8' });
    console.log(out.trim().split('\n').map(l=>'  '+l).join('\n'));
  }catch(e){
    console.log((e.stdout||'').trim().split('\n').map(l=>'  '+l).join('\n'));
    console.error('\n❌ 죽은 코드 래칫 — 다락으로 옮기거나(scripts/attic-move.mjs · attic-css.mjs) 이유를 적어 test/dead-known.json 에.');
    process.exit(1); }
}

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
// 🔁 **흔들리는 검사 잡기** (2026-09-05)
//   SMOKE_REPEAT=n  — 같은 그룹을 n번 돌리고, 스텝별로 몇 번 실패했나 집계한다.
//                     흔들림은 한 판으로 못 본다 — 「몇 판 중 몇 번」이 있어야 잡은 것인지 안다.
//   SMOKE_ONLY=문구  — 이름에 그 문구가 든 스텝만 돌린다(나머지는 건너뜀).
//                     ⚠ 스텝은 앞 스텝의 상태에 기대는 것이 많다(캠프 진입 뒤에 캠프 검사 등).
//                       골라 돌릴 때는 앞 스텝도 문구에 걸리게 넓게 잡을 것 — 안 그러면
//                       「고쳤는데 여전히 실패」가 실은 「준비가 안 됐다」일 수 있다.
const REPEAT=Math.max(1, +(process.env.SMOKE_REPEAT||1));
const ONLY=(process.env.SMOKE_ONLY||'').trim();
const SMOKE_SRC=fs.readFileSync(path.join(ROOT,'test','smoke.js'),'utf8');

// ── 프리플라이트: css/ 안의 상대 경로가 살아 있는가 ─────────────────────
// ⚠ CSS 의 url() 은 **CSS 파일 위치** 기준으로 풀린다. 스타일이 sc-ums-web.html 안에
//   있을 땐 assets/... 가 맞았지만 css/ 로 옮긴 뒤로는 ../assets/... 여야 한다.
//   실제로 이걸 놓쳐 로딩 화면 배경 아트가 통째로 안 떴다(2026-08-20). 브라우저는
//   배경 이미지가 없어도 조용히 넘어가므로 스모크로는 안 잡힌다 — 여기서 정적으로 막는다.
{ const cssDir=path.join(ROOT,'css'); const bad=[];
  for(const f of (fs.existsSync(cssDir)?fs.readdirSync(cssDir):[])){
    if(!f.endsWith('.css')) continue;
    const src=fs.readFileSync(path.join(cssDir,f),'utf8');
    for(const m of src.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)){
      const u=m[2].trim();
      if(/^(data:|https?:|\/\/|\/)/.test(u)) continue;          // 데이터 URI·원격·절대경로는 검사 대상 아님
      const rel=u.split('?')[0].split('#')[0];
      if(!fs.existsSync(path.resolve(cssDir, rel))) bad.push(`css/${f} → ${u}`);
    } }
  if(bad.length){ console.error('\n❌ CSS 상대 경로가 깨졌습니다 (css/ 기준으로 풀립니다 — ../assets/… 여야 합니다):');
    bad.forEach(b=>console.error('   · '+b)); process.exit(1); }
  console.log('✓ CSS 상대 경로 확인'); }

await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PORT=server.address().port;
const browser=await puppeteer.launch({ executablePath:CHROME, headless:process.env.HEADFUL?false:'new',
  args:['--mute-audio','--disable-gpu-sandbox','--no-sandbox'] });

let anyFail=false; const allReports=[];
const tally={};   // 🔁 REPEAT 집계 — 스텝 이름 → { fail, runs, msgs }
try{
  for(const g of GROUPS) for(let rep=0; rep<REPEAT; rep++){
    // 🧼 **페이지마다 새 브라우저 컨텍스트** — 새 탭만 열면 localStorage 가 그대로 남아 다음 판이
    //    앞 판의 저장본(캠프 진행·설정)을 물려받는다. REPEAT 2판째부터 캠프 스텝 여덟이 한꺼번에
    //    넘어진 것이 그것이었다(2026-09-07 실측 · 1판째 0 / 2판째 6 / 3판째 8). 격리는 컨텍스트가 한다.
    const ctx=await browser.createBrowserContext();
    const page=await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({width:390,height:844,deviceScaleFactor:1});
    const pageErrors=[];
    page.on('pageerror', e=>pageErrors.push(String(e.message||e).slice(0,200)));
    await page.goto(`http://127.0.0.1:${PORT}/sc-ums-web.html`, {waitUntil:'load'});
    if(ONLY) await page.evaluate(o=>{ window.__SMOKE_ONLY=o; }, ONLY);
    await page.evaluate(SMOKE_SRC);
    await page.waitForFunction('typeof G!=="undefined"', {timeout:15000});
    await new Promise(r=>setTimeout(r,800));   // 초기 모델/폰트 로드 여유
    const report=await page.evaluate(gg=>window.runSmoke(gg), g);
    report.pageErrors=pageErrors.slice(0,10);
    if(REPEAT>1){
      for(const st of report.steps){ if(st.skip) continue;
        const t=tally[st.name]||(tally[st.name]={fail:0,runs:0,msgs:new Set()});
        t.runs++; if(!st.ok){ t.fail++; t.msgs.add(st.detail.slice(0,120)); } }
      console.log(`  · ${g} ${rep+1}/${REPEAT}: fail ${report.fail} (${report.ms}ms)`
        + (report.fail?'  ✘ '+report.steps.filter(s=>!s.ok&&!s.skip).map(s=>s.name.slice(0,40)).join(' | '):''));
      if(rep<REPEAT-1){ await ctx.close(); continue; } }
    allReports.push(report);
    await ctx.close();
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
if(REPEAT>1){
  const rows=Object.entries(tally).filter(([,t])=>t.fail>0).sort((a,b)=>b[1].fail-a[1].fail);
  console.log(`\n■ 🔁 ${REPEAT}번 반복 — 흔들린 스텝 (${rows.length}개)`);
  if(!rows.length) console.log('  (없음 — 전부 매번 통과)');
  for(const [name,t] of rows){ console.log(`  ${t.fail}/${t.runs}  ${name}`);
    for(const m of t.msgs) console.log(`         — ${m}`); } }
console.log('\n'+(anyFail?'❌ 스모크 실패':'✅ 스모크 전체 통과'));
process.exit(anyFail?1:0);
