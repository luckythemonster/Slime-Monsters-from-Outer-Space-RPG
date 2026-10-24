#!/usr/bin/env node
// Chapter 1 honest playthrough: NEW GAME → pod bay → freefall → alley (drone) → street → apartment
// (the signal, ONE WEEK LATER) → café (flyer, Brian) → the hub chokepoints (Slush Pile, Scooters) →
// the rail → City Sound (Bajonka, PAGE 2) → Room 4 (AUDITION, contract, ONE MONTH LATER, the Chorus,
// the ultimatum) → a real Title → CONTINUE reload of PAGE 2 and replay → the flyer → the street at
// night (save) → Palmer's (THE SET) → the rubble → NEXT: THE POTATO BELT → Title → CONTINUE.
//
// Only player-equivalent input is used: `press` of mapped keys (one tile per press), menus and choices
// are navigated with the cursor keys and confirm, dialogue is advanced with confirm, battles are
// fought through the command window (reading the HUD the way a player reads the screen). No warp,
// setFlag, give, setMoney, addParty, startBattle or runScript. `textInstant` is on for speed;
// `autoAdvance` stays off so every window is driven (and screenshotted) by hand. A lost battle goes
// Game Over → Title → CONTINUE → the last initialed page and the segment is replayed (max 3 retries).
//
//   node tests/chapter1.mjs                       (EXPLORE_KEEP_DIST=1 reuses dist/)
//
// Part of tests/run.mjs (after content_c.mjs). Knobs: PLAYWRIGHT_MODULE, SMOKE_CHROME, EXPLORE_KEEP_DIST=1.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
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
const SCENE_TIMEOUT_MS = 240_000;
const POLL_MS = 40;
const MAX_RETRIES = 3;
const VIEWPORT = { width: 1024, height: 896 };
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const DIRS = { U: 'up', D: 'down', L: 'left', R: 'right' };
/** DESIGN.md "XP table": the critical-path budget. */
const BUDGET = { audition: 3, palmers: 5, end: 7 };

const log = (m) => process.stderr.write(`[chapter1] ${m}\n`);
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

// ---- in-page probe: what the player can see ------------------------------------------------------

