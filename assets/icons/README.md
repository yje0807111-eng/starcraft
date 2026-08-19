# 아이콘 프롬프트

`buildings/` `skills/` `upgrades/` `auto/` 와 루트 `res_*.webp` 를 만드는 규칙.
파일을 넣기만 하면 코드 수정 없이 뜬다 — 없는 자리는 라인 SVG로 대체된다(뒤의 「폴백」 참고).

## 규격
| 항목 | 값 |
|---|---|
| 크기 | **128 × 128** |
| 형식 | WebP · **알파 없음**(판이 배경을 채운다) · 한 장 2.5~3.3KB |
| 원본 | 512 × 512 PNG로 뽑아서 변환 |
| 배경판 | 어두운 금속판 + 리벳 — **참조 이미지로 고정**(아래) |

PNG를 이 폴더에 넣고 `npm run img` 로 변환하거나, 한 장이면:
```bash
node -e "require('sharp')('in.png').resize(128,128,{fit:'cover'}).flatten({background:'#000'}).webp({quality:82}).toFile('out.webp')"
```

---

# 두 계열 — 정면 / 사선

**공통 블록이 두 개다. 무엇을 그리느냐가 아니라 어떻게 놓느냐로 갈린다.**

| | 정면용 (A) | 사선용 (B) |
|---|---|---|
| 쓰는 곳 | `skills/` `buildings/` `auto/` `res_*` | **`upgrades/`** |
| 시점 | 정면 · 회전/기울임 없음 | 3/4 · 왼쪽 25° · 위에서 15° |
| 배치 | 똑바로 서서 중앙 | 좌하→우상 대각선 |
| 좌우대칭 | **허용**(오히려 기본) | 금지 |
| 대표 예 | `sk_lockdown` 자물쇠 · `bld_turret` 포탑 | `up_inf_atk` 소총 · `up_veh_atk` 포신 |

> **왜 갈렸나:** 업그레이드는 소총·포신처럼 **길쭉한 물체**라 정면으로 놓으면
> 정사각 판에서 형태가 안 산다. 대각선 3/4가 맞다.
> 반대로 스킬·건물은 **기호**라 정면 대칭이 32px에서 훨씬 잘 읽힌다.
>
> ⚠ 한동안 사선 블록(B) 하나만 쓰다가 스킬 아이콘이 사선으로 나온 적이 있다.
> **스킬을 만들 때 B를 쓰면 기존 27종과 시점이 어긋난다.**

---

## 공통 블록 A — 정면용 (고정 · 절대 수정 금지)

