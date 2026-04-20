export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    this.add.text(width / 2, height / 2 - 30, 'GAME OVER', {
      font: '24px monospace', color: '#cc2222',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2, 'The slimes have fallen...', {
      font: '9px monospace', color: '#888888',
    }).setOrigin(0.5);

    const retry = this.add.text(width / 2, height / 2 + 25, '► RETRY', {
      font: '10px monospace', color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    retry.on('pointerdown', () => this.scene.start('TitleScene'));

    this.input.keyboard.once('keydown', () => this.scene.start('TitleScene'));
  }
}
