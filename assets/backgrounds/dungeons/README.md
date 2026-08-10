# 던전 배경 그림

`dg1.webp` … `dg10.webp` 를 이 폴더에 넣으면 해당 던전에 자동으로 뜬다.
**코드 수정 불필요** — 파일이 없는 던전은 예전 타일 바닥으로 그려진다.

## 규격
| 항목 | 값 |
|---|---|
| 파일명 | `dg1.webp` ~ `dg10.webp` |
| 권장 크기 | **1024 × 1024** (정사각) |
| 비율 | 자유 — 어떤 비율이든 `cover`로 채운다(비율 유지, 넘치는 쪽만 잘림) |
| 형식 | WebP (품질 80 전후, 파일당 ~150KB 이하 권장) |
| 시점 | **탑다운(위에서 내려다본) 바닥** — 캐릭터가 그 위를 걷는 지면 |

PNG/JPG로 뽑았다면 이 폴더에 `.png`로 넣고 `npm run img` — 1024px · WebP q80으로 변환된다.

## 잘리는 범위 (중요)
그림은 월드 원점에 고정돼 화면 중앙에 놓인다. 업그레이드 패널을 접으면 가로로
더 좁게 보이므로, **정사각 기준 가운데 세로 띠(가로 약 55%)만 항상 보인다.**

```
┌───────────────────────┐  1024
│ 잘림 │  항상 보임  │ 잘림 │   바깥 22%씩은 접으면 사라진다
│ 22%  │    56%     │ 22% │   → 중요한 것은 가운데로
└───────────────────────┘
```

- 중요한 것(제단·균열·구조물)은 **가운데 세로 띠 안**에
- 정중앙 지름 30% 원에는 캐릭터·적·수비 반경 링이 겹친다 → **한가운데는 비워 둘 것**
- 가장자리 어둡게(비네트)는 **코드가 자동으로** 한다 → 그림은 균일한 밝기로 뽑을 것

---

## 공통 프롬프트 (기본틀)

`{}` 안만 던전별로 갈아 끼운다. 나머지는 건드리지 말 것 — 시점·구도·밝기 조건이
전부 위 「잘리는 범위」와 비네트 자동 처리에 맞춰져 있다.

```
Top-down orthographic view of a {SETTING}, seen straight from directly overhead,
camera pointing straight down at the ground. {MATERIAL} surface with {DETAIL}.
Composition: a wide open uncluttered clearing in the very center, all structures
and debris arranged in a ring toward the outer edges, nothing crossing the middle.
{PALETTE} palette, dark to mid values, evenly lit flat ambient light, no vignette,
no dark corners, no cast shadows, no light beams, no bright white hotspots.
Soft low-contrast surface texture, painterly stylized game art, mobile game
background plate, square 1:1 composition.
```

**네거티브 프롬프트 (공통)**

```
characters, creatures, monsters, people, units, vehicles, UI, HUD, icons, text,
letters, numbers, watermark, signature, logo, perspective, horizon, sky, walls,
isometric, tilted camera, angled view, vignette, dark corners, harsh shadows,
strong directional light, high contrast, busy center, centered focal object,
frame, border, blur, depth of field
```

### 왜 이 문구들이 들어갔나
| 문구 | 이유 |
|---|---|
| `straight from directly overhead` | 조금만 기울어도 유닛 스프라이트(정면 뷰)와 시점이 안 맞는다 |
| `open uncluttered clearing in the very center` | 한가운데는 캐릭터·적·링이 덮는다 |
| `ring toward the outer edges` | 그런데 바깥 22%는 접으면 잘린다 → 디테일은 그 사이 고리에 |
| `no vignette, no dark corners` | 코드가 비네트를 또 씌운다. 그림에도 있으면 두 겹이 돼 가장자리가 뭉갠다 |
| `dark to mid values` | 밝으면 유닛·데미지 숫자가 안 읽힌다 |
| `soft low-contrast texture` | 고주파 노이즈는 작은 스프라이트와 싸운다 |
| `no walls / no horizon` | 벽이 보이면 탑다운이 아니라 방 안 사진이 된다 |

---

## 던전별 슬롯
| 파일 | 던전 | `{SETTING}` | `{MATERIAL}` | `{DETAIL}` | `{PALETTE}` |
|---|---|---|---|---|---|
| dg1  | 감염된 둥지 | infested alien hive floor | organic creep membrane | pulsing veins, spore sacs, chitin ridges | sickly green and violet |
| dg2  | 버려진 전초기지 | abandoned military outpost yard | rusted metal deck plating | cracked panels, spilled crates, faded hazard stripes | cold steel blue and rust orange |
| dg3  | 잊혀진 회랑 | forgotten alien corridor floor | polished dark stone | inlaid glowing glyph lines, fine gold seams | deep indigo and cyan |
| dg4  | 산란장 | alien spawning ground | living fleshy tissue | egg clusters, sinew strands, wet sheen | bile yellow and dark green |
| dg5  | 폐쇄된 시설 | sealed underground facility floor | poured concrete and grating | drainage channels, emergency light strips, scuff marks | gunmetal grey and amber |
| dg6  | 봉인된 성소 | sealed alien sanctum floor | carved luminous marble | rune circles, floating stone shards, gold filigree | royal purple and warm gold |
| dg7  | 군단의 심장 | heart of the swarm chamber | raw muscle and bone plating | glowing magma fissures, pulsing arteries | blood red and ember orange |
| dg8  | 함대 정박지 | orbital fleet dock deck | riveted hull plating | landing markings, cable runs, hull seams | dark navy and white marking paint |
| dg9  | 공허의 문 | void gate platform | fractured obsidian slab | purple rift cracks, drifting weightless debris | violet and black with cyan sparks |
| dg10 | 심연 | abyssal depths floor | black rippling liquid | submerged eyes, tendrils, faint bioluminescence | near-black with pale teal glow |

### 예시 (dg1 완성본)
```
Top-down orthographic view of an infested alien hive floor, seen straight from
directly overhead, camera pointing straight down at the ground. Organic creep
membrane surface with pulsing veins, spore sacs, chitin ridges. Composition: a
wide open uncluttered clearing in the very center, all structures and debris
arranged in a ring toward the outer edges, nothing crossing the middle. Sickly
green and violet palette, dark to mid values, evenly lit flat ambient light, no
vignette, no dark corners, no cast shadows, no light beams, no bright white
hotspots. Soft low-contrast surface texture, painterly stylized game art, mobile
game background plate, square 1:1 composition.
```

## 넣은 뒤 확인
1. 파일을 이 폴더에 두고 앱에서 해당 던전 진입
2. 유닛이 안 읽히면 → 그림이 밝은 것. 다시 뽑거나 `HB_BG_VIG_A`(기본 0.62)를 올린다
3. 가운데가 복잡하면 → `{DETAIL}`을 줄이고 `ring toward the outer edges`를 강조
