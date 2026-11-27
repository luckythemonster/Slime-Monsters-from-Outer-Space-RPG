# Chapter 1 addition: the Blue Line and Lake Street

The Chapter 1 design for the Blue Line, Lake Street and Extreme Noise. It is a companion to `docs/DESIGN.md`, in the
same shape, and covers the three maps, their cutscenes, enemies, items, art and tests.

Three things are added:

1. **The Blue Line.** The light rail from Cedar-Riverside to City Sound becomes a train you walk, car to car, with
   passengers, ads and fights. Today it is a caption card: TWENTY MINUTES OF LIGHT RAIL LATER. The card stays. The
   ride comes first.
2. **Lake Street.** A stop on the way, and one compressed block of Lake Street.
3. **Extreme Noise.** The record store on that block: a shop, a save point, a mini-boss, a plant for Zerkel Pit,
   and on the gig night, the band's own tape in the local bin.

Nothing on the story spine changes. Every fight added is optional. The first ride is the only new thing on the
critical path, and it adds about three minutes.

## Pillars, applied

- **Every tile has a joke.** The train is three cars of Minneapolis in January: slush on the floor, a bike on a
  hook, ads that say WORK IS LOVE.
- **Broke is the permanent condition.** The fare is $2 a rider. Paying it is the peaceful choice, and it costs the
  band money it does not have. Not paying it is a ticket that can never be paid, like the pothole.
- **Small numbers, no grinding.** Train fights are on the map and stay dead, like the hub's. See the XP budget.
- **The band is unstable.** Brian rides the first train and Ryan rides the last one. The two rides are the same
  map. What changes is who is in it.

## When the train runs

The rail opens on `flags.ryanCalled`, as it does now. The player can ride it in two windows.

| Window | Flags | Party | Time | Encounter roster |
|---|---|---|---|---|
| A, THAT NIGHT | `ryanCalled && !auditionDone` | Lucky, Phoenix, Brian | night, before the AUDITION | Fare Compliance Associate, Unattended Bag, Transit Pigeons |
| C, GIG NIGHT | `hasPalmersFlyer && !onStage` | Lucky, Phoenix, Ryan (AUTO) | night, almost a year later | Senior Fare Compliance and a Trainee, The All-Hands |

There is no window B. From the AUDITION to the crumpled flyer, Chapter 1 is one run of cutscenes in Room 4 and
Zerkel Pit, and the player never reaches the street.

The first ride is outbound, in window A, from Cedar-Riverside to City Sound. The return in window C is inbound,
from City Sound back to Cedar-Riverside for Palmer's. Both are walked the first time. After the first full ride,
boarding offers a skip.

## The train is a corridor of stops

The one idea that makes this cheap: **walking toward the front of the train is the train moving.**

The train is one map, three cars long. Crossing a gangway is the next stop. The doors open only in the car that
matches the stop the train is at. Going outbound you board at the back (car 1) and walk east. Going inbound you
board at the front (car 3) and walk west. The same map serves both rides.

| Var | Values |
|---|---|
| `vars.railDir` | `1` outbound (toward City Sound), `2` inbound (toward Cedar-Riverside) |
| `vars.railStop` | `0` Cedar-Riverside, `1` Lake St / Midtown, `2` City Sound |

| Gangway | Outbound (`railDir == 1`) | Inbound (`railDir == 2`) |
|---|---|---|
| A, x 18..19 | if `railStop < 1`: set 1, NOW ARRIVING: LAKE ST / MIDTOWN | if `railStop > 0`: set 0, NOW ARRIVING: CEDAR-RIVERSIDE |
| B, x 38..39 | if `railStop < 2`: set 2, NOW ARRIVING: CITY SOUND | if `railStop > 1`: set 1, NOW ARRIVING: LAKE ST / MIDTOWN |

A stop only moves forward, so walking back through a gangway changes nothing. Car 1's doors open at stop 0, car
2's at stop 1, car 3's at stop 2. The announcement says which side: outbound the doors are on the right,
inbound on the left. It is the same row of doors.

City Sound's stop has no real name. The PA says "CITY SOUND", and the first announcement adds "(It is not called
that. Everyone calls it that.)" That keeps the rehearsal space's location vague, the way Chapter 1 has it now.

**Fast travel.** After `flags.rodeRail` (set on the first arrival anywhere), every boarding asks:
[Ride it] / [City Sound] / [Lake St] / [Cedar-Riverside], without the stop you are standing at. A skip plays a
caption over black and lands you on the platform. [Ride it] puts you in the train.

## Flag spine additions

