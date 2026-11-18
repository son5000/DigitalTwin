# 뷰어 JSON 필드 사전 — assets

기준: 2026-11-17, layout.version=18. [전체 계약과 DB 설계](../viewer-json-database-contract.md).

이 파일은 `node scripts/generate-viewer-field-reference.mjs`로 소스와 명시적 보충 사전에서 생성한다. 기본값 칸은 **현 프론트의 생성·정규화 식 원문**이다. 전달 값이 없을 때의 프론트 동작을 보여 주며 서버가 이 식으로 값을 덮어쓰라는 뜻이 아니다. `JSON (식 참조)`는 프론트가 스키마를 고정하지 않은 값으로, 식·하위 표·카탈로그를 함께 확인한다. 선택 기능의 키는 없을 수 있고, null/false/0/빈 배열과 누락은 서로 다르다.

모든 경로의 기본 저장 위치는 `dt_project_revision.layout_json`의 **동일 경로**다. 자산·로컬 상태는 각 표의 별도 위치를 따른다. `[]`는 배열 인덱스, `{id}`는 실제 ID, `*`는 임의 하위 키를 뜻한다. 각 표의 DB 컬럼 안에도 해당 객체의 모든 하위 키를 그대로 넣는다.

## CustomEquipment

공방 설비 원본(schemaVersion=2). 자산 JSON 전체 보존; 인스턴스 customAssetSnapshot에도 같은 정의 가능.

