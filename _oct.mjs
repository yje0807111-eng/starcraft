import sharp from 'sharp';
const f=process.argv[2];
const {data,info}=await sharp(f).resize({width:700}).raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,C=info.channels;
// 성벽+내부 = 초록기 없는 회갈색. 숲 = 초록 우세·어두움
const inside=(x,y)=>{const i=(y*W+x)*C,r=data[i],g=data[i+1],b=data[i+2];
  return (r>g+2)&&((r+g+b)/3>52); };
const RUN=10, med=a=>{const s=a.slice().sort((p,q)=>p-q);return s[s.length>>1]};
const scan=(fix,dir,horiz)=>{ let c=0, N=horiz?W:H;
  for(let k=0;k<N;k++){ const t=dir>0?k:N-1-k; const x=horiz?t:fix, y=horiz?fix:t;
    if(inside(x,y)){ if(++c>=RUN) return dir>0?t-RUN+1:t+RUN-1; } else c=0; } return -1; };
const L=[],R=[],T=[],B=[];
for(const fy of [.44,.47,.5,.53,.56]){ const y=(H*fy)|0; const a=scan(y,1,true),b=scan(y,-1,true); if(a>=0){L.push(a);R.push(b)} }
for(const fx of [.44,.47,.5,.53,.56]){ const x=(W*fx)|0; const a=scan(x,1,false),b=scan(x,-1,false); if(a>=0){T.push(a);B.push(b)} }
const l=med(L)/W, r=med(R)/W, t=med(T)/H, b=med(B)/H;
console.log('성벽 가로  '+(l*100).toFixed(1)+'~'+(r*100).toFixed(1)+'%   폭 '+((r-l)*100).toFixed(1)+'%   목표 70.6%');
console.log('성벽 세로  '+(t*100).toFixed(1)+'~'+(b*100).toFixed(1)+'%   높이 '+((b-t)*100).toFixed(1)+'%   목표 67.0%');
console.log('숲 좌/우   '+(l*100).toFixed(1)+'% / '+((1-r)*100).toFixed(1)+'%      최소 필요 14.7%씩');
console.log('숲 상/하   '+(t*100).toFixed(1)+'% / '+((1-b)*100).toFixed(1)+'%      최소 필요 16.5%씩');
const needX=(1/(r-l)-1)/2, needY=(1/(b-t)-1)/2;
console.log('');
console.log('성벽=월드로 맞출 때 필요한 여백  padX='+needX.toFixed(3)+'  padY='+needY.toFixed(3));
console.log('빈 화면 안 나오는 최소 여백      padX=0.208   padY=0.247   (1.5배 · 390x663 기준)');
console.log(needX>=0.208 && needY>=0.247 ? '→ 충분하다' : '→ 부족하다: '+(needX<0.208?'가로 ':'')+(needY<0.247?'세로':''));
