# ART — 생성 이미지 스타일 규격

> **결정된 것만 적는다.** 새 이미지를 뽑을 때 §2 템플릿을 그대로 꺼내 쓰고, 바꾸는 것은 §2-B 한 칸뿐이다.
> ⚠ **세션이 바뀌어도 같은 그림이 나와야 한다.** 프롬프트를 즉흥으로 새로 쓰지 말 것 —
> 여기 문장들은 실패를 한 번씩 겪고 남은 것이다(§7·§9-9). 마지막 갱신: 2026-08-21

---

## 0. 언제 이 문서를 보는가

**게임에 들어갈 이미지를 생성하기 전에.** 유즈맵 키 아트·던전 배경·화면 배경 등 "장면"을 만드는 모든 경우.

**계열이 넷이다.**

| 계열 | 절 | 무엇 |
|---|---|---|
| 유즈맵 키 아트 | §2~§7 | 내려다보는 맵 그림. 가운데를 비운다(미니맵 자리) |
| 타이틀 배경 | §8 | 올려다보는 전투 그림. 위쪽을 비운다(제목 자리) |
| **유닛 참고 아트** | **§9** | **캐릭터**. 8방향 스프라이트의 원본이라 규칙이 앞 둘과 반대다(`no characters` 가 없다) |

앞 둘은 노출·안개·금지 블록이 같고 시점·구도·후처리가 다르다. §9 는 목적 자체가 달라 별도 규격을 쓴다.
새 그림이 어느 계열인지 **먼저 정하고** 그 계열의 규격을 꺼낼 것 — `scripts/art-lint.mjs` 가 계열별로 검사한다.

이 문서가 다루지 **않는** 것: 아이콘(`assets/icons`)·유닛 초상(`assets/portraits`)·타일(`assets/tiles`).
그건 이미 만들어진 에셋이고, 새로 필요하면 **먼저 기존 것을 찾아 쓴다**(CLAUDE.md 아이콘 일반 원칙).

---

## 1. 모델·설정 — 고정

| 항목 | 값 | 왜 |
|---|---|---|
| 제공자 | **Higgsfield** (MCP) | 이 프로젝트의 기존 배경이 나온 곳 |
| 모델 | **`soul_location`** ("Environment and location generation") | 장면·환경 전용. 인물 모델(`soul_cast`)로 배경을 뽑지 말 것 |
| 비율 | **`9:16`** | 팝업 뒤 배경은 299×350(≈0.85)로 잘린다. 3:4로 뽑으면 위쪽 87%가 살아남는다 |
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
  (페럴·콜로서스는 2026-08-20 에 코드로 들어갔다 — 그림이 설계보다 먼저 나와 있었다.)

### 실제로 쓴 프롬프트 — `assets/backgrounds/title/boot.webp`

```
Moody sci-fi battle key art, bright and clearly readable exposure with rich midtones, well lit, not underexposed. Five visually distinct armies fighting through the ruins of a shattered city, broken towers and collapsed overpasses framing the street below, seen from a low three-quarter angle at blue hour. Blue-lit human power-armour infantry with tracked tanks; golden psionic alien warriors with glowing energy blades and hovering crystalline craft; a green chitinous insectile swarm pouring from a breached wall; a fast pack of feral gene-forged beast-soldiers with horns and claws bounding over rubble; and towering colossal artillery machines with long barrels braced on deployed legs firing between the towers. Tracer fire, energy beams and heavy shellfire cross the street, explosions blooming mid-ground. Thin volumetric haze catches the light and separates the armies into distinct depth layers without hiding them. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Steel blue base palette with distinct faction accents, strong value separation between armies and background, atmospheric perspective, layered depth, strong sense of motion. The upper third of the frame is calm open sky and uncluttered. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. All figures are distant silhouettes, no close-up faces. No text, no logos, no user interface, no watermark.
```

> 다섯 종족 묘사(위 두 번째 문장)는 **고정 블록**이다. 새 타이틀 배경을 뽑을 때 그 문장을 그대로 두고 **전장·시점·조명만** 바꾼다.
> 여덟 장을 그렇게 뽑아 비교했다(열린 계곡 · 굽이친 전선 · **폐허 도시(채택)** · 협곡 관문 · 궤도 강하 · 야간 화염 · 사막 폭풍 · 크리스탈 평원).



---

## 9. 유닛 참고 아트 계열 — 페럴 (2026-08-21)

앞의 두 계열(§6 유즈맵 키 아트 · §8 타이틀 배경)은 **환경**이라 `no characters` 가 붙는다.
이건 **캐릭터** 계열이라 규칙이 반대다. 목적도 다르다 — 감상용이 아니라 **8방향 스프라이트의 원본**이다.

### 9-1. 형태는 둘로 갈린다

`RACES.md §2` 의 형태 축을 그대로 따른다.

| 계열 | 유닛 | 프롬프트 |
|---|---|---|
| **수인형** | 돌진수 · 대공 투석수 · 포식수 · 맹독수 · 암살수 · 주술사 · 우두머리 | 9-3 |
| **짐승형** | 채집수 · 추격수 · 가시 사수 · 정찰조 · 수송조 · 하늘 사냥수 · 뇌격수 · 원시 군주 | 9-4 |
| **혼합** | 폭격 기수(짐승 탈것 + 수인 기수) | 9-3 에서 두 줄 교체(9-7) |

### 9-2. 파이프라인 — 세 단계다

```
① 정면 전신 시트(9-3 / 9-4)  →  ② 게임 카메라 각도로 재렌더(9-5, i2i)  →  ③ 턴테이블 영상(9-6) → 프레임 8장
```

**게임 카메라는 `VIEW_TILT = 0.65 rad = 37.2°` · 오쏘그래픽**(`js/90-m3d.module.js`).
정통 아이소메트릭(35.3°)과 거의 같다. **이 두 값을 프롬프트에 반드시 박는다** —
눈대중으로 "위에서 본"이라고 쓰면 45~60°가 나오고, 원근이 들어가면 앞다리만 부풀어 발밑 그림자·선택 링과 어긋난다.
엔진의 `face=0`(`Math.atan2(dx,dy)`)이 **카메라 쪽**이라 ②의 정면이 곧 8방향의 0번이다.

⚠ ③에서 **8방향을 따로 생성하지 말 것.** AI 영상은 방향이 바뀌는 동안 정체성이 흔들려 8마리의 다른 짐승이 나온다.
제자리에 세워 두고 **카메라만 등속 1회전**시키면 `scripts/video-frames.mjs` 의 균등 샘플링이 8장 = 45°씩으로 딱 맞는다.

### 9-3. 수인형 공통 프롬프트 (`[UNIT: …]` 한 칸만 교체)

```
Full-body character reference sheet of a single anthropomorphic beast-warrior, standing
upright and facing the viewer, both feet on the ground, entire body inside the frame from
head to feet with a small margin.

Species: gene-forged beast-folk. A heavily muscled humanoid body carrying the head, pelt,
hide and limbs of a real animal. Digitigrade legs, visible sinew and old scars, crude
surgical grafts left over from gene-engineering. A soldier of a tribal war-pack, not a
mascot and not a werewolf. Gear is primitive and hand-made: bone, tooth, horn, stone,
rawhide strap, woven cord, scavenged plate lashed on with leather. No machined metal, no
powered armour, no firearms.

[UNIT: animal · battlefield role · weapon and how it attacks · one distinguishing feature]

Palette: warm tan, ochre and dusty brown hide over neutral greys. Muted and desaturated,
low-saturation accents only. The colour must read as earth and bone, never neon.

Lighting: even neutral light from the front and slightly above, soft shadows, clearly
readable exposure with rich midtones. Not underexposed, no rim-light drama, no coloured
gels.

Background: flat plain white, with only a soft contact shadow directly beneath the feet.
Identical camera distance, eye-level angle and framing for every character so that body
scale can be compared across sheets. Painterly concept-art rendering, clean and legible,
detail visible across the whole figure.

Pose: a settled combat-ready stance that shows how this warrior actually fights — the
weapon or natural weapon held the way it is used. Not mid-swing, not airborne, not an
action shot.

No text, no logos, no user interface, no watermark, no background scenery, no second
character, no weapon trails, no magic glow, no lens flare.
```

### 9-4. 짐승형 공통 프롬프트

```
Full-body reference sheet of a single gene-forged war beast, a real animal and not a
humanoid, standing on the ground on all fours or on its own feet, presented in profile
three-quarter view, entire body inside the frame from head to tail with a small margin.

Species: a true beast raised and grafted by a tribal war-pack, not anthropomorphic. It
keeps real animal anatomy throughout — no human torso, no hands, no upright posture, no
clothing. It is oversized and battle-hardened: thickened hide or plumage, heavy scarring,
crude surgical grafts left over from gene-engineering, torn ears and broken claws.

Its only harness is primitive and hand-made: rawhide straps, bone toggles, woven cord and
scavenged plate lashed on with leather, fitted by its handlers. No machined metal, no
saddle rigging beyond rough straps, no armour plating that hides the animal's shape.

[UNIT: animal · battlefield role · how it attacks with its natural weapons · one
distinguishing feature]

Palette: warm tan, ochre and dusty brown hide or feather over neutral greys. Muted and
desaturated, low-saturation accents only. The colour must read as earth and bone, never
neon.

Lighting: even neutral light from the front and slightly above, soft shadows, clearly
readable exposure with rich midtones. Not underexposed, no rim-light drama, no coloured
gels.

Background: flat plain white, with only a soft contact shadow directly beneath the body.
Identical camera distance, eye-level angle and framing as the beast-folk sheets so that
body scale can be compared between them. Painterly concept-art rendering, clean and
legible, detail visible across the whole animal.

Pose: standing and alert, wings folded or half-folded if it has them, showing how it
actually fights. Not mid-flight, not mid-strike, not an action shot.

No text, no logos, no user interface, no watermark, no background scenery, no rider, no
second animal, no weapon trails, no magic glow, no lens flare.
```

### 9-5. 게임 각도로 재렌더 (i2i · 레퍼런스 이미지 첨부 필수)

