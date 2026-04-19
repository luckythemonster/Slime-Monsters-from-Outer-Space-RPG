import BootScene from './scenes/BootScene.js';
import TestScene from './scenes/TestScene.js';
import { SCREEN_W, SCREEN_H, ZOOM } from './constants.js';

const config = {
  type: Phaser.AUTO,
  width: SCREEN_W,
  height: SCREEN_H,
  zoom: ZOOM,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#000000',
  scene: [BootScene, TestScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
