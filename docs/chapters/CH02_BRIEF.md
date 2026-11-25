# Chapter 2 brief: Gig in the Potato Belt

What Chapter 2 has to be. The design spec (`docs/chapters/CH02_DESIGN.md`) is written from this, in the shape of
`docs/DESIGN.md`, and Lucky approves it before any code.

- **Story:** `docs/STORY_BIBLE.md`, "Chapter 2". Ten beats, one boss, one stinger.
- **Source:** `docs/comic-outlines/Issue 1 page outline.txt`. Twenty-four pages. Lines quoted from it are
  verbatim in the game.
- **Length:** the bible says about 1.5 hours. The comic is a tight story: van, landing, barn, raid, getaway.
  Aim for 60 to 75 minutes and let the spec argue for more. Do not pad.

## What the chapter is for

Chapter 1 ended with a band of two, a stolen van and a tour tomorrow. Chapter 2 is the first tour date. The band
finds out it is good at one thing, playing through a raid, and gets paid in potatoes.

- The replacements arrive: **Diego** for Brian, **Warner** for Ryan. Warner is temporary and everyone can tell.
- The drummer who holds the beat while everything falls apart is the answer to the drummer who ran. The boss
  makes the player feel that: you can only hit hard when you are on Warner's beat.
- Lucky refuses a clipboard. That refusal is paid off in Chapter 7, when they read one.
- "Is that a dog?" happens for the first time. It is a gag here. It is the rescue in Chapter 9 and the plan in
  Chapter 11. Stage it the same way every time: the question, a cut to a wall, THUD.

## Where the player starts

The end of Chapter 1: Lucky and Phoenix, Bajonka attached as the save point, Van Keys, the Tour Itinerary and
the Tinny Ride Cymbal in the inventory, and Lucky locked magenta (`flags.luckyRageLocked`). The Pothole Invoice
is in the bible but not in the build; Foundations adds it (see the roadmap).
Chapter 2 opens the next morning. Lucky's color is back to normal rules by the time Diego knocks; decide in the
spec where the lock lifts and say why.

Read once and never again: `vars.quitResponse`. Phoenix remembers whether Lucky raged, pleaded or joked at Ryan.
One line, three versions, all tagged *(new)*.

## Scenes

Scene ids are proposals. Lines in quotes are canon unless marked *(new)* in the bible.

| # | Scene | Where | What happens | Toon |
|---|---|---|---|---|
| 1 | The door | apartment (reuse) | Diego, very tall, with the cop's mohawk: "Man, I think this is yours? Also I play guitar. The vibes last night were heavy." Diego joins. | 0 |
| 2 | The other door | apartment | Warner, stick bag: "Is this the band from the... the wave? Sorry, I had midterms." The signal worked, three weeks late. Warner joins. | 0 |
| 3 | The van | the curb, then space | The first look at the van Bajonka stole. Rust, welded thrusters, duct tape on the mirror. Title card. | 2 |
| 4 | Driving | space lanes | Phoenix drives. "Take the next orbital exit, Phoenix. And don't clip the toll booth, I don't want to know who Bajonka stole this van from." Diego: "Man, the stars out here are heavy." | 1 |
| 5 | The name | the van | Warner starts to say Ryan's name. Lucky goes magenta: "We don't say his name." / "Cool. Cool cool cool." See bible beat 4. Nothing else about Ryan is said in this chapter. | 1 |
| 6 | Parking | zero gravity | "My brain thinks if I have to manually parallel park this thing in zero gravity, I am going to walk into the sun." A short parking minigame. No fail state that costs progress. | 2 |
| 7 | The Belt | atmosphere, the trench | Combine-harvesters like floating fortresses. Warner: "Wow. They really gentrified the farming sector. Real dystopian vibe." SQUELCH. "We're here. Please don't make me drive back." | 1 |
| 8 | Humidity | the trench | Phoenix gains MELTING. "My brain thinks I am going to become a puddle. Put me in a Tupperware container." / "Hold it together, Phoenix. We load in, we play fast, we get paid." | 2 |
| 9 | Load-in | the ramp, the barn | The crowd: farm laborers with crude cybernetic limbs. Diego: "Right on. Good vibes tonight, brothers." / "I am going to bite someone." Bajonka carries a snare on her head. | 1 |
| 10 | The khakis | the barn | "Feds. 3 o'clock. They look like they're about to audit a mosh pit." / "Man, I do not have an interstellar visa." / "Diego. If you send a cop a 'positive vibration,' I will personally launch you into the sun." | 2 |
| 11 | The set | pallet stage | "We are the Slime Monsters From Outer Space! This one's called Monsters!" Warner counts it in. The pit opens. Lucky's leg stretches across the stage to tweak a knob. | 2 |
| 12 | Positive ID | the pit | "Command! Positive ID! It's the missing Vanguard biological asset! The pink slime!" / "Sector 4 underground! Execute breach! EXECUTE BREACH!" | 1 |
| 13 | **Boss** | pallet stage | The roof detonates inward. Three Riot Drones. See below. | 3 |
| 14 | The dock | loading dock | Silent. A guard: "Hey... is that a dog?" Cut to the wall. THUD. Bajonka loads a bass cabinet with her teeth. | 1 |
| 15 | Door money | loading dock | The Promoter: "There is no door money. The gig was a stress test. And you passed." The clipboard, section 4A. Lucky slaps it into the mud: "I'm not joining your bureaucratic book club!" The sack: "I'm taking these as payment!" | 1 |
| 16 | Orbit | the van | Diego eats a raw potato: "Honestly, guys? Great first gig. The energy was very grounding." The eviction warning. "My brain thinks we need to start selling merch." | 2 |
| 17 | Stinger | the cup holder | A potato with Sharpie on it: "We are all slime." | 0 |

