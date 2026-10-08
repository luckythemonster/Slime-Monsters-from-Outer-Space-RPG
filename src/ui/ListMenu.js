// Cursor-driven list menu: a Window with items laid out in 1..N columns, the atlas `cursor` hand
// pointing at the selection, disabled items drawn gray and skipped by the cursor, and an optional
// hint window below. Resolves the chosen index, or cancelIndex / -1 on cancel when cancelable.
import Window from './Window.js';
import { CHAR_W, LINE_H, COLORS, DEPTH, SCREEN_W, SCREEN_H, textStyle, sfx } from './theme.js';
import { UI_KEY } from './atlas.js';

const PAD = 8;
const CURSOR_W = 10; // 8 px hand + 2 px gap
const COL_GAP = 8;
const TEXT_DY = 2; // glyph tops sit 2 px below each 12 px row's top
const HINT_H = 24;
const AUTO_MS = 60;

export default class ListMenu {
  /**
   * @param {import('../scenes/UIScene.js').default} ui
   * @param {(string|{label:string,disabled?:boolean,hint?:string}|{text:string})[]} items
   * @param {{x?:number,y?:number,width?:number,columns?:number,cancelable?:boolean,cancelIndex?:number,selected?:number,anchor?:'center'|'bottom-right'}} [opts]
   */
  constructor(ui, items, opts = {}) {
    this.ui = ui;
    this.items = (items || []).map((it) =>
      typeof it === 'string' || typeof it === 'number'
        ? { label: String(it), disabled: false, hint: null }
        : { label: String(it?.label ?? it?.text ?? ''), disabled: !!it?.disabled, hint: it?.hint ? String(it.hint) : null },
    );
    if (this.items.length === 0) this.items.push({ label: '', disabled: false, hint: null });
    this.cols = Math.max(1, (opts.columns | 0) || 1);
    this.rows = Math.ceil(this.items.length / this.cols);
    this.cancelable = opts.cancelable !== false;
    this.cancelIndex = Number.isInteger(opts.cancelIndex) ? opts.cancelIndex : -1;
    this.depth = opts.depth ?? DEPTH.MENU;
    const maxLen = Math.max(1, ...this.items.map((i) => i.label.length));
    this.cellW = CURSOR_W + maxLen * CHAR_W;
    this.w = Math.max(16, Math.round(opts.width ?? PAD * 2 + this.cols * this.cellW + (this.cols - 1) * COL_GAP));
    this.h = PAD * 2 + this.rows * LINE_H - 2;
    if (Number.isFinite(opts.x)) this.x = Math.round(opts.x);
    else if (opts.anchor === 'bottom-right') this.x = SCREEN_W - 8 - this.w;
    else this.x = Math.round((SCREEN_W - this.w) / 2);
    if (Number.isFinite(opts.y)) this.y = Math.round(opts.y);
    else if (opts.anchor === 'bottom-right') this.y = SCREEN_H - 8 - this.h;
    else this.y = Math.round((SCREEN_H - this.h) / 2);
    this.hasHints = this.items.some((i) => i.hint);
    this.selected = this._firstEnabled(Number.isInteger(opts.selected) ? opts.selected : 0);
    this.state = 'idle';
    this.win = null;
    this.hintWin = null;
    this.hintText = null;
    this.cursor = null;
    this.labels = [];
    this._resolve = null;
    this._auto = null;
  }

