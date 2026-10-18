// Entity: grid-aware overworld sprite (player, NPC, map enemy, object, save point, follower).
// Movement is grid-locked 4-direction stepping with a linear tween per tile (ARCHITECTURE §12.3).
//
// Large objects (DESIGN.md E15): any manifest sheet size works. The sprite's feet sit on the bottom
// of its tile row and it is centred on `w` tiles (`"w": 2` for a 32 px wide sheet); its solid
// footprint is `w`×1 tiles unless `"footprint": [w, h]` (h rows counted upward from the feet row).
// Scripted `move`s are "ghost" moves (no collision) so CRASH can slide through dumpsters.
import Phaser from 'phaser';
import { TILE, DEPTH, DIRS, PIXEL_FONT, stepMs, scaleMs } from '../config.js';

/** Tile deltas per direction. */
export const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
/** Path letters (scripts/patrols) → direction. */
export const PATH_DIR = { U: 'up', D: 'down', L: 'left', R: 'right' };

const PLACEHOLDER_W = 16;
const PLACEHOLDER_H = 24;

/** Emote glyph → `ui` atlas frame (DESIGN.md "Emotes"). */
export const EMOTE_FRAMES = {
  '!': ['emote_excl', 'emote_bang'], '?': ['emote_quest', 'emote_question'], '…': ['emote_dots'], '...': ['emote_dots'],
  '♪': ['emote_note'], '♥': ['emote_heart'], 'zzz': ['emote_zzz'], 'z': ['emote_zzz'],
};
/** The boing: bubble offsets per frame relative to its rest position (4 px above the head). */
const EMOTE_BOING = [-2, -5, -4];

/** Deterministic pastel from a string (placeholder sprites). */
function hashColor(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  const r = 96 + ((h >>> 0) % 128), g = 96 + ((h >>> 8) % 128), b = 96 + ((h >>> 16) % 128);
  return (r << 16) | (g << 8) | b;
}

/**
 * Make sure a texture exists for a sheet name; generates a flat placeholder (and warns once)
 * when the manifest has no such sheet so content can be wired before art lands.
 * @param {Phaser.Scene} scene
 * @param {string} sheet
 * @param {{w?: number, h?: number}} [size] placeholder size in px (defaults to 16×24)
 */
export function ensureSheet(scene, sheet, size = {}) {
  if (scene.textures.exists(sheet)) return sheet;
  const pw = Math.max(8, size.w || PLACEHOLDER_W);
  const ph = Math.max(8, size.h || PLACEHOLDER_H);
  const key = `__ph_${sheet}_${pw}x${ph}`;
  if (!scene.textures.exists(key)) {
    console.warn(`[entities] sprite sheet "${sheet}" not in manifest; using placeholder`);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(hashColor(sheet), 1);
    g.fillRect(2, 4, pw - 4, ph - 4);
    g.fillStyle(0x141018, 1);
    g.fillRect(5, 10, 2, 2);
    g.fillRect(9, 10, 2, 2);
    g.generateTexture(key, pw, ph);
    g.destroy();
  }
  return key;
}

export class Entity extends Phaser.GameObjects.Sprite {
  /**
   * @param {Phaser.Scene & {isBlocked: Function, manifest: object}} scene ExploreScene
   * @param {object} def map entity definition (ARCHITECTURE §4) — `id`, `type`, `sprite`, `x`, `y`, …
   */
  constructor(scene, def) {
    const w = Math.max(1, def.w | 0 || 1);
    const sheet = def.sprite ? ensureSheet(scene, def.sprite, { w: w * TILE, h: def.h ? def.h * TILE : undefined }) : '__blank';
    super(scene, 0, 0, sheet, 0);
    this.id = def.id;
    this.type = def.type || 'npc';
    this.def = def;
    this.sheet = def.sprite || null;
    this.tileX = def.x;
    this.tileY = def.y;
    this.facing = DIRS.includes(def.facing) ? def.facing : 'down';
    this.moving = false;
    this.targetX = def.x;
    this.targetY = def.y;
    this.idlePending = false;
    this.emoteObj = null;
    this.emoteTimer = null;
    /** Tiles wide the sprite is centred on (E15). */
    this.w = w;
    /** Solid footprint [w, h] in tiles, bottom-anchored. */
    this.footprint = Array.isArray(def.footprint) && def.footprint.length === 2 ? [Math.max(1, def.footprint[0] | 0), Math.max(1, def.footprint[1] | 0)] : [w, 1];
    /** Ghosts never collide (followers, objects pushed by scripts). */
    this.ghost = !!def.ghost || this.type === 'follower';
    /** Blocks movement of others (objects may opt out with solid:false; followers never block). */
    this.solid = this.type === 'follower' ? false : def.solid !== undefined ? !!def.solid : this.type !== 'object' || !!def.sprite;
    this.homeX = def.x;
    this.homeY = def.y;
    this.setOrigin(0.5, 1);
    if (!def.sprite) this.setVisible(false);
    this.configure(def, true);
    this.setTile(def.x, def.y);
    scene.add.existing(this);
  }

