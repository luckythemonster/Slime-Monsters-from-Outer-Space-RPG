import { TILE_SIZE, SCREEN_W, SCREEN_H, COLORS, MOVE_DELAY } from '../constants.js';
import SaveSystem from '../systems/SaveSystem.js';

const MAP_COLS = 20;
const MAP_ROWS = 11;

const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

export default class TestScene extends Phaser.Scene {
  constructor() {
    super('TestScene');
  }

  init(data) {
    this.startTileX = data?.tileX ?? 2;
    this.startTileY = data?.tileY ?? 2;
  }

  create() {
    this.playerTileX = this.startTileX;
    this.playerTileY = this.startTileY;
    this.moveTimer   = 0;
    this.stepCount   = 0;
    this._nextEncounter = Phaser.Math.Between(4, 8);

    this._drawMap();
    this._spawnPlayer();
    this._setupInput();
    this._drawHUD();

    // Resume callback after BattleScene ends
    this.events.on('resume', () => {
      const result = this.registry.get('lastBattle');
      if (result) {
        this.registry.remove('lastBattle');
        if (result.won) {
          // Auto-save after each victory
          SaveSystem.save(
            this.registry.get('party'),
            'test',
            this.playerTileX,
            this.playerTileY
          );
          this._showNotice(`Saved!  +${result.xp} XP  +${result.gold} gold`);
        }
      }
      this._nextEncounter = Phaser.Math.Between(5, 10);
      this.stepCount = 0;
      this._refreshHUD();
    });
  }

  // ─── map & player rendering ─────────────────────────────────────────────

  _drawMap() {
    const gfx = this.add.graphics();
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        gfx.fillStyle(MAP[row][col] === 1 ? COLORS.WALL : COLORS.FLOOR);
        gfx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }
  }

  _spawnPlayer() {
    this.playerGfx = this.add.graphics();
    this._drawPlayer();
  }

  _drawPlayer() {
    const px = this.playerTileX * TILE_SIZE + 1;
    const py = this.playerTileY * TILE_SIZE + 1;
    this.playerGfx.clear();
    this.playerGfx.fillStyle(COLORS.PLAYER);
    this.playerGfx.fillRoundedRect(px, py, TILE_SIZE - 2, TILE_SIZE - 2, 3);
    this.playerGfx.fillStyle(0x000000);
    this.playerGfx.fillRect(px + 3, py + 4, 2, 2);
    this.playerGfx.fillRect(px + 9, py + 4, 2, 2);
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────

  _drawHUD() {
    this.hudGfx  = this.add.graphics();
    this.hudText = this.add.text(2, SCREEN_H - 12, '', {
      font: '6px monospace', color: '#aaaaaa',
    });
    this.noticeText = this.add.text(SCREEN_W / 2, SCREEN_H - 22, '', {
      font: '6px monospace', color: '#00ff88',
    }).setOrigin(0.5);
    this._refreshHUD();
  }

  _refreshHUD() {
    const party = this.registry.get('party');
    if (!party) return;
    const m = party.members[0];
    this.hudText.setText(`${m.name} Lv${m.level}  HP:${m.hp}/${m.maxHp}  Gold:${party.gold}  [S=save]`);
  }

  _showNotice(msg, duration = 2000) {
    this.noticeText.setText(msg);
    if (this._noticeTimer) this._noticeTimer.remove();
    this._noticeTimer = this.time.delayedCall(duration, () => this.noticeText.setText(''));
  }

  // ─── input ──────────────────────────────────────────────────────────────

  _setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.saveKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
    // S key also saves
    this.input.keyboard.on('keydown-S', () => this._manualSave());
    this.input.keyboard.on('keydown-F5', () => this._manualSave());
  }

  _manualSave() {
    const ok = SaveSystem.save(
      this.registry.get('party'),
      'test',
      this.playerTileX,
      this.playerTileY
    );
    this._showNotice(ok ? 'Game saved!' : 'Save failed!');
  }

  // ─── update loop ────────────────────────────────────────────────────────

  update(time, delta) {
    this.moveTimer -= delta;
    if (this.moveTimer > 0) return;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  dx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) dx =  1;
    else if (this.cursors.up.isDown    || this.wasd.up.isDown)    dy = -1;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  dy =  1;
    if (!dx && !dy) return;

    const nx = this.playerTileX + dx;
    const ny = this.playerTileY + dy;
    if (ny >= 0 && ny < MAP_ROWS && nx >= 0 && nx < MAP_COLS && MAP[ny][nx] === 0) {
      this.playerTileX = nx;
      this.playerTileY = ny;
      this._drawPlayer();
      this.moveTimer = MOVE_DELAY;
      this.stepCount++;
      if (this.stepCount >= this._nextEncounter) {
        this._triggerBattle();
      }
    }
  }

  // ─── battle trigger ─────────────────────────────────────────────────────

  _triggerBattle() {
    this.stepCount = 0;
    this._nextEncounter = Phaser.Math.Between(4, 8);

    const enemies    = this.registry.get('enemies');
    const abilities  = this.registry.get('abilities');
    const party      = this.registry.get('party');
    const enemyDef   = enemies[Math.floor(Math.random() * enemies.length)];

    this.scene.launch('BattleScene', {
      enemies:     [enemyDef],
      party,
      abilities,
      resumeScene: 'TestScene',
    });
    this.scene.pause('TestScene');
  }
}
