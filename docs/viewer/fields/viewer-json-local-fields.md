# 뷰어 JSON 필드 사전 — local

기준: 2026-11-17, layout.version=18. [전체 계약과 DB 설계](../viewer-json-database-contract.md).

이 파일은 `node scripts/generate-viewer-field-reference.mjs`로 소스와 명시적 보충 사전에서 생성한다. 기본값 칸은 **현 프론트의 생성·정규화 식 원문**이다. 전달 값이 없을 때의 프론트 동작을 보여 주며 서버가 이 식으로 값을 덮어쓰라는 뜻이 아니다. `JSON (식 참조)`는 프론트가 스키마를 고정하지 않은 값으로, 식·하위 표·카탈로그를 함께 확인한다. 선택 기능의 키는 없을 수 있고, null/false/0/빈 배열과 누락은 서로 다르다.

모든 경로의 기본 저장 위치는 `dt_project_revision.layout_json`의 **동일 경로**다. 자산·로컬 상태는 각 표의 별도 위치를 따른다. `[]`는 배열 인덱스, `{id}`는 실제 ID, `*`는 임의 하위 키를 뜻한다. 각 표의 DB 컬럼 안에도 해당 객체의 모든 하위 키를 그대로 넣는다.

## SurfaceRoi

별도 ROI 저장소/API의 ROI. SPHERE/PLANE은 관측점과 변환되어 layout에 반영; 다른 표면 ROI는 별도 저장.

JSON 위치: `$rois[]`.

