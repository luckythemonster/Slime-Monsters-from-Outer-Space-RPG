import PartySystem  from '../systems/PartySystem.js';
import EventSystem  from '../systems/EventSystem.js';
import SaveSystem   from '../systems/SaveSystem.js';

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
    this.add.text(w / 2, 28, 'SLIME MONSTERS', {
      font: '18px monospace', color: '#00ff88',
    }).setOrigin(0.5);

    this.add.text(w / 2, 50, 'FROM OUTER SPACE', {
      font: '18px monospace', color: '#00cc66',
    }).setOrigin(0.5);

    this.add.text(w / 2, 72, 'R P G', {
      font: '13px monospace', color: '#44aaff',
    }).setOrigin(0.5);

    this._slime = this.add.graphics();
    this._drawSlime(w / 2, 94);
    this.tweens.add({
      targets: this._slime,
      y: 4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  _drawSlime(x, y) {
    this._slime.fillStyle(0xff44aa);
    this._slime.fillEllipse(x, y, 22, 14);
    this._slime.fillStyle(0x000000);
    this._slime.fillRect(x - 5, y - 3, 3, 3);
    this._slime.fillRect(x + 2, y - 3, 3, 3);
  }

  _drawMenu(w, h) {
    this._menuTexts = [];
    this._options.forEach((label, i) => {
      const my     = 118 + i * 18;
      const active = i === 0 || this._hasSave;
      const color  = active ? '#ffffff' : '#444466';

      const txt = this.add.text(w / 2, my, label, {
        font: '10px monospace', color,
      }).setOrigin(0.5);

      if (active) {
        txt.setInteractive({ useHandCursor: true });
        txt.on('pointerdown', () => this._select(i));
        txt.on('pointerover', () => { this._cursor = i; this._refreshCursor(); });
      }
      this._menuTexts.push(txt);
    });

    this._cursor = 0;
    this._refreshCursor();

    this.add.text(w / 2, 168, 'arrow keys + Z  |  tap to select', {
      font: '8px monospace', color: '#334455',
    }).setOrigin(0.5);
  }

  _refreshCursor() {
    this._menuTexts.forEach((t, i) => {
      const active = i === 0 || this._hasSave;
      if (!active) return;
      const sel = i === this._cursor;
      t.setColor(sel ? '#00ff88' : '#ffffff');
      t.setText(sel ? `► ${this._options[i]}` : `  ${this._options[i]}`);
    });
  }

  _setupInput() {
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.zKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
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

  _select(i) {
    if (i === 0)                   this._newGame();
    else if (i === 1 && this._hasSave) this._continue();
  }

  _newGame() {
    const characters = this.registry.get('characters');
    this.registry.set('party',  new PartySystem(characters));
    this.registry.set('events', new EventSystem());
    // Start Episode 0 opening cutscene over the title screen
    this.scene.launch('DialogueScene', { dialogueId: 'ep0_intro', returnScene: 'TitleScene' });
    this.scene.pause('TitleScene');
  }

  _continue() {
    const save = SaveSystem.load();
    if (!save) { this._newGame(); return; }

    const characters = this.registry.get('characters');
    const equipDefs  = this.registry.get('equipment') ?? [];
    const party      = new PartySystem(characters);
    party.deserialize(save.party, equipDefs);
    this.registry.set('party', party);

    const events = new EventSystem();
    if (save.events) events.deserialize(save.events);
    this.registry.set('events', events);

    this.scene.start('ExploreScene', {
      mapId: save.mapId ?? 'ep0_alley',
      tileX: save.tileX ?? 10,
      tileY: save.tileY ?? 5,
    });
  }
}
