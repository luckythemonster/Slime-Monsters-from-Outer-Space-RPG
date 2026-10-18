// Bridge between GameState (Party / Inventory) and the pure BattleModel. Pure module (no Phaser):
//   const model = buildBattle({ state, data, encounterId, rng });   // party snapshots → combatants
//   … drive the model …
//   const summary = applyResults(state, model);                     // HP/AMP/KO, items, rewards, XP, level-ups, meter carryover
// `data` is the battle data bundle (see data.js in the browser; tests assemble it from the JSON files):
//   { characters, xpTable, riffs, items, equipment, enemies, encounters, shops }.
import { BattleModel } from './BattleModel.js';
import { makeRng } from './rng.js';
import { meterCarryover } from './formulas.js';
import { BATTLE_SCRIPTS } from './BattleScripts.js';

export const STAT_KEYS = ['hp', 'amp', 'atk', 'def', 'spd', 'lck'];

/** Base stats of a character at a level: `growth` per stat is a number (per level) or a per-level array. */
export function levelStats(def, level = 1) {
  const out = {};
  for (const k of STAT_KEYS) {
    const base = (def.stats && def.stats[k]) || 0;
    const g = def.growth ? def.growth[k] : 0;
    if (Array.isArray(g)) out[k] = g[Math.min(level - 1, g.length - 1)] ?? base;
    else out[k] = base + Math.round((g || 0) * (level - 1));
  }
  return out;
}

/** Equipment bonuses and flags for an equip map { instrument, accessory }. */
export function equipBonus(equipment, equip = {}) {
  const out = { bonus: {}, immune: [], hit100: false, noCrit: false, freq: null, onHit: null, toonPerAction: 0, selfOutOfTune: 0 };
  for (const k of STAT_KEYS) out.bonus[k] = 0;
  for (const slot of ['instrument', 'accessory']) {
    const eq = equip && equip[slot] ? equipment[equip[slot]] : null;
    if (!eq) continue;
    for (const k of STAT_KEYS) out.bonus[k] += (eq.bonus && eq.bonus[k]) || 0;
    for (const s of eq.immune || []) if (!out.immune.includes(s)) out.immune.push(s);
    if (eq.hit100) out.hit100 = true;
    if (eq.noCrit) out.noCrit = true;
    if (slot === 'instrument' && eq.freq) out.freq = eq.freq;
    if (eq.onHit) out.onHit = eq.onHit;
    if (eq.toonPerAction) out.toonPerAction += eq.toonPerAction;
    if (eq.selfOutOfTune) out.selfOutOfTune = Math.max(out.selfOutOfTune, eq.selfOutOfTune);
  }
  return out;
}

/**
 * Build a party combatant seed from a character id and a (possibly partial) member record.
 * @param {object} data battle data bundle
 * @param {string} id character id
 * @param {{level?: number, xp?: number, hp?: number, amp?: number, equip?: object, status?: string[]}} [member]
 * @param {{form?: string, guest?: boolean}} [opts]
 */
export function partySeed(data, id, member = {}, opts = {}) {
  const def = data.characters[id];
  if (!def) throw new Error(`partySeed: unknown character "${id}"`);
  const level = member.level || def.startLevel || 1;
  const base = levelStats(def, level);
  const equip = { instrument: null, accessory: null, ...(def.equip || {}), ...(member.equip || {}) };
  const eb = equipBonus(data.equipment || {}, equip);
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = base[k] + eb.bonus[k];
  const form = opts.form || def.form || null;
  return {
    id, uid: id, name: def.name || id, level, xp: member.xp ?? ((data.xpTable || [0])[level - 1] || 0),
    maxHp: stats.hp, maxAmp: stats.amp, hp: member.hp ?? stats.hp, amp: member.amp ?? stats.amp,
    atk: stats.atk, def: stats.def, spd: stats.spd, lck: stats.lck,
    equip, immune: eb.immune, hit100: eb.hit100, noCrit: eb.noCrit, onHit: eb.onHit,
    toonPerAction: eb.toonPerAction, selfOutOfTune: eb.selfOutOfTune,
    freq: eb.freq || def.freq || 'PHYS', riffs: [...(def.riffs || [])], syncs: [...(def.syncs || [])],
    traits: { ...(def.traits || {}) }, auto: !!def.auto, minHp: def.minHp || 0, controllable: !def.auto,
    fixedLevel: !!def.fixedLevel, form, forms: def.forms || null,
    sprite: def.battleSprite || `${id}_battle`, mapSprite: def.sprite || id, size: 32, portrait: def.portrait || id,
    moodSheets: def.moodSheets || null, altSheets: def.altSheets || null,
    status: (member.status || []).filter((s) => s !== 'KO'), guest: !!opts.guest,
  };
}

