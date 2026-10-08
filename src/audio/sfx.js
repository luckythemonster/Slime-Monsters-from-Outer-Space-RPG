/**
 * sfx.js — named sound-effect recipes (docs/ARCHITECTURE.md §7).
 *
 * Each recipe is `(synth, { when, volume, pitch, dest }) => durationSeconds`.
 * `when` is the absolute start time, `volume` a linear multiplier (1 = designed
 * level), `pitch` a frequency multiplier (1 = designed pitch). Recipes only use
 * Synth.tone / Synth.noise / Synth.drum so they work in any BaseAudioContext.
 */

import { makeDistortion } from './Synth.js';

const E = (attack, decay, sustain, release) => ({ attack, decay, sustain, release });

export const SFX = {
  /** Menu cursor move: tiny 25% pulse blip. */
  cursor(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.25, freq: 880 * pitch, when, duration: 0.03, volume: 0.35 * volume, env: E(0.001, 0.02, 0.6, 0.02), dest });
    return 0.06;
  },

  /** Confirm: two rising 50% pulse notes (C5 → G5). */
  confirm(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.5, freq: 523.25 * pitch, when, duration: 0.045, volume: 0.35 * volume, env: E(0.001, 0.03, 0.7, 0.02), dest });
    s.tone({ wave: 'pulse', duty: 0.5, freq: 783.99 * pitch, when: when + 0.05, duration: 0.09, volume: 0.35 * volume, env: E(0.001, 0.06, 0.6, 0.04), dest });
    return 0.18;
  },

  /** Cancel: falling 12.5% pulse (G4 → C4 with a slide). */
  cancel(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.125, freq: 392 * pitch, when, duration: 0.05, volume: 0.35 * volume, env: E(0.001, 0.03, 0.7, 0.02), dest });
    s.tone({ wave: 'pulse', duty: 0.125, freq: 261.63 * pitch, slideFrom: 392 * pitch, slideTime: 0.05, when: when + 0.055, duration: 0.09, volume: 0.3 * volume, env: E(0.001, 0.06, 0.5, 0.04), dest });
    return 0.19;
  },

  /** Typewriter blip: 14 ms 25% pulse. */
  text_blip(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.25, freq: 1320 * pitch, when, duration: 0.014, volume: 0.22 * volume, env: E(0.001, 0.01, 0.5, 0.012), dest });
    return 0.03;
  },

  /** Hit: low-passed noise thump + pitched-down triangle. */
  hit(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.07, volume: 0.6 * volume, filter: { type: 'lowpass', freq: 1800 }, dest });
    s.tone({ wave: 'triangle', freq: 70 * pitch, slideFrom: 200 * pitch, slideTime: 0.07, when, duration: 0.08, volume: 0.7 * volume, env: E(0.001, 0.07, 0.2, 0.04), dest });
    return 0.13;
  },

  /** Critical hit: a hit plus a screaming pulse drop and a second noise crack. */
  crit(s, { when, volume, pitch, dest }) {
    SFX.hit(s, { when, volume: volume * 1.1, pitch, dest });
    s.tone({ wave: 'pulse', duty: 0.5, freq: 300 * pitch, slideFrom: 1200 * pitch, slideTime: 0.12, when, duration: 0.13, volume: 0.4 * volume, env: E(0.001, 0.1, 0.3, 0.05), dest });
    s.tone({ wave: 'pulse', duty: 0.25, freq: 450 * pitch, slideFrom: 1800 * pitch, slideTime: 0.12, when: when + 0.01, duration: 0.13, volume: 0.25 * volume, env: E(0.001, 0.1, 0.3, 0.05), dest });
    s.noise({ when: when + 0.06, duration: 0.15, volume: 0.45 * volume, filter: { type: 'highpass', freq: 3000 }, dest });
    return 0.26;
  },

  /** Miss: a whiff — band-passed noise sweeping down + a faint falling 12.5% pulse. */
  miss(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.11, volume: 0.28 * volume, filter: { type: 'bandpass', freq: 1400 * pitch, freqTo: 350 * pitch, sweep: 0.11, Q: 1.5 }, env: E(0.02, 0.09, 0, 0.02), dest });
    s.tone({ wave: 'pulse', duty: 0.125, freq: 330 * pitch, slideFrom: 700 * pitch, slideTime: 0.1, when, duration: 0.1, volume: 0.18 * volume, env: E(0.01, 0.08, 0.3, 0.03), dest });
    return 0.15;
  },

  /** Squelch: wet downward pitch blip (fast-vibrato pulse 900 → 120 Hz + lowpassed noise). */
  squelch(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.5, freq: 120 * pitch, slideFrom: 900 * pitch, slideTime: 0.15, when, duration: 0.16, volume: 0.42 * volume, env: E(0.004, 0.1, 0.5, 0.04), vibrato: { rate: 30, depth: 60 }, dest });
    s.tone({ wave: 'triangle', freq: 60 * pitch, slideFrom: 300 * pitch, slideTime: 0.16, when: when + 0.01, duration: 0.15, volume: 0.3 * volume, env: E(0.004, 0.1, 0.4, 0.04), dest });
    s.noise({ when, duration: 0.12, volume: 0.22 * volume, filter: { type: 'lowpass', freq: 1200 * pitch, freqTo: 300 * pitch, sweep: 0.12 }, dest });
    return 0.22;
  },

  /** Slime pop: sine chirp down + click. */
  slime_pop(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'sine', freq: 180 * pitch, slideFrom: 600 * pitch, slideTime: 0.045, when, duration: 0.045, volume: 0.5 * volume, env: E(0.001, 0.04, 0.3, 0.02), dest });
    s.noise({ when, duration: 0.012, volume: 0.3 * volume, filter: { type: 'lowpass', freq: 3000 }, dest });
    return 0.08;
  },

  /** KRAAANG: big distorted E power chord — six detuned pulses + noise through a wave shaper, 600 ms. */
  kraaang(s, { when, volume, pitch, dest }) {
    const ctx = s.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.55 * volume;
    out.connect(dest || s.dest);
    const shaper = makeDistortion(ctx, 60, out);
    const env = E(0.003, 0.35, 0.4, 0.1);
    const chord = [82.41, 123.47, 164.81]; // E2 B2 E3
    let last = null;
    for (const f of chord) {
      for (const det of [-8, 8]) {
        last = s.tone({ wave: 'pulse', duty: 0.5, freq: f * pitch, slideFrom: f * pitch * 0.94, slideTime: 0.04, when, duration: 0.5, volume: 0.28, env, detune: det, vibrato: { rate: 5.5, depth: 12, delay: 0.2 }, dest: shaper });
      }
    }
    s.tone({ wave: 'sawtooth', freq: 41.2 * pitch, when, duration: 0.45, volume: 0.25, env, dest: shaper });
    s.noise({ when, duration: 0.09, volume: 0.5, filter: { type: 'highpass', freq: 2000 }, dest: shaper });
    if (last) last.onended = () => { try { shaper.disconnect(); out.disconnect(); } catch (_) { /* noop */ } };
    return 0.65;
  },

  /** Level up: fast major arpeggio climbing two octaves, echoed by a quieter 25% pulse, landing on a held top note. */
  level_up(s, { when, volume, pitch, dest }) {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]; // C5 E5 G5 C6 E6 G6
    notes.forEach((f, i) => {
      const t = when + i * 0.06;
      s.tone({ wave: 'pulse', duty: 0.5, freq: f * pitch, when: t, duration: 0.05, volume: 0.32 * volume, env: E(0.001, 0.03, 0.7, 0.03), dest });
      s.tone({ wave: 'pulse', duty: 0.25, freq: f * pitch, when: t + 0.09, duration: 0.04, volume: 0.14 * volume, env: E(0.001, 0.03, 0.6, 0.03), dest });
    });
    s.tone({ wave: 'pulse', duty: 0.5, freq: 2093 * pitch, when: when + 0.36, duration: 0.28, volume: 0.3 * volume, env: E(0.002, 0.08, 0.7, 0.08), vibrato: { rate: 6, depth: 20, delay: 0.08 }, dest });
    s.tone({ wave: 'triangle', freq: 1046.5 * pitch, when: when + 0.36, duration: 0.28, volume: 0.25 * volume, env: E(0.002, 0.08, 0.7, 0.08), dest });
    return 0.75;
  },

  /** Item get: two quick notes then a bright held third (C6 E6 G6). */
  item(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.5, freq: 1046.5 * pitch, when, duration: 0.05, volume: 0.3 * volume, env: E(0.001, 0.03, 0.7, 0.02), dest });
    s.tone({ wave: 'pulse', duty: 0.5, freq: 1318.5 * pitch, when: when + 0.055, duration: 0.05, volume: 0.3 * volume, env: E(0.001, 0.03, 0.7, 0.02), dest });
    s.tone({ wave: 'pulse', duty: 0.5, freq: 1567.98 * pitch, when: when + 0.11, duration: 0.16, volume: 0.3 * volume, env: E(0.001, 0.05, 0.7, 0.06), dest });
    s.tone({ wave: 'triangle', freq: 783.99 * pitch, when: when + 0.11, duration: 0.16, volume: 0.25 * volume, env: E(0.001, 0.05, 0.7, 0.06), dest });
    return 0.34;
  },

  /** Door: low thud + wood knock + a creaky rising 12.5% pulse. */
  door(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'triangle', freq: 95 * pitch, slideFrom: 140 * pitch, slideTime: 0.05, when, duration: 0.09, volume: 0.6 * volume, env: E(0.001, 0.08, 0.2, 0.04), dest });
    s.noise({ when, duration: 0.06, volume: 0.3 * volume, filter: { type: 'lowpass', freq: 800 }, dest });
    s.tone({ wave: 'pulse', duty: 0.125, freq: 520 * pitch, slideFrom: 240 * pitch, slideTime: 0.18, when: when + 0.06, duration: 0.18, volume: 0.14 * volume, env: E(0.02, 0.1, 0.6, 0.04), vibrato: { rate: 18, depth: 40 }, dest });
    return 0.3;
  },

  /** Sneeze: tiny two-part noise burst — "ah" (rising band-pass) then "choo" (bright burst + falling pulse). */
  sneeze(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.09, volume: 0.18 * volume, filter: { type: 'bandpass', freq: 1400 * pitch, freqTo: 2600 * pitch, sweep: 0.09, Q: 2 }, env: E(0.03, 0.06, 0, 0.02), dest });
    const t = when + 0.14;
    s.noise({ when: t, duration: 0.09, volume: 0.45 * volume, filter: { type: 'highpass', freq: 2500 }, dest });
    s.tone({ wave: 'pulse', duty: 0.25, freq: 280 * pitch, slideFrom: 900 * pitch, slideTime: 0.08, when: t, duration: 0.08, volume: 0.28 * volume, env: E(0.001, 0.06, 0.3, 0.03), dest });
    return 0.3;
  },

  /** Guitar feedback: a 50% pulse swelling up a fifth and a half with vibrato, plus a distorted saw harmonic. */
  feedback(s, { when, volume, pitch, dest }) {
    const ctx = s.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.5 * volume;
    out.connect(dest || s.dest);
    const shaper = makeDistortion(ctx, 30, out);
    const last = s.tone({ wave: 'pulse', duty: 0.5, freq: 2400 * pitch, slideFrom: 700 * pitch, slideTime: 0.38, when, duration: 0.45, volume: 0.5, env: E(0.05, 0.15, 0.8, 0.08), vibrato: { rate: 7, depth: 50, delay: 0.1 }, dest: shaper });
    s.tone({ wave: 'sawtooth', freq: 3600 * pitch, slideFrom: 1050 * pitch, slideTime: 0.38, when: when + 0.02, duration: 0.42, volume: 0.25, env: E(0.08, 0.15, 0.7, 0.08), vibrato: { rate: 7, depth: 50, delay: 0.1 }, dest: shaper });
    last.onended = () => { try { shaper.disconnect(); out.disconnect(); } catch (_) { /* noop */ } };
    return 0.56;
  },

  /** Drum hit (Ryan's attack): kick + snare together. */
  drum_hit(s, { when, volume, dest }) {
    s.drum('kick', { when, volume: 1.1 * volume, dest });
    s.drum('snare', { when, volume: 1.1 * volume, dest });
    return 0.2;
  },

  /** Cymbal: the crash drum. */
  cymbal(s, { when, volume, dest }) {
    s.drum('crash', { when, volume: 1.0 * volume, dest });
    return 0.7;
  },

  /** KO: a two-octave downward slide on two detuned pulses, ending in a low thud. */
  ko(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.5, freq: 82.41 * pitch, slideFrom: 329.63 * pitch, slideTime: 0.42, when, duration: 0.42, volume: 0.38 * volume, env: E(0.004, 0.2, 0.6, 0.06), dest });
    s.tone({ wave: 'pulse', duty: 0.25, freq: 82.41 * pitch, slideFrom: 329.63 * pitch, slideTime: 0.42, when, duration: 0.42, volume: 0.22 * volume, env: E(0.004, 0.2, 0.6, 0.06), detune: 10, dest });
    s.noise({ when: when + 0.4, duration: 0.12, volume: 0.35 * volume, filter: { type: 'lowpass', freq: 600 }, dest });
    return 0.55;
  },

  /** Flee: three rising sawtooth zips with hats (scrambling feet). */
  flee(s, { when, volume, pitch, dest }) {
    for (let i = 0; i < 3; i++) {
      const t = when + i * 0.09;
      s.tone({ wave: 'sawtooth', freq: 1400 * pitch, slideFrom: 250 * pitch, slideTime: 0.07, when: t, duration: 0.07, volume: 0.28 * volume, env: E(0.002, 0.04, 0.6, 0.02), dest });
      s.drum('hat', { when: t, volume: 0.8 * volume, dest });
    }
    return 0.32;
  },

  /** Save: gentle triangle triad rising to a held C6 with vibrato, doubled an octave up by a soft 12.5% pulse. */
  save(s, { when, volume, pitch, dest }) {
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
    notes.forEach((f, i) => {
      s.tone({ wave: 'triangle', freq: f * pitch, when: when + i * 0.08, duration: 0.075, volume: 0.45 * volume, env: E(0.002, 0.04, 0.8, 0.03), dest });
    });
    const t = when + 0.24;
    s.tone({ wave: 'triangle', freq: 1046.5 * pitch, when: t, duration: 0.3, volume: 0.45 * volume, env: E(0.002, 0.1, 0.7, 0.1), vibrato: { rate: 5, depth: 25, delay: 0.08 }, dest });
    s.tone({ wave: 'pulse', duty: 0.125, freq: 2093 * pitch, when: t, duration: 0.3, volume: 0.12 * volume, env: E(0.01, 0.1, 0.7, 0.1), vibrato: { rate: 5, depth: 25, delay: 0.08 }, dest });
    return 0.66;
  },
};

/** Every SFX name, in ARCHITECTURE.md order. */
export const SFX_NAMES = Object.freeze([
  'cursor', 'confirm', 'cancel', 'text_blip', 'hit', 'crit', 'miss', 'squelch', 'slime_pop', 'kraaang',
  'level_up', 'item', 'door', 'sneeze', 'feedback', 'drum_hit', 'cymbal', 'ko', 'flee', 'save',
]);

export default SFX;
