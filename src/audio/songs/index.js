/**
 * Song registry: id → song module (static imports so Vite bundles them).
 * Add a song: create songs/<id>.js (format in ../README.md), import it here, add it to SONGS.
 */
import title from './title.js';
import snow from './snow.js';
import battle from './battle.js';

export const SONGS = Object.freeze({ title, snow, battle });
export default SONGS;
