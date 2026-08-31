const MIN_STAIR_WIDTH = 0.8;
const MIN_TREAD_DEPTH = 0.22;
const MIN_RISER_HEIGHT = 0.1;
const MAX_RISER_HEIGHT = 0.22;
const DEFAULT_TREAD_DEPTH = 0.28;
const DEFAULT_RISER_HEIGHT = 0.18;
const DEFAULT_LANDING_DEPTH = 1.2;
const HEAD_CLEARANCE = 2.1;

export const STAIR_SCOPES = Object.freeze({
  FLOOR: "FLOOR",
  CONNECTING: "CONNECTING",
  ALL_FLOORS: "ALL_FLOORS",
});

export function getOrderedBuildingFloors(floors, buildingId) {
  return floors
    .filter((floor) => !buildingId || floor.parentId === buildingId)
    .sort((left, right) => (left.elevation ?? left.level ?? 0) - (right.elevation ?? right.level ?? 0));
}

export function getStairValues(stair) {
  const parameters = stair.parameters ?? {};
  return {
    type: stair.stairType ?? "STRAIGHT",
    width: Math.max(0.1, Number(stair.width ?? parameters.width) || 1.2),
    treadDepth: Math.max(0.05, Number(stair.treadDepth ?? parameters.treadDepth) || DEFAULT_TREAD_DEPTH),
    riserHeight: Math.max(0.05, Number(stair.riserHeight ?? parameters.riserHeight) || DEFAULT_RISER_HEIGHT),
    landingDepth: Math.max(0.1, Number(stair.landingDepth ?? parameters.landingDepth) || DEFAULT_LANDING_DEPTH),
  };
}

export function normalizeStairOwnership(stair, floors, currentFloorId = null) {
  const ordered = getOrderedBuildingFloors(floors, stair.buildingId);
  const validIds = new Set(ordered.map((floor) => floor.id));
  const legacyMode = stair.applicationScope?.mode;
  const inferredScope = legacyMode === "ALL"
    ? STAIR_SCOPES.ALL_FLOORS
    : (stair.fromFloorId ?? stair.startFloorId ?? stair.applicationScope?.startFloorId)
        !== (stair.toFloorId ?? stair.endFloorId ?? stair.applicationScope?.endFloorId)
      ? STAIR_SCOPES.CONNECTING
      : STAIR_SCOPES.FLOOR;
  const scope = Object.values(STAIR_SCOPES).includes(stair.scope) ? stair.scope : inferredScope;
  const fallbackFloorId = validIds.has(currentFloorId) ? currentFloorId : ordered[0]?.id ?? null;
  let fromFloorId = stair.fromFloorId ?? stair.startFloorId ?? stair.floorId
    ?? stair.applicationScope?.startFloorId ?? fallbackFloorId;
  if (!validIds.has(fromFloorId)) fromFloorId = fallbackFloorId;
  const fromIndex = Math.max(0, ordered.findIndex((floor) => floor.id === fromFloorId));

  if (scope === STAIR_SCOPES.ALL_FLOORS) {
    const connectedFloorIds = ordered.map((floor) => floor.id);
    return {
      ...stair,
      scope,
      floorId: connectedFloorIds[0] ?? null,
      fromFloorId: connectedFloorIds[0] ?? null,
      toFloorId: connectedFloorIds.at(-1) ?? null,
      startFloorId: connectedFloorIds[0] ?? null,
      endFloorId: connectedFloorIds.at(-1) ?? null,
      servedFloorIds: connectedFloorIds,
      applicationScope: { mode: "ALL", startFloorId: connectedFloorIds[0] ?? null, endFloorId: connectedFloorIds.at(-1) ?? null, floorIds: [], connectedFloorIds },
    };
  }

  if (scope === STAIR_SCOPES.FLOOR || ordered.length < 2) {
    const connectedFloorIds = fromFloorId ? [fromFloorId] : [];
    return {
      ...stair,
      scope: STAIR_SCOPES.FLOOR,
      floorId: fromFloorId,
      fromFloorId,
      toFloorId: fromFloorId,
      startFloorId: fromFloorId,
      endFloorId: fromFloorId,
      servedFloorIds: connectedFloorIds,
      applicationScope: { mode: "CURRENT", startFloorId: fromFloorId, endFloorId: fromFloorId, floorIds: [], connectedFloorIds },
    };
  }

  let toFloorId = stair.toFloorId ?? stair.endFloorId ?? stair.applicationScope?.endFloorId;
  if (!validIds.has(toFloorId) || toFloorId === fromFloorId) toFloorId = ordered[Math.min(fromIndex + 1, ordered.length - 1)]?.id;
  const toIndex = ordered.findIndex((floor) => floor.id === toFloorId);
  const lowerIndex = Math.min(fromIndex, toIndex);
  const upperIndex = Math.max(fromIndex, toIndex);
  fromFloorId = ordered[lowerIndex]?.id ?? fallbackFloorId;
  toFloorId = ordered[upperIndex]?.id ?? fromFloorId;
  const connectedFloorIds = ordered.slice(lowerIndex, upperIndex + 1).map((floor) => floor.id);
  return {
    ...stair,
    scope: STAIR_SCOPES.CONNECTING,
    floorId: fromFloorId,
    fromFloorId,
    toFloorId,
    startFloorId: fromFloorId,
    endFloorId: toFloorId,
    servedFloorIds: connectedFloorIds,
    applicationScope: { mode: "RANGE", startFloorId: fromFloorId, endFloorId: toFloorId, floorIds: [], connectedFloorIds },
  };
}

