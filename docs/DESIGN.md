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
coffee_shop  corkboard ─▶ flyerPosted (vars.flyerText 0..2) ─▶ brianJoined ─[garage call]─▶ ryanCalled (City Sound door ON)  (autosave 2b at the end of CS-08)
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
| `pod_bay` | Vanguard drop-pod bay | 16×14 | `vanguard` | `dental_plan` | EJECT → `FreefallScene` → `alley` | — |
| (scene) | Freefall over Minneapolis | — | procedural | `flying_squirrel` | → `alley` (9,8) | — |
| `alley` | Alley behind Palmer's | 24×14 | `minneapolis` | `pothole` | W edge → `street_cedar` (38,12) (after `phoenixJoined`) | — (cameo) |
| `street_cedar` | Cedar Ave, West Bank (hub, day/night) | 40×24 | `minneapolis` | `west_bank` (hub open) / `snow` (first pass, night) | E edge → `alley` (1,9); doors → `apartment`, `coffee_shop`, `palmers`; pawn door → shop script; rail → `city_sound_hall` (2,6) | night: outside Palmer's |
| `apartment` | Phoenix's apartment | 16×14 | `interiors` | `unpaid_bills` | door (12,13) → street (12,9) | — (cameo) |
| `coffee_shop` | Hard Luck Café | 20×14 | `interiors` | `normal_music` | door (10,13) → street (20,9) | — |
| `rooftops` | Signal montage strip | 48×14 | `minneapolis` + `pines` | `ask_the_universe` | cutscene only | — |
| `garage_north` | Ryan's garage | 16×14 | `pines` | `northern_garage` | cutscene only | — |
| `city_sound_hall` | City Sound, hallway | 28×14 | `interiors` | `sticker_hallway` | stairs (2,6) → rail → street (21,15); Room 4 door (20,5) → `room4` (3,10) | outside Room 4 (20,7) |
| `room4` | City Sound, Room 4 | 16×14 | `interiors` | per scene | door (3,10) → hall (20,7); gated during cutscenes | via CS-12 `save` |
| `palmers` | Palmer's Bar | 26×14 | `interiors` | `six_inch_stage` | door (8,13) → street (8,9); closed once on stage | — (Bajonka outside, on the hub) |
| `palmers_rubble` | Palmer's, leveled | 26×14 | `interiors` (rubble tiles) | none, `wind` | none; chapter ends | end of chapter |

Twelve maps including the scene. Every map lists `"encounters": { "rate": 0, "pool": [] }`.

### `pod_bay` — 16×14
**Layout.** Steel floor, catwalk along the top row, three drop pods along the bottom (pod 2 open at (7,11), Lucky inside). Intercom speaker 2×2 on the north wall at (7,2). Viewport (12,2) onto Planet California, a planet made of billboards (`window_stars` animated tile). Vending machine (2,3), plaque (4,2). Pod 3 nameplate (11,11). **Spawn** (7,11) facing up. Lucky uses the `lucky_ball` 16×16 sheet here (CS-01 swaps it in; rolls; 2-frame squish idle) until the crash puts the `lucky` sheet back.
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

### `city_sound_hall` — 28×14
**Layout.** The hall is rows 3–8; rows 0–2 and 9–13 are solid `dark` tiles so the 16×14 viewport never shows the bare canvas. A two-tile corridor (rows 6–7) from the stairs (2,6) east to a dead end at x 27; Rooms 1–6 along the north wall (doors at x 8, 12, 16, 20, 24, 26; Room 4 at (20,5)); night-manager desk (5,4); vending (8,4); bulletin board (12,4); bathroom door (26,5). Plaster walls under a gray cornice (`wall_plaster_top` row 3); the four dark `sticker_wall_a..d` tiles cluster on the door frames (flanks and the tile above each soundproof door, Room 4 heaviest), `sticker_wall_sparse_a/b` stragglers sit between them and along the south wall, two show posters hang above Rooms 2 and 6 — about a third of the wall tiles carry stickers, so the NPCs read against the wall. Bajonka outside Room 4 at (20,7) — the canonical clipboard pose, `type: save`, `condition: flags.hasBajonka`. **Spawn** (2,7) facing right.
**NPCs.** Night Manager (5,5): "Room 4. Cash only. Don't put stickers on the stickers." Ska Band ×3 loading out at (10..12,7): "Ska's coming back." / "It never came." / "Checkmate." Noise Guy in Room 2's doorway (12,6): "I'm the only member. I'm also the audience. Reviews are mixed."
**Interactables.** Board: "BASSIST WANTED (NOT YOU, GREG)." / "DRUMMER AVAILABLE: 13/8 ONLY." / "LOST: CLIPBOARD. IF FOUND, YOU HAVE ALREADY SIGNED." Vending: "Everything is $1.25. Everything is sold out." Other doors: one muffled line each ("Room 1 is practicing one chord. It is getting better.").
**Triggers.** Room 3 proximity (16..18,6..7) `once` → CS-09. Room 4 door exit `condition: flags.ryanArrived`. **Enemies:** none.

### `room4` — 16×14
**Layout.** The room is cols 0–13 × rows 0–10, padded right and below with solid `dark` tiles to fill the viewport (nothing moved). Door (3,10). Kit NE (10..12,2..4) as a 32×32 object plus a cymbal tile. Lucky's stickered amp (2,5); Phoenix's amp (2,7); mic stand (7,6); the Puddle Couch (11..13,9); mini-fridge (13,6); a wall of band tallies north. Walls: the sticker band is the top row only; below it plaster with a two-tile sticker drip hanging off the band, the tallies and posters, a dark sticker cluster around the door and a few sparse stragglers. Conditional dressing: Brian's pedalboard (6,8) and iced coffee (8,8) while `monthLater && !brianQuit` (both only exist inside CS-13/CS-14, and the pedalboard leaves with Brian as the `fried_pedalboard` item); the contract on the snare during CS-12; a ceiling-drip object (11,1) after `auditionDone` (the freeze gag; the RAT FIGHT poster keeps (10,1)). **Spawn** (4,9) facing right.
**Interactables.** Lucky's amp: "Forty-one stickers. Nine are political. Brian counted." Kit: "The size of a sedan. The ride cymbal is tinny. Don't tell him." Fridge: "Nobody has ever opened it." Tallies: "RAT FIGHT WAS HERE. (They toured?)" / "THE DENIM BOYS: ROOM 4 FOREVER (crossed out: NOW ROOM 2)." Iced coffee: "Boutique. Nine dollars. It has a name. The name is Brian." Pedalboard: "$2,000 of pristine, never-stepped-on tone."
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
1. `sprite player lucky_ball` (the rolled-up drop form); `music dental_plan`; `camera fade in 600`.
2. `say dad portrait:dad_grille` "I just don't understand the whole nonbinary thing."
3. `say dad` "Why can't you pick a tangible demographic to market yourself to?"
4. `say dad` "If you'd just join The Vanguard, you could be financially successful and oppress people with a dental plan!"
5. `emote player …`; `set flags.podIntro`.

Floor-band triggers `ep0_dad_1..4` (once each; `condition: !flags.podSpeakerSlapped`): `say dad` "Your mother and I paid for the compression. The least you could do is market yourself." / "There's an opening in Demographic Alignment. You'd report to me." / "Billy's parents say Billy 'found themself.' In a storage unit." / "…I can see the speaker light." Twins with `condition: flags.podSpeakerSlapped`: `say dad` "{speed:slow}mmf. mmmf."

### CS-02 `ep0_speaker` (interact, speaker) — Toon 3
1. `sprite player lucky_ball` (a no-op after CS-01; keeps a warp honest); `face player up`; `anim player lucky_ball_pseudopod wait:true`; `sfx squelch`; `sprite speaker speaker_slimed`; `face player up` (the arm stays on the grille, Lucky is a ball again).
2. **[EXT]** `ui.collapse` — the FF-gradient Dad window collapses vertically 56→0 px in 4 frames mid-sentence (fallback: a normal page end). Implemented as `say dad "{speed:slow}I'm not finished, Lucky. The quarterly—"` followed by `{"sfx":"squelch"}` with the box's `collapse: true` option.
3. `say lucky` "Better."; `set flags.podSpeakerSlapped`; `music null`; `sfx intercom_buzz` stops.

### CS-03 `ep0_eject` (interact, EJECT) — Toon 3
1. `if !flags.podSpeakerSlapped`: `say narrator` "An unnecessarily red button, locked out by PARENTAL OVERRIDE." → `say dad` "You can't eject while I'm talking, Lucky. Safety is a core value." → `end`.
2. `say narrator` "An unnecessarily red button."; `choice` [EJECT → continue / Not yet → `end`].
3. `sfx eject`; `camera shake 600 0.02`; `camera flash 120`; `set flags.ejected`; `scene freefall`.
4. On return (the Freefall scene calls back): `teleport alley 9 8 facing:down` (the crater; `alley.onFirstEnter` runs CS-04).

### CS-04 `ep0_crash` (`alley.onFirstEnter`) — Toon 2 → 1
1. `sprite player lucky` (back from the ball); black; `music null`; ambient `wind`; `camera fade in 400` on Phoenix at (12,6) with the trash bag (`phoenix` sheet, `trash_bag` frame).
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
14. `say phoenix` "Come on. I've got a bin you can sleep in."; `music pothole`; **[EXT]** autosave to the active slot (`{"save":{"auto":true}}`; fallback: no autosave before City Sound). Phoenix trails the player from here.

### CS-05 `ep0_signal` (interact, bass amp) — Toon 2
1. `move phoenix` beside the amp (path computed from her position, `wait:true`); `say phoenix` "We need a drummer. I could put a flyer up at the coffee shop…"
2. `say lucky` "Too slow. I'm going to ask the universe."
3. `anim player lucky_channel wait:true`; `sprite player lucky_glow`; `sfx feedback` (rising, sustained).
4. `camera shake 1400 0.02`; `spawn wave sprite:soundwave 3 6`; `camera flash 80` ×3. **[EXT]** `camera bend 60` — the screen-border bend (Toon 2; fallback: `camera shake 600 0.03`).
5. `music ask_the_universe`; **[EXT]** `camera mosaic 10` (pixelate out/in; fallback: fade); `teleport rooftops 0 7`; `camera pan x:512 y:112 ms:4000`; at 1800 ms (`wait 1800` after the pan starts; the pan is not waited) `sprite billboard_prod billboard_prod_glitch`, `sfx glitch`.
6. `teleport garage_north 8 7`; `camera fade in 600`; Ryan at the kit (`ryan` sheet, `sit` frame). `wait 1200`; `spawn wave2 sprite:soundwave 0 6`; `move wave2 "RRRRRRRRRRRRRRRR" speed:run wait:true`; `despawn wave2`; `anim ryan ryan_freeze wait:true` (sticks hover; eyes two white pixels).
7. `say ryan_caption` "[…]"; `wait 900`; `say ryan_caption` "[Huh.]"
8. `caption "END PART 1" 2000`; `set flags.signalSent`; `caption "ONE WEEK LATER" 1800`; `teleport apartment 3 7 facing:right`; `music unpaid_bills`; `set flags.weekLater, hubOpen`; `run ep0_week_later`.

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
12. `set flags.ryanCalled` (opens the rail exit); `music normal_music` resumes; **[EXT]** autosave (`{"save":{"auto":true}}`) so a death at the hub chokepoints resumes here, Brian in the band, instead of before the café.

