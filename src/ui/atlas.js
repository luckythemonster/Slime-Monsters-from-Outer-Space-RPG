// Helpers for the generated UI atlas (assets/generated/ui.png + manifest.json entry "ui").
// The manifest is not Phaser's atlas JSON, so the PNG is loaded as a plain image and the named
// regions are registered as frames with Texture#add (docs/ARCHITECTURE.md section 3.3).

export const UI_KEY = 'ui';
export const PORTRAIT_KEY = 'portraits';

export const WINDOW_FRAMES = ['win_tl', 'win_t', 'win_tr', 'win_l', 'win_c', 'win_r', 'win_bl', 'win_b', 'win_br'];
export const REQUIRED_FRAMES = [...WINDOW_FRAMES, 'cursor', 'arrow_more'];

/**
 * Find a sheet entry in the manifest regardless of how the top level is shaped
 * ({ ui: {...} }, { sheets: { ui: {...} } }, { sheets: [ { name: 'ui', ... } ] }, ...).
 * @returns {object|null}
 */
export function findManifestEntry(manifest, key) {
  if (!manifest || typeof manifest !== 'object') return null;
  const direct = [manifest[key], manifest.sheets?.[key], manifest.atlases?.[key], manifest.textures?.[key], manifest.images?.[key]];
  for (const c of direct) {
    if (c && typeof c === 'object' && !Array.isArray(c)) return c;
  }
  for (const list of [manifest.sheets, manifest.atlases, manifest.textures, manifest.images, manifest.entries]) {
    if (Array.isArray(list)) {
      const hit = list.find((s) => s && (s.name === key || s.key === key || s.id === key));
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Register the named frames of a manifest atlas entry on an already-loaded texture.
 * Frames may be { x, y, w, h } or { x, y, width, height }; an object keyed by name or an array
 * of { name, ... }. Existing frames are kept. Returns the number of frames added.
 */
export function registerAtlasFrames(textures, key, entry) {
  if (!textures || !textures.exists(key) || !entry || !entry.frames) return 0;
  const tex = textures.get(key);
  const frames = entry.frames;
  const list = Array.isArray(frames) ? frames.map((f) => [f.name ?? f.key ?? f.id, f]) : Object.entries(frames);
  let added = 0;
  for (const [name, f] of list) {
    if (!name || !f || tex.has(name)) continue;
    const w = f.w ?? f.width;
    const h = f.h ?? f.height;
    if (!(w > 0 && h > 0)) continue;
    tex.add(name, 0, (f.x ?? 0) | 0, (f.y ?? 0) | 0, w | 0, h | 0);
    added++;
  }
  return added;
}

/** True when the `ui` texture exists and carries every frame the widgets draw. */
export function hasUiFrames(textures, names = REQUIRED_FRAMES) {
  if (!textures || !textures.exists(UI_KEY)) return false;
  const tex = textures.get(UI_KEY);
  return names.every((n) => tex.has(n));
}

/** True when `portraits` has a frame named `id`. */
export function hasPortrait(textures, id) {
  if (!id || !textures || !textures.exists(PORTRAIT_KEY)) return false;
  return textures.get(PORTRAIT_KEY).has(String(id));
}
