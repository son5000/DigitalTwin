# 뷰어 JSON 필드 사전 — equipment

기준: 2026-11-17, layout.version=18. [전체 계약과 DB 설계](../viewer-json-database-contract.md).

이 파일은 `node scripts/generate-viewer-field-reference.mjs`로 소스와 명시적 보충 사전에서 생성한다. 기본값 칸은 **현 프론트의 생성·정규화 식 원문**이다. 전달 값이 없을 때의 프론트 동작을 보여 주며 서버가 이 식으로 값을 덮어쓰라는 뜻이 아니다. `JSON (식 참조)`는 프론트가 스키마를 고정하지 않은 값으로, 식·하위 표·카탈로그를 함께 확인한다. 선택 기능의 키는 없을 수 있고, null/false/0/빈 배열과 누락은 서로 다르다.

모든 경로의 기본 저장 위치는 `dt_project_revision.layout_json`의 **동일 경로**다. 자산·로컬 상태는 각 표의 별도 위치를 따른다. `[]`는 배열 인덱스, `{id}`는 실제 ID, `*`는 임의 하위 키를 뜻한다. 각 표의 DB 컬럼 안에도 해당 객체의 모든 하위 키를 그대로 넣는다.

## Equipment

설비 인스턴스. template와 원본 equipment spread의 합집합이다. 식별/메타데이터 추가 필드는 다음 표.

