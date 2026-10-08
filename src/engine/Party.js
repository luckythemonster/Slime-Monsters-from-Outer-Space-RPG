// Party roster: character instances, derived stats, XP/level-ups, equipment bonuses.
// Pure module (no Phaser) so tests/data.test.mjs can exercise it in Node.
//
// characters.json shape:
//   { "xpTable": [0, 10, 25, ...],            // total XP needed to BE at level (index+1)
//     "characters": { "lucky": { "name", "sprite", "portrait", "battleSprite",
//                                "stats": { hp, amp, atk, def, spd },      // level-1 base
//                                "growth": { hp: 6, amp: 2, ... },         // per level (number) or per-level array
//                                "equip": { instrument: "beatup_guitar", accessory: null },
//                                "riffs": [...], "onJoin": "scriptId" } } }
// equipment.json shape: { "beatup_guitar": { "name", "slot", "bonus": { atk: 3 }, "price" } }

export const STAT_KEYS = ['hp', 'amp', 'atk', 'def', 'spd'];
export const EQUIP_SLOTS = ['instrument', 'accessory'];

/** @typedef {{id: string, level: number, xp: number, hp: number, amp: number, equip: Record<string, string|null>, status: string[]}} Member */

export class Party {
  /**
   * @param {object} characters characters.json contents
   * @param {object} equipment equipment.json contents
   */
  constructor(characters, equipment = {}) {
    this.defs = characters.characters || {};
    this.xpTable = characters.xpTable || [0];
    this.equipment = equipment;
    /** @type {Member[]} */
    this.members = [];
    /** Everyone who has ever joined (for menus/story). @type {string[]} */
    this.roster = [];
  }

  get size() { return this.members.length; }

  /** @param {string} id */
  has(id) { return this.members.some((m) => m.id === id); }

  /** @param {string} id @returns {Member|undefined} */
  get(id) { return this.members.find((m) => m.id === id); }

  /** Character definition (name, sprite, portrait…). */
  def(id) { return this.defs[id]; }

  /** Current level of a member (0 if not in the party). */
  level(id) { const m = this.get(id); return m ? m.level : 0; }

  /**
   * Add a character at full HP/AMP. Returns the member (existing one if already present).
   * @param {string} id
   * @param {{level?: number}} [opts]
   */
  add(id, opts = {}) {
    const existing = this.get(id);
    if (existing) return existing;
    const def = this.defs[id];
    if (!def) throw new Error(`Party.add: unknown character "${id}"`);
    const level = opts.level || def.startLevel || 1;
    const member = {
      id,
      level,
      xp: this.xpTable[level - 1] || 0,
      hp: 0,
      amp: 0,
      equip: { instrument: null, accessory: null, ...(def.equip || {}) },
      status: [],
    };
    this.members.push(member);
    if (!this.roster.includes(id)) this.roster.push(id);
    const stats = this.stats(id);
    member.hp = stats.hp;
    member.amp = stats.amp;
    return member;
  }

  /** @param {string} id @returns {boolean} */
  remove(id) {
    const i = this.members.findIndex((m) => m.id === id);
    if (i < 0) return false;
    this.members.splice(i, 1);
    return true;
  }

  /** Base stats at a given level (before equipment). */
  baseStats(id, level) {
    const def = this.defs[id];
    const out = {};
    for (const k of STAT_KEYS) {
      const base = (def.stats && def.stats[k]) || 0;
      const g = def.growth ? def.growth[k] : 0;
      if (Array.isArray(g)) out[k] = g[Math.min(level - 1, g.length - 1)] ?? base;
      else out[k] = base + Math.round((g || 0) * (level - 1));
    }
    return out;
  }

  /** Sum of equipment bonuses for a member. */
  equipBonus(member) {
    const bonus = {};
    for (const k of STAT_KEYS) bonus[k] = 0;
    for (const slot of EQUIP_SLOTS) {
      const eq = member.equip && member.equip[slot] ? this.equipment[member.equip[slot]] : null;
      if (!eq || !eq.bonus) continue;
      for (const k of STAT_KEYS) bonus[k] += eq.bonus[k] || 0;
    }
    return bonus;
  }

