# `src/audio/` — the synthesized sound engine

Everything the game plays is generated at runtime with WebAudio. No audio files.
The binding contract is `docs/ARCHITECTURE.md` §7; this file is the practical guide.

| File | What it is |
|---|---|
| `AudioEngine.js` | The front door: `playMusic`, `stopMusic`, `sfx`, `setVolume`, `mute`, `resume`, `registerSong`. One per game (`services.audio`). |
| `Sequencer.js` | Plays one song object with lookahead scheduling; exposes beat position and `tick` events. |
| `Synth.js` | Voice factory: pulse (12.5/25/50 %), triangle, sawtooth, sine, noise, and the five drums. |
| `sfx.js` | The 20 named sound-effect recipes. |
| `songs/<id>.js` | One song per file, registered in `songs/index.js`. |

## Wiring it up

```js
import { AudioEngine } from './audio/AudioEngine.js';

// In BootScene, from Phaser's sound manager (so Phaser's unlock-on-input and mute apply):
services.audio = AudioEngine.fromPhaser(game.sound);
// …or anywhere, with an explicit context/destination (any BaseAudioContext works):
const audio = new AudioEngine({ context, destination });
// …or let the engine own a context (it resumes itself on the first key/pointer event):
const audio = new AudioEngine();

audio.playMusic('snow', { fade: 0.5 });   // crossfades from whatever was playing
audio.sfx('confirm');
audio.setVolume({ music: 0.6, sfx: 0.9 }); // also setVolume(0.6, 0.9)
audio.mute(true);
audio.stopMusic({ fade: 1 });
```

Songs from `songs/index.js` are registered automatically; `audio.registerSong(song)` adds more
(it validates the song and throws a message listing every problem).

Beat-synced gameplay: `audio.sequencer.position` → `{ step, songStep, bar, beat, stepInBar,
stepInBeat, onBeat, loops, time }` (computed from the audio clock, so it is exact), or
`audio.sequencer.on('tick', pos => …)` which fires once per 16th step from the 25 ms timer.

## Song format (annotated)

```js
// src/audio/songs/example.js
export default {
  id: 'example',          // the id used by playMusic / map "music" fields
  title: 'Example Song',  // optional, for humans
  bpm: 150,
  beatsPerBar: 4,         // time signature numerator (3 for a waltz, 7 w/ stepsPerBeat 2 for 7/8)
  stepsPerBeat: 4,        // 4 = 16th-note grid; every pattern token is one step
  loop: true,             // false = play once and emit 'end'
  loopStart: 0,           // optional: bar index to jump back to (1 = bars before it are an intro)
  volume: 1,              // optional master multiplier for this song

  channels: {
    //  name  : { wave, duty?, volume, env?, vibrato?, transpose?, octave?, patterns }
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.4,
      env: { attack: 0.003, decay: 0.03, sustain: 0.85, release: 0.03 },  // optional ADSR (seconds / 0-1)
      vibrato: { rate: 6, depth: 14, delay: 0.1 },                        // optional (Hz, cents, seconds)
      patterns: {
        // one bar = beatsPerBar * stepsPerBeat tokens (16 here). '|' is ignored (use it to mark beats).
        A: 'C4 . C4 . E4 . G4 . | C5 = = = . . G4~ =',
        //  ^    rest  ^ held for 4 steps (= = =)    ^ slide into G4 from C5
      },
    },
    pulse2: { wave: 'pulse', duty: 0.25, volume: 0.3, patterns: { A: 'E5 = = . E5 = = . | G5 = E5 = C5 = = =' } },
    tri:    { wave: 'triangle', volume: 0.6, patterns: { A: 'C2 . C2 . C2 . C3 . | C2 . C2 . G2 . G2 .' } },
    noise:  { wave: 'noise', volume: 0.35, patterns: { A: 'k . h . s . h . | k . k . s . h o' } },
  },

  order: [                                   // one entry per bar; a missing channel is silent that bar
    { pulse1: 'A', pulse2: 'A', tri: 'A', noise: 'A' },
    { pulse1: 'A', tri: 'A', noise: 'A' },   // pulse2 rests this bar
  ],
};
```

