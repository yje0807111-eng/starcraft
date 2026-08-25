# 종족 아이콘 (캠프 종족 선택 행)

`union.webp` · `swarm.webp` · `aetherial.webp` 를 넣으면 **코드 수정 없이** 뜬다.
없으면 `STK_RACES[k].icon`(이모지)로 되돌아간다 — 자리와 크기(30px)는 같다.

## 규격
`../README.md` 의 **공통 블록 C — 커런시/무판 계열**을 그대로 쓴다.
128 × 128 · WebP · **알파 있음** · 검정 배경에서 뽑아 `scripts/icon-cutout.mjs` 로 오려낸다.

```bash
node scripts/icon-cutout.mjs in.png assets/icons/races/union.webp
```

⚠ 판(plate) 계열(`buildings/` `skills/` `upgrades/`)이 **아니다.** 종족 아이콘은 판 없이
어두운 아트 위에 바로 얹히므로 커런시(`res_*`)와 같은 계열이다.

## SUBJECT (색은 `STK_RACES[k].col` 이 단일 소스)
| 종족 | 색 | 형태 |
|---|---|---|
| 유니온 `union` | `#4aa8ff` | 인간 군단의 장갑 방패판 — 모따기된 오각 슬래브 + 십자 보강대 + 중앙 리벳 보스 |
| 스웜 `swarm` | `#9fd356` | 군체의 갑각 발톱 — 위로 굽은 단일 갈고리, 마디진 껍질, 뼈흰색 끝 |
| 에테리얼 `aetherial` | `#ffc040` | 사이오닉 결정 파편 — 각진 면으로 깎인 보석, 안에서 발광, 허리에 석재 테 |

전문은 **`ART.md` §10-2** 가 단일 소스다.

## 지금 상태
2026-08-24 힉스필드(`recraft_v4_1` · utility · 검정 배경 · 1:1)로 3장 뽑았으나
**이 환경의 네트워크 허용 목록에 생성 CDN 이 없어 내려받지 못했다.**
