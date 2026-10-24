# Slime Monsters from Outer Space — the RPG

An SNES-style JRPG about Lucky, a punk rock slime monster who leaves Planet
California to start a band in Minneapolis and gets pulled into a workers'
revolution involving psychic potatoes, fascist dads, and sludge metal icons
enslaved by trillionaire cannibals. Early Final Fantasy battles, Chrono
Trigger set pieces, Earthbound's sense of humor. Based on the comic, which is
based on the band.

This branch contains the **vertical slice**: Chapter 1, "Coagulation", from
the escape pod leaving the Vanguard to the destruction of Palmer's.

## Play it

```
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5173). The game renders at
256×224 and scales to the window in whole-pixel steps.

| Action | Keys |
| --- | --- |
| Move | Arrow keys or WASD |
| Confirm / talk / advance text | Z, Enter, or Space |
| Cancel / close | X or Backspace |
| Menu | Escape or C |
| Run | Shift |
| Mute | M |
| Fullscreen | F |

A standard gamepad also works (d-pad to move, A confirm, B cancel, Start menu).

Saves live in the browser's localStorage (three slots). Bajonka the dog is the
save point from City Sound onward, and the game autosaves before every
scripted battle.

## Build a static copy

```
npm run build
npm run preview
```

`dist/` is a self-contained static site (relative asset paths), so it can be
dropped on any static host.

## Tests

```
npm test
```

This runs, in order: the pure-data tests (maps, scripts, items, enemies,
encounters, speaker registry), the battle model tests, a Vite build plus a
headless boot smoke test, the gameplay tests (movement, dialogue, saves,
battles, Chapter 1 content, the honest Chapter 1 playthrough and its
wrong-path twin: every branch, loss, refusal and map edge), the audio tests,
and the UI tests. The headless
tests drive the built game in Chromium through Playwright using the debug API
on `window.__slime`, and write screenshots to `tests/screenshots/`.

Append `?fast=1` to the dev URL to skip fades and speed up text, which is what
the tests use.

## How it is built

Everything in the game is generated from text in this repository. There are
no third-party asset packs.

- **Engine**: Phaser 4 via npm, ES modules, no TypeScript. `src/engine/` holds
  the data-driven pieces (maps, entities, event scripts, conditions, saves,
  the battle model), `src/scenes/` the Phaser scenes, `src/ui/` the windowed
  UI, `src/audio/` the chiptune synth.
- **Art**: every sprite, tileset, and UI atlas is an ASCII pixel map under
  `tools/sprites/`, `tools/tiles/`, and `tools/ui/`, rendered by
  `python3 tools/gen_assets.py` into `assets/generated/` (committed). Add
  `--preview` for 4× contact sheets, `--check` to validate without writing.
  The shared 32-color palette is in `tools/palettes.md`.
- **Audio**: all music and sound effects are synthesized in WebAudio at
  runtime from note data in `src/audio/songs/` and `src/audio/sfx.js`. No
  audio files are shipped.
- **Content**: maps are JSON with an ASCII tile legend (`src/data/maps/`),
  cutscenes and NPC dialogue are JSON command lists (`src/data/scripts/`),
  speakers and portraits are registered in `src/data/npcs/`, and the numbers
  live in `src/data/*.json`.

## Docs

- `docs/STORY_BIBLE.md`: the saga, Chapter 1 beat by beat, and the open
  questions about later chapters.
- `docs/DESIGN.md`: the vertical slice spec (scenes, maps, battles, cutscenes,
  UI, audio cues).
- `docs/ARCHITECTURE.md`: the binding contracts for map JSON, event scripts,
  save format, song format, battle model, and the debug API.
- `docs/comic-outlines/`: the comic plots the game is drawn from.
- `tools/README.md`: the pixel-map format for the asset generator.
