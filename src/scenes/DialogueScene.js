const BOX_Y   = 110;
const BOX_H   = 68;
const TYPE_MS = 28;

const PORTRAIT_COLORS = {
  lucky:   0xff44aa,
  phoenix: 0x44aacc,
  ryan:    0x44cc88,
  dad:     0x888888,
  brian:   0xccaa44,
};

export default class DialogueScene extends Phaser.Scene {
  constructor() {
    super('DialogueScene');
  }

  init(data) {
    this._dialogueId   = data.dialogueId;
    this._returnScene  = data.returnScene ?? 'ExploreScene';
    this._stepIndex    = 0;
    this._typing       = false;
    this._waiting      = false;
    this._choiceIndex  = 0;
    this._choiceTexts  = [];
    this._choiceZones  = [];
    this._lastPortrait = null;
    this._prevMode     = null;  // 'text' | 'title'
  }

  create() {
    const dialogues = this.registry.get('dialogues') ?? {};
    const def = dialogues[this._dialogueId];
    if (!def) {
      console.error('Dialogue not found:', this._dialogueId);
      this._close();
      return;
    }
    this._steps = def.steps ?? [];

    this._setupUI();
    this._setupInput();
    this.events.on('resume', () => this._onResume());
    this._runStep();
  }

  // ─── UI setup ────────────────────────────────────────────────────────────

  _setupUI() {
    this._dimRect = this.add.rectangle(160, 55, 320, 110, 0x000000, 0.35).setDepth(0);

    this._gfx          = this.add.graphics().setDepth(1);
    this._portraitGfx  = this.add.graphics().setDepth(2);
    this._speakerText  = this.add.text(38, BOX_Y + 5, '', {
      font: '9px monospace', color: '#ffff88',
    }).setDepth(2);
    this._bodyText     = this.add.text(10, BOX_Y + 19, '', {
      font: '9px monospace', color: '#ffffff',
      wordWrap: { width: 298 },
      lineSpacing: 3,
    }).setDepth(2);
    this._promptText   = this.add.text(308, BOX_Y + BOX_H - 9, '▼', {
      font: '8px monospace', color: '#aaaaff',
    }).setDepth(2).setVisible(false);
  }

  _setupInput() {
    this._zKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this._enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this._upKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this._downKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

    this._tapZone = this.add.rectangle(160, BOX_Y + BOX_H / 2, 320, BOX_H, 0x000000, 0)
      .setDepth(3)
      .setInteractive();
    this._tapZone.on('pointerdown', () => this._onAdvance());
  }

  // ─── step runner ─────────────────────────────────────────────────────────

  _runStep() {
    if (this._stepIndex >= this._steps.length) { this._close(); return; }
    const step = this._steps[this._stepIndex];
    this._clearChoices();
    this._promptText.setVisible(false);

    switch (step.type) {
      case 'text':       this._showText(step);    break;
      case 'title':      this._showTitle(step);   break;
      case 'choice':     this._showChoice(step);  break;
      case 'flag':       this._doFlag(step);      break;
      case 'party_join': this._doPartyJoin(step); break;
      case 'battle':     this._doBattle(step);    break;
      case 'map_change': this._doMapChange(step); break;
      case 'shake':      this._doShake(step);     break;
      case 'flash':      this._doFlash(step);     break;
      case 'sound_word': this._doSoundWord(step); break;
      case 'minigame':   this._doMinigame(step);  break;
      case 'end':        this._close();           break;
      default:           this._advance();         break;
    }
  }

  _advance() {
    this._stepIndex++;
    this._runStep();
  }

  // ─── step types ──────────────────────────────────────────────────────────

