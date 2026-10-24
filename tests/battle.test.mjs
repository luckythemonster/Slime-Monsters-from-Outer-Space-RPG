#!/usr/bin/env node
// Pure-Node tests of the battle model (no Phaser, no browser). Prints one JSON line per group and a
// summary line; exits non-zero on any failure. Also prints a Monte-Carlo sanity table (seeded).
//
//   node tests/battle.test.mjs
//   MC_RUNS=200 node tests/battle.test.mjs      (default 200 runs per cell)

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as F from '../src/engine/battle/formulas.js';
import { makeRng } from '../src/engine/battle/rng.js';
import { STATUS, applyStatus, removeStatus, hasStatus, tickRound, statusMods, statusId } from '../src/engine/battle/statuses.js';
import { BattleModel } from '../src/engine/battle/BattleModel.js';
import { decide, aiContext } from '../src/engine/battle/BattleAI.js';
import { BATTLE_SCRIPTS } from '../src/engine/battle/BattleScripts.js';
import { partySeed, levelStats, buildBattle, applyResults } from '../src/engine/battle/setup.js';
import { GameState } from '../src/engine/GameState.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src', 'data');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const characters = readJson(path.join(DATA, 'characters.json'));
const items = readJson(path.join(DATA, 'items.json'));
const equipment = readJson(path.join(DATA, 'equipment.json'));
const enemies = readJson(path.join(DATA, 'enemies.json'));
const encounters = readJson(path.join(DATA, 'encounters.json'));
const riffs = readJson(path.join(DATA, 'riffs.json'));
const start = readJson(path.join(DATA, 'start.json'));

const data = {
  characters: characters.characters, xpTable: characters.xpTable, riffs, items, equipment, enemies, encounters,
};
data.makeSeed = (id, member = {}, opts = {}) => partySeed(data, id, member, opts);

let failures = 0;
let total = 0;
function group(name, fn) {
  const errors = [];
  const check = (cond, msg) => { total++; if (!cond) { errors.push(msg); failures++; } };
  try { fn(check); } catch (err) { errors.push(`threw: ${err && err.stack ? err.stack : err}`); failures++; }
  process.stdout.write(`${JSON.stringify({ test: name, ok: errors.length === 0, errors })}\n`);
}

// ---- helpers -----------------------------------------------------------------------------------

/** RNG that always rolls the minimum (deterministic order / no crits / always hits / max damage variance 0). */
const zeroRng = { seed: 0, float: () => 0, int: (a) => a, chance: (p) => p >= 100, pick: (arr) => arr[0] };
/** RNG that rolls the maximum. */
const maxRng = { seed: 1, float: () => 0.999999, int: (a, b) => b, chance: (p) => p > 0, pick: (arr) => arr[arr.length - 1] };
/** Deterministic "normal" rolls: every attack hits (hit% ≥ 55), nothing crits (≤ 21%), ≥50% statuses land, min variance. */
const calmRng = { seed: 2, float: () => 0, int: (a) => a, chance: (p) => p >= 50, pick: (arr) => arr[0] };
/** Hits, never crits, lands ≥25% rolls (KRAAANG's DAZED 40% and knock-off 25%), max variance. */
const knockRng = { seed: 3, float: () => 0.999999, int: (a, b) => b, chance: (p) => p >= 25, pick: (arr) => arr[0] };
/** Every percentage roll fails. */
const failRng = { seed: 4, float: () => 0.999999, int: (a, b) => b, chance: () => false, pick: (arr) => arr[0] };

function seed(id, level = 1, extra = {}) {
  return partySeed(data, id, { level, ...extra }, extra.opts || {});
}

function model({ party = [seed('lucky')], enemyIds = ['drone'], rng = makeRng(1), meter = null, encounter = {}, script = null, inventory = [], flags = {} } = {}) {
  return new BattleModel({ encounter: { enemies: enemyIds, ...encounter }, party, data, rng, meter, flags, script, inventory, money: 10 });
}

/** Drive a model to its end with a policy for controllable members. Returns the model. */
function run(m, policy = strumPolicy, { maxRounds = 60 } = {}) {
  if (m.round === 0) m.start();
  let guard = 0;
  while (!m.ended) {
    const t = m.advance();
    if (!t) break;
    const action = t.needsInput ? policy(m, t.actor) : m.decide(t.actor);
    const ok = m.act(t.actor.uid, action);
    if (!ok) m.act(t.actor.uid, { cmd: 'tune' });
    if (++guard > maxRounds * 20) throw new Error(`run: guard tripped at round ${m.round}`);
    if (m.round > maxRounds) throw new Error(`run: exceeded ${maxRounds} rounds`);
  }
  return m;
}

function lowestEnemy(m) {
  const e = m.living('enemy');
  return e.reduce((a, b) => (b.hp < a.hp ? b : a), e[0]);
}

function strumPolicy(m, actor) {
  const t = lowestEnemy(m);
  return t ? { cmd: 'strum', target: t.uid } : { cmd: 'tune' };
}

/** A reasonable player: words when lit, Shared Aura when hurt, pizza when low, best riff, else STRUM. */
function smartPolicy(m, actor) {
  const cmds = Object.fromEntries(m.commands(actor.uid).map((c) => [c.id, c]));
  const party = m.living('party').filter((c) => !c.auto);
  const hurt = party.filter((c) => c.hp * 100 < c.maxHp * 45);
  if (!cmds.noise.disabled) {
    const words = m.noiseMenu(actor.uid).filter((w) => !w.disabled);
    if (words.length) {
      const w = words[words.length - 1];
      return { cmd: 'noise', word: w.id, target: w.target === 'enemy' ? lowestEnemy(m).uid : undefined };
    }
  }
  if (!cmds.item.disabled && actor.hp * 100 < actor.maxHp * 30) {
    const pizza = m.usableItems().find((i) => i.id === 'pizza_slice' && !i.disabled);
    if (pizza) return { cmd: 'item', item: 'pizza_slice', target: actor.uid };
  }
  if (!cmds.riff.disabled) {
    const sync = m.syncMenu(actor.uid).find((s) => s.id === 'shared_aura' && !s.disabled);
    if (sync && hurt.length) return { cmd: 'sync', sync: 'shared_aura' };
    const best = m.riffMenu(actor.uid).filter((r) => !r.disabled && riffs[r.id].pow).sort((a, b) => riffs[b.id].pow - riffs[a.id].pow)[0];
    if (best) return { cmd: 'riff', riff: best.id, target: best.target === 'enemy' ? lowestEnemy(m).uid : undefined };
  }
  return strumPolicy(m, actor);
}

/**
 * tests/chapter1.mjs's `makePlan` on the model: Hotdish for a KO, Shared Aura / pizza / TUNE when someone is
 * under 40%, KRAAANG against two or more (or the Chorus), POP on a healthy single, the best-frequency riff
 * while AMP stays above a reserve, else STRUM the lowest enemy.
 */
function chapter1Policy(m, me) {
  const living = m.party().filter((c) => c.present && !c.ko);
  const enemies = m.living('enemy');
  const items = m.usableItems();
  const item = (id) => items.find((e) => e.id === id && e.qty > 0 && !e.disabled);
  const sync = (id) => m.syncMenu(me.uid).find((e) => e.id === id && !e.disabled);
  const riff = (id) => m.riffMenu(me.uid).find((e) => e.id === id && !e.disabled);
  const noise = (id) => m.noiseMenu(me.uid).find((e) => e.id === id && !e.disabled);
  const cmdOk = (id) => m.commands(me.uid).some((c) => c.id === id && !c.disabled);
  const resists = (c, f) => (c.resist || []).includes(f);
  const ko = m.party().find((c) => c.present && c.ko && !c.auto);
  const weakest = living.filter((c) => !c.auto).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
  const lowest = enemies.slice().sort((a, c) => a.hp - c.hp)[0];
  const slime = me.id === 'lucky' || me.id === 'phoenix';
  if (ko && cmdOk('item') && item('hotdish')) return { cmd: 'item', item: 'hotdish', target: ko.uid };
  if (weakest && weakest.hp / weakest.maxHp < 0.4) {
    if (slime && cmdOk('riff') && sync('shared_aura')) return { cmd: 'sync', sync: 'shared_aura' };
    if (cmdOk('item') && item('pizza_slice')) return { cmd: 'item', item: 'pizza_slice', target: weakest.uid };
    if (weakest.uid === me.uid && me.hp / me.maxHp < 0.25) return { cmd: 'tune' };
  }
  if (!lowest) return { cmd: 'tune' };
  if (cmdOk('noise')) {
    const chorus = m.encounterId === 'ep0_rehearsal';
    const noiseWorks = enemies.some((e) => !resists(e, 'NOISE'));
    if (m.toonLevel >= 2 && noise('kraaang') && (chorus || (enemies.length >= 2 && noiseWorks))) return { cmd: 'noise', word: 'kraaang', target: lowest.uid };
    if (m.toonLevel >= 1 && !chorus && noise('pop') && !resists(lowest, 'NOISE') && lowest.hp > 20) return { cmd: 'noise', word: 'pop', target: lowest.uid };
  }
  if (cmdOk('riff')) {
    const reserve = slime ? 4 : 0;
    const choices = me.id === 'lucky' ? [['power_chord', 3, 'HIGH'], ['pseudopod_slap', 3, 'PHYS']]
      : me.id === 'phoenix' ? [['root_note', 3, 'LOW']]
        : me.id === 'brian' ? [['sterile_chord', 0, 'HIGH'], ['tube_screamer', 5, 'HIGH']] : [];
    const ranked = choices.filter(([id, cost]) => riff(id) && me.amp - cost >= reserve)
      .map(([id, , f]) => ({ id, score: (lowest.weak || []).includes(f) ? 2 : resists(lowest, f) ? 0 : 1 }))
      .sort((a, c) => c.score - a.score);
    if (ranked.length && ranked[0].score > 0) return { cmd: 'riff', riff: ranked[0].id, target: lowest.uid };
  }
  return { cmd: 'strum', target: lowest.uid };
}

