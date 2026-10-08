#!/usr/bin/env node
/**
 * tests/audio.mjs — audio engine test.
 *
 * 1. Node (pure): every song in src/audio/songs validates and compiles; token parser rejects garbage.
 * 2. Headless Chromium (Playwright, global install): serves the repo root with a tiny static server,
 *    opens tests/audio-harness.html and, through window.__audioHarness:
 *    - realtime: plays each song ~2.5 s → no exceptions, context running, tick steps strictly
 *      increasing at bpm*stepsPerBeat/60 steps/s (±5 % vs wall clock), analyser RMS > 0 while
 *      playing and ≈ 0 after stopMusic; crossfade between songs; every SFX plays.
 *    - offline (OfflineAudioContext, most reliable): renders each song across its first loop
 *      boundary → non-zero RMS, no clipping, no 100 ms gap at the seam; renders every SFX →
 *      non-zero RMS, silent tail, no clipping.
 * Prints a JSON report and exits non-zero on any failure.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const results = [];
let failed = 0;
function check(name, ok, details = {}) {
  results.push({ name, ok: !!ok, ...details });
  if (!ok) failed++;
  process.stderr.write(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + JSON.stringify(details)}\n`);
}

// ---------------------------------------------------------------------------
// 1. Pure Node checks
// ---------------------------------------------------------------------------
const { validateSong, compileSong, parseToken } = await import(pathToFileURL(path.join(ROOT, 'src/audio/Sequencer.js')));
const { SONGS } = await import(pathToFileURL(path.join(ROOT, 'src/audio/songs/index.js')));
const { SFX, SFX_NAMES } = await import(pathToFileURL(path.join(ROOT, 'src/audio/sfx.js')));

const REQUIRED_SFX = ['cursor', 'confirm', 'cancel', 'text_blip', 'hit', 'crit', 'miss', 'squelch', 'slime_pop', 'kraaang',
  'level_up', 'item', 'door', 'sneeze', 'feedback', 'drum_hit', 'cymbal', 'ko', 'flee', 'save'];
check('sfx: every ARCHITECTURE.md name has a recipe', REQUIRED_SFX.every((n) => typeof SFX[n] === 'function') && REQUIRED_SFX.every((n) => SFX_NAMES.includes(n)),
  { missing: REQUIRED_SFX.filter((n) => typeof SFX[n] !== 'function') });

for (const [id, song] of Object.entries(SONGS)) {
  const errs = validateSong(song);
  check(`song ${id}: validates`, errs.length === 0 && song.id === id, { errs });
  if (errs.length) continue;
  const c = compileSong(song);
  const counts = Object.fromEntries(c.channels.map((ch) => [ch.name, ch.events.length]));
  check(`song ${id}: compiles (${c.bars} bars, ${c.totalSteps} steps, ${c.duration.toFixed(1)} s)`,
    c.totalSteps === c.bars * c.stepsPerBar && c.channels.every((ch) => ch.events.length > 0) && c.loopLen > 0, { counts });
}
check('parser: rejects bad note token', (() => { try { parseToken('H4'); return false; } catch { return true; } })());
check('parser: rejects bad drum token', (() => { try { parseToken('x', 'drum'); return false; } catch { return true; } })());
check('parser: accepts slide+accent', (() => { const t = parseToken('F#5~!'); return t.type === 'note' && t.slide && t.accent && t.midi === 78; })());
check('validator: reports wrong bar length and unknown refs', (() => {
  const errs = validateSong({ id: 'x', bpm: 120, channels: { p: { wave: 'pulse', patterns: { A: 'C4 . .' } } }, order: [{ p: 'A' }, { p: 'B' }, { q: 'A' }] });
  return errs.length === 3;
})());

// ---------------------------------------------------------------------------
// 2. Browser checks
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain',
};
function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = ['playwright'];
  try { candidates.push(path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright')); } catch { /* ignore */ }
  candidates.push('/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright');
  for (const c of candidates) { try { return require(c); } catch { /* next */ } }
  throw new Error(`playwright not found (tried ${candidates.join(', ')})`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { server, port } = await startServer();
let browser = null;
const consoleErrors = [];
const pageErrors = [];
try {
  const { chromium } = loadPlaywright();
  browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
  await page.goto(`http://127.0.0.1:${port}/tests/audio-harness.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__audioHarness, null, { timeout: 10000 });

  const state = await page.evaluate(() => window.__audioHarness.init());
  check('realtime: AudioContext running', state === 'running', { state });

  const songIds = await page.evaluate(() => window.__audioHarness.SONG_IDS);
  check('songs: index exports title, snow, battle', ['title', 'snow', 'battle'].every((id) => songIds.includes(id)), { songIds });

  // --- realtime playback of each song ---
  for (const id of songIds) {
    const r = await page.evaluate(async (id) => {
      const h = window.__audioHarness;
      const info = h.play(id, { fade: 0 });
      const rmsSamples = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 2500) { await new Promise((r) => setTimeout(r, 100)); rmsSamples.push(h.rms()); }
      const during = { max: Math.max(...rmsSamples), mean: rmsSamples.reduce((a, b) => a + b, 0) / rmsSamples.length, zeros: rmsSamples.filter((v) => v < 1e-4).length, n: rmsSamples.length };
      const stateDuring = h.state();
      const ticks = h.ticks.slice();
      h.stop({ fade: 0.1 });
      await new Promise((r) => setTimeout(r, 450));
      const after = [];
      for (let i = 0; i < 6; i++) { after.push(h.rms()); await new Promise((r) => setTimeout(r, 30)); }
      return { info, during, ticks, stateDuring, afterMax: Math.max(...after), stateAfter: h.state(), ctxState: h.ctx.state };
    }, id);
    const { ticks, info } = r;
    const monotonic = ticks.every((t, i) => i === 0 || t.step > ticks[i - 1].step);
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    const expectedRate = (info.bpm * info.stepsPerBeat) / 60;
    const wallRate = ticks.length > 2 ? (last.step - first.step) / ((last.wall - first.wall) / 1000) : 0;
    const ctxRate = ticks.length > 2 ? (last.step - first.step) / (last.ctxTime - first.ctxTime) : 0;
    // tick latency: how far behind the audio clock the tick fired (should be < interval + jitter)
    const maxLag = Math.max(...ticks.map((t) => t.ctxTime - t.stepTime));
    check(`realtime ${id}: no gaps in output while playing`, r.during.max > 0.01 && r.during.zeros === 0, r.during);
    check(`realtime ${id}: ticks monotonic (${ticks.length} ticks)`, monotonic && ticks.length >= 10, { ticks: ticks.length, monotonic });
    check(`realtime ${id}: step rate vs wall clock within 5% (expected ${expectedRate.toFixed(2)}/s)`, Math.abs(wallRate / expectedRate - 1) <= 0.05,
      { wallRate: +wallRate.toFixed(3), ctxRate: +ctxRate.toFixed(3), expectedRate: +expectedRate.toFixed(3) });
    check(`realtime ${id}: ticks fire promptly (max lag ${Math.round(maxLag * 1000)} ms)`, maxLag < 0.12, { maxLag });
    check(`realtime ${id}: position reports current song`, r.stateDuring.currentMusic === id && r.stateDuring.position && r.stateDuring.position.step >= 0, r.stateDuring);
    check(`realtime ${id}: silent after stopMusic`, r.afterMax < 2e-3 && r.stateAfter.currentMusic === null, { afterMax: r.afterMax, stateAfter: r.stateAfter });
    check(`realtime ${id}: context still running`, r.ctxState === 'running', { ctxState: r.ctxState });
  }

  // --- crossfade + restart semantics ---
  const xf = await page.evaluate(async () => {
    const h = window.__audioHarness;
    h.play('title', { fade: 0 });
    await new Promise((r) => setTimeout(r, 500));
    const seqA = h.engine.sequencer;
    const sameSeq = h.engine.playMusic('title') === seqA; // same song, no restart → no-op
    h.engine.playMusic('battle', { fade: 0.3 });
    const midState = h.state();
    await new Promise((r) => setTimeout(r, 200));
    const midRms = h.rms();
    await new Promise((r) => setTimeout(r, 500));
    const afterState = h.state();
    const rms = h.rms();
    const seqB = h.engine.sequencer;
    const restarted = h.engine.playMusic('battle', { restart: true, fade: 0 }) !== seqB;
    await new Promise((r) => setTimeout(r, 150));
    const muteBefore = h.rms();
    h.engine.mute(true);
    await new Promise((r) => setTimeout(r, 150));
    const muted = h.rms();
    h.engine.mute(false);
    h.engine.setVolume({ music: 0.3, sfx: 0.5 });
    const vols = h.engine.volumes;
    h.engine.setVolume(0.7, 0.8);
    const vols2 = h.engine.volumes;
    h.stop({ fade: 0.1 });
    await new Promise((r) => setTimeout(r, 400));
    return { sameSeq, midState, midRms, afterState, rms, restarted, muteBefore, muted, vols, vols2, finalState: h.state() };
  });
  check('crossfade: switches to new song while old fades', xf.midState.currentMusic === 'battle' && xf.midState.fading === 1 && xf.midRms > 0.01, xf.midState);
  check('crossfade: old sequencer released after fade', xf.afterState.currentMusic === 'battle' && xf.afterState.fading === 0 && xf.rms > 0.01, xf.afterState);
  check('playMusic: same song is a no-op, restart:true restarts', xf.sameSeq && xf.restarted, { sameSeq: xf.sameSeq, restarted: xf.restarted });
  check('mute: silences output; setVolume accepts object and positional', xf.muteBefore > 0.01 && xf.muted < 2e-3 && xf.vols.music === 0.3 && xf.vols.sfx === 0.5 && xf.vols2.music === 0.7,
    { muteBefore: xf.muteBefore, muted: xf.muted, vols: xf.vols, vols2: xf.vols2 });
  check('stopMusic: nothing playing afterwards', !xf.finalState.isMusicPlaying && xf.finalState.currentMusic === null, xf.finalState);

  // --- realtime SFX ---
  const sfxRt = await page.evaluate(async () => {
    const h = window.__audioHarness;
    const durations = {};
    let maxRms = 0;
    for (const name of h.SFX_NAMES) {
      durations[name] = h.sfx(name);
      await new Promise((r) => setTimeout(r, 60));
      maxRms = Math.max(maxRms, h.rms());
    }
    const unknown = h.sfx('definitely_not_a_sound');
    await new Promise((r) => setTimeout(r, 900));
    return { durations, maxRms, unknown, active: h.state().activeSfxVoices, ctx: h.ctx.state };
  });
  check('realtime sfx: every recipe plays and returns a duration', Object.values(sfxRt.durations).every((d) => d > 0 && d <= 1) && sfxRt.maxRms > 0.01, { maxRms: sfxRt.maxRms, durations: sfxRt.durations });
  check('realtime sfx: unknown name returns 0 without throwing', sfxRt.unknown === 0);
  check('realtime sfx: voices clean themselves up', sfxRt.active === 0 && sfxRt.ctx === 'running', { active: sfxRt.active });

  // --- tab blur: suspended context freezes the clock, playback resumes in place ---
  const blur = await page.evaluate(async () => {
    const h = window.__audioHarness;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    h.play('title', { fade: 0 });
    await wait(600);
    const before = h.engine.sequencer.position;
    await h.ctx.suspend();
    const stateSuspended = h.ctx.state;
    await wait(500);
    const during = h.engine.sequencer.position;
    await h.ctx.resume();
    await wait(600);
    const after = h.engine.sequencer.position;
    const rmsAfter = h.rms();
    const ticks = h.ticks.slice();
    h.stop({ fade: 0 });
    await wait(100);
    return {
      stateSuspended, stateAfter: h.ctx.state, rmsAfter, ticks: ticks.length,
      frozen: during.time - before.time, resumed: after.time - during.time,
      monotonic: ticks.every((t, i) => i === 0 || t.step > ticks[i - 1].step),
    };
  });
  check('blur: suspend freezes the position, resume continues in place with monotonic ticks',
    blur.stateSuspended === 'suspended' && blur.stateAfter === 'running' && blur.frozen < 0.1 && blur.resumed > 0.35 && blur.resumed < 0.9 && blur.rmsAfter > 0.01 && blur.monotonic, blur);

  // --- registerSong + non-looping song ---
  const once = await page.evaluate(async () => {
    const h = window.__audioHarness;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    h.engine.registerSong({
      id: 'once_test', bpm: 300, beatsPerBar: 4, stepsPerBeat: 4, loop: false,
      channels: {
        p: { wave: 'pulse', duty: 0.5, volume: 0.4, patterns: { A: 'C5 . E5 . G5 . C6 . | C5 . E5 . G5 . C6 .' } },
        n: { wave: 'noise', volume: 0.4, patterns: { A: 'k . h . s . h . | k . h . s . h .' } },
      },
      order: [{ p: 'A', n: 'A' }, { p: 'A', n: 'A' }],
    });
    let ended = false;
    const seq = h.engine.playMusic('once_test', { fade: 0 });
    seq.on('end', () => { ended = true; });
    await wait(400);
    const rmsDuring = h.rms();
    await wait(seq.duration * 1000 + 400);
    return { ended, duration: seq.duration, current: h.engine.currentMusic, state: seq.state, rmsDuring, rmsAfter: h.rms(), registered: h.engine.hasSong('once_test') };
  });
  check('non-loop song: plays once, emits end, clears currentMusic', once.registered && once.ended && once.current === null && once.state === 'ended' && once.rmsDuring > 0.01 && once.rmsAfter < 2e-3, once);
  const bad = await page.evaluate(() => {
    try {
      window.__audioHarness.engine.registerSong({ id: 'bad', bpm: 100, channels: { p: { wave: 'pulse', patterns: { A: 'C4 Z4' } } }, order: [{ p: 'A' }] });
      return null;
    } catch (e) { return e.message; }
  });
  check('registerSong: throws a helpful message for an invalid song', typeof bad === 'string' && bad.includes('expected 16') && bad.includes('Z4'), { bad });

  // --- offline renders (most reliable path) ---
  for (const id of songIds) {
    const r = await page.evaluate((id) => window.__audioHarness.renderSong(id), id);
    const minAllowed = r.rms * 0.08;
    check(`offline ${id}: non-zero RMS over ${r.seconds.toFixed(1)} s (rms ${r.rms.toFixed(3)}, ${r.renderMs} ms)`, r.rms > 0.02 && r.rmsFirst2s > 0.02, { rms: r.rms, rmsFirst2s: r.rmsFirst2s });
    check(`offline ${id}: no clipping (peak ${r.peak.toFixed(3)})`, r.peak < 1.0, { peak: r.peak });
    check(`offline ${id}: loops seamlessly (no 100 ms gap at the seam; min window ${r.minWindowRms.toFixed(4)} vs ${minAllowed.toFixed(4)})`,
      r.minWindowRms > minAllowed && r.rmsAfterLoop > minAllowed, { minWindowRms: r.minWindowRms, rmsBeforeLoop: r.rmsBeforeLoop, rmsAfterLoop: r.rmsAfterLoop, windows: r.windows.map((w) => +w.rms.toFixed(4)) });
  }
  const sfxNames = await page.evaluate(() => window.__audioHarness.SFX_NAMES);
  const sfxOffline = {};
  for (const name of sfxNames) {
    const r = await page.evaluate((name) => window.__audioHarness.renderSfx(name), name);
    sfxOffline[name] = { rms: +r.rms.toFixed(4), peak: +r.peak.toFixed(3), tail: +r.tailRms.toFixed(5) };
    check(`offline sfx ${name}: audible, short, unclipped`, r.rms > 2e-4 && r.onsetRms > 1e-3 && r.tailRms < 1e-3 && r.peak < 1.0, sfxOffline[name]);
  }

  check('browser: no page errors', pageErrors.length === 0, { pageErrors });
  check('browser: no console errors', consoleErrors.length === 0, { consoleErrors });
  const harnessErrors = await page.evaluate(() => window.__audioHarness.errors);
  check('browser: no uncaught errors / rejections in harness', harnessErrors.length === 0, { harnessErrors });
} catch (e) {
  check('browser run completed', false, { error: String(e && e.stack || e), pageErrors, consoleErrors });
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}

const summary = { ok: failed === 0, passed: results.length - failed, failed, results };
console.log(JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
