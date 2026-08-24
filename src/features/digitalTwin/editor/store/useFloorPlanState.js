import { useCallback, useMemo, useState } from "react";

import {
  DEFAULT_VISIBILITY_FILTERS,
  WORLD_STRUCTURE_TEMPLATE_MAP,
} from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { clampDimension } from "@/features/digitalTwin/editor/utils/editorMath";
import { getBuildingFootprint } from "@/features/digitalTwin/editor/utils/buildingFootprint";
import {
  getOrderedBuildingFloors,
  getStairServedFloorIds,
  getStairValues,
  validateStairStructure,
} from "@/features/digitalTwin/editor/utils/stairStructure";
import { getWorldStructureDimensions } from "@/features/digitalTwin/editor/world/WorldStructureFactory";

function createId() {
  return `FLOOR_PLAN_STRUCTURE_${crypto.randomUUID()}`;
}

function normalizeStructure(structure) {
  const definition = WORLD_STRUCTURE_TEMPLATE_MAP[structure.type];
  if (!definition) return null;
  const normalized = {
    ...structure,
    id: structure.id ?? createId(),
    domain: "FLOOR_PLAN",
    type: definition.id,
    group: definition.group,
    name: structure.name ?? definition.nameKo,
    usage: structure.usage ?? (definition.id === "ROOM" ? "일반 공간" : ""),
    variant: structure.variant ?? definition.variants?.[0] ?? null,
    parameters: { ...definition.defaultParameters, ...structure.parameters },
    position: { x: 0, y: 0, z: 0, ...structure.position },
    rotation: { x: 0, y: 0, z: 0, ...structure.rotation },
    appearance: { ...definition.defaultAppearance, ...structure.appearance },
    spaceId: structure.spaceId ?? structure.floorId ?? structure.buildingId ?? "",
    visible: structure.visible ?? true,
    locked: structure.locked ?? false,
    groundSnap: true,
  };
  if (definition.id !== "STAIR") return normalized;
  const stairValues = getStairValues(normalized);
  return {
    ...normalized,
    stairType: structure.stairType ?? "STRAIGHT",
    startFloorId: structure.startFloorId ?? structure.applicationScope?.startFloorId ?? null,
    endFloorId: structure.endFloorId ?? structure.applicationScope?.endFloorId ?? null,
    servedFloorIds: structure.servedFloorIds ?? structure.applicationScope?.connectedFloorIds ?? [],
    width: stairValues.width,
    treadDepth: stairValues.treadDepth,
    riserHeight: stairValues.riserHeight,
    landingDepth: stairValues.landingDepth,
  };
}

function resolveConnectedFloorIds(scope, floors, currentFloorId) {
  if (!floors.length) return [];
  const ordered = [...floors].sort((left, right) => (left.level ?? 0) - (right.level ?? 0));
  if (scope.mode === "CURRENT") return currentFloorId ? [currentFloorId] : [];
  if (scope.mode === "ALL") return ordered.map((floor) => floor.id);
  if (scope.mode === "SELECTED") {
    const validIds = new Set(ordered.map((floor) => floor.id));
    return (scope.floorIds ?? []).filter((floorId) => validIds.has(floorId));
  }
  const startIndex = Math.max(0, ordered.findIndex((floor) => floor.id === scope.startFloorId));
  const endCandidate = ordered.findIndex((floor) => floor.id === scope.endFloorId);
  const endIndex = endCandidate < 0 ? ordered.length - 1 : endCandidate;
  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);
  return ordered.slice(from, to + 1).map((floor) => floor.id);
}

function mergeStructure(structure, changes) {
  const merged = {
    ...structure,
    ...changes,
    parameters: changes.parameters
      ? Object.fromEntries(Object.entries({ ...structure.parameters, ...changes.parameters }).map(([key, value]) => [
          key,
          typeof value === "number"
            ? key === "startHeight" ? Math.max(0, value)
              : key === "stepCount" ? Math.max(2, Math.round(value))
                : clampDimension(value)
            : value,
        ]))
      : structure.parameters,
    position: changes.position ? { ...structure.position, ...changes.position } : structure.position,
    rotation: changes.rotation ? { ...structure.rotation, ...changes.rotation } : structure.rotation,
    appearance: changes.appearance ? { ...structure.appearance, ...changes.appearance } : structure.appearance,
    applicationScope: changes.applicationScope
      ? { ...structure.applicationScope, ...changes.applicationScope }
      : structure.applicationScope,
  };
  if (structure.type !== "STAIR") return merged;
  return {
    ...merged,
    stairType: changes.stairType ?? merged.stairType ?? "STRAIGHT",
    width: changes.width ?? changes.parameters?.width ?? merged.width,
    treadDepth: changes.treadDepth ?? changes.parameters?.treadDepth ?? merged.treadDepth,
    riserHeight: changes.riserHeight ?? changes.parameters?.riserHeight ?? merged.riserHeight,
    landingDepth: changes.landingDepth ?? changes.parameters?.landingDepth ?? merged.landingDepth,
  };
}