const evTypes = (m) => m.events.map((e) => e.type);

// ---------------------------------------------------------------------------------------------
group('formulas', (check) => {
  check(F.hitChance({ attSpd: 7, tgtSpd: 7 }) === 90, 'base hit 90');
  check(F.hitChance({ attSpd: 0, tgtSpd: 30 }) === 55, 'hit clamps at 55');
  check(F.hitChance({ attSpd: 20, tgtSpd: 0 }) === 100, 'hit clamps at 100');
  check(F.hitChance({ attSpd: 7, tgtSpd: 7, accMod: -10 }) === 80, 'riff acc mod');
  check(F.hitChance({ attSpd: 7, tgtSpd: 7, outOfTune: true }) === 60, 'OUT OF TUNE -30');
  check(F.hitChance({ attSpd: 0, tgtSpd: 30, alwaysHit: true }) === 100, 'always hit = 100');
  check(F.critChance({ lck: 6, toon: 0 }) === 6 && F.critChance({ lck: 7, toon: 2 }) === 12, 'crit = 3 + floor(lck/2) + 3*toon');
  check(F.critChance({ lck: 9, noCrit: true }) === 0, 'Brian cannot crit');
  check(F.rawDamage(1, 50) === 1, 'raw min 1');
  check(F.rawDamage(10, 3) === 17 && F.rawDamage(10, 3, { crit: true }) === 20, 'raw = atk*2 - def; crit ignores def');
  // Lucky L1 (ATK 7+3) STRUM vs Drone (DEF 3): raw 17 → 15..18 (DESIGN sanity line)
  const [lo, hi] = F.damageRange({ atk: 10, def: 3, pow: 100, isParty: true });
  check(lo === 15 && hi === 18, `±10% bounds 15..18, got ${lo}..${hi}`);
  check(F.damage({ atk: 10, def: 3, pow: 100, variance: 10, freqMult: 1.5 }) === 25, 'weak ×1.5 (17*1.5=25.5 → 25)');
  check(F.damage({ atk: 10, def: 3, pow: 100, variance: 10, freqMult: 0.5 }) === 8, 'resist ×0.5');
  check(F.damage({ atk: 10, def: 3, pow: 100, variance: 10, isParty: true, toon: 2 }) === 18, 'party +5%/toon (17*1.10=18.7 → 18)');
  check(F.damage({ atk: 10, def: 3, pow: 100, variance: 10, crit: true }) === 40, 'crit doubles (raw 20 → 40)');
  check(F.damage({ atk: 10, def: 3, pow: 100, variance: 10, tuning: true }) === 8, 'TUNE halves (17 → 8)');
  check(F.damage({ atk: 1, def: 99, pow: 10, variance: 0, freqMult: 0.5, tuning: true }) === 1, 'min 1');
  check(F.damage({ atk: 10, def: 3, pow: 100, variance: 10, ignoreDef: true }) === 20, 'ignoreDef (KRATHOOM)');
  check(F.freqMult('NOISE', { weak: ['NOISE'] }) === 1.5 && F.freqMult('PHYS', { resist: ['PHYS'] }) === 0.5 && F.freqMult('LOW', {}) === 1, 'freq multipliers');
  check(F.freqMult('NOISE', { weak: ['NOISE'], weakMult: 2 }) === 2, 'billboard NOISE ×2');
  check(F.freqMult(['LOW', 'HIGH'], { weak: ['HIGH'], resist: ['LOW'] }) === 1.5, 'Low-End Theory takes the better multiplier');
  check(F.heal(20, 0) === 18 && F.heal(20, 20) === 22, 'heal ±10%');
  check(F.fleeChance(7, 10) === 35 && F.fleeChance(0, 30) === 10 && F.fleeChance(30, 0) === 90, 'flee clamp 10..90');
  check(F.toonLevel(0) === 0 && F.toonLevel(24) === 0 && F.toonLevel(25) === 1 && F.toonLevel(99) === 3 && F.toonLevel(100) === 4, 'toon levels');
  check(F.toonGain(5, { halved: true }) === 2 && F.toonGain(4, { halved: true }) === 2, 'Brian halves, floored');
  check(F.meterCarryover(99) === 49 && F.meterCarryover(0) === 0, 'carryover floor(meter/2)');
  check(F.effSpd(9, { tempoUp: true }) === 13 && F.effSpd(9, { tempoDown: true }) === 4, 'TEMPO ×1.5 / ×0.5 floored');
});

// ---------------------------------------------------------------------------------------------
group('stats tables L1-8', (check) => {
  const luckyT = [[28, 8, 7, 4, 7, 6], [34, 10, 9, 5, 8, 7], [40, 12, 11, 6, 9, 8], [46, 14, 13, 7, 10, 9], [52, 16, 15, 8, 11, 10], [58, 18, 17, 9, 12, 11], [64, 20, 19, 10, 13, 12], [70, 22, 21, 11, 14, 13]];
  const phoenixT = [[34, 10, 5, 6, 5, 4], [41, 12, 6, 8, 6, 5], [48, 14, 8, 10, 7, 6], [55, 16, 9, 12, 8, 7], [62, 18, 11, 14, 9, 8], [69, 20, 12, 16, 10, 9], [76, 22, 14, 18, 11, 10], [83, 24, 15, 20, 12, 11]];
  const keys = ['hp', 'amp', 'atk', 'def', 'spd', 'lck'];
  for (let l = 1; l <= 8; l++) {
    const ls = levelStats(data.characters.lucky, l);
    const ps = levelStats(data.characters.phoenix, l);
    check(keys.every((k, i) => ls[k] === luckyT[l - 1][i]), `Lucky L${l}: ${JSON.stringify(ls)}`);
    check(keys.every((k, i) => ps[k] === phoenixT[l - 1][i]), `Phoenix L${l}: ${JSON.stringify(ps)}`);
  }
  const b = levelStats(data.characters.brian, 3);
  check(b.hp === 30 && b.amp === 6 && b.atk === 8 && b.def === 5 && b.spd === 9 && b.lck === 0, 'Brian fixed L3 30/6/8/5/9/0');
  const r = levelStats(data.characters.ryan, 4);
  check(r.hp === 40 && r.amp === 12 && r.atk === 10 && r.def === 6 && r.spd === 11 && r.lck === 5, 'Ryan fixed L4 40/12/10/6/11/5');
  check(JSON.stringify(characters.xpTable.slice(0, 8)) === JSON.stringify([0, 10, 24, 48, 85, 135, 200, 275]), 'XP table');
  const s = seed('lucky', 1);
  check(s.atk === 10 && s.freq === 'HIGH' && s.maxHp === 28, 'seed applies Beat-Up Guitar (+3 ATK, HIGH)');
  const p = seed('phoenix', 1);
  check(p.atk === 7 && p.def === 7 && p.freq === 'PHYS', 'Phoenix seed: Trash Bag +2 PHYS, Hoodie +1 DEF');
  const glasses = partySeed(data, 'lucky', { equip: { accessory: 'slime_sunglasses' } });
  check(glasses.lck === 8 && glasses.immune.includes('DAZED'), 'sunglasses LCK +2, immune DAZED');
  for (const id of Object.keys(data.characters)) for (const rid of data.characters[id].riffs.concat(data.characters[id].syncs)) check(!!riffs[rid], `${id} riff ${rid} exists`);
  for (const [id, enc] of Object.entries(encounters)) for (const e of enc.enemies) check(!!enemies[typeof e === 'string' ? e : e.id], `encounter ${id} enemy exists`);
  for (const [id, e] of Object.entries(enemies)) for (const row of e.ai) check(row.do === 'flee' || !!e.skills[row.do] || !!riffs[row.do], `enemy ${id} ai move ${row.do} exists`);
  check(Object.keys(riffs).length === 29, `riff entries (24 design + 5 Ryan auto moves): ${Object.keys(riffs).length}`);
});

