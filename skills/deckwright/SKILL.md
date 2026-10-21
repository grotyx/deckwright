---
name: deckwright
description: Make HTML slide decks that present like PowerPoint (click steps, presenter view with notes/next slide/timer, pen, print to PDF), or make an existing AI-generated HTML deck presentable. Use for conference talks, lectures and seminars built in HTML, and for packaging them as one self-contained .html, a .hdek package, or PDF/PPTX backups.
---

# DeckWright

DeckWright is a small runtime plus a file contract that lets an HTML deck be presented like PowerPoint. A deck built with it opens by double-click, advances with click / wheel / arrow keys / a clicker, reveals click steps, opens a presenter view with `S` (current + next slide, notes, timer), draws with `D`, and prints one page per slide with every step revealed. No install and no network are needed at presentation time.

Everything this skill needs is inside this folder:

```
scripts/deckwright.mjs        CLI (Node 18+): inject, build, pack, unpack, check, export, runtime
runtime/deckwright-runtime.js runtime embedded in every deck
core/deckwright-core.js       asset inlining, ZIP, lint (used by the CLI)
assets/template.html          starting point for a new deck
player.html                   drag-and-drop player for .hdek files and folders
reference/SPEC.md             full specification
```

Run the CLI as `node <skill>/scripts/deckwright.mjs <command> …`, where `<skill>` is the absolute path of this folder; it works from any working directory. If `deckwright` is on PATH (npm install), you can call it directly.

## Pick the job

**A. The user already has an HTML deck** (made by any AI or by hand, no DeckWright markup):

1. `node <skill>/scripts/deckwright.mjs check <deck.html or folder>` to see what it detects (slides, external assets).
2. `node <skill>/scripts/deckwright.mjs inject <deck.html>` (add `--fetch-fonts` when `check` reports web fonts) writes `<name>_DeckWright.html` next to the original. It only adds the runtime; images and videos still load from the original folder, and the original file is not touched. This is the lightest option and the right default.
3. If the user wants one file to email or carry on USB: `build <input>` (inlines all assets; writes `<name>_single.html` next to the input). If the deck has large videos (>50 MB total): `pack <input> -o talk.hdek` and open it with `player.html`.

The runtime auto-detects decks without the contract: decks with their own navigation engine are driven through that engine (their animations are kept), stacked fixed-size slides are scaled to fit, reveal.js decks are recognized, and `.notes` / `aside.notes` become speaker notes. Never rewrite the user's deck just to add DeckWright unless they ask.

**B. Make a new deck:** follow the steps below.

## Making a new deck

1. Settle the content first: for each slide a title, one key message, and speaker notes (what the speaker will actually say). If the talk has a time limit, put minutes in `data-duration`.
2. Copy `assets/template.html` to `my-talk/index.html`. Keep assets beside it:
   ```
   my-talk/
     index.html
     img/  media/  fonts/   (only what you need)
   ```
3. Write slides following the rules below.
4. `node <skill>/scripts/deckwright.mjs check my-talk` and fix every warning.
5. `node <skill>/scripts/deckwright.mjs build my-talk -o my-talk.html` for a single self-contained HTML. Files outside the deck folder are never included; if `check` or `build` reports one, move it into the folder (or pass `--root <parent>`). Use `pack … -o my-talk.hdek` instead when videos make it large.
6. For a conference that only accepts PPTX/PDF: `node <skill>/scripts/deckwright.mjs export my-talk --pdf my-talk.pdf --pptx my-talk.pptx` (needs `npm i -g playwright pptxgenjs` and `npx playwright install chromium`). Each slide's final state becomes an image; notes go into PPTX notes.

## Rules

- Root: `<main data-hdek data-width="1920" data-height="1080" data-title="…">`. Size everything in **px** on the 1920×1080 stage. Do not use `vw`/`vh`; the runtime scales the stage to the screen.
- Slides: `<section data-slide="unique-id">`, ids in lowercase letters and hyphens, unique within the deck.
- Click steps: add `data-step` (auto-numbered) or `data-step="2"` to elements revealed later. Effect: `data-effect="rise|drop|left|right|zoom|blur|dim|none"`. To swap something out in place, give the earlier element `data-step-out="n"`.
- Step styling hooks on `.is-on`. Hidden is the default, so no `opacity:0` is needed.
- Entrance animations that should replay each time the slide is entered key on `.active`: `.active .title { animation: rise .8s both; }`. Use `animation-fill-mode: both` or `forwards`.
- Speaker notes: one `<aside class="notes">…</aside>` per slide, 2–5 sentences of what will actually be said.
- JS-driven effects (counters, canvas, chart animation) register a hook, and `setStep(n, {animate})` must give the same result however many times it is called. With `animate:false`, jump straight to the final look:
  ```js
  (window.hdekHooks = window.hdekHooks || {})['results'] = {
    steps: 2,
    setStep(n, { animate, slide }) { /* draw the state for step n */ }
  };
  ```
- Elements that should not advance the slide when clicked (flip cards, tabs) get `cursor:pointer` or `data-interactive`.
- Put the runtime last: `<script src="deckwright-runtime.js" data-hdek-runtime></script>`. `build`, `pack` and `inject` replace it with the current runtime inline.

## Avoid

- External CDNs (fonts, icons, chart libraries). Download what you need into the folder; conference venues may have no internet. `check` warns about these. For web fonts that are already in a deck (Google Fonts links), add `--fetch-fonts` to `inject`, `build` or `pack`: it downloads them and embeds only the slices for characters the deck uses.
- Your own keyboard navigation, progress bar or slide counter. The runtime handles them.
- Anything that makes the screen differ between loads (`Math.random()`, current time). The presenter previews would not match the audience screen.
- Patient-identifying images or video.

## Presentation checklist

- Body text at least 36 px, titles at least 64 px on the 1920×1080 stage.
- Non-Latin fonts: ship them in `fonts/` as woff2 with `@font-face`, or list system fonts (Korean: `"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif`).
- Video as H.264 MP4; add `muted` if no sound is needed.
- `check` reports zero warnings.

## Keys while presenting (tell the user)

`→ / Space / PageDown / click / wheel` next · `← / PageUp` back · number + `Enter` jump · `S` presenter view · `F` fullscreen (moves to a second screen when the browser allows) · `B` / `W` black / white screen · `D` pen, `H` highlighter, `L` laser, `E` eraser, `C` clear ink · `?` all shortcuts. The UI follows the browser language (Korean or English); force it with `?hdek-lang=en` or `data-hdek-lang="ko"` on the root.
