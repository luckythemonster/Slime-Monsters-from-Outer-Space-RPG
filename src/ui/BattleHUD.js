// Battle HUD (docs/DESIGN.md "Battle system", design_feel.md "Battle HUD"): SETLIST strip, TOON
// meter, enemy-name / scan windows, the 2×3 command window, the party status window, cursor menus
// (riff / item / noise submenus with right-aligned costs and grayed reasons), the target hand, the
// message strip and the SET BREAK rewards window. Everything sits on whole pixels. Windows are the
// shared 9-slice `Window` from the ui atlas; menus are driven by `onAction(action)` which the
// BattleScene feeds from Input.justPressed each frame.
import Phaser from 'phaser';
import Window from './Window.js';
import { COLORS, CHAR_W, LINE_H, textStyle, sfx, DEPTH as UI_DEPTH } from './theme.js';
import { UI_KEY } from './atlas.js';
import { services } from '../engine/services.js';
import { scaleMs } from '../config.js';

// DESIGN.md "Battle HUD pixel map". The RIFF/ITEM/NOISE submenu is wider than the map's x 8..160
// (riff names are 15 characters plus a right-aligned cost) and sits at y 84..144 so the hover hint in
// the message strip (y 144) stays visible — a documented deviation.
export const LAYOUT = {
  setlistY: 4,
  meter: { x: 152, y: 14, w: 96, h: 8, segments: 4, labelX: 152, labelY: 4 },
  enemyName: { x: 8, y: 14, w: 128, h: 20 },
  scan: { x: 8, y: 26, w: 168, h: 48 },
  message: { x: 8, y: 144, w: 240, h: 14 },
  command: { x: 8, y: 160, w: 104, h: 56, cols: 2, rowH: 16, pad: 8, colW: 48 },
  status: { x: 112, y: 160, w: 136, h: 56, rowH: 12, nameX: 116, iconX: 170, hpX: 220, ampX: 244 }, // icon 170 (map says 174) keeps 2 px clear of a 5-char HP
  submenu: { x: 8, y: 84, w: 176, h: 60, rows: 4 },
  rewards: { x: 40, y: 52, w: 176, h: 120 },
};
const METER_FRAMES = ['meter_seg_pink', 'meter_seg_green', 'meter_seg_purple', 'meter_seg_black'];

const DEPTH = { base: 400, text: 402, cursor: 403, strip: 404, message: 405, menu: 410, rewards: 420 };
const MOOD = { pink: '#ff5fd2', magenta: '#ff1aa0', purple: '#a050c0', beige: '#e8c890' };
const LEVEL_COLORS = [0xff5fd2, 0x39ff8a, 0xa050c0, 0x141018];
const AUTO_MS = 60;
const PARTY_COLORS = { lucky: 0xff5fd2, phoenix: 0x8c8ca0, brian: 0x40c0ff, ryan: 0xb02828 };

const hasFrame = (scene, frame) => scene.textures.exists(UI_KEY) && scene.textures.get(UI_KEY).has(frame);

/** A cursor-driven menu: grid (cols) or scrolling list; items { label, right?, disabled?, reason?, divider? }. */
class CursorMenu {
  constructor(hud, { x, y, w, h, items, cols = 1, rows = null, selected = 0, cancelable = true, win = null, depth = DEPTH.menu, onHover = null, rowH = LINE_H, colW = null, textDy = 2 }) {
    this.hud = hud;
    this.scene = hud.scene;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.items = items;
    this.cols = cols;
    this.rows = rows || Math.ceil(items.length / cols);
    this.rowH = rowH;
    this.fixedColW = colW;
    this.textDy = textDy;
    this.pad = 8;
    this.cancelable = cancelable;
    this.depth = depth;
    this.onHover = onHover;
    this.ownWindow = !win;
    this.win = win || new Window(this.scene, x, y, w, h, { depth });
    this.labels = [];
    this.rights = [];
    this.offset = 0;
    this.selected = this.firstEnabled(selected);
    this.state = 'idle';
    this.resolve = null;
    this.auto = null;
  }

  firstEnabled(start) {
    const n = this.items.length;
    if (!n) return 0;
    start = ((start % n) + n) % n;
    for (let k = 0; k < n; k++) { const i = (start + k) % n; if (!this.items[i].disabled && !this.items[i].divider) return i; }
    return start;
  }

