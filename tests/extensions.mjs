#!/usr/bin/env node
// Engine/UI extension test (DESIGN.md E6–E23): builds the game with Vite (unless EXPLORE_KEEP_DIST=1),
// serves dist/ (or EXT_DIST), boots it headless with `?fast=1` and drives the dev fixtures
// (src/data/maps/dev_ext.json + src/data/scripts/dev.json) through window.__slime:
//   {var:} markup, set-expressions, tape/flyer captions, the insert window, Dad's FF window + collapse,
//   Ryan's shaking caption, camera bend/tear/mosaic, autosave + the clipboard save prompt (saveCount),
//   followers trailing, a 64×24 object sliding, footprints, onEnter arrays, the night overlay,
//   shop BUY and SELL, the C/M/F keys and the Freefall scene end to end.
// Screenshots go to tests/screenshots/ext_*.png. Prints one JSON line and exits non-zero on failure.
//
//   node tests/extensions.mjs
//
// Environment knobs: PLAYWRIGHT_MODULE, SMOKE_CHROME (as tests/smoke.mjs), EXPLORE_KEEP_DIST=1 to
// reuse dist/, EXT_DIST=<dir> to serve another build directory.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = process.env.EXT_DIST ? path.resolve(process.env.EXT_DIST) : path.join(ROOT, 'dist');
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

const log = (m) => process.stderr.write(`[ext] ${m}\n`);

// ---- build / serve / browser (same recipe as tests/explore.mjs) --------------------------------

