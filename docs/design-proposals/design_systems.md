# Vertical Slice Design — Systems

Chapter 1 "Coagulation", 45–75 minutes, Phaser 4 + Vite, 256×224. This document is the numbers: every formula, table and script hook an implementer needs to build `BattleModel`, `formulas.js`, `BattleScripts.js` and the data JSON described in `docs/ARCHITECTURE.md` §8 and §12. Story beats follow the Episode 0 script with Lucky's plot tweaks (Lucky → Phoenix → Brian → Ryan; Brian quits over KRAAANG and the crooked house; Ryan becomes The Eternity, levels Palmer's, and quits on the spot).

## Pillars

- **Every fight is a song.** Turn order is the SETLIST, basic attacks are STRUMs, techs are RIFFs, the party resource is AMP, and the shared meter is the TOON METER. No sword vocabulary anywhere.
- **The Toon Meter is the comic's Toon Level made mechanical.** It fills with noise, it unlocks physics-breaking SFX-word attacks (POP! / KRAAANG / KRATHOOM), and the game's presentation escalates with it (shake → physical SFX words → the UI frame tears → the art ruptures). Toon 4 is never player-reachable; it is The Eternity.
- **The band is the party, and the band is unstable.** Brian is a playable liability (Market Alignment halves meter gain, Buzzkill eats his turns). Ryan is a possessed ally the player never controls. Both quit. The roster is a story device, not a loadout.
- **Small numbers, readable math.** Two-digit HP, single-digit stats, integer arithmetic, ±10% variance. A street fight is 3–4 rounds; a boss is 6–8. Tuned so a player who dodges every optional fight still finishes, and one who fights everything hits L8 at Palmer's.
- **Broke is the permanent condition.** $4 and a half-ounce of weed at the start, maybe $40 by the end, one instrument upgrade if you sell Brian's fried pedalboard. Money is a joke with teeth.

## Scene-by-scene flow

Times are target wall-clock for a first-time player at normal text speed; `?fast=1` roughly halves them.

