const configuredApiBase = import.meta.env?.VITE_PROJECT_API_BASE
  || import.meta.env?.VITE_MONITORING_API_BASE
  || "";

export const projectApiBase = configuredApiBase.trim().replace(/\/+$/, "");

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertProjectId(projectId) {
  if (typeof projectId !== "string" || !projectId.trim() || projectId !== projectId.trim()) {
    throw new Error("프로젝트 ID를 확인해 주세요.");
  }
}

function requestSignal(signal, timeout = 30000) {
  const timeoutSignal = AbortSignal.timeout(timeout);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function configurationPath(projectId) {
  return `/projects/${encodeURIComponent(projectId)}/configuration`;
}

export function createProjectConfigurationPayload(projectId, layout, assetUploadId = null) {
  assertProjectId(projectId);
  if (!isRecord(layout) || !Array.isArray(layout.hierarchy?.nodes)) {
    throw new Error("저장할 프로젝트 구성을 확인해 주세요.");
  }
  const currentObservationConfig = isRecord(layout.observationConfig) ? layout.observationConfig : {};
  const observationConfig = {
    ...currentObservationConfig,
    equipmentAssetBindings: currentObservationConfig.equipmentAssetBindings ?? layout.equipmentAssetBindings ?? [],
    sensorBindings: currentObservationConfig.sensorBindings ?? layout.sensorBindings ?? [],
    observationPoints: currentObservationConfig.observationPoints ?? layout.observationPoints ?? [],
    serverBindings: currentObservationConfig.serverBindings ?? layout.serverBindings ?? [],
  };
  const name = layout.name ?? "";
  const projectStatus = layout.projectStatus ?? "DRAFT";
  const observationWorkflow = layout.observationWorkflow ?? {};
  const viewerPreset = layout.viewerPreset ?? {};
  const representativeImage = layout.representativeImage ?? null;
  const worldDocument = { ...layout };
  ["name", "projectStatus", "observationWorkflow", "viewerPreset", "representativeImage",
    "equipmentAssetBindings", "sensorBindings", "observationPoints", "serverBindings", "observationConfig"]
    .forEach((key) => delete worldDocument[key]);
  return {
    schemaVersion: 1,
    requestId: crypto.randomUUID(),
    ...(assetUploadId ? { assetUploadId } : {}),
    projectId,
    savedAt: layout.savedAt ?? new Date().toISOString(),
    project: {
      name,
      status: projectStatus,
      scopeType: observationWorkflow.scopeType ?? "SITE",
      observationWorkflow,
      representativeImage,
    },
    worldDocument,
    viewerPreset,
    observationConfig,
  };
}

export async function projectRequest(path, options = {}) {
  if (!projectApiBase) throw new Error("프로젝트 API 주소가 설정되지 않았습니다.");
  const response = await fetch(`${projectApiBase}${path}`, {
    credentials: "same-origin",
    ...options,
    signal: requestSignal(options.signal),
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? "프로젝트 접근 권한을 확인해 주세요."
      : response.status === 409 || response.status === 412
        ? "서버의 프로젝트가 변경되었습니다. 최신 구성을 불러온 뒤 다시 저장해 주세요."
        : `프로젝트 서버 요청에 실패했습니다 (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export async function saveProjectConfiguration(projectId, layout, signal, assetUploadId = null) {
  const payload = createProjectConfigurationPayload(projectId, layout, assetUploadId);
  const result = await projectRequest(configurationPath(projectId), {
    method: "PUT",
    body: JSON.stringify(payload),
    signal,
  });
  if (result?.projectId !== projectId || !Number.isInteger(result.revision) || result.revision < 1) {
    throw new Error("서버의 프로젝트 저장 결과를 확인할 수 없습니다.");
  }
  return result;
}
