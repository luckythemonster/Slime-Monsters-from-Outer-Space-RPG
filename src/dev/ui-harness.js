// Development harness for the UI layer (served by Vite at /tests/ui-harness.html).
// Boots a 256x224 Phaser game (same config as src/main.js), loads the generated `ui` atlas from
// assets/generated/manifest.json + ui.png (and portraits.png when the manifest lists it), launches
// UIScene and exposes window.__uih for tests/ui.mjs. `?demo=1` runs a scripted tour of every
// widget; `?fallback=1` skips the asset files and builds a temporary Graphics-drawn atlas instead
// (used only while the art agent's assets do not exist yet; nothing is written to assets/).
import Phaser from 'phaser';
import UIScene from '../scenes/UIScene.js';
import { services } from '../engine/services.js';
import { UI_KEY, PORTRAIT_KEY, findManifestEntry, registerAtlasFrames, hasUiFrames } from '../ui/atlas.js';

export const GAME_WIDTH = 256;
export const GAME_HEIGHT = 224;
export const PIXEL_FONT = '"Press Start 2P"';

const params = new URLSearchParams(window.location.search);
const USE_FALLBACK = params.get('fallback') === '1';
const RUN_DEMO = params.get('demo') === '1';
const AUTO = params.get('auto') === '1'; // demo without a human: instant text + auto-advance
const ASSET_BASE = '/assets/generated/';

// ---------------------------------------------------------------------------------------------
// Temporary stand-in atlas (harness only). 8x8 pixel maps in the FF6 palette family.
// ---------------------------------------------------------------------------------------------

const PAL = {
  K: 0x141018, // outline
  W: 0xf8f8f8, // white line
  D: 0x203060, // dark inner line
  F: 0x182858, // fill
  G: 0x8c8ca0, // gray
  Y: 0xffe066, // meter on
  O: 0x30304a, // meter off
  P: 0xff5fd2, // slime pink
  L: 0xffb3d9,
  M: 0xb8286e,
  S: 0xf0f0f0, // eye glint
};

const PIECES = {
  win_tl: ['KKKKKKKK', 'KWWWWWWW', 'KWDDDDDD', 'KWDFFFFF', 'KWDFFFFF', 'KWDFFFFF', 'KWDFFFFF', 'KWDFFFFF'],
  win_t: ['KKKKKKKK', 'WWWWWWWW', 'DDDDDDDD', 'FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF'],
  win_l: ['KWDFFFFF', 'KWDFFFFF', 'KWDFFFFF', 'KWDFFFFF', 'KWDFFFFF', 'KWDFFFFF', 'KWDFFFFF', 'KWDFFFFF'],
  win_c: ['FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF', 'FFFFFFFF'],
  cursor: ['..KK....', '.KWWK...', '.KWWKKK.', 'KKWWWWWK', 'KWWWWWWK', 'KKWWWWWK', '.KWWWWK.', '..KKKK..'],
  arrow_more: ['........', '........', 'KKKKKKK.', 'KWWWWWK.', '.KWWWK..', '..KWK...', '...K....', '........'],
  meter_on: ['KKKKKKKK', 'KYYYYYYK', 'KYYYYYYK', 'KYYYYYYK', 'KYYYYYYK', 'KYYYYYYK', 'KYYYYYYK', 'KKKKKKKK'],
  meter_off: ['KKKKKKKK', 'KOOOOOOK', 'KOOOOOOK', 'KOOOOOOK', 'KOOOOOOK', 'KOOOOOOK', 'KOOOOOOK', 'KKKKKKKK'],
};

const flipH = (rows) => rows.map((r) => r.split('').reverse().join(''));
const flipV = (rows) => rows.slice().reverse();
PIECES.win_tr = flipH(PIECES.win_tl);
PIECES.win_bl = flipV(PIECES.win_tl);
PIECES.win_br = flipV(flipH(PIECES.win_tl));
PIECES.win_b = flipV(PIECES.win_t);
PIECES.win_r = flipH(PIECES.win_l);

