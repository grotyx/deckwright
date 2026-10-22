# Changelog

English · [한국어](CHANGELOG.ko.md)

Versions follow SemVer. Dates are YYMMDD.

### v0.3.1 (261022)

- Presenter view: clicking the current or next slide preview advances, and the wheel over the previews moves back and forth, as in the audience window. Clicks and scrolling in the notes do nothing to the slides. Not while a pen tool is on.

### v0.3.0 (261022)

- `--fetch-fonts` for `build`, `inject` and `pack`: web fonts such as Google Fonts are downloaded once and embedded in the file, so the deck looks the same at a venue without internet. Only the font slices (`unicode-range`) covering characters that appear in the deck are kept, and a variable font listed once per weight is embedded once, so a 31-slide Korean deck with Noto Sans KR in four weights grows by 0.8 MB instead of 4.5 MB (or 18 MB with every weight embedded separately). `preconnect` hints to the font host are dropped. Without the flag, `build` and `check` point to it when they find web fonts.
- Docs: README, guide and skill instructions describe the option.

### v0.2.0 (261021)

Fixes from a full code review by three independent reviewers. Every defect below was reproduced first and now has a regression test (87 checks).

Presenting (runtime)
- Decks with their own navigation engine: jumping to a slide (number + Enter, the slide list, the presenter's "next" preview) no longer falls back to slide 1 when the deck ignores keys during its transition; DeckWright now waits for the deck between keys.
- Decks that move on keyup or after a short timer no longer advance twice per press: DeckWright waits for the key to be released and ~300 ms before acting on its own.
- Auto-detected decks that also listen for clicks or the wheel themselves no longer move twice (which could leave a blank screen).
- A pen tablet draws on the first stroke, every stroke, and the stroke no longer advances the slide.
- One trackpad swipe advances once (momentum events no longer count as new swipes). Touch swipes work.
- The clicker (PageUp/PageDown) works while a text box has focus, including the presenter's target-minutes box.
- Presenter ink lines up with the slide for decks that do not fill the window; the previews follow when the audience window is resized or goes fullscreen.
- The ink layer re-fits after a slide finishes its entrance animation.
- Auto-detected steps whose deck CSS waits for a class such as `show` are revealed (fallback: forced visible).
- Slides sized in `vw`/`vh` are no longer treated as fixed-size and scaled twice.
- Printing a deck with its own engine keeps the current slide.
- The toolbar, help and toasts are isolated from the deck's CSS (shadow DOM).
- Only DeckWright's own preview frames can send keys to the presenter view; a frame inside a slide cannot.
- Ink storage no longer changes key when a slide is added, separates untitled decks opened in the player, rounds points and batches saves.

Files (core and CLI)
- `build`, `pack` and `check` never read files outside the deck folder (`../`, symlinks). They report them instead; `--root <dir>` widens the scope on purpose.
- Opening a package is bounded: entry and total size limits, size and CRC checks, `../` entries dropped, a `__proto__` entry is harmless, damaged packages give a clear message.
- ZIP names written in CP949 by Korean Windows tools are read correctly; names are NFC-normalized.
- `pack` refuses more than 65,535 files or 4 GB instead of writing a broken archive.
- EUC-KR (and other non-UTF-8) HTML is decoded by its `<meta charset>` and written as UTF-8.
- A `$` in a title no longer corrupts the built file.
- `defer`/`async`/module scripts keep their timing when inlined.
- Inlining handles `url("photo (1).png")`, `>` inside attributes, `srcset` with data URLs, `@import … layer()`, commented-out CSS, encoded `#` in data SVGs and backslash paths. `check` and `pack` now follow linked and `@import`ed CSS.
- `build` and `pack` write next to the input by default (`<name>_single.html`, `<name>.hdek`) instead of the current folder.
- `export` serves the deck straight from the folder or package (no size limit from building one huge HTML), always closes the browser, and fails fast when a flag is missing its value.
- An unknown command exits with code 1. `unpack` reports how many files it actually wrote.
- Builds are reproducible (`SOURCE_DATE_EPOCH`), so rebuilding without changes leaves `docs/` untouched.

Player
- A failed load clears the previous deck; choosing the same file again reloads it.
- "Save as single HTML" works for decks with large assets, adds the manifest, and is named `<name>_single.html`.
- Folders: dotfiles are skipped; `talk.html` is preferred over `talk_DeckWright.html`.

### v0.1.2 (261021)

- The name is written **DeckWright** again everywhere it is shown: README, guide, spec, player, presenter view, help, CLI messages. `inject` writes `<name>_DeckWright.html`. Commands, the package, the plugin and the repository stay lowercase (`deckwright`, `deckwright@deckwright`, `grotyx/deckwright`).
- Screenshots retaken; the README author section is laid out one line per item.

### v0.1.1 (261021)

Documentation and polish.

- READMEs rewritten (English and Korean) with screenshots, a user guide in both languages (`docs/manual.md`, `docs/manual.ko.md`) and this changelog.
- Logo (`assets/logo.svg`, `assets/logo-dark.svg`), used for the plugin icon and the GitHub Pages site.
- Fix: the runtime's own help card and toolbar used the class names `card`, `num`, `sw` and `swb`, so a deck's CSS for `.card` (common in AI decks) could stretch the shortcut help. They are now `hdek-card`, `hdek-num`, `hdek-sw` and `hdek-swb`.
- Fix: a slide title written with `<br>` ("deckwright<br>presentation runtime") ran the words together in the slide list; line breaks now become spaces.
- Demo deck: flip cards no longer print mirrored.
- GitHub Actions runs the test suite on pushes to `main` and on pull requests.

### v0.1.0 (261021)

First public release.

- Runtime: click steps with effects, going back without replaying animations, presenter view (current and next slide, notes, elapsed and remaining time, slide list), pen, highlighter, laser and eraser on both screens, black and white screen, fullscreen on a second monitor where the browser allows it, `Ctrl/⌘+P` with every step revealed.
- Decks without the contract: decks with their own navigation engine are steered through it; stacked fixed-size slides are scaled to fit; reveal.js decks are recognized; notes are read from `.notes` and `aside.notes`.
- CLI: `inject`, `build`, `pack`, `unpack`, `check`, `export` (PDF, PPTX, PNG), `runtime`.
- `.hdek` package format (spec hdek/1) and a drag-and-drop player.
- Agent skill, Claude Code plugin and marketplace manifests, `npx skills` support, a skill zip for claude.ai.
- Interface and CLI messages in English and Korean.