  _showText(step) {
    const fromTitle = this._prevMode === 'title';
    this._prevMode = 'text';

    this._drawBox();
    this._drawPortrait(step.portrait);
    this._speakerText.setText(step.speaker ?? '');

    if (fromTitle) {
      // Fade box in after a title card
      this._gfx.setAlpha(0);
      this._speakerText.setAlpha(0);
      this._bodyText.setAlpha(0);
      this.tweens.add({ targets: [this._gfx, this._speakerText, this._bodyText], alpha: 1, duration: 220 });
    }

    this._typewrite(step.text ?? '');
    this._waiting = true;
  }

  _showTitle(step) {
    this._prevMode = 'title';
    this._lastPortrait = null; // next character will slide in fresh

    this._gfx.clear();
    this._portraitGfx.clear();
    this._speakerText.setText('');
    this._promptText.setVisible(false);

    // Fade in the full-screen black overlay
    this._gfx.fillStyle(0x000000, 0.85);
    this._gfx.fillRect(0, 0, 320, 180);
    this._gfx.setAlpha(0);
    this.tweens.add({ targets: this._gfx, alpha: 1, duration: 280, ease: 'Quad.easeIn' });

    // Delay text slightly so the fade completes first
    this._bodyText.setPosition(160, 76).setOrigin(0.5).setAlign('center').setText('').setAlpha(0);
    this.time.delayedCall(220, () => {
      this.tweens.add({ targets: this._bodyText, alpha: 1, duration: 200 });
      this._typewrite(step.text ?? '', () => {
        this._promptText.setPosition(308, 170);
        this._promptText.setVisible(true);
      });
    });
    this._waiting = true;
  }

  _showChoice(step) {
    this._drawBox();
    this._speakerText.setText('');
    this._bodyText.setPosition(10, BOX_Y + 19);
    this._bodyText.setOrigin(0, 0);
    this._bodyText.setAlign('left');
    this._bodyText.setText(step.text ?? '');

    const options = step.options ?? [];
    this._choiceIndex = 0;
    options.forEach((opt, i) => {
      const cy   = BOX_Y + 32 + i * 16;
      const txt  = this.add.text(20, cy, `  ${opt.label}`, {
        font: '9px monospace', color: '#ffffff',
      }).setDepth(2);
      const zone = this.add.rectangle(160, cy + 6, 300, 14, 0x000000, 0)
        .setDepth(3).setInteractive();
      zone.on('pointerdown', () => this._selectChoice(options, i));
      zone.on('pointerover', () => { this._choiceIndex = i; this._refreshChoices(options); });
      this._choiceTexts.push(txt);
      this._choiceZones.push(zone);
    });
    this._refreshChoices(options);
    this._waiting = true;
  }

  _selectChoice(options, i) {
    const opt = options[i];
    const events = this.registry.get('events');
    if (opt.flag_set) events?.set(opt.flag_set);
    this._advance();
  }

  _refreshChoices(options) {
    this._choiceTexts.forEach((t, i) => {
      t.setText(i === this._choiceIndex ? `► ${options[i].label}` : `  ${options[i].label}`);
      t.setColor(i === this._choiceIndex ? '#ffff88' : '#ffffff');
    });
  }

  _doFlag(step) {
    const events = this.registry.get('events');
    if (step.set) events?.set(step.set);
    this._advance();
  }

  _doPartyJoin(step) {
    const party      = this.registry.get('party');
    const characters = this.registry.get('characters') ?? [];
    const equipDefs  = this.registry.get('equipment') ?? [];
    const def        = characters.find(c => c.id === step.character);
    if (!def || !party) { this._advance(); return; }

    const alreadyIn = party.members.some(m => m.id === step.character);
    if (!alreadyIn) {
      const newMember = party._build(def);
      if (def.startingEquipment) {
        for (const slot of ['instrument', 'outfit']) {
          const id = def.startingEquipment[slot];
          const itemDef = equipDefs.find(e => e.id === id);
          if (itemDef) party.equip(newMember, itemDef);
        }
      }
      party.members.push(newMember);
    }
    this._advance();
  }

