/**
 * plaster_dust — "Plaster Dust" (the rubble, aftermath).
 * Hollow: 70 BPM, 4/4, the triangle alone, no drums. It plays the `pocket`
 * riff (R1 R2 R1 R2, 28 notes) at a quarter of the speed — every 8th of the
 * 7/8 riff becomes a quarter note here, so four bars of 7/8 come out as seven
 * bars of 4/4 (24 s). Built from pocket's exported RIFF so it cannot drift.
 * Loops; it stops on "I quit." and does not resume.
 */
import { RIFF } from './pocket.js';
import { tokenizePattern } from '../Sequencer.js';

const notes = ['R1', 'R2', 'R1', 'R2']
  .flatMap((p) => tokenizePattern(RIFF[p]).filter((t) => t !== '.' && t !== '=').map((t) => t.replace(/[~!]/g, '')));

const patterns = {};
const order = [];
for (let i = 0; i < notes.length; i += 4) {
  const name = `B${i / 4}`;
  patterns[name] = notes.slice(i, i + 4).map((n) => `${n} = = =`).join(' | ');
  order.push({ tri: name });
}

export default {
  id: 'plaster_dust',
  title: 'Plaster Dust',
  bpm: 70,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    tri: {
      wave: 'triangle', volume: 0.5,
      env: { attack: 0.03, decay: 0.3, sustain: 0.6, release: 0.25 },
      patterns,
    },
  },
  order,
};
