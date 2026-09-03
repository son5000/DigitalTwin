import {
  DEFAULT_BUILDING_DEFINITION,
  HIERARCHY_NODE_TYPES,
} from "./digitalTwinHierarchy.js";
import { WORLD_WIZARD_STEP_IDS } from "../constants/worldWizard.js";

export const OBSERVATION_SCOPE_TYPES = Object.freeze({
  SITE: "SITE",
  BUILDING: "BUILDING",
  SINGLE_EQUIPMENT: "SINGLE_EQUIPMENT",
  MULTI_EQUIPMENT: "MULTI_EQUIPMENT",
  CUSTOM: "CUSTOM",
});

export const OBSERVATION_HOST_IDS = Object.freeze({
  SITE: "SITE_MAIN",
  BUILDING: "OBSERVATION_HOST_BUILDING",
  FLOOR: "OBSERVATION_HOST_FLOOR_1",
});

export const OBSERVATION_VIEWER_MODES = Object.freeze({
  SITE: "SITE_OVERVIEW",
  BUILDING: "BUILDING_FOCUS",
  SINGLE_EQUIPMENT: "SINGLE_EQUIPMENT_FOCUS",
  MULTI_EQUIPMENT: "MULTI_EQUIPMENT_OVERVIEW",
});

const ALL_STEPS = Object.freeze([
  WORLD_WIZARD_STEP_IDS.COMPOSITION,
  WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT,
  WORLD_WIZARD_STEP_IDS.MONITORING,
]);

export const OBSERVATION_SCOPE_DEFINITIONS = Object.freeze([
  {
    id: OBSERVATION_SCOPE_TYPES.SITE,
    title: "전체 공간·부지",
    description: "부지부터 건축물, 층별 도면과 설비 관측까지 전체 디지털 트윈을 구성합니다.",
    steps: ALL_STEPS,
    stepLabels: ["공간 구성", "도면·설비", "설비 상세"],
    result: "부지 전체를 자유롭게 탐색하는 통합 뷰어",
    viewerMode: OBSERVATION_VIEWER_MODES.SITE,
  },
  {
    id: OBSERVATION_SCOPE_TYPES.BUILDING,
    title: "건물 중심 관측",
    description: "한 동의 건축물과 층을 간단히 정한 뒤 도면과 설비를 연결합니다.",
    steps: ALL_STEPS,
    stepLabels: ["건물·층 설정", "도면·설비", "설비 상세"],
    result: "선택 건물과 층 이동에 집중한 뷰어",
    viewerMode: OBSERVATION_VIEWER_MODES.BUILDING,
  },
  {
    id: OBSERVATION_SCOPE_TYPES.SINGLE_EQUIPMENT,
    title: "단일 설비 관측",
    description: "내부 호스트를 자동 준비하고 한 설비의 자산·센서·관측 설정으로 바로 이동합니다.",
    steps: [WORLD_WIZARD_STEP_IDS.MONITORING],
    stepLabels: ["설비 상세"],
    result: "선택 설비를 즉시 확대하는 집중 뷰어",
    viewerMode: OBSERVATION_VIEWER_MODES.SINGLE_EQUIPMENT,
  },
  {
    id: OBSERVATION_SCOPE_TYPES.MULTI_EQUIPMENT,
    title: "다중 설비 관측",
    description: "필요한 설비만 간단히 배치하고 목록에서 전환하며 각각의 상세를 설정합니다.",
    steps: [WORLD_WIZARD_STEP_IDS.FLOOR_AND_EQUIPMENT, WORLD_WIZARD_STEP_IDS.MONITORING],
    stepLabels: ["설비 선택·배치", "각 설비 상세"],
    result: "설비 전체 보기와 빠른 설비 전환 목록",
    viewerMode: OBSERVATION_VIEWER_MODES.MULTI_EQUIPMENT,
  },
  {
    id: OBSERVATION_SCOPE_TYPES.CUSTOM,
    title: "사용자 정의",
    description: "현재 목적에 필요한 편집 단계만 직접 선택합니다.",
    steps: ALL_STEPS,
    stepLabels: ["단계 직접 선택"],
    result: "선택한 단계와 대상에 맞춘 사용자 정의 뷰어",
    viewerMode: OBSERVATION_VIEWER_MODES.SITE,
  },
]);

const DEFINITION_MAP = new Map(OBSERVATION_SCOPE_DEFINITIONS.map((definition) => [definition.id, definition]));

export function getObservationScopeDefinition(scopeType) {
  return DEFINITION_MAP.get(scopeType) ?? DEFINITION_MAP.get(OBSERVATION_SCOPE_TYPES.SITE);
}

export function normalizeActiveObservationSteps(steps, fallback = ALL_STEPS) {
  const selected = new Set(Array.isArray(steps) ? steps : fallback);
  const normalized = ALL_STEPS.filter((stepId) => selected.has(stepId));
  return normalized.length ? normalized : [WORLD_WIZARD_STEP_IDS.MONITORING];
}

