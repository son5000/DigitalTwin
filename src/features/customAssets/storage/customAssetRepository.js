import { CUSTOM_ASSET_PROJECT_ID } from "../core/customAssetTypes";
import { migrateCustomAsset } from "../core/customAssetMigrations";
import { createIndexedDbAdapter } from "./indexedDbAdapter";
import { createLocalStorageAdapter } from "./localStorageAdapter";

export function createCustomAssetRepository(projectId = CUSTOM_ASSET_PROJECT_ID) {
  const indexedDb = createIndexedDbAdapter(projectId);
  const fallback = createLocalStorageAdapter(projectId);
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`custom-assets:${projectId}`) : null;
  let useFallback = false;

  async function execute(method, ...args) {
    if (useFallback) return fallback[method](...args);
    try {
      return await indexedDb[method](...args);
    } catch {
      useFallback = true;
      return fallback[method](...args);
    }
  }

  function announce(detail) {
    channel?.postMessage(detail);
    window.dispatchEvent(new CustomEvent("custom-assets:changed", { detail }));
  }

  return {
    projectId,
    async list(type) {
      const assets = await execute("list");
      return assets
        .map(migrateCustomAsset)
        .filter(Boolean)
        .filter((asset) => !type || asset.type === type)
        .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    },
    async get(id) { return migrateCustomAsset(await execute("get", id)); },
    async save(source) {
      const asset = migrateCustomAsset(source);
      if (!asset) throw new Error("저장할 커스텀 에셋이 올바르지 않습니다.");
      await execute("save", asset);
      announce({ action: "save", assetId: asset.id, revision: asset.revision, updatedAt: asset.updatedAt });
      return asset;
    },
    async delete(id) {
      await execute("delete", id);
      localStorage.removeItem(`custom-asset-draft:${projectId}:${id}`);
      announce({ action: "delete", assetId: id });
    },
    saveDraft(asset) {
      localStorage.setItem(`custom-asset-draft:${projectId}:${asset.id}`, JSON.stringify(asset));
      localStorage.setItem(`custom-asset-last-opened:${projectId}`, asset.id);
    },
    loadDraft(id) {
      try { return migrateCustomAsset(JSON.parse(localStorage.getItem(`custom-asset-draft:${projectId}:${id}`))); }
      catch { return null; }
    },
    clearDraft(id) { localStorage.removeItem(`custom-asset-draft:${projectId}:${id}`); },
    getLastOpenedId() { return localStorage.getItem(`custom-asset-last-opened:${projectId}`); },
    subscribe(listener) {
      const onMessage = (event) => listener(event.data);
      const onCustomEvent = (event) => listener(event.detail);
      const onStorage = (event) => {
        if (event.key?.startsWith(`custom-assets:${projectId}`)) listener({ action: "storage" });
      };
      channel?.addEventListener("message", onMessage);
      window.addEventListener("custom-assets:changed", onCustomEvent);
      window.addEventListener("storage", onStorage);
      return () => {
        channel?.removeEventListener("message", onMessage);
        window.removeEventListener("custom-assets:changed", onCustomEvent);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export const customAssetRepository = createCustomAssetRepository();
