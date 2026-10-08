# Vertical Slice Design — SNES Feel

Lens: Chrono Trigger / Earthbound / FF6-era presentation. Everything below is written against `docs/ARCHITECTURE.md` (256×224, 16×16 tiles, ASCII-generated sheets ≤16 colors, 8 px Press Start 2P, pulse×2 / triangle / noise synth, FF side-view battles, visible on-map encounters). Pixel coordinates are absolute screen coordinates unless stated otherwise; frame counts are at 60 fps.

## Pillars

1. **The comic's Toon Level is the presentation dial.** Every scene in the script carries a Toon Level 0–4. We map it directly to how much the engine is allowed to break: Toon 0 = plain windows, no camera effects; Toon 1 = emotes, 1 px shakes, portraits; Toon 2 = sound-effect words become physical sprites, the screen border bends; Toon 3 = the frame tears (slice offsets, 4 px shakes, flash); Toon 4 = the art ruptures (palette replaced, background becomes cosmic, HUD corrupts). A reader of the comic should feel the same escalation a player feels.
2. **Lucky's color is the HUD.** No numbers tell you how Lucky feels; the palette does. Pink calm, magenta rage, pale deflated, bruised purple humiliated. Done with palette-variant sheets, never runtime tint.
3. **Earthbound's deadpan in FF6's clothes.** Flat zine-style windows and contemporary Minneapolis, but side-view battles with a stepping-forward active character, popping damage digits and a victory sting. Count-ins start every battle.
4. **Everything is on the grid.** Integer positions, 8 px font, 10/12 px line heights, 4 px window borders, 16 px tiles. Shakes are whole pixels. No rotation, no sub-pixel tweens.
5. **The noise is the point.** The music is synthesized punk at 180–210 BPM, and the climax is a 7/8 doom passage that the player watches, not plays. The slice ends on silence and a dog with van keys.

## Scene-by-scene flow (brief)

| # | Scene (Toon) | Map / scene | Presentation beat |
|---|---|---|---|
| 1 | Pod bay (1) | `podbay` | Dad's intercom speaks in a **FF blue-gradient window**; the only interactable is the speaker. SQUELCH collapses the window. Giant red EJECT. |
| 2 | Freefall (3) | `FreefallScene` | Vertical shooter-style descent; paint the contrail over WORK IS LOVE billboards; slime sunglasses. |
| 3 | Alley (2) | `alley` | KRATHOOM crater, dumpsters knocked over by a physical CRASH sprite; Phoenix pushes up glasses. Tutorial battle vs Retrieval Drone. Phoenix joins. |
| 4 | Apartment (2) | `apartment` | Cosmic amp signal: screen border bends outward (slice-wave), billboard glitch montage north to Ryan's garage. "End Part 1." |
| 5 | Streets hub (1) | `west_bank` | Visible encounters (Interns, Noise Complaints), pawnshop, coffee shop door, City Sound door (locked until Brian). |
| 6 | Coffee shop (0–1) | `coffee_shop` | Brian: Zappa shirt, pedalboard on a table, "alienate the market." Joins (second). |
| 7 | Brian calls Ryan (1) | `garage` cutscene | Phone rings in the frozen garage; sticks still hovering; "Yep." |
| 8 | City Sound (0→3) | `citysound_hall`, `room4` | Bajonka + clipboard outside Room 4; AUDITION boss; contract on the snare; Ryan joins; Bajonka attaches as save point. |
| 9 | One month later (0→2) | `room4` | Duct-taped caption card; KRAAANG spills the coffee; pedalboard sparks; "are you calling my house crooked?!"; Brian quits; flyer. |
| 10 | Palmer's (1→4) | `palmers_ext`, `palmers_int` | Six-inch stage, undercover cop; THE SET boss with Pocket gauge; THE ETERNITY; roof peels. |
| 11 | Rubble (1) | `palmers_rubble` | Plaster dust palette; Ryan quits; Lucky locks magenta; Bajonka with keys; NEXT: THE POTATO BELT (DRUMMER WANTED). |

Target 45–75 minutes; ~12 battles including three set pieces.

## Maps (brief)

| Map | Size (tiles) | Tileset | Music | Notes |
|---|---|---|---|---|
| `podbay` | 12×9 | `vanguard` | `dental_plan` | One pod, one speaker, one button. Stars scroll in the window tiles (2-frame animated tile). |
| `alley` | 20×14 | `minneapolis` | `pothole` | Crash trigger at the center; glowing pothole tile persists after. Exit west to streets. |
| `apartment` | 14×10 | `interiors` | `unpaid_bills` | Posters, bill piles (solid), bass amp (script). Signal cutscene runs here. |
| `west_bank` | 40×28 | `minneapolis` | `west_bank` | Hub: snowbanks channel the player; 3 roaming encounters; pawnshop, coffee shop, City Sound, Palmer's (locked until flyer). WORK IS LOVE billboard over the skyline (over layer). |
| `coffee_shop` | 16×11 | `interiors` | `normal_music` | Brian at a window table; barista sells Gas Station Coffee. |
| `garage` | 12×8 | `pines` | `northern_garage` | Cutscene only (signal and Brian's call). Dark palette, one lamp. |
| `citysound_hall` | 24×7 | `interiors` | `sticker_hallway` | Four doors; Bajonka outside Room 4. |
| `room4` | 12×9 | `interiors` | `four_dollars` / `normal_music` | Drum kit object 32×32 at the back; mic stand; coffee on the pedalboard table in the Brian version. |
| `palmers_ext` | 20×12 | `minneapolis` | `six_inch_stage` (muffled: pulse2 muted) | Neon sign 2-frame cycle; line of punks. |
| `palmers_int` | 20×14 | `interiors` | `six_inch_stage` | Stage 1 tile tall; crowd NPCs headbang on beat; cop at the back. |
| `palmers_rubble` | 20×14 | `interiors` + `rubble` variant | none → `plaster_dust` | Same layout; `over` layer replaced with `sky_hole` tiles showing the night sky. |

## Exploration & interaction

Grid-locked 4-direction stepping, walk 7 tiles/s, run 11 tiles/s (hold run). Sprites 16×24, origin at the feet, y-sorted. Interact with `confirm` while facing an entity. Emote bubbles (8×8 from the UI sheet) pop 4 px above the head with a 3-frame "boing" (scale is forbidden, so: frame 1 at y−2, frame 2 at y−5, frame 3 at y−4).

Visible encounters: enemies wander or chase; touching starts the count-in. Enemies the player has beaten stay gone (`setOnWin` flag). The streets hub has exactly three roaming groups so the hub never feels like a grind.

Lucky's overworld palette variant follows story flags, not HP: `lucky` (default), `lucky_rage` from Brian's quit until the flyer, `lucky_rage` again after Ryan quits, `lucky_deflated` for the walk out of the rubble choice if the player picks "plead." Phoenix's `phoenix_melt` sheet is used in Room 4 when idle for more than 3 s (relaxed = puddle), snapping back to humanoid on movement with the `slime_pop` SFX.

Lucky can **slap** objects (a context action, same `confirm`): the intercom speaker, Brian's pedalboard (after the coffee), the EJECT button. Slapping plays `squelch` and a 1 px shake.

## Battle system (presentation focus)

FF4/6 side view: enemies left, party right, two windows on the bottom. Turn-based with a turn-order list computed from speed; no ATB. The active character steps 8 px left over 4 frames (FF style) and the cursor hand appears at their status row.

**Count-in.** Every battle begins with the transition (below) and then a count-in: digits 1-2-3-4 (16×16 digit sprites from the UI sheet) slam onto the screen center at 180 BPM with `count_click` on each; the song starts on the downbeat after "4". For Ryan's battles the count is Lucky's voice line "One, two, three, four!" in a dialogue box with `{speed:instant}` and the same clicks.

**Commands:** STRUM (attack), RIFF (AMP-cost specials), TUNE (defend + 2 AMP), ITEM, BAIL. Lucky's riffs: Power Chord (single, big), Feedback (all, low, 2-turn Deaf status), Scream Terms (later). Phoenix: Trash Bag Swing (physical), Low End (party defense up), My Brain Thinks (reveal enemy HP and weakness — the Libra). Brian: Sterile Chord (always exactly the listed damage, never crits), Normal Music (puts enemies to sleep, hurts the party's Pocket).