  async open() {
    this.state = 'opening';
    if (this.ownWindow) await this.win.open(!!services.ui?.textInstant);
    else if (!this.win.visible) await this.win.open(true);
    if (this.state !== 'opening') return -1;
    this.cursor = this.scene.add.image(0, 0, UI_KEY, hasFrame(this.scene, 'cursor') ? 'cursor' : undefined).setOrigin(0, 0).setDepth(this.depth + 3);
    this.render();
    this.state = 'open';
    services.input?.consume?.();
    if (services.ui?.autoAdvance) {
      this.auto = this.scene.time.delayedCall(AUTO_MS, () => { this.auto = null; if (this.state === 'open') this.choose(this.firstEnabled(services.ui.chooseIndex | 0)); });
    }
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  colW() { return this.fixedColW || Math.floor((this.w - this.pad * 2) / this.cols); }

  render() {
    for (const l of this.labels) l.destroy();
    for (const r of this.rights) r.destroy();
    this.labels = []; this.rights = [];
    const cw = this.colW();
    const visibleRows = this.rows;
    if (this.cols === 1) {
      const row = this.selected;
      if (row < this.offset) this.offset = row;
      if (row >= this.offset + visibleRows) this.offset = row - visibleRows + 1;
    }
    this.items.forEach((it, i) => {
      const c = i % this.cols;
      const r = Math.floor(i / this.cols) - this.offset;
      if (r < 0 || r >= visibleRows) return;
      const lx = this.x + this.pad + c * cw + 10;
      const ly = this.y + this.pad + r * this.rowH + this.textDy;
      const color = it.divider ? COLORS.disabled : (it.disabled ? COLORS.disabled : COLORS.text);
      const label = it.divider ? `-${String(it.label || 'SYNC').padEnd(cw / CHAR_W - 3, '-')}` : it.label;
      this.labels.push(this.scene.add.text(lx, ly, label, textStyle(color)).setDepth(this.depth + 2));
      if (it.right !== undefined && it.right !== null && !it.divider) {
        const rt = this.scene.add.text(this.x + this.pad + (c + 1) * cw, ly, String(it.right), textStyle(color)).setOrigin(1, 0).setDepth(this.depth + 2);
        this.rights.push(rt);
      }
    });
    this.placeCursor();
  }

  placeCursor() {
    if (!this.cursor) return;
    const i = this.selected;
    const c = i % this.cols;
    const r = Math.floor(i / this.cols) - this.offset;
    this.cursor.setPosition(this.x + this.pad + c * this.colW(), this.y + this.pad + r * this.rowH + this.textDy);
    if (this.onHover) this.onHover(this.items[i], i);
  }

  move(dr, dc) {
    const n = this.items.length;
    if (n < 2) return;
    let c = this.selected % this.cols;
    let r = Math.floor(this.selected / this.cols);
    const rows = Math.ceil(n / this.cols);
    let idx = this.selected;
    for (let k = 0; k < rows * this.cols; k++) {
      if (dr) r = (r + dr + rows) % rows; else c = (c + dc + this.cols) % this.cols;
      idx = r * this.cols + c;
      if (idx < n && !this.items[idx].divider) break;
      idx = -1;
    }
    if (idx >= 0 && idx !== this.selected) {
      this.selected = idx;
      sfx('cursor');
      if (this.cols === 1) this.render(); else this.placeCursor();
    }
  }

  onAction(action) {
    if (this.state !== 'open') return;
    switch (action) {
      case 'up': this.move(-1, 0); break;
      case 'down': this.move(1, 0); break;
      case 'left': if (this.cols > 1) this.move(0, -1); break;
      case 'right': if (this.cols > 1) this.move(0, 1); break;
      case 'confirm': {
        const it = this.items[this.selected];
        if (!it || it.disabled || it.divider) { sfx('cancel'); if (it && it.reason && this.hud) this.hud.showMessage(it.reason); }
        else { sfx('confirm'); this.choose(this.selected); }
        break;
      }
      case 'cancel': if (this.cancelable) { sfx('cancel'); this.choose(-1); } break;
      default: break;
    }
  }

  async choose(index) {
    if (this.state !== 'open') return;
    this.state = 'closing';
    this.clear();
    if (this.ownWindow) { await this.win.close(!!services.ui?.textInstant); this.win.destroy(); }
    this.finish(index);
  }

  clear() {
    if (this.auto) { this.auto.remove(); this.auto = null; }
    for (const l of this.labels) l.destroy();
    for (const r of this.rights) r.destroy();
    this.labels = []; this.rights = [];
    if (this.cursor) { this.cursor.destroy(); this.cursor = null; }
  }

  forceClose() {
    if (this.state === 'closed') return;
    this.state = 'closing';
    this.clear();
    if (this.ownWindow && this.win) this.win.destroy();
    this.finish(-1);
  }

  finish(v) {
    this.state = 'closed';
    const r = this.resolve; this.resolve = null;
    if (this.hud.activeMenu === this) this.hud.activeMenu = null;
    if (r) r(v);
  }
}

/** Target picker: the hand cursor 4 px left of a combatant sprite. */
class TargetPicker {
  constructor(hud, targets, { onHover = null } = {}) {
    this.hud = hud;
    this.scene = hud.scene;
    this.targets = targets; // [{ uid, x, y, w, h, name }]
    this.i = 0;
    this.onHover = onHover;
    this.state = 'idle';
    this.resolve = null;
  }

