import { assertProjectId } from "./projectConfigurationApi.js";

export async function deleteProjectConfiguration(projectId, signal) {
  assertProjectId(projectId);
  if (signal?.aborted) throw new DOMException("프로젝트 삭제가 취소되었습니다.", "AbortError");
  throw new Error("현재 백엔드에는 프로젝트 삭제 API가 없습니다.");
}
