// GameState: flags, vars, party, inventory, money, position, playtime; save/load (ARCHITECTURE §6).
// Pure module (no Phaser). Scenes never mutate state except through these APIs.
import { Party } from './Party.js';
import { Inventory } from './Inventory.js';
import { SAVE_PREFIX, SAVE_SLOTS } from '../config.js';

export const SAVE_VERSION = 1;

/**
 * @typedef {object} GameData
 * @property {object} characters characters.json
 * @property {object} items items.json
 * @property {object} equipment equipment.json
 * @property {{map: string, x: number, y: number, facing: string, party?: string[], money?: number, items?: {id: string, qty: number}[]}} start start.json
 */

export class GameState {
  /**
   * @param {GameData} data
   * @param {Storage|null} [storage] defaults to globalThis.localStorage (tests pass a fake)
   */
  constructor(data, storage) {
    this.data = data;
    this.storage = storage !== undefined ? storage : (typeof localStorage !== 'undefined' ? localStorage : null);
    this.party = new Party(data.characters, data.equipment);
    // Equipment ids are valid inventory items too (type "equipment"), so give/take/shops can carry them.
    const equipItems = {};
    for (const [id, eq] of Object.entries(data.equipment || {})) equipItems[id] = { type: 'equipment', ...eq };
    this.inventory = new Inventory({ ...equipItems, ...(data.items || {}) });
    this.reset();
  }

  /** Blank state (before newGame/load). */
  reset() {
    this.version = SAVE_VERSION;
    this.chapter = 1;
    this.map = null;
    this.x = 0;
    this.y = 0;
    this.facing = 'down';
    /** @type {Record<string, any>} */
    this.flags = {};
    /** @type {Record<string, any>} */
    this.vars = {};
    this.money = 0;
    this.meter = 0;
    this.playtimeMs = 0;
    this.savedAt = null;
    this.slot = null;
    this.party.fromJSON([], []);
    this.inventory.fromJSON([]);
  }

  /** Seed a fresh game from start.json + characters.json. */
  newGame() {
    this.reset();
    const s = this.data.start || {};
    this.map = s.map || null;
    this.x = s.x || 0;
    this.y = s.y || 0;
    this.facing = s.facing || 'down';
    this.money = s.money || 0;
    this.chapter = s.chapter || 1;
    for (const id of s.party || ['lucky']) this.party.add(id);
    for (const it of s.items || []) this.inventory.add(it.id, it.qty || 1);
    if (s.flags) Object.assign(this.flags, s.flags);
    if (s.vars) Object.assign(this.vars, s.vars);
    return this;
  }

  /** Record the player's position (called by Explore on every step / map change). */
  setPosition(map, x, y, facing) {
    this.map = map;
    this.x = x;
    this.y = y;
    if (facing) this.facing = facing;
  }

  /** Accumulate playtime. */
  tick(ms) { this.playtimeMs += ms; }

  // ---- dotted-path access ("flags.metPhoenix", "vars.coffeeCount", "money") ----------------

  /** @param {string} path */
  get(path) {
    const parts = String(path).split('.');
    let cur = this;
    for (const p of parts) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  /** @param {string} path @param {any} value */
  set(path, value) {
    const parts = String(path).split('.');
    const last = parts.pop();
    let cur = this;
    for (const p of parts) {
      if (cur[p] === undefined || cur[p] === null || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[last] = value;
  }

  /** @param {string} path @param {number} [by] */
  inc(path, by = 1) {
    const cur = Number(this.get(path)) || 0;
    this.set(path, cur + by);
    return cur + by;
  }

  /** Money helpers (never negative). */
  addMoney(n) { this.money = Math.max(0, this.money + n); return this.money; }
  spendMoney(n) {
    if (this.money < n) return false;
    this.money -= n;
    return true;
  }

  // ---- save / load -----------------------------------------------------------------------------

  /** Plain save object (ARCHITECTURE §6). */
  toJSON() {
    return {
      version: SAVE_VERSION,
      chapter: this.chapter,
      map: this.map, x: this.x, y: this.y, facing: this.facing,
      flags: { ...this.flags },
      vars: { ...this.vars },
      money: this.money,
      party: this.party.toJSON(),
      roster: [...this.party.roster],
      inventory: this.inventory.toJSON(),
      meter: this.meter,
      playtimeMs: Math.round(this.playtimeMs),
      savedAt: this.savedAt,
    };
  }

  /** Restore from a save object. */
  fromJSON(obj) {
    if (!obj || obj.version !== SAVE_VERSION) throw new Error('GameState.fromJSON: bad or missing save');
    this.reset();
    this.chapter = obj.chapter || 1;
    this.map = obj.map; this.x = obj.x; this.y = obj.y; this.facing = obj.facing || 'down';
    this.flags = { ...(obj.flags || {}) };
    this.vars = { ...(obj.vars || {}) };
    this.money = obj.money || 0;
    this.party.fromJSON(obj.party, obj.roster);
    this.inventory.fromJSON(obj.inventory);
    this.meter = obj.meter || 0;
    this.playtimeMs = obj.playtimeMs || 0;
    this.savedAt = obj.savedAt || null;
    return this;
  }

  static key(slot) { return `${SAVE_PREFIX}${slot}`; }

  /** @param {number} slot 1..3 */
  hasSave(slot = 1) {
    if (!this.storage) return false;
    try { return this.storage.getItem(GameState.key(slot)) !== null; } catch { return false; }
  }

  /** Persist to localStorage. Returns the saved object. */
  save(slot = 1) {
    if (slot < 1 || slot > SAVE_SLOTS) throw new Error(`GameState.save: bad slot ${slot}`);
    this.savedAt = new Date().toISOString();
    this.slot = slot;
    const obj = this.toJSON();
    if (this.storage) this.storage.setItem(GameState.key(slot), JSON.stringify(obj));
    return obj;
  }

  /** Load from localStorage. Returns true on success. */
  load(slot = 1) {
    if (!this.storage) return false;
    const raw = this.storage.getItem(GameState.key(slot));
    if (!raw) return false;
    this.fromJSON(JSON.parse(raw));
    this.slot = slot;
    return true;
  }

  /** Summary of a slot without loading it (for Continue menus). */
  peekSave(slot = 1) {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(GameState.key(slot));
      if (!raw) return null;
      const o = JSON.parse(raw);
      return { slot, map: o.map, chapter: o.chapter, playtimeMs: o.playtimeMs, savedAt: o.savedAt, party: (o.party || []).map((m) => m.id) };
    } catch { return null; }
  }

  deleteSave(slot = 1) { if (this.storage) this.storage.removeItem(GameState.key(slot)); }

  /** Debug/test view (ARCHITECTURE §9 `snapshot()`). */
  snapshot() {
    return {
      map: this.map, x: this.x, y: this.y, facing: this.facing,
      chapter: this.chapter,
      flags: { ...this.flags },
      vars: { ...this.vars },
      party: this.party.toJSON(),
      inventory: this.inventory.toJSON(),
      money: this.money,
      playtimeMs: Math.round(this.playtimeMs),
    };
  }
}
