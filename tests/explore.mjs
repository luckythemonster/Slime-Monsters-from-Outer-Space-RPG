#!/usr/bin/env node
// Headless gameplay test: builds the game with Vite (unless EXPLORE_KEEP_DIST=1), serves dist/,
// boots it in headless Chromium with `?fast=1` and drives it through window.__slime
// (docs/ARCHITECTURE.md §9): new game, grid walking, wall collision, NPC dialogue + flag, map exit,
// stub battle, cutscene script, pause menu, save/load round trip. Screenshots go to
// tests/screenshots/explore_*.png. Prints one JSON line and exits non-zero on failure.
//
//   node tests/explore.mjs
//
// Environment knobs: PLAYWRIGHT_MODULE, SMOKE_CHROME (same meaning as tests/smoke.mjs),
// EXPLORE_KEEP_DIST=1 to reuse dist/ from a previous build.

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
const STEP_TIMEOUT_MS = 10_000;
const VIEWPORT = { width: 1024, height: 896 };
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const log = (m) => process.stderr.write(`[explore] ${m}\n`);

// ---- build / serve / browser (same recipe as tests/smoke.mjs) --------------------------------

function build() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) throw new Error(`vite not installed at ${viteBin}`);
  log('running vite build');
  const r = spawnSync(process.execPath, [viteBin, 'build'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.stdout) process.stderr.write(r.stdout);
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

// ---- the test ------------------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const errors = [];
  const checks = [];
  const screenshots = [];
  const report = { ok: false, checks, screenshots, errors };
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
    const waitIdle = () => waitFn(() => window.__slime.idle());
    const press = (action) => ev((a) => window.__slime.press(a), action);
    const snap = () => ev(() => window.__slime.snapshot());
    const scene = () => ev(() => window.__slime.scene());

    await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await waitFn(() => window.__slime && window.__slime.isReady, null, READY_TIMEOUT_MS);
    await page.waitForTimeout(300);
    await shot('explore_title');
    check('title scene up', (await scene()) === 'Title', await scene());

    // --- new game ---------------------------------------------------------------------------
    const s0 = await ev(() => window.__slime.newGame());
    await ev(() => { window.__slime.textInstant(true); window.__slime.autoAdvance(true); });
    await waitIdle();
    check('scene is Explore after newGame', (await scene()) === 'Explore', await scene());
    check('start map/pos from start.json', s0.map === 'dev_alley' && s0.x === 2 && s0.y === 7, { map: s0.map, x: s0.x, y: s0.y });

    // --- walk 3 tiles right ---------------------------------------------------------------------
    const start = await snap();
    for (let i = 0; i < 3; i++) await press('right');
    const walked = await snap();
    check('3 presses right = +3 tiles', walked.x === start.x + 3 && walked.y === start.y, { from: [start.x, start.y], to: [walked.x, walked.y] });
    check('facing right', walked.facing === 'right', walked.facing);
    await shot('explore_walk');

    // --- wall: dumpster above (5,6) -------------------------------------------------------------
    await press('up');
    const bumped = await snap();
    check('wall blocks movement', bumped.x === walked.x && bumped.y === walked.y, { x: bumped.x, y: bumped.y });
    check('turns to face the wall', bumped.facing === 'up', bumped.facing);

    // --- NPC: phoenix at (6,6) ------------------------------------------------------------------
    await press('right');
    await press('up');
    const beforeTalk = await snap();
    check('NPC blocks movement', beforeTalk.x === 6 && beforeTalk.y === 7 && beforeTalk.facing === 'up', { x: beforeTalk.x, y: beforeTalk.y, facing: beforeTalk.facing });
    await ev(() => window.__slime.autoAdvance(false));
    await press('confirm');
    await waitFn(() => window.__slime.services.ui.isBusy());
    await page.waitForTimeout(150);
    await shot('explore_dialogue');
    await ev(() => window.__slime.autoAdvance(true));
    for (let i = 0; i < 12 && !(await ev(() => window.__slime.idle())); i++) { await press('confirm'); await page.waitForTimeout(80); }
    await waitIdle();
    const talked = await snap();
    check('script set flags.metPhoenix', talked.flags.metPhoenix === true, talked.flags);
    check('script inc vars.phoenixTalks', talked.vars.phoenixTalks === 1, talked.vars);
    const pizza = talked.inventory.find((e) => e.id === 'pizza_slice');
    check('choice 0 gave a pizza slice (1 → 2)', pizza && pizza.qty === 2, talked.inventory);

    // --- exit to dev_street ---------------------------------------------------------------------
    await ev(() => window.__slime.warp('dev_alley', 17, 7, 'right'));
    await waitIdle();
    await press('right');
    await press('right');
    await waitFn(() => window.__slime.snapshot().map === 'dev_street' && window.__slime.idle());
    const street = await snap();
    check('exit changed map', street.map === 'dev_street' && street.x === 1 && street.y === 7, { map: street.map, x: street.x, y: street.y });
    check('onFirstEnter ran', street.flags.visitedStreet === true, street.flags);
    await page.waitForTimeout(200);
    await shot('explore_street');

    // --- stub battle ----------------------------------------------------------------------------
    const result = await ev(() => window.__slime.startBattle('street_cop_duo'));
    await waitIdle();
    check("stub battle resolves 'win'", result === 'win', result);
    check('back in Explore after battle', (await scene()) === 'Explore', await scene());

    // --- kitchen-sink cutscene script ----------------------------------------------------------
    await ev(() => window.__slime.runScript('dev_cutscene'));
    await waitIdle();
    const cut = await snap();
    check('cutscene: end stopped the script', cut.flags.cutsceneDone === true && cut.flags.unreachable === undefined, cut.flags);
    check('cutscene: run subroutine', cut.flags.subroutineRan === true, cut.flags);
    check('cutscene: label/goto loop ran twice', cut.vars.loopCount === 2, cut.vars);
    check('cutscene: party add', cut.party.some((m) => m.id === 'phoenix'), cut.party.map((m) => m.id));
    check('cutscene: give/take money', cut.money === 11, cut.money);
    check('cutscene: give/take item', (cut.inventory.find((e) => e.id === 'coffee') || {}).qty === 1, cut.inventory);
    check('cutscene: despawned ryan', !(cut.entities || []).some((e) => e.id === 'ryan'), cut.entities);

    // --- pause menu -----------------------------------------------------------------------------
    await press('menu');
    await waitFn(() => window.__slime.scene() === 'Menu');
    await page.waitForTimeout(150);
    await shot('explore_menu');
    await press('menu');
    await waitFn(() => window.__slime.scene() === 'Explore');
    await waitIdle();
    check('menu closed back to Explore', (await scene()) === 'Explore', await scene());

    // --- save / load round trip ----------------------------------------------------------------
    await ev(() => window.__slime.save(1));
    const a = await snap();
    await ev(() => window.__slime.warp('dev_alley', 3, 3, 'down'));
    await waitIdle();
    await press('down');
    const moved = await snap();
    check('moved away before load', moved.map === 'dev_alley' && moved.y === 4, { map: moved.map, y: moved.y });
    await ev(() => window.__slime.load(1));
    await waitIdle();
    const b = await snap();
    const pick = (s) => JSON.stringify({ map: s.map, x: s.x, y: s.y, facing: s.facing, flags: s.flags, party: s.party, inventory: s.inventory, money: s.money });
    check('load restores the saved snapshot', pick(a) === pick(b), { a: pick(a), b: pick(b) });
    check('scene is Explore after load', (await scene()) === 'Explore', await scene());
    await shot('explore_loaded');

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
