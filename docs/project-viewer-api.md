# 프로젝트 뷰어 진입 API

프론트 함수: [projectViewerApi.js](../src/features/portal/projects/projectViewerApi.js)의 `loadViewerProjectConfiguration`. 호출 화면: [ProjectViewerPage.jsx](../src/features/portal/projects/ProjectViewerPage.jsx). DB 매핑은 [기존 설계안](frontend-configuration-database-design.md)에 따른 백엔드 구현 제안이다.

`GET /projects/{projectId}/viewer`는 공개된 revision의 전체 구성을 조회한다. `VITE_PROJECT_API_BASE`를 우선 사용하고 없으면 `VITE_MONITORING_API_BASE`를 사용한다. 인증 쿠키는 같은 출처에만 전송하고 요청 제한 시간은 30초다.

조회한 revision의 업로드 파일은 [프로젝트 자산 API](project-asset-api.md)의 `GET /projects/{projectId}/assets?revision={revision}`으로 이어서 받는다. 두 응답의 revision이 일치해야 하며, 파일 복원이 끝난 후 뷰어를 렌더링한다.

## 진입 흐름·응답

프로젝트 카드의 **뷰어 열기**는 `/viewer?project={projectId}`로 이동한다. 원격 API가 설정되어 있고 로컬 ZIP으로 가져온 프로젝트가 아니면 `ProjectViewerPage`가 `loadViewerProjectConfiguration(projectId)`로 `GET /projects/{projectId}/viewer`를 호출한다. 응답을 기존 레이아웃 모양으로 복원해 `SavedWorldViewer`에 전달한다. 로딩·오류 화면과 요청 취소는 기존 뷰어 패턴을 따른다. 로컬 ZIP 프로젝트는 로컬 데이터를 사용한다. 별도 `VITE_PROJECT_API_BASE` 없이 기존 관측 서버만 사용한다면 새 경로의 404에 한해 종전 `GET /projects/{projectId}` 형식으로 되돌아간다.

GET 응답은 [저장 API의 PUT JSON 예시](project-configuration-api.md)에서 `requestId`를 빼고 `"revision": 3`을 추가한 **공개본 구성 전체**다. `project`, `worldDocument`, `viewerPreset`, `observationConfig` 값은 공개된 revision의 저장 시점 값을 그대로 반환한다. 백엔드는 월드·뷰어·관측 필드를 축약해 보내면 안 된다.

| 응답 값 | 뷰어에서 쓰는 의미 | 권장 테이블·컬럼 |
| --- | --- | --- |
| `projectId` | URL의 프로젝트 ID와 일치 확인 | `dt_project.project_id` |
| `schemaVersion` | API 응답 계약 1 | `dt_project_revision.schema_version` |
| `revision` | 실제로 열어 보여 주는 공개 버전 번호 | `dt_project.published_revision_id` → `dt_project_revision.revision_no` |
| `project.name/status/scopeType/observationWorkflow` | 화면 제목, 관측 모드, 시작 건물·설비 | `dt_project.name/status/scope_type/workflow_json`; 저장본에는 `snapshot_json.project` |
| `project.representativeImage` | 트리/카드 대표 이미지 | `dt_project.representative_asset_version_id` → `dt_asset_version`·`dt_asset_file`; 응답에는 접근 가능한 이미지 URL 또는 data URL |
| `worldDocument` | 부지·건축물·층·설비의 ID와 위치·형상 | `dt_project_revision.snapshot_json.worldDocument`; 정규화한 행은 `dt_scene_settings`·`dt_scene_node` 등 |
| `viewerPreset` | 카메라·가시성·층·설비 표현 방식 | `dt_project_revision.snapshot_json.viewerPreset`; 검색용 투영은 `dt_viewer_settings`·`dt_camera_preset` |
| `observationConfig` | 설비 자산·센서·관측 영역 연결 | `dt_project_revision.snapshot_json.observationConfig`; 참조 투영은 `dt_object_visual`·`dt_sensor_visual`·`dt_spatial_roi` 등 |

서버는 `published_revision_id`가 없거나 접근 권한이 없으면 404/403을 반환한다. 설정 API가 켜진 환경에서는 원격 조회 실패를 조용히 오래된 로컬 월드로 바꾸지 않는다. 응답의 `projectId`, `schemaVersion`, 양의 `revision`, `worldDocument.hierarchy.nodes` 및 세 구성을 프론트에서 검사한다. 뷰어 진입은 조회만 수행하며 새 revision이나 월드 오브젝트를 만들지 않는다.

서버가 해당 revision의 파일 ZIP 또는 자산이 없을 때 204를 제공해야 업로드된 OBJ/PLY/MTL·텍스처·커스텀 에셋까지 다른 브라우저에서 복원된다. 내장 카탈로그 모델은 기존 뷰어 리소스를 사용한다.

이 구성 API는 저장된 3D 장면을 여는 계약이다. 실시간 센서 측정값과 별도 ROI 목록은 기존 관측 API (`GET /projects/{projectId}/rois`, `GET /projects/{projectId}/rois/readings`)의 범위다. 다른 브라우저에서 이 데이터까지 동일하게 제공하려면 해당 API도 같은 프로젝트 ID로 구현해야 한다. 서버에만 있는 초안을 다시 편집하는 흐름은 별도 저장본 조회 API가 필요하다.

