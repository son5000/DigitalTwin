# 프로젝트 구성 저장 API

프론트 함수: [projectConfigurationApi.js](../src/features/portal/projects/projectConfigurationApi.js)의 `saveProjectConfiguration`. 호출 화면: [DigitalTwinEditorPage.jsx](../src/features/digitalTwin/editor/DigitalTwinEditorPage.jsx). DB 매핑은 [기존 설계안](frontend-configuration-database-design.md)에 따른 백엔드 구현 제안이다.

`PUT /projects/{projectId}/configuration`은 에디터 저장 버튼에서 로컬 저장 후 호출한다. `VITE_PROJECT_API_BASE`를 우선 사용하고 없으면 `VITE_MONITORING_API_BASE`를 사용한다. 둘 다 없으면 로컬에만 저장한다. 실패하면 편집 화면을 유지한다. 인증 쿠키는 같은 출처에만 전송하고 요청 제한 시간은 30초다. 저장 API JS 파일의 공통 요청 처리를 [목록 API](project-list-api.md)와 [뷰어 진입 API](project-viewer-api.md)가 재사용한다.

업로드 모델·텍스처·커스텀 에셋이 있으면 저장 버튼은 먼저 [프로젝트 자산 API](project-asset-api.md)로 파일 묶음을 업로드한다. 그 응답의 `assetUploadId`를 이 PUT 요청에 포함한다. 내장 모델만 사용한 프로젝트에서는 이 필드를 생략한다.

## 백엔드로 보내는 값 예시

건물 1동, 1층, 펌프 1개를 저장하는 **축약 예시**다. 실제 요청에는 `saveLayout()`이 직렬화한 지형, 도면, 공간 장면, 설비 설정 등 전체 필드가 들어간다. 백엔드는 예시에 없는 필드도 버리지 않고 왕복 보존해야 한다. 길이·좌표는 기존 월드 단위인 m, 회전은 rad이다.

```json
{
  "schemaVersion": 1,
  "requestId": "c89b7f61-d12f-40bd-83a4-c4a272fe3178",
  "projectId": "8d5df511-b7cd-441e-b56d-919e793c552e",
  "savedAt": "2026-11-12T03:10:00.000Z",
  "project": {
    "name": "제1공장 설비 관측",
    "status": "READY",
    "scopeType": "BUILDING",
    "observationWorkflow": {
      "configured": true,
      "scopeType": "BUILDING",
      "activeStepIds": ["COMPOSITION", "FLOOR_AND_EQUIPMENT", "MONITORING"],
      "viewerSettings": {
        "mode": "BUILDING_FOCUS",
        "focusBuildingId": "BUILDING_A",
        "equipmentIds": ["FLOOR_EQUIPMENT_A"],
        "activeEquipmentId": "FLOOR_EQUIPMENT_A"
      }
    },
    "representativeImage": null
  },
  "worldDocument": {
    "version": 18,
    "savedAt": "2026-11-12T03:10:00.000Z",
    "hierarchy": {
      "rootId": "SITE_MAIN",
      "selectedNodeId": "BUILDING_A",
      "activeRoomId": null,
      "nodes": [
        { "id": "SITE_MAIN", "type": "SITE", "name": "메인 부지", "parentId": null },
        { "id": "BUILDING_A", "type": "BUILDING", "name": "제1공장", "parentId": "SITE_MAIN", "position": { "x": 0, "y": 0, "z": 0 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "parameters": { "width": 24, "depth": 16, "floorCount": 1, "floorHeight": 3.6 } },
        { "id": "FLOOR_A", "type": "FLOOR", "name": "1층", "parentId": "BUILDING_A" }
      ]
    },
    "siteEnvironment": { "width": 120, "depth": 90, "sizeMode": "CUSTOM", "autoFitBuildingId": null, "terrain": {} },
    "sitePaths": [],
    "siteObjects": [],
    "gridSettings": {},
    "roomScenes": {},
    "floorPlansById": {},
    "verticalStructuresByBuildingId": {},
    "equipmentByFloorId": {
      "FLOOR_A": [
        { "id": "FLOOR_EQUIPMENT_A", "floorId": "FLOOR_A", "name": "순환 펌프 01", "sourceTemplateId": "PUMP", "position": { "x": 2, "y": 0, "z": 1 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "dimensions": { "width": 1.3, "height": 0.9, "depth": 0.8 }, "visible": true }
      ]
    }
  },
  "viewerPreset": {
    "version": 1,
    "camera": null,
    "lighting": { "ambient": 2.1, "key": 2.4, "fill": 0.7 },
    "visibility": {},
    "filters": {},
    "floorSettings": {},
    "equipmentRepresentation": { "globalMode": "AUTO", "overrides": {}, "autoDetailDistance": 12 }
  },
  "observationConfig": {
    "equipmentAssetBindings": [],
    "sensorBindings": [
      { "id": "SENSOR_BINDING_A", "equipmentIds": ["FLOOR_EQUIPMENT_A"], "serverSensorId": "42", "serverKey": "factory-1-pump-temp", "serialNumber": "TEMP-001", "position": { "x": 2, "y": 1.2, "z": 1 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "fieldOfView": 50, "observationPointIds": ["OBSERVATION_POINT_A"] }
    ],
    "observationPoints": [
      { "id": "OBSERVATION_POINT_A", "equipmentId": "FLOOR_EQUIPMENT_A", "name": "펌프 표면 온도", "geometryType": "SPHERE", "radius": 0.15, "localPosition": { "x": 0, "y": 0.4, "z": 0 }, "measurements": [
        { "id": "ROI_VALUE_A", "name": "온도", "metric": "TEMPERATURE", "unit": "°C", "sensorId": "SENSOR_BINDING_A", "visible": true }
      ] }
    ],
    "serverBindings": []
  }
}
```

