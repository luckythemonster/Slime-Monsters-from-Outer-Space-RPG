// Earthbound-style battle backgrounds (docs/design-proposals/design_feel.md "Battle backgrounds").
// Each id is a 64×64 pixel pattern generated once into a CanvasTexture with 8 baked phase frames
// (palette-cycled or offset) laid side by side; it is displayed as one full-screen TileSprite that
// steps through the phases at 8–15 fps and scrolls by whole pixels once the Toon level asks for it.
// No per-frame pixel writes. Toon 3 swaps the single TileSprite for 28 strips with a sine warp;
// Toon 4 swaps the pattern for the purple-black rupture regardless of the id.
import Phaser from 'phaser';

const W = 256;
const H = 224;
const TILE = 64;
const PHASES = 8;
const STRIP_H = 8;

const PAL = {
  blues: ['#c8d8f0', '#8ea0c8', '#505878', '#2a1a4a'],
  purples: ['#0a0612', '#1a0a2a', '#3a1050', '#6a2a8a', '#a050c0', '#e0b0ff', '#6a2a8a', '#3a1050'],
  neon: ['#ff5fd2', '#39ff8a', '#40c0ff', '#ffe066', '#ff1aa0', '#c8ff3c'],
  beige: '#d8c8a8', vanguardBlue: '#2a3fa0', chrome: '#e8e8f0',
  outline: '#141018', ink: '#10101c', white: '#f4f4f4',
  posters: ['#ff5fd2', '#39ff8a', '#ffe066', '#40c0ff', '#e07040', '#8c8ca0'],
  sky: ['#2a1a4a', '#7a3a6a', '#e07040'],
  drywall: ['#d8d8e0', '#b8b8cc', '#8c8ca0'],
};

