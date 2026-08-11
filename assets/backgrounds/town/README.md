# 마을 구역 그림

마을은 **두 벌**로 만든다. 바닥 한 장 위에 건물 스프라이트를 얹는 구조.

| 벌 | 파일 | 무엇 |
|---|---|---|
| ① 바닥 | `town_ground.webp` | 길·광장·빈 발판만. **건물 없음** |
| ② 건물 | `assets/buildings/town/tw_*.webp` | 구역마다 한 채, 투명 배경 |

둘을 나눈 이유: 구역 좌표는 앞으로도 조정된다. 바닥에 건물을 그려 넣으면
좌표를 옮길 때마다 바닥을 다시 뽑아야 한다.

## 규격

### ① 바닥
| 항목 | 값 |
|---|---|
| 파일명 | `town_ground.webp` |
| 권장 크기 | **1024 × 1536** (세로) |
| 비율 | **2:3** — 월드가 화면의 1.6 × 1.35배라 기기별로 0.66~0.68 사이 |
| 형식 | WebP q80, ~250KB 이하 |
| 적용 | `.twGround`의 반복 타일을 이 그림으로 교체 (`background-size:cover`) |

`.twGround`는 `.twWorld` 안에 있어 **카메라와 함께 움직인다.** 던전 배경과 달리
잘려서 안 보이는 영역이 없다 — 그림 전체가 언젠가는 화면에 들어온다.

### ② 건물
| 항목 | 값 |
|---|---|
| 파일명 | `tw_<구역키>.webp` (`plaza` `gacha` `gate` `gym` `gear` `charsel` `charmake`) |
| 배경 | **순수 검정** 위에 단일 오브젝트 → 테두리 flood-fill로 제거 후 투명 WebP |
| 최대 표시 크기 | 광장 140 × 120 · 나머지 130 × 100 |

구역 간격은 가로 150px · 세로 110px이다(월드 624 × 918 기준). 이보다 크게 그리면
위아래 건물이 겹친다.

## 구역 배치

```
                  상점 (50, 26)
    생성소 (26,38)            관문 (74,38)
                  광장 (50, 50)
    보관소 (26,62)            훈련장 (74,62)
                  장비 (50, 74)
```

광장은 `deco` — 누를 수 없는 지형지물이다. 캐릭터는 광장보다 62px 아래에서 시작한다.

## 카메라 각도

**던전 배경과 같은 각도여야 한다** — 바닥·건물·캐릭터가 한 장면으로 보이려면
셋이 같은 시점이어야 한다. 코드 값은 `VIEW_TILT = 0.65 rad`.

| 값 | 의미 |
|---|---|
| **37.2°** | 지면에서 올려다본 카메라 높이 — 정통 아이소메트릭 35.3°와 거의 같다 |
| **sin = 0.605** | 바닥의 원은 **세로 61% 납작한 타원**으로 보인다 |

- 완전 탑다운(90°)으로 뽑으면 건물만 사선이라 **바닥에서 떠 보인다**
- 지평선·하늘이 생기면 월드 밖 공간이 보여 버린다

---

# 프롬프트 쓰는 법

던전과 같은 규칙 — 블록 **두 개를 이어 붙인다.**

```
[요소 블록]  +  [공통 블록]        ← 이 순서로 붙일 것
```

> **순서 이유:** 대부분의 이미지 모델은 앞쪽 문장을 더 세게 반영한다.
> 공통 블록을 앞에 두면 각도는 맞는데 요소의 성격이 밍밍해진다.

공통 블록은 **절대 고치지 않는다.** 바닥이든 건물이든 이것을 뒤에 붙인다.

---

## 공통 블록 (고정 · 절대 수정 금지)

```
World and style: a small frontier settlement of a sci-fi colony, built from
angular armored metal panels, bolted plating and poured concrete, worn down by
dust and long use. Hard straight edges and chamfered corners, functional
military engineering, no decorative curves, no fantasy stonework, no wood, no
medieval architecture, no organic alien growth. Base palette brushed gunmetal
and cold steel blue, with weathered sand and rust as the only warm tones. Accent
light appears only as thin cyan and amber emissive strips, small and sparse,
never large glowing surfaces, never neon signage.

Camera and perspective: three-quarter overhead view, camera about 37 degrees
above the ground plane, a shallow angled look-down like a classic isometric RTS,
never a flat top-down, never a birds-eye floor plan, never a side or eye-level
view. Strong vertical foreshortening, the ground compressed to about 60 percent
in depth, so circles on the ground read as wide flat ellipses and square panels
read as flattened diamonds.

Lighting: even ambient light with a single consistent light direction from the
upper left, short soft shadows only, no long shadows, no light beams, no bright
white hotspots, no heavy contrast, dark to mid values overall so that small
bright labels and icons stay readable when layered on top.

Rendering: painterly stylized game art, soft low-contrast surface texture, clean
and readable at small size, no high-frequency noise, no photoreal detail, no
grain.

Never include: characters, creatures, people, vehicles, UI, HUD, icons, text,
letters, numbers, watermark, signature, logo, blur, depth of field, horizon,
sky, vignette, dark corners.
```

