/**
 * bajonka — the save jingle (1 s one-shot). 240 BPM, one bar, `loop: false`:
 * a two-note triangle "boop-boop" (A4, E5). The sneeze before it is the
 * `sneeze` SFX; the game plays that first, then this.
 */
export default {
  id: 'bajonka',
  title: 'Bajonka',
  bpm: 240,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: false,
  channels: {
    tri: {
      wave: 'triangle', volume: 0.5,
      env: { attack: 0.003, decay: 0.05, sustain: 0.8, release: 0.06 },
      patterns: { B: 'A4 = = = E5 = = = = = = = . . . .' },
    },
  },
  order: [{ tri: 'B' }],
};
