/**
 * sfx.js — named sound-effect recipes (docs/ARCHITECTURE.md §7 + the Chapter 1
 * list in docs/design-proposals/design_feel.md "SFX list").
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

  // ---------------------------------------------------------------------------
  // Chapter 1 additions (design_feel.md "SFX list" + design_systems.md). Every
  // recipe starts at `when` and is silent by the duration it returns.
  // ---------------------------------------------------------------------------

  /** Caption tick: triangle C5, 10 ms, volume 0.2. */
  caption_tick(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'triangle', freq: 523.25 * pitch, when, duration: 0.01, volume: 0.2 * volume, env: E(0.001, 0.008, 0.5, 0.012), dest });
    return 0.04;
  },

  /** Count click: 10 ms of band-passed noise at 0.5 (a stick click). */
  count_click(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.01, volume: 0.5 * volume, filter: { type: 'bandpass', freq: 3200 * pitch, Q: 1.2 }, dest });
    s.tone({ wave: 'triangle', freq: 1500 * pitch, when, duration: 0.006, volume: 0.2 * volume, env: E(0.001, 0.005, 0.3, 0.01), dest });
    return 0.05;
  },

  /** Stick click (count-in): the NES short-noise "tick" plus a wooden triangle blip. */
  stick_click(s, { when, volume, pitch, dest }) {
    s.noise({ mode: 'short', playbackRate: 2.5 * pitch, when, duration: 0.012, volume: 0.35 * volume, filter: { type: 'bandpass', freq: 4000, Q: 1 }, dest });
    s.tone({ wave: 'triangle', freq: 1200 * pitch, slideFrom: 1800 * pitch, slideTime: 0.01, when, duration: 0.01, volume: 0.3 * volume, env: E(0.001, 0.008, 0.3, 0.012), dest });
    return 0.05;
  },

  /** Eject: a 50 % pulse buzz on A2 for 200 ms, then a 500 ms noise swell as the pod fires. */
  eject(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.5, freq: 110 * pitch, when, duration: 0.2, volume: 0.35 * volume, env: E(0.004, 0.05, 0.8, 0.03), vibrato: { rate: 28, depth: 30 }, dest });
    s.noise({ when: when + 0.2, duration: 0.5, volume: 0.5 * volume, filter: { type: 'lowpass', freq: 700, freqTo: 5000, sweep: 0.45 }, env: E(0.3, 0.2, 0, 0.05), dest });
    return 0.8;
  },

  /** Static burst: 350 ms of white noise gated on/off every two frames (33 ms). */
  static_burst(s, { when, volume, dest }) {
    for (let i = 0; i < 6; i++) {
      s.noise({ when: when + i * 0.066, duration: 0.03, volume: 0.4 * volume, filter: { type: 'highpass', freq: 1500 }, env: E(0.001, 0.005, 1, 0.004), dest });
    }
    return 0.42;
  },

  /** Crash (the pod lands): 400 ms noise + a C1 triangle thump; the game adds a 6 px shake. */
  crash(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.4, volume: 0.65 * volume, filter: { type: 'lowpass', freq: 6000, freqTo: 800, sweep: 0.4 }, dest });
    s.tone({ wave: 'triangle', freq: 32.7 * pitch, slideFrom: 110 * pitch, slideTime: 0.06, when, duration: 0.3, volume: 0.6 * volume, env: E(0.001, 0.25, 0.3, 0.05), dest });
    s.tone({ wave: 'triangle', freq: 65.4 * pitch, slideFrom: 220 * pitch, slideTime: 0.06, when, duration: 0.18, volume: 0.3 * volume, env: E(0.001, 0.15, 0.2, 0.04), dest });
    return 0.55;
  },

  /** Pedal stomp: a triangle thump and a pulse click, 30 ms. */
  pedal_stomp(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'triangle', freq: 60 * pitch, slideFrom: 130 * pitch, slideTime: 0.03, when, duration: 0.04, volume: 0.6 * volume, env: E(0.001, 0.035, 0.2, 0.02), dest });
    s.tone({ wave: 'pulse', duty: 0.25, freq: 2000 * pitch, when, duration: 0.008, volume: 0.25 * volume, env: E(0.001, 0.006, 0.3, 0.01), dest });
    s.noise({ when, duration: 0.015, volume: 0.25 * volume, filter: { type: 'lowpass', freq: 2000 }, dest });
    return 0.09;
  },

  /** Coffee spill: a low 400 ms "pour" of band-passed noise with three glugs. */
  coffee_spill(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.4, volume: 0.24 * volume, filter: { type: 'bandpass', freq: 1400 * pitch, freqTo: 500 * pitch, sweep: 0.4, Q: 1 }, env: E(0.05, 0.32, 0, 0.03), dest });
    for (let i = 0; i < 3; i++) {
      s.tone({ wave: 'sine', freq: 150 * pitch, slideFrom: 320 * pitch, slideTime: 0.05, when: when + 0.08 + i * 0.11, duration: 0.05, volume: 0.25 * volume, env: E(0.004, 0.04, 0.3, 0.02), dest });
    }
    return 0.5;
  },

  /** Sparks: eight 20 ms 12.5 % pulse notes between C7 and C8 (a fixed "random" table so renders repeat). */
  sparks(s, { when, volume, pitch, dest }) {
    const freqs = [2093, 3136, 2637, 3951, 2349, 3520, 2794, 4186];
    freqs.forEach((f, i) => {
      s.tone({ wave: 'pulse', duty: 0.125, freq: f * pitch, when: when + i * 0.025, duration: 0.02, volume: 0.28 * volume, env: E(0.001, 0.012, 0.5, 0.01), dest });
      s.noise({ when: when + i * 0.025, duration: 0.008, volume: 0.15 * volume, filter: { type: 'highpass', freq: 6000 }, dest });
    });
    return 0.25;
  },

  /** Roof peel: two seconds of rising noise plus a triangle sliding C3 → C5 ("exactly like a sardine can"). */
  roof_peel(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 2.0, volume: 0.45 * volume, filter: { type: 'bandpass', freq: 500, freqTo: 3200, sweep: 1.9, Q: 0.8 }, env: E(1.6, 0.3, 0, 0.1), dest });
    s.tone({ wave: 'triangle', freq: 523.25 * pitch, slideFrom: 130.81 * pitch, slideTime: 1.9, when, duration: 1.9, volume: 0.35 * volume, env: E(0.3, 0.3, 0.8, 0.1), vibrato: { rate: 7, depth: 30, delay: 0.5 }, dest });
    s.noise({ mode: 'short', playbackRate: 0.5, rateTo: 1.8, rateTime: 1.9, when, duration: 1.9, volume: 0.1 * volume, filter: { type: 'bandpass', freq: 2500, Q: 2 }, env: E(1.2, 0.6, 0, 0.1), dest });
    return 2.1;
  },

  /** Wall blow: `crash` + `sparks` + a sub thump ("The walls blow outward."). */
  wall_blow(s, { when, volume, pitch, dest }) {
    SFX.crash(s, { when, volume, pitch, dest });
    SFX.sparks(s, { when: when + 0.05, volume: volume * 0.9, pitch, dest });
    s.tone({ wave: 'sine', freq: 45 * pitch, slideFrom: 120 * pitch, slideTime: 0.08, when, duration: 0.4, volume: 0.5 * volume, env: E(0.002, 0.3, 0.3, 0.08), dest });
    return 0.6;
  },

  /** Mohawk pop: a cork — 50 % pulse C5 → G5 in 30 ms with a click. */
  mohawk_pop(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.5, freq: 783.99 * pitch, slideFrom: 523.25 * pitch, slideTime: 0.03, when, duration: 0.03, volume: 0.35 * volume, env: E(0.001, 0.02, 0.6, 0.02), dest });
    s.noise({ when, duration: 0.008, volume: 0.3 * volume, filter: { type: 'lowpass', freq: 3500 }, dest });
    return 0.08;
  },

  /** Intercom buzz: a 12.5 % pulse on A3 at 0.1 with a mains-rate buzz (2 s version; retrigger while Dad talks). */
  intercom_buzz(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.125, freq: 220 * pitch, when, duration: 2.0, volume: 0.1 * volume, env: E(0.02, 0.05, 1, 0.05), vibrato: { rate: 50, depth: 8 }, dest });
    s.tone({ wave: 'pulse', duty: 0.125, freq: 220 * pitch, when, duration: 2.0, volume: 0.05 * volume, env: E(0.02, 0.05, 1, 0.05), detune: 7, dest });
    s.noise({ when, duration: 2.0, volume: 0.03 * volume, filter: { type: 'highpass', freq: 3000 }, env: E(0.02, 0.05, 1, 0.05), dest });
    return 2.1;
  },

  /** Glitch (the billboard): three 20 ms noise bursts and a pulse at three "random" pitches. */
  glitch(s, { when, volume, pitch, dest }) {
    const freqs = [1760, 932, 2489];
    freqs.forEach((f, i) => {
      s.noise({ when: when + i * 0.04, duration: 0.02, volume: 0.4 * volume, filter: { type: 'highpass', freq: 2000 }, dest });
      s.tone({ wave: 'pulse', duty: 0.5, freq: f * pitch, when: when + i * 0.04 + 0.01, duration: 0.02, volume: 0.25 * volume, env: E(0.001, 0.01, 0.6, 0.01), dest });
    });
    return 0.16;
  },

  /** Thud (a caption card lands): triangle C2 for 60 ms plus 20 ms of noise. */
  thud(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'triangle', freq: 65.41 * pitch, slideFrom: 130 * pitch, slideTime: 0.03, when, duration: 0.06, volume: 0.6 * volume, env: E(0.001, 0.05, 0.3, 0.03), dest });
    s.noise({ when, duration: 0.02, volume: 0.35 * volume, filter: { type: 'lowpass', freq: 1200 }, dest });
    return 0.12;
  },

  /** Door slam: 120 ms of noise at 0.8 and a C2 triangle for 100 ms; the game adds a 2 px shake. */
  door_slam(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.12, volume: 0.6 * volume, filter: { type: 'lowpass', freq: 2500, freqTo: 500, sweep: 0.12 }, dest });
    s.tone({ wave: 'triangle', freq: 65.41 * pitch, slideFrom: 100 * pitch, slideTime: 0.04, when, duration: 0.1, volume: 0.65 * volume, env: E(0.001, 0.08, 0.3, 0.05), dest });
    return 0.25;
  },

  /** Unplug (POP!): a 50 % pulse C4 for 20 ms over 15 ms of noise, with a sine pop underneath. */
  unplug(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.5, freq: 261.63 * pitch, when, duration: 0.02, volume: 0.35 * volume, env: E(0.001, 0.015, 0.4, 0.015), dest });
    s.noise({ when, duration: 0.015, volume: 0.4 * volume, filter: { type: 'lowpass', freq: 4000 }, dest });
    s.tone({ wave: 'sine', freq: 60 * pitch, slideFrom: 180 * pitch, slideTime: 0.04, when, duration: 0.045, volume: 0.45 * volume, env: E(0.001, 0.04, 0.3, 0.02), dest });
    return 0.1;
  },

  /** pop-pop-pop: three slime pops 70 ms apart, each a little higher. */
  pop_x3(s, { when, volume, pitch, dest }) {
    for (let i = 0; i < 3; i++) SFX.slime_pop(s, { when: when + i * 0.07, volume, pitch: pitch * (1 + i * 0.12), dest });
    return 0.3;
  },

  /** Amp hum: 60 Hz sawtooth + 120 Hz sine with a little hiss, 1.2 s. */
  amp_hum(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'sawtooth', freq: 60 * pitch, when, duration: 1.2, volume: 0.12 * volume, env: E(0.1, 0.1, 1, 0.1), dest });
    s.tone({ wave: 'sine', freq: 120 * pitch, when, duration: 1.2, volume: 0.08 * volume, env: E(0.1, 0.1, 1, 0.1), dest });
    s.noise({ when, duration: 1.2, volume: 0.02 * volume, filter: { type: 'highpass', freq: 4000 }, env: E(0.1, 0.1, 1, 0.1), dest });
    return 1.35;
  },

  /** KRATHOOM: a bigger, longer KRAAANG — the distorted chord with an E1 sub drop, 1.2 s. */
  krathoom(s, { when, volume, pitch, dest }) {
    const ctx = s.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.55 * volume;
    out.connect(dest || s.dest);
    const shaper = makeDistortion(ctx, 80, out);
    const env = E(0.005, 0.7, 0.35, 0.2);
    const chord = [82.41, 123.47, 164.81, 246.94]; // E2 B2 E3 B3
    let last = null;
    for (const f of chord) {
      for (const det of [-10, 10]) {
        last = s.tone({ wave: 'pulse', duty: 0.5, freq: f * pitch, slideFrom: f * pitch * 0.9, slideTime: 0.06, when, duration: 1.0, volume: 0.24, env, detune: det, vibrato: { rate: 5, depth: 18, delay: 0.3 }, dest: shaper });
      }
    }
    s.tone({ wave: 'sawtooth', freq: 41.2 * pitch, when, duration: 0.9, volume: 0.3, env, dest: shaper });
    s.tone({ wave: 'sine', freq: 30 * pitch, slideFrom: 82 * pitch, slideTime: 0.3, when, duration: 0.8, volume: 0.5 * volume, env: E(0.005, 0.6, 0.3, 0.15), dest });
    s.noise({ when, duration: 0.2, volume: 0.5, filter: { type: 'highpass', freq: 1500 }, dest: shaper });
    s.noise({ when: when + 0.02, duration: 0.5, volume: 0.3 * volume, filter: { type: 'lowpass', freq: 900 }, dest });
    if (last) last.onended = () => { try { shaper.disconnect(); out.disconnect(); } catch (_) { /* noop */ } };
    return 1.4;
  },

  /** DOOM: a 40 Hz sub-bass thump with a noise tail (the first word of The Eternity). */
  doom(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'sine', freq: 40 * pitch, slideFrom: 90 * pitch, slideTime: 0.08, when, duration: 0.45, volume: 0.7 * volume, env: E(0.002, 0.3, 0.3, 0.15), dest });
    s.tone({ wave: 'triangle', freq: 80 * pitch, slideFrom: 180 * pitch, slideTime: 0.08, when, duration: 0.3, volume: 0.3 * volume, env: E(0.002, 0.25, 0.2, 0.1), dest });
    s.noise({ when, duration: 0.5, volume: 0.3 * volume, filter: { type: 'lowpass', freq: 500 }, env: E(0.005, 0.5, 0, 0.05), dest });
    return 0.7;
  },

  /** CRACK: a sharp noise crack over a 50 Hz thump with a noise tail (the roof). */
  crack(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.018, volume: 0.6 * volume, filter: { type: 'highpass', freq: 1800 }, dest });
    s.tone({ wave: 'sine', freq: 50 * pitch, slideFrom: 140 * pitch, slideTime: 0.05, when, duration: 0.35, volume: 0.6 * volume, env: E(0.002, 0.25, 0.3, 0.12), dest });
    s.tone({ wave: 'triangle', freq: 100 * pitch, slideFrom: 300 * pitch, slideTime: 0.04, when, duration: 0.2, volume: 0.25 * volume, env: E(0.002, 0.15, 0.2, 0.08), dest });
    s.noise({ when: when + 0.01, duration: 0.4, volume: 0.25 * volume, filter: { type: 'bandpass', freq: 900, Q: 0.8 }, env: E(0.005, 0.4, 0, 0.05), dest });
    return 0.6;
  },

  /** THUD (the word): a 30 Hz sub-bass thump with a noise tail (the walls). */
  thud_word(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'sine', freq: 30 * pitch, slideFrom: 80 * pitch, slideTime: 0.1, when, duration: 0.5, volume: 0.75 * volume, env: E(0.002, 0.35, 0.3, 0.18), dest });
    s.tone({ wave: 'triangle', freq: 60 * pitch, slideFrom: 160 * pitch, slideTime: 0.1, when, duration: 0.35, volume: 0.3 * volume, env: E(0.002, 0.3, 0.2, 0.1), dest });
    s.noise({ when, duration: 0.6, volume: 0.28 * volume, filter: { type: 'lowpass', freq: 400 }, env: E(0.005, 0.6, 0, 0.05), dest });
    return 0.8;
  },

  /** Van keys: a jingle of metallic clicks and high triangle pings in two clusters. */
  van_keys(s, { when, volume, pitch, dest }) {
    const pings = [3200, 4100, 2900, 3700, 4500];
    [0, 0.25].forEach((off, c) => {
      pings.forEach((f, i) => {
        const t = when + off + i * 0.04 + c * 0.01;
        s.noise({ mode: 'short', playbackRate: 1.5 + i * 0.3, when: t, duration: 0.012, volume: 0.18 * volume, filter: { type: 'bandpass', freq: 6000, Q: 1.5 }, dest });
        s.tone({ wave: 'triangle', freq: f * pitch * (c ? 1.06 : 1), when: t, duration: 0.015, volume: 0.22 * volume, env: E(0.001, 0.012, 0.3, 0.02), dest });
      });
    });
    return 0.5;
  },

  /** Tear (the UI frame rips): a short noise zip plus a 12.5 % pulse zip down. */
  tear(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.09, volume: 0.4 * volume, filter: { type: 'bandpass', freq: 2500 * pitch, freqTo: 600 * pitch, sweep: 0.08, Q: 1.2 }, dest });
    s.tone({ wave: 'pulse', duty: 0.125, freq: 300 * pitch, slideFrom: 1200 * pitch, slideTime: 0.08, when, duration: 0.08, volume: 0.15 * volume, env: E(0.001, 0.06, 0.3, 0.02), dest });
    return 0.14;
  },

  /** Toon up (the meter fills a segment): two quick 25 % pulse notes E6 → B6 with a triangle ping. */
  toon_up(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.25, freq: 1318.5 * pitch, when, duration: 0.04, volume: 0.3 * volume, env: E(0.001, 0.03, 0.6, 0.02), dest });
    s.tone({ wave: 'pulse', duty: 0.25, freq: 1975.5 * pitch, when: when + 0.045, duration: 0.06, volume: 0.3 * volume, env: E(0.001, 0.04, 0.6, 0.03), dest });
    s.tone({ wave: 'triangle', freq: 987.77 * pitch, when: when + 0.045, duration: 0.06, volume: 0.25 * volume, env: E(0.001, 0.04, 0.6, 0.03), dest });
    return 0.15;
  },

  /** Gears (the garage door): six 20 ms noise clicks 80 ms apart; a pulse click whose pitch falls, then rises. */
  gears(s, { when, volume, pitch, dest }) {
    const clicks = [900, 700, 520, 520, 700, 900];
    clicks.forEach((f, i) => {
      const t = when + i * 0.08;
      s.noise({ mode: 'short', playbackRate: 0.6 * pitch, when: t, duration: 0.02, volume: 0.3 * volume, filter: { type: 'bandpass', freq: 1800, Q: 1 }, dest });
      s.tone({ wave: 'pulse', duty: 0.25, freq: f * pitch, when: t, duration: 0.015, volume: 0.18 * volume, env: E(0.001, 0.01, 0.4, 0.012), dest });
    });
    s.tone({ wave: 'pulse', duty: 0.25, freq: 90 * pitch, when, duration: 0.46, volume: 0.12 * volume, env: E(0.01, 0.05, 0.8, 0.04), vibrato: { rate: 18, depth: 50 }, dest });
    return 0.55;
  },

  /** Splash (the mohawk lands in a beer): low-passed noise swept down with four falling droplet chirps. */
  splash(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.3, volume: 0.45 * volume, filter: { type: 'lowpass', freq: 3000 * pitch, freqTo: 1200 * pitch, sweep: 0.3 }, env: E(0.01, 0.28, 0, 0.03), dest });
    for (let i = 0; i < 4; i++) {
      s.tone({ wave: 'sine', freq: 400 * pitch, slideFrom: 900 * pitch, slideTime: 0.03, when: when + 0.03 + i * 0.05, duration: 0.03, volume: 0.15 * volume, env: E(0.002, 0.025, 0.3, 0.02), dest });
    }
    return 0.4;
  },

  /** Phone ring: two 400 ms rings of an old bell — a 25 % pulse trilling A5/B5 every 40 ms over a metallic bed. */
  phone_ring(s, { when, volume, pitch, dest }) {
    for (let ring = 0; ring < 2; ring++) {
      const start = when + ring * 0.45;
      for (let i = 0; i < 10; i++) {
        const f = (i % 2 ? 987.77 : 880) * pitch; // B5 / A5
        s.tone({ wave: 'pulse', duty: 0.25, freq: f, when: start + i * 0.04, duration: 0.035, volume: 0.22 * volume, env: E(0.002, 0.02, 0.7, 0.01), dest });
      }
      s.noise({ mode: 'short', playbackRate: 2.2 * pitch, when: start, duration: 0.4, volume: 0.05 * volume, filter: { type: 'bandpass', freq: 5000, Q: 2 }, env: E(0.005, 0.1, 0.8, 0.05), dest });
    }
    return 0.95;
  },

  /** Click (UI): 6 ms of bright noise and a triangle tick. */
  click(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.006, volume: 0.4 * volume, filter: { type: 'highpass', freq: 3000 }, dest });
    s.tone({ wave: 'triangle', freq: 2000 * pitch, when, duration: 0.008, volume: 0.25 * volume, env: E(0.001, 0.006, 0.3, 0.01), dest });
    return 0.04;
  },

  /** Drone whine (the Vanguard drone): a 12.5 % pulse on E6 with an 8 Hz vibrato for 800 ms, rising a little, with a thin sawtooth under it. */
  drone_whine(s, { when, volume, pitch, dest }) {
    s.tone({ wave: 'pulse', duty: 0.125, freq: 1318.5 * pitch, slideFrom: 1174.7 * pitch, slideTime: 0.5, when, duration: 0.8, volume: 0.2 * volume, env: E(0.04, 0.1, 0.85, 0.08), vibrato: { rate: 8, depth: 45 }, dest });
    s.tone({ wave: 'sawtooth', freq: 659.26 * pitch, slideFrom: 587.33 * pitch, slideTime: 0.5, when, duration: 0.8, volume: 0.07 * volume, env: E(0.04, 0.1, 0.85, 0.08), vibrato: { rate: 8, depth: 45 }, dest });
    return 0.9;
  },

  /** Power chord (the first chord at Palmer's): E5 chord on three pulses through light distortion, slid into, 0.5 s. */
  power_chord(s, { when, volume, pitch, dest }) {
    const ctx = s.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.5 * volume;
    out.connect(dest || s.dest);
    const shaper = makeDistortion(ctx, 18, out);
    const env = E(0.003, 0.2, 0.6, 0.1);
    let last = null;
    for (const f of [164.81, 246.94, 329.63]) { // E3 B3 E4
      last = s.tone({ wave: 'pulse', duty: 0.5, freq: f * pitch, slideFrom: f * pitch * 0.95, slideTime: 0.03, when, duration: 0.45, volume: 0.3, env, vibrato: { rate: 5.5, depth: 10, delay: 0.2 }, dest: shaper });
    }
    s.tone({ wave: 'sawtooth', freq: 82.41 * pitch, when, duration: 0.42, volume: 0.22, env, dest: shaper });
    s.noise({ when, duration: 0.04, volume: 0.35, filter: { type: 'highpass', freq: 2500 }, dest: shaper });
    if (last) last.onended = () => { try { shaper.disconnect(); out.disconnect(); } catch (_) { /* noop */ } };
    return 0.6;
  },

  /** Hair back (whoosh): band-passed noise sweeping up over 250 ms. */
  hair_back(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.25, volume: 0.4 * volume, filter: { type: 'bandpass', freq: 400 * pitch, freqTo: 2500 * pitch, sweep: 0.22, Q: 1 }, env: E(0.08, 0.17, 0, 0.03), dest });
    return 0.35;
  },

  /** Rubble: eight low thuds at uneven spacing, fading, with pebble clicks. */
  rubble(s, { when, volume, pitch, dest }) {
    const times = [0, 0.09, 0.21, 0.27, 0.4, 0.55, 0.63, 0.82];
    times.forEach((t, i) => {
      const v = (1 - i * 0.09) * volume;
      s.noise({ when: when + t, duration: 0.05, volume: 0.35 * v, filter: { type: 'lowpass', freq: 600 }, dest });
      s.tone({ wave: 'triangle', freq: (55 + (i % 3) * 12) * pitch, slideFrom: 140 * pitch, slideTime: 0.03, when: when + t, duration: 0.05, volume: 0.4 * v, env: E(0.001, 0.04, 0.2, 0.03), dest });
      s.noise({ mode: 'short', playbackRate: 1.2 + (i % 4) * 0.4, when: when + t + 0.02, duration: 0.01, volume: 0.12 * v, filter: { type: 'bandpass', freq: 3000, Q: 1.5 }, dest });
    });
    return 1.0;
  },

  /** Chair (someone sits / scrapes): 60 ms of low noise with a wooden knock. */
  chair(s, { when, volume, pitch, dest }) {
    s.noise({ when, duration: 0.06, volume: 0.3 * volume, filter: { type: 'lowpass', freq: 700, freqTo: 250, sweep: 0.06 }, dest });
    s.tone({ wave: 'triangle', freq: 110 * pitch, slideFrom: 160 * pitch, slideTime: 0.02, when, duration: 0.04, volume: 0.3 * volume, env: E(0.001, 0.03, 0.2, 0.02), dest });
    return 0.12;
  },

  /** Jukebox 1–4: four two-second pulse jingles (the house-system song previews at Palmer's), each with a triangle root. */
  jukebox_1(s, o) { return jukebox(s, o, [523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 659.25, 523.25], 261.63); }, // C major, bouncy
  jukebox_2(s, o) { return jukebox(s, o, [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 440], 220); },               // A minor, mournful
  jukebox_3(s, o) { return jukebox(s, o, [587.33, 587.33, 739.99, 880, 739.99, 587.33, 659.25, 587.33], 293.66); },   // D major, boogie
  jukebox_4(s, o) { return jukebox(s, o, [392, 493.88, 587.33, 783.99, 587.33, 493.88, 392, 493.88], 196); },         // G major, waltz-ish
};

