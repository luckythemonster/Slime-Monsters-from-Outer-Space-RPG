// Dialogue box (docs/ARCHITECTURE.md section 12.2 geometry + DESIGN.md "UI & presentation"):
//   window x 8..248, y 160..216; 3 lines of 8 px text on a 12 px line height; 28 chars per line
//   (23 with a 32x32 portrait at the left); name tag mini-window above the top-left corner;
//   typewriter at 30 ms/char (fast 15, slow 60, instant 0) driven by scene.time;
//   markup: \n, {pause:300}, {speed:fast|slow|instant}, {color:pink}...{/color}, {shake}...{/shake},
//   {var:name} (expanded before wrapping, DESIGN E6).
// Styles (`style` in debugState):
//   'window'  the flat zine window; narrator = no tag; the inner rule turns magenta from luckyRageLocked
//   'ff'      Dad's FF blue-gradient window (`window: "ff"` on the speaker, or who === 'dad'):
//             name tag VANGUARD INTERCOM; `collapse: true` squashes it 56 → 0 px in 4 frames with
//             `squelch` once the last page has been read (E10)
//   'caption' Ryan's inverted square box at x 8..136, y 28..52, 2 lines of 14 chars, INSTANT text
//             with one `caption_tick`; `shake: true` jitters the whole box 1 px for its duration (E11)
import Phaser from 'phaser';
import Window from './Window.js';
import { services } from '../engine/services.js';
import { expandVars } from '../engine/TextVars.js';
import { PARAMS, scaleMs } from '../config.js';
import { CHAR_W, LINE_H, COLORS, SPEED_MS, DEPTH, textStyle, resolveColor, sfx, noteRatio, moodColor } from './theme.js';
import { UI_KEY, PORTRAIT_KEY, hasPortrait } from './atlas.js';

export const BOX = { x: 8, y: 160, w: 240, h: 56 };
const PAD = 8;
export const LINES_PER_PAGE = 3;
export const COLS = 28;
export const COLS_PORTRAIT = 23;
const TEXT_X = BOX.x + PAD; // 16
const TEXT_X_PORTRAIT = TEXT_X + 40; // 56: text shifts right 40 px when a portrait is shown
const TEXT_Y = BOX.y + PAD + 2; // first text line; glyph tops land on the 12 px grid
const PORTRAIT = { x: TEXT_X, y: BOX.y + 12, w: 32, h: 32 };
const ARROW = { x: BOX.x + BOX.w - 16, y: BOX.y + BOX.h - 10 };
const TAG = { x: BOX.x, h: 20, pad: PAD };
/** Ryan's caption window (DESIGN.md E11): x 8..136, y 28..52, 2 lines of 14 chars. */
export const CAPTION_BOX = { x: 8, y: 28, w: 128, h: 24, cols: 14, lines: 2, textX: 16, textY: 31, lineH: 10 };
const AUTO_ADVANCE_MS = 60;
const BLINK_MS = 260;
const SHAKE_MS = 50;
const COLLAPSE_HOLD_MS = 350;
const BOX_SHAKE_MS = 33; // whole-box jitter period (every other frame)

// ---------------------------------------------------------------------------------------------
// Markup -> wrapped pages (pure functions, exported for tests)
// ---------------------------------------------------------------------------------------------

/**
 * Parse dialogue markup into a flat item list.
 * Items: { ch, color, shake } for characters, { pause: ms } and { speed: name } for controls.
 */
export function parseMarkup(text) {
  const src = String(text ?? '').replace(/\\n/g, '\n');
  const items = [];
  let color = null;
  let shake = false;
  const re = /\{(\/?)([a-zA-Z]+)(?::([^}]*))?\}/g;
  let last = 0;
  let m;
  const pushText = (s) => {
    for (const ch of s) items.push({ ch, color, shake });
  };
  while ((m = re.exec(src))) {
    pushText(src.slice(last, m.index));
    last = re.lastIndex;
    const close = m[1] === '/';
    const tag = m[2].toLowerCase();
    const arg = m[3];
    if (tag === 'color' || tag === 'colour') color = close ? null : (arg || null);
    else if (tag === 'shake') shake = !close;
    else if (tag === 'pause') items.push({ pause: Math.max(0, parseInt(arg, 10) || 0) });
    else if (tag === 'speed') items.push({ speed: String(arg || 'normal').toLowerCase() });
    else pushText(m[0]); // unknown tag: show it literally
  }
  pushText(src.slice(last));
  return items;
}

