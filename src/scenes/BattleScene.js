// BattleScene: presentation layer for engine/battle/BattleModel (ARCHITECTURE §8, §12.4; DESIGN.md
// "Battle system"; design_feel.md "Battle system (presentation focus)").
// Launched by ExploreScene.runSub('Battle', { encounterId, encounter, background, onDone, ambush? }).
// Contract: build the fight, drive the model, drain its events into animation, then
// `await services.ui.fade('out')`, `this.scene.stop()`, `onDone('win'|'lose'|'flee')`.
// Explore has already faded to black before launching us, so the "static burst" plays on OUR first
// frame: the laid-out battle is covered by 28 noise/black strips that slide apart alternately and
// flicker (20 frames, 8 under ?fast=1), then the two windows slide up and the count-in plays.
// Nothing here may throw when a sheet / frame / sfx / song is missing: every lookup falls back
// (battle sheet → <id>_battle → the overworld sheet's idle frame → a flat placeholder).
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { audioCall } from '../engine/Audio.js';
import { WIDTH, HEIGHT, PIXEL_FONT, PARAMS, scaleMs } from '../config.js';
import { buildBattle, applyResults } from '../engine/battle/setup.js';
import { battleData } from '../engine/battle/data.js';
import { makeRng } from '../engine/battle/rng.js';
import { STATUS } from '../engine/battle/statuses.js';
import BattleHUD from '../ui/BattleHUD.js';
import BattleBackground from '../ui/BattleBackground.js';
import { spawnDamage } from '../ui/DamageText.js';
import { COLORS, textStyle } from '../ui/theme.js';
import { UI_KEY } from '../ui/atlas.js';

const FRAME = 1000 / 60;
const DEPTH = { bg: 0, word: 90, enemy: 100, party: 110, fx: 200, icons: 210, burst: 900 };
const FEET_Y = 144;
const KIT = { x: 228, y: 144 };
const WORD_SHEETS = { pop: 'word_pop', kraaang: 'word_kraaang', krathoom: 'word_krathoom', doom: 'word_doom', crack: 'word_crack', thud: 'word_thud', pow: 'word_pow', thwap: 'word_thwap', bonk: 'word_bonk' };
const WORD_SFX = { pop: 'slime_pop', kraaang: 'kraaang', krathoom: 'kraaang', doom: 'drum_hit', crack: 'cymbal', thud: 'drum_hit' };
const STATUS_SHORT = { DAZED: 'DZ', DEAF: 'DF', OUT_OF_TUNE: 'OT', TEMPO_DOWN: 'T-', TEMPO_UP: 'T+', BRISTLING: 'BR', SLIMED: 'SL', BAKED: 'BK', ON_HOLD: 'OH', DEADPAN: 'DP', BASS_DOWN: 'B-', BASS_UP: 'B+' };
const HIT_WORDS = ['pow', 'thwap', 'bonk'];
const T = { text: 420, hit: 220, turn: 160, word: 520, ko: 260, status: 200, join: 400 };

function hashColor(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  const r = 96 + ((h >>> 0) % 128), g = 96 + ((h >>> 8) % 128), b = 96 + ((h >>> 16) % 128);
  return (r << 16) | (g << 8) | b;
}

export default class BattleScene extends Phaser.Scene {
  constructor() { super({ key: 'Battle' }); }

  init(data) {
    this.encounterId = data.encounterId;
    this.launchEncounter = data.encounter || null;
    this.backgroundId = data.background || 'street';
    this.ambush = !!data.ambush;
    this.onDone = data.onDone;
    this.finished = false;
    this.actors = new Map();
    this.words = [];
    this.shake = null;
    this.burst = null;
    this.inputLocked = false;
    this.lastErr = null;
  }

  get ui() { return services.ui; }