// ---------------------------------------------------------------------------------------------
group('turn order', (check) => {
  // Same effSPD everywhere → ties: party before enemies, roster order, then enemy slot.
  const party = [seed('phoenix', 1, { spd: 0 }), seed('lucky', 1)];
  party[0].spd = 7; party[1].spd = 7;
  const m = model({ party, enemyIds: ['dev_cop', 'dev_cop'], rng: zeroRng });
  m.combatants.filter((c) => c.side === 'enemy').forEach((c) => { c.spd = 7; });
  m.start();
  check(JSON.stringify(m.order) === JSON.stringify(['lucky', 'phoenix', 'dev_cop', 'dev_cop_2']), `tie order ${m.order}`);
  // init = effSPD + rng(0..3): maxRng gives +3 to everyone, order still by speed.
  const m2 = model({ party: [seed('lucky', 1)], enemyIds: ['goose'], rng: maxRng });
  m2.start();
  check(m2.order[0] === 'goose', 'faster enemy (SPD 9 vs 7) goes first');
  // TEMPO DOWN halves speed.
  const m3 = model({ party: [seed('lucky', 1)], enemyIds: ['goose'], rng: zeroRng });
  applyStatus(m3.find('goose'), 'TEMPO_DOWN');
  m3.start();
  check(m3.order[0] === 'lucky' && m3.eff(m3.find('goose')).spd === 4, 'TEMPO DOWN goose goes second');
  // Ambush: enemies first in round 1 only.
  const m4 = model({ party: [seed('lucky', 1)], enemyIds: ['dev_cop'], rng: zeroRng, encounter: { ambush: true } });
  m4.start();
  check(m4.order[0] === 'dev_cop', 'ambush: enemy first');
  check(m4.getTurnOrder().length === 2 && m4.getTurnOrder()[0].uid === 'dev_cop', 'getTurnOrder shape');
});

// ---------------------------------------------------------------------------------------------
group('AMP economy', (check) => {
  const m = model({ party: [seed('lucky', 3, { amp: 3 })], enemyIds: ['drone'], rng: calmRng });
  m.start();
  const lucky = m.find('lucky');
  m.advance();
  m.act('lucky', { cmd: 'strum', target: 'drone' });
  check(lucky.amp === 5, `STRUM hit +2 AMP (got ${lucky.amp})`);
  check(m.events.some((e) => e.type === 'amp' && e.delta === 2), 'amp event');
  m.drain();
  lucky.acted = false; m.turnIndex = -1; m.order = ['lucky'];
  m.advance();
  m.act('lucky', { cmd: 'tune' });
  check(lucky.amp === 9 && lucky.tuning, 'TUNE +4 AMP and tuning');
  lucky.acted = false; m.turnIndex = -1;
  m.advance();
  check(lucky.tuning === false, 'tuning clears at the next turn start');
  m.act('lucky', { cmd: 'riff', riff: 'power_chord', target: 'drone' });
  check(lucky.amp === 6, `Power Chord costs 3 (got ${lucky.amp})`);
  lucky.amp = 2; lucky.acted = false; m.turnIndex = -1;
  m.advance();
  const menu = m.riffMenu('lucky');
  check(menu[0].disabled && menu[0].reason === 'needs 3 AMP', 'riff grayed with AMP reason');
  check(m.act('lucky', { cmd: 'riff', riff: 'power_chord', target: 'drone' }) === false, 'cannot riff without AMP');
  // Max AMP clamps.
  lucky.amp = lucky.maxAmp;
  check(m.changeAmp(lucky, 5) === 0, 'AMP clamps at max');
});

// ---------------------------------------------------------------------------------------------
group('toon meter', (check) => {
  const m = model({ party: [seed('lucky', 3), seed('phoenix', 3)], enemyIds: ['analyst'], rng: calmRng });
  m.start();
  m.advance();
  m.act('lucky', { cmd: 'strum', target: 'analyst' });
  check(m.meter === 4, `STRUM hit +4 (got ${m.meter})`);
  m.order = ['phoenix']; m.turnIndex = -1; m.find('phoenix').acted = false;
  m.advance();
  m.act('phoenix', { cmd: 'riff', riff: 'root_note', target: 'analyst' });
  check(m.meter === 10, `RIFF +6 (got ${m.meter})`);
  m.order = ['phoenix']; m.turnIndex = -1; m.find('phoenix').acted = false;
  m.advance();
  m.act('phoenix', { cmd: 'riff', riff: 'my_brain_thinks', target: 'analyst' });
  check(m.meter === 15, `My Brain Thinks +5 (got ${m.meter})`);
  check(m.events.some((e) => e.type === 'scan' && e.info.weak.includes('NOISE') && e.info.resist.includes('HIGH')), 'scan event carries weakness/resist');
  // A party member taking damage +3; enemies never fill it on their own hits otherwise.
  const before = m.meter;
  m.damage(m.find('lucky'), 5, { by: 'analyst' });
  check(m.meter === before + 3, 'party damaged +3');
  // Enemy KO +5.
  m.damage(m.find('analyst'), 999, { by: 'lucky' });
  check(m.meter === before + 8 && m.find('analyst').ko && m.result === 'win', 'enemy KO +5 (and the win)');
  // Levels and onToon hook, cap 99.
  const fired = [];
  const m2 = model({ party: [seed('lucky', 3)], enemyIds: ['chorus'], rng: zeroRng, script: { onToon: (mm, l) => fired.push(l) } });
  m2.start();
  m2.setMeter(24); check(m2.toonLevel === 0 && fired.length === 0, 'level 0 below 25');
  m2.setMeter(25); check(m2.toonLevel === 1 && fired[0] === 1, 'level 1 at 25 fires onToon(1)');
  m2.setMeter(76); check(m2.toonLevel === 3 && JSON.stringify(fired) === JSON.stringify([1, 2, 3]), 'levels 2 and 3 fire in order');
  m2.setMeter(500); check(m2.meter === 99 && m2.toonLevel === 3, 'player cap 99 (never Toon 4)');
  check(m2.addToon(10) === 0 && m2.meter === 99, 'addToon at cap is a no-op');
  m2.setMeter(100, { force: true }); check(m2.meter === 100 && m2.toonLevel === 4 && fired.includes(4), 'scripts force 100 = Toon 4');
  m2.addToon(5); check(m2.meter === 100, 'a forced 100 is not pulled back to 99');
  // Brian halves, floored.
  const m3 = model({ party: [seed('lucky', 3), seed('brian')], enemyIds: ['chorus'], rng: calmRng });
  m3.start();
  m3.advance();
  m3.act('lucky', { cmd: 'strum', target: 'chorus' });
  check(m3.meter === 2, `Brian halves STRUM +4 → +2 (got ${m3.meter})`);
  check(m3.addToon(3) === 1 && m3.meter === 3, 'floor(3/2) = 1');
  // Band sticker +1 per action; carryover.
  const st = partySeed(data, 'lucky', { level: 3, equip: { accessory: 'band_sticker' } });
  const m4 = model({ party: [st], enemyIds: ['chorus'], rng: zeroRng });
  m4.start(); m4.advance(); m4.act('lucky', { cmd: 'tune' });
  check(m4.meter === 1, 'sticker +1 on a TUNE');
  check(F.meterCarryover(37) === 18, 'carryover');
  // Starting meter from encounter.toonStart.
  const m5 = model({ party: [seed('lucky', 3)], enemyIds: ['cop'], encounter: { toonStart: 25 } });
  check(m5.meter === 25 && m5.toonLevel === 1, 'toonStart 25');
});

// ---------------------------------------------------------------------------------------------
group('noise words', (check) => {
  // POP!: single, NOISE, removes one buff.
  const m = model({ party: [seed('lucky', 3)], enemyIds: ['cop'], rng: calmRng, meter: 30 });
  m.start();
  applyStatus(m.find('cop'), 'TEMPO_UP');
  m.advance();
  const words = m.noiseMenu('lucky');
  check(words.find((w) => w.id === 'pop').disabled === false && words.find((w) => w.id === 'kraaang').reason === 'needs Toon 2', 'POP lit, KRAAANG grayed');
  check(words.find((w) => w.id === 'doom').reason === '???', 'DOOM grayed ???');
  const hpBefore = m.find('cop').hp;
  m.act('lucky', { cmd: 'noise', word: 'pop', target: 'cop' });
  check(m.meter === 5 && m.find('cop').hp < hpBefore && !hasStatus(m.find('cop'), 'TEMPO_UP'), `POP: -25, damage, buff removed (meter ${m.meter})`);
  check(m.events.some((e) => e.type === 'word' && e.word === 'pop'), 'word event');
  // KRAAANG: all enemies, 40% DAZED, 25% knock-off for 32 px enemies (maxRng → both happen).
  const m2 = model({ party: [seed('lucky', 3)], enemyIds: ['scooter', 'scooter', 'analyst'], rng: knockRng, meter: 55 });
  m2.start(); m2.advance();
  m2.act('lucky', { cmd: 'noise', word: 'kraaang' });
  check(m2.meter === 5, 'KRAAANG costs 50');
  check(m2.find('scooter').offPanel && m2.find('scooter_2').offPanel, 'both 32 px scooters knocked off-panel');
  check(!m2.find('analyst').offPanel && hasStatus(m2.find('analyst'), 'DAZED'), '48 px analyst stays, DAZED');
  check(m2.events.some((e) => e.type === 'leave' && e.how === 'offPanel'), 'leave event');
  // KRATHOOM: ignores DEF, self BRISTLING 2, uiTear.
  const m3 = model({ party: [seed('lucky', 3)], enemyIds: ['cop'], rng: calmRng, meter: 80 });
  m3.start(); m3.advance();
  m3.act('lucky', { cmd: 'noise', word: 'krathoom' });
  const dmg = m3.events.find((e) => e.type === 'damage' && e.target === 'cop');
  // Lucky L3 ATK 11+3=14, BRISTLING applies first (ATK ×1.5 = 21) → raw 42 (DEF ignored) × 2.6 × 0.9 = 98;
  // the word is paid before the hit (80 → 5 = Toon 0), so no +5%/level bonus.
  check(dmg && dmg.amount === 98, `KRATHOOM damage ignores DEF (got ${dmg && dmg.amount})`);
  check(m3.meter === 5, 'KRATHOOM costs 75');
  check(hasStatus(m3.find('lucky'), 'BRISTLING') && m3.events.some((e) => e.type === 'uiTear'), 'self BRISTLING + uiTear');
  check(m3.events.some((e) => e.type === 'mood' && e.mood === 'rage'), 'Lucky swaps to the rage sheet');
  // Brian never makes noise.
  const m4 = model({ party: [seed('brian')], enemyIds: ['cop'], rng: zeroRng, meter: 80 });
  m4.start(); m4.advance();
  check(m4.commands('brian').find((c) => c.id === 'noise').reason === 'Brian hates this', 'Brian hates this');
});

