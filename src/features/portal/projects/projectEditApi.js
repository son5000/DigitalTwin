import { assertProjectId, projectRequest } from "./projectConfigurationApi.js";
import { parseProjectConfiguration } from "./projectViewerApi.js";
import { loadProjectAssets } from "./projectAssetApi.js";

export async function loadEditableProject(projectId, signal) {
  assertProjectId(projectId);
  const result = parseProjectConfiguration(
    await projectRequest(`/projects/${encodeURIComponent(projectId)}?mode=editor`, { signal }), projectId,
  );
  await loadProjectAssets(projectId, result.revision, result.layout, signal, result.assetManifest);
  if (signal?.aborted) throw new DOMException("프로젝트 열기가 취소되었습니다.", "AbortError");
  return result;
}
