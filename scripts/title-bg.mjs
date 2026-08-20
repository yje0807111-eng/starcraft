// 🖼 타이틀(부팅 로딩) 배경 — 원본 PNG → WebP (assets/backgrounds/title)
//
// 유즈맵 키 아트(scripts/usemap-bg.mjs)와 목표가 다르다:
//   · 유즈맵 = 팝업 뒤에 깔리고 위쪽 절반만 보인다 → 밝기 55, 주제를 위로 끌어올리는 크롭
//   · 타이틀 = 화면 전체를 채우고 그 **위에 제목·엠블럼·숫자가 얹힌다** → 더 어둡게(42),
//     그리고 자르지 않는다(구도를 프롬프트가 이미 잡았다 — 위쪽 하늘을 비워 둔다).
//
// 그 밖의 규칙(안개로 검정을 들어올린다 · 채도 정규화 · gamma 금지)은 ART.md 와 같다.
//
// 실행: node scripts/title-bg.mjs   (원본 .png 는 .gitignore — .webp 만 커밋)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'assets/backgrounds/title';
const TARGET = 72;       // 배경이 보여야 한다(2026-08-20). 42→58→72 — 제대로 노출된 원본을 눌러 죽이지 않는다.
                         // 글자 가독성은 밝기가 아니라 **레이아웃의 비네트**(.dim 하단)와 text-shadow 가 맡는다.
const CHROMA = 40;
const B_CLAMP = [0.35, 2];
const S_CLAMP = [0.45, 1.0];   // ⚠ 타이틀은 **낮추기만** 한다 — 글자가 위에 얹히므로 채도를 올리면 배경이 글자를 이긴다
                               //    (유즈맵 키 아트는 1.4 까지 올린다. 그쪽은 팝업 뒤라 색이 살아야 한다)
const MAX = 1400;        // 첫 화면이라 선명해야 한다 — 폰 390px 기준 3.6배(고화질 원본을 받은 뒤 900→1400, 2026-08-20)
const Q = 80;
const VISIBLE = 0.6;     // 타이틀은 위쪽 60% 가 실제로 보이는 구간(아래는 도크·비네트)

const mean3 = s => s.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3;
const spread3 = s => { const m = s.channels.slice(0, 3).map(c => c.mean); return Math.max(...m) - Math.min(...m); };

async function topStats(file) {
  const m = await sharp(file).metadata();
  const s = await sharp(file)
    .extract({ left: 0, top: 0, width: m.width, height: Math.round(m.height * VISIBLE) })
    .stats();
  return { mean: mean3(s), spread: spread3(s), sd: s.channels[1].stdev };
}

const files = fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.png'));
if (!files.length) { console.log('원본 .png 없음 — 할 일 없다'); process.exit(0); }

for (const f of files) {
  const src = path.join(DIR, f);
  const b0 = await topStats(src);
  const kB = Math.min(B_CLAMP[1], Math.max(B_CLAMP[0], TARGET / Math.max(b0.mean, 1)));
  const kS = Math.min(S_CLAMP[1], Math.max(S_CLAMP[0], CHROMA / Math.max(b0.spread, 1)));
  const out = src.replace(/\.png$/i, '.webp');

  await sharp(src)
    .modulate({ brightness: kB, saturation: kS })
    .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: Q })
    .toFile(out);

  const b1 = await topStats(out);
  const warn = [
    (kB === B_CLAMP[0] || kB === B_CLAMP[1]) ? '밝기' : '',
    (kS === S_CLAMP[0] || kS === S_CLAMP[1]) ? '채도' : '',
  ].filter(Boolean);
  console.log(`✓ ${f.padEnd(10)} 밝기 ×${kB.toFixed(2)} ${b0.mean.toFixed(0).padStart(3)}→${b1.mean.toFixed(0).padStart(3)}`
    + `   채도 ×${kS.toFixed(2)} 색편차 ${b0.spread.toFixed(0).padStart(3)}→${b1.spread.toFixed(0).padStart(3)}`
    + `   대비 ±${b1.sd.toFixed(0).padStart(2)}   ${(fs.statSync(out).size / 1024).toFixed(0)}KB`
    + (warn.length ? `  ⚠ ${warn.join('·')} 상한` : ''));
}
