/**
 * AudioEngine.js — the game's audio front door (docs/ARCHITECTURE.md §7, §12.5).
 *
 *   import { AudioEngine } from './audio/AudioEngine.js';
 *   const audio = AudioEngine.fromPhaser(game.sound);   // or new AudioEngine({ context, destination })
 *   audio.playMusic('title', { fade: 0.5 });
 *   audio.sfx('confirm');
 *
 * Graph: [Sequencer gain]* → musicBus ─┐
 *                                      ├→ master (mute) → limiter → destination
 *        SFX voices        → sfxBus  ─┘
 *
 * Works with any BaseAudioContext. With an OfflineAudioContext nothing is timer
 * driven: `playMusic` returns the Sequencer, call `seq.scheduleUntil(seconds)` and
 * render (see `AudioEngine.renderOffline`).
 */

import { Sequencer, validateSong } from './Sequencer.js';
import { Synth, isOfflineContext } from './Synth.js';
import { SFX, SFX_NAMES } from './sfx.js';
import SONGS from './songs/index.js';

export const DEFAULT_VOLUMES = Object.freeze({ music: 0.7, sfx: 0.8 });
const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'touchstart', 'mousedown', 'click'];

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

function createAudioContext() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) throw new Error('AudioEngine: WebAudio is not available');
  return new AC();
}

function setParam(param, value, now, ramp = 0.02) {
  try {
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
    param.linearRampToValueAtTime(value, now + ramp);
  } catch (_) {
    param.value = value;
  }
}

/** RMS of an AudioBuffer (all channels) between `from` and `to` seconds. */
export function bufferRms(buffer, from = 0, to = buffer.duration) {
  const sr = buffer.sampleRate;
  const a = Math.max(0, Math.floor(from * sr));
  const b = Math.min(buffer.length, Math.ceil(to * sr));
  if (b <= a) return 0;
  let sum = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = a; i < b; i++) sum += d[i] * d[i];
  }
  return Math.sqrt(sum / ((b - a) * buffer.numberOfChannels));
}

/** Peak absolute sample of an AudioBuffer. */
export function bufferPeak(buffer) {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
  }
  return peak;
}

export class AudioEngine {
  /**
   * @param {object} [o]
   * @param {BaseAudioContext} [o.context]   Phaser's `sound.context`; created (and gesture-unlocked) if omitted
   * @param {AudioNode} [o.destination]      Phaser's `sound.destination`; default context.destination
   * @param {object} [o.songs]               id → song map (default: src/audio/songs/index.js)
   * @param {number} [o.music=0.7]           music bus gain
   * @param {number} [o.sfx=0.8]             sfx bus gain
   * @param {boolean} [o.limiter=true]       DynamicsCompressor safety limiter on the master
   * @param {boolean} [o.unlock=true]        when the engine owns the context, resume it on first key/pointer
   */
  constructor({ context = null, destination = null, songs = SONGS, music = DEFAULT_VOLUMES.music, sfx = DEFAULT_VOLUMES.sfx, limiter = true, unlock = true } = {}) {
    let ownsContext = false;
    if (!context) { context = createAudioContext(); ownsContext = true; }
    this.context = context;
    this.ownsContext = ownsContext;
    this.offline = isOfflineContext(context);
    this.destination = destination || context.destination;

    this.master = context.createGain();
    let tail = this.master;
    this.limiter = null;
    if (limiter && typeof context.createDynamicsCompressor === 'function') {
      const comp = context.createDynamicsCompressor();
      comp.threshold.value = -8;
      comp.knee.value = 6;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.12;
      this.master.connect(comp);
      tail = comp;
      this.limiter = comp;
    }
    tail.connect(this.destination);
    this.musicBus = context.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = context.createGain();
    this.sfxBus.connect(this.master);
    this.synth = new Synth(context, this.sfxBus);

    this.songs = new Map();
    for (const song of Object.values(songs || {})) this.registerSong(song);

    this._volumes = { music: clamp01(music), sfx: clamp01(sfx) };
    this._muted = false;
    this._applyVolumes(0);
    this.current = null; // { id, seq }
    this._fading = new Set();
    this._unlock = null;
    this._warned = new Set();
    if (ownsContext && unlock) this.unlockOnGesture();
  }

