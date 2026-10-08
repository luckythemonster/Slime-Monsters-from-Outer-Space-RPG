/**
 * Synth.js — chip-style (NES/SNES-ish) voice factory on top of the WebAudio API.
 *
 * Plain ES module, no Phaser. Every function takes a BaseAudioContext (realtime
 * AudioContext or OfflineAudioContext) and a destination AudioNode, and schedules
 * by absolute `when` time (seconds on `context.currentTime`).
 *
 * Timbres
 * - pulse: duty 12.5% / 25% / 50% (any 0.05..0.95 works) built as a PeriodicWave from
 *   the Fourier series of a DC-free rectangular wave:
 *     real[n] = 2·sin(2πn·d)/(πn)      (cosine terms)
 *     imag[n] = 2·(1 − cos(2πn·d))/(πn) (sine terms)
 *   with `disableNormalization: true` so every duty has the same peak-to-peak
 *   amplitude (2, like a built-in 'square'), which is how the NES APU behaves:
 *   narrow duties sound thinner and quieter. 64 harmonics; Chrome band-limits
 *   PeriodicWaves per octave so there is no aliasing at high pitches. One wave per
 *   (context, duty) is cached in a WeakMap. (We do NOT use the two-phase-offset-
 *   sawtooth trick: it needs two oscillators + a delay per note, and this is cheaper.)
 * - triangle / sawtooth / sine: the built-in OscillatorNode types.
 * - noise: an AudioBufferSourceNode looping a cached buffer. 'white' is 2 s of
 *   deterministic PRNG noise; 'short' is a 93-sample NES-style LFSR loop (the APU's
 *   "mode 1" metallic buzz), pitched with `playbackRate`.
 * - drums (k s h o c): kick = pitched-down triangle burst + noise click; snare =
 *   high-passed noise burst + short pitched triangle; closed/open hat = high-passed
 *   noise, 30 ms / 200 ms; crash = long high-passed noise + metallic 'short' noise.
 *
 * Every voice gets an ADSR-ish envelope through gain automation, optional pitch
 * slide (`slideFrom` → `freq` over `slideTime`, exponential), optional vibrato (LFO
 * on `detune`, in cents). Nodes are created per note and stop/disconnect themselves
 * on `ended`. Volumes are linear gain 0..1 (accents may exceed 1).
 */

