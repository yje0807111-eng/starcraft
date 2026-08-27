import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ROOT='/home/user/starcraft', OUT=process.env.OUT;
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.woff2':'font/woff2','.woff':'font/woff','.mp4':'video/mp4','.webm':'video/webm'};
const srv=http.createServer((q,s)=>{ try{ const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
  const f=path.join(ROOT,p==='/'?'sc-ums-web.html':p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
  s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();} });
await new Promise(r=>srv.listen(0,'127.0.0.1',r)); const PORT=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--mute-audio','--no-sandbox']});
const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
pg.on('pageerror',e=>console.log('ERR',String(e.message).slice(0,160)));
await pg.goto(`http://127.0.0.1:${PORT}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof G!=="undefined"',{timeout:20000});
await pg.waitForFunction(()=>{const e=document.getElementById('auth');return e&&!e.classList.contains('hide');},{timeout:25000});
await pg.evaluate(()=>{ AUTH.user={uid:'me',nick:'지휘관'};
  ['auth','authGate'].forEach(i=>{const e=document.getElementById(i); if(e){e.classList.add('hide');e.style.display='none';}});
  openMapSelect(); });
await pg.waitForTimeout(800);
await pg.evaluate(async ()=>{ const m=MAPS.find(x=>x.id==='nemo')||MAPS.find(x=>!x.hidden&&x.playable!==false);
  openModeSheet(m); chooseSolo();
  const go=[...document.querySelectorAll('#soloDiffPanel button, #soloDiffPanel .actBtn')].find(x=>/시작/.test(x.textContent));
  if(go) go.click(); });
await pg.waitForTimeout(3500);
await pg.evaluate(()=>{ try{ if(typeof gsSkip==='function') gsSkip(); }catch(e){} });
await pg.waitForTimeout(2200);
// 후보 CSS + 요약 줄(V3·V4·V8 용) 심기
await pg.addStyleTag({url:'/docs/mock/result-screen-p8.css'});
// 목업 골격 — 제목(위 34%·본문 글꼴) / 게임 안 기록 줄 / **미네랄·가스 같은 급** / 버튼 둘
// ⛔ 재화 아이콘은 resIco() 로만 — 이모지 금지(CLAUDE.md).
await pg.evaluate(()=>{ const ov=document.getElementById('ov'); if(ov.querySelector('.rsX')) return;
  const RI=(k)=>(typeof resIco==='function')?resIco(k):'';
  const row=(label,val,cls)=>'<div class="rsRow'+(cls?' '+cls:'')+'"><b>'+label+'</b><em>'+val+'</em></div>';
  const cur=(k,ko,val)=>'<div class="rsCurC" data-k="'+k+'"><span class="rsCurI">'+RI(ko)+'</span>'
    +'<span class="rsCurL">'+ko+'</span><b class="rsCurV">'+val+'</b></div>';
  const d=document.createElement('div'); d.className='rsX';
  d.innerHTML='<div class="rsTop"><div class="rsTtl">VICTORY</div>'
    +'<div class="rsMeta"><span class="rsDiff">EASY</span>네모네모 디펜스 · 12분 04초</div></div>'
    +'<div class="rsSpacer"></div>'
    +'<div class="rsRows">'+row('라운드','20 / 20')+row('처치','1,284')
      +row('최고 유닛','전략 폭격기')+row('획득 포인트','+3,150','hi')+'</div>'
    +'<div class="rsCur">'+cur('min','미네랄','+8,420')+cur('gas','가스','+1,684')+'</div>'
    +'<div class="rsBar"><i></i></div>'
    +'<div class="rsBtns"><button class="rsSub">관전하기</button><button class="rsPri">확인</button></div>';
  ov.appendChild(d); });
async function shoot(cls, kind, file){
  await pg.evaluate(({c,k})=>{ const ov=document.getElementById('ov'), x=ov.querySelector('.rsX');
    // ⚠ 진입 로딩(#gsRoot)은 한 번 걷어도 되살아난다 — **찍기 직전마다** 접는다
    { const g=document.getElementById('gsRoot'); if(g){ g.classList.add('hide'); g.style.display='none'; } }
    const e=document.getElementById('exitConfirm'); if(e) e.classList.add('hide');
    G.phase=(k==='win')?'won':'lost'; showOverlay();
    document.documentElement.className = (c==='v0')?'':c;
    ov.classList.toggle('rsOn', c!=='v0');
    ov.className=ov.className.replace(/\b[nmp][1-8]\b/g,'').trim();
    if(c!=='v0') ov.classList.add(c);
    x.classList.toggle('win', k==='win'); x.classList.toggle('lose', k!=='win');
    x.querySelector('.rsTtl').textContent=(k==='win')?'VICTORY':'DEFEAT';
  }, {c:cls, k:kind});
  await pg.waitForTimeout(900);   // ⚠ ovPop 페이드가 끝난 뒤에 찍는다 — 430ms 면 첫 칸이 흐리게 찍힌다
  const el=await pg.$('#phone'); await el.screenshot({path:path.join(OUT,file)});
}
// ⚠ 첫 장은 화면 전환 FX 가 위에 남아 **화면 전체가 어둡게** 찍힌다 — 한 장 버리고 시작한다
await shoot('p1','win','_warm.png');
const V=['p1','p2','p3','p4','p5','p6','p7','p8'];
for(const v of V){ await shoot(v,'win', 'rs-'+v+'-win.png'); }
await shoot('p1','lose','rs-p1-lose.png');

console.log('done');
await b.close(); srv.close();
