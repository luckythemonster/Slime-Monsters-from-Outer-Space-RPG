// Audio access helpers: a silent shim with the AudioEngine method names (ARCHITECTURE §7) for
// when the real engine cannot start, and a guarded call so audio problems never break gameplay.
import { services } from './services.js';

/** Method names every audio service must expose. */
export const AUDIO_METHODS = ['playMusic', 'stopMusic', 'sfx', 'setVolume', 'mute', 'resume', 'registerSong'];

/** No-op audio engine. */
export function makeAudioShim() {
  const shim = { isShim: true, isMuted: false, currentMusic: null };
  for (const m of AUDIO_METHODS) shim[m] = () => null;
  shim.playMusic = (id) => { shim.currentMusic = id; return null; };
  shim.stopMusic = () => { shim.currentMusic = null; };
  shim.mute = (on = true) => { shim.isMuted = !!on; };
  shim.resume = () => Promise.resolve('closed');
  return shim;
}

/** True when `audio` looks like an AudioEngine (every required method present). */
export function isAudioEngine(audio) {
  return !!audio && AUDIO_METHODS.every((m) => typeof audio[m] === 'function');
}

/**
 * Call `services.audio[method](...args)` if available; logs (warn) and returns null on failure.
 * @param {string} method
 * @param {...any} args
 */
export function audioCall(method, ...args) {
  const a = services.audio;
  if (!a || typeof a[method] !== 'function') return null;
  try {
    return a[method](...args);
  } catch (err) {
    console.warn(`[audio] ${method} failed:`, err && err.message ? err.message : err);
    return null;
  }
}
