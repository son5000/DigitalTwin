# 뷰어 JSON 필드 사전 — spatial

기준: 2026-11-17, layout.version=18. [전체 계약과 DB 설계](../viewer-json-database-contract.md).

이 파일은 `node scripts/generate-viewer-field-reference.mjs`로 소스와 명시적 보충 사전에서 생성한다. 기본값 칸은 **현 프론트의 생성·정규화 식 원문**이다. 전달 값이 없을 때의 프론트 동작을 보여 주며 서버가 이 식으로 값을 덮어쓰라는 뜻이 아니다. `JSON (식 참조)`는 프론트가 스키마를 고정하지 않은 값으로, 식·하위 표·카탈로그를 함께 확인한다. 선택 기능의 키는 없을 수 있고, null/false/0/빈 배열과 누락은 서로 다르다.

모든 경로의 기본 저장 위치는 `dt_project_revision.layout_json`의 **동일 경로**다. 자산·로컬 상태는 각 표의 별도 위치를 따른다. `[]`는 배열 인덱스, `{id}`는 실제 ID, `*`는 임의 하위 키를 뜻한다. 각 표의 DB 컬럼 안에도 해당 객체의 모든 하위 키를 그대로 넣는다.

## Layout

저장 JSON 최상위 21개 키. version=18. serializer에서 undefined는 JSON.stringify 시 생략된다.

JSON 위치: `$`.

