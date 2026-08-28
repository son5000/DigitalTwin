import { getBuildingFloorFootprintRegions, getBuildingFootprint } from "../utils/buildingFootprint.js";

export const FLOOR_SPATIAL_VERSION = 1;
export const FLOOR_FOOTPRINT_MODES = Object.freeze({
  INHERIT_BUILDING: "INHERIT_BUILDING",
  CUSTOM: "CUSTOM",
});
export const ELEVATION_ZONE_SURFACES = Object.freeze({ FLAT: "FLAT", SLOPED: "SLOPED" });
export const ELEVATION_EDGE_TREATMENTS = Object.freeze({
  STEP: "STEP",
  STAIR: "STAIR",
  RAMP: "RAMP",
  VERTICAL_FACE: "VERTICAL_FACE",
  OPEN: "OPEN",
});
export const ROOM_EDIT_MODES = Object.freeze({ SHAPE: "SHAPE", WALL_DETAIL: "WALL_DETAIL" });

const EPSILON = 1e-6;
const MIN_EDGE_LENGTH = 0.2;
const MAX_SAFE_STEP = 0.3;
const MAX_SAFE_SLOPE = 1 / 12;

function createId(prefix) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function point(source = {}) {
  return { x: finite(source.x), z: finite(source.z), ...(source.curveToNext ? { curveToNext: source.curveToNext } : {}) };
}

function cloneRing(points = []) {
  return points.map(point);
}

function rectangle(width = 8, depth = 6, center = { x: 0, z: 0 }) {
  const halfWidth = Math.max(0.5, finite(width, 8)) / 2;
  const halfDepth = Math.max(0.5, finite(depth, 6)) / 2;
  return [
    { x: center.x - halfWidth, z: center.z - halfDepth },
    { x: center.x + halfWidth, z: center.z - halfDepth },
    { x: center.x + halfWidth, z: center.z + halfDepth },
    { x: center.x - halfWidth, z: center.z + halfDepth },
  ];
}

export function polygonSignedArea(points = []) {
  return points.reduce((sum, current, index) => {
    const next = points[(index + 1) % points.length];
    return sum + current.x * next.z - next.x * current.z;
  }, 0) / 2;
}

export function polygonArea(points = []) {
  return Math.abs(polygonSignedArea(points));
}

export function pointInsideRing(target, points = []) {
  const onBoundary = points.some((current, index) => {
    const next = points[(index + 1) % points.length];
    const length = Math.hypot(next.x - current.x, next.z - current.z);
    if (length < EPSILON) return false;
    const crossValue = Math.abs((target.x - current.x) * (next.z - current.z) - (target.z - current.z) * (next.x - current.x));
    const dot = (target.x - current.x) * (next.x - current.x) + (target.z - current.z) * (next.z - current.z);
    return crossValue / length < EPSILON && dot >= -EPSILON && dot <= length * length + EPSILON;
  });
  if (onBoundary) return true;
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const current = points[index];
    const prior = points[previous];
    if ((current.z > target.z) !== (prior.z > target.z)
      && target.x < (prior.x - current.x) * (target.z - current.z) / ((prior.z - current.z) || EPSILON) + current.x) inside = !inside;
  }
  return inside;
}

export function pointInsideFootprint(target, footprint) {
  return (footprint?.regions ?? []).some((region) => (
    pointInsideRing(target, region.outer)
    && !(region.holes ?? []).some((hole) => pointInsideRing(target, hole))
  ));
}

function orientation(a, b, c) {
  const value = (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z);
  return Math.abs(value) < EPSILON ? 0 : Math.sign(value);
}

function segmentsIntersect(a, b, c, d) {
  return orientation(a, b, c) !== orientation(a, b, d) && orientation(c, d, a) !== orientation(c, d, b);
}

