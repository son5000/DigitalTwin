import {
  CUSTOM_ASSET_TYPES,
  CUSTOM_BUILDING_CREATE_ID,
  CUSTOM_EQUIPMENT_CREATE_ID,
  customBuildingTemplateId,
  customEquipmentTemplateId,
} from "./customAssetTypes.js";

const typeRegistry = new Map();
const runtimeAssets = new Map();
const listeners = new Set();

export const CUSTOM_BUILDING_CREATE_DEFINITION = Object.freeze({
  id: CUSTOM_BUILDING_CREATE_ID,
  categoryId: "BUILDING",
  subcategoryId: "CUSTOM",
  name: "커스텀 건축물 만들기",
  nameEn: "Create custom building",
  description: "전용 제작소에서 새로운 건축물을 설계합니다.",
  iconKey: "building",
  type: "CUSTOM_ACTION",
  assetKind: "BUILDING",
  action: "CREATE_CUSTOM_BUILDING",
  createsBuilding: false,
  width: 12,
  depth: 10,
  height: 12,
  keywords: ["커스텀", "건축물", "제작소", "새 건축물"],
  defaultVariants: {},
  variantGroups: [],
});

export const CUSTOM_EQUIPMENT_CREATE_DEFINITION = Object.freeze({
  id: CUSTOM_EQUIPMENT_CREATE_ID,
  templateId: CUSTOM_EQUIPMENT_CREATE_ID,
  categoryId: "EQUIPMENT",
  subcategoryId: "CUSTOM",
  category: "CUSTOM",
  name: "커스텀 설비 만들기",
  nameKo: "커스텀 설비 만들기",
  nameEn: "Create custom equipment",
  description: "커스텀 제작소에서 새로운 설비를 제작합니다.",
  iconKey: "mechanical",
  type: "CUSTOM_ACTION",
  assetKind: "CUSTOM_EQUIPMENT",
  action: "OPEN_CUSTOM_EQUIPMENT",
  createsBuilding: false,
  keywords: ["커스텀", "설비", "제작소", "새 설비"],
  defaultVariants: {},
  variantGroups: [],
  modelVariants: [],
  aliases: [],
});

export function registerCustomAssetType(type, definition) {
  typeRegistry.set(type, Object.freeze({ type, ...definition }));
}

export function getCustomAssetTypeRegistration(type) {
  return typeRegistry.get(type) ?? null;
}

export function listCustomAssetTypeRegistrations() {
  return [...typeRegistry.values()];
}

export function customBuildingAssetToLibraryDefinition(asset) {
  const primaryMaterial = asset.materials?.[0];
  const floorHeight = asset.levels?.[0]?.height ?? asset.sections?.[0]?.floorHeight ?? asset.floorHeight ?? 3.6;
  return {
    id: customBuildingTemplateId(asset.id),
    categoryId: "BUILDING",
    subcategoryId: "CUSTOM",
    name: asset.name,
    nameEn: asset.name,
    description: asset.description || "사용자가 제작한 커스텀 건축물",
    iconKey: "building",
    type: "BUILDING",
    assetKind: "BUILDING",
    profile: "CUSTOM_ASSET",
    createsBuilding: true,
    geometryMode: "AREA",
    width: Math.max(1, asset.bounds?.width ?? 10),
    depth: Math.max(1, asset.bounds?.depth ?? 10),
    height: Math.max(2, asset.bounds?.height ?? floorHeight),
    color: primaryMaterial?.color ?? "#82939A",
    material: primaryMaterial?.presetId ?? "CONCRETE",
    parameters: {
      floorCount: Math.max(1, asset.metrics?.floorCount ?? 1),
      floorHeight,
      roofType: "FLAT",
      entranceCount: 1,
      stairCount: 1,
    },
    customAssetViewGroups: asset.viewGroups ?? [],
    defaultVariants: {},
    variantGroups: [],
    customAssetId: asset.id,
    customAssetRevision: asset.revision ?? 1,
    customAsset: asset,
    thumbnail: asset.thumbnail,
    status: asset.status,
    keywords: [asset.name, asset.description, ...(asset.tags ?? []), "커스텀 건축물"].filter(Boolean),
  };
}

