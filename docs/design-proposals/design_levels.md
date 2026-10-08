# Vertical Slice Design — Levels & Narrative

Chapter 1, "Coagulation": title screen to "NEXT: THE POTATO BELT (DRUMMER WANTED)." Target 45–75 minutes. Every cutscene is written against the commands in `docs/ARCHITECTURE.md` §5 and the interfaces in §12; every map against the format in §4. Anything the engine does not yet have is in **Risks & cuts** with its fallback.

## Pillars

1. **Every tile has a joke.** Earthbound rule: nothing is scenery. Posters, bills, a Pizza Luce box, the WORK IS LOVE billboard — each returns a line; a second press often returns Phoenix's "My brain thinks…".
2. **Toon Level is an engine setting.** 0 static; 1 shake; 2 sound-effect letters become physical map objects (CRASH tips dumpsters; the G of KRAAANG kills a pedalboard); 3 the UI frame tears; 4 the art ruptures.
3. **The apartment is home; Cedar Ave is the line through it.** One hub, one home, two excursions. The hub is walked twice — day, then night — same map, lights on, cops out.
4. **Bajonka is the save system and the running gag.** She is everywhere before anyone introduces her. Saving is initialing her clipboard; Ryan's contract is as many pages as you have saved.
5. **Losing people is the plot.** Brian joins second and quits loud; Ryan joins fourth and quits quiet. The band gets *better* and *smaller* in the same ten minutes; Lucky ends locked magenta.

## Scene-by-scene flow

Timings are for a first-time player who reads most things. Cutscene ids are script ids in `src/data/scripts/ep0.json`; command names are the §5.1 keys.

### S0 — Title (1 min)
Minneapolis skyline at twilight; the pink-and-green contrail draws itself on a loop; the WORK IS LOVE billboard glitches on confirm. NEW GAME / CONTINUE (slots show map name and clipboard page number). Music `title`.

### S1 — Pod bay (3 min, Toon 1→3) — `pod_bay`
Lucky is a compressed ball of slime (`lucky_ball`, rolls). The hatch is open and Dad will not stop. The speaker is the only thing that matters; the bay is for jokes.

**CS-01 `ep0_pod_intro`** (`onFirstEnter`)
1. `music pod_bay`; `camera fade in 600`.
2. `say dad portrait:dad_grille` "I just don't understand the whole nonbinary thing."
3. `say dad` "Why can't you pick a tangible demographic to market yourself to?"
4. `say dad` "If you'd just join The Vanguard, you could be financially successful and oppress people with a dental plan!"
5. `emote player …`; unlock.

Four once-only floor `trigger` bands keep Dad going: "Your mother and I paid for the compression. The least you could do is market yourself." / "There's an opening in Demographic Alignment. Entry level. You'd report to me." / "Billy's parents say Billy 'found themself.' In a storage unit." / "…the speaker light's on. I can see the speaker light." Each has `condition: "!flags.podSpeakerSlapped"`; twins with the opposite condition say "mmf. mmmf."

**CS-02 `ep0_speaker`** (interact)
1. `face player up`; `anim player lucky_ball_pseudopod wait`; `sfx squelch`; `sprite speaker speaker_slimed`.
2. `say dad` "{speed:slow}mmf. MMMF. mmf—"; `say lucky` "Better."; `set flags.podSpeakerSlapped`.

**CS-03 `ep0_eject`** (interact, inside the pod)
1. `if !flags.podSpeakerSlapped`: `say narrator` "An unnecessarily red button, locked out by PARENTAL OVERRIDE." → `say dad` "You can't eject while I'm talking, Lucky. Safety is a core value." → `end`.
2. `say narrator` "An unnecessarily red button."; `choice` [EJECT / Not yet].
3. `music null`; `camera shake 600 0.02`; `camera flash 120`; `set flags.ejected`; `scene freefall`.
4. On return: `teleport alley 9,8 facing:down` (the crater; `alley.onFirstEnter` runs CS-04).

### S2 — Freefall (2 min, Toon 3) — `FreefallScene`
Full-screen special scene. Lucky flattens like a flying squirrel (`lucky_flat`); slime sunglasses pop on (`sfx slime_pop`). Vertical autoscroll from clouds to skyline to rooftops, ~55 s; left/right steers; the contrail is painted into a RenderTexture behind Lucky. Seven WORK IS LOVE billboards scroll past; crossing one glitches it (`sfx glitch`, `vars.billboardsTagged++`). No fail state. Ends on an alley rushing up, cut to black, `sfx crash`.

### S3 — The alley (6 min, Toon 2) — `alley`

**CS-04 `ep0_crash`** (`onFirstEnter`)
1. Black; `ambient wind`; `camera fade in 400` on Phoenix at (12,6), hoodie and trash bag (`phoenix_trash`).
2. `say phoenix` "{speed:slow}…" (a sigh you can read).
3. `sfx crash`; `camera shake 900 0.03`; `camera flash 120`; `spawn crater 9,8`; `spawn crash_fx sprite:sfx_crash 10,4` (Toon 2: CRASH is an object); `move crash_fx "RRR" wait`, tipping each dumpster it passes (`sprite dumpster_tipped`, `sfx hit`); `despawn crash_fx`.
4. `sprite player lucky_puddle`; `wait 900`; `anim phoenix phoenix_push_glasses wait`.
5. `say phoenix portrait:phoenix_tired` "My brain thinks you're going to have to pay the city for that pothole."
6. `anim player lucky_coagulate wait` (`sfx slime_pop` ×3); `sprite player lucky`.
7. `say lucky` "My dad runs Demographic Alignment for the Vanguard. He thinks a personality is a market segment." / "Planet California is one billboard with a dental plan." / "My old band's still back there. Or they're not. I didn't check."
8. `face phoenix toward:player`; `say phoenix` "I came here for college. The economy fell over. Rent didn't." / "I'm a permanent resident of the Midwest now. It's a medical condition."
9. `spawn aura sprite:aura_link 10,7`; `sfx feedback`; `say narrator` "They are made of the same stuff."; `despawn aura`.
10. `say lucky` "I want to make the loudest, most obnoxious noise possible until this whole empire gets a migraine."
11. `say phoenix` "Beats the day job."
12. `sfx drone_whine`; `spawn drone 21,2`; `move drone "LLLLLLLDDD" run wait`; `say drone` "ASSET LOCATED. INITIATING RETRIEVAL. PLEASE HOLD FOR A REPRESENTATIVE."; `emote player !`.
13. `battle tutorial_drone` `onLose: gameover`; `onWin`: `despawn drone`; `spawn drone_wreck 14,8`; `party add phoenix` (her `onJoin` equips P-Bass + Trash Bag and `give money 4`); `set flags.metPhoenix, droneDefeated, phoenixJoined`.
14. `set flags.bajonkaSeen`; `camera pan` to the milk crate where Bajonka now sits with a clipboard; `say phoenix` "That dog's been by the back door since I started here. My brain thinks she's the landlord."; `camera follow player`.
15. `say phoenix` "Come on. I've got a bin you can sleep in."; unlock. Phoenix trails the player from here.