```
street rail (ryanCalled) ─first time─▶ ep0_rail_board_first (THAT NIGHT) ─▶ rail_car, railDir 1, railStop 0
  gangway A ─▶ railStop 1 (car 2 doors) ─[get off]─▶ ep0_rail_off_lake ─▶ lake_street ─▶ extreme_noise
  gangway B ─▶ railStop 2 (car 3 doors) ─[get off]─▶ ep0_rail_arrive_city ─▶ city_sound_hall (3,6), rodeRail
city_sound_hall stairs ─▶ ep0_rail_board_city ─▶ rail_car, railDir 2, railStop 2 (car 3)
  gangway B ─▶ railStop 1 ─▶ … ; gangway A ─▶ railStop 0 (car 1 doors) ─[get off]─▶ street_cedar (22,15)
lake_street east edge ─▶ ep0_lake_platform [Toward City Sound] / [Toward Cedar-Riverside] ─▶ rail_car car 2
Side flags (never gate the spine): rodeRail, farePaid_a, farePaid_c, fareTicket_c, cleared_fare, cleared_bag,
cleared_pigeons, cleared_fare_senior, cleared_all_hands, cleared_completist, rodeGig, knockedOperator, foundNo,
boughtTape, visited_lake_street, visited_extreme_noise.
```

Today the hall's stairs go straight to the street. With this, they board the inbound train. The street's
`rail` trigger and its refusal before `ryanCalled` stay as they are.

## Maps

| id | Name | W×H | Tileset | Music | Exits | Save |
|---|---|---|---|---|---|---|
| `rail_car` | The Blue Line, three cars | 58×14 | `transit` (new) | `blue_line` (new), ambient `rail_clack` | doors by script only | none |
| `lake_street` | Lake Street, one block | 40×16 | `minneapolis` | `snow` | east edge → platform script; store door (12,8) → `extreme_noise` (10,12) | none |
| `extreme_noise` | Extreme Noise | 20×14 | `interiors` | `dollar_bin` (new) | door (10,13) → `lake_street` (12,9) | window C: Bajonka by the local bin (15,8) |

Each lists `"encounters": { "rate": 0, "pool": [] }`, like every Chapter 1 map.

### `rail_car` (58×14)

**Layout.** Three cars of 18 tiles, joined by two 2-tile gangways (x 18..19 and 38..39). Car 1 is x 0..17, car 2
is x 20..37, car 3 is x 40..57. Rows 0..3 and 10..13 are solid `dark`, like `city_sound_hall`, so the 16×14
viewport never shows bare canvas. Inside each car:

```
row 4   #wwAwwwwwwAwwwwww#   window wall: w window (animated object), A ad panel
row 5   #hh..hhhh..hhhh.p#   h seat (solid), . floor, p grab pole (solid)
row 6   #................=   aisle  (= gangway accordion floor)
row 7   #................=   aisle
row 8   #hh..hhhh..hhhh..#   seats
row 9   #===DD======DD===#   door wall: D doors (closed tile; open is an object)
```

Doors per car are at x +4..5 and +12..13 of the car, on row 9. The operator's door is car 3's east wall (57,6..7).
Five windows per car (car-relative x 2, 4, 10, 12, 15) are `obj_train_window` objects with a four-frame `_idle` loop:
streetlights and snow going by. They are decoration, with no script. Both directions use the same loop.

**Spawns.** Outbound from Cedar: (3,7) facing right. Inbound from City Sound: (54,7) facing left. From Lake St:
(29,7), facing the way the train is going.

**NPCs.** All are present in both windows unless a window is named.

- Car 1, Sleeping Commuter (2,5), against the window. A: narrator "Asleep against the window. Do not wake them.
  They know their stop." C: "Still asleep. It has been almost a year. They still know their stop." *(new)*
- Car 2, Train Busker (26,8), a guitar. "Every car is a venue if you don't ask." *(new)* C, Ryan:
  [He plays every night. In front of people.] [How.] *(new)*
- Car 3, Grocery Rider (44,5), eleven bags. "The store was out of everything but bags." *(new)*
- Car 3, Jersey Guy (49,8). Narrator "A hockey jersey. The team isn't playing tonight. Or this year." / "You gotta
  believe in something." *(new)*

**Interactables.**

- Ads, one per car, at car-relative x 9 (x 9, 29, 49). Car 1: "WORK IS LOVE." Car 2: "DENTAL PLAN? ASK ME HOW." Car 3: "IF YOU SEE SOMETHING, SAY
  SOMETHING. THEN SAY IT AGAIN, INTO THIS APP." *(new)*
- Bike hook, car 2 (34,5): "A bike hangs from the ceiling hook. It looks like it is being punished." *(new)*
- Slush, car 1 floor (8,7), not solid: "Slush tracked in from four stations. It is not an enemy. Yet." *(new)*
- Closed doors: "Closed. Minneapolis goes by at a speed you would describe as 'municipal.'" *(new)*
- Open doors: [Get off at <stop>] / [Stay on].
- Operator door: "OPERATOR ONLY." Phoenix: "My brain thinks nobody is driving." Then [Knock] / [Don't]. Knock:
  "Someone knocks back. In 7/8." (`flags.knockedOperator`). C adds Ryan: [That's not 7/8.] {pause:600} [It's 7/8.]
  *(new)*

**Triggers.** Gangways A and B (above), 2×2, not `once`. The map has no `onEnter` story: CS-R1 and CS-R3 run
from the boarding scripts that teleport into it.

**Enemies.** See Battles. Window A, boarding at car 1: `fare` patrols car 1's aisle (`patrol`, `RRRRRRRRLLLLLLLL`
on row 6 from x 8), so he is the first thing the player meets; `bag` is `static` on a car 2 seat (30,5); `pigeons`
stand still (`idle`) in car 3 at (50,6). Window C, boarding at car 3: `all_hands` is an object on a car 3 seat (51,8);
`fare_senior` patrols car 2's aisle (`LLLLLLLLRRRRRRRR` on row 6 from x 34). Every patrol keeps to row 6, so row 7 is
always a free lane: a fare is never a fight the player walked into without choosing.