### Tokens

| Token | Melodic channels (`pulse`, `triangle`, `sawtooth`, `sine`) | Noise channel |
|---|---|---|
| `C4` … `B8` | play the note (sharps `C#4`, flats `Db4`; octave 0–9) | — |
| `.` | rest (the previous note releases) | rest |
| `=` | hold the previous note one more step (works across bars) | ignored |
| `C4~` | slide into C4 from the previous note on this channel | — |
| `C4!` | accent (×1.4 volume); combine as `C4~!` | `k!` accent |
| `k s h o c` | — | kick, snare, closed hat, open hat, crash |
| `\|` | ignored (visual beat separator) | ignored |

Waves: `pulse` (with `duty` 0.125 / 0.25 / 0.5), `triangle`, `sawtooth`, `sine`, `noise`.
Volumes are linear gain; keep the per-channel sum around 1.3–1.6 (there is a soft limiter, but
hard clipping sounds bad). Optional channel fields: `env`, `vibrato`, `transpose` (semitones),
`octave` (±1), `detune` (cents), `slideTime` (seconds, default ≈ 90 % of a step, max 80 ms).

Validation is strict: every pattern must have exactly `beatsPerBar * stepsPerBeat` tokens, and
`order` may only name channels and patterns that exist. `validateSong(song)` returns the list of
problems; `registerSong` throws them. `tests/audio.mjs` validates every song in `songs/index.js`.

## How the timing works

- Step N starts at `startTime + N * (60 / bpm / stepsPerBeat)` on `audioContext.currentTime`;
  nothing is accumulated from timer callbacks, so there is no drift.
- A 25 ms `setTimeout` loop schedules every step that starts within the next 100 ms.
- Looping keeps the absolute step counter running and only wraps the *song* step, so loops are
  sample-accurate and gap-free. With `loopStart` the bars before it play once.
- Hidden tab: the lookahead grows to 1.5 s because Chrome throttles timers. If the context is
  suspended (Phaser does this on blur), the audio clock freezes too, so playback resumes in place.
- Offline: `AudioEngine.renderOffline({ music: 'title', seconds: 12 })` renders through a full
  engine into an `OfflineAudioContext` and returns `{ buffer, rms, peak }` — what the tests use.

## Writing songs: tips

1. Write chord roots on `tri` first, then the riff, then the lead; check `node tests/audio.mjs`
   after each channel (it fails on a 15-token bar with the pattern name and step).
2. Use `|` every 8 tokens so you can count. Copy a working bar and edit it.
3. `=` is your friend: `C5 = = =` is a quarter note on a 16th grid. For staccato 8ths use `C5 .`.
4. One drum per step per noise channel — if you need hat + kick on the same step, add a second
   noise channel (`hats: { wave: 'noise', … }`); channel names are free.
5. Keep leads between C4 and C7 and basses between E2 and E4; lower sounds muddy on laptops.
6. A `~` slide starts from the *previous note on that channel*, so put a real note before it.
7. For an intro, write it as bar 0 and set `loopStart: 1`.

## Chapter 1 cue table

Ids follow `docs/DESIGN.md` "Audio" (which took them from `design_feel.md`). The other docs' names are **aliases** (`ALIASES` in `songs/index.js`): one song
object under several ids. `audio.playMusic('hub')` plays `west_bank`, `hasSong('hub')` is true,
`currentMusic` always reports the canonical id, and `resolveSongId('hub')` → `'west_bank'`.
`registerAlias(alias, id)` adds one at runtime. Map `"music"` fields may use either name.

