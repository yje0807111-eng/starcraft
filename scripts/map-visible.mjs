/* ============================================================================
 * map-visible.mjs — 맵 그림에서 **화면에 실제로 나오는 부분만** 잘라낸다 (2026-09-02)
 *
 * ⭐ 왜 — 배경은 `background-size:auto 118% · position:center bottom` 으로 깔린다.
 *   그래서 **위쪽과 좌우가 화면 밖으로 나간다.** 실측(던전 1 · 줌 1.45~4.0 × 팬 전 범위):
 *
 *       원본 1600×2930 중 볼 수 있는 것은  169,447 ~ 1431,2875  =  1263×2428  (65%)
 *       → 위 15% 와 좌우 11% 씩은 **어떤 줌·어떤 팬에서도 안 보인다.**
 *
 *   ⇒ 업스케일에 통째로 넣으면 안 보이는 35% 에 화질을 쓰는 셈이다. 보이는 데만 쓴다.
 *   ⚠ 「가만히 있을 때」만 보면 39% 지만 그것으로 자르면 **드래그했을 때 잘린 자리가 드러난다.**
 *
 * ⚠ **9:16 으로 맞춰 자른다** — 모델이 그 비율을 요구한다(ART.md §11).
 *   보이는 영역(0.483)은 그보다 홀쭉하므로 **좌우를 조금 넓혀** 9:16 을 만든다.
 *   넓히는 쪽은 어차피 화면 밖이라 화질이 남아도 손해가 아니다.
 *
 * ⚠ 측정은 **던전 1에서 했다**(scripts 안 probe). 다른 장도 크기가 같으면 그대로 맞고,
 *   다르면 아래 VIS 비율로 계산되어 저절로 따라간다.
 *
 * 사용:
 *   node scripts/map-visible.mjs assets/backgrounds/dungeons/dg1.webp
 *   node scripts/map-visible.mjs --all            # 던전 10장
 *   옵션: --out=경로 · --quarter(자른 뒤 2×2 로 또 나눈다 · map-quarter.mjs 와 같은 규칙)
 *         --pad=n(--quarter 일 때 겹침 px · 기본 48)
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const has = k => argv.includes('--' + k);

// 📐 **드래그로 갈 수 있는 모든 자리**에서 보이는 영역의 합집합(원본 대비 비율).
//   ⚠ 「가만히 있을 때 보이는 것」이 아니다 — 손가락으로 밀면 훨씬 넓게 본다.
//     축소(1.45) 한 자리만 보면 39% 지만, 팬을 넣으면 **65%** 다.
//   📐 던전 1 실측(줌 1.45~4.0 을 훑으며 네 모서리로 밀어 본 합집합):
//       x 11~89%  ·  y 15~98%   →  169,447 ~ 1431,2875
//     ⭐ 가로는 줌과 무관하게 11~89% 다(클램프가 「맵 밖이 안 보이게」 잡아 준다).
//       세로만 줌에 따라 아래가 조금씩 줄어든다(확대할수록 88% 까지).
//   ⛔ 위 15% 와 좌우 11% 씩은 **어떤 줌·어떤 팬에서도 안 보인다.**
const VIS = { x0: 169 / 1600, x1: 1431 / 1600, y0: 447 / 2930, y1: 2875 / 2930 };
const AR  = 9 / 16;                        // 잘라낸 것이 가질 비율
const PAD = +opt('pad', 48);
const OUT = path.resolve(ROOT, opt('out', 'docs/mock/visible'));

const files = has('all')
  ? Array.from({ length: 10 }, (_, i) => `assets/backgrounds/dungeons/dg${i + 1}.webp`)
  : argv.filter(a => !a.startsWith('--'));
if(!files.length){ console.error('자를 파일을 주세요 (또는 --all)'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

for(const rel of files){
  const src = path.resolve(ROOT, rel);
  if(!fs.existsSync(src)){ console.error('없는 파일: ' + rel); continue; }
  const m = await sharp(src).metadata();
  const W = m.width, H = m.height;
  // 보이는 영역
  let x0 = Math.round(VIS.x0 * W), x1 = Math.round(VIS.x1 * W);
  let y0 = Math.round(VIS.y0 * H), y1 = Math.round(VIS.y1 * H);
  let cw = x1 - x0, chh = y1 - y0;
  // 🎯 9:16 로 맞춘다 — 세로를 기준으로 가로를 넓힌다(넓히는 쪽은 어차피 화면 밖이다)
  const wantW = Math.round(chh * AR);
  if(wantW > cw){
    const add = wantW - cw, l = Math.floor(add / 2);
    x0 -= l; x1 += add - l;
    if(x0 < 0){ x1 += -x0; x0 = 0; }
    if(x1 > W){ x0 -= (x1 - W); x1 = W; }
    x0 = Math.max(0, x0); x1 = Math.min(W, x1);
  } else if(wantW < cw){                    // 드물지만 가로가 남으면 세로를 늘린다
    const wantH = Math.round(cw / AR), add = wantH - chh;
    y0 = Math.max(0, y0 - add); if(y1 - y0 < wantH) y1 = Math.min(H, y0 + wantH);
  }
  cw = x1 - x0; chh = y1 - y0;
  const name = path.basename(rel).replace(/\.\w+$/, '');
  const dst = path.join(OUT, name + '_vis.png');
  await sharp(src).extract({ left: x0, top: y0, width: cw, height: chh }).png().toFile(dst);
  const cut = (cw * chh) / (W * H) * 100;
  console.log(`  ${name}  ${W}×${H} → ${x0},${y0} ~ ${x1},${y1}  ${cw}×${chh}`
    + `  비율 ${(cw / chh).toFixed(3)}${Math.abs(cw / chh - AR) < 0.01 ? ' ✅ 9:16' : ' ⚠'}`
    + `  (원본의 ${cut.toFixed(0)}%)`);
  if(has('quarter')){
    const hw = Math.floor(cw / 2), hh = Math.floor(chh / 2);
    const padX = PAD, padY = Math.round(PAD * (hh / hw));
    for(const [n, qx, qy] of [['1',0,0],['2',1,0],['3',0,1],['4',1,1]]){
      const l = qx ? Math.max(0, hw - padX) : 0, t = qy ? Math.max(0, hh - padY) : 0;
      await sharp(dst).extract({ left:l, top:t,
        width: Math.min(cw - l, hw + padX), height: Math.min(chh - t, hh + padY) })
        .png().toFile(path.join(OUT, `${name}_vis_${n}.png`));
    }
    console.log(`    └ 4등분(겹침 ${padX}×${padY}) 완료`);
  }
}
console.log('  📁 ' + path.relative(ROOT, OUT));
