// BattleModel: PURE battle rules (docs/ARCHITECTURE.md §8 + design_systems.md "Battle system").
// No Phaser. The scene drives it:
//
//   const model = new BattleModel({ encounter, party, enemies, data, rng, meter, flags, script, inventory });
//   model.start();
//   while (!model.result) {
//     const turn = model.advance();                 // null when the battle ended
//     if (!turn) break;
//     const action = turn.needsInput ? await askPlayer(turn.actor) : model.decide(turn.actor);
//     model.act(turn.actor.uid, action);
//     animate(model.drain());                        // presentation events (see EVENT_TYPES)
//   }
//
// Combatants (party seeds come from setup.js `partySeeds`, enemies from enemies.json + per-encounter
// overrides) are plain objects: { uid, id, side, slot, name, hp, maxHp, amp, maxAmp, atk, def, spd, lck,
// status: [{id, turns}], ko, fled, offPanel, acted, tuning, auto, minHp, controllable, riffs, syncs, … }.
import { makeRng } from './rng.js';
import * as F from './formulas.js';
import { STATUS, applyStatus, removeStatus, clearStatuses, hasStatus, tickRound, statusMods, buffs, statusId } from './statuses.js';
import * as AI from './BattleAI.js';

export const EVENT_TYPES = [
  'start', 'round', 'setlist', 'turn', 'text', 'say', 'caption', 'toast', 'anim', 'damage', 'heal', 'amp', 'meter', 'toon',
  'transform', 'status', 'ko', 'join', 'leave', 'spawn', 'scan', 'word', 'background', 'uiTear', 'lockInput',
  'music', 'sfx', 'shake', 'flash', 'wait', 'win', 'lose', 'flee', 'reward', 'levelup', 'mood', 'skip',
];

export const COMMANDS = ['strum', 'riff', 'noise', 'item', 'tune', 'bail'];
export const ROSTER_ORDER = ['lucky', 'phoenix', 'brian', 'ryan'];
const NOISE_WORDS = ['pop', 'kraaang', 'krathoom', 'doom', 'crack', 'thud'];

export class BattleModel {
  /**
   * @param {object} o
   * @param {object} [o.encounter] encounters.json entry (enemies, script, noFlee, toonStart, fixedXp, fixedMoney)
   * @param {string} [o.encounterId]
   * @param {object[]} o.party party combatant seeds (setup.js `partySeeds`)
   * @param {(string|{id: string})[]} [o.enemies] enemy ids with optional overrides (defaults to encounter.enemies)
   * @param {{riffs: object, items: object, equipment: object, enemies: object, characters?: object, xpTable?: number[]}} o.data
   * @param {{id: string, qty: number}[]} [o.inventory] consumable snapshot (mutated; see `itemsUsed`)
   * @param {import('./rng.js').Rng} [o.rng]
   * @param {number} [o.meter] starting Toon meter (carryover or encounter.toonStart)
   * @param {object} [o.flags] GameState.flags (scripts read/write it)
   * @param {object} [o.script] hooks { onStart, onRound, onTurnStart, onAction, onToon, onHpBelow, onDefeat, hpBelow: [{who, pct}] }
   * @param {number} [o.money]
   */
  constructor({ encounter = {}, encounterId = null, party = [], enemies = null, data = {}, inventory = [], rng = makeRng(), meter = null, flags = {}, script = null, money = 0 } = {}) {
    this.encounter = encounter;
    this.encounterId = encounterId || encounter.id || null;
    this.data = data;
    this.rng = rng;
    this.flags = flags;
    this.script = script || {};
    this.money = money;
    this.moneySpent = 0;
    this.events = [];
    this.warnings = [];
    this.log = [];
    this.round = 0;
    this.order = [];
    this.turnIndex = -1;
    this.current = null;
    this.result = null;
    this.rewards = null;
    this.inputLocked = false;
    this.invincible = false;
    this.noFlee = !!encounter.noFlee || encounter.canFlee === false;
    this.bailReason = encounter.bailReason || 'the dog has the contract';
    this.noLose = !!encounter.noLose;
    this.wipeFired = false;
    this.ambush = !!encounter.ambush;
    /** Script-imposed command whitelist (tutorial round 1); null = everything. @type {string[]|null} */
    this.allowedCommands = null;
    this.hpBelowFired = new Set();
    this.toonFired = 0;
    this.itemsUsed = [];
    this.inventory = (inventory || []).map((e) => ({ id: e.id, qty: e.qty }));
    this.buzzkillIndex = 0;
    this.meter = Math.max(0, Math.min(F.METER_MAX, meter == null ? (encounter.toonStart || 0) : meter));
    this.meterCap = F.METER_PLAYER_CAP;

    /** @type {object[]} */
    this.combatants = [];
    party.forEach((seed, i) => this.combatants.push(this.makePartyCombatant(seed, i)));
    // Enemy entries are ids; `encounter.overrides[i]` (parallel array) and `encounter.scan` tweak them.
    const list = enemies || encounter.enemies || [];
    list.forEach((e, i) => this.combatants.push(this.makeEnemyCombatant(e, i, { scan: encounter.scan, ...((encounter.overrides || [])[i] || {}) })));
  }

  // ---- construction -------------------------------------------------------------------------

  makePartyCombatant(seed, slot) {
    const status = (seed.status || []).map((s) => (typeof s === 'string' ? { id: statusId(s) || s, turns: (STATUS[statusId(s)] || {}).turns || 3 } : { ...s })).filter((s) => STATUS[s.id]);
    const c = {
      uid: seed.uid || seed.id, id: seed.id, side: 'party', slot,
      name: seed.name || seed.id, level: seed.level || 1, xp: seed.xp || 0,
      hp: seed.hp ?? seed.maxHp, maxHp: seed.maxHp, amp: seed.amp ?? seed.maxAmp, maxAmp: seed.maxAmp,
      atk: seed.atk, def: seed.def, spd: seed.spd, lck: seed.lck || 0,
      equip: { ...(seed.equip || {}) }, freq: seed.freq || 'PHYS', immune: [...(seed.immune || [])],
      riffs: [...(seed.riffs || [])], syncs: [...(seed.syncs || [])], traits: { ...(seed.traits || {}) },
      auto: !!seed.auto, minHp: seed.minHp || 0, controllable: seed.controllable ?? !seed.auto, fixedLevel: !!seed.fixedLevel,
      form: seed.form || null, forms: seed.forms || null, sprite: seed.sprite || null, size: seed.size || 32,
      moodSheets: seed.moodSheets || null, altSheets: seed.altSheets || null, portrait: seed.portrait || null,
      status, ko: (seed.hp ?? 1) <= 0 || status.some((s) => s.id === 'KO'), fled: false, offPanel: false,
      acted: false, tuning: false, usedRows: new Set(), hit100: !!seed.hit100, noCrit: !!seed.noCrit,
      onHit: seed.onHit || null, toonPerAction: seed.toonPerAction || 0, selfOutOfTune: seed.selfOutOfTune || 0,
      present: true, guest: !!seed.guest,
    };
    if (c.ko) { c.hp = 0; c.status = c.status.filter((s) => s.id !== 'KO'); }
    if (c.form && c.forms && c.forms[c.form]) { c.sprite = c.forms[c.form].sheet || c.sprite; c.size = c.forms[c.form].size || c.size; }
    return c;
  }