  create() {
    this.cameras.main.roundPixels = true;
    this.cameras.main.setScroll(0, 0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    try {
      this.data_ = battleData(services.data || {});
      const enc = this.launchEncounter || this.data_.encounters[this.encounterId] || { name: this.encounterId, enemies: [] };
      this.encounter = enc;
      this.model = buildBattle({ state: services.state, data: this.data_, encounterId: this.encounterId, encounter: enc, rng: makeRng(), ambush: this.ambush });
      services.battle = this;
      this.bg = new BattleBackground(this, enc.background || this.backgroundId, { depth: DEPTH.bg });
      this.bg.setToonLevel(this.model.toonLevel);
      for (const c of this.model.combatants) this.makeActor(c);
      this.layoutEnemies(true);
      this.hud = new BattleHUD(this, this.model);
      this.hud.setTear(0);
    } catch (err) {
      console.error('[battle] setup failed:', err);
      this.finish('win');
      return;
    }
    this.run().catch((err) => {
      console.error('[battle] run failed:', err && err.stack ? err.stack : err);
      this.finish(this.model && this.model.result ? this.model.result : 'win');
    });
  }

  cleanup() {
    if (services.battle === this) services.battle = null;
    if (this.hud) this.hud.destroy();
    if (this.bg) this.bg.destroy();
    this.actors.clear();
  }

  // ---- main loop -------------------------------------------------------------------------------

  async run() {
    await this.entry();
    this.model.start();
    await this.playEvents(this.model.drain());
    while (!this.model.ended && !this.finished) {
      const turn = this.model.advance();
      await this.playEvents(this.model.drain());
      if (!turn) break;
      this.hud.refresh();
      this.setActiveActor(turn.actor.uid);
      let action;
      if (turn.needsInput) action = await this.chooseAction(turn.actor);
      else { await this.wait(T.turn); action = this.model.decide(turn.actor); }
      if (this.finished) break;
      if (!this.model.act(turn.actor.uid, action)) this.model.act(turn.actor.uid, { cmd: 'tune' });
      await this.playEvents(this.model.drain());
      this.setActiveActor(null);
    }
    await this.playEvents(this.model.drain());
    await this.end();
  }

  async end() {
    if (this.finished) return;
    const result = this.model.result || 'flee';
    const summary = applyResults(services.state, this.model);
    if (result === 'win') {
      this.playVictory();
      this.hud.refresh();
      await this.wait(T.text);
      await this.hud.rewards(summary, this.model);
    } else if (result === 'lose') {
      await this.wait(T.text * 2);
    }
    await this.finish(result);
  }

  /** @param {'win'|'lose'|'flee'} result */
  async finish(result) {
    if (this.finished) return;
    this.finished = true;
    if (this.hud) this.hud.closeMenus();
    await this.ui.fade('out', scaleMs(300));
    const cb = this.onDone;
    this.scene.stop();
    if (cb) cb(result);
    this.ui.fade('in', scaleMs(200));
  }

  // ---- entry: static burst, windows, count-in ----------------------------------------------------

  async entry() {
    this.makeNoiseTexture();
    const strips = [];
    const n = HEIGHT / 8;
    for (let i = 0; i < n; i++) {
      const black = this.add.rectangle(0, i * 8, WIDTH, 8, 0x000000, 1).setOrigin(0, 0).setDepth(DEPTH.burst);
      const noise = this.add.image(0, i * 8, '__bnoise').setOrigin(0, 0).setDepth(DEPTH.burst + 1);
      strips.push({ black, noise, dir: i % 2 === 0 ? 1 : -1 });
    }
    await this.ui.fade('in', 1);
    audioCall('sfx', 'feedback');
    const frames = PARAMS.fast ? 8 : 20;
    const speeds = PARAMS.fast ? [8, 16, 24, 32] : [4, 8, 12, 16];
    for (let f = 0; f < frames; f++) {
      const v = speeds[Math.min(3, Math.floor((f * 4) / frames))];
      for (const s of strips) {
        s.black.x += s.dir * v; s.noise.x += s.dir * v;
        s.noise.setVisible(Math.floor(f / 2) % 2 === 0);
        if (f >= frames - 6) { s.black.alpha -= 1 / 6; s.noise.alpha -= 1 / 6; }
      }
      await this.nextFrame();
    }
    for (const s of strips) { s.black.destroy(); s.noise.destroy(); }
    await this.hud.slideIn();
    await this.countIn();
    this.playMusic(this.encounter.music || 'battle');
  }

  makeNoiseTexture() {
    if (this.textures.exists('__bnoise')) return;
    const tex = this.textures.createCanvas('__bnoise', WIDTH, 8);
    if (!tex) return;
    const ctx = tex.context;
    for (let y = 0; y < 8; y++) for (let x = 0; x < WIDTH; x++) { const v = Math.floor(Math.random() * 4) * 60; ctx.fillStyle = `rgb(${v},${v},${v + 20})`; ctx.fillRect(x, y, 1, 1); }
    tex.refresh();
  }

  /** 1-2-3-4 at 180 BPM (count_* frames when the ui atlas has them, else 16 px digits); the song starts after "4". */
  async countIn() {
    const beat = scaleMs(333);
    if (this.encounter.countIn === 'lucky') {
      for (let i = 1; i <= 4; i++) this.time.delayedCall(beat * (i - 1), () => this.sfx('count_click', 'drum_hit'));
      await this.ui.say({ who: 'lucky', text: '{speed:instant}One, two, three, four!' });
      return;
    }
    for (let i = 1; i <= 4; i++) {
      this.sfx('count_click', 'drum_hit');
      let obj;
      const frame = `count_${i}`;
      if (this.textures.exists(UI_KEY) && this.textures.get(UI_KEY).has(frame)) obj = this.add.image(WIDTH / 2, 96, UI_KEY, frame).setDepth(DEPTH.fx);
      else obj = this.add.text(WIDTH / 2, 96, String(i), { fontFamily: PIXEL_FONT, fontSize: '16px', color: '#f4f4f4', resolution: 1 }).setOrigin(0.5).setDepth(DEPTH.fx);
      obj.setShadow && obj.setShadow(2, 2, '#141018', 0, false, true);
      this.shakeFor(1, 60);
      await this.wait(beat);
      obj.destroy();
    }
  }

  // ---- actors ------------------------------------------------------------------------------------

  /** Resolve a sheet for a combatant: battle sheet → <id>_battle → overworld sheet → placeholder. */
  resolveSheet(c, sheetOverride = null) {
    const form = c.forms && c.form ? c.forms[c.form] : null;
    const cands = [sheetOverride, c.sprite, c.sprite ? `${c.sprite}_battle` : null, `${c.id}_battle`, ...((form && form.fallbacks) || []), c.mapSprite, c.id].filter(Boolean);
    for (const key of cands) {
      if (!this.textures.exists(key)) continue;
      const tex = this.textures.get(key);
      const f0 = tex.has(0) ? tex.get(0) : tex.get('__BASE');
      const kind = f0 && f0.width === 16 && f0.height === 24 ? 'map' : 'battle';
      return { key, kind, w: f0 ? f0.width : c.size, h: f0 ? f0.height : c.size };
    }
    return { key: this.placeholderTexture(c.sprite || c.id, c.size || 32), kind: 'placeholder', w: c.size || 32, h: c.size || 32 };
  }

  /** Like resolveSheet but only among the given candidates; null when none exists. */
  resolveSheetFrom(c, cands) {
    for (const key of cands.filter(Boolean)) {
      if (!this.textures.exists(key)) continue;
      const tex = this.textures.get(key);
      const f0 = tex.has(0) ? tex.get(0) : tex.get('__BASE');
      const kind = f0 && f0.width === 16 && f0.height === 24 ? 'map' : 'battle';
      return { key, kind, w: f0 ? f0.width : c.size, h: f0 ? f0.height : c.size };
    }
    return null;
  }

  placeholderTexture(name, size) {
    const key = `__bph_${name}_${size}`;
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x141018, 1); g.fillRect(0, 0, size, size);
    g.fillStyle(hashColor(name), 1); g.fillRect(2, 2, size - 4, size - 4);
    g.fillStyle(0x141018, 1); g.fillRect(Math.floor(size * 0.3), Math.floor(size * 0.35), 3, 3); g.fillRect(Math.floor(size * 0.6), Math.floor(size * 0.35), 3, 3);
    g.generateTexture(key, size, size);
    g.destroy();
    return key;
  }