function hasSelfIntersection(points) {
  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length;
    for (let other = index + 1; other < points.length; other += 1) {
      const otherNext = (other + 1) % points.length;
      if (index === other || nextIndex === other || otherNext === index) continue;
      if (segmentsIntersect(points[index], points[nextIndex], points[other], points[otherNext])) return true;
    }
  }
  return false;
}

function validateRing(points, path, issues) {
  if (!Array.isArray(points) || points.length < 3) {
    issues.push({ severity: "error", code: "TOO_FEW_VERTICES", path, message: "영역은 최소 3개의 꼭짓점이 필요합니다." });
    return;
  }
  if (points.some((item, index) => Math.hypot(
    points[(index + 1) % points.length].x - item.x,
    points[(index + 1) % points.length].z - item.z,
  ) < MIN_EDGE_LENGTH)) issues.push({ severity: "error", code: "SHORT_EDGE", path, message: `모든 변은 ${MIN_EDGE_LENGTH}m 이상이어야 합니다.` });
  if (hasSelfIntersection(points)) issues.push({ severity: "error", code: "SELF_INTERSECTION", path, message: "영역 외곽선이 자기 교차합니다." });
  if (polygonArea(points) < EPSILON) issues.push({ severity: "error", code: "ZERO_AREA", path, message: "영역 면적이 0입니다." });
}

export function validateFloorFootprint(footprint) {
  const issues = [];
  if (!(footprint?.regions?.length > 0)) return [{ severity: "error", code: "NO_REGION", path: "floorFootprint.regions", message: "바닥 영역이 없습니다." }];
  footprint.regions.forEach((region, regionIndex) => {
    validateRing(region.outer, `floorFootprint.regions.${regionIndex}.outer`, issues);
    (region.holes ?? []).forEach((hole, holeIndex) => {
      const path = `floorFootprint.regions.${regionIndex}.holes.${holeIndex}`;
      validateRing(hole, path, issues);
      if (hole.some((item) => !pointInsideRing(item, region.outer))) issues.push({ severity: "error", code: "INVALID_HOLE", path, message: "내부 중정은 바닥 외곽선 안에 있어야 합니다." });
    });
  });
  return issues;
}

function boundsForRegions(regions) {
  const points = regions.flatMap((region) => region.outer);
  const xs = points.map((item) => item.x);
  const zs = points.map((item) => item.z);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs),
    width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs),
  };
}

function buildingRegions(building) {
  const inherited = building?.floorFootprint ?? building?.parameters?.footprint;
  if (inherited?.regions?.length) return inherited.regions.map(normalizeRegion);
  if (inherited?.points?.length) return [normalizeRegion({ outer: inherited.points, holes: inherited.holes })];
  const regions = getBuildingFloorFootprintRegions(building, building?.__floorLevel ?? 1);
  if (regions.length) return regions.map((region) => normalizeRegion({ id: region.id, outer: region.points, holes: region.holes }));
  const footprint = getBuildingFootprint(building);
  return [normalizeRegion({ outer: footprint.points, holes: footprint.holes })];
}

function normalizeRegion(region = {}) {
  return {
    id: region.id ?? createId("FLOOR_REGION"),
    outer: cloneRing(region.outer ?? region.points ?? []),
    holes: (region.holes ?? []).map(cloneRing),
  };
}

export function createInheritedFloorFootprint(building) {
  const regions = buildingRegions(building);
  return {
    id: createId("FLOOR_FOOTPRINT"),
    mode: FLOOR_FOOTPRINT_MODES.INHERIT_BUILDING,
    regions,
    revision: 1,
  };
}

export function normalizeFloorFootprint(source, building) {
  if (!source) return createInheritedFloorFootprint(building);
  const regions = source.regions?.length
    ? source.regions.map(normalizeRegion)
    : source.points?.length
      ? [normalizeRegion({ outer: source.points, holes: source.holes })]
      : buildingRegions(building);
  return {
    id: source.id ?? createId("FLOOR_FOOTPRINT"),
    mode: source.mode === FLOOR_FOOTPRINT_MODES.CUSTOM ? FLOOR_FOOTPRINT_MODES.CUSTOM : FLOOR_FOOTPRINT_MODES.INHERIT_BUILDING,
    regions,
    revision: Math.max(1, Math.round(finite(source.revision, 1))),
  };
}

