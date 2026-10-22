# DeckWright — notes for agents working on this repository

## Versioning

- Bump only the last number (0.3.0 → 0.3.1 → 0.3.2) for every change: fixes, new options, docs. Do not raise the middle or first number unless the author asks.
- A version bump touches: `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, the header and `VERSION` in `skills/deckwright/runtime/deckwright-runtime.js`, the header in `skills/deckwright/core/deckwright-core.js`, `VERSION` in `skills/deckwright/scripts/deckwright.mjs`, the version badge in `README.md` / `README.ko.md`, the version line in `docs/manual.md` / `docs/manual.ko.md`, and a new `### vX.Y.Z (YYMMDD)` entry in `CHANGELOG.md` and `CHANGELOG.ko.md`.

## Before pushing

- `npm test` (rebuilds `docs/`, `skills/deckwright/player.html` and the skill zip, then runs every check) and `claude plugin validate .` must pass.
- Keep English and Korean docs in step. `skills/deckwright/reference/SPEC.md` is a copy of `SPEC.md` with the Korean link made absolute.
- The product name is written DeckWright; commands, the package, the plugin id and the repository stay lowercase (`deckwright`).
