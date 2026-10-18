// Unified keyboard + gamepad → logical actions (ARCHITECTURE §10, §12.3).
//
// Why DOM events instead of a Scene's KeyboardPlugin: a scene-level KeyboardPlugin stops
// processing while its scene is paused or sleeping, but Explore (paused under Menu, sleeping
// under Battle), Menu and Battle all need the same action state. So Input listens on the same
// DOM target Phaser uses (window), registers Phaser keyboard captures so arrows/space never
// scroll the page, and keeps per-game-step "just pressed" state via the Game's PRE_STEP /
// POST_STEP events. `simulate(action)` dispatches a real synthetic KeyboardEvent, so Phaser's
// own keyboard plugins (used by UIScene) see the tap exactly like a physical one.
import Phaser from 'phaser';
import { services } from './services.js';
import { KEYS, KEY_CODES, PAD_BUTTONS, ACTIONS, TOGGLE_KEYS } from '../config.js';

/** Actions UIScene consumes while a widget is open (see src/ui/theme.js KEY_ACTIONS). */
const UI_ACTIONS = new Set(['confirm', 'cancel', 'up', 'down', 'left', 'right']);
const PRE_STEP = Phaser.Core.Events.PRE_STEP;
const POST_STEP = Phaser.Core.Events.POST_STEP;

export class Input {
  /** @param {Phaser.Game} game */
  constructor(game) {
    this.game = game;
    /** code → action */
    this.codeToAction = new Map();
    for (const [action, codes] of Object.entries(KEYS)) for (const c of codes) this.codeToAction.set(c, action);
    /** code → app toggle ('mute' | 'fullscreen') */
    this.codeToToggle = new Map();
    for (const [name, codes] of Object.entries(TOGGLE_KEYS)) for (const c of codes) this.codeToToggle.set(c, name);
    /** Toggle counters (tests read these). */
    this.toggles = { mute: 0, fullscreen: 0 };
    /** physical codes currently held, per action */
    this.heldCodes = new Map(ACTIONS.map((a) => [a, new Set()]));
    /** actions pressed since the last POST_STEP */
    this.just = new Set();
    /** gamepad: buttons held last poll */
    this.padHeld = new Set();
    this.padJust = new Set();
    /** synthetic key-ups scheduled for the next POST_STEP */
    this.pendingUps = [];
    /** step counter (used by Debug.press to wait a tick) */
    this.step = 0;

    this.onKeyDown = (ev) => this.handleKey(ev, true);
    this.onKeyUp = (ev) => this.handleKey(ev, false);
    this.onBlur = () => this.releaseAll();
    this.onPreStep = () => this.preStep();
    this.onPostStep = () => this.postStep();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    game.events.on(PRE_STEP, this.onPreStep);
    game.events.on(POST_STEP, this.onPostStep);

    // Phaser's KeyboardManager preventDefaults captured keycodes (arrows, space, …).
    try {
      const kb = game.input && game.input.keyboard;
      if (kb && typeof kb.addCapture === 'function') {
        kb.addCapture([...new Set(Object.values(KEY_CODES))].filter((k) => k !== KEY_CODES.Escape));
      }
    } catch { /* keyboard manager unavailable (headless?) */ }
  }

