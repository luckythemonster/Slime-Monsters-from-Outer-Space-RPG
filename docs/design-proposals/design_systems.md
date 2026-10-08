# Vertical Slice Design — Systems

Chapter 1 "Coagulation", 45–75 minutes, Phaser 4 + Vite, 256×224. This is the numbers document: every formula, table and script hook needed to build `BattleModel`, `formulas.js`, `BattleScripts.js` and the data JSON described in `docs/ARCHITECTURE.md` §8 and §12. Story order follows the Episode 0 script with Lucky's plot tweaks (Lucky → Phoenix → Brian → Ryan; Brian quits over KRAAANG and the crooked house; Ryan becomes The Eternity, levels Palmer's, and quits on the spot). All numbers below were checked with a seeded simulation of the formulas against the enemy table.

## Pillars

- **Every fight is a song.** Turn order is the SETLIST, basic attacks are STRUMs, techs are RIFFs, the energy pool is AMP, the shared meter is the TOON METER. No sword vocabulary anywhere.
- **The Toon Meter is the comic's Toon Level made mechanical.** It fills with noise, it buys physics-breaking SFX-word attacks (POP! / KRAAANG / KRATHOOM), and presentation escalates with it (shake → physical letters → the UI frame tears → the art ruptures). Toon 4 is never player-reachable; it is The Eternity.
- **The band is the party, and the band is unstable.** Brian is a playable liability; Ryan is a possessed ally the player never controls; both quit. The roster is a story device, not a loadout.
- **Small numbers, readable math.** Two-digit HP, single-digit stats, integer arithmetic, ±10% variance. Street fights run 2–5 rounds, bosses 5–6. Tuned so a player who dodges every optional fight still finishes, and one who fights everything hits L8 at Palmer's.
- **Broke is the permanent condition.** $4 and a half-ounce of weed at the start, maybe $45 by the month skip, one instrument upgrade if you sell Brian's fried pedalboard or the weed.

## Scene-by-scene flow

Target wall-clock for a first-time player at normal text speed.

| # | Scene (Toon) | Map | Beats and what the player does | New systems | min |
|---|---|---|---|---|---|
| 1 | Pod bay (1) | `pod_bay` | Dad's intercom monologue; the only interactable is the speaker. Interact → pseudopod SQUELCH; the red EJECT lights; interact → launch. | Dialogue, interact | 2 |
| 2 | Freefall (3) | Freefall scene | 20 s steering minigame: left/right to pass through WORK IS LOVE billboards and glitch them; slime sunglasses form at 5 s. Glitch 3+ ⇒ the tutorial battle opens at Toon 1. | Special scene | 2 |
| 3 | Alley (2) | `alley` | KRATHOOM crash; the CRASH word knocks dumpsters over (they stay as solid deco). Phoenix's pothole line, the rant, the shared aura, "Beats the day job." A Retrieval Drone drops in: **tutorial battle**; Phoenix hops in on round 2 with the trash bag and joins. | STRUM, RIFF, AMP, Toon, Lucky's color HUD | 6 |
| 4 | Apartment (2) | `apartment` | Posters, bills, fridge (Tater Tot Hotdish), couch ($2), Phoenix's bass (auto-equip). Amp interact → the signal: the screen border bends, montage, Ryan's garage, sticks hover. "End Part 1." Caption ONE WEEK LATER: "Nobody came." | Menu, equipment | 4 |
| 5 | Streets hub (1) | `street_west_bank` | Four on-map enemies plus the optional Billboard mini-boss; pawn shop; coffee shop. City Sound and Palmer's locked. | On-map enemies, shops, NOISE | 10 |
| 6 | Coffee shop (1) | `coffee_shop` | Phoenix pins the flyer; Brian is already reading it. Stickers / "turn the bass down" / "I'm not a 'man,' Brian." **Brian joins (L3)**, buys coffee (+2 Gas Station Coffee). "You need a drummer. I know a guy." | Temp member, Market Alignment | 4 |
| 7 | Phone call (2) | `ryan_garage` | Ryan hasn't moved since the wave; slime still drips off the hovering sticks. "Ryan. It's Brian. From the Zappa cover band." "Yep." City Sound unlocks. | — | 2 |
| 8 | City Sound hallway (0–1) | `citysound_hall` | Sticker hallway; Ryan with an impossible stack of hardware; Bajonka, clipboard, nod, sneeze, time-skip. **Bajonka is the save point from here on.** | Save | 3 |
| 9 | Room 4: AUDITION (3) | `citysound_room4` | "$4 and a half-ounce of weed." Pedal stomp, "One, two, three, four!" **Boss.** First downbeat: Ryan is possessed (AUTO ally, friendly fire). Enemies are the sound walls WHRNNNG and THUD-THUD. Survive the song; Ryan's captions are the clock. "So, do I get the gig?" Bajonka drops the contract. **Ryan joins (L4, AUTO).** | Scripted battle, AUTO ally | 8 |
| 10 | ONE MONTH LATER (0→2) | hub, `citysound_room4` | Duct-taped card. Hub briefly reopens (two new enemies, pawn restock). Room 4: **rehearsal battle vs. The Chorus** — reach Toon 2, use KRAAANG (auto-fires round 8). The G swings, iced coffee hits the pedalboard, sparks. "I hate this weird, creative shit!" | KRAAANG, Brian's sabotage | 7 |
| 11 | The ultimatum (1) | `citysound_room4` | Unplug (POP). "Stop being an asshole, or you are fired." Brain X-ray. "Are you calling my house crooked?!" Stroke line. "You're just jealous of my equity!" Door slam. **Brian leaves; FRIED PEDALBOARD.** Bajonka drops the flyer: NO GUITAR SOLO NECESSARY. | Party remove | 4 |
| 12 | Palmer's (1) | `palmers_ext`, `palmers_int` | Save outside. Six-inch stage, crowd, the mohawk cop: "Dispatch, I have located the unauthorized slime gathering." Interact with the amp to start. | — | 3 |
| 13 | THE SET (2→4) | `palmers_int` | **Boss.** Cop, backup on round 3. First chord blows the mohawk into a beer. Ryan in Pocket form. At Toon 3 (or round 6): "I've been fighting the possession. That was a mistake." Purple. **THE ETERNITY**: DOOM / CRACK / THUD, roof peels, walls blow out, win. No inputs. | Toon 3 tear, Toon 4 rupture | 8 |
| 14 | Rubble (1) | `palmers_rubble` | "That is our sound." / "domestic terrorists" / "I think I broke the space-time continuum on that snare fill." Ryan looks at his hands: **"I quit."** Lucky goes magenta for the rest of the slice. Choice rage / plead / joke; every branch ends "Yep." He walks north. Bajonka: van keys, itinerary, POTATO BELT: TOMORROW. "We don't have a drummer." Sneeze. NEXT: THE POTATO BELT (DRUMMER WANTED). | Ending | 5 |

