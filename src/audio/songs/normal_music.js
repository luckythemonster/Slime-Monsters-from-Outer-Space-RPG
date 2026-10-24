/**
 * normal_music — "Normal Music" (the coffee shop; Brian's rehearsal).
 * Sterile rock, 128 BPM, 4/4, G major: I–V–vi–IV (G D Em C), twice. 50 % duty
 * everywhere, root 8ths perfectly quantized on pulse1, a quarter-note melody
 * of nothing but chord tones on pulse2, root quarters on the triangle, kick on
 * 1 and 3, snare on 2 and 4 and nothing else. No accents, no slides, no
 * vibrato, default envelopes. The joke is that it is correct.
 */
export default {
  id: 'normal_music',
  title: 'Normal Music',
  bpm: 128,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.34,
      patterns: {
        G: 'G3 . G3 . G3 . G3 . | G3 . G3 . G3 . G3 .',
        D: 'D3 . D3 . D3 . D3 . | D3 . D3 . D3 . D3 .',
        E: 'E3 . E3 . E3 . E3 . | E3 . E3 . E3 . E3 .',
        C: 'C4 . C4 . C4 . C4 . | C4 . C4 . C4 . C4 .',
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.5, volume: 0.26,
      patterns: {
        M1: 'B4 = = = D5 = = = | G5 = = = D5 = = =',   // G
        M2: 'A4 = = = D5 = = = | F#5 = = = D5 = = =',  // D
        M3: 'G4 = = = B4 = = = | E5 = = = B4 = = =',   // Em
        M4: 'G4 = = = C5 = = = | E5 = = = C5 = = =',   // C
        M5: 'G5 = = = B5 = = = | D5 = = = G5 = = =',   // G, second time
        M6: 'F#5 = = = A5 = = = | D5 = = = F#5 = = =', // D
        M7: 'E5 = = = G5 = = = | B4 = = = E5 = = =',   // Em
        M8: 'E5 = = = C5 = = = | D5 = = = = = = =',    // C, then the 5th leads home
      },
    },
    tri: {
      wave: 'triangle', volume: 0.55,
      patterns: {
        G: 'G2 = = = G2 = = = | G2 = = = G2 = = =',
        D: 'D3 = = = D3 = = = | D3 = = = D3 = = =',
        E: 'E2 = = = E2 = = = | E2 = = = E2 = = =',
        C: 'C3 = = = C3 = = = | C3 = = = C3 = = =',
      },
    },
    noise: {
      wave: 'noise', volume: 0.36,
      patterns: {
        K: 'k . . . s . . . | k . . . s . . .',
      },
    },
  },
  order: [
    { pulse1: 'G', pulse2: 'M1', tri: 'G', noise: 'K' },
    { pulse1: 'D', pulse2: 'M2', tri: 'D', noise: 'K' },
    { pulse1: 'E', pulse2: 'M3', tri: 'E', noise: 'K' },
    { pulse1: 'C', pulse2: 'M4', tri: 'C', noise: 'K' },
    { pulse1: 'G', pulse2: 'M5', tri: 'G', noise: 'K' },
    { pulse1: 'D', pulse2: 'M6', tri: 'D', noise: 'K' },
    { pulse1: 'E', pulse2: 'M7', tri: 'E', noise: 'K' },
    { pulse1: 'C', pulse2: 'M8', tri: 'C', noise: 'K' },
  ],
};
