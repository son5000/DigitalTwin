# 프로젝트 삭제 API

2026-11-19: [projectDeleteApi.js](../../src/features/portal/projects/projectDeleteApi.js)에 `DELETE /api/v1/projects/{서버 UUID}` 호출을 구현했다. 요청 본문은 없다. 성공은 **204 No Content** 또는 200 `{request_id,data:{projectId,deleted:true}}`다. 잘못된 ID/삭제 확인값은 실패로 처리한다.

[ProjectsPage.jsx](../../src/features/portal/projects/ProjectsPage.jsx)는 서버 연결 프로젝트에 확인창과 프로젝트 삭제를 제공하며, 서버 성공 후에만 해당 서버와 연결된 이 브라우저 저장본·ROI를 제거한다. 실패하면 로컬 사본을 유지한다. 서버 성공 후 로컬 정리 실패 시 이를 구분해 알리고 같은 확인창의 재시도는 로컬 정리만 수행한다. 서버 ID가 없거나 API 미설정이면 로컬 삭제만 제공한다.

**백엔드의 실제 삭제 구현·배포는 확인되지 않았다.** 기존 백엔드 전달 문서에는 이 API가 없었다. 권한·논리 삭제·게시본 접근 차단·동시 저장 차단·공유 자산 유지·멱등 재삭제·오류 규칙은 [저장·게시·삭제 통합 계약 10절](../integration/project-save-publish-delete-handoff.md#10-신규-프로젝트-삭제-api)에 정의했다. 이 통합 문서 하나를 백엔드 개발자에게 전달한다.
