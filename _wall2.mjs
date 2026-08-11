import sharp from 'sharp';
const {data,info}=await sharp('assets/backgrounds/town/town_ground.webp').raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,C=info.channels;
const settled=(x,y)=>{ const i=(y*W+x)*C; const r=data[i],g=data[i+1],b=data[i+2];
  return (r>=g-2)&&((r+g+b)/3>62); };
let sx=0,sy=0,n=0; for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2) if(settled(x,y)){sx+=x;sy+=y;n++}
const cx=sx/n, cy=sy/n, pts=[];
for(let a=0;a<360;a+=3){ const t=a*Math.PI/180, dx=Math.cos(t), dy=Math.sin(t); let last=0,miss=0;
  for(let r=10;r<Math.max(W,H);r++){ const x=Math.round(cx+dx*r), y=Math.round(cy+dy*r);
    if(x<0||y<0||x>=W||y>=H) break;
    if(settled(x,y)){last=r;miss=0} else if(++miss>=12) break; }
  pts.push({a,x:cx+dx*last,y:cy+dy*last}); }
const pct=(a,q)=>{const b=a.slice().sort((p,r)=>p-r);return b[Math.min(b.length-1,Math.round(b.length*q))]};
function evalPad(padX,padY,vw,vh){
  const WW=Math.round(vw*2.4), WH=Math.round(vh*2.025);
  const Ew=WW*(1+2*padX), Eh=WH*(1+2*padY);
  const s=Math.max(Ew/W,Eh/H), oX=(Ew-W*s)/2, oY=(Eh-H*s)/2;
  const AX=[],AY=[],SD=[];
  for(const p of pts){ const nx=((p.x*s+oX)-padX*WW)/WW*2-1, ny=((p.y*s+oY)-padY*WH)/WH*2-1;
    AX.push(Math.abs(nx)); AY.push(Math.abs(ny));
    const d=((p.a%90)+90)%90; if(Math.abs(d-45)<10) SD.push(Math.abs(nx)+Math.abs(ny)); }
  return {x:pct(AX,.95), y:pct(AY,.95), sum:pct(SD,.5)};
}
let best=null;
for(let px=0.21;px<=0.60;px+=0.002) for(let py=0.25;py<=0.60;py+=0.002){
  const r=evalPad(px,py,390,663); const err=Math.abs(r.x-1)+Math.abs(r.y-1);
  if(!best||err<best.err) best={err,px,py,r}; }
console.log('최적 여백  padX='+best.px.toFixed(3)+'  padY='+best.py.toFixed(3));
console.log('  성벽 좌우 |nx|='+best.r.x.toFixed(3)+'   상하 |ny|='+best.r.y.toFixed(3)+'  (1.000이 월드 경계)');
console.log('  대각선 합='+best.r.sum.toFixed(3)+'  → TW_WALL_CUT = '+((2-best.r.sum)/2).toFixed(3));
console.log('  반 화면 확보: 가로 '+(best.px*936).toFixed(0)+'px(필요 195) · 세로 '+(best.py*1343).toFixed(0)+'px(필요 332)');
for(const [w,h,nm] of [[360,640,'작은 폰'],[430,780,'큰 폰'],[333,579,'현재 창']]){
  const r=evalPad(best.px,best.py,w,h);
  console.log('  ['+nm+' '+w+'x'+h+'] |nx|='+r.x.toFixed(3)+' |ny|='+r.y.toFixed(3)+' 합='+r.sum.toFixed(3)); }

// 축별 한계 + 그 좌표계에서의 모서리 컷
const WX=0.925, WY=1.00;
function cutFor(vw,vh){ const padX=0.268,padY=0.344;
  const WW=Math.round(vw*2.4), WH=Math.round(vh*2.025);
  const Ew=WW*(1+2*padX), Eh=WH*(1+2*padY);
  const s=Math.max(Ew/W,Eh/H), oX=(Ew-W*s)/2, oY=(Eh-H*s)/2; const SD=[];
  for(const p of pts){ const nx=((p.x*s+oX)-padX*WW)/WW*2-1, ny=((p.y*s+oY)-padY*WH)/WH*2-1;
    const d=((p.a%90)+90)%90; if(Math.abs(d-45)<10) SD.push(Math.abs(nx)/WX+Math.abs(ny)/WY); }
  return pct(SD,.5); }
console.log('\n=== 축별 한계 WX='+WX+' WY='+WY+' 기준 모서리 ===');
let acc=[];
for(const [w,h,nm] of [[390,663,'기준'],[360,640,'작은 폰'],[430,780,'큰 폰'],[333,579,'현재 창']]){
  const c=cutFor(w,h); acc.push(c); console.log('  ['+nm+'] |u|+|v| = '+c.toFixed(3)+'  → cut '+((2-c)/2).toFixed(3)); }
const avg=acc.reduce((a,b)=>a+b,0)/acc.length;
console.log('  평균 '+avg.toFixed(3)+'  → TW_WALL_CUT = '+((2-avg)/2).toFixed(3));
