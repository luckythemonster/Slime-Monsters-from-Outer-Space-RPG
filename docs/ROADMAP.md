# Roadmap: the whole game

The plan for building all twelve chapters. `docs/STORY_BIBLE.md` says what happens. This says in what order it
gets built, what each chapter needs from the engine, and what has to be remembered from one chapter to the next.

## Where things stand

- **Shipped:** Chapter 1, "Coagulation". Pod bay to the rubble of Palmer's, about 70 minutes. It ends on
  `flags.ch1Complete`, a save, and a return to the title screen.
- **Next:** Foundations (below), then Chapter 2. The Chapter 2 brief is `docs/chapters/CH02_BRIEF.md`.
- **Target:** two discs of six chapters, about nine hours each by the bible's own estimate. That number is a
  ceiling, not a promise. See "Cutting" at the bottom.

## The shape of the game

| Ch | Title | Source | Length | Party | Boss | Size |
|---|---|---|---|---|---|---|
| 1 | Coagulation | Episode 0 | 70 min | Lucky, Phoenix, Brian, Ryan | The Set at Palmer's | shipped |
| 2 | Gig in the Potato Belt | Issue 1 | 1.5 h | Lucky, Phoenix, Diego, Warner | Riot Drones, "The Riot Solo" | M |
| 3 | The Merch Table Incident / Eat the Rich | Issues 2 and 3 | 2 h | + Sticky, minus Warner | The Great Tuber; the Reinforced Dome | XL |
| 4 | Battle of the Bands | Issue 4 | 1.5 h | Lucky, Phoenix, Diego, Sticky; Bajonka playable | Alibi's band, then the Judges' Table | L |
| 5 | The Acoustic Embargo | Issues 5 and 6 | 1.5 h | same; Phoenix solo; Sticky solo | Kevin (The Audit); the Osmium Dozen | XL |
| 6 | Planets Collide | Planets Collide | 1 h | Lucky, Phoenix, Diego, Sticky | Kurt (unwinnable) | M |
| 7 | The Luthier of Debris | Grand Finale + new | 1.5 h | Lucky with no guitar; Shannon guest | Repo-Mech and Salvage Swarm | L |
| 8 | The Golem's Grief | new | 1.5 h | Diego leads | Sludge Duel II | M |
| 9 | Planet California | new | 2 h | Lucky, Phoenix, Diego, Sticky | Dad, "Quarterly Performance Review" | L |
| 10 | Because They Suck | new | 2 h | + Alibi guest | Brian; the Retention Unit; the rider | XL |
| 11 | The Epstein Protocol | Grand Finale | 2 h | Bajonka solo, then the band without Diego | P.E.T.E.; MIC CHECK side quest | XL |
| 12 | The Elephant in the Room | Grand Finale | 1.5 h | Lucky on voice, Phoenix, STICKY-R, Diego, David | Darnell Trunk, three phases | L |

Size is relative effort: how many new systems and bespoke scenes the chapter needs, not how long it plays.

## Foundations (do these before Chapter 2)

Small, and all of it pays off twelve times. One pull request.

1. **Chapter boundaries.** Chapter 1 ends by saving and going to the title. CONTINUE on a save with
   `flags.ch1Complete` must start Chapter 2. Give every chapter an entry script (`ch02_start`) and one place that
   maps "chapter complete" to "next chapter's entry".
2. **Save versioning.** The save has `version: 1`. Add a migration step on load so a Chapter 1 save keeps working
   as the state grows. Never break an old save. Test it with a real end-of-Chapter-1 save checked in as a fixture.
3. **A way to start anywhere.** The tests already seed state through `window.__slime`. Add one seeded state per
   chapter start (party, levels, inventory, flags) so a chapter can be built and tested without replaying the
   ones before it. Keep these fixtures honest: generate them from a real playthrough, do not hand-write them.
4. **Naming.** Chapter 1's data uses the `ep0_` prefix. Leave it. From Chapter 2 on use `ch02_`, `ch03_` and so
   on for maps, scripts, NPC files, encounters and songs.
5. **Split the scripted battles.** `src/engine/battle/BattleScripts.js` becomes a folder with one module per
   chapter and an index. No behavior change.
6. **Tests by chapter.** Let the runner take a chapter (`npm test -- --chapter 2`) so the loop stays fast. The
   full run stays the gate for a merge.
7. **Start banking the crowd.** The ending pays out every chapter's crowd (see Chapter 12). Add `vars.crowdBank`
   now and add to it at every gig from Chapter 2 on. Chapter 1's Palmer's set can seed it.
