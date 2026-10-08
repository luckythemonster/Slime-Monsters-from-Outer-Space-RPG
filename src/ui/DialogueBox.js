// Dialogue box (docs/ARCHITECTURE.md section 12.2 geometry):
//   window x 8..248, y 160..216; 3 lines of 8 px text on a 12 px line height; 28 chars per line
//   (23 with a 32x32 portrait at the left); name tag mini-window above the top-left corner;
//   typewriter at 30 ms/char (fast 15, slow 60, instant 0) driven by scene.time;
//   markup: \n, {pause:300}, {speed:fast|slow|instant}, {color:pink}...{/color}, {shake}...{/shake}.
// who === 'ryan_caption' renders a rigid white comic caption (black 1 px border, black text, no tag);
// who === 'narrator' is a plain window with no tag; otherwise the name tag shows `name` or the id.
import Phaser from 'phaser';
import Window from './Window.js';
import { services } from '../engine/services.js';
import { CHAR_W, LINE_H, COLORS, SPEED_MS, DEPTH, textStyle, resolveColor, sfx } from './theme.js';
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
const AUTO_ADVANCE_MS = 60;
const BLINK_MS = 260;
const SHAKE_MS = 50;

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
export function layoutText(text, maxCols) {
  return paginate(wrapItems(parseMarkup(text), maxCols));
}

function resolveName(who, name) {
  if (name) return String(name);
  if (!who || who === 'narrator' || who === 'ryan_caption') return '';
  const ch = services.state?.characters?.[who];
  if (ch && ch.name) return String(ch.name);
  return String(who).toUpperCase();
}

function resolvePortraitId(who, portrait) {
  if (portrait) return String(portrait);
  if (!who || who === 'narrator' || who === 'ryan_caption') return null;
  const ch = services.state?.characters?.[who];
  return ch?.portrait ? String(ch.portrait) : String(who);
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
    this.frame = []; // caption style rectangles
    this.runs = [];
    this.steps = [];
    this.stepIndex = 0;
    this.delay = SPEED_MS.normal;
    this.blips = 0;
    this._timer = null;
    this._blink = null;
    this._shaker = null;
    this._auto = null;
    this._resolve = null;
    this._skipping = false;
  }

  /** Show the box; resolves when the last page is dismissed. */
  show({ text = '', who = null, portrait = null, name = null } = {}) {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this.style = who === 'ryan_caption' ? 'caption' : 'window';
      this.textColor = this.style === 'caption' ? COLORS.caption : COLORS.text;
      this.name = this.style === 'caption' ? '' : resolveName(who, name);
      const pid = this.style === 'caption' ? null : resolvePortraitId(who, portrait);
      this.portraitId = hasPortrait(this.ui.textures, pid) ? pid : null;
      this.cols = this.portraitId ? COLS_PORTRAIT : COLS;
      this.textX = this.portraitId ? TEXT_X_PORTRAIT : TEXT_X;
      this.pages = layoutText(text, this.cols);
      this.pageIndex = 0;
      this.state = 'opening';
      this._open();
    });
  }

  async _open() {
    const ui = this.ui;
    const instant = ui.textInstant;
    if (this.style === 'caption') {
      const outer = ui.add.rectangle(BOX.x, BOX.y, BOX.w, BOX.h, 0x101018, 1).setOrigin(0, 0).setDepth(this.depth);
      const inner = ui.add.rectangle(BOX.x + 1, BOX.y + 1, BOX.w - 2, BOX.h - 2, 0xffffff, 1).setOrigin(0, 0).setDepth(this.depth);
      this.frame = [outer, inner];
    } else {
      this.win = new Window(ui, BOX.x, BOX.y, BOX.w, BOX.h, { depth: this.depth });
      await this.win.open(instant);
      if (this.state !== 'opening') return; // closed while unfolding
      if (this.name) {
        const w = this.name.length * CHAR_W + TAG.pad * 2;
        this.tagWin = new Window(ui, TAG.x, BOX.y - TAG.h, w, TAG.h, { depth: this.depth + 1 });
        await this.tagWin.open(true);
        this.tagText = ui.add.text(TAG.x + TAG.pad, BOX.y - TAG.h + 6, this.name, textStyle(COLORS.text)).setDepth(this.depth + 2);
      }
      if (this.portraitId) {
        this.portrait = ui.add.image(PORTRAIT.x, PORTRAIT.y, PORTRAIT_KEY, this.portraitId).setOrigin(0, 0).setDepth(this.depth + 2);
      }
    }
    this.arrow = ui.add.image(ARROW.x, ARROW.y, UI_KEY, 'arrow_more').setOrigin(0, 0).setDepth(this.depth + 3).setVisible(false);
    if (this.style === 'caption') this.arrow.setTint(0x101018).setTintMode(Phaser.TintModes.FILL);
    this._typePage(0);
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
      r.y = TEXT_Y + r.line * LINE_H;
      r.obj = ui.add.text(r.x, r.y, '', textStyle(resolveColor(r.color, this.textColor))).setDepth(this.depth + 2);
    }
    this.runs = runs;
    this.steps = steps;
    this.stepIndex = 0;
    this.delay = SPEED_MS.normal;
    this.blips = 0;
    this._skipping = false;
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
      if (!instant && st.ch !== ' ') {
        this.blips++;
        if (this.blips % 2 === 0) sfx('text_blip');
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
    if (this.pageIndex < this.pages.length - 1) this._showArrow();
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

  _stopTimer() {
    if (this._timer) {
      this._timer.remove();
      this._timer = null;
    }
    if (this._auto) {
      this._auto.remove();
      this._auto = null;
    }
  }

  // --- closing ----------------------------------------------------------------------------

  async _close() {
    if (this.state === 'closing' || this.state === 'closed') return;
    this.state = 'closing';
    this._clearPage();
    this.arrow?.destroy();
    this.arrow = null;
    this.portrait?.destroy();
    this.portrait = null;
    this.tagText?.destroy();
    this.tagText = null;
    if (this.tagWin) {
      this.tagWin.destroy();
      this.tagWin = null;
    }
    for (const r of this.frame) r.destroy();
    this.frame = [];
    if (this.win) {
      await this.win.close(this.ui.textInstant);
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
    this.arrow?.destroy();
    this.portrait?.destroy();
    this.tagText?.destroy();
    this.tagWin?.destroy();
    for (const r of this.frame) r.destroy();
    this.win?.destroy();
    this.arrow = this.portrait = this.tagText = this.tagWin = this.win = null;
    this.frame = [];
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
      state: this.state,
      page: this.pageIndex,
      pages: this.pages.length,
      revealed: this.runs.reduce((n, r) => n + r.text.length, 0),
      total: this.steps.filter((s) => s.ch !== undefined).length,
      cols: this.cols,
      portrait: this.portraitId,
      name: this.name,
      style: this.style,
    };
  }
}
