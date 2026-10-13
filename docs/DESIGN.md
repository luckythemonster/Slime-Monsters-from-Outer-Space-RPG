# Slime Monsters from Outer Space — Vertical Slice Design (Chapter 1: Coagulation)

This is the single build document for the slice. It merges the three competing proposals in `docs/design-proposals/` (systems, levels, feel) and resolves every contradiction between them in the Appendix. Where this document and `docs/ARCHITECTURE.md` disagree, ARCHITECTURE wins on *how it is wired*; this document wins on *what the game is*. Anything the design needs that ARCHITECTURE does not provide is listed once, in **Engine extensions required**, with a fallback.

Target: 45–75 minutes from the title screen to "NEXT: THE POTATO BELT (DRUMMER WANTED)". Measured against a first-time player who reads most things: ~69 minutes fighting everything, ~50 skipping every optional fight. Resolution 256×224, 16×16 tiles, generated pixel art, synthesized chiptune, Phaser 4 + Vite.

Story order is Lucky's (the IP owner's) canonical Chapter 1: Lucky → Phoenix → **Brian joins second** (coffee-shop flyer; Zappa shirt; $2,000 pedalboard) → Brian gets **Ryan** in the room (the cosmic amp signal still froze Ryan in his garage; Brian's phone call is what moves him). Brian quits over KRAAANG / iced coffee / fried pedalboard / "are you calling my house crooked?!". At Palmer's, Ryan becomes **THE ETERNITY**, levels the bar, is terrified, and quits on the spot; Lucky is enraged and locks magenta. Stinger: Bajonka with the van keys and the itinerary, "NEXT: THE POTATO BELT (DRUMMER WANTED)".

## Pillars

1. **Every fight is a song.** Turn order is the SETLIST, basic attacks are STRUMs, techs are RIFFs, the energy pool is AMP, the shared meter is the TOON meter. No sword vocabulary anywhere in the UI.
2. **The comic's Toon Level is both the presentation dial and the battle meter.** Scenes carry a Toon Level 0–4 that says how much the engine may break: 0 plain windows, 1 emotes and 1 px shakes, 2 sound-effect words become physical sprites and the border bends, 3 the frame tears, 4 the art ruptures. In battle the TOON meter (0–100, four segments) is the same scale made mechanical: it buys NOISE words (POP! / KRAAANG / KRATHOOM) and escalates the background and HUD. Toon 4 is never player-reachable; it is The Eternity.
3. **Lucky's color is the HUD.** Pastel pink calm, magenta rage, pale pink deflated. Palette-variant sheets, never runtime tint; the dialogue window's inner rule carries the same color.
4. **Earthbound's deadpan in FF6's clothes.** Flat zine windows, contemporary Minneapolis, every tile has a joke; but side-view battles with a stepping-forward active character, popping digits, a count-in on every fight and a victory sting.
5. **The band is the party and the band is unstable.** Brian is a playable liability who halves the meter; Ryan is a possessed ally the player never controls. Both quit. The band gets better and smaller in the same ten minutes and Lucky ends locked magenta.
6. **Small numbers, readable math, no grinding.** Two-digit HP, single-digit stats, integer arithmetic, ±10% variance. Street fights run 2–5 rounds, bosses 5–7. Total XP is bounded by on-map enemies that stay dead, so tuning is deterministic.
7. **Broke is the permanent condition.** $4 and a half-ounce of weed at the start; ~$45 by the month skip; one instrument upgrade only if you sell the weed or Brian's fried pedalboard.

## Scene-by-scene flow

Cutscene ids (CS-nn) are script ids in `src/data/scripts/ep0.json`; battle ids (B-n) are keys in `src/data/encounters.json` and, for scripted fights, `BattleScripts.js`. Toon Level is the presentation dial for the scene. Minutes are for a first-time reader.

| # | Scene | Toon | Map / scene | Cutscenes & battles | min |
|---|---|---|---|---|---|
| 0 | Title | 1 | `TitleScene` | Skyline, contrail, billboard glitch; NEW GAME / CONTINUE | 1 |
| 1 | Pod bay | 1→3 | `pod_bay` | CS-01 `ep0_pod_intro`, CS-02 `ep0_speaker` (SQUELCH), CS-03 `ep0_eject` | 3 |
| 2 | Freefall | 3 | `FreefallScene` | 24 s steerable descent, slime sunglasses, 5 WORK IS LOVE billboards | 1 |
| 3 | Alley | 2→1 | `alley` | CS-04 `ep0_crash` (KRATHOOM, CRASH tips dumpsters, pothole line, grievances, aura, "Beats the day job"); **B-1 `alley_drone`** tutorial, Phoenix joins round 2 | 6 |
| 4 | Street, first pass | 1 | `street_cedar` (day, hub closed) | Only the apartment door opens; one-line refusals elsewhere | 2 |
| 5 | Apartment & the signal | 2 | `apartment`, `rooftops`, `garage_north` | CS-05 `ep0_signal` (border bend, montage, Ryan freezes, END PART 1, ONE WEEK LATER), CS-06 `ep0_week_later` | 5 |
| 6 | Hub open | 1 | `street_cedar` (day) | Day enemies: **B-2 `hub_slush`**, **B-3 `hub_scooters`** (chokepoints), **B-4 `hub_goose`**, **B-5 `hub_analyst`**, **B-6 `hub_billboard`** (optional static mini-boss); café and pawn open | 8 |
| 7 | Coffee shop: Brian | 0→1 | `coffee_shop`, `garage_north` | CS-07 `ep0_flyer` (flyer-text choice), CS-08 `ep0_brian_joins` (Brian joins second; "I know a guy"; the landline call; "Yep.") | 5 |
| 8 | City Sound hallway | 0→1 | `city_sound_hall` | CS-09 `ep0_ryan_arrives` (impossible hardware stack; Bajonka, clipboard, nod, sneeze, time-skip). **Bajonka saves from here on** | 3 |
| 9 | Room 4: AUDITION | 1→3 | `room4` | CS-10 `ep0_room4_setup` ("$4 and a half-ounce of weed"), CS-11 `ep0_audition_start` ("One, two, three, four!"), **B-9 `ep0_audition`** (survive the song; Ryan possessed), CS-12 `ep0_contract` (Ryan joins; the agreement; save) | 9 |
| 10 | ONE MONTH LATER | 0→2→1 | `room4` | CS-13 `ep0_month_later` (stickers; "I'm not a 'man,' Brian"), **B-10 `ep0_rehearsal`** (The Chorus; reach Toon 2; KRAAANG; the G; coffee; sparks; "I hate this weird, creative shit!"), CS-14 `ep0_ultimatum` (unplug POP; "or you are fired"; brain X-ray; "crooked?!"; slam; Brian leaves; Fried Pedalboard), CS-15 `ep0_gig_flyer` | 8 |
| 11 | Street at night | 1 | `street_cedar` (night) | Night enemies: **B-7 `hub_analyst_duo`**, **B-8 `hub_goose_pair`**; pawn restock; Bajonka outside Palmer's (save) | 4 |
| 12 | Palmer's: THE SET | 1→3→4 | `palmers` | CS-16 `ep0_palmers_set` (six-inch stage; "Dispatch, I have located the unauthorized slime gathering"); **B-11 `ep0_palmers_set`** (Cop + backup; mohawk into a beer; Pocket form; THE ETERNITY; DOOM / CRACK / THUD; roof peels; walls blow) | 9 |
| 13 | Rubble | 1→0 | `palmers_rubble` | CS-17 `ep0_aftermath` ("That is our sound"; "domestic terrorists"; "space-time continuum"; **"I quit."**; RAGE / PLEAD / JOKE; "Yep."; magenta lock; Bajonka, keys, itinerary; "We don't have a drummer."; NEXT: THE POTATO BELT (DRUMMER WANTED)) | 5 |

Totals: 11 encounters (1 tutorial, 7 hub, 3 scripted). Party levels on the critical path: L1 → L2 after the drone → L3–4 at the AUDITION → L5 at Palmer's → L7 at the end; L8 if every optional fight is taken.

**Flag spine** (gating lives only in entity and exit `condition`s so `__slime.warp` + `setFlag` can jump the playthrough test to any scene):

```
TITLE ─new game─▶ pod_bay
  speaker ─▶ podSpeakerSlapped ─EJECT─▶ ejected ─▶ [Freefall] vars.billboardsTagged
alley  ep0_crash ─▶ metPhoenix ─B-1─▶ droneDefeated, phoenixJoined  (autosave 1)
apartment  amp ─▶ signalSent ─[rooftops, garage_north]─▶ END PART 1 / ONE WEEK LATER
  ─▶ weekLater, hubOpen (café, pawn, day enemies ON)  (autosave 2 on leaving the apartment)
coffee_shop  corkboard ─▶ flyerPosted (vars.flyerText 0..2) ─▶ brianJoined ─[garage call]─▶ ryanCalled (City Sound door ON)
city_sound_hall  (autosave 3 on enter) ep0_ryan_arrives ─▶ ryanArrived ─▶ hasBajonka (SAVES ON)
room4  ep0_room4_setup ─B-9─▶ auditionDone, ryanJoined (contractPages = 3 + vars.saveCount) ─save─▶
  ONE MONTH LATER ─▶ monthLater ─B-10─▶ pedalboardFried ─▶ brianQuit (−brian, +fried_pedalboard) ─▶ hasPalmersFlyer (street NIGHT; Palmer's ON)
palmers  stage ─▶ ep0_palmers_set ─B-11─▶ eternityDone ─▶ palmers_rubble
rubble  ep0_aftermath ─▶ ryanQuit (vars.quitResponse; −ryan; luckyRageLocked) ─▶ ch1Complete ─save─▶ TITLE
Side flags (never gate the spine): readBillyPod, billsRead, pizzaBoxLooted, fridgeLooted, jukeboxPlayed,
cleared_<enemyId>, trig_<map>_<id>, vars.saveCount, vars.billboardsTagged, vars.flyerText, vars.quitResponse.
```

## Maps

All maps use the §4 JSON format (ASCII rows + legend). Coordinates are tile coordinates, origin top-left. "Save" means a `type: "save"` Bajonka entity.

| id | Name | W×H | Tileset | Music | Exits | Save |
|---|---|---|---|---|---|---|
| `pod_bay` | Vanguard drop-pod bay | 16×14 | `vanguard` | `podbay` | EJECT → `FreefallScene` → `alley` | — |
| (scene) | Freefall over Minneapolis | — | procedural | `freefall` | → `alley` (9,8) | — |
| `alley` | Alley behind Palmer's | 24×14 | `minneapolis` | `snow` | W edge → `street_cedar` (38,12) (after `phoenixJoined`) | — (cameo) |
| `street_cedar` | Cedar Ave, West Bank (hub, day/night) | 40×24 | `minneapolis` | `hub` / `snow_night` | E edge → `alley` (1,9); doors → `apartment`, `coffee_shop`, `palmers`; pawn door → shop script; rail → `city_sound_hall` (2,6) | night: outside Palmer's |
| `apartment` | Phoenix's apartment | 16×14 | `interiors` | `apartment` | door (12,13) → street (12,9) | — (cameo) |
| `coffee_shop` | Hard Luck Café | 20×14 | `interiors` | `normal_music` | door (10,13) → street (20,9) | — |
| `rooftops` | Signal montage strip | 48×14 | `minneapolis` + `pines` | `signal` | cutscene only | — |
| `garage_north` | Ryan's garage | 16×14 | `pines` | `garage` | cutscene only | — |
| `city_sound_hall` | City Sound, hallway | 28×12 | `interiors` | `citysound` | stairs (2,6) → rail → street (21,15); Room 4 door (20,5) → `room4` (3,10) | outside Room 4 (20,7) |
| `room4` | City Sound, Room 4 | 14×12 | `interiors` | per scene | door (3,10) → hall (20,7); gated during cutscenes | via CS-12 `save` |
| `palmers` | Palmer's Bar | 26×14 | `interiors` | `palmers` | door (8,13) → street (8,9); closed once on stage | — (Bajonka outside, on the hub) |
| `palmers_rubble` | Palmer's, leveled | 26×14 | `interiors` (rubble tiles) | none, `wind` | none; chapter ends | end of chapter |

Twelve maps including the scene. Every map lists `"encounters": { "rate": 0, "pool": [] }`.

### `pod_bay` — 16×14
**Layout.** Steel floor, catwalk along the top row, three drop pods along the bottom (pod 2 open at (7,11), Lucky inside). Intercom speaker 2×2 on the north wall at (7,2). Viewport (12,2) onto Planet California, a planet made of billboards (`window_stars` animated tile). Vending machine (2,3), plaque (4,2). Pod 3 nameplate (11,11). **Spawn** (7,11) facing up. Lucky uses the `lucky_ball` 16×16 sheet here (rolls; 2-frame squish idle).
**Interactables.** Speaker → CS-02. Pod 2 EJECT (6,11) → CS-03. Laser guitar case in the pod (8,11): "The only thing from home worth the fuel." (equips Beat-Up Guitar; one toast: "EQUIP is in the menu."). Pod 3 nameplate: "RESERVED — RUBEN, B." → Lucky: "…They're late. They're always late." (`flags.readBillyPod`). Vending: "DENTAL PLAN: SOLD OUT. DEMOGRAPHIC: SOLD OUT. WATER: $40." Plaque: "EMPLOYEE OF THE QUARTER: DAD (41 CONSECUTIVE)." Viewport: "One billboard says WORK IS LOVE. Lucky has never seen it turned off."
**Triggers.** Four once-only floor bands (rows 4, 6, 8, 10 across x 3..12) keep Dad going (CS-01 extras). **Enemies:** none.

### `alley` — 24×14
**Layout.** Palmer's brick back wall along the north: lit window (16,3), steel door "PALMER'S — DELIVERIES" (18,4). Snow and slush; four dumpster objects at y 5, x 6..13 (two tiles each); crater object at (9,8) after the crash; chain-link dead end east with a bike frozen to it (22,7); the west end opens onto Cedar. Milk crate (19,6). **Spawn** (9,8) facing down (the crater; set by the Freefall return).
**NPCs.** Phoenix at (12,6) until joined (then trails the player as a follower sprite). Bajonka cameo on the milk crate after B-1 (`object`, `condition: flags.droneDefeated`, no clipboard): "A dog. She has been there the whole time." Phoenix (second press): "That dog's been by the back door since I started here. My brain thinks she's the landlord."
**Interactables.** Crater: "Lucky's pothole. It glows faintly. Someone is going to be billed." Tipped dumpster: "Nine Pizza Luce boxes, all empty, all someone's Tuesday." (one Pizza Slice, `flags.pizzaBoxLooted`). Drone wreck (14,8): "RETRIEVAL DRONE (DECEASED). Its little screen still says ASSET LOCATED." Steel door: "EMPLOYEES ONLY." / Phoenix: "I'm an employee. I'm not going in there." Bike: "Someone has been paying for that U-lock since 2019."
**Enemies.** The tutorial drone, scripted only. **Triggers.** `onFirstEnter` → CS-04. West exit `condition: flags.phoenixJoined`.

### `street_cedar` — 40×24, the hub (day and night)
**Layout.** Cedar Ave runs west–east through rows 11–13 (asphalt, lane line, two parked cars, snowbanks). North sidewalk, west to east: Palmer's (neon sign 4 tiles on the `over` layer, door (6,8)); the Towers — Phoenix's building, door (12,8); Hard Luck Café (door (20,8)); Cedar Pawn & Loan (door (28,8), shop window (29,8)); bus shelter (33,9) with the Pizza Luce box beside it (34,10). South sidewalk: the Cedar-Riverside light-rail platform with its `exit` at (21,16); a hydrant (10,15); a bike rack (26,15); the alley mouth at the east edge (39,11–13). Snowbanks (solid) channel the player through two chokepoints: the crosswalk at x 16–17 and the platform stairs at x 22–23. The WORK IS LOVE billboard is an `over`-layer object (14..19, 2..4); it swaps to `billboard_glitch` while the player is within 3 tiles after `flags.signalSent`.
**Spawn** (38,12) facing left (from the alley).
**Day NPCs** (`condition: !flags.hasPalmersFlyer`). Snow Shoveler (8,14): "I've shoveled this square four times today. The city calls it a job. I call it a relationship." Cyclist (26,14): "It's not cold if you're angry enough." Busker (18,9): "I take requests. I can't play them. But I take them." Crust Punk with dog (30,15): "Her name's Also Bajonka. No relation." Office Worker (36,9), after `signalSent`: "Did you see the sky? {var:billboardsTagged} billboards went down. My boss cried." Pawnbroker is reached through the pawn door (shop script, below).
**Night NPCs** (`condition: flags.hasPalmersFlyer`). Tall Stranger outside Palmer's (4,9): "Whoa, man. The stars are heavy tonight." (Chapter 2 seed.) Smoker (8,9): "They're on in ten. The drummer looks… wet." Bajonka (`save`) at (5,9) beside Palmer's door. Shoveler, Cyclist, Busker gone.
**Interactables.** Towers sign (13,8): "RENT DUE. ALSO: RENT INCREASE. ALSO: RENT." Pizza Luce box: "Still warm? No. Nothing in Minneapolis is still warm." → one Pizza Slice (`flags.pizzaBoxLooted2`). Shelter ad: "WORK IS LOVE. (smaller:) LOVE IS A VANGUARD TRADEMARK." Hydrant flyer: "LOST: CAT. ANSWERS TO 'NO.'" — after `eternityDone`: "LOST: MOHAWK. SENTIMENTAL VALUE. NO QUESTIONS." Pawn door → `shop_pawn` script. Café door `condition: flags.hubOpen`, refusal before: Phoenix: "After. I need to lie down in a specific way." Rail exit `condition: flags.ryanCalled`, refusal before: "The train is here. The reason to take it isn't." Palmer's door `condition: flags.hasPalmersFlyer`, refusal before: "PALMER'S. Closed until there's a reason."
**Enemies (day, `flags.hubOpen`).** `slush` Slush Pile, `static` at the crosswalk chokepoint (16,12) — "It's not moving. You are." (B-2, effectively mandatory). `scooters` Feral Scooter Pack, `patrol` path `RRRRRRLLLLLL` on row 13 between x 20 and x 26 covering the platform stairs (B-3, effectively mandatory). `goose` Canada Goose, `wander` radius 3 at (33,14), sight 4 (B-4). `analyst` Demographic Analyst, `chase` sight 5 at (27,10) by the pawn (B-5). `billboard` WORK IS LOVE Billboard, `static` object at the billboard's base (16,5): "It's humming. Fight it?" [Yes / No] (B-6, optional).
**Enemies (night, `flags.hasPalmersFlyer`).** `analyst_duo` Analyst Duo, `chase` sight 5 at (24,10) (B-7). `goose_pair` Goose Pair, `wander` radius 3 at (31,15) (B-8). All enemies clear via `setOnWin: flags.cleared_<id>`.
**Night dressing.** A blue overlay rectangle at depth 50 under the `over` layer; lit-window objects; neon on; the night NPC roster via `condition`.

### `apartment` — 16×14, home
**Layout.** One room. Door (12,13). Couch west (2..4,6) — nap = full heal, where ONE WEEK LATER lands. Bass amp (3,9). Kitchenette north: fridge (10,2), radiator (14,5). Window (6,1) facing the billboard. Bills on the coffee table (6,7). Four posters on the north wall. Lucky's bed, a Tupperware bin (13,9). Bathroom door (1,2), locked. Bajonka cameo on the couch arm (`condition: flags.weekLater`, object): "The dog is on the couch. Phoenix has not mentioned the dog."
**Spawn** (12,12) facing up. **NPC.** Phoenix (follower; sits on the couch during CS-06).
**Interactables.** Amp → CS-05; afterward: "It hums at a frequency Phoenix describes as 'rent.'" Bills cycle five lines: "RENT: PAST DUE." / "STUDENT LOANS: PAST DUE, FOREVER." / "VANGUARD SPECTRUM INTERNET: PAST DUE. (You do not have internet.)" / "PARKING TICKET. (Phoenix does not own a car.)" / "CITY OF MINNEAPOLIS: POTHOLE, 1 (one). $4,000." — all five read sets `flags.billsRead`; Phoenix: "My brain thinks we should frame that one." Fridge: "A half-ounce of weed, a Pizza Luce slice and a Tater Tot Hotdish. Assets." (gives Pizza Slice ×1 and Tater Tot Hotdish ×1 once, `flags.fridgeLooted`). Window: "WORK IS LOVE. It has never once been turned off." (glitches after `signalSent`). Radiator: "It clanks in 7/8. Phoenix says it's the building settling. It is not." Bin: "It's a bin. It's a big bin. It's yours." Bathroom: Phoenix: "There's a mirror in there. I don't recommend it." Posters: "RAT FIGHT — DULUTH" / "GREAT BIG THING CRAWLING ALL OVER ME" / "THE DENIM BOYS: A NIGHT OF DENIM" / "HARD LUCK OPEN MIC (NO MICS)". Bass stand (2,9): "Beat-Up Bass. Four strings. Three work." (equips Phoenix's Beat-Up Bass once).
**Enemies:** none.

### `coffee_shop` — 20×14, Hard Luck Café
**Layout.** Counter north (barista at (4,3)); corkboard (16,2); six tables; a window table at (17,9) where Brian sits with the pedalboard on the table and an iced coffee; bathroom (18,5); door (10,13). **Spawn** (10,12) facing up.
**NPCs.** Barista: "Coffee's $3. Hot water's free. Nobody's happy either way." → `shop cafe`. Screenwriter (6,8): "It's about a slime monster who—no. No it isn't. It's about a divorce." Poet (12,6): "A piece about snow. It's called 'Snow.' It's finished." Internship Kid (8,10): "Question 9: 'Describe your demographic.' I put 'tired.'" Brian (17,9), before CS-08: "{speed:fast}Working. Sorry. Big pedalboard day." (`condition: !flags.brianJoined`).
**Interactables.** Corkboard → CS-07; afterward: "KEYBOARDIST WANTED. Must own keyboard. We do not own a keyboard. We own a dream." / "FREE COUCH. HAUNTED. FIRM." Bathroom sign: "PLEASE DO NOT ASK THE UNIVERSE FOR ANYTHING IN HERE." Tip jar: "$0.75 and a guitar pick." / Phoenix: "My brain thinks that's theft."
**Triggers.** Door-exit trigger (10,12) `condition: flags.flyerPosted && !flags.brianJoined` → CS-08. **Enemies:** none.

### `rooftops` — 48×14, cutscene strip
Skyline silhouettes along rows 6–13; PRODUCTIVITY IS FREEDOM billboard object at x 14; WORK IS LOVE at x 38; highway lights row 12; pines from x 44. Camera pans; no player. Cut fallback: three captions over black.

### `garage_north` — 16×14, cutscene map
Open garage door (7..8,13) onto snow and pines; the kit (32×32 object) at (7,6); Ryan on the throne (8,7); a wall landline (3,4); a space heater (13,5) that does nothing. Used twice: the wave (CS-05) and the call (CS-08). No player; camera centered on the kit.

### `city_sound_hall` — 28×12
**Layout.** A two-tile corridor (rows 6–7) from the stairs (2,6) east to a dead end at x 27; Rooms 1–6 along the north wall (doors at x 8, 12, 16, 20, 24, 26; Room 4 at (20,5)); night-manager desk (5,4); vending (8,4); bulletin board (12,4); bathroom door (26,5). Every wall tile is a sticker tile (four variants). Bajonka outside Room 4 at (20,7) — the canonical clipboard pose, `type: save`, `condition: flags.hasBajonka`. **Spawn** (2,7) facing right.
**NPCs.** Night Manager (5,5): "Room 4. Cash only. Don't put stickers on the stickers." Ska Band ×3 loading out at (10..12,7): "Ska's coming back." / "It never came." / "Checkmate." Noise Guy in Room 2's doorway (12,6): "I'm the only member. I'm also the audience. Reviews are mixed."
**Interactables.** Board: "BASSIST WANTED (NOT YOU, GREG)." / "DRUMMER AVAILABLE: 13/8 ONLY." / "LOST: CLIPBOARD. IF FOUND, YOU HAVE ALREADY SIGNED." Vending: "Everything is $1.25. Everything is sold out." Other doors: one muffled line each ("Room 1 is practicing one chord. It is getting better.").
**Triggers.** Room 3 proximity (16..18,6..7) `once` → CS-09. Room 4 door exit `condition: flags.ryanArrived`. **Enemies:** none.

### `room4` — 14×12
**Layout.** Door (3,10). Kit NE (10..12,2..4) as a 32×32 object plus a cymbal tile. Lucky's stickered amp (2,5); Phoenix's amp (2,7); mic stand (7,6); the Puddle Couch (11..13,9); mini-fridge (13,6); a wall of band tallies north. Conditional dressing: Brian's pedalboard (6,8) and iced coffee (8,8) while `monthLater && !brianQuit`; `pedalboard_fried` after `pedalboardFried`; the contract on the snare during CS-12; a ceiling-drip object (10,1) after `auditionDone` (the freeze gag). **Spawn** (4,9) facing right.
**Interactables.** Lucky's amp: "Forty-one stickers. Nine are political. Brian counted." Kit: "The size of a sedan. The ride cymbal is tinny. Don't tell him." Fridge: "Nobody has ever opened it." Tallies: "RAT FIGHT WAS HERE. (They toured?)" / "THE DENIM BOYS: ROOM 4 FOREVER (crossed out: NOW ROOM 2)." Iced coffee: "Boutique. Nine dollars. It has a name. The name is Brian." Pedalboard: "$2,000 of pristine, never-stepped-on tone." → fried: "It smells like a fuse and oat milk."
**Triggers.** `onFirstEnter` → CS-10; `onEnter` with `flags.monthLater && !flags.monthLaterRan` → CS-13. **Enemies:** B-9, B-10, scripted only.

### `palmers` — 26×14
**Layout.** Door (8,13). The bar along the north (rows 2–3, x 2..16); bartender behind it (10,2). Stage east (20..24, 5..10), one tile raised via a `deco` step edge; kit object (23,6); mic (21,8). Bathrooms (1..2, 8..10). Pull-tab booth (4,10). Jukebox (16,10). Photo wall north (x 17..25, row 2). Twelve crowd NPCs in rows 7–11 (six palette variants on two bases); the cop in the back corner (22,11); the tall stranger (14,11) with a beer. **Spawn** (8,12) facing up.
**NPCs.** Bartender: "Phoenix, you're not on tonight." / Phoenix: "My brain thinks I'm on *very* tonight." Pull-tab Lady (5,10): "Minnesota's slot machine. I'm up four dollars." Regular (12,8): "Been coming since '06. The place, not me. I'm from Fridley." Cop (22,11): "Hello, fellow kids. I also enjoy the… moshes." Tall Stranger (14,11): "Good vibes in here. Dense." Nurse (7,9): "Off shift. On something." Guy (18,9): "Saw the Replacements here." (He did not.) Six crowd one-liners cycling "Woo." / "Is that the slime band?" / "I heard they're from space." / "Everyone's from space, Doug." / "Play faster." / "Play louder."
**Interactables.** Jukebox: `choice` of four songs that don't exist ("Pothole Blues", "Rent Is a Feeling", "7/8 Shuffle", "Dental Plan"), each a 4-bar jingle (`sfx jukebox_1..4`); `flags.jukeboxPlayed`. Pull tabs: "$1. (You have $4.) (You do not.)" Sign: "PALMER'S — EST. 1906 — NO SOLOS." Photo wall: "Every band that ever played here. None of them leveled it."
**Triggers.** Stage (20..24, 5..10) `once` → CS-16. Door exit `condition: !flags.onStage`. **Enemies:** B-11, scripted only.

### `palmers_rubble` — 26×14
Same footprint: walls → `rubble` tiles, north rows → `sky_hole` tiles (night sky, stars), drywall slabs, a bent mic stand, the bar intact ("The bar survived. The bar always survives."). The cop sprints off west in a `move` loop holding his mohawk. Two dazed patrons: "I was mid-pull-tab." / Tall Stranger holding the mohawk: "Whoa, man. Is this… someone's?" Bajonka under the drywall at (14,8) (spawned by CS-17). No exits; the chapter ends here.

## Cutscenes

Every cutscene is a numbered list of §5.1 commands in shorthand: `say who "text"` = `{"say":"text","who":"who"}`, `set a, b` = `{"set":{"flags.a":true,"flags.b":true}}`, etc. Commands **not** in §5.1 are marked **[EXT]** and appear in *Engine extensions required* with their fallback. Text markup used: `\n`, `{pause:ms}`, `{speed:…}`, `{color:…}`, `{shake}`, and **[EXT]** `{var:name}` (substitutes `vars.name`). Portraits are named `<who>_<mood>`; `say` without a portrait uses the character's default. Ryan's spoken lines use `who: "ryan"` (plain box, name tag, portrait `ryan_stoic`); his thoughts use `who: "ryan_caption"`.

### CS-01 `ep0_pod_intro` (`pod_bay.onFirstEnter`) — Toon 1
1. `music podbay`; `camera fade in 600`.
2. `say dad portrait:dad_grille` "I just don't understand the whole nonbinary thing."
3. `say dad` "Why can't you pick a tangible demographic to market yourself to?"
4. `say dad` "If you'd just join The Vanguard, you could be financially successful and oppress people with a dental plan!"
5. `emote player …`; `set flags.podIntro`.

Floor-band triggers `ep0_dad_1..4` (once each; `condition: !flags.podSpeakerSlapped`): `say dad` "Your mother and I paid for the compression. The least you could do is market yourself." / "There's an opening in Demographic Alignment. You'd report to me." / "Billy's parents say Billy 'found themself.' In a storage unit." / "…I can see the speaker light." Twins with `condition: flags.podSpeakerSlapped`: `say dad` "{speed:slow}mmf. mmmf."

### CS-02 `ep0_speaker` (interact, speaker) — Toon 3
1. `face player up`; `anim player lucky_ball_pseudopod wait:true`; `sfx squelch`; `sprite speaker speaker_slimed`.
2. **[EXT]** `ui.collapse` — the FF-gradient Dad window collapses vertically 56→0 px in 4 frames mid-sentence (fallback: a normal page end). Implemented as `say dad "{speed:slow}I'm not finished, Lucky. The quarterly—"` followed by `{"sfx":"squelch"}` with the box's `collapse: true` option.
3. `say lucky` "Better."; `set flags.podSpeakerSlapped`; `music null`; `sfx intercom_buzz` stops.

### CS-03 `ep0_eject` (interact, EJECT) — Toon 3
1. `if !flags.podSpeakerSlapped`: `say narrator` "An unnecessarily red button, locked out by PARENTAL OVERRIDE." → `say dad` "You can't eject while I'm talking, Lucky. Safety is a core value." → `end`.
2. `say narrator` "An unnecessarily red button."; `choice` [EJECT → continue / Not yet → `end`].
3. `sfx eject`; `camera shake 600 0.02`; `camera flash 120`; `set flags.ejected`; `scene freefall`.
4. On return (the Freefall scene calls back): `teleport alley 9 8 facing:down` (the crater; `alley.onFirstEnter` runs CS-04).

### CS-04 `ep0_crash` (`alley.onFirstEnter`) — Toon 2 → 1
1. Black; `music null`; ambient `wind`; `camera fade in 400` on Phoenix at (12,6) with the trash bag (`phoenix` sheet, `trash_bag` frame).
2. `say phoenix` "{speed:slow}…"
3. `sfx crash`; `camera shake 900 0.03`; `camera flash 120`; `spawn crater sprite:crater 9 8`; `spawn crash_fx sprite:crash_word 10 4` (Toon 2: CRASH is an object); `move crash_fx "RRR" wait:true` — each dumpster it passes swaps to `dumpster_down` (`sprite dumpster_1 dumpster_down` ×4 between steps); `despawn crash_fx`.
4. `sprite player lucky_puddle`; `wait 900`; `anim phoenix phoenix_glasses_push wait:true`.
5. `say phoenix portrait:phoenix_tired` "My brain thinks you're going to have to pay the city for that pothole."
6. `anim player lucky_reform wait:true` (`sfx slime_pop` ×3 — pop-pop-pop); `sprite player lucky`.
7. `say lucky` "My dad runs Demographic Alignment for the Vanguard. He thinks a personality is a market segment." / `say lucky` "Planet California is one billboard with a dental plan." / `say lucky` "My old band's still back there. Or they're not. I didn't check."
8. `face phoenix toward:player`; `say phoenix` "I came here for college. The economy fell over. Rent didn't." / `say phoenix` "I'm a permanent resident of the Midwest now. It's a medical condition."
9. `spawn aura sprite:aura_link 10 7`; `sfx feedback`; `say narrator` "They are made of the same stuff."; `despawn aura`.
10. `say lucky` "I want to make the loudest, most obnoxious noise possible until this whole empire gets a migraine."
11. `say phoenix` "Beats the day job."
12. `sfx drone_whine`; `spawn drone sprite:drone_map 21 2`; `move drone "LLLLLLLDDD" speed:run wait:true`; `say drone` "ASSET LOCATED. INITIATING RETRIEVAL. PLEASE HOLD FOR A REPRESENTATIVE."; `emote player !`.
13. `battle alley_drone onLose:gameover`; onWin: `despawn drone`; `spawn drone_wreck sprite:drone_wreck 14 8`; `party add phoenix` (her `onJoin` script equips Trash Bag + Hoodie); `set flags.metPhoenix, droneDefeated, phoenixJoined`.
14. `say phoenix` "Come on. I've got a bin you can sleep in."; `music snow`; **[EXT]** autosave to the active slot (`{"save":{"auto":true}}`; fallback: no autosave before City Sound). Phoenix trails the player from here.

### CS-05 `ep0_signal` (interact, bass amp) — Toon 2
1. `move phoenix` beside the amp (path computed from her position, `wait:true`); `say phoenix` "We need a drummer. I could put a flyer up at the coffee shop…"
2. `say lucky` "Too slow. I'm going to ask the universe."
3. `anim player lucky_channel wait:true`; `sprite player lucky_glow`; `sfx feedback` (rising, sustained).
4. `camera shake 1400 0.02`; `spawn wave sprite:soundwave 3 6`; `camera flash 80` ×3. **[EXT]** `camera bend 60` — the screen-border bend (Toon 2; fallback: `camera shake 600 0.03`).
5. `music signal`; **[EXT]** `camera mosaic 10` (pixelate out/in; fallback: fade); `teleport rooftops 0 7`; `camera pan x:512 y:112 ms:4000`; at 1800 ms (`wait 1800` after the pan starts; the pan is not waited) `sprite billboard_prod billboard_prod_glitch`, `sfx glitch`.
6. `teleport garage_north 8 7`; `camera fade in 600`; Ryan at the kit (`ryan` sheet, `sit` frame). `wait 1200`; `spawn wave2 sprite:soundwave 0 6`; `move wave2 "RRRRRRRRRRRRRRRR" speed:run wait:true`; `despawn wave2`; `anim ryan ryan_freeze wait:true` (sticks hover; eyes two white pixels).
7. `say ryan_caption` "[…]"; `wait 900`; `say ryan_caption` "[Huh.]"
8. `caption "END PART 1" 2000`; `set flags.signalSent`; `caption "ONE WEEK LATER" 1800`; `teleport apartment 3 7 facing:right`; `music apartment`; `set flags.weekLater, hubOpen`; `run ep0_week_later`.

### CS-06 `ep0_week_later`
1. Phoenix on the couch (`spawn`/`move` to (3,6), `anim phoenix idle_down`). `say phoenix` "Nobody came."
2. `say lucky` "The universe is slow."
3. `say phoenix` "The universe is a flyer at the coffee shop. I made one. Hard Luck Café. Corkboard. Go."; `give item:flyer_blank qty:1`.
4. Leaving the apartment for the first time after this (`street_cedar` trigger at the Towers door, once, `condition: flags.weekLater`): **[EXT]** autosave 2.

### CS-07 `ep0_flyer` (interact, corkboard; `condition: inventory.has('flyer_blank')`) — Toon 0
1. `say narrator` "A corkboard. Nine flyers for the same ska band."
2. `choice` ["DRUMMER WANTED — MUST PLAY FAST" → `set vars.flyerText 0` / "DRUMMER WANTED — NO COPS" → `set vars.flyerText 1` / "SEEKING RHYTHMIC VESSEL FOR COSMIC PURPOSE" → `set vars.flyerText 2`].
3. `take item:flyer_blank`; `sprite corkboard corkboard_flyer`; `set flags.flyerPosted`; `sfx item`.
4. `say barista` "Give it an hour. Or a day. Time's weird in here."

### CS-08 `ep0_brian_joins` (trigger at the café door; `flags.flyerPosted && !flags.brianJoined`) — Toon 0 → 1
1. `sfx chair`; `face brian toward:player`; `move brian` to the tile beside the player (`wait:true`); `emote brian !`.
2. `if vars.flyerText == 0`: `say brian portrait:brian_normal` "You the 'must play fast' people? I play at a very reasonable tempo." `if == 1`: "'No cops.' Love it. I'm in insurance." `else`: "'Rhythmic vessel'? I googled it. I think it's me."
3. `say brian` "I play guitar. I've got a $2,000 pedalboard and a completely normal amount of free time."
4. `say phoenix` "The flyer says drummer." `say brian` "I read it as 'band.'" `say lucky` "…Can you play loud?" `say brian portrait:brian_smug` "I can play *accurately*."
5. `say brian` "Also — do we really need all the political stickers? We're going to alienate the market." `say lucky` "Yes." `say brian` "Hey, man, can you turn the bass down?" `say phoenix portrait:phoenix_deadpan` "I'm not a 'man,' Brian. And no."
6. `party add brian` (toast "Brian joined the band. (Second.)"); `give item:gas_station_coffee qty:2` ("Brian buys a round. It is the last nice thing he does."); `set flags.brianJoined`.
7. `say brian` "You need a drummer. I know a guy. My cousin's roommate up north. Doesn't talk. Never misses." `anim brian brian_phone wait:false`.
8. **[EXT]** `camera mosaic 10`; `teleport garage_north 8 7`: Ryan exactly as left a week ago, sticks still hovering (`ryan_freeze` last frame). `sfx phone_ring` ×2 (the wall landline); `anim ryan ryan_unfreeze wait:true`; `move ryan "LLLLU" wait:true` to the phone; `face ryan up`.
9. `say brian portrait:brian_phone` "Ryan. It's Brian. From the Zappa cover band. I've got a thing." `say ryan` "Yep." `sfx click`.
10. `teleport coffee_shop 10 11`; `say brian` "He's in. City Sound, Room 4, tonight. Take the train."
11. `say lucky` "The universe came through." `say brian` "I called him." `say lucky` "The UNIVERSE." `say phoenix` "My brain thinks you're both right and that it doesn't matter."
12. `set flags.ryanCalled` (opens the rail exit); `music normal_music` resumes.

### CS-09 `ep0_ryan_arrives` (Room 3 proximity trigger, once) — Toon 0 → 1
1. `sfx door`; `spawn ryan sprite:ryan_loaded 1 6` (the impossible stack: a 16×40 sheet, or `ryan` plus a `hardware_stack` object moved in lockstep); `move ryan "RRRRRRRRRRRRRRRRRRR" wait:true` to (20,6).
2. `say phoenix` "My brain thinks that's structurally impossible." `say brian` "That's Ryan."
3. Bajonka sits at (20,7) with the clipboard (`bajonka` sheet, `clipboard_sit` frame). `face ryan down`; `anim ryan ryan_nod wait:true`; `wait 400`; `sfx sneeze`; `anim bajonka sneeze wait:true`.
4. `camera fade out 250`; `sprite bajonka bajonka` (clipboard gone, `idle_down`); `setEntity room4_door sprite:soundproof_door_open`; `despawn ryan`; `camera fade in 250`.
5. `say phoenix` "My brain has questions. My brain is choosing not to ask them."; `set flags.ryanArrived, hasBajonka`; **[EXT]** autosave 3 already happened on entering the hall; from this line Bajonka is a live `save` entity.

### CS-10 `ep0_room4_setup` (`room4.onFirstEnter`) — Toon 1
1. `music citysound`; `sprite player lucky_puddle`; `sprite phoenix phoenix_puddle` (relaxed, they melt).
2. `anim ryan ryan_tighten wait:false` (loops); `say narrator` "He does not stare at the alien slime monsters. He does not ask questions. He tightens a cymbal stand."
3. `say lucky` "You made good time from the transmission. You cool with playing fast?" `say ryan` "Yep."
4. `say brian` "{speed:fast}I called him." (Lucky's sprite does not turn.)
5. `say phoenix` "{color:gray}psst.{/color} My brain thinks we should have asked his rate first. We have exactly four dollars and a half-ounce of weed."
6. `sfx count_click` ×2; `run ep0_audition_start`.

### CS-11 `ep0_audition_start` — Toon 3
1. `sprite player lucky`; `anim player lucky_stomp wait:true`; `sfx pedal_stomp`.
2. `say lucky` "{shake}One, two, three, four!{/shake}"
3. `sfx drum_hit`; `camera flash 100`; `camera shake 1500 0.04`; **[EXT]** `camera tear 6` (panel tear: top half +6 px, bottom −6 px, 2 px gap, 6 frames; fallback: `camera shake`).
4. `spawn splat sprite:slime_splat 10 3`; `sprite ryan ryan_slimed_map`.
5. `music audition`; `battle ep0_audition onLose:gameover`; onWin: `run ep0_contract`.

### CS-12 `ep0_contract` — Toon 1
1. `music null`; `sfx cymbal` (2 s decay); `say narrator` "Slime drips off the ceiling. And the cymbals. And Ryan."
2. `say lucky` "Holy shit. You're a machine."
3. `say ryan_caption` "[I am literally a hostage.]"; `say ryan` "So, do I get the gig?"
4. `set vars.contractPages = 3 + vars.saveCount` (**[EXT]** arithmetic in `set`; fallback: `inc` from a base of 3 at each save); `spawn bajonka sprite:bajonka 12 3`; `move bajonka "DDL" wait:true`; `anim bajonka trot_drop wait:true`; `spawn contract sprite:contract 11 5`; `sfx thud`; `move bajonka "R" wait:true`; `anim bajonka idle_down`.
5. `say narrator` "Bajonka drops a {var:contractPages}-page, legally binding band agreement onto the snare, turns around, and sits down."
6. `party add ryan` (toast "Ryan joined the band. He is not available."); `give item:band_agreement`; `set flags.auditionDone, ryanJoined`; `save` (Bajonka's prompt reads "INITIAL HERE TO ACKNOWLEDGE RHYTHM SECTION").
7. `caption "ONE MONTH LATER" 1800 style:tape` (**[EXT]** caption style; fallback: plain caption); `set flags.monthLater`; `teleport room4 5 8` (same map, re-dressed by conditions: pedalboard and iced coffee in, contract out, drip in); `run ep0_month_later`.

### CS-13 `ep0_month_later` — Toon 0 → 2
1. `set flags.monthLaterRan`; `music normal_music` (the song played straight). Brian at the pedalboard (6,7), `anim brian brian_strum` (loop). Ryan at the kit, `anim ryan ryan_drum`.
2. `say brian` "Do we really need all the political stickers? We're going to alienate the market."
3. `face brian left`; `say brian` "Hey, man, can you turn the bass down?" `say phoenix portrait:phoenix_droop` "I'm not a 'man,' Brian. And no."
4. `say ryan_caption` "[I give this guy three weeks. Tops.]"
5. `say narrator` "Hit the chorus. Get the band to Toon 2."; `battle ep0_rehearsal` (cannot be lost; see Battle system); onWin: `run ep0_ultimatum`.

### CS-14 `ep0_ultimatum` — Toon 2 → 1 → 0
1. The battle's final hooks already showed the KRAAANG, the G, the spill and Brian's "I can't work like this!" line inside the battle. On the map: `sprite coffee_cup coffee_cup_spilled`; `sprite pedalboard pedalboard_fried`; `sfx sparks` ×3; `camera flash 60` ×2; `music null`; `set flags.pedalboardFried`.
2. `say brian portrait:brian_red` "I can't work like this! I hate this weird, creative shit! Can't we just play normal music?!"
3. `caption "ONE MONTH BEFORE THE POTATO BELT TOUR" 1800 style:tape`; `say phoenix` "My brain thinks that caption knows something we don't."
4. `move brian "LLRRLLRR" wait:true` (pacing); `say brian` "{shake}I'm not here to have fun.{/shake}" / `say brian` "{shake}I'm not into this creative shit. You people are wasting my time.{/shake}"
5. `sfx unplug`; `sprite player lucky_bristle`; `say narrator` "Lucky unplugs. The slime on their shoulders stands up like a cat's."
6. `anim phoenix phoenix_bass_mute wait:true`; `move phoenix "L" wait:true`.
7. `move player` to the tile facing Brian (`wait:true`); `face player toward:brian`; `say lucky portrait:lucky_calm_scary` "Listen to me very carefully, Brian."
8. `say lucky portrait:lucky_calm_scary` "You need to stop being an asshole, or you are fired."
9. `say lucky` "We clearly have some fundamental differences in how we think a band should work, but that's something we can discuss. What I can't do is work with an asshole, so whatever's going on at home or wherever, don't bring it to rehearsal."
10. `camera flash 80`; `spawn xray sprite:brain_xray 9 5` (`anim xray gears wait:true`: gears grind, spark, spin backward); `sfx gears`; `despawn xray`; `sprite brian brian_red`.
11. `say brian portrait:brian_stroke` "{shake}Did you just say my foundation is broken?! Are you calling my house crooked?!{/shake}"
12. `anim drip drip_freeze wait:true` (the ceiling drip stops mid-air); `wait 1200`.
13. `say phoenix portrait:phoenix_baffled` "My brain thinks you might be having a stroke."
14. `say lucky` "I literally didn't say anything about a house…" `say brian` "I know what you meant! My property values are fine! You're just jealous of my equity!"
15. `anim brian brian_stuff_cables wait:true`; `move brian` to the door `speed:run wait:true`; `sfx door_slam`; `camera shake 300 0.02`; **[EXT]** `camera tear 2` (2 px, 3 frames); `despawn brian`; `party remove brian`; `give item:fried_pedalboard` (toast "Got Fried Pedalboard. It is all he left.").
16. `wait 1500`; `say ryan_caption` "[Well. His timing was terrible anyway.]"
17. `sfx door` (creak); `spawn bajonka sprite:bajonka 4 11`; `move bajonka "UUUURRR" wait:true` to the mic stand; `anim bajonka trot_drop wait:true`; `spawn gig_flyer sprite:flyer_crumpled 7 7`; `sfx sneeze`; `move bajonka "LLLDDDD" wait:true`; `despawn bajonka`; `set flags.brianQuit`. `say phoenix` "My brain thinks she's making a point."

### CS-15 `ep0_gig_flyer` (interact, the crumpled flyer)
1. **[EXT]** `insert flyer_gig` (a centered window with the flyer sprite over a narrator line; fallback: narrator line only); `say narrator` "GIG TONIGHT: PALMER'S BAR — NO GUITAR SOLO NECESSARY."
2. `say lucky` "Palmer's. Isn't that—" `say phoenix` "Where I work. Yes. My brain thinks this is fine."
3. `despawn gig_flyer`; `give item:palmers_flyer`; `set flags.hasPalmersFlyer`. The rail now lands on `street_cedar` at night; Palmer's door opens.

### CS-16 `ep0_palmers_set` (stage trigger) — Toon 1
1. `set flags.onStage`; `move phoenix` to (21,9) and `move ryan` to (23,7) (`wait:true`); `sprite ryan ryan_slimed_map` ("already a menacing, bubbling mass"); `say narrator` "The stage is six inches off the floor. It is the tallest thing Lucky has ever stood on."
2. `camera pan` to the cop at (22,11) `ms:600`; `say cop portrait:cop_disguise` "{speed:slow}Dispatch, I have located the unauthorized slime gathering. Stand by."; `camera follow player`.
3. `face player up`; `emote ryan ♪`; `face player left`; `emote phoenix ♪`; `say narrator` "No Brian to ruin the mix."
4. `music palmers_set`; `battle ep0_palmers_set onLose:gameover`; onWin: `run ep0_aftermath`. (The first power chord, the mohawk, the shockwave and The Eternity all happen inside the battle; see Set pieces.)

### CS-17 `ep0_aftermath` — Toon 1 → 0
1. `teleport palmers_rubble 8 9`; `sfx cymbal` (long); ambient `wind`; `camera fade in 1500`; `say narrator` "The dust settles. The night sky is where the ceiling used to be."
2. `sprite player lucky_plaster`; `sprite phoenix phoenix_plaster`; `spawn ryan sprite:ryan_slimed_map 23 7 facing:down`; `anim ryan ryan_reform wait:true` (two intact sticks); `music rubble`.
3. `say lucky` "Okay. That is our sound." `say phoenix` "My brain thinks we are officially domestic terrorists."
4. `say ryan portrait:ryan_stoic` "I think I broke the space-time continuum on that snare fill."
5. `wait 1200`; `face ryan down`; `say ryan_caption shake:true` "[I could have killed every person in this room.]" (the caption window shakes 1 px for its whole duration — the only time it ever does); `face ryan up`.
6. `say ryan` "I quit."; `music null` (the song stops on the line and does not resume).
7. `sprite player lucky_rage`; `sfx slime_pop`; `camera shake 200 0.02`; `set flags.luckyRageLocked` (the window's inner rule turns magenta from here); `say lucky portrait:lucky_rage` "We just found it. We just FOUND it—"
8. `choice` [RAGE → `set vars.quitResponse 0`; `say lucky portrait:lucky_rage` "{shake}You don't get to be scared of the best thing you've ever done!{/shake}" / PLEAD → `set vars.quitResponse 1`; `sprite player lucky_deflated`; `say lucky portrait:lucky_deflated` "One more show. One. You don't even have to let go." / JOKE → `set vars.quitResponse 2`; `say lucky portrait:lucky_rage` "We'll put you on the flyer as a weather event."].
9. `say ryan` "Yep." (every branch); `move ryan "UUUUUU" wait:true`; `despawn ryan`; `party remove ryan`; `set flags.ryanQuit`.
10. `say phoenix` "My brain thinks he's scared." `sprite player lucky_rage` (PLEAD returns to rage here); `say lucky portrait:lucky_rage` "I don't care what he is."
11. **Stinger.** `sfx rubble`; `anim drywall drywall_lift wait:true`; `spawn bajonka sprite:bajonka 14 8` (`keys_sit` frame); `move bajonka "LLL" wait:true`; `give item:van_keys`; `give item:tour_itinerary`; **[EXT]** `insert itinerary` — "POTATO BELT: TOMORROW" circled in red (fallback: `say narrator` "A folded itinerary under her collar. POTATO BELT: TOMORROW, circled in red.").
12. `say lucky portrait:lucky_rage` "We don't have a drummer."; `sfx sneeze`.
13. `set flags.ch1Complete`; `caption "NEXT: THE POTATO BELT" 2200 style:flyer`; `caption "(DRUMMER WANTED)" 1600 style:flyer`; `save` (prompt "INITIAL HERE TO END CHAPTER 1"); `camera fade out 1000`; return to Title with CONTINUE enabled.

### Shop and save scripts
- `shop_cafe` (barista): `say barista` line → `shop cafe`.
- `shop_pawn` (pawn door on the hub): `say pawnbroker portrait:pawnbroker` "Cedar Pawn. I buy anything that isn't Vanguard. They track it." (second line after `brianQuit`: "A pedalboard that smells like oat milk? …Eleven dollars.") → `shop pawnshop`. Shop window object: "Under a tarp: a tin-can robot. NOT FOR SALE (YET)."
- `bajonka_save` (every `save` entity): `sfx sneeze` → `say narrator` "Bajonka holds out the clipboard." → the slot prompt (INITIAL HERE? Page 1 / Page 2 / Page 3 / Decline). Saving: `inc vars.saveCount`; toast "You initial page {var:saveCount}. Bajonka sneezes."; AMP restored to max for the party. Declining: `say narrator` "The clipboard does not move."

## Exploration & interaction

- **Movement.** Grid-locked 4-direction tile stepping with smooth interpolation (§12.3): walk 7 tiles/s, run 11 tiles/s (hold run). Sprites 16×24 with origin at the feet, y-sorted. Phoenix (and later Brian, Ryan) trail the leader as follower sprites one tile behind in the leader's trail; followers are never solid and never block.
- **Verbs.** Confirm = interact with the faced entity (NPC, `object` with a `script`, `save`). Cancel does nothing outside menus. Menu opens the pause menu. No separate "slap" verb: the speaker and EJECT are interact scripts.
- **Discoverables are unmarked.** The player learns to press on everything; NPCs face the player when adjacent. Objects return a narrator line; things a party member cares about return a second line on a second press (Phoenix on bills, tips, pull tabs; Lucky on anything Vanguard). Budget: ~40 object lines, ~35 NPC lines (all listed under Maps).
- **Encounters are visible and finite.** `behavior: chase` (sight 4–6), `wander`, `patrol` or `static` enemies on the map; touching one starts the count-in. `encounters.rate` is 0 everywhere. Defeated enemies set `flags.cleared_<id>` and stay gone; `monthLater`/night spawns two more. Touched from behind (the enemy's facing matches the player's), the enemy gets round 1 first in the SETLIST; head-on is normal initiative. No preemptive strikes. BAIL from a hub fight leaves the enemy on the map, `idle` for 3 s.
- **Lucky's color on the map** follows story flags only: `lucky` by default; `lucky_bristle` during CS-14; `lucky_rage` from `luckyRageLocked` on (permanent for the chapter); `lucky_deflated` only for the PLEAD walk; `lucky_plaster` in the rubble until the rage swap. Phoenix's `phoenix_puddle` frame is used in Room 4 when idle for more than 3 s, snapping back on movement with `slime_pop`.
- **Toon 2 objects on the map** (CRASH, KRAAANG's G, the xray, the splat) are ordinary `object` entities moved with `move`; no special system. Physical SFX words that are part of a scene persist afterward as solid deco (the alley CRASH lies against the fence; the Room 4 KRAAANG hangs on the back wall from `pedalboardFried` on).
- **Night** is a flag, not a map: `flags.hasPalmersFlyer` dresses `street_cedar` with a blue overlay rectangle at depth 50, lit-window objects, the night NPC roster and the night enemies.
- **Emotes** (`! ? … ♪ ♥ zzz`, 8×8 from the UI atlas) pop 4 px above the head with a 3-frame "boing" (frame 1 at y−2, frame 2 at y−5, frame 3 at y−4; no scaling).
- **Pause menu:** Items / Riffs / Equip / Status / Save. Save is grayed "Find the dog" unless adjacent to a `save` entity. Status shows Lucky's mood swatch.

## Battle system

Side-view, turn-based: FF4–6 presentation, Chrono Trigger techs, double techs and scripted events, Earthbound flavor. **Enemies on the left, party on the right** (see UI for pixel positions). Party of up to four in a diagonal column; 32×32 party sprites with feet at the slot's y. Every battle opens with the static-burst transition and a count-in; victory is the "SET BREAK" rewards strip.

### Round structure
1. **SETLIST.** Each round every living combatant rolls `init = effSPD + rng(0..3)`; order is init descending. Ties: party before enemies, then roster order (Lucky, Phoenix, Brian, Ryan), then enemy slot. `effSPD` = SPD × 1.5 (TEMPO UP) or × 0.5 (TEMPO DOWN), floored. The strip at the top shows the order as 8×8 icons, recomputed per round — no ATB.
2. On a party member's turn the command window opens (FF6 without the clock). AUTO allies (Ryan) and enemies use AI.
3. Statuses tick at round end; `onRound(n)` fires at the start of round n.
4. Win when every enemy is KO'd, fled or knocked off-panel, or a script emits `win`. Lose when every **controllable** member is KO'd — AUTO Ryan does not keep the party alive. Scripted exceptions are listed per battle.

### Stats and frequencies
HP, **AMP**, ATK, DEF, SPD, LCK; equipment adds flat. Every attack has a **frequency**: `PHYS` (trash bags, sticks, pecks, batons), `LOW` (bass), `HIGH` (guitar), `NOISE` (vocals, drums, SFX words). Enemies declare `weak` (×1.5) and `resist` (×0.5).

### Formulas (`formulas.js`)
Integer math; `rng(a..b)` is uniform inclusive from the model's seeded RNG.

```
hit%   = clamp(90 + (effSPD_att − effSPD_tgt) × 2 + accMod, 55, 100)
         accMod: riff modifier (Feedback Squeal −10), OUT OF TUNE −30; Brian with the Pedalboard: always 100
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
toonLevel = floor(meter / 25)                                   (0–4)
```

Sanity at L1: Lucky (ATK 7 + Beat-Up Guitar 3) STRUMs the Drone (DEF 3): raw 17 → 15–18; the Drone's 40 HP falls in round 2 once Phoenix joins. The Drone (ATK 6) hits Lucky (DEF 4) for 7–8 of 28 HP. Simulated hub fights (Lucky riffing, Phoenix strumming, no items): Slush Pile 2.0 rounds / 11 HP taken; Goose 2.2 / 15; Scooters 3.5 / 30; Analyst 3.2 / 29; Billboard 4.9 / 53; Analyst Duo 4.5 / 52. The party pool is 75 HP at L2 and 101 at L4, so a fight costs 15–30% of it: a Shared Aura or a Pizza Slice every second fight.

### Commands
Six in a 2×3 window: STRUM / RIFF / NOISE in the left column, ITEM / TUNE / BAIL in the right.

| Command | Effect |
|---|---|
| **STRUM** | Instrument attack, POW 100, the equipped instrument's frequency. On hit **+2 AMP**. Lucky's crits inflict SLIMED. |
| **RIFF** | Tech list: single riffs, then **SYNC** entries below a divider, grayed with a reason ("Phoenix already played" / "needs 5 AMP" / "Brian hates this"). |
| **NOISE** | Spend whole Toon Levels on SFX words. Uses the actor's turn and ATK. Grayed below Toon 1. |
| **ITEM** | Consumables (not key items). |
| **TUNE** | Defend: incoming halved until the actor's next turn, **+4 AMP**, cures own OUT OF TUNE. |
| **BAIL** | Flee roll (formula above). Grayed in scripted battles: "the dog has the contract". |

### Resources: HP and AMP
**AMP** is the band resource (the §6 save format already carries `amp`). It is headroom: a pool spent on riffs and refilled by playing, which gives the basic attack a job (STRUM +2, TUNE +4) instead of being a dead turn. AMP persists between battles and is restored to max by Bajonka saves, level-ups, Gas Station Coffee (+6), the Half-Ounce (all to max, BAKED) and story rests (the couch nap). Max AMP is 8–22 for Lucky across L1–8; riffs cost 2–8, so a fresh L3 Lucky has three riffs in the tank and must STRUM to earn the fourth. That loop is the feel of a fight.

### The TOON meter
One shared bar for the whole band, labeled **TOON** in the HUD: 0–100 in four 24-px segments; each full segment is a Toon Level (25 / 50 / 75 / 100). It is the only meter in the game; the band-fight thresholds (the AUDITION's tear, THE SET's Pocket form and The Eternity) are `onToon(level)` hooks on this same bar, not a second gauge.

| Fill event (party only; enemies never fill it) | Points |
|---|---|
| STRUM hit / crit | +4 / +8 |
| RIFF (damaging or not) | +6 |
| SYNC | +10 |
| A party member takes damage | +3 |
| Enemy KO | +5 |
| Possessed or Pocket Ryan acts (always on-beat) | +8 |
| Phoenix's My Brain Thinks | +5 |
| Band Sticker on the actor | +1 per action |
| **Brian in the party (Market Alignment)** | all gains halved, floored; the TOON label turns beige |

Spending is the **NOISE** command; each word costs whole levels (25 points each) and uses the actor's ATK.

| Word | Needs | Cost | Effect |
|---|---|---|---|
| **POP!** | Toon 1 | 25 | Single target, NOISE, POW 150; removes one enemy buff. |
| **KRAAANG** | Toon 2 | 50 | All enemies, NOISE, POW 180, 40% DAZED. The G swings like a bat: each 32-px enemy has a 25% chance to be **knocked off-panel** (removed; no XP, no $). |
| **KRATHOOM** | Toon 3 | 75 | All enemies, NOISE, POW 260, ignores DEF; the actor gains BRISTLING (2). Window frames jitter ±2 px for the rest of the battle. |
| DOOM / CRACK / THUD | Toon 4 | — | Listed grayed as "???". Scripted only: The Eternity. |

Toon Level also gives crit +3% and party damage +5% per level and drives the background (0–1 static, 2 scrolling, 3 sine-warped with a torn HUD, 4 palette-cycled rupture). **The player's meter caps at 99**; only `BattleScripts` sets 100.

**Carryover:** `floor(meter / 2)` between battles (`GameState.meter`), so chaining hub fights lets the third open with a KRAAANG; reset to 0 on any caption card, on load and on map change into a new scene. Simulated: a hub fight ends at Toon 26–40, a multi-enemy one at 58–70. Scripted starts: AUDITION 0, The Chorus 0, THE SET 25.

### Slime Sync (double techs)
Listed under RIFF below a divider. Conditions: both partners alive and not DEAF, each pays their AMP cost, and the partner **has not acted yet this round**: the Sync fires on the initiator's turn and consumes the partner's turn (its SETLIST icon is crossed out). Only slime can Sync; Brian never; Ryan only through script.

| Sync | Pair / unlock | AMP each | Effect |
|---|---|---|---|
| **Shared Aura** | Lucky + Phoenix, from the tutorial | 4 | Both heal 25% max HP, statuses cured, +10 Toon. |
| **Low-End Theory** | both L3 | 5 | All enemies, POW 160, counts as LOW and HIGH (uses the better multiplier), 50% TEMPO DOWN. |
| **Wall of Sound** | both L5 | 8 | All enemies, NOISE, POW 220, +15 Toon. |
| **Pocket** | Lucky + Ryan, THE SET only | — | Ryan's AI casts it at Toon ≥ 50 (consumes Lucky's turn if she has not acted): all enemies, NOISE, POW 200, +12 Toon. |

### Status effects
Durations in rounds; reapplying refreshes; TEMPO UP and TEMPO DOWN cancel each other.

| Status | Effect | Dur. | Cure / immunity |
|---|---|---|---|
| **DAZED** | Skips its next turn. | 1 | Slime Sunglasses immune; Deadpan cures |
| **DEAF** | No RIFF, SYNC or NOISE. | 3 | Hand Warmer, Shared Aura; Earplugs immune |
| **OUT OF TUNE** | hit −30. | 3 | TUNE, Shared Aura |
| **TEMPO DOWN / UP** | SPD × 0.5 / × 1.5. | 3 | Hand Warmer cures DOWN |
| **BRISTLING** | ATK +50%, DEF −25%; Lucky's battle sheet swaps to `lucky_battle_rage`. | 3 | — |
| **SLIMED** (enemies) | DEF −3; ×1.25 from LOW and HIGH. | 4 | — |
| **BAKED** (Half-Ounce) | SPD −3, DEF +3. | 3 | — |
| **ON HOLD** (cop) | Countdown to backup. | 2 | scripted |
| **TUNING** | Incoming halved (TUNE). | until next turn | — |
| **KO** | Out. Lucky's `ko` frame is a puddle. | — | Tater Tot Hotdish |

Status icons (8×8, UI atlas): `icon_dazed`, `icon_deaf`, `icon_outoftune`, `icon_tempo_down`, `icon_tempo_up`, `icon_bristling`, `icon_slimed`, `icon_baked`, `icon_onhold`, `icon_ko`.

### Enemy AI format
Each enemy has an `ai` list in `enemies.json`; rows whose `if` holds (the §5.3 evaluator plus `hp`, `hpPct`, `round`, `allies`, `toon`, `partyHas('status')`) are chosen weighted-random. Targeting: `random`, `lowestHp`, `highestAtk`, `notRyan`, `self`, `all`.

```jsonc
"ai": [
  { "if": "round == 1",                "do": "hiss", "target": "random",   "weight": 6 },
  { "if": "hpPct < 30 && allies == 0", "do": "flee",                       "weight": 3 },
  { "do": "peck", "target": "lowestHp", "weight": 4 }
]
```

Three archetypes: **Brute** (two attacks, one with a status), **Caller** (timers: ON HOLD, Dental Plan), **Swarm** (a group riff only while three scooters live). Enemies never heal above 50%, never target KO'd characters; `notRyan` makes the cops hit people who can lose. Possessed/Pocket Ryan uses the same `ai` format with his own move weights.

### Lucky's color in battle
Palette-variant sheet swaps driven by events: BRISTLING → `lucky_battle_rage`; HP < 25% → `lucky_battle_deflated`; KO → `lucky_battle_bruised` (the puddle); landing a crit → the `g` glow swapped to white for 6 frames (a baked `_flare` variant). The tutorial teaches it: Phoenix's toast after the first hit Lucky takes reads "Your color's doing a thing."

### Scripted battles, hook by hook
Keyed by encounter id in `BattleScripts.js` using the §8 hooks plus the extensions in *Engine extensions required*. Hooks return presentation events.

**B-1 `alley_drone` — tutorial.** Vanguard Retrieval Drone vs. Lucky alone. Not `noFlee`, but BAIL is grayed "Not yet." Toon 0.
- `onStart`: text "A Vanguard Retrieval Drone followed the pod."; toast "STRUM to attack. Hits put AMP in the tank."; only STRUM and TUNE lit in round 1.
- `onRound(2)`: `join` Phoenix (walks in from the right, trash bag); text "Beats the day job."; toast "RIFF spends AMP. Power Chord costs 3. Shared Aura is a SYNC."; all commands lit.
- `onHpBelow(drone, 50)`: text "RETRIEVAL TARGET IS NONCOMPLIANT."; toast "The TOON meter is filling. At 25 you can make NOISE."
- `onDefeat(drone)`: text "It leaves a $2 severance check." Reward 8 XP, $2.
- Tuning: Lucky L1 alone survives round 1 at 20–21/28 HP; the fight ends round 2–3.

**B-9 `ep0_audition` — AUDITION.** WHRNNNG (64 px) and THUD-THUD (48 px) vs. Lucky, Phoenix, Brian, Ryan (`auto`, `minHp 1` — "the goo won't let him fall"). `noFlee`, Toon 0. Losable (all three controllables KO'd → Game Over).
- `onStart`: text "One, two, three, four!" → `anim ryan drum` → `transform ryan → ryan_slimed` → `camera.shake 600` → `uiTear 1` (the HUD sits 3 px off for the whole fight) → `caption` "[Well. I guess my arms belong to the goo now.]". Ryan is Possessed: friendly fire possible, +8 Toon per action.
- `onRound(3)`: `caption` "[Tempo's good, though. Very steady.]"
- `onRound(5)`: `caption` "[Ride cymbal sounds a bit tinny. Should probably buy a new one if I survive this.]"
- `onRound(7)`: text "The song crashes to a halt." → `win`; earlier if both walls fall.
- Tuning (simulated at L3–4): the walls last 5.4–5.8 rounds and reach the timer 46–79% of the time; damage taken without healing is 87 of a 131-HP pool at L4 and 116 of 118 at L3, so the fight expects one Shared Aura or a Pizza Slice. Brian usually goes down, which is fine and funny. At L2 (the rushed case) it expects the fridge Hotdish; a L2 party with no items wipes ~21% of the time, acceptable for a first boss.
- Reward: 50 XP fixed, $0, Tinny Ride Cymbal (key item).

**B-10 `ep0_rehearsal` — The Chorus.** One enemy, The Chorus (a pulsing speech balloon, HP 400, `minHp 1`: "The chorus repeats."). Party: Lucky, Phoenix, Brian, Ryan (`auto`, Possessed). `noFlee`, Toon 0. **Cannot be lost:** with Brian halving gains Toon 2 arrives around round 5 and the player feels the drag; if all controllables are KO'd, or at `onRound(8)`, the forced KRAAANG fires.
- `onStart`: toast "Hit the chorus. Get to Toon 2."
- `onAction` = NOISE KRAAANG by anyone, or `onRound(8)` (text "Lucky and Phoenix's slime links up on its own." then a forced KRAAANG), or all controllables KO'd (same text): `anim word_kraaang swing` → `damage brian 1` (text "The G knocks over Brian's boutique iced coffee.") → `transform brian → brian_fried` → `status brian OUT OF TUNE` → text "Sparks." → `win`.
- Reward 30 XP fixed, $0. CS-14 continues on the map.

**B-11 `ep0_palmers_set` — THE SET.** Undercover Cop vs. Lucky, Phoenix, Ryan (`auto`, Pocket form: no friendly fire, Pocket Sync). `noFlee`, Toon starts at 25. Losable until `eternityArmed`.
- `onStart`: text "Dispatch, I have located the unauthorized slime gathering. Stand by." → `status cop ON HOLD (2)`.
- `onAction` (first party STRUM or SYNC): text "The first power chord blows the front row's hair back." → `anim cop mohawk_off` → text "It lands in a stranger's beer. The stranger says 'whoa, man.'" → `caption` "[No obnoxious guitar solos. Just pure, unadulterated rhythm. The slime is pulsating in 7/8 time. I can work with this.]"
- `onRound(3)`: `spawn` Backup Cop ×2; text "Backup. Also in leather jackets. Also with price tags."
- `onDefeat(any cop)` → `flee` (text "…crawls toward the exit"). Cops never die; no XP from them.
- `onToon(3)` or `onRound(6)`, whichever first: `caption` "[I've been fighting the possession. That was a mistake.]" → `transform ryan → ryan_pocket_purple` → `uiTear 2` → `lockInput on` → flag `eternityArmed` (the fight can no longer be lost: party damage is still shown but HP floors at 1).
- Ryan's next turn: **THE ETERNITY** (frame-by-frame under Set pieces). `meter 100` → `transform ryan → ryan_eternity` (64 px, overlapping the stage) → `caption` "[I am not trapped in the goo. The goo is trapped in the pocket.]" → `music eternity` → three words 900 ms apart: **DOOM** (`damage` all enemies 999), **CRACK** (`background palmers_roof_peel`; text "The roof of Palmer's Bar peels back exactly like a sardine can."), **THUD** (`camera.shake 1200`; text "The walls blow outward."; `caption` "[Rhythm achieved.]") → `win`.
- Tuning (simulated, no items or TUNE): The Eternity fires on round 5; a L4 Lucky ends at 2 of 46 HP, L5 at 15 of 52, L6 at 26 of 58. One Shared Aura makes any of those comfortable; a L4 party is meant to sweat. If still too hard, Backup Cop ATK 8 → 7.
- Reward 100 XP fixed, $0 ("Nobody pays you after you level the bar"), the cop's Price-Tag Leather Jacket.

**Loss handling.** `onLose: gameover` on every scripted battle that can be lost (B-1, B-9, B-11 before arming). Game Over → "CONTINUE FROM LAST INITIALED PAGE?" → Title with Continue, loading the most recent slot (an autosave before City Sound, a Bajonka save after). The Chorus has no loss state.

## Party & progression

### Characters
**Lucky** — laser guitar (HIGH), vocals (NOISE). Glass cannon, best crit, best Toon synergy. Permanent.
**Phoenix** — bass (LOW); trash bag (PHYS) until the apartment. Tank and analyst: highest DEF, the scan riff, the only Sync partner in the slice. Permanent.
**Brian** — guitar (HIGH), temporary, fixed L3, coffee shop → ultimatum. His kit is a sabotage (below). Never levels.
**Ryan** — drums (NOISE/PHYS), temporary, fixed L4, audition → rubble, **never controlled** (`auto`). Forms: `ryan` (human, map), `ryan_slimed` (Possessed, AUDITION and The Chorus: friendly fire, `minHp 1`, +8 Toon per action, square captions), `ryan_pocket_purple` (Pocket, THE SET: no friendly fire, Pocket Sync), `ryan_eternity` (64 px, scripted finisher).
**Bajonka** — never in the party; the save point from City Sound on.

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

Growth per level: Lucky HP +6, AMP +2, ATK +2, DEF +1, SPD +1, LCK +1; Phoenix HP +7, AMP +2, ATK +1 (+2 on odd levels), DEF +2, SPD +1, LCK +1. **Brian (fixed L3): 30 / 6 / 8 / 5 / 9 / 0. Ryan (fixed L4): 40 / 12 / 10 / 6 / 11 / 5.** Level-up restores HP and AMP to the new maxima; maxima are read from the table, never accumulated. `characters.json` stores the L1 stats and the growth; the table above is the acceptance test.

### XP table
Everyone in the active party gets full XP (Chrono Trigger, no split); temp members sit at their fixed level and ignore XP. Max level in the slice is 8; the table continues past it in data (`+90`, `+105`, … for later chapters) but nothing in Chapter 1 reaches it.

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Cumulative XP | 0 | 10 | 24 | 48 | 85 | 135 | 200 | 275 |

Budget: critical path = drone 8 + the two chokepoint hub fights (Slush 8 + Scooters 10) 18 + AUDITION 50 + Chorus 30 + THE SET 100 = **206 → L4 at the audition, L5 at Palmer's, L7 at the end**. Everything optional adds Goose 9 + Analyst 16 + Billboard 30 + Analyst Duo 32 + Goose Pair 18 = 105 → **311 → L8**.

### Riffs learned

| Who | L | Riff | AMP | Freq | POW | Effect |
|---|---|---|---|---|---|---|
| Lucky | 1 | Power Chord | 3 | HIGH | 140 | Single. |
| Lucky | 2 | Feedback Squeal | 4 | NOISE | 70 | All, acc −10, 50% DEAF. |
| Lucky | 3 | Pseudopod Slap | 3 | PHYS | 110 | Single, 60% DAZED. |
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
| Brian | — | Normal Music | 0 | — | — | Toon to 0; heals Brian 50%. |
| Ryan Possessed | — | Blast Beat | — | NOISE | 130 | All enemies. Weight 4. |
| Ryan Possessed | — | Fill | — | PHYS | 140 | Random target; 20% a party member. Weight 3. |
| Ryan Possessed | — | Tinny Ride | — | NOISE | 90 | Single, 50% DEAF. Weight 2. |
| Ryan Pocket | — | Seven-Eight | — | NOISE | 150 | All enemies. Weight 4. |
| Ryan Pocket | — | Kick | — | PHYS | 160 | Highest-ATK enemy. Weight 3. |
| Ryan Pocket | — | Pocket | — | NOISE | 200 | Sync with Lucky at Toon ≥ 50. Weight 5. |

Syncs (Shared Aura, Low-End Theory, Wall of Sound, Pocket) are in `riffs.json` with `"sync": ["lucky","phoenix"]`; NOISE words (POP!, KRAAANG, KRATHOOM, DOOM, CRACK, THUD) are in the same file with `"toonCost"`. Total 24 riff entries.

### Brian, the deliberately bad temp member
- **$2,000 Pedalboard** (locked accessory): hit 100, crit 0.
- **Market Alignment**: Toon gains halved while he is in the party; the TOON label turns beige.
- **Buzzkill**: 20% per round (never round 1) he ignores the command and complains, losing the turn. Six lines rotate: "Can we turn the bass down?", "Do we really need the stickers?", "Is this in a weird time signature?", "My coffee's getting warm.", "Can we play something people know?", "I've got a thing at nine."
- No SYNC, no NOISE ("Brian hates this"). Tube Screamer is his one big hit and self-sabotages 30% of the time.
- The upside, so the loss registers a little: Sterile Chord never misses (it matters against SPD-10 scooters) and he is the fastest member until Ryan. He leaves the **Fried Pedalboard**: sell it for $11 or wear it (ATK +4, 15% self OUT OF TUNE per RIFF). That choice is all he leaves behind.

### Ryan's forms
| Form | Sheet (battle) | When | Rules |
|---|---|---|---|
| Human | `ryan` (map only) | hallway, Room 4 setup, garage | Not in battle. |
| Possessed | `ryan_slimed` 32×32 | AUDITION, The Chorus | `auto`, `minHp 1`, friendly fire (Fill 20%), +8 Toon per action, square captions. |
| Pocket | `ryan_pocket_purple` 32×32 | THE SET from the start; palette darkens at `eternityArmed` | `auto`, no friendly fire, Pocket Sync with Lucky at Toon ≥ 50. |
| The Eternity | `ryan_eternity` 64×64 | THE SET finisher | Scripted only; DOOM / CRACK / THUD; input locked. |

## Enemies & bosses

| id | Enemy | px | HP | ATK | DEF | SPD | XP | $ | Weak / resist | Flavor (Phoenix's scan) |
|---|---|---|---|---|---|---|---|---|---|---|
| `drone` | Vanguard Retrieval Drone | 32 | 40 | 6 | 3 | 6 | 8 | 2 | NOISE / — | "My brain thinks it's here to offer you a dental plan." |
| `slush` | Slush Pile | 32 | 80 | 9 | 4 | 3 | 8 | 3 | HIGH / PHYS | "My brain thinks it's mostly road salt and regret." |
| `goose` | Canada Goose | 32 | 70 | 10 | 4 | 9 | 9 | 4 | LOW / — | "My brain thinks it has a lawyer." |
| `scooter` ×3 | Feral Scooter | 32 | 36 | 8 | 5 | 10 | 10 total | 6 total | PHYS / NOISE | "My brain thinks someone left these unlocked on purpose." |
| `analyst` | Demographic Analyst | 48 | 130 | 11 | 7 | 7 | 16 | 8 | NOISE / HIGH | "My brain thinks it has already segmented us." |
| `billboard` | WORK IS LOVE Billboard (opt.) | 64 | 240 | 12 | 9 | 2 | 30 | 12 | NOISE ×2 / PHYS, LOW | "My brain thinks it's humming in a key that doesn't exist." |
| `analyst` ×2 | Analyst Duo (night) | 48 | 130 | 11 | 7 | 7 | 16 ea | 8 ea | NOISE / HIGH | "My brain thinks they bill in fifteen-minute increments." |
| `goose` ×2 | Goose Pair (night) | 32 | 70 | 10 | 4 | 9 | 9 ea | 4 ea | LOW / — | "My brain thinks they're married." |
| `whrnnng` | WHRNNNG (AUDITION) | 64 | 280 | 8 | 5 | 8 | — | — | LOW / NOISE | "My brain thinks it's the guitar's fault." |
| `thud_thud` | THUD-THUD (AUDITION) | 48 | 220 | 11 | 4 | 12 | — | — | HIGH / NOISE | "My brain thinks it's the drummer's fault." |
| `chorus` | The Chorus (rehearsal) | 48 | 400 | 5 | 5 | 5 | — | — | — | "My brain thinks it's catchy. Brian hates it." |
| `cop` | Undercover Cop | 48 | 400 | 11 | 10 | 8 | — | — | — / PHYS | "My brain thinks the price tag is still on." |
| `backup_cop` ×2 | Backup Cop | 32 | 110 | 8 | 7 | 7 | — | — | NOISE / PHYS | "My brain thinks they carpooled." |

Thirteen entries in `enemies.json` (the duos reuse `analyst` and `goose` with their own scan line via the encounter). Scripted encounters pay fixed XP: AUDITION 50, Chorus 30, THE SET 100.

**Move lists and AI.**
- **Drone** (Brute): Taser Prod (PHYS 100) round 1, then 50/50 with Retrieval Beam (PHYS 80, 30% TEMPO DOWN). Flavor: a beige egg with a tie decal and a claw; hovers, bobs 1 px.
- **Slush Pile** (Brute): Splash (PHYS 100); Freeze (NOISE 60 all, 30% TEMPO DOWN) when `round % 3 == 0`. A gray-brown heap with a parking ticket stuck in it.
- **Goose** (Brute): Hiss (NOISE 60, 30% DAZED) round 1; Peck (PHYS 110, lowestHp); flees below 30% if alone.
- **Scooter** (Swarm): Zip (PHYS 90); Swarm (PHYS 60 all) only while 3 alive, weight 5. Nobody is riding it; 15 mph in the snow.
- **Analyst** (Caller): Pick a Demographic (NOISE 80, 50% OUT OF TUNE) weight 4, Dental Plan (self heal 20, only below 50%) 3, Onboarding (TEMPO DOWN 40% all) 2. Khaki, lanyard, clipboard, dead eyes; the duo are drawn identically.
- **Billboard** (static mini-boss): Slogan (NOISE 70 all) every round; every 3rd round Glitch (self DAZED — the window; the sign reads WORK IS L0VE).
- **WHRNNNG**: Sustain (NOISE 60 all) every turn. Jagged pink letters stacked as a wall; vibrates 1 px.
- **THUD-THUD**: Downbeat (PHYS 110 random); Double (two hits at 60) every 2nd round. Heavy green square letters; stomps.
- **The Chorus**: Hook (PHYS 40), Earworm (20% DEAF). A pulsing speech balloon that reads "la la la".
- **Undercover Cop**: Baton (PHYS 100), Pepper Spray (NOISE 60 all, 40% OUT OF TUNE), Hello Fellow Kids (self TEMPO UP, once; "He tries to blend in."); all `notRyan`. Pristine leather jacket, tag dangling, mohawk one shade too neon; talks into his collar.
- **Backup Cop**: Baton (PHYS 100), Cuff (40% DAZED); `notRyan`. Navy "POLICE" windbreaker and khakis at a punk show.

In one line each: the tutorial teaches STRUM, RIFF, AMP and the meter; AUDITION is survive-the-song while a machine does the killing; The Chorus is a pacing scene with a button prompt; THE SET is a real two-to-four-round fight that ends in a finisher the player watches.

## Items, equipment, shops

Start: **$4**, Half-Ounce (×4), Beat-Up Guitar equipped, Spiky Slime Sunglasses (given on landing, after the freefall). Phoenix joins with the Trash Bag and the Hoodie; her Beat-Up Bass is on the stand in the apartment.

| Consumable | $ | Effect | Where |
|---|---|---|---|
| Pizza Slice | 3 | Heal 20 HP. | Café; dumpster, Pizza Luce box, fridge (one each) |
| Gas Station Coffee | 4 | +6 AMP. | Café; Brian gives 2 on joining |
| Hand Warmer | 5 | Cure DEAF and TEMPO DOWN, heal 8. | Café; pawn after the skip |
| Tater Tot Hotdish | 15 | Revive at 50% HP. | Fridge (1); café after the skip |
| Half-Ounce (×4) | pawn pays $20 for the lot | "Session": party AMP to max, BAKED 3. Usable on the map. | Start |
| Fried Pedalboard | pawn pays $11 | Key item / accessory (ATK +4, 15% self OUT OF TUNE per RIFF). | Brian leaves it |

Key items (never sold, never used from the menu): Flyer (blank, until posted), Band Agreement ("{n} pages"), Tinny Ride Cymbal, Palmer's Flyer, Van Keys, Tour Itinerary.

| Equipment | Slot | Who | Stats | $ | Where |
|---|---|---|---|---|---|
| Beat-Up Guitar | instrument | Lucky | ATK +3, HIGH | — | start |
| Thrift Telecaster | instrument | Lucky | ATK +6, LCK +2, HIGH | 26 | pawn |
| Trash Bag | instrument | Phoenix | ATK +2, PHYS, 10% SLIMED | — | alley |
| Beat-Up Bass | instrument | Phoenix | ATK +4, LOW | — | apartment |
| P-Bass Copy | instrument | Phoenix | ATK +7, DEF +1, LOW | 24 | pawn (after the skip) |
| Brian's Strat / Drumsticks | instrument | Brian / Ryan | ATK +5 HIGH / ATK +3 PHYS; locked | — | fixed |
| Spiky Slime Sunglasses | accessory | Lucky | LCK +2, immune DAZED | — | freefall |
| Hoodie | accessory | Phoenix | DEF +1 | — | start |
| Earplugs | accessory | any | immune DEAF | 10 | pawn |
| Band Sticker | accessory | any | +1 Toon per action | 6 | pawn |
| Price-Tag Leather Jacket | accessory | any | DEF +4; sells $20 | — | cop drop |
| $2,000 Pedalboard / Flannel | accessory | Brian / Ryan | hit 100 crit 0 / DEF +3; locked | — | fixed |

**Shops (`shops.json`).** `cafe` (barista): Pizza Slice, Gas Station Coffee, Hand Warmer; Tater Tot Hotdish after `monthLater`. `pawnshop` (pawn door): Thrift Telecaster, Earplugs, Band Sticker; after `monthLater` also P-Bass Copy and Hand Warmer. Buys the Fried Pedalboard $11, the Half-Ounce $20, the Jacket $20, anything else at half price; refuses key items.

**Money budget.** $4 + couch cushions $2 (one-time apartment find) + drone $2 + day hub $21 + Billboard $12 + night hub $24 + pedalboard $11 + weed $20 = **$96 maximum**; a typical full-clear has ~$45 by the month skip — one instrument and a few items. Selling the weed for a bass is the slice's one economic choice; Phoenix comments at Palmer's either way ("We sold the weed for this." / "We kept the weed for this."). Nothing in the slice costs more than $26; the $40 cymbal from the levels proposal is cut (the ride cymbal is a key item gag instead).