const TWO_PI = Math.PI * 2;
const NOTE_OFFSETS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NOTE_RE = /^([A-Ga-g])([#b]?)(-?[0-9])$/;

/** Default ADSR for melodic voices (seconds / sustain fraction). */
export const DEFAULT_ENV = Object.freeze({ attack: 0.004, decay: 0.04, sustain: 0.8, release: 0.03 });
/** The three NES duty cycles (any other value between 0.05 and 0.95 also works). */
export const PULSE_DUTIES = Object.freeze([0.125, 0.25, 0.5]);
export const PULSE_HARMONICS = 64;
/** Noise-channel tokens → drum names. */
export const DRUM_NAMES = Object.freeze({ k: 'kick', s: 'snare', h: 'hat', o: 'ohat', c: 'crash' });

const DRUM_ALIASES = {
  k: 'kick', kick: 'kick',
  s: 'snare', snare: 'snare',
  h: 'hat', hat: 'hat', hh: 'hat', closed_hat: 'hat',
  o: 'ohat', ohat: 'ohat', open_hat: 'ohat',
  c: 'crash', crash: 'crash', cymbal: 'crash',
};

/** 'C4' → 60. Accepts sharps (#) and flats (b); octave -1..9. */
export function noteToMidi(name) {
  const m = NOTE_RE.exec(String(name).trim());
  if (!m) throw new Error(`Synth: bad note name "${name}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + NOTE_OFFSETS[m[1].toLowerCase()] + acc;
}

/** MIDI number → Hz (A4 = 440). */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 'C4' → 261.63 Hz. */
export function noteToFreq(name) {
  return midiToFreq(noteToMidi(name));
}

/** True for an OfflineAudioContext (no timers, schedule everything up front). */
export function isOfflineContext(ctx) {
  return !!ctx && typeof ctx.startRendering === 'function';
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Pulse waves (PeriodicWave, cached per context + duty)
// ---------------------------------------------------------------------------

const pulseWaveCache = new WeakMap();

/** PeriodicWave for a rectangular wave with the given duty (fraction of the period spent high). */
export function getPulseWave(ctx, duty = 0.5) {
  let byDuty = pulseWaveCache.get(ctx);
  if (!byDuty) {
    byDuty = new Map();
    pulseWaveCache.set(ctx, byDuty);
  }
  const d = clamp(Number(duty) || 0.5, 0.05, 0.95);
  const key = d.toFixed(4);
  let wave = byDuty.get(key);
  if (!wave) {
    const n = PULSE_HARMONICS;
    const real = new Float32Array(n + 1);
    const imag = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) {
      real[k] = (2 * Math.sin(TWO_PI * k * d)) / (Math.PI * k);
      imag[k] = (2 * (1 - Math.cos(TWO_PI * k * d))) / (Math.PI * k);
    }
    wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    byDuty.set(key, wave);
  }
  return wave;
}

// ---------------------------------------------------------------------------
// Noise buffers (cached per context)
// ---------------------------------------------------------------------------

const noiseCache = new WeakMap();

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shared noise buffer. mode 'white' = 2 s of PRNG noise (deterministic, so offline
 * renders are reproducible); 'short' = 93-sample NES LFSR loop (metallic buzz).
 */
export function getNoiseBuffer(ctx, mode = 'white') {
  let byMode = noiseCache.get(ctx);
  if (!byMode) {
    byMode = {};
    noiseCache.set(ctx, byMode);
  }
  if (byMode[mode]) return byMode[mode];
  let buffer;
  if (mode === 'short') {
    // NES APU noise, "mode 1": 15-bit LFSR, feedback = bit0 XOR bit6 → 93-step pattern.
    const len = 93;
    buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lfsr = 1;
    for (let i = 0; i < len; i++) {
      const bit = (lfsr ^ (lfsr >> 6)) & 1;
      lfsr = (lfsr >> 1) | (bit << 14);
      data[i] = lfsr & 1 ? 1 : -1;
    }
  } else {
    const len = Math.floor(ctx.sampleRate * 2);
    buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const rnd = mulberry32(0x5eed);
    for (let i = 0; i < len; i++) data[i] = rnd() * 2 - 1;
  }
  byMode[mode] = buffer;
  return buffer;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** WaveShaper soft-clip distortion. `amount` 0 (clean) .. ~100 (fuzz). */
export function makeDistortion(ctx, amount = 40, dest = null) {
  const shaper = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  const k = Math.max(0, amount);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  if (dest) shaper.connect(dest);
  return shaper;
}

/**
 * ADSR through gain automation. `gate` = seconds the note is "held" (attack+decay+
 * sustain happen inside it), then `release` to zero. Returns the time the voice is
 * fully silent. Linear ramps (chip style); never schedules out of time order.
 */
export function scheduleEnvelope(param, when, gate, peak, env = DEFAULT_ENV) {
  const a = Math.max(0.001, env.attack ?? DEFAULT_ENV.attack);
  const d = Math.max(0.001, env.decay ?? DEFAULT_ENV.decay);
  const s = clamp(env.sustain ?? DEFAULT_ENV.sustain, 0, 1);
  const r = Math.max(0.004, env.release ?? DEFAULT_ENV.release);
  const g = Math.max(0.002, gate);
  const off = when + g;
  param.setValueAtTime(0, when);
  if (g <= a) {
    param.linearRampToValueAtTime(peak * (g / a), off);
  } else {
    param.linearRampToValueAtTime(peak, when + a);
    const decayEnd = when + a + d;
    if (off < decayEnd) {
      const frac = (off - (when + a)) / d;
      param.linearRampToValueAtTime(peak + (peak * s - peak) * frac, off);
    } else {
      param.linearRampToValueAtTime(peak * s, decayEnd);
      param.setValueAtTime(peak * s, off);
    }
  }
  param.linearRampToValueAtTime(0, off + r);
  return off + r;
}

function holdParam(param, at) {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(at);
  } else {
    param.cancelScheduledValues(at);
    param.setValueAtTime(param.value, at);
  }
}

function makeHandle(ctx, sources, nodes, gainParam, end) {
  const primary = sources[0];
  const handle = {
    end,
    done: false,
    onended: null,
    /** Fade out quickly and stop early (default 15 ms fade). */
    stop(at = ctx.currentTime, fade = 0.015) {
      if (handle.done) return;
      const t = Math.max(at, ctx.currentTime);
      try {
        holdParam(gainParam, t);
        gainParam.linearRampToValueAtTime(0, t + fade);
      } catch (_) { /* param already finished */ }
      const stopAt = Math.min(t + fade + 0.005, end + 0.01);
      for (const s of sources) {
        if (!s) continue;
        try { s.stop(stopAt); } catch (_) { /* already stopped */ }
      }
    },
  };
  primary.onended = () => {
    handle.done = true;
    for (const n of sources) if (n) { try { n.disconnect(); } catch (_) { /* noop */ } }
    for (const n of nodes) if (n) { try { n.disconnect(); } catch (_) { /* noop */ } }
    if (handle.onended) handle.onended(handle);
  };
  return handle;
}

function groupHandles(handles) {
  const list = handles.filter(Boolean);
  const group = {
    end: Math.max(...list.map((h) => h.end)),
    handles: list,
    get done() { return list.every((h) => h.done); },
    stop(at, fade) { for (const h of list) h.stop(at, fade); },
  };
  return group;
}

// ---------------------------------------------------------------------------
// Synth
// ---------------------------------------------------------------------------

export class Synth {
  /**
   * @param {BaseAudioContext} context
   * @param {AudioNode} [destination] default output for every voice (context.destination if omitted)
   */
  constructor(context, destination = null) {
    this.ctx = context;
    this.dest = destination || context.destination;
    /** Live voice handles (removed automatically when a voice ends). */
    this.active = new Set();
  }

  get now() {
    return this.ctx.currentTime;
  }

  _track(handle) {
    this.active.add(handle);
    const prev = handle.onended;
    handle.onended = (h) => {
      this.active.delete(handle);
      if (prev) prev(h);
    };
    return handle;
  }

  /**
   * Melodic voice.
   * @param {object} o
   * @param {'pulse'|'square'|'triangle'|'sawtooth'|'saw'|'sine'} [o.wave='pulse']
   * @param {number} [o.duty=0.5]        pulse duty (0.125 / 0.25 / 0.5)
   * @param {number} [o.freq]            Hz (or pass o.note = 'C4')
   * @param {string} [o.note]
   * @param {number} [o.when]            absolute start time (default now)
   * @param {number} [o.duration=0.2]    gate length in seconds (release follows)
   * @param {number} [o.volume=0.5]      linear gain
   * @param {object} [o.env]             { attack, decay, sustain, release }
   * @param {number} [o.slideFrom]       start pitch of a slide into `freq`
   * @param {number} [o.slideTime=0.06]  seconds for the slide
   * @param {object} [o.vibrato]         { rate: Hz, depth: cents, delay?: s }
   * @param {number} [o.detune=0]        cents
   * @param {AudioNode} [o.dest]
   * @returns {{ end: number, stop(at?, fade?): void, done: boolean }}
   */
  tone(o = {}) {
    const ctx = this.ctx;
    const when = o.when ?? ctx.currentTime;
    const dest = o.dest || this.dest;
    const freq = Math.max(1, o.freq ?? (o.note != null ? noteToFreq(o.note) : 440));
    const wave = o.wave || 'pulse';

    const osc = ctx.createOscillator();
    if (wave === 'pulse' || wave === 'square') {
      osc.setPeriodicWave(getPulseWave(ctx, wave === 'square' ? 0.5 : o.duty ?? 0.5));
    } else if (wave === 'saw') {
      osc.type = 'sawtooth';
    } else {
      osc.type = wave;
    }

    const slideFrom = o.slideFrom;
    if (slideFrom > 0 && Math.abs(slideFrom - freq) > 0.01) {
      osc.frequency.setValueAtTime(slideFrom, when);
      osc.frequency.exponentialRampToValueAtTime(freq, when + Math.max(0.005, o.slideTime ?? 0.06));
    } else {
      osc.frequency.setValueAtTime(freq, when);
    }
    if (o.detune) osc.detune.setValueAtTime(o.detune, when);

    const gain = ctx.createGain();
    const env = o.env ? { ...DEFAULT_ENV, ...o.env } : DEFAULT_ENV;
    const end = scheduleEnvelope(gain.gain, when, o.duration ?? 0.2, Math.max(0, o.volume ?? 0.5), env);
    osc.connect(gain);
    gain.connect(dest);

    let lfo = null;
    let lfoGain = null;
    const vib = o.vibrato;
    if (vib && vib.depth > 0) {
      lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = vib.rate ?? 6;
      lfoGain = ctx.createGain();
      if (vib.delay > 0) {
        lfoGain.gain.setValueAtTime(0, when);
        lfoGain.gain.linearRampToValueAtTime(vib.depth, when + vib.delay);
      } else {
        lfoGain.gain.value = vib.depth;
      }
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(when);
      lfo.stop(end + 0.01);
    }

    osc.start(when);
    osc.stop(end + 0.01);
    return this._track(makeHandle(ctx, [osc, lfo], [gain, lfoGain], gain.gain, end));
  }

  /**
   * Noise voice (percussive by default: 1 ms attack, linear decay over `duration`).
   * @param {object} o
   * @param {'white'|'short'} [o.mode='white']
   * @param {number} [o.when]
   * @param {number} [o.duration=0.1]
   * @param {number} [o.volume=0.5]
   * @param {object} [o.env]               override ADSR (default decay = duration, sustain 0)
   * @param {object} [o.filter]            { type, freq, freqTo?, sweep?, Q }
   * @param {number} [o.playbackRate=1]    pitch of the loop (mostly for 'short')
   * @param {number} [o.rateTo]            ramp playbackRate to this over o.rateTime
   * @param {number} [o.offset=0]          start offset into the buffer (seconds)
   * @param {AudioNode} [o.dest]
   */
  noise(o = {}) {
    const ctx = this.ctx;
    const when = o.when ?? ctx.currentTime;
    const dest = o.dest || this.dest;
    const duration = o.duration ?? 0.1;

    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx, o.mode || 'white');
    src.loop = true;
    src.playbackRate.setValueAtTime(o.playbackRate ?? 1, when);
    if (o.rateTo > 0) src.playbackRate.exponentialRampToValueAtTime(o.rateTo, when + (o.rateTime ?? duration));

    let node = src;
    let filter = null;
    if (o.filter) {
      filter = ctx.createBiquadFilter();
      filter.type = o.filter.type || 'highpass';
      filter.frequency.setValueAtTime(o.filter.freq ?? 4000, when);
      if (o.filter.freqTo > 0) {
        filter.frequency.exponentialRampToValueAtTime(o.filter.freqTo, when + (o.filter.sweep ?? duration));
      }
      filter.Q.value = o.filter.Q ?? 0.7;
      src.connect(filter);
      node = filter;
    }

    const gain = ctx.createGain();
    const env = { attack: 0.001, decay: duration, sustain: 0, release: 0.01, ...(o.env || {}) };
    const end = scheduleEnvelope(gain.gain, when, duration, Math.max(0, o.volume ?? 0.5), env);
    node.connect(gain);
    gain.connect(dest);
    src.start(when, o.offset ?? 0);
    src.stop(end + 0.01);
    return this._track(makeHandle(ctx, [src], [filter, gain], gain.gain, end));
  }

  /**
   * Drum hit. name: 'k'|'kick', 's'|'snare', 'h'|'hat', 'o'|'ohat', 'c'|'crash'.
   * @param {object} [o] { when, volume = 1, dest }
   */
  drum(name, o = {}) {
    const kind = DRUM_ALIASES[name];
    if (!kind) throw new Error(`Synth: unknown drum "${name}"`);
    const when = o.when ?? this.ctx.currentTime;
    const vol = o.volume ?? 1;
    const dest = o.dest || this.dest;
    switch (kind) {
      case 'kick':
        return groupHandles([
          this.tone({
            wave: 'triangle', freq: 48, slideFrom: 170, slideTime: 0.07, when, duration: 0.11,
            volume: 1.0 * vol, env: { attack: 0.001, decay: 0.1, sustain: 0.25, release: 0.06 }, dest,
          }),
          this.noise({ when, duration: 0.012, volume: 0.35 * vol, filter: { type: 'lowpass', freq: 2500 }, dest }),
        ]);
      case 'snare':
        return groupHandles([
          this.noise({ when, duration: 0.11, volume: 0.6 * vol, filter: { type: 'highpass', freq: 1400, Q: 0.5 }, dest }),
          this.tone({
            wave: 'triangle', freq: 150, slideFrom: 220, slideTime: 0.03, when, duration: 0.05,
            volume: 0.5 * vol, env: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }, dest,
          }),
        ]);
      case 'hat':
        return this.noise({ when, duration: 0.03, volume: 0.3 * vol, filter: { type: 'highpass', freq: 8000 }, dest });
      case 'ohat':
        return this.noise({ when, duration: 0.2, volume: 0.28 * vol, filter: { type: 'highpass', freq: 7000 }, dest });
      case 'crash':
        return groupHandles([
          this.noise({ when, duration: 0.65, volume: 0.4 * vol, filter: { type: 'highpass', freq: 5000 }, dest }),
          this.noise({
            mode: 'short', playbackRate: 1.9, when, duration: 0.35, volume: 0.12 * vol,
            filter: { type: 'bandpass', freq: 6500, Q: 1.2 }, dest,
          }),
        ]);
      default:
        throw new Error(`Synth: unknown drum "${name}"`);
    }
  }

  /** Stop every live voice (quick fade). */
  stopAll(at = this.ctx.currentTime, fade = 0.015) {
    for (const h of Array.from(this.active)) h.stop(at, fade);
  }

  /** Distortion node routed to `dest` (default this.dest). Disconnect it yourself when done. */
  distortion(amount = 40, dest = null) {
    return makeDistortion(this.ctx, amount, dest || this.dest);
  }
}

export default Synth;
