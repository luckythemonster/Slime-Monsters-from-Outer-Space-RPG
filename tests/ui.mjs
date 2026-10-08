#!/usr/bin/env node
// UI layer test: starts the Vite dev server, opens tests/ui-harness.html in headless Chromium and
// drives UIScene with REAL key events (Playwright page.keyboard), asserting the section 12.2
// Promise semantics. Screenshots of every state go to tests/screenshots/ui_*.png.
//
//   node tests/ui.mjs
//
// Env knobs: PLAYWRIGHT_MODULE, SMOKE_CHROME (see tests/smoke.mjs), UI_PORT (default 5174).

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREENSHOT_DIR = path.join(ROOT, 'tests', 'screenshots');
const PORT = Number(process.env.UI_PORT || 5174);
const HOST = '127.0.0.1';
const MANIFEST = path.join(ROOT, 'assets', 'generated', 'manifest.json');
const UI_PNG = path.join(ROOT, 'assets', 'generated', 'ui.png');
const VIEWPORT = { width: 1024, height: 896 }; // 4x the 256x224 canvas
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const READY_TIMEOUT_MS = 30_000;

const log = (m) => process.stderr.write(`[ui] ${m}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Vite dev server
// ---------------------------------------------------------------------------------------------

async function startVite() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) throw new Error(`vite not installed at ${viteBin}`);
  const child = spawn(process.execPath, [viteBin, '--port', String(PORT), '--strictPort', '--host', HOST, '--clearScreen', 'false'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const url = `http://${HOST}:${PORT}/tests/ui-harness.html`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`vite exited early (${child.exitCode}):\n${output}`);
    try {
      const res = await fetch(url);
      if (res.ok) {
        const html = await res.text();
        if (html.includes('ui-harness.js')) return { child, url };
      }
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error(`vite did not serve ${url} within 20s:\n${output}`);
}

function stopVite(child) {
  if (!child || child.exitCode !== null) return;
  try { child.kill('SIGTERM'); } catch { /* ignore */ }
  setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } }, 1500).unref();
}

// ---------------------------------------------------------------------------------------------
// Playwright (same recipe as tests/smoke.mjs)
// ---------------------------------------------------------------------------------------------

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean);
  const tried = [];
  for (const c of candidates) {
    try {
      const pw = require(c);
      if (pw && pw.chromium) return { pw, module: c };
      tried.push(`${c}: no chromium export`);
    } catch (err) {
      if (err && err.code !== 'MODULE_NOT_FOUND') throw err;
      tried.push(`${c}: not found`);
    }
  }
  const g = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' });
  if (g.status === 0) {
    const c = path.join(g.stdout.trim(), 'playwright');
    try {
      const pw = require(c);
      if (pw && pw.chromium) return { pw, module: c };
    } catch { /* ignore */ }
  }
  throw new Error(`playwright not found. Tried:\n  ${tried.join('\n  ')}`);
}

function findChromeExecutable() {
  if (process.env.SMOKE_CHROME) return process.env.SMOKE_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(base)) {
    const revs = readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const dir of revs) {
      const c = path.join(base, dir, 'chrome-linux', 'chrome');
      if (existsSync(c)) return c;
    }
  }
  return null;
}

async function launchChromium(chromium) {
  const attempts = [{ headless: true, args: LAUNCH_ARGS }];
  const explicit = findChromeExecutable();
  if (explicit) attempts.push({ headless: true, args: LAUNCH_ARGS, executablePath: explicit });
  const failures = [];
  for (const options of attempts) {
    const label = options.executablePath ?? 'playwright default';
    try {
      log(`launching chromium (${label})`);
      return { browser: await chromium.launch(options), executablePath: label };
    } catch (err) {
      failures.push(`${label}: ${String(err && err.message ? err.message : err).split('\n')[0]}`);
    }
  }
  throw new Error(`could not launch chromium:\n  ${failures.join('\n  ')}`);
}

// ---------------------------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------------------------

class Tester {
  constructor(page, errors) {
    this.page = page;
    this.errors = errors;
    this.results = [];
    this.shots = [];
  }

  check(name, ok, detail = '') {
    this.results.push({ name, ok: !!ok, detail });
    log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
    return !!ok;
  }

  async shot(name) {
    const file = path.join(SCREENSHOT_DIR, `ui_${name}.png`);
    await this.page.screenshot({ path: file });
    this.shots.push(path.relative(ROOT, file));
  }

  start(method, ...args) {
    return this.page.evaluate(({ method, args }) => { window.__uih.start(method, ...args); }, { method, args });
  }

