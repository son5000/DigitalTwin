import { customAssetRepository } from "@/features/customAssets/storage/customAssetRepository";
import { setRuntimeCustomAssets } from "@/features/customAssets/core/customAssetRegistry";
import { equipmentAssetRepository } from "@/features/digitalTwin/editor/api/equipmentAssetRepository";
import { textureAssetRepository } from "@/features/digitalTwin/editor/api/textureAssetRepository";
import { assertProjectId, projectApiBase } from "./projectConfigurationApi.js";
import { collectProjectAssetIds, createProjectAssetArchive } from "./projectBundle.js";
import { decodeProjectFile } from "./projectBundleFiles.js";

function assetSignal(signal) {
  const timeout = AbortSignal.timeout(600000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function assetPath(projectId, revision) {
  const path = `/projects/${encodeURIComponent(projectId)}/assets`;
  return revision ? `${path}?revision=${revision}` : path;
}

export async function uploadProjectAssets(projectId, layout, signal) {
  assertProjectId(projectId);
  if (!projectApiBase) throw new Error("프로젝트 API 주소가 설정되지 않았습니다.");
  const archive = await createProjectAssetArchive(projectId, layout);
  if (!archive) return null;
  const response = await fetch(`${projectApiBase}${assetPath(projectId)}`, {
    method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/zip" },
    body: archive, signal: assetSignal(signal),
  });
  if (!response.ok) throw new Error(`프로젝트 파일을 서버에 저장하지 못했습니다 (${response.status}).`);
  const result = await response.json();
  if (result?.projectId !== projectId || typeof result.assetUploadId !== "string" || !result.assetUploadId) {
    throw new Error("서버의 프로젝트 파일 저장 결과를 확인할 수 없습니다.");
  }
  return result.assetUploadId;
}

export async function loadViewerProjectAssets(projectId, revision, layout, signal) {
  assertProjectId(projectId);
  if (!Number.isInteger(revision) || revision < 1) throw new Error("뷰어 버전을 확인해 주세요.");
  const response = await fetch(`${projectApiBase}${assetPath(projectId, revision)}`, {
    credentials: "same-origin", signal: assetSignal(signal),
  });
  const required = collectProjectAssetIds(layout);
  if (response.status === 204) {
    if (Object.values(required).some((ids) => ids.size)) throw new Error("공개된 뷰어의 모델 파일이 누락되었습니다.");
    return;
  }
  if (!response.ok) throw new Error(`뷰어 파일을 불러오지 못했습니다 (${response.status}).`);
  if (response.headers.get("X-Project-Revision") !== String(revision)) throw new Error("뷰어 구성과 파일 버전이 일치하지 않습니다.");
  const archive = await decodeProjectFile(await response.blob(), () => {});
  if (archive?.format !== "digital-twin-assets" || archive.version !== 2 || archive.projectId !== projectId
    || ![archive.assets?.equipment, archive.assets?.textures, archive.assets?.custom].every(Array.isArray)) {
    throw new Error("서버의 뷰어 파일 형식을 확인할 수 없습니다.");
  }
  const ids = new Set();
  for (const asset of Object.values(archive.assets).flat()) {
    if (typeof asset?.id !== "string" || !asset.id || ids.has(asset.id)) throw new Error("뷰어 파일 ID가 올바르지 않습니다.");
    ids.add(asset.id);
  }
  if ([
    [required.equipmentIds, archive.assets.equipment],
    [required.textureIds, archive.assets.textures],
    [required.customIds, archive.assets.custom],
  ].some(([requiredIds, assets]) => [...requiredIds].some((id) => !assets.some((asset) => asset.id === id)))) {
    throw new Error("공개된 뷰어에 필요한 모델 또는 텍스처가 누락되었습니다.");
  }
  if (archive.assets.equipment.some((asset) => !asset.files?.length || asset.files.some((file) => !(file.blob instanceof Blob)))
    || archive.assets.textures.some((asset) => !(asset.blob instanceof Blob))) {
    throw new Error("뷰어 모델 또는 텍스처 파일이 손상되었습니다.");
  }
  if (signal?.aborted) return;
  for (const asset of archive.assets.equipment) await equipmentAssetRepository.put(asset);
  for (const asset of archive.assets.textures) await textureAssetRepository.put(asset);
  for (const asset of archive.assets.custom) await customAssetRepository.save(asset);
  if (archive.assets.custom.length) setRuntimeCustomAssets(await customAssetRepository.list());
}
