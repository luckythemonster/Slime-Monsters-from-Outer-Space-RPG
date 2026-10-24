/**
 * pothole — "Pothole" (the alley).
 * Lo-fi and tired: 92 BPM in 6/8 (`beatsPerBar: 6, stepsPerBeat: 2`, so a step
 * is a 16th and the beat lamp blinks on every eighth). A minor: Am Am F F | C G
 * Am E. The triangle bass drags through long dotted notes (root for five
 * eighths, fifth, then a passing tone), a thin 12.5 % pulse sighs a two-note
 * motif every fourth bar, and the only percussion is wind: an open hat on
 * every beat at a volume you feel more than hear. 8 bars, loops.
 */
export default {
  id: 'pothole',
  title: 'Pothole',
  bpm: 92,
  beatsPerBar: 6,
  stepsPerBeat: 2,
  loop: true,
  channels: {
    tri: {
      wave: 'triangle', volume: 0.65,
      env: { attack: 0.02, decay: 0.2, sustain: 0.8, release: 0.2 },
      patterns: {
        BAm:  'A2 = = = = = E3 = = = C3 =',
        BAm2: 'A2 = = = = = E3 = = = D3 =',
        BF:   'F2 = = = = = C3 = = = A2 =',
        BC:   'C3 = = = = = G2 = = = E3 =',
        BG:   'G2 = = = = = D3 = = = B2 =',
        BE:   'E2 = = = = = B2 = = = G#2 =',
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.125, volume: 0.22,
      env: { attack: 0.03, decay: 0.15, sustain: 0.7, release: 0.2 },
      vibrato: { rate: 4.5, depth: 20, delay: 0.2 },
      patterns: {
        MO1: '. . . . . . E5 = = C5 = =',
        MO2: '. . . . . . D5 = = B4 = =',
      },
    },
    noise: {
      wave: 'noise', volume: 0.08,
      patterns: {
        W: 'o . o . o . o . o . o .', // wind
      },
    },
  },
  order: [
    { tri: 'BAm', noise: 'W' },
    { tri: 'BAm2', noise: 'W' },
    { tri: 'BF', noise: 'W' },
    { tri: 'BF', pulse2: 'MO1', noise: 'W' },
    { tri: 'BC', noise: 'W' },
    { tri: 'BG', noise: 'W' },
    { tri: 'BAm', noise: 'W' },
    { tri: 'BE', pulse2: 'MO2', noise: 'W' },
  ],
};
