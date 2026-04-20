export default class PartySystem {
  constructor(characterDefs) {
    this.members = characterDefs.map(def => this._build(def));
    this.cash = 0;
    this.inventory = [];
  }

  _build(def) {
    return {
      id:        def.id,
      name:      def.name,
      class:     def.class,
      color:     parseInt(def.color.replace('#', ''), 16),
      level:     1,
      xp:        0,
      xpToNext:  50,
      hp:        def.base_stats.hp,
      maxHp:     def.base_stats.hp,
      mp:        def.base_stats.mp,
      maxMp:     def.base_stats.mp,
      atk:       def.base_stats.atk,
      def:       def.base_stats.def,
      spd:       def.base_stats.spd,
      lck:       def.base_stats.lck,
      abilities: def.abilities_learned
        .filter(a => a.level <= 1)
        .map(a => a.ability),
      equipment: { instrument: null, outfit: null },
      _def: def,
    };
  }

  getEffectiveStat(member, stat) {
    const base = member.stats?.[stat] ?? member[stat] ?? 0;
    return base + Object.values(member.equipment ?? {})
      .filter(Boolean)
      .reduce((sum, item) => sum + (item.bonus?.[stat] ?? 0), 0);
  }

  equip(member, itemDef) {
    if (!member.equipment) member.equipment = { instrument: null, outfit: null };
    member.equipment[itemDef.slot] = itemDef;
  }

  living() {
    return this.members.filter(m => m.hp > 0);
  }

  gainXp(amount) {
    const levelUps = [];
    for (const m of this.living()) {
      m.xp += amount;
      while (m.xp >= m.xpToNext) {
        m.xp -= m.xpToNext;
        const lu = this._levelUp(m);
        levelUps.push(lu);
      }
    }
    return levelUps;
  }

  _levelUp(member) {
    member.level += 1;
    member.xpToNext = Math.floor(member.xpToNext * 1.5);
    const growth = member._def.growth.find(g => g.level === member.level);
    if (growth) {
      member.maxHp += growth.hp  || 0;
      member.maxMp += growth.mp  || 0;
      member.atk   += growth.atk || 0;
      member.def   += growth.def || 0;
      member.spd   += growth.spd || 0;
      member.lck   += growth.lck || 0;
      member.hp = member.maxHp;
      member.mp = member.maxMp;
    }
    const newAbilities = (member._def.abilities_learned || [])
      .filter(a => a.level === member.level)
      .map(a => a.ability);
    member.abilities.push(...newAbilities);
    return { member, level: member.level, newAbilities };
  }

  addItem(itemId, quantity = 1) {
    const slot = this.inventory.find(s => s.id === itemId);
    if (slot) {
      slot.qty = Math.min(99, slot.qty + quantity);
    } else {
      this.inventory.push({ id: itemId, qty: quantity });
    }
  }

  useItem(itemId) {
    const slot = this.inventory.find(s => s.id === itemId);
    if (!slot || slot.qty <= 0) return false;
    slot.qty -= 1;
    if (slot.qty === 0) this.inventory = this.inventory.filter(s => s.id !== itemId);
    return true;
  }

  serialize() {
    return {
      members: this.members.map(m => ({
        id:        m.id,
        level:     m.level,
        xp:        m.xp,
        xpToNext:  m.xpToNext,
        hp:        m.hp,
        maxHp:     m.maxHp,
        mp:        m.mp,
        maxMp:     m.maxMp,
        atk:       m.atk,
        def:       m.def,
        spd:       m.spd,
        lck:       m.lck,
        abilities: m.abilities,
        equipment: {
          instrument: m.equipment?.instrument?.id ?? null,
          outfit:     m.equipment?.outfit?.id     ?? null,
        },
      })),
      cash:      this.cash,
      inventory: this.inventory,
    };
  }

  deserialize(data, equipDefs = []) {
    for (const saved of data.members) {
      const m = this.members.find(x => x.id === saved.id);
      if (!m) continue;
      Object.assign(m, saved);
      m.equipment = { instrument: null, outfit: null };
      if (saved.equipment) {
        for (const slot of ['instrument', 'outfit']) {
          const id = saved.equipment[slot];
          if (id) m.equipment[slot] = equipDefs.find(e => e.id === id) ?? null;
        }
      }
    }
    this.cash      = data.cash ?? data.gold ?? 0;
    this.inventory = data.inventory ?? [];
  }
}
