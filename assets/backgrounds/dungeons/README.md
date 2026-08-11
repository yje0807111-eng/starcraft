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

# 프롬프트 쓰는 법

블록 **두 개를 이어 붙인다.** 공통 블록은 절대 고치지 않고, 던전 블록만 갈아 끼운다.

```
[던전 블록]  +  [공통 블록]        ← 이 순서로 붙일 것
```

> **순서 이유:** 대부분의 이미지 모델은 앞쪽 문장을 더 세게 반영한다.
> 공통 블록을 앞에 두면 각도는 잘 나오는데 던전 색깔이 밍밍해진다.
> 던전을 먼저 말하고 카메라·구도를 뒤에서 규정하는 쪽이 둘 다 산다.

네거티브는 공통 블록 안에 다 들어가 있다(`no ~` 형태). 쓰는 툴에 네거티브 칸이
따로 있으면 맨 아래 「네거티브만 따로 쓸 때」를 참고해 떼어 쓰면 더 잘 먹는다.
미드저니는 끝에 `--ar 1:1` 을 붙일 것.

---

## 공통 블록 (고정 · 절대 수정 금지)

```
Camera and framing: three-quarter overhead view, camera about 37 degrees above
the ground plane, a shallow angled look-down like a classic isometric RTS, never
a flat top-down, never a birds-eye floor plan, never a side or eye-level view.
The ground plane fills the entire frame: no horizon, no sky, no distant
background, no walls closing off the frame. Strong vertical foreshortening, the
ground compressed to about 60 percent in depth, so circles on the floor read as
wide flat ellipses and square panels read as flattened diamonds. Composition: a
wide open uncluttered clearing in the very center, everything arranged in a ring
toward the outer edges, nothing crossing the middle, no centered focal object, no
frame, no border. Lighting: even ambient light with short shadows falling in one
consistent direction, no vignette, no dark corners, no long shadows, no light
beams, no bright white hotspots, no heavy contrast, dark to mid values overall.
Style: soft low-contrast surface texture, painterly stylized game art, a clean
background plate for a mobile game, no characters, no creatures, no people, no
vehicles, no UI, no HUD, no icons, no text, no letters, no numbers, no watermark,
no signature, no logo, no blur, no depth of field. Square 1:1 composition.
```

### 왜 이 문구들이 들어갔나
| 문구 | 이유 |
|---|---|
| `about 37 degrees above the ground plane` | 유즈맵 `VIEW_TILT=0.65rad`과 같은 각. 안 맞으면 유닛이 바닥에서 뜬다 |
| `like a classic isometric RTS, never a flat top-down` | 숫자만으로는 잘 안 먹혀서 익숙한 레퍼런스와 부정을 같이 준다 |
| `compressed to about 60 percent in depth` · `wide flat ellipses` | 부감의 실제 결과(sin 0.65 = 0.605). 없으면 원을 정원으로 그려 버린다 |
| `no horizon, no sky` | 사선인데 지평선까지 생기면 화면 밖 공간이 보여 버린다 |
| `open uncluttered clearing in the very center` | 한가운데는 캐릭터·적·수비 링이 덮는다 |
| `ring toward the outer edges` | 그런데 바깥 22%는 접으면 잘린다 → 디테일은 그 사이 고리에 |
| `short shadows in one consistent direction` | 사선 뷰의 입체감은 그림자가 만든다. 단 길면 유닛 스프라이트와 싸운다 |
| `no vignette, no dark corners` | 코드가 비네트를 또 씌운다. 두 겹이면 가장자리가 뭉갠다 |
| `dark to mid values` | 밝으면 유닛·데미지 숫자가 안 읽힌다 |
| `soft low-contrast texture` | 고주파 노이즈는 작은 스프라이트와 싸운다 |

---

## 던전 블록

각 블록은 **그 던전만** 말한다. 위 공통 블록을 뒤에 붙여서 쓴다.

### dg1 — 감염된 둥지 (저그계 · 첫 던전)
> 첫 화면이라 **가장 읽기 쉬워야 한다.** 디테일을 욕심내지 말고 바닥 질감 위주로.

```
An infested alien hive floor: organic creep membrane ground with pulsing veins,
dormant spore sacs and low chitin ridges. Bare open creep at the center, growths
and debris only around the outer ring. Sickly green and dull violet palette.
```

### dg2 — 버려진 전초기지 (인간계)
> 직선 패널이라 격자가 규칙적이면 타일처럼 보인다 → 녹·얼룩으로 불규칙하게.
> 부감이라 패널 이음새는 **가로로 눌린 마름모**로 나와야 정상.

```
An abandoned military outpost yard: rusted metal deck plating with cracked
panels, irregular rust stains, spilled supply crates and faded yellow hazard
stripes. Bare open deck at the center, crates and wreckage only around the outer
ring. Cold steel blue and rust orange palette.
```

### dg3 — 잊혀진 회랑 (초월계)
> 발광 문양이 밝게 튀기 쉬워 `faintly`·`dim`으로 눌러 놓았다.
> 부러진 기둥은 **밑동만** — 높으면 37° 부감에서 바닥을 다 가린다.

