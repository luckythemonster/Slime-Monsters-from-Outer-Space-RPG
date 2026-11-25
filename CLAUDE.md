# Slime Monsters from Outer Space: the RPG

You are building a 12-chapter SNES-style JRPG with Lucky. Chapter 1 is shipped on `main`. The job now is the
rest of the game, one chapter at a time. Lucky calls you Clode.

## Read these first, in this order

1. `docs/ROADMAP.md`: the plan for the whole game, the build order, and what is next.
2. `docs/STORY_BIBLE.md`: the authority on story. Every beat, every character, Lucky's decisions.
3. `docs/ARCHITECTURE.md`: how the engine is wired. Data formats, script commands, the battle contract.
4. `docs/DESIGN.md`: the Chapter 1 design spec. It is the model for every later chapter's spec.
5. The brief for the chapter you are on, under `docs/chapters/`.

Then, as needed: `docs/SUBPLOT_BAJONKA_RIDER.md` (Chapter 10), `docs/SIDEQUEST_MIC_CHECK.md` (Chapter 11),
`docs/comic-outlines/` (the source comics), `docs/PHASER_API_DIGEST.md` (Phaser 4 signatures).

## Commands

```
npm install
npm run dev                 # play at http://localhost:5173 (?fast=1 skips fades)
npm test                    # everything; about 15 minutes
node tests/data.test.mjs    # fast: every id in every data file resolves
node tests/battle.test.mjs  # fast: the battle model and every scripted battle
python3 tools/gen_assets.py --check       # validate the ASCII art
python3 tools/regen_assets.py .           # regenerate art, keep only PNGs whose pixels changed
```

The browser tests need Playwright and Chrome. A single suite reuses the last build with
`EXPLORE_KEEP_DIST=1 node tests/<suite>.mjs`; run `node tests/smoke.mjs` first to rebuild.

## How the game is made

- Phaser 4 (not 3), Vite, plain ES modules, no TypeScript. 256x224, integer pixels only.
- Everything is generated from text in this repo. Art is ASCII pixel maps in `tools/sprites/`, `tools/tiles/`
  and `tools/ui/`. Music is synthesized from `src/audio/songs/`. No third-party assets, ever.
- Content is data: maps, cutscene scripts, NPCs, enemies, riffs and items are JSON under `src/data/`. Scripted
  battle logic is code in `src/engine/battle/BattleScripts.js`.
- Sprites use the shared 32-color palette in `tools/palettes.md`, 16 colors or fewer per sheet.
- Generated PNGs are committed. The generator's compression differs by machine, so always regenerate with
  `tools/regen_assets.py`. A commit should only carry PNGs whose pixels changed.
- Zero console errors is a hard requirement.

## Working with Lucky

- Lucky uses they/them. So does Lucky the character, and so does Phoenix.
- Write to Lucky in short declarative sentences. Never use em-dashes in anything you write to them.
- Lucky trusts you with interpretive latitude. Make the call, then say which call you made. Ask first only when
  a choice cannot be undone and could reasonably go either way.
- The bible has open questions, each with a Default. Use the Default unless Lucky has answered. List the
  defaults you used in the pull request.
- Keep update logs out of final documents. The bible, the design specs and the briefs describe the game as it
  is. What changed and when goes in commit messages and pull request descriptions.
- When a build changes the story, change the bible in the same pull request. The bible never lags the game.

## The loop for every chapter

1. **Spec.** Turn the chapter's brief into `docs/chapters/CHxx_DESIGN.md`, in the shape of `docs/DESIGN.md`:
   scene flow, maps, cutscenes line by line, battles with numbers, items, assets, engine extensions, risks and
   cuts. Open a pull request with only the spec. Stop for Lucky.
2. **Build.** After Lucky approves, build in slices that each end green: engine extensions, then maps and
   cutscenes, then battles, then art and music, then the playthrough tests.
3. **Prove.** Every chapter ships with an honest playthrough test and a wrong-path twin, like
   `tests/chapter1.mjs` and `tests/chapter1_wrong.mjs`. All earlier chapters' tests stay green.
4. **Hand over.** One pull request per slice or per chapter. The description says what a player now sees, the
   calls you made, the defaults you used, and what you verified.

Do not start chapter N+1 before chapter N is merged. Saves carry forward.

## Canon that never breaks

These are Lucky's decisions. They hold in dialogue, narration, item text, menus and art.

- **Brian is a brain in a jar and nobody mentions it.** No character says so. The word never appears. He never
  learns. It is never explained. His portrait is a normal guy; his sprite is the jar.
- **Bajonka never speaks as a dog and is never explained.** She speaks only as a human, for one night, in
  Chapter 10.
- **Ryan never comes back.** After Chapter 1 he has no lines and one caption, from behind a fence.
- **The old band has no names.** A returning bandmate was cut from the game. Do not write one, name one, or
  add a second band on Planet California. `docs/design-proposals/` still names him in old text. That text is
  not canon.
- **Lucky's Mom is never on screen.** Dad is human. Lucky is half human.
- **No real people.** No real musician, politician or public figure appears as a character or gets invented
  dialogue. The game uses original stand-ins, already written in the bible. Do not add a name or a likeness that
  points at a real person.
- **Original designs only.** The Soy Boys are types, not copies of anyone else's characters. The same goes for
  every sprite.
- **Lines from the comics are verbatim.** A line the bible quotes without a *(new)* tag comes from
  `docs/comic-outlines/` and is not reworded. Lines tagged *(new)* or "proposal" can be improved.
- **Every chapter ends broke.**
- **The wedding ceremony does not ship unread.** The Chapter 10 ceremony needs a read from someone who grew up
  with Thai weddings before it is built. Say so again when you reach it.

## Known rough edges

- `tests/chapter1_wrong.mjs` failed once in section S10 (a null scene inside the test's `adjacentSpot` helper)
  during a full run, then passed twice. If it recurs, fix the race in the helper. Do not delete the check.
- `tests/content_c.mjs` plays the AUDITION by confirm-spam with an unseeded RNG. It lost the fight once in a full
  run (a game over while waiting for the contract), then passed twice. If it recurs, seed the battle or raise
  the test party's level. Do not delete the check.
- `src/engine/battle/BattleScripts.js` holds every scripted battle in one file. Split it per chapter before it
  grows (see the roadmap, Foundations).
