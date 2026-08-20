# 네모네모 디펜스 (StarCraft 모바일 유즈맵)

모바일 타워디펜스 게임. 사각 트랙을 도는 적을 막는다.

- 게임 본체: `sc-ums-web.html`(마크업) + `css/`(5) + `js/`(19) — **빌드 불필요**, 태그 순서대로 로드된다.
  - 어느 파일을 고쳐야 하는지는 `ARCHITECTURE.md` §1 「파일 지도」.
- 3D 모델/타일: `assets/`
- Vercel **정적 배포**. `vercel.json` rewrite로 루트(`/`)에서 게임이 열림.
- 직접 경로 `…/sc-ums-web.html` 로도 접속 가능.

## 로컬 실행
정적 서버면 무엇이든 가능. 예) `npx serve -l 3000` 후 `http://localhost:3000`.
