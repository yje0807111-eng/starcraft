import fs from 'fs';
const html=fs.readFileSync('sc-ums-web.html','utf8');
const smoke=fs.readFileSync('test/smoke.js','utf8');
const files=fs.readdirSync('js').filter(f=>f.endsWith('.js')).sort();
const src={}; for(const f of files) src[f]=fs.readFileSync('js/'+f,'utf8');
function scan(code,file){const fns=[];const re=/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;let m;
 while((m=re.exec(code))){let i=code.indexOf('{',m.index);if(i<0)continue;let d=0,j=i,inS=null,esc=false;
  for(;j<code.length;j++){const c=code[j];
   if(inS){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}
    if(inS==='//'&&c==='\n')inS=null;else if(inS==='/*'&&c==='*'&&code[j+1]==='/'){inS=null;j++;}
    else if((inS==="'"||inS==='"'||inS==='`')&&c===inS)inS=null;continue;}
   if(c==='/'&&code[j+1]==='/'){inS='//';j++;continue;}
   if(c==='/'&&code[j+1]==='*'){inS='/*';j++;continue;}
   if(c==="'"||c==='"'||c==='`'){inS=c;continue;}
   if(c==='{')d++;else if(c==='}'){d--;if(d===0){j++;break;}}}
  fns.push({name:m[1],body:code.slice(m.index,j),file});}return fns;}
const fns=[];for(const f of files)fns.push(...scan(src[f],f));
const w=n=>new RegExp('\\b'+n.replace(/\$/g,'\\$')+'\\b');
const IDS=process.argv.slice(2);
for(const id of IDS){
  const re=new RegExp("['\"]"+id+"['\"]");
  const touch=fns.filter(f=>re.test(f.body)).map(f=>f.name);
  const inSmokeId=re.test(smoke)||w(id).test(smoke);
  const inSmokeFn=touch.filter(n=>w(n).test(smoke));
  const htmlFn=touch.filter(n=>new RegExp('\\b'+n+'\\s*\\(').test(html));
  const inHtmlId=w(id).test(html.replace(new RegExp('id="'+id+'"','g'),''));
  const verdict = (!inSmokeId && !inSmokeFn.length) ? 'SMOKE-무관' : '스모크가 씀';
  console.log([id.padEnd(16), verdict.padEnd(12), 'html호출:'+(htmlFn.join(',')||'-'), '| 다루는함수:'+(touch.join(',')||'-')].join(' '));
}
