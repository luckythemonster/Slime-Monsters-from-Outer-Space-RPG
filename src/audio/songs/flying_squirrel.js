/**
 * flying_squirrel — "Flying Squirrel" (freefall).
 * Soaring, 200 BPM, 4/4, no drums at all. C major with a pedal: Cmaj7 Am9 Fmaj7
 * Gsus→G | Em7 Am9 Fmaj7 Dm9 G. pulse1 runs 16th-note arpeggios through the
 * chords, pulse2 sings one long note per bar sliding into the next (0.35 s
 * portamento, so every change is a swoop), the triangle holds a C pedal that
 * moves to G for the last four bars to pull the loop round. 16 bars, loops.
 */
export default {
  id: 'flying_squirrel',
  title: 'Flying Squirrel',
  bpm: 200,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.25, volume: 0.34,
      env: { attack: 0.003, decay: 0.05, sustain: 0.7, release: 0.04 },
      patterns: {
        AC:  'C4 E4 G4 B4 C5 B4 G4 E4 | C4 E4 G4 B4 C5 E5 C5 B4', // Cmaj7
        AC2: 'E4 G4 B4 C5 E5 C5 B4 G4 | E4 G4 B4 C5 E5 G5 E5 C5', // Cmaj7, higher
        AAm: 'A4 C5 E5 G5 B5 G5 E5 C5 | A4 C5 E5 G5 B5 C6 B5 G5', // Am9
        AF:  'F4 A4 C5 E5 F5 E5 C5 A4 | F4 A4 C5 E5 F5 A5 F5 E5', // Fmaj7
        AG:  'D4 G4 B4 D5 G5 D5 B4 G4 | D4 G4 B4 D5 G5 B5 G5 D5', // G
        AGs: 'D4 G4 C5 D5 G5 D5 C5 G4 | D4 G4 B4 D5 G5 B5 G5 D5', // Gsus4 → G
        AEm: 'E4 G4 B4 D5 E5 D5 B4 G4 | E4 G4 B4 D5 E5 G5 E5 D5', // Em7
        ADm: 'D4 F4 A4 C5 E5 C5 A4 F4 | D4 F4 A4 C5 E5 F5 E5 C5', // Dm9
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.5, volume: 0.26,
      env: { attack: 0.05, decay: 0.2, sustain: 0.85, release: 0.15 },
      vibrato: { rate: 5, depth: 15, delay: 0.3 },
      slideTime: 0.35,
      patterns: {
        E5:  'E5 = = = = = = = | = = = = = = = =',
        G5s: 'G5~ = = = = = = = | = = = = = = = =',
        B5s: 'B5~ = = = = = = = | = = = = = = = =',
        A5s: 'A5~ = = = = = = = | = = = = = = = =',
        C6s: 'C6~ = = = = = = = | = = = = = = = =',
        D6s: 'D6~ = = = = = = = | = = = = = = = =',
        E5s: 'E5~ = = = = = = = | = = = = = = = =',
        F5s: 'F5~ = = = = = = = | = = = = = = = =',
        H:   '= = = = = = = = | = = = = = = = =', // keep holding
      },
    },
    tri: {
      wave: 'triangle', volume: 0.55,
      env: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 },
      patterns: {
        PC: 'C3 = = = = = = = | C3 = = = = = = =',
        PG: 'G2 = = = = = = = | G2 = = = = = = =',
      },
    },
  },
  order: [
    { pulse1: 'AC',  pulse2: 'E5',  tri: 'PC' },
    { pulse1: 'AC2', pulse2: 'G5s', tri: 'PC' },
    { pulse1: 'AAm', pulse2: 'B5s', tri: 'PC' },
    { pulse1: 'AAm', pulse2: 'H',   tri: 'PC' },
    { pulse1: 'AF',  pulse2: 'A5s', tri: 'PC' },
    { pulse1: 'AF',  pulse2: 'C6s', tri: 'PC' },
    { pulse1: 'AGs', pulse2: 'D6s', tri: 'PC' },
    { pulse1: 'AG',  pulse2: 'B5s', tri: 'PC' },
    { pulse1: 'AEm', pulse2: 'G5s', tri: 'PC' },
    { pulse1: 'AEm', pulse2: 'H',   tri: 'PC' },
    { pulse1: 'AAm', pulse2: 'E5s', tri: 'PC' },
    { pulse1: 'AAm', pulse2: 'C6s', tri: 'PC' },
    { pulse1: 'AF',  pulse2: 'A5s', tri: 'PG' },
    { pulse1: 'ADm', pulse2: 'F5s', tri: 'PG' },
    { pulse1: 'AG',  pulse2: 'D6s', tri: 'PG' },
    { pulse1: 'AGs', pulse2: 'G5s', tri: 'PG' },
  ],
};
