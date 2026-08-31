export const OUTDOOR_PLACEMENT_MODES = Object.freeze({
  GROUND: "GROUND",
  ROOF: "ROOF",
  WALL: "WALL",
  UNDERGROUND: "UNDERGROUND",
  ROAD_EDGE: "ROAD_EDGE",
});

const rotateToLocal = (position, building) => {
  const angle = -(building.rotation?.y ?? 0);
  const dx = position.x - building.position.x;
  const dz = position.z - building.position.z;
  return { x: dx * Math.cos(angle) - dz * Math.sin(angle), z: dx * Math.sin(angle) + dz * Math.cos(angle) };
};

const rotateToWorld = (local, building) => {
  const angle = building.rotation?.y ?? 0;
  return {
    x: building.position.x + local.x * Math.cos(angle) - local.z * Math.sin(angle),
    z: building.position.z + local.x * Math.sin(angle) + local.z * Math.cos(angle),
  };
};

const buildingHeight = (building) => Math.max(0, Number(building.parameters?.floorCount) || 1) * Math.max(0, Number(building.parameters?.floorHeight) || 0);

function nearestBuilding(position, buildings, snapDistance = 1.5) {
  let match = null;
  buildings.forEach((building) => {
    const local = rotateToLocal(position, building);
    const halfWidth = (building.parameters?.width ?? 0) / 2;
    const halfDepth = (building.parameters?.depth ?? 0) / 2;
    const inside = Math.abs(local.x) <= halfWidth && Math.abs(local.z) <= halfDepth;
    const edgeDistance = Math.min(Math.abs(Math.abs(local.x) - halfWidth), Math.abs(Math.abs(local.z) - halfDepth));
    if ((inside || edgeDistance <= snapDistance) && (!match || edgeDistance < match.edgeDistance)) match = { building, local, inside, edgeDistance, halfWidth, halfDepth };
  });
  return match;
}

function snapToRoadEdge(position, siteObjects) {
  let closest = null;
  siteObjects.filter((item) => item.profile === "ROAD").forEach((road) => {
    const halfWidth = road.dimensions.width / 2;
    const halfDepth = road.dimensions.depth / 2;
    const dx = position.x - road.position.x;
    const dz = position.z - road.position.z;
    const alongX = road.dimensions.width >= road.dimensions.depth;
    const candidate = alongX
      ? { x: Math.max(-halfWidth, Math.min(halfWidth, dx)) + road.position.x, z: road.position.z + Math.sign(dz || 1) * (halfDepth + 0.8) }
      : { x: road.position.x + Math.sign(dx || 1) * (halfWidth + 0.8), z: Math.max(-halfDepth, Math.min(halfDepth, dz)) + road.position.z };
    const distance = Math.hypot(candidate.x - position.x, candidate.z - position.z);
    if (!closest || distance < closest.distance) closest = { ...candidate, distance, roadId: road.id };
  });
  return closest;
}

