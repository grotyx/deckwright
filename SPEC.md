# DeckWright contract v1 (hdek/1)

English · [한국어](SPEC.ko.md)

DeckWright is a small contract for presenting HTML slide decks like PowerPoint. This document defines three things: how slides and click steps are marked up in HTML; the two file forms that carry a deck (a single `.html` and a `.hdek` package); and the agreement between the runtime and the deck.

The runtime opens HTML that follows none of this as well as it can (see section 6), but decks that follow the contract get exact step navigation, going back, presenter previews and printing.

## 1. Principle

Every screen must be reproducible from two integers, `(slide, step)`. Going forward plays animations; going back jumps straight to the final look of that step without animating, as PowerPoint does. Presenter previews and PDF printing are drawn the same way.

## 2. Deck structure

```html
<main data-hdek data-width="1920" data-height="1080" data-duration="7" data-title="Talk title">
  <section data-slide="intro">
    <h1>Title</h1>
    <p data-step data-effect="rise">Appears on click</p>
    <aside class="notes">Speaker notes (never shown to the audience)</aside>
  </section>
  ...
</main>
```

| Attribute | On | Meaning |
|---|---|---|
| `data-hdek` | deck root | Marks a DeckWright deck. A fixed stage (default 1920×1080) is scaled to fit the screen; the rest is filled with black |
| `data-width`, `data-height` | root | Stage size in px. Default 1920×1080 |
| `data-fit="none"` | root | Turn off stage scaling and leave the deck responsive |
| `data-duration` | root | Target talk length in minutes. The presenter timer shows time remaining |
| `data-title` | root | Talk title (falls back to `<title>`) |
| `data-click="off"`, `data-wheel="off"` | root | Disable advancing by click / wheel |
| `data-hdek-lang="en"` | root | Runtime UI language (`en` or `ko`). Otherwise `?hdek-lang=` in the URL, otherwise the browser language |
| `data-slide="id"` | slide | A slide. The id is also the key for saved ink, so keep it unique in the deck |
| `data-title` | slide | Title shown in the slide list (falls back to the first h1–h3) |
| `data-steps="n"` | slide | Declares the number of JS-drawn steps |
| `data-autoplay="ms"` | slide | Advance steps automatically every `ms` |
| `<aside class="notes">` | inside a slide | Speaker notes. HTML allowed |

## 3. Steps (click animations)

An element with `data-step` gets the class `is-on` once its step is reached.

- `data-step` (no value): numbered 1, 2, 3… in document order
- `data-step="2"`: appears at step 2. Elements with the same number appear together
- `data-step-out="3"`: leaves at step 3 (to swap content in place)
- `data-effect`: `fade` (default) · `rise` · `drop` · `left` · `right` · `zoom` · `blur` · `dim` (visible but faded, then sharp) · `none`

The runtime's default styles use `:where()` so they have zero specificity and the deck's CSS always wins. To style steps yourself, write transitions or animations keyed on `.is-on`:

```css
.chart.is-on path { stroke-dashoffset: 0; }
```

The current slide gets the classes `hdek-current`, `active`, `is-active`, `current` and `present`. CSS animations that run on entering a slide (`.active .title { animation: … }`) replay every time the slide is entered.

### Steps drawn in JS

Effects that CSS classes cannot express (counters, canvas, GSAP timelines) register a hook. Put it on a global so it works even if it runs before the runtime:

```js
(window.hdekHooks = window.hdekHooks || {})['slide-id'] = {
  steps: 2,
  setStep(n, { animate, slide, max }) {
    // Build the look of step n. animate=false means jump without animating (going back, previews, print)
  }
};
// If the runtime is already running: DeckWright.register('slide-id', {...})
```

There is one rule: `setStep(n)` must give the same result however many times it is called (idempotent). With GSAP, put labels `step-1`, `step-2` on the timeline and implement it as `animate ? tl.tweenTo('step-'+n) : tl.seek('step-'+n)`.

Instead of a hook you can listen for events. The slide element fires `hdek:enter`, `hdek:leave` and `hdek:step` (detail: `{step, max, animate}`).

The prefix `hdek` (attributes `data-hdek*`, classes `hdek-*`, events `hdek:*`, hooks `hdekHooks`) comes from the file format name `.hdek`.

## 4. File forms

### 4.1 Single HTML (`.html`)

One HTML file with the runtime and every asset (CSS, images, fonts, video) inlined as data URLs. Double-click it and it opens ready to present. A manifest goes in `<head>`:

```html
<script type="application/hdek+json" id="hdek-manifest">{ "format": "hdek/1", ... }</script>
...
<script data-hdek-runtime> /* DeckWright runtime */ </script>
```

### 4.2 Package (`.hdek`)

A ZIP container for decks with large videos or many files (the same approach as EPUB).

```
mimetype            application/vnd.hdek+zip   (first entry, stored uncompressed)
manifest.json
index.html          entry HTML containing the runtime
css/ img/ media/ fonts/ ...
```

`manifest.json`:

```json
{
  "format": "hdek/1",
  "generator": "deckwright",
  "title": "Talk title",
  "entry": "index.html",
  "created": "2026-10-21T00:00:00Z",
  "stage": { "width": 1920, "height": 1080, "fit": "contain" },
  "duration": 7,
  "slides": [{ "id": "intro", "title": "Title", "steps": 2 }],
  "files": [{ "path": "media/clip.mp4", "size": 51235, "crc32": "1a2b3c4d" }]
}
```

