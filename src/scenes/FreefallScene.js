// FreefallScene PLACEHOLDER: shows "FREEFALL" for a second and calls back.
// Launched by ExploreScene.runSpecialScene('Freefall', data) → launch('Freefall', { ...data, onDone }).
// The real cutscene replaces this file; it must keep calling onDone() and stopping itself.
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { PARAMS } from '../config.js';

export default class FreefallScene extends Phaser.Scene {
  constructor() { super({ key: 'Freefall' }); }

  init(data) {
    this.onDone = data && data.onDone;
    this.payload = data || {};
  }

  async create() {
    await services.ui.caption('FREEFALL', PARAMS.fast ? 100 : 1000);
    const cb = this.onDone;
    this.scene.stop();
    if (cb) cb();
  }
}
