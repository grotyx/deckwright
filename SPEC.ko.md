# DeckWright 규약 v1 (hdek/1)

[English](SPEC.md) · 한국어

DeckWright는 HTML로 만든 발표 자료를 PowerPoint처럼 발표하기 위한 작은 규약입니다. 이 문서는 세 가지를 정합니다. 첫째, HTML 안에서 슬라이드와 클릭 단계를 표시하는 방법. 둘째, 그것을 담는 두 가지 파일 형태(단독 `.html`, 패키지 `.hdek`). 셋째, 런타임이 덱과 주고받는 약속.

규약을 하나도 지키지 않은 HTML도 런타임이 최대한 추정해서 열지만(휴리스틱 모드), 규약을 지키면 단계 이동·뒤로 가기·발표자 미리보기·인쇄가 정확해집니다.

## 1. 기본 원칙

모든 화면은 `(슬라이드 번호, 단계 번호)` 두 정수로 다시 만들 수 있어야 합니다. 앞으로 갈 때는 애니메이션을 재생하고, 뒤로 갈 때는 애니메이션 없이 그 단계의 최종 모습으로 바로 바뀝니다(PowerPoint와 같습니다). 발표자 창의 미리보기와 PDF 인쇄도 같은 원리로 그립니다.

## 2. 덱 구조

```html
<main data-hdek data-width="1920" data-height="1080" data-duration="7" data-title="발표 제목">
  <section data-slide="intro">
    <h1>제목</h1>
    <p data-step data-effect="rise">클릭하면 나타남</p>
    <aside class="notes">발표자 노트 (청중에게는 보이지 않음)</aside>
  </section>
  ...
</main>
```

| 속성 | 위치 | 의미 |
|---|---|---|
| `data-hdek` | 덱 루트 | DeckWright 덱임을 표시. 고정 무대(기본 1920×1080)를 화면에 맞춰 확대·축소하고 남는 부분은 검게 채웁니다 |
| `data-width`, `data-height` | 루트 | 무대 크기(px). 기본 1920×1080 |
| `data-fit="none"` | 루트 | 무대 확대·축소를 끄고 반응형으로 둠 |
| `data-duration` | 루트 | 목표 발표 시간(분). 발표자 창 타이머에 남은 시간 표시 |
| `data-title` | 루트 | 발표 제목(없으면 `<title>`) |
| `data-click="off"`, `data-wheel="off"` | 루트 | 클릭/휠로 넘기기 끄기 |
| `data-hdek-lang="ko"` | 루트 | 런타임 화면 언어(`ko`·`en`). 없으면 주소의 `?hdek-lang=`, 그것도 없으면 브라우저 언어 |
| `data-slide="id"` | 슬라이드 | 슬라이드. id는 필기 저장 키로도 쓰이므로 덱 안에서 고유하게 |
| `data-title` | 슬라이드 | 목록에 보일 제목(없으면 첫 h1~h3) |
| `data-steps="n"` | 슬라이드 | JS로 그리는 단계 수를 선언 |
| `data-autoplay="ms"` | 슬라이드 | 단계를 ms 간격으로 자동 진행 |
| `<aside class="notes">` | 슬라이드 안 | 발표자 노트. HTML 허용 |

## 3. 단계(클릭 애니메이션)

`data-step`이 붙은 요소는 해당 단계에 도달하면 `is-on` 클래스를 받습니다.

- `data-step` (값 없음): 문서 순서대로 1, 2, 3… 자동 번호
- `data-step="2"`: 2단계에서 등장. 같은 번호끼리는 함께 등장
- `data-step-out="3"`: 3단계에서 퇴장 (같은 자리에서 교체할 때)
- `data-effect`: `fade`(기본) · `rise` · `drop` · `left` · `right` · `zoom` · `blur` · `dim`(흐리게 보이다 선명해짐) · `none`

런타임 기본 스타일은 `:where()`로 우선순위를 0으로 두었기 때문에 덱의 CSS가 항상 이깁니다. 직접 꾸미려면 `.is-on` 상태를 기준으로 transition이나 animation을 작성하면 됩니다.

```css
.chart.is-on path { stroke-dashoffset: 0; }
```

현재 슬라이드에는 `hdek-current`, `active`, `is-active`, `current`, `present` 클래스가 붙습니다. 슬라이드에 들어올 때 재생되는 CSS 애니메이션(`.active .title { animation: … }`)은 들어올 때마다 다시 재생됩니다.

### JS로 그리는 단계

카운터, 캔버스, GSAP 타임라인처럼 CSS 클래스만으로 안 되는 효과는 훅을 등록합니다. 런타임보다 먼저 실행돼도 되도록 전역 객체에 넣습니다.

```js
(window.hdekHooks = window.hdekHooks || {})['슬라이드id'] = {
  steps: 2,
  setStep(n, { animate, slide, max }) {
    // n단계의 모습을 만든다. animate=false이면 애니메이션 없이 즉시(뒤로 가기, 미리보기, 인쇄)
  }
};
// 런타임이 이미 떠 있으면: DeckWright.register('슬라이드id', {...})
```

