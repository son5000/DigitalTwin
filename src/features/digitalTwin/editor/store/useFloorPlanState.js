import { useCallback, useMemo, useState } from "react";

import {
  DEFAULT_VISIBILITY_FILTERS,
  WORLD_STRUCTURE_TEMPLATE_MAP,
} from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { normalizeFloorSurfaceStyle } from "@/features/digitalTwin/editor/constants/floorSurfaceStyles";
import { resolveObjectModelId } from "@/features/digitalTwin/editor/constants/objectModelRegistry";
import { clampDimension } from "@/features/digitalTwin/editor/utils/editorMath";
import { getBuildingFootprint } from "@/features/digitalTwin/editor/utils/buildingFootprint";
import {
  getOrderedBuildingFloors,
  getStairServedFloorIds,
  getStairValues,
  validateStairStructure,
} from "@/features/digitalTwin/editor/utils/stairStructure";
import { getWorldStructureDimensions } from "@/features/digitalTwin/editor/world/WorldStructureFactory";
import {
  addDoorToWall,
  addElevationZone,
  addFootprintHole,
  addFootprintRegion,
  addFootprintVertex,
  addRectangularRoom,
  cloneFloorSpatialPlanForFloor,
  mergeFootprintRegions,
  normalizeFloorSpatialPlan,
  removeDoor,
  removeFootprintVertex,
  restoreInheritedFloorFootprint,
  splitElevationZone,
  subtractFootprintRegion,
  updateDoor,
  updateElevationZone,
  updateFootprintVertex,
  updateRoom,
  updateSharedWall,
  validateFloorSpatialPlan,
} from "@/features/digitalTwin/editor/model/floorSpatialModel";

function createId() {
  return `FLOOR_PLAN_STRUCTURE_${crypto.randomUUID()}`;
}

function buildingForFloor(building, floor) {
  return building ? { ...building, __floorLevel: floor?.level ?? 1 } : building;
}

