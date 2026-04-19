// Phase 3: pause menu — party stats, items, equipment, save/load
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // placeholder — full implementation in Phase 3
    this.input.keyboard.once('keydown-ESC', () => {
      this.scene.stop();
      this.scene.resume('TestScene');
    });
  }
}
