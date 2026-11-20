# 뷰어 JSON 필드 사전 — monitoring

기준: 2026-11-17, layout.version=18. [전체 계약과 DB 설계](../viewer-json-database-contract.md).

이 파일은 `node scripts/generate-viewer-field-reference.mjs`로 소스와 명시적 보충 사전에서 생성한다. 기본값 칸은 **현 프론트의 생성·정규화 식 원문**이다. 전달 값이 없을 때의 프론트 동작을 보여 주며 서버가 이 식으로 값을 덮어쓰라는 뜻이 아니다. `JSON (식 참조)`는 프론트가 스키마를 고정하지 않은 값으로, 식·하위 표·카탈로그를 함께 확인한다. 선택 기능의 키는 없을 수 있고, null/false/0/빈 배열과 누락은 서로 다르다.

모든 경로의 기본 저장 위치는 `dt_project_revision.layout_json`의 **동일 경로**다. 자산·로컬 상태는 각 표의 별도 위치를 따른다. `[]`는 배열 인덱스, `{id}`는 실제 ID, `*`는 임의 하위 키를 뜻한다. 각 표의 DB 컬럼 안에도 해당 객체의 모든 하위 키를 그대로 넣는다.

## EquipmentAssetBinding

파일/스캔 표시 연결. objectUrl은 직렬화에서 제거. assetType OBJ/PLY/GLTF/GLB/IMAGE/TEXTURE.

