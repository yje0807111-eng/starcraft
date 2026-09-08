const fs=require('fs');
const rep=(F,a,b,t,all)=>{let s=fs.readFileSync(F,'utf8');
 const n=s.split(a).length-1;
 if(n!==(all||1)){console.error('MISS '+t+' ('+n+')');process.exit(1);}
 fs.writeFileSync(F, all?s.split(a).join(b):s.replace(a,b));};
const F='test/smoke.js';

/* 첫 두 단계 검사 — 챕터 카드가 맨 앞에 끼었다 */
rep(F,
`      assert(TUTO_STEPS[0].goal===1,'첫 단계가 1번이 아니다: '+TUTO_STEPS[0].goal);
      assert(TUTO_STEPS[1].goal===10,'두 번째 단계가 10번이 아니다: '+TUTO_STEPS[1].goal);`,
`      // 📚 맨 앞은 **챕터 1 카드**다(읽고 넘긴다) — 시키는 일은 그다음 칸부터다.
      //   ⚠ 이 검사는 「단계마다 제 진행도를 갖는다」를 재는 것이라, 카드를 건너뛰고 잰다.
      const _i0=TUTO_STEPS.findIndex(s=>s.id==='mineOn'), _i1=TUTO_STEPS.findIndex(s=>s.id==='tap');
      assert(TUTO_STEPS[0].ch===1,'맨 앞이 챕터 1 카드가 아니다: '+TUTO_STEPS[0].id);
      assert(TUTO_STEPS[_i0].goal===1,'첫 단계가 1번이 아니다: '+TUTO_STEPS[_i0].goal);
      assert(TUTO_STEPS[_i1].goal===10,'두 번째 단계가 10번이 아니다: '+TUTO_STEPS[_i1].goal);`,'첫두');

/* 화면 검사도 카드가 아니라 mineOn 에서 재야 한다 */
rep(F,
`      window.campIsOn=()=>true; TUTO_OFF=false; S.t=0; S.base=null; delete S.skip; S.trun=1;`,
`      window.campIsOn=()=>true; TUTO_OFF=false;
      // ⚠ 챕터 카드(0번)가 아니라 **첫 지시 단계**에서 잰다 — 카드는 대상이 없다.
      S.t=TUTO_STEPS.findIndex(s=>s.id==='mineOn'); S.base=null; delete S.skip; S.trun=1;`,'시작칸');

rep(F,
`      assert(/^1 \/ \d+$/.test(ov.querySelector('.tuStep').textContent),'왼쪽이 단계 표시가 아니다: '+ov.querySelector('.tuStep').textContent);`,
`      { const _hd=ov.querySelector('.tuStep').textContent;
        assert(_hd.indexOf('챕터 1')===0 && /1 \/ \d+$/.test(_hd),
          '왼쪽이 「챕터 N · a / b」가 아니다: '+_hd); }`,'머리줄검사');

rep(F,
`      // ⑤ 다음 단계는 goal 이 10 이다(광맥 두드리기) — 단계마다 제 진행도를 갖는다
      assert(TUTO_STEPS[1].goal===10,'두 번째 단계가 10번이 아니다: '+TUTO_STEPS[1].goal);`,
`      // ⑤ 다음 단계는 goal 이 10 이다(광맥 두드리기) — 단계마다 제 진행도를 갖는다
      assert(TUTO_STEPS[_i1].goal===10,'두 번째 단계가 10번이 아니다: '+TUTO_STEPS[_i1].goal);`,'다음단계');

/* 전체 수 검사 — 챕터 카드는 안 센다 */
rep(F,
`        assert(_tutoTotal()===ids.length-2,'보이는 단계 수가 안 맞는다: '+_tutoTotal()+' (전체 '+ids.length+')');`,
`        // ⚠ 챕터 카드 셋도 세지 않는다(시키는 일이 아니라 표지다)
        assert(_tutoTotal()===ids.length-2-TUTO_CH.length,
          '보이는 단계 수가 안 맞는다: '+_tutoTotal()+' (전체 '+ids.length+' · 카드 '+TUTO_CH.length+')');`,'총수');
console.log('ok');