export function getStairServedFloorIds(stair, floors) {
  const normalized = normalizeStairOwnership(stair, floors);
  const ordered = getOrderedBuildingFloors(floors, normalized.buildingId);
  if (normalized.scope === STAIR_SCOPES.FLOOR) return normalized.floorId ? [normalized.floorId] : [];
  const startFloorId = normalized.fromFloorId;
  const endFloorId = normalized.toFloorId;
  const startIndex = ordered.findIndex((floor) => floor.id === startFloorId);
  const endIndex = ordered.findIndex((floor) => floor.id === endFloorId);
  if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex) return [];
  return ordered.slice(startIndex, endIndex + 1).map((floor) => floor.id);
}

function createLocalFloorSegment(stair, floor, nextFloor) {
  const values = getStairValues(stair);
  const floorHeight = Math.max(0.5, Number(stair.parameters?.height) || ((nextFloor?.elevation ?? 0) - (floor?.elevation ?? 0)) || 3);
  const riserCount = Math.max(2, Math.ceil(floorHeight / values.riserHeight));
  return {
    id: `${stair.id}:${floor.id}:LOCAL`, stairId: stair.id,
    lowerFloorId: floor.id, upperFloorId: floor.id,
    lowerY: floor.elevation ?? 0, upperY: (floor.elevation ?? 0) + floorHeight,
    floorHeight, riserCount, actualRiserHeight: floorHeight / riserCount,
    runLength: values.treadDepth * (riserCount - 1), ...values,
  };
}

export function getStairRenderInstances(stair, floors) {
  const normalized = normalizeStairOwnership(stair, floors);
  const ordered = getOrderedBuildingFloors(floors, normalized.buildingId);
  if (normalized.scope === STAIR_SCOPES.ALL_FLOORS) {
    return ordered.map((floor, index) => ({
      id: `${stair.id}:RENDER:${floor.id}`,
      renderFloorId: floor.id,
      fromFloorId: floor.id,
      toFloorId: floor.id,
      segments: [createLocalFloorSegment(normalized, floor, ordered[index + 1])],
    }));
  }
  if (normalized.scope === STAIR_SCOPES.FLOOR) {
    const floor = ordered.find((item) => item.id === normalized.floorId);
    if (!floor) return [];
    return [{ id: `${stair.id}:RENDER:${floor.id}`, renderFloorId: floor.id, fromFloorId: floor.id, toFloorId: floor.id, segments: [createLocalFloorSegment(normalized, floor, ordered[ordered.indexOf(floor) + 1])] }];
  }
  return [{
    id: `${stair.id}:RENDER:${normalized.fromFloorId}`,
    renderFloorId: normalized.fromFloorId,
    fromFloorId: normalized.fromFloorId,
    toFloorId: normalized.toFloorId,
    segments: getStairSegments(normalized, ordered),
  }];
}

export function getStairSegments(stair, floors) {
  if (stair?.type !== "STAIR") return [];
  const ordered = getOrderedBuildingFloors(floors, stair.buildingId);
  const servedIds = getStairServedFloorIds(stair, ordered);
  const values = getStairValues(stair);
  return servedIds.slice(0, -1).map((floorId, index) => {
    const lowerFloor = ordered.find((floor) => floor.id === floorId);
    const upperFloor = ordered.find((floor) => floor.id === servedIds[index + 1]);
    const floorHeight = Math.max(0, (upperFloor?.elevation ?? 0) - (lowerFloor?.elevation ?? 0));
    const riserCount = Math.max(2, Math.ceil(floorHeight / values.riserHeight));
    const actualRiserHeight = floorHeight / riserCount;
    const runLength = values.treadDepth * (riserCount - 1);
    return {
      id: `${stair.id}:${lowerFloor.id}:${upperFloor.id}`,
      stairId: stair.id,
      lowerFloorId: lowerFloor.id,
      upperFloorId: upperFloor.id,
      lowerY: lowerFloor.elevation ?? 0,
      upperY: upperFloor.elevation ?? 0,
      floorHeight,
      riserCount,
      actualRiserHeight,
      runLength,
      ...values,
    };
  });
}

