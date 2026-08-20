# ART — 생성 이미지 스타일 규격

> **결정된 것만 적는다.** 새 이미지를 뽑을 때 §2 템플릿을 그대로 꺼내 쓰고, 바꾸는 것은 §2-B 한 칸뿐이다.
> ⚠ **세션이 바뀌어도 같은 그림이 나와야 한다.** 프롬프트를 즉흥으로 새로 쓰지 말 것 —
> 여기 문장들은 실패를 한 번씩 겪고 남은 것이다(§7). 마지막 갱신: 2026-08-18

---

## 0. 언제 이 문서를 보는가

**게임에 들어갈 이미지를 생성하기 전에.** 유즈맵 키 아트·던전 배경·화면 배경 등 "장면"을 만드는 모든 경우.

**계열이 둘이다** — §2~§7 은 **유즈맵 키 아트**(내려다보는 맵 그림), §8 은 **타이틀 배경**(부팅 로딩, 올려다보는 전투 그림).
노출·안개·금지 블록은 같고 시점·구도·후처리가 다르다. 새 그림이 어느 쪽인지 먼저 정하고 그 계열의 규격을 쓸 것.

이 문서가 다루지 **않는** 것: 아이콘(`assets/icons`)·유닛 초상(`assets/portraits`)·타일(`assets/tiles`).
그건 이미 만들어진 에셋이고, 새로 필요하면 **먼저 기존 것을 찾아 쓴다**(CLAUDE.md 아이콘 일반 원칙).

---

## 1. 모델·설정 — 고정

| 항목 | 값 | 왜 |
|---|---|---|
| 제공자 | **Higgsfield** (MCP) | 이 프로젝트의 기존 배경이 나온 곳 |
| 모델 | **`soul_location`** ("Environment and location generation") | 장면·환경 전용. 인물 모델(`soul_cast`)로 배경을 뽑지 말 것 |
| 비율 | **`3:4`** | 팝업 뒤 배경은 299×350(≈0.85)로 잘린다. 3:4로 뽑으면 위쪽 87%가 살아남는다 |
| 장수 | 맵당 **1장** | |
| 호출 | `generate_image_batch` (여러 장이면 한 번에) | 순차로 부르면 느리고, 배치가 같은 시각 시드라 톤이 더 붙는다 |

---

## 2. 프롬프트 = 고정 블록 4개 + 장면 1개

**A · C · D · E 는 글자 그대로 복사한다. B 만 맵마다 쓴다.**

### A — 노출·매체 (고정 · 맨 앞)

```
Moody sci-fi game environment key art, clearly readable exposure with rich midtones,
not underexposed, not pitch black.
```

### B — 장면 (유일한 변수)

그 맵의 **게임플레이를 장면으로 번역**한다. 분위기 형용사가 아니라 **구조물**을 쓴다.
네모네모 = 사각 트랙 / 성소 공성전 = 부유하는 석판과 제단 / 포탑 겹치기 = 겹겹이 쌓인 포탑.

시점은 **`viewed from a high aerial angle`** 또는 `high three-quarter aerial angle` 로 고정한다 —
게임이 위에서 내려다보는 시점이라 배경도 같은 시점이어야 한 화면으로 읽힌다.

**한 장이 유독 시끄러우면 B 에서 발광을 줄인다** — `glowing`→`pale`/`dim`, `bioluminescent … pulse`→`faint … restrained and sparse`,
구조물에 무채색 재질을 준다(`dark grey-brown carapace`), 그리고 `low overall contrast` 를 덧붙인다.
가시탑이 여섯 중 혼자 튀어서 이렇게 잡았다(대비 ±53 → ±23).

### C — 대기·빛 (골격 고정 · `<색>` 두 칸만 교체)

```
Thick volumetric haze fills the whole scene and catches the light,
lifting the shadows into visible <색>-grey midtones.
… (장면 요소가 안개 속으로 물러나는 묘사) …
Dominant <색> palette with soft <색> key light, atmospheric perspective, layered depth.
```

**안개는 장식이 아니라 노출 장치다.** 검정을 midtone으로 들어올리는 유일한 수단이고,
이 문장이 빠지면 모델이 화면을 새까맣게 만든다(§7 ①). 사막이면 `blowing dust and sand haze`,
포자면 `glowing spore mist`, 우주면 `illuminated vapour` 로 **말만 바꾸고 기능은 유지**한다.

