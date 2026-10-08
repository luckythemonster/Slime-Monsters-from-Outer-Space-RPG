// Shared UI constants: pixel font, palette, text speeds, render depths and the key map.
// Everything in the UI layer is positioned on whole pixels (docs/ARCHITECTURE.md section 11).
import { services } from '../engine/services.js';

export const SCREEN_W = 256;
export const SCREEN_H = 224;

// Press Start 2P is a monospace pixel font: every glyph is exactly 8 px wide at 8 px.
export const FONT_FAMILY = '"Press Start 2P"';
export const FONT_SIZE = 8;
export const CHAR_W = 8;
export const LINE_H = 12;

export const COLORS = {
  text: '#ffffff',
  disabled: '#8c8ca0',
  caption: '#101018', // black text on Ryan's rigid captions
  // Named colours usable in dialogue markup: {color:pink}...{/color}
  pink: '#ff5fd2',
  green: '#39ff8a',
  yellow: '#ffe066',
  blue: '#6cb6ff',
  red: '#ff5a5a',
  orange: '#ffa040',
  purple: '#c080ff',
  gray: '#8c8ca0',
  grey: '#8c8ca0',
  white: '#ffffff',
  black: '#101018',
};

// Typewriter delay per character in ms, keyed by {speed:...} markup value.
export const SPEED_MS = { normal: 30, fast: 15, slow: 60, instant: 0 };

// Render depths inside UIScene (its own display list, so these only order UI objects).
// The fade overlay sits BELOW the windows so captions / narrator text can be shown over a
// faded-out world; the flash overlay sits above everything.
export const DEPTH = {
  FADE: 900,
  WINDOW: 1000,
  DIALOGUE: 1010,
  MENU: 1020,
  TOAST: 1030,
  CAPTION: 1040,
  FLASH: 1100,
};

// Physical key (KeyboardEvent.code) -> logical UI action.
export const KEY_ACTIONS = {
  KeyZ: 'confirm', Enter: 'confirm', Space: 'confirm',
  KeyX: 'cancel', Backspace: 'cancel', Escape: 'cancel',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

/** Phaser Text style for the pixel font. */
export function textStyle(color = COLORS.text, extra = {}) {
  return { fontFamily: FONT_FAMILY, fontSize: `${FONT_SIZE}px`, color, resolution: 1, ...extra };
}

/** Resolve a markup colour name or '#rrggbb' to a CSS colour; null/unknown -> fallback. */
export function resolveColor(name, fallback = COLORS.text) {
  if (!name) return fallback;
  const key = String(name).trim().toLowerCase();
  if (COLORS[key]) return COLORS[key];
  if (/^#[0-9a-f]{6}$/i.test(key)) return key;
  if (/^[0-9a-f]{6}$/i.test(key)) return `#${key}`;
  return fallback;
}

/** Play a named SFX through the audio service if one is registered; never throws. */
export function sfx(name) {
  try {
    services.audio?.sfx?.(name);
  } catch {
    // Audio problems must never break the UI.
  }
}
