export const GROUND_VIEW_MODES = Object.freeze({
  VISIBLE: "VISIBLE",
  TRANSLUCENT: "TRANSLUCENT",
  SECTION: "SECTION",
  HIDDEN: "HIDDEN",
});

export const UNDERGROUND_ASSET_KINDS = new Set(["UNDERGROUND_ACCESS", "UNDERGROUND_PATH"]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeGroundViewMode(value) {
  return Object.values(GROUND_VIEW_MODES).includes(value) ? value : GROUND_VIEW_MODES.VISIBLE;
}

export function getBasementFloorCount(building) {
  return Math.min(20, Math.max(0, Math.round(finite(building?.parameters?.basementFloorCount, 0))));
}

export function getBasementFloorHeight(building) {
  return Math.max(2, finite(building?.parameters?.basementFloorHeight, building?.parameters?.floorHeight ?? 3.6));
}

export function formatFloorLevel(level) {
  const numeric = Math.trunc(finite(level, 1));
  return numeric < 0 ? `B${Math.abs(numeric)}` : `${Math.max(1, numeric)}F`;
}

export function isUndergroundSiteObject(object) {
  return UNDERGROUND_ASSET_KINDS.has(object?.assetKind);
}

export function createUndergroundConnection(object, buildings = [], floors = []) {
  if (!isUndergroundSiteObject(object)) return object?.undergroundConnection ?? null;
  const candidates = buildings
    .map((building) => {
      const basementFloors = floors
        .filter((floor) => floor.parentId === building.id && Number(floor.level) < 0)
        .sort((left, right) => Number(right.level) - Number(left.level));
      const distance = Math.hypot(
        finite(building.position?.x) - finite(object.position?.x),
        finite(building.position?.z) - finite(object.position?.z),
      );
      return { building, basementFloors, distance };
    })
    .filter((candidate) => candidate.basementFloors.length)
    .sort((left, right) => left.distance - right.distance);
  const target = candidates[0];
  const targetFloor = target?.basementFloors[0] ?? null;
  const previous = object.undergroundConnection ?? {};
  const start = previous.startPoint ?? { x: finite(object.position?.x), y: 0, z: finite(object.position?.z) };
  const end = previous.endPoint ?? {
    x: finite(object.position?.x),
    y: finite(targetFloor?.elevation, -getBasementFloorHeight(target?.building)),
    z: finite(object.position?.z) - Math.max(2, finite(object.dimensions?.depth, 4) * 0.65),
  };
  return {
    id: previous.id ?? `UNDERGROUND_CONNECTION_${crypto.randomUUID()}`,
    targetBuildingId: previous.targetBuildingId ?? target?.building.id ?? null,
    targetFloorId: previous.targetFloorId ?? targetFloor?.id ?? null,
    startPoint: { ...start },
    endPoint: { ...end },
    openingWidth: Math.max(0.6, finite(previous.openingWidth, object.dimensions?.width ?? 2)),
    openingLength: Math.max(0.8, finite(previous.openingLength, object.dimensions?.depth ?? 3)),
  };
}

export function collectTerrainExcavations(buildings = [], floors = [], siteObjects = []) {
  const excavations = [];
  buildings.forEach((building) => {
    const basementFloors = floors.filter((floor) => floor.parentId === building.id && Number(floor.level) < 0);
    if (!basementFloors.length) return;
    const bottom = Math.min(...basementFloors.map((floor) => finite(floor.elevation)));
    excavations.push({
      id: `BUILDING_EXCAVATION_${building.id}`,
      center: { x: finite(building.position?.x), z: finite(building.position?.z) },
      width: Math.max(1, finite(building.parameters?.width, 10) + 0.5),
      depth: Math.max(1, finite(building.parameters?.depth, 10) + 0.5),
      bottom,
      rotationY: finite(building.rotation?.y),
    });
  });
  siteObjects.filter(isUndergroundSiteObject).forEach((object) => {
    const connection = object.undergroundConnection;
    if (!connection) return;
    const start = connection.startPoint;
    const end = connection.endPoint;
    excavations.push({
      id: `OBJECT_EXCAVATION_${object.id}`,
      center: { x: (finite(start?.x) + finite(end?.x)) / 2, z: (finite(start?.z) + finite(end?.z)) / 2 },
      width: Math.max(0.8, finite(connection.openingWidth, object.dimensions?.width)),
      depth: Math.max(1, finite(connection.openingLength, Math.hypot(finite(end?.x) - finite(start?.x), finite(end?.z) - finite(start?.z)))),
      bottom: Math.min(finite(start?.y), finite(end?.y)),
      rotationY: finite(object.rotation?.y),
    });
  });
  return excavations;
}

export function isPointInsideExcavation(x, z, excavation, padding = 0) {
  const dx = x - finite(excavation?.center?.x);
  const dz = z - finite(excavation?.center?.z);
  const angle = -finite(excavation?.rotationY);
  const localX = dx * Math.cos(angle) - dz * Math.sin(angle);
  const localZ = dx * Math.sin(angle) + dz * Math.cos(angle);
  return Math.abs(localX) < Math.max(0, finite(excavation?.width) / 2 - padding)
    && Math.abs(localZ) < Math.max(0, finite(excavation?.depth) / 2 - padding);
}