```
Re-render the character from the attached reference image. Keep the exact same creature,
anatomy, proportions, gear, markings and colours — only the camera changes.

Camera: the camera sits only slightly above the character, about 37 degrees from the
ground plane, the angle of an isometric strategy-game camera. The top of the head and the
shoulders are visible but very little ground is seen behind the character. The figure
still reads as standing, not lying down and not seen from directly overhead.

Projection: flat orthographic projection like a technical illustration. The near and far
parts of the body are drawn at exactly the same scale, and no limb is enlarged just
because it is closer to the camera. No wide-angle lens, no fisheye, no foreshortening, no
lens curvature.

Facing: the character faces the camera, turned toward the bottom of the frame, as if about
to walk toward the viewer.

Pose: the head is raised and held level with the shoulders so the skull reads clearly in
silhouette. A neutral standing stance with the weight settled evenly on every foot. Not
crouching, not stalking, not lowering the head, not mid-step, not mid-swing, not airborne.
The stance should still show how this one fights.

Framing: a single character centred in frame, the whole body inside the frame from the top
of the head to the feet with a small margin, feet planted on the ground.

Background: flat plain white with only a soft contact shadow directly beneath the body,
not offset to one side. No long cast shadow across the ground, no floor texture, no
environment.

Lighting: even neutral light from the front and slightly above, identical to the reference.
Soft shadows, clearly readable midtones, no rim light, no coloured gels.

No text, no logos, no user interface, no watermark, no background scenery, no second
character, no weapon trails, no magic glow, no lens flare.
```

### 9-6. 턴테이블 영상 (8방향 원본 · 9-5 결과를 레퍼런스로)

```
Using the attached image as the exact reference for the character, create a short video.

The animal stands still in a neutral standing pose and does not move, does not walk, does
not attack and does not change its pose at any point. Only the camera moves.

The camera orbits smoothly and continuously around the animal, one full 360 degree
revolution at a constant speed, ending exactly where it started.

Throughout the whole orbit the camera stays at a constant height, about 37 degrees above
the ground plane, and at a constant distance, so the animal stays the same size in frame
from the first frame to the last.

Flat orthographic look: no perspective distortion, no wide-angle lens, no fisheye, no zoom,
no dolly, no camera shake, no motion blur.

The animal stays centred in frame at all times, its whole body inside the frame, feet on
the ground, with a soft contact shadow directly beneath it.

Background: flat plain white, completely static — no environment, no floor texture, no
particles, no fog.

Lighting stays exactly the same for the entire clip: even neutral light, no rim light, no
coloured gels, no change as the camera moves.

The creature's anatomy, fur colour, scars, stitches and bone necklace must stay identical
in every frame. No morphing, no shape change, no added or removed details.

No text, no logos, no user interface, no watermark, no second character.
```

### 9-7. 혼합형(폭격 기수)은 9-3 에서 두 줄만 바꾼다

- 첫 줄 → `Full-body character reference sheet of a single mounted unit: a war beast with its rider, both standing upright...`
- 마지막 줄에서 `no second character,` **삭제**

### 9-8. 지금까지 확정한 개별 블록

**추격수** (짐승형)
```
[UNIT: a lean feral hound, jackal-like with a short coarse tan pelt and a whip-thin
running build. The cheapest and most numerous body the pack throws forward, fielded seven
at a time. It fights with nothing but teeth, driving in low and biting at the legs of
whatever is in front of it. Distinguishing feature: it carries no gear at all beyond a
single rawhide collar strung with notched bones, and its ribs show.]
```

**가시 사수** (짐승형)
```
[UNIT: a hulking porcupine, low and broad, its whole back and flanks buried under a dense
mantle of long banded quills. The pack's standing ranged animal, holding ground while the
hounds close. It fights by planting its feet and snapping its body so the loose quills fire
forward like darts. Distinguishing feature: bald patches across the back where quills have
been thrown and have not regrown, and the mantle is flared wide in a warning bristle.]
```

**암살수** (수인형)
```
[UNIT: a mantis beast-folk — a tall narrow chitinous body, triangular head with large
compound eyes, two long raptorial forelimbs folded tight against the chest. The pack's
ambusher and the fastest thing it has on the ground. Fights by holding perfectly still
until it strikes, then unfolding both blade-arms in a single leaping cut. Distinguishing
feature: the chitin is matte earth-brown and dust-caked for hiding, never glossy green;
the folded forelimbs read as a coiled spring about to release.]
```

**폭격 기수** (혼합형 — 9-7 적용)
```
[UNIT: a mounted pair — a huge war eagle whose wingspan is several times the rider's
height, standing on the ground with wings half-folded, and a small wiry beast-folk lancer
seated low on its shoulders. The pack's only airborne striker, diving to drive a long
bone-tipped lance down into a single ground target, one heavy hit at a time.
Distinguishing feature: the lancer is strapped in with rawhide so both hands stay free for
the lance, and the eagle's talons are wrapped in leather.]
```

### 9-9. 실패 기록 — 이 문장들이 있는 이유

**1차 시도(추격수)에서 세 가지가 한꺼번에 나갔다.**

| 증상 | 원인 | 넣은 문장 |
|---|---|---|
| 앞발이 뒷다리보다 훨씬 크게 부풀었다 | `orthographic` 단어 하나로는 안 먹는다 | `like a technical illustration` + `no limb is enlarged just because it is closer` + 광각·어안 금지 |
| 각도가 37°보다 한참 위에서 잡혔다 | 숫자만 주면 모델이 무시한다 | **보이는 것으로 기준을 준다** — `the top of the back is visible but very little ground is seen behind` |
| 머리를 숙여 실루엣에서 머리가 사라졌다 | "combat-ready stance" 가 웅크림으로 해석됐다 | `the head is raised and held level with the shoulders so the skull reads clearly in silhouette` |

**세 번째가 실전에서 제일 아프다.** 게임 화면에서 유닛은 **40~60px**로 보인다. 그 크기에서는 봉합선·목걸이가 전부 사라지고
**실루엣만 남는다.** 뽑은 그림은 **48px로 줄여서 무엇인지 알아볼 수 있는지** 확인하고 넘어갈 것.

### 9-10. 체크리스트
- [ ] 정면 시트(9-3/9-4) — 형태 계열이 맞는가
- [ ] 48px 실루엣 판독 통과
- [ ] 게임 각도 재렌더(9-5) — 원근 없음 · 머리가 실루엣에 남음 · 그림자 발밑 정위치
- [ ] 턴테이블 영상(9-6) — 한 바퀴 도는 동안 같은 개체인가
- [ ] 프롬프트 전문을 9-8 에 추가하고 `node scripts/art-lint.mjs` 통과


---

## 10. 종족 전장·아이콘 계열 — 캠프 종족 선택 (2026-08-24)

캠프 첫 진입의 종족 선택 화면(`#campRaceOv`)에 쓰는 둘이다.
화면 규격은 `DESIGN.md` 전환 기록 「캠프 종족 선택」이 단일 소스다.

### 10-1. 전장 그림 — §8 과 같은 9:16, **비우는 자리만 반대**

| 항목 | 타이틀 배경(§8) | **종족 전장** |
|---|---|---|
| 모델 · 비율 | `soul_location` · `9:16` | **같다** |
| 시점 | `low three-quarter angle` | **같다** |
| 인물 | `All figures are distant silhouettes` | **같다** |
| 종족 | 다섯 종족이 한 화면에서 전면전 | **한 종족만** |
| 비우는 자리 | **위** 1/3(로고·제목이 앉는다) | **아래** 1/3(종족 행·확정 버튼이 앉는다) + 좌상단(제목) |
| 파일 | `assets/backgrounds/title/boot.webp` | `assets/backgrounds/races/<종족>.webp` |

⚠ **§8 의 「다섯 종족 묘사」 고정 블록을 여기 가져오지 말 것.** 한 종족만 보여주는 그림이다.
바뀌는 것은 **장면 한 문단과 지배 팔레트**뿐이고, 나머지 문장은 아래를 글자 그대로 복사한다.

지배 팔레트는 **`STK_RACES[k].col` 이 단일 소스**다(ART.md §3 — 색은 새로 만들지 않는다):
유니온 `#4aa8ff` steel blue · 스웜 `#9fd356` 산성 황록 · 에테리얼 `#ffc040` 앰버 골드.

#### 유니온 — `assets/backgrounds/races/union.webp`
```
Moody sci-fi battle key art, bright and clearly readable exposure with rich midtones, well lit, not underexposed. A human power-armour army holding a fortified line in the ruins of a shattered industrial city — blue-lit infantry in heavy powered suits behind concrete revetments and razor wire, tracked battle tanks with long barrels braced between broken walls, missile turrets and supply gantries rising behind them, tracer fire and shellbursts crossing the street ahead. Thin volumetric haze catches the light and separates the ranks into distinct depth layers without hiding them. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Steel blue base palette with cold azure running lights, strong value separation between the army and the background, atmospheric perspective, layered depth, strong sense of motion, seen from a low three-quarter angle. The lower third of the frame is calm and uncluttered, and the upper left corner is free of bright detail. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. All figures are distant silhouettes, no close-up faces. No text, no logos, no user interface, no watermark.
```

#### 스웜 — `assets/backgrounds/races/swarm.webp`
```
Moody sci-fi battle key art, bright and clearly readable exposure with rich midtones, well lit, not underexposed. A green chitinous insectile swarm pouring across a ruined city street — a living tide of segmented carapaced creatures breaking over rubble, spined hatching mounds and pulsing organic spires rooted in creep that coats the ground and climbs the broken walls, acid spray and spore bursts hanging in the air. Thin volumetric haze catches the light and separates the swarm into distinct depth layers without hiding it. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Sickly yellow-green base palette with pale bone highlights, strong value separation between the swarm and the background, atmospheric perspective, layered depth, strong sense of motion, seen from a low three-quarter angle. The lower third of the frame is calm and uncluttered, and the upper left corner is free of bright detail. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. All figures are distant silhouettes, no close-up faces. No text, no logos, no user interface, no watermark.
```

#### 에테리얼 — `assets/backgrounds/races/aetherial.webp`
```
Moody sci-fi battle key art, bright and clearly readable exposure with rich midtones, well lit, not underexposed. A golden psionic alien host advancing through the ruins of a shattered city — tall warriors in ornate gilded armour with glowing energy blades, shimmering hexagonal shield barriers flaring where fire strikes them, hovering crystalline craft and floating obelisks of cut stone drifting above the street, warp light blooming where reinforcements arrive. Thin volumetric haze catches the light and separates the host into distinct depth layers without hiding it. Muted desaturated colour, the palette is a tint over neutral greys, not a monochrome wash. Warm amber and old-gold base palette with pale cyan psionic accents, strong value separation between the host and the background, atmospheric perspective, layered depth, strong sense of motion, seen from a low three-quarter angle. The lower third of the frame is calm and uncluttered, and the upper left corner is free of bright detail. Painterly concept art, cinematic, detailed environment clearly visible throughout the frame. All figures are distant silhouettes, no close-up faces. No text, no logos, no user interface, no watermark.
```

### 10-2. 종족 아이콘 — 커런시/무판 계열

