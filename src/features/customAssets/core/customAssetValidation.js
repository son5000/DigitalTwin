import { CUSTOM_ASSET_TYPES } from "./customAssetTypes.js";

const validators = new Map();

export function registerCustomAssetValidator(type, validator) {
  validators.set(type, validator);
}

export function validateCustomAsset(asset) {
  const errors = [];
  if (!asset?.name?.trim()) errors.push({ path: "name", message: "건축물 이름을 입력하세요." });
  if (!Object.values(CUSTOM_ASSET_TYPES).includes(asset?.type)) errors.push({ path: "type", message: "지원하지 않는 에셋 유형입니다." });
  const validator = validators.get(asset?.type);
  return validator ? [...errors, ...validator(asset)] : errors;
}