/** Shared body of the jukebox jingles: eight 8th notes at 240 BPM (2 s) on a 25 % pulse over a triangle root. */
function jukebox(s, { when, volume, pitch, dest }, notes, root) {
  notes.forEach((f, i) => {
    s.tone({ wave: 'pulse', duty: 0.25, freq: f * pitch, when: when + i * 0.25, duration: 0.2, volume: 0.26 * volume, env: E(0.003, 0.05, 0.7, 0.04), vibrato: { rate: 6, depth: 10, delay: 0.08 }, dest });
  });
  s.tone({ wave: 'triangle', freq: root * pitch, when, duration: 0.95, volume: 0.3 * volume, env: E(0.005, 0.05, 0.85, 0.05), dest });
  s.tone({ wave: 'triangle', freq: root * 1.5 * pitch, when: when + 1.0, duration: 0.95, volume: 0.3 * volume, env: E(0.005, 0.05, 0.85, 0.05), dest });
  return 2.1;
}

/** DESIGN.md calls the THUD word `thud_low`; it is the same recipe as `thud_word`. */
SFX.thud_low = SFX.thud_word;

/** Every SFX name: ARCHITECTURE.md's twenty, then the Chapter 1 additions. */
export const SFX_NAMES = Object.freeze([
  'cursor', 'confirm', 'cancel', 'text_blip', 'hit', 'crit', 'miss', 'squelch', 'slime_pop', 'kraaang',
  'level_up', 'item', 'door', 'sneeze', 'feedback', 'drum_hit', 'cymbal', 'ko', 'flee', 'save',
  'caption_tick', 'count_click', 'stick_click', 'eject', 'static_burst', 'crash', 'pedal_stomp', 'coffee_spill', 'sparks', 'roof_peel',
  'wall_blow', 'mohawk_pop', 'intercom_buzz', 'glitch', 'thud', 'door_slam', 'unplug', 'pop_x3', 'amp_hum', 'krathoom', 'doom', 'crack',
  'thud_word', 'thud_low', 'van_keys', 'tear', 'toon_up', 'gears', 'splash', 'phone_ring', 'click', 'drone_whine', 'power_chord', 'hair_back', 'rubble',
  'chair', 'jukebox_1', 'jukebox_2', 'jukebox_3', 'jukebox_4',
]);

export default SFX;
