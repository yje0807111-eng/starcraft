// 🎨 ART.md 규격 검사 — 프롬프트가 스타일에서 새지 않았는지 기계로 확인한다.
//
// 왜 필요한가: 이미지 스타일은 '다음 사람이 프롬프트를 새로 쓰는 순간' 무너진다.
// 실제로 한 번 무너졌다 — 밝기 문제로 프롬프트를 다시 쓰면서 구도 문장(§2-D)을 흘렸고,
// 문서에는 "넣는다"고 적혀 있는데 실물에는 없는 상태가 됐다. 그런 어긋남을 잡는 게 이 스크립트다.
//
// ⚠ **계열이 넷이다**(2026-08-24). 둘은 목적이 달라 시점·구도가 반대다 —
//    한 벌의 규칙으로 검사하면 타이틀 프롬프트가 무조건 실패한다.
//      · 유즈맵 키 아트(§6) — 내려다보는 맵 그림. 가운데를 비운다(미니맵 자리)
//      · 타이틀 배경(§8)    — 올려다보는 전투 그림. 위쪽을 비운다(제목 자리)
//      · 유닛 참고 아트(§9) — **캐릭터**다. 앞 둘의 `no characters`·안개 규칙이 통째로 반대라 별도 규칙을 쓴다
//      · 종족 전장(§10)   — 타이틀과 같은 9:16 이지만 **비우는 자리가 반대**(위가 아니라 아래)
//    프롬프트가 어느 §에 적혔는지로 계열을 가른다.
//
// 검사 내용
//   ① 계열별 고정 블록이 전부 있는가
//   ② 금지 표현이 들어갔는가 (near-black 계열 — 화면이 새까매진다)
//   ③ ART.md 의 맵 표와 UMAP_BG(코드)가 서로 맞는가
//
// 실행: node scripts/art-lint.mjs      (실패하면 exit 1)
import fs from 'node:fs';
import { readAllSource } from './_src.mjs';

const art = fs.readFileSync('ART.md', 'utf8');
const html = readAllSource();   // sc-ums-web.html + css/ + js/ 전문(분할 이후 단일 입구)
let fail = 0;
const bad = (m) => { console.log('  ✗ ' + m); fail++; };

