/**
 * Song registry: id → song module (static imports so Vite bundles them).
 * Add a song: create songs/<id>.js (format in ../README.md), import it here, add it to SONGS.
 *
 * ALIASES maps the other design docs' cue names onto these ids (one song object,
 * several names). AudioEngine resolves them in playMusic / hasSong, so a map's
 * "music": "hub" plays west_bank; currentMusic always reports the canonical id.
 */
import title from './title.js';
import snow from './snow.js';
import battle from './battle.js';
import dental_plan from './dental_plan.js';
import flying_squirrel from './flying_squirrel.js';
import pothole from './pothole.js';
import unpaid_bills from './unpaid_bills.js';
import ask_the_universe from './ask_the_universe.js';
import northern_garage from './northern_garage.js';
import west_bank from './west_bank.js';
import normal_music from './normal_music.js';
import sticker_hallway from './sticker_hallway.js';

export const SONGS = Object.freeze({
  title, snow, battle,
  dental_plan, flying_squirrel, pothole, unpaid_bills, ask_the_universe, northern_garage,
  west_bank, normal_music, sticker_hallway,
});

export const ALIASES = Object.freeze({
  pod_bay: 'dental_plan',
  freefall: 'flying_squirrel',
  apartment: 'unpaid_bills',
  signal: 'ask_the_universe',
  garage: 'northern_garage',
  hub: 'west_bank',
  coffee: 'normal_music',
  rehearsal_brian: 'normal_music',
  citysound: 'sticker_hallway',
  battle_noise: 'battle',
});

export default SONGS;