| id | Scene | BPM / meter | Bars | Loop (s) | Loop | Aliases | Notes |
|---|---|---|---|---|---|---|---|
| `title` | Title | 190, 4/4 | 8 | 10.1 | yes | — | A–D–E–D Ramones riff. |
| `dental_plan` | Pod bay | 100, 4/4 | 8 | 19.2 | yes | `pod_bay`, `podbay` | C major ii–V–I muzak; 12.5 % pulses in parallel sixths, walking tri, brush hats; the brand jingle is bar 8 (every 8 bars). |
| `flying_squirrel` | Freefall | 200, 4/4 | 16 | 19.2 | yes | `freefall` | Cmaj7/Am9/Fmaj7/G arpeggios, 0.35 s portamento lead, C→G tri pedal, no drums. |
| `pothole` | Alley | 92, 6/8 (6×2) | 8 | 31.3 | yes | — | A minor; dragging tri bass, a two-note sigh every 4 bars, open-hat wind at 0.08. |
| `snow` | Alley / streets | 110, 4/4 | 8 | 17.5 | yes | `snow_night` | |
| `unpaid_bills` | Apartment | 120, 4/4 | 16 (`loopStart: 8`) | 16.0 (32 first pass) | yes | `apartment` | Dm9 Gm7 Bbmaj7 A7 lo-fi; bars 0–3 bass+kit, 4–7 +chords, melody from bar 8; tape-hiss bed. |
| `ask_the_universe` | Signal montage | 150, 3/4 | 20 | 24.0 | **no** | `signal` | E drone; 8 drone channels widen 0→60 cents, tri climbs two octaves, noise crescendo, pulses wrench up an octave, ends on a held tri E3. |
| `northern_garage` | Garage | 60, 4/4 | 4 | 16.0 | yes | `garage` | Closed hat each beat at 0.1; one tri note every 2 bars (E3, C3). |
| `west_bank` | Streets hub | 170, 4/4 | 16 | 22.6 | yes | `hub` | D major skate-punk; 2-bar riff ×4, chorus bars 8–15 ("WEST BANK" hook), tri octave jumps. |
| `normal_music` | Coffee shop, Brian's rehearsal | 128, 4/4 | 8 | 15.0 | yes | `coffee`, `rehearsal_brian` | G D Em C, 50 % duty, dead on the grid, kick 1/3 snare 2/4, nothing else. |
| `sticker_hallway` | City Sound hallway | 170, 4/4 | 16 | 22.6 | yes | `citysound` | `west_bank` through the door: tri carries the riff (octave down), pulse1 at 0.15, no pulse2, hats only. Built from west_bank's pattern objects. |
| `four_dollars` | Room 4 / AUDITION | 196, 4/4 | 9 (`loopStart: 1`) | 9.8 (+1.2 intro) | yes | `audition` | E minor hardcore; stick-click intro bar, kick every 8th, snare 2/4, 16th fills bars 4 and 8, screamed `!` line. |
| `battle` | Street fights | 200, 4/4 | 9 (`loopStart: 1`) | 9.6 | yes | `battle_noise` | |
| `six_inch_stage` | Palmer's (inside) | 140, 4/4 | 12 | 20.6 | yes | — | A 12-bar boogie, a different band; pulse2 is the vocal. |
| `six_inch_stage_ext` | Palmer's (outside) | 140, 4/4 | 12 | 20.6 | yes | `palmers` | Same object with pulse2 at volume 0. |
| `pocket` | THE SET | 182, 7/8 (7×2) | 16 | 36.9 | yes | `palmers_set`, `the_set` | 3+2+2 riff (accents on 1, 4, 6), tri doubles an octave down, kick 1 and 4, snare 6, fill every 4 bars, pulse2 from bar 9. Exports `RIFF`. |
| `rhythm_achieved` | THE ETERNITY | 60, 7/8 (7×2) | 3 | 21.0 | **no** | `eternity` | Doom half-time: tri E2→D2→C2 slide falls, two 50 % drones ±4 cents, open hat every beat, kick+crash on 1. |
| `plaster_dust` | Rubble | 70, 4/4 | 7 | 24.0 | yes | `rubble` | Triangle alone: the `pocket` riff (R1 R2 R1 R2) in quarter notes. |
| `win_sting` | Victory | 240, 4/4 | 2 | 2.0 | **no** | `victory` | D, E, A stabs on three pulses + crash. |
| `level_up` | Level up | 160, 4/4 | 1 | 1.5 | **no** | — | C5→C7 arpeggio with an echo, crash on the top. |
| `game_over` | Game over | 50, 5/4 | 1 | 6.0 | **no** | `gameover` | The dental_plan jingle in C minor at half speed. |
| `bajonka` | Save | 240, 4/4 | 1 | 1.0 | **no** | — | Two triangle boops (A4, E5); play the `sneeze` SFX first. |

