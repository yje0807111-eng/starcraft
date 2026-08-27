import fs from 'fs'; import { execSync } from 'child_process';
import { cutFunction } from './move2.mjs';
// ⚠ 잘라낸 덩어리 안에 **다른 최상위 선언**이 섞이면 안 된다. 최상위는 들여쓰기가 없으므로
//   둘째 줄부터 줄 맨 앞에 function/const/let/var/class 가 나오면 경계를 잘못 잡은 것이다.
//   (앞선 실패: TRANSCEND_RECIPE 가 딸려갔는데 이름 집합 비교로는 못 잡았다)
//   ⚠ 덩어리 앞에는 그 함수의 주석이 붙어 있다 — 「둘째 줄부터」가 아니라
//     **함수 정의 줄 다음부터** 봐야 한다(안 그러면 정의 자체가 걸린다).
const extraDecl=(body,name)=>{ const L=body.split('\n');
  const i=L.findIndex(l=>new RegExp('^function\\s+'+name.replace(/\$/g,'\\$')+'\\b').test(l));
  return (i<0?L:L.slice(i+1)).filter(l=>/^(?:function|const|let|var|class)\s/.test(l)); };
const PLAN=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ATTIC='js/99-attic.js';
let ok=0; const skip=[];
for(const [file,names] of Object.entries(PLAN)){
  for(const n of names){
    const before=fs.readFileSync(file,'utf8');
    const cut=cutFunction(before,n);
    if(!cut){ skip.push(file+'::'+n+' — 경계를 못 잡음'); continue; }
    fs.writeFileSync(file,cut.rest);
    const undo=(why)=>{ fs.writeFileSync(file,before); skip.push(file+'::'+n+' — '+why); };
    try{ execSync('node --check '+file,{stdio:'pipe'}); }catch(e){ undo('문법 깨짐'); continue; }
    const extra=extraDecl(cut.body,n);
    if(extra.length){ undo('덩어리에 다른 최상위 선언이 섞임: '+extra[0].slice(0,40)); continue; }
    fs.appendFileSync(ATTIC,'\n// ── ['+file+'] '+n+'\n'+cut.body+'\n');
    ok++;
  }
}
console.log('옮김 '+ok+'개');
if(skip.length) console.log('건너뜀 '+skip.length+':\n  '+skip.join('\n  '));
