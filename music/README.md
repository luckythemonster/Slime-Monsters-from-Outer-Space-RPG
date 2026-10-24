# music/ — the Dead Planet Demos as MIDI and as chiptune covers

Six band recordings ("Slime Monsters from Outer Space — Dead Planet Demos", 320 kbps MP3s, not in the
repo) went through `tools/audio_to_midi.py` (transcription, this folder) and `tools/midi_to_song.py`
(reduction to the engine's four voices, `src/audio/songs/band_*.js`). `tools/README.md` has the commands;
`src/audio/README.md` the song format. Every number below comes from the pipeline, not from ears:
nobody on this side could listen, so the "recognizable?" notes are honest guesses from what the stems and
the reductions contain.

## Pipeline (Plan A: Spleeter 4stems, used for all six)

1. ffmpeg → 44.1 kHz WAV. **Spleeter 4stems** (vocals / drums / bass / other; the v1.4.0 GitHub model) in a
   child process (its TF v1 session breaks basic-pitch's model loading in the same process).
2. **Beats** on the drums stem (librosa DP tracker, prior 170 BPM), nudged ~23 ms earlier onto the drum
   attacks, a half-time check on the kick pattern (Eclipse was tracked at 86 and doubled), downbeat phase
   from kick-on-1/3, snare-on-2/4 and chord-change votes, beats extrapolated through intros/outros, and a
   tempo map from a 16-beat window (one `set_tempo` per change > 1.5 BPM).
3. **Pitches**: basic-pitch on vocals (onset 0.4 / frame 0.25 / 80 ms), bass and other (0.5 / 0.3 / 70 ms).
   When the harmonic stems sit ≥ 22 cents off A440 the stems are pitch-shifted onto the grid first
   (`retuned_before_transcription` in the JSON; only Monsters at −28 cents).
4. **Drums**: onset detection, kick / snare / closed hat / open hat / crash by band energy normalized per band
   (kick < 150 Hz, snare 200–2500 Hz, hats > 5 kHz; crash = loud + still ringing at 250 ms), GM 36/38/42/46/49.
5. Everything is quantized to a 16th grid relative to the tracked beats (a drifting demo lands on the grid;
   the tempo map keeps the MIDI in time with the recording). Sections: Foote novelty on bar-synchronous
   chroma + MFCC, labelled A/B/C by similarity; markers in the MIDI, `sections` in the JSON.
6. Key: Krumhansl-Schmuckler on the harmonic stems' chroma (the `key_confidence` is the correlation).

Per song: `midi/<name>/<name>.mid` (Vocals ch 1, Guitar (other) ch 2, Bass ch 3, Drums ch 10, tempo map,
time signature, section markers), `<name>_{vocals,guitar,bass,drums}.mid`, `<name>.json`.

### Reduction to the engine (`tools/midi_to_song.py`)

pulse1 (50 %) = the vocal line, monophonic on an 8th grid, shifted up an octave and folded into C4..D6 with
octave leaps folded back; in bars with no vocal it doubles the riff an octave up. pulse2 (25 %) = the riff:
a chord root per beat (lowest strong onset, pitch-class vote, power-chord aware), 8th-note downstrokes with
the fifth on the off-8th of beats 2 and 4. tri = root 8ths an octave down (from the bass stem only when it
agrees with the guitar; here that was only Monsters), held through short rests as a bed. noise = kit
(crash > snare > kick, one per step, lone odd-16th hits moved to the 8th, a crash on each section start);
hats = closed hats on every 8th in bars where the kit plays plus the detected open hats. Identical bars share
a pattern. The arrangement is a hand-picked set of transcription bars (`--bars`), 32–48 bars per song.

Previews (128 kbps MP3 of the engine's own offline render, `tools/render_song.mjs` → ffmpeg):
`<scratchpad>/covers/<name>_chiptune.mp3` — not committed; re-render with `node tools/render_song.mjs band_<name>`.

## The songs

Fidelity numbers are the reduction against the transcription over the chosen bars (how much survived the
squeeze into four voices), not against the recording.

| song | BPM (range) | key (conf.) | length / bars | stems: vocal / guitar / bass notes, drum hits | cover id, bars (loop) | vocal onsets kept / kick+snare kept |
|---|---|---|---|---|---|---|
| 01 Spud Nothin | 140 (136–142) | D# minor (0.55), +20 ¢ | 2:31, 90 | **7** / 1703 / 215, 570 (175 k 173 s 209 h) | `band_spud_nothin`, 32 (55 s) | — (instrumental) / 97 % |
| 02 They Came from the Sky | 120 (119–125) | B major (0.54) | 2:08, 65 | 287 / 893 / 421, 629 (237 k 135 s 104 o 24 c) | `band_they_came_from_the_sky`, 40 (80 s) | 80 % / 95 % |
| 03 Hunger | 130 (129–130, dead steady) | B major (0.76), +17 ¢ | 2:23, 78 | 154 / 998 / 246, 532 (216 k 127 s 184 h) | `band_hunger`, 40 (74 s) | 93 % / 96 % |
| 04 Red Star Vanguard | 160 (159–162) | B major (0.66) | 3:30, 141 | 146 / 1093 / 231, 743 (303 k 101 s 293 h 43 o) | `band_red_star_vanguard`, 48 (72 s + 12 s intro) | 94 % / 99 % |
| 05 Eclipse of Liberation | 170 (165–182, pushes) | F# minor (0.81) | 2:14, 97 | 67 / 729 / 181, 541 (187 k 107 s 233 h) | `band_eclipse_of_liberation`, 48 (68 s) | 89 % / 96 % |
| 06 Monsters | 164 nominal (156–169, loose) | G major? (0.46), **−28 ¢** | 2:05, 86 | 56 / 298 / 360, 622 (181 k 174 s 171 h 88 o) | `band_monsters`, 32 (47 s) | 92 % / 36 % (kit regularized) |

### 01 Spud Nothin — `band_spud_nothin` (140 BPM, D# minor)
- Sections: drum intro 0–3; verse riff A 4–11 (D#5 chug: `D# . D# . D# . A#`); B 12–15; A 16–19; C 20–27
  (roots E / B / F# / A — a half step above the verse); A 28–36; B 37–40; A 41–44; C 45–52; A 53–67; C 68–76;
  A 77–89. Cover = bars 4–27 + 45–52 (A A B A C C′).
- Transcribed well: the kit (straight `K...S...K.K.S...` rock beat, fills on the turnarounds), the D# chug and
  its changes to B / A# / G#. Badly: **no vocal anywhere** — the separator's vocal stem is empty for the whole
  track (RMS ≤ 0.003), so either it is an instrumental or the voice is buried in the guitar; pulse1 therefore
  plays the guitar's top voice per beat (54 % of those onsets kept), which is chord tones, not a hook.
- Recognizable? The groove and the riff, yes; the "melody" is invented from the chords. Moderate.
- Most uncertain: the C section a semitone above the verse. The guitar reads +20 cents sharp, so E/B/F#/A
  could be D#/A#/F/G# flipping up; if it is the same key to your ears, transpose patterns R/B of bars 20–27
  and 45–52 down one semitone.

### 02 They Came from the Sky — `band_they_came_from_the_sky` (120 BPM, B major)
- Sections: riff + vocal from bar 1 (A 0–8), B 9–16, A 17–58 (verse/chorus alternations the segmenter did not
  split), outro 59–63. Riff B – A – G# (`B . B . B . F# | B . B . D# . D# | A . A . B . F#`), d-beat kick
  (1, 1&, 3, 3&), snare 2 and 4, open hats. Cover = bars 1–32 + 44–51.
- Transcribed well: the vocal (287 notes, F#4–A4 with the chorus leaping to F#5/A5; 80 % reproduced, pitch-class
  cosine 1.0 against the stem), the riff, the kit (95 %). Badly: the bass stem is bleed (12 % of its notes on
  the chord root), so the triangle is the guitar root an octave down.
- Recognizable? Probably the best of the six: a real vocal line on pulse1 in 36 of 40 bars over the right riff
  and drums.
- Most uncertain: 120 vs 240 — the kick plays 8ths and the snare sits on 2 and 4 at 120, which is consistent,
  but if the band counts it at double time nothing in the cover changes except the `bpm` field.

### 03 Hunger — `band_hunger` (130 BPM, B major)
- Sections: guitar intro 0–6 (kit from bar 2), verse B 7–13 (vocal), C 14–21 (E / F# / G / D riff), A 22–29
  (vocal), C 30–36, A 37–49 (instrumental), B 50–55, A 56–63 (vocal), outro D 68–76 (guitar alone).
  Cover = bars 2–33 + 56–63. The whole song is a B5 chug with an A#5 (Bb) slide a half step down.
- Transcribed well: everything rhythmic — the tempo is dead steady (one tempo-map entry), 96 % of kick/snare,
  the riff (82 % of guitar notes on root or fifth), the bass agrees with the guitar (0.94). The vocal is 154
  notes, mostly a shouted G#4/A4 on one or two pitches, 93 % reproduced.
- Recognizable? High for the riff and the drums; the vocal is more rhythm than tune, so pulse1 is a shout line.
- Most uncertain: the A#5 chord — the transcription splits it between A#2 and F3; the cover plays A# with F
  as the fifth. If the slide is really B → A → B, change `A#3`/`F3` in patterns R6–R8/B5.

### 04 Red Star Vanguard — `band_red_star_vanguard` (160 BPM, B major)
- Sections (3:30, the long one): clean picked intro 0–16 without drums (A#-based: A# / C# / F / D#), band in
  at bar 17 (C), D 28–31, C 32–48, E 49–63 (quieter, kick + hats), C 64–72, F 73–80 (A-based: A / C# / D / F#),
  C 81–109, G 110–131 (G-based), H 132–140 outro. Cover = bars 8–15 (intro, plays once: `loopStart: 8`) +
  17–24 + 32–47 + 64–71 + 73–80.
- Transcribed well: the march-like kit (`K...K...K...S...`: kick 1-2-3, snare 4, hats; 99 % kept), the vocal
  (146 notes, A4-centred; 94 %, cosine 0.97), the B / F# / E / D# changes. Badly: the clean intro reads a
  semitone under the band (A# vs B) — either a real Bb intro or the undistorted guitar reading flat.
- Recognizable? Medium-high: the verse vocal and the chug are there; the intro is the weakest guess.
- Most uncertain: that intro key, and whether the snare-on-4 feel is really a half-time 80 BPM with the snare
  on 3 (same notes, different count).

### 05 Eclipse of Liberation — `band_eclipse_of_liberation` (170 BPM, F# minor)
- Sections: intro riff + hats A 0–15, full d-beat B 16–24, verse A 25–31 (hats only), B 32–48, A 49–56,
  B 57–64, A 65–73, B 74–89, outro 90–96. Riff C# / F# / B / E (`C# . C# | F# . F# . F# | B . B . E . E`).
  Cover = bars 8–47 + 57–64.
- Transcribed well: the kit once the classifier stopped calling the bright snare a hat (`K.K.S.K.K...S...`,
  96 %), the riff (82 % on root/fifth). Badly: the vocal stem is thin — 67 notes in 2:14 (89 % of them kept, cosine
  0.95), so pulse1 doubles the riff an octave up in 29 of the 48 bars. The drummer pushes from 165 to 182 BPM;
  the cover is flat at 170.
- Recognizable? Medium: drums and riff, with a vocal that only surfaces in the choruses.
- Most uncertain: the beat tracker first locked onto the snare backbeat at 86 BPM and the doubling is what
  fixed it; the quiet verses (hats + guitar) are also where the section labels are least trustworthy.

### 06 Monsters — `band_monsters` (164 BPM nominal, G?)
- The loose one: no click (28 tempo-map entries, hit intervals 160–580 ms), the whole band ~28 cents flat (the
  stems were retuned before transcription), the guitar stem sparse and noisy (298 notes), the bass carrying the
  song (360 notes: G / A / B, C / G, E / G#). Sections: intro A 0–16 (bass + drums), B 17–42, C 43–47 (the
  C-based part), B 48–75, D 80–85. Cover = bars 24–55, roots from the bass, triangle = the bass stem (98 %
  pitch-class match), kit **regularized** to rock / d-beat by hit density because the detected hits do not
  quantize (only 36 % of them survive as-is).
- Transcribed well: the bass line and the few vocal phrases (56 notes, 92 % kept). Badly: the drums, the
  guitar, the key (0.46 confidence: G or A).
- Recognizable? Low to medium — the bass motion is right, the groove is a guess.
- Most uncertain: the grid itself; if the song is felt at ~82 BPM half-time, halve `bpm` and the drums read
  differently.

## What needs a human in Logic

- Vocals: every lead is a monophonic reduction of a separated, quiet, shouted vocal; the pitch classes are
  right (cosine 0.95–1.0 where there is a stem) but the phrasing is 8th-note blocks. Sing the hooks into
  the pattern strings by hand (`src/audio/README.md` tips), or open `midi/<name>/<name>_vocals.mid`.
- Chords: the riff is "root per beat + fifth"; third-less by design. Anything with a real chord voicing
  (the Red Star intro, Hunger's C section, Spud Nothin's chorus) is a guess — check the roots in
  `<name>_guitar.mid` against the recording.
- Drums: kick/snare/hat/crash only; toms become kicks or snares, fills are whatever the onset detector saw.
- Tempo: the covers are at the median BPM; the MIDIs carry the real tempo map. Monsters and Eclipse drift.
- Keys/tuning: tuning offsets are in each JSON (`tuning_semitones`); +17/+20 cents (Hunger, Spud) is enough
  to flip single notes a semitone in the polyphonic guitar transcription — the covers' root motion was taken
  from the beat-level vote, which is more robust than single notes but not immune.
