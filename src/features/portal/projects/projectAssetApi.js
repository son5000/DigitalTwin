import { assertProjectId } from "./projectConfigurationApi.js";
import { collectProjectAssetIds } from "./projectBundle.js";

function assertBackendAssetsSupported(layout, assetManifest = []) {
  const required = collectProjectAssetIds(layout);
  if (assetManifest.length || Object.values(required).some((ids) => ids.size)) {
    throw new Error("현재 백엔드는 기존 OBJ/PLY/커스텀 자산 ZIP을 받지 않습니다. 이 프로젝트는 로컬 ZIP으로 보관하고 glTF/GLB 자산 연결을 준비해 주세요.");
  }
}

export async function uploadProjectAssets(projectId, layout, signal) {
  assertProjectId(projectId);
  if (signal?.aborted) throw new DOMException("프로젝트 저장이 취소되었습니다.", "AbortError");
  assertBackendAssetsSupported(layout);
  return [];
}

export async function loadProjectAssets(projectId, revision, layout, signal, assetManifest = []) {
  assertProjectId(projectId);
  if (!Number.isInteger(revision) || revision < 1) throw new Error("프로젝트 버전을 확인해 주세요.");
  if (signal?.aborted) throw new DOMException("프로젝트 열기가 취소되었습니다.", "AbortError");
  if (!Array.isArray(assetManifest)) throw new Error("서버의 자산 목록 형식을 확인해 주세요.");
  assertBackendAssetsSupported(layout, assetManifest);
}

export const loadViewerProjectAssets = loadProjectAssets;