/** Runs in the page. Scene, idle state, the GameState snapshot, the open UI widget and the battle HUD. */
function probeFn() {
  const s = window.__slime;
  const sv = s.services;
  const scene = s.scene();
  const snap = s.state ? s.state.snapshot() : { flags: {}, vars: {}, party: [], inventory: [] };
  const ex = s.explore ? s.explore() : null;
  const out = {
    scene, idle: s.idle(), snap, ui: sv.ui ? sv.ui.debugState() : null,
    runner: !!(ex && ex.runner && ex.runner.running), lock: ex ? ex.lockCount : 0, transitioning: !!(ex && ex.transitioning),
    player: null, entities: [], followers: [], overlay: null, battle: null, titleSeen: window.__titleSeen || 0, exploreSeen: window.__exploreSeen || 0, slot: s.state ? s.state.slot : null,
    uiBusy: !!(sv.ui && sv.ui.isBusy()), uiKinds: sv.ui ? sv.ui.debugState().kinds : [], moving: !!(ex && ex.player && ex.player.moving),
  };
  if (ex && ex.player) {
    out.player = { x: ex.player.tileX, y: ex.player.tileY, facing: ex.player.facing, moving: !!ex.player.moving, sheet: ex.player.sheet };
    out.entities = [...ex.entities.values()].map((e) => ({ id: e.id, type: e.type, x: e.tileX, y: e.tileY, facing: e.facing, behavior: e.behavior, visible: e.visible, sheet: e.sheet }));
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
      id: m.encounterId, round: m.round, toon: m.toonLevel, meter: m.meter, ended: m.ended, result: m.result, inputLocked: !!m.inputLocked,
      actor: cur ? cur.uid : null, menu,
      party: m.party().map(comb), enemies: m.enemies().map(comb),
      commands: mine ? m.commands(cur.uid).map((c) => ({ id: c.id, disabled: !!c.disabled })) : [],
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
const cap = (p) => { const c = topOf(p, 'caption'); return c && c.state === 'open' ? c : {}; };
const menu = (p) => { const m = topOf(p, 'menu'); return m && m.state === 'open' ? m : null; };
const battleMenu = (p, id) => !!(p.battle && p.battle.id === id && p.battle.menu && p.battle.menu.kind === 'command' && p.battle.menu.state === 'open');
const has = (s, id) => (s.inventory || []).some((e) => e.id === id);
const qty = (s, id) => ((s.inventory || []).find((e) => e.id === id) || {}).qty || 0;
const party = (s) => (s.party || []).map((m) => m.id).join(',');
const member = (s, id) => (s.party || []).find((m) => m.id === id) || null;
const ent = (p, id) => (p.entities || []).find((e) => e.id === id) || null;
const levelsOf = (s) => Object.fromEntries((s.party || []).map((m) => [m.id, m.level]));

// ---- the battle brain: what a player would pick from the command window ------------------------------

function makePlan(b) {
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

// ---- the test -------------------------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const failures = [];
  const checks = [];
  const screenshots = [];
  const notes = [];
  const consoleMessages = [];
  const retryLog = [];
  const levels = { audition: null, palmers: null, end: null, budget: BUDGET };
  const report = { test: 'chapter1', ok: false, checks: 0, failures, levels, retries: 0, durationMs: 0, screenshots, notes, warnings: [], consoleErrors: [] };
  const check = (name, ok, detail) => {
    checks.push({ name, ok: !!ok });
    if (!ok) { failures.push(`${name}${detail !== undefined ? ` (${JSON.stringify(detail)})` : ''}`); log(`FAIL ${name} ${detail !== undefined ? JSON.stringify(detail) : ''}`); }
  };

  if (process.env.EXPLORE_KEEP_DIST === '1' && existsSync(path.join(DIST, 'index.html'))) log('EXPLORE_KEEP_DIST=1, reusing dist/');
  else build();

  const pw = loadPlaywright();
  const { server, port } = await serveStatic(DIST);
  const url = `http://127.0.0.1:${port}/?fast=1&mute=1`;
  let browser = null;
  mkdirSync(SHOTS, { recursive: true });

  try {
    browser = await launch(pw.chromium);
    const page = await (await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })).newPage();
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => failures.push(`pageerror: ${err && err.message ? err.message : String(err)}`));
    page.on('requestfailed', (req) => failures.push(`requestfailed: ${req.url()} (${req.failure()?.errorText ?? '?'})`));
    page.on('response', (res) => { if (res.status() >= 400) failures.push(`http ${res.status()}: ${res.url()}`); });

    const ev = (fn, arg) => page.evaluate(fn, arg);
    const probe = () => ev(probeFn);
    const press = (action) => ev((a) => window.__slime.press(a), action);
    const taken = new Set();
    const shot = async (name, { freeze = true, delay = 0 } = {}) => {
      if (taken.has(name)) return;
      taken.add(name);
      if (delay) await sleep(delay);
      // Freeze the game loop for the capture so a 100 ms card or a mid-animation frame is what lands on
      // disk. A widget's state flips in a promise microtask after a frame has rendered, so let two more
      // steps render first or the capture shows the frame before the window appeared.
      if (freeze) { await ev(() => window.__slime.steps(2)); await ev(() => window.__slime.game.loop.sleep()); }
      try {
        const p = path.join(SHOTS, `${name}.png`);
        await page.screenshot({ path: p });
        screenshots.push(path.relative(ROOT, p));
      } finally {
        if (freeze) await ev(() => window.__slime.game.loop.wake());
      }
    };

    // Screenshot wants: taken by the driver the first time the screen shows them.
    const WANTS = [
      { name: 'ch1_w_ff_dad', when: (p) => p.snap.map === 'pod_bay' && say(p).style === 'ff' && say(p).state === 'complete' },
      { name: 'ch1_02_freefall', when: (p) => p.scene === 'Freefall', delay: 350 },
      { name: 'ch1_03_alley_crash', when: (p) => p.snap.map === 'alley' && say(p).who === 'phoenix' && /pothole/.test(say(p).text || '') },
      { name: 'ch1_b1_drone', when: (p) => battleMenu(p, 'alley_drone') },
      { name: 'ch1_w_set_break', when: (p) => !!(p.battle && p.battle.ended && p.battle.menu && p.battle.menu.kind === 'prompt' && p.battle.menu.state === 'open') },
      { name: 'ch1_05_signal_rooftops', when: (p) => p.snap.map === 'rooftops', delay: 250 },
      { name: 'ch1_05b_signal_garage', when: (p) => p.snap.map === 'garage_north' && !!say(p).text, delay: 100 },
      { name: 'ch1_w_ryan_caption', when: (p) => say(p).style === 'caption' && say(p).state === 'complete' },
      { name: 'ch1_w_caption_plain', when: (p) => cap(p).style === 'plain' },
      { name: 'ch1_w_shop', when: (p) => !!menu(p) && menu(p).labels[0] === 'BUY' },
      { name: 'ch1_w_shop_list', when: (p) => !!menu(p) && /^Pizza Slice/.test(menu(p).labels[0] || '') },
      { name: 'ch1_08b_cafe_garage_call', when: (p) => p.snap.map === 'garage_north' && p.snap.flags.brianJoined === true, delay: 900 }, // after the camera fade-in
      { name: 'ch1_b2_slush', when: (p) => battleMenu(p, 'hub_slush') },
      { name: 'ch1_b3_scooters', when: (p) => battleMenu(p, 'hub_scooters') },
      { name: 'ch1_09b_ryan_arrives', when: (p) => p.snap.map === 'city_sound_hall' && !!ent(p, 'hardware'), delay: 500 },
      { name: 'ch1_w_clipboard', when: (p) => !!menu(p) && /^INITIAL HERE/.test(menu(p).labels[0] || '') },
      { name: 'ch1_b9_audition', when: (p) => battleMenu(p, 'ep0_audition') },
      { name: 'ch1_10b_contract', when: (p) => p.snap.map === 'room4' && !!ent(p, 'contract') && say(p).who === 'narrator' && say(p).state === 'complete' },
      { name: 'ch1_w_tape_card', when: (p) => cap(p).style === 'tape' },
      { name: 'ch1_b10_chorus', when: (p) => battleMenu(p, 'ep0_rehearsal') },
      { name: 'ch1_10c_ultimatum', when: (p) => say(p).portrait === 'brian_stroke' && say(p).state === 'complete' },
      { name: 'ch1_w_insert_flyer', when: (p) => !!(p.ui && p.ui.kinds && p.ui.kinds.includes('insert') && say(p).state === 'complete') },
      { name: 'ch1_b11_set', when: (p) => battleMenu(p, 'ep0_palmers_set') },
      { name: 'ch1_b11b_eternity', when: (p) => !!(p.battle && p.battle.id === 'ep0_palmers_set' && p.battle.party.some((c) => c.id === 'ryan' && c.form === 'eternity')), delay: 200 },
      { name: 'ch1_13b_rubble_rage', when: (p) => p.snap.map === 'palmers_rubble' && say(p).portrait === 'lucky_rage' && say(p).state === 'complete' },
      { name: 'ch1_w_insert_itinerary', when: (p) => !!(p.ui && p.ui.kinds && p.ui.kinds.includes('insert') && say(p).state === 'complete' && p.snap.map === 'palmers_rubble') },
      { name: 'ch1_w_next_card', when: (p) => cap(p).style === 'flyer' },
      { name: 'ch1_gameover', when: (p) => p.scene === 'GameOver', delay: 250 },
      { name: 'ch1_14_title_end', when: (p) => p.scene === 'Title' && p.snap.flags.ch1Complete === true && !!menu(p) },
    ];
    const takeWanted = async (p) => {
      for (const w of WANTS) {
        if (taken.has(w.name)) continue;
        let hit = false;
        try { hit = !!w.when(p); } catch { hit = false; }
        if (hit) await shot(w.name, { delay: w.delay || 0 });
      }
      if (battleMenu(p, 'ep0_audition') && !levels.audition) levels.audition = levelsOf(p.snap);
      if (battleMenu(p, 'ep0_palmers_set') && !levels.palmers) levels.palmers = levelsOf(p.snap);
    };

    // ---- UI driving --------------------------------------------------------------------------------
    /** Menus are picked by label. `uiPlan` entries are consumed in order when they match; otherwise the defaults. */
    const uiPlan = [];
    let titleChoice = 1;
    const defaultPick = (labels) => {
      const l0 = labels[0] || '';
      if (l0 === 'New Game') return titleChoice;
      if (l0 === 'EJECT') return 0;
      if (l0 === 'Nap') return 0;
      if (l0 === 'MUST PLAY FAST') return 2;
      if (/^INITIAL HERE/.test(l0)) return labels.findIndex((l) => /^PAGE 2/.test(l)); // the prompt may take two rows
      if (l0 === 'Pothole Blues') return 2;
      if (l0 === 'RAGE') return 1; // PLEAD
      if (l0 === 'Yes' && labels[1] === 'No') return 1;
      notes.push(`menu with no policy: ${JSON.stringify(labels)}; picked 0`);
      return 0;
    };
    const pickFor = (m) => {
      const head = uiPlan[0];
      if (head && head.match(m.labels)) { uiPlan.shift(); return head.pick; }
      return defaultPick(m.labels);
    };
    /** Move the list cursor to `idx` (down wraps and skips disabled rows) then confirm. */
    const navList = async (m, idx) => {
      if (idx === 'cancel') { await press('cancel'); return; }
      for (let k = 0; k < m.items + 3; k++) {
        const p = await probe();
        const t = menu(p);
        if (!t) return;
        if (t.selected === idx) { await press('confirm'); return; }
        await press('down');
      }
      notes.push(`could not reach menu row ${idx} of ${JSON.stringify(m.labels)}`);
      await press('confirm');
    };
    const handleUi = async (p) => {
      const top = p.ui.top;
      if (!top) { await sleep(POLL_MS); return; }
      if (top.type === 'say') {
        if (top.state === 'complete' || top.state === 'typing') await press('confirm');
        else await sleep(20);
      } else if (top.type === 'menu') {
        if (top.state === 'open') await navList(top, pickFor(top));
        else await sleep(20);
      } else if (top.type === 'insert') {
        if (top.state === 'open') await press('confirm');
        else await sleep(20);
      } else {
        await sleep(20); // captions close on their own
      }
    };

    // ---- battle driving ------------------------------------------------------------------------------
    let plan = null;
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
      const key = `${b.id}:${b.round}:${b.actor}`;
      if (!plan || plan.key !== key) plan = { key, ...makePlan(b) };
      if (m.kind === 'command') {
        let idx = m.items.findIndex((it) => it.id === plan.cmd);
        if (idx < 0 || m.items[idx].disabled) { plan = { key, cmd: 'strum', target: plan.target }; idx = m.items.findIndex((it) => it.id === 'strum'); }
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

    // ---- the driver ------------------------------------------------------------------------------------
    let freefallSteered = false;
    const drive = async (label, pred, { timeout = SCENE_TIMEOUT_MS, allowGameOver = false } = {}) => {
      const t0 = Date.now();
      let last = null;
      while (Date.now() - t0 < timeout) {
        const p = await probe();
        last = p;
        await takeWanted(p);
        if (p.scene === 'GameOver') {
          if (!allowGameOver) throw new GameOverSignal(label);
          await press('confirm');
          await sleep(POLL_MS);
          continue;
        }
        if (p.scene === 'Freefall' && !freefallSteered) {
          // Steer a little: the fall is steerable with left/right (tags billboards when they line up).
          freefallSteered = true;
          await ev(() => window.__slime.hold('left', 300));
          await ev(() => window.__slime.hold('right', 500));
          continue;
        }
        if (p.ui && p.ui.busy && p.ui.top) { await handleUi(p); continue; }
        if (p.scene === 'Battle' && p.battle) { if (await handleBattle(p)) continue; await sleep(POLL_MS); continue; }
        if (pred(p)) return p;
        await sleep(POLL_MS);
      }
      const st = last ? { scene: last.scene, map: last.snap.map, x: last.player && last.player.x, y: last.player && last.player.y, idle: last.idle, uiBusy: last.uiBusy, uiKinds: last.uiKinds, ui: last.ui && last.ui.top, battle: last.battle && { id: last.battle.id, round: last.battle.round, menu: last.battle.menu }, runner: last.runner, lock: last.lock, transitioning: last.transitioning, moving: last.moving, titleSeen: last.titleSeen, exploreSeen: last.exploreSeen, slot: last.slot, flags: last.snap.flags } : null;
      throw new Error(`timeout waiting for ${label}; state=${JSON.stringify(st)}`);
    };
    const idleOnMap = (p) => p.scene === 'Explore' && p.idle;
    const driveIdle = (label) => drive(label, idleOnMap);
    /**
     * Walk a path one press per tile, settling every script/battle the step starts. Uppercase letters expect
     * to move (retried when a step was swallowed by a script); lowercase letters only turn (a bump into something).
     */
    const walk = async (path, label = 'walk') => {
      let p = await driveIdle(`${label}: before`);
      for (const ch of path) {
        if (ch === ' ') continue;
        const dir = DIRS[ch.toUpperCase()];
        if (!dir) continue;
        const before = p;
        const turnOnly = ch !== ch.toUpperCase();
        let moved = false;
        for (let tries = 0; tries < 4 && !moved; tries++) {
          await press(dir);
          p = await driveIdle(`${label}: ${ch}`);
          moved = p.snap.map !== before.snap.map || !p.player || !before.player || p.player.x !== before.player.x || p.player.y !== before.player.y;
          if (turnOnly) break;
        }
        if (!moved && !turnOnly) notes.push(`${label}: step ${ch} did not move from (${before.player && before.player.x},${before.player && before.player.y}) on ${before.snap.map}`);
      }
      return p;
    };
    const at = (p, x, y) => !!p.player && p.player.x === x && p.player.y === y;
    const pos = (p) => ({ map: p.snap.map, x: p.player && p.player.x, y: p.player && p.player.y, facing: p.player && p.player.facing });

    /** Game Over → Title → the title menu (`choice`) → Explore, idle. */
    const recover = async (choice) => {
      titleChoice = choice;
      await drive('recover', idleOnMap, { allowGameOver: true });
      titleChoice = 1;
    };
    const withRetries = async (name, fn, choice = 1) => {
      for (let attempt = 0; ; attempt++) {
        try { await fn(attempt); return; } catch (err) {
          if (!(err instanceof GameOverSignal) || attempt >= MAX_RETRIES) throw err;
          report.retries += 1;
          retryLog.push({ battle: name, attempt: attempt + 1, where: err.where });
          log(`game over in ${name} (${err.where}); retry ${attempt + 1}`);
          await recover(choice);
        }
      }
    };

    // ==== boot ====================================================================================
    await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await page.waitForFunction(() => window.__slime && window.__slime.isReady, null, { timeout: READY_TIMEOUT_MS, polling: 50 });
    await sleep(300);
    await ev(() => {
      window.__slime.textInstant(true);
      window.__slime.autoAdvance(false);
      window.__titleSeen = 0;
      window.__exploreSeen = 0;
      window.__slime.game.scene.getScene('Title').events.on('create', () => { window.__titleSeen += 1; });
      window.__slime.game.scene.getScene('Explore').events.on('create', () => { window.__exploreSeen += 1; });
    });
    let p = await probe();
    check('S0 title scene up', p.scene === 'Title', p.scene);
    check('S0 no save before NEW GAME', (await ev(() => [1, 2, 3].some((n) => window.__slime.state.hasSave(n)))) === false);
    await shot('ch1_00_title');

    // ==== S1–S3: pod bay → freefall → alley (phase A; a lost drone means NEW GAME again) ==========
    await withRetries('alley_drone', async (attempt) => {
      if (attempt === 0) await ev(() => window.__slime.newGame());
      p = await driveIdle('CS-01');
      check('S1 NEW GAME lands in pod_bay (7,11) facing up', p.snap.map === 'pod_bay' && at(p, 7, 11) && p.player.facing === 'up', pos(p));
      check('S1 CS-01 ep0_pod_intro ran (flags.podIntro)', p.snap.flags.podIntro === true, p.snap.flags);
      check('S1 start: $4, Half-Ounce x4, party = lucky', p.snap.money === 4 && qty(p.snap, 'half_ounce') === 4 && party(p.snap) === 'lucky', { money: p.snap.money, inv: p.snap.inventory, party: party(p.snap) });
      await shot('ch1_01_pod_bay');
      p = await walk('UUUUUUUU', 'pod bay catwalk');
      check('S1 walked the bay to the catwalk (7,3); Dad floor bands 1..4 fired', at(p, 7, 3) && ['dad_1', 'dad_2', 'dad_3', 'dad_4'].every((id) => p.snap.flags[`trig_pod_bay_${id}`] === true), pos(p));
      p = await walk('u', 'face speaker');
      await press('confirm');
      p = await driveIdle('CS-02 speaker');
      check('S1 CS-02: speaker slimed (flags.podSpeakerSlapped)', p.snap.flags.podSpeakerSlapped === true, p.snap.flags);
      p = await walk('DDDDDDDD', 'back to the pod');
      check('S1 back in the pod (7,11); the mmf twins fired', at(p, 7, 11) && p.snap.flags.trig_pod_bay_dad_1_mmf === true && p.snap.flags.trig_pod_bay_dad_4_mmf === true, pos(p));
      p = await walk('l', 'face EJECT');
      check('S1 facing the EJECT button', p.player.facing === 'left', pos(p));
      await press('confirm');
      p = await drive('CS-03 EJECT → freefall → alley crash → drone', (q) => idleOnMap(q) && q.snap.map === 'alley');
      check('S2 freefall happened: vars.billboardsTagged is a number', typeof p.snap.vars.billboardsTagged === 'number', p.snap.vars);
      check('S2 sunglasses given on landing', has(p.snap, 'slime_sunglasses'), p.snap.inventory);
      check('S3 CS-04 flags: ejected, metPhoenix, droneDefeated, phoenixJoined', p.snap.flags.ejected === true && p.snap.flags.metPhoenix === true && p.snap.flags.droneDefeated === true && p.snap.flags.phoenixJoined === true, p.snap.flags);
    }, 0);
    check('S3 party = lucky,phoenix after the drone', party(p.snap) === 'lucky,phoenix', party(p.snap));
    check('S3 drone paid $2 severance + 8 XP each', p.snap.money === 6 && member(p.snap, 'lucky').xp === 8 && member(p.snap, 'phoenix').xp === 8, { money: p.snap.money, party: p.snap.party });
    check('S3 Lucky stepped out of the crater to (9,9)', at(p, 9, 9), pos(p));
    check('S3 crater, tipped dumpsters, drone wreck, Bajonka cameo present', ['crater', 'dumpster_3', 'dumpster_4', 'drone_wreck', 'bajonka_cameo'].every((id) => !!ent(p, id)), p.entities.map((e) => e.id));
    check('S3 Phoenix trails as a follower', p.followers.some((f) => f.id === 'phoenix'), p.followers);
    check('S3 autosave 1 landed in slot 1', (await ev(() => window.__slime.state.hasSave(1))) === true);
    await shot('ch1_03b_alley');
    // the alley loot and the dog on the crate
    p = await walk('RRUUUu', 'to the tipped dumpster');
    await press('confirm');
    p = await driveIdle('dumpster');
    check('S3 tipped dumpster gives one Pizza Slice', p.snap.flags.pizzaBoxLooted === true && qty(p.snap, 'pizza_slice') === 1, p.snap.inventory);
    p = await walk('RRRRRRRr', 'to the crate');
    await press('confirm'); p = await driveIdle('bajonka cameo 1');
    await press('confirm'); p = await driveIdle('bajonka cameo 2');
    check('S3 Bajonka cameo on the crate (flags.bajonkaSeen)', p.snap.flags.bajonkaSeen === true, p.snap.flags);
    p = await walk('DLLLLLLLLLLLLLLLLLL', 'alley west exit');
    check('S4 alley west exit → street_cedar (38,12)', p.snap.map === 'street_cedar' && at(p, 38, 12), pos(p));

    // ==== S4: first pass on Cedar (hub closed) ============================================================
    const dayIds = p.entities.map((e) => e.id);
    check('S4 day NPCs present, hub closed: no enemies', ['shoveler', 'cyclist', 'busker', 'crust_punk'].every((id) => dayIds.includes(id)) && !dayIds.some((id) => ['slush', 'scooters', 'goose', 'analyst', 'billboard'].includes(id)), dayIds);
    p = await walk('LLLLLLLLLLLLLLLLLLLLLL UUU', 'to the north sidewalk');
    check('S4 at (16,9) on the sidewalk', at(p, 16, 9), pos(p));
    await shot('ch1_04_street_first');
    p = await walk('LLLL U', 'Towers door');
    check('S5 Towers door → apartment (12,12)', p.snap.map === 'apartment' && at(p, 12, 12), pos(p));

    // ==== S5: the apartment, the signal, ONE WEEK LATER ==================================================
    p = await walk('LLLLLLLLL UU u', 'to the amp');
    await shot('ch1_05c_apartment_before');
    await press('confirm');
    p = await drive('CS-05 the signal → CS-06', (q) => idleOnMap(q) && q.snap.flags.weekLater === true);
    check('S5 CS-05: signalSent, weekLater, hubOpen', p.snap.flags.signalSent === true && p.snap.flags.weekLater === true && p.snap.flags.hubOpen === true, p.snap.flags);
    check('S5 ONE WEEK LATER lands on the couch (3,7)', p.snap.map === 'apartment' && at(p, 3, 7), pos(p));
    check('S5 CS-06 gave the blank flyer; Bajonka on the couch arm', has(p.snap, 'flyer_blank') && !!ent(p, 'bajonka_couch'), p.snap.inventory);
    check('S5 player sprite back to lucky after the glow', p.player.sheet === 'lucky', p.player.sheet);
    await shot('ch1_06_apartment');
    p = await walk('u', 'face the couch');
    await press('confirm');
    p = await driveIdle('couch nap');
    check('S5 couch nap: full heal + $2 in the cushions', p.snap.flags.couchCushions === true && p.snap.money === 8, { money: p.snap.money, flags: p.snap.flags.couchCushions });
    p = await walk('R u', 'face Bajonka on the couch');
    await press('confirm'); p = await driveIdle('couch bajonka');
    check('S5 Bajonka on the couch arm has her line', p.snap.flags.aptBajonkaRead === true, p.snap.flags);
    p = await walk('R UUUU RRRRR u', 'to the fridge');
    await press('confirm'); p = await driveIdle('fridge');
    check('S5 fridge gives Pizza Slice + Tater Tot Hotdish once', p.snap.flags.fridgeLooted === true && qty(p.snap, 'pizza_slice') === 2 && qty(p.snap, 'hotdish') === 1, p.snap.inventory);
    p = await walk('DDDDDDD LLLLLLLL u', 'to the bass stand');
    await press('confirm'); p = await driveIdle('bass stand');
    check('S5 bass stand gives the Beat-Up Bass', p.snap.flags.bassTaken === true && has(p.snap, 'beatup_bass'), p.snap.inventory);
    // EQUIP it on Phoenix from the pause menu (menu → Equip → Phoenix → Inst → Beat-Up Bass → back out)
    uiPlan.push(
      { match: (l) => l[0] === 'Items' && l.includes('Equip'), pick: 2 },
      { match: (l) => l[0] === 'Lucky' && l[1] === 'Phoenix', pick: 1 },
      { match: (l) => /^Inst:/.test(l[0]), pick: 0 },
      { match: (l) => l[0] === 'Beat-Up Bass', pick: 0 },
      { match: (l) => l[0] === 'Lucky' && l[1] === 'Phoenix', pick: 'cancel' },
      { match: (l) => l[0] === 'Items' && l.includes('Equip'), pick: 'cancel' },
    );
    await press('menu');
    p = await driveIdle('equip the bass');
    check('S5 pause menu EQUIP: Beat-Up Bass on Phoenix, the Trash Bag back in the bag', uiPlan.length === 0 && member(p.snap, 'phoenix').equip.instrument === 'beatup_bass' && !has(p.snap, 'beatup_bass') && has(p.snap, 'trash_bag'), { plan: uiPlan.length, phoenix: member(p.snap, 'phoenix'), inv: p.snap.inventory });
    uiPlan.length = 0;
    p = await walk('RRRRRRRRRR DD', 'to the door');
    check('S5 autosave 2 at the apartment door', p.snap.flags.trig_apartment_autosave_door === true && p.snap.vars.lastAutosave === 'apartment', p.snap.vars);
    p = await walk('D', 'apartment door');
    check('S6 apartment door → street (12,9)', p.snap.map === 'street_cedar' && at(p, 12, 9), pos(p));

    // ==== S6–S7: the hub open, the café (no battles yet) ===============================================
    const hubIds = p.entities.map((e) => e.id);
    check('S6 day enemies + office worker present with hubOpen', ['slush', 'scooters', 'goose', 'analyst', 'billboard', 'office_worker'].every((id) => hubIds.includes(id)), hubIds);
    /** From the sidewalk by the Towers door to the café and back out at (20,9): the flyer, one slice, Brian. */
    const cafeVisit = async (attempt) => {
      p = await probe();
      if (p.player.y === 10) p = await walk('U', 'up to the sidewalk');
      while (p.player.x < 17) p = await walk('R', 'along the sidewalk');
      if (attempt === 0) {
        check('S6 towers autosave fired on the first step', p.snap.flags.trig_street_cedar_towers_autosave === true && p.snap.vars.lastAutosave === 'street_cedar', p.snap.vars);
        await shot('ch1_07_street_hub');
      }
      p = await walk('U RRR', 'café door');
      check('S7 café door → coffee_shop (10,12)', p.snap.map === 'coffee_shop' && at(p, 10, 12), pos(p));
      const cafeIds = p.entities.map((e) => e.id);
      check('S7 café roster present', ['barista', 'screenwriter', 'poet', 'intern', 'brian', 'pedalboard'].every((id) => cafeIds.includes(id)), cafeIds);
      await shot('ch1_08_cafe');
      p = await walk('UUUUUUUUU RRRRRR u', 'to the corkboard');
      await press('confirm');
      p = await driveIdle('CS-07 the flyer');
      check('S7 CS-07 posted the flyer (SEEKING RHYTHMIC VESSEL)', p.snap.flags.flyerPosted === true && p.snap.vars.flyerText === 2 && !has(p.snap, 'flyer_blank'), { flags: p.snap.flags.flyerPosted, vars: p.snap.vars, inv: p.snap.inventory });
      // buy one Pizza Slice at the counter ($8 → $5)
      uiPlan.push(
        { match: (l) => l[0] === 'BUY', pick: 0 },
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 0 },
        { match: (l) => /^x1/.test(l[0]), pick: 0 },
        { match: (l) => /^Pizza Slice/.test(l[0]), pick: 'cancel' },
        { match: (l) => l[0] === 'BUY', pick: 1 }, // LEAVE (the café does not buy)
      );
      p = await walk('DD LLLLLLLLLLLL u', 'to the counter');
      await press('confirm');
      p = await driveIdle('café shop');
      check('S7 bought one Pizza Slice for $3', qty(p.snap, 'pizza_slice') === 3 && p.snap.money === 5, { money: p.snap.money, inv: p.snap.inventory });
      check('S7 shop plan fully consumed', uiPlan.length === 0, uiPlan.length);
      uiPlan.length = 0;
      p = await walk('DDDDDD RRRRRR', 'to the door tile');
      check('S7 at (10,11) above the door', at(p, 10, 11), pos(p));
      p = await walk('d', 'CS-08 Brian'); // one press: the trigger tile teleports us back to (10,11)
      check('S7 CS-08: Brian joined second; two coffees; Ryan called', p.snap.flags.brianJoined === true && party(p.snap) === 'lucky,phoenix,brian' && qty(p.snap, 'coffee') === 2 && p.snap.flags.ryanCalled === true && p.snap.flags.brianCalledRyan === true, { party: party(p.snap), flags: p.snap.flags, inv: p.snap.inventory });
      check('S7 back in the café at (10,11); Brian is a follower; CS-08 autosaved', p.snap.map === 'coffee_shop' && at(p, 10, 11) && p.followers.some((f) => f.id === 'brian') && p.snap.vars.lastAutosave === 'coffee_shop', { pos: pos(p), followers: p.followers, vars: p.snap.vars });
      await shot('ch1_08c_cafe_brian');
      p = await walk('DD', 'leave the café');
      check('S6 café door → street (20,9); the Brian trigger did not re-fire', p.snap.map === 'street_cedar' && at(p, 20, 9), pos(p));
    };
    await cafeVisit(0);

    // ==== S6: the two chokepoint fights and the rail (phase B2; retried from the CS-08 autosave) ===========
    await withRetries('hub chokepoints', async (attempt) => {
      p = await probe();
      if (attempt > 0) {
        // CONTINUE loads the newest page: the CS-08 autosave in the café (Brian in the band), or, from an
        // older build of the content, the towers autosave on the sidewalk, in which case the café is redone.
        check(`S6 retry ${attempt}: CONTINUE loaded an autosave with the hub open`, (p.snap.map === 'coffee_shop' || p.snap.map === 'street_cedar') && p.snap.flags.hubOpen === true, pos(p));
        if (p.snap.map === 'coffee_shop') {
          check(`S6 retry ${attempt}: the café page has Brian and the call`, at(p, 10, 11) && p.snap.flags.brianJoined === true && p.snap.flags.ryanCalled === true, { pos: pos(p), flags: p.snap.flags });
          p = await walk('DD', 'retry: leave the café');
        } else if (p.snap.flags.brianJoined !== true) {
          await cafeVisit(attempt);
        }
      }
      p = await walk('D LLL', 'to the crosswalk'); // the busker stands on the sidewalk at (18,9): take the curb
      check('S6 at the crosswalk (17,10)', at(p, 17, 10), pos(p));
      p = await walk('D L d', 'bump the Slush Pile');
      p = await driveIdle('after the slush');
      check('S6 B-2 Slush Pile cleared', p.snap.flags.cleared_slush === true && !ent(p, 'slush'), p.snap.flags);
      check('S6 Slush paid $3 + 8 XP (Lucky L2)', p.snap.money >= 8 && member(p.snap, 'lucky').xp === 16 && member(p.snap, 'lucky').level === 2, { money: p.snap.money, lucky: member(p.snap, 'lucky') });
      p = await walk('DD', 'into the road');
      check('S6 at (16,13) on the road', at(p, 16, 13), pos(p));
      // the scooters patrol row 13 between x 20 and 26: walk toward them, they touch us
      for (let i = 0; i < 6 && p.snap.flags.cleared_scooters !== true; i++) p = await walk('R', 'toward the scooters');
      if (p.snap.flags.cleared_scooters !== true) p = await drive('scooter patrol touch', (q) => idleOnMap(q) && q.snap.flags.cleared_scooters === true, { timeout: 60_000 });
      check('S6 B-3 Scooter Pack cleared', p.snap.flags.cleared_scooters === true && !ent(p, 'scooters'), p.snap.flags);
      check('S6 Scooters paid $6 + 10 XP (Lucky L3)', p.snap.money >= 14 && member(p.snap, 'lucky').xp === 26 && member(p.snap, 'lucky').level === 3, { money: p.snap.money, lucky: member(p.snap, 'lucky') });
      while (p.player.x < 22) p = await walk('R', 'to the platform stairs');
      while (p.player.x > 22) p = await walk('L', 'to the platform stairs');
      p = await walk('DDD', 'the rail');
      check('S8 rail → city_sound_hall (3,6)', p.snap.map === 'city_sound_hall' && at(p, 3, 6), pos(p));
    });
    check('S8 autosave 3 on entering the hall', p.snap.vars.lastAutosave === 'city_sound_hall', p.snap.vars);
    check('S8 XP after the hub: Lucky 26 (L3), Phoenix 26 (L3), Brian fixed L3', (member(p.snap, 'lucky') || {}).xp === 26 && (member(p.snap, 'phoenix') || {}).level === 3 && (member(p.snap, 'brian') || {}).level === 3, p.snap.party);

    // ==== S8–S10: City Sound hallway, Room 4, the audition, the contract, ONE MONTH LATER (phase C) ====
    await withRetries('ep0_audition', async (attempt) => {
      p = await probe();
      if (attempt === 0) {
        await shot('ch1_09_hall');
        p = await walk('RRRRRRRR D RRRRR', 'to Room 3');
        check('S8 CS-09: ryanArrived, hasBajonka; Bajonka is a save point outside Room 4', p.snap.flags.ryanArrived === true && p.snap.flags.hasBajonka === true && !!(ent(p, 'bajonka') && ent(p, 'bajonka').type === 'save'), p.snap.flags);
        check('S8 temporary Ryan and the hardware despawned', !ent(p, 'ryan') && !ent(p, 'hardware'), p.entities.map((e) => e.id));
        await shot('ch1_09c_hall_after');
        p = await walk('U RRRR d', 'to Bajonka');
        check('S8 at (20,6) facing Bajonka', at(p, 20, 6) && p.player.facing === 'down', pos(p));
        await press('confirm');
        p = await driveIdle('clipboard save PAGE 2');
        const peek = await ev(() => ({ slot: window.__slime.state.slot, has2: window.__slime.state.hasSave(2), peek: window.__slime.state.peekSave(2) }));
        check('S8 initialed PAGE 2 (saveCount 1, slot 2, page 2 holds the hall)', p.snap.vars.saveCount === 1 && peek.slot === 2 && peek.has2 && peek.peek && peek.peek.map === 'city_sound_hall', { vars: p.snap.vars, peek });
      } else {
        check(`S8 retry ${attempt}: CONTINUE loaded PAGE 2 outside Room 4`, p.snap.map === 'city_sound_hall' && at(p, 20, 6) && p.snap.flags.hasBajonka === true, pos(p));
      }
      // Room 4 runs CS-10 → CS-11 → AUDITION → CS-12 (contract, PAGE 2) → ONE MONTH LATER → CS-13 → the
      // Chorus → CS-14 with no idle moment, so the step into the room settles only at the ultimatum.
      p = await walk('U', 'into Room 4');
      p = await drive('CS-10/11 → AUDITION → CS-12 contract', (q) => q.snap.flags.ryanJoined === true);
      p = await drive('CS-12 → ONE MONTH LATER → CS-13 → the Chorus → CS-14', (q) => idleOnMap(q) && q.snap.flags.monthLaterRan === true && q.snap.flags.brianQuit === true);
    });
    check('S9 audition reward: auditionDone, ryanJoined, band agreement, Tinny Ride Cymbal', p.snap.flags.auditionDone === true && p.snap.flags.ryanJoined === true && has(p.snap, 'band_agreement') && has(p.snap, 'tinny_ride_cymbal'), p.snap.inventory);
    check('S9 contract pages = 3 + pages initialed before it (4); the contract save bumped saveCount to 2', p.snap.vars.contractPages === 4 && p.snap.vars.saveCount === 2, p.snap.vars);
    check('S10 ONE MONTH LATER ran: monthLater, monthLaterRan, pedalboardFried, kraaangFired, brianQuit', ['monthLater', 'monthLaterRan', 'pedalboardFried', 'kraaangFired', 'brianQuit'].every((f) => p.snap.flags[f] === true), p.snap.flags);
    check('S10 Brian left; party = lucky,phoenix,ryan; Fried Pedalboard left behind', party(p.snap) === 'lucky,phoenix,ryan' && has(p.snap, 'fried_pedalboard'), { party: party(p.snap), inv: p.snap.inventory });
    check('S10 Lucky L5 after the audition (+50) and the Chorus (+30): 106 XP', member(p.snap, 'lucky').xp === 106 && member(p.snap, 'lucky').level === 5, member(p.snap, 'lucky'));
    check('S10 the gig flyer and the KRAAANG on the wall; player at (5,7)', !!ent(p, 'gig_flyer') && !!ent(p, 'kraaang') && at(p, 5, 7), { pos: pos(p), ents: p.entities.map((e) => e.id) });
    await shot('ch1_10_room4_after_brian');

    // ==== save round trip: pause menu → Quit to title → CONTINUE (PAGE 2, the contract) → replay ========
    const beforeReload = p;
    const titlesBefore = p.titleSeen;
    const exploresBefore = p.exploreSeen;
    uiPlan.push(
      { match: (l) => l[0] === 'Items' && l.includes('Quit'), pick: 5 },
      { match: (l) => l[0] === 'Quit to title', pick: 0 },
      { match: (l) => l[0] === 'New Game', pick: 1 },
    );
    await press('menu');
    p = await drive('pause menu → title → CONTINUE', (q) => q.scene === 'Explore' && q.titleSeen > titlesBefore && q.exploreSeen > exploresBefore && q.snap.map === 'room4' && q.snap.vars.saveCount === 2 && (q.idle || q.runner));
    check('RT menu plan fully consumed', uiPlan.length === 0, uiPlan.length);
    uiPlan.length = 0;
    const reload = await ev(() => ({ slot: window.__slime.state.slot, has1: window.__slime.state.hasSave(1), has2: window.__slime.state.hasSave(2), has3: window.__slime.state.hasSave(3) }));
    check('RT CONTINUE loaded PAGE 2 (the newest page)', reload.slot === 2 && reload.has1 && reload.has2 && !reload.has3, reload);
    check('RT reload: Room 4, the contract state (ryanJoined, not brianQuit)', p.snap.map === 'room4' && p.snap.flags.ryanJoined === true && p.snap.flags.brianQuit !== true && p.snap.flags.pedalboardFried !== true, p.snap.flags);
    check('RT reload: party lucky,phoenix,brian,ryan with Lucky L4 / 76 XP', party(p.snap) === 'lucky,phoenix,brian,ryan' && member(p.snap, 'lucky').level === 4 && member(p.snap, 'lucky').xp === 76, p.snap.party);
    check('RT reload: inventory from the page (band agreement, no fried pedalboard, pizza x3 or what was eaten, $14)', has(p.snap, 'band_agreement') && !has(p.snap, 'fried_pedalboard') && p.snap.money === 14, p.snap.inventory);
    check('RT reload: once-triggers kept (Room 3, towers, apartment door)', p.snap.flags.trig_city_sound_hall_ryan_arrives === true && p.snap.flags.trig_street_cedar_towers_autosave === true && p.snap.flags.trig_apartment_autosave_door === true, p.snap.flags);
    check('RT reload: the ONE MONTH LATER scene starts again from the page (monthLater on the page, not monthLaterRan)', p.snap.flags.monthLater === true && beforeReload.snap.flags.monthLaterRan === true, p.snap.flags);
    p = await drive('RT replay: CS-13 → Chorus → ultimatum', (q) => idleOnMap(q) && q.snap.flags.brianQuit === true, { timeout: SCENE_TIMEOUT_MS });
    check('RT replay reached the ultimatum again: brianQuit, party lucky,phoenix,ryan, followers phoenix+ryan', p.snap.flags.brianQuit === true && party(p.snap) === 'lucky,phoenix,ryan' && p.followers.map((f) => f.id).join(',') === 'phoenix,ryan', { party: party(p.snap), followers: p.followers });
    check('RT replay: Lucky back to L5 / 106 XP; player at (5,7)', member(p.snap, 'lucky').xp === 106 && at(p, 5, 7), { lucky: member(p.snap, 'lucky'), pos: pos(p) });

    // ==== S10 the flyer → S11 the street at night → S12 Palmer's → THE SET (phase E) ===================
    p = await walk('R r', 'face the flyer');
    await press('confirm');
    p = await driveIdle('CS-15 the gig flyer');
    check('S10 CS-15: hasPalmersFlyer, gigFlyer, Palmer\'s Flyer in the bag, the paper gone', p.snap.flags.hasPalmersFlyer === true && p.snap.flags.gigFlyer === true && has(p.snap, 'palmers_flyer') && !ent(p, 'gig_flyer'), p.snap.inventory);
    p = await walk('LLL DD D', 'leave Room 4');
    check('S8 Room 4 door → hall (20,6)', p.snap.map === 'city_sound_hall' && at(p, 20, 6), pos(p));
    p = await walk('L D LLLLLLLL U LLLLLLLL L', 'hall → stairs');
    const npcRyan = (q) => (q.entities || []).find((e) => e.id === 'ryan' && e.type !== 'follower');
    check('S11 the Room 3 trigger did not re-fire on the way out (no temporary Ryan / hardware stack)', !npcRyan(p) && !ent(p, 'hardware'), p.entities.map((e) => `${e.id}:${e.type}`));
    check('S11 stairs → street at night (22,15)', p.snap.map === 'street_cedar' && at(p, 22, 15), pos(p));
    const nightIds = p.entities.map((e) => e.id);
    check('S11 night roster + night enemies; day roster gone; overlay on', ['stranger_tall', 'smoker', 'bajonka', 'analyst_duo', 'goose_pair'].every((id) => nightIds.includes(id)) && !nightIds.some((id) => ['shoveler', 'cyclist', 'busker', 'slush', 'scooters', 'goose', 'analyst'].includes(id)) && p.overlay === true, { nightIds, overlay: p.overlay });
    await withRetries('ep0_palmers_set', async (attempt) => {
      p = await probe();
      if (attempt === 0) {
        p = await walk('LLLLL UUUUU', 'crosswalk at night'); // (17,10): the curb, the smoker blocks the sidewalk
        await shot('ch1_11_street_night');
        p = await walk('LLLLLLLLLLL U l', 'to Bajonka outside Palmer\'s');
        check('S11 at (6,9) facing Bajonka by Palmer\'s door', at(p, 6, 9) && p.player.facing === 'left', pos(p));
        await press('confirm');
        p = await driveIdle('night save');
        check('S11 initialed PAGE 2 outside Palmer\'s (saveCount 3)', p.snap.vars.saveCount === 3 && (await ev(() => window.__slime.state.peekSave(2).map)) === 'street_cedar', p.snap.vars);
      } else {
        check(`S11 retry ${attempt}: CONTINUE loaded PAGE 2 outside Palmer's`, p.snap.map === 'street_cedar' && at(p, 6, 9), pos(p));
      }
      p = await walk('U', 'Palmer\'s door');
      check('S12 Palmer\'s door → palmers (8,12); "we kept the weed"', p.snap.map === 'palmers' && at(p, 8, 12) && qty(p.snap, 'half_ounce') === 4, pos(p));
      const barIds = p.entities.map((e) => e.id);
      check('S12 the crowd (12 punks), the cop, the stranger, Bajonka on her stool', barIds.filter((id) => id.startsWith('punk_')).length === 12 && ['cop', 'stranger_tall', 'bartender', 'bajonka'].every((id) => barIds.includes(id)), barIds);
      await shot('ch1_12_palmers');
      p = await walk('RRRRRRRR U u', 'to the jukebox');
      await press('confirm');
      p = await driveIdle('jukebox');
      check('S12 jukebox played (7/8 Shuffle)', p.snap.flags.jukeboxPlayed === true, p.snap.flags);
      p = await walk('D LLLLLLLL UUUUUUUU RRRRRRRRRRR DD', 'to the stage edge');
      check('S12 at (19,6) beside the stage', at(p, 19, 6), pos(p));
      p = await walk('R', 'onto the stage');
      p = await drive('CS-16 → THE SET → CS-17 aftermath', (q) => q.snap.map === 'palmers_rubble' && q.snap.flags.eternityDone === true);
    });
    check('S12 THE SET: onStage, mohawkOff, eternityArmed, eternityFired, eternityDone', ['onStage', 'mohawkOff', 'eternityArmed', 'eternityFired', 'eternityDone'].every((f) => p.snap.flags[f] === true), p.snap.flags);
    check('S12 THE SET reward: +100 XP (Lucky 206, L7) and the Price-Tag Leather Jacket', member(p.snap, 'lucky').xp === 206 && member(p.snap, 'lucky').level === 7 && has(p.snap, 'price_tag_jacket'), { lucky: member(p.snap, 'lucky'), inv: p.snap.inventory });

    // ==== S13: the rubble, the quit, NEXT: THE POTATO BELT → Title → CONTINUE ===========================
    p = await drive('CS-17: the quit', (q) => q.snap.flags.ryanQuit === true);
    check('S13 PLEAD picked (vars.quitResponse 1); Ryan gone; luckyRageLocked', p.snap.vars.quitResponse === 1 && p.snap.flags.ryanQuit === true && p.snap.flags.luckyRageLocked === true && party(p.snap) === 'lucky,phoenix', { vars: p.snap.vars, party: party(p.snap) });
    const exploresBeforeEnd = p.exploreSeen; // CONTINUE starts a fresh Explore scene; the rubble teleport before the title did not
    uiPlan.push({ match: (l) => l[0] === 'New Game', pick: 1 });
    p = await drive('CS-17 stinger → NEXT → save → Title → CONTINUE', (q) => q.scene === 'Explore' && q.exploreSeen > exploresBeforeEnd && q.snap.flags.ch1Complete === true && q.snap.map === 'palmers_rubble' && q.idle);
    check('S13 ch1Complete, van keys + itinerary', p.snap.flags.ch1Complete === true && has(p.snap, 'van_keys') && has(p.snap, 'tour_itinerary'), p.snap.inventory);
    check('S13 the final clipboard page (saveCount 4) went to PAGE 2 and CONTINUE loaded it', p.snap.vars.saveCount === 4 && p.slot === 2, { vars: p.snap.vars, slot: p.slot });
    check('S13 the title screen came up for the round trip, the chapter end and every retry', p.titleSeen === 2 + report.retries, { titleSeen: p.titleSeen, retries: report.retries });
    check('S13 CONTINUE lands in the rubble at (16,9) with Bajonka (save) and the band', p.snap.map === 'palmers_rubble' && at(p, 16, 9) && !!(ent(p, 'bajonka') && ent(p, 'bajonka').type === 'save') && party(p.snap) === 'lucky,phoenix', { pos: pos(p), party: party(p.snap) });
    check('S13 Lucky stays rage-locked on the map after the reload', p.player.sheet === 'lucky_rage', p.player.sheet);
    levels.end = levelsOf(p.snap);
    await shot('ch1_13_rubble');
    check('levels vs the DESIGN budget (audition L3, Palmer\'s L5, end L7)', !!levels.audition && !!levels.palmers && levels.audition.lucky === BUDGET.audition && levels.palmers.lucky === BUDGET.palmers && levels.end.lucky === BUDGET.end, levels);

    // ---- hygiene -------------------------------------------------------------------------------------
    const lastErrors = await ev(() => window.__slime.lastErrors);
    check('__slime.lastErrors is empty', Array.isArray(lastErrors) && lastErrors.length === 0, lastErrors);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error').map((m) => m.text);
    const suspicious = consoleMessages.filter((m) => (m.type === 'error' || m.type === 'warning') && /Error|undefined/.test(m.text)).map((m) => `${m.type}: ${m.text}`);
    check('no console error', consoleErrors.length === 0, consoleErrors.slice(0, 10));
    check('no console error/warning mentioning "Error" or "undefined"', suspicious.length === 0, suspicious.slice(0, 10));
    report.consoleErrors = consoleErrors.slice(0, 20);
    report.warnings = consoleMessages.filter((m) => m.type === 'warning').map((m) => m.text).slice(0, 20);
    report.ok = failures.length === 0;
  } catch (err) {
    failures.push(`fatal: ${err && err.stack ? err.stack : String(err)}`);
    report.ok = false;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }
  report.checks = checks.length;
  report.retryLog = retryLog;
  report.durationMs = Date.now() - startedAt;
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write(`${JSON.stringify({ test: 'chapter1', ok: false, failures: [`fatal: ${err && err.stack ? err.stack : String(err)}`] })}\n`);
  process.exit(1);
});
