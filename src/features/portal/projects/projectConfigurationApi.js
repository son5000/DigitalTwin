const monitoringBase = (import.meta.env?.VITE_MONITORING_API_BASE || "").trim().replace(/\/+$/, "");
const configuredProjectBase = (import.meta.env?.VITE_PROJECT_API_BASE || "").trim().replace(/\/+$/, "");
export const projectApiBase = configuredProjectBase
  || (monitoringBase.endsWith("/api/fe/v1") ? `${monitoringBase.slice(0, -"/api/fe/v1".length)}/api/v1` : "");

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

export function createProjectConfigurationPayload(layout, baseRevision = 0, assetManifest = []) {
  if (!isRecord(layout) || layout.version !== 18 || !Array.isArray(layout.hierarchy?.nodes)) {
    throw new Error("저장할 프로젝트 구성을 확인해 주세요.");
  }
  if (!Number.isInteger(baseRevision) || baseRevision < 0) throw new Error("기준 프로젝트 버전을 확인해 주세요.");
  if (new Blob([JSON.stringify(layout)]).size > 1024 * 1024) {
    throw new Error("서버의 구성 크기 제한은 1MiB입니다. 큰 이미지나 스캔은 별도 자산 등록이 필요합니다.");
  }
  if (!Array.isArray(assetManifest) || assetManifest.some((asset) => !isRecord(asset)
    || typeof asset.asset_id !== "string" || !asset.asset_id || !/^[a-f0-9]{64}$/i.test(asset.manifest_sha256 ?? "")
    || (asset.kind != null && !["NATIVE_BUNDLE", "DISPLAY_ASSET"].includes(asset.kind))
    || (asset.kind === "NATIVE_BUNDLE" && !/^[a-f0-9]{64}$/i.test(asset.archive_sha256 ?? "")))
    || new Set(assetManifest.map((asset) => asset.asset_id)).size !== assetManifest.length) throw new Error("저장할 자산 명세를 확인해 주세요.");
  return { baseRevision, layout, assetManifest, clientRequestId: crypto.randomUUID() };
}

export async function projectRequest(path, options = {}) {
  if (!projectApiBase) throw new Error("프로젝트 API 주소가 설정되지 않았습니다.");
  const { timeout, ...requestOptions } = options;
  const response = await fetch(`${projectApiBase}${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...requestOptions,
    signal: requestSignal(options.signal, timeout),
    headers: { ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message || (response.status === 401 || response.status === 403
      ? "프로젝트 접근 권한을 확인해 주세요."
      : response.status === 409 || response.status === 412
        ? "서버의 프로젝트 버전 또는 게시 상태가 변경되었습니다."
        : `프로젝트 서버 요청에 실패했습니다 (${response.status}).`);
    const error = new Error(message);
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  if (response.status === 204) return null;
  if (!isRecord(body) || !isRecord(body.data)) throw new Error("서버의 프로젝트 응답 형식을 확인해 주세요.");
  return body.data;
}

export async function createBackendProject(externalProjectId, layout, signal) {
  assertProjectId(externalProjectId);
  const result = await projectRequest("/projects", {
    method: "POST", signal,
    body: JSON.stringify({ name: layout.name?.trim() || "새 프로젝트", scope: layout.observationWorkflow?.scopeType || "SITE",
      externalProjectId, clientRequestId: crypto.randomUUID() }),
  });
  if (typeof result?.project?.id !== "string" || !result.project.id
    || result.project.externalProjectId != null && result.project.externalProjectId !== externalProjectId) {
    throw new Error("서버의 프로젝트 생성 결과를 확인할 수 없습니다.");
  }
  return result.project;
}

export async function saveProjectConfiguration(projectId, layout, signal, baseRevision = 0, assetManifest = []) {
  assertProjectId(projectId);
  const result = await projectRequest(`/projects/${encodeURIComponent(projectId)}/draft`, {
    method: "PUT", signal, body: JSON.stringify(createProjectConfigurationPayload(layout, baseRevision, assetManifest)),
  });
  if (result?.projectId !== projectId || !Number.isInteger(result.revision) || result.revision <= baseRevision) {
    throw new Error("서버의 프로젝트 저장 결과를 확인할 수 없습니다.");
  }
  return result;
}

export async function publishProjectConfiguration(projectId, revision, signal) {
  assertProjectId(projectId);
  if (!Number.isInteger(revision) || revision < 1) throw new Error("게시할 프로젝트 버전을 확인해 주세요.");
  const path = `/projects/${encodeURIComponent(projectId)}`;
  const validation = await projectRequest(`${path}/validate`, { method: "POST", signal, body: JSON.stringify({ revision }) });
  if (validation?.valid !== true) throw new Error(`서버 게시 검증에 실패했습니다. ${validation?.issues?.[0]?.message || "구성과 자산을 확인해 주세요."}`);
  const result = await projectRequest(`${path}/publish`, {
    method: "POST", signal, body: JSON.stringify({ revision, clientRequestId: crypto.randomUUID() }),
  });
  if (result?.projectId !== projectId || result.publishedRevision !== revision) throw new Error("서버의 게시 결과를 확인할 수 없습니다.");
  return result;
}
