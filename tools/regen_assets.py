"""Regenerate the game's art, then put back every PNG whose pixels did not change.

The generator's PNG compression differs by machine, so a plain `gen_assets.py` run rewrites every sheet
byte-different but pixel-identical. This keeps a commit down to the art that really changed.

Usage: python3 tools/regen_assets.py [repo_root]   (default: the parent of tools/)
"""
import io
import os
import subprocess
import sys

from PIL import Image

root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def git(*args, binary=False):
    r = subprocess.run(['git', '-C', root, *args], capture_output=True)
    return r.stdout if binary else r.stdout.decode()


subprocess.run([sys.executable, os.path.join(root, 'tools', 'gen_assets.py'), '--preview', '-q'], cwd=root, check=True)
restored, kept = 0, []
for line in git('status', '--short', '--', 'assets/generated').split('\n'):
    if not line.startswith(' M') or not line.endswith('.png'):
        continue
    f = line[3:]
    old = Image.open(io.BytesIO(git('show', 'HEAD:' + f, binary=True))).convert('RGBA')
    new = Image.open(os.path.join(root, f)).convert('RGBA')
    if old.size == new.size and old.tobytes() == new.tobytes():
        git('checkout', '--', f)
        restored += 1
    else:
        kept.append(f)
print('restored %d unchanged PNGs; changed: %s' % (restored, kept))
