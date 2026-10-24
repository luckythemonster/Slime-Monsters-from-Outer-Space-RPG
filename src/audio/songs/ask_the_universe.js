/**
 * ask_the_universe — "Ask the Universe" (the signal montage, 24 s one-shot).
 * 150 BPM in 3/4, 20 bars, `loop: false`. A building drone on E:
 * - pulse1 holds the root (one 19 s note), pulse2 is the same root on eight
 *   "drone" channels that each slide up into E4 from a semitone below at the
 *   start of every bar, with the detune widening every two bars (0 → 60 cents),
 *   so the unison slowly turns into a beating, seasick chorus;
 * - the triangle climbs an octave over 8 bars (E2 → E3), then again (E3 → E4);
 * - the noise is a crescendo: one open hat per bar, then every beat, then 8th
 *   hats, then 16th rolls, then crashes;
 * - bars 16–17 the pulses wrench up an octave; bars 18–19 everything stops but
 *   a held triangle E3 (then the hard cut to northern_garage).
 */
const BAR = (n) => `${n} = = = = = = = = = = =`;      // one note held for a 3/4 bar
const HOLD = '= = = = = = = = = = = =';
const SLIDE = 'D#4 E4~ = = = = = = = = = =';           // bend into the root each bar
const DETUNES = [0, 4, 8, 14, 22, 32, 45, 60];

const drones = {};
DETUNES.forEach((cents, i) => {
  drones[`drone${i}`] = {
    wave: 'pulse', duty: 0.25, volume: 0.16 + i * 0.02, detune: cents, slideTime: 0.3, // louder as it widens
    env: { attack: 0.05, decay: 0.2, sustain: 0.9, release: 0.3 },
    patterns: { S: SLIDE, H: HOLD, UP: 'E5~ = = = = = = = = = = =' },
  };
});

const triNotes = ['E2', 'F#2', 'G#2', 'A2', 'B2', 'C#3', 'D3', 'E3', 'F#3', 'G#3', 'A3', 'B3', 'C#4', 'D4', 'E4'];
const triPatterns = Object.fromEntries(triNotes.map((n) => [n, BAR(n)]));
triPatterns.H = HOLD;

const order = [];
for (let bar = 0; bar < 20; bar++) {
  const b = {};
  // pulse1: root, one long note, then the octave wrench, then out
  if (bar === 0) b.pulse1 = 'R'; else if (bar < 16) b.pulse1 = 'H'; else if (bar === 16) b.pulse1 = 'UP'; else if (bar === 17) b.pulse1 = 'H';
  // drones: a new detune every two bars, each bar re-slides into the root
  if (bar < 16) b[`drone${Math.floor(bar / 2)}`] = 'S';
  else if (bar === 16) b.drone7 = 'UP';
  else if (bar === 17) b.drone7 = 'H';
  // triangle: up an octave over 8 bars, twice, then the held E3
  if (bar < 15) b.tri = triNotes[bar]; else if (bar === 15) b.tri = 'E4'; else if (bar === 16) b.tri = 'E3'; else b.tri = 'H';
  // noise crescendo
  if (bar < 4) b.noiseA = 'A'; else if (bar < 8) b.noiseB = 'B'; else if (bar < 12) b.noiseC = 'C'; else if (bar < 16) b.noiseD = 'D'; else if (bar < 18) b.noiseE = bar === 16 ? 'E1' : 'E2';
  order.push(b);
}

export default {
  id: 'ask_the_universe',
  title: 'Ask the Universe',
  bpm: 150,
  beatsPerBar: 3,
  stepsPerBeat: 4,
  loop: false,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.22, slideTime: 0.6,
      env: { attack: 0.3, decay: 0.3, sustain: 0.9, release: 0.3 },
      patterns: { R: BAR('E4'), H: HOLD, UP: 'E5~ = = = = = = = = = = =' },
    },
    ...drones,
    tri: {
      wave: 'triangle', volume: 0.5,
      env: { attack: 0.05, decay: 0.2, sustain: 0.9, release: 0.5 },
      patterns: triPatterns,
    },
    noiseA: { wave: 'noise', volume: 0.07, patterns: { A: 'o . . . . . . . . . . .' } },
    noiseB: { wave: 'noise', volume: 0.14, patterns: { B: 'o . . . o . . . o . . .' } },
    noiseC: { wave: 'noise', volume: 0.24, patterns: { C: 'o . h . h . o . h . h .' } },
    noiseD: { wave: 'noise', volume: 0.4, patterns: { D: 'o h h h h h o h h h h h' } },
    noiseE: { wave: 'noise', volume: 0.5, patterns: { E1: 'c . h h h h c . h h h h', E2: 'c . h h h h c . h h h h' } },
  },
  order,
};
