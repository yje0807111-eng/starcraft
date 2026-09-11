/* ============================================================================
 * camp-ramp-pick.mjs — 🚪 **오르막 그림**을 눈으로 고른다 (2026-09-11)
 *   게임을 통째로 띄우지 않고, 진짜 바닥 타일 + 진짜 TERR_SKIN 값으로 절벽과
 *   오르막만 그려 여러 안을 한 장에 붙인다. 고른 안을 24-terrain.js 에 옮긴다.
 *   ⚠ 이 파일은 **고르는 도구**다 — 여기 그림이 게임에 쓰이는 게 아니다.
 * 사용: CHROME_PATH=... node scripts/camp-ramp-pick.mjs
 * ========================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url'; import puppeteer from 'puppeteer-core';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'docs/mock'); fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 let f=path.join(ROOT,p==='/'?'sc-ums-web.html':p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end('nf');}
 s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(s);
}catch(e){s.writeHead(500);s.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PORT=server.address().port;
const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:'new',protocolTimeout:300000,args:['--no-sandbox','--disable-gpu-sandbox']});
const pg=await b.newPage(); await pg.setViewport({width:1180,height:900,deviceScaleFactor:2});
await pg.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'domcontentloaded'});
await pg.setContent(`<body style="margin:0;background:#0b0d12"><div id=g></div></body>`);
await pg.evaluate(p=>{ window.__tile='http://127.0.0.1:'+p+'/assets/tiles/camp_metal.webp'; }, PORT);

const N = await pg.evaluate(async () => {
  const HI  = { top:'rgba(152,174,208,.30)', face:'#232935', edge:'rgba(176,196,224,.50)', line:'rgba(8,11,17,.72)', lip:'rgba(198,216,240,.62)' };
  const RM  = { top:'rgba(186,210,240,.40)', face:'#2c3442', edge:'rgba(200,220,245,.62)', line:'rgba(8,11,17,.60)', lip:'rgba(214,232,255,.72)' };
  const img = new Image(); img.src = window.__tile; await img.decode();
  const CELL = 15, COLS = 26, ROWS = 16, PLAT = 7, RW = 5, RX = 10, FACE = Math.round(CELL*0.62);
  // 안들 — 각자 「비탈 한 칸」을 그린다(X0,X1,Y,HH 는 같다)
  /* ⭐ 오르막은 **절벽에 난 틈**이다 — 절벽 선에서 시작해 낮은 땅으로 내려간다.
   *   ⛔ 절벽 선 **위**(고원 안)에서 시작하지 말 것: 고원과 다른 것은 무엇이든 「고원에 올려놓은 상자」로 읽힌다
   *   (2026-09-11 실측 · camp-ramp-pick 1차). */
  const VAR = [
   ['A 비탈 — 절벽 선에서 낮은 땅으로', (x,G)=>{ const {X0,X1,Y,HH,lip}=G, ins=(X1-X0)*0.10, wq=CELL*0.34;
      G.slope(x,ins,(gr)=>{ gr.addColorStop(0,HI.top); gr.addColorStop(.45,'rgba(120,140,170,.18)'); gr.addColorStop(1,'rgba(120,140,170,0)'); });
      G.grooves(x,ins,2,.42); G.wedge(x,ins,wq,HI.face); G.wedge(x,ins,lip*.9,HI.lip); }],

   ['B 계단 세 줄', (x,G)=>{ const {X0,X1,Y,HH,lip}=G, ins=(X1-X0)*0.10, wq=CELL*0.34;
      G.slope(x,ins,(gr)=>{ gr.addColorStop(0,HI.top); gr.addColorStop(.45,'rgba(120,140,170,.18)'); gr.addColorStop(1,'rgba(120,140,170,0)'); });
      G.grooves(x,ins,3,.42); G.wedge(x,ins,wq,HI.face); G.wedge(x,ins,lip*.9,HI.lip); }],

   ['C 그늘로 내려간다(아래가 어둡다)', (x,G)=>{ const {X0,X1,Y,HH,lip}=G, ins=(X1-X0)*0.10, wq=CELL*0.34;
      G.slope(x,ins,(gr)=>{ gr.addColorStop(0,HI.top); gr.addColorStop(.40,'rgba(90,106,132,.20)'); gr.addColorStop(.85,'rgba(14,18,27,.30)'); gr.addColorStop(1,'rgba(14,18,27,0)'); });
      G.grooves(x,ins,2,.42); G.wedge(x,ins,wq,HI.face); G.wedge(x,ins,lip*.9,HI.lip); }],

   ['D 단 셋이 또렷하게', (x,G)=>{ const {X0,X1,Y,HH,lip}=G, ins=(X1-X0)*0.10, wq=CELL*0.34, n=3;
      x.save(); G.clip(x,ins);
      for(let k=0;k<n;k++){ const t0=k/n,t1=(k+1)/n,a=.26-.08*k;
        x.fillStyle='rgba(140,162,196,'+a.toFixed(3)+')'; x.fillRect(X0-CELL,Y+HH*t0,X1-X0+CELL*2,HH*(t1-t0));
        x.fillStyle='rgba(8,11,17,.46)'; x.fillRect(X0-CELL,Y+HH*t1-lip*.85,X1-X0+CELL*2,lip*.85); }
      x.restore(); G.wedge(x,ins,wq,HI.face); G.wedge(x,ins,lip*.9,HI.lip); }],

   ['E 고원 쪽으로 반 칸 물린다', (x,G)=>{ const {X1,X0,lip}=G, ins=(X1-X0)*0.10, wq=CELL*0.34;
      G.up=CELL*0.42;
      G.slope(x,ins,(gr)=>{ gr.addColorStop(0,HI.top); gr.addColorStop(.45,'rgba(120,140,170,.18)'); gr.addColorStop(1,'rgba(120,140,170,0)'); });
      G.grooves(x,ins,2,.42); G.wedge(x,ins,wq,HI.face); G.wedge(x,ins,lip*.9,HI.lip); G.up=0; }],

   ['F 옆벽만 두껍게(면은 거의 투명)', (x,G)=>{ const {X1,X0,lip}=G, ins=(X1-X0)*0.04, wq=CELL*0.55;
      G.slope(x,ins,(gr)=>{ gr.addColorStop(0,HI.top); gr.addColorStop(.5,'rgba(120,140,170,.10)'); gr.addColorStop(1,'rgba(120,140,170,0)'); });
      G.grooves(x,ins,2,.34); G.wedge(x,ins,wq,HI.face); G.wedge(x,ins,lip*1.1,HI.lip); }],
  ];
  const host=document.getElementById('g');
  host.style.cssText='display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:14px;font:12px system-ui;color:#cdd6e6';
  for(const [name,fn] of VAR){
    const wrap=document.createElement('div'); wrap.innerHTML='<div style="margin:0 0 4px">'+name+'</div>';
    /* ⚠ 게임과 **같은 겹치기**로 본다 — 바닥은 아래 층(배경 그림), 지형은 그 위 **투명 캔버스**다.
     *   ⛔ 한 캔버스에 같이 그리지 말 것: clearRect 가 바닥까지 지워 비탈이 **검은 구멍**으로 보인다
     *   (2026-09-11 · 1차 비교판이 통째로 거짓이었다). */
    const box=document.createElement('div');
    box.style.cssText='position:relative;width:'+(COLS*CELL)+'px;height:'+(ROWS*CELL)+'px;'+
      'background:url('+window.__tile+') 0 0/190px 190px repeat';
    const cv=document.createElement('canvas'); cv.width=COLS*CELL*2; cv.height=ROWS*CELL*2;
    cv.style.cssText='position:absolute;inset:0;width:'+(COLS*CELL)+'px;height:'+(ROWS*CELL)+'px';
    const x=cv.getContext('2d'); x.setTransform(2,0,0,2,0,0);
    // 고원 윗면 + 절벽 앞면(오르막 열만 비운다)
    x.fillStyle=HI.top; x.fillRect(0,0,COLS*CELL,PLAT*CELL);
    for(let tx=0;tx<COLS;tx++){
      if(tx>=RX && tx<RX+RW) continue;
      const Y=PLAT*CELL, lip=Math.max(1,CELL*0.09);
      x.fillStyle=HI.face; x.fillRect(tx*CELL,Y,CELL,FACE);
      x.fillStyle=HI.lip;  x.fillRect(tx*CELL,Y,CELL,lip);
      x.fillStyle=HI.line; x.fillRect(tx*CELL,Y+FACE-lip,CELL,lip); }
    const lip=Math.max(1,CELL*0.09);
    const G={ X0:RX*CELL, X1:(RX+RW)*CELL, Y0:PLAT*CELL, H0:FACE+CELL*0.9, lip, up:0,
      get Y(){ return this.Y0 - this.up; }, get HH(){ return this.H0 + this.up; },
      path(x,ins){ const {X0,X1,Y,HH}=this;
        x.beginPath(); x.moveTo(X0+ins,Y); x.lineTo(X1-ins,Y); x.lineTo(X1,Y+HH); x.lineTo(X0,Y+HH); x.closePath(); },
      clip(x,ins){ this.path(x,ins); x.clip(); x.clearRect(this.X0-CELL,this.Y,this.X1-this.X0+CELL*2,this.HH); },
      slope(x,ins,stops){ const {X0,X1,Y,HH}=this; x.save(); this.clip(x,ins);
        const gr=x.createLinearGradient(0,Y,0,Y+HH); stops(gr);
        x.fillStyle=gr; x.fillRect(X0-CELL,Y,X1-X0+CELL*2,HH); x.restore(); },
      grooves(x,ins,n,a0){ const {X0,X1,Y,HH,lip}=this; x.save(); this.path(x,ins); x.clip();
        x.fillStyle='rgba(8,11,17,1)';
        for(let k=1;k<=n;k++){ const t=k/(n+1); x.globalAlpha=a0*(0.55+0.75*t);
          x.fillRect(X0-CELL,Y+HH*t,X1-X0+CELL*2,lip*(.65+.45*t)); }
        x.globalAlpha=1; x.restore(); },
      wedge(x,ins,w2,col){ const {X0,X1,Y,HH}=this;
        for(const left of [true,false]){ const d=left?1:-1, xa=left?X0+ins:X1-ins, xb=left?X0:X1;
          x.fillStyle=col; x.beginPath(); x.moveTo(xa,Y); x.lineTo(xb+d*w2,Y+HH); x.lineTo(xb,Y+HH); x.closePath(); x.fill(); } } };
    fn(x,G);
    box.appendChild(cv); wrap.appendChild(box); host.appendChild(wrap); }
  return VAR.length; });
await new Promise(r=>setTimeout(r,400));
const f=path.join(OUT,'camp-ramp-pick.png');
await pg.screenshot({path:f,fullPage:true});
console.log('안 '+N+'개 →', path.relative(ROOT,f));
await b.close(); server.close();