  pending() {
    return this.page.evaluate(() => {
      const p = window.__uih.pending;
      return p ? { method: p.method, done: p.done, value: p.value, error: p.error, ms: p.t1 - p.t0 } : null;
    });
  }

  state() {
    return this.page.evaluate(() => window.__uih.state());
  }

  async waitDone(timeout = 5000) {
    await this.page.waitForFunction(() => window.__uih.pending && window.__uih.pending.done, null, { timeout, polling: 20 });
    return this.pending();
  }

  async waitTop(pred, timeout = 5000) {
    await this.page.waitForFunction(pred, null, { timeout, polling: 20 });
  }

  async key(k, settle = 80) {
    await this.page.keyboard.press(k);
    await sleep(settle);
  }

  /** Press confirm (spaced out) until the pending call resolves; returns presses used. */
  async confirmUntilDone(max = 8, settle = 150) {
    for (let i = 1; i <= max; i++) {
      await this.key('z', settle);
      const p = await this.pending();
      if (p && p.done) return i;
    }
    return -1;
  }
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const errors = [];
  const report = { ok: false, atlas: null, renderer: null, phaser: null, fontLoaded: null, tests: [], screenshots: [], errors };
  const fallback = !(existsSync(MANIFEST) && existsSync(UI_PNG));
  if (fallback) log('assets/generated/manifest.json or ui.png missing: harness will use its fallback atlas');

  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const { pw, module } = loadPlaywright();
  const vite = await startVite();
  log(`vite serving ${vite.url}`);
  let browser = null;
  try {
    const launched = await launchChromium(pw.chromium);
    browser = launched.browser;
    report.playwright = { module, executablePath: launched.executablePath, browserVersion: browser.version() };
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err && err.message ? err.message : String(err)}`));
    page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`));
    page.on('response', (res) => { if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`); });

    await page.goto(`${vite.url}${fallback ? '?fallback=1' : ''}`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__uih && globalThis.__uih.ready === true, null, { timeout: READY_TIMEOUT_MS, polling: 100 });
    const info = await page.evaluate(() => ({ atlas: __uih.atlas, renderer: __uih.renderer, phaser: __uih.phaser, fontLoaded: __uih.fontLoaded }));
    Object.assign(report, info);
    if (info.fontLoaded === false) errors.push('pixel font "Press Start 2P" did not load');
    await sleep(300);
    const t = new Tester(page, errors);
    await t.shot('00_idle');

    // ---- 1. pagination: 90 chars -> 2 pages -> resolves after 2 confirms (instant text) ----
    const text90 = 'The quick brown fox jumps over the lazy dog while the slime from outer space watches on.'; // 88 + 2
    const t90 = text90 + ' ok';
    await page.evaluate(() => __uih.ui.setTextInstant(true));
    await t.start('say', { who: 'bartender', name: 'BARTENDER', text: t90 });
    await t.waitTop(() => __uih.state().top && __uih.state().top.state === 'complete');
    let st = await t.state();
    t.check('say(90 chars) paginates into 2 pages', st.top.pages === 2, `pages=${st.top.pages} cols=${st.top.cols}`);
    t.check('isBusy() true while say is open', st.busy === true);
    await t.shot('01_say_page1_instant');
    await t.key('z', 120);
    let p = await t.pending();
    st = await t.state();
    t.check('after 1 confirm: not resolved, on page 2', !p.done && st.top && st.top.page === 1, `done=${p.done} page=${st.top && st.top.page}`);
    await t.key('z', 200);
    p = await t.waitDone();
    t.check('after 2 confirms: say resolved', p.done && !p.error, p.error || '');
    await page.evaluate(() => __uih.ui.setTextInstant(false));

    // ---- 2. typewriter: confirm during typing completes the page, second confirm closes ----
    const typed = 'Typing test: {color:pink}pink words{/color} and {shake}shaky words{/shake} here.';
    await t.start('say', { who: 'phoenix', text: typed });
    await t.waitTop(() => __uih.state().top && __uih.state().top.state === 'typing');
    await sleep(350);
    st = await t.state();
    t.check('typewriter is mid-page after 350 ms', st.top.state === 'typing' && st.top.revealed > 0 && st.top.revealed < st.top.total, `revealed=${st.top.revealed}/${st.top.total}`);
    t.check('name tag defaults to uppercased id', st.top.name === 'PHOENIX', st.top.name);
    await t.shot('02_say_typing');
    await t.key('z', 120);
    st = await t.state();
    p = await t.pending();
    t.check('confirm while typing completes the page', st.top && st.top.state === 'complete' && st.top.revealed === st.top.total && !p.done, `state=${st.top && st.top.state} revealed=${st.top && st.top.revealed}`);
    await t.shot('03_say_complete');
    await t.key('x', 120);
    p = await t.pending();
    t.check('cancel does nothing in dialogue', !p.done);
    await t.key('z', 250);
    p = await t.waitDone();
    t.check('confirm on complete single page resolves', p.done && !p.error);

    // ---- 3. portrait, ryan_caption, narrator ----
    await t.start('say', { who: 'lucky', portrait: 'lucky', text: 'With a portrait the text column is only twenty-three characters wide, so it wraps sooner.' });
    await t.waitTop(() => __uih.state().top && (__uih.state().top.state === 'typing' || __uih.state().top.state === 'complete'));
    st = await t.state();
    t.check('portrait present -> 23 columns', st.top.portrait === 'lucky' && st.top.cols === 23, `portrait=${st.top.portrait} cols=${st.top.cols}`);
    await t.key('z', 150);
    await t.shot('04_say_portrait');
    const presses = await t.confirmUntilDone();
    p = await t.pending();
    t.check('portrait say resolved after 2 pages (3 more confirms)', p.done && !p.error && presses === 3, `presses=${presses}`);

    await t.start('say', { who: 'ryan_caption', text: "Note to self: the amp is not supposed to smell like that." });
    await t.waitTop(() => __uih.state().top && __uih.state().top.state === 'typing');
    await t.key('z', 150);
    st = await t.state();
    t.check('ryan_caption uses caption style, no tag', st.top.style === 'caption' && st.top.name === '');
    await t.shot('05_say_ryan_caption');
    await t.key('z', 250);
    p = await t.waitDone();
    t.check('ryan_caption resolved', p.done && !p.error);

    await t.start('say', { who: 'narrator', text: 'Snow fell on the West Bank.\nNobody noticed the crater.' });
    await t.waitTop(() => __uih.state().top && __uih.state().top.state === 'typing');
    await t.key('z', 150);
    st = await t.state();
    t.check('narrator has no tag', st.top.style === 'window' && st.top.name === '');
    await t.shot('06_say_narrator');
    await t.key('z', 250);
    p = await t.waitDone();
    t.check('narrator resolved', p.done && !p.error);

    // ---- 4. choice ----
    await t.start('choice', ['Yes', 'No', 'Maybe'], { cancelIndex: 1 });
    await t.waitTop(() => __uih.state().top && __uih.state().top.state === 'open');
    await t.key('ArrowDown');
    await t.key('ArrowDown');
    st = await t.state();
    t.check('choice cursor moved to index 2', st.top.selected === 2, `selected=${st.top.selected}`);
    await t.shot('07_choice');
    await t.key('ArrowDown');
    st = await t.state();
    t.check('choice wraps to index 0', st.top.selected === 0, `selected=${st.top.selected}`);
    await t.key('ArrowUp');
    await t.key('z', 250);
    p = await t.waitDone();
    t.check('choice resolves navigated index (2)', p.done && p.value === 2, `value=${p.value}`);

    await t.start('choice', ['Yes', 'No'], { cancelIndex: 1 });
    await t.waitTop(() => __uih.state().top && __uih.state().top.state === 'open');
    await t.key('Escape', 250);
    p = await t.waitDone();
    t.check('choice cancel resolves cancelIndex (1)', p.done && p.value === 1, `value=${p.value}`);

    // ---- 5. menu with disabled item + hints ----
    const items = [
      { label: 'Attack', hint: 'Hit them with the guitar' },
      { label: 'Riff', disabled: true, hint: 'Not enough meter' },
      { label: 'Item', hint: 'Use a thing' },
      { label: 'Run', hint: 'Flee like a coward' },
    ];
    await t.start('menu', items, {});
    await t.waitTop(() => __uih.state().top && __uih.state().top.state === 'open');
    await t.key('s');
    st = await t.state();
    t.check('menu skips disabled item (0 -> 2)', st.top.selected === 2, `selected=${st.top.selected}`);
    await t.shot('08_menu_disabled');
    await t.key('ArrowUp');
    st = await t.state();
    t.check('menu skips disabled going up (2 -> 0)', st.top.selected === 0, `selected=${st.top.selected}`);
    await t.key('ArrowUp');
    st = await t.state();
    t.check('menu wraps up to last (0 -> 3)', st.top.selected === 3, `selected=${st.top.selected}`);
    await t.key('ArrowUp');
    await t.key('Enter', 250);
    p = await t.waitDone();
    t.check('menu confirm resolves 2', p.done && p.value === 2, `value=${p.value}`);

    await t.start('menu', ['Items', 'Riffs', 'Equip', 'Status', 'Save', 'Quit'], { columns: 2, selected: 1 });
    await t.waitTop(() => __uih.state().top && __uih.state().top.state === 'open');
    await t.key('ArrowRight');
    await t.key('ArrowDown');
    st = await t.state();
    t.check('2-column menu: start 1, right wraps to 0, down -> 2', st.top.selected === 2, `selected=${st.top.selected}`);
    await t.shot('09_menu_columns');
    await t.key('Backspace', 250);
    p = await t.waitDone();
    t.check('menu cancel resolves -1', p.done && p.value === -1, `value=${p.value}`);

    // ---- 6. caption ----
    await t.start('caption', 'ONE MONTH LATER', 600);
    await sleep(350);
    await t.shot('10_caption');
    p = await t.waitDone(4000);
    t.check('caption resolves after ~ms (+fades)', p.done && p.ms >= 600 && p.ms < 1600, `ms=${Math.round(p.ms)}`);

    // ---- 7. toast ----
    await t.start('toast', 'Got Pizza Slice!', 500);
    await sleep(300);
    st = await t.state();
    t.check('toast is not busy', st.busy === false && st.toast === true);
    await t.shot('11_toast');
    p = await t.waitDone(3000);
    t.check('toast resolves', p.done && !p.error);

    // ---- 8. fade / flash ----
    await t.start('fade', 'out', 250);
    p = await t.waitDone(3000);
    st = await t.state();
    t.check('fade out resolves with overlay opaque', p.done && st.fadeAlpha === 1, `alpha=${st.fadeAlpha}`);
    await t.shot('12_fade_out');
    await t.start('fade', 'in', 250);
    p = await t.waitDone(3000);
    st = await t.state();
    t.check('fade in resolves with overlay clear', p.done && st.fadeAlpha === 0, `alpha=${st.fadeAlpha}`);
    await t.start('flash', 150);
    await sleep(40);
    await t.shot('13_flash');
    p = await t.waitDone(3000);
    t.check('flash resolves', p.done && !p.error);

    // ---- 9. autoAdvance + chooseIndex, closeAll ----
    await page.evaluate(() => { __uih.ui.setAutoAdvance(true); __uih.ui.setTextInstant(true); __uih.ui.chooseIndex = 1; });
    const auto = await page.evaluate(async () => {
      const s = await __uih.ui.say({ who: 'lucky', text: 'auto one. auto two. auto three. auto four. auto five. auto six. auto seven. auto eight. nine.' });
      const c = await __uih.ui.choice(['A', 'B', 'C']);
      return { s, c };
    });
    t.check('autoAdvance say resolves itself, choice picks chooseIndex', auto.c === 1, `choice=${auto.c}`);
    await page.evaluate(() => { __uih.ui.setAutoAdvance(false); __uih.ui.setTextInstant(false); });
    await t.start('say', { who: 'lucky', text: 'closeAll should resolve me' });
    await t.waitTop(() => __uih.state().busy === true);
    await page.evaluate(() => __uih.ui.closeAll());
    p = await t.waitDone(2000);
    st = await t.state();
    t.check('closeAll resolves open say and clears busy', p.done && st.busy === false);

    st = await t.state();
    t.check('isBusy() false after everything', st.busy === false && st.open === 0);
    await sleep(200);
    await t.shot('14_end');

    // ---- 10. unfold animation mid-frame (visual only) ----
    await t.start('say', { who: 'narrator', text: 'Unfolding...' });
    await sleep(55);
    await t.shot('15_unfold');
    await t.waitTop(() => __uih.state().top && __uih.state().top.state === 'typing');
    await t.confirmUntilDone();

    // ---- 11. the ?demo=1 tour runs to completion unattended (?auto=1) ----
    await page.goto(`${vite.url}?demo=1&auto=1${fallback ? '&fallback=1' : ''}`, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__uih && globalThis.__uih.demoDone === true, null, { timeout: 20_000, polling: 100 });
    const demo = await page.evaluate(() => ({ error: __uih.demoError || null, busy: __uih.ui.isBusy() }));
    t.check('?demo=1&auto=1 tour completes without error', !demo.error && demo.busy === false, demo.error || '');

    report.tests = t.results;
    report.screenshots = t.shots;
    report.ok = t.results.every((r) => r.ok) && errors.length === 0;
  } catch (err) {
    errors.push(`fatal: ${err && err.stack ? err.stack : String(err)}`);
    report.ok = false;
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopVite(vite.child);
  }
  report.durationMs = Date.now() - startedAt;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write(`${JSON.stringify({ ok: false, errors: [`fatal: ${err && err.stack ? err.stack : String(err)}`] }, null, 2)}\n`);
  process.exit(1);
});