```
--- REFERENCE ---
Use the attached image as the exact background plate. Reproduce it unchanged — same
metal tone, same rim, same rivets, same panel seams, same corner shading, same framing.
Do not redesign, recolor, resize or re-texture the plate. Only add the symbol on top.
--- RENDER SPEC ---
A single StarCraft-style game ability icon. Hand-painted 90s RTS interface art.
One symbol only, centered, mounted on the reference plate.
SYMBOL: [[SUBJECT]]
MATERIAL: the symbol is machined from the same metal as the plate but a lighter, cleaner
alloy — brushed steel, base #8a939c, ranging #b8c2ca on top-lit faces to #3a4046 on
shadow sides. Slightly polished compared to the worn plate around it, with faint
horizontal brush streaks along its faces and a few small nicks on the edges. Same
hand-painted retro game art treatment as the plate, no color tint, no paint.
CONSTRUCTION: the symbol is a solid extruded shape standing proud of the plate — a flat
front face squarely facing the viewer, straight side walls showing its thickness, and a
chamfered edge where the front face meets the walls. The chamfer catches a bright
specular line along every upper and left edge. Think of a part milled from steel and
bolted on, not a painted marking.
SHAPE DISCIPLINE: keep the form clean and deliberate — every edge is a straight line or
a clean arc, every corner is crisp, and the whole shape looks machined rather than
hand-drawn. Where the symbol is built from bars, arms or strokes, those keep a constant
width along their length and end in flat square cuts. Where the symbol is a shaped form
such as a blade, spike or wedge, it may taper, but the taper must be even and controlled
and consistent between matching parts. Never let width wobble along a single edge, and
never let matching parts differ in thickness from each other.
COMPOSITION: the object is seen straight from the front, square to the viewer, with no
rotation and no tilt. It stands upright in the frame and its front face reads flat and
even. Symmetrical subjects stay symmetrical. Depth reads only from the extruded side
walls and the chamfer — a thin consistent edge along the lower and right sides — never
from turning the object. Centered, filling roughly 65% of the frame.
LIGHT: single hard key light from the upper left. Bright specular chamfer on upper and
left edges, mid-tone front face, deep shadow on the lower and right side walls. A hard
black cast shadow falls from the symbol onto the plate, offset down and to the right.
PLACEMENT: the symbol sits inside the recessed inner field. It must never overlap or
cover the raised rim, the corner rivets, or the double border line — those stay fully
visible.
READABILITY: bold and blocky enough to read clearly at 32 pixels. Few large forms, no
fine detail, no engraved patterns on the symbol itself. The subject must be instantly
recognizable — favor a clear, expressive silhouette over geometric neatness.
OUTPUT: 512x512 PNG, square, crisp edges, retro game UI art.
--- NEGATIVE ---
three-quarter view, rotated, turned to the side, tilted, angled perspective, isometric,
oblique projection, foreshortening, perspective distortion, diagonal placement,
pure side profile, flattened depth, no thickness,
varying line thickness, thick and thin lines, brush stroke, calligraphy, uneven width,
wobbly edges, hand-drawn lines, sketchy, inconsistent thickness between matching parts,
painted symbol, flat colored symbol, blue, colored tint, glossy plastic, sticker, decal,
engraved into the plate, flush with the surface, changed background, new background,
altered plate, different texture, redesigned plate, line art, outline only, unfilled,
flat vector, minimal icon, modern flat design, transparent background, white background,
soft gradient, airbrush, blur, glow, bloom, neon, photorealistic, 3D render, chrome,
mirror reflection, text, letters, numbers, watermark, logo, ornate frame, decorative
border, multiple symbols, scene, character, cute, rounded soft shapes, low contrast
```

## 공통 블록 B — 사선용 / 업그레이드 (고정 · 절대 수정 금지)

A와 **`CONSTRUCTION` · `COMPOSITION` · `LIGHT` · `NEGATIVE` 네 곳만** 다르다.
나머지(REFERENCE · MATERIAL · SHAPE DISCIPLINE · PLACEMENT · READABILITY · OUTPUT)는 A와 완전히 같다.

```
CONSTRUCTION: the symbol is a solid extruded shape standing proud of the plate — a flat
top face, straight side walls showing its thickness, and a chamfered edge where the top
face meets the walls. The chamfer catches a bright specular line along every upper-left
edge. Think of a part milled from steel and bolted on, not a painted marking.
COMPOSITION: the object is seen from a three-quarter view, turned about 25 degrees to
the left and tilted about 15 degrees down from above, so its front face and one side
face are both visible and its depth reads clearly. Never a flat straight-on front view,
never a pure profile. The object is angled diagonally across the frame from lower left
to upper right, centered, filling roughly 65% of the frame.
LIGHT: single hard key light from the upper left. Bright specular chamfer on upper-left
edges, mid-tone top faces, deep shadow on lower-right walls. A hard black cast shadow
falls from the symbol onto the plate, offset down and to the right.
```
네거티브는 A에서 시점 관련 부분만 갈아 끼운다:
```
flat front view, straight-on symmetry, pure side profile, orthographic elevation,
flattened depth, mirror symmetry,
```
(뒤의 `varying line thickness ~ low contrast` 는 A와 동일)

## 두 블록의 차이 — 왜 이 문구인가
| 문구 | 계열 | 이유 |
|---|---|---|
| `straight from the front, square to the viewer` | A | 기존 스킬·건물 27종이 전부 정면. 없으면 사선으로 나온다 |
| `Symmetrical subjects stay symmetrical` | A | `sk_stim`·`sk_stasis`·`sk_recharge`가 완전 좌우대칭 — B의 `mirror symmetry` 금지와 정면 충돌한다 |
| `Depth reads only from the side walls and the chamfer` | A | 정면이라고 두께까지 없애면 스티커가 된다. **`CONSTRUCTION`은 절대 빼지 말 것** |
| `angled diagonally from lower left to upper right` | B | 소총·포신처럼 긴 물체를 정사각에 넣는 유일한 방법 |
| `constant width ~ flat square cuts` | 공통 | 없으면 막대 굵기가 길이 방향으로 흔들린다 |
| `never let matching parts differ in thickness` | 공통 | 큐브 3개·핀 3개 같은 대응 부품이 제각각이 되는 것을 막는다 |
| `read clearly at 32 pixels` · `few large forms` | 공통 | 실제 표시 크기가 32~44px. 큰 덩어리 4개가 상한선 |