function editableFootprint(source) {
  return { ...source, mode: FLOOR_FOOTPRINT_MODES.CUSTOM, revision: source.revision + 1 };
}

export function updateFootprintVertex(footprint, regionId, ringType, ringIndex, vertexIndex, nextPoint) {
  const next = editableFootprint(footprint);
  next.regions = next.regions.map((region) => {
    if (region.id !== regionId) return region;
    const target = ringType === "HOLE" ? region.holes[ringIndex] : region.outer;
    const updated = target.map((item, index) => index === vertexIndex ? {
      ...item,
      ...point(nextPoint),
      ...(Object.hasOwn(nextPoint, "curveToNext") ? { curveToNext: nextPoint.curveToNext } : {}),
    } : item);
    return ringType === "HOLE"
      ? { ...region, holes: region.holes.map((hole, index) => index === ringIndex ? updated : hole) }
      : { ...region, outer: updated };
  });
  return next;
}

export function addFootprintVertex(footprint, regionId) {
  const next = editableFootprint(footprint);
  next.regions = next.regions.map((region) => {
    if (region.id !== regionId || region.outer.length < 2) return region;
    let longestIndex = 0;
    let longest = -1;
    region.outer.forEach((item, index) => {
      const target = region.outer[(index + 1) % region.outer.length];
      const length = Math.hypot(target.x - item.x, target.z - item.z);
      if (length > longest) { longest = length; longestIndex = index; }
    });
    const current = region.outer[longestIndex];
    const target = region.outer[(longestIndex + 1) % region.outer.length];
    const outer = [...region.outer];
    outer.splice(longestIndex + 1, 0, { x: (current.x + target.x) / 2, z: (current.z + target.z) / 2 });
    return { ...region, outer };
  });
  return next;
}

export function removeFootprintVertex(footprint, regionId, vertexIndex) {
  const region = footprint.regions.find((item) => item.id === regionId);
  if (!region || region.outer.length <= 3) return footprint;
  const next = editableFootprint(footprint);
  next.regions = next.regions.map((item) => item.id === regionId ? { ...item, outer: item.outer.filter((_, index) => index !== vertexIndex) } : item);
  return next;
}

export function addFootprintRegion(footprint, area = {}) {
  const next = editableFootprint(footprint);
  const bounds = boundsForRegions(next.regions);
  const width = area.width ?? Math.max(2, bounds.width * 0.35);
  const depth = area.depth ?? Math.max(2, bounds.depth * 0.35);
  const center = area.center ?? { x: bounds.maxX + width * 0.65, z: 0 };
  next.regions = [...next.regions, normalizeRegion({ outer: area.outer ?? rectangle(width, depth, center), holes: area.holes })];
  return next;
}

export function addFootprintHole(footprint, regionId, holePoints) {
  const next = editableFootprint(footprint);
  next.regions = next.regions.map((region) => {
    if (region.id !== regionId) return region;
    const xs = region.outer.map((item) => item.x);
    const zs = region.outer.map((item) => item.z);
    const width = (Math.max(...xs) - Math.min(...xs)) * 0.3;
    const depth = (Math.max(...zs) - Math.min(...zs)) * 0.3;
    const center = { x: (Math.max(...xs) + Math.min(...xs)) / 2, z: (Math.max(...zs) + Math.min(...zs)) / 2 };
    return { ...region, holes: [...region.holes, cloneRing(holePoints ?? rectangle(width, depth, center).reverse())] };
  });
  return next;
}