  open() {
    this.cursor = this.scene.add.image(0, 0, UI_KEY, hasFrame(this.scene, 'cursor') ? 'cursor' : undefined).setOrigin(0, 0).setDepth(DEPTH.cursor + 10);
    this.place();
    this.state = 'open';
    services.input?.consume?.();
    if (services.ui?.autoAdvance) this.auto = this.scene.time.delayedCall(AUTO_MS, () => { this.auto = null; if (this.state === 'open') this.choose(this.targets[Math.min(this.i, this.targets.length - 1)].uid); });
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  place() {
    const t = this.targets[this.i];
    if (!t || !this.cursor) return;
    this.cursor.setPosition(Math.round(t.x - t.w / 2 - 4 - 8), Math.round(t.y - t.h / 2 - 4));
    if (this.onHover) this.onHover(t);
  }

  onAction(action) {
    if (this.state !== 'open') return;
    const n = this.targets.length;
    if (action === 'up' || action === 'left') { this.i = (this.i - 1 + n) % n; sfx('cursor'); this.place(); }
    else if (action === 'down' || action === 'right') { this.i = (this.i + 1) % n; sfx('cursor'); this.place(); }
    else if (action === 'confirm') { sfx('confirm'); this.choose(this.targets[this.i].uid); }
    else if (action === 'cancel') { sfx('cancel'); this.choose(null); }
  }

  choose(v) {
    if (this.state !== 'open') return;
    this.state = 'closed';
    if (this.auto) { this.auto.remove(); this.auto = null; }
    if (this.cursor) { this.cursor.destroy(); this.cursor = null; }
    if (this.hud.activeMenu === this) this.hud.activeMenu = null;
    const r = this.resolve; this.resolve = null;
    if (r) r(v);
  }

  forceClose() { this.choose(null); }
}

/** A one-shot "press confirm" window (rewards / scan). */
class Prompt {
  constructor(hud) { this.hud = hud; this.state = 'open'; this.resolve = null; }
  open() {
    services.input?.consume?.();
    if (services.ui?.autoAdvance) this.auto = this.hud.scene.time.delayedCall(scaleMs(400), () => { this.auto = null; this.done(); });
    return new Promise((resolve) => { this.resolve = resolve; });
  }
  onAction(a) { if (a === 'confirm' || a === 'cancel') { sfx('confirm'); this.done(); } }
  done() { if (this.state !== 'open') return; this.state = 'closed'; if (this.auto) { this.auto.remove(); this.auto = null; } if (this.hud.activeMenu === this) this.hud.activeMenu = null; const r = this.resolve; this.resolve = null; if (r) r(); }
  forceClose() { this.done(); }
}

export default class BattleHUD {
  /**
   * @param {Phaser.Scene} scene BattleScene
   * @param {import('../engine/battle/BattleModel.js').BattleModel} model
   */
  constructor(scene, model) {
    this.scene = scene;
    this.model = model;
    this.activeMenu = null;
    this.tear = 0;
    this.tearFrame = 0;
    this.windows = [];
    this.setlistCells = [];
    this.statusRows = [];
    this.activeUid = null;
    this.beige = false;
    this.build();
  }