  makeEnemyCombatant(entry, slot, extra = {}) {
    const id = typeof entry === 'string' ? entry : entry.id;
    const over = { ...extra, ...(typeof entry === 'string' ? {} : entry) };
    const def = (this.data.enemies || {})[id];
    if (!def) throw new Error(`BattleModel: unknown enemy "${id}"`);
    const stats = { ...(def.stats || {}), ...(over.stats || {}) };
    const dup = this.combatants.filter((c) => c.side === 'enemy' && c.id === id).length;
    const uid = over.uid || (dup === 0 ? id : `${id}_${dup + 1}`);
    return {
      uid, id, side: 'enemy', slot, name: over.name || def.name || id, data: def,
      hp: stats.hp, maxHp: stats.hp, amp: 0, maxAmp: 0,
      atk: stats.atk || 1, def: stats.def || 0, spd: stats.spd || 1, lck: stats.lck || 0,
      xp: over.xp ?? def.xp ?? 0, money: over.money ?? def.money ?? 0, drops: over.drops || def.drops || [],
      weak: def.weak || [], resist: def.resist || [], weakMult: def.weakMult || 1.5,
      size: def.size || 32, sprite: def.battleSprite || def.sprite || id, altSheets: def.altSheets || null,
      ai: over.ai || def.ai || [], skills: def.skills || {}, scan: over.scan || def.scan || '',
      minHp: over.minHp ?? def.minHp ?? 0, immune: [...(def.immune || [])],
      status: [], ko: false, fled: false, offPanel: false, acted: false, tuning: false, usedRows: new Set(),
      auto: false, controllable: false, present: true, traits: {},
    };
  }

  // ---- queries --------------------------------------------------------------------------------

  get toonLevel() { return F.toonLevel(this.meter); }
  get ended() { return this.result !== null; }

  find(uid) { return this.combatants.find((c) => c.uid === uid || (c.side === 'party' && c.id === uid)) || null; }
  isAlive(c) { return !!c && c.present && !c.ko && !c.fled && !c.offPanel && c.hp > 0; }
  living(side) { return this.combatants.filter((c) => (!side || c.side === side) && this.isAlive(c)); }
  party() { return this.combatants.filter((c) => c.side === 'party' && c.present); }
  enemies() { return this.combatants.filter((c) => c.side === 'enemy' && c.present); }
  hasBrian() { return this.combatants.some((c) => c.side === 'party' && c.present && c.traits && c.traits.marketAlignment); }
  warn(msg) { this.warnings.push(msg); }

  /** Effective stats with status modifiers (BRISTLING, SLIMED, BAKED, DEADPAN, BASS …, TEMPO). */
  eff(c) {
    const m = statusMods(c);
    return {
      atk: Math.max(1, Math.floor(c.atk * m.atkMult)),
      def: Math.max(0, Math.floor(c.def * m.defMult) + m.defAdd),
      spd: Math.max(0, F.effSpd(c.spd + m.spdAdd, { tempoUp: hasStatus(c, 'TEMPO_UP'), tempoDown: hasStatus(c, 'TEMPO_DOWN') })),
      lck: c.lck,
    };
  }

  /** A move definition for an actor by id: enemy skills, then riffs.json (riffs / syncs / noise / auto). */
  moveFor(actor, id) {
    if (actor.skills && actor.skills[id]) return { id, kind: 'skill', ...actor.skills[id] };
    const r = (this.data.riffs || {})[id];
    return r ? { id, ...r } : null;
  }

  aiRows(actor) {
    if (actor.side === 'enemy') return actor.ai || [];
    if (actor.auto && actor.forms && actor.form && actor.forms[actor.form]) return actor.forms[actor.form].ai || [];
    return [];
  }

  /** Setlist for the HUD: [{ uid, consumed }] in this round's order. */
  getTurnOrder() {
    return this.order.map((uid) => {
      const c = this.find(uid);
      return { uid, consumed: !!(c && (c.acted || !this.isAlive(c))), done: this.order.indexOf(uid) < this.turnIndex };
    });
  }

  /** Known riffs (level-gated) for a party member. */
  knownRiffs(c) {
    const riffs = this.data.riffs || {};
    return (c.riffs || []).filter((id) => riffs[id] && riffs[id].kind === 'riff' && (riffs[id].level || 1) <= (c.level || 1));
  }

  /** Command window entries with disabled reasons. */
  commands(uid) {
    const c = this.find(uid);
    const deaf = hasStatus(c, 'DEAF');
    const items = this.usableItems();
    const list = [
      { id: 'strum', label: 'STRUM', disabled: false },
      { id: 'riff', label: 'RIFF', disabled: deaf || this.knownRiffs(c).length + this.syncMenu(uid).length === 0, reason: deaf ? 'DEAF' : 'no riffs yet' },
      { id: 'noise', label: 'NOISE', disabled: !!c.traits.noNoise || deaf || this.toonLevel < 1, reason: c.traits.noNoise || (deaf ? 'DEAF' : 'needs Toon 1') },
      { id: 'item', label: 'ITEM', disabled: items.length === 0, reason: 'no items' },
      { id: 'tune', label: 'TUNE', disabled: false },
      { id: 'bail', label: 'BAIL', disabled: this.noFlee, reason: this.bailReason },
    ];
    if (this.allowedCommands) {
      for (const e of list) if (!this.allowedCommands.includes(e.id) && !e.disabled) { e.disabled = true; e.reason = 'Not yet.'; }
    }
    return list;
  }

  /** Scripts restrict the command window (tutorial round 1); pass null to lift it. */
  allowCommands(ids) {
    this.allowedCommands = ids ? [...ids] : null;
  }

