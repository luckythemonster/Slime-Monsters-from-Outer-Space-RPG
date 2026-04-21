import { TILE_SIZE, SCREEN_W, SCREEN_H, MOVE_DELAY } from '../constants.js';
import SaveSystem from '../systems/SaveSystem.js';

export default class ExploreScene extends Phaser.Scene {
  constructor() {
    super('ExploreScene');
  }

  init(data) {
    this._mapId  = data.mapId  ?? 'ep0_alley';
    this._startX = data.tileX  ?? 1;
    this._startY = data.tileY  ?? 1;
  }

  create() {
    const mapDef = this.registry.get('maps')?.[this._mapId];
    if (!mapDef) { console.error('Map not found:', this._mapId); return; }

    this._map        = mapDef;
    this._entities   = [];
    this._moveTimer  = 0;
    this._stepCount  = 0;
    this._nextEnc    = Phaser.Math.Between(5, 10);
    this._busy       = false;

    this._renderMap(mapDef);
    this._spawnEntities(mapDef);
    this._spawnPlayer(this._startX, this._startY);
    this._drawHUD();
    this.cameras.main.setBounds(0, 0, mapDef.width * TILE_SIZE, mapDef.height * TILE_SIZE);
    this._setupInput();

    this.events.on('resume', () => this._onResume());
  }

  // ─── map rendering ───────────────────────────────────────────────────────

  _renderMap(mapDef) {
    const colors      = mapDef.tileColors ?? { '0': '#2a3a2a', '1': '#111118', '2': '#1a2a1a', '3': '#2a2218' };
    const tileIndices = mapDef.tileIndices ?? {};
    const hasTileset  = mapDef.tileset && this.textures.exists(mapDef.tileset);

    const gfx = this.add.graphics();
    const rt  = hasTileset
      ? this.add.renderTexture(0, 0, mapDef.width * TILE_SIZE, mapDef.height * TILE_SIZE)
      : null;

    for (let row = 0; row < mapDef.height; row++) {
      for (let col = 0; col < mapDef.width; col++) {
        const tile  = mapDef.grid[row]?.[col] ?? 1;
        const frame = hasTileset ? tileIndices[String(tile)] : undefined;
        const x     = col * TILE_SIZE;
        const y     = row * TILE_SIZE;

        if (frame != null) {
          rt.stamp(mapDef.tileset, frame, x, y, { scaleX: 0.5, scaleY: 0.5, originX: 0, originY: 0 });
        } else {
          const hex   = colors[String(tile)] ?? '#111111';
          const color = parseInt(hex.replace('#', ''), 16);
          gfx.fillStyle(color);
          gfx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
        }
      }
    }

    this.add.text(2, 1, mapDef.name ?? '', { font: '8px monospace', color: '#446688' }).setScrollFactor(0);
  }

  // ─── entities ────────────────────────────────────────────────────────────

  _spawnEntities(mapDef) {
    const events = this.registry.get('events');
    for (const ent of (mapDef.entities ?? [])) {
      // Skip if story condition not met
      if (ent.condition && !events?.check(ent.condition)) continue;

      const gfx = this.add.graphics();
      const px  = ent.x * TILE_SIZE;
      const py  = ent.y * TILE_SIZE;

      this._drawEntityGfx(gfx, ent, px, py, events);

      // Idle pulse — entities breathe gently at random rates
      this.tweens.add({
        targets:  gfx,
        alpha:    { from: 1.0, to: 0.65 },
        duration: Phaser.Math.Between(700, 1400),
        delay:    Phaser.Math.Between(0, 600),
        yoyo:     true,
        repeat:   -1,
        ease:     'Sine.easeInOut',
      });

      const label = this.add.text(px, py - 8, ent.label ?? '', {
        font: '7px monospace', color: '#aaaaaa',
      });

      this._entities.push({ ...ent, gfx, label });
    }
  }

