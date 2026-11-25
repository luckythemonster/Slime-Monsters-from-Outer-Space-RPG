# Progression: levels, skill trees and equipment for the whole game

Status: proposal. Every name, number and node here is *(new)* until Lucky says otherwise; what Lucky has
decided is under Decisions and tagged *(canon, Lucky)*. Where a node is named
after a line, the line is canon and the node is not. In the repo this is `docs/PROGRESSION.md`. It sits beside
`docs/DESIGN.md`, which stays the authority on how a battle works, and it replaces DESIGN.md's "Party &
progression" and "Items, equipment, shops" as the plan for everything after Chapter 1. Written against the repo
at 70f0730.

## The problem

Chapter 1 hands out the whole kit. Measured against the shipped data:

- Lucky and Phoenix reach level 7 on the critical path and 8 on a full clear, in 70 minutes of an 18-hour game.
- Both have their entire riff list by level 7. All three Lucky and Phoenix Syncs are in by level 5.
- Every NOISE word the player can ever spend Toon on (POP!, KRAAANG, KRATHOOM) is available in the first hour.
- The pawnshop sells the best instrument for both of them, and a full clear can afford one.
- Lucky learns a riff called Migraine at level 5. The bible makes MIGRAINE Lucky's ultimate, learned in a cave in
  Chapter 11.

After the rubble of Palmer's the only thing left to grow is the numbers.

## The answer, in five rules

1. **Chapter 1 is tier zero.** Nothing the slice gives is taken back and no Chapter 1 save breaks. What the slice
   teaches is the bottom row of each tree.
2. **Levels buy numbers. The story buys verbs.** Every chapter hands the band something new to do, for free,
   at a beat the bible already has. A player who never opens the tree screen still gets a new verb every
   chapter.
3. **Trees are per instrument, and tiers open with the story.** Chops cannot buy past the tier the chapter has
   opened, so no tree can be finished early. There are fewer chops than nodes, so no tree set can be finished at
   all.
4. **Nothing you learned is lost. It moves.** Phoenix's bass lines transpose to the synth and come home on the
   rascal. Lucky's guitar goes to David. Diego's Strat riffs modulate.
5. **Disc 1 you buy. Disc 2 you build.** Bought gear dies in the collision with everything else Disc 1
   accumulated. Disc 2 gear is welded by Sticky out of scrap and is never sold.

## Levels

### The curve

The XP table already in `characters.json` keeps its shape: each level costs 15 more than the last (level 8 to 9
costs 90, level 38 to 39 costs 540). Extend it from 20 entries to 50. Nothing in the game reaches 50.

| Ch | Level at start | Level at end, critical path | XP in the chapter | From scripted fights (about 70%) | From ordinary fights | Level at end, full clear |
|---|---|---|---|---|---|---|
| 1 | 1 | 7 | 206 (shipped) | 180 | 26 | 8 |
| 2 | 7 | 10 | 304 | 210 | 90 | 11 |
| 3 | 10 | 13 | 420 | 290 | 130 | 15 |
| 4 | 13 | 16 | 555 | 390 | 170 | 18 |
| 5 | 16 | 18 | 445 | 310 | 130 | 20 |
| 6 | 18 | 19 | 245 | 170 | 70 | 21 |
| 7 | 19 | 22 | 825 | 580 | 250 | 25 |
| 8 | 22 | 25 | 960 | 670 | 290 | 28 |
| 9 | 25 | 28 | 1,095 | 770 | 330 | 32 |
| 10 | 28 | 32 | 1,670 | 1,170 | 500 | 36 |
| 11 | 32 | 35 | 1,410 | 990 | 420 | 40 |
| 12 | 35 | 38 | 1,545 | 1,080 | 460 | 43 |

- Six levels an hour in Chapter 1, about two an hour after. The front load is deliberate and is how a JRPG
  usually opens.
- The slice's rule holds for the whole game: ordinary fights stay dead and scripted fights pay most of the XP.
  Total XP is finite, so the curve is paced by the story and cannot be broken by grinding. Optional content adds
  about 30% per chapter.
- Trunk is tuned for level 37. A full clear arrives at 42 or 43.
- Chapter 6 pays one level. The Sludge Duel pays nothing, because nothing in it matters.

### Stats

Levels 1 to 8 are exactly the tables in DESIGN.md. From level 9 three stats slow down, because the shipped
growth breaks the formulas if it runs to level 38:

- **LCK** gains 1 every third level. At the shipped rate Lucky would crit 33% of the time at Toon 3 by the
  finale. At this rate it is 23%.
