// FreefallScene (DESIGN.md E22, "Freefall sequence"): the 24 s steerable descent from Planet
// California to the alley. Launched by ExploreScene.runSpecialScene('Freefall', data) →
// launch('Freefall', { ...data, onDone }); calls onDone() and stops itself when it ends.
//
//   sky        8 banded twilight rows (purple → orange) drifting down 1 px / 30 frames, with a
//              64×64 `sky` TileSprite of stars/wisps scrolling up 2 px/frame
//   lucky      `lucky_fall` (24×16 flattened) at y 48, steered left/right at up to 3 px/frame
//              (acceleration 1 px every 3 frames); sunglasses swap in at 5 s with `slime_pop`;
//              falls back to the `lucky` sheet's melt frames when no `lucky_fall` sheet exists
//   contrail   two stacked 256×224 RenderTextures scrolling with the sky; every frame a 4×4 dot
//              (pink, then green 4 frames / 8 px later) is stamped under Lucky
//   billboards five 64×24 WORK IS LOVE boards (`billboard_fall`, else drawn) at t = 4, 8, 12, 16,
//              20 s; crossing one glitches it (`glitch`, vars.billboardsTagged++)
//   end        the skyline rises over the last 4 s, white flash, `crash`, onDone()
//   skip       cancel/confirm after 8 s; the whole scene is 2 s under ?fast=1
import Phaser from 'phaser';
import { services } from '../engine/services.js';
import { audioCall } from '../engine/Audio.js';
import { WIDTH, HEIGHT, PIXEL_FONT, PARAMS } from '../config.js';

const SKY_KEY = '__ff_sky';
const BOARD_KEY = '__ff_board';
const SKYLINE_KEY = '__ff_skyline';
const BANDS = [0x1a0a2a, 0x2a1048, 0x3a1858, 0x5a2068, 0x7a3060, 0xa04050, 0xc86040, 0xe08838];
const SCROLL = 2; // px per frame
const DOT_COLORS = [0xff5fd2, 0x39ff8a];
const BOARD = { w: 64, h: 24, count: 5 };
const FRAME = 1000 / 60;

export default class FreefallScene extends Phaser.Scene {
  constructor() { super({ key: 'Freefall' }); }

  init(data) {
    this.onDone = data && data.onDone;
    this.payload = data || {};
    this.fast = !!PARAMS.fast;
    this.totalMs = this.fast ? 2000 : 24000;
    this.skipAfterMs = this.fast ? 400 : 8000;
    this.shadesAtMs = this.fast ? 500 : 5000;
    this.skylineMs = this.fast ? 600 : 4000;
    this.elapsed = 0;
    this.frames = 0;
    this.finished = false;
    this.vx = 0;
    this.accel = 0;
    this.tagged = 0;
    this.boards = [];
    this.nextBoard = 0;
    this.shades = false;
    this.skylineY = HEIGHT;
  }

  get state() { return services.state; }

