<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="200" alt="DeckWright, 강당 뒤편의 그 음향·영상 담당자">
  </picture>
</p>

<h1 align="center">DeckWright</h1>

<p align="center">
  <em>슬라이드는 청중의 화면에, 노트는 내 화면에.</em>
</p>

<p align="center">
  <a href="https://github.com/grotyx/deckwright/actions/workflows/tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/grotyx/deckwright/tests.yml?style=flat-square&color=111111&label=tests" alt="Tests"></a>
  <img src="https://img.shields.io/badge/version-0.2.0-111111?style=flat-square" alt="Version 0.2.0">
  <img src="https://img.shields.io/badge/node-18%2B-111111?style=flat-square" alt="Node 18+">
  <img src="https://img.shields.io/badge/runs%20in-any%20browser-111111?style=flat-square" alt="Runs in any browser">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT">
</p>

<p align="center">
  <strong>클릭 단계 &middot; 발표자 창 &middot; 펜 &middot; PDF 인쇄 &middot; HTML 파일 하나, 설치도 인터넷도 필요 없음</strong><br>
  <sub>AI가 만든 HTML 발표 자료를 PowerPoint처럼 발표한다. Claude Code, Codex, Cursor, claude.ai 에서 스킬로 쓴다.</sub>
</p>

<p align="center">
  <sub><a href="https://grotyx.github.io/deckwright/demo.html">데모</a> &middot; <a href="docs/manual.ko.md">사용 설명서</a> &middot; <a href="SPEC.ko.md">규약</a> &middot; <a href="CHANGELOG.ko.md">변경 내역</a> &middot; <a href="README.md">English</a></sub>
</p>

---

잘 운영되는 학회장 뒤편에는 늘 그 사람이 있다. 세션이 시작되기 전에 발표자 노트는 연단 노트북에, 슬라이드는 큰 화면에만 띄워 둔다. 클리커는 처음 누를 때부터 먹힌다. 한 장 뒤로 가도 애니메이션이 처음부터 다시 돌지 않는다. 화면에 동그라미를 치면 강당 전체가 그걸 본다.

요즘 AI는 웬만한 PowerPoint보다 보기 좋은 슬라이드를 HTML로 만든다. 그런데 그 파일을 연단에서 열면 그 사람이 없다. 브라우저 탭 하나, 노트도 다음 슬라이드도 없고, 클리커를 누르면 페이지가 스크롤된다.

DeckWright는 그 사람을 HTML 파일 안에 넣는다.

<table>
  <tr>
    <td width="50%" align="center"><img src="docs/images/ko/presenter.png" alt="발표자 창"><br><b>노트북에는 발표자 창</b></td>
    <td width="50%" align="center"><img src="docs/images/en/ink.png" alt="슬라이드 위 필기"><br><b>펜, 형광펜, 레이저</b></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="docs/images/en/print.png" alt="모든 단계가 펼쳐진 인쇄"><br><b>Ctrl+P: 슬라이드당 한 쪽, 모든 단계 펼침</b></td>
    <td width="50%" align="center"><img src="docs/images/ko/player.png" alt="플레이어"><br><b>.hdek 패키지와 폴더를 여는 플레이어</b></td>
  </tr>
</table>

## 쓰기 전 / 쓴 후

AI가 만든 `talk.html` 이 있다. DeckWright 없이 더블클릭하면 브라우저 탭으로 발표하게 된다. 노트는 종이에 적어 두고, PageDown을 누르면 다음 장 대신 페이지가 내려가고, 뒤로 가면 애니메이션이 처음부터 다시 돈다.

DeckWright를 쓰면:

```text
$ deckwright inject talk.html
✓ talk_DeckWright.html (double-click it next to the original)
```

새 파일을 더블클릭하고 `S` 를 누른 뒤, 청중 창을 프로젝터 쪽으로 끌어다 놓고 그 창에서 `F` 를 누른다. 노트북에는 현재 화면, 다음 단계, 노트, 시계가 보이고 프로젝터에는 슬라이드만 나간다. 원본 `talk.html` 은 그대로다.

## 동작 방식

```text
 talk.html  +  런타임 (파일 안, 약 85KB, 네트워크 없음)
      │
      ├─▶ 청중 창: 슬라이드만, 프로젝터에
      └─▶ 발표자 창: 현재 · 다음 · 노트 · 타이머 · 펜, 노트북에

 런타임이 덱을 읽는 방식
      ├─ DeckWright 규약 덱: 단계와 노트를 정확히 (data-slide, data-step)
      ├─ 자체 이동 엔진이 있는 덱: 키로 조종, 덱의 애니메이션 그대로
      └─ 고정 크기 슬라이드 문서, reveal.js: 한 장씩 화면에 맞춰 보여 줌
```

