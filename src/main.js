import Phaser from 'phaser';

// SNES internal resolution (256x224). Everything in the game is authored at this size and the
// canvas is scaled up by whole-number multiples by the browser (see the `scale` config below).
export const GAME_WIDTH = 256;
export const GAME_HEIGHT = 224;

// Font family names containing digits must be double-quoted inside the string for Canvas fillText.
export const PIXEL_FONT = '"Press Start 2P"';

// 16x16 pink slime blob, authored as a pixel map so the generated texture is crisp
// (no anti-aliased ellipse edges, no colours outside the palette).
const SLIME_PALETTE = {
  P: 0xff5fa8, // body
  L: 0xffb3d9, // highlight
  D: 0xb8286e, // shade / mouth
  K: 0x1a0a14, // eyes
  W: 0xffffff, // eye glint
};

const SLIME_ROWS = [
  '................',
  '................',
  '......PPPP......',
  '....PPPPPPPP....',
  '...PLLPPPPPPP...',
  '..PPLPPPPPPPPP..',
  '..PPPPPPPPPPPP..',
  '.PPPPPPPPPPPPPP.',
  '.PPPKKPPPPKKPPP.',
  '.PPPKWPPPPKWPPP.',
  '.PPPPPPPPPPPPPP.',
  '.PPPPPPDDDPPPPP.',
  '.PPPPPPPPPPPPPP.',
  '.PPPPPPPPPPPPPD.',
  '..DDDDDDDDDDDD..',
  '................',
];

export class SmokeScene extends Phaser.Scene {
  constructor() {
    super('SmokeScene');
  }

  create() {
    this.createSlimeTexture('slime');

    // Sprite origin is (0.5, 0.5); the texture is 16x16 so the top-left lands on an integer.
    const slime = this.add.sprite(64, 128, 'slime');

    // Position-only tween: with pixelArt/roundPixels the renderer snaps the sprite to the pixel grid
    // each frame (vertexRoundMode 'safeAuto'), so the blob never blurs while it moves.
    this.tweens.add({
      targets: slime,
      x: GAME_WIDTH - 64,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    const label = this.add.text(0, 0, 'SLIME MONSTERS', {
      fontFamily: PIXEL_FONT,
      fontSize: '8px',
      color: '#ffffff',
      resolution: 1,
    });

    // Keep the Text origin at (0, 0) and its position on whole pixels for maximum legibility
    // (Pixel Art Guide recommendation for text under `pixelArt`).
    label.setOrigin(0, 0);
    label.setPosition(Math.round((GAME_WIDTH - label.width) / 2), 48);

    const renderer = this.sys.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas';

    window.__smoke = {
      ready: true,
      renderer,
      phaser: Phaser.VERSION,
      fontLoaded: typeof document.fonts?.check === 'function' ? document.fonts.check(`8px ${PIXEL_FONT}`) : null,
    };
  }

  createSlimeTexture(key) {
    if (this.textures.exists(key)) {
      return;
    }

    const size = SLIME_ROWS.length;
    const gfx = this.make.graphics({ x: 0, y: 0 }, false);

    for (let y = 0; y < size; y++) {
      const row = SLIME_ROWS[y];

      for (let x = 0; x < row.length; x++) {
        const color = SLIME_PALETTE[row[x]];

        if (color !== undefined) {
          gfx.fillStyle(color, 1);
          gfx.fillRect(x, y, 1, 1);
        }
      }
    }

    // generateTexture bakes the command buffer into a CanvasTexture; with pixelArt: true the
    // TextureManager uploads it with NEAREST filtering.
    gfx.generateTexture(key, size, size);
    gfx.destroy();
  }
}

export const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#101018',

  // Rounded pixel art (Phaser 4 Pixel Art Guide): pixelArt sets antialias/antialiasGL false and
  // roundPixels true; roundPixels is repeated explicitly because its v4 default is false.
  pixelArt: true,
  roundPixels: true,

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // `zoom` is ignored by FIT in v4 (it only applies to Scale.NONE), so integer scaling is done
    // with `snap`: the display size is floored to a multiple of 256x224, i.e. 1x, 2x, 3x ... and
    // it is re-snapped automatically whenever the window resizes. `min` stops the canvas from
    // snapping down to 0x0 in a viewport smaller than one game screen.
    snap: { width: GAME_WIDTH, height: GAME_HEIGHT },
    min: { width: GAME_WIDTH, height: GAME_HEIGHT },
  },

  scene: [SmokeScene],
};

async function waitForPixelFont() {
  if (typeof document === 'undefined' || !document.fonts?.load) {
    return;
  }

  try {
    // Phaser Text renders through Canvas fillText and does not load web fonts itself, so block
    // briefly on the font; a missing/slow font falls back to the system monospace after 3s.
    await Promise.race([
      document.fonts.load(`8px ${PIXEL_FONT}`),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // Keep going with the fallback font.
  }
}

waitForPixelFont().then(() => {
  const game = new Phaser.Game(config);

  window.__game = game;
});
