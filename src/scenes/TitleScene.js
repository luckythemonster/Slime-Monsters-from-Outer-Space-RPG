import PartySystem from '../systems/PartySystem.js';
import SaveSystem  from '../systems/SaveSystem.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
    this._cursor  = 0;
    this._options = ['NEW GAME', 'CONTINUE'];
  }

  create() {
    const { width, height } = this.scale;
    this._hasSave = SaveSystem.exists();

    this._drawStars();
    this._drawTitle(width, height);
    this._drawMenu(width, height);
    this._setupInput();
  }

  _drawStars() {
    const gfx = this.add.graphics();
    for (let i = 0; i < 80; i++) {
      const x = Phaser.Math.Between(0, 320);
      const y = Phaser.Math.Between(0, 180);
      const b = Phaser.Math.Between(100, 255);
      gfx.fillStyle(Phaser.Display.Color.GetColor(b, b, b));
      gfx.fillRect(x, y, 1, 1);
    }
  }

  _drawTitle(w, h) {
    this.add.text(w / 2, 30, 'SLIME MONSTERS', {
      font: '16px monospace', color: '#00ff88',
    }).setOrigin(0.5);

    this.add.text(w / 2, 50, 'FROM OUTER SPACE', {
      font: '16px monospace', color: '#00cc66',
    }).setOrigin(0.5);

    this.add.text(w / 2, 70, 'R P G', {
      font: '10px monospace', color: '#44aaff',
    }).setOrigin(0.5);

    // animated slime decoration
    this._slime = this.add.graphics();
    this._drawSlime(w / 2, 92, 0x00cc66);
    this._slimeTween = this.tweens.add({
      targets: this._slime,
      y: 4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  _drawSlime(x, y, color) {
    this._slime.fillStyle(color);
    this._slime.fillEllipse(x, y, 20, 14);
    this._slime.fillStyle(0x000000);
    this._slime.fillRect(x - 5, y - 3, 3, 3);
    this._slime.fillRect(x + 2, y - 3, 3, 3);
  }

  _drawMenu(w, h) {
    this._menuTexts = [];
    this._options.forEach((label, i) => {
      const my      = 120 + i * 18;
      const canUse  = i === 0 || this._hasSave;
      const color   = canUse ? '#ffffff' : '#555555';
      const txt     = this.add.text(w / 2, my, label, {
        font: '8px monospace', color,
      }).setOrigin(0.5);

      if (canUse) {
        txt.setInteractive({ useHandCursor: true });
        txt.on('pointerdown', () => this._select(i));
        txt.on('pointerover',  () => { this._cursor = i; this._refreshCursor(); });
      }
      this._menuTexts.push(txt);
    });

    this._cursor = 0;
    this._refreshCursor();

    this.add.text(w / 2, 168, 'arrow keys + Z  |  tap to select', {
      font: '6px monospace', color: '#446688',
    }).setOrigin(0.5);
  }

  _refreshCursor() {
    this._menuTexts.forEach((t, i) => {
      const canUse = i === 0 || this._hasSave;
      if (!canUse) return;
      const selected = i === this._cursor;
      t.setColor(selected ? '#00ff88' : '#ffffff');
      t.setText(selected ? `► ${this._options[i]}` : `  ${this._options[i]}`);
    });
  }

  _setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.zKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this._cursor = Math.max(0, this._cursor - 1);
      this._refreshCursor();
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this._cursor = Math.min(this._options.length - 1, this._cursor + 1);
      this._refreshCursor();
    } else if (
      Phaser.Input.Keyboard.JustDown(this.zKey) ||
      Phaser.Input.Keyboard.JustDown(this.enterKey)
    ) {
      this._select(this._cursor);
    }
  }

  _select(index) {
    if (index === 0) {
      this._newGame();
    } else if (index === 1 && this._hasSave) {
      this._continue();
    }
  }

  _newGame() {
    const characters = this.registry.get('characters');
    this.registry.set('party', new PartySystem(characters));
    this.scene.start('TestScene', { mapId: 'test', tileX: 2, tileY: 2 });
  }

  _continue() {
    const save = SaveSystem.load();
    if (!save) { this._newGame(); return; }

    const characters = this.registry.get('characters');
    const party      = new PartySystem(characters);
    party.deserialize(save.party);
    this.registry.set('party', party);

    this.scene.start('TestScene', {
      mapId: save.mapId ?? 'test',
      tileX: save.tileX ?? 2,
      tileY: save.tileY ?? 2,
    });
  }
}