export function createUnconfiguredObservationWorkflow() {
  return {
    configured: false,
    scopeType: null,
    activeStepIds: [],
    viewerSettings: { mode: OBSERVATION_VIEWER_MODES.SITE, focusBuildingId: null, equipmentIds: [], activeEquipmentId: null },
  };
}

export function createObservationWorkflow(scopeType, options = {}) {
  const definition = getObservationScopeDefinition(scopeType);
  const activeStepIds = scopeType === OBSERVATION_SCOPE_TYPES.CUSTOM
    ? normalizeActiveObservationSteps(options.activeStepIds)
    : [...definition.steps];
  return {
    configured: true,
    scopeType,
    activeStepIds,
    viewerSettings: {
      mode: options.viewerSettings?.mode ?? definition.viewerMode,
      focusBuildingId: options.viewerSettings?.focusBuildingId ?? null,
      equipmentIds: [...new Set(options.viewerSettings?.equipmentIds ?? [])],
      activeEquipmentId: options.viewerSettings?.activeEquipmentId ?? null,
    },
  };
}

export function normalizeObservationWorkflow(workflow, { legacyLayout = false } = {}) {
  if (!workflow?.configured) {
    return legacyLayout ? createObservationWorkflow(OBSERVATION_SCOPE_TYPES.SITE) : createUnconfiguredObservationWorkflow();
  }
  const scopeType = Object.values(OBSERVATION_SCOPE_TYPES).includes(workflow.scopeType)
    ? workflow.scopeType
    : OBSERVATION_SCOPE_TYPES.SITE;
  return createObservationWorkflow(scopeType, workflow);
}

export function resolveObservationEquipmentId(workflow, equipment = [], selectedEquipmentId = null) {
  const availableIds = new Set(equipment.map((item) => item.id));
  if (selectedEquipmentId && availableIds.has(selectedEquipmentId)) return selectedEquipmentId;
  const activeId = workflow?.viewerSettings?.activeEquipmentId;
  if (activeId && availableIds.has(activeId)) return activeId;
  const scopedId = workflow?.viewerSettings?.equipmentIds?.find((id) => availableIds.has(id));
  return scopedId ?? equipment[0]?.id ?? null;
}

export function ensureObservationHostHierarchy(hierarchy, scopeType, activeStepIds = []) {
  const needsInternalHost = [OBSERVATION_SCOPE_TYPES.SINGLE_EQUIPMENT, OBSERVATION_SCOPE_TYPES.MULTI_EQUIPMENT].includes(scopeType)
    || (scopeType === OBSERVATION_SCOPE_TYPES.CUSTOM && !activeStepIds.includes(WORLD_WIZARD_STEP_IDS.COMPOSITION));
  if (!needsInternalHost) {
    return { hierarchy, buildingId: null, floorId: null, created: false };
  }
  const nodes = [...(hierarchy?.nodes ?? [])];
  const existingBuilding = nodes.find((node) => node.type === HIERARCHY_NODE_TYPES.BUILDING);
  const buildingId = existingBuilding?.id ?? OBSERVATION_HOST_IDS.BUILDING;
  if (!existingBuilding) {
    nodes.push({
      ...DEFAULT_BUILDING_DEFINITION,
      id: buildingId,
      type: HIERARCHY_NODE_TYPES.BUILDING,
      parentId: hierarchy.rootId,
      name: "관측 대상 건물",
      parameters: { ...DEFAULT_BUILDING_DEFINITION.parameters, floorCount: 1 },
      position: { ...DEFAULT_BUILDING_DEFINITION.position },
      rotation: { ...DEFAULT_BUILDING_DEFINITION.rotation },
      appearance: { ...DEFAULT_BUILDING_DEFINITION.appearance },
      variants: { ...DEFAULT_BUILDING_DEFINITION.variants },
      systemHost: true,
    });
  }
  const existingFloor = nodes.find((node) => node.type === HIERARCHY_NODE_TYPES.FLOOR && node.parentId === buildingId);
  const floorId = existingFloor?.id ?? OBSERVATION_HOST_IDS.FLOOR;
  if (!existingFloor) {
    nodes.push({
      id: floorId,
      type: HIERARCHY_NODE_TYPES.FLOOR,
      parentId: buildingId,
      name: "1층",
      level: 1,
      elevation: 0,
      floorHeight: 3.6,
      systemHost: true,
    });
  }
  return {
    hierarchy: { ...hierarchy, selectedNodeId: buildingId, nodes },
    buildingId,
    floorId,
    created: !existingBuilding || !existingFloor,
  };
}

export function expandObservationWorkflow(current, targetScopeType, options = {}) {
  const next = createObservationWorkflow(targetScopeType, options);
  const activeStepIds = normalizeActiveObservationSteps([...(current?.activeStepIds ?? []), ...next.activeStepIds]);
  return { ...next, activeStepIds };
}

export const OBSERVATION_ALL_STEP_IDS = ALL_STEPS;
