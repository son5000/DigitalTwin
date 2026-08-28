import * as THREE from "three";

import { getFloorHeightAtPoint, pointInsideRing } from "../model/floorSpatialModel.js";

function color(value, fallback) {
  try { return new THREE.Color(value ?? fallback); } catch { return new THREE.Color(fallback); }
}

function addRing(path, points) {
  if (!points?.length) return;
  path.moveTo(points[0].x, points[0].z);
  points.forEach((current, index) => {
    if (index === points.length - 1) return;
    const next = points[index + 1];
    if (current.curveToNext?.type === "QUADRATIC") path.quadraticCurveTo(current.curveToNext.x, current.curveToNext.z, next.x, next.z);
    else path.lineTo(next.x, next.z);
  });
  const last = points.at(-1);
  const first = points[0];
  if (last.curveToNext?.type === "QUADRATIC") path.quadraticCurveTo(last.curveToNext.x, last.curveToNext.z, first.x, first.z);
  path.closePath();
}

export function createFootprintShape(region) {
  const shape = new THREE.Shape();
  addRing(shape, region.outer);
  (region.holes ?? []).forEach((points) => {
    const hole = new THREE.Path();
    addRing(hole, points);
    shape.holes.push(hole);
  });
  return shape;
}

function markSpatial(object, type, id) {
  object.userData.spatialType = type;
  object.userData.spatialId = id;
  object.traverse((child) => {
    child.userData.spatialType = type;
    child.userData.spatialId = id;
  });
  return object;
}

function createPlanarRegion(region, material, y = 0) {
  const geometry = new THREE.ShapeGeometry(createFootprintShape(region), 18);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

function openingRing(opening) {
  const cosine = Math.cos(opening.rotation ?? 0);
  const sine = Math.sin(opening.rotation ?? 0);
  return [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([sx, sz]) => {
    const x = sx * opening.width / 2;
    const z = sz * opening.depth / 2;
    return { x: opening.x + x * cosine - z * sine, z: opening.z + x * sine + z * cosine };
  });
}

function elevationColor(relativeHeight, selected) {
  if (selected) return 0x45d2ff;
  if (relativeHeight > 0.001) return 0xe8a45b;
  if (relativeHeight < -0.001) return 0x5b8fd8;
  return 0x8aa3ad;
}

function createElevationZoneObject(zone, options) {
  const selected = options.selected?.type === "ELEVATION_ZONE" && options.selected.id === zone.id;
  const geometry = new THREE.ShapeGeometry(createFootprintShape({ outer: zone.boundary, holes: [] }), 12);
  geometry.rotateX(Math.PI / 2);
  const position = geometry.getAttribute("position");
  const origin = zone.boundary[0] ?? { x: 0, z: 0 };
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const slopeHeight = zone.surfaceType === "SLOPED"
      ? (x - origin.x) * (zone.slope?.x ?? 0) + (z - origin.z) * (zone.slope?.z ?? 0)
      : 0;
    position.setY(index, zone.relativeHeight + slopeHeight + 0.018);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: elevationColor(zone.relativeHeight, selected),
    roughness: 0.82,
    metalness: 0.01,
    transparent: true,
    opacity: options.mode2D ? 0.34 : 0.86,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(zone.boundary.map((item) => new THREE.Vector3(item.x, zone.relativeHeight + 0.03, item.z))),
    new THREE.LineBasicMaterial({ color: selected ? 0x45d2ff : 0x4d6874 }),
  );
  mesh.add(outline);
  return markSpatial(mesh, "ELEVATION_ZONE", zone.id);
}

function wallFrame(wall) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const length = Math.hypot(dx, dz);
  return {
    length,
    angle: Math.atan2(dz, dx),
    pointAt: (distance) => ({ x: wall.start.x + dx * distance / length, z: wall.start.z + dz * distance / length }),
  };
}

function createWallBox(wall, frame, start, end, height, centerY, material) {
  const length = Math.max(0, end - start);
  if (length < 0.01 || height < 0.01) return null;
  const center = frame.pointAt((start + end) / 2);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, wall.thickness), material);
  mesh.position.set(center.x, centerY, center.z);
  mesh.rotation.y = -frame.angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createDoorVisual(door, wall, frame, baseY, mode2D) {
  const group = markSpatial(new THREE.Group(), "DOOR", door.id);
  const center = frame.pointAt(door.offset);
  group.position.set(center.x, baseY, center.z);
  group.rotation.y = -frame.angle;
  const frameMaterial = new THREE.MeshStandardMaterial({ color: color(door.appearanceSlots?.frame?.color, "#6E787D"), roughness: 0.6 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: color(door.appearanceSlots?.leaf?.color, "#8B6B4A"), roughness: 0.68 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: color(door.appearanceSlots?.glass?.color, "#A9D4DD"), roughness: 0.18, transparent: true, opacity: 0.46 });
  const handleMaterial = new THREE.MeshStandardMaterial({ color: color(door.appearanceSlots?.handle?.color, "#D0D4D6"), roughness: 0.3, metalness: 0.72 });
  const postGeometry = new THREE.BoxGeometry(0.06, door.height, wall.thickness * 1.5);
  const left = new THREE.Mesh(postGeometry, frameMaterial);
  const right = new THREE.Mesh(postGeometry, frameMaterial.clone());
  left.position.set(-door.width / 2, door.height / 2, 0);
  right.position.set(door.width / 2, door.height / 2, 0);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(door.width - 0.08, mode2D ? 0.035 : door.height - 0.08, 0.045), leafMaterial);
  leaf.position.set(0, mode2D ? 0.035 : door.height / 2, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.16, door.width * 0.38), mode2D ? 0.04 : door.height * 0.38, 0.052), glassMaterial);
  glass.position.set(0, mode2D ? 0.055 : door.height * 0.62, 0);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(mode2D ? 0.04 : 0.045, 10, 7), handleMaterial);
  handle.position.set((door.hinge === "LEFT" ? 1 : -1) * door.width * 0.32, mode2D ? 0.07 : door.height * 0.48, wall.thickness * 0.38);
  group.add(left, right, leaf, glass, handle);
  if (mode2D) {
    const curve = new THREE.EllipseCurve(
      door.hinge === "LEFT" ? -door.width / 2 : door.width / 2,
      0,
      door.width,
      door.width,
      door.hinge === "LEFT" ? 0 : Math.PI,
      door.hinge === "LEFT" ? Math.PI / 2 : Math.PI / 2,
      door.swing === "OUT",
    );
    const arc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(20).map((item) => new THREE.Vector3(item.x, 0.05, item.y))),
      new THREE.LineDashedMaterial({ color: 0xd9a85b, dashSize: 0.12, gapSize: 0.08 }),
    );
    arc.computeLineDistances();
    group.add(arc);
  }
  group.visible = door.active !== false;
  return group;
}