// ---------------------------------------------------------------------------------------------
group('slime sync', (check) => {
  const m = model({ party: [seed('lucky', 3), seed('phoenix', 3), seed('brian')], enemyIds: ['analyst'], rng: zeroRng });
  m.start();
  const lucky = m.find('lucky'); const phoenix = m.find('phoenix');
  const menu = () => Object.fromEntries(m.syncMenu('lucky').map((s) => [s.id, s]));
  check(menu().shared_aura.disabled === false, 'Shared Aura available');
  check(menu().low_end_theory.disabled === false, 'Low-End Theory at L3');
  check(menu().wall_of_sound.reason === 'both need L5', 'Wall of Sound needs L5');
  check(!('pocket' in menu()), 'Pocket is AI-only');
  phoenix.acted = true;
  check(menu().shared_aura.reason === 'Phoenix already played', 'partner acted');
  phoenix.acted = false; phoenix.amp = 2;
  check(menu().shared_aura.reason === 'needs 4 AMP', 'needs AMP');
  phoenix.amp = 10; applyStatus(phoenix, 'DEAF');
  check(menu().shared_aura.reason === 'DEAF', 'DEAF blocks sync');
  removeStatus(phoenix, 'DEAF');
  check(m.syncMenu('brian').length === 0, 'Brian has no syncs');
  // Execute: both heal 25%, cured, +10 Toon, partner consumed.
  lucky.hp = 10; phoenix.hp = 10; applyStatus(lucky, 'OUT_OF_TUNE');
  m.order = ['lucky', 'phoenix']; m.turnIndex = -1;
  m.advance();
  check(m.act('lucky', { cmd: 'sync', sync: 'shared_aura' }), 'sync executes');
  check(lucky.hp === 20 && phoenix.hp === 10 + Math.floor(phoenix.maxHp / 4), 'both heal 25%');
  check(!hasStatus(lucky, 'OUT_OF_TUNE'), 'statuses cured');
  check(lucky.amp === 8 && phoenix.amp === 6, 'both pay 4 AMP');
  check(m.meter === 10, `+10 Toon halved by Brian… no: Brian halves → 10? got ${m.meter}`);
  check(phoenix.acted && m.getTurnOrder()[1].consumed, 'partner turn consumed (icon crossed out)');
  check(m.advance() === null || m.round === 2, 'partner skipped: next is round 2');
  // Low-End Theory uses the better of LOW/HIGH.
  const m2 = model({ party: [seed('lucky', 3), seed('phoenix', 3)], enemyIds: ['slush'], rng: zeroRng });
  m2.start(); m2.order = ['lucky', 'phoenix']; m2.turnIndex = -1; m2.advance();
  m2.act('lucky', { cmd: 'sync', sync: 'low_end_theory' });
  const d = m2.events.find((e) => e.type === 'damage' && e.target === 'slush');
  // Lucky ATK 14 vs slush DEF 4: raw 24 × 1.6 × 0.9 = 34 → weak HIGH ×1.5 = 51
  check(d && d.amount === 51, `Low-End Theory ×1.5 vs HIGH-weak slush (got ${d && d.amount})`);
});

// ---------------------------------------------------------------------------------------------
group('statuses', (check) => {
  check(statusId('OUT OF TUNE') === 'OUT_OF_TUNE' && statusId('tempo down') === 'TEMPO_DOWN', 'id normalization');
  const c = { status: [], immune: [] };
  applyStatus(c, 'DEAF');
  check(c.status[0].turns === 3, 'DEAF 3 rounds');
  applyStatus(c, 'DEAF', 1);
  check(c.status[0].turns === 3, 'reapply refreshes to the longer duration');
  applyStatus(c, 'TEMPO_DOWN');
  check(applyStatus(c, 'TEMPO_UP') === false && !hasStatus(c, 'TEMPO_DOWN') && !hasStatus(c, 'TEMPO_UP'), 'TEMPO UP and DOWN cancel');
  check(tickRound(c).length === 0 && c.status[0].turns === 2, 'round tick decrements');
  tickRound(c); const exp = tickRound(c);
  check(exp.includes('DEAF') && c.status.length === 0, 'expires after 3 round ends');
  applyStatus(c, 'BRISTLING'); applyStatus(c, 'SLIMED'); applyStatus(c, 'BAKED');
  const mods = statusMods(c);
  check(mods.atkMult === 1.5 && mods.defMult === 0.75 && mods.defAdd === 0 && mods.spdAdd === -3, 'BRISTLING + SLIMED(-3) + BAKED(+3) mods');
  const imm = { status: [], immune: ['DAZED'] };
  check(applyStatus(imm, 'DAZED') === false, 'immunity');
  // In-model: DAZED skips the next turn and is consumed; DEAF blocks RIFF; OUT OF TUNE -30 hit and TUNE cures.
  const m = model({ party: [seed('lucky', 3), seed('phoenix', 3)], enemyIds: ['cop'], rng: zeroRng });
  m.start();
  m.inflict(m.find('phoenix'), 'DAZED');
  m.order = ['phoenix', 'lucky']; m.turnIndex = -1;
  const t = m.advance();
  check(t.actor.id === 'lucky' && m.events.some((e) => e.type === 'skip' && e.who === 'phoenix') && !hasStatus(m.find('phoenix'), 'DAZED'), 'DAZED skips and is consumed');
  m.inflict(m.find('lucky'), 'DEAF');
  check(m.commands('lucky').find((x) => x.id === 'riff').reason === 'DEAF' && m.commands('lucky').find((x) => x.id === 'noise').reason === 'DEAF', 'DEAF blocks RIFF/NOISE');
  removeStatus(m.find('lucky'), 'DEAF');
  m.inflict(m.find('lucky'), 'OUT_OF_TUNE');
  const ea = m.eff(m.find('lucky')); const et = m.eff(m.find('cop'));
  check(F.hitChance({ attSpd: ea.spd, tgtSpd: et.spd, outOfTune: true }) === F.hitChance({ attSpd: ea.spd, tgtSpd: et.spd }) - 30, 'OUT OF TUNE -30 hit');
  m.act('lucky', { cmd: 'tune' });
  check(!hasStatus(m.find('lucky'), 'OUT_OF_TUNE'), 'TUNE cures OUT OF TUNE');
  // SLIMED: DEF -3 and ×1.25 from LOW/HIGH.
  const m2 = model({ party: [seed('lucky', 3)], enemyIds: ['cop'], rng: calmRng });
  m2.start(); m2.advance();
  m2.inflict(m2.find('cop'), 'SLIMED');
  check(m2.eff(m2.find('cop')).def === 7, 'SLIMED DEF -3 (10 → 7)');
  m2.act('lucky', { cmd: 'strum', target: 'cop' });
  const d2 = m2.events.find((e) => e.type === 'damage' && e.target === 'cop');
  // raw 28-7=21 × 0.9 = 18 → ×1.25 = 22 (HIGH vs SLIMED); cop has no HIGH resist
  check(d2 && d2.amount === 22, `SLIMED ×1.25 from HIGH (got ${d2 && d2.amount})`);
  // Lucky's crit inflicts SLIMED.
  const m3 = model({ party: [seed('lucky', 3)], enemyIds: ['chorus'], rng: maxRng });
  m3.start(); m3.advance();
  m3.act('lucky', { cmd: 'strum', target: 'chorus' });
  check(hasStatus(m3.find('chorus'), 'SLIMED') && m3.events.some((e) => e.type === 'damage' && e.crit), "Lucky's crit inflicts SLIMED");
  // ON HOLD counts down at round end; DEADPAN DEF +50% and cures DAZED; items cure.
  const m4 = model({ party: [seed('phoenix', 3), seed('lucky', 3)], enemyIds: ['cop'], rng: zeroRng, inventory: [{ id: 'hand_warmer', qty: 1 }, { id: 'hotdish', qty: 1 }] });
  m4.start();
  m4.inflict(m4.find('cop'), 'ON_HOLD', 2);
  m4.endRound();
  check(m4.find('cop').status.find((s) => s.id === 'ON_HOLD').turns === 1, 'ON HOLD counts down');
  m4.inflict(m4.find('lucky'), 'DAZED');
  m4.order = ['phoenix']; m4.turnIndex = -1; m4.advance();
  m4.act('phoenix', { cmd: 'riff', riff: 'deadpan', target: 'lucky' });
  check(hasStatus(m4.find('lucky'), 'DEADPAN') && !hasStatus(m4.find('lucky'), 'DAZED') && m4.eff(m4.find('lucky')).def === Math.floor(m4.find('lucky').def * 1.5), 'Deadpan: DEF +50%, cures DAZED');
  m4.inflict(m4.find('lucky'), 'DEAF'); m4.inflict(m4.find('lucky'), 'TEMPO_DOWN');
  m4.order = ['phoenix']; m4.turnIndex = -1; m4.find('phoenix').acted = false; m4.advance();
  m4.act('phoenix', { cmd: 'item', item: 'hand_warmer', target: 'lucky' });
  check(!hasStatus(m4.find('lucky'), 'DEAF') && !hasStatus(m4.find('lucky'), 'TEMPO_DOWN') && m4.itemsUsed.includes('hand_warmer'), 'Hand Warmer cures DEAF + TEMPO DOWN');
  m4.damage(m4.find('lucky'), 999, { by: 'cop' });
  check(m4.find('lucky').ko && m4.events.some((e) => e.type === 'ko' && e.who === 'lucky') && m4.events.some((e) => e.type === 'mood' && e.mood === 'bruised'), 'KO + bruised sheet');
  check(m4.usableItems().find((i) => i.id === 'hotdish').disabled === false && m4.itemTargets('hotdish')[0].id === 'lucky', 'Hotdish targets the KO');
  m4.order = ['phoenix']; m4.turnIndex = -1; m4.find('phoenix').acted = false; m4.advance();
  m4.act('phoenix', { cmd: 'item', item: 'hotdish', target: 'lucky' });
  check(!m4.find('lucky').ko && m4.find('lucky').hp === Math.floor(m4.find('lucky').maxHp / 2), 'Hotdish revives at 50%');
  // Half-Ounce: party AMP to max, BAKED 3.
  const m5 = model({ party: [seed('lucky', 3, { amp: 0 }), seed('phoenix', 3, { amp: 0 })], enemyIds: ['cop'], rng: zeroRng, inventory: [{ id: 'half_ounce', qty: 4 }] });
  m5.start(); m5.advance();
  m5.act('lucky', { cmd: 'item', item: 'half_ounce' });
  check(m5.find('lucky').amp === m5.find('lucky').maxAmp && m5.find('phoenix').amp === m5.find('phoenix').maxAmp && hasStatus(m5.find('phoenix'), 'BAKED'), 'Half-Ounce session');
  check(m5.inventory.find((e) => e.id === 'half_ounce').qty === 3, 'consumed one');
  // Earplugs immune DEAF; fried pedalboard self OUT OF TUNE per RIFF (maxRng → always).
  const plugs = partySeed(data, 'lucky', { level: 3, equip: { accessory: 'earplugs' } });
  const m6 = model({ party: [plugs], enemyIds: ['chorus'], rng: zeroRng });
  check(m6.inflict(m6.find('lucky'), 'DEAF') === false, 'Earplugs immune DEAF');
  const fried = partySeed(data, 'lucky', { level: 3, equip: { accessory: 'fried_pedalboard' } });
  const m7 = model({ party: [fried], enemyIds: ['chorus'], rng: maxRng });
  m7.start(); m7.advance(); m7.act('lucky', { cmd: 'riff', riff: 'power_chord', target: 'chorus' });
  check(hasStatus(m7.find('lucky'), 'OUT_OF_TUNE') && fried.atk === 18, 'Fried Pedalboard: ATK +4, self OUT OF TUNE on a riff');
});