---

# SUBJECT 쓰는 법

`[[SUBJECT]]` 자리에 **형태만** 넣는다. 재질·조명·구도·판은 공통 블록이 이미 강제하니
다시 쓰면 오히려 서로 싸운다.

```
소문자로 시작 — 엠대시 뒤에 기하학적 구성 — 마지막에 짧은 명명 문장
```

**예시 (`sk_irradiate` 방사능)**
```
a bold biohazard-style symbol — three thick crescent hooks arranged around a small solid
circle at the center at even 120-degree intervals, each hook curving outward and back,
separated from the core by clean gaps. The universal contamination symbol
```

### 자주 하는 실수
| 실수 | 결과 | 대신 |
|---|---|---|
| `instead of legs` 같은 **부정 서술** | 오히려 다리를 그린다 | 있는 것만 긍정으로 서술 |
| `rising`, `materializing` | 광선·입자 이펙트가 붙는다 | `standing`, `mounted on` |
| 요소를 4개 넘게 나열 | 32px에서 뭉갠다 | 큰 덩어리 3~4개로 |
| 대응 부품 크기 미지정 | 3개가 제각각 | `exactly the same size and thickness` |
| 판·재질·조명 재서술 | 공통 블록과 충돌 | 형태만 |

### 만들기 전에 기존 것부터 확인
같은 뜻의 아이콘이 이미 있으면 **새로 만들지 말고 별칭으로 공유**한다.
`sk_bomb`(둥근 폭탄)을 `nuke`(핵 폭격)가 함께 쓰는 식 — `SKILL_ICO` 표에 한 줄:
```js
const SKILL_ICO={ nuke:'bomb' };
```
실루엣이 겹칠 만한 것도 미리 본다. 인물 계열이 특히 위험하다:

| | 인물 수 | 특징 |
|---|---|---|
| `sk_psi_cloak` | 1 | 후드(머리+어깨만) |
| `sk_hallucination` | 2 | 같은 크기, 뒤쪽이 얕은 부조로 어두움 |
| `auto_unit` | 1 | 전신 하나 |
| `auto_combine` | 3 | 크기 다름(작·큰·작), 겹쳐 융합 |
| `auto_place` | 3 | 크기 같음, 레일 위에 떨어져 나열 |

---

# 폴더 · 파일명 · 폴백

| 폴더 | 파일명 | 연결되는 곳 |
|---|---|---|
| `skills/` | `sk_<키>.webp` | `SKILLS` 키 (별칭은 `SKILL_ICO`) |
| `upgrades/` | `up_<키>.webp` | `UPG_ICO` — 연구 73종이 23장을 공유 |
| `buildings/` | `bld_<키>.webp` | `TECH_TREE` 건물 키 |
| `auto/` | `auto_<키>.webp` | `AUTO_SHEET_DEFS` — unit·combine·energy·bossdeploy·place·rally |
| `ui/` | `ui_<키>.webp` | **조작 버튼**(투명 배경 계열) — `UI_SVG` 표 · `uiIco(키)` |
| `upgrades/` | `up_mine.webp` | 오토배틀 **강화 > 광산** — `UPG_ICO` 를 안 거치고 `_icoImg('upgrades','up_mine')` 로 직접 부른다 |
| 루트 | `res_<키>.webp` | `resIco()` — 미네랄·가스·젬·인구 |

**폴백:** 파일이 없으면 `_icoFail()` 이 공용 라인 SVG(`pIco`)로 바꿔 넣는다.
빈칸이 생기지 않으므로 **아이콘을 나중에 넣어도 화면이 깨지지 않는다.**
넣는 순간 그 자리만 교체된다 — 코드 수정 불필요.

> 예전에는 `onerror="this.remove()"` 라서 파일이 없으면 **칸이 텅 비었다.**
> `sk_nuke`·`sk_hallucination`·`sk_recall` 세 자리가 그렇게 비어 있었다.

