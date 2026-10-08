#!/usr/bin/env python3
"""ASCII pixel maps -> PNG sheets + manifest.json  (docs/ARCHITECTURE.md section 3).

    python3 tools/gen_assets.py            # build assets/generated/*.png + manifest.json
    python3 tools/gen_assets.py --check    # validate only, write nothing
    python3 tools/gen_assets.py --preview  # also write assets/generated/_preview/*@4x.png

Inputs:  tools/sprites/*.txt  tools/tiles/*.txt  tools/ui/*.txt   (format: tools/README.md)
Outputs: assets/generated/<sheet>.png, assets/generated/tiles_<tileset>.png,
         assets/generated/manifest.json
Exit status is non-zero when any input fails validation. Every error names the file,
line, frame/tile/region and row it refers to.
"""
import argparse
import json
import math
import os
import re
import sys
from collections import OrderedDict

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES_PER_ROW = 16          # tileset packing (spec 3.2)
ATLAS_MAX_WIDTH = 128       # ui atlas shelf width
PREVIEW_SCALE = 4
NAME_RE = re.compile(r'^[a-z][a-z0-9_]*$')
KV_RE = re.compile(r'(\w+):\s*(.*?)\s*(?=\s\w+:|$)')
PALETTE_RE = re.compile(r'^\s*(\S)\s*=\s*(\S+)')
DIRECTIVE_RE = re.compile(r'^(\w+)\s*:\s*(.*)$')
FRAME_HDR_RE = re.compile(r'^frame\s+(\d+)\s*:?\s*(.*)$')
TILE_HDR_RE = re.compile(r'^tile\s+(\w+)\s*:\s*(?:#.*)?$')
REGION_HDR_RE = re.compile(r'^region\s+(\w+)\s*:\s*(?:(\d+)\s*x\s*(\d+))?\s*(?:#.*)?$')
COLOR_RE = re.compile(r'^#([0-9a-fA-F]{6})$')
MAX_COLORS = {'spritesheet': 16, 'tileset': 32, 'atlas': 32}


class AssetError(Exception):
    pass


# ----------------------------------------------------------------------------- parsing

def parse_color(text, where):
    """'#rrggbb' -> (r,g,b,255); 'transparent'/'none' -> (0,0,0,0)."""
    if text.lower() in ('transparent', 'none', 'clear'):
        return (0, 0, 0, 0)
    m = COLOR_RE.match(text)
    if not m:
        raise AssetError('%s: bad color %r (want #rrggbb or transparent)' % (where, text))
    v = int(m.group(1), 16)
    return ((v >> 16) & 255, (v >> 8) & 255, v & 255, 255)


def parse_size(text, where):
    m = re.match(r'^\s*(\d+)\s*x\s*(\d+)\s*$', text)
    if not m:
        raise AssetError('%s: bad size %r (want WxH, e.g. 16x24)' % (where, text))
    w, h = int(m.group(1)), int(m.group(2))
    if w <= 0 or h <= 0:
        raise AssetError('%s: size must be positive, got %dx%d' % (where, w, h))
    return w, h


def parse_bool(text, where):
    t = text.strip().lower()
    if t in ('true', 'yes', '1'):
        return True
    if t in ('false', 'no', '0'):
        return False
    raise AssetError('%s: expected true/false, got %r' % (where, text))


def kv_pairs(line):
    return [(m.group(1), m.group(2)) for m in KV_RE.finditer(line)]


