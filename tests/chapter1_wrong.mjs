#!/usr/bin/env node
// Chapter 1 played WRONG: every choice branch, every losable battle lost, BAIL from every hub fight,
// every refusal, every shop edge, the menu key during every kind of cutscene, every NPC and object on
// every map (day and night rosters, two presses each), every map edge and solid, every exit from both
// sides, every save page and autosave reloaded, the optional fights to L8, the M/F toggles, and one
// segment at real speed (no ?fast=1). The debug API (warp / setFlag / give / addParty / load / save)
// is used freely: the goal is branch coverage, not honesty (tests/chapter1.mjs is the honest run).
//
//   EXPLORE_KEEP_DIST=1 node tests/chapter1_wrong.mjs      (reuses dist/; builds otherwise)
//
// Two processes share the work on the built dist/ (each with its own server and browser): this one runs
// S0-S9, a child of this same file (WRONG_REAL_ONLY=1) runs S10-S12 and the real-speed segment S13;
// the child's JSON is merged at the end. WRONG_SKIP_REAL=1 runs S0-S12 here alone.
//
// Part of tests/run.mjs (after chapter1.mjs). Knobs: PLAYWRIGHT_MODULE, SMOKE_CHROME, EXPLORE_KEEP_DIST=1,
// WRONG_SKIP_REAL=1 (skip the real-speed segment), WRONG_REAL_ONLY=1 (only it). Screenshots:
// tests/screenshots/wrong_*.png.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'tests', 'screenshots');
const READY_TIMEOUT_MS = 30_000;
const STEP_TIMEOUT_MS = 60_000;
const POLL_MS = 20;
const VIEWPORT = { width: 1024, height: 896 };
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const DIRS = { U: 'up', D: 'down', L: 'left', R: 'right' };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const XP_TABLE = JSON.parse(readFileSync(path.join(ROOT, 'src', 'data', 'characters.json'), 'utf8')).xpTable;
const ENEMIES = JSON.parse(readFileSync(path.join(ROOT, 'src', 'data', 'enemies.json'), 'utf8'));
const ENCOUNTERS = JSON.parse(readFileSync(path.join(ROOT, 'src', 'data', 'encounters.json'), 'utf8'));
const MAPS = Object.fromEntries(readdirSync(path.join(ROOT, 'src', 'data', 'maps')).filter((f) => f.endsWith('.json') && !f.startsWith('dev')).map((f) => { const m = JSON.parse(readFileSync(path.join(ROOT, 'src', 'data', 'maps', f), 'utf8')); return [m.id, m]; }));
/** DESIGN.md: critical-path XP (drone 8, slush 8, scooters 4+3+3, AUDITION 50, the Chorus 30, THE SET 100). */
const CRITICAL_XP = 206;
const REAL_ONLY = process.env.WRONG_REAL_ONLY === '1';
const SKIP_REAL = process.env.WRONG_SKIP_REAL === '1';
/** Sections the child process owns (the parent keeps S0-S9; both run 'hygiene'). */
const PART_B = new Set(['S10 interactions', 'S11 edges and exits', 'S12 toggles', 'S13 real speed']);

