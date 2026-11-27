// Small notification window at the top centre: slides in, holds, slides out. Text longer than the
// screen wraps onto extra 12 px rows (never wider than the 8 px screen margin allows).
// `tip: true` is onboarding: beige text and a beige inner rule, like the dialogue box's tip style.
import Phaser from 'phaser';
import Window from './Window.js';
import { CHAR_W, COLORS, DEPTH, FONT_SIZE, LINE_H, SCREEN_W, textStyle, wrapWords } from './theme.js';

const PAD = 8;
const H = 24;
const SLIDE_MS = 120;
const REST_Y = 8;
const MAX_COLS = Math.floor((SCREEN_W - 16 - PAD * 2) / CHAR_W); // 28

/** Word-wrap a toast to MAX_COLS columns. */
export function wrapToast(text) { return wrapWords(text, MAX_COLS); }

export default class Toast {
  constructor(ui) {
    this.ui = ui;
    this.state = 'idle';
    this.win = null;
    this.text = null;
    this._tween = null;
    this._hold = null;
    this._resolve = null;
  }

  show(text, ms = 1200, { tip = false } = {}) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.state = 'open';
      this.tip = !!tip;
      const ui = this.ui;
      const instant = ui.textInstant;
      const lines = wrapToast(text);
      const label = lines.join('\n');
      const w = Math.max(16, Math.max(...lines.map((l) => l.length)) * CHAR_W + PAD * 2);
      const h = H + (lines.length - 1) * LINE_H;
      this.h = h;
      const x = Math.round((SCREEN_W - w) / 2);
      this.win = new Window(ui, x, REST_Y, w, h, { depth: DEPTH.TOAST });
      this.win.open(true);
      if (this.tip) {
        // The inner rule rides in the window container so it slides with it.
        const c = Phaser.Display.Color.HexStringToColor(COLORS.tip).color;
        this.win.add([
          ui.add.rectangle(3, 3, w - 6, 1, c, 1).setOrigin(0, 0),
          ui.add.rectangle(3, h - 4, w - 6, 1, c, 1).setOrigin(0, 0),
          ui.add.rectangle(3, 3, 1, h - 6, c, 1).setOrigin(0, 0),
          ui.add.rectangle(w - 4, 3, 1, h - 6, c, 1).setOrigin(0, 0),
        ]);
      }
      const color = this.tip ? COLORS.tip : COLORS.text;
      this.text = ui.add.text(x + PAD, REST_Y + PAD, label, textStyle(color, { lineSpacing: LINE_H - FONT_SIZE - 2 })).setDepth(DEPTH.TOAST + 2);
      const hold = instant ? Math.min(ms, 100) : Math.max(0, ms | 0);
      const slide = instant ? 0 : SLIDE_MS;
      const startHold = () => {
        this._hold = ui.time.delayedCall(hold, () => {
          this._hold = null;
          this._slideOut(slide);
        });
      };
      if (slide > 0) {
        this.win.y = -h;
        this.win.baseY = -h;
        this.text.y = -h + PAD;
        this._tween = ui.tweens.add({
          targets: [this.win, this.text],
          y: `+=${REST_Y + h}`,
          duration: slide,
          ease: 'Linear',
          onComplete: () => {
            this._tween = null;
            this.win.baseY = REST_Y;
            startHold();
          },
        });
      } else {
        startHold();
      }
    });
  }

  _slideOut(slide) {
    if (this.state !== 'open') return;
    this.state = 'closing';
    if (slide > 0) {
      this._tween = this.ui.tweens.add({
        targets: [this.win, this.text],
        y: `-=${REST_Y + (this.h || H)}`,
        duration: slide,
        ease: 'Linear',
        onComplete: () => { this._tween = null; this._finish(); },
      });
    } else {
      this._finish();
    }
  }

  forceClose() {
    if (this.state === 'closed') return;
    this.state = 'closing';
    this._finish();
  }

  _finish() {
    this.state = 'closed';
    if (this._tween) {
      this._tween.stop();
      this._tween.remove();
      this._tween = null;
    }
    if (this._hold) {
      this._hold.remove();
      this._hold = null;
    }
    this.text?.destroy();
    this.win?.destroy();
    this.text = this.win = null;
    const r = this._resolve;
    this._resolve = null;
    if (r) r();
  }
}
