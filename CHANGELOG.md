# Changelog

English · [한국어](CHANGELOG.ko.md)

Versions follow SemVer. Dates are YYMMDD.

### v0.1.1 (261021)

Documentation and polish.

- READMEs rewritten (English and Korean) with screenshots, a user guide in both languages (`docs/manual.md`, `docs/manual.ko.md`) and this changelog.
- Logo (`assets/logo.svg`, `assets/logo-dark.svg`), used for the plugin icon and the GitHub Pages site.
- The product name is written in lowercase, *deckwright*, in the interface and the docs. `inject` now writes `<name>_deckwright.html`. The JavaScript API stays `window.DeckWright`.
- Fix: the runtime's own help card and toolbar used the class names `card`, `num`, `sw` and `swb`, so a deck's CSS for `.card` (common in AI decks) could stretch the shortcut help. They are now `hdek-card`, `hdek-num`, `hdek-sw` and `hdek-swb`.
- Fix: a slide title written with `<br>` ("deckwright<br>presentation runtime") ran the words together in the slide list; line breaks now become spaces.
- Demo deck: flip cards no longer print mirrored.
- GitHub Actions runs the test suite on every push.

### v0.1.0 (261021)

First public release.

- Runtime: click steps with effects, going back without replaying animations, presenter view (current and next slide, notes, elapsed and remaining time, slide list), pen, highlighter, laser and eraser on both screens, black and white screen, fullscreen on a second monitor where the browser allows it, `Ctrl/⌘+P` with every step revealed.
- Decks without the contract: decks with their own navigation engine are steered through it; stacked fixed-size slides are scaled to fit; reveal.js decks are recognized; notes are read from `.notes` and `aside.notes`.
- CLI: `inject`, `build`, `pack`, `unpack`, `check`, `export` (PDF, PPTX, PNG), `runtime`.
- `.hdek` package format (spec hdek/1) and a drag-and-drop player.
- Agent skill, Claude Code plugin and marketplace manifests, `npx skills` support, a skill zip for claude.ai.
- Interface and CLI messages in English and Korean.