  _doBattle(step) {
    const allEnemies = this.registry.get('enemies') ?? [];
    const enemyDefs  = (step.enemies ?? []).map(id => allEnemies.find(e => e.id === id)).filter(Boolean);
    if (!enemyDefs.length) { this._advance(); return; }

    if (step.winDialogue) this.registry.set('battleWinDialogue', step.winDialogue);

    this.scene.launch('BattleScene', {
      enemies:     enemyDefs,
      party:       this.registry.get('party'),
      abilities:   this.registry.get('abilities'),
      resumeScene: 'DialogueScene',
      canFlee:     step.canFlee ?? true,
    });
    this.scene.pause('DialogueScene');
  }

  _doMapChange(step) {
    this.registry.set('pendingSceneAction', { type: 'map_change', map: step.map, x: step.x, y: step.y });
    const returnScene = this._returnScene;
    this.scene.stop('DialogueScene');
    this.scene.stop(returnScene);
    this.scene.start('ExploreScene', { mapId: step.map, tileX: step.x, tileY: step.y });
  }

  _doMinigame(step) {
    this.scene.launch('GlideScene', { id: step.id ?? 'glide', returnScene: 'DialogueScene' });
    this.scene.pause('DialogueScene');
  }

  _doShake(step) {
    this.cameras.main.shake(step.duration ?? 400, step.intensity ?? 0.015);
    this.time.delayedCall(step.duration ?? 400, () => this._advance());
  }

  _doFlash(step) {
    const color = parseInt((step.color ?? '#ffffff').replace('#', ''), 16);
    const rect = this.add.rectangle(160, 90, 320, 180, color, 0.8).setDepth(10);
    this.tweens.add({
      targets: rect, alpha: 0, duration: step.duration ?? 400,
      onComplete: () => { rect.destroy(); this._advance(); },
    });
  }