  /** RIFF submenu: single riffs. */
  riffMenu(uid) {
    const c = this.find(uid);
    const deaf = hasStatus(c, 'DEAF');
    return this.knownRiffs(c).map((id) => {
      const r = this.data.riffs[id];
      const cost = r.amp || 0;
      let reason = null;
      if (deaf) reason = 'DEAF';
      else if (c.amp < cost) reason = `needs ${cost} AMP`;
      else if (r.money && this.money - this.moneySpent < r.money) reason = `needs $${r.money}`;
      return { id, kind: 'riff', label: r.name, cost, disabled: !!reason, reason, desc: r.desc || '', target: r.target || 'enemy' };
    });
  }

  /** RIFF submenu: SYNC entries (below the divider), grayed with reasons. */
  syncMenu(uid) {
    const c = this.find(uid);
    const riffs = this.data.riffs || {};
    const out = [];
    for (const id of c.syncs || []) {
      const s = riffs[id];
      if (!s || s.kind !== 'sync' || s.aiOnly) continue;
      const partnerId = (s.sync || s.pair || []).find((p) => p !== c.id);
      const partner = this.find(partnerId);
      const pname = partner ? partner.name : (this.data.characters && this.data.characters[partnerId] ? this.data.characters[partnerId].name : partnerId);
      let reason = null;
      if (c.traits.noSync) reason = c.traits.noSync;
      else if (!partner || !partner.present) reason = `needs ${pname}`;
      else if (!this.isAlive(partner)) reason = `${pname} is down`;
      else if (partner.traits.noSync) reason = partner.traits.noSync;
      else if ((c.level || 1) < (s.level || 1) || (partner.level || 1) < (s.level || 1)) reason = `both need L${s.level}`;
      else if (hasStatus(c, 'DEAF') || hasStatus(partner, 'DEAF')) reason = 'DEAF';
      else if (partner.acted) reason = `${pname} already played`;
      else if (c.amp < (s.amp || 0) || partner.amp < (s.amp || 0)) reason = `needs ${s.amp} AMP`;
      out.push({ id, kind: 'sync', label: s.name, cost: s.amp || 0, disabled: !!reason, reason, desc: s.desc || '', partner: partnerId, target: s.target || 'allEnemies' });
    }
    return out;
  }

  /** NOISE submenu: the SFX words. */
  noiseMenu(uid) {
    const c = this.find(uid);
    const riffs = this.data.riffs || {};
    const lvl = this.toonLevel;
    return NOISE_WORDS.filter((w) => riffs[w]).map((w) => {
      const n = riffs[w];
      let reason = null;
      if (n.scripted) reason = '???';
      else if (c.traits.noNoise) reason = c.traits.noNoise;
      else if (hasStatus(c, 'DEAF')) reason = 'DEAF';
      else if (lvl < n.level) reason = `needs Toon ${n.level}`;
      return { id: w, kind: 'noise', label: n.name, cost: n.toonCost ?? n.cost ?? n.level * 25, level: n.level, disabled: !!reason, reason, desc: n.desc || '', target: n.target || 'enemy' };
    });
  }

  /** ITEM submenu: consumables in the battle inventory snapshot. */
  usableItems() {
    const items = this.data.items || {};
    return this.inventory.filter((e) => e.qty > 0 && items[e.id] && (items[e.id].type || 'consumable') === 'consumable' && items[e.id].effect)
      .map((e) => ({ id: e.id, kind: 'item', label: items[e.id].name, qty: e.qty, desc: items[e.id].desc || '', disabled: this.itemTargets(e.id).length === 0, reason: 'no one to use it on', effect: items[e.id].effect }));
  }

  itemTargets(itemId) {
    const it = (this.data.items || {})[itemId];
    if (!it || !it.effect) return [];
    if (it.effect.revive) return this.party().filter((c) => c.ko);
    if (it.effect.ampAll || it.effect.statusAll) return this.living('party');
    return this.living('party');
  }

  /** Valid targets for a chosen command/entry (uids) and the targeting mode. */
  targetsFor(uid, cmd, entryId = null) {
    const c = this.find(uid);
    if (cmd === 'strum') return { mode: 'enemy', targets: this.living('enemy').map((e) => e.uid) };
    if (cmd === 'tune' || cmd === 'bail') return { mode: 'none', targets: [] };
    if (cmd === 'item') {
      const it = (this.data.items || {})[entryId];
      const mode = it && it.effect && (it.effect.ampAll || it.effect.statusAll) ? 'party' : 'ally';
      return { mode, targets: this.itemTargets(entryId).map((t) => t.uid) };
    }
    const move = this.moveFor(c, entryId);
    if (!move) return { mode: 'none', targets: [] };
    const mode = move.target || 'enemy';
    if (mode === 'enemy') return { mode, targets: this.living('enemy').map((e) => e.uid) };
    if (mode === 'allEnemies' || mode === 'all') return { mode: 'allEnemies', targets: this.living('enemy').map((e) => e.uid) };
    if (mode === 'ally') return { mode, targets: this.living('party').map((e) => e.uid) };
    if (mode === 'party') return { mode, targets: this.living('party').map((e) => e.uid) };
    if (mode === 'self') return { mode, targets: [c.uid] };
    return { mode, targets: this.living('enemy').map((e) => e.uid) };
  }

  // ---- events --------------------------------------------------------------------------------

  emit(ev) {
    this.events.push(ev);
    return ev;
  }

  /** Take every pending presentation event. */
  drain() {
    const out = this.events;
    this.events = [];
    return out;
  }

  text(text) { return this.emit({ type: 'text', text }); }
  say(who, text, extra = {}) { return this.emit({ type: 'say', who, text, ...extra }); }
  caption(text) { return this.emit({ type: 'caption', text }); }
  toast(text) { return this.emit({ type: 'toast', text }); }

  hook(name, ...args) {
    const fn = this.script && this.script[name];
    if (typeof fn !== 'function') return;
    const r = fn(this, ...args);
    if (Array.isArray(r)) for (const ev of r) this.emit(ev);
  }

  // ---- round / turn flow -----------------------------------------------------------------------

  /** Begin the battle: onStart hook, then round 1. */
  start() {
    this.emit({ type: 'start', encounterId: this.encounterId });
    this.emit({ type: 'meter', value: this.meter, level: this.toonLevel });
    this.toonFired = this.toonLevel;
    this.hook('onStart');
    if (!this.ended) this.beginRound();
    return this;
  }

