# 던전 배경 그림

`dg1.webp` … `dg10.webp` 를 이 폴더에 넣으면 해당 던전에 자동으로 뜬다.
**코드 수정 불필요** — 파일이 없는 던전은 예전 타일 바닥으로 그려진다.

## 규격
| 항목 | 값 |
|---|---|
| 파일명 | `dg1.webp` ~ `dg10.webp` |
| 권장 크기 | **1024 × 1024** (정사각) |
| 비율 | **1:1** — 다른 비율도 `cover`로 채우지만 손실이 가장 적다 |
| 형식 | WebP (품질 80 전후, 파일당 ~150KB 이하 권장) |
| **시점** | **지면에서 37° 부감(사선)** — 아래 「카메라 각도」 참고. 완전 탑다운 아님 |

PNG/JPG로 뽑았다면 이 폴더에 `.png`로 넣고 `npm run img` — 1024px · WebP q80으로 변환된다.

## 카메라 각도 (가장 중요)
유즈맵 3D가 쓰는 각도와 **같아야** 유닛이 바닥에 붙어 보인다. 코드 값은
`VIEW_TILT = 0.65 rad` (`sc-ums-web.html`), 유닛 스프라이트 시트(`SPRITE_TILT`)도 같은 값으로 구워져 있다.

| 값 | 의미 |
|---|---|
| **37.2°** | 지면에서 위로 올려다본 카메라 높이(수직에서 52.8°) — 정통 아이소메트릭 35.3°와 거의 같다 |
| **sin = 0.605** | 지면 깊이 압축 — **바닥의 원은 세로 61% 납작한 타원**으로 보인다 |
| cos = 0.796 | 서 있는 것의 키 압축 |

- 완전 탑다운(90°)으로 뽑으면 유닛만 사선이라 **바닥에서 떠 보인다**
- 옆에서 본 각도(0°)로 뽑으면 지평선·하늘이 생겨서 아예 안 맞는다
- 화면을 지면이 가득 채운다 → **지평선·하늘 없음**. 벽이 화면을 막아도 안 된다

## 잘리는 범위
그림은 월드 원점에 고정돼 화면 중앙에 놓인다. 업그레이드 패널을 접으면 가로로
더 좁게 보이므로, **정사각 기준 가운데 세로 띠(가로 약 56%)만 항상 보인다.**

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

`{}` 안만 던전별로 갈아 끼운다. 나머지는 건드리지 말 것 — 각도·구도·밝기 조건이
전부 위 「카메라 각도」·「잘리는 범위」와 비네트 자동 처리에 맞춰져 있다.

```
Three-quarter overhead view of a {SETTING}, camera about 37 degrees above the
ground plane — a shallow angled look-down like a classic isometric RTS, not a
flat top-down. The ground plane fills the entire frame: no horizon, no sky, no
distant background. Strong vertical foreshortening, the ground compressed to
about 60% in depth, so circular shapes on the floor read as wide flat ellipses.
{MATERIAL} surface with {DETAIL}. Any upright structure shows a little of its
front face and all of them lean the same direction, with short shadows from one
consistent light. Composition: a wide open uncluttered clearing in the very
center, all structures and debris arranged in a ring toward the outer edges,
nothing crossing the middle. {PALETTE} palette, dark to mid values, even ambient
light, no vignette, no dark corners, no light beams, no bright white hotspots.
Soft low-contrast surface texture, painterly stylized game art, mobile game
background plate, square 1:1 composition.
```

**네거티브 프롬프트 (공통)**

```
characters, creatures, monsters, people, units, vehicles, UI, HUD, icons, text,
letters, numbers, watermark, signature, logo, flat top-down view, straight
overhead, birds eye map, floor plan, flat lay, side view, eye level, horizon,
sky, distant background, walls closing the frame, vignette, dark corners, harsh
shadows, long shadows, strong directional light, high contrast, busy center,
centered focal object, frame, border, blur, depth of field
```

### 왜 이 문구들이 들어갔나
| 문구 | 이유 |
|---|---|
| `about 37 degrees above the ground plane` | 유즈맵 `VIEW_TILT=0.65rad`과 같은 각. 안 맞으면 유닛이 바닥에서 뜬다 |
| `like a classic isometric RTS, not a flat top-down` | 숫자만으로는 잘 안 먹혀서 익숙한 레퍼런스를 같이 준다 |
| `compressed to about 60% in depth` · `wide flat ellipses` | 부감의 실제 결과(sin 0.605). 이게 없으면 원을 정원으로 그려 버린다 |
| `no horizon, no sky` | 사선인데 지평선까지 생기면 화면 밖 공간이 보여 버린다 |
| `open uncluttered clearing in the very center` | 한가운데는 캐릭터·적·링이 덮는다 |
| `ring toward the outer edges` | 그런데 바깥 22%는 접으면 잘린다 → 디테일은 그 사이 고리에 |
| `short shadows from one consistent light` | 사선 뷰의 입체감은 그림자가 만든다. 단 길면 유닛 스프라이트와 싸운다 |
| `no vignette, no dark corners` | 코드가 비네트를 또 씌운다. 두 겹이면 가장자리가 뭉갠다 |
| `dark to mid values` | 밝으면 유닛·데미지 숫자가 안 읽힌다 |
| `soft low-contrast texture` | 고주파 노이즈는 작은 스프라이트와 싸운다 |

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

