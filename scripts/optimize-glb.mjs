// GLB 텍스처 최적화 배치 — 리사이즈 + WebP 재인코딩(무손실 지오메트리 유지)
// 사용: node scripts/optimize-glb.mjs [--dry]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, prune, dedup } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = path.resolve('assets');
// 이미 최적화된 작은 파일은 건너뜀(이중 압축 방지) — 이 크기 미만은 스킵
const MIN_BYTES = 1_200_000;

// 카테고리별 최대 텍스처 해상도(밸런스): 유닛 512 / 건물·신전 1024 / 비콘 512
function targetFor(rel){
  if (rel.startsWith('models/')) return 512;
  if (rel.startsWith('buildings/')) return 1024;   // 신전 포함
  if (rel.startsWith('beacons/')) return 512;
  return 1024;
}

function walk(dir){
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes:true })){
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.toLowerCase().endsWith('.glb')) out.push(p);
  }
  return out;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = walk(ROOT).sort();
let before = 0, after = 0, done = 0, failed = [];

console.log(`대상 GLB ${files.length}개 · ${DRY ? '[DRY RUN]' : '재인코딩'}\n`);

for (const abs of files){
  const rel = path.relative(ROOT, abs).replace(/\\/g,'/');
  const size = targetFor(rel);
  const sz0 = fs.statSync(abs).size;
  if (sz0 < MIN_BYTES) { continue; }   // 이미 최적화됨 → 스킵
  before += sz0;
  try {
    const doc = await io.read(abs);
    await doc.transform(
      // 큰 텍스처만 축소(원본보다 크게 업스케일 안 함) + WebP 변환
      textureCompress({ encoder: sharp, targetFormat:'webp', resize:[size,size], resizeFilter:'lanczos3', quality: 90 }),
      dedup(),
      prune(),
    );
    let sz1 = sz0;
    if (!DRY){
      await io.write(abs, doc);
      sz1 = fs.statSync(abs).size;
    }
    after += DRY ? sz0 : sz1;
    done++;
    const mb0 = (sz0/1048576).toFixed(2), mb1 = (sz1/1048576).toFixed(2);
    const ratio = sz1>0 ? (sz0/sz1).toFixed(1) : '?';
    console.log(`✓ ${rel.padEnd(44)} ${mb0}MB → ${mb1}MB (${ratio}×, @${size})`);
  } catch(e){
    failed.push(rel);
    console.log(`✗ ${rel}  — ${String(e).slice(0,120)}`);
  }
}

console.log(`\n완료 ${done}/${files.length}${failed.length?` · 실패 ${failed.length}: ${failed.join(', ')}`:''}`);
console.log(`총량 ${(before/1048576).toFixed(1)}MB → ${(after/1048576).toFixed(1)}MB (${(before/Math.max(1,after)).toFixed(1)}× 감소)`);