원본 저장: `dt_roi_record.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/roiMonitoring.js](../../../src/features/digitalTwin/editor/model/roiMonitoring.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | &#96;ROI_${crypto.randomUUID()}&#96; |
| `equipmentId` | string | equipmentId |
| `name` | string | "새 ROI" |
| `surface` | object | surface |
| `opacity` | number | .25 |
| `measurements` | array | ROI_METRICS.slice(0, 2).map((metric) => ({ id: crypto.randomUUID(), name: metric.label, metric: metric.id, unit: metric.unit, sensorId: "", visible: true, rules: [] })) |
| `measurements[].id` | string | crypto.randomUUID() |
| `measurements[].name` | string | metric.label |
| `measurements[].metric` | string | metric.id |
| `measurements[].unit` | string | metric.unit |
| `measurements[].sensorId` | string | "" |
| `measurements[].visible` | boolean | true |
| `measurements[].rules` | array | [] |
| `displayMetrics` | array | ["temperature.max", "temperature.min"] |
| `rules` | array | [] |
| `monitoringEnabled` | boolean | false |
| `revision` | number | 0 |

## ObservationRoi

관측점↔ROI 변환 외피. observationPoint에 원본 ObservationPoint 전체를 포함.

JSON 위치: `$rois[]`.

원본 저장: `dt_roi_record.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/roiMonitoring.js](../../../src/features/digitalTwin/editor/model/roiMonitoring.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | point.id |
| `equipmentId` | string | point.equipmentId |
| `name` | string | point.name |
| `revision` | number | point.revision ?? 0 |
| `surface` | object | { ...(point.geometryType === "PLANE" ? observationPlane(point) : { type: "SPHERE", center: [point.localPosition.x, point.localPosition.y, point.localPosition.z], radius: point.radius ?? .15 }), coordinateSpace: "EQUIPMENT_LOCAL", representation: point.representation ?? "BOTH", ...(point.model ? { model: point.model } : {}) } |
| `surface.type` | string | "SPHERE" |
| `surface.center` | array | [point.localPosition.x, point.localPosition.y, point.localPosition.z] |
| `surface.radius` | number | point.radius ?? .15 |
| `surface.coordinateSpace` | string | "EQUIPMENT_LOCAL" |
| `surface.representation` | string | point.representation ?? "BOTH" |
| `surface.model` | object | point.model |
| `opacity` | number | point.opacity ?? .25 |
| `measurements` | array | point.measurements ?? [] |
| `observationPoint` | object | point |
| `virtualCameraRegion` | object | point.virtualCameraRegion |
| `imageBinding` | object | point.imageBinding |
| `imageAnalysis` | object | point.imageAnalysis |
| `thermalBinding` | object | point.thermalBinding |
| `displayMetrics` | array | [] |
| `rules` | array | [] |
| `monitoringEnabled` | boolean | false |

## OperationsRoot

현재 별도 localStorage 상태. 프로젝트 JSON PUT과 별개이며 아직 자동 서버 저장 아님.

JSON 위치: `$operations`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/operationsModel.js](../../../src/features/portal/viewer/operationsModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `version` | number | 1 |
| `assets` | array | [] |
| `people` | array | [] |
| `tickets` | array | [] |
| `reports` | array | [] |
| `notifications` | array | [] |
| `profile` | object | {} |
| `preferences` | object | {} |

## OperationsRecord

record 원본을 보존하며 이력 추가. 공통 UI 필드는 다음 표.

JSON 위치: `$operations.{assets|people|tickets}[]`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/operationsModel.js](../../../src/features/portal/viewer/operationsModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | record |
| `id` | string | old?.id ?? record.id ?? crypto.randomUUID() |
| `createdAt` | string | old?.createdAt ?? now |
| `updatedAt` | string | now |

## OperationsReport

생성 시점의 자산·접수·알림 스냅샷. from/to YYYY-MM-DD.

JSON 위치: `$operations.reports[]`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/operationsModel.js](../../../src/features/portal/viewer/operationsModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | crypto.randomUUID() |
| `title` | string | title.trim() |
| `from` | string | from |
| `to` | string | to |
| `author` | string | author |
| `createdAt` | string | now |
| `assets` | array | structuredClone(assets) |
| `tickets` | array | structuredClone(data.tickets.filter(within)) |
| `notifications` | array | structuredClone(data.notifications.filter(within)) |

## Notification

알림 처리 상태와 이력. 동일 발생 sourceKey에 대한 중복 수신 방지.

JSON 위치: `$operations.notifications[]`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/operationsModel.js](../../../src/features/portal/viewer/operationsModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | item |
| `id` | string | crypto.randomUUID() |
| `sourceKey` | string | sourceKey |
| `createdAt` | string | Number.isNaN(Date.parse(item.time)) ? now : new Date(item.time).toISOString() |
| `status` | string | "미확인" |
| `history` | array | [{ at: now, actor: "시스템", action: "수신 기록" }] |
| `history[].at` | string | now |
| `history[].actor` | string | "시스템" |
| `history[].action` | string | "수신 기록" |

## RoiSurface

표면 ROI 지오메트리. 구·평면·표면 다각형 조건에 따라 값이 달라진다.

JSON 위치: `$rois[].surface`.

원본 저장: `dt_roi_record.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/roiMonitoring.js](../../../src/features/digitalTwin/editor/model/roiMonitoring.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `type` | string | SPHERE/PLANE 또는 표면 ROI 타입 |
| `coordinateSpace` | string | EQUIPMENT_LOCAL |
| `representation` | string | PROXY/ACTUAL; SPHERE/PLANE은 BOTH도 허용 |
| `center` | number[3] | 구/평면 중심 m |
| `radius` | number | 구 반지름 .01..100m |
| `width` | number | 평면 너비 m |
| `height` | number | 평면 높이 m |
| `vertices[]` | number[3] | 기하 정점 m |
| `outline[]` | integer | 정점 인덱스 |
| `triangles[]` | integer | 삼각형 정점 인덱스, 길이 3의 배수 |
| `sampleMask[]` | boolean | 유효 표면 샘플만 true; vertices와 동일 길이 |
| `missingSurfacePolicy` | string | EXCLUDE |
| `model` | object | ModelReference |
| `*` | JSON | ROI 생성기의 표면 추가 속성 보존 |

## RoiRule

별도 표면 ROI 경보. observationPoints.measurements.rules와 혼동하지 않음.

JSON 위치: `$rois[].rules[]`.

원본 저장: `dt_roi_record.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/roiMonitoring.js](../../../src/features/digitalTwin/editor/model/roiMonitoring.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `metric` | string | ROI_METRICS.id |
| `operator` | string | gt/gte/lt |
| `threshold` | number | 관측 단위 |
| `severity` | string | WARNING/DANGER |
| `durationSeconds` | number | 0 이상 초 |

## RoiRecordExtras

좌표계 변환 및 갱신 시각.

JSON 위치: `$rois[]`.

원본 저장: `dt_roi_record.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/roiMonitoring.js](../../../src/features/digitalTwin/editor/model/roiMonitoring.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `schemaVersion` | integer | 기준좌표 포함 시 2 |
| `coordinateFrame` | object | CoordinateFrame |
| `scanSlot` | object | {side,index} |
| `slotFrame` | object | ScanSlotFrame |
| `slotSurface` | object | 슬롯 기준으로 변환된 surface |
| `updatedAt` | string | 저장 ISO 시각 |

## ProjectRegistry

브라우저 digital-twin-projects-v1. 서버 API 요청 외피와 구분한다.

JSON 위치: `$registry`.

원본 저장: `localStorage[digital-twin-projects-v1]`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/projects/projectRepository.js](../../../src/features/portal/projects/projectRepository.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `version` | integer | 1 |
| `activeId` | string | 활성 로컬 프로젝트 ID |
| `projects[].id` | string | 로컬 ID |
| `projects[].layout` | object | Layout 전체 |
| `projects[].serverProjectId` | string | 서버 ID |
| `projects[].storageMode` | string | LOCAL/SERVER |
| `projects[].savedRevision` | integer | 서버 저장 revision |
| `projects[].publishedRevision` | integer | 발행 revision |
| `projects[].serverSavedAt` | string | 서버 저장 시각 |
| `projects[].*` | JSON | 서버 응답/추가 관리값 보존 |

## OperationsAsset

운영 자산 입력. 월드 연결 자산은 이름·위치가 트리에서 유도됨.

JSON 위치: `$operations.assets[]`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/ViewerOperationsPage.jsx](../../../src/features/portal/viewer/ViewerOperationsPage.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | 운영 레코드 또는 worldKey |
| `name` | string | 자산명 |
| `location` | string | 설치 위치 |
| `locationId` | string | 트리 위치 키 |
| `worldKey` | string | 월드 트리 노드 키 |
| `code` | string | 관리 번호 |
| `model` | string | 제조사/모델 |
| `status` | string | 정상/점검 필요/고장/사용 중지 |
| `managerId` | string | 담당자 레코드 |
| `centerId` | string | AS센터 레코드 |
| `inspectionDate` | string | YYYY-MM-DD |
| `warrantyDate` | string | YYYY-MM-DD |
| `note` | string | 관리 메모 |
| `missing` | boolean | 연결 월드 자산이 없을 때 유도되는 상태 |

## OperationsPerson

담당자/AS센터.

JSON 위치: `$operations.people[]`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/ViewerOperationsPage.jsx](../../../src/features/portal/viewer/ViewerOperationsPage.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `kind` | string | 담당자/AS센터 |
| `name` | string | 이름 |
| `company` | string | 소속/회사 |
| `role` | string | 담당 업무 |
| `phone` | string | 연락처 |
| `email` | string | 이메일 |
| `hours` | string | 대응 시간 |
| `targets[]` | string | 설비/위치 트리 키 |
| `note` | string | 업무 메모 |
| `archived` | boolean | 사용 중지 |

## OperationsTicket

고장·정비 접수.

JSON 위치: `$operations.tickets[]`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/ViewerOperationsPage.jsx](../../../src/features/portal/viewer/ViewerOperationsPage.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `title` | string | 제목 |
| `assetId` | string | 대상 자산 |
| `assetName` | string | 자산명 스냅샷 |
| `locationId` | string | 대상 위치 |
| `locationName` | string | 위치명 스냅샷 |
| `priority` | string | 긴급/높음/보통/낮음 |
| `status` | string | 접수/처리 중/보류/완료 |
| `managerId` | string | 담당자 |
| `centerId` | string | AS센터 |
| `dueDate` | string | YYYY-MM-DD |
| `description` | string | 증상 |
| `resolution` | string | 조치 내용, 완료 필수 |

## OperationsHistory

이력 공통 필드.

JSON 위치: `$operations.{assets|people|tickets|notifications}[].history[]`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/operationsModel.js](../../../src/features/portal/viewer/operationsModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `at` | string | ISO 시각 |
| `actor` | string | 작성자 표시 이름 |
| `action` | string | 등록/수정/상태전환 등 |
| `note` | string | 메모, 수신 기록은 생략 가능 |

## OperationsProfile

표시용 개인 정보. 로그인 계정/권한과 별도.

JSON 위치: `$operations.profile`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/ViewerOperationsPage.jsx](../../../src/features/portal/viewer/ViewerOperationsPage.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `name` | string | 표시 이름 |
| `department` | string | 부서 |
| `role` | string | 직무 |
| `phone` | string | 연락처 |
| `email` | string | 이메일 |

## OperationsPreferences

사용자 기본 보기 설정.

JSON 위치: `$operations.preferences`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/ViewerOperationsPage.jsx](../../../src/features/portal/viewer/ViewerOperationsPage.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `theme` | string | light/dark |
| `viewMode` | string | 3D/2D |
| `movementEnabled` | boolean | 이동 애니메이션 |

## NotificationIncoming

수신 알림의 내용과 처리 상태.

JSON 위치: `$operations.notifications[]`.

원본 저장: `dt_user_state.operations_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/viewer/operationsModel.js](../../../src/features/portal/viewer/operationsModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `time` | string | 수신 원본 시각 |
| `severity` | string | 알람 수준 |
| `title` | string | 알림 제목 |
| `message` | string | 내용 |
| `status` | string | 미확인/확인/종결 |
| `updatedAt` | string | 상태 변경 ISO 시각 |
| `*` | JSON | 수신 알림 원문 확장 필드 |

