> 이전 참고안 — 2026-11-20 분류. 아래 원문은 현재 프론트 구현 계약이 아니다. 실제 호출은 [프로젝트 생성·저장·게시 API](../../api/project-configuration-api.md)의 PUT /draft와 전체 layout 전송을 따른다. 백엔드 연결에는 [저장·게시·삭제 통합 계약](../../integration/project-save-publish-delete-handoff.md)을 사용한다.

# 프로젝트 저장·뷰어 조회 API 계약

## API

- `PUT /projects/{projectId}/configuration`: 에디터 최종 구성 저장
- `GET /projects/{projectId}/viewer`: 저장된 뷰어 구성 조회

저장 요청은 `{ schemaVersion, projectId, savedAt, project, worldDocument, viewerPreset, observationConfig }` 형식이다. 성공 응답은 `{ projectId, revision, savedAt }`이며 `revision`은 1 이상의 정수다. 조회 응답은 저장 요청과 같은 구성에 `revision`을 포함한다.

## 값과 권장 테이블

| 요청 값                                                             | 의미                                             | 권장 테이블                               |
| ------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| `projectId`, `project.name/status/scopeType`                        | 프로젝트 식별자·이름·상태·관측 범위              | `dt_project`                              |
| `project.observationWorkflow`                                       | 단계 진행 및 관측 범위 설정                      | `dt_project.workflow_json`                |
| `worldDocument.siteEnvironment/gridSettings`                        | 부지·지형·배경·격자                              | `dt_scene_settings`                       |
| `worldDocument.hierarchy/siteObjects/equipmentByFloorId/roomScenes` | 건축물·층·공간·설비 배치와 Transform             | `dt_scene_node`, 세부 값은 JSONB          |
| `worldDocument.floorPlansById/verticalStructuresByBuildingId`       | 도면·벽·문·계단 등 층 구조                       | `dt_scene_node` 또는 별도 JSONB           |
| `viewerPreset`                                                      | 시작 카메라, 가시성, 모델 표시 방식, 가상 카메라 | `dt_viewer_settings`, `dt_camera_preset`  |
| `observationConfig.equipmentAssetBindings`                          | 설비와 3D 자산 연결 및 정렬값                    | `dt_object_visual`, `dt_asset_version`    |
| `observationConfig.sensorBindings/serverBindings`                   | 설비-센서·서버 데이터 키 연결                    | `dt_sensor_visual` 및 기존 센서 테이블    |
| `observationConfig.observationPoints`                               | ROI·관측 위치·표시 규칙                          | `dt_spatial_roi`, `dt_roi_metric_binding` |
| 전체 요청 원본과 `revision`                                         | 특정 저장 시점 복원·충돌 확인                    | `dt_project_revision`                     |

OBJ/PLY/MTL/텍스처 Blob은 이 JSON API에 넣지 않는다. 기존 프로젝트 ZIP 업로드 또는 별도 자산 업로드 API로 저장하고, 위 구성에는 서버의 `assetId/sourceKey`만 기록한다.
