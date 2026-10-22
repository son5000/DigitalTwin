import { equipmentAssetRepository } from "../../digitalTwin/editor/api/equipmentAssetRepository";
import { textureAssetRepository } from "../../digitalTwin/editor/api/textureAssetRepository";
import { createRoiRepository, roiStorageKey } from "../../digitalTwin/editor/api/roiRepository";
import { customAssetRepository } from "../../customAssets/storage/customAssetRepository";
import { getCustomAssetIdFromTemplate } from "../../customAssets/core/customAssetTypes";
import { isSphereRoi, roiToObservationPoint, validateRoi } from "../../digitalTwin/editor/model/roiMonitoring";
import { PROJECT_STORAGE_KEY, readProjects } from "./projectRepository";

const MAX_BUNDLE_BYTES = 150 * 1024 * 1024;
function visit(value, callback) {
  if (!value || typeof value !== "object" || value instanceof Blob) return;
  callback(value);
  Object.values(value).forEach((child) => visit(child, callback));
}

async function encode(value, budget) {
  if (value instanceof Blob) {
    budget.bytes += value.size;
    if (budget.bytes > MAX_BUNDLE_BYTES / 1.5) throw new Error("첨부 파일 합계가 100MB를 넘습니다. 대용량 파일은 설치 담당자가 별도로 이관해야 합니다.");
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(value);
    });
    return { $binary: data };
  }
  if (Array.isArray(value)) { const items = []; for (const item of value) items.push(await encode(item, budget)); return items; }
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, child] of Object.entries(value)) if (key !== "objectUrl") result[key] = await encode(child, budget);
    return result;
  }
  return value;
}

function decode(value) {
  if (value && typeof value === "object" && "$binary" in value) {
    const match = /^data:([^;,]*);base64,([A-Za-z0-9+/=]*)$/.exec(value.$binary);
    if (!match) throw new Error("첨부 파일 형식이 올바르지 않습니다.");
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: match[1] });
  }
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decode(child)]));
  return value;
}

// Relative public assets travel with dist/. Uploaded assets and custom models
// are embedded here; external sensor/media URLs are explicitly inventoried.
export async function exportProjectBundle(project) {
  const equipmentIds = new Set(), textureIds = new Set(), customIds = new Set(), references = new Set();
  function collect(value) {
    visit(value, (node) => {
      if (node.sourceType === "UPLOAD" && node.assetId) equipmentIds.add(node.assetId);
      if (node.textureAssetId) textureIds.add(node.textureAssetId);
      if (node.customAssetId) customIds.add(node.customAssetId);
      if (node.objectUrl && !node.assetId) throw new Error("임시 업로드 파일이 있습니다. 파일을 정식 등록하고 프로젝트를 저장한 뒤 내보내세요.");
      Object.values(node).forEach((child) => {
        if (typeof child !== "string") return;
        const customId = getCustomAssetIdFromTemplate(child);
        if (customId) customIds.add(customId);
        if (/^https?:\/\//.test(child)) references.add(child);
      });
    });
  }
  collect(project.layout);
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
  const rois = await createRoiRepository(project.id).list(AbortSignal.timeout(15000));
  const bundle = await encode({ format: "digital-twin-project", version: 1, createdAt: new Date().toISOString(), project, rois, assets,
    externalReferences: [...references], requires: ["동일 버전의 뷰어 빌드(dist)", "공동 설정·감시·알림용 고객 서버"] }, { bytes: 0 });
  const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
  if (blob.size > MAX_BUNDLE_BYTES) throw new Error("설치 구성 파일이 150MB를 넘습니다. 대용량 파일은 별도로 이관하세요.");
  return blob;
}

export async function importProjectBundle(file, storage = window.localStorage) {
  if (file.size > MAX_BUNDLE_BYTES) throw new Error("150MB 이하의 구성 파일만 가져올 수 있습니다.");
  const source = JSON.parse(await file.text());
  if (source?.format !== "digital-twin-project" || source.version !== 1 || !source.project?.layout?.hierarchy
    || typeof source.project.id !== "string" || !Array.isArray(source.rois)
    || ![source.assets?.equipment, source.assets?.textures, source.assets?.custom].every(Array.isArray)) throw new Error("지원하는 디지털 트윈 구성 파일이 아닙니다.");
  source.rois.forEach(validateRoi);
  const registry = readProjects(storage);
  const projectId = registry.projects.some((project) => project.id === source.project.id) ? crypto.randomUUID() : source.project.id;
  const replacements = new Map();
  for (const asset of [...source.assets.equipment, ...source.assets.textures, ...source.assets.custom]) {
    if (!asset?.id || replacements.has(asset.id)) throw new Error("첨부 자산의 ID가 올바르지 않습니다.");
    replacements.set(asset.id, `import-${crypto.randomUUID()}`);
  }
  function rewrite(value) {
    if (typeof value === "string") {
      if (replacements.has(value)) return replacements.get(value);
      const customId = getCustomAssetIdFromTemplate(value);
      return customId && replacements.has(customId) ? value.replace(customId, replacements.get(customId)) : value;
    }
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child)]));
    return value;
  }
  const bundle = decode(rewrite(source));
  const written = [];
  const oldRois = storage.getItem(roiStorageKey(projectId));
  try {
    for (const [kind, repository] of [["equipment", equipmentAssetRepository], ["textures", textureAssetRepository], ["custom", customAssetRepository]]) {
      for (const asset of bundle.assets[kind]) {
        if ((kind === "equipment" && (!asset.files?.length || asset.files.some((entry) => !(entry.blob instanceof Blob))))
          || (kind === "textures" && !(asset.blob instanceof Blob))) throw new Error("첨부된 모델·텍스처 파일이 손상되었습니다.");
        if (kind === "custom") await repository.save(asset); else await repository.put(asset);
        written.push({ kind, repository, id: asset.id });
      }
    }
    const spheres = bundle.rois.filter(isSphereRoi).map(roiToObservationPoint);
    const layout = bundle.project.layout;
    const existingPoints = layout.observationConfig?.observationPoints ?? layout.observationPoints ?? [];
    const points = [...existingPoints.filter((point) => !spheres.some((sphere) => sphere.id === point.id)), ...spheres];
    layout.observationPoints = points;
    if (layout.observationConfig) layout.observationConfig.observationPoints = points;
    storage.setItem(roiStorageKey(projectId), JSON.stringify(bundle.rois.filter((roi) => !isSphereRoi(roi))));
    // The existing active editor document is left intact. Publish last, only
    // after all dependencies have been imported successfully.
    storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...registry, projects: [...registry.projects, { ...bundle.project, id: projectId }] }));
    window.dispatchEvent(new StorageEvent("storage", { key: roiStorageKey(projectId) }));
    return projectId;
  } catch (error) {
    for (const { kind, repository, id } of written.reverse()) {
      try { if (kind === "custom") await repository.delete(id); else await repository.remove(id); } catch { /* Preserve the original failure. */ }
    }
    if (oldRois === null) storage.removeItem(roiStorageKey(projectId)); else storage.setItem(roiStorageKey(projectId), oldRois);
    throw error;
  }
}
