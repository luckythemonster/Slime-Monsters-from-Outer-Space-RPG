// ExploreScene: overworld — map, player, followers, NPCs, triggers, exits, enemies, night dressing
// and the camera effects (ARCHITECTURE §4, §10, §12.3; DESIGN.md E12, E14–E17).
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { TILE, DEPTH, PIXEL_FONT, PARAMS, FADE_MS, WIDTH, HEIGHT, scaleMs } from '../config.js';
import { buildMap, isSolidAt } from '../engine/MapLoader.js';
import { Entity, DELTA } from '../engine/Entities.js';
import { EventRunner, SAVE_PROMPT } from '../engine/EventRunner.js';
import { evaluate } from '../engine/Conditions.js';
import { audioCall } from '../engine/Audio.js';

const CamEvents = Phaser.Cameras.Scene2D.Events;
const SNAP_KEY = '__cam_snapshot';
const LIGHT_KEY = '__light_glow';
const BEND_STRIP = 8; // px
const TEAR_SPLIT = 112; // y of the panel tear
/** `camera.shake` intensity → whole pixels (DESIGN.md "Transitions"). */
const SHAKE_PX = [[0.01, 1], [0.02, 2], [0.03, 4], [0.04, 6]];

function hexToRgb(color, fallback = [0, 0, 0]) {
  if (typeof color === 'number') return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
  if (typeof color === 'string' && /^#?[0-9a-f]{6}$/i.test(color)) {
    const n = parseInt(color.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return fallback;
}

function hexToInt(color, fallback = 0x102040) {
  const [r, g, b] = hexToRgb(color, [(fallback >> 16) & 255, (fallback >> 8) & 255, fallback & 255]);
  return (r << 16) | (g << 8) | b;
}

export default class ExploreScene extends Phaser.Scene {
  constructor() { super({ key: 'Explore' }); }

  /** @param {{map?: string, x?: number, y?: number, facing?: string}} data */
  init(data) {
    this.startData = data || {};
    /** @type {Map<string, Entity>} 'player' is always present; followers sit under their member id */
    this.entities = new Map();
    /** @type {Entity[]} party members trailing the leader (E14), in party order */
    this.followers = [];
    this.zones = [];
    this.despawned = new Set();
    this.built = null;
    this.mapDef = null;
    this.mapId = null;
    this.player = null;
    this.lockCount = 0;
    this.transitioning = false;
    this.leaving = false;
    this.queuedDir = null;
    this.runner = null;
    this.overlay = null;
    this.lights = [];
    this.fx = { shake: null, objects: [] };
  }

  get state() { return services.state; }
  get gameData() { return services.data; }
  get manifest() { return services.data.manifest; }
  get inputLocked() { return this.lockCount > 0 || this.transitioning; }
  get isWebGL() { return this.sys.game.renderer && this.sys.game.renderer.type === Phaser.WEBGL; }

  create() {
    const st = this.state;
    const d = this.startData;
    const data = this.gameData;
    this.runner = new EventRunner({ scripts: data.scripts, state: st, explore: this, characters: data.characters, speakers: data.speakers, shops: data.shops });
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

  /** Scene shutdown: Phaser destroys the display list itself, so only drop references here. */
  cleanup() {
    this.runner.destroy();
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onResume);
    this.entities.clear();
    this.followers = [];
    this.zones = [];
    this.built = null;
    this.player = null;
    this.mapDef = null;
    this.overlay = null;
    this.lights = [];
    this.fx = { shake: null, objects: [] };
    if (this.textures.exists(SNAP_KEY)) this.textures.remove(SNAP_KEY);
  }

  // ---- map lifecycle ---------------------------------------------------------------------------

  clearMap() {
    for (const t of this.tweens.getTweens()) t.stop();
    for (const e of this.entities.values()) e.destroy();
    for (const f of this.followers) if (f.active) f.destroy();
    this.entities.clear();
    this.followers = [];
    this.zones = [];
    this.despawned = new Set();
    this.cameras.main.stopFollow();
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    for (const l of this.lights) l.obj.destroy();
    this.lights = [];
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
    const sprite = this.playerSheet(leader && chars[leader.id] ? chars[leader.id].sprite : 'lucky');
    this.player = new Entity(this, {
      id: 'player', type: 'player', sprite, behavior: 'idle',
      x: x ?? def.spawn.x, y: y ?? def.spawn.y, facing: facing || def.spawn.facing,
    });
    this.entities.set('player', this.player);
    this.buildOverlay(def);
    this.refreshConditions();
    this.refreshFollowers();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.built.width * TILE, this.built.height * TILE);
    cam.startFollow(this.player, true, 1, 1);
    this.state.setPosition(mapId, this.player.tileX, this.player.tileY, this.player.facing);
    this.queuedDir = null;
    if (def.music) audioCall('playMusic', def.music, { fade: 0.5 });
    else audioCall('stopMusic', { fade: 0.5 });
    this.events.emit('mapload', mapId);
  }

  /**
   * The leader's map sheet follows the story flags (DESIGN.md "Lucky's color on the map"): `lucky_rage`
   * from `flags.luckyRageLocked` on, for the rest of the chapter, so a map change or CONTINUE keeps it.
   * Scripts still swap sheets freely on top of this (`{"sprite"}`).
   */
  playerSheet(base) {
    if (base === 'lucky' && this.state.flags.luckyRageLocked && this.manifest && this.manifest.lucky_rage) return 'lucky_rage';
    return base;
  }

  /**
   * Run onFirstEnter / onEnter hooks for the current map. Both accept a script id or an array of
   * `{ "script", "condition"?, "once"? }` entries (DESIGN.md E16); `once` is remembered in
   * flags.onenter_<map>_<script>.
   */
  async enterMap() {
    const def = this.mapDef;
    if (!def) return;
    const flag = `visited_${this.mapId}`;
    const first = !this.state.flags[flag];
    if (first) this.state.set(`flags.${flag}`, true);
    if (first) await this.runHooks(def.onFirstEnter, 'first');
    await this.runHooks(def.onEnter, 'enter');
  }

  async runHooks(hooks, kind) {
    if (!hooks || this.mapDef === null) return;
    const list = Array.isArray(hooks) ? hooks : [hooks];
    const mapId = this.mapId;
    for (const h of list) {
      if (mapId !== this.mapId) return; // a hook teleported away
      const entry = typeof h === 'string' ? { script: h } : h;
      if (!entry || !entry.script) continue;
      if (entry.condition && !evaluate(entry.condition, this.state)) continue;
      if (entry.once) {
        const f = `onenter_${mapId}_${entry.script}`;
        if (this.state.flags[f]) continue;
        this.state.set(`flags.${f}`, true);
      }
      await this.runner.run(entry.script, { hook: kind });
    }
  }

  /**
   * Fade out, swap map, fade in, run enter hooks (ARCHITECTURE §12.3). `{ fade: false }` cuts.
   */
  async changeMap(mapId, x, y, facing, { fade = true } = {}) {
    if (this.transitioning) return;
    this.transitioning = true;
    try {
      if (fade) await services.ui.fade('out', scaleMs(FADE_MS));
      this.loadMap(mapId, x, y, facing);
      if (fade) await services.ui.fade('in', scaleMs(FADE_MS));
    } finally {
      this.transitioning = false;
    }
    await this.enterMap();
  }

  /** Create/destroy conditional entities (and the night overlay) so they match the current state. */
  refreshConditions() {
    if (!this.mapDef) return;
    for (const e of this.mapDef.entities || []) {
      if (e.type === 'exit' || e.type === 'trigger') continue;
      const want = evaluate(e.condition, this.state) && !this.despawned.has(e.id);
      const cur = this.entities.get(e.id);
      const have = !!cur && cur.type !== 'follower';
      if (want && !have) {
        if (cur) this.entities.delete(e.id); // a follower was parked under this id; the map NPC wins
        this.entities.set(e.id, new Entity(this, e));
      } else if (!want && have && !cur.temporary) {
        cur.destroy();
        this.entities.delete(e.id);
      }
    }
    this.refreshOverlay();
    this.refreshFollowers();
  }

  spawnEntity(def) {
    const cur = this.entities.get(def.id);
    if (cur && cur.type === 'follower') this.entities.delete(def.id);
    else if (cur) this.despawnEntity(def.id);
    const e = new Entity(this, def);
    e.temporary = true;
    this.entities.set(def.id, e);
    this.despawned.delete(def.id);
    this.refreshFollowers();
    return e;
  }

  despawnEntity(id) {
    const e = this.entities.get(id);
    if (!e || e === this.player) return;
    if (e.type === 'follower') { e.setVisible(false); e.hiddenByScript = true; return; }
    e.destroy();
    this.entities.delete(id);
    this.despawned.add(id);
    this.refreshFollowers();
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

  // ---- followers (E14) ---------------------------------------------------------------------------

  get followersEnabled() { return !!this.mapDef && this.mapDef.followers !== false; }

  /** A follower by party member id (hidden ones included). */
  follower(id) { return this.followers.find((f) => f.memberId === id) || null; }

  /**
   * Make the follower list match the party (members after the leader). A follower is parked in
   * `entities` under its member id so scripts can `move`/`face`/`anim` it, unless a map NPC or a
   * script `spawn` already uses that id — then the follower hides until that entity goes away.
   */
  refreshFollowers() {
    if (!this.player || !this.mapDef) return;
    const chars = this.gameData.characters.characters;
    const want = this.followersEnabled ? this.state.party.members.slice(1).map((m) => m.id) : [];
    for (const f of [...this.followers]) {
      if (want.includes(f.memberId)) continue;
      if (this.entities.get(f.memberId) === f) this.entities.delete(f.memberId);
      f.destroy();
      this.followers.splice(this.followers.indexOf(f), 1);
    }
    want.forEach((id, i) => {
      let f = this.follower(id);
      if (!f) {
        const prev = i === 0 ? this.player : this.followers[i - 1] || this.player;
        f = new Entity(this, {
          id, type: 'follower', sprite: chars[id] ? chars[id].sprite : id,
          x: prev.tileX, y: prev.tileY, facing: prev.facing,
        });
        f.memberId = id;
        this.followers.splice(i, 0, f);
      }
      const other = this.entities.get(id);
      const shadowed = !!other && other !== f;
      if (shadowed) { f.setVisible(false); f.shadowed = true; }
      else {
        this.entities.set(id, f);
        if (f.shadowed) { f.setTile(this.player.tileX, this.player.tileY); f.face(this.player.facing); }
        f.shadowed = false;
        if (!this.runner.running) f.hiddenByScript = false;
        f.setVisible(!f.hiddenByScript);
      }
    });
  }

  /** The leader started a step from (fromX, fromY): every follower moves into the tile ahead of it. */
  trailFollowers(fromX, fromY, speed) {
    let tx = fromX, ty = fromY;
    for (const f of this.followers) {
      const px = f.tileX, py = f.tileY;
      if (!f.moving && (px !== tx || py !== ty)) {
        const dist = Math.abs(tx - px) + Math.abs(ty - py);
        if (dist > 3) { f.setTile(tx, ty); f.face(this.player.facing); }
        else f.stepToward(tx, ty, speed);
      }
      tx = px; ty = py;
    }
  }

  // ---- night dressing (E17) ----------------------------------------------------------------------

  /** `"overlay": { color, alpha, condition }` at depth 50 (above sprites, below `over`) + `lights`. */
  buildOverlay(def) {
    if (!def.overlay && !(def.lights && def.lights.length)) return;
    const w = this.built.width * TILE, h = this.built.height * TILE;
    if (def.overlay) {
      this.overlay = this.add.rectangle(0, 0, w, h, hexToInt(def.overlay.color), def.overlay.alpha ?? 0.45)
        .setOrigin(0, 0).setDepth(DEPTH.OVERLAY).setVisible(false);
    }
    for (const l of def.lights || []) {
      const key = l.sprite && this.textures.exists(l.sprite) ? l.sprite : this.ensureLightTexture();
      const obj = this.add.image(l.x * TILE + TILE / 2, l.y * TILE + TILE / 2, key)
        .setDepth(DEPTH.OVERLAY + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(l.alpha ?? 0.7).setVisible(false);
      this.lights.push({ def: l, obj });
    }
    this.refreshOverlay();
  }

  ensureLightTexture() {
    if (this.textures.exists(LIGHT_KEY)) return LIGHT_KEY;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const rings = [[16, 0x402810], [12, 0x806020], [8, 0xc0a040], [4, 0xffe088]];
    for (const [r, c] of rings) { g.fillStyle(c, 1); g.fillCircle(16, 16, r); }
    g.generateTexture(LIGHT_KEY, 32, 32);
    g.destroy();
    return LIGHT_KEY;
  }

  refreshOverlay() {
    const def = this.mapDef;
    if (!def) return;
    const night = !!def.overlay && evaluate(def.overlay.condition, this.state);
    if (this.overlay) this.overlay.setVisible(night);
    for (const l of this.lights) {
      const cond = l.def.condition !== undefined ? evaluate(l.def.condition, this.state) : (def.overlay ? night : true);
      l.obj.setVisible(cond);
    }
  }

  // ---- per-frame --------------------------------------------------------------------------------

  update(time, delta) {
    this.state.tick(delta);
    if (this.debugText && this.player && this.game.loop.frame % 10 === 0) {
      this.debugText.setText(`${this.mapId} ${this.player.tileX},${this.player.tileY} ${Math.round(this.game.loop.actualFps)}fps`);
    }
    this.updateShake();
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
    if (dir) this.player.step(dir, input.isDown('run') ? 'run' : 'walk', { ghost: false });
  }

  /** `confirm` while facing an entity with a script, or a save point. */
  interact() {
    const [dx, dy] = DELTA[this.player.facing];
    const tx = this.player.tileX + dx, ty = this.player.tileY + dy;
    for (const e of this.entities.values()) {
      if (e === this.player || e.type === 'follower' || !e.occupies(tx, ty)) continue;
      if (e.type === 'enemy') { this.onEnemyTouch(e, { initiator: 'player', emote: false }); return; }
      if (e.type === 'npc' && !e.moving) e.faceToward(this.player);
      if (e.def.script) { this.runner.run(e.def.script, { entity: e }); return; }
      if (e.type === 'save') { this.runSave(e); return; }
    }
  }

  /** Bajonka's clipboard for a `save` entity (interact, or SAVE in the pause menu next to her). */
  runSave(e) {
    this.player.faceToward(e);
    return this.runner.run([
      { sfx: 'sneeze' },
      { say: 'Bajonka holds out the clipboard.', who: 'narrator' },
      { save: { prompt: e.def.prompt || SAVE_PROMPT } },
    ], { entity: e, scriptId: 'bajonka_save' });
  }

  /** Called by Entity when it turns without moving (keeps the save position's facing current). */
  onEntityFace(entity) {
    if (entity === this.player) this.state.facing = entity.facing;
  }

  /** Called by Entity when a step begins (followers trail the leader, E14). */
  onEntityStepStart(entity, fromX, fromY, speed) {
    if (entity === this.player && this.followers.length && !this.runner.running) this.trailFollowers(fromX, fromY, speed);
  }

  /**
   * Called by Entity when a non-ghost step was blocked: the player stepping into an enemy's tile, or an
   * enemy (any behavior) stepping into the player's, is a touch and starts that enemy's encounter.
   */
  onEntityBump(entity, tx, ty) {
    if (this.inputLocked || !this.player) return;
    if (entity === this.player) {
      for (const e of this.entities.values()) {
        if (e.type === 'enemy' && !e.engaged && e.occupies(tx, ty)) { this.onEnemyTouch(e, { initiator: 'player' }); return; }
      }
    } else if (entity.type === 'enemy' && this.player.occupies(tx, ty)) {
      this.onEnemyTouch(entity, { initiator: 'enemy' });
    }
  }

  /** Called by Entity when a tile step completes. */
  onEntityStep(entity) {
    if (entity === this.player) {
      this.state.setPosition(this.mapId, entity.tileX, entity.tileY, entity.facing);
      if (this.inputLocked) return; // scripts, transitions and an engagement in progress own the player
      for (const z of this.zones) {
        const inside = entity.tileX >= z.x && entity.tileX < z.x + (z.w || 1) && entity.tileY >= z.y && entity.tileY < z.y + (z.h || 1);
        if (!inside) continue;
        if (z.type === 'exit') {
          if (z.condition && !evaluate(z.condition, this.state)) { if (z.refuse && this.scripts(z.refuse)) this.runner.run(z.refuse); continue; }
          this.changeMap(z.to.map, z.to.x, z.to.y, z.to.facing);
          return;
        }
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
    this.checkEnemyContact(entity);
  }

  scripts(id) { return !!this.gameData.scripts[id]; }

  /** A chasing enemy next to the player (after its own step, or the player's) has caught it. */
  checkEnemyContact(stepper) {
    if (this.inputLocked || !this.player) return;
    for (const e of this.entities.values()) {
      if (e.type !== 'enemy' || e.behavior !== 'chase' || e.engaged) continue;
      if (Math.abs(e.tileX - this.player.tileX) + Math.abs(e.tileY - this.player.tileY) === 1) {
        this.onEnemyTouch(e, { initiator: stepper === e ? 'enemy' : 'player' });
        return;
      }
    }
  }

  /**
   * An enemy and the player touched (either stepped into the other, a chaser caught up, or the player
   * pressed confirm facing it). Enemies with a `script` fight through it (the flavor line, {"battle"}
   * and its onWin flags); the rest run `encounter` directly. `ambush` (enemy behind the player: its
   * facing equals the player's when the enemy initiated contact) reaches the battle launch. After a
   * win the enemy is gone (setOnWin / the script's flags / despawn); after BAIL it idles 2 s.
   * @param {Entity} enemy
   * @param {{initiator?: 'enemy'|'player', emote?: boolean}} [opts]
   */
  async onEnemyTouch(enemy, { initiator = 'enemy', emote = true } = {}) {
    if (enemy.engaged || !enemy.active || this.inputLocked || this.leaving) return;
    const behavior = enemy.behavior;
    enemy.engaged = true;
    this.lockInput(true);
    try {
      enemy.faceToward(this.player);
      const ambush = initiator === 'enemy' && enemy.facing === this.player.facing;
      this.player.faceToward(enemy);
      if (emote) await enemy.showEmote('!', 350);
      let result = null;
      if (enemy.def.script) {
        await this.runner.run(enemy.def.script, { entity: enemy, ambush, onBattle: (r) => { result = r; } });
      } else {
        result = await this.startBattle(enemy.def.encounter, { ambush });
      }
      if (result === 'win') {
        if (enemy.def.setOnWin) this.state.set(enemy.def.setOnWin, true);
        if (enemy.def.onDefeat) await this.runner.run(enemy.def.onDefeat, { entity: enemy });
        this.despawnEntity(enemy.id);
      } else if (result === 'lose') {
        this.gameOver();
        return;
      } else if (enemy.active) {
        enemy.behavior = 'idle';
        this.time.delayedCall(scaleMs(2000), () => { if (enemy.active) { enemy.engaged = false; enemy.behavior = behavior; } });
      }
    } finally {
      this.lockInput(false);
      this.refreshConditions();
    }
  }

  // ---- sub-scenes --------------------------------------------------------------------------------

  /**
   * Launch Battle, sleep until it calls back (ARCHITECTURE §12.4).
   * @param {string} encounterId
   * @param {{ambush?: boolean}} [opts] ambush: the enemy touched the player from behind (enemies act first in round 1)
   */
  async startBattle(encounterId, { ambush = false } = {}) {
    const encounter = this.gameData.encounters[encounterId];
    if (!encounter) { console.error(`[explore] unknown encounter "${encounterId}"`); return 'win'; }
    services.ui.closeAll();
    audioCall('sfx', 'kraaang');
    await services.ui.fade('out', scaleMs(200));
    return this.runSub('Battle', { encounterId, encounter, background: this.mapDef.battleBackground || 'street', ambush: !!ambush });
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

  /** Close every UI widget, stop the sub-scenes and this one, and start `key`. Once per Explore run. */
  leaveTo(key, data) {
    if (this.leaving) return;
    this.leaving = true;
    services.ui.closeAll();
    for (const k of ['Battle', 'Menu', 'Freefall']) {
      if (this.scene.isActive(k) || this.scene.isPaused(k) || this.scene.isSleeping(k)) this.scene.stop(k);
    }
    this.scene.start(key, data);
  }

  gameOver(text) { this.leaveTo('GameOver', { text }); }

  /** Chapter end ({"title"}): back to the title with CONTINUE enabled; the most recent save is what it loads. */
  toTitle() { this.leaveTo('Title'); }

  // ---- camera effects (E12) ----------------------------------------------------------------------

  /**
   * Camera effects with the {"camera": …} script command shape. Resolves when the effect ends.
   *   shake ms intensity → whole-pixel viewport shake (+x −x +y −y per frame; 0.01→1 px … 0.04→6 px)
   *   flash ms color / fade in|out ms / pan {x,y,ms} / follow id
   *   bend N        screen-border bulge: 28 TileSprite strips of a frozen snapshot for N frames
   *   tear px frames  panel tear: halves offset ±px with a 2 px gap, snap back with a 4 px shake
   *   mosaic N      pixelate 1→16→1 over 2N frames (fade when filters are unavailable)
   */
  camera(fx) {
    const cam = this.cameras.main;
    const [r, g, b] = hexToRgb(fx.color, fx.flash !== undefined ? [255, 255, 255] : [0, 0, 0]);
    return new Promise((resolve) => {
      const done = () => resolve();
      if (fx.shake !== undefined) this.shake(scaleMs(fx.shake || 300), fx.intensity ?? 0.01, fx.px).then(done);
      else if (fx.flash !== undefined) { cam.once(CamEvents.FLASH_COMPLETE, done); cam.flash(scaleMs(fx.flash || 150), r, g, b, true); }
      else if (fx.fade === 'out') { cam.once(CamEvents.FADE_OUT_COMPLETE, done); cam.fadeOut(scaleMs(fx.ms || FADE_MS), r, g, b); }
      else if (fx.fade === 'in') { cam.once(CamEvents.FADE_IN_COMPLETE, done); cam.fadeIn(scaleMs(fx.ms || FADE_MS), r, g, b); }
      else if (fx.pan) { cam.stopFollow(); cam.once(CamEvents.PAN_COMPLETE, done); cam.pan(fx.pan.x, fx.pan.y, scaleMs(fx.pan.ms || 500), 'Sine.easeInOut', true); }
      else if (fx.follow) { const e = this.entities.get(fx.follow) || this.follower(fx.follow); if (e) cam.startFollow(e, true, 1, 1); done(); }
      else if (fx.bend !== undefined) this.bend(fx.bend || 60).then(done, (err) => { console.warn('[camera] bend failed', err); done(); });
      else if (fx.tear !== undefined) this.tear(fx.tear || 6, fx.frames || 6).then(done, (err) => { console.warn('[camera] tear failed', err); done(); });
      else if (fx.mosaic !== undefined) this.mosaic(fx.mosaic || 10).then(done, (err) => { console.warn('[camera] mosaic failed', err); done(); });
      else done();
    });
  }

  /** Frames → ms at 60 fps, honouring ?fast=1. */
  frameMs(frames) { return scaleMs(Math.round((frames * 1000) / 60)); }

  /** Whole-pixel viewport shake. Resolves when it ends. */
  shake(ms, intensity = 0.01, px) {
    const amount = px || (SHAKE_PX.find(([i]) => intensity <= i + 1e-9) || [0, 6])[1];
    return new Promise((resolve) => {
      if (this.fx.shake) this.fx.shake.resolve();
      this.fx.shake = { until: this.time.now + Math.max(16, ms), px: amount, phase: 0, resolve };
    });
  }

  updateShake() {
    const s = this.fx.shake;
    const cam = this.cameras.main;
    if (!s) return;
    if (this.time.now >= s.until) {
      this.fx.shake = null;
      cam.setPosition(0, 0);
      s.resolve();
      return;
    }
    const pattern = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [dx, dy] = pattern[s.phase++ % 4];
    cam.setPosition(dx * s.px, dy * s.px);
  }

  /** Freeze what the camera sees into a DynamicTexture (WebGL + Canvas). Returns the key or null. */
  snapshot() {
    const cam = this.cameras.main;
    if (this.textures.exists(SNAP_KEY)) this.textures.remove(SNAP_KEY);
    const dt = this.textures.addDynamicTexture(SNAP_KEY, WIDTH, HEIGHT);
    if (!dt) return null;
    dt.camera.setScroll(Math.round(cam.scrollX), Math.round(cam.scrollY));
    dt.camera.roundPixels = true;
    const list = this.children.list.filter((o) => o.visible && o !== this.debugText && !o.isFx);
    dt.draw(list);
    dt.render();
    return SNAP_KEY;
  }

  clearFx() {
    for (const o of this.fx.objects) if (o.active !== false) o.destroy();
    this.fx.objects = [];
  }

  fxObject(o) { o.isFx = true; o.setScrollFactor(0).setDepth(DEPTH.FX); this.fx.objects.push(o); return o; }

  /** Screen-border bend (Toon 2): strips wave with tilePositionX = round(amp·sin(t/8 + y/16)). */
  async bend(frames = 60) {
    const key = this.snapshot();
    if (!key) return this.shake(600, 0.03);
    this.clearFx();
    const strips = [];
    for (let y = 0; y < HEIGHT; y += BEND_STRIP) {
      const ts = this.add.tileSprite(0, y, WIDTH, BEND_STRIP, key).setOrigin(0, 0);
      ts.tilePositionY = y;
      strips.push(this.fxObject(ts));
    }
    const total = Math.max(2, Math.round(PARAMS.fast ? frames / 4 : frames));
    await new Promise((resolve) => {
      let t = 0;
      const ev = this.time.addEvent({
        delay: 16, repeat: total,
        callback: () => {
          t++;
          const amp = 6 * Math.sin(Math.PI * Math.min(1, t / total));
          strips.forEach((s, i) => { s.tilePositionX = Math.round(amp * Math.sin(t / 8 + (i * BEND_STRIP) / 16)); });
          if (t >= total) { ev.remove(); resolve(); }
        },
      });
    });
    this.clearFx();
  }

  /** Panel tear (Toon 3): top half +px, bottom half −px with a 2 px black gap, then a 4 px snap-back shake. */
  async tear(px = 6, frames = 6) {
    const key = this.snapshot();
    if (!key) return this.shake(300, 0.03);
    this.clearFx();
    // TileSprites (not cropped Images: those do not render from a DynamicTexture) so the halves
    // wrap at the screen edge like the bend strips do.
    const top = this.fxObject(this.add.tileSprite(0, 0, WIDTH, TEAR_SPLIT, key).setOrigin(0, 0));
    top.tilePositionX = -px;
    const bottom = this.fxObject(this.add.tileSprite(0, TEAR_SPLIT + 2, WIDTH, HEIGHT - TEAR_SPLIT - 2, key).setOrigin(0, 0));
    bottom.tilePositionX = px;
    bottom.tilePositionY = TEAR_SPLIT + 2;
    this.fxObject(this.add.rectangle(0, TEAR_SPLIT - 1, WIDTH, 3, 0x000000, 1).setOrigin(0, 0).setDepth(DEPTH.FX + 1));
    audioCall('sfx', 'tear');
    await new Promise((resolve) => this.time.delayedCall(this.frameMs(frames), resolve));
    this.clearFx();
    await this.shake(this.frameMs(8), 0.03, 4);
  }

  /** Mosaic: pixelate 1→2→4→8→16→8→4→2→1 over 2·frames (camera filter), else a fade out/in. */
  async mosaic(frames = 10) {
    const cam = this.cameras.main;
    const canFilter = this.isWebGL && cam.filters && cam.filters.internal && typeof cam.filters.internal.addPixelate === 'function';
    if (!canFilter) {
      await services.ui.fade('out', this.frameMs(frames));
      await services.ui.fade('in', this.frameMs(frames));
      return;
    }
    const sizes = [2, 4, 8, 16, 16, 8, 4, 2];
    const filter = cam.filters.internal.addPixelate(0);
    const stepMsValue = Math.max(8, this.frameMs((frames * 2) / sizes.length));
    try {
      for (const size of sizes) {
        filter.amount = size - 2;
        await new Promise((resolve) => this.time.delayedCall(stepMsValue, resolve));
      }
    } finally {
      cam.filters.internal.remove(filter);
    }
  }
}
