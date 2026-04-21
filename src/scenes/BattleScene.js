import BattleSystem from '../systems/BattleSystem.js';
import BattleHUD    from '../ui/BattleHUD.js';

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  init(data) {
    this._party      = data.party;
    this._enemyDefs  = data.enemies;
    this._abilities  = data.abilities;
    this._resumeScene = data.resumeScene ?? 'TestScene';
  }

  create() {
    this.battle  = new BattleSystem(this._party.living(), this._enemyDefs, this._abilities, this._party);
    this.log     = [];
    this.busy    = false;

    this._drawBackground();
    this.hud = new BattleHUD(this);
    this.hud.onAction(action => this._onPlayerAction(action));

    this._setupInput();
    this._addLog(`A ${this.battle.enemies[0].name} appeared!`);
    this._redraw();

    if (this.battle.phase === 'enemy_turn') {
      this.time.delayedCall(800, () => this._runEnemyTurn());
    }
  }

  // ─── input ──────────────────────────────────────────────────────────────

  _setupInput() {
    this.cursors   = this.input.keyboard.createCursorKeys();
    this.zKey      = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.enterKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  update() {
    if (this.busy || this.battle.phase !== 'player_turn') return;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.hud.moveCursor(-1);
      this._redraw();
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.hud.moveCursor(1);
      this._redraw();
    } else if (
      Phaser.Input.Keyboard.JustDown(this.zKey) ||
      Phaser.Input.Keyboard.JustDown(this.enterKey)
    ) {
      this.hud.confirmCurrent();
    }
  }

  // ─── player actions ─────────────────────────────────────────────────────

  _onPlayerAction(action) {
    if (this.busy || this.battle.phase !== 'player_turn') return;
    this.busy = true;

    switch (action) {
      case 'ATTACK':  this._playerAttack(); break;
      case 'ABILITY': this._playerAttack('ability'); break;
      case 'ITEM':    this._playerItem(); break;
      case 'FLEE':    this._flee(); break;
    }
  }

  _playerAttack(mode = 'basic') {
    const actor  = this.battle.getCurrentActor();
    const target = this.battle.livingEnemies()[0];
    if (!actor || !target) { this.busy = false; return; }

    const abilityId = mode === 'ability' && actor.abilities?.length
      ? actor.abilities[0]
      : 'slash';

    const ability = this._abilities.find(a => a.id === abilityId);
    if (ability && ability.mp_cost > (actor.currentMp ?? actor.mp)) {
      this._addLog(`${actor.name} doesn't have enough MP!`);
      this._redraw();
      this.busy = false;
      return;
    }
    if (ability?.mp_cost) actor.currentMp = (actor.currentMp ?? actor.mp) - ability.mp_cost;

    // Route buff/debuff abilities to status system instead of damage
    if (ability && (ability.type === 'buff' || ability.type === 'debuff')) {
      const targets = ability.target === 'all_allies'
        ? this.battle.livingParty()
        : ability.target === 'self'
          ? [actor]
          : [this.battle.livingEnemies()[0]];
      targets.forEach(t => this.battle.applyStatus(t, ability.status, ability.statusDuration ?? 3));
      this._addLog(`${actor.name} → [${ability.status.toUpperCase()}] applied!`);
      this._spawnWordProjectile(ability.word, ability.wordColor, 'buff');
      this._afterPlayerAction();
      return;
    }

    // Heal ability
    if (ability?.type === 'heal') {
      const healTarget = [...this.battle.party].sort((a, b) =>
        (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp)
      )[0];
      const res = this.battle.applyHeal(actor, healTarget, abilityId);
      this._addLog(`${actor.name} heals ${healTarget.name} for ${res.amount} HP!`);
      this._spawnDamageNumber(res.amount, true);
      this._spawnWordProjectile(ability.word, ability.wordColor, 'buff');
      this._afterPlayerAction();
      return;
    }

    const res = this.battle.applyAttack(actor, target, abilityId);
    this._addLog(`${actor.name} uses ${ability?.name ?? 'Attack'} on ${target.name} for ${res.amount} dmg!`);
    this._spawnDamageNumber(res.amount, false);
    this._flashEnemy();
    this._spawnWordProjectile(ability?.word, ability?.wordColor, 'attack');
    this._afterPlayerAction();
  }

  _playerItem() {
    const items = this._party.inventory;
    if (!items.length) {
      this._addLog('No items!');
      this._redraw();
      this.busy = false;
      return;
    }
    const itemsDefs = this.registry.get('items') ?? [];
    const slot = items.find(s => {
      const def = itemsDefs.find(d => d.id === s.id);
      return def?.effect === 'heal_hp';
    });
    if (!slot) {
      this._addLog('No usable items!');
      this._redraw();
      this.busy = false;
      return;
    }
    const itemDef  = itemsDefs.find(d => d.id === slot.id);
    const target   = [...this.battle.party].sort((a, b) =>
      (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp)
    )[0];
    target.currentHp = Math.min(target.currentHp + itemDef.value, target.maxHp);
    this._party.useItem(slot.id);
    this._addLog(`Used ${itemDef.name} on ${target.name}. +${itemDef.value} HP!`);
    this._afterPlayerAction();
  }

  _afterPlayerAction() {
    this.battle.advanceTurn();
    this._redraw();
    this._checkEnd(() => {
      if (this.battle.phase === 'enemy_turn') {
        this.time.delayedCall(500, () => this._runEnemyTurn());
      } else {
        this.busy = false;
      }
    });
  }

  // ─── enemy turn ─────────────────────────────────────────────────────────

  _runEnemyTurn() {
    const actor = this.battle.getCurrentActor();
    if (!actor || actor.isPlayer) { this.busy = false; return; }

    const action = this.battle.getEnemyAction(actor);
    if (!action) { this.battle.advanceTurn(); this._nextTurn(); return; }

    const res = this.battle.applyAttack(actor, action.target, action.abilityId);
    const pm = this._party.members.find(m => m.id === action.target.id);
    if (pm) pm.hp = action.target.currentHp;

    this._addLog(`${actor.name} attacks ${action.target.name} for ${res.amount} dmg!`);
    this._spawnDamageNumber(res.amount, false, true);
    const enemyAbility = this._abilities?.find(a => a.id === action.abilityId);
    this._spawnWordProjectile(enemyAbility?.word, enemyAbility?.wordColor, 'enemy');
    this.battle.advanceTurn();
    this._redraw();

    this._checkEnd(() => {
      this.time.delayedCall(400, () => this._nextTurn());
    });
  }

  _nextTurn() {
    if (this.battle.phase === 'enemy_turn') {
      this._runEnemyTurn();
    } else {
      this.busy = false;
    }
  }

  // ─── flee ───────────────────────────────────────────────────────────────

  _flee() {
    this._addLog('The party fled!');
    this._redraw();
    this.time.delayedCall(900, () => {
      this.registry.set('lastBattle', { fled: true });
      this.scene.stop();
      this.scene.resume(this._resumeScene);
    });
  }

  // ─── battle end ─────────────────────────────────────────────────────────

  _checkEnd(onContinue) {
    if (this.battle.livingEnemies().length === 0) {
      this.time.delayedCall(500, () => this._victory());
    } else if (this.battle.livingParty().length === 0) {
      this.time.delayedCall(500, () => this._defeat());
    } else {
      onContinue();
    }
  }

  _victory() {
    const xp   = this.battle.totalXp();
    const gold = this.battle.totalGold();
    this._party.cash += gold;
    const levelUps = this._party.gainXp(xp);

    this._addLog(`Victory! +${xp} XP  +$${gold}`);
    levelUps.forEach(lu => this._addLog(`${lu.member.name} is now Lv.${lu.level}!`));
    this._redraw();

    this.time.delayedCall(2200, () => {
      this.registry.set('lastBattle', { won: true, xp, gold });
      this.scene.stop();
      this.scene.resume(this._resumeScene);
    });
  }

  _defeat() {
    this._addLog('The party was defeated...');
    this._redraw();
    this.time.delayedCall(2000, () => {
      this.scene.stop();
      this.scene.start('GameOverScene');
    });
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  _addLog(msg) {
    this.log.push(msg);
  }

  _redraw() {
    this.hud.draw(this.battle, this.log);
  }

  // ─── animations ─────────────────────────────────────────────────────────

  _spawnWordProjectile(word, wordColor, mode = 'attack') {
    if (!word) return;
    const color = wordColor ?? '#ffffff';

    if (mode === 'buff') {
      const txt = this.add.text(130, 115, word, {
        font: 'bold 11px monospace', color,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(25).setScale(0.1).setAngle(6);
      this.tweens.add({
        targets: txt, scale: 1.3, angle: 0, duration: 220, ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({ targets: txt, alpha: 0, duration: 400, delay: 350, onComplete: () => txt.destroy() });
        },
      });
      return;
    }

    const toEnemy = mode !== 'enemy';
    const startX = toEnemy ? 160 : 74;
    const startY = toEnemy ? 128 : 34;
    const endX   = toEnemy ? 74  : 130;
    const endY   = toEnemy ? 34  : 118;

    const txt = this.add.text(startX, startY, word, {
      font: 'bold 11px monospace', color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25).setScale(0.4).setAngle(toEnemy ? -12 : 12);

    this.tweens.add({
      targets: txt, x: endX, y: endY, scaleX: 1.5, scaleY: 1.5, angle: 0,
      duration: 280, ease: 'Quad.easeIn',
      onComplete: () => {
        this.tweens.add({
          targets: txt, scaleX: 2.4, scaleY: 0.3, duration: 70, yoyo: true,
          onComplete: () => {
            this.tweens.add({
              targets: txt, alpha: 0, y: endY - 18,
              duration: 300, delay: 80, onComplete: () => txt.destroy(),
            });
          },
        });
      },
    });
  }

  _spawnDamageNumber(amount, isHeal = false, onParty = false) {
    // Enemies are drawn around x=74; party area is off-screen (HUD panel)
    const x = onParty ? 130 : 74;
    const y = onParty ? 130 :  34;
    const color = isHeal ? '#44ff88' : '#ff4444';
    const txt = this.add.text(x, y, isHeal ? `+${amount}` : `-${amount}`, {
      font: '10px monospace', color,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets:  txt,
      y:        y - 28,
      alpha:    0,
      duration: 900,
      ease:     'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  _flashEnemy() {
    const flash = this.add.rectangle(74, 34, 50, 50, 0xffffff, 0.75).setDepth(19);
    this.tweens.add({
      targets:  flash,
      alpha:    0,
      duration: 180,
      onComplete: () => flash.destroy(),
    });
  }

  _drawBackground() {
    this.add.rectangle(160, 56, 320, 112, 0x000011);
    const gfx = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, 320);
      const y = Phaser.Math.Between(0, 112);
      const b = Phaser.Math.Between(120, 255);
      gfx.fillStyle(Phaser.Display.Color.GetColor(b, b, b));
      gfx.fillRect(x, y, 1, 1);
    }
  }
}