// ---------------------------------------------------------------------------------------------
group('enemy AI', (check) => {
  const m = model({ party: [seed('lucky', 3), seed('phoenix', 3)], enemyIds: ['goose'], rng: makeRng(7) });
  m.start();
  const goose = m.find('goose');
  let a = decide(m, goose, zeroRng);
  check(a.cmd === 'skill' && a.skill === 'hiss', `goose round 1 hisses (got ${a.skill})`);
  const r1 = new Set(); for (let i = 0; i < 20; i++) r1.add(decide(m, goose, makeRng(i)).skill);
  check(!r1.has('flee') && r1.has('hiss'), `round 1 weighted between hiss and peck, never flee (${[...r1]})`);
  m.round = 2;
  const picks = new Set();
  for (let i = 0; i < 20; i++) picks.add(decide(m, goose, makeRng(i)).skill);
  check(picks.has('peck') && !picks.has('hiss'), `goose after round 1 pecks only (${[...picks]})`);
  m.find('lucky').hp = 5;
  a = decide(m, goose, makeRng(1));
  check(a.target[0] === 'lucky', 'peck targets lowestHp');
  goose.hp = 10;
  const flees = []; for (let i = 0; i < 30; i++) flees.push(decide(m, goose, makeRng(i)).cmd);
  check(flees.includes('flee') && flees.includes('skill'), 'goose below 30% alone sometimes flees (weighted)');
  check(aiContext(m, goose).hpPct === 14 && aiContext(m, goose).allies === 0, 'ai context hp/allies');
  // Analyst: Dental Plan only below 50%.
  const m2 = model({ party: [seed('lucky', 3)], enemyIds: ['analyst'], rng: makeRng(2) });
  m2.start();
  let dental = 0; for (let i = 0; i < 40; i++) if (decide(m2, m2.find('analyst'), makeRng(i)).skill === 'dental_plan') dental++;
  check(dental === 0, 'no Dental Plan above 50%');
  m2.find('analyst').hp = 40;
  for (let i = 0; i < 40; i++) if (decide(m2, m2.find('analyst'), makeRng(i)).skill === 'dental_plan') dental++;
  check(dental > 0, 'Dental Plan below 50%');
  // Scooters: Swarm only while 3 alive; every(3) for slush; once for the cop.
  const m3 = model({ party: [seed('lucky', 3)], enemyIds: ['scooter', 'scooter', 'scooter'], rng: makeRng(5) });
  m3.start();
  let swarm = 0; for (let i = 0; i < 30; i++) if (decide(m3, m3.find('scooter'), makeRng(i)).skill === 'swarm') swarm++;
  check(swarm > 0, 'Swarm while 3 alive');
  m3.find('scooter_3').ko = true;
  swarm = 0; for (let i = 0; i < 30; i++) if (decide(m3, m3.find('scooter'), makeRng(i)).skill === 'swarm') swarm++;
  check(swarm === 0, 'no Swarm with 2 alive');
  const m4 = model({ party: [seed('lucky', 3)], enemyIds: ['slush'], rng: makeRng(5) });
  m4.start(); m4.round = 3;
  check(decide(m4, m4.find('slush'), makeRng(1)).skill === 'freeze', 'Freeze on round % 3 == 0');
  m4.round = 4;
  check(decide(m4, m4.find('slush'), makeRng(1)).skill === 'splash', 'Splash otherwise');
  const m5 = model({ party: [seed('lucky', 5), seed('phoenix', 5), seed('ryan', 4, { opts: { form: 'pocket', guest: true } })], enemyIds: ['cop'], rng: makeRng(5) });
  m5.start(); m5.round = 2;
  const cop = m5.find('cop');
  let kids = 0; for (let i = 0; i < 60; i++) { cop.usedRows = new Set(); if (decide(m5, cop, makeRng(i)).skill === 'hello_fellow_kids') kids++; }
  check(kids > 0, 'Hello Fellow Kids available from round 2');
  decide(m5, cop, makeRng(0)); cop.usedRows = new Set([0]);
  kids = 0; for (let i = 0; i < 60; i++) if (decide(m5, cop, makeRng(i)).skill === 'hello_fellow_kids') kids++;
  check(kids === 0, 'once: never again');
  const targets = new Set(); for (let i = 0; i < 40; i++) { const d = decide(m5, cop, makeRng(i)); if (d.skill === 'baton') targets.add(d.target[0]); }
  check(!targets.has('ryan') && targets.size > 0, `notRyan never targets Ryan (${[...targets]})`);
  // Ryan Pocket: Pocket sync at Toon >= 50 with Lucky un-acted.
  m5.setMeter(60);
  const rd = decide(m5, m5.find('ryan'), makeRng(0));
  const rdSet = new Set(); for (let i = 0; i < 40; i++) rdSet.add(decide(m5, m5.find('ryan'), makeRng(i)).cmd + ':' + (decide(m5, m5.find('ryan'), makeRng(i)).sync || decide(m5, m5.find('ryan'), makeRng(i)).skill));
  check(rdSet.has('sync:pocket'), `Pocket sync offered at Toon 60 (${[...rdSet]})`);
  m5.find('lucky').acted = true;
  const noSync = new Set(); for (let i = 0; i < 40; i++) noSync.add(decide(m5, m5.find('ryan'), makeRng(i)).cmd);
  check(!noSync.has('sync'), 'no Pocket once Lucky has acted');
  check(rd !== null, 'decide returns an action');
  // Possessed Ryan's Fill can hit the party (randomAny with maxRng = friendly).
  const m6 = model({ party: [seed('lucky', 3), seed('ryan', 4, { opts: { form: 'possessed', guest: true } })], enemyIds: ['whrnnng'], rng: maxRng });
  m6.start();
  const fill = decide(m6, m6.find('ryan'), { ...maxRng, float: () => 0.5 });
  check(fill.cmd === 'skill', 'Ryan decides');
  m6.act('ryan', { cmd: 'skill', skill: 'fill', target: ['lucky'] });
  check(m6.find('lucky').hp < m6.find('lucky').maxHp && m6.meter >= 8, 'friendly fire lands and Ryan adds +8 Toon');
});

