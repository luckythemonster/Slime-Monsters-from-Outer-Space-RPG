/**
 * game_over — game over (6 s one-shot). The `dental_plan` brand jingle again,
 * in C minor and at half speed (50 BPM; one 5/4 bar is exactly six seconds):
 * "Van-guard Den-tal PLAAAN" in parallel sixths on the two 12.5 % pulses with
 * the swoop into the top note, a smug minor walking bass (C Eb G Ab G), brush
 * hats. Dad wins. `loop: false`.
 */
export default {
  id: 'game_over',
  title: 'Game Over (Dad Wins)',
  bpm: 50,
  beatsPerBar: 5,
  stepsPerBeat: 4,
  loop: false,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.125, volume: 0.24, slideTime: 0.3,
      env: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.1 },
      vibrato: { rate: 5, depth: 12, delay: 0.3 },
      patterns: { J: 'G5 . G5 . Ab5 . G5 . | C6~ = = = = = = = = = = =' },
    },
    pulse2: {
      wave: 'pulse', duty: 0.125, volume: 0.21, slideTime: 0.3,
      env: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.1 },
      vibrato: { rate: 5, depth: 12, delay: 0.3 },
      patterns: { J: 'Bb4 . Bb4 . C5 . Bb4 . | Eb5~ = = = = = = = = = = =' }, // a minor sixth below
    },
    tri: {
      wave: 'triangle', volume: 0.5,
      env: { attack: 0.01, decay: 0.08, sustain: 0.8, release: 0.1 },
      patterns: { J: 'C3 = = = Eb3 = = = | G2 = = = Ab2 = = = G2 = = =' },
    },
    noise: {
      wave: 'noise', volume: 0.15,
      patterns: { J: 'h . h . h . h . | h . h . h . h . h . o .' },
    },
  },
  order: [{ pulse1: 'J', pulse2: 'J', tri: 'J', noise: 'J' }],
};
