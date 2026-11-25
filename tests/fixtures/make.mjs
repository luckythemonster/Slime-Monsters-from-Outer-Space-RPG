#!/usr/bin/env node
// Rebuild the seeded chapter-start saves from the real playthrough saves (docs/ROADMAP.md, Foundations).
// Fixtures are never written by hand:
//   save_ch1_end_v1.json   written by `CH1_SAVE_FIXTURE_OUT=tests/fixtures/save_ch1_end_v1.json node tests/chapter1.mjs`
//                          on the build before save version 2. It is the "old save that must keep loading".
//                          Do not regenerate it: a newer build would write a newer version.
//   ch02_start.json        that save, migrated to the current save version by the game's own migrateSave().
//                          It is where Chapter 2 starts. tests/data.test.mjs fails if it goes stale.
//
//   node tests/fixtures/make.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateSave } from '../../src/engine/GameState.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const equipment = readJson(path.join(ROOT, 'src', 'data', 'equipment.json'));

export const CHAPTER_STARTS = { 2: { from: 'save_ch1_end_v1.json', out: 'ch02_start.json' } };

export function buildChapterStart(n) {
  const spec = CHAPTER_STARTS[n];
  return migrateSave(readJson(path.join(HERE, spec.from)), { equipment });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [n, spec] of Object.entries(CHAPTER_STARTS)) {
    writeFileSync(path.join(HERE, spec.out), `${JSON.stringify(buildChapterStart(Number(n)), null, 2)}\n`);
    process.stdout.write(`chapter ${n} start -> tests/fixtures/${spec.out}\n`);
  }
}