function cross(origin, a, b) {
  return (a.x - origin.x) * (b.z - origin.z) - (a.z - origin.z) * (b.x - origin.x);
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  if (sorted.length <= 3) return sorted;
  const lower = [];
  sorted.forEach((item) => { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), item) <= 0) lower.pop(); lower.push(item); });
  const upper = [];
  [...sorted].reverse().forEach((item) => { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), item) <= 0) upper.pop(); upper.push(item); });
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function mergeFootprintRegions(footprint, regionIds) {
  const selected = footprint.regions.filter((region) => regionIds.includes(region.id));
  if (selected.length < 2) return footprint;
  const merged = normalizeRegion({ outer: convexHull(selected.flatMap((region) => region.outer)), holes: selected.flatMap((region) => region.holes) });
  const next = editableFootprint(footprint);
  next.regions = [...next.regions.filter((region) => !regionIds.includes(region.id)), merged];
  return next;
}

export function subtractFootprintRegion(footprint, targetRegionId, subtractingRegionId) {
  const target = footprint.regions.find((region) => region.id === targetRegionId);
  const subtraction = footprint.regions.find((region) => region.id === subtractingRegionId);
  if (!target || !subtraction || subtraction.outer.some((item) => !pointInsideRing(item, target.outer))) return footprint;
  const next = editableFootprint(footprint);
  next.regions = next.regions.filter((region) => region.id !== subtractingRegionId).map((region) => (
    region.id === targetRegionId ? { ...region, holes: [...region.holes, [...subtraction.outer].reverse()] } : region
  ));
  return next;
}

export function restoreInheritedFloorFootprint(building, previous) {
  const inherited = createInheritedFloorFootprint(building);
  return { ...inherited, id: previous?.id ?? inherited.id, revision: (previous?.revision ?? 0) + 1 };
}

function normalizeElevationZone(zone = {}, footprint) {
  return {
    id: zone.id ?? createId("ELEVATION_ZONE"),
    name: zone.name ?? "고도 영역",
    boundary: cloneRing(zone.boundary ?? footprint.regions[0]?.outer ?? []),
    relativeHeight: finite(zone.relativeHeight),
    slabThickness: Math.max(0.03, finite(zone.slabThickness, 0.15)),
    surfaceType: zone.surfaceType === ELEVATION_ZONE_SURFACES.SLOPED ? ELEVATION_ZONE_SURFACES.SLOPED : ELEVATION_ZONE_SURFACES.FLAT,
    slope: { x: finite(zone.slope?.x), z: finite(zone.slope?.z) },
    edgeTreatments: zone.edgeTreatments ?? {},
  };
}

export function createDefaultElevationZone(footprint) {
  return normalizeElevationZone({ name: "기본 바닥", relativeHeight: 0 }, footprint);
}

export function validateElevationZones(zones = [], footprint) {
  const issues = [];
  zones.forEach((zone, index) => {
    validateRing(zone.boundary, `elevationZones.${index}.boundary`, issues);
    if (zone.boundary.some((item) => !pointInsideFootprint(item, footprint))) issues.push({ severity: "error", code: "ZONE_OUTSIDE", path: `elevationZones.${index}`, message: "고도 영역이 바닥 외곽을 벗어납니다." });
    const slope = Math.hypot(finite(zone.slope?.x), finite(zone.slope?.z));
    if (zone.surfaceType === ELEVATION_ZONE_SURFACES.SLOPED && slope > MAX_SAFE_SLOPE) issues.push({ severity: "warning", code: "STEEP_SLOPE", path: `elevationZones.${index}`, message: "경사도가 1:12보다 가파릅니다." });
    if (Math.abs(zone.relativeHeight) > MAX_SAFE_STEP && !Object.keys(zone.edgeTreatments ?? {}).length) issues.push({ severity: "warning", code: "UNPROTECTED_STEP", path: `elevationZones.${index}`, message: "300mm를 넘는 단차에 가장자리 처리가 없습니다." });
  });
  return issues;
}