  rollOrder() {
    const roster = (c) => (c.side === 'party' ? ROSTER_ORDER.indexOf(c.id) : 100 + c.slot);
    const rolled = this.living().map((c) => ({ c, init: F.initiative(this.eff(c).spd, this.rng.int(0, 3)) }));
    rolled.sort((a, b) => (b.init - a.init) || ((a.c.side === 'party' ? 0 : 1) - (b.c.side === 'party' ? 0 : 1)) || (roster(a.c) - roster(b.c)));
    // Touched from behind: the enemy gets round 1 first (DESIGN "Exploration & interaction").
    if (this.ambush && this.round === 1) rolled.sort((a, b) => (a.c.side === 'enemy' ? 0 : 1) - (b.c.side === 'enemy' ? 0 : 1));
    return rolled.map((r) => r.c.uid);
  }

  beginRound() {
    this.round += 1;
    for (const c of this.combatants) c.acted = false;
    this.order = this.rollOrder();
    this.turnIndex = -1;
    this.current = null;
    this.emit({ type: 'round', n: this.round });
    this.emit({ type: 'setlist', order: this.getTurnOrder() });
    this.hook('onRound', this.round);
    this.checkEnd();
  }

  endRound() {
    for (const c of this.combatants) {
      if (!c.present) continue;
      for (const id of tickRound(c)) {
        this.emit({ type: 'status', target: c.uid, status: id, on: false });
        if (id === 'BRISTLING') this.updateMood(c);
      }
    }
    this.emit({ type: 'roundEnd', n: this.round });
  }

  /**
   * Advance to the next actor. Returns { actor, needsInput } or null when the battle has ended.
   * Handles round changes, KO/fled skips, DAZED, Buzzkill and the onTurnStart hook.
   */
  advance() {
    for (let guard = 0; guard < 1000; guard++) {
      if (this.ended) return null;
      this.turnIndex += 1;
      if (this.turnIndex >= this.order.length) {
        this.endRound();
        if (this.ended) return null;
        this.beginRound();
        if (this.ended) return null;
        continue;
      }
      const actor = this.find(this.order[this.turnIndex]);
      if (!actor || !this.isAlive(actor) || actor.acted) continue;
      actor.tuning = false;
      if (hasStatus(actor, 'DAZED')) {
        removeStatus(actor, 'DAZED');
        this.emit({ type: 'status', target: actor.uid, status: 'DAZED', on: false });
        this.emit({ type: 'skip', who: actor.uid, reason: 'DAZED' });
        this.text(`${actor.name} is dazed!`);
        actor.acted = true;
        continue;
      }
      if (actor.traits.buzzkill && this.round >= 2 && this.rng.chance(actor.traits.buzzkill * 100)) {
        const lines = actor.traits.buzzkillLines || ['...'];
        const line = lines[this.buzzkillIndex % lines.length];
        this.buzzkillIndex += 1;
        this.emit({ type: 'skip', who: actor.uid, reason: 'BUZZKILL' });
        this.say(actor.id, line, { portrait: 'brian_smug' });
        actor.acted = true;
        continue;
      }
      this.current = actor;
      this.emit({ type: 'turn', who: actor.uid });
      this.hook('onTurnStart', actor);
      if (this.ended) return null;
      if (actor.acted || !this.isAlive(actor)) continue; // a hook may consume the turn
      const needsInput = actor.side === 'party' && actor.controllable && !actor.auto && !this.inputLocked;
      return { actor, needsInput };
    }
    return null;
  }

  /** AI decision for enemies, AUTO allies, and locked-input party members (they STRUM). */
  decide(actor) {
    if (actor.side === 'enemy' || actor.auto) return AI.decide(this, actor, this.rng);
    const targets = this.living('enemy');
    return targets.length ? { cmd: 'strum', target: this.rng.pick(targets).uid } : { cmd: 'tune' };
  }

  // ---- actions ---------------------------------------------------------------------------------

  /**
   * Perform an action for a combatant. Action shapes:
   *   { cmd: 'strum', target }  { cmd: 'riff', riff, target? }  { cmd: 'sync', sync }  { cmd: 'noise', word, target? }
   *   { cmd: 'item', item, target? }  { cmd: 'tune' }  { cmd: 'bail' }  { cmd: 'skill', skill, target: uid[] }  { cmd: 'flee' }  { cmd: 'wait' }
   */
  act(uid, action) {
    const actor = this.find(uid);
    if (!actor || this.ended) return false;
    if (!this.isAlive(actor)) { this.warn(`act: ${uid} cannot act`); return false; }
    const a = { ...action };
    this.log.push({ round: this.round, who: uid, action: a });
    let ok = true;
    switch (a.cmd) {
      case 'strum': ok = this.doStrum(actor, a); break;
      case 'riff': ok = this.doRiff(actor, a); break;
      case 'sync': ok = this.doSync(actor, a); break;
      case 'noise': ok = this.doNoise(actor, a); break;
      case 'item': ok = this.doItem(actor, a); break;
      case 'tune': ok = this.doTune(actor); break;
      case 'bail': ok = this.doBail(actor); break;
      case 'skill': ok = this.doSkill(actor, a); break;
      case 'flee': this.leave(actor, 'flee'); break;
      case 'wait': this.text(`${actor.name} waits.`); break;
      default: this.warn(`act: unknown cmd ${a.cmd}`); ok = false;
    }
    if (!ok) return false;
    actor.acted = true;
    if (actor.side === 'party') {
      if (actor.auto) {
        const per = (actor.forms && actor.form && actor.forms[actor.form] && actor.forms[actor.form].toonPerAction) ?? actor.toonPerAction;
        if (per) this.addToon(per, 'ryan');
      }
      const sticker = (this.data.equipment || {})[actor.equip.accessory];
      if (sticker && sticker.toonPerAction) this.addToon(sticker.toonPerAction, 'sticker');
    }
    this.hook('onAction', actor, a);
    this.checkEnd();
    return true;
  }

  resolveSingle(actor, target, mode = 'enemy') {
    if (target) {
      const t = this.find(target);
      if (t && this.isAlive(t)) return [t];
    }
    return AI.resolveTargets(this, actor, mode === 'enemy' ? 'random' : mode);
  }

  doStrum(actor, a) {
    const targets = this.resolveSingle(actor, a.target, 'enemy');
    if (!targets.length) return false;
    this.emit({ type: 'anim', who: actor.uid, key: 'attack' });
    const move = { id: 'strum', name: 'STRUM', kind: 'strum', freq: actor.freq, pow: 100 };
    const res = this.applyMove(actor, move, targets, 'strum');
    if (res.hits > 0) {
      this.changeAmp(actor, 2);
      this.addToon(res.crits > 0 ? F.TOON_FILL.strumCrit : F.TOON_FILL.strumHit, 'strum');
    }
    return true;
  }

