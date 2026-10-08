/**
 * battle — "Pit Riot" (standard battle theme).
 * Hardcore, 200 BPM, 4/4. E minor: i i III IV | i i VI VII (E E G A | E E C D).
 * Bar 0 is a one-bar intro (held E + snare pickup + a slide up to E5), then the
 * 8-bar riff loops from bar 1 (`loopStart: 1`). Gallop 16ths on pulse1, octave
 * stabs on pulse2, root 8ths on the triangle, driving kick/snare with fills.
 */
export default {
  id: 'battle',
  title: 'Pit Riot',
  bpm: 200,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  loopStart: 1,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.38,
      env: { attack: 0.002, decay: 0.03, sustain: 0.85, release: 0.02 },
      patterns: {
        RI: 'E3! = = = = = = = | . . . . . . . .',
        RE: 'E3 . E3 . E3 E3 E3 . | E3 . E3 . E3 . G3 .',
        RG: 'G3 . G3 . G3 G3 G3 . | G3 . G3 . B3 . A3 .',
        RA: 'A3 . A3 . A3 A3 A3 . | A3 . A3 . G3 . E3 .',
        RC: 'C4 . C4 . C4 C4 C4 . | C4 . C4 . B3 . A3 .',
        RD: 'D4 . D4 . D4 D4 D4 . | D4 . D4 . D4 . B3 .',
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.25, volume: 0.28,
      env: { attack: 0.002, decay: 0.05, sustain: 0.7, release: 0.03 },
      patterns: {
        LI: '. . . . . . . . | B4 = = = E5~ = = =',
        L1: 'B4 = = . B4 = = . | B4 = G4 = E4 = = =',
        L2: 'B4 = = . B4 = = . | D5 = B4 = G4 = = =',
        L3: 'D5 = = . D5 = = . | D5 = B4 = G4 = = =',
        L4: 'E5 = = . E5 = = . | E5 = D5 = B4 = = =',
        L6: 'B4 = = . B4 = = . | D5 = E5 = G5 = = =',
        L7: 'G5 = = . G5 = = . | E5 = D5 = C5 = = =',
        L8: 'D5 = = = F#5 = = = | A5~ = = = B5~ = = =',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.6,
      env: { attack: 0.002, decay: 0.02, sustain: 0.9, release: 0.02 },
      patterns: {
        BI: 'E2! = = = = = = = | . . . . . . . .',
        BE: 'E2 . E2 . E2 . E3 . | E2 . E2 . E2 . G2 .',
        BG: 'G2 . G2 . G2 . G3 . | G2 . G2 . B2 . A2 .',
        BA: 'A2 . A2 . A2 . A3 . | A2 . A2 . G2 . E2 .',
        BC: 'C3 . C3 . C3 . C2 . | C3 . C3 . B2 . A2 .',
        BD: 'D3 . D3 . D3 . D2 . | D3 . D3 . D3 . B2 .',
      },
    },
    noise: {
      wave: 'noise', volume: 0.4,
      patterns: {
        DI: 'c . . . . . . . | s . s . s s s s',   // intro: crash, then snare pickup
        DC: 'c . h h s . h . | k . h h s . h .',   // loop downbeat crash
        DA: 'k . h h s . h . | k . h h s . h .',
        DB: 'k . h . s . h . | k k h . s . o .',
        DF: 'k . h . s . h . | k . s s . s s s',   // fill
      },
    },
  },
  order: [
    { pulse1: 'RI', pulse2: 'LI', tri: 'BI', noise: 'DI' }, // intro (not looped)
    { pulse1: 'RE', pulse2: 'L1', tri: 'BE', noise: 'DC' }, // E
    { pulse1: 'RE', pulse2: 'L2', tri: 'BE', noise: 'DA' }, // E
    { pulse1: 'RG', pulse2: 'L3', tri: 'BG', noise: 'DB' }, // G
    { pulse1: 'RA', pulse2: 'L4', tri: 'BA', noise: 'DF' }, // A
    { pulse1: 'RE', pulse2: 'L1', tri: 'BE', noise: 'DA' }, // E
    { pulse1: 'RE', pulse2: 'L6', tri: 'BE', noise: 'DB' }, // E
    { pulse1: 'RC', pulse2: 'L7', tri: 'BC', noise: 'DA' }, // C
    { pulse1: 'RD', pulse2: 'L8', tri: 'BD', noise: 'DF' }, // D
  ],
};