/**
 * Word-wrap parsed items to `maxCols` monospace columns. Words are never split unless a single
 * word is longer than a line. Explicit '\n' always breaks. Returns an array of lines (item arrays);
 * control items travel with the word that follows them.
 */
export function wrapItems(items, maxCols) {
  const lines = [[]];
  let col = 0;
  let word = [];
  let wordLen = 0;
  const line = () => lines[lines.length - 1];
  const newLine = () => {
    lines.push([]);
    col = 0;
  };
  const flush = () => {
    if (wordLen > 0 && col > 0 && col + wordLen > maxCols) newLine();
    for (const it of word) {
      if (it.ch === undefined) {
        line().push(it);
      } else {
        if (col >= maxCols) newLine(); // only for words longer than a whole line
        line().push(it);
        col++;
      }
    }
    word = [];
    wordLen = 0;
  };
  for (const it of items) {
    if (it.ch === undefined) {
      word.push(it);
    } else if (it.ch === '\n') {
      flush();
      newLine();
    } else if (it.ch === ' ') {
      flush();
      if (col > 0 && col < maxCols) {
        line().push(it);
        col++;
      }
    } else {
      word.push(it);
      wordLen++;
    }
  }
  flush();
  return lines;
}

/** Split lines into pages of `perPage` lines. Always returns at least one page. */
export function paginate(lines, perPage = LINES_PER_PAGE) {
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (pages.length === 0) pages.push([[]]);
  return pages;
}

/** Full pipeline: markup string -> pages for the given column width. */
export function layoutText(text, maxCols, perPage = LINES_PER_PAGE) {
  return paginate(wrapItems(parseMarkup(text), maxCols), perPage);
}

/** Speaker entry from the registry (characters.json + npcs/*.json) when the caller gave none. */
function speakerDef(who) {
  if (!who) return null;
  const data = services.data;
  if (data && data.speakers && data.speakers[who]) return data.speakers[who];
  const chars = services.state?.data?.characters?.characters;
  return (chars && chars[who]) || null;
}

function resolveName(who, name) {
  if (name) return String(name);
  if (!who || who === 'narrator' || who === 'ryan_caption') return '';
  const def = speakerDef(who);
  if (def && def.name) return String(def.name);
  return String(who).toUpperCase();
}

function resolvePortraitId(who, portrait) {
  if (portrait) return String(portrait);
  if (!who || who === 'narrator' || who === 'ryan_caption') return null;
  const def = speakerDef(who);
  return def?.portrait ? String(def.portrait) : String(who);
}

/** Which window family a say uses. */
export function resolveStyle(who, window) {
  if (window === 'caption' || who === 'ryan_caption') return 'caption';
  if (window === 'ff' || who === 'dad') return 'ff';
  if (window === 'flat' || window === 'window') return 'window';
  const def = speakerDef(who);
  if (def && def.window === 'ff') return 'ff';
  if (def && def.window === 'caption') return 'caption';
  return 'window';
}

// ---------------------------------------------------------------------------------------------

export default class DialogueBox {
  /** @param {import('../scenes/UIScene.js').default} ui */
  constructor(ui) {
    this.ui = ui;
    this.state = 'idle'; // idle | opening | typing | complete | closing | closed
    this.pages = [];
    this.pageIndex = 0;
    this.depth = DEPTH.DIALOGUE;
    this.style = 'window';
    this.textColor = COLORS.text;
    this.win = null;
    this.tagWin = null;
    this.tagText = null;
    this.portrait = null;
    this.arrow = null;
    this.moodRing = [];
    this.runs = [];
    this.steps = [];
    this.stepIndex = 0;
    this.delay = SPEED_MS.normal;
    this.blips = 0;
    this.blipPitch = 1;
    this.collapse = false;
    this.shakeBox = false;
    this.geo = null;
    this._timer = null;
    this._blink = null;
    this._shaker = null;
    this._boxShaker = null;
    this._auto = null;
    this._collapseTimer = null;
    this._resolve = null;
    this._skipping = false;
  }

