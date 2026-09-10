const fs=require('fs');
const rep=(F,a,b,t)=>{let s=fs.readFileSync(F,'utf8');
 if(s.split(a).length!==2){console.error('MISS '+t);process.exit(1);}
 fs.writeFileSync(F,s.replace(a,b));};
rep('test/smoke.js',
`    { const S=guideState(), on0=window.campIsOn, off0=TUTO_OFF, sh=$('btSheet');
      const t0=S?S.t:0, run0=S?S.trun:null, skip0=S?S.skip:null;
      const st0=sh?sh.style.cssText:null;
      try{ if(S && sh){ window.campIsOn=()=>true; TUTO_OFF=false;`,
`    { const S=guideState(), on0=window.campIsOn, off0=TUTO_OFF, sh=$('btSheet');
      const t0=S?S.t:0, run0=S?S.trun:null, skip0=S?S.skip:null;
      const st0=sh?sh.style.cssText:null;
      // ⚠ 시트를 **#phone 안으로 옮겨 놓고** 잰다 — 캠프 화면이 아닐 때 #btSheet 은 인게임 층에
      //   있어 화면(폰) 밖에 앉는다. 그러면 무엇을 해도 틀이 안 변해 계약이 헛돈다.
      const par0=sh?sh.parentNode:null, nx0=sh?sh.nextSibling:null;
      try{ if(S && sh){ window.campIsOn=()=>true; TUTO_OFF=false;
          $('phone').appendChild(sh);`,'옮김');
rep('test/smoke.js',
`          const put=(h)=>{ sh.style.cssText='position:fixed;left:0;right:0;bottom:0;height:'
            +h+'px;display:block;visibility:visible;transform:none;z-index:1'; return read(); };`,
`          const put=(h)=>{ sh.style.cssText='position:absolute;left:0;right:0;bottom:0;height:'
            +h+'px;display:block;visibility:visible;transform:none;z-index:1'; return read(); };`,'절대');
rep('test/smoke.js',
`      } finally { window.campIsOn=on0; TUTO_OFF=off0;
        if(sh) sh.style.cssText=st0||'';
        if(S){ S.t=t0; if(run0!=null) S.trun=run0; else delete S.trun;
          if(skip0!=null) S.skip=skip0; else delete S.skip; }
        tutoPaint(); } }`,
`      } finally { window.campIsOn=on0; TUTO_OFF=off0;
        if(sh){ sh.style.cssText=st0||'';
          if(par0){ if(nx0) par0.insertBefore(sh, nx0); else par0.appendChild(sh); } }
        if(S){ S.t=t0; if(run0!=null) S.trun=run0; else delete S.trun;
          if(skip0!=null) S.skip=skip0; else delete S.skip; }
        tutoPaint(); } }`,'복원');
console.log('ok');
