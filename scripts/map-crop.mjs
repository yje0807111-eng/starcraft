// 🗺 던전·캠프 바닥 그림 후처리 — 9:16 으로 뽑힌 그림의 **양옆을 잘라 1:2** 로 만들고 WebP 로 저장한다(ART.md §17).
//   생성기에 1:2 비율이 없어(2026-09-10 사용자) 9:16 으로 뽑고 여기서 가운데를 남긴다. 세로는 그대로다 —
//   세로 비율이 곧 게임판(위 8~27% 고원 · 66% 부터 내 석판)이라 위아래를 자르면 안 된다.
//   쓰기: node scripts/map-crop.mjs <입력.png> <출력.webp> [높이=2688]
import sharp from 'sharp';
import fs from 'fs';
const [inp, out, hArg] = process.argv.slice(2);
if(!inp || !out){ console.error('쓰기: node scripts/map-crop.mjs <입력> <출력.webp> [높이]'); process.exit(1); }
const H = parseInt(hArg || '2688', 10);
const m = await sharp(inp).metadata();
const w = Math.round(m.height / 2), left = Math.round((m.width - w) / 2);
if(w > m.width) throw new Error('세로가 가로의 두 배보다 길다 — 1:2 보다 좁은 그림은 못 자른다: ' + m.width + '×' + m.height);
let img = sharp(inp).extract({ left, top:0, width:w, height:m.height });
if(m.height > H) img = img.resize({ height:H });
await img.webp({ quality:82 }).toFile(out);
const o = await sharp(out).metadata();
console.log('✂ ' + m.width + '×' + m.height + ' → ' + o.width + '×' + o.height + ' (' + Math.round(fs.statSync(out).size / 1024) + 'KB) ' + out
  + (m.height < H ? '  ⚠ 원본이 작다(세로 ' + m.height + ' < ' + H + ') — _min 미리보기가 아닌 원본 크기로 받을 것' : ''));