**Lucky's mood in battle** is a palette variant swap driven by events: taking a hit → `lucky_battle_rage` for one round; HP < 30% → `lucky_battle_deflated`; KO → `lucky_battle_bruised`; landing a crit → `lucky_battle` pink flare with the `g` glow swapped to white for 6 frames. The tutorial drone fight teaches this: Phoenix's portrait says "Your color's doing a thing."

**Pocket gauge** (band battles only — AUDITION and THE SET): a beat lamp inside the status window's inner border pulses on the song's beat (lit 8 frames of every beat). Confirming a command while the lamp is lit adds +1 Pocket (max 16). The gauge is purely a scripted-event driver and crit multiplier (+5% crit per segment); it is not a rhythm game. Scripted hooks fire at 4/8/12/16.

**Damage digits:** 8 px font, white; rise 10 px over 10 frames, fall 4 px over 4, hold 20, vanish. Crits are yellow, 2 px shake on the target, `crit` SFX. Heals green. "MISS" slides 6 px right.

**Enemy hit flash:** `setTint(0xffffff).setTintMode(FILL)` for 4 frames, then 2 frames of 2 px horizontal jitter. Enemy KO: 8-frame horizontal slice dissolve (the sprite's RenderTexture split into 4 strips sliding alternately off) with `ko`. Party KO: the 32×32 `ko` frame (Lucky: a puddle).

**AUDITION (Room 4, Toon 3).** Survive 8 rounds. Ryan is an ally hazard drawn at the kit (48×48 `ryan_possessed`), uncontrollable; each round his slime-arm "cymbal strike" hits a random target including the party (`hurt`). Enemies are the sound-effect walls WHRNNNG (48×48, pink) and THUD-THUD (48×48, green) that block the back of the room; they regenerate, the goal is to survive, not kill. Ryan's square captions are the clock: round 2 [Well. I guess my arms belong to the goo now.], round 5 [Tempo's good, though. Very steady.], round 7 [Ride cymbal sounds a bit tinny. Should probably buy a new one if I survive this.]. Round 8 ends on the halt: music cuts, `cymbal` rings 2 s, slime drips (6-frame drip particles from the top of the screen at 3 random x per second for 3 s).

**THE SET AT PALMER'S (Toon 3→4).** Enemies: Undercover Cop (32×32) + Officer Khaki ×2 (32×32), plus a CROWD gauge replacing the enemy-name window (hostility 0–100; cop actions raise it, riffs lower it; at 100 the crowd leaves and the battle is lost). Pocket hooks: 4 → first power chord blows the front row's hair back (crowd NPC strip animates, `mohawk_pop`, cop's `mohawk_off` frame, [No obnoxious guitar solos. Just pure, unadulterated rhythm. The slime is pulsating in 7/8 time. I can work with this.]); 8 → gutters fill with static (the window borders get a 1 px noise shimmer); 12 → [I've been fighting the possession. That was a mistake.], `ryan_possessed` palette darkens to `ryan_bruised`; 16 → [I am not trapped in the goo. The goo is trapped in the pocket.] and THE ETERNITY (below). Unstoppable scripted win.

### THE ETERNITY — frame by frame

Frame 0 is the moment the 16th Pocket segment fills. Song `pocket` is playing (7/8, 182 BPM; one beat ≈ 20 frames).

