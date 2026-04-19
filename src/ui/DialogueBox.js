// Simple dialogue window — bottom strip of the screen
const BOX_Y = 112;
const BOX_H = 66;

export default class DialogueBox {
  constructor(scene) {
    this.scene       = scene;
    this.gfx         = scene.add.graphics();
    this.speakerText = scene.add.text(8, BOX_Y + 4, '', { font: '7px monospace', color: '#ffff88' });
    this.bodyText    = scene.add.text(8, BOX_Y + 14, '', {
      font: '7px monospace',
      color: '#ffffff',
      wordWrap: { width: 302 },
    });
    this.promptText  = scene.add.text(306, BOX_Y + BOX_H - 10, '▼', { font: '6px monospace', color: '#aaaaff' });
    this.hide();
  }

  show(text, speaker = '') {
    this.gfx.clear();
    this.gfx.fillStyle(0x000022);
    this.gfx.fillRect(2, BOX_Y, 316, BOX_H);
    this.gfx.lineStyle(1, 0x4488cc);
    this.gfx.strokeRect(2, BOX_Y, 316, BOX_H);

    this.speakerText.setText(speaker);
    this.bodyText.setText(text);

    this.gfx.setVisible(true);
    this.speakerText.setVisible(true);
    this.bodyText.setVisible(true);
    this.promptText.setVisible(true);
  }

  hide() {
    this.gfx.setVisible(false);
    this.speakerText.setVisible(false);
    this.bodyText.setVisible(false);
    this.promptText.setVisible(false);
  }

  destroy() {
    this.gfx.destroy();
    this.speakerText.destroy();
    this.bodyText.destroy();
    this.promptText.destroy();
  }
}
