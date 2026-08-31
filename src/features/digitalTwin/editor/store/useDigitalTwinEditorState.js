import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getRuntimeCustomAsset } from "@/features/customAssets/core/customAssetRegistry";
import { getFloorBaseElevation, getFloorHeight } from "@/features/customAssets/building/buildingMetrics";

import {
  DEFAULT_WORLD,
  EQUIPMENT_SHAPE_TEMPLATE_MAP,
  TRANSFORM_MODES,
  VIEW_MODES,
} from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import {
  cycleTransformMoveAxisMode,
  DEFAULT_TRANSFORM_TOOLS,
  normalizeTransformTools,
} from "@/features/digitalTwin/editor/constants/transformTools";
import {
  getDefaultObjectVariants,
  OBJECT_LIBRARY_DEFINITION_MAP,
} from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import {
  createEquipmentPart,
  normalizeEquipmentPart,
} from "@/features/digitalTwin/editor/constants/partTemplates";
import {
  createDefaultGridSettings,
  createGridRegion,
  normalizeGridCellSize,
  normalizeGridRegion,
  normalizeGridSettings,
  snapHorizontalPosition,
} from "@/features/digitalTwin/editor/constants/gridSettings";
import {
  createSiteObjectFromArea,
  normalizeSiteObject,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import {
  clampObjectPositionToSite,
  DEFAULT_SITE_ENVIRONMENT,
  intersectAreaWithSite,
  normalizeSiteEnvironment,
  resolveSiteEnvironmentFromLayout,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentSettings";
import {
  createInitialNavigationContext,
  EDITOR_DEPTHS,
} from "@/features/digitalTwin/editor/constants/editorNavigation";
import {
  clampDimension,
  clampPositionToWorld,
  findCollidingEquipmentIds,
  snapValue,
} from "@/features/digitalTwin/editor/utils/editorMath";
import { placeObjectsInArea } from "@/features/digitalTwin/editor/utils/siteAreaPlacement";
import {
  findPipeSnapCandidate,
  resolvePipeSnap,
} from "@/features/digitalTwin/editor/utils/pipeConnections";
import {
  createTemplateInstanceDefaults,
  getDimensionsFromParameters,
  normalizeEquipmentInstance,
} from "@/features/digitalTwin/editor/utils/templateParameters";
import {
  createDefaultHierarchy,
  createHierarchyNode,
  getHierarchyDescendantIds,
  getHierarchyPath,
  HIERARCHY_CHILD_TYPES,
  HIERARCHY_NODE_TYPES,
  normalizeHierarchy,
} from "@/features/digitalTwin/editor/model/digitalTwinHierarchy";
import useWorldStructureState, {
  createDefaultWorldWalls,
} from "@/features/digitalTwin/editor/store/useWorldStructureState";
import useFloorPlanState from "@/features/digitalTwin/editor/store/useFloorPlanState";
import useFloorEquipmentState from "@/features/digitalTwin/editor/store/useFloorEquipmentState";
import useMonitoringState from "@/features/digitalTwin/editor/store/useMonitoringState";

const FAVORITES_KEY = "digital-twin-editor-favorites";
const RECENT_KEY = "digital-twin-editor-recent-templates";
const SUPPORTED_SCAN_FORMATS = new Set(["glb", "gltf", "obj", "ply"]);
const HISTORY_LIMIT = 60;
const HISTORY_COMMIT_DELAY = 240;

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function readStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function mergeEquipment(equipment, changes) {
  const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[
    changes.shapeTemplateId ?? equipment.shapeTemplateId
  ];

  if (!template) return equipment;

  if (changes.shapeTemplateId && changes.shapeTemplateId !== equipment.shapeTemplateId) {
    return normalizeEquipmentInstance(
      {
        ...equipment,
        ...createTemplateInstanceDefaults(template),
        ...changes,
        shapeTemplateId: template.id,
      },
      template,
    );
  }

  const parameters = changes.parameters
    ? { ...equipment.parameters, ...changes.parameters }
    : equipment.parameters;
  const dimensions = changes.parameters
    ? getDimensionsFromParameters(template, parameters)
    : changes.dimensions
      ? { ...equipment.dimensions, ...changes.dimensions }
      : equipment.dimensions;

  return {
    ...equipment,
    ...changes,
    parameters,
    dimensions,
    appearance: changes.appearance
      ? { ...equipment.appearance, ...changes.appearance }
      : equipment.appearance,
    metadata: changes.metadata
      ? { ...(equipment.metadata ?? {}), ...changes.metadata }
      : equipment.metadata,
    dataBindings: changes.dataBindings ?? equipment.dataBindings ?? [],
    operationalState: changes.operationalState
      ? { ...(equipment.operationalState ?? {}), ...changes.operationalState }
      : equipment.operationalState,
    control: changes.control
      ? { ...(equipment.control ?? {}), ...changes.control }
      : equipment.control,
    position: changes.position
      ? { ...equipment.position, ...changes.position }
      : equipment.position,
    rotation: changes.rotation
      ? { ...equipment.rotation, ...changes.rotation }
      : equipment.rotation,
  };
}

function sanitizeHydratedAsset(asset) {
  return {
    ...asset,
    objectUrl: null,
    status: asset.status === "READY" ? "MISSING_LOCAL_FILE" : asset.status,
    uploadProgress: 0,
  };
}

function createDefaultRoomScene() {
  return {
    version: 4,
    world: { ...DEFAULT_WORLD },
    equipment: [],
    detailAssets: [],
    pipeConnections: [],
    worldStructures: createDefaultWorldWalls(DEFAULT_WORLD),
    worldStructuresLocked: false,
    visibilityFilters: {},
  };
}

function cloneHistoryValue(value) {
  return structuredClone(value);
}

function createHistorySnapshot(layoutDocument) {
  const roomScenes = Object.fromEntries(
    Object.entries(layoutDocument.roomScenes ?? {})
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
      .map(([roomId, scene]) => [roomId, scene]),
  );
  return cloneHistoryValue({
    hierarchy: {
      rootId: layoutDocument.hierarchy.rootId,
      nodes: layoutDocument.hierarchy.nodes,
    },
    gridSettings: layoutDocument.gridSettings,
    siteEnvironment: layoutDocument.siteEnvironment,
    siteObjects: layoutDocument.siteObjects,
    roomScenes,
    floorPlansById: layoutDocument.floorPlansById,
    verticalStructuresByBuildingId: layoutDocument.verticalStructuresByBuildingId,
    equipmentByFloorId: layoutDocument.equipmentByFloorId,
    equipmentAssetBindings: layoutDocument.equipmentAssetBindings,
    sensorBindings: layoutDocument.sensorBindings,
    observationPoints: layoutDocument.observationPoints,
    serverBindings: layoutDocument.serverBindings,
  });
}

function getHistorySignature(snapshot) {
  return JSON.stringify(snapshot);
}

function mergeBuildingDefinition(building, changes) {
  const parameters = changes.parameters
    ? Object.fromEntries(Object.entries({ ...building.parameters, ...changes.parameters }).map(([key, value]) => {
        if (typeof value !== "number") return [key, value];
        if (key === "floorCount") return [key, Math.min(100, Math.max(1, Math.round(value)))];
        if (key === "entranceCount") return [key, Math.min(12, Math.max(1, Math.round(value)))];
        if (key === "stairCount") return [key, Math.min(8, Math.max(0, Math.round(value)))];
        if (key === "floorHeight") return [key, Math.max(2, value)];
        if (key === "width" || key === "depth") return [key, Math.max(5, value)];
        return [key, value];
      }))
    : building.parameters;

  return {
    ...building,
    ...changes,
    parameters,
    position: changes.position ? { ...building.position, ...changes.position } : building.position,
    rotation: changes.rotation ? { ...building.rotation, ...changes.rotation } : building.rotation,
    appearance: changes.appearance ? { ...building.appearance, ...changes.appearance } : building.appearance,
    variants: changes.variants ? { ...building.variants, ...changes.variants } : building.variants,
  };
}

function clampBuildingToSite(building, siteEnvironment) {
  const result = clampObjectPositionToSite(
    building.position,
    { width: building.parameters.width, depth: building.parameters.depth },
    building.rotation?.y,
    siteEnvironment,
  );
  return { entity: { ...building, position: result.position }, ...result };
}

function clampSiteObjectToSite(object, siteEnvironment) {
  const result = clampObjectPositionToSite(
    object.position,
    object.dimensions,
    object.rotation?.y,
    siteEnvironment,
  );
  return { entity: { ...object, position: result.position }, ...result };
}

function getSiteBoundaryNotice(movedCount, oversizedCount) {
  if (!movedCount && !oversizedCount) return "";
  const messages = [];
  if (movedCount) messages.push(`경계 밖 오브젝트 ${movedCount}개를 부지 안쪽으로 자동 이동했습니다.`);
  if (oversizedCount) messages.push(`부지보다 큰 오브젝트 ${oversizedCount}개는 중앙에 유지했습니다.`);
  return messages.join(" ");
}

function createBuildingFloors(building, existingFloors = []) {
  const floorCount = Math.min(100, Math.max(1, Math.round(building.parameters.floorCount ?? 1)));
  const floorHeight = Math.max(2, building.parameters.floorHeight ?? 4);
  const customAsset = building.customAssetId
    ? building.customAssetAutoUpdate === false
      ? building.customAssetSnapshot
      : getRuntimeCustomAsset(building.customAssetId) ?? building.customAssetSnapshot
    : null;
  return Array.from({ length: floorCount }, (_, index) => {
    const existing = existingFloors[index];
    const level = index + 1;
    const resolvedFloorHeight = customAsset ? getFloorHeight(customAsset, level) : floorHeight;
    const elevation = customAsset ? getFloorBaseElevation(customAsset, level) : index * floorHeight;
    return createHierarchyNode(HIERARCHY_NODE_TYPES.FLOOR, building.id, index, {
      ...existing,
      parentId: building.id,
      level,
      elevation,
      floorHeight: resolvedFloorHeight,
      name: existing?.name ?? `${level}층`,
    });
  });
}

function createBuildingDefinitionFromArea({
  rootId,
  siblingIndex,
  area,
  templateId = "BUILDING",
  variantOverrides = {},
  placementOptions = {},
}) {
  const definition = OBJECT_LIBRARY_DEFINITION_MAP[templateId]
    ?? OBJECT_LIBRARY_DEFINITION_MAP.BUILDING;
  if (!definition?.createsBuilding) return null;
  const scale = placementOptions.scale ?? { x: 1, y: 1, z: 1 };
  const scaleX = Math.max(0.01, Number(scale?.x ?? scale) || 1);
  const scaleY = Math.max(0.01, Number(scale?.y ?? scale) || 1);
  const scaleZ = Math.max(0.01, Number(scale?.z ?? scale) || 1);
  const building = createHierarchyNode(HIERARCHY_NODE_TYPES.BUILDING, rootId, siblingIndex, {
    templateId: definition.id,
    objectDefinitionId: definition.id,
    name: `${definition.name} ${String(siblingIndex + 1).padStart(2, "0")}`,
    variants: { ...getDefaultObjectVariants(definition), ...variantOverrides },
    position: {
      x: Number(area?.center?.x) || 0,
      y: 0,
      z: Number(area?.center?.z) || 0,
    },
    rotation: { x: 0, y: Number(placementOptions.rotationY) || 0, z: 0 },
    parameters: {
      ...definition.parameters,
      width: Math.max(5, (Number(area?.width) || definition.width || 5) * scaleX),
      depth: Math.max(5, (Number(area?.depth) || definition.depth || 5) * scaleZ),
      floorHeight: Math.max(2, (definition.parameters?.floorHeight ?? 4) * scaleY),
      roofType: variantOverrides.roofStyle
        ?? definition.defaultVariants?.roofStyle
        ?? definition.parameters?.roofType
        ?? "FLAT",
    },
    appearance: { color: definition.color, material: definition.material },
    customAssetId: definition.customAssetId ?? null,
    customAssetRevision: definition.customAssetRevision ?? null,
    customAssetAutoUpdate: Boolean(definition.customAssetId),
    customAssetSnapshot: definition.customAsset ? structuredClone(definition.customAsset) : null,
    customAssetScale: definition.customAssetId ? { x: scaleX, y: scaleY, z: scaleZ } : null,
    customAssetViewGroupId: definition.customAsset?.defaultViewGroupId ?? null,
    customAssetViewMode: "ALL",
    customAssetExploded: false,
  });
  return { building, floors: createBuildingFloors(building) };
}

function findHierarchyAncestor(nodes, nodeId, type) {
  let node = nodes.find((item) => item.id === nodeId) ?? null;
  while (node) {
    if (node.type === type) return node;
    node = nodes.find((item) => item.id === node.parentId) ?? null;
  }
  return null;
}

export default function useDigitalTwinEditorState() {
  const [hierarchy, setHierarchy] = useState(createDefaultHierarchy);
  const [roomScenes, setRoomScenes] = useState({});
  const [siteEnvironment, setSiteEnvironment] = useState(DEFAULT_SITE_ENVIRONMENT);
  const [siteBoundaryNotice, setSiteBoundaryNotice] = useState("");
  const [siteObjects, setSiteObjects] = useState([]);
  const [selectedSiteObjectId, setSelectedSiteObjectId] = useState(null);
  const [world, setWorld] = useState(DEFAULT_WORLD);
  const [equipmentInstances, setEquipmentInstances] = useState([]);
  const [detailAssets, setDetailAssets] = useState([]);
  const [pipeConnections, setPipeConnections] = useState([]);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState(() => readStoredList(FAVORITES_KEY));
  const [recentTemplateIds, setRecentTemplateIds] = useState(() => readStoredList(RECENT_KEY));
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [viewMode, setViewMode] = useState(VIEW_MODES.VIEW_3D);
  const [transformMode, setTransformMode] = useState(TRANSFORM_MODES.TRANSLATE);
  const [transformTools, setTransformTools] = useState(DEFAULT_TRANSFORM_TOOLS);
  const [gridSettings, setGridSettings] = useState(createDefaultGridSettings);
  const [navigationContext, setNavigationContext] = useState(createInitialNavigationContext);
  const [historyAvailability, setHistoryAvailability] = useState({ canUndo: false, canRedo: false });
  const snapSize = gridSettings.baseSize;
  const scanTimersRef = useRef(new Map());
  const historyPastRef = useRef([]);
  const historyFutureRef = useRef([]);
  const historyCurrentRef = useRef(null);
  const historyPendingRef = useRef(null);
  const historyTimerRef = useRef(null);
  const restoringHistoryRef = useRef(false);
  const structureEditor = useWorldStructureState({
    gridSettings,
    gridScopeId: hierarchy.activeRoomId,
  });
  const {
    setEditorMode: setStructureEditorMode,
    selectWorldTemplate,
    addWorldStructure,
    updateWorldStructure,
    selectWorldStructure: selectWorldStructureState,
    removeSelectedWorldStructure,
    duplicateSelectedWorldStructure,
    setWorldStructuresLocked,
    toggleVisibilityFilter,
    hydrateWorldStructures,
    resetWorldStructures,
  } = structureEditor.actions;

  useEffect(
    () => () => {
      scanTimersRef.current.forEach((timerIds) => timerIds.forEach(clearTimeout));
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteTemplateIds));
  }, [favoriteTemplateIds]);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentTemplateIds));
  }, [recentTemplateIds]);

  const selectedEquipment = useMemo(
    () => equipmentInstances.find((equipment) => equipment.id === selectedEquipmentId) ?? null,
    [equipmentInstances, selectedEquipmentId],
  );
  const selectedSiteObject = useMemo(
    () => siteObjects.find((object) => object.id === selectedSiteObjectId) ?? null,
    [selectedSiteObjectId, siteObjects],
  );
  const selectedDetailAsset = useMemo(
    () => detailAssets.find((asset) => asset.id === selectedEquipment?.detailAssetId) ?? null,
    [detailAssets, selectedEquipment?.detailAssetId],
  );
  const collisionIds = useMemo(
    () => findCollidingEquipmentIds(equipmentInstances),
    [equipmentInstances],
  );
  const pipeSnapCandidate = useMemo(
    () => selectedEquipment
      ? findPipeSnapCandidate(selectedEquipment, equipmentInstances, pipeConnections)
      : null,
    [equipmentInstances, pipeConnections, selectedEquipment],
  );
  const activeRoom = useMemo(
    () => hierarchy.nodes.find((node) => node.id === hierarchy.activeRoomId) ?? null,
    [hierarchy.activeRoomId, hierarchy.nodes],
  );
  const hierarchyPath = useMemo(
    () => getHierarchyPath(hierarchy.nodes, hierarchy.activeRoomId),
    [hierarchy.activeRoomId, hierarchy.nodes],
  );
  const rooms = useMemo(
    () => hierarchy.nodes.filter((node) => node.type === HIERARCHY_NODE_TYPES.ROOM),
    [hierarchy.nodes],
  );
  const selectedHierarchyNode = useMemo(
    () => hierarchy.nodes.find((node) => node.id === hierarchy.selectedNodeId) ?? activeRoom,
    [activeRoom, hierarchy.nodes, hierarchy.selectedNodeId],
  );
  const selectedHierarchyPath = useMemo(
    () => getHierarchyPath(hierarchy.nodes, selectedHierarchyNode?.id),
    [hierarchy.nodes, selectedHierarchyNode?.id],
  );
  const navigationNodeId = navigationContext.currentRoomId
    ?? navigationContext.currentFloorId
    ?? navigationContext.currentBuildingId
    ?? hierarchy.rootId;
  const hierarchyNavigationPath = useMemo(
    () => getHierarchyPath(hierarchy.nodes, navigationNodeId),
    [hierarchy.nodes, navigationNodeId],
  );
  const navigationPath = useMemo(
    () => navigationContext.currentDepth === EDITOR_DEPTHS.EQUIPMENT && selectedEquipment
      ? [
          ...hierarchyNavigationPath,
          { id: selectedEquipment.id, name: selectedEquipment.name, type: EDITOR_DEPTHS.EQUIPMENT },
        ]
      : hierarchyNavigationPath,
    [hierarchyNavigationPath, navigationContext.currentDepth, selectedEquipment],
  );
  const currentBuilding = useMemo(
    () => hierarchy.nodes.find((node) => node.id === navigationContext.currentBuildingId) ?? null,
    [hierarchy.nodes, navigationContext.currentBuildingId],
  );
  const currentFloor = useMemo(
    () => hierarchy.nodes.find((node) => node.id === navigationContext.currentFloorId) ?? null,
    [hierarchy.nodes, navigationContext.currentFloorId],
  );
  const selectedBuilding = useMemo(
    () => selectedHierarchyPath.find((node) => node.type === HIERARCHY_NODE_TYPES.BUILDING) ?? null,
    [selectedHierarchyPath],
  );
  const buildings = useMemo(
    () => hierarchy.nodes.filter((node) => node.type === HIERARCHY_NODE_TYPES.BUILDING),
    [hierarchy.nodes],
  );
  const floors = useMemo(
    () => hierarchy.nodes.filter((node) => node.type === HIERARCHY_NODE_TYPES.FLOOR),
    [hierarchy.nodes],
  );
  const protectedHierarchyNodeIds = useMemo(
    () => new Set(hierarchyNavigationPath.map((node) => node.id)),
    [hierarchyNavigationPath],
  );
  const floorPlanEditor = useFloorPlanState({ buildings, floors, currentBuilding, currentFloor, gridSettings });
  const floorEquipmentEditor = useFloorEquipmentState({ buildings, floors, currentBuilding, currentFloor, gridSettings, floorPlansById: floorPlanEditor.floorPlansById });
  const monitoringEditor = useMonitoringState({ equipment: floorEquipmentEditor.allFloorEquipment });
  const currentRoomScene = useMemo(() => ({
    version: 4,
    world,
    equipment: equipmentInstances,
    detailAssets,
    pipeConnections,
    worldStructures: structureEditor.worldStructures,
    worldStructuresLocked: structureEditor.worldStructuresLocked,
    visibilityFilters: structureEditor.visibilityFilters,
  }), [
    detailAssets,
    equipmentInstances,
    pipeConnections,
    structureEditor.visibilityFilters,
    structureEditor.worldStructures,
    structureEditor.worldStructuresLocked,
    world,
  ]);

  const rememberTemplate = useCallback((templateId) => {
    setRecentTemplateIds((currentIds) =>
      [templateId, ...currentIds.filter((id) => id !== templateId)].slice(0, 8),
    );
  }, []);

  const addEquipment = useCallback(
    (templateId, floorPosition) => {
      const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[templateId];
      if (!template) return;

      const id = createId("WORLD_OBJECT");
      setEquipmentInstances((currentEquipment) => {
        const categoryCount = currentEquipment.filter(
          (equipment) => equipment.category === template.category,
        ).length;
        const sequence = String(categoryCount + 1).padStart(2, "0");
        const defaults = createTemplateInstanceDefaults(template);
        const { position: snappedPosition } = snapHorizontalPosition({
          x: floorPosition.x,
          y: 0,
          z: floorPosition.z,
        }, gridSettings, hierarchy.activeRoomId);

        return [
          ...currentEquipment,
          {
            id,
            name: `${template.nameKo} ${sequence}`,
            shapeTemplateId: template.id,
            ...defaults,
            position: clampPositionToWorld(snappedPosition, defaults.dimensions, world),
            rotation: { x: 0, y: 0, z: 0 },
            detailAssetId: null,
            metadata: {
              assetTag: "",
              manufacturer: "",
              model: "",
              serialNumber: "",
            },
            dataBindings: [],
            operationalState: {
              status: "UNCOMMISSIONED",
              alarmLevel: "NONE",
              lastUpdatedAt: null,
            },
            control: {
              enabled: false,
              mode: "MONITOR_ONLY",
              endpoint: "",
            },
            visible: true,
            locked: false,
            groundSurfaceId: "FLOOR",
          },
        ];
      });
      rememberTemplate(templateId);
      setSelectedEquipmentId(id);
      setActiveTemplateId(null);
    },
    [gridSettings, hierarchy.activeRoomId, rememberTemplate, world],
  );

  const updateEquipment = useCallback((equipmentId, changes) => {
    setEquipmentInstances((currentEquipment) =>
      currentEquipment.map((equipment) => {
        if (equipment.id !== equipmentId) return equipment;

        const nextEquipment = mergeEquipment(equipment, changes);
        const dimensions = Object.fromEntries(
          Object.entries(nextEquipment.dimensions).map(([key, value]) => [key, clampDimension(value)]),
        );

        return { ...nextEquipment, dimensions, position: { ...nextEquipment.position } };
      }),
    );

    if (changes.position || changes.rotation || changes.parameters || changes.dimensions) {
      setPipeConnections((connections) =>
        connections.filter(
          (connection) => connection.fromEquipmentId !== equipmentId && connection.toEquipmentId !== equipmentId,
        ),
      );
    }
  }, []);

  const addEquipmentPart = useCallback((equipmentId, shape = "BOX") => {
    const equipment = equipmentInstances.find((item) => item.id === equipmentId);
    if (!equipment) return null;
    const part = createEquipmentPart((equipment.parts?.length ?? 0) + 1, shape);
    setEquipmentInstances((items) => items.map((item) => item.id === equipmentId
      ? { ...item, parts: [...(item.parts ?? []), part] }
      : item));
    return part.id;
  }, [equipmentInstances]);

  const updateEquipmentPart = useCallback((equipmentId, partId, changes) => {
    setEquipmentInstances((items) => items.map((equipment) => equipment.id === equipmentId
      ? {
          ...equipment,
          parts: (equipment.parts ?? []).map((part) => part.id === partId
            ? normalizeEquipmentPart({
                ...part,
                ...changes,
                dimensions: changes.dimensions
                  ? Object.fromEntries(Object.entries({ ...part.dimensions, ...changes.dimensions }).map(([axis, value]) => [axis, Math.max(0.02, value)]))
                  : part.dimensions,
                position: changes.position ? { ...part.position, ...changes.position } : part.position,
                rotation: changes.rotation ? { ...part.rotation, ...changes.rotation } : part.rotation,
                appearance: changes.appearance ? { ...part.appearance, ...changes.appearance } : part.appearance,
              })
            : part),
        }
      : equipment));
  }, []);

  const duplicateEquipmentPart = useCallback((equipmentId, partId) => {
    let duplicateId = null;
    setEquipmentInstances((items) => items.map((equipment) => {
      if (equipment.id !== equipmentId) return equipment;
      const source = equipment.parts?.find((part) => part.id === partId);
      if (!source) return equipment;
      const duplicate = normalizeEquipmentPart({
        ...source,
        id: undefined,
        name: `${source.name} Copy`,
        position: { ...source.position, x: source.position.x + 0.1 },
      }, equipment.parts.length);
      duplicateId = duplicate.id;
      return { ...equipment, parts: [...equipment.parts, duplicate] };
    }));
    return duplicateId;
  }, []);

  const removeEquipmentPart = useCallback((equipmentId, partId) => {
    setEquipmentInstances((items) => items.map((equipment) => equipment.id === equipmentId
      ? { ...equipment, parts: (equipment.parts ?? []).filter((part) => part.id !== partId) }
      : equipment));
  }, []);

  const commitPipeSnap = useCallback(
    (equipmentId) => {
      if (!pipeSnapCandidate || pipeSnapCandidate.movingPoint.equipmentId !== equipmentId) return false;

      const equipment = equipmentInstances.find((item) => item.id === equipmentId);
      if (!equipment) return false;

      const resolved = resolvePipeSnap(equipment, pipeSnapCandidate);
      setEquipmentInstances((items) =>
        items.map((item) => item.id === equipmentId ? mergeEquipment(item, resolved) : item),
      );
      setPipeConnections((connections) => [
        ...connections.filter(
          (connection) => connection.fromEquipmentId !== equipmentId && connection.toEquipmentId !== equipmentId,
        ),
        {
          id: createId("PIPE_CONNECTION"),
          fromEquipmentId: equipmentId,
          fromPointId: pipeSnapCandidate.movingPoint.id,
          toEquipmentId: pipeSnapCandidate.targetPoint.equipmentId,
          toPointId: pipeSnapCandidate.targetPoint.id,
        },
      ]);
      return true;
    },
    [equipmentInstances, pipeSnapCandidate],
  );

  const removeSelectedEquipment = useCallback(() => {
    if (!selectedEquipmentId) return;

    setEquipmentInstances((items) => items.filter((equipment) => equipment.id !== selectedEquipmentId));
    setPipeConnections((connections) =>
      connections.filter(
        (connection) => connection.fromEquipmentId !== selectedEquipmentId && connection.toEquipmentId !== selectedEquipmentId,
      ),
    );
    setSelectedEquipmentId(null);
  }, [selectedEquipmentId]);

  const duplicateSelectedEquipment = useCallback(() => {
    if (!selectedEquipment) return;

    const duplicateId = createId("WORLD_OBJECT");
    const offset = Math.max(snapSize, 0.5);
    const duplicatedPosition = clampPositionToWorld(
      {
        x: snapValue(selectedEquipment.position.x + offset, snapSize),
        y: selectedEquipment.position.y,
        z: snapValue(selectedEquipment.position.z + offset, snapSize),
      },
      selectedEquipment.dimensions,
      world,
    );

    setEquipmentInstances((items) => [
      ...items,
      {
        ...selectedEquipment,
        id: duplicateId,
        name: `${selectedEquipment.name} COPY`,
        parameters: { ...selectedEquipment.parameters },
        dimensions: { ...selectedEquipment.dimensions },
        position: duplicatedPosition,
        rotation: { ...selectedEquipment.rotation },
        appearance: { ...selectedEquipment.appearance },
        parts: (selectedEquipment.parts ?? []).map((part, index) => normalizeEquipmentPart({
          ...part,
          id: undefined,
          position: { ...part.position },
          rotation: { ...part.rotation },
          dimensions: { ...part.dimensions },
          appearance: { ...part.appearance },
        }, index)),
        detailAssetId: null,
      },
    ]);
    setSelectedEquipmentId(duplicateId);
  }, [selectedEquipment, snapSize, world]);

  const updateWorld = useCallback((changes) => {
    setWorld((currentWorld) => ({
      ...currentWorld,
      ...Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [key, clampDimension(value)]),
      ),
    }));
  }, []);

  const updateSiteEnvironment = useCallback((changes) => {
    const mergedChanges = changes.groundMaterial && !changes.terrain
      ? { ...changes, terrain: { ...siteEnvironment.terrain, material: changes.groundMaterial } }
      : changes;
    const nextSiteEnvironment = normalizeSiteEnvironment({ ...siteEnvironment, ...mergedChanges });
    const sizeChanged = nextSiteEnvironment.width !== siteEnvironment.width
      || nextSiteEnvironment.depth !== siteEnvironment.depth;
    setSiteEnvironment(nextSiteEnvironment);
    if (!sizeChanged) return;

    let movedCount = 0;
    let oversizedCount = 0;
    const nextNodes = hierarchy.nodes.map((node) => {
      if (node.type !== HIERARCHY_NODE_TYPES.BUILDING) return node;
      const result = clampBuildingToSite(node, nextSiteEnvironment);
      if (result.wasClamped) movedCount += 1;
      if (!result.fits) oversizedCount += 1;
      return result.entity;
    });
    const nextSiteObjects = siteObjects.map((object) => {
      const result = clampSiteObjectToSite(object, nextSiteEnvironment);
      if (result.wasClamped) movedCount += 1;
      if (!result.fits) oversizedCount += 1;
      return result.entity;
    });
    setHierarchy((current) => ({ ...current, nodes: nextNodes }));
    setSiteObjects(nextSiteObjects);
    const nextNotice = getSiteBoundaryNotice(movedCount, oversizedCount);
    if (nextNotice) setSiteBoundaryNotice(nextNotice);
    else if (
      nextSiteEnvironment.width >= siteEnvironment.width
      && nextSiteEnvironment.depth >= siteEnvironment.depth
    ) setSiteBoundaryNotice("");
  }, [hierarchy.nodes, siteEnvironment, siteObjects]);

  const updateDetailAsset = useCallback((assetId, changes) => {
    setDetailAssets((assets) =>
      assets.map((asset) => asset.id === assetId
        ? {
            ...asset,
            ...changes,
            calibration: changes.calibration
              ? { ...asset.calibration, ...changes.calibration }
              : asset.calibration,
          }
        : asset),
    );
  }, []);

  const registerDetailAsset = useCallback(
    (equipmentId, file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!SUPPORTED_SCAN_FORMATS.has(extension)) {
        return { ok: false, message: "GLB, GLTF, OBJ, PLY 파일만 지원합니다." };
      }

      const assetId = createId("DETAIL_ASSET");
      const asset = {
        id: assetId,
        equipmentId,
        originalFileName: file.name,
        originalFormat: extension.toUpperCase(),
        fileSize: file.size,
        objectUrl: URL.createObjectURL(file),
        status: "UPLOADING",
        uploadProgress: 10,
        createdAt: new Date().toISOString(),
        calibration: {
          positionX: 0,
          positionY: 0,
          positionZ: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scale: 1,
        },
      };

      setDetailAssets((assets) => {
        const oldAssets = assets.filter((item) => item.equipmentId === equipmentId);
        oldAssets.forEach((item) => item.objectUrl && URL.revokeObjectURL(item.objectUrl));
        return [...assets.filter((item) => item.equipmentId !== equipmentId), asset];
      });
      setEquipmentInstances((items) =>
        items.map((equipment) => equipment.id === equipmentId
          ? { ...equipment, detailAssetId: assetId }
          : equipment),
      );

      const timers = [
        setTimeout(() => updateDetailAsset(assetId, { uploadProgress: 65 }), 250),
        setTimeout(() => updateDetailAsset(assetId, { status: "PROCESSING", uploadProgress: 100 }), 550),
        setTimeout(() => updateDetailAsset(assetId, { status: "READY" }), 900),
      ];
      scanTimersRef.current.set(assetId, timers);
      return { ok: true, assetId };
    },
    [updateDetailAsset],
  );

  const removeDetailAsset = useCallback((equipmentId) => {
    setEquipmentInstances((items) =>
      items.map((equipment) => equipment.id === equipmentId
        ? { ...equipment, detailAssetId: null }
        : equipment),
    );
    setDetailAssets((assets) =>
      assets.filter((asset) => {
        if (asset.equipmentId !== equipmentId) return true;
        if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
        return false;
      }),
    );
  }, []);

  const setGridSnapEnabled = useCallback((enabled) => {
    setGridSettings((current) => ({ ...current, enabled: Boolean(enabled) }));
  }, []);

  const setSnapSize = useCallback((baseSize) => {
    setGridSettings((current) => ({
      ...current,
      baseSize: normalizeGridCellSize(baseSize, current.baseSize),
    }));
  }, []);

  const addGridRegion = useCallback((scopeId) => {
    if (!scopeId) return null;
    const regionId = `GRID_REGION_${crypto.randomUUID()}`;
    setGridSettings((current) => {
      const scopeRegionCount = current.regions.filter((region) => region.scopeId === scopeId).length;
      const region = createGridRegion(scopeId, scopeRegionCount, current.baseSize);
      return { ...current, regions: [...current.regions, { ...region, id: regionId }] };
    });
    return regionId;
  }, []);

  const updateGridRegion = useCallback((regionId, changes) => {
    setGridSettings((current) => ({
      ...current,
      regions: current.regions.map((region, index) => {
        if (region.id !== regionId) return region;
        return normalizeGridRegion({
          ...region,
          ...changes,
          center: changes.center ? { ...region.center, ...changes.center } : region.center,
          size: changes.size ? { ...region.size, ...changes.size } : region.size,
        }, index);
      }).filter(Boolean),
    }));
  }, []);

  const removeGridRegion = useCallback((regionId) => {
    setGridSettings((current) => ({
      ...current,
      regions: current.regions.filter((region) => region.id !== regionId),
    }));
  }, []);

  const applyRoomScene = useCallback((scene, { sanitizeAssets = false } = {}) => {
    if (!scene?.world || !Array.isArray(scene.equipment)) return false;

    const equipment = scene.equipment
      .map((item) => {
        const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[item.shapeTemplateId];
        return template ? normalizeEquipmentInstance(item, template) : null;
      })
      .filter(Boolean);
    setWorld({ ...DEFAULT_WORLD, ...scene.world });
    setEquipmentInstances(equipment);
    setDetailAssets(
      Array.isArray(scene.detailAssets)
        ? scene.detailAssets.map((asset) => sanitizeAssets ? sanitizeHydratedAsset(asset) : asset)
        : [],
    );
    setPipeConnections(Array.isArray(scene.pipeConnections) ? scene.pipeConnections : []);
    hydrateWorldStructures(scene);
    setSelectedEquipmentId(null);
    setActiveTemplateId(null);
    return true;
  }, [hydrateWorldStructures]);

  const updateHistoryAvailability = useCallback(() => {
    setHistoryAvailability({
      canUndo: historyPastRef.current.length > 0,
      canRedo: historyFutureRef.current.length > 0,
    });
  }, []);

  const clearHistory = useCallback(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
    historyPendingRef.current = null;
    historyPastRef.current = [];
    historyFutureRef.current = [];
    historyCurrentRef.current = null;
    restoringHistoryRef.current = false;
    setHistoryAvailability({ canUndo: false, canRedo: false });
  }, []);

  const resetLayout = useCallback(() => {
    clearHistory();
    setDetailAssets((assets) => {
      assets.forEach((asset) => asset.objectUrl && URL.revokeObjectURL(asset.objectUrl));
      return [];
    });
    setHierarchy(createDefaultHierarchy());
    setRoomScenes({});
    setSiteEnvironment(DEFAULT_SITE_ENVIRONMENT);
    setSiteBoundaryNotice("");
    setSiteObjects([]);
    setSelectedSiteObjectId(null);
    setWorld(DEFAULT_WORLD);
    setEquipmentInstances([]);
    setPipeConnections([]);
    setSelectedEquipmentId(null);
    setActiveTemplateId(null);
    setViewMode(VIEW_MODES.VIEW_3D);
    setTransformMode(TRANSFORM_MODES.TRANSLATE);
    setTransformTools(DEFAULT_TRANSFORM_TOOLS);
    setGridSettings(createDefaultGridSettings());
    setNavigationContext(createInitialNavigationContext());
    resetWorldStructures();
    floorPlanEditor.actions.resetFloorPlanState();
    floorEquipmentEditor.actions.resetFloorEquipmentState();
    monitoringEditor.actions.resetMonitoringState();
  }, [clearHistory, floorEquipmentEditor.actions, floorPlanEditor.actions, monitoringEditor.actions, resetWorldStructures]);

  const hydrateLayout = useCallback((layout) => {
    const nextSiteEnvironment = resolveSiteEnvironmentFromLayout(layout);
    const normalizedHierarchy = normalizeHierarchy(layout?.hierarchy);
    const nextHierarchy = {
      ...normalizedHierarchy,
      nodes: normalizedHierarchy.nodes.map((node) => (
        node.type === HIERARCHY_NODE_TYPES.BUILDING
          ? clampBuildingToSite(node, nextSiteEnvironment).entity
          : node
      )),
    };
    const isHierarchyLayout = Number(layout?.version ?? 0) >= 5 && layout?.roomScenes;
    const activeRoomId = nextHierarchy.activeRoomId;
    const nextRoomScenes = isHierarchyLayout
      ? layout.roomScenes
      : activeRoomId
        ? { [activeRoomId]: layout }
        : {};
    const activeScene = activeRoomId ? nextRoomScenes[activeRoomId] : null;

    if (activeRoomId && (!activeScene || !applyRoomScene(activeScene, { sanitizeAssets: true }))) {
      return false;
    }
    if (!activeRoomId) applyRoomScene(createDefaultRoomScene());

    clearHistory();
    setHierarchy(nextHierarchy);
    setRoomScenes(nextRoomScenes);
    setSiteEnvironment(nextSiteEnvironment);
    setSiteBoundaryNotice("");
    setSiteObjects(
      (Array.isArray(layout?.siteObjects) ? layout.siteObjects : [])
        .map(normalizeSiteObject)
        .filter(Boolean)
        .map((object) => clampSiteObjectToSite(object, nextSiteEnvironment).entity),
    );
    setSelectedSiteObjectId(null);
    setGridSettings(normalizeGridSettings(layout.gridSettings));
    floorPlanEditor.actions.hydrateFloorPlanState(layout);
    floorEquipmentEditor.actions.hydrateFloorEquipmentState(layout);
    monitoringEditor.actions.hydrateMonitoringState(layout);
    setNavigationContext(createInitialNavigationContext());
    return true;
  }, [applyRoomScene, clearHistory, floorEquipmentEditor.actions, floorPlanEditor.actions, monitoringEditor.actions]);

  const selectRoom = useCallback((roomId) => {
    const targetRoom = hierarchy.nodes.find(
      (node) => node.id === roomId && node.type === HIERARCHY_NODE_TYPES.ROOM,
    );
    if (!targetRoom) return;
    if (roomId === hierarchy.activeRoomId) {
      setHierarchy((current) => ({ ...current, selectedNodeId: roomId }));
      return;
    }

    const targetScene = roomScenes[roomId] ?? createDefaultRoomScene();
    setRoomScenes((scenes) => ({
      ...scenes,
      ...(hierarchy.activeRoomId ? { [hierarchy.activeRoomId]: currentRoomScene } : {}),
    }));
    setHierarchy((current) => ({ ...current, activeRoomId: roomId, selectedNodeId: roomId }));
    setSelectedSiteObjectId(null);
    applyRoomScene(targetScene);
  }, [applyRoomScene, currentRoomScene, hierarchy.activeRoomId, hierarchy.nodes, roomScenes]);

  const selectHierarchyNode = useCallback((nodeId) => {
    const node = hierarchy.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    setSelectedSiteObjectId(null);
    setHierarchy((current) => ({ ...current, selectedNodeId: nodeId }));
  }, [hierarchy.nodes]);

  const addRoomToFloor = useCallback((floorId, { enter = false } = {}) => {
    const floor = hierarchy.nodes.find(
      (node) => node.id === floorId && node.type === HIERARCHY_NODE_TYPES.FLOOR,
    );
    if (!floor) return null;
    const siblingCount = hierarchy.nodes.filter(
      (node) => node.parentId === floorId && node.type === HIERARCHY_NODE_TYPES.ROOM,
    ).length;
    const room = createHierarchyNode(HIERARCHY_NODE_TYPES.ROOM, floorId, siblingCount);
    const emptyScene = createDefaultRoomScene();
    setRoomScenes((scenes) => ({
      ...scenes,
      ...(enter && hierarchy.activeRoomId ? { [hierarchy.activeRoomId]: currentRoomScene } : {}),
      [room.id]: emptyScene,
    }));
    setHierarchy((current) => ({
      ...current,
      activeRoomId: enter ? room.id : current.activeRoomId,
      selectedNodeId: enter ? room.id : floorId,
      nodes: [...current.nodes, room],
    }));
    if (enter) applyRoomScene(emptyScene);
    return room.id;
  }, [applyRoomScene, currentRoomScene, hierarchy.activeRoomId, hierarchy.nodes]);

  const addHierarchyChild = useCallback((parentId) => {
    const parent = hierarchy.nodes.find((node) => node.id === parentId);
    const childType = parent ? HIERARCHY_CHILD_TYPES[parent.type] : null;
    if (!childType) return;

    const siblingCount = hierarchy.nodes.filter(
      (node) => node.parentId === parentId && node.type === childType,
    ).length;
    const child = createHierarchyNode(childType, parentId, siblingCount);
    if (childType === HIERARCHY_NODE_TYPES.BUILDING) {
      child.position = {
        ...child.position,
        x: (siblingCount % 3) * 52,
        z: Math.floor(siblingCount / 3) * 38,
      };
    }

    if (childType === HIERARCHY_NODE_TYPES.BUILDING) {
      const buildingFloors = createBuildingFloors(child);
      setHierarchy((current) => ({
        ...current,
        selectedNodeId: child.id,
        nodes: [...current.nodes, child, ...buildingFloors],
      }));
      setSelectedSiteObjectId(null);
      return;
    }

    if (childType === HIERARCHY_NODE_TYPES.FLOOR) {
      const floorHeight = Math.max(2, parent.parameters?.floorHeight ?? 4);
      child.level = siblingCount + 1;
      child.elevation = siblingCount * floorHeight;
      setHierarchy((current) => ({
        ...current,
        selectedNodeId: child.id,
        nodes: [
          ...current.nodes.map((node) => node.id === parentId
            ? {
                ...node,
                parameters: { ...node.parameters, floorCount: siblingCount + 1 },
              }
            : node),
          child,
        ],
      }));
      setSelectedSiteObjectId(null);
      return;
    }

    if (childType === HIERARCHY_NODE_TYPES.ROOM) {
      addRoomToFloor(parentId);
      return;
    }

    setHierarchy((current) => ({
      ...current,
      selectedNodeId: child.id,
      nodes: [...current.nodes, child],
    }));
  }, [addRoomToFloor, hierarchy.nodes]);

  const addRoom = useCallback(() => {
    const floorId = selectedHierarchyNode?.type === HIERARCHY_NODE_TYPES.FLOOR
      ? selectedHierarchyNode.id
      : activeRoom?.parentId;
    if (floorId) addRoomToFloor(floorId, { enter: true });
  }, [activeRoom?.parentId, addRoomToFloor, selectedHierarchyNode]);

  const selectBuilding = useCallback((buildingId) => {
    selectHierarchyNode(buildingId ?? hierarchy.rootId);
  }, [hierarchy.rootId, selectHierarchyNode]);

  const navigateToSite = useCallback(() => {
    setHierarchy((current) => ({ ...current, selectedNodeId: current.rootId }));
    setSelectedSiteObjectId(null);
    setNavigationContext((current) => ({
      ...createInitialNavigationContext(),
      transitionDirection: "OUT",
      transitionId: current.transitionId + 1,
    }));
  }, []);

  const navigateToBuilding = useCallback((buildingId) => {
    const building = hierarchy.nodes.find(
      (node) => node.id === buildingId && node.type === HIERARCHY_NODE_TYPES.BUILDING,
    );
    if (!building) return;
    const buildingFloors = hierarchy.nodes
      .filter((node) => node.type === HIERARCHY_NODE_TYPES.FLOOR && node.parentId === buildingId)
      .sort((left, right) => (left.level ?? 0) - (right.level ?? 0));
    const currentFloorId = navigationContext.currentBuildingId === buildingId
      && buildingFloors.some((floor) => floor.id === navigationContext.currentFloorId)
      ? navigationContext.currentFloorId
      : buildingFloors[0]?.id ?? null;

    setHierarchy((current) => ({ ...current, selectedNodeId: buildingId }));
    setSelectedSiteObjectId(null);
    setNavigationContext((current) => ({
      ...current,
      currentDepth: EDITOR_DEPTHS.BUILDING,
      currentBuildingId: buildingId,
      currentFloorId,
      currentRoomId: null,
      currentEquipmentId: null,
      isEditing: true,
      transitionDirection: "IN",
      transitionId: current.transitionId + 1,
    }));
  }, [hierarchy.nodes, navigationContext.currentBuildingId, navigationContext.currentFloorId]);

  const selectFloorInBuilding = useCallback((floorId) => {
    const floor = hierarchy.nodes.find(
      (node) => node.id === floorId && node.type === HIERARCHY_NODE_TYPES.FLOOR,
    );
    if (!floor) return;
    setHierarchy((current) => ({ ...current, selectedNodeId: floorId }));
    setNavigationContext((current) => ({
      ...current,
      currentDepth: EDITOR_DEPTHS.BUILDING,
      currentBuildingId: floor.parentId,
      currentFloorId: floorId,
      currentRoomId: null,
      currentEquipmentId: null,
      transitionDirection: "IN",
      transitionId: current.transitionId + 1,
    }));
  }, [hierarchy.nodes]);

  const navigateToFloor = useCallback((floorId) => {
    const floor = hierarchy.nodes.find(
      (node) => node.id === floorId && node.type === HIERARCHY_NODE_TYPES.FLOOR,
    );
    if (!floor) return;
    setHierarchy((current) => ({ ...current, selectedNodeId: floorId }));
    setSelectedSiteObjectId(null);
    setNavigationContext((current) => ({
      ...current,
      currentDepth: EDITOR_DEPTHS.FLOOR,
      currentBuildingId: floor.parentId,
      currentFloorId: floorId,
      currentRoomId: null,
      currentEquipmentId: null,
      transitionDirection: "IN",
      transitionId: current.transitionId + 1,
    }));
  }, [hierarchy.nodes]);

  const navigateToRoom = useCallback((roomId) => {
    const room = hierarchy.nodes.find(
      (node) => node.id === roomId && node.type === HIERARCHY_NODE_TYPES.ROOM,
    );
    if (!room) return;
    const floor = findHierarchyAncestor(hierarchy.nodes, roomId, HIERARCHY_NODE_TYPES.FLOOR);
    const building = findHierarchyAncestor(hierarchy.nodes, roomId, HIERARCHY_NODE_TYPES.BUILDING);
    selectRoom(roomId);
    setNavigationContext((current) => ({
      ...current,
      currentDepth: EDITOR_DEPTHS.ROOM,
      currentBuildingId: building?.id ?? null,
      currentFloorId: floor?.id ?? null,
      currentRoomId: roomId,
      currentEquipmentId: null,
      transitionDirection: "IN",
      transitionId: current.transitionId + 1,
    }));
  }, [hierarchy.nodes, selectRoom]);

  const enterBuilding = navigateToBuilding;

  const renameHierarchyNode = useCallback((nodeId, name) => {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    setHierarchy((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, name: normalizedName } : node),
    }));
  }, []);

  const updateHierarchyNode = useCallback((nodeId, changes) => {
    setHierarchy((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (node.id !== nodeId) return node;

        const parameters = changes.parameters
          ? Object.fromEntries(Object.entries({ ...node.parameters, ...changes.parameters }).map(([key, value]) => {
              if (typeof value !== "number") return [key, value];
              if (key === "floorHeight") return [key, Math.max(2, value)];
              if (key === "width" || key === "depth") return [key, Math.max(5, value)];
              return [key, value];
            }))
          : node.parameters;

        return {
          ...node,
          ...changes,
          parameters,
          position: changes.position ? { ...node.position, ...changes.position } : node.position,
          rotation: changes.rotation ? { ...node.rotation, ...changes.rotation } : node.rotation,
          appearance: changes.appearance ? { ...node.appearance, ...changes.appearance } : node.appearance,
        };
      }),
    }));
  }, []);

  const addBuildingFromArea = useCallback((area, templateId = "BUILDING", variantOverrides = {}) => {
    const siblingCount = hierarchy.nodes.filter(
      (node) => node.parentId === hierarchy.rootId && node.type === HIERARCHY_NODE_TYPES.BUILDING,
    ).length;
    const created = createBuildingDefinitionFromArea({
      rootId: hierarchy.rootId,
      siblingIndex: siblingCount,
      area,
      templateId,
      variantOverrides,
    });
    if (!created) return null;
    created.building = clampBuildingToSite(created.building, siteEnvironment).entity;
    setHierarchy((current) => ({
      ...current,
      selectedNodeId: created.building.id,
      nodes: [...current.nodes, created.building, ...created.floors],
    }));
    setSelectedSiteObjectId(null);
    return created.building.id;
  }, [hierarchy.nodes, hierarchy.rootId, siteEnvironment]);

  const updateBuilding = useCallback((buildingId, changes) => {
    const building = hierarchy.nodes.find(
      (node) => node.id === buildingId && node.type === HIERARCHY_NODE_TYPES.BUILDING,
    );
    if (!building) return;
    const clampResult = clampBuildingToSite(mergeBuildingDefinition(building, changes), siteEnvironment);
    const nextBuilding = clampResult.entity;
    if (nextBuilding.customAssetId && changes.parameters) {
      const customAsset = getRuntimeCustomAsset(nextBuilding.customAssetId) ?? nextBuilding.customAssetSnapshot;
      nextBuilding.customAssetScale = {
        x: Object.hasOwn(changes.parameters, "width")
          ? nextBuilding.parameters.width / Math.max(0.01, customAsset?.bounds?.width ?? nextBuilding.parameters.width)
          : nextBuilding.customAssetScale?.x ?? 1,
        y: nextBuilding.customAssetScale?.y ?? 1,
        z: Object.hasOwn(changes.parameters, "depth")
          ? nextBuilding.parameters.depth / Math.max(0.01, customAsset?.bounds?.depth ?? nextBuilding.parameters.depth)
          : nextBuilding.customAssetScale?.z ?? 1,
      };
    }
    if (clampResult.wasClamped || !clampResult.fits) {
      setSiteBoundaryNotice(getSiteBoundaryNotice(clampResult.wasClamped ? 1 : 0, clampResult.fits ? 0 : 1));
    }
    const shouldSyncFloors = Boolean(changes.parameters)
      && (Object.hasOwn(changes.parameters, "floorCount") || Object.hasOwn(changes.parameters, "floorHeight"));

    if (!shouldSyncFloors) {
      setHierarchy((current) => ({
        ...current,
        nodes: current.nodes.map((node) => node.id === buildingId ? nextBuilding : node),
      }));
      return;
    }

    const existingFloors = hierarchy.nodes
      .filter((node) => node.type === HIERARCHY_NODE_TYPES.FLOOR && node.parentId === buildingId)
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    const nextFloors = createBuildingFloors(nextBuilding, existingFloors);
    const retainedFloorIds = new Set(nextFloors.map((floor) => floor.id));
    const removedFloorIds = existingFloors
      .filter((floor) => !retainedFloorIds.has(floor.id))
      .map((floor) => floor.id);
    const removedNodeIds = new Set(
      removedFloorIds.flatMap((floorId) => [...getHierarchyDescendantIds(hierarchy.nodes, floorId)]),
    );
    const removedRoomIds = hierarchy.nodes
      .filter((node) => removedNodeIds.has(node.id) && node.type === HIERARCHY_NODE_TYPES.ROOM)
      .map((node) => node.id);
    const nextFloorMap = new Map(nextFloors.map((floor) => [floor.id, floor]));
    const remainingNodes = hierarchy.nodes
      .filter((node) => !removedNodeIds.has(node.id))
      .map((node) => {
        if (node.id === buildingId) return nextBuilding;
        return nextFloorMap.get(node.id) ?? node;
      });
    const newFloors = nextFloors.filter((floor) => !existingFloors.some((item) => item.id === floor.id));
    const nextNodes = [...remainingNodes, ...newFloors];
    const activeRoomRemoved = removedNodeIds.has(hierarchy.activeRoomId);
    const nextActiveRoomId = activeRoomRemoved
      ? nextNodes.find((node) => node.type === HIERARCHY_NODE_TYPES.ROOM)?.id ?? null
      : hierarchy.activeRoomId;

    setRoomScenes((scenes) => Object.fromEntries(
      Object.entries({
        ...scenes,
        ...(hierarchy.activeRoomId ? { [hierarchy.activeRoomId]: currentRoomScene } : {}),
      }).filter(([roomId]) => !removedRoomIds.includes(roomId)),
    ));
    setHierarchy((current) => ({
      ...current,
      activeRoomId: nextActiveRoomId,
      selectedNodeId: removedNodeIds.has(current.selectedNodeId) ? buildingId : current.selectedNodeId,
      nodes: nextNodes,
    }));
    if (activeRoomRemoved) {
      applyRoomScene(nextActiveRoomId ? roomScenes[nextActiveRoomId] ?? createDefaultRoomScene() : createDefaultRoomScene());
    }
  }, [applyRoomScene, currentRoomScene, hierarchy, roomScenes, siteEnvironment]);

  const addSiteObjectFromArea = useCallback((templateId, area, variantOverrides = {}) => {
    const definition = OBJECT_LIBRARY_DEFINITION_MAP[templateId];
    if (definition?.createsBuilding) return addBuildingFromArea(area, templateId, variantOverrides);
    const sequence = siteObjects.filter((object) => object.type === templateId).length + 1;
    const createdObject = createSiteObjectFromArea(templateId, area, sequence, variantOverrides);
    const object = createdObject ? clampSiteObjectToSite(createdObject, siteEnvironment).entity : null;
    if (!object) return null;
    setSiteObjects((items) => [...items, object]);
    setSelectedSiteObjectId(object.id);
    setHierarchy((current) => ({ ...current, selectedNodeId: current.rootId }));
    return object.id;
  }, [addBuildingFromArea, siteEnvironment, siteObjects]);

  const addSiteObjectsFromArea = useCallback((templateId, area, variantOverrides = {}, placementOptions = {}) => {
    const definition = OBJECT_LIBRARY_DEFINITION_MAP[templateId];
    if (!definition) return { canPlace: false, count: 0, ids: [], message: "알 수 없는 오브젝트입니다." };
    const boundedArea = intersectAreaWithSite(area, siteEnvironment);
    if (!boundedArea) return { canPlace: false, count: 0, ids: [], message: "선택 영역이 부지 경계 밖에 있습니다." };
    const plan = placeObjectsInArea({
      area: boundedArea,
      object: definition,
      scale: placementOptions.scale,
      rotationY: placementOptions.rotationY,
      padding: placementOptions.padding,
      gridEnabled: gridSettings.enabled,
      cellSize: boundedArea.cellSize ?? gridSettings.baseSize,
    });
    if (!plan.canPlace) return { ...plan, ids: [] };

    if (definition.createsBuilding) {
      const siblingCount = hierarchy.nodes.filter(
        (node) => node.parentId === hierarchy.rootId && node.type === HIERARCHY_NODE_TYPES.BUILDING,
      ).length;
      const createdItems = plan.positions.map((position, index) => {
        const created = createBuildingDefinitionFromArea({
          rootId: hierarchy.rootId,
          siblingIndex: siblingCount + index,
          area: {
            center: { x: position.x, z: position.z },
            width: definition.width,
            depth: definition.depth,
            cellSize: plan.cellSize,
          },
          templateId,
          variantOverrides,
          placementOptions: {
            ...placementOptions,
            scale: plan.footprint.scale,
            rotationY: plan.footprint.rotationY,
          },
        });
        if (!created) return null;
        return { ...created, building: clampBuildingToSite(created.building, siteEnvironment).entity };
      }).filter(Boolean);
      const ids = createdItems.map(({ building }) => building.id);
      const nodes = createdItems.flatMap(({ building, floors }) => [building, ...floors]);
      setHierarchy((current) => ({
        ...current,
        selectedNodeId: ids.at(-1) ?? current.selectedNodeId,
        nodes: [...current.nodes, ...nodes],
      }));
      setSelectedSiteObjectId(null);
      return { ...plan, ids };
    }

    const sequence = siteObjects.filter((object) => object.type === templateId).length;
    const createdObjects = plan.positions.map((position, index) => {
      const object = createSiteObjectFromArea(templateId, {
        center: { x: position.x, z: position.z },
        width: definition.width,
        depth: definition.depth,
        cellSize: plan.cellSize,
      }, sequence + index + 1, variantOverrides);
      if (!object) return null;
      const normalizedObject = normalizeSiteObject({
        ...object,
        rotation: { ...object.rotation, y: plan.footprint.rotationY },
        dimensions: {
          width: object.dimensions.width * plan.footprint.scale.x,
          height: object.dimensions.height * plan.footprint.scale.y,
          depth: object.dimensions.depth * plan.footprint.scale.z,
        },
        path: object.path ? {
          ...object.path,
          width: object.path.width * Math.min(plan.footprint.scale.x, plan.footprint.scale.z),
          points: object.path.points.map((point) => ({
            ...point,
            x: point.x * plan.footprint.scale.x,
            z: point.z * plan.footprint.scale.z,
          })),
        } : object.path,
      });
      return normalizedObject ? clampSiteObjectToSite(normalizedObject, siteEnvironment).entity : null;
    }).filter(Boolean);
    const ids = createdObjects.map((object) => object.id);
    setSiteObjects((items) => [...items, ...createdObjects]);
    setSelectedSiteObjectId(ids.at(-1) ?? null);
    setHierarchy((current) => ({ ...current, selectedNodeId: current.rootId }));
    return { ...plan, ids };
  }, [gridSettings.baseSize, gridSettings.enabled, hierarchy.nodes, hierarchy.rootId, siteEnvironment, siteObjects]);

  const selectSiteObject = useCallback((objectId) => {
    const exists = siteObjects.some((object) => object.id === objectId);
    setSelectedSiteObjectId(exists ? objectId : null);
    if (exists) setHierarchy((current) => ({ ...current, selectedNodeId: current.rootId }));
  }, [siteObjects]);

  const updateSiteObject = useCallback((objectId, changes) => {
    const object = siteObjects.find((item) => item.id === objectId);
    if (!object || object.locked) return;
    const normalizedObject = normalizeSiteObject({
        ...object,
        ...changes,
        position: changes.position ? { ...object.position, ...changes.position } : object.position,
        rotation: changes.rotation ? { ...object.rotation, ...changes.rotation } : object.rotation,
        dimensions: changes.dimensions ? { ...object.dimensions, ...changes.dimensions } : object.dimensions,
        appearance: changes.appearance ? { ...object.appearance, ...changes.appearance } : object.appearance,
        variants: changes.variants ? { ...object.variants, ...changes.variants } : object.variants,
        parameters: changes.parameters ? { ...object.parameters, ...changes.parameters } : object.parameters,
        path: changes.path ? { ...object.path, ...changes.path } : object.path,
    });
    if (!normalizedObject) return;
    const result = clampSiteObjectToSite(normalizedObject, siteEnvironment);
    if (result.wasClamped || !result.fits) {
      setSiteBoundaryNotice(getSiteBoundaryNotice(result.wasClamped ? 1 : 0, result.fits ? 0 : 1));
    }
    setSiteObjects((items) => items.map((item) => item.id === objectId ? result.entity : item));
  }, [siteEnvironment, siteObjects]);

  const removeSelectedSiteObject = useCallback(() => {
    if (!selectedSiteObjectId) return;
    setSiteObjects((items) => items.filter((object) => object.id !== selectedSiteObjectId));
    setSelectedSiteObjectId(null);
  }, [selectedSiteObjectId]);

  const duplicateSelectedSiteEntity = useCallback(() => {
    const selectedSiteObject = siteObjects.find((object) => object.id === selectedSiteObjectId);
    if (selectedSiteObject) {
      const normalizedDuplicate = normalizeSiteObject({
        ...structuredClone(selectedSiteObject),
        id: `SITE_OBJECT_${crypto.randomUUID()}`,
        name: `${selectedSiteObject.name} 복사본`,
        position: {
          ...selectedSiteObject.position,
          x: selectedSiteObject.position.x + Math.max(1, gridSettings.baseSize),
          z: selectedSiteObject.position.z + Math.max(1, gridSettings.baseSize),
        },
      });
      const duplicate = clampSiteObjectToSite(normalizedDuplicate, siteEnvironment).entity;
      setSiteObjects((items) => [...items, duplicate]);
      setSelectedSiteObjectId(duplicate.id);
      return duplicate.id;
    }

    if (!selectedBuilding) return null;
    const sourceIds = getHierarchyDescendantIds(hierarchy.nodes, selectedBuilding.id);
    const idMap = new Map([...sourceIds].map((sourceId) => {
      const node = hierarchy.nodes.find((item) => item.id === sourceId);
      return [sourceId, `${node?.type ?? "NODE"}_${crypto.randomUUID()}`];
    }));
    const clonedNodes = hierarchy.nodes
      .filter((node) => sourceIds.has(node.id))
      .map((node) => {
        const clone = structuredClone(node);
        clone.id = idMap.get(node.id);
        clone.parentId = idMap.get(node.parentId) ?? node.parentId;
        if (node.id === selectedBuilding.id) {
          clone.name = `${node.name} 복사본`;
          const duplicatedPosition = {
            ...node.position,
            x: node.position.x + Math.max(2, gridSettings.baseSize * 2),
            z: node.position.z + Math.max(2, gridSettings.baseSize * 2),
          };
          clone.position = clampObjectPositionToSite(
            duplicatedPosition,
            { width: clone.parameters.width, depth: clone.parameters.depth },
            clone.rotation?.y,
            siteEnvironment,
          ).position;
        }
        return clone;
      });
    const duplicateBuildingId = idMap.get(selectedBuilding.id);
    setHierarchy((current) => ({
      ...current,
      selectedNodeId: duplicateBuildingId,
      nodes: [...current.nodes, ...clonedNodes],
    }));
    setRoomScenes((current) => {
      const next = { ...current };
      hierarchy.nodes
        .filter((node) => sourceIds.has(node.id) && node.type === HIERARCHY_NODE_TYPES.ROOM)
        .forEach((room) => {
          const scene = room.id === hierarchy.activeRoomId ? currentRoomScene : current[room.id];
          if (scene) next[idMap.get(room.id)] = structuredClone(scene);
        });
      return next;
    });
    setSelectedSiteObjectId(null);
    return duplicateBuildingId;
  }, [currentRoomScene, gridSettings.baseSize, hierarchy.activeRoomId, hierarchy.nodes, selectedBuilding, selectedSiteObjectId, siteEnvironment, siteObjects]);

  const updateRoomLayout = useCallback((roomId, changes) => {
    const { world: worldChanges, ...nodeChanges } = changes;
    if (Object.keys(nodeChanges).length) updateHierarchyNode(roomId, nodeChanges);
    if (!worldChanges) return;

    const normalizedWorldChanges = Object.fromEntries(
      Object.entries(worldChanges).map(([key, value]) => [
        key,
        key === "wallHeight" ? Math.max(1, value) : Math.max(3, value),
      ]),
    );
    if (roomId === hierarchy.activeRoomId) {
      setWorld((current) => ({ ...current, ...normalizedWorldChanges }));
    }
    setRoomScenes((scenes) => {
      const baseScene = roomId === hierarchy.activeRoomId
        ? currentRoomScene
        : scenes[roomId] ?? createDefaultRoomScene();
      return {
        ...scenes,
        [roomId]: {
          ...baseScene,
          world: { ...baseScene.world, ...normalizedWorldChanges },
        },
      };
    });
  }, [currentRoomScene, hierarchy.activeRoomId, updateHierarchyNode]);

  const deleteHierarchyNode = useCallback((nodeId) => {
    if (protectedHierarchyNodeIds.has(nodeId) || nodeId === hierarchy.rootId) return;
    const targetNode = hierarchy.nodes.find((node) => node.id === nodeId);
    const siblingFloors = targetNode?.type === HIERARCHY_NODE_TYPES.FLOOR
      ? hierarchy.nodes.filter((node) => node.type === HIERARCHY_NODE_TYPES.FLOOR && node.parentId === targetNode.parentId)
      : [];
    if (targetNode?.type === HIERARCHY_NODE_TYPES.FLOOR && siblingFloors.length <= 1) return;
    const descendantIds = getHierarchyDescendantIds(hierarchy.nodes, nodeId);
    const deletedRoomIds = hierarchy.nodes
      .filter((node) => descendantIds.has(node.id) && node.type === HIERARCHY_NODE_TYPES.ROOM)
      .map((node) => node.id);

    deletedRoomIds.forEach((roomId) => {
      (roomScenes[roomId]?.detailAssets ?? []).forEach((asset) => {
        if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
      });
    });
    setRoomScenes((scenes) => Object.fromEntries(
      Object.entries(scenes).filter(([roomId]) => !deletedRoomIds.includes(roomId)),
    ));
    setHierarchy((current) => {
      let nextNodes = current.nodes.filter((node) => !descendantIds.has(node.id));
      if (targetNode?.type === HIERARCHY_NODE_TYPES.FLOOR) {
        const parent = nextNodes.find((node) => node.id === targetNode.parentId);
        const floorHeight = Math.max(2, parent?.parameters?.floorHeight ?? 4);
        const remainingFloors = nextNodes
          .filter((node) => node.type === HIERARCHY_NODE_TYPES.FLOOR && node.parentId === targetNode.parentId)
          .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
        const floorIndexes = new Map(remainingFloors.map((floor, index) => [floor.id, index]));
        nextNodes = nextNodes.map((node) => {
          if (node.id === targetNode.parentId) {
            return { ...node, parameters: { ...node.parameters, floorCount: remainingFloors.length } };
          }
          const index = floorIndexes.get(node.id);
          return index === undefined ? node : { ...node, level: index + 1, elevation: index * floorHeight };
        });
      }
      return {
        ...current,
        selectedNodeId: descendantIds.has(current.selectedNodeId)
          ? current.activeRoomId ?? targetNode?.parentId ?? current.rootId
          : current.selectedNodeId,
        nodes: nextNodes,
      };
    });
  }, [hierarchy.nodes, hierarchy.rootId, protectedHierarchyNodeIds, roomScenes]);

  const selectTemplate = useCallback(
    (templateId) => {
      setActiveTemplateId((currentId) => currentId === templateId ? null : templateId);
      setSelectedEquipmentId(null);
      if (templateId) rememberTemplate(templateId);
    },
    [rememberTemplate],
  );
  const toggleFavorite = useCallback((templateId) => {
    setFavoriteTemplateIds((ids) =>
      ids.includes(templateId) ? ids.filter((id) => id !== templateId) : [...ids, templateId],
    );
  }, []);
  const setEditorMode = useCallback((mode) => {
    setStructureEditorMode(mode);
    setSelectedEquipmentId(null);
    setActiveTemplateId(null);
    selectWorldStructureState(null);
    selectWorldTemplate(null);
  }, [selectWorldStructureState, selectWorldTemplate, setStructureEditorMode]);
  const selectEquipment = useCallback((equipmentId) => {
    setSelectedEquipmentId(equipmentId);
    selectWorldStructureState(null);
  }, [selectWorldStructureState]);
  const navigateToEquipment = useCallback((equipmentId) => {
    if (!equipmentInstances.some((equipment) => equipment.id === equipmentId)) return;
    selectEquipment(equipmentId);
    setNavigationContext((current) => ({
      ...current,
      currentDepth: EDITOR_DEPTHS.EQUIPMENT,
      currentEquipmentId: equipmentId,
      transitionDirection: "IN",
      transitionId: current.transitionId + 1,
    }));
  }, [equipmentInstances, selectEquipment]);
  const navigateToNode = useCallback((nodeId) => {
    const node = hierarchy.nodes.find((item) => item.id === nodeId);
    if (!node) {
      navigateToEquipment(nodeId);
      return;
    }
    if (node.type === HIERARCHY_NODE_TYPES.SITE) navigateToSite();
    if (node.type === HIERARCHY_NODE_TYPES.BUILDING) navigateToBuilding(nodeId);
    if (node.type === HIERARCHY_NODE_TYPES.FLOOR) navigateToFloor(nodeId);
    if (node.type === HIERARCHY_NODE_TYPES.ROOM) navigateToRoom(nodeId);
  }, [hierarchy.nodes, navigateToBuilding, navigateToEquipment, navigateToFloor, navigateToRoom, navigateToSite]);
  const selectWorldStructure = useCallback((structureId) => {
    selectWorldStructureState(structureId);
    setSelectedEquipmentId(null);
  }, [selectWorldStructureState]);
  const clearSelection = useCallback(() => {
    setSelectedEquipmentId(null);
    setActiveTemplateId(null);
    selectWorldStructureState(null);
    selectWorldTemplate(null);
    setSelectedSiteObjectId(null);
  }, [selectWorldStructureState, selectWorldTemplate]);
  const layoutDocument = useMemo(() => ({
    hierarchy,
    gridSettings,
    siteEnvironment,
    siteObjects,
    roomScenes: hierarchy.activeRoomId
      ? { ...roomScenes, [hierarchy.activeRoomId]: currentRoomScene }
      : roomScenes,
    floorPlansById: floorPlanEditor.floorPlansById,
    verticalStructuresByBuildingId: floorPlanEditor.verticalStructuresByBuildingId,
    equipmentByFloorId: floorEquipmentEditor.equipmentByFloorId,
    equipmentAssetBindings: monitoringEditor.equipmentAssetBindings,
    sensorBindings: monitoringEditor.sensorBindings,
    observationPoints: monitoringEditor.observationPoints,
    serverBindings: monitoringEditor.serverBindings,
  }), [currentRoomScene, floorEquipmentEditor.equipmentByFloorId, floorPlanEditor.floorPlansById, floorPlanEditor.verticalStructuresByBuildingId, gridSettings, hierarchy, monitoringEditor.equipmentAssetBindings, monitoringEditor.observationPoints, monitoringEditor.sensorBindings, monitoringEditor.serverBindings, roomScenes, siteEnvironment, siteObjects]);

  const commitHistorySnapshot = useCallback((snapshot) => {
    const currentSnapshot = historyCurrentRef.current;
    if (!currentSnapshot) {
      historyCurrentRef.current = snapshot;
      return;
    }
    if (getHistorySignature(currentSnapshot) === getHistorySignature(snapshot)) return;

    historyPastRef.current = [...historyPastRef.current, currentSnapshot].slice(-HISTORY_LIMIT);
    historyFutureRef.current = [];
    historyCurrentRef.current = snapshot;
    updateHistoryAvailability();
  }, [updateHistoryAvailability]);

  const flushPendingHistory = useCallback(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
    const pendingSnapshot = historyPendingRef.current;
    historyPendingRef.current = null;
    if (pendingSnapshot) commitHistorySnapshot(pendingSnapshot);
  }, [commitHistorySnapshot]);

  const restoreHistorySnapshot = useCallback((snapshot) => {
    const nextSiteEnvironment = normalizeSiteEnvironment(snapshot.siteEnvironment);
    const nodeIds = new Set(snapshot.hierarchy.nodes.map((node) => node.id));
    const roomIds = new Set(
      snapshot.hierarchy.nodes
        .filter((node) => node.type === HIERARCHY_NODE_TYPES.ROOM)
        .map((node) => node.id),
    );
    const activeRoomId = roomIds.has(hierarchy.activeRoomId)
      ? hierarchy.activeRoomId
      : roomIds.has(navigationContext.currentRoomId)
        ? navigationContext.currentRoomId
        : roomIds.values().next().value ?? null;
    const selectedNodeId = nodeIds.has(hierarchy.selectedNodeId)
      ? hierarchy.selectedNodeId
      : nodeIds.has(navigationNodeId)
        ? navigationNodeId
        : snapshot.hierarchy.rootId;
    const normalizedHierarchy = normalizeHierarchy({
      ...snapshot.hierarchy,
      activeRoomId,
      selectedNodeId,
    });
    const nextHierarchy = {
      ...normalizedHierarchy,
      nodes: normalizedHierarchy.nodes.map((node) => (
        node.type === HIERARCHY_NODE_TYPES.BUILDING
          ? clampBuildingToSite(node, nextSiteEnvironment).entity
          : node
      )),
    };
    const nextRoomScenes = cloneHistoryValue(snapshot.roomScenes);
    const activeScene = nextHierarchy.activeRoomId
      ? nextRoomScenes[nextHierarchy.activeRoomId]
      : createDefaultRoomScene();

    applyRoomScene(activeScene ?? createDefaultRoomScene());
    setHierarchy(nextHierarchy);
    setRoomScenes(nextRoomScenes);
    setGridSettings(normalizeGridSettings(snapshot.gridSettings));
    setSiteEnvironment(nextSiteEnvironment);
    setSiteBoundaryNotice("");
    setSiteObjects(
      snapshot.siteObjects
        .map(normalizeSiteObject)
        .filter(Boolean)
        .map((object) => clampSiteObjectToSite(object, nextSiteEnvironment).entity),
    );
    setSelectedSiteObjectId(null);
    floorPlanEditor.actions.hydrateFloorPlanState(snapshot);
    floorEquipmentEditor.actions.hydrateFloorEquipmentState(snapshot);
    monitoringEditor.actions.hydrateMonitoringState(snapshot);
    setNavigationContext((current) => {
      const hasBuilding = !current.currentBuildingId || nodeIds.has(current.currentBuildingId);
      const hasFloor = !current.currentFloorId || nodeIds.has(current.currentFloorId);
      const hasRoom = !current.currentRoomId || nodeIds.has(current.currentRoomId);
      if (hasBuilding && hasFloor && hasRoom) {
        return { ...current, transitionId: current.transitionId + 1 };
      }
      return {
        ...createInitialNavigationContext(),
        transitionDirection: "OUT",
        transitionId: current.transitionId + 1,
      };
    });
  }, [applyRoomScene, floorEquipmentEditor.actions, floorPlanEditor.actions, hierarchy.activeRoomId, hierarchy.selectedNodeId, monitoringEditor.actions, navigationContext.currentRoomId, navigationNodeId]);

  const undo = useCallback(() => {
    flushPendingHistory();
    const previousSnapshot = historyPastRef.current.at(-1);
    const currentSnapshot = historyCurrentRef.current;
    if (!previousSnapshot || !currentSnapshot) return;

    historyPastRef.current = historyPastRef.current.slice(0, -1);
    historyFutureRef.current = [...historyFutureRef.current, currentSnapshot].slice(-HISTORY_LIMIT);
    historyCurrentRef.current = previousSnapshot;
    restoringHistoryRef.current = true;
    restoreHistorySnapshot(previousSnapshot);
    updateHistoryAvailability();
  }, [flushPendingHistory, restoreHistorySnapshot, updateHistoryAvailability]);

  const redo = useCallback(() => {
    flushPendingHistory();
    const nextSnapshot = historyFutureRef.current.at(-1);
    const currentSnapshot = historyCurrentRef.current;
    if (!nextSnapshot || !currentSnapshot) return;

    historyFutureRef.current = historyFutureRef.current.slice(0, -1);
    historyPastRef.current = [...historyPastRef.current, currentSnapshot].slice(-HISTORY_LIMIT);
    historyCurrentRef.current = nextSnapshot;
    restoringHistoryRef.current = true;
    restoreHistorySnapshot(nextSnapshot);
    updateHistoryAvailability();
  }, [flushPendingHistory, restoreHistorySnapshot, updateHistoryAvailability]);

  useEffect(() => {
    const nextSnapshot = createHistorySnapshot(layoutDocument);
    if (!historyCurrentRef.current) {
      historyCurrentRef.current = nextSnapshot;
      return;
    }
    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      historyCurrentRef.current = nextSnapshot;
      return;
    }
    if (getHistorySignature(historyCurrentRef.current) === getHistorySignature(nextSnapshot)) return;

    historyPendingRef.current = nextSnapshot;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      historyTimerRef.current = null;
      const pendingSnapshot = historyPendingRef.current;
      historyPendingRef.current = null;
      if (pendingSnapshot) commitHistorySnapshot(pendingSnapshot);
    }, HISTORY_COMMIT_DELAY);
  }, [commitHistorySnapshot, layoutDocument]);

  return {
    hierarchy,
    hierarchyPath,
    rooms,
    activeRoom,
    selectedHierarchyNode,
    selectedHierarchyPath,
    selectedBuilding,
    currentBuilding,
    currentFloor,
    navigationContext,
    navigationPath,
    buildings,
    floors,
    siteEnvironment,
    siteBoundaryNotice,
    siteObjects,
    selectedSiteObject,
    selectedSiteObjectId,
    protectedHierarchyNodeIds,
    layoutDocument,
    world,
    equipmentInstances,
    detailAssets,
    selectedDetailAsset,
    selectedEquipment,
    selectedEquipmentId,
    activeTemplateId,
    viewMode,
    transformMode,
    transformTools,
    snapSize,
    gridSettings,
    collisionIds,
    pipeConnections,
    pipeSnapCandidate,
    favoriteTemplateIds,
    recentTemplateIds,
    canUndo: historyAvailability.canUndo,
    canRedo: historyAvailability.canRedo,
    editorMode: structureEditor.editorMode,
    worldStructures: structureEditor.worldStructures,
    worldSpaces: structureEditor.worldSpaces,
    selectedWorldStructure: structureEditor.selectedWorldStructure,
    selectedWorldStructureId: structureEditor.selectedWorldStructureId,
    activeWorldTemplateId: structureEditor.activeWorldTemplateId,
    worldStructuresLocked: structureEditor.worldStructuresLocked,
    visibilityFilters: structureEditor.visibilityFilters,
    floorPlansById: floorPlanEditor.floorPlansById,
    verticalStructuresByBuildingId: floorPlanEditor.verticalStructuresByBuildingId,
    floorPlanStructures: floorPlanEditor.activeStructures,
    floorStructures: floorPlanEditor.floorStructures,
    activeVerticalStructures: floorPlanEditor.activeVerticalStructures,
    selectedFloorPlanStructure: floorPlanEditor.selectedFloorPlanStructure,
    selectedFloorPlanStructureId: floorPlanEditor.selectedFloorPlanStructureId,
    activeFloorPlanTemplateId: floorPlanEditor.activeFloorPlanTemplateId,
    floorPlanValidationMessage: floorPlanEditor.floorPlanValidationMessage,
    floorPlanVisibilityFilters: floorPlanEditor.visibilityFilters,
    floorPlanSummaryByBuildingId: floorPlanEditor.floorPlanSummaryByBuildingId,
    activeFloorSpatialPlan: floorPlanEditor.activeFloorSpatialPlan,
    selectedSpatialEntity: floorPlanEditor.selectedSpatialEntity,
    equipmentByFloorId: floorEquipmentEditor.equipmentByFloorId,
    activeFloorEquipment: floorEquipmentEditor.activeFloorEquipment,
    buildingFloorEquipment: floorEquipmentEditor.buildingEquipment,
    allFloorEquipment: floorEquipmentEditor.allFloorEquipment,
    selectedFloorEquipment: floorEquipmentEditor.selectedFloorEquipment,
    selectedFloorEquipmentId: floorEquipmentEditor.selectedFloorEquipmentId,
    activeFloorEquipmentTemplateId: floorEquipmentEditor.activeFloorEquipmentTemplateId,
    observationPoints: monitoringEditor.observationPoints,
    equipmentAssetBindings: monitoringEditor.equipmentAssetBindings,
    sensorBindings: monitoringEditor.sensorBindings,
    serverBindings: monitoringEditor.serverBindings,
    monitoringDevices: monitoringEditor.monitoringDevices,
    monitoringBindings: monitoringEditor.monitoringBindings,
    selectedObservationPoint: monitoringEditor.selectedObservationPoint,
    selectedMonitoringDevice: monitoringEditor.selectedMonitoringDevice,
    selectedMonitoringBinding: monitoringEditor.selectedMonitoringBinding,
    selectedAssetBinding: monitoringEditor.selectedAssetBinding,
    selectedSensorBinding: monitoringEditor.selectedSensorBinding,
    selectedServerBinding: monitoringEditor.selectedServerBinding,
    actions: {
      addEquipment,
      updateEquipment,
      addEquipmentPart,
      updateEquipmentPart,
      duplicateEquipmentPart,
      removeEquipmentPart,
      commitPipeSnap,
      removeSelectedEquipment,
      duplicateSelectedEquipment,
      updateWorld,
      updateSiteEnvironment,
      registerDetailAsset,
      removeDetailAsset,
      updateDetailAsset,
      resetLayout,
      hydrateLayout,
      selectRoom,
      addRoom,
      selectBuilding,
      enterBuilding,
      navigateToSite,
      navigateToBuilding,
      selectFloorInBuilding,
      navigateToFloor,
      navigateToRoom,
      navigateToEquipment,
      navigateToNode,
      selectHierarchyNode,
      addHierarchyChild,
      addRoomToFloor,
      renameHierarchyNode,
      updateHierarchyNode,
      addBuildingFromArea,
      updateBuilding,
      addSiteObjectFromArea,
      addSiteObjectsFromArea,
      selectSiteObject,
      updateSiteObject,
      removeSelectedSiteObject,
      duplicateSelectedSiteEntity,
      updateRoomLayout,
      deleteHierarchyNode,
      selectTemplate,
      toggleFavorite,
      setEditorMode,
      selectWorldTemplate,
      addWorldStructure,
      updateWorldStructure,
      selectWorldStructure,
      removeSelectedWorldStructure,
      duplicateSelectedWorldStructure,
      setWorldStructuresLocked,
      toggleVisibilityFilter,
      ...floorPlanEditor.actions,
      ...floorEquipmentEditor.actions,
      ...monitoringEditor.actions,
      selectEquipment,
      clearSelection,
      setViewMode,
      setTransformMode,
      toggleTransformTool: (tool) => setTransformTools((current) => {
        if (tool === "translate") return cycleTransformMoveAxisMode(current);
        const normalized = normalizeTransformTools(current);
        return { ...normalized, [tool]: !normalized[tool] };
      }),
      setSnapSize,
      setGridSnapEnabled,
      addGridRegion,
      updateGridRegion,
      removeGridRegion,
      undo,
      redo,
    },
  };
}
