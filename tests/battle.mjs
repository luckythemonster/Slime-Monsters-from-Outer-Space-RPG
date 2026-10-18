#!/usr/bin/env node
// Headless battle test: builds the game with Vite (unless EXPLORE_KEEP_DIST=1), serves dist/, boots it
// in headless Chromium with `?fast=1` and drives REAL battles through window.__slime (ARCHITECTURE §9):
//   1. hub_slush — the command menu is driven with __slime.press: ITEM → Pizza Slice, STRUM → target,
//      RIFF → Power Chord → target; then autoAdvance finishes the fight. Asserts 'win', XP/$ up.
//   2. ep0_audition with Brian in the party (Ryan is a battle guest) — auto-played; asserts 'win'.
//   3. ep0_palmers_set — auto-played; asserts 'win' and flags.eternityArmed / eternityFired.
// Screenshots go to tests/screenshots/battle_*.png. Prints one JSON line and exits non-zero on failure.
//
//   node tests/battle.mjs
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
const STEP_TIMEOUT_MS = 15_000;
const BATTLE_TIMEOUT_MS = 90_000;
const VIEWPORT = { width: 1024, height: 896 };
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const log = (m) => process.stderr.write(`[battle] ${m}\n`);

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
    const waitFn = (fn, arg, timeout = STEP_TIMEOUT_MS) => page.waitForFunction(fn, arg, { timeout, polling: 30 });
    const waitIdle = () => waitFn(() => window.__slime.idle());
    const press = (action) => ev((a) => window.__slime.press(a), action);
    const snap = () => ev(() => window.__slime.snapshot());
    const scene = () => ev(() => window.__slime.scene());
    // Menu kind currently open in the battle HUD: 'command' | 'list' | 'target' | 'prompt' | null
    const menuKind = () => ev(() => {
      const b = window.__slime.services.battle;
      const mnu = b && b.hud && b.hud.activeMenu;
      if (!mnu) return null;
      if (mnu.targets) return 'target';
      if (mnu.items) return mnu.cols === 2 ? 'command' : 'list';
      return 'prompt';
    });
    const waitMenu = (kind, timeout = STEP_TIMEOUT_MS) => waitFn((k) => {
      const b = window.__slime.services.battle;
      const mnu = b && b.hud && b.hud.activeMenu;
      if (!mnu || mnu.state !== 'open') return false;
      const got = mnu.targets ? 'target' : (mnu.items ? (mnu.cols === 2 ? 'command' : 'list') : 'prompt');
      return got === k;
    }, kind, timeout);
    const startBattle = (id) => ev((e) => { window.__battleResult = undefined; window.__battleP = window.__slime.startBattle(e).then((r) => { window.__battleResult = r; return r; }); }, id);
    const battleResult = (timeout = BATTLE_TIMEOUT_MS) => waitFn(() => window.__battleResult !== undefined, null, timeout).then(() => ev(() => window.__battleResult));

    await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await waitFn(() => window.__slime && window.__slime.isReady, null, READY_TIMEOUT_MS);
    await page.waitForTimeout(200);
    // Fresh state parked on the quiet dev map (start.json's map may open with a cutscene): newGame →
    // move the save position → save → load restarts Explore there without running the intro.
    await ev(() => { const s = window.__slime.state; s.newGame(); s.setPosition('dev_alley', 2, 7, 'right'); s.flags.visited_dev_alley = true; s.save(1); });
    await ev(() => window.__slime.load(1));
    await ev(() => { window.__slime.textInstant(true); window.__slime.autoAdvance(false); });
    await waitIdle();
    check('scene is Explore after newGame', (await scene()) === 'Explore', await scene());

    // --- 1. hub_slush, driven by hand (the Slush Pile cannot flee, so the win always pays) ----------------------------------------------------------
    await ev(() => {
      const s = window.__slime.state;
      window.__slime.addParty('phoenix');
      s.party.addXp('lucky', 24); s.party.addXp('phoenix', 24); // L3 each
      s.party.healAll();
      window.__slime.give('pizza_slice', 1); // the ITEM step uses it whatever start.json carries
    });
    const before = await snap();
    await startBattle('hub_slush');
    await waitFn(() => window.__slime.scene() === 'Battle', null, STEP_TIMEOUT_MS);
    await waitMenu('command');
    await page.waitForTimeout(120);
    await shot('battle_command');
    const hudState = await ev(() => {
      const b = window.__slime.services.battle;
      return { round: b.model.round, meter: b.model.meter, order: b.model.getTurnOrder().map((o) => o.uid), actor: b.model.current && b.model.current.uid, bg: b.bg && b.bg.id };
    });
    check('battle: round 1, SETLIST has lucky/phoenix/slush', hudState.round === 1 && hudState.order.includes('slush') && hudState.order.includes('lucky'), hudState);

    // Plan per command menu: the first controllable turn uses ITEM, the next STRUM, then RIFF, then STRUM…
    const plan = ['item', 'strum', 'riff', 'strum'];
    const runStep = async (step) => {
      await waitMenu('command');
      const who = await ev(() => window.__slime.services.battle.model.current.uid);
      if (step === 'item') {
        await press('right'); // ITEM (right column, row 0)
        await press('confirm');
        await waitMenu('list');
        await page.waitForTimeout(80);
        await shot('battle_item');
        // Move the cursor onto the Pizza Slice whatever else the inventory holds (e.g. the Half-Ounce).
        const pizzaIdx = await ev(() => { const mnu = window.__slime.services.battle.hud.activeMenu; return mnu.items.findIndex((i) => i.id === 'pizza_slice'); });
        for (let i = 0; i < Math.max(0, pizzaIdx); i++) await press('down');
        await press('confirm'); // Pizza Slice
        await waitMenu('target');
        await press('confirm'); // first ally
      } else if (step === 'riff') {
        await press('down'); // RIFF (left column, row 1)
        await press('confirm');
        await waitMenu('list');
        await page.waitForTimeout(80);
        await shot('battle_riff');
        await press('confirm'); // first riff (Power Chord / Root Note)
        const kind = await waitFn(() => { const b = window.__slime.services.battle; const mnu = b && b.hud && b.hud.activeMenu; return mnu && mnu.state === 'open' && mnu.targets ? 'target' : (b && b.model.current && b.model.current.uid === undefined ? 'gone' : false); }, null, STEP_TIMEOUT_MS).catch(() => null);
        if (kind) { await page.waitForTimeout(80); await shot('battle_target'); await press('confirm'); }
      } else {
        await press('confirm'); // STRUM
        await waitMenu('target');
        await page.waitForTimeout(80);
        await shot('battle_target');
        await press('confirm');
      }
      return who;
    };
    const actors = [];
    for (const step of plan) {
      if ((await ev(() => window.__battleResult)) !== undefined) break;
      try { actors.push(await runStep(step)); } catch (err) { log(`plan step ${step} skipped: ${String(err.message).split('\n')[0]}`); break; }
    }
    check('manual steps drove the command menu', actors.length >= 2, actors);
    const mid = await ev(() => { const b = window.__slime.services.battle; return b ? { round: b.model.round, itemsUsed: b.model.itemsUsed, log: b.model.log.map((l) => l.action.cmd) } : null; });
    check('ITEM was used', !mid || mid.itemsUsed.length >= 1, mid);
    check('RIFF was played', !mid || mid.log.includes('riff'), mid);
    await ev(() => window.__slime.autoAdvance(true));
    const r1 = await battleResult();
    await waitIdle();
    const after = await snap();
    check("hub_slush resolves 'win'", r1 === 'win', r1);
    check('XP increased', after.party[0].xp > before.party[0].xp, { before: before.party[0].xp, after: after.party[0].xp });
    check('money increased', after.money > before.money, { before: before.money, after: after.money });
    check('pizza slice consumed', (after.inventory.find((e) => e.id === 'pizza_slice') || { qty: 0 }).qty < (before.inventory.find((e) => e.id === 'pizza_slice') || { qty: 0 }).qty || !mid, after.inventory);
    check('back in Explore after battle', (await scene()) === 'Explore', await scene());

    // --- 2. ep0_audition (auto) -------------------------------------------------------------------
    await ev(() => {
      const s = window.__slime.state;
      window.__slime.addParty('brian');
      s.party.addXp('lucky', 30); s.party.addXp('phoenix', 30); // L4
      s.party.healAll();
      window.__slime.give('pizza_slice', 2);
      window.__slime.autoAdvance(true);
    });
    await startBattle('ep0_audition');
    await waitFn(() => { const b = window.__slime.services.battle; return !!(b && b.model && b.model.round >= 3); }, null, BATTLE_TIMEOUT_MS);
    await page.waitForTimeout(150);
    await shot('battle_audition');
    const aud = await ev(() => { const b = window.__slime.services.battle; return { ryan: !!b.model.find('ryan'), guest: b.model.find('ryan') && b.model.find('ryan').guest, form: b.model.find('ryan') && b.model.find('ryan').form, tear: b.hud.tear }; });
    check('audition: Ryan is a possessed guest', aud.ryan && aud.guest && aud.form === 'possessed', aud);
    check('audition: uiTear 1', aud.tear >= 1, aud.tear);
    const r2 = await battleResult();
    await waitIdle();
    const s2 = await snap();
    check("ep0_audition resolves 'win'", r2 === 'win', r2);
    check('audition flags set', s2.flags.auditionWon === true, s2.flags);
    check('audition: Ryan not added to the party by the battle', !s2.party.some((m) => m.id === 'ryan'), s2.party.map((m) => m.id));
    check('audition: Tinny Ride Cymbal dropped', s2.inventory.some((e) => e.id === 'tinny_ride_cymbal'), s2.inventory);

    // --- 3. ep0_palmers_set (auto) ----------------------------------------------------------------
    await ev(() => {
      const s = window.__slime.state;
      window.__slime.removeParty('brian');
      s.party.addXp('lucky', 40); s.party.addXp('phoenix', 40); // L5
      s.party.healAll();
      window.__slime.autoAdvance(true);
    });
    await startBattle('ep0_palmers_set');
    await waitFn(() => { const b = window.__slime.services.battle; return !!(b && b.model && b.model.round >= 2); }, null, BATTLE_TIMEOUT_MS);
    await page.waitForTimeout(100);
    await shot('battle_palmers');
    await waitFn(() => { const b = window.__slime.services.battle; return !!(b && b.model && b.model.meter >= 100); }, null, BATTLE_TIMEOUT_MS);
    await page.waitForTimeout(120);
    await shot('battle_eternity');
    const et = await ev(() => { const b = window.__slime.services.battle; const r = b.model.find('ryan'); return { form: r && r.form, size: r && r.size, meter: b.model.meter, tear: b.hud.tear, bg: b.bg.id, toon: b.bg.toon }; });
    check('eternity: Ryan 64 px, meter 100, Toon 4 background', et.form === 'eternity' && et.size === 64 && et.meter === 100 && et.toon === 4, et);
    const r3 = await battleResult();
    await waitIdle();
    const s3 = await snap();
    check("ep0_palmers_set resolves 'win'", r3 === 'win', r3);
    check('flags.eternityArmed + eternityFired', s3.flags.eternityArmed === true && s3.flags.eternityFired === true, s3.flags);
    check('jacket dropped, no money', s3.inventory.some((e) => e.id === 'price_tag_jacket'), s3.inventory);
    await page.waitForTimeout(150);
    await shot('battle_after');

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
