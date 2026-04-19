import PartySystem from '../systems/PartySystem.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this._drawLoadingBar();
    this.load.json('characters', 'src/data/characters.json');
    this.load.json('enemies',    'src/data/enemies.json');
    this.load.json('abilities',  'src/data/abilities.json');
    this.load.json('items',      'src/data/items.json');
  }

  create() {
    // Store raw data in global registry so all scenes can access it
    const characters = this.cache.json.get('characters');
    this.registry.set('characters', characters);
    this.registry.set('enemies',    this.cache.json.get('enemies'));
    this.registry.set('abilities',  this.cache.json.get('abilities'));
    this.registry.set('items',      this.cache.json.get('items'));

    // Create a fresh party (TitleScene will restore from save if Continue is chosen)
    this.registry.set('party', new PartySystem(characters));

    this.scene.start('TitleScene');
  }

  _drawLoadingBar() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add.text(cx, cy - 20, 'LOADING...', {
      font: '8px monospace', color: '#ffffff',
    }).setOrigin(0.5);

    const barBg  = this.add.rectangle(cx, cy, 160, 8, 0x333333).setOrigin(0.5);
    const barFill = this.add.rectangle(cx - 80, cy, 0, 6, 0x4488cc).setOrigin(0, 0.5);

    this.load.on('progress', v => {
      barFill.width = Math.floor(160 * v);
    });
  }
}
