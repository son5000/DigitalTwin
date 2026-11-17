# 프로젝트 이어서 편집 API

프론트 구현: [projectEditApi.js](../src/features/portal/projects/projectEditApi.js), 호출 화면: [ProjectsPage.jsx](../src/features/portal/projects/ProjectsPage.jsx). 공통 규칙은 [API 대응표](backend-api-coverage.md)를 따른다.

`GET /api/v1/projects/{서버 UUID}?mode=editor`는 공개본과 별개로 **현재 초안**의 `data.project`를 읽는다. `id`, `revision`, 전체 `layout`(version 18), `assetManifest`를 검사한다. 에디터는 받은 revision을 다음 `PUT /projects/{id}/draft`의 `baseRevision`으로 사용한다. 로컬 프로젝트와 서버 UUID의 연결을 유지하고 다른 작업 문서는 삭제하지 않는다.

자산을 참조하지 않는 layout은 편집기로 복원된다. 서버 자산 manifest 또는 기존 업로드 자산이 있으면 현재 프론트에서 복원할 수 없어 오류를 표시한다. [자산 API](project-asset-api.md)의 형식 연결이 필요하다. 이전 프론트 제안의 `GET /projects/{id}/configuration`은 현재 백엔드 경로가 아니다.
