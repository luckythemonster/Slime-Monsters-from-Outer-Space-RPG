/**
 * west_bank — "West Bank" (the streets hub; the slice's main loop).
 * Skate-punk, 170 BPM, 4/4, D major. 16 bars: an 8-bar verse built on a
 * two-bar riff (D A | Bm G, bouncing arpeggiated 8ths on pulse1 with a
 * turnaround every fourth bar) and an 8-bar chorus (G D A Bm | G D A A) where
 * pulse1 drops to downstroke power-chord roots and pulse2 shouts the hook
 * ("WEST BANK" — B5 B5 A5 G5, answered a step lower each time). The triangle
 * plays legato root 8ths with octave jumps throughout; kit is kick/hat/snare with an
 * open hat on the 4-and in the chorus and a snare fill every fourth bar.
 */
export default {
  id: 'west_bank',
  title: 'West Bank',
  bpm: 170,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.5, volume: 0.36,
      env: { attack: 0.003, decay: 0.03, sustain: 0.85, release: 0.025 },
      patterns: {
        // verse riff (two bars)
        RV1: 'D4 . D4 . F#4 . A4 . | A4 . A4 . E4 . C#4 .',   // D | A
        RV2: 'B3 . B3 . D4 . F#4 . | G3 . G3 . B3 . D4 .',    // Bm | G
        RV2t: 'B3 . B3 . D4 . F#4 . | G3 . A3 . B3 . C#4 .',  // Bm | G, turnaround
        // chorus: downstroke roots with the 3rd/5th as pickups
        CG: 'G3 . G3 . G3 . G3 . | G3 . G3 . B3 . D4 .',
        CD: 'D3 . D3 . D3 . D3 . | D3 . D3 . F#3 . A3 .',
        CA: 'A3 . A3 . A3 . A3 . | A3 . A3 . C#4 . E4 .',
        CB: 'B3 . B3 . B3 . B3 . | B3 . B3 . D4 . F#4 .',
        CAt: 'A3 . A3 . A3 . A3 . | C#4 . C#4 . E4 . E4 .',
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.25, volume: 0.28,
      env: { attack: 0.002, decay: 0.05, sustain: 0.75, release: 0.03 },
      vibrato: { rate: 6, depth: 14, delay: 0.12 },
      patterns: {
        V1: 'F#5 = = . F#5 = A5 = | F#5 = E5 = D5 = = =',
        V2: 'E5 = = . E5 = C#5 = | E5 = = = . . . .',
        V3: 'D5 = = . D5 = F#5 = | D5 = C#5 = B4 = = =',
        V4: 'B4 = = . D5 = E5 = | F#5 = = = = = . .',
        V5: 'F#5 = = . F#5 = A5 = | B5 = A5 = F#5 = = =',
        V6: 'E5 = = . E5 = C#5 = | E5 = C#5 = A4 = = =',
        V7: 'D5 = = . D5 = F#5 = | A5 = = = F#5 = = =',
        V8: 'G5 = = = F#5 = E5 = | D5 = = = = = . .',
        H1: 'B5 = = = B5 = A5 = | G5 = = = = = . .',     // WEST BANK
        H2: 'A5 = = = A5 = F#5 = | D5 = = = = = . .',
        H3: 'E5 = F#5 = G5 = A5 = | B5 = = = = = . .',
        H4: 'A5 = = = F#5 = D5 = | F#5 = = = = = . .',
        H5: 'E5 = F#5 = A5 = B5 = | C#6 = = = = = . .',
        H6: 'B5 = A5 = F#5 = E5 = | D5 = = = = = E5 =',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.55,
      env: { attack: 0.003, decay: 0.02, sustain: 0.9, release: 0.02 },
      patterns: {
        // legato 8ths (each note rings into the next) with octave jumps
        TV1: 'D3 = D3 = D2 = D3 = | A2 = A2 = A3 = A2 =',
        TV2: 'B2 = B2 = B3 = B2 = | G2 = G2 = G3 = G2 =',
        TG: 'G2 = G2 = G3 = G2 = | G2 = G2 = G3 = G2 =',
        TD: 'D3 = D3 = D2 = D3 = | D3 = D3 = D2 = D3 =',
        TA: 'A2 = A2 = A3 = A2 = | A2 = A2 = A3 = A2 =',
        TB: 'B2 = B2 = B3 = B2 = | B2 = B2 = B3 = B2 =',
        TAt: 'A2 = A2 = A3 = A2 = | C#3 = C#3 = E3 = E3 =',
      },
    },
    noise: {
      wave: 'noise', volume: 0.36,
      patterns: {
        D1: 'c . h . s . h . | k . h . s . h .',   // crash on the downbeat
        D2: 'k . h . s . h . | k . h . s . h .',
        DC: 'k . h . s . h . | k k h . s . o .',   // chorus: open hat on the 4-and
        DF: 'k . h . s . h . | k . s . s s s s',   // fill
      },
    },
  },
  order: [
    // verse
    { pulse1: 'RV1', pulse2: 'V1', tri: 'TV1', noise: 'D1' },
    { pulse1: 'RV2', pulse2: 'V2', tri: 'TV2', noise: 'D2' },
    { pulse1: 'RV1', pulse2: 'V3', tri: 'TV1', noise: 'D2' },
    { pulse1: 'RV2t', pulse2: 'V4', tri: 'TV2', noise: 'DF' },
    { pulse1: 'RV1', pulse2: 'V5', tri: 'TV1', noise: 'D2' },
    { pulse1: 'RV2', pulse2: 'V6', tri: 'TV2', noise: 'D2' },
    { pulse1: 'RV1', pulse2: 'V7', tri: 'TV1', noise: 'D2' },
    { pulse1: 'RV2t', pulse2: 'V8', tri: 'TV2', noise: 'DF' },
    // chorus
    { pulse1: 'CG', pulse2: 'H1', tri: 'TG', noise: 'D1' },
    { pulse1: 'CD', pulse2: 'H2', tri: 'TD', noise: 'DC' },
    { pulse1: 'CA', pulse2: 'H3', tri: 'TA', noise: 'DC' },
    { pulse1: 'CB', pulse2: 'H4', tri: 'TB', noise: 'DF' },
    { pulse1: 'CG', pulse2: 'H1', tri: 'TG', noise: 'D1' },
    { pulse1: 'CD', pulse2: 'H2', tri: 'TD', noise: 'DC' },
    { pulse1: 'CA', pulse2: 'H5', tri: 'TA', noise: 'DC' },
    { pulse1: 'CAt', pulse2: 'H6', tri: 'TAt', noise: 'DF' },
  ],
};
