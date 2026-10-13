/**
 * sticker_hallway — "Sticker Hallway" (City Sound hallway).
 * `west_bank` as heard through a soundproof door: the same tempo and the same
 * 16-bar order, but the triangle carries the riff an octave down (bass
 * frequencies are what get through a wall), pulse1 doubles it at 0.15, there is
 * no pulse2 (the vocal line is gone), and the kit is reduced to hats. Built from
 * west_bank's own pattern objects so the two can never drift apart.
 */
import west from './west_bank.js';

const riff = west.channels.pulse1;

export default {
  id: 'sticker_hallway',
  title: 'Sticker Hallway',
  bpm: west.bpm,
  beatsPerBar: west.beatsPerBar,
  stepsPerBeat: west.stepsPerBeat,
  loop: true,
  channels: {
    pulse1: { ...riff, volume: 0.15 },
    tri: {
      wave: 'triangle', volume: 0.55, octave: -1,
      env: { attack: 0.01, decay: 0.05, sustain: 0.85, release: 0.06 },
      patterns: riff.patterns,
    },
    noise: {
      wave: 'noise', volume: 0.12,
      patterns: {
        H: 'h . h . h . h . | h . h . h . h .',
        HO: 'h . h . h . h . | h . h . h . h o',
      },
    },
  },
  order: west.order.map((bar, i) => ({ pulse1: bar.pulse1, tri: bar.pulse1, noise: i % 4 === 3 ? 'HO' : 'H' })),
};