### `lake_street` (40×16)

One block, at night, in snow. Lake Street is long and Extreme Noise is not next to the station, so the game says
so: stepping off at Lake St plays a card, TWO MILES OF\nLAKE STREET LATER, the first time. After that the walk is
a fade.

**Layout, west to east, north sidewalk.** A mural wall (2..7): "The whole city holding hands. Someone has painted
in a slime. It is pink and green." *(new)* Extreme Noise
(sign 4 tiles on row 7 at 10..13, door (12,8), windows (10,8), (11,8), (13,8), (14,8)). A shuttered storefront (20..22): "LAKE
STREET PAWN & LOAN. MOVED TO CEDAR. KEPT THE NAME." *(new)* A laundromat (26..29): "SPIN CYCLE: 25 MIN. ALSO:
RENT." *(new)* A taqueria (32..35), closed: "BACK AT 11 AM. IT IS 8:51 PM." *(new)* A bus shelter (37,9), reusing
the Cedar tiles: "WORK IS LOVE. (smaller:) NOW SERVING LAKE STREET." *(new)* Cedar's Lake-Street-named pawnshop
has been a stray since the slice (see Found while reading). This makes it a joke instead of a mistake.

Rows 11..13 are the street. The south side is snowbank and fence. The east edge (39,9..13) is the walk back to the
platform.

**NPCs.** Bus Rider at the shelter (36,9): "The 21 comes every ten minutes. I've been here forty." *(new)* A kid
with a snow shovel and a skateboard (6,10): "The city plows the street. I plow the ledge." *(new)*

**Enemies.** None. The block's fight is in the store, and it happens out here.

### `extreme_noise` (20×14)

The store is a collective. Its volunteer runs the shop. There is no manager, there is a binder, and the binder
is the good kind of paperwork. Lucky does not slap it.

**The look.** High contrast. The records and the T-shirts are black and white, and so is most of the room. The
color is the flyers: a wall of them, every color, layered. Everything else is punk stuff: buttons, patches, a
studded belt. On screen the store should read as a black-and-white room with one loud wall.

**Layout.** Door (10,13). Counter west (1..4, 3..5), the volunteer behind it (2,4), the binder on its corner (4,3).
The volunteer is talked to across the counter: an object on the counter tile (4,4) runs the script, like the café's
barista. A
T-shirt wall above and behind the counter (1..5, 1..2): black shirts, white prints. Four rows of record bins (x
6..16 on rows 5, 7, 9, 11, solid), labeled on their end caps: PUNK A TO Z, HARDCORE, LOCAL, SKA, and the DOLLAR
BIN at the end of row 11. Zine rack on the north wall (7..9, 1). Flyer wall (11..17, 1..2), the only color in the
room. Listening station (17,4). A back-room door (18,2). A rack of buttons and patches on the east wall (19,6..8).
Spawn (10,12) facing up.

**NPCs.**

- **Volunteer** (2,4): "Welcome to Extreme Noise. There's no manager. There's a binder." → `shop extreme_noise`.
  Second talk: [Can I volunteer?] → "Meetings are Tuesdays. It's Thursday." *(new)* The volunteer is an original
  character, not anyone who works there.
- **The Completist** (11,6), in the aisle at the PUNK bin, window A or C until cleared. See CS-R6.
- **Bajonka** (15,8), window C, `type: save`, `condition: flags.hasBajonka && flags.hasPalmersFlyer`. She is next to the
  tape she consigned. Nobody mentions it.
- **No, the cat** (16,11), in the dollar bin. The hydrant flyer on Cedar has said LOST: CAT. ANSWERS TO 'NO.' since
  the slice. Narrator: "A cat in the dollar bin. You say 'No.' It looks up." {pause:500} "It has been found. It does
  not want to be." Phoenix: "My brain thinks it lives here now." (`flags.foundNo`) *(new)* Afterward, the hydrant
  flyer on Cedar reads "LOST: CAT. ANSWERS TO 'NO.' (Someone has written underneath: SHE'S AT EXTREME NOISE. SHE'S
  FINE.)" The mohawk flyer after `eternityDone` still replaces it.

**Interactables.**

- **Binder** (3,3): "MEETING MINUTES. ITEM 1: Who keeps filing ska in the punk bins. ITEM 2: (illegible).
  CONSENSUS: REACHED." Phoenix: "My brain thinks it's a clipboard that went to college." *(new)*