  makeActor(c) {
    const sheet = this.resolveSheet(c);
    const root = this.add.container(0, 0).setDepth(c.side === 'enemy' ? DEPTH.enemy : DEPTH.party);
    const view = { uid: c.uid, c, root, sheet: null, sprite: null, label: null, icons: [], baseX: 0, baseY: 0, stepped: false };
    this.actors.set(c.uid, view);
    this.applySheet(view, sheet);
    this.placeActor(view);
    return view;
  }

  applySheet(view, sheet) {
    if (view.sprite) { view.sprite.destroy(); view.sprite = null; }
    if (view.label) { view.label.destroy(); view.label = null; }
    view.sheet = sheet;
    const c = view.c;
    const spr = this.add.sprite(0, 0, sheet.key, 0).setOrigin(0.5, 1);
    if (sheet.kind === 'map') {
      const idle = `${sheet.key}_idle_left`;
      if (this.anims.exists(idle)) spr.play(idle);
      spr.setFlipX(c.side === 'enemy');
    } else if (sheet.kind === 'battle') {
      const idle = `${sheet.key}_idle`;
      if (this.anims.exists(idle)) spr.play(idle);
    } else {
      view.label = this.add.text(0, -Math.floor(sheet.h / 2), (c.name || c.id).slice(0, Math.max(3, Math.floor(sheet.w / 8))), textStyle(COLORS.white)).setOrigin(0.5, 0.5);
      view.label.setShadow(1, 1, '#141018', 0, false, true);
    }
    view.sprite = spr;
    view.root.add(spr);
    if (view.label) view.root.add(view.label);
    view.w = sheet.w; view.h = sheet.h;
    this.refreshIcons(view);
  }

  partySlot(c) {
    const members = this.model.party().filter((m) => m.present);
    const hasKit = members.some((m) => m.auto);
    if (c.auto) return { x: KIT.x, y: KIT.y };
    const i = members.filter((m) => !m.auto).indexOf(c);
    return { x: (hasKit ? 180 : 212) - 4 * i, y: 72 + 28 * i };
  }

  placeActor(view) {
    const c = view.c;
    if (c.side === 'party') {
      const s = this.partySlot(c);
      view.baseX = s.x; view.baseY = s.y;
    }
    if (c.form === 'eternity') { view.baseX = 140; view.baseY = 144; view.root.setDepth(DEPTH.party + 5); }
    view.root.setPosition(view.baseX - (view.stepped ? 8 : 0), view.baseY);
  }

