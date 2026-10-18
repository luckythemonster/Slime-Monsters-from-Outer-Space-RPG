// EventRunner: interprets event scripts (ARCHITECTURE §5 + DESIGN.md E6–E16). No Phaser import —
// it drives the Explore scene, the UI service and the audio service purely through their public
// interfaces, so tests/data.test.mjs can import `COMMANDS` in Node.
import { services } from './services.js';
import { evaluate, evaluateWith, contextFor, tokenize } from './Conditions.js';
import { expandVars } from './TextVars.js';
import { runShop } from './Shop.js';
import { PARAMS, SAVE_SLOTS, scaleMs } from '../config.js';

/** Every command key the runner understands (data tests validate scripts against this). */
export const COMMANDS = new Set([
  'say', 'choice', 'if', 'set', 'inc', 'give', 'take', 'party', 'move', 'face', 'teleport',
  'spawn', 'despawn', 'sprite', 'anim', 'emote', 'camera', 'wait', 'caption', 'music', 'sfx',
  'battle', 'scene', 'save', 'shop', 'run', 'label', 'goto', 'end', 'setEntity', 'gameover',
  'insert', 'title',
]);

const END = Symbol('end');

/** Default clipboard prompt (DESIGN.md "Controls & save"). */
export const SAVE_PROMPT = 'INITIAL HERE?';

/** Pick the command key out of a command object. */
export function commandKey(cmd) {
  for (const k of Object.keys(cmd)) if (COMMANDS.has(k)) return k;
  return null;
}

/** Identifier roots the condition evaluator knows (ARCHITECTURE §5.3). */
const EXPR_ROOTS = new Set(['flags', 'vars', 'money', 'chapter', 'map', 'party', 'inventory', 'level', 'true', 'false', 'null']);

/**
 * E7 rule: a `set`/`inc` string value is evaluated as a condition-expression when it tokenizes AND
 * either references a known state path (`flags.x`, `vars.x`, `money`, `party.size`,
 * `inventory.count('x')`, `level('x')`, `true/false/null`) or is pure arithmetic/comparison with
 * no stray words ("3 + 4", "'a' == 'b'"). Every other string stays a plain string
 * ("DRUMMER WANTED - MUST PLAY FAST" is text; "3 + vars.saveCount" is 3 + saveCount).
 * An expression that fails to evaluate keeps the literal string and logs a warning.
 * @param {string} src
 * @returns {boolean}
 */
export function isExpression(src) {
  if (typeof src !== 'string' || src.trim() === '') return false;
  let tokens;
  try { tokens = tokenize(src); } catch { return false; }
  if (!tokens.length) return false;
  const hasOp = tokens.some((t) => t.type === 'op' && t.value !== '.');
  const isRoot = (i) => tokens[i].type === 'id' && EXPR_ROOTS.has(tokens[i].value) && (i === 0 || !(tokens[i - 1].type === 'op' && tokens[i - 1].value === '.'));
  const hasRoot = tokens.some((_, i) => isRoot(i));
  // Identifiers that are neither a known root nor a path segment after "." mean prose, not math.
  const strayId = tokens.some((t, i) => t.type === 'id' && !isRoot(i) && !(i > 0 && tokens[i - 1].type === 'op' && tokens[i - 1].value === '.'));
  return hasRoot || (hasOp && !strayId);
}

/** Resolve a `set` value: expressions evaluate, everything else passes through. */
export function resolveValue(value, state) {
  if (!isExpression(value)) return value;
  try {
    return evaluateWithState(value, state);
  } catch (err) {
    console.warn(`[script] set: "${value}" looked like an expression but failed (${err.message}); kept as text`);
    return value;
  }
}

/** Evaluate an expression to its raw (non-boolean) value (`evaluate` would coerce to boolean). */
function evaluateWithState(expr, state) {
  return evaluateWith(expr, contextFor(state));
}

export class EventRunner {
  /**
   * @param {object} opts
   * @param {Record<string, object[]>} opts.scripts id → command array
   * @param {import('./GameState.js').GameState} opts.state
   * @param {object} opts.explore ExploreScene (ARCHITECTURE §12.3 interface)
   * @param {object} opts.characters characters.json
   * @param {object} [opts.speakers] merged speaker registry (characters + src/data/npcs/*.json)
   * @param {object} [opts.shops] shops.json
   */
  constructor({ scripts, state, explore, characters, speakers, shops }) {
    this.scripts = scripts;
    this.state = state;
    this.explore = explore;
    this.characters = (characters && characters.characters) || {};
    this.speakers = speakers || this.characters;
    this.shops = shops || (services.data && services.data.shops) || {};
    this.depth = 0;
    this.destroyed = false;
    /** Save slot used by autosaves; `?slot=N` overrides, the last manual page otherwise. */
    this.saveSlot = PARAMS.slot || 1;
  }

