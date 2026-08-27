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
const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
pg.on('pageerror',e=>console.log('ERR',String(e.message).slice(0,140)));
await pg.goto(`http://127.0.0.1:${PORT}/sc-ums-web.html`,{waitUntil:'load'});
await pg.waitForFunction('typeof G!=="undefined"',{timeout:20000});
await pg.waitForFunction(()=>{const e=document.getElementById('auth');return e&&!e.classList.contains('hide');},{timeout:25000});
await pg.addStyleTag({url:'/docs/mock/exit-face-8.css'});
// 표본 = 글자가 없는 두 자리: 카드 **안쪽 왼쪽 아래 여백** / 같은 높이의 카드 **바깥**
async function sample(tag){
  const out={};
  for(const v of ['none','f3','f4','f1']){
    await pg.evaluate(c=>{ document.documentElement.className=(c==='none')?'':c;
      document.getElementById('exitConfirm').classList.remove('hide'); }, v);
    await pg.waitForTimeout(320);
    const r=await pg.evaluate(()=>{ const c=document.querySelector('#exitConfirm .ecCard').getBoundingClientRect();
      return {x:Math.round(c.left),y:Math.round(c.top),w:Math.round(c.width),h:Math.round(c.height)}; });
    const inClip={x:r.x+8,y:r.y+r.h-13,width:Math.min(40,r.w-16),height:6};       // 카드 안, 버튼 아래 여백
    const outClip={x:Math.max(0,r.x-46),y:inClip.y,width:38,height:6};             // 같은 높이의 카드 바깥
    const avg=async cl=>{ const buf=await pg.screenshot({clip:cl});
      // PNG 평균 — 작은 조각이라 그대로 디코드
      const {execSync}=await import('node:child_process');
      fs.writeFileSync('/tmp/s.png',buf);
      const o=execSync("python3 - <<'P'\nimport zlib,struct\nd=open('/tmp/s.png','rb').read();i=8;idat=b'';\nwhile i<len(d):\n ln=struct.unpack('>I',d[i:i+4])[0];t=d[i+4:i+8];x=d[i+8:i+8+ln]\n if t==b'IHDR': w,h,bd,ct=struct.unpack('>IIBB',x[:10])\n elif t==b'IDAT': idat+=x\n elif t==b'IEND': break\n i+=12+ln\nraw=zlib.decompress(idat);ch={0:1,2:3,3:1,4:2,6:4}[ct];st=w*ch\nout=bytearray();prev=bytearray(st);p=0\nfor y in range(h):\n f=raw[p];p+=1;L=bytearray(raw[p:p+st]);p+=st\n if f==1:\n  for k in range(ch,st): L[k]=(L[k]+L[k-ch])&255\n elif f==2:\n  for k in range(st): L[k]=(L[k]+prev[k])&255\n elif f==3:\n  for k in range(st):\n   a=L[k-ch] if k>=ch else 0\n   L[k]=(L[k]+((a+prev[k])>>1))&255\n elif f==4:\n  for k in range(st):\n   a=L[k-ch] if k>=ch else 0;bb=prev[k];c=prev[k-ch] if k>=ch else 0\n   pp=a+bb-c;pa=abs(pp-a);pb=abs(pp-bb);pc=abs(pp-c)\n   pr=a if (pa<=pb and pa<=pc) else (bb if pb<=pc else c)\n   L[k]=(L[k]+pr)&255\n out+=L;prev=L\nn=w*h;R=G=B=0\nfor y in range(h):\n for x in range(w):\n  i2=(y*w+x)*ch;R+=out[i2];G+=out[i2+1];B+=out[i2+2]\nprint(round(R/n,1),round(G/n,1),round(B/n,1))\nP",{encoding:'utf8'}).trim().split(' ').map(Number);
      return o; };
    const A=await avg(inClip), B2=await avg(outClip);
    const lum=c=>+(0.2126*c[0]+0.7152*c[1]+0.0722*c[2]).toFixed(1);
    const sat=c=>+(Math.max(...c)-Math.min(...c)).toFixed(1);
    out[v]={ 안:A.join(','), 밖:B2.join(','), 안밝기:lum(A), 밖밝기:lum(B2),
      차이:+(lum(A)-lum(B2)).toFixed(1), 안채도:sat(A), 밖채도:sat(B2) };
  }
  console.log(tag, JSON.stringify(out,null,1));
  await pg.evaluate(()=>{ document.getElementById('exitConfirm').classList.add('hide'); document.documentElement.className=''; });
}
await sample('① 로그인(밝은 노을)');
await pg.evaluate(()=>{ AUTH.user={uid:'me',nick:'지휘관'};
  ['auth','authGate'].forEach(i=>{const e=document.getElementById(i); if(e){e.classList.add('hide');e.style.display='none';}});
  openMapSelect(); });
await pg.waitForTimeout(1100); await sample('② 유즈맵 선택');
await pg.evaluate(()=>{ try{ openHome(); }catch(e){} }); await pg.waitForTimeout(1500);
await pg.evaluate(()=>{ try{ if(document.getElementById('campRaceOv')){ campRaceSel('terran'); campPickRace(); } }catch(e){} });
await pg.waitForTimeout(2800); await sample('③ 캠프(초록 지형)');
await b.close(); srv.close();