**안개에는 반드시 대항 문장 셋을 붙인다** — 안개만 주면 이번엔 화면이 *평평한 단색 죽*이 된다(§7 ⑤):

```
The haze is light in the foreground so nearby structures stay crisp and clearly legible,
thickening only into the distance.
Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash.
… strong value separation between structures and background …
```

### D — 구도 (고정)

```
The very center of the frame is calm and uncluttered.
Painterly concept art, cinematic, detailed environment clearly visible throughout the frame.
```

**가운데를 비우는 것은 취향이 아니라 요구사항이다** — 유즈맵 팝업은 그 자리에 또렷한 미니맵(`#moThumb`)을 얹는다.
한 번 이 문장을 흘려서 6장을 다시 뽑았다(§7 ④). `scripts/art-lint.mjs` 가 §6 전문에 이 문장이 있는지 검사한다.

### E — 금지 (고정 · 맨 뒤)

```
No text, no logos, no user interface, no characters, no watermark.
```

글자가 들어오면 못 쓴다(다국어·해상도 문제). 인물이 들어오면 배경이 아니라 일러스트가 된다.

### 쓰면 안 되는 표현

| 금지 | 왜 |
|---|---|
| `deep near-black`, `lit only by ~`, `pitch black` | 평균 밝기 5~18이 나온다. 후보정으로 못 살린다(§7) |
| `dramatic lighting`, `epic`, `masterpiece` 류 | 모델이 인물·구도를 과하게 잡는다. 배경은 조용해야 한다 |
| 특정 게임·작가 이름 | |

---

## 3. 색은 새로 만들지 않는다

**맵 색은 코드의 `MAP_ACCENT` 가 단일 소스다**(`sc-ums-web.html`). 그림의 지배 팔레트는 그 색을 따른다 —
그래야 팝업의 오라·버튼 링·바깥 발광과 그림이 같은 색으로 흐른다.

| 맵 | id | `MAP_ACCENT` | 그림의 지배 팔레트 |
|---|---|---|---|
| 네모네모 디펜스 | `nemo` | `#4aa8ff` | steel blue |
| 오토 배틀 | `cpu` | `#22d3ee` | teal / cyan |
| 가시탑 디펜스 | `sunken` | `#5dff8f` | desaturated green |
| 용병 키우기 | `marine` | `#ffb14d` | burnt amber / dusty brown |
| 성소 공성전 | `temple` | `#b98cff` | violet / dusty lavender |
| 포탑 겹치기 | `photon` | (없음 → 기본 `#7f93b0`) | cool steel grey / pale blue |

새 맵 색은 **DESIGN.md §2 역할 액센트 표**에서 꺼낸다. 새 색을 만들지 말 것.

---

## 4. 후처리 — 고정 규격

`scripts/usemap-bg.mjs` 하나가 맡는다. **공용 변환기 `scripts/optimize-img.mjs` 는 이 폴더를 다루지 않는다**(밝기를 안 맞춘다).

> ⚠ **`package.json` 은 여전히 `.gitignore` 다** — 그게 보이면 Vercel 이 정적 사이트 대신 빌드를 시도한다.
> 스크립트는 커밋되지만 의존성 목록은 안 따라간다 → 새로 클론한 곳에서는 `npm i sharp` 를 한 번 해줘야 돈다.
> (`optimize-glb.mjs` 는 `@gltf-transform/*`, `video-frames.mjs` 는 `puppeteer-core` 도 필요하다.)

```bash
# assets/backgrounds/usemaps/<맵id>.png 를 두고
node scripts/usemap-bg.mjs
```

