// Entry: Phaser.Game config + scene list; installs the debug API (window.__slime).
import Phaser from 'phaser';
import { captureErrors, installDebug } from './engine/Debug.js';
import { WIDTH, HEIGHT, PIXEL_FONT } from './config.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import ExploreScene from './scenes/ExploreScene.js';
import BattleScene from './scenes/BattleScene.js';
import MenuScene from './scenes/MenuScene.js';
import FreefallScene from './scenes/FreefallScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import UIScene from './scenes/UIScene.js';

captureErrors();

export const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#101018',

  // Rounded pixel art (Phaser 4 Pixel Art Guide): pixelArt sets antialias false; roundPixels is
  // repeated explicitly because its v4 default is false.
  pixelArt: true,
  roundPixels: true,

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // `zoom` is ignored by FIT in v4; `snap` floors the display size to whole multiples of 256x224
    // so the canvas is always integer-scaled; `min` stops it snapping to 0x0 in a tiny viewport.
    snap: { width: WIDTH, height: HEIGHT },
    min: { width: WIDTH, height: HEIGHT },
  },

  // UI is last so it always renders on top (scene array order = render order).
  scene: [BootScene, TitleScene, ExploreScene, BattleScene, MenuScene, FreefallScene, GameOverScene, UIScene],
};

async function waitForPixelFont() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
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
  installDebug(game);
});
