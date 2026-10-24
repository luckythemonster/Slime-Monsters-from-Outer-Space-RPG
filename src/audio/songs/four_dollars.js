/**
 * four_dollars — "Four Dollars" (Room 4, the AUDITION).
 * Blistering hardcore, 196 BPM, 4/4, E minor with chromatic walks (E E F G |
 * E E C D, F#/D# pulling back to E). Bar 0 is a one-bar stick-click intro on
 * the kit (`loopStart: 1`), then: pulse1 downstroke 8ths, pulse2 a screamed
 * line where every note is an accent, triangle root 8ths, kick on every 8th
 * with the snare on 2 and 4, and a 16th-note snare fill every fourth bar.
 */
export default {
  id: 'four_dollars',
  title: 'Four Dollars',
  bpm: 196,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  loopStart: 1,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.32,
      env: { attack: 0.002, decay: 0.03, sustain: 0.85, release: 0.02 },
      patterns: {
        RE:  'E3 . E3 . E3 . E3 . | E3 . E3 . E3 . E3 .',
        RE2: 'E3 . E3 . E3 . E3 . | E3 . E3 . F3 . G3 .',
        RF:  'F3 . F3 . F3 . F3 . | F3 . F3 . F3 . F3 .',
        RG:  'G3 . G3 . G3 . G3 . | G3 . G3 . F#3 . F3 .',
        RC:  'C4 . C4 . C4 . C4 . | C4 . C4 . C4 . C4 .',
        RD:  'D4 . D4 . D4 . D4 . | D4 . D4 . D#4 . D#4 .',
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.25, volume: 0.26,
      env: { attack: 0.002, decay: 0.04, sustain: 0.7, release: 0.02 },
      vibrato: { rate: 8, depth: 25, delay: 0.05 },
      patterns: {
        S1: 'B4! . B4! . B4! = D5! = | E5! = = = . . B4! .',
        S2: 'E5! . E5! . G5! = E5! = | D5! = B4! = . . . .',
        S3: 'F5! . F5! . A5! = F5! = | C5! = = = . . . .',
        S4: 'G5! . G5! . B5! = G5! = | D5! = = = B4! = D5! =',
        S5: 'E5! . E5! . E5! . G5! = | A5! = G5! = E5! = = =',
        S6: 'B4! = = = D5! = E5! = | G5! = = = = = . .',
        S7: 'C5! . C5! . E5! = G5! = | A5! = G5! = E5! = = =',
        S8: 'D5! . D5! . F#5! = A5! = | B5! = = = = = = =',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.46,
      env: { attack: 0.002, decay: 0.02, sustain: 0.9, release: 0.02 },
      patterns: {
        TE:  'E2 . E2 . E2 . E2 . | E2 . E2 . E2 . E2 .',
        TE2: 'E2 . E2 . E2 . E2 . | E2 . E2 . F2 . G2 .',
        TF:  'F2 . F2 . F2 . F2 . | F2 . F2 . F2 . F2 .',
        TG:  'G2 . G2 . G2 . G2 . | G2 . G2 . F#2 . F2 .',
        TC:  'C3 . C3 . C3 . C3 . | C3 . C3 . C3 . C3 .',
        TD:  'D3 . D3 . D3 . D3 . | D3 . D3 . D#3 . D#3 .',
      },
    },
    kick: {
      wave: 'noise', volume: 0.3,
      patterns: {
        ST: 'h! . . . h! . . . | h! . . . h! . . .', // stick clicks: 1 2 3 4
        K:  'k . k . k . k . | k . k . k . k .',
      },
    },
    snare: {
      wave: 'noise', volume: 0.3,
      patterns: {
        S:  '. . . . s . . . | . . . . s . . .',
        SF: '. . . . s . . . | s s s s s s s s',   // 16th fill
      },
    },
    hats: {
      wave: 'noise', volume: 0.12,
      patterns: {
        H:  'h . h . h . h . | h . h . h . h .',
        HC: 'c . h . h . h . | h . h . h . h .',
      },
    },
  },
  order: [
    { kick: 'ST' },                                                                     // intro: four stick clicks
    { pulse1: 'RE',  pulse2: 'S1', tri: 'TE',  kick: 'K', snare: 'S',  hats: 'HC' },   // E
    { pulse1: 'RE2', pulse2: 'S2', tri: 'TE2', kick: 'K', snare: 'S',  hats: 'H' },    // E (walk up)
    { pulse1: 'RF',  pulse2: 'S3', tri: 'TF',  kick: 'K', snare: 'S',  hats: 'H' },    // F
    { pulse1: 'RG',  pulse2: 'S4', tri: 'TG',  kick: 'K', snare: 'SF', hats: 'H' },    // G, fill
    { pulse1: 'RE',  pulse2: 'S5', tri: 'TE',  kick: 'K', snare: 'S',  hats: 'HC' },   // E
    { pulse1: 'RE2', pulse2: 'S6', tri: 'TE2', kick: 'K', snare: 'S',  hats: 'H' },    // E
    { pulse1: 'RC',  pulse2: 'S7', tri: 'TC',  kick: 'K', snare: 'S',  hats: 'H' },    // C
    { pulse1: 'RD',  pulse2: 'S8', tri: 'TD',  kick: 'K', snare: 'SF', hats: 'H' },    // D, fill
  ],
};
