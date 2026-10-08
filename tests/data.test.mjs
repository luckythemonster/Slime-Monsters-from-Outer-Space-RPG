#!/usr/bin/env node
// Pure-Node unit + data-contract tests (no Phaser, no browser). Prints one JSON line per group
// and a final summary line; exits non-zero on any failure.
//
//   node tests/data.test.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluate, evaluateWith, tokenize } from '../src/engine/Conditions.js';
import { Party } from '../src/engine/Party.js';
import { Inventory } from '../src/engine/Inventory.js';
import { GameState } from '../src/engine/GameState.js';
import { COMMANDS } from '../src/engine/EventRunner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src', 'data');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const characters = readJson(path.join(DATA, 'characters.json'));
const items = readJson(path.join(DATA, 'items.json'));
const equipment = readJson(path.join(DATA, 'equipment.json'));
const enemies = readJson(path.join(DATA, 'enemies.json'));
const encounters = readJson(path.join(DATA, 'encounters.json'));
const start = readJson(path.join(DATA, 'start.json'));
const manifestPath = path.join(ROOT, 'assets', 'generated', 'manifest.json');
const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;

const maps = {};
for (const f of readdirSync(path.join(DATA, 'maps')).filter((n) => n.endsWith('.json'))) {
  maps[f.replace(/\.json$/, '')] = readJson(path.join(DATA, 'maps', f));
}
const scripts = {};
const scriptOwner = {};
for (const f of readdirSync(path.join(DATA, 'scripts')).filter((n) => n.endsWith('.json'))) {
  const table = readJson(path.join(DATA, 'scripts', f));
  for (const [id, cmds] of Object.entries(table)) {
    if (scripts[id]) throw new Error(`duplicate script id "${id}" in ${f} and ${scriptOwner[id]}`);
    scripts[id] = cmds;
    scriptOwner[id] = f;
  }
}

let failures = 0;
let total = 0;
function group(name, fn) {
  const errors = [];
  const check = (cond, msg) => { total++; if (!cond) { errors.push(msg); failures++; } };
  try { fn(check); } catch (err) { errors.push(`threw: ${err && err.stack ? err.stack : err}`); failures++; }
  process.stdout.write(`${JSON.stringify({ test: name, ok: errors.length === 0, errors })}\n`);
}

// ---------------------------------------------------------------------------------------------
group('conditions', (check) => {
  const state = new GameState({ characters, items, equipment, start }, null).newGame();
  state.flags.metPhoenix = true;
  state.vars.coffeeCount = 2;
  state.money = 4;
  state.inventory.add('coffee', 2);
  const cases = [
    ['flags.metPhoenix', true],
    ['!flags.metPhoenix', false],
    ['!flags.unset', true],
    ['flags.unset', false],
    ['vars.coffeeCount == 2', true],
    ['vars.coffeeCount != 2', false],
    ['vars.coffeeCount >= 2 && money < 5', true],
    ['vars.coffeeCount > 2 || money == 4', true],
    ['!(money == 4) || flags.metPhoenix && vars.coffeeCount < 1', false],
    ['1 + 2 - 1 == 2', true],
    ['money + vars.coffeeCount >= 6', true],
    ["party.has('lucky')", true],
    ["party.has('ryan')", false],
    ["!party.has('ryan') && party.size == 1", true],
    ["inventory.count('coffee') >= 2", true],
    ["inventory.has('pizza_slice')", true],
    ["inventory.count('nope') == 0", true],
    ["level('lucky') == 1", true],
    ["level('phoenix') == 0", true],
    ["'a' == 'a' && 'a' != 'b'", true],
    ['-1 < 0', true],
    ['!!flags.metPhoenix', true],
    ['(1 + 1) == 2 && !(2 > 3)', true],
    ['', true],
  ];
  for (const [expr, want] of cases) {
    const got = evaluate(expr, state);
    check(got === want, `evaluate(${JSON.stringify(expr)}) = ${got}, want ${want}`);
  }
  check(evaluateWith('a.b.c', { a: { b: { c: 7 } } }) === 7, 'nested path');
  check(tokenize("x >= 'it\\'s'").length === 3, 'escaped quote tokenizes');
  let threw = false;
  try { evaluate('flags.a &&', state); } catch { threw = true; }
  check(threw, 'syntax error throws');
  threw = false;
  try { evaluate('flags.a $ 1', state); } catch { threw = true; }
  check(threw, 'bad char throws');
});

