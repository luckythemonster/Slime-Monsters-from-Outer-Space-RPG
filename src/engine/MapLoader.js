// MapLoader: ASCII map JSON (ARCHITECTURE §4) → Phaser tilemap layers + collision grid.
import { TILE, DEPTH } from '../config.js';

/**
 * @typedef {object} BuiltMap
 * @property {Phaser.Tilemaps.Tilemap} tilemap
 * @property {{ground: Phaser.Tilemaps.TilemapLayer, deco: Phaser.Tilemaps.TilemapLayer|null, over: Phaser.Tilemaps.TilemapLayer|null}} layers
 * @property {number} width tiles
 * @property {number} height tiles
 * @property {Uint8Array} solid width*height collision grid (1 = blocked)
 * @property {() => void} destroy
 */

/**
 * Resolve a legend character to a tile index through the manifest tileset.
 * @returns {{index: number, solid: boolean}|null} null for empty (' ')
 */
export function resolveTile(mapDef, tileset, ch) {
  if (ch === ' ') return null;
  const name = mapDef.legend[ch];
  if (!name) throw new Error(`map ${mapDef.id}: legend has no entry for "${ch}"`);
  const tile = tileset.tiles[name];
  if (!tile) throw new Error(`map ${mapDef.id}: tile "${name}" not in tileset "${mapDef.tileset}"`);
  return { index: tile.index, solid: !!tile.solid };
}

/** Map dimensions from the ground layer. */
export function mapSize(mapDef) {
  const rows = mapDef.layers.ground;
  return { width: rows[0].length, height: rows.length };
}

/**
 * Convert one ASCII layer into a 2D index array (and OR solid tiles into `solid`).
 */
function layerIndices(mapDef, tileset, rows, width, height, solid, collides) {
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = rows[y] || '';
    const out = new Array(width);
    for (let x = 0; x < width; x++) {
      const t = resolveTile(mapDef, tileset, x < row.length ? row[x] : ' ');
      out[x] = t ? t.index : -1;
      if (t && collides && t.solid) solid[y * width + x] = 1;
    }
    grid.push(out);
  }
  return grid;
}

/**
 * Build tilemap layers for a map definition.
 * @param {Phaser.Scene} scene
 * @param {object} mapDef map JSON
 * @param {Record<string, object>} manifest assets/generated/manifest.json
 * @returns {BuiltMap}
 */
export function buildMap(scene, mapDef, manifest) {
  const tileset = manifest && manifest[mapDef.tileset];
  if (!tileset || tileset.type !== 'tileset') throw new Error(`map ${mapDef.id}: tileset "${mapDef.tileset}" missing from manifest`);
  if (!scene.textures.exists(mapDef.tileset)) throw new Error(`map ${mapDef.id}: texture "${mapDef.tileset}" not loaded`);

  const { width, height } = mapSize(mapDef);
  const solid = new Uint8Array(width * height);

  const tilemap = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width, height });
  const set = tilemap.addTilesetImage(mapDef.tileset, mapDef.tileset, tileset.tileWidth || TILE, tileset.tileHeight || TILE, 0, 0, 0);

  const layers = { ground: null, deco: null, over: null };
  const specs = [
    ['ground', DEPTH.GROUND, true],
    ['deco', DEPTH.DECO, true],
    ['over', DEPTH.OVER, false],
  ];
  for (const [name, depth, collides] of specs) {
    const rows = mapDef.layers[name];
    if (!rows) continue;
    const layer = tilemap.createBlankLayer(name, set, 0, 0, width, height, TILE, TILE);
    const grid = layerIndices(mapDef, tileset, rows, width, height, solid, collides);
    layer.putTilesAt(grid, 0, 0, false);
    layer.setDepth(depth);
    layers[name] = layer;
  }

  return {
    tilemap,
    layers,
    width,
    height,
    solid,
    destroy() {
      for (const l of Object.values(layers)) if (l) l.destroy();
      tilemap.destroy();
    },
  };
}

/** True if the tile is outside the map or marked solid. */
export function isSolidAt(built, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= built.width || ty >= built.height) return true;
  return built.solid[ty * built.width + tx] === 1;
}