`assets/icons/README.md` 의 **공통 블록 C — 커런시/무판 계열**을 그대로 쓴다(128×128 · 알파 ·
검정 배경에서 `scripts/icon-cutout.mjs` 로 오려냄). 판(plate) 계열이 **아니다** — 종족 아이콘은
판 없이 어두운 아트 위에 바로 얹힌다.

모델은 **`recraft_v4_1`**(`model_type:'utility'` · `background_color:'#000000'` · `1:1`)을 썼다.
아이콘 계열의 모델은 그동안 어디에도 안 적혀 있었다 — 이 줄이 첫 기록이다.

`SUBJECT` 만 종족마다 바꾼다. 나머지 문장(COMPOSITION / FORM / TREATMENT / SHADING / LIGHT /
BACKGROUND / NEGATIVE)은 공통 블록 C 그대로다.

| 종족 | SUBJECT |
|---|---|
| 유니온 | `a heavy armoured shield plate of a human military faction, a broad chamfered pentagon slab with a raised cross-brace over its face and a small rivetted boss at the centre, painted vivid azure blue #4aa8ff with pale steel chamfer edges and cold white running lights along the brace` |
| 스웜 | `a curved chitin claw of an insectile hive faction, a single upward-hooking talon built from stacked segmented carapace plates with a sharp bone-white tip, the carapace a vivid acid green #9fd356 with darker moss-green segment joints and pale yellow-green edge facets` |
| 에테리얼 | `a floating psionic crystal shard of an ancient alien faction, a tall faceted gem cut into sharp flat planes with a narrower base and a broad crowned top, the body a warm amber gold #ffc040 glowing from within, with pale ivory facet edges and a thin ring of cut stone braces clasping its waist` |

### 10-3. 2026-08-25 — 여섯 장 모두 저장소에 들어갔다

`assets/backgrounds/races/{union,swarm,aetherial}.webp` (660×1173) ·
`assets/icons/races/{union,swarm,aetherial}.webp` (128×128 알파) — 전부 실물이 있다.
다시 뽑을 때는 위 프롬프트를 **그대로** 쓸 것. 다시 쓰면 톤이 갈린다.

⚠ **생성물 CDN(`d8j0ntlcm91z4.cloudfront.net`)은 이 개발 환경의 네트워크 허용 목록에
없다**(`403` — 조직 이그레스 정책). 그래서 파일을 직접 내려받지 못하고, 힉스필드
`sandbox_exec`(거기서는 CDN에 닿는다)에서 base64 텍스트로 찍어 옮겨 적었다.
샌드박스 출력은 호출당 **약 20,000자에서 잘린다** — 19,000자씩 끊어야 한다.

- 다음에 또 옮겨야 한다면 **조각마다 `md5`를 먼저 받아 둘 것.** 이번에 한 조각이
  전송 중 깨졌는데(2001~3000자), 1,000자 단위 md5 이분탐색으로 그 칸만 다시 받아 고쳤다.
  검사값이 없으면 21만 자를 통째로 다시 옮겨야 한다.
- 근본 해결은 **CDN 호스트를 허용 목록에 추가**하는 것이다. 그러면 `curl` 한 번이다.

---
## 11. 캠프·던전 맵 계열 — 게임판 지면 (2026-08-27 전면 개정)

**앞의 세 계열과 목적이 다르다.** 유즈맵 키 아트(§2)·타이틀(§8)·종족 전장(§10)은 **뒤에 깔리는 그림**이고,
이것은 **유닛이 그 위를 걸어다니는 게임판**이다.

| 항목 | 유즈맵 키 아트(§2) | **캠프·던전 맵** |
|---|---|---|
| 정체 | 팝업 뒤 배경 | **플레이 공간 그 자체** |
| 비율 | `3:4` | **`9:16`** — 맵 화면이 390×767(비 0.508) |
| 모델 | `soul_location` | **`gpt_image_2` · `9:16` · `2k`~`4k` · `high`** |
| 파일 | `assets/backgrounds/usemaps/` | `camp/camp.webp` · `dungeons/dg1~10.webp` |
| 저장 | — | 폭 **1600** 으로 리사이즈 + WebP `q82`(11장 6.4MB) |

⚠ **모델을 `soul_location` 으로 되돌리지 말 것.** 같은 문장으로도 게임플레이 구조(기지 터·통로·
가장자리)를 못 지켰다 — 세 판(9장)을 버렸다. `gpt_image_2` 는 한 번에 지켰다.

### 11-1. 핵심 방법 — **0번을 먼저 뽑고, 나머지는 그것을 레퍼런스로 첨부한다**

이 계열의 전부다. 스타일·색·조명·하단 기지 터를 **말로 설명하지 않는다** — 레퍼런스가 정한다.

1. **0번(캠프)** 을 레퍼런스 없이 뽑는다. 마음에 들 때까지 여러 장.
2. **1~10번(던전)** 은 그 0번 이미지를 **첨부**하고, 프롬프트는 「하단은 그대로 · 위쪽만 교체」.

⛔ **후처리로 하단을 이식하지 말 것.** 한때 캠프 하단을 잘라 던전에 얹는 스크립트를 썼는데,
자르는 선이 18px 어긋나 **캠프의 노란 흙이 딸려 가 던전 위에 초록빛 띠로 번졌다**(2026-08-27).
레퍼런스로 뽑으면 하단이 이미 맞는다 — 손대는 순간 오히려 틀어진다.

### 11-2. 그림이 곧 게임판이다

지형지물이 그려진 자리는 **못 지나다니는 곳으로 읽힌다.** 그래서 그림이 규칙을 따라야 한다.

1. **아래 1/3 = 기지 터.** 석판이 화면 폭을 꽉 채운다. 그 위에 아무것도 없다.
   ⚠ **1/5 로는 모자란다** — 하단 정보판이 이미지 아래 17% 를 덮어 석판이 거의 안 보였다(실측).
2. **가운데 세로 통로 = 적이 내려오는 길.** 캠프에도 적이 온다(`campSpawnFoes`) — 캠프를 숲으로
   꽉 막으면 적이 나무 위를 걷는다. ⛔ 「캠프는 길 없이 숲」으로 되돌리지 말 것.
3. **지형지물 = 좌우 가장자리와 위 모서리에만.**
4. **덩어리 크기** — 나무·바위 하나가 **건물보다 작아야** 한다. 크면 배경이 유닛과 경쟁한다
   (실측: 나무 하나 36px vs 본부 40px · 가스 28px · 미네랄 12px).

### 11-3. 0번 프롬프트 — 캠프 (`assets/backgrounds/camp/camp.webp`)

레퍼런스 없이 처음 뽑는 유일한 장이다. 이 한 장이 **11장 전체의 스타일과 색을 결정한다.**

```
A tall vertical top-down game map for a real-time strategy game, seen from directly above. The bottom third of the frame is a stone-paved base platform spanning the full width and running off both side edges, completely bare. Just above it lies a band of bare worked earth with low rocky outcrops breaking through. Above that a wide open lane of bare earth runs up the centre of the frame to the top edge, staying clear of every obstacle. All the forest is banked along the left and right margins and into the upper corners — many small rounded tree canopies packed shoulder to shoulder, low shrubs, mossy boulders and fallen trunks, each canopy much smaller than a building. Nothing is built anywhere — no huts, tents, towers or fences. STYLE: soft anime game background art, gentle airbrushed gradients, clean simple shapes with delicate highlights, the look of a stylised mobile RPG world map. No text, no logos, no user interface, no characters, no watermark.
```

### 11-4. 1~10번 프롬프트 — 던전 (0번을 첨부)

`{GROUND}` 와 `{EDGE}` 두 칸만 바꾼다. 나머지는 글자 그대로 복사한다.

```
Use the attached image as the reference.

THE BOTTOM 62% OF THE FRAME IS LOCKED. Reproduce it exactly as it appears in the reference, pixel for pixel: a pale grey-cream plaza of irregular flagstones filling the whole width and running off both the left and right edges of the frame, its upper edge crossing the frame at about 38% down from the top and curving in a gentle shallow arch that rises slightly toward the centre, bordered along that curved edge by a low parapet of squared stone blocks. Above the parapet, a narrow band of bare worked earth. Do not redraw it, do not restyle it, do not move it up or down, do not change its colour, its stone pattern, the shape of its arch or the height at which it sits. It must be indistinguishable from the reference.

Replace only the area above that band: a wide open lane of bare {GROUND} runs up the centre to the top edge, clear of every obstacle, with {EDGE} banked along the left and right margins and into the upper corners. Nothing intact is standing anywhere.

Match the reference exactly in art style, rendering, colour palette and lighting throughout the whole image. No text, no logos, no user interface, no characters, no watermark.
```

#### ⭐ 왜 이렇게 길어졌나 (2026-08-30 개정)

옛 문구는 **「레퍼런스와 똑같이」라고만 하고 그 하단이 어떻게 생겼는지는 한 마디도 안 했다.**
모델 입장에서 지킬 기준이 없다 — 실제로 하단이 장마다 제각각으로 나왔다(옛 dg9 는 캠프와 색 차이 62).

**두 겹으로 붙든다:**

| | |
|---|---|
| ① **숫자** | `THE BOTTOM 62%` · `crossing the frame at about 38% down` — 실측값이다 |
| ② **생김새를 말로** | 완만한 아치 · 낮은 돌 난간 · 회백색 판석 · 좌우로 빠져나감 |
| ③ **강한 금지** | `do not redraw / restyle / move up or down` · `indistinguishable from the reference` |

⭐ ②가 결정적이다. 레퍼런스와 문장이 **서로를 붙든다** — 말로도 그려 주면 재생성해도 같은 것이 나온다.

### 11-4-1. ⚠ 그래도 경계는 어긋난다 — **뽑은 뒤 반드시 맞춘다** (2026-08-30)

강화한 프롬프트로 10장을 다시 뽑았더니 하단 **모양·색은 거의 같아졌는데**,
**경계 높이가 전부 2~5%p 아래로 치우쳤다**(화면에서 최대 38px). `pixel for pixel` 이라고
못박아도 모델이 그 정도는 흘린다. **정렬은 후처리로 해야 한다.**

#### ⛔ 경계를 「찾으려」 하지 말 것 — 두 번 실패했다

| 방법 | 왜 틀렸나 |
|---|---|
| 색이 가장 급변하는 줄 | 그림마다 **다른 지점**을 잡는다(잔해·풀·이끼) |
| 석판 색에서 벗어나는 줄 | 캠프 석판이 아래로 갈수록 밝아져 **64%** 가 나왔다 |

#### ⭐ 캠프와 **겹쳐서** 맞춘다

