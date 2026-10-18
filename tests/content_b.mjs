#!/usr/bin/env node
// Content B playthrough: Cedar Avenue hub (day, hub open, night) + the Hard Luck Café (CS-07 flyer,
// CS-08 Brian joins + the garage phone call). Builds with Vite (unless EXPLORE_KEEP_DIST=1), serves
// dist/, drives the game headless through window.__slime (docs/ARCHITECTURE.md §9) and writes
// screenshots to tests/screenshots/content_b_*.png. Prints one JSON line; exits non-zero on failure.
//
//   node tests/content_b.mjs
//
// Part of tests/run.mjs (after extensions.mjs). Knobs: PLAYWRIGHT_MODULE, SMOKE_CHROME, EXPLORE_KEEP_DIST=1.

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
const STEP_TIMEOUT_MS = 15_000;
const VIEWPORT = { width: 1024, height: 896 };
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const log = (m) => process.stderr.write(`[content_b] ${m}\n`);

function build() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) throw new Error(`vite not installed at ${viteBin}`);
  log('running vite build');
  const r = spawnSync(process.execPath, [viteBin, 'build'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) throw new Error(`vite build exited with ${r.status}`);
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

async function main() {
  const startedAt = Date.now();
  const errors = [];
  const checks = [];
  const screenshots = [];
  const notes = [];
  const report = { ok: false, checks, screenshots, notes, errors };
  const check = (name, ok, detail) => {
    checks.push({ name, ok: !!ok, ...(detail !== undefined ? { detail } : {}) });
    if (!ok) errors.push(`check failed: ${name}${detail !== undefined ? ` (${JSON.stringify(detail)})` : ''}`);
  };

  if (process.env.EXPLORE_KEEP_DIST === '1' && existsSync(path.join(DIST, 'index.html'))) log('EXPLORE_KEEP_DIST=1, reusing dist/');
  else build();

  const pw = loadPlaywright();
  const { server, port } = await serveStatic(DIST);
  const url = `http://127.0.0.1:${port}/?fast=1`;
  let browser = null;
  mkdirSync(SHOTS, { recursive: true });

  try {
    browser = await launch(pw.chromium);
    const page = await (await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })).newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err && err.message ? err.message : String(err)}`));
    page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText ?? '?'})`));
    page.on('response', (res) => { if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`); });

    const ev = (fn, arg) => page.evaluate(fn, arg);
    const shot = async (name) => { const p = path.join(SHOTS, `${name}.png`); await page.screenshot({ path: p }); screenshots.push(path.relative(ROOT, p)); };
    const waitFn = (fn, arg, timeout = STEP_TIMEOUT_MS) => page.waitForFunction(fn, arg, { timeout, polling: 50 });
    const waitIdle = (timeout) => waitFn(() => window.__slime.idle(), null, timeout);
    const press = (action) => ev((a) => window.__slime.press(a), action);
    const snap = () => ev(() => window.__slime.snapshot());
    const scene = () => ev(() => window.__slime.scene());
    const warp = (map, x, y, facing) => ev(([m, px, py, f]) => window.__slime.warp(m, px, py, f), [map, x, y, facing]);
    const setFlag = (k, v = true) => ev(([a, b]) => window.__slime.setFlag(a, b), [k, v]);
    const hasMap = (id) => ev((m) => !!(window.__slime.services.data && window.__slime.services.data.maps && window.__slime.services.data.maps[m]), id);

    await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await waitFn(() => window.__slime && window.__slime.isReady, null, READY_TIMEOUT_MS);
    await ev(() => window.__slime.newGame());
    await ev(() => { window.__slime.textInstant(true); window.__slime.autoAdvance(true); });
    await waitIdle();

    // Story state at scene 4 (first pass): Phoenix joined, hub closed.
    await ev(() => { const s = window.__slime; s.addParty('phoenix'); for (const f of ['metPhoenix', 'droneDefeated', 'phoenixJoined']) s.setFlag(f, true); });

    // --- S4: first pass, hub closed -----------------------------------------------------------
    await warp('street_cedar', 38, 12, 'left');
    await waitIdle();
    let s = await snap();
    check('warped to street_cedar', s.map === 'street_cedar' && s.x === 38 && s.y === 12, { map: s.map, x: s.x, y: s.y });
    const names = (s.entities || []).map((e) => e.id);
    check('day NPCs present on first pass', ['shoveler', 'cyclist', 'busker', 'crust_punk'].every((id) => names.includes(id)), names);
    check('no hub enemies while hub closed', !names.some((id) => ['slush', 'scooters', 'goose', 'analyst', 'billboard'].includes(id)), names);
    check('night roster absent by day', !names.some((id) => ['stranger_tall', 'smoker', 'bajonka', 'analyst_duo', 'goose_pair'].includes(id)), names);
    check('overlay hidden by day', s.overlay === false || s.overlay === null, s.overlay);
    await page.waitForTimeout(150);
    await shot('content_b_street_first_pass');

    // café door refusal before hubOpen
    await warp('street_cedar', 20, 9, 'up');
    await waitIdle();
    await press('up');
    await waitIdle();
    s = await snap();
    check('café door refused before hubOpen (still on the street)', s.map === 'street_cedar' && s.y === 9, { map: s.map, x: s.x, y: s.y });
    // rail refusal before the call
    await warp('street_cedar', 22, 15, 'down');
    await waitIdle();
    await press('down');
    await waitIdle();
    s = await snap();
    check('rail refused before brianCalledRyan (stepped back)', s.map === 'street_cedar' && s.y === 15, { map: s.map, x: s.x, y: s.y });

    // --- S6: hub open ---------------------------------------------------------------------------
    await ev(() => { const s = window.__slime; for (const f of ['signalSent', 'weekLater', 'hubOpen']) s.setFlag(f, true); s.give('flyer_blank', 1); });
    await warp('street_cedar', 13, 9, 'down');
    await waitIdle();
    s = await snap();
    const names2 = (s.entities || []).map((e) => e.id);
    check('day enemies present with hubOpen', ['slush', 'scooters', 'goose', 'analyst', 'billboard'].every((id) => names2.includes(id)), names2);
    check('office worker present after signalSent', names2.includes('office_worker'), names2);
    const slush = (s.entities || []).find((e) => e.id === 'slush');
    check('slush pile static at the crosswalk (16,12)', slush && slush.x === 16 && slush.y === 12 && slush.behavior === 'static', slush);
    await page.waitForTimeout(150);
    await shot('content_b_street_hub_open');

    // Towers sign line (invisible object on a solid wall tile, interact from below)
    await ev(() => window.__slime.autoAdvance(false));
    await press('up');
    await press('confirm');
    await waitFn(() => window.__slime.services.ui.isBusy());
    await page.waitForTimeout(120);
    await shot('content_b_street_towers_sign');
    await ev(() => window.__slime.autoAdvance(true));
    for (let i = 0; i < 6 && !(await ev(() => window.__slime.idle())); i++) { await press('confirm'); await page.waitForTimeout(60); }
    await waitIdle();
    // Pizza Luce box gives one slice, once
    await warp('street_cedar', 35, 10, 'left');
    await waitIdle();
    const pizzaBefore = ((await snap()).inventory.find((e) => e.id === 'pizza_slice') || { qty: 0 }).qty;
    await press('confirm');
    await waitIdle();
    await press('confirm');
    await waitIdle();
    s = await snap();
    const pizzaAfter = (s.inventory.find((e) => e.id === 'pizza_slice') || { qty: 0 }).qty;
    check('pizza box gave exactly one slice', pizzaAfter === pizzaBefore + 1 && s.flags.pizzaBoxLooted2 === true, { pizzaBefore, pizzaAfter, flag: s.flags.pizzaBoxLooted2 });

    // --- S7: the café ----------------------------------------------------------------------------
    await warp('street_cedar', 20, 9, 'up');
    await waitIdle();
    await press('up');
    await waitFn(() => window.__slime.snapshot().map === 'coffee_shop' && window.__slime.idle());
    s = await snap();
    check('café door → coffee_shop (10,12)', s.map === 'coffee_shop' && s.x === 10 && s.y === 12, { map: s.map, x: s.x, y: s.y });
    const cafeNames = (s.entities || []).map((e) => e.id);
    check('café roster present (barista, screenwriter, poet, intern, brian)', ['barista', 'screenwriter', 'poet', 'intern', 'brian'].every((id) => cafeNames.includes(id)), cafeNames);
    await page.waitForTimeout(150);
    await shot('content_b_cafe');

    // Brian's pre-join line
    await warp('coffee_shop', 16, 9, 'right');
    await waitIdle();
    await ev(() => window.__slime.autoAdvance(false));
    await press('confirm');
    await waitFn(() => window.__slime.services.ui.isBusy());
    await page.waitForTimeout(120);
    await shot('content_b_cafe_brian_line');
    await ev(() => window.__slime.autoAdvance(true));
    for (let i = 0; i < 8 && !(await ev(() => window.__slime.idle())); i++) { await press('confirm'); await page.waitForTimeout(60); }
    await waitIdle();

    // CS-07: the flyer (choose "NO COPS" = index 1)
    await warp('coffee_shop', 16, 3, 'up');
    await waitIdle();
    await ev(() => { window.__slime.chooseIndex = 1; });
    await press('confirm');
    await waitIdle(20_000);
    s = await snap();
    check('CS-07 posted the flyer', s.flags.flyerPosted === true, s.flags);
    check('CS-07 vars.flyerText == 1 (NO COPS)', s.vars.flyerText === 1, s.vars);
    check('CS-07 took the blank flyer', !s.inventory.some((e) => e.id === 'flyer_blank'), s.inventory);
    // the corkboard afterwards shows the posted-flyer lines (no re-run)
    await press('confirm');
    await waitIdle();
    s = await snap();
    check('corkboard second press keeps flyerText', s.vars.flyerText === 1, s.vars);

    // CS-08: walk to the door trigger at (10,12)
    const garage = await hasMap('garage_north');
    if (!garage) notes.push('garage_north map missing at test time (Content A): CS-08 garage teleport will fail');
    await warp('coffee_shop', 10, 11, 'down');
    await waitIdle();
    await press('down');
    await waitFn(() => window.__slime.snapshot().flags.brianJoined === true || window.__slime.idle(), null, 20_000);
    if (garage) {
      try {
        await waitFn(() => window.__slime.snapshot().map === 'garage_north', null, 10_000);
        await page.waitForTimeout(250);
        await shot('content_b_garage_call');
      } catch { notes.push('did not catch the garage_north frame for a screenshot'); }
    }
    // the cutscene teleports to the garage and back; wait until the script ends
    await waitIdle(40_000);
    s = await snap();
    check('CS-08 ran: flags.brianJoined', s.flags.brianJoined === true, s.flags);
    check('CS-08: Brian in the party', s.party.some((m) => m.id === 'brian'), s.party.map((m) => m.id));
    check('CS-08: Brian joined second (party order lucky, phoenix, brian)', s.party.map((m) => m.id).join(',') === 'lucky,phoenix,brian', s.party.map((m) => m.id));
    check('CS-08: two coffees from Brian', (s.inventory.find((e) => e.id === 'coffee') || { qty: 0 }).qty >= 2, s.inventory);
    check('CS-08: flags.brianCalledRyan + ryanCalled', s.flags.brianCalledRyan === true && s.flags.ryanCalled === true, s.flags);
    check('CS-08: back in the café at (10,11)', s.map === 'coffee_shop' && s.x === 10 && s.y === 11, { map: s.map, x: s.x, y: s.y });
    check('Brian NPC gone from the window table after joining (only the follower remains)', !(s.entities || []).some((e) => e.id === 'brian' && e.type === 'npc'), (s.entities || []).filter((e) => e.id === 'brian'));
    check('Brian trails the party as a follower', (s.followers || []).some((f) => f.id === 'brian'), s.followers);
    await page.waitForTimeout(150);
    await shot('content_b_cafe_after_brian');

    // leaving: the trigger must not re-fire; the door exits to the street at (20,9)
    await press('down');
    await waitIdle();
    await press('down');
    await waitFn(() => window.__slime.snapshot().map === 'street_cedar' && window.__slime.idle());
    s = await snap();
    check('café door → street (20,9)', s.map === 'street_cedar' && s.x === 20 && s.y === 9, { map: s.map, x: s.x, y: s.y });

    // the rail now accepts (caption + teleport) when city_sound_hall exists
    const hall = await hasMap('city_sound_hall');
    if (hall) {
      await warp('street_cedar', 22, 15, 'down');
      await waitIdle();
      await press('down');
      await waitFn(() => window.__slime.snapshot().map === 'city_sound_hall' && window.__slime.idle(), null, 20_000);
      s = await snap();
      check('rail → city_sound_hall (3,6), inside the doorway', s.map === 'city_sound_hall' && s.x === 3 && s.y === 6, { map: s.map, x: s.x, y: s.y });
    } else {
      notes.push('city_sound_hall map missing at test time: rail exit not exercised');
    }

    // --- S11: night pass ----------------------------------------------------------------------
    await ev(() => { const s = window.__slime; for (const f of ['gigFlyer', 'hasPalmersFlyer', 'hasBajonka', 'brianQuit', 'monthLater']) s.setFlag(f, true); });
    await warp('street_cedar', 9, 10, 'left');
    await waitIdle();
    s = await snap();
    const nightNames = (s.entities || []).map((e) => e.id);
    check('night roster present', ['stranger_tall', 'smoker', 'bajonka', 'analyst_duo', 'goose_pair'].every((id) => nightNames.includes(id)), nightNames);
    check('day roster gone at night', !nightNames.some((id) => ['shoveler', 'cyclist', 'busker', 'crust_punk', 'slush', 'scooters', 'goose', 'analyst'].includes(id)), nightNames);
    check('night overlay visible', s.overlay === true, s.overlay);
    check('bajonka is a save point by Palmer\'s door', (s.entities || []).some((e) => e.id === 'bajonka' && e.type === 'save' && e.x === 5 && e.y === 9), (s.entities || []).find((e) => e.id === 'bajonka'));
    await page.waitForTimeout(200);
    await shot('content_b_street_night');

    // Palmer's door is open at night (exit to `palmers` when it exists)
    const palmers = await hasMap('palmers');
    if (palmers) {
      await warp('street_cedar', 6, 9, 'up');
      await waitIdle();
      await press('up');
      await waitFn(() => window.__slime.snapshot().map === 'palmers' && window.__slime.idle(), null, 20_000);
      s = await snap();
      check("Palmer's door → palmers (8,12)", s.map === 'palmers' && s.x === 8 && s.y === 12, { map: s.map, x: s.x, y: s.y });
    } else {
      notes.push('palmers map missing at test time: Palmer\'s door not exercised');
    }

    const lastErrors = await ev(() => window.__slime.lastErrors);
    check('__slime.lastErrors is empty', Array.isArray(lastErrors) && lastErrors.length === 0, lastErrors);
    report.ok = errors.length === 0;
  } catch (err) {
    errors.push(`fatal: ${err && err.stack ? err.stack : String(err)}`);
    report.ok = false;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }
  report.durationMs = Date.now() - startedAt;
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write(`${JSON.stringify({ ok: false, errors: [`fatal: ${err && err.stack ? err.stack : String(err)}`] })}\n`);
  process.exit(1);
});
