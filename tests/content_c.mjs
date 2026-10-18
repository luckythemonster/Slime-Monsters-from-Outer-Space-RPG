#!/usr/bin/env node
// Content C playthrough: City Sound hallway → Room 4 (AUDITION, contract, ONE MONTH LATER, the
// ultimatum, the flyer) → Palmer's (THE SET) → the rubble (the quit, NEXT: THE POTATO BELT).
// Same recipe as tests/explore.mjs: builds with Vite (unless EXPLORE_KEEP_DIST=1), serves dist/,
// drives window.__slime with `?fast=1`. Battles may be the stub or the real thing: while the Battle
// scene is up the test taps confirm so a command-menu battle keeps moving (STRUM → first target).
// Screenshots go to tests/screenshots/content_c_*.png. Not part of tests/run.mjs.
//
//   node tests/content_c.mjs
//   CONTENT_C_STAGE=month node tests/content_c.mjs     # start at ONE MONTH LATER (flags + party preset)
//   CONTENT_C_STAGE=palmers node tests/content_c.mjs   # start at Palmer's

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
const STEP_TIMEOUT_MS = 20_000;
const SCENE_TIMEOUT_MS = 180_000;
const VIEWPORT = { width: 1024, height: 896 };
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const STAGES = ['hall', 'month', 'palmers'];
const STAGE = STAGES.includes(process.env.CONTENT_C_STAGE) ? process.env.CONTENT_C_STAGE : 'hall';
const from = (name) => STAGES.indexOf(STAGE) <= STAGES.indexOf(name);

const log = (m) => process.stderr.write(`[content_c] ${m}\n`);

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