function synchronizeVerticalStructure(structure, scopedFloors, currentFloorId) {
  const connectedFloorIds = resolveConnectedFloorIds(structure.applicationScope, scopedFloors, currentFloorId);
  const synchronized = {
    ...structure,
    applicationScope: { ...structure.applicationScope, connectedFloorIds },
  };
  if (structure.type !== "STAIR") return synchronized;
  const values = getStairValues(synchronized);
  return {
    ...synchronized,
    stairType: synchronized.stairType ?? "STRAIGHT",
    startFloorId: synchronized.applicationScope.startFloorId,
    endFloorId: synchronized.applicationScope.endFloorId,
    servedFloorIds: getStairServedFloorIds(synchronized, scopedFloors),
    width: values.width,
    treadDepth: values.treadDepth,
    riserHeight: values.riserHeight,
    landingDepth: values.landingDepth,
  };
}

function constrainStructure(structure, building, gridSize) {
  if (!building) return structure;
  const footprint = getBuildingFootprint(building);
  const dimensions = getWorldStructureDimensions(structure);
  const rotation = structure.rotation?.y ?? 0;
  const halfWidth = (Math.abs(Math.cos(rotation)) * dimensions.width + Math.abs(Math.sin(rotation)) * dimensions.depth) / 2;
  const halfDepth = (Math.abs(Math.sin(rotation)) * dimensions.width + Math.abs(Math.cos(rotation)) * dimensions.depth) / 2;
  const spacing = Math.max(0.1, Number(gridSize) || 1);
  const x = Math.round(structure.position.x / spacing) * spacing;
  const z = Math.round(structure.position.z / spacing) * spacing;
  const xLimit = Math.max(0, footprint.width / 2 - halfWidth);
  const zLimit = Math.max(0, footprint.depth / 2 - halfDepth);
  return {
    ...structure,
    position: {
      x: Math.min(xLimit, Math.max(-xLimit, x)),
      y: 0,
      z: Math.min(zLimit, Math.max(-zLimit, z)),
    },
  };
}

