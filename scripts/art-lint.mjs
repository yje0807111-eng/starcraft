// 🎨 ART.md 규격 검사 — 프롬프트가 스타일에서 새지 않았는지 기계로 확인한다.
//
// 왜 필요한가: 이미지 스타일은 '다음 사람이 프롬프트를 새로 쓰는 순간' 무너진다.
// 실제로 한 번 무너졌다 — 밝기 문제로 프롬프트를 다시 쓰면서 구도 문장(§2-D)을 흘렸고,
// 문서에는 "넣는다"고 적혀 있는데 실물에는 없는 상태가 됐다. 그런 어긋남을 잡는 게 이 스크립트다.
//
// ⚠ **계열이 둘이다**(2026-08-20). 둘은 목적이 달라 시점·구도가 반대다 —
//    한 벌의 규칙으로 검사하면 타이틀 프롬프트가 무조건 실패한다.
//      · 유즈맵 키 아트(§6) — 내려다보는 맵 그림. 가운데를 비운다(미니맵 자리)
//      · 타이틀 배경(§8)    — 올려다보는 전투 그림. 위쪽을 비운다(제목 자리)
//    프롬프트가 어느 §에 적혔는지로 계열을 가른다.
//
// 검사 내용
//   ① 계열별 고정 블록이 전부 있는가
//   ② 금지 표현이 들어갔는가 (near-black 계열 — 화면이 새까매진다)
//   ③ ART.md 의 맵 표와 UMAP_BG(코드)가 서로 맞는가
//
// 실행: node scripts/art-lint.mjs      (실패하면 exit 1)
import fs from 'node:fs';

const art = fs.readFileSync('ART.md', 'utf8');
const html = fs.readFileSync('sc-ums-web.html', 'utf8');
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
};
// ⚠ 'not pitch black' 은 **원하는** 문구다 — 앞에 not 이 없는 경우만 잡는다
const BANNED = [
  ['near-black',  /(?<!not )deep near-black/i],
  ['lit only by', /lit only by/i],
  ['pitch black', /(?<!not )pitch black/i],
  ['과장 수식어',  /\b(masterpiece|epic|dramatic lighting)\b/i],
];

// ── 프롬프트를 계열별로 모은다(어느 ## 아래에 있는가) ──────────────
const prompts = { usemap: [], title: [] };
{
  let fam = null;
  const re = /^## (\d+)\.|^```\n(Moody[^\n]*)\n```/gm;
  let m;
  while ((m = re.exec(art))) {
    if (m[1]) { fam = m[1] === '8' ? 'title' : (m[1] === '6' ? 'usemap' : null); continue; }
    if (m[2] && fam) prompts[fam].push(m[2]);
  }
}

for (const key of ['usemap', 'title']) {
  const F = FAMILY[key], list = prompts[key];
  console.log(`${F.label} 프롬프트 ${list.length}개`);
  if (!list.length) bad(`${F.label} 프롬프트를 하나도 못 찾았다 — ART.md 형식이 바뀌었나?`);
  list.forEach((p, i) => {
    const miss = F.need.filter(([, re]) => !re.test(p)).map(([n]) => n);
    const hit = BANNED.filter(([, re]) => re.test(p)).map(([n]) => n);
    if (miss.length || hit.length) {
      bad(`#${i + 1} ${miss.length ? '빠진 고정블록: ' + miss.join(', ') : ''}${hit.length ? '  금지 표현: ' + hit.join(', ') : ''}`);
    } else {
      console.log(`  ✓ #${i + 1} 고정 블록 ${F.need.length}종 · 금지 표현 없음`);
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
