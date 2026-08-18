// 🖼 유즈맵 키 아트 — 원본 PNG → 팝업 뒤 배경 WebP (assets/backgrounds/usemaps)
//
// 이 스크립트가 따로 있는 이유는 **밝기 정규화** 하나 때문이다.
// 생성 모델은 같은 프롬프트 계열이라도 노출이 크게 흔들린다(실측: 보이는 구간 평균 34 ~ 120, 3.5배 차이).
// 그대로 깔면 어떤 맵은 배경이 안 보이고 어떤 맵은 미니맵·글자를 이긴다. 맵마다 같은 밝기로 맞춰야
// '유즈맵 팝업'이 한 컴포넌트로 읽힌다.
//
// ⚠ 밝기는 sharp 의 gamma() 로 만지지 말 것 — 그건 리사이즈용 인코딩 보정이라 오히려 어두워진다(실제로 그랬다).
//    modulate({brightness}) 는 LCh 의 L 만 곱해서 색상(맵 아이덴티티)을 지키며 밝기만 바꾼다.
// ⚠ 진짜 지렛대는 프롬프트다. "deep near-black, lit only by …" 로 뽑았더니 평균 5~18 이 나와
//    후보정으로 못 살렸다. "볼류메트릭 안개가 빛을 받아 그림자를 midtone 으로 들어올린다"로 바꿔서 해결했다.
//    여기 보정은 그 위의 마무리일 뿐, 어두운 원본을 구제하는 용도가 아니다.
//
// '보이는 구간' = 이미지 위쪽 절반. 팝업에서 그 아래는 비네트(.moArt::before)가 완전히 덮는다.
//
// 실행: node scripts/usemap-bg.mjs   (원본 .png 는 .gitignore — .webp 만 커밋)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'assets/backgrounds/usemaps';
const TARGET = 55;       // 보이는 구간 평균 밝기(0-255)
const CHROMA = 45;       // 보이는 구간 색 편차(가장 밝은 채널 - 가장 어두운 채널)
const B_CLAMP = [0.4, 2];
const S_CLAMP = [0.45, 1.4];
const MAX = 1024;        // 팝업 뒤 배경은 299×350 으로 잘려 들어간다 — 1024면 충분
const Q = 80;
const VISIBLE = 0.5;

// 채도도 밝기와 같은 이유로 맞춘다: 모델이 "Dominant blue palette" 를 **거의 모노크롬**으로 해석해서
// cpu 가 R1/G66/B97 로 나왔다(빨강이 사실상 0). 그대로 깔면 배경이 아니라 '파란 색판'이 되고,
// 팝업이 그 위에 맵색 오라를 한 겹 더 얹으므로 푸른기가 두 번 더해진다.
// 반대로 photon 은 편차 13 이라 회색 덩어리다 — 양방향으로 맞춰야 여섯 장이 한 세트로 보인다.
const mean3 = s => s.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3;
const spread3 = s => { const m = s.channels.slice(0, 3).map(c => c.mean); return Math.max(...m) - Math.min(...m); };
// ⚠ 반드시 **잘라낸 뒤의 구간**을 재야 한다. 예전엔 원본 전체의 위쪽 절반을 재고 보정을 잘라낸 그림에
//   적용해서, 크롭이 크게 움직인 맵은 엉뚱한 기준으로 밝기·채도가 잡혔다(가시탑이 혼자 튀던 원인).
async function topStats(file, crop) {
  const base = crop ? sharp(file).extract(crop) : sharp(file);
  const buf = await base.toBuffer();
  const m = await sharp(buf).metadata();
  const s = await sharp(buf)
    .extract({ left: 0, top: 0, width: m.width, height: Math.round(m.height * VISIBLE) })
    .stats();
  return { mean: mean3(s), spread: spread3(s), sd: s.channels[1].stdev };
}

// ── 주제 찾아 자르기 ────────────────────────────────────────────────────────
// 팝업은 그림의 **위쪽 절반쯤만** 보여준다(아래는 비네트가 덮는다). 그런데 생성기는 피사체를
// 한가운데에 놓는다 → 그대로 쓰면 하늘·안개만 보이고 정작 사각 트랙·가시탑은 잘려 나간다(실제로 그랬다).
// 그래서 **그림에서 디테일이 몰린 띠를 찾아 거기를 잘라낸다.** 위치를 CSS 에 맵마다 박지 않는 이유는
// 프레이밍이 그림마다 다른 성질이지 화면의 성질이 아니기 때문이다 — 게임 쪽은 계속 cover/center top 하나면 된다.
const BOX = 299 / 350;   // 팝업 뒤 배경 칸의 가로세로비
const SUBJ = 0.30;       // 찾아낸 주제를 잘라낸 그림의 세로 30% 지점에 놓는다(그 아래는 비네트가 먹는다)

async function subjectCrop(file) {
  const meta = await sharp(file).metadata();
  const cw = 128;
  const ch = Math.round(meta.height / meta.width * cw);
  const g = await sharp(file).resize(cw, ch).greyscale().raw().toBuffer();
  // 행마다 '가로 방향 변화량' = 그 줄에 구조물이 얼마나 있는가
  const prof = new Array(ch).fill(0);
  for (let y = 0; y < ch; y++) {
    let s = 0;
    for (let x = 1; x < cw; x++) s += Math.abs(g[y * cw + x] - g[y * cw + x - 1]);
    prof[y] = s / cw;
  }
  // 매끄럽게(단발 노이즈에 끌려가지 않게)
  const sm = prof.map((_, y) => {
    const a = Math.max(0, y - 4), b = Math.min(ch - 1, y + 4);
    let s = 0; for (let i = a; i <= b; i++) s += prof[i];
    return s / (b - a + 1);
  });
  const peak = sm.indexOf(Math.max(...sm)) / ch;          // 0~1

  const cropH = Math.min(meta.height, Math.round(meta.width / BOX));
  let top = Math.round(peak * meta.height - SUBJ * cropH);
  top = Math.max(0, Math.min(meta.height - cropH, top));
  return { left: 0, top, width: meta.width, height: cropH, peak };
}

const files = fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.png'));
if (!files.length) { console.log('원본 .png 없음 — 할 일 없다'); process.exit(0); }

for (const f of files) {
  const src = path.join(DIR, f);
  const crop = await subjectCrop(src);                     // ① 먼저 자르고
  const b0 = await topStats(src, crop);                    // ② 잘라낸 구간을 재서
  const kB = Math.min(B_CLAMP[1], Math.max(B_CLAMP[0], TARGET / Math.max(b0.mean, 1)));   // ③ 보정한다
  const kS = Math.min(S_CLAMP[1], Math.max(S_CLAMP[0], CHROMA / Math.max(b0.spread, 1)));
  const out = src.replace(/\.png$/i, '.webp');

  await sharp(src)
    .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
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
    + `   대비 ±${b1.sd.toFixed(0).padStart(2)}   주제 ${(crop.peak*100).toFixed(0)}%   ${(fs.statSync(out).size / 1024).toFixed(0)}KB`
    + (warn.length ? `  ⚠ ${warn.join('·')} 상한 — 원본을 다시 뽑는 게 낫다` : ''));
}