- **PUNK A TO Z:** "Every band you have heard of, and four you haven't, filed under the one you have." *(new)*
- **HARDCORE:** "Alphabetized by how fast. Nobody agrees." *(new)*
- **SKA:** "SKA. Someone has written: IT'S COMING BACK. Someone else: IT NEVER CAME." (the City Sound ska band) *(new)*
- **LOCAL**, window A: "RAT FIGHT: DULUTH DEMOS. Five copies. All five consigned back by Rat Fight." *(new)*
  Window C adds the tape. See CS-R7.
- **DOLLAR BIN:** "THE DENIM BOYS: A NIGHT OF DENIM. Still sealed. It will be sealed forever." *(new)*
- **Zine rack**, three lines cycling: "HOW TO PATCH A JACKET WITH DENTAL FLOSS (the dental plan you can afford)." /
  "NOISE IS A LOVE LANGUAGE, #3." / "MINNEAPOLIS IN WINTER: a zine with no pages, only snow." *(new)*
- **Flyer wall**, window A: "ZERKEL PIT PUNX FEST. THIS SUMMER. BANDS WANTED. ALL AGES. ALL WEATHER." Phoenix: "My
  brain thinks we should apply." Lucky: "We should play it." *(new; a plant for THAT SUMMER)* Window C: "GIG TONIGHT:
  PALMER'S BAR. NO GUITAR SOLO NECESSARY." Phoenix: "My brain thinks she got here first." *(new)*
- **T-shirt wall:** "Black shirts. White ink. Every band name is illegible on purpose." Phoenix: "My brain thinks
  that's the point." *(new)*
- **Buttons and patches:** "Buttons, patches and one studded belt nobody in this band is cool enough for." *(new)*
- **Listening station:** "Headphones. One ear works." With the tape, see CS-R7. *(new)*
- **Back-room door:** "VOLUNTEERS ONLY. Everyone is a volunteer. Still no." *(new)*
- **Hours sign** on the door's inside: "OPEN TIL 9. IT IS 8:51." Window C: "OPEN TIL 9. IT IS 8:51. AGAIN." *(new)*

## Cutscenes

Shorthand as in `docs/DESIGN.md`. Every line here is *(new)*. Nothing is quoted from the comics, so all of it can
be improved.

### CS-R1 `ep0_rail_board_first`: the first ride (window A, street `rail` trigger, first time), Toon 0

1. `sfx door`; `camera fade out 300`; `if !flags.visited_city_sound_hall: caption "THAT NIGHT" 1500` (moved here
   from `ep0_street_rail`, unchanged).
2. `set vars.railDir 1, vars.railStop 0`; `teleport rail_car 3 7 right`; `camera fade in 300`; `music blue_line`.
3. `sfx rail_chime`; `say narrator` "THE BLUE LINE. Doors closing." {pause:400} "The doors close on Brian's
   pedalboard. Twice."
4. `say brian` "{speed:fast}I'll stand. The board needs to stay level."
5. `say phoenix` "My brain thinks the seats are a trap anyway."
6. `sfx pa_ding`; `say narrator` "NEXT STOP: LAKE ST / MIDTOWN. Then CITY SOUND." {pause:300} "(It is not called
   that. Everyone calls it that.)"
7. `say brian` "Light rail is the most accurate way to travel. It's on a rail."

Control returns. Brian's lines run only in window A, so they need no condition.

### Gangway announcements: `ep0_rail_gangway_a`, `ep0_rail_gangway_b`

Each is an `if` on `railDir` and `railStop` (table above). When it advances the stop: `sfx pa_ding`; `say
narrator` "NOW ARRIVING: <STOP>. Doors open on the <right|left>."; `sfx rail_chime`. Otherwise it does nothing.

### CS-R2 `ep0_rail_arrive_city`: City Sound (car 3 doors, outbound)

1. `camera fade out 300`.
2. `if !flags.visited_city_sound_hall`: `if flags.visited_lake_street: caption "FORTY MINUTES OF LIGHT RAIL\nAND ONE RECORD STORE
   LATER" 1800`, else `caption "TWENTY MINUTES OF\nLIGHT RAIL LATER" 1800`. The second card is the shipped one,
   unchanged.
3. `set flags.rodeRail`; `teleport city_sound_hall 3 6 right`; `camera fade in 300`.

### CS-R3 `ep0_rail_gig`: the last ride (window C, first boarding from the hall), Toon 0 → 1

Runs from `ep0_rail_board_city` when `flags.hasPalmersFlyer && !flags.rodeGig`, and sets `flags.rodeGig`. It is
walked even if fast travel is open. Boarding from the hall in window A is a plain inbound ride with no scene.

1. `set vars.railDir 2, vars.railStop 2`; `teleport rail_car 54 7 left`; `music blue_line`.
2. `say narrator` "The night before the Potato Belt tour. The train is full."
3. `say ryan_caption` "[Nobody on a train looks at anybody.]"
4. `say ryan_caption` "[That's the best thing about trains.]"
5. `say phoenix` "My brain thinks Palmer's holds forty."
6. `say ryan_caption` "[Forty.]"
7. `say lucky` "Forty is a crowd. Forty is a riot if you do it right."
8. `emote ryan …`

