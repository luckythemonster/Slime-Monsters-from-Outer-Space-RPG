// TitleScene: logo + New Game / Continue menu (via the UI service).
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { markReady } from '../engine/Debug.js';
import { audioCall } from '../engine/Audio.js';
import { PIXEL_FONT, WIDTH, PARAMS, FADE_MS, scaleMs } from '../config.js';

const FONT = { fontFamily: PIXEL_FONT, fontSize: '8px', color: '#ffffff', resolution: 1, align: 'center' };

export default class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'Title' }); }

  create() {
    this.closed = false;
    this.cameras.main.setBackgroundColor('#101018');
    this.add.text(WIDTH / 2, 56, 'SLIME MONSTERS\nFROM OUTER SPACE', { ...FONT, color: '#ff5fd2', lineSpacing: 4 }).setOrigin(0.5, 0);
    this.add.text(WIDTH / 2, 96, 'A PUNK ROCK JRPG', { ...FONT, color: '#8c8ca0' }).setOrigin(0.5, 0);
    this.add.text(WIDTH / 2, 208, 'Z/ENTER: CONFIRM  X: CANCEL', { ...FONT, color: '#8c8ca0' }).setOrigin(0.5, 0);
    audioCall('playMusic', 'title', { fade: 0.5 });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.closed = true;
      if (services.ui) services.ui.closeAll();
    });
    markReady(this);
    this.showMenu();
  }

  /** Menu loop: Continue is disabled without a save; cancel does nothing. */
  async showMenu() {
    const state = services.state;
    const slot = PARAMS.slot || 1;
    while (!this.closed) {
      const hasSave = state.hasSave(slot);
      const items = [{ label: 'New Game' }, { label: 'Continue', disabled: !hasSave, hint: hasSave ? `Slot ${slot}` : 'No save' }];
      const idx = await services.ui.menu(items, { x: 128, y: 152, cancelable: false });
      if (this.closed) return;
      if (idx === 0) { state.newGame(); await this.startExplore(); return; }
      if (idx === 1 && hasSave) { state.load(slot); await this.startExplore(); return; }
    }
  }

  async startExplore() {
    audioCall('sfx', 'confirm');
    await services.ui.fade('out', scaleMs(FADE_MS));
    if (this.closed) return;
    this.scene.start('Explore');
  }
}
