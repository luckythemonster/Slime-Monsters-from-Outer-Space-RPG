// UIScene: the permanent overlay scene above Explore/Battle/Menu that implements the UI service
// from docs/ARCHITECTURE.md section 12.2. It registers itself as `services.ui` in create().
//
//   ui.say({ text, who, portrait, name })   -> Promise<void>
//   ui.choice(options, { cancelIndex = -1, x, y }) -> Promise<number>
//   ui.menu(items, { x, y, width, columns = 1, cancelable = true, selected = 0 }) -> Promise<number>
//   ui.caption(text, ms = 1500) / ui.toast(text, ms = 1200) -> Promise<void>
//   ui.fade('out'|'in', ms = 400, color = 0x000000) / ui.flash(ms = 150, color = 0xffffff) -> Promise<void>
//   ui.setTextInstant(bool); ui.setAutoAdvance(bool); ui.chooseIndex = 0   (test hooks)
//   ui.isBusy(); ui.closeAll()
//   ui.press(action)   extra: feed a logical action ('confirm','cancel','up',...) to the open widget
//
// Requires the generated `ui` atlas (frames win_*, cursor, arrow_more) to be registered on
// this.textures before the first widget opens (see src/ui/atlas.js registerAtlasFrames) and the
// optional `portraits` texture with one frame per portrait id.
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import DialogueBox from '../ui/DialogueBox.js';
import ListMenu from '../ui/ListMenu.js';
import Caption from '../ui/Caption.js';
import Toast from '../ui/Toast.js';
import { DEPTH, KEY_ACTIONS, SCREEN_W, SCREEN_H } from '../ui/theme.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UI' });
  }

  create() {
    this.textInstant = false;
    this.autoAdvance = false;
    this.chooseIndex = 0;

    this._stack = []; // input consumers, top-most last
    this._open = new Set(); // modal widgets currently open (busy)
    this._modal = Promise.resolve(); // serialises say/choice/menu/caption
    this._toasts = Promise.resolve();
    this._toast = null;
    this._held = new Set(); // physical keys held (confirm/cancel need a key-up between presses)

    this._fadeRect = this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x000000, 1).setOrigin(0, 0).setDepth(DEPTH.FADE).setAlpha(0).setVisible(false);
    this._flashRect = this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0xffffff, 1).setOrigin(0, 0).setDepth(DEPTH.FLASH).setAlpha(0).setVisible(false);

    const kb = this.input.keyboard;
    if (kb) {
      this._onKeyDown = (ev) => this._handleKeyDown(ev);
      this._onKeyUp = (ev) => this._held.delete(ev.code);
      kb.on('keydown', this._onKeyDown);
      kb.on('keyup', this._onKeyUp);
    }
    this._onBlur = () => this._held.clear();
    this.game.events.on(Phaser.Core.Events.BLUR, this._onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._shutdown());

    services.ui = this;
    this.scene.bringToTop();
  }

  // --- input ----------------------------------------------------------------------------

  _handleKeyDown(ev) {
    const action = KEY_ACTIONS[ev.code];
    if (!action) return;
    if (action === 'confirm' || action === 'cancel') {
      if (ev.repeat || this._held.has(ev.code)) return;
      this._held.add(ev.code);
    }
    this.press(action);
  }

  /** Feed a logical action to the top-most open widget (used by key events and the debug API). */
  press(action) {
    const top = this._stack[this._stack.length - 1];
    if (top && typeof top.onAction === 'function') top.onAction(action);
  }

  _pushInput(widget) {
    this._stack.push(widget);
  }

  _popInput(widget) {
    const i = this._stack.lastIndexOf(widget);
    if (i >= 0) this._stack.splice(i, 1);
  }

  // --- modal plumbing ------------------------------------------------------------------

  /** Run one modal widget after any previous one has finished; returns its result. */
  _runModal(widget, start) {
    const run = async () => {
      this._open.add(widget);
      this._pushInput(widget);
      try {
        return await start();
      } finally {
        this._popInput(widget);
        this._open.delete(widget);
      }
    };
    const p = this._modal.then(run, run);
    this._modal = p.catch(() => {});
    return p;
  }

  // --- section 12.2 API ------------------------------------------------------------------

  /** Dialogue box; resolves when the last page is dismissed. */
  say(opts = {}) {
    const box = new DialogueBox(this);
    return this._runModal(box, () => box.show(opts));
  }

  /** Choice list (string[]); resolves the index, or cancelIndex on cancel (only when >= 0). */
  choice(options = [], { cancelIndex = -1, x, y } = {}) {
    const menu = new ListMenu(this, options, {
      x,
      y,
      columns: 1,
      cancelable: cancelIndex >= 0,
      cancelIndex,
      selected: 0,
      anchor: 'bottom-right',
    });
    return this._runModal(menu, () => menu.show());
  }

  /** Menu of { label, disabled?, hint? } items (or strings); resolves index or -1 on cancel. */
  menu(items = [], { x, y, width, columns = 1, cancelable = true, selected = 0 } = {}) {
    const menu = new ListMenu(this, items, { x, y, width, columns, cancelable, cancelIndex: -1, selected, anchor: 'center' });
    return this._runModal(menu, () => menu.show());
  }

  /** Centred title card over black. */
  caption(text, ms = 1500) {
    const cap = new Caption(this);
    return this._runModal(cap, () => cap.show(text, ms));
  }

  /** Small top-centre notification. Not modal; toasts queue one after another. */
  toast(text, ms = 1200) {
    const run = async () => {
      const t = new Toast(this);
      this._toast = t;
      try {
        await t.show(text, ms);
      } finally {
        if (this._toast === t) this._toast = null;
      }
    };
    const p = this._toasts.then(run, run);
    this._toasts = p.catch(() => {});
    return p;
  }

  /** Full-screen fade overlay (below the UI windows, above the game scenes). */
  fade(dir = 'out', ms = 400, color = 0x000000) {
    return new Promise((resolve) => {
      const r = this._fadeRect;
      const target = dir === 'in' ? 0 : 1;
      this.tweens.killTweensOf(r);
      r.setFillStyle(color, 1).setVisible(true);
      if (this.textInstant) ms = Math.min(ms, 60);
      if (!(ms > 0) || r.alpha === target) {
        r.setAlpha(target);
        if (target === 0) r.setVisible(false);
        resolve();
        return;
      }
      this.tweens.add({
        targets: r,
        alpha: target,
        duration: ms,
        ease: 'Linear',
        onComplete: () => {
          if (target === 0) r.setVisible(false);
          resolve();
        },
      });
    });
  }

  /** Full-screen flash (above everything) that decays over ms. */
  flash(ms = 150, color = 0xffffff) {
    return new Promise((resolve) => {
      const r = this._flashRect;
      this.tweens.killTweensOf(r);
      r.setFillStyle(color, 1).setVisible(true).setAlpha(1);
      if (this.textInstant) ms = Math.min(ms, 60);
      if (!(ms > 0)) {
        r.setAlpha(0).setVisible(false);
        resolve();
        return;
      }
      this.tweens.add({
        targets: r,
        alpha: 0,
        duration: ms,
        ease: 'Linear',
        onComplete: () => {
          r.setVisible(false);
          resolve();
        },
      });
    });
  }

  setTextInstant(v) {
    this.textInstant = !!v;
  }

  setAutoAdvance(v) {
    this.autoAdvance = !!v;
  }

  /** True while a dialogue box, choice, menu or caption is open. */
  isBusy() {
    return this._open.size > 0;
  }

  /** Tear down every open widget immediately, resolving their promises (scene changes, game over). */
  closeAll() {
    for (const w of Array.from(this._open)) w.forceClose();
    this._open.clear();
    this._stack.length = 0;
    if (this._toast) this._toast.forceClose();
    this._toast = null;
    this._held.clear();
  }

  /** Debug snapshot of the top-most widget (tests). */
  debugState() {
    const top = this._stack[this._stack.length - 1];
    return {
      busy: this.isBusy(),
      open: this._open.size,
      top: top && typeof top.debugState === 'function' ? top.debugState() : null,
      fadeAlpha: this._fadeRect ? this._fadeRect.alpha : 0,
      flashAlpha: this._flashRect ? this._flashRect.alpha : 0,
      toast: !!this._toast,
    };
  }

  _shutdown() {
    this.closeAll();
    const kb = this.input.keyboard;
    if (kb && this._onKeyDown) {
      kb.off('keydown', this._onKeyDown);
      kb.off('keyup', this._onKeyUp);
    }
    this.game.events.off(Phaser.Core.Events.BLUR, this._onBlur);
    if (services.ui === this) services.ui = null;
  }
}
