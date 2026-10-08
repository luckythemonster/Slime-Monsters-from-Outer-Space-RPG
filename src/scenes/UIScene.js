// STUB UIScene — implements the ui API from docs/ARCHITECTURE.md §12.2 with plain text so the
// game flow can be exercised before the real windowed UI lands. The UI agent replaces this file
// wholesale; keep the public method names and Promise semantics identical.
import Phaser from 'phaser';
import { services } from '../engine/services.js';

const FONT = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffffff', resolution: 1 };

export default class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UI' }); }

  create() {
    this.textInstant = false;
    this.autoAdvance = false;
    this.chooseIndex = 0;
    this._busy = 0;
    this._box = null;
    services.ui = this;
    this.scene.bringToTop();
  }

  isBusy() { return this._busy > 0; }
  setTextInstant(v) { this.textInstant = !!v; }
  setAutoAdvance(v) { this.autoAdvance = !!v; }

  _waitConfirm() {
    return new Promise((resolve) => {
      if (this.autoAdvance) { this.time.delayedCall(50, resolve); return; }
      const kb = this.input.keyboard;
      const handler = (ev) => {
        if (['KeyZ', 'Enter', 'Space'].includes(ev.code)) { kb.off('keydown', handler); resolve(); }
      };
      kb.on('keydown', handler);
    });
  }

  async say({ text, who, name }) {
    this._busy++;
    const tag = name || (who && who !== 'narrator' ? who.toUpperCase() : '');
    const bg = this.add.rectangle(8, 160, 240, 56, 0x102040, 0.95).setOrigin(0, 0).setDepth(1000);
    const label = this.add.text(12, 164, (tag ? tag + '\n' : '') + text, { ...FONT, wordWrap: { width: 232 } }).setDepth(1001);
    await this._waitConfirm();
    bg.destroy(); label.destroy();
    this._busy--;
  }

  async choice(options, { cancelIndex = -1 } = {}) {
    this._busy++;
    let sel = 0;
    const bg = this.add.rectangle(120, 96, 120, 12 * options.length + 8, 0x102040, 0.95).setOrigin(0, 0).setDepth(1000);
    const txt = this.add.text(124, 100, '', FONT).setDepth(1001);
    const render = () => txt.setText(options.map((o, i) => (i === sel ? '>' : ' ') + o).join('\n'));
    render();
    const result = await new Promise((resolve) => {
      if (this.autoAdvance) { this.time.delayedCall(50, () => resolve(Math.min(this.chooseIndex, options.length - 1))); return; }
      const kb = this.input.keyboard;
      const handler = (ev) => {
        if (ev.code === 'ArrowUp' || ev.code === 'KeyW') { sel = (sel + options.length - 1) % options.length; render(); }
        else if (ev.code === 'ArrowDown' || ev.code === 'KeyS') { sel = (sel + 1) % options.length; render(); }
        else if (['KeyZ', 'Enter', 'Space'].includes(ev.code)) { kb.off('keydown', handler); resolve(sel); }
        else if (['KeyX', 'Escape', 'Backspace'].includes(ev.code) && cancelIndex >= 0) { kb.off('keydown', handler); resolve(cancelIndex); }
      };
      kb.on('keydown', handler);
    });
    bg.destroy(); txt.destroy();
    this._busy--;
    return result;
  }

  async menu(items, opts = {}) {
    const labels = items.map((i) => (typeof i === 'string' ? i : i.label));
    return this.choice(labels, { cancelIndex: opts.cancelable === false ? -1 : -1, ...opts });
  }

  async caption(text, ms = 1500) {
    this._busy++;
    const bg = this.add.rectangle(0, 0, 256, 224, 0x000000, 1).setOrigin(0, 0).setDepth(1000);
    const t = this.add.text(128, 112, text, FONT).setOrigin(0.5).setDepth(1001);
    await new Promise((r) => this.time.delayedCall(this.textInstant ? 50 : ms, r));
    bg.destroy(); t.destroy();
    this._busy--;
  }

  async toast(text, ms = 1200) {
    const t = this.add.text(128, 12, text, FONT).setOrigin(0.5, 0).setDepth(1001);
    await new Promise((r) => this.time.delayedCall(this.textInstant ? 50 : ms, r));
    t.destroy();
  }

  fade(dir, ms = 400, color = 0x000000) {
    return new Promise((resolve) => {
      const cam = this.cameras.main;
      const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
      if (this.textInstant) ms = Math.min(ms, 50);
      if (dir === 'out') cam.fadeOut(ms, r, g, b, (_c, p) => { if (p === 1) resolve(); });
      else cam.fadeIn(ms, r, g, b, (_c, p) => { if (p === 1) resolve(); });
    });
  }

  flash(ms = 150, color = 0xffffff) {
    return new Promise((resolve) => {
      const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
      this.cameras.main.flash(ms, r, g, b, false, (_c, p) => { if (p === 1) resolve(); });
    });
  }

  closeAll() { /* stub: nothing persistent to close */ }
}
