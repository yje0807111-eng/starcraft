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
| 루트 | `av_guest.webp` | **자리표시 초상** — `avatarHTML(nick,cls,st,guest)` 가 게스트·닉 없음일 때 이니셜 위에 덮는다 |
| 루트 | `res_ticket_<종류>.webp` | 🎟 뽑기권 3종(gear·pet·ally) — `RES_ICON` 에 등록돼 `resIco('ticket_pet')` 로 나온다 |
| `state/` | `st_<키>.webp` | 상태 표시(잠김·환생) — `stIco(키, 폴백이모지)` · 잠김은 단일 소스 `hmLockHTML()` |

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

### ⚠ 체커보드가 '그림'으로 구워져 온 PNG
생성기·업로드 경로를 거치면 투명이 날아가고 **회색 격자무늬가 실제 픽셀로** 박혀 오는 경우가 있다
(`file` 이 `8-bit/color RGB` 로 보이면 알파가 없는 것이다 — `RGBA` 여야 진짜 투명이다).
이때 `--alpha` 만 붙여도 격자가 그대로 남는다. **`test/dechecker.mjs`** 로 지운다 (`node test/dechecker.mjs <입력.png> <출력.webp> [미리보기.png]`):

1. **밝고 중성인 색**(`min(r,g,b) ≥ 238` 이고 `max-min ≤ 8`)만 배경 후보로 본다.
2. 후보를 **가장자리에서 플러드필**한다 — 안쪽 모따기 하이라이트(순백에 가까운 얇은 선)는 바깥과
   이어져 있지 않으므로 살아남는다. *임계값만으로 통째로 지우면 하이라이트가 같이 날아간다.*
3. 안쪽에 **갇힌 덩어리**(휴지통 슬릿 같은 진짜 구멍)는 **면적이 그림의 1% 이상**인 것만 뚫는다.
   하이라이트 조각은 0.15% 미만이라 이 선에서 깨끗이 갈린다. (밝기 비율로 거르면 두 슬릿이
   0.50/0.47 로 갈려 **한쪽만 뚫리는** 일이 생긴다 — 면적으로만 판단할 것.)
