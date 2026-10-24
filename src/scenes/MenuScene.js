// MenuScene: pause menu overlay (Esc) above a paused Explore. Items / Riffs / Equip / Status /
// Save / Quit, all driven through the UI service's menus so the windowed UI owns the look.
// EQUIP swaps instruments/accessories from the bag (DESIGN.md "Items, equipment, shops"); SAVE is
// grayed "Find the dog" unless a Bajonka `save` entity is adjacent, and then opens her clipboard.
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { audioCall } from '../engine/Audio.js';
import { EQUIP_SLOTS } from '../engine/Party.js';

const TOP_ITEMS = ['Items', 'Riffs', 'Equip', 'Status', 'Save', 'Quit'];
const SLOT_LABEL = { instrument: 'Inst', accessory: 'Acc' };

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
      const dog = this.nearbySave();
      const items = TOP_ITEMS.map((label) => (label === 'Save' ? { label, disabled: !dog, hint: dog ? 'Bajonka is here.' : 'Find the dog' } : { label }));
      const idx = await this.ui.menu(items, { x: 48, y: 72, cancelable: true, selected });
      if (this.closed) return;
      if (idx < 0) { this.close(); return; }
      selected = idx;
      switch (TOP_ITEMS[idx]) {
        case 'Items': await this.items(); break;
        case 'Riffs': await this.riffs(); break;
        case 'Equip': await this.equip(); break;
        case 'Status': await this.status(); break;
        case 'Save': await this.save(dog); return;
        case 'Quit': await this.quit(); return;
        default: break;
      }
    }
  }

  /** The Explore scene this menu sits over (paused). */
  get explore() { return this.scene.get('Explore'); }

  /** A `save` entity (Bajonka) on a tile next to the player, or null. */
  nearbySave() {
    const ex = this.explore;
    if (!ex || !ex.player || !ex.entities) return null;
    for (const e of ex.entities.values()) {
      if (e.type !== 'save') continue;
      if (Math.abs(e.tileX - ex.player.tileX) + Math.abs(e.tileY - ex.player.tileY) === 1) return e;
    }
    return null;
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

  /** Member → slot → a piece from the bag that fits (slot, `who`, not locked); the old piece goes back in the bag. */
  async equip() {
    const p = this.state.party;
    const eq = p.equipment;
    const inv = this.state.inventory;
    const nameOf = (id) => (id ? (eq[id] || {}).name || id : '-');
    while (!this.closed) {
      const members = p.members;
      const mi = await this.ui.menu(members.map((m) => ({ label: p.def(m.id).name })), { x: 128, y: 72, cancelable: true });
      if (this.closed || mi < 0) return;
      const m = members[mi];
      const si = await this.ui.menu(EQUIP_SLOTS.map((slot) => ({ label: `${SLOT_LABEL[slot]}: ${nameOf(m.equip[slot])}`.slice(0, 28) })), { x: 128, y: 108, cancelable: true });
      if (this.closed || si < 0) continue;
      const slot = EQUIP_SLOTS[si];
      const cur = m.equip[slot] ? eq[m.equip[slot]] : null;
      if (cur && cur.locked) { await this.ui.say({ text: `${nameOf(m.equip[slot])} stays on. It is not up for discussion.`, who: 'narrator' }); continue; }
      const fits = inv.list().filter((e) => e.def.type === 'equipment' && e.def.slot === slot && !e.def.locked && (!e.def.who || e.def.who.includes(m.id)));
      if (!fits.length) { await this.ui.say({ text: `Nothing in the bag fits ${p.def(m.id).name}'s ${slot}.`, who: 'narrator' }); continue; }
      const ii = await this.ui.menu(fits.map((e) => ({ label: e.def.name.slice(0, 26), hint: (e.def.desc || '').slice(0, 56) })), { x: 128, y: 144, cancelable: true });
      if (this.closed || ii < 0) continue;
      const pick = fits[ii];
      const prev = p.equip(m.id, pick.id);
      inv.remove(pick.id, 1);
      if (prev && eq[prev] && !eq[prev].locked) inv.add(prev, 1);
      audioCall('sfx', 'item');
      await this.ui.toast(`${p.def(m.id).name}: ${pick.def.name} on.`);
    }
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

  /** Close the menu and hand the adjacent Bajonka's clipboard to Explore (the same prompt as talking to her). */
  async save(dog) {
    if (!dog) return;
    const ex = this.explore;
    this.close();
    if (ex && typeof ex.runSave === 'function') ex.runSave(dog);
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
