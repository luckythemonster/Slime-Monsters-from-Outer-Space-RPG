#!/usr/bin/env node
// Foundations test (docs/ROADMAP.md): what every later chapter stands on, in a real browser.
//   1. A version 1 save from the end of Chapter 1 (tests/fixtures/save_ch1_end_v1.json, made by a real playthrough
//      before save version 2 existed) is put in localStorage. CONTINUE on the title screen hands it to Chapter 2's
//      entry script: the chapter card, TO BE CONTINUED (until Chapter 2 is built), the title again.
//   2. The same save, loaded: gear sits in the new slots, the Pothole Invoice and the crowd bank are there, and
//      saving it again writes version 2.
//   3. The seeded Chapter 2 start (tests/fixtures/ch02_start.json) loads through __slime.loadSave, the way a
//      chapter's tests start without replaying the chapters before it.
// Builds with Vite unless EXPLORE_KEEP_DIST=1. Prints one JSON line and exits non-zero on failure.
//
//   node tests/foundations.mjs


import { spawnSync } from 'node:child_process';
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
const STEP_TIMEOUT_MS = 10_000;
const VIEWPORT = { width: 1024, height: 896 };
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const log = (m) => process.stderr.write(`[foundations] ${m}\n`);

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

  const v1 = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'fixtures', 'save_ch1_end_v1.json'), 'utf8'));
  const ch02 = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'fixtures', 'ch02_start.json'), 'utf8'));
  const v1Raw = JSON.stringify(v1);

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
    const scene = () => ev(() => window.__slime.scene());

    // The old save is in PAGE 2 before the game boots, exactly as a returning player's browser has it.
    await page.addInitScript((raw) => { if (!window.localStorage.getItem('smfos.save.2')) window.localStorage.setItem('smfos.save.2', raw); }, v1Raw);
    await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await waitFn(() => window.__slime && window.__slime.isReady, null, READY_TIMEOUT_MS);
    await page.waitForTimeout(300);
    check('title scene up with the version 1 save in PAGE 2', (await scene()) === 'Title' && (await ev(() => JSON.parse(window.localStorage.getItem('smfos.save.2')).version)) === 1, await scene());

    // ---- 1. CONTINUE hands the finished chapter to Chapter 2's entry script ---------------------------
    await ev(() => {
      window.__titles = 0;
      window.__cards = [];
      window.__slime.game.scene.getScene('Title').events.on('create', () => { window.__titles += 1; });
      // Cards hold 100 ms under ?fast=1: record them from inside the page, every frame.
      window.__slime.game.events.on('poststep', () => {
        const top = window.__slime.services.ui.debugState().top;
        if (top && top.type === 'caption' && top.text && window.__cards[window.__cards.length - 1] !== top.text) window.__cards.push(top.text);
      });
    });
    await ev(() => window.__slime.press('down'));   // New Game → Continue
    await ev(() => window.__slime.press('confirm'));
    await waitFn(() => window.__titles >= 1 && window.__slime.scene() === 'Title' && window.__cards.some((t) => /TO BE CONTINUED/.test(t)), null, 30_000).catch(async (err) => {
      await shot('foundations_handoff_stuck');
      const where = await ev(() => ({ scene: window.__slime.scene(), titles: window.__titles, cards: window.__cards, ui: window.__slime.services.ui.debugState(), errors: window.__slime.lastErrors }));
      throw new Error(`the Chapter 2 hand-off did not come back to the title: ${JSON.stringify(where)} (${err.message.split('\n')[0]})`);
    });
    const cards = await ev(() => window.__cards);
    check('CONTINUE on a finished Chapter 1 shows the Chapter 2 card, then TO BE CONTINUED', cards.length === 2 && /CHAPTER 2/.test(cards[0]) && /GIG IN THE POTATO BELT/.test(cards[0]) && /TO BE CONTINUED/.test(cards[1]), cards);
    check('and comes back to the title', (await scene()) === 'Title', await scene());
    // The hand-off is for that one CONTINUE. A New Game straight after it must be a new game, not the card again.
    await ev(() => { window.__cards.length = 0; });
    await waitFn(() => { const top = window.__slime.services.ui.debugState().top; return !!top && top.type === 'menu' && top.state === 'open' && top.selected === 0; });
    await ev(() => window.__slime.press('confirm'));   // the cursor rests on New Game
    await waitFn(() => window.__slime.scene() === 'Explore' && window.__slime.snapshot().map === 'pod_bay', null, 15_000);
    await page.waitForTimeout(600);
    check('New Game after the Chapter 2 card starts Chapter 1 in the pod bay, with no chapter card', (await scene()) === 'Explore' && (await ev(() => window.__cards.length)) === 0 && (await ev(() => window.__slime.snapshot().flags.ch1Complete)) !== true, await ev(() => ({ cards: window.__cards, map: window.__slime.snapshot().map })));
    check('the old save in PAGE 2 was not rewritten by looking at it', (await ev(() => window.localStorage.getItem('smfos.save.2'))) === v1Raw);
    await page.waitForTimeout(200);
    await shot('foundations_title_after_ch2_card');

    // ---- 2. the same version 1 save, loaded and saved again ------------------------------------------
    await ev(() => { window.__slime.textInstant(true); window.__slime.autoAdvance(true); });
    await ev(() => window.__slime.load(2));
    await waitFn(() => window.__slime.idle() && window.__slime.snapshot().map === 'palmers_rubble').catch(async (err) => {
      const where = await ev(() => { const s = window.__slime.snapshot(); return { scene: s.scene, map: s.map, x: s.x, y: s.y, idle: window.__slime.idle(), ui: window.__slime.services.ui.debugState(), errors: window.__slime.lastErrors }; });
      throw new Error(`the version 1 save did not settle in the rubble: ${JSON.stringify(where)} (${err.message.split('\n')[0]})`);
    });
    const s = await ev(() => window.__slime.snapshot());
    const phoenix = s.party.find((m) => m.id === 'phoenix');
    const lucky = s.party.find((m) => m.id === 'lucky');
    check('the version 1 save loads into the rubble where it was made', s.scene === 'Explore' && s.map === 'palmers_rubble' && s.x === v1.x && s.y === v1.y && s.flags.ch1Complete === true, { map: s.map, x: s.x, y: s.y });
    check("Phoenix's hoodie is in WEAR; nobody has an accessory slot", phoenix.equip.wear === 'hoodie' && s.party.every((m) => !('accessory' in m.equip) && 'rig' in m.equip && 'sticker' in m.equip), s.party.map((m) => m.equip));
    check('levels, XP and HP are the old save\'s', lucky.level === v1.party[0].level && lucky.xp === v1.party[0].xp && lucky.hp === v1.party[0].hp && phoenix.hp === v1.party[1].hp, s.party.map((m) => [m.id, m.level, m.xp, m.hp]));
    check('chops, nodes and breath exist and are empty', s.party.every((m) => m.chops === 0 && Array.isArray(m.nodes) && m.nodes.length === 0 && m.breath === null), s.party.map((m) => [m.chops, m.nodes, m.breath]));
    check('the Pothole Invoice is in the bag and the crowd bank holds both gigs', s.inventory.some((e) => e.id === 'pothole_invoice' && e.qty === 1) && s.vars.crowdBank === 80, { inventory: s.inventory, crowdBank: s.vars.crowdBank });
    check('everything the old bag held is still in it', v1.inventory.every((row) => s.inventory.some((e) => e.id === row.id && e.qty === row.qty)), s.inventory);
    await page.waitForTimeout(150);
    await shot('foundations_v1_save_loaded');
    const resaved = await ev(() => { window.__slime.save(3); return JSON.parse(window.localStorage.getItem('smfos.save.3')); });
    check('saving it again writes version 2 with words, stickers and scrap', resaved.version === 2 && Array.isArray(resaved.words) && Array.isArray(resaved.stickers) && resaved.scrap === 0, { version: resaved.version });

    // ---- 3. the seeded Chapter 2 start ---------------------------------------------------------------
    check('__slime.loadSave exists', (await ev(() => typeof window.__slime.loadSave)) === 'function');
    await ev((obj) => window.__slime.loadSave(obj), ch02);
    await waitFn(() => window.__slime.idle());
    const c = await ev(() => window.__slime.snapshot());
    check('the Chapter 2 start fixture loads: Lucky and Phoenix, level 7, the van keys, the itinerary, the cymbal, the invoice', c.scene === 'Explore' && c.party.map((m) => m.id).join() === 'lucky,phoenix' && c.party.every((m) => m.level === 7)
      && ['van_keys', 'tour_itinerary', 'tinny_ride_cymbal', 'pothole_invoice'].every((id) => c.inventory.some((e) => e.id === id)) && c.flags.ch1Complete === true && c.flags.luckyRageLocked === true, { party: c.party.map((m) => [m.id, m.level]), inventory: c.inventory.map((e) => e.id) });
    check('vars.quitResponse came with it (Chapter 2 reads it once)', [0, 1, 2].includes(c.vars.quitResponse), c.vars);

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
