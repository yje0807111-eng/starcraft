import sharp from 'sharp';
const f=process.argv[2];
const {data,info}=await sharp(f).resize({width:512}).raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,C=info.channels;
// 숲=초록 우세, 정착지=갈색/회색(적>녹). 색상으로 가른다 — 캐노피 밝기에 안 속는다
const settled=(x,y)=>{const i=(y*W+x)*C; const r=data[i],g=data[i+1],b=data[i+2];
  return (r>g-4) && (r+g+b)/3>60; };
const RUN=14;   // 연속 RUN픽셀 이상이어야 인정(나뭇가지 틈 무시)
const med=a=>{a.sort((p,q)=>p-q);return a[a.length>>1]};
const scanX=(y,dir)=>{ let c=0;
  for(let k=0;k<W;k++){ const x=dir>0?k:W-1-k; if(settled(x,y)){ if(++c>=RUN) return dir>0?x-RUN+1:x+RUN-1; } else c=0; } return -1; };
const scanY=(x,dir)=>{ let c=0;
  for(let k=0;k<H;k++){ const y=dir>0?k:H-1-k; if(settled(x,y)){ if(++c>=RUN) return dir>0?y-RUN+1:y+RUN-1; } else c=0; } return -1; };
const Ls=[],Rs=[],Ts=[],Bs=[];
for(const fy of [.42,.46,.5,.54,.58]){ const y=Math.round(H*fy); const l=scanX(y,1),r=scanX(y,-1); if(l>=0){Ls.push(l);Rs.push(r)} }
for(const fx of [.42,.46,.5,.54,.58]){ const x=Math.round(W*fx); const t=scanY(x,1),b=scanY(x,-1); if(t>=0){Ts.push(t);Bs.push(b)} }
const L=med(Ls),R=med(Rs),T=med(Ts),B=med(Bs);
const row=(n,v,tgt)=>console.log(n.padEnd(13)+v.padEnd(24)+'목표 '+tgt);
row('정착지 가로', (L/W*100).toFixed(1)+'~'+(R/W*100).toFixed(1)+'%  폭 '+((R-L)/W*100).toFixed(1)+'%','61.5%');
row('정착지 세로', (T/H*100).toFixed(1)+'~'+(B/H*100).toFixed(1)+'%  높이 '+((B-T)/H*100).toFixed(1)+'%','57.4%');
row('숲 좌/우', (L/W*100).toFixed(1)+'% / '+((W-R)/W*100).toFixed(1)+'%','19.2%씩');
row('숲 상/하', (T/H*100).toFixed(1)+'% / '+((H-B)/H*100).toFixed(1)+'%','21.3%씩');
let s=0,n=0; for(let y=(H*.3)|0;y<H*.7;y+=3) for(let x=(W*.3)|0;x<W*.7;x+=3){const i=(y*W+x)*C;s+=data[i]*.299+data[i+1]*.587+data[i+2]*.114;n++}
console.log('중앙 평균 밝기 '+(s/n/255*100).toFixed(0)+'%  → 어두운 막 통과 후 약 '+(s/n/255*100*0.53).toFixed(0)+'%');
