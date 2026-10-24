#!/usr/bin/env node
/**
 * tools/render_song.mjs — render a song (or an SFX) offline through the real engine to a WAV.
 *
 *   node tools/render_song.mjs <songId> [--seconds N] [--out file.wav] [--no-limiter] [--song path/to/song.js] [--json]
 *
 * Same path tests/audio.mjs uses: a tiny static server on the repo root, headless Chromium
 * (the global Playwright install), tests/audio-harness.html, `AudioEngine.renderOffline` in an
 * OfflineAudioContext (44.1 kHz mono). The PCM comes back as 16-bit samples and is written as a WAV
 * (default: scratch/<songId>.wav next to the repo, or --out). --song renders a song file that is not
 * registered in songs/index.js (it is imported by URL through the harness page). --json prints
 * { seconds, rms, peak } for scripts. Never run two Playwright renders at once (see tests/run.mjs).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const args = process.argv.slice(2);
const flag = (name, dflt = null) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const has = (name) => args.includes(name);
const songId = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
if (!songId) { console.error('usage: node tools/render_song.mjs <songId> [--seconds N] [--out file.wav] [--no-limiter] [--song file.js] [--json]'); process.exit(2); }
const secondsArg = flag('--seconds');
const out = flag('--out', path.join(ROOT, 'scratch', `${songId}.wav`));
const limiter = !has('--no-limiter');
const songFile = flag('--song');
const asJson = has('--json');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json' };
const extra = {}; // '/__song/<name>' → absolute path, for a --song file outside the repo
function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = extra[urlPath] || path.normalize(path.join(ROOT, urlPath));
    if (!(extra[urlPath] || file.startsWith(ROOT)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
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
function writeWav(file, pcm16, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm16.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm16.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([header, pcm16]));
}

const { server, port } = await startServer();
let browser = null;
try {
  const { chromium } = loadPlaywright();
  browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(`http://127.0.0.1:${port}/tests/audio-harness.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__audioHarness, null, { timeout: 10000 });
  let songUrl = null;
  if (songFile) {
    const abs = path.resolve(songFile);
    if (abs.startsWith(ROOT + path.sep)) songUrl = '/' + path.relative(ROOT, abs).split(path.sep).join('/');
    else { songUrl = '/__song/' + path.basename(abs); extra[songUrl] = abs; }
  }
  const r = await page.evaluate(async ({ songId, secondsArg, limiter, songUrl }) => {
    const { AudioEngine, bufferRms, bufferPeak, SONGS } = await import('/src/audio/AudioEngine.js');
    const { compileSong, validateSong } = await import('/src/audio/Sequencer.js');
    let songs = SONGS;
    if (songUrl) {
      const mod = await import(songUrl + '?t=' + Date.now());
      const song = mod.default;
      const errs = validateSong(song);
      if (errs.length) throw new Error('invalid song: ' + errs.join('; '));
      songs = { ...SONGS, [song.id]: song };
    }
    const song = songs[songId];
    if (!song) throw new Error(`unknown song ${songId}`);
    const c = compileSong(song);
    const seconds = secondsArg ? Number(secondsArg) : Math.min(c.loop ? c.duration + 0.6 : c.duration + 0.8, 240);
    const sampleRate = 44100;
    const { buffer } = await AudioEngine.renderOffline({ music: songId, seconds, sampleRate, songs, limiter });
    const d = buffer.getChannelData(0);
    const pcm = new Int16Array(d.length);
    for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767)));
    const bytes = new Uint8Array(pcm.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { seconds, sampleRate, rms: bufferRms(buffer), peak: bufferPeak(buffer), bars: c.bars, bpm: c.bpm, duration: c.duration, b64: btoa(bin) };
  }, { songId, secondsArg, limiter, songUrl });
  if (errors.length) throw new Error(errors.join('\n'));
  writeWav(out, Buffer.from(r.b64, 'base64'), r.sampleRate);
  const info = { song: songId, out, seconds: r.seconds, rms: +r.rms.toFixed(4), peak: +r.peak.toFixed(4), bars: r.bars, bpm: r.bpm, duration: +r.duration.toFixed(2), limiter };
  if (asJson) console.log(JSON.stringify(info)); else console.error(`wrote ${out}: ${r.seconds.toFixed(1)} s, ${r.bars} bars @ ${r.bpm} BPM, rms ${info.rms}, peak ${info.peak}${limiter ? '' : ' (no limiter)'}`);
} catch (e) {
  console.error(String(e && e.stack || e));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