// ---------------------------------------------------------------------------------------------
group('ko / win / lose / flee', (check) => {
  const m = model({ party: [seed('lucky', 1)], enemyIds: ['dev_cop', 'dev_cop'], rng: makeRng(11) });
  run(m);
  check(m.result === 'win' && m.rewards && m.rewards.xp === 6 && m.rewards.money === 0, `L1 Lucky beats two dev cops (3 XP each, $0): ${m.result} ${JSON.stringify(m.rewards)}`);
  check(evTypes(m).includes('win') && evTypes(m).includes('reward'), 'win + reward events');
  // Lose: all controllables KO'd; AUTO Ryan does not keep the party alive.
  const m2 = model({ party: [seed('lucky', 1), seed('ryan', 4, { opts: { form: 'possessed', guest: true } })], enemyIds: ['cop'], rng: makeRng(3) });
  m2.start();
  m2.damage(m2.find('lucky'), 999, { by: 'cop' });
  check(m2.result === 'lose' && m2.find('ryan').hp > 0, 'lose with Ryan still standing');
  // minHp floor and invincibility.
  const m3 = model({ party: [seed('lucky', 1)], enemyIds: ['chorus'], rng: zeroRng });
  m3.start();
  m3.damage(m3.find('chorus'), 999, { by: 'lucky' });
  check(m3.find('chorus').hp === 1 && !m3.find('chorus').ko, 'minHp 1: the chorus repeats');
  m3.invincible = true;
  m3.damage(m3.find('lucky'), 999, { by: 'chorus' });
  check(m3.find('lucky').hp === 1 && !m3.ended, 'invincible party floors at 1');
  // Flee: BAIL refused in scripted battles; otherwise a roll.
  const m4 = model({ party: [seed('lucky', 3)], enemyIds: ['goose'], rng: zeroRng, encounter: { noFlee: true } });
  m4.start(); m4.advance();
  check(m4.commands('lucky').find((c) => c.id === 'bail').reason === 'the dog has the contract', 'BAIL grayed in scripted battles');
  check(m4.act('lucky', { cmd: 'bail' }) === false, 'bail refused');
  const m5 = model({ party: [seed('lucky', 3)], enemyIds: ['goose'], rng: calmRng });
  m5.start(); m5.advance();
  m5.act('lucky', { cmd: 'bail' });
  check(m5.result === 'flee' && evTypes(m5).includes('flee'), 'bail succeeds on a 0 roll');
  const m6 = model({ party: [seed('lucky', 3)], enemyIds: ['goose'], rng: failRng });
  m6.start(); m6.advance();
  m6.act('lucky', { cmd: 'bail' });
  check(m6.result === null && m6.events.some((e) => e.type === 'text' && /bail/i.test(e.text)), "failed bail uses the turn");
  // Enemy flee leaves the fight and pays nothing; win still triggers.
  const m7 = model({ party: [seed('lucky', 3)], enemyIds: ['goose'], rng: zeroRng });
  m7.start(); m7.act('goose', { cmd: 'flee' });
  check(m7.result === 'win' && m7.rewards.xp === 0 && m7.rewards.money === 0, 'fled goose pays nothing');
  // Tutorial encounter: BAIL grayed "Not yet."
  const m8 = model({ party: [seed('lucky', 1)], enemyIds: ['drone'], rng: zeroRng, encounter: { canFlee: false, bailReason: 'Not yet.' } });
  m8.start();
  check(m8.commands('lucky').find((c) => c.id === 'bail').reason === 'Not yet.', 'tutorial BAIL reason');
});

// ---------------------------------------------------------------------------------------------
group('rewards + level-up (setup bridge)', (check) => {
  const gs = new GameState({ characters, items, equipment, start }, null).newGame();
  gs.party.add('phoenix');
  gs.party.add('brian');
  gs.party.addXp('lucky', 20); gs.party.addXp('phoenix', 20); // L2 each, 20 xp
  gs.inventory.add('pizza_slice', 1);
  const pizzaBefore = gs.inventory.count('pizza_slice');
  gs.meter = 30;
  const m = buildBattle({ state: gs, data, encounterId: 'hub_goose', rng: makeRng(21) });
  check(m.party().length === 3 && m.find('brian').fixedLevel && m.meter === 30, 'built from state with carryover meter');
  check(m.inventory.find((e) => e.id === 'pizza_slice').qty === pizzaBefore, 'inventory snapshot');
  // Force a clean, deterministic outcome: use a pizza, then KO the goose.
  m.start(); m.advance();
  const lucky = m.find('lucky');
  lucky.hp = 5;
  m.act(lucky.uid, { cmd: 'item', item: 'pizza_slice', target: 'lucky' });
  m.find('goose').drops = [{ item: 'pizza_slice', chance: 1 }];
  m.damage(m.find('goose'), 999, { by: 'lucky' });
  check(m.result === 'win' && m.rewards.xp === 9 && m.rewards.money === 4 && m.rewards.drops.includes('pizza_slice'), `rewards ${JSON.stringify(m.rewards)}`);
  check(m.rewards.levelups.length === 2 && m.rewards.levelups[0].to === 3 && m.rewards.levelups.find((l) => l.who === 'lucky').riffs.includes('Pseudopod Slap'), `level-up events ${JSON.stringify(m.rewards.levelups)}`);
  const moneyBefore = gs.money;
  const summary = applyResults(gs, m);
  check(summary.result === 'win' && gs.money === moneyBefore + 4, 'money applied');
  check(gs.party.level('lucky') === 3 && gs.party.level('phoenix') === 3 && gs.party.level('brian') === 3, 'XP to everyone; Brian stays fixed');
  check(gs.party.get('lucky').hp === gs.party.stats('lucky').maxHp && gs.party.get('lucky').amp === gs.party.stats('lucky').maxAmp, 'level-up restores HP/AMP');
  check(gs.inventory.count('pizza_slice') === pizzaBefore, 'used one pizza, dropped one');
  check(gs.meter === Math.floor(m.meter / 2), `meter carryover ${gs.meter}`);
  check(summary.levelups.some((l) => l.who === 'lucky' && l.riffs.includes('Pseudopod Slap')), 'summary carries new riffs');
  // Lose zeroes the meter; KO persists as hp 0 + KO status.
  const gs2 = new GameState({ characters, items, equipment, start }, null).newGame();
  const m2 = buildBattle({ state: gs2, data, encounterId: 'hub_goose', rng: makeRng(1) });
  m2.start(); m2.damage(m2.find('lucky'), 999, { by: 'goose' });
  applyResults(gs2, m2);
  check(gs2.party.get('lucky').hp === 0 && gs2.party.get('lucky').status.includes('KO') && gs2.meter === 0, 'lose: KO written back, meter 0');
  // Guests are not written back; joined members are added.
  const gs3 = new GameState({ characters, items, equipment, start }, null).newGame();
  const m3 = buildBattle({ state: gs3, data, encounterId: 'ep0_audition', rng: makeRng(1) });
  check(m3.find('ryan') && m3.find('ryan').guest && m3.find('ryan').form === 'possessed' && m3.find('ryan').auto, 'audition adds Ryan as a possessed guest');
  const m4 = buildBattle({ state: gs3, data, encounterId: 'alley_drone', rng: makeRng(1) });
  m4.start(); m4.join(m4.data.makeSeed('phoenix')); m4.damage(m4.find('drone'), 999, { by: 'lucky' });
  applyResults(gs3, m4);
  check(gs3.party.has('phoenix') && gs3.flags.phoenixJoined === true && !gs3.party.has('ryan'), 'Phoenix joined the real party; no Ryan');
});

// ---------------------------------------------------------------------------------------------
group('script: alley_drone (tutorial)', (check) => {
  const m = model({ party: [seed('lucky', 1)], enemyIds: ['drone'], rng: makeRng(4), script: BATTLE_SCRIPTS.ep0_drone(), encounter: { canFlee: false, bailReason: 'Not yet.', script: 'ep0_drone' } });
  m.start();
  check(m.events.some((e) => e.type === 'toast' && /STRUM/.test(e.text)), 'onStart toast');
  const cmds = m.commands('lucky');
  check(cmds.find((c) => c.id === 'riff').reason === 'Not yet.' && !cmds.find((c) => c.id === 'strum').disabled && !cmds.find((c) => c.id === 'tune').disabled, 'round 1: only STRUM and TUNE lit');
  const all = [];
  run(m, (mm, actor) => { all.push(...mm.drain()); return strumPolicy(mm, actor); });
  all.push(...m.drain());
  const join = all.find((e) => e.type === 'join');
  check(join && join.who === 'phoenix', 'Phoenix joins');
  const joinRound = all.slice(0, all.indexOf(join)).filter((e) => e.type === 'round').pop();
  check(joinRound && joinRound.n === 2, `joins on round 2 (round ${joinRound && joinRound.n})`);
  check(all.some((e) => e.type === 'text' && /NONCOMPLIANT/.test(e.text)), 'onHpBelow 50 fired');
  check(all.some((e) => e.type === 'text' && /severance/.test(e.text)), 'onDefeat line');
  check(m.result === 'win' && m.flags.tutorialDone === true && m.round <= 4, `win by round ${m.round}`);
  check(m.find('lucky').hp >= 10, `Lucky survives comfortably (${m.find('lucky').hp}/28)`);
  check(m.rewards.xp === 8 && m.rewards.money === 2, 'drone pays 8 XP, $2');
});

