/**
 * win_sting — victory (2 s one-shot).
 * 240 BPM so a bar is one second; two bars, `loop: false`. Three ascending
 * pulse chord stabs on beats 1, 2 and 3 (D, E, then A held: IV V I in the
 * title's key) on three pulse channels, roots on the triangle, a kick under
 * each stab and a crash on the third.
 */
export default {
  id: 'win_sting',
  title: 'Win Sting',
  bpm: 240,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: false,
  channels: {
    top: {
      wave: 'pulse', duty: 0.5, volume: 0.3,
      env: { attack: 0.002, decay: 0.05, sustain: 0.8, release: 0.12 },
      vibrato: { rate: 6, depth: 12, delay: 0.3 },
      patterns: { S: 'A5 . . . B5 . . . E6 = = = = = = =', H: '= = = = = = = = = = = = = = = =' },
    },
    mid: {
      wave: 'pulse', duty: 0.25, volume: 0.24,
      env: { attack: 0.002, decay: 0.05, sustain: 0.8, release: 0.12 },
      patterns: { S: 'F#5 . . . G#5 . . . C#6 = = = = = = =', H: '= = = = = = = = = = = = = = = =' },
    },
    low: {
      wave: 'pulse', duty: 0.25, volume: 0.22,
      env: { attack: 0.002, decay: 0.05, sustain: 0.8, release: 0.12 },
      patterns: { S: 'D5 . . . E5 . . . A5 = = = = = = =', H: '= = = = = = = = = = = = = = = =' },
    },
    tri: {
      wave: 'triangle', volume: 0.5,
      env: { attack: 0.002, decay: 0.05, sustain: 0.85, release: 0.12 },
      patterns: { S: 'D3 . . . E3 . . . A2 = = = = = = =', H: '= = = = = = = = = = = = = = = =' },
    },
    noise: {
      wave: 'noise', volume: 0.36,
      patterns: { S: 'k . . . k . . . c . . . . . . .', R: '. . . . . . . . . . . . . . . .' },
    },
  },
  order: [
    { top: 'S', mid: 'S', low: 'S', tri: 'S', noise: 'S' },
    { top: 'H', mid: 'H', low: 'H', tri: 'H', noise: 'R' },
  ],
};
