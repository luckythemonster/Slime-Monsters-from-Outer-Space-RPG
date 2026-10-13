// Seeded RNG for the battle model (mulberry32). Pure module: tests inject a seed and replay a
// whole battle deterministically; the scene seeds from Date.now().

/**
 * @typedef {object} Rng
 * @property {() => number} float  uniform [0, 1)
 * @property {(a: number, b: number) => number} int  uniform integer, inclusive both ends
 * @property {(pct: number) => boolean} chance  true with probability pct/100
 * @property {<T>(arr: T[]) => T} pick  uniform element (undefined for an empty array)
 * @property {number} seed
 */

/**
 * @param {number} [seed]
 * @returns {Rng}
 */
export function makeRng(seed = Date.now() >>> 0) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const float = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    float,
    int: (a, b) => a + Math.floor(float() * (b - a + 1)),
    chance: (pct) => pct >= 100 || (pct > 0 && float() * 100 < pct),
    pick: (arr) => (arr && arr.length ? arr[Math.floor(float() * arr.length)] : undefined),
  };
}