JSON 위치: `$assets.custom[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/equipment/customEquipmentModel.js](../../../src/features/customAssets/equipment/customEquipmentModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | createCustomAssetId(CUSTOM_ASSET_TYPES.EQUIPMENT) |
| `type` | string | CUSTOM_ASSET_TYPES.EQUIPMENT |
| `schemaVersion` | integer | CUSTOM_ASSET_SCHEMA_VERSION |
| `revision` | number | 1 |
| `name` | string | "새 커스텀 설비" |
| `description` | string | "" |
| `tags` | array | ["산업설비"] |
| `status` | string | CUSTOM_ASSET_STATUS.DRAFT |
| `createdAt` | string | now |
| `updatedAt` | string | now |
| `thumbnail` | string | "" |
| `origin` | object | { x: 0, y: 0, z: 0 } |
| `origin.x` | number | 0 |
| `origin.y` | number | 0 |
| `origin.z` | number | 0 |
| `transform` | object | { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } |
| `transform.position` | object | { x: 0, y: 0, z: 0 } |
| `transform.position.x` | number | 0 |
| `transform.position.y` | number | 0 |
| `transform.position.z` | number | 0 |
| `transform.rotation` | object | { x: 0, y: 0, z: 0 } |
| `transform.rotation.x` | number | 0 |
| `transform.rotation.y` | number | 0 |
| `transform.rotation.z` | number | 0 |
| `transform.scale` | object | { x: 1, y: 1, z: 1 } |
| `transform.scale.x` | number | 1 |
| `transform.scale.y` | number | 1 |
| `transform.scale.z` | number | 1 |
| `appearance` | object | { materialPreset: "PAINTED_METAL", color: "#668896" } |
| `appearance.materialPreset` | string | "PAINTED_METAL" |
| `appearance.color` | string | "#668896" |
| `groups` | array | [] |
| `parts` | array | [createCustomEquipmentPart()] |

## CustomEquipmentDerived

부품 정규화와 재계산한 경계·수량. 기존 source 필드와 합쳐 저장.

JSON 위치: `$assets.custom[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/equipment/customEquipmentModel.js](../../../src/features/customAssets/equipment/customEquipmentModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | source |
| `parts` | array | normalizedParts |
| `groups` | array | groups |
| `origin` | object | source.origin ? vector(source.origin) : vector(center) |
| `bounds` | object | { width: size.x, height: size.y, depth: size.z, center: vector(center) } |
| `bounds.width` | number | size.x |
| `bounds.height` | number | size.y |
| `bounds.depth` | number | size.z |
| `bounds.center` | object | vector(center) |
| `metrics` | object | { partCount: normalizedParts.length, segmentCount: normalizedParts.filter((part) => part.type === "PIPE_STRAIGHT").length, junctionCount: normalizedParts.filter((part) => ["PIPE_T", "PIPE_Y", "PIPE_CROSS"].includes(part.type)).length, connectionCount: pairs.size, groupCount: groups.length } |
| `metrics.partCount` | integer | normalizedParts.length |
| `metrics.segmentCount` | integer | normalizedParts.filter((part) => part.type === "PIPE_STRAIGHT").length |
| `metrics.junctionCount` | integer | normalizedParts.filter((part) => ["PIPE_T", "PIPE_Y", "PIPE_CROSS"].includes(part.type)).length |
| `metrics.connectionCount` | integer | pairs.size |
| `metrics.groupCount` | integer | groups.length |

## CustomEquipmentPart

공방 부품. 설비 템플릿별 parameters·dimensions 및 포트 연결.

JSON 위치: `$assets.custom[].parts[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/equipment/customEquipmentModel.js](../../../src/features/customAssets/equipment/customEquipmentModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | id |
| `type` | string | definition.id |
| `templateId` | string | definition.templateId |
| `categoryId` | string | definition.categoryId |
| `partKind` | string | definition.partKind |
| `name` | string | overrides.name ?? definition.nameKo |
| `position` | object | vector(overrides.position) |
| `rotation` | object | vector(overrides.rotation) |
| `dimensions` | object | dimensions |
| `parameters` | object | parameters |
| `groupId` | string&#124;null | overrides.groupId ?? null |
| `appearance` | object | { materialPreset: "PAINTED_METAL", color: "#668896", roughness: 0.48, metalness: 0.62, ...(definition.defaultAppearance ?? definition.appearance), ...overrides.appearance } |
| `appearance.materialPreset` | string | "PAINTED_METAL" |
| `appearance.color` | string | "#668896" |
| `appearance.roughness` | number | 0.48 |
| `appearance.metalness` | number | 0.62 |
| `appearance.*` | JSON (확장/병합) | definition.defaultAppearance ?? definition.appearance |
| `appearance.*` | JSON (확장/병합) | overrides.appearance |
| `ports` | array | portSpecs(definition.id, parameters, dimensions).map((port) => ({ ...port, connectedTo: previous.get(port.id) ?? null })) |
| `ports[].*` | JSON (확장/병합) | port |
| `ports[].connectedTo` | object&#124;null | previous.get(port.id) ?? null |

## CustomPort

포트의 connectedTo={partId,portId}|null. 위치/지름 m. 방향 단위벡터.

JSON 위치: `$assets.custom[].parts[].ports[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/equipment/customEquipmentModel.js](../../../src/features/customAssets/equipment/customEquipmentModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | id |
| `localPosition` | object | position |
| `direction` | object | direction |
| `diameter` | number | size |
| `role` | string | role |
| `connectedTo` | object&#124;null | null |
| `connectable` | boolean | true |

## CustomBuilding

공방 건물 원본. authoringMode에 따라 blockGrid/assembly/sections를 보존.

JSON 위치: `$assets.custom[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/buildingDefaults.js](../../../src/features/customAssets/building/buildingDefaults.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | createCustomAssetId() |
| `type` | string | CUSTOM_ASSET_TYPES.BUILDING |
| `schemaVersion` | integer | CUSTOM_ASSET_SCHEMA_VERSION |
| `revision` | number | 1 |
| `name` | string | "새 커스텀 건축물" |
| `description` | string | "" |
| `tags` | array | [] |
| `category` | string | "업무시설" |
| `status` | string | CUSTOM_ASSET_STATUS.DRAFT |
| `thumbnail` | string | "" |
| `createdAt` | string | timestamp |
| `updatedAt` | string | timestamp |
| `unit` | string | "m" |
| `floorHeight` | number | 3.6 |
| `sections` | array | sections |
| `materials` | array | [ { id: "facade-default", name: "기본 외벽", presetId: "CONCRETE", color: "#87979D", roughness: 0.76, metalness: 0.04 }, { id: "roof-default", name: "기본 지붕", presetId: "PAINTED_METAL", color: "#5F7078", roughness: 0.56, metalness: 0.34 }, ] |
| `materials[].id` | string | "facade-default" |
| `materials[].name` | string | "기본 외벽" |
| `materials[].presetId` | string | "CONCRETE" |
| `materials[].color` | string | "#87979D" |
| `materials[].roughness` | number | 0.76 |
| `materials[].metalness` | number | 0.04 |
| `materials[].id` | string | "roof-default" |
| `materials[].name` | string | "기본 지붕" |
| `materials[].presetId` | string | "PAINTED_METAL" |
| `materials[].color` | string | "#5F7078" |
| `materials[].roughness` | number | 0.56 |
| `materials[].metalness` | number | 0.34 |
| `bounds` | object | { width: 0, depth: 0, height: 0 } |
| `bounds.width` | number | 0 |
| `bounds.depth` | number | 0 |
| `bounds.height` | number | 0 |
| `metrics` | object | { totalFloorAreaM2: 0, totalFloorAreaPyeong: 0, buildingAreaM2: 0, floorCount: 0 } |
| `metrics.totalFloorAreaM2` | number | 0 |
| `metrics.totalFloorAreaPyeong` | number | 0 |
| `metrics.buildingAreaM2` | number | 0 |
| `metrics.floorCount` | number | 0 |
| `authoringMode` | string | templateId === "BLOCK" ? CUSTOM_BUILDING_AUTHORING_MODES.BLOCK : CUSTOM_BUILDING_AUTHORING_MODES.OUTLINE |
| `blockGrid` | object | createDefaultBlockGrid() |

## BuildingSection

층 구간별 윤곽과 재질. 동일 자산의 materials.id 참조.

JSON 위치: `$assets.custom[].sections[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/buildingDefaults.js](../../../src/features/customAssets/building/buildingDefaults.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | &#96;section-${crypto.randomUUID()}&#96; |
| `startFloor` | integer | startFloor |
| `endFloor` | integer | endFloor |
| `floorHeight` | number | 3.6 |
| `footprint` | object | createBuildingFootprint(templateId, width, depth) |
| `offset` | object | offset |
| `rotation` | number | 0 |
| `materialId` | string | "facade-default" |
| `color` | string | color |

## BlockGrid

블록 건물 격자. cells 좌표 정수, cellSize/levelHeight m.

JSON 위치: `$assets.custom[].blockGrid`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/blockBuildingModel.js](../../../src/features/customAssets/building/blockBuildingModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `version` | number | 1 |
| `cellSize` | number | cellSize |
| `levelHeight` | number | levelHeight |
| `cells` | array | [...unique.values()].sort(compareCells) |

## BlockCell

블록 좌표 x/z 정수, level은 0 이상 정수.

JSON 위치: `$assets.custom[].blockGrid.cells[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/blockBuildingModel.js](../../../src/features/customAssets/building/blockBuildingModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `x` | number | Math.round(Number(cell.x) &#124;&#124; 0) |
| `z` | number | Math.round(Number(cell.z) &#124;&#124; 0) |
| `level` | number | Math.max(0, Math.round(Number(cell.level) &#124;&#124; 0)) |

## BuildingAssembly

복합 건물 원본. MASS/CONNECTOR/VOID 계열 엔티티와 그룹·관계.

JSON 위치: `$assets.custom[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/buildingAssembly.js](../../../src/features/customAssets/building/buildingAssembly.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | source |
| `assemblyType` | string | source.assemblyType ?? "COMPLEX_BUILDING" |
| `levels` | array | levels |
| `entities` | array | entities |
| `viewGroups` | array | viewGroups |
| `relations` | array | relations |
| `defaultViewGroupId` | string | viewGroups.some((group) => group.id === source.defaultViewGroupId) ? source.defaultViewGroupId : viewGroups[0].id |
| `sections` | array | entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.MASS).map((mass) => massToLegacySection(mass, levels)) |

## BuildingLevel

층별 높이 m; 배열 순서 및 order 보존.

JSON 위치: `$assets.custom[].levels[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/buildingAssembly.js](../../../src/features/customAssets/building/buildingAssembly.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | level |
| `id` | string | level.id &#124;&#124; id("level") |
| `name` | string | String(level.name &#124;&#124; &#96;${index + 1}층&#96;) |
| `floorNumber` | integer&#124;null | level.floorNumber == null ? undefined : Number(level.floorNumber) |
| `baseElevation` | number | baseElevation |
| `topElevation` | number | topElevation |
| `height` | number | topElevation - baseElevation |
| `order` | integer | Number.isFinite(level.order) ? level.order : index |

## BuildingMass

entityType=mass. transform.rotationY는 도(deg), 일반 설비 rotation(rad)과 다름.

JSON 위치: `$assets.custom[].entities[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/buildingAssembly.js](../../../src/features/customAssets/building/buildingAssembly.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | id("mass") |
| `entityType` | string | BUILDING_ENTITY_TYPES.MASS |
| `name` | string | name |
| `tags` | array | tags |
| `levelIds` | array | [] |
| `viewGroupIds` | string[] | viewGroupIds |
| `visible` | boolean | true |
| `locked` | boolean | false |
| `translucent` | boolean | false |
| `materialId` | string | materialId |
| `color` | string | color |
| `footprint` | object | footprint |
| `verticalRange` | object | { baseElevation, topElevation } |
| `verticalRange.baseElevation` | number | baseElevation |
| `verticalRange.topElevation` | number | topElevation |
| `transform` | object | { position: { ...position }, rotationY } |
| `transform.position` | object | { ...position } |
| `transform.position.*` | JSON (확장/병합) | position |
| `transform.rotationY` | number | rotationY |

## BuildingConnector

entityType=connector. path.type straight/polyline/L/U, 폭·높이 m.

JSON 위치: `$assets.custom[].entities[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/buildingAssembly.js](../../../src/features/customAssets/building/buildingAssembly.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | id("connector") |
| `entityType` | string | BUILDING_ENTITY_TYPES.CONNECTOR |
| `name` | string | name |
| `tags` | array | ["연결부"] |
| `levelIds` | array | levelId ? [levelId] : [] |
| `viewGroupIds` | string[] | viewGroupIds |
| `visible` | boolean | true |
| `locked` | boolean | false |
| `translucent` | boolean | false |
| `connectorType` | string | connectorType |
| `from` | object | { entityId: fromEntityId, levelId, position: { x: 0, y: (baseElevation + topElevation) / 2, z: 0 }, mode: "auto" } |
| `from.entityId` | string | fromEntityId |
| `from.levelId` | string | levelId |
| `from.position` | object | { x: 0, y: (baseElevation + topElevation) / 2, z: 0 } |
| `from.position.x` | number | 0 |
| `from.position.y` | number | (baseElevation + topElevation) / 2 |
| `from.position.z` | number | 0 |
| `from.mode` | string | "auto" |
| `to` | object | { entityId: toEntityId, levelId, position: { x: 0, y: (baseElevation + topElevation) / 2, z: 0 }, mode: "auto" } |
| `to.entityId` | string | toEntityId |
| `to.levelId` | string | levelId |
| `to.position` | object | { x: 0, y: (baseElevation + topElevation) / 2, z: 0 } |
| `to.position.x` | number | 0 |
| `to.position.y` | number | (baseElevation + topElevation) / 2 |
| `to.position.z` | number | 0 |
| `to.mode` | string | "auto" |
| `path` | object | { type: pathType, points: [] } |
| `path.type` | string | pathType |
| `path.points` | array | [] |
| `width` | number | width |
| `height` | number | height |
| `verticalRange` | object | { baseElevation, topElevation } |
| `verticalRange.baseElevation` | number | baseElevation |
| `verticalRange.topElevation` | number | topElevation |
| `enclosure` | object | { leftWall: true, rightWall: true, roof: true, floor: true } |
| `enclosure.leftWall` | boolean | true |
| `enclosure.rightWall` | boolean | true |
| `enclosure.roof` | boolean | true |
| `enclosure.floor` | boolean | true |
| `materialPreset` | string | connectorType.includes("glass") ? "glass" : "steel" |
| `materialId` | string | materialId |

## BuildingViewGroup

선택 그룹별 normal/ghost 등 표시. defaultViewGroupId에서 참조.

JSON 위치: `$assets.custom[].viewGroups[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/buildingAssembly.js](../../../src/features/customAssets/building/buildingAssembly.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | id("group") |
| `name` | string | "전체 건축물" |
| `type` | string | "whole" |
| `entityIds` | array | [...entityIds] |
| `levelIds` | array | levels.map((level) => level.id) |
| `displayMode` | object | { selected: "normal", others: "normal" } |
| `displayMode.selected` | string | "normal" |
| `displayMode.others` | string | "normal" |

## EquipmentFileRecord

설비 업로드 원본 레코드. blob은 ZIP manifest에서 {$file:path}로 변환되고 이름/MIME/크기는 최상위 files 목록에 기록된다.

JSON 위치: `$assets.equipment[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/equipmentAssetFiles.js](../../../src/features/digitalTwin/editor/model/equipmentAssetFiles.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | assetId |
| `primaryFileName` | string | description.primary.name |
| `primaryFilePath` | string | description.primary.webkitRelativePath &#124;&#124; description.primary.name |
| `files` | array | description.files.map((file) => ({ name: file.name, path: file.webkitRelativePath &#124;&#124; file.name, type: file.type, size: file.size, blob: file })) |
| `files[].name` | string | file.name |
| `files[].path` | string | file.webkitRelativePath &#124;&#124; file.name |
| `files[].type` | string | file.type |
| `files[].size` | number | file.size |
| `files[].blob` | Blob → {$file:string} | file |
| `createdAt` | string | new Date().toISOString() |

## TextureFileRecord

사용자 텍스처/기준 이미지 레코드. width/height px.

JSON 위치: `$assets.textures[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/components/UserTextureEditor.jsx](../../../src/features/digitalTwin/editor/components/UserTextureEditor.jsx).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | textureAssetId |
| `name` | string | file.name |
| `type` | string | decoded.blob.type &#124;&#124; file.type |
| `size` | number | decoded.blob.size |
| `width` | number | decoded.width |
| `height` | number | decoded.height |
| `resized` | boolean | decoded.resized |
| `createdAt` | string | new Date().toISOString() |
| `blob` | Blob → {$file:string} | decoded.blob |

## DisplayFileRecord

서버 GLTF/GLB 표시 파일을 로컬 원본 레코드로 복원한 형태.

JSON 위치: `$assets.equipment[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/projects/displayAssetApi.js](../../../src/features/portal/projects/displayAssetApi.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | reference.asset_id |
| `primaryFileName` | string | primary.name |
| `primaryFilePath` | string | primary.path |
| `files` | array | files |
| `assetType` | string | assetType |
| `displayMaterials` | array | result.manifest.materials |
| `backendAsset` | object | { ...reference } |
| `backendAsset.*` | JSON (확장/병합) | reference |

## AssetExtensionFields

동적으로 생성하는 관계·그룹·윤곽과 확장 필드. 사용자 자산 정의 전체를 저장한다.

JSON 위치: `$assets.custom[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/customAssets/building/buildingAssembly.js](../../../src/features/customAssets/building/buildingAssembly.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `relations[].id` | string | 관계 식별자 |
| `relations[].type` | string | 관계 종류 |
| `relations[].sourceEntityId` | string | 출발 엔티티 |
| `relations[].targetEntityId` | string | 대상 엔티티 |
| `relations[].*` | JSON | 관계 추가 속성 |
| `groups[].id` | string | 공방 설비 그룹 ID |
| `groups[].name` | string | 공방 설비 그룹 이름 |
| `groups[].partIds[]` | string | 순서 있는 부품 ID 목록 |
| `parts[].ports[].connectedTo.partId` | string | 연결 상대 부품 ID |
| `parts[].ports[].connectedTo.portId` | string | 연결 상대 포트 ID |
| `entities[].footprint.templateId` | string | 윤곽 템플릿 ID |
| `entities[].footprint.points[]` | object | {x,z} m 및 선택 curveToNext |
| `entities[].footprint.holes[][]` | object | 구멍 별 {x,z} 점 목록 |
| `sections[].footprint` | object | 같은 footprint 구조 |
| `entities[].*` | JSON | void 등 추가 엔티티 원문 |
| `*` | JSON | 사용자 타입 확장 속성 보존 |

## NativeArchive

서버 저장 내부 자산 묶음의 project.json. 전체 프로젝트 내보내기와 다른 외피.

JSON 위치: `$archive`.

원본 저장: `dt_asset.archive_manifest_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/projects/projectBundle.js](../../../src/features/portal/projects/projectBundle.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `format` | string | digital-twin-assets |
| `version` | integer | 2 |
| `projectId` | string | 현재 프론트에서 전달한 프로젝트 식별자 |
| `assets.equipment[]` | object | EquipmentFileRecord |
| `assets.textures[]` | object | TextureFileRecord |
| `assets.custom[]` | object | CustomEquipment/CustomBuilding 및 사용자 타입 |
| `files[].path` | string | files/ 아래 안전한 archive 상대 경로 |
| `files[].name` | string | 원래 파일명 |
| `files[].size` | integer | 바이트 |
| `files[].type` | string | MIME |
| `assets.*` | JSON | 정의 전체를 재귀 보존; binary는 {$file:path}, data URL은 인코딩 메타데이터 포함 |

## DisplayReference

서버 자산 참조 원문. DISPLAY_ASSET과 NATIVE_BUNDLE의 추가 키도 보존.

JSON 위치: `equipmentAssetBindings[].backendAsset`, `observationConfig.equipmentAssetBindings[].backendAsset`, `$assets.equipment[].backendAsset`.

원본 저장: `dt_project_revision.layout_json`, `dt_asset_version.definition_json`. 검색용 복제: `dt_object_visual.binding_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/projects/projectAssetTransport.js](../../../src/features/portal/projects/projectAssetTransport.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `kind` | string | DISPLAY_ASSET/NATIVE_BUNDLE; 기존 참조는 kind 생략 가능 |
| `asset_id` | string | 서버 자산 ID |
| `manifest_sha256` | string | 64자리 소문자 SHA-256 |
| `archive_sha256` | string | NATIVE_BUNDLE ZIP 전체 SHA-256 |
| `*` | JSON | 서버 제공 버전/manifest 등 참조 확장 필드 |

## DisplayMaterials

glTF material index와 별도 texture member 연결.

JSON 위치: `$assets.equipment[].displayMaterials[]`.

원본 저장: `dt_asset_version.definition_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/projects/displayAssetApi.js](../../../src/features/portal/projects/displayAssetApi.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `material_index` | integer | glTF 재질 인덱스 >=0 |
| `texture_member` | string | 서버 members[].member_id 참조 |
| `*` | JSON | manifest 재질 항목 원문 보존 |

## ArchiveFileReference

blob 위치의 재귀 참조 객체. 파일명/MIME/크기는 archive.files에 있다.

JSON 위치: `$archive.assets.{collection}[].{binaryField}`.

원본 저장: `dt_asset.archive_manifest_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/portal/projects/projectBundleFiles.js](../../../src/features/portal/projects/projectBundleFiles.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `$file` | string | files/ 아래 파일 경로 |
| `encoding` | string | data URL 원본일 때만 data-url |
| `header` | string | data URL의 쉼표 이전 부분; encoding=data-url에서만 |
| `base64` | boolean | data URL이 base64였는지 여부 |

