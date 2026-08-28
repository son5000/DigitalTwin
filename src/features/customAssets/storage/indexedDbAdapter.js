import { migrateCustomAsset } from "../core/customAssetMigrations";

const DATABASE_VERSION = 1;
const STORE_NAME = "assets";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 요청에 실패했습니다."));
  });
}

export function createIndexedDbAdapter(projectId) {
  const databaseName = `digital-twin-custom-assets:${projectId}`;
  let databasePromise;

  function open() {
    if (!globalThis.indexedDB) return Promise.reject(new Error("IndexedDB를 사용할 수 없습니다."));
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            const store = request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("type", "type", { unique: false });
            store.createIndex("updatedAt", "updatedAt", { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB를 열 수 없습니다."));
      });
    }
    return databasePromise;
  }

  async function store(mode = "readonly") {
    const database = await open();
    return database.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  return {
    async list() { return (await requestResult((await store()).getAll())).map(migrateCustomAsset).filter(Boolean); },
    async get(id) { return migrateCustomAsset(await requestResult((await store()).get(id))); },
    async save(asset) { await requestResult((await store("readwrite")).put(asset)); return asset; },
    async delete(id) { await requestResult((await store("readwrite")).delete(id)); },
  };
}