  /** Apply behavior/facing/position/sprite tweaks (also used by {"setEntity"}). */
  configure(arg, initial = false) {
    if (arg.behavior !== undefined) {
      this.behavior = arg.behavior || 'idle';
      this.patrolIndex = 0;
      this.nextThink = 0;
    } else if (initial) {
      this.behavior = this.type === 'object' || this.type === 'follower' ? 'static' : 'idle';
      this.patrolIndex = 0;
      this.nextThink = 0;
    }
    this.radius = arg.radius !== undefined ? arg.radius : (this.radius ?? 2);
    this.sight = arg.sight !== undefined ? arg.sight : (this.sight ?? 5);
    this.patrolPath = arg.path !== undefined ? String(arg.path) : (this.patrolPath ?? '');
    if (arg.solid !== undefined) this.solid = !!arg.solid;
    if (arg.ghost !== undefined) this.ghost = !!arg.ghost;
    if (arg.visible !== undefined) this.setVisible(!!arg.visible);
    if (!initial) {
      if (arg.w !== undefined) this.w = Math.max(1, arg.w | 0);
      if (Array.isArray(arg.footprint) && arg.footprint.length === 2) this.footprint = [Math.max(1, arg.footprint[0] | 0), Math.max(1, arg.footprint[1] | 0)];
      if (arg.sprite !== undefined) this.setSheet(arg.sprite);
      if (arg.x !== undefined && arg.y !== undefined) this.setTile(arg.x, arg.y);
      if (arg.facing !== undefined) this.face(arg.facing);
    } else {
      this.playIdle();
    }
  }

  get feetY() { return this.y; }

  /** Y-sorted depth strictly between DECO and OVER (the player wins ties). */
  updateDepth() {
    this.setDepth(DEPTH.ENTITY + this.y / 1024 + (this.type === 'player' ? 0.0005 : 0));
    this._placeEmote();
  }

  /** Pixel position of the feet for a tile (centred on `w` tiles). */
  pixelFor(tx, ty) {
    return { x: tx * TILE + (this.w * TILE) / 2, y: ty * TILE + TILE };
  }

  /** Instant placement on a tile. */
  setTile(tx, ty) {
    this.tileX = tx; this.tileY = ty;
    this.targetX = tx; this.targetY = ty;
    const p = this.pixelFor(tx, ty);
    this.x = p.x;
    this.y = p.y;
    this.updateDepth();
  }

  /** True when the footprint anchored at (ax, ay) covers (tx, ty). */
  covers(ax, ay, tx, ty) {
    const [fw, fh] = this.footprint;
    return tx >= ax && tx < ax + fw && ty <= ay && ty > ay - fh;
  }

  /** The tiles this entity occupies or is stepping into. */
  occupies(tx, ty) {
    return this.covers(this.tileX, this.tileY, tx, ty) || (this.moving && this.covers(this.targetX, this.targetY, tx, ty));
  }

  // ---- animation ---------------------------------------------------------------------------------

  /** Animation key + flip for a dir, honouring manifest flipX and the walk_right = flipped walk_left rule. */
  animFor(kind, dir) {
    if (!this.sheet) return null;
    const anims = this.scene.anims;
    const manifest = this.scene.manifest && this.scene.manifest[this.sheet];
    const declared = (manifest && manifest.anims) || [];
    const flipOf = (name) => { const a = declared.find((d) => d.key === name || d.key === `${this.sheet}_${name}`); return !!(a && a.flipX); };
    const direct = `${this.sheet}_${kind}_${dir}`;
    if (anims.exists(direct)) return { key: direct, flip: flipOf(`${kind}_${dir}`) };
    const mirror = dir === 'right' ? 'left' : dir === 'left' ? 'right' : null;
    if (mirror && anims.exists(`${this.sheet}_${kind}_${mirror}`)) return { key: `${this.sheet}_${kind}_${mirror}`, flip: !flipOf(`${kind}_${mirror}`) };
    return null;
  }

  playWalk(dir) {
    const a = this.animFor('walk', dir);
    if (!a) return;
    this.setFlipX(a.flip);
    this.play(a.key, true);
  }