function createWallObject(wall, doors, zones, options) {
  const selected = options.selected?.type === "WALL" && options.selected.id === wall.id;
  const group = markSpatial(new THREE.Group(), "WALL", wall.id);
  group.visible = wall.enabled !== false;
  const frame = wallFrame(wall);
  if (frame.length < 0.01) return group;
  const midpoint = frame.pointAt(frame.length / 2);
  const baseY = getFloorHeightAtPoint(zones, midpoint);
  const material = new THREE.MeshStandardMaterial({
    color: selected ? 0x45d2ff : color(wall.appearance?.color, "#A7B0B5"),
    roughness: 0.78,
    metalness: 0.02,
    transparent: options.mode2D,
    opacity: options.mode2D ? 0.78 : 1,
  });
  const hostedDoors = doors.filter((door) => door.hostWallId === wall.id && door.active !== false).sort((a, b) => a.offset - b.offset);
  let cursor = wall.startOffset;
  hostedDoors.forEach((door) => {
    const openingStart = door.offset - door.width / 2;
    const openingEnd = door.offset + door.width / 2;
    const left = createWallBox(wall, frame, cursor, openingStart, wall.height, baseY + wall.height / 2, material.clone());
    if (left) group.add(left);
    const lintelHeight = Math.max(0, wall.height - door.height);
    const lintel = createWallBox(wall, frame, openingStart, openingEnd, lintelHeight, baseY + door.height + lintelHeight / 2, material.clone());
    if (lintel) group.add(lintel);
    group.add(createDoorVisual(door, wall, frame, baseY, options.mode2D));
    cursor = openingEnd;
  });
  const right = createWallBox(wall, frame, cursor, frame.length - wall.endOffset, wall.height, baseY + wall.height / 2, material);
  if (right) group.add(right);
  return group;
}

function createRoomObject(room, options) {
  const selected = options.selected?.type === "ROOM" && options.selected.id === room.id;
  const material = new THREE.MeshBasicMaterial({
    color: selected ? 0x45d2ff : color(room.appearance?.color, "#75A8B8"),
    transparent: true,
    opacity: options.mode2D ? 0.16 : 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = createPlanarRegion({ outer: room.outline, holes: [] }, material, 0.045);
  return markSpatial(mesh, "ROOM", room.id);
}

export function createFloorSpatialObject(plan, options = {}) {
  const settings = { mode2D: false, selected: null, floorStyle: {}, ...options };
  settings.floorStyle ??= {};
  const group = new THREE.Group();
  const floorMeshes = [];
  (plan.floorFootprint?.regions ?? []).forEach((region) => {
    const derivedRegion = {
      ...region,
      holes: [
        ...(region.holes ?? []),
        ...(settings.openings ?? []).filter((opening) => pointInsideRing(opening, region.outer)).map(openingRing),
      ],
    };
    const mesh = createPlanarRegion(derivedRegion, new THREE.MeshStandardMaterial({
      color: color(settings.floorStyle.color, "#7F929B"),
      roughness: settings.floorStyle.roughness ?? 0.82,
      metalness: settings.floorStyle.metalness ?? 0.02,
      side: THREE.DoubleSide,
    }), 0);
    mesh.userData.floorSurface = true;
    mesh.userData.floorRegionId = region.id;
    floorMeshes.push(mesh);
    group.add(mesh);
  });
  (plan.elevationZones ?? []).forEach((zone, index) => {
    if (index === 0 && Math.abs(zone.relativeHeight) < 0.001 && zone.surfaceType === "FLAT") return;
    group.add(createElevationZoneObject(zone, settings));
  });
  (plan.rooms ?? []).forEach((room) => group.add(createRoomObject(room, settings)));
  (plan.walls ?? []).forEach((wall) => group.add(createWallObject(wall, plan.doors ?? [], plan.elevationZones ?? [], settings)));
  group.userData.floorMeshes = floorMeshes;
  return group;
}

export function findSpatialDomain(object, root) {
  let current = object;
  while (current && current !== root) {
    if (current.userData.spatialId) return { type: current.userData.spatialType, id: current.userData.spatialId };
    current = current.parent;
  }
  return null;
}
