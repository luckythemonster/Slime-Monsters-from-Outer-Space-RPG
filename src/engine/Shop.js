// Shops (DESIGN.md E19): BUY / SELL / LEAVE driven through the UI service's menus.
// Reads src/data/shops.json in either of the two shapes that have been proposed for it:
//
//   { "cafe": { "name", "keeper", "greeting",
//               "items": ["pizza_slice", …]           // or "buy": [...]
//               "after": { "if": "<condition>", "items": [...] },   // extra stock once a condition holds
//               "stock": [{ "id": "hotdish", "condition": "flags.monthLater" }],  // same idea, per item
//               "buys": true,                           // false = SELL is hidden
//               "sellRate": 0.5,                        // or "buyRate" (what the shop pays, × item price)
//               "sellPrice": { "fried_pedalboard": 11 },  // or "buyPrices"; items.json `sell` also counts
//               "refuse": ["half_ounce"] } }            // or "refuses"; key items and locked gear are always refused
//
// Every field is optional. Prices come from items.json / equipment.json `price`.
import { evaluate } from './Conditions.js';

const QTY_MAX = 9;

/** Normalise a shops.json entry into one shape. */
export function normalizeShop(id, def = {}) {
  const stock = [];
  for (const it of def.buy || def.items || []) stock.push(typeof it === 'string' ? { id: it } : it);
  if (def.after && Array.isArray(def.after.items)) {
    for (const it of def.after.items) stock.push({ id: typeof it === 'string' ? it : it.id, condition: def.after.if || def.after.condition });
  }
  for (const it of def.stock || []) stock.push(typeof it === 'string' ? { id: it } : it);
  const refuse = new Set([...(def.refuse || []), ...(def.refuses || [])]);
  return {
    id,
    name: def.name || id,
    keeper: def.keeper || null,
    greeting: def.greeting || null,
    stock,
    buys: def.buys !== false,
    sellRate: Number(def.sellRate ?? def.buyRate ?? 0.5),
    sellPrice: { ...(def.buyPrices || {}), ...(def.sellPrice || {}) },
    refuse,
  };
}

/** Catalogue price of an item id (0 when unknown). */
export function buyPrice(itemDef) {
  return Math.max(0, Math.round(Number(itemDef && itemDef.price) || 0));
}

/** What the shop pays for one unit, or null when it refuses. */
export function sellPrice(shop, id, itemDef) {
  if (!itemDef) return null;
  if (shop.refuse.has(id)) return null;
  if (itemDef.type === 'key' || itemDef.locked) return null;
  if (shop.sellPrice[id] !== undefined) return Math.max(0, Math.round(Number(shop.sellPrice[id]) || 0));
  if (itemDef.sell !== undefined) return Math.max(0, Math.round(Number(itemDef.sell) || 0));
  return Math.max(0, Math.floor(buyPrice(itemDef) * shop.sellRate));
}

/** Items on the shelf right now (conditions evaluated against the state). */
export function stockFor(shop, state) {
  const seen = new Set();
  const out = [];
  for (const entry of shop.stock) {
    if (!entry || !entry.id || seen.has(entry.id)) continue;
    if (entry.condition && !evaluate(entry.condition, state)) continue;
    seen.add(entry.id);
    out.push(entry.id);
  }
  return out;
}

const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const money = (n) => `$${n}`;

/**
 * Run the shop interaction. Resolves when the player leaves.
 * @param {string} shopId
 * @param {{shops: object, state: import('./GameState.js').GameState, ui: object, audio?: object}} deps
 */