Chapter 1 SFX (40 after the original 20): `caption_tick`, `count_click`, `stick_click`, `eject`, `static_burst`, `crash`,
`pedal_stomp`, `coffee_spill`, `sparks`, `roof_peel`, `wall_blow`, `mohawk_pop`, `intercom_buzz` (2 s; retrigger while
Dad talks), `glitch`, `thud`, `door_slam`, `unplug`, `pop_x3`, `amp_hum`, `krathoom`, `doom` / `crack` / `thud_word`
(the three Eternity words: 40 / 50 / 30 Hz thumps with noise tails; `thud_low` is DESIGN.md's name for `thud_word`),
`van_keys`, `tear`, `toon_up`, `gears`, `splash`, `phone_ring`, `click`, `drone_whine`, `power_chord`, `hair_back`,
`rubble`, `chair`, `jukebox_1..4` (2 s house-system previews). Every recipe returns the seconds until it is
silent; `tests/audio.mjs` renders each one and fails if anything is still sounding 150 ms after that.

### More tips (learned writing the Chapter 1 cues)

8. **12.5 % pulses are not quieter than 50 % ones at the same volume — they peak higher.** The DC-free
   PeriodicWave for duty *d* swings between `2(1−d)` and `−2d`, so a 12.5 % wave peaks at 1.75 (a 50 %
   wave at 1.0). Keep narrow-duty channels around 0.2–0.25 or the limiter will be doing all the work.
   Aim for a limited peak of ≈ 0.9 (`AudioEngine.renderOffline` reports it); the existing songs sit at 0.86–0.96.
9. **The limiter flattens dynamics, so judge a groove with it off**: `renderOffline({ …, limiter: false })`
   and measure 50 ms windows at the beat onsets (that is how the `pocket` test checks the 7/8 kick placement).
10. **Long portamento is a channel setting.** `slideTime` on a channel is passed straight to the synth (the
    80 ms cap only applies to the default), so `slideTime: 0.35` plus `~` notes gives a real swoop
    (`flying_squirrel`); `slideTime: 0.45` on a triangle gives doom "falls" (`rhythm_achieved`).
11. **A channel's static fields cannot change mid-song**, so anything that must evolve (detune widening,
    a noise crescendo) is several channels that take turns in `order` (`ask_the_universe` has eight drones
    and five noise channels; only one of each plays per bar).
12. **Variants are code, not copies.** `sticker_hallway` reuses `west_bank`'s pattern objects, `plaster_dust`
    is built from `pocket`'s exported `RIFF`, and `six_inch_stage_ext` spreads `six_inch_stage` with one
    volume changed; the tests compare the objects by identity so the pairs cannot drift.
13. **Lo-fi gaps need a bed.** The realtime test samples the output every 100 ms and fails on true digital
    silence; a noise channel of overlapping open hats on every 16th at 0.03 is tape hiss and solves it
    (`unpaid_bills`). Deliberately empty cues (`northern_garage`) are listed in the test's `SPARSE_LOOPS`.
14. **One-shots**: `loop: false`, make the last voice end before the song does (the test checks for silence
    0.55 s after `duration`), and pick a tempo that makes the bar count come out right (`game_over` is one
    5/4 bar at 50 BPM = exactly 6 s; `win_sting` is two bars at 240 BPM = 2 s).
