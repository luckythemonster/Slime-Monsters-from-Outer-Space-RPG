// ExploreScene: overworld — map, player, NPCs, triggers, exits, enemies (ARCHITECTURE §4, §10, §12.3).
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { TILE, DEPTH, PIXEL_FONT, PARAMS, FADE_MS, scaleMs } from '../config.js';
import { buildMap, isSolidAt } from '../engine/MapLoader.js';
import { Entity, DELTA } from '../engine/Entities.js';
import { EventRunner } from '../engine/EventRunner.js';
import { evaluate } from '../engine/Conditions.js';
import { audioCall } from '../engine/Audio.js';

const CamEvents = Phaser.Cameras.Scene2D.Events;

function hexToRgb(color, fallback = [0, 0, 0]) {
  if (typeof color === 'number') return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
  if (typeof color === 'string' && /^#?[0-9a-f]{6}$/i.test(color)) {
    const n = parseInt(color.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return fallback;
}

export default class ExploreScene extends Phaser.Scene {
  constructor() { super({ key: 'Explore' }); }

  /** @param {{map?: string, x?: number, y?: number, facing?: string}} data */
  init(data) {
    this.startData = data || {};
    /** @type {Map<string, Entity>} 'player' is always present */
    this.entities = new Map();
    this.zones = [];
    this.despawned = new Set();
    this.built = null;
    this.mapDef = null;
    this.mapId = null;
    this.player = null;
    this.lockCount = 0;
    this.transitioning = false;
    this.gameOverStarted = false;
    this.queuedDir = null;
    this.runner = null;
  }

  get state() { return services.state; }
  get gameData() { return services.data; }
  get manifest() { return services.data.manifest; }
  get inputLocked() { return this.lockCount > 0 || this.transitioning; }

  create() {
    const st = this.state;
    const d = this.startData;
    this.runner = new EventRunner({ scripts: this.gameData.scripts, state: st, explore: this, characters: this.gameData.characters });
    this.cameras.main.roundPixels = true;
    this.onResume = () => {
      services.input.consume();
      if (this.mapDef && this.mapDef.music) audioCall('playMusic', this.mapDef.music, { fade: 0.3 });
    };
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume);
    this.events.on(Phaser.Scenes.Events.WAKE, this.onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    if (PARAMS.debug) {
      this.debugText = this.add.text(2, 2, '', { fontFamily: PIXEL_FONT, fontSize: '8px', color: '#39ff8a', resolution: 1 })
        .setScrollFactor(0).setDepth(DEPTH.OVER + 50);
    }
    this.loadMap(d.map || st.map, d.x ?? st.x, d.y ?? st.y, d.facing || st.facing);
    services.ui.fade('in', scaleMs(FADE_MS)).then(() => this.enterMap());
  }

  cleanup() {
    this.runner.destroy();
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onResume);
    this.clearMap();
  }

  // ---- map lifecycle ---------------------------------------------------------------------------

  clearMap() {
    for (const t of this.tweens.getTweens()) t.stop();
    for (const e of this.entities.values()) e.destroy();
    this.entities.clear();
    this.zones = [];
    this.despawned = new Set();
    this.cameras.main.stopFollow();
    if (this.built) { this.built.destroy(); this.built = null; }
  }

  /** Synchronously replace the current map (no fade). */
  loadMap(mapId, x, y, facing) {
    const def = this.gameData.maps[mapId];
    if (!def) throw new Error(`ExploreScene: unknown map "${mapId}"`);
    this.clearMap();
    this.mapId = mapId;
    this.mapDef = def;
    this.built = buildMap(this, def, this.manifest);
    for (const e of def.entities || []) if (e.type === 'exit' || e.type === 'trigger') this.zones.push(e);

    const leader = this.state.party.members[0];
    const chars = this.gameData.characters.characters;
    const sprite = leader && chars[leader.id] ? chars[leader.id].sprite : 'lucky';
    this.player = new Entity(this, {
      id: 'player', type: 'player', sprite, behavior: 'idle',
      x: x ?? def.spawn.x, y: y ?? def.spawn.y, facing: facing || def.spawn.facing,
    });
    this.entities.set('player', this.player);
    this.refreshConditions();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.built.width * TILE, this.built.height * TILE);
    cam.startFollow(this.player, true, 1, 1);
    this.state.setPosition(mapId, this.player.tileX, this.player.tileY, this.player.facing);
    this.queuedDir = null;
    if (def.music) audioCall('playMusic', def.music, { fade: 0.5 });
    else audioCall('stopMusic', { fade: 0.5 });
    this.events.emit('mapload', mapId);
  }

  /** Run onFirstEnter / onEnter hooks for the current map. */
  async enterMap() {
    const def = this.mapDef;
    if (!def) return;
    const flag = `visited_${this.mapId}`;
    if (def.onFirstEnter && !this.state.flags[flag]) {
      this.state.set(`flags.${flag}`, true);
      await this.runner.run(def.onFirstEnter);
    } else if (!this.state.flags[flag]) {
      this.state.set(`flags.${flag}`, true);
    }
    if (def.onEnter) await this.runner.run(def.onEnter);
  }

  /** Fade out, swap map, fade in, run enter hooks (ARCHITECTURE §12.3). */
  async changeMap(mapId, x, y, facing) {
    if (this.transitioning) return;
    this.transitioning = true;
    try {
      await services.ui.fade('out', scaleMs(FADE_MS));
      this.loadMap(mapId, x, y, facing);
      await services.ui.fade('in', scaleMs(FADE_MS));
    } finally {
      this.transitioning = false;
    }
    await this.enterMap();
  }

  /** Create/destroy conditional entities so they match the current state. */
  refreshConditions() {
    if (!this.mapDef) return;
    for (const e of this.mapDef.entities || []) {
      if (e.type === 'exit' || e.type === 'trigger') continue;
      const want = evaluate(e.condition, this.state) && !this.despawned.has(e.id);
      const have = this.entities.has(e.id);
      if (want && !have) this.entities.set(e.id, new Entity(this, e));
      else if (!want && have && !this.entities.get(e.id).temporary) {
        this.entities.get(e.id).destroy();
        this.entities.delete(e.id);
      }
    }
  }

  spawnEntity(def) {
    if (this.entities.has(def.id)) this.despawnEntity(def.id);
    const e = new Entity(this, def);
    e.temporary = true;
    this.entities.set(def.id, e);
    this.despawned.delete(def.id);
    return e;
  }

  despawnEntity(id) {
    const e = this.entities.get(id);
    if (!e || e === this.player) return;
    e.destroy();
    this.entities.delete(id);
    this.despawned.add(id);
  }

  /** Counter-based so nested scripts/encounters can each lock and unlock. */
  lockInput(on) {
    this.lockCount = on ? this.lockCount + 1 : Math.max(0, this.lockCount - 1);
    if (on) this.queuedDir = null;
  }

  isBlocked(tx, ty, self) {
    if (!this.built || isSolidAt(this.built, tx, ty)) return true;
    for (const e of this.entities.values()) {
      if (e === self || !e.solid) continue;
      if (e.occupies(tx, ty)) return true;
    }
    return false;
  }

  // ---- per-frame --------------------------------------------------------------------------------

  update(time, delta) {
    this.state.tick(delta);
    if (this.debugText && this.player && this.game.loop.frame % 10 === 0) {
      this.debugText.setText(`${this.mapId} ${this.player.tileX},${this.player.tileY} ${Math.round(this.game.loop.actualFps)}fps`);
    }
    if (!this.player) return;
    const frozen = this.inputLocked;
    if (!frozen) for (const e of this.entities.values()) if (e !== this.player) e.updateBehavior(time);
    if (frozen) return;

    const input = services.input;
    if (input.justPressed('menu')) { this.openMenu(); return; }
    if (input.justPressed('confirm') && !this.player.moving) { this.interact(); return; }
    if (this.player.moving) {
      for (const d of ['up', 'down', 'left', 'right']) if (input.justPressed(d)) this.queuedDir = d;
      return;
    }
    const dir = this.queuedDir || input.heldDirection();
    this.queuedDir = null;
    if (dir) this.player.step(dir, input.isDown('run') ? 'run' : 'walk');
  }

  /** `confirm` while facing an entity with a script, or a save point. */
  interact() {
    const [dx, dy] = DELTA[this.player.facing];
    const tx = this.player.tileX + dx, ty = this.player.tileY + dy;
    for (const e of this.entities.values()) {
      if (e === this.player || !e.occupies(tx, ty)) continue;
      if (e.type === 'npc' && !e.moving) e.faceToward(this.player);
      if (e.def.script) { this.runner.run(e.def.script, { entity: e }); return; }
      if (e.type === 'save') { this.runner.run([{ sfx: 'sneeze' }, { save: true }], { entity: e }); return; }
    }
  }

  /** Called by Entity when a tile step completes. */
  onEntityStep(entity) {
    if (entity === this.player) {
      this.state.setPosition(this.mapId, entity.tileX, entity.tileY, entity.facing);
      if (this.transitioning || this.runner.running) return;
      for (const z of this.zones) {
        const inside = entity.tileX >= z.x && entity.tileX < z.x + (z.w || 1) && entity.tileY >= z.y && entity.tileY < z.y + (z.h || 1);
        if (!inside) continue;
        if (z.type === 'exit') { this.changeMap(z.to.map, z.to.x, z.to.y, z.to.facing); return; }
        if (z.condition && !evaluate(z.condition, this.state)) continue;
        if (z.once) {
          const flag = `trig_${this.mapId}_${z.id}`;
          if (this.state.flags[flag]) continue;
          this.state.set(`flags.${flag}`, true);
        }
        this.runner.run(z.script);
        return;
      }
    }
    this.checkEnemyContact();
  }

  checkEnemyContact() {
    if (this.inputLocked || !this.player) return;
    for (const e of this.entities.values()) {
      if (e.type !== 'enemy' || e.behavior !== 'chase' || e.engaged) continue;
      if (Math.abs(e.tileX - this.player.tileX) + Math.abs(e.tileY - this.player.tileY) === 1) { this.onEnemyTouch(e); return; }
    }
  }

  /** A chasing enemy reached the player. */
  async onEnemyTouch(enemy) {
    if (enemy.engaged || this.inputLocked) return;
    enemy.engaged = true;
    this.lockInput(true);
    try {
      this.player.faceToward(enemy);
      enemy.faceToward(this.player);
      await enemy.showEmote('!', 350);
      const result = await this.startBattle(enemy.def.encounter);
      if (result === 'win') {
        if (enemy.def.setOnWin) this.state.set(enemy.def.setOnWin, true);
        if (enemy.def.onDefeat) await this.runner.run(enemy.def.onDefeat, { entity: enemy });
        this.despawnEntity(enemy.id);
      } else if (result === 'lose') {
        this.gameOver();
        return;
      } else {
        enemy.behavior = 'idle';
        this.time.delayedCall(scaleMs(2000), () => { if (enemy.active) { enemy.engaged = false; enemy.behavior = 'chase'; } });
      }
    } finally {
      this.lockInput(false);
      this.refreshConditions();
    }
  }

  // ---- sub-scenes --------------------------------------------------------------------------------

  /** Launch Battle, sleep until it calls back (ARCHITECTURE §12.4). */
  async startBattle(encounterId) {
    const encounter = this.gameData.encounters[encounterId];
    if (!encounter) { console.error(`[explore] unknown encounter "${encounterId}"`); return 'win'; }
    services.ui.closeAll();
    audioCall('sfx', 'kraaang');
    await services.ui.fade('out', scaleMs(200));
    return this.runSub('Battle', { encounterId, encounter, background: this.mapDef.battleBackground || 'street' });
  }

  /** Launch a special scene (e.g. 'Freefall') and sleep until it calls back. */
  runSpecialScene(key, data = {}) {
    return this.runSub(key, data);
  }

  runSub(key, data) {
    return new Promise((resolve) => {
      let result;
      this.events.once(Phaser.Scenes.Events.WAKE, () => resolve(result));
      const onDone = (r) => { result = r; this.scene.wake(); };
      this.scene.launch(key, { ...data, onDone });
      this.scene.bringToTop('UI');
      this.scene.sleep();
    });
  }

  openMenu() {
    services.input.consume();
    audioCall('sfx', 'confirm');
    this.scene.launch('Menu');
    this.scene.bringToTop('UI');
    this.scene.pause();
  }

  gameOver(text) {
    if (this.gameOverStarted) return;
    this.gameOverStarted = true;
    services.ui.closeAll();
    for (const k of ['Battle', 'Menu', 'Freefall']) {
      if (this.scene.isActive(k) || this.scene.isPaused(k) || this.scene.isSleeping(k)) this.scene.stop(k);
    }
    this.scene.start('GameOver', { text });
  }

  /** Camera effects with the {"camera": …} script command shape. Resolves when the effect ends. */
  camera(fx) {
    const cam = this.cameras.main;
    const [r, g, b] = hexToRgb(fx.color, fx.flash !== undefined ? [255, 255, 255] : [0, 0, 0]);
    return new Promise((resolve) => {
      const done = () => resolve();
      if (fx.shake !== undefined) { cam.once(CamEvents.SHAKE_COMPLETE, done); cam.shake(scaleMs(fx.shake || 300), fx.intensity ?? 0.01, true); }
      else if (fx.flash !== undefined) { cam.once(CamEvents.FLASH_COMPLETE, done); cam.flash(scaleMs(fx.flash || 150), r, g, b, true); }
      else if (fx.fade === 'out') { cam.once(CamEvents.FADE_OUT_COMPLETE, done); cam.fadeOut(scaleMs(fx.ms || FADE_MS), r, g, b); }
      else if (fx.fade === 'in') { cam.once(CamEvents.FADE_IN_COMPLETE, done); cam.fadeIn(scaleMs(fx.ms || FADE_MS), r, g, b); }
      else if (fx.pan) { cam.stopFollow(); cam.once(CamEvents.PAN_COMPLETE, done); cam.pan(fx.pan.x, fx.pan.y, scaleMs(fx.pan.ms || 500), 'Sine.easeInOut', true); }
      else if (fx.follow) { const e = this.entities.get(fx.follow); if (e) cam.startFollow(e, true, 1, 1); done(); }
      else done();
    });
  }
}
