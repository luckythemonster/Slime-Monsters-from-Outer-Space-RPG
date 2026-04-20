export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  init(data) {
    this._returnScene  = data.returnScene ?? 'ExploreScene';
    this._tab          = 0;
    this._equipMember  = 0;
  }

  create() {
    this._party     = this.registry.get('party');
    this._equipDefs = this.registry.get('equipment') ?? [];
    this._itemDefs  = this.registry.get('items') ?? [];

    this._gfx   = this.add.graphics();
    this._texts = [];

    this._setupInput();
    this._draw();
  }

  _setupInput() {
    this._escKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this._leftKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this._rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this._upKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this._downKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this._zKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this._escKey)) {
      this.scene.stop();
      this.scene.resume(this._returnScene);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this._leftKey)) {
      this._tab = (this._tab - 1 + 3) % 3;
      this._draw();
    } else if (Phaser.Input.Keyboard.JustDown(this._rightKey)) {
      this._tab = (this._tab + 1) % 3;
      this._draw();
    }

    if (this._tab === 1) {
      if (Phaser.Input.Keyboard.JustDown(this._upKey)) {
        this._equipMember = Math.max(0, this._equipMember - 1);
        this._draw();
      } else if (Phaser.Input.Keyboard.JustDown(this._downKey)) {
        this._equipMember = Math.min((this._party?.members.length ?? 1) - 1, this._equipMember + 1);
        this._draw();
      }
    }

    if (this._tab === 2 && Phaser.Input.Keyboard.JustDown(this._zKey)) {
      this._useHealItem();
      this._draw();
    }
  }

  _useHealItem() {
    const inv = this._party?.inventory ?? [];
    const slot = inv.find(s => {
      const def = this._itemDefs.find(d => d.id === s.id);
      return def?.effect === 'heal_hp';
    });
    if (!slot) return;
    const itemDef = this._itemDefs.find(d => d.id === slot.id);
    const target = [...(this._party?.living() ?? [])].sort((a, b) =>
      (a.hp / a.maxHp) - (b.hp / b.maxHp)
    )[0];
    if (!target) return;
    target.hp = Math.min(target.hp + itemDef.value, target.maxHp);
    this._party.useItem(slot.id);
  }

  _draw() {
    this._gfx.clear();
    this._texts.forEach(t => t.destroy());
    this._texts = [];

    // background
    this._gfx.fillStyle(0x000022, 0.96);
    this._gfx.fillRect(0, 0, 320, 180);
    this._gfx.lineStyle(1, 0x4488cc);
    this._gfx.strokeRect(2, 2, 316, 176);

    // tabs
    const tabs = ['STATS', 'EQUIP', 'ITEMS'];
    tabs.forEach((tab, i) => {
      const tx = 10 + i * 80;
      const sel = i === this._tab;
      this._gfx.fillStyle(sel ? 0x1a2a4a : 0x0a0a1e);
      this._gfx.fillRect(tx, 2, 78, 14);
      this._t(tx + 4, 4, tab, '8px monospace', sel ? '#ffff88' : '#446688');
    });

    this._gfx.fillStyle(0x0a0a1e);
    this._gfx.fillRect(2, 16, 316, 162);

    if (this._tab === 0)      this._drawStats();
    else if (this._tab === 1) this._drawEquip();
    else                      this._drawItems();
  }

  _drawStats() {
    const members = this._party?.members ?? [];
    this._t(160, 20, 'PARTY STATS', '9px monospace', '#ffff88', 0.5);
    members.forEach((m, i) => {
      const py  = 34 + i * 44;
      const atk = this._party?.getEffectiveStat(m, 'atk') ?? m.atk;
      const def = this._party?.getEffectiveStat(m, 'def') ?? m.def;
      const spd = this._party?.getEffectiveStat(m, 'spd') ?? m.spd;
      this._t(10, py,      `${m.name}  Lv${m.level}`,          '9px monospace', '#ffffff');
      this._t(10, py + 11, `HP:${m.hp}/${m.maxHp}  MP:${m.mp}/${m.maxMp}`, '8px monospace', '#aaffaa');
      this._t(10, py + 22, `ATK:${atk}  DEF:${def}  SPD:${spd}`,           '8px monospace', '#aaaaff');
      this._t(10, py + 33, `XP:${m.xp}/${m.xpToNext}`,                     '8px monospace', '#888888');
    });
    this._t(160, 168, '[←/→ tabs   ESC=close]', '7px monospace', '#446688', 0.5);
  }

  _drawEquip() {
    const members = this._party?.members ?? [];
    this._t(160, 20, 'EQUIPMENT', '9px monospace', '#ffff88', 0.5);
    members.forEach((m, i) => {
      const py  = 34 + i * 44;
      const sel = i === this._equipMember;
      this._t(sel ? 6 : 10, py, sel ? `► ${m.name}` : `  ${m.name}`, '9px monospace', sel ? '#ffff88' : '#ffffff');
      const inst = m.equipment?.instrument;
      const out  = m.equipment?.outfit;
      this._t(14, py + 12, `INSTR: ${inst?.name ?? '—'}`, '8px monospace', '#aaaaff');
      this._t(14, py + 22, `OUTFIT: ${out?.name ?? '—'}`,  '8px monospace', '#aaaaff');
      if (inst?.desc) this._t(14, py + 32, inst.desc, '7px monospace', '#555577');
    });
    this._t(160, 168, '[↑/↓ member   ESC=close]', '7px monospace', '#446688', 0.5);
  }

  _drawItems() {
    const inv  = this._party?.inventory ?? [];
    const cash = this._party?.cash ?? 0;
    this._t(160, 20, 'ITEMS', '9px monospace', '#ffff88', 0.5);
    if (!inv.length) {
      this._t(160, 90, 'No items.', '8px monospace', '#446688', 0.5);
    } else {
      inv.slice(0, 8).forEach((slot, i) => {
        const def = this._itemDefs.find(d => d.id === slot.id);
        const py  = 34 + i * 16;
        this._t(14,  py, `${def?.name ?? slot.id}  ×${slot.qty}`, '8px monospace', '#ffffff');
        if (def?.desc) this._t(160, py, def.desc, '7px monospace', '#555577');
      });
    }
    this._t(10,  158, `$${cash}`, '8px monospace', '#ffff44');
    this._t(160, 168, '[Z=use heal item   ESC=close]', '7px monospace', '#446688', 0.5);
  }

  _t(x, y, str, font, color, originX = 0) {
    const t = this.scene.add
      ? this.add.text(x, y, String(str), { font, color }).setOrigin(originX, 0)
      : null;
    if (t) this._texts.push(t);
    return t;
  }
}
