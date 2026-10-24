#!/usr/bin/env node
// Headless smoke test: builds the game with Vite, serves dist/ from a throwaway static server,
// boots it in headless Chromium (Playwright) and checks that the Phaser scene reached create()
// without console/page errors. Prints one JSON line to stdout and exits non-zero on failure.
//
//   node tests/smoke.mjs
//
// Environment knobs (all optional):
//   PLAYWRIGHT_MODULE   path to a playwright package to use instead of the auto-detected one
//   SMOKE_CHROME        chromium executable to use if Playwright's default launch fails
//   SMOKE_KEEP_DIST=1   skip the `vite build` step and test whatever is already in dist/

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
const SCREENSHOT_DIR = path.join(ROOT, 'tests', 'screenshots');
const SCREENSHOT = path.join(SCREENSHOT_DIR, 'smoke.png');

const READY_TIMEOUT_MS = 20_000;
const SETTLE_MS = 600; // let a few frames render after create() so the tween/text are on screen

// 4x the 256x224 game size, so the screenshot shows an integer-scaled canvas filling the page.
const VIEWPORT = { width: 1024, height: 896 };

// Software WebGL so the WebGL renderer works with no GPU.
const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

function log(message) {
  process.stderr.write(`[smoke] ${message}\n`);
}

// ---------------------------------------------------------------------------------------------
// 1. vite build
// ---------------------------------------------------------------------------------------------

function build() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

  if (!existsSync(viteBin)) {
    throw new Error(`vite not installed at ${viteBin} (run npm install)`);
  }

  log('running vite build');

  const result = spawnSync(process.execPath, [viteBin, 'build'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Keep stdout reserved for the final JSON line.
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(`vite build exited with status ${result.status}`);
  }

  if (!existsSync(path.join(DIST, 'index.html'))) {
    throw new Error(`vite build produced no ${path.join(DIST, 'index.html')}`);
  }
}

// ---------------------------------------------------------------------------------------------
// 2. tiny static server for dist/
// ---------------------------------------------------------------------------------------------

function serveStatic(dir) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

        if (urlPath.endsWith('/')) {
          urlPath += 'index.html';
        }

        const filePath = path.normalize(path.join(dir, urlPath));

        // Never serve anything outside dist/.
        if (filePath !== dir && !filePath.startsWith(dir + path.sep)) {
          res.writeHead(403);
          res.end();
          return;
        }

        const body = await readFile(filePath);
        const type = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': type,
          'Content-Length': body.length,
          'Cache-Control': 'no-store',
        });
        res.end(body);
      } catch (err) {
        res.writeHead(err && (err.code === 'ENOENT' || err.code === 'EISDIR') ? 404 : 500);
        res.end();
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// 3. Playwright + Chromium
// ---------------------------------------------------------------------------------------------

function globalNodeModules() {
  const result = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    '/opt/node-tools/node_modules/playwright',
    'playwright',
  ].filter(Boolean);

  const tried = [];

  const tryLoad = (candidate) => {
    try {
      const pw = require(candidate);
      if (pw && pw.chromium) {
        return pw;
      }
      tried.push(`${candidate}: no chromium export`);
    } catch (err) {
      if (err && err.code !== 'MODULE_NOT_FOUND') throw err;
      tried.push(`${candidate}: not found`);
    }
    return null;
  };

  for (const candidate of candidates) {
    const pw = tryLoad(candidate);
    if (pw) return { pw, module: candidate };
  }

  // Last resort: wherever `npm root -g` points.
  const globalRoot = globalNodeModules();
  if (globalRoot) {
    const candidate = path.join(globalRoot, 'playwright');
    const pw = tryLoad(candidate);
    if (pw) return { pw, module: candidate };
  }

  throw new Error(`playwright not found. Tried:\n  ${tried.join('\n  ')}`);
}

function findChromeExecutable() {
  if (process.env.SMOKE_CHROME) {
    return process.env.SMOKE_CHROME;
  }

  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';

  if (existsSync(base)) {
    // Prefer the newest full chromium build (chromium-<revision>/chrome-linux/chrome).
    const revisions = readdirSync(base)
      .filter((name) => /^chromium-\d+$/.test(name))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));

    for (const dir of revisions) {
      const candidate = path.join(base, dir, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }

  const fallback = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  return existsSync(fallback) ? fallback : null;
}

