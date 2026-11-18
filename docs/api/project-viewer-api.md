# 프로젝트 뷰어 진입 API

프론트 구현: [projectViewerApi.js](../../src/features/portal/projects/projectViewerApi.js), 호출 화면: [ProjectViewerPage.jsx](../../src/features/portal/projects/ProjectViewerPage.jsx). 공통 규칙은 [API 대응표](../integration/backend-api-coverage.md)를 따른다.

`GET /api/v1/projects/{서버 UUID}?mode=viewer`는 **게시된 revision**의 `data.project`를 조회한다. 프론트는 `id`, `externalProjectId`, `revision`, 전체 `layout`(version 18), `assetManifest`를 검사하고 기존 뷰어 장면을 구성한다. 미게시 또는 손상된 게시본은 409이며 최신 초안으로 대체하지 않는다. 뷰어는 이 GET에서 프로젝트 데이터를 변경하지 않는다.

프로젝트 카드의 **뷰어 열기**와 설비별 직접 링크는 서버 UUID를 URL의 `project` 매개변수로 사용한다. 실시간 설비 매핑의 `projectId`에는 `externalProjectId`를 사용한다. 로컬 전용/ZIP 프로젝트는 기존 로컬 구성으로 연다.

자산은 `assetManifest`의 종류에 따라 기존 표시 자산 glTF/GLB 또는 신규 `NATIVE_BUNDLE` ZIP으로 복원한다. 파일 해시·의존성을 검사하며 누락된 hierarchy나 설비-자산 매핑은 오류로 표시한다. 신규 ZIP API는 백엔드 구현이 필요하다. 상세 계약은 [자산 API](project-asset-api.md), [백엔드 전달 문서](../integration/backend-viewer-asset-handoff.md)를 참조한다. 실시간 상태는 [뷰어 실시간 API](project-viewer-live-api.md)의 별도 경로다. 기존 `GET /projects/{id}/viewer`와 `GET /projects/{id}/assets?revision=...`는 현재 백엔드 경로가 아니다.