| # | Scene (Toon) | Map | What the player does | Systems introduced | ~min |
|---|---|---|---|---|---|
| 1 | Pod bay (1) | `pod_bay` | Dad's intercom monologue; the only interactable is the speaker. Interact → pseudopod SQUELCH, EJECT button lights up; interact → launch. | Dialogue, interact, caption | 2 |
| 2 | Freefall (3) | `Freefall` scene | 20 s steering minigame: left/right to pass through WORK IS LOVE billboards and glitch them; slime sunglasses form at t=5 s. 3+ billboards glitched ⇒ tutorial battle opens at Toon 1 ("still buzzing"). | Special scene | 2 |
| 3 | Alley (2) | `alley` | KRATHOOM crash; CRASH word knocks dumpsters over (they become solid deco). Phoenix: pothole line. Rant; shared aura; "Beats the day job." A Vanguard Retrieval Drone drops in. **Tutorial battle** (scripted): Phoenix hops in on round 2 with the trash bag. Phoenix joins. Couch-cushion $2 is in the apartment, not here. | Battle: STRUM, RIFF, AMP, Toon fill, Lucky's color HUD | 6 |
| 4 | Apartment (2) | `apartment` | Posters, bills, fridge (1 Tater Tot Hotdish), couch ($2), Phoenix's real bass (auto-equip, Trash Bag goes to inventory). Bass amp interact → the signal: screen border bends, montage cutscene, Ryan's garage, sticks hover. "End Part 1." Caption ONE WEEK LATER. "Nobody came." | Menu (Items/Riffs/Equip/Status), equipment | 4 |
| 5 | Streets hub (1) | `street_west_bank` | Open hub. 4 on-map enemies (Slush Pile, Canada Goose, Scooter Pack, Demographic Analyst) + optional WORK IS LOVE Billboard mini-boss. Pawn shop, coffee shop. City Sound and Palmer's doors locked. | On-map enemies, shops, Toon carryover, NOISE (POP! at Toon 1) | 10 |
| 6 | Coffee shop (1) | `coffee_shop` | Phoenix pins the flyer on the corkboard. Brian is already reading it. Sticker/bass-down/"I'm not a man, Brian" exchange. **Brian joins (L3).** He buys the table coffee (+2 Gas Station Coffee). "You need a drummer. I know a guy." | Temp party member, Market Alignment | 4 |
| 7 | Phone call (1→2) | `ryan_garage` (cutscene) | Brian calls. Ryan has not moved since the wave; slime still drips from the hovering sticks. "Ryan. It's Brian. From the Zappa cover band. I've got a thing." "Yep." City Sound unlocks. | — | 2 |
| 8 | City Sound hallway (0–1) | `citysound_hall` | Sticker hallway. Ryan carrying an impossible stack. Bajonka outside Room 4 with the clipboard; nod; sneeze; time-skip, clipboard gone. **Bajonka = save point from here on.** | Save | 3 |
| 9 | Room 4: AUDITION (3) | `citysound_room4` | "$4 and a half-ounce" line. Pedal stomp; "One, two, three, four!" **Boss: AUDITION.** On the first downbeat Ryan is possessed (AUTO ally, friendly-fire hazard). Enemies are the sound walls WHRNNNG and THUD-THUD. Survive 6 rounds; Ryan's captions are the clock. "So, do I get the gig?" Bajonka drops the contract. **Ryan joins (L4, AUTO).** | Scripted battle, AUTO ally, Ryan's captions | 8 |
| 10 | ONE MONTH LATER (0→2) | `citysound_room4` | Duct-taped card. Hub re-opens briefly with 2 new enemies (Analyst Duo, Goose Pair) and the pawn shop restocked. Back in Room 4: **Rehearsal battle vs. The Chorus.** Goal: reach Toon 2 and use KRAAANG (auto-fires on round 8 if the player won't). The G swings, the iced coffee spills, the pedalboard fries. "I hate this weird, creative shit!" | KRAAANG, Brian's sabotage in full | 7 |
| 11 | The ultimatum (1) | `citysound_room4` | Lucky unplugs (POP). "Stop being an asshole, or you are fired." X-ray of Brian's brain. "Are you calling my house crooked?!" Phoenix: stroke line. "You're just jealous of my equity!" Door slam. **Brian leaves; FRIED PEDALBOARD key item.** Bajonka drops the Palmer's flyer. "NO GUITAR SOLO NECESSARY." Palmer's unlocks. | Party remove, sellable key item | 4 |
| 12 | Palmer's exterior/interior (1) | `palmers_ext`, `palmers_int` | Bajonka save point outside. Inside: six-inch stage, crowd, the mohawk cop. "Dispatch, I have located the unauthorized slime gathering." Set up: interact with the amp to start. | — | 3 |
| 13 | THE SET AT PALMER'S (2→4) | `palmers_int` | **Boss.** Cop + crowd; backup arrives round 3. First STRUM/Sync blows the mohawk into a beer. Ryan in Pocket form: on-beat, no friendly fire, Toon +8 per action. At Toon 3 (or round 6): "I've been fighting the possession. That was a mistake." Purple. **THE ETERNITY**: Toon forced to 4, DOOM / CRACK / THUD, the roof peels, walls blow out, win. No inputs. | Toon 3 UI tear, Toon 4 rupture, scripted unstoppable win | 8 |
| 14 | Rubble (1) | `palmers_rubble` | "Okay. That is our sound." / "domestic terrorists" / "I think I broke the space-time continuum on that snare fill." Ryan looks at his hands. **"I quit."** Lucky goes magenta (`lucky_rage` sheet for the rest of the slice). Choice: rage / plead / joke — all end in "Yep." He walks north off-screen. **Ryan leaves.** Bajonka: van keys, itinerary, POTATO BELT: TOMORROW. "We don't have a drummer." Sneeze. Caption: NEXT: THE POTATO BELT (DRUMMER WANTED). | Ending, final save prompt | 5 |

Total: ~68 minutes with every optional fight; ~48 skipping the hub's optional content.

## Maps

| id | Name | W×H | Exits | Key NPCs / objects | Enemies |
|---|---|---|---|---|---|
| `pod_bay` | Vanguard Drop-Pod Bay | 12×10 | → Freefall (scripted) | Intercom speaker (interact), EJECT button (interact, lit after SQUELCH), pod | — |
| `alley` | Alley behind Palmer's | 20×14 | W → `street_west_bank` (locked until Phoenix joins) | Phoenix (NPC → party), trash bag, 4 dumpsters (knocked over by CRASH → solid deco), glowing pothole (flavor interact) | Vanguard Retrieval Drone (scripted tutorial) |
| `apartment` | Phoenix's Apartment | 14×12 | S door → `street_west_bank` | Bass amp (trigger: signal cutscene), fridge (Hotdish), couch ($2), bass (equip), posters ×3 (flavor), bill pile (flavor: "$1,340 PAST DUE") | — |
| `street_west_bank` | West Bank Streets (hub) | 40×20 | `alley` (SW), `apartment` (N door), `coffee_shop` (E door), `pawn_shop` (S door), `citysound_hall` (NE door, locked until flag `ryanCalled`), `palmers_ext` (W, locked until `hasPalmersFlyer`) | WORK IS LOVE billboard (optional mini-boss, static), bus-stop NPC ("Hello Fellow Kids" foreshadow guy), snowbank, 2 flavor NPCs (hot-dish lady, crypto guy) | Slush Pile, Canada Goose, Scooter Pack ×3, Demographic Analyst; after `auditionDone`: Analyst Duo, Goose Pair |
| `coffee_shop` | Grounds for Dismissal | 14×10 | S door → hub | Corkboard (flyer trigger), Brian (NPC → party), barista (shop: consumables), tip jar (flavor) | — |
| `pawn_shop` | Lake Street Pawn & Loan | 12×8 | S door → hub | Pawn guy (shop: equipment, buys Fried Pedalboard $11 / Half-Ounce $20 / Price-Tag Jacket $20), Sticky under a tarp (flavor foreshadow, "NOT FOR SALE (YET)") | — |
| `ryan_garage` | Ryan's Garage (cutscene only) | 12×10 | none (teleport in/out) | Ryan at kit, hovering sticks, slime drip, landline phone | — |
| `citysound_hall` | City Sound Rehearsal Studio — hallway | 24×8 | W door → hub; E door → `citysound_room4` (locked until Bajonka beat) | Bajonka (save, clipboard), Room 1–3 doors (flavor: muffled bands), sticker wall | — |
| `citysound_room4` | Room 4 | 12×10 | W door → hallway | Lucky's amp (battle trigger), Ryan's kit, Brian's pedalboard (deco after he joins; "FRIED" variant after KRAAANG), iced coffee (deco) | AUDITION, The Chorus (scripted) |
| `palmers_ext` | Palmer's Bar — exterior | 20×12 | E → hub; N door → `palmers_int` | Bajonka (save), neon sign, smoker NPC, van (flavor, "whose van is that?") | — |
| `palmers_int` | Palmer's Bar — interior | 24×14 | S door → exterior (locked once the set starts) | Stage amp (battle trigger), bar, 6 crowd NPCs, undercover cop (NPC, price tag visible) | THE SET (scripted) |
| `palmers_rubble` | Palmer's Bar — rubble | 24×14 | none (ending) | Same layout with `rubble` legend; sky where the roof was; Bajonka (save, final) | — |

Tilesets: `vanguard` (pod bay: chrome, red EJECT, intercom grille), `minneapolis` (snow, slush, sidewalk, brick, lit windows, billboard pieces, dumpster, neon), `interior` (apartment / coffee / pawn / studio: floor, wall, poster, amp, kit, corkboard, counter), `palmers` (bar wood, stage, neon, rubble/sky variants).

## Exploration & interaction

- Grid-locked 4-direction movement, 7 tiles/s walk, 11 run (ARCHITECTURE §12.3). Interact = `confirm` facing an entity with a `script`. Emote bubbles on NPCs when the player is adjacent.
- **On-map encounters only** (Chrono Trigger). Enemy entities use `behavior: chase` with `sight` 4–6 tiles; the Billboard is `static` and must be interacted with ("It's humming. Fight it?" choice). No random encounters; `encounters.rate` is 0 on every map.
- Defeated enemies set a flag and are gone for the chapter. The "ONE MONTH LATER" card sets `flags.monthLater`, which spawns two new hub enemies and restocks the pawn shop. This bounds total XP (see Progression) so tuning is deterministic.
- **Touching a chasing enemy starts the battle with the enemy getting a free first round if it touched you from behind** (player facing away): the SETLIST shows the enemy first. Touching it head-on gives the party normal initiative. No preemptive strikes; keep it simple.
- **Physical SFX words on the map** (Toon ≥ 2 rule from the comic): the alley CRASH and the Room 4 KRAAANG leave letter sprites on the map as solid deco after their cutscenes. Pure presentation, no system.
- Flavor interactions are Earthbound-dense: every poster, bill, dumpster and the pothole has one line. Budget: 40 flavor lines across the slice (see Content inventory).
- Menu (pause): Items / Riffs / Equip / Status / Save (Save is disabled outside Bajonka; the entry reads "Find the dog").

## Battle system

Side-view, turn-based (FF1–6 presentation; Chrono Trigger techs and scripted events; Earthbound flavor). Enemies on the left (x 24–120), party on the right (x 168–232) in up to 4 slots stacked vertically (y 72, 100, 128, 156), each 32×32 battle sprite with feet at the slot's y. Background is the map's `battleBackground`.

### Round structure

1. **SETLIST**: at the start of each round every living combatant rolls `init = effSPD + rng(0..3)` and the round order is init descending. Ties: party before enemies, then roster order (Lucky, Phoenix, Brian, Ryan), then enemy slot order. `effSPD` = SPD × 1.5 (TEMPO UP) or × 0.5 (TEMPO DOWN), floored. The SETLIST strip at the top of the screen shows the order as 8×8 icons; it is recomputed each round, not continuously (no ATB).
2. On a party member's turn the command window opens; input is per-turn (FF6 without the clock). AUTO allies (possessed Ryan) and enemies decide via AI.
3. A round ends when everyone has acted; status durations tick at the end of the round; hooks `onRound(n)` fire at the start of round n.
4. Win when all enemies are KO'd or fled (or a script emits `win`); lose when all **controllable** party members are KO'd (AUTO Ryan does not keep the party alive).

### Stats

HP, **AMP**, ATK, DEF, SPD, LCK. Equipment adds flat to ATK/DEF/SPD/LCK. Every riff has a **frequency**: `PHYS` (trash bags, drumsticks, pecks), `LOW` (bass), `HIGH` (guitar), `NOISE` (vocals, drums, SFX words). Enemies declare `weak` (×1.5) and `resist` (×0.5) frequencies.

### Formulas (`formulas.js`)

All integer; `rng(a..b)` is uniform inclusive from the model's seeded RNG.

```
hit%   = clamp(90 + (effSPD_att − effSPD_tgt) × 2 + accMod, 55, 100)
         accMod: riff accuracy modifier (most 0; Feedback Squeal −10), OUT OF TUNE −30 on the attacker,
         Brian with the $2,000 Pedalboard: always 100.
crit%  = 3 + floor(LCK / 2) + 3 × toonLevel          (Brian: always 0)
raw    = max(1, ATK × 2 − DEF_tgt)                    (crit: DEF_tgt = 0)
dmg    = floor(raw × POW / 100 × (90 + rng(0..20)) / 100)
dmg    = floor(dmg × freqMult)                        (1.5 weak / 0.5 resist / 1.0)
dmg    = floor(dmg × (100 + 5 × toonLevel) / 100)     (party attacks only)
dmg    = crit ? dmg × 2 : dmg
dmg    = target is TUNING (defending) ? floor(dmg / 2) : dmg
dmg    = max(1, dmg)
heal   = floor(POW × (90 + rng(0..20)) / 100)         (flat, POW is the riff's number)
flee%  = clamp(50 + (avgPartySPD − maxEnemySPD) × 5, 10, 90)   (BAIL; refused in scripted battles)
```

Sanity at L1: Lucky (ATK 7 + Beat-Up Guitar 3 = 10) STRUMs the Drone (DEF 3): raw 17 → 15–18 damage; Drone HP 30 dies in two hits. Drone (ATK 6) hits Lucky (DEF 4): raw 8 → 7–8 per hit against 28 HP. Four rounds to lose if the player never attacks; the tutorial cannot kill a player who presses anything.

### Commands

Six commands in a 2×3 window (FF6 layout), left column STRUM / RIFF / NOISE, right column ITEM / TUNE / BAIL.

| Command | What it does |
|---|---|
| **STRUM** | Basic attack with the equipped instrument's frequency, POW 100. On hit, **+2 AMP** to the attacker (plugging in). Lucky's crits inflict SLIMED. |
| **RIFF** | Opens the tech list: single riffs first, then **SYNC** (double techs) below a divider, grayed with a reason ("Phoenix already played" / "needs 5 AMP" / "Brian hates this"). Costs AMP. |
| **NOISE** | Spends Toon levels on SFX-word attacks (below). Consumes the actor's turn; damage uses the actor's ATK. Grayed below Toon 1. |
| **ITEM** | Inventory. Consumables only. |
| **TUNE** | Defend: incoming damage halved until the actor's next turn, **+4 AMP**, cures OUT OF TUNE on self. |
| **BAIL** | Flee roll (formula above). On failure the round continues. Refused (grayed, "the dog has the contract") in scripted battles. |

### Resources: HP and AMP

**AMP** is the band resource (the save format in ARCHITECTURE §6 already carries `amp`). Why AMP and not Volume or Feedback: AMP is *headroom* — a pool you spend on riffs and refill by playing, which gives the basic attack a job (STRUM +2, TUNE +4) instead of being the dead turn it is in most JRPGs. Volume would read as a meter, not a pool; Feedback is a status effect here. AMP persists between battles and is fully restored by Bajonka saves, Gas Station Coffee, the Half-Ounce, and story rests (apartment, the ONE MONTH LATER card). Max AMP grows with level (8–22 for Lucky). Riffs cost 2–8, so a fresh L3 Lucky has three riffs in the tank and then has to STRUM to earn the fourth — that loop is the whole feel of a fight.

### The TOON METER (shared party meter)

Named after the comic's Toon Level and labeled **TOON** in the HUD: a 0–100 point bar drawn as four 24-px segments; filling a segment raises the **Toon Level** (0–4). Thresholds 25 / 50 / 75 / 100.

Fill (party actions only; enemy actions never fill it):

| Event | Points |
|---|---|
| STRUM hits | +4 (crit +8) |
| RIFF | +6 |
| SYNC | +10 |
| A party member takes damage ("comedy of pain") | +3 |
| Enemy KO | +5 |
| Possessed / Pocket Ryan acts | +8 (he is always on-beat) |
| Phoenix's My Brain Thinks | +5 |
| Band Sticker accessory equipped on the actor | +1 per action |
| **Brian in the party (Market Alignment)** | all gains halved, floor |

Spend: the **NOISE** command. Each word costs whole levels (25 points per level) and the meter drops by exactly that.

| Word | Needs | Cost | Effect |
|---|---|---|---|
| **POP!** | Toon 1 | 25 | Single enemy, NOISE, POW 150. Removes one buff. A cartoon POP word bonks the target; the enemy sprite squashes. |
| **KRAAANG** | Toon 2 | 50 | All enemies, NOISE, POW 180, 40% DAZED. The word manifests at the top of the screen; the G swings down like a bat. Enemies with 32-px sprites have a 25% chance each to be **knocked off-panel** (removed, no XP, no $). |
| **KRATHOOM** | Toon 3 | 75 | All enemies, NOISE, POW 260, ignores DEF. The actor gains BRISTLING (2 turns). The UI frame tears: window frames jitter ±2 px for the rest of the battle. |
| DOOM / CRACK / THUD | Toon 4 | — | Listed grayed as "???". Scripted only: The Eternity. |

Other effects of Toon Level: crit% +3 per level; party damage +5% per level; battle background behavior (0–1 static, 2 scrolling, 3 sine-warped, 4 palette-cycled rupture); camera shake on hits scales with level. **Toon is capped at 99 for the player**; only `BattleScripts` can set 100.

Carryover: the meter persists between battles at `floor(meter / 2)` (saved in `GameState.meter`), so chaining the hub's fights lets a player open the third one with KRAAANG. It resets to 0 on any `caption` time card and on load. Scripted battles may set a starting value (the AUDITION starts at 0; THE SET starts at 25 — the room is already loud).

### Slime Sync (double techs)

Listed under RIFF. Rules: both participants alive, not DEAF, each with the AMP cost; the partner must **not have acted yet this round** — the Sync fires immediately on the initiator's turn and consumes the partner's turn (their SETLIST icon is crossed out). Only slime can Sync: Brian is never a partner ("Brian hates this"), Ryan only via script.

| Sync | Pair / unlock | AMP each | Effect |
|---|---|---|---|
| **Shared Aura** | Lucky + Phoenix, from the tutorial | 4 | Both heal 25% max HP, all statuses cured, +10 Toon. The alley's linked aura. |
| **Low-End Theory** | Lucky L3 + Phoenix L3 | 5 | All enemies, POW 160, frequency LOW *and* HIGH (uses the better multiplier), 50% TEMPO DOWN. |
| **Wall of Sound** | Lucky L5 + Phoenix L5 | 8 | All enemies, NOISE, POW 220, +15 Toon. |
| **Pocket** | Lucky + Ryan (script only, THE SET) | — | Ryan's AI casts it when Toon ≥ 50: all enemies NOISE POW 200, +12 Toon. The slime syncs with the kick drum. |

### Status effects

Durations are in rounds, ticking at round end. Icons are 8×8 in the HUD next to the name.

| Status | Effect | Duration | Cure |
|---|---|---|---|
| **DAZED** | Skips its next turn. | 1 | — (Spiky Slime Sunglasses: immune) |
| **DEAF** | Cannot use RIFF, SYNC or NOISE. | 3 | Hand Warmer, Shared Aura (Earplugs: immune) |
| **OUT OF TUNE** | hit −30. | 3 | TUNE, Shared Aura |
| **TEMPO DOWN / UP** | SPD × 0.5 / × 1.5 in the SETLIST roll. | 3 | Hand Warmer cures DOWN |
| **BRISTLING** | ATK +50%, DEF −25%. Lucky's sprite swaps to `lucky_rage`. | 3 | — |
| **SLIMED** (enemies) | DEF −3; takes ×1.25 from LOW and HIGH. | 4 | — |
| **BAKED** (party, from the Half-Ounce) | SPD −3, DEF +3. | 3 | — |
| **ON HOLD** (cop only) | Counting down; at 0, backup arrives. Shown as a phone icon. | 2 | scripted |
| **KO** | Out until revived. | — | Tater Tot Hotdish |

No stacking: reapplying refreshes the duration. TEMPO UP and DOWN cancel each other.

### Enemy AI

`enemies.json` gives each enemy an `ai` list evaluated on its turn: rows whose `if` holds (the §5.3 evaluator, extended with `hp`, `hpPct`, `round`, `allies`, `toon`, `partyHas('status')`, `turnsSince('riff')`) are weighted-random. Each row names a riff and a targeting policy: `random`, `lowestHp`, `highestAtk`, `notRyan`, `self`, `all`.

```jsonc
"ai": [
  { "if": "round == 1",            "do": "hiss",  "target": "random",   "weight": 6 },
  { "if": "hpPct < 40 && allies == 0", "do": "flee", "weight": 3 },
  { "do": "peck", "target": "lowestHp", "weight": 4 },
  { "do": "wait", "weight": 1 }
]
```

Three archetypes cover the slice: **Brute** (two attacks, one applies a status), **Caller** (buffs or summons on a timer: the cop's ON HOLD, the Analyst's Dental Plan), **Swarm** (scooters: a group riff that only fires while 3 are alive). Enemies never heal above 50% of max HP and never target KO'd characters; `notRyan` exists so THE SET's cops hit the people who can actually lose.

### Scripted battle events

Keyed by encounter id in `BattleScripts.js` using the ARCHITECTURE §8 hooks, plus three additions this design needs (listed under *Required extensions* below). Each hook returns an array of presentation events the model appends to `model.events`.

**`ep0_drone` — Tutorial (alley).** Encounter: Retrieval Drone. Party: Lucky alone.
- `onStart`: text "A Vanguard Retrieval Drone followed the pod." Tutorial toast: "STRUM to attack. Hits put AMP in the tank."
- `onRound(2)`: event `join` Phoenix (L1, Trash Bag equipped) with text "Phoenix: 'Beats the day job.'" Toast: "RIFF spends AMP. Power Chord is 3."
- `onHpBelow(drone, 50)`: drone text "RETRIEVAL TARGET IS NONCOMPLIANT." Toast: "The TOON meter is filling. At 25 you can make NOISE."
- `onDefeat(drone)`: text "It leaves a $2 severance check." Give $2.

**`ep0_audition` — AUDITION (Room 4).** Enemies: WHRNNNG (x 40) and THUD-THUD (x 88), 64-px letter-wall sprites. Party: Lucky, Phoenix, Brian, Ryan(AUTO). `noFlee`. Toon starts 0.
- `onStart`: Lucky "One, two, three, four!" → `anim ryan drum` → `transform ryan → ryan_slimed`; `status ryan AUTO on`; screen `camera.shake 600` and the HUD frame jolts 3 px right for the whole battle (`uiTear` event, strength 1). Ryan caption: "[Well. I guess my arms belong to the goo now.]"
- `onRound(3)`: caption "[Tempo's good, though. Very steady.]"
- `onRound(5)`: caption "[Ride cymbal sounds a bit tinny. Should probably buy a new one if I survive this.]"
- `onRound(7)`: text "The song crashes to a halt." → `win`. (Six full rounds are "the song".)
- Also wins early if both walls are KO'd. Ryan's **Fill** riff targets a random *party member* 30% of the time for POW 180 PHYS — the ally-as-hazard. Ryan cannot drop below 1 HP (rule `minHp: 1` on possessed Ryan: "the goo won't let him fall").
- `onDefeat(any party member other than Ryan)`: nothing special; the party can lose this fight.
- On win, before rewards: text "Holy shit. You're a machine." / caption "[I am literally a hostage.]" / "So, do I get the gig?"

**`ep0_rehearsal` — The Chorus (Room 4, ONE MONTH LATER).** Enemy: The Chorus (a 48-px pulsing speech balloon, HP 150, harmless). Party: Lucky, Phoenix, Brian, Ryan(AUTO, Possessed). `noFlee`. Toon starts 0 and Brian halves gains, so Toon 2 arrives around round 5 — the player feels the drag.
- `onStart`: caption "[I give this guy three weeks. Tops.]" Toast: "Hit the chorus. Get to Toon 2."
- `onAction(actor, action)` where action is NOISE **KRAAANG** (any actor), or `onRound(8)` if it never happened (text "Lucky and Phoenix's slime links up on its own." then forced KRAAANG from Lucky): the G swings (`anim word_kraaang swing`), `damage brian 1` with text "The G knocks over Brian's boutique iced coffee.", `transform brian → brian_fried` (sparks), `status brian OUT OF TUNE on`, text "Brian: 'I can't work like this! I hate this weird, creative shit! Can't we just play normal music?!'" → `win`.
- Reward: 30 XP. Then the ultimatum scene runs as a map script; `party remove brian`; give key item Fried Pedalboard.

**`ep0_palmers_set` — THE SET AT PALMER'S.** Enemies: Undercover Cop (48 px, x 64). Party: Lucky, Phoenix, Ryan(AUTO, **Pocket** form from the start — he is already "a bubbling mass of green"). `noFlee`. Toon starts 25.
- `onStart`: cop text "Dispatch, I have located the unauthorized slime gathering. Stand by." `status cop ON HOLD (2)`.
- `onAction` first party STRUM or SYNC: text "The first power chord blows the front row's hair back." `anim cop mohawk_off` ("The mohawk lands in a stranger's beer. The stranger says 'whoa, man.'"). Ryan caption: "[No obnoxious guitar solos. Just pure, unadulterated rhythm. The slime is pulsating in 7/8 time. I can work with this.]"
- `onRound(3)`: `spawn` Backup Cop ×2 (x 24 and x 104) with text "Backup. Also in leather jackets. Also with price tags."
- `onDefeat(cop)` / `onDefeat(backup)`: converted to `flee` ("…crawls toward the exit"). Cops never die; they run later.
- `onToon(3)` **or** `onRound(6)`, whichever first: caption "[I've been fighting the possession. That was a mistake.]" → `transform ryan → ryan_pocket_purple`; the background shifts to the Toon 3 warp; `uiTear 2`. Set flag `eternityArmed`.
- Ryan's next turn after `eternityArmed`: **THE ETERNITY.** `meter 100` (Toon 4 — the only time), `transform ryan → ryan_eternity` (64-px purple-black sprite that replaces his slot and overlaps the stage), caption "[I am not trapped in the goo. The goo is trapped in the pocket.]", music → `eternity`, then three scripted words with 900 ms between: **DOOM** (`damage all enemies 999`), **CRACK** (`background palmers_roof_peel`, text "The roof of Palmer's Bar peels back exactly like a sardine can."), **THUD** (`camera.shake 1200`, text "The walls blow outward." , caption "[Rhythm achieved.]") → `win`. Input is locked from `eternityArmed` onward (the command window never opens; the HUD shows "…").
- Lose condition stays live until `eternityArmed`: three cops at ~11 damage a hit against a two-person controllable party is a real fight for two to four rounds.
- Reward: 100 XP, $0 ("Nobody pays you after you level the bar"), the cop's Price-Tag Leather Jacket.

**Required extensions to ARCHITECTURE §8** (small, listed so the contract can be amended): hooks `onAction(model, actorId, action)` and `onToon(model, level)`; events `{type:'join', who}`, `{type:'leave', who}`, `{type:'spawn', enemy, slot}`, `{type:'caption', text}` (Ryan's square caption inside battle), `{type:'background', key}`, `{type:'uiTear', strength}`, `{type:'lockInput', on}`; per-combatant rule flags `auto`, `minHp`, `noFlee` on the encounter. `tests/battle.test.mjs` must cover each of the four scripts above end to end with a seeded RNG.

## Party & progression

### Characters

**Lucky** — frontperson, laser guitar (HIGH) and vocals (NOISE). Glass cannon with the best crit and the best Toon synergy. Color is the HUD: `lucky` (pastel pink) above 50% HP, `lucky_deflated` (pale) below 25%, `lucky_rage` (magenta) while BRISTLING and permanently after Ryan quits.

**Phoenix** — bass (LOW), the tank and the analyst. Highest DEF, the scan riff, the only partner for Syncs in the slice. Gray slime; glasses push up on every riff.

**Brian** — guitar (HIGH), temporary, fixed L3, joins at the coffee shop, leaves at the ultimatum. Aggressively normal. His whole kit is a sabotage: see below.

**Ryan** — drums (NOISE/PHYS), temporary, fixed L4, joins after the AUDITION, leaves in the rubble. Never player-controlled (`auto: true`). Four forms (sheets): `ryan` (human, map only), `ryan_slimed` (Possessed: green, friendly fire), `ryan_pocket_purple` (Pocket: bruised purple, no friendly fire, +8 Toon per action), `ryan_eternity` (64 px, scripted).

### Stats at L1 and growth

| Character | HP | AMP | ATK | DEF | SPD | LCK | Growth per level |
|---|---|---|---|---|---|---|---|
| Lucky | 28 | 8 | 7 | 4 | 7 | 6 | HP +6, AMP +2, ATK +2, DEF +1, SPD +1, LCK +1 |
| Phoenix | 34 | 10 | 5 | 6 | 5 | 4 | HP +7, AMP +2, ATK +1 (+2 on odd levels), DEF +2, SPD +1, LCK +1 |
| Brian (fixed L3) | 30 | 6 | 8 | 5 | 9 | 0 | none (temp) |
| Ryan (fixed L4) | 40 | 12 | 10 | 6 | 11 | 5 | none (temp) |

Full tables (base stats, before equipment):

| L | Lucky HP/AMP/ATK/DEF/SPD/LCK | Phoenix HP/AMP/ATK/DEF/SPD/LCK |
|---|---|---|
| 1 | 28 / 8 / 7 / 4 / 7 / 6 | 34 / 10 / 5 / 6 / 5 / 4 |
| 2 | 34 / 10 / 9 / 5 / 8 / 7 | 41 / 12 / 6 / 8 / 6 / 5 |
| 3 | 40 / 12 / 11 / 6 / 9 / 8 | 48 / 14 / 8 / 10 / 7 / 6 |
| 4 | 46 / 14 / 13 / 7 / 10 / 9 | 55 / 16 / 9 / 12 / 8 / 7 |
| 5 | 52 / 16 / 15 / 8 / 11 / 10 | 62 / 18 / 11 / 14 / 9 / 8 |
| 6 | 58 / 18 / 17 / 9 / 12 / 11 | 69 / 20 / 12 / 16 / 10 / 9 |
| 7 | 64 / 20 / 19 / 10 / 13 / 12 | 76 / 22 / 14 / 18 / 11 / 10 |
| 8 | 70 / 22 / 21 / 11 / 14 / 13 | 83 / 24 / 15 / 20 / 12 / 11 |

Level-up fully restores HP and AMP (SNES mercy). HP/AMP maxima are recomputed from the table, not accumulated, so a saved character is always consistent with it.

### XP table

Everyone in the active party gets the full XP of every fight (Chrono Trigger, no splitting); temp members are set to their fixed level on join and ignore XP.

| Level | Cumulative XP | Delta |
|---|---|---|
| 1 | 0 | — |
| 2 | 10 | 10 |
| 3 | 24 | 14 |
| 4 | 48 | 24 |
| 5 | 85 | 37 |
| 6 | 135 | 50 |
| 7 | 200 | 65 |
| 8 | 275 | 75 |

Slice budget: required fights give 8 (drone) + 50 (AUDITION) + 30 (Chorus) + 100 (THE SET) = **188 XP → L6** on the critical path. Every optional fight adds 43 (hub, before) + 30 (Billboard) + 50 (hub, after) = 123 → **311 XP → L8**. A player who skips everything meets Palmer's at L4 (58 XP) with Lucky at 46 HP; the cops are tuned for that case (below).

### Riffs learned

| Character | Level | Riff | AMP | Freq | POW | Effect |
|---|---|---|---|---|---|---|
| Lucky | 1 | Power Chord | 3 | HIGH | 140 | Single target. |
| Lucky | 2 | Feedback Squeal | 4 | NOISE | 70 | All enemies, acc −10, 50% DEAF. |
| Lucky | 3 | Pseudopod Slap | 3 | PHYS | 110 | Single, 60% DAZED. The intercom slap. |
| Lucky | 5 | Migraine | 7 | NOISE | 150 | All enemies, 30% OUT OF TUNE. "Until this whole empire gets a migraine." |
| Lucky | 7 | Bristle | 4 | — | — | Self: BRISTLING 3 rounds. |
| Phoenix | 1 | Root Note | 3 | LOW | 130 | Single, 30% TEMPO DOWN. |
| Phoenix | 2 | My Brain Thinks | 2 | — | — | Scan: shows target HP / weak / resist and its flavor line in Phoenix's voice. +5 Toon. |
| Phoenix | 3 | Deadpan | 4 | — | — | One ally: DEF +50% for 3 rounds, cures DAZED. |
| Phoenix | 4 | Drone Note | 5 | LOW | 90 | All enemies, 40% TEMPO DOWN. |
| Phoenix | 6 | Rent Is Due | 6 | LOW | 200 | Single. Also costs $1 (grayed at $0). |
| Brian | — | Sterile Chord | 0 | HIGH | 120 | Single, always hits, never crits. His only honest riff. |
| Brian | — | Turn the Bass Down | 2 | — | — | Phoenix ATK −25% for 3 rounds; Brian ATK +25%. Targets Phoenix only. |
| Brian | — | Tube Screamer | 5 | HIGH | 170 | Single. 30%: "ground hum" hits a random ally for half instead. |
| Brian | — | Normal Music | 0 | — | — | Sets the Toon meter to 0. Heals Brian 50%. |
| Ryan (Possessed) | — | Blast Beat | — | NOISE | 130 | All enemies. AI weight 4. |
| Ryan (Possessed) | — | Fill | — | PHYS | 180 | Random target; 30% of the time that target is a party member. AI weight 3. |
| Ryan (Possessed) | — | Tinny Ride | — | NOISE | 90 | Single, 50% DEAF. AI weight 2. |
| Ryan (Pocket) | — | Seven-Eight | — | NOISE | 150 | All enemies. Weight 4. +8 Toon like all his actions. |
| Ryan (Pocket) | — | Kick | — | PHYS | 160 | Single, highest-ATK enemy. Weight 3. Never hits allies. |
| Ryan (Pocket) | — | Pocket (Sync w/ Lucky) | — | NOISE | 200 | When Toon ≥ 50 and Lucky alive. Weight 5. |

### Brian as a temporary party member

Brian is designed to be *felt* as a drag and then missed exactly a little. Passives:

- **$2,000 Pedalboard** (accessory, locked, cannot be unequipped): hit always 100, crit always 0. Honest, sterile, reliable.
- **Market Alignment**: while Brian is in the party, all Toon gains are halved. The HUD draws the TOON label in beige.
- **Buzzkill**: each round there is a 20% chance Brian ignores the chosen command and complains instead (loses the turn): six lines rotate ("Can we turn the bass down?", "Do we really need the stickers?", "Is this song in a weird time signature?", "My coffee's getting warm.", "Can we play something people know?", "I've got a thing at nine."). Never fires in the tutorial (he isn't there) and is suppressed on round 1 of any battle so the player gets to try him.
- He cannot SYNC, cannot use NOISE ("Brian hates this"), and his Tube Screamer is the only strong hit he has, with a 30% self-sabotage.

Upside, so the loss registers: his Sterile Chord never misses, which matters against the Scooters (SPD 10), and he is the fastest party member until Ryan. After he leaves, the **Fried Pedalboard** is a key item: sell it for $11 at the pawn shop or equip it as an accessory (ATK +4, 15% chance per RIFF to inflict OUT OF TUNE on yourself). The choice is the only thing Brian leaves behind.

### Ryan's forms

| Form | Sheet | When | Behavior |
|---|---|---|---|
| Human | `ryan` (16×24 map sprite) | hallway, garage, rubble | NPC. Says "Yep." |
| Possessed | `ryan_slimed` (32×32 battle) | AUDITION, Chorus | AUTO, friendly fire via Fill, `minHp 1`, +8 Toon per action. Captions in rigid square boxes. |
| Pocket | `ryan_pocket_purple` (32×32) | THE SET | AUTO, no friendly fire, Pocket Sync with Lucky. Purple-black darkening is the warning. |
| The Eternity | `ryan_eternity` (64×64) | THE SET finale | Scripted. Three words, no inputs, art ruptures. |

## Enemies & bosses

| Enemy | Size | HP | ATK | DEF | SPD | XP | $ | Freq weak / resist | Flavor (Phoenix's scan line) |
|---|---|---|---|---|---|---|---|---|---|
| Vanguard Retrieval Drone | 32 | 30 | 6 | 3 | 6 | 8 | 2 | NOISE / — | "My brain thinks it's here to offer you a dental plan." |
| Slush Pile | 32 | 26 | 7 | 2 | 3 | 6 | 3 | HIGH / PHYS | "My brain thinks it's mostly road salt and regret." |
| Canada Goose | 32 | 34 | 9 | 3 | 9 | 9 | 4 | LOW / — | "My brain thinks it has a lawyer." |
| Feral Scooter (×3) | 32 | 18 | 7 | 4 | 10 | 4 ea | 2 ea | PHYS / NOISE | "My brain thinks someone left these unlocked on purpose." |
| Demographic Analyst | 48 | 60 | 10 | 6 | 7 | 16 | 8 | NOISE / HIGH | "My brain thinks it has already segmented us." |
| WORK IS LOVE Billboard (optional) | 64 | 120 | 11 | 8 | 2 | 30 | 12 | NOISE ×2 / PHYS, LOW | "My brain thinks it's humming in a key that doesn't exist." |
| Analyst Duo (×2, after month skip) | 48 | 60 | 10 | 6 | 7 | 16 ea | 8 ea | NOISE / HIGH | "My brain thinks they bill in fifteen-minute increments." |
| Goose Pair (×2, after month skip) | 32 | 34 | 9 | 3 | 9 | 9 ea | 4 ea | LOW / — | "My brain thinks they're married." |
| WHRNNNG (AUDITION) | 64 | 90 | 9 | 5 | 8 | — | — | LOW / NOISE | "My brain thinks it's the guitar's fault." |
| THUD-THUD (AUDITION) | 48 | 70 | 12 | 4 | 12 | — | — | HIGH / NOISE | "My brain thinks it's the drummer's fault." |
| The Chorus (rehearsal) | 48 | 150 | 5 | 5 | 5 | — | — | — / — | "My brain thinks it's catchy. Brian hates it." |
| Undercover Cop | 48 | 220 | 12 | 9 | 8 | — | — | — / PHYS | "My brain thinks the price tag is still on." |
| Backup Cop (×2) | 32 | 55 | 10 | 6 | 7 | — | — | NOISE / PHYS | "My brain thinks they carpooled." |

Scripted encounters pay fixed XP: AUDITION 50, Chorus 30, THE SET 100.

Enemy riffs and AI (abbreviated; full tables go in `enemies.json`):

- **Drone**: Taser Prod (PHYS 100, single), Retrieval Beam (PHYS 80, 30% TEMPO DOWN); 50/50 after round 1, round 1 always Taser.
- **Slush Pile**: Splash (PHYS 100), Freeze (NOISE 60, all, 30% TEMPO DOWN) when `round % 3 == 0`.
- **Goose**: Hiss (NOISE 60, 30% DAZED) round 1; Peck (PHYS 110, lowestHp) otherwise; flees below 30% HP if alone.
- **Scooter**: Zip (PHYS 90); **Swarm** (PHYS 60 to all) only while 3 alive, weight 5.
- **Analyst**: Pick a Demographic (NOISE 80, OUT OF TUNE 50%), Dental Plan (heals self 15, only below 50%), Onboarding (TEMPO DOWN 40%, all). Weights 4/3/2.
- **Billboard**: Slogan (NOISE 70 to all) every round; every 3rd round it **Glitches** (self DAZED 1 — the weakness window; the slogan text scrambles to WORK IS LOVE → WORK IS LOVE → WORK IS L0VE).
- **WHRNNNG**: Sustain (NOISE 90, all). **THUD-THUD**: Downbeat (PHYS 130, random), Double (two Downbeats at 60%) every 2nd round.
- **The Chorus**: Hook (PHYS 40, random), Earworm (DEAF 20%, single). Harmless on purpose.
- **Undercover Cop**: Baton (PHYS 110), Pepper Spray (NOISE 70, all, OUT OF TUNE 40%), Hello Fellow Kids (self: TEMPO UP; text "He tries to blend in.") once. Policies `notRyan`.
- **Backup Cop**: Baton, Cuff (DAZED 40%).

**Boss scripts** are specified in full under *Scripted battle events*. Summary of the tuning intent:

- **AUDITION**: survive six rounds. The walls deal ~90–130 raw POW against a L3–4 party; THUD-THUD's Double is the scary turn. Ryan's Blast Beat (130 to all) will usually kill both walls by round 5–6 on its own, which is the point: the player's job is to not die while a machine does the work. Expected damage taken by a L4 party over six rounds: ~140 HP across the three controllable members (Lucky 46 / Phoenix 55 / Brian 30) — so one Pizza Slice or a Shared Aura is needed. Brian will usually go down; that is fine and funny.
- **The Chorus**: unloseable in practice (Hook 40 POW against DEF 7–12 does 3–6). It is a pacing scene with a button prompt.
- **THE SET**: the Undercover Cop alone for two rounds (Baton 110 vs DEF 8 → ~13 to Lucky), then three cops. Ryan Pocket does ~20 to all per action and his Pocket Sync ~30; Lucky L5 Power Chord does ~45 to the cop. Toon from 25 with +8 (Ryan) +4–6 (each of Lucky/Phoenix) +3 per hit taken reaches 75 on round 3 or 4; `onRound(6)` is the backstop. A L4 skip-everything party has about 100 controllable HP against ~35 incoming per round from round 3 — tight but survivable with TUNE and a Hotdish; a L6+ party barely notices.

## Items, equipment, shops

Starting inventory: **$4**, Half-Ounce (×4), Beat-Up Guitar (equipped), Spiky Slime Sunglasses (equipped after freefall). Phoenix joins with the Trash Bag equipped and the Hoodie.

### Consumables

| Item | $ | Effect | Where |
|---|---|---|---|
| Pizza Slice | 3 | Heal 20 HP (one ally). | Coffee shop, drops |
| Gas Station Coffee | 4 | +6 AMP (one ally). | Coffee shop; Brian gives 2 |
| Hand Warmer | 5 | Cure DEAF and TEMPO DOWN, heal 8. | Coffee shop, pawn |
| Tater Tot Hotdish | 15 | Revive at 50% HP. | Phoenix's fridge (1), coffee shop after month skip |
| Half-Ounce (×4) | — (pawn buys for $20 total, all charges) | "Session": whole party AMP to max, BAKED 3 rounds. Can be used on the map. | Start |
| Fried Pedalboard | — (pawn buys for $11) | Key item / accessory (ATK +4, 15% self OUT OF TUNE per RIFF). | Brian leaves it |

### Equipment

Slots: **instrument** and **accessory**. Instruments set the STRUM frequency.

| Item | Slot | For | Stats | $ | Where |
|---|---|---|---|---|---|
| Beat-Up Guitar | instrument | Lucky | ATK +3, HIGH | — | start |
| Thrift Telecaster | instrument | Lucky | ATK +6, LCK +2, HIGH | 26 | pawn |
| Trash Bag | instrument | Phoenix | ATK +2, PHYS; 10% SLIMED on hit | — | alley |
| Beat-Up Bass | instrument | Phoenix | ATK +4, LOW | — | apartment |
| P-Bass Copy | instrument | Phoenix | ATK +7, DEF +1, LOW | 24 | pawn (after month skip) |
| Drumsticks | instrument | Ryan | ATK +3, PHYS; locked | — | fixed |
| Brian's Strat | instrument | Brian | ATK +5, HIGH; locked | — | fixed |
| Spiky Slime Sunglasses | accessory | Lucky | LCK +2, immune DAZED | — | freefall |
| Hoodie | accessory | Phoenix | DEF +1 | — | start |
| Earplugs | accessory | any | immune DEAF | 10 | pawn |
| Band Sticker | accessory | any | +1 Toon per action | 6 | pawn |
| Price-Tag Leather Jacket | accessory | any | DEF +4 (sells $20) | — | cop drop |
| Flannel | accessory | Ryan | DEF +3; locked | — | fixed |
| $2,000 Pedalboard | accessory | Brian | hit 100 / crit 0; locked | — | fixed |

### Shops

- **Grounds for Dismissal** (coffee shop barista): Pizza Slice, Gas Station Coffee, Hand Warmer; Tater Tot Hotdish appears after the month skip. The barista has a tip-jar line ("Tips are love. Work is also love. It's on the sign.").
- **Lake Street Pawn & Loan**: Thrift Telecaster, Earplugs, Band Sticker; after the month skip adds P-Bass Copy and Hand Warmer. Buys: Fried Pedalboard $11, Half-Ounce $20, Price-Tag Jacket $20, anything else at half price. Sticky sits under a tarp with "NOT FOR SALE (YET)".
- **Money budget**: $4 start + $2 couch + $2 drone + $21 hub (all four) + $12 Billboard + $24 post-skip hub + $11 pedalboard + $20 weed = $96 maximum; a typical full-clear player has ~$45 by the month skip and can afford one instrument and a couple of items. The weed-for-a-bass decision is the slice's one economic choice and Phoenix gets a line either way.

## UI & presentation

- **Battle layout** (256×224): SETLIST strip y 4–12 (8×8 icons, current actor outlined); TOON meter at x 8, y 16, 96×8 (four 24-px segments; label TOON and the level digit; beige while Brian is present); enemies left, party right in four slots; command window bottom-left (x 8, y 160, 104×56, 2×3 grid); party status window bottom-right (x 120, y 160, 128×56: name, HP, AMP as `HP 46/52  AMP 11`, status icons). Battle text uses the shared `ui.say` box at the standard geometry when a script talks; otherwise a one-line message strip at y 148.
- **Lucky's color as HUD**: `lucky` / `lucky_deflated` / `lucky_rage` palette variants swap on HP thresholds and BRISTLING; no runtime tinting.
- **Toon escalation** (presentation only, driven by `meter` events): 0–1 static background and light shake; 2 the background scrolls, SFX-word sprites become physical (KRAAANG's letters fall with a bounce tween); 3 the window frames jitter ±2 px and the message strip tilts 1 px; 4 the background palette-cycles through purple-black noise, the window frames are replaced by torn edges, and Ryan's 64-px sprite overlaps the enemy side. Each hit spawns a comic SFX word (POW / THWAP / BONK) scaled by Toon Level.
- **Ryan's captions** in battle use the `ryan_caption` box style: rigid square, no portrait, no name tag, slower text (1 char / 45 ms) so the calm reads.
- **Battle entry** = static burst (ARCHITECTURE §11); victory = "SET BREAK" strip with XP / $ / level-ups; enemy flavor text appears on Phoenix's scan and on KO.
- **Dialogue** per §12.2; portraits 32×32: `lucky` (calm, rage, deflated, sunglasses), `phoenix` (tired, deadpan, glasses-push), `brian` (smug, red), `ryan` (stoic), `dad` (intercom grille), `bajonka`, `cop`, `pawn_guy`, `barista`.
- **Captions**: "END PART 1", "ONE WEEK LATER", "ONE MONTH LATER" (duct-taped variant: the card is drawn askew with a tape strip), "NEXT: THE POTATO BELT (DRUMMER WANTED)".

## Audio

All synthesized (ARCHITECTURE §7). One song per file; tempo and meter are the sequencer's `bpm` / `beatsPerBar` / `stepsPerBeat`.

| id | Where | BPM / meter | Mood |
|---|---|---|---|
| `title` | Title | 180, 4/4 | Three-chord punk, pulse 50% lead, noise drums; the hook is the slice's leitmotif. |
| `podbay` | Pod bay | 96, 4/4 | Corporate hold-music: triangle bass, 12.5% pulse chords, a four-note "brand" jingle every 8 bars; Dad's lines are underscored by a low saw drone. |
| `freefall` | Freefall | 160, 4/4 | Rising arpeggios, pitch climbing a semitone every 4 bars, wind noise; cuts dead on impact. |
| `snow` | Alley, Palmer's exterior | 72, 3/4 | Melancholy waltz, triangle melody, sparse 25% pulse, soft noise "wind". |
| `apartment` | Apartment | 110, 4/4 | Lo-fi, swung hats, warm 25% pulse, a bass line that is the title riff at half speed. |
| `signal` | Signal montage (one-shot, 24 s) | 140, 4/4 | A single rising saw note that bends up, then the title riff smeared through a pitch slide; ends on a held triangle at the garage. |
| `hub` | Streets | 140, 4/4 | Mid-tempo street punk, ska-ish upstrokes on 25% pulse, busy hats. |
| `coffee` | Coffee shop | 120, 4/4 | Bossa pulse, triangle walking bass; Brian's entrance adds an obnoxiously clean 50% pulse "jazz chord" every 2 bars while he's on-screen. |
| `pawn` | Pawn shop | 92, 4/4 | Dusty blues shuffle, noise brushes. |
| `battle` | Street fights | 196, 4/4 | Fast hardcore: 2-bar riff, pulse harmony a fifth up, blast-beat noise every chorus. Lucky's four-count ("One, two, three, four!") is a 4-hit noise click at the song start on every battle. |
| `rehearsal_brian` | Chorus fight | 120, 4/4 | "Normal music": sterile 50% pulse power chords perfectly on the grid, no swing. When KRAAANG fires, the pattern `K` (one bar of full-volume saw + noise) cuts in and the song ends. |
| `audition` | AUDITION | 220, 4/4 | Blast beats, tremolo pulse; a pattern-B fill every 4th bar that is deliberately "too many notes" for the channel count (notes drop out = the arm smear). |
| `citysound` | Hallway / Room 4 idle | 100, 4/4 | Muffled through-the-wall band: low-passed (triangle only) version of `hub`. |
| `palmers_set` | THE SET | 168, 7/8 (`beatsPerBar 7, stepsPerBeat 2`) | The band's actual sound: lopsided 7/8 riff, kick on 1 and 4, hats on every 8th; as Toon rises the engine adds channels (Toon 2: pulse2 harmony; Toon 3: saw doubling, detuned 6 cents). |
| `eternity` | The Eternity | 40, 4/4 | Doom: a saw sub drone, triangle fifths, noise crashes on 1 only, each word (DOOM / CRACK / THUD) a single low accent. No loop; 20 s then silence. |
| `rubble` | Aftermath | 60, 3/4 | `snow` with the melody removed; wind only, then a lone triangle line when Ryan says "I quit." |
| `victory` | Set break jingle | 180, 4/4 | 2-bar sting from the title riff. |
| `levelup` | Level up | — | 6-note arpeggio, pulse 12.5%. |
| `gameover` | Game over | 70, 4/4 | Title riff in minor at half speed, decaying. |

SFX (`sfx.js`, named recipes): the architecture's list (`cursor, confirm, cancel, text_blip, hit, crit, miss, squelch, slime_pop, kraaang, level_up, item, door, sneeze, feedback, drum_hit, cymbal, ko, flee, save`) plus `eject` (big red button: low thunk + rising whine), `crash` (alley impact: noise burst + low saw), `pop_x3` (Lucky reassembling: three ascending pops), `amp_hum`, `count_in` (four stick clicks), `unplug` (POP), `coffee_spill` (noise splash + fizz), `sparks` (crackle), `door_slam`, `mohawk_off` (short whoosh + "plink"), `doom`, `crack`, `thud` (the three Eternity words: sub-bass thumps at 40 / 50 / 30 Hz with noise tails), `roof_peel` (long metallic saw sweep), `wall_blow` (noise + descending pulse), `krathoom` (crash + kraaang stacked), `van_keys` (jingle), `tear` (UI tear: short noise zip), `toon_up` (a segment filling: rising 3-note pulse).

## Controls & save

| Action | Keys |
|---|---|
| Move | Arrow keys / WASD |
| Confirm / interact / advance text | Z, Enter, Space |
| Cancel / back | X, Escape |
| Run (hold) | Shift |
| Menu | C, M |
| Toggle fullscreen | F |

Gamepad mirrors these via `Input.js` (d-pad / A / B / X / Start). Text: 1 char / 30 ms, confirm completes the page.

Saving: Bajonka is the save point (interact → sneeze → "Save? Slot 1 / 2 / 3"). She appears at the City Sound hallway (from scene 8), Palmer's exterior, and the rubble. Before she exists the game **autosaves to the active slot** at three checkpoints: after the tutorial battle, on leaving the apartment, on entering City Sound. Saves use the §6 format; `meter` is stored and reset to 0 on load; AMP is stored and fully restored by a Bajonka save (the dog is a rest). Game over returns to Title with Continue.

## Content inventory

Everything the implementers must produce for the slice. Counts are minimums.

**Overworld sprites (16×24, walk_down/up/left ×3 + idle)**: `lucky`, `lucky_rage`, `lucky_deflated` (variants), `lucky_ball` (pod bay, 16×16, 2-frame pulse), `phoenix`, `brian`, `ryan`, `ryan_slimed_map` (rubble, solidifying), `bajonka` (idle, sneeze, trot), `cop` (mohawk on / off), `pawn_guy`, `barista`, `crowd_a`–`crowd_f` (6 palette variants of two bases), `smoker`, `bus_stop_guy`, `hotdish_lady`, `crypto_guy`, `slush_pile` (map), `goose` (map), `scooter` (map), `analyst` (map, floating bob), `drone` (map).

**Battle sprites (idle 2 / attack 3 / hurt 1 / ko 1 / riff 2)**: 32×32 `lucky_battle` (+ rage, deflated variants), `phoenix_battle`, `brian_battle` (+ `brian_fried`), `ryan_slimed`, `ryan_pocket_purple`; 64×64 `ryan_eternity` (idle 2, word 3). Enemies: 32 `drone`, `slush_pile`, `goose`, `scooter`, `backup_cop`; 48 `analyst`, `thud_thud`, `chorus`, `cop` (+ `cop_nomohawk`); 64 `billboard`, `whrnnng`.

**SFX-word sprites** (atlas, 2-frame): `word_pop`, `word_kraaang` (with a separate swinging G), `word_krathoom`, `word_crash`, `word_doom`, `word_crack`, `word_thud`, `word_whrnnng`, `word_thudthud`, generic `pow / thwap / bonk`.

**Portraits (32×32)**: `lucky` (calm, rage, deflated, sunglasses), `phoenix` (tired, deadpan, glasses_push), `brian` (smug, red), `ryan` (stoic), `dad` (intercom grille), `bajonka`, `cop`, `pawn_guy`, `barista` — 16 total.

**Tilesets**: `vanguard` (12 tiles), `minneapolis` (28: snow, slush, sidewalk, curb, brick ×3, window lit/dark, door, neon sign pieces ×4, billboard pieces ×6, dumpster upright/knocked, pothole, snowbank, lamp post, bus stop), `interior` (26: floor ×3, wall ×3, poster ×3, bills, couch, fridge, amp, bass on stand, drum kit ×4, pedalboard / fried, iced coffee, corkboard, counter, sticker wall ×2, soundproof door), `palmers` (22: bar wood, stage, stools, neon, bottles, crowd floor, rubble ×4, sky ×2, peeled roof edge ×3, drywall).

**Battle backgrounds** (256×112 ASCII maps): `street` (snow + billboards), `alley`, `room4` (sticker walls; Toon 3 warp variant is procedural), `palmers` (stage + crowd silhouettes), `palmers_roof_peel` (sky through the ceiling), `rupture` (Toon 4 noise, procedural).

**UI atlas**: window 9-slice, torn-window 9-slice (Toon 3–4), cursor hand, Toon meter segments (empty / pink / green / purple / black), setlist icons (party ×4, enemy generic, Ryan AUTO lock), status icons ×9, duct-tape caption strip.

**Songs**: 19 listed above. **SFX recipes**: 41.

**Data**: `characters.json` (4), `riffs.json` (24 incl. syncs and NOISE words), `items.json` (6), `equipment.json` (15), `enemies.json` (13), `encounters.json` (11: `alley_drone`, `hub_slush`, `hub_goose`, `hub_scooters`, `hub_analyst`, `hub_billboard`, `hub_analyst_duo`, `hub_goose_pair`, `ep0_audition`, `ep0_rehearsal`, `ep0_palmers_set`), `shops.json` (2), 12 maps, `BattleScripts.js` (4 scripts).

**Dialogue scripts** (`src/data/scripts/`): `ep0_podbay` (Dad's monologue, 6 pages; speaker slap; eject), `ep0_crash` (alley), `ep0_alley_phoenix` (rant, aura, drone), `ep0_apartment` (couch, fridge, bass, posters ×3, bills, amp signal + montage), `ep0_hub` (flavor NPCs ×3, locked doors ×2, billboard challenge), `ep0_coffee` (flyer, Brian intro, join, phone call), `ep0_garage` (cutscene), `ep0_citysound_hall` (Ryan with hardware, Bajonka, time-skip), `ep0_room4_audition` (pre-fight, post-fight, contract), `ep0_month_later` (card, Brian's complaints ×3), `ep0_rehearsal_quit` (ultimatum, X-ray, crooked house, exit, flyer), `ep0_palmers_ext`, `ep0_palmers_set` (pre-fight: cop whisper, nod), `ep0_rubble` (aftermath, quit, 3-way choice, stinger), `shops` (pawn and coffee barks, weed sale), `bajonka_save`. About 230 dialogue pages plus 40 flavor interactions and the 6 Buzzkill lines.

## Risks & cuts

| Risk | Mitigation / cut order |
|---|---|
| The four scripted battles need §8 extensions (`join`, `spawn`, `onAction`, `onToon`, `lockInput`). | Amend ARCHITECTURE §8 before BattleModel is written; the extensions are additive and listed above. If time is short, `onAction` can be replaced by polling in `onTurnStart`. |
| Toon 4 presentation (art rupture, torn frames, 64-px Ryan) is the most expensive visual in the slice. | Cut order: palette-cycled background → torn 9-slice → keep the 64-px sprite and the three words no matter what. The words *are* the scene. |
| Freefall steering minigame is a whole extra scene. | Cut to a non-interactive 12-second cutscene with the sunglasses forming and three billboards glitching on a timer; the Toon 1 bonus becomes unconditional. |
| Brian's Buzzkill can feel like the game eating inputs. | It is suppressed on round 1, capped at 20%, and only exists for two scripted battles plus whatever hub fights the player picks with him. If testers hate it, lower to 10% and keep the lines on his *successful* turns instead. |
| Players at L4 can lose THE SET before The Eternity. | Backstop is `onRound(6)`; cops use `notRyan`; a Hotdish is placed in the fridge and the pawn shop sells Hand Warmers. If still too hard, lower Backup Cop ATK to 8. |
| XP is bounded (no respawns) so a stuck player cannot grind. | Not a bug: every required fight is tuned for the skip-everything L4 case. The Billboard and the post-skip hub exist to let a struggling player catch up to L6. |
| 19 songs is a lot of chiptune. | Cut order: `pawn` (reuse `hub` low-passed), `citysound` (already a filter of `hub`), `coffee` (reuse `apartment`), `rubble` (a filter of `snow`). `palmers_set`, `eternity`, `battle`, `audition` and `title` are not cuttable. |
| SLIMED, BAKED and Band Sticker are low-value systems. | Cut all three first if BattleModel is behind; nothing in the scripts depends on them. |
| The weed-sale choice may read as a gag with no consequence. | Phoenix comments at Palmer's either way ("We sold the weed for this." / "We kept the weed for this."). Cheap, keeps the choice honest. |
| Half-ounce / weed content. | Already in the comic's text verbatim; it is a consumable with a comedic status effect and never shown being used on-screen beyond the "Session" text. |
