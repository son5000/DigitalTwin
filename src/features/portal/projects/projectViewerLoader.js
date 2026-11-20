import { PROJECT_STORAGE_KEY, readProjects } from "./projectRepository.js";
import { projectApiBase } from "./projectConfigurationApi.js";
import { loadViewerProjectConfiguration } from "./projectViewerApi.js";
import { loadViewerProjectAssets } from "./projectAssetApi.js";

export function findLocalViewerProject(projectId, storage = window.localStorage) {
  return readProjects(storage).projects.find((item) => item.id === projectId || item.serverProjectId === projectId);
}

export async function loadProjectForViewer(projectId, signal, storage = window.localStorage) {
  const local = findLocalViewerProject(projectId, storage);
  if (local && (!projectApiBase || local.storageMode !== "SERVER" || local.layout.savedAt !== local.serverSavedAt)) {
    return { ...local, storageMode: "LOCAL" };
  }
  try {
    const serverId = local?.serverProjectId ?? projectId;
    const result = await loadViewerProjectConfiguration(serverId, signal);
    await loadViewerProjectAssets(serverId, result.revision, result.layout, signal, result.assetManifest);
    signal?.throwIfAborted();
    const project = { id: local?.id ?? serverId, serverProjectId: serverId, externalProjectId: result.externalProjectId,
      layout: result.layout, revision: result.revision, savedRevision: result.revision, publishedRevision: result.revision,
      serverSavedAt: result.layout.savedAt, storageMode: "SERVER" };
    // Cache without changing the active editor or replacing unsynced edits.
    const latest = findLocalViewerProject(projectId, storage);
    if (latest && latest.layout.savedAt !== latest.serverSavedAt) return { ...latest, storageMode: "LOCAL" };
    const registry = readProjects(storage);
    storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ ...registry,
      projects: [...registry.projects.filter((item) => item.id !== project.id), project] }));
    return project;
  } catch (error) {
    signal?.throwIfAborted();
    if (local && ![401, 403, 404, 409, 410].includes(error.status)) return { ...local, storageMode: "LOCAL", localFallback: true };
    throw error;
  }
}
