// 🌌 환생 구역 배경 — 원본 PNG → WebP (assets/backgrounds/reb)
//
// 앞의 두 계열과 목표가 또 다르다:
//   · 유즈맵 키 아트(usemap-bg.mjs) = 팝업 뒤, 위쪽 절반만 보인다 → 밝기 55 · 주제를 끌어올리는 크롭
//   · 타이틀 배경(title-bg.mjs)     = 화면 전체 + 큰 로고가 얹힌다 → 밝기 72 · 자르지 않음
//   · **환생 구역**                  = 화면 전체 + 그 위에 **별자리와 작은 글자**가 얹힌다
//
// ⭐ 그래서 가장 어둡다. 별(발광하는 점)과 값 라벨(7~8px)이 배경을 이겨야 하는데,
//   배경이 밝으면 별이 묻히고 라벨이 안 읽힌다. 화면이 원래 쓰던 배경은 거의 검정
//   (radial-gradient rgba(16,22,32,.98) → rgba(5,7,11,.99) · 평균 10 남짓)이었다.
// ⚠ 그렇다고 새까맣게 누르면 그림이 사라져 배경을 넣은 뜻이 없다 — 안개가 검정을 midtone 으로
//   들어올린 원본을 **적당히만** 눌러 쓴다(ART.md §7 ①).
//
// 그 밖의 규칙(채도 정규화 · gamma 금지 · .webp 만 커밋)은 ART.md 와 같다.
//
// 실행: node scripts/reb-bg.mjs   (원본 .png 는 .gitignore — .webp 만 커밋)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'assets/backgrounds/reb';
const TARGET = 44;       // 별과 작은 라벨이 위에 얹힌다 — 타이틀(72)보다 한참 어둡다
const CHROMA = 34;       // 갈래 색이 넷(적·금·녹·청)이라 배경은 중립에 가까워야 한다
const B_CLAMP = [0.30, 2];
const S_CLAMP = [0.40, 1.0];   // ⚠ **낮추기만** — 배경 색이 세면 갈래 색 넷이 서로 안 갈린다
const MAX = 1400;
const Q = 80;
const VISIBLE = 0.7;     // 아래 30% 는 하단 시트가 덮는다

const mean3 = s => s.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3;
const spread3 = s => { const m = s.channels.slice(0, 3).map(c => c.mean); return Math.max(...m) - Math.min(...m); };

async function topStats(file) {
  const m = await sharp(file).metadata();
  const s = await sharp(file)
    .extract({ left: 0, top: 0, width: m.width, height: Math.round(m.height * VISIBLE) })
    .stats();
  return { mean: mean3(s), spread: spread3(s), sd: s.channels[1].stdev };
}

const files = fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.png') && !f.startsWith('_'));
if (!files.length) { console.log('원본 .png 없음 — 할 일 없다 (밑줄로 시작하는 파일은 건너뛴다)'); process.exit(0); }

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
  console.log(`✓ ${f.padEnd(12)} 밝기 ×${kB.toFixed(2)} ${b0.mean.toFixed(0).padStart(3)}→${b1.mean.toFixed(0).padStart(3)}`
    + `   채도 ×${kS.toFixed(2)} 색편차 ${b0.spread.toFixed(0).padStart(3)}→${b1.spread.toFixed(0).padStart(3)}`
    + `   대비 ±${b1.sd.toFixed(0).padStart(2)}   ${(fs.statSync(out).size / 1024).toFixed(0)}KB`
    + (warn.length ? `  ⚠ ${warn.join('·')} 상한` : ''));
}