The last two lines set up Palmer's, where his captions go small. Ryan has no spoken line on the train. His captions
here are the third and fourth time the player hears his stage fright, after the café and Zerkel Pit.

### CS-R4 `ep0_rail_fare`: Fare Compliance (window A, the enemy's script, on contact)

1. `say fare` "Fare Compliance. A Vanguard partner. Proof of payment, please."
2. `say brian` "{speed:fast}Monthly pass. I'm a completely normal commuter."
3. `say fare` "Valid. Have a normal night, sir." `face fare toward player`. "Two dollars each. That's four."
4. `if money >= 4`: `choice` [Pay $4] / [Take the ticket] / [Refuse]. Else: `say phoenix` "My brain thinks we
   don't have four dollars." then `choice` [Take the ticket] / [Refuse].
   - **Pay $4:** `take money 4`; `say phoenix` "My brain thinks that was dinner."; `set flags.farePaid_a,
     flags.cleared_fare`.
   - **Take the ticket:** `give fare_citation`; `say narrator` "FARE CITATION: $35."; `say phoenix` "My brain thinks
     we should frame that one too."; `set flags.cleared_fare`.
   - **Refuse:** `say lucky` "We're not paying to be watched."; `battle rail_fare`, `onWin set
     flags.cleared_fare`.

Paying or taking the ticket clears him, so a fare is never a fight the player did not choose.

### CS-R5 `ep0_rail_fare_senior`: Senior Fare Compliance (window C)

1. `say fare_senior` "Fare Compliance. I've been promoted. This is my trainee. He's shadowing."
2. `if inventory.has('fare_citation')`: `say fare_senior` "You have an outstanding citation." / `say phoenix` "My
   brain thinks it's been almost a year." / `say fare_senior` "It's been accruing."
3. `say ryan_caption` "[He's looking at me.]" / "[He's looking at everybody. It's his job.]"
4. `say narrator` "Ryan holds out exact change. He has always had exact change."
5. Same three choices for Lucky and Phoenix, $4. Ticket, if they already have one: `say narrator` "FARE
   CITATION: SECOND NOTICE." and `set flags.fareTicket_c` (no second item). Refuse: `battle rail_fare_senior`.

### CS-R6 `ep0_extreme_completist`: The Completist (interact, `!flags.cleared_completist`)

1. `say completist` "You're holding that wrong. That's a repress."
2. `say phoenix` "My brain thinks we're not holding anything."
3. `say completist` "You'd know if you'd heard the original pressing."
4. `choice` [Fight about it] / [Walk away]. Walk away: `say completist` "Typical." and end.
5. Fight: `say volunteer` "Not in the store. Outside." `teleport lake_street 12 9 down`; `spawn completist 12
   10`; `battle lake_completist`.
6. `onWin`: `say completist` "Fine. You've heard of them now."; `give mystery_7inch`; `set
   flags.cleared_completist`; `despawn completist`. `onLose`: `gameover`.

Window A adds, before step 4: `say brian` "Is it accurate? That's all I'm asking." / `say completist` "It's
*original.*" / `say brian` "That's not what I asked." Brian takes nobody's side. *(new)*

### CS-R7 `ep0_extreme_tape`: the local bin (window C)

1. `say narrator` "LOCAL. RAT FIGHT: DULUTH DEMOS. Five copies." {pause:300} "And a cassette, hand-dubbed:
   SLIME MONSTERS FROM OUTER SPACE. LIVE AT ZERKEL PIT. $3. CONSIGNED BY: (a paw print)."
2. `say phoenix` "My brain thinks we didn't make a tape."
3. `say lucky` "We didn't."
4. `say ryan_caption` "[Someone recorded us.]" / "[Anyone could buy it.]"
5. `if money >= 3`: `choice` [Buy it] / [Leave it]. Buy: `take money 3`; `give zerkel_tape`; `say narrator` "Lucky
   buys their own tape. Bajonka will be paid on Tuesday." `set flags.boughtTape`.

With the tape, the listening station: `say narrator` "Side A. A parking lot, a flatbed and a sky."; `music
band_hunger` until the player leaves the map or presses again; `say ryan_caption` "[I can hear myself.]" /
"[I sound like I was there.]" The band played `band_hunger` at Zerkel Pit, so the tape is that set. Without
buying, the volunteer will play it once: "We can put it on. Store copy."

### CS-R8 `ep0_extreme_enter`: first entry (`extreme_noise.onFirstEnter`), Toon 0

Window A: `say volunteer` "Hey. We close at nine." / `say brian` "Is there a section for normal music?" / `say
volunteer` "That's the dollar bin." / `say brian` "{speed:fast}…Fair." Window C: `say volunteer` "Hey. We close
at nine." / `say volunteer` "Oh. You're the tape." / `say ryan_caption` "[We're the tape.]"

### Platform and doors: `ep0_rail_off_lake`, `ep0_lake_platform`, `ep0_rail_board_city`, `ep0_rail_doors`