// ---------------------------------------------------------------------------------------------
group('script: ep0_audition', (check) => {
  const party = (l) => [seed('lucky', l), seed('phoenix', l), seed('brian'), seed('ryan', 4, { opts: { form: 'possessed', guest: true } })];
  const enc = { ...encounters.ep0_audition };
  const m = new BattleModel({ encounter: enc, party: party(4), data, rng: makeRng(2024), meter: 0, flags: {}, script: BATTLE_SCRIPTS.ep0_audition(), inventory: [{ id: 'pizza_slice', qty: 2 }], money: 4 });
  const all = [];
  run(m, (mm, actor) => { all.push(...mm.drain()); return smartPolicy(mm, actor); });
  all.push(...m.drain());
  check(m.result === 'win', `audition result ${m.result} at round ${m.round}`);
  check(m.round === 7 || m.living('enemy').length === 0, `ends on round 7 (${m.round}) or both walls down`);
  check(all.some((e) => e.type === 'caption' && /arms belong to the goo/.test(e.text)), 'onStart caption');
  check(all.some((e) => e.type === 'caption' && /Tempo's good/.test(e.text)), 'round 3 caption');
  check(all.some((e) => e.type === 'uiTear' && e.level === 1), 'uiTear 1');
  check(all.some((e) => e.type === 'transform' && e.who === 'ryan'), 'Ryan transforms');
  check(m.flags.auditionWon === true && m.rewards.xp === 50 && m.rewards.money === 0 && m.rewards.drops.includes('tinny_ride_cymbal'), `reward ${JSON.stringify(m.rewards)}`);
  check(m.commands('lucky').find((c) => c.id === 'bail').disabled, 'noFlee');
  check(all.filter((e) => e.type === 'damage' && e.by === 'ryan').length > 0, 'Ryan did damage');
});

// ---------------------------------------------------------------------------------------------
group('script: ep0_rehearsal', (check) => {
  const party = [seed('lucky', 4), seed('phoenix', 4), seed('brian'), seed('ryan', 4, { opts: { form: 'possessed', guest: true } })];
  const m = new BattleModel({ encounter: { ...encounters.ep0_rehearsal }, party, data, rng: makeRng(77), meter: 0, flags: {}, script: BATTLE_SCRIPTS.ep0_rehearsal(), inventory: [], money: 4 });
  const all = [];
  run(m, (mm, actor) => { all.push(...mm.drain()); return smartPolicy(mm, actor); });
  all.push(...m.drain());
  check(m.result === 'win', `rehearsal result ${m.result} round ${m.round}`);
  const word = all.find((e) => e.type === 'word' && e.word === 'kraaang');
  check(!!word, 'ended on KRAAANG');
  check(m.round <= 8, `KRAAANG by round 8 (round ${m.round})`);
  check(hasStatus(m.find('brian'), 'OUT_OF_TUNE'), 'Brian OUT OF TUNE');
  check(all.some((e) => e.type === 'transform' && e.who === 'brian' && /fried/.test(e.sheet)), 'Brian → fried sheet');
  check(all.some((e) => e.type === 'say' && e.who === 'brian' && /normal music/.test(e.text)), "Brian's line");
  check(m.flags.kraaangFired === true && m.rewards.xp === 30, 'flags + 30 XP');
  check(m.find('chorus').hp >= 1, 'the chorus repeats (minHp)');
  // Forced on round 8 when nobody reaches Toon 2 (strum-only, Brian halving): also a win.
  const m2 = new BattleModel({ encounter: { ...encounters.ep0_rehearsal }, party: [seed('lucky', 4), seed('phoenix', 4), seed('brian'), seed('ryan', 4, { opts: { form: 'possessed', guest: true } })], data, rng: makeRng(5), meter: 0, flags: {}, script: BATTLE_SCRIPTS.ep0_rehearsal(), inventory: [], money: 4 });
  const all2 = [];
  run(m2, (mm, actor) => { all2.push(...mm.drain()); return { cmd: 'tune' }; });
  all2.push(...m2.drain());
  check(m2.result === 'win' && m2.round === 8 && all2.some((e) => e.type === 'text' && /links up on its own/.test(e.text)), `forced KRAAANG on round 8 (round ${m2.round})`);
  // Cannot be lost: a wipe fires the forced KRAAANG.
  const m3 = new BattleModel({ encounter: { ...encounters.ep0_rehearsal }, party: [seed('lucky', 4), seed('phoenix', 4), seed('brian')], data, rng: makeRng(5), meter: 0, flags: {}, script: BATTLE_SCRIPTS.ep0_rehearsal(), inventory: [], money: 4 });
  m3.start();
  for (const id of ['lucky', 'phoenix', 'brian']) m3.damage(m3.find(id), 999, { by: 'chorus' });
  check(m3.result === 'win' && m3.flags.kraaangFired, 'wipe → forced KRAAANG → win');
  // Cannot be lost means the band walks out of the rehearsal: a wipe stands everyone back up at 1 HP.
  check(['lucky', 'phoenix', 'brian'].every((id) => !m3.find(id).ko && m3.find(id).hp >= 1), `the wiped band stands back up (${['lucky', 'phoenix', 'brian'].map((id) => `${id}:${m3.find(id).hp}`)})`);
  check(m3.events.filter((e) => e.type === 'status' && e.status === 'KO' && !e.on).length === 3 && m3.events.filter((e) => e.type === 'heal' && e.revive).length === 3, 'three revive events for the scene');
  const st3 = new GameState({ characters, items, equipment, start }, null);
  st3.newGame(); st3.party.add('phoenix'); st3.party.add('brian');
  applyResults(st3, m3);
  check(st3.party.members.every((mm) => mm.hp >= 1 && !mm.status.includes('KO')), `applyResults after the wipe: nobody leaves at 0 HP (${st3.party.members.map((mm) => `${mm.id}:${mm.hp}`)})`);
});

// ---------------------------------------------------------------------------------------------
group('script: ep0_palmers_set', (check) => {
  const party = (l) => [seed('lucky', l), seed('phoenix', l), seed('ryan', 4, { opts: { form: 'pocket', guest: true } })];
  const m = new BattleModel({ encounter: { ...encounters.ep0_palmers_set }, party: party(5), data, rng: makeRng(303), meter: 25, flags: {}, script: BATTLE_SCRIPTS.ep0_palmers_set(), inventory: [], money: 20 });
  const all = [];
  run(m, (mm, actor) => { all.push(...mm.drain()); return smartPolicy(mm, actor); });
  all.push(...m.drain());
  check(m.result === 'win', `palmers result ${m.result} round ${m.round}`);
  check(all.some((e) => e.type === 'status' && e.target === 'cop' && e.status === 'ON_HOLD'), 'cop ON HOLD');
  check(all.some((e) => e.type === 'text' && /front row's hair/.test(e.text)) && all.some((e) => e.type === 'anim' && e.key === 'mohawk_off'), 'mohawk comes off on the first power chord');
  const spawns = all.filter((e) => e.type === 'spawn');
  const spawnRound = all.slice(0, all.indexOf(spawns[0])).filter((e) => e.type === 'round').pop();
  check(spawns.length === 2 && spawnRound && spawnRound.n === 3, `backup ×2 on round 3 (${spawns.length}, round ${spawnRound && spawnRound.n})`);
  check(m.flags.eternityArmed === true && m.flags.eternityFired === true, 'armed and fired');
  const armIdx = all.findIndex((e) => e.type === 'lockInput' && e.on);
  const armRound = all.slice(0, armIdx).filter((e) => e.type === 'round').pop();
  check(armRound && armRound.n <= 6, `armed by round 6 (round ${armRound && armRound.n})`);
  const words = all.filter((e) => e.type === 'word' && e.scripted).map((e) => e.word);
  check(JSON.stringify(words) === JSON.stringify(['doom', 'crack', 'thud']), `the three words in order (${words})`);
  check(all.filter((e) => e.type === 'wait' && e.ms === 900).length === 3, 'three 900 ms waits');
  check(all.some((e) => e.type === 'damage' && e.amount === 999 && e.scripted) || all.some((e) => e.type === 'damage' && e.scripted && e.target === 'cop'), 'DOOM damage 999');
  check(all.some((e) => e.type === 'background' && e.id === 'palmers_roof_peel'), 'CRACK peels the roof');
  check(all.some((e) => e.type === 'shake' && e.ms === 1200), 'THUD shakes 1200');
  check(all.some((e) => e.type === 'transform' && e.who === 'ryan' && e.form === 'eternity' && e.size === 64), 'Ryan → The Eternity 64 px');
  check(m.meter === 100 && m.toonLevel === 4, 'meter 100 = Toon 4');
  check(all.some((e) => e.type === 'caption' && /Rhythm achieved/.test(e.text)), 'Rhythm achieved');
  check(m.rewards.xp === 100 && m.rewards.money === 0 && m.rewards.drops.includes('price_tag_jacket'), `reward ${JSON.stringify(m.rewards)}`);
  check(m.enemies().every((c) => c.ko || c.fled), 'cops gone');
  // Cops flee instead of dying before the Eternity; the last one gone holds the win and arms it.
  const m2 = new BattleModel({ encounterId: 'ep0_palmers_set', encounter: { ...encounters.ep0_palmers_set }, party: party(5), data, rng: makeRng(1), meter: 25, flags: {}, script: BATTLE_SCRIPTS.ep0_palmers_set(), inventory: [], money: 0 });
  m2.start();
  m2.damage(m2.find('cop'), 999, { by: 'lucky' });
  check(m2.find('cop').fled && !m2.find('cop').ko && m2.events.some((e) => e.type === 'leave' && e.who === 'cop'), 'cop crawls toward the exit');
  check(m2.result === null && m2.suspendEnd === true && m2.flags.eternityArmed === true && m2.inputLocked && m2.invincible, `last cop gone: win held, armed (result ${m2.result}, suspend ${m2.suspendEnd}, armed ${m2.flags.eternityArmed})`);
  const m2Round = m2.round;
  run(m2, smartPolicy);
  const m2Words = m2.events.filter((e) => e.type === 'word' && e.scripted).map((e) => e.word);
  check(m2.result === 'win' && m2.flags.eternityFired === true && JSON.stringify(m2Words) === JSON.stringify(['doom', 'crack', 'thud']), `the Eternity still fires on Ryan's next turn (${m2.result}, round ${m2Round} → ${m2.round}, words ${m2Words})`);
  check(m2.round <= m2Round + 1 && m2.rewards && m2.rewards.xp === 100 && m2.rewards.drops.includes('price_tag_jacket'), `Ryan's next turn, with the reward (${m2.round}, ${JSON.stringify(m2.rewards)})`);
  // The same hold when a KRAAANG knocks the last backup off-panel (no onDefeat on that path).
  const m3 = new BattleModel({ encounterId: 'ep0_palmers_set', encounter: { ...encounters.ep0_palmers_set }, party: party(5), data, rng: knockRng, meter: 25, flags: {}, script: BATTLE_SCRIPTS.ep0_palmers_set(), inventory: [], money: 0 });
  m3.start();
  m3.spawn('backup_cop'); m3.spawn('backup_cop');
  m3.damage(m3.find('cop'), 999, { by: 'lucky' });
  check(m3.find('cop').fled && m3.result === null && !m3.suspendEnd && !m3.flags.eternityArmed, 'the cop leaving with backups on stage does not arm');
  m3.forceNoise('kraaang', 'lucky');
  check(m3.enemies().filter((c) => c.offPanel).length === 2 && m3.living('enemy').length === 0, `KRAAANG knocks both backups off-panel (${m3.enemies().map((c) => `${c.uid}:${c.offPanel ? 'off' : c.fled ? 'fled' : c.hp}`)})`);
  check(m3.result === null && m3.suspendEnd === true && m3.flags.eternityArmed === true, `off-panel last cop: win held, armed (result ${m3.result})`);
  run(m3, smartPolicy);
  check(m3.result === 'win' && m3.flags.eternityFired === true, `the Eternity fires after the knock-off (${m3.result}, fired ${m3.flags.eternityFired})`);
});

// ---------------------------------------------------------------------------------------------
group('monte carlo: the Eternity is unskippable', (check) => {
  // Before the hold (onLeave → suspendEnd + arm) a party that cleared the cop and both backups before round 6
  // won THE SET without the finale: 400 seeds at L5 skipped it in 5% of wins with the chapter1 brain and 25%
  // with smartPolicy (L6: 21% / 62%). Every win must now fire it, and the win rate must not drop below what
  // those same seeds gave before the hold (100% at L4-6 with both policies).
  const RUNS = Number(process.env.MC_ETERNITY_RUNS || 300);
  const BASELINE_WIN = { 4: 100, 5: 100, 6: 100 };
  const build = (l) => (rng) => new BattleModel({ encounterId: 'ep0_palmers_set', encounter: { ...encounters.ep0_palmers_set }, party: [seed('lucky', l), seed('phoenix', l), seed('ryan', 4, { opts: { form: 'pocket', guest: true } })], data, rng, meter: 25, flags: {}, script: BATTLE_SCRIPTS.ep0_palmers_set(), inventory: [], money: 20 });
  for (const [pname, policy] of [['chapter1', chapter1Policy], ['smart', smartPolicy]]) {
    for (const l of [4, 5, 6]) {
      let wins = 0; let skipped = 0; let heldByLeave = 0; let rounds = 0;
      for (let i = 0; i < RUNS; i++) {
        const m = build(l)(makeRng(1000 + i));
        try { run(m, policy, { maxRounds: 40 }); } catch (err) { throw new Error(`eternity ${pname} L${l} run ${i}: ${err.message}`); }
        if (m.result === 'win') {
          wins++; rounds += m.round;
          if (!m.flags.eternityFired || !m.flags.eternityArmed) skipped++;
          const armIdx = m.events.findIndex((e) => e.type === 'lockInput' && e.on);
          const lastLeave = m.events.map((e, idx) => (e.type === 'leave' ? idx : -1)).filter((idx) => idx >= 0).pop();
          if (armIdx >= 0 && lastLeave !== undefined && lastLeave < armIdx && m.events.slice(lastLeave, armIdx).every((e) => e.type !== 'round')) heldByLeave++;
        }
      }
      const winPct = Math.round((wins * 100) / RUNS);
      process.stdout.write(`${JSON.stringify({ test: 'monte-carlo-eternity', policy: pname, level: l, runs: RUNS, winPct, skipped, heldByLeave, avgRound: wins ? +(rounds / wins).toFixed(1) : null })}\n`);
      check(skipped === 0, `${pname} L${l}: ${skipped} of ${wins} wins skipped the Eternity`);
      check(winPct >= BASELINE_WIN[l], `${pname} L${l}: win rate ${winPct}% below the pre-hold ${BASELINE_WIN[l]}%`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
group('monte carlo', (check) => {
  const RUNS = Number(process.env.MC_RUNS || 200);
  const cell = (name, build, policy = smartPolicy) => {
    let wins = 0; let rounds = 0; let hpLeft = 0; let armedRounds = 0;
    for (let i = 0; i < RUNS; i++) {
      const m = build(makeRng(1000 + i));
      try { run(m, policy, { maxRounds: 40 }); } catch (err) { throw new Error(`${name} run ${i}: ${err.message}`); }
      if (m.result === 'win') { wins++; rounds += m.round; const l = m.find('lucky'); hpLeft += l.ko ? 0 : l.hp; }
      if (m.flags.eternityArmed) armedRounds += m.round;
    }
    const out = { cell: name, runs: RUNS, winPct: Math.round((wins * 100) / RUNS), avgRound: wins ? +(rounds / wins).toFixed(1) : null, avgLuckyHp: wins ? Math.round(hpLeft / wins) : null };
    process.stdout.write(`${JSON.stringify({ test: 'monte-carlo', ...out })}\n`);
    return out;
  };
  const audition = (l, inv) => (rng) => new BattleModel({ encounter: { ...encounters.ep0_audition }, party: [seed('lucky', l), seed('phoenix', l), seed('brian'), seed('ryan', 4, { opts: { form: 'possessed', guest: true } })], data, rng, meter: 0, flags: {}, script: BATTLE_SCRIPTS.ep0_audition(), inventory: inv, money: 4 });
  const palmers = (l) => (rng) => new BattleModel({ encounter: { ...encounters.ep0_palmers_set }, party: [seed('lucky', l), seed('phoenix', l), seed('ryan', 4, { opts: { form: 'pocket', guest: true } })], data, rng, meter: 25, flags: {}, script: BATTLE_SCRIPTS.ep0_palmers_set(), inventory: [], money: 20 });
  const a2 = cell('audition L2 no items, STRUM only', audition(2, []), strumPolicy);
  const a3 = cell('audition L3 + 2 pizza', audition(3, [{ id: 'pizza_slice', qty: 2 }]));
  const a4 = cell('audition L4 + 2 pizza', audition(4, [{ id: 'pizza_slice', qty: 2 }]));
  const p4 = cell('palmers L4', palmers(4));
  const p5 = cell('palmers L5', palmers(5));
  const p6 = cell('palmers L6', palmers(6));
  check(a4.winPct >= 70, `audition L4 win rate ${a4.winPct}% (design: a L3-4 party with one heal should usually survive)`);
  check(a3.winPct >= 45, `audition L3 win rate ${a3.winPct}%`);
  check(a2.winPct <= 95, `audition L2 no-items should be the risky case (${a2.winPct}%)`);
  check(p5.winPct >= 85, `palmers L5 win rate ${p5.winPct}% (design: L5 comfortable)`);
  check(p4.winPct >= 40, `palmers L4 win rate ${p4.winPct}% (design: L4 is meant to sweat)`);
  check(p6.winPct >= p4.winPct, 'higher level never worse');
});

process.stdout.write(`${JSON.stringify({ test: 'battle.test', ok: failures === 0, checks: total, failures })}\n`);
process.exit(failures === 0 ? 0 : 1);
