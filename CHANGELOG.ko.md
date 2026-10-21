# 변경 내역

[English](CHANGELOG.md) · 한국어

버전은 SemVer를 따른다. 날짜는 YYMMDD.

### v0.1.2 (261021)

- 이름을 보이는 모든 곳에서 다시 **DeckWright** 로 쓴다: README, 설명서, 규약, 플레이어, 발표자 창, 도움말, 명령줄 메시지. `inject` 결과 파일은 `<이름>_DeckWright.html`. 명령어, 패키지, 플러그인, 저장소 이름은 소문자 그대로다(`deckwright`, `deckwright@deckwright`, `grotyx/deckwright`).
- 스크린샷을 다시 찍고, README 저자 부분을 항목마다 한 줄씩 정리했다.

### v0.1.1 (261021)

문서 정비와 다듬기.

- README(영어·한국어)를 스크린샷과 함께 새로 썼다. 두 언어의 사용 설명서(`docs/manual.md`, `docs/manual.ko.md`)와 이 변경 내역을 추가했다.
- 로고(`assets/logo.svg`, `assets/logo-dark.svg`)를 만들어 플러그인 아이콘과 GitHub Pages에 썼다.
- 수정: 런타임의 단축키 도움말과 도구 막대가 `card`, `num`, `sw`, `swb` 라는 클래스 이름을 써서, 덱의 `.card` 스타일(AI 덱에 흔하다)이 도움말 상자를 늘려 놓을 수 있었다. `hdek-card`, `hdek-num`, `hdek-sw`, `hdek-swb` 로 바꿨다.
- 수정: 제목을 `<br>` 로 줄바꿈한 슬라이드("deckwright<br>presentation runtime")가 슬라이드 목록에서 단어가 붙어 보였다. 줄바꿈을 공백으로 읽는다.
- 데모 덱: 뒤집기 카드가 인쇄에서 좌우 반전되어 나오지 않게 했다.
- GitHub Actions가 push 할 때마다 테스트를 돌린다.

### v0.1.0 (261021)

첫 공개 릴리스.

- 런타임: 효과가 있는 클릭 단계, 애니메이션을 다시 돌리지 않는 뒤로 가기, 발표자 창(현재·다음 화면, 노트, 경과·남은 시간, 슬라이드 목록), 양쪽 화면에 보이는 펜·형광펜·레이저·지우개, 검은·흰 화면, 브라우저가 지원하면 보조 모니터 전체화면, 모든 단계가 펼쳐진 `Ctrl/⌘+P` 인쇄.
- 규약 없는 덱: 자체 이동 엔진이 있는 덱은 그 엔진을 조종하고, 고정 크기 슬라이드를 쌓은 문서는 화면에 맞추고, reveal.js 덱을 인식하고, `.notes`·`aside.notes` 를 노트로 읽는다.
- 명령줄 도구: `inject`, `build`, `pack`, `unpack`, `check`, `export`(PDF, PPTX, PNG), `runtime`.
- `.hdek` 패키지 형식(규약 hdek/1)과 끌어다 놓는 플레이어.
- 에이전트 스킬, Claude Code 플러그인·마켓플레이스 매니페스트, `npx skills` 지원, claude.ai 용 스킬 zip.
- 화면 문구와 명령줄 메시지 한국어·영어 지원.
