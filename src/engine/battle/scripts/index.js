// Scripted battles, one module per chapter (docs/ROADMAP.md, Foundations). Each module exports a table of
// factories keyed by encounter `script`; this index merges them. A key may exist in one chapter only: the
// merge throws on a duplicate, so a later chapter cannot silently replace an earlier chapter's battle.
// Chapter 1 keeps its ep0_ keys; from Chapter 2 on keys carry the chapter prefix (ch02_, ch03_, ...).
// Pure module: no Phaser.
import { CH01_SCRIPTS } from './ch01.js';

const CHAPTER_TABLES = [CH01_SCRIPTS];

function merge(tables) {
  const out = {};
  for (const table of tables) {
    for (const [key, factory] of Object.entries(table)) {
      if (key in out) throw new Error(`battle scripts: "${key}" is defined by two chapters`);
      out[key] = factory;
    }
  }
  return out;
}

export const BATTLE_SCRIPTS = merge(CHAPTER_TABLES);
export default BATTLE_SCRIPTS;