  playIdle() {
    this.idlePending = false;
    const idle = this.animFor('idle', this.facing);
    if (idle) { this.setFlipX(idle.flip); this.play(idle.key, true); return; }
    const walk = this.animFor('walk', this.facing);
    if (walk) {
      this.setFlipX(walk.flip);
      this.anims.stop();
      const anim = this.scene.anims.get(walk.key);
      if (anim && anim.frames[0]) this.setFrame(anim.frames[0].frame.name);
      return;
    }
    // Objects: a directionless `<sheet>_idle` loop when the sheet declares one.
    if (this.sheet && this.scene.anims.exists(`${this.sheet}_idle`)) this.play(`${this.sheet}_idle`, true);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (this.idlePending && !this.moving) this.playIdle();
  }

  // ---- facing / sheet --------------------------------------------------------------------------

  /** @param {string} dir */
  face(dir) {
    if (!DIRS.includes(dir)) return;
    this.facing = dir;
    if (!this.moving) this.playIdle();
    if (this.scene && typeof this.scene.onEntityFace === 'function') this.scene.onEntityFace(this);
  }

  /** Face another entity (dominant axis). */
  faceToward(other) {
    const dx = other.tileX - this.tileX, dy = other.tileY - this.tileY;
    if (Math.abs(dx) > Math.abs(dy)) this.face(dx > 0 ? 'right' : 'left');
    else if (dy !== 0) this.face(dy > 0 ? 'down' : 'up');
  }

  /** Swap sprite sheet (keeps facing and tile; the feet stay put whatever the new frame size). */
  setSheet(sheet) {
    this.sheet = sheet;
    this.setTexture(ensureSheet(this.scene, sheet, { w: this.w * TILE }), 0);
    this.setOrigin(0.5, 1);
    this.setVisible(true);
    this.setTile(this.tileX, this.tileY);
    this.playIdle();
  }

  /**
   * Play an arbitrary animation key. Resolves on completion when `wait` (looping anims resolve immediately).
   * @returns {Promise<void>}
   */
  playAnim(key, { wait = true } = {}) {
    if (!this.scene.anims.exists(key)) { console.warn(`[entities] unknown animation "${key}"`); return Promise.resolve(); }
    this.play(key, false);
    const anim = this.scene.anims.get(key);
    if (!wait || !anim || anim.repeat === -1) return Promise.resolve();
    return new Promise((resolve) => this.once(`animationcomplete-${key}`, () => resolve()));
  }

  /** Top of the sprite in world pixels (for emotes). */
  get headY() { return this.y - this.displayHeight; }

  _placeEmote() {
    if (!this.emoteObj) return;
    const rest = Math.round(this.headY) - 4;
    this.emoteObj.setPosition(Math.round(this.x), rest + (this.emoteDy || 0));
  }

  /**
   * Emote bubble 4 px above the head (DESIGN.md "Emotes"): the `ui` atlas `emote_*` frame when it
   * exists, else the glyph as text. Pops with the 3-frame boing (y−2, y−5, y−4; no scaling).
   */
  showEmote(type = '!', ms = 700) {
    this.hideEmote();
    const scene = this.scene;
    const names = EMOTE_FRAMES[type] || EMOTE_FRAMES[String(type).toLowerCase()] || [];
    const uiTex = scene.textures.exists('ui') ? scene.textures.get('ui') : null;
    const frame = uiTex ? names.find((n) => uiTex.has(n)) : null;
    if (frame) {
      this.emoteObj = scene.add.image(0, 0, 'ui', frame).setOrigin(0.5, 1).setDepth(DEPTH.OVER + 1);
    } else {
      this.emoteObj = scene.add.text(0, 0, String(type), { fontFamily: PIXEL_FONT, fontSize: '8px', color: '#ffffff', resolution: 1 })
        .setOrigin(0.5, 1).setDepth(DEPTH.OVER + 1);
    }
    let i = 0;
    this.emoteDy = EMOTE_BOING[0];
    this._placeEmote();
    const boing = scene.time.addEvent({
      delay: 16, repeat: EMOTE_BOING.length - 1,
      callback: () => { i = Math.min(i + 1, EMOTE_BOING.length - 1); this.emoteDy = EMOTE_BOING[i]; this._placeEmote(); },
    });
    return new Promise((resolve) => {
      this.emoteTimer = scene.time.delayedCall(scaleMs(ms), () => {
        boing.remove();
        this.hideEmote();
        resolve();
      });
    });
  }

  hideEmote() {
    if (this.emoteTimer) { this.emoteTimer.remove(); this.emoteTimer = null; }
    if (this.emoteObj) { this.emoteObj.destroy(); this.emoteObj = null; }
  }

  // ---- movement ----------------------------------------------------------------------------------