// ---- the test ------------------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const errors = [];
  const checks = [];
  const screenshots = [];
  const consoleErrors = [];
  const report = { ok: false, stage: STAGE, checks, screenshots, errors, consoleErrors };
  const check = (name, ok, detail) => {
    checks.push({ name, ok: !!ok, ...(detail !== undefined ? { detail } : {}) });
    if (!ok) errors.push(`check failed: ${name}${detail !== undefined ? ` (${JSON.stringify(detail)})` : ''}`);
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
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err && err.message ? err.message : String(err)}`));
    page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText ?? '?'})`));
    page.on('response', (res) => { if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`); });

    const ev = (fn, arg) => page.evaluate(fn, arg);
    const shot = async (name) => { const p = path.join(SHOTS, `${name}.png`); await page.screenshot({ path: p }); screenshots.push(path.relative(ROOT, p)); };
    const waitFn = (fn, arg, timeout = STEP_TIMEOUT_MS) => page.waitForFunction(fn, arg, { timeout, polling: 50 });
    const waitIdle = () => waitFn(() => window.__slime.idle());
    const press = (action) => ev((a) => window.__slime.press(a), action);
    const snap = () => ev(() => window.__slime.snapshot());
    const walk = async (path) => { for (const ch of path) { if (ch === ' ') continue; await press({ U: 'up', D: 'down', L: 'left', R: 'right' }[ch]); } };
    const probe = () => ev(() => {
      const s = window.__slime;
      const ex = s.explore ? s.explore() : null;
      return {
        scene: s.scene(), idle: s.idle(), snap: s.snapshot(),
        ui: s.services.ui ? s.services.ui.debugState() : null,
        runner: ex && ex.runner ? ex.runner.running : null, lock: ex ? ex.lockCount : null, transitioning: ex ? ex.transitioning : null,
      };
    });

    /**
     * Wait for a predicate while keeping battles moving: whenever the Battle scene is up (the real
     * battle waits for commands; the stub auto-wins) tap confirm so STRUM → first target fires.
     */
    const seen = new Set();
    const driveUntil = async (name, pred, timeout = SCENE_TIMEOUT_MS) => {
      const t0 = Date.now();
      let st = null;
      while (Date.now() - t0 < timeout) {
        st = await probe();
        if (st.scene === 'Battle') {
          const key = `battle_${st.snap.map}`;
          if (!seen.has(key)) { seen.add(key); await page.waitForTimeout(900); await shot(`content_c_${key}`); }
          await press('confirm');
          await page.waitForTimeout(120);
          continue;
        }
        if (st.scene === 'GameOver') throw new Error(`game over while waiting for ${name}`);
        if (pred(st.snap, st)) return st.snap;
        await page.waitForTimeout(100);
      }
      throw new Error(`timeout waiting for ${name}; state=${JSON.stringify({ scene: st && st.scene, ui: st && st.ui, runner: st && st.runner, lock: st && st.lock, map: st && st.snap.map, x: st && st.snap.x, y: st && st.snap.y, flags: st && st.snap.flags })}`);
    };
    const flushDialogue = async (max = 8) => { for (let i = 0; i < max && !(await ev(() => window.__slime.idle())); i++) { await press('confirm'); await page.waitForTimeout(120); } };

    await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await waitFn(() => window.__slime && window.__slime.isReady, null, READY_TIMEOUT_MS);
    await page.waitForTimeout(300);

    // --- new game + the flag spine up to the chosen stage --------------------------------------
    await ev(() => window.__slime.newGame());
    await ev(() => { window.__slime.textInstant(true); window.__slime.autoAdvance(true); window.__slime.chooseIndex = 0; });
    await waitIdle();
    await ev((stage) => {
      const s = window.__slime;
      const st = s.services.state;
      const spine = ['podIntro', 'podSpeakerSlapped', 'ejected', 'metPhoenix', 'droneDefeated', 'phoenixJoined', 'signalSent', 'weekLater', 'hubOpen', 'flyerPosted', 'brianJoined', 'ryanCalled'];
      if (stage !== 'hall') spine.push('ryanArrived', 'hasBajonka', 'auditionDone', 'ryanJoined', 'monthLater', 'visited_city_sound_hall', 'visited_room4');
      if (stage === 'palmers') spine.push('monthLaterRan', 'pedalboardFried', 'brianQuit', 'hasPalmersFlyer', 'gigFlyer');
      for (const f of spine) s.setFlag(`flags.${f}`, true);
      s.addParty('phoenix');
      if (stage !== 'palmers') s.addParty('brian');
      if (stage !== 'hall') { s.addParty('ryan'); st.inventory.add('band_agreement', 1); st.set('vars.saveCount', 1); st.set('vars.contractPages', 3); }
      if (stage === 'palmers') { st.inventory.add('fried_pedalboard', 1); st.inventory.add('palmers_flyer', 1); }
    }, STAGE);
    let s;

    if (from('hall')) {
      await ev(() => window.__slime.warp('city_sound_hall', 2, 7, 'right'));
      await waitIdle();
      s = await snap();
      check('warped to city_sound_hall spawn', s.map === 'city_sound_hall' && s.x === 2 && s.y === 7, { map: s.map, x: s.x, y: s.y });
      check('party is Lucky, Phoenix, Brian', s.party.map((m) => m.id).join(',') === 'lucky,phoenix,brian', s.party.map((m) => m.id));
      check('Bajonka save not present before CS-09', !(s.entities || []).some((e) => e.id === 'bajonka'), (s.entities || []).map((e) => e.id));
      check('hallway autosave happened (vars.lastAutosave)', s.vars.lastAutosave === 'city_sound_hall', s.vars);
      await page.waitForTimeout(200);
      await shot('content_c_01_hall');

      // --- walk the corridor to Room 3 (the once trigger at x 16..18) -------------------------
      await walk('R U RRRRRRRR D RRRRRR');
      await page.waitForTimeout(1800);
      await shot('content_c_02_ryan_arrives');
      s = await driveUntil('CS-09 end', (sn, st) => sn.flags.ryanArrived && st.idle);
      check('CS-09 set ryanArrived + hasBajonka', s.flags.ryanArrived === true && s.flags.hasBajonka === true, s.flags);
      check('Bajonka save entity present after CS-09', (s.entities || []).some((e) => e.id === 'bajonka' && e.type === 'save'), (s.entities || []).map((e) => `${e.id}:${e.type}`));
      check('player stayed in the corridor', s.map === 'city_sound_hall' && s.y >= 6 && s.y <= 7, { x: s.x, y: s.y });
      check('temporary Ryan/hardware despawned', !(s.entities || []).some((e) => e.id === 'ryan' || e.id === 'hardware'), (s.entities || []).map((e) => e.id));
      await shot('content_c_03_hall_after');

      // --- Bajonka save prompt (decline) --------------------------------------------------------
      const atX = s.x, atY = s.y;
      await walk(atY === 7 ? 'U' : '');
      for (let i = atX; i < 20; i++) await walk('R');
      await walk('D'); // blocked by Bajonka at (20,7): turns to face her
      s = await snap();
      check('standing at (20,6) facing down at Bajonka', s.x === 20 && s.y === 6 && s.facing === 'down', { x: s.x, y: s.y, facing: s.facing });
      await ev(() => { window.__slime.autoAdvance(false); });
      await press('confirm');
      await waitFn(() => window.__slime.services.ui.isBusy());
      for (let i = 0; i < 6 && !(await ev(() => (window.__slime.services.ui.debugState().top || {}).type === 'menu')); i++) { await press('confirm'); await page.waitForTimeout(80); }
      await page.waitForTimeout(150);
      await shot('content_c_04_clipboard_prompt');
      const promptState = await ev(() => window.__slime.services.ui.debugState());
      check('clipboard prompt is a menu', promptState.top && promptState.top.type === 'menu', promptState.top);
      await press('cancel');
      await page.waitForTimeout(150);
      await shot('content_c_04b_clipboard_declined');
      await ev(() => { window.__slime.autoAdvance(true); });
      await flushDialogue();
      s = await driveUntil('decline closes', (sn, st) => st.idle, 10_000);
      check('declined save did not bump saveCount', !s.vars.saveCount, s.vars);

      // --- into Room 4: the audition, the contract, ONE MONTH LATER ---------------------------
      await ev(() => { window.__slime.chooseIndex = 1; }); // clipboard pages: row 0 is the title, row 1 = PAGE 1
      // A real battle is driven by confirm-spam (STRUM → first target); give the band DESIGN.md's
      // critical-path level (L4 at the AUDITION, L5 at Palmer's) and a few heals so that is survivable.
      await ev(() => {
        const st = window.__slime.services.state;
        for (const id of ['lucky', 'phoenix']) { st.party.addXp(id, 60); st.party.heal(id, { hp: 999, amp: 999 }); }
        st.inventory.add('pizza_slice', 4); st.inventory.add('hotdish', 2);
      });
      await walk('U');
      s = await driveUntil('entered room4', (sn) => sn.map === 'room4', 20_000);
      await page.waitForTimeout(400);
      await shot('content_c_05_room4_setup');
      s = await driveUntil('AUDITION won, Bajonka drops the contract', (sn) => (sn.entities || []).some((e) => e.id === 'contract'), SCENE_TIMEOUT_MS);
      check('Ryan is slimed after the AUDITION (map NPC still at the kit)', (s.entities || []).some((e) => e.id === 'ryan' && e.type === 'npc'), (s.entities || []).map((e) => `${e.id}:${e.type}`));
      await page.waitForTimeout(250);
      await shot('content_c_06_contract');
      s = await driveUntil('contract signed', (sn) => sn.flags.ryanJoined === true, SCENE_TIMEOUT_MS);
      check('flags.auditionDone + ryanJoined', s.flags.auditionDone === true && s.flags.ryanJoined === true, s.flags);
      check('Ryan in the party', s.party.some((m) => m.id === 'ryan'), s.party.map((m) => m.id));
      check('band_agreement given', s.inventory.some((e) => e.id === 'band_agreement'), s.inventory);
      s = await driveUntil('ONE MONTH LATER', (sn) => sn.flags.monthLater === true && sn.flags.monthLaterRan === true, SCENE_TIMEOUT_MS);
      check('contract pages = 3 + pages initialed before the contract', s.vars.contractPages === 3 + Math.max(0, (s.vars.saveCount || 0) - 1), { pages: s.vars.contractPages, saveCount: s.vars.saveCount });
      check('clipboard save bumped saveCount', s.vars.saveCount >= 1, s.vars);
    } else if (from('month')) {
      await ev(() => { window.__slime.chooseIndex = 1; });
      await ev(() => {
        const st = window.__slime.services.state;
        for (const id of ['lucky', 'phoenix']) { st.party.addXp(id, 60); st.party.heal(id, { hp: 999, amp: 999 }); }
        st.inventory.add('pizza_slice', 4); st.inventory.add('hotdish', 2);
      });
      await ev(() => window.__slime.warp('room4', 5, 8, 'right'));
      s = await driveUntil('ONE MONTH LATER (warped)', (sn) => sn.map === 'room4' && sn.flags.monthLaterRan === true, 30_000);
    }

    if (from('month')) {
      await page.waitForTimeout(300);
      await shot('content_c_07_month_later');
      s = await driveUntil('the ultimatum', (sn) => sn.flags.pedalboardFried === true, SCENE_TIMEOUT_MS);
      await page.waitForTimeout(600);
      await shot('content_c_08_ultimatum');
      s = await driveUntil('Brian quits', (sn, st) => sn.flags.brianQuit === true && st.idle, SCENE_TIMEOUT_MS);
      check('flags.brianQuit', s.flags.brianQuit === true, s.flags);
      check('Brian left the party', !s.party.some((m) => m.id === 'brian'), s.party.map((m) => m.id));
      check('fried_pedalboard given', s.inventory.some((e) => e.id === 'fried_pedalboard'), s.inventory);
      check('gig flyer on the floor', (s.entities || []).some((e) => e.id === 'gig_flyer'), (s.entities || []).map((e) => e.id));
      check('KRAAANG hangs on the back wall', (s.entities || []).some((e) => e.id === 'kraaang'), (s.entities || []).map((e) => e.id));
      check('player at (5,7) facing Brian\'s spot', s.map === 'room4' && s.x === 5 && s.y === 7, { x: s.x, y: s.y });
      await shot('content_c_09_brian_gone');

      // --- the flyer (CS-15) --------------------------------------------------------------------
      await walk('R');
      s = await snap();
      check('facing the flyer at (7,7)', s.x === 6 && s.y === 7 && s.facing === 'right', { x: s.x, y: s.y, facing: s.facing });
      await ev(() => { window.__slime.autoAdvance(false); });
      await press('confirm');
      await waitFn(() => window.__slime.services.ui.isBusy());
      await page.waitForTimeout(200);
      await shot('content_c_10_flyer_insert');
      await ev(() => { window.__slime.autoAdvance(true); });
      await flushDialogue();
      s = await driveUntil('flyer read', (sn, st) => sn.flags.hasPalmersFlyer === true && st.idle, 20_000);
      check('flags.hasPalmersFlyer + gigFlyer', s.flags.hasPalmersFlyer === true && s.flags.gigFlyer === true, s.flags);
      check('palmers_flyer given, flyer object gone', s.inventory.some((e) => e.id === 'palmers_flyer') && !(s.entities || []).some((e) => e.id === 'gig_flyer'), s.inventory);
    }

    // --- Palmer's: the crowd, the cop, the jukebox, the stage ---------------------------------
    await ev(() => {
      const st = window.__slime.services.state;
      for (const id of ['lucky', 'phoenix']) { st.party.addXp(id, 40); st.party.heal(id, { hp: 999, amp: 999 }); }
      if (!st.inventory.has('pizza_slice')) st.inventory.add('pizza_slice', 4);
    });
    await ev(() => window.__slime.warp('palmers', 8, 12, 'up'));
    s = await driveUntil('palmers loaded', (sn, st) => sn.map === 'palmers' && st.idle, 20_000);
    check('Palmer\'s crowd present (12 punks + named)', (s.entities || []).filter((e) => e.id.startsWith('punk_')).length === 12 && ['cop', 'stranger_tall', 'bartender', 'pulltab_lady', 'regular', 'nurse', 'guy'].every((id) => (s.entities || []).some((e) => e.id === id)), (s.entities || []).map((e) => e.id));
    check('Bajonka on her stool', (s.entities || []).some((e) => e.id === 'bajonka' && e.type === 'save'), (s.entities || []).map((e) => e.id));
    check('party is Lucky, Phoenix, Ryan', s.party.map((m) => m.id).join(',') === 'lucky,phoenix,ryan', s.party.map((m) => m.id));
    await page.waitForTimeout(300);
    await shot('content_c_11_palmers');
    // jukebox at (16,10): along the back row (the tall stranger blocks row 11 at x 14), up to (16,11), face up
    await walk('RRRRRRRR U');
    s = await snap();
    check('at the jukebox (16,11)', s.x === 16 && s.y === 11, { x: s.x, y: s.y });
    await walk('U'); // blocked by the jukebox tile: face up
    await press('confirm');
    s = await driveUntil('jukebox played', (sn, st) => sn.flags.jukeboxPlayed === true && st.idle, 20_000);
    check('flags.jukeboxPlayed', s.flags.jukeboxPlayed === true, s.flags);
    // to the stage: back row west to x 8, up the free column to row 4, east to x 19, down to row 6, onto (20,6)
    await ev(() => { window.__slime.chooseIndex = 0; }); // RAGE / PLEAD / JOKE → RAGE (the clipboard menu skips its disabled title row)
    await walk('D LLLLLLLL UUUUUUUU RRRRRRRRRRR DD R');
    await page.waitForTimeout(500);
    await shot('content_c_12_stage');
    s = await driveUntil('on stage, cop line', (sn) => sn.flags.onStage === true, 30_000);
    check('flags.onStage', s.flags.onStage === true, s.flags);
    s = await driveUntil('THE SET won → rubble', (sn) => sn.map === 'palmers_rubble', SCENE_TIMEOUT_MS);
    check('flags.eternityDone', s.flags.eternityDone === true, s.flags);
    await page.waitForTimeout(400);
    await shot('content_c_13_rubble');
    s = await driveUntil('I quit', (sn) => sn.flags.luckyRageLocked === true, SCENE_TIMEOUT_MS);
    await page.waitForTimeout(300);
    await shot('content_c_14_rage');
    s = await driveUntil('Ryan gone', (sn) => sn.flags.ryanQuit === true, SCENE_TIMEOUT_MS);
    check('vars.quitResponse = 0 (RAGE picked first)', s.vars.quitResponse === 0, s.vars);
    check('Ryan left the party', !s.party.some((m) => m.id === 'ryan'), s.party.map((m) => m.id));
    s = await driveUntil('chapter complete', (sn, st) => sn.flags.ch1Complete === true && st.idle, SCENE_TIMEOUT_MS);
    check('flags.ch1Complete', s.flags.ch1Complete === true, s.flags);
    check('van_keys + tour_itinerary given', ['van_keys', 'tour_itinerary'].every((id) => s.inventory.some((e) => e.id === id)), s.inventory);
    check('Bajonka save in the rubble', (s.entities || []).some((e) => e.id === 'bajonka' && e.type === 'save'), (s.entities || []).map((e) => e.id));
    check('final clipboard save bumped saveCount', s.vars.saveCount === 2, s.vars);
    check('party is Lucky + Phoenix', s.party.map((m) => m.id).join(',') === 'lucky,phoenix', s.party.map((m) => m.id));
    check('still in the rubble (no exits)', s.map === 'palmers_rubble', s.map);
    await page.waitForTimeout(400);
    await shot('content_c_15_end');

    const lastErrors = await ev(() => window.__slime.lastErrors);
    const scriptErrors = consoleErrors.filter((t) => /\[script|\[explore|\[entities\]|\[data\]/.test(t) && !/placeholder|not in manifest|unknown animation/.test(t));
    check('__slime.lastErrors is empty', Array.isArray(lastErrors) && lastErrors.length === 0, lastErrors);
    check('no script/engine console errors', scriptErrors.length === 0, scriptErrors);
    report.ok = errors.length === 0;
  } catch (err) {
    errors.push(`fatal: ${err && err.stack ? err.stack : String(err)}`);
    report.ok = false;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }
  report.consoleErrors = consoleErrors.slice(0, 40);
  report.durationMs = Date.now() - startedAt;
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write(`${JSON.stringify({ ok: false, errors: [`fatal: ${err && err.stack ? err.stack : String(err)}`] })}\n`);
  process.exit(1);
});
