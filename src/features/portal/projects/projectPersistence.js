import * as repository from "./projectRepository.js";
import * as configuration from "./projectConfigurationApi.js";
import { uploadProjectAssets } from "./projectAssetApi.js";
import { listProjectConfigurations } from "./projectListApi.js";

export const projectPersistenceDeps = { ...repository, ...configuration, uploadProjectAssets, listProjectConfigurations };

// Compare JSON values, not object insertion order. Arrays remain ordered.
export function sameProjectValue(a, b) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export async function persistImportedProject(localId, deps = projectPersistenceDeps, options = {}) {
  const { signal, storage = window.localStorage, onProgress = () => {} } = options;
  const project = deps.readProjects(storage).projects.find((item) => item.id === localId);
  if (!project) throw new Error("로컬 프로젝트를 찾을 수 없습니다.");
  let checkpoint = options.checkpoint ?? project.pendingSave;
  if (!checkpoint) {
    const serverProjectId = project.serverProjectId ?? (project.storageMode === "SERVER" ? project.id : null);
    const expectedRevision = project.savedRevision ?? (serverProjectId ? null : 0);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error("서버 편집본의 기준 버전을 먼저 확인하세요.");
    checkpoint = { localId, layout: structuredClone(project.layout), serverProjectId, expectedRevision, assetManifest: null };
  }
  if (checkpoint.localId !== localId) throw new Error("다른 프로젝트의 저장 작업입니다.");
  if (options.layout && !sameProjectValue({ ...checkpoint.layout, savedAt: null }, { ...options.layout, savedAt: null })) {
    throw new Error("이전 서버 저장이 아직 확인되지 않았습니다. 프로젝트 목록에서 이전 저장 결과를 확인한 뒤 다시 저장하세요.");
  }
  const remember = () => deps.setProjectPendingSave(localId, checkpoint, storage);
  try {
    signal?.throwIfAborted();
    // Reject an oversized layout before creating assets or a server project.
    if (deps.createProjectConfigurationPayload) deps.createProjectConfigurationPayload(checkpoint.layout, checkpoint.expectedRevision, checkpoint.assetManifest ?? []);
    // Persist intent before each HTTP mutation, including uncertain outcomes.
    remember();
    if (checkpoint.assetManifest === null) {
      onProgress("모델·텍스처를 서버에 저장하는 중입니다.");
      checkpoint.assetManifest = await deps.uploadProjectAssets(checkpoint.serverProjectId ?? localId, checkpoint.layout, signal);
      remember();
    }
    signal?.throwIfAborted();
    if (!checkpoint.serverProjectId && checkpoint.createAttempted) {
      onProgress("이전 프로젝트 생성 결과를 확인하는 중입니다.");
      let cursor = null;
      const matches = [], seen = new Set();
      do {
        const page = await deps.listProjectConfigurations({ cursor, limit: 100, signal });
        matches.push(...page.items.filter((item) => item.externalProjectId === localId));
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor)) throw new Error("서버 목록의 페이지 정보를 확인할 수 없습니다.");
        seen.add(cursor);
      } while (cursor);
      if (matches.length !== 1) throw new Error("이전 생성 결과가 확인되지 않았습니다. externalProjectId로 서버 확인이 필요합니다. 로컬 저장본은 유지됩니다.");
      checkpoint.serverProjectId = matches[0].projectId;
      // A recovered create may already have a draft: reconcile it below.
      checkpoint.draftAttempted = true;
      remember();
    }
    if (!checkpoint.serverProjectId) {
      onProgress("서버 프로젝트를 생성하는 중입니다.");
      checkpoint.createAttempted = true;
      remember();
      const created = await deps.createBackendProject(localId, checkpoint.layout, signal);
      checkpoint.serverProjectId = created.id;
      remember();
      if (created.revision !== 0 || created.externalProjectId !== localId) throw new Error("신규 프로젝트의 식별자·초기 버전이 일치하지 않습니다.");
    }
    deps.linkProjectServerId(localId, checkpoint.serverProjectId, storage);
    if (!checkpoint.saved && checkpoint.draftAttempted) {
      onProgress("서버 저장 결과와 버전을 대조하는 중입니다.");
      const { project: remote } = await deps.projectRequest(`/projects/${encodeURIComponent(checkpoint.serverProjectId)}?mode=editor`, { signal });
      if (remote?.id !== checkpoint.serverProjectId || !Number.isInteger(remote.revision)) throw new Error("서버 편집본의 버전을 확인할 수 없습니다.");
      if (remote.revision === checkpoint.expectedRevision + 1
        && sameProjectValue(remote.layout, checkpoint.layout) && sameProjectValue(remote.assetManifest ?? [], checkpoint.assetManifest)) {
        checkpoint.saved = { projectId: remote.id, revision: remote.revision };
        remember();
      } else if (remote.revision !== checkpoint.expectedRevision) {
        const error = new Error("서버 편집본이 변경되었습니다. 로컬 파일을 보관한 후 서버본을 열어 변경 내용을 확인하세요. 자동으로 덮어쓰지 않습니다.");
        error.code = "VERSION_CONFLICT";
        throw error;
      }
    }
    if (!checkpoint.saved) {
      signal?.throwIfAborted();
      checkpoint.draftAttempted = true;
      remember();
      onProgress("프로젝트 초안을 서버에 저장하는 중입니다.");
      checkpoint.saved = await deps.saveProjectConfiguration(checkpoint.serverProjectId, checkpoint.layout, signal,
        checkpoint.expectedRevision, checkpoint.assetManifest);
      remember();
    }
    deps.markProjectSavedRevision(localId, checkpoint.layout, checkpoint.saved.revision, storage, checkpoint.serverProjectId);
    deps.setProjectPendingSave(localId, null, storage);
    return { localImported: true, serverSaved: true, projectId: checkpoint.serverProjectId, revision: checkpoint.saved.revision };
  } catch (error) {
    error.importCheckpoint = checkpoint;
    throw error;
  }
}