  /**
   * Take one tile step. Resolves true when the step finished, false when blocked (the entity still
   * turns to face `dir`) or when the entity is gone.
   * @param {string} dir up|down|left|right
   * @param {'walk'|'run'} [speed]
   * @param {{ghost?: boolean}} [opts] ghost steps ignore collision
   * @returns {Promise<boolean>}
   */
  step(dir, speed = 'walk', { ghost = this.ghost } = {}) {
    if (!this.scene || !this.active || this.moving) return Promise.resolve(false);
    const [dx, dy] = DELTA[dir] || [0, 0];
    const tx = this.tileX + dx, ty = this.tileY + dy;
    if (!ghost && this.scene.isBlocked(tx, ty, this)) { this.face(dir); return Promise.resolve(false); }
    const fromX = this.tileX, fromY = this.tileY;
    this.facing = dir;
    this.moving = true;
    this.idlePending = false;
    this.targetX = tx; this.targetY = ty;
    this.playWalk(dir);
    if (typeof this.scene.onEntityStepStart === 'function') this.scene.onEntityStepStart(this, fromX, fromY, speed);
    const p = this.pixelFor(tx, ty);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x: p.x,
        y: p.y,
        duration: stepMs(speed),
        ease: 'Linear',
        onUpdate: () => this.updateDepth(),
        onComplete: () => {
          this.moving = false;
          this.setTile(tx, ty);
          this.idlePending = true;
          if (this.scene && typeof this.scene.onEntityStep === 'function') this.scene.onEntityStep(this);
          resolve(true);
        },
        onStop: () => { this.moving = false; resolve(false); },
      });
    });
  }

  /**
   * Walk a path string of U/D/L/R ('.' pauses one step). Blocked steps retry up to 3 times.
   * @param {string} path
   * @param {{speed?: 'walk'|'run', ghost?: boolean}} [opts]
   */
  async walkPath(path, { speed = 'walk', ghost = this.ghost } = {}) {
    for (const ch of String(path)) {
      if (!this.scene || !this.active) return;
      if (ch === '.') { await this.pause(stepMs(speed)); continue; }
      const dir = PATH_DIR[ch.toUpperCase()];
      if (!dir) continue;
      let ok = false;
      for (let tries = 0; tries < 3 && !ok; tries++) {
        ok = await this.step(dir, speed, { ghost });
        if (!ok) await this.pause(120);
      }
    }
  }

  /** One step toward a tile (dominant axis first), ghosting; used by followers catching up. */
  stepToward(tx, ty, speed = 'walk') {
    const dx = tx - this.tileX, dy = ty - this.tileY;
    if (dx === 0 && dy === 0) return Promise.resolve(false);
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    return this.step(dir, speed, { ghost: true });
  }

  pause(ms) {
    return new Promise((resolve) => { if (this.scene) this.scene.time.delayedCall(ms, resolve); else resolve(); });
  }

  // ---- behaviors ---------------------------------------------------------------------------------

  /** Called by ExploreScene each frame when AI is not frozen. */
  updateBehavior(time) {
    if (this.moving || this.type === 'object' || this.type === 'follower') return;
    switch (this.behavior) {
      case 'wander': return this.thinkWander(time);
      case 'patrol': return this.thinkPatrol(time);
      case 'chase': return this.thinkChase(time);
      default: return undefined;
    }
  }

  thinkWander(time) {
    if (time < this.nextThink) return;
    this.nextThink = time + 700 + Math.random() * 1200;
    const dir = DIRS[Math.floor(Math.random() * 4)];
    const [dx, dy] = DELTA[dir];
    if (Math.abs(this.tileX + dx - this.homeX) > this.radius || Math.abs(this.tileY + dy - this.homeY) > this.radius) return;
    this.step(dir, 'walk', { ghost: false });
  }

  thinkPatrol(time) {
    if (time < this.nextThink || !this.patrolPath) return;
    const ch = this.patrolPath[this.patrolIndex % this.patrolPath.length];
    this.patrolIndex++;
    if (ch === '.') { this.nextThink = time + 300; return; }
    const dir = PATH_DIR[ch.toUpperCase()];
    if (!dir) return;
    this.step(dir, 'walk', { ghost: false }).then((ok) => { if (!ok) { this.patrolIndex--; this.nextThink = this.scene ? this.scene.time.now + 400 : 0; } });
  }

  thinkChase(time) {
    const player = this.scene.player;
    if (!player || time < this.nextThink) return;
    const dx = player.tileX - this.tileX, dy = player.tileY - this.tileY;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist > this.sight) return;
    if (dist === 1) { this.faceToward(player); this.scene.onEnemyTouch(this); return; }
    this.nextThink = time + 60;
    const first = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    const second = Math.abs(dx) >= Math.abs(dy) ? (dy > 0 ? 'down' : dy < 0 ? 'up' : null) : (dx > 0 ? 'right' : dx < 0 ? 'left' : null);
    this.step(first, 'walk', { ghost: false }).then((ok) => { if (!ok && second) this.step(second, 'walk', { ghost: false }); });
  }

  destroy(fromScene) {
    this.hideEmote();
    super.destroy(fromScene);
  }
}
