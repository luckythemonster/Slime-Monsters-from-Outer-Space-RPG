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