export default function useFloorPlanState({ buildings, floors, currentBuilding, currentFloor, gridSettings }) {
  const [floorPlansById, setFloorPlansById] = useState({});
  const [verticalStructuresByBuildingId, setVerticalStructuresByBuildingId] = useState({});
  const [selectedFloorPlanStructureId, setSelectedFloorPlanStructureId] = useState(null);
  const [activeFloorPlanTemplateId, setActiveFloorPlanTemplateId] = useState(null);
  const [visibilityFilters, setVisibilityFilters] = useState(DEFAULT_VISIBILITY_FILTERS);
  const [floorPlanValidationMessage, setFloorPlanValidationMessage] = useState("");

  const activeBuildingId = currentFloor?.parentId ?? currentBuilding?.id ?? null;
  const buildingFloors = useMemo(
    () => floors.filter((floor) => floor.parentId === activeBuildingId)
      .sort((left, right) => (left.level ?? 0) - (right.level ?? 0)),
    [activeBuildingId, floors],
  );
  const floorStructures = useMemo(
    () => floorPlansById[currentFloor?.id]?.structures ?? [],
    [currentFloor?.id, floorPlansById],
  );
  const synchronizedVerticalStructuresByBuildingId = useMemo(() => Object.fromEntries(
    Object.entries(verticalStructuresByBuildingId).map(([buildingId, structures]) => {
      const scopedFloors = getOrderedBuildingFloors(floors, buildingId);
      const floorIds = new Set(scopedFloors.map((floor) => floor.id));
      return [buildingId, structures.map((structure) => {
        const applicationScope = { ...structure.applicationScope };
        if (!floorIds.has(applicationScope.startFloorId)) applicationScope.startFloorId = scopedFloors[0]?.id ?? null;
        if (!floorIds.has(applicationScope.endFloorId)) applicationScope.endFloorId = scopedFloors.at(-1)?.id ?? null;
        return synchronizeVerticalStructure({ ...structure, applicationScope }, scopedFloors, applicationScope.startFloorId);
      })];
    }),
  ), [floors, verticalStructuresByBuildingId]);
  const buildingVerticalStructures = useMemo(
    () => synchronizedVerticalStructuresByBuildingId[activeBuildingId] ?? [],
    [activeBuildingId, synchronizedVerticalStructuresByBuildingId],
  );
  const activeVerticalStructures = useMemo(
    () => buildingVerticalStructures.filter((structure) => (
      structure.applicationScope?.connectedFloorIds ?? []
    ).includes(currentFloor?.id)),
    [buildingVerticalStructures, currentFloor?.id],
  );
  const activeStructures = useMemo(
    () => [...floorStructures, ...activeVerticalStructures],
    [activeVerticalStructures, floorStructures],
  );
  const selectedFloorPlanStructure = activeStructures.find(
    (structure) => structure.id === selectedFloorPlanStructureId,
  ) ?? null;

  const selectFloorPlanTemplate = useCallback((templateId) => {
    setActiveFloorPlanTemplateId((currentId) => currentId === templateId ? null : templateId);
    setSelectedFloorPlanStructureId(null);
    setFloorPlanValidationMessage("");
  }, []);

  const addFloorPlanStructure = useCallback((templateId, position, context = {}) => {
    const definition = WORLD_STRUCTURE_TEMPLATE_MAP[templateId];
    const targetFloor = floors.find((floor) => floor.id === context.floorId) ?? currentFloor;
    const targetBuilding = buildings.find((building) => building.id === context.buildingId)
      ?? buildings.find((building) => building.id === targetFloor?.parentId)
      ?? currentBuilding;
    if (!definition || !targetFloor || !targetBuilding || templateId === "FLOOR_REGION") return null;
    const targetBuildingFloors = floors.filter((floor) => floor.parentId === targetBuilding.id)
      .sort((left, right) => (left.level ?? 0) - (right.level ?? 0));
    const sequence = activeStructures.filter((structure) => structure.type === templateId).length + 1;
    const id = createId();
    if (definition.isVertical) {
      const scope = {
        mode: "RANGE",
        startFloorId: targetFloor.id,
        endFloorId: targetBuildingFloors.at(-1)?.id ?? targetFloor.id,
        floorIds: [],
      };
      let structure = constrainStructure(normalizeStructure({
        id,
        type: templateId,
        name: `${definition.nameKo} ${String(sequence).padStart(2, "0")}`,
        buildingId: targetBuilding.id,
        direction: "UP",
        structureType: templateId,
        position,
        stairType: templateId === "STAIR" ? "STRAIGHT" : undefined,
        startFloorId: templateId === "STAIR" ? scope.startFloorId : undefined,
        endFloorId: templateId === "STAIR" ? scope.endFloorId : undefined,
        applicationScope: {
          ...scope,
          connectedFloorIds: resolveConnectedFloorIds(scope, targetBuildingFloors, targetFloor.id),
        },
      }), targetBuilding, gridSettings.baseSize);
      structure = synchronizeVerticalStructure(structure, targetBuildingFloors, targetFloor.id);
      if (templateId === "STAIR") {
        const obstacles = [
          ...(verticalStructuresByBuildingId[targetBuilding.id] ?? []),
          ...targetBuildingFloors.flatMap((floor) => floorPlansById[floor.id]?.structures ?? [])
            .filter((item) => ["WALL", "STAIR", "STAIRWELL", "ELEVATOR", "SHAFT"].includes(item.type)),
        ];
        const validationError = validateStairStructure(structure, targetBuildingFloors, targetBuilding, obstacles);
        if (validationError) {
          setFloorPlanValidationMessage(validationError);
          return null;
        }
      }
      setVerticalStructuresByBuildingId((collections) => ({
        ...collections,
        [targetBuilding.id]: [...(collections[targetBuilding.id] ?? []), structure],
      }));
      setFloorPlanValidationMessage("");
    } else {
      const structure = constrainStructure(normalizeStructure({
        id,
        type: templateId,
        name: `${definition.nameKo} ${String(sequence).padStart(2, "0")}`,
        floorId: targetFloor.id,
        position,
      }), targetBuilding, gridSettings.baseSize);
      setFloorPlansById((plans) => ({
        ...plans,
        [targetFloor.id]: {
          floorId: targetFloor.id,
          structures: [...(plans[targetFloor.id]?.structures ?? []), structure],
        },
      }));
    }
    setSelectedFloorPlanStructureId(id);
    setActiveFloorPlanTemplateId(null);
    return id;
  }, [activeStructures, buildings, currentBuilding, currentFloor, floorPlansById, floors, gridSettings.baseSize, verticalStructuresByBuildingId]);

  const updateFloorPlanStructure = useCallback((structureId, changes) => {
    if (!structureId) return;
    setFloorPlansById((plans) => Object.fromEntries(Object.entries(plans).map(([floorId, plan]) => [
      floorId,
      { ...plan, structures: plan.structures.map((structure) => {
        if (structure.id !== structureId || structure.locked) return structure;
        const floor = floors.find((item) => item.id === structure.floorId);
        const building = buildings.find((item) => item.id === floor?.parentId);
        return constrainStructure(mergeStructure(structure, changes), building, gridSettings.baseSize);
      }) },
    ])));
    const verticalEntry = Object.entries(verticalStructuresByBuildingId)
      .find(([, structures]) => structures.some((structure) => structure.id === structureId));
    if (!verticalEntry) return true;
    const [buildingId, structures] = verticalEntry;
    const structure = structures.find((item) => item.id === structureId);
    if (!structure || structure.locked) return;
    const building = buildings.find((item) => item.id === buildingId);
    const scopedFloors = getOrderedBuildingFloors(floors, buildingId);
    const next = synchronizeVerticalStructure(
      constrainStructure(mergeStructure(structure, changes), building, gridSettings.baseSize),
      scopedFloors,
      currentFloor?.id,
    );
    if (next.type === "STAIR") {
      const floorObstacles = scopedFloors.flatMap((floor) => floorPlansById[floor.id]?.structures ?? [])
        .filter((item) => ["WALL", "STAIRWELL", "ELEVATOR", "SHAFT"].includes(item.type));
      const validationError = validateStairStructure(next, scopedFloors, building, [
        ...structures.filter((item) => item.id !== structureId),
        ...floorObstacles,
      ]);
      if (validationError) {
        setFloorPlanValidationMessage(validationError);
        return false;
      }
    }
    setFloorPlanValidationMessage("");
    setVerticalStructuresByBuildingId((collections) => ({
      ...collections,
      [buildingId]: (collections[buildingId] ?? []).map((item) => item.id === structureId ? next : item),
    }));
    return true;
  }, [buildings, currentFloor?.id, floorPlansById, floors, gridSettings.baseSize, verticalStructuresByBuildingId]);

  const removeSelectedFloorPlanStructure = useCallback(() => {
    if (!selectedFloorPlanStructureId) return;
    setFloorPlansById((plans) => Object.fromEntries(Object.entries(plans).map(([floorId, plan]) => [
      floorId,
      { ...plan, structures: plan.structures.filter((structure) => structure.id !== selectedFloorPlanStructureId || structure.locked) },
    ])));
    setVerticalStructuresByBuildingId((collections) => Object.fromEntries(
      Object.entries(collections).map(([buildingId, structures]) => [
        buildingId,
        structures.filter((structure) => structure.id !== selectedFloorPlanStructureId || structure.locked),
      ]),
    ));
    setSelectedFloorPlanStructureId(null);
    setFloorPlanValidationMessage("");
  }, [selectedFloorPlanStructureId]);

  const duplicateSelectedFloorPlanStructure = useCallback(() => {
    if (!selectedFloorPlanStructure || selectedFloorPlanStructure.locked) return;
    let duplicate = normalizeStructure({
      ...selectedFloorPlanStructure,
      id: createId(),
      name: `${selectedFloorPlanStructure.name} 복사본`,
      position: { ...selectedFloorPlanStructure.position, x: selectedFloorPlanStructure.position.x + 0.5, z: selectedFloorPlanStructure.position.z + 0.5 },
    });
    if (duplicate.buildingId) {
      const scopedFloors = getOrderedBuildingFloors(floors, duplicate.buildingId);
      duplicate = synchronizeVerticalStructure(duplicate, scopedFloors, currentFloor?.id);
      if (duplicate.type === "STAIR") {
        const building = buildings.find((item) => item.id === duplicate.buildingId);
        const validationError = validateStairStructure(
          duplicate,
          scopedFloors,
          building,
          verticalStructuresByBuildingId[duplicate.buildingId] ?? [],
        );
        if (validationError) {
          setFloorPlanValidationMessage(validationError);
          return;
        }
      }
      setVerticalStructuresByBuildingId((collections) => ({
        ...collections,
        [duplicate.buildingId]: [...(collections[duplicate.buildingId] ?? []), duplicate],
      }));
    } else {
      setFloorPlansById((plans) => ({
        ...plans,
        [duplicate.floorId]: { floorId: duplicate.floorId, structures: [...(plans[duplicate.floorId]?.structures ?? []), duplicate] },
      }));
    }
    setFloorPlanValidationMessage("");
    setSelectedFloorPlanStructureId(duplicate.id);
  }, [buildings, currentFloor?.id, floors, selectedFloorPlanStructure, verticalStructuresByBuildingId]);

  const copyPreviousFloorPlan = useCallback(() => {
    const currentIndex = buildingFloors.findIndex((floor) => floor.id === currentFloor?.id);
    if (currentIndex <= 0) return false;
    const source = floorPlansById[buildingFloors[currentIndex - 1].id]?.structures ?? [];
    setFloorPlansById((plans) => ({
      ...plans,
      [currentFloor.id]: {
        floorId: currentFloor.id,
        structures: source.map((structure) => normalizeStructure({ ...structure, id: createId(), floorId: currentFloor.id, name: structure.name })),
      },
    }));
    setSelectedFloorPlanStructureId(null);
    return true;
  }, [buildingFloors, currentFloor, floorPlansById]);

  const applyFloorPlanToFloors = useCallback((targetFloorIds) => {
    if (!currentFloor || !targetFloorIds?.length) return;
    const source = floorPlansById[currentFloor.id]?.structures ?? [];
    setFloorPlansById((plans) => {
      const next = { ...plans };
      targetFloorIds.filter((floorId) => floorId !== currentFloor.id).forEach((floorId) => {
        next[floorId] = {
          floorId,
          structures: source.map((structure) => normalizeStructure({ ...structure, id: createId(), floorId })),
        };
      });
      return next;
    });
  }, [currentFloor, floorPlansById]);

  const toggleVisibilityFilter = useCallback((filterId) => {
    setVisibilityFilters((filters) => ({ ...filters, [filterId]: !filters[filterId] }));
  }, []);

  const floorPlanSummaryByBuildingId = useMemo(() => Object.fromEntries(buildings.map((building) => {
    const buildingFloorIds = floors.filter((floor) => floor.parentId === building.id).map((floor) => floor.id);
    return [building.id, {
      configuredFloorCount: buildingFloorIds.filter((floorId) => (floorPlansById[floorId]?.structures?.length ?? 0) > 0).length,
      verticalStructureCount: verticalStructuresByBuildingId[building.id]?.length ?? 0,
      floorCount: buildingFloorIds.length,
    }];
  })), [buildings, floorPlansById, floors, verticalStructuresByBuildingId]);

  return {
    floorPlansById,
    verticalStructuresByBuildingId: synchronizedVerticalStructuresByBuildingId,
    floorStructures,
    buildingVerticalStructures,
    activeVerticalStructures,
    activeStructures,
    selectedFloorPlanStructure,
    selectedFloorPlanStructureId,
    activeFloorPlanTemplateId,
    floorPlanValidationMessage,
    visibilityFilters,
    floorPlanSummaryByBuildingId,
    actions: {
      selectFloorPlanTemplate,
      addFloorPlanStructure,
      updateFloorPlanStructure,
      selectFloorPlanStructure: setSelectedFloorPlanStructureId,
      removeSelectedFloorPlanStructure,
      duplicateSelectedFloorPlanStructure,
      copyPreviousFloorPlan,
      applyFloorPlanToFloors,
      toggleFloorPlanVisibilityFilter: toggleVisibilityFilter,
    },
  };
}
