/**
 * dollar_bin — "Dollar Bin" (Chapter 1, the stereo at Extreme Noise).
 * 172 BPM, 4/4, A: a three-chord punk loop (A–D–E, then A–G–D–E) played back through one blown
 * speaker. Power chords are two 12.5% pulses a fifth apart at low volume, so they buzz instead of
 * ring; the bass follows the roots in eighths; the kit is a straight punk beat. 8 bars, loops.
 */
export default {
  id: 'dollar_bin',
  title: 'Dollar Bin',
  bpm: 172,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  volume: 0.8,
  channels: {
    root: {
      wave: 'pulse', duty: 0.125, volume: 0.14,
      env: { attack: 0.002, decay: 0.05, sustain: 0.6, release: 0.03 },
      patterns: {
        CA: 'A3 = A3 = A3 = A3 = | A3 = A3 = A3 = A3 =',
        CD: 'D4 = D4 = D4 = D4 = | D4 = D4 = D4 = D4 =',
        CE: 'E4 = E4 = E4 = E4 = | E4 = E4 = E4 = E4 =',
        CG: 'G3 = G3 = G3 = G3 = | G3 = G3 = G3 = G3 =',
        CAD: 'A3 = A3 = A3 = A3 = | D4 = D4 = D4 = D4 =',
      },
    },
    fifth: {
      wave: 'pulse', duty: 0.125, volume: 0.1,
      env: { attack: 0.002, decay: 0.05, sustain: 0.6, release: 0.03 },
      patterns: {
        CA: 'E4 = E4 = E4 = E4 = | E4 = E4 = E4 = E4 =',
        CD: 'A4 = A4 = A4 = A4 = | A4 = A4 = A4 = A4 =',
        CE: 'B4 = B4 = B4 = B4 = | B4 = B4 = B4 = B4 =',
        CG: 'D4 = D4 = D4 = D4 = | D4 = D4 = D4 = D4 =',
        CAD: 'E4 = E4 = E4 = E4 = | A4 = A4 = A4 = A4 =',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.45,
      env: { attack: 0.004, decay: 0.06, sustain: 0.8, release: 0.04 },
      patterns: {
        BA: 'A2 . A2 . A2 . A2 . | A2 . A2 . A2 . A2 .',
        BD: 'D2 . D2 . D2 . D2 . | D2 . D2 . D2 . D2 .',
        BE: 'E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 .',
        BG: 'G2 . G2 . G2 . G2 . | G2 . G2 . G2 . G2 .',
        BAD: 'A2 . A2 . A2 . A2 . | D2 . D2 . D2 . D2 .',
      },
    },
    noise: {
      wave: 'noise', volume: 0.2,
      patterns: {
        PA: 'k . h . s . h . | k . k . s . h .',
        PB: 'k . h . s . h . | k . k . s . s s',
        PC: 'c . h . s . h . | k . k . s . h .',
      },
    },
  },
  order: [
    { root: 'CA', fifth: 'CA', tri: 'BA', noise: 'PC' },
    { root: 'CD', fifth: 'CD', tri: 'BD', noise: 'PA' },
    { root: 'CE', fifth: 'CE', tri: 'BE', noise: 'PA' },
    { root: 'CAD', fifth: 'CAD', tri: 'BAD', noise: 'PB' },
    { root: 'CA', fifth: 'CA', tri: 'BA', noise: 'PC' },
    { root: 'CG', fifth: 'CG', tri: 'BG', noise: 'PA' },
    { root: 'CD', fifth: 'CD', tri: 'BD', noise: 'PA' },
    { root: 'CE', fifth: 'CE', tri: 'BE', noise: 'PB' },
  ],
};
