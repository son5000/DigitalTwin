# 프로젝트 삭제 API

전달받은 백엔드 문서에는 `DELETE /api/v1/projects/{id}`가 없다. 프론트의 [projectDeleteApi.js](../src/features/portal/projects/projectDeleteApi.js)는 서버 삭제를 수행하지 않고 명시적 오류를 반환한다. [ProjectsPage.jsx](../src/features/portal/projects/ProjectsPage.jsx)는 서버 프로젝트의 삭제 버튼을 비활성화하며, 로컬 저장본은 확인 팝업 후 브라우저 저장소에서만 지운다. 서버 사본과 공개 링크는 유지된다.

서버 삭제를 제공하려면 백엔드에서 권한·게시본·연결 자산·실시간 매핑·복구 정책 및 응답 코드를 먼저 정의해야 한다. 그 계약이 나온 뒤 프론트가 확인 팝업의 삭제 범위와 요청을 연결한다. 과거 `DELETE /projects/{id}` 및 204 응답 설명은 프론트 제안이었으며 구현된 백엔드 계약이 아니다. 전체 대응은 [API 대응표](backend-api-coverage.md)를 참조한다.