class Sheet:
    """One parsed input file.  kind: spritesheet | tileset | atlas."""

    def __init__(self, path, kind, root=ROOT):
        self.path = path
        self.rel = os.path.relpath(path, root)
        self.kind = kind
        self.name = None
        self.frame_size = None          # (w,h) default cell size
        self.palette = OrderedDict()    # char -> rgba
        self.cells = []                 # [{name,label,size,rows,solid,line}]
        self.anims = []                 # spritesheet only
        self.variants = []              # [{name, from, swap{char:rgba}, line}]
        self.errors = []
        self.warnings = []

    def err(self, line_no, msg):
        self.errors.append('%s:%d: %s' % (self.rel, line_no, msg))

    # -- top level ---------------------------------------------------------------------
    def parse(self):
        with open(self.path, encoding='utf-8') as fh:
            lines = fh.read().split('\n')
        state = 'header'
        cur = None                      # cell being filled
        rows_needed = 0
        for idx, raw in enumerate(lines):
            ln = idx + 1
            line = raw.rstrip('\r')
            stripped = line.strip()
            if cur is not None and len(cur['rows']) < rows_needed and cur.get('started'):
                # inside a pixel block: every line is a row until the block is complete
                if stripped == '' or stripped.startswith('#'):
                    self.err(ln, '%s: expected %d rows, got %d (blank/comment line inside the pixel block)'
                             % (self.cell_desc(cur), rows_needed, len(cur['rows'])))
                    cur = None
                    continue
                self.add_row(cur, stripped, ln)
                if len(cur['rows']) == rows_needed:
                    cur = None
                continue
            if stripped == '' or stripped.startswith('#'):
                continue
            # a cell header was seen but no rows yet: allow `solid:` style properties
            if cur is not None and not cur.get('started'):
                dm = DIRECTIVE_RE.match(stripped)
                if dm and dm.group(1) in ('solid',):
                    try:
                        cur['solid'] = parse_bool(dm.group(2).split('#')[0], '%s:%d' % (self.rel, ln))
                    except AssetError as e:
                        self.err(ln, str(e).split(': ', 1)[-1])
                    continue
                if not (FRAME_HDR_RE.match(stripped) or TILE_HDR_RE.match(stripped) or REGION_HDR_RE.match(stripped)):
                    cur['started'] = True
                    self.add_row(cur, stripped, ln)
                    if len(cur['rows']) == rows_needed:
                        cur = None
                    continue
                self.err(cur['line'], '%s: has no pixel rows' % self.cell_desc(cur))
                cur = None
            # ---- headers / directives
            if state == 'palette':
                pm = PALETTE_RE.match(line)
                if pm and not DIRECTIVE_RE.match(stripped):
                    self.add_palette(pm.group(1), pm.group(2), ln)
                    continue
                state = 'header'
            cell = self.try_cell_header(stripped, ln)
            if cell is not None:
                if cell['size'] is None:
                    self.err(ln, '%s: no size given and no `frame:` default declared' % self.cell_desc(cell))
                    continue
                self.cells.append(cell)
                cur = cell
                rows_needed = cell['size'][1]
                continue
            dm = DIRECTIVE_RE.match(stripped)
            if not dm:
                self.err(ln, 'unrecognised line %r' % stripped)
                continue
            key, val = dm.group(1), dm.group(2)
            if key == 'palette':
                state = 'palette'
            elif key == 'name':
                self.name = val.split('#')[0].strip()
                if not NAME_RE.match(self.name):
                    self.err(ln, 'bad sheet name %r (want [a-z][a-z0-9_]*)' % self.name)
            elif key in ('frame', 'tile'):
                try:
                    self.frame_size = parse_size(val.split('#')[0], '%s:%d' % (self.rel, ln))
                except AssetError as e:
                    self.err(ln, str(e).split(': ', 1)[-1])
            elif key == 'anim':
                self.add_anim(stripped, ln)
            elif key == 'variant':
                self.add_variant(stripped, ln)
            else:
                self.err(ln, 'unknown directive %r' % key)
        if cur is not None and len(cur['rows']) < rows_needed:
            self.err(cur['line'], '%s: expected %d rows, got %d (end of file)'
                     % (self.cell_desc(cur), rows_needed, len(cur['rows'])))
        self.finish()
        return self

    def cell_desc(self, cell):
        if self.kind == 'spritesheet':
            lab = (' (%s)' % cell['label']) if cell.get('label') else ''
            return 'frame %s%s' % (cell['name'], lab)
        if self.kind == 'tileset':
            return 'tile %s' % cell['name']
        return 'region %s' % cell['name']

    def try_cell_header(self, s, ln):
        if self.kind == 'spritesheet':
            m = FRAME_HDR_RE.match(s)
            if not m:
                return None
            return {'name': int(m.group(1)), 'label': m.group(2).strip(), 'size': self.frame_size,
                    'rows': [], 'solid': False, 'line': ln}
        if self.kind == 'tileset':
            m = TILE_HDR_RE.match(s)
            if not m:
                return None
            return {'name': m.group(1), 'label': '', 'size': self.frame_size, 'rows': [],
                    'solid': False, 'line': ln}
        m = REGION_HDR_RE.match(s)
        if not m:
            return None
        size = (int(m.group(2)), int(m.group(3))) if m.group(2) else self.frame_size
        return {'name': m.group(1), 'label': '', 'size': size, 'rows': [], 'solid': False, 'line': ln}

    def add_palette(self, ch, val, ln):
        if ch in ('#',):
            self.err(ln, "palette char '#' is reserved for comments")
            return
        if ch in self.palette:
            self.err(ln, 'duplicate palette char %r' % ch)
            return
        try:
            self.palette[ch] = parse_color(val, '%s:%d' % (self.rel, ln))
        except AssetError as e:
            self.err(ln, str(e).split(': ', 1)[-1])

    def add_row(self, cell, row, ln):
        w = cell['size'][0]
        r = len(cell['rows']) + 1
        if len(row) != w:
            self.err(ln, '%s, row %d: expected %d chars, got %d' % (self.cell_desc(cell), r, w, len(row)))
        for c, ch in enumerate(row):
            if ch not in self.palette:
                self.err(ln, '%s, row %d, col %d: char %r not in palette' % (self.cell_desc(cell), r, c + 1, ch))
                break
        cell['rows'].append(row)

    def add_anim(self, s, ln):
        s = re.sub(r'\s+#.*$', '', s)
        kv = OrderedDict(kv_pairs(s))
        key = kv.get('anim', '').strip()
        if not NAME_RE.match(key):
            self.err(ln, 'bad anim key %r' % key)
            return
        if 'frames' not in kv:
            self.err(ln, 'anim %s: missing `frames:`' % key)
            return
        try:
            frames = [int(t) for t in kv['frames'].replace(',', ' ').split()]
        except ValueError:
            self.err(ln, 'anim %s: frames must be integers, got %r' % (key, kv['frames']))
            return
        if not frames:
            self.err(ln, 'anim %s: empty frame list' % key)
            return
        try:
            fps = float(kv.get('fps', '8'))
            repeat = int(kv.get('repeat', '-1'))
            flip = parse_bool(kv.get('flipX', 'false'), '%s:%d anim %s flipX' % (self.rel, ln, key))
        except (ValueError, AssetError) as e:
            self.err(ln, 'anim %s: %s' % (key, e))
            return
        if fps <= 0:
            self.err(ln, 'anim %s: fps must be > 0' % key)
            return
        fps = int(fps) if fps == int(fps) else fps
        for k in kv:
            if k not in ('anim', 'frames', 'fps', 'repeat', 'flipX'):
                self.err(ln, 'anim %s: unknown option %r' % (key, k))
        if any(a['key'] == key for a in self.anims):
            self.err(ln, 'duplicate anim key %r' % key)
            return
        self.anims.append({'key': key, 'frames': frames, 'fps': fps, 'repeat': repeat, 'flipX': flip, 'line': ln})

    def add_variant(self, s, ln):
        kv = OrderedDict(kv_pairs(s))
        vname = kv.get('variant', '').strip()
        if not NAME_RE.match(vname):
            self.err(ln, 'bad variant name %r' % vname)
            return
        src = kv.get('from', '').strip() or None
        swap_text = kv.get('swap', '').strip()
        if not swap_text:
            self.err(ln, 'variant %s: missing `swap:` (e.g. swap: p=#ff3030,P=#ff8080)' % vname)
            return
        swap = OrderedDict()
        for item in [t.strip() for t in swap_text.split(',') if t.strip()]:
            if '=' not in item:
                self.err(ln, 'variant %s: bad swap item %r (want char=#rrggbb)' % (vname, item))
                continue
            ch, col = item.split('=', 1)
            ch = ch.strip()
            if len(ch) != 1:
                self.err(ln, 'variant %s: swap char must be one character, got %r' % (vname, ch))
                continue
            try:
                swap[ch] = parse_color(col.strip(), '%s:%d variant %s' % (self.rel, ln, vname))
            except AssetError as e:
                self.err(ln, str(e).split(': ', 1)[-1])
        for k in kv:
            if k not in ('variant', 'from', 'swap'):
                self.err(ln, 'variant %s: unknown option %r' % (vname, k))
        self.variants.append({'name': vname, 'from': src, 'swap': swap, 'line': ln})

    def finish(self):
        if self.name is None:
            self.err(1, 'missing `name:`')
        if self.kind in ('spritesheet', 'tileset') and self.frame_size is None:
            self.err(1, 'missing `%s:` size (e.g. %s)' % ('frame' if self.kind == 'spritesheet' else 'tile',
                                                        '16x24' if self.kind == 'spritesheet' else '16x16'))
        if '.' not in self.palette and self.kind != 'tileset':
            self.warnings.append('%s: palette has no `.` (transparent) entry' % self.rel)
        # duplicates / ordering
        seen = {}
        for c in self.cells:
            if c['name'] in seen:
                self.err(c['line'], '%s: duplicate (first declared at line %d)' % (self.cell_desc(c), seen[c['name']]))
            seen[c['name']] = c['line']
        if self.kind == 'spritesheet':
            for i, c in enumerate(self.cells):
                if c['name'] != i:
                    self.err(c['line'], 'frame %d: frames must be numbered 0,1,2... in order (expected frame %d here)'
                             % (c['name'], i))
            nframes = len(self.cells)
            for a in self.anims:
                bad = [f for f in a['frames'] if f < 0 or f >= nframes]
                if bad:
                    self.err(a['line'], 'anim %s: frame %d out of range (sheet has %d frames)'
                             % (a['key'], bad[0], nframes))
            if nframes == 0:
                self.err(1, 'sheet has no frames')
        elif self.kind == 'tileset':
            if not self.cells:
                self.err(1, 'tileset has no tiles')
            if self.anims or self.variants:
                self.err(1, 'tilesets do not support anim:/variant:')
        else:
            if not self.cells:
                self.err(1, 'atlas has no regions')
        for v in self.variants:
            if v['from'] is None:
                v['from'] = self.name
        colors = set(self.palette[ch] for c in self.cells for row in c['rows'] for ch in row if ch in self.palette)
        colors.discard((0, 0, 0, 0))
        if len(colors) > MAX_COLORS[self.kind]:
            self.warnings.append('%s: uses %d opaque colors (convention: <= %d per %s)'
                                 % (self.rel, len(colors), MAX_COLORS[self.kind], self.kind))