하단은 원래 같은 그림이므로, **세로로 밀어가며 차이가 최소인 위치**가 곧 정답이다.

| | |
|---|---|
| 비교 구간 | 세로 **50~95%** (확실한 석판만) |
| 방법 | 흑백 축소(160×400) 후 오프셋 −40~+40 을 훑어 평균 절대차 최소 |
| 신뢰 판단 | **잔차 4~7** 이면 잘 맞은 것이다(0~255 기준). 그보다 크면 하단 자체가 다른 그림이다 |

#### ⛔ 크기를 건드리지 말 것

경계 위/아래를 각각 세로 스케일해서 맞추면 **석판 자체가 늘어나** 무늬가 안 맞는다
(실제로 해 봤더니 어긋남이 3.25 → 4.00%p 로 **오히려 늘었다**).

⭐ **평행 이동만 한다.** 위에서 s 픽셀 잘라내 위로 밀고, 아래에는 **자기 석판 맨 아랫줄을 복제**해 채운다.
석판 하단은 균일해서 복제가 보이지 않는다. 이 방법으로 11장 전부 **0.00%p** 가 됐다.

⚠ 위쪽이 최대 5%(149px) 잘리지만 **가운데 통로와 좌우 지형지물은 남는다** — 게임에 영향 없다.

| n | 이름 | `{GROUND}` | `{EDGE}` |
|---|---|---|---|
| 1 | 감염된 둥지 | `earth` | `infested growth — rounded chitinous nodules, spore vents, mossy boulders and creeping tendrils` |
| 2 | 버려진 전초기지 | `cracked concrete` | `ruined outpost wreckage — toppled concrete revetments, rusted cargo containers, coils of razor wire and collapsed watch posts` |
| 3 | 잊혀진 회랑 | `polished floor stone` | `ancient ruins — fallen columns, broken floor plates and carved stone lintels` |
| 4 | 산란장 | `damp earth` | `a breeding ground — heaped pale egg sacs, split hatched shells, glistening pools of thick slime and low fleshy mounds` |
| 5 | 폐쇄된 시설 | `metal deck plating` | `sealed facility wreckage — locked bulkhead doors, bundled pipework, hazard-striped steel cages and torn floor grating` |
| 6 | 봉인된 성소 | `worn temple stone` | `sanctum ruins — rune-carved altar blocks, shattered violet crystal pillars, stacked warding stones and toppled masonry` |
| 7 | 군단의 심장 | `ash-covered ground` | `hive flesh — pulsing fleshy spires, arching bone ribs and crusted sinew` |
| 8 | 함대 정박지 | `riveted deck plate` | `dock wreckage — heavy mooring clamps, severed fuel lines and collapsed cargo cranes` |
| 9 | 공허의 문 | `fractured dark stone` | `warped matter — floating shards of stone, torn rifts in the air and drifting broken arches` |
| 10 | 심연 | `black basalt` | `abyssal rock — jagged basalt outcrops, glowing fissures and drifting weightless debris` |

#### ⚠ 색이 레퍼런스를 너무 따라올 때 (4·6 에서 실제로 났다)

레퍼런스가 초록이면 산란장·성소까지 초록으로 나와 던전 1 과 구별이 안 됐다. **두 곳을 고친다.**

- 스타일 일치에서 `colour palette` 를 **뺀다** → `Match the reference exactly in art style, rendering and lighting`
- `{EDGE}` 뒤에 한 줄 붙인다:
  `Shift the palette away from green: this map is <색>, and there is no vegetation, no moss and no foliage anywhere.`
  (4번 = `sickly bone-white and yellow-ochre over wet grey mud` · 6번 = `cool violet-grey stone with pale amber rune glow`)

### 11-5. 화면 배선

- `#phone.campMode #cstMain .bmapFloor`(css/30-home.css) — `background-size:auto 118%` · `center bottom`.
  118% 인 이유는 그 자리 주석이 단일 소스다.
- `campSkin()`(js/19-camp.js) — 0단계면 `camp/camp.webp`, 그 밖에는 `dungeons/dg<n>.webp`.
  ⛔ 캠프가 던전 1 그림을 빌려 쓰게 되돌리지 말 것(2026-08-26 에 갈랐다).
- ⛔ `git checkout -- assets/backgrounds/dungeons/` 를 함부로 쓰지 말 것. 새로 받은 그림은 커밋
  전까지 작업 트리에만 있어서 그 한 줄로 10장이 통째로 날아간다(2026-08-26 에 겪었다).

### 11-6. 실패 기록 — 이 규칙들이 있는 이유

- **정사각(1536²) 그림을 세로 화면에 억지로 맞췄다.** `auto 150%` 로 키워 위를 잘라내는 방식이라
  **원본의 34% 만 쓰고 그걸 다시 늘렸다** — DPR 2 에서 1.5배, DPR 3 에서 2.25배 확대. 실기기에서 뭉개졌다.
  화면 비율과 같은 세로 그림(9:16)을 그리는 것이 유일한 근본 해결이었다.
- **`soul_location` 으로 세 판(9장)을 버렸다.** 사진풍 → 스타일은 잡았지만 구조 실패 → 기지 터가 흰 판.
- **스타일을 형용사로 지정하다 계속 어긋났다.** `hand-painted` 를 일러스트 느낌의 원인으로 지목했다가
  틀렸고(같은 문구로 좋은 결과가 나왔었다), 짧게 줄이면서 `clearly readable at small size` 를 빼자
  나무가 건물만큼 커졌다. **레퍼런스 한 장이 형용사 스무 개보다 정확하다.**
- **후처리 이식은 문제를 만들기만 했다**(§11-1 ⛔). 지금 쓰지 않는다.
- ⛔ 심연(10)에 `near-black` · `lit only by` 를 쓰지 말 것 — 화면이 통째로 까매진다(§7 ①).

---

## 12. 통짜 지면 계열 — 유즈맵 바닥 (2026-08-28)

> ⛔ **타일 반복은 폐기했다**(2026-08-28 사용자 확정). 「통으로 된 하나의 이미지가 더 깔끔하다」.
> 옛 타일 프롬프트는 **스타일의 근거로만** 남긴다(§12-4).

**§11(캠프·던전 맵)과 무엇이 다른가** — 목적은 같은 「게임판 지면」인데 **그림체가 다르다.**

| | §11 캠프·던전 | **§12 유즈맵 바닥** |
|---|---|---|
| 그림체 | `soft anime game background art` | **사진 같은 질감** — 기존 타일을 잇는다 |
| 구조 | 아래 1/3 기지 터 · 가운데 통로 | 맵마다 다르다(트랙 · 플랫폼 …) |
| 모델 | `gpt_image_2` | `gpt_image_2` — 같다 |

⚠ **두 그림체가 게임 안에 섞인다.** 캠프는 애니풍, 유즈맵은 사진풍이다 — **의도된 것**이다
(사용자: 「기존 타일 스타일로 최대한 같은 스타일」). 통일하려면 그때 다시 정한다.

### 12-1. 규격

| 항목 | 값 | 왜 |
|---|---|---|
| 모델 | **`gpt_image_2`** · `2k`~`4k` · `high` | ⛔ `soul_location` 은 쓰지 말 것 — §11 에서 9장을 버렸고, 2026-08-28 에 다시 시험했더니 **또 원근으로 나왔다** |
| 비율 | **`9:16`** ⭐ (2026-08-30 재확정) | 게임 뷰가 **0.508**(390×767)이라 `9:16`(0.5625)이 가장 가깝다 — 늘려 메울 양이 가장 적다. ⚠ `3:4`·`16:9` 도 시험했지만 우주를 3~5배 늘려야 해서 뭉갰다 |
| 안전 여백 | 가장자리는 잘려도 되는 것만 | 판을 그림 안 **정해진 자리**에 넣고, 코드가 거기에 맞춰 배치한다(§12-6) |

#### ⚠ 옛 `9:16` 은 왜 버렸나

그림을 화면에 `cover` 로 깔던 시절의 값이다. 지금은 **코드가 그림을 판 기준으로 배치**하므로
비율의 역할이 달라졌다 — 화면을 덮는 것이 아니라 **판이 들어갈 그릇**이면 된다.
게임 뷰(9:19)와 그림(3:4)의 차이는 코드가 우주 부분을 늘려 메운다(§12-6).

### 12-2. ⭐ 공통 스타일 블록 — 모든 장에 그대로 붙인다

기존 타일 넷을 직접 열어 보고 **공통점만 추린 것**이다(§12-4).

```
perfectly flat top-down orthographic view straight from above, no perspective, no horizon,
flat even ambient lighting with no directional shadows and no visible light source,
fine small-scale surface detail, nothing larger than a fist,
muted low-saturation palette, dark tones,
the important area stays within the central 80% of the width,
no characters, no objects, no units, no structures, no text, no user interface,
highly detailed photorealistic PBR game texture, AAA game environment asset,
3D render, tall vertical composition
```

#### ⭐ 밝은 맵은 넷째 줄 하나만 바꾼다 (2026-08-28)

잔디·갑판·설원처럼 **밝아야 하는 판**은 이 한 줄만 교체한다. **나머지 여덟 줄은 손대지 않는다.**

**넷째 줄은 장면이 고른다.** 지금까지 쓴 셋:

| 장면 | 넷째 줄 |
|---|---|
| 어두운 흙·암반 | `muted low-saturation palette, dark tones,` |
| 밝은 인공물(금속·석판) | `restrained palette, low contrast, evenly lit, nothing glows,` |
| **초록이 살아야 하는 곳(잔디)** | `natural palette with living green grass, low contrast, evenly lit, nothing glows,` |

⚠ **이 줄이 앞의 묘사를 이긴다.** 표면 문장에 «fresh living green» 을 아무리 써도
넷째 줄이 `dark tones` 이면 마른 풀이 나온다. 반대로 이 줄만 고치면 나머지 규격은 그대로다.

⭐ `nothing glows` 는 **번쩍임을 막는 가장 센 한 줄**이다(2026-08-30 실제로 이걸로 잡았다).

⚠ 이 줄을 안 바꾸면 **표면 문장이 아무리 밝아도 어둡게 나온다** — `dark tones` 가 이긴다.
반대로 이 줄만 바꾸면 정투영·무그림자·잔디테일 같은 나머지 규격은 그대로 유지된다.

#### 각 줄이 무엇을 막는가

