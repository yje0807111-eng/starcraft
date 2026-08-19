/* 체커보드가 '그림'으로 구워진 PNG → 진짜 알파를 되살려 128 WebP 로. (assets/icons/README.md 「체커보드가 '그림'으로…」)
 *   ① 밝고 중성인 색만 배경 후보  ② 가장자리에서 플러드필(안쪽 하이라이트는 살린다)
 *   ③ 안쪽에 갇힌 덩어리는 '면적 1% 이상'만 구멍으로 뚫는다  ④ 자홍색 합성 미리보기로 눈으로 확인
 *   사용: node test/dechecker.mjs <입력.png> <출력.webp> [미리보기.png]                                */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [src, dst, prev] = process.argv.slice(2);
if(!src || !dst){ console.error('사용: node test/dechecker.mjs <입력.png> <출력.webp> [미리보기.png]'); process.exit(1); }
const BG_MIN = 238, BG_NEUTRAL = 8, HOLE_PCT = 0.01;   // 배경 후보 문턱 · 중성도 · 구멍으로 인정할 최소 면적
const b64 = fs.readFileSync(src).toString('base64');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage();
const out = await pg.evaluate(async ({b64, BG_MIN, BG_NEUTRAL, HOLE_PCT}) => {
  const img = new Image();
  await new Promise((ok,no)=>{ img.onload=ok; img.onerror=no; img.src='data:image/png;base64,'+b64; });
  const W=img.width, H=img.height;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0);
  const id=x.getImageData(0,0,W,H), d=id.data;
  const bg=new Uint8Array(W*H);
  for(let p=0;p<W*H;p++){ const o=p*4, r=d[o], g=d[o+1], bl=d[o+2];
    const mn=Math.min(r,g,bl), mx=Math.max(r,g,bl);
    if(mn>=BG_MIN && mx-mn<=BG_NEUTRAL) bg[p]=1; }
  const seen=new Uint8Array(W*H);
  const fill=(seeds)=>{ const got=[], q=[];
    for(const s of seeds) if(bg[s]&&!seen[s]){ seen[s]=1; q.push(s); }
    while(q.length){ const p=q.pop(); got.push(p); const i=p%W, j=(p/W)|0;
      const nb=[ i>0?p-1:-1, i<W-1?p+1:-1, j>0?p-W:-1, j<H-1?p+W:-1 ];
      for(const n of nb) if(n>=0 && bg[n] && !seen[n]){ seen[n]=1; q.push(n); } }
    return got; };
  const edge=[]; for(let i=0;i<W;i++){ edge.push(i); edge.push((H-1)*W+i); }
  for(let j=0;j<H;j++){ edge.push(j*W); edge.push(j*W+W-1); }
  const outside=fill(edge); for(const p of outside) d[p*4+3]=0;
  // 남은 것 = 안쪽에 갇힌 덩어리. 면적으로만 가른다 — 밝기 비율로 거르면 같은 모양의 슬릿이 한쪽만 뚫린다.
  const MIN=Math.round(W*H*HOLE_PCT); const holes=[];
  for(let p=0;p<W*H;p++){ if(bg[p]&&!seen[p]){ const comp=fill([p]);
    if(comp.length>=MIN){ for(const q of comp) d[q*4+3]=0; holes.push(comp.length); } } }
  x.putImageData(id,0,0);
  const pv=document.createElement('canvas'); pv.width=W; pv.height=H;
  const px=pv.getContext('2d'); px.fillStyle='#f0f'; px.fillRect(0,0,W,H); px.drawImage(c,0,0);
  const s=document.createElement('canvas'); s.width=s.height=128;
  const sx=s.getContext('2d'); sx.imageSmoothingQuality='high'; sx.drawImage(c,0,0,128,128);
  return { webp:s.toDataURL('image/webp',0.82).split(',')[1], prev:pv.toDataURL('image/png').split(',')[1],
           W, H, cut:outside.length, pct:+(outside.length/(W*H)*100).toFixed(1), holes };
}, {b64, BG_MIN, BG_NEUTRAL, HOLE_PCT});
await b.close();
fs.writeFileSync(dst, Buffer.from(out.webp,'base64'));
if(prev) fs.writeFileSync(prev, Buffer.from(out.prev,'base64'));
console.log(src.split('/').pop(), out.W+'×'+out.H, '→', dst.split('/').pop(),
  fs.statSync(dst).size+'B · 배경 '+out.pct+'% 제거 · 구멍 '+(out.holes.length?out.holes.join(','):'없음'));