| 항목 | 값 |
|---|---|
| **주제 찾아 자르기** | 그림에서 **디테일이 몰린 띠**를 찾아 잘라낸다. 팝업은 그림의 위쪽 절반쯤만 보여주는데 생성기는 피사체를 한가운데 놓기 때문 — 안 자르면 하늘·안개만 남는다(§7 ⑥) |
| 밝기 목표 | **보이는 구간 평균 55** (0-255) |
| '보이는 구간' | 이미지 **위쪽 절반** — 그 아래는 팝업 비네트가 완전히 덮는다 |
| 채도 목표 | **색 편차 45** — 모델이 "Dominant blue palette" 를 거의 모노크롬으로 해석한다(cpu 가 R1/G66/B97 로 나왔다) |
| 보정 수단 | **`modulate({brightness, saturation})`** — LCh 의 L·C 만 만져 색상(맵 아이덴티티)은 지킨다 |
| 배율 상한 | ×0.4 ~ ×2.0. 걸리면 **원본을 다시 뽑는다**(스크립트가 경고를 찍는다) |
| 크기·품질 | 1024px 안쪽 · WebP q80 (장당 10~65KB) |
| 커밋 | `.webp` 만. 원본 `.png` 는 `.gitignore` |

⚠ **밝기를 sharp의 `gamma()` 로 만지지 말 것** — 리사이즈용 인코딩 보정이라 방향이 반대다(올리려다 더 어두워진다).

---

## 5. 새 맵 그림 추가 체크리스트

1. `MAP_ACCENT` 에 그 맵 색이 있는지 확인(없으면 DESIGN.md §2 표에서 고른다)
2. §2 템플릿으로 프롬프트 작성 — **B만 새로 쓰고 A·C·D·E는 복사**
3. `soul_location` · `3:4` 로 생성
4. `assets/backgrounds/usemaps/<맵id>.png` 로 저장
5. `node scripts/usemap-bg.mjs` — 밝기가 55 근처로 나오고 **배율 상한 경고가 없어야** 한다
6. `sc-ums-web.html` 의 **`UMAP_BG`** 에 `<맵id>:1` 추가 (다른 맵 그림을 공유하면 `'대상id'`)
7. `.png` 삭제 · `npm test` · 팝업에서 실제로 확인

> 그림이 없는 맵은 배경 층이 **그냥 빈다**(맵색 오라가 분위기를 맡는다). 임시·관리자 맵은 그대로 두는 게 맞다.

---

## 6. 실제로 쓴 프롬프트 전문

지금 들어가 있는 6장을 **실제로 만든** 프롬프트 그대로다 — 이대로 다시 넣으면 같은 계열이 나온다.
**부분 수정하지 말고 통째로 복사해 쓸 것.** 새로 뽑았으면 여기에 전문을 추가한다(`node scripts/art-lint.mjs` 가 규격을 검사한다).

> `nemo` · `sunken` 은 B 블록에 **`close to camera and filling the upper half of the frame`** 이 더 붙어 있다.
> 안개만 나오고 주제가 안 보여서 그 둘만 다시 뽑았다(§7 ⑥). 새 맵도 주제가 멀게 나오면 이 구절을 B 에 붙인다.

### nemo — 네모네모 디펜스

```
Moody sci-fi game environment key art, clearly readable exposure with rich midtones, not underexposed, not pitch black. A vast square circuit-like defense track carved into an industrial plain at blue hour, seen from a high three-quarter aerial angle, the track close to camera and filling the upper half of the frame, its four corners clearly readable. Thick volumetric haze fills the whole scene and catches the light, lifting the shadows into visible blue-grey midtones. The haze is light in the foreground so nearby structures stay crisp and clearly legible, thickening only into the distance. Glowing cold blue guidance lines run along the square loop, holographic waypoint pylons at each corner, fortified walls and antenna towers receding into the mist. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Dominant steel blue palette with cold blue key light, strong value separation between structures and background, atmospheric perspective, layered depth. The very center of the frame is calm and uncluttered. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. No text, no logos, no user interface, no characters, no watermark.
```

### cpu — 오토 배틀

```
Moody sci-fi game environment key art, clearly readable exposure with rich midtones, not underexposed, not pitch black. A battle corridor between two opposing fortified bases in a canyon at blue hour, viewed from a high aerial angle. Thick volumetric haze fills the whole scene and catches the light, lifting the shadows into visible teal-grey midtones. The haze is light in the foreground so nearby structures stay crisp and clearly legible, thickening only into the distance. Automated production gantries and conveyor rails line both sides, glowing cyan energy flowing along the ground, command spires receding into the mist. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Dominant teal and cyan palette with cold key light, strong value separation between structures and background, atmospheric perspective, layered depth. The very center of the frame is calm and uncluttered. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. No text, no logos, no user interface, no characters, no watermark.
```