// ── 계열별 고정 블록 ────────────────────────────────────────────
const COMMON = [
  ['A 노출',    /clearly readable exposure with rich midtones/],
  ['C 안개',    /(haze|mist|vapour|dust)[^.]*catches the light/],
  ['C 탈채도',  /the palette is a tint over neutral greys, not a monochrome wash\./],
  ['C 명암분리', /strong value separation between/],
  ['E 금지',    /No text, no logos, no user interface,.*no watermark\.$/],
];
const FAMILY = {
  usemap: {
    label: '유즈맵 키 아트',
    need: [...COMMON,
      ['시점(내려다봄)', /from a high (three-quarter )?aerial angle/],
      ['C 근경',        /The haze is light in the foreground so nearby structures stay crisp and clearly legible/],
      ['D 구도(가운데)', /The very center of the frame is calm and uncluttered\./]],
  },
  title: {
    label: '타이틀 배경',
    need: [...COMMON,
      ['시점(올려다봄)', /from a low three-quarter angle/],
      ['D 구도(위쪽)',   /The upper third of the frame is calm open sky/],
      ['인물 실루엣',    /All figures are distant silhouettes, no close-up faces\./]],
  },
  // 🧬 종족 전장(§10) — 타이틀(§8)과 A·C·금지는 같고, 비우는 자리와 종족 수만 다르다.
  //   ⛔ 「아래 1/3 을 비운다」를 빼면 종족 행·확정 버튼이 그림 위에서 안 읽힌다.
  race: {
    label: '종족 전장',
    need: [...COMMON,
      ['시점(올려다봄)', /from a low three-quarter angle/],
      ['D 구도(아래쪽)', /The lower third of the frame is calm and uncluttered/],
      ['좌상단 비움',    /the upper left corner is free of bright detail/],
      ['인물 실루엣',    /All figures are distant silhouettes, no close-up faces\./]],
  },
  // 🗺 캠프·던전 맵(§11) — **유닛이 그 위를 걸어다니는 게임판**이라 다른 계열과 요구가 다르다.
  //   방법이 둘로 갈린다: 0번(캠프)은 레퍼런스 없이 뽑고, 1~10번(던전)은 그 0번을 첨부해 위쪽만 바꾼다.
  //   ⛔ 스타일을 형용사로 늘어놓지 말 것 — 던전은 레퍼런스가 스타일·색·조명을 다 정한다(§11-1).
  campmap: {
    label: '맵 · 0번 캠프(§11-3)',
    need: [
      ['탑다운 선언',    /top-down game map for a real-time strategy game/],
      ['시점(바로 위)',  /seen from directly above/],
      ['구조① 기지 터',  /bottom third of the frame is a stone-paved base platform/],
      ['기지 터 전폭',   /spanning the full width and running off both side edges/],
      ['구조② 열린 통로', /a wide open lane of bare earth runs up the centre/],
      ['구조③ 가장자리',  /banked along the left and right margins and into the upper corners/],
      ['덩어리 크기',    /much smaller than a building/],
      ['건물 금지',      /Nothing is built anywhere/],
      ['E 금지',        /No text, no logos, no user interface, no characters, no watermark.$/]],
  },
  dungeonmap: {
    label: '맵 · 1~10번 던전 템플릿(§11-4)',
    need: [
      ['레퍼런스 선언',  /Use the attached image as the reference/],
      // ⭐ 하단을 붙드는 것은 문구 셋이다(§11-4) — 숫자·생김새·금지. 하나라도 빠지면 하단이 제각각이 된다.
      ['하단 잠금',      /THE BOTTOM 62% OF THE FRAME IS LOCKED/],
      ['경계 위치',      /crossing the frame at about 38% down/],
      ['재그리기 금지',  /do not redraw it, do not restyle it, do not move it up or down/i],
      ['스타일 일치',    /Match the reference exactly in art style/],
      ['위쪽만 교체',    /Replace only the area above that band/],
      ['구조② 열린 통로', /runs up the centre to the top edge, clear of every obstacle/],
      ['구조③ 가장자리',  /banked along the left and right margins and into the upper corners/],
      ['잔해만',        /Nothing intact is standing anywhere/],
      ['E 금지',        /No text, no logos, no user interface, no characters, no watermark.$/]],
  },
  // 🟩 유즈맵 바닥(§12) — **통짜 한 장**. 판 위에 유닛이 서므로 요구가 다르다:
  //   평평해야 하고(솟은 것 금지) · 길처럼 읽힐 것이 없어야 하고 · 타일 전용 문구가 섞이면 판이 사라진다.
  //   ⛔ 'seamless tileable' 이 들어가면 「사방이 이어지는 무늬」와 「떠 있는 판 하나」가 모순돼
  //      판·테두리·우주가 통째로 사라진다(2026-08-28 실제로 물어본 함정).
  floor: {
    label: '유즈맵 바닥(§12)',
    need: [
      ['시점(정투영)', /perfectly flat top-down orthographic view straight from above, no perspective, no horizon/],
      ['조명(무방향)', /flat even ambient lighting with no directional shadows and no visible light source/],
      ['디테일 상한',  /fine small-scale surface detail, nothing larger than a fist/],
      // 채도 줄은 장면이 고른다(§12-2) — 어두운 흙 / 밝은 인공물 / 살아 있는 초록. 셋 다 허용한다.
      ['채도',        /palette.{0,60}?(dark tones|bright and evenly lit|low contrast)/],
      ['여백',        /(central 80% of the width|clear of the outer edges of the frame)/],
      ['금지',        /no characters, no objects, no units, no structures, no text, no user interface/],
      ['품질 어휘',   /highly detailed photorealistic PBR game texture, AAA game environment asset/],
      ['세로 구도',   /(tall vertical composition|vertical portrait composition)/],
      ['평평·걸을 수 있음', /stays flat and walkable/],
      ['솟은 것 금지', /never in raised obstacles/],
      ['길 금지',     /no paths, no markings/],
      // ⚠ 프롬프트는 여러 줄이라 낱말 사이가 공백일 수도 개행일 수도 있다 — \s+ 로 잡는다
      ['테두리 두께', /one\s+twentieth\s+of\s+(the\s+slab|its\s+height)/]],
    ban: [['타일 전용 문구', /seamless|tileable|square tile/i]],
  },
  // 🐺 유닛 참고 아트(§9) — 환경 계열의 COMMON(안개·탈채도·명암분리)을 쓰지 않는다. 목적이 8방향 스프라이트 원본이라
  //   지켜야 할 것이 다르다: 배경이 흰 단색인가 · 그림자가 발밑인가 · 조명이 고정인가 · 금지줄이 있는가.
  unit: {
    label: '유닛 참고 아트',
    need: [
      ['흰 배경',     /flat plain white/],
      ['발밑 그림자', /soft contact shadow directly beneath/],
      ['균일 조명',   /even neutral light/],
      ['E 금지',      /No text, no logos, no user interface,[\s\S]*no watermark/]],
    // 카메라를 말하는 프롬프트(§9-5·9-6)는 각도와 투영을 못박아야 한다 — 숫자를 빼면 45~60°가 나오고,
    // 원근이 들어가면 앞다리만 부풀어 발밑 그림자·선택 링과 어긋난다(§9-9 실패 기록)
    needIfCamera: [
      ['카메라 37도', /about 37 degrees/],
      ['오쏘그래픽',  /orthographic/i],
      ['광각 금지',   /no wide-angle lens/i]],
  },
};
// ⚠ 'not pitch black' 은 **원하는** 문구다 — 앞에 not 이 없는 경우만 잡는다
const BANNED = [
  ['near-black',  /(?<!not )deep near-black/i],
  ['lit only by', /lit only by/i],
  ['pitch black', /(?<!not )pitch black/i],
  ['과장 수식어',  /\b(masterpiece|epic|dramatic lighting)\b/i],
];