원본 저장: `dt_project_revision.layout_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/api/layoutRepository.js](../../../src/features/digitalTwin/editor/api/layoutRepository.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `version` | integer | 18 |
| `savedAt` | string | new Date().toISOString() |
| `name` | string | typeof layout.name === "string" ? layout.name.trim() : "" |
| `projectStatus` | string | layout.projectStatus ?? "DRAFT" |
| `hierarchy` | object | layout.hierarchy |
| `observationWorkflow` | object | layout.observationWorkflow |
| `viewerPreset` | object | layout.viewerPreset |
| `representativeImage` | string&#124;null | typeof layout.representativeImage === "string" ? layout.representativeImage : null |
| `siteEnvironment` | object | { width: layout.siteEnvironment.width, depth: layout.siteEnvironment.depth, sizeMode: layout.siteEnvironment.sizeMode, autoFitBuildingId: layout.siteEnvironment.autoFitBuildingId, groundMaterial: layout.siteEnvironment.groundMaterial, backgroundTheme: layout.siteEnvironment.backgroundTheme, terrain: serializeTerrain( layout.siteEnvironment.terrain, layout.siteEnvironment.width, layout.siteEnvironment.depth, layout.siteEnvironment.groundMaterial, ), } |
| `siteEnvironment.width` | number | layout.siteEnvironment.width |
| `siteEnvironment.depth` | number | layout.siteEnvironment.depth |
| `siteEnvironment.sizeMode` | string | layout.siteEnvironment.sizeMode |
| `siteEnvironment.autoFitBuildingId` | string&#124;null | layout.siteEnvironment.autoFitBuildingId |
| `siteEnvironment.groundMaterial` | string | layout.siteEnvironment.groundMaterial |
| `siteEnvironment.backgroundTheme` | string | layout.siteEnvironment.backgroundTheme |
| `siteEnvironment.terrain` | object | serializeTerrain( layout.siteEnvironment.terrain, layout.siteEnvironment.width, layout.siteEnvironment.depth, layout.siteEnvironment.groundMaterial, ) |
| `sitePaths` | array | layout.sitePaths ?? [] |
| `siteObjects` | array | layout.siteObjects ?? [] |
| `gridSettings` | object | gridSettings |
| `roomScenes` | object | roomScenes |
| `floorPlansById` | object | Object.fromEntries(Object.entries(layout.floorPlansById ?? {}).map(([floorId, plan]) => { const floorPlan = { ...plan }; delete floorPlan.selectedSpatialEntity; return [floorId, floorPlan]; })) |
| `verticalStructuresByBuildingId` | object | layout.verticalStructuresByBuildingId ?? {} |
| `equipmentByFloorId` | object | layout.equipmentByFloorId ?? {} |
| `observationConfig` | object | { equipmentAssetBindings, sensorBindings: observationConfig.sensorBindings ?? [], observationPoints: observationConfig.observationPoints ?? [], serverBindings: observationConfig.serverBindings ?? [], } |
| `observationConfig.equipmentAssetBindings` | array | equipmentAssetBindings |
| `observationConfig.sensorBindings` | array | observationConfig.sensorBindings ?? [] |
| `observationConfig.observationPoints` | array | observationConfig.observationPoints ?? [] |
| `observationConfig.serverBindings` | array | observationConfig.serverBindings ?? [] |
| `equipmentAssetBindings` | array | equipmentAssetBindings |
| `sensorBindings` | array | observationConfig.sensorBindings ?? [] |
| `observationPoints` | array | observationConfig.observationPoints ?? [] |
| `serverBindings` | array | observationConfig.serverBindings ?? [] |

## Hierarchy

부지→건물→층→방 트리. 노드 ID는 프론트 문자열이며 부모는 같은 리비전의 노드를 참조한다.

JSON 위치: `hierarchy`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.hierarchy_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/digitalTwinHierarchy.js](../../../src/features/digitalTwin/editor/model/digitalTwinHierarchy.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `rootId` | string | DEFAULT_NODE_IDS.SITE |
| `activeRoomId` | string&#124;null | null |
| `selectedNodeId` | string | DEFAULT_NODE_IDS.SITE |
| `nodes` | array | [ { id: DEFAULT_NODE_IDS.SITE, type: HIERARCHY_NODE_TYPES.SITE, name: "메인 부지", parentId: null }, ] |
| `nodes[].id` | string | DEFAULT_NODE_IDS.SITE |
| `nodes[].type` | string | HIERARCHY_NODE_TYPES.SITE |
| `nodes[].name` | string | "메인 부지" |
| `nodes[].parentId` | string&#124;null | null |

## HierarchyNode

공통 노드. SITE/BUILDING/FLOOR/ROOM. 건물·층·방 확장 필드는 아래 표를 합친다.

JSON 위치: `hierarchy.nodes[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/digitalTwinHierarchy.js](../../../src/features/digitalTwin/editor/model/digitalTwinHierarchy.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | overrides.id ?? &#96;${type}_${crypto.randomUUID()}&#96; |
| `type` | string | type |
| `name` | string | &#96;${HIERARCHY_TYPE_LABELS[type]} ${String(sequence).padStart(2, "0")}&#96; |
| `parentId` | string&#124;null | parentId |

## BuildingNode

BUILDING 노드에 붙는 템플릿·치수·외관. parameters/variants의 템플릿별 전체 키는 카탈로그를 참조한다.

JSON 위치: `hierarchy.nodes[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/digitalTwinHierarchy.js](../../../src/features/digitalTwin/editor/model/digitalTwinHierarchy.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `templateId` | string | "BUILDING" |
| `objectDefinitionId` | string | "BUILDING" |
| `parameters` | object | Object.freeze({ width: 24, depth: 16, floorCount: 5, floorHeight: 3.6, roofType: "FLAT", entranceCount: 2, stairCount: 2, extras: [] }) |
| `parameters.width` | number | 24 |
| `parameters.depth` | number | 16 |
| `parameters.floorCount` | number | 5 |
| `parameters.floorHeight` | number | 3.6 |
| `parameters.roofType` | string | "FLAT" |
| `parameters.entranceCount` | number | 2 |
| `parameters.stairCount` | number | 2 |
| `parameters.extras` | array | [] |
| `variants` | object | Object.freeze(getDefaultObjectVariants(BUILDING_OBJECT_DEFINITIONS[0])) |
| `position` | object | Object.freeze({ x: 0, y: 0, z: 0 }) |
| `position.x` | number | 0 |
| `position.y` | number | 0 |
| `position.z` | number | 0 |
| `rotation` | object | Object.freeze({ x: 0, y: 0, z: 0 }) |
| `rotation.x` | number | 0 |
| `rotation.y` | number | 0 |
| `rotation.z` | number | 0 |
| `appearance` | object | Object.freeze({ color: "#9aa7ad", material: "CONCRETE" }) |
| `appearance.color` | string | "#9aa7ad" |
| `appearance.material` | string | "CONCRETE" |
| `facadeOpenings` | object | Object.freeze(normalizeBuildingOpenings({}, 5)) |

## FloorNode

FLOOR에 적용. level은 지하 음수 가능, elevation은 m.

JSON 위치: `hierarchy.nodes[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/digitalTwinHierarchy.js](../../../src/features/digitalTwin/editor/model/digitalTwinHierarchy.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `name` | string | &#96;${sequence}층&#96; |
| `level` | integer | sequence |
| `elevation` | number | (sequence - 1) * 4 |

## RoomNode

ROOM의 배치와 색상. 위치 m, 회전 rad.

JSON 위치: `hierarchy.nodes[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/digitalTwinHierarchy.js](../../../src/features/digitalTwin/editor/model/digitalTwinHierarchy.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `position` | object | Object.freeze({ x: 0, y: 0, z: 0 }) |
| `position.x` | number | 0 |
| `position.y` | number | 0 |
| `position.z` | number | 0 |
| `rotation` | object | Object.freeze({ x: 0, y: 0, z: 0 }) |
| `rotation.x` | number | 0 |
| `rotation.y` | number | 0 |
| `rotation.z` | number | 0 |
| `appearance` | object | Object.freeze({ color: "#6f8f9d" }) |
| `appearance.color` | string | "#6f8f9d" |

## Workflow

범위 SITE/BUILDING/SINGLE_EQUIPMENT/MULTI_EQUIPMENT/CUSTOM 및 시작 뷰어 대상. 미설정은 configured=false, scopeType=null.

JSON 위치: `observationWorkflow`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.workflow_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/observationWorkflow.js](../../../src/features/digitalTwin/editor/model/observationWorkflow.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `configured` | boolean | true |
| `scopeType` | string&#124;null | scopeType |
| `activeStepIds` | string[] | activeStepIds |
| `viewerSettings` | object | { mode: options.viewerSettings?.mode ?? definition.viewerMode, focusBuildingId: options.viewerSettings?.focusBuildingId ?? null, equipmentIds: [...new Set(options.viewerSettings?.equipmentIds ?? [])], activeEquipmentId: options.viewerSettings?.activeEquipmentId ?? null, } |
| `viewerSettings.mode` | string | options.viewerSettings?.mode ?? definition.viewerMode |
| `viewerSettings.focusBuildingId` | string&#124;null | options.viewerSettings?.focusBuildingId ?? null |
| `viewerSettings.equipmentIds` | array | [...new Set(options.viewerSettings?.equipmentIds ?? [])] |
| `viewerSettings.activeEquipmentId` | string&#124;null | options.viewerSettings?.activeEquipmentId ?? null |

## Grid

스냅 크기 m; legacy gridSize/siteSize/worldGridSize는 저장에서 제외.

JSON 위치: `gridSettings`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.grid_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/gridSettings.js](../../../src/features/digitalTwin/editor/constants/gridSettings.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `enabled` | boolean | Boolean(settings.enabled) |
| `baseSize` | number | normalizeGridCellSize(settings.baseSize) |
| `verticalSnap` | number&#124;null | settings.verticalSnap == null ? null : normalizeGridCellSize(settings.verticalSnap, 0.1) |
| `regions` | array | Array.isArray(settings.regions) ? settings.regions.map(normalizeGridRegion).filter(Boolean) : [] |

## GridRegion

scopeId가 가리키는 공간 안의 상세 격자 영역.

JSON 위치: `gridSettings.regions[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.grid_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/gridSettings.js](../../../src/features/digitalTwin/editor/constants/gridSettings.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | typeof region.id === "string" ? region.id : &#96;GRID_REGION_${crypto.randomUUID()}&#96; |
| `scopeId` | string | region.scopeId |
| `name` | string | typeof region.name === "string" && region.name.trim() ? region.name : &#96;Detail Region ${String(index + 1).padStart(2, "0")}&#96; |
| `center` | object | { x: finiteNumber(region.center?.x, 0), z: finiteNumber(region.center?.z, 0), } |
| `center.x` | number | finiteNumber(region.center?.x, 0) |
| `center.z` | number | finiteNumber(region.center?.z, 0) |
| `size` | object | { width: Math.max(0.1, finiteNumber(region.size?.width, 10)), depth: Math.max(0.1, finiteNumber(region.size?.depth, 10)), } |
| `size.width` | number | Math.max(0.1, finiteNumber(region.size?.width, 10)) |
| `size.depth` | number | Math.max(0.1, finiteNumber(region.size?.depth, 10)) |
| `cellSize` | number | normalizeGridCellSize(region.cellSize, 0.5) |
| `enabled` | boolean | region.enabled !== false |

## SiteEnvironment

부지 가로/세로 m, 20~400. 기본 120×90. 배경 DAY/NIGHT/SUNSET/CLEAR_SKY.

JSON 위치: `siteEnvironment`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.environment_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/siteEnvironmentSettings.js](../../../src/features/digitalTwin/editor/constants/siteEnvironmentSettings.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `width` | number | width |
| `depth` | number | depth |
| `sizeMode` | string | sizeMode |
| `autoFitBuildingId` | string&#124;null | sizeMode === OBSERVATION_SITE_SIZE_MODES.AUTO_BUILDING ? environment?.autoFitBuildingId ?? null : null |
| `groundMaterial` | string | groundMaterial |
| `backgroundTheme` | string | backgroundTheme |
| `terrain` | object | normalizeTerrainModel(environment?.terrain, width, depth, groundMaterial) |

## Terrain

지형 직렬화 16개 필드. elevations[row*columns+column], m, 소수 4자리로 직렬화.

JSON 위치: `siteEnvironment.terrain`, `floorPlansById.{floorId}.terrain`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.environment_json`, `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/terrain/TerrainPersistence.js](../../../src/features/digitalTwin/editor/terrain/TerrainPersistence.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `version` | integer | normalized.version |
| `width` | number | normalized.width |
| `depth` | number | normalized.depth |
| `resolution` | number | normalized.resolution |
| `columns` | integer | normalized.columns |
| `rows` | integer | normalized.rows |
| `elevations` | number[] | normalized.elevations.map((value) => Number(value.toFixed(4))) |
| `material` | string | normalized.material |
| `shape` | string | normalized.shape |
| `removedAreas` | array | normalized.removedAreas.map((area) => ({ ...area })) |
| `removedAreas[].*` | JSON (확장/병합) | area |
| `color` | string&#124;null | normalized.color |
| `colorGradient` | object&#124;null | normalized.colorGradient ? { ...normalized.colorGradient } : null |
| `colorGradient.*` | JSON (확장/병합) | normalized.colorGradient |
| `cellColors` | array | normalized.cellColors.map((cell) => ({ ...cell, ...(cell.gradient ? { gradient: { ...cell.gradient } } : {}) })) |
| `cellColors[].*` | JSON (확장/병합) | cell |
| `cellColors[].gradient` | object | { ...cell.gradient } |
| `cellColors[].gradient.*` | JSON (확장/병합) | cell.gradient |
| `showContours` | boolean | normalized.showContours |
| `showHeightColors` | boolean | normalized.showHeightColors |
| `revision` | integer | normalized.revision |

## TerrainDefaults

지형 초기값. resolution 1~10m; 높이 정규화 범위 -80~80m. shape RECTANGLE/CIRCLE.

JSON 위치: `siteEnvironment.terrain`, `floorPlansById.{floorId}.terrain`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.environment_json`, `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/terrain/TerrainModel.js](../../../src/features/digitalTwin/editor/terrain/TerrainModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `version` | integer | TERRAIN_MODEL_VERSION |
| `width` | number | normalizedWidth |
| `depth` | number | normalizedDepth |
| `resolution` | number | normalizedResolution |
| `columns` | integer | columns |
| `rows` | integer | rows |
| `elevations` | array | Array(columns * rows).fill(0) |
| `cellColors` | array | [] |
| `shape` | string | "RECTANGLE" |
| `removedAreas` | array | [] |
| `color` | string&#124;null | null |
| `material` | string | "CONCRETE" |
| `showContours` | boolean | false |
| `showHeightColors` | boolean | false |
| `revision` | number | 0 |

## TerrainGradient

그라데이션 범위 m; HEX 색상; POSITIVE_X/NEGATIVE_X/POSITIVE_Z/NEGATIVE_Z.

JSON 위치: `siteEnvironment.terrain.colorGradient`, `siteEnvironment.terrain.cellColors[].gradient`, `floorPlansById.{floorId}.terrain.colorGradient`, `floorPlansById.{floorId}.terrain.cellColors[].gradient`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.environment_json`, `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/terrain/terrainCellColors.js](../../../src/features/digitalTwin/editor/terrain/terrainCellColors.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `minX` | number | value.minX |
| `maxX` | number | value.maxX |
| `minZ` | number | value.minZ |
| `maxZ` | number | value.maxZ |
| `endColor` | string | value.endColor |
| `direction` | string | ["POSITIVE_X", "NEGATIVE_X", "POSITIVE_Z", "NEGATIVE_Z"].includes(value.direction) ? value.direction : "POSITIVE_X" |

## TerrainCellColor

채색 영역은 개별 픽셀이 아닌 사각형 범위 목록.

JSON 위치: `siteEnvironment.terrain.cellColors[]`, `floorPlansById.{floorId}.terrain.cellColors[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.environment_json`, `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/terrain/terrainCellColors.js](../../../src/features/digitalTwin/editor/terrain/terrainCellColors.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `minX` | number | Math.max(-width / 2, cell.minX) |
| `maxX` | number | Math.min(width / 2, cell.maxX) |
| `minZ` | number | Math.max(-depth / 2, cell.minZ) |
| `maxZ` | number | Math.min(depth / 2, cell.maxZ) |
| `color` | string | cell.color |
| `gradient` | object&#124;null | normalizeTerrainGradient(cell.gradient) |

## TerrainRemovedArea

삭제된 지형의 사각형 범위 m.

JSON 위치: `siteEnvironment.terrain.removedAreas[]`, `floorPlansById.{floorId}.terrain.removedAreas[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_settings.environment_json`, `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/terrain/TerrainFootprint.js](../../../src/features/digitalTwin/editor/terrain/TerrainFootprint.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `minX` | number | minX |
| `maxX` | number | maxX |
| `minZ` | number | minZ |
| `maxZ` | number | maxZ |

## SiteObject

야외 오브젝트. 타입별 parameters/variants/placementRules는 카탈로그와 공통 추가 필드를 함께 보존.

JSON 위치: `siteObjects[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/siteEnvironmentTemplates.js](../../../src/features/digitalTwin/editor/constants/siteEnvironmentTemplates.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | object |
| `id` | string | typeof object.id === "string" ? object.id : &#96;SITE_OBJECT_${crypto.randomUUID()}&#96; |
| `domain` | string | "SITE" |
| `type` | string | template.id |
| `objectDefinitionId` | string | template.id |
| `categoryId` | string | template.categoryId |
| `assetKind` | string | template.assetKind |
| `profile` | string | template.profile |
| `name` | string | object.name ?? &#96;${template.name} ${String(index + 1).padStart(2, "0")}&#96; |
| `geometryMode` | string | template.geometryMode |
| `variants` | object | { ...getDefaultObjectVariants(template), ...object.variants } |
| `variants.*` | JSON (확장/병합) | getDefaultObjectVariants(template) |
| `variants.*` | JSON (확장/병합) | object.variants |
| `position` | object | { x: 0, y: 0, z: 0, ...object.position } |
| `position.x` | number | 0 |
| `position.y` | number | 0 |
| `position.z` | number | 0 |
| `position.*` | JSON (확장/병합) | object.position |
| `rotation` | object | { x: 0, y: 0, z: 0, ...object.rotation } |
| `rotation.x` | number | 0 |
| `rotation.y` | number | 0 |
| `rotation.z` | number | 0 |
| `rotation.*` | JSON (확장/병합) | object.rotation |
| `dimensions` | object | { width, height: Math.max(0.02, finite(object.dimensions?.height, template.height)), depth } |
| `dimensions.width` | number | width |
| `dimensions.height` | number | Math.max(0.02, finite(object.dimensions?.height, template.height)) |
| `dimensions.depth` | number | depth |
| `appearance` | object | { color: template.color, material: template.material, ...object.appearance } |
| `appearance.color` | string | template.color |
| `appearance.material` | string | template.material |
| `appearance.*` | JSON (확장/병합) | object.appearance |
| `customAssetId` | string&#124;null | object.customAssetId ?? template.customAssetId ?? null |
| `customAssetRevision` | integer&#124;null | object.customAssetRevision ?? template.customAssetRevision ?? null |
| `customAssetSnapshot` | object&#124;null | object.customAssetSnapshot ?? (template.customAsset ? structuredClone(template.customAsset) : null) |
| `placementRules` | object&#124;null | template.placementRules ? { ...template.placementRules, ...object.placementRules } : null |
| `placementRules.*` | JSON (확장/병합) | template.placementRules |
| `placementRules.*` | JSON (확장/병합) | object.placementRules |
| `placement` | object&#124;null | template.placementRules ? { mode: null, buildingId: null, localPosition: null, ...object.placement } : null |
| `placement.mode` | string&#124;null | null |
| `placement.buildingId` | string&#124;null | null |
| `placement.localPosition` | object&#124;null | null |
| `placement.*` | JSON (확장/병합) | object.placement |
| `parameters` | object | { ...template.parameters, count: 1, spacing: TREE_DEFAULT_SPACING, parkingAngle: 90, ...object.parameters, } |
| `parameters.*` | JSON (확장/병합) | template.parameters |
| `parameters.count` | number | 1 |
| `parameters.spacing` | number | TREE_DEFAULT_SPACING |
| `parameters.parkingAngle` | number | 90 |
| `parameters.*` | JSON (확장/병합) | object.parameters |
| `path` | object&#124;null | template.geometryMode === SITE_OBJECT_GEOMETRY_MODES.LINEAR ? normalizeVerticalPath({ width: Math.max(template.profile === "BOUNDARY_WALL" ? 0.1 : 0.5, finite(object.path?.width, Math.min(width, depth))), elevationMode: object.path?.elevationMode ?? object.parameters?.verticalPathMode ?? VERTICAL_PATH_MODES.FOLLOW_TERRAIN, points: Array.isArray(object.path?.points) && object.path.points.length >= 2 ? object.path.points.map((point) => ({ ...point, x: finite(point.x, 0), z: finite(point.z, 0) })) : createLinearPath(width, depth).points, }) : null |
| `visible` | boolean | object.visible !== false |
| `locked` | boolean | Boolean(object.locked) |
| `movement` | object&#124;null | object.movement ? structuredClone(object.movement) : null |
| `undergroundConnection` | object&#124;null | object.undergroundConnection ? structuredClone(object.undergroundConnection) : null |

## LegacySitePath

기존 ROAD/WALKWAY 경로. 현재 layoutDocument 연결 누락 주의사항은 본문 참조.

JSON 위치: `sitePaths[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/sitePathTemplates.js](../../../src/features/digitalTwin/editor/constants/sitePathTemplates.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | path.id ?? &#96;SITE_PATH_${crypto.randomUUID()}&#96; |
| `domain` | string | "SITE" |
| `type` | string | template.id |
| `name` | string | path.name ?? &#96;${template.name} ${String(index + 1).padStart(2, "0")}&#96; |
| `width` | number | Math.max(0.5, Number(path.width) &#124;&#124; template.width) |
| `color` | string | path.color ?? template.color |
| `edgeColor` | string | path.edgeColor ?? template.edgeColor |
| `points` | array | Array.isArray(path.points) ? path.points.map((point) => ({ x: Number(point.x) &#124;&#124; 0, z: Number(point.z) &#124;&#124; 0 })) : [] |
| `points[].x` | number | Number(point.x) &#124;&#124; 0 |
| `points[].z` | number | Number(point.z) &#124;&#124; 0 |
| `visible` | boolean | path.visible ?? true |
| `locked` | boolean | path.locked ?? false |

## Movement

동작 설정. 시간 초, speed m/s. 현재 재생 시각은 저장 설정과 별개.

JSON 위치: `siteObjects[].movement`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/movementPath.js](../../../src/features/digitalTwin/editor/model/movementPath.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `enabled` | boolean | false |
| `pathType` | string | MOVEMENT_PATH_TYPES.LINEAR |
| `waypoints` | array | defaultWaypoints(position) |
| `startTime` | number | 0 |
| `speed` | number | 1.4 |
| `waitTime` | number | 0 |
| `repeatMode` | string | MOVEMENT_REPEAT_MODES.LOOP |
| `endBehavior` | string | MOVEMENT_END_BEHAVIORS.HOLD |

## Waypoint

경유점 m, 대기 시간 초. 배열 순서 유지.

JSON 위치: `siteObjects[].movement.waypoints[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/movementPath.js](../../../src/features/digitalTwin/editor/model/movementPath.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | value?.id ?? fallback.id ?? fallbackId |
| `x` | number | finite(value?.x, finite(fallback.x)) |
| `y` | number | finite(value?.y, finite(fallback.y)) |
| `z` | number | finite(value?.z, finite(fallback.z)) |
| `floorId` | string&#124;null | value?.floorId ?? fallback.floorId ?? null |
| `waitTime` | number | Math.max(0, finite(value?.waitTime, 0)) |

## UndergroundConnection

지하 연결 대상과 개구부 m.

JSON 위치: `siteObjects[].undergroundConnection`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/undergroundModel.js](../../../src/features/digitalTwin/editor/model/undergroundModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | previous.id ?? &#96;UNDERGROUND_CONNECTION_${crypto.randomUUID()}&#96; |
| `targetBuildingId` | string&#124;null | previous.targetBuildingId ?? target?.building.id ?? null |
| `targetFloorId` | string&#124;null | previous.targetFloorId ?? targetFloor?.id ?? null |
| `startPoint` | object | { ...start } |
| `startPoint.*` | JSON (확장/병합) | start |
| `endPoint` | object | { ...end } |
| `endPoint.*` | JSON (확장/병합) | end |
| `openingWidth` | number | Math.max(0.6, finite(previous.openingWidth, object.dimensions?.width ?? 2)) |
| `openingLength` | number | Math.max(0.8, finite(previous.openingLength, object.dimensions?.depth ?? 3)) |

## VerticalPathPoint

경로 제어점; 선택 elevation(m), curveRadius(m), 확장 키 보존.

JSON 위치: `siteObjects[].path.points[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/terrain/VerticalPathModel.js](../../../src/features/digitalTwin/editor/terrain/VerticalPathModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | point |
| `x` | number | finite(point?.x) |
| `z` | number | finite(point?.z) |
| `elevation` | number | finite(point.elevation ?? point.y) |
| `curveRadius` | number | Math.max(0, finite(point?.curveRadius, 0)) |

## RoomScene

실내 독립 장면 version=4. world/equipment/구조물/파이프/업로드 상세 자산.

JSON 위치: `roomScenes.{roomId}`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_room_scene.scene_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useDigitalTwinEditorState.js](../../../src/features/digitalTwin/editor/store/useDigitalTwinEditorState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `version` | number | 4 |
| `world` | object | { ...DEFAULT_WORLD } |
| `world.*` | JSON (확장/병합) | DEFAULT_WORLD |
| `equipment` | array | [] |
| `detailAssets` | array | [] |
| `pipeConnections` | array | [] |
| `worldStructures` | array | createDefaultWorldWalls(DEFAULT_WORLD) |
| `worldStructuresLocked` | boolean | false |
| `visibilityFilters` | object | {} |

## RoomWorld

실내 작업 공간 기본값. m.

JSON 위치: `roomScenes.{roomId}.world`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_room_scene.scene_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/equipmentShapeTemplates.js](../../../src/features/digitalTwin/editor/constants/equipmentShapeTemplates.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `width` | number | 20 |
| `depth` | number | 15 |
| `wallHeight` | number | 3 |

## FloorSpatialPlan

평면도 전체. rooms/walls는 synchronizeRoomWalls 결과, 기존 plan 속성도 보존.

JSON 위치: `floorPlansById.{floorId}`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/floorSpatialModel.js](../../../src/features/digitalTwin/editor/model/floorSpatialModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | plan |
| `spatialVersion` | integer | FLOOR_SPATIAL_VERSION |
| `floorFootprint` | object | floorFootprint |
| `elevationZones` | array | elevationZones |
| `*` | JSON (확장/병합) | synchronized |
| `doors` | array | doors |

## FloorFootprint

INHERIT_BUILDING/CUSTOM. 다중 외곽 및 구멍을 보존.

JSON 위치: `floorPlansById.{floorId}.floorFootprint`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/floorSpatialModel.js](../../../src/features/digitalTwin/editor/model/floorSpatialModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | source.id ?? createId("FLOOR_FOOTPRINT") |
| `mode` | string | source.mode === FLOOR_FOOTPRINT_MODES.CUSTOM ? FLOOR_FOOTPRINT_MODES.CUSTOM : FLOOR_FOOTPRINT_MODES.INHERIT_BUILDING |
| `regions` | array | regions |
| `revision` | number | Math.max(1, Math.round(finite(source.revision, 1))) |

## FootprintRegion

outer: point[], holes: point[][]; 각 점 x,z(m), 선택 curveToNext.

JSON 위치: `floorPlansById.{floorId}.floorFootprint.regions[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/floorSpatialModel.js](../../../src/features/digitalTwin/editor/model/floorSpatialModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | region.id ?? createId("FLOOR_REGION") |
| `outer` | array | cloneRing(region.outer ?? region.points ?? []) |
| `holes` | array | (region.holes ?? []).map(cloneRing) |

## ElevationZone

평탄/경사 바닥, FLAT/SLOPED; edgeTreatments는 경계 인덱스별 사전.

JSON 위치: `floorPlansById.{floorId}.elevationZones[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/floorSpatialModel.js](../../../src/features/digitalTwin/editor/model/floorSpatialModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | zone.id ?? createId("ELEVATION_ZONE") |
| `name` | string | zone.name ?? "고도 영역" |
| `boundary` | array | cloneRing(zone.boundary ?? footprint.regions[0]?.outer ?? []) |
| `relativeHeight` | number | finite(zone.relativeHeight) |
| `slabThickness` | number | Math.max(0.03, finite(zone.slabThickness, 0.15)) |
| `surfaceType` | string | zone.surfaceType === ELEVATION_ZONE_SURFACES.SLOPED ? ELEVATION_ZONE_SURFACES.SLOPED : ELEVATION_ZONE_SURFACES.FLAT |
| `slope` | object | { x: finite(zone.slope?.x), z: finite(zone.slope?.z) } |
| `slope.x` | number | finite(zone.slope?.x) |
| `slope.z` | number | finite(zone.slope?.z) |
| `edgeTreatments` | object | zone.edgeTreatments ?? {} |

## FloorRoom

방 외곽 및 공유 벽 ID. hierarchy ROOM과 동일 객체로 가정하지 않는다.

JSON 위치: `floorPlansById.{floorId}.rooms[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/floorSpatialModel.js](../../../src/features/digitalTwin/editor/model/floorSpatialModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | room.id ?? createId("FLOOR_ROOM") |
| `name` | string | room.name ?? "방" |
| `outline` | array | cloneRing(room.outline ?? rectangle(room.width, room.depth, room.position)) |
| `editMode` | string | room.editMode === ROOM_EDIT_MODES.WALL_DETAIL ? ROOM_EDIT_MODES.WALL_DETAIL : ROOM_EDIT_MODES.SHAPE |
| `wallIds` | array | room.wallIds ?? [] |
| `appearance` | object | { color: "#75A8B8", opacity: 0.16, ...(room.appearance ?? {}) } |
| `appearance.color` | string | "#75A8B8" |
| `appearance.opacity` | number | 0.16 |
| `appearance.*` | JSON (확장/병합) | room.appearance ?? {} |

## SharedWall

공유 벽 m. roomIds, door.hostWallId로 연결.

JSON 위치: `floorPlansById.{floorId}.walls[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/floorSpatialModel.js](../../../src/features/digitalTwin/editor/model/floorSpatialModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | existing?.id ?? createId("SHARED_WALL") |
| `boundaryKey` | string | segmentKey(start, end) |
| `roomIds` | array | [...new Set([...(existing?.roomIds ?? []), roomId])] |
| `start` | object | point(start) |
| `end` | object | point(end) |
| `enabled` | boolean | existing?.enabled ?? true |
| `height` | number | Math.max(0.1, finite(existing?.height, 3)) |
| `thickness` | number | Math.max(0.05, finite(existing?.thickness, 0.15)) |
| `lengthMode` | string | existing?.lengthMode ?? "FULL" |
| `startOffset` | number | Math.max(0, finite(existing?.startOffset)) |
| `endOffset` | number | Math.max(0, finite(existing?.endOffset)) |
| `appearance` | object | { materialPreset: "PAINTED_CONCRETE", color: "#A7B0B5", ...(existing?.appearance ?? {}) } |
| `appearance.materialPreset` | string | "PAINTED_CONCRETE" |
| `appearance.color` | string | "#A7B0B5" |
| `appearance.*` | JSON (확장/병합) | existing?.appearance ?? {} |

## WallDoor

평면도 문: hinge LEFT/RIGHT, swing IN/OUT. 캐비넷 문 enum과 다름.

JSON 위치: `floorPlansById.{floorId}.doors[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/floorSpatialModel.js](../../../src/features/digitalTwin/editor/model/floorSpatialModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | door.id ?? createId("WALL_DOOR") |
| `name` | string | door.name ?? "문" |
| `hostWallId` | string&#124;null | door.hostWallId ?? null |
| `offset` | number | Math.max(0, finite(door.offset)) |
| `width` | number | Math.max(0.5, finite(door.width, 0.9)) |
| `height` | number | Math.max(1.5, finite(door.height, 2.1)) |
| `hinge` | string | door.hinge === "RIGHT" ? "RIGHT" : "LEFT" |
| `swing` | string | door.swing === "OUT" ? "OUT" : "IN" |
| `active` | boolean | door.active ?? true |
| `connectsRoomIds` | array | door.connectsRoomIds ?? [] |
| `appearanceSlots` | object | { leaf: { materialPreset: "WOOD", color: "#8B6B4A", ...door.appearanceSlots?.leaf }, frame: { materialPreset: "PAINTED_STEEL", color: "#6E787D", ...door.appearanceSlots?.frame }, handle: { materialPreset: "METAL", color: "#D0D4D6", ...door.appearanceSlots?.handle }, glass: { materialPreset: "GLASS", color: "#A9D4DD", ...door.appearanceSlots?.glass }, } |
| `appearanceSlots.leaf` | object | { materialPreset: "WOOD", color: "#8B6B4A", ...door.appearanceSlots?.leaf } |
| `appearanceSlots.leaf.materialPreset` | string | "WOOD" |
| `appearanceSlots.leaf.color` | string | "#8B6B4A" |
| `appearanceSlots.leaf.*` | JSON (확장/병합) | door.appearanceSlots?.leaf |
| `appearanceSlots.frame` | object | { materialPreset: "PAINTED_STEEL", color: "#6E787D", ...door.appearanceSlots?.frame } |
| `appearanceSlots.frame.materialPreset` | string | "PAINTED_STEEL" |
| `appearanceSlots.frame.color` | string | "#6E787D" |
| `appearanceSlots.frame.*` | JSON (확장/병합) | door.appearanceSlots?.frame |
| `appearanceSlots.handle` | object | { materialPreset: "METAL", color: "#D0D4D6", ...door.appearanceSlots?.handle } |
| `appearanceSlots.handle.materialPreset` | string | "METAL" |
| `appearanceSlots.handle.color` | string | "#D0D4D6" |
| `appearanceSlots.handle.*` | JSON (확장/병합) | door.appearanceSlots?.handle |
| `appearanceSlots.glass` | object | { materialPreset: "GLASS", color: "#A9D4DD", ...door.appearanceSlots?.glass } |
| `appearanceSlots.glass.materialPreset` | string | "GLASS" |
| `appearanceSlots.glass.color` | string | "#A9D4DD" |
| `appearanceSlots.glass.*` | JSON (확장/병합) | door.appearanceSlots?.glass |

## WorldStructure

구조물 템플릿별 기본값은 카탈로그. 방 내부 구조물은 domain/spaceId 등 자체 값을 보존.

JSON 위치: `floorPlansById.{floorId}.structures[]`, `verticalStructuresByBuildingId.{buildingId}[]`, `roomScenes.{roomId}.worldStructures[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_structure.structure_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useFloorPlanState.js](../../../src/features/digitalTwin/editor/store/useFloorPlanState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | structure |
| `id` | string | structure.id ?? createId() |
| `domain` | string | "FLOOR_PLAN" |
| `type` | string | definition.id |
| `group` | string | definition.group |
| `name` | string | structure.name ?? definition.nameKo |
| `usage` | string | structure.usage ?? (definition.id === "ROOM" ? "일반 공간" : "") |
| `variant` | string&#124;null | structure.variant ?? definition.variants?.[0] ?? null |
| `parameters` | object | { ...definition.defaultParameters, ...structure.parameters } |
| `parameters.*` | JSON (확장/병합) | definition.defaultParameters |
| `parameters.*` | JSON (확장/병합) | structure.parameters |
| `position` | object | { x: 0, y: definition.defaultPositionY ?? 0, z: 0, ...structure.position } |
| `position.x` | number | 0 |
| `position.y` | number | definition.defaultPositionY ?? 0 |
| `position.z` | number | 0 |
| `position.*` | JSON (확장/병합) | structure.position |
| `rotation` | object | { x: 0, y: 0, z: 0, ...structure.rotation } |
| `rotation.x` | number | 0 |
| `rotation.y` | number | 0 |
| `rotation.z` | number | 0 |
| `rotation.*` | JSON (확장/병합) | structure.rotation |
| `appearance` | object | { ...definition.defaultAppearance, ...structure.appearance } |
| `appearance.*` | JSON (확장/병합) | definition.defaultAppearance |
| `appearance.*` | JSON (확장/병합) | structure.appearance |
| `appearanceSlots` | object | Object.fromEntries((definition.materialSlots ?? []).map((slot) => [ slot.id, { ...slot.defaultAppearance, ...structure.appearanceSlots?.[slot.id] }, ])) |
| `spaceId` | string | structure.spaceId ?? structure.floorId ?? structure.buildingId ?? "" |
| `visible` | boolean | structure.visible ?? true |
| `locked` | boolean | structure.locked ?? false |
| `groundSnap` | boolean | structure.groundSnap ?? definition.defaultGroundSnap ?? true |

## StairStructure

계단 조건부 필드, 참조 층 ID와 폭/디딤판/챌판/참 m.

JSON 위치: `floorPlansById.{floorId}.structures[]`, `verticalStructuresByBuildingId.{buildingId}[]`, `roomScenes.{roomId}.worldStructures[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_structure.structure_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useFloorPlanState.js](../../../src/features/digitalTwin/editor/store/useFloorPlanState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | normalized |
| `stairType` | string | structure.stairType ?? "STRAIGHT" |
| `scope` | string | structure.scope |
| `floorId` | string&#124;null | structure.floorId ?? structure.fromFloorId ?? structure.startFloorId ?? structure.applicationScope?.startFloorId ?? null |
| `fromFloorId` | string&#124;null | structure.fromFloorId ?? structure.startFloorId ?? structure.applicationScope?.startFloorId ?? null |
| `toFloorId` | string&#124;null | structure.toFloorId ?? structure.endFloorId ?? structure.applicationScope?.endFloorId ?? null |
| `startFloorId` | string&#124;null | structure.startFloorId ?? structure.applicationScope?.startFloorId ?? null |
| `endFloorId` | string&#124;null | structure.endFloorId ?? structure.applicationScope?.endFloorId ?? null |
| `servedFloorIds` | array | structure.servedFloorIds ?? structure.applicationScope?.connectedFloorIds ?? [] |
| `width` | number | stairValues.width |
| `treadDepth` | number | stairValues.treadDepth |
| `riserHeight` | number | stairValues.riserHeight |
| `landingDepth` | number | stairValues.landingDepth |

## BuildingOpenings

건물 외벽 출입문·창문. 개수/층 범위/면/간격/문틀·유리 외관.

JSON 위치: `hierarchy.nodes[].facadeOpenings`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/buildingOpenings.js](../../../src/features/digitalTwin/editor/model/buildingOpenings.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `version` | number | 1 |
| `doors` | object | { enabled: doors.enabled ?? true, count: Math.round(clamp(doors.count ?? 2, 1, 12)), facade: Object.values(BUILDING_FACADES).includes(doors.facade) ? doors.facade : BUILDING_FACADES.FRONT, width: clamp(doors.width ?? 1.6, 0.7, 8), height: clamp(doors.height ?? 2.4, 1.8, 8), spacing: clamp(doors.spacing ?? 1, 0.2, 20), offset: Number(doors.offset) &#124;&#124; 0, type: BUILDING_OPENING_TYPES.DOOR.includes(doors.type) ? doors.type : "STANDARD", ...normalizeFloorRange(doors, floorCount, 1, 1), frame: appearance(doors.frame, { color: "#263842" }), leaf: appearance(doors.leaf, { color: "#405865" }), } |
| `doors.enabled` | boolean | doors.enabled ?? true |
| `doors.count` | number | Math.round(clamp(doors.count ?? 2, 1, 12)) |
| `doors.facade` | string | Object.values(BUILDING_FACADES).includes(doors.facade) ? doors.facade : BUILDING_FACADES.FRONT |
| `doors.width` | number | clamp(doors.width ?? 1.6, 0.7, 8) |
| `doors.height` | number | clamp(doors.height ?? 2.4, 1.8, 8) |
| `doors.spacing` | number | clamp(doors.spacing ?? 1, 0.2, 20) |
| `doors.offset` | number | Number(doors.offset) &#124;&#124; 0 |
| `doors.type` | string | BUILDING_OPENING_TYPES.DOOR.includes(doors.type) ? doors.type : "STANDARD" |
| `doors.*` | JSON (확장/병합) | normalizeFloorRange(doors, floorCount, 1, 1) |
| `doors.frame` | object | appearance(doors.frame, { color: "#263842" }) |
| `doors.leaf` | object | appearance(doors.leaf, { color: "#405865" }) |
| `windows` | object | { enabled: windows.enabled ?? true, count: Math.round(clamp(windows.count ?? 4, 1, 24)), facades: (windows.facades?.length ? windows.facades : Object.values(BUILDING_FACADES)) .filter((facade) => Object.values(BUILDING_FACADES).includes(facade)), width: clamp(windows.width ?? 1.4, 0.3, 8), height: clamp(windows.height ?? 1.3, 0.3, 5), sillHeight: clamp(windows.sillHeight ?? 1, 0.1, 5), spacing: clamp(windows.spacing ?? 0.8, 0.1, 20), offset: Number(windows.offset) &#124;&#124; 0, type: BUILDING_OPENING_TYPES.WINDOW.includes(windows.type) ? windows.type : "FIXED", ...normalizeFloorRange(windows, floorCount, 1, floorCount), frame: appearance(windows.frame, { color: "#425b66" }), glass: appearance(windows.glass, { materialPreset: "GLASS", color: "#4f8297" }), } |
| `windows.enabled` | boolean | windows.enabled ?? true |
| `windows.count` | number | Math.round(clamp(windows.count ?? 4, 1, 24)) |
| `windows.facades` | array | (windows.facades?.length ? windows.facades : Object.values(BUILDING_FACADES)) .filter((facade) => Object.values(BUILDING_FACADES).includes(facade)) |
| `windows.width` | number | clamp(windows.width ?? 1.4, 0.3, 8) |
| `windows.height` | number | clamp(windows.height ?? 1.3, 0.3, 5) |
| `windows.sillHeight` | number | clamp(windows.sillHeight ?? 1, 0.1, 5) |
| `windows.spacing` | number | clamp(windows.spacing ?? 0.8, 0.1, 20) |
| `windows.offset` | number | Number(windows.offset) &#124;&#124; 0 |
| `windows.type` | string | BUILDING_OPENING_TYPES.WINDOW.includes(windows.type) ? windows.type : "FIXED" |
| `windows.*` | JSON (확장/병합) | normalizeFloorRange(windows, floorCount, 1, floorCount) |
| `windows.frame` | object | appearance(windows.frame, { color: "#425b66" }) |
| `windows.glass` | object | appearance(windows.glass, { materialPreset: "GLASS", color: "#4f8297" }) |

## OpeningFloorRange

양 끝 포함 층 범위 1..floorCount.

JSON 위치: `hierarchy.nodes[].facadeOpenings.doors`, `hierarchy.nodes[].facadeOpenings.windows`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/buildingOpenings.js](../../../src/features/digitalTwin/editor/model/buildingOpenings.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `startFloor` | integer | startFloor |
| `endFloor` | integer | endFloor |

## FloorStyle

바닥 재질. MaterialAppearance 필드를 합쳐 보존.

JSON 위치: `floorPlansById.{floorId}.floorStyle`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/constants/floorSurfaceStyles.js](../../../src/features/digitalTwin/editor/constants/floorSurfaceStyles.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | normalized |
| `presetId` | string | preset.id |

## ApplicationScope

층간 구조 적용 범위. CURRENT/ALL/SELECTED/RANGE 및 시작·끝·선택 층 ID.

JSON 위치: `floorPlansById.{floorId}.structures[].applicationScope`, `verticalStructuresByBuildingId.{buildingId}[].applicationScope`, `roomScenes.{roomId}.worldStructures[].applicationScope`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_structure.structure_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useFloorPlanState.js](../../../src/features/digitalTwin/editor/store/useFloorPlanState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `*` | JSON (확장/병합) | structure.applicationScope |
| `connectedFloorIds` | string[] | connectedFloorIds |

## PipeConnection

배관 연결. 양쪽 설비 ID와 연결점 ID를 함께 저장.

JSON 위치: `roomScenes.{roomId}.pipeConnections[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_room_scene.scene_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useDigitalTwinEditorState.js](../../../src/features/digitalTwin/editor/store/useDigitalTwinEditorState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | createId("PIPE_CONNECTION") |
| `fromEquipmentId` | string | equipmentId |
| `fromPointId` | string | pipeSnapCandidate.movingPoint.id |
| `toEquipmentId` | string | pipeSnapCandidate.targetPoint.equipmentId |
| `toPointId` | string | pipeSnapCandidate.targetPoint.id |

## RoomDetailAsset

기존 방 상세 자산 메타데이터. objectUrl은 실제 serializer가 제거하므로 서버 저장 필드에서 제외. 바이너리 영속 연결 없는 legacy 레코드는 재업로드 필요.

JSON 위치: `roomScenes.{roomId}.detailAssets[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_room_scene.scene_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useDigitalTwinEditorState.js](../../../src/features/digitalTwin/editor/store/useDigitalTwinEditorState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `id` | string | assetId |
| `equipmentId` | string | equipmentId |
| `originalFileName` | string | file.name |
| `originalFormat` | string | extension.toUpperCase() |
| `fileSize` | number | file.size |
| `status` | string | "UPLOADING" |
| `uploadProgress` | number | 10 |
| `createdAt` | string | new Date().toISOString() |
| `calibration` | object | { positionX: 0, positionY: 0, positionZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, } |
| `calibration.positionX` | number | 0 |
| `calibration.positionY` | number | 0 |
| `calibration.positionZ` | number | 0 |
| `calibration.rotationX` | number | 0 |
| `calibration.rotationY` | number | 0 |
| `calibration.rotationZ` | number | 0 |
| `calibration.scale` | number | 1 |

## FloorPlanExtras

기존 plan의 관리 속성. 지형과 구조물도 원본 그대로 보존.

JSON 위치: `floorPlansById.{floorId}`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useFloorPlanState.js](../../../src/features/digitalTwin/editor/store/useFloorPlanState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `floorId` | string | 사전 키와 같은 층 ID |
| `structures[]` | object | WorldStructure |
| `visibilityFilters.{groupId}` | boolean | 구조물 그룹 표시 |
| `floorStyle` | object | FloorSurfaceStyle |
| `terrain` | object | Terrain 전체 구조와 같음; 층 바닥 지형 |
| `*` | JSON | normalizeFloorSpatialPlan의 ...plan에서 보존하는 추가 필드. selectedSpatialEntity만 직렬화 제외 |

## StructureOwnership

타입별 적용 범위와 소유 관계.

JSON 위치: `floorPlansById.{floorId}.structures[]`, `verticalStructuresByBuildingId.{buildingId}[]`, `roomScenes.{roomId}.worldStructures[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_structure.structure_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/store/useFloorPlanState.js](../../../src/features/digitalTwin/editor/store/useFloorPlanState.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `buildingId` | string | 소유 건물 |
| `direction` | string | 기본 UP; 구조물 방향 |
| `structureType` | string | 템플릿 ID |
| `applicationScope.mode` | string | CURRENT/ALL/SELECTED/RANGE |
| `applicationScope.floorIds[]` | string | 선택 층 ID |
| `applicationScope.startFloorId` | string&#124;null | 시작 층 |
| `applicationScope.endFloorId` | string&#124;null | 끝 층 |
| `applicationScope.connectedFloorIds[]` | string | 계산된 연결 층 |
| `parameters.*` | JSON | viewer-template-catalog.structures의 타입별 defaultParameters 전체 |

## HierarchyExtensions

호스트·커스텀 건물·지하층·사용자 재질에 따른 선택 필드.

JSON 위치: `hierarchy.nodes[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/observationWorkflow.js](../../../src/features/digitalTwin/editor/model/observationWorkflow.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `systemHost` | boolean | 관측 전용 내부 건물/층이면 true |
| `floorHeight` | number | 층 높이 m |
| `parameters.basementFloorCount` | integer | 0..20 |
| `parameters.basementFloorHeight` | number | m >=2, 없으면 floorHeight 또는 3.6 |
| `customAssetId` | string&#124;null | 사용자 건축 자산 ID |
| `customAssetRevision` | integer&#124;null | 사용자 자산 revision |
| `customAssetSnapshot` | object&#124;null | CustomBuilding 전체 구조 |
| `floorFootprint` | object | FloorFootprint 또는 points/holes legacy 형태 |
| `parameters.footprint` | object | legacy footprint |
| `userTexture` | object&#124;null | UserTexture |
| `*` | JSON | 노드 원본 확장 필드 보존 |

## PlanGeometryLeaf

평면도 점과 곡선 부가 정보.

JSON 위치: `floorPlansById.{floorId}.floorFootprint.regions[].outer[]`, `floorPlansById.{floorId}.floorFootprint.regions[].holes[][]`, `floorPlansById.{floorId}.rooms[].outline[]`, `floorPlansById.{floorId}.elevationZones[].boundary[]`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/floorSpatialModel.js](../../../src/features/digitalTwin/editor/model/floorSpatialModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `x` | number | m |
| `z` | number | m |
| `curveToNext` | JSON | 다음 점까지 곡선 정보; 소스에서 원본 값을 보존 |

## ElevationEdges

경계별 처리 종류 사전.

JSON 위치: `floorPlansById.{floorId}.elevationZones[].edgeTreatments`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_floor_plan.plan_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/floorSpatialModel.js](../../../src/features/digitalTwin/editor/model/floorSpatialModel.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `{edgeIndex}` | string | STEP/STAIR/RAMP/VERTICAL_FACE/OPEN |

## OutdoorPlacement

부지 설비의 부착 대상 및 상대 위치.

JSON 위치: `siteObjects[].placement`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/outdoorEquipmentPlacement.js](../../../src/features/digitalTwin/editor/model/outdoorEquipmentPlacement.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `mode` | string&#124;null | GROUND/ROOF/WALL/UNDERGROUND/ROAD_EDGE |
| `roadId` | string | ROAD_EDGE인 경우 연결 도로 |
| `buildingId` | string&#124;null | 부착 건물 |
| `localPosition` | object&#124;null | {x,y,z} m, 건물 상대 좌표 |
| `localPosition.x` | number | m |
| `localPosition.y` | number | m |
| `localPosition.z` | number | m |
| `heightRatio` | number | WALL에서 상대 높이 / 건물 높이 |

## OutdoorPlacementRules

템플릿이 허용하는 야외 설치 방식. 나머지 템플릿 기본 키는 카탈로그 원문 보존.

JSON 위치: `siteObjects[].placementRules`.

원본 저장: `dt_project_revision.layout_json`. 검색용 복제: `dt_scene_node.node_json`. 각 경로별 행 키와 컬럼 내부 경로는 [필드 색인](../data/viewer-json-field-index.json)의 `rowKey`, `dbJsonPointerTemplate`을 따른다. 근거: [src/features/digitalTwin/editor/model/outdoorEquipmentPlacement.js](../../../src/features/digitalTwin/editor/model/outdoorEquipmentPlacement.js).

| 하위 필드 | 자료형 | 생성·정규화·허용값 근거 |
|---|---|---|
| `allowedModes[]` | string | OUTDOOR_PLACEMENT_MODES |
| `snapDistance` | number | 건물 부착 거리, 없으면 1.5m |
| `roadSnapDistance` | number | 도로 가장자리 부착 거리, 없으면 4m |
| `*` | JSON | 해당 템플릿 placementRules 전체 |

