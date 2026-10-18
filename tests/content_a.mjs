#!/usr/bin/env node
// Content walkthrough for the Chapter 1 opening (content agent A): pod bay → freefall → alley
// (CS-01..CS-04, the drone tutorial) → apartment (CS-05 signal montage over rooftops + garage,
// CS-06 ONE WEEK LATER), plus the interactables on those maps. Drives the built game headless
// through window.__slime (docs/ARCHITECTURE.md §9) with autoAdvance + textInstant, asserts the
// DESIGN.md flag spine and screenshots every map to tests/screenshots/content_a_*.png.
//
//   node tests/content_a.mjs            (EXPLORE_KEEP_DIST=1 or CONTENT_KEEP_DIST=1 reuses dist/)
//
// Part of tests/run.mjs (which sets EXPLORE_KEEP_DIST=1 after smoke.mjs built dist/). Same
// build/serve/browser recipe as tests/explore.mjs (PLAYWRIGHT_MODULE, SMOKE_CHROME knobs).

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
const CUTSCENE_TIMEOUT_MS = 150_000;
const VIEWPORT = { width: 1024, height: 896 };
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const log = (m) => process.stderr.write(`[content_a] ${m}\n`);

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

  if ((process.env.EXPLORE_KEEP_DIST === '1' || process.env.CONTENT_KEEP_DIST === '1') && existsSync(path.join(DIST, 'index.html'))) log('KEEP_DIST set, reusing dist/');
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
    const shot = async (name) => { await page.waitForTimeout(120); const p = path.join(SHOTS, `${name}.png`); await page.screenshot({ path: p }); screenshots.push(path.relative(ROOT, p)); };
    const waitFn = (fn, arg, timeout = STEP_TIMEOUT_MS) => page.waitForFunction(fn, arg, { timeout, polling: 50 });
    const waitIdle = (timeout = STEP_TIMEOUT_MS) => waitFn(() => window.__slime.idle(), null, timeout);
    const press = (action) => ev((a) => window.__slime.press(a), action);
    const step = async (action) => { await press(action); await waitIdle(CUTSCENE_TIMEOUT_MS); };
    const snap = () => ev(() => window.__slime.snapshot());
    const scene = () => ev(() => window.__slime.scene());
    const warp = async (map, x, y, facing) => { await ev(([m, a, b, f]) => window.__slime.warp(m, a, b, f), [map, x, y, facing]); await waitIdle(CUTSCENE_TIMEOUT_MS); };
    const has = (s, id) => (s.inventory || []).some((e) => e.id === id);
    const qty = (s, id) => ((s.inventory || []).find((e) => e.id === id) || {}).qty || 0;

    await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await waitFn(() => window.__slime && window.__slime.isReady, null, READY_TIMEOUT_MS);
    await page.waitForTimeout(300);
    check('title scene up', (await scene()) === 'Title', await scene());

    // --- S1 pod bay: CS-01 runs on first enter ------------------------------------------------
    await ev(() => { window.__slime.textInstant(true); window.__slime.autoAdvance(true); });
    const s0 = await ev(() => window.__slime.newGame());
    await waitIdle(CUTSCENE_TIMEOUT_MS);
    check('start.json → pod_bay (7,11) facing up', s0.map === 'pod_bay' && s0.x === 7 && s0.y === 11, { map: s0.map, x: s0.x, y: s0.y, facing: s0.facing });
    let s = await snap();
    check('CS-01 ep0_pod_intro ran (flags.podIntro)', s.flags.podIntro === true, s.flags);
    check('start money $4 + Half-Ounce x4', s.money === 4 && qty(s, 'half_ounce') === 4, { money: s.money, inv: s.inventory });
    await shot('content_a_pod_bay_start');

    // walk out of the pod up to the speaker: the four Dad floor bands fire on rows 10, 8, 6, 4
    for (let i = 0; i < 8; i++) await step('up');
    s = await snap();
    check('walked to the catwalk (7,3)', s.x === 7 && s.y === 3, { x: s.x, y: s.y });
    check('Dad floor bands 1..4 fired once each', ['dad_1', 'dad_2', 'dad_3', 'dad_4'].every((id) => s.flags[`trig_pod_bay_${id}`] === true), s.flags);

    // EJECT refuses while Dad talks
    await warp('pod_bay', 7, 11, 'left');
    await step('confirm');
    s = await snap();
    check('EJECT locked before the slap', s.flags.ejected !== true && s.map === 'pod_bay', { ejected: s.flags.ejected, map: s.map });

    // CS-02: slap the speaker
    await warp('pod_bay', 7, 3, 'up');
    await step('confirm');
    s = await snap();
    check('CS-02 ep0_speaker set flags.podSpeakerSlapped', s.flags.podSpeakerSlapped === true, s.flags);
    await shot('content_a_pod_bay');

    // walk back down: the "mmf" twins fire on the same bands
    for (let i = 0; i < 8; i++) await step('down');
    s = await snap();
    check('back in the pod (7,11)', s.x === 7 && s.y === 11, { x: s.x, y: s.y });
    check('mmf twins fired after the slap', ['dad_1_mmf', 'dad_4_mmf'].every((id) => s.flags[`trig_pod_bay_${id}`] === true), s.flags);

    // interactables: guitar case (right), nameplate
    await step('right'); await step('confirm');
    s = await snap();
    check('guitar case line read', s.flags.guitarCaseRead === true, s.flags);
    await warp('pod_bay', 11, 10, 'down'); await step('confirm');
    s = await snap();
    check("Billy's pod nameplate sets flags.readBillyPod", s.flags.readBillyPod === true, s.flags);

    // --- CS-03 EJECT → Freefall → alley CS-04 (crash, Phoenix, drone tutorial, join, autosave) ---
    await warp('pod_bay', 7, 11, 'left');
    await step('confirm');
    s = await snap();
    check('CS-03 ejected + freefall + teleport to alley', s.flags.ejected === true && s.map === 'alley', { ejected: s.flags.ejected, map: s.map });
    check('sunglasses given on landing', has(s, 'slime_sunglasses'), s.inventory);
    check('CS-04 flags: metPhoenix, droneDefeated, phoenixJoined', s.flags.metPhoenix === true && s.flags.droneDefeated === true && s.flags.phoenixJoined === true, s.flags);
    check('Phoenix in the party', (s.party || []).some((m) => m.id === 'phoenix'), (s.party || []).map((m) => m.id));
    check('Lucky stepped out of the crater to (9,9)', s.x === 9 && s.y === 9, { x: s.x, y: s.y });
    const ents = (s.entities || []).map((e) => e.id);
    check('crater, tipped dumpsters, drone wreck, Bajonka cameo present', ['crater', 'dumpster_3', 'dumpster_4', 'drone_wreck', 'bajonka_cameo'].every((id) => ents.includes(id)), ents);
    check('drone and CRASH word despawned; Phoenix NPC replaced by follower', !ents.includes('drone') && !ents.includes('crash_fx') && (s.entities || []).some((e) => e.id === 'phoenix' && e.type === 'follower'), ents);
    check('autosave 1 landed in a slot', (await ev(() => [1, 2, 3].some((n) => window.__slime.state.hasSave(n)))) === true);
    check('scene is Explore after the tutorial battle', (await scene()) === 'Explore', await scene());
    await shot('content_a_alley');

    // alley interactables
    await step('up'); await step('confirm'); // crater from (9,9) facing up
    s = await snap();
    check('crater line read', s.flags.craterRead === true, s.flags);
    await warp('alley', 11, 6, 'up'); await step('confirm');
    s = await snap();
    check('tipped dumpster gives one Pizza Slice (flags.pizzaBoxLooted)', s.flags.pizzaBoxLooted === true && has(s, 'pizza_slice'), { flags: s.flags.pizzaBoxLooted, inv: s.inventory });
    await warp('alley', 19, 7, 'up'); await step('confirm'); await step('confirm');
    s = await snap();
    check('Bajonka cameo seen (flags.bajonkaSeen)', s.flags.bajonkaSeen === true, s.flags);
    await warp('alley', 14, 9, 'up'); await step('confirm');
    s = await snap();
    check('drone wreck line read', s.flags.wreckRead === true, s.flags);

    // --- S5 apartment: CS-05 the signal (rooftops pan, garage, END PART 1 / ONE WEEK LATER), CS-06 ---
    await warp('apartment', 3, 8, 'down');
    await shot('content_a_apartment_before');
    await step('confirm'); // the amp
    s = await snap();
    check('CS-05 ran: signalSent, weekLater, hubOpen', s.flags.signalSent === true && s.flags.weekLater === true && s.flags.hubOpen === true, s.flags);
    check('ONE WEEK LATER lands on the couch (apartment 3,7)', s.map === 'apartment' && s.x === 3 && s.y === 7, { map: s.map, x: s.x, y: s.y });
    check('CS-06 gave the blank flyer', has(s, 'flyer_blank'), s.inventory);
    check('Bajonka couch cameo present after weekLater', (s.entities || []).some((e) => e.id === 'bajonka_couch'), (s.entities || []).map((e) => e.id));
    check('player sprite back to lucky after the glow swap', (await ev(() => window.__slime.explore().player.sheet)) === 'lucky');
    await shot('content_a_apartment');

    // apartment interactables
    await warp('apartment', 3, 8, 'down'); await step('confirm'); // the amp again
    s = await snap();
    check('amp after the signal reads the rent line (flags.ampRead)', s.flags.ampRead === true, s.flags);
    await warp('apartment', 6, 8, 'up');
    for (let i = 0; i < 5; i++) await step('confirm');
    s = await snap();
    check('bills cycle five lines then set flags.billsRead', s.flags.billsRead === true && s.vars.billsIndex === 0, { billsRead: s.flags.billsRead, idx: s.vars.billsIndex });
    await warp('apartment', 10, 3, 'up'); await step('confirm');
    s = await snap();
    check('fridge gives Pizza Slice + Tater Tot Hotdish once', s.flags.fridgeLooted === true && qty(s, 'pizza_slice') >= 2 && qty(s, 'hotdish') === 1, s.inventory);
    await warp('apartment', 2, 10, 'up'); await step('confirm');
    s = await snap();
    check('bass stand gives the Beat-Up Bass once', s.flags.bassTaken === true && has(s, 'beatup_bass'), s.inventory);
    const moneyBefore = s.money;
    await warp('apartment', 2, 7, 'up'); await step('confirm'); // couch: autoAdvance picks "Nap"
    s = await snap();
    check('couch nap finds $2 in the cushions once', s.flags.couchCushions === true && s.money === moneyBefore + 2, { before: moneyBefore, after: s.money });
    await warp('apartment', 4, 7, 'up'); await step('confirm');
    s = await snap();
    check('Bajonka on the couch arm has her line', s.flags.aptBajonkaRead === true, s.flags);

    // leaving: the once-only autosave trigger in front of the door after weekLater
    await warp('apartment', 12, 11, 'down'); await step('down');
    s = await snap();
    check('autosave 2 trigger fired at the door', s.flags.trig_apartment_autosave_door === true && s.vars.lastAutosave === 'apartment', { flags: s.flags.trig_apartment_autosave_door, last: s.vars.lastAutosave });

    // --- cutscene maps: layout screenshots ----------------------------------------------------
    await warp('rooftops', 5, 10, 'right');
    await shot('content_a_rooftops');
    await warp('rooftops', 36, 10, 'right');
    await shot('content_a_rooftops_east');
    await warp('garage_north', 8, 9, 'up');
    await shot('content_a_garage_north');
    s = await snap();
    check('garage: kit and Ryan placed', ['kit', 'ryan'].every((id) => (s.entities || []).some((e) => e.id === id)), (s.entities || []).map((e) => e.id));

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
