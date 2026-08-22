/* 유닛 걷기 영상 → 방향별 스프라이트 프레임
 *
 *   node scripts/unit-frames.mjs <영상경로> [옵션]
 *
 *   --out <폴더>     출력 폴더(기본 assets/sprites/<영상파일이름>)
 *   --frames <N>     뽑을 프레임 수(기본 8)
 *   --from <초> --to <초>
 *                    구간 직접 지정. 없으면 가장 고른 한 스트라이드를 자동으로 고른다
 *   --scan           주기만 재고 끝낸다(구간을 눈으로 고르고 싶을 때)
 *   --size <px>      출력 한 변 크기(기본 원본 그대로)
 *   --sheet          대조 시트 <출력폴더>/_sheet.jpg 도 만든다
 *   --keep-bg        배경을 지우지 않는다(기본은 마젠타 배경 제거 + 알파)
 *   --webp           png 대신 webp 로 쓴다(저장소 표준 — SPRITES.md §5)
 *   --degreen <n>    초록 얼룩 중화(0=끔·기본). 장비의 초록도 같이 바래므로 신중히
 *   --density        이 동작에 몇 프레임이 필요한지 잰다(추출 대신 분석만)
 *   --refine         --from 을 고정하고 --to 를 찾아 준다(구간을 정확히 한 사이클로)
 *   --best           박자만 보지 말고 '머리는 고요하고 다리만 움직이는' 구간을 고른다
 *                    (다리 있는 지상 유닛 전용 — 공중 유닛·건물엔 의미 없다)
 *
 * ⚠ 전체 구간 균등 샘플링을 쓰지 않는다. AI 생성 영상은 10초에 스트라이드가 6회씩
 *   들어가는 일이 흔해서, 전체를 균등하게 뽑으면 서로 다른 사이클이 섞여 다리가
 *   안 이어진다(실제로 그렇게 나왔다). 먼저 보행 주기를 재고 한 사이클 안에서만 뽑는다.
 *
 * 주기는 '발 벌어진 폭'(아래 25% 띠의 가로 폭)의 진동으로 잰다 — 프레임 간 픽셀 차이는
 * 몇 프레임 만에 포화돼서 자기상관이 노이즈를 잡는다(한 번 그렇게 헛짚었다).
 *
 * ffmpeg 없이 크롬 디코더를 쓴다. 시크(currentTime 점프)는 쓰지 않는다 — 색인 없는
 * 생성 영상에서 영영 안 끝난다. video-frames.mjs 와 같은 방식이다.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const VID = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const flag = k => argv.includes('--' + k);
if (!VID || VID.startsWith('--')) {
  console.error('사용: node scripts/unit-frames.mjs <영상경로> [--out 폴더] [--frames 8] [--from 초 --to 초] [--scan] [--size px] [--sheet] [--webp] [--best] [--density] [--refine] [--keep-bg] [--degreen n]');
  process.exit(2);
}
if (!fs.existsSync(VID)) { console.error('영상이 없습니다: ' + VID); process.exit(2); }

const NF = parseInt(opt('frames', '8'), 10);
const SIZE = opt('size', null) ? parseInt(opt('size'), 10) : null;
const OUT = opt('out', path.join('assets/sprites', path.basename(VID, path.extname(VID))));
const FROM = opt('from', null) === null ? null : parseFloat(opt('from'));
const TO = opt('to', null) === null ? null : parseFloat(opt('to'));
const DEGREEN = parseInt(opt('degreen', '0'), 10);
const SCAN_N = 100;          // 주기 측정 표본 수
const PROBE = 200;           // 측정용 축소 크기

const VMIME = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4' };
const ext = path.extname(VID).toLowerCase();
if (!VMIME[ext]) { console.error('지원하지 않는 형식: ' + ext); process.exit(2); }

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH || ''].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('크롬을 찾을 수 없습니다. CHROME_PATH로 지정하세요.'); process.exit(2); }

// ── 마젠타 배경 제거 ──────────────────────────────────────────────
// 배경색을 하나 집어 비교하지 않는다 — 발밑 그림자는 '어두워진 마젠타'라 색은 다르지만
// 색조는 같다. 그래서 밝기와 무관한 색조 값으로 판정한다:
//   key = (r+b)/2 - g   → 마젠타일수록 크고, 회백·검정·옥색·호박은 0 이하.
// 엔진이 발밑 그림자를 직접 그리므로(90-m3d.module.js _shadowInstPass) 구운 그림자는 지운다.
// ⚠ 프레임마다 여백을 잘라내면 스프라이트가 흔들린다 — 캔버스 크기는 손대지 않는다.
const KEY_LO = 40, KEY_HI = 90;
const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
async function cutout(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const bg = [data[0], data[1], data[2]];       // 좌상단 = 배경 원색
  let kept = 0;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r + b) / 2 - g;
    let a = 255;
    if (key >= KEY_HI) a = 0;
    else if (key > KEY_LO) a = Math.round(255 * (KEY_HI - key) / (KEY_HI - KEY_LO));
    data[i + 3] = a;
    if (a === 0) continue;
    kept++;
    if (a < 255) {
      // 반투명 가장자리 — 섞여 든 배경색을 걷어내 원래 색을 복원한다(언매팅).
      //   관측색 = α·원색 + (1-α)·배경색  →  원색 = (관측색 - (1-α)·배경색) / α
      // ⚠ 단순히 r·b 에서 key 를 빼면 α 가 작은 곳에서 과하게 깎여 초록으로 뜬다(실제로 그랬다).
      const A = Math.max(a / 255, 0.15);        // α 가 아주 작으면 노이즈가 증폭되므로 하한
      const f = 1 - a / 255;
      data[i]     = clamp8((r - f * bg[0]) / A);
      data[i + 1] = clamp8((g - f * bg[1]) / A);
      data[i + 2] = clamp8((b - f * bg[2]) / A);
    } else if (key > 0) {
      const d = Math.min(key, 24);              // 불투명한데 배어 있으면 조금만 깎는다
      data[i] = clamp8(r - d); data[i + 2] = clamp8(b - d);
    }
    // 초록 얼룩 중화(--degreen, 기본 꺼짐)
    // ⚠ 짙은 마젠타 배경 위에서 영상 압축(4:2:0 색차 서브샘플링)이 만드는 얼룩인데,
    //   실측해 보면 다리 얼룩(128,128,96)과 목걸이 옥빛(60,80,60)이 채도·명도가 같아서
    //   색만으로는 못 가른다 — 켜면 장비의 초록도 같이 바랜다. 원인은 배경색이니
    //   영상 단계 배경을 덜 튀는 색으로 바꾸는 편이 낫다(README 참고).
    if (DEGREEN > 0) {
      const R2 = data[i], G2 = data[i + 1], B2 = data[i + 2], m2 = (R2 + B2) / 2;
      if (R2 > 100 && G2 - m2 > DEGREEN) data[i + 1] = clamp8(m2 + DEGREEN);
    }
  }
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer();
  return { png, keptPct: kept / (info.width * info.height) * 100 };
}

// 페이지와 영상을 같은 출처로 서빙한다 — 다른 출처면 캔버스가 오염돼 toDataURL 이 막힌다
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (p === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset=utf-8><video id=v muted playsinline preload=auto></video>'); }
  if (p !== '/v') { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': VMIME[ext], 'Content-Length': fs.statSync(VID).size });
  fs.createReadStream(VID).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--mute-audio', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let code = 0;
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load' });

  // 되감기는 src 재주입으로 한다(시크 금지)
  const reload = () => page.evaluate(() => new Promise((res, rej) => {
    const v = document.getElementById('v');
    v.onerror = () => rej(new Error('영상을 열 수 없습니다(코덱 미지원?)'));
    v.onloadeddata = () => res({ w: v.videoWidth, h: v.videoHeight, d: v.duration });
    v.src = '/v?t=' + Math.random(); v.load();
    setTimeout(() => rej(new Error('영상 로드 시간 초과')), 30000);
  }));

  // 재생하면서 목표 시각을 지날 때마다 한 장씩. size=null 이면 원본 해상도.
  const capture = (targets, size) => page.evaluate(({ targets, size }) => new Promise((res, rej) => {
    const v = document.getElementById('v'), out = [], cv = document.createElement('canvas');
    const grab = () => {
      cv.width = size || v.videoWidth; cv.height = size || v.videoHeight;
      cv.getContext('2d').drawImage(v, 0, 0, v.videoWidth, v.videoHeight, 0, 0, cv.width, cv.height);
      out.push({ t: v.currentTime, png: cv.toDataURL('image/png') });
    };
    setTimeout(() => rej(new Error('프레임 수집 시간 초과')), 180000);
    // rVFC 는 헤드리스에서 안 온다(합성 없음) → 16ms 폴링
    const id = setInterval(() => {
      try {
        while (out.length < targets.length && v.currentTime >= targets[out.length]) grab();
        if (out.length >= targets.length || v.ended) {
          while (out.length < targets.length) grab();
          clearInterval(id); v.pause(); res(out);
        }
      } catch (e) { clearInterval(id); rej(new Error('프레임 캡처 실패: ' + (e && e.message || e))); }
    }, 16);
    v.playbackRate = 1;
    v.play().catch(e => { clearInterval(id); rej(e); });
  }), { targets, size });

  const info = await reload();
  const dur = (isFinite(info.d) && info.d > 0) ? info.d : null;
  if (dur === null) throw new Error('영상 길이를 알 수 없습니다 — --from/--to 로 구간을 직접 지정하세요.');
  console.log('영상 ' + info.w + 'x' + info.h + ' · ' + dur.toFixed(2) + '초');

  // ── ① 보행 주기 + 카메라 고정 측정 ───────────────────────────────
  const scanT = Array.from({ length: SCAN_N }, (_, i) => dur * (i / SCAN_N) * 0.99);
  const scan = await capture(scanT, PROBE);
  const feet = [], box = [], probe = [];
  for (const s of scan) {
    const raw = await sharp(Buffer.from(s.png.split(',')[1], 'base64')).removeAlpha().raw().toBuffer();
    const bg = [raw[0], raw[1], raw[2]];                       // 좌상단 = 배경색
    let fx0 = PROBE, fx1 = -1, bx0 = PROBE, by0 = PROBE, bx1 = -1, by1 = -1;
    for (let y = 0; y < PROBE; y++) for (let x = 0; x < PROBE; x++) {
      const o = (y * PROBE + x) * 3;
      const d = Math.abs(raw[o] - bg[0]) + Math.abs(raw[o + 1] - bg[1]) + Math.abs(raw[o + 2] - bg[2]);
      if (d <= 90) continue;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      if (y >= PROBE * 0.75) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; }   // 아래 25% = 발
    }
    // 피사체 평균 밝기 — 프레임마다 화질·노출이 튀는 구간을 걸러내는 데 쓴다
    let lum = 0, ln = 0;
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const o = (y * PROBE + x) * 3;
      if (Math.abs(raw[o] - bg[0]) + Math.abs(raw[o + 1] - bg[1]) + Math.abs(raw[o + 2] - bg[2]) <= 90) continue;
      lum += (raw[o] + raw[o + 1] + raw[o + 2]) / 3; ln++;
    }
    feet.push(fx1 - fx0 + 1);
    box.push({ cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2, bg: bg, x0: bx0, y0: by0, x1: bx1, y1: by1,
      w: bx1 - bx0 + 1, h: by1 - by0 + 1, lum: ln ? lum / ln : 0 });
    probe.push(raw);
  }
  // 발 폭의 극대점 = 반보(半步)
  const raw方 = [];
  for (let i = 2; i < feet.length - 2; i++)
    if (feet[i] >= feet[i - 1] && feet[i] >= feet[i - 2] && feet[i] > feet[i + 1] && feet[i] > feet[i + 2]) raw方.push(i);
  const half = raw方.filter((p, i) => i === 0 || p - raw方[i - 1] > 3);   // 붙은 극대점 병합
  const dt = dur / SCAN_N;
  const rng = k => { const v = box.map(b => b[k]); return Math.max(...v) - Math.min(...v); };
  const bgDrift = Math.max.apply(null, box.map(b =>
    Math.abs(b.bg[0] - box[0].bg[0]) + Math.abs(b.bg[1] - box[0].bg[1]) + Math.abs(b.bg[2] - box[0].bg[2])));

  console.log('\n=== 검사 (' + PROBE + 'px 기준) ===');
  console.log('배경색 흔들림   ' + bgDrift + '\t' + (bgDrift < 24 ? '✔ 카메라·조명 고정' : '⚠ 배경이 변한다 — 카메라가 움직였을 수 있음'));
  console.log('중심 가로 이동  ' + rng('cx').toFixed(1) + 'px\t' + (rng('cx') < PROBE * 0.06 ? '✔ 제자리' : '⚠ 화면을 가로질러 이동함'));
  console.log('중심 세로 이동  ' + rng('cy').toFixed(1) + 'px\t' + (rng('cy') < PROBE * 0.06 ? '✔ 제자리' : '⚠ 상하로 이동함'));

  let A = FROM, B = TO;
  if (half.length >= 3) {
    const gaps = half.slice(1).map((p, i) => p - half[i]);
    const med = gaps.slice().sort((a, b) => a - b)[gaps.length >> 1];
    // 주기는 **첫 극대점~끝 극대점 전체**로 잰다(인접 간격의 중앙값이 아니라).
    // ⚠ 100표본이면 한 걸음이 12~13표본뿐이라 인접 간격은 ±1표본 = ±8% 로 흔들린다.
    //   같은 클립을 두 번 재서 0.85초와 0.73초가 나온 적이 있다. 전체 구간을 개수로
    //   나누면 그 양자화 오차가 극대점 수만큼 줄어든다.
    const spanAll = (half[half.length - 1] - half[0]) / (half.length - 1);
    // 극대점을 하나 놓치면 평균이 부풀어 오른다 — 중앙값과 크게 다르면 중앙값을 쓴다
    const gap = Math.abs(spanAll - med) > med * 0.35 ? med : spanAll;
    console.log('\n=== 보행 ===');
    console.log('반보 ' + half.length + '회 · 간격 ' + gap.toFixed(2) + '표본 = ' + (gap * dt).toFixed(2) + '초' +
      (gap === med ? ' (중앙값 — 극대점 누락 의심)' : ' (전체 평균)'));
    console.log('한 스트라이드 ' + (gap * 2 * dt).toFixed(2) + '초 · 클립 안에 약 ' + (dur / (gap * 2 * dt)).toFixed(1) + '회');
    // 구간 길이는 **중앙 간격 × 2** 로 고정한다.
    // ⚠ 예전엔 '반보 극대점 3개 사이'를 그대로 썼는데, 극대점 간격이 들쭉날쭉하면
    //   짧은 쌍이 뽑혀 한 걸음의 86% 만 잘리는 일이 있었다(돌진수 #2: 스트라이드
    //   0.85초인데 구간이 0.73초). 그러면 다리가 한 걸음을 못 채우고 되돌아가
    //   종종거리는 것처럼 보인다. 시작점만 극대점에서 고르고 길이는 중앙값으로 준다.
    if (A === null) {
      const span = gap * 2;                       // 한 스트라이드(표본 수)
      const W = Math.max(3, Math.round(span));
      if (flag('best')) {
        // ── 걷기가 가장 잘 나온 구간 고르기 ──────────────────────────
        // 극대점 위치만 보고 고르면 '박자'는 맞지만 '품질'은 못 본다 — 실제로 클립
        // 앞쪽엔 멀쩡한 걸음이 있는데 중반의 머리 흔드는 구간을 고른 적이 있다.
        // 여기서는 피사체를 두 띠로 나눠 본다:
        //   위 55% = 머리·몸통 → 고요해야 좋다
        //   아래 30% = 다리   → 움직여야 좋다
        // 점수 = 다리 변화 / 몸통 변화. 높을수록 '머리는 가만, 다리만' 이다.
        // ⚠ 다리가 없는 대상(공중 유닛·건물)에는 의미가 없다. 그래서 기본이 아니라 옵션이다.
        const bodyD = [], legD = [];
        for (let i = 0; i < probe.length - 1; i++) {
          const b = box[i], h = b.y1 - b.y0 + 1;
          const bodyEnd = b.y0 + Math.round(h * 0.55), legStart = b.y1 - Math.round(h * 0.30);
          let sb = 0, nb = 0, sl = 0, nl = 0;
          for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
            const o = (y * PROBE + x) * 3;
            const d = Math.abs(probe[i][o] - probe[i + 1][o]) +
                      Math.abs(probe[i][o + 1] - probe[i + 1][o + 1]) +
                      Math.abs(probe[i][o + 2] - probe[i + 1][o + 2]);
            if (y <= bodyEnd) { sb += d; nb++; }
            if (y >= legStart) { sl += d; nl++; }
          }
          bodyD.push(sb / Math.max(1, nb)); legD.push(sl / Math.max(1, nl));
        }
        // 다리 점수만으로는 부족하다. 실제로 점수 1.51(최고)인 구간을 골랐는데
        // 두 프레임만 화질·크기가 튀어서 걸음이 끊겨 보인 적이 있다(가시 사수 #2).
        // 그래서 '고른가'도 함께 잰다: 프레임마다 피사체 크기와 밝기가 얼마나 흔들리는지.
        const cv = a => { const m = a.reduce((x, y) => x + y, 0) / a.length;
          return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length) / Math.max(1, m); };
        const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length;
          return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length); };
        const cand = [];
        for (let s = 0; s + W < bodyD.length; s++) {
          let sl = 0, sb = 0;
          for (let k = s; k < s + W; k++) { sl += legD[k]; sb += bodyD[k]; }
          const win = box.slice(s, s + W + 1);
          cand.push({ s,
            leg: (sl / W) / Math.max(0.5, sb / W),
            cvW: cv(win.map(b => b.w)), cvH: cv(win.map(b => b.h)), sdL: sd(win.map(b => b.lum)) });
        }
        // 크기·밝기가 흔들리는 구간을 먼저 걸러내고, 남은 것 중 다리 점수가 가장 높은 것
        const OK_CV = 0.06, OK_LUM = 6;
        let pool = cand.filter(c => c.cvW < OK_CV && c.cvH < OK_CV && c.sdL < OK_LUM);
        const filtered = pool.length > 0;
        if (!filtered) pool = cand;
        pool.sort((a, b) => b.leg - a.leg);
        const win = pool[0];
        A = win.s * dt; B = (win.s + W) * dt;
        console.log('자동 선택 구간  ' + A.toFixed(2) + ' ~ ' + B.toFixed(2) + '초 (' +
          (B - A).toFixed(2) + '초) · 다리 ' + win.leg.toFixed(2) +
          ' · 크기흔들림 ' + (Math.max(win.cvW, win.cvH) * 100).toFixed(1) + '%' +
          ' · 밝기흔들림 ' + win.sdL.toFixed(1) +
          '   (고른 구간 ' + (filtered ? pool.length : 0) + '/' + cand.length + ')');
        if (!filtered) console.log('   ⚠ 클립 전체가 크기·밝기로 흔들린다 — 다시 뽑는 게 낫다');
        if (win.leg < 0.7) console.log('   ⚠ 몸통이 다리보다 많이 움직인다');
        // ⚠ 이 점수는 방향에 따라 기준이 다르다. 옆모습은 1.3~1.5 가 보통이지만
        //   정면·후면은 몸통이 화면 대부분을 차지하고 엉덩이가 실제로 움직여야 해서
        //   제대로 나와도 0.8 근처다. 방향끼리 비교하지 말고 같은 방향의 구간끼리 비교할 것.
      } else {
        let best = Infinity, at = 0;
        for (let i = 0; i + 2 < half.length; i++) {
          if (half[i] + span > SCAN_N - 1) continue;        // 클립 끝을 넘지 않게
          const e = Math.abs(gaps[i] - gap) + Math.abs(gaps[i + 1] - gap);
          if (e < best) { best = e; at = i; }
        }
        A = half[at] * dt; B = (half[at] + span) * dt;
        console.log('자동 선택 구간  ' + A.toFixed(2) + ' ~ ' + B.toFixed(2) + '초 (' +
          ((B - A)).toFixed(2) + '초 = 중앙 스트라이드)   ※ --best 로 품질까지 보고 고를 수 있다');
      }
    }
  } else if (A === null) {
    A = 0; B = dur * 0.99;
    console.log('\n⚠ 보행 주기를 못 찾았습니다 — 전체 구간에서 뽑습니다. --from/--to 로 직접 지정하세요.');
  }
  if (B === null) B = Math.min(dur * 0.99, A + 1.7);

  if (flag('scan')) { console.log('\n--scan: 측정만 하고 끝냅니다.'); }
  else if (flag('refine')) {
    // ── 구간 끝을 맞춘다 ──────────────────────────────────────────────
    // --from 은 사람이 고른다(어느 걸음이 예쁜가는 눈으로만 안다). 끝은 계산으로 찾는다:
    // 시작 프레임과 가장 비슷해지는 시각이 곧 한 바퀴 돈 지점이다.
    // ⚠ 사람이 고른 구간도 실제로는 한 사이클이 아닌 경우가 많았다(이음새가 평균의 3배).
    //   프레임을 늘려도 그 튐은 안 없어진다 — 끝을 맞춰야 없어진다.
    const span = (B - A) * 1.6, STEPS = 120;
    await reload();
    const targets = Array.from({ length: STEPS }, (_, i) => A + span * (i / STEPS));
    const shots = await capture(targets, null);
    const CUT = !flag('keep-bg');
    const small = [];
    for (const s of shots) {
      let buf = Buffer.from(s.png.split(',')[1], 'base64');
      if (CUT) buf = (await cutout(buf)).png;
      small.push(await sharp(buf).resize(128, 128, { fit: 'contain', background: '#00000000' })
        .ensureAlpha().raw().toBuffer());
    }
    const dif = (a, b) => { let t = 0;
      for (let i = 0; i < a.length; i += 4) { const wa = a[i + 3] / 255, wb = b[i + 3] / 255;
        t += Math.abs(a[i] * wa - b[i] * wb) + Math.abs(a[i + 1] * wa - b[i + 1] * wb) +
             Math.abs(a[i + 2] * wa - b[i + 2] * wb) + Math.abs(a[i + 3] - b[i + 3]); }
      return t / (a.length / 4) / 4; };
    const dt2 = span / STEPS;
    const lo = Math.round((B - A) * 0.65 / dt2), hi = Math.min(STEPS - 1, Math.round((B - A) * 1.45 / dt2));
    let best = Infinity, at = lo;
    const curve = [];
    for (let i = lo; i <= hi; i++) { const d = dif(small[0], small[i]);
      curve.push({ t: i * dt2, d }); if (d < best) { best = d; at = i; } }
    console.log('\n=== 구간 끝 맞추기 (시작 ' + A.toFixed(2) + '초 고정) ===');
    console.log('길이(초)  시작프레임과의 차이');
    for (let k = 0; k < curve.length; k += Math.max(1, Math.floor(curve.length / 14))) {
      const c = curve[k];
      console.log('  ' + c.t.toFixed(2).padStart(5) + '   ' + c.d.toFixed(1).padStart(5) + ' ' +
        '█'.repeat(Math.max(1, Math.round(c.d))) + (Math.abs(c.t - at * dt2) < dt2 / 2 ? '   ← 최소' : ''));
    }
    console.log('\n권장:  --from ' + A.toFixed(2) + ' --to ' + (A + at * dt2).toFixed(2) +
      '   (길이 ' + (at * dt2).toFixed(2) + '초 · 이음새 ' + best.toFixed(1) + ')');
    console.log('       원래 길이 ' + (B - A).toFixed(2) + '초 대비 ' +
      (((at * dt2) / (B - A) - 1) * 100).toFixed(0) + '%');
  }
  else if (flag('density')) {
    // ── 몇 프레임이면 충분한가 ────────────────────────────────────────
    // 8장은 확정값이 아니다. 느린 동작은 8장으로 충분하고 빠른 동작은 끊겨 보인다.
    // 한 사이클을 촘촘히(32장) 뽑아 두고, 거기서 N장씩 솎아 냈을 때 프레임 사이가
    // 얼마나 벌어지는지 잰다. 벌어짐이 더 이상 안 줄어드는 지점이 그 유닛의 N 이다.
    // ⚠ 이건 픽셀 통계로 답이 나오는 문제다 — '걸음이 이어지는가'와 다르다(SPRITES.md §4).
    const DENSE = 32;
    await reload();
    const targets = Array.from({ length: DENSE }, (_, i) => A + (B - A) * (i / DENSE));
    const shots = await capture(targets, null);
    const CUT = !flag('keep-bg');
    const small = [];
    for (const s of shots) {
      let buf = Buffer.from(s.png.split(',')[1], 'base64');
      if (CUT) buf = (await cutout(buf)).png;
      small.push(await sharp(buf).resize(128, 128, { fit: 'contain', background: '#00000000' })
        .ensureAlpha().raw().toBuffer());
    }
    const dif = (a, b) => { let t = 0;
      for (let i = 0; i < a.length; i += 4) {
        const wa = a[i + 3] / 255, wb = b[i + 3] / 255;
        t += Math.abs(a[i] * wa - b[i] * wb) + Math.abs(a[i + 1] * wa - b[i + 1] * wb) +
             Math.abs(a[i + 2] * wa - b[i + 2] * wb) + Math.abs(a[i + 3] - b[i + 3]);
      }
      return t / (a.length / 4) / 4; };
    // ⚠ 이음새(마지막→첫)를 섞어 재면 안 된다. 그건 밀도가 아니라 구간이 한 사이클인지의
    //   문제라, 프레임을 아무리 늘려도 안 줄어든다(32장에서도 11.6 이 나왔다).
    //   여기서는 '안쪽 최대'로 밀도를 재고 이음새는 따로 보고한다.
    console.log('\n=== 프레임 수별 벌어짐 (한 사이클을 ' + DENSE + '장으로 재서 솎음) ===');
    console.log(' N    평균   안쪽최대   8장대비');
    const rows = [];
    for (const N of [6, 8, 10, 12, 16, 24, 32]) {
      if (N > DENSE) continue;
      const idx = Array.from({ length: N }, (_, i) => Math.round(i * DENSE / N) % DENSE);
      const inner = [];
      for (let i = 0; i + 1 < N; i++) inner.push(dif(small[idx[i]], small[idx[i + 1]]));
      rows.push({ N, mean: inner.reduce((a, b) => a + b, 0) / inner.length, max: Math.max(...inner),
        seam: dif(small[idx[N - 1]], small[idx[0]]) });
    }
    const base = (rows.find(r => r.N === 8) || rows[0]).max;
    for (const r of rows)
      console.log(String(r.N).padStart(2) + '  ' + r.mean.toFixed(1).padStart(6) +
        '  ' + r.max.toFixed(1).padStart(8) + '   ' + (r.max / base).toFixed(2).padStart(6) +
        '  ' + '█'.repeat(Math.max(1, Math.round(r.max / base * 12))));
    const seam = rows[rows.length - 1].seam;
    console.log('\n이음새(마지막→첫) ' + seam.toFixed(1) +
      (seam > rows[rows.length - 1].mean * 2.5
        ? '  ⚠ 구간이 한 사이클이 아니다 — 프레임 수가 아니라 --from/--to 를 고칠 것'
        : '  ✔ 한 사이클이 맞다'));
    // 안쪽 최대가 목표치 아래로 내려가는 **가장 작은** N.
    // 목표 7.0 은 실측에서 잡았다 — 돌진수(사족·느림)는 8장에서 6.3 으로 매끄러웠고,
    // 채집수(육족·빠름)는 8장에서 10.7 로 끊겨 보였다. 그 사이가 7 근처다.
    // ⚠ '개선폭이 10% 미만이면 멈춘다' 식으로 잡으면 곡선이 울퉁불퉁해서 6장에서 멈춰 버린다.
    const TARGET = 7.0;
    const hit = rows.find(r => r.max <= TARGET);
    console.log('권장 ' + (hit ? hit.N + '장 (안쪽최대 ' + hit.max.toFixed(1) + ' ≤ ' + TARGET + ')'
      : '32장 이상 — 이 동작은 8장으로 못 담는다'));
    console.log('⚠ 숫자는 참고다. 아래 시트를 눈으로 보고 정할 것.');
    // 후보별 시트
    const T = 150, tiles = [];
    for (let r = 0; r < rows.length; r++) {
      const N = rows[r].N, idx = Array.from({ length: N }, (_, i) => Math.round(i * DENSE / N) % DENSE);
      for (let i = 0; i < Math.min(N, 16); i++) {
        let buf = Buffer.from(shots[idx[i]].png.split(',')[1], 'base64');
        if (CUT) buf = (await cutout(buf)).png;
        const lbl = '<svg width="' + T + '" height="' + T + '"><text x="3" y="14" font-size="12" fill="#ff0" ' +
          'font-family="monospace">' + N + '장 ' + i + '</text></svg>';
        tiles.push({ input: await sharp(buf).resize(T, T, { fit: 'contain', background: '#00000000' })
          .composite([{ input: Buffer.from(lbl), top: 0, left: 0 }]).png().toBuffer(), top: r * T, left: i * T });
      }
    }
    fs.mkdirSync(OUT, { recursive: true });
    const sh = path.join(OUT, '_density.jpg');
    await sharp({ create: { width: 16 * T, height: rows.length * T, channels: 3, background: '#6e6e6e' } })
      .composite(tiles).jpeg({ quality: 84 }).toFile(sh);
    console.log('✓ ' + sh + '  (줄마다 프레임 수 · 16장까지만 표시)');
  }
  else {
    // ── ② 구간 안에서 균등 추출 ────────────────────────────────────
    fs.mkdirSync(OUT, { recursive: true });
    await reload();
    const targets = Array.from({ length: NF }, (_, i) => A + (B - A) * (i / NF));
    const shots = await capture(targets, null);
    console.log('\n=== 추출 ' + A.toFixed(2) + '~' + B.toFixed(2) + '초 · ' + NF + '장 ===');
    const CUT = !flag('keep-bg');
    const files = [];
    for (let i = 0; i < shots.length; i++) {
      let buf = Buffer.from(shots[i].png.split(',')[1], 'base64');
      let note = '';
      if (CUT) {
        const c = await cutout(buf);
        buf = c.png;
        note = '  남은픽셀 ' + c.keptPct.toFixed(1) + '%';
        if (c.keptPct > 60) note += ' ⚠ 배경이 덜 지워졌을 수 있음';
        if (c.keptPct < 3) note += ' ⚠ 피사체까지 지워졌을 수 있음';
      }
      const webp = flag('webp');
      const f = path.join(OUT, 'f' + String(i).padStart(2, '0') + (webp ? '.webp' : '.png'));
      let im = sharp(buf);
      // fit:'contain' — 'inside' 로 줄이면 캔버스가 내용에 맞춰 달라져 프레임마다 크기가 흔들린다
      if (SIZE) im = im.resize(SIZE, SIZE, { fit: 'contain', background: '#00000000' });
      await (webp ? im.webp({ quality: 88, alphaQuality: 90 }) : im.png()).toFile(f);
      files.push(f);
      console.log('✓ ' + f + '  t=' + shots[i].t.toFixed(2) + 's  ' +
        (fs.statSync(f).size / 1024).toFixed(0) + 'KB' + note);
    }

    // ── ③ 대조 시트 ──────────────────────────────────────────────
    if (flag('sheet')) {
      const C = Math.min(4, files.length), T = 320, R = Math.ceil(files.length / C), tiles = [];
      for (let i = 0; i < files.length; i++) {
        const lbl = '<svg width="' + T + '" height="' + T + '"><text x="8" y="30" font-size="28" fill="#000" font-family="monospace">' + i + '</text></svg>';
        // 회색 판 위에 얹는다 — 흰 몸과 검은 무늬가 둘 다 보이고, 투명 부분이 드러난다
        const b = await sharp(files[i]).resize(T, T, { fit: 'contain', background: '#00000000' })
          .composite([{ input: Buffer.from(lbl), top: 0, left: 0 }]).png().toBuffer();
        tiles.push({ input: b, top: Math.floor(i / C) * T, left: (i % C) * T });
      }
      const sh = path.join(OUT, '_sheet.jpg');
      await sharp({ create: { width: C * T, height: R * T, channels: 3, background: '#7a7a7a' } })
        .composite(tiles).jpeg({ quality: 82 }).toFile(sh);
      console.log('✓ ' + sh + '  (대조 시트)');
    }
    console.log('\n완료 — ' + OUT);
  }
} catch (e) {
  console.error('실패: ' + (e && e.message || e)); code = 3;
} finally { await browser.close(); server.close(); process.exit(code); }