  get ui() { return services.ui; }
  get audio() { return services.audio; }
  get running() { return this.depth > 0; }

  /** Stop interpreting (scene shutdown). Pending awaits resolve into no-ops. */
  destroy() { this.destroyed = true; }

  /** Speaker entry (characters.json or src/data/npcs/*.json) for a `who`. */
  speaker(who) {
    if (!who) return null;
    return this.speakers[who] || this.characters[who] || null;
  }

  /**
   * Run a script by id. Locks Explore input for the outermost script and re-evaluates entity
   * conditions when it finishes. Resolves when the script is done (errors are logged, not thrown).
   * @param {string|object[]} id
   * @param {object} [ctx] e.g. { entity } for interactions
   */
  async run(id, ctx = {}) {
    const cmds = Array.isArray(id) ? id : this.scripts[id];
    if (!cmds) throw new Error(`EventRunner: unknown script "${id}"`);
    if (Array.isArray(id)) id = ctx.scriptId || '(inline)';
    this.depth++;
    if (this.depth === 1) this.explore.lockInput(true);
    try {
      await this.execScript(cmds, { ...ctx, scriptId: id });
    } catch (err) {
      console.error(`[script ${id}]`, err);
    } finally {
      this.depth--;
      if (this.depth === 0 && !this.destroyed) {
        this.explore.lockInput(false);
        this.explore.refreshConditions();
        if (typeof this.explore.refreshFollowers === 'function') this.explore.refreshFollowers();
        this.explore.events.emit('scriptend', id);
      }
    }
  }

  /**
   * Execute a command list. Returns END if an {"end"} was hit (propagates out of if/choice), or
   * `{ goto }` when a nested block jumps to a label that belongs to an enclosing list.
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
      let result = key === 'goto' ? { goto: cmd.goto } : await this[`cmd_${key}`](cmd[key], cmd, ctx);
      if (result === END) return END;
      if (result && result.goto !== undefined) {
        if (!labels.has(result.goto)) return result; // label lives in an enclosing list
        if (++guard > 10000) throw new Error('goto: infinite loop');
        i = labels.get(result.goto);
      }
    }
    return undefined;
  }

  /** Run a whole script body (top level): an escaping goto is an error, END is swallowed. */
  async execScript(cmds, ctx) {
    const result = await this.exec(cmds, ctx);
    if (result && result.goto !== undefined) throw new Error(`goto: unknown label "${result.goto}"`);
  }

  // ---- helpers ---------------------------------------------------------------------------------

  /** Resolve a `who` to a live entity ('player' allowed; followers are addressed by member id). */
  entity(who) {
    const id = who === 'player' ? 'player' : who;
    let e = this.explore.entities.get(id);
    if (!e && typeof this.explore.follower === 'function') e = this.explore.follower(id);
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

  text(s) { return expandVars(s, this.state); }

  async toast(text) {
    if (this.ui && typeof this.ui.toast === 'function') await this.ui.toast(this.text(text));
  }

  sfx(name) {
    const a = this.audio;
    if (a && typeof a.sfx === 'function') { try { a.sfx(name); } catch (err) { console.warn('[script] sfx failed', err); } }
  }

  // ---- commands --------------------------------------------------------------------------------

  /**
   * {"say": "text", "who": "dad", "portrait": "...", "collapse": true, "shake": true, "window": "ff"}
   * `who` resolves through the speaker registry (characters.json + src/data/npcs/*.json): name tag,
   * default portrait, `window` ("ff" = the FF blue gradient, "caption" = Ryan's square box) and
   * `blip` (text_blip pitch). `{var:…}` is expanded here so wrapping sees the final text.
   */
  async cmd_say(text, cmd) {
    const who = cmd.who || 'narrator';
    const def = this.speaker(who);
    await this.ui.say({
      text: this.text(text),
      who,
      name: cmd.name || (def ? def.name : undefined),
      portrait: cmd.portrait || (def ? def.portrait : undefined),
      window: cmd.window || (def ? def.window : undefined),
      blip: cmd.blip || (def ? def.blip : undefined),
      collapse: !!cmd.collapse,
      shake: !!cmd.shake,
    });
  }

  async cmd_choice(options, cmd, ctx) {
    const idx = await this.ui.choice(options.map((o) => this.text(o.text)), { cancelIndex: cmd.cancelIndex ?? -1 });
    const opt = options[idx];
    if (opt && opt.then) return this.exec(opt.then, ctx);
    return undefined;
  }

  async cmd_if(cond, cmd, ctx) {
    const branch = evaluate(cond, this.state) ? cmd.then : cmd.else;
    if (branch) return this.exec(branch, ctx);
    return undefined;
  }

  /** {"set": {"vars.contractPages": "3 + vars.saveCount"}} — strings that look like expressions evaluate (E7). */
  cmd_set(assignments) {
    for (const [path, value] of Object.entries(assignments)) this.state.set(path, resolveValue(value, this.state));
  }

  cmd_inc(assignments) {
    for (const [path, by] of Object.entries(assignments)) this.state.inc(path, Number(resolveValue(by, this.state)) || 1);
  }

  async cmd_give(arg) {
    if (arg.item) {
      const qty = arg.qty || 1;
      this.state.inventory.add(arg.item, qty);
      await this.toast(arg.toast || `Got ${this.itemName(arg.item)}${qty > 1 ? ` x${qty}` : ''}!`);
    }
    if (arg.money) {
      this.state.addMoney(arg.money);
      await this.toast(arg.toast || `Got $${arg.money}!`);
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
        await this.toast(arg.toast || `${def ? def.name : arg.add} joined the band!`);
        if (def && def.onJoin && this.scripts[def.onJoin]) await this.run(def.onJoin);
      }
    }
    if (arg.remove) this.state.party.remove(arg.remove);
    if (arg.heal) this.state.party.healAll();
    if (typeof this.explore.refreshFollowers === 'function') this.explore.refreshFollowers();
  }