export function getFloorHeightAtPoint(zones = [], target) {
  const matches = zones.filter((zone) => pointInsideRing(target, zone.boundary));
  const zone = matches.at(-1);
  if (!zone) return 0;
  if (zone.surfaceType !== ELEVATION_ZONE_SURFACES.SLOPED) return zone.relativeHeight;
  const origin = zone.boundary[0] ?? { x: 0, z: 0 };
  return zone.relativeHeight + (target.x - origin.x) * zone.slope.x + (target.z - origin.z) * zone.slope.z;
}

export function addElevationZone(plan, options = {}) {
  const bounds = getFloorFootprintBounds(plan.floorFootprint);
  const boundary = options.boundary ?? rectangle(
    options.width ?? Math.max(1, bounds.width * 0.35),
    options.depth ?? Math.max(1, bounds.depth * 0.35),
    options.position ?? { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 },
  );
  const zone = normalizeElevationZone({ ...options, boundary }, plan.floorFootprint);
  return { ...plan, elevationZones: [...plan.elevationZones, zone], selectedSpatialEntity: { type: "ELEVATION_ZONE", id: zone.id } };
}

export function updateElevationZone(plan, zoneId, changes) {
  return {
    ...plan,
    elevationZones: plan.elevationZones.map((zone) => zone.id === zoneId
      ? normalizeElevationZone({ ...zone, ...changes, slope: changes.slope ? { ...zone.slope, ...changes.slope } : zone.slope }, plan.floorFootprint)
      : zone),
  };
}

export function splitElevationZone(plan, zoneId, axis = "X") {
  const source = plan.elevationZones.find((zone) => zone.id === zoneId);
  if (!source || source.boundary.length < 3) return plan;
  const xs = source.boundary.map((item) => item.x);
  const zs = source.boundary.map((item) => item.z);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
  const midX = (minX + maxX) / 2; const midZ = (minZ + maxZ) / 2;
  const boundaries = axis === "Z"
    ? [rectangle(maxX - minX, midZ - minZ, { x: midX, z: (minZ + midZ) / 2 }), rectangle(maxX - minX, maxZ - midZ, { x: midX, z: (midZ + maxZ) / 2 })]
    : [rectangle(midX - minX, maxZ - minZ, { x: (minX + midX) / 2, z: midZ }), rectangle(maxX - midX, maxZ - minZ, { x: (midX + maxX) / 2, z: midZ })];
  const zones = boundaries.map((boundary, index) => normalizeElevationZone({ ...source, id: index ? createId("ELEVATION_ZONE") : source.id, name: `${source.name} ${index + 1}`, boundary }, plan.floorFootprint));
  return { ...plan, elevationZones: plan.elevationZones.flatMap((zone) => zone.id === zoneId ? zones : [zone]) };
}

function segmentKey(start, end) {
  const encode = (item) => `${finite(item.x).toFixed(4)},${finite(item.z).toFixed(4)}`;
  return [encode(start), encode(end)].sort().join("|");
}

function defaultWall(roomId, start, end, existing) {
  return {
    id: existing?.id ?? createId("SHARED_WALL"),
    boundaryKey: segmentKey(start, end),
    roomIds: [...new Set([...(existing?.roomIds ?? []), roomId])],
    start: point(start),
    end: point(end),
    enabled: existing?.enabled ?? true,
    height: Math.max(0.1, finite(existing?.height, 3)),
    thickness: Math.max(0.05, finite(existing?.thickness, 0.15)),
    lengthMode: existing?.lengthMode ?? "FULL",
    startOffset: Math.max(0, finite(existing?.startOffset)),
    endOffset: Math.max(0, finite(existing?.endOffset)),
    appearance: { materialPreset: "PAINTED_CONCRETE", color: "#A7B0B5", ...(existing?.appearance ?? {}) },
  };
}