export async function runShop(shopId, { shops, state, ui, audio }) {
  const def = shops && shops[shopId];
  if (!def) {
    await ui.say({ text: `The shop "${shopId}" is closed. (missing from shops.json)`, who: 'narrator' });
    return;
  }
  const shop = normalizeShop(shopId, def);
  const inv = state.inventory;
  const defOf = (id) => inv.def(id);
  const nameOf = (id) => (defOf(id) ? defOf(id).name : id);
  const sfx = (n) => { try { audio && audio.sfx && audio.sfx(n); } catch { /* audio never breaks a shop */ } };
  const status = () => { if (typeof ui.status === 'function') ui.status(`${money(state.money)}`); };

  const top = shop.buys ? ['BUY', 'SELL', 'LEAVE'] : ['BUY', 'LEAVE'];
  let selected = 0;
  status();
  try {
    for (;;) {
      const idx = await ui.menu(top.map((label) => ({ label })), { x: 8, y: 8, cancelable: true, selected });
      if (idx < 0 || top[idx] === 'LEAVE') break;
      selected = idx;
      if (top[idx] === 'BUY') await buyLoop();
      else await sellLoop();
    }
  } finally {
    if (typeof ui.status === 'function') ui.status(null);
  }

  async function pickQty(max, unit, verb) {
    max = Math.max(1, Math.min(QTY_MAX, max));
    if (max === 1) return 1;
    const items = [];
    for (let n = 1; n <= max; n++) items.push({ label: `x${n}  ${money(unit * n)}`, hint: `${verb} ${n}` });
    const i = await ui.menu(items, { x: 8, y: 48, cancelable: true });
    return i < 0 ? 0 : i + 1;
  }

  async function buyLoop() {
    let sel = 0;
    for (;;) {
      const ids = stockFor(shop, state);
      if (!ids.length) { await ui.say({ text: 'Nothing on the shelf.', who: 'narrator' }); return; }
      const rows = ids.map((id) => {
        const d = defOf(id) || { name: id, desc: '' };
        const price = buyPrice(d);
        return { id, price, label: `${pad(d.name, 20)}${pad(money(price), 5)}`, hint: `${d.desc || ''}`.slice(0, 28), disabled: price > state.money };
      });
      const i = await ui.menu(rows, { x: 8, y: 32, cancelable: true, selected: sel });
      if (i < 0) return;
      sel = i;
      const row = rows[i];
      const d = defOf(row.id);
      const isGear = d && d.type === 'equipment';
      const qty = isGear ? 1 : await pickQty(row.price > 0 ? Math.floor(state.money / row.price) : QTY_MAX, row.price, 'Buy');
      if (!qty) continue;
      const cost = row.price * qty;
      if (!state.spendMoney(cost)) { sfx('cancel'); await ui.toast('Not enough money.'); continue; }
      inv.add(row.id, qty);
      sfx('item');
      status();
      await ui.toast(`Got ${nameOf(row.id)}${qty > 1 ? ` x${qty}` : ''}!`);
    }
  }

  async function sellLoop() {
    let sel = 0;
    for (;;) {
      const entries = inv.list();
      if (!entries.length) { await ui.say({ text: 'You have nothing to sell.', who: 'narrator' }); return; }
      const rows = entries.map((e) => {
        const price = sellPrice(shop, e.id, e.def);
        const refused = price === null;
        return {
          id: e.id, price, qty: e.qty,
          label: `${pad(`${e.def.name} x${e.qty}`, 20)}${pad(refused ? '--' : money(price), 5)}`,
          hint: refused ? "Won't take that." : `Sells for ${money(price)} each.`,
          disabled: refused,
        };
      });
      if (rows.every((r) => r.disabled)) { await ui.say({ text: `${shop.name} won't take any of that.`, who: 'narrator' }); return; }
      const i = await ui.menu(rows, { x: 8, y: 32, cancelable: true, selected: sel });
      if (i < 0) return;
      sel = i;
      const row = rows[i];
      const qty = await pickQty(row.qty, row.price, 'Sell');
      if (!qty) continue;
      if (!inv.remove(row.id, qty)) continue;
      state.addMoney(row.price * qty);
      sfx('item');
      status();
      await ui.toast(`Sold ${nameOf(row.id)}${qty > 1 ? ` x${qty}` : ''} for ${money(row.price * qty)}.`);
    }
  }
}