규칙은 하나입니다. `setStep(n)`은 몇 번을 불러도 같은 결과를 내야 합니다(멱등). GSAP이라면 타임라인에 `step-1`, `step-2` 레이블을 두고 `animate ? tl.tweenTo('step-'+n) : tl.seek('step-'+n)`으로 구현합니다.

훅 대신 이벤트를 받아도 됩니다. 슬라이드 요소에서 `hdek:enter`, `hdek:leave`, `hdek:step`(detail: `{step, max, animate}`) 이벤트가 발생합니다.

접두사 `hdek`(속성 `data-hdek*`, 클래스 `hdek-*`, 이벤트 `hdek:*`, 훅 `hdekHooks`)는 파일 형식 이름 `.hdek`에서 온 것입니다.

## 4. 파일 형태

### 4.1 단독 HTML (`.html`)

런타임과 모든 자원(CSS, 이미지, 폰트, 영상)을 data URL로 넣은 HTML 한 개입니다. 더블클릭하면 바로 발표 모드로 열립니다. `<head>`에 manifest가 들어갑니다.

```html
<script type="application/hdek+json" id="hdek-manifest">{ "format": "hdek/1", ... }</script>
...
<script data-hdek-runtime> /* DeckWright runtime */ </script>
```

### 4.2 패키지 (`.hdek`)

영상이 크거나 파일이 많을 때 쓰는 ZIP 컨테이너입니다(EPUB과 같은 방식).

```
mimetype            application/vnd.hdek+zip   (압축 없이 맨 앞)
manifest.json
index.html          런타임이 들어 있는 엔트리 HTML
css/ img/ media/ fonts/ ...
```

`manifest.json`:

```json
{
  "format": "hdek/1",
  "generator": "deckwright",
  "title": "발표 제목",
  "entry": "index.html",
  "created": "2026-10-21T00:00:00Z",
  "stage": { "width": 1920, "height": 1080, "fit": "contain" },
  "duration": 7,
  "slides": [{ "id": "intro", "title": "제목", "steps": 2 }],
  "files": [{ "path": "media/clip.mp4", "size": 51235, "crc32": "1a2b3c4d" }]
}
```

`.hdek`는 `player.html`(설치 불필요)이나 `deckwright` 명령줄 도구로 엽니다. 확장자를 `.zip`으로 바꿔 풀면 엔트리 HTML(manifest의 `entry`)을 직접 더블클릭해서 발표할 수도 있습니다.

패키지를 읽는 쪽은 패키지를 믿지 않습니다. 패키지 밖을 가리키는 항목(`../`)은 버리고, 항목별·전체 크기에 상한을 두고, 크기와 CRC를 확인합니다. UTF-8 표시가 없고 UTF-8로도 읽히지 않는 이름은 CP949(한국어 Windows 압축 도구)로 읽습니다.

## 5. 런타임 동작

### 조작

| 동작 | 키 / 입력 |
|---|---|
| 다음 | `→` `↓` `Space` `PageDown` `Enter` `N`, 빈 곳 클릭, 휠 아래, 터치 스와이프 |
| 이전 | `←` `↑` `PageUp` `Backspace` `P`, 휠 위 |
| 처음 / 끝 / n번으로 | `Home` / `End` / 숫자 입력 후 `Enter` |
| 발표자 창 | `S` |
| 전체화면(보조 모니터가 있으면 그쪽으로) | `F` (클리커의 `F5`도 같음) |
| 검은 화면 / 흰 화면 | `B` `.` / `W` `,` |
| 펜 / 형광펜 / 레이저 / 지우개 | `D` / `H` / `L` / `E` (스타일러스는 도구 없이 바로 필기) |
| 필기 지우기 / 전부 | `C` / `Shift+C` |
| 도구 끄기 | `Esc` |
| 단축키 보기 | `?` |
| 인쇄·PDF | `Ctrl/⌘+P` (모든 단계가 펼쳐진 최종 모습, 한 슬라이드당 한 쪽) |

`cursor: pointer`인 요소, 링크·버튼·입력창, `data-interactive`가 붙은 요소를 클릭하면 슬라이드가 넘어가지 않습니다.

### 발표자 창

청중 창에서 `S`를 누르면 새 창이 열립니다. 현재 화면과 다음 화면은 같은 덱을 미리보기 전용 모드로 한 번 더 띄워 그리므로(`window.name`이 `hdek-preview`로 시작), CSS·JS·캔버스·영상이 청중 화면과 똑같이 보입니다. 미리보기 쪽 영상은 음소거됩니다. 무거운 덱이면 "미리보기" 버튼으로 현재 화면 실시간 미리보기를 끌 수 있습니다.