const SLIME_ROWS = [
  '................', '................', '......PPPP......', '....PPPPPPPP....', '...PLLPPPPPPP...',
  '..PPLPPPPPPPPP..', '..PPPPPPPPPPPP..', '.PPPPPPPPPPPPPP.', '.PPPKKPPPPKKPPP.', '.PPPKSPPPPKSPPP.',
  '.PPPPPPPPPPPPPP.', '.PPPPPPMMMPPPPP.', '.PPPPPPPPPPPPPP.', '.PPPPPPPPPPPPPM.', '..MMMMMMMMMMMM..', '................',
];

function drawRows(gfx, rows, ox, oy, scale = 1) {
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const c = PAL[rows[y][x]];
      if (c === undefined) continue;
      gfx.fillStyle(c, 1);
      gfx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}

/** Build a stand-in `ui` atlas (one 8x8 piece per 8 px column) and a `portraits` sheet. */
export function buildFallbackAtlas(scene) {
  const names = Object.keys(PIECES);
  if (!scene.textures.exists(UI_KEY)) {
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    names.forEach((n, i) => drawRows(gfx, PIECES[n], i * 8, 0));
    gfx.generateTexture(UI_KEY, names.length * 8, 8);
    gfx.destroy();
  }
  const frames = {};
  names.forEach((n, i) => { frames[n] = { x: i * 8, y: 0, w: 8, h: 8 }; });
  registerAtlasFrames(scene.textures, UI_KEY, { type: 'atlas', frames });
}

export function buildFallbackPortraits(scene) {
  if (scene.textures.exists(PORTRAIT_KEY)) return;
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(PAL.D, 1);
  gfx.fillRect(0, 0, 32, 32);
  drawRows(gfx, SLIME_ROWS, 0, 0, 2);
  gfx.generateTexture(PORTRAIT_KEY, 32, 32);
  gfx.destroy();
  registerAtlasFrames(scene.textures, PORTRAIT_KEY, { frames: { lucky: { x: 0, y: 0, w: 32, h: 32 } } });
}

// ---------------------------------------------------------------------------------------------

class HarnessScene extends Phaser.Scene {
  constructor() {
    super('Harness');
  }

  preload() {
    if (USE_FALLBACK) return;
    this.load.json('manifest', `${ASSET_BASE}manifest.json`);
    this.load.image(UI_KEY, `${ASSET_BASE}ui.png`);
    // Only request portraits.png when the manifest says it exists (a 404 would be a console error).
    this.load.once('filecomplete-json-manifest', (_key, _type, data) => {
      const entry = findManifestEntry(data, PORTRAIT_KEY);
      if (entry) this.load.image(PORTRAIT_KEY, `${ASSET_BASE}${entry.image || entry.file || entry.png || 'portraits.png'}`);
    });
  }

  create() {
    this.atlasSource = 'fallback';
    if (!USE_FALLBACK) {
      const manifest = this.cache.json.get('manifest');
      const uiEntry = findManifestEntry(manifest, UI_KEY);
      registerAtlasFrames(this.textures, UI_KEY, uiEntry);
      const pEntry = findManifestEntry(manifest, PORTRAIT_KEY);
      if (pEntry) registerAtlasFrames(this.textures, PORTRAIT_KEY, pEntry);
      if (hasUiFrames(this.textures)) this.atlasSource = 'generated';
    }
    if (this.atlasSource === 'fallback') {
      buildFallbackAtlas(this);
    }
    if (!this.textures.exists(PORTRAIT_KEY)) buildFallbackPortraits(this);

    this.drawBackdrop();

    const ui = this.scene.get('UI');
    ui.events.once(Phaser.Scenes.Events.CREATE, () => this.onUiReady());
    this.scene.launch('UI');
  }