**B1 — Tutorial `tutorial_drone`.** Vanguard Retrieval Drone. Round 1: only ATTACK lit; Lucky's battle sheet drops from pastel to magenta as HP falls (swaps at 70/40 %). Round 2: RIFF unlocks (Power Chord). `onRound(3)`: Phoenix walks into frame Chrono-Trigger-style and swings the trash bag (Garbage: −ACC). At 30 % the drone says "RETRIEVAL ABORTED. BILLING ASSET." and dies on the next hit. Drops Drone Core.

### S4 — Street, first pass (3 min, Toon 1) — `street_cedar` day, `flags.hubOpen` false
Only the apartment door opens; café, pawnshop, Palmer's and the light rail give one-line refusals (café: "Phoenix: After. I need to lie down in a specific way."). Three NPCs, no enemies, the billboard not yet glitching.

### S5 — Apartment: the cosmic Craigslist ad (5 min, Toon 2) — `apartment`
Free roam first. Interacting with the bass amp runs:

**CS-05 `ep0_signal`**
1. `move phoenix` beside the amp; `say phoenix` "We need a drummer. I could put a flyer up at the coffee shop…"
2. `say lucky` "Too slow. I'm going to ask the universe."
3. `anim player lucky_jack_in wait`; `sprite player lucky_glow`; `sfx feedback` (rising).
4. `camera shake 1400 0.02`; `spawn wave sprite:soundwave 3,6` (expanding rings); `camera flash 80` ×3. **Toon 2:** `ui.bulge` pushes the dialogue frame 4 px outward (Risks).
5. `music signal`; `teleport rooftops 0,7`; `camera pan x:512 ms:4000` across the strip; as it crosses PRODUCTIVITY IS FREEDOM: `sprite billboard_prod billboard_prod_glitch`, `sfx glitch`.
6. `teleport garage_north`; `camera fade in 600`; Ryan at the kit. `wait 1200`; `spawn wave` sweeping over him; `anim ryan ryan_freeze wait` (sticks hover; eyes two white pixels).
7. `say ryan_caption` "[…]"; `wait 900`; `say ryan_caption` "[Huh.]"
8. `caption "END PART 1" 2000`; `set flags.signalSent`; `caption "ONE WEEK LATER" 1800`; `teleport apartment 5,6`; `music apartment`; `set flags.weekLater, hubOpen`; `run ep0_week_later`.

**CS-06 `ep0_week_later`**: Phoenix on the couch. "Nobody came." / Lucky: "The universe is slow." / "The universe is a flyer at the coffee shop. I made one. Hard Luck Café. Corkboard. Go." `give flyer_blank`.

### S6 — Street, hub open (8 min, Toon 1) — `street_cedar` day
Café and pawnshop open; light rail locked ("The train is here. The reason to take it isn't."). Enemies spawn: two drones wander the east end, a Market Research Intern chases outside the pawnshop, a Rental Scooter patrols the road. The billboard glitches when Lucky walks under it. The Pizza Luce box is by the bus shelter.

### S7 — Coffee shop: the flyer (5 min, Toon 0) — `coffee_shop`
**CS-07 `ep0_flyer`** (corkboard, `inventory.has('flyer_blank')`): `say narrator` "A corkboard. Nine flyers for the same ska band."; `choice` ["DRUMMER WANTED — MUST PLAY FAST", "DRUMMER WANTED — NO COPS", "SEEKING RHYTHMIC VESSEL FOR COSMIC PURPOSE"] → `set vars.flyerText`; `take flyer_blank`; `sprite corkboard corkboard_flyer`; `set flags.flyerPosted`. Barista: "Give it an hour. Or a day. Time's weird in here."

Leaving fires **CS-08 `ep0_brian_arrives`** (street trigger at the café door, `flags.flyerPosted && !flags.brianJoined`):
1. `spawn brian 34,10`; `move brian` west to the party `wait`; `emote brian !`.
2. `say brian` by `vars.flyerText`: "You the 'must play fast' people? I play at a very reasonable tempo." / "'No cops.' Love it. I'm in insurance." / "'Rhythmic vessel'? I googled it. I think it's me."
3. `say brian` "I play guitar. I've got a $2,000 pedalboard and a completely normal amount of free time."
4. `say phoenix` "The flyer says drummer." `say brian` "I read it as 'band.'" `say lucky` "…Can you play loud?" `say brian` "I can play *accurately*."
5. `party add brian`; `ui.toast` "Brian joined. (Second.)"; `set flags.brianJoined`.
6. `say brian` "You need a drummer. I know a guy. My cousin's roommate up north. Doesn't talk. Never misses." `anim brian brian_phone`.
7. `teleport garage_north`: Ryan exactly as left a week ago, sticks still hovering. `sfx phone_ring` ×2 (wall landline); `anim ryan ryan_unfreeze wait`; `move ryan "LLL"`.
8. `say brian portrait:brian_phone` "Ryan. It's Brian. From the Zappa cover band. I've got a thing." `say ryan` "Yep." `sfx click`.
9. `teleport street_cedar`; `say brian` "He's in. City Sound, Room 4, tonight. Take the train."
10. `say lucky` "The universe came through." `say brian` "I called him." `say lucky` "The UNIVERSE." `say phoenix` "My brain thinks you're both right and that it doesn't matter."
11. `set flags.brianCalledRyan` (opens the rail exit); unlock.

### S8 — City Sound hallway (3 min, Toon 0→1) — `city_sound_hall`
The rail `exit` fades through `caption "TWENTY MINUTES OF LIGHT RAIL LATER"`. Free roam, then walking past Room 3 fires:

**CS-09 `ep0_ryan_arrives`**
1. `sfx door`; `spawn ryan sprite:ryan_loaded 1,6` (an impossible stack of hardware); `move ryan` east to Room 4 `wait`.
2. `say phoenix` "My brain thinks that's structurally impossible." `say brian` "That's Ryan."
3. Bajonka sits at (20,7), clipboard by her paws. `face ryan down`; `anim ryan ryan_nod wait`; `wait 400`; `sfx sneeze`; `anim bajonka bajonka_sneeze`.
4. `camera fade out 250`; `sprite bajonka bajonka` (clipboard gone); `setEntity room4_door open`; `move ryan "U"`; `camera fade in 250`.
5. `say phoenix` "My brain has questions. My brain is choosing not to ask them." `set flags.ryanArrived`. Bajonka is the save point here — the canonical pose.