  _doSoundWord(step) {
    const x     = step.x ?? 160;
    const y     = step.y ?? 80;
    const angle = step.angle ?? Phaser.Math.Between(-8, 8);
    const txt = this.add.text(x, y, step.text ?? '', {
      font: `bold ${step.size ?? 28}px monospace`,
      color: step.color ?? '#ff4422',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(30).setScale(0.1).setAngle(angle);

    this._gfx.clear();
    this._bodyText.setText('');
    this._speakerText.setText('');

    this.tweens.add({
      targets: txt, scale: 1, duration: 200, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(step.hold ?? 700, () => {
          this.tweens.add({
            targets: txt, alpha: 0, y: y - 20, duration: 250,
            onComplete: () => { txt.destroy(); this._advance(); },
          });
        });
      },
    });
  }

  // ─── typewriter ──────────────────────────────────────────────────────────

  _typewrite(text, onDone) {
    this._typing = true;
    this._bodyText.setText('');
    this._fullText = text;
    let i = 0;

    if (this._typeTimer) this._typeTimer.remove();
    this._typeTimer = this.time.addEvent({
      delay: TYPE_MS,
      repeat: text.length - 1,
      callback: () => {
        i++;
        this._bodyText.setText(text.slice(0, i));
        if (i >= text.length) {
          this._typing = false;
          this._promptText.setVisible(true);
          onDone?.();
        }
      },
    });
  }

  _skipTypewriter() {
    if (this._typeTimer) this._typeTimer.remove();
    this._bodyText.setText(this._fullText ?? '');
    this._typing = false;
    this._promptText.setVisible(true);
  }

  // ─── drawing helpers ─────────────────────────────────────────────────────

  _drawBox() {
    this._gfx.clear();
    this._gfx.fillStyle(0x000022);
    this._gfx.fillRect(2, BOX_Y, 316, BOX_H);
    this._gfx.lineStyle(1, 0x4488cc);
    this._gfx.strokeRect(2, BOX_Y, 316, BOX_H);

    this._bodyText.setPosition(10, BOX_Y + 19);
    this._bodyText.setOrigin(0, 0);
    this._bodyText.setAlign('left');
    this._promptText.setPosition(308, BOX_Y + BOX_H - 9);
  }

  _drawPortrait(portraitKey) {
    this._portraitGfx.clear();
    if (!portraitKey) { this._speakerText.setX(10); return; }
    const color = PORTRAIT_COLORS[portraitKey] ?? 0x888888;
    const px = 8, py = BOX_Y + 4;
    this._portraitGfx.fillStyle(color);
    this._portraitGfx.fillEllipse(px + 12, py + 12, 22, 22);
    this._portraitGfx.fillStyle(0x000000);
    this._portraitGfx.fillRect(px + 6,  py + 8,  3, 3);
    this._portraitGfx.fillRect(px + 14, py + 8,  3, 3);
    this._portraitGfx.fillRect(px + 9,  py + 16, 7, 2);
    this._speakerText.setX(38);

    // Slide portrait in from left and pop speaker name when speaker changes
    if (portraitKey !== this._lastPortrait) {
      this._lastPortrait = portraitKey;
      this._portraitGfx.x = -24;
      this.tweens.add({ targets: this._portraitGfx, x: 0, duration: 180, ease: 'Back.easeOut' });
      this._speakerText.setAlpha(0);
      this.tweens.add({ targets: this._speakerText, alpha: 1, duration: 150 });
    }
  }

  _clearChoices() {
    this._choiceTexts.forEach(t => t.destroy());
    this._choiceZones.forEach(z => z.destroy());
    this._choiceTexts = [];
    this._choiceZones = [];
  }

  // ─── advance / close ─────────────────────────────────────────────────────

  _onAdvance() {
    const step = this._steps[this._stepIndex];
    if (step?.type === 'choice') return;

    if (this._typing) {
      this._skipTypewriter();
      return;
    }
    if (this._waiting) {
      this._waiting = false;
      this._advance();
    }
  }

  update() {
    const step = this._steps[this._stepIndex];
    if (step?.type === 'choice') {
      if (Phaser.Input.Keyboard.JustDown(this._upKey)) {
        this._choiceIndex = Math.max(0, this._choiceIndex - 1);
        this._refreshChoices(step.options ?? []);
      } else if (Phaser.Input.Keyboard.JustDown(this._downKey)) {
        this._choiceIndex = Math.min((step.options?.length ?? 1) - 1, this._choiceIndex + 1);
        this._refreshChoices(step.options ?? []);
      } else if (Phaser.Input.Keyboard.JustDown(this._zKey) || Phaser.Input.Keyboard.JustDown(this._enterKey)) {
        this._selectChoice(step.options ?? [], this._choiceIndex);
      }
      return;
    }

    if (
      Phaser.Input.Keyboard.JustDown(this._zKey) ||
      Phaser.Input.Keyboard.JustDown(this._enterKey)
    ) {
      this._onAdvance();
    }
  }

  _close() {
    this._clearChoices();
    if (this._typeTimer) this._typeTimer.remove();
    this.scene.stop('DialogueScene');
    if (this.scene.get(this._returnScene)) {
      this.scene.resume(this._returnScene);
    }
  }

  _onResume() {
    // Minigame finished — just advance past the step
    const mgResult = this.registry.get('lastMinigame');
    if (mgResult) {
      this.registry.remove('lastMinigame');
      this._advance();
      return;
    }

    const result = this.registry.get('lastBattle');
    if (!result) return;
    this.registry.remove('lastBattle');

    if (result.won) {
      const winDialogue = this.registry.get('battleWinDialogue');
      if (winDialogue) {
        this.registry.remove('battleWinDialogue');
        const dialogues = this.registry.get('dialogues') ?? {};
        const def = dialogues[winDialogue];
        if (def) {
          this._steps     = def.steps ?? [];
          this._stepIndex = 0;
          this._clearChoices();
          this._runStep();
          return;
        }
      }
      this._advance();
    } else if (!result.fled) {
      this.scene.stop('DialogueScene');
      this.scene.start('GameOverScene');
    } else {
      this._advance();
    }
  }
}