4. 확인은 **자홍색(#f0f) 위에 합성**해서 본다. 샌 곳이 바로 보인다.

넣은 뒤에는 `npm test` 의 **「메인 프로필: 판 밖 조작 버튼이 잘리지 않는다 · UI 아이콘 6종 로드」**
가 파일이 실제로 열리는지(`naturalWidth>0`)까지 확인한다.

---

# 공통 블록 C — 커런시/무판 계열 (`res_*` · `av_guest`)

판 위에 얹는 A·B와 **다른 계열**이다. 판이 없고 배경을 오려낸다 —
기존 `res_*` 4장은 128×128 · 알파 있음 · 투명 픽셀 40%대다.
(예전 표에서 `res_*` 를 A 계열로 적어 뒀던 것은 잘못이다.)

```
--- RENDER SPEC ---
A single mobile game HUD currency icon. One object only, centered and filling roughly
85% of the frame, near-front view tilted 10 degrees from above. Even margin on all four sides.
SUBJECT: [[SUBJECT]]
COMPOSITION: square to the viewer with zero left-right rotation — the front face points
straight at the camera and both sides are equally visible. The only tilt is the 10 degrees
from above; there is no yaw and no turning. Symmetrical subjects stay perfectly symmetrical
left to right.
FORM: hard-surface and angular. Corners are CHAMFERED — cut off at 45 degrees rather
than rounded. Bold readable silhouette at 24 pixels. Few large shapes, no clutter.
TREATMENT: bright, vivid and high-contrast — the icon must pop against a black
background. Rich saturated color across the body is expected. Add crisp bright edge
highlights along facet and rim edges, and a soft glow hugging the outline so the
shape stays legible when small.
SHADING: clean stylized shading with three clear value steps plus edge highlights.
No muddy midtones, no ambient occlusion, no texture noise, no photoreal material.
Translucent materials may show light passing through the interior.
LIGHT: single key light upper-left. Bright rim light along upper-right chamfers.
Emissive areas glow outward with a tight falloff, no wide hazy bloom.
BACKGROUND: flat solid pure black #000000 filling the entire frame, completely empty.
No gradient, no vignette, no stars, no ground plane, no cast shadow, no pedestal,
no frame, no border.
OUTPUT: 512x512 PNG, crisp vector-like edges, no outline stroke.
--- NEGATIVE ---
three-quarter view, rotated, yaw, turned to the side, angled perspective, isometric,
oblique projection, foreshortening, perspective distortion, pure side profile,
white background, light background, grey background, gradient background, transparent
checkerboard, vignette, stars, photorealistic, soft shadows, drop shadow, ground shadow,
floor, pedestal, text, letters, numbers, watermark, logo, frame, border, multiple
objects, scene, character, cute, rounded corners, soft rounded shapes, glossy plastic,
chrome, lens flare, wide bloom, bokeh, grain, thick outline, dark desaturated body,
low contrast, muddy colors, small object, tiny subject, empty space
```

## 왜 이 세 줄이 붙었나 (전부 실패해서 배운 것)
| 문구 | 없으면 |
|---|---|
| `filling roughly 85% of the frame` + NEGATIVE 의 `small object, tiny subject` | 프레임의 45%만 차서 기존 4장 옆에서 혼자 작다 |
| `COMPOSITION: … zero left-right rotation …` + 시점 네거티브 | **사선으로 돌아간다**. A 블록의 `straight from the front, square to the viewer` 와 같은 이유 — 원 스펙은 위아래 기울기만 말하고 yaw 를 안 막았다 |
| SUBJECT 에 **채도 있는 색을 명시** | `gunmetal steel` 처럼 무채색을 쓰면 `Rich saturated color` 와 싸워 회색으로 나온다 |

---

# 자리표시 초상 `av_guest.webp` — 계열이 또 다르다

친구 목록의 **22px 원형 초상**(`.fAva`) 자리다. 옆에 색 이니셜 원(`단`·`연`·`옛`)이 늘어서므로
HUD 계열(각진 챔퍼 · 채도 · 발광)로 만들면 혼자 튀고 22px 에서 챔퍼가 뭉갠다.
**원형 · 평면 2톤 · 저채도** 세 가지가 반대다.

| | 커런시(C) | 자리표시 초상 |
|---|---|---|
| 형태 | 각진 챔퍼 | **원형 디스크**(`.fAva` 가 `border-radius:50%`) |
| 마감 | 3단 셰이딩 + 엣지 하이라이트 + 발광 | **완전 평면 2톤** |
| 채도 | 높게 | **낮게** — '아직 아무도 아니다' |
| 크기 기준 | 24px | **18px**(파티 슬롯 `.ptAva`) |
| 프레임 | 85% | **가장자리까지 100%** — 디스크가 곧 아바타 원 |

```
--- RENDER SPEC ---
A flat vector avatar placeholder for a dark mobile game friend list. One circular badge
that fills the entire square frame edge to edge, dead centered, seen perfectly straight on
with no perspective and no tilt.
SUBJECT: a simple anonymous person mark centered inside the disc — one circle for the head
and one wide shoulder arc beneath it, drawn as two solid filled shapes with a clean gap
between them. No neck, no arms, no facial features, no hair, no outline around the figure.
COMPOSITION: the disc is the artwork. Its edge touches all four sides of the frame. The
person mark sits centered and occupies about 55% of the disc width, so a clear even ring of
empty disc surrounds it on every side. Left and right halves mirror each other exactly.
COLOR: muted and desaturated on purpose — this marks an empty, unassigned slot and must sit
quieter than the colorful avatars beside it. Disc is a dark cool slate grey, roughly #2b323b.
The person mark is a soft mid grey, roughly #77828f. Two flat tones only.
TREATMENT: completely flat vector fills. No gradient, no shading, no highlight, no bevel,
no chamfer, no glow, no rim light, no depth, no thickness, no texture. The figure reads as a
silhouette cut out of the disc, like a modern app placeholder avatar.
READABILITY: the whole badge must stay clear at 18 pixels. Only two shapes plus the disc.
Generous spacing, thick solid forms, no thin strokes, no fine detail.
BACKGROUND: flat solid pure black #000000 in the four corners outside the disc, completely
empty.
OUTPUT: 512x512 PNG, crisp clean edges, flat vector illustration.
--- NEGATIVE ---
chamfer, bevel, faceted, angular, hard surface, 3D render, extruded, metal, brass, steel,
glow, emissive, rim light, specular, bloom, glossy, shiny, gradient, shading, ambient
occlusion, drop shadow, cast shadow, texture, noise, saturated color, vivid, bright,
high contrast body, neon, HUD icon, game currency icon, crystal, gem,
facial features, eyes, mouth, nose, hair, helmet, visor, armor, character portrait,
photorealistic, realistic, detailed, ornate, decorative, frame, border, ring outline,
text, letters, numbers, watermark, logo, multiple figures, scene, cute, mascot,
square badge, rounded square, transparent checkerboard, white background, grey background
```

**변환 — 검정 키잉이 아니라 원형 마스크다.** 디스크가 프레임을 꽉 채우게 그렸으므로 잘라내면 끝이다(결정적):
```bash
node -e "const sharp=require('sharp');const S=128;
const m=Buffer.from('<svg width=\"'+S+'\" height=\"'+S+'\"><circle cx=\"64\" cy=\"64\" r=\"64\" fill=\"#fff\"/></svg>');
sharp('guest512.png').resize(S,S,{fit:'cover'}).composite([{input:m,blend:'dest-in'}])
  .webp({quality:88}).toFile('assets/icons/av_guest.webp')"
```

**배선** — `avatarHTML(nick, cls, st, guest)` 의 4번째 인자. 게스트이거나 닉이 비면 이니셜 **위에** `<img class="fAvaImg">` 를 덮는다.
- ⚠ **색은 인라인으로 나간다.** `.fAva.guest{border-color:…}` 를 CSS 로 써 봐야 인라인에 진다 — 실제로 남색 링이 남았다. 자리표시일 때는 `avatarHTML` 이 중성색을 직접 쓴다.
- ⚠ 파일이 없으면 `onerror="this.remove()"` 가 `<img>` 만 지우고 **밑에 깔린 이니셜이 드러난다** — 칸이 비지 않는다.
- 지금 켜지는 곳은 설정 프로필 머리줄(`setPaintMe`, 정식 계정이 아닐 때) 하나다. 친구·파티는 닉이 있으므로 색 이니셜 그대로다.

## 검정 배경 → 알파 (블록 C 전용 변환)

```bash
node scripts/icon-cutout.mjs <입력.png> <출력.webp> [knee=32]
```

`npm run img`(판 아이콘용)와 **다른 길이다.** 판 아이콘은 배경이 판이라 그대로 눌러 담지만,
블록 C 는 검정을 알파로 빼야 한다.

| 항목 | 값 | 왜 |
|---|---|---|
| 알파 | `clamp(휘도 / knee, 0, 1)` | 단순 임계값으로 자르면 **글로우가 통째로 날아가** 테두리가 톱니처럼 남는다. 밝기에 비례시키면 글로우가 자연스럽게 흐려진다 |
| `knee` | **32** | 기존 `res_*` 4장을 재보니 불투명 픽셀의 최저 휘도가 20~43, 반투명이 6~9% 였다. 32가 그 사이 |
| un-premultiply | 함 | 검정과 섞여 어두워진 가장자리 색을 알파로 나눠 되돌린다. 안 하면 밝은 배경에서 테두리에 검은 띠가 돈다 |
| 순서 | **줄이고 → 알파** | 리사이즈 AA 가 검정과 섞이며 부드러운 가장자리를 만든 뒤 알파를 씌운다 |

넣은 결과(2026-08-19): 투명 32~46% · 반투명 9~22% · 5~7KB. 기존 `res_*`(투명 42%대)와 같은 결이다.

## 배선된 자리
| 아이콘 | 어디 | 폴백 |
|---|---|---|
| `res_ticket_*` | 동료 팝업 뽑기 줄 · 일일 퀘스트 보상 표기 3곳 | `resIco` 가 빈 문자열(키가 없을 때만) |
| `state/st_lock` | 사냥터 업그레이드 카드 — 머리(`해금 필요`)와 밑변 칸 | `HM_LOCK_SVG` **선 SVG** |
| `state/st_rebirth` | 성장 > 환생 줄 | 원래 이모지 `🔁` |
| `av_guest` | 설정 프로필 머리줄(정식 계정 아닐 때) | 밑에 깔린 **이니셜 글자** |

⚠ `🎟`·`🔒`·`🔁` 는 아직 **다른 자리에 많이 남아 있다**(토스트 문자열·건물 잠금 배지 등).
종류를 알 수 있는 자리만 그림으로 바꿨다 — 토스트처럼 글자만 나가는 곳은 이모지가 맞다.