## 넣은 뒤 확인
1. 파일을 폴더에 두고 앱에서 해당 화면 진입
2. **시점이 옆칸과 다르면** → 블록을 잘못 골랐다(스킬에 B를 쓴 경우)
3. **32px에서 뭉개지면** → 덩어리가 많은 것. SUBJECT를 줄여 다시 뽑는다
4. **톤이 옆칸과 다르면** → 참조 판 이미지를 안 붙였거나 모델이 판을 다시 그린 것

---

# 오토배틀 하단 섹션 (2026-08-19)

칸마다 그림이 어디서 오는지. **뜻이 같으면 새로 만들지 않고 빌린다.**

| 칸 | 파일 | 상태 |
|---|---|---|
| 건설 > 본부·보급소·병영·훈련소 | `buildings/bld_*.webp` | 있음 |
| 강화 > 공격력 | `upgrades/up_melee_atk.webp` | **빌림**(사냥터 `HB_UPG.atk` 와 같은 파일) |
| 강화 > 체력 | `upgrades/up_carapace.webp` | **빌림**(사냥터 `HB_UPG.hp`) |
| 강화 > 광산 | `upgrades/up_mine.webp` | 있음(곡괭이 · 2026-08-19 추가) |
| 특수무기 > 폭탄 | `skills/sk_bomb.webp` | 빌림 |
| 특수무기 > EMP | `skills/sk_emp.webp` | 빌림 |
| 특수무기 > 궤도 포격 | `skills/sk_yamato.webp` | 빌림(조준환 = 지점을 지정해 때린다) |
| 특수무기 > 재생 필드 | `skills/sk_heal.webp` | 빌림 |

> 특수무기 4종은 **전부 기존 스킬 아이콘을 빌린다** — 새로 뽑지 않았다.
> 고른 근거: 폭탄=둥근 폭탄 그대로 · EMP=이름이 같은 파일 · 재생 필드=굵은 십자(회복) ·
> 궤도 포격=**조준환**(`sk_yamato`, 전함 주포 = 대구경 원거리 포격이라 뜻도 맞고 폭탄의 둥근 실루엣과 안 겹친다).
>
> **계열은 '무엇을 그리느냐'가 아니라 '옆칸이 무엇이냐'로 고른다.**

### SUBJECT — 광산 (블록 B · `upgrades/up_mine.webp`)
```
a heavy mining pickaxe — one straight handle bar of constant width running the full
length of the icon, and one crosswise head mounted across its upper end; the head is two
arms of exactly the same length and thickness sweeping out from the handle in a shallow
even arc, each arm ending in a blunt square-cut point. The mining mark
```

### ⚠ 시트를 매 프레임 다시 그리면 아이콘이 못 뜬다
오토배틀의 보급·관전 시트는 `strikeFrame` 이 **0.22초마다** `techPanelRender()` 를 부른다.
DOM 을 통째로 새로 만들면 그때마다 `<img>` 가 새로 생겨 **디코드가 끝나기 전에 사라진다** — 칸이 빈칸으로 보였다.
`_stkSheetSig()` 로 서명을 재고 같으면 그대로 둔다(전투 화면 호스트 `strikeRenderSelInfo` 와 같은 규약).
새 라이브 시트를 만들 때도 **반드시 서명 가드를 붙일 것**. 스모크가 '값이 그대로면 안 그림 / 값이 바뀌면 그림' 양쪽을 검사한다.

### PNG → WebP 변환(이 저장소 환경)
`sharp` 가 없어도 된다 — 크로미엄 캔버스로 변환한다. 512~1024 PNG → **128×128 · q0.82 · 알파 없음**:
```bash
node test/png2icon.mjs <입력.png> assets/icons/<폴더>/<이름>.webp
```

### 배선은 이미 끝나 있다
`_stkUpgModel` / `_stkWpnIco` 가 위 경로를 부른다 — **파일을 폴더에 넣기만 하면 그 자리가 교체된다.**
없는 동안은 `_icoFail` 이 이모지(⛏ · ☄)로 되돌리므로 칸이 비지 않는다.

