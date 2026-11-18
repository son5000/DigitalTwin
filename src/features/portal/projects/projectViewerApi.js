import { assertProjectId, isRecord, projectRequest } from "./projectConfigurationApi.js";
import { validateAssetManifest } from "./projectAssetTransport.js";

export function parseProjectConfiguration(result, projectId) {
  const project = result?.project;
  if (!isRecord(project) || project.id !== projectId
    || !Number.isInteger(project.revision) || project.revision < 1
    || !isRecord(project.layout)) {
    throw new Error("서버의 뷰어 구성 형식을 확인해 주세요.");
  }
  if (project.layout.version !== 18) throw new Error(`지원하지 않는 프로젝트 구성 버전입니다 (${project.layout.version ?? "누락"}). version 18 전체 저장본이 필요합니다.`);
  if (!Array.isArray(project.layout.hierarchy?.nodes)) throw new Error("서버 프로젝트에 공간·설비 구성(hierarchy.nodes)이 없습니다. 에디터의 전체 저장본으로 다시 게시해 주세요.");
  const layout = project.layout;
  const observationConfig = layout.observationConfig ?? {};
  return { projectId: project.id, externalProjectId: project.externalProjectId ?? project.id,
    revision: project.revision, assetManifest: validateAssetManifest(project.assetManifest ?? []),
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
