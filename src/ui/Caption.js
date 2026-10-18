// Title cards over black (DESIGN.md "Caption cards", E8):
//   plain  8 px white text centred on black, fade in / hold / fade out
//   tape   a white 160×24 card at (30, 92) (deliberately off-centre) with two 16×8 gray tape strips
//          over its corners (atlas `tape` frames when present, drawn otherwise), slapped on with
//          `thud` and a 1 px shake; text #141018
//   flyer  the same white card, centred, no tape, letter-spaced text
import { DEPTH, SCREEN_W, SCREEN_H, COLORS, LINE_H, FONT_SIZE, CHAR_W, textStyle, sfx } from './theme.js';
import { UI_KEY } from './atlas.js';

const FADE_MS = 150;
const INSTANT_HOLD_MS = 100;
const CARD = { x: 30, y: 92, w: 160, h: 24, pad: 8 };
const TAPE = { w: 16, h: 8 };
const SLAP_DELAY_MS = 90;
const SLAP_SHAKE_MS = 120;
const FLYER_SPACING = 2; // extra px between glyphs → 10 px pitch

export const CAPTION_STYLES = ['plain', 'tape', 'flyer'];

export default class Caption {
  constructor(ui) {
    this.ui = ui;
    this.state = 'idle';
    this.style = 'plain';
    this.rect = null;
    this.text = null;
    this.card = null;
    this.tapes = [];
    this._tween = null;
    this._hold = null;
    this._slap = null;
    this._shaker = null;
    this._resolve = null;
  }