  /** Full derived stats (maxHp, maxAmp, atk, def, spd) including equipment. */
  stats(id) {
    const member = this.get(id);
    const level = member ? member.level : 1;
    const base = this.baseStats(id, level);
    const bonus = member ? this.equipBonus(member) : {};
    const out = {};
    for (const k of STAT_KEYS) out[k] = base[k] + (bonus[k] || 0);
    out.maxHp = out.hp;
    out.maxAmp = out.amp;
    return out;
  }

  /** Level for a total XP amount according to the xpTable. */
  levelForXp(xp) {
    let level = 1;
    for (let i = 1; i < this.xpTable.length; i++) {
      if (xp >= this.xpTable[i]) level = i + 1;
    }
    return level;
  }

  /** XP still needed for the next level (0 at max level). */
  xpToNext(id) {
    const m = this.get(id);
    if (!m || m.level >= this.xpTable.length) return 0;
    return Math.max(0, this.xpTable[m.level] - m.xp);
  }

  /**
   * Grant XP; applies level-ups (HP/AMP rise by the stat gain).
   * @returns {{id: string, from: number, to: number, gains: object}|null} level-up info or null
   */
  addXp(id, amount) {
    const m = this.get(id);
    if (!m) return null;
    const before = this.stats(id);
    m.xp += amount;
    const newLevel = this.levelForXp(m.xp);
    if (newLevel <= m.level) return null;
    const from = m.level;
    m.level = newLevel;
    const after = this.stats(id);
    const gains = {};
    for (const k of STAT_KEYS) gains[k] = after[k] - before[k];
    m.hp = Math.min(after.maxHp, m.hp + gains.hp);
    m.amp = Math.min(after.maxAmp, m.amp + gains.amp);
    return { id, from, to: newLevel, gains };
  }

  /** Grant XP to every living member. Returns the list of level-ups. */
  addXpAll(amount) {
    const ups = [];
    for (const m of this.members) {
      const up = this.addXp(m.id, amount);
      if (up) ups.push(up);
    }
    return ups;
  }

  /** Restore HP/AMP and clear status on everyone. */
  healAll() {
    for (const m of this.members) {
      const s = this.stats(m.id);
      m.hp = s.maxHp;
      m.amp = s.maxAmp;
      m.status = [];
    }
  }

  /** Heal one member by amounts (clamped). Returns actual deltas. */
  heal(id, { hp = 0, amp = 0 } = {}) {
    const m = this.get(id);
    if (!m) return { hp: 0, amp: 0 };
    const s = this.stats(id);
    const dh = Math.min(hp, s.maxHp - m.hp);
    const da = Math.min(amp, s.maxAmp - m.amp);
    m.hp += dh;
    m.amp += da;
    return { hp: dh, amp: da };
  }

  /** Equip an item id into its slot (returns the previously equipped id or null). */
  equip(id, itemId) {
    const m = this.get(id);
    const eq = this.equipment[itemId];
    if (!m || !eq) throw new Error(`Party.equip: bad member/equipment ${id}/${itemId}`);
    const prev = m.equip[eq.slot] || null;
    m.equip[eq.slot] = itemId;
    return prev;
  }

  /** Save-shape array (ARCHITECTURE §6). */
  toJSON() {
    return this.members.map((m) => ({
      id: m.id, level: m.level, xp: m.xp, hp: m.hp, amp: m.amp,
      equip: { ...m.equip }, status: [...m.status],
    }));
  }

  /** Restore from save data. */
  fromJSON(members, roster) {
    this.members = (members || []).map((m) => ({
      id: m.id, level: m.level || 1, xp: m.xp || 0, hp: m.hp ?? 1, amp: m.amp ?? 0,
      equip: { instrument: null, accessory: null, ...(m.equip || {}) }, status: [...(m.status || [])],
    }));
    this.roster = roster ? [...roster] : this.members.map((m) => m.id);
  }
}