  build() {
    const s = this.scene;
    const L = LAYOUT;
    this.commandWin = new Window(s, L.command.x, L.command.y, L.command.w, L.command.h, { depth: DEPTH.base });
    this.statusWin = new Window(s, L.status.x, L.status.y, L.status.w, L.status.h, { depth: DEPTH.base });
    this.windows.push(this.commandWin, this.statusWin);
    // TOON meter: 24 tiles of 4×8 from the ui atlas (meter_seg_* / meter_off) when present, else Graphics.
    this.meterG = s.add.graphics().setDepth(DEPTH.strip);
    this.meterTiles = [];
    if (hasFrame(s, 'meter_off') && METER_FRAMES.every((f) => hasFrame(s, f))) {
      for (let i = 0; i < L.meter.w / 4; i++) this.meterTiles.push(s.add.image(L.meter.x + i * 4, L.meter.y, UI_KEY, 'meter_off').setOrigin(0, 0).setDepth(DEPTH.strip));
    }
    this.meterLabel = s.add.text(L.meter.labelX, L.meter.labelY, 'TOON 0', textStyle(COLORS.text)).setDepth(DEPTH.strip);
    // message strip
    this.msgBack = s.add.rectangle(L.message.x, L.message.y, L.message.w, L.message.h, 0x10101c, 0.9).setOrigin(0, 0).setDepth(DEPTH.message).setVisible(false);
    this.msgText = s.add.text(L.message.x + 4, L.message.y + 3, '', textStyle(COLORS.text)).setDepth(DEPTH.message + 1).setVisible(false);
    // status rows: NAME x116, status icon x174, HP right-aligned at x220, AMP at x244
    for (let i = 0; i < 4; i++) {
      const y = L.status.y + 6 + i * L.status.rowH;
      this.statusRows.push({
        y,
        name: s.add.text(L.status.nameX, y, '', textStyle(COLORS.text)).setDepth(DEPTH.text).setVisible(false),
        hp: s.add.text(L.status.hpX, y, '', textStyle(COLORS.text)).setOrigin(1, 0).setDepth(DEPTH.text).setVisible(false),
        amp: s.add.text(L.status.ampX, y, '', textStyle(COLORS.text)).setOrigin(1, 0).setDepth(DEPTH.text).setVisible(false),
        icon: null,
      });
    }
    this.setMeter(this.model.meter, this.model.toonLevel);
    this.setVisible(false);
  }

  setVisible(v) {
    for (const w of this.windows) w.setVisible(v);
    this.meterG.setVisible(v); this.meterLabel.setVisible(v);
    for (const t of this.meterTiles) t.setVisible(v);
    for (const r of this.statusRows) { r.name.setVisible(v && r.name.text !== ''); r.hp.setVisible(v && r.hp.text !== ''); r.amp.setVisible(v && r.amp.text !== ''); if (r.icon) r.icon.setVisible(v); }
    for (const c of this.setlistCells) { c.rect.setVisible(v); c.letter.setVisible(v); c.cross.setVisible(v && c.consumed); }
  }