  /**
   * {"move": {"who": "phoenix", "path": "LLUU", "wait": true, "speed": "walk|run", "collide": false}}
   * Scripted moves ignore collision by default (choreography must be deterministic); `collide: true`
   * opts back in. Large objects (E15) slide the same way.
   */
  async cmd_move(arg) {
    const e = this.entity(arg.who || 'player');
    const p = e.walkPath(arg.path, { speed: arg.speed || 'walk', ghost: arg.collide !== true });
    if (arg.wait !== false) await p;
  }

  cmd_face(arg) {
    const e = this.entity(arg.who || 'player');
    if (arg.toward) e.faceToward(this.entity(arg.toward));
    else if (arg.dir) e.face(arg.dir);
  }

  /** {"teleport": {"map", "x", "y", "facing", "fade": false}} */
  async cmd_teleport(arg) {
    await this.explore.changeMap(arg.map, arg.x, arg.y, arg.facing, { fade: arg.fade !== false });
  }

  /** {"spawn": {"id", "sprite", "x", "y", "facing", "type": "npc|object", "w", "footprint", "solid"}} */
  cmd_spawn(def) {
    this.explore.spawnEntity({ type: 'npc', behavior: 'idle', ...def });
  }

  cmd_despawn(id) { this.explore.despawnEntity(id); }

  cmd_sprite(arg) { this.entity(arg.who).setSheet(arg.sheet || arg.sprite); }

  async cmd_anim(arg) {
    const p = this.entity(arg.who).playAnim(arg.key, { wait: arg.wait !== false });
    if (arg.wait !== false) await p;
  }

  async cmd_emote(arg) {
    await this.entity(arg.who || 'player').showEmote(arg.type || '!', arg.ms);
  }

  async cmd_camera(arg) { await this.explore.camera(arg); }

  async cmd_wait(ms) { await this.delay(Number(ms) || 0); }

  /** {"caption": "ONE MONTH LATER", "ms": 1800, "style": "tape"|"flyer"} (E8) */
  async cmd_caption(text, cmd) {
    await this.ui.caption(this.text(text), PARAMS.fast ? 100 : (cmd.ms || 1500), { style: cmd.style || 'plain' });
  }

  /**
   * {"insert": {"sprite": "obj_flyer", "frame": 0, "text": "GIG TONIGHT…"}} (E9): a centred 128×72
   * window showing the sprite; with `text` a narrator line opens under it and confirm closes both,
   * without `text` (or the string form {"insert": "obj_flyer"}) confirm closes the window alone.
   */
  async cmd_insert(arg) {
    const opts = typeof arg === 'string' ? { sprite: arg } : { ...arg };
    if (opts.text !== undefined) opts.text = this.text(opts.text);
    if (typeof this.ui.insert === 'function') await this.ui.insert(opts);
    else if (opts.text) await this.ui.say({ text: opts.text, who: 'narrator' });
  }

  cmd_music(id) {
    const a = this.audio;
    if (!a) return;
    if (id === null || id === undefined || id === '') { if (typeof a.stopMusic === 'function') a.stopMusic({ fade: 300 }); }
    else if (typeof a.playMusic === 'function') a.playMusic(id, { fade: 300 });
  }

  cmd_sfx(name) { this.sfx(name); }

