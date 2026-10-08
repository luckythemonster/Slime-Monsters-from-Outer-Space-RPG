// FF-style 9-slice window built from the generated `ui` atlas frames:
//   win_tl win_t win_tr / win_l win_c win_r / win_bl win_b win_br   (8x8 each)
// Corners are Images, edges and the centre fill are TileSprites so the border art repeats
// crisply at any size. The Container's (x, y) is the window's top-left corner.
// open()/close() play a fast vertical "unfold" (the window grows from a 16 px strip at its
// vertical centre) on whole pixels only.
import Phaser from 'phaser';
import { DEPTH } from './theme.js';
import { UI_KEY } from './atlas.js';

export const CORNER = 8; // nominal corner size; the real size is read from the win_tl frame
export const OPEN_MS = 120;

/** Corner size of the window art in a texture (falls back to 8 when the frame is missing). */
export function cornerSize(textures, texture = UI_KEY) {
  if (!textures || !textures.exists(texture)) return CORNER;
  const tex = textures.get(texture);
  if (!tex.has('win_tl')) return CORNER;
  const f = tex.get('win_tl');
  return Math.max(1, Math.min(f.width | 0, f.height | 0) || CORNER);
}

export default class Window extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x top-left x
   * @param {number} y top-left y
   * @param {number} w width in px (>= 16)
   * @param {number} h height in px (>= 16)
   * @param {{ depth?: number, texture?: string }} [opts]
   */
  constructor(scene, x, y, w, h, { depth = DEPTH.WINDOW, texture = UI_KEY } = {}) {
    super(scene, Math.round(x), Math.round(y));
    this.texKey = texture;
    this.corner = cornerSize(scene.textures, texture);
    this.minSize = this.corner * 2;
    this.baseY = Math.round(y);
    this.fullW = Math.max(this.minSize, Math.round(w));
    this.fullH = Math.max(this.minSize, Math.round(h));
    this.curH = this.fullH;
    this.isOpen = false;
    this._tween = null;
    this._build();
    super.setSize(this.fullW, this.fullH);
    this.setDepth(depth);
    this.setVisible(false);
    scene.add.existing(this);
  }

  _build() {
    const s = this.scene;
    const k = this.texKey;
    const img = (f) => s.add.image(0, 0, k, f).setOrigin(0, 0);
    const tile = (f) => s.add.tileSprite(0, 0, this.corner, this.corner, k, f).setOrigin(0, 0);
    this.p = {
      c: tile('win_c'),
      t: tile('win_t'),
      b: tile('win_b'),
      l: tile('win_l'),
      r: tile('win_r'),
      tl: img('win_tl'),
      tr: img('win_tr'),
      bl: img('win_bl'),
      br: img('win_br'),
    };
    const p = this.p;
    this.add([p.c, p.t, p.b, p.l, p.r, p.tl, p.tr, p.bl, p.br]);
    this._layout(this.fullW, this.fullH);
  }

  /** Position all nine pieces for a w x h frame (local coordinates, integers). */
  _layout(w, h) {
    const p = this.p;
    const C = this.corner;
    w = Math.round(w);
    h = Math.round(h);
    const iw = Math.max(0, w - 2 * C);
    const ih = Math.max(0, h - 2 * C);
    p.tl.setPosition(0, 0);
    p.tr.setPosition(w - C, 0);
    p.bl.setPosition(0, h - C);
    p.br.setPosition(w - C, h - C);
    p.t.setPosition(C, 0).setSize(Math.max(1, iw), C).setVisible(iw > 0);
    p.b.setPosition(C, h - C).setSize(Math.max(1, iw), C).setVisible(iw > 0);
    p.l.setPosition(0, C).setSize(C, Math.max(1, ih)).setVisible(ih > 0);
    p.r.setPosition(w - C, C).setSize(C, Math.max(1, ih)).setVisible(ih > 0);
    p.c.setPosition(C, C).setSize(Math.max(1, iw), Math.max(1, ih)).setVisible(iw > 0 && ih > 0);
    this.curH = h;
  }

  /** Resize the window (top-left stays put). */
  setSize(w, h) {
    if (!this.p) return super.setSize(w, h); // called by Container internals before _build
    this.fullW = Math.max(this.minSize, Math.round(w));
    this.fullH = Math.max(this.minSize, Math.round(h));
    this._stopTween();
    this.y = this.baseY;
    this._layout(this.fullW, this.fullH);
    return super.setSize(this.fullW, this.fullH);
  }

  /** Move the window's top-left corner. */
  moveTo(x, y) {
    this.baseY = Math.round(y);
    this.setPosition(Math.round(x), this.baseY);
    return this;
  }

  _stopTween() {
    if (this._tween) {
      this._tween.stop();
      this._tween.remove();
      this._tween = null;
    }
  }

  /** Open with the unfold animation (instant when `instant`). Resolves when fully open. */
  open(instant = false) {
    this._stopTween();
    this.setVisible(true);
    this.isOpen = true;
    if (instant || !this.scene) {
      this.y = this.baseY;
      this._layout(this.fullW, this.fullH);
      return Promise.resolve();
    }
    this._unfold(0);
    return new Promise((resolve) => {
      this._tween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: OPEN_MS,
        ease: 'Linear',
        onUpdate: (tw) => this._unfold(tw.getValue()),
        onComplete: () => {
          this._tween = null;
          this._unfold(1);
          resolve();
        },
      });
    });
  }

  /** Close with the fold animation, then hide. Resolves when hidden. */
  close(instant = false) {
    this._stopTween();
    this.isOpen = false;
    if (instant || !this.scene || !this.visible) {
      this.setVisible(false);
      this.y = this.baseY;
      this._layout(this.fullW, this.fullH);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this._tween = this.scene.tweens.addCounter({
        from: 1,
        to: 0,
        duration: OPEN_MS,
        ease: 'Linear',
        onUpdate: (tw) => this._unfold(tw.getValue()),
        onComplete: () => {
          this._tween = null;
          this.setVisible(false);
          this.y = this.baseY;
          this._layout(this.fullW, this.fullH);
          resolve();
        },
      });
    });
  }

  /** Lay out the frame at fraction v of its full height, centred vertically on the full box. */
  _unfold(v) {
    const m = this.minSize;
    const h = Math.round(m + (this.fullH - m) * Phaser.Math.Clamp(v, 0, 1));
    this.y = this.baseY + Math.round((this.fullH - h) / 2);
    this._layout(this.fullW, h);
  }

  preDestroy() {
    this._stopTween();
    super.preDestroy();
  }
}