### CS-09 `ep0_ryan_arrives` (Room 3 proximity trigger, once) — Toon 0 → 1
1. `sfx door`; `spawn ryan sprite:ryan_loaded 1 6` (the impossible stack: a 16×40 sheet, or `ryan` plus a `hardware_stack` object moved in lockstep); `move ryan "RRRRRRRRRRRRRRRRRRR" wait:true` to (20,6).
2. `say phoenix` "My brain thinks that's structurally impossible." `say brian` "That's Ryan."
3. Bajonka sits at (20,7) with the clipboard (`bajonka` sheet, `clipboard_sit` frame). `face ryan down`; `anim ryan ryan_nod wait:true`; `wait 400`; `sfx sneeze`; `anim bajonka sneeze wait:true`.
4. `camera fade out 250`; `sprite bajonka bajonka` (clipboard gone, `idle_down`); `setEntity room4_door sprite:soundproof_door_open`; `despawn ryan`; `camera fade in 250`.
5. `say phoenix` "My brain has questions. My brain is choosing not to ask them."; `set flags.ryanArrived, hasBajonka`; **[EXT]** autosave 3 already happened on entering the hall; from this line Bajonka is a live `save` entity.

### CS-10 `ep0_room4_setup` (`room4.onFirstEnter`) — Toon 1
1. `music sticker_hallway`; `sprite player lucky_puddle`; `sprite phoenix phoenix_puddle` (relaxed, they melt).
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
5. `music four_dollars`; `battle ep0_audition onLose:gameover`; onWin: `run ep0_contract`.