async function launchChromium(chromium) {
  const attempts = [{ headless: true, args: LAUNCH_ARGS }];
  const explicit = findChromeExecutable();

  if (explicit) {
    attempts.push({ headless: true, args: LAUNCH_ARGS, executablePath: explicit });
  }

  const failures = [];

  for (const options of attempts) {
    const label = options.executablePath ?? 'playwright default';
    try {
      log(`launching chromium (${label})`);
      const browser = await chromium.launch(options);
      return { browser, executablePath: label };
    } catch (err) {
      const reason = String(err && err.message ? err.message : err).split('\n')[0];
      failures.push(`${label}: ${reason}`);
      log(`launch failed (${label}): ${reason}`);
    }
  }

  throw new Error(`could not launch chromium:\n  ${failures.join('\n  ')}`);
}

// ---------------------------------------------------------------------------------------------
// 4-7. drive the page, collect errors, screenshot, report
// ---------------------------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const errors = [];
  const report = {
    ok: false,
    renderer: null,
    phaser: null,
    errors,
  };

  if (process.env.SMOKE_KEEP_DIST === '1') {
    log('SMOKE_KEEP_DIST=1, skipping vite build');
  } else {
    build();
  }

  const { pw, module } = loadPlaywright();
  report.playwright = { module };

  const { server, port } = await serveStatic(DIST);
  const url = `http://127.0.0.1:${port}/`;
  log(`serving ${DIST} at ${url}`);

  let browser = null;

  try {
    const launched = await launchChromium(pw.chromium);
    browser = launched.browser;
    report.playwright = {
      module,
      executablePath: launched.executablePath,
      browserVersion: browser.version(),
      args: LAUNCH_ARGS,
    };

    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      errors.push(`pageerror: ${err && err.message ? err.message : String(err)}`);
    });
    page.on('requestfailed', (req) => {
      const failure = req.failure();
      errors.push(`requestfailed: ${req.url()} (${failure ? failure.errorText : 'unknown'})`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`);
    });

    await page.goto(url, { waitUntil: 'load', timeout: READY_TIMEOUT_MS });

    let ready = false;
    try {
      await page.waitForFunction(() => globalThis.__smoke && globalThis.__smoke.ready === true, null, {
        timeout: READY_TIMEOUT_MS,
        polling: 100,
      });
      ready = true;
    } catch {
      errors.push(`window.__smoke.ready was not set within ${READY_TIMEOUT_MS}ms`);
    }

    const smoke = await page.evaluate(() => globalThis.__smoke ?? null);

    if (smoke) {
      report.renderer = smoke.renderer ?? null;
      report.phaser = smoke.phaser ?? null;
      report.fontLoaded = smoke.fontLoaded ?? null;

      if (smoke.fontLoaded === false) {
        errors.push('pixel font "Press Start 2P" did not load (document.fonts.check returned false)');
      }
    }

    await page.waitForTimeout(SETTLE_MS);

    report.canvas = await page.evaluate(() => {
      const canvas = document.querySelector('#game canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        width: canvas.width,
        height: canvas.height,
        cssWidth: Math.round(rect.width),
        cssHeight: Math.round(rect.height),
        scale: Math.round((rect.width / canvas.width) * 1000) / 1000,
      };
    });

    if (!report.canvas) {
      errors.push('no <canvas> found inside #game');
    }

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: SCREENSHOT });
    report.screenshot = path.relative(ROOT, SCREENSHOT);

    report.ok = ready && errors.length === 0;
  } catch (err) {
    errors.push(`fatal: ${err && err.stack ? err.stack : String(err)}`);
    report.ok = false;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await new Promise((resolve) => server.close(resolve));
  }

  report.durationMs = Date.now() - startedAt;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write(
    `${JSON.stringify({ ok: false, renderer: null, phaser: null, errors: [`fatal: ${err && err.stack ? err.stack : String(err)}`] }, null, 2)}\n`,
  );
  process.exit(1);
});
