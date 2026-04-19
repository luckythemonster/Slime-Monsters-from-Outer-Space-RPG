const KEY = 'smotspace_save_0';

export default class SaveSystem {
  static save(party, mapId, tileX, tileY) {
    const data = {
      party:   party.serialize(),
      mapId,
      tileX,
      tileY,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static exists() {
    return !!localStorage.getItem(KEY);
  }

  static clear() {
    localStorage.removeItem(KEY);
  }
}