function normalizeRoom(room = {}) {
  return {
    id: room.id ?? createId("FLOOR_ROOM"),
    name: room.name ?? "방",
    outline: cloneRing(room.outline ?? rectangle(room.width, room.depth, room.position)),
    editMode: room.editMode === ROOM_EDIT_MODES.WALL_DETAIL ? ROOM_EDIT_MODES.WALL_DETAIL : ROOM_EDIT_MODES.SHAPE,
    wallIds: room.wallIds ?? [],
    appearance: { color: "#75A8B8", opacity: 0.16, ...(room.appearance ?? {}) },
  };
}

export function synchronizeRoomWalls(rooms = [], previousWalls = []) {
  const previousByBoundary = new Map(previousWalls.map((wall) => [wall.boundaryKey ?? segmentKey(wall.start, wall.end), wall]));
  const previousById = new Map(previousWalls.map((wall) => [wall.id, wall]));
  const wallsByBoundary = new Map();
  const nextRooms = rooms.map(normalizeRoom).map((room) => {
    const previousRoomWallIds = room.wallIds ?? [];
    const wallIds = room.outline.map((start, index) => {
      const end = room.outline[(index + 1) % room.outline.length];
      const key = segmentKey(start, end);
      const current = wallsByBoundary.get(key) ?? defaultWall(
        room.id,
        start,
        end,
        previousByBoundary.get(key) ?? previousById.get(previousRoomWallIds[index]),
      );
      const wall = { ...current, roomIds: [...new Set([...current.roomIds, room.id])] };
      wallsByBoundary.set(key, wall);
      return wall.id;
    });
    return { ...room, wallIds };
  });
  return { rooms: nextRooms, walls: [...wallsByBoundary.values()] };
}

export function addRectangularRoom(plan, options = {}) {
  const room = normalizeRoom({
    name: options.name ?? `방 ${(plan.rooms?.length ?? 0) + 1}`,
    outline: rectangle(options.width ?? 4, options.depth ?? 3, options.position ?? { x: 0, z: 0 }),
  });
  const synchronized = synchronizeRoomWalls([...(plan.rooms ?? []), room], plan.walls);
  return { ...plan, ...synchronized, selectedSpatialEntity: { type: "ROOM", id: room.id } };
}

export function updateRoom(plan, roomId, changes) {
  const rooms = plan.rooms.map((room) => room.id === roomId ? normalizeRoom({ ...room, ...changes }) : room);
  return { ...plan, ...synchronizeRoomWalls(rooms, plan.walls) };
}

export function updateSharedWall(plan, wallId, changes) {
  const walls = plan.walls.map((wall) => wall.id === wallId ? {
    ...wall,
    ...changes,
    appearance: changes.appearance ? { ...wall.appearance, ...changes.appearance } : wall.appearance,
  } : wall);
  const disabled = walls.find((wall) => wall.id === wallId)?.enabled === false;
  return {
    ...plan,
    walls,
    doors: plan.doors.map((door) => door.hostWallId === wallId ? { ...door, active: !disabled } : door),
  };
}

function wallLength(wall) {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
}

function normalizeDoor(door = {}) {
  return {
    id: door.id ?? createId("WALL_DOOR"),
    name: door.name ?? "문",
    hostWallId: door.hostWallId ?? null,
    offset: Math.max(0, finite(door.offset)),
    width: Math.max(0.5, finite(door.width, 0.9)),
    height: Math.max(1.5, finite(door.height, 2.1)),
    hinge: door.hinge === "RIGHT" ? "RIGHT" : "LEFT",
    swing: door.swing === "OUT" ? "OUT" : "IN",
    active: door.active ?? true,
    connectsRoomIds: door.connectsRoomIds ?? [],
    appearanceSlots: {
      leaf: { materialPreset: "WOOD", color: "#8B6B4A", ...door.appearanceSlots?.leaf },
      frame: { materialPreset: "PAINTED_STEEL", color: "#6E787D", ...door.appearanceSlots?.frame },
      handle: { materialPreset: "METAL", color: "#D0D4D6", ...door.appearanceSlots?.handle },
      glass: { materialPreset: "GLASS", color: "#A9D4DD", ...door.appearanceSlots?.glass },
    },
  };
}