  /** Enemies left of x 144, feet on y 144; 32 px start at x 32, bigger ones at 40; gaps shrink to fit. */
  layoutEnemies(instant = false) {
    const list = this.model.enemies().filter((c) => c.present && !c.ko && !c.fled && !c.offPanel);
    const widths = list.map((c) => c.size || 32);
    const total = widths.reduce((a, b) => a + b, 0);
    let gap = 16; let start = widths.some((w) => w > 32) ? 40 : 32;
    if (start + total + gap * (list.length - 1) > 144) { gap = 8; }
    if (start + total + gap * (list.length - 1) > 144) { gap = 4; start = 16; }
    let x = start;
    list.forEach((c, i) => {
      const view = this.actors.get(c.uid);
      const w = widths[i];
      const cx = x + Math.floor(w / 2);
      x += w + gap;
      if (!view) return;
      view.baseX = cx; view.baseY = FEET_Y;
      if (instant) view.root.setPosition(cx, FEET_Y);
      else this.tweens.add({ targets: view.root, x: cx, y: FEET_Y, duration: scaleMs(150), onUpdate: () => { view.root.x = Math.round(view.root.x); } });
    });
    for (const view of this.actors.values()) if (view.c.side === 'party') this.placeActor(view);
  }

  setActiveActor(uid) {
    for (const v of this.actors.values()) {
      const on = v.uid === uid && v.c.side === 'party';
      if (v.stepped !== on) { v.stepped = on; v.root.x = v.baseX - (on ? 8 : 0); }
    }
    if (this.hud) this.hud.setActive(uid);
  }

  refreshIcons(view) {
    for (const i of view.icons) i.destroy();
    view.icons = [];
    const c = view.c;
    const ids = (c.status || []).map((s) => s.id).filter((id) => STATUS[id]);
    if (c.tuning) ids.push('TUNING');
    ids.slice(0, 3).forEach((id, i) => {
      const frame = (STATUS[id] || {}).icon;
      const x = -8 + i * 9, y = -view.h - 10;
      let obj;
      if (frame && this.textures.exists(UI_KEY) && this.textures.get(UI_KEY).has(frame)) obj = this.add.image(x, y, UI_KEY, frame).setOrigin(0, 0);
      else obj = this.add.text(x, y, STATUS_SHORT[id] || 'TU', textStyle(id === 'TUNING' ? COLORS.blue : COLORS.yellow)).setOrigin(0, 0);
      view.root.add(obj);
      view.icons.push(obj);
    });
  }

  viewBounds(view) {
    return { uid: view.uid, x: view.root.x, y: view.root.y - Math.floor(view.h / 2), w: view.w, h: view.h, name: view.c.name, side: view.c.side };
  }

  // ---- player input -----------------------------------------------------------------------------

  async chooseAction(actor) {
    const m = this.model;
    let selected = 0;
    for (;;) {
      if (this.finished || m.ended) return { cmd: 'tune' };
      const cmds = m.commands(actor.uid);
      const id = await this.hud.commandMenu(cmds, selected);
      if (!id) continue;
      selected = Math.max(0, cmds.findIndex((c) => c.id === id));
      if (id === 'tune') return { cmd: 'tune' };
      if (id === 'bail') return { cmd: 'bail' };
      if (id === 'strum') {
        const t = await this.pickTarget(m.targetsFor(actor.uid, 'strum'));
        if (t === null) continue;
        return { cmd: 'strum', target: t };
      }
      if (id === 'riff') {
        const entries = [...m.riffMenu(actor.uid)];
        const syncs = m.syncMenu(actor.uid);
        if (syncs.length) entries.push({ divider: true, label: 'SYNC' }, ...syncs);
        const e = await this.hud.listMenu(entries);
        if (!e) continue;
        if (e.kind === 'sync') return { cmd: 'sync', sync: e.id };
        const t = await this.pickTarget(m.targetsFor(actor.uid, 'riff', e.id));
        if (t === null) continue;
        return { cmd: 'riff', riff: e.id, target: t };
      }
      if (id === 'noise') {
        const e = await this.hud.listMenu(m.noiseMenu(actor.uid));
        if (!e) continue;
        const t = await this.pickTarget(m.targetsFor(actor.uid, 'noise', e.id));
        if (t === null) continue;
        return { cmd: 'noise', word: e.id, target: t };
      }
      if (id === 'item') {
        const e = await this.hud.listMenu(m.usableItems());
        if (!e) continue;
        const t = await this.pickTarget(m.targetsFor(actor.uid, 'item', e.id));
        if (t === null) continue;
        return { cmd: 'item', item: e.id, target: t };
      }
    }
  }

  /** Returns a uid, undefined (no choice needed) or null (cancelled). */
  async pickTarget({ mode, targets }) {
    if (mode === 'none' || mode === 'self' || mode === 'allEnemies' || mode === 'party' || mode === 'all') return undefined;
    const views = targets.map((uid) => this.actors.get(uid)).filter(Boolean).map((v) => this.viewBounds(v));
    if (!views.length) return undefined;
    const uid = await this.hud.targetMenu(views);
    return uid === null ? null : uid;
  }

  update(time, delta) {
    if (this.bg) this.bg.update(delta);
    if (this.hud) this.hud.update(delta);
    this.updateShake();
    const input = services.input;
    if (this.hud && this.hud.hasMenu() && input && !(this.ui && this.ui.isBusy())) {
      for (const a of ['up', 'down', 'left', 'right', 'confirm', 'cancel']) if (input.justPressed(a)) { this.hud.onAction(a); break; }
    }
  }

