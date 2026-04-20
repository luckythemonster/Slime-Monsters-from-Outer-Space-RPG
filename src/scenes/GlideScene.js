const W = 320;
const H = 180;
const LUCKY_COLOR  = 0xff44aa;
const ORB_COLOR    = 0x44ff88;
const DEBRIS_COLOR = 0x888888;
const DURATION_MS  = 16000;

export default class GlideScene extends Phaser.Scene {
  constructor() { super('GlideScene'); }

  init(data) {
    this._returnScene = data.returnScene ?? 'DialogueScene';
    this._score = 0;
    this._hits  = 0;
    this._done  = false;
  }

  create() {
    // Graphics layers in draw order
    this._bgGfx       = this.add.graphics();
    this._cityGfx     = this.add.graphics();
    this._starGfx     = this.add.graphics();
    this._trailGfx    = this.add.graphics();
    this._objectGfx   = this.add.graphics();
    this._luckyGfx    = this.add.graphics();
    this._progressGfx = this.add.graphics();

    this._stars = this._makeStars();
    this._drawCitySilhouette();

    this._luckyX  = W / 2;
    this._luckyY  = 28;
    this._luckyVx = 0;
    this._trail   = [];

    this._obstacles = [];
    this._orbs      = [];
    this._spawnT    = 0;
    this._elapsed   = 0;

    // HUD
    this._orbText = this.add.text(W - 4, 4, '★ 0', {
      font: '9px monospace', color: '#44ff88',
    }).setOrigin(1, 0).setDepth(10);

    this.add.text(4, 4, 'GLIDE  →  Minneapolis', {
      font: '8px monospace', color: '#aaaacc',
    }).setDepth(10);

    // Touch / pointer
    this._pointerX = null;
    this.input.on('pointerdown', p => { this._pointerX = p.x; });
    this.input.on('pointermove', p => { if (p.isDown) this._pointerX = p.x; });
    this.input.on('pointerup',   () => { this._pointerX = null; });

    this._cursors = this.input.keyboard.createCursorKeys();
    this._aKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this._dKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  // ─── update ──────────────────────────────────────────────────────────────

  update(time, delta) {
    if (this._done) return;
    this._elapsed += delta;
    const t = Math.min(1, this._elapsed / DURATION_MS);

    // Input → target velocity
    let targetVx = 0;
    if (this._cursors.left.isDown || this._aKey.isDown) targetVx = -130;
    else if (this._cursors.right.isDown || this._dKey.isDown) targetVx = 130;
    else if (this._pointerX !== null) targetVx = this._pointerX < W / 2 ? -130 : 130;

    this._luckyVx = Phaser.Math.Linear(this._luckyVx, targetVx, 0.18);
    this._luckyX  = Phaser.Math.Clamp(this._luckyX + this._luckyVx * (delta / 1000), 14, W - 14);

    // Lucky descends as time progresses
    this._luckyY = 28 + t * 112;

    // Slime trail
    this._trail.push({ x: this._luckyX, y: this._luckyY, r: 4.5 });
    this._trail = this._trail.map(p => ({ ...p, r: p.r - 0.18 })).filter(p => p.r > 0);

    // Spawn
    this._spawnT -= delta;
    if (this._spawnT <= 0) {
      this._spawn(t);
      this._spawnT = Phaser.Math.Between(350, 800);
    }

    // Scroll objects upward (world rushing past as Lucky falls)
    const speed = (70 + t * 90) * (delta / 1000);
    this._obstacles.forEach(o => { o.y -= speed; });
    this._orbs.forEach(o => { o.y -= speed; });
    this._obstacles = this._obstacles.filter(o => o.y > -24);
    this._orbs      = this._orbs.filter(o => o.y > -12);

    this._checkCollisions();
    this._render(t);

    if (t >= 1) this._end();
  }

  // ─── spawning ────────────────────────────────────────────────────────────

  _spawn(t) {
    const x = Phaser.Math.Between(18, W - 18);

    if (Math.random() < 0.55) {
      // Debris chunk (pod fragment, gets more frequent toward end)
      const size = Phaser.Math.Between(8, 20);
      this._obstacles.push({ x, y: H + 8, w: size, h: Math.floor(size * 0.65) });
    }

    if (Math.random() < 0.4) {
      this._orbs.push({ x: Phaser.Math.Between(18, W - 18), y: H + 8, collected: false });
    }
  }

  // ─── collision ───────────────────────────────────────────────────────────

  _checkCollisions() {
    const lx = this._luckyX, ly = this._luckyY;

    this._obstacles.forEach(o => {
      if (o.y < -20) return;
      if (Math.abs(lx - o.x) < 11 + o.w / 2 && Math.abs(ly - o.y) < 6 + o.h / 2) {
        this._hits++;
        o.y = -999;
        this.cameras.main.shake(180, 0.012);
        const flash = this.add.rectangle(lx, ly, 20, 12, 0xff8800, 0.9).setDepth(8);
        this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
      }
    });

    this._orbs.forEach(o => {
      if (o.collected) return;
      if (Math.abs(lx - o.x) < 14 && Math.abs(ly - o.y) < 14) {
        o.collected = true;
        this._score++;
        this._orbText.setText(`★ ${this._score}`);
        const pop = this.add.circle(o.x, o.y, 7, ORB_COLOR, 0.9).setDepth(8);
        this.tweens.add({
          targets: pop, alpha: 0, scaleX: 2.2, scaleY: 2.2,
          duration: 220, onComplete: () => pop.destroy(),
        });
      }
    });
  }

  // ─── rendering ───────────────────────────────────────────────────────────

  _render(t) {
    // Background — blends from deep space → atmosphere → twilight
    const bg = this._bgGfx;
    bg.clear();
    bg.fillStyle(0x000022);   bg.fillRect(0, 0, W, H);
    if (t > 0.2) {
      const a = Math.min(1, (t - 0.2) / 0.4);
      bg.fillStyle(0x221100, a);  bg.fillRect(0, 0, W, H);
    }
    if (t > 0.6) {
      const a = Math.min(1, (t - 0.6) / 0.3);
      bg.fillStyle(0x1a0033, a);  bg.fillRect(0, 0, W, H);
    }

    // Stars (fade out as atmosphere thickens)
    const sg = this._starGfx;
    sg.clear();
    if (t < 0.5) {
      sg.fillStyle(0xffffff, 1 - t * 2);
      this._stars.forEach(s => sg.fillRect(s.x, s.y, 1, 1));
    }

    // City silhouette appears near the end
    this._cityGfx.setAlpha(Math.max(0, (t - 0.7) / 0.3));

    // Trail + Lucky
    const tg = this._trailGfx;
    tg.clear();
    this._trail.forEach(p => {
      tg.fillStyle(0x44cc88, Math.min(0.7, p.r / 4));
      tg.fillEllipse(p.x, p.y, p.r * 1.6, p.r * 0.8);
    });

    const lg = this._luckyGfx;
    const x = Math.round(this._luckyX);
    const y = Math.round(this._luckyY);
    lg.clear();
    // body — squished horizontal oval for gliding look
    lg.fillStyle(LUCKY_COLOR);
    lg.fillEllipse(x, y, 22, 10);
    // slime sunglasses
    lg.fillStyle(0x003322);
    lg.fillRect(x - 8, y - 2, 6, 4);
    lg.fillRect(x + 2,  y - 2, 6, 4);
    // glide flaps (small wing-stubs either side)
    lg.fillStyle(LUCKY_COLOR);
    const lean = Math.sign(this._luckyVx) * 2;
    lg.fillEllipse(x - 14 + lean, y + 1, 8, 4);
    lg.fillEllipse(x + 14 + lean, y + 1, 8, 4);

    // Obstacles + orbs
    const og = this._objectGfx;
    og.clear();
    og.fillStyle(DEBRIS_COLOR);
    this._obstacles.forEach(o => {
      if (o.y > -20) og.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
    });
    og.fillStyle(ORB_COLOR);
    this._orbs.filter(o => !o.collected && o.y > -12)
              .forEach(o => og.fillEllipse(o.x, o.y, 10, 10));

    // Progress bar
    const pg = this._progressGfx;
    pg.clear();
    pg.fillStyle(0x111133);  pg.fillRect(0, H - 5, W, 5);
    pg.fillStyle(0xcc44ff);  pg.fillRect(0, H - 5, Math.floor(W * t), 5);
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  _makeStars() {
    const stars = [];
    for (let i = 0; i < 45; i++) {
      stars.push({ x: Phaser.Math.Between(0, W), y: Phaser.Math.Between(0, H - 40) });
    }
    return stars;
  }

  _drawCitySilhouette() {
    const g = this._cityGfx;
    g.fillStyle(0x110022);
    const buildings = [
      [0, 18], [38, 14], [68, 22], [96, 10], [130, 20],
      [158, 8], [196, 17], [228, 24], [262, 11], [293, 19],
    ];
    buildings.forEach(([x, h], i) => {
      const w = 30 + (i % 3) * 5;
      g.fillRect(x, H - 15 - h, w, h + 15);
    });
    // Warm glow above city
    g.fillStyle(0x660033, 0.25);
    g.fillRect(0, H - 50, W, 50);
    this._cityGfx.setAlpha(0);
  }

  // ─── end ─────────────────────────────────────────────────────────────────

  _end() {
    if (this._done) return;
    this._done = true;

    const reward = Math.max(2, 5 + this._score * 3 - this._hits);
    const party  = this.registry.get('party');
    if (party) party.cash += reward;

    this.cameras.main.shake(600, 0.04);
    this.time.delayedCall(300, () => {
      const box = this.add.rectangle(W / 2, H / 2, 200, 60, 0x000022, 0.92).setDepth(15);
      this.add.text(W / 2, H / 2 - 10, 'MINNEAPOLIS!', {
        font: '11px monospace', color: '#cc44ff',
      }).setOrigin(0.5).setDepth(16);
      this.add.text(W / 2, H / 2 + 8, `★ ${this._score}  ×$3   +$${reward} cash`, {
        font: '9px monospace', color: '#44ff88',
      }).setOrigin(0.5).setDepth(16);
    });

    this.time.delayedCall(3000, () => {
      this.registry.set('lastMinigame', { score: this._score, reward });
      this.scene.stop('GlideScene');
      if (this.scene.get(this._returnScene)?.sys.isSleeping()) {
        this.scene.wake(this._returnScene);
      } else {
        this.scene.resume(this._returnScene);
      }
    });
  }
}