| 약속 | 방법 |
|---|---|
| 뒤로 가도 애니메이션이 다시 돌지 않는다 | 모든 화면은 `(슬라이드, 단계)`. 뒤로 가면 그 단계의 최종 모습으로 바로 바뀐다 |
| 발표자 창 미리보기가 프로젝터 화면과 똑같다 | 같은 덱을 미리보기 모드로 한 번 더 띄운다. CSS, JS, 영상까지 같다 |
| 클리커가 먹힌다 | 방향키, PageUp/PageDown, F5, 검은 화면 버튼, 휠, 클릭 |
| 와이파이가 없어도 깨지지 않는다 | `build` 가 모든 자원을 파일 안에 넣는다. `check` 가 CDN·웹폰트를 경고한다 |
| 필기가 그 자리에 남는다 | 슬라이드마다 저장되고, 양쪽 화면에 보이고, 새로고침해도 남는다 |
| 유인물에 모든 단계가 들어간다 | `Ctrl/⌘+P` 로 각 슬라이드의 최종 모습을 한 쪽씩 인쇄 |
| 원본은 안전하다 | `inject`, `build` 는 옆에 새 파일을 만든다 |

## 설치

방법은 넷, 스킬은 하나. 하나만 고르면 된다.

**A. Claude Code 플러그인.**

```sh
claude plugin marketplace add grotyx/deckwright
claude plugin install deckwright@deckwright
```

업데이트: `claude plugin marketplace update deckwright && claude plugin update deckwright@deckwright`

**B. 스킬을 읽는 에이전트 전부** (Claude Code, Codex, Cursor, opencode 등).

```sh
npx skills add grotyx/deckwright        # 이 프로젝트에만
npx skills add grotyx/deckwright -g     # 모든 프로젝트에
```

