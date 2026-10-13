/**
 * dental_plan — "Vanguard Dental Plan" (pod bay hold music).
 * Corporate muzak, 100 BPM, 4/4. C major, a smug ii–V–I loop with a Lydian-ish
 * Fmaj7 for colour (Cmaj7 Am7 Dm7 G7 | Fmaj7 Em7 Dm7–G7 C). Melody on pulse1
 * with pulse2 a diatonic sixth below (parallel sixths, both 12.5 % duty, lounge
 * vibrato), a walking triangle bass in quarter notes and brush hats only. The
 * last bar is the brand jingle ("Van-guard Den-tal PLAAAN") with a swoop into
 * the top note, so it comes round every 8 bars. Cuts dead on SQUELCH.
 */
export default {
  id: 'dental_plan',
  title: 'Vanguard Dental Plan',
  bpm: 100,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  loop: true,
  channels: {
    pulse1: {
      wave: 'pulse', duty: 0.125, volume: 0.24,
      env: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.1 },
      vibrato: { rate: 5, depth: 12, delay: 0.3 },
      slideTime: 0.14,
      patterns: {
        M0: 'E5 = = = G5 = = = | B5 = A5 = G5 = = =',
        M1: 'A5 = = = = = G5 = | E5 = = = C5 = = =',
        M2: 'D5 = = = F5 = = = | A5 = G5 = F5 = = =',
        M3: 'G5 = = = = = F5 = | D5 = = = B4 = = =',
        M4: 'A5 = = = = = = = | F5 = G5 = A5 = C6 =',
        M5: 'B5 = = = = = = = | G5 = = = E5 = = =',
        M6: 'F5 = = = A5 = = = | G5 = = = . . G5 .',
        JG: 'G5 . G5 . A5 . G5 . | C6~ = = = = = = =', // the jingle
      },
    },
    pulse2: {
      wave: 'pulse', duty: 0.125, volume: 0.21,
      env: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.1 },
      vibrato: { rate: 5, depth: 12, delay: 0.3 },
      slideTime: 0.14,
      patterns: {
        // a diatonic sixth below every melody note
        S0: 'G4 = = = B4 = = = | D5 = C5 = B4 = = =',
        S1: 'C5 = = = = = B4 = | G4 = = = E4 = = =',
        S2: 'F4 = = = A4 = = = | C5 = B4 = A4 = = =',
        S3: 'B4 = = = = = A4 = | F4 = = = D4 = = =',
        S4: 'C5 = = = = = = = | A4 = B4 = C5 = E5 =',
        S5: 'D5 = = = = = = = | B4 = = = G4 = = =',
        S6: 'A4 = = = C5 = = = | B4 = = = . . B4 .',
        JG: 'B4 . B4 . C5 . B4 . | E5~ = = = = = = =',
      },
    },
    tri: {
      wave: 'triangle', volume: 0.5,
      env: { attack: 0.01, decay: 0.08, sustain: 0.8, release: 0.08 },
      patterns: {
        BC:  'C3 = = = E3 = = = | G3 = = = A3 = = =', // Cmaj7
        BAm: 'A2 = = = C3 = = = | E3 = = = G3 = = =', // Am7
        BDm: 'D3 = = = E3 = = = | F3 = = = A3 = = =', // Dm7
        BG:  'G2 = = = B2 = = = | D3 = = = F3 = = =', // G7
        BF:  'F3 = = = E3 = = = | D3 = = = C3 = = =', // Fmaj7 (walking down)
        BEm: 'E3 = = = G3 = = = | B2 = = = D3 = = =', // Em7
        BDG: 'D3 = = = F3 = = = | G2 = = = B2 = = =', // Dm7 G7
        BJG: 'C3 = = = E3 = = = | G2 = = = B2 = = =', // C (jingle), B2 leads home
      },
    },
    noise: {
      wave: 'noise', volume: 0.15,
      patterns: {
        H1: 'h . h . h . h . | h . h . h . h .',
        H2: 'h . h . h . h . | h . h . h . h o',
      },
    },
  },
  order: [
    { pulse1: 'M0', pulse2: 'S0', tri: 'BC', noise: 'H1' },
    { pulse1: 'M1', pulse2: 'S1', tri: 'BAm', noise: 'H2' },
    { pulse1: 'M2', pulse2: 'S2', tri: 'BDm', noise: 'H1' },
    { pulse1: 'M3', pulse2: 'S3', tri: 'BG', noise: 'H2' },
    { pulse1: 'M4', pulse2: 'S4', tri: 'BF', noise: 'H1' },
    { pulse1: 'M5', pulse2: 'S5', tri: 'BEm', noise: 'H2' },
    { pulse1: 'M6', pulse2: 'S6', tri: 'BDG', noise: 'H1' },
    { pulse1: 'JG', pulse2: 'JG', tri: 'BJG', noise: 'H2' }, // brand jingle
  ],
};
