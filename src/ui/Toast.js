// Small notification window at the top centre: slides in, holds, slides out.
import Window from './Window.js';
import { CHAR_W, COLORS, DEPTH, SCREEN_W, textStyle } from './theme.js';

const PAD = 8;
const H = 24;
const SLIDE_MS = 120;
const REST_Y = 8;

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

  show(text, ms = 1200) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.state = 'open';
      const ui = this.ui;
      const instant = ui.textInstant;
      const label = String(text ?? '');
      const w = Math.max(16, label.length * CHAR_W + PAD * 2);
      const x = Math.round((SCREEN_W - w) / 2);
      this.win = new Window(ui, x, REST_Y, w, H, { depth: DEPTH.TOAST });
      this.win.open(true);
      this.text = ui.add.text(x + PAD, REST_Y + PAD, label, textStyle(COLORS.text)).setDepth(DEPTH.TOAST + 2);
      const hold = instant ? Math.min(ms, 100) : Math.max(0, ms | 0);
      const slide = instant ? 0 : SLIDE_MS;
      const startHold = () => {
        this._hold = ui.time.delayedCall(hold, () => {
          this._hold = null;
          this._slideOut(slide);
        });
      };
      if (slide > 0) {
        this.win.y = -H;
        this.win.baseY = -H;
        this.text.y = -H + PAD;
        this._tween = ui.tweens.add({
          targets: [this.win, this.text],
          y: `+=${REST_Y + H}`,
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
        y: `-=${REST_Y + H}`,
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
