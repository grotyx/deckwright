# DeckWright user guide

English · [한국어](manual.ko.md) · v0.3.3

This guide walks through a talk from start to finish: installing, turning an HTML deck into one you can present, presenting with a second screen, writing on slides, and making the files a conference asks for.

1. [Install](#1-install)
2. [Make an existing deck presentable](#2-make-an-existing-deck-presentable)
3. [Make a new deck with your AI](#3-make-a-new-deck-with-your-ai)
4. [Present](#4-present)
5. [Write on slides](#5-write-on-slides)
6. [Files for the conference](#6-files-for-the-conference)
7. [The player and .hdek packages](#7-the-player-and-hdek-packages)
8. [Troubleshooting](#8-troubleshooting)

## 1. Install

Pick one. All of them install the same skill folder (`skills/deckwright/`), which carries its own command-line tool.

| You use | Install |
|---|---|
| Claude Code | `claude plugin marketplace add grotyx/deckwright` then `claude plugin install deckwright@deckwright` |
| Codex, Cursor, opencode or another agent that reads skills | `npx skills add grotyx/deckwright -g` |
| claude.ai (web or desktop) | Download [deckwright-skill.zip](https://grotyx.github.io/deckwright/deckwright-skill.zip), then Settings → Capabilities → Skills → Upload. Code execution must be on |
| No AI | Open [player.html](https://grotyx.github.io/deckwright/player.html), or `npm install -g github:grotyx/deckwright` for the command line |

The command-line tool needs Node.js 18 or later. Presenting needs only a browser.

## 2. Make an existing deck presentable

You already have a deck an AI made, for example `talk.html` with an `img/` folder beside it.

**From the chat.** Say "make this HTML deck presentable" and point at the file.

**From the command line.**

```sh
deckwright check  talk.html     # what it detects: slides, steps, notes, external files
deckwright inject talk.html     # writes talk_DeckWright.html next to talk.html
```

`inject` copies the deck and adds the runtime. Images and video still load from the original folder, so keep the new file next to the old one. `talk.html` itself is never changed.

You do not need to rewrite the deck. DeckWright recognizes:

| Your deck | What DeckWright does |
|---|---|
| Has its own arrow-key navigation (most AI "stage + scenes" decks) | Steers that engine with key presses, so the deck's own animations and steps play as designed |
| Stacks fixed-size slides down the page (decks made for printing or PPT conversion) | Shows one slide at a time, scaled to fill the screen |
| Uses reveal.js | Keeps reveal's navigation and adds the presenter view, ink and blackout |
| Anything else with repeated `section` / `.slide` elements | Treats them as slides and initially hidden `.fragment` / `.step` elements as steps |

Notes come from `.notes`, `aside.notes` or `.speaker-notes` inside or right after a slide. If your deck has none, ask the AI to add an `<aside class="notes">` to every slide.

## 3. Make a new deck with your AI

Say what you need, for example: "Make a 15-minute conference talk on endoscopic decompression outcomes as a DeckWright deck, 12 slides, notes on every slide."

The skill writes the deck to the DeckWright contract, checks it and builds one file. The contract is short:

```html
<main data-hdek data-width="1920" data-height="1080" data-duration="15" data-title="My talk">
  <section data-slide="results">
    <h2>Results</h2>
    <p data-step data-effect="rise">Appears on the first click</p>
    <p data-step data-effect="rise">Appears on the second click</p>
    <aside class="notes">What I will say on this slide.</aside>
  </section>
</main>
```

`data-duration` is the target length in minutes; the presenter view counts down against it. Step effects are `rise`, `drop`, `left`, `right`, `zoom`, `blur`, `dim` and `none`. Counters, charts and canvas drawings can take part in steps through a small JavaScript hook; see [SPEC.md](../SPEC.md#steps-drawn-in-js).

## 4. Present

Open the file in Chrome, Edge, Firefox or Safari.

1. Connect the projector in *Extend* mode (Windows: `Win+P` → Extend; Mac: turn mirroring off).
2. Press `S`. In Chrome or Edge the slides go fullscreen on the projector and the presenter view fills the laptop screen, both from that one key press. The first time, the browser asks to allow "window management": allow it, press `F` once in the slide window, and from then on `S` alone does everything.
   In Firefox or Safari, `S` opens the presenter view only: drag the slide window to the projector and press `F` there.
3. Present from the laptop. Arrow keys, a clicker, a click or the wheel all work, in either window. In the presenter view, click either slide preview to advance or turn the wheel over them; clicks in the notes do nothing, so you can scroll and select there.

![Presenter view](images/en/presenter.png)

The presenter view shows the current slide, the next step (or the next slide), your notes with *A−* / *A+* to resize them, elapsed time, time remaining against `data-duration`, and the clock. *Slides* opens the slide list; click one to jump there. Typing a number and `Enter` jumps too.

![Slide list](images/en/slide-list.png)

| Action | Keys |
|---|---|
| Next / previous | `→` `↓` `Space` `PageDown` `Enter`, click anywhere on the slide, wheel down / `←` `↑` `PageUp` `Backspace`, right-click, wheel up |
| First / last / slide *n* | `Home` / `End` / *n* then `Enter` |
| Presenter view | `S` |
| Fullscreen | `F` (a clicker's `F5` does the same) |
| Black / white screen | `B` or `.` / `W` or `,` |
| Pen, highlighter, laser, eraser | `D`, `H`, `L`, `E` |
| Clear ink on this slide / everywhere | `C` / `Shift+C` |
| Tool off | `Esc` |
| All shortcuts | `?` |

![Shortcut help](images/en/help.png)

Going back never replays an animation: the slide snaps to how it looked at that step. Clicking a link, a button or anything with a pointer cursor (a flip card, a tab) does not advance the slide.

If you reload by accident, the deck comes back on the same slide and step, with your ink.

## 5. Write on slides

Press `D` for the pen, `H` for the highlighter, `L` for a laser pointer that fades, `E` for the eraser, or use the toolbar that appears when the mouse is near the bottom of the screen. A pen tablet or stylus writes without picking a tool.

![Ink on a slide](images/en/ink.png)

Ink drawn in the presenter view appears on the projector and the other way round. It is saved per slide in the browser, so it is still there when you come back to the slide or reload.

## 6. Files for the conference

| The conference wants | Make it with |
|---|---|
| Your own laptop, your HTML | `deckwright build talk.html`: one file, `talk_single.html`, with every image, font and video inside. Copy it to a USB stick as well |
| A PDF handout | `Ctrl/⌘+P` in the browser (choose *Save as PDF*), or `deckwright export talk.html --pdf talk.pdf` |
| A PPTX upload | `deckwright export talk.html --pptx talk.pptx`: each slide's final look as an image, with your notes in the PPTX notes |
| Slide images | `deckwright export talk.html --png shots/` |

![Print with every step revealed](images/en/print.png)

`export` needs Playwright and pptxgenjs: `npm i -g playwright pptxgenjs && npx playwright install chromium`. PPTX and PDF exports are backups: they hold the final look of every slide, not the animations.

Web fonts (Google Fonts and the like) need the internet unless you embed them: add `--fetch-fonts` to `build`, `inject` or `pack` while you are online.

Before the talk, run `deckwright check` on the final file. It warns about anything loaded from the internet (web fonts, CDN scripts), files that are missing, and slides without notes.

## 7. The player and .hdek packages

A deck with large videos is easier to carry as a package:

```sh
deckwright pack talk/ -o talk.hdek
```

A `.hdek` file is a ZIP holding a manifest, the deck and its assets. Open it with the player: drop it on [player.html](https://grotyx.github.io/deckwright/player.html) (it works offline once downloaded) and press *Start presenting*. The player also opens a plain `.html` file or a whole deck folder, and can save what you dropped as one self-contained HTML.

![Player](images/en/player.png)

Without the player, rename `talk.hdek` to `talk.zip`, extract it and double-click the deck's HTML file (the `entry` named in `manifest.json`).

## 8. Troubleshooting

**The presenter window does not open.** The browser blocked the pop-up. Allow pop-ups for the file (the icon at the right of the address bar) and press `S` again.

**`F` does not move the window to the projector.** Drag the audience window onto the projector screen and press `F` there. In Chrome and Edge, allow "window management" when asked.

**The clicker does nothing.** Click once on the audience or presenter window so it has focus. Most clickers send `PageDown` / `PageUp`, which DeckWright understands.

**The fonts look different at the venue.** The deck loads web fonts (Google Fonts) from the internet, and the venue has none. Add `--fetch-fonts` when you make the file: `deckwright inject talk.html --fetch-fonts` or `deckwright build talk/ --fetch-fonts`. The fonts are downloaded once, on your connected laptop, and embedded; only the slices for the characters in the deck are kept. From the chat, say "put the fonts inside the file".

**Slides advance twice, or a step is skipped.** The deck has its own key handler that DeckWright did not recognize. Open an issue with the deck (or a trimmed copy) at <https://github.com/grotyx/deckwright/issues>.

**`build` says "Outside the deck folder, not included".** The deck points at a file above its own folder (`../images/x.png`). DeckWright never reads outside the deck folder, so nothing private is swept into a file you share. Move the file into the deck folder, or name the shared parent with `--root`: `deckwright build talk/ --root .`

**The previews make the laptop slow.** Press *Preview* in the presenter view to turn off the live current-slide preview.