/** Deterministic tiny PRNG so the same id always bakes the same pixels. */
function prng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function px(ctx, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Pattern painters: (ctx, phase, originX) draw one 64×64 tile at originX. */
const PATTERNS = {
  street(ctx, phase, ox) {
    const c = PAL.blues;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const band = (Math.floor((x + y) / 4) + Math.floor(phase / 2)) % 4;
      px(ctx, ox + x, y, c[band]);
    }
  },
  alley(ctx, phase, ox) {
    const c = ['#505878', '#2a1a4a', '#3a3a4a', '#141018'];
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const brick = ((Math.floor(y / 8) % 2) * 8 + x) % 16 < 15 && y % 8 < 7;
      const band = (Math.floor((x + y) / 4) + Math.floor(phase / 2)) % 4;
      px(ctx, ox + x, y, brick ? c[band % 2] : c[3]);
    }
  },
  apartment_posters(ctx, phase, ox) {
    const r = prng(7);
    px(ctx, ox, 0, '#3a3a4a', TILE, TILE);
    for (let i = 0; i < 9; i++) {
      const w = 10 + Math.floor(r() * 14), h = 12 + Math.floor(r() * 16);
      const x = Math.floor(r() * (TILE - w)), y = Math.floor(r() * (TILE - h));
      const col = PAL.posters[(i + Math.floor(phase / 4)) % PAL.posters.length];
      px(ctx, ox + x, y, PAL.outline, w, h);
      px(ctx, ox + x + 1, y + 1, col, w - 2, h - 2);
      px(ctx, ox + x + 3, y + 3, PAL.white, Math.max(1, w - 6), 2);
    }
  },
  sticker_wall(ctx, phase, ox) {
    const r = prng(11);
    px(ctx, ox, 0, PAL.ink, TILE, TILE);
    for (let i = 0; i < 14; i++) {
      const w = 6 + Math.floor(r() * 10), h = 5 + Math.floor(r() * 8);
      const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
      const col = PAL.neon[i % PAL.neon.length];
      px(ctx, ox + x, y, col, w, h);
      px(ctx, ox + x + 1, y + 1, PAL.outline, Math.max(1, w - 2), 1);
    }
    // dot layer drifts up-left with the phase
    for (let y = 0; y < TILE; y += 8) for (let x = 0; x < TILE; x += 8) {
      px(ctx, ox + ((x + phase) % TILE), (y + TILE - phase) % TILE, '#8c8ca0');
    }
  },
  palmers_neon(ctx, phase, ox) {
    px(ctx, ox, 0, '#000000', TILE, TILE);
    const r = prng(23);
    for (let i = 0; i < 6; i++) {
      const col = PAL.neon[(i + phase) % PAL.neon.length];
      const y0 = 4 + i * 10;
      let y = y0;
      for (let x = 0; x < TILE; x++) {
        y = y0 + Math.round(3 * Math.sin((x + i * 7) / 5));
        px(ctx, ox + x, y, col);
        if (r() < 0.2) px(ctx, ox + x, y + 1, col);
      }
    }
  },
  black_hole(ctx, phase, ox) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const d = Math.sqrt((x - 32) * (x - 32) + (y - 32) * (y - 32));
      const ring = (Math.floor(d / 4) + phase) % PAL.purples.length;
      px(ctx, ox + x, y, PAL.purples[ring]);
    }
  },
  rupture(ctx, phase, ox) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const d = Math.abs(x - 32) + Math.abs(y - 32);
      const ring = (Math.floor(d / 5) + PHASES - phase) % PAL.purples.length;
      px(ctx, ox + x, y, PAL.purples[ring]);
    }
  },
  vanguard_grid(ctx, phase, ox) {
    px(ctx, ox, 0, PAL.beige, TILE, TILE);
    for (let i = 0; i < TILE; i += 16) { px(ctx, ox + i, 0, PAL.vanguardBlue, 1, TILE); px(ctx, ox, i, PAL.vanguardBlue, TILE, 1); }
    for (let y = 8; y < TILE; y += 32) for (let x = 8; x < TILE; x += 32) {
      // tie decal: a small knot and a tapered tail
      px(ctx, ox + x + 3, y, PAL.vanguardBlue, 2, 2);
      px(ctx, ox + x + 2, y + 2, PAL.vanguardBlue, 4, 6);
      px(ctx, ox + x + 3, y + 8, PAL.vanguardBlue, 2, 2);
      px(ctx, ox + x + 3, y + 3 + (phase % 2), PAL.chrome, 1, 2);
    }
  },
  palmers_roof_peel(ctx, phase, ox) {
    const r = prng(31 + phase);
    for (let y = 0; y < TILE; y++) px(ctx, ox, y, PAL.sky[Math.min(2, Math.floor(y / 24))], TILE, 1);
    for (let i = 0; i < 18; i++) px(ctx, ox + Math.floor(r() * TILE), Math.floor(r() * 40), i % 3 === phase % 3 ? PAL.white : '#8080a0');
    for (let x = 0; x < TILE; x += 16) {
      px(ctx, ox + x, 48 + (phase % 4), PAL.drywall[0], 12, 16);
      px(ctx, ox + x + 2, 50 + (phase % 4), PAL.drywall[2], 8, 2);
    }
  },
};

const ALIASES = { room4: 'sticker_wall', palmers: 'palmers_neon', citysound: 'sticker_wall', street_snow: 'street', apartment: 'apartment_posters', default: 'street' };
const FPS = { street: 8, alley: 8, apartment_posters: 8, sticker_wall: 10, palmers_neon: 8, black_hole: 12, rupture: 15, vanguard_grid: 8, palmers_roof_peel: 10 };

export const BACKGROUND_IDS = Object.keys(PATTERNS);

/** Texture key for a background id (baked on first use). */
export function ensureBackgroundTexture(scene, id) {
  const key = `bg_${id}`;
  if (scene.textures.exists(key)) return key;
  const painter = PATTERNS[id] || PATTERNS.street;
  const tex = scene.textures.createCanvas(key, TILE * PHASES, TILE);
  if (!tex) return null;
  const ctx = tex.context;
  for (let p = 0; p < PHASES; p++) painter(ctx, p, p * TILE);
  tex.refresh();
  for (let p = 0; p < PHASES; p++) tex.add(`p${p}`, 0, p * TILE, 0, TILE, TILE);
  return key;
}

