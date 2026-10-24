// Battle damage digits (design_feel.md "Damage digits"): 8 px font; rise 10 px over 10 frames, fall
// 4 px over 4, hold 20 frames, vanish. Crits yellow (+ the target shakes 2 px, done by the scene),
// heals green, MISS slides 6 px right. Everything on whole pixels; durations scale under ?fast=1.
import { COLORS, textStyle, DEPTH as UI_DEPTH } from './theme.js';
import { scaleMs } from '../config.js';

const FRAME = 1000 / 60;

/**
 * @param {Phaser.Scene} scene
 * @param {number} x centre x (whole pixels)
 * @param {number} y top y of the digits when they start
 * @param {{amount?: number, crit?: boolean, miss?: boolean, heal?: boolean, text?: string, depth?: number}} o
 * @returns {Promise<void>} resolves when the digits vanish
 */
export function spawnDamage(scene, x, y, { amount = 0, crit = false, miss = false, heal = false, text = null, depth = UI_DEPTH.WINDOW - 10 } = {}) {
  let str = text;
  let color = COLORS.white;
  if (str === null) {
    if (miss) { str = 'MISS'; color = COLORS.gray; }
    else if (heal) { str = String(amount); color = COLORS.green; }
    else { str = String(amount); color = crit ? COLORS.yellow : COLORS.white; }
  }
  const t = scene.add.text(Math.round(x), Math.round(y), str, textStyle(color)).setOrigin(0.5, 1).setDepth(depth);
  t.setShadow(1, 1, '#141018', 0, false, true);
  return new Promise((resolve) => {
    const done = () => { if (t.active) t.destroy(); resolve(); };
    if (miss) {
      scene.tweens.add({ targets: t, x: t.x + 6, duration: scaleMs(6 * FRAME), ease: 'Linear', onUpdate: () => { t.x = Math.round(t.x); } });
      scene.time.delayedCall(scaleMs(30 * FRAME), done);
      return;
    }
    scene.tweens.chain({
      targets: t,
      tweens: [
        { y: t.y - 10, duration: scaleMs(10 * FRAME), ease: 'Quad.easeOut', onUpdate: () => { t.y = Math.round(t.y); } },
        { y: t.y - 6, duration: scaleMs(4 * FRAME), ease: 'Linear', onUpdate: () => { t.y = Math.round(t.y); } },
        { alpha: 1, duration: scaleMs(20 * FRAME) },
      ],
      onComplete: done,
    });
  });
}