  doRiff(actor, a) {
    const r = this.moveFor(actor, a.riff);
    if (!r || r.kind !== 'riff') { this.warn(`riff: unknown ${a.riff}`); return false; }
    if (hasStatus(actor, 'DEAF')) { this.text(`${actor.name} can't hear the riff.`); return false; }
    if (actor.amp < (r.amp || 0)) { this.text('Not enough AMP.'); return false; }
    if (r.money) { if (this.money - this.moneySpent < r.money) return false; this.moneySpent += r.money; }
    this.changeAmp(actor, -(r.amp || 0));
    this.emit({ type: 'anim', who: actor.uid, key: 'riff' });
    this.text(`${actor.name}: ${r.name}!`);
    const acc = (this.data.equipment || {})[actor.equip.accessory];
    if (acc && acc.selfOutOfTune && this.rng.chance(acc.selfOutOfTune)) this.inflict(actor, 'OUT_OF_TUNE', 3, `${actor.name}'s pedalboard crackles.`);
    const targets = this.targetsForMove(actor, r, a.target);
    this.applyMove(actor, r, targets, 'riff');
    if (r.scan) this.addToon(F.TOON_FILL.scan, 'scan');
    else this.addToon(F.TOON_FILL.riff, 'riff');
    if (r.toon && !r.scan) this.addToon(r.toon, 'riff');
    return true;
  }

  doSync(actor, a) {
    const s = this.moveFor(actor, a.sync);
    if (!s || s.kind !== 'sync') { this.warn(`sync: unknown ${a.sync}`); return false; }
    const partnerId = a.partner || (s.sync || s.pair || []).find((p) => p !== actor.id);
    const partner = this.find(partnerId);
    if (!partner || !this.isAlive(partner) || partner.acted || hasStatus(partner, 'DEAF') || hasStatus(actor, 'DEAF')) return false;
    if (!s.aiOnly && (actor.amp < (s.amp || 0) || partner.amp < (s.amp || 0))) return false;
    if (s.minToon && this.meter < s.minToon) return false;
    this.changeAmp(actor, -(s.amp || 0));
    this.changeAmp(partner, -(s.amp || 0));
    partner.acted = true;
    this.emit({ type: 'anim', who: actor.uid, key: 'riff' });
    this.emit({ type: 'anim', who: partner.uid, key: 'riff' });
    this.emit({ type: 'sync', who: actor.uid, partner: partner.uid, sync: s.id });
    this.text(`${actor.name} + ${partner.name}: ${s.name}!`);
    const targets = s.target === 'party' ? [actor, partner] : this.targetsForMove(actor, s, null);
    this.applyMove(actor, s, targets, 'sync');
    this.addToon(F.TOON_FILL.sync + (s.toon || 0), 'sync');
    return true;
  }

  doNoise(actor, a) {
    const n = this.moveFor(actor, a.word);
    if (!n || n.kind !== 'noise') { this.warn(`noise: unknown ${a.word}`); return false; }
    if (n.scripted && !a.scripted) return false;
    if (actor.traits.noNoise || hasStatus(actor, 'DEAF')) return false;
    if (!a.scripted && this.toonLevel < n.level) return false;
    if (!a.scripted) this.setMeter(this.meter - (n.toonCost ?? n.cost ?? n.level * 25), { source: 'noise' });
    this.emit({ type: 'anim', who: actor.uid, key: 'riff' });
    this.emit({ type: 'word', word: n.word || n.id, who: actor.uid, level: n.level });
    this.text(`${actor.name}: ${n.name}!`);
    const targets = this.targetsForMove(actor, n, a.target);
    this.applyMove(actor, n, targets, 'noise');
    if (n.uiTear) this.emit({ type: 'uiTear', level: n.uiTear });
    return true;
  }

  doItem(actor, a) {
    const it = (this.data.items || {})[a.item];
    const entry = this.inventory.find((e) => e.id === a.item);
    if (!it || !it.effect || !entry || entry.qty <= 0) { this.warn(`item: cannot use ${a.item}`); return false; }
    const eff = it.effect;
    let targets;
    if (eff.ampAll || eff.statusAll) targets = this.living('party');
    else if (eff.revive) targets = this.resolveItemTarget(a.target, this.party().filter((c) => c.ko));
    else targets = this.resolveItemTarget(a.target, this.living('party'));
    if (!targets.length) return false;
    entry.qty -= 1;
    this.itemsUsed.push(a.item);
    this.emit({ type: 'sfx', name: 'item' });
    this.text(`${actor.name} uses ${it.name}.`);
    for (const t of targets) {
      if (eff.revive && t.ko) {
        t.ko = false;
        t.hp = Math.max(1, Math.floor((t.maxHp * eff.revive) / 100));
        this.emit({ type: 'status', target: t.uid, status: 'KO', on: false });
        this.emit({ type: 'heal', target: t.uid, amount: t.hp, revive: true });
        this.updateMood(t);
      }
      if (eff.hp) this.healHp(t, eff.hp);
      if (eff.amp) this.changeAmp(t, eff.amp);
      if (eff.ampAll) this.changeAmp(t, eff.ampAll === 'max' ? t.maxAmp : eff.ampAll);
      for (const id of eff.cure || []) if (removeStatus(t, id)) this.emit({ type: 'status', target: t.uid, status: id, on: false });
      if (eff.statusAll) this.inflict(t, eff.statusAll.id, eff.statusAll.turns);
      if (eff.status) this.inflict(t, eff.status.id, eff.status.turns);
    }
    return true;
  }

  resolveItemTarget(target, pool) {
    if (target) { const t = this.find(target); if (t && pool.includes(t)) return [t]; }
    return pool.length ? [pool[0]] : [];
  }

  doTune(actor) {
    actor.tuning = true;
    this.changeAmp(actor, 4);
    if (removeStatus(actor, 'OUT_OF_TUNE')) this.emit({ type: 'status', target: actor.uid, status: 'OUT_OF_TUNE', on: false });
    this.emit({ type: 'anim', who: actor.uid, key: 'tune' });
    this.text(`${actor.name} tunes up.`);
    return true;
  }

