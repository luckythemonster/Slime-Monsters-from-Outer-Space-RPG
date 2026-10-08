// BattleScene STUB (ARCHITECTURE §12.4): shows the encounter name and auto-resolves 'win'.
// Launched by ExploreScene.runSub('Battle', { encounterId, encounter, background, onDone }).
// The real battle must keep the contract: call onDone('win'|'lose'|'flee') after its own fade-out
// and stop itself; Explore wakes on onDone and restores its map music.
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { audioCall } from '../engine/Audio.js';
import { PIXEL_FONT, WIDTH, HEIGHT, scaleMs } from '../config.js';

const FONT = { fontFamily: PIXEL_FONT, fontSize: '8px', color: '#ffffff', resolution: 1, align: 'center' };

export default class BattleScene extends Phaser.Scene {
  constructor() { super({ key: 'Battle' }); }

  init(data) {
    this.encounterId = data.encounterId;
    this.encounter = data.encounter || (services.data && services.data.encounters[data.encounterId]) || { name: data.encounterId, enemies: [] };
    this.onDone = data.onDone;
    this.finished = false;
  }

  create() {
    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x202030, 1).setOrigin(0, 0);
    const enemies = services.data ? services.data.enemies : {};
    const names = (this.encounter.enemies || []).map((id) => (enemies[id] && enemies[id].name) || id).join(', ');
    this.add.text(WIDTH / 2, 72, `BATTLE\n\n${this.encounter.name || this.encounterId}\n\n${names}`, FONT).setOrigin(0.5, 0);
    this.add.text(WIDTH / 2, 160, '(stub: auto-win)', { ...FONT, color: '#8c8ca0' }).setOrigin(0.5, 0);
    audioCall('playMusic', this.encounter.music || 'battle', { fade: 0.2 });
    services.ui.fade('in', scaleMs(200));
    this.time.delayedCall(scaleMs(600), () => this.finish('win'));
  }

  /** @param {'win'|'lose'|'flee'} result */
  async finish(result) {
    if (this.finished) return;
    this.finished = true;
    await services.ui.fade('out', scaleMs(200));
    const cb = this.onDone;
    this.scene.stop();
    if (cb) cb(result);
    services.ui.fade('in', scaleMs(200));
  }
}