  /**
   * Show the box; resolves when the last page is dismissed.
   * @param {{text?: string, who?: string, portrait?: string, name?: string, window?: string, blip?: string|number, collapse?: boolean, shake?: boolean}} opts
   */
  show({ text = '', who = null, portrait = null, name = null, window = null, blip = null, collapse = false, shake = false } = {}) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.style = resolveStyle(who, window);
      this.who = who;
      const caption = this.style === 'caption';
      this.textColor = caption ? COLORS.caption : COLORS.text;
      this.name = caption ? '' : resolveName(who, name);
      const pid = caption ? null : resolvePortraitId(who, portrait);
      this.portraitId = hasPortrait(this.ui.textures, pid) ? pid : null;
      this.collapse = !!collapse && !caption;
      this.shakeBox = !!shake && caption;
      const def = speakerDef(who);
      this.blipPitch = noteRatio(blip ?? (def && def.blip) ?? 1);
      this.silent = caption || who === 'narrator' || !who;
      if (caption) {
        this.geo = { ...CAPTION_BOX };
        this.cols = CAPTION_BOX.cols;
        this.textX = CAPTION_BOX.textX;
        this.pages = layoutText(expandVars(text, services.state), this.cols, CAPTION_BOX.lines);
      } else {
        this.geo = { ...BOX, textY: TEXT_Y, lineH: LINE_H };
        this.cols = this.portraitId ? COLS_PORTRAIT : COLS;
        this.textX = this.portraitId ? TEXT_X_PORTRAIT : TEXT_X;
        this.pages = layoutText(expandVars(text, services.state), this.cols, LINES_PER_PAGE);
      }
      this.pageIndex = 0;
      this.state = 'opening';
      this._open();
    });
  }

  async _open() {
    const ui = this.ui;
    const instant = ui.textInstant;
    const g = this.geo;
    if (this.style === 'caption') {
      this.win = new Window(ui, g.x, g.y, g.w, g.h, { depth: this.depth, prefix: 'capwin' });
      await this.win.open(true);
      if (this.state !== 'opening') return;
      sfx('caption_tick');
    } else {
      const prefix = this.style === 'ff' ? 'ffwin' : 'win';
      this.win = new Window(ui, g.x, g.y, g.w, g.h, { depth: this.depth, prefix });
      await this.win.open(instant);
      if (this.state !== 'opening') return; // closed while unfolding
      if (this.style === 'window') this._drawMoodRing();
      if (this.name) {
        const w = this.name.length * CHAR_W + TAG.pad * 2;
        this.tagWin = new Window(ui, TAG.x, g.y - TAG.h, w, TAG.h, { depth: this.depth + 1, prefix });
        await this.tagWin.open(true);
        this.tagText = ui.add.text(TAG.x + TAG.pad, g.y - TAG.h + 6, this.name, textStyle(COLORS.text)).setDepth(this.depth + 2);
      }
      if (this.portraitId) {
        this.portrait = ui.add.image(PORTRAIT.x, PORTRAIT.y, PORTRAIT_KEY, this.portraitId).setOrigin(0, 0).setDepth(this.depth + 2);
      }
    }
    // The caption box has no spare column, so its "more" arrow hangs just under the right corner.
    const ax = this.style === 'caption' ? g.x + g.w - 12 : ARROW.x;
    const ay = this.style === 'caption' ? g.y + g.h + 1 : ARROW.y;
    this.arrow = ui.add.image(ax, ay, UI_KEY, 'arrow_more').setOrigin(0, 0).setDepth(this.depth + 3).setVisible(false);
    if (this.shakeBox) this._startBoxShaker();
    this._typePage(0);
  }

  /** 1 px mood-coloured ring inset 3 px inside the flat frame (only when the mood is not the default pink). */
  _drawMoodRing() {
    const color = moodColor();
    if (!color) return;
    const g = this.geo;
    const c = Phaser.Display.Color.HexStringToColor(color).color;
    const ui = this.ui;
    const d = this.depth + 1;
    this.moodRing = [
      ui.add.rectangle(g.x + 3, g.y + 3, g.w - 6, 1, c, 1).setOrigin(0, 0).setDepth(d),
      ui.add.rectangle(g.x + 3, g.y + g.h - 4, g.w - 6, 1, c, 1).setOrigin(0, 0).setDepth(d),
      ui.add.rectangle(g.x + 3, g.y + 3, 1, g.h - 6, c, 1).setOrigin(0, 0).setDepth(d),
      ui.add.rectangle(g.x + g.w - 4, g.y + 3, 1, g.h - 6, c, 1).setOrigin(0, 0).setDepth(d),
    ];
  }

  // --- typing -------------------------------------------------------------------------------

  _clearPage() {
    for (const r of this.runs) r.obj?.destroy();
    this.runs = [];
    this.steps = [];
    this.stepIndex = 0;
    this._stopTimer();
    this._stopShaker();
    this._hideArrow();
  }

  _typePage(index) {
    this._clearPage();
    this.pageIndex = index;
    const page = this.pages[index] || [[]];
    const ui = this.ui;
    const runs = [];
    const steps = [];
    page.forEach((lineItems, li) => {
      let cur = null;
      let col = 0;
      for (const it of lineItems) {
        if (it.ch === undefined) {
          steps.push(it);
          continue;
        }
        if (!cur || cur.color !== it.color || cur.shake !== it.shake) {
          cur = { col, line: li, color: it.color, shake: !!it.shake, text: '', obj: null };
          runs.push(cur);
        }
        steps.push({ run: cur, ch: it.ch });
        col++;
      }
    });
    for (const r of runs) {
      r.x = this.textX + r.col * CHAR_W;
      r.y = this.geo.textY + r.line * this.geo.lineH;
      r.obj = ui.add.text(r.x, r.y, '', textStyle(resolveColor(r.color, this.textColor))).setDepth(this.depth + 2);
    }
    this.runs = runs;
    this.steps = steps;
    this.stepIndex = 0;
    this.delay = SPEED_MS.normal;
    this.blips = 0;
    this._skipping = this.style === 'caption'; // Ryan's captions never type
    this.state = 'typing';
    if (runs.some((r) => r.shake)) this._startShaker();
    this._pump();
  }

  /** Reveal steps until a delay is needed (or the page is done). */
  _pump() {
    this._timer = null;
    const ui = this.ui;
    const instant = ui.textInstant || this._skipping;
    while (this.state === 'typing') {
      const st = this.steps[this.stepIndex];
      if (!st) {
        this._completePage();
        return;
      }
      this.stepIndex++;
      if (st.speed !== undefined) {
        this.delay = SPEED_MS[st.speed] ?? SPEED_MS.normal;
        continue;
      }
      if (st.pause !== undefined) {
        if (!instant && st.pause > 0) {
          this._timer = ui.time.delayedCall(st.pause, () => this._pump());
          return;
        }
        continue;
      }
      st.run.text += st.ch;
      st.run.obj.setText(st.run.text);
      if (!instant && st.ch !== ' ' && !this.silent) {
        this.blips++;
        if (this.blips % 2 === 0) sfx('text_blip', this.blipPitch !== 1 ? { pitch: this.blipPitch } : undefined);
      }
      const d = instant ? 0 : this.delay;
      if (d > 0) {
        this._timer = ui.time.delayedCall(d, () => this._pump());
        return;
      }
    }
  }

  _completePage() {
    this._stopTimer();
    this.state = 'complete';
    const last = this.pageIndex >= this.pages.length - 1;
    if (!last) this._showArrow();
    if (last && this.collapse) {
      // Dad gets cut off: no confirm needed, the window squashes after a short beat (E10).
      this._collapseTimer = this.ui.time.delayedCall(PARAMS.fast || this.ui.textInstant ? 40 : scaleMs(COLLAPSE_HOLD_MS), () => {
        this._collapseTimer = null;
        if (this.state === 'complete') this._close();
      });
      return;
    }
    if (this.ui.autoAdvance) {
      this._auto = this.ui.time.delayedCall(AUTO_ADVANCE_MS, () => {
        this._auto = null;
        if (this.state === 'complete') this._advance();
      });
    }
  }

  _skipToEnd() {
    if (this.state !== 'typing') return;
    this._stopTimer();
    this._skipping = true;
    this._pump();
  }

  _advance() {
    if (this.state !== 'complete') return;
    if (this.pageIndex < this.pages.length - 1) {
      sfx('confirm');
      this._typePage(this.pageIndex + 1);
    } else {
      this._close();
    }
  }

  /** Logical input from UIScene. Only confirm does anything; cancel is ignored by design. */
  onAction(action) {
    if (action !== 'confirm') return;
    if (this.state === 'typing') this._skipToEnd();
    else if (this.state === 'complete') this._advance();
  }

  // --- decorations ----------------------------------------------------------------------

  _showArrow() {
    if (!this.arrow) return;
    this.arrow.setVisible(true);
    this._blink = this.ui.time.addEvent({
      delay: BLINK_MS,
      loop: true,
      callback: () => this.arrow && this.arrow.setVisible(!this.arrow.visible),
    });
  }

  _hideArrow() {
    if (this._blink) {
      this._blink.remove();
      this._blink = null;
    }
    this.arrow?.setVisible(false);
  }

  _startShaker() {
    this._stopShaker();
    this._shaker = this.ui.time.addEvent({
      delay: SHAKE_MS,
      loop: true,
      callback: () => {
        for (const r of this.runs) {
          if (r.shake && r.obj) r.obj.setPosition(r.x + Phaser.Math.Between(-1, 1), r.y + Phaser.Math.Between(-1, 1));
        }
      },
    });
  }

  _stopShaker() {
    if (this._shaker) {
      this._shaker.remove();
      this._shaker = null;
    }
  }

  /** Whole-box 1 px jitter for Ryan's terrified caption (E11 `shake: true`). */
  _startBoxShaker() {
    this._stopBoxShaker();
    const base = { x: this.geo.x, y: this.geo.y };
    let phase = 0;
    this._boxShaker = this.ui.time.addEvent({
      delay: BOX_SHAKE_MS,
      loop: true,
      callback: () => {
        if (!this.win) return;
        const pattern = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const [dx, dy] = pattern[phase++ % 4];
        this.win.setPosition(base.x + dx, base.y + dy);
        this.win.baseY = base.y + dy;
        for (const r of this.runs) if (r.obj) r.obj.setPosition(r.x + dx, r.y + dy);
        if (this.arrow) this.arrow.setPosition(this.geo.x + this.geo.w - 12 + dx, this.geo.y + this.geo.h + 1 + dy);
      },
    });
  }

  _stopBoxShaker() {
    if (this._boxShaker) {
      this._boxShaker.remove();
      this._boxShaker = null;
    }
  }

  _stopTimer() {
    if (this._timer) {
      this._timer.remove();
      this._timer = null;
    }
    if (this._auto) {
      this._auto.remove();
      this._auto = null;
    }
    if (this._collapseTimer) {
      this._collapseTimer.remove();
      this._collapseTimer = null;
    }
  }

  // --- closing ----------------------------------------------------------------------------

  async _close() {
    if (this.state === 'closing' || this.state === 'closed') return;
    this.state = 'closing';
    this._clearPage();
    this._stopBoxShaker();
    this.arrow?.destroy();
    this.arrow = null;
    this.portrait?.destroy();
    this.portrait = null;
    this.tagText?.destroy();
    this.tagText = null;
    for (const r of this.moodRing) r.destroy();
    this.moodRing = [];
    if (this.collapse) {
      sfx('squelch');
      const tag = this.tagWin;
      this.tagWin = null;
      if (this.win) {
        await Promise.all([this.win.collapse(), tag ? tag.collapse() : Promise.resolve()]);
        this.win.destroy();
        this.win = null;
      }
      tag?.destroy();
      this._finish();
      return;
    }
    if (this.tagWin) {
      this.tagWin.destroy();
      this.tagWin = null;
    }
    if (this.win) {
      await this.win.close(this.ui.textInstant || this.style === 'caption');
      this.win.destroy();
      this.win = null;
    }
    this._finish();
  }

  /** Immediate teardown (closeAll / scene change). Resolves the pending promise. */
  forceClose() {
    if (this.state === 'closed') return;
    this.state = 'closing';
    this._clearPage();
    this._stopBoxShaker();
    this.arrow?.destroy();
    this.portrait?.destroy();
    this.tagText?.destroy();
    this.tagWin?.destroy();
    for (const r of this.moodRing) r.destroy();
    this.win?.destroy();
    this.arrow = this.portrait = this.tagText = this.tagWin = this.win = null;
    this.moodRing = [];
    this._finish();
  }

  _finish() {
    this.state = 'closed';
    const r = this._resolve;
    this._resolve = null;
    if (r) r();
  }

  /** Test/debug snapshot. */
  debugState() {
    return {
      type: 'say',
      state: this.state,
      page: this.pageIndex,
      pages: this.pages.length,
      revealed: this.runs.reduce((n, r) => n + r.text.length, 0),
      total: this.steps.filter((s) => s.ch !== undefined).length,
      cols: this.cols,
      portrait: this.portraitId,
      name: this.name,
      style: this.style,
      who: this.who,
      collapse: this.collapse,
      shake: this.shakeBox,
      drawn: !!(this.win && this.win.drawn),
      box: this.geo ? { x: this.geo.x, y: this.geo.y, w: this.geo.w, h: this.geo.h } : null,
    };
  }
}
