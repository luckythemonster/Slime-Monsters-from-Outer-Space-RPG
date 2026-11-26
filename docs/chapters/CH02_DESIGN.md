# Chapter 2 Design: Gig in the Potato Belt

The build document for Chapter 2. It is written from `docs/chapters/CH02_BRIEF.md`, the bible's Chapter 2, the
comic (`docs/comic-outlines/Issue 1 page outline.txt`) and `docs/PROGRESSION.md`, in the shape of
`docs/DESIGN.md`. Where this document and `docs/ARCHITECTURE.md` disagree, ARCHITECTURE wins on how it is wired
and this document wins on what the chapter is. Everything the chapter needs that the engine does not have is
listed once, under **Engine extensions required**, with a fallback.

Target: 60 to 75 minutes from CONTINUE on an end-of-Chapter-1 save to the potato in the cup holder. Estimated
66 minutes on the critical path and about 78 with every optional fight. The bible says 1.5 hours. The comic is
24 tight pages and the chapter does not pad to reach that number.

Lines in quotes are verbatim from the comic unless tagged *(new)*. Lines tagged *(new, bible)* are the bible's
own new lines. Everything tagged *(new)* can be improved.

## Pillars

1. **You can only hit hard on the beat.** The drummer who holds the beat while everything falls apart is the
   answer to the drummer who ran. The player spends the chapter being the beat (Warner's Crash, in ordinary
   fights) and then has to hit it from the other side of the stage (Lucky's GUITAR SWING, in the boss).
2. **A band of four, for one night.** The first party the player fully controls. Diego is a keeper. Warner is
   temporary and every scene he is in says so.
3. **The tour is a place.** A van, a lane, a toll, a parking spot, a trench, a ramp, a barn, a dock. Every tile
   has a joke, the way Cedar Avenue did.
4. **Lucky's color is still the HUD.** The magenta lock lifts in the first minute so that magenta can fire
   twice, on purpose: "We don't say his name" and the sun.
5. **Paid in potatoes.** No door money. The chapter ends with a sack, a notice and four dollars.

## Scene-by-scene flow

Cutscene ids (CS2-nn) are script ids under `src/data/scripts/ch02_*.json`. Battle ids are keys in
`src/data/encounters.json` and, for scripted fights, `src/engine/battle/scripts/ch02.js`. Minutes are for a
first-time reader.

| # | Scene | Toon | Map / scene | Cutscenes and battles | min |
|---|---|---|---|---|---|
| 1 | The morning after | 0 | `apartment` | CS2-01 `ch02_start` (THE NEXT MORNING; Phoenix remembers; the lock lifts) | 2 |
| 2 | The door | 0 | `apartment` | CS2-02 `ch02_door_diego` (the mohawk; Diego joins) | 2 |
| 3 | The other door | 0 | `apartment` | CS2-03 `ch02_door_warner` (the wave, a year late; Warner joins) | 2 |
| 4 | The curb | 2 | `ch02_curb` | CS2-04 `ch02_curb_van` (the van was parked there all year), CS2-05 `ch02_title` (launch, title card) | 3 |
| 5 | Driving | 1 | `ch02_van`, `ch02_lanes` | CS2-06 `ch02_van_drive` (the exit, the toll booth, the stars); the player drives the lanes | 4 |
| 6 | The name | 1 | `ch02_van` | CS2-07 `ch02_the_name` ("We don't say his name.") | 1 |
| 7 | The toll | 1 | `ch02_lanes` | CS2-08 `ch02_toll` (pay, or clip it: **`ch02_toll_booth`**, optional mini-boss) | 1 (+4) |
| 8 | Parking | 2 | `ParkingScene` | CS2-09 `ch02_parking` (the sun line; the minigame; Bajonka can park it) | 2 |
| 9 | The Belt | 1 | `ch02_descent` | CS2-10 `ch02_descent` (harvesters; "gentrified"; SQUELCH; "don't make me drive back") | 2 |
| 10 | Humidity | 2 | `ch02_trench` | CS2-11 `ch02_humidity` (MELTING; the Tupperware line); **`ch02_welcome`** (first fight as four); three on-map fights | 11 |
| 11 | The ramp | 1 | `ch02_ramp` | CS2-12 `ch02_ramp_top` (the snare on her head); save; two on-map fights; the Promoter at the door | 6 |
| 12 | Load-in | 1 | `ch02_barn` | CS2-13 `ch02_loadin` (CROP ROTATION; "I am going to bite someone."); the swap table; the farmers | 7 |
| 13 | The khakis | 2 | `ch02_barn` | CS2-14 `ch02_khakis` ("audit a mosh pit"; no visa; the sun) | 2 |
| 14 | The set | 2 | `ch02_barn` | CS2-15 `ch02_take_stage`; **`ch02_monsters`** (THE PIT; the fuzz pedal; the leg) | 4 |
| 15 | Positive ID | 1 to 3 | `ch02_barn` | CS2-16 `ch02_positive_id` (EXECUTE BREACH; the roof) | 1 |
| 16 | **Boss** | 3 | `ch02_barn` | **`ch02_riot_solo`** (three Riot Drones; the crash; the rally) | 8 |
| 17 | The dock | 1 | `ch02_dock` | CS2-17 `ch02_dock_gag` ("Hey... is that a dog?"; the wall; THUD) | 1 |
| 18 | Load out | 1 | `ch02_barn_breach` | CS2-18 `ch02_load_out` ("Show's over! Load out!"); walk the breached barn to the back hall | 2 |
| 19 | Door money | 1 | `ch02_dock` | CS2-19 `ch02_promoter` (the stress test; section 4A; the slap; the sack) | 3 |
| 20 | Orbit | 2 | `ch02_van` | CS2-20 `ch02_orbit` (the raw potato; the eviction warning; merch) | 2 |
| 21 | Stinger | 0 | `ch02_van` | CS2-21 `ch02_stinger` (the cup holder; save; title) | 1 |

Totals: 10 encounters (3 scripted on the critical path, 4 on-map fights that sit in chokepoints, 2 optional
on-map fights, 1 optional mini-boss). Party level on the critical path: 7 at the door, 9 at the stage, 10 at the
stinger; 11 with everything optional.

**Flag spine.** Gating lives only in entity and exit conditions, so `__slime.warp` and `setFlag` can jump a test
to any scene.

```
TITLE -CONTINUE (flags.ch1Complete)-> ch02_start: state.chapter = 2, ch2Started, luckyRageLocked off
apartment  ch02_door_diego -> diegoJoined (+diego, +the_mohawk) -> ch02_door_warner -> warnerJoined (+warner)
  door -> ch02_curb (the apartment's old exit is closed once ch2Started)
ch02_curb  van door [Get in] -> (autosave) vanBoarded -> title card -> ch02_van -> ch02_lanes
ch02_lanes  midway trigger -> nameSaid ; toll: tollPaid | tollClipped (cleared_ch02_toll_booth)
  exit 4B -> ParkingScene -> parked (vars.parkTries, flags.bajonkaParked) -> ch02_descent -> landed (+word squelch)
ch02_trench  ch02_humidity -> melting ; ch02_welcome -> beatTaught, cleared_ch02_welcome ; -> ch02_ramp -> ch02_barn
ch02_barn  ch02_loadin -> loadedIn ; ch02_khakis -> sawKhakis ; stage [Start the set] (autosave) -> onStageBelt
  ch02_monsters -> setPlayed (vars.crowdBank += 40..60) -> ch02_positive_id -> (autosave) -> ch02_riot_solo
  -> riotWon -> ch02_dock_gag -> dogAsked, bajonkaSummon -> ch02_barn_breach -> ch02_dock
ch02_dock  ch02_promoter -> clipboardSlapped (+raw_cosmic_potatoes) -> ch02_orbit -> evictionWarned
  (+eviction_warning; money falls to 4) -> ch02_stinger -> ch2Complete -save-> TITLE
Side flags (never gate the spine): ch02_tupperwareTaken, cleared_<enemyId>, trig_<map>_<id>, tollClipped,
bajonkaParked, vars.parkTries, vars.setOnBeat, practiceSeen, sawCropRotation, boughtAtSwap.
```

## Maps

All maps use the ARCHITECTURE section 4 format. Coordinates are tile coordinates and are proposals: the build
fixes them and the playthrough test reads them from the data. "Save" is a `type: "save"` Bajonka entity.

| id | Name | W x H | Tileset | Music | Exits | Save |
|---|---|---|---|---|---|---|
| `apartment` | Phoenix's apartment (reused) | 16x14 | `interiors` | `unpaid_bills` | door -> `ch02_curb` once `ch2Started` | on the couch arm |
| `ch02_curb` | The curb outside the Towers | 16x14 | `minneapolis` | `snow` | door -> `apartment`; the van -> `ch02_van` | no |
| `ch02_van` | The van, inside | 16x14 | `space` | per scene | cutscene map on the way out; walkable in orbit at the end | asleep on the snare case |
| `ch02_lanes` | Orbital Route 4 | 56x16 | `space` | `band_spud_nothin` | exit 4B -> `ParkingScene` | no (press the menu: she is in the back) |
| (scene) | Zero-gravity parking | n/a | procedural | `ch02_parking` | -> `ch02_descent` | no |
| `ch02_descent` | Over Sector 4 | 40x14 | `belt` | `ch02_belt` | cutscene only | no |
| `ch02_trench` | The trench | 40x22 | `belt` | `ch02_belt` | N end -> `ch02_ramp`; the van (heal, save) at the S end | in the van's side door |
| `ch02_ramp` | The ramp | 16x30 | `belt` | `ch02_belt` | top -> trench; bottom door -> `ch02_barn` | top of the ramp, snare on her head |
| `ch02_barn` | The underground barn | 30x20 | `belt` | `ch02_barn` | S door -> ramp; back hall gated until the set is over | on the stage monitor once on stage |
| `ch02_barn_breach` | The barn, roof gone | 30x20 | `belt` (breach tiles) | `band_monsters` tail, then none | back hall -> `ch02_dock` | no |
| `ch02_dock` | The loading dock | 20x14 | `belt` | none, `wind` | the van ramp -> CS2-19 | in the driver's seat |

Eleven maps including the scene. Every map lists `"encounters": { "rate": 0, "pool": [] }`: on-map enemies only.

### `apartment` (reused)
The Chapter 1 map with Chapter 2 entities under `condition: flags.ch2Started`. The old door exit gains
`condition: !flags.ch2Started`; a twin exit leads to `ch02_curb`. The Chapter 1 enemies and triggers on the hub
are never reached from Chapter 2.
**New interactables.** Kitchenette cupboard: "Two containers with lids that fit. In this apartment that is a
miracle." Gives Tupperware x2 (`flags.ch02_tupperwareTaken`). Lucky's bin: "It's a bin. It kept you overnight.
It is still warm and slightly pink." The couch: "Nobody is napping. The tour is today." Diego, once joined,
stands by the window: "That billboard has never blinked, man. That's not healthy for a billboard." Warner, once
joined, stands by the posters: "You have a Rat Fight poster. We made four of those." Bajonka on the couch arm is
the save point. Before both have joined, the door refuses: Phoenix: "My brain thinks a band is more than two
people. My brain has read about it."

### `ch02_curb` 16x14
The sidewalk in front of the Towers, the morning after. Snow. The van (a 48x32 object, the Chapter 1 `van_*`
tiles redrawn as one sprite with thrusters) at (7..9,8). Caution tape across the west edge, where Palmer's was:
"PALMER'S (FORMERLY)." A man with a clipboard measuring the hole, far off, never reachable. **Spawn** (12,7)
from the apartment door.
**Interactables.** The van's side: "A spiral. Neon green. It drips. It has been dry for a year." The thrusters:
"Welded to the bumper. The welds are signed with a paw print. No. That is rust." The mirror: "Duct tape, load
bearing." The Towers sign: "RENT DUE. ALSO: FINAL NOTICE. ALSO: RENT." The tape: Phoenix: "My brain thinks I
still work there. My brain thinks there is no there."
**Triggers.** `onFirstEnter` -> CS2-04. The van door (8,9): "Get in? [Get in] / [Not yet]". [Get in] autosaves
and runs CS2-05.

### `ch02_van` 16x14
A cutaway interior: cockpit to the east (two seats, the wheel, the cracked tablet), a bench, amps, drum
hardware and empty coffee cups to the west, the sliding door on the south wall. Padded with solid dark tiles to
fill the viewport. Used as a cutscene map on the way out (CS2-06, CS2-07) and walkable in orbit at the end
(CS2-20, CS2-21).
**Interactables (orbit).** The tablet: "VANGUARD NAV. RECALCULATING. RECALCULATING. PLEASE REMAIN A CUSTOMER."
The tape deck: "It plays one tape. It is theirs." The coffee cups: "Eleven. Two are structural." The bag: "The
Tinny Ride. It rides in the bag. Nobody plays it." The sack: "VANGUARD PROPERTY: RAW COSMIC POTATOES. It is
warm. It is not supposed to be warm." The cup holder: CS2-21.
**Save.** Bajonka asleep on the snare case: "She initials it without waking up."

### `ch02_lanes` 56x16, Orbital Route 4
The player's sheet is the van (`van_map`, 32x24, one tile of collision). Followers are hidden. A two-lane
orbital road, three tiles wide, running west to east between guard buoys, with a starfield under it. The road
bends twice so the drive is not a straight line. Nothing on this map can hurt the van.
**Signs, west to east.** "ORBITAL ROUTE 4. SPEED LIMIT: ASPIRATIONAL." A WORK IS LOVE billboard, in space:
"WORK IS LOVE. Now in orbit." A hitchhiking asteroid with a thumb, never explained: "It has a sign. The sign
says DULUTH." "REST AREA: CLOSED FOR PRODUCTIVITY." "TOLL PLAZA AHEAD. HAVE YOUR DEMOGRAPHIC READY." After the
plaza: "EXIT 4A: POTATO BELT (NORTH). NO SERVICES." "EXIT 4B: POTATO BELT, SECTOR 4. NO SERVICES. NO
LOITERING. NO." A last one past the exit, if the player overshoots: "NEXT EXIT: 900 LIGHT-YEARS." The road
loops the van back.
**Triggers.** Midway (x 20) once -> CS2-07. The toll plaza at x 34: a staffed lane and a lane too narrow for the
van (CS2-08). Exit 4B at the east end -> CS2-09.

### `ch02_descent` 40x14, cutscene strip
Yellow smog; rows of glowing crops to the horizon on the bottom rows; three combine-harvesters on the `over`
layer, each bigger than the screen, with threshers, exhaust and searchlights; a dark trench between two fields.
The van crosses on a camera pan. No player. Cut fallback: three captions over the `belt` battle background.

### `ch02_trench` 40x22
A muddy trench running south to north between two walls of glowing crop rows. The van is parked at the south
end (side door open: full heal, save). Green fog on the `over` layer. An irrigation main runs along the west
wall with three valves. A red light at the north end marks the silo. Mud tiles slow nothing: the joke is the
sound (`squelch` every fourth step).
**Interactables.** The crops: "They glow. They hum. One of them is looking at you. Do not hit the crops." A
valve: "IRRIGATION: ON. HUMIDITY: YES." A boot in the mud: "A boot. Size: cybernetic." A Vanguard stake:
"SECTOR 4. YIELD IS LOYALTY." A scarecrow post with no scarecrow: "The post is empty. That is worse." Tire ruts:
"Other vans. Other bands. The ruts go in. Fewer come out." The fog: Phoenix: "My brain thinks I am 9% trench."
**Enemies.** `ch02_welcome` (scripted, a trigger band four tiles north of the van, once): two Sprinkler Drones
and a Scarecrow Unit. `gnats` Glow Gnats x3, `wander` at the first bend, in the chokepoint. `seed_drills` Seed
Drill x2, `patrol` across the narrows before the north exit, in the chokepoint. `thresher` Thresher Arm,
`static`, hanging into a side pocket of the trench over a crate: "It's idling. Fight it?" [Yes / No] (optional;
the crate holds a Rebar Corn Dog and $6).
**Triggers.** `onFirstEnter` -> CS2-11.

### `ch02_ramp` 16x30
A steep plank ramp going down, drawn as a tall map the player descends north to south, under strings of work
lights. The mud gives way to rusted silo plate. Phoenix's follower sheet leaves a gray drip trail here
(cosmetic, `obj_drip`).
**NPCs.** Bajonka at the top (1,3) with a snare drum on her head (`bajonka_snare`): the save point. "She is
carrying the snare. She is also carrying the clipboard. Do not ask where." A farmer on a smoke break (10,12):
"Sixteen hours on the thresher. Then this. This is the good part." A kid farmer (5,20): "Is the pink one the
singer? My arm wants to know." The Promoter at the silo door (8,27), trench coat, neon-blue cigarette, not yet
named: "Load-in's through there. Play like something's chasing you." *(new)* Second press: "Door money's after.
It's always after." *(new)*
**Enemies.** `duster` Crop Duster with two gnats, `chase` sight 5 at the first landing, in the chokepoint.
`sprinklers` Sprinkler Drone x2, `patrol` on the second landing, in the chokepoint. `hose` Feral Hose, `static`
coiled beside a gear crate: "It's twitching. Fight it?" [Yes / No] (optional; the crate holds a Gas Station
Coffee and a Tupperware).

### `ch02_barn` 30x20
A hollowed-out grain silo. The door is south (15,19). The pit is the middle of the floor (8..20, 8..15). The
pallet stage is east (22..27, 6..13), one tile raised on a `deco` step edge, with Phoenix's 4x10 cabinet (26,8),
the kit (25,10), the mic (23,10), a monitor (23,12) and Lucky's pedalboard (24,7). A bar made of a feed trough
along the north wall. The swap table in the northwest corner. A back hall behind the stage (28,9), closed until
the set is over. Harsh work lights on the `over` layer. **Spawn** (15,18) facing up.
**NPCs.** Eleven farmers on four builds (tiller hand, welding-torch arm, auger leg, sprayer pack), each with a
line: "I planted eleven thousand today. I want to be hit by a sound." / "My left hand is a tiller. My right hand
is tired." / "They pay us in yield. We are the yield." / "Play something I can lift to." / "I hear the last band
did not pass. Pass what? Nobody says." / "Is that a real guitar? Mine is a rake." / "Woo." / "Earlier I said
woo. I stand by it." / "Don't stand under the roof. I welded it." The welding-arm worker (12,12) is CS2-13's:
after it, "Still deciding who." The bartender (a farmer with a tap for a hand): "Beer is two. It is made of what
everything is made of." (Flavor only. It is not sold.) Two khaki agents at the pit's edge (20,14) and (21,15),
`npc_agent_a` and `npc_agent_b`: "We are also here for the... gig." *(new)* / "I am not headbanging. This is not
headbanging. Write that down." *(new)* CROP ROTATION, the opening band, on the stage until CS2-13 ends and
beside it after: three farmers who play a rake, a feed drum and a tiller. "We're Crop Rotation. We go on first.
Then we go on shift." / "The tiller is in drop D." / "We have a tape. It is also a seed catalog."
**Interactables.** The swap table -> `shop ch02_swap`: "Gear from bands that came through. They left in a hurry.
Their loss. Your price." The roof, looked at from the pit: "Rusted plate. One weld. It is holding." A support
beam: "Old wood. It has opinions about bass." A trampled flyer: "TONIGHT: CROP ROTATION + SLIME MONSTERS FROM
OUTER SPACE. DOOR: ASK." The trough: "It was for feed. It is still for feed."
**Triggers.** `onFirstEnter` -> CS2-13. A band of tiles along the pit's east edge, once -> CS2-14. The stage
steps (22,10), after CS2-14: "Start the set? [Start the set] / [Not yet]" -> CS2-15. The south door closes once
`onStageBelt`.

### `ch02_barn_breach` 30x20
The same footprint with the roof gone: sky-hole tiles over the pit with smog and searchlights, slabs of roof
plate on the floor, the pit empty, three drone wrecks sparking, red lasers cutting the dust at the south door
(solid: "The raid is coming through the front. Go out the back."). The stage is splintered. One clipboard lies
in the mud of the pit: "A clipboard. Trampled. Nobody is coming back for it." The trough: "The bar survived. The
bar always survives." The back hall (28,9) is the only exit. No enemies. No timer.

### `ch02_dock` 20x14
Dark and muddy. The van is backed up to the dock with its rear doors open and a loading ramp down. Rusted
barrels along the north wall. A trash can at (5,6) with two armored legs sticking out. The Promoter stands by
the van (12,8). The sack sits at the top of the ramp (14,6). **Spawn** (2,8) from the back hall.
**Interactables.** The trash can: "A guard. Folded. He is breathing. He is filed." A rifle in the mud: "It
clattered. Then it stopped." The barrels: "Rusted. Something was dragged behind them and then dragged back out."
The bass cabinet in the van: "One hundred pounds. Strapped in with a bungee cord. There are tooth marks on the
strap." Bajonka in the driver's seat is the save point: "She is in the driver's seat. Her paws do not reach the
pedals. The engine is running."
**Triggers.** Approaching the Promoter -> CS2-19.

## Cutscenes

Shorthand as in `docs/DESIGN.md`: `say who "text"`, `set a`, and so on. Commands the engine does not have are
marked **[EXT]**. Portraits are `<who>_<mood>`.

### CS2-01 `ch02_start` (chapter entry) Toon 0
1. Black. `set chapter 2, flags.ch2Started`; `party heal`; meter to 0. `caption "THE NEXT MORNING" style:tape`.
2. `teleport apartment`. Lucky is asleep in the bin on the `lucky_rage` sheet. Phoenix is on the couch with a
   coffee. Bajonka is on the couch arm. `music unpaid_bills`; `camera fade in`.
3. `say narrator` "Morning. Lucky slept in the bin. The bin is still magenta." *(new)*
4. Phoenix remembers, once, by `vars.quitResponse` *(new, all three)*:
   - RAGE: "My brain thinks you yelled at a man for being scared. My brain also thinks you meant it. It is not
     sure those cancel out."
   - PLEAD: "My brain thinks you asked for one more show. My brain thinks that is the only time I have heard
     you ask for anything."
   - JOKE: "My brain thinks 'weather event' was funny. My brain thinks you said it so you would not say the
     other thing."
5. `say lucky portrait:lucky_deflated` "...I know." *(new)*
6. The lock lifts here: `sprite player lucky`; `sfx slime_pop`; `set flags.luckyRageLocked false`.
   `say narrator` "The color goes down on its own." *(new)*
7. `say phoenix` "My brain thinks the tour is today. My brain thinks we are two people." *(new)* /
   `say lucky` "We have a van." *(new)* / `say phoenix` "We have keys." *(new)*
8. `sfx door` three times. -> CS2-02.

Why the lock lifts there: sleep did not do it. Being remembered accurately did. And the chapter needs magenta
free, because it has to arrive twice as an event (scenes 6 and 13) and it cannot arrive if it never left.

### CS2-02 `ch02_door_diego` Toon 0
1. `move player` to the door; the door opens on a man who fills the frame (`diego`, 16x32). He is holding a
   glued mohawk.
2. `say diego` "Man, I think this is yours? Also I play guitar. The vibes last night were heavy." *(new, bible)*
3. `say lucky` "That is a cop's hair." *(new)* / `say diego` "Whoa. Then it's nobody's. That's heavy too."
   *(new)*
4. `say phoenix` "My brain thinks he said guitar." *(new)* / `say lucky` "Can you play loud?" *(new)* /
   `say diego portrait:diego_peace` "I can play whatever the room is feeling, man." *(new)* /
   `say lucky` "The room is feeling loud." *(new)* / `say diego` "Right on." *(new)*
5. `give the_mohawk` (toast "Got The Mohawk. It is evidence. It can be worn."); `party add diego` at Lucky's
   level and XP; toast "Diego joined."; `set flags.diegoJoined`.
6. `say phoenix` "My brain thinks we still don't have a" and the line is cut by `sfx door_soft`, twice. -> CS2-03.

### CS2-03 `ch02_door_warner` Toon 0
1. The door again. Warner, stick bag, looking at his shoes.
2. `say warner` "Is this the band from the... the wave? Sorry, I had midterms." *(new, bible)*
3. `say phoenix` "You were at Palmer's. You threw up by the wall." *(new)* /
   `say warner portrait:warner_sorry` "That was me. Sorry. We were Rat Fight. We broke up again." *(new)*
4. `say warner` "When the roof went last night, I knew it. I felt that same thing a year ago. In Duluth. I was
   studying. I meant to come." *(new)*
5. `say phoenix` "My brain thinks the universe has a one-year turnaround." *(new)*
6. `say lucky` "You're a singer." *(new)* / `say warner` "I'd rather be behind something." *(new)*
7. `say lucky` "You cool with playing fast?" (Lucky's own line from the audition.) /
   `say warner` "Sure. Yes. Until finals." *(new)*
8. `say narrator` "He said 'until.' Everyone heard it." *(new)*
9. `party add warner` (guest, pinned to Lucky's level); toast "Warner joined. For now."; `set flags.warnerJoined`.
10. Bajonka hops down, walks to the door and sits. `sfx sneeze`. Control returns. Phoenix, Diego and Warner
    follow.

His door line works for someone who was in the room: he felt the wave a year ago without knowing whose it was,
and last night he recognised it.

### CS2-04 `ch02_curb_van` (`ch02_curb.onFirstEnter`) Toon 1
1. `say narrator` "A van. No plates. A spiral on the side. It has been parked here for a year." *(new)*
2. `say phoenix` "My brain thinks nobody on this street owns a van." *(new)*
3. `say diego` "Oh, nice. I painted that." *(new)* / `say lucky` "You painted a stranger's van." *(new)* /
   `say diego` "It looked like it needed it, man." *(new)*
4. Lucky tries the keys: `sfx item`. `say narrator` "The keys fit. The thrusters are welded to the bumper. The
   mirror is duct tape." *(new)*
5. `say phoenix` "My brain thinks this is not a space vehicle." *(new)* / `say lucky` "It's a tour vehicle."
   *(new)*
6. Bajonka jumps in the back. Control returns.

### CS2-05 `ch02_title` (van door, [Get in]) Toon 2
1. Autosave. `set flags.vanBoarded`. Everyone boards. `sfx thruster`; the van object shakes 1 px, lifts and
   leaves the top of the screen; `camera flash`.
2. **[EXT]** `card`: the title card. A starfield (`space` pattern), a nebula band, the van crossing left to
   right with thruster flicker, and the text SLIME MONSTERS FROM OUTER SPACE / CHAPTER 2: GIG IN THE POTATO
   BELT. `music band_spud_nothin` starts on the card. Hold 3600 ms, skippable after 1200.
3. -> CS2-06.

### CS2-06 `ch02_van_drive` (`ch02_van`, cutscene) Toon 1
1. Interior. Phoenix at the wheel, both hands. Lucky in the passenger seat with the tablet, stressed pink.
   Bajonka asleep on the snare case. Diego at the window.
2. `say lucky` "Take the next orbital exit, Phoenix. And don't clip the toll booth, I don't want to know who
   Bajonka stole this van from."
3. `say diego` "Man, the stars out here are heavy. Really makes you feel small, you know?"
4. `say warner` "Is there a seatbelt back here? There's a bungee cord. Is the bungee cord the seatbelt?" *(new)*
   / `say phoenix` "My brain thinks the bungee cord is the airbag." *(new)*
5. `teleport ch02_lanes`. Toast "You're driving. Route 4, east." Control.

### CS2-07 `ch02_the_name` (lanes, midway, once) Toon 1
1. Cut to the interior. `music` ducks **[EXT]**. `say narrator` "Warner has been quiet for forty exits." *(new)*
2. `say warner` "So, uh. Ryan" and the line is cut. *(new, bible)*
3. `sprite lucky lucky_rage`; `sfx slime_pop`; `camera shake 200`.
   `say lucky portrait:lucky_rage` "We don't say his name." *(new, bible)*
4. `say warner` "Cool. Cool cool cool." *(new, bible)*
5. `wait 1400`. Nobody speaks. Diego looks out the window. `sprite lucky lucky`. Music back up. Back to the
   lanes. `set flags.nameSaid`.

Nothing else about him is said in this chapter, in dialogue, narration or item text.

### CS2-08 `ch02_toll` Toon 1
The plaza sign: "VANGUARD ORBITAL TOLL AUTHORITY. TOLL: $6. EXACT DEMOGRAPHIC REQUIRED."
- **The staffed lane.** A booth with a speaker. "WELCOME. THE TOLL IS SIX DOLLARS." It takes $6, or all the
  money if there is less than $6: "INSUFFICIENT FUNDS. PLEASE REMAIN POOR. PROCEED." `set flags.tollPaid`. The
  gate lifts.
- **The narrow lane.** `say narrator` "The other lane is one van wide. Minus a mirror." *(new)* Then: "Clip the
  toll booth? [Clip it] / [Don't]". Before the choice, once: `say phoenix` "My brain thinks we would lose."
  *(new)* [Clip it] -> **`ch02_toll_booth`**. On a win: `set flags.tollClipped`; `say lucky` "...I said DON'T
  clip it." *(new)* / `say phoenix` "My brain thinks it clipped us." *(new)* The gate arm is gone. On a loss:
  Game Over, and CONTINUE returns to the curb autosave.

### CS2-09 `ch02_parking` (exit 4B) Toon 2
1. A sign: "SECTOR 4 DESCENT BY VALIDATION ONLY. PARK TO VALIDATE." One space is left, between two grain haulers
   the size of city blocks.
2. `say phoenix portrait:phoenix_my_brain_thinks` "My brain thinks if I have to manually parallel park this
   thing in zero gravity, I am going to walk into the sun."
3. `scene parking` (see **Parking**). It cannot be failed. After three bumps: "Let Bajonka park it? [Yes] /
   [No]". [Yes]: one paw on the wheel, a perfect park, back to sleep; `set flags.bajonkaParked`.
4. After: parked clean on the first try, `say phoenix` "My brain thinks nobody saw that. My brain is furious."
   *(new)* Parked after bumps, `say phoenix` "My brain thinks those were already there." *(new)* Bajonka parked
   it, `say phoenix` "My brain thinks we should not discuss this." *(new)*
5. The kiosk prints: "VALIDATED. DWELL TIME: 0:00. YOU ARE ALREADY LATE." -> CS2-10.

### CS2-10 `ch02_descent` Toon 1
1. `music ch02_belt`. The van breaks through yellow smog. Pan across the rows and the harvesters.
2. `say warner` "Wow. They really gentrified the farming sector. Real dystopian vibe."
3. `say lucky` "There. The promoter said the underground barn is beneath Sector 4. Bring us down."
4. The van drops into the trench. The word **SQUELCH** lands as an object (`word_squelch`) and the suspension
   groans. `set flags.landed`; the word SQUELCH joins `state.words` (toast "New NOISE word: SQUELCH.").
5. `say phoenix portrait:phoenix_droop` "We're here. Please don't make me drive back."
6. `teleport ch02_trench`.

### CS2-11 `ch02_humidity` (`ch02_trench.onFirstEnter`) Toon 2
1. Diego slides the door. Green fog rolls in on the `over` layer.
2. Phoenix steps out and melts: `anim phoenix melt`; `sprite phoenix phoenix_melt`; glasses fogged.
3. `say phoenix portrait:phoenix_melting` "My brain thinks I am going to become a puddle. Put me in a Tupperware
   container."
4. `say lucky` "Hold it together, Phoenix. We load in, we play fast, we get paid."
5. `set flags.melting`. Toast "Phoenix is MELTING. It is the humidity. A Tupperware helps."
6. `say narrator` "A red light in the fog. Bass through the mud." *(new)* Control.

### CS2-12 `ch02_ramp_top` (`ch02_ramp.onFirstEnter`) Toon 1
1. The band starts down with the gear. Phoenix drags the bass amp and leaves a gray trail on the planks.
2. Bajonka trots past all four of them with a snare drum balanced on her head, and sits at the first landing.
3. `say warner` "Is she, uh. Is she crew?" *(new)* / `say phoenix` "My brain thinks she is management." *(new)*
4. `sfx sneeze`. Control. She is the save point from here to the stage.

### CS2-13 `ch02_loadin` (`ch02_barn.onFirstEnter`) Toon 1
1. `music ch02_barn`: CROP ROTATION is mid-song on the stage. Pan across the pit: cheap beer, ozone, wet dirt.
2. Diego walks ahead with the Strat case and throws a peace sign at the welding-arm worker.
   `say diego portrait:diego_peace` "Right on. Good vibes tonight, brothers."
3. `say farmer_weld` "I am going to bite someone."
4. CROP ROTATION finishes: "We were Crop Rotation. We are on shift in six hours. Good night." *(new)* The crowd
   answers with one "Woo." They leave the stage. `set flags.loadedIn, flags.sawCropRotation`. Control.

### CS2-14 `ch02_khakis` (pit edge, once) Toon 2
1. `emote player !`. `say lucky` "Oh, you have got to be kidding me."
2. Pan to the agents: pressed khakis, tucked polos, combat boots, clipboards. One touches his ear. The other is
   standing completely still on purpose.
3. `say lucky` "Feds. 3 o'clock. They look like they're about to audit a mosh pit."
4. `say diego portrait:diego_panic` "Wait... Vanguard? Like, the actual galactic state authorities?"
5. `say diego` "Man, I do not have an interstellar visa. I'm literally an Earth immigrant. If they scan me, I'm
   getting deported to a labor camp on a moon I can't pronounce."
6. `say diego portrait:diego_peace` "Okay. Okay. Just send them positive vibrations, man. Match their frequency
   with peace."
7. `sprite lucky lucky_rage`; `sfx slime_pop`.
   `say lucky portrait:lucky_rage` "Diego. If you send a cop a 'positive vibration,' I will personally launch
   you into the sun."
8. `sprite lucky lucky`. `set flags.sawKhakis`. Control. The stage steps are live.

### CS2-15 `ch02_take_stage` (stage steps, [Start the set]) Toon 1 to 2
1. Autosave. `set flags.onStageBelt`. The band takes its places. Bajonka hops onto the monitor and looks at each
   exit in turn.
2. `say phoenix portrait:phoenix_melting` "My brain thinks we should play twice as fast so we can get paid and
   leave before the feds finish their paperwork."
3. Warner sits, sets a cymbal, spins a stick. The crowd roars: cheers and boos.
4. `say lucky` "{shake}We are the Slime Monsters From Outer Space! This one's called Monsters!{/shake}"
5. `battle ch02_monsters` with `countIn: "warner"`: "One! Two! Three! Four!" -> CS2-16.

### CS2-16 `ch02_positive_id` Toon 1 to 3
The song does not stop: `band_monsters` keeps playing across this script and into the boss.
1. Camera to the pit's edge. An agent, against the wall, looks up at the stage.
2. `say agent_a` "Command! Positive ID! It's the missing Vanguard biological asset! The pink slime!"
3. A farmer sails past his head. `say agent_a` "Sector 4 underground! Execute breach! EXECUTE BREACH!"
4. **BOOM** (`word_boom`); `camera shake 900`; the roof tiles swap to the breach set; slabs fall into the pit;
   the crowd scatters; red searchlights. Three Riot Drones descend through the hole.
5. Silent autosave (a retry starts here). `battle ch02_riot_solo`, `onLose: gameover`. -> CS2-17.

### CS2-17 `ch02_dock_gag` Toon 1
The recipe, the same every time it is used in the game: the question, a cut to a wall, THUD.
1. `caption "MEANWHILE" style:tape`. `teleport ch02_dock`, no player. The song is still audible, ducked.
2. A guard with a rifle rounds the corner and raises it. Bajonka is sitting at the bottom of the van ramp,
   looking up at him. He lowers the rifle a little and reaches out a hand.
3. `say guard` "Hey... is that a dog?"
4. Cut: the camera pans to a bare stretch of the dock wall and holds for 900 ms.
5. **THUD** (`word_thud`), `camera shake 300`, `sfx rifle_clatter`.
6. Cut back. No guard. Two legs in the trash can. Bajonka drags Phoenix's 4x10 cabinet up the ramp by a strap,
   pushes it in and hooks a bungee cord. `set flags.dogAsked, flags.bajonkaSummon`.

### CS2-18 `ch02_load_out` Toon 1
1. `teleport ch02_barn_breach`. Feedback rings out and stops: `music null`. The drones spark on the floor. Red
   lasers at the south door.
2. `say lucky` "Show's over! Load out!"
3. Diego army-crawls off the back of the stage with the Strat. Warner jogs and tosses a stick. Control returns.
   The followers keep those gaits until the dock.

### CS2-19 `ch02_promoter` Toon 1
1. Lucky marches up and takes the Promoter by the collar.
   `say lucky` "We played the set. The Vanguard is here. Give us our cut of the door money right now before my
   bassist melts."
2. `say phoenix portrait:phoenix_melting` "My brain thinks I'm going to start charging interest."
3. `say promoter` "There is no door money. The gig was a stress test. And you passed."
4. `say lucky` "A test?"
5. He takes a clipboard out of the coat. `say promoter` "I represent the Eclipse of Liberation. The Vanguard
   fears you. We need soldiers with your level of destructive acoustic capability."
6. `say promoter` "The Eclipse is highly structured. Our success is built on rigorous organization. Please
   review these onboarding documents, sign section 4A to join the Vanguard Resistance Committee, and we can
   schedule your orientation."
7. `music null`. The clipboard is held out. A `choice`: **[Slap it]** / **[Read it]**. [Read it] is drawn gray
   and cannot be chosen; its hint reads "Lucky does not read clipboards." **[EXT]** It becomes a real option in
   Chapter 7.
8. [Slap it]: `anim player lucky_slap`; `sfx clipboard_slap`; the clipboard lands face down in the mud as an
   object. `say lucky portrait:lucky_rage` "Are you kidding me? I literally just quit my life to escape
   corporate structure and middle management! I'm not joining your bureaucratic book club!"
9. Lucky walks up the ramp, stops at the sack and heaves it in. `give raw_cosmic_potatoes` (toast "Got Raw
   Cosmic Potatoes. VANGUARD PROPERTY."). `say lucky` "I'm taking these as payment! Diego, get in! Phoenix,
   drive!"
10. Diego dives in the side door. Phoenix drags into the pilot's seat and shoves Bajonka across.
    `set flags.clipboardSlapped`. -> CS2-20.

The clipboard in the mud can be read before boarding only as an object: "Section 4A. Face down. It is already
filed somewhere."

### CS2-20 `ch02_orbit` Toon 2
1. `teleport ch02_descent`, reversed: the van blasts out of the trench; red laser fire misses and hits the mud.
   `camera flash`. `teleport ch02_van`. `music ch02_broke_orbit`. Stars in the windows. Everyone is filthy.
2. Diego bites a raw, faintly glowing potato like an apple. `say diego portrait:diego_potato` "Honestly, guys?
   Great first gig. The energy was very grounding."
3. `sfx phone_buzz`. **[EXT]** `insert` with the phone frame: "FINAL NOTICE. THE TOWERS, UNIT 4. PAST DUE:
   $2,112. AUTOPAY: ON." Then a second line prints: "PARTIAL PAYMENT RECEIVED. THANK YOU FOR YOUR YIELD."
4. The money counter is shown and ticks down to $4 on screen (nothing happens if the band holds $4 or less).
   `give eviction_warning`; `set flags.evictionWarned`. **[EXT]** the deadline tag appears top right and stays:
   EVICTION: PENDING.
5. `say phoenix portrait:phoenix_deadpan` "My brain thinks we need to start selling merch."
6. Control returns in the van. Everything in it can be read. The cup holder ends the chapter.

### CS2-21 `ch02_stinger` (interact, the cup holder) Toon 0
1. `music null`. **[EXT]** `insert` with `obj_potato_sharpie`: "A potato in the cup holder. Somebody has written
   on it in Sharpie." The second page is the potato's own text, in handwriting: "We are all slime."
2. `set flags.ch2Complete`. `camera fade out`. `caption "NEXT: THE MERCH TABLE INCIDENT"`.
3. `save { prompt: "INITIAL HERE TO END CHAPTER 2" }`. `title`.

### Shop and save scripts
`shop ch02_swap` opens the swap table. Save points use the standard Bajonka script. `ch03_start` is added to
`src/engine/Chapters.js` as a stub (the Chapter 3 card and TO BE CONTINUED), the way `ch02_start` was.

## Battle additions

Everything in `docs/DESIGN.md`'s battle system stands. This chapter adds four things.

### The beat
A **beat clock** and a **beat lamp**. The clock follows the playing song through `Sequencer.position`; if no
song is playing or the audio clock is not advancing (muted, headless, not yet unlocked) it runs from the frame
clock at the encounter's BPM. The lamp and the judge read only the clock, never the audio directly.

- **The lamp** sits in the HUD under the SETLIST strip: four pips, one per beat of the bar, and the first pip is
  a cymbal. It is drawn whenever a drummer is on stage (this chapter: Warner) and hidden otherwise.
- **The crash** is the downbeat of every bar. Warner's battle sprite hits his crash frame on it. At 164 BPM a
  bar is 1,463 ms. The player can read the beat three ways: the lamp, the drummer, the song.
- **A timed action** is a riff with `"timed": true`. After the player picks it and its target, the actor winds
  up and the game waits for one more confirm. The press is compared with the nearest crash:
  inside the window it is **ON THE CRASH**, outside it is off. No press within two bars counts as off.
- **The window** is set in Options, TIMING: NORMAL (plus or minus 90 ms), WIDE (plus or minus 180 ms), AUTO
  (always on; no extra press). The default is NORMAL. Every later rhythm system reads the same setting.
- **The model stays pure.** The scene resolves the timing and passes it in: `model.act(id, { type: 'riff',
  riff: 'guitar_swing', target, timing: 'on' | 'off' })`. `tests/battle.test.mjs` passes the timing directly.
- **Under test.** `__slime.beat = 'on' | 'off' | null` forces the result, the way `chooseIndex` forces a
  choice. With `autoAdvance` on and `beat` unset, a timed action resolves `on`.
- A timed action that lands on the crash is a guaranteed crit and adds +6 Toon. Off the crash it is an ordinary
  hit and can never crit. That is the whole rule.

### Statuses

| Status | Effect | Dur. | Cure |
|---|---|---|---|
| **MELTING** (Phoenix; field) | DEF x0.75, and Phoenix loses 5% of max HP at the end of each round, never below 1. | the battle | Tupperware (item or node); leaving the humidity |
| **HIDING** | No turn. Cannot be targeted. Does not count as standing for the loss check. | until rallied | a scripted rally |
| **CONFUSED** | Can be targeted. The turn is spent: "Phoenix's hands hover over the strings." | until rallied | a scripted rally |
| **TARGETED** | A drone has a lock on this member. Shown as a red line from the drone and a reticle on the name. | until the shot | break the lock (below) |
| **STUNNED** | The existing DAZED, renamed on the drone's attack only. Sunglasses still block it. | 1 | Deadpan |

**Field statuses.** A map may carry `"fieldStatus": { "id": "MELTING", "who": "phoenix" }`. Every battle fought
on that map opens with it applied. On the map it swaps the member's follower sheet (`phoenix_melt`). The trench,
the ramp, both barns and the dock carry it. The van does not.

**Telegraphed moves.** An enemy skill may be `"telegraph": true`: on one turn the enemy locks a target, on its
next turn it fires at that target. A lock breaks if the enemy is DAZED, is knocked down to 0 HP, or is hit by a
timed action that landed on the crash. Chapter 4's BZZZZT cancels the same thing.

### Words
`state.words` now feeds the NOISE menu. Chapter 1's three words come by Toon level as before. **SQUELCH**
(Toon 1, 25 points): single target, PHYS, POW 140, inflicts SLIMED. It is collected at the landing.

### Guests at Lucky's level
A character with `"guest": true` and `"levelFrom": "lucky"` reads its stats at Lucky's current level and
ignores XP. An encounter may list `"auto": ["warner"]` and `"minHp": { "warner": 1 }` to override a member for
that fight only.

## Battles

Numbers are starting points. Each fight is simulated in the build the way `docs/DESIGN.md` simulated the hub,
and the targets below are the acceptance test: an ordinary fight costs 15 to 30% of the party's HP pool and
lasts two to four rounds.

**`ch02_welcome` THE WELCOME COMMITTEE (scripted, first fight as four).** Two Sprinkler Drones and a Scarecrow
Unit against Lucky, Phoenix (MELTING), Diego and Warner, all controlled. Not `noFlee`, but BAIL is gray: "The
van is behind them." Toon 0. Count-in by Lucky.
- `onStart`: text "The irrigation rig wakes up. It has been told about you." Toast "Four of you now. The SETLIST
  shows who is up."
- First turn of Warner's: toast "Warner's CRASH is timed. Pick it, then confirm on the cymbal." The lamp pulses
  larger for his first Crash.
- First on-the-crash Crash: text "Right on the one." Toast "On the crash is always a crit. Off it never is."
  `set flags.beatTaught`.
- `onRound(2)` if Phoenix is still MELTING: toast "Phoenix is dripping. ITEM, Tupperware."
- Reward: 75 XP fixed, $6. It leaves a sprinkler head: "It still turns. It is looking for a lawn."
- If the Toll Booth was fought first, the same three toasts fire there instead, keyed on `flags.beatTaught`.

**`ch02_toll_booth` THE TOLL BOOTH (optional mini-boss).** One enemy, 64 px, HP 520. Party of four, all
controlled. `noFlee`. Toon 0. Losable.
- `onStart`: `say toll` "PLEASE HAVE YOUR DEMOGRAPHIC READY." Diego is HIDING: `say diego` "No visa, man. It's a
  toll AUTHORITY." *(new)* He comes out on the first on-the-crash Crash: `say diego` "Okay. Okay. It's a booth."
  *(new)*
- Moves: Gate Arm (PHYS 110, single); Exact Change (NOISE 70, single, and the band loses $1); Lane Closed
  (TEMPO DOWN on all, which fails while Warner stands: text "Warner holds the beat. The lane stays open.");
  Out of Order (self DAZED every fourth round, the opening).
- `onDefeat`: text "The gate arm comes off. The till opens." Reward 60 XP, $12 plus whatever Exact Change took,
  and **one chop** for Lucky, Phoenix and Diego.

**`ch02_monsters` THE SET, "Monsters".** One enemy, THE PIT (64 px, HP 300, a mood enemy: the crowd, arms and
tillers). Party of four, all controlled; Phoenix MELTING. `noFlee`, `noLose`, Toon 0, music `band_monsters`,
background `barn`, count-in by Warner (the comic's count; it is the one count-in in the game that is not
Lucky's).
- After the first party action: `anim diego stomp`; the word **CLICK** (`word_click`); text "Diego steps on the
  fuzz." -> `damage pit 60`; text "The sound hits the room like weather. The pit opens."
- `onRound(2)`: text "A clipboard goes into the mud. Nobody mourns it." (An agent is pinballing at the pit's
  edge in the background.)
- `onRound(3)`: **the leg.** `anim lucky long_leg`; a pink leg (`obj_long_leg`) stretches across the stage to
  the pedalboard and turns a knob, then snaps back. Text "Lucky's leg crosses the stage and turns a knob. Lucky
  does not look down." Everyone gains 4 AMP.
- End of round 3, or the PIT at 0 HP: text "The beams groan. Dust comes down." -> `win`. THE PIT's `ko` frame is
  hands and farm tools in the air.
- THE PIT's moves do small PHYS damage to one member (Stage Dive, 40). A wipe stands everyone back up at 1 HP.
- **The crowd bank.** `vars.crowdBank` gains 40, plus 5 for each timed action that landed on the crash during
  the set, to a ceiling of 60 (`vars.setOnBeat` counts them). There is no meter on screen.
- Reward: 20 XP fixed, $0.

**`ch02_riot_solo` BOSS: VANGUARD RIOT DRONES, "The Riot Solo".** Three Riot Drones (48 px) against Lucky,
Phoenix, Diego and Warner. `noFlee`. Losable. Toon starts at 25. Music `band_monsters`, continuing: no restart
and no count-in. Background `barn_breach` (red searchlights sweeping, dust).

The one rule: **Lucky only hits hard on Warner's crash.**

- Drones are **ARMORED**: a hit that is not a crit does half damage. A crit ignores DEF, as always.
- `onStart`:
  - `say diego` "Whoa. Bad vibes. No visa." -> `status diego HIDING`; his sprite dives behind the 4x10.
  - `say phoenix` "My brain thinks we missed a time signature change." -> `status phoenix CONFUSED` (on top of
    MELTING).
  - text "Warner does not stop." Warner is `auto` with `minHp 1` for this fight: he plays **Crash** on all three
    drones every turn. The lamp is his.
  - Lucky gains BRISTLING for 3 rounds and learns **GUITAR SWING** on the spot. Toast "GUITAR SWING. Confirm on
    Warner's crash." Lucky's sheet is `lucky_battle_rage`.
- **GUITAR SWING** (3 AMP, PHYS, POW 120, timed): the guitar body swung like a bat. On the crash: a crit. Off
  it: an ordinary hit, halved by the armor.
- **Drone turns.** A drone with no lock uses Lock On (telegraph). A drone with a lock fires **ZAP** (the word
  ZAP as an object; POW 170; STUNNED 1) at the member it locked. Round 1 is scripted so nobody is hit three
  times at once: drone A locks Lucky, drone B locks Phoenix, drone C is still descending and locks Warner in
  round 2. After that each drone locks whoever on stage has the highest ATK and is not already locked. An
  on-the-crash swing at a drone breaks its lock.
- **GROOVE and the rally.** Each on-the-crash swing adds 1 GROOVE (a count the script keeps; three small pips
  under the lamp).
  - GROOVE 1: Phoenix snaps back. `say phoenix` "...Oh. It's in four." *(new)* CONFUSED ends.
  - The first drone destroyed, or GROOVE 3: Diego peeks out from behind the amp.
    `say diego` "That was actually a really nice phrasing, man." HIDING ends.
  - **Mercy.** If the player never finds the crash, Phoenix comes back on round 5 and Diego on round 8, with
    the same lines. The fight is then long and honest, and it can still be lost.
- `onDefeat(drone)`: the word **SMASH** (`word_smash`); text "It comes apart on the one."
- **Loss.** Before the rally Lucky is the only member who can keep the band alive: if Lucky is KO'd while
  Phoenix is CONFUSED and Diego is HIDING, the fight is lost. After it, the normal rule.
- **Win.** The third drone falls: text "The song ends on a wall of feedback." -> `win`.
- Reward: 115 XP fixed, $0 ("There is no door money."). GUITAR SWING stays in Lucky's riff list.
- **Tuning targets** (level 9, a mid-budget guitar): on the crash every time, the fight ends in round 6 to 8
  with Lucky above 30% HP and no item used. A geared Lucky at Toon 2 destroys a drone in one swing, as in the
  comic. Off the crash for the whole fight, it ends around round 12 if it is won at all, and is lost more often
  than not without items. With TIMING: AUTO it plays like the first case.

**Loss handling.** `onLose: gameover` on `ch02_toll_booth` and `ch02_riot_solo`. Game Over offers the last
initialed page: the curb autosave, the stage autosave, or the silent autosave at the breach.

## Party and progression

### Diego
Guitar, red Strat, HIGH. Joins at Lucky's level and XP and levels from there. Slime cannot coat him yet, so he
has no Syncs in this chapter. TALK is not in his command list.

Stats before equipment (HP / AMP / ATK / DEF / SPD / LCK): level 7, 66 / 22 / 15 / 10 / 12 / 14; level 8,
72 / 24 / 16 / 11 / 13 / 15; from level 9 the rates in `docs/PROGRESSION.md` (HP 6, AMP 1.25, ATK 1.75, DEF 1,
SPD 1 every second level, LCK 1 every second level). The PROGRESSION table is the acceptance test.

| Riff | AMP | Freq | POW | Effect |
|---|---|---|---|---|
| Heavy | 4 | HIGH | 150 | Single. |
| Nice Phrasing | 3 | HIGH | 110 | Single. +50% if a bandmate played a riff earlier this round. |
| Positive Vibration | 4 | support | n/a | Heal an ally 30% of max HP; cure OUT OF TUNE. |
| Hold Space | 5 | support | n/a | An ally takes half damage for 2 rounds. |

**NO VISA.** Diego opens any fight against Vanguard law HIDING until a bandmate lands a hit on the crash. In
this chapter that is the Toll Booth and the Riot Solo. The machines in the trench are property, not law.
Equipment: Red Strat (instrument, ATK +6, HIGH, never replaced), nothing else.

### Warner
Drums. A guest: pinned to Lucky's level, no XP, no chops, fixed kit, cannot be given gear. The player controls
him in every fight except the Riot Solo. He is AUTO there, because the point of that fight is that he does not
need telling.

Stats at level 8: 74 / 12 / 15 / 12 / 15 / 8. Per level: HP 6, ATK 1.5, DEF 1, SPD 0.5, AMP 0.5.

| Riff | AMP | Freq | POW | Effect |
|---|---|---|---|---|
| Crash | 2 | NOISE | 110 | Single. Timed. In the Riot Solo he plays it on all enemies at POW 90, by himself. |
| Hold the Beat | passive | n/a | n/a | The band cannot be TEMPO DOWNed while he stands. |

Commands: STRUM (sticks, PHYS), RIFF, NOISE, ITEM, TUNE, BAIL. Equipment: Drumsticks and a Rat Fight tee,
locked.

### Lucky and Phoenix
- Lucky learns **GUITAR SWING** in the Riot Solo (a story node on GUITAR) and keeps it. Outside the boss it
  works the same way and needs a drummer on stage for the lamp.
- Phoenix is MELTING for every fight in the Belt.

### Levels and XP
The party starts at level 7 with 206 XP on the critical path.

| Source | XP | Running total | Level |
|---|---|---|---|
| Start | n/a | 206 | 7 |
| THE WELCOME COMMITTEE | 75 | 281 | 8 |
| Four on-map fights in chokepoints | 90 | 371 | 9 |
| THE SET | 20 | 391 | 9 |
| The Riot Solo | 115 | 506 | 10 |

Scripted 210 and ordinary 90, the split `docs/PROGRESSION.md` asks for. That is 300 in all; PROGRESSION's own
total says 304, and the level it lands on is the same. Optional: Thresher Arm 26, Feral Hose 20, the Toll Booth
60, which is 106 more. A full-clear Chapter 1 save (311 XP) that takes everything ends at 717: level 11.

The split is arranged so that the critical path reaches level 9, and its first chop, on the last chokepoint
fight before the barn. The player walks onto the stage with one chop spent.

### Chops and PRACTICE
From `docs/PROGRESSION.md`. Lucky, Phoenix and Diego earn one chop per level from level 9. The Toll Booth pays
one more to each. On the critical path that is one chop each before the boss and two each by the stinger.

**PRACTICE** is a new page in the pause menu, between Riffs and Equip. Three columns per member (the branches),
one row per tier. Tier 0 is owned. Tier 1 is open in Chapter 2 and each node costs one chop. Tiers 2 to 4 are
drawn locked with the chapter that opens them. A node needs one owned node in the tier below on its branch.
There is no respec in this chapter. The page first opens itself, once, when the first chop arrives
(`flags.practiceSeen`): toast "CHOP +1. PRACTICE is in the menu."

Tier 1, as specified in PROGRESSION, all fourteen nodes:

| Who | Branch | Node | Cost / effect |
|---|---|---|---|
| Lucky | GUITAR | Play Fast | 5 AMP. Three hits at POW 60, random targets. |
| Lucky | GUITAR | Palm Mute | 4 AMP. POW 100, and Lucky is TUNING until their next turn. |
| Lucky | VOICE | This One's Called | 4 AMP. +10 Toon, and the next riff anyone plays costs no AMP. |
| Lucky | VOICE | Banter | 3 AMP. One enemy's ATK down 20% for 3 rounds, +5 Toon. |
| Lucky | SLIME | Long Leg | 2 AMP. Cures an ally's OUT OF TUNE and gives them 4 AMP. Does not end the turn, once a round. |
| Lucky | SLIME | Flying Squirrel | 4 AMP. The next PHYS hit on Lucky misses. |
| Phoenix | BASS | Walking Line | 4 AMP. POW 110. Each use in a row adds 20, three times. |
| Phoenix | BASS | Lock In | Passive. +30% when Phoenix acts directly after the drummer. |
| Phoenix | BRAIN | Tupperware | 4 AMP. Phoenix heals 25% and sheds every status, MELTING included. |
| Phoenix | BRAIN | Second Opinion | Passive. My Brain Thinks also shows the enemy's next move on the SETLIST. |
| Diego | STRAT | Sustain | 5 AMP. POW 90 now and again next round, free. |
| Diego | STRAT | Bend | 4 AMP. POW 130, 40% OUT OF TUNE. |
| Diego | VIBES | Grounding | 5 AMP. Cures DAZED and TEMPO DOWN on the band. |
| Diego | VIBES | Raw Potato | Free, once a fight. Diego heals 40%. |

Three of these are named for this chapter and have a job in it: Long Leg is the leg, Tupperware is the cure for
the map's own status, and Second Opinion shows which member a drone is about to lock. Phoenix's SYNTH branch and
Diego's TALK branch are drawn as closed columns.

## Enemies

| id | Enemy | px | HP | ATK | DEF | SPD | XP | $ | Weak / resist | Phoenix's scan |
|---|---|---|---|---|---|---|---|---|---|---|
| `sprinkler` | Sprinkler Drone | 32 | 170 | 12 | 8 | 12 | 11 | 3 | HIGH / PHYS | "My brain thinks it is the reason I am like this." |
| `scarecrow` | Scarecrow Unit | 48 | 300 | 14 | 10 | 6 | 24 | 6 | NOISE / LOW | "My brain thinks it scares the workers. The crows are fine." |
| `gnat` x3 | Glow Gnat | 32 | 100 | 11 | 5 | 14 | 7 ea | 2 ea | PHYS / NOISE | "My brain thinks they should not glow. Nothing here should glow." |
| `seed_drill` x2 | Seed Drill | 32 | 210 | 14 | 12 | 9 | 12 ea | 4 ea | LOW / HIGH | "My brain thinks it is planting something. In us." |
| `duster` | Crop Duster | 32 | 240 | 13 | 7 | 13 | 9 | 5 | LOW / PHYS | "My brain thinks that powder is not organic." |
| `thresher` | Thresher Arm (optional) | 64 | 620 | 16 | 13 | 5 | 26 | 9 | NOISE / PHYS | "My brain thinks there is a whole harvester attached to that." |
| `hose` | Feral Hose (optional) | 32 | 380 | 13 | 6 | 11 | 20 | 5 | HIGH / LOW | "My brain thinks it used to have a job." |
| `toll_booth` | The Toll Booth (optional) | 64 | 520 | 15 | 14 | 4 | 60 | 12 | NOISE / PHYS | "My brain thinks it takes cards. My brain thinks it took ours." |
| `the_pit` | THE PIT (the set) | 64 | 300 | 6 | 0 | 8 | n/a | n/a | NOISE / n/a | "My brain thinks they like us. My brain thinks that is the dangerous part." |
| `riot_drone` x3 | Vanguard Riot Drone | 48 | 260 | 15 | 14 | 10 | n/a | n/a | n/a; ARMORED | "My brain thinks we missed a time signature change." |

Ten entries in `enemies.json`. On-map groups: `ch02_gnats` (three gnats, 21 XP), `ch02_seed_drills` (two drills,
24 XP), `ch02_duster` (a duster and two gnats, 23 XP), `ch02_sprinklers` (two sprinklers, 22 XP). The four
chokepoint fights pay 90 XP and $29 between them.

**The rule: no potato enemies.** Nothing in this chapter that can be hit is a potato, grows on one or looks like
one. The crops cannot be attacked. The farmers are the crowd and are never fought.

**Moves.**
- **Sprinkler Drone** (Brute): Spray (NOISE 80, single); Mist (all, 30% TEMPO DOWN, which Warner blocks).
- **Scarecrow Unit** (Caller): Loitering Notice (NOISE 90, 40% OUT OF TUNE); Yield Review (ATK up on its allies
  for 2 rounds); Stare (single, 30% DAZED). A post with a clipboard for a face and a Vanguard armband.
- **Glow Gnat** (Swarm): Bite (PHYS 70); Swarm (PHYS 50 on all) only while three are alive.
- **Seed Drill** (Brute): Burrow, a telegraph (it goes under and cannot be targeted, then comes up under the
  member it locked: PHYS 150). It teaches the lock before the boss needs it.
- **Crop Duster**: Dust (all, 40% OUT OF TUNE); Strafe (PHYS 100). It flees below 25% if it is alone.
- **Thresher Arm** (static): Thresh (PHYS 120 on two random members); every third round Jam (self DAZED).
- **Feral Hose**: Whip (PHYS 100); Soak (single; if the target is Phoenix, MELTING comes back).
- **Riot Drone**: Lock On, ZAP, and Bump (PHYS 90) when it is DAZED out of a lock.

## Items, equipment, shop

Start of chapter, from the seeded save: about $14, the Half-Ounce, two Gas Station Coffees, and Chapter 1's
gear.

| Consumable | $ | Effect | Where |
|---|---|---|---|
| Tupperware | 6 | In battle, on Phoenix: cures MELTING for that fight and heals 15. On anyone else: heals 15. | apartment (2), ramp crate (1), swap table |
| Rebar Corn Dog | 5 | Heal 45 HP. | swap table; thresher crate (1) |
| Gas Station Coffee, Hand Warmer, Tater Tot Hotdish | 4 / 5 / 15 | as Chapter 1 | swap table |

Key items: **Raw Cosmic Potatoes** ("A burlap sack. VANGUARD PROPERTY. It is the gig's whole pay."), **Eviction
Warning** ("FINAL NOTICE. PAST DUE: $2,112. It cannot be paid from here.").

| Equipment | Slot | Who | Stats | $ | Where |
|---|---|---|---|---|---|
| The Mohawk | wear | any | LCK +4. "It is evidence." | n/a | Diego, at the door |
| Left-Behind Offset | instrument | Lucky | ATK +9, HIGH | 58 | swap table |
| Left-Behind Thunderbird | instrument | Phoenix | ATK +10, LOW | 58 | swap table |
| Feed-Trough Cab | rig | any | AMP +4; STRUM gives +3 AMP instead of +2 | 52 | swap table |
| Work Gloves | wear | any | DEF +3 | 18 | swap table |
| POTATO BELT (sticker) | sticker | any | +10% money from fights | n/a | the welding-arm worker, after the khakis scene, if spoken to: "For your guitar. So it remembers." |
| Red Strat | instrument | Diego | ATK +6, HIGH; locked | n/a | fixed |
| Drumsticks, Rat Fight Tee | instrument, wear | Warner | ATK +4 PHYS, DEF +2; locked | n/a | fixed |

**The swap table (`shops.json`, `ch02_swap`).** Sells everything above marked "swap table". Buys the Half-Ounce
$20, the Fried Pedalboard $11, the Jacket $20, Chapter 1 instruments at half price, anything else at half
price. Refuses key items.

**Money budget.** $14 at the door (a typical critical-path save; a careful Chapter 1 player has more). Welcome
$6 + chokepoint fights $29 + crates $6 + optional fights $14 + the till $12, less the $6 toll if it is paid:
about **$43 on the critical path and $81 on a full clear**, plus $51 for anyone who sells the weed, the
pedalboard and the jacket. One piece of swap-table gear on a full clear, as `docs/PROGRESSION.md` asks.

**The chapter ends broke.** There is no door money. In orbit the landlord's autopay takes the counter down to
$4, on screen. Gear and items are untouched. A player who spent at the swap table kept what they bought. A
player who saved kept four dollars.

## UI and presentation

- **The beat lamp.** Four 6x6 pips at (100..132, 18), the first a cymbal. Off pips are the window's dark tone;
  the live pip is white; the crash pip is gold for its beat. During a timed action the lamp doubles in size at
  the centre of the screen over a 2 px dark band, with the word CRASH under it, and the result prints where the
  damage will: ON THE CRASH in gold or a plain hit. Three GROOVE pips sit under it in the boss only.
- **Options.** A new entry on the title menu and in the pause menu: TIMING (NORMAL / WIDE / AUTO), MUSIC and
  SFX volume, TEXT SPEED. Stored in `localStorage` under `smfos.settings`, outside the save. The page has one
  blank row at the bottom. It does nothing.
- **Four live commands.** The turn strip, the party HUD rows and the command window are checked with four
  controlled members and three enemies. The HUD already draws four rows; this is the first time all four take
  input.
- **The title card** (CS2-05): full screen, the `space` pattern, the van, two lines of text in the flyer face.
- **The phone** (CS2-20): an insert window drawn as a cracked phone, 96x128, with the notice in the small face.
- **The deadline tag.** A small window at the top right of the explore HUD: a label and a value. Chapter 2
  shows it once with EVICTION: PENDING. Chapter 3 makes it count.
- **Lucky's color.** Pastel on the map from CS2-01. Magenta for two beats (CS2-07, CS2-14) and for the Riot
  Solo. The dialogue window's inner rule follows, as in Chapter 1.
- **Battle backgrounds** (procedural, in `BattleBackground.js`): `trench` (green fog bands over mud), `barn`
  (work lights and rust), `barn_breach` (the same with a sky hole and sweeping red searchlights), `space` (the
  starfield; also the title card and the Toll Booth).

### Parking (`ParkingScene`)
A bespoke scene like `FreefallScene`, launched by `{"scene": "parking"}`.
- Top-down. Two grain haulers, one above and one below a gap 40 px wide. The van (32x16 here) starts to the
  left of the gap, pointing right.
- Zero gravity: each tap of a direction adds 1 px per frame of velocity on that axis, to a cap of 3, and
  nothing slows the van but the opposite tap. Hold cancel to fire the retro (it halves both velocities once a
  second).
- Parked means the van is fully inside the outlined space with both velocities at zero for 500 ms.
- Touching a hauler: the word **BONK** (the existing `word_bonk`), the van bounces back at 1 px per frame,
  `vars.parkTries` goes up by one. After three: "Let Bajonka park it? [Yes] / [No]". [No] resets the count and
  asks again after three more.
- No timer. No damage. No fail state. About 30 to 60 seconds. Under `?fast=1` the scene parks itself in 2
  seconds.
- Debug: `__slime.parking = 'clean' | 'bumps' | 'bajonka'` resolves the scene at once for tests.

## Audio

New songs, all synthesized, in `src/audio/songs/`:

| id | Where | Notes |
|---|---|---|
| `ch02_belt` | descent, trench, ramp | slow, humid, a machine hum under a minor figure; 96 BPM |
| `ch02_barn` | the barn before the set | CROP ROTATION: clanking percussion, one bass note, a rake; diegetic; 132 BPM |
| `ch02_parking` | the minigame | a zero-gravity waltz that is trying to be calm; 3/4, 88 BPM |
| `ch02_broke_orbit` | orbit | quiet, wide, unresolved; the Chapter 1 `four_dollars` figure a fourth lower |

Used from the repo as they are: `band_monsters` (the set and the boss, its first appearance in the game),
`band_spud_nothin` (the title card and the drive: the one tape in the tape deck), `unpaid_bills` (the
apartment), `snow` (the curb), `battle` (ordinary fights and the Toll Booth).

New SFX (recipes in `sfx.js`): `thruster`, `door_soft`, `toll_chime`, `bonk_hull`, `validate`, `squelch_big`,
`fuzz_click`, `lock_on`, `zap`, `roof_boom`, `rifle_clatter`, `clipboard_slap`, `phone_buzz`, `crash_big`.
Fourteen.

**Music across scripts.** `band_monsters` must not restart between the set, CS2-16 and the boss. An encounter
with `"musicContinue": true` keeps the playing song if it is already that song. A `music` command gains
`{"music": {"volume": 0.3}}` to duck and restore.

## Content inventory

### Overworld sprites (16x24 unless noted)
`diego` (16x32, from `stranger_tall`: full walk in four directions, `peace`, `crawl`, `potato`), `warner` (walk
frames added to the existing sheet, `stick_toss`), `phoenix_melt` (the walk set, drooping), `van_map` (32x24,
four directions, thruster flicker), `bajonka_snare`, `bajonka_sleep`, `npc_farmer_tiller`, `npc_farmer_weld`,
`npc_farmer_auger`, `npc_farmer_sprayer` (two palette variants each), `npc_croprot` (three frames: rake, drum,
tiller), `npc_agent_a`, `npc_agent_b`, `npc_guard`, `npc_promoter`, and map sprites for the enemies:
`sprinkler_map`, `gnat_map`, `seed_drill_map`, `duster_map`, `scarecrow_map`.

### Objects
`obj_van` (48x32, on the curb and at the dock, doors open and closed), `obj_van_small` (the title card and the
descent), `obj_toll_booth` (32x32), `obj_kiosk`, `obj_hauler` (parking), `obj_thresher_arm` (32x48),
`obj_hose`, `obj_crate`, `obj_valve`, `obj_cab_4x10`, `obj_pedal_fuzz`, `obj_monitor`, `obj_long_leg` (a
tileable segment and a toe), `obj_searchlight`, `obj_roof_slab`, `obj_drone_wreck_riot`, `obj_trash_legs`,
`obj_rifle`, `obj_sack`, `obj_clipboard_mud`, `obj_tupperware`, `obj_phone` (96x128), `obj_potato_sharpie`
(32x32), `obj_cup_holder`.

### Battle sprites (32x32 unless noted)
`diego_battle` (idle, attack, riff, hurt, ko, win, hide), `warner_battle` (idle with a crash frame, attack,
riff, hurt, ko, win), `phoenix_battle_melt`, three `swing` frames added to `lucky_battle` and each of its mood
variants, `sprinkler_b`, `gnat_b`, `seed_drill_b`, `duster_b`, `hose_b`, `scarecrow_b` (48), `riot_drone_b`
(48, with a lock frame and a wreck frame), `thresher_b` (64), `toll_booth_b` (64), `the_pit_b` (64).

### Words, portraits, tiles, UI
- Words: `word_squelch`, `word_zap`, `word_boom`, `word_click`, `word_smash`. THUD and BONK exist.
- Portraits (32x32, added to `portraits.txt`): `diego`, `diego_peace`, `diego_panic`, `diego_potato`, `warner`,
  `warner_sorry`, `warner_count`, `promoter`, `promoter_clipboard`, `agent_a`, `farmer_weld`, `guard`, `toll`.
  Thirteen. `phoenix_melting` and Lucky's faces exist.
- Tilesets: `space` (starfield, lane, buoy, guardrail, signs, plaza, hauler hull, van interior: about 32
  tiles), `belt` (mud, trench wall, crop rows in three frames, pipe, valve, plank, silo plate, work light,
  pallet stage, trough, barrels, breach and sky-hole tiles, harvester pieces: about 48 tiles). The curb reuses
  `minneapolis`.
- UI atlas: `icon_beat_off`, `icon_beat_on`, `icon_crash_off`, `icon_crash_on`, `icon_groove`, `icon_melting`,
  `icon_hiding`, `icon_confused`, `icon_targeted`, the PRACTICE node frames (owned, open, locked), the deadline
  tag.

Every sheet stays inside the shared 32-color palette and 16 colors. Every design is original. Diego matches the
tall stranger already in the build; Warner matches his Chapter 1 sheet.

### Data files
Maps: nine new files and one edited (`apartment`). Scripts: `ch02_a_morning.json`, `ch02_b_road.json`,
`ch02_c_belt.json`, `ch02_d_barn.json`, `ch02_e_dock.json` (and `ch02_start.json` rewritten). NPCs:
`src/data/npcs/ch02.json`. Battle scripts: `src/engine/battle/scripts/ch02.js`. Additions to `characters`,
`riffs`, `enemies`, `encounters`, `items`, `equipment`, `shops`, and a new `practice.json` for the trees.

## Engine extensions required

Each has a fallback so a slice can end green without it.

| # | Extension | Fallback |
|---|---|---|
| E2-1 | **Chapter start.** `ch02_start` becomes scene 1 and sets `state.chapter = 2`. `Chapters.js` gains Chapter 3's stub entry. `set` accepts the top-level `chapter` path. | none; required |
| E2-2 | **Beat clock, lamp, timed actions.** As under Battle additions. The sequencer already reports its position; there is no lamp in the HUD today. | Timed actions resolve `on` and the lamp is not drawn: the fights still work |
| E2-3 | **Options page** with TIMING, volumes and text speed, stored in `smfos.settings`. | TIMING only, as a URL parameter |
| E2-4 | **Debug**: `__slime.beat`, `__slime.parking`. | none; tests need them |
| E2-5 | **Field statuses** from the map, with the follower sheet swap. | The battle script applies MELTING in `onStart` |
| E2-6 | **HIDING and CONFUSED**, and `model.rally(id)`. The loss check ignores HIDING and CONFUSED members. | none; the boss needs them |
| E2-7 | **Telegraphed skills** and TARGETED, with the red line in `BattleScene`. | A text line names the target the turn before |
| E2-8 | **Guests at Lucky's level**; per-encounter `auto` and `minHp` overrides. | Warner as a fixed-level member, like Ryan |
| E2-9 | **Vehicle maps**: `"playerSheet"` and `"followers": false` on a map; a 32x24 player frame on one tile of collision. | A 16x16 van |
| E2-10 | **`ParkingScene`** and the `parking` key for `{"scene"}`. | CS2-09 plays the line and the kiosk with no scene (cut 4) |
| E2-11 | **`countIn: "warner"`** and **`musicContinue`**; `{"music": {"volume"}}`. | Lucky's count; the song restarts at the boss |
| E2-12 | **Words from `state.words`** in the NOISE menu. | SQUELCH unlocked by flag in the riff data |
| E2-13 | **PRACTICE**: the page, chops on level-up from 9, the tier gate, fourteen nodes and their effects. | Chops accrue and the page ships before Chapter 3 (see cuts) |
| E2-14 | **Sticker effects** (`moneyPct`). | The sticker is a keepsake until Chapter 3 |
| E2-15 | **Disabled choice options** in `choice` (the list menu already draws gray rows). | [Slap it] alone |
| E2-16 | **`card`**: a caption with a background pattern and a moving sprite. | The plain caption card |
| E2-17 | **Inserts with a frame** (the phone), and the **money tick-down**. | A plain insert and a toast |
| E2-18 | **The deadline tag** on the explore HUD. | Not shown until Chapter 3 |
| E2-19 | **Four followers**, with a per-follower gait override (Diego crawling, Warner tossing a stick). | Followers walk normally |
| E2-20 | **ARMORED** as an enemy trait, and `noRandomCrit` on a riff. | High DEF on the drones |

No save format change: everything new lives in `flags`, `vars`, the party list and fields the version 2 save
already has. A Chapter 1 save made before this work loads and continues.

## Tests

- `tests/chapter2.mjs`: an honest playthrough from `tests/fixtures/ch02_start.json` to the stinger. It walks
  every map, fights the chokepoint fights with real inputs, plays the boss on the crash, and checks at the end:
  `state.chapter` 2, `flags.ch2Complete`, Diego and Warner in the party, the potatoes and the eviction warning
  in the inventory, `vars.crowdBank` between 120 and 140, money at most 4, `luckyRageLocked` false, the word
  SQUELCH, zero console errors.
- `tests/chapter2_wrong.mjs`: every branch. All three `quitResponse` lines. The door before both have joined.
  The toll paid with $0, paid with $6, clipped and won, clipped and lost. The parking scene clean, bumped and
  handed to Bajonka. Every NPC and interactable. Every map edge. Off the crash for the whole boss (the mercy
  rally fires on rounds 5 and 8). The boss lost and retried from the breach autosave. [Read it] cannot be
  chosen. Money already under $4 at the stinger.
- `tests/battle.test.mjs`: the Riot Solo with a seeded RNG: on the crash crits and breaks a lock, off it does
  not, the rally order, the mercy rounds, the loss before the rally. The set cannot be lost. MELTING and the
  Tupperware. The telegraph. Each tier 1 node.
- `tests/data.test.mjs`: picks up the new data without changes; a new group checks `practice.json` (every node
  has a branch, a tier and an effect the model knows).
- A text sweep in `tests/data.test.mjs` for the canon rules: no Chapter 2 string contains "jar", names anyone
  from Lucky's old band, or gives Ryan a line; the only string that contains his name is Warner's cut-off line.
- A new seeded start, `tests/fixtures/ch03_start.json`, made from the real end of `tests/chapter2.mjs`.
- `npm test -- --chapter 2` runs the fast tests, the build, Foundations and the two Chapter 2 suites. The full
  run stays the gate.

## Build slices

Each ends green and is its own pull request.

1. **Engine.** E2-1 to E2-12 and E2-15 to E2-20, on dev maps and dev encounters, with `battle.test` coverage.
2. **Maps and cutscenes.** Every map and CS2 script, walkable end to end with placeholder fights.
3. **Battles.** The ten encounters, the boss script, the parking scene, simulated and tuned.
4. **Art and music.** Sprites, tiles, portraits, words, four songs, fourteen SFX.
5. **PRACTICE.** E2-13 and E2-14: the page, the chops, the fourteen nodes, the sticker.
6. **Proof.** `chapter2.mjs`, `chapter2_wrong.mjs`, the Chapter 3 seeded start, the bible and the roadmap
   ledger.

## Risks and cuts

**Risks.**
- **Timing feel.** Browser audio latency varies. The clock compares the key press with the audio clock, not
  with a frame. WIDE and AUTO exist from the first day. If NORMAL feels unfair in play, widen it to 110 ms.
- **Headless audio.** In the test browser the audio clock may not run. The beat clock falls back to the frame
  clock, and the tests force the result. One test runs the judge on real timing with the fallback clock.
- **The boss for a player with no rhythm.** The mercy rally and AUTO both exist so that nobody is locked out of
  Chapter 3. The fight is tuned on NORMAL and checked on AUTO.
- **The van's size.** A 32x24 player on one tile of collision can overlap scenery. The lanes are three tiles
  wide for that reason.
- **Scope.** PRACTICE is fourteen new effects on top of a chapter with a boss system, a minigame and nine maps.
  It is the last slice on purpose.
- **Chapter 1.** The apartment gains a second exit and Chapter 2 entities. Every Chapter 1 suite must stay
  green, and the old seeded save must still load.
- **Length.** The estimate is 66 minutes. If a first playthrough runs past 80, cut in the order below.

**Cuts, in order.** The brief's four, with two of this spec's own ahead of the last.
1. The Toll Booth fight. The plaza keeps its staffed lane. The chop it paid goes to the Thresher Arm.
2. CROP ROTATION's set. They are standing by the stage when the band walks in.
3. Ordinary encounters down to three (the gnats, the drills, the sprinklers). The XP moves to the Welcome.
4. The walkable breached barn becomes part of CS2-18.
5. PRACTICE ships as a follow-up pull request before Chapter 3 starts. Chops accrue in the meantime.
6. The parking minigame becomes a cutscene with the line.

**Never cut:** both doors, "We don't say his name", MELTING and the Tupperware line, the leg, the beat rule,
"is that a dog?", the clipboard slap, the sack, the potato in the cup holder.

## Calls made in this spec

Each is a decision the brief or the progression doc left open. Lucky can overturn any of them.

1. **Where the magenta lock lifts.** In CS2-01, on "...I know.", before the first knock.
2. **Warner's control.** The player controls him everywhere except the Riot Solo, where he is AUTO. His Crash
   is the timed riff the player learns the beat on.
3. **The set and the boss are two battles** with a cutscene between them and the song running through all
   three. A retry starts at the breach and does not replay the set.
4. **Warner counts in the set.** It is the comic's line. It is the only count-in in the game that is not
   Lucky's.
5. **The mercy rally.** Phoenix on round 5 and Diego on round 8 if the player never lands on the crash.
6. **The beat lamp is new.** The sequencer reports its position and nothing draws it yet. This chapter builds
   the lamp, the clock and the judge together.
7. **The van was on Cedar all year.** It is the spiral van from Chapter 1, and Diego painted the spiral.
8. **Parking is at an orbital validation stop**, and after three bumps Bajonka can park it.
9. **Clipping the Toll Booth pays better than the toll.** It costs $6 to be good.
10. **Autopay.** The landlord takes the money down to $4 at the stinger. Gear and items stay.
11. **[Read it] is on the clipboard prompt, gray.** It is the Chapter 7 payoff, planted in the menu.
12. **PRACTICE ships in this chapter**, last, with all fourteen tier 1 nodes.
13. **The BAJONKA command is planted, not built.** `flags.bajonkaSummon` is set at the dock. Nothing is fought
    after the dock in this chapter, so the command first appears in Chapter 3's spec.
14. **XP split.** 75, 90, 20 and 115 instead of an even spread, so the first chop arrives before the stage.
15. **New names:** CROP ROTATION, THE WELCOME COMMITTEE, the Left-Behind Offset and Thunderbird, the Rebar Corn
    Dog, Orbital Route 4.
16. **The Mohawk can be worn.**
17. **A blank row in Options.** It costs nothing and keeps a Chapter 12 idea possible.

## Defaults used

- `docs/PROGRESSION.md` open question 1: Chapter 1's pace is left alone. Question 4: the currency is "chops".
  Question 2 (respec) does not come up before Chapter 9.
- `docs/SUBPLOT_BAJONKA_RIDER.md`: the BAJONKA command is treated as going ahead and unlocking at the dock.
- None of the bible's nine open questions touches this chapter.

## What Chapter 3 reads

Rows for the roadmap's carry-over ledger, added when the chapter is built.

| State | Written | Read |
|---|---|---|
| Raw Cosmic Potatoes (key item) | CS2-19 | Ch 3: the merch |
| Eviction Warning (key item), `flags.evictionWarned` | CS2-20 | Ch 3: the clock goes live |
| `vars.crowdBank` (120 to 140 after this chapter) | the set | Ch 12 |
| Warner in the party | CS2-03 | Ch 3: he leaves at the dock |
| `flags.bajonkaSummon` | CS2-17 | Ch 3: the BAJONKA command |
| `flags.clipboardSlapped` | CS2-19 | Ch 3 (signed blind), Ch 7 (read) |
| The word SQUELCH | CS2-10 | every chapter |
| GUITAR SWING, chops, tier 1 nodes | the boss; level 9 on | every chapter; Ch 12 (David) |
| The POTATO BELT sticker, The Mohawk | the barn; the door | every chapter until the collision takes what is not worn |
| `flags.tollClipped`, `flags.bajonkaParked`, `vars.parkTries` | the road | optional lines later |
| `smfos.settings` TIMING | Options | every later rhythm system |
