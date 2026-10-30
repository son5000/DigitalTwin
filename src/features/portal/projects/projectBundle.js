import { equipmentAssetRepository } from "../../digitalTwin/editor/api/equipmentAssetRepository";
import { textureAssetRepository } from "../../digitalTwin/editor/api/textureAssetRepository";
import { createRoiRepository, roiStorageKey } from "../../digitalTwin/editor/api/roiRepository";
import { customAssetRepository } from "../../customAssets/storage/customAssetRepository";
import { getCustomAssetIdFromTemplate } from "../../customAssets/core/customAssetTypes";
import { isObservationRoi, roiToObservationPoint, validateRoi } from "../../digitalTwin/editor/model/roiMonitoring";
import { PROJECT_STORAGE_KEY, readProjects } from "./projectRepository";
import { decodeProjectFile, encodeProjectZip, safeBundleName } from "./projectBundleFiles.js";

function visit(value, callback) {
  if (!value || typeof value !== "object" || value instanceof Blob) return;
  callback(value);
  Object.values(value).forEach((child) => visit(child, callback));
}

export function downloadProjectBundle(blob, project) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url;
  link.download = `${safeBundleName(project.layout?.name || project.id)}.digital-twin.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Relative public assets travel with dist/. Uploaded assets and custom models
// are embedded here; external sensor/media URLs are explicitly inventoried.
export async function exportProjectBundle(project, { onProgress = () => {}, storage = window.localStorage } = {}) {
  // Freeze all configuration before awaiting file reads, including unsaved edits.
  project = structuredClone(project);
  const equipmentIds = new Set(), textureIds = new Set(), customIds = new Set(), references = new Set();
  function collect(value) {
    visit(value, (node) => {
      if (node.sourceType === "UPLOAD" && node.assetId) equipmentIds.add(node.assetId);
      if (node.textureAssetId) textureIds.add(node.textureAssetId);
      if (node.customAssetId) customIds.add(node.customAssetId);
      if (node.objectUrl && !node.assetId) throw new Error("임시 업로드 파일이 있습니다. 파일을 정식 등록하고 프로젝트를 저장한 뒤 내보내세요.");
      if (node.originalFileName && node.originalFormat && !node.assetId && !node.sourceKey) throw new Error(`원본이 저장되지 않은 이전 스캔입니다. 파일을 다시 등록하세요: ${node.originalFileName}`);
      Object.entries(node).forEach(([key, child]) => {
        if (typeof child !== "string") return;
        const customId = getCustomAssetIdFromTemplate(child);
        if (customId) customIds.add(customId);
        if (/^https?:\/\//.test(child)) references.add(child);
        if (key !== "objectUrl" && child.startsWith("blob:")) throw new Error("임시 파일 주소가 남아 있습니다. 원본 파일을 다시 등록하고 저장하세요.");
      });
    });
  }
  collect(project.layout);
  const rois = await createRoiRepository(project.id, storage).list(AbortSignal.timeout(15000));
  collect(rois);
  const assets = { equipment: [], textures: [], custom: [] };
  for (const id of customIds) {
    const asset = await customAssetRepository.get(id);
    if (!asset) throw new Error(`커스텀 모델을 찾을 수 없습니다: ${id}`);
    assets.custom.push(asset); collect(asset);
  }
  for (const id of equipmentIds) {
    const asset = await equipmentAssetRepository.get(id);
    if (!asset?.files?.length || asset.files.some((file) => !(file.blob instanceof Blob))) throw new Error(`등록된 설비 원본 파일을 찾을 수 없습니다: ${id}`);
    assets.equipment.push(asset);
  }
  for (const id of textureIds) {
    const asset = await textureAssetRepository.get(id);
    if (!(asset?.blob instanceof Blob)) throw new Error(`등록된 텍스처를 찾을 수 없습니다: ${id}`);
    assets.textures.push(asset);
  }
  return encodeProjectZip({ format: "digital-twin-project", version: 2, createdAt: new Date().toISOString(), project, rois, assets,
    externalReferences: [...references], requires: ["동일 버전의 뷰어 빌드와 기본 제공 리소스", "실시간 데이터 사용 시 센서 서버 연결"] }, onProgress);
}

export async function importProjectBundle(file, storage = window.localStorage, { onProgress = () => {} } = {}) {
  const source = await decodeProjectFile(file, onProgress);
  if (source?.format !== "digital-twin-project" || ![1, 2].includes(source.version) || !Array.isArray(source.project?.layout?.hierarchy?.nodes)
    || typeof source.project.id !== "string" || !source.project.id || !Array.isArray(source.rois)
    || ![source.assets?.equipment, source.assets?.textures, source.assets?.custom].every(Array.isArray)) throw new Error("지원하는 디지털 트윈 구성 파일이 아닙니다.");
  source.rois.forEach(validateRoi);
  const registry = readProjects(storage);
  const projectId = crypto.randomUUID();
  const replacements = new Map();
  for (const asset of [...source.assets.equipment, ...source.assets.textures, ...source.assets.custom]) {
    if (typeof asset?.id !== "string" || !asset.id || replacements.has(asset.id)) throw new Error("첨부 자산의 ID가 올바르지 않습니다.");
    replacements.set(asset.id, `import-${crypto.randomUUID()}`);
  }
  function rewrite(value) {
    if (typeof value === "string") {
      if (replacements.has(value)) return replacements.get(value);
      const customId = getCustomAssetIdFromTemplate(value);
      return customId && replacements.has(customId) ? value.replace(customId, replacements.get(customId)) : value;
    }
    if (value instanceof Blob) return value;
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [replacements.get(key) ?? key, rewrite(child)]));
    return value;
  }
  const bundle = rewrite(source);
  const ids = Object.fromEntries(Object.entries(bundle.assets).map(([kind, assets]) => [kind, new Set(assets.map((asset) => asset.id))]));
  visit([bundle.project.layout, bundle.rois, ...bundle.assets.custom], (node) => {
    if ((node.sourceType === "UPLOAD" && !ids.equipment.has(node.assetId)) || (node.textureAssetId && !ids.textures.has(node.textureAssetId))
      || (node.customAssetId && !ids.custom.has(node.customAssetId)) || Object.values(node).some((value) => {
        const id = typeof value === "string" && getCustomAssetIdFromTemplate(value);
        return id && !ids.custom.has(id);
      })) throw new Error("설정에 연결된 모델 또는 텍스처가 구성 파일에 빠져 있습니다.");
  });
  const written = [];
  const oldRois = storage.getItem(roiStorageKey(projectId));
  try {
    for (const [kind, repository] of [["equipment", equipmentAssetRepository], ["textures", textureAssetRepository], ["custom", customAssetRepository]]) {
      for (const asset of bundle.assets[kind]) {
        if ((kind === "equipment" && (!asset.files?.length || asset.files.some((entry) => !(entry.blob instanceof Blob))))
          || (kind === "textures" && !(asset.blob instanceof Blob))) throw new Error("첨부된 모델·텍스처 파일이 손상되었습니다.");
        written.push({ kind, repository, id: asset.id });
        onProgress(`파일 저장 중 · ${asset.id}`);
        if (kind === "custom") await repository.save(asset); else await repository.put(asset);
      }
    }
    const layout = bundle.project.layout;
    if (source.version === 1) {
      const existingPoints = layout.observationConfig?.observationPoints ?? layout.observationPoints ?? [];
      const additions = bundle.rois.filter((roi) => isObservationRoi(roi) && !existingPoints.some((point) => point.id === roi.id)).map(roiToObservationPoint);
      layout.observationPoints = [...existingPoints, ...additions];
      if (layout.observationConfig) layout.observationConfig.observationPoints = layout.observationPoints;
    }
    const pointIds = new Set((layout.observationConfig?.observationPoints ?? layout.observationPoints ?? []).map((point) => point.id));
    storage.setItem(roiStorageKey(projectId), JSON.stringify(bundle.rois.filter((roi) => !pointIds.has(roi.id))));
    // The existing active editor document is left intact. Publish last, only
    // after all dependencies have been imported successfully.
    storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...registry, projects: [...registry.projects, { ...bundle.project, id: projectId, storageMode: "LOCAL" }] }));
  } catch (error) {
    for (const { kind, repository, id } of written.reverse()) {
      try { if (kind === "custom") await repository.delete(id); else await repository.remove(id); } catch { /* Preserve the original failure. */ }
    }
    if (oldRois === null) storage.removeItem(roiStorageKey(projectId)); else storage.setItem(roiStorageKey(projectId), oldRois);
    throw error;
  }
  window.dispatchEvent(new StorageEvent("storage", { key: roiStorageKey(projectId) }));
  return projectId;
}
