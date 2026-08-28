export const CUSTOM_ASSET_SCHEMA_VERSION = 2;

export const CUSTOM_ASSET_TYPES = Object.freeze({
  BUILDING: "building",
  FURNITURE: "furniture",
  EQUIPMENT: "equipment",
  LANDSCAPE: "landscape",
  USER_ASSET: "user-asset",
});

export const CUSTOM_ASSET_STATUS = Object.freeze({
  DRAFT: "draft",
  READY: "ready",
});

export const CUSTOM_ASSET_PROJECT_ID = "digital-twin-local";
export const CUSTOM_BUILDING_TEMPLATE_PREFIX = "CUSTOM_BUILDING:";
export const CUSTOM_BUILDING_CREATE_ID = "CUSTOM_BUILDING_CREATE";

export function createCustomAssetId(type = CUSTOM_ASSET_TYPES.BUILDING) {
  return `${type}-${crypto.randomUUID()}`;
}

export function customBuildingTemplateId(assetId) {
  return `${CUSTOM_BUILDING_TEMPLATE_PREFIX}${assetId}`;
}

export function getCustomAssetIdFromTemplate(templateId) {
  return String(templateId ?? "").startsWith(CUSTOM_BUILDING_TEMPLATE_PREFIX)
    ? String(templateId).slice(CUSTOM_BUILDING_TEMPLATE_PREFIX.length)
    : null;
}

export function cloneCustomAsset(asset) {
  return structuredClone(asset);
}
