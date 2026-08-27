/* 99-attic.js — 🗄 다락(휴지통)
 *
 * **지금 화면에서 도달할 수 없는 코드**를 여기로 모은다. 지우지 않는 이유는
 * `GAME_DIRECTION.md` §5 가 「유보는 삭제가 아니다 — 코드와 아트를 지우지 말 것」이라
 * 못박고 있어서다. 되살릴 때의 자산이다.
 *
 * ⭐ 왜 파일을 나눴나 — 살아 있는 코드와 죽은 코드가 한 파일에 섞여 있으면,
 *    다른 작업자가 그 파일을 열었을 때 **어느 쪽이 지금 쓰는 것인지 알 수 없다.**
 *    실제로 옛 화면·옛 디자인이 여러 번 되살아났다. 자리를 갈라 두면 그 혼동이 없다.
 *
 * ⚠ 이 파일은 **맨 마지막에 로드된다.** 아무도 여기 것을 부르지 않으므로 순서가 무의미하고,
 *    거꾸로 여기 것이 살아 있는 코드를 부르는 것은 런타임이라 문제가 없다.
 *    ⛔ 다른 `<script>` 태그의 순서는 건드리지 않았다(전역 하나를 공유하는 구조다).
 *
 * ⛔ 여기 있는 것을 **다시 부르지 말 것.** 되살리려면 `ATTIC.md` 를 먼저 읽고,
 *    그 항목이 왜 잠겼는지 확인한 뒤 원래 파일로 되돌린다. 스모크가 되살아남을 잡는다.
 *
 * 무엇이 왜 여기 있는지는 → `ATTIC.md`
 */

// ── [js/04-profile.js] profBuyItem
function profBuyItem(tierId){ const p=PROF(), T=profItemTier(tierId);
  if(!T.cost || p.pcoin<T.cost) return null;
  if(profItems().length>=PROF_INV_MAX) return null;
  const sl=profSlots(); if(!sl.length) return null;
  const it=profMakeItem(sl[Math.floor(Math.random()*sl.length)], Math.max(1, dgMaxFloor()), tierId);
  if(!profAddItem(it)) return null;
  p.pcoin-=T.cost; saveMeta(); return it; }

// ── [js/04-profile.js] profRebGrant
function profRebGrant(lv){ return profRebGrantAt(lv); }   // 옛 이름 호환(인자가 회차→레벨로 바뀌었다)

// ── [js/04-profile.js] profPetMats
function profPetMats(){ const p=PROF(), out=[];
  for(const id in (p.pets||{})){ if(!PROF_PETS[id]) continue; const d=p.pets[id].dup||0;
    if(d>0) out.push({id:id, dup:d, pt:profPetPt(id)}); }
  return out.sort((a,b)=>b.pt-a.pt); }

// ── [js/04-profile.js] profClaimOffline
function profClaimOffline(){ const p=PROF(), now=Date.now(), last=p.idle.lastClaimTs||p.lastSeenTs||now;
  const mins=Math.max(0, Math.min((now-last)/60000, profOfflineCapMin())), gained=Math.round(profIdleRate()*mins*profOfflineRate());
  p.idle.lastClaimTs=now; p.lastSeenTs=now; if(gained>0){ profGainCoin(gained); saveMeta(); } return gained; }

// ── [js/08-hunt.js] HB_DG_ATK
function HB_DG_ATK(dg){ return hbCurve(HB_ROUND_ATK, dg, 1); }   // 적 공격

// ── [js/08-hunt.js] HB_DG_XP
function HB_DG_XP (dg){ return hbCurve(HB_ROUND_XP , dg, 1); }   // 경험치

// ── [js/08-hunt.js] _mgK
function _mgK(){ return _gearTab==='pet' ? 'pet' : 'ally'; }

// ── [js/08-hunt.js] twApplyChar
function twApplyChar(){ const c=CHAR(), b=document.querySelector('#twAvatar .twAvBody');   // 아바타 겉모습 = 현재 캐릭터 종류
  if(b) b.textContent=(c && PROF_CLASSES[c.cls] && PROF_CLASSES[c.cls].ico) || '🧍'; }

// ── [js/08-hunt.js] profPickSlot
function profPickSlot(slot){ profSlotTap(slot); }        // 예전 이름 유지(외부 호출)

