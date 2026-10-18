/**
 * pocket — "Pocket" (THE SET).
 * 182 BPM in 7/8 (`beatsPerBar: 7, stepsPerBeat: 2`; a step is an 8th), grouped
 * 3+2+2. E minor. The lopsided riff on pulse1 (legato 8ths) accents the first
 * 8th of every group (E E E | G G | A B; E E E | G G | D B; then C C C | D D | E G and
 * A A A | G G | E D), the triangle doubles it an octave down, the kick lands on
 * beats 1 and 4, the snare on 6, hats mark every 8th with accents on the group
 * starts, and every fourth bar ends in a snare fill. pulse2 (a wailing line)
 * only enters at bar 9, so the second half of the 16-bar loop has it. Loops.
 */
export const RIFF = Object.freeze({
  R1: 'E3! = E3 = E3 = G3! = G3 = A3! = B3 =',
  R2: 'E3! = E3 = E3 = G3! = G3 = D4! = B3 =',
  R3: 'C4! = C4 = C4 = D4! = D4 = E4! = G4 =',
  R4: 'A3! = A3 = A3 = G3! = G3 = E3! = D3 =',
});

/** The riff order for 8 bars: R1 R2 R1 R2 | R3 R4 R1 R2 (bars 3 and 7 carry a fill). */
const RIFF_ORDER = ['R1', 'R2', 'R1', 'R2', 'R3', 'R4', 'R1', 'R2'];
const VOCAL = ['P1', 'P2', 'P1', 'P2', 'P3', 'P4', 'P1', 'P2'];
const order = [];
for (let bar = 0; bar < 16; bar++) {
  const riff = RIFF_ORDER[bar % 8];
  const b = { pulse1: riff, tri: riff, noise: bar % 4 === 3 ? 'NF' : 'N', hats: 'H' };
  if (bar >= 8) b.pulse2 = VOCAL[bar % 8];
  order.push(b);
}

export default {
  id: 'pocket',
  title: 'Pocket',
  bpm: 182,
  beatsPerBar: 7,
  stepsPerBeat: 2,
  loop: true,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.36,
      env: { attack: 0.002, decay: 0.03, sustain: 0.85, release: 0.02 },
      patterns: RIFF,
    },
    pulse2: {
      wave: 'pulse', duty: 0.25, volume: 0.26,
      env: { attack: 0.003, decay: 0.05, sustain: 0.75, release: 0.03 },
      vibrato: { rate: 6, depth: 14, delay: 0.1 },
      patterns: {
        P1: 'B4 = = . . . G4 = . . A4 = = .',
        P2: 'B4 = = . . . G4 = . . D5 = B4 =',
        P3: 'E5 = = = . . D5 = = . E5 = G5 =',
        P4: 'A5 = = = . . G5 = . . E5 = D5 =',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.5, octave: -1,
      env: { attack: 0.002, decay: 0.02, sustain: 0.9, release: 0.02 },
      patterns: RIFF, // doubles pulse1 an octave down
    },
    noise: {
      wave: 'noise', volume: 0.38,
      patterns: {
        N:  'k . . . . . k . . . s . . .',   // kick 1 and 4, snare 6
        NF: 'k . . . . . k . . . s s s s',   // fill
      },
    },
    hats: {
      wave: 'noise', volume: 0.12,
      patterns: {
        H: 'h! . h . h . h! . h . h! . h .', // accents on 1, 4, 6 (3+2+2)
      },
    },
  },
  order,
};