  _firstEnabled(start) {
    const n = this.items.length;
    start = ((start % n) + n) % n;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (!this.items[i].disabled) return i;
    }
    return start; // everything disabled: leave the cursor where it is
  }

  show() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.state = 'opening';
      this._open();
    });
  }

  async _open() {
    const ui = this.ui;
    this.win = new Window(ui, this.x, this.y, this.w, this.h, { depth: this.depth });
    await this.win.open(ui.textInstant);
    if (this.state !== 'opening') return;
    const colW = this.cols > 1 ? Math.floor((this.w - PAD * 2 - (this.cols - 1) * COL_GAP) / this.cols) : this.w - PAD * 2;
    this.colW = colW;
    this.labels = this.items.map((it, i) => {
      const c = i % this.cols;
      const r = Math.floor(i / this.cols);
      const lx = this.x + PAD + c * (colW + COL_GAP) + CURSOR_W;
      const ly = this.y + PAD + r * LINE_H + TEXT_DY;
      return ui.add.text(lx, ly, it.label, textStyle(it.disabled ? COLORS.disabled : COLORS.text)).setDepth(this.depth + 2);
    });
    this.cursor = ui.add.image(0, 0, UI_KEY, 'cursor').setOrigin(0, 0).setDepth(this.depth + 3);
    if (this.hasHints) {
      // The hint window is at least as wide as the menu, grows to fit the longest hint and is
      // kept inside the 8 px screen margin (hints longer than that are truncated).
      const maxHint = Math.max(...this.items.map((i) => (i.hint || '').length));
      const hw = Math.min(SCREEN_W - 16, Math.max(this.w, maxHint * CHAR_W + PAD * 2));
      const hx = Math.max(8, Math.min(this.x, SCREEN_W - 8 - hw));
      let hy = this.y + this.h;
      if (hy + HINT_H > SCREEN_H) hy = this.y - HINT_H;
      this.hint = { x: hx, y: hy, w: hw };
      this.hintWin = new Window(ui, hx, hy, hw, HINT_H, { depth: this.depth });
      await this.hintWin.open(true);
      this.hintText = ui.add.text(hx + PAD, hy + PAD, '', textStyle(COLORS.text)).setDepth(this.depth + 2);
    }
    this._placeCursor();
    this.state = 'open';
    if (ui.autoAdvance) {
      this._auto = ui.time.delayedCall(AUTO_MS, () => {
        this._auto = null;
        if (this.state === 'open') this._choose(this._firstEnabled(ui.chooseIndex | 0));
      });
    }
  }

  _placeCursor() {
    if (!this.cursor) return;
    const i = this.selected;
    const c = i % this.cols;
    const r = Math.floor(i / this.cols);
    this.cursor.setPosition(this.x + PAD + c * (this.colW + COL_GAP), this.y + PAD + r * LINE_H + TEXT_DY);
    if (this.hintText) {
      const maxChars = Math.max(0, Math.floor((this.hint.w - PAD * 2) / CHAR_W));
      this.hintText.setText((this.items[i].hint || '').slice(0, maxChars));
    }
  }

  /** Move along rows (dr) or columns (dc), wrapping and skipping disabled items. */
  _move(dr, dc) {
    const n = this.items.length;
    if (n < 2) return;
    let c = this.selected % this.cols;
    let r = Math.floor(this.selected / this.cols);
    let idx = this.selected;
    for (let k = 0; k < this.rows * this.cols; k++) {
      if (dr) {
        r = (r + dr + this.rows) % this.rows;
      } else {
        c = (c + dc + this.cols) % this.cols;
      }
      idx = r * this.cols + c;
      if (idx < n && !this.items[idx].disabled) break;
      idx = -1;
    }
    if (idx >= 0 && idx !== this.selected) {
      this.selected = idx;
      sfx('cursor');
      this._placeCursor();
    }
  }

  onAction(action) {
    if (this.state !== 'open') return;
    switch (action) {
      case 'up': this._move(-1, 0); break;
      case 'down': this._move(1, 0); break;
      case 'left': if (this.cols > 1) this._move(0, -1); break;
      case 'right': if (this.cols > 1) this._move(0, 1); break;
      case 'confirm':
        if (this.items[this.selected].disabled) {
          sfx('cancel');
        } else {
          sfx('confirm');
          this._choose(this.selected);
        }
        break;
      case 'cancel':
        if (this.cancelable) {
          sfx('cancel');
          this._choose(this.cancelIndex);
        }
        break;
      default: break;
    }
  }

  async _choose(index) {
    if (this.state !== 'open') return;
    this.state = 'closing';
    this.result = index;
    this._destroyContents();
    if (this.win) {
      await this.win.close(this.ui.textInstant);
      this.win.destroy();
      this.win = null;
    }
    this._finish(index);
  }

  _destroyContents() {
    if (this._auto) {
      this._auto.remove();
      this._auto = null;
    }
    for (const l of this.labels) l.destroy();
    this.labels = [];
    this.cursor?.destroy();
    this.cursor = null;
    this.hintText?.destroy();
    this.hintText = null;
    this.hintWin?.destroy();
    this.hintWin = null;
  }

  forceClose() {
    if (this.state === 'closed') return;
    this.state = 'closing';
    this._destroyContents();
    this.win?.destroy();
    this.win = null;
    this._finish(this.cancelable ? this.cancelIndex : -1);
  }

  _finish(value) {
    this.state = 'closed';
    const r = this._resolve;
    this._resolve = null;
    if (r) r(value);
  }

  debugState() {
    return { state: this.state, selected: this.selected, items: this.items.length, x: this.x, y: this.y, w: this.w, h: this.h };
  }
}