About 68 minutes with every optional fight; about 48 skipping the hub.

## Maps

| id | Name | W×H | Exits | Key NPCs / objects | Enemies |
|---|---|---|---|---|---|
| `pod_bay` | Vanguard Drop-Pod Bay | 12×10 | → Freefall (scripted) | Intercom speaker, EJECT button, pod | — |
| `alley` | Alley behind Palmer's | 20×14 | W → hub (after Phoenix joins) | Phoenix, trash bag, 4 dumpsters (knocked over by CRASH), glowing pothole | Retrieval Drone (tutorial) |
| `apartment` | Phoenix's Apartment | 14×12 | S → hub | Bass amp (signal trigger), fridge, couch, bass, posters ×3, bill pile ("$1,340 PAST DUE") | — |
| `street_west_bank` | West Bank Streets (hub) | 40×20 | `alley`, `apartment`, `coffee_shop`, `pawn_shop`, `citysound_hall` (locked until `ryanCalled`), `palmers_ext` (locked until `hasPalmersFlyer`) | WORK IS LOVE billboard (static mini-boss), bus-stop guy, hotdish lady, crypto guy, snowbanks | Slush Pile and Scooter Pack (chokepoints, effectively mandatory), Canada Goose, Demographic Analyst; after `monthLater`: Analyst Duo, Goose Pair |
| `coffee_shop` | Grounds for Dismissal | 14×10 | S → hub | Corkboard (flyer), Brian, barista (shop), tip jar | — |
| `pawn_shop` | Lake Street Pawn & Loan | 12×8 | S → hub | Pawn guy (shop; buys pedalboard / weed / jacket), Sticky under a tarp ("NOT FOR SALE (YET)") | — |
| `ryan_garage` | Ryan's Garage (cutscene) | 12×10 | none | Ryan at kit, hovering sticks, landline | — |
| `citysound_hall` | City Sound — hallway | 24×8 | W → hub; E → Room 4 | Bajonka (save), Rooms 1–3 (muffled bands), sticker wall | — |
| `citysound_room4` | Room 4 | 12×10 | W → hallway | Lucky's amp (battle trigger), kit, pedalboard (fried variant later), iced coffee | AUDITION, The Chorus |
| `palmers_ext` | Palmer's — exterior | 20×12 | E → hub; N → interior | Bajonka (save), neon sign, smoker, a van | — |
| `palmers_int` | Palmer's — interior | 24×14 | S → exterior (locked once the set starts) | Stage amp (trigger), bar, 6 crowd NPCs, undercover cop | THE SET |
| `palmers_rubble` | Palmer's — rubble | 24×14 | none (ending) | Same layout, `rubble` legend, sky overhead; Bajonka (final save) | — |

Tilesets: `vanguard`, `minneapolis`, `interior`, `palmers` (see Content inventory).

## Exploration & interaction

- Grid-locked 4-direction movement, 7 tiles/s walk, 11 run (ARCHITECTURE §12.3). Interact = `confirm` facing an entity with a `script`.
- **On-map encounters only** (Chrono Trigger): enemies use `behavior: chase`, `sight` 4–6; the Billboard is `static` and asks "It's humming. Fight it?" `encounters.rate` is 0 everywhere. Defeated enemies set a flag and are gone; `monthLater` spawns two new hub enemies. Total XP is therefore bounded and tuning is deterministic.
- Touched from behind (player facing away) the enemy gets the first round: the SETLIST shows it first. Head-on gives normal initiative. No preemptive strikes.
- Physical SFX words stay on the map after cutscenes (the alley CRASH, the Room 4 KRAAANG) as solid deco. Presentation only.
- Earthbound-dense flavor: every poster, bill, dumpster and the pothole has a line. Budget 40 lines.
- Pause menu: Items / Riffs / Equip / Status / Save (Save reads "Find the dog" away from Bajonka).

## Battle system

Side-view, turn-based (FF1–6 presentation; Chrono Trigger techs, double techs and scripted events; Earthbound flavor and backgrounds). Enemies on the left (x 24–120), party on the right in four slots (x 200; y 72 / 100 / 128 / 156), 32×32 battle sprites with feet at the slot's y.

### Round structure

1. **SETLIST.** At the start of each round every living combatant rolls `init = effSPD + rng(0..3)`; order is init descending. Ties: party before enemies, then roster order (Lucky, Phoenix, Brian, Ryan), then enemy slot order. `effSPD` = SPD × 1.5 (TEMPO UP) or × 0.5 (TEMPO DOWN), floored. The strip at the top shows the order as 8×8 icons; it is recomputed each round, not continuously — no ATB.
2. On a party member's turn the command window opens; input is per turn (FF6 without the clock). AUTO allies and enemies decide by AI.
3. Status durations tick at round end; `onRound(n)` fires at the start of round n.
4. Win when every enemy is KO'd or fled, or a script emits `win`. Lose when every **controllable** member is KO'd — AUTO Ryan does not keep the party alive.

### Stats and frequencies

HP, **AMP**, ATK, DEF, SPD, LCK; equipment adds flat. Every attack has a **frequency**: `PHYS` (trash bags, sticks, pecks), `LOW` (bass), `HIGH` (guitar), `NOISE` (vocals, drums, SFX words). Enemies declare `weak` (×1.5) and `resist` (×0.5).

### Formulas (`formulas.js`)

Integer math; `rng(a..b)` is uniform inclusive from the model's seeded RNG.

