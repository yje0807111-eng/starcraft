/* PNG → 128×128 WebP — README 규격(알파 없음 · q82). sharp 없이 크로미엄 캔버스로 변환한다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [src, dst, qs] = process.argv.slice(2);
const q = qs ? +qs : 0.82;
const b64 = fs.readFileSync(src).toString('base64');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const pg = await b.newPage();
const out = await pg.evaluate(async ({b64, q}) => {
  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);           // 알파 없음 — 판이 배경을 채운다
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, 128, 128);
  return { webp: c.toDataURL('image/webp', q).split(',')[1], w: img.width, h: img.height };
}, {b64, q});
await b.close();
fs.writeFileSync(dst, Buffer.from(out.webp, 'base64'));
console.log(src.split('/').pop(), out.w+'×'+out.h, '→', dst.split('/').pop(),
  fs.statSync(dst).size + 'B (q' + q + ')');
