import { ASSET_TYPES, ASSET_USAGE_TYPES, EQUIPMENT_DISPLAY_MODES } from "./equipmentDetailModel.js";

const SUPPORTED_EXTENSIONS = new Set(["OBJ", "PLY", "MTL", "JPG", "JPEG", "PNG", "WEBP"]);
const PRIMARY_EXTENSIONS = new Set(["OBJ", "PLY", "JPG", "JPEG", "PNG", "WEBP"]);
const IMAGE_EXTENSIONS = new Set(["JPG", "JPEG", "PNG", "WEBP"]);

export function fileExtension(name = "") {
  return name.split(".").pop()?.toUpperCase() ?? "";
}

function fileStem(name = "") {
  return name.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "").toLocaleLowerCase() ?? "";
}

function findRelatedFile(files, extensions, stem) {
  return files.find((file) => extensions.has(fileExtension(file.name)) && fileStem(file.name) === stem)
    ?? files.find((file) => extensions.has(fileExtension(file.name)))
    ?? null;
}

export function describeEquipmentAssetFiles(files = []) {
  const list = Array.from(files);
  if (!list.length) return { ok: false, message: "등록할 파일을 선택하세요." };
  const unsupported = list.find((file) => !SUPPORTED_EXTENSIONS.has(fileExtension(file.name)));
  if (unsupported) return { ok: false, message: `${unsupported.name}은(는) 지원하지 않는 형식입니다.` };
  const primary = list.find((file) => fileExtension(file.name) === "OBJ")
    ?? list.find((file) => fileExtension(file.name) === "PLY")
    ?? list.find((file) => PRIMARY_EXTENSIONS.has(fileExtension(file.name)));
  if (!primary) return { ok: false, message: "OBJ, PLY 또는 이미지 원본 파일이 필요합니다." };
  const extension = fileExtension(primary.name);
  const assetType = extension === "OBJ" ? ASSET_TYPES.OBJ : extension === "PLY" ? ASSET_TYPES.PLY : ASSET_TYPES.IMAGE;
  const primaryStem = fileStem(primary.name);
  return {
    ok: true,
    primary,
    relatedMaterial: assetType === ASSET_TYPES.OBJ ? findRelatedFile(list, new Set(["MTL"]), primaryStem) : null,
    relatedTexture: assetType === ASSET_TYPES.IMAGE ? null : findRelatedFile(list, IMAGE_EXTENSIONS, primaryStem),
    assetType,
    usageType: assetType === ASSET_TYPES.PLY ? ASSET_USAGE_TYPES.POINT_CLOUD : assetType === ASSET_TYPES.IMAGE ? ASSET_USAGE_TYPES.REFERENCE_IMAGE : ASSET_USAGE_TYPES.MODEL,
    displayMode: assetType === ASSET_TYPES.PLY ? EQUIPMENT_DISPLAY_MODES.POINT_CLOUD : assetType === ASSET_TYPES.OBJ ? EQUIPMENT_DISPLAY_MODES.ACTUAL : EQUIPMENT_DISPLAY_MODES.PROXY,
    files: list,
  };
}

export function createLocalEquipmentAssetRecord(files, assetId = `EQUIPMENT_ASSET_${crypto.randomUUID()}`) {
  const description = describeEquipmentAssetFiles(files);
  if (!description.ok) return description;
  return {
    ...description,
    record: {
      id: assetId,
      primaryFileName: description.primary.name,
      primaryFilePath: description.primary.webkitRelativePath || description.primary.name,
      files: description.files.map((file) => ({ name: file.name, path: file.webkitRelativePath || file.name, type: file.type, size: file.size, blob: file })),
      createdAt: new Date().toISOString(),
    },
  };
}