### sunken — 가시탑 디펜스

```
Moody sci-fi game environment key art, clearly readable exposure with rich midtones, not underexposed, not pitch black. An organic canyon pass walled by towering barbed biological spire structures, chitinous and ribbed, dark grey-brown carapace, viewed from a high aerial angle, the spires close to camera and filling the upper half of the frame, their silhouettes sharp and clearly readable. Thick pale spore mist fills the whole gorge and catches the light, lifting the shadows into visible mossy green midtones. The haze is light in the foreground so nearby structures stay crisp and clearly legible, thickening only into the distance. Faint dim sap veins trace the spires, restrained and sparse, a low creeping organic membrane spreads across the floor, distant spires receding into the haze. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Dominant desaturated green palette with soft green key light, low overall contrast, strong value separation between structures and background, atmospheric perspective, layered depth. The very center of the frame is calm and uncluttered. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. No text, no logos, no user interface, no characters, no watermark.
```

### marine — 용병 키우기

```
Moody sci-fi game environment key art, clearly readable exposure with rich midtones, not underexposed, not pitch black. An armored mercenary outpost on a wind-scoured desert plateau at dusk, viewed from a high aerial angle. Thick blowing dust and sand haze fills the whole scene and catches the light, lifting the shadows into visible warm brown midtones. The haze is light in the foreground so nearby structures stay crisp and clearly legible, thickening only into the distance. Sandbag revetments, supply crates, a landing pad and a battered watchtower, distant mesas receding into the dust. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Dominant burnt amber and dusty brown palette with warm low key light, strong value separation between structures and background, atmospheric perspective, layered depth. The very center of the frame is calm and uncluttered. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. No text, no logos, no user interface, no characters, no watermark.
```

### temple — 성소 공성전

```
Moody sci-fi game environment key art, clearly readable exposure with rich midtones, not underexposed, not pitch black. Ruins of an ancient alien sanctum on a floating rock plateau at twilight, viewed from a high aerial angle. Thick luminous mist fills the whole scene and catches the light, lifting the shadows into visible violet-grey midtones. The haze is light in the foreground so nearby structures stay crisp and clearly legible, thickening only into the distance. Weathered pale stone colonnades and carved glyph walls surround a dormant altar, shattered slabs hover in the air, glowing crystal shards drift between them. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Dominant violet and dusty lavender palette with soft magenta key light, strong value separation between structures and background, atmospheric perspective, layered depth. The very center of the frame is calm and uncluttered. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. No text, no logos, no user interface, no characters, no watermark.
```

### photon — 포탑 겹치기

```
Moody sci-fi game environment key art, clearly readable exposure with rich midtones, not underexposed, not pitch black. A dense field of stacked defensive turret emplacements bolted onto an orbital space platform, viewed from a high aerial angle. Thick illuminated vapour drifts across the deck and catches the light, lifting the shadows into visible pale steel-grey midtones. The haze is light in the foreground so nearby structures stay crisp and clearly legible, thickening only into the distance. Layered gun batteries and shield emitter pylons crowd the metal plating, cables and coolant pipes snaking between them, a bright nebula and distant planet beyond the platform edge providing soft fill light. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Dominant cool steel grey and pale blue palette, strong value separation between structures and background, atmospheric perspective, layered depth. The very center of the frame is calm and uncluttered. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. No text, no logos, no user interface, no characters, no watermark.
```

---

## 7. 실패 기록 — 이 규칙들이 있는 이유

**① 검정 지옥 (6장 폐기).** 1차 프롬프트는 `Deep near-black environment lit only by cold blue emissive strips` 였다.
모델이 곧이곧대로 받아 **평균 밝기 4.8~18.4** (255 만점)가 나왔다. 배경으로 깔면 그냥 검정이었고,
어떤 후보정으로도 못 살렸다(전부 검정인 이미지에는 살릴 정보가 없다). 6장을 버렸다.
→ **해결은 후보정이 아니라 프롬프트였다.** "안개가 빛을 받아 그림자를 midtone으로 들어올린다"로 바꾸니 29~120이 나왔다.