# ----------------------------------------------------------------------------- rendering

def render_cell(rows, palette, size):
    w, h = size
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    for y, row in enumerate(rows[:h]):
        for x, ch in enumerate(row[:w]):
            arr[y, x] = palette.get(ch, (0, 0, 0, 0))
    return arr


def render_spritesheet(sheet, palette=None):
    palette = palette or sheet.palette
    fw, fh = sheet.frame_size
    n = len(sheet.cells)
    img = np.zeros((fh, fw * n, 4), dtype=np.uint8)
    for i, c in enumerate(sheet.cells):
        img[:, i * fw:(i + 1) * fw] = render_cell(c['rows'], palette, (fw, fh))
    return img


def render_tileset(sheet):
    tw, th = sheet.frame_size
    n = len(sheet.cells)
    cols = min(n, TILES_PER_ROW)
    rows = int(math.ceil(n / float(TILES_PER_ROW)))
    img = np.zeros((rows * th, cols * tw, 4), dtype=np.uint8)
    for i, c in enumerate(sheet.cells):
        x, y = (i % TILES_PER_ROW) * tw, (i // TILES_PER_ROW) * th
        img[y:y + th, x:x + tw] = render_cell(c['rows'], sheet.palette, (tw, th))
    return img


def pack_atlas(sheet):
    """Shelf packing in declaration order. Returns (image, frames{name:{x,y,w,h}})."""
    frames = OrderedDict()
    x = y = shelf_h = 0
    placed = []
    for c in sheet.cells:
        w, h = c['size']
        if x + w > ATLAS_MAX_WIDTH and x > 0:
            x, y, shelf_h = 0, y + shelf_h, 0
        placed.append((c, x, y))
        frames[c['name']] = {'x': x, 'y': y, 'w': w, 'h': h}
        x += w
        shelf_h = max(shelf_h, h)
    width = max(f['x'] + f['w'] for f in frames.values())
    height = max(f['y'] + f['h'] for f in frames.values())
    img = np.zeros((height, width, 4), dtype=np.uint8)
    for c, px, py in placed:
        w, h = c['size']
        img[py:py + h, px:px + w] = render_cell(c['rows'], sheet.palette, (w, h))
    return img, frames


def to_image(arr):
    return Image.fromarray(arr, 'RGBA')


# ----------------------------------------------------------------------------- preview

def checker(w, h, a=(70, 70, 78), b=(90, 90, 100), cell=8):
    img = Image.new('RGBA', (w, h), a + (255,))
    d = ImageDraw.Draw(img)
    for yy in range(0, h, cell):
        for xx in range(0, w, cell):
            if ((xx // cell) + (yy // cell)) % 2:
                d.rectangle([xx, yy, xx + cell - 1, yy + cell - 1], fill=b + (255,))
    return img


def font(size=12):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def upscale(arr, s=PREVIEW_SCALE):
    return to_image(np.repeat(np.repeat(arr, s, axis=0), s, axis=1))


def preview_sheet(name, kind, arr, cells=None, cell_size=None, atlas_frames=None):
    """Sheet at 4x on a checker, cells separated by a gap and labelled."""
    s = PREVIEW_SCALE
    gap = 4
    if kind == 'spritesheet':
        fw, fh = cell_size
        n = len(cells)
        W = n * (fw * s + gap) + gap
        H = fh * s + gap * 2 + 14
        out = checker(W, H)
        d = ImageDraw.Draw(out)
        for i in range(n):
            x = gap + i * (fw * s + gap)
            out.alpha_composite(upscale(arr[:, i * fw:(i + 1) * fw]), (x, gap + 14))
            d.text((x, 1), str(i), fill=(255, 255, 255, 255), font=font(11))
    elif kind == 'tileset':
        tw, th = cell_size
        n = len(cells)
        cols = min(n, TILES_PER_ROW)
        rows = int(math.ceil(n / float(TILES_PER_ROW)))
        W = cols * (tw * s + gap) + gap
        H = rows * (th * s + gap + 12) + gap
        out = checker(W, H)
        d = ImageDraw.Draw(out)
        for i, c in enumerate(cells):
            cx, cy = i % TILES_PER_ROW, i // TILES_PER_ROW
            x = gap + cx * (tw * s + gap)
            y = gap + cy * (th * s + gap + 12) + 12
            out.alpha_composite(upscale(arr[cy * th:(cy + 1) * th, cx * tw:(cx + 1) * tw]), (x, y))
            d.text((x, y - 12), str(i), fill=(255, 255, 255, 255), font=font(10))
    else:
        out = checker(arr.shape[1] * s + gap * 2, arr.shape[0] * s + gap * 2)
        out.alpha_composite(upscale(arr), (gap, gap))
        d = ImageDraw.Draw(out)
        for fname, f in (atlas_frames or {}).items():
            d.rectangle([gap + f['x'] * s - 1, gap + f['y'] * s - 1,
                         gap + (f['x'] + f['w']) * s, gap + (f['y'] + f['h']) * s], outline=(255, 80, 80, 160))
    return out


def preview_tiled(sheet, arr):
    """Every tile repeated 3x3 so seams show.  4 px gap, names underneath."""
    tw, th = sheet.frame_size
    s = PREVIEW_SCALE
    per_row = 8
    n = len(sheet.cells)
    cw, ch = tw * 3 * s, th * 3 * s
    gap = 6
    cols = min(n, per_row)
    rows = int(math.ceil(n / float(per_row)))
    out = checker(cols * (cw + gap) + gap, rows * (ch + gap + 14) + gap)
    d = ImageDraw.Draw(out)
    for i, c in enumerate(sheet.cells):
        tile = arr[(i // TILES_PER_ROW) * th:(i // TILES_PER_ROW + 1) * th,
                   (i % TILES_PER_ROW) * tw:(i % TILES_PER_ROW + 1) * tw]
        big = upscale(np.tile(tile, (3, 3, 1)))
        x = gap + (i % per_row) * (cw + gap)
        y = gap + (i // per_row) * (ch + gap + 14)
        out.alpha_composite(big, (x, y))
        d.text((x, y + ch + 1), c['name'] + (' [solid]' if c['solid'] else ''), fill=(255, 255, 255, 255), font=font(10))
    return out


def contact_sheet(items):
    """items: [(title, PIL image)] stacked vertically."""
    pad = 8
    W = max(im.width for _, im in items) + pad * 2
    H = sum(im.height + 18 + pad for _, im in items) + pad
    out = Image.new('RGBA', (W, H), (24, 20, 28, 255))
    d = ImageDraw.Draw(out)
    y = pad
    for title, im in items:
        d.text((pad, y), title, fill=(255, 255, 255, 255), font=font(13))
        y += 18
        out.alpha_composite(im, (pad, y))
        y += im.height + pad
    return out


# ----------------------------------------------------------------------------- main

def collect_inputs(root):
    files = []
    for sub, kind in (('sprites', 'spritesheet'), ('tiles', 'tileset'), ('ui', 'atlas')):
        d = os.path.join(root, 'tools', sub)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if fn.endswith('.txt') and not fn.startswith('_'):
                files.append((os.path.join(d, fn), kind))
    return files


def build(root, check_only=False, preview=False, quiet=False):
    sheets = [Sheet(p, k, root).parse() for p, k in collect_inputs(root)]
    errors = [e for s in sheets for e in s.errors]
    warnings = [w for s in sheets for w in s.warnings]
    # cross-file checks: unique names, variants resolve
    by_name = {}
    for s in sheets:
        if s.name is None:
            continue
        if s.name in by_name:
            errors.append('%s:1: sheet name %r already used by %s' % (s.rel, s.name, by_name[s.name].rel))
        else:
            by_name[s.name] = s
    variants = []
    for s in sheets:
        for v in s.variants:
            src = by_name.get(v['from'])
            if src is None or src.kind != 'spritesheet':
                errors.append('%s:%d: variant %s: `from: %s` is not a known sprite sheet'
                              % (s.rel, v['line'], v['name'], v['from']))
                continue
            if v['name'] in by_name or any(x['name'] == v['name'] for x, _ in variants):
                errors.append('%s:%d: variant name %r already used' % (s.rel, v['line'], v['name']))
                continue
            for ch in v['swap']:
                if ch not in src.palette:
                    errors.append('%s:%d: variant %s: swap char %r is not in %s\'s palette'
                                  % (s.rel, v['line'], v['name'], ch, src.name))
            variants.append((v, src))
    if not quiet:
        for w in warnings:
            print('warning: ' + w)
    if errors:
        for e in errors:
            print('error: ' + e, file=sys.stderr)
        print('%d error(s) in %d file(s)' % (len(errors), len(sheets)), file=sys.stderr)
        return 1
    if check_only:
        if not quiet:
            print('ok: %d sheet(s), %d variant(s), %d warning(s)' % (len(sheets), len(variants), len(warnings)))
        return 0

    out_dir = os.path.join(root, 'assets', 'generated')
    os.makedirs(out_dir, exist_ok=True)
    manifest = {}
    previews = []                      # (title, image) for the contact sheet
    written = set()

    def save(fname, arr):
        to_image(arr).save(os.path.join(out_dir, fname), optimize=True)
        written.add(fname)

    for s in sheets:
        if s.kind == 'spritesheet':
            arr = render_spritesheet(s)
            save(s.name + '.png', arr)
            manifest[s.name] = spritesheet_entry(s, s.name)
            previews.append((s.name, 'spritesheet', arr, s))
        elif s.kind == 'tileset':
            arr = render_tileset(s)
            save('tiles_%s.png' % s.name, arr)
            tiles = OrderedDict()
            for i, c in enumerate(s.cells):
                tiles[c['name']] = {'index': i, 'solid': bool(c['solid'])}
            manifest[s.name] = OrderedDict([('type', 'tileset'), ('tileWidth', s.frame_size[0]),
                                            ('tileHeight', s.frame_size[1]), ('tiles', tiles)])
            previews.append((s.name, 'tileset', arr, s))
        else:
            arr, frames = pack_atlas(s)
            save(s.name + '.png', arr)
            manifest[s.name] = OrderedDict([('type', 'atlas'), ('frames', frames)])
            previews.append((s.name, 'atlas', arr, s, frames))
    for v, src in variants:
        pal = OrderedDict(src.palette)
        pal.update(v['swap'])
        arr = render_spritesheet(src, pal)
        save(v['name'] + '.png', arr)
        manifest[v['name']] = spritesheet_entry(src, v['name'])
        previews.append((v['name'], 'spritesheet', arr, src))

    ordered = OrderedDict((k, manifest[k]) for k in sorted(manifest))
    with open(os.path.join(out_dir, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(ordered, fh, indent=2)
        fh.write('\n')
    written.add('manifest.json')
    stale = [f for f in os.listdir(out_dir) if f.endswith('.png') and f not in written]
    for f in stale:
        warnings.append('stale file in assets/generated not produced by any source: %s' % f)
        if not quiet:
            print('warning: ' + warnings[-1])

    if preview:
        pdir = os.path.join(out_dir, '_preview')
        os.makedirs(pdir, exist_ok=True)
        contact = []
        for item in previews:
            name, kind, arr, sheet = item[:4]
            frames = item[4] if len(item) > 4 else None
            im = preview_sheet(name, kind, arr, sheet.cells, sheet.frame_size, frames)
            fname = ('tiles_%s' % name if kind == 'tileset' else name) + '@%dx.png' % PREVIEW_SCALE
            im.save(os.path.join(pdir, fname))
            contact.append(('%s  (%s)' % (name, kind), im))
            if kind == 'tileset':
                tiled = preview_tiled(sheet, arr)
                tiled.save(os.path.join(pdir, 'tiles_%s_tiled@%dx.png' % (name, PREVIEW_SCALE)))
        contact_sheet(contact).save(os.path.join(pdir, '_contact_sheet@%dx.png' % PREVIEW_SCALE))
    if not quiet:
        print('wrote %d file(s) to %s (%d sheet(s), %d variant(s))'
              % (len(written), os.path.relpath(out_dir, root), len(sheets), len(variants)))
    return 0


def spritesheet_entry(sheet, key_prefix):
    anims = []
    for a in sheet.anims:
        anims.append(OrderedDict([('key', '%s_%s' % (key_prefix, a['key'])), ('frames', list(a['frames'])),
                                  ('fps', a['fps']), ('repeat', a['repeat']), ('flipX', a['flipX'])]))
    return OrderedDict([('type', 'spritesheet'), ('frameWidth', sheet.frame_size[0]),
                        ('frameHeight', sheet.frame_size[1]), ('frames', len(sheet.cells)), ('anims', anims)])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='validate only; write nothing')
    ap.add_argument('--preview', action='store_true', help='also write assets/generated/_preview/*@4x.png')
    ap.add_argument('--root', default=ROOT, help='repository root (default: parent of tools/)')
    ap.add_argument('-q', '--quiet', action='store_true')
    args = ap.parse_args(argv)
    try:
        return build(os.path.abspath(args.root), check_only=args.check, preview=args.preview, quiet=args.quiet)
    except AssetError as e:
        print('error: %s' % e, file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