function build() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) throw new Error(`vite not installed at ${viteBin}`);
  log('running vite build');
  const args = [viteBin, 'build'];
  if (process.env.EXT_DIST) args.push('--outDir', DIST, '--emptyOutDir');
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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
    log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  };

  if (process.env.EXPLORE_KEEP_DIST === '1' && existsSync(path.join(DIST, 'index.html'))) log(`EXPLORE_KEEP_DIST=1, reusing ${DIST}`);
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
    const top = () => ev(() => window.__slime.services.ui.debugState().top);
    const waitTop = (pred, timeout) => waitFn(({ src }) => { const t = window.__slime.services.ui.debugState().top; return t && new Function('t', `return (${src})(t)`)(t); }, { src: pred.toString() }, timeout);
    const sleep = (ms) => page.waitForTimeout(ms);
    const runScript = (id) => ev((s) => { window.__slime._last = window.__slime.runScript(s); return true; }, id);
    const waitScript = () => ev(() => window.__slime._last);
    const warp = (map, x, y, facing) => ev(({ map, x, y, facing }) => window.__slime.warp(map, x, y, facing), { map, x, y, facing });
    const key = async (code) => {
      await ev((c) => window.__slime.services.input.dispatch('keydown', c), code);
      await ev(() => window.__slime.steps(2));
      await ev((c) => window.__slime.services.input.dispatch('keyup', c), code);
      await ev(() => window.__slime.steps(1));
    };

    await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await waitFn(() => window.__slime && window.__slime.isReady, null, READY_TIMEOUT_MS);
    await sleep(200);
    check('title scene up', (await scene()) === 'Title', await scene());

    await ev(() => window.__slime.newGame());
    await ev(() => { window.__slime.textInstant(true); window.__slime.autoAdvance(true); });
    await waitIdle();
    await warp('dev_ext', 3, 6, 'right');
    await waitIdle();
    const s0 = await snap();
    check('warped to dev_ext', s0.map === 'dev_ext' && s0.x === 3 && s0.y === 6, { map: s0.map, x: s0.x, y: s0.y });

    // --- E16 onEnter arrays ---------------------------------------------------------------------
    check('onEnter array: once-entry ran', s0.vars.extEnters === 1, s0.vars);
    check('onEnter array: conditional entry skipped', s0.flags.nightEnterRan === undefined, s0.flags);
    await warp('dev_ext', 3, 6, 'right');
    await waitIdle();
    check('onEnter array: once-entry did not rerun', (await snap()).vars.extEnters === 1, (await snap()).vars);

    // --- E8 caption cards (direct calls so they hold long enough to look at) -----------------------
    await ev(() => { window.__slime.autoAdvance(false); window.__slime.textInstant(false); });
    await ev(() => { window.__slime._cap = window.__slime.services.ui.caption('ONE MONTH LATER', 900, { style: 'tape' }); });
    await waitTop((t) => t.type === 'caption' && t.style === 'tape' && t.card);
    await sleep(250);
    let t = await top();
    check('tape caption: off-centre card with two tape strips', t.card && t.card.x === 30 && t.card.y === 92 && t.tapes === 2, t);
    await shot('ext_caption_tape');
    await ev(() => window.__slime._cap);
    await ev(() => { window.__slime._cap = window.__slime.services.ui.caption('NEXT: THE POTATO BELT', 900, { style: 'flyer' }); });
    await waitTop((t) => t.type === 'caption' && t.style === 'flyer' && t.card);
    await sleep(250);
    t = await top();
    check('flyer caption: centred card, no tape', t.card && Math.abs(t.card.x + t.card.w / 2 - 128) <= 1 && t.tapes === 0, t);
    await shot('ext_caption_flyer');
    await ev(() => window.__slime._cap);
    await ev(() => window.__slime.textInstant(true));

    // --- E6/E7/E9/E10/E11 text & windows -------------------------------------------------------------
    await runScript('dev_ext_text');
    await waitTop((t) => t.type === 'say' && t.who === 'narrator');
    t = await top();
    check('{var:} substituted before wrapping', /7-page/.test(t.text) && /\$4\./.test(t.text), t.text);
    await press('confirm');
    // the script's own tape + flyer captions flash by (100 ms each under ?fast=1), then the insert
    await waitTop((t) => t.type === 'say' && /GIG TONIGHT/.test(t.text) && t.state === 'complete', 8000);
    await sleep(80);
    const kinds = await ev(() => window.__slime.services.ui.debugState().kinds);
    check('insert window open with its narrator line', kinds.includes('insert'), kinds);
    await shot('ext_insert');
    await ev(() => window.__slime.textInstant(false)); // Dad types slowly so the window can be seen
    await press('confirm');
    await waitTop((t) => t.type === 'say' && t.style === 'ff');
    await sleep(900);
    t = await top();
    check('dad: FF window with the VANGUARD INTERCOM tag, collapse armed', t.style === 'ff' && t.name === 'VANGUARD INTERCOM' && t.collapse === true, t);
    await shot('ext_dad_window');
    await press('confirm'); // finish typing → the window collapses by itself (no confirm needed)
    await ev(() => window.__slime.textInstant(true));
    await waitTop((t) => t.type === 'say' && t.style === 'caption', 8000);
    await sleep(120);
    t = await top();
    check('ryan_caption: square box, instant, shaking', t.style === 'caption' && t.shake === true && t.state === 'complete' && t.box.x === 8 && t.box.w === 128, t);
    await shot('ext_ryan_caption');
    for (let i = 0; i < 6 && !(await ev(() => window.__slime.idle())); i++) { await press('confirm'); await sleep(120); }
    await waitScript();
    await waitIdle();
    const s1 = await snap();
    check('text script finished', s1.flags.extTextDone === true, s1.flags);
    check('set-expression: vars.contractPages = 3 + vars.saveCount', s1.vars.contractPages === 7, s1.vars);
    check('set keeps plain strings', s1.vars.plain === 'DRUMMER WANTED - NO COPS' && s1.vars.sum === 5, s1.vars);
    await ev(() => window.__slime.autoAdvance(true));

    // --- E12 camera effects --------------------------------------------------------------------
    await runScript('dev_ext_camera');
    await waitScript();
    await waitIdle();
    check('camera shake/bend/tear/mosaic ran without errors', (await snap()).flags.extCameraDone === true);
    await ev(() => { window.__slime._fx = window.__slime.explore().bend(240); });
    await waitFn(() => window.__slime.explore().fx.objects.length > 0);
    await sleep(350);
    const strips = await ev(() => window.__slime.explore().fx.objects.length);
    check('bend: 28 snapshot strips on screen', strips === 28, strips);
    await shot('ext_bend');
    await ev(() => window.__slime._fx);
    await ev(() => { window.__slime._fx = window.__slime.explore().tear(6, 120); });
    await waitFn(() => window.__slime.explore().fx.objects.length > 0);
    await sleep(120);
    await shot('ext_tear');
    await ev(() => window.__slime._fx);
    check('fx objects cleaned up', (await ev(() => window.__slime.explore().fx.objects.length)) === 0);

    // --- E15 large objects + E13 autosave ---------------------------------------------------------
    const crash0 = (await snap()).entities.find((e) => e.id === 'crash');
    check('64x24 object spans 4 tiles', crash0 && crash0.w === 4 && crash0.footprint[0] === 4 && crash0.x === 6, crash0);
    await runScript('dev_ext_objects');
    await waitScript();
    await waitIdle();
    const s2 = await snap();
    const crash1 = s2.entities.find((e) => e.id === 'crash');
    check('CRASH slid RRR to x 9', crash1 && crash1.x === 9 && crash1.y === 10, crash1);
    check('spawned 24x24 object moved and despawned', !s2.entities.some((e) => e.id === 'g') && s2.flags.extObjectsDone === true, s2.entities.map((e) => e.id));
    const auto = await ev(() => ({ has: window.__slime.state.hasSave(1), peek: window.__slime.state.peekSave(1) }));
    check('autosave wrote slot 1 silently (no saveCount bump)', auto.has && auto.peek && auto.peek.map === 'dev_ext' && s2.vars.saveCount === 4, { auto, saveCount: s2.vars.saveCount });

    // --- waited anim right after a scripted move (the deferred idle must not clobber it) ------------
    await runScript('dev_ext_anim_after_move');
    let animDone = false;
    try { await waitFn(() => window.__slime.snapshot().flags.extAnimDone === true, null, 6000); animDone = true; } catch { /* the script hung */ }
    check('waited anim right after a scripted move completes', animDone);
    if (!animDone) throw new Error('dev_ext_anim_after_move hung: the deferred idle clobbered the waited anim');
    await waitScript();
    await waitIdle();
    await warp('dev_ext', 13, 4, 'right');
    await waitIdle();
    await press('right');
    const blocked = await snap();
    check('2x2 footprint blocks the player', blocked.x === 13 && blocked.y === 4 && blocked.facing === 'right', { x: blocked.x, y: blocked.y });

    // --- E13 clipboard save prompt --------------------------------------------------------------
    await warp('dev_ext', 3, 4, 'up');
    await waitIdle();
    await ev(() => { window.__slime.state.party.members[0].amp = 1; window.__slime.autoAdvance(false); });
    await press('confirm'); // Bajonka
    await waitTop((t) => t.type === 'say');
    await press('confirm');
    await waitTop((t) => t.type === 'menu');
    t = await top();
    check('save prompt uses the entity prompt and lists 3 pages + decline', t.labels[0] === 'INITIAL HERE TO TEST' && t.labels.length === 5 && /^PAGE 1/.test(t.labels[1]) && t.labels[4] === 'DECLINE', t.labels);
    await shot('ext_save_prompt');
    await press('confirm'); // PAGE 1
    await waitIdle();
    const s3 = await snap();
    check('manual save bumps vars.saveCount and restores AMP', s3.vars.saveCount === 5 && s3.party[0].amp > 1, { saveCount: s3.vars.saveCount, amp: s3.party[0].amp });
    await ev(() => window.__slime.autoAdvance(true));

    // --- E14 followers ---------------------------------------------------------------------------
    await warp('dev_ext', 3, 8, 'right');
    await waitIdle();
    await ev(() => window.__slime.addParty('phoenix'));
    for (let i = 0; i < 3; i++) await press('right');
    await sleep(150);
    const s4 = await snap();
    const f0 = s4.followers[0];
    check('phoenix trails one tile behind the leader', f0 && f0.id === 'phoenix' && f0.visible && f0.x === s4.x - 1 && f0.y === s4.y, { player: [s4.x, s4.y], follower: f0 });
    check('follower is addressable as an entity', s4.entities.some((e) => e.id === 'phoenix' && e.type === 'follower'), s4.entities.map((e) => `${e.id}:${e.type}`));
    await shot('ext_followers');
    await runScript('dev_ext_cut');
    await waitFn(() => { const s = window.__slime.snapshot(); return s.followers[0] && s.followers[0].shadowed === true; }, null, 4000);
    const mid = await snap();
    check('script spawn of a party member hides the follower', mid.followers[0].visible === false && mid.entities.some((e) => e.id === 'phoenix' && e.type === 'npc'), mid.followers);
    await waitScript();
    await waitIdle();
    const s5 = await snap();
    check('follower re-shown after the cutscene', s5.flags.extCutDone === true && s5.followers[0].visible === true && s5.followers[0].shadowed === false, s5.followers);
    await ev(() => window.__slime.removeParty('phoenix'));
    check('follower removed with the party member', (await snap()).followers.length === 0);

    // --- E17 night overlay ----------------------------------------------------------------------
    check('overlay off by default', (await snap()).overlay === false);
    await ev(() => window.__slime.setFlag('night', true));
    await sleep(100);
    const night = await snap();
    check('overlay + lights on when the condition holds', night.overlay === true && night.lights === 2, { overlay: night.overlay, lights: night.lights });
    await shot('ext_night');
    await warp('dev_ext', 3, 6, 'right');
    await waitIdle();
    check('onEnter array: conditional entry ran at night', (await snap()).flags.nightEnterRan === true);
    await ev(() => window.__slime.setFlag('night', false));
    await sleep(60);
    check('overlay off again', (await snap()).overlay === false);

    // --- E19 shops -------------------------------------------------------------------------------
    await ev(() => { window.__slime.setMoney(10); window.__slime.autoAdvance(false); });
    await warp('dev_ext', 10, 4, 'up');
    await waitIdle();
    await press('confirm'); // barista
    await waitTop((t) => t.type === 'say');
    await press('confirm');
    await waitTop((t) => t.type === 'menu' && t.labels[0] === 'BUY');
    t = await top();
    check('cafe shop: BUY / LEAVE (cafe does not buy)', t.labels.join(',') === 'BUY,LEAVE', t.labels);
    await press('confirm');
    await waitTop((t) => t.type === 'menu' && /Pizza Slice/.test(t.labels[0]));
    await sleep(80);
    await shot('ext_shop');
    await press('confirm');
    await waitTop((t) => t.type === 'menu' && /^x1/.test(t.labels[0]));
    await press('down'); // x2
    await press('confirm');
    await waitTop((t) => t.type === 'menu' && /Pizza Slice/.test(t.labels[0]));
    const bought = await snap();
    check('bought 2 pizza slices for $6', bought.money === 4 && (bought.inventory.find((e) => e.id === 'pizza_slice') || {}).qty === 2, { money: bought.money, inv: bought.inventory });
    check('status window shows the money', (await ev(() => window.__slime.services.ui.debugState().status)) === '$4');
    await press('cancel');
    await waitTop((t) => t.type === 'menu' && t.labels[0] === 'BUY');
    await press('cancel');
    await waitIdle();
    check('status window gone after leaving', (await ev(() => window.__slime.services.ui.debugState().status)) === null);
    await warp('dev_ext', 15, 8, 'right');
    await waitIdle();
    await press('confirm'); // pawn
    await waitTop((t) => t.type === 'say');
    await press('confirm');
    await waitTop((t) => t.type === 'menu' && t.labels[0] === 'BUY');
    await press('down');
    await press('confirm'); // SELL
    await waitTop((t) => t.type === 'menu' && /Half-Ounce/.test(t.labels.join(',')));
    t = await top();
    const halfIdx = t.labels.findIndex((l) => /Half-Ounce/.test(l));
    check('pawn lists the half-ounce at $20', halfIdx >= 0 && /\$20/.test(t.labels[halfIdx]), t.labels);
    for (let i = 0; i < halfIdx; i++) await press('down');
    await press('confirm');
    await waitTop((t) => t.type === 'menu' && /^x1/.test(t.labels[0]));
    await press('confirm');
    await waitTop((t) => t.type === 'menu' && /Half-Ounce x3|Pizza/.test(t.labels.join(',')));
    const sold = await snap();
    check('sold one half-ounce for $20', sold.money === 24 && (sold.inventory.find((e) => e.id === 'half_ounce') || {}).qty === 3, { money: sold.money, inv: sold.inventory });
    await press('cancel');
    await waitTop((t) => t.type === 'menu' && t.labels[0] === 'BUY');
    await press('cancel');
    await waitIdle();

    // --- E23 keys: C menu, M mute, F fullscreen ----------------------------------------------------
    await key('KeyC');
    await waitFn(() => window.__slime.scene() === 'Menu');
    check('KeyC opens the pause menu', (await scene()) === 'Menu');
    await press('cancel');
    await waitFn(() => window.__slime.scene() === 'Explore');
    await waitIdle();
    const muted0 = await ev(() => window.__slime.muted);
    await key('KeyM');
    const muted1 = await ev(() => window.__slime.muted);
    await key('KeyM');
    const muted2 = await ev(() => window.__slime.muted);
    check('KeyM toggles mute', muted1 === !muted0 && muted2 === muted0, { muted0, muted1, muted2 });
    await key('KeyF');
    const fs = await ev(() => window.__slime.services.input.toggles.fullscreen);
    check('KeyF requests fullscreen without errors', fs === 1, fs);
    await ev(() => window.__slime.autoAdvance(true));

    // --- E22 freefall --------------------------------------------------------------------------------
    await runScript('dev_freefall');
    await waitFn(() => window.__slime.scene() === 'Freefall');
    await ev(() => window.__slime.hold('left', 300));
    await sleep(700);
    check('freefall scene running', (await scene()) === 'Freefall');
    await shot('ext_freefall');
    await waitScript();
    await waitIdle();
    const s6 = await snap();
    check('freefall ended back in Explore with vars.billboardsTagged set', s6.scene === 'Explore' && s6.flags.freefallDone === true && Number.isInteger(s6.vars.billboardsTagged), { tagged: s6.vars.billboardsTagged, flags: s6.flags.freefallDone });

    // --- teleport fade:false ---------------------------------------------------------------------------
    await runScript('dev_ext_teleport');
    await waitScript();
    await waitIdle();
    const s7 = await snap();
    check('teleport fade:false lands on the tile', s7.flags.extTeleported === true && s7.x === 5 && s7.y === 7, { x: s7.x, y: s7.y });

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