JSON 위치: `equipmentByFloorId.{floorId}[]`, `roomScenes.{roomId}.equipment[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/utils/templateParameters.js](../../../src/features/digitalTwin/editor/utils/templateParameters.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | equipment |
| `domain` | string | template.domain |
| `category` | string | template.category |
| `parameters` | object | parameters |
| `enclosure` | object | structuredClone(equipment.enclosure) |
| `dimensions` | object | hasParameters ? getDimensionsFromParameters(template, parameters) : { ...defaults.dimensions, ...equipment.dimensions } |
| `dimensions.*` | JSON (확장/병합) | defaults.dimensions |
| `dimensions.*` | JSON (확장/병합) | equipment.dimensions |
| `position` | object | { x: 0, y: template.defaultPositionY ?? 0, z: 0, ...equipment.position } |
| `position.x` | number | 0 |
| `position.y` | number | template.defaultPositionY ?? 0 |
| `position.z` | number | 0 |
| `position.*` | JSON (확장/병합) | equipment.position |
| `groundSnap` | boolean | equipment.groundSnap ?? template.defaultGroundSnap ?? !["CEILING", "WALL"].includes(template.placement) |
| `rotation` | object | { x: 0, y: 0, z: 0, ...equipment.rotation } |
| `rotation.x` | number | 0 |
| `rotation.y` | number | 0 |
| `rotation.z` | number | 0 |
| `rotation.*` | JSON (확장/병합) | equipment.rotation |
| `appearance` | object | { ...defaults.appearance, ...equipment.appearance } |
| `appearance.*` | JSON (확장/병합) | defaults.appearance |
| `appearance.*` | JSON (확장/병합) | equipment.appearance |
| `appearanceSlots` | object | Object.fromEntries((template.materialSlots ?? []).map((slot) => [ slot.id, { ...slot.defaultAppearance, ...equipment.appearanceSlots?.[slot.id] }, ])) |
| `parts` | array | Array.isArray(equipment.parts) ? equipment.parts.map(normalizeEquipmentPart) : defaults.parts |
| `detailAssetId` | string&#124;null | equipment.detailAssetId ?? null |
| `dataBindings` | array | Array.isArray(equipment.dataBindings) ? equipment.dataBindings : [] |
| `operationalState` | object | { status: "UNCOMMISSIONED", alarmLevel: "NONE", lastUpdatedAt: null, ...equipment.operationalState, } |
| `operationalState.status` | string | "UNCOMMISSIONED" |
| `operationalState.alarmLevel` | string | "NONE" |
| `operationalState.lastUpdatedAt` | string&#124;null | null |
| `operationalState.*` | JSON (확장/병합) | equipment.operationalState |
| `control` | object | { enabled: false, mode: "MONITOR_ONLY", endpoint: "", ...equipment.control, } |
| `control.enabled` | boolean | false |
| `control.mode` | string | "MONITOR_ONLY" |
| `control.endpoint` | string | "" |
| `control.*` | JSON (확장/병합) | equipment.control |
| `visible` | boolean | equipment.visible ?? true |
| `locked` | boolean | equipment.locked ?? false |
| `showNameLabel` | boolean | equipment.showNameLabel === true |
| `customAssetId` | string&#124;null | equipment.customAssetId ?? template.customAssetId ?? null |
| `customAssetRevision` | integer&#124;null | equipment.customAssetRevision ?? template.customAssetRevision ?? null |
| `customAssetSnapshot` | object&#124;null | equipment.customAssetSnapshot ?? (template.customAsset ? structuredClone(template.customAsset) : null) |

## EquipmentPart

설비 편집기의 기본 도형 부품; 커스텀 공방 부품과 별도 구조.

JSON 위치: `equipmentByFloorId.{floorId}[].parts[]`, `roomScenes.{roomId}.equipment[].parts[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/partTemplates.js](../../../src/features/digitalTwin/editor/constants/partTemplates.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | part.id ?? createPartId() |
| `domain` | string | "PART" |
| `name` | string | part.name ?? &#96;Part ${String(index + 1).padStart(2, "0")}&#96; |
| `shape` | string | part.shape ?? "BOX" |
| `dimensions` | object | { x: 0.3, y: 0.3, z: 0.3, ...part.dimensions } |
| `dimensions.x` | number | 0.3 |
| `dimensions.y` | number | 0.3 |
| `dimensions.z` | number | 0.3 |
| `dimensions.*` | JSON (확장/병합) | part.dimensions |
| `position` | object | { x: 0, y: 0.5, z: 0, ...part.position } |
| `position.x` | number | 0 |
| `position.y` | number | 0.5 |
| `position.z` | number | 0 |
| `position.*` | JSON (확장/병합) | part.position |
| `rotation` | object | { x: 0, y: 0, z: 0, ...part.rotation } |
| `rotation.x` | number | 0 |
| `rotation.y` | number | 0 |
| `rotation.z` | number | 0 |
| `rotation.*` | JSON (확장/병합) | part.rotation |
| `appearance` | object | { color: PART_COLORS[index % PART_COLORS.length], opacity: 0.92, ...part.appearance } |
| `appearance.color` | string | PART_COLORS[index % PART_COLORS.length] |
| `appearance.opacity` | number | 0.92 |
| `appearance.*` | JSON (확장/병합) | part.appearance |
| `status` | string | part.status ?? "NORMAL" |
| `visible` | boolean | part.visible ?? true |
| `locked` | boolean | part.locked ?? false |

## Enclosure

캐비넷 구조. frontDepthRatio 0.05..0.95; 두 공간 BACK_TO_BACK 또는 SINGLE.

JSON 위치: `equipmentByFloorId.{floorId}[].enclosure`, `roomScenes.{roomId}.equipment[].enclosure`, `siteObjects[].enclosure`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`, `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentEnclosure.js](../../../src/features/digitalTwin/editor/model/equipmentEnclosure.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `enabled` | boolean | source.enabled === true |
| `width` | number | width |
| `height` | number | height |
| `depth` | number | depth |
| `thickness` | number | thickness |
| `bodyLayout` | string | source.bodyLayout === "BACK_TO_BACK" ? "BACK_TO_BACK" : "SINGLE" |
| `frontDepthRatio` | number | clamp(source.frontDepthRatio, .05, .95, .5) |
| `opacity` | number | clamp(source.opacity ?? (legacyOpacity ? 1 : bodyAppearance.opacity), .05, 1, 1) |
| `color` | string | /^#[0-9a-f]{6}$/i.test(source.color ?? "") ? source.color : bodyAppearance.color ?? "#78909c" |
| `walls` | object | Object.fromEntries(Object.keys(ENCLOSURE_WALLS).map((id) => [id, id === "front" ? source.walls?.front === true : source.walls?.[id] !== false])) |
| `*` | JSON (확장/병합) | doorSet(source, width - 2 * thickness, height - 2 * thickness, 1) |
| `rear` | object | doorSet(source.rear ?? {}, width - 2 * thickness, height - 2 * thickness, 0) |
| `interactive` | boolean | source.interactive !== false |

## DoorSet

앞/뒤 동일 구조. 0~5개 문, doors 배열은 5개 상태. doorRatios 순서 유지.

JSON 위치: `equipmentByFloorId.{floorId}[].enclosure`, `roomScenes.{roomId}.equipment[].enclosure`, `equipmentByFloorId.{floorId}[].enclosure.rear`, `roomScenes.{roomId}.equipment[].enclosure.rear`, `siteObjects[].enclosure`, `siteObjects[].enclosure.rear`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`, `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentEnclosure.js](../../../src/features/digitalTwin/editor/model/equipmentEnclosure.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `doorCount` | integer | doorCount |
| `doorLayout` | string | doorLayout |
| `doorRatios` | array | safe.map((value) => value / total) |
| `stackOrder` | string | source.stackOrder === "TOP_DOWN" &#124;&#124; source.stackOrder === "BOTTOM_UP" ? source.stackOrder : "BOTTOM_UP" |
| `upperDoorRatio` | number | clamp(source.upperDoorRatio, .001 / height, 1 - .001 / height, .5) |
| `leftDoorRatio` | number | clamp(source.leftDoorRatio, .001 / width, 1 - .001 / width, .5) |
| `doors` | array | Array.from({ length: 5 }, (_, index) => ({ hinge: ["LEFT", "RIGHT", "TOP", "BOTTOM"].includes(source.doors?.[index]?.hinge) ? source.doors[index].hinge : "RIGHT", swing: source.doors?.[index]?.swing === "INWARD" ? "INWARD" : "OUTWARD", open: source.doors?.[index]?.open === true, angle: clamp(source.doors?.[index]?.angle, 0, 180, 150), hideWhenOpen: source.doors?.[index]?.hideWhenOpen === true, })) |
| `doors[].hinge` | string | ["LEFT", "RIGHT", "TOP", "BOTTOM"].includes(source.doors?.[index]?.hinge) ? source.doors[index].hinge : "RIGHT" |
| `doors[].swing` | string | source.doors?.[index]?.swing === "INWARD" ? "INWARD" : "OUTWARD" |
| `doors[].open` | boolean | source.doors?.[index]?.open === true |
| `doors[].angle` | number | clamp(source.doors?.[index]?.angle, 0, 180, 150) |
| `doors[].hideWhenOpen` | boolean | source.doors?.[index]?.hideWhenOpen === true |

## CoordinateFrame

설비 기준좌표: m, 오른손, +Y 위, +Z 앞. origin/rotation은 길이3 배열. yaw rad.

JSON 위치: `equipmentByFloorId.{floorId}[].metadata.coordinateFrame`, `roomScenes.{roomId}.equipment[].metadata.coordinateFrame`, `siteObjects[].metadata.coordinateFrame`, `$calibration.coordinateFrame`, `sensorBindings[].calibration.payload.coordinateFrame`, `observationConfig.sensorBindings[].calibration.payload.coordinateFrame`.

원본 저장: `dt_project_revision.layout_json`, `dt_calibration.payload_json`. 검색용 복제: `dt_equipment_instance.instance_json`, `dt_scene_node.node_json`, `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentCoordinateFrame.js](../../../src/features/digitalTwin/editor/model/equipmentCoordinateFrame.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | previous?.id ?? &#96;equipment-frame:${equipment.id}&#96; |
| `equipmentId` | string | equipment.id |
| `version` | number | (previous?.version ?? 0) + 1 |
| `unit` | string | "m" |
| `handedness` | string | "RIGHT" |
| `up` | string | "+Y" |
| `front` | string | "+Z" |
| `origin` | number[3] | vector(origin).toArray() |
| `rotation` | number[3] | [0, yaw, 0] |
| `originMode` | string | originMode |

## ViewerPreset

뷰어 초기 상태. camera/visibility/filters/floorSettings는 확장 객체, 원형 보존.

JSON 위치: `viewerPreset`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_viewer_settings.preset_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/viewerPreset.js](../../../src/features/digitalTwin/editor/model/viewerPreset.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `version` | integer | VIEWER_PRESET_VERSION |
| `camera` | JSON&#124;null | source.camera ?? null |
| `lighting` | object | normalizeScanLighting(source.lighting) |
| `equipmentEnvironments` | object | Object.fromEntries(Object.entries(source.equipmentEnvironments ?? {}).filter(([, value]) => value && typeof value === "object").map(([id, value]) => [id, normalizeEquipmentEnvironment(value)])) |
| `equipmentViews` | object | Object.fromEntries(Object.entries(source.equipmentViews ?? {}).map(([id, view]) => [id, normalizeEquipmentView(view)]).filter(([, view]) => view)) |
| `virtualCameras` | object | Object.fromEntries(Object.entries(source.virtualCameras ?? {}).map(([id, cameras]) => [id, (Array.isArray(cameras) ? cameras : []).map((camera) => ({ id: String(camera.id ?? ""), name: String(camera.name ?? "").trim().slice(0, 80), view: normalizeEquipmentView(camera.view), doorState: normalizeVirtualCameraDoorState(camera.doorState) })) .filter((camera) => camera.id && camera.name && camera.view)])) |
| `visibility` | object | { ...(source.visibility ?? {}) } |
| `visibility.*` | JSON (확장/병합) | source.visibility ?? {} |
| `filters` | object | { ...(source.filters ?? {}) } |
| `filters.*` | JSON (확장/병합) | source.filters ?? {} |
| `floorSettings` | object | { ...(source.floorSettings ?? {}) } |
| `floorSettings.*` | JSON (확장/병합) | source.floorSettings ?? {} |
| `detailFocusEquipmentId` | string&#124;null | source.detailFocusEquipmentId ?? null |
| `equipmentRepresentation` | object | { globalMode: GLOBAL_MODES.has(representation.globalMode) ? representation.globalMode : EQUIPMENT_GLOBAL_DISPLAY_MODES.AUTO, overrides, autoDetailDistance: Math.max(1, Number(representation.autoDetailDistance) &#124;&#124; 12), } |
| `equipmentRepresentation.globalMode` | string | GLOBAL_MODES.has(representation.globalMode) ? representation.globalMode : EQUIPMENT_GLOBAL_DISPLAY_MODES.AUTO |
| `equipmentRepresentation.overrides` | object | overrides |
| `equipmentRepresentation.autoDetailDistance` | number | Math.max(1, Number(representation.autoDetailDistance) &#124;&#124; 12) |

## EquipmentEnvironment

설비별 배경·지면·그리드. 색상 #RRGGBB, 거리 m.

JSON 위치: `viewerPreset.equipmentEnvironments.{equipmentId}`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_viewer_settings.preset_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/viewerPreset.js](../../../src/features/digitalTwin/editor/model/viewerPreset.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `backgroundColor` | string | color(source.backgroundColor, "#f5f5f5") |
| `groundColor` | string | color(source.groundColor, "#a1a1a1") |
| `gridColor` | string | color(source.gridColor, "#1f6c98") |
| `groundMode` | string | ["VISIBLE", "TRANSLUCENT", "SECTION", "HIDDEN"].includes(source.groundMode) ? source.groundMode : "VISIBLE" |
| `groundOpacity` | number | number(source.groundOpacity, 0.28, 0, 1) |
| `groundSize` | number | number(source.groundSize, 5, 0.1, 10000) |
| `groundHeight` | number | number(source.groundHeight, 0, -1000, 1000) |
| `gridVisible` | boolean | source.gridVisible !== false |
| `gridSpacing` | number | number(source.gridSpacing, 0.5, 0.01, 1000) |

## EquipmentView

카메라 position/target/up는 길이3 배열. fov 도(deg), near/far m, zoom 배율.

JSON 위치: `viewerPreset.equipmentViews.{equipmentId}`, `viewerPreset.virtualCameras.{equipmentId}[].view`, `observationPoints[].virtualCameraRegion.view`, `observationConfig.observationPoints[].virtualCameraRegion.view`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_viewer_settings.preset_json`, `dt_camera_preset.camera_json`, `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/viewerPreset.js](../../../src/features/digitalTwin/editor/model/viewerPreset.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `position` | number[3] | [...view.position] |
| `target` | number[3] | [...view.target] |
| `up` | number[3] | [...view.up] |
| `zoom` | number | Number.isFinite(view.zoom) ? Math.max(0.01, Math.min(100, view.zoom)) : 1 |
| `fov` | number | Number.isFinite(view.fov) ? Math.max(10, Math.min(100, view.fov)) : 60 |
| `near` | number | Number.isFinite(view.near) ? Math.max(0.0001, view.near) : 0.01 |
| `far` | number | Number.isFinite(view.far) ? Math.max((view.near &#124;&#124; 0.01) + 1, view.far) : 500 |

## CameraDoorState

불리언 배열, 각각 최대 5개. 가상 시점에서 문 상태 재현.

JSON 위치: `viewerPreset.virtualCameras.{equipmentId}[].doorState`, `observationPoints[].virtualCameraRegion.doorState`, `observationConfig.observationPoints[].virtualCameraRegion.doorState`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_camera_preset.camera_json`, `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/viewerPreset.js](../../../src/features/digitalTwin/editor/model/viewerPreset.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `frontOpen` | array | state.frontOpen.slice(0, 5) |
| `rearOpen` | array | state.rearOpen.slice(0, 5) |

## Lighting

밝기 0..6; 기본 ambient=2.1,key=2.4,fill=0.7.

JSON 위치: `viewerPreset.lighting`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_viewer_settings.preset_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/viewerPreset.js](../../../src/features/digitalTwin/editor/model/viewerPreset.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `ambient` | number | 2.1 |
| `key` | number | 2.4 |
| `fill` | number | 0.7 |

## UserTexture

사용자 재질 이미지. textureAssetId는 별도 이미지 자산 레코드 ID. 회전 rad, repeat/offset/scale 무단위.

JSON 위치: `equipmentByFloorId.{floorId}[].userTexture`, `roomScenes.{roomId}.equipment[].userTexture`, `hierarchy.nodes[].userTexture`, `siteObjects[].userTexture`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`, `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/userTexture.js](../../../src/features/digitalTwin/editor/model/userTexture.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `textureAssetId` | string | texture.textureAssetId |
| `target` | string | target |
| `repeat` | object | { x: Math.max(0.01, finite(texture.repeat?.x, 1)), y: Math.max(0.01, finite(texture.repeat?.y, 1)), } |
| `repeat.x` | number | Math.max(0.01, finite(texture.repeat?.x, 1)) |
| `repeat.y` | number | Math.max(0.01, finite(texture.repeat?.y, 1)) |
| `offset` | object | { x: finite(texture.offset?.x, 0), y: finite(texture.offset?.y, 0) } |
| `offset.x` | number | finite(texture.offset?.x, 0) |
| `offset.y` | number | finite(texture.offset?.y, 0) |
| `rotation` | number | finite(texture.rotation, 0) |
| `scale` | number | Math.max(0.01, finite(texture.scale, 1)) |
| `wrap` | string | wrap |

## MaterialAppearance

공통 재질의 정확한 반환 필드 및 기본값. 템플릿별 외관은 카탈로그 참조.

JSON 위치: `equipmentByFloorId.{floorId}[].appearance`, `roomScenes.{roomId}.equipment[].appearance`, `equipmentByFloorId.{floorId}[].appearanceSlots.{slotId}`, `roomScenes.{roomId}.equipment[].appearanceSlots.{slotId}`, `floorPlansById.{floorId}.structures[].appearance`, `verticalStructuresByBuildingId.{buildingId}[].appearance`, `roomScenes.{roomId}.worldStructures[].appearance`, `floorPlansById.{floorId}.floorStyle`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`, `dt_structure.structure_json`, `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/materialPresets.js](../../../src/features/digitalTwin/editor/constants/materialPresets.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `materialPresetId` | string | selected.id |
| `materialPreset` | string | selected.id |
| `material` | string | selected.id |
| `pattern` | string | selected.pattern |
| `color` | string | selected.color |
| `roughness` | number | selected.roughness |
| `metalness` | number | selected.metalness |
| `reflectivity` | number | selected.reflectivity |
| `opacity` | number | selected.opacity |
| `textureScale` | number | selected.textureScale |
| `textureRotation` | number | selected.textureRotation |
| `bumpStrength` | number | selected.bumpStrength |
| `aging` | number | selected.aging |
| `transmission` | number | selected.transmission |
| `*` | JSON (확장/병합) | overrides |

## EquipmentIdentity

생성·UI 갱신 시 추가하는 인스턴스 필드. 타입별 선택 항목은 없어도 된다.

JSON 위치: `equipmentByFloorId.{floorId}[]`, `roomScenes.{roomId}.equipment[]`, `siteObjects[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`, `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useFloorEquipmentState.js](../../../src/features/digitalTwin/editor/store/useFloorEquipmentState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | 프론트 설비 ID; 리비전과 소유 경로로 범위 지정 |
| `name` | string | 사용자 설비명 |
| `shapeTemplateId` | string | 템플릿 카탈로그 ID |
| `sourceTemplateId` | string | 원본 템플릿 ID(존재 시) |
| `floorId` | string&#124;null | 소유 층 ID |
| `spaceId` | string&#124;null | 소유 공간 ID |
| `metadata.assetTag` | string | 기본 빈 문자열; 자산 번호 |
| `metadata.manufacturer` | string | 기본 빈 문자열; 제조사 |
| `metadata.model` | string | 기본 빈 문자열; 모델명 |
| `metadata.serialNumber` | string | 기본 빈 문자열; 일련번호 |
| `metadata.description` | string | 설비 설명 |
| `metadata.representativeImage` | string&#124;null | data URL 또는 저장 이미지 식별 URL; 삭제 null |
| `metadata.modelComposition` | string | SCAN/SHAPE/BOTH |
| `metadata.initialModelPending` | boolean | 모델 구성 선택 전 여부 |
| `metadata.exteriorSelected` | boolean | 외관 도형 선택 여부 |
| `metadata.detailSetup.currentStep` | string | BASIC/ASSET/SCAN/SENSOR/VIRTUAL_CAMERA/POINT/REVIEW |
| `metadata.detailSetup.steps.{stepId}` | string | PENDING/DONE/SKIPPED; completed/skipped는 계산값 |
| `metadata.*` | JSON | 확장 메타데이터 원문 보존 |
| `dataBindings[]` | object | 현재 고정된 저장 스키마 없음; 원문 JSON 보존 |
| `parameters.*` | JSON | 템플릿 카탈로그의 defaultParameters/parameterFields 및 임의 확장 키 |
| `appearanceSlots.{slotId}` | object | 카탈로그 materialSlots.id → Appearance와 같은 구조 |
| `customAssetSnapshot` | object&#124;null | CustomEquipment 또는 CustomBuilding 전체 정의; 중첩 자산도 포함 |

## Appearance

공통 시각 재질. 모든 템플릿의 실제 기본값과 추가 항목은 viewer-template-catalog.json에 기록한다.

JSON 위치: `equipmentByFloorId.{floorId}[].appearance`, `roomScenes.{roomId}.equipment[].appearance`, `equipmentByFloorId.{floorId}[].appearanceSlots.{slotId}`, `roomScenes.{roomId}.equipment[].appearanceSlots.{slotId}`, `floorPlansById.{floorId}.structures[].appearance`, `verticalStructuresByBuildingId.{buildingId}[].appearance`, `roomScenes.{roomId}.worldStructures[].appearance`, `floorPlansById.{floorId}.structures[].appearanceSlots.{slotId}`, `verticalStructuresByBuildingId.{buildingId}[].appearanceSlots.{slotId}`, `roomScenes.{roomId}.worldStructures[].appearanceSlots.{slotId}`, `siteObjects[].appearance`, `hierarchy.nodes[].appearance`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`, `dt_structure.structure_json`, `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/equipmentShapeTemplates.js](../../../src/features/digitalTwin/editor/constants/equipmentShapeTemplates.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `color` | string | 색상 #RRGGBB |
| `material` | string | 야외·건물의 재질 ID |
| `materialPreset` | string | 재질 프리셋 ID |
| `opacity` | number | 불투명도 0..1 |
| `roughness` | number | 거칠기 0..1 |
| `metalness` | number | 금속도 0..1 |
| `showEdges` | boolean | 모서리 표시 |
| `*` | JSON | 개별 템플릿이 제공한 나머지 외관 속성 보존 |

## ViewerDynamicFields

현재 공통 뷰어 preset에서 스키마를 닫지 않는 사전. 미사용 키를 서버가 생성할 필요 없음.

JSON 위치: `viewerPreset`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_viewer_settings.preset_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/viewerPreset.js](../../../src/features/digitalTwin/editor/model/viewerPreset.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `camera` | JSON&#124;null | 현재 createViewerPreset은 source.camera를 그대로 받음. 구체적 고정 형태 강제 없음 |
| `visibility.{key}` | JSON | 원문 사전 |
| `filters.{key}` | JSON | 원문 사전 |
| `floorSettings.{key}` | JSON | 원문 사전 |
| `equipmentRepresentation.overrides.{equipmentId}` | string | AUTO/DISTANCE/SIMPLIFIED/DETAILED; AUTO 선택 시 키 삭제 가능 |
| `virtualCameras.{equipmentId}[].id` | string | 카메라 ID |
| `virtualCameras.{equipmentId}[].name` | string | trim 후 최대 80자 |
| `virtualCameras.{equipmentId}[].view` | object | EquipmentView |
| `virtualCameras.{equipmentId}[].doorState` | object&#124;null | CameraDoorState |

## EnclosureWalls

판별 표시 상태. 앞판만 기본 false, 나머지 true.

JSON 위치: `equipmentByFloorId.{floorId}[].enclosure.walls`, `roomScenes.{roomId}.equipment[].enclosure.walls`, `siteObjects[].enclosure.walls`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`, `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentEnclosure.js](../../../src/features/digitalTwin/editor/model/equipmentEnclosure.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `front` | boolean | source.walls.front === true |
| `back` | boolean | source.walls.back !== false |
| `left` | boolean | source.walls.left !== false |
| `right` | boolean | source.walls.right !== false |
| `top` | boolean | source.walls.top !== false |
| `bottom` | boolean | source.walls.bottom !== false |

## Dimensions

설비 공통 최종 경계 치수. 템플릿 parameters에서 재계산될 수 있다.

JSON 위치: `equipmentByFloorId.{floorId}[].dimensions`, `roomScenes.{roomId}.equipment[].dimensions`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_equipment_instance.instance_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/utils/templateParameters.js](../../../src/features/digitalTwin/editor/utils/templateParameters.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `width` | number | 가로 m |
| `height` | number | 높이 m |
| `depth` | number | 깊이 m |

