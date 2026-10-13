/**
 * northern_garage — "Northern Garage" (the garage; frozen).
 * 60 BPM, 4/4, 4 bars (16 s), loops. A closed hat on every beat at 0.1 and one
 * triangle note every two bars (E3, then C3), each swelling in over half a
 * second and decaying slowly into the cold. Nothing else.
 */
const BAR = (n) => `${n} = = = = = = = = = = = = = = =`;
export default {
  id: 'northern_garage',
  title: 'Northern Garage',
  bpm: 60,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    tri: {
      wave: 'triangle', volume: 0.45,
      env: { attack: 0.5, decay: 3, sustain: 0.4, release: 1.0 },
      patterns: { E3: BAR('E3'), C3: BAR('C3'), H: '= = = = = = = = = = = = = = = =' },
    },
    noise: {
      wave: 'noise', volume: 0.1,
      patterns: { H: 'h . . . h . . . h . . . h . . .' },
    },
  },
  order: [
    { tri: 'E3', noise: 'H' },
    { tri: 'H', noise: 'H' },
    { tri: 'C3', noise: 'H' },
    { tri: 'H', noise: 'H' },
  ],
};