  // ---- event playback ---------------------------------------------------------------------------

  async playEvents(events) {
    for (const ev of events) {
      if (this.finished) return;
      try { await this.playEvent(ev); } catch (err) { console.error('[battle] event failed:', ev && ev.type, err && err.stack ? err.stack : err); }
    }
  }

  async playEvent(ev) {
    const m = this.model;
    switch (ev.type) {
      case 'round': case 'setlist': case 'roundEnd':
        this.hud.refresh();
        break;
      case 'turn':
        this.setActiveActor(ev.who);
        this.hud.refresh();
        break;
      case 'text':
        this.hud.showMessage(ev.text);
        await this.wait(T.text);
        break;
      case 'say':
        this.hud.clearMessage();
        await this.ui.say({ who: ev.who, text: ev.text, portrait: ev.portrait });
        break;
      case 'caption':
        this.hud.clearMessage();
        this.sfx('caption_tick', 'cursor');
        await this.ui.say({ who: 'ryan_caption', text: ev.text });
        break;
      case 'toast':
        this.ui.toast(ev.text, scaleMs(1400));
        break;
      case 'anim':
        await this.playAnim(ev.who, ev.key);
        break;
      case 'damage':
        await this.showDamage(ev);
        break;
      case 'heal': {
        const v = this.actors.get(ev.target);
        if (v) { this.sfx('item'); await spawnDamage(this, v.root.x, v.root.y - v.h, { amount: ev.amount, heal: true }); }
        this.hud.refreshStatus();
        break;
      }
      case 'amp':
        this.hud.refreshStatus();
        break;
      case 'meter':
        this.hud.setMeter(ev.value, ev.level, { beige: m.hasBrian() });
        break;
      case 'toon':
        await this.onToonLevel(ev.level);
        break;
      case 'transform':
        await this.transform(ev);
        break;
      case 'mood': {
        // Lucky's palette as HUD: the mood sheet (lucky_battle_rage …) or its overworld variant
        // (lucky_rage …) when present; never a tint. Calm restores the base battle sheet.
        const v = this.actors.get(ev.who);
        if (v) {
          const want = ev.mood === 'calm' ? this.resolveSheet(v.c) : this.resolveSheetFrom(v.c, [ev.sheet, `${v.c.id}_battle_${ev.mood}`, `${v.c.id}_${ev.mood}`]);
          if (want && want.key !== v.sheet.key) { this.applySheet(v, want); this.sfx('slime_pop'); }
          if (v.c.ko) this.showKoFrame(v);
        }
        break;
      }
      case 'status': {
        const v = this.actors.get(ev.target);
        if (v) this.refreshIcons(v);
        if (ev.on && ev.status !== 'ON_HOLD') { const v2 = this.actors.get(ev.target); if (v2) { this.hud.showMessage(`${v2.c.name}: ${STATUS[ev.status] ? STATUS[ev.status].name : ev.status}`); await this.wait(T.status); } }
        this.hud.refreshStatus();
        break;
      }
      case 'ko':
        await this.showKo(ev.who);
        break;
      case 'leave':
        await this.showLeave(ev);
        break;
      case 'join':
        await this.showJoin(ev);
        break;
      case 'spawn':
        await this.showSpawn(ev);
        break;
      case 'scan':
        await this.hud.showScan(ev.info);
        break;
      case 'word':
        await this.showWord(ev);
        break;
      case 'background':
        this.bg.setId(ev.id);
        this.bg.setToonLevel(m.toonLevel);
        break;
      case 'uiTear':
        this.hud.setTear(ev.level);
        this.sfx('tear', 'feedback');
        break;
      case 'lockInput':
        this.inputLocked = !!ev.on;
        if (ev.on) this.hud.closeMenus();
        break;
      case 'music':
        if (ev.id) this.playMusic(ev.id); else audioCall('stopMusic', { fade: 0.2 });
        break;
      case 'sfx':
        this.sfx(ev.name);
        break;
      case 'shake':
        this.shakeFor(ev.px || 2, scaleMs(ev.ms || 300));
        break;
      case 'flash':
        await this.ui.flash(scaleMs(ev.ms || 150));
        break;
      case 'wait':
        await this.wait(ev.ms || 300);
        break;
      case 'win': case 'lose': case 'flee': case 'reward': case 'levelup': case 'skip': case 'sync': case 'start':
        break;
      default:
        break;
    }
  }