- **SPD** gains 1 every second level. The SETLIST roll is `SPD + rng(0..3)`, so a wide SPD spread makes turn
  order a fixed list.
- **AMP** gains 1 a level. Later riffs cost 8 to 18.

HP / AMP / ATK / DEF / SPD / LCK, before equipment:

| | L8 (end of Ch 1) | L13 (Ch 3) | L19 (Ch 6) | L28 (Ch 9) | L38 (Ch 12) |
|---|---|---|---|---|---|
| Lucky | 70 / 22 / 21 / 11 / 14 / 13 | 100 / 27 / 31 / 16 / 16 / 14 | 136 / 33 / 43 / 22 / 19 / 16 | 190 / 42 / 61 / 31 / 24 / 19 | 250 / 52 / 81 / 41 / 29 / 23 |
| Phoenix | 83 / 24 / 15 / 20 / 12 / 11 | 118 / 29 / 23 / 27 / 14 / 12 | 160 / 35 / 32 / 36 / 17 / 14 | 223 / 44 / 45 / 50 / 22 / 17 | 293 / 54 / 60 / 65 / 27 / 21 |
| Diego | 72 / 24 / 16 / 11 / 13 / 15 | 102 / 30 / 24 / 16 / 15 / 17 | 138 / 37 / 35 / 22 / 18 / 20 | 192 / 49 / 51 / 31 / 23 / 25 | 252 / 61 / 68 / 41 / 28 / 30 |
| Sticky | 94 / 13 / 20 / 21 / 11 / 10 | 134 / 16 / 28 / 31 / 12 / 11 | 182 / 21 / 39 / 43 / 14 / 13 | 254 / 28 / 55 / 61 / 17 / 16 | 334 / 35 / 72 / 81 / 21 / 20 |

Growth per level from 9: Lucky HP 6, AMP 1, ATK 2, DEF 1. Phoenix HP 7, AMP 1, ATK 1.5, DEF 1.5. Diego HP 6,
AMP 1.25, ATK 1.75, DEF 1, LCK 1 every second level (he is never wrong about vibes). Sticky HP 8, AMP 0.75,
ATK 1.75, DEF 2, SPD 1 every third level. Fractions floor. The table is the acceptance test, as in DESIGN.md.

Riff POW stays under 300 for the whole game. The numbers grow through ATK. The kit grows through effects.

### Who levels

- **Lucky, Phoenix, Diego, Sticky** level. Everyone in the band gets full XP, on stage or not, including the solo
  fights in Chapter 5.
- **A member who joins** arrives at Lucky's level with the chops for it unspent: Diego in Chapter 2, Sticky in
  Chapter 3.
- **Diego's road trip.** He comes back in Chapter 12 at Lucky's level. Each postcard read in Chapter 11 is one
  chop waiting for him at the airlock.
- **Guests do not level.** Warner, Alibi, Shannon and David sit at Lucky's level when they arrive and have fixed
  kits. Alibi's QUANTIZED STRIKE hits for 88 at any level, which is strong in a hub fight and weak against a
  boss. It only knows how to be right.
- **Bajonka has no level.** She has never needed one. Her sequences in Chapters 4 and 11 use fixed verbs.

### Tuning targets

Starting points for each chapter's design spec, to be simulated the way DESIGN.md simulated the hub. They assume
Lucky at the chapter's end level with an on-budget instrument.

| Ch | Level | Lucky STRUM | Ordinary enemy HP | Boss HP (total) | Enemy ATK |
|---|---|---|---|---|---|
| 2 | 10 | 54 | 240 | 800 | 15 |
| 3 | 13 | 67 | 300 | 1,000 | 18 |
| 4 | 16 | 80 | 360 | 1,200 | 21 |
| 5 | 18 | 88 | 400 | 1,300 | 23 |
| 6 | 19 | 93 | 420 | none (GRAVITY) | 25 |
| 7 | 22 | 106 | 480 | 1,600 | 28 |
| 8 | 25 | 118 | 530 | 1,800 | 31 |
| 9 | 28 | 131 | 590 | 2,000 | 34 |
| 10 | 32 | 149 | 670 | 2,200 | 39 |
| 11 | 35 | 162 | 730 | 2,400 | 42 |
| 12 | 38 | 174 | 780 | 2,600 | 45 |

The slice's rule stays: an ordinary fight costs 15 to 30% of the party's HP pool. The bosses with no HP bar
(THE FINGER, Sludge Duel II, the rider, the Retention Unit) ignore the boss column.

## Chops