  doBail(actor) {
    if (this.noFlee) { this.text(this.bailReason); return false; }
    const party = this.living('party');
    const avg = Math.floor(party.reduce((s, c) => s + this.eff(c).spd, 0) / Math.max(1, party.length));
    const maxE = Math.max(0, ...this.living('enemy').map((c) => this.eff(c).spd));
    const pct = F.fleeChance(avg, maxE);
    if (this.rng.chance(pct)) {
      this.emit({ type: 'sfx', name: 'flee' });
      this.text('The band bails!');
      this.finish('flee');
    } else {
      this.text("Couldn't bail!");
    }
    return true;
  }

  doSkill(actor, a) {
    const move = this.moveFor(actor, a.skill);
    if (!move) { this.warn(`skill: unknown ${a.skill}`); return false; }
    let targets = (a.target || []).map((u) => this.find(u)).filter((t) => t && this.isAlive(t));
    if (!targets.length) targets = AI.resolveTargets(this, actor, a.mode || move.target || 'random', move);
    if (!targets.length && move.target !== 'self') return false;
    this.emit({ type: 'anim', who: actor.uid, key: actor.side === 'party' ? 'riff' : 'attack' });
    if (move.text) this.text(move.text);
    else this.text(`${actor.name}: ${move.name || a.skill}!`);
    this.applyMove(actor, move, targets, 'skill');
    return true;
  }

  targetsForMove(actor, move, chosen) {
    const mode = move.target || 'enemy';
    if (mode === 'self') return [actor];
    if (mode === 'party') return this.living('party');
    if (mode === 'allEnemies' || mode === 'all') return this.living('enemy');
    if (mode === 'ally') {
      if (chosen) { const t = this.find(chosen); if (t && this.isAlive(t) && t.side === 'party') return [t]; }
      return [actor];
    }
    if (mode === 'randomAny' || mode === 'highestAtk' || mode === 'lowestHp' || mode === 'notRyan') return AI.resolveTargets(this, actor, mode, move);
    return this.resolveSingle(actor, chosen, 'enemy');
  }

  /**
   * Apply a move (strum / riff / sync / noise / enemy skill) to targets. Returns { hits, crits, kos }.
   */
  applyMove(actor, move, targets, source) {
    const res = { hits: 0, crits: 0, kos: 0 };
    const isParty = actor.side === 'party';
    const hits = move.hits || 1;
    if (move.selfStatus) this.inflict(actor, move.selfStatus.id, move.selfStatus.turns);
    if (move.otherStatus) {
      const o = this.find(move.otherStatus.who);
      if (o && this.isAlive(o)) this.inflict(o, move.otherStatus.id, move.otherStatus.turns);
    }
    if (move.meterTo !== undefined) { this.setMeter(move.meterTo, { source: 'riff' }); this.text('Toon drains out of the room.'); }
    if (move.healPct && (move.target === 'self' || source === 'riff')) this.healHp(actor, Math.floor((actor.maxHp * move.healPct) / 100));

    for (const target of targets) {
      if (!target) continue;
      // Non-damaging support effects.
      if (move.scan) {
        this.emit({ type: 'scan', target: target.uid, info: { name: target.name, hp: target.hp, maxHp: target.maxHp, weak: target.weak || [], resist: target.resist || [], text: target.scan || '' } });
        if (target.scan) this.say('phoenix', target.scan, { portrait: 'phoenix_deadpan' });
        continue;
      }
      if (source === 'sync' && move.healPct) {
        this.healHp(target, Math.floor((target.maxHp * move.healPct) / 100));
        if (move.cureAll) for (const id of clearStatuses(target)) this.emit({ type: 'status', target: target.uid, status: id, on: false });
        this.updateMood(target);
        continue;
      }
      if (move.heal) this.healHp(target, F.heal(move.heal, this.rng.int(0, 20)));
      if (move.allyStatus) this.inflict(target, move.allyStatus.id, move.allyStatus.turns);
      for (const id of move.cure || []) if (removeStatus(target, id)) this.emit({ type: 'status', target: target.uid, status: id, on: false });

      if (!move.pow) {
        if (move.status && move.status.chance !== undefined ? this.rng.chance(move.status.chance) : move.status) this.inflict(target, move.status.id, move.status.turns);
        continue;
      }
      // Ground hum: Tube Screamer hits a random ally for half instead.
      let victim = target;
      let extraMult = 1;
      if (move.groundHum && this.rng.chance(move.groundHum)) {
        const allies = this.living('party').filter((c) => c !== actor);
        if (allies.length) { victim = this.rng.pick(allies); extraMult = 0.5; this.text('Ground hum! The amp bites back.'); }
      }
      for (let h = 0; h < hits; h++) {
        if (!this.isAlive(victim)) break;
        const r = this.attack(actor, victim, move, { source, extraMult, isParty });
        if (r.hit) { res.hits++; if (r.crit) res.crits++; if (r.ko) res.kos++; }
      }
      if (move.knockOff && this.isAlive(victim) && victim.side === 'enemy' && victim.size <= move.knockOff.size && this.rng.chance(move.knockOff.chance)) {
        this.leave(victim, 'offPanel');
      }
      if (move.removeBuff && this.isAlive(victim)) {
        const b = buffs(victim);
        if (b.length) { removeStatus(victim, b[0]); this.emit({ type: 'status', target: victim.uid, status: b[0], on: false }); }
      }
    }
    return res;
  }

  /** One hit roll + damage + on-hit status. Returns { hit, crit, dmg, ko }. */
  attack(actor, target, move, { source = 'strum', extraMult = 1, isParty = actor.side === 'party' } = {}) {
    const ea = this.eff(actor);
    const et = this.eff(target);
    const acc = (this.data.equipment || {})[actor.equip && actor.equip.accessory] || {};
    const alwaysHit = !!move.alwaysHit || !!acc.hit100 || !!actor.hit100;
    const noCrit = !!move.noCrit || !!acc.noCrit || !!actor.noCrit;
    const hitPct = F.hitChance({ attSpd: ea.spd, tgtSpd: et.spd, accMod: move.acc || 0, outOfTune: hasStatus(actor, 'OUT_OF_TUNE'), alwaysHit });
    if (!this.rng.chance(hitPct)) {
      this.emit({ type: 'damage', target: target.uid, amount: 0, miss: true, crit: false, source });
      this.emit({ type: 'sfx', name: 'miss' });
      return { hit: false, crit: false, dmg: 0, ko: false };
    }
    const crit = this.rng.chance(F.critChance({ lck: ea.lck, toon: isParty ? this.toonLevel : 0, noCrit }));
    const freq = move.freq || actor.freq || 'PHYS';
    let fm = F.freqMult(freq, target.side === 'enemy' ? target : {});
    if (target.side === 'enemy' && hasStatus(target, 'SLIMED') && [].concat(freq).some((f) => f === 'LOW' || f === 'HIGH')) fm *= 1.25;
    const dmg = F.damage({
      atk: ea.atk, def: et.def, pow: move.pow || 100, variance: this.rng.int(0, 20), freqMult: fm,
      toon: this.toonLevel, isParty, crit, tuning: target.tuning, ignoreDef: !!move.ignoreDef, extraMult,
    });
    const ko = this.damage(target, dmg, { crit, freq, source, by: actor.uid });
    if (crit) this.emit({ type: 'sfx', name: 'crit' });
    else this.emit({ type: 'sfx', name: 'hit' });
    // On-hit statuses.
    if (move.status && this.isAlive(target) && this.rng.chance(move.status.chance ?? 100)) this.inflict(target, move.status.id, move.status.turns);
    if (source === 'strum' && isParty) {
      if (crit && actor.traits.critSlimes && target.side === 'enemy') this.inflict(target, 'SLIMED', 4);
      const inst = (this.data.equipment || {})[actor.equip.instrument];
      if (inst && inst.onHit && target.side === 'enemy' && this.rng.chance(inst.onHit.chance)) this.inflict(target, inst.onHit.status, inst.onHit.turns);
    }
    return { hit: true, crit, dmg, ko };
  }

