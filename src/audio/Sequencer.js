/**
 * Sequencer.js — plays a song object (format: docs/ARCHITECTURE.md §7, annotated
 * example in src/audio/README.md) with lookahead scheduling.
 *
 * Timing model: everything is derived from `startTime` on the audio clock —
 * step N starts at `startTime + N * stepDur` — so timer jitter never accumulates.
 * A 25 ms setTimeout loop schedules every step that starts within the next 100 ms
 * (`lookahead`). When the song loops, the step counter keeps growing and only the
 * *song* step wraps, so loops are gap-free. Non-looping songs emit 'end'.
 *
 * Tab blur: Chrome throttles timers in hidden tabs, so on `visibilitychange` the
 * lookahead grows to 1.5 s. If the AudioContext is suspended (Phaser does that on
 * blur) the audio clock freezes with it, so playback resumes exactly in place.
 *
 * Offline: with an OfflineAudioContext there are no timers; call `play()` then
 * `scheduleUntil(seconds)` and render (see `renderSongOffline`).
 */

import { Synth, noteToMidi, midiToFreq, isOfflineContext } from './Synth.js';

export const LOOKAHEAD = 0.1; // seconds
export const TICK_INTERVAL = 25; // ms
export const HIDDEN_LOOKAHEAD = 1.5; // seconds, while document.hidden
export const ACCENT_GAIN = 1.4; // '!' multiplier
export const WAVES = Object.freeze(['pulse', 'square', 'triangle', 'sawtooth', 'saw', 'sine', 'noise']);