export function customEquipmentAssetToLibraryDefinition(asset) {
  const width = Math.max(0.2, asset.bounds?.width ?? 1); const depth = Math.max(0.2, asset.bounds?.depth ?? 1); const height = Math.max(0.2, asset.bounds?.height ?? 1);
  const partCount = asset.metrics?.partCount ?? asset.parts?.length ?? 0;
  return {
    id: customEquipmentTemplateId(asset.id), templateId: customEquipmentTemplateId(asset.id), categoryId: "EQUIPMENT", subcategoryId: "PIPE_WATER",
    category: "PIPE_WATER", floorCategory: "CUSTOM_EQUIPMENT", generatorKey: "CUSTOM_EQUIPMENT", domain: "EQUIPMENT",
    name: asset.name, nameKo: asset.name, nameEn: asset.name, description: asset.description || "사용자가 조립한 커스텀 설비", iconKey: "mechanical",
    type: "SITE_OBJECT", assetKind: "CUSTOM_EQUIPMENT", profile: "CUSTOM_EQUIPMENT", geometryMode: "POINT", createsBuilding: false,
    width, depth, height, defaultDimensions: { width, depth, height }, defaultParameters: {}, parameters: {},
    color: asset.appearance?.color ?? "#668896", material: asset.appearance?.materialPreset ?? "PAINTED_METAL",
    defaultAppearance: { color: asset.appearance?.color ?? "#668896", materialPreset: asset.appearance?.materialPreset ?? "PAINTED_METAL", opacity: 1, showEdges: false },
    placementRules: { allowedModes: ["GROUND", "ROOF", "INDOOR"] }, installationBadges: ["실내·외 겸용"],
    catalogDetail: `커스텀 설비 · ${partCount}개 부품 · ${width.toFixed(1)} × ${depth.toFixed(1)} × ${height.toFixed(1)} m`,
    modelSource: `custom-equipment:${asset.id}`, thumbnailSource: asset.thumbnail || "/assets/object-thumbnails/fallback.png",
    objectType: "CUSTOM_EQUIPMENT", objectTypeLabel: "커스텀 설비", customAssetId: asset.id, customAssetRevision: asset.revision ?? 1,
    customAsset: asset, customAssetSnapshot: asset, status: asset.status, defaultVariants: {}, variantGroups: [], modelVariants: [], aliases: [], parameterDefinitions: [], materialSlots: [],
    keywords: [asset.name, asset.description, ...(asset.tags ?? []), "커스텀 설비"].filter(Boolean),
  };
}

export function setRuntimeCustomAssets(assets) {
  runtimeAssets.clear();
  assets.forEach((asset) => runtimeAssets.set(asset.id, asset));
  listeners.forEach((listener) => listener());
}

export function getRuntimeCustomAsset(assetId) {
  return runtimeAssets.get(assetId) ?? null;
}

export function getRuntimeCustomBuildingDefinition(templateId) {
  for (const asset of runtimeAssets.values()) {
    if (customBuildingTemplateId(asset.id) === templateId && asset.type === CUSTOM_ASSET_TYPES.BUILDING) {
      return customBuildingAssetToLibraryDefinition(asset);
    }
  }
  return null;
}

export function getRuntimeCustomEquipmentDefinition(templateId) {
  for (const asset of runtimeAssets.values()) {
    if (customEquipmentTemplateId(asset.id) === templateId && asset.type === CUSTOM_ASSET_TYPES.EQUIPMENT) return customEquipmentAssetToLibraryDefinition(asset);
  }
  return null;
}

export function listRuntimeCustomBuildingDefinitions({ readyOnly = true } = {}) {
  return [...runtimeAssets.values()]
    .filter((asset) => asset.type === CUSTOM_ASSET_TYPES.BUILDING && (!readyOnly || asset.status === "ready"))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .map(customBuildingAssetToLibraryDefinition);
}

export function listRuntimeCustomEquipmentDefinitions({ readyOnly = true } = {}) {
  return [...runtimeAssets.values()].filter((asset) => asset.type === CUSTOM_ASSET_TYPES.EQUIPMENT && (!readyOnly || asset.status === "ready"))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))).map(customEquipmentAssetToLibraryDefinition);
}

export function subscribeRuntimeCustomAssets(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
