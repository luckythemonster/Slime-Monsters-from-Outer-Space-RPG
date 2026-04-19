// Bottom panel layout (320x68 at y=112)
const PANEL_Y   = 112;
const PANEL_H   = 68;
const DIVIDER_X = 174;
const MENU_X    = DIVIDER_X + 4;

const ACTIONS = ['ATTACK', 'ABILITY', 'ITEM', 'FLEE'];

export default class BattleHUD {
  constructor(scene) {
    this.scene   = scene;
    this.gfx     = scene.add.graphics();
    this._texts  = [];
    this._zones  = [];
    this.cursor  = 0;
    this._onActionCb = null;
  }

  onAction(cb) { this._onActionCb = cb; }

  draw(battle, logLines = []) {
    this.gfx.clear();
    this._texts.forEach(t => t.destroy());
    this._texts = [];
    this._zones.forEach(z => z.destroy());
    this._zones = [];

    this._drawEnemyArea(battle.enemies);
    this._drawLog(logLines);
    this._drawPanel();
    this._drawParty(battle.party);
    if (battle.phase === 'player_turn') {
      this._drawMenu();
    }
  }

  moveCursor(dir) {
    this.cursor = (this.cursor + dir + ACTIONS.length) % ACTIONS.length;
  }

  confirmCurrent() {
    if (this._onActionCb) this._onActionCb(ACTIONS[this.cursor]);
  }

  // ─── private ────────────────────────────────────────────────────────────

  _drawEnemyArea(enemies) {
    const living = enemies.filter(e => e.currentHp > 0);
    const count  = living.length;
    living.forEach((e, i) => {
      const ex = count === 1 ? 50 : 30 + i * 70;
      const ey = 10;
      const color = e.color ? parseInt(String(e.color).replace('#', ''), 16) : 0xff4444;

      // body
      this.gfx.fillStyle(color);
      this.gfx.fillRoundedRect(ex, ey, 48, 48, 6);
      // simple face
      this.gfx.fillStyle(0x000000);
      this.gfx.fillRect(ex + 11, ey + 16, 5, 5);
      this.gfx.fillRect(ex + 22, ey + 16, 5, 5);
      this.gfx.fillRect(ex + 14, ey + 28, 10, 3);

      // name
      this._text(ex, ey + 52, e.name ?? 'Enemy', '6px monospace', '#ffffff');

      // HP bar
      const maxHp = e.stats?.hp ?? 1;
      const pct   = Math.max(0, e.currentHp / maxHp);
      this.gfx.fillStyle(0x333333);
      this.gfx.fillRect(ex, ey + 62, 48, 4);
      this.gfx.fillStyle(pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xcccc00 : 0xcc2222);
      this.gfx.fillRect(ex, ey + 62, Math.ceil(48 * pct), 4);
    });
  }

  _drawLog(lines) {
    if (!lines.length) return;
    const recent = lines.slice(-3);
    recent.forEach((line, i) => {
      const alpha = i === recent.length - 1 ? '#ffffff' : '#999999';
      this._text(2, 74 + i * 10, line, '6px monospace', alpha);
    });
  }

  _drawPanel() {
    // background
    this.gfx.fillStyle(0x0a0a1e);
    this.gfx.fillRect(0, PANEL_Y, 320, PANEL_H);
    // top border
    this.gfx.fillStyle(0x4488cc);
    this.gfx.fillRect(0, PANEL_Y, 320, 1);
    // vertical divider
    this.gfx.fillStyle(0x334455);
    this.gfx.fillRect(DIVIDER_X, PANEL_Y + 2, 1, PANEL_H - 4);
  }

  _drawParty(party) {
    party.forEach((m, i) => {
      const py = PANEL_Y + 4 + i * 31;

      this._text(4,   py,      m.name,           '6px monospace', '#ffffff');
      this._text(80,  py,      `Lv${m.level ?? 1}`, '6px monospace', '#aaaaaa');

      // HP row
      this._text(4,  py + 11, 'HP', '6px monospace', '#44ee44');
      this._bar(20, py + 12, 80, 5, m.currentHp ?? m.hp, m.maxHp, 0x22aa22, 0x222222);
      this._text(104, py + 11, `${m.currentHp ?? m.hp}`, '6px monospace', '#ccffcc');

      // MP row
      this._text(4,  py + 20, 'MP', '6px monospace', '#4466ff');
      this._bar(20, py + 21, 80, 5, m.currentMp ?? m.mp, m.maxMp, 0x2244cc, 0x222222);
      this._text(104, py + 20, `${m.currentMp ?? m.mp}`, '6px monospace', '#aaaaff');
    });
  }

  _drawMenu() {
    ACTIONS.forEach((label, i) => {
      const my      = PANEL_Y + 6 + i * 14;
      const selected = i === this.cursor;

      // tap zone
      const zone = this.scene.add.zone(MENU_X, my - 1, 320 - MENU_X, 13)
        .setOrigin(0, 0)
        .setInteractive();
      zone.on('pointerdown', () => {
        this.cursor = i;
        if (this._onActionCb) this._onActionCb(ACTIONS[i]);
      });
      this._zones.push(zone);

      if (selected) {
        this.gfx.fillStyle(0x1a2a4a);
        this.gfx.fillRect(MENU_X - 2, my - 2, 320 - MENU_X + 2, 13);
        this._text(MENU_X, my, `► ${label}`, '6px monospace', '#ffffff');
      } else {
        this._text(MENU_X + 8, my, label, '6px monospace', '#778899');
      }
    });
  }

  _bar(x, y, w, h, cur, max, fill, bg) {
    const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    this.gfx.fillStyle(bg);
    this.gfx.fillRect(x, y, w, h);
    this.gfx.fillStyle(fill);
    this.gfx.fillRect(x, y, Math.ceil(w * pct), h);
  }

  _text(x, y, str, font, color) {
    const t = this.scene.add.text(x, y, String(str), { font, color });
    this._texts.push(t);
    return t;
  }

  destroy() {
    this.gfx.destroy();
    this._texts.forEach(t => t.destroy());
    this._zones.forEach(z => z.destroy());
  }
}