  /** Build from a Phaser sound manager (`game.sound` / `scene.sound`); falls back to an own context. */
  static fromPhaser(sound, opts = {}) {
    const ctx = sound && sound.context;
    if (ctx && typeof ctx.createGain === 'function') {
      return new AudioEngine({ context: ctx, destination: sound.destination || ctx.destination, ...opts });
    }
    return new AudioEngine(opts);
  }

  // --- songs -----------------------------------------------------------------

  /** Validate and register a song object (§7). Throws with every problem listed. */
  registerSong(song) {
    const errs = validateSong(song);
    if (errs.length) throw new Error(`AudioEngine.registerSong(${song && song.id}): ${errs.join('; ')}`);
    this.songs.set(song.id, song);
    return song;
  }

  hasSong(id) { return this.songs.has(id); }
  get songIds() { return Array.from(this.songs.keys()); }
  get sfxNames() { return SFX_NAMES; }

  // --- music -----------------------------------------------------------------

  /** Id of the song that is playing (or fading in), else null. */
  get currentMusic() { return this.current ? this.current.id : null; }
  /** The live Sequencer (position, ticks) or null. */
  get sequencer() { return this.current ? this.current.seq : null; }

  /**
   * Play a registered song, crossfading from whatever is playing.
   * Same song already playing → no-op unless `restart`. `playMusic(null)` = stopMusic.
   * @returns {Sequencer|null}
   */
  playMusic(id, { fade = 0.5, restart = false, volume = 1 } = {}) {
    if (id == null) { this.stopMusic({ fade }); return null; }
    const song = this.songs.get(id);
    if (!song) { this._warn(`unknown song "${id}"`); return null; }
    if (this.current && this.current.id === id && this.current.seq.isPlaying && !restart) return this.current.seq;
    const f = this.offline ? 0 : Math.max(0, fade);
    this._stopCurrent(f);
    const seq = new Sequencer({ context: this.context, destination: this.musicBus, song, volume: f > 0 ? 0 : volume });
    const entry = { id, seq };
    this.current = entry;
    seq.on('end', () => { if (this.current === entry) this.current = null; });
    seq.play();
    if (f > 0) seq.setVolume(volume, { ramp: f });
    return seq;
  }

  /** Fade out and stop the current song. */
  stopMusic({ fade = 0.5 } = {}) {
    this._stopCurrent(this.offline ? 0 : Math.max(0, fade));
    return this;
  }

  _stopCurrent(fade) {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    this._fading.add(cur.seq);
    cur.seq.on('stop', () => this._fading.delete(cur.seq));
    cur.seq.stop({ fade });
  }

  /** True while any song is playing or still fading out. */
  get isMusicPlaying() { return !!this.current || this._fading.size > 0; }

  // --- sfx ---------------------------------------------------------------------

  /**
   * Play a named SFX (§7 list). Returns its approximate duration in seconds (0 if unknown).
   * @param {object} [o] { volume = 1, pitch = 1, delay = 0 (seconds) }
   */
  sfx(name, { volume = 1, pitch = 1, delay = 0 } = {}) {
    const recipe = SFX[name];
    if (!recipe) { this._warn(`unknown sfx "${name}"`); return 0; }
    const when = this.context.currentTime + Math.max(0, delay);
    return recipe(this.synth, { when, volume, pitch, dest: this.sfxBus });
  }

  // --- volume ----------------------------------------------------------------