// ── 프롬프트를 계열별로 모은다(어느 ## 아래에 있는가) ──────────────
const prompts = { usemap: [], title: [], unit: [], race: [], campmap: [], dungeonmap: [], floor: [] };
{
  let fam = null;
  // 환경 계열은 한 줄 프롬프트(Moody…), 유닛 계열은 여러 문단이라 블록 전체를 담는다.
  // ⚠ 언어 태그가 붙은 펜스(```bash)도 함께 잡아야 짝이 안 어긋난다 — 안 잡으면 그 닫는 ``` 을
  //    여는 펜스로 오인해 그 뒤 전부가 한 덩어리로 삼켜진다(§ 헤더까지 먹어 계열 판정이 무너졌다).
  const re = /^## (\d+)\.|^```([a-z]*)\n([\s\S]*?)\n```/gm;
  let m;
  while ((m = re.exec(art))) {
    if (m[1]) { fam = m[1] === '8' ? 'title' : (m[1] === '6' ? 'usemap' : (m[1] === '9' ? 'unit' : (m[1] === '10' ? 'race' : (m[1] === '11' ? 'camp' : (m[1] === '12' ? 'floor' : null))))); continue; }
    if (m[2] || !fam) continue;   // 언어 태그가 있으면 프롬프트가 아니다(bash 등)
    const body = m[3];
    if (/[가-힣]/.test(body)) continue;   // 한글이 있으면 프롬프트가 아니다(설명용 도표 등)
    if (fam === 'unit') { if (!/^\[UNIT:/.test(body)) prompts.unit.push(body); }   // [UNIT:…] 은 변수 칸 = 검사 대상 아님
    // §11 은 매체 문장이 달라 'Moody' 로 시작하지 않는다. 던전(battlefield)과 캠프(home-camp)를 문장으로 가른다.
    // §11 은 둘로 갈린다: 레퍼런스를 쓰는 던전 템플릿과, 레퍼런스 없이 뽑는 0번 캠프.
    else if (fam === 'camp') { if (/^Use the attached/.test(body)) prompts.dungeonmap.push(body);
                               else if (/^A tall vertical top-down/.test(body)) prompts.campmap.push(body); }
    // §12 는 조각(형태·테두리·우주 블록)도 펜스라 **전문만** 고른다: 형태 문장으로 시작하고 공통 블록 끝줄까지 있는 것
    // ⚠ 줄바꿈을 공백으로 눌러서 담는다 — 문장이 여러 줄에 걸쳐 있어 낱말 사이에 개행이 끼고,
    //    그대로 두면 'stays flat and\nwalkable' 같은 곳에서 정규식이 헛돈다(두 번 겪었다).
    else if (fam === 'floor') { if (/^A single vast rectangular slab/.test(body) && /composition/.test(body)) prompts.floor.push(body.replace(/\s+/g, ' ')); }
    else if (/^Moody/.test(body)) prompts[fam].push(body);
  }
}

for (const key of ['usemap', 'title', 'unit', 'race', 'campmap', 'dungeonmap', 'floor']) {
  const F = FAMILY[key], list = prompts[key];
  console.log(`${F.label} 프롬프트 ${list.length}개`);
  if (!list.length) bad(`${F.label} 프롬프트를 하나도 못 찾았다 — ART.md 형식이 바뀌었나?`);
  list.forEach((p, i) => {
    const need = F.need.concat((F.needIfCamera && /\bdegrees?\b/i.test(p)) ? F.needIfCamera : []);
    const miss = need.filter(([, re]) => !re.test(p)).map(([n]) => n);
    const hit = BANNED.concat(F.ban || []).filter(([, re]) => re.test(p)).map(([n]) => n);
    if (miss.length || hit.length) {
      bad(`#${i + 1} ${miss.length ? '빠진 고정블록: ' + miss.join(', ') : ''}${hit.length ? '  금지 표현: ' + hit.join(', ') : ''}`);
    } else {
      console.log(`  ✓ #${i + 1} 고정 블록 ${need.length}종 · 금지 표현 없음`);
    }
  });
}

// ── 문서의 맵 표 ↔ 코드의 UMAP_BG ↔ 실제 파일 ─────────────────────
const umap = (html.match(/const UMAP_BG=\{([^}]*)\}/) || [])[1] || '';
const inCode = [...umap.matchAll(/(\w+)\s*:/g)].map(m => m[1]);
const files = fs.existsSync('assets/backgrounds/usemaps')
  ? fs.readdirSync('assets/backgrounds/usemaps').filter(f => f.endsWith('.webp')).map(f => f.replace('.webp', ''))
  : [];

