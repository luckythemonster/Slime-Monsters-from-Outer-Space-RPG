import PartySystem  from '../systems/PartySystem.js';
import EventSystem  from '../systems/EventSystem.js';

const MAP_IDS = [
  'ep0_alley', 'ep0_apartment', 'ep0_citysound', 'ep0_palmers', 'ep0_minneapolis',
];

const DIALOGUE_IDS = [
  'ep0_intro', 'ep0_meeting', 'ep0_signal',
  'ep0_rehearsal', 'ep0_gig', 'ep0_gig_win',
];

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this._drawLoadingBar();

    this.load.json('characters', 'src/data/characters.json');
    this.load.json('enemies',    'src/data/enemies.json');
    this.load.json('abilities',  'src/data/abilities.json');
    this.load.json('items',      'src/data/items.json');
    this.load.json('equipment',  'src/data/equipment.json');

    for (const id of MAP_IDS) {
      this.load.json(`map_${id}`, `src/data/maps/${id}.json`);
    }

    for (const id of DIALOGUE_IDS) {
      this.load.json(`dlg_${id}`, `src/data/dialogue/${id}.json`);
    }

    this.load.json('dlg_misc', 'src/data/dialogue/ep0_misc.json');
  }

  create() {
    // ── core data ──────────────────────────────────────────────────────────
    const characters = this.cache.json.get('characters');
    const equipDefs  = this.cache.json.get('equipment') ?? [];

    this.registry.set('characters', characters);
    this.registry.set('enemies',    this.cache.json.get('enemies'));
    this.registry.set('abilities',  this.cache.json.get('abilities'));
    this.registry.set('items',      this.cache.json.get('items'));
    this.registry.set('equipment',  equipDefs);

    // ── maps ───────────────────────────────────────────────────────────────
    const maps = {};
    for (const id of MAP_IDS) {
      const data = this.cache.json.get(`map_${id}`);
      if (data) maps[data.id] = data;
    }
    this.registry.set('maps', maps);

    // ── dialogues ──────────────────────────────────────────────────────────
    const dialogues = {};
    for (const id of DIALOGUE_IDS) {
      const data = this.cache.json.get(`dlg_${id}`);
      if (data?.id) dialogues[data.id] = data;
    }
    const misc = this.cache.json.get('dlg_misc');
    if (Array.isArray(misc)) {
      misc.forEach(d => { if (d.id) dialogues[d.id] = d; });
    }
    this.registry.set('dialogues', dialogues);

    // ── systems ────────────────────────────────────────────────────────────
    this.registry.set('events', new EventSystem());
    const party = new PartySystem(characters);

    // Assign starting equipment to initial party members
    characters.forEach(charDef => {
      const member = party.members.find(m => m.id === charDef.id);
      if (!member || !charDef.startingEquipment) return;
      for (const slot of ['instrument', 'outfit']) {
        const id = charDef.startingEquipment[slot];
        const itemDef = equipDefs.find(e => e.id === id);
        if (itemDef) party.equip(member, itemDef);
      }
    });

    this.registry.set('party', party);

    this.scene.start('TitleScene');
  }

  _drawLoadingBar() {
    const cx = this.scale.width  / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 20, 'LOADING...', {
      font: '10px monospace', color: '#ffffff',
    }).setOrigin(0.5);

    const bar = this.add.rectangle(cx - 80, cy, 0, 6, 0x4488cc).setOrigin(0, 0.5);
    this.add.rectangle(cx, cy, 162, 8, 0x333333).setOrigin(0.5);

    this.load.on('progress', v => { bar.width = Math.floor(160 * v); });
  }
}