// ── [js/14-input-fx.js] btAdd
function btAdd(sid, gm, name){ if(typeof G==='undefined') return; G.btUnits=G.btUnits||[]; if(G.idSeq==null) G.idSeq=1;
  const n=G.btUnits.filter(u=>u.team!=='foe').length, c=n%4, r=(n/4)|0;   // 아군만 카운트 → 좌측 격자
  const u=initUnitStats({uid:G.idSeq++, id:sid, hero:false, lv:1, x:0.10+c*0.05, y:0.44+r*0.052, cd:0, fixed:false});
  if(gm){ u.gmodel=gm; _btModelStats(u, gm); } u.gname=name;
  if(u.maxEn>0) u.en=Math.min(50,u.maxEn);   // 🔮 마나: 마법 유닛 생산 직후 50(SC) → stepSkills가 자연 회복
  G.btUnits.push(u); if(G.tab==='Battle') G.units=G.btUnits;   // 전투실험 중이면 즉시 전장에 반영
  if(typeof toast==='function') toast(name+' 배치'); }

// ── [js/18-strike.js] strikeWpnTotal
function strikeWpnTotal(){ const S=STK; if(!S||!S.me||!S.me.wpn) return 0;
  return STK_WEAPONS.reduce((n,w)=>n+(S.me.wpn[w.k]||0),0); }

// ── [js/04-profile.js] profUnlockNeed
// 표시용 — 해금에 필요한 레벨(문구에 숫자를 손으로 박지 말 것)
function profUnlockNeed(id){ const u=PROF_UNLOCKS.find(x=>x.id===id); return u? u.lv : 0; }

// ── [js/05-home.js] hbGoRound
// 목록에서 고르기 = 이동 + 시트 닫기
function hbGoRound(n){ hbSetRound(n); renderRoundSheet(); hbCloseRounds(); }

// ── [js/06-daily.js] dqRwTx
function dqRwTx(rw){ if(!rw) return '';
  const t=[]; const ri=function(k,v){ return '<span class="dqRw">'+resIco(k,'dqRi')+fmtCur(v)+'</span>'; };
  if(rw.pcoin) t.push(ri('mineral',rw.pcoin));
  if(rw.gas)   t.push(ri('gas',rw.gas));
  if(rw.gem)   t.push(ri('gem',rw.gem));
  for(const k in DQ_TK) if(rw[k]) t.push('<span class="dqRw">'+resIco('ticket_'+k,'dqRi')+DQ_TK[k]+' ×'+rw[k]+'</span>');   // '뽑기권'은 🎟 이 말한다
  return t.join(''); }

// ── [js/08-hunt.js] hbRoundK
// 옛 이름 — 던전 1 기준. ⛔ 새 코드는 hbCurve 를 쓸 것(던전 기울기를 반영한다).
function hbRoundK(mul,round){ return Math.pow(mul, Math.max(0,(round||1)-1)); }

// ── [js/09-dungeon.js] dgStgHTML
// 단계 배지 — 12단계 / 미개척 / Lv.50 이 같은 자리에서 읽힌다
function dgStgHTML(d, mx){ return '<span class="dgStg">'+(d.reqLvLocked? ('Lv.'+d.reqLv) : (mx? mx+'단계' : '미개척'))+'</span>'; }

// ── [js/12-appshell.js] authIsGuest
// 게스트 → 정식 계정. uid 를 그대로 두고 이메일·비밀번호만 붙이므로 진행도가 따라온다.
function authIsGuest(){ return !!(AUTH.user && AUTH.user.guest); }

// ── [js/12-appshell.js] playerLeave
// 게임 중 플레이어 탈락 → 죽은 자리로(옛 이름 유지 — 호출부가 여럿)
function playerLeave(n){ killSlot(n, 'lost'); }

// ── [js/14-input-fx.js] _btPickerHTML
// ⚔ 아군 배치 피커(전투실험 탭) — 종족별 유닛 버튼. 누르면 전장 좌측 진형에 추가
function _btPickerHTML(addFn){ let html=''; if(typeof SANDBOX_ROSTER==='undefined') return html;
  SANDBOX_RACE_ORDER.forEach(function(race){ const arr=SANDBOX_ROSTER[race]||[]; if(!arr.length) return;
    html+='<div class="btpRaceHead">'+(SANDBOX_RACE_KO[race]||race)+'</div>';
    arr.forEach(function(it){ const disp=it.gm||it.b, sid=((it.gm&&typeof U[it.gm]!=='undefined')?it.gm:it.b);
      html+='<button class="btpCard" onclick="'+addFn+'(\''+sid+'\',\''+(it.gm||'')+'\',\''+it.n+'\')"><span class="btpPic">'+((typeof unitPortraitHTML==='function')?unitPortraitHTML(disp):'')+'</span><span class="btpNm">'+it.n+'</span></button>'; }); });
  return html; }