export function getStairPlanSize(stair, floors) {
  const segments = getStairRenderInstances(stair, floors).flatMap((instance) => instance.segments);
  const values = getStairValues(stair);
  return {
    width: values.width,
    depth: Math.max(values.landingDepth, ...segments.map((segment) => segment.runLength + values.landingDepth)),
  };
}

export function getStairOpeningForFloor(stair, floors, floorId) {
  const segment = getStairSegments(stair, floors).find((item) => item.upperFloorId === floorId);
  if (!segment) return null;
  const clearanceTreads = Math.max(2, Math.ceil(HEAD_CLEARANCE / Math.max(segment.actualRiserHeight, 0.01)));
  const depth = Math.min(segment.runLength, segment.landingDepth + segment.treadDepth * clearanceTreads);
  const localZ = segment.runLength / 2 - depth / 2;
  const rotation = stair.rotation?.y ?? 0;
  return {
    id: `${stair.id}:OPENING:${floorId}`,
    sourceStructureId: stair.id,
    floorId,
    x: stair.position.x - Math.sin(rotation) * localZ,
    z: stair.position.z + Math.cos(rotation) * localZ,
    width: segment.width + 0.12,
    depth,
    rotation,
  };
}

export function getVerticalStructureOpeningForFloor(structure, floors, floorId, dimensions) {
  if (structure.type === "STAIR") return getStairOpeningForFloor(structure, floors, floorId);
  if (!structure.applicationScope?.connectedFloorIds?.includes(floorId)) return null;
  return {
    id: `${structure.id}:OPENING:${floorId}`,
    sourceStructureId: structure.id,
    floorId,
    x: structure.position.x,
    z: structure.position.z,
    width: dimensions.width,
    depth: dimensions.depth,
    rotation: structure.rotation?.y ?? 0,
  };
}

function rotatedBounds(structure, width, depth) {
  const rotation = structure.rotation?.y ?? 0;
  return {
    x: structure.position.x,
    z: structure.position.z,
    width: Math.abs(Math.cos(rotation)) * width + Math.abs(Math.sin(rotation)) * depth,
    depth: Math.abs(Math.sin(rotation)) * width + Math.abs(Math.cos(rotation)) * depth,
  };
}

function overlaps(left, right, gap = 0.05) {
  return Math.abs(left.x - right.x) * 2 < left.width + right.width + gap
    && Math.abs(left.z - right.z) * 2 < left.depth + right.depth + gap;
}

export function validateStairStructure(stair, floors, building, obstacles = []) {
  const values = getStairValues(stair);
  if (values.type !== "STRAIGHT") return "현재는 직선형 계단만 배치할 수 있습니다.";
  if (values.width < MIN_STAIR_WIDTH) return `계단 폭은 ${MIN_STAIR_WIDTH}m 이상이어야 합니다.`;
  if (values.treadDepth < MIN_TREAD_DEPTH) return `디딤판 깊이는 ${MIN_TREAD_DEPTH}m 이상이어야 합니다.`;
  if (values.riserHeight < MIN_RISER_HEIGHT || values.riserHeight > MAX_RISER_HEIGHT) return `목표 단높이는 ${MIN_RISER_HEIGHT}~${MAX_RISER_HEIGHT}m 범위여야 합니다.`;
  const segments = getStairRenderInstances(stair, floors).flatMap((instance) => instance.segments);
  if (!segments.length || segments.some((segment) => segment.floorHeight <= 0)) return "계단을 배치할 유효한 층 높이가 필요합니다.";
  const size = getStairPlanSize(stair, floors);
  const bounds = rotatedBounds(stair, size.width, size.depth);
  const footprintWidth = Math.max(0, Number(building?.parameters?.width) || 0);
  const footprintDepth = Math.max(0, Number(building?.parameters?.depth) || 0);
  if (Math.abs(bounds.x) + bounds.width / 2 > footprintWidth / 2 || Math.abs(bounds.z) + bounds.depth / 2 > footprintDepth / 2) {
    return "계단 또는 도착 개구부가 건축물 footprint를 벗어납니다.";
  }
  const collision = obstacles.find((obstacle) => {
    if (!obstacle || obstacle.id === stair.id) return false;
    const parameters = obstacle.parameters ?? {};
    const obstacleSize = obstacle.type === "STAIR"
      ? getStairPlanSize(obstacle, floors)
      : { width: Number(parameters.width ?? parameters.length) || 1, depth: Number(parameters.depth ?? parameters.thickness) || 1 };
    return overlaps(bounds, rotatedBounds(obstacle, obstacleSize.width, obstacleSize.depth));
  });
  return collision ? `${collision.name ?? collision.type}과(와) 충돌하여 계단을 배치할 수 없습니다.` : "";
}
