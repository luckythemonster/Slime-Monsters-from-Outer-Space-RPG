import { TILE_SIZE, SCREEN_W, SCREEN_H, COLORS, MOVE_DELAY } from '../constants.js';

const MAP_COLS = 20;
const MAP_ROWS = 11;

// 0 = floor, 1 = wall
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
    this.playerTileX = 2;
    this.playerTileY = 2;
    this.moveTimer = 0;
    this.moving = false;
  }

  create() {
    this._drawMap();
    this._spawnPlayer();
    this._setupInput();
    this._addLabel();
  }

  _drawMap() {
    this.tileGraphics = this.add.graphics();
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const isWall = MAP[row][col] === 1;
        this.tileGraphics.fillStyle(isWall ? COLORS.WALL : COLORS.FLOOR);
        this.tileGraphics.fillRect(
          col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1
        );
      }
    }
  }

  _spawnPlayer() {
    const px = this.playerTileX * TILE_SIZE + 1;
    const py = this.playerTileY * TILE_SIZE + 1;
    this.playerGraphic = this.add.graphics();
    this._drawPlayer(px, py);
  }

  _drawPlayer(px, py) {
    this.playerGraphic.clear();
    this.playerGraphic.fillStyle(COLORS.PLAYER);
    this.playerGraphic.fillRect(px, py, TILE_SIZE - 2, TILE_SIZE - 2);
    // simple "eyes"
    this.playerGraphic.fillStyle(COLORS.BLACK);
    this.playerGraphic.fillRect(px + 3, py + 4, 2, 2);
    this.playerGraphic.fillRect(px + 9, py + 4, 2, 2);
  }

  _setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  _addLabel() {
    this.add.text(4, SCREEN_H - 14, 'SLIME MONSTERS FROM OUTER SPACE — Phase 0', {
      font: '6px monospace',
      color: '#ffffff',
    });
  }

  update(time, delta) {
    this.moveTimer -= delta;
    if (this.moveTimer > 0) return;

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown  || this.wasd.left.isDown)  dx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) dx =  1;
    else if (this.cursors.up.isDown    || this.wasd.up.isDown)    dy = -1;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  dy =  1;

    if (dx === 0 && dy === 0) return;

    const nx = this.playerTileX + dx;
    const ny = this.playerTileY + dy;

    if (ny >= 0 && ny < MAP_ROWS && nx >= 0 && nx < MAP_COLS && MAP[ny][nx] === 0) {
      this.playerTileX = nx;
      this.playerTileY = ny;
      this._drawPlayer(nx * TILE_SIZE + 1, ny * TILE_SIZE + 1);
      this.moveTimer = MOVE_DELAY;
    }
  }
}
