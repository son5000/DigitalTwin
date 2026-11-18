import { getCustomAssetIdFromTemplate } from "../../customAssets/core/customAssetTypes.js";

export function collectAssetReferences(value, result = { equipmentIds: new Set(), textureIds: new Set(), customIds: new Set() }) {
  if (!value || typeof value !== "object" || value instanceof Blob) return result;
  if (value.sourceType === "UPLOAD" && value.assetId) result.equipmentIds.add(value.assetId);
  if (value.textureAssetId) result.textureIds.add(value.textureAssetId);
  if (value.customAssetId) result.customIds.add(value.customAssetId);
  for (const child of Object.values(value)) {
    const id = typeof child === "string" && getCustomAssetIdFromTemplate(child);
    if (id) result.customIds.add(id);
    collectAssetReferences(child, result);
  }
  return result;
}

export function validateNativeAssets(bundle) {
  if (bundle?.format !== "digital-twin-assets" || bundle.version !== 2
    || ![bundle.assets?.equipment, bundle.assets?.textures, bundle.assets?.custom].every(Array.isArray)) {
    throw new Error("서버 원본 자산 ZIP의 형식이 올바르지 않습니다.");
  }
  const ids = new Set();
  for (const [kind, assets] of Object.entries(bundle.assets)) {
    if (!["equipment", "textures", "custom"].includes(kind)) throw new Error("알 수 없는 원본 자산 종류입니다.");
    for (const asset of assets) {
      if (typeof asset?.id !== "string" || !asset.id || ids.has(asset.id)) throw new Error("원본 자산 ID가 없거나 중복되었습니다.");
      ids.add(asset.id);
      if (kind === "equipment" && (!asset.files?.length || asset.files.some((file) => !(file.blob instanceof Blob))
        || !asset.files.some((file) => (file.path || file.name) === (asset.primaryFilePath || asset.primaryFileName)))) {
        throw new Error("설비 자산의 원본 모델 파일이 빠져 있습니다.");
      }
      if (kind === "textures" && !(asset.blob instanceof Blob)) throw new Error("텍스처 원본 파일이 빠져 있습니다.");
    }
  }
  return bundle.assets;
}

export function assertAssetsComplete(layout, assets) {
  const required = collectAssetReferences(layout);
  for (const asset of assets.custom) collectAssetReferences(asset, required);
  for (const [kind, key] of [["equipment", "equipmentIds"], ["textures", "textureIds"], ["custom", "customIds"]]) {
    const available = new Set(assets[kind].map((asset) => asset.id));
    for (const id of required[key]) if (!available.has(id)) throw new Error(`서버 자산에 연결된 ${kind} 원본이 없습니다: ${id}`);
  }
}

// Restore all dependencies before exposing the project. Roll back partial writes.
export async function restoreAssetRecords(assets, repositories, signal) {
  const previous = [];
  try {
    for (const kind of ["textures", "equipment", "custom"]) {
      const repository = repositories[kind];
      for (const asset of assets[kind]) {
        signal?.throwIfAborted();
        const old = await repository.get(asset.id);
        previous.push({ repository, id: asset.id, old, kind });
        if (kind === "custom") await repository.save(asset); else await repository.put(asset);
      }
    }
    signal?.throwIfAborted();
  } catch (error) {
    for (const { repository, id, old, kind } of previous.reverse()) {
      try {
        if (old) { if (kind === "custom") await repository.save(old); else await repository.put(old); }
        else if (kind === "custom") await repository.delete(id); else await repository.remove(id);
      } catch { /* Keep the initiating error; a retry will restore the full bundle. */ }
    }
    throw error;
  }
}
