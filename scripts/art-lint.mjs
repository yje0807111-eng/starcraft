// 🎨 ART.md 규격 검사 — 프롬프트가 스타일에서 새지 않았는지 기계로 확인한다.
//
// 왜 필요한가: 이미지 스타일은 '다음 사람이 프롬프트를 새로 쓰는 순간' 무너진다.
// 실제로 한 번 무너졌다 — 밝기 문제로 프롬프트를 다시 쓰면서 구도 문장(§2-D)을 흘렸고,
// 문서에는 "넣는다"고 적혀 있는데 실물에는 없는 상태가 됐다. 그런 어긋남을 잡는 게 이 스크립트다.
//
// 검사 대상 = ART.md §6 에 적힌 프롬프트 전문.
//   ① 고정 블록(A 노출 · 시점 · C 안개 · C 팔레트 · D 구도 · E 금지)이 전부 있는가
//   ② 금지 표현이 들어갔는가 (near-black 계열 — 화면이 새까매진다)
//   ③ ART.md 의 맵 표와 UMAP_BG(코드)가 서로 맞는가
//
// 실행: node scripts/art-lint.mjs      (실패하면 exit 1)
import fs from 'node:fs';

const art = fs.readFileSync('ART.md', 'utf8');
const html = fs.readFileSync('sc-ums-web.html', 'utf8');
let fail = 0;
const bad = (m) => { console.log('  ✗ ' + m); fail++; };

// ── ① 프롬프트 전문 ─────────────────────────────────────────────
const prompts = [...art.matchAll(/```\n(Moody sci-fi game environment key art[^\n]*)\n```/g)].map(m => m[1]);

const REQUIRED = [
  ['A 노출',    /clearly readable exposure with rich midtones, not underexposed, not pitch black\./],
  ['시점',      /from a high (three-quarter )?aerial angle/],
  ['C 안개',    /(haze|mist|vapour)[^.]*catches the light[^.]*lifting the shadows into visible/],
  ['C 팔레트',  /Dominant [^.]*palette/],
  ['C 근경',    /The haze is light in the foreground so nearby structures stay crisp and clearly legible/],
  ['C 탈채도',   /the palette is a tint over neutral greys, not a monochrome wash\./],
  ['C 명암분리', /strong value separation between structures and background/],
  ['D 구도',    /The very center of the frame is calm and uncluttered\./],
  ['E 금지',    /No text, no logos, no user interface, no characters, no watermark\.$/],
];
// ⚠ 'not pitch black' 은 **원하는** 문구다 — 앞에 not 이 없는 경우만 잡는다
const BANNED = [
  ['near-black',   /(?<!not )deep near-black/i],
  ['lit only by',  /lit only by/i],
  ['pitch black',  /(?<!not )pitch black/i],
  ['과장 수식어',   /\b(masterpiece|epic|dramatic lighting)\b/i],
];

console.log(`ART.md §6 프롬프트 ${prompts.length}개`);
if (!prompts.length) bad('프롬프트 전문을 하나도 못 찾았다 — §6 형식이 바뀌었나?');
prompts.forEach((p, i) => {
  const miss = REQUIRED.filter(([, re]) => !re.test(p)).map(([n]) => n);
  const hit = BANNED.filter(([, re]) => re.test(p)).map(([n]) => n);
  if (miss.length || hit.length) {
    bad(`#${i + 1} ${miss.length ? '빠진 고정블록: ' + miss.join(', ') : ''}${hit.length ? '  금지 표현: ' + hit.join(', ') : ''}`);
  } else {
    console.log(`  ✓ #${i + 1} 고정 블록 6종 · 금지 표현 없음`);
  }
});

// ── ② 문서의 맵 표 ↔ 코드의 UMAP_BG ─────────────────────────────
const umap = (html.match(/const UMAP_BG=\{([^}]*)\}/) || [])[1] || '';
const inCode = [...umap.matchAll(/(\w+)\s*:/g)].map(m => m[1]);
const files = fs.existsSync('assets/backgrounds/usemaps')
  ? fs.readdirSync('assets/backgrounds/usemaps').filter(f => f.endsWith('.webp')).map(f => f.replace('.webp', ''))
  : [];

console.log(`\nUMAP_BG ${inCode.length}개 · 파일 ${files.length}장`);
for (const id of inCode) {
  // 문자열 값이면 다른 맵의 그림을 공유한다 → 그 대상 파일이 있으면 된다
  const share = (umap.match(new RegExp(id + "\\s*:\\s*'(\\w+)'")) || [])[1];
  const want = share || id;
  if (!files.includes(want)) bad(`UMAP_BG 의 '${id}' 가 가리키는 ${want}.webp 가 없다`);
}
for (const f of files) {
  if (!inCode.includes(f) && !umap.includes(`'${f}'`)) bad(`${f}.webp 가 있는데 UMAP_BG 에 등록되지 않았다 — 게임이 안 쓴다`);
  if (!art.includes('`' + f + '`')) bad(`${f} 가 ART.md §3 맵 표에 없다`);
}

console.log(fail ? `\n❌ ART 규격 ${fail}건 불일치` : '\n✅ ART 규격 통과');
process.exit(fail ? 1 : 0);
