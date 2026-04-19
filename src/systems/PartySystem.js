export default class PartySystem {
  constructor(characterDefs) {
    this.members = characterDefs.map(def => this._build(def));
    this.gold = 0;
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
      _def: def,
    };
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
      })),
      gold:      this.gold,
      inventory: this.inventory,
    };
  }

  deserialize(data) {
    for (const saved of data.members) {
      const m = this.members.find(x => x.id === saved.id);
      if (m) Object.assign(m, saved);
    }
    this.gold      = data.gold      ?? 0;
    this.inventory = data.inventory ?? [];
  }
}