const log = (m) => process.stderr.write(`[chapter1_wrong] ${m}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class GameOverSignal extends Error {
  constructor(where) { super(`game over during ${where}`); this.where = where; }
}

function build() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) throw new Error(`vite not installed at ${viteBin}`);
  log('running vite build');
  const r = spawnSync(process.execPath, [viteBin, 'build'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) { process.stderr.write(r.stdout + r.stderr); throw new Error(`vite build exited with ${r.status}`); }
}

function serveStatic(dir) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (p.endsWith('/')) p += 'index.html';
        const fp = path.normalize(path.join(dir, p));
        if (fp !== dir && !fp.startsWith(dir + path.sep)) { res.writeHead(403); res.end(); return; }
        const body = await readFile(fp);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
        res.end(body);
      } catch (err) {
        res.writeHead(err && (err.code === 'ENOENT' || err.code === 'EISDIR') ? 404 : 500);
        res.end();
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean);
  const g = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' });
  if (g.status === 0) candidates.push(path.join(g.stdout.trim(), 'playwright'));
  for (const c of candidates) {
    try { const pw = require(c); if (pw && pw.chromium) return pw; } catch (err) { if (err && err.code !== 'MODULE_NOT_FOUND') throw err; }
  }
  throw new Error(`playwright not found (tried ${candidates.join(', ')})`);
}

function findChrome() {
  if (process.env.SMOKE_CHROME) return process.env.SMOKE_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(base)) return null;
  const revs = readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of revs) { const c = path.join(base, d, 'chrome-linux', 'chrome'); if (existsSync(c)) return c; }
  return null;
}

async function launch(chromium) {
  const attempts = [{ headless: true, args: LAUNCH_ARGS }];
  const explicit = findChrome();
  if (explicit) attempts.push({ headless: true, args: LAUNCH_ARGS, executablePath: explicit });
  const failures = [];
  for (const o of attempts) {
    try { return await chromium.launch(o); } catch (err) { failures.push(`${o.executablePath ?? 'default'}: ${String(err.message).split('\n')[0]}`); }
  }
  throw new Error(`could not launch chromium:\n  ${failures.join('\n  ')}`);
}

// ---- in-page helpers (installed once on window.__wrong) ----------------------------------------------

function installHelpers() {
  const s = window.__slime;
  const ex = () => s.explore();
  const W = {
    /** Reposition the player inside the current map (no fade, no hooks). */
    place(x, y, facing) {
      const e = ex();
      e.player.setTile(x, y);
      e.player.face(facing);
      s.state.setPosition(e.mapId, x, y, facing);
      return { x: e.player.tileX, y: e.player.tileY, facing: e.player.facing };
    },
    /** Every live entity with a script (or a save point) on the current map. */
    scripted() {
      return [...ex().entities.values()].filter((e) => e.type !== 'player' && e.type !== 'follower' && (e.def.script || e.type === 'save'))
        .map((e) => ({ id: e.id, type: e.type, x: e.tileX, y: e.tileY, footprint: e.footprint, script: e.def.script || null, behavior: e.behavior }));
    },
    /** A free tile next to an entity's footprint, with the facing that looks at it; null when boxed in. */
    adjacentSpot(id) {
      const e = ex();
      const ent = e.entities.get(id);
      if (!ent) return null;
      const [fw, fh] = ent.footprint;
      const cands = [];
      for (let cx = ent.tileX; cx < ent.tileX + fw; cx++) {
        for (let cy = ent.tileY; cy > ent.tileY - fh; cy--) {
          cands.push([cx, cy + 1, 'up'], [cx, cy - 1, 'down'], [cx - 1, cy, 'right'], [cx + 1, cy, 'left']);
        }
      }
      for (const [tx, ty, facing] of cands) {
        if (ent.occupies(tx, ty)) continue;
        if (e.isBlocked(tx, ty, e.player)) continue;
        return { x: tx, y: ty, facing };
      }
      return null;
    },
    entity(id) {
      const ent = ex().entities.get(id);
      return ent ? { id: ent.id, type: ent.type, x: ent.tileX, y: ent.tileY, facing: ent.facing, behavior: ent.behavior, engaged: !!ent.engaged, visible: ent.visible } : null;
    },
    setBehavior(id, behavior) { const ent = ex().entities.get(id); if (ent) ent.configure({ behavior }); },
    /**
     * Walk into every blocked neighbour (edges, solids, solid entities) from every free tile and
     * simulate a completed step on every free tile with the exit / trigger / touch sinks intercepted.
     * Flags are restored afterwards (once-triggers would mark themselves).
     */
    async edgeSweep() {
      const e = ex();
      const b = e.built;
      const p = e.player;
      const st = s.state;
      const flagsBefore = JSON.stringify(st.flags);
      const origin = { x: p.tileX, y: p.tileY, facing: p.facing };
      const changes = [];
      const runs = [];
      const touches = [];
      const origChange = e.changeMap;
      const origRun = e.runner.run;
      const origTouch = e.onEnemyTouch;
      e.changeMap = async (map, x, y, facing) => { changes.push({ map, x, y, facing, from: { x: p.tileX, y: p.tileY } }); };
      e.runner.run = async (id) => { runs.push({ id: Array.isArray(id) ? '(inline)' : id, at: { x: p.tileX, y: p.tileY } }); };
      e.onEnemyTouch = async (en) => { touches.push({ id: en.id, at: { x: p.tileX, y: p.tileY } }); };
      const escaped = [];
      let blockedTests = 0;
      let freeTiles = 0;
      try {
        for (let y = 0; y < b.height; y++) {
          for (let x = 0; x < b.width; x++) {
            if (e.isBlocked(x, y, p)) continue;
            freeTiles++;
            for (const [dir, dx, dy] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]]) {
              const tx = x + dx, ty = y + dy;
              const oob = tx < 0 || ty < 0 || tx >= b.width || ty >= b.height;
              if (!oob && !e.isBlocked(tx, ty, p)) continue;
              p.setTile(x, y);
              const ok = await p.step(dir, 'walk', { ghost: false });
              blockedTests++;
              if (ok || p.moving || p.tileX !== x || p.tileY !== y) escaped.push({ x, y, dir, ok, to: { x: p.tileX, y: p.tileY } });
            }
          }
        }
        for (let y = 0; y < b.height; y++) {
          for (let x = 0; x < b.width; x++) {
            if (e.isBlocked(x, y, p)) continue;
            p.setTile(x, y);
            e.onEntityStep(p);
          }
        }
      } finally {
        e.changeMap = origChange;
        e.runner.run = origRun;
        e.onEnemyTouch = origTouch;
        st.flags = JSON.parse(flagsBefore);
        p.setTile(origin.x, origin.y);
        p.face(origin.facing);
        st.setPosition(e.mapId, origin.x, origin.y, origin.facing);
      }
      return { map: e.mapId, width: b.width, height: b.height, freeTiles, blockedTests, escaped, changes, runs, touches, zones: e.zones.map((z) => ({ id: z.id, type: z.type, x: z.x, y: z.y, w: z.w || 1, h: z.h || 1, condition: z.condition || null, refuse: z.refuse || null, to: z.to || null, script: z.script || null, once: !!z.once })) };
    },
    /** Drop every living controllable to 1 HP through the model (a loss is one hit away). */
    weaken() {
      const b = s.services.battle;
      if (!b || !b.model) return 0;
      let n = 0;
      for (const c of b.model.party()) {
        if (!c.controllable || c.auto || c.ko || c.hp <= 1) continue;
        b.model.damage(c, c.hp - 1, { scripted: true, source: 'script' });
        n++;
      }
      return n;
    },
    /** THE SET: the last cop goes down right now (the Eternity must still fire). */
    copDown() {
      const b = s.services.battle;
      if (!b || !b.model) return null;
      const cop = b.model.find('cop');
      if (!cop) return null;
      b.model.damage(cop, 999, { by: 'lucky' });
      return { fled: !!cop.fled, suspend: !!b.model.suspendEnd, armed: !!b.model.flags.eternityArmed, living: b.model.living('enemy').length };
    },
  };
  window.__wrong = W;
  return true;
}

/** Runs in the page: scene, idle state, the GameState snapshot, the open widget and the battle HUD (tests/chapter1.mjs). */
function probeFn() {
  const s = window.__slime;
  const sv = s.services;
  const scene = s.scene();
  const snap = s.state ? s.state.snapshot() : { flags: {}, vars: {}, party: [], inventory: [] };
  const ex = s.explore ? s.explore() : null;
  const sm = s.game.scene;
  const out = {
    scene, idle: s.idle(), snap, ui: sv.ui ? sv.ui.debugState() : null,
    runner: !!(ex && ex.runner && ex.runner.running), lock: ex ? ex.lockCount : 0, transitioning: !!(ex && ex.transitioning),
    player: null, entities: [], followers: [], overlay: null, battle: null, titleSeen: window.__titleSeen || 0, exploreSeen: window.__exploreSeen || 0, gameOverSeen: window.__gameOverSeen || 0, slot: s.state ? s.state.slot : null,
    uiBusy: !!(sv.ui && sv.ui.isBusy()), uiKinds: sv.ui ? sv.ui.debugState().kinds : [], moving: !!(ex && ex.player && ex.player.moving),
    menuActive: sm.isActive('Menu'), exploreState: sm.isActive('Explore') ? 'active' : sm.isPaused('Explore') ? 'paused' : sm.isSleeping('Explore') ? 'sleeping' : 'off',
    toggles: sv.input ? { ...sv.input.toggles } : null, muted: !!(sv.audio && sv.audio.isMuted), lastErrors: s.lastErrors.length,
    saves: s.state ? [1, 2, 3].map((n) => s.state.hasSave(n)) : [],
  };
  if (ex && ex.player) {
    out.player = { x: ex.player.tileX, y: ex.player.tileY, facing: ex.player.facing, moving: !!ex.player.moving, sheet: ex.player.sheet };
    out.entities = [...ex.entities.values()].map((e) => ({ id: e.id, type: e.type, x: e.tileX, y: e.tileY, facing: e.facing, behavior: e.behavior, visible: e.visible, sheet: e.sheet, engaged: !!e.engaged }));
    out.followers = (ex.followers || []).map((f) => ({ id: f.memberId, x: f.tileX, y: f.tileY, visible: f.visible, shadowed: !!f.shadowed }));
    out.overlay = ex.overlay ? ex.overlay.visible : null;
  }
  const b = sv.battle;
  if (scene === 'Battle' && b && b.model) {
    const m = b.model;
    const mnu = b.hud && b.hud.activeMenu;
    let menu = null;
    if (mnu) {
      if (mnu.targets) menu = { kind: 'target', state: mnu.state, i: mnu.i, targets: mnu.targets.map((t) => ({ uid: t.uid, name: t.name, side: t.side })) };
      else if (mnu.items) menu = { kind: mnu.cols > 1 ? 'command' : 'list', state: mnu.state, selected: mnu.selected, cols: mnu.cols, items: mnu.items.map((it) => ({ id: it.id, label: it.label, disabled: !!it.disabled, divider: !!it.divider, kind: it.kind })) };
      else menu = { kind: 'prompt', state: mnu.state };
    }
    const cur = m.current;
    const comb = (c) => ({ uid: c.uid, id: c.id, name: c.name, side: c.side, hp: c.hp, maxHp: c.maxHp, amp: c.amp, maxAmp: c.maxAmp, ko: !!c.ko, fled: !!c.fled, offPanel: !!c.offPanel, acted: !!c.acted, auto: !!c.auto, level: c.level, form: c.form || null, weak: c.weak || [], resist: c.resist || [], status: (c.status || []).map((st) => st.id), present: !!c.present });
    const mine = cur && cur.side === 'party' && cur.controllable && !cur.auto;
    out.battle = {
      id: m.encounterId, round: m.round, toon: m.toonLevel, meter: m.meter, ended: m.ended, result: m.result, inputLocked: !!m.inputLocked, suspendEnd: !!m.suspendEnd,
      actor: cur ? cur.uid : null, menu, flags: { eternityArmed: !!m.flags.eternityArmed, eternityFired: !!m.flags.eternityFired },
      party: m.party().map(comb), enemies: m.enemies().map(comb),
      commands: mine ? m.commands(cur.uid).map((c) => ({ id: c.id, disabled: !!c.disabled, reason: c.reason || null })) : [],
      riffs: mine ? m.riffMenu(cur.uid).map((e) => ({ id: e.id, disabled: !!e.disabled })) : [],
      syncs: mine ? m.syncMenu(cur.uid).map((e) => ({ id: e.id, disabled: !!e.disabled })) : [],
      noise: mine ? m.noiseMenu(cur.uid).map((e) => ({ id: e.id, disabled: !!e.disabled })) : [],
      items: m.usableItems().map((e) => ({ id: e.id, qty: e.qty, disabled: !!e.disabled })),
    };
  }
  return out;
}

const topOf = (p, type) => (p.ui && p.ui.top && p.ui.top.type === type ? p.ui.top : null);
const say = (p) => topOf(p, 'say') || {};
const menu = (p) => { const m = topOf(p, 'menu'); return m && m.state === 'open' ? m : null; };
const battleMenu = (p, id) => !!(p.battle && (!id || p.battle.id === id) && p.battle.menu && p.battle.menu.kind === 'command' && p.battle.menu.state === 'open');
const has = (s, id) => (s.inventory || []).some((e) => e.id === id);
const qty = (s, id) => ((s.inventory || []).find((e) => e.id === id) || {}).qty || 0;
const party = (s) => (s.party || []).map((m) => m.id).join(',');
const member = (s, id) => (s.party || []).find((m) => m.id === id) || null;
const ent = (p, id) => (p.entities || []).find((e) => e.id === id) || null;
const flat = (t) => String(t || '').replace(/[\n\f]+/g, ' ').replace(/\s+/g, ' ').trim();

// ---- battle brains ---------------------------------------------------------------------------------------

/** tests/chapter1.mjs's player: what a reader would pick from the command window. */
function winPlan(b) {
  const me = b.party.find((c) => c.uid === b.actor);
  if (!me) return { cmd: 'strum' };
  const living = b.party.filter((c) => c.present && !c.ko);
  const enemies = b.enemies.filter((c) => c.present && !c.ko && !c.fled && !c.offPanel && c.hp > 0);
  const item = (id) => b.items.find((e) => e.id === id && e.qty > 0 && !e.disabled);
  const sync = (id) => b.syncs.find((e) => e.id === id && !e.disabled);
  const riff = (id) => b.riffs.find((e) => e.id === id && !e.disabled);
  const noise = (id) => b.noise.find((e) => e.id === id && !e.disabled);
  const cmdOk = (id) => b.commands.some((c) => c.id === id && !c.disabled);
  const resists = (c, f) => (c.resist || []).includes(f);
  const ko = b.party.find((c) => c.present && c.ko && !c.auto);
  const weakest = living.filter((c) => !c.auto).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
  const lowest = enemies.slice().sort((a, c) => a.hp - c.hp)[0];
  const slime = me.id === 'lucky' || me.id === 'phoenix';
  if (ko && cmdOk('item') && item('hotdish')) return { cmd: 'item', entry: 'hotdish', target: ko.uid };
  if (weakest && weakest.hp / weakest.maxHp < 0.4) {
    if (slime && cmdOk('riff') && sync('shared_aura')) return { cmd: 'riff', entry: 'shared_aura' };
    if (cmdOk('item') && item('pizza_slice')) return { cmd: 'item', entry: 'pizza_slice', target: weakest.uid };
    if (weakest.uid === me.uid && me.hp / me.maxHp < 0.25) return { cmd: 'tune' };
  }
  if (!lowest) return { cmd: 'tune' };
  if (cmdOk('noise')) {
    const chorus = b.id === 'ep0_rehearsal';
    const noiseWorks = enemies.some((e) => !resists(e, 'NOISE'));
    if (b.toon >= 2 && noise('kraaang') && (chorus || (enemies.length >= 2 && noiseWorks))) return { cmd: 'noise', entry: 'kraaang', target: lowest.uid };
    if (b.toon >= 1 && !chorus && noise('pop') && !resists(lowest, 'NOISE') && lowest.hp > 20) return { cmd: 'noise', entry: 'pop', target: lowest.uid };
  }
  if (cmdOk('riff')) {
    const reserve = slime ? 4 : 0;
    const choices = me.id === 'lucky' ? [['power_chord', 3, 'HIGH'], ['pseudopod_slap', 3, 'PHYS']]
      : me.id === 'phoenix' ? [['root_note', 3, 'LOW']]
        : me.id === 'brian' ? [['sterile_chord', 0, 'HIGH'], ['tube_screamer', 5, 'HIGH']] : [];
    const ranked = choices.filter(([id, cost]) => riff(id) && me.amp - cost >= reserve)
      .map(([id, , f]) => ({ id, score: (lowest.weak || []).includes(f) ? 2 : resists(lowest, f) ? 0 : 1 }))
      .sort((a, c) => c.score - a.score);
    if (ranked.length && ranked[0].score > 0) return { cmd: 'riff', entry: ranked[0].id, target: lowest.uid };
  }
  return { cmd: 'strum', target: lowest.uid };
}
/** Never attack: TUNE until the enemies finish the band. */
const losePlan = () => ({ cmd: 'tune' });
/** BAIL when it is lit, TUNE otherwise (so a no-flee battle keeps moving). */
const bailPlan = (b) => (b.commands.some((c) => c.id === 'bail' && !c.disabled) ? { cmd: 'bail' } : { cmd: 'tune' });

// ---- the test --------------------------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const failures = [];
  const checks = [];
  const screenshots = [];
  const notes = [];
  const consoleMessages = [];
  const sections = {};
  const report = { test: 'chapter1_wrong', ok: false, checks: 0, failures, sections, durationMs: 0, realSpeedMs: null, screenshots, notes, warnings: [], consoleErrors: [] };
  let currentSection = 'boot';
  let shotCount = 0;
  let extraChecks = 0;

  if (process.env.EXPLORE_KEEP_DIST === '1' && existsSync(path.join(DIST, 'index.html'))) log('EXPLORE_KEEP_DIST=1, reusing dist/');
  else build();

  // The real-speed segment in a sibling process: dist/ is only read, each process serves its own copy.
  let realChild = null;
  if (!REAL_ONLY && !SKIP_REAL) {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { cwd: ROOT, env: { ...process.env, WRONG_REAL_ONLY: '1', EXPLORE_KEEP_DIST: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => process.stderr.write(d));
    realChild = new Promise((resolve) => child.on('exit', (code) => resolve({ code, out })));
  }

  const pw = loadPlaywright();
  const { server, port } = await serveStatic(DIST);
  let browser = null;
  mkdirSync(SHOTS, { recursive: true });

  try {
    browser = await launch(pw.chromium);

    /** Open a page on the built game with the console wired up. */
    const openPage = async (query) => {
      const page = await (await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })).newPage();
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => failures.push(`pageerror: ${err && err.message ? err.message : String(err)}`));
      page.on('requestfailed', (req) => failures.push(`requestfailed: ${req.url()} (${req.failure()?.errorText ?? '?'})`));
      page.on('response', (res) => { if (res.status() >= 400) failures.push(`http ${res.status()}: ${res.url()}`); });
      await page.goto(`http://127.0.0.1:${port}/?${query}`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
      await page.waitForFunction(() => window.__slime && window.__slime.isReady, null, { timeout: READY_TIMEOUT_MS, polling: 50 });
      await sleep(200);
      await page.evaluate(installHelpers);
      await page.evaluate(() => {
        window.__titleSeen = 0;
        window.__exploreSeen = 0;
        window.__gameOverSeen = 0;
        window.__slime.game.scene.getScene('Title').events.on('create', () => { window.__titleSeen += 1; });
        window.__slime.game.scene.getScene('Explore').events.on('create', () => { window.__exploreSeen += 1; });
        window.__slime.game.scene.getScene('GameOver').events.on('create', () => { window.__gameOverSeen += 1; });
      });
      return page;
    };

    let page = await openPage('fast=1&mute=1');
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const probe = () => ev(probeFn);
    const press = (action) => ev((a) => window.__slime.press(a), action);
    const shot = async (name, { freeze = true } = {}) => {
      if (freeze) { await ev(() => window.__slime.steps(2)); await ev(() => window.__slime.game.loop.sleep()); }
      try {
        const p = path.join(SHOTS, `${name}.png`);
        await page.screenshot({ path: p });
        screenshots.push(path.relative(ROOT, p));
      } finally {
        if (freeze) await ev(() => window.__slime.game.loop.wake());
      }
    };
    const check = async (name, ok, detail) => {
      const full = `${currentSection}: ${name}`;
      checks.push({ name: full, ok: !!ok });
      sections[currentSection] = sections[currentSection] || { checks: 0, failures: 0 };
      sections[currentSection].checks++;
      if (!ok) {
        sections[currentSection].failures++;
        failures.push(`${full}${detail !== undefined ? ` (${JSON.stringify(detail)})` : ''}`);
        log(`FAIL ${full} ${detail !== undefined ? JSON.stringify(detail).slice(0, 600) : ''}`);
        if (shotCount < 24) { shotCount++; try { await shot(`wrong_${String(shotCount).padStart(2, '0')}_${name.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}`, { freeze: false }); } catch { /* best effort */ } }
      }
    };

    // ---- UI driving ---------------------------------------------------------------------------------
    const uiPlan = [];
    const choice = { title: 1, eject: 1, flyer: 2, juke: 2, quit: 1, yesNo: 1, clipboard: 'decline', nap: 0 };
    const defaultPick = (labels) => {
      const l0 = labels[0] || '';
      if (l0 === 'New Game') return choice.title;
      if (l0 === 'EJECT') return choice.eject;
      if (l0 === 'Nap') return choice.nap;
      if (l0 === 'MUST PLAY FAST') return choice.flyer;
      if (/^INITIAL HERE/.test(l0)) return choice.clipboard === 'decline' ? labels.findIndex((l) => l === 'DECLINE') : labels.findIndex((l) => new RegExp(`^PAGE ${choice.clipboard}`).test(l));
      if (l0 === 'Pothole Blues') return choice.juke;
      if (l0 === 'RAGE') return choice.quit;
      if (l0 === 'Yes' && labels[1] === 'No') return choice.yesNo;
      if (l0 === 'BUY') return labels.indexOf('LEAVE');
      if (l0 === 'Items' && labels.includes('Quit')) return 'cancel';
      if (l0 === 'Quit to title') return 1;
      notes.push(`menu with no policy: ${JSON.stringify(labels)}; cancelled`);
      return 'cancel';
    };
    const pickFor = (m) => {
      const head = uiPlan[0];
      if (head && head.match(m.labels)) { uiPlan.shift(); return typeof head.pick === 'function' ? head.pick(m.labels) : head.pick; }
      return defaultPick(m.labels);
    };
    const navList = async (m, idx) => {
      if (idx === 'cancel') { await press('cancel'); return; }
      if (idx === 'confirm') { await press('confirm'); return; }
      for (let k = 0; k < m.items + 3; k++) {
        const p = await probe();
        const t = menu(p);
        if (!t) return;
        if (t.selected === idx) { await press('confirm'); return; }
        await press('down');
      }
      notes.push(`could not reach menu row ${idx} of ${JSON.stringify(m.labels)}`);
      await press('cancel');
    };
    /** Every dialogue page the driver dismissed: { text, who, map } (for the NPC sweep). */
    const seen = [];
    let lastSeenKey = null;
    const realSpeed = { on: false };
    const handleUi = async (p) => {
      const top = p.ui.top;
      if (!top) { await sleep(POLL_MS); return; }
      if (top.type === 'say') {
        if (top.state === 'complete' || (top.state === 'typing' && !realSpeed.on)) {
          const key = `${top.who}|${top.page}|${top.text}`;
          if (key !== lastSeenKey) { lastSeenKey = key; seen.push({ text: flat(top.text), who: top.who, page: top.page, map: p.snap.map, style: top.style, portrait: top.portrait, insert: !!(p.ui.kinds && p.ui.kinds.includes('insert')) }); }
          await press('confirm');
        } else await sleep(15);
      } else if (top.type === 'menu') {
        if (top.state === 'open') await navList(top, pickFor(top));
        else await sleep(15);
      } else if (top.type === 'insert') {
        if (top.state === 'open') { seen.push({ text: `insert:${top.sprite}`, who: 'insert', map: p.snap.map }); await press('confirm'); } else await sleep(15);
      } else {
        await sleep(15); // captions close on their own
      }
    };

    // ---- battle driving ----------------------------------------------------------------------------
    let battlePlan = winPlan;
    let plan = null;
    let battleSeq = 0; // bumped on every entry into the Battle scene: a re-engaged enemy must not reuse the last plan
    let inBattle = false;
    const battleLog = [];
    const navGrid = async (idx) => {
      for (let k = 0; k < 8; k++) {
        const p = await probe();
        const m = p.battle && p.battle.menu;
        if (!m || m.kind !== 'command' || m.state !== 'open') return;
        if (m.selected === idx) { await press('confirm'); return; }
        const cols = m.cols || 2;
        if (m.selected % cols !== idx % cols) await press('right');
        else await press('down');
      }
    };
    const navBattleList = async (idx) => {
      for (let k = 0; k < 12; k++) {
        const p = await probe();
        const m = p.battle && p.battle.menu;
        if (!m || m.kind !== 'list' || m.state !== 'open') return;
        if (m.selected === idx) { await press('confirm'); return; }
        await press('down');
      }
    };
    const navTarget = async (uid) => {
      for (let k = 0; k < 8; k++) {
        const p = await probe();
        const m = p.battle && p.battle.menu;
        if (!m || m.kind !== 'target' || m.state !== 'open') return;
        if (!uid || !m.targets.some((t) => t.uid === uid) || m.targets[m.i].uid === uid) { await press('confirm'); return; }
        await press('down');
      }
    };
    const handleBattle = async (p) => {
      const b = p.battle;
      const m = b.menu;
      if (!m || m.state !== 'open') return false;
      if (m.kind === 'prompt') { await press('confirm'); return true; }
      const key = `${battleSeq}:${b.id}:${b.round}:${b.actor}`;
      if (!plan || plan.key !== key) {
        if (battlePlan === losePlan) await ev(() => window.__wrong.weaken());
        plan = { key, ...battlePlan(b) };
        battleLog.push({ id: b.id, round: b.round, actor: b.actor, cmd: plan.cmd, bail: (b.commands.find((c) => c.id === 'bail') || {}).disabled });
      }
      if (m.kind === 'command') {
        let idx = m.items.findIndex((it) => it.id === plan.cmd);
        if (idx < 0 || m.items[idx].disabled) { plan = { key, cmd: plan.cmd === 'bail' ? 'tune' : 'strum', target: plan.target }; idx = m.items.findIndex((it) => it.id === plan.cmd); }
        if (idx < 0 || m.items[idx].disabled) idx = m.items.findIndex((it) => it.id === 'tune');
        await navGrid(idx);
        return true;
      }
      if (m.kind === 'list') {
        const idx = m.items.findIndex((it) => it.id === plan.entry);
        if (idx < 0 || m.items[idx].disabled) { plan = { key, cmd: 'strum', target: plan.target }; await press('cancel'); return true; }
        await navBattleList(idx);
        return true;
      }
      if (m.kind === 'target') { await navTarget(plan.target); return true; }
      return false;
    };

    // ---- the driver -----------------------------------------------------------------------------------
    let freefallSteered = false;
    let onBattleMenu = null; // one-shot hook while a command menu is open (THE SET hold)
    const drive = async (label, pred, { timeout = STEP_TIMEOUT_MS, allowGameOver = false } = {}) => {
      const t0 = Date.now();
      let last = null;
      while (Date.now() - t0 < timeout) {
        const p = await probe();
        last = p;
        if (!p.uiBusy) lastSeenKey = null; // a new box may repeat the last line word for word (a second press, twin objects)
        if (p.scene === 'GameOver') {
          if (pred(p)) return p;
          if (!allowGameOver) throw new GameOverSignal(label);
          await press('confirm');
          await sleep(POLL_MS);
          continue;
        }
        if (p.scene === 'Freefall') {
          if (!freefallSteered) { freefallSteered = true; await ev(() => window.__slime.hold('left', 300)); await ev(() => window.__slime.hold('right', 500)); }
          if (pred(p)) return p;
          await sleep(POLL_MS);
          continue;
        }
        if (p.ui && p.ui.busy && p.ui.top) { if (pred(p)) return p; await handleUi(p); continue; }
        if (p.scene === 'Battle' && !inBattle) { inBattle = true; battleSeq++; }
        else if (p.scene !== 'Battle') inBattle = false;
        if (p.scene === 'Battle' && p.battle) {
          if (pred(p)) return p;
          if (onBattleMenu && battleMenu(p)) { const fn = onBattleMenu; onBattleMenu = null; await fn(p); continue; }
          if (await handleBattle(p)) continue;
          await sleep(POLL_MS);
          continue;
        }
        if (pred(p)) return p;
        await sleep(POLL_MS);
      }
      const st = last ? { scene: last.scene, map: last.snap.map, x: last.player && last.player.x, y: last.player && last.player.y, idle: last.idle, uiBusy: last.uiBusy, uiKinds: last.uiKinds, ui: last.ui && last.ui.top, battle: last.battle && { id: last.battle.id, round: last.battle.round, menu: last.battle.menu, party: last.battle.party, enemies: last.battle.enemies }, runner: last.runner, lock: last.lock, transitioning: last.transitioning, moving: last.moving, flags: last.snap.flags } : null;
      throw new Error(`timeout waiting for ${label}; state=${JSON.stringify(st).slice(0, 1500)}`);
    };
    const idleOnMap = (p) => p.scene === 'Explore' && p.idle;
    const driveIdle = (label, opts) => drive(label, idleOnMap, opts);
    const at = (p, x, y) => !!p.player && p.player.x === x && p.player.y === y;
    const pos = (p) => ({ map: p.snap.map, x: p.player && p.player.x, y: p.player && p.player.y, facing: p.player && p.player.facing });
    const walk = async (pathStr, label = 'walk') => {
      let p = await driveIdle(`${label}: before`);
      for (const ch of pathStr) {
        if (ch === ' ') continue;
        const dir = DIRS[ch.toUpperCase()];
        if (!dir) continue;
        await press(dir);
        p = await driveIdle(`${label}: ${ch}`);
      }
      return p;
    };
    /** Press confirm and settle whatever it starts; returns the dialogue pages it produced and whether anything opened. */
    const interact = async (label, { timeout = 30_000 } = {}) => {
      const before = seen.length;
      await press('confirm');
      let opened = false;
      for (let i = 0; i < 20; i++) {
        const p = await probe();
        if (!p.idle || p.uiBusy || p.scene !== 'Explore') { opened = true; break; }
        await sleep(POLL_MS);
      }
      const p = await driveIdle(label, { timeout });
      return { opened, texts: seen.slice(before), p };
    };
    const place = (x, y, facing) => ev(({ x: ax, y: ay, facing: f }) => window.__wrong.place(ax, ay, f), { x, y, facing });
    // Never await the game's own promises from the page: warp/load/runScript resolve only after the
    // cutscenes they start, which this driver has to play. Fire, then drive.
    const warp = async (map, x, y, facing, label = `warp ${map}`) => {
      await ev(({ map: m, x: ax, y: ay, facing: f }) => { window.__slime.warp(m, ax, ay, f).catch(() => {}); return true; }, { map, x, y, facing });
      return driveIdle(label);
    };
    const loadSlot = async (slot, label = `load ${slot}`) => {
      await ev((n) => { window.__slime.load(n).catch(() => {}); return true; }, slot);
      return driveIdle(label, { timeout: 60_000 });
    };
    const runScript = (id) => ev((sid) => { window.__slime.runScript(sid).catch(() => {}); return true; }, id);
    const flags = (obj) => ev((o) => { for (const [k, v] of Object.entries(o)) window.__slime.setFlag(k.includes('.') ? k : `flags.${k}`, v); return true; }, obj);
    const setup = async (spec) => {
      await ev(() => { window.__slime.newGame().catch(() => {}); return true; });
      await ev(() => { window.__slime.textInstant(true); window.__slime.autoAdvance(false); });
      let p = await driveIdle('setup: new game');
      await ev((o) => {
        const s = window.__slime;
        const st = s.state;
        for (const f of o.flags || []) s.setFlag(`flags.${f}`, true);
        for (const [k, v] of Object.entries(o.set || {})) st.set(k, v);
        for (const id of o.party || []) s.addParty(id);
        for (const [id, n] of Object.entries(o.items || {})) st.inventory.add(id, n);
        if (o.money !== undefined) s.setMoney(o.money);
        if (o.level) for (const id of ['lucky', 'phoenix']) { const m = st.party.get(id); if (m) { st.party.addXp(id, Math.max(0, o.level - m.xp)); } }
        for (const m of st.party.members) { const stats = st.party.stats(m.id); m.hp = stats.maxHp; m.amp = stats.maxAmp; m.status = []; }
        if (o.hp1) for (const m of st.party.members) m.hp = 1;
        return true;
      }, spec);
      if (spec.map) p = await warp(spec.map, spec.x, spec.y, spec.facing || 'down', `setup: warp ${spec.map}`);
      return p;
    };
    const SPINE_HUB = ['podIntro', 'podSpeakerSlapped', 'ejected', 'metPhoenix', 'droneDefeated', 'phoenixJoined', 'signalSent', 'weekLater', 'hubOpen', 'visited_pod_bay', 'visited_alley', 'visited_apartment'];
    const SPINE_CAFE = [...SPINE_HUB, 'flyerPosted', 'brianJoined', 'ryanCalled', 'brianCalledRyan'];
    const SPINE_HALL = [...SPINE_CAFE, 'ryanArrived', 'hasBajonka', 'visited_city_sound_hall'];
    const SPINE_MONTH = [...SPINE_HALL, 'auditionDone', 'ryanJoined', 'monthLater', 'visited_room4'];
    const SPINE_NIGHT = [...SPINE_MONTH, 'monthLaterRan', 'pedalboardFried', 'kraaangFired', 'brianQuit', 'hasPalmersFlyer', 'gigFlyer'];
    const mine = (name) => {
      if (name === 'hygiene') return true;
      if (name === 'S13 real speed') return REAL_ONLY;
      if (REAL_ONLY) return PART_B.has(name);
      if (!realChild) return true; // no child (WRONG_SKIP_REAL=1): every fast section runs here
      return !PART_B.has(name);
    };
    const section = async (name, fn) => {
      if (!mine(name)) return;
      currentSection = name;
      const t0 = Date.now();
      sections[name] = sections[name] || { checks: 0, failures: 0 };
      try { await fn(); } catch (err) {
        failures.push(`${name}: fatal: ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err)}`);
        sections[name].failures++;
        log(`FATAL in ${name}: ${err && err.message ? err.message.slice(0, 800) : err}`);
        try { await shot(`wrong_fatal_${name.replace(/[^a-z0-9]+/gi, '_')}`, { freeze: false }); } catch { /* best effort */ }
        // Recover to a known state so the next section can run.
        try { await ev(() => { const s = window.__slime; if (s.services.ui) s.services.ui.closeAll(); s.newGame().catch(() => {}); return true; }); uiPlan.length = 0; onBattleMenu = null; battlePlan = winPlan; realSpeed.on = false; await driveIdle('recover'); } catch (e2) { log(`recovery failed: ${e2 && e2.message}`); }
      }
      sections[name].ms = Date.now() - t0;
      log(`${name}: ${sections[name].checks} checks, ${sections[name].failures} failures, ${sections[name].ms} ms`);
    };

    // ==== S0: title, no save, CONTINUE grayed, NEW GAME ======================================================
    await section('S0 title', async () => {
      let p = await probe();
      await check('title up with no saves', p.scene === 'Title' && p.saves.every((v) => !v), { scene: p.scene, saves: p.saves });
      await check('title menu: New Game / Continue', !!menu(p) && menu(p).labels[0] === 'New Game' && menu(p).labels[1] === 'Continue', menu(p));
      await press('down');
      p = await probe();
      await check('CONTINUE is grayed without a save: the cursor stays on New Game', !!menu(p) && menu(p).selected === 0, menu(p));
      await press('cancel');
      p = await probe();
      await check('cancel on the title menu does nothing', !!menu(p) && p.scene === 'Title', { scene: p.scene, menu: menu(p) });
      await ev(() => { window.__slime.textInstant(true); window.__slime.autoAdvance(false); });
      choice.title = 0;
      await press('confirm');
      p = await driveIdle('NEW GAME → pod bay');
      await check('NEW GAME lands in pod_bay (7,11) with CS-01 done', p.snap.map === 'pod_bay' && at(p, 7, 11) && p.snap.flags.podIntro === true, pos(p));
    });

    // ==== S1: the drone lost with no save: Game Over → Title → CONTINUE grayed → NEW GAME ====================
    await section('S1 drone lost', async () => {
      battlePlan = losePlan; // TUNE only; Lucky is dropped to 1 HP at his first command window (so the window is seen)
      await ev(() => { window.__slime.warp('alley', 9, 8, 'down').catch(() => {}); return true; });
      // The Game Over card returns to the title by itself after 1.5 s under ?fast=1: count its scene, do not sample it.
      let p = await drive('alley crash → drone lost → game over → title', (q) => q.scene === 'Title' && !!menu(q) && q.gameOverSeen > 0, { allowGameOver: true, timeout: 90_000 });
      await check('losing the drone reaches Game Over, then the title', p.gameOverSeen === 1 && p.scene === 'Title', { gameOverSeen: p.gameOverSeen, scene: p.scene });
      const droneLog = battleLog.filter((l) => l.id === 'alley_drone');
      await check('the drone: BAIL grayed ("Not yet.")', droneLog.length > 0 && droneLog.every((l) => l.bail === true), droneLog.slice(0, 3));
      await shot('wrong_title_after_gameover_no_save');
      battlePlan = winPlan;
      await check('Game Over returns to the title; still no save page', p.scene === 'Title' && p.saves.every((v) => !v), { saves: p.saves });
      await press('down');
      p = await probe();
      await check('CONTINUE still grayed after a Game Over with no save', !!menu(p) && menu(p).selected === 0, menu(p));
      choice.title = 0;
      await press('confirm');
      p = await driveIdle('NEW GAME after a Game Over');
      await check('NEW GAME works after the Game Over (fresh pod bay, Lucky alone, $4)', p.snap.map === 'pod_bay' && party(p.snap) === 'lucky' && p.snap.money === 4 && member(p.snap, 'lucky').hp > 1 && p.snap.flags.droneDefeated !== true, { pos: pos(p), party: party(p.snap), money: p.snap.money, lucky: member(p.snap, 'lucky') });
      await check('Game Over seen exactly once', p.gameOverSeen === 1, p.gameOverSeen);
    });

    // ==== S2: the three flyer texts and CS-08's opener =======================================================
    await section('S2 flyer texts', async () => {
      const openers = ['must play fast', 'No cops', 'Rhythmic vessel'];
      await setup({ flags: SPINE_HUB, party: ['phoenix'], items: { flyer_blank: 1 }, map: 'coffee_shop', x: 16, y: 3, facing: 'up' });
      for (let k = 0; k < 3; k++) {
        await ev(() => { const s = window.__slime; s.setFlag('flags.flyerPosted', false); s.setFlag('flags.brianJoined', false); s.removeParty('brian'); if (!s.state.inventory.has('flyer_blank')) s.give('flyer_blank', 1); });
        let p = await warp('coffee_shop', 16, 3, 'up', 'café corkboard');
        choice.flyer = k;
        const r = await interact(`CS-07 flyer ${k}`);
        p = r.p;
        await check(`flyer ${k}: posted, vars.flyerText = ${k}, the blank flyer gone`, p.snap.flags.flyerPosted === true && p.snap.vars.flyerText === k && !has(p.snap, 'flyer_blank'), { vars: p.snap.vars, inv: p.snap.inventory });
        await place(10, 11, 'down');
        const before = seen.length;
        await press('down');
        p = await drive(`CS-08 after flyer ${k}`, (q) => idleOnMap(q) && q.snap.flags.brianJoined === true, { timeout: 90_000 });
        const brianLines = seen.slice(before).filter((t) => t.who === 'brian');
        await check(`flyer ${k}: CS-08's opener echoes the flyer (${openers[k]})`, brianLines.length > 0 && brianLines[0].text.includes(openers[k]), brianLines.slice(0, 2));
        await check(`flyer ${k}: Brian joined second, two coffees, Ryan called, back at (10,11), autosaved in the café`, party(p.snap) === 'lucky,phoenix,brian' && qty(p.snap, 'coffee') >= 2 && p.snap.flags.ryanCalled === true && p.snap.map === 'coffee_shop' && at(p, 10, 11) && p.snap.vars.lastAutosave === 'coffee_shop', { party: party(p.snap), pos: pos(p), vars: p.snap.vars });
        await ev(() => { const st = window.__slime.state; st.inventory.remove('coffee', 2); });
      }
      // the café autosave reloads where it was taken
      const slot = await ev(() => window.__slime.state.slot || 1);
      const peek = await ev((n) => window.__slime.state.peekSave(n), slot);
      await check('café autosave page holds the café', !!peek && peek.map === 'coffee_shop' && peek.party.join(',') === 'lucky,phoenix,brian', peek);
      const p = await loadSlot(slot, 'load the café autosave');
      await check('__slime.load(café autosave): map, (10,11), party, flags, followers', p.snap.map === 'coffee_shop' && at(p, 10, 11) && party(p.snap) === 'lucky,phoenix,brian' && p.snap.flags.brianJoined === true && p.snap.flags.ryanCalled === true && p.followers.map((f) => f.id).join(',') === 'phoenix,brian', { pos: pos(p), party: party(p.snap), followers: p.followers });
    });

    // ==== S3: the four jukebox songs ========================================================================
    await section('S3 jukebox', async () => {
      await setup({ flags: SPINE_NIGHT, party: ['phoenix', 'ryan'], items: { palmers_flyer: 1, fried_pedalboard: 1 }, map: 'palmers', x: 16, y: 11, facing: 'up' });
      const lines = [];
      const want = ['The hole wins', "The feeling is 'due.'", 'limps for a second', 'goes beige'];
      for (let k = 0; k < 4; k++) {
        choice.juke = k;
        await place(16, 11, 'up');
        const r = await interact(`jukebox ${k}`);
        const narr = r.texts.filter((t) => t.who === 'narrator').map((t) => t.text);
        lines.push(narr[narr.length - 1] || '');
        await check(`jukebox song ${k} plays its own four bars`, r.opened && narr.length >= 2 && narr[narr.length - 1].includes(want[k]), narr);
      }
      const p = await probe();
      await check('flags.jukeboxPlayed; four distinct song lines', p.snap.flags.jukeboxPlayed === true && new Set(lines).size === 4, { flags: p.snap.flags.jukeboxPlayed, lines });
    });

    // ==== S4: the billboard: No, then Yes ===================================================================
    await section('S4 billboard', async () => {
      await setup({ flags: SPINE_HUB, party: ['phoenix'], level: XP_TABLE[4], items: { pizza_slice: 2 }, map: 'street_cedar', x: 16, y: 6, facing: 'up' });
      let p = await probe();
      await check('the billboard enemy-object stands at (16,5)', !!ent(p, 'billboard') && ent(p, 'billboard').x === 16 && ent(p, 'billboard').y === 5, ent(p, 'billboard'));
      choice.yesNo = 1;
      let r = await interact('billboard: No');
      await check('No: it keeps humming; no battle; the sign stays', r.texts.some((t) => t.text.includes('It keeps humming')) && !!ent(r.p, 'billboard') && r.p.snap.flags.cleared_billboard !== true, r.texts);
      const xpBefore = member(r.p.snap, 'lucky').xp;
      choice.yesNo = 0;
      battlePlan = winPlan;
      await place(16, 6, 'up');
      r = await interact('billboard: Yes', { timeout: 120_000 });
      p = r.p;
      await check('Yes: the fight, the hum stops, cleared_billboard, the object gone', r.texts.some((t) => t.text.includes('The hum stops')) && p.snap.flags.cleared_billboard === true && !ent(p, 'billboard'), { texts: r.texts.slice(-3), flags: p.snap.flags.cleared_billboard, ents: p.entities.map((e) => e.id) });
      await check(`billboard XP = enemies.json (${ENEMIES.billboard.xp})`, member(p.snap, 'lucky').xp - xpBefore === ENEMIES.billboard.xp, { before: xpBefore, after: member(p.snap, 'lucky').xp });
    });

    // ==== S5: shops ==========================================================================================
    await section('S5 shops', async () => {
      // the café: no SELL, buy with $0, buy to $0, LEAVE at every level
      await setup({ flags: SPINE_HUB, party: ['phoenix'], money: 0, map: 'coffee_shop', x: 4, y: 5, facing: 'up' });
      let p = await probe();
      const pizzaBefore = qty(p.snap, 'pizza_slice');
      uiPlan.push(
        { match: (l) => l[0] === 'BUY', pick: 0 },
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 'confirm' }, // every row disabled at $0: confirm must do nothing
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 'cancel' },
        { match: (l) => l[0] === 'BUY', pick: (l) => l.indexOf('LEAVE') },
      );
      const shopMenus = [];
      let r = await (async () => {
        const before = seen.length;
        await press('confirm');
        const q = await drive('café shop at $0', (q2) => {
          const m = menu(q2);
          if (m) { const key = m.labels.join('|'); if (!shopMenus.includes(key)) shopMenus.push(key); if (/^Pizza Slice/.test(m.labels[0]) && !shopMenus.includes('__shot')) { shopMenus.push('__shot'); } }
          return idleOnMap(q2);
        });
        return { p: q, texts: seen.slice(before) };
      })();
      p = r.p;
      await check('café top menu is BUY / LEAVE (the café does not buy)', shopMenus.some((k) => k === 'BUY|LEAVE'), shopMenus);
      await check('buying at $0 buys nothing; the plan was consumed through LEAVE', qty(p.snap, 'pizza_slice') === pizzaBefore && p.snap.money === 0 && uiPlan.length === 0, { pizza: qty(p.snap, 'pizza_slice'), money: p.snap.money, plan: uiPlan.length });
      uiPlan.length = 0;
      // $6: buy x2 Pizza Slice → $0 (quantity list), then LEAVE from the quantity list, the BUY list and the top
      await ev(() => window.__slime.setMoney(6));
      uiPlan.push(
        { match: (l) => l[0] === 'BUY', pick: 0 },
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 0 },
        { match: (l) => /^x1/.test(l[0]), pick: 1 }, // x2 $6
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 'cancel' },
        { match: (l) => l[0] === 'BUY', pick: 0 },
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 'confirm' }, // $0 again: rows disabled
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 'cancel' },
        { match: (l) => l[0] === 'BUY', pick: (l) => l.indexOf('LEAVE') },
      );
      let statusSeen = null;
      await place(4, 5, 'up');
      await press('confirm');
      p = await drive('café shop to $0', (q) => { if (q.ui && q.ui.status) statusSeen = q.ui.status; return idleOnMap(q); });
      await check('bought x2 Pizza Slice for $6 → $0; the money window showed $0', qty(p.snap, 'pizza_slice') === pizzaBefore + 2 && p.snap.money === 0 && statusSeen === '$0' && uiPlan.length === 0, { pizza: qty(p.snap, 'pizza_slice'), money: p.snap.money, status: statusSeen, plan: uiPlan.length });
      uiPlan.length = 0;
      await shot('wrong_cafe_after');
      // LEAVE from the quantity list
      await ev(() => window.__slime.setMoney(9));
      uiPlan.push(
        { match: (l) => l[0] === 'BUY', pick: 0 },
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 0 },
        { match: (l) => /^x1/.test(l[0]), pick: 'cancel' },
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 'cancel' },
        { match: (l) => l[0] === 'BUY', pick: 'cancel' }, // cancel on the top menu leaves too
      );
      await place(4, 5, 'up');
      await press('confirm');
      p = await driveIdle('café: leave from every level');
      await check('cancel at the quantity list, the BUY list and the top menu buys nothing and leaves', p.snap.money === 9 && qty(p.snap, 'pizza_slice') === pizzaBefore + 2 && uiPlan.length === 0 && !p.ui.status, { money: p.snap.money, plan: uiPlan.length, status: p.ui.status });
      uiPlan.length = 0;

      // the pawn shop: closed before the hub opens (the day enemies cleared: the Analyst chases anyone at the door)
      await setup({ flags: [...SPINE_HUB.filter((f) => f !== 'hubOpen'), 'cleared_slush', 'cleared_scooters', 'cleared_goose', 'cleared_analyst', 'cleared_billboard'], party: ['phoenix'], money: 30, map: 'street_cedar', x: 28, y: 9, facing: 'up' });
      r = await interact('pawn before hubOpen');
      await check('pawn door before hubOpen: BACK IN 10, no shop', r.texts.some((t) => t.text.includes('BACK IN 10')) && !seen.slice(-3).some((t) => /Buying or selling/.test(t.text)), r.texts);
      // open: sell gear, refuse key items and locked gear, buy to $0, cancel everywhere
      await flags({ hubOpen: true, brianQuit: true });
      await ev(() => { const st = window.__slime.state; st.inventory.add('price_tag_jacket', 1); st.inventory.add('band_agreement', 1); st.inventory.add('flannel', 1); st.inventory.add('fried_pedalboard', 1); });
      await ev(() => window.__slime.setMoney(0));
      const sellMenus = [];
      uiPlan.push(
        { match: (l) => l[0] === 'BUY' && l[1] === 'SELL', pick: 1 },
        { match: (l) => l.some((x) => /^Price-Tag/.test(x)), pick: (l) => l.findIndex((x) => /^Price-Tag/.test(x)) },
        { match: (l) => l.some((x) => /^Fried Pedalboard/.test(x)), pick: (l) => l.findIndex((x) => /^Fried Pedalboard/.test(x)) },
        { match: (l) => l.some((x) => /^Half-Ounce/.test(x)), pick: 'cancel' },
        { match: (l) => l[0] === 'BUY' && l[1] === 'SELL', pick: 0 },
        { match: (l) => l.some((x) => /^Band Sticker/.test(x)), pick: (l) => l.findIndex((x) => /^Band Sticker/.test(x)) },
        { match: (l) => l.some((x) => /^Earplugs/.test(x)), pick: (l) => l.findIndex((x) => /^Earplugs/.test(x)) },
        { match: (l) => l.some((x) => /^Thrift Telecaster/.test(x)), pick: 'cancel' },
        { match: (l) => l[0] === 'BUY' && l[1] === 'SELL', pick: 2 },
      );
      await place(28, 9, 'up');
      await press('confirm');
      p = await drive('pawn shop', (q) => { const m = menu(q); if (m && m.labels.some((x) => /^Band Agreement|^Flannel/.test(x))) sellMenus.push(m.labels); return idleOnMap(q); });
      const sellRows = sellMenus[0] || [];
      const refused = sellRows.filter((l) => /--\s*$/.test(l));
      await check('pawn: the oat-milk pedalboard line after brianQuit', seen.some((t) => t.text.includes('Eleven dollars')), seen.slice(-12).map((t) => t.text));
      await check('SELL list refuses key items and locked gear (-- rows)', refused.some((l) => /^Band Agreement/.test(l)) && refused.some((l) => /^Flannel/.test(l)) && !refused.some((l) => /^Price-Tag/.test(l)), { rows: sellRows, refused });
      await check('sold the jacket ($20) and the fried pedalboard ($11), bought the sticker ($6) and earplugs ($10): $15 left', p.snap.money === 15 && !has(p.snap, 'price_tag_jacket') && !has(p.snap, 'fried_pedalboard') && has(p.snap, 'band_sticker') && has(p.snap, 'earplugs') && has(p.snap, 'band_agreement') && has(p.snap, 'flannel') && uiPlan.length === 0, { money: p.snap.money, inv: p.snap.inventory, plan: uiPlan.length, left: uiPlan.map((u) => String(u.pick)) });
      uiPlan.length = 0;
      await check('the money window closed with the shop', !p.ui.status, p.ui.status);
      // the cursor cannot land on a refused row
      uiPlan.push({ match: (l) => l[0] === 'BUY' && l[1] === 'SELL', pick: 1 });
      await place(28, 9, 'up');
      await press('confirm');
      p = await drive('pawn SELL list', (q) => !!menu(q) && menu(q).labels.some((x) => /^Band Agreement/.test(x)));
      const landed = new Set();
      for (let i = 0; i < menu(p).items + 2; i++) { const q = await probe(); if (!menu(q)) break; landed.add(menu(q).labels[menu(q).selected]); await press('down'); }
      await check('the cursor skips every refused row', ![...landed].some((l) => /--\s*$/.test(l)) && landed.size >= 1, [...landed]);
      await press('cancel');
      uiPlan.push({ match: (l) => l[0] === 'BUY' && l[1] === 'SELL', pick: 2 });
      p = await driveIdle('leave the pawn shop');
      await check('LEAVE from the pawn top menu', p.idle && uiPlan.length === 0, uiPlan.length);
      uiPlan.length = 0;
    });

    // ==== S6: hub fights: BAIL, re-engage, lost, won; day and night; XP to L8 ===================================
    await section('S6 hub fights', async () => {
      const hubSetup = async (night) => setup({ flags: night ? SPINE_NIGHT : SPINE_HUB, party: night ? ['phoenix', 'ryan'] : ['phoenix'], level: CRITICAL_XP, items: { pizza_slice: 3, hotdish: 1 }, money: 20, map: 'street_cedar', x: 12, y: 9, facing: 'down' });
      const approach = async (id, label) => {
        // Stand next to the enemy's current tile and step into it (a bump is a touch); chasers come to us.
        for (let tries = 0; tries < 8; tries++) {
          const spot = await ev((eid) => window.__wrong.adjacentSpot(eid), id);
          if (!spot) { await sleep(200); continue; }
          await place(spot.x, spot.y, spot.facing);
          await press(spot.facing);
          const p = await drive(`${label}: touch`, (q) => q.scene === 'Battle' || (idleOnMap(q) && !ent(q, id)), { timeout: 2500 }).catch((err) => { if (err instanceof GameOverSignal) throw err; return null; });
          if (p && (p.scene === 'Battle' || !ent(p, id))) return p;
        }
        throw new Error(`${label}: could not touch ${id}`);
      };
      /** Touch the enemy and settle the battle. A loss rides Game Over → Title → CONTINUE (newest page) back to the map. */
      const fight = async (id, plan, label, { lose = false } = {}) => {
        battlePlan = plan;
        const t0 = battleLog.length;
        const go0 = (await probe()).gameOverSeen;
        await approach(id, label);
        choice.title = 1;
        const p = await drive(`${label}: battle`, (q) => q.scene !== 'Battle' && idleOnMap(q) && (!lose || q.gameOverSeen > go0), { allowGameOver: lose, timeout: 120_000 });
        battlePlan = winPlan;
        return { p, log: battleLog.slice(t0), gameOver: p.gameOverSeen > go0 };
      };
      const xpOf = (p) => member(p.snap, 'lucky').xp;
      let p = await hubSetup(false);
      await ev(() => window.__slime.save(1)); // a page for CONTINUE after the losses
      const l7 = member(p.snap, 'lucky');
      await check('hub setup: Lucky at the critical-path XP (206, L7), day roster + day enemies', l7.xp === CRITICAL_XP && l7.level === 7 && ['slush', 'scooters', 'goose', 'analyst', 'billboard', 'shoveler', 'busker'].every((id) => !!ent(p, id)), { lucky: l7, ents: p.entities.map((e) => e.id) });
      let optionalXp = 0;
      // slush: BAIL (enemy stays, idles, resumes), then lost → Game Over → CONTINUE → page 1
      let r = await fight('slush', bailPlan, 'slush BAIL');
      await check('slush: BAIL left it on the map, uncleared', !!ent(r.p, 'slush') && r.p.snap.flags.cleared_slush !== true && r.log.some((l) => l.cmd === 'bail'), { log: r.log, ents: r.p.entities.filter((e) => e.type === 'enemy').map((e) => e.id) });
      await sleep(600);
      p = await probe();
      await check('slush: resumes (static) and is not engaged after the 2 s idle', !!ent(p, 'slush') && ent(p, 'slush').behavior === 'static' && !ent(p, 'slush').engaged, ent(p, 'slush'));
      r = await fight('slush', losePlan, 'slush lost', { lose: true });
      p = r.p;
      await check('slush lost reaches Game Over', r.gameOver, { scene: p.scene, log: r.log, party: p.snap.party.map((m) => `${m.id}:${m.hp}`) });
      await check('CONTINUE after the loss loads page 1 (hub, full HP, slush back)', p.slot === 1 && p.snap.map === 'street_cedar' && member(p.snap, 'lucky').hp > 1 && !!ent(p, 'slush'), { slot: p.slot, pos: pos(p), lucky: member(p.snap, 'lucky') });
      // scooters: BAIL then lost
      r = await fight('scooters', bailPlan, 'scooters BAIL');
      await check('scooters: BAIL left the pack patrolling', !!ent(r.p, 'scooters') && r.p.snap.flags.cleared_scooters !== true, r.log);
      await sleep(600);
      r = await fight('scooters', losePlan, 'scooters lost', { lose: true });
      p = r.p;
      await check('scooters lost reaches Game Over', r.gameOver, { scene: p.scene, log: r.log });
      await check('CONTINUE again loads page 1', p.slot === 1 && p.snap.map === 'street_cedar', { slot: p.slot, map: p.snap.map });
      // goose and analyst: BAIL, re-engage, win; XP matches enemies.json
      for (const [id, enc] of [['goose', 'hub_goose'], ['analyst', 'hub_analyst']]) {
        r = await fight(id, bailPlan, `${id} BAIL`);
        await check(`${id}: BAIL leaves it on the map`, !!ent(r.p, id) && r.p.snap.flags[`cleared_${id}`] !== true, r.log);
        await sleep(600);
        const before = xpOf(r.p);
        r = await fight(id, winPlan, `${id} win`);
        const want = ENCOUNTERS[enc].enemies.reduce((s, e, i) => s + (((ENCOUNTERS[enc].overrides || [])[i] || {}).xp ?? ENEMIES[e].xp), 0);
        await check(`${id}: won after the BAIL, cleared, +${want} XP`, !ent(r.p, id) && r.p.snap.flags[`cleared_${id}`] === true && xpOf(r.p) - before === want, { xp: xpOf(r.p) - before, want, flags: r.p.snap.flags[`cleared_${id}`] });
        optionalXp += want;
      }
      // the billboard (optional, static object with a Yes/No)
      {
        const before = xpOf(await probe());
        choice.yesNo = 0;
        await place(16, 6, 'up');
        battlePlan = winPlan;
        const rr = await interact('billboard Yes (XP)', { timeout: 120_000 });
        await check('billboard won for the optional XP', rr.p.snap.flags.cleared_billboard === true && xpOf(rr.p) - before === ENEMIES.billboard.xp, { xp: xpOf(rr.p) - before });
        optionalXp += ENEMIES.billboard.xp;
      }
      const dayXp = xpOf(await probe());
      // night: the duo and the pair
      p = await hubSetup(true);
      await ev((xp) => { const st = window.__slime.state; for (const id of ['lucky', 'phoenix']) st.party.addXp(id, xp - st.party.get(id).xp); }, dayXp);
      p = await probe();
      await check('night roster: stranger, smoker, Bajonka; the duo and the pair; overlay on; day roster gone', ['stranger_tall', 'smoker', 'bajonka', 'analyst_duo', 'goose_pair'].every((id) => !!ent(p, id)) && !['shoveler', 'cyclist', 'busker', 'slush', 'scooters', 'goose', 'analyst', 'billboard'].some((id) => !!ent(p, id)) && p.overlay === true, { ents: p.entities.map((e) => e.id), overlay: p.overlay });
      await shot('wrong_night_street');
      for (const [id, enc] of [['analyst_duo', 'hub_analyst_duo'], ['goose_pair', 'hub_goose_pair']]) {
        r = await fight(id, bailPlan, `${id} BAIL`);
        await check(`${id}: BAIL leaves it on the map`, !!ent(r.p, id) && r.p.snap.flags[`cleared_${id}`] !== true, r.log);
        await sleep(600);
        const before = xpOf(r.p);
        r = await fight(id, winPlan, `${id} win`);
        const want = ENCOUNTERS[enc].enemies.reduce((s, e) => s + ENEMIES[e].xp, 0);
        await check(`${id}: won after the BAIL, cleared, +${want} XP`, !ent(r.p, id) && r.p.snap.flags[`cleared_${id}`] === true && xpOf(r.p) - before === want, { xp: xpOf(r.p) - before, want });
        optionalXp += want;
      }
      p = await probe();
      await check(`the five optional fights (+${optionalXp}) on top of the critical path (${CRITICAL_XP}) reach L8 (${XP_TABLE[7]})`, CRITICAL_XP + optionalXp >= XP_TABLE[7] && member(p.snap, 'lucky').level === 8 && member(p.snap, 'phoenix').level === 8, { optionalXp, total: CRITICAL_XP + optionalXp, lucky: member(p.snap, 'lucky'), phoenix: member(p.snap, 'phoenix') });
      await check('DESIGN budget: every fight is 311 XP or less of the table', CRITICAL_XP + optionalXp <= 311, CRITICAL_XP + optionalXp);
    });

    // ==== S7: the scripted battles lost / wiped, BAIL grayed, the Eternity held in the scene ===================
    await section('S7 scripted battles', async () => {
      // the AUDITION lost (page 2 is the newest page: CONTINUE must pick it)
      // (full HP: the lose brain drops everyone to 1 HP at their first command window, so BAIL's gray state is seen)
      let p = await setup({ flags: SPINE_HALL, party: ['phoenix', 'brian'], level: XP_TABLE[2], map: 'city_sound_hall', x: 20, y: 6, facing: 'up' });
      await ev(() => window.__slime.save(2));
      battlePlan = losePlan;
      let go0 = p.gameOverSeen;
      choice.title = 1;
      await press('up');
      p = await drive('CS-10/11 → AUDITION lost → Game Over → CONTINUE', (q) => idleOnMap(q) && q.gameOverSeen > go0, { allowGameOver: true, timeout: 120_000 });
      const aud = battleLog.filter((l) => l.id === 'ep0_audition');
      await check('AUDITION: BAIL grayed (the dog has the contract); lost → Game Over', p.gameOverSeen === go0 + 1 && aud.length > 0 && aud.every((l) => l.bail === true), { gameOverSeen: p.gameOverSeen, log: aud.slice(0, 3) });
      await check('CONTINUE picks the newest page (2) outside Room 4, party standing', p.slot === 2 && p.snap.map === 'city_sound_hall' && at(p, 20, 6) && member(p.snap, 'lucky').hp > 0, { slot: p.slot, pos: pos(p) });

      // the Chorus wiped (cannot be lost): the forced KRAAANG ends it and the ultimatum follows
      p = await setup({ flags: SPINE_MONTH, party: ['phoenix', 'brian', 'ryan'], level: XP_TABLE[3], hp1: true, items: { band_agreement: 1 }, set: { 'vars.saveCount': 1, 'vars.contractPages': 3 } });
      battlePlan = losePlan;
      await ev(() => { window.__slime.warp('room4', 5, 8, 'right').catch(() => {}); return true; });
      p = await drive('CS-13 → the Chorus wiped → CS-14', (q) => idleOnMap(q) && q.snap.flags.brianQuit === true, { timeout: 180_000 });
      const chorus = battleLog.filter((l) => l.id === 'ep0_rehearsal');
      await check('the Chorus: BAIL grayed; the whole band KO\'d still ends in the forced KRAAANG (kraaangFired, brianFried, pedalboardFried, brianQuit)', chorus.length > 0 && chorus.every((l) => l.bail === true) && ['kraaangFired', 'brianFried', 'pedalboardFried', 'brianQuit'].every((f) => p.snap.flags[f] === true), { log: chorus.slice(0, 3), flags: p.snap.flags });
      await check('after the wipe the band is standing (HP > 0) so THE SET can start', member(p.snap, 'lucky').hp > 0 && member(p.snap, 'phoenix').hp > 0, p.snap.party);
      await check('Brian gone, Fried Pedalboard, the gig flyer on the floor', party(p.snap) === 'lucky,phoenix,ryan' && has(p.snap, 'fried_pedalboard') && !!ent(p, 'gig_flyer'), { party: party(p.snap), inv: p.snap.inventory });
      battlePlan = winPlan;

      // THE SET lost (before the Eternity arms)
      p = await setup({ flags: SPINE_NIGHT, party: ['phoenix', 'ryan'], level: XP_TABLE[4], items: { palmers_flyer: 1 }, map: 'palmers', x: 19, y: 6, facing: 'right' });
      await ev(() => window.__slime.save(3));
      battlePlan = losePlan;
      go0 = p.gameOverSeen;
      choice.title = 1;
      await press('right');
      p = await drive('CS-16 → THE SET lost → Game Over → CONTINUE', (q) => idleOnMap(q) && q.gameOverSeen > go0, { allowGameOver: true, timeout: 120_000 });
      const set1 = battleLog.filter((l) => l.id === 'ep0_palmers_set');
      await check('THE SET: BAIL grayed; lost before the Eternity → Game Over', p.gameOverSeen === go0 + 1 && set1.length > 0 && set1.every((l) => l.bail === true), { gameOverSeen: p.gameOverSeen, log: set1.slice(0, 3) });
      await check('CONTINUE picks page 3 (Palmer\'s, beside the stage, not on stage)', p.slot === 3 && p.snap.map === 'palmers' && at(p, 19, 6) && p.snap.flags.onStage !== true && p.snap.flags.eternityArmed !== true, { slot: p.slot, pos: pos(p), flags: { onStage: p.snap.flags.onStage, armed: p.snap.flags.eternityArmed } });
      battlePlan = winPlan;

      // THE SET with the cop down before the backups: the Eternity must still fire (the scene side of the hold)
      p = await setup({ flags: SPINE_NIGHT, party: ['phoenix', 'ryan'], level: XP_TABLE[7], items: { palmers_flyer: 1, pizza_slice: 2 }, map: 'palmers', x: 19, y: 6, facing: 'right' });
      let hold = null;
      onBattleMenu = async () => { hold = await ev(() => window.__wrong.copDown()); };
      choice.quit = 0; // RAGE
      choice.clipboard = 1; // PAGE 1
      await press('right');
      p = await drive('CS-16 → THE SET (cop down at once) → the Eternity → CS-17', (q) => q.snap.map === 'palmers_rubble' && q.snap.flags.eternityDone === true, { timeout: 180_000 });
      await check('the model held the win and armed when the last cop crawled off', !!hold && hold.fled && hold.suspend && hold.armed && hold.living === 0, hold);
      await check('the Eternity fired in the scene and leveled the bar (eternityArmed, eternityFired, eternityDone, mohawk never needed)', ['eternityArmed', 'eternityFired', 'eternityDone'].every((f) => p.snap.flags[f] === true), p.snap.flags);
      await check('THE SET reward paid (+100 XP, the jacket) with no cop XP', has(p.snap, 'price_tag_jacket') && member(p.snap, 'lucky').xp === XP_TABLE[7] + 100, { lucky: member(p.snap, 'lucky'), inv: p.snap.inventory });
      await shot('wrong_eternity_hold_rubble');
      p = await drive('CS-17: RAGE → the quit', (q) => q.snap.flags.ryanQuit === true, { timeout: 120_000 });
      await check('RAGE: vars.quitResponse 0, the RAGE line, Ryan gone, luckyRageLocked', p.snap.vars.quitResponse === 0 && seen.some((t) => t.text.includes("You don't get to be scared")) && party(p.snap) === 'lucky,phoenix' && p.snap.flags.luckyRageLocked === true, { vars: p.snap.vars, party: party(p.snap) });
      const exploresBefore = p.exploreSeen;
      p = await drive('CS-17 stinger → PAGE 1 → Title → CONTINUE', (q) => q.scene === 'Explore' && q.exploreSeen > exploresBefore && q.snap.flags.ch1Complete === true && q.idle, { allowGameOver: true, timeout: 120_000 });
      await check('the chapter end saved page 1 and CONTINUE loaded it into the rubble', p.slot === 1 && p.snap.map === 'palmers_rubble' && p.snap.flags.ch1Complete === true && !!ent(p, 'bajonka') && p.player.sheet === 'lucky_rage', { slot: p.slot, pos: pos(p), sheet: p.player.sheet });

      // PLEAD and JOKE through the same scene (the party and the flags put back first)
      const quitLines = { 1: 'One more show', 2: 'weather event' };
      for (const k of [1, 2]) {
        await ev(() => { const s = window.__slime; s.addParty('ryan'); for (const f of ['ryanQuit', 'luckyRageLocked', 'ch1Complete']) s.setFlag(`flags.${f}`, false); });
        choice.quit = k;
        choice.clipboard = 'decline';
        const before = seen.length;
        await runScript('ep0_aftermath');
        p = await drive(`CS-17 quit response ${k}`, (q) => q.snap.flags.ryanQuit === true, { timeout: 120_000 });
        const luckyLines = seen.slice(before).filter((t) => t.who === 'lucky').map((t) => t.text);
        await check(`quit response ${k}: vars.quitResponse ${k} and its own line`, p.snap.vars.quitResponse === k && luckyLines.some((t) => t.includes(quitLines[k])) && p.snap.vars.quitResponse === k, { vars: p.snap.vars, luckyLines });
        if (k === 1) await check('PLEAD: the deflated walk, then the rage lock', p.snap.flags.luckyRageLocked === true && seen.slice(before).some((t) => t.portrait === 'lucky_deflated'), seen.slice(before).map((t) => t.portrait));
        const explores2 = p.exploreSeen;
        p = await drive(`CS-17 ${k}: DECLINE → Title → CONTINUE`, (q) => q.scene === 'Explore' && q.exploreSeen > explores2 && q.idle, { allowGameOver: true, timeout: 120_000 });
        await check(`quit response ${k}: declining the last clipboard still ends the chapter on the title; CONTINUE reloads the newest page`, seen.some((t) => t.text.includes('The clipboard does not move')) && p.snap.map === 'palmers_rubble', { map: p.snap.map, slot: p.slot });
      }
      choice.quit = 1;
    });

    // ==== S8: saves at every Bajonka and after every autosave =================================================
    await section('S8 saves', async () => {
      await ev(() => { for (const n of [1, 2, 3]) window.__slime.state.deleteSave(n); });
      const reloadCheck = async (label, slot, want) => {
        const peek = await ev((n) => window.__slime.state.peekSave(n), slot);
        const p = await loadSlot(slot, `${label}: __slime.load(${slot})`);
        const ok = p.slot === slot && p.snap.map === want.map && at(p, want.x, want.y) && party(p.snap) === want.party && Object.entries(want.flags || {}).every(([k, v]) => p.snap.flags[k] === v) && p.followers.map((f) => f.id).join(',') === want.party.split(',').slice(1).join(',');
        await check(`${label}: page ${slot} reloads map/position/party/flags/followers`, ok && !!peek && peek.map === want.map, { peek, pos: pos(p), party: party(p.snap), followers: p.followers, flags: Object.fromEntries(Object.keys(want.flags || {}).map((k) => [k, p.snap.flags[k]])) });
        return p;
      };
      // autosave: the apartment door (weekLater)
      let p = await setup({ flags: SPINE_HUB.filter((f) => f !== 'visited_apartment'), party: ['phoenix'], map: 'apartment', x: 12, y: 11, facing: 'down' });
      await press('down');
      p = await driveIdle('apartment door autosave');
      await check('apartment door autosave (vars.lastAutosave = apartment, page 1)', p.snap.flags.trig_apartment_autosave_door === true && p.snap.vars.lastAutosave === 'apartment' && p.saves[0] === true, { vars: p.snap.vars, saves: p.saves });
      await reloadCheck('apartment autosave', 1, { map: 'apartment', x: 12, y: 12, party: 'lucky,phoenix', flags: { weekLater: true, trig_apartment_autosave_door: true } });
      // autosave: the Towers sidewalk
      await flags({ trig_street_cedar_towers_autosave: false });
      p = await warp('street_cedar', 10, 9, 'right');
      await press('right');
      p = await driveIdle('towers autosave');
      await check('towers autosave on the sidewalk', p.snap.flags.trig_street_cedar_towers_autosave === true && p.snap.vars.lastAutosave === 'street_cedar', p.snap.vars);
      await reloadCheck('towers autosave', 1, { map: 'street_cedar', x: 11, y: 9, party: 'lucky,phoenix', flags: { trig_street_cedar_towers_autosave: true } });
      // autosave: the hall (onFirstEnter) → then the DECLINE / PAGE 1 at the hall Bajonka
      await flags({ flyerPosted: true, brianJoined: true, ryanCalled: true, ryanArrived: true, hasBajonka: true, visited_city_sound_hall: false });
      await ev(() => window.__slime.addParty('brian'));
      p = await warp('city_sound_hall', 20, 6, 'down');
      await check('hall autosave on first entry', p.snap.vars.lastAutosave === 'city_sound_hall' && p.saves[0] === true, p.snap.vars);
      await reloadCheck('hall autosave', 1, { map: 'city_sound_hall', x: 20, y: 6, party: 'lucky,phoenix,brian', flags: { hasBajonka: true } });
      await place(20, 6, 'down');
      choice.clipboard = 'decline';
      let r = await interact('hall clipboard: DECLINE');
      await check('DECLINE: the clipboard does not move; no page, saveCount untouched', r.texts.some((t) => t.text.includes('clipboard does not move')) && !r.p.snap.vars.saveCount, { texts: r.texts, vars: r.p.snap.vars });
      await shot('wrong_clipboard_declined');
      choice.clipboard = 1;
      await place(20, 6, 'down');
      r = await interact('hall clipboard: PAGE 1');
      await check('hall Bajonka: PAGE 1 initialed (saveCount 1, slot 1)', r.p.snap.vars.saveCount === 1 && r.p.slot === 1, { vars: r.p.snap.vars, slot: r.p.slot });
      // pause-menu SAVE next to the dog opens the same clipboard
      choice.clipboard = 1;
      uiPlan.push({ match: (l) => l[0] === 'Items' && l.includes('Save'), pick: 4 });
      await press('menu');
      p = await driveIdle('pause menu SAVE beside Bajonka');
      await check('pause-menu SAVE beside the dog initials a page (saveCount 2)', p.snap.vars.saveCount === 2 && uiPlan.length === 0, { vars: p.snap.vars, plan: uiPlan.length });
      uiPlan.length = 0;
      await reloadCheck('hall page', 1, { map: 'city_sound_hall', x: 20, y: 6, party: 'lucky,phoenix,brian', flags: { hasBajonka: true } });
      // Palmer's Bajonka → PAGE 2
      await flags({ auditionDone: true, ryanJoined: true, monthLater: true, monthLaterRan: true, pedalboardFried: true, brianQuit: true, hasPalmersFlyer: true, gigFlyer: true, visited_room4: true });
      await ev(() => { const s = window.__slime; s.removeParty('brian'); s.addParty('ryan'); });
      p = await warp('palmers', 3, 4, 'left');
      choice.clipboard = 2;
      r = await interact("Palmer's clipboard: PAGE 2");
      await check("Palmer's Bajonka: PAGE 2 (soundcheck prompt), saveCount 3, slot 2", r.p.snap.vars.saveCount === 3 && r.p.slot === 2 && r.p.saves[1] === true, { vars: r.p.snap.vars, slot: r.p.slot, saves: r.p.saves });
      await reloadCheck("Palmer's page", 2, { map: 'palmers', x: 3, y: 4, party: 'lucky,phoenix,ryan', flags: { hasPalmersFlyer: true } });
      // the rubble Bajonka → PAGE 3; three pages in use; CONTINUE picks the newest
      await flags({ onStage: true, mohawkOff: true, eternityArmed: true, eternityFired: true, eternityDone: true, ryanQuit: true, luckyRageLocked: true, ch1Complete: true });
      await ev(() => window.__slime.removeParty('ryan'));
      p = await warp('palmers_rubble', 16, 9, 'left');
      choice.clipboard = 3;
      r = await interact('rubble clipboard: PAGE 3');
      await check('rubble Bajonka: PAGE 3, three pages in use', r.p.snap.vars.saveCount === 4 && r.p.slot === 3 && r.p.saves.every((v) => v), { vars: r.p.snap.vars, saves: r.p.saves });
      await reloadCheck('rubble page', 3, { map: 'palmers_rubble', x: 16, y: 9, party: 'lucky,phoenix', flags: { ch1Complete: true } });
      p = await probe();
      await check('Lucky rage-locked on the reloaded rubble page', p.player.sheet === 'lucky_rage', p.player.sheet);
      // Title → CONTINUE picks the newest (3), then page 1 re-initialed becomes the newest
      uiPlan.push({ match: (l) => l[0] === 'Items' && l.includes('Quit'), pick: 5 }, { match: (l) => l[0] === 'Quit to title', pick: 0 });
      choice.title = 1;
      await press('menu');
      p = await drive('Quit to title → CONTINUE (newest = 3)', (q) => q.scene === 'Explore' && q.idle && q.snap.map === 'palmers_rubble', { timeout: 60_000 });
      await check('CONTINUE picks the newest page (3)', p.slot === 3 && uiPlan.length === 0, { slot: p.slot, plan: uiPlan.length });
      uiPlan.length = 0;
      await sleep(30);
      await ev(() => window.__slime.save(1));
      uiPlan.push({ match: (l) => l[0] === 'Items' && l.includes('Quit'), pick: 5 }, { match: (l) => l[0] === 'Quit to title', pick: 0 });
      await press('menu');
      p = await drive('Quit to title → CONTINUE (newest = 1 again)', (q) => q.scene === 'Explore' && q.idle, { timeout: 60_000 });
      await check('CONTINUE follows savedAt: page 1 re-initialed is the newest', p.slot === 1 && p.snap.map === 'palmers_rubble', { slot: p.slot, map: p.snap.map });
      uiPlan.length = 0;
    });

    // ==== S9: the menu key during every cutscene type; the pause menu on every map ==========================
    await section('S9 menu discipline', async () => {
      const menuDuring = async (label, pred, { timeout = 30_000 } = {}) => {
        const p = await drive(`${label}: wait`, pred, { timeout });
        await press('menu');
        await ev(() => window.__slime.steps(3));
        const q = await probe();
        await check(`menu key during ${label} opens nothing`, !q.menuActive && q.scene !== 'Menu', { scene: q.scene, menuActive: q.menuActive, top: q.ui && q.ui.top && q.ui.top.type });
        return p;
      };
      // say + choice (the jukebox), insert (the gig flyer), caption (the rail), battle count-in, freefall
      await setup({ flags: SPINE_NIGHT, party: ['phoenix', 'ryan'], map: 'palmers', x: 16, y: 11, facing: 'up' });
      await press('confirm');
      await menuDuring('a say box', (q) => say(q).state === 'complete');
      await menuDuring('a choice', (q) => !!menu(q) && menu(q).labels[0] === 'Pothole Blues');
      await driveIdle('jukebox done');
      await flags({ hasPalmersFlyer: false, gigFlyer: false });
      await ev(() => { const st = window.__slime.state; st.inventory.remove('palmers_flyer', 9); });
      await warp('room4', 6, 7, 'right');
      await press('confirm');
      // an insert with a caption stacks its narrator box on top: the insert shows up in `kinds`, not as `top`
      await menuDuring('an insert window', (q) => !!(q.ui && q.ui.kinds && q.ui.kinds.includes('insert') && (say(q).state === 'complete' || (q.ui.top && q.ui.top.type === 'insert' && q.ui.top.state === 'open'))));
      await driveIdle('flyer read');
      await warp('street_cedar', 22, 15, 'down');
      await press('down');
      // the card lasts 100 ms under ?fast=1: catch it in-page and press the menu key on that very frame
      const capHit = await ev(() => window.__slime.waitFor(() => { const t = window.__slime.services.ui.debugState().top; return !!(t && t.type === 'caption' && t.state === 'open'); }, 8000).then(() => { window.__slime.press('menu'); return true; }).catch(() => false));
      await ev(() => window.__slime.steps(2));
      let q = await probe();
      await check('menu key during a caption card opens nothing (card seen)', capHit === true && !q.menuActive, { capHit, menuActive: q.menuActive, scene: q.scene });
      await driveIdle('rail → hall');
      let p = await probe();
      await check('the rail still landed in the hall after the stray menu press', p.snap.map === 'city_sound_hall', pos(p));
      choice.yesNo = 1;
      // battle count-in
      await setup({ flags: SPINE_HUB, party: ['phoenix'], level: XP_TABLE[4], map: 'street_cedar', x: 15, y: 12, facing: 'right' });
      await press('right');
      await menuDuring('a battle count-in', (q) => q.scene === 'Battle', { timeout: 20_000 });
      battlePlan = bailPlan;
      p = await driveIdle('bail out of the slush');
      battlePlan = winPlan;
      await check('Explore resumed cleanly after the battle with the stray menu press', p.scene === 'Explore' && p.idle && !p.menuActive, { scene: p.scene, menuActive: p.menuActive });
      // freefall
      await setup({ flags: ['podIntro', 'podSpeakerSlapped', 'visited_pod_bay'], level: XP_TABLE[2], map: 'pod_bay', x: 7, y: 11, facing: 'left' });
      choice.eject = 0;
      await press('confirm');
      await menuDuring('the freefall', (q) => q.scene === 'Freefall', { timeout: 20_000 });
      battlePlan = winPlan;
      p = await drive('freefall → crash → drone', (q) => idleOnMap(q) && q.snap.map === 'alley' && q.snap.flags.droneDefeated === true, { timeout: 120_000 });
      await check('the alley, the drone, Phoenix joined after the freefall with the stray menu press', p.snap.flags.phoenixJoined === true && party(p.snap) === 'lucky,phoenix', { party: party(p.snap), flags: p.snap.flags.phoenixJoined });
      choice.eject = 1;

      // the pause menu on every map: Items / Riffs / Equip / Status / Save (grayed without the dog) / close
      await setup({ flags: [...SPINE_HALL, 'visited_room4', 'visited_palmers', 'visited_garage_north', 'visited_rooftops', 'visited_coffee_shop'], party: ['phoenix', 'brian'], items: { pizza_slice: 1 } });
      const mapsToVisit = [['pod_bay', 7, 10, 'up'], ['alley', 9, 9, 'down'], ['street_cedar', 12, 9, 'down'], ['apartment', 12, 11, 'up'], ['coffee_shop', 10, 11, 'up'], ['rooftops', 2, 7, 'right'], ['garage_north', 8, 9, 'up'], ['city_sound_hall', 3, 7, 'right'], ['room4', 4, 9, 'right'], ['palmers', 8, 12, 'up'], ['palmers_rubble', 16, 9, 'right']];
      const fullTour = new Set(['pod_bay', 'city_sound_hall', 'palmers_rubble']); // Items/Riffs/Equip/Status everywhere is the same code: three maps get the full visit
      for (const [map, x, y, facing] of mapsToVisit) {
        p = await warp(map, x, y, facing, `pause menu on ${map}`);
        if (fullTour.has(map)) {
          uiPlan.push(
            { match: (l) => l[0] === 'Items' && l.includes('Save'), pick: 0 },
            { match: (l) => /x\d+$/.test(l[0]), pick: 'cancel' },
            { match: (l) => l[0] === 'Items' && l.includes('Save'), pick: 1 },
            { match: (l) => l[0] === 'Items' && l.includes('Save'), pick: 2 },
            { match: (l) => l[0] === 'Lucky' && l[1] === 'Phoenix', pick: 'cancel' },
            { match: (l) => l[0] === 'Items' && l.includes('Save'), pick: 3 },
          );
        }
        await press('menu');
        p = await drive(`pause menu tour on ${map}`, (q) => { if (q.ui && q.ui.top && q.ui.top.type === 'menu' && q.ui.top.state === 'open' && uiPlan.length === 0) return true; return idleOnMap(q) && !q.menuActive; }, { timeout: 60_000 });
        // at the top menu again: walk the cursor; Save (row 4) must be skipped when no dog is adjacent
        const landed = [];
        for (let i = 0; i < 8; i++) { const q = await probe(); const m = menu(q); if (!m) break; landed.push(m.selected); await press('down'); }
        const dogAdjacent = (p.entities || []).some((e) => e.type === 'save' && Math.abs(e.x - p.player.x) + Math.abs(e.y - p.player.y) === 1);
        await check(`${map}: pause menu ${fullTour.has(map) ? 'Items/Riffs/Equip/Status visited' : 'opened'}; Save ${dogAdjacent ? 'lit' : 'grayed (Find the dog)'}`, uiPlan.length === 0 && landed.length >= 6 && (dogAdjacent ? landed.includes(4) : !landed.includes(4)), { landed, dogAdjacent, plan: uiPlan.length });
        await press('cancel');
        p = await driveIdle(`close the pause menu on ${map}`);
        await check(`${map}: the pause menu closed; game idle, Explore active`, p.idle && !p.menuActive && p.exploreState === 'active' && p.lastErrors === 0, { idle: p.idle, menuActive: p.menuActive, exploreState: p.exploreState, errors: p.lastErrors });
        uiPlan.length = 0;
      }
    });

    // ==== S10: every NPC and object on every map, two presses each ==============================================
    await section('S10 interactions', async () => {
      const sweep = async (map, spot, flagsOn, opts = {}) => {
        await flags(Object.fromEntries(flagsOn.map((f) => [f, true])));
        if (opts.off) await flags(Object.fromEntries(opts.off.map((f) => [f, false])));
        let p = await warp(map, spot[0], spot[1], spot[2], `sweep ${map}`);
        let list = await ev(() => window.__wrong.scripted());
        if (opts.order) list = list.sort((a, b) => (opts.order.indexOf(a.id) + 1 || 999) - (opts.order.indexOf(b.id) + 1 || 999));
        const skip = new Set(opts.skip || []);
        const results = [];
        for (const e of list) {
          if (skip.has(e.id)) continue;
          if (e.behavior === 'wander' || e.behavior === 'patrol') await ev((id) => window.__wrong.setBehavior(id, 'idle'), e.id);
          // a step already under way finishes after the switch to idle: wait for the feet to land
          await ev((id) => window.__slime.waitFor(() => { const en = window.__slime.explore().entities.get(id); return !en || !en.moving; }, 3000).catch(() => false), e.id);
          const texts = [];
          let silent = false;
          let reachable = true;
          let still = true;
          let consumed = false;
          for (let n = 0; n < 2; n++) {
            const adj = await ev((id) => window.__wrong.adjacentSpot(id), e.id);
            if (!adj) {
              // the first press used the object up (the bass stand, the gig flyer): its condition now hides it
              if (n === 1 && !(await ev((id) => window.__wrong.entity(id), e.id))) { consumed = true; break; }
              reachable = false; break;
            }
            await place(adj.x, adj.y, adj.facing);
            const r = await interact(`${map}:${e.id} press ${n + 1}`, { timeout: 60_000 });
            if (!r.opened) silent = true;
            texts.push(r.texts.map((t) => `${t.who}: ${t.text}`));
            p = r.p;
            if (!p.idle) still = false;
          }
          if (e.behavior === 'wander' || e.behavior === 'patrol') await ev(({ id, b }) => window.__wrong.setBehavior(id, b), { id: e.id, b: e.behavior });
          const all = texts.flat();
          const bad = all.filter((t) => !/^[a-z_]+: .+/.test(t) || /undefined|\[object|NaN/.test(t));
          const ok = reachable && !silent && texts.length >= 1 && texts.every((pg) => pg.length >= 1) && bad.length === 0 && still;
          results.push({ id: e.id, ok, reachable, silent, consumed, pages: texts.map((pg) => pg.length), bad, texts: all.slice(0, 4) });
          if (!ok) await check(`${map}:${e.id} both presses produce text, no undefined, lock released`, false, { reachable, silent, texts, bad, idle: p.idle });
        }
        const good = results.filter((r) => r.ok).length;
        await check(`${map}${opts.tag ? ` (${opts.tag})` : ''}: ${good}/${results.length} scripted entities talked to twice`, results.length > 0 && good === results.length, results.filter((r) => !r.ok).map((r) => r.id));
        return results;
      };
      await setup({ flags: [], map: 'pod_bay', x: 7, y: 10, facing: 'up' });
      await sweep('pod_bay', [7, 10, 'up'], [], { order: ['eject', 'guitar_case', 'nameplate', 'pod1', 'vending', 'plaque', 'viewport', 'viewport_b', 'rail_w', 'rail_e', 'speaker'], tag: 'Dad talking: EJECT refused, then the speaker' });
      let p = await probe();
      await check('pod bay: the speaker got slimed during the sweep; EJECT then offers the choice', p.snap.flags.podSpeakerSlapped === true, p.snap.flags);
      await place(7, 11, 'left');
      choice.eject = 1;
      let r = await interact('EJECT: Not yet.');
      await check('EJECT → Not yet. stays in the pod bay', r.texts.some((t) => t.text.includes('unnecessarily red button')) && r.p.snap.map === 'pod_bay' && r.p.snap.flags.ejected !== true, r.texts);
      // the alley before and after the drone
      await sweep('alley', [9, 9, 'down'], ['visited_alley', 'ejected', 'podIntro', 'podSpeakerSlapped'], { tag: 'before the drone: Phoenix on her feet, the crate empty' });
      await ev(() => window.__slime.addParty('phoenix'));
      await sweep('alley', [9, 9, 'down'], ['metPhoenix', 'droneDefeated', 'phoenixJoined'], { tag: 'after the drone' });
      // the apartment: before the signal / after; the bass taken
      await sweep('apartment', [12, 11, 'up'], ['visited_apartment'], { off: ['signalSent', 'weekLater'], skip: ['amp'], tag: 'before the signal' });
      await sweep('apartment', [12, 11, 'up'], ['signalSent', 'weekLater', 'hubOpen'], { tag: 'ONE WEEK LATER' });
      // the hub by day (closed and open) and by night
      // (the hub-closed first pass differs only at the pawn door, which S5 covers)
      await sweep('street_cedar', [38, 12, 'left'], ['hubOpen'], { skip: ['slush', 'scooters', 'goose', 'analyst', 'billboard', 'analyst_duo', 'goose_pair'], tag: 'day, hub open' });
      await sweep('street_cedar', [38, 12, 'left'], ['hasPalmersFlyer', 'gigFlyer', 'eternityDone'], { skip: ['slush', 'scooters', 'goose', 'analyst', 'billboard', 'analyst_duo', 'goose_pair', 'bajonka'], tag: 'night' });
      await flags({ hasPalmersFlyer: false, gigFlyer: false, eternityDone: false });
      // the café before and after Brian
      await ev(() => { const st = window.__slime.state; st.inventory.remove('flyer_blank', 9); });
      await sweep('coffee_shop', [10, 11, 'up'], [], { off: ['flyerPosted', 'brianJoined'], tag: 'before the flyer' });
      await ev(() => window.__slime.addParty('brian'));
      await sweep('coffee_shop', [10, 11, 'up'], ['flyerPosted', 'brianJoined', 'ryanCalled'], { tag: 'after Brian' });
      // the cutscene maps
      await sweep('garage_north', [8, 9, 'up'], [], { tag: 'cutscene map' });
      await sweep('rooftops', [2, 7, 'right'], [], { tag: 'cutscene map' });
      // City Sound: before Ryan, after Ryan
      // door_2 is unreachable on purpose: the Noise Guy stands in Room 2's doorway (he is the line)
      await sweep('city_sound_hall', [3, 7, 'right'], ['visited_city_sound_hall'], { off: ['ryanArrived', 'hasBajonka', 'monthLater'], skip: ['bajonka', 'door_2'], tag: 'before Ryan: the ska band, the clipboard' });
      await sweep('city_sound_hall', [3, 7, 'right'], ['ryanArrived', 'hasBajonka'], { skip: ['bajonka', 'door_2'], tag: 'after Ryan' });
      // Room 4: the audition setup, the month, after Brian
      await sweep('room4', [4, 9, 'right'], ['visited_room4', 'ryanArrived'], { off: ['ryanJoined', 'monthLater', 'auditionDone', 'brianQuit'], tag: 'Ryan at the kit' });
      await ev(() => window.__slime.addParty('ryan'));
      await sweep('room4', [4, 9, 'right'], ['auditionDone', 'ryanJoined', 'monthLater', 'monthLaterRan'], { tag: 'ONE MONTH LATER' });
      await ev(() => window.__slime.removeParty('brian'));
      await sweep('room4', [4, 9, 'right'], ['pedalboardFried', 'brianQuit'], { skip: ['gig_flyer'], tag: 'after Brian' });
      // Palmer's and the rubble
      await flags({ hasPalmersFlyer: true, gigFlyer: true });
      await sweep('palmers', [8, 12, 'up'], [], { skip: ['bajonka'], tag: 'the crowd' });
      await ev(() => window.__slime.removeParty('ryan'));
      await sweep('palmers_rubble', [16, 9, 'right'], ['eternityDone', 'ryanQuit', 'luckyRageLocked', 'ch1Complete'], { skip: ['bajonka'], tag: 'the rubble' });
      p = await probe();
      await check('no undefined / [object anywhere in the dialogue seen so far', !seen.some((t) => /undefined|\[object|NaN/.test(t.text)), seen.filter((t) => /undefined|\[object|NaN/.test(t.text)).slice(0, 5));
    });

    // ==== S11: map edges and solids; every exit from both sides ===================================================
    await section('S11 edges and exits', async () => {
      await setup({ flags: [...SPINE_HALL, 'visited_room4', 'visited_palmers', 'visited_garage_north', 'visited_rooftops', 'visited_coffee_shop'], party: ['phoenix', 'brian'] });
      const edgeMaps = [['pod_bay', 7, 10, 'up'], ['alley', 9, 9, 'down'], ['street_cedar', 12, 9, 'down'], ['apartment', 12, 11, 'up'], ['coffee_shop', 10, 11, 'up'], ['rooftops', 2, 7, 'right'], ['garage_north', 8, 9, 'up'], ['city_sound_hall', 3, 7, 'right'], ['room4', 4, 9, 'right'], ['palmers', 8, 12, 'up'], ['palmers_rubble', 16, 9, 'right']];
      const inZone = (z, x, y) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;
      for (const [map, x, y, facing] of edgeMaps) {
        await warp(map, x, y, facing, `edges ${map}`);
        const r = await ev(() => window.__wrong.edgeSweep());
        await check(`${map}: ${r.blockedTests} steps into edges/solids from ${r.freeTiles} free tiles never move the player`, r.escaped.length === 0 && r.blockedTests > 0, { escaped: r.escaped.slice(0, 6), blockedTests: r.blockedTests });
        const strayExits = r.changes.filter((c) => !r.zones.some((z) => z.type === 'exit' && inZone(z, c.from.x, c.from.y)));
        const strayScripts = r.runs.filter((c) => !r.zones.some((z) => inZone(z, c.at.x, c.at.y)));
        const exitsFired = r.zones.filter((z) => z.type === 'exit').map((z) => ({ id: z.id, fired: r.changes.some((c) => inZone(z, c.from.x, c.from.y) && c.map === z.to.map && c.x === z.to.x && c.y === z.to.y), refused: r.runs.some((c) => inZone(z, c.at.x, c.at.y) && c.id === z.refuse), gated: !!z.condition }));
        const wrongTarget = r.changes.filter((c) => !r.zones.some((z) => z.type === 'exit' && inZone(z, c.from.x, c.from.y) && c.map === z.to.map && c.x === z.to.x && c.y === z.to.y));
        await check(`${map}: no exit fires outside its zone, every open exit leads where the map says`, strayExits.length === 0 && wrongTarget.length === 0 && exitsFired.every((e) => e.fired || e.gated), { strayExits, wrongTarget, exitsFired });
        await check(`${map}: no script fires outside a trigger zone`, strayScripts.length === 0, strayScripts.slice(0, 6));
        const p = await probe();
        await check(`${map}: the sweep left the game idle in place`, p.idle && p.snap.map === map && at(p, x, y), pos(p));
      }
      // every exit from both sides with real presses
      const hop = async (label, dir, want) => {
        await press(dir);
        const p = await driveIdle(label, { timeout: 30_000 });
        const ok = p.snap.map === want.map && at(p, want.x, want.y);
        await check(`${label} → ${want.map} (${want.x},${want.y})`, ok, pos(p));
        return p;
      };
      await flags({ hubOpen: true, gigFlyer: false, hasPalmersFlyer: false, onStage: false, visited_room4: true, visited_palmers: true });
      await warp('alley', 1, 9, 'right');
      await hop('alley west edge', 'left', { map: 'street_cedar', x: 38, y: 12 });
      await hop('street east edge back', 'right', { map: 'alley', x: 1, y: 9 });
      await warp('street_cedar', 12, 9, 'up');
      await hop('Towers door', 'up', { map: 'apartment', x: 12, y: 12 });
      await hop('apartment door back', 'down', { map: 'street_cedar', x: 12, y: 9 });
      await warp('street_cedar', 20, 9, 'up');
      await hop('café door', 'up', { map: 'coffee_shop', x: 10, y: 12 });
      await hop('café door back', 'down', { map: 'street_cedar', x: 20, y: 9 });
      await flags({ gigFlyer: true, hasPalmersFlyer: true });
      await warp('street_cedar', 6, 9, 'up');
      await hop("Palmer's door", 'up', { map: 'palmers', x: 8, y: 12 });
      await hop("Palmer's door back", 'down', { map: 'street_cedar', x: 6, y: 9 });
      await flags({ gigFlyer: false, hasPalmersFlyer: false });
      await warp('city_sound_hall', 3, 6, 'left');
      await hop('hall stairs', 'left', { map: 'street_cedar', x: 22, y: 15 });
      await hop('the rail back', 'down', { map: 'city_sound_hall', x: 3, y: 6 });
      await warp('city_sound_hall', 20, 6, 'up');
      await hop('Room 4 door', 'up', { map: 'room4', x: 3, y: 9 });
      await hop('Room 4 door back', 'down', { map: 'city_sound_hall', x: 20, y: 6 });
      // the refusals
      const refuse = async (label, map, x, y, dir, text, setFlags) => {
        await flags(setFlags);
        await warp(map, x, y, dir);
        const before = seen.length;
        await press(dir);
        let p = await driveIdle(label, { timeout: 30_000 });
        if (seen.length === before) { const r = await interact(`${label}: confirm`); p = r.p; } // a solid door: the line is on confirm
        const said = seen.slice(before).map((t) => t.text);
        await check(`${label}: refused with "${text}", still on ${map}`, p.snap.map === map && said.some((t) => t.includes(text)), { pos: pos(p), said });
      };
      await refuse('café closed before the hub opens', 'street_cedar', 20, 9, 'up', 'lie down in a specific way', { hubOpen: false });
      await refuse("Palmer's closed before the flyer", 'street_cedar', 6, 9, 'up', 'Closed until', { hubOpen: true, gigFlyer: false, hasPalmersFlyer: false });
      await refuse('the rail before the call', 'street_cedar', 22, 15, 'down', 'The reason to take it', { ryanCalled: false, brianCalledRyan: false });
      await refuse('Room 4 before Ryan arrives', 'city_sound_hall', 20, 6, 'up', 'soundproof', { ryanArrived: false });
      await refuse("Palmer's door while on stage", 'palmers', 8, 12, 'down', 'The door can wait', { gigFlyer: true, hasPalmersFlyer: true, onStage: true });
      await flags({ onStage: false, ryanCalled: true, ryanArrived: true });
      await warp('alley', 1, 9, 'left');
      await flags({ phoenixJoined: false });
      await press('left');
      let p = await driveIdle('alley west edge before Phoenix joins');
      await check('the alley west exit is gated (no map change, no text) before Phoenix joins', p.snap.map === 'alley' && at(p, 0, 9), pos(p));
      await flags({ phoenixJoined: true });
    });

    // ==== S12: M and F toggles during explore and battle ======================================================
    await section('S12 toggles', async () => {
      await setup({ flags: SPINE_HUB, party: ['phoenix'], level: XP_TABLE[4], map: 'street_cedar', x: 15, y: 12, facing: 'right' });
      let p = await probe();
      const t0 = p.toggles;
      await press('mute'); await press('fullscreen'); await press('mute');
      await ev(() => window.__slime.steps(3));
      p = await probe();
      await check('M and F during explore count as toggles and throw nothing', p.toggles.mute === t0.mute + 2 && p.toggles.fullscreen === t0.fullscreen + 1 && p.lastErrors === 0, { before: t0, after: p.toggles, errors: p.lastErrors });
      battlePlan = bailPlan;
      await press('right');
      p = await drive('slush battle for the toggles', (q) => battleMenu(q, 'hub_slush'), { timeout: 30_000 });
      await press('mute'); await press('fullscreen'); await press('fullscreen');
      await ev(() => window.__slime.steps(3));
      p = await probe();
      await check('M and F during a battle count as toggles and throw nothing; the command window is still open', p.toggles.mute === t0.mute + 3 && p.toggles.fullscreen === t0.fullscreen + 3 && p.lastErrors === 0 && battleMenu(p, 'hub_slush'), { toggles: p.toggles, errors: p.lastErrors, menu: p.battle && p.battle.menu && p.battle.menu.kind });
      p = await driveIdle('bail out');
      battlePlan = winPlan;
      await check('back on the map after the toggled battle', p.scene === 'Explore' && p.idle, { scene: p.scene });
    });

    // ---- hygiene on the fast page --------------------------------------------------------------------------
    await section('hygiene', async () => {
      const lastErrors = await ev(() => window.__slime.lastErrors);
      await check('__slime.lastErrors is empty on the fast page', Array.isArray(lastErrors) && lastErrors.length === 0, lastErrors.slice(0, 10));
      await page.close().catch(() => {});
    });

    // ==== S13: one segment at real speed (no ?fast=1): New Game → pod bay → EJECT → freefall → crash → drone ====
    {
      await section('S13 real speed', async () => {
        const t0 = Date.now();
        page = await openPage('mute=1');
        realSpeed.on = true;
        await ev(() => { window.__slime.textInstant(false); window.__slime.autoAdvance(false); });
        choice.title = 0;
        choice.eject = 0;
        battlePlan = winPlan;
        let p = await probe();
        await check('real speed: title up', p.scene === 'Title' && !!menu(p), p.scene);
        await press('confirm');
        p = await driveIdle('real speed: CS-01', { timeout: 60_000 });
        await check('real speed: CS-01 played at normal text speed', p.snap.map === 'pod_bay' && p.snap.flags.podIntro === true && at(p, 7, 11), pos(p));
        p = await walk('UUUUUUUU', 'real speed: catwalk');
        await check('real speed: the four Dad floor bands fired on the way up', at(p, 7, 3) && ['dad_1', 'dad_2', 'dad_3', 'dad_4'].every((id) => p.snap.flags[`trig_pod_bay_${id}`] === true), pos(p));
        await press('up');
        await press('confirm');
        p = await driveIdle('real speed: CS-02', { timeout: 60_000 });
        await check('real speed: the speaker slapped (the FF window collapse at normal speed)', p.snap.flags.podSpeakerSlapped === true, p.snap.flags);
        p = await walk('DDDDDDDD', 'real speed: back to the pod');
        await check('real speed: the mmf twins fired at slow speed', at(p, 7, 11) && p.snap.flags.trig_pod_bay_dad_1_mmf === true, p.snap.flags);
        await press('left');
        await press('confirm');
        const t1 = Date.now();
        p = await drive('real speed: EJECT → freefall → crash → drone', (q) => idleOnMap(q) && q.snap.map === 'alley' && q.snap.flags.droneDefeated === true, { timeout: 170_000 });
        await check('real speed: freefall ran its full course (not skipped) and tagged billboards', typeof p.snap.vars.billboardsTagged === 'number' && Date.now() - t1 >= 24_000, { vars: p.snap.vars, ms: Date.now() - t1 });
        await check('real speed: the drone fell, Phoenix joined, autosave 1 in the alley', p.snap.flags.phoenixJoined === true && party(p.snap) === 'lucky,phoenix' && p.snap.vars.lastAutosave === 'alley' && p.saves[0] === true && has(p.snap, 'slime_sunglasses'), { party: party(p.snap), vars: p.snap.vars, saves: p.saves });
        p = await loadSlot(1, 'real speed: reload the alley autosave');
        await check('real speed: the alley autosave reloads (alley, the band, droneDefeated, Phoenix trailing)', p.snap.map === 'alley' && party(p.snap) === 'lucky,phoenix' && p.snap.flags.droneDefeated === true && p.followers.some((f) => f.id === 'phoenix'), { pos: pos(p), party: party(p.snap), followers: p.followers });
        report.realSpeedMs = Date.now() - t0;
        await check('real speed segment under 3 minutes', report.realSpeedMs < 180_000, report.realSpeedMs);
        const lastErrors = await ev(() => window.__slime.lastErrors);
        await check('__slime.lastErrors is empty on the real-speed page', Array.isArray(lastErrors) && lastErrors.length === 0, lastErrors.slice(0, 10));
        realSpeed.on = false;
      });
    }

    // ---- the real-speed child's report ------------------------------------------------------------------------
    if (realChild) {
      currentSection = 'S13 real speed';
      const { code, out } = await realChild;
      let r = null;
      try { r = JSON.parse(out.trim().split('\n').filter(Boolean).pop()); } catch { r = null; }
      await check('the real-speed child process reported', !!r && typeof r.checks === 'number', { code, tail: out.slice(-300) });
      if (r) {
        report.realSpeedMs = r.realSpeedMs;
        extraChecks += r.checks;
        for (const f of r.failures || []) failures.push(f);
        for (const sh of r.screenshots || []) screenshots.push(sh);
        for (const n of r.notes || []) notes.push(n);
        for (const [k, v] of Object.entries(r.sections || {})) if (k !== 'console') sections[k] = v;
        report.childWarnings = r.warnings || [];
      }
    }

    // ---- console hygiene -----------------------------------------------------------------------------------
    currentSection = 'console';
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error').map((m) => m.text);
    const suspicious = consoleMessages.filter((m) => (m.type === 'error' || m.type === 'warning') && /Error|undefined/.test(m.text)).map((m) => `${m.type}: ${m.text}`);
    await check('no console error', consoleErrors.length === 0, consoleErrors.slice(0, 10));
    await check('no console error/warning mentioning "Error" or "undefined"', suspicious.length === 0, suspicious.slice(0, 10));
    report.consoleErrors = consoleErrors.slice(0, 20);
    report.warnings = [...new Set(consoleMessages.filter((m) => m.type === 'warning').map((m) => m.text))].slice(0, 20);
    report.ok = failures.length === 0;
  } catch (err) {
    failures.push(`fatal: ${err && err.stack ? err.stack : String(err)}`);
    report.ok = false;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }
  report.checks = checks.length + extraChecks;
  report.durationMs = Date.now() - startedAt;
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write(`${JSON.stringify({ test: 'chapter1_wrong', ok: false, failures: [`fatal: ${err && err.stack ? err.stack : String(err)}`] })}\n`);
  process.exit(1);
});