Walkable space between scenes 8 and 11 is where the chapter gets its length: the trench, the ramp, the barn
floor before the set. Fill it the way Chapter 1 filled Cedar Avenue: every tile has a joke, a handful of fights
that stay dead, one optional mini-boss.

## The boss: Vanguard Riot Drones, "The Riot Solo"

The one rule: **Lucky only hits hard on Warner's crash.**

- The song is `band_monsters`, the band's own song, already in `src/audio/songs/`. It is not used anywhere in
  Chapter 1. This is its first appearance and it should be.
- **Round one.** Diego is HIDING ("Whoa. Bad vibes. No visa."), behind the bass cabinet, no turn, cannot be
  targeted. Phoenix is CONFUSED ("My brain thinks we missed a time signature change."), hands hovering, no
  useful turn. Warner does not stop. It is guitar and drums against three drones.
- **The beat.** Warner's crash flashes on a visible beat. Lucky's GUITAR SWING, the guitar body swung like a
  bat, lands as a crit only when confirmed on the crash. Off the beat it is an ordinary hit.
- **The rally.** Staying on the beat brings the others back. Phoenix first, then Diego. Diego's line from behind
  the amp is canon: "That was actually a really nice phrasing, man."
- **Drones.** Three armored spheres. A targeting laser telegraphs the next stun-blast. ZAP.
- **Cannot flee. Can be lost.** Autosave before it, like every scripted battle.
- **After.** "Show's over! Load out!"

Decide in the spec: Warner's control. Proposal: the player controls him in ordinary fights and he is AUTO in
this one, because the point of the fight is that he does not need telling.

## New things to build

Each is on the roadmap's systems table. Build them to be used again.

1. **Chapter start.** From Foundations: CONTINUE on an end-of-Chapter-1 save lands in scene 1.
2. **Beat-timed input in battle.** A visible beat driven by the sequencer (the cosmetic beat lamp and
   `onBeat` already exist), a timing window, and a result the battle model can read. It must be deterministic
   under test: give the debug API a way to force on-beat or off-beat, the way `chooseIndex` forces a choice.
   Add an assist setting now (a wide window or auto-timing). Every later rhythm system inherits it.
3. **The van.** Travel from orbit to the Belt. Cheapest version that works: an ordinary map with the van as the
   player's sheet. It comes back in Chapters 3 to 5 and dies in Chapter 6.
4. **The parking minigame.** A bespoke scene like `FreefallScene`. Short. Skippable after a few tries.
5. **Statuses.** HIDING, CONFUSED, MELTING, and the drones' stun. MELTING is a field status from the map.
   Proposal: a Tupperware item cures it.
6. **A four-person party the player controls.** Chapter 1 had Brian as a liability and Ryan on AUTO. This is the
   first real party of four. Check the menus, the turn strip and the battle layout with four live commands.
7. **The crowd bank.** The set before the raid adds to `vars.crowdBank` (see the roadmap).
8. **The eviction warning.** One screen on Phoenix's phone. The clock goes live in Chapter 3.

## New content

- **Party:** Diego (guitar, red Strat, HIGH) and Warner (drums). Field sheets, battle sheets, portraits, riffs.
  Diego already stands in Palmer's as `stranger_tall`; match him. The bible seeds Warner at Palmer's as well,
  but he is not in the build. Scene 2 can be his first appearance, or add him to the Palmer's crowd.
  Diego's TALK command does not exist yet. It unlocks in Chapter 3. Do not give it to him early.
- **NPCs:** the cyborg farmers (three or four builds), two khaki agents, the dock guard, the Promoter (trench
  coat, neon-blue cigarette), an opening band.
- **Enemies:** the Riot Drone, and four to six ordinary encounters for the trench and the ramp. Rule: **no
  potato enemies.** The potatoes are people in Chapter 3. The player should not have been hitting them.
- **Optional mini-boss, proposal:** THE TOLL BOOTH. Lucky says not to clip it. Clip it.
- **Maps:** the curb, space lanes, the trench, the ramp, the barn (pit and pallet stage), the loading dock, the
  van interior. The barn needs a roof-gone state, like `palmers_rubble`.
- **Key items:** RAW COSMIC POTATOES (the sack; it is the merch in Chapter 3). The eviction warning.
- **Music:** `band_monsters` for the boss. `band_spud_nothin` exists and belongs somewhere in a chapter called
  the Potato Belt. New: a driving-through-space theme, the Belt, the barn before the set, broke in orbit.

## What must be true when it is done

- A player can go from CONTINUE on a Chapter 1 save to the stinger without a console error.
- `tests/chapter2.mjs` plays it honestly. `tests/chapter2_wrong.mjs` takes every branch: off the beat for the
  whole boss, the boss lost and retried, every NPC talked to, every map edge, the minigame failed.
- `tests/battle.test.mjs` covers the Riot Solo with a seeded RNG: on-beat crits, off-beat does not, the rally
  order, the loss.
- Every Chapter 1 test still passes. An end-of-Chapter-1 save made before this work still loads.
- The chapter ends broke. The money counter at the stinger is lower than the player hoped.
- Nothing in the chapter mentions the jar, names anyone from Lucky's old band, or gives Ryan a line.
- `docs/ROADMAP.md`'s carry-over ledger has a row for everything this chapter writes that Chapter 3 reads:
  the potatoes, the eviction warning, `vars.crowdBank`, Warner still in the party.

## Cut order, if it runs long

1. The Toll Booth.
2. The opening band's set.
3. Ordinary encounters down to three.
4. The parking minigame becomes a cutscene with the line.

Never cut: both doors, "We don't say his name", MELTING and the Tupperware line, the leg, the beat rule,
"is that a dog?", the clipboard slap, the sack, the potato in the cup holder.