/**
 * Build a BattleModel from the live GameState.
 * @param {object} o
 * @param {import('../GameState.js').GameState} o.state
 * @param {object} o.data battle data bundle
 * @param {string} o.encounterId
 * @param {object} [o.encounter] defaults to data.encounters[encounterId]
 * @param {import('./rng.js').Rng} [o.rng]
 * @param {object} [o.scripts] script factories (default BATTLE_SCRIPTS)
 * @param {boolean} [o.ambush] enemy touched the player from behind
 * @param {number} [o.meter] starting meter override
 */
export function buildBattle({ state, data, encounterId, encounter = null, rng = makeRng(), scripts = BATTLE_SCRIPTS, ambush = false, meter = undefined }) {
  const enc = { ...(encounter || (data.encounters || {})[encounterId] || { name: encounterId, enemies: [] }) };
  if (ambush) enc.ambush = true;
  const forms = enc.forms || {};
  const party = state.party.members.map((m) => partySeed(data, m.id, m, { form: forms[m.id] }));
  for (const g of enc.guests || []) if (!party.some((p) => p.id === g)) party.push(partySeed(data, g, {}, { form: forms[g], guest: true }));
  const inventory = state.inventory.list().filter((e) => (e.def.type || 'consumable') === 'consumable').map((e) => ({ id: e.id, qty: e.qty }));
  const script = enc.script && scripts[enc.script] ? scripts[enc.script]() : null;
  const startMeter = meter !== undefined ? meter : (enc.toonStart !== undefined && enc.toonStart !== null ? enc.toonStart : (state.meter || 0));
  const bundle = { ...data, makeSeed: (id, member = {}, opts = {}) => partySeed(data, id, member, opts) };
  return new BattleModel({ encounter: enc, encounterId, party, data: bundle, inventory, rng, meter: startMeter, flags: state.flags, script, money: state.money });
}

/**
 * Write the battle outcome back into GameState: HP/AMP/KO per member, joined members, items used,
 * money spent, rewards (money, drops, XP → level-ups restore HP/AMP), meter carryover.
 * @returns {{result: string, xp: number, money: number, drops: string[], levelups: object[], itemsUsed: string[]}}
 */
export function applyResults(state, model) {
  const result = model.result || 'flee';
  const party = state.party;
  for (const c of model.party()) {
    if (c.guest) continue;
    let m = party.get(c.id);
    if (!m && c.joined) {
      m = party.add(c.id, { level: c.level });
      if (!state.flags[`${c.id}Joined`]) state.set(`flags.${c.id}Joined`, true);
    }
    if (!m) continue;
    m.hp = c.ko ? 0 : Math.max(1, c.hp);
    m.amp = c.amp;
    m.status = c.ko ? ['KO'] : [];
  }
  for (const id of model.itemsUsed) state.inventory.remove(id, 1);
  if (model.moneySpent) state.spendMoney(model.moneySpent);
  const summary = { result, xp: 0, money: 0, drops: [], levelups: [], itemsUsed: [...model.itemsUsed] };
  if (result === 'win' && model.rewards) {
    const r = model.rewards;
    summary.xp = r.xp; summary.money = r.money;
    state.addMoney(r.money);
    for (const item of r.drops) {
      try { state.inventory.add(item, 1); summary.drops.push(item); } catch { /* unknown item id in data: skip */ }
    }
    for (const m of party.members) {
      const def = party.def(m.id) || {};
      if (def.fixedLevel) continue;
      const up = party.addXp(m.id, r.xp);
      if (up) {
        const s = party.stats(m.id);
        m.hp = s.maxHp; m.amp = s.maxAmp; m.status = [];
        const ev = r.levelups.find((l) => l.who === m.id);
        summary.levelups.push({ who: m.id, from: up.from, to: up.to, riffs: ev ? ev.riffs : [] });
      }
    }
    state.meter = meterCarryover(model.meter);
  } else if (result === 'flee') {
    state.meter = meterCarryover(model.meter);
  } else {
    state.meter = 0;
  }
  return summary;
}