  /** Windows slide up from y 224 to their rows over 6 frames; everything else appears. */
  slideIn() {
    this.setVisible(true);
    this.refresh();
    const wins = [this.commandWin, this.statusWin];
    for (const w of wins) { w.open(true); w.y = 224; }
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: wins, y: LAYOUT.command.y, duration: scaleMs(100), ease: 'Linear',
        onUpdate: () => { for (const w of wins) w.y = Math.round(w.y); },
        onComplete: () => { for (const w of wins) w.moveTo(w.x, LAYOUT.command.y); this.refresh(); resolve(); },
      });
    });
  }

  // ---- per-frame --------------------------------------------------------------------------------

  update() {
    // autoAdvance may be switched on while a menu is already open (tests): schedule its auto-pick now.
    const mnu = this.activeMenu;
    if (mnu && mnu.state === 'open' && !mnu.auto && services.ui?.autoAdvance) {
      mnu.auto = this.scene.time.delayedCall(AUTO_MS, () => {
        mnu.auto = null;
        if (mnu.state !== 'open') return;
        if (mnu.targets) mnu.choose(mnu.targets[Math.min(mnu.i, mnu.targets.length - 1)].uid);
        else if (mnu.items) mnu.choose(mnu.firstEnabled(services.ui.chooseIndex | 0));
        else mnu.done();
      });
    }
    if (this.tear <= 0) { if (this.tearApplied) this.applyTear(0, 0); return; }
    if (this.tear === 1) { if (!this.tearApplied) this.applyTear(3, 0); return; }
    this.tearFrame += 1;
    if (this.tearFrame % 2 === 0) {
      const dx = Phaser.Math.Between(-2, 2), dy = Phaser.Math.Between(-2, 2);
      this.applyTear(dx, dy);
    }
  }

  applyTear(dx, dy) {
    this.tearApplied = dx !== 0 || dy !== 0;
    for (const w of this.windows) { if (!w.active) continue; w.setPosition(w.baseX ?? (w.baseX = w.x), (w.baseY ?? w.y) + dy); w.x = w.baseX + dx; }
  }

  /** 0 none; 1 the HUD sits 3 px off; 2 frames jitter ±2 px; 3 (Toon 4) jitter + torn purple frames. */
  setTear(level) {
    this.tear = Math.max(this.tear, level | 0);
    if (this.tear >= 3) for (const w of this.windows) this.tintWindow(w, 0xa050c0);
  }

  tintWindow(win, color) {
    if (!win || !win.p) return;
    for (const piece of Object.values(win.p)) if (piece && piece.setTint) piece.setTint(color);
  }

  setMoodColor(name) { this.mood = MOOD[name] || MOOD.pink; }

  // ---- strip / meter / status ----------------------------------------------------------------

  /** @param {{uid: string, consumed: boolean}[]} order @param {string|null} current */
  setSetlist(order, current = null) {
    for (const c of this.setlistCells) { c.rect.destroy(); c.letter.destroy(); c.cross.destroy(); }
    this.setlistCells = [];
    let x = 8;
    for (const entry of order) {
      const c = this.model.find(entry.uid);
      if (!c) continue;
      const color = c.side === 'party' ? (PARTY_COLORS[c.id] || 0xffffff) : 0x3a3a4a;
      const rect = this.scene.add.rectangle(x, LAYOUT.setlistY, 8, 8, color, 1).setOrigin(0, 0).setDepth(DEPTH.strip);
      if (entry.uid === current) rect.setStrokeStyle(1, 0xffe066);
      const letter = this.scene.add.text(x, LAYOUT.setlistY, (c.name[0] || '?').toUpperCase(), textStyle(c.side === 'party' ? COLORS.black : COLORS.text)).setDepth(DEPTH.strip + 1);
      const cross = this.scene.add.text(x, LAYOUT.setlistY, 'x', textStyle(COLORS.red)).setDepth(DEPTH.strip + 2).setVisible(!!entry.consumed);
      this.setlistCells.push({ rect, letter, cross, consumed: !!entry.consumed, uid: entry.uid });
      x += 10;
    }
  }

  setMeter(value, level, { beige = this.beige } = {}) {
    const L = LAYOUT.meter;
    if (this.meterTiles.length) {
      // 24 tiles; a full segment is 6 tiles (24 px); 100 lights every tile, 99 leaves the last dark.
      const lit = Math.floor((Math.max(0, Math.min(100, value)) / 100) * this.meterTiles.length);
      this.meterTiles.forEach((t, i) => t.setFrame(i < lit ? METER_FRAMES[Math.min(3, Math.floor(i / 6))] : 'meter_off'));
    } else {
      const g = this.meterG;
      g.clear();
      const segW = L.w / L.segments;
      for (let i = 0; i < L.segments; i++) {
        const x = L.x + i * segW;
        g.fillStyle(0x10101c, 1); g.fillRect(x, L.y, segW - 2, L.h);
        g.lineStyle(1, 0xf4f4f4, 1); g.strokeRect(x + 0.5, L.y + 0.5, segW - 3, L.h - 1);
        const segMin = i * 25;
        const frac = Math.max(0, Math.min(1, (value - segMin) / 25));
        const fw = Math.round((segW - 4) * frac);
        if (fw > 0) { g.fillStyle(LEVEL_COLORS[i], 1); g.fillRect(x + 1, L.y + 1, fw, L.h - 2); }
      }
    }
    this.beige = beige;
    this.meterLabel.setText(`TOON ${level}`).setColor(beige ? MOOD.beige : COLORS.text);
  }

  setActive(uid) { this.activeUid = uid; this.refreshStatus(); }

  refresh() {
    this.setMeter(this.model.meter, this.model.toonLevel, { beige: this.model.hasBrian() });
    this.setSetlist(this.model.getTurnOrder(), this.model.current ? this.model.current.uid : null);
    this.refreshStatus();
  }

  refreshStatus() {
    const members = this.model.party().slice(0, 4);
    this.statusRows.forEach((row, i) => {
      const c = members[i];
      if (row.icon) { row.icon.destroy(); row.icon = null; }
      if (!c) { row.name.setVisible(false); row.hp.setVisible(false); row.amp.setVisible(false); return; }
      const color = c.ko ? COLORS.disabled : (c.uid === this.activeUid ? COLORS.yellow : (c.hp * 4 < c.maxHp ? COLORS.pink : COLORS.text));
      row.name.setText(c.name.toUpperCase().slice(0, 7)).setColor(color).setVisible(true);
      row.hp.setText(`${c.hp}/${c.maxHp}`).setColor(color).setVisible(true);
      row.amp.setText(c.auto ? 'AU' : String(c.amp)).setColor(color).setVisible(true);
      // x 174: the first status icon (8×8), else the hand on the active row.
      const st = (c.status || []).map((s) => s.id).concat(c.tuning ? ['TUNING'] : []).concat(c.ko ? ['KO'] : [])[0];
      const frame = st && this.statusIcon(st);
      if (frame) row.icon = this.scene.add.image(LAYOUT.status.iconX, row.y, UI_KEY, frame).setOrigin(0, 0).setDepth(DEPTH.text);
      else if (st) row.icon = this.scene.add.text(LAYOUT.status.iconX, row.y, st === 'TUNING' ? 'T' : st[0], textStyle(COLORS.yellow)).setDepth(DEPTH.text);
      else if (c.uid === this.activeUid && hasFrame(this.scene, 'cursor')) row.icon = this.scene.add.image(LAYOUT.status.iconX, row.y, UI_KEY, 'cursor').setOrigin(0, 0).setDepth(DEPTH.text);
    });
  }

  /** ui atlas frame for a status id, or null. */
  statusIcon(id) {
    const frame = id === 'KO' ? 'icon_ko' : (id === 'TUNING' ? null : `icon_${String(id).toLowerCase().replace(/_/g, id === 'OUT_OF_TUNE' || id === 'ON_HOLD' ? '' : '_')}`);
    return frame && hasFrame(this.scene, frame) ? frame : null;
  }

  // ---- message strip / enemy name / scan ------------------------------------------------------

  showMessage(text) {
    if (!text) return this.clearMessage();
    this.msgText.setText(String(text).slice(0, 29)).setVisible(true);
    this.msgBack.setVisible(true);
    return undefined;
  }

  clearMessage() { this.msgText.setVisible(false); this.msgBack.setVisible(false); }

  showEnemyName(name) {
    const L = LAYOUT.enemyName;
    if (!this.nameWin) {
      this.nameWin = new Window(this.scene, L.x, L.y, L.w, L.h, { depth: DEPTH.menu });
      this.nameText = this.scene.add.text(L.x + 8, L.y + 6, '', textStyle(COLORS.text)).setDepth(DEPTH.menu + 2);
    }
    this.nameWin.open(true);
    this.nameText.setText(String(name).slice(0, 14)).setVisible(true);
  }

  hideEnemyName() { if (this.nameWin) { this.nameWin.close(true); this.nameText.setVisible(false); } }

  /** Scan window (My Brain Thinks): HP, weak, resist; waits for confirm. */
  async showScan(info) {
    const L = LAYOUT.scan;
    const win = new Window(this.scene, L.x, L.y, L.w, L.h, { depth: DEPTH.menu });
    await win.open(true);
    const lines = [
      `${info.name}`.slice(0, 19),
      `HP ${info.hp}/${info.maxHp}`,
      `WEAK ${(info.weak || []).join(',') || '-'} RES ${(info.resist || []).join(',') || '-'}`.slice(0, 19),
    ];
    const texts = lines.map((t, i) => this.scene.add.text(L.x + 8, L.y + 8 + i * LINE_H, t, textStyle(COLORS.text)).setDepth(DEPTH.menu + 2));
    const p = new Prompt(this);
    this.activeMenu = p;
    await p.open();
    for (const t of texts) t.destroy();
    win.destroy();
  }

  // ---- menus -------------------------------------------------------------------------------------

  /**
   * Command window: 2×3 grid STRUM/RIFF/NOISE | ITEM/TUNE/BAIL. `selected` is an index into `commands`
   * (the order the model lists them), mapped onto the grid so the cursor comes back on the command
   * the player used last. Resolves the command id or null.
   */
  async commandMenu(commands, selected = 0) {
    const L = LAYOUT.command;
    const order = [0, 3, 1, 4, 2, 5];
    const items = order.map((i) => ({ ...commands[i] }));
    const menu = new CursorMenu(this, {
      x: L.x, y: L.y, w: L.w, h: L.h, items, cols: 2, rows: 3, selected: Math.max(0, order.indexOf(selected)), cancelable: false, win: this.commandWin,
      rowH: L.rowH, colW: L.colW, textDy: 0, // rows y 168 / 184 / 200, cursor columns x 16 / 64
      onHover: (it) => { if (it.disabled && it.reason) this.showMessage(it.reason); else this.clearMessage(); },
    });
    this.activeMenu = menu;
    const idx = await menu.open();
    this.clearMessage();
    return idx < 0 ? null : items[idx].id;
  }

  /** Scrolling submenu (riffs + SYNC divider, items, noise words). Resolves the entry or null. */
  async listMenu(entries, { selected = 0 } = {}) {
    const L = LAYOUT.submenu;
    const items = entries.map((e) => (e.divider ? { divider: true, label: e.label } : { ...e, right: e.right ?? (e.cost !== undefined ? e.cost : (e.qty !== undefined ? `x${e.qty}` : null)) }));
    const menu = new CursorMenu(this, {
      x: L.x, y: L.y, w: L.w, h: L.h, items, cols: 1, rows: L.rows, selected, cancelable: true,
      onHover: (it) => { if (it.disabled && it.reason) this.showMessage(it.reason); else if (it.desc) this.showMessage(it.desc); else this.clearMessage(); },
    });
    this.activeMenu = menu;
    const idx = await menu.open();
    this.clearMessage();
    return idx < 0 ? null : entries[idx];
  }

  /** Target picker over sprites; resolves a uid or null. */
  async targetMenu(targets) {
    if (!targets.length) return null;
    const picker = new TargetPicker(this, targets, { onHover: (t) => { if (t.side === 'enemy') this.showEnemyName(t.name); } });
    this.activeMenu = picker;
    const uid = await picker.open();
    this.hideEnemyName();
    return uid;
  }

  /** "SET BREAK": XP, $, drops, level-ups with new riffs. Waits for confirm. */
  async rewards(summary, model) {
    const L = LAYOUT.rewards;
    const win = new Window(this.scene, L.x, L.y, L.w, L.h, { depth: DEPTH.rewards });
    await win.open(!!services.ui?.textInstant);
    const lines = [{ t: 'SET BREAK', c: COLORS.yellow }, { t: `XP +${summary.xp}   $ +${summary.money}`, c: COLORS.text }];
    const items = model.data.items || {};
    const equip = model.data.equipment || {};
    for (const d of summary.drops) lines.push({ t: `Got ${(items[d] || equip[d] || { name: d }).name}`.slice(0, 20), c: COLORS.green });
    for (const up of summary.levelups) {
      lines.push({ t: `${(model.find(up.who) || { name: up.who }).name} LV ${up.to}!`, c: COLORS.pink });
      for (const r of up.riffs) lines.push({ t: ` +${r}`.slice(0, 20), c: COLORS.text });
    }
    const texts = lines.slice(0, 9).map((l, i) => this.scene.add.text(L.x + 8, L.y + 8 + i * LINE_H, l.t, textStyle(l.c)).setDepth(DEPTH.rewards + 2));
    const p = new Prompt(this);
    this.activeMenu = p;
    await p.open();
    for (const t of texts) t.destroy();
    await win.close(!!services.ui?.textInstant);
    win.destroy();
  }

  /** Feed a logical action to the open menu (called by the scene from Input.justPressed). */
  onAction(action) {
    if (this.activeMenu && typeof this.activeMenu.onAction === 'function') this.activeMenu.onAction(action);
  }

  hasMenu() { return !!this.activeMenu; }

  closeMenus() {
    if (this.activeMenu) { this.activeMenu.forceClose(); this.activeMenu = null; }
    this.hideEnemyName();
    this.clearMessage();
  }

  destroy() {
    this.closeMenus();
    for (const c of this.setlistCells) { c.rect.destroy(); c.letter.destroy(); c.cross.destroy(); }
    this.setlistCells = [];
  }
}