  async playAnim(who, key) {
    const v = this.actors.get(who === 'word' ? '__none' : who);
    if (who === 'word') { await this.swingWord(key); return; }
    if (!v) return;
    const anim = `${v.sheet.key}_${key}`;
    const idle = v.sheet.kind === 'map' ? `${v.sheet.key}_idle_left` : `${v.sheet.key}_idle`;
    if (this.anims.exists(anim)) {
      v.sprite.play(anim);
      if (this.anims.exists(idle)) v.sprite.chain(idle);
    }
    if (key === 'attack' || key === 'riff' || key === 'drum') {
      const dx = v.c.side === 'party' ? -8 : 8;
      await new Promise((resolve) => this.tweens.chain({ targets: v.root, tweens: [{ x: v.root.x + dx, duration: scaleMs(60) }, { x: v.root.x, duration: scaleMs(60) }], onUpdate: () => { v.root.x = Math.round(v.root.x); }, onComplete: resolve }));
    } else if (key === 'tune') {
      await new Promise((resolve) => this.tweens.chain({ targets: v.root, tweens: [{ y: v.root.y - 2, duration: scaleMs(60) }, { y: v.root.y, duration: scaleMs(60) }], onComplete: resolve }));
    } else if (key === 'mohawk_off') {
      this.sfx('mohawk_off', 'slime_pop');
      const hair = this.add.rectangle(v.root.x, v.root.y - v.h, 6, 6, 0x39ff8a, 1).setDepth(DEPTH.fx);
      await new Promise((resolve) => this.tweens.add({ targets: hair, x: hair.x + 48, y: hair.y + 40, angle: 180, duration: scaleMs(400), ease: 'Quad.easeIn', onComplete: () => { hair.destroy(); resolve(); } }));
    }
  }

  async showDamage(ev) {
    const v = this.actors.get(ev.target);
    if (!v) return;
    const x = v.root.x, top = v.root.y - v.h;
    if (ev.miss) { await spawnDamage(this, x, top, { miss: true }); return; }
    if (ev.amount > 0) {
      // hit flash (tint FILL) 4 frames, then 2 frames of 2 px horizontal jitter
      const spr = v.sprite;
      if (spr && spr.setTintMode) spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      const hurt = `${v.sheet.key}_hurt`;
      if (this.anims.exists(hurt)) { spr.play(hurt); const idle = `${v.sheet.key}_idle`; if (this.anims.exists(idle)) spr.chain(idle); }
      if (ev.crit) this.shakeFor(2, scaleMs(120));
      if (ev.scripted && ev.amount >= 999) this.shakeFor(4, scaleMs(300));
      this.hitWord(v, ev);
      const p = spawnDamage(this, x, top, { amount: ev.amount, crit: ev.crit });
      await this.frames(4);
      if (spr && spr.clearTint) { spr.clearTint(); spr.setTintMode(Phaser.TintModes.MULTIPLY); }
      v.root.x = v.baseX - (v.stepped ? 8 : 0) + 2; await this.frames(1);
      v.root.x = v.baseX - (v.stepped ? 8 : 0) - 2; await this.frames(1);
      v.root.x = v.baseX - (v.stepped ? 8 : 0);
      this.hud.refreshStatus();
      await Promise.race([p, this.wait(T.hit)]);
    } else {
      await this.wait(T.hit / 2);
    }
  }