### CS-12 `ep0_contract` — Toon 1
1. `music null`; `sfx cymbal` (2 s decay); `say narrator` "Slime drips off the ceiling. And the cymbals. And Ryan."
2. `say lucky` "Holy shit. You're a machine."
3. `say ryan_caption` "[I am literally a hostage.]"; `say ryan` "So, do I get the gig?"
4. `set vars.contractPages = 3 + vars.saveCount` (**[EXT]** arithmetic in `set`; fallback: `inc` from a base of 3 at each save); `spawn bajonka sprite:bajonka 12 3`; `move bajonka "DDL" wait:true`; `anim bajonka trot_drop wait:true`; `spawn contract sprite:contract 11 5`; `sfx thud`; `move bajonka "R" wait:true`; `anim bajonka idle_down`.
5. `say narrator` "Bajonka drops a {var:contractPages}-page, legally binding band agreement onto the snare, turns around, and sits down."
6. `party add ryan` (toast "Ryan joined the band. He is not available."); `give item:band_agreement`; `set flags.auditionDone, ryanJoined, monthLater` (the month flag goes on the page *before* the save, so a page initialed here reloads straight into ONE MONTH LATER instead of an empty Room 4); `save` (Bajonka's prompt reads "INITIAL HERE TO ACKNOWLEDGE RHYTHM SECTION").
7. `caption "ONE MONTH LATER" 1800 style:tape` (**[EXT]** caption style; fallback: plain caption); `teleport room4 5 8` (same map, re-dressed by conditions: pedalboard and iced coffee in, contract out, drip in); `run ep0_month_later` (which also seats the player at (5,8) facing right, so a reload of the contract page plays the scene identically).

### CS-13 `ep0_month_later` — Toon 0 → 2
1. `set flags.monthLaterRan`; `party heal` (a month passes: whoever the AUDITION knocked out is back on their feet); `music normal_music` (the song played straight). Brian at the pedalboard (6,7), `anim brian brian_strum` (loop). Ryan at the kit, `anim ryan ryan_drum`.
2. `say brian` "Do we really need all the political stickers? We're going to alienate the market."
3. `face brian left`; `say brian` "Hey, man, can you turn the bass down?" `say phoenix portrait:phoenix_droop` "I'm not a 'man,' Brian. And no."
4. `say ryan_caption` "[I give this guy three weeks. Tops.]"
5. `say narrator` "Hit the chorus. Get the band to Toon 2."; `battle ep0_rehearsal` (cannot be lost; see Battle system); onWin: `run ep0_ultimatum`.

### CS-14 `ep0_ultimatum` — Toon 2 → 1 → 0
1. The battle's final hooks already showed the KRAAANG, the G, the spill and Brian's "I can't work like this!" line inside the battle. On the map: `sprite coffee_cup coffee_cup_spilled`; `sprite pedalboard pedalboard_fried`; `sfx sparks` ×3; `camera flash 60` ×2; `music null`; `set flags.pedalboardFried`.
2. `say brian portrait:brian_red` "I can't work like this! I hate this weird, creative shit! Can't we just play normal music?!"
3. `caption "ONE MONTH BEFORE\nTHE POTATO BELT TOUR" 1800 style:tape` (two lines: 37 characters do not fit a tape card); `say phoenix` "My brain thinks that caption knows something we don't."
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
4. `music pocket`; `battle ep0_palmers_set onLose:gameover`; onWin: `run ep0_aftermath`. (The first power chord, the mohawk, the shockwave and The Eternity all happen inside the battle; see Set pieces.)

### CS-17 `ep0_aftermath` — Toon 1 → 0
1. `teleport palmers_rubble 8 9`; `sfx cymbal` (long); ambient `wind`; `camera fade in 1500`; `say narrator` "The dust settles. The night sky is where the ceiling used to be."
2. `sprite player lucky_plaster`; `sprite phoenix phoenix_plaster`; `spawn ryan sprite:ryan_slimed_map 23 7 facing:down`; `anim ryan ryan_reform wait:true` (two intact sticks); `music plaster_dust`.
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
- Ryan's next turn: **THE ETERNITY** (frame-by-frame under Set pieces). `meter 100` → `transform ryan → ryan_eternity` (64 px, overlapping the stage) → `caption` "[I am not trapped in the goo. The goo is trapped in the pocket.]" → `music rhythm_achieved` → three words 900 ms apart: **DOOM** (`damage` all enemies 999), **CRACK** (`background palmers_roof_peel`; text "The roof of Palmer's Bar peels back exactly like a sardine can."), **THUD** (`camera.shake 1200`; text "The walls blow outward."; `caption` "[Rhythm achieved.]") → `win`.
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

## UI & presentation

All coordinates are absolute screen pixels on the 256×224 canvas; frame counts are at 60 fps. Everything sits on whole pixels; 8 px font; line heights 10 (command lists) or 12 (dialogue, status); 4 px window borders; shakes are whole pixels; no rotation, no scaling, no sub-pixel tweens.

### Window style: Earthbound flat, zine edition (plus one FF window)
**Flat windows**, not FF's blue gradient: the game is contemporary and deadpan, flat black with a white rule reads as a photocopied flyer, and the inner rule carries Lucky's mood color. Frame (4 px, 9-slice from the `ui` atlas `win_*` pieces), outside → in: 1 px `#141018`, 2 px `#f8f8f8`, 1 px **mood color** (pink `#ff5fd2` by default; magenta `#ff1aa0` from `luckyRageLocked`; `#a050c0` during Toon 4), then fill `#10101c`. Corner pixel clipped (1 px chamfer). Text `#f8f8f8`, disabled `#787890`, highlight `#ffe066`.

**The one FF window.** Dad's intercom (`who: "dad"`, and every Vanguard voice later) uses the FF blue gradient: four 14 px bands `#0028a0 → #001c78 → #001050 → #000838`, 2 px white double border with a 1 px black gap, square corners, name tag "VANGUARD INTERCOM". The empire's voice is the default RPG window. When Lucky slaps the speaker the window collapses vertically (56 → 0 px in 4 frames, `squelch`) mid-sentence.

**Ryan's caption window** (`who: "ryan_caption"`): inverted. Fill `#f8f8f8`, 1 px `#141018` border, 1 px gap, 1 px `#141018` second rule; square corners; text `#141018`; no portrait, no tag; fixed at x 8..136, y 28..52 (2 lines of 14 chars; auto-paginates). Text appears **instantly** with one soft `caption_tick` — the only window with no typewriter, so it reads as the calmest voice in the loudest room. It is drawn at the same position on the map and in battle.

**Bajonka's windows** (save, contract, flyer): the flat window with a clipboard-clip sprite (16×8, `clip`) centered on the top edge and the inner rule in tan `#e8c890`.

### Text
Typewriter 1 char / 30 ms (fast 15, slow 60, instant 0; the player's choice in `smfos.settings`). `text_blip` on every second printable char, pitched per speaker: Lucky C6, Phoenix G5, Brian E5 (50% duty), Dad A3 (12.5% duty buzz), narrator silent, Ryan's captions silent. Punctuation pauses: comma 80 ms, period/!/? 180 ms, ellipsis 300 ms. `confirm` finishes the page, then advances; an 8×8 bouncing triangle (`arrow_more`) at (238, 206) marks "more". Markup per §5.1: `{shake}` jitters each glyph ±1 px every 4 frames; `{color:pink}` etc. use the theme palette; **[EXT]** `{var:name}`.

### Dialogue geometry (§12.2)
Box x 8..248, y 160..216 (height 56); 3 lines at 12 px (baselines y 168, 180, 192); 28 chars per line; with a portrait (32×32 at x 12..44, y 164..196) text starts at x 52 → 24 chars. Name tag: a small window at x 8, y 148..160, width = chars × 8 + 8. Choices: a window above the box's left side at x 8, y 160 − 12·n − 8, cursor hand at x 12. Narrator lines use the same box with no tag.

### Title screen
Black field. Starfield: 40 single-pixel stars in three depths (`#404058`, `#8080a0`, `#f8f8f8`) scrolling down at 1 px per 4/2/1 frames (integer accumulator). Minneapolis skyline silhouette from the `minneapolis` tileset along y 176..224, with the WORK IS LOVE billboard at x 160..224, y 168..184 running its 2-frame glitch every 6 s.
Sequence: frame 0 black; 30 → stars; 60 → "SLIME MONSTERS" (16 px letters from the `ui` atlas `logo_*`, 14 glyphs = 224 px, at x 16, y 40..56) drops from y −16 to y 40 in 8 frames and lands with a 2 px shake and `kraaang`; 90 → "FROM OUTER SPACE" (8 px font, letter-spaced to 12 px per char) at y 72, typed in; 150 → a pink-and-green contrail streak arcs from (256, 0) to (40, 176) over 40 frames leaving a 2 px trail that palette-cycles pink→green→dark over 90 frames; 190 → "PRESS Z" blinking (30 on / 30 off) at y 150; on press → NEW GAME / CONTINUE at x 96, y 150 / 162 with the hand cursor at x 84. CONTINUE is gray with no save. Idle 20 s → attract: the freefall scene plays with no input, then returns. Music `title`.

### Pause menu (MenuScene)
Left window x 8..160, y 8..216: four party rows, 48 px each (y 16 + 48i): portrait at (16, 16 + 48i), name at (56, 18 + 48i), "LV 3" at (56, 30 + 48i), "HP 54/54" at (56, 42 + 48i) and a 64×4 HP bar at (112, 44 + 48i) in the mood color, "AMP 12" at (56, 54 + 48i). Right top window x 160..248, y 8..84: ITEMS / RIFFS / EQUIP / STATUS / SAVE at y 16 + 12i, cursor hand x 168. Right bottom window x 160..248, y 84..216: "$4" (y 92), "TIME 00:42" (y 104), location (y 116, wraps), "MOOD" + an 8×8 swatch of Lucky's current palette (y 140), "NEXT GIG:" + the flyer text once held (y 160). Submenus open as a full-width window over the left column. The menu slides in from the right 32 px over 6 frames; `cursor` on move, `cancel` on back. STATUS → OPTIONS holds text speed and volumes.

### Battle HUD pixel map

```
y   0 ┌──────────────────────────────────────────────────────┐
y   4 │ SETLIST strip x8..136 y4..12 (8×8 icons, 8 px pitch)  TOON 2  (text x152 y4)
y  14 │ [enemy name window x8..136 y16..32, while targeting]   TOON bar x152..248 y14..22 (4 × 24 px segs)
y  28 │ [Ryan caption x8..136 y28..52, band fights only]
      │   enemy zone x 8..152, feet line y 144         party column (feet y):
      │   32px ×1: feet-center x 80                    slot0 x196..228 y40..72   (feet 72)
      │   32px ×2: x 48, 112   ×3: x 36, 80, 124        slot1 x192..224 y68..100  (feet 100)
      │   48px ×1: center x 80; 48+32: x 64, 124        slot2 x188..220 y96..128  (feet 128)
      │   64px: center x 72; 64+48: x 56, 120           slot3 x184..216 y124..156 (feet 156)
      │                                                 kit object x216..248 y124..156 (band fights, behind slot3)
y 144 │ [message strip x8..248 y144..158: one-line battle text]
y 160 ├────────────────────┬─────────────────────────────────┤
      │ COMMAND x8..112    │ STATUS x112..248                 │
      │ STRUM   ITEM  y168 │ NAME x116  st x174  HP →x220  AMP →x244   rows y166,178,190,202
      │ RIFF    TUNE  y184 │ LUCKY   ◆  46/52   11            │
      │ NOISE   BAIL  y200 │ PHOENIX    61/61    8            │
      │ (cols x16, x64)    │ beat lamp 4×4 at (242,164), band fights only (cosmetic)
y 216 └────────────────────┴─────────────────────────────────┘
```

Command window line height 16 (three rows), status window 12. The active character steps 8 px left over 4 frames (FF style) and the cursor hand appears at their status row. Targeting: the hand cursor (8×8, pointing left) sits 4 px left of the enemy; the enemy-name window appears for the duration. The RIFF submenu opens as a window x 8..160, y 100..160 over the field, 2 columns, AMP cost right-aligned, SYNC entries below a divider rule with their gray reason. The NOISE submenu is the same window listing POP! / KRAAANG / KRATHOOM / ??? with Toon cost. KO'd rows in the status window gray out; status icons (8×8) at x 174. The Eternity (64×64) is drawn centered at (200, 120) over slots 2–3. The background runs full-screen behind everything; the bottom windows cover y 160..216, leaving an 8 px strip of background below them (y 216..224) — Earthbound's backgrounds bleed under the HUD.

**Count-in.** After the transition, digits 1-2-3-4 (16×16 `count_*` from the UI atlas) slam onto screen center at 180 BPM with `count_click` on each; the song starts on the downbeat after "4". For the band fights the count is Lucky's voice line "One, two, three, four!" in the dialogue box with `{speed:instant}` and the same clicks.

**Damage digits:** 8 px font, white; rise 10 px over 10 frames, fall 4 px over 4, hold 20, vanish. Crits yellow with a 2 px shake on the target and `crit`. Heals green. "MISS" slides 6 px right. Every hit also spawns a POW / THWAP / BONK word sprite (from the SFX-word atlas) at the impact point, drawn 1 frame per Toon Level larger in jitter (0 px at Toon 0, ±1 at Toon 2, ±2 at Toon 3).

**Enemy hit flash:** `setTint(0xffffff).setTintMode(FILL)` 4 frames, then 2 frames of 2 px horizontal jitter. Enemy KO: 8-frame horizontal slice dissolve (RenderTexture split into 4 strips sliding alternately off) with `ko`. Party KO: the `ko` frame (Lucky: a puddle). Victory: "SET BREAK" strip at y 144 listing XP / $ / items, then level-up lines; `victory` sting.

### Toon Level → effect table

| Toon | Map / cutscene | Battle background | Battle HUD | Audio |
|---|---|---|---|---|
| 0 | Plain windows, no camera effects. | Static pattern. | Normal. | — |
| 1 | Emotes, portraits, 1 px shakes. | Static pattern, light shake on hits. | Normal; crit +3%, dmg +5%. | — |
| 2 | SFX words are physical sprites; `camera bend` on the amp signal; 2 px shakes. | Pattern scrolls (1,1) px/frame; KRAAANG's letters fall with a bounce. | Normal; +6% / +10%. | Pulse harmony layer in `pocket`. |
| 3 | `camera tear` (6 px halves, 2 px gap); 4 px shakes; flash. | Strip wave, amplitude 3 px, period 64 px. | `uiTear 1`: windows jitter ±2 px, message strip offset 1 px; +9% / +15%. | Detuned saw double in `pocket`. |
| 4 | Palette replaced, HUD corrupts, input locked. | `black_hole`: concentric purples cycling inward 1 index / 5 frames. | `uiTear 2`: torn 9-slice (`tornwin_*`), border rule `#a050c0`, command window closed. | `rhythm_achieved`. |

### Transitions
- **Battle entry — static burst.** Snapshot the Explore camera into a RenderTexture (`draw` + `render`). Cut into 28 horizontal strips of 8 px. Over 20 frames even strips slide right and odd strips slide left at 2, 4, 8, 12 px/frame (accelerating) while `static_burst` plays and the strips flicker between the snapshot and a noise texture every 2 frames. Frames 20–25 black. Frame 26 the battle scene is already scrolling its background; windows slide up from y 224 to y 160 over 6 frames; count-in begins. With `?fast=1` the whole thing is 8 frames.
- **Battle exit (win).** `victory`; SET BREAK strip; fade out 20 frames; Explore fades in 20.
- **Fade** black 400 ms (24 frames); **flash** white 150 ms (9 frames).
- **Shake**: whole pixels only. Light 1 px (emotes), medium 2 px (KRAAANG, the door slam), heavy 4 px (first snare hit, doom downbeats), max 6 px (the final cymbal). Pattern alternates +x, −x, +y, −y per frame. The `intensity` argument of the §5.1 `camera.shake` maps 0.01 → 1 px, 0.02 → 2 px, 0.03 → 4 px, 0.04 → 6 px.
- **Mosaic** (`camera mosaic`): pixelate filter (`enableFilters(); filters.internal.addPixelate()`) stepping 1→2→4→8→16 over 10 frames then back; entering the signal montage and the garage. Fallback: fade.
- **Panel tear (Toon 3, `camera tear n`).** Snapshot, split at y 112, offset top +n px / bottom −n px horizontally with a 2 px black gap for 6 frames, snap back with a 4 px shake.
- **Screen border bend (Toon 2, `camera bend`).** 28 TileSprite strips (256×8) sharing the frozen snapshot, each with `tilePositionX = round(6 · sin(t/8 + y/16))` for 60 frames, amplitude ramping 0→6→0.
- **Caption cards.** `ui.caption` over black, 8 px white, centered. `style: "tape"`: a white 160×24 card at (30, 92) (deliberately off-center) with two 16×8 gray tape sprites over its corners, slapped on with `thud` and a 1 px shake; text `#141018`. `style: "flyer"`: the same white card, centered, no tape, letter-spaced.

### Freefall sequence (`FreefallScene`)
24 seconds, skippable with `cancel` after 8 s. The camera looks down: a `sky` TileSprite scrolls up at 2 px/frame with a purple→orange twilight gradient done as 8 banded color rows that drift down 1 px / 30 frames. Lucky's `lucky_fall` sprite (24×16, flattened; the sunglasses frames swap in at 5 s with `slime_pop`) sits at y 48 and steers left/right at 1 px/frame (acceleration 1 px every 3 frames, max 3). The contrail is a RenderTexture: every frame Lucky stamps a 4×4 pink dot, then a green dot 8 px later, so the trail is a pink-green ribbon that scrolls with the sky. Five WORK IS LOVE billboards (64×24) scroll up at the sky speed at t = 4, 8, 12, 16, 20 s; passing over one paints it (its texture swaps to the glitch frame, `glitch`, `vars.billboardsTagged++`). No fail state. Painting all 5 awards the "Flying Squirrel" title on the STATUS screen. The skyline rises from the bottom over the last 4 s; the final frame is the alley rooftops at full scale, then cut to black, `crash`, and the static burst into `alley`. Fallback: a non-interactive 12 s version with the contrail pre-painted and `billboardsTagged = 5`.

### Palette discipline
The shared 32-color console palette lives in `tools/palettes.md`; every sheet picks ≤16 from it. Outlines are always `#141018`. Lucky's mood variants are `variant:` lines in the Lucky sheets, never tints. **Lucky's rage is magenta** `#ff1aa0` / `#ff66c8` / `#8a0a5a`, glow `#c8ff3c` (the shipped `lucky_rage` variant already uses these values). Deflated: `#ffb8e8`, `#ffe0f4`, `#c880b0`, glow `#b8ffd6`. Bruised (Lucky KO frame, Ryan Pocket): `#8a4fc8`, `#b080e0`, `#4a2070`. Phoenix gray per the shipped sheet; Ryan flannel `#b02828`-equivalent from the palette (`brick`), skin `#f0c8a0`, slimed `#8bff9a`, bruised `#7a3aa8`. The Eternity: `#0a0612`, `#1a0a2a`, `#3a1050`, `#6a2a8a`, `#a050c0`, `#e0b0ff`, white. Plaster-dust variants of every party/crowd sheet (`_plaster`: all mid-tones → `#d8d8e0`) are generated the same way.

### Battle backgrounds (Earthbound-style)
Each background is a 64×64 or 128×128 pattern generated at boot into a CanvasTexture, baked into 8 phase frames, then displayed as a TileSprite (or 28 strip TileSprites when a wave is needed) animating at 8–15 fps. No per-frame pixel writes; bake lazily on first use.

| id | Pattern | Motion | Used by |
|---|---|---|---|
| `street` | diagonal hatch of 4 blues | scroll (1,1) px/frame; cycle the blues every 8 frames | hub fights, the Billboard |
| `alley` | brick and slush hatch | as `street`, darker | the drone |
| `room4` | overlapping sticker shapes, two layers | layer A scrolls right 1 px/frame; layer B (dots) up-left at 50% alpha | AUDITION, The Chorus |
| `palmers` | beer-sign script shapes on black | palette cycles 6 neon hues at 8 fps; strip-wave amplitude = Toon Level px | THE SET |
| `palmers_roof_peel` | `palmers` with the top 48 px replaced by a starfield | as `palmers` | after CRACK |
| `black_hole` | concentric rings, 8 purples | cycle inward 1 index / 5 frames; no scroll | THE ETERNITY |

## Set pieces

Frame counts at 60 fps; "frame 0" is the first frame of the piece. All camera motion is in integer steps.

### The signal montage (CS-05, Toon 2)
| Frames | What happens |
|---|---|
| 0–59 | Lucky's `channel` anim (2 frames at 4 fps) at the amp; the amp's `glow` frames alternate; `feedback` rises A4→A5 over 1.2 s. |
| 60–143 | `camera shake` 1400 ms at 2 px; `soundwave` sprite (256×32, 4-frame roll) spawns at the amp and expands: frame 60 at 32 px wide, +16 px every 6 frames (frame swap, no scale) until it covers the screen at frame 144. Three white flashes of 80 ms at frames 60, 90, 120. |
| 144–203 | **Border bend**: 28 TileSprite strips of the frozen snapshot, `tilePositionX = round(6·sin(t/8 + y/16))`, amplitude 0→6→0 over 60 frames. Fallback: `camera shake 600 0.03`. |
| 204–213 | Mosaic out (1→16) over 10 frames; `ask_the_universe` starts. |
| 214–453 | `rooftops`: camera pans x 0→512 over 240 frames (4000 ms, ~2 px/frame). At frame 322 (1800 ms) the PRODUCTIVITY IS FREEDOM billboard swaps to its glitch frame with `glitch`; at frame 400 the skyline gives way to highway lights, then pines. |
| 454–489 | Fade to black 600 ms; cut `ask_the_universe`; `northern_garage` (one closed hat per beat, one triangle note every 2 bars). |
| 490–561 | Fade in on `garage_north`: Ryan on the throne (`sit`), sticks raised. Hold 72 frames. |
| 562–657 | The wave (`soundwave`) crosses the garage left→right in 16 run-speed tile steps; as it passes Ryan, `ryan_freeze`: 2 frames at 2 fps — sticks hover 2 px above the drum, eyes become two white pixels. |
| 658–711 | Caption "[…]" (instant), 900 ms; caption "[Huh.]". |
| 712– | Caption "END PART 1" 2000 ms over black; "ONE WEEK LATER" 1800 ms; fade in on the apartment couch. |

### KRAAANG and the coffee (B-10 finale + CS-14, Toon 2)
Inside the battle, when the KRAAANG fires (by the player, the round-8 backstop, or the wipe backstop):

| Frames | What happens |
|---|---|
| 0–11 | KRAAANG word (`kraaang_word`, 96×24, `manifest` 3 frames at 4 fps) appears centered above the enemy at (80, 40); `kraaang` SFX (two pulses a quarter-tone apart, 600 ms); 2 px shake 12 frames. |
| 12–35 | The word's letters K-R-A-A-A-N fall 2 px/frame and bounce once (+3, −1) on the enemy's feet line, each letter 2 frames after the previous. The Chorus takes its damage digits. |
| 36–59 | The **G** separates as its own 24×24 sprite (`swing_g`, 4 frames at 10 fps) and swings like a bat: it travels from (120, 40) to the party column at 6 px/frame along a straight line toward Brian's slot. |
| 60–63 | Impact on Brian's row: `coffee_spill` (400 ms noise pour), `damage brian 1` digit, Brian's `hurt` frame. Message strip: "The G knocks over Brian's boutique iced coffee." |
| 64–123 | `transform brian → brian_fried` (same pose, pedalboard prop sparking: `sparks` ×3 at frames 64, 84, 104; white flashes of 60 ms at 64 and 104). Message: "Sparks." `status brian OUT OF TUNE` icon appears. |
| 124–183 | `normal_music` pattern K (a bar of saw + noise) then silence; `win`; the SET BREAK strip shows 30 XP. |
| map | CS-14 begins: the map's `coffee_cup` and `pedalboard` objects are already swapped to spilled/fried; Brian's "I can't work like this!" lands in the red portrait with `{shake}` on the second sentence. |

### THE ETERNITY (B-11, Toon 3→4) — frame by frame
Frame 0 is the start of Ryan's first turn after `eternityArmed`. `pocket` (7/8, 182 BPM; one beat ≈ 20 frames) is playing; input is already locked; the HUD already has `uiTear 2`.

| Frames | Camera / screen | Sprites & BG | HUD | Audio |
|---|---|---|---|---|
| 0–19 | Hold. | Ryan (`ryan_pocket_purple`) idle. | TOON meter segments flash white in sequence 0→3 (5 frames each), then the bar fills to 100 (`meter 100`). | `pocket` continues. |
| 20–59 | Caption [I am not trapped in the goo. The goo is trapped in the pocket.] appears instantly. | Everything else freezes mid-frame (anims paused). | Command window closes (4-frame vertical collapse). | Music drops to triangle + kick only (pulse channels to volume 0). |
| 60–119 | Pan 100 px left and 24 px up over 60 frames (4 px/frame for 20 frames, then 1 px/frame; x and y scheduled separately) so the kit's center (228, 120) lands at screen center (128, 96). | Slime drip particles (6-frame, 3 per second) reverse direction and rise. | Status window slides down off-screen (56 px over 20 frames). | Kick doubles (every eighth). |
| 120–179 | White flash 6 frames at 120. 2 px shake 120–179. | `transform ryan → ryan_eternity` (64×64) frame 0, centered where the kit was; background swaps `palmers` → `black_hole`. | Message strip reads "RHYTHM"; border rule → `#a050c0`. | Hard cut to `rhythm_achieved` (7/8, 60 BPM doom); the first hit is the lowest triangle note with a 400 ms pitch fall. |
| 180–299 | 4 px shake on every doom downbeat (frames 180, 240) for 8 frames each. | `ryan_eternity` loops 6 frames at 8 fps; the palette cycles inward one index every 5 frames. Every downbeat spawns an SFX word — **DOOM** (48×16) at 180, **CRACK** (48×16) at 234, **THUD** (40×16) at 288 (900 ms apart) — at a point on a 48 px ring around Ryan, drifting 1 px/frame toward him (gravity) and staying. Each word fires its `damage`/`background`/`camera` event as it lands (DOOM: 999 to every enemy; CRACK: `palmers_roof_peel` background; THUD: 1200 ms shake). | Window borders in the Toon-4 palette. | `doom` / `crack` / `thud` sub-bass thumps (40 / 50 / 30 Hz with noise tails) on their frames; noise open hat every beat; pulse1 a detuned drone pair 8 cents apart on the root. |
| 300–359 | Caption top-left: [Rhythm achieved.] | Lucky and Phoenix swap to their `_plaster` variants (white dusting). The cops' `flee` frames slide off left. | — | Beat 3 of the doom riff. |
| 360 | `win` is emitted; the battle scene hands off to the destruction sequence before the SET BREAK strip. | | | |

The player has no input from frame 20 to the end of the destruction. `confirm` is ignored, not buffered.

### The roof peel and wall blow — frame by frame
Runs inside BattleScene over the `black_hole` background, using a snapshot of `palmers` taken before the battle (the Explore camera's RenderTexture).

| Frames | What happens |
|---|---|
| 360–419 | THUD (drawn 2 px thicker) breaks from the ring and swings up: 8 frames rising 48 px at 6 px/frame. On frame 368 it hits the ceiling line (y = 24): white flash 4 frames, 4 px shake 12 frames, `crash`. The snapshot's top row swaps to `ceiling_cracked` tiles in a 3-frame ripple outward from the impact column (1 column per frame). |
| 420–539 | **Roof peels like a sardine can.** The snapshot's top four tile rows (64 px) are cut into 16 px-wide vertical strips (16 strips over 256 px); starting from the right edge, each strip curls: it translates up 2 px/frame and alternates between the normal strip and a 2-row "underside" strip (gray drywall back) every 4 frames; one strip starts every 7 frames so the peel travels right-to-left across 16 strips in ~112 frames. `roof_peel` (2000 ms rising noise + triangle slide C3→C5) plays once; `sky_hole` stars are drawn beneath the revealed rows. |
| 540–599 | **Walls blow outward.** Left and right wall columns of the snapshot slide 8 px per 4 frames off-screen; 12 brick-chunk sprites (8×8) fly on integer parabolas (vx ±3, vy −4, gravity +1 every 4 frames). `wall_blow`. 4 px shake throughout. The camera holds. |
| 600–719 | **The crowd scatters.** Twelve crowd sprites (from the snapshot's NPC strip, drawn as sprites) run to the nearest screen edge at run speed with `!` emotes. The Undercover Cop runs last, `run_holding_mohawk`, with a one-line message that does not pause: "Dispatch — DISPATCH —". |
| 720–779 | **The cymbal crash.** All sprites freeze. `cymbal` at full volume with 2 s decay. 6 px shake for 8 frames, then 4, then 2, then 1 (frames 720–751). The shake is the last thing that moves. |
| 780–899 | Silence. Nothing moves for 2 s. Fade to black over 60 frames beginning at 840. |
| 900 | BattleScene calls `onDone('win')`; CS-17 fades in on `palmers_rubble` (plaster palette, sky visible). `plaster_dust` begins one second after the fade-in. |

Cut order if this is too expensive: the strip peel → a 4-step row-by-row fade of the top four rows to `sky_hole` tiles (15 frames each) with the same SFX; keep the wall blow and the cymbal shake.

### The quit (CS-17, Toon 1 → 0)
Ryan's `ryan_eternity` is gone; a 16×24 `ryan_slimed` stands at the kit's tile in the `sit` frame, then the 4-frame `reform` at 2 fps (solidifying). He holds two sticks (the `nod` frame's arms, sticks white). Lucky: "Okay. That is our sound." Phoenix: "My brain thinks we are officially domestic terrorists." Ryan, aloud, with a portrait for the first time in the chapter (`ryan_stoic`): "I think I broke the space-time continuum on that snare fill." Then the caption [I could have killed every person in this room.] — the caption window **shakes 1 px for its whole duration**, the only time it ever does: the calmest voice is terrified. Aloud: "I quit." `plaster_dust` stops on that line and does not resume.

Lucky's sheet swaps to `lucky_rage` on the next frame with `slime_pop` and a 2 px shake, and the window inner rule turns magenta `#ff1aa0` — it stays magenta for the rest of the chapter, including the title cards. The choice (RAGE / PLEAD / JOKE) is the slice's only three-way branch; every branch ends in "Yep." and Ryan walking north off the map edge at walk speed with no music, six tiles of silence while the camera holds. PLEAD alone swaps Lucky to `lucky_deflated` for the walk, then back to rage when Phoenix speaks. Bajonka trots out from under a `drywall_chunk` tile (the tile swaps to `rubble` as she emerges), `keys_sit` frame, `sneeze`. Lucky, magenta: "We don't have a drummer." Fade to black; flyer-style caption: "NEXT: THE POTATO BELT" / second line after 1 s: "(DRUMMER WANTED)". Hold 3 s. Return to title with CONTINUE enabled.

## Audio

Four channels: pulse1, pulse2, triangle, noise (§7). Punk cues keep pulse1 on the riff (50% duty, slight detune on power chords via `~`), pulse2 on the vocal line (25%), triangle on bass, noise on the kit (`k s h o c`). 7/8 cues use `beatsPerBar: 7, stepsPerBeat: 2`. Song ids match `src/audio/songs/` (nine are already in the repo).

### Cue list (19 songs)

| id | Scene | BPM / sig | Mood | Instrumentation |
|---|---|---|---|---|
| `title` | Title | 190, 4/4 | anthemic punk | I–IV–V–IV Ramones riff in A; downstroke 8ths on pulse1, shouty pulse2 lead, triangle root 8ths with octave pops, crash-kick-snare. The hook is the slice's leitmotif. |
| `dental_plan` | Pod bay; Game Over reprise | 100, 4/4 | corporate muzak | 12.5% duty pulses in parallel sixths, triangle walking bass, brush hats only; a brand jingle every 8 bars; cuts dead on SQUELCH. |
| `flying_squirrel` | Freefall | 200, 4/4 | soaring | pulse arpeggios (Cmaj7→Am9) in 16ths, pulse2 long slides `C5~`, triangle pedal, **no noise** until the crash. |
| `pothole` | Alley | 92, 6/8 | lo-fi, tired | triangle bass only + a sparse 2-note pulse2 motif every 4 bars; noise = wind (open hat at 0.08 every beat). |
| `snow` | Street, first pass and at night | 72, 3/4 | melancholy waltz | triangle melody, pulse2 pad, noise wind; the night pass adds a 25% pulse neon buzz. |
| `unpaid_bills` | Apartment | 120, 4/4 | lo-fi beat | pulse1 muted staccato chords (25%), triangle boom-bap, noise k . s .; the title riff at half speed enters when Lucky touches the amp. |
| `ask_the_universe` | Signal montage (one-shot, ~24 s) | 150, 3/4 | building drone | pulse1+pulse2 unison root, detune widening each bar via `~`, triangle rises an octave over 8 bars, noise crescendo; hard cut to `northern_garage`. |
| `northern_garage` | Garage (both visits) | 60, 4/4 | frozen | noise closed hat every beat at 0.1, one triangle note every 2 bars. Nothing else. |
| `west_bank` | Hub (day) | 170, 4/4 | skate-punk | the slice's main loop; two-bar riff, chorus every 8 bars, triangle octave jumps, ska upstrokes on pulse2. |
| `normal_music` | Coffee shop; The Chorus | 128, 4/4 | sterile rock | 50% duty, I–V–vi–IV, perfectly quantized, no accents; snare on 2 and 4, nothing else. Pattern K (one bar of saw + noise) when KRAAANG fires. The joke is that it is correct. |
| `sticker_hallway` | City Sound hall, Room 4 idle | 160, 4/4 | muffled punk | `west_bank` with pulse1 at 0.15 and the triangle carrying the riff, as if through a soundproof door. |
| `four_dollars` | AUDITION | 196, 4/4 | blistering | the fastest cue; pulse1 downstrokes 8ths, pulse2 screamed line (`!` accents), triangle 8ths, noise kick every 8th with snare 2/4 and a fill every 4 bars with too many notes for the channels (the arm smear). |
| `battle` | Street fights | 190, 4/4 | fight | 2-bar riff, half-time chorus; opens on four stick clicks. |
| `six_inch_stage` | Palmer's interior (and the hub outside at night, pulse2 muted) | 140, 4/4 | jukebox | a different band on the house system: pulse2 melody, muted on the exterior. |
| `pocket` | THE SET | 182, 7/8 | locked-in | 7/8 riff (3+2+2): pulse1 `E3! . E3 . G3! . A3` style, triangle doubles, noise k on 1 and 4, s on 6; a fill every 4 bars. Pulse2 harmony enters at Toon 2; a detuned saw double at Toon 3. |
| `rhythm_achieved` | THE ETERNITY (20 s, no loop) | 60, 7/8 | doom | half-time: triangle on the lowest notes (`E2`, `D2`, `C2` with `~` falls), pulse1 detuned drone pair, pulse2 silent, noise open hat every beat, kick on 1 with a 100 ms noise swell. Every downbeat is a camera shake. |
| `plaster_dust` | Rubble | 70, 4/4 | hollow | triangle alone, the `pocket` riff at a quarter speed, no drums. Stops on "I quit." and does not resume. |
| `win_sting` | Victory (2 s) | 180 | sting | pulse chord stab ×3 ascending + cymbal; `level_up` arpeggio follows when earned. |
| `game_over` | Game Over | 100, 4/4 | — | `dental_plan` reprise in minor: Dad wins. |

Not cuttable: `title`, `battle`, `four_dollars`, `pocket`, `rhythm_achieved`. Cuttable to filters of existing songs: `sticker_hallway` (low-passed `west_bank`), `six_inch_stage`, `plaster_dust`, `game_over`.

### SFX list (40, synthesis recipes for `sfx.js`)

| name | Recipe |
|---|---|
| `cursor` | pulse 25%, C6, 20 ms, instant decay |
| `confirm` | pulse 25%, C6→G6, 2×30 ms |
| `cancel` | pulse 25%, G5→C5, 2×30 ms |
| `text_blip` | pulse 12.5%, speaker pitch, 15 ms |
| `caption_tick` | triangle, C5, 10 ms, volume 0.2 |
| `hit` | noise 60 ms + pulse 50% sweep E4→E3 over 80 ms |
| `crit` | `hit` + pulse2 stab A5 40 ms |
| `miss` | pulse 12.5% slide C5→C4, 100 ms |
| `squelch` | triangle slide G3→C2 over 200 ms + noise 80 ms, volume 0.6 |
| `slime_pop` | pulse 50% up-sweep C4→C6 in 40 ms, ×3 staggered 60 ms (pop-pop-pop) |
| `kraaang` | two pulses 50% a quarter-tone apart, E3, 600 ms with ±15 cent vibrato at 6 Hz, decay to 0 |
| `krathoom` | `kraaang` an octave down + noise 300 ms at 0.8 |
| `level_up` | pulse arpeggio C-E-G-C 4×50 ms + triangle root |
| `item` | pulse 25% E5-G5, 2×40 ms |
| `door` | noise 30 ms + triangle thump C3 |
| `door_slam` | noise 120 ms at 0.8 + triangle C2 100 ms |
| `sneeze` | noise 40 ms rise + triangle "chiff" G5→C4 60 ms |
| `save` | `sneeze` → triangle boop-boop (two notes, 2×80 ms) |
| `feedback` | pulse 50% A4 rising to A5 over 1.2 s with 5 Hz vibrato, sustain until stopped |
| `drum_hit` | noise 50 ms + triangle D2 30 ms |
| `cymbal` | noise 2000 ms exponential decay, volume 0.9 |
| `count_click` | noise 10 ms at 0.5 (stick click) |
| `ko` | pulse 12.5% descending chromatic 8 notes × 30 ms |
| `flee` | noise ramp 300 ms |
| `eject` | pulse 50% buzz A2 200 ms, then noise 500 ms swell |
| `static_burst` | white noise 350 ms, volume gated on/off every 2 frames |
| `crash` | noise 400 ms at 1.0 + triangle C1 300 ms |
| `pedal_stomp` | triangle thump + pulse click, 30 ms |
| `unplug` | pulse 50% C4 20 ms + noise 15 ms (POP) |
| `coffee_spill` | noise low-volume 400 ms "pour" |
| `sparks` | pulse 12.5% random notes C7–C8, 8 × 20 ms |
| `gears` | noise 20 ms ×6 at 80 ms spacing, pitch of a pulse click falling then rising |
| `roof_peel` | noise 2000 ms rising volume + triangle slide C3→C5 |
| `wall_blow` | `crash` + `sparks` |
| `mohawk_pop` | pulse 50% C5→G5 30 ms (a cork) |
| `intercom_buzz` | pulse 12.5% A3 continuous at 0.1 while Dad talks |
| `glitch` | noise 3 × 20 ms + pulse random pitch |
| `thud` | triangle C2 60 ms + noise 20 ms (caption card lands; the contract) |
| `doom` / `crack` / `thud_low` | sub-bass thumps: triangle 40 / 50 / 30 Hz 250 ms with 120 ms noise tails |
| `drone_whine`, `phone_ring`, `click`, `chair`, `rubble`, `jukebox_1..4` | drone: pulse 12.5% E6 with 8 Hz vibrato 800 ms; ring: pulse 25% A5/B5 alternating 2×400 ms; click: noise 10 ms; chair: noise 60 ms low; rubble: noise 300 ms at 0.4 with three triangle thumps; jukeboxes: four 4-bar pulse jingles |

`text_blip` pitch is chosen by `who`; `hit`/`crit`/`kraaang`/`crash`/`cymbal` carry their shakes in the presentation layer, not in the recipe.

## Controls & save

| Action | Keys | Gamepad (standard mapping) |
|---|---|---|
| Move | Arrows / WASD | D-pad / left stick |
| Confirm / interact / advance text | Z, Enter, Space | A (0) |
| Cancel / back (skip the freefall after 8 s) | X, Backspace | B (1) |
| Menu | Esc, C | Start (9) |
| Run (hold) | Shift | X (2) |
| Mute | M | — |
| Fullscreen | F | — |

`src/config.js` adds `KeyC` to `menu`, `KeyM` and `KeyF` as app-level toggles. Text speed and volumes live in the pause menu's STATUS → OPTIONS and in `smfos.settings`. Text 1 char / 30 ms; `confirm` completes the page, then advances; `?fast=1` honored everywhere (instant text, 4× transitions, 8-frame static burst).

**Saving is Bajonka.** She becomes a `save` entity at City Sound (`flags.hasBajonka`, set in CS-09) and sits at: the City Sound hallway outside Room 4 (the canonical clipboard pose), Room 4 after the audition (CS-12 `save` command), outside Palmer's on the hub at night, and the rubble (CS-17). Before she exists the game **autosaves to the active slot** at four points: after the tutorial battle, on leaving the apartment after ONE WEEK LATER, when Brian joins (the end of CS-08, so the café is never replayed), and on entering the City Sound hallway — so a death in the hub costs at most the hub. Interact → `sneeze` → "Bajonka holds out the clipboard." → INITIAL HERE? with three slots, each showing chapter, location, playtime, Lucky's level and the party's portraits in a row; an empty slot reads "— unsigned —"; [Decline] → "The clipboard does not move." Saving bumps `vars.saveCount` (toast "You initial page {n}. Bajonka sneezes."), restores AMP to max for everyone (the dog is a rest), and stores `meter` (zeroed on load). Ryan's agreement is `3 + vars.saveCount` pages, so a cautious player hands him a forty-page contract. Saves use the §6 format in `smfos.save.1..3`; Continue on the title loads the most recent slot; Game Over reads "CONTINUE FROM LAST INITIALED PAGE?" and returns to Title with Continue enabled.

## Content inventory

Names are the `name:` keys in `tools/sprites`, `tools/tiles`, `tools/ui`; animation keys are `<sheet>_<anim>`. Sheets marked **(shipped)** already exist in the repo and are the reference for style.

### Overworld sprites (16×24 unless noted)

| Sheet | Anims (frames) | Variants |
|---|---|---|
| `lucky` (shipped: walk ×3 dirs, idle ×4, melt 2) | add: `reform` 4 (pop-pop-pop), `channel` 2 (glowing arm), `stomp` 2, `bristle` 2 (standing spikes), `puddle` 1 | `lucky_rage` (magenta, shipped), `lucky_deflated` (shipped), `lucky_bruised` (shipped), `lucky_plaster` (shipped), `lucky_glow` (new: p→`#ff9ae6`, g→`#f8f8f8`), `lucky_bristle` = `bristle` anim on `lucky` |
| `lucky_ball` (16×16) | idle_down/up/left 2 each (compressed, pulsing squish), walk 4 (one rolling loop for every facing: spikes top, left, under, right), `pseudopod` 3 (rise, full reach to the frame top, splat) | — |
| `lucky_fall` (24×16) | glide 2, bank_left 1, bank_right 1, glide_shades 2, bank_left_shades 1, bank_right_shades 1 | — |
| `phoenix` (shipped: walk, idle) | add: `trash_bag` 1, `glasses_push` 2, `puddle` 1, `bass_mute` 1 | `phoenix_plaster` (shipped) |
| `brian` (shipped: walk, idle, pace 2, point 1, rage 2, stuff_cables 2) | add: `strum` 2, `phone` 1 | `brian_red` (shipped) |
| `ryan` (shipped: walk, idle, carry_hardware 4, sit 1, drum 4, nod 2) | add: `freeze` 2, `unfreeze` 2, `tighten` 2, `reform` 4 | `ryan_slimed` (shipped), `ryan_bruised` (shipped), `ryan_plaster` (shipped); `ryan_loaded` is `carry_hardware` plus the `hardware_stack` object (16×16, moved in lockstep) |
| `bajonka` (16×16, shipped: walk, idle, sneeze 2) | add: `clipboard_sit` 1, `keys_sit` 1, `trot_drop` 2 | — |
| `cop` (shipped: walk, idle, collar_tap 2, mohawk_off 1, run_holding_mohawk 4) | — | — |
| `punk_a`, `punk_b` (crowd bases) | walk 3×3, idle, headbang 2, run 3 | 3 palette variants each (`_1.._3`) = 6 crowd looks; `_plaster` for each |
| `npc_shoveler`, `npc_cyclist`, `npc_busker`, `npc_crustpunk` (+ `dog_also_bajonka` 16×16 = `bajonka` variant), `npc_office`, `npc_stranger` (16×32, tall), `npc_smoker`, `barista`, `pawnbroker` (portrait + window only), `npc_screenwriter`, `npc_poet`, `npc_intern`, `npc_manager`, `npc_ska` (×3 variants), `npc_noiseguy`, `npc_bartender`, `npc_pulltab`, `npc_regular`, `npc_nurse` | idle 2 each; `walk` only for the ska band and the stranger | — |
| `drone_map` (16×16) | hover 2 | — |
| `slush_map`, `goose_map`, `scooter_map`, `analyst_map` (16×24; `goose` 16×16) | walk 3×3 (goose, analyst, scooter), idle 2 (slush is `static`) | — |

### Objects (16×16 unless noted; `idle` 1 unless noted)
Pod bay: `intercom_speaker` (idle, talk 2, `speaker_slimed`), `eject_button` (idle, pressed), `guitar_case`, `pod_nameplate`, `vending`, `plaque`. Alley: `crater` (2-frame glow), `crash_word` (64×24, drop 3), `drone_wreck`, `aura_link` (32×16, 2), `milk_crate`, `bike_frozen`. Street: `billboard_work` (96×48 over-layer, 2-frame glitch), `billboard_prod` (96×48, glitch), `pizza_box`, `hydrant`, `shelter_ad`, `towers_sign`, `pawn_window`. Apartment: `bass_amp` (idle, glow 2), `bass_stand`, `fridge`, `bills`, `poster_1..4`, `radiator`, `bin`, `window_billboard` (2-frame), `soundwave` (256×32, roll 4). Café: `corkboard` (+ `corkboard_flyer`), `tip_jar`, `pedalboard_table`. Garage: `drum_kit` (32×32: idle, hit 2, slimed 1), `landline`, `space_heater`. City Sound: `desk`, `vending_cs`, `board`, `soundproof_door` (closed, open), `room_number_1..6`. Room 4: `amp_stickered`, `amp_plain`, `mic_stand`, `puddle_couch` (48×16), `mini_fridge`, `tallies`, `pedalboard` (pristine, wet, fried 2 with sparks), `coffee_cup` (idle, tipping 2, spilled), `contract`, `brain_xray` (32×32, gears 4), `drip` (idle 2, freeze 1), `slime_splat` (32×16), `kraaang_word` (96×24, manifest 3; `swing_g` 24×24 ×4), `flyer_crumpled`. Palmer's: `stage_kit` (= `drum_kit`), `jukebox`, `pulltab_booth`, `photo_wall` (48×16), `palmers_sign`, `shockwave` (32×32, 3), `mohawk` (8×8), `beer`. Rubble: `drywall_chunk` (lift 3), `mic_bent`, `rubble_slab`. Freefall: `billboard_fall` (64×24, normal + glitch), `sky` (TileSprite source 64×64). About 70 objects.

### Battle sprites (32×32 unless noted; idle 2 / strum or attack 3 / riff 2 / hurt 1 / ko 1 / win 2)

| Sheet | Notes | Variants |
|---|---|---|
| `lucky_battle` | strum 3 (guitar swing), riff 2, hurt, ko (puddle), win 2 | `_rage`, `_deflated`, `_bruised`, `_plaster`, `_flare` (g→white) |
| `phoenix_battle` | strum 3 (trash bag or bass by equip: two strum sets), riff 2, hurt, ko, win 2 | `_plaster` |
| `brian_battle` | idle 2 (identical bar a 1 px pick shift), strum 3, riff 2, hurt, ko, win 1 (thumbs up) | `brian_fried` (pedalboard prop smoking) |
| `ryan_slimed` | idle 2, drum 4, smear 4 (six-arm speed lines), hurt 1 | `ryan_pocket_purple` (green→purple) |
| `ryan_eternity` (64×64) | loop 6; palette cycle by baked frame swap: 8 phases × 6 = 48 frames (fallback: 6 frames alternating two variants every 10 frames) | — |
| `drone` | idle 2, attack 2, hurt 1, death 2 | — |
| `slush_pile` | idle 2 (shiver), attack 2, hurt 1, ko 1 | — |
| `goose` | idle 2, attack 2 (hiss / peck), hurt 1, ko 1 | — |
| `scooter` | idle 2, attack 2, hurt 1, ko 1 | — |
| `analyst` (48×48) | idle 2, attack 2 (clipboard), hurt 1, ko 1 | — |
| `billboard` (64×64) | idle 2 (hum), attack 2, glitch 1 (WORK IS L0VE), hurt 1, ko 1 | — |
| `whrnnng` (64×64) | idle 2 (vibrate), attack 2, hurt 1 | — |
| `thud_thud` (48×48) | idle 2, attack 2 (stomp), hurt 1 | — |
| `chorus` (48×48) | idle 2 (pulse), attack 2, hurt 1 | — |
| `cop_battle` (48×48) | idle 2, attack 2 (collar / baton), hurt 1, mohawk_off 1, flee 1 | `cop_nomohawk` (idle with the bald frame) |
| `backup_cop` | idle 2, attack 2, hurt 1, flee 1 | — |

### SFX-word atlas (`tools/sprites/sfx_words.txt`, 2 frames each unless noted)
`pop` (32×16), `kraaang` (96×24, + separate `g` 24×24 ×4), `krathoom` (112×24), `crash` (64×24, 3), `doom` (48×16, + swing 2), `crack` (48×16, + swing 2), `thud` (40×16, + swing 2, drawn 2 px thicker), `whrnnng` (64×16), `thudthud` (48×16), `pow` (24×12), `thwap` (32×12), `bonk` (32×12), `miss` (32×12).

### Portraits (32×32, `tools/sprites/portraits.txt`, 29)
Lucky: `lucky` (neutral), `lucky_grin`, `lucky_rage`, `lucky_deflated`, `lucky_bristle`, `lucky_shades`, `lucky_calm_scary` (7). Phoenix: `phoenix` (tired), `phoenix_deadpan`, `phoenix_glasses_push`, `phoenix_terrified_impressed`, `phoenix_droop`, `phoenix_baffled` (6). Brian: `brian_normal`, `brian_pointing`, `brian_red`, `brian_stroke`, `brian_smug`, `brian_phone` (6). Ryan: `ryan_stoic`, `ryan_slimed`, `ryan_eyes_glow` (3). Bajonka: `bajonka_sit`, `bajonka_sneeze` (2). Dad: `dad_grille`, `dad_grille_talk` (2). Cop: `cop_disguise`, `cop_mohawk_off` (2). `barista`, `pawnbroker`, `drone` (the drone's screen) (3). Default portrait per character id in `characters.json`.

### Tilesets
- `vanguard` (shipped; needs 12): hull_floor, hull_floor_stripe, hull_wall, hull_wall_panel, pod_glass, pod_seat, conduit, vent, warning_stripe, window_stars (2-frame), intercom_mount, eject_mount.
- `minneapolis` (shipped 30; add 10): existing snow/sidewalk/asphalt/curb/brick/window/door/dumpster/trash_bag/pothole/lamp/fence/slush/grate/billboard_a–c/sign_pole, plus `dumpster_down`, `pothole_glow` (2-frame), `snowbank`, `rail_platform`, `rail_edge`, `car_a` ×4 (two parked cars), `coffee_front` ×2, `pawn_front` ×2, `towers_panel` ×4 (the colored Riverside panels), `neon_palmers` ×4 (2-frame), `awning` (over), `bus_shelter` ×2, `bare_tree_trunk`, `bare_tree_top` (over), `skyline_a..d` (rooftops strip), `pine_trunk`, `pine_top` (over), `highway_light`.
- `interiors` (shipped; needs 42): wood_floor, carpet_stained, tile_floor, wall_plaster, wall_poster ×3, wall_bills ×2, couch ×2, table, counter, espresso_machine, stool, window_night, stage_edge, stage_floor, bar_counter ×2, beer_sign (2-frame), sticker_wall ×4 + sticker_wall_sparse ×2 (plaster with 1–2 stickers), soundproof_door (2-frame), room_number, hallway_floor, hallway_light, mic_tile, drum_riser, garage_wall, garage_door, garage_floor, snow_deep, lamp, dark (void beyond a room's walls, pads maps smaller than the viewport), bathroom_door, door_interior.
- `palmers` (shipped; needs 22): bar wood, stage, stools, neon, bottles, `rubble` ×4, `sky_hole` ×2 (over, stars), `ceiling_cracked` ×2, `drywall_chunk` ×2, `plaster_floor`, peeled-roof underside ×3.
- Battle backgrounds are procedural (see UI); the `sky` TileSprite for the freefall is a 64×64 generated texture.

### UI atlas (`tools/ui/ui.txt`)
Shipped: `win_tl/t/tr/l/c/r/bl/b/br`, `cursor`, `arrow_more`, `meter_on/off` (4×8), `icon_ko`, `icon_poison`, `icon_dazed`. Add: `ffwin_*` (9 pieces, blue gradient, 4×4), `tornwin_*` (9 pieces, torn edges), `capwin_*` (9 pieces, inverted), `clip` (16×8), `cursor_down` (8×8), `meter_pink/green/purple/black` (4×8 segment fills by Toon Level), `beat_lamp_on/off` (4×4), `setlist_lucky/phoenix/brian/ryan/enemy/auto` (8×8), `emote_bang/question/dots/note/heart/zzz` (8×8), `count_1..4` (16×16), `logo_S/L/I/M/E/O/N/T/R` (16×16), `tape` (16×8), `swatch_frame` (10×10), status icons `icon_deaf/outoftune/tempo_down/tempo_up/bristling/slimed/baked/onhold` (8×8), `pocket_lock` (8×8, the AUTO padlock).

### Songs (19) and SFX (40)
As listed under Audio. Twelve songs are shipped (`title`, `snow`, `battle`, `dental_plan`, `flying_squirrel`, `pothole`, `unpaid_bills`, `ask_the_universe`, `northern_garage`, `west_bank`, `normal_music`, `sticker_hallway`); to write: `four_dollars`, `six_inch_stage`, `pocket`, `rhythm_achieved`, `plaster_dust`, `win_sting`, `game_over`.

### Data files
`characters.json` (4 characters + the XP table above), `riffs.json` (24: 10 riffs, 4 Brian, 6 Ryan, 4 syncs — Pocket included — plus 6 NOISE words = 30 entries; "24" counts the player-facing ones), `items.json` (6 consumables + 6 key items), `equipment.json` (15), `enemies.json` (13), `encounters.json` (11: `alley_drone`, `hub_slush`, `hub_scooters`, `hub_goose`, `hub_analyst`, `hub_billboard`, `hub_analyst_duo`, `hub_goose_pair`, `ep0_audition`, `ep0_rehearsal`, `ep0_palmers_set`), `shops.json` (2: `cafe`, `pawnshop`), 11 map JSONs (`pod_bay`, `alley`, `street_cedar`, `apartment`, `coffee_shop`, `rooftops`, `garage_north`, `city_sound_hall`, `room4`, `palmers`, `palmers_rubble`), `start.json` (map `pod_bay`, (7,11), facing up, party [lucky], $4, Half-Ounce ×4).

### Scripts
`src/data/scripts/ep0.json`: CS-01..CS-17 plus `ep0_dad_1..4`, `ep0_week_later` (≈ 230 dialogue pages, 6 Buzzkill lines live in `BattleScripts`). `npc.json`: ~90 one-line object/NPC scripts named `<map>_<entity>`. `shops.json` scripts `shop_cafe`, `shop_pawn`. `bajonka_save`. `BattleScripts.js`: `alley_drone`, `ep0_audition`, `ep0_rehearsal`, `ep0_palmers_set`. `FreefallScene` is code. Tests: `battle.test.mjs` runs each scripted battle end to end with a seeded RNG; `playthrough.mjs` warps scene to scene with the flag spine.

## Engine extensions required

Everything the design needs beyond `docs/ARCHITECTURE.md` as written, consolidated. All are additive. Each has a one-line fallback if cut.

| # | Extension | Where | Fallback if cut |
|---|---|---|---|
| E1 | Battle hooks `onAction(model, actorId, action)` and `onToon(model, level)` | §8 `BattleScripts` | Poll from `onTurnStart` (compare the last action; compare `floor(meter/25)` against the previous round). |
| E2 | Battle events `join` (ally walks in mid-battle), `leave`, `spawn` (enemy), `caption` (Ryan's square box in battle), `background` (swap backdrop), `uiTear` (0/1/2), `lockInput` (on/off), `meter` set to 100 | §8 event list | `join` → Phoenix joins before B-1 starts; `spawn` → backup cops present from round 1 at 1 HP until round 3 (invisible, `minHp`); `caption` → `text` in the message strip; `background`/`uiTear` → no visual; `lockInput` → the command window simply never opens for AUTO turns. |
| E3 | Combatant flags `auto` (AI-driven party member, no command window) and `minHp` (HP floors at n); encounter flag `noFlee` and `startMeter` | `characters.json` / `encounters.json` | `auto` is required (Ryan is the slice); `minHp` → Ryan has 999 HP in the AUDITION; `noFlee` → BAIL always fails in scripted fights. |
| E4 | Enemy `ai` rows with `if`/`weight`/`target` and targeting `notRyan`; `onDefeat → flee` for cops; `knockOffPanel` removal | `BattleModel` / `BattleAI` | Fixed move rotation per enemy; cops die normally; KRAAANG never removes. |
| E5 | `GameState.meter` carryover `floor(meter/2)`; reset on caption, load, and scene-changing teleports | `GameState` | Meter resets to 0 every battle. |
| E6 | `{var:name}` text markup (substitutes `vars.name` / `money`) | `DialogueBox` | Fixed text ("a very long band agreement"; "several billboards"). |
| E7 | `set` with simple arithmetic (`"vars.contractPages": "3 + vars.saveCount"`) | `EventRunner` | `inc` `vars.contractPages` by 1 inside `bajonka_save`, seeded at 3. |
| E8 | `caption` `style: "tape" \| "flyer"` | `ui.caption` | Plain centered caption. |
| E9 | `insert <sprite>` command: a centered 128×72 window showing a sprite (flyer, itinerary) above a narrator line | `UIScene` | Narrator line only. |
| E10 | `say` option `collapse: true` (Dad's window collapses 56→0 px in 4 frames on the next command) and `shake: true` on `ryan_caption` | `DialogueBox` | Normal page end; no caption shake. |
| E11 | Dad's `who: "dad"` renders the FF gradient window (`ffwin_*`), name tag VANGUARD INTERCOM; `ryan_caption` renders the inverted window at x 8..136, y 28..52 with instant text | `DialogueBox` | Dad uses the flat window; captions use the flat window at the normal position with a `[ ]` text style. |
| E12 | Camera effects `camera bend <frames>`, `camera tear <px>`, `camera mosaic <frames>` | `ExploreScene.camera` / `BattleScene` | bend → `shake 600 0.03`; tear → `shake 300 0.03`; mosaic → fade. |
| E13 | `save` with `{"auto": true}` (silent autosave to the active slot) and a `prompt` string for the Bajonka clipboard title | `EventRunner` / `GameState` | No autosave before City Sound; default prompt. |
| E14 | Follower sprites (party members trail the leader on the map) | `Entities` / `ExploreScene` | Only the leader is drawn; cutscenes `spawn` the others where needed. |
| E15 | `object` entities with `sprite` sheets larger than 16×16 (CRASH 64×24, KRAAANG 96×24, soundwave 256×32, billboards 96×48, kit 32×32, Eternity 64×64 in battle) and a 16×32 tall NPC | `MapLoader` / manifest | Compose from 16×16 tiles on the `deco` layer; the Eternity at 48×48. |
| E16 | Map `onEnter` scripts with a `condition` (CS-13 on re-entering Room 4) | §5.2 | A one-tile `trigger` at the spawn point with the condition. |
| E17 | Night dressing: a map-level `overlay` color at depth 50 toggled by a flag | `MapLoader` | A second map JSON `street_cedar_night` sharing the layers. |
| E18 | Battle-side destruction sequence (roof peel, wall blow, crowd scatter) driven from the `win` of `ep0_palmers_set` before `onDone` | `BattleScene` | A fade to black and the rubble map does the storytelling; keep the three words. |
| E19 | `shop` buys as well as sells, with per-item `sellPrice` and a `refuse` list for key items | `shops.json` / `MenuScene` | Sell at half price, no refusals; the pedalboard sells for $11 via a script `take` + `give money`. |
| E20 | Sequencer `onBeat(bar, beat)` for the cosmetic beat lamp | `Sequencer` | Lamp blinks on a fixed BPM timer or is removed. |
| E21 | Status-driven and HP-driven battle-sheet swaps for Lucky (`_rage`, `_deflated`, `_bruised`, `_flare`) | `BattleScene` | Only the `ko` frame changes. |
| E22 | `FreefallScene` steering, billboard painting, `vars.billboardsTagged`, skippable after 8 s | `FreefallScene` | 12 s non-interactive autoscroll, `billboardsTagged = 5`. |
| E23 | Menu `menu` key gains `KeyC`; `KeyM` mute and `KeyF` fullscreen toggles | `config.js` / `main.js` | Esc only. |

Tests: `tests/battle.test.mjs` must cover E1–E5 (each scripted battle end to end with a seeded RNG, including the round-8 and wipe backstops of The Chorus and the round-6 backstop of THE SET); `tests/data.test.mjs` validates every id in this document resolves.

## Risks & cuts

| Risk | Mitigation / cut |
|---|---|
| The scripted battles need the §8 extensions (E1–E4). | Amend §8 before `BattleModel` grows further; all additive; `onAction`/`onToon` can be polled from `onTurnStart`. |
| Toon 4 presentation is the most expensive visual. | Cut order: palette-cycled background → torn 9-slice → the strip roof peel (row fade instead) → never the 64-px Ryan and the three words. The words are the scene. |
| The roof-peel strip animation is the most complex presentation code in the slice. | Cut to the 4-step row fade to `sky_hole` with the same SFX. Keep the wall blow and the cymbal shake; those are cheap. |
| `FreefallScene` is bespoke. | 12-second non-interactive autoscroll with the contrail pre-painted; keep the sunglasses. |
| 28-strip TileSprite waves (border bend, Toon 3 background) may cost on low-end WebGL. | 14 strips of 16 px, or a 2-frame offset flicker. |
| Baking 8 palette phases × every background at boot delays the title. | Bake lazily on first use; the title needs none. |
| The Eternity's 48 runtime frames in one sheet. | 6 frames alternating two palette variants every 10 frames. |
| Mid-battle ally entrance (Phoenix) and ally-as-hazard (Ryan). | Phoenix joins before B-1; Ryan's Fill becomes a fixed per-round `onRound` event. |
| 64×64 Eternity and the 16×40 hardware stack break the 16×24 assumption. | Hardware as a separate object moved in lockstep (already the plan); Eternity at 48×48 if the sheet is the blocker. |
| Buzzkill can feel like eaten inputs. | Suppressed on round 1, capped at 20%, lives in two scripted fights only. If testers hate it, 10% and put the lines on his successful turns. |
| A L4 party can lose THE SET before The Eternity. | `onRound(6)` backstop, `notRyan`, the fridge Hotdish, pawn Hand Warmers; if still too hard, Backup Cop ATK 8 → 7. |
| A L2 party at the AUDITION wipes ~21% of the time without items. | Two hub enemies sit in chokepoints so L2 is the floor; the Hotdish and $4 of pizza exist for this case. Acceptable for a first boss. |
| Bounded XP means no grinding. | Intentional: required fights are tuned for L4 / L5; the Billboard and the night hub are the catch-up. |
| 19 songs is a lot of chiptune. | Cut `sticker_hallway`, `six_inch_stage`, `plaster_dust`, `game_over` to filters of existing songs. `title`, `battle`, `four_dollars`, `pocket`, `rhythm_achieved` are not cuttable. |
| ~75 flavor lines of NPC/object text. | Cut order: Palmer's crowd (keep 6), night extras, the ska band, Room 4 tallies. Never cut: the bills, the Pizza Luce box, the billboard, Billy's pod, the jukebox. |
| `rooftops` is a cutscene-only map. | Three captions over black; keep the garage (used twice; it is the Ryan hook). |
| SLIMED, BAKED and Band Sticker are low-value systems. | Cut all three first; no script depends on them. |
| Playtime over 75 min. | Day hub to Slush + Scooters + Analyst; night hub to one encounter; trim Palmer's crowd lines. Never cut the quit or the keys. |
| The weed sale reads as a gag with no consequence. | Phoenix's Palmer's line ("We sold the weed for this." / "We kept the weed for this.") keeps it honest. |
| The quit choice (RAGE / PLEAD / JOKE) promises branching it does not deliver. | That is the point; `vars.quitResponse` is read once in Chapter 2 — Phoenix remembers which one you picked. |
| Shipped art and song ids drift from this document. | This document uses the shipped ids (`dental_plan`, `west_bank`, `ryan_slimed`, …); any new id is added here first. |

## Appendix: decisions and sources

Each contradiction between the three proposals (S = `design_systems.md`, L = `design_levels.md`, F = `design_feel.md`) and the comic/story bibles, the decision, and why.

1. **Party side.** L put the party on the left, S and F on the right. **Decision: enemies left, party right** (FF convention, pillar 4). F's HUD pixel map is built on it and the SETLIST reads left-to-right into the party column.
2. **The shared meter's name and rules.** S: a 0–100 TOON meter with NOISE words; F: a 16-segment "Pocket gauge" filled by on-beat confirms in band fights only; L: a "POCKET gauge" filled by every party action. **Decision: one mechanic, one name — the TOON meter** with S's fill table, costs and NOISE words. The band-fight thresholds (the tear, Ryan's Pocket form, The Eternity) are `onToon(level)` hooks on the same bar; "Pocket" survives only as Ryan's form and Sync name. F's on-beat input bonus is cut (it made the slice a rhythm game and needed sequencer-to-HUD timing); the beat lamp stays as a cosmetic, cuttable detail. S's numbers were simulated; the others were not.
3. **Where Bajonka saves.** L: she is a save point everywhere from the alley on ("already everywhere before she's introduced"); S and F: from City Sound on; F: no autosave. **Decision: she saves from the City Sound hallway on** (the comic introduces her there, with the clipboard, and the clipboard gag only works once she has been seen); she appears as a silent non-interactive cameo in the alley and on the apartment couch arm (L's gag, cheap, one line each); **autosaves** at three points before City Sound (S) so a hub death does not replay the pod bay. L's `saveCount` → contract-pages gag is kept.
4. **Battle list and count.** S: 11 tuned encounters (8 street + 3 scripted); L: ~10 street fights (drones, Intern, Scooter, night cop duos) + 3; F: ~12. **Decision: S's 11**, because they were tuned by simulation against the XP table and the stat growth. L's Intern is folded into S's Demographic Analyst (same joke; F's intern art description applies); L's night cop duos are cut (cops are saved for Palmer's) in favor of S's night Analyst Duo and Goose Pair; L's night dressing is kept.
5. **Brian's join.** L: outside the café, triggered by leaving, with a three-way flyer-text choice; S: inside the café, Brian already reading the flyer; F: Brian at a window table. **Decision: inside the café** — Phoenix's flyer goes up with L's three-way text choice, then Brian stands up from F's window table on the way out and answers by `vars.flyerText` (L's lines). The "stickers / turn the bass down / I'm not a 'man,' Brian" exchange plays once here and once in Room 4 (the comic has it in Room 4 a month later; Lucky's note has Brian at the coffee shop; both land because the second is Brian repeating himself, which is the character).
6. **Who gets Ryan in the room.** All three agree with Lucky's tweak: the signal froze him; Brian's phone call moves him. L's landline in the garage and "Ryan. It's Brian. From the Zappa cover band." are used; the `story_setpiece.md` Subaru road trip and `story_structure.md` text message are not (a cutscene map we already have beats a drive).
7. **Palmer's as Phoenix's workplace.** Comic page 3 puts the alley behind the dive bar with Phoenix on trash duty; L makes it explicit. **Decision: yes** — "Where I work. Yes. My brain thinks this is fine." and the bartender's "Phoenix, you're not on tonight."
8. **Freefall scope.** S: 20 s steering; L: ~55 s; F: 90 s max. **Decision: 24 s, steerable, skippable after 8 s, five billboards, no fail state**, with F's rendering notes. S's "glitch 3+ ⇒ tutorial at Toon 1" bonus is cut (it coupled the minigame to battle tuning). Fallback stays a 12 s cutscene.
9. **Dialogue box style.** F's Earthbound-flat zine window with the mood-colored inner rule; the FF blue gradient only for Dad (and future Vanguard voices); Ryan's inverted caption window. S and L had no opinion beyond §12.2. **Decision: F's**, at §12.2 geometry.
10. **Resource names.** S: HP / AMP / TOON, commands STRUM / RIFF / NOISE / ITEM / TUNE / BAIL; L: ATTACK / RIFF / ITEM / HOLD / BAIL with a POCKET gauge; F: STRUM / RIFF / TUNE / ITEM / BAIL with TUNE +2 AMP. **Decision: S's six commands and names**; TUNE gives +4 AMP (S's simulation) not +2.
11. **XP table and levels.** S: L1–8, cumulative 0/10/24/48/85/135/200/275 with a full stat table; L and F: "levels 1→6" with no numbers; the shipped `characters.json` has a 20-entry placeholder table. **Decision: S's table and stats** — they are the only tuned numbers — and the data file is updated to them (its L1 stats and growth change too).
12. **What happens on a loss in scripted fights.** S: AUDITION and THE SET losable, Chorus not addressed; L: THE SET cannot be lost ("a full-party KO just makes the rest a drum solo"); F: THE SET is an unstoppable scripted win. **Decision:** AUDITION losable (it is the first boss and the items exist for it); The Chorus **cannot** be lost (a wipe fires the KRAAANG); THE SET losable **until `eternityArmed`** (Toon 3 or round 6), unlosable after. Losses go to Game Over → Continue from the last save, which is at most one set piece back.
13. **The quit choice.** L: RAGE / PLEAD / JOKE, every branch "Yep."; F: the same plus PLEAD swapping Lucky to deflated for the walk; `story_setpiece.md`: "three responses, all magenta, all wrong". **Decision: L's three choices, F's deflated walk on PLEAD**, no mechanical consequence in the slice, `vars.quitResponse` stored for Chapter 2. The branch exists to make the player pick a wrong answer; that is the scene.
14. **Toon 4 trigger.** S: `onToon(3)` or round 6; L: a 100% gauge; F: Pocket segment 16; `story_setpiece.md`/`story_structure.md`: a LET GO choice for Ryan. **Decision: S's** (deterministic backstop; the player never controls Ryan, so no LET GO prompt — the player's inputs raise the meter, which is the same choice without a menu).
15. **AUDITION length and enemies.** S: 7 rounds, WHRNNNG 64 px + THUD-THUD 48 px; L: 6 rounds, THUD-THUD ×2; F: 8 rounds, regenerating walls. **Decision: S's 7 rounds and roster** (simulated); captions at onStart, round 3 and round 5 (S) rather than 1/3/5 (L) or 2/5/7 (F).
16. **THE SET's enemies.** S: Cop + Backup ×2; L: Cop + CROWD HOSTILITY mood enemy + Riot Cop ×2; F: Cop + Officer Khaki ×2 + a crowd-hostility loss gauge. **Decision: S's** — the crowd is the background strip and the scatter sequence, not a combatant; a second loss condition on top of a short fight was not worth a system.
17. **Ryan's battle sprite size.** F: 48×48 possessed sheet at the kit; S: 32×32. **Decision: 32×32** `ryan_slimed` in party slot 3 with the kit as a separate 32×32 object behind him, so the party sheet convention holds; the Eternity stays 64×64 (the splash page).
18. **Phoenix's join and instrument.** S and L: joins mid-battle in round 2 of the drone fight; L: with a P-Bass; S: with the Trash Bag, the bass found in the apartment. **Decision: joins in round 2 (E2 `join`) with the Trash Bag and Hoodie; the Beat-Up Bass is on the apartment stand** — the trash bag is the comic's image and the bass is a reason to press on things at home.
19. **Hub and shop names.** S: "Grounds for Dismissal", "Lake Street Pawn & Loan", `street_west_bank`; L: "Hard Luck Café", "Cedar Pawn & Loan", `street_cedar`. **Decision: L's names and map id** (L's flavor lines reference them; Cedar Ave is the hub). The pawn shop has **no interior map** — the door runs the shop (S's Sticky-under-a-tarp seed moves to the shop window line).
20. **Palmer's exterior.** S and F: a `palmers_ext` map; L: the door on the hub. **Decision: no exterior map** — the night hub is the exterior (neon, the tall stranger, the smoker, Bajonka by the door as the save).
21. **Song ids.** S, L and F each named cues differently; the audio agent has shipped F's ids. **Decision: F's ids everywhere** (`dental_plan`, `flying_squirrel`, `pothole`, `unpaid_bills`, `ask_the_universe`, `northern_garage`, `west_bank`, `normal_music`, `sticker_hallway`, `four_dollars`, `six_inch_stage`, `pocket`, `rhythm_achieved`, `plaster_dust`, `win_sting`, `game_over`) plus the engine's `title`, `snow`, `battle`. `normal_music` serves both the coffee shop and The Chorus (F's economy). The alley uses `pothole`; `snow` covers the first street pass and the night pass (no separate `snow_night`).
22. **Lucky's map palette: HP-driven or story-driven.** L: by leader HP (three tiers); S: by HP with rage lock; F: by story flags only. **Decision: story flags only on the map** (the HP tiers made the walk-around flicker and duplicated the menu); **HP- and status-driven in battle** (S's and F's battle swaps).
23. **Lucky's rage color.** The first shipped `lucky_rage` was red-orange; Lucky's tweak and all three proposals say magenta. The shipped sheet is now magenta `#ff1aa0`; the appendix records it so nobody "fixes" it back.
24. **Money at start.** L: $0 → $4 when Phoenix joins; S and the shipped `start.json`: $4. **Decision: $4 from the start** (one fewer command; the "four dollars" line stays true).
25. **The slap verb.** F proposed a context "slap" action. **Decision: cut** — the speaker and EJECT are ordinary interact scripts; the pseudopod is an animation.
26. **Items and prices.** The shipped `items.json` (Pizza 30 HP / $5, Coffee 10 AMP / $3) predates the simulation. **Decision: S's table** (Pizza 20 HP / $3, Coffee +6 AMP / $4, etc.); data is updated. L's Duct Tape, Cheap Beer and $40 cymbal, and F's Jumbo Slice and Political Stickers accessory, are cut (S's Band Sticker covers the sticker gag; the ride cymbal is a key item).
27. **Dad's extra lines and Billy seeds.** `story_structure.md` adds "that Ruben kid" to Dad; L seeds a pod nameplate "RESERVED — RUBEN, B." and Lucky's "My old band's still back there." **Decision: L's seeds only** (optional, one line each, no new plot); the comic's Dad lines are verbatim and unchanged.
28. **The "ONE MONTH BEFORE THE POTATO BELT TOUR" card.** All three keep it; it contradicts nothing (Lucky's itinerary says TOMORROW a month later). Kept as a duct-tape caption with Phoenix's line.
29. **Keys.** S: Menu C/M; F: Menu Esc/C, Cancel X/Backspace; shipped `config.js`: Menu Esc, Cancel X/Backspace. **Decision: F's table + shipped config**, with C added to menu, M mute, F fullscreen.
30. **Chapter length.** Scene minutes come from L's reading-speed estimates adjusted to S's fight counts: ~69 min full, ~50 min skipping optional fights. Inside the 45–75 window at both ends.
