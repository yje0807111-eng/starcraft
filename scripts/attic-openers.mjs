import fs from 'fs';
const html = fs.readFileSync('sc-ums-web.html','utf8');
const files = fs.readdirSync('js').filter(f=>f.endsWith('.js')).sort();
const src = {}; for(const f of files) src[f]=fs.readFileSync('js/'+f,'utf8');
const all = files.map(f=>src[f]).join('\n');

// 함수 선언 목록 + 각 함수의 본문 범위(문자열/주석을 건너뛰는 중괄호 스캔)
function scan(code){
  const fns=[]; const re=/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm; let m;
  while((m=re.exec(code))){
    let i=code.indexOf('{', m.index); if(i<0) continue;
    let d=0,j=i,inS=null,esc=false;
    for(;j<code.length;j++){ const c=code[j];
      if(inS){ if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;}
        if(inS==='//'&&c==='\n') inS=null;
        else if(inS==='/*'&&c==='*'&&code[j+1]==='/'){inS=null;j++;}
        else if((inS==="'"||inS==='"'||inS==='`')&&c===inS) inS=null;
        continue; }
      if(c==='/'&&code[j+1]==='/'){inS='//';j++;continue;}
      if(c==='/'&&code[j+1]==='*'){inS='/*';j++;continue;}
      if(c==="'"||c==='"'||c==='`'){inS=c;continue;}
      if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}
    }
    fns.push({name:m[1], body:code.slice(m.index,j)});
  }
  return fns;
}
const fns=[]; for(const f of files) for(const fn of scan(src[f])) fns.push({...fn, file:f});
const byName={}; for(const fn of fns) byName[fn.name]=fn;

// 호출자 찾기: 이름이 등장하는 함수들
function callers(name){
  const re=new RegExp('\\b'+name.replace(/\$/g,'\\$')+'\\b');
  return fns.filter(fn=>fn.name!==name && re.test(fn.body)).map(fn=>fn.name+' ('+fn.file+')');
}
function inHtml(name){
  return new RegExp('\\b'+name.replace(/\$/g,'\\$')+'\\s*\\(').test(html);
}
const targets = process.argv.slice(2);
for(const id of targets){
  console.log('\n=== #'+id+' ===');
  // 이 id 를 여는 코드
  const re=new RegExp("['\"]"+id+"['\"]");
  const hit=fns.filter(fn=>re.test(fn.body));
  for(const fn of hit){
    const lines=fn.body.split('\n').filter(l=>re.test(l)).slice(0,3).map(l=>l.trim().slice(0,110));
    console.log('  · '+fn.name+' ('+fn.file+')  HTML직접호출='+(inHtml(fn.name)?'O':'-'));
    for(const l of lines) console.log('      '+l);
  }
  if(!hit.length) console.log('  (js 에서 이 id 를 다루는 함수 없음)');
}
