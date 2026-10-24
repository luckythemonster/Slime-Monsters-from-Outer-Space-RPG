// Battle formulas (docs/design-proposals/design_systems.md "Formulas"). Pure integer math; every
// random number is passed in (rng(0..20) variance, percentage rolls) so tests can pin them.

export const FREQS = ['PHYS', 'LOW', 'HIGH', 'NOISE'];

/** Toon level 0..4 for a meter value 0..100. */
export function toonLevel(meter) {
  return Math.max(0, Math.min(4, Math.floor((meter || 0) / 25)));
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Effective speed: TEMPO UP ×1.5 / TEMPO DOWN ×0.5, floored (BAKED −3 is applied by the caller). */
export function effSpd(spd, { tempoUp = false, tempoDown = false } = {}) {
  if (tempoUp && !tempoDown) return Math.floor(spd * 1.5);
  if (tempoDown && !tempoUp) return Math.floor(spd * 0.5);
  return Math.floor(spd);
}

/** SETLIST initiative: effSPD + rng(0..3). */
export function initiative(spd, roll) {
  return spd + roll;
}

/**
 * hit% = clamp(90 + (effSPD_att − effSPD_tgt) × 2 + accMod, 55, 100); OUT OF TUNE −30; alwaysHit → 100.
 */
export function hitChance({ attSpd = 0, tgtSpd = 0, accMod = 0, outOfTune = false, alwaysHit = false } = {}) {
  if (alwaysHit) return 100;
  return clamp(90 + (attSpd - tgtSpd) * 2 + accMod + (outOfTune ? -30 : 0), 55, 100);
}

/** crit% = 3 + floor(LCK / 2) + 3 × toonLevel (0 when the attacker cannot crit). */
export function critChance({ lck = 0, toon = 0, noCrit = false } = {}) {
  if (noCrit) return 0;
  return 3 + Math.floor(lck / 2) + 3 * toon;
}

/** raw = max(1, ATK × 2 − DEF) (crit or ignoreDef: DEF = 0). */
export function rawDamage(atk, def, { crit = false, ignoreDef = false } = {}) {
  return Math.max(1, atk * 2 - (crit || ignoreDef ? 0 : def));
}

/**
 * Frequency multiplier against an enemy definition: weak ×1.5 (or `weakMult`), resist ×0.5.
 * `freq` may be an array (Low-End Theory): the best multiplier wins.
 */
export function freqMult(freq, target = {}) {
  const freqs = Array.isArray(freq) ? freq : [freq];
  let best = null;
  for (const f of freqs) {
    if (!f) continue;
    let m = 1;
    if ((target.weak || []).includes(f)) m = target.weakMult || 1.5;
    else if ((target.resist || []).includes(f)) m = 0.5;
    if (best === null || m > best) best = m;
  }
  return best === null ? 1 : best;
}

/**
 * Full damage pipeline. `variance` is rng(0..20).
 *   dmg = floor(raw × POW / 100 × (90 + v) / 100)
 *   dmg = floor(dmg × freqMult) → floor(dmg × (100 + 5 × toon) / 100) [party only] → crit ×2 → TUNE /2 → max 1
 */
export function damage({
  atk, def, pow = 100, variance = 10, freqMult: fm = 1, toon = 0, isParty = false,
  crit = false, tuning = false, ignoreDef = false, extraMult = 1,
} = {}) {
  const raw = rawDamage(atk, def, { crit, ignoreDef });
  let dmg = Math.floor((raw * pow * (90 + variance)) / 10000);
  dmg = Math.floor(dmg * fm);
  if (extraMult !== 1) dmg = Math.floor(dmg * extraMult);
  if (isParty) dmg = Math.floor((dmg * (100 + 5 * toon)) / 100);
  if (crit) dmg *= 2;
  if (tuning) dmg = Math.floor(dmg / 2);
  return Math.max(1, dmg);
}

/** Damage bounds without variance, for tests and the Monte-Carlo (min at v=0, max at v=20). */
export function damageRange(opts) {
  return [damage({ ...opts, variance: 0 }), damage({ ...opts, variance: 20 })];
}

/** heal = floor(POW × (90 + v) / 100). */
export function heal(pow, variance = 10) {
  return Math.floor((pow * (90 + variance)) / 100);
}

/** flee% = clamp(50 + (avgPartySPD − maxEnemySPD) × 5, 10, 90). */
export function fleeChance(avgPartySpd, maxEnemySpd) {
  return clamp(50 + (avgPartySpd - maxEnemySpd) * 5, 10, 90);
}

/** Toon meter fill table (party-only events). Brian's Market Alignment halves (floored). */
export const TOON_FILL = {
  strumHit: 4,
  strumCrit: 8,
  riff: 6,
  sync: 10,
  damaged: 3,
  enemyKo: 5,
  ryanActs: 8,
  scan: 5,
  sticker: 1,
};

export function toonGain(points, { halved = false } = {}) {
  return halved ? Math.floor(points / 2) : points;
}

/** Player meter caps at 99; only scripts set 100. */
export const METER_PLAYER_CAP = 99;
export const METER_MAX = 100;

/** Carryover into the next battle: floor(meter / 2). */
export function meterCarryover(meter) {
  return Math.floor(Math.max(0, meter) / 2);
}
