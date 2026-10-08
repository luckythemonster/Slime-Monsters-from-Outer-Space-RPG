// Inventory: stackable item entries. Pure module (no Phaser).
//
// items.json shape: { "pizza_slice": { "name": "Pizza Slice", "type": "consumable",
//                                      "effect": { "hp": 30 }, "price": 5, "desc": "…" } }
// `type` may be "consumable" | "key" | "equipment" (equipment ids also live in equipment.json).

export class Inventory {
  /** @param {object} items items.json contents */
  constructor(items = {}) {
    this.items = items;
    /** @type {{id: string, qty: number}[]} */
    this.entries = [];
  }

  /** Item definition or undefined. */
  def(id) { return this.items[id]; }

  /** @param {string} id */
  count(id) {
    const e = this.entries.find((x) => x.id === id);
    return e ? e.qty : 0;
  }

  /** @param {string} id */
  has(id) { return this.count(id) > 0; }

  /** Add qty of an item (unknown ids throw so data bugs surface early). */
  add(id, qty = 1) {
    if (!this.items[id]) throw new Error(`Inventory.add: unknown item "${id}"`);
    if (qty <= 0) return this.count(id);
    const e = this.entries.find((x) => x.id === id);
    if (e) e.qty += qty;
    else this.entries.push({ id, qty });
    return this.count(id);
  }

  /** Remove qty; returns false (and removes nothing) if there is not enough. */
  remove(id, qty = 1) {
    const i = this.entries.findIndex((x) => x.id === id);
    if (i < 0 || this.entries[i].qty < qty) return false;
    this.entries[i].qty -= qty;
    if (this.entries[i].qty <= 0) this.entries.splice(i, 1);
    return true;
  }

  /** Entries with definitions attached (for menus). */
  list() {
    return this.entries.map((e) => ({ ...e, def: this.items[e.id] || { name: e.id } }));
  }

  /** Consumables only. */
  consumables() {
    return this.list().filter((e) => (e.def.type || 'consumable') === 'consumable');
  }

  /** Save-shape array. */
  toJSON() { return this.entries.map((e) => ({ id: e.id, qty: e.qty })); }

  fromJSON(entries) {
    this.entries = (entries || []).filter((e) => e && e.qty > 0).map((e) => ({ id: e.id, qty: e.qty }));
  }
}
