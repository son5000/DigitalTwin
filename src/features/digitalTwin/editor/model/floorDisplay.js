export function sortFloorsByLevel(floors = []) {
  return [...floors].sort((left, right) => (
    (Number(left.level) || 0) - (Number(right.level) || 0)
    || (Number(left.elevation) || 0) - (Number(right.elevation) || 0)
    || String(left.id).localeCompare(String(right.id))
  ));
}

export function normalizeFloorDisplayGap(value, maximum = 12) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(maximum, Math.max(0, numeric));
}

export function createFloorDisplayOffsets(floors, floorDisplayGap) {
  const gap = normalizeFloorDisplayGap(floorDisplayGap);
  return new Map(sortFloorsByLevel(floors).map((floor) => {
    const level = Number(floor.level) || 1;
    return [floor.id, level < 0 ? level * gap : Math.max(0, level - 1) * gap];
  }));
}

export function resolveFloorOwnerId(entity, floors, fallbackFloorId = null) {
  const orderedFloors = sortFloorsByLevel(floors);
  const explicit = entity?.startFloorId ?? entity?.applicationScope?.startFloorId ?? entity?.floorId;
  if (explicit && orderedFloors.some((floor) => floor.id === explicit)) return explicit;
  const connected = new Set(entity?.applicationScope?.connectedFloorIds ?? entity?.servedFloorIds ?? []);
  return orderedFloors.find((floor) => connected.has(floor.id))?.id ?? fallbackFloorId;
}

export function formatFloorOptionLabel(floor, fallbackLevel = 1) {
  const level = Number.isFinite(Number(floor?.level)) ? Number(floor.level) : fallbackLevel;
  return level < 0 ? `B${Math.abs(level)}` : `${level}F`;
}
