/* 검정 배경에서 뽑은 아이콘 PNG → 128 WebP(알파). 「공통 블록 C — 커런시/무판 계열」 전용.
 *   판 아이콘(skills/buildings/upgrades/auto)은 배경이 판이라 이걸 쓰지 않는다 — `npm run img` 쪽이다.
 *
 * 왜 단순 임계값이 아닌가: 아이콘 외곽에 **글로우**가 깔려 있다. 밝기로 잘라내면 글로우가 통째로
 * 날아가 테두리가 톱니처럼 남는다. 그래서 알파를 밝기에 **비례**시키되 무릎(knee) 위는 완전 불투명으로
 * 고정한다 — 글로우는 자연스럽게 흐려지고 몸통은 안 깎인다.
 *   alpha = clamp(lum / knee, 0, 1)
 * 기존 res_* 4장을 재보니 불투명 픽셀의 최저 휘도가 20~43, 반투명이 6~9% 였다. knee=32 가 그 사이다.
 *
 * ⚠ 검정과 섞여 어두워진 가장자리 색은 알파로 나눠 되돌린다(un-premultiply). 안 하면 밝은 배경에서
 *   테두리에 검은 띠가 돈다.
 *
 * 사용: node scripts/icon-cutout.mjs <입력.png> <출력.webp> [knee=32]
 */
import sharp from 'sharp';
import path from 'node:path';

const [src, dst, kneeArg] = process.argv.slice(2);
if (!src || !dst) { console.error('사용: node scripts/icon-cutout.mjs <입력.png> <출력.webp> [knee]'); process.exit(1); }
const KNEE = Math.max(1, +(kneeArg || 32));
const SIZE = 128;

// 검정 위에서 먼저 줄인다 — 리사이즈 AA 가 검정과 섞이며 부드러운 가장자리를 만들고, 그 뒤에 알파를 씌운다
const { data, info } = await sharp(src)
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
  .flatten({ background: '#000' })
  .raw().toBuffer({ resolveWithObject: true });

const out = Buffer.alloc(SIZE * SIZE * 4);
let clear = 0, solid = 0, soft = 0;
for (let p = 0; p < SIZE * SIZE; p++) {
  const i = p * info.channels, o = p * 4;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const lum = r * 0.3 + g * 0.59 + b * 0.11;
  const a = Math.max(0, Math.min(1, lum / KNEE));
  if (a <= 0) clear++; else if (a >= 1) solid++; else soft++;
  const un = a > 0.004 ? 1 / a : 0;                       // un-premultiply
  out[o] = Math.min(255, Math.round(r * un));
  out[o + 1] = Math.min(255, Math.round(g * un));
  out[o + 2] = Math.min(255, Math.round(b * un));
  out[o + 3] = Math.round(a * 255);
}
await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 4 } })
  .webp({ quality: 88 }).toFile(dst);

const total = SIZE * SIZE;
console.log(path.basename(src), '→', path.basename(dst),
  `knee=${KNEE} · 투명 ${(clear / total * 100).toFixed(0)}% · 반투명 ${(soft / total * 100).toFixed(1)}% · 불투명 ${(solid / total * 100).toFixed(0)}%`);