### S9 — Room 4: setup and audition (10 min, Toon 1→3) — `room4`
**CS-10 `ep0_room4_setup`** (`onFirstEnter`)
1. `music city_sound_muffled`; `sprite player lucky_puddle`; `sprite phoenix phoenix_puddle` (relaxed, they melt).
2. `anim ryan ryan_tighten` (loops); `say narrator` "He does not stare at the alien slime monsters. He does not ask questions. He tightens a cymbal stand."
3. `say lucky` "You made good time from the transmission. You cool with playing fast?" `say ryan` "Yep."
4. `say brian` "{speed:fast}I called him." (Lucky's sprite does not turn.)
5. `say phoenix` "{color:gray}psst.{/color} My brain thinks we should have asked his rate first. We have exactly four dollars and a half-ounce of weed."
6. `sfx stick_click` ×2; `run ep0_audition`.

**CS-11 `ep0_audition`** (Toon 3)
1. `sprite player lucky`; `anim player lucky_stomp wait`; `sfx pedal`.
2. `say lucky` "{shake}One, two, three, four!{/shake}"
3. `sfx drum_hit`; `camera flash 100`; `camera shake 1500 0.04`; `ui.setFrame('torn')` for 1.5 s (Risks).
4. `spawn splat sprite:slime_splat 10,3`; `sprite ryan ryan_slimed`.
5. `music boss_audition`; `battle audition` `onWin: run ep0_contract` `onLose: gameover`.

**B2 — Mid-boss AUDITION.** Enemies WHRNNNG (48×48 letter wall) and THUD-THUD ×2. Party: Lucky, Phoenix, Brian. Ryan is an uncontrollable ally: each `onTurnStart` rolls Fill (big damage to one enemy) or Splatter (10 to the whole party + Slimed: +ATK −DEF). Captions are the clock — `onRound(1)` "[Well. I guess my arms belong to the goo now.]"; `onRound(3)` "[Tempo's good, though. Very steady.]"; `onRound(5)` "[Ride cymbal sounds a bit tinny. Should probably buy a new one if I survive this.]" Ends on round 6 (the song halts) or when both letters die. Rewards: 60 XP, Tinny Ride Cymbal.

**CS-12 `ep0_contract`**
1. `music null`; `sfx cymbal` (6 s decay); `say narrator` "Slime drips off the ceiling. And the cymbals. And Ryan."
2. `say lucky` "Holy shit. You're a machine."
3. `say ryan_caption` "[I am literally a hostage.]"; `say ryan` "So, do I get the gig?"
4. `set vars.contractPages = 3 + vars.saveCount`; `spawn bajonka sprite:bajonka_contract 12,3`; `move bajonka "DDL" wait`; `anim bajonka_drop wait`; `spawn contract 11,5`; `sfx thud`; `move bajonka "R"`; `anim bajonka_sit`.
5. `say narrator` "Bajonka drops a {var:contractPages}-page, legally binding band agreement onto the snare, turns around, and sits down."
6. `party add ryan`; `give band_agreement`; `set flags.auditionDone, ryanJoined`; `save` ("INITIAL HERE TO ACKNOWLEDGE RHYTHM SECTION").
7. `caption "ONE MONTH LATER" 1800 style:tape`; `set flags.monthLater`; `teleport room4 5,8` (same map, re-dressed by conditions: pedalboard and iced coffee in, contract out); `run ep0_month_later`.

### S10 — ONE MONTH LATER: Brian (8 min, Toon 0→2→1) — `room4`
**CS-13 `ep0_month_later`**
1. `music rehearsal_brian` (the song played straight). Brian at the pedalboard, `anim brian_strum` (only the hand moves).
2. `say brian` "Do we really need all the political stickers? We're going to alienate the market."
3. `face brian left`; `say brian` "Hey, man, can you turn the bass down?" `say phoenix portrait:phoenix_droop` "I'm not a 'man,' Brian. And no."
4. `say ryan_caption` "[I give this guy three weeks. Tops.]"
5. `music rehearsal` (the chorus; the slime syncs); `spawn aura 4,6`; `wait 600`.
6. **Toon 2.** `spawn kraaang sprite:sfx_kraaang 5,2`; `sfx kraaang`; `camera shake 500`; `spawn g sprite:sfx_g 10,2`; `anim g g_swing wait`; `move g "DD" run wait` into the coffee cup.
7. `sfx coffee_spill`; `sprite coffee_cup coffee_cup_spilled`; `sprite pedalboard pedalboard_fried`; `sfx sparks` ×3; `camera flash 60` ×2; `despawn kraaang, g`; `music null`.
8. `say brian portrait:brian_red` "I can't work like this! I hate this weird, creative shit! Can't we just play normal music?!" `set flags.pedalboardFried`.
9. `caption "ONE MONTH BEFORE THE POTATO BELT TOUR" style:tape`; `say phoenix` "My brain thinks that caption knows something we don't."
10. `move brian "LLRRLLRR"` (pacing, no wait); `say brian` "{shake}I'm not here to have fun." / "I'm not into this creative shit." / "You people are wasting my time."
11. `sfx pop`; `sprite player lucky_bristle`; `say narrator` "Lucky unplugs. The slime on their shoulders stands up like a cat's."
12. `anim phoenix phoenix_mute`; `move phoenix "L"`.
13. `move player` adjacent to Brian; `say lucky portrait:lucky_calm` "Listen to me very carefully, Brian."
14. `say lucky portrait:lucky_eyes` "You need to stop being an asshole, or you are fired."
15. `say lucky` "We clearly have some fundamental differences in how we think a band should work, but that's something we can discuss. What I can't do is work with an asshole, so whatever's going on at home or wherever, don't bring it to rehearsal."
16. `camera flash 80`; `spawn xray sprite:brain_xray 9,5` (gears grind, spark, spin backward); `sfx gears`; `wait 1500`; `despawn xray`; `sprite brian brian_red`.
17. `say brian` "{shake}Did you just say my foundation is broken?! Are you calling my house crooked?!{/shake}"
18. `anim drips drips_freeze` (the ceiling drip stops mid-air); `wait 1200`.
19. `say phoenix portrait:phoenix_baffled` "My brain thinks you might be having a stroke."
20. `say lucky` "I literally didn't say anything about a house…" `say brian` "I know what you meant! My property values are fine! You're just jealous of my equity!"
21. `anim brian brian_pack wait`; `move brian` to the door `run`; `sfx door_slam`; `camera shake 300`; `despawn brian`; `party remove brian`; `give fried_pedalboard`; `ui.toast` "Got FRIED PEDALBOARD."
22. `wait 1500`; `say ryan_caption` "[Well. His timing was terrible anyway.]"
23. `sfx door` (creak); `spawn bajonka 4,11`; `move bajonka` to the mic stand; `anim bajonka_drop`; `spawn gig_flyer sprite:flyer_crumpled 7,7`; `sfx sneeze`; `move bajonka` out; `despawn`; `set flags.brianQuit`; unlock. Phoenix: "My brain thinks she's making a point."

**CS-14 `ep0_gig_flyer`** (pick up the flyer): `ui.insert flyer_gig`; `say narrator` "GIG TONIGHT: PALMER'S BAR — NO GUITAR SOLO NECESSARY." `say lucky` "Palmer's. Isn't that—" `say phoenix` "Where I work. Yes. My brain thinks this is fine." `set flags.gigFlyer`. The rail now lands on `street_cedar` at night.

### S11 — Street at night (5 min, Toon 1) — `street_cedar` night
Same map, night dressing. Cop duos patrol ("unauthorized gathering" sweep); the Intern is gone; a tall stranger stands outside Palmer's. Pawnshop open late; apartment reachable (nap, save, bills). Palmer's door opens with `flags.gigFlyer`.

### S12 — Palmer's: the set (12 min, Toon 1→3→4) — `palmers`
Free roam (crowd, jukebox, pull tabs; Bajonka on a stool behind the bar = last save). Stepping on stage fires:

**CS-15 `ep0_palmers_set`**
1. `move` Phoenix to bass side, Ryan to the kit; `sprite ryan ryan_slimed` ("already a menacing, bubbling mass"); `say narrator` "The stage is six inches off the floor. It is the tallest thing Lucky has ever stood on."
2. `camera pan` to the cop at (22,11): pristine leather jacket, price tag, glued mohawk. `say cop` "{speed:slow}Dispatch, I have located the unauthorized slime gathering. Stand by." `camera follow player`.
3. `face player up`; `emote ryan ♪`; `face player left`; `emote phoenix ♪`; `say narrator` "No Brian to ruin the mix."
4. `sfx power_chord`; `camera shake 800 0.03`; `spawn wave sprite:shockwave 7,9`; `move wave` east `run` — each crowd NPC it passes plays `hair_back`; at the cop: `sprite cop cop_nomohawk`; `spawn mohawk`; `move mohawk "RRU" run wait` into the tall stranger's beer; `sfx splash`; `say stranger` "whoa, man."
5. `say ryan_caption` "[No obnoxious guitar solos. Just pure, unadulterated rhythm. The slime is pulsating in 7/8 time. I can work with this.]"
6. `music the_set`; `battle palmers_set` `onWin: run ep0_aftermath`.

**B3 — Boss THE SET AT PALMER'S** (Toon 3→4). Enemies: Undercover Cop + CROWD HOSTILITY (a 48×48 non-attacking "mood" enemy). The cop's first turn is Stand By: RIOT COP ×2 walk in. The shared POCKET gauge fills with every party action, faster when Lucky and Phoenix act back-to-back; Ryan plays every turn, uncontrolled. Milestones: 50 % "[The slime is pulsating in 7/8 time.]"; 75 % "[I've been fighting the possession. That was a mistake.]" → `transform ryan ryan_purple` + "[I am not trapped in the goo. The goo is trapped in the pocket.]"; 100 % → **THE ETERNITY**: inputs lock, background → `bg_cosmic`, HUD → torn frame, Ryan → `eternity` (64×64, purple-black), DOOM / CRACK / THUD letters fall in with a shake each, "[Rhythm achieved.]", every enemy to 0 HP, a letter swings up, background → `bg_palmers_roofless`, `win`. The gauge fills regardless of KOs, so the set cannot be lost; a full-party KO just makes the rest of it a drum solo. ENCORE rating from party HP at 100 %.

### S13 — Aftermath (4 min, Toon 1) — `palmers_rubble`
**CS-16 `ep0_aftermath`**
1. `teleport palmers_rubble 8,9`; `sfx cymbal` (long); `ambient wind`; `camera fade in 1500`; `say narrator` "The dust settles. The night sky is where the ceiling used to be."
2. `sprite player lucky_dust`; `sprite phoenix phoenix_dust`; `anim ryan ryan_resolidify wait` (eternity → purple → slimed), two intact sticks.
3. `say lucky` "Okay. That is our sound." `say phoenix` "My brain thinks we are officially domestic terrorists."
4. `say ryan` "I think I broke the space-time continuum on that snare fill."
5. `wait 1200`; `face ryan down`; `say ryan_caption` "[I could have killed every person in this room.]"; `face ryan up`.
6. `say ryan` "I quit."
7. `sprite player lucky_rage`; `camera shake 200`; `say lucky` "We just found it. We just FOUND it—"
8. `choice` [RAGE / PLEAD / JOKE] → `set vars.quitResponse`. RAGE: "{shake}You don't get to be scared of the best thing you've ever done!" PLEAD: "One more show. One. You don't even have to let go." JOKE: "We'll put you on the flyer as a weather event."
9. `say ryan` "Yep." (every branch); `move ryan "UUUUUU" wait`; `despawn ryan`; `party remove ryan`; `set flags.ryanQuit, luckyRageLocked`.
10. `say phoenix` "My brain thinks he's scared." `say lucky portrait:lucky_rage` "I don't care what he is."
11. **Stinger.** `sfx rubble`; `anim drywall drywall_lift`; `spawn bajonka sprite:bajonka_keys 14,8`; `move bajonka "LLL" wait`; `give van_keys, tour_itinerary`; `ui.insert itinerary` — "POTATO BELT: TOMORROW" circled in red.
12. `say lucky` "We don't have a drummer."; `sfx sneeze`.
13. `set flags.ch1Complete`; `caption "NEXT: THE POTATO BELT" 2200`; `caption "(DRUMMER WANTED)" 1600`; `save` ("INITIAL HERE TO END CHAPTER 1"); fade to Title.

## Maps

| id | Name | Size | Tileset | Music | Exits | Save |
|---|---|---|---|---|---|---|
| `pod_bay` | Vanguard drop-pod bay | 16×14 | `vanguard_ship` | `pod_bay` | EJECT → Freefall | — |
| (scene) | Freefall over Minneapolis | — | `sky` | `freefall` | → `alley` | — |
| `alley` | Alley behind Palmer's | 24×14 | `minneapolis` | `snow` | W → `street_cedar` (38,12) | milk crate |
| `street_cedar` | Cedar Ave, West Bank | 40×24 | `minneapolis` (+night) | `snow` / `snow_night` | E → `alley`; doors → `apartment`, `coffee_shop`, `palmers`, pawnshop; rail → `city_sound_hall` | outside café |
| `apartment` | Phoenix's apartment | 16×14 | `apartment_int` | `apartment` | S → street (12,9) | couch arm |
| `coffee_shop` | Hard Luck Café | 20×14 | `coffee_int` | `coffee` | S → street (20,9) | — |
| `rooftops` | Signal montage strip | 48×14 | `sky` | `signal` | cutscene only | — |
| `garage_north` | Ryan's garage | 16×14 | `garage_int` | `garage` | cutscene only | — |
| `city_sound_hall` | City Sound, hallway | 28×12 | `city_sound_int` | `city_sound_muffled` | stairs → rail → street; door → `room4` | outside Room 4 |
| `room4` | City Sound, Room 4 | 14×12 | `city_sound_int` | per scene | SW door → hall | CS-12 |
| `palmers` | Palmer's Bar | 26×14 | `palmers_int` | `palmers` | S → street (8,9) | stool behind bar |
| `palmers_rubble` | Palmer's, leveled | 26×14 | `rubble` | wind | none; chapter ends | end of chapter |

### `pod_bay` — 16×14
**Layout.** Steel floor, catwalk along the top, three drop pods along the bottom (pod 2 open, Lucky inside at (7,11)). Intercom speaker, 2×2, north wall (7,2). Viewport (12,2) onto Planet California, a planet made of billboards. Vending machine (2,3), plaque (4,2). **Exit:** EJECT only. **NPC:** Dad (the speaker; "Dad has always been a speaker.").
**Interactables.** Speaker → CS-02. EJECT → CS-03. Laser guitar case in the pod: "The only thing from home worth the fuel." (equips; one-toast Equip tutorial). Pod 3 nameplate "RESERVED — RUBEN, B." → Lucky: "…They're late. They're always late." (`flags.readBillyPod`). Vending: "DENTAL PLAN: SOLD OUT. DEMOGRAPHIC: SOLD OUT. WATER: $40." Plaque: "EMPLOYEE OF THE QUARTER: DAD (41 CONSECUTIVE QUARTERS)." Viewport: "One billboard says WORK IS LOVE. Lucky has never seen it turned off." **Enemies:** none. **Triggers:** four Dad floor bands.

### `alley` — 24×14
**Layout.** The bar's brick back wall along the north: lit window (16,3), steel door "PALMER'S — DELIVERIES" (18,4). Snow and slush; four dumpster objects at y=5, x=6..13; crater (9,8) after the crash; chain-link dead end east with a bike frozen to it; west end opens onto Cedar. Bajonka's milk crate (19,6). **Exit:** west edge → `street_cedar` (38,12). **NPCs:** Phoenix (until joined); Bajonka (save).
**Interactables.** Crater: "Lucky's pothole. It glows faintly. Someone is going to be billed." Tipped dumpster: "Nine Pizza Luce boxes, all empty, all someone's Tuesday." (one Slice). Drone wreck: "RETRIEVAL DRONE (DECEASED). Its little screen still says ASSET LOCATED." Steel door: "EMPLOYEES ONLY. (Phoenix: 'I'm an employee. I'm not going in there.')" Bike: "Someone has been paying for that U-lock since 2019." Window: "It sounds warm in there. It isn't." **Enemies:** the tutorial drone, scripted only. **Trigger:** `onFirstEnter` CS-04.

### `street_cedar` — 40×24, the hub
**Layout.** Cedar Ave runs west–east through rows 11–13 (road, parked cars, snowbanks). North sidewalk, west to east: Palmer's (neon, door (6,8)); the Towers — Phoenix's building, colored-panel tiles, door (12,8); Hard Luck Café (20,8); Cedar Pawn & Loan (28,8); bus shelter (33,9) with the Pizza Luce box beside it. South sidewalk: the Cedar-Riverside light-rail platform with its `exit` at (21,16) (`flags.brianCalledRyan`), a hydrant, a bike rack, the alley mouth at the east end. The WORK IS LOVE billboard is an `over`-layer object on the roofline (14..19,2..4); it swaps to `_glitch` while the player is within 3 tiles after `flags.signalSent`.
**Exits.** East (39,11–13) → `alley` (1,9); doors above; rail → `city_sound_hall` (2,6).
**NPCs (day).** Snow Shoveler: "I've shoveled this square four times today. The city calls it a job. I call it a relationship." Cyclist: "It's not cold if you're angry enough." Busker: "I take requests. I can't play them. But I take them." Shorts Guy: "Twelve degrees. Shorts weather." Crust Punk with dog: "Her name's Also Bajonka. No relation." Office Worker: "Did you see the sky? {var:billboardsTagged} billboards went down. My boss cried." Towers sign: "RENT DUE. ALSO: RENT INCREASE. ALSO: RENT."
**NPCs (night).** Tall Stranger outside Palmer's: "Whoa, man. The stars are heavy tonight." Smoker: "Palmer's? Tonight? I heard there's a drummer." Shoveler and Cyclist gone.
**Interactables.** Pizza Luce box: "Still warm? No. Nothing in Minneapolis is still warm." → one Slice. Shelter ad: "WORK IS LOVE. (smaller:) LOVE IS A VANGUARD TRADEMARK." Hydrant flyer: "LOST: CAT. ANSWERS TO 'NO.'" — after the gig: "LOST: MOHAWK. SENTIMENTAL VALUE. NO QUESTIONS." Ticket machine: "$2.00. (Phoenix: 'My brain thinks we are, technically, fare evaders.')"
**Enemies.** Day (`flags.weekLater`): Drone ×2 wander (radius 3) at (34,10), (36,14); Intern chase at (27,10), sight 5; Scooter patrol on row 12. Night (`flags.gigFlyer`): Cop Duo ×2 patrolling the sidewalks; the Scooter stays. All clear via `setOnWin`.
**Triggers.** Café-door trigger (CS-08); billboard proximity (7×3, repeating).

### `apartment` — 16×14, home hub
**Layout.** One room. Door (12,13). Couch west (2..4,6): nap = full heal, and where ONE WEEK LATER lands. Bass amp (3,9). Kitchenette north: fridge (10,2), radiator (14,5). Window (6,1) facing the billboard. Bills on the coffee table (6,7). Four posters: RAT FIGHT — DULUTH; GREAT BIG THING CRAWLING ALL OVER ME; THE DENIM BOYS: A NIGHT OF DENIM; HARD LUCK OPEN MIC (NO MICS). Lucky's bed, a Tupperware bin (13,9). Bathroom (1,2), locked. Bajonka on the couch arm. **Exit:** door → street (12,9). **NPC:** Phoenix.
**Interactables.** Amp → CS-05; after: "It hums at a frequency Phoenix describes as 'rent.'" Bills cycle five: "RENT: PAST DUE." / "STUDENT LOANS: PAST DUE, FOREVER." / "VANGUARD SPECTRUM INTERNET: PAST DUE. (You do not have internet.)" / "PARKING TICKET. (Phoenix does not own a car.)" / "CITY OF MINNEAPOLIS: POTHOLE, 1 (one). $4,000." — all five read sets `flags.billsRead` (Phoenix: "My brain thinks we should frame that one."). Fridge: "A half-ounce of weed and a Pizza Luce slice. Assets." (Slice once). Window: "WORK IS LOVE. It has never once been turned off." (glitches after the signal). Radiator: "It clanks in 7/8. Phoenix says it's the building settling. It is not." Bin: "It's a bin. It's a big bin. It's yours." Bathroom: "Phoenix: 'There's a mirror in there. I don't recommend it.'" Rat Fight poster: "A Duluth band. The singer screams like he's being evicted." **Enemies:** none.

### `coffee_shop` — 20×14, Hard Luck Café
**Layout.** Counter north (barista (4,3)); corkboard (16,2); six tables; bathroom (18,5); door (10,13). **Exit:** door → street (20,9).
**NPCs.** Barista: "Coffee's $3. Hot water's free. Nobody's happy either way." (`shop cafe`). Screenwriter: "It's about a slime monster who—no. No it isn't. It's about a divorce." Poet: "A piece about snow. It's called 'Snow.' It's finished." Internship Kid: "Question 9: 'Describe your demographic.' I put 'tired.'" Cold Brew Guy: "One cold brew. Six hours. It's a system."
**Interactables.** Corkboard → CS-07; afterward: "KEYBOARDIST WANTED. Must own keyboard. We do not own a keyboard. We own a dream." / "FREE COUCH. HAUNTED. FIRM." Bathroom sign: "PLEASE DO NOT ASK THE UNIVERSE FOR ANYTHING IN HERE." Tip jar: "$0.75 and a guitar pick." (Phoenix: "My brain thinks that's theft.") Table 5: "A ring on the table. Someone very normal was here." **Enemies:** none.

### `rooftops` — 48×14, cutscene strip
Skyline silhouettes, PRODUCTIVITY IS FREEDOM at x=14, WORK IS LOVE at x=38, highway lights, then pines. Camera pans; no player.

### `garage_north` — 16×14, cutscene map
Open door onto snow and pines; the kit in the middle; a wall phone (3,4); a space heater that does nothing. Used twice: the wave (CS-05) and the call (CS-08).

### `city_sound_hall` — 28×12
**Layout.** A two-tile corridor from the stairs (2,6) east to a dead end; Rooms 1–6 along the north wall (Room 4 at (20,5)); night-manager desk (5,4); vending (8,4); bulletin board (12,4); bathroom (26,5). Every wall tile is a sticker tile (four variants). Bajonka outside Room 4 (20,7). **Exits:** stairs → rail → street (21,15); Room 4 door → `room4` (3,10).
**NPCs.** Night Manager: "Room 4. Cash only. Don't put stickers on the stickers." Ska Band ×3 loading out: "Ska's coming back." / "It never came." / "Checkmate." Noise Guy in Room 2's doorway: "I'm the only member. I'm also the audience. Reviews are mixed." Tuning Guy: "Forty minutes. The E is fine. I'm not."
**Interactables.** Board: "BASSIST WANTED (NOT YOU, GREG)." / "DRUMMER AVAILABLE: 13/8 ONLY." / "LOST: CLIPBOARD. IF FOUND, YOU HAVE ALREADY SIGNED." Vending: "Everything is $1.25. Everything is sold out." Other doors: a muffled loop each and one line ("Room 6 has been playing the intro to the same song since October"). **Enemies:** none. **Trigger:** Room 3 proximity → CS-09.

### `room4` — 14×12
**Layout.** Door (3,10). Kit NE (10..12,2..4). Lucky's stickered amp (2,5); Phoenix's amp (2,7); mic stand (7,6); the Puddle Couch (11..13,9); mini-fridge (13,6); a wall of band tallies north. Conditional dressing: Brian's pedalboard (6,8) and iced coffee (8,8) while `monthLater && !brianQuit`; fried after `pedalboardFried`; the contract on the snare during CS-12. A ceiling-drip object (the Toon 2 freeze gag). **Exit:** door → hall (20,7), gated during cutscenes.
**Interactables.** Amp: "Forty-one stickers. Nine are political. Brian counted." Kit: "The size of a sedan. The ride cymbal is tinny. Don't tell him." Couch: "Where Phoenix melts between songs." Fridge: "Nobody has ever opened it." Tallies: "RAT FIGHT WAS HERE. (They toured?)" / "THE DENIM BOYS: ROOM 4 FOREVER (crossed out: NOW ROOM 2)." Iced coffee: "Boutique. Nine dollars. It has a name. The name is Brian." Pedalboard: "$2,000 of pristine, never-stepped-on tone." → fried: "It smells like a fuse and oat milk." **Enemies:** B2, scripted. **Trigger:** `onFirstEnter` CS-10.

### `palmers` — 26×14
**Layout.** Door (8,13). The bar along the north (rows 2–3, x 2..16), Bajonka on a stool behind it (10,2). Stage east (20..24,5..10), one tile raised via a `deco` step edge; kit (23,6); mic (21,8). Bathrooms (1..2,8..10). Pull-tab booth (4,10). Jukebox (16,10). Photo wall north. Twelve crowd NPCs in rows 7–11; the cop in the back corner (22,11); the tall stranger (14,11). **Exit:** door → street (8,9), closed once on stage.
**NPCs.** Bartender: "Phoenix, you're not on tonight." (Phoenix: "My brain thinks I'm on *very* tonight.") Pull-tab Lady: "Minnesota's slot machine. I'm up four dollars." Regular: "Been coming since '06. The place, not me. I'm from Fridley." Punk Kid: "The drummer's from up north? Those guys don't blink." Cop: "Hello, fellow kids. I also enjoy the… moshes." Tall Stranger: "Good vibes in here. Dense." Six more one-liners (a nurse off shift; a guy who "saw the Replacements here" and did not).
**Interactables.** Jukebox: `choice` of four songs that don't exist ("Pothole Blues", "Rent Is a Feeling", "7/8 Shuffle", "Dental Plan"), each a 4-bar jingle; `flags.jukeboxPlayed`. Pull tabs: "$1. (You have $4.) (You do not.)" Sign: "PALMER'S — EST. 1906 — NO SOLOS." Photo wall: "Every band that ever played here. None of them leveled it." **Enemies:** B3, scripted. **Trigger:** stage (20..24,5..10) → CS-15.

### `palmers_rubble` — 26×14
Same footprint: walls → `rubble`, north rows → night sky, drywall slabs, a bent mic stand, the bar intact ("The bar survived. The bar always survives."). The cop sprints off west in a `move` loop holding his mohawk. Two dazed patrons: "I was mid-pull-tab." / Tall Stranger with the mohawk: "Whoa, man. Is this… someone's?" (Chapter 2 seed). Bajonka under the drywall (14,8). No exits.

## Exploration & interaction

- **Verbs.** Grid walk, run (hold), confirm = interact with the faced entity, cancel, menu. Objects return a narrator line; things a party member cares about return a second line on a second press (Phoenix on bills, tickets, pull tabs; Lucky on anything Vanguard).
- **Discoverables are unmarked.** The player learns to press on everything; the only tell is that NPCs face the player when adjacent.
- **Party trailer.** Joined characters follow in a snake; cutscenes address them by id.
- **Lucky's color is the HUD.** The overworld sheet swaps by leader HP (`lucky` ≥70 %, `lucky_tense` 40–69 %, `lucky_deflated` <40 %) and by story lock (`lucky_rage` after `flags.luckyRageLocked`). No HP bar outside menus.
- **Night.** `flags.gigFlyer` dresses `street_cedar`: a blue overlay rectangle at depth 50 under the `over` layer, lit-window objects, animated neon, a different NPC roster via `condition`.
- **Toon 2 objects** (CRASH, KRAAANG, G, DOOM/CRACK/THUD) are ordinary `object` entities moved with `move`. No special system.

## Battle system (brief)

FF side view: party left, enemies right, commands ATTACK / RIFF / ITEM / HOLD / BAIL. Stats HP and AMP (riff fuel). Every battle opens with a count-in (`stick_click` ×2, "1-2-3-4" blips) and the static-burst transition. A shared POCKET gauge fills on each party action; at 100 % the next riff is free and crits. Scripted battles use the §8 hooks: `onRound` for captions and Phoenix's entrance, `onTurnStart` for Ryan's Fill/Splatter, a gauge-threshold hook for The Eternity. Toon 3 in battle = torn HUD 9-slice plus a 2 px jitter; Toon 4 = background and HUD swap, inputs locked.

## Party & progression (brief)

| Character | Joins / leaves | Level 1 kit | Learns in slice |
|---|---|---|---|
| Lucky | S1 / — | Laser Guitar; Power Chord | Feedback Squeal (L3, AoE), Pseudopod (L5, steal) |
| Phoenix | S3 (B1 round 3) / — | P-Bass, Trash Bag, Hoodie; Trash Bag Swing | My Brain Thinks (L2, scan), Bass Drop (L4, AoE + Slowed) |
| Brian | S7, second / S10 | Strat, $2,000 Pedalboard; Sterile Chord (100 % hit, 0 % crit) | Nothing. He does not grow. |
| Ryan | S9, fourth / S13 | Sticks, Tinny Ride; uncontrollable Fill | — |

Levels 1→6 across the slice from ~10 optional street fights and two bosses. Money: $0 → $4 when Phoenix joins; enemies drop $1–2 "found in the snow"; the party never affords the $40 cymbal.

## Enemies & bosses

| Enemy | Where | Flavor | Moves |
|---|---|---|---|
| Vanguard Retrieval Drone | B1; street east ×2 (day) | A beige sphere with a customer-service voice. "PLEASE HOLD." | Scan (−DEF), Tractor Beam (−ATK, "toward Beige"), Bill (1 dmg, "for the pothole") |
| Market Research Intern | street, by the pawnshop (day) | Lanyard, clipboard, no coat. "Quick survey?" | Survey (Confuse), Focus Group (summons one Intern), Exit Interview (flee) |
| Rental Scooter | street, road patrol | Nobody is riding it. 15 mph in the snow. | Ram, Low Battery (skips a turn) |
| Undercover Cop | B3; night duos | Price tag on the jacket. Glued mohawk. | Stand By (summon Riot Cop), Pepper Spray (Blind), Hello Fellow Kids (text only) |
| Riot Cop | B3 summon | A door in a vest. | Kettle (all), Shield |
| WHRNNNG / THUD-THUD | B2 | Sound effects with hit points. | Wall of Sound (AoE), Gutter Tear (−ACC, jitter) |
| CROWD HOSTILITY | B3 | The room's mood: a mass of raised eyebrows. | None; shrinks as POCKET fills |
| THE ETERNITY | B3 finale | Ryan, purple-black, a local black hole of rhythm. Not fought. | DOOM, CRACK, THUD (scripted) |

## Items, equipment, shops

**Consumables.** Pizza Luce Slice (HP 30; dumpsters, street box, fridge), Gas Station Coffee (AMP 10; café $3), Hand Warmers (cure Frozen; $2), Earplugs (guard vs Sound; $5), Duct Tape (revive 25 %; $4), Cheap Beer (HP 15, 30 % Confuse; $3).
**Key items.** Flyer (blank), Drone Core, Band Agreement ({n} pages), Fried Pedalboard, Half-Ounce ("Assets."), Rat Fight Demo Tape ($1; Warner seed), Van Keys, Tour Itinerary.
**Equipment.** Lucky: Laser Guitar only ("Lucky is the armor"). Phoenix: P-Bass, Hoodie, Trash Bag (+ATK, inflicts Garbage). Brian: Strat, $2,000 Pedalboard (ACC 100 %, CRIT 0 %; removed when fried). Ryan: Sticks, Flannel, Tinny Ride Cymbal (+1 Fill; the gag is that it's bad).
**Shops.** Cedar Pawn & Loan: the consumables, Used Ride Cymbal $40 (Phoenix: "My brain thinks we could afford it in nine years."), Rat Fight Demo $1; he refuses the Drone Core: "I don't buy Vanguard. They track it." Hard Luck Café: coffee only.

## UI & presentation

- Dialogue box per §12.2 with name tag and 32×32 portraits (Lucky calm/tense/rage/deflated/shades/eyes; Phoenix tired/droop/baffled; Brian normal/red/phone; Dad grille; Cop; Barista; Night Manager; Tall Stranger; Bartender). Ryan has **no portrait**: `who: "ryan_caption"` renders a rigidly square box top-right with bracketed text and no tag; spoken `who: "ryan"` uses the plain box and is one word unless scripted otherwise.
- Captions: plain (END PART 1), `style: "tape"` (duct-taped, crooked), and a letter-spaced chapter stinger.
- `ui.insert(sprite)`: a centered window with a flyer/itinerary sprite over a narrator line (used three times).
- Toon table → engine: 0 nothing; 1 `camera shake`; 2 letter objects + `ui.bulge`; 3 `ui.setFrame('torn')` + jitter; 4 background/HUD swap + input lock.
- Menu: Items / Riffs / Equip / Status / Save. Status shows Lucky's color swatch, not a mood word. Save is greyed "Bajonka is not here" unless adjacent to her.

## Audio (cue list per scene)

| Scene | Music | SFX / ambient |
|---|---|---|
| S0 Title | `title` (160 bpm punk) | `glitch` on confirm |
| S1 Pod bay | `pod_bay` (corporate muzak, 25 % pulse) | intercom hum; `squelch`, `confirm` |
| S2 Freefall | `freefall` (wind + rising saw) | `slime_pop`, `glitch` ×7, `crash` |
| S3 Alley | silent until step 15, then `snow` (sparse; a 7/8 hat every 8th bar) | `wind`; `crash`, `hit` ×4, `slime_pop` ×3, `feedback`, `drone_whine`; `battle_tutorial` |
| S4/S6 Street day | `snow` | traffic hiss; `glitch` under the billboard; `battle` |
| S5 Apartment / montage | `apartment` (lo-fi, fridge-hum triangle) → `signal` (arpeggio climbing an octave per bar) → `garage` (wind, one hat per 2 bars) | `feedback`, `glitch`; captions silent |
| S7 Café | `coffee` (bossa chiptune) | `item`, `phone_ring` ×2, `click` |
| S8 City Sound hall | `city_sound_muffled` (`rehearsal` low-passed) | `door`, `sneeze`, per-door loops |
| S9 Room 4 | silence → `boss_audition` (196 bpm) | `stick_click` ×2, `pedal`, `drum_hit`, `cymbal` |
| S10 Month later | `rehearsal_brian` (straight, no accents) → `rehearsal` | `kraaang`, `coffee_spill`, `sparks`, `pop`, `gears`, `door_slam`, `door`, `sneeze` |
| S11 Street night | `snow_night` (`snow` + neon pad) | neon buzz; `battle` |
| S12 Palmer's | `palmers` (crowd noise + jukebox) → `the_set` (7/8, 180 bpm) → `eternity` (40 bpm triangle drone, noise swells) | `power_chord`, `splash`, `drum_hit`, `cymbal`, `roof_peel`, `crash` ×3 |
| S13 Rubble | none; `wind` | `cymbal` (long), `rubble`, `sneeze`; four-note sting |
| Game Over | `gameover` (title riff at half speed) | `sneeze` |

Every battle opens with `stick_click` ×2; `victory` is a two-second feedback squeal resolving to a chord.

## Controls & save

Arrows/WASD move; Z/Enter confirm; X/Esc cancel; Shift run; C/Tab menu; gamepad via `Input.js`. Confirm completes the page, then advances; `?fast=1` honored.

**Bajonka is the save point.** A `type: "save"` entity (`condition: "flags.bajonkaSeen"`) on the alley milk crate, the apartment couch arm, the sidewalk outside Hard Luck Café, the City Sound hallway outside Room 4 (the canonical clipboard pose), the stool behind the bar at Palmer's, and the rubble. She never trails the party; she is simply already there, and only Phoenix mentions it. **The gag:** interact → `sneeze` → "Bajonka holds out the clipboard." / **INITIAL HERE?** [Page 1] [Page 2] [Page 3] [Decline]. Saving bumps `vars.saveCount`: "You initial page {n}. Bajonka sneezes." Declining: "The clipboard does not move." Ryan's agreement is `3 + vars.saveCount` pages, so a cautious player hands him a forty-page contract. Game Over: "CONTINUE FROM LAST INITIALED PAGE?" Slots `smfos.save.1..3`.

### Flag & quest-state flow

```
TITLE ─new game─▶ pod_bay
  speaker ─▶ podSpeakerSlapped ─EJECT─▶ ejected ─▶ [Freefall] vars.billboardsTagged
  ▼
alley  ep0_crash ─▶ metPhoenix ─B1─▶ droneDefeated ─▶ phoenixJoined ─▶ bajonkaSeen (SAVES ON)
  ▼ (hubOpen=false: only the apartment door)
apartment  amp ─▶ ep0_signal ─▶ signalSent ─[rooftops, garage]─▶ END PART 1 / ONE WEEK LATER
  ─▶ weekLater + hubOpen (café, pawnshop, enemies ON; rail OFF)
  ▼
coffee_shop  corkboard ─▶ flyerPosted (vars.flyerText 0..2)
  ▼
street  ep0_brian_arrives ─▶ brianJoined ─[garage call]─▶ brianCalledRyan (rail ON)
  ▼
city_sound_hall  ep0_ryan_arrives ─▶ ryanArrived
room4  ep0_room4_setup ─B2─▶ auditionDone ─▶ ryanJoined (contractPages = 3 + saveCount) ─save─▶
  ONE MONTH LATER ─▶ monthLater ─KRAAANG─▶ pedalboardFried ─▶ brianQuit (−brian, +fried_pedalboard)
  ─flyer─▶ gigFlyer (street NIGHT; Palmer's ON; cops ON; Intern OFF)
  ▼
palmers  stage ─▶ ep0_palmers_set ─B3─▶ eternity ─▶ palmers_rubble
  ▼
rubble  ep0_aftermath ─▶ ryanQuit (vars.quitResponse; −ryan; luckyRageLocked) ─▶ ch1Complete ─save─▶ TITLE

Side flags (never gate the spine): readBillyPod, billsRead, pizzaBoxLooted, jukeboxPlayed,
cleared_<enemy>, trig_<map>_<id>, vars.saveCount.
```

Gating lives only in entity `condition`s and exit conditions, so `__slime.warp` + `setFlag` can jump the playthrough test to any scene.

## Content inventory

**Overworld sheets (16×24 unless noted).** Lucky ×8 (`lucky`, `_tense`, `_deflated`, `_rage`, `_glow`, `_bristle`, `_dust`, `_puddle` 16×16) + `lucky_ball` 16×16 + `lucky_flat` 32×16; Phoenix ×4 (`phoenix`, `_trash`, `_puddle`, `_dust`); `brian`, `brian_red`; Ryan ×4 (`ryan`, `_loaded` 16×40, `_slimed`, `_purple`) + `eternity` 64×64; Bajonka ×4 (`bajonka`, `_clipboard`, `_contract`, `_keys`); 30 NPC sheets (street 9, café 5, City Sound 6, Palmer's 10 incl. six crowd variants); on-map enemies `drone`, `intern`, `scooter`, `cop`, `cop_nomohawk`.
**Objects (~55).** Pod bay 6; alley 7; street 7 (incl. `billboard_work` + `_glitch`, `pizza_box`); apartment 10; café 3; Room 4 10 (incl. `pedalboard` + `_fried`, `coffee_cup` + `_spilled`, `contract`, `brain_xray`, `drips`); Palmer's 6; SFX letters `sfx_crash`, `sfx_kraaang`, `sfx_g`, `sfx_doom`, `sfx_crack`, `sfx_thud`; `soundwave`, `shockwave`, `aura_link`, `slime_splat`, `mohawk`, `drywall`.
**Battle sheets (32×32 unless noted).** Party 4 (+ Lucky's 4 color variants, Ryan's slimed/purple, `eternity_battle` 64×64); enemies `drone_b`, `intern_b`, `scooter_b`, `cop_b`, `riot_cop_b` 48, `whrnnng_b` 48, `thudthud_b`, `crowd_hostility_b` 48. Backgrounds `bg_street`, `bg_alley`, `bg_room4`, `bg_palmers`, `bg_palmers_roofless`, `bg_cosmic`.
**Portraits.** 18 (listed under UI).
**Tilesets (9).** `vanguard_ship`, `sky`, `minneapolis` (snow, slush, sidewalk, road, brick ×3, Towers panels ×4, neon, windows, chain-link, platform), `apartment_int`, `coffee_int`, `garage_int`, `city_sound_int` (sticker walls ×4), `palmers_int`, `rubble`.
**UI.** Window 9-slice, torn 9-slice, caption plain/tape, insert window, cursor, POCKET segments, color swatch, emotes.
**Songs (20 ids).** `title`, `pod_bay`, `freefall`, `snow`, `snow_night`, `apartment`, `signal`, `garage`, `coffee`, `city_sound_muffled`, `rehearsal`, `rehearsal_brian`, `boss_audition`, `palmers`, `the_set`, `eternity`, `battle`, `battle_tutorial`, `victory`, `gameover` — four are variants of existing patterns.
**SFX added.** `drone_whine`, `crash`, `pedal`, `stick_click`, `phone_ring`, `click`, `coffee_spill`, `sparks`, `pop`, `gears`, `door_slam`, `thud`, `power_chord`, `splash`, `roof_peel`, `rubble`, `snore`, `glitch`.
**Scripts.** `ep0.json`: the 16 cutscenes above plus `ep0_dad_1..4`; `npc_*.json` (~90 one-line object/NPC scripts); `shops.json` (`pawnshop`, `cafe`). Battle scripts in code: `tutorial_drone`, `audition`, `palmers_set`.

## Risks & cuts

| Risk | Cut / fallback |
|---|---|
| `FreefallScene` is bespoke (RenderTexture trail, steering). | A 10-second autoscroll with no steering; billboard count fixed at 7. |
| UI asks beyond §12.2: `ui.setFrame('torn')`, `ui.bulge`, `ui.insert`, `{var:x}` markup. | Torn → shake the UI camera; bulge → `ui.flash`; insert → a narrator line; `{var:}` → fixed text ("a very long band agreement"). |
| Mid-battle ally entrance (Phoenix, B1) and ally-as-hazard (Ryan, B2/B3) exceed §8's hook list. | Phoenix joins before B1; Ryan's Fill becomes a fixed per-round event via `onRound`. |
| 64×64 Eternity and 16×40 Ryan-with-hardware break the 16×24 assumption. | Hardware as a separate object that moves in lockstep; Eternity at 48×48. |
| Night variant of `street_cedar`. | Overlay + second roster is already the cheap plan; if it slips, the gig is at dusk. |
| Toon 4 rupture (`bg_cosmic`, HUD swap). | Background swap only; the captions still land. |
| ~45 lines of NPC flavor. | Cut order: Palmer's crowd (keep 6), night extras, the ska band, Cold Brew Guy. Never cut: bills, Pizza Luce box, billboard, Billy's pod, jukebox. |
| `rooftops` and `garage_north` are cutscene-only maps. | Rooftops → three captions over black; keep the garage (used twice; it is the Ryan hook). |
| Playtime over 75 min. | Day hub to one drone + the Intern; night to one cop duo. |
| The quit choice (rage/plead/joke) promises branching it does not deliver. | That is the point; `vars.quitResponse` is read once in Chapter 2 — Phoenix remembers which one you picked. |
