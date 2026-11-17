# 프로젝트 목록 조회 API

프론트 구현: [projectListApi.js](../src/features/portal/projects/projectListApi.js), 호출 화면: [ProjectsPage.jsx](../src/features/portal/projects/ProjectsPage.jsx). 기본 주소와 공통 응답은 [API 대응표](backend-api-coverage.md)를 따른다.

`GET /api/v1/projects?limit=20&cursor={cursor}`는 `data.items[]`와 `data.nextCursor`를 반환한다. 첫 페이지의 cursor는 생략하고, 다음 페이지 버튼은 받은 `nextCursor`를 그대로 보낸다. 백엔드 문서에는 `search`, `status`, `scope` 필터도 있지만 현재 프론트 화면은 사용하지 않는다.

프론트는 각 항목의 서버 `id`, `name`, `scope`, 현재 `revision`, `publishedRevision`, `externalProjectId`를 읽는다. 백엔드의 `status`는 DRAFT이며 뷰어 공개 여부는 `publishedRevision`으로 판단한다. 로컬 저장본과 서버 목록은 서버 ID/외부 ID로 중복 카드를 피한다. 게시본이 없는 서버 카드는 이어서 편집만 제공한다.

서버 프로젝트 삭제 API는 백엔드 문서에 없다. 서버 카드의 삭제를 비활성화하고 로컬 저장본 삭제만 제공한다. 기존 `GET /projects` 프론트 제안에서 사용한 `schemaVersion`, `projectId`, `scopeType` 응답 계약은 현재 백엔드 원문이 아니다.
