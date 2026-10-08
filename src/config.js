// Game-wide constants. Pure module (no Phaser import) so Node tests can read it too.

/** Internal SNES resolution. */
export const WIDTH = 256;
export const HEIGHT = 224;
/** Tile size in pixels. */
export const TILE = 16;

/** Font family string for Phaser Text (digits in the name need the inner double quotes). */
export const PIXEL_FONT = '"Press Start 2P"';

/**
 * Logical actions → DOM `KeyboardEvent.code` values. Input.js translates codes to actions;
 * the same table is used to build the keyCode capture list that stops the browser scrolling.
 * @type {Record<string, string[]>}
 */
export const KEYS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  confirm: ['KeyZ', 'Enter', 'Space'],
  cancel: ['KeyX', 'Backspace'],
  menu: ['Escape'],
  run: ['ShiftLeft', 'ShiftRight'],
};

/** Legacy keyCode for each code (synthetic events and Phaser captures still use keyCode). */
export const KEY_CODES = {
  ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
  KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyZ: 90, KeyX: 88,
  Enter: 13, Space: 32, Backspace: 8, Escape: 27, ShiftLeft: 16, ShiftRight: 16,
};

/** Gamepad (standard mapping) button index → action. D-pad is 12..15. */
export const PAD_BUTTONS = { 0: 'confirm', 1: 'cancel', 2: 'run', 9: 'menu', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

/** All logical action names. */
export const ACTIONS = Object.keys(KEYS);
/** Direction actions in the order used by facing. */
export const DIRS = ['up', 'down', 'left', 'right'];

/** Movement speeds in tiles per second (grid-locked stepping; see ARCHITECTURE §12.3). */
export const SPEED = {
  walk: 7,
  run: 11,
};

/** Milliseconds per tile step for a named speed. */
export function stepMs(speed = 'walk') {
  return Math.round(1000 / (SPEED[speed] || SPEED.walk));
}

/** Text speed constants (ms per character). */
export const TEXT = {
  normal: 30,
  fast: 12,
  slow: 60,
  instant: 0,
  lineHeight: 12,
  charsPerLine: 28,
};

/** Depth layering. Entities sit between DECO and OVER (see Entities.js `feetDepth`). */
export const DEPTH = {
  GROUND: 0,
  DECO: 1,
  ENTITY: 2,
  OVER: 100,
  UI: 1000,
};

/** localStorage key prefix for saves (`smfos.save.1`…`smfos.save.3`). */
export const SAVE_PREFIX = 'smfos.save.';
export const SAVE_SLOTS = 3;

/** Default fade/transition duration in ms. */
export const FADE_MS = 400;

/**
 * URL params parsed once (`?debug=1&fast=1&mute=1&slot=N`). Safe in Node (returns empty).
 * @returns {{debug: boolean, fast: boolean, mute: boolean, slot: number|null}}
 */
export function urlParams() {
  const out = { debug: false, fast: false, mute: false, slot: null };
  if (typeof window === 'undefined' || !window.location) return out;
  const p = new URLSearchParams(window.location.search);
  out.debug = p.get('debug') === '1';
  out.fast = p.get('fast') === '1';
  out.mute = p.get('mute') === '1';
  out.slot = p.has('slot') ? Number(p.get('slot')) : null;
  return out;
}

export const PARAMS = urlParams();

/** Scale a gameplay duration for `?fast=1` (waits ÷ 4, transitions 4× faster). */
export function scaleMs(ms) {
  return PARAMS.fast ? Math.max(1, Math.round(ms / 4)) : ms;
}