export function validateDoor(door, walls, doors = []) {
  const wall = walls.find((item) => item.id === door.hostWallId);
  if (!wall) return "문은 반드시 존재하는 벽에 부착해야 합니다.";
  if (!wall.enabled) return "비활성화된 벽에는 문을 배치할 수 없습니다.";
  const available = wallLength(wall) - wall.startOffset - wall.endOffset;
  if (door.width > available + EPSILON) return "문 너비가 벽의 사용 가능한 길이보다 큽니다.";
  const start = door.offset - door.width / 2;
  const end = door.offset + door.width / 2;
  if (start < wall.startOffset - EPSILON || end > wallLength(wall) - wall.endOffset + EPSILON) return "문이 벽 끝 여유 범위를 벗어납니다.";
  const overlap = doors.some((item) => item.id !== door.id && item.hostWallId === door.hostWallId
    && Math.abs(item.offset - door.offset) < (item.width + door.width) / 2 + 0.05);
  return overlap ? "문이 같은 벽의 다른 개구부와 겹칩니다." : "";
}

export function addDoorToWall(plan, wallId, options = {}) {
  const wall = plan.walls.find((item) => item.id === wallId);
  if (!wall) return { plan, error: "벽이 없는 위치에는 문을 배치할 수 없습니다." };
  const door = normalizeDoor({
    ...options,
    hostWallId: wallId,
    offset: options.offset ?? wallLength(wall) / 2,
    active: wall.enabled,
    connectsRoomIds: [...wall.roomIds],
  });
  const error = validateDoor(door, plan.walls, plan.doors);
  return error ? { plan, error } : { plan: { ...plan, doors: [...plan.doors, door], selectedSpatialEntity: { type: "DOOR", id: door.id } }, error: "" };
}

export function updateDoor(plan, doorId, changes) {
  const current = plan.doors.find((door) => door.id === doorId);
  if (!current) return { plan, error: "문을 찾을 수 없습니다." };
  const next = normalizeDoor({ ...current, ...changes, appearanceSlots: changes.appearanceSlots ? { ...current.appearanceSlots, ...changes.appearanceSlots } : current.appearanceSlots });
  const error = validateDoor(next, plan.walls, plan.doors);
  return error ? { plan, error } : { plan: { ...plan, doors: plan.doors.map((door) => door.id === doorId ? next : door) }, error: "" };
}

export function removeDoor(plan, doorId) {
  return { ...plan, doors: plan.doors.filter((door) => door.id !== doorId), selectedSpatialEntity: null };
}

export function getOutOfBoundsWarnings(plan, structures = [], equipment = []) {
  const footprint = plan.floorFootprint;
  return [...structures.map((item) => ({ type: "구조물", id: item.id, name: item.name, position: item.position })), ...equipment.map((item) => ({ type: "설비", id: item.id, name: item.name, position: item.position }))]
    .filter((item) => item.position && !pointInsideFootprint(item.position, footprint))
    .map((item) => ({ severity: "warning", code: "OUTSIDE_FOOTPRINT", entityId: item.id, message: `${item.type} '${item.name}'이(가) 바닥 외부에 있습니다.` }));
}

export function normalizeFloorSpatialPlan(plan = {}, building) {
  const floorFootprint = normalizeFloorFootprint(plan.floorFootprint ?? plan.footprint, building);
  const elevationZones = (plan.elevationZones?.length ? plan.elevationZones : [createDefaultElevationZone(floorFootprint)])
    .map((zone) => normalizeElevationZone(zone, floorFootprint));
  const synchronized = synchronizeRoomWalls((plan.rooms ?? []).map(normalizeRoom), plan.walls ?? []);
  const doors = (plan.doors ?? []).map(normalizeDoor).filter((door) => synchronized.walls.some((wall) => wall.id === door.hostWallId));
  return {
    ...plan,
    spatialVersion: FLOOR_SPATIAL_VERSION,
    floorFootprint,
    elevationZones,
    ...synchronized,
    doors,
  };
}

