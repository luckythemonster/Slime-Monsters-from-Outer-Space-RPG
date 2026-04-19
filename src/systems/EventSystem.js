export default class EventSystem {
  constructor() {
    this._flags = {};
  }

  set(flag, value = true) {
    this._flags[flag] = value;
  }

  get(flag) {
    return this._flags[flag] ?? false;
  }

  check(flag) {
    return !!this._flags[flag];
  }

  serialize() {
    return { flags: { ...this._flags } };
  }

  deserialize(data) {
    this._flags = { ...(data?.flags ?? {}) };
  }
}