JSON 위치: `equipmentAssetBindings[]`, `observationConfig.equipmentAssetBindings[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_object_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentDetailModel.js](../../../src/features/digitalTwin/editor/model/equipmentDetailModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | source.id ?? createId("EQUIPMENT_ASSET_BINDING") |
| `equipmentId` | string | equipmentId |
| `assetId` | string | source.assetId ?? asset.assetId ?? createId("ASSET") |
| `backendAsset` | object | { ...source.backendAsset } |
| `backendAsset.*` | JSON (확장/병합) | source.backendAsset |
| `name` | string | source.name ?? asset.name ?? "설비 자산" |
| `sourceType` | string | source.sourceType ?? ASSET_SOURCE_TYPES.PROJECT |
| `sourceKey` | string | source.sourceKey ?? asset.sourceKey ?? "" |
| `relatedSourceKey` | string&#124;null | source.relatedSourceKey ?? asset.relatedSourceKey ?? null |
| `textureSourceKey` | string&#124;null | source.textureSourceKey ?? asset.textureSourceKey ?? null |
| `assetType` | string | source.assetType ?? asset.assetType ?? ASSET_TYPES.OBJ |
| `usageType` | string | source.usageType ?? asset.usageType ?? ASSET_USAGE_TYPES.MODEL |
| `scanSlot` | object&#124;null | scanSlot |
| `alignmentTransform` | object | createAlignmentTransform(scanSlot ? { fitToProxy: true, ...source.alignmentTransform, autoCentered: false, floorAligned: false, originMode: "DOOR_CORNER", } : source.alignmentTransform) |
| `displayMode` | string | source.displayMode ?? EQUIPMENT_DISPLAY_MODES.PROXY |
| `includeProxy` | boolean | source.includeProxy === true |
| `status` | string | source.status ?? "READY" |
| `errorMessage` | string | source.errorMessage ?? "" |

## AlignmentTransform

원본 단위 MM/CM/M; 위치 m, 회전 rad, 스케일 배율. targetDimensions m. 스캔 슬롯은 문 모서리 기준.

JSON 위치: `equipmentAssetBindings[].alignmentTransform`, `observationConfig.equipmentAssetBindings[].alignmentTransform`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_object_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentDetailModel.js](../../../src/features/digitalTwin/editor/model/equipmentDetailModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `unit` | string | Object.values(ALIGNMENT_UNITS).includes(source.unit) ? source.unit : ALIGNMENT_UNITS.MM |
| `position` | object | { x: 0, y: 0, z: 0, ...source.position } |
| `position.x` | number | 0 |
| `position.y` | number | 0 |
| `position.z` | number | 0 |
| `position.*` | JSON (확장/병합) | source.position |
| `rotation` | object | { x: 0, y: 0, z: 0, ...source.rotation } |
| `rotation.x` | number | 0 |
| `rotation.y` | number | 0 |
| `rotation.z` | number | 0 |
| `rotation.*` | JSON (확장/병합) | source.rotation |
| `scale` | object | { x: 1, y: 1, z: 1, ...source.scale } |
| `scale.x` | number | 1 |
| `scale.y` | number | 1 |
| `scale.z` | number | 1 |
| `scale.*` | JSON (확장/병합) | source.scale |
| `autoCentered` | boolean | source.autoCentered ?? true |
| `floorAligned` | boolean | source.floorAligned ?? true |
| `fitToProxy` | boolean | source.fitToProxy ?? true |
| `fitDimension` | string | ["WIDTH", "HEIGHT", "DEPTH", "EXACT"].includes(source.fitDimension) ? source.fitDimension : "CONTAIN" |
| `targetDimensions` | object | Object.fromEntries(Object.entries(source.targetDimensions ?? {}).filter(([key, value]) => ["width", "height", "depth"].includes(key) && Number.isFinite(value) && value > 0)) |
| `completed` | boolean | source.completed ?? false |
| `originMode` | string | source.originMode === "DOOR_CORNER" ? "DOOR_CORNER" : "CENTER" |

## SensorBinding

센서 설치/서버 연결. equipmentIds는 다중 참조. 추가 입력·응답 필드는 보충 표.

JSON 위치: `sensorBindings[]`, `observationConfig.sensorBindings[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentDetailModel.js](../../../src/features/digitalTwin/editor/model/equipmentDetailModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | device |
| `id` | string | device.id ?? createId("SENSOR_BINDING") |
| `equipmentIds` | string[] | equipmentIds |
| `serverKey` | string | device.serverKey ?? device.identifier ?? "" |
| `serialNumber` | string | device.serialNumber ?? "" |
| `serverSensorId` | string&#124;null | device.serverSensorId ?? null |
| `capabilities` | string[] | capabilities |
| `deviceKind` | string | capabilities[0] ?? "GENERIC" |
| `sensorType` | string | sensorType |
| `sourceType` | string | sensorType |
| `mountMode` | string | device.mountMode ?? "WORLD" |
| `markerDiameter` | number | getSensorMarkerDiameter(device) |
| `appearance` | string | getSensorAppearance(device) |
| `heatmap` | object | normalizeHeatmap(device.heatmap) |
| `position` | object | { x: 2, y: 2, z: 2, ...device.position } |
| `position.x` | number | 2 |
| `position.y` | number | 2 |
| `position.z` | number | 2 |
| `position.*` | JSON (확장/병합) | device.position |
| `rotation` | object | { x: 0, y: 0, z: 0, ...device.rotation } |
| `rotation.x` | number | 0 |
| `rotation.y` | number | 0 |
| `rotation.z` | number | 0 |
| `rotation.*` | JSON (확장/병합) | device.rotation |
| `fieldOfView` | number | Number(device.fieldOfView ?? device.fov ?? 50) |
| `aspectRatio` | number | Number(device.aspectRatio ?? 16 / 9) |
| `near` | number | Number(device.near ?? 0.1) |
| `far` | number | Number(device.far ?? device.range ?? 10) |
| `observationPointIds` | string[] | device.observationPointIds ?? [] |

## Heatmap

센서 마커 열지도 시각 설정. radius m, opacity 0.1..1.

JSON 위치: `sensorBindings[].heatmap`, `observationConfig.sensorBindings[].heatmap`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/sensorHeatmap.js](../../../src/features/digitalTwin/editor/model/sensorHeatmap.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `radius` | number | number(value.radius, .1, .01, 10) |
| `opacity` | number | number(value.opacity, .8, .1, 1) |
| `falloff` | number | number(value.falloff, .7, .3, 4) |
| `palette` | string | HEATMAP_PALETTES[value.palette] ? value.palette : "SPECTRUM" |
| `style` | string | HEATMAP_STYLES[value.style] ? value.style : "SOFT" |
| `preview` | boolean | value.preview === true |
| `equipmentId` | string&#124;null | value.equipmentId ?? null |
| `positionAutoZ` | boolean | value.positionAutoZ ?? untouchedPosition |
| `position` | object | Object.fromEntries(["x", "y", "z"].map((axis) => [axis, number(value.position?.[axis], axis === "y" ? .5 : 0, -1e6, 1e6)])) |
| `normal` | object | value.normal && [value.normal.x, value.normal.y, value.normal.z].every(Number.isFinite) && Math.hypot(value.normal.x, value.normal.y, value.normal.z) > 1e-6 ? { ...value.normal } : { x: 0, y: 0, z: 1 } |
| `normal.*` | JSON (확장/병합) | value.normal |
| `normal.x` | number | 0 |
| `normal.y` | number | 0 |
| `normal.z` | number | 1 |

## TextureProjection

이미지 텍스처 배치. 내부 UV는 좌하단, rotation은 도, pivot/crop/offset은 UV.

JSON 위치: `sensorBindings[].textureProjection`, `observationConfig.sensorBindings[].textureProjection`, `$calibration.textureProjection`, `sensorBindings[].calibration.payload.textureProjection`, `observationConfig.sensorBindings[].calibration.payload.textureProjection`.

원본 저장: `dt_project_revision.layout_json`, `dt_calibration.payload_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/sensorImageTransform.js](../../../src/features/digitalTwin/editor/model/sensorImageTransform.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `enabled` | boolean | source.enabled === true |
| `kind` | string | source.kind === "THERMAL" ? "THERMAL" : "VISION" |
| `target` | string | ["ACTUAL", "PROXY", "BOTH"].includes(source.target) ? source.target : "PROXY" |
| `equipmentId` | string&#124;null | typeof source.equipmentId === "string" ? source.equipmentId : null |
| `surfaceId` | string | typeof source.surfaceId === "string" ? source.surfaceId : "" |
| `meshPath` | string&#124;null | typeof source.meshPath === "string" ? source.meshPath : null |
| `meshName` | string | typeof source.meshName === "string" ? source.meshName : "" |
| `imagePlane` | string | Object.hasOwn(IMAGE_PLANES, source.imagePlane) ? source.imagePlane : "FRONT" |
| `surfaceMapping` | object&#124;null | normalizeImageSurface(source.surfaceMapping) |
| `opacity` | number | number(source.opacity, 1, 0, 1) |
| `scaleX` | number | number(source.scaleX, 1, .01, 100) |
| `scaleY` | number | number(source.scaleY, 1, .01, 100) |
| `zoom` | number | number(source.zoom, 1, .01, 100) |
| `offsetX` | number | number(source.offsetX, 0, -10, 10) |
| `offsetY` | number | number(source.offsetY, 0, -10, 10) |
| `rotation` | number | number(source.rotation, 0, -3600, 3600) |
| `pivotX` | number | number(source.pivotX, .5, 0, 1) |
| `pivotY` | number | number(source.pivotY, .5, 0, 1) |
| `flipX` | boolean | source.flipX === true |
| `flipY` | boolean | source.flipY === true |
| `perspective` | object | normalizePerspective(source.perspective) |
| `cropX` | number | cropX |
| `cropY` | number | cropY |
| `cropWidth` | number | number(source.cropWidth, 1 - cropX, 1e-6, 1 - cropX) |
| `cropHeight` | number | number(source.cropHeight, 1 - cropY, 1e-6, 1 - cropY) |
| `temperatureMin` | number | number(source.temperatureMin, 0, -273.15, 10000) |
| `temperatureMax` | number | number(source.temperatureMax, 100, -273.14, 10001) |
| `palette` | string | source.palette === "SPECTRUM" ? "JET" : Object.hasOwn(THERMAL_PALETTES, source.palette) ? source.palette : "JET" |

## Perspective

source/target: 네 쌍의 [u,v]. 좌상/우상/우하/좌하 순서. 내부 좌하단 UV.

JSON 위치: `sensorBindings[].textureProjection.perspective`, `observationConfig.sensorBindings[].textureProjection.perspective`, `$calibration.textureProjection.perspective`, `sensorBindings[].calibration.payload.textureProjection.perspective`, `observationConfig.sensorBindings[].calibration.payload.textureProjection.perspective`.

원본 저장: `dt_project_revision.layout_json`, `dt_calibration.payload_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/imageHomography.js](../../../src/features/digitalTwin/editor/model/imageHomography.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `enabled` | boolean | value?.enabled === true |
| `source` | number[4][2] | source.map((p) => [...p]) |
| `target` | number[4][2] | target.map((p) => [...p]) |

## SurfaceMapping

표면 평면의 원점/축은 길이3 배열, width/height m, normal 방향 벡터.

JSON 위치: `sensorBindings[].textureProjection.surfaceMapping`, `observationConfig.sensorBindings[].textureProjection.surfaceMapping`, `$calibration.textureProjection.surfaceMapping`, `sensorBindings[].calibration.payload.textureProjection.surfaceMapping`, `observationConfig.sensorBindings[].calibration.payload.textureProjection.surfaceMapping`.

원본 저장: `dt_project_revision.layout_json`, `dt_calibration.payload_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/textureSurfaceMapping.js](../../../src/features/digitalTwin/editor/model/textureSurfaceMapping.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `space` | string | "EQUIPMENT_MODEL_LOCAL" |
| `unit` | string | "m" |
| `origin` | number[3] | origin.toArray() |
| `right` | number[3] | right.toArray() |
| `up` | number[3] | up.toArray() |
| `normal` | number[3] | new THREE.Vector3().crossVectors(right, up).toArray() |
| `width` | number | size(source.width) |
| `height` | number | size(source.height) |

## ObservationPoint

ROI SPHERE/PLANE. 중심 m, 반지름 m, planeRotation rad. sensorIds는 measurements에서 유도.

JSON 위치: `observationPoints[]`, `observationConfig.observationPoints[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentDetailModel.js](../../../src/features/digitalTwin/editor/model/equipmentDetailModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | point |
| `id` | string | point.id ?? createId("OBSERVATION_POINT") |
| `equipmentId` | string&#124;null | point.equipmentId ?? null |
| `name` | string | point.name ?? "관측 영역" |
| `geometryType` | string | point.geometryType === "PLANE" ? "PLANE" : "SPHERE" |
| `planeWidth` | number | Math.max(.01, Math.min(100, Number(point.planeWidth) &#124;&#124; .3)) |
| `planeHeight` | number | Math.max(.01, Math.min(100, Number(point.planeHeight) &#124;&#124; .3)) |
| `planeRotation` | number | Number.isFinite(point.planeRotation) ? point.planeRotation : 0 |
| `revision` | number | Math.max(0, Math.floor(Number(point.revision) &#124;&#124; 0)) |
| `radius` | number | Math.max(.01, Math.min(100, Number(point.radius) &#124;&#124; .15)) |
| `opacity` | number | Math.max(.05, Math.min(.8, Number.isFinite(Number(point.opacity)) ? Number(point.opacity) : .25)) |
| `measurements` | array | measurements |
| `sourceDeviceId` | string&#124;null | null |
| `localPosition` | object | { x: 0, y: 0.5, z: 0, ...point.localPosition } |
| `localPosition.x` | number | 0 |
| `localPosition.y` | number | 0.5 |
| `localPosition.z` | number | 0 |
| `localPosition.*` | JSON (확장/병합) | point.localPosition |
| `targetNormal` | object | { x: 0, y: 0, z: 1, ...point.targetNormal } |
| `targetNormal.x` | number | 0 |
| `targetNormal.y` | number | 0 |
| `targetNormal.z` | number | 1 |
| `targetNormal.*` | JSON (확장/병합) | point.targetNormal |
| `sensorIds` | string[] | [...new Set(measurements.map((item) => item.sensorId).filter(Boolean))] |

## MeasurementDefaults

관측값별 이름·단위·경보 규칙. 원본 item 속성도 보존. 초기 온도 임계치 60/80.

JSON 위치: `observationPoints[].measurements[]`, `observationConfig.observationPoints[].measurements[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentDetailModel.js](../../../src/features/digitalTwin/editor/model/equipmentDetailModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | &#96;${point.id ?? "roi"}-value&#96; |
| `name` | string | point.name ?? "온도" |
| `metric` | string | point.metric ?? "TEMPERATURE" |
| `unit` | string | point.unit ?? "°C" |
| `sensorId` | string | point.sensorIds?.[0] ?? point.sourceDeviceId ?? "" |
| `visible` | boolean | true |
| `previewValue` | number&#124;string&#124;null | point.previewValue |
| `rules` | array | [{ operator: "gte", threshold: point.warningRange?.min ?? 60, severity: "WARNING" }, { operator: "gte", threshold: point.dangerRange?.min ?? 80, severity: "DANGER" }] |
| `rules[].operator` | string | "gte" |
| `rules[].threshold` | number | point.warningRange?.min ?? 60 |
| `rules[].severity` | string | "WARNING" |
| `rules[].threshold` | number | point.dangerRange?.min ?? 80 |
| `rules[].severity` | string | "DANGER" |

## ImageBinding

비전 원본 이미지 기준 ROI. 좌상단 원점의 정규 좌표(0..1). sourceQuad 선택 지원.

JSON 위치: `observationPoints[].imageBinding`, `observationConfig.observationPoints[].imageBinding`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/imageObservation.js](../../../src/features/digitalTwin/editor/model/imageObservation.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `schemaVersion` | number | 1 |
| `sensorId` | string | sensor.id |
| `originalImage` | object | originalImage |
| `sourceRect` | object | { x:uv[0]-size/2, y:1-uv[1]-size/2, width:size, height:size } |
| `sourceRect.x` | number | uv[0]-size/2 |
| `sourceRect.y` | number | 1-uv[1]-size/2 |
| `sourceRect.width` | number | size |
| `sourceRect.height` | number | size |

## ImageAnalysis

계산되어 저장될 수 있는 비전 분석 스냅샷. 원본/처리 영상과 설비 표면 사각형.

JSON 위치: `observationPoints[].imageAnalysis`, `observationConfig.observationPoints[].imageAnalysis`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/imageObservation.js](../../../src/features/digitalTwin/editor/model/imageObservation.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `schemaVersion` | number | 2 |
| `sensorBindingId` | string | sensor.id |
| `serverSensorId` | string&#124;null | sensor.serverSensorId ?? null |
| `originalImage` | object&#124;null | original ?? null |
| `imageTransform` | object | imageAnalysisTransform(sensor, original) |
| `target` | object | { equipmentId: equipment.id, representation: p.target, surfaceId: p.surfaceId, meshPath:p.meshPath, surface } |
| `target.equipmentId` | string | equipment.id |
| `target.representation` | string | p.target |
| `target.surfaceId` | string | p.surfaceId |
| `target.meshPath` | string | p.meshPath |
| `target.surface` | object | surface |
| `cornerOrder` | array | ["TOP_LEFT","TOP_RIGHT","BOTTOM_RIGHT","BOTTOM_LEFT"] |
| `source` | object | imageRegionCoordinates(sourceNormalized, original?.width, original?.height) |
| `processed` | object | imageRegionCoordinates(processedUv.map(([x,y]) => [x,1-y]), original?.width, original?.height) |
| `world` | object | { space:"EQUIPMENT_MODEL_LOCAL", unit:"m", vertices } |
| `world.space` | string | "EQUIPMENT_MODEL_LOCAL" |
| `world.unit` | string | "m" |
| `world.vertices` | array | vertices |

## ThermalBinding

열화상 연결. projector는 4×4 COLUMN_MAJOR; 영상 변환은 아래 3×3 ROW_MAJOR. 혼용 금지.

JSON 위치: `observationPoints[].thermalBinding`, `observationConfig.observationPoints[].thermalBinding`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/observationSource.js](../../../src/features/digitalTwin/editor/model/observationSource.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `schemaVersion` | number | 1 |
| `kind` | string | "THERMAL" |
| `sensorId` | string | sensor.id |
| `serverSensorId` | string&#124;null | sensor.serverSensorId ?? null |
| `serialNumber` | string | sensor.serialNumber ?? "" |
| `calibrationKey` | string | thermalCalibrationKey(sensor, equipment) |
| `anchorPosition` | object | { x: position.x, y: position.y, z: position.z } |
| `anchorPosition.x` | number | position.x |
| `anchorPosition.y` | number | position.y |
| `anchorPosition.z` | number | position.z |
| `coordinateSpace` | string | "EQUIPMENT_MODEL_LOCAL" |
| `representation` | string | hit.representation |
| `source` | object | { origin: "TOP_LEFT", width, height, uv: hit.sourceUv, pixel: width && height ? [hit.sourceUv[0] * width, hit.sourceUv[1] * height] : null, measuredAt: frame?.measuredAt ?? null } |
| `source.origin` | string | "TOP_LEFT" |
| `source.width` | number&#124;null | width |
| `source.height` | number&#124;null | height |
| `source.uv` | number[2] | hit.sourceUv |
| `source.pixel` | array&#124;null | width && height ? [hit.sourceUv[0] * width, hit.sourceUv[1] * height] : null |
| `source.measuredAt` | string&#124;null | frame?.measuredAt ?? null |
| `projector` | object | { matrix: hit.projectorMatrix, matrixLayout: "COLUMN_MAJOR", vectorConvention: "COLUMN_VECTOR", from: "EQUIPMENT_MODEL_LOCAL", to: "CLIP", homogeneousDivide: "xyz / w; uv=xy*0.5+0.5" } |
| `projector.matrix` | number[16] | hit.projectorMatrix |
| `projector.matrixLayout` | string | "COLUMN_MAJOR" |
| `projector.vectorConvention` | string | "COLUMN_VECTOR" |
| `projector.from` | string | "EQUIPMENT_MODEL_LOCAL" |
| `projector.to` | string | "CLIP" |
| `projector.homogeneousDivide` | string | "xyz / w; uv=xy*0.5+0.5" |
| `imageTransform` | object | imageAnalysisTransform({ ...sensor, resolution: { width, height } }) |
| `regionPolicy` | string | "ROI_INTERSECT_VISIBLE_THERMAL_SURFACE" |
| `missingPixels` | string | "EXCLUDE" |

## ImageTransform

외부 분석 API schemaVersion=4. 좌상단 원점, +X 오른쪽/+Y 아래, 3×3 행 우선 행렬·열벡터.

JSON 위치: `observationPoints[].imageAnalysis.imageTransform`, `observationConfig.observationPoints[].imageAnalysis.imageTransform`, `observationPoints[].thermalBinding.imageTransform`, `observationConfig.observationPoints[].thermalBinding.imageTransform`, `$imageProcessing.imageTransform`, `$calibration.imageTransform`, `sensorBindings[].calibration.payload.imageTransform`, `observationConfig.sensorBindings[].calibration.payload.imageTransform`.

원본 저장: `dt_project_revision.layout_json`, `dt_image_processing.payload_json`, `dt_calibration.payload_json`. 검색용 복제: `dt_spatial_roi.roi_json`, `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/imageAnalysisContract.js](../../../src/features/digitalTwin/editor/model/imageAnalysisContract.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `schemaVersion` | number | 4 |
| `source` | object | source |
| `coordinates` | object | { origin: "TOP_LEFT", xAxis: "RIGHT", yAxis: "DOWN", unit: "NORMALIZED", pixelOrigin: "TOP_LEFT", pixelConvention: "PIXEL_EDGES; CENTER=(COLUMN+0.5,ROW+0.5)", matrixLayout: "ROW_MAJOR", vectorConvention: "COLUMN_VECTOR", homogeneousDivide: "xy / w" } |
| `coordinates.origin` | string | "TOP_LEFT" |
| `coordinates.xAxis` | string | "RIGHT" |
| `coordinates.yAxis` | string | "DOWN" |
| `coordinates.unit` | string | "NORMALIZED" |
| `coordinates.pixelOrigin` | string | "TOP_LEFT" |
| `coordinates.pixelConvention` | string | "PIXEL_EDGES; CENTER=(COLUMN+0.5,ROW+0.5)" |
| `coordinates.matrixLayout` | string | "ROW_MAJOR" |
| `coordinates.vectorConvention` | string | "COLUMN_VECTOR" |
| `coordinates.homogeneousDivide` | string | "xy / w" |
| `processedRaster` | object | { width: width ?? null, height: height ?? null, purpose: "REFERENCE_COORDINATES_ONLY_NOT_RENDER_RESOLUTION" } |
| `processedRaster.width` | number&#124;null | width ?? null |
| `processedRaster.height` | number&#124;null | height ?? null |
| `processedRaster.purpose` | string | "REFERENCE_COORDINATES_ONLY_NOT_RENDER_RESOLUTION" |
| `parameters` | object | { scaleX: p.scaleX, scaleY: p.scaleY, zoom: p.zoom, flipX: p.flipX, flipY: p.flipY, pivotX: p.pivotX, pivotY: 1 - p.pivotY, offsetX: p.offsetX, offsetY: -p.offsetY, rotation: -p.rotation, rotationUnit: "DEG", positiveRotation: "CLOCKWISE", cropX: p.cropX, cropY: 1 - p.cropY - p.cropHeight, cropWidth: p.cropWidth, cropHeight: p.cropHeight } |
| `parameters.scaleX` | number | p.scaleX |
| `parameters.scaleY` | number | p.scaleY |
| `parameters.zoom` | number | p.zoom |
| `parameters.flipX` | boolean | p.flipX |
| `parameters.flipY` | boolean | p.flipY |
| `parameters.pivotX` | number | p.pivotX |
| `parameters.pivotY` | number | 1 - p.pivotY |
| `parameters.offsetX` | number | p.offsetX |
| `parameters.offsetY` | number | -p.offsetY |
| `parameters.rotation` | number | -p.rotation |
| `parameters.rotationUnit` | string | "DEG" |
| `parameters.positiveRotation` | string | "CLOCKWISE" |
| `parameters.cropX` | number | p.cropX |
| `parameters.cropY` | number | 1 - p.cropY - p.cropHeight |
| `parameters.cropWidth` | number | p.cropWidth |
| `parameters.cropHeight` | number | p.cropHeight |
| `stages` | array | [ { operation: "CROP", from: "SOURCE", to: "CROPPED", matrix: crop, inverseMatrix: inverse3(crop) }, { operation: "PERSPECTIVE", from: "CROPPED", to: "RECTIFIED", enabled: internal.perspective.enabled, source: topLeftPoints(internal.perspective.source), target: topLeftPoints(internal.perspective.target), matrix: topLeftMatrix(internal.perspective.matrix), inverseMatrix: topLeftMatrix(internal.perspective.inverseMatrix) }, { operation: "PIVOT_FLIP_SCALE_ZOOM_ROTATE_TRANSLATE", from: "RECTIFIED", to: "PROCESSED", matrix: topLeftMatrix(internal.rectifiedUvToTargetUv), inverseMatrix: topLeftMatrix(internal.targetUvToRectifiedUv) }, ] |
| `stages[].operation` | string | "CROP" |
| `stages[].from` | string | "SOURCE" |
| `stages[].to` | string | "CROPPED" |
| `stages[].matrix` | number[9] | crop |
| `stages[].inverseMatrix` | number[9] | inverse3(crop) |
| `stages[].operation` | string | "PERSPECTIVE" |
| `stages[].from` | string | "CROPPED" |
| `stages[].to` | string | "RECTIFIED" |
| `stages[].enabled` | boolean | internal.perspective.enabled |
| `stages[].source` | number[4][2] | topLeftPoints(internal.perspective.source) |
| `stages[].target` | number[4][2] | topLeftPoints(internal.perspective.target) |
| `stages[].matrix` | number[9] | topLeftMatrix(internal.perspective.matrix) |
| `stages[].inverseMatrix` | number[9] | topLeftMatrix(internal.perspective.inverseMatrix) |
| `stages[].operation` | string | "PIVOT_FLIP_SCALE_ZOOM_ROTATE_TRANSLATE" |
| `stages[].from` | string | "RECTIFIED" |
| `stages[].to` | string | "PROCESSED" |
| `stages[].matrix` | number[9] | topLeftMatrix(internal.rectifiedUvToTargetUv) |
| `stages[].inverseMatrix` | number[9] | topLeftMatrix(internal.targetUvToRectifiedUv) |
| `sourceToProcessed` | number[9] | forward |
| `processedToSource` | number[9] | inverse |
| `sourcePixelsToProcessedPixels` | number[9]&#124;null | pixels(forward) |
| `processedPixelsToSourcePixels` | number[9]&#124;null | pixels(inverse) |
| `cropPixels` | object&#124;null | width && height ? { x: p.cropX * width, y: (1 - p.cropY - p.cropHeight) * height, width: p.cropWidth * width, height: p.cropHeight * height } : null |
| `cropPixels.x` | number | p.cropX * width |
| `cropPixels.y` | number | (1 - p.cropY - p.cropHeight) * height |
| `cropPixels.width` | number | p.cropWidth * width |
| `cropPixels.height` | number | p.cropHeight * height |
| `cornerOrder` | array | ["TOP_LEFT", "TOP_RIGHT", "BOTTOM_RIGHT", "BOTTOM_LEFT"] |
| `clipping` | string | internal.clipping |

## ImageRegionCoordinates

이미지 사각영역 정규 좌표 + 픽셀 좌표. 해상도가 없으면 pixels/pixelGeometry=null.

JSON 위치: `observationPoints[].imageAnalysis.source`, `observationConfig.observationPoints[].imageAnalysis.source`, `observationPoints[].imageAnalysis.processed`, `observationConfig.observationPoints[].imageAnalysis.processed`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/imageAnalysisContract.js](../../../src/features/digitalTwin/editor/model/imageAnalysisContract.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `origin` | string | "TOP_LEFT" |
| `unit` | string | "NORMALIZED" |
| `*` | JSON (확장/병합) | describe(corners) |
| `pixels` | number[4][2]&#124;null | pixelGeometry?.corners ?? null |
| `pixelGeometry` | object&#124;null | pixelGeometry |

## ImageRegionGeometry

모서리 4개, 경계 박스, 변 길이, 면적. 상위 단위(정규좌표 또는 px)에 따름.

JSON 위치: `observationPoints[].imageAnalysis.source`, `observationConfig.observationPoints[].imageAnalysis.source`, `observationPoints[].imageAnalysis.processed`, `observationConfig.observationPoints[].imageAnalysis.processed`, `observationPoints[].imageAnalysis.source.pixelGeometry`, `observationConfig.observationPoints[].imageAnalysis.source.pixelGeometry`, `observationPoints[].imageAnalysis.processed.pixelGeometry`, `observationConfig.observationPoints[].imageAnalysis.processed.pixelGeometry`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/imageAnalysisContract.js](../../../src/features/digitalTwin/editor/model/imageAnalysisContract.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `corners` | number[4][2] | vertices |
| `bounds` | object | { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y } |
| `bounds.x` | number | x |
| `bounds.y` | number | y |
| `bounds.width` | number | Math.max(...xs) - x |
| `bounds.height` | number | Math.max(...ys) - y |
| `edgeLengths` | array | vertices.map((a, i) => Math.hypot(a[0] - vertices[(i + 1) % 4][0], a[1] - vertices[(i + 1) % 4][1])) |
| `area` | number | Math.abs(vertices.reduce((sum, a, i) => { const b = vertices[(i + 1) % 4]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2 |

## Calibration

별도 보정 API 요청. layout의 센서/모델/좌표계에서 계산. 자동으로 layout 루트에 추가하지 않는다.

JSON 위치: `$calibration`, `sensorBindings[].calibration.payload`, `observationConfig.sensorBindings[].calibration.payload`.

원본 저장: `dt_calibration.payload_json`, `dt_project_revision.layout_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/monitoringContract.js](../../../src/features/digitalTwin/editor/model/monitoringContract.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `schemaVersion` | number | slot ? 3 : coordinateFrame ? 2 : 1 |
| `projectId` | string | projectId |
| `equipmentId` | string | equipment.id |
| `sensorId` | string | sensor.serverSensorId |
| `coordinateFrame` | object | coordinateFrame |
| `serialNumber` | string | sensor.serialNumber |
| `bindingId` | string | sensor.id |
| `capabilities` | array | getSensorCapabilities(sensor) |
| `model` | object | modelReference(equipment, assets) |
| `coordinateSystem` | object | { unit: "m", handedness: "RIGHT", up: "+Y", rotationUnit: "rad", rotationOrder: "XYZ", sensorForward: "-Y", sensorUp: "-Z" } |
| `coordinateSystem.unit` | string | "m" |
| `coordinateSystem.handedness` | string | "RIGHT" |
| `coordinateSystem.up` | string | "+Y" |
| `coordinateSystem.rotationUnit` | string | "rad" |
| `coordinateSystem.rotationOrder` | string | "XYZ" |
| `coordinateSystem.sensorForward` | string | "-Y" |
| `coordinateSystem.sensorUp` | string | "-Z" |
| `pose` | object | { space: coordinateFrame &#124;&#124; sensor.mountMode === "EQUIPMENT" ? "EQUIPMENT_LOCAL" : "WORLD", position: vector(referencePose.position), rotation: vector(referencePose.rotation) } |
| `pose.space` | string | coordinateFrame &#124;&#124; sensor.mountMode === "EQUIPMENT" ? "EQUIPMENT_LOCAL" : "WORLD" |
| `pose.position` | number[3] | vector(referencePose.position) |
| `pose.rotation` | number[3] | vector(referencePose.rotation) |
| `surfaceMount` | object | sensor.surfaceMount |
| `mountingIssue` | string | mountingIssue |
| `scanSlotMount` | object&#124;null | slot ? { coordinateSpace: "SCAN_SLOT", equipmentId: equipment.id, side: slot.side, index: slot.index, position: vector(sensor.scanSlotMount.position), slotFrame: scanSlotFrame(equipment, slot) } : null |
| `scanSlotMount.coordinateSpace` | string | "SCAN_SLOT" |
| `scanSlotMount.equipmentId` | string | equipment.id |
| `scanSlotMount.side` | string | slot.side |
| `scanSlotMount.index` | integer | slot.index |
| `scanSlotMount.position` | number[3] | vector(sensor.scanSlotMount.position) |
| `scanSlotMount.slotFrame` | object | scanSlotFrame(equipment, slot) |
| `textureProjection` | object | normalizeSensorProjection(sensor.textureProjection) |
| `imageTransform` | object | imageAnalysisTransform(sensor) |
| `imageProcessing` | object | imageProcessingPayload(projectId, equipment, sensor, assets) |
| `equipmentTransform` | object | { position: vector(equipment.position), rotation: vector(equipment.rotation) } |
| `equipmentTransform.position` | number[3] | vector(equipment.position) |
| `equipmentTransform.rotation` | number[3] | vector(equipment.rotation) |
| `camera` | object | { fieldOfView: Number(sensor.fieldOfView), aspectRatio: Number(sensor.aspectRatio), near: Number(sensor.near), far: Number(sensor.far), intrinsics: sensor.intrinsics ?? null, calibrationId: sensor.intrinsicCalibrationId ?? null, resolution: sensor.resolution ?? null } |
| `camera.fieldOfView` | number | Number(sensor.fieldOfView) |
| `camera.aspectRatio` | number | Number(sensor.aspectRatio) |
| `camera.near` | number | Number(sensor.near) |
| `camera.far` | number | Number(sensor.far) |
| `camera.intrinsics` | object&#124;null | sensor.intrinsics ?? null |
| `camera.calibrationId` | string&#124;null | sensor.intrinsicCalibrationId ?? null |
| `camera.resolution` | object&#124;null | sensor.resolution ?? null |
| `method` | string | "MANUAL" |
| `dataSource` | string | sensor.dataSource === "DEMO" ? "DEMO" : "SERVER" |

## ImageProcessing

별도 이미지 처리 API 요청 schemaVersion=4.

JSON 위치: `$imageProcessing`, `$calibration.imageProcessing`, `sensorBindings[].calibration.payload.imageProcessing`, `observationConfig.sensorBindings[].calibration.payload.imageProcessing`.

원본 저장: `dt_image_processing.payload_json`, `dt_calibration.payload_json`, `dt_project_revision.layout_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/monitoringContract.js](../../../src/features/digitalTwin/editor/model/monitoringContract.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `schemaVersion` | number | 4 |
| `projectId` | string | projectId |
| `sensorId` | string&#124;null | sensor.serverSensorId ?? null |
| `bindingId` | string | sensor.id |
| `serialNumber` | string | sensor.serialNumber ?? "" |
| `imageTransform` | object | imageAnalysisTransform(sensor) |
| `target` | object | { equipmentId: p.equipmentId ?? equipment.id, model: modelReference(equipment, assets), representation: p.target, surfaceId: p.surfaceId, meshPath: p.meshPath, meshName: p.meshName, mapping: "OBJECT_SURFACE_PLANAR", surface: resolveImageSurface(equipment, p), enabled: p.enabled, opacity: p.opacity } |
| `target.equipmentId` | string | p.equipmentId ?? equipment.id |
| `target.model` | object | modelReference(equipment, assets) |
| `target.representation` | string | p.target |
| `target.surfaceId` | string | p.surfaceId |
| `target.meshPath` | string | p.meshPath |
| `target.meshName` | string | p.meshName |
| `target.mapping` | string | "OBJECT_SURFACE_PLANAR" |
| `target.surface` | object | resolveImageSurface(equipment, p) |
| `target.enabled` | boolean | p.enabled |
| `target.opacity` | number | p.opacity |

## ModelReference

geometry-* 버전은 모델 비교 식별자. DB revision이나 파일 SHA와 다르다.

JSON 위치: `$calibration.model`, `$imageProcessing.target.model`, `observationPoints[].model`, `observationConfig.observationPoints[].model`, `sensorBindings[].calibration.payload.model`, `observationConfig.sensorBindings[].calibration.payload.model`.

원본 저장: `dt_calibration.payload_json`, `dt_image_processing.payload_json`, `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`, `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/monitoringContract.js](../../../src/features/digitalTwin/editor/model/monitoringContract.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `assetId` | string&#124;null | asset?.assetId ?? null |
| `scanAssets` | array | identity.scans |
| `version` | string | &#96;geometry-${(hash >>> 0).toString(16)}&#96; |

## ScanSlotFrame

FRONT/REAR, index 0..4; 문 앞에서 +X 오른쪽, +Y 위, -Z 내부.

JSON 위치: `$calibration.scanSlotMount.slotFrame`, `observationPoints[].scanSlotFrame`, `observationConfig.observationPoints[].scanSlotFrame`.

원본 저장: `dt_calibration.payload_json`, `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentCoordinateFrame.js](../../../src/features/digitalTwin/editor/model/equipmentCoordinateFrame.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | &#96;${equipment.id}:${slot.id}&#96; |
| `equipmentId` | string | equipment.id |
| `side` | string | slot.side |
| `index` | integer | slot.index |
| `origin` | array | [slot.origin.x, slot.origin.y, slot.origin.z] |
| `rotationY` | number | slot.rotationY |
| `dimensions` | object | slot.dimensions |
| `unit` | string | "m" |
| `axes` | object | { right: "+X", up: "+Y", inward: "-Z" } |
| `axes.right` | string | "+X" |
| `axes.up` | string | "+Y" |
| `axes.inward` | string | "-Z" |

## ServerBindingCreated

연결 생성 필드 전체. pollingInterval ms. transform 문자열은 사용자 입력이며 DB에서 실행하지 않는다.

JSON 위치: `serverBindings[]`, `observationConfig.serverBindings[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_server_binding.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useMonitoringState.js](../../../src/features/digitalTwin/editor/store/useMonitoringState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | id |
| `equipmentId` | string | equipmentId |
| `observationPointId` | string | observationPointId |
| `targetPartId` | string | targetPartId |
| `metric` | string | metric |
| `unit` | string | unit |
| `sourceDeviceId` | string | sourceDeviceId |
| `sourceType` | string | device?.sensorType ?? "SENSOR" |
| `serverKey` | string | device?.serverKey ?? "" |
| `protocol` | string | device?.sensorType === "CAMERA" ? "RTSP" : "MQTT" |
| `endpoint` | string | "" |
| `topicOrPath` | string | "" |
| `valuePath` | string | "$.value" |
| `pollingInterval` | number | 1000 |
| `transform` | string | "value" |
| `normalRange` | object | { min: 0, max: 60 } |
| `normalRange.min` | number | 0 |
| `normalRange.max` | number | 60 |
| `warningRange` | object | { min: 60, max: 80 } |
| `warningRange.min` | number | 60 |
| `warningRange.max` | number | 80 |
| `dangerRange` | object | { min: 80, max: 120 } |
| `dangerRange.min` | number | 80 |
| `dangerRange.max` | number | 120 |
| `enabled` | boolean | true |

## VirtualCameraRegion

가상 카메라 영상에서 선택한 사각영역. rect는 좌상단 정규좌표, vertices는 설비 로컬 m.

JSON 위치: `observationPoints[].virtualCameraRegion`, `observationConfig.observationPoints[].virtualCameraRegion`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/components/VirtualCameraViewport.jsx](../../../src/features/digitalTwin/editor/components/VirtualCameraViewport.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `cameraId` | string | camera.id |
| `doorState` | object&#124;null | camera.doorState ?? null |
| `rect` | object | rect |
| `imageSize` | object | { width: 640, height: 400 } |
| `imageSize.width` | number | 640 |
| `imageSize.height` | number | 400 |
| `coordinateOrigin` | string | "TOP_LEFT" |
| `space` | string | "EQUIPMENT_MODEL_LOCAL" |
| `vertices` | array | vertices |
| `view` | object | camera.view |
| `texture` | object | { kind: configuration.textureKind, sensorId: center.sensor.id, sourceUvCorners: sourceCorners, sourcePixelCorners: sourceCorners.map(([x, y]) => [x * (imageBinding?.originalImage?.width ?? thermalBinding?.source?.width ?? center.sensor.resolution?.width ?? 0), y * (imageBinding?.originalImage?.height ?? thermalBinding?.source?.height ?? center.sensor.resolution?.height ?? 0)]) } |
| `texture.kind` | string | configuration.textureKind |
| `texture.sensorId` | string | center.sensor.id |
| `texture.sourceUvCorners` | array | sourceCorners |
| `texture.sourcePixelCorners` | array | sourceCorners.map(([x, y]) => [x * (imageBinding?.originalImage?.width ?? thermalBinding?.source?.width ?? center.sensor.resolution?.width ?? 0), y * (imageBinding?.originalImage?.height ?? thermalBinding?.source?.height ?? center.sensor.resolution?.height ?? 0)]) |

## OriginalImage

원본/기준 사진 메타데이터. 실제 blob은 textureAssetRepository 및 자산 전송에 존재.

JSON 위치: `observationPoints[].imageBinding.originalImage`, `observationConfig.observationPoints[].imageBinding.originalImage`, `observationPoints[].imageAnalysis.originalImage`, `observationConfig.observationPoints[].imageAnalysis.originalImage`, `observationPoints[].measurements[].analysisConfig.referenceFrame`, `observationConfig.observationPoints[].measurements[].analysisConfig.referenceFrame`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/api/imageObservationAsset.js](../../../src/features/digitalTwin/editor/api/imageObservationAsset.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `textureAssetId` | string | id |
| `name` | string | name |
| `width` | number | width |
| `height` | number | height |
| `sensorBindingId` | string | sensor.id |
| `serverSensorId` | string&#124;null | sensor.serverSensorId ?? null |
| `serialNumber` | string | sensor.serialNumber ?? "" |
| `sourceUrl` | string | source.url |
| `measuredAt` | string | source.measuredAt |
| `capturedAt` | string | new Date().toISOString() |
| `kind` | string | "UNPROCESSED_CAMERA_FRAME" |

## LedColorProfile

LED 색상 전체 설정. hue는 각도 구간 배열; 흰색은 saturationMax/brightnessMin을 사용.

JSON 위치: `observationPoints[].measurements[].analysisConfig.colors[]`, `observationConfig.observationPoints[].measurements[].analysisConfig.colors[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/components/ObservationProfileFields.jsx](../../../src/features/digitalTwin/editor/components/ObservationProfileFields.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `colorKey` | string | color.id |
| `hex` | string | color.hex |
| `hue` | number[][]&#124;null | color.hue ?? null |
| `saturationMax` | number&#124;null | color.saturationMax ?? null |
| `brightnessMin` | number&#124;null | color.brightnessMin ?? null |
| `stateCode` | string | "" |
| `level` | string | "NORMAL" |

## SavedCalibration

센서 객체 안에 저장된 보정 결과 원문, payload는 Calibration과 동일. signature=JSON.stringify(payload).

JSON 위치: `sensorBindings[].calibration`, `observationConfig.sensorBindings[].calibration`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/components/SensorConnectionFields.jsx](../../../src/features/digitalTwin/editor/components/SensorConnectionFields.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | result |
| `payload` | object | payload |
| `signature` | string | JSON.stringify(payload) |
| `savedAt` | string | new Date().toISOString() |
| `storage` | string | storedRemotely ? "SERVER" : "LOCAL" |

## ModelScanReference

모델 버전 계산에 포함되는 모든 스캔 연결. alignment는 AlignmentTransform, slotFrame은 ScanSlotFrame 구조.

JSON 위치: `$calibration.model.scanAssets[]`, `$imageProcessing.target.model.scanAssets[]`, `observationPoints[].model.scanAssets[]`, `observationConfig.observationPoints[].model.scanAssets[]`, `sensorBindings[].calibration.payload.model.scanAssets[]`, `observationConfig.sensorBindings[].calibration.payload.model.scanAssets[]`.

원본 저장: `dt_calibration.payload_json`, `dt_image_processing.payload_json`, `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`, `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/monitoringContract.js](../../../src/features/digitalTwin/editor/model/monitoringContract.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `assetId` | string | scan.assetId |
| `scanSlot` | object&#124;null | scan.scanSlot |
| `slotFrame` | object&#124;null | scan.scanSlot ? scanSlotFrame(equipment, getEnclosureScanSlot(equipment, scan.scanSlot.index, scan.scanSlot.side)) : null |
| `alignment` | object | scan.alignmentTransform |
| `sourceType` | string | scan.sourceType |
| `sourceKey` | string | scan.sourceKey |
| `assetType` | string | scan.assetType |

## ImportedRois

선택형 표면 ROI 원문 보존. BE 2026-11-20 전달서의 승인 대기 최소안을 FE에 구현했으며 공개 계약 수용은 별도 확인한다. 감시 등록 API를 호출하지 않는다.

JSON 위치: `importedRois[]`.

원본 저장: `dt_project_revision.layout_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/projects/projectRawRois.js](../../../src/features/portal/projects/projectRawRois.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | 로컬 ROI ID. 관측점과 중복 제외 |
| `equipmentId` | string | 원 설비 ID |
| `revision` | integer | 원문 revision 보존. 복원 시 증가하지 않음 |
| `surface` | object | 좌표·outline·triangles 등 원문 보존 |
| `*` | JSON | 미지 필드·시각·null/false/0 포함 원문 보존 |

## SensorExtras

UI 입력과 센서 조회 응답에서 병합되는 항목. 서버 센서 장치 데이터와 프론트 배치 데이터의 ID를 구별한다.

JSON 위치: `sensorBindings[]`, `observationConfig.sensorBindings[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/components/SensorConnectionFields.jsx](../../../src/features/digitalTwin/editor/components/SensorConnectionFields.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `name` | string | 표시 이름 |
| `identifier` | string | legacy serverKey 대체 입력 |
| `equipmentId` | string | legacy 단일 대상 |
| `dataSource` | string | SERVER/DEMO |
| `connectionStatus` | string | 서버 조회 상태 |
| `frameUrl` | string&#124;null | 영상 프레임 URL |
| `frameMeasuredAt` | string&#124;null | 프레임 측정 시각 |
| `resolution.width` | number | 원본 픽셀 가로 |
| `resolution.height` | number | 원본 픽셀 세로 |
| `intrinsics` | object&#124;null | 서버 응답 원문; 프론트 고정 필드 정의 없음 |
| `intrinsicCalibrationId` | string&#124;null | 렌즈 보정 ID |
| `calibrationConfirmed` | boolean | 수동 보정 확인 |
| `calibrationConfirmationFrame` | string | frame.id:version 또는 MODEL_LOCAL |
| `calibrationConfirmationModel` | string | geometry-* 모델 지문 |
| `surfaceMount.equipmentId` | string | 부착 대상 설비 |
| `surfaceMount.surfaceId` | string | 표면 ID |
| `surfaceMount.u` | number | 표면 왼쪽에서 m |
| `surfaceMount.v` | number | 표면 아래에서 m |
| `surfaceMount.offset` | number | 표면과 센서 중심 거리 m; 초기 .025 |
| `scanSlotMount.equipmentId` | string | 슬롯 대상 설비 |
| `scanSlotMount.side` | string | FRONT/REAR |
| `scanSlotMount.index` | integer | 0..4 |
| `scanSlotMount.position` | object | {x,y,z} m, SCAN_SLOT 기준 |
| `projectionSample` | object&#124;null | 샘플 표시 설정; 샘플을 실측으로 취급하지 않음 |
| `thermalSample` | object&#124;null | 열화상 샘플 설정 |
| `*` | JSON | normalizeSensorBinding의 ...device로 허용된 추가 속성 원문 보존 |

## ObservationExtras

관측 영역 추가 속성 및 가상 카메라에 그린 사각형.

JSON 위치: `observationPoints[]`, `observationConfig.observationPoints[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/components/VirtualCameraViewport.jsx](../../../src/features/digitalTwin/editor/components/VirtualCameraViewport.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `representation` | string | ACTUAL/PROXY/BOTH |
| `sourceDeviceId` | string&#124;null | legacy 센서 연결 |
| `metric` | string | legacy 단일 측정 항목 |
| `unit` | string | legacy 단위 |
| `previewValue` | number | legacy 미리보기 값 |
| `normalRange` | object | legacy {min,max} |
| `warningRange` | object | legacy {min,max} |
| `dangerRange` | object | legacy {min,max} |
| `alertIcon` | string | legacy 경보 아이콘 |
| `imageBinding.sourceQuad` | number[4][2]&#124;null | 원본 좌상단 정규 좌표 네 점 |
| `imageBindingIssue` | string | 비전 연결 진단 메시지 |
| `virtualCameraRegion` | object&#124;null | 별도 표 참조 |
| `measurements[].sourceMode` | string | EQUIPMENT_REGION/THERMAL_TEXTURE/VISION_TEXTURE |
| `measurements[].previewValue` | number | 미리보기 값, 실시간 수신값이 아님 |
| `measurements[].rules[].operator` | string | lt/lte/gt/gte |
| `measurements[].rules[].threshold` | number | 경보 기준값 |
| `measurements[].rules[].severity` | string | WARNING/DANGER |
| `measurements[].rules[].metric` | string | GENERAL에서 ultrasound.db/TEMPERATURE |
| `measurements[].rules[].statistic` | string&#124;null | 온도 min/average/max |
| `measurements[].rules[].angleDeg` | number&#124;null | 게이지 scale에서 유도하는 각도 |
| `measurements[].analysisConfig` | object | 아래 분석 프로필 |
| `*` | JSON | ...point 보존. 계산된 이미지/슬롯 참조 속성도 삭제하지 않는다 |

## AnalysisProfile

관측 항목별 분석 설정. GENERAL/초음파/온도/게이지/스위치/LED/밸브에 따라 사용 항목이 다르다.

JSON 위치: `observationPoints[].measurements[].analysisConfig`, `observationConfig.observationPoints[].measurements[].analysisConfig`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/components/ObservationProfileFields.jsx](../../../src/features/digitalTwin/editor/components/ObservationProfileFields.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `schemaVersion` | integer | 1 |
| `bands[].id` | string | LOW/MID/HIGH 등 |
| `bands[].name` | string | 주파수 대역명 |
| `bands[].fromHz` | number | 시작 Hz >=0 |
| `bands[].toHz` | number | 종료 Hz > fromHz |
| `scale.startAngleDeg` | number | 바늘 시작 각도 |
| `scale.startValue` | number | 시작 표시값 |
| `scale.endAngleDeg` | number | 바늘 끝 각도 |
| `scale.endValue` | number | 끝 표시값 |
| `pairId` | string | OPEN_CLOSED/POWER/NORMAL_ABNORMAL/NORMAL_FAULT/RUNNING_STOPPED/ACTIVE_INACTIVE/READY_STANDBY/LOCKED_UNLOCKED/CONNECTED_DISCONNECTED/SUPPLY |
| `referenceState` | string | 선택 상태 쌍 중 현재 기준 상태 |
| `levels.{stateCode}` | string | 상태별 NORMAL/WARNING/DANGER 등 표시 판정 |
| `referenceFrame` | object&#124;null | 기준 이미지 레코드 + sourceRect/sourceQuad/coordinateOrigin |
| `colors[].colorKey` | string | RED/ORANGE/AMBER/YELLOW/LIME/GREEN/CYAN/BLUE/PURPLE/WHITE |
| `colors[].stateCode` | string | OBSERVATION_STATES 코드 |
| `colors[].level` | string | 상태별 경보 수준 |
| `*` | JSON | 프로필 확장 키 보존 |

## ServerBindings

서버 연결은 프론트에서 자유 객체로 보관한다. 알려진 생성 필드와 미정 확장 영역을 분리한다.

JSON 위치: `serverBindings[]`, `observationConfig.serverBindings[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_server_binding.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useMonitoringState.js](../../../src/features/digitalTwin/editor/store/useMonitoringState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON | serverBindings 원본 배열 요소 전체; ServerBindingCreated 표 참조. 기존 운영 DB FK를 추측해 변환하지 않는다 |

## ImageSourceAndTransforms

source 필드 및 행렬 크기. 행렬 숫자는 순서 그대로 보존한다.

JSON 위치: `observationPoints[].imageAnalysis.imageTransform`, `observationConfig.observationPoints[].imageAnalysis.imageTransform`, `observationPoints[].thermalBinding.imageTransform`, `observationConfig.observationPoints[].thermalBinding.imageTransform`, `$imageProcessing.imageTransform`, `$calibration.imageTransform`.

원본 저장: `dt_project_revision.layout_json`, `dt_image_processing.payload_json`, `dt_calibration.payload_json`. 검색용 복제: `dt_spatial_roi.roi_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/sensorImageTransform.js](../../../src/features/digitalTwin/editor/model/sensorImageTransform.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `source.type` | string | SAMPLE/DEMO/SERVER |
| `source.url` | string&#124;null | 원본 영상 URL |
| `source.width` | number&#124;null | 원본 가로 px |
| `source.height` | number&#124;null | 원본 세로 px |
| `source.loadedAt` | string&#124;null | 샘플 적재 시각 |
| `source.measuredAt` | string&#124;null | 프레임 측정 시각 |
| `source.*` | JSON | originalImage 병합 시 textureAssetId 등도 포함 |
| `sourceToProcessed` | number[9] | 3×3 ROW_MAJOR |
| `processedToSource` | number[9] | 역변환 |
| `sourcePixelsToProcessedPixels` | number[9]&#124;null | 픽셀 공간 순변환 |
| `processedPixelsToSourcePixels` | number[9]&#124;null | 픽셀 공간 역변환 |
| `stages[].matrix` | number[9] | 단계별 변환 |
| `stages[].inverseMatrix` | number[9] | 단계별 역변환 |

## SensorSupplement

센서 응답·샘플·보정 저장의 나머지 필드.

JSON 위치: `sensorBindings[]`, `observationConfig.sensorBindings[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_sensor_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/components/SensorConnectionFields.jsx](../../../src/features/digitalTwin/editor/components/SensorConnectionFields.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `reportedCapabilities[]` | string | 서버 조회 응답 기능 목록 |
| `calibration` | object&#124;null | SavedCalibration |
| `projectionSample.enabled` | boolean | 비전 샘플 활성화 |
| `projectionSample.url` | string | 허용 샘플 VISION_SAMPLE_URL |
| `projectionSample.width` | number | px |
| `projectionSample.height` | number | px |
| `projectionSample.loadedAt` | string | ISO 시각 |
| `thermalSample.enabled` | boolean | 열화상 샘플 활성화 |
| `thermalSample.url` | string | 허용 THERMAL_SAMPLE_URL |
| `thermalSample.width` | number | CSV 가로 |
| `thermalSample.height` | number | CSV 세로 |
| `thermalSample.loadedAt` | string | ISO 시각 |
| `scanSlotMount.position.x` | number | 슬롯 m |
| `scanSlotMount.position.y` | number | 슬롯 m |
| `scanSlotMount.position.z` | number | 슬롯 m |
| `heatmap.position.x` | number | m |
| `heatmap.position.y` | number | m |
| `heatmap.position.z` | number | m |
| `textureProjection.surfaceMapping.normal` | number[3] | 표면 단위법선 |

## ScanSlotAndDimensions

슬롯과 크기 사전의 전체 정적 키.

JSON 위치: `equipmentAssetBindings[]`, `observationConfig.equipmentAssetBindings[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_object_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentDetailModel.js](../../../src/features/digitalTwin/editor/model/equipmentDetailModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `scanSlot.side` | string | FRONT/REAR |
| `scanSlot.index` | integer | 0..4; 유효하지 않으면 scanSlot=null |
| `alignmentTransform.targetDimensions.width` | number | 0보다 큰 m, 미지정 키 생략 |
| `alignmentTransform.targetDimensions.height` | number | 0보다 큰 m, 미지정 키 생략 |
| `alignmentTransform.targetDimensions.depth` | number | 0보다 큰 m, 미지정 키 생략 |

