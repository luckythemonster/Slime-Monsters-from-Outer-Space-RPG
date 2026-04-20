import BootScene     from './scenes/BootScene.js';
import PreloadScene  from './scenes/PreloadScene.js';
import TitleScene    from './scenes/TitleScene.js';
import ExploreScene  from './scenes/ExploreScene.js';
import TestScene     from './scenes/TestScene.js';
import BattleScene   from './scenes/BattleScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import DialogueScene from './scenes/DialogueScene.js';
import MenuScene     from './scenes/MenuScene.js';
import GlideScene    from './scenes/GlideScene.js';
import { SCREEN_W, SCREEN_H, ZOOM } from './constants.js';

const config = {
  type: Phaser.AUTO,
  width: SCREEN_W,
  height: SCREEN_H,
  zoom: ZOOM,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#000000',
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    ExploreScene,
    BattleScene,
    DialogueScene,
    GameOverScene,
    MenuScene,
    GlideScene,
    TestScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
