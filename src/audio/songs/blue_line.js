/**
 * blue_line — "The Blue Line" (Chapter 1, the light rail at night).
 * 124 BPM, 4/4, E minor: Em–C–G–D twice, the second time ending Em–C–Am–B.
 * The rail sets the groove: a two-note "da-dum" kick on every beat-pair like wheels over a joint,
 * an eighth-note triangle bass that never stops, a 12.5% arpeggio for the streetlights going by,
 * and a tired 25% melody on top. 8 bars, loops.
 */
export default {
  id: 'blue_line',
  title: 'The Blue Line',
  bpm: 124,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.25, volume: 0.2,
      env: { attack: 0.02, decay: 0.12, sustain: 0.7, release: 0.1 },
      vibrato: { rate: 5, depth: 14, delay: 0.25 },
      patterns: {
        M1: 'B4 = = = = = G4 = | = = = = E4 = = =',
        M2: 'E4 = = = G4 = = = | C5 = = = B4 = = =',
        M3: 'D5 = = = = = B4 = | = = = = G4 = = =',
        M4: 'F#4 = = = A4 = = = | D5 = = = C5 = B4 =',
        M5: 'B4 = = = = = E5 = | = = = = D5 = B4 =',
        M6: 'C5 = = = = = = = | E5 = = = D5 = C5 =',
        M7: 'A4 = = = C5 = = = | E5 = = = C5 = = =',
        M8: 'B4 = = = = = = = | D#5 = = = F#5 = = =',
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.125, volume: 0.12,
      env: { attack: 0.004, decay: 0.06, sustain: 0.4, release: 0.04 },
      patterns: {
        AEm: 'E4 . G4 . B4 . G4 . | E4 . G4 . B4 . G4 .',
        AC: 'E4 . G4 . C5 . G4 . | E4 . G4 . C5 . G4 .',
        AG: 'D4 . G4 . B4 . G4 . | D4 . G4 . B4 . G4 .',
        AD: 'D4 . F#4 . A4 . F#4 . | D4 . F#4 . A4 . F#4 .',
        AAm: 'C4 . E4 . A4 . E4 . | C4 . E4 . A4 . E4 .',
        AB: 'D#4 . F#4 . B4 . F#4 . | D#4 . F#4 . B4 . F#4 .',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.5,
      env: { attack: 0.005, decay: 0.08, sustain: 0.8, release: 0.05 },
      patterns: {
        BEm: 'E2 . E3 . E2 . E3 . | E2 . E3 . B2 . E3 .',
        BC: 'C2 . C3 . C2 . C3 . | C2 . C3 . G2 . C3 .',
        BG: 'G2 . G3 . G2 . G3 . | G2 . G3 . D3 . G3 .',
        BD: 'D2 . D3 . D2 . D3 . | D2 . D3 . A2 . D3 .',
        BAm: 'A2 . A3 . A2 . A3 . | A2 . A3 . E3 . A3 .',
        BB: 'B1 . B2 . B1 . B2 . | B1 . B2 . F#2 . B2 .',
      },
    },
    noise: {
      wave: 'noise', volume: 0.2,
      patterns: {
        RA: 'k . . k h . h . | k . . k h . h .',
        RB: 'k . . k h . h . | k . . k s . h o',
      },
    },
  },
  order: [
    { pulse1: 'M1', pulse2: 'AEm', tri: 'BEm', noise: 'RA' },
    { pulse1: 'M2', pulse2: 'AC', tri: 'BC', noise: 'RA' },
    { pulse1: 'M3', pulse2: 'AG', tri: 'BG', noise: 'RA' },
    { pulse1: 'M4', pulse2: 'AD', tri: 'BD', noise: 'RB' },
    { pulse1: 'M5', pulse2: 'AEm', tri: 'BEm', noise: 'RA' },
    { pulse1: 'M6', pulse2: 'AC', tri: 'BC', noise: 'RA' },
    { pulse1: 'M7', pulse2: 'AAm', tri: 'BAm', noise: 'RA' },
    { pulse1: 'M8', pulse2: 'AB', tri: 'BB', noise: 'RB' },
  ],
};