const NOTE_TOKEN_RE = /^([A-Ga-g][#b]?-?[0-9])([~!]*)$/;
const DRUM_TOKEN_RE = /^([kshoc])(!?)$/;

/** Split a pattern string into tokens. '|' is a cosmetic bar/beat separator and is ignored. */
export function tokenizePattern(str) {
  return String(str).trim().split(/\s+/).filter((t) => t && t !== '|');
}

/**
 * Parse one token. kind 'note' → {type:'rest'|'hold'|'note', note, midi, slide, accent};
 * kind 'drum' → {type:'rest'|'hold'|'drum', drum, accent}. Throws on garbage.
 */
export function parseToken(tok, kind = 'note') {
  if (tok === '.') return { type: 'rest' };
  if (tok === '=') return { type: 'hold' };
  if (kind === 'drum') {
    const m = DRUM_TOKEN_RE.exec(tok);
    if (!m) throw new Error(`bad drum token "${tok}" (expected k s h o c, '.', '=', optional '!')`);
    return { type: 'drum', drum: m[1], accent: m[2] === '!' };
  }
  const m = NOTE_TOKEN_RE.exec(tok);
  if (!m) throw new Error(`bad note token "${tok}" (expected e.g. C4, D#4, Eb3, '.', '=', suffix ~ or !)`);
  return { type: 'note', note: m[1], midi: noteToMidi(m[1]), slide: m[2].includes('~'), accent: m[2].includes('!') };
}

/** Returns a list of human-readable problems (empty when the song is valid). Strict: pattern length must equal stepsPerBar. */
export function validateSong(song) {
  const errs = [];
  if (!song || typeof song !== 'object') return ['song is not an object'];
  const id = song.id || '?';
  if (!song.id) errs.push('missing id');
  if (!(song.bpm > 0)) errs.push(`${id}: bpm must be > 0`);
  const beatsPerBar = song.beatsPerBar ?? 4;
  const stepsPerBeat = song.stepsPerBeat ?? 4;
  if (!(Number.isInteger(beatsPerBar) && beatsPerBar > 0)) errs.push(`${id}: beatsPerBar must be a positive integer`);
  if (!(Number.isInteger(stepsPerBeat) && stepsPerBeat > 0)) errs.push(`${id}: stepsPerBeat must be a positive integer`);
  const stepsPerBar = beatsPerBar * stepsPerBeat;
  if (!song.channels || typeof song.channels !== 'object' || !Object.keys(song.channels).length) errs.push(`${id}: no channels`);
  if (!Array.isArray(song.order) || !song.order.length) errs.push(`${id}: order must be a non-empty array (one entry per bar)`);
  if (errs.length) return errs;
  const loopStart = song.loopStart ?? 0;
  if (!(Number.isInteger(loopStart) && loopStart >= 0 && loopStart < song.order.length)) {
    errs.push(`${id}: loopStart must be a bar index in 0..${song.order.length - 1}`);
  }
  for (const [name, ch] of Object.entries(song.channels)) {
    if (!ch || typeof ch !== 'object') { errs.push(`${id}/${name}: channel is not an object`); continue; }
    if (!WAVES.includes(ch.wave)) errs.push(`${id}/${name}: wave must be one of ${WAVES.join(', ')}`);
    if (ch.volume != null && !(ch.volume >= 0)) errs.push(`${id}/${name}: volume must be >= 0`);
    if (!ch.patterns || typeof ch.patterns !== 'object') { errs.push(`${id}/${name}: missing patterns`); continue; }
    const kind = ch.wave === 'noise' ? 'drum' : 'note';
    for (const [pname, pat] of Object.entries(ch.patterns)) {
      if (typeof pat !== 'string') { errs.push(`${id}/${name}/${pname}: pattern must be a string`); continue; }
      const toks = tokenizePattern(pat);
      if (toks.length !== stepsPerBar) errs.push(`${id}/${name}/${pname}: ${toks.length} tokens, expected ${stepsPerBar}`);
      toks.forEach((t, i) => {
        try { parseToken(t, kind); } catch (e) { errs.push(`${id}/${name}/${pname} step ${i}: ${e.message}`); }
      });
    }
  }
  song.order.forEach((bar, b) => {
    if (!bar || typeof bar !== 'object') { errs.push(`${id}: order[${b}] is not an object`); return; }
    for (const [name, pname] of Object.entries(bar)) {
      const ch = song.channels[name];
      if (!ch) { errs.push(`${id}: order[${b}] names unknown channel "${name}"`); continue; }
      if (pname != null && !(ch.patterns && Object.prototype.hasOwnProperty.call(ch.patterns, pname))) {
        errs.push(`${id}: order[${b}].${name} = "${pname}" is not a pattern of that channel`);
      }
    }
  });
  return errs;
}

/**
 * Flatten a song into per-channel event lists indexed by absolute song step.
 * Holds ('=') extend the previous note, even across bars; a slide ('~') starts from
 * the previous note on the same channel. Short patterns are padded with rests.
 */
export function compileSong(song) {
  const bpm = song.bpm;
  const beatsPerBar = song.beatsPerBar ?? 4;
  const stepsPerBeat = song.stepsPerBeat ?? 4;
  const stepsPerBar = beatsPerBar * stepsPerBeat;
  const stepDur = 60 / bpm / stepsPerBeat;
  const bars = song.order.length;
  const totalSteps = bars * stepsPerBar;
  const loop = song.loop !== false;
  const loopStart = song.loopStart ?? 0;
  const loopStartStep = loopStart * stepsPerBar;
  const loopLen = totalSteps - loopStartStep;
  const songVolume = song.volume ?? 1;

  const channels = [];
  for (const [name, ch] of Object.entries(song.channels)) {
    const isNoise = ch.wave === 'noise';
    const kind = isNoise ? 'drum' : 'note';
    const tokens = [];
    song.order.forEach((bar) => {
      const pname = bar ? bar[name] : null;
      let toks = [];
      if (pname != null) {
        const pat = ch.patterns && ch.patterns[pname];
        if (pat == null) throw new Error(`Sequencer: ${song.id}/${name}: unknown pattern "${pname}"`);
        toks = tokenizePattern(pat).slice(0, stepsPerBar);
      }
      while (toks.length < stepsPerBar) toks.push('.');
      tokens.push(...toks);
    });
    const parsed = tokens.map((t, i) => {
      try { return parseToken(t, kind); } catch (e) { throw new Error(`Sequencer: ${song.id}/${name} step ${i}: ${e.message}`); }
    });
    const transpose = (ch.transpose || 0) + 12 * (ch.octave || 0);
    const events = [];
    let lastFreq = null;
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      if (p.type === 'rest' || p.type === 'hold') continue;
      if (p.type === 'drum') { events.push({ step: i, drum: p.drum, accent: p.accent }); continue; }
      let hold = 1;
      while (i + hold < parsed.length && parsed[i + hold].type === 'hold') hold++;
      const freq = midiToFreq(p.midi + transpose);
      events.push({ step: i, note: p.note, freq, holdSteps: hold, accent: p.accent, slideFrom: p.slide ? lastFreq : null });
      lastFreq = freq;
    }
    const byStep = new Map();
    for (const ev of events) {
      if (!byStep.has(ev.step)) byStep.set(ev.step, []);
      byStep.get(ev.step).push(ev);
    }
    channels.push({
      name, cfg: ch, wave: ch.wave, isNoise, volume: (ch.volume ?? 0.5) * songVolume,
      env: ch.env || null, events, byStep,
    });
  }
  return {
    id: song.id, bpm, beatsPerBar, stepsPerBeat, stepsPerBar, stepDur, bars, totalSteps,
    loop, loopStart, loopStartStep, loopLen, duration: totalSteps * stepDur, channels,
  };
}

export class Sequencer {
  /**
   * @param {object} o
   * @param {BaseAudioContext} o.context
   * @param {AudioNode} [o.destination]  default context.destination
   * @param {object} o.song              song object (§7)
   * @param {number} [o.volume=1]        this sequencer's gain (used for crossfades)
   * @param {number} [o.lookahead=0.1]   seconds
   * @param {number} [o.interval=25]     ms
   * @param {function} [o.onTick]        shorthand for on('tick', fn)
   * @param {function} [o.onEnd]         shorthand for on('end', fn)
   */
  constructor({ context, destination = null, song, volume = 1, lookahead = LOOKAHEAD, interval = TICK_INTERVAL, onTick = null, onEnd = null } = {}) {
    if (!context) throw new Error('Sequencer: context is required');
    if (!song) throw new Error('Sequencer: song is required');
    this.ctx = context;
    this.song = song;
    this.compiled = compileSong(song);
    this.offline = isOfflineContext(context);
    this.gain = context.createGain();
    this.gain.gain.value = volume;
    this.gain.connect(destination || context.destination);
    this.synth = new Synth(context, this.gain);
    this.baseLookahead = lookahead;
    this.lookahead = lookahead;
    this.interval = interval;
    this.startTime = 0;
    this.endTime = Infinity;
    this._state = 'idle'; // idle | playing | stopping | stopped | ended
    this._nextStep = 0;
    this._lastTickStep = -1;
    this._timer = null;
    this._fadeEnd = 0;
    this._listeners = { tick: new Set(), end: new Set(), stop: new Set() };
    if (onTick) this.on('tick', onTick);
    if (onEnd) this.on('end', onEnd);
    this._onVisibility = () => {
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      this.lookahead = hidden ? Math.max(this.baseLookahead, HIDDEN_LOOKAHEAD) : this.baseLookahead;
      this._pass();
    };
    this._onStateChange = () => { if (this.ctx.state === 'running') this._pass(); };
  }

  get isPlaying() { return this._state === 'playing'; }
  get state() { return this._state; }
  get stepDuration() { return this.compiled.stepDur; }
  /** Seconds of one pass through the song (intro included). */
  get duration() { return this.compiled.duration; }

  on(event, fn) { this._listeners[event].add(fn); return this; }
  off(event, fn) { this._listeners[event].delete(fn); return this; }
  _emit(event, payload) { for (const fn of Array.from(this._listeners[event])) { try { fn(payload, this); } catch (e) { console.error(e); } } }

  /** Start. `at` = absolute audio time of step 0 (default: now + 50 ms; 0 when offline). */
  play({ at = null } = {}) {
    if (this._state === 'playing') return this;
    if (this._state === 'stopping' || this._state === 'stopped' || this._state === 'ended') {
      throw new Error('Sequencer: cannot restart a stopped sequencer; create a new one');
    }
    const ctx = this.ctx;
    this.startTime = at ?? (this.offline ? 0 : ctx.currentTime + 0.05);
    this._nextStep = 0;
    this._lastTickStep = -1;
    this._state = 'playing';
    this.endTime = this.compiled.loop ? Infinity : this.startTime + this.compiled.duration + 0.15;
    if (!this.offline) {
      this._attach();
      this._pass();
      const loop = () => {
        if (this._state !== 'playing' && this._state !== 'stopping') return;
        this._pass();
        if (this._state === 'playing' || this._state === 'stopping') this._timer = setTimeout(loop, this.interval);
      };
      this._timer = setTimeout(loop, this.interval);
    }
    return this;
  }

  /** Stop; with `fade` (seconds) the music keeps playing under a gain ramp, then every voice is killed. */
  stop({ fade = 0 } = {}) {
    if (this._state !== 'playing') return this;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const f = this.offline ? 0 : Math.max(0, fade);
    this._state = 'stopping';
    const g = this.gain.gain;
    try {
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now);
      else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
      g.linearRampToValueAtTime(0, now + f + 0.005);
    } catch (_) { /* noop */ }
    this._fadeEnd = now + f;
    if (f === 0) this._finish();
    return this;
  }

  _finish() {
    try { this.synth.stopAll(this.ctx.currentTime, 0.01); } catch (_) { /* noop */ }
    this._clearTimer();
    this._detach();
    const g = this.gain;
    // Let the 10 ms voice fades finish before the bus is disconnected.
    const disconnect = () => { try { g.disconnect(); } catch (_) { /* noop */ } };
    if (this.offline || typeof setTimeout !== 'function') disconnect(); else setTimeout(disconnect, 60);
    this._state = 'stopped';
    this._emit('stop', this);
  }

  /** Gain of this sequencer (0..1), optionally ramped over `ramp` seconds. */
  setVolume(v, { ramp = 0 } = {}) {
    const g = this.gain.gain;
    const now = this.ctx.currentTime;
    const target = Math.max(0, v);
    try {
      if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now);
      else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
      if (ramp > 0) g.linearRampToValueAtTime(target, now + ramp);
      else g.setValueAtTime(target, now);
    } catch (_) {
      g.value = target;
    }
    return this;
  }

  /**
   * Current playback position (null when not playing). `step` grows forever;
   * `songStep` wraps at the loop; `bar`/`beat`/`stepInBar` describe the song position.
   */
  get position() {
    if (this._state !== 'playing' && this._state !== 'stopping') return null;
    const c = this.compiled;
    const t = this.ctx.currentTime - this.startTime;
    const step = Math.max(0, Math.floor(t / c.stepDur));
    let songStep = this._songStep(step);
    if (songStep < 0) songStep = c.totalSteps - 1;
    const loops = step < c.totalSteps ? 0 : 1 + Math.floor((step - c.totalSteps) / c.loopLen);
    const bar = Math.floor(songStep / c.stepsPerBar);
    const stepInBar = songStep % c.stepsPerBar;
    const beat = Math.floor(stepInBar / c.stepsPerBeat);
    const stepInBeat = stepInBar % c.stepsPerBeat;
    return {
      step, songStep, bar, beat, stepInBar, stepInBeat, loops, onBeat: stepInBeat === 0,
      time: t, stepTime: this.startTime + step * c.stepDur, bpm: c.bpm,
    };
  }

  _songStep(step) {
    const c = this.compiled;
    if (step < c.totalSteps) return step;
    if (!c.loop) return -1;
    return c.loopStartStep + ((step - c.loopStartStep) % c.loopLen);
  }

  /** Schedule every step that starts before `time` (absolute audio seconds). Returns the next unscheduled step. */
  scheduleUntil(time) {
    const c = this.compiled;
    for (;;) {
      const step = this._nextStep;
      const when = this.startTime + step * c.stepDur;
      if (when >= time) break;
      const songStep = this._songStep(step);
      if (songStep < 0) break;
      this._scheduleStep(songStep, when);
      this._nextStep++;
    }
    return this._nextStep;
  }

  _scheduleStep(songStep, when) {
    const c = this.compiled;
    for (const ch of c.channels) {
      const evs = ch.byStep.get(songStep);
      if (!evs) continue;
      for (const ev of evs) {
        const vol = ch.volume * (ev.accent ? ACCENT_GAIN : 1);
        if (ch.isNoise) {
          this.synth.drum(ev.drum, { when, volume: vol });
          continue;
        }
        const gate = Math.max(0.01, ev.holdSteps * c.stepDur - Math.min(0.012, c.stepDur * 0.15));
        this.synth.tone({
          wave: ch.wave, duty: ch.cfg.duty, freq: ev.freq, when, duration: gate, volume: vol,
          env: ch.env, slideFrom: ev.slideFrom || undefined,
          slideTime: ch.cfg.slideTime ?? Math.min(0.08, c.stepDur * 0.9),
          vibrato: ch.cfg.vibrato, detune: ch.cfg.detune,
        });
      }
    }
  }

  _pass() {
    if (this._state !== 'playing' && this._state !== 'stopping') return;
    const now = this.ctx.currentTime;
    if (this._state === 'stopping' && now >= this._fadeEnd) { this._finish(); return; }
    this.scheduleUntil(now + this.lookahead);
    if (this._state === 'playing') {
      const pos = this.position;
      if (pos && pos.step !== this._lastTickStep) {
        this._lastTickStep = pos.step;
        this._emit('tick', pos);
      }
      if (now >= this.endTime) {
        this._state = 'playing'; // _finish expects a live state
        this._finish();
        this._state = 'ended';
        this._emit('end', this);
      }
    }
  }

  _clearTimer() {
    if (this._timer != null) { clearTimeout(this._timer); this._timer = null; }
  }

  _attach() {
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', this._onVisibility);
    if (typeof this.ctx.addEventListener === 'function') this.ctx.addEventListener('statechange', this._onStateChange);
  }

  _detach() {
    if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('visibilitychange', this._onVisibility);
    if (typeof this.ctx.removeEventListener === 'function') this.ctx.removeEventListener('statechange', this._onStateChange);
  }
}

/**
 * Render `seconds` of a song with an OfflineAudioContext (loops included).
 * @returns {Promise<AudioBuffer>}
 */
export function renderSongOffline(song, { seconds = 2, sampleRate = 44100, channels = 1, volume = 1 } = {}) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OAC) return Promise.reject(new Error('OfflineAudioContext is not available'));
  const ctx = new OAC(channels, Math.ceil(seconds * sampleRate), sampleRate);
  const seq = new Sequencer({ context: ctx, destination: ctx.destination, song, volume });
  seq.play({ at: 0 });
  seq.scheduleUntil(seconds);
  return ctx.startRendering();
}

export default Sequencer;