**② 감마를 거꾸로 썼다.** 살려보려고 sharp의 `.gamma()` 로 밝기를 올리려 했는데
그건 **리사이즈용 인코딩 보정**이라 방향이 반대다 — 4.8이 0.7로 **더 어두워졌다**.
→ 밝기는 `modulate({brightness})`.

**③ 맵마다 노출이 3.5배 흔들렸다.** 2차 생성도 29 ~ 120으로 제각각이었다.
그대로 두면 어떤 맵은 배경이 안 보이고 어떤 맵은 미니맵·글자를 이긴다.
→ **밝기 정규화가 파이프라인에 들어간 이유.** 팝업이 한 컴포넌트로 읽히려면 12개 맵이 같은 밝기여야 한다.

**⑤ 안개를 고치니 이번엔 평평해졌다.** ①의 해결책(볼류메트릭 안개)만 밀었더니 안개가 장면을 통째로 삼켜
`temple` 이 **보라 단색**이 됐다(대비 ±9). 검정 지옥에서 단색 죽으로 옮겨간 것뿐이다.
→ 안개에 **대항 문장 셋**을 붙였다(§2-C): 근경은 안개를 걷고 · 팔레트는 tint 지 monochrome wash 가 아니고 · 구조물과 배경의 명암을 벌린다.

**⑥ 주제가 화면 밖에 있었다.** 팝업은 그림의 위쪽 절반쯤만 보여주는데(아래는 비네트) 생성기는 피사체를 한가운데 놓는다.
그래서 `nemo`(사각 트랙)·`sunken`(가시탑)이 통째로 잘려 나가고 **안개만** 남았다 — 색·밝기를 아무리 맞춰도 안 보이던 이유다.
→ 두 가지로 막았다. ① 파이프라인이 **디테일이 몰린 띠를 찾아 잘라낸다**(위치를 CSS 에 맵마다 박지 않는다 — 프레이밍은 그림의 성질이지 화면의 성질이 아니다).
② 그래도 멀면 B 블록에 `close to camera and filling the upper half of the frame` 을 붙인다.

**⑦ 재는 곳과 고치는 곳이 달랐다.** 파이프라인이 밝기·채도를 **원본 전체**의 위쪽 절반에서 재고, 보정은 **잘라낸 그림**에 적용했다.
크롭이 크게 움직인 맵은 엉뚱한 기준으로 정규화돼 혼자 튀었다(가시탑이 대비 ±53). 지표가 초록불인데 눈에는 틀려 보이면 이걸 의심할 것.
→ 순서를 **자르기 → 재기 → 고치기**로 바로잡았다. 여섯 장 전부 다시 처리했다.

**④ 문서와 실물이 어긋났다.** 문서에 "구도 문장(§2-D)을 넣는다"고 적어놓고, 밝기 문제로 프롬프트를 다시 쓸 때 그 문장을 흘렸다.
문서는 "넣는다"인데 실물 6장에는 없는 상태로 한동안 갔다 — **규격을 글로만 적으면 이렇게 샌다.**
→ 두 가지로 막았다. ① **§6에 실제로 쓴 전문을 통째로 박아둔다**(요약만 남기면 다음 사람이 다른 그림을 뽑는다).
② **`scripts/art-lint.mjs`** 가 고정 블록 6종·금지 표현·맵 표↔`UMAP_BG` 일치를 기계로 검사한다.
이 어긋남을 실제로 잡아낸 것도 그 린트였고, 6장을 규격대로 다시 뽑아 문서와 실물을 맞췄다.

---

## 8. 타이틀 배경 계열 — 부팅 로딩 (2026-08-20)

**유즈맵 키 아트와 규격이 다르다.** 목적이 다르기 때문이다 — 유즈맵은 팝업 뒤에 깔리고 위쪽 절반만 보이지만, 타이틀은 **화면 전체를 채우고 그 위에 제목·엠블럼·숫자가 얹힌다.**

