import sharp from 'sharp';
const {data,info}=await sharp('assets/backgrounds/town/town_ground.webp').raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,C=info.channels;
const settled=(x,y)=>{ if(x<0||y<0||x>=W||y>=H) return false; const i=(y*W+x)*C;
  const r=data[i],g=data[i+1],b=data[i+2]; return (r>=g-2)&&((r+g+b)/3>62); };
// 정착지 중심 = 밝은 픽셀 무게중심
let sx=0,sy=0,n=0; for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2) if(settled(x,y)){sx+=x;sy+=y;n++}
const cx=sx/n, cy=sy/n;
// 중심에서 방사로 쏴서 '연속 12px 비정착지'가 시작되는 지점 = 성벽 바깥
const pts=[];
for(let a=0;a<360;a+=5){ const t=a*Math.PI/180, dx=Math.cos(t), dy=Math.sin(t);
  let last=0, miss=0;
  for(let r=10;r<Math.max(W,H);r+=1){ const x=Math.round(cx+dx*r), y=Math.round(cy+dy*r);
    if(x<0||y<0||x>=W||y>=H) break;
    if(settled(x,y)){ last=r; miss=0; } else if(++miss>=12) break; }
  pts.push({a, x:cx+dx*last, y:cy+dy*last}); }
// 화면 기하 (vw390 x vh663 기준)
const vw=390, vh=663, WW=Math.round(vw*2.4), WH=Math.round(vh*2.025);
const padX=0.362, padY=0.306;
const Ew=WW*(1+2*padX), Eh=WH*(1+2*padY);
const s=Math.max(Ew/W, Eh/H), offX=(Ew-W*s)/2, offY=(Eh-H*s)/2;
let maxAbs=0, maxSum=0, sumsD=[], absX=[], absY=[];
for(const p of pts){ const ex=p.x*s+offX, ey=p.y*s+offY;
  const wx=ex-padX*WW, wy=ey-padY*WH;
  const nx=wx/WW*2-1, ny=wy/WH*2-1;
  absX.push(Math.abs(nx)); absY.push(Math.abs(ny));
  maxAbs=Math.max(maxAbs,Math.abs(nx),Math.abs(ny));
  const sm=Math.abs(nx)+Math.abs(ny); maxSum=Math.max(maxSum,sm);
  if(Math.abs(((p.a%90)+90)%90-45)<8) sumsD.push(sm); }
const med=a=>{a.sort((p,q)=>p-q);return a[a.length>>1]};
const pct=(a,q)=>{a.sort((p,q2)=>p-q2);return a[Math.min(a.length-1,Math.round(a.length*q))]};
console.log('이미지 '+W+'x'+H+' · 중심 '+cx.toFixed(0)+','+cy.toFixed(0));
console.log('월드 '+WW+'x'+WH+' · 바닥레이어 '+Ew.toFixed(0)+'x'+Eh.toFixed(0));
console.log('');
console.log('성벽 좌우 끝  |nx| 95퍼센타일 = '+pct(absX.slice(),0.95).toFixed(3)+'   (1.000 = 월드 경계)');
console.log('성벽 상하 끝  |ny| 95퍼센타일 = '+pct(absY.slice(),0.95).toFixed(3));
console.log('대각선 |nx|+|ny| 중앙값 = '+med(sumsD).toFixed(3)+'   → 필요한 TW_WALL_CUT = '+((2-med(sumsD))/2).toFixed(3));
console.log('현재 TW_WALL_CUT=0.22 → 한계 '+(2-0.44).toFixed(3));