  _drawEntityGfx(gfx, ent, px, py, events) {
    const isDone   = events?.check(`done_${ent.id}`);
    const rawColor = (isDone && ent.glowColor) ? ent.glowColor : (ent.color ?? '#ffffff');
    const color    = parseInt(rawColor.replace('#', ''), 16);

    gfx.clear();
    gfx.fillStyle(color);
    if (ent.shape === 'rect') {
      gfx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    } else {
      gfx.fillEllipse(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }

  _refreshEntities() {
    const events = this.registry.get('events');
    for (const ent of this._entities) {
      if (!ent.glowColor) continue;
      const px = ent.x * TILE_SIZE;
      const py = ent.y * TILE_SIZE;
      this._drawEntityGfx(ent.gfx, ent, px, py, events);
    }
  }

  // ─── player ──────────────────────────────────────────────────────────────

  _spawnPlayer(tx, ty) {
    this._px      = tx;
    this._py      = ty;
    this._renderPx = tx * TILE_SIZE;
    this._renderPy = ty * TILE_SIZE;
    this._playerGfx = this.add.graphics();
    this._drawPlayer();
  }

  _drawPlayer() {
    const px = Math.round(this._renderPx) + 1;
    const py = Math.round(this._renderPy) + 1;
    const party = this.registry.get('party');
    const color = party?.members[0]?.color ?? 0xff44aa;

    this._playerGfx.clear();
    this._playerGfx.fillStyle(color);
    this._playerGfx.fillRoundedRect(px, py, TILE_SIZE - 2, TILE_SIZE - 2, 3);
    this._playerGfx.fillStyle(0x000000);
    this._playerGfx.fillRect(px + 3, py + 4, 2, 2);
    this._playerGfx.fillRect(px + 9, py + 4, 2, 2);

    this.cameras.main.centerOn(
      Math.round(this._renderPx) + TILE_SIZE / 2,
      Math.round(this._renderPy) + TILE_SIZE / 2,
    );
  }

  _slidePlayerTo(nx, ny) {
    if (this._moveTween) this._moveTween.stop();
    this._moveTween = this.tweens.add({
      targets:  this,
      _renderPx: nx * TILE_SIZE,
      _renderPy: ny * TILE_SIZE,
      duration:  110,
      ease:      'Linear',
      onUpdate:  () => this._drawPlayer(),
    });
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────

  _drawHUD() {
    this._hudText = this.add.text(2, SCREEN_H - 12, '', {
      font: '8px monospace', color: '#446688',
    }).setScrollFactor(0);
    this._noticeText = this.add.text(SCREEN_W / 2, SCREEN_H - 22, '', {
      font: '8px monospace', color: '#00ff88',
    }).setOrigin(0.5).setScrollFactor(0);
    this._refreshHUD();
  }

  _refreshHUD() {
    const party = this.registry.get('party');
    if (!party) return;
    const m = party.members[0];
    this._hudText.setText(`${m.name} Lv${m.level}  HP:${m.hp}/${m.maxHp}  [Z=talk  M=menu  S=save]`);
  }

  _showNotice(msg, ms = 2200) {
    this._noticeText.setText(msg);
    if (this._noticeTimer) this._noticeTimer.remove();
    this._noticeTimer = this.time.delayedCall(ms, () => this._noticeText.setText(''));
  }

  // ─── input ───────────────────────────────────────────────────────────────

  _setupInput() {
    this._cursors = this.input.keyboard.createCursorKeys();
    this._wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this._zKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.input.keyboard.on('keydown-S',  () => this._manualSave());
    this.input.keyboard.on('keydown-F5', () => this._manualSave());
    this.input.keyboard.on('keydown-M',  () => {
      if (this._busy) return;
      this._busy = true;
      this.scene.launch('MenuScene', { returnScene: 'ExploreScene' });
      this.scene.pause('ExploreScene');
    });
  }

  _manualSave() {
    const ok = SaveSystem.save(this.registry.get('party'), this.registry.get('events'), this._mapId, this._px, this._py);
    this._showNotice(ok ? 'Game saved!' : 'Save failed!');
  }

  // ─── update ──────────────────────────────────────────────────────────────

  update(time, delta) {
    if (this._busy) return;

    this._moveTimer -= delta;
    if (this._moveTimer > 0) return;

    if (Phaser.Input.Keyboard.JustDown(this._zKey)) {
      this._tryInteract();
      return;
    }

    let dx = 0, dy = 0;
    if (this._cursors.left.isDown  || this._wasd.left.isDown)  dx = -1;
    else if (this._cursors.right.isDown || this._wasd.right.isDown) dx =  1;
    else if (this._cursors.up.isDown    || this._wasd.up.isDown)    dy = -1;
    else if (this._cursors.down.isDown  || this._wasd.down.isDown)  dy =  1;
    if (!dx && !dy) return;

    const nx = this._px + dx;
    const ny = this._py + dy;
    if (this._walkable(nx, ny)) {
      this._px = nx;
      this._py = ny;
      this._slidePlayerTo(nx, ny);
      this._moveTimer = MOVE_DELAY;
      this._onStep();
    }
  }

  _walkable(tx, ty) {
    const grid = this._map.grid;
    if (ty < 0 || ty >= this._map.height || tx < 0 || tx >= this._map.width) return false;
    const tile = grid[ty]?.[tx] ?? 1;
    if (tile === 1 || tile === 3) return false;
    // passable:true entities don't block movement (e.g. city district labels)
    if (this._entities.some(e => e.x === tx && e.y === ty && !e.passable)) return false;
    return true;
  }

  // ─── step logic ──────────────────────────────────────────────────────────

  _onStep() {
    this._checkExits();

    const rate = this._map.encounterRate ?? 0;
    if (rate === 0) return;

    this._stepCount++;
    if (this._stepCount >= this._nextEnc) {
      this._stepCount = 0;
      this._nextEnc = Phaser.Math.Between(rate, rate + 5);
      this._triggerBattle();
    }
  }

  _checkExits() {
    const events = this.registry.get('events');
    for (const exit of (this._map.exits ?? [])) {
      const onTile = exit.tiles?.some(([ex, ey]) => ex === this._px && ey === this._py);
      if (!onTile) continue;
      if (exit.condition && !events?.check(exit.condition)) {
        this._showNotice('Not yet...');
        return;
      }
      const t = exit.target;
      this.scene.start('ExploreScene', { mapId: t.map, tileX: t.x, tileY: t.y });
      return;
    }
  }

  // ─── NPC interaction ─────────────────────────────────────────────────────

  _tryInteract() {
    const target = this._entities.find(e =>
      Math.abs(e.x - this._px) <= 1 && Math.abs(e.y - this._py) <= 1
    );
    if (!target) return;

    const events = this.registry.get('events');
    const dialogueId = (target.dialogueOnce && events?.check(`done_${target.id}`))
      ? target.repeatDialogue
      : target.dialogue;

    if (!dialogueId) return;

    if (target.dialogueOnce) events?.set(`done_${target.id}`);

    this._launchDialogue(dialogueId);
  }

  _launchDialogue(id) {
    this._busy = true;
    this.registry.set('pendingDialogue', id);
    this.scene.launch('DialogueScene', { dialogueId: id, returnScene: 'ExploreScene' });
    this.scene.pause('ExploreScene');
  }

  // ─── battle trigger ──────────────────────────────────────────────────────

  _triggerBattle() {
    const allEnemies = this.registry.get('enemies') ?? [];
    const pool = this._map.encounterPool ?? allEnemies.map(e => e.id);
    const id   = pool[Math.floor(Math.random() * pool.length)];
    const def  = allEnemies.find(e => e.id === id) ?? allEnemies[0];
    if (!def) return;

    this._busy = true;
    this.scene.launch('BattleScene', {
      enemies:     [def],
      party:       this.registry.get('party'),
      abilities:   this.registry.get('abilities'),
      resumeScene: 'ExploreScene',
    });
    this.scene.pause('ExploreScene');
  }

  // ─── resume handler ──────────────────────────────────────────────────────

  _onResume() {
    this._busy = false;
    this._stepCount = 0;
    this._nextEnc = Phaser.Math.Between(5, 10);

    // Refresh entity glow states (e.g. amp after signal sent)
    this._refreshEntities();

    const battleResult = this.registry.get('lastBattle');
    if (battleResult) {
      this.registry.remove('lastBattle');
      if (battleResult.won) {
        SaveSystem.save(this.registry.get('party'), this.registry.get('events'), this._mapId, this._px, this._py);
        this._showNotice(`+${battleResult.xp} XP  +$${battleResult.gold}  [saved]`);
      }
    }

    const action = this.registry.get('pendingSceneAction');
    if (action) {
      this.registry.remove('pendingSceneAction');
      if (action.type === 'map_change') {
        this.scene.start('ExploreScene', {
          mapId: action.map, tileX: action.x, tileY: action.y,
        });
        return;
      }
    }

    this._refreshHUD();
  }
}