export default class BattleBackground {
  /**
   * @param {Phaser.Scene} scene
   * @param {string} id background id (see PATTERNS; unknown ids fall back to street)
   * @param {{depth?: number}} [opts]
   */
  constructor(scene, id = 'street', { depth = 0 } = {}) {
    this.scene = scene;
    this.depth = depth;
    this.toon = 0;
    this.phase = 0;
    this.acc = 0;
    this.time = 0;
    this.scrollX = 0;
    this.scrollY = 0;
    this.sprite = null;
    this.strips = null;
    this.warp = 0;
    this.setId(id);
  }

  resolve(id) {
    const r = ALIASES[id] || id;
    return PATTERNS[r] ? r : 'street';
  }

  setId(id) {
    this.id = this.resolve(id);
    this.key = ensureBackgroundTexture(this.scene, this.effectiveId());
    this.rebuild();
  }

  /** Toon 4 is the rupture: `black_hole` (concentric purples cycling inward) whatever the fight's id. */
  effectiveId() {
    if (this.toon >= 4 && this.id !== 'palmers_roof_peel') return 'black_hole';
    return this.id;
  }

  rebuild() {
    this.destroyObjects();
    if (!this.key) return;
    const useStrips = this.toon === 3;
    if (useStrips) {
      this.strips = [];
      for (let i = 0; i < H / STRIP_H; i++) {
        const s = this.scene.add.tileSprite(0, i * STRIP_H, W, STRIP_H, this.key, 'p0').setOrigin(0, 0).setDepth(this.depth);
        s.tilePositionY = i * STRIP_H;
        this.strips.push(s);
      }
    } else {
      this.sprite = this.scene.add.tileSprite(0, 0, W, H, this.key, 'p0').setOrigin(0, 0).setDepth(this.depth);
    }
    this.applyPhase();
  }

  destroyObjects() {
    if (this.sprite) { this.sprite.destroy(); this.sprite = null; }
    if (this.strips) { for (const s of this.strips) s.destroy(); this.strips = null; }
  }

  /** 0–1 static, 2 scrolling, 3 sine-warped strips, 4 palette-cycled rupture. */
  setToonLevel(level) {
    const l = Math.max(0, Math.min(4, level | 0));
    if (l === this.toon) return;
    const before = this.effectiveId();
    const beforeStrips = this.toon === 3;
    this.toon = l;
    const after = this.effectiveId();
    if (after !== before) this.key = ensureBackgroundTexture(this.scene, after);
    if (after !== before || beforeStrips !== (l === 3)) this.rebuild();
  }

  objects() {
    return this.sprite ? [this.sprite] : (this.strips || []);
  }

  applyPhase() {
    const frame = `p${this.phase % PHASES}`;
    for (const o of this.objects()) {
      if (o.frame.name !== frame) o.setFrame(frame);
      o.tilePositionX = Math.round(this.scrollX) + (this.strips ? Math.round(this.warp * Math.sin(this.time / 130 + o.y / 16)) : 0);
      o.tilePositionY = Math.round(this.scrollY) + (this.strips ? o.y : 0);
    }
  }

  /** @param {number} delta ms since the last frame */
  update(delta) {
    this.time += delta;
    const fps = FPS[this.effectiveId()] || 8;
    this.acc += delta;
    const step = 1000 / fps;
    let changed = false;
    while (this.acc >= step) { this.acc -= step; this.phase = (this.phase + 1) % PHASES; changed = true; }
    if (this.toon >= 2) {
      // whole pixels: 1 px per frame at 60 fps, accumulated in ms
      this.scrollX += delta / 16.67;
      this.scrollY += this.toon >= 4 ? 0 : delta / 33.3;
      changed = true;
    }
    if (this.strips) { this.warp = 3; changed = true; }
    if (changed) this.applyPhase();
  }

  destroy() {
    this.destroyObjects();
  }
}
