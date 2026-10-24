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
import { COMMANDS, EventRunner, PROMPT_COLS, isExpression, resolveValue } from '../src/engine/EventRunner.js';
import { services } from '../src/engine/services.js';
import { wrapWords } from '../src/ui/theme.js';
import { expandVars } from '../src/engine/TextVars.js';
import { normalizeShop, stockFor, sellPrice, buyPrice } from '../src/engine/Shop.js';

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
const devManifestPath = path.join(ROOT, 'assets', 'generated', '_dev_manifest.json');
// Same merge as src/engine/Data.js: the art agent's manifest wins; _dev_manifest.json only fills gaps.
const manifest = existsSync(manifestPath)
  ? { ...(existsSync(devManifestPath) ? readJson(devManifestPath) : {}), ...readJson(manifestPath) }
  : null;

const maps = {};
for (const f of readdirSync(path.join(DATA, 'maps')).filter((n) => n.endsWith('.json'))) {
  maps[f.replace(/\.json$/, '')] = readJson(path.join(DATA, 'maps', f));
}
// Speaker registry (DESIGN.md E10/E11): src/data/npcs/*.json, merged like src/engine/Data.js.
const npcs = {};
const npcOwner = {};
const npcDir = path.join(DATA, 'npcs');
const npcDupes = [];
if (existsSync(npcDir)) {
  for (const f of readdirSync(npcDir).filter((n) => n.endsWith('.json'))) {
    const table = readJson(path.join(npcDir, f));
    for (const [id, def] of Object.entries(table || {})) {
      if (npcs[id]) npcDupes.push(`speaker "${id}" in ${f} and ${npcOwner[id]}`);
      npcs[id] = def;
      npcOwner[id] = f;
    }
  }
}
const shops = existsSync(path.join(DATA, 'shops.json')) ? readJson(path.join(DATA, 'shops.json')) : {};

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
  state.inventory.add('pizza_slice', 1); // start.json no longer seeds one
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
  const big = party.addXp('lucky', 75); // total 85 → level 5 (DESIGN.md XP table: 0 10 24 48 85 …)
  check(big && big.to === 5, `multi level-up: ${JSON.stringify(big)}`);
  check(party.xpToNext('lucky') === characters.xpTable[5] - 85, 'xpToNext');
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
    const anims = (manifest[c.sprite] && manifest[c.sprite].anims || []).map((a) => a.key.replace(new RegExp(`^${c.sprite}_`), ''));
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
    for (const hook of ['onEnter', 'onFirstEnter']) {
      if (!m[hook]) continue;
      const entries = Array.isArray(m[hook]) ? m[hook] : [m[hook]];
      for (const en of entries) {
        const sid = typeof en === 'string' ? en : en && en.script;
        check(!!scripts[sid], `map ${id}: ${hook} script "${sid}" exists`);
        if (en && typeof en === 'object' && en.condition) { try { tokenize(en.condition); } catch (err) { check(false, `map ${id}: ${hook} condition parse: ${err.message}`); } }
      }
    }
    if (m.overlay) {
      check(typeof m.overlay.color === 'string' && /^#?[0-9a-f]{6}$/i.test(m.overlay.color), `map ${id}: overlay color "${m.overlay.color}"`);
      if (m.overlay.alpha !== undefined) check(m.overlay.alpha >= 0 && m.overlay.alpha <= 1, `map ${id}: overlay alpha in 0..1`);
      if (m.overlay.condition) { try { tokenize(m.overlay.condition); } catch (err) { check(false, `map ${id}: overlay condition parse: ${err.message}`); } }
    }
    for (const l of m.lights || []) {
      check(Number.isInteger(l.x) && Number.isInteger(l.y) && l.x >= 0 && l.x < w && l.y >= 0 && l.y < h, `map ${id}: light at ${l.x},${l.y} in bounds`);
      if (l.condition) { try { tokenize(l.condition); } catch (err) { check(false, `map ${id}: light condition parse: ${err.message}`); } }
    }
    if (m.followers !== undefined) check(typeof m.followers === 'boolean', `map ${id}: followers is a boolean`);
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
      if (e.w !== undefined) check(Number.isInteger(e.w) && e.w >= 1 && e.x + e.w <= w, `map ${id}/${e.id}: w ${e.w} fits the map`);
      if (e.footprint !== undefined) check(Array.isArray(e.footprint) && e.footprint.length === 2 && e.footprint.every((n) => Number.isInteger(n) && n >= 1), `map ${id}/${e.id}: footprint [w,h]`);
      if (e.type === 'save' && e.prompt !== undefined) check(typeof e.prompt === 'string', `map ${id}/${e.id}: save prompt is a string`);
      if (e.condition) {
        try { tokenize(e.condition); } catch (err) { check(false, `map ${id}/${e.id}: condition parse: ${err.message}`); }
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
group('riffs', (check) => {
  // The pause menu's RIFFS screen and the battle RIFF list both resolve characters.json riff ids through riffs.json.
  const riffs = readJson(path.join(DATA, 'riffs.json'));
  for (const [id, c] of Object.entries(characters.characters)) {
    for (const rid of c.riffs || []) check(!!riffs[rid] && typeof riffs[rid].name === 'string', `character ${id}: riff "${rid}" has a riffs.json entry with a name`);
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
  const WHO_OK = new Set(['narrator', 'ryan_caption', 'player', ...Object.keys(characters.characters), ...Object.keys(npcs)]);
  const CAPTION_STYLES = new Set(['plain', 'tape', 'flyer']);
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
      if (k === 'caption' && cmd.style !== undefined) check(CAPTION_STYLES.has(cmd.style), `script ${sid}: caption style "${cmd.style}"`);
      if (k === 'insert') {
        const ins = typeof cmd.insert === 'string' ? { sprite: cmd.insert } : cmd.insert;
        check(ins && typeof ins.sprite === 'string', `script ${sid}: insert needs a sprite`);
        if (ins && ins.sprite && manifest && !manifest[ins.sprite]) process.stderr.write(`[data] note: script ${sid}: insert sprite "${ins.sprite}" not in manifest yet (placeholder will show)\n`);
      }
      if (k === 'save' && cmd.save && typeof cmd.save === 'object') check(cmd.save.auto === true || typeof cmd.save.prompt === 'string', `script ${sid}: save needs {auto:true} or {prompt}`);
      if (k === 'shop') check(!!shops[cmd.shop], `script ${sid}: shop "${cmd.shop}" exists in shops.json`);
      if (k === 'set') for (const [, v] of Object.entries(cmd.set)) if (typeof v === 'string' && isExpression(v)) { try { tokenize(v); } catch (err) { check(false, `script ${sid}: set expression "${v}": ${err.message}`); } }
    }
  };
  for (const [sid, cmds] of Object.entries(scripts)) {
    const labels = new Set((cmds || []).filter((c) => c.label).map((c) => c.label));
    walk(cmds, sid, labels);
  }
  check(Object.keys(scripts).length > 0, 'at least one script');
  // Captions have no wrap: each '\n'-separated line must fit its card (tape: 30 + 8n + 16 + the 6 px tape
  // overhang <= 256 -> 25 cols; flyer: 10 px pitch inside a 248 px card -> 23; plain: 8n <= 256 -> 32).
  const CAPTION_COLS = { tape: 25, flyer: 23, plain: 32 };
  const captions = (cmds, sid) => {
    for (const cmd of cmds || []) {
      if (cmd.caption !== undefined) {
        const style = cmd.style || 'plain';
        for (const line of String(cmd.caption).split('\n')) check(line.length <= CAPTION_COLS[style], `script ${sid}: ${style} caption line "${line}" is ${line.length} > ${CAPTION_COLS[style]} cols`);
      }
      if (cmd.save && typeof cmd.save === 'object' && typeof cmd.save.prompt === 'string') check(wrapWords(cmd.save.prompt, PROMPT_COLS).length <= 2, `script ${sid}: save prompt "${cmd.save.prompt}" needs more than two ${PROMPT_COLS}-col rows`);
      if (cmd.then) captions(cmd.then, sid);
      if (cmd.else) captions(cmd.else, sid);
      if (cmd.onWin) captions(cmd.onWin, sid);
      if (cmd.onLose) captions(cmd.onLose, sid);
      if (cmd.choice) for (const opt of cmd.choice) captions(opt.then || [], sid);
    }
  };
  for (const [sid, cmds] of Object.entries(scripts)) captions(cmds, sid);
  for (const [id, m] of Object.entries(maps)) for (const e of m.entities || []) if (e.type === 'save' && typeof e.prompt === 'string') check(wrapWords(e.prompt, PROMPT_COLS).length <= 2, `map ${id}/${e.id}: save prompt needs more than two rows`);
});

// ---------------------------------------------------------------------------------------------
group('eventrunner', (check) => {
  // {"music"} hands AudioEngine a fade in SECONDS (ARCHITECTURE §7); 300 would be a five-minute ramp.
  const calls = [];
  const saved = services.audio;
  services.audio = { playMusic: (id, o) => calls.push(['play', id, o]), stopMusic: (o) => calls.push(['stop', null, o]) };
  try {
    const runner = new EventRunner({ scripts: {}, state: {}, explore: {}, characters: {} });
    runner.cmd_music('snow');
    runner.cmd_music(null);
  } finally {
    services.audio = saved;
  }
  check(calls.length === 2 && calls[0][0] === 'play' && calls[0][1] === 'snow' && calls[1][0] === 'stop', `music calls ${JSON.stringify(calls)}`);
  for (const [, , o] of calls) check(o && typeof o.fade === 'number' && o.fade > 0 && o.fade <= 5, `music fade ${JSON.stringify(o)} is in seconds (<= 5)`);
  // The clipboard prompt wraps instead of truncating: every Chapter 1 prompt fits two 26-column rows.
  check(wrapWords('INITIAL HERE TO ACKNOWLEDGE RHYTHM SECTION', PROMPT_COLS, 2).join('|') === 'INITIAL HERE TO|ACKNOWLEDGE RHYTHM SECTION', 'rhythm section prompt wraps whole');
  check(wrapWords('INITIAL HERE TO END CHAPTER 1', PROMPT_COLS, 2).join('|') === 'INITIAL HERE TO END|CHAPTER 1', 'chapter end prompt keeps its 1');
});

// ---------------------------------------------------------------------------------------------
group('speakers', (check) => {
  for (const d of npcDupes) check(false, `duplicate ${d}`);
  for (const [id, def] of Object.entries(npcs)) {
    check(/^[a-z0-9_]+$/.test(id), `speaker ${id}: id is snake_case`);
    check(def && typeof def.name === 'string' && def.name.length > 0, `speaker ${id}: name`);
    if (def.portrait !== undefined) check(typeof def.portrait === 'string', `speaker ${id}: portrait is a string`);
    if (def.window !== undefined) check(['ff', 'flat', 'caption'].includes(def.window), `speaker ${id}: window "${def.window}" is ff|flat|caption`);
    if (def.blip !== undefined) check(typeof def.blip === 'string' || typeof def.blip === 'number', `speaker ${id}: blip`);
    if (characters.characters[id]) check(false, `speaker ${id}: shadows characters.json (use characters.json for party members)`);
  }
  if (npcs.dad) check(npcs.dad.window === 'ff', 'dad speaker renders the FF window');
  check(!!npcs.dev_intercom && npcs.dev_intercom.window === 'ff', 'dev_intercom speaker renders the FF window');
});

// ---------------------------------------------------------------------------------------------
group('textvars+expressions', (check) => {
  const state = new GameState({ characters, items, equipment, start }, null).newGame();
  state.vars.saveCount = 4;
  state.vars.contractPages = 7;
  state.flags.gigFlyer = true;
  state.money = 4;
  check(expandVars('a {var:contractPages}-page agreement', state) === 'a 7-page agreement', 'vars substitute');
  check(expandVars('${var:money}', state) === '$4', 'money substitutes');
  check(expandVars('{var:flags.gigFlyer}/{var:vars.saveCount}', state) === 'yes/4', 'dotted paths');
  check(expandVars('{var:nothing} {pause:100}', state) === '0 {pause:100}', 'missing → 0, other markup kept');
  check(expandVars(null, state) === '' && expandVars('plain', null) === 'plain', 'null safe');
  const cases = [
    ['3 + vars.saveCount', 7], ['money', 4], ['vars.saveCount - 1', 3], ['flags.gigFlyer && money == 4', true],
    ['DRUMMER WANTED - MUST PLAY FAST', 'DRUMMER WANTED - MUST PLAY FAST'], ['Rent is a feeling', 'Rent is a feeling'],
    ['3 + 4', 7], ["'a'", "'a'"], ['', ''], [5, 5], [true, true],
  ];
  for (const [v, want] of cases) {
    const got = resolveValue(v, state);
    check(got === want, `resolveValue(${JSON.stringify(v)}) = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
  check(isExpression('vars.x') && !isExpression('hello') && isExpression('inventory.count(\'coffee\') + 1'), 'isExpression basics');
});

// ---------------------------------------------------------------------------------------------
group('shops', (check) => {
  const state = new GameState({ characters, items, equipment, start }, null).newGame();
  for (const [id, def] of Object.entries(shops)) {
    const shop = normalizeShop(id, def);
    for (const entry of shop.stock) {
      check(!!items[entry.id] || !!equipment[entry.id], `shop ${id}: stock "${entry.id}" exists`);
      if (entry.condition) { try { tokenize(entry.condition); } catch (err) { check(false, `shop ${id}: stock condition parse: ${err.message}`); } }
    }
    for (const rid of shop.refuse) check(!!items[rid] || !!equipment[rid], `shop ${id}: refuse "${rid}" exists`);
    for (const pid of Object.keys(shop.sellPrice)) check(!!items[pid] || !!equipment[pid], `shop ${id}: sellPrice "${pid}" exists`);
    check(shop.sellRate >= 0 && shop.sellRate <= 1, `shop ${id}: sellRate ${shop.sellRate} in 0..1`);
    const now = stockFor(shop, state);
    check(now.length > 0, `shop ${id}: has stock at game start`);
    for (const sid of now) check(buyPrice(state.inventory.def(sid)) >= 0, `shop ${id}: price of ${sid}`);
  }
  if (shops.pawnshop) {
    const pawn = normalizeShop('pawnshop', shops.pawnshop);
    check(sellPrice(pawn, 'fried_pedalboard', state.inventory.def('fried_pedalboard')) === 11, 'pawn pays $11 for the pedalboard');
    check(sellPrice(pawn, 'band_agreement', state.inventory.def('band_agreement')) === null, 'pawn refuses key items');
  }
});

process.stdout.write(`${JSON.stringify({ test: 'data.test', ok: failures === 0, checks: total, failures })}\n`);
process.exit(failures === 0 ? 0 : 1);