  /**
   * @param {string} text
   * @param {number} ms hold time
   * @param {{style?: 'plain'|'tape'|'flyer'}} [opts]
   */
  show(text, ms = 1500, { style = 'plain' } = {}) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.state = 'open';
      this.style = CAPTION_STYLES.includes(style) ? style : 'plain';
      const ui = this.ui;
      const instant = ui.textInstant;
      const lines = String(text ?? '').split('\n');
      this.rect = ui.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x000000, 1).setOrigin(0, 0).setDepth(DEPTH.CAPTION);
      const hold = instant ? INSTANT_HOLD_MS : Math.max(0, ms | 0);
      const fade = instant ? 0 : FADE_MS;
      const startHold = () => {
        this._hold = ui.time.delayedCall(hold, () => {
          this._hold = null;
          this._close(fade);
        });
      };
      if (this.style === 'plain') {
        this.text = ui.add.text(0, 0, lines, textStyle(COLORS.text, { align: 'center', lineSpacing: LINE_H - FONT_SIZE - 2 })).setDepth(DEPTH.CAPTION + 1);
        this.text.setPosition(Math.round((SCREEN_W - this.text.width) / 2), Math.round((SCREEN_H - this.text.height) / 2));
        const targets = [this.rect, this.text];
        if (fade > 0) {
          this.rect.setAlpha(0);
          this.text.setAlpha(0);
          this._tween = ui.tweens.add({ targets, alpha: 1, duration: fade, onComplete: () => { this._tween = null; startHold(); } });
        } else {
          startHold();
        }
        return;
      }
      // Card styles: black first, the card lands a few frames later (slapped on).
      const slap = () => {
        this._slap = null;
        this._buildCard(lines);
        if (this.style === 'tape') {
          sfx('thud');
          this._shake(instant ? 0 : SLAP_SHAKE_MS);
        }
        startHold();
      };
      if (instant) slap();
      else this._slap = ui.time.delayedCall(SLAP_DELAY_MS, slap);
    });
  }

  _buildCard(lines) {
    const ui = this.ui;
    const flyer = this.style === 'flyer';
    const longest = Math.max(1, ...lines.map((l) => l.length));
    const pitch = flyer ? CHAR_W + FLYER_SPACING : CHAR_W;
    const textW = longest * pitch - (flyer ? FLYER_SPACING : 0);
    const w = Math.min(SCREEN_W - 8, Math.max(CARD.w, textW + CARD.pad * 2));
    const h = Math.max(CARD.h, lines.length * LINE_H + 8);
    const x = flyer ? Math.round((SCREEN_W - w) / 2) : CARD.x;
    const y = CARD.y - Math.round((h - CARD.h) / 2);
    this.cardRect = { x, y, w, h };
    this.card = ui.add.rectangle(x, y, w, h, 0xf8f8f8, 1).setOrigin(0, 0).setDepth(DEPTH.CAPTION + 1);
    this.text = ui.add.text(0, 0, lines, textStyle(COLORS.caption, { align: 'center', lineSpacing: LINE_H - FONT_SIZE - 2 })).setDepth(DEPTH.CAPTION + 3);
    if (flyer && typeof this.text.setLetterSpacing === 'function') this.text.setLetterSpacing(FLYER_SPACING);
    this.text.setPosition(x + Math.round((w - this.text.width) / 2), y + Math.round((h - this.text.height) / 2));
    if (this.style === 'tape') {
      // Atlas `tape` frame, else the art agent's `obj_tape` sheet, else drawn.
      const tex = ui.textures.exists(UI_KEY) ? ui.textures.get(UI_KEY) : null;
      const tapeKey = tex && tex.has('tape') ? [UI_KEY, 'tape'] : ui.textures.exists('obj_tape') ? ['obj_tape', 0] : null;
      const place = (tx, ty) => {
        if (tapeKey) return ui.add.image(tx, ty, tapeKey[0], tapeKey[1]).setOrigin(0, 0).setDepth(DEPTH.CAPTION + 2);
        // Drawn tape: gray strip with a lighter centre line, slightly translucent.
        const g = ui.add.graphics().setDepth(DEPTH.CAPTION + 2);
        g.fillStyle(0x8c8ca0, 0.9); g.fillRect(tx, ty, TAPE.w, TAPE.h);
        g.fillStyle(0xb0b0c0, 0.9); g.fillRect(tx + 1, ty + 3, TAPE.w - 2, 2);
        g.fillStyle(0x606078, 1); g.fillRect(tx, ty, 1, TAPE.h); g.fillRect(tx + TAPE.w - 1, ty, 1, TAPE.h);
        return g;
      };
      // Over the top-left and bottom-right corners, half on / half off the card.
      this.tapes = [place(x - 6, y - 3), place(x + w - TAPE.w + 6, y + h - TAPE.h + 3)];
    }
  }

  /** 1 px jitter of the card for `ms` (the slap). */
  _shake(ms) {
    if (!(ms > 0)) return;
    const parts = () => [this.card, this.text, ...this.tapes].filter(Boolean);
    const base = parts().map((p) => ({ p, x: p.x, y: p.y }));
    let phase = 0;
    const pattern = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    this._shaker = this.ui.time.addEvent({
      delay: 33,
      repeat: Math.max(1, Math.round(ms / 33)) - 1,
      callback: () => {
        const [dx, dy] = pattern[phase++ % 4];
        for (const b of base) if (b.p.active !== false) b.p.setPosition(b.x + dx, b.y + dy);
        if (this._shaker && this._shaker.repeatCount === 0) for (const b of base) b.p.setPosition(b.x, b.y);
      },
    });
  }

  _close(fade) {
    if (this.state !== 'open') return;
    this.state = 'closing';
    const targets = [this.rect, this.text, this.card, ...this.tapes].filter(Boolean);
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
    for (const k of ['_hold', '_slap', '_shaker']) {
      if (this[k]) { this[k].remove(); this[k] = null; }
    }
    this.rect?.destroy();
    this.text?.destroy();
    this.card?.destroy();
    for (const t of this.tapes) t.destroy();
    this.rect = this.text = this.card = null;
    this.tapes = [];
    const r = this._resolve;
    this._resolve = null;
    if (r) r();
  }

  debugState() {
    return { type: 'caption', state: this.state, style: this.style, card: this.cardRect || null, tapes: this.tapes.length };
  }
}