export function resolveOutdoorEquipmentPlacement(object, buildings = [], siteObjects = [], preferredMode = "AUTO") {
  if (object.categoryId !== "OUTDOOR_EQUIPMENT") return object;
  const allowed = object.placementRules?.allowedModes ?? [OUTDOOR_PLACEMENT_MODES.GROUND];
  const currentMode = preferredMode === "AUTO" ? object.placement?.mode : preferredMode;
  const nearby = nearestBuilding(object.position, buildings, object.placementRules?.snapDistance ?? 1.5);
  let mode = allowed.includes(currentMode) ? currentMode : null;
  if (!mode && nearby?.inside && allowed.includes(OUTDOOR_PLACEMENT_MODES.ROOF)) mode = OUTDOOR_PLACEMENT_MODES.ROOF;
  if (!mode && nearby && allowed.includes(OUTDOOR_PLACEMENT_MODES.WALL)) mode = OUTDOOR_PLACEMENT_MODES.WALL;
  if (!mode && allowed.includes(OUTDOOR_PLACEMENT_MODES.ROAD_EDGE)) {
    const roadEdge = snapToRoadEdge(object.position, siteObjects);
    if (roadEdge && roadEdge.distance <= (object.placementRules?.roadSnapDistance ?? 4)) {
      return { ...object, position: { ...object.position, x: roadEdge.x, y: 0, z: roadEdge.z }, placement: { mode: OUTDOOR_PLACEMENT_MODES.ROAD_EDGE, roadId: roadEdge.roadId, buildingId: null, localPosition: null } };
    }
  }
  mode ??= allowed.includes(OUTDOOR_PLACEMENT_MODES.GROUND) ? OUTDOOR_PLACEMENT_MODES.GROUND : allowed[0];

  if ([OUTDOOR_PLACEMENT_MODES.ROOF, OUTDOOR_PLACEMENT_MODES.WALL].includes(mode) && nearby) {
    const { building, halfWidth, halfDepth } = nearby;
    const local = { ...nearby.local };
    let rotationY = object.rotation?.y ?? 0;
    let y = building.position.y + buildingHeight(building);
    if (mode === OUTDOOR_PLACEMENT_MODES.WALL) {
      const xEdge = Math.abs(Math.abs(local.x) - halfWidth) <= Math.abs(Math.abs(local.z) - halfDepth);
      if (xEdge) { local.x = Math.sign(local.x || 1) * (halfWidth + object.dimensions.depth / 2); rotationY = (building.rotation?.y ?? 0) + Math.sign(local.x) * Math.PI / 2; }
      else { local.z = Math.sign(local.z || 1) * (halfDepth + object.dimensions.depth / 2); rotationY = (building.rotation?.y ?? 0) + (local.z < 0 ? Math.PI : 0); }
      y = building.position.y + Math.max(object.dimensions.height / 2, buildingHeight(building) * 0.55);
    }
    const world = rotateToWorld(local, building);
    const relativeY = y - building.position.y;
    return {
      ...object,
      position: { x: world.x, y, z: world.z },
      rotation: { ...object.rotation, y: rotationY },
      placement: {
        mode,
        buildingId: building.id,
        localPosition: { x: local.x, y: relativeY, z: local.z },
        ...(mode === OUTDOOR_PLACEMENT_MODES.WALL
          ? { heightRatio: relativeY / Math.max(0.01, buildingHeight(building)) }
          : {}),
      },
    };
  }

  const y = mode === OUTDOOR_PLACEMENT_MODES.UNDERGROUND ? -Math.max(0.2, object.dimensions.height * 0.75) : 0;
  return { ...object, position: { ...object.position, y }, placement: { mode, buildingId: null, localPosition: null } };
}

export function moveAttachedOutdoorEquipment(object, previousBuilding, nextBuilding) {
  if (object.placement?.buildingId !== nextBuilding.id || !object.placement.localPosition) return object;
  const local = object.placement.localPosition;
  const world = rotateToWorld(local, nextBuilding);
  const heightDelta = buildingHeight(nextBuilding) - buildingHeight(previousBuilding);
  const isRoof = object.placement.mode === OUTDOOR_PLACEMENT_MODES.ROOF;
  const isWall = object.placement.mode === OUTDOOR_PLACEMENT_MODES.WALL;
  const nextLocalY = isRoof
    ? local.y + heightDelta
    : isWall
      ? buildingHeight(nextBuilding) * (object.placement.heightRatio ?? local.y / Math.max(0.01, buildingHeight(previousBuilding)))
      : local.y;
  return {
    ...object,
    position: { x: world.x, y: nextBuilding.position.y + nextLocalY, z: world.z },
    rotation: { ...object.rotation, y: (object.rotation?.y ?? 0) + (nextBuilding.rotation?.y ?? 0) - (previousBuilding.rotation?.y ?? 0) },
    placement: { ...object.placement, localPosition: { ...local, y: nextLocalY } },
  };
}
