import { assertProjectId, isRecord, projectRequest } from "./projectConfigurationApi.js";

export async function loadViewerProjectConfiguration(projectId, signal) {
  assertProjectId(projectId);
  const result = await projectRequest(`/projects/${encodeURIComponent(projectId)}/viewer`, { signal });
  if (result?.projectId !== projectId || result.schemaVersion !== 1
    || !Number.isInteger(result.revision) || result.revision < 1
    || !isRecord(result.project) || !isRecord(result.worldDocument)
    || !Array.isArray(result.worldDocument.hierarchy?.nodes)
    || !isRecord(result.viewerPreset) || !isRecord(result.observationConfig)) {
    throw new Error("서버의 뷰어 구성 형식을 확인해 주세요.");
  }
  const layout = {
    ...result.worldDocument,
    name: result.project.name ?? "",
    projectStatus: result.project.status ?? "READY",
    observationWorkflow: result.project.observationWorkflow ?? {},
    representativeImage: result.project.representativeImage ?? null,
    viewerPreset: result.viewerPreset,
    observationConfig: result.observationConfig,
    equipmentAssetBindings: result.observationConfig.equipmentAssetBindings ?? [],
    sensorBindings: result.observationConfig.sensorBindings ?? [],
    observationPoints: result.observationConfig.observationPoints ?? [],
    serverBindings: result.observationConfig.serverBindings ?? [],
  };
  return { ...result, layout };
}
