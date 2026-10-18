// FF-style 9-slice window built from the generated `ui` atlas frames:
//   win_tl win_t win_tr / win_l win_c win_r / win_bl win_b win_br   (8x8 each)
// Corners are Images, edges and the centre fill are TileSprites so the border art repeats
// crisply at any size. The Container's (x, y) is the window's top-left corner.
// open()/close() play a fast vertical "unfold" (the window grows from a 16 px strip at its
// vertical centre) on whole pixels only; collapse() is the 4-frame squash Dad's window gets.
//
// `prefix` picks another frame family from the atlas (`ffwin_*` Dad's FF gradient window,
// `capwin_*` Ryan's inverted caption, `tornwin_*` Toon 4). When the atlas has no such frames the
// window is drawn with Graphics in the DESIGN.md colours instead, so content never waits on art.
import Phaser from 'phaser';
import { DEPTH } from './theme.js';
import { UI_KEY } from './atlas.js';

export const CORNER = 8; // nominal corner size; the real size is read from the win_tl frame
export const OPEN_MS = 120;
export const COLLAPSE_FRAMES = 4;

const PIECES = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];

/** Drawn fallbacks per frame family (DESIGN.md "Window style"). */
const DRAWN = {
  ffwin: { bands: [0x0028a0, 0x001c78, 0x001050, 0x000838], border: [0xf8f8f8, 0x141018, 0xf8f8f8] },
  capwin: { bands: [0xf8f8f8], border: [0x141018, 0xf8f8f8, 0x141018] },
  tornwin: { bands: [0x10101c], border: [0x141018, 0xa050c0, 0x141018] },
};

/** True when the texture carries all nine `${prefix}_*` pieces. */
export function hasFrameFamily(textures, prefix, texture = UI_KEY) {
  if (!textures || !textures.exists(texture)) return false;
  const tex = textures.get(texture);
  return PIECES.every((p) => tex.has(`${prefix}_${p}`));
}

/** Corner size of the window art in a texture (falls back to 8 when the frame is missing). */
export function cornerSize(textures, texture = UI_KEY, prefix = 'win') {
  if (!textures || !textures.exists(texture)) return CORNER;
  const tex = textures.get(texture);
  if (!tex.has(`${prefix}_tl`)) return CORNER;
  const f = tex.get(`${prefix}_tl`);
  return Math.max(1, Math.min(f.width | 0, f.height | 0) || CORNER);
}

