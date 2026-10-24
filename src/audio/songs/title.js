/**
 * title — "Slime Monsters from Outer Space" (title screen).
 * Punk, 190 BPM, 4/4, 16th grid. Key of A: a four-chord I–IV–V–IV Ramones riff
 * (A D E D), downstroke 8ths on pulse1, a shouty lead on pulse2, root 8ths with
 * octave pops on the triangle, crash-kick-snare punk beat. 8 bars, loops.
 */
export default {
  id: 'title',
  title: 'Slime Monsters from Outer Space',
  bpm: 190,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.36,
      env: { attack: 0.003, decay: 0.03, sustain: 0.85, release: 0.025 },
      patterns: {
        // downstroke 8ths: root ×6 then the 3rd and 5th as a pickup
        RA: 'A3 . A3 . A3 . A3 . | A3 . A3 . C#4 . E4 .',
        RD: 'D3 . D3 . D3 . D3 . | D3 . D3 . F#3 . A3 .',
        RE: 'E3 . E3 . E3 . E3 . | E3 . E3 . G#3 . B3 .',
        RT: 'E3 . E3 . E3 . E3 . | G#3 . G#3 . B3 . B3 .', // turnaround
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.25, volume: 0.26,
      vibrato: { rate: 6, depth: 14, delay: 0.12 },
      patterns: {
        L1: 'E5 = . E5 = . C#5 = | A4 = . C#5 = E5 = =',
        L2: 'F#5 = = = D5 = F#5 = | A5 = = = . . . .',
        L3: 'G#5 = . G#5 = . E5 = | B4 = . E5 = G#5 = =',
        L4: 'A5 = = = F#5 = D5 = | E5 = = = = = . .',
        L5: 'A5 = . A5 = . E5 = | C#5 = . E5 = A5 = =',
        L6: 'A5 = = = F#5 = A5 = | B5 = = = . . . .',
        L7: 'B5 = . B5 = . G#5 = | E5 = . G#5 = B5 = =',
        L8: 'A5~ = = = G#5 = = = | E5 = = = = = = .',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.55,
      env: { attack: 0.003, decay: 0.02, sustain: 0.9, release: 0.02 },
      patterns: {
        BA: 'A2 . A2 . A2 . A2 . | A2 . A3 . A2 . A2 .',
        BD: 'D2 . D2 . D2 . D2 . | D2 . D3 . D2 . D2 .',
        BE: 'E2 . E2 . E2 . E2 . | E2 . E3 . E2 . E2 .',
        BT: 'E2 . E2 . E2 . E2 . | G#2 . G#2 . B2 . B2 .',
      },
    },
    noise: {
      wave: 'noise', volume: 0.34,
      patterns: {
        D1: 'c . h . s . h . | k . k . s . h .',   // crash on the downbeat
        D2: 'k . h . s . h . | k . k . s . h .',
        DF: 'k . h . s . h . | k . s . s s s s',   // fill
      },
    },
  },
  order: [
    { pulse1: 'RA', pulse2: 'L1', tri: 'BA', noise: 'D1' }, // A
    { pulse1: 'RD', pulse2: 'L2', tri: 'BD', noise: 'D2' }, // D
    { pulse1: 'RE', pulse2: 'L3', tri: 'BE', noise: 'D2' }, // E
    { pulse1: 'RD', pulse2: 'L4', tri: 'BD', noise: 'DF' }, // D
    { pulse1: 'RA', pulse2: 'L5', tri: 'BA', noise: 'D1' }, // A
    { pulse1: 'RD', pulse2: 'L6', tri: 'BD', noise: 'D2' }, // D
    { pulse1: 'RE', pulse2: 'L7', tri: 'BE', noise: 'D2' }, // E
    { pulse1: 'RT', pulse2: 'L8', tri: 'BT', noise: 'DF' }, // E turnaround
  ],
};