  /**
   * {"battle": "id", "onWin": [...], "onLose": "gameover" | [...]}. A script started by an enemy touch
   * carries `ctx.ambush` (touched from behind) into the launch and reports the result via `ctx.onBattle`.
   */
  async cmd_battle(encounterId, cmd, ctx) {
    const result = await this.explore.startBattle(encounterId, { ambush: !!ctx.ambush });
    if (typeof ctx.onBattle === 'function') ctx.onBattle(result);
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

  // ---- saving (E13) -----------------------------------------------------------------------------

  /** The slot autosaves go to: `?slot=N`, else the last page initialed, else page 1. */
  activeSlot() {
    return PARAMS.slot || this.state.slot || this.saveSlot || 1;
  }

  /** Silent autosave to the active slot ({"save": {"auto": true}}). Does not bump saveCount. */
  autosave() {
    const slot = this.activeSlot();
    try {
      this.state.save(slot);
      this.state.set('vars.lastAutosave', this.state.map);
      return slot;
    } catch (err) {
      console.warn('[script] autosave failed', err);
      return 0;
    }
  }

  /** One menu row per save page (slot) for the clipboard prompt. */
  slotRows() {
    const rows = [];
    const chars = this.characters;
    for (let slot = 1; slot <= SAVE_SLOTS; slot++) {
      const peek = this.state.peekSave(slot);
      if (!peek) { rows.push({ label: `PAGE ${slot}  - unsigned -`, hint: 'Nobody has initialed this page.' }); continue; }
      const mins = Math.floor((peek.playtimeMs || 0) / 60000);
      const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      const lv = peek.level;
      const map = (services.data && services.data.maps && services.data.maps[peek.map] && services.data.maps[peek.map].name) || peek.map || '?';
      const names = (peek.party || []).map((id) => (chars[id] ? chars[id].name : id)).join(' ');
      rows.push({
        label: `PAGE ${slot}  CH${peek.chapter || 1} ${time}${lv ? ` LV${lv}` : ''}`,
        hint: `${map} - ${names}`.slice(0, 28),
      });
    }
    return rows;
  }

  /**
   * {"save": true} / {"save": {"prompt": "INITIAL HERE TO…"}} → the clipboard prompt; {"save": {"auto": true}}
   * → silent autosave. A manual save bumps vars.saveCount, restores AMP and plays `save`.
   */
  async cmd_save(arg) {
    if (arg && typeof arg === 'object' && arg.auto) { this.autosave(); return; }
    const prompt = (arg && typeof arg === 'object' && arg.prompt) || SAVE_PROMPT;
    const rows = [{ label: this.text(prompt).slice(0, 28), disabled: true }, ...this.slotRows(), { label: 'DECLINE', hint: 'Not today.' }];
    const idx = await this.ui.menu(rows, { x: 8, y: 96, width: 240, cancelable: true, selected: Math.min(SAVE_SLOTS, this.activeSlot()) });
    const slot = idx >= 1 && idx <= SAVE_SLOTS ? idx : 0;
    if (!slot) {
      await this.ui.say({ text: 'The clipboard does not move.', who: 'narrator' });
      return;
    }
    const count = this.state.inc('vars.saveCount', 1);
    for (const m of this.state.party.members) this.state.party.heal(m.id, { amp: 999 });
    this.state.save(slot);
    this.saveSlot = slot;
    this.sfx('save');
    await this.toast(`You initial page ${count}. Bajonka sneezes.`);
  }

  async cmd_shop(shopId) {
    await runShop(shopId, { shops: this.shops, state: this.state, ui: this.ui, audio: this.audio });
  }

  async cmd_run(id, cmd, ctx) {
    const cmds = this.scripts[id];
    if (!cmds) throw new Error(`run: unknown script "${id}"`);
    await this.execScript(cmds, { ...ctx, scriptId: id });
  }

  cmd_label() { /* no-op; labels are indexed by exec() */ }

  cmd_end() { return END; }

  /** {"setEntity": {"id": "cop_a", "behavior": "idle", "sheet": "ryan_slimed", "x", "y", "facing", "solid", "visible"}} */
  cmd_setEntity(arg) {
    const e = this.entity(arg.id);
    const cfg = { ...arg };
    if (cfg.sheet !== undefined && cfg.sprite === undefined) cfg.sprite = cfg.sheet;
    e.configure(cfg);
  }

  cmd_gameover(text) {
    this.explore.gameOver(typeof text === 'string' ? text : undefined);
    return END;
  }

  /**
   * {"title": true} / {"title": {"fade": 1000}} — chapter end: fade to black, leave Explore and return to
   * the title with CONTINUE enabled (the page the preceding `save` initialed is the most recent save, so
   * it is what CONTINUE loads). Ends the script.
   */
  async cmd_title(arg) {
    const ms = arg && typeof arg === 'object' && arg.fade !== undefined ? Math.max(0, Number(arg.fade) || 0) : 1000;
    await this.ui.fade('out', scaleMs(ms));
    this.explore.toTitle();
    return END;
  }
}
