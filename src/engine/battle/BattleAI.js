// Enemy / AUTO-ally decision making (design_systems.md "Enemy AI"). Each combatant carries an `ai`
// list of rows `{ if?, do, target?, weight?, once? }`; rows whose `if` holds (Conditions.js
// evaluator over the battle context) are chosen weighted-random with the model's seeded RNG.
// Pure module: no Phaser.
import { evaluateWith } from '../Conditions.js';
import { hasStatus } from './statuses.js';

/**
 * Identifier context for AI `if` strings: hp, hpPct, maxHp, round, allies, enemies, toon, meter,
 * every(n), partyHas('STATUS'), has('STATUS'), partner('id'), flags.*, acted.
 */
export function aiContext(model, actor) {
  const side = actor.side;
  const sameSide = model.living(side).filter((c) => c !== actor);
  const opponents = model.living(side === 'party' ? 'enemy' : 'party');
  return {
    hp: actor.hp,
    maxHp: actor.maxHp,
    hpPct: actor.maxHp > 0 ? Math.floor((actor.hp * 100) / actor.maxHp) : 0,
    round: model.round,
    allies: sameSide.length,
    enemies: opponents.length,
    toon: model.meter,
    meter: model.meter,
    toonLevel: model.toonLevel,
    acted: !!actor.acted,
    flags: model.flags || {},
    every: (n) => n > 0 && model.round % n === 0,
    partyHas: (status) => model.living('party').some((c) => hasStatus(c, normalize(status))),
    has: (status) => hasStatus(actor, normalize(status)),
    partner: (id) => {
      const p = model.find(id);
      return !!(p && p !== actor && model.isAlive(p) && !p.acted && !hasStatus(p, 'DEAF'));
    },
  };
}

function normalize(s) {
  return String(s || '').toUpperCase().replace(/[\s-]+/g, '_');
}

/** Rows whose condition holds and that have not been spent (`once`). */
export function eligibleRows(model, actor, rows) {
  const ctx = aiContext(model, actor);
  const out = [];
  rows.forEach((row, index) => {
    if (row.once && actor.usedRows && actor.usedRows.has(index)) return;
    let ok = true;
    if (row.if) {
      try { ok = !!evaluateWith(row.if, ctx); } catch (err) { ok = false; model.warn(`ai condition "${row.if}": ${err.message}`); }
    }
    if (ok) out.push({ row, index });
  });
  return out;
}

/** Weighted-random pick among eligible rows. */
export function pickRow(model, actor, rows, rng) {
  const elig = eligibleRows(model, actor, rows || []);
  if (!elig.length) return null;
  const total = elig.reduce((s, e) => s + (e.row.weight > 0 ? e.row.weight : 1), 0);
  let r = rng.float() * total;
  for (const e of elig) {
    r -= e.row.weight > 0 ? e.row.weight : 1;
    if (r < 0) return e;
  }
  return elig[elig.length - 1];
}

/**
 * Resolve a targeting mode to a list of combatants.
 * Modes: random | enemy | lowestHp | highestAtk | notRyan | self | all | allEnemies | ally | party | randomAny.
 */
export function resolveTargets(model, actor, mode, move = {}, rng = model.rng) {
  const opponents = model.living(actor.side === 'party' ? 'enemy' : 'party');
  const friends = model.living(actor.side);
  switch (mode) {
    case 'self':
      return [actor];
    case 'all':
    case 'allEnemies':
      return opponents;
    case 'party':
      return friends;
    case 'ally':
      return friends.length ? [rng.pick(friends)] : [];
    case 'lowestHp': {
      let best = null;
      for (const c of opponents) if (!best || c.hp < best.hp) best = c;
      return best ? [best] : [];
    }
    case 'highestAtk': {
      let best = null;
      for (const c of opponents) if (!best || model.eff(c).atk > model.eff(best).atk) best = c;
      return best ? [best] : [];
    }
    case 'notRyan': {
      const pool = opponents.filter((c) => !c.auto);
      const pick = rng.pick(pool.length ? pool : opponents);
      return pick ? [pick] : [];
    }
    case 'randomAny': {
      const chance = move.friendlyChance ?? 20;
      const others = friends.filter((c) => c !== actor);
      if (others.length && rng.chance(chance)) return [rng.pick(others)];
      const pick = rng.pick(opponents);
      return pick ? [pick] : [];
    }
    case 'random':
    case 'enemy':
    default: {
      const pick = rng.pick(opponents);
      return pick ? [pick] : [];
    }
  }
}

/**
 * Decide an action for an AI-driven combatant. Returns a model action:
 *   { cmd: 'skill', skill, target: uid[] , row } | { cmd: 'flee' } | { cmd: 'sync', sync, partner } | { cmd: 'wait' }
 */
export function decide(model, actor, rng = model.rng) {
  const rows = model.aiRows(actor);
  const picked = pickRow(model, actor, rows, rng);
  if (!picked) return { cmd: 'wait' };
  const { row, index } = picked;
  if (row.once) {
    if (!actor.usedRows) actor.usedRows = new Set();
    actor.usedRows.add(index);
  }
  if (row.do === 'flee') return { cmd: 'flee' };
  const move = model.moveFor(actor, row.do);
  if (!move) { model.warn(`ai: unknown move "${row.do}" for ${actor.uid}`); return { cmd: 'wait' }; }
  if (move.kind === 'sync') {
    const partnerId = (move.pair || []).find((id) => id !== actor.id);
    return { cmd: 'sync', sync: row.do, partner: partnerId, row };
  }
  const mode = row.target || move.target || 'random';
  const targets = resolveTargets(model, actor, mode, move, rng);
  return { cmd: 'skill', skill: row.do, target: targets.map((t) => t.uid), mode, row };
}
