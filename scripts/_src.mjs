/* ============================================================================
 * 소스 전문 한 덩어리로 읽기
 *
 * sc-ums-web.html 은 2026-08-20 에 css/ · js/ 로 쪼개졌다. "코드 어딘가에 이
 * 문자열이 있나"를 묻는 도구(art-lint · optimize-img …)는 이제 HTML 만 읽으면
 * 안 된다 — 데이터와 로직이 전부 js/ 로 옮겨갔기 때문이다.
 * ⛔ 새 스캐너를 만들 때 readFileSync('sc-ums-web.html') 로 시작하지 말 것.
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';

export function readAllSource(root='.'){
  const parts=[fs.readFileSync(path.join(root,'sc-ums-web.html'),'utf8')];
  for(const dir of ['css','js']){
    const d=path.join(root,dir);
    if(!fs.existsSync(d)) continue;
    for(const f of fs.readdirSync(d).sort()) parts.push(fs.readFileSync(path.join(d,f),'utf8'));
  }
  return parts.join('\n');
}
