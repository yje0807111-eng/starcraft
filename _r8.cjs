const fs=require('fs');
const rep=(F,a,b,t)=>{let s=fs.readFileSync(F,'utf8');
 if(s.split(a).length!==2){console.error('MISS '+t);process.exit(1);}
 fs.writeFileSync(F,s.replace(a,b));};
rep('scripts/tuto-run.mjs',
`console.log('\n총 단계 ' + (await page.evaluate(() => TUTO_STEPS.length)));`,
`// 🗺 구역 안내 — 튜토리얼이 **강제로 안 시키는 것**을 여기서 말한다. 한 장씩 떠서 닫히는지 본다.
{ const seen = [];
  for (let k = 0; k < 8; k++) {
    const r = await page.evaluate(() => {
      const S = (typeof guideState === 'function') ? guideState() : null; if (!S) return null;
      if (typeof zoneTipPaint === 'function') zoneTipPaint();
      const el = document.getElementById('zoneTip'); if (!el) return null;
      const tip = el.querySelector('.tuTip');
      const blocks = Array.from(el.querySelectorAll('i'))
        .some(i => getComputedStyle(i).pointerEvents !== 'none');
      return { id: el.dataset.zt, title: el.querySelector('.tuTx').textContent,
        sub: el.querySelector('.tuSub').textContent.split(String.fromCharCode(10)).join(' | '),
        card: tip.classList.contains('ch'), blocks: blocks }; });
    if (!r) break;
    if (process.env.SHOT && k === 0) { await new Promise(x => setTimeout(x, 300));
      await page.screenshot({ path: 'docs/mock/camp-zone-tip.png' });
      console.log('        shot docs/mock/camp-zone-tip.png'); }
    seen.push(r.id);
    console.log('  안내 [' + r.id + '] ' + r.title + (r.blocks ? ' ⛔막는다' : '')
      + (r.card ? '' : ' ⛔카드아님') + String.fromCharCode(10) + '        ' + r.sub);
    await page.evaluate(() => { const g = document.querySelector('#zoneTip .tuGo'); if (g) g.click(); });
    await new Promise(x => setTimeout(x, 200)); }
  console.log('구역 안내 ' + seen.length + '장: ' + (seen.join(' · ') || '없음')); }
console.log('\n총 단계 ' + (await page.evaluate(() => TUTO_STEPS.length)));`,'구역안내');
console.log('ok');
