import { assertProjectId, isRecord, projectRequest } from "./projectConfigurationApi.js";

export function parseProjectConfiguration(result, projectId) {
  const project = result?.project;
  if (!isRecord(project) || project.id !== projectId
    || !Number.isInteger(project.revision) || project.revision < 1
    || !isRecord(project.layout) || project.layout.version !== 18
    || !Array.isArray(project.layout.hierarchy?.nodes)) {
    throw new Error("서버의 뷰어 구성 형식을 확인해 주세요.");
  }
  const layout = project.layout;
  const observationConfig = layout.observationConfig ?? {};
  return { projectId: project.id, externalProjectId: project.externalProjectId ?? project.id,
    revision: project.revision, assetManifest: project.assetManifest ?? [],
    layout: { ...layout,
      equipmentAssetBindings: layout.equipmentAssetBindings ?? observationConfig.equipmentAssetBindings ?? [],
      sensorBindings: layout.sensorBindings ?? observationConfig.sensorBindings ?? [],
      observationPoints: layout.observationPoints ?? observationConfig.observationPoints ?? [],
      serverBindings: layout.serverBindings ?? observationConfig.serverBindings ?? [],
    } };
}

export async function loadViewerProjectConfiguration(projectId, signal) {
  assertProjectId(projectId);
  const result = await projectRequest(`/projects/${encodeURIComponent(projectId)}?mode=viewer`, { signal });
  return parseProjectConfiguration(result, projectId);
}