| 줄 | 없으면 생기는 일 |
|---|---|
| `orthographic … no perspective, no horizon` | **판이 사다리꼴로 기운다.** 두 번 겪었다 — 가장 중요한 줄 |
| `no directional shadows and no visible light source` | 한쪽에 그림자가 져 유닛 그림자와 방향이 어긋난다 |
| `nothing larger than a fist` | 큰 바위가 솟아 **유닛이 가려진다** |
| 넷째 줄(채도) | 톤이 제멋대로 — 밝기를 정하는 **유일한** 줄 |
| `central 80% of the width` | 폰에서 **좌우가 최대 17.9% 잘려** 중요한 것이 사라진다 |
| `no characters, no objects…` | 사람·건물이 들어와 게임 유닛과 겹친다 |
| `AAA game environment asset` | 질감이 밋밋해진다 |
| `tall vertical composition` | 가로 그림이 나온다 |

⛔ `epic` · `dramatic lighting` · `masterpiece` 는 넣지 말 것(§2) — 조명과 원근을 되살려
위 두 규칙을 깨뜨린다. `art-lint` 가 잡는다.

#### 옛 타일 세 줄에서 무엇이 바뀌었나

| | 옛 타일 | **통짜** |
|---|---|---|
| 이어짐 | `seamless tileable` | ⛔ **뺀다** — 반복하지 않는다 |
| 모양 | `square tile` | **`tall vertical composition`** |
| 시점 | `top-down bird's eye view` | ⚠ **`orthographic … no perspective, no horizon`** — `bird's eye` 는 **비스듬한 부감으로 읽힌다**(2026-08-28 실제로 그렇게 나왔다) |
| 조명 | (없음) | **`flat even ambient, no directional shadows`** — 지금 타일 넷의 공통점이다 |
| 채도 | `dark tones` | **`muted low-saturation`** 추가 — `dark tones` 만으로는 `desert` 가 밝게 나왔다 |
| 여백 | (없음) | **`central 80% of the width`** — 좌우가 잘린다 |

⭐ **발광은 장면 줄에서만** 준다(용암 주황 · 프로토스 파랑). 공통 블록이 발광을 말하면 흙까지 빛난다.

#### ⛔ 옛 타일 블록을 통짜에 그대로 쓰면 안 된다 (2026-08-28 · 실제로 물어본 것)

옛 블록의 두 줄이 **통짜의 장면 문단과 정면으로 모순**된다.

| 옛 줄 | 왜 못 쓰나 |
|---|---|
| `seamless tileable texture, edges match perfectly on all four sides` | 「사방이 이어지는 무늬」를 요구한다. 그런데 장면 문단은 「떠 있는 **판 하나**」를 요구한다 → **판·테두리·우주가 사라지고 화면 전체가 반복 텍스처로 찬다** |
| `square tile` | 정사각인데 우리는 `9:16` 이다 — 비율까지 싸운다 |

⭐ **시점·조명·디테일·금지 줄은 그대로 살아 있다.** 지금 블록은 옛 타일 블록에서
**타일 전용 두 줄을 빼고 네 줄(채도·여백·품질·세로구도)을 더한 것**이다.

⚠ 타일로 되돌아갈 거라면 반대로 해야 한다 — **판·테두리·우주 문단 셋을 전부 빼고** 표면 문장만 남긴다.
형태 지시와 `seamless` 는 같이 쓸 수 없다.

### 12-3. 장면 줄 — 맵마다 이 한 덩이만 바꾼다

**공통 블록 앞에** 붙인다. 지금 네모네모 바닥은 코드가 이렇게 조립하고 있다
(`js/10-engine.js` — 이걸 한 장으로 옮기는 것이 이번 작업이다):

| 부분 | 지금 | 장면 줄에 쓸 말 |
|---|---|---|
| 바깥 | `space_bg` 반복 + 성운 + 비네팅 | deep starfield with faint distant nebula |
| 안쪽 판 | `badlands` 반복 + 노이즈 | a wide rectangular platform of dry cracked badlands earth, open and bare |
| 테두리 | `ashworld` 용암 절벽 | its edge a rim of dark volcanic rock with dim restrained molten seams |

⚠ **판 위는 비워야 한다** — 유닛이 그 위에 선다. `open and bare`·`uncluttered` 를 꼭 넣을 것.

### 12-3-1. ⭐ 네모네모 디펜스 바닥 — 전문 (2026-08-28)

> ⛔ **1차안은 폐기했다.** 기존 타일 문구를 그대로 옮겨 적어서 **「타일과 똑같은데 크기만 커진 것」**이 됐다.
> 통짜로 만드는 이유가 사라진다 — 사용자: 「기존 이미지랑 너무 비슷하잖아? 훨씬 더 멋지고 퀄리티 높은 배경을 원해」.

#### ⭐ 무엇이 달라져야 하나 — **타일이 못 하던 것**을 넣는다

| 타일의 한계 | 통짜에서 할 수 있는 것 |
|---|---|
| 무늬가 **균일**하다 — 어디를 봐도 같다 | **큰 지질 구조** — 균열이 한쪽에서 다른 쪽으로 흐른다 |
| 512px 안에서 끝난다 | **디테일 층위** — 멀리서도 가까이서도 볼 것이 있다 |
| 절벽이 그냥 띠다 | **주상절리** — 층층이 갈라진 현무암 기둥, 깊이가 보인다 |
| 발광이 균등하다 | **깊은 곳에서 새어 나오는 빛** — 균열 바닥에서만 |
| 우주가 별 반복이다 | **성운의 흐름 · 먼 별무리 · 떠다니는 파편** |
| 재질이 하나다 | **재질 대비** — 마른 흙 / 유리질 암반 / 광물 맥 |

⛔ **그러면서 표면은 평평해야 한다** — 유닛이 그 위에 선다.
**풍부함은 무늬와 색으로 내고, 솟은 장애물로 내지 않는다.**

#### 코드가 그리는 실제 비율 (그대로 지킨다)

| 부분 | 값 |
|---|---|
| 플랫폼 가로 : 세로 | **1.52 : 1** — 가로로 넓은 직사각형 |
| 세로 위치 | 그림의 **28% ~ 56%** (가운데보다 살짝 위) |
| 가로 | 그림의 **75%** (좌우 잘림 감안) |
| 절벽 테두리 | 플랫폼 세로의 **5%** — 얇다 |
| 모서리 | 반경 8% — **거의 직각** |

⚠ **트랙선은 그리지 않는다** — 플랫폼 자체가 트랙이고 적이 그 가장자리를 돈다.
⭐ **9:16 은 위아래가 안 잘린다**(가장 짧은 폰과 같은 비율). 좌우만 0~17.9% 잘린다.

#### 프롬프트 전문

```
A single vast rectangular slab of ancient rock hanging alone in deep space, seen from directly above.
The slab is much wider than it is tall, roughly three units wide to two units tall,
with almost square corners, only slightly rounded. It spans about three quarters of the image width
and sits in the upper middle of the frame, its top edge near the upper third,
its bottom edge just past the middle.

The slab surface is a weathered plain of dry cracked earth, but it is not uniform:
a great fracture system runs across it from one side to the other, branching into finer and finer
hairline cracks like a dry riverbed, and from deep inside the widest fissures a faint amber glow
seeps upward, dim and restrained, never bright. Broad patches of pale mineral salt and rust-brown
oxidised dust drift across the plain in soft bands, and thin dark veins of glassy volcanic stone
thread through the earth and catch a cold sheen. Fine gravel and small angular shards gather
in the low places. Every part of the surface stays flat and walkable — the richness is in texture,
colour and pattern, never in raised obstacles. Nothing stands on the slab, no paths, no markings.

The slab edge falls away as a rim of columnar basalt, tall hexagonal stone columns packed shoulder
to shoulder and sheared off clean, only a narrow band around the plain, about one twentieth of its
height, with dim molten seams glowing faintly deep between the columns.

Beyond the slab is open space: a slow drift of deep nebula in dusty blue and faint violet,
distant star clusters, and a scattering of small broken rock fragments floating near the slab,
catching the same cold light. The frame edges fall away into near darkness.

perfectly flat top-down orthographic view straight from above, no perspective, no horizon,
flat even ambient lighting with no directional shadows and no visible light source,
fine small-scale surface detail, nothing larger than a fist,
muted low-saturation palette, dark tones,
the important area stays within the central 80% of the width,
no characters, no objects, no units, no structures, no text, no user interface,
highly detailed photorealistic PBR game texture, AAA game environment asset,
3D render, tall vertical composition
```

| 설정 | 값 |
|---|---|
| 모델 | `gpt_image_2` |
| 비율 | `9:16` |
| 해상도 · 품질 | `4k` · `high` |

#### ⚠ 꼭 지킬 것

| | 왜 |
|---|---|
| **표면은 평평하게** | `stays flat and walkable` · `never in raised obstacles` — 유닛이 선다 |
| **발광은 깊은 곳에서만** | `deep inside the widest fissures` · `dim and restrained, never bright` — 밝으면 유닛이 안 보인다 |
| **테두리는 얇게** | `only a narrow band` · `about one twentieth of its height` |
| **바깥은 어둡게** | `frame edges fall away into near darkness` — 잘리는 부분이다 |
| **품질 어휘는 둘만** | `highly detailed` · `AAA game environment asset`. ⛔ `epic`·`dramatic lighting`·`masterpiece` 는 금지(§2) |

⭐ **「멋짐」은 형용사가 아니라 구조에서 나온다.** 이 프롬프트가 1차안과 다른 점은
**균열 흐름 · 주상절리 · 광물 맥 · 성운 · 떠다니는 파편** 다섯이고, 전부 **눈에 보이는 것**이다.

⚠ 그래도 밋밋하면 **뽑은 것을 레퍼런스로 잡고 한 요소씩 강화**한다(§12-5) — 프롬프트를 길게 늘이지 말 것.
### 12-3-2. ⭐ 조립 규칙 — 고정 네 덩이 + 갈아 끼우는 두 덩이 (2026-08-28)

16안을 각각 통짜로 쓰면 관리가 안 된다. **한 프롬프트는 다섯 덩이**이고,
그중 **바뀌는 것은 둘뿐**이다.

| 덩이 | 내용 | 바뀌나 |
|---|---|---|
| **A** 형태 | 판의 비율·위치 | ⛔ 고정 |
| **B** 표면 | 판 위의 무늬·재질 | ⭐ **안마다 다르다** |
| **C** 테두리 | 구조는 고정 + **재질 한 문장만** 교체 | ⭐ 재질만 |
| **D** 바깥 | 우주 | ⛔ 고정 |
| **E** 공통 블록 | §12-2 + 품질 어휘 둘 | ⚠ **밝은 계열은 한 줄 교체**(아래) |

#### A · 형태 (고정)

```
A single vast rectangular slab hanging alone in deep space, seen from directly above.
The slab is much wider than it is tall, roughly three units wide to two units tall,
with almost square corners, only slightly rounded. It spans about three quarters of the
image width and sits in the upper middle of the frame, its top edge near the upper third,
its bottom edge just past the middle.
```