```
hit%   = clamp(90 + (effSPD_att − effSPD_tgt) × 2 + accMod, 55, 100)
         accMod: riff modifier (Feedback Squeal −10), OUT OF TUNE −30; Brian with the Pedalboard: 100
crit%  = 3 + floor(LCK / 2) + 3 × toonLevel               (Brian: 0)
raw    = max(1, ATK × 2 − DEF_tgt)                         (crit: DEF_tgt = 0)
dmg    = floor(raw × POW / 100 × (90 + rng(0..20)) / 100)  (±10%)
dmg    = floor(dmg × freqMult)                             (1.5 / 0.5 / 1.0)
dmg    = floor(dmg × (100 + 5 × toonLevel) / 100)          (party attacks only)
dmg    = crit ? dmg × 2 : dmg
dmg    = target TUNING ? floor(dmg / 2) : dmg
dmg    = max(1, dmg)
heal   = floor(POW × (90 + rng(0..20)) / 100)
flee%  = clamp(50 + (avgPartySPD − maxEnemySPD) × 5, 10, 90)   (BAIL; refused in scripted battles)
```

Sanity at L1: Lucky (ATK 7 + Beat-Up Guitar 3) STRUMs the Drone (DEF 3): raw 17 → 15–18; Drone HP 40 falls in round 2 once Phoenix (ATK 5 + 2) joins. The Drone (ATK 6) hits Lucky (DEF 4) for 7–8 of 28 HP.

Simulated outcomes (Lucky riffing, Phoenix strumming, no items): Slush Pile 2.0 rounds / 11 HP taken; Goose 2.2 / 15; Scooter Pack 3.5 / 30; Analyst 3.2 / 29; Billboard 4.9 / 53; Analyst Duo 4.5 / 52. Party HP pool is 75 at L2 and 101 at L4, so a fight costs 15–30% of the pool: a Shared Aura or a Pizza Slice every second fight.

### Commands

Six commands in a 2×3 window: STRUM / RIFF / NOISE on the left, ITEM / TUNE / BAIL on the right.

| Command | Effect |
|---|---|
| **STRUM** | Instrument attack, POW 100. On hit **+2 AMP** to the attacker. Lucky's crits inflict SLIMED. |
| **RIFF** | Tech list: single riffs, then **SYNC** below a divider, grayed with a reason ("Phoenix already played" / "needs 5 AMP" / "Brian hates this"). |
| **NOISE** | Spend Toon levels on SFX-word attacks. Uses the actor's turn and ATK. Grayed below Toon 1. |
| **ITEM** | Consumables. |
| **TUNE** | Defend: incoming halved until the actor's next turn, **+4 AMP**, cures own OUT OF TUNE. |
| **BAIL** | Flee roll. Grayed in scripted battles: "the dog has the contract". |

### Resources: HP and AMP

**AMP** is the band resource (the §6 save format already carries `amp`). Why AMP rather than Volume or Feedback: AMP is *headroom*, a pool you spend on riffs and refill by playing, which gives the basic attack a job (STRUM +2, TUNE +4) instead of being the dead turn it is in most JRPGs; Volume reads as a meter, and Feedback is a status here. AMP persists between battles and is fully restored by Bajonka saves, level-ups, Gas Station Coffee, the Half-Ounce and story rests. Max AMP is 8–22 for Lucky across L1–8; riffs cost 2–8, so a fresh L3 Lucky has three riffs in the tank and must STRUM to earn the fourth. That loop is the feel of a fight.

### The TOON METER

Named for the comic's Toon Level, labeled **TOON** in the HUD: a 0–100 bar drawn as four 24-px segments; each full segment is a **Toon Level** (thresholds 25 / 50 / 75 / 100).

| Fill event (party only; enemy actions never fill it) | Points |
|---|---|
| STRUM hits / crit | +4 / +8 |
| RIFF | +6 |
| SYNC | +10 |
| A party member takes damage | +3 |
| Enemy KO | +5 |
| Possessed or Pocket Ryan acts (always on-beat) | +8 |
| Phoenix's My Brain Thinks | +5 |
| Band Sticker on the actor | +1 per action |
| **Brian in the party (Market Alignment)** | all gains halved, floored |

Spending is the **NOISE** command; each word costs whole levels (25 points each) and the meter drops by exactly that.

| Word | Needs | Cost | Effect |
|---|---|---|---|
| **POP!** | Toon 1 | 25 | Single, NOISE, POW 150; removes one buff. The target squashes. |
| **KRAAANG** | Toon 2 | 50 | All enemies, NOISE, POW 180, 40% DAZED. The letters manifest overhead; the G swings like a bat. 32-px enemies each have a 25% chance to be **knocked off-panel** (removed; no XP, no $). |
| **KRATHOOM** | Toon 3 | 75 | All enemies, NOISE, POW 260, ignores DEF; the actor gains BRISTLING (2). The window frames jitter ±2 px for the rest of the battle. |
| DOOM / CRACK / THUD | Toon 4 | — | Shown grayed as "???". Scripted only: The Eternity. |

Toon Level also gives crit% +3 and party damage +5% per level, and drives the background (0–1 static, 2 scrolling, 3 sine-warped, 4 palette-cycled rupture) and the hit-shake intensity. **The player's meter caps at 99**; only `BattleScripts` sets 100.

Carryover: the meter persists at `floor(meter / 2)` between battles (`GameState.meter`), so chaining hub fights lets the third open with KRAAANG. It resets on any caption card and on load. Simulated: a typical hub fight ends at Toon 26–40, a multi-enemy one at 58–70. Scripted battles may set a start value (AUDITION 0, THE SET 25).

### Slime Sync (double techs)

Listed under RIFF. Both participants alive and not DEAF, each paying the cost, and the partner **has not acted yet this round**: the Sync fires on the initiator's turn and consumes the partner's turn (its SETLIST icon is crossed out). Only slime can Sync; Brian never; Ryan only via script.

| Sync | Pair / unlock | AMP each | Effect |
|---|---|---|---|
| **Shared Aura** | Lucky + Phoenix, tutorial | 4 | Both heal 25% max HP, all statuses cured, +10 Toon. |
| **Low-End Theory** | both L3 | 5 | All enemies, POW 160, LOW and HIGH (better multiplier), 50% TEMPO DOWN. |
| **Wall of Sound** | both L5 | 8 | All enemies, NOISE, POW 220, +15 Toon. |
| **Pocket** | Lucky + Ryan, THE SET only | — | Ryan's AI casts it when Toon ≥ 50: all enemies, NOISE, POW 200, +12 Toon. |