  /** @param {KeyboardEvent} ev @param {boolean} down */
  handleKey(ev, down) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const toggle = this.codeToToggle.get(ev.code);
    if (toggle) {
      if (down && !ev.repeat) this.toggle(toggle);
      return;
    }
    const action = this.codeToAction.get(ev.code);
    if (!action) return;
    const held = this.heldCodes.get(action);
    if (down) {
      if (ev.repeat) return;
      // While a UI widget is open the keyboard belongs to UIScene (which handles the same DOM
      // event synchronously); never let a press it consumes leak into Explore/Battle as a
      // justPressed. `menu`/`run` are not UI actions, so C/Esc still close the pause menu.
      const uiBusy = UI_ACTIONS.has(action) && !!(services.ui && typeof services.ui.isBusy === 'function' && services.ui.isBusy());
      if (held.size === 0 && !uiBusy) this.just.add(action);
      held.add(ev.code);
    } else {
      held.delete(ev.code);
    }
  }

  /** App-level toggles (DESIGN.md E23): M mutes, F toggles fullscreen. */
  toggle(name) {
    if (name === 'mute') this.toggleMute();
    else if (name === 'fullscreen') this.toggleFullscreen();
  }

  /** Flip the audio engine's mute. Returns the new muted state (null without audio). */
  toggleMute() {
    const a = services.audio;
    if (!a || typeof a.mute !== 'function') return null;
    const on = !a.isMuted;
    try { a.mute(on); } catch (err) { console.warn('[input] mute failed', err); return null; }
    this.toggles.mute++;
    return on;
  }

  /**
   * Toggle fullscreen through Phaser's ScaleManager. The DOM request is made here (not via
   * `scale.toggleFullscreen`) so a rejected promise (no user gesture, headless) is caught instead
   * of surfacing as an unhandled rejection. Returns true when a request/exit was issued.
   */
  toggleFullscreen() {
    const scale = this.game && this.game.scale;
    if (!scale) return false;
    this.toggles.fullscreen++;
    try {
      if (scale.isFullscreen) { scale.stopFullscreen(); return true; }
      const fs = scale.fullscreen;
      if (!fs || !fs.available || typeof scale.getFullscreenTarget !== 'function') return false;
      const target = scale.getFullscreenTarget();
      const fn = target && target[fs.request];
      if (typeof fn !== 'function') return false;
      const p = fn.call(target, { navigationUI: 'hide' });
      if (p && typeof p.catch === 'function') p.catch((err) => { if (typeof scale.fullscreenErrorHandler === 'function') scale.fullscreenErrorHandler(err); });
      return true;
    } catch (err) {
      console.warn('[input] fullscreen failed', err && err.message ? err.message : err);
      return false;
    }
  }

  releaseAll() {
    for (const set of this.heldCodes.values()) set.clear();
    this.just.clear();
    this.padHeld.clear();
    this.padJust.clear();
  }

  preStep() {
    this.step++;
    this.pollGamepad();
  }

  postStep() {
    this.just.clear();
    this.padJust.clear();
    if (this.pendingUps.length) {
      const ups = this.pendingUps;
      this.pendingUps = [];
      for (const code of ups) this.dispatch('keyup', code);
    }
  }

  /** Standard-mapping gamepad polling with edge detection (no Phaser gamepad plugin needed). */
  pollGamepad() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav || typeof nav.getGamepads !== 'function') return;
    let pads;
    try { pads = nav.getGamepads(); } catch { return; }
    const now = new Set();
    for (const pad of pads || []) {
      if (!pad || !pad.connected) continue;
      pad.buttons.forEach((b, i) => { if (b && b.pressed && PAD_BUTTONS[i]) now.add(PAD_BUTTONS[i]); });
      const [lx, ly] = pad.axes || [0, 0];
      if (lx < -0.5) now.add('left'); else if (lx > 0.5) now.add('right');
      if (ly < -0.5) now.add('up'); else if (ly > 0.5) now.add('down');
    }
    for (const a of now) if (!this.padHeld.has(a)) this.padJust.add(a);
    this.padHeld = now;
  }

  /** True on the single game step after the action went down. */
  justPressed(action) {
    return this.just.has(action) || this.padJust.has(action);
  }

  /** True while the action is held. */
  isDown(action) {
    const held = this.heldCodes.get(action);
    return (held && held.size > 0) || this.padHeld.has(action);
  }

  /** First held direction (up/down/left/right) or null. */
  heldDirection() {
    for (const d of ['up', 'down', 'left', 'right']) if (this.isDown(d)) return d;
    return null;
  }

  /** Clear just-pressed state so a key used by one consumer is not re-read by another. */
  consume() {
    this.just.clear();
    this.padJust.clear();
  }

  /** Dispatch a synthetic KeyboardEvent on the window (Phaser listens there too). */
  dispatch(type, code) {
    const keyCode = KEY_CODES[code] || 0;
    const ev = new KeyboardEvent(type, { code, key: code, keyCode, which: keyCode, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
  }

  /**
   * Simulated tap: key-down now, key-up at the end of the next game step, so `justPressed` and
   * `isDown` behave exactly like a real one-frame tap (used by the Debug API `press`).
   * @param {string} action
   */
  simulate(action) {
    const codes = KEYS[action] || TOGGLE_KEYS[action];
    if (!codes) throw new Error(`Input.simulate: unknown action "${action}"`);
    const code = codes[0];
    this.dispatch('keydown', code);
    this.pendingUps.push(code);
  }

  /**
   * Hold an action for `ms` of game time (steps are counted with the game's delta).
   * @returns {Promise<void>}
   */
  hold(action, ms) {
    const codes = KEYS[action];
    if (!codes) throw new Error(`Input.hold: unknown action "${action}"`);
    const code = codes[0];
    this.dispatch('keydown', code);
    return new Promise((resolve) => {
      let elapsed = 0;
      const tick = (_time, delta) => {
        elapsed += delta;
        if (elapsed >= ms) {
          this.game.events.off(POST_STEP, tick);
          this.dispatch('keyup', code);
          resolve();
        }
      };
      this.game.events.on(POST_STEP, tick);
    });
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.game.events.off(PRE_STEP, this.onPreStep);
    this.game.events.off(POST_STEP, this.onPostStep);
  }
}
