/* 단색 배경에서 뽑은 지형 소품 PNG → 알파 WebP (캠프 광맥·가스 같은 「바닥에 놓이는 그림」 전용).
 *
 * 왜 필요한가: 생성 이미지는 배경이 **평평한 단색**으로 나온다. 그대로 얹으면 캠프 바닥 위에
 * 네모난 판이 그대로 보인다. 배경색과의 **거리**로 알파를 만들어 오려 낸다.
 *   ⛔ 밝기 임계값으로 자르지 말 것 — 이 계열은 물체가 어둡고 배경이 밝아 반대로 잘린다.
 *   ⚠ 가장자리는 배경색과 섞여 있다. 알파를 씌우기만 하면 **밝은 띠**가 남는다 —
 *     배경 성분을 빼서 되돌린다(un-premultiply 와 같은 이치).
 *
 * 사용: node scripts/prop-cutout.mjs <입력.png> <출력.webp> [폭=320] [lo=18] [hi=45]
 *   lo  이 거리 아래는 완전 투명(배경)
 *   hi  이 거리 위는 완전 불투명(물체)
 */
import sharp from 'sharp';

const [src, dst, wArg, loArg, hiArg] = process.argv.slice(2);
if (!src || !dst) { console.error('사용: node scripts/prop-cutout.mjs <입력.png> <출력.webp> [폭] [lo] [hi]'); process.exit(1); }
const OUT_W = Math.max(16, +(wArg || 320));
const LO = +(loArg || 18), HI = +(hiArg || 45);

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const ch = info.channels;
// 배경색 = 네 모서리의 중앙값(한 점만 보면 노이즈에 흔들린다)
const at = (x, y) => { const i = (y * info.width + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };
const cs = [at(2, 2), at(info.width - 3, 2), at(2, info.height - 3), at(info.width - 3, info.height - 3)];
const bg = [0, 1, 2].map(k => { const v = cs.map(c => c[k]).sort((a, b) => a - b); return (v[1] + v[2]) / 2; });

const out = Buffer.alloc(info.width * info.height * 4);
for (let p = 0, q = 0; p < data.length; p += ch, q += 4) {
  const r = data[p], g = data[p + 1], b = data[p + 2];
  const d = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
  const a = Math.max(0, Math.min(1, (d - LO) / (HI - LO)));
  if (a <= 0) { out[q] = out[q + 1] = out[q + 2] = out[q + 3] = 0; continue; }
  // 배경 성분을 뺀다 — 안 빼면 가장자리에 배경색 띠가 돈다
  const un = (c, bgc) => Math.max(0, Math.min(255, Math.round((c - bgc * (1 - a)) / a)));
  out[q] = un(r, bg[0]); out[q + 1] = un(g, bg[1]); out[q + 2] = un(b, bg[2]);
  out[q + 3] = Math.round(a * 255);
}
const info2 = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ threshold: 1 })              // 투명 여백을 잘라 낸다 — 칸에 맞출 때 기준이 물체가 된다
  .resize({ width: OUT_W, withoutEnlargement: false })
  .webp({ quality: 86, alphaQuality: 92 })
  .toFile(dst);
console.log('배경 rgb(' + bg.map(Math.round).join(',') + ') → ' + dst + ' ' + info2.width + 'x' + info2.height + ' · ' + info2.size + ' bytes');
