import { CUSTOM_ASSET_SCHEMA_VERSION, CUSTOM_ASSET_STATUS, CUSTOM_ASSET_TYPES } from "./customAssetTypes.js";
import { normalizeBuildingAssembly } from "../building/buildingAssembly.js";

export function migrateCustomAsset(source) {
  if (!source || typeof source !== "object" || !source.id) return null;
  const now = new Date().toISOString();
  const migrated = {
    ...source,
    type: Object.values(CUSTOM_ASSET_TYPES).includes(source.type) ? source.type : CUSTOM_ASSET_TYPES.BUILDING,
    schemaVersion: CUSTOM_ASSET_SCHEMA_VERSION,
    revision: Math.max(1, Number(source.revision) || 1),
    name: String(source.name ?? "이름 없는 커스텀 에셋"),
    description: String(source.description ?? ""),
    tags: Array.isArray(source.tags) ? source.tags.map(String) : [],
    status: Object.values(CUSTOM_ASSET_STATUS).includes(source.status) ? source.status : CUSTOM_ASSET_STATUS.DRAFT,
    createdAt: source.createdAt ?? now,
    updatedAt: source.updatedAt ?? now,
  };
  return migrated.type === CUSTOM_ASSET_TYPES.BUILDING ? normalizeBuildingAssembly(migrated) : migrated;
}