필기는 슬라이드 id별로 정규화 좌표(0~1)로 저장되고, 청중 창과 발표자 창 어느 쪽에서 그려도 양쪽에 같이 보입니다. 브라우저 저장소에 남으므로 실수로 새로고침해도 유지됩니다.

### 미리보기 프로토콜 (postMessage)

```
부모 → 미리보기   { hdek: 1, type: "goto", slide, step, animate }
미리보기 → 부모   { hdek: 1, type: "ready", count }
미리보기 → 부모   { hdek: 1, type: "key", key, shiftKey }
```

### 공개 API

```js
DeckWright.next(); DeckWright.prev(); DeckWright.goto(slide, step, animate);
DeckWright.state();     // { slide, step, count, max, mode, role }
DeckWright.slides();    // [{ id, title, steps, notes }]
DeckWright.onChange(fn); DeckWright.register(id, hook); DeckWright.presenter(); DeckWright.tool('pen'|null); DeckWright.ink();
window.addEventListener('hdek:change', e => e.detail);   // { slide, step }
```

## 6. 규약 없는 덱

`data-slide`가 없으면 런타임이 덱 모양을 보고 세 가지 방식 중 하나를 고릅니다. 덱 자체의 `load` 처리(글자 크기 자동 맞춤 등)가 끝난 뒤에 시작하므로 덱이 계산한 레이아웃을 망가뜨리지 않습니다.

**자체 엔진 덱 (driver 모드).** 덱이 스스로 `ArrowRight`를 처리하고, 시작할 때 한 장면에만 `active`(또는 `current`, `cur` 등) 클래스를 붙여 두는 경우입니다. AI가 만든 "무대 + 장면" 형태 덱이 대부분 여기에 해당합니다. 런타임은 덱의 엔진을 그대로 두고 키 이벤트로 조종하며, 어느 장면이 활성인지와 `[data-s]`, `[data-step]`, `.fragment`에 붙은 `on`/`visible` 클래스로 현재 단계를 읽습니다. 덱이 `window.__show(n)`(n번 장면의 마지막 상태로 이동)을 제공하면 발표자 미리보기와 번호 이동에 그것을 씁니다. 덱이 처리하지 않는 키(예: `↓`)나 클릭만 런타임이 대신 처리하므로 두 번 넘어가는 일이 없습니다. 숨겨진 단계 요소가 있는데 덱 스크립트가 그 요소를 다루지 않으면 driver 모드를 쓰지 않고 아래 방식으로 직접 맡습니다.

**고정 크기 슬라이드 문서 (자동 무대).** 인쇄·PPT 변환용으로 만든 덱처럼 `section.slide`가 `960px×540px`, `720pt×405pt`, `13.333in×7.5in` 같은 고정 크기로 세로로 쌓여 있는 경우입니다. 현재 슬라이드만 화면 가운데에 꽉 차게 확대·축소하고 나머지 문서 내용(편집 막대, 안내 문구 등)은 검은 배경으로 가립니다. 슬라이드 바로 뒤에 붙은 `<aside class="notes">`도 그 슬라이드의 노트로 읽습니다.

**그 밖의 덱 (휴리스틱 모드).** `section.slide`, `.slide`, `.scene`, `.slides > section`, `main > section`, `body > section` 등에서 두 개 이상 반복되는 요소를 슬라이드로 봅니다. `data-step`과, 처음에 숨겨져 있는 `.step`·`.fragment`를 단계로 봅니다(처음부터 보이는 `.step`은 장식용 클래스로 보고 건드리지 않습니다). 노트는 슬라이드 안이나 바로 뒤의 `aside.notes`, `aside.note`, `.notes`, `.speaker-notes`에서 읽습니다. `vw/vh` 단위로 만든 반응형 덱은 확대·축소 없이 그대로 보여 줍니다.

reveal.js 덱은 자동으로 인식해서 reveal의 이동·프래그먼트를 그대로 쓰고, 발표자 창·필기·블랙아웃만 덧붙입니다(실험적).

제목은 `h1~h3`, 없으면 `title`·`chip`류 클래스, 그것도 없으면 슬라이드에서 글자가 가장 큰 짧은 문장으로 정합니다.

## 7. 덱 작성 권장 사항 (학회 발표 기준)

- 모든 자원은 로컬 파일로. 외부 CDN·웹폰트는 인터넷 없는 강당에서 깨집니다(`deckwright check`가 경고)
- 한글 폰트는 woff2로 서브셋해서 함께 넣기. 시스템 폰트에 기대면 PC마다 줄바꿈이 달라집니다
- 영상은 H.264 MP4. WebM·MOV는 일부 PC에서 재생되지 않습니다
- `Math.random()`, 현재 시각에 의존하는 애니메이션은 발표자 미리보기와 다르게 보일 수 있습니다
- `backdrop-filter`, 큰 blur, 파티클은 저사양 PC에서 끊길 수 있습니다
- 슬라이드마다 `aside.notes`를 넣어 두면 발표자 창과 PPTX 내보내기의 노트로 그대로 쓰입니다
