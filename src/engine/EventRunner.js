// EventRunner: interprets event scripts (ARCHITECTURE §5). No Phaser import — it drives the
// Explore scene, the UI service and the audio service purely through their public interfaces,
// so tests/data.test.mjs can import `COMMANDS` in Node.
import { services } from './services.js';
import { evaluate } from './Conditions.js';
import { PARAMS, scaleMs } from '../config.js';

/** Every command key the runner understands (data tests validate scripts against this). */
export const COMMANDS = new Set([
  'say', 'choice', 'if', 'set', 'inc', 'give', 'take', 'party', 'move', 'face', 'teleport',
  'spawn', 'despawn', 'sprite', 'anim', 'emote', 'camera', 'wait', 'caption', 'music', 'sfx',
  'battle', 'scene', 'save', 'shop', 'run', 'label', 'goto', 'end', 'setEntity', 'gameover',
]);

const END = Symbol('end');

/** Pick the command key out of a command object. */
export function commandKey(cmd) {
  for (const k of Object.keys(cmd)) if (COMMANDS.has(k)) return k;
  return null;
}

export class EventRunner {
  /**
   * @param {object} opts
   * @param {Record<string, object[]>} opts.scripts id → command array
   * @param {import('./GameState.js').GameState} opts.state
   * @param {object} opts.explore ExploreScene (ARCHITECTURE §12.3 interface)
   * @param {object} opts.characters characters.json
   */
  constructor({ scripts, state, explore, characters }) {
    this.scripts = scripts;
    this.state = state;
    this.explore = explore;
    this.characters = (characters && characters.characters) || {};
    this.depth = 0;
    this.destroyed = false;
    /** Save slot used by {"save": true}; `?slot=N` overrides. */
    this.saveSlot = PARAMS.slot || 1;
  }

  get ui() { return services.ui; }
  get audio() { return services.audio; }
  get running() { return this.depth > 0; }

  /** Stop interpreting (scene shutdown). Pending awaits resolve into no-ops. */
  destroy() { this.destroyed = true; }

  /**
   * Run a script by id. Locks Explore input for the outermost script and re-evaluates entity
   * conditions when it finishes. Resolves when the script is done (errors are logged, not thrown).
   * @param {string} id
   * @param {object} [ctx] e.g. { entity } for interactions
   */
  async run(id, ctx = {}) {
    const cmds = this.scripts[id];
    if (!cmds) throw new Error(`EventRunner: unknown script "${id}"`);
    this.depth++;
    if (this.depth === 1) this.explore.lockInput(true);
    try {
      await this.exec(cmds, { ...ctx, scriptId: id });
    } catch (err) {
      console.error(`[script ${id}]`, err);
    } finally {
      this.depth--;
      if (this.depth === 0 && !this.destroyed) {
        this.explore.lockInput(false);
        this.explore.refreshConditions();
        this.explore.events.emit('scriptend', id);
      }
    }
  }

  /**
   * Execute a command list. Returns END if an {"end"} was hit (propagates out of if/choice).
   * @param {object[]} cmds
   * @param {object} ctx
   */
  async exec(cmds, ctx) {
    const labels = new Map();
    cmds.forEach((c, i) => { if (c.label !== undefined) labels.set(c.label, i); });
    let guard = 0;
    for (let i = 0; i < cmds.length; i++) {
      if (this.destroyed) return END;
      const cmd = cmds[i];
      const key = commandKey(cmd);
      if (!key) throw new Error(`unknown command ${JSON.stringify(cmd)}`);
      if (key === 'goto') {
        if (!labels.has(cmd.goto)) throw new Error(`goto: unknown label "${cmd.goto}"`);
        if (++guard > 10000) throw new Error('goto: infinite loop');
        i = labels.get(cmd.goto);
        continue;
      }
      const result = await this[`cmd_${key}`](cmd[key], cmd, ctx);
      if (result === END) return END;
    }
    return undefined;
  }

  // ---- helpers ---------------------------------------------------------------------------------

  /** Resolve a `who` to a live entity ('player' allowed). */
  entity(who) {
    const e = this.explore.entities.get(who === 'player' ? 'player' : who);
    if (!e) throw new Error(`no entity "${who}" on this map`);
    return e;
  }

  delay(ms) {
    return new Promise((resolve) => this.explore.time.delayedCall(scaleMs(ms), resolve));
  }

  itemName(id) {
    const def = this.state.inventory.def(id);
    return def ? def.name : id;
  }

  async toast(text) {
    if (this.ui && typeof this.ui.toast === 'function') await this.ui.toast(text);
  }

  // ---- commands --------------------------------------------------------------------------------

  async cmd_say(text, cmd) {
    const who = cmd.who || 'narrator';
    const def = this.characters[who];
    await this.ui.say({
      text,
      who,
      name: cmd.name || (def ? def.name : undefined),
      portrait: cmd.portrait || (def ? def.portrait : undefined),
    });
  }

  async cmd_choice(options, cmd, ctx) {
    const idx = await this.ui.choice(options.map((o) => o.text), { cancelIndex: cmd.cancelIndex ?? -1 });
    const opt = options[idx];
    if (opt && opt.then) return this.exec(opt.then, ctx);
    return undefined;
  }

