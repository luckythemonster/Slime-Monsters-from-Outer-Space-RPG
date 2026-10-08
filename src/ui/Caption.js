// Title card: full-screen black with centred text, fade in / hold / fade out.
import { DEPTH, SCREEN_W, SCREEN_H, COLORS, LINE_H, FONT_SIZE, textStyle } from './theme.js';

const FADE_MS = 150;
const INSTANT_HOLD_MS = 100;

export default class Caption {
  constructor(ui) {
    this.ui = ui;
    this.state = 'idle';
    this.rect = null;
    this.text = null;
    this._tween = null;
    this._hold = null;
    this._resolve = null;
  }

  show(text, ms = 1500) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.state = 'open';
      const ui = this.ui;
      const instant = ui.textInstant;
      const lines = String(text ?? '').split('\n');
      this.rect = ui.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x000000, 1).setOrigin(0, 0).setDepth(DEPTH.CAPTION);
      this.text = ui.add.text(0, 0, lines, textStyle(COLORS.text, { align: 'center', lineSpacing: LINE_H - FONT_SIZE - 2 })).setDepth(DEPTH.CAPTION + 1);
      this.text.setPosition(Math.round((SCREEN_W - this.text.width) / 2), Math.round((SCREEN_H - this.text.height) / 2));
      const targets = [this.rect, this.text];
      const hold = instant ? INSTANT_HOLD_MS : Math.max(0, ms | 0);
      const fade = instant ? 0 : FADE_MS;
      const done = () => this._close(fade);
      const startHold = () => {
        this._hold = ui.time.delayedCall(hold, () => {
          this._hold = null;
          done();
        });
      };
      if (fade > 0) {
        this.rect.setAlpha(0);
        this.text.setAlpha(0);
        this._tween = ui.tweens.add({ targets, alpha: 1, duration: fade, onComplete: () => { this._tween = null; startHold(); } });
      } else {
        startHold();
      }
    });
  }

  _close(fade) {
    if (this.state !== 'open') return;
    this.state = 'closing';
    const targets = [this.rect, this.text];
    if (fade > 0) {
      this._tween = this.ui.tweens.add({ targets, alpha: 0, duration: fade, onComplete: () => { this._tween = null; this._finish(); } });
    } else {
      this._finish();
    }
  }

  onAction() { /* captions ignore input */ }

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
    this.rect?.destroy();
    this.text?.destroy();
    this.rect = this.text = null;
    const r = this._resolve;
    this._resolve = null;
    if (r) r();
  }
}