## 값의 의미와 테이블·컬럼 연결

최소 백엔드 구현은 `dt_project`에 검색용 메타데이터를, `dt_project_revision.snapshot_json`에 **요청 전체**를 저장한다. `dt_project.saved_revision_id`는 최신 저장본, `published_revision_id`는 뷰어 공개본을 가리킨다. 이 스냅샷이 GET의 원본이므로 아직 정규화하지 않은 필드도 복원할 수 있다. 아래 세부 테이블은 검색이나 FK가 필요할 때 **같은 트랜잭션에서** 투영한다.

| 요청 값 | 의미 | 권장 테이블.컬럼 |
| --- | --- | --- |
| `projectId` | 프로젝트의 안정적인 ID | `dt_project.project_id`; 하위 테이블의 `project_id` |
| `requestId` | 같은 저장 요청의 중복 처리 방지 UUID | `dt_project_revision.request_id` (프로젝트별 UNIQUE) |
| `assetUploadId` (선택) | 이번 revision에 고정할 업로드 파일 묶음 | `dt_project_revision.asset_upload_id` → 자산 업로드 레코드 |
| `schemaVersion` | API 본문 버전 1 | `dt_project.schema_version`, `dt_project_revision.schema_version` |
| `savedAt` | 브라우저 저장 시각; 서버 확정 시각은 아님 | `dt_project_revision.snapshot_json.savedAt`; 서버 시각은 `created_at` |
| `project.name` | 화면에 보이는 프로젝트 이름 | `dt_project.name` |
| `project.status` | `DRAFT` 초안 / `READY` 최종 저장 | `dt_project.status`; 기존 설계안의 `ACTIVE`를 쓰면 API에서 `READY ↔ ACTIVE` 변환 |
| `project.scopeType` | SITE/BUILDING/SINGLE_EQUIPMENT/MULTI_EQUIPMENT/CUSTOM | `dt_project.scope_type` |
| `project.observationWorkflow` | 관측 모드, 편집 단계, 선택 건물·설비 ID | `dt_project.workflow_json` |
| `project.representativeImage` | 대표 이미지 data URL 또는 null | 파일 저장 후 `dt_project.representative_asset_version_id` → `dt_asset_version.asset_version_id`; 원본 요청은 snapshot |
| `worldDocument.version` | 기존 로컬 레이아웃 버전(현재 18); API 버전과 별개 | `dt_project_revision.snapshot_json.worldDocument.version` |
| `worldDocument.hierarchy.nodes[]` | 부지·건물·층·공간의 ID·부모·이름·Transform | `dt_scene_node.node_id/parent_node_id/node_kind/name/pos_*/rot_*/parameters_json` |
| `worldDocument.siteEnvironment/gridSettings` | 부지 크기, 지면·지형, 격자 | `dt_scene_settings.width_m/depth_m/size_mode/ground_json/terrain_json/grid_json` |
| `worldDocument.sitePaths/siteObjects` | 도로와 부지 독립 오브젝트 | `dt_scene_node`의 PATH/SITE_OBJECT 행과 `parameters_json` |
| `worldDocument.floorPlansById/verticalStructuresByBuildingId/roomScenes` | 층 도면·계단·벽·공간 내부 장면 | 소속 `dt_scene_node.parameters_json`; 원형은 snapshot |
| `worldDocument.equipmentByFloorId[floorId][]` | 층 설비의 ID·템플릿·위치·회전·크기 | `dt_scene_node` EQUIPMENT 행; `parent_node_id=floorId`, `builtin_template_code`, `pos_*/rot_*/parameters_json` |
| `viewerPreset.camera/equipmentViews` | 기본 및 설비별 저장 시점 | `dt_camera_preset.position_json/target_json/up_json/fov_deg/zoom`; 기본 시점은 `dt_viewer_settings.default_camera_id` |
| `viewerPreset.visibility/filters/floorSettings/equipmentRepresentation` | 표시·필터·층·모델 표현 방식 | `dt_viewer_settings.visibility_json/floor_display_json/representation_json`; 나머지 키는 snapshot |
| `observationConfig.equipmentAssetBindings[]` | 설비와 상세 모델·정렬·표시 방식의 연결 | 서버 자산 등록 후 `dt_object_visual.node_id/asset_version_id/alignment_json/display_mode`, 파일은 `dt_asset_version`·`dt_asset_file` |
| `observationConfig.sensorBindings[]` | 화면 센서 ID·대상 설비·투사 설정 | `dt_sensor_visual.sensor_visual_id/node_id/marker_json/projection_json`; 실제 센서는 기존 sensor/slot 테이블과 연결 |
| `observationConfig.observationPoints[]` | 설비별 3D 관측 영역과 측정 항목 | `dt_spatial_roi.spatial_roi_id/node_id/geometry_json`; 항목별 `dt_roi_metric_binding.measurement_id/metric_key/display_unit` |
| `observationConfig.serverBindings[]` | 서버 데이터 키와 화면 대상을 잇는 초안 | 우선 `dt_project_revision.snapshot_json.observationConfig.serverBindings`; 확정된 센서·지표 FK는 별도 매핑 |
| 요청 전체 + 서버 revision | 원형 보존 및 복원 | `dt_project_revision.snapshot_json/revision_no` |