#### C · 테두리 — ⭐ 개선판 (2026-08-28 · 형태는 그대로, 읽히는 것만 늘렸다)

1차안의 테두리는 **주상절리 한 문장**뿐이라 「그냥 어두운 띠」로 나왔다.
**두께·위치·비율은 하나도 안 바꾸고**, 안에 층을 넣어 가장자리가 읽히게 한다.

| 넣은 것 | 왜 |
|---|---|
| **바깥 갓돌 + 안쪽 그림자 홈** | 띠가 한 겹이면 평평해 보인다. 두 겹이면 「두께가 있다」가 읽힌다 |
| **부스러기 전이대** | 표면과 테두리가 칼로 자른 듯 만나면 합성처럼 보인다 |
| **미세 파손** | 완벽한 직선은 CG로 읽힌다. 모서리가 조금 깨져야 오래된 돌이 된다 |
| **모서리 강조** | 네 귀가 가장 눈에 띄는 자리다 |

⛔ **절벽 옆면을 그리지 말 것** — 정투영(orthographic)이라 옆면은 원래 안 보인다.
쓰면 원근이 섞여 판이 기울어 보인다(1차 실패 원인).

```
The slab edge is a narrow band, only about one twentieth of the slab's height, but it is
layered: an outermost lip of paler weathered stone catches the ambient light, and just inside
it a darker recessed groove of shadow separates the lip from the plain. Where the two meet,
a thin scatter of broken grit and small fallen shards has collected. The outline is straight
overall but never perfectly clean — the corners are slightly chipped and the edges nibbled
with small irregular breaks, as if the slab was sheared away long ago.
<<재질 한 문장>>
```

#### D · 바깥 (고정)

```
Beyond the slab is open space: a slow drift of deep nebula in dusty blue and faint violet,
distant star clusters, and a scattering of small broken rock fragments floating near the slab,
catching the same cold light. The frame edges fall away into near darkness.
```

#### E · 공통 블록

⭐ **§12-2 가 단일 소스다** — 아홉 줄을 그대로 붙인다. 여기에 다시 적지 않는다(두 벌이 되면 어긋난다).
밝은 판(잔디·갑판…)은 §12-2 의 **넷째 줄 하나만** 바꾼다.

### 12-3-3. 16안 — 갈아 끼우는 두 덩이

⭐ **전문 16개는 목업 문서에 복사용으로 있다** — `docs/mock/nemo-bg-16.html`.
여기는 **무엇이 다른지**의 단일 소스다.

#### A 계열 · 지금 스타일 (어두운 사진 질감)

| # | 이름 | B 표면의 핵심 | C 재질 한 문장 |
|---|---|---|---|
| 01 | 지금 | 균일한 마른 흙 + 고른 자갈 | 어두운 화산암 |
| 02 | 균열 흐름 | 큰 균열계가 한쪽에서 반대쪽으로, 발광 없음 | 갈라진 현무암 |
| 03 | **용암 균열** | 균열 + **깊은 곳에서만** 호박색 발광 | 기둥 사이 용암 이음매 |
| 04 | **광물 맥** | 청록 결정 광맥이 흙을 가로지름 | 광맥이 테두리까지 이어져 차갑게 빛남 |
| 05 | 소금 평원 | 밝은 소금 얼룩 + 산화 먼지 띠 | 소금이 굳은 밝은 테 |
| 06 | 금속 갑판 | 부식된 금속 패널 + 리벳 이음 | 잘려 나간 강철 프레임 |
| 07 | 퇴적 층리 | 비스듬한 지층이 표면에 드러남 | 층이 테두리에서 계단처럼 |
| 08 | 크레이터 | **얕은** 운석 자국 여럿 | 파손이 특히 심한 가장자리 |

#### B 계열 · 모바일 형태 (밝음)

| # | 이름 | B 표면의 핵심 | C 재질 한 문장 |
|---|---|---|---|
| 09 | 잔디 섬 | 짧은 잔디 + 흙길 얼룩 | 흙과 드러난 뿌리 |
| 10 | **석판 타일** | 큰 석판이 격자로 — **거리 감각** | 다듬은 돌 갓돌 |
| 11 | 모래 평원 | 밝은 모래 물결무늬 | 굳은 사암 |
| 12 | 빙판 | 푸른 얼음 + 갈라짐 | 고드름이 아닌 **깎인 얼음 단면** |
| 13 | 네온 회로 | 어두운 판 + 청록 회로선 | 발광하는 금속 테 |
| 14 | 함선 갑판 | 금속 갑판 + 유도등 | 리벳 박힌 장갑 테 |
| 15 | 석회 평원 | 밝은 회백색 암반 + 옅은 균열 | 풍화된 석회암 |
| 16 | 보라 결정 | 보라 결정이 박힌 암반 | 결정이 가장자리에 자람 |

#### ⚠ 어느 안이든 반드시 들어가는 말

| 말 | 왜 |
|---|---|
| `Every part of the surface stays flat and walkable` | 유닛이 선다 |
| `never in raised obstacles` | 솟은 것이 있으면 유닛이 묻힌다 |
| `Nothing stands on the slab, no paths, no markings` | 트랙선은 코드가 안 그린다 — 판 전체가 트랙이다 |
| `dim and restrained, never bright` (발광 안만) | 밝으면 유닛 이펙트가 안 보인다 |

### 12-6. ⭐ 뽑은 그림을 게임에 넣는 법 (2026-08-28 · 실제로 넣었다)

**채택: 09-a 「야생 초원」** — 살아 있는 초록 잔디 + 군데군데 드러난 암반.
**파일이 둘이다** — 판과 우주를 나눠 담는다(왜 나눴는지는 바로 아래).

| 파일 | 크기 | 무엇 |
|---|---|---|
| `nemo_slab.webp` | **1912×1048** · 839KB (q88) | **판만** — 유닛이 서는 면이라 여기에 픽셀을 몰아준다 |
| `nemo_space.webp` | 540×960 · 64KB (q82) | 바깥 우주 — 어둡고 단순해서 흐려도 된다 |

#### ⛔⛔ 가장 크게 헤맨 것 — **캐시가 해상도를 버린다** (2026-08-30)

줌을 하면 바닥이 깨졌다. **그림 해상도를 1080 → 2160 으로 올려도 그대로 깨졌다.**
원인은 그림이 아니라 **그리는 순서**였다.

`drawMain()` 은 이렇게 그린다:

| 순서 | |
|---|---|
| ① | `viewApply(ctx,W,H)` — **줌·팬 변환을 먼저 건다** |
| ② | 바닥을 `_floorCv` 캐시에 **화면 크기로** 굽는다 |
| ③ | `ctx.drawImage(_floorCv,0,0,W,H)` — 그 캐시를 통째로 얹는다 |

⭐ ③ 에서 **캐시가 줌 배율만큼 확대된다.** 판은 캐시 안에서 995px 인데 줌 3배면 2984px 로 늘어난다 —
**원본이 몇 픽셀이든 상관없이 3배 확대**다. 그림을 키운 것이 소용없던 이유가 이것이다.

⭐ **해법: 판은 캐시를 거치지 않는다.**

| | 어디에 그리나 | 왜 |
|---|---|---|
| 우주 | `_floorCv` 캐시 (지금처럼) | 타일 패턴·비네팅이 비싸고, 흐려져도 티가 안 난다 |
| **판** | **매 프레임 `drawSlabDirect()` 로 직접** | 줌이 걸린 ctx 에 원본을 얹으므로 브라우저가 **원본에서 샘플링**한다 |

`drawImage` 한 번이라 비용은 무시할 만하다. 줌 3배·DPR 3 에서 잔디 잎과 작은 꽃까지 선명하다.

⚠ **확인하는 법** — 눈으로 봐야 한다:

```bash
SHOT_DPR=3 SHOT_ZOOM=3 node scripts/shot.mjs nemo
```

#### 곁들여 배운 것 — 부팅 때 받으면 안 된다

처음엔 `new Image()` 의 `src` 를 스크립트 로드 시점에 박아 뒀다. 그랬더니
**부팅 로딩 막대가 0% 에서 멈췄다.** 옆의 타일들은 10~80KB 인데 이 그림은 900KB 라,
디코딩이 `requestAnimationFrame` 을 밀어낸 것이다.

⭐ 그래서 **전장을 처음 그릴 때** 받기 시작한다(`slabImgReady()`·`floorImgReady()` 안에서 `src` 를 채운다).
⚠ 새 배경 그림을 넣을 때 **이 규칙을 꼭 지킬 것** — 부팅 경로에 큰 이미지를 걸면 앱이 안 뜬다.

#### ⛔ 해상도를 줄이면 흐려진다 — 계산해서 정할 것 (2026-08-30)

처음에 1080×1920 · 380KB 로 줄였더니 **화면에서 눈에 띄게 흐려졌다.** 계산해 보면 당연했다.

**판이 화면에서 필요로 하는 픽셀 = 판 CSS 크기 × DPR**

| DPR | 판에 필요한 px |
|---|---|
| 2 | 663 × 439 |
| **3** (요즘 폰) | **995 × 658** |

**그림이 주는 픽셀 = 그림 크기 × `FLOOR_IMG_RECT` 의 w·h**

| 그림 | 판에 주는 px | |
|---|---|---|
| 1080×1920 | 956 × **524** | ⛔ 세로가 **1.26배 확대**된다 → 흐려진다 |
| 1620×2880 | 1434 × 786 | ✅ |
| **2160×3840** | **1912 × 1048** | ⭐ 넉넉하다 |

⚠ **세로가 먼저 모자란다.** 판이 그림 세로의 27% 밖에 안 쓰기 때문이다 —
가로만 보고 «1080이면 충분»이라고 판단하면 틀린다.

⭐ **그리고 줌을 곱해야 한다** — 줌 상한이 `NEMO_MAXZOOM=3` 이라 줌 3배·DPR 3 이면
판에 **2984×1975px** 이 필요하다. 통짜 한 장으로는 원본을 다 써도 1912×1048 이 한계라
**판만 따로 담아야** 이 요구를 채운다(바로 위).

⭐ **잔디처럼 고주파 질감은 특히 약하다.** 같은 압축률에서 석재보다 먼저 뭉갠다.

⚠ 파일 크기는 걱정하지 않아도 된다 — 이 프로젝트의 던전 배경이 **735KB~992KB** 다.
930KB 는 같은 급이다.