### Status effects

Durations in rounds; reapplying refreshes; TEMPO UP and DOWN cancel. 8×8 icons by the name.

| Status | Effect | Dur. | Cure / immunity |
|---|---|---|---|
| **DAZED** | Skips its next turn. | 1 | Slime Sunglasses immune |
| **DEAF** | No RIFF, SYNC or NOISE. | 3 | Hand Warmer, Shared Aura; Earplugs immune |
| **OUT OF TUNE** | hit −30. | 3 | TUNE, Shared Aura |
| **TEMPO DOWN / UP** | SPD × 0.5 / × 1.5 in the SETLIST roll. | 3 | Hand Warmer cures DOWN |
| **BRISTLING** | ATK +50%, DEF −25%; Lucky swaps to `lucky_rage`. | 3 | — |
| **SLIMED** (enemies) | DEF −3; ×1.25 from LOW and HIGH. | 4 | — |
| **BAKED** (Half-Ounce) | SPD −3, DEF +3. | 3 | — |
| **ON HOLD** (cop) | Countdown to backup; phone icon. | 2 | scripted |
| **KO** | Out. | — | Tater Tot Hotdish |

### Enemy AI

`enemies.json` gives each enemy an `ai` list; on its turn the rows whose `if` holds (the §5.3 evaluator plus `hp`, `hpPct`, `round`, `allies`, `toon`, `partyHas('status')`) are chosen weighted-random. Targeting policies: `random`, `lowestHp`, `highestAtk`, `notRyan`, `self`, `all`.

```jsonc
"ai": [
  { "if": "round == 1",                 "do": "hiss", "target": "random",   "weight": 6 },
  { "if": "hpPct < 30 && allies == 0",  "do": "flee",                       "weight": 3 },
  { "do": "peck", "target": "lowestHp", "weight": 4 }
]
```

Three archetypes: **Brute** (two attacks, one applies a status), **Caller** (timers: the cop's ON HOLD, the Analyst's Dental Plan), **Swarm** (a group riff only while three scooters live). Enemies never heal above 50% and never target KO'd characters; `notRyan` makes the cops hit people who can actually lose.

### Scripted battle events

Keyed by encounter id in `BattleScripts.js` with the §8 hooks plus the extensions listed at the end. Hooks return presentation events the model appends to `model.events`.

**`ep0_drone` — tutorial.** Retrieval Drone vs. Lucky alone.
- `onStart`: "A Vanguard Retrieval Drone followed the pod." Toast: "STRUM to attack. Hits put AMP in the tank."
- `onRound(2)`: `join` Phoenix (Trash Bag). "Beats the day job." Toast: "RIFF spends AMP. Power Chord is 3."
- `onHpBelow(drone, 50)`: "RETRIEVAL TARGET IS NONCOMPLIANT." Toast: "The TOON meter is filling. At 25 you can make NOISE."
- `onDefeat(drone)`: "It leaves a $2 severance check." Give $2.

**`ep0_audition` — AUDITION.** Enemies WHRNNNG (64 px) and THUD-THUD (48 px). Party Lucky, Phoenix, Brian, Ryan (`auto`, `minHp 1` — "the goo won't let him fall"). `noFlee`, Toon 0.
- `onStart`: "One, two, three, four!" → `anim ryan drum` → `transform ryan → ryan_slimed`, `camera.shake 600`, `uiTear 1` (the HUD sits 3 px off for the whole fight). Caption: "[Well. I guess my arms belong to the goo now.]"
- `onRound(3)`: "[Tempo's good, though. Very steady.]" `onRound(5)`: "[Ride cymbal sounds a bit tinny. Should probably buy a new one if I survive this.]"
- `onRound(7)`: "The song crashes to a halt." → `win`. Earlier win if both walls fall. Simulated at L3–4 the walls last 5.4–5.8 rounds and reach the timer 46–79% of the time; damage taken is 87 of a 131 pool at L4 and 116 of 118 at L3 with no healing, so the fight expects one Shared Aura or a Pizza Slice; Brian usually goes down, which is fine and funny. At L2 (the rushed case) it expects the fridge Hotdish.
- On win: "Holy shit. You're a machine." / "[I am literally a hostage.]" / "So, do I get the gig?"

**`ep0_rehearsal` — The Chorus.** A pulsing speech-balloon enemy, HP 400, `minHp 1` ("The chorus repeats."). Party as above. `noFlee`, Toon 0; Brian halves gains, so Toon 2 arrives around round 5 and the player feels the drag.
- `onStart`: "[I give this guy three weeks. Tops.]" Toast: "Hit the chorus. Get to Toon 2."
- `onAction` = NOISE KRAAANG by anyone, or `onRound(8)` ("Lucky and Phoenix's slime links up on its own." then a forced KRAAANG): `anim word_kraaang swing`, `damage brian 1` ("The G knocks over Brian's boutique iced coffee."), `transform brian → brian_fried` (sparks), `status brian OUT OF TUNE`, "I can't work like this! I hate this weird, creative shit! Can't we just play normal music?!" → `win`. The ultimatum runs as a map script; `party remove brian`; give Fried Pedalboard.

