import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const OUT=process.argv[2], dirs=process.argv.slice(3);
const T=230, tiles=[];
for(let r=0;r<dirs.length;r++){
  const d=dirs[r], fl=fs.readdirSync(d).filter(f=>/^f\d+\.(png|webp)$/.test(f)).sort();
  for(let i=0;i<fl.length;i++)
    tiles.push({input: await sharp(path.join(d,fl[i])).resize(T,T,{fit:'contain',background:'#00000000'})
      .composite([{input:Buffer.from(`<svg width="${T}" height="${T}"><text x="4" y="18" font-size="16" fill="#ff0" font-family="monospace">${path.basename(d)}.${i}</text></svg>`),top:0,left:0}])
      .png().toBuffer(), top:r*T, left:i*T});
}
await sharp({create:{width:8*T,height:dirs.length*T,channels:3,background:'#6e6e6e'}})
  .composite(tiles).jpeg({quality:85}).toFile(OUT); console.log('완료');
