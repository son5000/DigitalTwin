import { isRecord, projectRequest } from "./projectConfigurationApi.js";

export async function listProjectConfigurations({ cursor = null, limit = 20, signal } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100
    || (cursor !== null && (typeof cursor !== "string" || !cursor))) {
    throw new Error("프로젝트 목록 조회 조건을 확인해 주세요.");
  }
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  const result = await projectRequest(`/projects?${query}`, { signal });
  if (!Array.isArray(result?.items)
    || (result.nextCursor != null && typeof result.nextCursor !== "string")
    || result.items.some((item) => !isRecord(item)
      || typeof item.id !== "string" || !item.id
      || typeof item.name !== "string" || !item.name
      || typeof item.scope !== "string" || !item.scope
      || !Number.isInteger(item.revision) || item.revision < 0
      || (item.publishedRevision != null
        && (!Number.isInteger(item.publishedRevision) || item.publishedRevision < 1))
      || (item.externalProjectId != null && typeof item.externalProjectId !== "string"))) {
    throw new Error("서버의 프로젝트 목록 형식을 확인해 주세요.");
  }
  return { nextCursor: result.nextCursor ?? null, items: result.items.map((item) => ({
    projectId: item.id, externalProjectId: item.externalProjectId ?? null, name: item.name,
    scopeType: item.scope, savedRevision: item.revision, publishedRevision: item.publishedRevision ?? null,
    status: item.publishedRevision === item.revision ? "READY" : "DRAFT",
    updatedAt: item.updatedAt ?? item.createdAt ?? "", thumbnailUrl: item.thumbnailUrl ?? null,
  })) };
}