**`ep0_palmers_set` — THE SET.** Undercover Cop (48 px). Party Lucky, Phoenix, Ryan (`auto`, Pocket form from the start). `noFlee`, Toon 25.
- `onStart`: "Dispatch, I have located the unauthorized slime gathering. Stand by." `status cop ON HOLD (2)`.
- First party STRUM or SYNC (`onAction`): "The first power chord blows the front row's hair back." `anim cop mohawk_off` ("It lands in a stranger's beer. The stranger says 'whoa, man.'"). Caption: "[No obnoxious guitar solos. Just pure, unadulterated rhythm. The slime is pulsating in 7/8 time. I can work with this.]"
- `onRound(3)`: `spawn` Backup Cop ×2. "Backup. Also in leather jackets. Also with price tags."
- `onDefeat` of any cop → `flee` ("…crawls toward the exit"). Cops never die; they run later.
- `onToon(3)` or `onRound(6)`, whichever first: "[I've been fighting the possession. That was a mistake.]" → `transform ryan → ryan_pocket_purple`, Toon 3 warp, `uiTear 2`, `lockInput on`, flag `eternityArmed`.
- Ryan's next turn: **THE ETERNITY.** `meter 100`, `transform ryan → ryan_eternity` (64 px, overlaps the stage), "[I am not trapped in the goo. The goo is trapped in the pocket.]", music `eternity`, then three words 900 ms apart: **DOOM** (`damage` all enemies 999), **CRACK** (`background palmers_roof_peel`; "The roof of Palmer's Bar peels back exactly like a sardine can."), **THUD** (`camera.shake 1200`; "The walls blow outward."; "[Rhythm achieved.]") → `win`.
- Losing stays possible until `eternityArmed`. Simulated with no items or TUNE: The Eternity fires on round 5; a L4 Lucky ends at 2 of 46 HP, L5 at 15 of 52, L6 at 26 of 58. One Shared Aura makes any of those comfortable; a L4 party is meant to sweat.
- Reward 100 XP, $0 ("Nobody pays you after you level the bar"), the cop's Price-Tag Leather Jacket.