function normalizeStructure(structure) {
  const definition = WORLD_STRUCTURE_TEMPLATE_MAP[resolveObjectModelId(structure.type)] ?? WORLD_STRUCTURE_TEMPLATE_MAP[structure.type];
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
    position: { x: 0, y: definition.defaultPositionY ?? 0, z: 0, ...structure.position },
    rotation: { x: 0, y: 0, z: 0, ...structure.rotation },
    appearance: { ...definition.defaultAppearance, ...structure.appearance },
    appearanceSlots: Object.fromEntries((definition.materialSlots ?? []).map((slot) => [
      slot.id,
      { ...slot.defaultAppearance, ...structure.appearanceSlots?.[slot.id] },
    ])),
    spaceId: structure.spaceId ?? structure.floorId ?? structure.buildingId ?? "",
    visible: structure.visible ?? true,
    locked: structure.locked ?? false,
    groundSnap: structure.groundSnap ?? definition.defaultGroundSnap ?? true,
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
    appearanceSlots: changes.appearanceSlots
      ? Object.fromEntries([...new Set([...Object.keys(structure.appearanceSlots ?? {}), ...Object.keys(changes.appearanceSlots)])].map((slotId) => [
          slotId,
          { ...structure.appearanceSlots?.[slotId], ...changes.appearanceSlots[slotId] },
        ]))
      : structure.appearanceSlots,
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
  const stairForScope = {
    ...synchronized,
    startFloorId: synchronized.applicationScope.startFloorId,
    endFloorId: synchronized.applicationScope.endFloorId,
  };
  return {
    ...stairForScope,
    stairType: synchronized.stairType ?? "STRAIGHT",
    servedFloorIds: getStairServedFloorIds(stairForScope, scopedFloors),
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
  const [selectedSpatialEntity, setSelectedSpatialEntity] = useState(null);

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
  const activeFloorSpatialPlan = useMemo(
    () => currentFloor
      ? normalizeFloorSpatialPlan(floorPlansById[currentFloor.id] ?? { floorId: currentFloor.id, structures: [] }, buildingForFloor(currentBuilding, currentFloor))
      : null,
    [currentBuilding, currentFloor, floorPlansById],
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
    setSelectedSpatialEntity(null);
  }, []);

  const commitSpatialPlan = useCallback((mutator) => {
    if (!currentFloor || !currentBuilding) return false;
    const current = normalizeFloorSpatialPlan(
      floorPlansById[currentFloor.id] ?? { floorId: currentFloor.id, structures: [] },
      buildingForFloor(currentBuilding, currentFloor),
    );
    const next = mutator(current);
    const nextSelection = next.selectedSpatialEntity;
    const storedNext = { ...next };
    delete storedNext.selectedSpatialEntity;
    const issues = validateFloorSpatialPlan(
      storedNext,
      storedNext.structures ?? [],
      [],
    );
    const error = issues.find((issue) => issue.severity === "error");
    if (error) {
      setFloorPlanValidationMessage(error.message);
      return false;
    }
    setFloorPlansById((plans) => ({ ...plans, [currentFloor.id]: storedNext }));
    if (nextSelection !== undefined) setSelectedSpatialEntity(nextSelection);
    const warning = issues.find((issue) => issue.severity === "warning");
    setFloorPlanValidationMessage(warning?.message ?? "");
    return true;
  }, [currentBuilding, currentFloor, floorPlansById]);

  const setFloorFootprintMode = useCallback((mode) => commitSpatialPlan((plan) => (
    mode === "INHERIT_BUILDING"
      ? { ...plan, floorFootprint: restoreInheritedFloorFootprint(buildingForFloor(currentBuilding, currentFloor), plan.floorFootprint) }
      : { ...plan, floorFootprint: { ...plan.floorFootprint, mode: "CUSTOM", revision: plan.floorFootprint.revision + 1 } }
  )), [commitSpatialPlan, currentBuilding, currentFloor]);

  const updateFloorFootprintVertex = useCallback((regionId, ringType, ringIndex, vertexIndex, nextPoint) => (
    commitSpatialPlan((plan) => ({ ...plan, floorFootprint: updateFootprintVertex(plan.floorFootprint, regionId, ringType, ringIndex, vertexIndex, nextPoint) }))
  ), [commitSpatialPlan]);
  const appendFloorFootprintVertex = useCallback((regionId) => commitSpatialPlan((plan) => ({ ...plan, floorFootprint: addFootprintVertex(plan.floorFootprint, regionId) })), [commitSpatialPlan]);
  const deleteFloorFootprintVertex = useCallback((regionId, vertexIndex) => commitSpatialPlan((plan) => ({ ...plan, floorFootprint: removeFootprintVertex(plan.floorFootprint, regionId, vertexIndex) })), [commitSpatialPlan]);
  const appendFloorFootprintRegion = useCallback(() => commitSpatialPlan((plan) => ({ ...plan, floorFootprint: addFootprintRegion(plan.floorFootprint) })), [commitSpatialPlan]);
  const appendFloorFootprintHole = useCallback((regionId) => commitSpatialPlan((plan) => ({ ...plan, floorFootprint: addFootprintHole(plan.floorFootprint, regionId) })), [commitSpatialPlan]);
  const combineFloorFootprintRegions = useCallback((regionIds) => commitSpatialPlan((plan) => ({ ...plan, floorFootprint: mergeFootprintRegions(plan.floorFootprint, regionIds) })), [commitSpatialPlan]);
  const subtractFloorFootprintRegions = useCallback((targetRegionId, subtractingRegionId) => commitSpatialPlan((plan) => ({ ...plan, floorFootprint: subtractFootprintRegion(plan.floorFootprint, targetRegionId, subtractingRegionId) })), [commitSpatialPlan]);

  const createElevationZone = useCallback((options) => commitSpatialPlan((plan) => addElevationZone(plan, options)), [commitSpatialPlan]);
  const changeElevationZone = useCallback((zoneId, changes) => commitSpatialPlan((plan) => updateElevationZone(plan, zoneId, changes)), [commitSpatialPlan]);
  const divideElevationZone = useCallback((zoneId, axis) => commitSpatialPlan((plan) => splitElevationZone(plan, zoneId, axis)), [commitSpatialPlan]);
  const createRoom = useCallback((options) => commitSpatialPlan((plan) => addRectangularRoom(plan, options)), [commitSpatialPlan]);
  const changeRoom = useCallback((roomId, changes) => commitSpatialPlan((plan) => updateRoom(plan, roomId, changes)), [commitSpatialPlan]);
  const changeSharedWall = useCallback((wallId, changes) => commitSpatialPlan((plan) => updateSharedWall(plan, wallId, changes)), [commitSpatialPlan]);
  const createDoor = useCallback((wallId, options) => {
    let doorError = "";
    const applied = commitSpatialPlan((plan) => {
      const result = addDoorToWall(plan, wallId, options);
      doorError = result.error;
      return result.plan;
    });
    if (doorError) setFloorPlanValidationMessage(doorError);
    return applied && !doorError;
  }, [commitSpatialPlan]);
  const changeDoor = useCallback((doorId, changes) => {
    let doorError = "";
    const applied = commitSpatialPlan((plan) => {
      const result = updateDoor(plan, doorId, changes);
      doorError = result.error;
      return result.plan;
    });
    if (doorError) setFloorPlanValidationMessage(doorError);
    return applied && !doorError;
  }, [commitSpatialPlan]);
  const deleteDoor = useCallback((doorId) => commitSpatialPlan((plan) => removeDoor(plan, doorId)), [commitSpatialPlan]);

  const addFloorPlanStructure = useCallback((templateId, position, context = {}) => {
    const definition = WORLD_STRUCTURE_TEMPLATE_MAP[templateId];
    const targetFloor = floors.find((floor) => floor.id === context.floorId) ?? currentFloor;
    const targetBuilding = buildings.find((building) => building.id === context.buildingId)
      ?? buildings.find((building) => building.id === targetFloor?.parentId)
      ?? currentBuilding;
    if (!definition || !targetFloor || !targetBuilding || templateId === "FLOOR_REGION") return null;
    if (templateId === "DOOR") {
      setFloorPlanValidationMessage("문은 독립 배치할 수 없습니다. 방·벽 편집에서 호스트 벽을 선택하세요.");
      return null;
    }
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
          ...plans[targetFloor.id],
          floorId: targetFloor.id,
          structures: [...(plans[targetFloor.id]?.structures ?? []), structure],
        },
      }));
    }
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
        [duplicate.floorId]: {
          ...plans[duplicate.floorId],
          floorId: duplicate.floorId,
          structures: [...(plans[duplicate.floorId]?.structures ?? []), duplicate],
        },
      }));
    }
    setFloorPlanValidationMessage("");
    setSelectedFloorPlanStructureId(duplicate.id);
  }, [buildings, currentFloor?.id, floors, selectedFloorPlanStructure, verticalStructuresByBuildingId]);

  const copyFloorPlanFromFloor = useCallback((sourceFloorId) => {
    if (!currentFloor || !sourceFloorId || sourceFloorId === currentFloor.id) return false;
    if (!buildingFloors.some((floor) => floor.id === sourceFloorId)) return false;
    const sourcePlan = floorPlansById[sourceFloorId] ?? { floorId: sourceFloorId, structures: [] };
    setFloorPlansById((plans) => ({
      ...plans,
      [currentFloor.id]: {
        ...cloneFloorSpatialPlanForFloor(sourcePlan, buildingForFloor(currentBuilding, currentFloor), currentFloor.id),
        structures: (sourcePlan.structures ?? []).map((structure) => normalizeStructure({ ...structure, id: createId(), floorId: currentFloor.id, name: structure.name })),
      },
    }));
    setSelectedFloorPlanStructureId(null);
    return true;
  }, [buildingFloors, currentBuilding, currentFloor, floorPlansById]);

  const applyFloorPlanToFloors = useCallback((targetFloorIds) => {
    if (!currentFloor || !targetFloorIds?.length) return;
    const sourcePlan = floorPlansById[currentFloor.id] ?? { floorId: currentFloor.id, structures: [] };
    setFloorPlansById((plans) => {
      const next = { ...plans };
      targetFloorIds.filter((floorId) => floorId !== currentFloor.id).forEach((floorId) => {
        next[floorId] = {
          ...cloneFloorSpatialPlanForFloor(sourcePlan, buildingForFloor(currentBuilding, floors.find((floor) => floor.id === floorId)), floorId),
          structures: (sourcePlan.structures ?? []).map((structure) => normalizeStructure({ ...structure, id: createId(), floorId })),
        };
      });
      return next;
    });
  }, [currentBuilding, currentFloor, floorPlansById, floors]);

  const applyFloorStyleToFloors = useCallback((targetFloorIds, floorStyle) => {
    const validFloorIds = new Set(buildingFloors.map((floor) => floor.id));
    const scopedFloorIds = [...new Set(targetFloorIds ?? [])].filter((floorId) => validFloorIds.has(floorId));
    if (!scopedFloorIds.length) return false;
    const normalizedStyle = normalizeFloorSurfaceStyle(floorStyle);
    setFloorPlansById((plans) => {
      const next = { ...plans };
      scopedFloorIds.forEach((floorId) => {
        next[floorId] = {
          ...plans[floorId],
          floorId,
          structures: plans[floorId]?.structures ?? [],
          floorStyle: normalizedStyle,
        };
      });
      return next;
    });
    return true;
  }, [buildingFloors]);

  const toggleVisibilityFilter = useCallback((filterId) => {
    setVisibilityFilters((filters) => ({ ...filters, [filterId]: !filters[filterId] }));
  }, []);

  const hydrateFloorPlanState = useCallback((snapshot = {}) => {
    setFloorPlansById(Object.fromEntries(Object.entries(snapshot.floorPlansById ?? {}).map(([floorId, plan]) => [
      floorId,
      normalizeFloorSpatialPlan(
        { ...plan, floorId, structures: (plan.structures ?? []).map(normalizeStructure).filter(Boolean) },
        buildingForFloor(
          buildings.find((building) => building.id === floors.find((floor) => floor.id === floorId)?.parentId),
          floors.find((floor) => floor.id === floorId),
        ),
      ),
    ])));
    setVerticalStructuresByBuildingId(Object.fromEntries(Object.entries(snapshot.verticalStructuresByBuildingId ?? {}).map(([buildingId, structures]) => [
      buildingId,
      (structures ?? []).map(normalizeStructure).filter(Boolean),
    ])));
    setSelectedFloorPlanStructureId(null);
    setActiveFloorPlanTemplateId(null);
    setFloorPlanValidationMessage("");
    setSelectedSpatialEntity(null);
  }, [buildings, floors]);

  const resetFloorPlanState = useCallback(() => {
    setFloorPlansById({});
    setVerticalStructuresByBuildingId({});
    setSelectedFloorPlanStructureId(null);
    setActiveFloorPlanTemplateId(null);
    setFloorPlanValidationMessage("");
    setSelectedSpatialEntity(null);
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
    activeFloorSpatialPlan,
    selectedSpatialEntity,
    actions: {
      selectFloorPlanTemplate,
      addFloorPlanStructure,
      updateFloorPlanStructure,
      selectFloorPlanStructure: setSelectedFloorPlanStructureId,
      removeSelectedFloorPlanStructure,
      duplicateSelectedFloorPlanStructure,
      copyFloorPlanFromFloor,
      applyFloorPlanToFloors,
      applyFloorStyleToFloors,
      toggleFloorPlanVisibilityFilter: toggleVisibilityFilter,
      selectSpatialEntity: setSelectedSpatialEntity,
      setFloorFootprintMode,
      updateFloorFootprintVertex,
      appendFloorFootprintVertex,
      deleteFloorFootprintVertex,
      appendFloorFootprintRegion,
      appendFloorFootprintHole,
      combineFloorFootprintRegions,
      subtractFloorFootprintRegions,
      createElevationZone,
      changeElevationZone,
      divideElevationZone,
      createRoom,
      changeRoom,
      changeSharedWall,
      createDoor,
      changeDoor,
      deleteDoor,
      hydrateFloorPlanState,
      resetFloorPlanState,
    },
  };
}
