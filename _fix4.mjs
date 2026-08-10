import sharp from 'sharp'; import fs from 'fs';
const OUT='assets/icons/', DL=process.env.USERPROFILE+'/Downloads/';
// ① 가스↔젬 맞바꾸기
fs.renameSync(OUT+'res_gas.webp', OUT+'_t.webp');
fs.renameSync(OUT+'res_gem.webp', OUT+'res_gas.webp');
fs.renameSync(OUT+'_t.webp', OUT+'res_gem.webp');
// PNG 원본도 동일하게
if(fs.existsSync(OUT+'res_gas.png')){
  fs.renameSync(OUT+'res_gas.png', OUT+'_t.png');
  fs.renameSync(OUT+'res_gem.png', OUT+'res_gas.png');
  fs.renameSync(OUT+'_t.png', OUT+'res_gem.png');
}
// ② 새 인구·젬 반영(A=인구, B=젬) — 검정 배경이므로 flood fill로 배경 제거
const { getPixels, savePixels } = await import('ndarray-pixels');
const jobs=[['hf_20260810_045523_33069175-4ea0-4aee-ab0a-3222e16ca591_min.png','res_pop'],
            ['hf_20260809_104309_c5ca1378-d3ee-4ea0-8537-c004defac170_min.png','res_gem']];
for(const [src,key] of jobs){
  const px=await getPixels(fs.readFileSync(DL+src),'image/png');
  const [w,h]=px.shape, N=w*h, lum=new Uint8Array(N);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) lum[y*w+x]=Math.max(px.get(x,y,0),px.get(x,y,1),px.get(x,y,2));
  const bg=new Uint8Array(N), q=new Int32Array(N); let qh=0,qt=0;
  const push=i=>{ if(!bg[i]&&lum[i]<62){ bg[i]=1; q[qt++]=i; } };
  for(let x=0;x<w;x++){ push(x); push((h-1)*w+x); }
  for(let y=0;y<h;y++){ push(y*w); push(y*w+w-1); }
  while(qh<qt){ const i=q[qh++], x=i%w, y=(i/w)|0;
    if(x>0)push(i-1); if(x<w-1)push(i+1); if(y>0)push(i-w); if(y<h-1)push(i+w); }
  let a=new Uint8Array(N);
  for(let i=0;i<N;i++) a[i]=bg[i]?0:255;
  for(let p2=0;p2<2;p2++){ const b2=new Uint8Array(N);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s=0,c=0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=w||ny>=h) continue; s+=a[ny*w+nx]; c++; }
      b2[y*w+x]=(s/c)|0; }
    a=b2; }
  for(let i=0;i<N;i++){ if(lum[i]>=130) a[i]=255; if(bg[i]&&lum[i]<20) a[i]=0; }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) px.set(x,y,3,a[y*w+x]);
  fs.writeFileSync(OUT+key+'.png', await savePixels(px,'image/png'));
  const buf=await sharp(OUT+key+'.png').trim({threshold:1}).toBuffer();
  await sharp(buf).resize(128,128,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}})
    .webp({quality:92,alphaQuality:100,effort:6}).toFile(OUT+key+'.webp');
  console.log(key+'.webp 갱신');
}