```
A forgotten alien corridor floor: polished dark stone with inlaid faintly glowing
glyph lines, fine gold seams and worn hairline cracks. Plain open stone at the
center, rune circles and low broken pillar stumps only around the outer ring.
Deep indigo and dim cyan palette.
```

> **dg1~dg3 완료** — 2048² 원본을 1024 · WebP q80으로 넣었다(177/124/99KB).
>  중앙 40% 평균 밝기 24 / 25 / 18% 로 셋 다 유닛이 잘 읽힌다.

### dg4 — 산란장 (저그계)
> dg1과 같은 저그계라 **구분되게** — dg1은 마른 크립, 여기는 젖은 살덩이.

```
An alien spawning ground: living fleshy tissue floor with clustered eggs, taut
sinew strands and a wet sheen across the surface. Bare open flesh at the center,
egg clusters and membrane growths only around the outer ring. Bile yellow and
dark green palette.
```

### dg5 — 폐쇄된 시설 (인간계)
> 실내라 **천장·벽이 딸려 나오기 쉽다.** 나오면 "floor only"를 한 번 더 붙일 것.
> 비상등은 바닥에 박힌 띠로 — 공중에 달면 광원이 생겨 공통 블록과 싸운다.

```
A sealed underground facility floor: poured concrete and steel grating with
drainage channels, scuff marks and dim red emergency light strips set flush into
the floor. Bare open concrete at the center, machinery and toppled barrels only
around the outer ring. Gunmetal grey and amber palette.
```

### dg6 — 봉인된 성소 (초월계)
> dg3과 같은 초월계 → dg3은 차가운 남색, 여기는 **따뜻한 금빛**으로 갈랐다.
> 부유석은 **바닥에 낮게** — 높이 띄우면 부감에서 바닥을 가린다.

```
A sealed alien sanctum floor: carved luminous marble with rune circles, fine gold
filigree and small stone shards hovering low just above the ground. Plain open
marble at the center, altars and shards only around the outer ring. Royal purple
and warm gold palette.
```

### dg7 — 군단의 심장 (저그계 · 가장 화려)
> **용암빛이 밝게 터지기 쉽다.** 발광을 바깥 고리에 가두는 문장을 넣어 뒀다.
> 나온 게 눈부시면 `faint`를 `very faint`로 바꿔 다시 뽑을 것.

```
The heart of a swarm chamber: raw muscle and bone plating floor with pulsing
arteries and faint magma fissures, the glow kept dim and confined to the outer
ring. Bare open flesh at the center, bone ribs and vents only around the outer
ring. Blood red and ember orange palette.
```

### dg8 — 함대 정박지 (인간계)
> 정박지라 **우주·별하늘이 딸려 나오기 쉽다.** 공통 블록의 `no sky`가 막아 주지만,
> 그래도 나오면 던전 블록 끝에 `the deck fills the whole frame`을 덧붙일 것.

```
An orbital fleet dock deck: riveted hull plating with painted landing markings,
cable runs and hull seams. Bare open deck at the center, gantries, cargo crates
and mooring clamps only around the outer ring. Dark navy and white marking paint
palette.
```

### dg9 — 공허의 문 (초월계)
> 균열이 화면을 가로지르기 쉽다 → `not crossing the center`를 명시했다.

```
A void gate platform: fractured obsidian slab floor with purple rift cracks that
stay near the edges and never cross the center, and small weightless shards
drifting low above the surface. Plain open obsidian at the center, cracks and
floating debris only around the outer ring. Violet and black palette with faint
cyan sparks.
```

### dg10 — 심연 (최종)
> **가장 어둡다.** 코드 비네트가 겹치면 가장자리가 뭉갤 수 있다 —
> 넣어 보고 어두우면 `HB_BG_VIG_A`(기본 0.62)를 내린다.

```
An abyssal depths floor: black rippling liquid with submerged eyes, slow tendrils
and faint bioluminescence glowing under the surface. Bare open water at the
center, tendrils and glowing shapes only around the outer ring. Near-black
palette with pale teal glow.
```

### 던전끼리 안 겹치게 (뽑고 나서 확인)
같은 종족이 3개씩 있어서 색이 겹치면 "같은 데"로 보인다. 이미 갈라 뒀다:

| 종족 | 던전 | 색 |
|---|---|---|
| 저그계 | dg1 마른 크립 · dg4 젖은 살 · dg7 붉은 살+용암 | 초록 → 노랑 → 빨강 |
| 인간계 | dg2 야외 갑판 · dg5 실내 콘크리트 · dg8 우주 도크 | 청회색 → 회색+호박 → 남색 |
| 초월계 | dg3 차가운 남색 · dg6 따뜻한 금빛 · dg9 보랏빛 균열 | 남색 → 금색 → 보라 |

---

## 네거티브만 따로 쓸 때
네거티브 칸이 따로 있는 툴(SD·Flux 계열)이면, 공통 블록에서 `no ~` 구절을 빼고
아래를 네거티브 칸에 넣는 편이 더 잘 먹는다.

