/**
 * level_up — level-up jingle (1.5 s one-shot). 160 BPM, one bar, `loop: false`.
 * A 16th-note C major arpeggio two octaves up (C5 → C7) on pulse1, echoed two
 * steps later by a thinner 25 % pulse that lands on the third, the triangle
 * jumping C3 → C4 underneath, a crash as the top note lands.
 */
export default {
  id: 'level_up',
  title: 'Level Up',
  bpm: 160,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: false,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.32,
      env: { attack: 0.002, decay: 0.04, sustain: 0.8, release: 0.1 },
      vibrato: { rate: 6, depth: 18, delay: 0.25 },
      patterns: { A: 'C5 E5 G5 C6 E6 G6 C7 = = = = = = = = =' },
    },
    pulse2: {
      wave: 'pulse', duty: 0.25, volume: 0.18,
      env: { attack: 0.002, decay: 0.04, sustain: 0.7, release: 0.1 },
      patterns: { A: '. . C5 E5 G5 C6 E6 G6 E6 = = = = = = =' },
    },
    tri: {
      wave: 'triangle', volume: 0.45,
      env: { attack: 0.002, decay: 0.05, sustain: 0.85, release: 0.1 },
      patterns: { A: 'C3 = = = = = = = C4 = = = = = = =' },
    },
    noise: {
      wave: 'noise', volume: 0.2,
      patterns: { A: '. . . . . . c . . . . . . . . .' },
    },
  },
  order: [{ pulse1: 'A', pulse2: 'A', tri: 'A', noise: 'A' }],
};
