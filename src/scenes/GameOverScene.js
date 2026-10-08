// GameOverScene: text, then confirm (or a timeout) returns to Title.
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { audioCall } from '../engine/Audio.js';
import { PIXEL_FONT, WIDTH, HEIGHT, scaleMs } from '../config.js';

const FONT = { fontFamily: PIXEL_FONT, fontSize: '8px', color: '#ffffff', resolution: 1, align: 'center' };

export default class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOver' }); }

  init(data) {
    this.message = (data && data.text) || 'The band broke up.';
    this.ready = false;
    this.done = false;
  }

  create() {
    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 1).setOrigin(0, 0);
    this.add.text(WIDTH / 2, 80, 'GAME OVER', { ...FONT, color: '#ff5a5a' }).setOrigin(0.5, 0);
    this.add.text(WIDTH / 2, 110, this.message, { ...FONT, wordWrap: { width: 224 } }).setOrigin(0.5, 0);
    audioCall('stopMusic', { fade: 0.5 });
    audioCall('sfx', 'ko');
    services.ui.fade('in', scaleMs(300));
    this.time.delayedCall(scaleMs(800), () => { this.ready = true; });
    this.time.delayedCall(scaleMs(6000), () => this.toTitle());
  }

  update() {
    if (this.ready && (services.input.justPressed('confirm') || services.input.justPressed('cancel'))) this.toTitle();
  }

  toTitle() {
    if (this.done) return;
    this.done = true;
    services.input.consume();
    this.scene.start('Title');
  }
}
