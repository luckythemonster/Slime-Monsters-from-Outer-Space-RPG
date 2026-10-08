#!/usr/bin/env python3
"""Build a condensed Phaser API digest (docs/PHASER_API_DIGEST.md) from node_modules/phaser/types/phaser.d.ts.

Keeps class/namespace names plus method & property signatures for the namespaces this
project uses, dropping the JSDoc bodies, so an agent can grep one ~5k-line file instead of
the 130k-line .d.ts. Run from repo root: python3 tools/phaser_api_digest.py
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "node_modules" / "phaser" / "types" / "phaser.d.ts"
OUT = ROOT / "docs" / "PHASER_API_DIGEST.md"

KEEP = [
    "Phaser.Scene", "Phaser.Scenes.ScenePlugin", "Phaser.Scenes.SceneManager",
    "Phaser.Game", "Phaser.Types.Core.GameConfig", "Phaser.Scale",
    "Phaser.GameObjects.GameObjectFactory", "Phaser.GameObjects.GameObjectCreator",
    "Phaser.GameObjects.Sprite", "Phaser.GameObjects.Image", "Phaser.GameObjects.Text",
    "Phaser.GameObjects.BitmapText", "Phaser.GameObjects.Graphics", "Phaser.GameObjects.Container",
    "Phaser.GameObjects.Rectangle", "Phaser.GameObjects.RenderTexture", "Phaser.GameObjects.TileSprite",
    "Phaser.GameObjects.Group", "Phaser.GameObjects.Layer", "Phaser.GameObjects.Shader",
    "Phaser.GameObjects.Components.Transform", "Phaser.GameObjects.Components.Alpha",
    "Phaser.GameObjects.Components.Tint", "Phaser.GameObjects.Components.Visible",
    "Phaser.GameObjects.Components.Depth", "Phaser.GameObjects.Components.Origin",
    "Phaser.GameObjects.Components.Flip", "Phaser.GameObjects.Components.ScrollFactor",
    "Phaser.GameObjects.Components.Crop", "Phaser.GameObjects.Components.Mask",
    "Phaser.Animations.AnimationManager", "Phaser.Animations.AnimationState",
    "Phaser.Types.Animations.Animation", "Phaser.Types.Animations.GenerateFrameNumbers",
    "Phaser.Tilemaps.Tilemap", "Phaser.Tilemaps.TilemapLayer", "Phaser.Tilemaps.Tileset", "Phaser.Tilemaps.Tile",
    "Phaser.Tilemaps.Parsers", "Phaser.Types.Tilemaps.TilemapConfig",
    "Phaser.Physics.Arcade.ArcadePhysics", "Phaser.Physics.Arcade.World", "Phaser.Physics.Arcade.Body",
    "Phaser.Physics.Arcade.Sprite", "Phaser.Physics.Arcade.Factory", "Phaser.Physics.Arcade.Components",
    "Phaser.Input.InputPlugin", "Phaser.Input.Keyboard.KeyboardPlugin", "Phaser.Input.Keyboard.Key",
    "Phaser.Input.Keyboard.KeyCodes", "Phaser.Input.Gamepad",
    "Phaser.Tweens.TweenManager", "Phaser.Tweens.Tween", "Phaser.Types.Tweens.TweenBuilderConfig",
    "Phaser.Tweens.TweenChain", "Phaser.Time.Clock", "Phaser.Time.TimerEvent", "Phaser.Time.Timeline",
    "Phaser.Cameras.Scene2D.Camera", "Phaser.Cameras.Scene2D.CameraManager", "Phaser.Cameras.Scene2D.Effects",
    "Phaser.Sound.BaseSoundManager", "Phaser.Sound.WebAudioSoundManager", "Phaser.Sound.WebAudioSound",
    "Phaser.Sound.BaseSound", "Phaser.Loader.LoaderPlugin", "Phaser.Textures.TextureManager",
    "Phaser.Textures.Texture", "Phaser.Textures.CanvasTexture", "Phaser.Textures.Frame",
    "Phaser.Display.Color", "Phaser.Math", "Phaser.Utils.Array", "Phaser.Utils.String",
    "Phaser.Events.EventEmitter", "Phaser.Data.DataManager", "Phaser.Plugins", "Phaser.Renderer.WebGL.Pipelines",
    "Phaser.FX", "Phaser.GameObjects.Components.FX", "Phaser.Types.GameObjects.Text.TextStyle",
    "Phaser.Types.GameObjects.BitmapText", "Phaser.GameObjects.Zone", "Phaser.GameObjects.Particles",
    "Phaser.Curves", "Phaser.Geom.Rectangle", "Phaser.Geom.Point", "Phaser.Structs.List", "Phaser.Structs.Map",
]

def main():
    text = SRC.read_text(encoding="utf-8")
    # strip block comments
    text = re.sub(r"/\*\*.*?\*/", "", text, flags=re.S)
    lines = text.splitlines()
    import json
    ver = json.loads((ROOT/"node_modules"/"phaser"/"package.json").read_text())["version"]
    out = [f"# Phaser {ver} API digest", "",
           "Generated from node_modules/phaser/types/phaser.d.ts by tools/phaser_api_digest.py. Signatures only;",
           "see node_modules/phaser/types/phaser.d.ts for full JSDoc. Only namespaces this project uses are included.", ""]
    stack = []  # (name, kind)
    depth = 0
    keep_depth = None
    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        m = re.match(r"(?:export\s+)?(?:declare\s+)?(namespace|module|class|interface|enum|type|function|const|var|let)\s+([A-Za-z0-9_$.]+)", s)
        if m and s.endswith("{"):
            kind, name = m.group(1), m.group(2)
            parent = ".".join(n for n, _ in stack)
            full = f"{parent}.{name}" if parent else name
            stack.append((name, kind))
            fullname = full
            wanted = any(fullname == k or fullname.startswith(k + ".") or k.startswith(fullname + ".") for k in KEEP)
            exact = any(fullname == k or fullname.startswith(k + ".") for k in KEEP)
            if exact and keep_depth is None:
                keep_depth = len(stack)
            if wanted and kind in ("namespace", "module", "class", "interface", "enum"):
                out.append(f"{'#' * min(len(stack) + 1, 6)} {kind} {fullname}")
            continue
        if s == "}" or s.startswith("}"):
            if stack:
                if keep_depth is not None and len(stack) == keep_depth:
                    keep_depth = None
                    out.append("")
                stack.pop()
            continue
        if keep_depth is not None and len(stack) >= keep_depth:
            if s.startswith("//"):
                continue
            # method/property signature lines
            if len(s) > 400:
                s = s[:400] + " …"
            out.append(f"- `{s}`")
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(out)} lines)")

if __name__ == "__main__":
    main()
