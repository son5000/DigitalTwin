import { assertProjectId, projectRequest } from "./projectConfigurationApi.js";

export async function deleteProjectConfiguration(projectId, signal, request = projectRequest) {
  assertProjectId(projectId);
  if (signal?.aborted) throw new DOMException("프로젝트 삭제가 취소되었습니다.", "AbortError");
  const result = await request(`/projects/${encodeURIComponent(projectId)}`, { method: "DELETE", signal });
  if (result !== null && (result?.projectId !== projectId || result.deleted !== true)) {
    throw new Error("서버의 프로젝트 삭제 결과를 확인할 수 없습니다.");
  }
  return { projectId, deleted: true };
}
