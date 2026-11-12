# 프로젝트 목록 조회 API

프론트 함수: [projectListApi.js](../src/features/portal/projects/projectListApi.js)의 `listProjectConfigurations`. DB 매핑은 [기존 설계안](frontend-configuration-database-design.md)에 따른 백엔드 구현 제안이다.

`GET /projects?limit=20&cursor={cursor}`는 `VITE_PROJECT_API_BASE`를 우선 사용하고 없으면 `VITE_MONITORING_API_BASE`를 사용한다. 첫 페이지는 cursor를 생략한다. 인증 쿠키는 같은 출처에만 전송하고 요청 제한 시간은 30초다.

## 요청·응답

프론트 함수 `listProjectConfigurations({ limit, cursor, signal })`는 기본 20개, 최대 100개를 요청한다. 서버는 로그인 사용자가 접근할 수 있는 프로젝트만 `updatedAt DESC, projectId DESC`로 정렬하고, 같은 조건의 다음 페이지를 위한 불투명한 `nextCursor`를 반환한다. 마지막 페이지는 `null`이다. 임의의 다른 사용자·현장 프로젝트 ID를 받아 목록에 섞지 않는다.

```json
{
  "schemaVersion": 1,
  "items": [
    {
      "projectId": "8d5df511-b7cd-441e-b56d-919e793c552e",
      "name": "제1공장 설비 관측",
      "status": "READY",
      "scopeType": "BUILDING",
      "updatedAt": "2026-11-12T03:10:01.000Z",
      "savedRevision": 3,
      "publishedRevision": 3,
      "thumbnailUrl": "https://api.example.com/assets/preview/72c8a990"
    },
    {
      "projectId": "3248c9ac-c2ca-4b6b-9212-85cd39b5e708",
      "name": "보일러실 초안",
      "status": "DRAFT",
      "scopeType": "SINGLE_EQUIPMENT",
      "updatedAt": "2026-11-11T08:40:00.000Z",
      "savedRevision": 1,
      "publishedRevision": null,
      "thumbnailUrl": null
    }
  ],
  "nextCursor": "opaque-next-page-token"
}
```

| 응답 값 | 의미 | 권장 테이블·컬럼 |
| --- | --- | --- |
| `schemaVersion` | 목록 응답 계약 버전 1 | API 고정값. 프로젝트별 스키마 버전과 구분 |
| `items[].projectId/name/status/scopeType` | 카드 식별자·제목·초안/완료·관측 범위 | `dt_project.project_id/name/status/scope_type` (`ACTIVE` 저장 시 응답은 `READY`로 변환) |
| `items[].updatedAt` | 서버가 확정한 마지막 저장 시각 | `dt_project.updated_at` |
| `items[].savedRevision` | 가장 최근 저장된 구성 번호 | `dt_project.saved_revision_id` → `dt_project_revision.revision_no` |
| `items[].publishedRevision` | 고객 뷰어에 공개된 구성 번호; 없으면 null | `dt_project.published_revision_id` → `dt_project_revision.revision_no` |
| `items[].thumbnailUrl` | 대표 이미지의 절대 HTTPS 조회 URL; 없으면 null | `dt_project.representative_asset_version_id` → `dt_asset_version`/PREVIEW `dt_asset_file`; DB에는 만료 URL 대신 저장소 키 보관 |
| `nextCursor` | 다음 페이지 시작 위치; 마지막은 null | 정렬 기준 `updated_at + project_id`를 서버가 인코딩. 별도 컬럼 불필요 |

목록 응답에는 `worldDocument`, 모델 Blob, 센서 값이 없다. `ProjectsPage`는 서버 목록을 페이지별로 조회해 서버에만 있는 프로젝트도 카드로 표시한다. 공개 revision이 있는 카드는 [뷰어 진입 API](project-viewer-api.md)로 연다. 로컬 프로젝트의 편집·ZIP 내보내기는 기존 로컬 데이터로 유지하며, 서버에만 있는 프로젝트는 이 요약 API만으로 편집하거나 ZIP으로 내보내지 않는다. 이를 지원하려면 저장본 전체를 내려주는 별도 편집 API가 필요하다.

