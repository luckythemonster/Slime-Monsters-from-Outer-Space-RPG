// Insert window (DESIGN.md E9): a centred 128×72 flat window showing a sprite (the gig flyer, the
// itinerary) above an optional narrator line. With `text`, the narrator box opens under it and the
// last confirm closes both; without, one confirm closes the window. A missing sprite sheet shows a
// placeholder card so content never errors while art is in flight.
import Window from './Window.js';
import DialogueBox from './DialogueBox.js';
import { DEPTH, SCREEN_W, COLORS, textStyle, sfx } from './theme.js';

export const INSERT = { w: 128, h: 72, y: 40 };
const PLACEHOLDER_KEY = '__insert_placeholder';

function ensurePlaceholder(scene) {
  if (scene.textures.exists(PLACEHOLDER_KEY)) return PLACEHOLDER_KEY;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xf8f8f8, 1); g.fillRect(0, 0, 48, 32);
  g.lineStyle(1, 0x141018, 1); g.strokeRect(0.5, 0.5, 47, 31);
  g.fillStyle(0x8c8ca0, 1);
  for (let i = 0; i < 4; i++) g.fillRect(6, 6 + i * 6, 36 - i * 6, 2);
  g.generateTexture(PLACEHOLDER_KEY, 48, 32);
  g.destroy();
  return PLACEHOLDER_KEY;
}

export default class InsertWindow {
  constructor(ui) {
    this.ui = ui;
    this.state = 'idle';
    this.win = null;
    this.image = null;
    this.label = null;
    this.box = null;
    this._resolve = null;
    this._auto = null;
  }

  /** @param {{sprite: string, frame?: number|string, text?: string, who?: string}} opts */
  show({ sprite, frame = 0, text = null, who = 'narrator' } = {}) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.state = 'opening';
      this.sprite = sprite;
      this.text = text;
      this.who = who;
      this.frame = frame;
      this._open();
    });
  }

  async _open() {
    const ui = this.ui;
    const x = Math.round((SCREEN_W - INSERT.w) / 2);
    this.win = new Window(ui, x, INSERT.y, INSERT.w, INSERT.h, { depth: DEPTH.DIALOGUE });
    await this.win.open(ui.textInstant);
    if (this.state !== 'opening') return;
    const has = this.sprite && ui.textures.exists(this.sprite);
    const key = has ? this.sprite : ensurePlaceholder(ui);
    const tex = ui.textures.get(key);
    const frameOk = has && (tex.has(this.frame) || tex.has(String(this.frame)));
    this.image = ui.add.image(x + INSERT.w / 2, INSERT.y + INSERT.h / 2, key, frameOk ? this.frame : undefined).setDepth(DEPTH.DIALOGUE + 2);
    // Keep oversized art inside the window (integer scale only: 1/2, never fractional).
    const iw = this.image.width, ih = this.image.height;
    if (iw > INSERT.w - 8 || ih > INSERT.h - 8) this.image.setScale(0.5);
    this.placeholder = !has;
    if (!has) {
      this.label = ui.add.text(x + INSERT.w / 2, INSERT.y + INSERT.h - 14, String(this.sprite || '?').slice(0, 14), textStyle(COLORS.disabled)).setOrigin(0.5, 0).setDepth(DEPTH.DIALOGUE + 2);
    }
    sfx('item');
    this.state = 'open';
    if (this.text !== null && this.text !== undefined && String(this.text).length) {
      // The narrator line runs inside this modal: push it on the input stack directly.
      this.box = new DialogueBox(ui);
      ui._pushInput(this.box);
      try {
        await this.box.show({ text: this.text, who: this.who || 'narrator' });
      } finally {
        ui._popInput(this.box);
        this.box = null;
      }
      if (this.state === 'open') this._close();
      return;
    }
    if (ui.autoAdvance) {
      this._auto = ui.time.delayedCall(60, () => { this._auto = null; if (this.state === 'open') this._close(); });
    }
  }

  onAction(action) {
    if (action !== 'confirm' || this.state !== 'open' || this.box) return;
    this._close();
  }

  async _close() {
    if (this.state !== 'open') return;
    this.state = 'closing';
    this.image?.destroy();
    this.label?.destroy();
    this.image = this.label = null;
    if (this.win) {
      await this.win.close(this.ui.textInstant);
      this.win.destroy();
      this.win = null;
    }
    this._finish();
  }

  forceClose() {
    if (this.state === 'closed') return;
    this.state = 'closing';
    if (this.box) { const b = this.box; this.box = null; b.forceClose(); }
    this.image?.destroy();
    this.label?.destroy();
    this.win?.destroy();
    this.image = this.label = this.win = null;
    this._finish();
  }

  _finish() {
    this.state = 'closed';
    if (this._auto) { this._auto.remove(); this._auto = null; }
    const r = this._resolve;
    this._resolve = null;
    if (r) r();
  }

  debugState() {
    return { type: 'insert', state: this.state, sprite: this.sprite, placeholder: !!this.placeholder, text: !!this.text, box: this.box ? this.box.debugState() : null };
  }
}
