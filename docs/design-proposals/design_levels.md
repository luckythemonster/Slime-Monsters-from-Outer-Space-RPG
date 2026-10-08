# Vertical Slice Design — Levels & Narrative

Chapter 1, "Coagulation." Title screen to "NEXT: THE POTATO BELT (DRUMMER WANTED)." Target 45–75 minutes. Every cutscene below is written against the commands in `docs/ARCHITECTURE.md` §5 and the interfaces in §12; every map against the format in §4. Where a beat needs something the engine does not yet have, it is called out in **Risks & cuts**, with the cheap fallback.

## Pillars

1. **Every tile has a joke.** Earthbound rule: nothing on a map is scenery. Posters, bills, a Pizza Luce box, the WORK IS LOVE billboard — each returns a line, and a second press often returns a Phoenix "My brain thinks…" line. Lucky's rage and Phoenix's anxiety are the two lenses; the city is the straight man.
2. **Toon Level is an engine setting, not an art note.** 0 = static camera. 1 = shake. 2 = sound-effect letters become physical map objects (CRASH tips dumpsters; the G of KRAAANG kills a pedalboard). 3 = the UI frame tears. 4 = the art ruptures (The Eternity). Every scene below lists its level and the commands that deliver it.
3. **The apartment is home; the street is the straight line through it.** One hub (Cedar Ave), one home (Phoenix's apartment), two excursions (City Sound, Palmer's). The hub is walked twice — day, then night — and the second walk is the same map with the lights on and the cops out.
4. **Bajonka is the save system and the running gag.** She is already everywhere before anyone introduces her. Saving is initialing her clipboard. The contract she drops on Ryan's snare is as many pages as you have saved.
5. **Losing people is the plot.** Brian joins second and quits loud; Ryan joins fourth and quits quiet. The slice ends with Lucky locked magenta and a tour tomorrow. The player should feel the band got *better* and *smaller* in the same ten minutes.

## Scene-by-scene flow

Timings are for a first-time player who reads most things. Cutscene ids are the script ids in `src/data/scripts/ep0.json`. Command names are the §5.1 keys.