---

## 완성 프롬프트

그대로 붙여 넣어 쓰면 되는 완성본. **네거티브 프롬프트는 위 공통 것을 같이 넣을 것.**
비율 `1:1`, 크기 1024×1024. (dg4~dg10은 위 슬롯 표를 기본틀에 끼워서 같은 방식으로)

### dg1 — 감염된 둥지 (저그계 · 첫 던전)
> 첫 화면이라 **가장 읽기 쉬워야 한다.** 디테일을 욕심내지 말고 바닥 질감 위주로.

```
Three-quarter overhead view of an infested alien hive floor, camera about 37
degrees above the ground plane — a shallow angled look-down like a classic
isometric RTS, not a flat top-down. The ground plane fills the entire frame: no
horizon, no sky, no distant background. Strong vertical foreshortening, the
ground compressed to about 60% in depth, so circular shapes on the floor read as
wide flat ellipses. Organic creep membrane surface with pulsing veins, dormant
spore sacs, and low chitin ridges. Any upright growth shows a little of its front
face and all of them lean the same direction, with short shadows from one
consistent light. Composition: a wide open uncluttered clearing of bare creep in
the very center, all growths and debris arranged in a ring toward the outer
edges, nothing crossing the middle. Sickly green and dull violet palette, dark to
mid values, even ambient light, no vignette, no dark corners, no light beams, no
bright white hotspots. Soft low-contrast surface texture, painterly stylized game
art, mobile game background plate, square 1:1 composition.
```

### dg2 — 버려진 전초기지 (인간계)
> 직선 패널이라 **격자가 너무 규칙적이면 타일처럼 보인다.** 녹·얼룩으로 불규칙하게.
> 부감이라 패널 이음새는 **가로로 넓게 눌린 마름모**로 나와야 정상.

```
Three-quarter overhead view of an abandoned military outpost yard, camera about
37 degrees above the ground plane — a shallow angled look-down like a classic
isometric RTS, not a flat top-down. The ground plane fills the entire frame: no
horizon, no sky, no distant background. Strong vertical foreshortening, the
ground compressed to about 60% in depth, so panel seams and painted circles read
as wide flattened shapes. Rusted metal deck plating surface with cracked panels,
irregular rust stains, spilled supply crates, and faded yellow hazard stripes.
The crates show a little of their front faces and all lean the same direction,
with short shadows from one consistent light. Composition: a wide open
uncluttered clearing of bare deck in the very center, all crates and wreckage
arranged in a ring toward the outer edges, nothing crossing the middle. Cold
steel blue and rust orange palette, dark to mid values, even ambient light, no
vignette, no dark corners, no light beams, no bright white hotspots. Soft
low-contrast surface texture, painterly stylized game art, mobile game background
plate, square 1:1 composition.
```

### dg3 — 잊혀진 회랑 (초월계)
> 발광 문양이 밝게 나오기 쉽다. `faintly`·`dim`으로 눌러 놓았다.
> 부러진 기둥은 **밑동만** — 높으면 부감에서 바닥을 다 가린다.

```
Three-quarter overhead view of a forgotten alien corridor floor, camera about 37
degrees above the ground plane — a shallow angled look-down like a classic
isometric RTS, not a flat top-down. The ground plane fills the entire frame: no
horizon, no sky, no distant background. Strong vertical foreshortening, the
ground compressed to about 60% in depth, so the inlaid rune circles read as wide
flat ellipses. Polished dark stone surface with inlaid faintly glowing glyph
lines, fine gold seams, and worn hairline cracks. Low broken pillar stumps show a
little of their front faces and all lean the same direction, with short shadows
from one consistent light. Composition: a wide open uncluttered clearing of plain
stone in the very center, all glyph patterns and pillar stumps arranged in a ring
toward the outer edges, nothing crossing the middle. Deep indigo and dim cyan
palette, dark to mid values, even ambient light, no vignette, no dark corners, no
light beams, no bright white hotspots. Soft low-contrast surface texture,
painterly stylized game art, mobile game background plate, square 1:1
composition.
```

## 넣은 뒤 확인
1. 파일을 이 폴더에 두고 앱에서 해당 던전 진입
2. **유닛이 바닥에서 떠 보이면** → 그림이 너무 탑다운. 각도 문구를 강조해 다시 뽑는다
3. 유닛이 안 읽히면 → 그림이 밝은 것. 다시 뽑거나 `HB_BG_VIG_A`(기본 0.62)를 올린다
4. 가운데가 복잡하면 → `{DETAIL}`을 줄이고 `ring toward the outer edges`를 강조