  /** Every hit spawns a small POW / THWAP / BONK word scaled by Toon level (level 1+). */
  hitWord(view, ev) {
    const lvl = this.model.toonLevel;
    if (lvl < 1 || ev.scripted) return;
    const word = HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)];
    const key = WORD_SHEETS[word];
    const x = view.root.x + (view.c.side === 'enemy' ? 12 : -12), y = view.root.y - Math.floor(view.h / 2);
    let obj;
    if (this.textures.exists(key)) obj = this.add.image(x, y, key, 0).setDepth(DEPTH.fx);
    else obj = this.add.text(x, y, word.toUpperCase(), { fontFamily: PIXEL_FONT, fontSize: `${8 * Math.min(2, lvl)}px`, color: '#ffe066', resolution: 1 }).setOrigin(0.5).setDepth(DEPTH.fx);
    if (obj.setShadow) obj.setShadow(1, 1, '#141018', 0, false, true);
    obj.setAngle(Phaser.Math.Between(-15, 15));
    this.tweens.add({ targets: obj, y: y - 8, alpha: 0, duration: scaleMs(400), delay: scaleMs(120), onComplete: () => obj.destroy() });
  }

  /** NOISE words: Toon ≥ 2 letters are physical (fall in with a bounce and stay); below, pop and fade. */
  async showWord(ev) {
    const word = ev.word || 'pop';
    this.sfx(WORD_SFX[word] || 'kraaang');
    const key = WORD_SHEETS[word];
    const physical = this.model.toonLevel >= 2 || ev.scripted;
    const targetX = physical ? 40 + Phaser.Math.Between(0, 80) : 72;
    const targetY = physical ? 140 : 80;
    let obj;
    if (this.textures.exists(key)) obj = this.add.image(targetX, -24, key, 0).setOrigin(0.5, 1).setDepth(DEPTH.word + (physical ? 0 : 20));
    else {
      const size = ev.level >= 4 ? 16 : (ev.level >= 2 ? 16 : 8);
      obj = this.add.text(targetX, -24, word.toUpperCase() + (word === 'pop' ? '!' : ''), { fontFamily: PIXEL_FONT, fontSize: `${size}px`, color: ev.level >= 4 ? '#e0b0ff' : '#f4f4f4', resolution: 1 }).setOrigin(0.5, 1).setDepth(DEPTH.word + (physical ? 0 : 20));
      obj.setShadow(2, 2, ev.level >= 4 ? '#3a1050' : '#141018', 0, false, true);
    }
    if (physical) {
      this.words.push(obj);
      await new Promise((resolve) => this.tweens.add({ targets: obj, y: targetY, duration: scaleMs(320), ease: 'Bounce.easeOut', onUpdate: () => { obj.y = Math.round(obj.y); }, onComplete: resolve }));
      this.shakeFor(ev.level >= 3 ? 4 : 2, scaleMs(200));
      if (word === 'kraaang') await this.swingWord('kraaang_swing', obj);
      if (this.words.length > 6) { const old = this.words.shift(); old.destroy(); }
    } else {
      obj.setPosition(targetX, targetY);
      await new Promise((resolve) => this.tweens.add({ targets: obj, y: targetY - 10, alpha: 0, duration: scaleMs(T.word), ease: 'Quad.easeOut', onComplete: () => { obj.destroy(); resolve(); } }));
    }
  }

  /** The G swings like a bat (word_g sheet when present, else a 16 px "G"). */
  async swingWord(key, anchor = null) {
    const x = anchor ? anchor.x + 24 : 96, y = anchor ? anchor.y - 8 : 120;
    const g = this.textures.exists('word_g') ? this.add.image(x, y, 'word_g', 0).setOrigin(0.5, 1).setDepth(DEPTH.fx)
      : this.add.text(x, y, 'G', { fontFamily: PIXEL_FONT, fontSize: '16px', color: '#ffe066', resolution: 1 }).setOrigin(0.5, 1).setDepth(DEPTH.fx);
    this.sfx('kraaang');
    this.shakeFor(2, scaleMs(300));
    await new Promise((resolve) => this.tweens.chain({ targets: g, tweens: [{ angle: -60, duration: scaleMs(120) }, { angle: 70, duration: scaleMs(90), ease: 'Quad.easeIn' }, { angle: 0, duration: scaleMs(160) }], onComplete: resolve }));
    g.destroy();
  }

  async showKo(uid) {
    const v = this.actors.get(uid);
    if (!v) return;
    if (v.c.side === 'party') { this.showKoFrame(v); await this.wait(T.ko); this.hud.refreshStatus(); return; }
    // enemy: 8-frame horizontal slice dissolve (4 strips sliding alternately off), fallback fade
    try {
      const spr = v.sprite;
      const w = v.w, h = v.h;
      const strips = [];
      for (let i = 0; i < 4; i++) {
        const sh = Math.floor(h / 4);
        const img = this.add.image(v.root.x, v.root.y, spr.texture.key, spr.frame.name).setOrigin(0.5, 1).setDepth(DEPTH.enemy + 1);
        img.setFlipX(spr.flipX);
        img.setCrop(0, i * sh, w, sh);
        strips.push(img);
      }
      v.root.setVisible(false);
      await new Promise((resolve) => {
        let done = 0;
        strips.forEach((img, i) => this.tweens.add({ targets: img, x: img.x + (i % 2 ? 24 : -24), alpha: 0, duration: scaleMs(8 * FRAME * 2), ease: 'Linear', onUpdate: () => { img.x = Math.round(img.x); }, onComplete: () => { img.destroy(); if (++done === strips.length) resolve(); } }));
      });
    } catch (err) {
      await new Promise((resolve) => this.tweens.add({ targets: v.root, alpha: 0, duration: scaleMs(T.ko), onComplete: resolve }));
    }
    v.root.setVisible(false);
    this.layoutEnemies();
  }

  showKoFrame(v) {
    const ko = `${v.sheet.key}_ko`;
    if (this.anims.exists(ko)) v.sprite.play(ko);
    else if (v.sheet.kind === 'map' && this.anims.exists(`${v.sheet.key}_puddle`)) v.sprite.play(`${v.sheet.key}_puddle`);
    else if (v.sheet.kind === 'map' && this.anims.exists(`${v.sheet.key}_melt`)) v.sprite.play(`${v.sheet.key}_melt`);
    else { v.sprite.setAngle(90); v.sprite.setAlpha(0.6); }
  }

  async showLeave(ev) {
    const v = this.actors.get(ev.who);
    if (!v) return;
    if (ev.how === 'offPanel') {
      await new Promise((resolve) => this.tweens.add({ targets: v.root, x: v.root.x + 120, y: -40, angle: 540, duration: scaleMs(450), ease: 'Quad.easeIn', onComplete: resolve }));
    } else {
      await new Promise((resolve) => this.tweens.add({ targets: v.root, x: -40, duration: scaleMs(400), ease: 'Quad.easeIn', onUpdate: () => { v.root.x = Math.round(v.root.x); }, onComplete: resolve }));
    }
    v.root.setVisible(false);
    this.layoutEnemies();
  }

  async showJoin(ev) {
    const c = this.model.find(ev.who);
    if (!c) return;
    const v = this.makeActor(c);
    this.layoutEnemies();
    v.root.x = WIDTH + 24;
    this.sfx('squelch');
    await new Promise((resolve) => this.tweens.add({ targets: v.root, x: v.baseX, duration: scaleMs(T.join), ease: 'Quad.easeOut', onUpdate: () => { v.root.x = Math.round(v.root.x); }, onComplete: resolve }));
    this.hud.refresh();
  }

  async showSpawn(ev) {
    const c = this.model.find(ev.who);
    if (!c) return;
    const v = this.makeActor(c);
    this.layoutEnemies();
    v.root.x = -40;
    this.sfx('door');
    await new Promise((resolve) => this.tweens.add({ targets: v.root, x: v.baseX, duration: scaleMs(T.join), ease: 'Quad.easeOut', onUpdate: () => { v.root.x = Math.round(v.root.x); }, onComplete: resolve }));
    this.hud.refresh();
  }

  async transform(ev) {
    const v = this.actors.get(ev.who);
    if (!v) return;
    const sheet = this.resolveSheet(v.c, ev.sheet);
    this.sfx('squelch');
    await this.ui.flash(scaleMs(80));
    this.applySheet(v, sheet);
    if (ev.form === 'eternity') {
      v.w = 64; v.h = 64;
      if (sheet.kind === 'placeholder') { this.applySheet(v, { key: this.placeholderTexture('ryan_eternity', 64), kind: 'placeholder', w: 64, h: 64 }); this.eternityPlaceholderTint(v); }
      this.placeActor(v);
      this.shakeFor(4, scaleMs(600));
      await this.wait(T.text);
    }
    this.hud.refresh();
  }

  /** Placeholder Eternity: a slow purple-black palette cycle so the finisher still reads. */
  eternityPlaceholderTint(v) {
    const cols = [0x3a1050, 0x6a2a8a, 0xa050c0, 0x1a0a2a];
    let i = 0;
    this.time.addEvent({ delay: scaleMs(90), loop: true, callback: () => { if (v.sprite && v.sprite.active) v.sprite.setTint(cols[i++ % cols.length]); } });
  }

  async onToonLevel(level) {
    this.sfx('toon_up', 'level_up');
    this.bg.setToonLevel(level);
    if (level >= 3) this.hud.setTear(level >= 4 ? 3 : 2);
    if (level >= 4) { this.hud.setMoodColor('purple'); this.shakeFor(4, scaleMs(400)); }
    else this.shakeFor(1, scaleMs(120));
    this.hud.showMessage(`TOON ${level}!`);
    await this.wait(T.status);
  }

  // ---- helpers ----------------------------------------------------------------------------------

  sfx(name, fallback = null) {
    const a = services.audio;
    const known = (n) => { try { return !!(a && (a.has ? a.has(n) : (a.sfxNames ? a.sfxNames.includes(n) : true))); } catch { return true; } };
    const names = [name, fallback].filter(Boolean);
    for (const n of names) if (known(n)) { audioCall('sfx', n); return; }
  }

  playMusic(id) {
    const a = services.audio;
    const has = (s) => { try { return !!(a && a.songs && typeof a.songs.has === 'function' ? a.songs.has(s) : true); } catch { return false; } };
    if (has(id)) audioCall('playMusic', id, { fade: 0.1 });
    else if (id === 'eternity') audioCall('stopMusic', { fade: 0.3 });
    else if (has('battle')) audioCall('playMusic', 'battle', { fade: 0.1 });
  }

  playVictory() {
    const a = services.audio;
    if (a && a.songs && typeof a.songs.has === 'function' && a.songs.has('victory')) audioCall('playMusic', 'victory', { fade: 0 });
    else { audioCall('stopMusic', { fade: 0.1 }); this.sfx('win_sting', 'level_up'); }
  }

  /** Integer camera shake: alternates +x, −x, +y, −y per frame for `ms`. */
  shakeFor(px, ms) {
    const until = this.time.now + ms;
    if (!this.shake || px >= this.shake.px) this.shake = { px: Math.max(1, Math.round(px)), until };
    else this.shake.until = Math.max(this.shake.until, until);
  }

  updateShake() {
    const cam = this.cameras.main;
    if (!this.shake) return;
    if (this.time.now >= this.shake.until) { this.shake = null; cam.setScroll(0, 0); return; }
    const f = this.game.loop.frame % 4;
    const p = this.shake.px;
    cam.setScroll(f === 0 ? p : f === 1 ? -p : 0, f === 2 ? p : f === 3 ? -p : 0);
  }

  wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(scaleMs(ms), resolve));
  }

  frames(n) {
    return new Promise((resolve) => {
      let c = 0;
      const h = () => { if (++c >= n) { this.events.off(Phaser.Scenes.Events.POST_UPDATE, h); resolve(); } };
      this.events.on(Phaser.Scenes.Events.POST_UPDATE, h);
    });
  }

  nextFrame() { return this.frames(1); }
}