  // ---- state changes ---------------------------------------------------------------------------

  /** Apply damage with minHp / invincibility floors, mood swaps, KO and onHpBelow. Returns true on KO. */
  damage(target, amount, { crit = false, freq = null, source = 'skill', by = null, scripted = false } = {}) {
    if (!target || !this.isAlive(target)) return false;
    let dmg = Math.max(0, Math.floor(amount));
    const floor = target.minHp || (target.side === 'party' && this.invincible ? 1 : 0);
    if (floor > 0) dmg = Math.min(dmg, Math.max(0, target.hp - floor));
    const before = target.hp;
    target.hp = Math.max(0, target.hp - dmg);
    this.emit({ type: 'damage', target: target.uid, amount: dmg, crit, miss: false, freq, source, by, scripted });
    if (target.side === 'party' && dmg > 0 && !scripted) this.addToon(F.TOON_FILL.damaged, 'damaged');
    if (target.side === 'party') this.updateMood(target);
    // onHpBelow thresholds (fire once per threshold).
    for (const t of this.script.hpBelow || []) {
      if ((t.who === target.uid || t.who === target.id) && before * 100 > t.pct * target.maxHp && target.hp * 100 <= t.pct * target.maxHp) {
        const key = `${target.uid}:${t.pct}`;
        if (!this.hpBelowFired.has(key)) { this.hpBelowFired.add(key); this.hook('onHpBelow', target.uid, t.pct); }
      }
    }
    if (target.hp <= 0) return this.handleZero(target);
    return false;
  }

  handleZero(target) {
    if (target.side === 'enemy') {
      this.hook('onDefeat', target.uid);
      if (!target.present || target.fled || target.offPanel || target.hp > 0) return false;
      target.ko = true;
      this.emit({ type: 'ko', who: target.uid });
      this.emit({ type: 'sfx', name: 'ko' });
      this.text(`${target.name} is done.`);
      this.addToon(F.TOON_FILL.enemyKo, 'ko');
      this.checkEnd();
      return true;
    }
    target.ko = true;
    target.tuning = false;
    clearStatuses(target);
    this.emit({ type: 'ko', who: target.uid });
    this.emit({ type: 'sfx', name: 'ko' });
    this.text(`${target.name} is down!`);
    this.updateMood(target);
    this.hook('onDefeat', target.uid);
    this.checkEnd();
    return true;
  }

  healHp(target, amount) {
    if (!target || target.ko) return 0;
    const dh = Math.max(0, Math.min(amount, target.maxHp - target.hp));
    target.hp += dh;
    this.emit({ type: 'heal', target: target.uid, amount: dh });
    if (target.side === 'party') this.updateMood(target);
    return dh;
  }

  changeAmp(target, delta) {
    if (!target || target.maxAmp === undefined) return 0;
    const before = target.amp;
    target.amp = Math.max(0, Math.min(target.maxAmp, target.amp + delta));
    if (target.amp !== before) this.emit({ type: 'amp', who: target.uid, value: target.amp, delta: target.amp - before });
    return target.amp - before;
  }

  /** Inflict a status (immunities / cancels respected). Returns true when applied. */
  inflict(target, id, turns, line = null) {
    const sid = statusId(id);
    if (!sid || !target || (!this.isAlive(target) && sid !== 'KO')) return false;
    const ok = applyStatus(target, sid, turns);
    if (ok) {
      this.emit({ type: 'status', target: target.uid, status: sid, on: true });
      if (line) this.text(line);
      if (sid === 'BRISTLING') this.updateMood(target);
    }
    return ok;
  }

  /** Lucky's palette as HUD: 'rage' while BRISTLING, 'deflated' below 25%, 'bruised' at KO. */
  updateMood(c) {
    if (!c || !c.moodSheets) return;
    let mood = 'calm';
    if (c.ko) mood = 'bruised';
    else if (hasStatus(c, 'BRISTLING') || this.flags.luckyRage) mood = 'rage';
    else if (c.hp * 4 < c.maxHp) mood = 'deflated';
    if (c.mood !== mood) {
      c.mood = mood;
      this.emit({ type: 'mood', who: c.uid, mood, sheet: mood === 'calm' ? c.sprite : (c.moodSheets[mood] || c.sprite) });
    }
  }

  /** Add Toon points (party-only fills). Brian halves; player cap 99. */
  addToon(points, source = '') {
    if (points <= 0 || this.meter >= this.meterCap) return 0;
    const gain = F.toonGain(points, { halved: this.hasBrian() });
    if (gain <= 0) return 0;
    this.setMeter(this.meter + gain, { source });
    return gain;
  }

  /** Set the meter; `force` lets scripts reach 100. Fires onToon for every new level reached. */
  setMeter(value, { force = false, source = '' } = {}) {
    // Players never rise past 99; a scripted 100 is kept (never pulled back down by the cap).
    const cap = force ? F.METER_MAX : Math.max(this.meterCap, Math.min(this.meter, F.METER_MAX));
    const before = this.meter;
    this.meter = Math.max(0, Math.min(cap, Math.floor(value)));
    if (this.meter === before) return;
    this.emit({ type: 'meter', value: this.meter, level: this.toonLevel, delta: this.meter - before, source });
    const lvl = this.toonLevel;
    if (lvl > this.toonFired) {
      for (let l = this.toonFired + 1; l <= lvl; l++) {
        this.emit({ type: 'toon', level: l });
        this.toonFired = l;
        this.hook('onToon', l);
      }
    } else if (lvl < this.toonFired) {
      this.toonFired = lvl;
    }
  }

