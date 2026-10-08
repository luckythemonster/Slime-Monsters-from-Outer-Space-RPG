#!/usr/bin/env node
// Runs every test sequentially and exits non-zero if any fails:
//   data.test.mjs (pure Node) → smoke.mjs (vite build + headless boot) → explore.mjs (gameplay)
//   → audio.mjs / ui.mjs when present.
// smoke.mjs builds dist/; explore.mjs reuses it (EXPLORE_KEEP_DIST=1) when smoke succeeded.
//
//   npm test   /   node tests/run.mjs

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = ['data.test.mjs', 'smoke.mjs', 'explore.mjs', 'audio.mjs', 'ui.mjs'];

const results = [];
let builtDist = false;

for (const name of TESTS) {
  const file = path.join(ROOT, 'tests', name);
  if (!existsSync(file)) {
    results.push({ test: name, ok: true, skipped: true });
    continue;
  }
  process.stderr.write(`\n[run] ===== ${name} =====\n`);
  const env = { ...process.env };
  if (name === 'explore.mjs' && builtDist) env.EXPLORE_KEEP_DIST = '1';
  const started = Date.now();
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, stdio: 'inherit', env });
  const ok = r.status === 0;
  if (name === 'smoke.mjs' && ok) builtDist = true;
  results.push({ test: name, ok, status: r.status, durationMs: Date.now() - started });
  if (!ok) process.stderr.write(`[run] ${name} FAILED (exit ${r.status})\n`);
}

const ok = results.every((r) => r.ok);
process.stdout.write(`${JSON.stringify({ test: 'run', ok, results })}\n`);
process.exit(ok ? 0 : 1);