```
characters, creatures, monsters, people, units, vehicles, UI, HUD, icons, text,
letters, numbers, watermark, signature, logo, flat top-down view, straight
overhead, birds eye map, floor plan, flat lay, side view, eye level, horizon,
sky, distant background, walls closing the frame, vignette, dark corners, harsh
shadows, long shadows, strong directional light, high contrast, busy center,
centered focal object, frame, border, blur, depth of field
```

---

# 움직이는 배경 (선택)

정지 그림 위에 **4프레임 크로스페이드**를 얹으면 살아 숨쉬는 화면이 된다.
`dgN_f1.webp` … `dgN_f4.webp` 를 넣으면 자동으로 켜지고, 없으면 정지 그림 그대로다.

```
1 → 2 → 3 → 4 → 3 → 2 → (반복)      HB_BG_CYCLE = 8초에 한 왕복
```

**핑퐁으로 도는 이유:** 영상의 마지막 프레임과 첫 프레임은 보통 다르다. 순환(4→1)하면
그 지점에서 툭 튄다. 왕복하면 어떤 영상을 넣어도 이음새가 없다.

| | 값 |
|---|---|
| 파일 | `dgN_f1.webp` ~ `dgN_f4.webp` (1024², q80) |
| 던전당 용량 | 약 500KB |
| 프레임 비용 | 측정 노이즈 이하 (60fps 유지, A/B 확인) |
| 넷 중 하나라도 없으면 | 정지 그림으로 폴백 (깜빡임 없음) |

> ⚠ **전체 화면을 초당 여러 장으로 자르지 말 것.** 1024² 한 장이 디코딩되면 4MB라,
> 32장이면 134MB다(모바일에서 죽는다). 4장 = 16MB가 상한선이라고 보면 된다.

## 화질 — 1024px / q80 (실측 근거)

| | 값 |
|---|---|
| 크기 | **1024 × 1024** |
| 품질 | **q80** (webp) |
| 한 장 | 약 180KB |
| 던전당(정지+4프레임) | 약 900KB — 지금 들어간 던전만 받는다 |

**1024인 이유:** 배경이 실제로 그려지는 크기를 재 보면 기기와 무관하게 890~986 기기픽셀이다
(캔버스 DPR이 2로 상한이 걸려 있고 폰 프레임 폭이 정해져 있다). 1024면 거의 1:1이고,
2048은 절반이 그냥 버려진다. 반대로 512로 줄이면 눈에 띄게 무너진다.

| 크기·품질 | 용량 | PSNR |
|---|---|---|
| 512 q80 | 42KB | 28.8 ← 해상도 부족 |
| 1024 q70 | 130KB | 33.8 |
| 1024 q75 | 139KB | 34.0 |
| **1024 q80** | **177KB** | **35.0** |
| 1024 q85 | 222KB | 35.7 |
| 1024 q90 | 292KB | 36.5 |

**q80인 이유:** 화면의 81%가 어두운 평탄부라 밴딩이 잘 보인다. q75→q80이 38KB에 +1.0dB로
가장 크게 오르고, 그 위는 용량만 는다.

**프레임도 같은 q80.** 두 장을 겹치면 압축 잡음이 상쇄돼 +2.86dB를 벌지만, 위상 곡선이
0/1 근처에 더 오래 머물러 **한 장만 보이는 순간이 품질 하한**이다. 이 이득을 화질을 낮추는
데 쓰면 그 순간에 티가 난다.

> 정지 그림 는 **프레임을 넣었다면 없어도 된다** — 첫 프레임이 오는 즉시 그것을
> 바탕으로 쓴다. 프레임이 없는 던전에만 필요하다.

## 영상에서 프레임 뽑기
AI 영상 도구에 정지 그림(`dgN.webp`)을 넣어 **미세하게 움직이는 3~6초** 클립을 만든 뒤:

```bash
node scripts/video-frames.mjs C:/Users/Home/Downloads/dg1.mp4 1
```

- ffmpeg 없이 크롬 디코더로 뽑는다. mp4 / webm / mov 지원
- 전 구간을 균등하게 4등분해서 샘플링하고, 1:1이 아니면 가운데를 잘라 정사각으로
- 시크를 안 쓰고 재생하면서 잡는다 — 색인이 없는 영상(녹화본 등)도 된다
- `scripts/`는 저장소에서 제외돼 있다(로컬 전용 도구)

**영상 프롬프트:** 정지 그림을 그대로 두고 움직임만 요청한다.

```
Keep the camera locked and the composition identical, no camera movement, no zoom,
no pan. Only subtle ambient motion: slow drifting haze, faint pulsing glow, gentle
surface shimmer. Nothing enters or leaves the frame. Seamless subtle loop.
```

## 넣은 뒤 확인
1. 파일을 이 폴더에 두고 앱에서 해당 던전 진입
2. **유닛이 바닥에서 떠 보이면** → 그림이 너무 탑다운. 공통 블록을 앞으로 옮겨 다시 뽑는다
3. 유닛이 안 읽히면 → 그림이 밝은 것. 다시 뽑거나 `HB_BG_VIG_A`(기본 0.62)를 올린다
4. 가운데가 복잡하면 → 던전 블록의 디테일을 줄이고 `only around the outer ring`을 강조