  /** An enemy leaves the fight (flee / knocked off-panel). No XP, no money. */
  leave(c, how = 'flee') {
    if (!c || !c.present || c.ko || c.fled || c.offPanel) return;
    if (how === 'offPanel') c.offPanel = true; else c.fled = true;
    this.emit({ type: 'leave', who: c.uid, how });
    this.emit({ type: 'sfx', name: how === 'offPanel' ? 'kraaang' : 'flee' });
    this.text(how === 'offPanel' ? `${c.name} is knocked off-panel!` : `${c.name} flees!`);
    this.checkEnd();
  }

  /** A party member joins mid-battle (tutorial Phoenix). */
  join(seed) {
    const c = this.makePartyCombatant(seed, this.party().length);
    c.acted = true; // joins after the current action; plays next round
    c.joined = true; // setup.applyResults adds them to the real party
    this.combatants.push(c);
    this.emit({ type: 'join', who: c.uid, name: c.name, sprite: c.sprite, slot: c.slot });
    this.text(`${c.name} jumps in!`);
    return c;
  }

  /** An enemy spawns mid-battle (backup cops). */
  spawn(entry) {
    const c = this.makeEnemyCombatant(entry, this.enemies().length);
    c.acted = true;
    this.combatants.push(c);
    this.emit({ type: 'spawn', who: c.uid, name: c.name, sprite: c.sprite, size: c.size, slot: c.slot });
    return c;
  }

  /** Swap a combatant's form / sheet (Ryan's possession, Brian fried, cop mohawk). */
  transform(uid, { form = null, sheet = null, size = null } = {}) {
    const c = this.find(uid);
    if (!c) return;
    if (form) {
      c.form = form;
      const f = c.forms && c.forms[form];
      if (f) { sheet = sheet || f.sheet; size = size || f.size || c.size; }
    }
    if (sheet) c.sprite = sheet;
    if (size) c.size = size;
    this.emit({ type: 'transform', who: uid, sheet: c.sprite, form: c.form, size: c.size });
  }

  lockInput(on = true) {
    this.inputLocked = !!on;
    this.emit({ type: 'lockInput', on: this.inputLocked });
  }

  /** Presentation pause (scripts: the three Eternity words 900 ms apart). */
  wait(ms) { return this.emit({ type: 'wait', ms }); }

  /**
   * Scripted NOISE word fired on someone's behalf regardless of meter, turn or KO (the forced
   * KRAAANG, DOOM). Damage uses `who`'s stats; `pow` overrides the word's power (DOOM = 999 flat).
   */
  forceNoise(word, who, { pow = null, flat = null } = {}) {
    const actor = this.find(who) || this.party()[0];
    const n = this.moveFor(actor, word) || { id: word, kind: 'noise', name: String(word).toUpperCase(), word, target: 'allEnemies', level: 4 };
    this.emit({ type: 'anim', who: actor.uid, key: 'riff' });
    this.emit({ type: 'word', word: n.word || word, who: actor.uid, level: n.level || 4, scripted: true });
    this.text(`${n.name}!`);
    const targets = this.living('enemy');
    if (flat !== null) {
      for (const t of targets) this.damage(t, flat, { source: 'noise', by: actor.uid, scripted: true, freq: 'NOISE' });
    } else if (n.pow || pow) {
      this.applyMove(actor, { ...n, pow: pow || n.pow, scripted: true }, targets, 'noise');
    }
    if (n.uiTear) this.emit({ type: 'uiTear', level: n.uiTear });
    this.hook('onAction', actor, { cmd: 'noise', word, scripted: true });
    return n;
  }

  // ---- end of battle --------------------------------------------------------------------------

  checkEnd() {
    if (this.ended) return this.result;
    if (this.suspendEnd) return null; // a script is mid-sequence (The Eternity) and will finish itself
    if (this.living('enemy').length === 0) return this.finish('win');
    const controllable = this.party().filter((c) => c.controllable && !c.auto);
    if (controllable.length && controllable.every((c) => c.ko)) {
      if (this.noLose) {
        if (!this.wipeFired) { this.wipeFired = true; this.hook('onWipe'); }
        return this.result;
      }
      return this.finish('lose');
    }
    return null;
  }

  /** End the battle with a result; computes rewards on a win. Scripts call `model.finish('win')`. */
  finish(result) {
    if (this.ended) return this.result;
    this.result = result;
    this.current = null;
    if (result === 'win') {
      this.rewards = this.computeRewards();
      this.emit({ type: 'win' });
      this.emit({ type: 'reward', ...this.rewards });
      for (const up of this.rewards.levelups) this.emit({ type: 'levelup', ...up });
    } else {
      this.emit({ type: result });
    }
    return result;
  }

  computeRewards() {
    const enc = this.encounter || {};
    const killed = this.enemies().filter((c) => c.ko);
    const xp = enc.fixedXp ?? killed.reduce((s, c) => s + (c.xp || 0), 0);
    const money = enc.fixedMoney ?? killed.reduce((s, c) => s + (c.money || 0), 0);
    const drops = [];
    for (const c of killed) for (const d of c.drops || []) if (this.rng.chance((d.chance ?? 1) * 100)) drops.push(d.item);
    for (const d of enc.drops || []) if (this.rng.chance((d.chance ?? 1) * 100)) drops.push(d.item);
    const levelups = [];
    const table = this.data.xpTable || [0];
    const riffs = this.data.riffs || {};
    for (const c of this.party()) {
      if (c.fixedLevel) continue;
      const total = (c.xp || 0) + xp;
      let lvl = 1;
      for (let i = 1; i < table.length; i++) if (total >= table[i]) lvl = i + 1;
      if (lvl > (c.level || 1)) {
        const learned = (c.riffs || []).filter((id) => riffs[id] && (riffs[id].level || 1) > c.level && (riffs[id].level || 1) <= lvl).map((id) => riffs[id].name);
        const syncs = (c.syncs || []).filter((id) => riffs[id] && !riffs[id].aiOnly && (riffs[id].level || 1) > c.level && (riffs[id].level || 1) <= lvl).map((id) => riffs[id].name);
        levelups.push({ who: c.uid, from: c.level, to: lvl, riffs: learned.concat(syncs) });
      }
    }
    return { xp, money, drops, levelups };
  }
}