// ---------------------------------------------------------------------------------------------
group('party', (check) => {
  const party = new Party(characters, equipment);
  const m = party.add('lucky');
  check(party.size === 1 && party.has('lucky'), 'add/has');
  const s1 = party.stats('lucky');
  check(s1.atk === characters.characters.lucky.stats.atk + equipment.beatup_guitar.bonus.atk, `equipment bonus applied: atk ${s1.atk}`);
  check(m.hp === s1.maxHp && m.amp === s1.maxAmp, 'joins at full HP/AMP');
  check(party.addXp('lucky', 5) === null, 'no level-up below threshold');
  const up = party.addXp('lucky', 5); // total 10 → level 2
  check(up && up.from === 1 && up.to === 2, `level up to 2: ${JSON.stringify(up)}`);
  check(party.level('lucky') === 2, 'level() reflects');
  check(party.stats('lucky').hp === s1.hp + characters.characters.lucky.growth.hp, 'hp growth');
  const big = party.addXp('lucky', 60); // total 70 → level 5
  check(big && big.to === 5, `multi level-up: ${JSON.stringify(big)}`);
  check(party.xpToNext('lucky') === characters.xpTable[5] - 70, 'xpToNext');
  m.hp = 1;
  party.healAll();
  check(m.hp === party.stats('lucky').maxHp, 'healAll');
  const d = party.heal('lucky', { hp: 999 });
  check(d.hp === 0, 'heal clamps');
  party.add('phoenix');
  check(party.roster.length === 2 && party.remove('phoenix') && party.size === 1 && party.roster.length === 2, 'remove keeps roster');
  check(party.remove('nobody') === false, 'remove unknown');
  const json = party.toJSON();
  const p2 = new Party(characters, equipment);
  p2.fromJSON(json, party.roster);
  check(JSON.stringify(p2.toJSON()) === JSON.stringify(json), 'party round trip');
  let threw = false;
  try { party.add('nobody'); } catch { threw = true; }
  check(threw, 'add unknown throws');
});

// ---------------------------------------------------------------------------------------------
group('inventory', (check) => {
  const inv = new Inventory(items);
  check(inv.count('pizza_slice') === 0 && !inv.has('pizza_slice'), 'empty');
  inv.add('pizza_slice', 2);
  inv.add('pizza_slice');
  check(inv.count('pizza_slice') === 3, 'stacks');
  check(inv.remove('pizza_slice', 5) === false && inv.count('pizza_slice') === 3, 'remove too many fails');
  check(inv.remove('pizza_slice', 3) === true && inv.count('pizza_slice') === 0 && inv.entries.length === 0, 'remove all clears entry');
  let threw = false;
  try { inv.add('nope'); } catch { threw = true; }
  check(threw, 'unknown item throws');
  inv.add('coffee', 1);
  check(inv.list()[0].def.name === 'Coffee', 'list attaches def');
  check(inv.consumables().length === 1, 'consumables');
});

// ---------------------------------------------------------------------------------------------
group('gamestate', (check) => {
  const store = new Map();
  const fakeStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const gs = new GameState({ characters, items, equipment, start }, fakeStorage);
  check(gs.hasSave(1) === false, 'no save initially');
  gs.newGame();
  check(gs.map === start.map && gs.x === start.x && gs.party.has('lucky'), 'newGame seeds from start.json');
  gs.set('flags.metPhoenix', true);
  gs.inc('vars.coffeeCount', 2);
  gs.inc('vars.coffeeCount');
  gs.addMoney(10);
  gs.inventory.add('coffee', 2);
  gs.party.addXp('lucky', 25);
  gs.setPosition('dev_street', 5, 6, 'up');
  gs.tick(1234.5);
  const saved = gs.save(1);
  check(gs.hasSave(1) && store.has('smfos.save.1'), 'save writes smfos.save.1');
  check(saved.version === 1 && saved.map === 'dev_street' && saved.flags.metPhoenix === true && saved.vars.coffeeCount === 3, 'save shape');
  check(Array.isArray(saved.party) && saved.party[0].id === 'lucky' && saved.party[0].level === 3, 'party in save');
  check(Array.isArray(saved.roster) && Array.isArray(saved.inventory) && typeof saved.savedAt === 'string', 'roster/inventory/savedAt');
  const gs2 = new GameState({ characters, items, equipment, start }, fakeStorage);
  check(gs2.load(1) === true, 'load');
  const a = gs.snapshot(); const b = gs2.snapshot();
  check(JSON.stringify(a) === JSON.stringify(b), `round trip snapshot equal\n${JSON.stringify(a)}\n${JSON.stringify(b)}`);
  check(gs2.playtimeMs === 1235 || gs2.playtimeMs === 1234, 'playtime persists (rounded)');
  check(gs2.load(2) === false, 'load empty slot false');
  check(gs.peekSave(1).map === 'dev_street', 'peekSave');
  gs.deleteSave(1);
  check(!gs.hasSave(1), 'deleteSave');
  check(gs.spendMoney(999) === false && gs.spendMoney(4) === true && gs.money === 10, 'spendMoney');
});