### 왜 이 문구들이 들어갔나
| 문구 | 이유 |
|---|---|
| `frontier settlement of a sci-fi colony` | 마을의 정체. 없으면 판타지 마을이나 현대 도시가 나온다 |
| `angular armored metal panels, chamfered corners` | `DESIGN.md`의 "각진 SF" — 게임 UI와 같은 언어 |
| `no fantasy stonework, no wood, no medieval` | 이미지 모델이 "village"에서 가장 먼저 꺼내는 것들 |
| `no organic alien growth` | 던전(저그계)과 섞이면 마을로 안 읽힌다 |
| `about 37 degrees above the ground plane` | `VIEW_TILT=0.65rad`. 안 맞으면 건물이 바닥에서 뜬다 |
| `compressed to about 60 percent in depth` | 부감의 실제 결과(sin 0.65 = 0.605). 없으면 원을 정원으로 그린다 |
| `single consistent light direction from the upper left` | **바닥과 건물 7채가 따로 뽑히므로** 광원 방향을 못 박아야 합쳐진다 |
| `thin cyan and amber emissive strips` | 액센트 색을 `DESIGN.md`(`#5cd6ff` 정보 · `#ffd24a` 재화)에 묶는다 |
| `dark to mid values` | 위에 라벨·캐릭터·펫이 올라간다. 밝으면 안 읽힌다 |
| `no vignette, no dark corners` | `.twGround::after`가 비네트를 또 씌운다. 두 겹이면 뭉갠다 |
| `soft low-contrast texture, no grain` | 고주파 노이즈는 30px 이모지·라벨과 싸운다 |

---

## 요소 블록 (하나씩 추가)

각 블록은 **그 요소만** 말하고, 끝에 공통 블록을 붙인다.
프레이밍 문장은 벌마다 다르므로 요소 블록 안에 넣는다.

### 바닥 — 프레이밍 문장
바닥 블록에는 반드시 아래를 포함시킨다.

```
Portrait 2:3 composition. The ground plane fills the entire frame edge to edge.
Seven flat empty landing pads arranged around a central plaza, connected by
worn paths; every pad left completely bare and unoccupied, no buildings, no
structures, no props standing on them.
```

> 발판을 **비워 두는 것**이 핵심이다. 건물은 별도 스프라이트로 얹는다.

### 건물 — 프레이밍 문장
건물 블록에는 반드시 아래를 포함시킨다.

```
A single isolated building centered on a pure flat black background, the whole
structure visible with clear margin on all four sides, nothing touching the
frame edges. No ground plane, no terrain, no cast shadow on the floor, no base
platform, no surrounding scenery.
```

> 바닥 그림자를 빼는 이유: 테두리 flood-fill로 검정을 지울 때 그림자가 같이
> 먹혀 지저분한 경계가 남는다. 접지 그림자는 코드에서 CSS로 넣는다.

### 블록 목록
| 키 | 구역 | 상태 |
|---|---|---|
| `town_ground` | 바닥 | 미작성 |
| `plaza` | 광장 | 미작성 |
| `gacha` | 상점 | 미작성 |
| `gate` | 관문 | 미작성 |
| `gym` | 훈련장 | 미작성 |
| `gear` | 장비 | 미작성 |
| `charsel` | 보관소 | 미작성 |
| `charmake` | 생성소 | 미작성 |

---

## 네거티브만 따로 쓸 때
네거티브 칸이 있는 툴(SD·Flux 계열)이면 공통 블록에서 `Never include:` 문단을
빼고 아래를 네거티브 칸에 넣는 편이 더 잘 먹는다.

```
characters, creatures, monsters, people, units, vehicles, UI, HUD, icons, text,
letters, numbers, watermark, signature, logo, flat top-down view, straight
overhead, birds eye map, floor plan, flat lay, side view, eye level, horizon,
sky, distant background, vignette, dark corners, harsh shadows, long shadows,
strong directional light, high contrast, blur, depth of field, grain, noise,
fantasy village, medieval, stone masonry, wooden houses, thatched roof, neon
signage, organic alien growth
```

## 뽑은 뒤 확인
1. **바닥을 먼저 뽑는다.** 발판 위치·조명·색조가 정해져야 건물을 거기에 맞출 수 있다
2. 건물이 바닥에서 떠 보이면 → 그림이 너무 탑다운. 공통 블록을 앞으로 옮겨 다시 뽑는다
3. 건물끼리 광원이 어긋나면 → `from the upper left`가 안 먹힌 것. 요소 블록 끝에 한 번 더 쓴다
4. 라벨이 안 읽히면 → 그림이 밝은 것. `.twGround`의 어두운 막(현재 62~72%)을 올린다