export function cloneFloorSpatialPlanForFloor(source = {}, building, floorId) {
  const footprint = normalizeFloorFootprint(structuredClone(source.floorFootprint), building);
  footprint.id = createId("FLOOR_FOOTPRINT");
  footprint.regions = footprint.regions.map((region) => ({ ...region, id: createId("FLOOR_REGION") }));
  const zones = (source.elevationZones ?? []).map((zone) => ({ ...structuredClone(zone), id: createId("ELEVATION_ZONE") }));
  const rooms = (source.rooms ?? []).map((room) => ({ ...structuredClone(room), id: createId("FLOOR_ROOM"), wallIds: [] }));
  const roomIdMap = new Map((source.rooms ?? []).map((room, index) => [room.id, rooms[index].id]));
  const synchronized = synchronizeRoomWalls(rooms, []);
  const oldWallByKey = new Map((source.walls ?? []).map((wall) => [wall.boundaryKey, wall]));
  const walls = synchronized.walls.map((wall) => {
    const sourceWall = oldWallByKey.get(wall.boundaryKey);
    return sourceWall ? { ...wall, ...structuredClone(sourceWall), id: wall.id, roomIds: wall.roomIds } : wall;
  });
  const wallIdByKey = new Map(walls.map((wall) => [wall.boundaryKey, wall.id]));
  const sourceWallById = new Map((source.walls ?? []).map((wall) => [wall.id, wall]));
  const doors = (source.doors ?? []).map((door) => {
    const sourceWall = sourceWallById.get(door.hostWallId);
    const hostWallId = wallIdByKey.get(sourceWall?.boundaryKey);
    return hostWallId ? normalizeDoor({
      ...structuredClone(door),
      id: createId("WALL_DOOR"),
      hostWallId,
      connectsRoomIds: (door.connectsRoomIds ?? []).map((id) => roomIdMap.get(id)).filter(Boolean),
    }) : null;
  }).filter(Boolean);
  return {
    ...structuredClone(source),
    floorId,
    floorFootprint: footprint,
    elevationZones: zones.length ? zones : [createDefaultElevationZone(footprint)],
    rooms: synchronized.rooms.map((room) => ({ ...room, floorId })),
    walls,
    doors,
  };
}

export function validateFloorSpatialPlan(plan, structures = [], equipment = []) {
  return [
    ...validateFloorFootprint(plan.floorFootprint),
    ...validateElevationZones(plan.elevationZones, plan.floorFootprint),
    ...plan.doors.map((door, index) => {
      const message = validateDoor(door, plan.walls, plan.doors);
      return message ? { severity: "error", code: "INVALID_DOOR", path: `doors.${index}`, message } : null;
    }).filter(Boolean),
    ...plan.rooms.filter((room) => room.outline.some((item) => !pointInsideFootprint(item, plan.floorFootprint)))
      .map((room) => ({ severity: "warning", code: "ROOM_OUTSIDE_FOOTPRINT", entityId: room.id, message: `방 '${room.name}'의 일부가 바닥 외부에 있습니다.` })),
    ...plan.walls.filter((wall) => !pointInsideFootprint(wall.start, plan.floorFootprint) || !pointInsideFootprint(wall.end, plan.floorFootprint))
      .map((wall) => ({ severity: "warning", code: "WALL_OUTSIDE_FOOTPRINT", entityId: wall.id, message: `벽 '${wall.id}'의 일부가 바닥 외부에 있습니다.` })),
    ...getOutOfBoundsWarnings(plan, structures, equipment),
  ];
}

export function getFloorFootprintBounds(footprint) {
  return boundsForRegions(footprint.regions);
}