export default class Window extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x top-left x
   * @param {number} y top-left y
   * @param {number} w width in px (>= 16)
   * @param {number} h height in px (>= 16)
   * @param {{ depth?: number, texture?: string, prefix?: 'win'|'ffwin'|'capwin'|'tornwin' }} [opts]
   */
  constructor(scene, x, y, w, h, { depth = DEPTH.WINDOW, texture = UI_KEY, prefix = 'win' } = {}) {
    super(scene, Math.round(x), Math.round(y));
    this.texKey = texture;
    this.prefix = prefix;
    this.drawn = prefix !== 'win' && !hasFrameFamily(scene.textures, prefix, texture) ? (DRAWN[prefix] || DRAWN.ffwin) : null;
    this.corner = this.drawn ? 4 : cornerSize(scene.textures, texture, prefix);
    this.minSize = this.corner * 2;
    this.baseY = Math.round(y);
    this.fullW = Math.max(this.minSize, Math.round(w));
    this.fullH = Math.max(this.minSize, Math.round(h));
    this.curH = this.fullH;
    this.isOpen = false;
    this._tween = null;
    this._timer = null;
    this._build();
    super.setSize(this.fullW, this.fullH);
    this.setDepth(depth);
    this.setVisible(false);
    scene.add.existing(this);
  }

  _build() {
    const s = this.scene;
    if (this.drawn) {
      this.g = s.add.graphics();
      this.add(this.g);
      this._layout(this.fullW, this.fullH);
      return;
    }
    const k = this.texKey;
    const f = (p) => `${this.prefix}_${p}`;
    const img = (p) => s.add.image(0, 0, k, f(p)).setOrigin(0, 0);
    const tile = (p) => s.add.tileSprite(0, 0, this.corner, this.corner, k, f(p)).setOrigin(0, 0);
    this.p = {
      c: tile('c'),
      t: tile('t'),
      b: tile('b'),
      l: tile('l'),
      r: tile('r'),
      tl: img('tl'),
      tr: img('tr'),
      bl: img('bl'),
      br: img('br'),
    };
    const p = this.p;
    this.add([p.c, p.t, p.b, p.l, p.r, p.tl, p.tr, p.bl, p.br]);
    this._layout(this.fullW, this.fullH);
  }

  /** Redraw the Graphics fallback at w x h (bands + double border, square corners). */
  _draw(w, h) {
    const g = this.g;
    const st = this.drawn;
    g.clear();
    if (w <= 0 || h <= 0) return;
    const n = st.bands.length;
    const bandH = Math.max(1, Math.floor(h / n));
    for (let i = 0; i < n; i++) {
      const bh = i === n - 1 ? h - bandH * i : bandH;
      g.fillStyle(st.bands[i], 1);
      g.fillRect(0, i * bandH, w, Math.max(0, bh));
    }
    st.border.forEach((color, i) => {
      if (w - 2 * i <= 0 || h - 2 * i <= 0) return;
      g.lineStyle(1, color, 1);
      g.strokeRect(i + 0.5, i + 0.5, w - 2 * i - 1, h - 2 * i - 1);
    });
  }

  /** Position all nine pieces for a w x h frame (local coordinates, integers). */
  _layout(w, h) {
    w = Math.round(w);
    h = Math.round(h);
    this.curH = h;
    if (this.drawn) { this._draw(w, h); return; }
    const p = this.p;
    const C = this.corner;
    const iw = Math.max(0, w - 2 * C);
    const ih = Math.max(0, h - 2 * C);
    const tiny = h < 2 * C;
    p.tl.setPosition(0, 0).setVisible(!tiny);
    p.tr.setPosition(w - C, 0).setVisible(!tiny);
    p.bl.setPosition(0, h - C).setVisible(!tiny);
    p.br.setPosition(w - C, h - C).setVisible(!tiny);
    p.t.setPosition(C, 0).setSize(Math.max(1, iw), tiny ? Math.max(1, Math.floor(h / 2)) : C).setVisible(iw > 0 && h > 0);
    p.b.setPosition(C, tiny ? Math.floor(h / 2) : h - C).setSize(Math.max(1, iw), tiny ? Math.max(1, h - Math.floor(h / 2)) : C).setVisible(iw > 0 && h > 0);
    p.l.setPosition(0, C).setSize(C, Math.max(1, ih)).setVisible(ih > 0);
    p.r.setPosition(w - C, C).setSize(C, Math.max(1, ih)).setVisible(ih > 0);
    p.c.setPosition(C, C).setSize(Math.max(1, iw), Math.max(1, ih)).setVisible(iw > 0 && ih > 0);
  }

  /** Resize the window (top-left stays put). */
  setSize(w, h) {
    if (!this.p && !this.g) return super.setSize(w, h); // called by Container internals before _build
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
    if (this._timer) {
      this._timer.remove();
      this._timer = null;
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

  /**
   * Squash the window vertically to nothing in `frames` game frames (DESIGN.md E10: Dad's window
   * collapses 56 → 0 px in 4 frames), keeping its vertical centre. Resolves when hidden.
   */
  collapse(frames = COLLAPSE_FRAMES) {
    this._stopTween();
    this.isOpen = false;
    if (!this.scene || !this.visible) { this.setVisible(false); return Promise.resolve(); }
    const full = this.fullH;
    let i = 0;
    return new Promise((resolve) => {
      const step = () => {
        i++;
        const h = Math.max(0, Math.round(full * (1 - i / frames)));
        if (h <= 0 || i >= frames) {
          this._timer = null;
          this.setVisible(false);
          this.y = this.baseY;
          this._layout(this.fullW, this.fullH);
          resolve();
          return;
        }
        this.y = this.baseY + Math.round((full - h) / 2);
        this._layout(this.fullW, h);
        this._timer = this.scene.time.delayedCall(16, step);
      };
      step();
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