| | |
|---|---|
| `FLOOR_IMG_RECT` | `{x:0.058, y:0.338, w:0.885, h:0.273}` |
| 그림 속 판 비율 | **1.823** |
| `geom()` 판 비율 | 1.515 → **세로로 20% 늘여서 채운다** |

⭐ 잔디·얼룩은 방향성이 없어 20% 늘려도 화면에서 티가 안 난다.
⚠ **격자무늬 바닥(석판·회로)으로 바꿀 땐 이 차이를 다시 봐야 한다** — 정사각형 타일이 직사각형이 된다.

#### 무엇이 어려운가 — 그림 비율 ≠ 화면 비율

| | 값 |
|---|---|
| 그림 | `9:16` = 0.5625 |
| 게임 뷰(실측) | 390 × 767 = **0.508** |

가깝지만 같지는 않아서 아래쪽을 1.3배쯤 늘려 메운다. ⚠ `3:4` 로 뽑았을 땐 **3.5~5.6배**를 늘려야 했고
거기서 우주가 뭉개졌다. **`9:16` 이 가장 적게 늘린다.**

#### ⭐ 해법 — geom() 은 건드리지 않고 **그림을 판에 맞춘다**

⛔ `geom()` 을 그림에 맞추면 안 된다 — `innerBounds`·`posAt`·`trackCenter` 가 전부 거기 매여 있어
유닛 이동·적 경로·배치 범위가 통째로 달라진다.

`js/10-engine.js` 의 `buildFloor()` 가 하는 일:

1. **그림 안 판의 자리를 상수로 안다** — `FLOOR_IMG_RECT`
2. **가로는 판 기준 한 배율**로 늘린다(`dw = bw / r.w`)
3. **세로는 세 조각으로 잘라 따로 늘린다** — ① 판 위 우주 → 화면 위 전부 ② 판 → `geom` 자리에 정확히 ③ 판 아래 우주 → 화면 아래 전부

늘어나는 것은 성운·별뿐이라 눈에 띄지 않는다. **판만 비율이 지켜지면 된다.**

#### ⛔ 판 비율은 세 번 빗나갔다 — **요청값을 부풀려야 한다** (2026-08-30)

모델은 «가로로 납작한 직사각형»을 잘 못 그린다. 정사각형 쪽으로 끌린다.

| 요청한 비율 | 나온 비율 | |
|---|---|---|
| 1.5 (`three units wide to two units tall`) | **1.445** | 4% 부족 |
| 1.5 (같은 문구 · 다른 장면) | **1.14** | ⛔ 거의 정사각형 |
| **1.6** (`eight units wide to five units tall` + `never square` + `letterbox`) | **1.823** | ⚠ 이번엔 넘었다 |

⭐ **숫자만으로는 안 듣는다.** 1.6 이 먹힌 것은 숫자가 아니라 같이 넣은 세 가지 때문이다:

| 넣은 말 | 왜 |
|---|---|
| `a wide, shallow, flattened rectangle` | 형태를 형용사로 못박는다 |
| `never square` | 모델이 끌리는 쪽을 직접 막는다 |
| `It must read as a long horizontal letterbox shape` | 아는 모양에 빗댄다 |
| 위치를 **네 값 다** 분수로 | «near the upper third»·«just past the middle» 같은 말은 제각각 해석된다 |

⚠ **1.6~1.8 사이로 나오면 그대로 쓴다.** 코드가 `geom()` 자리에 맞춰 늘리므로
20% 차이는 잔디·얼룩에서 안 보인다. **다시 뽑는 것보다 그냥 넣는 편이 낫다.**

#### FLOOR_IMG_RECT 를 재는 법 — 눈대중 금지

그림 안에서 판이 차지하는 사각형(비율)이다. **행·열 평균 밝기의 경계**로 잰다
(판은 밝고 바깥 우주는 어두우니 자동으로 갈린다).

| 값 | 재는 법 | 지금 그림 |
|---|---|---|
| `x`·`w` | 열 평균 밝기가 임계를 넘는 구간 | 0.061 · 0.878 |
| `y`·`h` | 행 평균 밝기가 임계를 넘는 구간 | 0.201 · 0.458 |

⚠ 눈대중으로 6.3%/19.4% 라고 적었다가 실제로 재니 6.1%/20.1% 였다. **재고 넣을 것.**

#### 그림을 바꾸면 할 일

| | |
|---|---|
| ① | 새 그림을 `assets/backgrounds/floor/` 에 WebP 로 넣는다 |
| ② | `FLOOR_IMG.src` 와 `FLOOR_IMG_RECT` 네 값만 고친다 |
| ③ | `node scripts/shot.mjs nemo` — 전장을 찍어 **판이 제자리인지 눈으로** 본다 |
| ④ | `npm test` |

⛔ `geom()` 의 세 상수(`BOARD_X_INSET`·`BOARD_AR`·`BOARD_Y_LIFT`)는 건드리지 않는다.

#### ⚠ 판 비율이 조금 어긋난다

| | 비율 |
|---|---|
| 그림 속 판 | 1.445 |
| `geom()` 판 | 1.515 |

세로로 약 5% 눌린다. 화면에서 눈에 띄지 않아 그대로 뒀다.
**다음 그림을 뽑을 땐** 장면 줄의 «three units wide to two units tall»(=1.5)이
좀 더 정확히 나오도록 «about three units wide to two units tall, a little wider than that» 처럼
가로를 살짝 밀어도 된다.

#### ⭐ 채택된 프롬프트 전문 — 09-a 「야생 초원」 (9:16 · 2026-08-30)

```
A single vast rectangular slab of ancient stone, seen from directly above, hanging alone in
empty space. The slab is a wide, shallow, flattened rectangle — eight units wide to five units
tall, far wider than it is tall — with almost square corners, only slightly rounded.

Its exact placement in the frame: the left edge sits about one eighth in from the left side of
the image and the right edge about one eighth in from the right side, so the slab spans roughly
three quarters of the image width. Its top edge is about one quarter of the way down the image
and its bottom edge is a little past half way down, so the slab is only about three tenths of
the image tall. A wide band of empty space is left below it and a narrower one above. It must
read as a long horizontal letterbox shape, never square.

In the background art style of StarCraft 1 from 1998 — flat even lighting, visible surface
grain, low contrast, no gloss and nothing that glows — but the grass itself is alive and
healthy rather than dried out.

The slab surface is an open meadow of short cropped grass in fresh living green, and its green
is never one green: a cool blue-green where the turf grows thick and deep, a warmer sunlit
green across the open middle, and a soft yellow-green where it thins. The colour is rich and
verdant but never neon — it reads as real spring grass, not a painted lawn. In several places
the turf thins and gives way to the pale grey bedrock beneath, showing that the slab is a piece
of rock wearing a thin skin of soil — these bare outcrops are worn smooth and sit flush with
the grass, spreading in irregular islands rather than in lines. Low cushions of bright moss
creep out from the rock edges, tiny pale wildflowers cluster in the sheltered hollows, and
small weathered pebbles settle down into the turf. Every part of the surface stays flat and
walkable — the richness is in texture, colour and pattern, never in raised obstacles. Nothing
stands on the slab, no paths, no markings.

The slab edge is a narrow band, only about one twentieth of the slab's height, but it is
layered: an outermost lip of paler weathered stone catches the ambient light, and just inside
it a darker recessed groove of shadow separates the lip from the plain. Where the two meet,
a thin scatter of broken grit and small fallen shards has collected. The outline is straight
overall but never perfectly clean — the corners are slightly chipped and the edges nibbled
with small irregular breaks, as if the slab was sheared away long ago. The band is bare packed
soil over that same pale bedrock, the turf overhanging the lip in a ragged fringe with thin
pale roots trailing down across the stone.

The space around the slab is a deep, near-black void, quiet and almost empty: a sparse
scattering of small dim stars and only the faintest suggestion of distant grey dust, dark
enough that the green of the meadow is clearly the brightest thing in the image. No bright
nebula, no coloured clouds, no glowing debris, no lens flares, no highlights of any kind.

perfectly flat top-down orthographic view straight from above, no perspective, no horizon,
flat even ambient lighting with no directional shadows and no visible light source,
fine small-scale surface detail, nothing larger than a fist,
natural palette with living green grass, low contrast, evenly lit, nothing glows,
the slab is a wide flattened rectangle, eight units wide to five units tall, never square,
the slab and everything important stays within the central 80% of the width,
no characters, no objects, no units, no structures, no text, no user interface,
highly detailed photorealistic PBR game texture, AAA game environment asset,
3D render, tall vertical composition
```

#### 이 전문에서 꼭 남겨야 할 네 덩이

| | 왜 |
|---|---|
| **형태 두 문단** | 납작한 직사각형을 지키는 유일한 장치 — `never square`·`letterbox`·분수 위치 |
| **SC1 줄의 예외 표현** | `— but the grass itself is alive and healthy rather than dried out` · 이게 없으면 잔디가 마른다 |
| **초록 세 겹** | 한 가지 초록이면 인조 잔디로 보인다. `never neon`·`not a painted lawn` 도 함께 |
| **우주 문단** | `the brightest thing in the image` 가 판이라고 못박는다 — 번쩍임을 막은 것이 이 줄이다 |

| 설정 | 값 |
|---|---|
| 모델 | `gpt_image_2` |
| 비율 | **`9:16`** |
| 해상도 · 품질 | `4k` · `high` |

⭐ **후보 16 + 다듬은 4의 전문은 목업에 있다** — `docs/mock/nemo-bg-16.html` (복사 버튼 포함).
여기 문서에는 **채택된 것만** 전문으로 남긴다(두 벌이 되면 어긋난다).

#### 어디에 쓰이나 — **네모네모 전용이다**

`buildFloor()` 를 타는 것은 `drawMain()` 하나이고, 그 앞에서 샌드박스는 빠져나가고
오토배틀(`G.strike`)·던전(`js/09-dungeon.js`)·캠프(`js/19-camp.js`)는 각자 다른 렌더러다.
**다른 화면에 이 잔디가 새지 않는다.**

### 12-4. 기존 타일에서 관찰한 것 (2026-08-28 · 넷을 직접 열어 봄)

| 타일 | 본 것 |
|---|---|
| `badlands` | 아주 어두운 갈회색. 자갈이 **잘고 고르게** 흩어져 있다 |
| `ashworld` | 검은 암괴 + 주황 용암 균열. **발광이 가장 강하다** |
| `protoss_floor` | 검은 금속 패널의 **기하학 반복** + 가는 파란 선 |
| `desert` | ⚠ **혼자 밝고 채도가 높다.** `dark tones` 를 넣었는데도 그렇다 |

