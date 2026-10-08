// BootScene: loads the generated art from the manifest, registers animations and atlas frames,
// builds GameState / Input / audio, launches the permanent UI scene and starts Title.
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { loadData, manifestFile } from '../engine/Data.js';
import { GameState } from '../engine/GameState.js';
import { Input } from '../engine/Input.js';
import { makeAudioShim, isAudioEngine } from '../engine/Audio.js';
import { PARAMS, PIXEL_FONT, WIDTH, HEIGHT } from '../config.js';
import { registerAtlasFrames, hasUiFrames, UI_KEY, REQUIRED_FRAMES } from '../ui/atlas.js';

// Non-eager globs: an empty object when src/audio/ is not there yet, a lazy loader when it is.
const audioLoaders = import.meta.glob('/src/audio/AudioEngine.js');

export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'Boot' }); }

  preload() {
    this.gameData = loadData();
    const manifest = this.gameData.manifest || {};
    this.label = this.add.text(WIDTH / 2, HEIGHT / 2, 'LOADING', { fontFamily: PIXEL_FONT, fontSize: '8px', color: '#ffffff', resolution: 1 }).setOrigin(0.5);

    for (const [key, entry] of Object.entries(manifest)) {
      if (!entry || typeof entry !== 'object' || !entry.type) continue;
      const url = this.gameData.assetUrl(manifestFile(key, entry));
      if (!url) { console.warn(`[boot] manifest entry "${key}" has no PNG under assets/generated`); continue; }
      if (entry.type === 'spritesheet') {
        this.load.spritesheet(key, url, { frameWidth: entry.frameWidth || 16, frameHeight: entry.frameHeight || 24 });
      } else {
        this.load.image(key, url); // tileset, atlas, image
      }
    }
    this.load.on('loaderror', (file) => console.warn(`[boot] failed to load ${file.key}`));
  }

  async create() {
    const data = this.gameData;
    const manifest = data.manifest || {};

    for (const [key, entry] of Object.entries(manifest)) {
      // Atlases, plus sheets that name their frames (portraits: `names` or a name → index map).
      const named = entry.type === 'atlas' || Array.isArray(entry.names) || Array.isArray(entry.ids)
        || (entry.type !== 'spritesheet' && entry.frames && typeof entry.frames === 'object')
        || (entry.type === 'spritesheet' && entry.frames && typeof entry.frames === 'object');
      if (named && this.textures.exists(key)) registerAtlasFrames(this.textures, key, entry);
    }
    if (!hasUiFrames(this.textures)) buildFallbackUiAtlas(this);
    this.registerAnimations(manifest);
    this.makeBlankTexture();

    services.game = this.game;
    services.data = data;
    services.state = new GameState(data);
    services.input = new Input(this.game);
    services.audio = await createAudio(this);

    this.scene.launch('UI');
    const ui = this.scene.get('UI');
    ui.events.once(Phaser.Scenes.Events.CREATE, () => {
      this.scene.bringToTop('UI');
      this.scene.start('Title');
    });
  }

  /** `<sheet>_<anim>` animations from manifest `anims` (walk/idle loop by default). */
  registerAnimations(manifest) {
    for (const [key, entry] of Object.entries(manifest)) {
      if (entry.type !== 'spritesheet' || !this.textures.exists(key)) continue;
      for (const a of entry.anims || []) {
        const animKey = `${key}_${a.key}`;
        if (this.anims.exists(animKey)) continue;
        const frames = Array.isArray(a.frames) ? a.frames : String(a.frames || '0').trim().split(/\s+/).map(Number);
        const loops = a.repeat !== undefined ? a.repeat : (/^(walk|idle)_/.test(a.key) ? -1 : 0);
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(key, { frames }),
          frameRate: a.fps || 8,
          repeat: loops,
        });
      }
    }
  }

  /** Transparent 16x24 texture for sprite-less (invisible) interactable entities. */
  makeBlankTexture() {
    if (this.textures.exists('__blank')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.generateTexture('__blank', 16, 24);
    g.destroy();
  }
}

/**
 * Create the audio engine from src/audio (if present and Phaser has a WebAudio context),
 * otherwise a silent shim with the same method names.
 */
async function createAudio(scene) {
  const loader = audioLoaders['/src/audio/AudioEngine.js'];
  const sound = scene.sound;
  if (!loader) { console.warn('[boot] src/audio/AudioEngine.js not found; audio disabled'); return makeAudioShim(); }
  if (!sound || !sound.context) { console.warn('[boot] no WebAudio context; audio disabled'); return makeAudioShim(); }
  try {
    const mod = await loader();
    const Engine = mod.AudioEngine || mod.default;
    let audio = null;
    if (Engine && typeof Engine.fromPhaser === 'function') audio = Engine.fromPhaser(sound);
    else if (typeof Engine === 'function') audio = new Engine({ context: sound.context, destination: sound.destination });
    if (!isAudioEngine(audio)) throw new Error('AudioEngine is missing required methods');
    if (PARAMS.mute) audio.mute(true);
    return audio;
  } catch (err) {
    console.warn('[boot] audio engine failed to start; using silent shim:', err && err.message ? err.message : err);
    return makeAudioShim();
  }
}

/**
 * Stand-in `ui` atlas (plain 8x8 pieces drawn with Graphics) so the windowed UI can open before
 * the generated ui.png exists. Runtime only; nothing is written to assets/.
 */
function buildFallbackUiAtlas(scene) {
  console.warn('[boot] generated ui atlas missing; drawing a stand-in');
  const names = [...REQUIRED_FRAMES, 'meter_on', 'meter_off'];
  if (!scene.textures.exists(UI_KEY)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    names.forEach((n, i) => {
      const x = i * 8;
      g.fillStyle(0x182858, 1); g.fillRect(x, 0, 8, 8);
      if (n.startsWith('win_')) {
        g.fillStyle(0xf8f8f8, 1);
        if (n.includes('t')) g.fillRect(x, 0, 8, 1);
        if (n.includes('b')) g.fillRect(x, 7, 8, 1);
        if (n.includes('l')) g.fillRect(x, 0, 1, 8);
        if (n.includes('r')) g.fillRect(x + 7, 0, 1, 8);
      } else if (n === 'cursor' || n === 'arrow_more') {
        g.fillStyle(0xffffff, 1); g.fillRect(x + 2, 2, 4, 4);
      } else if (n === 'meter_on') {
        g.fillStyle(0xffe066, 1); g.fillRect(x + 1, 1, 6, 6);
      }
    });
    g.generateTexture(UI_KEY, names.length * 8, 8);
    g.destroy();
  }
  const frames = {};
  names.forEach((n, i) => { frames[n] = { x: i * 8, y: 0, w: 8, h: 8 }; });
  registerAtlasFrames(scene.textures, UI_KEY, { type: 'atlas', frames });
}