// ---------------------------------------------------------------------------------------------
group('manifest', (check) => {
  check(manifest !== null, `manifest missing at ${manifestPath} (run python3 tools/gen_assets.py)`);
  if (!manifest) return;
  for (const [id, c] of Object.entries(characters.characters)) {
    check(!!manifest[c.sprite] && manifest[c.sprite].type === 'spritesheet', `character ${id} sprite "${c.sprite}" in manifest`);
    const anims = (manifest[c.sprite] && manifest[c.sprite].anims || []).map((a) => a.key);
    for (const need of ['walk_down', 'walk_up', 'walk_left', 'idle_down']) {
      check(anims.includes(need), `sheet ${c.sprite} has anim ${need}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
group('maps', (check) => {
  check(!!maps[start.map], `start map "${start.map}" exists`);
  const VALID_TYPES = ['npc', 'object', 'exit', 'trigger', 'enemy', 'save'];
  for (const [id, m] of Object.entries(maps)) {
    check(m.id === id, `map ${id}: id matches filename`);
    const ground = m.layers && m.layers.ground;
    check(Array.isArray(ground) && ground.length > 0, `map ${id}: ground layer`);
    if (!ground) continue;
    const h = ground.length; const w = ground[0].length;
    const tileset = manifest ? manifest[m.tileset] : null;
    if (manifest) check(!!tileset && tileset.type === 'tileset', `map ${id}: tileset "${m.tileset}" in manifest`);
    for (const [ch, name] of Object.entries(m.legend)) {
      check(ch.length === 1 && ch !== ' ', `map ${id}: legend key "${ch}" is one non-space char`);
      if (tileset) check(!!tileset.tiles[name], `map ${id}: legend "${ch}" → tile "${name}" exists in tileset ${m.tileset}`);
    }
    for (const [layerName, rows] of Object.entries(m.layers)) {
      check(['ground', 'deco', 'over'].includes(layerName), `map ${id}: layer "${layerName}" known`);
      check(rows.length === h, `map ${id}: layer ${layerName} has ${h} rows`);
      rows.forEach((row, y) => {
        check(row.length === w, `map ${id}: layer ${layerName} row ${y} width ${row.length} != ${w}`);
        for (const ch of row) check(ch === ' ' || !!m.legend[ch], `map ${id}: layer ${layerName} row ${y} char "${ch}" not in legend`);
      });
    }
    check(m.spawn && m.spawn.x >= 0 && m.spawn.x < w && m.spawn.y >= 0 && m.spawn.y < h, `map ${id}: spawn in bounds`);
    for (const hook of ['onEnter', 'onFirstEnter']) if (m[hook]) check(!!scripts[m[hook]], `map ${id}: ${hook} script "${m[hook]}" exists`);
    const ids = new Set();
    for (const e of m.entities || []) {
      check(!ids.has(e.id), `map ${id}: duplicate entity id ${e.id}`); ids.add(e.id);
      check(VALID_TYPES.includes(e.type), `map ${id}/${e.id}: type "${e.type}"`);
      check(e.x >= 0 && e.x < w && e.y >= 0 && e.y < h, `map ${id}/${e.id}: in bounds`);
      if (e.script) check(!!scripts[e.script], `map ${id}/${e.id}: script "${e.script}" exists`);
      if (e.onDefeat) check(!!scripts[e.onDefeat], `map ${id}/${e.id}: onDefeat script exists`);
      if (e.sprite && manifest) check(!!manifest[e.sprite], `map ${id}/${e.id}: sprite "${e.sprite}" in manifest`);
      if (['npc', 'enemy', 'save'].includes(e.type)) check(!!e.sprite, `map ${id}/${e.id}: ${e.type} needs a sprite`);
      if (e.type === 'exit') {
        check(e.to && !!maps[e.to.map], `map ${id}/${e.id}: exit target map "${e.to && e.to.map}" exists`);
        const t = e.to && maps[e.to.map];
        if (t) check(e.to.x >= 0 && e.to.x < t.layers.ground[0].length && e.to.y >= 0 && e.to.y < t.layers.ground.length, `map ${id}/${e.id}: exit target in bounds`);
      }
      if (e.type === 'trigger') check(!!e.script, `map ${id}/${e.id}: trigger needs script`);
      if (e.type === 'enemy') check(!!encounters[e.encounter], `map ${id}/${e.id}: encounter "${e.encounter}" exists`);
      if (e.behavior) check(['idle', 'wander', 'patrol', 'chase', 'static'].includes(e.behavior), `map ${id}/${e.id}: behavior "${e.behavior}"`);
      if (e.behavior === 'patrol') check(typeof e.path === 'string' && /^[UDLR.]+$/.test(e.path), `map ${id}/${e.id}: patrol path`);
      if (e.condition) {
        try { tokenize(e.condition); } catch (err) { check(false, `map ${id}/${e.id}: condition parse: ${err.message}`); }
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
group('encounters', (check) => {
  for (const [id, enc] of Object.entries(encounters)) {
    check(Array.isArray(enc.enemies) && enc.enemies.length > 0, `encounter ${id}: enemies`);
    for (const e of enc.enemies || []) check(!!enemies[e], `encounter ${id}: enemy "${e}" exists`);
  }
  for (const [id, e] of Object.entries(enemies)) {
    check(e.stats && e.stats.hp > 0, `enemy ${id}: stats.hp`);
    for (const d of e.drops || []) check(!!items[d.item], `enemy ${id}: drop item "${d.item}" exists`);
  }
});

// ---------------------------------------------------------------------------------------------
group('scripts', (check) => {
  const WHO_OK = new Set(['narrator', 'ryan_caption', 'player', ...Object.keys(characters.characters)]);
  const walk = (cmds, sid, labels) => {
    check(Array.isArray(cmds), `script ${sid}: commands array`);
    for (const cmd of cmds || []) {
      const keys = Object.keys(cmd).filter((k) => COMMANDS.has(k));
      check(keys.length === 1, `script ${sid}: command ${JSON.stringify(cmd)} has exactly one known command key (found ${keys.join(',')})`);
      const k = keys[0];
      if (k === 'say' && cmd.who) check(WHO_OK.has(cmd.who), `script ${sid}: say who "${cmd.who}" unknown`);
      if (k === 'choice') for (const opt of cmd.choice) { check(typeof opt.text === 'string', `script ${sid}: choice text`); walk(opt.then || [], sid, labels); }
      if (k === 'if') { try { tokenize(cmd.if); } catch (err) { check(false, `script ${sid}: if parse: ${err.message}`); } walk(cmd.then || [], sid, labels); walk(cmd.else || [], sid, labels); }
      if (k === 'give' || k === 'take') { if (cmd[k].item) check(!!items[cmd[k].item] || !!equipment[cmd[k].item], `script ${sid}: ${k} item "${cmd[k].item}" exists`); }
      if (k === 'party' && cmd.party.add) check(!!characters.characters[cmd.party.add], `script ${sid}: party.add "${cmd.party.add}" exists`);
      if (k === 'move') check(/^[UDLR.]+$/.test(cmd.move.path || ''), `script ${sid}: move path "${cmd.move.path}"`);
      if (k === 'teleport') check(!!maps[cmd.teleport.map], `script ${sid}: teleport map "${cmd.teleport.map}" exists`);
      if (k === 'battle') {
        check(!!encounters[cmd.battle], `script ${sid}: battle encounter "${cmd.battle}" exists`);
        if (Array.isArray(cmd.onWin)) walk(cmd.onWin, sid, labels);
        if (Array.isArray(cmd.onLose)) walk(cmd.onLose, sid, labels);
      }
      if (k === 'run') check(!!scripts[cmd.run], `script ${sid}: run "${cmd.run}" exists`);
      if (k === 'goto') check(labels.has(cmd.goto), `script ${sid}: goto label "${cmd.goto}" exists`);
      if (k === 'spawn' && manifest) check(!!manifest[cmd.spawn.sprite], `script ${sid}: spawn sprite "${cmd.spawn.sprite}" in manifest`);
      if (k === 'sprite' && manifest) check(!!manifest[cmd.sprite.sheet], `script ${sid}: sprite sheet "${cmd.sprite.sheet}" in manifest`);
      if (k === 'scene') check(['freefall'].includes(cmd.scene), `script ${sid}: scene "${cmd.scene}"`);
    }
  };
  for (const [sid, cmds] of Object.entries(scripts)) {
    const labels = new Set((cmds || []).filter((c) => c.label).map((c) => c.label));
    walk(cmds, sid, labels);
  }
  check(Object.keys(scripts).length > 0, 'at least one script');
});

process.stdout.write(`${JSON.stringify({ test: 'data.test', ok: failures === 0, checks: total, failures })}\n`);
process.exit(failures === 0 ? 0 : 1);
