// MenuScene: pause menu overlay (Esc) above a paused Explore. Items / Riffs / Equip / Status /
// Save / Quit, all driven through the UI service's menus so the windowed UI owns the look.
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { audioCall } from '../engine/Audio.js';
import { PARAMS } from '../config.js';

const TOP_ITEMS = ['Items', 'Riffs', 'Equip', 'Status', 'Save', 'Quit'];

export default class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'Menu' }); }

  create() {
    this.closed = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.closed = true; });
    this.loop();
  }

  update() {
    if (!this.closed && services.input.justPressed('menu')) {
      services.input.consume();
      this.close();
    }
  }

  get ui() { return services.ui; }
  get state() { return services.state; }

  async loop() {
    let selected = 0;
    while (!this.closed) {
      const idx = await this.ui.menu(TOP_ITEMS.map((label) => ({ label })), { x: 48, y: 72, cancelable: true, selected });
      if (this.closed) return;
      if (idx < 0) { this.close(); return; }
      selected = idx;
      switch (TOP_ITEMS[idx]) {
        case 'Items': await this.items(); break;
        case 'Riffs': await this.riffs(); break;
        case 'Equip': await this.equip(); break;
        case 'Status': await this.status(); break;
        case 'Save': await this.save(); break;
        case 'Quit': await this.quit(); return;
        default: break;
      }
    }
  }

  /** Resume Explore and stop this overlay. */
  close() {
    if (this.closed) return;
    this.closed = true;
    audioCall('sfx', 'cancel');
    this.ui.closeAll();
    this.scene.resume('Explore');
    this.scene.stop();
  }

  memberLabel(m) {
    const s = this.state.party.stats(m.id);
    return `${this.state.party.def(m.id).name} HP${m.hp}/${s.maxHp}`;
  }

  async items() {
    const inv = this.state.inventory;
    while (!this.closed) {
      const list = inv.consumables();
      if (!list.length) { await this.ui.say({ text: 'No items.', who: 'narrator' }); return; }
      const i = await this.ui.menu(list.map((e) => ({ label: `${e.def.name} x${e.qty}`, hint: e.def.desc })), { x: 128, y: 72, cancelable: true });
      if (this.closed || i < 0) return;
      const item = list[i];
      const members = this.state.party.members;
      let m = 0;
      if (members.length > 1) {
        m = await this.ui.menu(members.map((mm) => ({ label: this.memberLabel(mm) })), { x: 128, y: 120, cancelable: true });
        if (this.closed || m < 0) continue;
      }
      const eff = item.def.effect || {};
      const d = this.state.party.heal(members[m].id, { hp: eff.hp || 0, amp: eff.amp || 0 });
      inv.remove(item.id, 1);
      audioCall('sfx', 'item');
      await this.ui.toast(`${this.state.party.def(members[m].id).name}: +${d.hp} HP${d.amp ? ` +${d.amp} AMP` : ''}`);
    }
  }

  async riffs() {
    const lines = this.state.party.members.map((m) => {
      const riffs = this.state.party.def(m.id).riffs || [];
      return `${this.state.party.def(m.id).name}: ${riffs.length ? riffs.join(', ') : 'no riffs yet'}`;
    });
    await this.ui.say({ text: lines.join('\n'), who: 'narrator' });
  }

  async equip() {
    const eq = this.state.party.equipment;
    const lines = this.state.party.members.map((m) => {
      const inst = m.equip.instrument ? (eq[m.equip.instrument] || {}).name || m.equip.instrument : '-';
      const acc = m.equip.accessory ? (eq[m.equip.accessory] || {}).name || m.equip.accessory : '-';
      return `${this.state.party.def(m.id).name}: ${inst} / ${acc}`;
    });
    await this.ui.say({ text: lines.join('\n'), who: 'narrator' });
  }

  async status() {
    const p = this.state.party;
    for (const m of p.members) {
      const s = p.stats(m.id);
      const text = `${p.def(m.id).name} Lv${m.level} XP${m.xp}\nHP ${m.hp}/${s.maxHp} AMP ${m.amp}/${s.maxAmp}\nATK ${s.atk} DEF ${s.def} SPD ${s.spd}`;
      await this.ui.say({ text, who: 'narrator' });
      if (this.closed) return;
    }
    await this.ui.say({ text: `$${this.state.money}  Playtime ${Math.floor(this.state.playtimeMs / 60000)}m`, who: 'narrator' });
  }

  async save() {
    const slot = PARAMS.slot || this.state.slot || 1;
    this.state.save(slot);
    audioCall('sfx', 'save');
    await this.ui.toast(`Saved to slot ${slot}.`);
  }

  async quit() {
    const idx = await this.ui.choice(['Quit to title', 'Keep playing'], { cancelIndex: 1 });
    if (this.closed) return;
    if (idx !== 0) return;
    this.closed = true;
    this.ui.closeAll();
    audioCall('stopMusic', { fade: 0.3 });
    this.scene.stop('Explore');
    this.scene.start('Title');
  }
}