8. **The Pothole Invoice.** The bible gives it to Lucky in the alley and it rides in the inventory to the
   credits. Chapter 1 never built it. Add the key item, grant it in the alley scene, and have the save migration
   grant it to existing saves.
9. **`docs/chapters/`.** One brief and one design spec per chapter live here.

## Systems, and the chapter that first needs each

Build a system in the chapter that first needs it, and build it to be reused. Do not build ahead.

| System | First needed | Used again |
|---|---|---|
| Beat-timed input in battle (a visible beat, a timing window) | Ch 2, the crash cymbal | Ch 4, Ch 8 (slow beat), Ch 9 (count-in), Ch 10, Ch 12 |
| Bespoke minigame scenes (like `FreefallScene`) | Ch 2, zero-gravity parking | Ch 3 networking, Ch 5 paperwork, Ch 12 ROLL |
| Vehicle travel between locations | Ch 2, the space-van | Ch 8 on: Kurt is the vehicle; Ch 9: the billboard |
| Party members who start a fight unavailable and are rallied | Ch 2, HIDING and CONFUSED | Ch 6 REVERENT |
| Field statuses from the map (MELTING) | Ch 2 | Ch 5 puddle form |
| A deadline on the HUD (eviction clock) | Ch 2, shown; Ch 3, live | Ch 4, Ch 5 |
| A map-wide NOISE meter that punishes loud actions | Ch 3, the Library | Ch 5, the Panopticon; Ch 5 Osmium Dozen |
| TALK (Diego's command; a dialogue tree as an attack) | Ch 3 | Ch 8 COMMUNE; gone in Ch 11 |
| Enemy that grows when attacked | Ch 3, the Great Tuber | |
| The 13-step grid (Sticky's turns on an odd meter) | Ch 3 | Ch 4, Ch 10, Ch 11 (STICKY-R), Ch 12 |
| A timer bar racing a shield bar | Ch 3, the Dome | Ch 5 embargo clock |
| Solo-character chapters with their own verbs | Ch 4, Bajonka | Ch 5 Phoenix and Sticky; Ch 11 Bajonka |
| A boss with no HP (a meter you fill by playing wrong) | Ch 4, THE FINGER | Ch 8 |
| Locked commands (RIFF greyed out) | Ch 4 stinger | Ch 5, Ch 7, Ch 9 beam |
| Form toggle (Cyan Phoenix) | Ch 5 | Disc 2 |
| A fight that cannot be won, with honest numbers | Ch 6 | |
| Disc flip: INTERMISSION, fake cartridge card, save relabel | Ch 6 | |
| Terms and Conditions (build attacks from a word bank) | Ch 7 | Ch 12 |
| READ on the save prompt (Bajonka's clipboard has pages) | Ch 7 | Ch 10, the rider |
| Win by matching, lose by damage | Ch 8 | |
| Balloons that cover the UI and must be slapped | Ch 9 (the pod-bay slap from Ch 1, grown up) | |
| Invoices debited on screen | Ch 9 stinger | Ch 10 MISSED CUE |
| CALL THE CHANGE (Lucky sets the meter each round) | Ch 10 | Ch 12 |
| A guest party member with a fixed kit | Ch 10, Alibi | Ch 12, David |
| A person you cannot attack | Ch 10, the rider | |
| A summon (SPOUSAL PRIVILEGE) | Ch 10, one branch | Ch 11, Ch 12 |
| Lucky "clear": no color, no crits, flat count-ins | Ch 11 | Ch 12 until Phase 3 |
| Postcards at save points | Ch 11 | |
| Optional side quest with its own hub | Ch 11, MIC CHECK | |
| A boss phase solved in the options menu or by a drag | Ch 12 | |

## The chapters

Each entry: what is new to build, what it reads from earlier chapters, what it plants for later ones, and what
Lucky still has to decide. The beats themselves are in the bible and are not repeated here.

### Chapter 2: Gig in the Potato Belt

Brief: `docs/chapters/CH02_BRIEF.md`.

### Chapter 3: The Merch Table Incident / Eat the Rich

- **New:** NOISE meter and Shush; TALK; the Great Tuber (grows when hit, only TALK lowers Insecurity); a battle
  that is supposed to go badly (the Tantrum set, inputs degrade); the eviction clock goes live; networking
  minigame; Sticky and the 13-step grid; the Dome (SHIELD against DONENESS, Shannon heckling as a debuff).
- **Reads:** the sack of potatoes and the eviction warning from Chapter 2.
- **Plants:** Little Guy (rides to the end). THE TRUNK FUND business card. The mop-dog in a security vest. Pete
  moves in. Alibi's first contempt. Lucky signs a contract without reading it.
- **Party change:** Warner leaves at the dock. Sticky joins and stays for good.
- **Watch:** two bosses and two full locations in one chapter. Split the build at the dock.

### Chapter 4: Battle of the Bands

- **New:** playable Bajonka, silent, with traps (a sequence scripted to fail); dueling sets where the enemy is on
  a 4/4 grid and the party is on 13/8; THE FINGER, a meter with no enemy HP that fills on messy inputs.
- **Plants, all required:** Greg and "I play the root notes." Greg's bass is breathing and nobody mentions it.
  Phoenix: "My brain thinks that's a nicer bass than mine." The XXX-666 under a dust cover on Alibi's riser. The
  bracket board: KURT BREEZESTEIN, DISQUALIFIED (EXCESSIVE TONNAGE). Bajonka's claymore fails here so it can
  work in Chapter 11.
- **Ends:** RIFF greys out. DAY 1 / 30.

### Chapter 5: The Acoustic Embargo

- **New:** a chapter with no music. Every action has a decibel cost against the PANOPTICON meter. Lucky as a
  puddle (moves through gaps, cannot fight). Cyan Phoenix. A jargon duel (buzzwords as cards). The paperwork
  minigame, with a stamp hidden in another menu. Sticky's silent solo fight where NOISE replaces HP.
- **Plants:** the packing slip, QTY 13, SHIPPED 12. Pete's reveal.
- **Watch:** the largest count of one-off systems in Disc 1. Spec the cuts before building.

### Chapter 6: Planets Collide

- **New:** the unwinnable Sludge Duel. Standard boss UI, honest damage numbers, a bar labeled GRAVITY that
  climbs regardless. ONE MORE CHORD. INTERMISSION for ten unskippable seconds. The fake PLEASE TURN THE
  CARTRIDGE OVER card. The save slot relabels itself DISC 2.
- **Loses:** the apartment, the van, the planet, the laser guitar. Lucky's instrument slot reads a blank dash.
  Phoenix's reads SYNTH.
- **Plants:** Bajonka saved the Tinny Ride Cymbal and not the guitar case.
- **Rule:** the HUD never fakes a number in this fight. The only lies are the label and the cartridge card.

### Chapter 7: The Luthier of Debris

- **New:** Lucky with no RIFF. Terms and Conditions: shouted clauses become physical blocks, longer clauses hit
  harder and cost Breath, and the swarm "accepts" any clause used twice. The hubcap guitar is forged mid-fight.
  The save prompt gains READ.
- **Plants:** Phoenix's four synth notes, which finish as a bassline in Chapter 12. The voice is already the
  weapon here. Chapter 12 pays that off.

### Chapter 8: The Golem's Grief

- **New:** Sludge Duel II. Winning by damage is a game over with its own card. The real win is matching Kurt:
  slow-beat input, Phoenix's drone, Diego's COMMUNE, and Sticky's job is to not play. Kurt becomes the vehicle.
- **Plants:** the zine pull-quote on the bulletin feed. Lucky does not see it. Phoenix closes the feed.

### Chapter 9: Planet California

- **New:** Dad's fight. Intercom balloons grow while he talks, cover the battle UI, and must be slapped
  mid-sentence. Rebuttals heal him. The roof: commands grey out one by one, then come back, and the count-in is
  the timing window. Bajonka's first invoice is debited on screen.
- **Reads:** the pod-bay slap from Chapter 1. `vars.billboardsTagged` from the freefall, if it is cheap to honor.
- **Never cut:** UNIT 3. NOW LEASING. The missing billboard and the four bolts. The clipping left on the carpet.
- **Lucky decides:** whether invoices take real money (bible open question 4).

### Chapter 10: Because They Suck

- **New:** Brian's fight, won by never speaking. The Retention Unit, with CALL THE CHANGE. Alibi as a guest.
  The fence. Then the rider: see `docs/SUBPLOT_BAJONKA_RIDER.md` for both branches, the ceremony, the fight
  Lucky cannot win, and the summon.
- **Reads:** the Tinny Ride Cymbal (it leaves the inventory here). The denim heckle and Zerkel Pit from Chapter
  1: "because they suck" is on the gift-shop mug.
- **Lucky decides:** bible open questions 1, 2 and 5, and the four open questions in the rider doc.
- **Gate:** the ceremony needs a read from someone who grew up with Thai weddings before it is built.

### Chapter 11: The Epstein Protocol

- **New:** Lucky clear. Bajonka's stealth infiltration and her duel with Pete (no HP numbers, no music). The
  Soy Boys. STICKY-R. Postcards from Diego at each save point. The optional MIC CHECK side quest: see
  `docs/SIDEQUEST_MIC_CHECK.md`.
- **Absent:** Diego, so no TALK.
- **Lucky decides:** bible open questions 7 and 8.

### Chapter 12: The Elephant in the Room

- **New:** five people on stage (decide in the spec how the fifth slot works; David is a guest). The Paywall.
  The Golden Throne. The fourth-wall break. The ending is V1, "Roll Him Up", with V3's banked crowd underneath:
  `vars.crowdBank` is the Phase 3 damage. The collage behind the elephant deliberately breaks the palette rule.
- **Reads:** everything. MIGRAINE if MIC CHECK was done. Where Bajonka sits depends on the rider.
- **Lucky decides:** bible open questions 3 and 6.
- **Art rule:** the photo collage is implied, never named, and uses no real person's likeness.

## Carry-over ledger

What one chapter writes and a later one reads. Add a row whenever a chapter creates state a later chapter needs.

| State | Written | Read | Notes |
|---|---|---|---|
| `flags.ch1Complete` | Ch 1 end | Foundations | starts Chapter 2 |
| `vars.quitResponse` (0 RAGE, 1 PLEAD, 2 JOKE) | Ch 1 | Ch 2 | Phoenix remembers which one, once |
| `flags.eternityChoice`, `flags.letGo` | Ch 1, THE SET | Ch 10 (optional line at the fence) | |
| `vars.zerkelChoice`, `flags.zerkelLetGo` | Ch 1 | Ch 10 (optional) | Lucky let it go either way |
| `vars.billboardsTagged` | Ch 1 freefall | Ch 9 (optional) | |
| Pothole Invoice (key item) | Ch 1 (added in Foundations) | every chapter; Ch 8 adds LATE FEE; post-credits adds a surcharge | never payable, never leaves |
| Tinny Ride Cymbal | Ch 1 | Ch 6 (saved), Ch 10 (hung on the wire) | never pays off mechanically, on purpose |
| `vars.crowdBank` | every gig from Ch 2 | Ch 12 Phase 3 | |
| Little Guy | Ch 3 | cup holder to the end; Ch 11 goes with Diego | |
| Contract signed unread | Ch 3 | Ch 7 (Lucky reads every page) | |
| The XXX-666 | Ch 4 seen, Ch 5 slip, Ch 10 burnt out | Ch 11 STICKY-R | thirteenth of a baker's dozen |
| Greg's bass | Ch 4 | Ch 12 | it is a rascal |
| Phoenix's four notes | Ch 7 | Ch 12 | |
| The zine quote | Ch 8 | Ch 9 | Phoenix hid it |
| The beam core | Ch 9 (Bajonka keeps it) | Ch 11 (set by the amp), Ch 12 (the nuclear amplifier) | |
| The rider: yes or no | Ch 10 | Ch 11 (the ring, the salute), Ch 12 (where Bajonka sits), the summon | |
| MIC CHECK done | Ch 11 | Ch 12 MIGRAINE | Lucky sings either way |

## Decisions Lucky owes, and by when

Use the bible's Default until Lucky answers. Ask again when the chapter's spec is written.

| Before | Question | Where |
|---|---|---|
| Ch 4 | The rascal's origin (it changes Greg's first scene) | bible open question 6 |
| Ch 9 | Do invoices take real money | bible 4 |
| Ch 10 | The second boss; Ryan's one caption; where STICKY-R happens | bible 1, 2, 5 |
| Ch 10 | Trace of Mom; backing out mid-fight; the cymbal answer; the lady in the summon | rider doc |
| Ch 10 | A cultural read of the ceremony | rider doc, "Before this ships" |
| Ch 11 | Diego's postcards; how David gets there | bible 7, 8 |
| Ch 12 | How Greg's bass reaches the yacht | bible 3 |
| Any time | Zerkel Pit as a playable gig in Chapter 1 | bible 9 |

Question 8 has an early version: if David should be met before the last chapter, a VFW gig has to exist by
Chapter 8 or 9. Raise it when Chapter 8 is specced.

## Cutting

Eighteen hours is the bible's number. The game does not need to hit it.

- Cut length before cutting beats. A chapter can lose a map, a hub fight or a minigame and keep its story.
- Each chapter's spec lists its cuts in order, the way `docs/DESIGN.md` does under "Risks & cuts".
- Never cut a row from the "Plants" lists above without checking what reads it.
- Never cut: a chapter's stinger, a party member joining or leaving, a boss's one rule, anything in the bible's
  mirror table.