**Required extensions to ARCHITECTURE §8** (additive): hooks `onAction(model, actorId, action)` and `onToon(model, level)`; events `join`, `leave`, `spawn`, `caption` (Ryan's square box in battle), `background`, `uiTear`, `lockInput`; combatant flags `auto`, `minHp`; encounter flag `noFlee`. `tests/battle.test.mjs` must run each of the four scripts end to end with a seeded RNG.

## Party & progression

### Characters

**Lucky** — laser guitar (HIGH), vocals (NOISE). Glass cannon with the best crit and the best Toon synergy. Color is the HUD: `lucky` above 50% HP, `lucky_deflated` below 25%, `lucky_rage` while BRISTLING and permanently after Ryan quits.

**Phoenix** — bass (LOW). Tank and analyst: highest DEF, the scan riff, the only Sync partner in the slice.

**Brian** — guitar (HIGH), temporary, fixed L3, coffee shop → ultimatum. Aggressively normal; his kit is a sabotage (below).

**Ryan** — drums (NOISE/PHYS), temporary, fixed L4, audition → rubble, never player-controlled. Forms: `ryan` (human, map), `ryan_slimed` (Possessed: friendly fire, `minHp 1`, +8 Toon per action, square captions), `ryan_pocket_purple` (Pocket: no friendly fire, Pocket Sync), `ryan_eternity` (64 px, scripted).

### Stats (base, before equipment)

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

Growth: Lucky HP +6, AMP +2, ATK +2, DEF +1, SPD +1, LCK +1; Phoenix HP +7, AMP +2, ATK +1 (+2 on odd levels), DEF +2, SPD +1, LCK +1. Brian (fixed L3): 30 / 6 / 8 / 5 / 9 / 0. Ryan (fixed L4): 40 / 12 / 10 / 6 / 11 / 5. Level-up restores HP and AMP; maxima are read from the table, never accumulated.

### XP table

Everyone in the active party gets full XP (Chrono Trigger, no split). Temp members sit at their fixed level.

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Cumulative XP | 0 | 10 | 24 | 48 | 85 | 135 | 200 | 275 |

Budget: critical path = drone 8 + the two chokepoint hub fights 18 + AUDITION 50 + Chorus 30 + THE SET 100 = **206 → L7 by the end, L4 at the audition, L5 at Palmer's**. Everything optional adds Goose 9 + Analyst 16 + Billboard 30 + Analyst Duo 32 + Goose Pair 18 = 105 → **311 → L8**.

### Riffs learned

| Who | L | Riff | AMP | Freq | POW | Effect |
|---|---|---|---|---|---|---|
| Lucky | 1 | Power Chord | 3 | HIGH | 140 | Single. |
| Lucky | 2 | Feedback Squeal | 4 | NOISE | 70 | All, acc −10, 50% DEAF. |
| Lucky | 3 | Pseudopod Slap | 3 | PHYS | 110 | Single, 60% DAZED (the intercom slap). |
| Lucky | 5 | Migraine | 7 | NOISE | 150 | All, 30% OUT OF TUNE. |
| Lucky | 7 | Bristle | 4 | — | — | Self BRISTLING 3. |
| Phoenix | 1 | Root Note | 3 | LOW | 130 | Single, 30% TEMPO DOWN. |
| Phoenix | 2 | My Brain Thinks | 2 | — | — | Scan: HP, weak, resist, flavor line. +5 Toon. |
| Phoenix | 3 | Deadpan | 4 | — | — | Ally DEF +50% for 3, cures DAZED. |
| Phoenix | 4 | Drone Note | 5 | LOW | 90 | All, 40% TEMPO DOWN. |
| Phoenix | 6 | Rent Is Due | 6 | LOW | 200 | Single; also costs $1. |
| Brian | — | Sterile Chord | 0 | HIGH | 120 | Single, always hits, never crits. |
| Brian | — | Turn the Bass Down | 2 | — | — | Phoenix ATK −25% for 3; Brian ATK +25%. |
| Brian | — | Tube Screamer | 5 | HIGH | 170 | Single; 30% "ground hum" hits a random ally for half instead. |
| Brian | — | Normal Music | 0 | — | — | Toon meter to 0; heals Brian 50%. |
| Ryan P. | — | Blast Beat | — | NOISE | 130 | All. Weight 4. |
| Ryan P. | — | Fill | — | PHYS | 140 | Random target; 20% a party member. Weight 3. |
| Ryan P. | — | Tinny Ride | — | NOISE | 90 | Single, 50% DEAF. Weight 2. |
| Ryan Pk. | — | Seven-Eight | — | NOISE | 150 | All. Weight 4. |
| Ryan Pk. | — | Kick | — | PHYS | 160 | Highest-ATK enemy. Weight 3. |
| Ryan Pk. | — | Pocket | — | NOISE | 200 | Sync with Lucky at Toon ≥ 50. Weight 5. |

### Brian, the deliberately bad temp member

- **$2,000 Pedalboard** (locked accessory): hit 100, crit 0. Honest and sterile.
- **Market Alignment**: Toon gains halved while he is in the party; the TOON label turns beige.
- **Buzzkill**: 20% per round (never on round 1) he ignores the command and complains instead, losing the turn. Six lines rotate: "Can we turn the bass down?", "Do we really need the stickers?", "Is this in a weird time signature?", "My coffee's getting warm.", "Can we play something people know?", "I've got a thing at nine."
- No SYNC, no NOISE ("Brian hates this"). Tube Screamer is his one big hit and it self-sabotages 30% of the time.
- The upside, so the loss registers a little: Sterile Chord never misses (it matters against SPD-10 scooters) and he is the fastest member until Ryan. He leaves the **Fried Pedalboard**: sell it for $11 or wear it (ATK +4, 15% self OUT OF TUNE per RIFF). That choice is all he leaves behind.

## Enemies & bosses

| Enemy | px | HP | ATK | DEF | SPD | XP | $ | Weak / resist | Flavor (Phoenix's scan) |
|---|---|---|---|---|---|---|---|---|---|
| Vanguard Retrieval Drone | 32 | 40 | 6 | 3 | 6 | 8 | 2 | NOISE / — | "My brain thinks it's here to offer you a dental plan." |
| Slush Pile | 32 | 80 | 9 | 4 | 3 | 8 | 3 | HIGH / PHYS | "My brain thinks it's mostly road salt and regret." |
| Canada Goose | 32 | 70 | 10 | 4 | 9 | 9 | 4 | LOW / — | "My brain thinks it has a lawyer." |
| Feral Scooter ×3 | 32 | 36 | 8 | 5 | 10 | 10 total | 6 total | PHYS / NOISE | "My brain thinks someone left these unlocked on purpose." |
| Demographic Analyst | 48 | 130 | 11 | 7 | 7 | 16 | 8 | NOISE / HIGH | "My brain thinks it has already segmented us." |
| WORK IS LOVE Billboard (opt.) | 64 | 240 | 12 | 9 | 2 | 30 | 12 | NOISE ×2 / PHYS, LOW | "My brain thinks it's humming in a key that doesn't exist." |
| Analyst Duo ×2 (month skip) | 48 | 130 | 11 | 7 | 7 | 16 ea | 8 ea | NOISE / HIGH | "My brain thinks they bill in fifteen-minute increments." |
| Goose Pair ×2 (month skip) | 32 | 70 | 10 | 4 | 9 | 9 ea | 4 ea | LOW / — | "My brain thinks they're married." |
| WHRNNNG (AUDITION) | 64 | 280 | 8 | 5 | 8 | — | — | LOW / NOISE | "My brain thinks it's the guitar's fault." |
| THUD-THUD (AUDITION) | 48 | 220 | 11 | 4 | 12 | — | — | HIGH / NOISE | "My brain thinks it's the drummer's fault." |
| The Chorus (rehearsal) | 48 | 400 | 5 | 5 | 5 | — | — | — | "My brain thinks it's catchy. Brian hates it." |
| Undercover Cop | 48 | 400 | 11 | 10 | 8 | — | — | — / PHYS | "My brain thinks the price tag is still on." |
| Backup Cop ×2 | 32 | 110 | 8 | 7 | 7 | — | — | NOISE / PHYS | "My brain thinks they carpooled." |

Scripted encounters pay fixed XP: AUDITION 50, Chorus 30, THE SET 100.

Enemy riffs and AI: **Drone** Taser Prod (PHYS 100) round 1, then 50/50 with Retrieval Beam (PHYS 80, 30% TEMPO DOWN). **Slush Pile** Splash (PHYS 100); Freeze (NOISE 60 all, 30% TEMPO DOWN) when `round % 3 == 0`. **Goose** Hiss (NOISE 60, 30% DAZED) round 1; Peck (PHYS 110, lowestHp); flees below 30% if alone. **Scooter** Zip (PHYS 90); Swarm (PHYS 60 all) only while 3 alive, weight 5. **Analyst** Pick a Demographic (NOISE 80, 50% OUT OF TUNE) 4, Dental Plan (self heal 20, below 50%) 3, Onboarding (TEMPO DOWN 40% all) 2. **Billboard** Slogan (NOISE 70 all) every round; every 3rd round Glitch (self DAZED — the window; the text reads WORK IS L0VE). **WHRNNNG** Sustain (NOISE 60 all). **THUD-THUD** Downbeat (PHYS 110 random); Double (two at 60) every 2nd round. **Chorus** Hook (PHYS 40), Earworm (20% DEAF). **Undercover Cop** Baton (PHYS 100), Pepper Spray (NOISE 60 all, 40% OUT OF TUNE), Hello Fellow Kids (self TEMPO UP, once; "He tries to blend in."); all `notRyan`. **Backup Cop** Baton (PHYS 100), Cuff (40% DAZED).

Boss scripts and tuning are specified in full under *Scripted battle events*. The intent in one line each: AUDITION is survive-the-song while a machine does the killing; The Chorus is a pacing scene with a button prompt; THE SET is a real two-to-four-round fight that ends in a finisher the player watches.

## Items, equipment, shops

Start: **$4**, Half-Ounce (×4), Beat-Up Guitar (equipped), Spiky Slime Sunglasses (after freefall). Phoenix joins with the Trash Bag and the Hoodie.

| Consumable | $ | Effect | Where |
|---|---|---|---|
| Pizza Slice | 3 | Heal 20 HP. | Coffee shop, drops |
| Gas Station Coffee | 4 | +6 AMP. | Coffee shop; Brian gives 2 |
| Hand Warmer | 5 | Cure DEAF and TEMPO DOWN, heal 8. | Coffee shop, pawn |
| Tater Tot Hotdish | 15 | Revive at 50% HP. | Fridge (1); coffee shop after the skip |
| Half-Ounce (×4) | pawn pays $20 | "Session": party AMP to max, BAKED 3. Usable on the map. | Start |
| Fried Pedalboard | pawn pays $11 | Key item / accessory (ATK +4, 15% self OUT OF TUNE per RIFF). | Brian leaves it |

| Equipment | Slot | Who | Stats | $ | Where |
|---|---|---|---|---|---|
| Beat-Up Guitar | instrument | Lucky | ATK +3, HIGH | — | start |
| Thrift Telecaster | instrument | Lucky | ATK +6, LCK +2, HIGH | 26 | pawn |
| Trash Bag | instrument | Phoenix | ATK +2, PHYS, 10% SLIMED | — | alley |
| Beat-Up Bass | instrument | Phoenix | ATK +4, LOW | — | apartment |
| P-Bass Copy | instrument | Phoenix | ATK +7, DEF +1, LOW | 24 | pawn (after skip) |
| Drumsticks / Brian's Strat | instrument | Ryan / Brian | ATK +3 PHYS / ATK +5 HIGH; locked | — | fixed |
| Spiky Slime Sunglasses | accessory | Lucky | LCK +2, immune DAZED | — | freefall |
| Hoodie | accessory | Phoenix | DEF +1 | — | start |
| Earplugs | accessory | any | immune DEAF | 10 | pawn |
| Band Sticker | accessory | any | +1 Toon per action | 6 | pawn |
| Price-Tag Leather Jacket | accessory | any | DEF +4; sells $20 | — | cop drop |
| Flannel / $2,000 Pedalboard | accessory | Ryan / Brian | DEF +3 / hit 100 crit 0; locked | — | fixed |

**Grounds for Dismissal** (barista): Pizza, Coffee, Hand Warmer; Hotdish after the skip. **Lake Street Pawn & Loan**: Telecaster, Earplugs, Band Sticker; after the skip P-Bass Copy and Hand Warmer. Buys the pedalboard $11, the weed $20, the jacket $20, anything else at half. Money budget: $4 + couch 2 + drone 2 + hub 21 + Billboard 12 + post-skip hub 24 + pedalboard 11 + weed 20 = $96 maximum; a typical full-clear has ~$45 by the skip — one instrument and a few items. Selling the weed for a bass is the slice's one economic choice; Phoenix comments at Palmer's either way.

## UI & presentation

- **Battle layout**: SETLIST strip y 4–12; TOON meter x 8, y 16, 96×8 with the level digit (beige while Brian is present); enemies left, party right; command window x 8, y 160, 104×56 (2×3); party window x 120, y 160, 128×56 (name, `HP 46/52  AMP 11`, status icons). Script dialogue uses `ui.say` at the §12.2 geometry; otherwise a one-line message strip at y 148.
- **Lucky's color as HUD** via palette variants, never tinting.
- **Toon escalation**: 0–1 static background, light shake; 2 scrolling background, SFX words physical (KRAAANG's letters fall with a bounce); 3 window frames jitter ±2 px, message strip tilts 1 px; 4 palette-cycled purple-black rupture, torn 9-slice frames, Ryan's 64-px sprite overlapping the enemy side. Every hit spawns a POW / THWAP / BONK word scaled by level.
- **Ryan's captions** use the `ryan_caption` style: rigid square, no portrait, 1 char / 45 ms.
- Battle entry is the §11 static burst; victory is a "SET BREAK" strip. Captions: END PART 1, ONE WEEK LATER, ONE MONTH LATER (drawn askew with a duct-tape strip), NEXT: THE POTATO BELT (DRUMMER WANTED).

## Audio

All synthesized (§7). Meter via `beatsPerBar` / `stepsPerBeat`.

| id | Where | BPM / meter | Mood |
|---|---|---|---|
| `title` | Title | 180, 4/4 | Three-chord punk; the hook is the slice's leitmotif. |
| `podbay` | Pod bay | 96, 4/4 | Corporate hold music; a four-note brand jingle every 8 bars; low saw drone under Dad. |
| `freefall` | Freefall | 160, 4/4 | Rising arpeggios up a semitone every 4 bars; wind noise; cuts dead on impact. |
| `snow` | Alley, Palmer's exterior | 72, 3/4 | Melancholy waltz, triangle melody, noise wind. |
| `apartment` | Apartment | 110, 4/4 | Lo-fi, swung hats; the title riff at half speed in the bass. |
| `signal` | Montage (24 s one-shot) | 140, 4/4 | One saw note bending up, the title riff smeared through a slide, a held triangle at the garage. |
| `hub` | Streets | 140, 4/4 | Mid-tempo street punk with ska upstrokes. |
| `coffee` | Coffee shop | 120, 4/4 | Bossa; an obnoxiously clean jazz chord every 2 bars while Brian is on-screen. |
| `pawn` | Pawn shop | 92, 4/4 | Dusty blues shuffle (cuttable: low-passed `hub`). |
| `battle` | Street fights | 196, 4/4 | Fast hardcore; every battle opens with four stick clicks. |
| `rehearsal_brian` | The Chorus | 120, 4/4 | "Normal music": sterile power chords dead on the grid; pattern K (one bar of saw + noise) when KRAAANG fires. |
| `audition` | AUDITION | 220, 4/4 | Blast beats, tremolo pulse; every 4th bar a fill with too many notes for the channels (the arm smear). |
| `citysound` | Hallway / Room 4 idle | 100, 4/4 | `hub` through a wall: triangle only. |
| `palmers_set` | THE SET | 168, 7/8 (`beatsPerBar 7, stepsPerBeat 2`) | The band's sound: lopsided riff, kick on 1 and 4; Toon 2 adds a pulse harmony, Toon 3 a detuned saw double. |
| `eternity` | The Eternity | 40, 4/4 | Doom: saw sub drone, triangle fifths, one crash per bar; each word a low accent; 20 s, no loop. |
| `rubble` | Aftermath | 60, 3/4 | `snow` without the melody; a lone triangle line on "I quit." |
| `victory` / `levelup` / `gameover` | jingles | 180 / — / 70 | Title-riff sting; six-note arpeggio; the title riff in minor at half speed. |

SFX recipes: the §7 list plus `eject`, `crash`, `pop_x3`, `amp_hum`, `count_in`, `unplug`, `coffee_spill`, `sparks`, `door_slam`, `mohawk_off`, `doom`, `crack`, `thud` (sub-bass thumps at 40 / 50 / 30 Hz with noise tails), `roof_peel`, `wall_blow`, `krathoom`, `van_keys`, `tear`, `toon_up` — 39 total.

## Controls & save

Move: arrows / WASD. Confirm / interact / advance: Z, Enter, Space. Cancel: X, Esc. Run: hold Shift. Menu: C or M. Fullscreen: F. Gamepad mirrors these through `Input.js`. Text 1 char / 30 ms; confirm completes the page.

Bajonka is the save point (interact → sneeze → slot 1 / 2 / 3): City Sound hallway from scene 8, Palmer's exterior, the rubble. Before she exists the game **autosaves to the active slot** after the tutorial, on leaving the apartment, and on entering City Sound. Saves use the §6 format; `meter` is stored and zeroed on load; a Bajonka save fully restores AMP (the dog is a rest). Game over returns to Title with Continue.

## Content inventory

**Overworld sprites (16×24; walk ×3 dirs, idle)**: `lucky` + `lucky_rage` + `lucky_deflated` variants, `lucky_ball` (16×16, pod), `phoenix`, `brian`, `ryan`, `ryan_slimed_map`, `bajonka` (idle, sneeze, trot), `cop` (mohawk on / off), `pawn_guy`, `barista`, `crowd` ×6 palette variants on two bases, `smoker`, `bus_stop_guy`, `hotdish_lady`, `crypto_guy`, map versions of `drone`, `slush_pile`, `goose`, `scooter`, `analyst`.

**Battle sprites (idle 2 / attack 3 / hurt 1 / ko 1 / riff 2)**: 32 px `lucky_battle` (+ rage, deflated), `phoenix_battle`, `brian_battle` + `brian_fried`, `ryan_slimed`, `ryan_pocket_purple`; 64 px `ryan_eternity` (idle 2, word 3). Enemies: 32 `drone`, `slush_pile`, `goose`, `scooter`, `backup_cop`; 48 `analyst`, `thud_thud`, `chorus`, `cop` + `cop_nomohawk`; 64 `billboard`, `whrnnng`.

**SFX-word atlas (2 frames each)**: `pop`, `kraaang` (separate swinging G), `krathoom`, `crash`, `doom`, `crack`, `thud`, `whrnnng`, `thudthud`, `pow`, `thwap`, `bonk`.

**Portraits (32×32, 16)**: `lucky` calm / rage / deflated / sunglasses; `phoenix` tired / deadpan / glasses_push; `brian` smug / red; `ryan`; `dad` (intercom grille); `bajonka`; `cop`; `pawn_guy`; `barista`.

**Tilesets**: `vanguard` (12), `minneapolis` (28: snow, slush, sidewalk, curb, brick ×3, windows, door, neon ×4, billboard ×6, dumpster upright / knocked, pothole, snowbank, lamp, bus stop), `interior` (26: floors, walls, posters ×3, bills, couch, fridge, amp, bass stand, kit ×4, pedalboard / fried, iced coffee, corkboard, counter, sticker wall ×2, soundproof door), `palmers` (22: bar wood, stage, stools, neon, bottles, rubble ×4, sky ×2, peeled roof ×3, drywall).

**Battle backgrounds (256×112)**: `street`, `alley`, `room4`, `palmers`, `palmers_roof_peel`; `rupture` and the Toon 3 warp are procedural.

**UI atlas**: window 9-slice, torn 9-slice, cursor, meter segments (empty / pink / green / purple / black), SETLIST icons (party ×4, enemy, AUTO lock), 9 status icons, duct-tape strip.

**Songs**: 19. **SFX**: 39. **Data**: `characters.json` (4), `riffs.json` (24 incl. syncs and words), `items.json` (6), `equipment.json` (15), `enemies.json` (13), `encounters.json` (11: `alley_drone`, `hub_slush`, `hub_goose`, `hub_scooters`, `hub_analyst`, `hub_billboard`, `hub_analyst_duo`, `hub_goose_pair`, `ep0_audition`, `ep0_rehearsal`, `ep0_palmers_set`), `shops.json` (2), 12 maps, `BattleScripts.js` (4).

**Dialogue scripts**: `ep0_podbay`, `ep0_crash`, `ep0_alley_phoenix`, `ep0_apartment`, `ep0_hub`, `ep0_coffee`, `ep0_garage`, `ep0_citysound_hall`, `ep0_room4_audition`, `ep0_month_later`, `ep0_rehearsal_quit`, `ep0_palmers_ext`, `ep0_palmers_set`, `ep0_rubble`, `shops`, `bajonka_save` — about 230 pages, 40 flavor lines, 6 Buzzkill lines, 3 Brian complaints.

## Risks & cuts

| Risk | Mitigation / cut |
|---|---|
| The scripted battles need §8 extensions (`join`, `spawn`, `onAction`, `onToon`, `lockInput`, `minHp`). | Amend §8 before BattleModel is written; all additive. `onAction` can be polled from `onTurnStart` if needed. |
| Toon 4 presentation is the most expensive visual. | Cut order: palette-cycled background → torn 9-slice → never the 64-px Ryan and the three words. The words are the scene. |
| Freefall minigame is an extra scene. | Cut to a 12-second cutscene; the Toon 1 bonus becomes unconditional. |
| Buzzkill can feel like eaten inputs. | Suppressed on round 1, capped at 20%, lives in two scripted fights. If testers hate it, 10% and put the lines on his successful turns. |
| A L4 party can lose THE SET before The Eternity. | `onRound(6)` backstop, `notRyan`, the fridge Hotdish, pawn Hand Warmers. If still too hard, Backup Cop ATK 8 → 7. |
| A L2 party at the AUDITION (skipped the hub) wipes 21% of the time without items. | Two hub enemies sit in chokepoints so L2 is the floor; the fridge Hotdish and $4 of pizza exist for this case. Acceptable for a first boss. |
| Bounded XP means no grinding. | Intentional: required fights are tuned for L4 / L5; the Billboard and post-skip hub are the catch-up. |
| 19 songs is a lot of chiptune. | Cut `pawn`, `citysound`, `coffee`, `rubble` to filters of existing songs. `palmers_set`, `eternity`, `battle`, `audition`, `title` are not cuttable. |
| SLIMED, BAKED and Band Sticker are low-value. | Cut all three first; no script depends on them. |
| The weed sale reads as a gag with no consequence. | Phoenix's Palmer's line ("We sold the weed for this." / "We kept the weed for this.") keeps it honest. |