⭐ **공통점 넷** — ① 완전 수직 ② 방향 없는 균일광 ③ 잔 디테일 ④ 사진 같은 질감.
**이 넷이 「기존 스타일」의 정체**이고, 공통 블록이 지키는 것이 그것이다.

<details><summary>옛 타일 프롬프트 (참고 · 더 쓰지 않는다)</summary>

```
공통 3줄:
seamless tileable texture, top-down bird's eye view,
no characters no objects no units,
dark tones, game background tile, 3D render

badlands  dark brown gray rocky gravel ground, cracked dry earth texture,
          small scattered pebbles, uneven rough surface, dusty terrain
ashworld  dark volcanic rock ground with glowing lava cracks,
          fissures of orange red molten lava between rocks, charred black volcanic surface, ember glow
desert    sandy desert ground with fine sand texture, subtle wind ripple patterns in sand,
          small scattered rocks and pebbles, dark amber brown sandy surface, dry terrain
```

</details>

### 12-5. 레퍼런스 방법 — §11-1 과 같다

1. **기준 한 장**을 먼저 뽑는다(네모네모 바닥이 무난하다 — 흙·우주·용암이 다 들어간다).
2. 나머지는 그 이미지를 **첨부**하고 장면 줄만 바꾼다.

⛔ **스타일을 말로 다시 설명하지 말 것** — 레퍼런스가 정한다(§9-2 · §11-1 에서 같은 결론).

## 13. 오토배틀 전장 — 타일 계열 (2026-08-30)

> ⛔ **§12(통짜)와 정반대다.** 섞으면 둘 다 망가진다.

| | §12 네모네모 | **§13 오토배틀** |
|---|---|---|
| 월드 | 화면에 딱 맞는 판 하나 | **4800 × 4800px** |
| 카메라 | 고정 | **자유 이동 + 줌 1.2~2.5** |
| 방법 | **통짜 한 장** | **타일 반복** |
| 왜 | 판이 안 움직이니 한 장이면 된다 | 통짜면 2,300만 픽셀 — **불가능** |

### 13-1. 규격

| 항목 | 값 |
|---|---|
| 모델 | `gpt_image_2` · `1:1` · 1024~2048 · `high` |
| 지면 타일 | **1024 이상** — 화면에 460×scale 로 깔리고 줌 2.5·DPR 3 이면 517px 이 필요하다 |
| 데코 | 2×2 네 변형 · 잘라서 512 시트(칸 256)로 |

### 13-2. ⭐ 타일용 공통 블록 — §12 와 두 줄이 다르다

```
seamless tileable texture, edges match perfectly on all four sides,
perfectly flat top-down orthographic view straight from above, no perspective, no horizon,
flat even ambient lighting with no directional shadows and no visible light source,
fine small-scale surface detail, nothing larger than a fist,
muted earthy palette, low contrast, evenly lit, nothing glows,
no characters, no objects, no units, no structures, no text, no user interface,
highly detailed photorealistic PBR game texture, AAA game environment asset,
3D render, square tile
```

| | §12 통짜 | **§13 타일** |
|---|---|---|
| 첫 줄 | 없음 | **`seamless tileable texture`** |
| 끝 줄 | `tall vertical composition` | **`square tile`** |
| 형태·위치 지시 | 판의 비율·자리를 못박는다 | ⛔ **전부 뺀다** — 형태를 말하면 무늬가 깨진다 |

### 13-3. ⭐ 반복을 숨기는 법 — 이게 타일의 전부다

타일은 반드시 되풀이된다. **주기가 안 보이게** 만드는 것이 목표다.

#### ⛔ 벽돌 패턴은 쓰지 말 것 (2026-08-30 실패)

첫 시도는 벽돌식 석판이었는데 **가로 줄이 이어져 주기가 그대로 읽혔다.**
불규칙 판석(crazy paving)으로 바꾸니 사라졌다. 프롬프트에 넣은 세 줄이 결정적이었다:

| 넣은 말 | 왜 |
|---|---|
| `no rows, no grid and no long straight joints` | 줄이 있으면 눈이 주기를 바로 잡는다 |
| `no single stone should be memorable enough to notice when the texture repeats` | 눈에 띄는 돌 하나면 그것만 세어도 주기가 보인다 |
| `evenly distributed with no dominant feature and no directional bias` | 밝은 덩어리·한쪽 흐름이 있으면 격자처럼 읽힌다 |

#### ⭐ 매크로 오버레이 — 월드 전체에 얹는 얼룩 지도

타일만으로는 넓게 볼 때 균일해서 반복이 읽힌다. **월드 전체 크기의 부드러운 얼룩**을
`soft-light` 로 얹으면 지형에 지역성이 생긴다(`strikeDrawGround`).

⭐ 오버레이는 4800px 로 늘어나므로 **일부러 흐리게** 뽑는다 — 768px 이면 충분하다.
선명하면 타일과 싸워 지저분해진다. 프롬프트 핵심: `no small detail at all` · `softly blurred`.

### 13-4. 데코 스프라이트 — 배경색으로 자른다

바위·풀·뼈를 월드에 흩뿌린다(`strikeGenScenery` · 80개). 옛 선 그리기는 폴백으로 남아 있다.

#### ⭐ 배경은 **채도 높은 단색**, 물체마다 다르게

흙·돌·마른 풀·뼈는 전부 **채도가 낮다.** 그래서 「채도 높은 픽셀 = 배경」 한 줄로 갈린다.
⛔ 흰 배경은 쓰지 말 것 — 뼈·밝은 돌이 같이 날아가고 접지 그림자가 깎인다.

| 물체 | 물체 색 | 배경 | 왜 |
|---|---|---|---|
| 풀숲 | 짚노랑·올리브 | **마젠타** (255,0,255) | 노랑의 정반대 — 가장 까다로운 쪽에 최적을 준다 |
| 바위 | 회갈색 | **시안** (0,255,255) | 채도로 갈린다 |
| 뼈 | 회백색 | **파랑** (0,80,255) | 같은 이유 |

⭐ 셋을 다르게 두면 물체에 우연히 그 색이 섞여도 **다른 파일은 안 다친다.**

#### ⭐ 지면과 어울리게 하는 세 문장

색만 맞추면 **오려 붙인 것처럼** 보인다(2026-08-30 실제로 그랬다). 스타일까지 맞춰야 한다:

| 말 | 무엇을 고치나 |
|---|---|
| `part of the same photograph as the dry brown earth` | 오려 붙인 느낌 — **가장 센 한 줄** |
| `very low relief, half sunk into the soil with dirt banked up against its lower edge` | 얹힌 소품 → **박힌 것** |
| `the same fine dust film covers it that covers the ground` | 데코만 선명하던 것을 지면 쪽으로 끌어내린다 |

⛔ **crater 는 뺐다** — `radial streaks of ejected dust` 가 「털 난 구멍」으로 나왔다.

### 13-5. ⚠ 넣기 전에 **이음을 재라**

AI 는 `seamless` 를 말해도 자주 어긋난다. 눈으로는 잘 안 보이고 게임에서 줄로 나타난다.

**재는 법** — 왼끝↔오른끝(위끝↔아래끝) 픽셀 차이를 **내부 인접 열/행의 차이**와 비교한다:

| 이음 / 내부 | 판정 |
|---|---|
| < 2.2배 | ✅ 이어짐 |
| < 4배 | ⚠ 살짝 보임 |
| 그 이상 | ❌ 끊긴다 |

⭐ **끊겼으면 다시 뽑지 말고 잘라라.** 폭·높이를 조금씩 줄이며 이음이 최소인 지점을 찾으면
대개 맞는 크기가 나온다(벽돌 타일: 세로 33.9 → **995×820 으로 자르니 10.8**).
타일은 정사각일 필요가 없다 — 패턴은 가로 기준 균등 배율이라 비정사각도 정상 동작한다.

### 13-6. 채택된 프롬프트 전문

#### ① 통로 포장 — 불규칙 판석 (화면의 대부분)

```
A seamless square texture of an ancient courtyard paved with irregular flagstones, seen from
directly above. The stones are all different — some large and roughly square, some long and
narrow, some small wedges filling the gaps between bigger ones — fitted together in a random
interlocking pattern with no rows, no grid and no long straight joints running across the
surface. Every joint is short and changes direction, the way dry-laid crazy paving does.

The stone is grey-brown, weathered and dry, each slab a slightly different tone from cool
ash-grey through dun to a faint warm ochre, so no stone stands out as brighter or darker than
the rest. The joints between them are packed with dark soil and thin dry moss, and fine grit
and dust have settled along the edges. A few slabs are cracked or chipped, a few worn smooth,
but nothing is dramatic — no single stone should be memorable enough to notice when the
texture repeats.

In the background art style of StarCraft 1 from 1998 — flat even lighting, visible surface
grain, low contrast, no gloss and nothing that glows.

seamless tileable texture, edges match perfectly on all four sides,
the pattern is evenly distributed with no dominant feature and no directional bias,
perfectly flat top-down orthographic view straight from above, no perspective, no horizon,
flat even ambient lighting with no directional shadows and no visible light source,
fine small-scale surface detail, nothing larger than a fist,
muted earthy palette, low contrast, evenly lit, nothing glows,
no characters, no objects, no units, no structures, no text, no user interface,
highly detailed photorealistic PBR game texture, AAA game environment asset,
3D render, square tile
```

#### ② 바깥 지형 · ③ 매크로 오버레이

⭐ 지면은 §13-2 블록 + 「마른 흙 + 성긴 마른 풀」 장면 줄.
오버레이는 §13-3 의 원칙대로 **디테일 없이 부드러운 얼룩만** — 전문은
`docs/mock/` 가 아니라 이 문서가 단일 소스이므로, 다시 뽑을 때 §13-3 표를 보고 쓴다.

### 13-7. 코드가 쓰는 자리

| 파일 | 무엇 |
|---|---|
| `js/17-build-cards.js` | `strikeAssetsReady()` — **부팅 때 받지 않는다**(§12-6 과 같은 이유) · `STRIKE_DECO` 시트 |
| `js/18-strike.js` | `strikeDrawGround`(지형+오버레이) · `strikeDrawLane`(포장) · `strikeDrawScenery`(데코) |
| 타일 크기 | `STK_PAVE_TILE=460` — **단일 소스**(레인·소환 구역이 같이 쓴다) |

⛔ **레인·소환 구역에 어두운 seam 을 다시 긋지 말 것**(2026-08-30 제거). 레인은 `lineCap:'round'` 라
끝이 반원인데, 그 위를 같은 석판인 소환 구역이 덮으면서 **포장 한가운데 검은 곡선**만 남았다.
포장과 지형은 색·무늬가 달라 테두리 없이도 경계가 읽힌다.