**C. claude.ai.** [deckwright-skill.zip](https://grotyx.github.io/deckwright/deckwright-skill.zip) 을 받아 설정 → 기능 → 스킬에서 올린다(코드 실행이 켜져 있어야 함).

**D. AI 없이.** [player.html](https://grotyx.github.io/deckwright/player.html) 을 열고 덱을 끌어다 놓은 뒤 *발표 시작*. 명령줄 도구만 쓰려면 `npm install -g github:grotyx/deckwright`.

## 채팅에서 쓰기

| 이렇게 말하면 | 이렇게 된다 |
|---|---|
| "이 HTML 덱 발표할 수 있게 해 줘" | 원본 옆에 런타임을 넣은 사본 `talk_DeckWright.html` |
| "OO 주제로 15분 발표를 DeckWright 덱으로 만들어 줘" | 규약을 따르는 새 덱. 클릭 단계, 슬라이드마다 노트, 목표 시간. 점검 후 파일 하나로 빌드 |
| "메일로 보낼 수 있게 파일 하나로 만들어 줘" | 그림·폰트·영상을 모두 넣은 `.html` 한 개 |
| ".hdek 으로 묶어 줘" | 영상이 큰 덱용 ZIP 패키지. 플레이어로 연다 |
| "PDF랑 PPTX 백업 만들어 줘" | PPTX·PDF만 받는 학회용. 슬라이드별 최종 화면, 노트는 PPTX 노트로 |
| "발표 전에 덱 점검해 줘" | 외부 CDN, 웹폰트, 없는 파일, 노트 없는 슬라이드 |

## 발표할 때

| 동작 | 키 |
|---|---|
| 다음 / 이전 | `→` `Space` `PageDown` 클릭 휠 / `←` `PageUp` |
| *n* 번 슬라이드로 | 숫자 *n* 입력 후 `Enter` |
| 발표자 창 | `S` |
| 프로젝터 전체화면 | `F` (클리커의 `F5`) |
| 검은 / 흰 화면 | `B` / `W` |
| 펜, 형광펜, 레이저, 지우개 | `D` `H` `L` `E`, 펜 태블릿은 바로 필기, `C` 지우기 |
| PDF 인쇄 | `Ctrl/⌘+P` |
| 전체 단축키 | `?` |

화면 문구는 브라우저 언어에 따라 한국어나 영어로 나온다.

## 명령어

| 명령 | 하는 일 |
|---|---|
| `deckwright inject <파일.html>` | 원본 옆에 런타임을 넣은 사본. 그림·영상은 원래 폴더에서 읽는다 |
| `deckwright build <입력> [-o talk.html]` | 런타임과 모든 자원을 넣은 단독 HTML (기본: 입력 옆에 `<이름>_single.html`) |
| `deckwright pack <입력> [-o talk.hdek]` | 영상이 크거나 파일이 많을 때 쓰는 `.hdek` 패키지(ZIP) |
| `deckwright unpack <talk.hdek> -o 폴더` | 패키지 풀기 |
| `deckwright check <입력>` | 슬라이드, 단계, 노트, 외부 참조, 없는 파일 점검 |
| `deckwright export <입력> --pdf a.pdf --pptx a.pptx --png 폴더/` | 슬라이드별 최종 화면을 PDF, PPTX, PNG로 (Playwright 필요, 슬라이드당 대기 `--wait 400` ms) |
| `deckwright runtime -o file.js` | 런타임 스크립트만 꺼내기 |

`<입력>` 은 HTML 파일, `index.html` 이 있는 폴더, `.hdek` 파일 중 하나다. 덱 폴더 밖의 파일은 읽지 않는다. 위쪽 폴더의 그림을 쓰는 덱이면 `--root <그 폴더>` 를 붙인다. 전역 설치 없이 쓰려면 저장소나 설치된 스킬 폴더에서 `node skills/deckwright/scripts/deckwright.mjs` 로 실행한다. 명령줄 메시지도 시스템 언어를 따른다(`DECKWRIGHT_LANG=ko` 로 고정).

## 규약

규약을 따르면 단계와 노트가 정확해진다. 따르지 않은 덱은 자동으로 인식한다.

```html
<main data-hdek data-width="1920" data-height="1080" data-duration="15">
  <section data-slide="results">
    <h2>결과</h2>
    <p data-step data-effect="rise">클릭하면 나타남</p>
    <aside class="notes">여기서 할 말.</aside>
  </section>
</main>
<script src="deckwright-runtime.js" data-hdek-runtime></script>
```

효과, 숫자·차트용 JS 훅, 이벤트, `.hdek` 형식, 다른 덱을 인식하는 방법: [SPEC.ko.md](SPEC.ko.md)

## 자주 묻는 질문

**덱을 다시 만들어야 하나?** 아니다. AI가 만든 덱은 대부분 그대로 된다. `inject` 가 사본에 런타임만 넣는다. 규약은 단계와 노트를 정확하게 만들 뿐이다.

**밖으로 나가는 데이터가 있나?** 없다. 런타임은 네트워크 요청을 하지 않고, 명령줄 도구는 내 컴퓨터의 파일만 읽고 쓴다.

**학회장 PC에서도 돌아가나?** 최신 Chrome, Edge, Firefox, Safari면 된다. 내 노트북을 연결할 수 없고 PPTX·PDF만 받는 자리라면 `export` 로 백업을 만든다.

**`.hdek` 은 뭔가?** 매니페스트, 덱, 자원을 담은 ZIP이다. 슬라이드판 EPUB이라고 보면 된다. 확장자를 `.zip` 으로 바꾸면 어디서든 열린다.

**왜 "DeckWright"인가?** Deck + *wright*. wright 는 playwright(극작가), shipwright(조선공)처럼 무언가를 공들여 만드는 사람을 뜻하는 옛말이다. 같은 저자의 [manuwright](https://github.com/grotyx/Academic_writing_c_claudecode), [Refwright](https://github.com/grotyx/rag-obsidian) 와 이름을 같이 쓴다.

## 알려진 한계

- `F` 로 전체화면 창을 보조 모니터로 자동으로 옮기는 기능은 Chrome/Edge의 Window Management API를 쓰고 처음에 권한을 한 번 묻는다. 안 되면 창을 끌어다 놓고 `F`.
- 발표자 창 미리보기는 덱을 두 번 더 띄운다. 아주 무거운 덱이면 *미리보기* 버튼으로 실시간 미리보기를 끈다.
- 영상 재생 위치는 프로젝터와 미리보기 사이에 맞추지 않는다(미리보기 영상은 음소거).
- 덱이 자체 `setTimeout` 으로 돌리는 애니메이션은 뒤로 갈 때 바로 끝낼 수 없다. 규약의 `setStep` 훅을 쓰면 된다.
- 플레이어는 덱의 스크립트를 자기 페이지에서 실행한다. HTML 파일을 직접 여는 것과 같으니, 믿을 수 있는 사람이 만든 덱만 연다.

## 문서

[사용 설명서](docs/manual.ko.md) &middot; [규약 (hdek/1)](SPEC.ko.md) &middot; [스킬 지시문](skills/deckwright/SKILL.md) &middot; [변경 내역](CHANGELOG.ko.md)

개발: `npm run build` 로 플레이어·데모·스킬 zip을 다시 만들고, `npm test` 로 Chromium·명령줄 검사 87개를 돌린다. 코드 리뷰에서 찾은 결함마다 회귀 테스트가 들어 있다(Python용 Playwright, `pdfplumber`, `python-pptx` 필요).

## 저자

**박상민 교수 (Sang-Min Park, M.D., Ph.D.)**<br>
분당서울대학교병원 정형외과<br>
서울대학교 의과대학<br>
<sub>Department of Orthopaedic Surgery, Seoul National University Bundang Hospital, Seoul National University College of Medicine</sub><br>
🌐 [sangmin.me](https://sangmin.me/)

## 라이선스

[MIT](LICENSE). Copyright (c) 2026 Sang-Min Park. Lectern, DeckStage(MIT)의 공개된 아이디어를 참고했고 코드는 새로 작성했다.
