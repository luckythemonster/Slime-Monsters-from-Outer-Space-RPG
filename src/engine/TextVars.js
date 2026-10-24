// `{var:name}` text markup (DESIGN.md E6). Pure module (no Phaser) so DialogueBox, EventRunner and
// the Node data tests share one implementation.
//
//   {var:contractPages}   → state.vars.contractPages
//   {var:money}           → state.money
//   {var:flags.gigFlyer}  → state.flags.gigFlyer   (any dotted GameState path works)
//   {var:vars.saveCount}  → state.vars.saveCount
//
// Bare names resolve `vars` first, then `flags`, then the top-level fields `money`, `chapter`, `map`.
// Missing values render as "0" (booleans as "yes"/"no") so a line never shows raw markup.

export const VAR_RE = /\{var:([^}]*)\}/g;

/** Look one name up on a GameState-shaped object. */
export function lookupVar(name, state) {
  if (!state || !name) return undefined;
  if (name.includes('.')) return typeof state.get === 'function' ? state.get(name) : undefined;
  if (state.vars && Object.prototype.hasOwnProperty.call(state.vars, name)) return state.vars[name];
  if (state.flags && Object.prototype.hasOwnProperty.call(state.flags, name)) return state.flags[name];
  if (name === 'money' || name === 'chapter' || name === 'map') return state[name];
  if (name === 'partySize' && state.party) return state.party.size;
  return undefined;
}

/** Render a looked-up value for dialogue. */
export function formatVar(v) {
  if (v === undefined || v === null) return '0';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return String(Number.isInteger(v) ? v : Math.round(v * 100) / 100);
  return String(v);
}

/**
 * Replace every `{var:name}` in `text` with its current value. Other markup is left alone, so the
 * result can go straight into DialogueBox/Caption/Toast wrapping.
 * @param {string} text
 * @param {object|null} state GameState (or anything with vars/flags/money/get)
 */
export function expandVars(text, state) {
  if (text === undefined || text === null) return '';
  const s = String(text);
  if (!s.includes('{var:')) return s;
  return s.replace(VAR_RE, (_, name) => formatVar(lookupVar(name.trim(), state)));
}
