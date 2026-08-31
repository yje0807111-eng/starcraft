// 🚪 「여는 함수는 있는데 부르는 곳이 없는 것」 = 고아 입구를 찾는다.
//    선례: 마을을 치우자 로그아웃 확인창(askLogout)이 고아가 됐다(2026-08-27).
//    ⚠ 이름이 어디서든 언급되기만 하면 살아 있다고 본다 — 놓치는 쪽으로 기운다(거짓 고발이 더 위험).
import fs from 'fs';
const html=fs.readFileSync('sc-ums-web.html','utf8');
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
  fns.push({name:m[1],file,body:code.slice(m.index,j)});}
 return fns;}
const fns=[]; for(const f of files) fns.push(...scan(src[f],f));
// 「무언가를 화면에 띄우는」 함수만 후보로
const OPENS=/classList\.remove\(\s*['"]hide['"]|showAppScreen\(|popShow\(|\.hide\s*=\s*false|style\.display\s*=\s*['"](?:flex|block)['"]/;
const cand=fns.filter(f=>OPENS.test(f.body) && !/^js\/99-attic/.test('js/'+f.file));
// ⚠ 「부르는 곳」은 **함수 본문만 훑으면 안 된다** — NAV_TREE 같은 최상위 표 안의 화살표 함수,
//    JS 가 문자열로 만드는 onclick 이 전부 빠진다(그렇게 해서 살아 있는 5개를 고아로 몰았다).
//    파일 전체 텍스트에서 세고, **주석에 이름만 나와도 살아 있다고 본다** — 놓치는 쪽으로 기운다.
const w=n=>new RegExp('\\b'+n.replace(/\$/g,'\\$')+'\\b','g');
const decl=n=>new RegExp('^\\s*function\\s+'+n.replace(/\$/g,'\\$')+'\\b');
function mentioned(name, text){
  const lines=text.split('\n'), re=w(name);
  for(const l of lines){ re.lastIndex=0; if(re.test(l) && !decl(name).test(l)) return true; }
  return false;
}
const rows=[];
for(const f of cand){
  if(mentioned(f.name, html)) continue;
  let live=false;
  for(const g of files){ if(g==='99-attic.js') continue;
    if(mentioned(f.name, src[g])){ live=true; break; } }
  if(!live) rows.push(f);
}
// ⚠ 이 함수들은 **팝업도 함께 다락으로 갔다** — 입구가 없는 게 맞다(ATTIC.md §3-D).
//    살아 있는 코드와 얽혀 있어 함수는 제자리에 뒀다(예: hbSetRound ← profRebirth).
//    ⛔ 새 이름이 여기 들어오려면, 그 화면이 정말 필요 없는지 먼저 확인하고 ATTIC.md 에 적을 것.
const KNOWN=new Set(['hbOpenRounds','hbOpenMates','openTownPanel']);
const fresh=rows.filter(r=>!KNOWN.has(r.name));
console.log('여는 함수 '+cand.length+'개 · 부르는 곳이 없는 것 '+rows.length+'개 (알고 있는 것 '+(rows.length-fresh.length)+')');
for(const r of rows) console.log('  '+(KNOWN.has(r.name)?'· ':'⚠ ')+r.name.padEnd(24)+r.file);
if(fresh.length){
  console.log('\n❌ 새로 고아가 된 입구가 있습니다 — 화면은 살아 있는데 부르는 곳이 사라진 것일 수 있습니다.');
  console.log('   (선례: 마을을 치우자 로그아웃 확인창이 고아가 됐다 · 2026-08-27)');
  for(const r of fresh) console.log('   · '+r.name+'  ['+r.file+']');
  process.exit(1);
}
console.log('✅ 새로 고아가 된 입구 없음');