`saveLayout()`은 구형 루트 별칭(`sensorBindings` 등)도 만들지만 API는 이를 제거하고 `observationConfig`만 전송한다. 백엔드는 루트 별칭을 따로 적재할 필요가 없다.

예시에서 `SENSOR_BINDING_A`는 `dt_sensor_visual.sensor_visual_id`, `equipmentIds[0]`은 대상 `node_id`, `serverSensorId="42"`는 기존 서버 센서·slot을 찾는 키다. `position/rotation/fieldOfView`는 센서 표시 또는 미확정 보정 초안이며, 실측 자세 원본으로 덮어쓰지 않는다. `OBSERVATION_POINT_A`는 `dt_spatial_roi.spatial_roi_id`, `radius/localPosition`은 `geometry_json`; `ROI_VALUE_A`는 `dt_roi_metric_binding.measurement_id`, `metric/unit`은 승인된 `metric_key/display_unit`으로 변환한다. `sensorId`는 서버 센서 ID "42"가 아니라 **프론트 센서 바인딩 ID**다.

## 응답·저장 규칙

- PUT 성공: `{"projectId":"8d5df511-b7cd-441e-b56d-919e793c552e","revision":3,"savedAt":"2026-11-12T03:10:01.000Z"}`. 프론트는 ID 일치와 양의 정수 revision을 확인한다. 서버는 같은 `projectId + requestId`를 중복 저장하지 않고 동일 revision을 반환한다.
- `DRAFT`는 `saved_revision_id`만 갱신한다. `READY`가 공개 조건을 충족하면 해당 revision을 `published_revision_id`로 지정한다. 파일·참조가 준비되지 않았다면 공개하지 않는다.
- 401/403은 권한, 409/412는 충돌, 422는 잘못된 구성·미등록 자산 등의 검증 실패로 구분한다. 프로젝트와 하위 행·revision·공개 포인터는 한 DB 트랜잭션에서 확정한다.

## 이번 API의 경계

- JSON에는 OBJ/PLY/MTL/텍스처 Blob이 없다. 프론트는 별도 자산 ZIP을 먼저 올린다. 서버는 `assetUploadId`의 자산 ID가 이 프로젝트의 `worldDocument`와 `observationConfig` 참조를 모두 충족하는지 검사하고, 미등록 자산을 포함한 `READY` 요청은 거부해야 한다.
- 대표 이미지는 현재 data URL이 들어갈 수 있다. 백엔드는 크기를 제한하고 이미지 자산으로 분리해야 한다. `blob:` URL은 저장하지 않는다.
- 현재 프론트 PUT에는 직전 서버 revision/`If-Match`가 없다. 여러 사용자의 동시 편집 충돌 방지는 추후 최신 revision 조회·전송이 필요하다.
- 서버는 자산 업로드 레코드와 공개 revision의 연결을 원자적으로 확정해야 한다. 실제 백엔드·DB 구현은 이 프론트 작업의 범위 밖이다.
