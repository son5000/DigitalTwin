import { migrateCustomAsset } from "../core/customAssetMigrations";

export function createLocalStorageAdapter(projectId) {
  const assetKey = `custom-assets:${projectId}`;
  const read = () => {
    try {
      return (JSON.parse(localStorage.getItem(assetKey) ?? "[]") ?? []).map(migrateCustomAsset).filter(Boolean);
    } catch {
      return [];
    }
  };
  const write = (assets) => localStorage.setItem(assetKey, JSON.stringify(assets));

  return {
    async list() { return read(); },
    async get(id) { return read().find((asset) => asset.id === id) ?? null; },
    async save(asset) {
      const assets = read();
      const index = assets.findIndex((item) => item.id === asset.id);
      if (index >= 0) assets[index] = asset;
      else assets.push(asset);
      write(assets);
      return asset;
    },
    async delete(id) { write(read().filter((asset) => asset.id !== id)); },
  };
}