  /** `setVolume({ music, sfx })` or `setVolume(music, sfx)`; omitted/null values are kept. Linear 0..1. */
  setVolume(music, sfx) {
    if (music && typeof music === 'object') ({ music, sfx } = music);
    if (music != null) this._volumes.music = clamp01(music);
    if (sfx != null) this._volumes.sfx = clamp01(sfx);
    this._applyVolumes();
    return this;
  }

  get volumes() { return { ...this._volumes }; }

  mute(on = true) {
    this._muted = !!on;
    this._applyVolumes();
    return this;
  }

  get isMuted() { return this._muted; }

  _applyVolumes(ramp = 0.02) {
    const now = this.context.currentTime;
    setParam(this.master.gain, this._muted ? 0 : 1, now, ramp);
    setParam(this.musicBus.gain, this._volumes.music, now, ramp);
    setParam(this.sfxBus.gain, this._volumes.sfx, now, ramp);
  }

  // --- context ---------------------------------------------------------------

  /** Resume a suspended context (call from a user gesture). Resolves with the context state. */
  resume() {
    const ctx = this.context;
    if (this.offline || typeof ctx.resume !== 'function') return Promise.resolve(ctx.state);
    if (ctx.state === 'running') return Promise.resolve('running');
    return ctx.resume().then(() => ctx.state, () => ctx.state);
  }

  /** Resume the context on the first key/pointer event on `target` (window by default). */
  unlockOnGesture(target = typeof window !== 'undefined' ? window : null) {
    if (!target || this.offline || this._unlock) return this;
    const handler = () => {
      this.resume().then((state) => { if (state === 'running') this._removeUnlock(); });
    };
    this._unlock = { target, handler };
    for (const e of UNLOCK_EVENTS) target.addEventListener(e, handler, { passive: true });
    return this;
  }

  _removeUnlock() {
    if (!this._unlock) return;
    const { target, handler } = this._unlock;
    for (const e of UNLOCK_EVENTS) target.removeEventListener(e, handler);
    this._unlock = null;
  }

  /**
   * Render music and/or one SFX through a full engine into an OfflineAudioContext.
   * @returns {Promise<{ buffer: AudioBuffer, rms: number, peak: number, engine: AudioEngine }>}
   */
  static async renderOffline({ music = null, sfx = null, seconds = 2, sampleRate = 44100, songs = SONGS, volumes = null, limiter = true } = {}) {
    const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!OAC) throw new Error('OfflineAudioContext is not available');
    const ctx = new OAC(1, Math.ceil(seconds * sampleRate), sampleRate);
    const engine = new AudioEngine({ context: ctx, destination: ctx.destination, songs, unlock: false, limiter });
    if (volumes) engine.setVolume(volumes);
    if (music) {
      const seq = engine.playMusic(music, { fade: 0 });
      if (!seq) throw new Error(`renderOffline: unknown song "${music}"`);
      seq.scheduleUntil(seconds);
    }
    if (sfx) {
      if (!SFX[sfx]) throw new Error(`renderOffline: unknown sfx "${sfx}"`);
      engine.sfx(sfx);
    }
    const buffer = await ctx.startRendering();
    return { buffer, rms: bufferRms(buffer), peak: bufferPeak(buffer), engine };
  }

  /** Stop everything, disconnect, and close the context if the engine created it. */
  destroy() {
    this._stopCurrent(0);
    for (const seq of Array.from(this._fading)) seq.stop({ fade: 0 });
    this._fading.clear();
    this.synth.stopAll();
    this._removeUnlock();
    for (const n of [this.musicBus, this.sfxBus, this.master, this.limiter]) {
      if (n) { try { n.disconnect(); } catch (_) { /* noop */ } }
    }
    if (this.ownsContext && typeof this.context.close === 'function') this.context.close().catch(() => {});
  }

  _warn(msg) {
    if (this._warned.has(msg)) return;
    this._warned.add(msg);
    console.warn(`AudioEngine: ${msg}`);
  }
}

export { SFX_NAMES, SONGS };
export default AudioEngine;
