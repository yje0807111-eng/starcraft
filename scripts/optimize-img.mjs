// PNG → WebP 변환(참조되는 이미지만) — 포트레이트/타일/배경
// 원본 .png는 남겨둠(참조 갱신·검증 후 별도 삭제). .webp 산출.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// [dir, maxSize, quality] — 카테고리별 목표
const JOBS = [
  { dir:'assets/portraits', max:512,  q:82, only:/_portrait\.png$/ },   // UI 칩(소형)
  { dir:'assets/tiles',     max:512,  q:82 },                            // 반복 패턴
  { dir:'assets/backgrounds', max:1280, q:78 },                         // 풀스크린 배경
  // 던전 배경은 코드가 경로를 조립해(hbBgImg) HTML에 파일명이 없다 → 참조 검사를 건너뛴다
  { dir:'assets/backgrounds/dungeons', max:1024, q:80, always:true },
  // ⛔ 유즈맵 키 아트(assets/backgrounds/usemaps)는 여기서 다루지 않는다 — scripts/usemap-bg.mjs 가 맡는다.
  //    맵마다 노출이 3배씩 흔들려서 '밝기 정규화'가 필요한데, 이 스크립트는 그냥 변환기다.
  { dir:'assets/backgrounds/town', max:2048, q:80, always:true },        // 마을 바닥(2:3 세로) — 바닥 레이어가 1438x2267이라 1536으론 모자란다
];

// 참조되는 파일만 변환(미참조 데드 에셋은 건드리지 않음)
const html = fs.readFileSync('sc-ums-web.html','utf8');
// 포트레이트는 PORTRAIT_DIR+'파일명'으로 연결되므로 파일명(basename) 기준으로 참조 판정
function referenced(rel){ const base = rel.split('/').pop(); return html.includes(base); }

let before=0, after=0, n=0, skipped=[];
for (const job of JOBS){
  if(!fs.existsSync(job.dir)) continue;
  for (const f of fs.readdirSync(job.dir)){
    if (!f.toLowerCase().endsWith('.png')) continue;
    if (job.only && !job.only.test(f)) continue;
    const abs = path.join(job.dir, f);
    const rel = (job.dir + '/' + f);
    if (!job.always && !referenced(rel)) { skipped.push(rel); continue; }   // 미참조 스킵
    const sz0 = fs.statSync(abs).size;
    if (sz0 === 0) { skipped.push(rel+' (0B)'); continue; }
    const out = abs.replace(/\.png$/i, '.webp');
    await sharp(abs).resize(job.max, job.max, { fit:'inside', withoutEnlargement:true }).webp({ quality: job.q }).toFile(out);
    const sz1 = fs.statSync(out).size;
    before += sz0; after += sz1; n++;
    console.log(`✓ ${rel.padEnd(46)} ${(sz0/1024).toFixed(0)}KB → ${(sz1/1024).toFixed(0)}KB (${(sz0/sz1).toFixed(1)}×)`);
  }
}
console.log(`\n변환 ${n}개 · ${(before/1048576).toFixed(1)}MB → ${(after/1048576).toFixed(1)}MB (${(before/Math.max(1,after)).toFixed(1)}× 감소)`);
if (skipped.length) console.log(`미참조 스킵 ${skipped.length}개: ${skipped.join(', ')}`);
