// 함수 한 개를 다락으로 옮긴다. ⚠ 중괄호를 셀 때 **문자열·주석·정규식을 건너뛴다** —
//    그냥 세면 '{' 같은 리터럴에 걸려 다음 함수까지 통째로 잘라 간다(실제로 그랬다).
import fs from 'fs';
export function cutFunction(s, name){
  const re=new RegExp('^function\\s+'+name.replace(/\$/g,'\\$')+'\\s*[\\(\\s]','m');
  const m=re.exec(s); if(!m) return null;
  let start=m.index;
  { const before=s.slice(0,start).split('\n'); let k=before.length-1;
    while(k>0 && /^\s*\/\//.test(before[k-1])) k--;
    if(k<before.length-1) start=before.slice(0,k).join('\n').length+1; }
  let i=s.indexOf('{', m.index); if(i<0) return null;
  let d=0, j=i, prev='';
  while(j<s.length){
    const c=s[j], c2=s.slice(j,j+2);
    if(c2==='//'){ j=s.indexOf('\n',j); if(j<0) j=s.length; continue; }
    if(c2==='/*'){ j=s.indexOf('*/',j+2); j=(j<0)?s.length:j+2; continue; }
    if(c==='"'||c==="'"||c==='`'){ const q=c; j++;
      while(j<s.length){ if(s[j]==='\\'){ j+=2; continue; } if(s[j]===q){ j++; break; }
        if(q==='`' && s.slice(j,j+2)==='${'){ let dd=1; j+=2;
          while(j<s.length&&dd){ if(s[j]==='{')dd++; else if(s[j]==='}')dd--; j++; } continue; }
        j++; } continue; }
    // 정규식 리터럴 — 앞이 값이 아닐 때만
    if(c==='/' && /[=(,:[!&|?{};\n]/.test(prev)){ j++;
      while(j<s.length){ if(s[j]==='\\'){ j+=2; continue; } if(s[j]==='/'){ j++; break; }
        if(s[j]==='\n') break; j++; } continue; }
    if(c==='{') d++;
    else if(c==='}'){ d--; if(!d){ j++; break; } }
    if(!/\s/.test(c)) prev=c;
    j++;
  }
  if(d!==0) return null;                      // 균형이 안 맞으면 **자르지 않는다**
  while(j<s.length && s[j]!=='\n') j++;
  return { body:s.slice(start,j).trim(), rest:s.slice(0,start)+s.slice(j+1) };
}