> ⚠ **우상단 배지(`.cgMeta`)는 `z-index:2`** 여야 한다. 배지는 `.cgPro` 의 형제이고 초상 이미지(`.icoImg`)도
> `z-index:1` 이라, 같은 층이면 트리 순서가 늦은 초상이 이겨 **배지가 통째로 사라진다**(실제로 그랬다).
> 스모크가 배지 중심의 최상위 요소를 검사한다.

---

# 🎛 조작 버튼 아이콘 — 투명 배경 계열 (2026-08-19)

**판만 없을 뿐, 나머지는 능력 아이콘과 같은 물성이다.** 브러시드 스틸 · 왼쪽 위 하드 키라이트 ·
챔퍼 스펙큘러 · 90년대 RTS 손그림 — 전부 그대로 가져간다. 다르게 하는 것은 셋뿐이다:
**배경이 없고, 그림자를 안 깔고, 24px에서 읽히도록 더 굵고 단순하다.**

버튼(`.cgRally` 초록 · `.cgLift` 파랑 · `.cgSelAll` 하늘)이 이미 면·테두리·상태색을 갖고 있으므로
아이콘이 판을 또 가지면 **판 안에 판**이 된다.

| | 능력 아이콘 (A/B) | **조작 버튼 (C)** |
|---|---|---|
| 재질·조명 | 브러시드 스틸 · 좌상단 키라이트 · 챔퍼 | **같음** |
| 배경 | 금속판(참조 이미지) | **없음(알파)** |
| 그림자 | 판 위로 하드 캐스트 섀도 | **없음**(뒤에 면이 없다) |
| 표시 크기 | 32~44px | **24px** → 획 더 굵게, 덩어리 3개 이하 |
| 폴더 | `skills/` `buildings/` `upgrades/` `auto/` | **`ui/`** |
| 참조 이미지 | 붙인다 | **안 붙인다** |

## 만들 목록

| 키 | 뜻 | 지금 쓰는 곳 |
|---|---|---|
| `rally` | 생산한 유닛이 자동으로 갈 위치 | 건물 프로필 `.cgRally` |
| `lift` | 건물 띄우기 | `.cgLift`(부양 전) |
| `land` | 건물 내리기 | `.cgLift`(부양 중) |
| `selall` | 화면 안 같은 종류 전부 지정 | `.cgSelAll` |
| `back` | 한 종류 보기 → 여러 종류 전체로 복귀 | `.cgBack` |
| `untype` | 혼합 지정에서 그 종류만 빼기 | 카드 하단 `.cgTrash` |

## 공통 블록 C — 투명 배경 조작 아이콘 (고정 · 절대 수정 금지)

⚠ A/B와 달리 **`--- REFERENCE ---` 블록을 붙이지 않는다**(참조할 판이 없다).

```
--- RENDER SPEC ---
A single StarCraft-style game UI control glyph. Hand-painted 90s RTS interface art.
One symbol only, centered, standing on a fully transparent background — no plate, no tile,
no frame behind it.
SYMBOL: [[SUBJECT]]
MATERIAL: the symbol is machined from brushed steel, base #8a939c, ranging #b8c2ca on
top-lit faces to #3a4046 on shadow sides, with faint horizontal brush streaks along its
faces and a few small nicks on the edges. Same hand-painted retro game art treatment as
the ability icons, no color tint, no paint.
CONSTRUCTION: the symbol is a solid extruded shape — a flat front face squarely facing the
viewer, straight side walls showing its thickness, and a chamfered edge where the front
face meets the walls. The chamfer catches a bright specular line along every upper and
left edge. Think of a part milled from steel, floating free with nothing behind it.
SHAPE DISCIPLINE: every edge is a straight line or a clean arc, every corner is crisp, and
the whole shape looks machined rather than hand-drawn. Bars, arms and strokes keep a
constant width along their length and end in flat square cuts. Matching parts are exactly
the same size and thickness as each other.
WEIGHT: this glyph is shown at 24 pixels on a phone, smaller than the ability icons. Bars
are thick — at least 10% of the icon width — gaps between parts are at least as wide as
the bars, and there are three large forms at most. The silhouette alone must say what it
does.
COMPOSITION: seen straight from the front, square to the viewer, with no rotation and no
tilt. Symmetrical subjects stay symmetrical. Depth reads only from the extruded side walls
and the chamfer. Centered, filling roughly 78% of the frame, with clear empty margin on
all four sides.
LIGHT: single hard key light from the upper left. Bright specular chamfer on upper and
left edges, mid-tone front face, deep shadow on the lower and right side walls. No cast
shadow — there is no surface behind the symbol.
OUTPUT: 512x512 PNG with a real transparent alpha channel, crisp edges, retro game UI art.
--- NEGATIVE ---
background, backdrop, plate, tile, frame, border, circle badge, rounded square container,
rivets, panel seams, cast shadow, drop shadow, ground shadow, floor,
three-quarter view, rotated, turned to the side, tilted, angled perspective, isometric,
oblique projection, foreshortening, perspective distortion, diagonal placement,
pure side profile, flattened depth, no thickness,
varying line thickness, thick and thin lines, brush stroke, calligraphy, uneven width,
wobbly edges, hand-drawn lines, sketchy, inconsistent thickness between matching parts,
painted symbol, flat colored symbol, blue, green, colored tint, glossy plastic, sticker,
decal, line art, outline only, unfilled, flat vector, minimal icon, modern flat design,
white background, soft gradient, airbrush, blur, glow, bloom, neon, photorealistic,
3D render, chrome, mirror reflection, text, letters, numbers, watermark, logo, ornate
frame, decorative border, multiple symbols, scene, character, cute, rounded soft shapes,
low contrast, fine detail, tiny parts
```

