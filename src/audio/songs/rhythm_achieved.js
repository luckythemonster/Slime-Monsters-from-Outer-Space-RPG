/**
 * rhythm_achieved — "Rhythm Achieved" (THE ETERNITY; 21 s one-shot).
 * Doom at 60 BPM in 7/8 (`beatsPerBar: 7, stepsPerBeat: 2`: a step is half a
 * second, a bar seven seconds), three bars, `loop: false`. Half-time: the
 * triangle sits on the lowest notes (E2 → D2 → C2) with slow slide falls, two
 * 50 % pulses hold an E3 drone 8 cents apart (±4) so it beats, there is no
 * pulse2, an open hat lands on every beat, and the kick on 1 comes with a
 * crash swell. Every downbeat is a camera shake. DOOM / CRACK / THUD are the
 * `doom`, `crack` and `thud_word` SFX, 900 ms apart, over this.
 */
const BAR = '= = = = = = = = = = = = = =';
export default {
  id: 'rhythm_achieved',
  title: 'Rhythm Achieved',
  bpm: 60,
  beatsPerBar: 7,
  stepsPerBeat: 2,
  loop: false,
  channels: {
    tri: {
      wave: 'triangle', volume: 0.6, slideTime: 0.45,
      env: { attack: 0.02, decay: 0.3, sustain: 0.85, release: 0.4 },
      patterns: {
        T1: 'E2 = = = = = = = D2~ = = = = =',
        T2: 'C2~ = = = = = = = E2 = = = = =',
        T3: 'D2~ = = = = = = = C2~ = = = = =',
      },
    },
    drone_a: {
      wave: 'pulse', duty: 0.5, volume: 0.22, detune: -4,
      env: { attack: 0.5, decay: 0.5, sustain: 0.9, release: 0.4 },
      patterns: { E: `E3 ${BAR.slice(2)}` },
    },
    drone_b: {
      wave: 'pulse', duty: 0.5, volume: 0.22, detune: 4,
      env: { attack: 0.5, decay: 0.5, sustain: 0.9, release: 0.4 },
      patterns: { E: `E3 ${BAR.slice(2)}` },
    },
    noise: {
      wave: 'noise', volume: 0.3,
      patterns: { O: 'o . o . o . o . o . o . o .' }, // open hat every beat
    },
    kick: {
      wave: 'noise', volume: 0.5,
      patterns: { K: 'k! . . . . . . . . . . . . .' },
    },
    swell: {
      wave: 'noise', volume: 0.3,
      patterns: { C: 'c . . . . . . . . . . . . .' },
    },
  },
  order: [
    { tri: 'T1', drone_a: 'E', drone_b: 'E', noise: 'O', kick: 'K', swell: 'C' },
    { tri: 'T2', drone_a: 'E', drone_b: 'E', noise: 'O', kick: 'K', swell: 'C' },
    { tri: 'T3', drone_a: 'E', drone_b: 'E', noise: 'O', kick: 'K', swell: 'C' },
  ],
};
