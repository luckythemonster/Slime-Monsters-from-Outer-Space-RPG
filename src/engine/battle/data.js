// Battle data bundle for the browser: the registry from Data.js plus riffs.json / shops.json, which
// Data.js does not import. Node tests assemble the same shape from the files directly.
import riffs from '../../data/riffs.json';
import shops from '../../data/shops.json';

/**
 * @param {import('../Data.js').GameDataRegistry} gameData services.data
 * @returns {{characters: object, xpTable: number[], riffs: object, shops: object, items: object, equipment: object, enemies: object, encounters: object}}
 */
export function battleData(gameData) {
  const chars = gameData.characters || {};
  return {
    characters: chars.characters || {},
    xpTable: chars.xpTable || [0],
    riffs,
    shops,
    items: gameData.items || {},
    equipment: gameData.equipment || {},
    enemies: gameData.enemies || {},
    encounters: gameData.encounters || {},
  };
}

export { riffs, shops };
