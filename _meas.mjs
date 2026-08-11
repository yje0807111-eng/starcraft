import sharp from 'sharp';
const f=process.argv[2];
const {data,info}=await sharp(f).resize({width:688}).raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,C=info.channels;
const lum=(x,y)=>{const i=(y*W+x)*C;return data[i]*.299+data[i+1]*.587+data[i+2]*.114};
const med=a=>{a.sort((x,y)=>x-y);return a[a.length>>1]};
const T=78, Ls=[],Rs=[],Ts=[],Bs=[];
for(const fy of [.44,.47,.5,.53,.56]){ const y=Math.round(H*fy); let L=-1,R=-1;
  for(let x=0;x<W;x++) if(lum(x,y)>T){L=x;break}
  for(let x=W-1;x>=0;x--) if(lum(x,y)>T){R=x;break}
  if(L>=0){Ls.push(L);Rs.push(R)} }
for(const fx of [.44,.47,.5,.53,.56]){ const x=Math.round(W*fx); let t=-1,b=-1;
  for(let y=0;y<H;y++) if(lum(x,y)>T){t=y;break}
  for(let y=H-1;y>=0;y--) if(lum(x,y)>T){b=y;break}
  if(t>=0){Ts.push(t);Bs.push(b)} }
const L=med(Ls),R=med(Rs),t=med(Ts),b=med(Bs);
console.log('정착지 가로  '+(L/W*100).toFixed(1)+'~'+(R/W*100).toFixed(1)+'%   폭   '+((R-L)/W*100).toFixed(1)+'%   목표 61.5%');
console.log('정착지 세로  '+(t/H*100).toFixed(1)+'~'+(b/H*100).toFixed(1)+'%   높이 '+((b-t)/H*100).toFixed(1)+'%   목표 57.4%');
console.log('숲 좌 / 우   '+(L/W*100).toFixed(1)+'% / '+((W-R)/W*100).toFixed(1)+'%          목표 19.2%씩');
console.log('숲 상 / 하   '+(t/H*100).toFixed(1)+'% / '+((H-b)/H*100).toFixed(1)+'%          목표 21.3%씩');
let s=0,n=0; for(let y=Math.round(H*.3);y<H*.7;y+=3) for(let x=Math.round(W*.3);x<W*.7;x+=3){s+=lum(x,y);n++}
console.log('중앙 평균 밝기 '+(s/n/255*100).toFixed(0)+'%   (던전 기준 18~25%)');