| 항목 | 유즈맵 키 아트(§2) | **타이틀 배경** |
|---|---|---|
| 시점 | `high aerial angle` 고정(게임이 내려다보므로) | **`low three-quarter angle`** — 올려다보는 각. 타이틀은 게임 화면이 아니다 |
| 구도 | `The very center of the frame is calm` (미니맵 자리) | **`The upper third of the frame is calm open sky`** (엠블럼·제목 자리) |
| 인물 | `no characters` | **`All figures are distant silhouettes, no close-up faces`** — 전투 장면이라 병력이 필요하다 |
| 밝기 | 55 | **58** |
| 채도 | ×0.45 ~ **1.4** (색이 살아야) | ×0.45 ~ **1.0 — 낮추기만** (글자가 배경을 이겨야) |
| 크롭 | 디테일 띠를 찾아 자름 | **안 자름** (프롬프트가 구도를 잡는다) |
| **비율** | `3:4` (팝업 뒤 299×350 칸에 맞춤) | **`9:16`** — 폰 프레임(390×809 · 비 0.482)을 화면 전체로 덮기 때문 |
| 도구 | `scripts/usemap-bg.mjs` | **`scripts/title-bg.mjs`** |

A(노출) · C(안개 + 대항 문장 셋) · 금지(텍스트·로고·UI·워터마크)는 **§2 와 똑같다.** 바뀌는 것은 위 표의 다섯 줄뿐이다.

- ⚠ **비율을 §1(유즈맵용 `3:4`)에서 가져오지 말 것.** 타이틀은 폰 프레임(비 **0.482**)을 `cover` 로 덮으므로 원본이 가로로 넓을수록 **양옆이 잘린다.** 실측:

  | 원본 비율 | 화면에 남는 가로 | 양옆 잘림 |
  |---|---|---|
  | `3:4` (0.750) | 64% | 18%씩 |
  | `2:3` (0.667) | 72% | 14%씩 |
  | **`9:16` (0.563)** | **86%** | **7%씩** |

  다섯 종족을 좌우로 펼쳐 놓는 그림이라 양옆이 잘리면 **바깥 종족이 통째로 사라진다.** 반드시 `9:16` 으로 뽑을 것.
- ⚠ **밝기만 올리면 글자가 안 읽히고, 비네트만 걷으면 그림이 어둡다.** 둘을 같이 움직여야 한다.
  실제 화면의 딤은 `#opening .opArt::after` 가 갖고 있고 **글자가 앉는 아래쪽만** 덮는다(`.06 → .10 → .62 → .96`).
  예전 값(`.25 → .55 → .96`)은 전장을 통째로 눌러 무엇이 싸우는지 안 보였다.
- **종족은 다섯이다** — 유니온(파랑 보병·기계) · 에테리얼(금색 사이오닉) · 스웜(초록 유기체) · 페럴(수인 무리) · 콜로서스(거신 포격).
  ⚠ 페럴·콜로서스는 **아직 코드에 없다**(`STK_RACES` 는 셋뿐). RACES.md 의 설계를 그림이 먼저 보여 주고 있다는 뜻이다.

### 실제로 쓴 프롬프트 — `assets/backgrounds/title/boot.webp`

```
Moody sci-fi battle key art, bright and clearly readable exposure with rich midtones, well lit, not underexposed. Five visually distinct armies fighting through the ruins of a shattered city, broken towers and collapsed overpasses framing the street below, seen from a low three-quarter angle at blue hour. Blue-lit human power-armour infantry with tracked tanks; golden psionic alien warriors with glowing energy blades and hovering crystalline craft; a green chitinous insectile swarm pouring from a breached wall; a fast pack of feral gene-forged beast-soldiers with horns and claws bounding over rubble; and towering colossal artillery machines with long barrels braced on deployed legs firing between the towers. Tracer fire, energy beams and heavy shellfire cross the street, explosions blooming mid-ground. Thin volumetric haze catches the light and separates the armies into distinct depth layers without hiding them. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Steel blue base palette with distinct faction accents, strong value separation between armies and background, atmospheric perspective, layered depth, strong sense of motion. The upper third of the frame is calm open sky and uncluttered. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. All figures are distant silhouettes, no close-up faces. No text, no logos, no user interface, no watermark.
```

> 다섯 종족 묘사(위 두 번째 문장)는 **고정 블록**이다. 새 타이틀 배경을 뽑을 때 그 문장을 그대로 두고 **전장·시점·조명만** 바꾼다.
> 여덟 장을 그렇게 뽑아 비교했다(열린 계곡 · 굽이친 전선 · **폐허 도시(채택)** · 협곡 관문 · 궤도 강하 · 야간 화염 · 사막 폭풍 · 크리스탈 평원).