Open a `.hdek` with `player.html` (no install) or the `deckwright` CLI. You can also rename it to `.zip`, extract it, and double-click the entry HTML (`entry` in the manifest).

Readers must treat a package as untrusted input: entry names that leave the package (`../`) are dropped, entry and total sizes are capped, and sizes and CRCs are checked. Names without the UTF-8 flag that are not valid UTF-8 are read as CP949 (Korean Windows zip tools).

## 5. Runtime behavior

### Controls

| Action | Keys / input |
|---|---|
| Next | `→` `↓` `Space` `PageDown` `Enter` `N`, click on empty space, wheel down, touch swipe |
| Previous | `←` `↑` `PageUp` `Backspace` `P`, wheel up |
| First / last / slide n | `Home` / `End` / type a number, then `Enter` |
| Presenter view | `S` |
| Fullscreen (on the second screen when there is one) | `F` (a clicker's `F5` does the same) |
| Black / white screen | `B` `.` / `W` `,` |
| Pen / highlighter / laser / eraser | `D` / `H` / `L` / `E` (a stylus writes without choosing a tool) |
| Clear ink on slide / everywhere | `C` / `Shift+C` |
| Tool off | `Esc` |
| Shortcut help | `?` |
| Print / PDF | `Ctrl/⌘+P` (final look with every step revealed, one page per slide) |

Clicking an element with `cursor: pointer`, a link, button or input, or anything marked `data-interactive` does not advance the slide.

### Presenter view

Pressing `S` in the audience window opens a new window. The current and next previews load the same deck again in preview-only mode (`window.name` starts with `hdek-preview`), so CSS, JS, canvas and video look exactly as they do for the audience. Preview video is muted. For heavy decks, the "Preview" button turns off the live current-slide preview.

Ink is stored per slide id in normalized coordinates (0–1). Whatever is drawn in either the audience or the presenter window shows in both. It is kept in browser storage, so an accidental reload keeps it.

### Preview protocol (postMessage)

```
parent → preview   { hdek: 1, type: "goto", slide, step, animate }
preview → parent   { hdek: 1, type: "ready", count }
preview → parent   { hdek: 1, type: "key", key, shiftKey }
```

### Public API

```js
DeckWright.next(); DeckWright.prev(); DeckWright.goto(slide, step, animate);
DeckWright.state();     // { slide, step, count, max, mode, role }
DeckWright.slides();    // [{ id, title, steps, notes }]
DeckWright.onChange(fn); DeckWright.register(id, hook); DeckWright.presenter(); DeckWright.tool('pen'|null); DeckWright.ink();
window.addEventListener('hdek:change', e => e.detail);   // { slide, step }
```

## 6. Decks without the contract

Without `data-slide`, the runtime looks at the deck's shape and picks one of three approaches. It starts after the deck's own `load` handlers (auto-fit text and the like) have run, so it does not disturb layout the deck computed.

**Decks with their own engine (driver mode).** The deck handles `ArrowRight` itself and, at start, exactly one scene carries an `active` (or `current`, `cur`, …) class. Most AI-made "stage + scenes" decks are like this. The runtime leaves the deck's engine in charge and steers it with key events, reading the current scene from the active class and the current step from `on` / `visible` classes on `[data-s]`, `[data-step]` and `.fragment`. If the deck provides `window.__show(n)` (go to the final state of scene n), presenter previews and number jumps use it. The runtime only handles keys (such as `↓`) and clicks the deck ignores, so nothing advances twice. If there are hidden step elements the deck's scripts never touch, driver mode is not used and the runtime takes over as below.

**Stacked fixed-size slides (autostage).** Decks built for print or PPT conversion often stack `section.slide` elements of fixed size (`960px×540px`, `720pt×405pt`, `13.333in×7.5in`) down the page. The runtime scales the current slide to fill the screen and hides the rest of the document (edit bars, instructions) behind a black backdrop. An `<aside class="notes">` right after a slide is read as that slide's notes.

**Everything else (heuristic mode).** Repeated elements such as `section.slide`, `.slide`, `.scene`, `.slides > section`, `main > section` or `body > section` (two or more) are taken as slides. `data-step` and initially hidden `.step` / `.fragment` elements are steps (a `.step` that is visible from the start is treated as decoration and left alone). Notes come from `aside.notes`, `aside.note`, `.notes` or `.speaker-notes` inside or right after a slide. Responsive decks built in `vw`/`vh` are shown as they are, without scaling.

reveal.js decks are recognized automatically: reveal's own navigation and fragments are used, and DeckWright adds the presenter view, ink and blackout (experimental).

Slide titles come from `h1`–`h3`, then from `title` / `chip`-like classes, then from the shortest line with the largest font on the slide.

## 7. Authoring recommendations (for conference talks)

- Keep every asset local. External CDNs and web fonts break in a hall without internet (`deckwright check` warns)
- Subset non-Latin fonts to woff2 and ship them. Relying on system fonts changes line breaks from PC to PC
- Video as H.264 MP4. WebM and MOV do not play on some PCs
- Animations that depend on `Math.random()` or the current time can look different in the presenter previews
- `backdrop-filter`, large blurs and particles can stutter on low-end PCs
- An `aside.notes` on every slide is used as-is for the presenter view and for PPTX export notes