  create() {
    this.cameras.main.setBackgroundColor('#1a0a2a');
    this.makeTextures();
    // Sky bands (drift 1 px / 30 frames) under a star/wisp TileSprite.
    this.bands = BANDS.map((c, i) => this.add.rectangle(0, i * 28, WIDTH, 28 + 1, c, 1).setOrigin(0, 0).setDepth(0));
    this.bandShift = 0;
    this.sky = this.add.tileSprite(0, 0, WIDTH, HEIGHT, SKY_KEY).setOrigin(0, 0).setDepth(1);
    // Contrail: two RenderTextures stacked; A on screen, B below it.
    this.trail = [this.add.renderTexture(0, 0, WIDTH, HEIGHT), this.add.renderTexture(0, HEIGHT, WIDTH, HEIGHT)];
    for (const rt of this.trail) rt.setOrigin(0, 0).setDepth(2);
    // Lucky.
    this.useFallSheet = this.textures.exists('lucky_fall');
    this.lucky = this.add.sprite(WIDTH / 2, 48, this.useFallSheet ? 'lucky_fall' : 'lucky', 0).setOrigin(0.5, 0.5).setDepth(5);
    if (!this.useFallSheet) {
      if (this.anims.exists('lucky_melt')) this.lucky.play('lucky_melt');
      this.lucky.setAngle(0);
    } else {
      this.playFall('glide');
    }
    this.skyline = this.add.image(0, HEIGHT, SKYLINE_KEY).setOrigin(0, 0).setDepth(4);
    this.hint = this.add.text(WIDTH / 2, HEIGHT - 14, '', { fontFamily: PIXEL_FONT, fontSize: '8px', color: '#8c8ca0', resolution: 1 }).setOrigin(0.5, 0).setDepth(20);
    audioCall('playMusic', 'flying_squirrel', { fade: 0.2 });
    services.ui.fade('in', this.fast ? 60 : 300);
    this.scene.bringToTop('UI');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  cleanup() {
    for (const k of [SKY_KEY, BOARD_KEY, SKYLINE_KEY]) if (this.textures.exists(k)) this.textures.remove(k);
  }

  /** Procedural textures: the 64×64 sky tile, a drawn WORK IS LOVE board (2 frames), the skyline. */
  makeTextures() {
    if (!this.textures.exists(SKY_KEY)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      let seed = 7;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let i = 0; i < 14; i++) { g.fillStyle(i % 3 === 0 ? 0xf8f8f8 : 0x8080a0, 1); g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1, 1); }
      g.fillStyle(0xffffff, 0.08);
      for (let i = 0; i < 4; i++) g.fillRect(Math.floor(rnd() * 48), Math.floor(rnd() * 60), 12 + Math.floor(rnd() * 16), 2);
      g.generateTexture(SKY_KEY, 64, 64);
      g.destroy();
    }
    if (!this.textures.exists('billboard_fall') && !this.textures.exists(BOARD_KEY)) {
      // Two frames side by side: normal, glitched.
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      for (let f = 0; f < 2; f++) {
        const x = f * BOARD.w;
        g.fillStyle(0x141018, 1); g.fillRect(x, 0, BOARD.w, BOARD.h);
        g.fillStyle(f ? 0x39ff8a : 0xf8f8f8, 1); g.fillRect(x + 2, 2, BOARD.w - 4, BOARD.h - 4);
        g.fillStyle(f ? 0xff1aa0 : 0x141018, 1);
        // Blocky "WORK IS LOVE" lettering: 11 glyph cells of 4×6.
        for (let i = 0; i < 11; i++) { if (i === 4 || i === 7) continue; g.fillRect(x + 6 + i * 5, 7 + (f && i % 2 ? 3 : 0), 3, 6); }
        g.fillStyle(0x8c8ca0, 1); g.fillRect(x + 8, 16, BOARD.w - 16, 2);
        if (f) { g.fillStyle(0x141018, 1); g.fillRect(x + 4, 10, BOARD.w - 8, 1); g.fillRect(x + 10, 5, BOARD.w - 20, 1); }
      }
      g.generateTexture(BOARD_KEY, BOARD.w * 2, BOARD.h);
      g.destroy();
      this.textures.get(BOARD_KEY).add(0, 0, 0, 0, BOARD.w, BOARD.h);
      this.textures.get(BOARD_KEY).add(1, 0, BOARD.w, 0, BOARD.w, BOARD.h);
    }
    if (!this.textures.exists(SKYLINE_KEY)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      let seed = 3;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      g.fillStyle(0x141018, 1);
      for (let x = 0; x < WIDTH;) {
        const w = 12 + Math.floor(rnd() * 28);
        const h = 16 + Math.floor(rnd() * 40);
        g.fillRect(x, 64 - h, w, h);
        g.fillStyle(0xffe066, 1);
        for (let wy = 64 - h + 4; wy < 60; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 6) if (rnd() < 0.4) g.fillRect(wx, wy, 2, 2);
        g.fillStyle(0x141018, 1);
        x += w + 2 + Math.floor(rnd() * 6);
      }
      g.fillRect(0, 60, WIDTH, 4);
      g.generateTexture(SKYLINE_KEY, WIDTH, 64);
      g.destroy();
    }
  }

  playFall(kind) {
    if (!this.useFallSheet) return;
    const key = `lucky_fall_${kind}${this.shades ? '_shades' : ''}`;
    if (this.anims.exists(key)) { if (this.lucky.anims.currentAnim?.key !== key) this.lucky.play(key, true); }
    else if (this.anims.exists(`lucky_fall_${kind}`)) this.lucky.play(`lucky_fall_${kind}`, true);
  }

  putShades() {
    this.shades = true;
    audioCall('sfx', 'slime_pop');
    if (this.useFallSheet && this.anims.exists('lucky_fall_glide_shades')) { this.playFall('glide'); return; }
    // No shades frames yet: a two-pixel black bar across the eyes.
    this.shadeBar = this.add.rectangle(this.lucky.x, this.lucky.y - 2, 10, 2, 0x141018, 1).setDepth(6);
  }

  spawnBoard() {
    const hasArt = this.textures.exists('billboard_fall');
    const x = 40 + Math.floor(Math.random() * (WIDTH - 80));
    const b = this.add.image(x, HEIGHT + BOARD.h, hasArt ? 'billboard_fall' : BOARD_KEY, 0).setOrigin(0.5, 0).setDepth(3);
    b.tagged = false;
    this.boards.push(b);
  }

  tagBoard(b) {
    b.tagged = true;
    this.tagged++;
    audioCall('sfx', 'glitch');
    const tex = this.textures.get(b.texture.key);
    if (tex.has(1)) b.setFrame(1);
    else if (tex.has('glitch')) b.setFrame('glitch');
    else b.setTint(0x39ff8a);
    this.time.addEvent({ delay: 50, repeat: 5, callback: () => { if (b.active) b.setVisible(!b.visible); } });
    this.time.delayedCall(320, () => { if (b.active) b.setVisible(true); });
  }

  /** Stamp a contrail dot under Lucky into whichever RenderTexture holds that screen point. */
  stampDot() {
    const color = DOT_COLORS[Math.floor(this.frames / 4) % 2];
    const sx = Math.round(this.lucky.x) - 2, sy = Math.round(this.lucky.y) + 6;
    for (const rt of this.trail) {
      const ly = sy - rt.y;
      if (ly >= 0 && ly < HEIGHT) { rt.fill(color, 1, sx, Math.round(ly), 4, 4); rt.render(); }
    }
  }

  update(time, delta) {
    if (this.finished) return;
    const input = services.input;
    const step = Math.min(3, delta / FRAME); // frames elapsed (clamped for hitches)
    this.elapsed += delta;
    this.frames += step;
    const t = this.elapsed;

    // Steering: acceleration 1 px every 3 frames up to 3 px/frame; decays when idle.
    const dir = input.isDown('left') ? -1 : input.isDown('right') ? 1 : 0;
    this.accel += step;
    if (this.accel >= 3) {
      this.accel = 0;
      if (dir) this.vx = Phaser.Math.Clamp(this.vx + dir, -3, 3);
      else if (this.vx > 0) this.vx--; else if (this.vx < 0) this.vx++;
    }
    this.lucky.x = Phaser.Math.Clamp(Math.round(this.lucky.x + this.vx * step), 12, WIDTH - 12);
    if (this.useFallSheet) this.playFall(this.vx < 0 ? 'bank_left' : this.vx > 0 ? 'bank_right' : 'glide');
    if (this.shadeBar) this.shadeBar.setPosition(this.lucky.x, this.lucky.y - 2);
    if (!this.shades && t >= this.shadesAtMs) this.putShades();

    // Sky, bands, trail scroll up.
    const dy = SCROLL * step;
    this.sky.tilePositionY += dy;
    this.bandShift += step;
    if (this.bandShift >= 30) { this.bandShift = 0; this.bands.forEach((b, i) => { b.y = (b.y + 1); if (b.y >= HEIGHT) b.y -= HEIGHT + 28; }); }
    for (const rt of this.trail) {
      rt.y -= dy;
      if (rt.y <= -HEIGHT) { rt.y += HEIGHT * 2; rt.clear(); rt.render(); }
    }
    this.stampDot();

    // Billboards.
    const spacing = this.totalMs / (BOARD.count + 1);
    while (this.nextBoard < BOARD.count && t >= spacing * (this.nextBoard + 1)) { this.spawnBoard(); this.nextBoard++; }
    for (const b of this.boards) {
      b.y -= dy;
      if (!b.tagged && Math.abs(b.x - this.lucky.x) < BOARD.w / 2 + 6 && this.lucky.y + 8 >= b.y && this.lucky.y - 8 <= b.y + BOARD.h) this.tagBoard(b);
      if (b.y < -BOARD.h - 4) { b.destroy(); this.boards.splice(this.boards.indexOf(b), 1); }
    }

    // Skyline rises over the last stretch.
    const left = this.totalMs - t;
    if (left <= this.skylineMs) {
      const p = Phaser.Math.Clamp(1 - left / this.skylineMs, 0, 1);
      this.skyline.y = Math.round(HEIGHT - 64 * p);
    }

    // Skip / end.
    if (t >= this.skipAfterMs) {
      this.hint.setText(this.fast ? '' : 'X: SKIP');
      if (input.justPressed('cancel') || input.justPressed('confirm')) { this.finish(true); return; }
    }
    if (t >= this.totalMs) this.finish(false);
  }

  async finish(skipped) {
    if (this.finished) return;
    this.finished = true;
    this.state.set('vars.billboardsTagged', this.tagged);
    if (this.tagged >= BOARD.count) this.state.set('flags.flyingSquirrel', true);
    this.state.set('flags.freefallSkipped', !!skipped);
    services.input.consume();
    audioCall('stopMusic', { fade: 0.1 });
    await services.ui.flash(this.fast ? 40 : 150);
    audioCall('sfx', 'crash');
    await services.ui.fade('out', this.fast ? 40 : 250);
    const cb = this.onDone;
    this.scene.stop();
    if (cb) cb('done');
    // Hand the screen back lit; a following `teleport` fades again on its own.
    services.ui.fade('in', this.fast ? 40 : 250);
  }
}
