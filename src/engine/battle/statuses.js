// Status effects (design_systems.md "Status effects"). Durations in rounds; reapplying refreshes;
// TEMPO UP and TEMPO DOWN cancel each other. Pure module.

/**
 * @typedef {object} StatusDef
 * @property {string} name   HUD label
 * @property {number} turns  default duration in rounds (0 = until cured)
 * @property {'round'|'turn'|'never'} tick  when the counter decrements: at round end, when the holder's
 *                                        turn comes (DAZED: consumed by the skipped turn), or never
 * @property {string} icon   ui atlas frame (falls back to text)
 * @property {object} [mods] stat modifiers: atkMult, defMult, defAdd, spdAdd
 * @property {boolean} [bad] true for debuffs (POP! removes one BUFF, i.e. !bad)
 */

/** @type {Record<string, StatusDef>} */
export const STATUS = {
  DAZED: { name: 'DAZED', turns: 1, tick: 'turn', icon: 'icon_dazed', bad: true },
  DEAF: { name: 'DEAF', turns: 3, tick: 'round', icon: 'icon_deaf', bad: true },
  OUT_OF_TUNE: { name: 'OUT OF TUNE', turns: 3, tick: 'round', icon: 'icon_outoftune', bad: true },
  TEMPO_DOWN: { name: 'TEMPO DOWN', turns: 3, tick: 'round', icon: 'icon_tempo_down', bad: true, cancels: 'TEMPO_UP' },
  TEMPO_UP: { name: 'TEMPO UP', turns: 3, tick: 'round', icon: 'icon_tempo_up', bad: false, cancels: 'TEMPO_DOWN' },
  BRISTLING: { name: 'BRISTLING', turns: 3, tick: 'round', icon: 'icon_bristling', bad: false, mods: { atkMult: 1.5, defMult: 0.75 } },
  SLIMED: { name: 'SLIMED', turns: 4, tick: 'round', icon: 'icon_slimed', bad: true, mods: { defAdd: -3 } },
  BAKED: { name: 'BAKED', turns: 3, tick: 'round', icon: 'icon_baked', bad: false, mods: { spdAdd: -3, defAdd: 3 } },
  ON_HOLD: { name: 'ON HOLD', turns: 2, tick: 'round', icon: 'icon_onhold', bad: false },
  DEADPAN: { name: 'DEADPAN', turns: 3, tick: 'round', icon: 'icon_deadpan', bad: false, mods: { defMult: 1.5 } },
  BASS_DOWN: { name: 'BASS DOWN', turns: 3, tick: 'round', icon: 'icon_bass_down', bad: true, mods: { atkMult: 0.75 } },
  BASS_UP: { name: 'BASS UP', turns: 3, tick: 'round', icon: 'icon_bass_up', bad: false, mods: { atkMult: 1.25 } },
  KO: { name: 'KO', turns: 0, tick: 'never', icon: 'icon_ko', bad: true },
};

export const STATUS_IDS = Object.keys(STATUS);

/** Normalize loose spellings ("OUT OF TUNE", "tempo down") to a status id. */
export function statusId(s) {
  if (!s) return null;
  const key = String(s).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return STATUS[key] ? key : null;
}

/** @param {{status: {id: string, turns: number}[]}} c */
export function hasStatus(c, id) {
  return !!(c && c.status && c.status.some((s) => s.id === id));
}

/**
 * Apply (or refresh) a status. Returns true when it was applied, false when immune/cancelled.
 * `c.immune` is an array of status ids (equipment); `c.minHp` combatants can still be statused.
 */
export function applyStatus(c, id, turns) {
  const def = STATUS[id];
  if (!def) return false;
  if (c.immune && c.immune.includes(id)) return false;
  if (!c.status) c.status = [];
  if (def.cancels && hasStatus(c, def.cancels)) {
    removeStatus(c, def.cancels);
    return false; // the two cancel out
  }
  const dur = turns ?? def.turns;
  const cur = c.status.find((s) => s.id === id);
  if (cur) cur.turns = Math.max(cur.turns, dur);
  else c.status.push({ id, turns: dur });
  return true;
}

/** Remove a status; returns true when it was present. */
export function removeStatus(c, id) {
  if (!c.status) return false;
  const i = c.status.findIndex((s) => s.id === id);
  if (i < 0) return false;
  c.status.splice(i, 1);
  return true;
}

/** Remove every status (optionally only debuffs). Returns the removed ids. */
export function clearStatuses(c, { onlyBad = false } = {}) {
  if (!c.status) return [];
  const removed = [];
  c.status = c.status.filter((s) => {
    const drop = s.id !== 'KO' && (!onlyBad || STATUS[s.id].bad);
    if (drop) removed.push(s.id);
    return !drop;
  });
  return removed;
}

/** Round-end tick: decrement round-ticking statuses; returns the ids that expired. */
export function tickRound(c) {
  if (!c.status) return [];
  const expired = [];
  for (const s of c.status) {
    if (STATUS[s.id].tick !== 'round') continue;
    s.turns -= 1;
    if (s.turns <= 0) expired.push(s.id);
  }
  c.status = c.status.filter((s) => !expired.includes(s.id));
  return expired;
}

/** Stat modifiers from every status the combatant carries. */
export function statusMods(c) {
  const out = { atkMult: 1, defMult: 1, defAdd: 0, spdAdd: 0 };
  for (const s of c.status || []) {
    const m = STATUS[s.id] && STATUS[s.id].mods;
    if (!m) continue;
    out.atkMult *= m.atkMult ?? 1;
    out.defMult *= m.defMult ?? 1;
    out.defAdd += m.defAdd ?? 0;
    out.spdAdd += m.spdAdd ?? 0;
  }
  return out;
}

/** Buff ids (not bad) a combatant carries, for POP!'s "removes one buff". */
export function buffs(c) {
  return (c.status || []).filter((s) => !STATUS[s.id].bad && s.id !== 'ON_HOLD').map((s) => s.id);
}
