export default class BattleSystem {
  constructor(partyMembers, enemyDefs, abilitiesData) {
    this._abilityMap = Object.fromEntries(abilitiesData.map(a => [a.id, a]));

    this.party = partyMembers.map(m => ({
      ...m,
      currentHp: m.hp,
      currentMp: m.mp,
      isPlayer:  true,
    }));

    this.enemies = enemyDefs.map((e, i) => ({
      ...e,
      uid:       `${e.id}_${i}`,
      currentHp: e.stats.hp,
      atk:       e.stats.atk,
      def:       e.stats.def,
      spd:       e.stats.spd,
      isPlayer:  false,
    }));

    this.phase = 'player_turn';
    this._queueIndex = 0;
    this._queue = this._buildQueue();
  }

  _buildQueue() {
    return [...this.party, ...this.enemies]
      .filter(c => c.currentHp > 0)
      .sort((a, b) => b.spd - a.spd);
  }

  _alive(c) { return c.currentHp > 0; }

  livingParty()   { return this.party.filter(c => this._alive(c)); }
  livingEnemies() { return this.enemies.filter(c => this._alive(c)); }

  getCurrentActor() {
    const alive = this._buildQueue();
    if (!alive.length) return null;
    return alive[this._queueIndex % alive.length];
  }

  advanceTurn() {
    this._queueIndex++;
    const alive = this._buildQueue();
    if (alive.length === 0) { this.phase = 'defeat'; return; }
    const actor = alive[this._queueIndex % alive.length];
    if (this.livingEnemies().length === 0) {
      this.phase = 'victory';
    } else if (this.livingParty().length === 0) {
      this.phase = 'defeat';
    } else {
      this.phase = actor.isPlayer ? 'player_turn' : 'enemy_turn';
    }
  }

  applyAttack(attacker, target, abilityId = null) {
    const ability = abilityId ? this._abilityMap[abilityId] : null;
    const power   = ability?.power ?? 1.0;
    const atk     = attacker.atk ?? 8;
    const def     = target.def ?? target.stats?.def ?? 3;
    const base    = Math.max(1, atk * power - def * 0.5);
    const dmg     = Math.floor(base * (0.9 + Math.random() * 0.2));
    target.currentHp = Math.max(0, target.currentHp - dmg);
    return { type: 'damage', amount: dmg };
  }

  applyHeal(caster, target, abilityId) {
    const ability = this._abilityMap[abilityId];
    const amount  = Math.floor((caster.atk * 0.5 + 12) * (ability?.power ?? 1.0));
    const maxHp   = target.maxHp ?? target.stats?.hp ?? target.currentHp;
    target.currentHp = Math.min(target.currentHp + amount, maxHp);
    return { type: 'heal', amount };
  }

  getEnemyAction(enemy) {
    const targets = this.livingParty();
    if (!targets.length) return null;
    const target    = targets[Math.floor(Math.random() * targets.length)];
    const abilityId = enemy.abilities?.[0] ?? null;
    return { actor: enemy, type: 'attack', target, abilityId };
  }

  totalXp()   { return this.enemies.reduce((s, e) => s + (e.xp   ?? 0), 0); }
  totalGold() { return this.enemies.reduce((s, e) => s + (e.gold ?? 0), 0); }
}
