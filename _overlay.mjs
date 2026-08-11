import sharp from 'sharp';
const IMG='assets/backgrounds/town/town_ground.webp';
const m=await sharp(IMG).metadata(); const W=m.width,H=m.height;
const vw=390, vh=663, WW=Math.round(vw*2.4), WH=Math.round(vh*2.025);
const padX=0.268, padY=0.344, WX=0.925, WY=0.94, DY=-0.055, CUT=0.344;
const Ew=WW*(1+2*padX), Eh=WH*(1+2*padY);
const s=Math.max(Ew/W,Eh/H), oX=(Ew-W*s)/2, oY=(Eh-H*s)/2;
const toImg=(wx,wy)=>[ ((wx+padX*WW)-oX)/s, ((wy+padY*WH)-oY)/s ];
const fromN=(u,v)=>[ (u*WX+1)/2*WW, (v*WY+DY+1)/2*WH ];
// 팔각형 = |u|<=1, |v|<=1, |u|+|v|<=lim
const lim=2-CUT*2, c=lim-1;   // 변이 잘리는 지점
const oct=[[c,1],[1,c],[1,-c],[c,-1],[-c,-1],[-1,-c],[-1,c],[-c,1]]
  .map(([u,v])=>toImg(...fromN(u,v))).map(p=>p.map(n=>n.toFixed(0)).join(',')).join(' ');
const rect=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>toImg(u*WW/2+WW/2===0?0:( (u+1)/2*WW ), (v+1)/2*WH))
  .map(p=>p.map(n=>n.toFixed(0)).join(',')).join(' ');
const Z={상점:[50,26],생성소:[26,38],관문:[74,38],광장:[50,50],보관소:[26,62],훈련장:[74,62],장비:[50,74]};
let dots='';
for(const k in Z){ const [zx,zy]=Z[k]; const [ix,iy]=toImg(zx/100*WW, zy/100*WH);
  dots+=`<circle cx="${ix.toFixed(0)}" cy="${iy.toFixed(0)}" r="26" fill="none" stroke="#5cd6ff" stroke-width="5"/>`
      +`<text x="${ix.toFixed(0)}" y="${(iy-38).toFixed(0)}" fill="#5cd6ff" font-size="34" font-weight="bold" text-anchor="middle">${k}</text>`; }
// 화면(뷰포트) 크기 — 캐릭터가 광장에 섰을 때 보이는 범위
const [cx0,cy0]=toImg(WW/2-vw/2, WH/2-vh/2), [cx1,cy1]=toImg(WW/2+vw/2, WH/2+vh/2);
const svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
 <polygon points="${rect}" fill="none" stroke="#888" stroke-width="4" stroke-dasharray="14 10"/>
 <polygon points="${oct}" fill="none" stroke="#ff3b3b" stroke-width="8"/>
 <rect x="${cx0.toFixed(0)}" y="${cy0.toFixed(0)}" width="${(cx1-cx0).toFixed(0)}" height="${(cy1-cy0).toFixed(0)}" fill="none" stroke="#ffd24a" stroke-width="6"/>
 ${dots}</svg>`;
const full=await sharp(IMG).composite([{input:await sharp(Buffer.from(svg)).resize(W,H,{fit:"fill"}).png().toBuffer(),top:0,left:0}]).png().toBuffer();
await sharp(full).resize({width:560}).png().toFile('_chk.png');
console.log('빨강=이동 가능 범위(성벽) · 회색점선=월드 사각 · 노랑=한 화면 · 하늘=구역');
