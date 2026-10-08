# tools/ — art pipeline

All art is ASCII pixel maps turned into PNGs by `python3 tools/gen_assets.py` (Pillow + numpy).
The contract is `docs/ARCHITECTURE.md` section 3; colors come from `tools/palettes.md`.

```
python3 tools/gen_assets.py            # write assets/generated/*.png + manifest.json
python3 tools/gen_assets.py --check    # validate only (exit 1 on any error)
python3 tools/gen_assets.py --preview  # also assets/generated/_preview/*@4x.png + _contact_sheet@4x.png
```

Commit `assets/generated/*.png` and `manifest.json` (the game runs without Python);
`assets/generated/_preview/` is gitignored. Every error names `file:line`, the frame/tile/region
and the row, e.g. `tools/sprites/lucky.txt:57: frame 2 (down step b), row 5: expected 16 chars, got 15`.

## Common syntax

- `# ...` on its own line is a comment. Blank lines are ignored *between* blocks, not inside a pixel block.
- `name: foo` — sheet name (`[a-z][a-z0-9_]*`), unique across all three folders. It is the manifest key
  and the PNG name (`foo.png`; tilesets are `tiles_foo.png`).
- `palette:` followed by one `c = #rrggbb` line per color (`c = transparent` for see-through).
  Keys are single non-space characters; `#` is reserved for comments. Trailing `# notes` are fine.
- Every pixel row must be exactly the declared width; every char must be in the palette.

## Sprite sheet — `tools/sprites/<name>.txt`

```
name: blob
frame: 8x8
palette:
  . = transparent
  k = #141018
  p = #ff5fd2
anim: idle_down  frames: 0      fps: 1
anim: walk_down  frames: 0 1 0  fps: 8
anim: walk_right frames: 0 1 0  fps: 8  flipX: true   # same frames, entity flips the sprite
anim: pop        frames: 1      fps: 4  repeat: 0     # repeat defaults to -1 (loop)
variant: blob_rage  swap: p=#d83030                   # recolored copy -> blob_rage.png

frame 0: stand
..kkkk..
.kppppk.
kppppppk
kppppppk
kppppppk
kppppppk
.kppppk.
..kkkk..

frame 1: squash
........
........
..kkkk..
.kppppk.
kppppppk
kppppppk
kppppppk
.kkkkkk.
```

Frames are numbered `0, 1, 2…` in order and laid out left to right in one row of the PNG.
Manifest entry: `{ "type": "spritesheet", "frameWidth", "frameHeight", "frames",
"anims": [{ "key": "blob_walk_down", "frames": [0,1,0], "fps": 8, "repeat": -1, "flipX": false }] }`.
`key` is the full Phaser animation key (`<sheet>_<anim>`). A `variant:` gets its own manifest entry
with keys `<variant>_<anim>`; `from: other_sheet` lets a variant live in a different file.

Characters need at least `walk_down/up/left` (3 frames: stand, step-a, step-b) and `idle_down/up/left`;
`walk_right`/`idle_right` are the left frames with `flipX: true`. Overworld frames are 16x24 with the
feet on the bottom row (origin 0.5, 1).

## Tileset — `tools/tiles/<name>.txt`

```
name: minneapolis
tile: 16x16
palette: ...
tile snow:          # name used by map legends
solid: false        # optional, default false
(16 rows x 16 chars)
tile brick_wall:
solid: true
...
```

Tiles pack 16 per row into `assets/generated/tiles_<name>.png`; index = declaration order.
Manifest: `{ "type": "tileset", "tileWidth", "tileHeight", "tiles": { "snow": { "index": 0, "solid": false } } }`.
Ground tiles should be fully opaque and edge-free so they repeat seamlessly; props meant for the
`deco`/`over` layers (lamp posts, bags, dumpsters) use `.` around them so the ground shows through.

## UI atlas — `tools/ui/<name>.txt`

```
name: ui
frame: 8x8                # default region size
palette: ...
region win_tl:            # 8x8 from the default
...
region meter_on: 4x8      # explicit size
...
```

Regions are shelf-packed in declaration order into one PNG (max 128 px wide).
Manifest: `{ "type": "atlas", "frames": { "win_tl": { "x": 0, "y": 0, "w": 8, "h": 8 }, … } }`.