> ⚠ **색은 버튼이 낸다.** 아이콘은 능력 아이콘과 같은 무채색 스틸이고, 상태(`.on`)는 버튼 면이
> 밝아지며 표현한다. 아이콘에 초록·파랑을 칠하면 상태 표시가 두 벌이 되어 어긋난다.

## SUBJECT

### `ui_rally` — 랠리 포인트
```
a rally flag — one straight vertical pole of constant width, a solid triangular pennant
mounted on the upper half of the pole and pointing right, and one wide flat bar across the
bottom of the pole as its base. The gathering point mark
```

### `ui_lift` — 건물 띄우기
```
a lift-off arrow — one thick vertical bar rising to a solid triangular arrowhead that
points straight up, and beneath it one wide flat bar across the bottom of the icon,
separated from the arrow by one clean straight gap. The take-off mark
```

### `ui_land` — 건물 내리기
```
a landing arrow — one thick vertical bar dropping to a solid triangular arrowhead that
points straight down, and beneath it one wide flat bar across the bottom of the icon,
separated from the arrowhead by one clean straight gap. The touch-down mark
```

### `ui_selall` — 전체 지정
```
a selection marquee — four short right-angle corner brackets of exactly the same size and
thickness placed at the four corners of a square, and four solid square studs of exactly
the same size evenly spaced in a two by two grid inside them. The select-all-of-this-kind
mark
```

### `ui_back` — 전체로 돌아가기
```
a u-turn arrow — one horizontal bar running left and ending in a solid triangular
arrowhead that points left, joined at its right end by a quarter-circle elbow of the same
width that turns down into one shorter vertical bar. The return-to-all mark
```

### `ui_untype` — 그 종류만 빼기
```
a trash bin — one wide flat lid bar across the top with a short rectangular handle block
centered above it, and beneath the lid a bin body that tapers slightly toward the bottom
with two vertical slots of exactly the same width cut into its front face. The
remove-this-kind mark
```

> ⚠ `lift` 와 `land` 는 **한 쌍**이다. 바닥 바는 같은 두께·같은 위치로 두고 화살표 방향만 뒤집는다 —
> 두 아이콘이 같은 자리에서 교대로 뜨므로(부양 전/후) 바닥이 어긋나면 버튼이 흔들려 보인다.

## 배선은 이미 끝나 있다
`uiIco(키)` 가 위 경로를 부른다 — **파일을 `assets/icons/ui/` 에 넣기만 하면 그 자리가 교체된다.**
없는 동안은 `_uiFail` 이 **원래 인라인 SVG**(`UI_SVG` 표)로 되돌리므로 버튼이 비지 않는다.
변환은 **`--alpha`** 를 붙인다(안 붙이면 검정으로 눌려 판처럼 보인다):
```bash
node test/png2icon.mjs <입력.png> assets/icons/ui/ui_<키>.webp 0.82 --alpha
```
