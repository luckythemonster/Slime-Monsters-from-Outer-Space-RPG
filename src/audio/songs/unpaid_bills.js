/**
 * unpaid_bills — "Unpaid Bills" (the apartment).
 * Lo-fi beat, 120 BPM, 4/4. D minor: Dm9 Gm7 Bbmaj7 A7. Muted staccato chord
 * stabs on two 25 % pulses (a dyad per hit, boom-bap placement: 1, the and of 2,
 * the and of 3, 4), a hopping triangle bass, `k . s .` kit with soft 8th hats.
 * The order is two passes: bars 0–3 are bass + kit only, 4–7 add the chords,
 * and the melody (pulse2) only arrives at bar 8 — `loopStart: 8` means the
 * sparse first pass plays once and the full groove loops from the second pass.
 * (Lucky picks up the amp; the song notices.) A bed of tape hiss (overlapping
 * open hats at 0.03) runs under everything so the gaps are never digital silence.
 */
export default {
  id: 'unpaid_bills',
  title: 'Unpaid Bills',
  bpm: 120,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  loopStart: 8,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.25, volume: 0.24,
      env: { attack: 0.002, decay: 0.06, sustain: 0.25, release: 0.04 },
      patterns: {
        CD:  'A4 . . C5 . . A4 . . . E5 . C5 . . .',    // Dm9 upper voice
        CG:  'Bb4 . . D5 . . Bb4 . . . F5 . D5 . . .',  // Gm7
        CBb: 'D5 . . F5 . . D5 . . . A5 . F5 . . .',    // Bbmaj7
        CA:  'C#5 . . E5 . . C#5 . . . G5 . E5 . . .',  // A7
      },
    },
    pulse1b: {
      wave: 'pulse', duty: 0.25, volume: 0.18,
      env: { attack: 0.002, decay: 0.06, sustain: 0.25, release: 0.04 },
      patterns: {
        CD:  'F4 . . A4 . . F4 . . . C5 . A4 . . .',    // a third below pulse1
        CG:  'G4 . . Bb4 . . G4 . . . D5 . Bb4 . . .',
        CBb: 'Bb4 . . D5 . . Bb4 . . . F5 . D5 . . .',
        CA:  'A4 . . C#5 . . A4 . . . E5 . C#5 . . .',
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.5, volume: 0.22,
      env: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.08 },
      vibrato: { rate: 5.5, depth: 15, delay: 0.15 },
      patterns: {
        ML1: '. . . . A4 = C5 = D5 = = = . . E5 =',
        ML2: 'F5 = = = D5 = = = . . Bb4 = C5 = D5 =',
        ML3: 'F5 = = = = = A5 = = = = = F5 = D5 =',
        ML4: 'E5 = = = = = = = C#5 = = = . . . .',
        ML5: 'D5 = = = F5 = E5 = D5 = = = . . A4 =',
        ML6: 'Bb4 = = = D5 = = = F5 = = = G5 = = =',
        ML7: 'A5 = = = = = = = F5 = D5 = C5 = = =',
        ML8: 'C#5 = = = E5 = = = A4 = = = = = . .',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.5,
      env: { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.06 },
      patterns: {
        BD:  'D3 = . . . . D3 = . . A2 = . . C3 .',
        BG:  'G2 = . . . . G2 = . . D3 = . . F3 .',
        BBb: 'Bb2 = . . . . Bb2 = . . F3 = . . D3 .',
        BA:  'A2 = . . . . A2 = . . E3 = . . C#3 .',
      },
    },
    noise: {
      wave: 'noise', volume: 0.36,
      patterns: {
        K1: 'k . . . s . . . . . k . s . . .',
        K2: 'k . . . s . . . k . . . s . . s',
      },
    },
    hats: {
      wave: 'noise', volume: 0.1,
      patterns: {
        H1: 'h . h . h h h . h . h . h . o .',
        H2: 'h . h . h . h . h . h h h . o .',
      },
    },
    hiss: { // tape hiss: overlapping open hats on every 16th at almost nothing
      wave: 'noise', volume: 0.03,
      patterns: { S: 'o o o o o o o o o o o o o o o o' },
    },
  },
  order: [
    // pass 1a: bass + kit
    { tri: 'BD', noise: 'K1', hats: 'H1', hiss: 'S' },
    { tri: 'BG', noise: 'K2', hats: 'H2', hiss: 'S' },
    { tri: 'BBb', noise: 'K1', hats: 'H1', hiss: 'S' },
    { tri: 'BA', noise: 'K2', hats: 'H2', hiss: 'S' },
    // pass 1b: + chords
    { pulse1: 'CD', pulse1b: 'CD', tri: 'BD', noise: 'K1', hats: 'H1', hiss: 'S' },
    { pulse1: 'CG', pulse1b: 'CG', tri: 'BG', noise: 'K2', hats: 'H2', hiss: 'S' },
    { pulse1: 'CBb', pulse1b: 'CBb', tri: 'BBb', noise: 'K1', hats: 'H1', hiss: 'S' },
    { pulse1: 'CA', pulse1b: 'CA', tri: 'BA', noise: 'K2', hats: 'H2', hiss: 'S' },
    // pass 2 (loops from here): + melody
    { pulse1: 'CD', pulse1b: 'CD', pulse2: 'ML1', tri: 'BD', noise: 'K1', hats: 'H1', hiss: 'S' },
    { pulse1: 'CG', pulse1b: 'CG', pulse2: 'ML2', tri: 'BG', noise: 'K2', hats: 'H2', hiss: 'S' },
    { pulse1: 'CBb', pulse1b: 'CBb', pulse2: 'ML3', tri: 'BBb', noise: 'K1', hats: 'H1', hiss: 'S' },
    { pulse1: 'CA', pulse1b: 'CA', pulse2: 'ML4', tri: 'BA', noise: 'K2', hats: 'H2', hiss: 'S' },
    { pulse1: 'CD', pulse1b: 'CD', pulse2: 'ML5', tri: 'BD', noise: 'K1', hats: 'H1', hiss: 'S' },
    { pulse1: 'CG', pulse1b: 'CG', pulse2: 'ML6', tri: 'BG', noise: 'K2', hats: 'H2', hiss: 'S' },
    { pulse1: 'CBb', pulse1b: 'CBb', pulse2: 'ML7', tri: 'BBb', noise: 'K1', hats: 'H1', hiss: 'S' },
    { pulse1: 'CA', pulse1b: 'CA', pulse2: 'ML8', tri: 'BA', noise: 'K2', hats: 'H2', hiss: 'S' },
  ],
};
