/**
 * six_inch_stage — "Six-Inch Stage" (Palmer's house system; a different band).
 * Jukebox bar-rock, 140 BPM, 4/4, a twelve-bar boogie in A (A A A A | D D A A |
 * E D A E). pulse1 plays the root/5th/6th/b7 boogie figure, pulse2 sings a
 * pentatonic bar-band melody (this is the channel that is muted outside, see
 * six_inch_stage_ext.js), the triangle walks a shuffle bass through the chord
 * tones, and the kit is a plain rock beat with a crash on the top and a fill
 * on the turnaround. 12 bars, loops.
 */
export default {
  id: 'six_inch_stage',
  title: 'Six-Inch Stage',
  bpm: 140,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.34,
      env: { attack: 0.003, decay: 0.04, sustain: 0.8, release: 0.03 },
      patterns: {
        BA: 'A3 = E4 = A3 = F#4 = | A3 = G4 = A3 = F#4 =',
        BD: 'D3 = A3 = D3 = B3 = | D3 = C4 = D3 = B3 =',
        BE: 'E3 = B3 = E3 = C#4 = | E3 = D4 = E3 = C#4 =',
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.25, volume: 0.28,
      env: { attack: 0.004, decay: 0.06, sustain: 0.75, release: 0.05 },
      vibrato: { rate: 5.5, depth: 18, delay: 0.1 },
      patterns: {
        V1:  '. . . . E5 = G5 = | A5 = = = . . . .',
        V2:  'A5 = G5 = E5 = D5 = | C5 = = = A4 = = =',
        V3:  '. . C5 = D5 = E5 = | G5 = E5 = D5 = = =',
        V4:  'C5 = A4 = = = . . | . . . . E5 = G5 =',
        V5:  'A5 = = = A5 = G5 = | E5 = = = D5 = = =',
        V6:  '. . D5 = E5 = G5 = | A5 = = = = = . .',
        V7:  'A5 = G5 = E5 = C5 = | D5 = = = = = . .',
        V8:  '. . A4 = C5 = D5 = | E5 = = = = = . .',
        V9:  'B5 = = = A5 = G5 = | E5 = = = = = . .',
        V10: 'A5 = = = G5 = E5 = | D5 = = = = = . .',
        V11: 'C5 = D5 = E5 = G5 = | A5 = = = = = . .',
        V12: '. . . . E5 = D5 = | B4 = = = E5 = = =',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.55,
      env: { attack: 0.003, decay: 0.03, sustain: 0.85, release: 0.03 },
      patterns: {
        TA: 'A2 = A2 = C#3 = E3 = | F#3 = E3 = C#3 = A2 =',
        TD: 'D3 = D3 = F#3 = A3 = | B3 = A3 = F#3 = D3 =',
        TE: 'E3 = E3 = G#3 = B3 = | C#4 = B3 = G#3 = E3 =',
      },
    },
    noise: {
      wave: 'noise', volume: 0.36,
      patterns: {
        D1: 'c . h . s . h . | k . h . s . h .',
        D2: 'k . h . s . h . | k . h h s . o .',
        DF: 'k . h . s . h . | k . s . s s s s',
      },
    },
  },
  order: [
    { pulse1: 'BA', pulse2: 'V1', tri: 'TA', noise: 'D1' },
    { pulse1: 'BA', pulse2: 'V2', tri: 'TA', noise: 'D2' },
    { pulse1: 'BA', pulse2: 'V3', tri: 'TA', noise: 'D2' },
    { pulse1: 'BA', pulse2: 'V4', tri: 'TA', noise: 'D2' },
    { pulse1: 'BD', pulse2: 'V5', tri: 'TD', noise: 'D2' },
    { pulse1: 'BD', pulse2: 'V6', tri: 'TD', noise: 'D2' },
    { pulse1: 'BA', pulse2: 'V7', tri: 'TA', noise: 'D2' },
    { pulse1: 'BA', pulse2: 'V8', tri: 'TA', noise: 'D2' },
    { pulse1: 'BE', pulse2: 'V9', tri: 'TE', noise: 'D2' },
    { pulse1: 'BD', pulse2: 'V10', tri: 'TD', noise: 'D2' },
    { pulse1: 'BA', pulse2: 'V11', tri: 'TA', noise: 'D2' },
    { pulse1: 'BE', pulse2: 'V12', tri: 'TE', noise: 'DF' },
  ],
};