### S0 — Title (1 min)
`TitleScene`. Minneapolis skyline at twilight; the pink-and-green contrail draws itself across the sky on a loop; the WORK IS LOVE billboard glitches when the player presses confirm. NEW GAME / CONTINUE (slots 1–3, each showing the save's `map` name and the clipboard page number). Music `title`.

### S1 — Pod bay (3 min, Toon 1→3) — map `pod_bay`
Lucky is a compressed ball of slime (`lucky_ball`, 16×16, rolls). The pod hatch is open; Dad is on the intercom and will not stop. The only thing that matters is the speaker; the bay is for jokes.

**CS-01 `ep0_pod_intro`** (map `onFirstEnter`)
1. `music: "pod_bay"`; `camera fade in 600`.
2. `say who:dad portrait:dad_grille` "I just don't understand the whole nonbinary thing."
3. `say dad` "Why can't you pick a tangible demographic to market yourself to?"
4. `say dad` "If you'd just join The Vanguard, you could be financially successful and oppress people with a dental plan!"
5. `emote player type:…`; unlock.

Four floor `trigger` bands (once each) keep Dad going as Lucky rolls around: "Your mother and I paid for the compression. The least you could do is market yourself." / "There's an opening in Demographic Alignment. Entry level. You'd report to me. Is that so bad?" / "Billy's parents say Billy 'found themself.' In a storage unit. Is that what you want?" / "…are you listening? The speaker light's on. I can see the speaker light." Each trigger has `condition: "!flags.podSpeakerSlapped"`; a twin trigger with the opposite condition plays "mmf. mmmf." instead.

**CS-02 `ep0_speaker`** (interact with speaker)
1. `face player up`; `anim player key:lucky_ball_pseudopod wait:true`; `sfx: "squelch"`.
2. `sprite who:speaker sheet:speaker_slimed`.
3. `say dad` "{speed:slow}mmf. MMMF. mmf—{/speed}"
4. `say lucky` "Better."
5. `set flags.podSpeakerSlapped`.

**CS-03 `ep0_eject`** (interact with the EJECT button inside the pod)
1. `if !flags.podSpeakerSlapped` → `say narrator` "An unnecessarily red button. It is locked out by PARENTAL OVERRIDE." → `say dad` "You can't eject while I'm talking, Lucky. Safety is a core value." → `end`.
2. `say narrator` "An unnecessarily red button."; `choice` ["EJECT", "Not yet"]; on "Not yet" `end`.
3. `sfx: "confirm"`; `music: null`; `camera shake 600 0.02`; `camera flash 120`.
4. `set flags.ejected`; `scene: "freefall"`.
5. On return: `teleport alley x:9 y:8 facing:down` (the crater tile; `alley.onFirstEnter` runs CS-04).

### S2 — Freefall (2 min, Toon 3) — `FreefallScene`
Full-screen special scene. Lucky flattens like a flying squirrel (`lucky_flat`, 32×16); slime sunglasses pop on at the top (`sfx slime_pop`). Vertical autoscroll from cloud layer to skyline to rooftops, 50–60 s. Left/right steers; the RenderTexture contrail is painted behind Lucky in pink and green. Seven WORK IS LOVE billboards scroll past on rooftops; crossing one glitches it (`sfx glitch`) and increments `vars.billboardsTagged`. No fail state. Ends on a snowy alley rushing up, cut to black, `sfx crash`. The count pays off on the street later (an NPC's boss cried).

### S3 — The alley (6 min, Toon 2) — map `alley`

**CS-04 `ep0_crash`** (map `onFirstEnter`)
1. Black. `ambient wind`. `camera fade in 400`. Phoenix stands at (12,6) facing left in `phoenix_trash` (hoodie, trash bag).
2. `say phoenix` "{speed:slow}…{/speed}" (one dot per 600 ms; a sigh you can read).
3. `wait 400`; `sfx: "crash"`; `camera shake 900 0.03`; `camera flash 120`.
4. `spawn id:crater sprite:crater x:9 y:8`; `spawn id:crash_fx sprite:sfx_crash x:10 y:4` (Toon 2: the word CRASH is a 48×16 object); `move crash_fx path:"RRR" wait:true` — as it passes each dumpster, `sprite dumpster_N sheet:dumpster_tipped` + `sfx hit`; `despawn crash_fx`.
5. `sprite player sheet:lucky_puddle`; `wait 900`.
6. `anim phoenix key:phoenix_push_glasses wait:true`.
7. `say phoenix portrait:phoenix_tired` "My brain thinks you're going to have to pay the city for that pothole."
8. `anim player key:lucky_coagulate wait:true` with `sfx slime_pop` ×3 on frames 1/3/5; `sprite player sheet:lucky`.
9. `say lucky` "My dad runs Demographic Alignment for the Vanguard. He thinks a personality is a market segment." / "Planet California is one billboard with a dental plan." / "My old band's still back there. Or they're not. I didn't check."
10. `face phoenix toward:player`; `say phoenix` "I came here for college. The economy fell over. Rent didn't." / "I'm a permanent resident of the Midwest now. It's a medical condition."
11. `spawn id:aura sprite:aura_link x:10 y:7` (2-frame glow bridging them); `sfx feedback`; `say narrator` "They are made of the same stuff."; `despawn aura`.
12. `say lucky` "I want to make the loudest, most obnoxious noise possible until this whole empire gets a migraine."
13. `say phoenix` "Beats the day job."
14. `sfx: "drone_whine"`; `spawn id:drone sprite:drone x:21 y:2 facing:left`; `move drone path:"LLLLLLLDDD" speed:run wait:true`; `say drone` "ASSET LOCATED. INITIATING RETRIEVAL. PLEASE HOLD FOR A REPRESENTATIVE."; `emote player !`.
15. `battle: "tutorial_drone"`, `onLose: "gameover"`, `onWin`: `despawn drone`; `spawn id:drone_wreck sprite:drone_wreck x:14 y:8`; `party add phoenix` (Phoenix's `onJoin` equips Beat-up P-Bass + Trash Bag, `give money 4`); `set flags.metPhoenix, flags.droneDefeated, flags.phoenixJoined`.
16. `face phoenix left`; `camera pan` to the milk crate by the back door where Bajonka now sits (`bajonka_clipboard`, condition `flags.bajonkaSeen` — set on the next line so she pops in during the pan: `set flags.bajonkaSeen`); `say phoenix` "That dog's been by the back door since I started here. My brain thinks she's the landlord."; `camera follow player`.
17. `say phoenix` "Come on. I've got a bin you can sleep in."; unlock. (Phoenix now follows as a party trailer.)

**B1 — Tutorial battle `tutorial_drone`.** Vanguard Retrieval Drone (32×32). Round 1: only ATTACK is lit; the HUD shows Lucky's slime color dropping from pastel to magenta as HP falls (sheet swaps at 70/40%). Round 2: RIFF unlocks ("Power Chord"). Round 3 `onRound(3)`: Phoenix walks into the frame Chrono-Trigger-style, swings the trash bag (`anim`, "Garbage" status on the drone: −ACC). At 30% HP the drone says "RETRIEVAL ABORTED. BILLING ASSET." and tries to flee; the fight ends on the next hit. Drops: Drone Core (key).

### S4 — Street, first pass (3 min, Toon 1) — map `street_cedar` (day, `flags.hubOpen` false)
Exit the alley west onto Cedar Ave. Only the apartment entrance is open; café, pawnshop, Palmer's and the light rail are "closed" with one-line reasons (café: "Phoenix: After. I need to lie down in a specific way."). Three NPCs are out; no enemies yet. The WORK IS LOVE billboard is up on the roofline, not yet glitching.

### S5 — Apartment: the cosmic Craigslist ad (5 min, Toon 2) — map `apartment`
Free roam first (posters, bills, fridge, the bin). Interacting with the bass amp runs:

**CS-05 `ep0_signal`**
1. `move phoenix` to (6,5); `face phoenix toward:player`.
2. `say phoenix` "We need a drummer. I could put a flyer up at the coffee shop…"
3. `say lucky` "Too slow. I'm going to ask the universe."
4. `anim player key:lucky_jack_in wait:true`; `sprite player sheet:lucky_glow`; `sfx feedback` (rising, 2 s).
5. `camera shake 1400 0.02`; `spawn id:wave sprite:soundwave x:3 y:6` (anim: 4 expanding rings); `camera flash 80` ×3 at 200 ms. **Toon 2:** `ui.flash` plus the dialogue frame pushed 4 px outward for the flash duration (see Risks: `ui.bulge`).
6. `music: "signal"`; `camera fade out 300`; `teleport rooftops x:0 y:7`; `camera pan x:512 y:112 ms:4000` across the strip; as the pan crosses the PRODUCTIVITY IS FREEDOM billboard: `sprite billboard_prod sheet:billboard_prod_glitch`; `sfx glitch`.
7. `camera fade out 300`; `teleport garage_north x:7 y:11`; `camera fade in 600`. Ryan at the kit (`ryan`, sticks up, idle anim).
8. `wait 1200`; `spawn wave` sweeping L→R over him; `anim ryan key:ryan_freeze wait:true` (sticks hover; eyes two white pixels).
9. `say ryan_caption` "[…]"; `wait 900`; `say ryan_caption` "[Huh.]"
10. `caption "END PART 1" 2000`; `set flags.signalSent`.
11. `caption "ONE WEEK LATER" 1800`; `teleport apartment x:5 y:6 facing:down`; `music: "apartment"`; `set flags.weekLater, flags.hubOpen`; `run ep0_week_later`.

**CS-06 `ep0_week_later`**: Phoenix on the couch. `say phoenix` "Nobody came." `say lucky` "The universe is slow." `say phoenix` "The universe is a flyer at the coffee shop. I made one. Hard Luck Café. Corkboard. Go." `give item:flyer_blank`. Unlock.

### S6 — Street, hub open (8 min, Toon 1) — `street_cedar` day
Everything opens: café, pawnshop, light rail (locked until Brian: "The train is here. The reason to take it isn't."). Enemies spawn (two drones wander the east end, a Market Research Intern chases outside the pawnshop, a Rental Scooter patrols the road). The billboard now glitches when Lucky walks under it. The Pizza Luce box is in the snow by the bus shelter.

### S7 — Coffee shop: the flyer (5 min, Toon 0) — map `coffee_shop`
**CS-07 `ep0_flyer`** (interact corkboard, `inventory.has('flyer_blank')`): `say narrator` "A corkboard. Nine flyers for the same ska band."; `choice` ["DRUMMER WANTED — MUST PLAY FAST", "DRUMMER WANTED — NO COPS", "SEEKING RHYTHMIC VESSEL FOR COSMIC PURPOSE"] → `set vars.flyerText 0|1|2`; `take flyer_blank`; `sprite corkboard sheet:corkboard_flyer`; `sfx item`; `set flags.flyerPosted`; barista: "Give it an hour. Or a day. Time's weird in here."

Leaving the café fires **CS-08 `ep0_brian_arrives`** on the street (trigger at the café door, condition `flags.flyerPosted && !flags.brianJoined`):
1. `spawn id:brian sprite:brian x:34 y:10 facing:left` (pedalboard case held like a briefcase); `move brian path:"LLLLLLLLLLLL" wait:true`; `emote brian !`.
2. `say brian` by `vars.flyerText`: 0 "You the 'must play fast' people? I play at a very reasonable tempo." / 1 "'No cops.' Love it. I'm in insurance." / 2 "'Rhythmic vessel'? I googled it. I think it's me."
3. `say brian` "I play guitar. I've got a $2,000 pedalboard and a completely normal amount of free time."
4. `say phoenix` "The flyer says drummer." `say brian` "I read it as 'band.'"
5. `say lucky` "…Can you play loud?" `say brian` "I can play *accurately*."
6. `party add brian`; `ui.toast` "Brian joined. (Second.)"; `set flags.brianJoined`.
7. `say brian` "You need a drummer. I know a guy. My cousin's roommate up north. Doesn't talk. Never misses." `anim brian key:brian_phone`.
8. `camera fade out 300`; `teleport garage_north x:7 y:11`; Ryan exactly as left a week ago, sticks still hovering. `sfx phone_ring` ×2 (a wall landline). `anim ryan key:ryan_unfreeze wait:true` (sticks come down). `move ryan path:"LLL"`.
9. `say brian portrait:brian_phone` "Ryan. It's Brian. From the Zappa cover band. I've got a thing." `say ryan` "Yep." `sfx click`.
10. `teleport street_cedar` (same tiles); `say brian` "He's in. City Sound, Room 4, tonight. Take the train."
11. `say lucky` "The universe came through." `say brian` "I called him." `say lucky` "The UNIVERSE." `say phoenix` "My brain thinks you're both right and that it doesn't matter."
12. `set flags.brianCalledRyan`; the light rail exit's condition flips; unlock.

### S8 — City Sound hallway (3 min, Toon 0→1) — map `city_sound_hall`
Light rail = `exit` with fade and `caption "TWENTY MINUTES OF LIGHT RAIL LATER" 1500`. Hallway free roam (night manager, ska band, sticker board). Walking past Room 3 fires:

**CS-09 `ep0_ryan_arrives`**
1. `sfx door`; `spawn id:ryan sprite:ryan_loaded x:1 y:6` (hardware stack, 16×40); `move ryan path:"RRRRRRRRRRRRRRRRR" speed:walk wait:true` to outside Room 4.
2. `say phoenix` "My brain thinks that's structurally impossible." `say brian` "That's Ryan."
3. Bajonka sits at (20,7) with clipboard. `face ryan down`; `anim ryan key:ryan_nod wait:true`; `wait 400`; `sfx sneeze`; `anim bajonka key:bajonka_sneeze`.
4. `camera fade out 250`; `sprite bajonka sheet:bajonka` (clipboard gone); `setEntity room4_door behavior:open`; `move ryan path:"U"` (through the door) during black; `camera fade in 250`.
5. `say phoenix` "My brain has questions. My brain is choosing not to ask them."
6. `set flags.ryanArrived`; unlock. Bajonka is the save point here (the canonical one).

### S9 — Room 4: the setup and the audition (10 min, Toon 1→3) — map `room4`
**CS-10 `ep0_room4_setup`** (`onFirstEnter`)
1. `music: "city_sound_muffled"`; `sprite player sheet:lucky_puddle`; `sprite phoenix sheet:phoenix_puddle` ("relaxed, they look less humanoid").
2. `anim ryan key:ryan_tighten` (cymbal stand, loops); `say narrator` "He does not stare at the alien slime monsters. He does not ask questions. He tightens a cymbal stand."
3. `say lucky` "You made good time from the transmission. You cool with playing fast?" `say ryan` "Yep."
4. `say brian` "{speed:fast}I called him.{/speed}" (Lucky's sprite does not turn.)
5. `say phoenix` "{color:gray}psst.{/color} My brain thinks we should have asked his rate first. We have exactly four dollars and a half-ounce of weed."
6. `sfx stick_click` ×2; `run ep0_audition`.

**CS-11 `ep0_audition`** (Toon 3)
1. `sprite player sheet:lucky`; `anim player key:lucky_stomp wait:true`; `sfx pedal`.
2. `say lucky` "{shake}One, two, three, four!{/shake}"
3. `sfx drum_hit`; `camera flash 100`; `camera shake 1500 0.04`; **UI tear**: `ui.setFrame('torn')` for 1.5 s (Risks).
4. `spawn id:splat sprite:slime_splat x:10 y:3` anim; `sprite ryan sheet:ryan_slimed`.
5. `music: "boss_audition"`; `battle: "audition"`, `onWin: [ {"run": "ep0_contract"} ]`, `onLose: "gameover"`.

**B2 — Mid-boss AUDITION.** Enemies: WHRNNNG (48×48 letter wall, 120 HP) and THUD-THUD ×2 (32×32). Party: Lucky, Phoenix, Brian. Ryan is on the field as an uncontrollable ally: each round `onTurnStart` rolls Fill (big damage to a random enemy) or Splatter (10 damage to the whole party and "Slimed": +ATK, −DEF). Captions are the clock: `onRound(1)` "[Well. I guess my arms belong to the goo now.]"; `onRound(3)` "[Tempo's good, though. Very steady.]"; `onRound(5)` "[Ride cymbal sounds a bit tinny. Should probably buy a new one if I survive this.]" The fight ends on round 6 (the song crashes to a halt) or when both letters die, whichever first. Rewards: 60 XP, Tinny Ride Cymbal.

**CS-12 `ep0_contract`**
1. `music: null`; `sfx cymbal` (6 s decay); `say narrator` "Slime drips off the ceiling. And the cymbals. And Ryan."
2. `say lucky` "Holy shit. You're a machine."
3. `say ryan_caption` "[I am literally a hostage.]"; `say ryan` "So, do I get the gig?"
4. `spawn id:bajonka sprite:bajonka_contract x:12 y:3`; `move bajonka path:"DDL" wait:true`; `anim bajonka key:bajonka_drop wait:true`; `spawn id:contract sprite:contract x:11 y:5`; `sfx thud`; `move bajonka path:"R"`; `face bajonka left`; `anim bajonka key:bajonka_sit`.
5. `say narrator` "Bajonka drops a {var:contractPages}-page, legally binding band agreement onto the snare, turns around, and sits down." (`vars.contractPages = 3 + vars.saveCount`, set at the top of the script.)
6. `party add ryan`; `give item:band_agreement`; `set flags.auditionDone, flags.ryanJoined`.
7. `save: true` (Bajonka is right there; the prompt reads "INITIAL HERE TO ACKNOWLEDGE RHYTHM SECTION").
8. `caption "ONE MONTH LATER" 1800` with `style: "tape"` (duct-taped card); `set flags.monthLater`; `teleport room4 x:5 y:8` (same map, re-dressed by conditions: Brian's pedalboard object and iced coffee appear; the contract is gone); `run ep0_month_later`.

### S10 — ONE MONTH LATER: Brian (8 min, Toon 0→2→1) — `room4`
**CS-13 `ep0_month_later`**
1. `music: "rehearsal_brian"` (the band's song, but played straight: 50 % pulse, no accents, no swing). Brian at the pedalboard, `anim brian_strum` (perfectly still, only the hand moves).
2. `face brian toward:player`; `say brian` "Do we really need all the political stickers? We're going to alienate the market."
3. `face brian left`; `say brian` "Hey, man, can you turn the bass down?" `say phoenix portrait:phoenix_droop` "I'm not a 'man,' Brian. And no."
4. `say ryan_caption` "[I give this guy three weeks. Tops.]"
5. `music: "rehearsal"` (the chorus; the slime syncs); `spawn id:aura sprite:aura_link x:4 y:6`; `wait 600`.
6. **Toon 2.** `spawn id:kraaang sprite:sfx_kraaang x:5 y:2` (the word, 80×16, letters K-R-A-A-A-N and a detachable G); `sfx kraaang`; `camera shake 500 0.02`; `spawn id:g sprite:sfx_g x:10 y:2`; `anim g key:g_swing wait:true`; `move g path:"DD" speed:run wait:true` into the coffee cup tile.
7. `sfx coffee_spill`; `sprite coffee_cup sheet:coffee_cup_spilled`; `wait 300`; `sprite pedalboard sheet:pedalboard_fried`; `sfx sparks` ×3; `camera flash 60` ×2; `despawn kraaang`; `despawn g`; `music: null`.
8. `say brian portrait:brian_red` "I can't work like this! I hate this weird, creative shit! Can't we just play normal music?!"
9. `set flags.pedalboardFried`; `caption "ONE MONTH BEFORE THE POTATO BELT TOUR" 1800 style:tape`; `say phoenix` "My brain thinks that caption knows something we don't."
10. `move brian path:"LLRRLLRR" speed:walk` (pacing, no wait); `say brian` "I'm not here to have fun." / "I'm not into this creative shit." / "You people are wasting my time." (balloons use `{shake}`).
11. `sfx pop`; `sprite player sheet:lucky_bristle`; `say narrator` "Lucky unplugs. The slime on their shoulders stands up like a cat's."
12. `anim phoenix key:phoenix_mute`; `move phoenix path:"L"`.
13. `move player` to adjacent Brian; `face player toward:brian`; `say lucky portrait:lucky_calm` "Listen to me very carefully, Brian."
14. `say lucky portrait:lucky_eyes` "You need to stop being an asshole, or you are fired."
15. `say lucky` "We clearly have some fundamental differences in how we think a band should work, but that's something we can discuss. What I can't do is work with an asshole, so whatever's going on at home or wherever, don't bring it to rehearsal."
16. `camera flash 80`; `spawn id:xray sprite:brain_xray x:9 y:5` (32×32, gears grind, spark, spin backward); `sfx gears`; `wait 1500`; `despawn xray`; `sprite brian sheet:brian_red`.
17. `say brian portrait:brian_red` "{shake}Did you just say my foundation is broken?! Are you calling my house crooked?!{/shake}"
18. `anim drips key:drips_freeze` (the ambient ceiling drip object stops mid-air); `wait 1200`.
19. `say phoenix portrait:phoenix_baffled` "My brain thinks you might be having a stroke."
20. `say lucky` "I literally didn't say anything about a house…" `say brian` "I know what you meant! My property values are fine! You're just jealous of my equity!"
21. `anim brian key:brian_pack wait:true`; `move brian path:"DDDLLL" speed:run wait:true`; `sfx door_slam`; `camera shake 300 0.02`; `despawn brian`; `party remove brian`; `give item:fried_pedalboard`; `ui.toast` "Got FRIED PEDALBOARD."
22. `wait 1500`; `say ryan_caption` "[Well. His timing was terrible anyway.]"
23. `sfx door` (creak); `spawn id:bajonka sprite:bajonka x:4 y:11`; `move bajonka path:"UUURR" wait:true`; `anim bajonka key:bajonka_drop`; `spawn id:gig_flyer sprite:flyer_crumpled x:7 y:7`; `sfx sneeze`; `move bajonka path:"LLDDD" wait:true`; `despawn bajonka`; `set flags.brianQuit`; unlock. Phoenix: "My brain thinks she's making a point."

Picking up the flyer (**CS-14 `ep0_gig_flyer`**): `ui` insert window with the `flyer_gig` sprite; `say narrator` "GIG TONIGHT: PALMER'S BAR — NO GUITAR SOLO NECESSARY." `say lucky` "Palmer's. Isn't that—" `say phoenix` "Where I work. Yes. My brain thinks this is fine." `set flags.gigFlyer`. The hall's exit to the light rail now lands on `street_cedar` at night.

### S11 — Street at night (5 min, Toon 1) — `street_cedar` night
Same map, night dressing (lit windows, neon, blue overlay). Cops patrol in pairs ("unauthorized gathering" sweep); the Intern is gone; a tall stranger stands outside Palmer's: "Whoa, man. The stars are heavy tonight." Pawnshop open late. Apartment reachable (nap, save, read the bills one more time). Palmer's front door opens with `flags.gigFlyer`.

### S12 — Palmer's: the set (12 min, Toon 1→3→4) — map `palmers`
Free roam in the bar (crowd, jukebox, pull tabs, Bajonka on a stool behind the bar = last save). Stepping onto the stage with the party fires:

**CS-15 `ep0_palmers_set`**
1. `move` Phoenix to bass side, Ryan to kit; `sprite ryan sheet:ryan_slimed` ("already a menacing, bubbling mass"); `say narrator` "The stage is six inches off the floor. It is the tallest thing Lucky has ever stood on."
2. `camera pan` to the cop at (22,11): pristine leather jacket, price tag, glued mohawk. `say cop` "{speed:slow}Dispatch, I have located the unauthorized slime gathering. Stand by.{/speed}" `camera follow player`.
3. `face player up`; `emote ryan ♪`; `face player left`; `emote phoenix ♪`; `say narrator` "No Brian to ruin the mix."
4. `sfx power_chord`; `camera shake 800 0.03`; `spawn id:wave sprite:shockwave x:7 y:9`; `move wave path:"RRRRRRRRRRRRRRR" speed:run`; each crowd NPC it passes plays `hair_back`; at (22,11): `sprite cop sheet:cop_nomohawk`; `spawn id:mohawk sprite:mohawk x:22 y:10`; `move mohawk path:"RRU" speed:run wait:true` into the tall stranger's beer; `sfx splash`; `say stranger` "whoa, man."
5. `say ryan_caption` "[No obnoxious guitar solos. Just pure, unadulterated rhythm. The slime is pulsating in 7/8 time. I can work with this.]"
6. `music: "the_set"`; `battle: "palmers_set"`, `onWin: [ {"run": "ep0_aftermath"} ]` (unlosable, see B3).

**B3 — Boss THE SET AT PALMER'S** (Toon 3→4). Phase 1 enemies: Undercover Cop + CROWD HOSTILITY (a 48×48 non-attacking "meter enemy" whose HP is the room's mood). On the cop's first turn he calls backup: RIOT COP ×2 walk in ("Stand by" is the summon). The shared POCKET gauge fills with every party action, faster when Lucky and Phoenix attack back-to-back. Ryan is uncontrollable and plays every turn. Gauge milestones inject captions and sheet swaps: 50 % "[The slime is pulsating in 7/8 time.]"; 75 % "[I've been fighting the possession. That was a mistake.]" → `transform ryan ryan_purple`; 100 % → **THE ETERNITY** (Toon 4): inputs lock; battle background swaps to `bg_cosmic`; HUD swaps to the torn frame; Ryan's sprite becomes `eternity` (64×64, purple-black); DOOM / CRACK / THUD letter sprites fall in with screen shake on each; `text` "[Rhythm achieved.]"; every enemy's HP goes to 0 in one event each; a letter swings up (`anim`), background swaps to `bg_palmers_roofless`; `win`. The gauge fills regardless of KOs, so the fight cannot be lost; a party KO just means the rest of the set is a drum solo (caption "[Nobody else is playing. That's fine.]"). ENCORE rating from party HP at 100 %.

### S13 — Aftermath (4 min, Toon 1) — map `palmers_rubble`
**CS-16 `ep0_aftermath`**
1. `teleport palmers_rubble x:8 y:9`; black; `sfx cymbal` (long); `ambient wind`; `camera fade in 1500`.
2. `say narrator` "The dust settles. The night sky is where the ceiling used to be."
3. `sprite player sheet:lucky_dust`; `sprite phoenix sheet:phoenix_dust`; `anim ryan key:ryan_resolidify wait:true` (`eternity` → `ryan_purple` → `ryan_slimed`), holding two intact sticks.
4. `say lucky` "Okay. That is our sound."
5. `say phoenix` "My brain thinks we are officially domestic terrorists."
6. `say ryan` "I think I broke the space-time continuum on that snare fill."
7. `wait 1200`; `face ryan down`; `say ryan_caption` "[I could have killed every person in this room.]"; `face ryan up` (at the sky).
8. `say ryan` "I quit."
9. `sprite player sheet:lucky_rage`; `camera shake 200 0.01`; `say lucky` "We just found it. We just FOUND it—"
10. `choice` ["RAGE", "PLEAD", "JOKE"] → `set vars.quitResponse`. RAGE: `say lucky` "{shake}You don't get to be scared of the best thing you've ever done!{/shake}" PLEAD: "One more show. One. You don't even have to let go." JOKE: "We'll put you on the flyer as a weather event."
11. `say ryan` "Yep." (all branches); `move ryan path:"UUUUUU" speed:walk wait:true`; `despawn ryan`; `party remove ryan`; `set flags.ryanQuit, flags.luckyRageLocked`.
12. `say phoenix` "My brain thinks he's scared." `say lucky portrait:lucky_rage` "I don't care what he is."
13. **Stinger.** `sfx rubble`; `anim drywall key:drywall_lift`; `spawn id:bajonka sprite:bajonka_keys x:14 y:8`; `move bajonka path:"LLL" wait:true`; `give item:van_keys`; `give item:tour_itinerary`; `ui` insert window: itinerary with "POTATO BELT: TOMORROW" circled in red.
14. `say lucky` "We don't have a drummer."; `sfx sneeze`.
15. `set flags.ch1Complete`; `caption "NEXT: THE POTATO BELT" 2200`; `caption "(DRUMMER WANTED)" 1600`; `save: true` ("INITIAL HERE TO END CHAPTER 1"); fade to Title.

## Maps

| id | Name | Size (tiles) | Tileset | Music | Exits | Save |
|---|---|---|---|---|---|---|
| `pod_bay` | Vanguard drop-pod bay | 16×14 | `vanguard_ship` | `pod_bay` | EJECT → Freefall | — |
| (scene) | Freefall over Minneapolis | — | `sky` strips | `freefall` | → `alley` | — |
| `alley` | Alley behind Palmer's | 24×14 | `minneapolis` | `snow` | W → `street_cedar` (38,12) | milk crate |
| `street_cedar` | Cedar Ave (West Bank) | 40×24 | `minneapolis` (+night overlay) | `snow` / `snow_night` | E → `alley`; doors → `apartment`, `coffee_shop`, `palmers`, shop; rail → `city_sound_hall` | outside café |
| `apartment` | Phoenix's apartment | 16×14 | `apartment_int` | `apartment` | S → `street_cedar` (12,9) | couch arm |
| `coffee_shop` | Hard Luck Café | 20×14 | `coffee_int` | `coffee` | S → `street_cedar` (20,9) | — |
| `rooftops` | Signal montage strip | 48×14 | `sky` | `signal` | cutscene only | — |
| `garage_north` | Ryan's garage | 16×14 | `garage_int` | `garage` | cutscene only | — |
| `city_sound_hall` | City Sound, hallway | 28×12 | `city_sound_int` | `city_sound_muffled` | W stairs → rail → `street_cedar`; door → `room4` | outside Room 4 |
| `room4` | City Sound, Room 4 | 14×12 | `city_sound_int` | per scene | SW door → hall | (CS-12) |
| `palmers` | Palmer's Bar | 26×14 | `palmers_int` | `palmers` | S → `street_cedar` (8,9) | stool behind bar |
| `palmers_rubble` | Palmer's, leveled | 26×14 | `rubble` | none (wind) | none (chapter ends) | end of chapter |

### `pod_bay` — 16×14, one screen
**Layout.** Steel floor, a catwalk along the top row, three drop pods along the bottom edge (pod 2 open, Lucky inside at (7,11)). The intercom speaker is a 2×2 object on the north wall at (7,2), grille glowing. A viewport at (12,2) shows Planet California: a planet made of billboards. Vending machine at (2,3). Plaque at (4,2). Mop and bucket at (14,11).
**Exits.** EJECT only.
**NPCs.** Dad (speaker; not walkable, not a person; "Dad is a speaker. Dad has always been a speaker.").
**Interactables.** Speaker (CS-02). EJECT button inside pod 2 (CS-03). Laser guitar case strapped to the pod wall: "Lucky's laser guitar. The only thing from home worth the fuel." (equips it; teaches the Equip menu with a one-line toast). Pod 3 nameplate: "RESERVED — RUBEN, B." → `say lucky` "…They're late. They're always late." (`flags.readBillyPod`). Vending machine: "VANGUARD VEND. DENTAL PLAN: SOLD OUT. DEMOGRAPHIC: SOLD OUT. WATER: $40." Plaque: "EMPLOYEE OF THE QUARTER: DAD (41 CONSECUTIVE QUARTERS)." Viewport: "Every surface is a billboard. One of them says WORK IS LOVE. Lucky has never seen it turned off." Mop: "Somebody's job. Not yours anymore."
**Enemies.** None. **Triggers.** Four Dad floor bands (above).

### Freefall — `FreefallScene`
Autoscroll layers (clouds, skyline, rooftops) at 3 speeds; seven billboard sprites at fixed scroll offsets; Lucky at the bottom third, 2 px/frame steering; contrail painted into a RenderTexture that scrolls with the rooftop layer. HUD: a tiny "TAGGED n/7" in the corner. Ends in the alley approach frame.

### `alley` — 24×14
**Layout.** The bar's back wall runs along the north (brick, a lit window at (16,3), a steel door "PALMER'S — DELIVERIES" at (18,4)). Snow and slush ground; a row of four dumpsters (object entities) at y=5, x=6..13; the crater at (9,8) after the crash; a chain-link dead end at the east with a bike frozen to it; the west end opens to Cedar Ave. Bajonka's milk crate at (19,6).
**Exits.** West edge (0,8–10) → `street_cedar` (38,12).
**NPCs.** Phoenix (until joined). Bajonka (save; condition `flags.bajonkaSeen`).
**Interactables.** Crater: "Lucky's pothole. It glows faintly. Someone is going to be billed." Tipped dumpsters: "A dumpster, on its side. Inside: nine Pizza Luce boxes, all empty, all someone's Tuesday." Drone wreck: "RETRIEVAL DRONE (DECEASED). Its little screen still says ASSET LOCATED." Steel door: "EMPLOYEES ONLY. (Phoenix: 'I'm an employee. I'm not going in there.')" Frozen bike: "Someone has been paying for that U-lock since 2019." Lit window: silhouettes of the bar; "It sounds warm in there. It isn't."
**Enemies.** The tutorial drone, scripted. Nothing on-map.
**Triggers.** `onFirstEnter` CS-04.

### `street_cedar` — 40×24, the hub
**Layout.** Cedar Ave runs west–east through rows 11–13 (road, parked cars, a plowed snowbank on each side). North sidewalk (rows 8–10) fronts, west to east: Palmer's Bar (neon sign over (4..8,6), door at (6,8)), the Towers entrance (Phoenix's building; colored-panel tiles, door at (12,8)), Hard Luck Café (door at (20,8)), Cedar Pawn & Loan (door at (28,8)), a bus shelter at (33,9) with the Pizza Luce box beside it. South sidewalk (rows 14–16): the Cedar-Riverside light rail platform (18..24, 17) with an `exit` at (21,16) (condition `flags.brianCalledRyan`); a hydrant; a bike rack; the alley mouth at the east end (38,12). The WORK IS LOVE billboard is an `over`-layer object on the roofline at (14..19, 2..4), sheet swaps to `_glitch` while the player is within 3 tiles and `flags.signalSent`.
**Exits.** East (39,11–13) → `alley` (1,9). Doors as above. Rail → `city_sound_hall` (2,6) with the caption.
**NPCs (day).** Snow Shoveler (24,9): "I've shoveled this square four times today. The city calls it a job. I call it a relationship." Cyclist (30,15): "It's not cold if you're angry enough." Busker (9,15): "I take requests. I can't play them. But I take them." Shorts Guy (35,15): "Twelve degrees. Shorts weather." Crust Punk + dog (2,15): "Her name's Also Bajonka. No relation." Property Manager sign on the Towers: "RENT DUE. ALSO: RENT INCREASE. ALSO: RENT." Office Worker (after Freefall): "Did you see the sky last night? {var:billboardsTagged} billboards went down. My boss cried."
**NPCs (night).** Shoveler and Cyclist gone; Tall Stranger outside Palmer's (5,10): "Whoa, man. The stars are heavy tonight." Smoker (26,9): "Palmer's? Tonight? I heard there's a drummer." Cop pair patrolling (enemy, below).
**Interactables.** Pizza Luce box: "A Pizza Luce box in the snow. Still warm? No. Nothing in Minneapolis is still warm." → one Pizza Luce Slice, once. Bus shelter ad: "WORK IS LOVE. (smaller:) LOVE IS A VANGUARD TRADEMARK." Hydrant flyer: "LOST: MOHAWK. SENTIMENTAL VALUE. NO QUESTIONS." (appears only after the gig; before it reads "LOST: CAT. ANSWERS TO 'NO.'") Rail ticket machine: "$2.00. (Phoenix: 'My brain thinks we are, technically, fare evaders.')" Parked car: "A Subaru. Of course it's a Subaru."
**Enemies (day, `flags.weekLater`).** Vanguard Drone ×2 wander (radius 3) at (34,10) and (36,14), sight 4. Market Research Intern chase at (27,10), sight 5. Rental Scooter patrol path `RRRRRRRRLLLLLLLL` along row 12. Each clears via `setOnWin`.
**Enemies (night, `flags.gigFlyer`).** Cop Duo ×2 patrols on the sidewalks (encounter `street_cop_duo`); Rental Scooter stays.
**Triggers.** Café-door trigger (CS-08). Billboard proximity glitch (a 7×3 trigger at the roofline, not once).

### `apartment` — 16×14, home hub
**Layout.** One room. Door at (12,13). Couch along the west wall at (2..4,6) (nap = full heal, fade, `sfx snore`; also where "ONE WEEK LATER" lands). Bass amp at (3,9). Kitchenette along the north (fridge at (10,2), sink, radiator at (14,5)). Window at (6,1) looking at the billboard. Bills stacked on the coffee table (6,7). Four posters (`deco`): "RAT FIGHT — DULUTH — ALL AGES"; "GREAT BIG THING CRAWLING ALL OVER ME"; "THE DENIM BOYS: A NIGHT OF DENIM"; "HARD LUCK CAFÉ OPEN MIC (NO MICS)". Lucky's bed: a Tupperware bin at (13,9). Bathroom door at (1,2), locked. Bajonka on the couch arm (save) once `flags.bajonkaSeen`.
**Exits.** Door → `street_cedar` (12,9).
**NPCs.** Phoenix (idle near the kitchenette when not in the party trailer; mostly in the party).
**Interactables.** Bass amp: CS-05 before `signalSent`; after: "It hums at a frequency Phoenix describes as 'rent.'" Bills: cycles five — "RENT: PAST DUE." / "STUDENT LOANS: PAST DUE, FOREVER." / "VANGUARD SPECTRUM INTERNET: PAST DUE. (You do not have internet.)" / "PARKING TICKET. (Phoenix does not own a car.)" / "CITY OF MINNEAPOLIS: POTHOLE, 1 (one). $4,000." — the last appears after the crash; reading all five sets `flags.billsRead` (Phoenix: "My brain thinks we should frame that one."). Fridge: "A half-ounce of weed and a Pizza Luce slice. Assets." (slice is takeable once). Window: "The billboard says WORK IS LOVE. It has never once been turned off." (glitches after the signal). Radiator: "It clanks in 7/8. Phoenix says it's the building settling. It is not settling." Bin: "It's a bin. It's a big bin. It's yours." Bathroom: "Phoenix: 'There's a mirror in there. I don't recommend it.'" Posters each get one line (Rat Fight: "A Duluth band. Phoenix says the singer screams like he's being evicted.").
**Enemies.** None. **Triggers.** None beyond the amp.

### `coffee_shop` — 20×14, Hard Luck Café
**Layout.** Counter along the north (barista at (4,3)); corkboard at (16,2); six tables; bathroom door at (18,5) with a sign. Door at (10,13).
**NPCs.** Barista: "Coffee's $3. Hot water's free. Nobody's happy either way." (sells Gas Station Coffee — `shop: "cafe"`). Screenwriter (table 1): "It's about a slime monster who—no. No it isn't. It's about a divorce." Poet (table 2): "I'm working on a piece about snow. It's called 'Snow.' It's finished." Internship Kid (table 3): "Vanguard internship application. Question 9: 'Describe your demographic.' I put 'tired.'" Cold Brew Guy (table 4): "This is one cold brew. I've been here six hours. It's a system." Brian (table 5, after `flyerPosted`, before joining — he's spawned by CS-08 outside instead; table 5 stays empty with his iced coffee ring: "A ring on the table. Someone very normal was here.").
**Interactables.** Corkboard: CS-07; afterward reads the other flyers: "KEYBOARDIST WANTED. Must own keyboard. We do not own a keyboard. We own a dream." / "SKA. SKA SKA SKA SKA. (A phone number.)" / "FREE COUCH. HAUNTED. FIRM." Bathroom sign: "PLEASE DO NOT ASK THE UNIVERSE FOR ANYTHING IN HERE." Tip jar: "Tips: $0.75 and a guitar pick." (interact: take the pick? Phoenix: "My brain thinks that's theft." — no take).
**Enemies.** None.

### `rooftops` — 48×14 cutscene strip
Skyline silhouettes, two billboards (PRODUCTIVITY IS FREEDOM at x=14, WORK IS LOVE at x=38), highway lights, then pines. Camera pans; no player.

### `garage_north` — 16×14 cutscene map
Snow outside the open door (a pine wall), kit in the middle, wall phone at (3,4), a space heater that does nothing. Two uses: the wave (CS-05) and the call (CS-08).

### `city_sound_hall` — 28×12
**Layout.** A corridor two tiles wide from the stairs (2,6) east to a dead end; doors to Rooms 1–6 on the north wall (Room 4 at (20,5)); a night-manager desk at (5,4); vending machine (8,4); a bulletin board (12,4); bathroom (26,5). Every wall tile is a sticker tile (four variants). Bajonka outside Room 4 at (20,7).
**Exits.** Stairs → rail → `street_cedar` (21,15). Room 4 door → `room4` (3,10).
**NPCs.** Night Manager: "Room 4. Cash only. Don't put stickers on the stickers." Ska Band ×3 loading out (trombone): "Ska's coming back." / "It never came." / "Checkmate." Noise Guy in Room 2's doorway: "I'm the only member. I'm also the audience. Reviews are mixed." Tuning Guy: "I've been tuning for forty minutes. The E is fine. I'm not."
**Interactables.** Bulletin board: "BASSIST WANTED (NOT YOU, GREG)." / "DRUMMER AVAILABLE: 13/8 ONLY. SERIOUS INQUIRIES." (Sticky seed) / "LOST: CLIPBOARD. IF FOUND, YOU HAVE ALREADY SIGNED." Vending: "Everything is $1.25. Everything is sold out." Room doors 1–3, 5–6: muffled riff SFX per door (filtered loops) and one line each ("Room 6 has been playing the intro to the same song since October").
**Enemies.** None. **Triggers.** Room 3 proximity (CS-09).

### `room4` — 14×12
**Layout.** Door at (3,10). Drum kit NE at (10..12,2..4). Lucky's stickered amp W at (2,5); Phoenix's amp at (2,7); mic stand center (7,6); the Puddle Couch at (11..13,9); mini-fridge (13,6); a wall of band tallies (north). Conditional dressing: Brian's pedalboard (6,8) and iced coffee (8,8) when `flags.monthLater && !flags.brianQuit`; fried after `pedalboardFried`; contract on the snare between CS-12 and the caption. Ceiling drips object (ambient, Toon 2 freeze gag).
**Exits.** Door → hall (20,7) (gated during cutscenes).
**Interactables.** Stickered amp: "Forty-one stickers. Nine are political. Brian counted." Drum kit: "A kit the size of a sedan. The ride cymbal is tinny. Don't tell him." Puddle Couch: "It's where Phoenix melts between songs." Mini-fridge: "Nobody opens it. Nobody has ever opened it." Wall tallies: "RAT FIGHT WAS HERE. (They toured?)" / "THE DENIM BOYS: ROOM 4 FOREVER (crossed out: NOW ROOM 2)." Iced coffee: "Brian's iced coffee. Boutique. Nine dollars. It has a name. The name is Brian." Pedalboard (intact): "$2,000 of pristine, never-stepped-on tone." (fried): "It smells like a fuse and oat milk."
**Enemies.** B2 (scripted). **Triggers.** `onFirstEnter` CS-10; the rest by `run`.

### `palmers` — 26×14
**Layout.** Door at (8,13). The bar along the north wall (rows 2–3, x 2..16) with Bajonka on a stool behind it at (10,2). Stage at the east end (20..24, 5..10), one tile raised (`deco` step edge), kit at (23,6), mic at (21,8). Bathrooms at (1..2, 8..10). Pull-tab booth (4,10). Jukebox (16,10). Photo wall (`deco`, north). Twelve crowd NPCs in rows 7–11, x 6..18; the cop at (22,11) in the back corner by the bathrooms, tall stranger at (14,11).
**Exits.** Door → `street_cedar` (8,9) (closed once on stage).
**NPCs.** Bartender: "Phoenix, you're not on tonight." / "Phoenix: 'My brain thinks I'm on *very* tonight.'" Pull-tab Lady: "Minnesota's slot machine. I'm up four dollars." Regular: "Been coming since '06. The place, not me. I'm from Fridley." Punk Kid: "Is it true the drummer's from up north? Those guys don't blink." Cop (pre-set): "Hello, fellow kids. I also enjoy the… moshes." Tall Stranger: "Hey, man. Good vibes in here. Dense." Six more one-liners (a nurse off shift, a guy who "saw the Replacements here" who did not, a couple arguing about ska).
**Interactables.** Jukebox: a `choice` of four songs that don't exist ("Pothole Blues", "Rent Is a Feeling", "7/8 Shuffle", "Dental Plan") — picking one plays a 4-bar jingle variant, `flags.jukeboxPlayed`. Pull tabs: "$1. (You have $4.) (You do not.)" Sign: "PALMER'S — EST. 1906 — NO SOLOS." Photo wall: "Every band that ever played here. None of them leveled it."
**Enemies.** B3 (scripted). **Triggers.** Stage trigger (20..24,5..10) → CS-15.

### `palmers_rubble` — 26×14
Same footprint; walls replaced with `rubble` and the north rows with night sky; drywall slabs, a bent mic stand, the bar intact ("The bar survived. The bar always survives."). The cop sprinting off through the west gap holding his mohawk (a `move` loop). Two dazed patrons: "I was mid-pull-tab." / Tall Stranger holding the mohawk: "Whoa, man. Is this… someone's?" (Chapter 2 seed). Bajonka under the drywall slab at (14,8). No exits; the chapter ends here.

## Exploration & interaction

- **Verbs.** Walk (grid, 4-dir), run (hold), confirm = interact with the faced entity, cancel, menu. Interactables return a narrator line; objects a party member cares about return a second line on a second press (Phoenix's "My brain thinks…" for bills, the ticket machine, the pull tabs; Lucky's for anything Vanguard).
- **Discoverables are marked by nothing.** Earthbound rule — the player learns to press on everything. The only hint is that NPCs face the player when adjacent.
- **Party trailer.** Joined characters follow in a snake; in cutscenes they are addressed by id and `move`d explicitly.
- **Lucky's color is the HUD.** The overworld sheet is swapped by party-leader HP band (`lucky` ≥70 %, `lucky_tense` 40–69 %, `lucky_deflated` <40 %) and by story locks (`lucky_rage` after `flags.luckyRageLocked`). There is no HP bar outside menus.
- **Time of day.** `flags.gigFlyer` flips `street_cedar` to night: a blue overlay rectangle at depth 50 under the `over` layer, lit-window objects swapped in, neon animated, a different NPC roster via `condition`.
- **Toon 2 objects.** CRASH, KRAAANG, G, DOOM/CRACK/THUD are ordinary `object` entities with sprites and animations, moved with `move`. No special system.

## Battle system (brief)

FF-style side view: party on the left, enemies on the right, command window at the bottom (ATTACK / RIFF / ITEM / HOLD / BAIL). Stats HP and AMP (riff fuel). Every battle starts with a count-in (`sfx stick_click` ×2 then "1-2-3-4" blips) and a "static burst" transition. A shared POCKET gauge fills on each party action; at 100 % the next riff is free and crits. Scripted battles use the §8 hooks: `onRound` for captions and Phoenix's mid-battle entrance, `onTurnStart` for Ryan's Fill/Splatter roll, a gauge threshold hook for The Eternity. Toon 3 in battle = the HUD windows swap to a torn 9-slice and jitter 2 px for a beat; Toon 4 = background and HUD swap, inputs lock, events play out.

## Party & progression (brief)

| Character | Joins | Leaves | Level 1 kit | Learns in slice |
|---|---|---|---|---|
| Lucky | S1 | — | Laser Guitar; Power Chord | Feedback Squeal (L3, AoE), Pseudopod (L5, steal) |
| Phoenix | S3 (B1 round 3) | — | Beat-up P-Bass, Trash Bag, Hoodie; Trash Bag Swing | My Brain Thinks (L2, scan), Bass Drop (L4, AoE, Slowed) |
| Brian | S7 (second) | S10 | Strat, $2,000 Pedalboard; Sterile Chord (100 % hit, 0 % crit) | Nothing. He does not grow. |
| Ryan | S9 (fourth) | S13 | Sticks, Tinny Ride; uncontrollable Fill | — |

Levels 1→6 over the slice; XP comes from the ten-ish optional street fights plus the two bosses. Money: $0 → $4 when Phoenix joins; enemies drop $1–2 "found in the snow"; the slice never lets the party afford the $40 cymbal.

## Enemies & bosses

| Enemy | Where | Flavor | Moves |
|---|---|---|---|
| Vanguard Retrieval Drone | B1 (alley); ×2 street east (day) | A beige sphere with a customer-service voice. "PLEASE HOLD." | Scan (−DEF), Tractor Beam (pulls one member toward Beige: −ATK), Bill (1 dmg, "for the pothole") |
| Market Research Intern | street, outside the pawnshop (day) | Lanyard, clipboard, no coat. "Quick survey?" | Survey (Confuse), Focus Group (summons a second Intern once), Exit Interview (flee) |
| Rental Scooter | street, road patrol | Nobody is riding it. It is going 15 mph in the snow. | Ram, Low Battery (skips a turn) |
| Undercover Cop | B3; night street duos | Price tag still on the jacket. Glued mohawk. | Stand By (summon Riot Cop), Pepper Spray (Blind), Hello Fellow Kids (does nothing; text only) |
| Riot Cop | B3 summons | A door in a vest. | Kettle (hits all), Shield |
| WHRNNNG / THUD-THUD | B2 | Sound effects with hit points. The back wall of Room 4. | Wall of Sound (AoE), Gutter Tear (Toon 3 jitter, −ACC) |
| CROWD HOSTILITY | B3 | The room's mood, 48×48, a mass of raised eyebrows. | None; it shrinks as POCKET fills |
| THE ETERNITY | B3 finale | Ryan, purple-black, a local black hole of rhythm. Not fought. | DOOM, CRACK, THUD (scripted, one each) |

## Items, equipment, shops

**Consumables.** Pizza Luce Slice (HP 30; alley dumpsters, street box, apartment fridge), Gas Station Coffee (AMP 10; café $3), Hand Warmers (cure Frozen; $2), Earplugs (guard vs Sound this battle; $5), Duct Tape (revive at 25 %; $4), Cheap Beer (HP 15, 30 % Confuse; $3).
**Key items.** Flyer (blank), Drone Core, Band Agreement ({n} pages), Fried Pedalboard, Half-Ounce ("Assets."), Rat Fight Demo Tape ($1, pawnshop; Warner seed), Van Keys, Tour Itinerary.
**Equipment.** Lucky: Laser Guitar (weapon; nothing else — "Lucky is the armor"). Phoenix: Beat-up P-Bass, Hoodie (armor), Trash Bag (accessory: +ATK, attacks inflict Garbage). Brian: Strat, $2,000 Pedalboard (accessory: ACC 100 %, CRIT 0 %; removed from the game when fried). Ryan: Sticks, Flannel, Tinny Ride Cymbal (accessory: +1 Fill damage, the gag is that it's bad).
**Shops.** Cedar Pawn & Loan (`shop: "pawnshop"`): the consumables above, Used Ride Cymbal $40 ("Phoenix: 'My brain thinks we could afford it in nine years.'"), Rat Fight Demo $1. The pawnbroker will not buy the Drone Core: "I don't buy Vanguard. They track it." Hard Luck Café (`shop: "cafe"`): coffee only.

## UI & presentation

- Dialogue box per §12.2; name tag; 32×32 portraits for Lucky (calm, tense, rage, deflated, sunglasses, eyes-closeup), Phoenix (tired, droop, baffled), Brian (normal, red, phone), Dad (speaker grille), Cop, Barista, Night Manager, Tall Stranger. Ryan has **no portrait**: `who: "ryan_caption"` renders a rigidly square, un-slanted box top-right with bracketed text and no name tag; `who: "ryan"` (spoken) uses the normal box, no portrait, and is always one word unless the script says otherwise.
- Captions: plain (END PART 1), `style: "tape"` (ONE MONTH LATER, duct-taped crooked over the frame), and the chapter stinger in a larger letter-spaced variant.
- **Insert window** (`ui.insert(sprite)`): a centered window showing a flyer or itinerary sprite with a narrator line under it. Used three times (gig flyer, contract page count, itinerary).
- Toon table → engine: 0 nothing; 1 `camera shake`; 2 SFX-letter objects + `ui.bulge`; 3 `ui.setFrame('torn')` + HUD jitter; 4 background/HUD swap, input lock.
- Menu: Items / Riffs / Equip / Status / Save. Status shows Lucky's current color swatch instead of a mood word. Save is greyed with "Bajonka is not here" unless adjacent to her.

## Audio (cue list per scene)

| Scene | Music | Ambient / SFX |
|---|---|---|
| S0 Title | `title` (160 bpm punk, pulse lead) | `glitch` on confirm |
| S1 Pod bay | `pod_bay` (corporate muzak, 25 % pulse, soft hats) | intercom hum; `squelch`; `confirm`; shake rumble |
| S2 Freefall | `freefall` (wind noise + rising saw) | `slime_pop` (sunglasses), `glitch` ×7, `crash` |
| S3 Alley | none until step 17, then `snow` (sparse triangle, hat in 7/8 every 8th bar) | `wind` loop; `crash`, `hit` ×4, `slime_pop` ×3, `feedback`, `drone_whine`; battle `battle_tutorial` |
| S4/S6 Street day | `snow` | traffic hiss, `glitch` under the billboard; battle `battle` |
| S5 Apartment | `apartment` (lo-fi, fridge hum as a held triangle) | `feedback` (rising 2 s), `signal` (the wave: pulse arpeggio up an octave per bar), `glitch`; garage: `garage` (silence, wind, one closed hat every 2 bars); captions silent |
| S7 Café | `coffee` (bossa chiptune, 50 % pulse) | `item`, `phone_ring` ×2, `click` (on the street) |
| S8 City Sound hall | `city_sound_muffled` (`rehearsal` low-passed) | `door`, `sneeze`, per-door muffled loops |
| S9 Room 4 | silence → `boss_audition` (196 bpm) | `stick_click` ×2, `pedal`, `drum_hit`, `cymbal` (6 s) |
| S10 Month later | `rehearsal_brian` (same song, straight, no accents) → `rehearsal` | `kraaang`, `coffee_spill`, `sparks` ×3, `pop`, `gears`, `door_slam`, `door`, `sneeze` |
| S11 Street night | `snow_night` (`snow` + 12.5 % pulse neon pad) | neon buzz; battle `battle` |
| S12 Palmer's | `palmers` (crowd murmur noise + jukebox jingle) → `the_set` (7/8, 180 bpm) → `eternity` (40 bpm triangle drone, noise swells, every hit a `camera shake`) | `power_chord`, `splash`, `drum_hit`, `cymbal`, `roof_peel` (metal screech), `crash` ×3 |
| S13 Rubble | none; `wind` | `cymbal` (long), `rubble`, `sneeze`; stinger sting (4 notes) |
| Game Over | `gameover` (the title riff at half speed) | `sneeze` |

Every battle starts with `stick_click` ×2; `victory` is a 2-second feedback squeal resolving to a chord.

## Controls & save

Arrows/WASD move; Z/Enter confirm; X/Esc cancel; Shift run; C/Tab menu. Gamepad mapped by `Input.js`. Text: confirm completes the page, confirm again advances; `?fast=1` honored.

**Bajonka is the save point.** She is a `type: "save"` entity with `condition: "flags.bajonkaSeen"` on: the alley milk crate, the apartment couch arm, the sidewalk outside Hard Luck Café, the City Sound hallway outside Room 4 (the canonical clipboard pose), the stool behind the bar at Palmer's, and the rubble (end of chapter). She is never in the party trailer; she is simply already there when you arrive, and nobody but Phoenix ever mentions it. **The gag:** interacting plays `sneeze`, then "Bajonka holds out the clipboard." / **INITIAL HERE?** [Page 1] [Page 2] [Page 3] [Decline]. Saving writes the slot and increments `vars.saveCount`: "You initial page {n}. Bajonka sneezes." Declining: "The clipboard does not move." The contract she drops on Ryan's snare is `3 + vars.saveCount` pages, so a cautious player hands Ryan a forty-page agreement. Game Over reads "CONTINUE FROM LAST INITIALED PAGE?" Slots are `smfos.save.1..3`; the Title shows map name + page count per slot.

### Flag & quest-state flow

```
TITLE ─new game─▶ pod_bay
  speaker ─▶ podSpeakerSlapped ─EJECT─▶ ejected ─▶ [Freefall] vars.billboardsTagged
  ▼
alley  ep0_crash ─▶ crashed ─▶ metPhoenix ─B1─▶ droneDefeated ─▶ phoenixJoined ─▶ bajonkaSeen (SAVES ON)
  ▼ (hubOpen=false: only the apartment door)
apartment  amp ─▶ ep0_signal ─▶ signalSent ─[rooftops, garage]─▶ "END PART 1" / "ONE WEEK LATER"
  ─▶ weekLater + hubOpen (café, pawnshop, enemies ON; rail OFF)
  ▼
coffee_shop  corkboard ─▶ flyerPosted (vars.flyerText 0..2)
  ▼
street  ep0_brian_arrives ─▶ brianJoined ─[garage call]─▶ brianCalledRyan (rail ON)
  ▼
city_sound_hall  ep0_ryan_arrives ─▶ ryanArrived
room4  ep0_room4_setup ─B2─▶ auditionDone ─▶ ryanJoined (vars.contractPages = 3 + vars.saveCount) ─save─▶
  "ONE MONTH LATER" ─▶ monthLater ─KRAAANG─▶ pedalboardFried ─▶ brianQuit (party −brian, +fried_pedalboard)
  ─flyer─▶ gigFlyer (street NIGHT; Palmer's ON; cops ON; Intern OFF)
  ▼
palmers  stage ─▶ ep0_palmers_set ─B3─▶ eternity ─▶ palmers_rubble
  ▼
rubble  ep0_aftermath ─▶ ryanQuit (vars.quitResponse 0..2; party −ryan; luckyRageLocked) ─▶ ch1Complete ─save─▶ TITLE

Side flags (never gate the spine): readBillyPod, billsRead, pizzaBoxLooted, jukeboxPlayed, bikeFound,
cleared_<enemy> per on-map enemy, trig_<map>_<id> per once-trigger, vars.npcTalks, vars.saveCount.
```

Gating is enforced only by entity `condition`s and exit conditions; no script checks the spine out of order, so `__slime.warp` + `setFlag` can jump the playthrough test to any scene.

## Content inventory

**Overworld sprite sheets (16×24 unless noted).** `lucky`, `lucky_tense`, `lucky_deflated`, `lucky_rage`, `lucky_glow`, `lucky_bristle`, `lucky_dust`, `lucky_puddle` (16×16), `lucky_ball` (16×16, + pseudopod anim), `lucky_flat` (32×16, Freefall); `phoenix`, `phoenix_trash`, `phoenix_puddle` (16×16), `phoenix_dust`; `brian`, `brian_red`; `ryan`, `ryan_loaded` (16×40), `ryan_slimed`, `ryan_purple`, `eternity` (64×64); `bajonka`, `bajonka_clipboard`, `bajonka_contract`, `bajonka_keys`; NPCs: `shoveler`, `cyclist`, `busker`, `shorts_guy`, `crust_punk`, `dog_also`, `office_worker`, `smoker`, `tall_stranger`, `barista`, `screenwriter`, `poet`, `intern_kid`, `coldbrew_guy`, `night_manager`, `ska_a/b/c`, `noise_guy`, `tuning_guy`, `bartender`, `pulltab_lady`, `regular`, `punk_kid`, `crowd_a..f`; enemies on map: `drone`, `intern`, `scooter`, `cop`, `cop_nomohawk`.
**Objects.** `speaker`, `speaker_slimed`, `eject_button`, `pod`, `vending`, `plaque`, `guitar_case`, `dumpster`, `dumpster_tipped`, `crater`, `drone_wreck`, `bike_frozen`, `milk_crate`, `pizza_box`, `bus_shelter`, `hydrant`, `billboard_work`, `billboard_work_glitch`, `billboard_prod`, `billboard_prod_glitch`, `couch`, `amp_bass`, `amp_lucky`, `bills`, `fridge`, `radiator`, `bin`, `poster_a..d`, `corkboard`, `corkboard_flyer`, `tip_jar`, `kit`, `mic_stand`, `pedalboard`, `pedalboard_fried`, `coffee_cup`, `coffee_cup_spilled`, `contract`, `flyer_crumpled`, `drips`, `brain_xray`, `jukebox`, `pulltab`, `stool`, `drywall`, `mohawk`, `wall_phone`, `space_heater`; SFX letters: `sfx_crash`, `sfx_kraaang`, `sfx_g`, `soundwave`, `shockwave`, `aura_link`, `slime_splat`, `sfx_doom`, `sfx_crack`, `sfx_thud`.
**Battle sheets (32×32 unless noted).** `lucky_battle` (idle/attack/hurt/ko/riff ×4 color variants), `phoenix_battle`, `brian_battle`, `ryan_battle`, `ryan_slimed_battle`, `ryan_purple_battle`, `eternity_battle` (64×64); enemies `drone_b`, `intern_b`, `scooter_b`, `cop_b`, `riot_cop_b` (48×48), `whrnnng_b` (48×48), `thudthud_b`, `crowd_hostility_b` (48×48). Backgrounds: `bg_street`, `bg_alley`, `bg_room4`, `bg_palmers`, `bg_palmers_roofless`, `bg_cosmic`.
**Portraits (32×32).** `lucky_calm`, `lucky_tense`, `lucky_rage`, `lucky_deflated`, `lucky_shades`, `lucky_eyes`, `phoenix_tired`, `phoenix_droop`, `phoenix_baffled`, `brian`, `brian_red`, `brian_phone`, `dad_grille`, `cop`, `barista`, `night_manager`, `tall_stranger`, `bartender`.
**Tilesets.** `vanguard_ship`, `sky` (clouds, skyline, rooftops, pines), `minneapolis` (snow, slush, sidewalk, road, snowbank, brick ×3, Towers panels ×4, neon, windows lit/dark, chain-link, platform, awning), `apartment_int`, `coffee_int`, `garage_int`, `city_sound_int` (sticker walls ×4, doors ×2), `palmers_int`, `rubble`.
**UI.** Window 9-slice, torn 9-slice, caption plain/tape, insert window, cursor, POCKET meter segments, Lucky color swatch, emotes.
**Songs (14).** `title`, `pod_bay`, `freefall`, `snow`, `snow_night`, `apartment`, `signal`, `garage`, `coffee`, `city_sound_muffled`, `rehearsal`, `rehearsal_brian`, `boss_audition`, `palmers`, `the_set`, `eternity`, `battle`, `battle_tutorial`, `victory`, `gameover` (20 ids; `snow_night`, `city_sound_muffled`, `rehearsal_brian` and `battle_tutorial` are variants of existing patterns).
**SFX recipes added.** `drone_whine`, `crash`, `pedal`, `stick_click`, `phone_ring`, `click`, `coffee_spill`, `sparks`, `pop`, `gears`, `door_slam`, `thud`, `power_chord`, `splash`, `roof_peel`, `rubble`, `snore`, `glitch`.
**Scripts (`ep0.json`).** `ep0_pod_intro`, `ep0_dad_1..4`, `ep0_speaker`, `ep0_eject`, `ep0_crash`, `ep0_signal`, `ep0_week_later`, `ep0_flyer`, `ep0_brian_arrives`, `ep0_ryan_arrives`, `ep0_room4_setup`, `ep0_audition`, `ep0_contract`, `ep0_month_later`, `ep0_gig_flyer`, `ep0_palmers_set`, `ep0_aftermath`; plus `npc_*.json` (one script per NPC/object line, ~90 entries) and `shops.json` (`pawnshop`, `cafe`). Battle scripts in code: `tutorial_drone`, `audition`, `palmers_set`.

## Risks & cuts

| Risk | Cut / fallback |
|---|---|
| `FreefallScene` is a bespoke scene with a RenderTexture trail. | Cut to a 10-second `rooftops`-style autoscroll with no steering; keep the billboard count at a fixed 7. |
| Small UI asks not in §12.2: `ui.setFrame('torn')`, `ui.bulge`, `ui.insert(sprite)`, `{var:x}` text markup. | Torn frame → `camera shake` on the UI camera; bulge → `ui.flash`; insert → a `say` narrator line; `{var:}` → fixed text ("a very long band agreement"). |
| Mid-battle ally entrance (Phoenix in B1) and the ally-as-hazard (Ryan in B2/B3) need model hooks beyond §8's list. | Phoenix joins before B1 instead; Ryan's Fill becomes a fixed per-round event injected by `onRound`. |
| 64×64 Eternity sprite and 16×40 Ryan-with-hardware break the "sprites are 16×24" assumption. | Hardware stack as a separate `object` entity that Ryan `move`s in lockstep with; Eternity at 48×48. |
| Night variant of `street_cedar`. | A blue overlay rectangle and a second NPC roster is the plan already; if even that slips, the gig happens at dusk with the day tiles. |
| Toon 4 art rupture (`bg_cosmic`, HUD swap). | Background swap only; HUD stays. The captions still land. |
| NPC count (~45 lines of flavor). | Cut order: Palmer's crowd (keep 6), street night extras, City Sound ska band, café Cold Brew Guy. Never cut: bills, Pizza Luce box, billboard, Billy's pod, the jukebox. |
| `rooftops` and `garage_north` are cutscene-only maps. | Replace the rooftop pan with three captions over black; keep the garage (it is used twice and is the Ryan hook). |
| Playtime overshoots 75 min. | Trim the day hub to one drone and the Intern; drop the night cop duos to one. |
| The choice at the quit (rage/plead/joke) promises branching it does not deliver. | That is the point; `vars.quitResponse` is read once in Chapter 2 (Phoenix remembers which one you picked). |
