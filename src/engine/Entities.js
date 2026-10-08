// Entity: grid-aware overworld sprite (player, NPC, map enemy, object, save point).
// Movement is grid-locked 4-direction stepping with a linear tween per tile (ARCHITECTURE §12.3).
import Phaser from 'phaser';
import { TILE, DEPTH, DIRS, PIXEL_FONT, stepMs, scaleMs } from '../config.js';

/** Tile deltas per direction. */
export const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
/** Path letters (scripts/patrols) → direction. */
export const PATH_DIR = { U: 'up', D: 'down', L: 'left', R: 'right' };

const PLACEHOLDER_W = 16;
const PLACEHOLDER_H = 24;

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
 */
export function ensureSheet(scene, sheet) {
  if (scene.textures.exists(sheet)) return sheet;
  const key = `__ph_${sheet}`;
  if (!scene.textures.exists(key)) {
    console.warn(`[entities] sprite sheet "${sheet}" not in manifest; using placeholder`);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(hashColor(sheet), 1);
    g.fillRect(2, 4, PLACEHOLDER_W - 4, PLACEHOLDER_H - 4);
    g.fillStyle(0x141018, 1);
    g.fillRect(5, 10, 2, 2);
    g.fillRect(9, 10, 2, 2);
    g.generateTexture(key, PLACEHOLDER_W, PLACEHOLDER_H);
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
    const sheet = def.sprite ? ensureSheet(scene, def.sprite) : '__blank';
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
    this.emoteText = null;
    /** Blocks movement of others (objects may opt out with solid:false). */
    this.solid = def.solid !== undefined ? !!def.solid : this.type !== 'object' || !!def.sprite;
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
      this.behavior = this.type === 'object' ? 'static' : 'idle';
      this.patrolIndex = 0;
      this.nextThink = 0;
    }
    this.radius = arg.radius !== undefined ? arg.radius : (this.radius ?? 2);
    this.sight = arg.sight !== undefined ? arg.sight : (this.sight ?? 5);
    this.patrolPath = arg.path !== undefined ? String(arg.path) : (this.patrolPath ?? '');
    if (arg.solid !== undefined) this.solid = !!arg.solid;
    if (arg.visible !== undefined) this.setVisible(!!arg.visible);
    if (arg.sprite !== undefined && !initial) this.setSheet(arg.sprite);
    if (arg.x !== undefined && arg.y !== undefined && !initial) this.setTile(arg.x, arg.y);
    if (arg.facing !== undefined && !initial) this.face(arg.facing);
    else if (initial) this.playIdle();
  }

  get feetY() { return this.y; }

  /** Y-sorted depth strictly between DECO and OVER. */
  updateDepth() {
    this.setDepth(DEPTH.ENTITY + this.y / 1024);
    if (this.emoteText) this.emoteText.setPosition(Math.round(this.x), Math.round(this.y) - 30);
  }

  /** Instant placement on a tile. */
  setTile(tx, ty) {
    this.tileX = tx; this.tileY = ty;
    this.targetX = tx; this.targetY = ty;
    this.x = tx * TILE + TILE / 2;
    this.y = ty * TILE + TILE;
    this.updateDepth();
  }

  /** The tile this entity occupies or is stepping into. */
  occupies(tx, ty) {
    return (this.tileX === tx && this.tileY === ty) || (this.moving && this.targetX === tx && this.targetY === ty);
  }

  // ---- animation ---------------------------------------------------------------------------------

  /** Animation key + flip for a dir, honouring manifest flipX and the walk_right = flipped walk_left rule. */
  animFor(kind, dir) {
    if (!this.sheet) return null;
    const anims = this.scene.anims;
    const manifest = this.scene.manifest && this.scene.manifest[this.sheet];
    const declared = (manifest && manifest.anims) || [];
    const flipOf = (name) => { const a = declared.find((d) => d.key === name); return !!(a && a.flipX); };
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
    }
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
  }

  /** Face another entity (dominant axis). */
  faceToward(other) {
    const dx = other.tileX - this.tileX, dy = other.tileY - this.tileY;
    if (Math.abs(dx) > Math.abs(dy)) this.face(dx > 0 ? 'right' : 'left');
    else if (dy !== 0) this.face(dy > 0 ? 'down' : 'up');
  }

  /** Swap sprite sheet (keeps facing). */
  setSheet(sheet) {
    this.sheet = sheet;
    this.setTexture(ensureSheet(this.scene, sheet), 0);
    this.setOrigin(0.5, 1);
    this.setVisible(true);
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

  /** Tiny text glyph above the head (emote bubble placeholder). */
  showEmote(type = '!', ms = 700) {
    if (this.emoteText) this.emoteText.destroy();
    this.emoteText = this.scene.add.text(0, 0, type, { fontFamily: PIXEL_FONT, fontSize: '8px', color: '#ffffff', resolution: 1 })
      .setOrigin(0.5, 1).setDepth(DEPTH.OVER + 1);
    this.updateDepth();
    return new Promise((resolve) => {
      this.scene.time.delayedCall(scaleMs(ms), () => {
        if (this.emoteText) { this.emoteText.destroy(); this.emoteText = null; }
        resolve();
      });
    });
  }

  // ---- movement ----------------------------------------------------------------------------------

  /**
   * Take one tile step. Resolves true when the step finished, false when blocked (the entity still
   * turns to face `dir`) or when the entity is gone.
   * @param {string} dir up|down|left|right
   * @param {'walk'|'run'} [speed]
   * @returns {Promise<boolean>}
   */
  step(dir, speed = 'walk') {
    if (!this.scene || !this.active || this.moving) return Promise.resolve(false);
    this.facing = dir;
    const [dx, dy] = DELTA[dir] || [0, 0];
    const tx = this.tileX + dx, ty = this.tileY + dy;
    if (this.scene.isBlocked(tx, ty, this)) { this.playIdle(); return Promise.resolve(false); }
    this.moving = true;
    this.idlePending = false;
    this.targetX = tx; this.targetY = ty;
    this.playWalk(dir);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x: tx * TILE + TILE / 2,
        y: ty * TILE + TILE,
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
   * @param {{speed?: 'walk'|'run'}} [opts]
   */
  async walkPath(path, { speed = 'walk' } = {}) {
    for (const ch of String(path)) {
      if (!this.scene || !this.active) return;
      if (ch === '.') { await this.pause(stepMs(speed)); continue; }
      const dir = PATH_DIR[ch.toUpperCase()];
      if (!dir) continue;
      let ok = false;
      for (let tries = 0; tries < 3 && !ok; tries++) {
        ok = await this.step(dir, speed);
        if (!ok) await this.pause(120);
      }
    }
  }

  pause(ms) {
    return new Promise((resolve) => { if (this.scene) this.scene.time.delayedCall(ms, resolve); else resolve(); });
  }

  // ---- behaviors ---------------------------------------------------------------------------------

  /** Called by ExploreScene each frame when AI is not frozen. */
  updateBehavior(time) {
    if (this.moving || this.type === 'object') return;
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
    this.step(dir);
  }

  thinkPatrol(time) {
    if (time < this.nextThink || !this.patrolPath) return;
    const ch = this.patrolPath[this.patrolIndex % this.patrolPath.length];
    this.patrolIndex++;
    if (ch === '.') { this.nextThink = time + 300; return; }
    const dir = PATH_DIR[ch.toUpperCase()];
    if (!dir) return;
    this.step(dir).then((ok) => { if (!ok) { this.patrolIndex--; this.nextThink = this.scene ? this.scene.time.now + 400 : 0; } });
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
    this.step(first).then((ok) => { if (!ok && second) this.step(second); });
  }

  destroy(fromScene) {
    if (this.emoteText) { this.emoteText.destroy(); this.emoteText = null; }
    super.destroy(fromScene);
  }
}