Plumbing, no story. Getting off at Lake St plays the TWO MILES card once and lands at `lake_street` (38,10).
Walking off the east edge asks [Toward City Sound] / [Toward Cedar-Riverside] (window C reverses the order, so
the way to Palmer's is first) and boards car 2 with `railStop 1`. After `rodeRail`, every boarding first offers
fast travel. Getting off at Cedar lands at `street_cedar` (22,15), one tile above the `rail` trigger, as the hall's
stairs do now.

## Battles

All six are on-map, optional and stay dead (`setOnWin: flags.cleared_<id>`). All can be fled, like the hub's. A
loss is a Game Over and a Continue from the last save: in window A that is autosave 2b at the end of CS-08, right
before the rail; in window C it is Bajonka outside Palmer's or in the store.

| id | Enemy | px | HP | ATK | DEF | SPD | XP | $ | Weak / resist | Flavor (Phoenix's scan) |
|---|---|---|---|---|---|---|---|---|---|---|
| `fare` | Fare Compliance Associate | 48 | 90 | 9 | 5 | 6 | 10 | 0 | LOW / HIGH | "My brain thinks he gets a commission." |
| `unattended_bag` | Unattended Bag | 32 | 60 | 6 | 8 | 1 | 8 | 2 | NOISE ×2 / PHYS | "My brain thinks it's saying something." |
| `pigeon` ×2 | Transit Pigeon | 32 | 30 | 7 | 2 | 11 | 4 ea | 1 ea | HIGH / none | "My brain thinks they have monthly passes." |
| `fare_senior` | Senior Fare Compliance | 48 | 160 | 12 | 8 | 7 | 18 | 0 | LOW / HIGH | "My brain thinks he got promoted for this." |
| `fare_trainee` | Fare Compliance Trainee | 32 | 60 | 8 | 4 | 8 | 6 | 0 | none / none | "My brain thinks it's his first day." |
| `all_hands` | The All-Hands | 48 | 120 | 10 | 6 | 9 | 16 | 3 | NOISE / LOW | "My brain thinks we're all on mute." |
| `completist` | The Completist (opt.) | 48 | 200 | 11 | 6 | 6 | 24 | 5 | NOISE / HIGH | "My brain thinks he's heard of us. My brain thinks he won't say so." |

Encounters: `rail_fare` (fare), `rail_bag` (bag), `rail_pigeons` (pigeon ×2), `rail_fare_senior` (fare_senior and
fare_trainee), `rail_all_hands` (all_hands), all on the new `train` background; `lake_completist` (completist) on
`street`. Music `battle`.

**Move lists and AI.** Every move uses a status or rule the engine already has.

- **Fare Compliance Associate** (Caller): Proof of Payment (NOISE 60, 40% TEMPO DOWN) weight 3; Citation (PHYS 100,
  text "He writes it very hard.") weight 3; Validate (self heal 15, below 50%, once). Navy fleece, a Vanguard lanyard,
  a ticket scanner holstered like a gun.
- **Unattended Bag** (static): Record (self, no effect, text "It is recording.") on rounds 1 and 2; Upload (NOISE 50
  all) every 3rd round; otherwise Record. A gray duffel with one antenna. It never attacks before round 3, so the
  fight is a lesson in hitting NOISE before it uploads.
- **Transit Pigeon** (Swarm): Peck (PHYS 90); Coo (NOISE 40, 20% DAZED); flees below 30% if alone, like the goose.
- **Senior Fare Compliance:** the Associate's list at his numbers, plus Escalate (target all, 40% OUT OF TUNE) once
  at round 3.
- **Fare Compliance Trainee:** round 1 Shadowing (self, no effect, text "He is taking notes."); then Citation at
  PHYS 80. If the Senior falls first, he flees ("He has to call someone.").
- **The All-Hands** (static): Can Everyone See My Screen (NOISE 60 all, 30% DAZED) every 2nd round; You're on Mute
  (NOISE 50, 40% DEAF); Circle Back (NOISE 70, text "Let's circle back."). At round 6 it flees: "We'll take this
  offline." A phone on a seat, on speaker, four hundred people on mute.
- **The Completist** (mini-boss): Well, Actually (NOISE 80, 50% OUT OF TUNE) weight 4; Deep Cut (PHYS 110,
  lowestHp) weight 3; Original Pressing (self TEMPO UP, once, round 2, text "He reminds you it's the original
  pressing."). Windbreaker, tote bag, reading glasses up on the head. Weak to NOISE: he has never liked anything
  loud that he didn't hear first.

**Tuning.** Window A sits at the hub's numbers (party L3 to L4, Brian at his fixed level). Window C sits at the
night hub's (L5 to L7, Ryan on AUTO). The Completist is billboard-sized, so it is a real fight in window A and an
easy one in window C. That is on purpose: the player who finds him early gets a mini-boss.

**XP budget.** New optional XP: window A 26 (fare 10, bag 8, pigeons 8), window C 40 (senior 18, trainee 6,
all-hands 16), the Completist 24. Total 90. The critical path is unchanged at 206 (L4 at the AUDITION, L5 at
Palmer's, L7 at the end), because every fare can be paid or ticketed. A full clear was already past the L8 cap at
311 and now reaches it sooner. The one change a player can feel: taking every window A fight can put the party at
L4 before the AUDITION instead of L3.

## Items, equipment, shop

| Item | Type | $ | Effect | Where |
|---|---|---|---|---|
| Zine: HOW TO TUNE BY EAR | consumable | 2 | Cures OUT OF TUNE. | Extreme Noise |
| Mixtape (C60) | consumable | 6 | +10 AMP. | Extreme Noise |
| Denim Vest | wear, any | 12 | DEF +2. Desc: "One patch. Phoenix calls it a gateway to double denim." | Extreme Noise |
| Earplugs | wear, any | 10 | Immune DEAF (existing item; a second place to buy it before the All-Hands). | Extreme Noise |
| Fare Citation | key | 0 | "FARE CITATION: $35. It cannot be paid either." Never leaves, like the Pothole Invoice. | the fare choice |
| Mystery 7-inch | key | 0 | "No label. No sleeve. Plays at a speed nobody owns." | the Completist |
| Zerkel Pit Tape | key | 3 | "SLIME MONSTERS FROM OUTER SPACE: LIVE AT ZERKEL PIT. Hand-dubbed. You paid for it." | the local bin, window C |

**Shop `extreme_noise`.** Keeper: the volunteer. Greeting: "There's no manager. There's a binder." Sells the
first four rows. Buys nothing: "We buy records. You don't have records." The Half-Ounce gets its own line if the
player has it: Phoenix: "My brain thinks they don't buy that." / volunteer: "We're a collective, not a
dispensary."

**Money.** The fare is the only new money sink that is not a shop, at $4 a window, and the tape is $3. The new
maximum is $108: the slice's $96, plus the bag $2, the pigeons $2, the All-Hands $3 and the Completist $5.
Paying both fares and buying the tape takes it to $97. The chapter still ends broke.

## Assets

Original designs, on the shared palette, 16 colors or fewer per sheet.

**Tileset `transit` (new, 17 tiles).** `dark`, `car_roof`, `car_wall`, `car_window`, `car_ad`, `car_end`, `seat`,
`seat_gum`, `floor`, `floor_slush`, `pole`, `door_wall`, `door_closed`, `gangway`, `gangway_floor`, `operator_door`,
`bike_hook`. The open door is the object `obj_door_open`.

**`minneapolis` additions (13).** `en_sign_1..4` (EXTREME NOISE in white 3x5 letters on near-black, pink tape tabs),
`en_window`, `mural_a..c` (the city holding hands; `mural_c` has the slime), `shutter`, `laundry_l/r`, `taqueria_l/r`.
The door is `door_shop`; the bus shelter, lamps, snow, sidewalk and street are reused.

**`interiors` additions (15).** `wall_black_top`, `wall_black`, `shirt_wall_a/b`, `flyer_wall_a..c`, `zine_rack_a/b`,
`record_bin_a/b`, `record_bin_cap`, `button_rack`, `listening_station`, `checker_floor`. The counter is the café's. The bins, shirts,
racks and floor use only black, white and grays. The flyer wall carries the color, as many hues as the 16-color
sheet allows, so the eye goes there first.

**Overworld sprites.** New drawings: `completist` (16x24), `bag_map`, `phone_map`, `cat_no` (16x16, 2-frame idle),
`obj_train_window` (16x16, 4-frame idle), `obj_door_open`. Variants (palette swaps): `fare_map`, `fare_senior_map`,
`fare_trainee_map` of `analyst_map`; `pigeon_map` of `goose_map`; `npc_sleeper` of `npc_nurse`, `npc_train_busker` of
`npc_busker`, `npc_grocery` of `npc_regular`, `npc_jersey` of `npc_cyclist`, `npc_skater` of `npc_shoveler`,
`npc_bus_rider` of `npc_smoker`, `npc_volunteer` of `npc_crustpunk` (black and white, like the store).

**Battle sprites.** `fare_b`, `fare_senior_b`, `fare_trainee_b` (48, variants of `analyst_b`), `pigeon_b` (32, a variant
of `goose_b`), `bag_b` (32, `bag_map` at 2x), `completist_b` (48, the map sprite at 2x, facing right), `all_hands_b`
(48, a phone on speaker with a faceless beige exec on the screen and waves rolling toward the band). Each has a 2-frame
`idle`; hurt and KO use the battle scene's defaults.

**Battle background `train`.** A window strip of streetlights and snow scrolling past, seat fabric below, a grab pole
in front. 8 fps, like `street`.

**Music (2 new).** `blue_line`: the ride, 124 BPM in E minor, a "da-dum" kick like wheels over a joint under an
eighth-note bass and a streetlight arpeggio, 8 bars, loops. `dollar_bin`: the store stereo, 172 BPM in A, a three-chord punk loop with buzzing 12.5% power
chords, as if through one blown speaker. Lake Street uses
`snow`. The tape plays `band_hunger`.

**SFX (3 new).** `rail_chime` (the two-tone door chime), `pa_ding` (one tone before an announcement), `rail_clack`
(ambient, the wheels over joints, about two per second).

## Engine extensions required

One.

1. **The `train` battle background.** A new pattern in `src/ui/BattleBackground.js` and its FPS entry. Fallback:
   `street`.

Everything else uses what the engine has: the corridor of stops is triggers, `vars` and `if`; the doors are
`object` entities with `condition`s, which re-evaluate after every script; the moving windows are an object's
`_idle` loop; fast travel is a `choice`; the tape is a `music` command; the map's rail sound is `ambient`.

## Tests

- `tests/data.test.mjs` covers every new id without changes.
- `tests/chapter1.mjs` (the honest playthrough) rides the first train: boards at Cedar, walks row 7 past the fare
  officer through both gangways, and gets off at City Sound. On the gig night it rides back inbound and gets off at
  Cedar. It fights nothing on the train, so the critical path's XP is unchanged.
- `tests/chapter1_wrong.mjs` section S14 plays every fare branch in both windows (pay, ticket, refuse and win,
  refuse and lose, the under-$4 menu); walking backward through each gangway changes nothing; every door in every
  car, open and closed; getting off at Lake St in both directions; every fast-travel option; every NPC and object on
  the three new maps (S10, both windows); the Completist fought, walked away from, and lost to; the tape bought, not
  bought and played; No found and the hydrant flyer after; every map edge (S11). `WRONG_ONLY="S14 the Blue Line"` runs
  one section.
- Foundations: an end-of-Chapter-1 save made before this work still loads, and `tests/fixtures/ch02_start.json`
  stays valid. A Chapter 2 start that carries a Fare Citation or a Zerkel Pit Tape still boots.
- The fare officers patrol row 6 and the pigeons stand still, so the honest run and the sweeps never walk into a
  fight by accident.


## Decisions

- **Extreme Noise is on Lake Street, reached from the Lake St / Midtown stop, and the game admits the walk.** The
  card says TWO MILES OF LAKE STREET LATER instead of pretending the store is at the station.
- **City Sound's stop has no real name.** The PA calls it CITY SOUND and says that is not its name.
- **The train is a corridor of stops.** Walking forward is the ride. It needs no new engine code and works the same
  in both directions.
- **The first ride is played and required.** It costs about three minutes on the critical path. Later rides can be
  skipped.
- **Fare Compliance is a Vanguard contractor, not transit police.** The villains speak corporate. Real transit
  workers are not the joke.
- **Every new fight is optional,** and a fare is never a fight the player didn't choose.
- **No crowd.** Nothing here touches `vars.crowdBank`. An in-store show would, and it is not in this spec.
- **The store's staff are original.** The volunteer, the Completist and every record in the bins are made up. No
  real band, musician or employee appears. Extreme Noise is named, as Palmer's and Pizza Luce are.
- **Ryan gets captions on the train, not lines.** His stage fright gets two more beats before Palmer's, both small.
- **The tape is Zerkel Pit.** Bajonka taped the set and consigned it. It is never explained.
- **The store's look is Lucky's:** high-contrast black-and-white records and T-shirts, colorful flyers and other punk
  stuff. The `extreme_noise` map and its art are drawn to that. *(canon, Lucky)*
- **The fare is $2 a rider.** *(canon, Lucky)*
- **New faces reuse old bodies where they can.** The fare officers are recolors of the Demographic Analyst, the
  pigeons of the goose, and the train and street NPCs of the Cedar Avenue regulars. The bag, the phone, the
  Completist, No and the train window are new drawings; the bag and the Completist are their map art at 2x in battle.
- **The Hard Luck Cafe's shop is named for the cafe.** The pawnshop keeps "Lake Street Pawn & Loan", and the
  shuttered storefront on Lake Street (MOVED TO CEDAR. KEPT THE NAME.) is why.

## Risks & cuts

Cut in this order.

1. The All-Hands.
2. The Transit Pigeons.
3. The Completist becomes an NPC with his lines and no fight. The Mystery 7-inch goes.
4. Lake Street shrinks to the store front and the shelter (20 tiles wide).
5. The fast-travel menu becomes one choice: [Ride it] / [Skip].

Never cut: the first ride walked car to car, the fare choice, Brian's and Ryan's lines on the train, the doors
opening in the right car, Extreme Noise with its volunteer and binder, the local bin and the tape on the gig night,
and the TWENTY MINUTES card, which is canon.


## Not in Chapter 1 yet

Other Minneapolis that would fit, each its own spec:

- **Zerkel Pit, walkable.** Bible open question 9 asks whether the lot becomes walkable. The map and its interact
  lines already exist.
- **An in-store matinee at Extreme Noise.** A short gig that banks crowd into `vars.crowdBank`, which the ending
  pays out. It would need its own answer to whether optional gigs should change the ending's number.
- **The skyways.** A warm, disorienting downtown maze with dead ends and food-court save points. It would need a
  reason to go downtown, which Chapter 1 does not have yet.
- **The Stone Arch Bridge at night.** A walk between the West Bank and somewhere else, with one encounter that only
  comes out after dark.
- **Cold as a field status.** The roadmap puts field statuses in Chapter 2 (MELTING). Building one in Chapter 1
  would move that system a chapter earlier. Not worth it for a joke about January.
