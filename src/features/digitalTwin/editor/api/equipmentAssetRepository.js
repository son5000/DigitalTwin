const DATABASE_NAME = "digital-twin-equipment-assets";
const STORE_NAME = "assets";
const DATABASE_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("설비 파일 저장소를 열 수 없습니다."));
  });
}

async function transact(mode, callback) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = callback(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error("설비 파일 저장 작업에 실패했습니다."));
    });
  } finally {
    database.close();
  }
}

export const equipmentAssetRepository = {
  async put(asset) { await transact("readwrite", (store) => store.put(asset)); return asset; },
  async get(id) { return transact("readonly", (store) => store.get(id)); },
  async remove(id) { return transact("readwrite", (store) => store.delete(id)); },
};