A **chop** is a skill point. Each member earns one per level from level 9 on. Most chapters also have one
optional fight that pays one chop to everyone on stage (THE TOLL BOOTH is Chapter 2's). There are ten.

Chops are spent on the PRACTICE page of the pause menu. A node needs its tier open and one node owned in the
tier below it on the same branch.

| Tier | Opens | Cost per node | Nodes per branch |
|---|---|---|---|
| 0 | Chapter 1 (learned by level, as shipped) | free | the slice's kit |
| 1 | Chapter 2 | 1 | 2 |
| 2 | Chapter 4 | 2 | 2 |
| 3 | Chapter 7 | 3 | 2 |
| 4 | Chapter 10 | 4 | 1 |

A branch costs 16 chops and a member has three branches: 48. The critical path earns 30 by the finale. A full
clear with every optional fight earns 45. So a player finishes about two branches of three, and nobody finishes
all three. A branch that arrives late opens its tiers no earlier than the table says and no faster than one a
chapter: Diego's TALK at Chapters 3, 4, 7 and 10, Phoenix's SYNTH at 7, 8, 9 and 10.

Nodes marked ★ are story nodes. They cost nothing, arrive at a bible beat and cannot be missed.

## What each chapter adds

The guarantee behind rule 2. Words are the band's NOISE vocabulary: SFX words collected from set pieces, never
bought, spent with Toon. Chapter 4 is the thin one, which is why tier 2 opens there.

| Ch | Lucky | Phoenix | Diego | Sticky | Band |
|---|---|---|---|---|---|
| 1 | the slice's riffs | the slice's riffs | | | Shared Aura, Low-End Theory, Wall of Sound; POP!, KRAAANG, KRATHOOM |
| 2 | GUITAR SWING (crits on the crash) | | joins with STRAT and VIBES | | the BAJONKA summon at the dock; word: SQUELCH; tier 1 opens |
| 3 | SPLATTER (coat an ally so they can Sync) | | TALK | joins with 13/8 and ADHESIVE; TINKER | word: WHACK; Syncs with Diego and Sticky |
| 4 | | | | | word: BZZZZT; tier 2 opens; Bajonka playable |
| 5 | PUDDLE | CYAN (forced) | | the silent kit: stomp, smother, rip | word: KRRRRAAANNNGGGGG, when the embargo lifts |
| 6 | RESOLVE | | | | ONE MORE CHORD, once. Then the collision |
| 7 | TERMS & CONDITIONS and Breath; the hubcap guitar | FOUR NOTES; Cyan becomes a toggle; SYNTH opens | | WELD: the forge | READ; tier 3 opens |
| 8 | SLOW BEAT | DRONE | COMMUNE | REST (not playing, as a move) | Kurt is the vehicle |
| 9 | COUNT IN | COWARD, SIR | STAMPED (the visa; no more HIDING) | | invoices |
| 10 | CALL THE CHANGE; WE ARE ALL SLIME | | | carries the burnt-out XXX-666 | SPOUSAL PRIVILEGE, or the BAJONKA command struck through; word: WHIRRR-CLANK-SQUEEEAAAK; tier 4 opens |
| 11 | CLEAR; MIC CHECK: STAGE DIVE, more Breath, split lines, MIGRAINE | | gone; postcards | STICKY-R: DOWNBEAT | |
| 12 | the voice; PASTEL at the fourth-wall break | the rascal: WRESTLE, THE PLUMBING; I THINK | MODULATION, SONIC MISSILES | | David; They Came from the Sky |

## The trees

Format: name (AMP or Breath cost): effect. Tier 0 is shipped unless marked ★.

### Lucky

| | GUITAR (HIGH) | VOICE (NOISE) | SLIME (PHYS; Mom's side) |
|---|---|---|---|
| **0** | Power Chord, Feedback Squeal | Headache (the slice's "Migraine", renamed) | Pseudopod Slap, Bristle; crits inflict SLIMED |
| **1** | **Play Fast** (5): three hits at POW 60, random targets. **Palm Mute** (4): POW 100, and Lucky is TUNING until their next turn. | **This One's Called** (4): +10 Toon, and the next riff anyone plays costs no AMP. **Banter** (3): one enemy ATK down 20% for 3 rounds, +5 Toon. | **Long Leg** (2): reach across the stage and tweak a knob. Cures an ally's OUT OF TUNE and gives them 4 AMP. Does not end Lucky's turn, once a round. **Flying Squirrel** (4): flatten. The next PHYS hit on Lucky misses. |
| **2** | **Loud, Not Right** (8): POW 200, hit 70%. Cannot miss at Toon 2 or above. **Drop Tune** (7): POW 150, counts as HIGH and LOW. | **Inner Truth** (8): POW 170 single. Stronger the further Lucky's color is from pastel. **Hum** (0): POW 60 on all, restores 3 AMP. Makes no noise on a NOISE meter. | **Mach 2** (6): TEMPO UP on Lucky for 3 rounds, +6 Toon. **Biomass** (7): Lucky heals 30% and sheds every status. |
| **3** | **Plasma Strings** (10): POW 180, the target's DEF down 25% for 3 rounds. **Laser Bomb** (12): all enemies, POW 170, 30% DAZED. | **Boilerplate**: a clause of three words or more hits every enemy. **Second Verse**: repeat Lucky's last VOICE riff at half cost. | **Angry Cat**: while BRISTLING, Lucky counters every hit at POW 100. **Coagulate** (12): revive an ally at 40% HP, coated. |
| **4** | **Hubcap** (16): POW 280 single, ignores resistances. | **Loud With**: VOICE riffs gain 10% for each bandmate standing. | **Pour** (14): Lucky pours into a bandmate's rig, the way they poured into the input jack. That bandmate's next riff costs nothing and hits at double. |
| **★** | Ch 2 GUITAR SWING. Ch 7 the hubcap guitar. Ch 8 SLOW BEAT. Ch 12: the branch is David's. | Ch 7 TERMS & CONDITIONS. Ch 9 COUNT IN. Ch 10 CALL THE CHANGE. Ch 11 MIC CHECK. | Ch 3 SPLATTER. Ch 5 PUDDLE. Ch 6 RESOLVE. Ch 10 WE ARE ALL SLIME. Ch 11 CLEAR. Ch 12 PASTEL. |

- **GUITAR** is locked from the collision until the hubcap guitar is forged, and for good from the morning Lucky
  goes clear. The help line: "Lucky hasn't touched it." That morning every chop spent on GUITAR comes back, to
  spend on VOICE and SLIME. The nodes are not erased: in Chapter 12 they are David's kit, exactly as the player
  built it. "What's it tuned to?" / "Loud." *(canon, Lucky: the refund)*
- **VOICE** runs on AMP in Disc 1 and on **Breath** from Chapter 7. Breath is a second pool, Lucky's only: it
  starts at 10, gains 1 per VOICE node owned, and refills by 3 at the start of each of Lucky's turns.
- **The voice has no instrument.** With the slot empty, each VOICE node owned adds 2 ATK to VOICE riffs. A Lucky
  with the branch finished and Hank's lesson sings at about the strength of a fully welded hubcap guitar. The
  weapon was in the tree the whole time.
- **COUNT IN** (Ch 9): Lucky spends their turn counting a bandmate in. That member acts at once, at +25%, or
  +50% if the player confirms on the four.
- **RESOLVE** (Ch 6): BRISTLING without the DEF penalty. Resolve, not rage.
- **WE ARE ALL SLIME** (Ch 10, at the fence, on "We have a drummer."): from here the whole band starts every
  fight coated and everyone can Sync with everyone. It is given, not bought. *(canon, Lucky)* It still holds
  while Lucky is clear.
- **CLEAR** (Ch 11 to the fourth-wall break): no crits, and every color effect is off, which is Inner Truth,
  RESOLVE and SLIMED on crit. Everything else works, as the bible says.
- **MIGRAINE** cannot be bought. It is learned in the cave by the two-press route and spends all of Lucky's
  Breath.

### Phoenix

| | BASS (LOW) | BRAIN (support) | SYNTH (Disc 2) |
|---|---|---|---|
| **0** | Root Note, Drone Note, Rent Is Due | My Brain Thinks, Deadpan | ★ Ch 7: FOUR NOTES |
| **1** | **Walking Line** (4): POW 110. Each use in a row adds 20, three times. **Lock In**: +30% when Phoenix acts directly after the drummer. | **Tupperware** (4): Phoenix heals 25% and sheds every status, MELTING included. **Second Opinion**: My Brain Thinks also shows the enemy's next move on the SETLIST. | **Arpeggio** (6): four hits at POW 50, spread across enemies. **Patch** (3): an ally gains 6 AMP. |
| **2** | **Sub Drop** (8): all enemies, POW 150, strips TEMPO UP. **Security Deposit** (6): pay up to $5 for POW 60 per dollar. | **Time Signature Change** (6): swap two names on this round's SETLIST. **Officially** (8): every status on everyone ends, friend and enemy. | **Filter Sweep** (9): all enemies lose their resistances for 2 rounds. **Sidechain**: Phoenix's next riff gains 30% each time the drummer hits. |
| **3** | **Root, Fifth**: once a round, Phoenix adds a POW 60 hit after a bandmate's riff. **Low End**: an enemy hit by a LOW riff takes 15% more from the next HIGH or NOISE hit. | **It's a Mistake**: any miss by the band refunds half its AMP and gives 6 Toon. **Overthink** (5): skip this turn and act twice on the next. | Cyan only. **Touch Base Offline** (12): one non-boss enemy leaves the fight for 2 rounds. **Pivot** (10): swap an enemy's weakness and resistance. |
| **4** | **Root Notes**: Root Note hits twice and always inflicts TEMPO DOWN. | **Protecting the Set** (10): Phoenix takes every hit aimed at one bandmate for 2 rounds. | **Off Switch**: turning Cyan off heals the band 30% and gives 20 Toon. |
| **★** | Ch 12: WRESTLE, THE PLUMBING | Ch 9: COWARD, SIR. The last line: I THINK | Ch 5: CYAN. Ch 7: the toggle. Ch 8: DRONE |

- **Transposed.** After the collision BASS riffs play on the synth at three quarters POW, tagged (transposed) in
  the menu. A bassist on a synth plays bass lines. On the rascal they come back at five quarters, each with a
  WRESTLE input on the beat: land it for the bonus, miss it and the riff picks its own target.
- **CYAN** is a stance. Damage +25%, hit 100%, crit 0, Toon gains halved, BRAIN locked, no Sync but Fine Print. It is Brian's
  $2,000 pedalboard wearing Phoenix's face, and the TOON label turns the same beige.
- **FOUR NOTES** (Ch 7) takes four turns. Each note is a small band-wide buff that stacks. It has no fifth note
  and no finish for all of Disc 2. It finishes on a bass in Chapter 12.
- **COWARD, SIR** (Ch 9): the tic aimed outward. One enemy's next attack is halved and has to target Phoenix.
- **I THINK.** BRAIN has a fifth node that reads "???" from Chapter 1 and cannot be bought, the way DOOM, CRACK
  and THUD sit greyed in the slice. On the last line of the game it fills in. It does nothing in this game.
- **THE PLUMBING** (Ch 12) is the bible's: the first root note on Greg's bass.

### Diego (Chapters 2 to 10, and 12)

| | STRAT (HIGH) | VIBES (support) | TALK (from Ch 3) |
|---|---|---|---|
| **0** | **Heavy** (4): POW 150. **Nice Phrasing** (3): POW 110, +50% if a bandmate played a riff earlier this round. | **Positive Vibration** (4): heal an ally 30% of max HP, cure OUT OF TUNE. **Hold Space** (5): an ally takes half damage for 2 rounds. | ★ Ch 3: TALK, vegetables first |
| **1** | **Sustain** (5): POW 90 now and again next round, free. **Bend** (4): POW 130, 40% OUT OF TUNE. | **Grounding** (5): cures DAZED and TEMPO DOWN on the band. **Raw Potato**: Diego heals 40%, once a fight, free. | **Complex Starch** (4): an ordinary enemy below half HP walks away. Full XP, no money. **Sincerity**: TALK works on people. A talked-down human pays 50% more. |
| **2** | **No Solo** (8): all enemies, POW 140, +40 for each bandmate who has already acted this round. **Rhythm Guitar**: Lucky's GUITAR riffs gain 15% while Diego stands. | **Heavy Aura** (6): one enemy ATK down 25% for 3 rounds. **Brothers** (7): TEMPO UP on the band for 2 rounds. | **Sorry About Your Divorce** (8): an enemy loses its buffs and half the time its next turn. **Math Test** (7): OUT OF TUNE and TEMPO DOWN on one enemy. |
| **3** | **Feedback Loop** (9): two hits at POW 100, +5 Toon each. **Wah** (8): POW 160, the target's next attack misses. | **Very Tall**: the first hit on the band each round lands on Diego at half. **Chill** (9): one enemy's next action is delayed a round. | **Real Estate** (10): strips an enemy's strongest buff and blocks new ones for 3 rounds. **Man.** (0): one word. +8 Toon, 30% DAZED. Does not end his turn, once a round. |
| **4** | **Long Sustain** (15): POW 260 single, then POW 90 a round until Diego is hit. | **Never Wrong**: VIBES heals double on anyone below 30%. | **Holding Space For That** (14): if every ordinary enemy is below half, the fight ends. Full XP, double CROWD. |
| **★** | Ch 12: MODULATION, SONIC MISSILES | Ch 9: STAMPED | Ch 8: COMMUNE |

- **NO VISA.** Diego starts any fight against Vanguard law HIDING, as in the Riot Solo, until a bandmate lands a
  hit on the beat. STAMPED in Chapter 9 removes it for good.
- **TALK is gone for Chapter 11**, as the bible says. The chops are not refunded. The player should miss him.
- **MODULATION** (Ch 12): every STRAT riff can be played at any frequency, chosen at use. SONIC MISSILES adds a
  POW 60 splash to each. Nothing bought on the Strat is wasted on the synthesizer.

### Sticky (from Chapter 3)

| | 13/8 (drums) | ADHESIVE (PHYS) | WORKSHOP |
|---|---|---|---|
| **0** | **Thirteen-Eight** (3): the grid attack from the Dome. **Down the Stairs** (4): five hits at POW 40, random targets. | **SCHLUCK** (3): POW 100, 50% STUCK (loses its next turn). Tin can: the highest DEF in the band. | **Challah**: one loaf appears in the inventory at every save. Heals the band 20%. ★ TINKER |
| **1** | **Odd Accent** (4): POW 130, half again against shields and DEF buffs. **Lean Into It**: a missed grid tap still does half. | **Don't Hug Him**: an enemy that hits Sticky with PHYS is STUCK. **Glued Sticks**: immune to DAZED. | **Croissant** (5): revive an ally at 30%. **Custodial Unit** (4): cure every status on one ally. |
| **2** | **Lands On Its Feet**: once a fight, a killing hit leaves Sticky at 1 HP. **Polyrhythm** (7): Sticky's attack repeats at the end of the round at half POW. | **Smother** (6): POW 120 and DEAF. Silent. **Stomp** (6): POW 160. Silent. | **Baker's Dozen**: every thirteenth item the band uses is not used up. **Duct Tape** (5): the next hit on one ally is absorbed. |
| **3** | **Fifteen Minutes**: hold for one or two turns, then hit at double or at three and a half times. **Fill** (8): POW 150 on a random enemy, and the next bandmate acts at once. | **Rip** (9): POW 220 against a STUCK enemy, and it loses its DEF buffs. **Cordwood** (10): two ordinary enemies are STUCK to each other and share damage. | **Luthier**: the forge costs a quarter less SCRAP. **Spot Weld** (8): an ally's instrument gains 25% ATK for the fight. |
| **4** | **Rounding Error** (14): POW 250, doubled against anything quantized or Vanguard-built. | **Combat Red** (12): ATK +50% for 3 rounds, silent, no Toon gain. | **The Defect Is the Sound**: any status on Sticky also gives him TEMPO UP. |
| **★** | Ch 8: REST. Ch 11: DOWNBEAT | Ch 5: the silent kit (the Osmium Dozen) | Ch 3: TINKER. Ch 7: WELD |

- The Osmium Dozen lends Sticky Stomp, Smother and Rip for that one fight whether or not he owns them.
- Sticky's turns arrive on the 13-step grid, per the roadmap. His AMP pool is small on purpose and his riffs are
  cheap. Silent moves add nothing to a NOISE meter, which is what the Library and the embargo are for.
- **DOWNBEAT** (STICKY-R, Ch 11): a counter on his HUD runs 1 to 13 across fights. On 13 the grid and the 13/8
  agree: that action is a guaranteed crit at triple damage, and it is what opens 4/4 locks.
- **REST** (Ch 8): Sticky's job is to not play, so not playing is a move. He gains 6 AMP and his next hit gains
  half again.

### Syncs

DESIGN.md's rule stands: only slime can Sync. SPLATTER (Ch 3, free) coats one bandmate for three rounds so they
count. From the fence in Chapter 10, WE ARE ALL SLIME coats everyone from the count-in, for free. The potato
said so in Chapter 2.

A Sync shows up when both partners own its two parts, as in Chrono Trigger.

| Sync | Pair | Parts | Effect |
|---|---|---|---|
| Shared Aura, Low-End Theory, Wall of Sound | Lucky + Phoenix | shipped | as shipped |
| **No Guitar Solo Necessary** | Lucky + Diego | Play Fast + Nice Phrasing | All enemies, HIGH, POW 200. Neither of them solos. |
| **Math Rock** | Lucky + Sticky | Power Chord + Thirteen-Eight | Thirteen hits at POW 25, random targets. |
| **Rhythm Section** | Phoenix + Sticky | Lock In + Odd Accent | Single, POW 240, LOW and PHYS. The band gets TEMPO UP. |
| **Low End, Man** | Phoenix + Diego | Drone Note + Hold Space | The band takes half damage for a round. Enemies get TEMPO DOWN. |
| **Fine Print** | Lucky + Phoenix (Cyan) | TERMS & CONDITIONS + CYAN | One clause at no Breath cost that cannot be "accepted". The one Sync Cyan allows. |
| **Count Him In** | Lucky + Sticky | COUNT IN + DOWNBEAT | Sets Sticky's counter to 13. |
| **They Came from the Sky** | the whole band | Chapter 12, Phase 2, story | Everyone standing, once. The band's own song, from `src/audio/songs/`. |

### Words

The player's Toon meter still caps at 99, and Toon 4 stays scripted for the whole game.

| Word | From | Toon | Effect |
|---|---|---|---|
| POP!, KRAAANG, KRATHOOM | Ch 1 | 1, 2, 3 | as shipped |
| SQUELCH | Ch 2, the landing | 1 | Single, PHYS, POW 140, SLIMED. |
| WHACK | Ch 3, the merch table | 1 | One enemy goes to the bottom of the SETLIST, DAZED. |
| BZZZZT | Ch 4, the judges | 2 | Cancels one enemy's telegraphed move. |
| KRRRRAAANNNGGGGG | Ch 5, the embargo lifting | 3 | KRAAANG at POW 240, and the band's AMP refills. |
| WHIRRR-CLANK-SQUEEEAAAK | Ch 10, the fence | 3 | Sticky acts twice, now, and his counter moves two. |

### Guests and people who leave

| Who | When | Kit |
|---|---|---|
| Brian, Ryan | Ch 1 | as shipped |
| Warner | Ch 2 to 3 | Fixed. **Crash** (the visible beat every later rhythm system inherits). **Hold the Beat**: the band cannot be TEMPO DOWNed while he stands. AUTO in the Riot Solo, as the brief proposes. |
| Shannon | Ch 7 | Fixed. **Block the Scene**: the band acts in an order she picks. Her heckle from the Dome, now aimed at the enemy. |
| Alibi | Ch 10 | Fixed. QUANTIZED STRIKE, 88, always. |
| David | Ch 12 | **MIX**: raise one bandmate's damage 30% and lower another's 15%, each round. Plus every GUITAR node Lucky owned, on the hubcap guitar with its welds and stickers. |
| Bajonka | summon | The rider doc's rules: a page per use, SPOUSAL PRIVILEGE or the struck-through command. No level, no tree. |

## Equipment

### Slots

Three, up from two: **INSTRUMENT**, **RIG** (the amp, the pedals, whatever it plugs into) and **WEAR**. The
slice's accessories sort into RIG (both pedalboards) and WEAR (sunglasses, hoodie, jacket, flannel, earplugs).

### Stickers

"Do we really need all the political stickers?" Yes. Stickers are the socket system.

- An instrument has one to three sticker slots. A sticker is a small passive.
- The slice's Band Sticker (+1 Toon per action) is the first one. It stops being an accessory.
- Every venue has a sticker: one per chapter from the place the band played, plus two or three in shops. About
  twenty in the game.
- The sticker sheet is clipped to the Band Agreement, so Bajonka has it and it survives everything. A sticker
  peels off one instrument and goes onto another at any save.
- Proposed: POTATO BELT (+10% money from fights), WE ARE ALL SLIME (the wearer always counts as coated, until Chapter 10 makes it true of everyone),
  SHHHH (the wearer's first action each fight is silent), DISQUALIFIED: EXCESSIVE TONNAGE (+15% damage, SPD
  down 2), ON THIS SITE NOTHING HAPPENED (immune to OUT OF TUNE).

### Disc 1: bought and found

- Each chapter's shops sell one instrument step for Lucky and Phoenix and one RIG, priced so a full clear
  affords one of them. The slice's weed-or-bass choice, every chapter.
- An instrument on budget is about 35% of its player's base ATK: +9 at level 10, +13 at level 16, +15 at
  level 19. WEAR is about 30% of base DEF.
- Diego's red Strat is never replaced. Sticky tinkers with it. Sticky's sticks are glued on and that slot is
  locked.
- Every chapter still ends broke. Gear is the one thing that carries over, and then the collision takes it.

**What the collision takes.** Lucky's instrument, Phoenix's instrument, every RIG, everything not being worn,
all the money. **What is left:** WEAR, the Strat, Sticky, the sticker sheet, consumables, key items. Phoenix's
slot reads SYNTH. Lucky's reads a dash. *(canon, Lucky)*

### Disc 2: built

- **SCRAP** is the Disc 2 currency. It drops from machines (the salvage swarm, drones, the Retention squad) and
  sits in debris. It is not money, it cannot be invoiced, and it does not go to zero at a stinger.
- **WELD** (Ch 7 on, at any save where Sticky is in the party): spend SCRAP to raise an instrument or RIG one
  mark. A mark keeps pace with about three levels and every second mark adds a sticker slot.
- The hubcap guitar is born at Mark I, +17 at level 22. Four marks take it to +24 by Chapter 10, which stays on
  the 35% line. The synth follows the same marks.
- Nothing in Disc 2 is sold. Planet California is a mall that ate a mall and the band cannot afford any of it.
  The Palmer's II gift shop sells one mug.

### The spine

| Ch | Lucky | Phoenix | Diego | Sticky |
|---|---|---|---|---|
| 1 | Beat-Up Guitar, Thrift Telecaster | Trash Bag, Beat-Up Bass, P-Bass Copy | | |
| 2 to 5 | one guitar step and one RIG a chapter | one bass step and one RIG a chapter | Red Strat, tinkered | glued sticks; chassis parts in RIG |
| 6 | a dash | SYNTH | Red Strat | |
| 7 to 10 | Hubcap Guitar, Mark I to IV | Salvaged Synth, Mark I to IV | Red Strat, welded | the burnt-out XXX-666 in the bag (Ch 10) |
| 11 | a dash (the voice) | Synth | gone | STICKY-R: the XXX-666 locked into RIG |
| 12 | LUCKY | the rascal (locked; it does not hold still) | Transdimensional Modulation Synthesizer, missile amp in RIG | STICKY-R |

David carries the hubcap guitar at whatever mark the player welded, through the nuclear amplifier.

### Three pieces of gear with a point

- **Fried Pedalboard** (shipped). The pattern for everything a departing member leaves: good, with a catch.
- **Vanguard Badge** (Ch 9, "Expense it"). WEAR. The best DEF in the game and a dental plan (regen 5% a round).
  Toon gains are halved while anyone wears it and the TOON label turns beige. It can be worn. The game does not
  comment.
- **The Tinny Ride Cymbal** is never equipment and never a node. It never pays off mechanically, on purpose.

## What changes in the Chapter 1 build

Small, and all of it belongs in the roadmap's Foundations pull request with the save migration.

1. **Rename the level 5 riff.** `migraine` becomes `headache`, "Headache". Same numbers. MIGRAINE is reserved
   for the cave. The Chapter 1 line it is named for is about what the whole empire gets, and one riff in a
   rehearsal room is a headache.
2. **Extend `xpTable` to 50** by the existing rule.
3. **Growth past level 8.** `Party.levelStats` takes one growth number per stat. It needs a second set from
   level 9, or full per-level arrays generated by a script in `tools/`. Phoenix's ATK array stops at 20 entries
   today, so their ATK would freeze at 33 from level 21.
4. **Save format.** New per member: `chops`, `nodes` (owned node ids), `breath`. New on the state: `words`,
   `stickers`, `scrap`. Riffs with a `level` keep working as tier 0. A Chapter 1 save migrates with nothing to
   grant.
5. **Slots.** `accessory` becomes `rig` and `wear`. The migration moves whatever is equipped to its new slot,
   and an equipped Band Sticker onto the instrument.
6. **Nothing else in Chapter 1 is rebalanced.** No fight, price or level in the slice moves.

Add a row to the roadmap's carry-over ledger for each: chops and nodes (every chapter), the sticker sheet,
SCRAP (Ch 7 on), Lucky's GUITAR nodes (written Ch 2 to 10, read by David in Ch 12), Phoenix's BASS nodes
(read by the rascal in Ch 12), postcards read (Ch 11, read as Diego's chops in Ch 12).

## Decisions (Lucky)

1. **Lucky's guitar chops come back.** The morning Lucky goes clear, every chop spent on GUITAR is refunded, and
   David still plays the nodes in Chapter 12.
2. **The collision takes** instruments, RIGs, unworn gear and money. WEAR and the sticker sheet survive.
3. **We Are All Slime is given.** It is a story node at the fence in Chapter 10, not a purchase. SLIME's tier 4
   node is Pour instead.

## Open questions for Lucky

1. **Chapter 1's pace.** *Default:* leave the slice alone; it ends at level 7 or 8 and is tier zero. *Alternative:*
   flatten it to end at level 5 and move Wall of Sound and KRATHOOM to Chapter 2. *What changes:* a save
   migration that takes levels away, and every Chapter 1 fight re-tuned.
2. **Respec.** *Default:* from Chapter 9, Bajonka refunds a branch at a save for an invoice: REARRANGEMENT, 1 @
   $5. *Alternative:* choices are permanent. *What changes:* whether a build is a commitment or a setlist.
3. **The Vanguard Badge.** *Default:* wearable, strong, beige, unremarked. *Alternative:* a key item only.
   *What changes:* whether the player can take Dad's deal a little.
4. **The currency's name.** *Default:* chops. *Alternative:* anything Lucky would actually say at rehearsal.
