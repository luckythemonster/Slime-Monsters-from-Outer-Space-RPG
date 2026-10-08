// Static game data registry. Vite bundles every JSON under src/data and resolves the generated
// art under assets/generated through import.meta.glob, so `vite build` output is self-contained
// (nothing has to live in public/). Adding a map or script file is enough to register it.
import characters from '../data/characters.json';
import items from '../data/items.json';
import equipment from '../data/equipment.json';
import enemies from '../data/enemies.json';
import encounters from '../data/encounters.json';
import start from '../data/start.json';

const mapModules = import.meta.glob('/src/data/maps/*.json', { eager: true, import: 'default' });
const scriptModules = import.meta.glob('/src/data/scripts/*.json', { eager: true, import: 'default' });
const manifestModules = import.meta.glob('/assets/generated/manifest.json', { eager: true, import: 'default' });
// Engine-owned fallback sheets (assets/generated/_dev_*) used only while the real art is missing;
// entries never override the art agent's manifest.
const devManifestModules = import.meta.glob('/assets/generated/_dev_manifest.json', { eager: true, import: 'default' });
const pngUrls = import.meta.glob('/assets/generated/*.png', { eager: true, query: '?url', import: 'default' });

/**
 * @typedef {object} GameDataRegistry
 * @property {object} characters
 * @property {object} items
 * @property {object} equipment
 * @property {object} enemies
 * @property {object} encounters
 * @property {object} start
 * @property {Record<string, object>} maps map id → map JSON
 * @property {Record<string, object[]>} scripts script id → command array
 * @property {Record<string, object>|null} manifest assets/generated/manifest.json or null
 * @property {(file: string) => string|null} assetUrl resolve "lucky.png" → bundled URL
 */

/** @type {GameDataRegistry|null} */
let registry = null;

/**
 * Build (once) and return the data registry. Throws on duplicate script ids.
 * @returns {GameDataRegistry}
 */
export function loadData() {
  if (registry) return registry;

  const maps = {};
  for (const [file, map] of Object.entries(mapModules)) {
    const id = file.split('/').pop().replace(/\.json$/, '');
    if (map.id && map.id !== id) console.warn(`[data] map file ${file} has id "${map.id}" (expected "${id}")`);
    maps[id] = map;
  }

  const scripts = {};
  const owner = {};
  for (const [file, table] of Object.entries(scriptModules)) {
    for (const [id, cmds] of Object.entries(table)) {
      if (scripts[id]) throw new Error(`[data] duplicate script id "${id}" in ${file} and ${owner[id]}`);
      scripts[id] = cmds;
      owner[id] = file;
    }
  }

  const real = manifestModules['/assets/generated/manifest.json'] || null;
  const dev = devManifestModules['/assets/generated/_dev_manifest.json'] || {};
  if (!real) console.warn('[data] assets/generated/manifest.json missing — run `npm run assets`');
  const manifest = real || Object.keys(dev).length ? { ...dev, ...(real || {}) } : null;
  for (const k of Object.keys(dev)) if (!real || !real[k]) console.warn(`[data] using engine fallback sheet "${k}" (art not generated yet)`);

  const assetUrl = (file) => pngUrls[`/assets/generated/${file}`] || null;

  registry = { characters, items, equipment, enemies, encounters, start, maps, scripts, manifest, assetUrl };
  return registry;
}

/**
 * PNG file name for a manifest entry (entries may carry `file`; otherwise the §3 convention).
 * @param {string} key manifest key
 * @param {object} entry manifest entry
 */
export function manifestFile(key, entry) {
  if (entry.file) return entry.file;
  if (entry.image) return entry.image;
  if (entry.png) return entry.png;
  return entry.type === 'tileset' ? `tiles_${key}.png` : `${key}.png`;
}