  async cmd_if(cond, cmd, ctx) {
    const branch = evaluate(cond, this.state) ? cmd.then : cmd.else;
    if (branch) return this.exec(branch, ctx);
    return undefined;
  }

  cmd_set(assignments) {
    for (const [path, value] of Object.entries(assignments)) this.state.set(path, value);
  }

  cmd_inc(assignments) {
    for (const [path, by] of Object.entries(assignments)) this.state.inc(path, Number(by) || 1);
  }

  async cmd_give(arg) {
    if (arg.item) {
      const qty = arg.qty || 1;
      this.state.inventory.add(arg.item, qty);
      await this.toast(`Got ${this.itemName(arg.item)}${qty > 1 ? ` x${qty}` : ''}!`);
    }
    if (arg.money) {
      this.state.addMoney(arg.money);
      await this.toast(`Got $${arg.money}!`);
    }
  }

  async cmd_take(arg) {
    if (arg.item) this.state.inventory.remove(arg.item, arg.qty || 1);
    if (arg.money) this.state.addMoney(-arg.money);
  }

  async cmd_party(arg) {
    if (arg.add) {
      const was = this.state.party.has(arg.add);
      this.state.party.add(arg.add);
      const def = this.characters[arg.add];
      if (!was) {
        await this.toast(`${def ? def.name : arg.add} joined the band!`);
        if (def && def.onJoin && this.scripts[def.onJoin]) await this.run(def.onJoin);
      }
    }
    if (arg.remove) this.state.party.remove(arg.remove);
    if (arg.heal) this.state.party.healAll();
  }

  async cmd_move(arg) {
    const e = this.entity(arg.who || 'player');
    const p = e.walkPath(arg.path, { speed: arg.speed || 'walk' });
    if (arg.wait !== false) await p;
  }

  cmd_face(arg) {
    const e = this.entity(arg.who || 'player');
    if (arg.toward) e.faceToward(this.entity(arg.toward));
    else if (arg.dir) e.face(arg.dir);
  }

  async cmd_teleport(arg) {
    await this.explore.changeMap(arg.map, arg.x, arg.y, arg.facing);
  }

  cmd_spawn(def) {
    this.explore.spawnEntity({ type: 'npc', behavior: 'idle', ...def });
  }

  cmd_despawn(id) { this.explore.despawnEntity(id); }

  cmd_sprite(arg) { this.entity(arg.who).setSheet(arg.sheet); }

  async cmd_anim(arg) {
    const p = this.entity(arg.who).playAnim(arg.key, { wait: arg.wait !== false });
    if (arg.wait !== false) await p;
  }

  async cmd_emote(arg) {
    await this.entity(arg.who || 'player').showEmote(arg.type || '!', arg.ms);
  }

  async cmd_camera(arg) { await this.explore.camera(arg); }

  async cmd_wait(ms) { await this.delay(Number(ms) || 0); }

  async cmd_caption(text, cmd) {
    await this.ui.caption(text, PARAMS.fast ? 100 : (cmd.ms || 1500));
  }

  cmd_music(id) {
    const a = this.audio;
    if (!a) return;
    if (id === null || id === undefined || id === '') { if (typeof a.stopMusic === 'function') a.stopMusic({ fade: 300 }); }
    else if (typeof a.playMusic === 'function') a.playMusic(id, { fade: 300 });
  }

  cmd_sfx(name) {
    const a = this.audio;
    if (a && typeof a.sfx === 'function') a.sfx(name);
  }

  async cmd_battle(encounterId, cmd, ctx) {
    const result = await this.explore.startBattle(encounterId);
    if (result === 'win' && Array.isArray(cmd.onWin)) return this.exec(cmd.onWin, ctx);
    if (result === 'lose') {
      if (Array.isArray(cmd.onLose)) return this.exec(cmd.onLose, ctx);
      this.explore.gameOver(typeof cmd.onLose === 'string' && cmd.onLose !== 'gameover' ? cmd.onLose : undefined);
      return END;
    }
    return undefined;
  }

  async cmd_scene(key, cmd) {
    const sceneKey = key.charAt(0).toUpperCase() + key.slice(1);
    await this.explore.runSpecialScene(sceneKey, cmd.data || {});
  }

  async cmd_save() {
    const slot = this.saveSlot;
    const idx = await this.ui.choice(['Save', "Don't save"], { cancelIndex: 1 });
    if (idx === 0) {
      this.state.save(slot);
      if (this.audio && typeof this.audio.sfx === 'function') this.audio.sfx('save');
      await this.toast(`Saved (slot ${slot}).`);
    }
  }

  async cmd_shop(shopId) {
    await this.ui.say({ text: `Shop coming soon. (${shopId})`, who: 'narrator' });
  }

  async cmd_run(id, cmd, ctx) {
    const cmds = this.scripts[id];
    if (!cmds) throw new Error(`run: unknown script "${id}"`);
    await this.exec(cmds, { ...ctx, scriptId: id });
  }

  cmd_label() { /* no-op; labels are indexed by exec() */ }

  cmd_end() { return END; }

  cmd_setEntity(arg) {
    const e = this.entity(arg.id);
    e.configure(arg);
  }

  cmd_gameover(text) {
    this.explore.gameOver(typeof text === 'string' ? text : undefined);
    return END;
  }
}