console.log(`\nUMAP_BG ${inCode.length}개 · 유즈맵 그림 ${files.length}장`);
for (const id of inCode) {
  const share = (umap.match(new RegExp(id + "\\s*:\\s*'(\\w+)'")) || [])[1];
  const want = share || id;
  if (!files.includes(want)) bad(`UMAP_BG 의 '${id}' 가 가리키는 ${want}.webp 가 없다`);
}
for (const f of files) {
  if (!inCode.includes(f) && !umap.includes(`'${f}'`)) bad(`${f}.webp 가 있는데 UMAP_BG 에 등록되지 않았다 — 게임이 안 쓴다`);
  if (!art.includes('`' + f + '`')) bad(`${f} 가 ART.md §3 맵 표에 없다`);
}

// ── 타이틀 배경은 코드가 경로를 직접 쓴다 ──────────────────────────
{
  const used = /assets\/backgrounds\/title\/([\w-]+)\.webp/.exec(html);
  if (!used) bad('코드가 타이틀 배경(assets/backgrounds/title/*.webp)을 참조하지 않는다');
  else if (!fs.existsSync(`assets/backgrounds/title/${used[1]}.webp`))
    bad(`코드가 쓰는 타이틀 배경 ${used[1]}.webp 가 없다`);
  else console.log(`타이틀 배경 ${used[1]}.webp ✓`);
}

console.log(fail ? `\n❌ ART 규격 ${fail}건 불일치` : '\n✅ ART 규격 통과');
process.exit(fail ? 1 : 0);
