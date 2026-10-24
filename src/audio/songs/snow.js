/**
 * snow — "Snow on Hennepin" (Minneapolis streets wandering theme).
 * Melancholy mid-tempo, 110 BPM, 4/4. A minor: i–VI–III–VII then i–VI–V–i
 * (Am F C G | Am F E Am). Slow triangle bass (root for three beats, then a
 * fifth), a sparse vibrato melody on pulse1, a thin 12.5% arpeggio on pulse2,
 * light hats with a soft kick on the odd bars. 8 bars, loops.
 */
export default {
  id: 'snow',
  title: 'Snow on Hennepin',
  bpm: 110,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.22,
      env: { attack: 0.02, decay: 0.15, sustain: 0.7, release: 0.12 },
      vibrato: { rate: 5.5, depth: 18, delay: 0.2 },
      patterns: {
        M1: '. . . . E5 = = = | . . D5 = C5 = = =',
        M2: 'A4 = = = = = = = | C5 = = = D5 = = =',
        M3: 'E5 = = = = = = = | . . G5 = E5 = = =',
        M4: 'D5 = = = = = = = | = = = = B4 = = =',
        M5: 'C5 = = = = = = = | E5 = = = A5 = = =',
        M6: 'G5 = = = = = = = | F5 = = = E5 = = =',
        M7: 'B4 = = = = = = = | = = = = G#4 = = =',
        M8: 'A4 = = = = = = = | = = = = = = = =',
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.125, volume: 0.16,
      env: { attack: 0.004, decay: 0.08, sustain: 0.5, release: 0.05 },
      patterns: {
        AAm: 'A3 . C4 . E4 . C4 . | A3 . C4 . E4 . C4 .',
        AF: 'F3 . A3 . C4 . A3 . | F3 . A3 . C4 . A3 .',
        AC: 'E3 . G3 . C4 . G3 . | E3 . G3 . C4 . G3 .',
        AG: 'D3 . G3 . B3 . G3 . | D3 . G3 . B3 . G3 .',
        AE: 'E3 . G#3 . B3 . G#3 . | E3 . G#3 . B3 . G#3 .',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.5,
      env: { attack: 0.01, decay: 0.1, sustain: 0.85, release: 0.08 },
      patterns: {
        BAm: 'A2 = = = = = = = | = = = = E2 = = =',
        BF: 'F2 = = = = = = = | = = = = C3 = = =',
        BC: 'C3 = = = = = = = | = = = = G2 = = =',
        BG: 'G2 = = = = = = = | = = = = D3 = = =',
        BE: 'E2 = = = = = = = | = = = = B2 = = =',
        BEnd: 'A2 = = = = = = = | C3 = = = E3 = = =',
      },
    },
    noise: {
      wave: 'noise', volume: 0.18,
      patterns: {
        HA: 'k . h . h . h . | h . h . h . h .',
        HB: 'h . h . h . h . | h . h . h . h o',
        HC: 'h . h . h . h . | h . h . h . . .',
      },
    },
  },
  order: [
    { pulse1: 'M1', pulse2: 'AAm', tri: 'BAm', noise: 'HA' }, // Am
    { pulse1: 'M2', pulse2: 'AF', tri: 'BF', noise: 'HB' },   // F
    { pulse1: 'M3', pulse2: 'AC', tri: 'BC', noise: 'HA' },   // C
    { pulse1: 'M4', pulse2: 'AG', tri: 'BG', noise: 'HB' },   // G
    { pulse1: 'M5', pulse2: 'AAm', tri: 'BAm', noise: 'HA' }, // Am
    { pulse1: 'M6', pulse2: 'AF', tri: 'BF', noise: 'HB' },   // F
    { pulse1: 'M7', pulse2: 'AE', tri: 'BE', noise: 'HA' },   // E
    { pulse1: 'M8', pulse2: 'AAm', tri: 'BEnd', noise: 'HC' }, // Am
  ],
};