  /** A fake overworld so the windows have something to sit on top of. */
  drawBackdrop() {
    const g = this.add.graphics();
    g.fillStyle(0x3050a0, 1);
    g.fillRect(0, 0, 256, 224);
    g.fillStyle(0xe8ecf4, 1);
    g.fillRect(0, 144, 256, 80); // snow
    g.fillStyle(0x6c3a28, 1);
    g.fillRect(24, 64, 80, 80); // brick building
    g.fillStyle(0xffe066, 1);
    for (let i = 0; i < 3; i++) g.fillRect(36 + i * 24, 80, 12, 14);
    g.fillStyle(0x203060, 1);
    g.fillRect(160, 96, 64, 48);
    g.fillStyle(0xd8dce8, 1);
    for (let x = 0; x < 256; x += 16) for (let y = 144; y < 224; y += 16) if (((x + y) / 16) % 2 === 0) g.fillRect(x, y, 16, 16);
    const gfx = this.make.graphics({ x: 0, y: 0 }, false);
    drawRows(gfx, SLIME_ROWS, 0, 0, 1);
    gfx.generateTexture('harness_slime', 16, 16);
    gfx.destroy();
    this.add.image(120, 128, 'harness_slime').setOrigin(0, 0);
  }

  onUiReady() {
    const ui = services.ui;
    const api = {
      ready: true,
      ui,
      game: this.game,
      atlas: this.atlasSource,
      renderer: this.sys.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas',
      phaser: Phaser.VERSION,
      fontLoaded: typeof document.fonts?.check === 'function' ? document.fonts.check(`8px ${PIXEL_FONT}`) : null,
      pending: null,
      /** Start a UI call without awaiting it; the result lands in __uih.pending. */
      start(method, ...args) {
        const rec = { method, done: false, value: undefined, error: null, t0: performance.now(), t1: 0 };
        api.pending = rec;
        Promise.resolve()
          .then(() => ui[method](...args))
          .then((v) => { rec.value = v; }, (e) => { rec.error = String(e && e.stack ? e.stack : e); })
          .finally(() => { rec.done = true; rec.t1 = performance.now(); });
        return rec;
      },
      /** Run a list of [method, ...args] steps sequentially; resolves with their results. */
      async run(steps) {
        const out = [];
        for (const [method, ...args] of steps) out.push(await ui[method](...args));
        return out;
      },
      state: () => ui.debugState(),
    };
    window.__uih = api;
    if (AUTO) {
      ui.setTextInstant(true);
      ui.setAutoAdvance(true);
    }
    if (RUN_DEMO) {
      api.demoDone = false;
      this.runDemo(ui).then(() => { api.demoDone = true; }, (e) => { api.demoError = String(e && e.stack ? e.stack : e); api.demoDone = true; });
    }
  }

  async runDemo(ui) {
    await ui.say({
      who: 'lucky',
      name: 'LUCKY',
      portrait: 'lucky',
      text: 'Hey! This is {color:pink}Lucky{/color}, the slime from outer space.{pause:300} I am here to start a {shake}PUNK BAND{/shake} in Minneapolis, which means this text has to wrap onto a second page.',
    });
    await ui.say({ who: 'ryan_caption', text: "Ryan's internal caption, neat and square: 'Note to self. Buy drumsticks.'" });
    await ui.say({ who: 'narrator', text: 'The snow kept falling on the West Bank.{speed:slow} Nobody noticed the crater.' });
    const c = await ui.choice(['Yes', 'No', 'Maybe'], { cancelIndex: 1 });
    await ui.toast(`You picked ${c}`);
    const m = await ui.menu([{ label: 'Attack', hint: 'Hit them with the guitar' }, { label: 'Riff', disabled: true, hint: 'Not enough meter' }, { label: 'Item', hint: 'Use a thing' }, { label: 'Run', hint: 'Flee like a coward' }]);
    await ui.toast(`Menu -> ${m}`);
    await ui.caption('ONE MONTH LATER', 1200);
    await ui.fade('out', 400);
    await ui.fade('in', 400);
    await ui.flash(150);
  }
}

export const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#101018',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    snap: { width: GAME_WIDTH, height: GAME_HEIGHT },
    min: { width: GAME_WIDTH, height: GAME_HEIGHT },
  },
  scene: [HarnessScene, UIScene],
};

async function waitForPixelFont() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await Promise.race([
      document.fonts.load(`8px ${PIXEL_FONT}`),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // fall back to the system font
  }
}

waitForPixelFont().then(() => {
  const game = new Phaser.Game(config);
  window.__game = game;
});
