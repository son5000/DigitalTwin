import { isRecord, projectRequest } from "./projectConfigurationApi.js";

export async function listProjectConfigurations({ cursor = null, limit = 20, signal } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100
    || (cursor !== null && (typeof cursor !== "string" || !cursor))) {
    throw new Error("프로젝트 목록 조회 조건을 확인해 주세요.");
  }
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  const result = await projectRequest(`/projects?${query}`, { signal });
  if (result?.schemaVersion !== 1 || !Array.isArray(result.items)
    || (result.nextCursor !== null && typeof result.nextCursor !== "string")
    || result.items.some((item) => !isRecord(item)
      || typeof item.projectId !== "string" || !item.projectId
      || typeof item.name !== "string" || !item.name
      || !["DRAFT", "READY"].includes(item.status)
      || typeof item.scopeType !== "string" || !item.scopeType
      || typeof item.updatedAt !== "string" || !item.updatedAt
      || !Number.isInteger(item.savedRevision) || item.savedRevision < 1
      || (item.publishedRevision !== null
        && (!Number.isInteger(item.publishedRevision) || item.publishedRevision < 1))
      || (item.thumbnailUrl !== null && typeof item.thumbnailUrl !== "string"))) {
    throw new Error("서버의 프로젝트 목록 형식을 확인해 주세요.");
  }
  return result;
}