| Frames | Camera / screen | Sprites & BG | HUD | Audio |
|---|---|---|---|---|
| 0–19 | Hold. | Beat lamp stays lit. | Pocket gauge segments flash white in sequence 0→15 (1 per frame), then all. | `pocket` continues. |
| 20–59 | Ryan's caption: [I am not trapped in the goo. The goo is trapped in the pocket.] appears instantly. | Everything else freezes mid-frame (anims paused). | Command window closes (4-frame vertical collapse). | Music drops to triangle + kick only (pulse channels muted via volume 0). |
| 60–119 | Pan the camera 96 px left and 16 px up over 60 frames (ease: 4 integer steps per frame then 1) so the kit lands at screen center (128, 96). | `ryan_possessed` → `ryan_bruised` already; slime drip particles reverse direction (rise). | Status window slides down off-screen (56 px over 20 frames). | Kick doubles (every eighth). |
| 120–179 | Flash white 6 frames at 120. 2 px shake 120–179. | Swap kit sprite to `ryan_eternity` (64×64) frame 0; background swaps from `palmers_neon` to `black_hole` (concentric rings, palette cycle inward, 12 fps). | Pocket window text replaced by "RHYTHM" (window remains). | Music hard-cuts to `rhythm_achieved` (7/8, 60 BPM doom); first hit is the lowest triangle note with a 400 ms pitch fall. |
| 180–299 | 4 px shake on every doom downbeat (frames 180, 240) for 8 frames each. | `ryan_eternity` loops 6 frames at 8 fps; every downbeat spawns an SFX word sprite — DOOM (48×16), CRACK (48×16), THUD (40×16) — at a random point on a 48 px ring around Ryan, which drifts 1 px/frame toward him (gravity) and stays. | Window borders switch to the Toon-4 palette (white → #a050c0). | Noise channel open hat on every beat; pulse1 a detuned drone (two voices 8 cents apart) on the root. |
| 300–359 | Caption at top-left: [Rhythm achieved.] | Party sprites (Lucky, Phoenix) get the `plaster` palette variant (white dusting). | — | Beat 3 of the doom riff. |
| 360 | Hand-off to Structural Integrity. | | | |

The player has no input from frame 20 to the end of the destruction. `confirm` is ignored, not buffered.

### Palmer's destruction — frame by frame

| Frames | What happens |
|---|---|
| 360–419 | The word THUD (the heaviest one, drawn 2 px thicker) breaks from the ring and swings up: 8 frames rising 48 px at 6 px/frame. On frame 368 it hits the ceiling line (y = 24): white flash 4 frames, 4 px shake 12 frames, `crash`. The `over` layer tiles along the ceiling row swap to `ceiling_cracked` in a 3-frame ripple outward from the impact column (1 tile column per frame). |
| 420–539 | **Roof peels like a sardine can.** The interior map's top four tile rows are snapshotted into a RenderTexture, cut into 16 px-wide vertical strips; starting from the right edge, each strip curls: it translates up 2 px/frame and alternates its texture frame between the normal strip and a 2-row "underside" strip (gray drywall back) every 4 frames, one strip starting every 6 frames so the peel travels right-to-left across 20 strips in 120 frames. `roof_peel` SFX (a long rising noise + triangle slide) plays once; stars become visible in the revealed rows (the `sky_hole` tiles are drawn beneath). |
| 540–599 | **Walls blow outward.** Left and right wall tile columns slide 8 px per 4 frames off-screen; brick chunk sprites (8×8, 12 of them) fly on integer parabolas (vx ±3, vy −4, gravity +1 every 4 frames). `wall_blow`. 4 px shake throughout. The camera does not follow anything; it holds. |
| 600–719 | **The crowd scatters.** Every crowd NPC runs to the nearest map edge at run speed with a `!` emote. The Undercover Cop runs last, holding the `mohawk` prop frame, with a 1-line box that does not pause the action: "Dispatch — DISPATCH —". |
| 720–779 | **The cymbal crash.** All sprites freeze. `cymbal` at full volume with 2 s decay. 6 px shake for 8 frames, then 4, then 2, then 1 (frames 720–751). The shake is the last thing that moves. |
| 780–899 | Silence. 2 seconds of nothing moving. Fade to black over 60 frames beginning at 840. |
| 900 | Fade in on `palmers_rubble` (plaster palette, sky visible). `plaster_dust` begins at frame 960 (one second of silence after fade-in). |

## Party & progression (brief)

Lucky (laser guitar; HP/AMP; the only character who can crit above 10%), Phoenix (bass; slow, heavy, support; the Libra), Brian (guitar; joins second; high accuracy, zero crit; leaves with the Fried Pedalboard key item), Ryan (drums; an ally the player never controls; `ryan_possessed` at the kit; leaves after Palmer's). Levels 1→6 across the slice; XP from on-map battles only; set pieces give fixed story rewards. AMP regenerates 2/turn via TUNE and fully at Bajonka. The meter (`state.meter`) resets per battle.

## Enemies & bosses (visual design)

| Enemy | Size | Palette (≤16) | Design | Anims (frames) |
|---|---|---|---|---|
| Vanguard Retrieval Drone | 32×32 | beige `#d8c8a8`, corporate blue `#2a3fa0`, chrome `#e8e8f0`, red LED `#ff2040`, outline | A beige egg with a tie decal and a claw. Hovers, bobs 1 px. | idle 2, attack 2, hurt 1, death 2 |
| Vanguard Intern | 32×32 | khaki `#c8b890`, lanyard blue, skin ×2, white shirt | Lanyard, clipboard, dead eyes. Always in pairs. | idle 2, attack 2, hurt 1, ko 1 |
| Noise Complaint | 32×32 | white `#f4f4f4`, red `#d02020`, gray | A floating city form with an angry stamp face; its attack is a paper cut. | idle 2 (flutter), attack 2, hurt 1, ko 1 |
| Hall Monitor Drone | 32×32 | variant of Drone: beige→gray, LED→green | City Sound's door-camera gone rogue. No new sheet. | (variant) |
| WHRNNNG wall | 48×48 | hot pink `#ff5fd2`, white core, pink shadow `#b02e8a` | Jagged sound-effect letters stacked as a wall; vibrates 1 px. Regenerates. | idle 2, attack 2, hurt 1 |
| THUD-THUD wall | 48×48 | green `#39ff8a`, dark green `#1a8a4a`, white | Heavy square letters; stomps. | idle 2, attack 2, hurt 1 |
| Possessed Ryan (ally hazard) | 48×48 | flannel red `#b02828`, black, skin, slime green, white eyes | Ryan at the kit, arms blurred into a 6-arm smear with speed lines; later `ryan_bruised` variant (green→purple `#7a3aa8`). | idle 2, drum 4, smear 4, hurt 1 |
| Undercover Cop | 32×32 (battle), 16×24 (map) | leather black, price-tag white, mohawk green `#39ff8a` (glued), skin, badge gold | Pristine jacket, tag dangling, mohawk one shade too neon. Talks into his collar. | idle 2, attack 2 (collar), hurt 1, mohawk_off 1, flee 1 |
| Officer Khaki ×2 | 32×32 | khaki, windbreaker navy, skin | Backup in a "POLICE" windbreaker and khakis at a punk show. | idle 2, attack 2, hurt 1, ko 1 |
| THE ETERNITY | 64×64 | `#0a0612`, `#1a0a2a`, `#3a1050`, `#6a2a8a`, `#a050c0`, `#e0b0ff`, white | Ryan dissolved into a swirl around a white core; the 6-frame loop rotates the swirl; the palette cycles inward by one index every 5 frames so it looks like it is falling into itself. Drumsticks remain, white, perfectly still at the center. | loop 6 |
| SFX words DOOM / CRACK / THUD | 48×16, 48×16, 40×16 | black-purple with white rim | Heavy letters with a 1 px white rim and a 2 px purple drop shadow; they have gravity. | idle 1, swing 2 |

Bosses: **AUDITION** (survive 8 rounds; hazards + Possessed Ryan), **THE SET AT PALMER'S** (Cop + Khakis + CROWD gauge; the Eternity as finisher).

## Items, equipment, shops (brief)

Start: $4 and the Half-Ounce (key item; Phoenix refuses to sell it). Consumables: Pizza Slice (HP 30), Gas Station Coffee (AMP 10), Hand Warmer (cures Frozen), Earplugs (cures Deaf), Jumbo Slice (HP 80, pawnshop). Equipment: instruments are fixed per character (Laser Guitar, Beat-up Bass, Brian's Pristine Guitar); accessories: Political Stickers (+crit; Brian's "alienate the market" line triggers if equipped), Hoodie (+def), Flannel (Ryan only, locked). Key items: Half-Ounce, Band Agreement (after the audition), Fried Pedalboard (after Brian quits), Crumpled Flyer, Van Keys (stinger). Shops: Cedar Pawn (items, buys nothing the band owns), coffee shop (coffee only; Brian's pedalboard is "not for sale" with a 3-line rant).

## UI & presentation

### Window style: Earthbound flat, zine edition (and one FF window)

Chosen: **flat windows**, not FF's blue gradient. Reasons: (1) the game is contemporary and deadpan; flat black with a white rule reads as a photocopied flyer, which is the band's whole visual culture; (2) the inner rule carries Lucky's mood color, which is pillar 2; (3) a flat 9-slice sits cleanly over animated battle backgrounds, while a gradient fights them.

Frame (4 px, 9-slice from the `ui` atlas, 4×4 corner/edge pieces), outside → in: 1 px `#141018`, 2 px `#f4f4f4`, 1 px **mood color** (pink `#ff5fd2` default; magenta `#ff1aa0` when Lucky is raging; `#a050c0` during Toon 4), then fill `#10101c`. Corner pixel clipped (1 px chamfer) for the Earthbound rounding at this scale. Text `#f4f4f4`, disabled `#787890`, highlight `#ffe066`.

**The one FF window.** Dad's intercom (and every Vanguard voice later) uses the FF blue gradient: vertical gradient in four 14 px bands `#0028a0 → #001c78 → #001050 → #000838`, 2 px white double border with a 1 px black gap, square corners, name tag "VANGUARD INTERCOM". The joke: the empire's voice is the default RPG window. When Lucky slaps the speaker, the gradient window collapses vertically (56 → 0 px in 4 frames, `squelch`) mid-sentence — the text is cut off with the page still half-typed.

**Ryan's caption window** (`who: 'ryan_caption'`): inverted. Fill `#f4f4f4`, 1 px `#141018` border, 1 px gap, 1 px `#141018` second rule; square corners; text `#141018`; no portrait, no tag; fixed at x 8..136, y 28..52 (2 lines); text appears **instantly** (no typewriter) with one soft `caption_tick`. It is the only window with no typewriter, so it reads as the calmest voice in the loudest room.

**Bajonka's windows** (save, contract, flyer): the flat window with a clipboard clip sprite (16×8) on top edge center and the inner rule in tan `#e8c890`.

### Text

Typewriter 1 char / 30 ms (fast 15, slow 50, settings in `smfos.settings`). `text_blip` on every second printable char, pitched per speaker: Lucky C6, Phoenix G5, Brian E5 (50% duty, "normal"), Dad A3 (12.5% duty buzz), narrator silent, Ryan's captions silent. Punctuation pauses: comma 80 ms, period/!/? 180 ms, ellipsis 300 ms. `confirm` finishes the page, then advances; a 8×8 bouncing triangle at (238, 206) marks "more". Markup per §5.1: `{shake}` jitters each glyph ±1 px every 4 frames (used for KRAAANG and Brian's rant); `{color:pink}` uses the mood palette.

Dialogue box: x 8..248, y 160..216; 3 lines at 12 px (y 168, 180, 192); 28 chars; with portrait (32×32 at x 12..44, y 164..196) text starts at x 52 → 24 chars. Name tag: small window at x 8, y 148..160, width = chars×8 + 8. Choices: a window under the tag side at x 8, y 160 − 12·n − 8, cursor hand at x 12.

### Title screen

Black field. Starfield: 40 single-pixel stars in three depths (`#404058`, `#8080a0`, `#f4f4f4`) scrolling down at 1 px per 4/2/1 frames (accumulator, integer draw). Minneapolis skyline silhouette from the `minneapolis` tileset along y 176..224, with the WORK IS LOVE billboard at x 160..224, y 168..184 running its 2-frame glitch every 6 s.

Sequence: frame 0 black; 30 → stars; 60 → "SLIME MONSTERS" (custom 16 px letters from the `ui` atlas, 14 glyphs × 16 = 224 px, at x 16, y 40..56) drops from y −16 to y 40 in 8 frames and lands with a 2 px shake and `kraaang`; 90 → "FROM OUTER SPACE" (8 px font, letter-spaced to 1 char per 12 px) at y 72, typed in; 150 → a pink-and-green contrail streak arcs from (256, 0) to (40, 176) over 40 frames leaving a 2 px trail that palette-cycles pink→green→dark over 90 frames; 190 → "PRESS Z" blinking (30 on / 30 off) at y 150; on press → menu NEW GAME / CONTINUE at x 96, y 150 / 162 with the hand cursor at x 84. CONTINUE is disabled (gray) with no save. Idle 20 s → attract: the freefall scene plays with no input, returns to title. Music: `contrail`.

### Pause menu (MenuScene)

Left window x 8..160, y 8..216: four party rows, 48 px each (y 16 + 48i): portrait at (16, 16 + 48i), name at (56, 18 + 48i), "LV 3" at (56, 30 + 48i), "HP 54/54" at (56, 42 + 48i) and a 64×4 HP bar at (112, 44 + 48i) in the mood color, "AMP 12" at (56, 54 + 48i). Right top window x 160..248, y 8..84: ITEMS / RIFFS / EQUIP / STATUS / SAVE at y 16 + 12i, cursor hand x 168. Right bottom window x 160..248, y 84..216: "$4" (y 92), "TIME 00:42" (y 104), location (y 116, wraps), "MOOD" + an 8×8 swatch of Lucky's current palette (y 140), "NEXT GIG:" + the flyer text once held (y 160). Submenus open as a full-width window over the left column. Opening: `confirm`; the menu slides in from the right 32 px over 6 frames; `cursor` SFX on move, `cancel` on back.

### Battle HUD (256×224)

```
y   0 ┌──────────────────────────────────────────────┐
      │ [enemy name  x8..136 y8..24]   [POCKET x152..248 y8..24]
y  28 │ [Ryan caption x8..136 y28..52, only in band fights]
      │   enemy zone x 8..144, feet line y=144         party column
      │   32px: centers (48,128),(96,128)              slot0 x196..228 y 40..72
      │   48px: center (64,120)                        slot1 x192..224 y 68..100
      │   64px boss: center (72,112)                   slot2 x188..220 y 96..128
      │   kit (band fights) x204..252 y96..144         slot3 x184..216 y124..156
y 160 ├────────────────────┬─────────────────────────┤
      │ COMMAND x8..96     │ STATUS x96..248          │
      │ STRUM   y166       │ NAME   HP      AMP  (rows y166,178,190,202)
      │ RIFF    y176       │ LUCKY   54/54   12      │
      │ TUNE    y186       │ PHOENIX 61/61    8      │
      │ ITEM    y196       │ name x104, HP right-aligned at x200, AMP at x240
      │ BAIL    y206       │ beat lamp: 4×4 at (242,164) in band fights
y 216 └────────────────────┴─────────────────────────┘
```

Command window line height 10, status window 12. Targeting: the hand cursor (8×8, pointing left) sits 4 px left of the enemy; the enemy-name window appears for the duration. Riff submenu opens as a window x 8..160, y 100..160 over the field, 2 columns, AMP cost right-aligned. Enemy KO'd slots in the status window gray out. In band fights the party column shifts 32 px left (slot0 at x 164) to make room for the kit; the Pocket window replaces the enemy-name window's row.

Battle background runs full-screen behind everything; the two bottom windows cover y 160..216, leaving an 8 px strip of background below them (y 216..224), which is deliberate — Earthbound's backgrounds bleed under the HUD.

### Transitions

- **Battle entry — static burst.** Snapshot the Explore camera into a RenderTexture (`draw` + `render`). Cut into 28 horizontal strips of 8 px. Over 20 frames, even strips slide right and odd strips slide left at 2, 4, 8, 12 px/frame (accelerating), while `static_burst` plays and the strips flicker between the snapshot and a noise texture every 2 frames. Frame 20–25 black. Frame 26 the battle scene is already scrolling its background; windows slide up from y 224 to y 160 over 6 frames; count-in begins. With `?fast=1` the whole thing is 8 frames.
- **Battle exit (win).** Victory sting; rewards window; fade out 20 frames; Explore fades in 20.
- **Fade** black 400 ms (24 frames); **flash** white 150 ms (9 frames), used for hits in cutscenes and the Eternity.
- **Shake**: whole pixels only. Light 1 px (emotes, slaps), medium 2 px (KRAAANG), heavy 4 px (first snare hit, doom downbeats), max 6 px (the final cymbal). Pattern alternates +x, −x, +y, −y per frame.
- **Mosaic**: pixelate filter (`enableFilters(); filters.internal.addPixelate()`) stepping 1→2→4→8→16 over 10 frames then back, used entering the signal montage and the garage cutscene; fallback is a fade when WebGL is unavailable.
- **Panel tear (Toon 3).** On the audition's first snare hit: snapshot, split into top and bottom halves at y 112, offset top +6 px / bottom −6 px horizontally with a 2 px black gap for 6 frames, then snap back with a 4 px shake. Also used when Brian slams the door (2 px tear, 3 frames).
- **Screen border bend (Toon 2).** The amp signal: 28 TileSprite strips (256×8) sharing the frozen snapshot, each with `tilePositionX = round(6 · sin(t/8 + y/16))` for 60 frames, amplitude ramping 0→6→0. Reads as the panel border bulging.
- **Caption cards.** `ui.caption` over black, 8 px white, 1.5 s. The "ONE MONTH LATER" card is the variant: a white 160×24 card at (30, 92) (deliberately off-center) with two 16×8 gray tape sprites over its corners, slapped on with a `thud` and 1 px shake; text `#141018`.
- **Freefall.** See below.

### Freefall sequence (FreefallScene)

Vertical descent, 90 seconds max, skippable after the first 10 s. The camera looks down: a `sky` TileSprite scrolls up at 2 px/frame with a purple→orange twilight gradient done as 8 banded color rows that drift down 1 px / 30 frames (palette cycling the band indices). Lucky's `lucky_fall` sprite (24×16 — flattened, sunglasses) sits at y 48 and steers left/right at 1 px/frame (acceleration 1 px every 3 frames, max 3). The contrail is a RenderTexture: every frame Lucky stamps a 4×4 pink dot, then a green dot 8 px later, so the trail is a pink-green ribbon that scrolls with the sky. WORK IS LOVE billboards (64×24) scroll up at the sky speed; passing over one paints it (its texture swaps to the glitch frame and stays). Painting all 5 awards the "Flying Squirrel" title in the status menu; painting none still works. The skyline rises from the bottom over the last 10 s; the final frame is the alley rooftops at full scale, then the static burst into `alley` where the crash cutscene plays (24-frame white flash, 6 px shake, `crash`, the CRASH sprite (64×24) drops and knocks the dumpster tiles over by swapping them to `dumpster_down`).

### Palette discipline

A console palette of 56 colors lives in `tools/palette.txt`; every sheet picks ≤16 from it. Outlines are always `#141018`. Core swatches:

| Group | Colors |
|---|---|
| Lucky pink (calm) | `#ff5fd2` base, `#ff9ae6` light, `#b02e8a` shadow, `#39ff8a` glow |
| Lucky rage | `#ff1aa0`, `#ff66c8`, `#8a0a5a`, glow `#c8ff3c` |
| Lucky deflated | `#ffb8e8`, `#ffe0f4`, `#c880b0`, glow `#b8ffd6` |
| Lucky bruised | `#8a4fc8`, `#b080e0`, `#4a2070`, glow `#6a2a8a` |
| Phoenix gray | `#8c8ca0`, `#b8b8cc`, `#585870`, hoodie `#3a3a4a`, glasses `#f4f4f4` |
| Ryan | flannel `#b02828` / `#141018`, skin `#e8b890`, slimed `#8bff9a`, bruised `#7a3aa8` |
| Snow night | `#c8d8f0`, `#8ea0c8`, `#505878`, sky `#2a1a4a`, `#7a3a6a`, `#e07040` (twilight) |
| Neon | `#ff5fd2`, `#39ff8a`, `#40c0ff`, `#ffe066` |
| Vanguard | beige `#d8c8a8`, blue `#2a3fa0`, chrome `#e8e8f0` |

Mood swaps are `variant:` lines in the Lucky sheets (`lucky_rage from: lucky swap: p=#ff1aa0,P=#ff66c8,…`), so a mood is a sheet name, never a tint. The plaster-dust variant of every party/crowd sheet (`_plaster`, all mid-tones → `#d8d8e0`) is generated the same way.

### Battle backgrounds (Earthbound-style)

Each background is a 64×64 or 128×128 pattern generated at boot into a CanvasTexture, baked into 8 phase frames (palette-cycled or offset), then displayed as a TileSprite (or 28 strip TileSprites when a wave is needed) animating at 8–15 fps. No per-frame pixel writes.

| Background | Pattern | Motion | Used by |
|---|---|---|---|
| `street_snow` | diagonal hatch of 4 blues | TileSprite scroll (1, 1) px/frame; cycle the 4 blues every 8 frames | streets, alley |
| `apartment_posters` | poster-collage tile | strip wave, amplitude 3, period 64 px, 0.5 Hz | apartment, tutorial follow-ups |
| `sticker_wall` | overlapping sticker shapes, two layers | layer A scrolls right 1 px/frame; layer B (dots) scrolls up-left, 50% alpha | City Sound, AUDITION |
| `palmers_neon` | beer-sign script shapes on black | palette cycles 6 neon hues at 8 fps; wave amplitude = Pocket/4 px | THE SET |
| `black_hole` | concentric rings, 8 purples | cycle inward 1 index / 5 frames; no scroll | THE ETERNITY |
| `vanguard_grid` | beige grid with tie decals | slow scroll down 1 px / 2 frames | drones, interns |

## Audio

Four channels: pulse1, pulse2, triangle, noise. Punk cues keep pulse1 on the riff (50% duty, slight detune on power chords via `~`), pulse2 on the vocal line (25%), triangle on bass, noise on kit (`k s h o`). The song format is §7; 7/8 cues use `beatsPerBar: 7, stepsPerBeat: 2`.

### Cue list

| id | Scene | BPM / sig | Mood | Instrumentation notes |
|---|---|---|---|---|
| `contrail` | Title | 184, 4/4 | anthemic punk | pulse1 power-chord riff I–bVII–IV, pulse2 lead octave up on the chorus, tri root eighths, noise k-s with open hat on the 4-and. |
| `dental_plan` | Pod bay | 100, 4/4 | corporate muzak | 12.5% duty pulses in parallel sixths, tri walking bass, noise brush hats only; cuts dead on SQUELCH. |
| `flying_squirrel` | Freefall | 200, 4/4 | soaring | pulse arpeggios (Cmaj7→Am9) 16ths, pulse2 long slides `C5~`, tri pedal, **no noise** until the crash. |
| `pothole` | Alley | 92, 6/8 | lo-fi, tired | tri bass only + pulse2 sparse 2-note motif every 4 bars; noise = wind (open hat at volume 0.08 every beat). |
| `unpaid_bills` | Apartment | 120, 4/4 | lo-fi beat | pulse1 muted staccato chords (25%), tri boom-bap, noise k . s . ; melody enters when Lucky picks up the amp. |
| `ask_the_universe` | Signal montage | 150, 3/4 | building drone | pulse1+pulse2 unison root, detune widening each bar via `~`, tri rises an octave over 8 bars, noise crescendo; hard cut to `northern_garage`. |
| `northern_garage` | Garage | 60, 4/4 | frozen | noise closed hat every beat at 0.1, one triangle note every 2 bars. Nothing else. |
| `west_bank` | Streets hub | 170, 4/4 | skate-punk | the slice's main loop; two-bar riff, chorus every 8 bars, tri octave jumps. |
| `normal_music` | Coffee shop, Brian rehearsal | 128, 4/4 | sterile rock | 50% duty, I–V–vi–IV, perfectly quantized, no accents; snare on 2 and 4, nothing else. The joke is that it is correct. |
| `sticker_hallway` | City Sound hall | 160, 4/4 | muffled punk | `west_bank` with pulse1 at 0.15 and a low-pass feel (tri carries the riff), as if through a soundproof door. |
| `four_dollars` | Room 4, AUDITION | 196, 4/4 | blistering | the fastest cue; pulse1 downstrokes 8ths, pulse2 screamed line (fast `!` accents), tri 8ths, noise kick every 8th with snare 2/4 and fills every 4 bars (`s s s s` 16ths). |
| `battle_noise` | Generic battles | 190, 4/4 | fight | 2-bar riff, half-time chorus; `win_sting` on victory. |
| `win_sting` | Victory | 180 | 2 s | pulse chord stab ×3 ascending + cymbal. |
| `six_inch_stage` | Palmer's exterior/interior | 140, 4/4 | jukebox | a different band on the house system: pulse2 melody, muted on the exterior (pulse2 volume 0). |
| `pocket` | THE SET | 182, 7/8 | locked-in | 7/8 riff (3+2+2): pulse1 `E3! . E3 . G3! . A3` style, tri doubles, noise k on 1 and 4, s on 6; every 4 bars a fill. Pulse2 enters at Pocket 8. |
| `rhythm_achieved` | THE ETERNITY | 60, 7/8 | doom | half-time: tri on the lowest notes (`E2`, `D2`, `C2` with `~` falls), pulse1 detuned drone pair, pulse2 silent, noise open hat every beat, kick on 1 with a 100 ms noise swell. Every downbeat is a camera shake. |
| `plaster_dust` | Rubble, aftermath | 70, 4/4 | hollow | triangle alone, the `pocket` riff at a quarter speed, no drums. The quit happens over it; it stops when Ryan says "I quit." and does not resume. |
| `game_over` | Game over | 100, 4/4 | — | `dental_plan` reprise: Dad wins. |
| `bajonka` | Save | 120 | 1 s | sneeze SFX then a two-note tri "boop-boop". |

Tempo and time signature are visible in the HUD beat lamp, so the player feels 4/4 vs 7/8 without being told.

### SFX list (synthesis notes)

| name | Recipe |
|---|---|
| `cursor` | pulse 25%, C6, 20 ms, instant decay |
| `confirm` | pulse 25%, C6→G6, 2×30 ms |
| `cancel` | pulse 25%, G5→C5, 2×30 ms |
| `text_blip` | pulse 12.5%, speaker pitch, 15 ms |
| `caption_tick` | triangle, C5, 10 ms, volume 0.2 |
| `hit` | noise 60 ms + pulse 50% sweep E4→E3 over 80 ms |
| `crit` | `hit` + pulse2 stab A5 40 ms + 4 px shake |
| `miss` | pulse 12.5% slide C5→C4, 100 ms |
| `squelch` | triangle slide G3→C2 over 200 ms + noise 80 ms, volume 0.6 |
| `slime_pop` | pulse 50% up-sweep C4→C6 in 40 ms, ×3 staggered 60 ms (pop-pop-pop) |
| `kraaang` | two pulses 50% a quarter-tone apart, E3, 600 ms with ±15 cent vibrato at 6 Hz, decay to 0 |
| `level_up` | pulse arpeggio C-E-G-C 4×50 ms + tri root |
| `item` | pulse 25% E5-G5, 2×40 ms |
| `door` | noise 30 ms + tri thump C3 |
| `door_slam` | noise 120 ms at 0.8 + tri C2 100 ms + 2 px shake |
| `sneeze` | noise 40 ms rise + tri "chiff" G5→C4 60 ms |
| `feedback` | pulse 50% A4 rising to A5 over 1.2 s with 5 Hz vibrato, sustain until stopped |
| `drum_hit` | noise 50 ms + tri D2 30 ms |
| `cymbal` | noise 2000 ms exponential decay, volume 0.9 |
| `count_click` | noise 10 ms at 0.5 (stick click) |
| `ko` | pulse 12.5% descending chromatic 8 notes × 30 ms |
| `flee` | noise ramp 300 ms (running) |
| `save` | `sneeze` → tri boop-boop |
| `eject` | pulse 50% buzz A2 200 ms, then noise 500 ms swell (pod fires) |
| `static_burst` | white noise 350 ms, volume gated on/off every 2 frames |
| `crash` | noise 400 ms at 1.0 + tri C1 300 ms, 6 px shake |
| `pedal_stomp` | tri thump + pulse click, 30 ms |
| `coffee_spill` | noise low-volume 400 ms "pour" |
| `sparks` | pulse 12.5% random notes C7–C8, 8 × 20 ms |
| `roof_peel` | noise 2000 ms rising volume + tri slide C3→C5 |
| `wall_blow` | `crash` + `sparks` |
| `mohawk_pop` | pulse 50% C5→G5 30 ms (a cork) |
| `intercom_buzz` | pulse 12.5% A3 continuous at 0.1 while Dad talks |
| `glitch` | noise 3 × 20 ms + pulse random pitch (billboard) |
| `thud` | tri C2 60 ms + noise 20 ms (caption card lands) |

## Controls & save

| Action | Keys |
|---|---|
| Move | Arrows / WASD |
| Confirm / interact / slap | Z, Enter, Space |
| Cancel / back | X, Backspace |
| Menu | Esc, C |
| Run (hold) | Shift |
| Mute | M |

Gamepad: D-pad / left stick, A confirm, B cancel, Start menu, X run (via `Input.js`). Text speed and volumes live in the pause menu's STATUS → OPTIONS and in `smfos.settings`.

Saving is Bajonka. She is a `save` entity from City Sound on (and sits outside Palmer's and in the rubble). Interact → `sneeze` → a clipboard window with three slots, each showing chapter, location, playtime, Lucky's level and the party's 32×32 portraits in a row; an empty slot reads "— unsigned —". Continue on the title loads the most recent slot. No autosave; the slice has five Bajonka points (City Sound hall, Room 4 after the audition, Room 4 one month later, Palmer's exterior, the rubble), so a death costs at most one set piece.

## Content inventory

### Overworld sprites (16×24 unless noted)

| Sheet | Anims (frames) | Variants |
|---|---|---|
| `lucky` | walk_down/up/left 3 each (right flipX), idle_* 1 each, melt 3, puddle 1, reform 4 (pop-pop-pop), channel 2 (glowing arm), slap 2, bristle 2 | `lucky_rage`, `lucky_deflated`, `lucky_bruised`, `lucky_plaster` |
| `lucky_ball` (16×16) | idle 2 (compressed, pulsing), squish 2 | — |
| `lucky_fall` (24×16) | glide 2, bank_left 1, bank_right 1 | — |
| `phoenix` | walk 3×3, idle, trash_bag 1, glasses_push 2, melt 3, puddle 1, bass_mute 1 | `phoenix_plaster` |
| `brian` | walk 3×3, idle, pace 2, point 1, rage 2, stuff_cables 2 | — |
| `ryan` | walk 3×3, idle, carry_hardware 3, sit 1, drum 4, nod 2 | `ryan_slimed` (skin/flannel sheen → `#8bff9a`), `ryan_plaster` |
| `bajonka` | walk 3×3, sit 1, sneeze 2, clipboard_sit 1, keys_sit 1, trot_drop 2 | — |
| `cop` | walk 3×3, idle, collar_tap 2, mohawk_off 1, run_holding_mohawk 3 | — |
| `punk_a`, `punk_b`, `punk_c` | walk 3×3, idle, headbang 2, run 3 | `_plaster` each |
| `intern` | walk 3×3, idle, clipboard 1 | — |
| `barista` | idle 2, pour 2 | — |
| `pawnbroker` | idle 2 | — |
| Objects (16×16): `intercom_speaker` (idle 1, talk 2, squelched 1), `eject_button` (idle, pressed), `bass_amp` (idle, glow 2), `guitar_amp` (idle, glow 2), `pedalboard` (pristine, wet, fried 2 with sparks), `coffee_cup` (idle, tipping 2, spilled), `mic_stand` 1, `flyer` 1, `contract` 1, `van_keys` 1 | | |
| `drum_kit` (32×32) | idle 1, hit 2, slimed 1 | — |
| `crash_word` (64×24) | drop 3 | — |
| `kraaang_word` (96×24) | manifest 3, swing_g 4 (the G separates as its own 24×24 sprite) | — |
| `soundwave` (256×32) | roll 4 (montage ribbon) | — |

### Battle sprites (32×32 unless noted)

| Sheet | Anims (frames) | Variants |
|---|---|---|
| `lucky_battle` | idle 2, strum 3, riff 2, hurt 1, ko 1 (puddle), win 2 | `_rage`, `_deflated`, `_bruised`, `_plaster` |
| `phoenix_battle` | idle 2, strum 3 (trash bag), riff 2, hurt 1, ko 1, win 2 | `_plaster` |
| `brian_battle` | idle 2 (identical bar a 1 px pick shift), strum 3, riff 2, hurt 1, ko 1, win 1 (thumbs up) | — |
| `ryan_possessed` (48×48) | idle 2, drum 4, smear 4, hurt 1 | `ryan_bruised` |
| `ryan_eternity` (64×64) | loop 6 | palette cycle at runtime by frame swap: 8 baked phases → 48 frames |
| `drone` | idle 2, attack 2, hurt 1, death 2 | `hall_drone` |
| `intern_battle` | idle 2, attack 2, hurt 1, ko 1 | — |
| `noise_complaint` | idle 2, attack 2, hurt 1, ko 1 | — |
| `whrnnng` (48×48), `thudthud` (48×48) | idle 2, attack 2, hurt 1 | — |
| `cop_battle` | idle 2, attack 2, hurt 1, mohawk_off 1, flee 1 | — |
| `khaki_battle` | idle 2, attack 2, hurt 1, ko 1 | — |
| `sfx_doom` (48×16), `sfx_crack` (48×16), `sfx_thud` (40×16) | idle 1, swing 2 | — |

### Tilesets

- `vanguard` (12): hull_floor, hull_floor_stripe, hull_wall, hull_wall_panel, pod_glass, pod_seat, conduit, vent, warning_stripe, window_stars (2-frame), intercom_mount, eject_mount.
- `minneapolis` (34): snow, snow_packed, slush, snowbank, sidewalk, sidewalk_ice, street, street_line, curb, brick_wall, brick_wall_graffiti, brick_window_lit (2-frame flicker), brick_window_dark, door_metal, door_wood, dumpster, dumpster_down, pothole, pothole_glow (2-frame), lamp_post_base, lamp_post_top (over), bare_tree_trunk, bare_tree_top (over), billboard_frame ×2, billboard_text ×4 (WORK IS LOVE), billboard_glitch ×4, neon_palmers ×4 (2-frame), awning (over), van ×4, fence, coffee_front ×2, pawn_front ×2.
- `interiors` (40): wood_floor, carpet_stained, tile_floor, wall_plaster, wall_poster ×3, wall_bills ×2, bass_amp_tile, couch ×2, table, counter, espresso_machine, stool, window_night, stage_edge, stage_floor, bar_counter ×2, beer_sign (2-frame), sticker_wall ×4, soundproof_door (2-frame), room_number_4, room_number_x, hallway_floor, hallway_light, mic_tile, drum_riser, ceiling_cracked ×2, rubble ×3, drywall_chunk ×2, sky_hole ×2 (over, stars), plaster_floor.
- `pines` (8): pine_trunk, pine_top (over), snow_deep, garage_wall, garage_door, garage_floor, lamp, dark.

### Portraits (32×32)

Lucky: neutral, grin, rage, deflated, bristle, sunglasses, calm_scary (7). Phoenix: tired, deadpan, glasses_push, terrified_impressed, melting, my_brain_thinks (6). Brian: normal, pointing, rage_red, stroke_veins, smug (5). Ryan: stoic, slimed, eyes_glow (3). Bajonka: sit, sneeze (2). Dad: grille, grille_talk (2; the portrait is a speaker). Cop: disguise, mohawk_off (2). Barista, Pawnbroker (1 each). Total 29.

### Songs (19) — see cue list. SFX (34) — see SFX list.

### UI atlas (`tools/ui/ui.txt`)

win_tl/t/tr/l/c/r/bl/b/br (4×4, flat), ffwin_* (9 pieces, blue gradient), capwin_* (9 pieces, inverted), clip (16×8), cursor_hand (8×8, left-pointing), cursor_hand_down, more_triangle (8×8), meter_seg_on/off (4×8), beat_lamp_on/off (4×4), emote_! ? … ♪ ♥ zzz (8×8), count digits 1–4 (16×16), logo letters S L I M E M O N T R (16×16), tape (16×8), mood_swatch frame (10×10).

## Risks & cuts

| Risk | Mitigation / cut |
|---|---|
| The roof-peel strip animation is the most complex presentation code in the slice. | Cut to: the top four rows fade to `sky_hole` tiles row by row (4 steps, 15 frames each) with the same SFX. Keep the wall blow and the cymbal shake; those are cheap. |
| 28-strip TileSprite waves (border bend, apartment background) may cost on low-end WebGL. | Reduce to 14 strips of 16 px; or replace the wave with a 2-frame offset flicker. |
| Baking 8 palette phases × every background at boot delays the title. | Bake lazily on first use per background; the title needs none. |
| The Eternity's 48 runtime frames (6 × 8 phases) in one sheet. | Fall back to 6 frames and swap between two palette variants every 10 frames. |
| Freefall minigame scope. | Cut steering to a non-interactive 20 s cutscene with the contrail pre-painted; keep the sunglasses. |
| The Pocket beat lamp requires the sequencer to expose beat timing to the HUD. | Sequencer emits `onBeat(bar, beat)`; if that slips, Pocket fills on every confirm (no timing) and the hooks still fire by count. |
| Four mood variants × two Lucky sheets × plaster = a lot of generated PNGs. | Variants are free (one `variant:` line each); the cost is the four base frames of art, which is fixed. |
| Three battle-size sheets for Ryan (16×24, 48×48, 64×64). | The 48×48 possessed sheet can be cut to 32×32 if the kit is drawn as a separate object; the 64×64 Eternity stays — it is the slice's splash page. |
| 7/8 songs in a 16th-grid sequencer. | `beatsPerBar: 7, stepsPerBeat: 2` as §7 allows; author `pocket` and `rhythm_achieved` first to prove the format. |
| Brian's and Ryan's arcs push the slice past 75 minutes. | Trim the streets hub to two roaming encounters and cut the pawnshop (coffee shop sells Pizza Slices). Never cut the quit or the keys. |
