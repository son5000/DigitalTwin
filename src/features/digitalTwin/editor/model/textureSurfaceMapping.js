import * as THREE from "three";
import { getEnclosureSurfaces } from "./equipmentEnclosure.js";

export const IMAGE_PLANES = Object.freeze({ FRONT: "정면", BACK: "뒷면", LEFT: "왼쪽", RIGHT: "오른쪽", TOP: "윗면", BOTTOM: "아랫면" });
const vector = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite) ? new THREE.Vector3(...value) : null;
const size = (value, fallback = 1) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

export function normalizeImageSurface(source) {
  const origin = vector(source?.origin), right = vector(source?.right), up = vector(source?.up);
  if (!origin || !right || !up || right.lengthSq() < 1e-12 || up.lengthSq() < 1e-12) return null;
  right.normalize(); up.addScaledVector(right, -up.dot(right));
  if (up.lengthSq() < 1e-12) return null;
  up.normalize();
  return { space: "EQUIPMENT_MODEL_LOCAL", unit: "m", origin: origin.toArray(), right: right.toArray(), up: up.toArray(),
    normal: new THREE.Vector3().crossVectors(right, up).toArray(), width: size(source.width), height: size(source.height) };
}

// These axes belong to the object. Neither the physical sensor nor the viewer
// camera participates in this mapping. A selected enclosure face follows its door.
export function resolveImageSurface(equipment, projection = {}) {
  const face = projection.target !== "ACTUAL" && projection.surfaceId
    ? getEnclosureSurfaces(equipment).find((surface) => surface.id === projection.surfaceId) : null;
  if (face) return normalizeImageSurface({ origin: face.origin.toArray(), right: face.right.toArray(), up: face.up.toArray(), width: face.width, height: face.height });
  const custom = normalizeImageSurface(projection.surfaceMapping);
  if (custom) return custom;
  const w = size(equipment?.dimensions?.width), h = size(equipment?.dimensions?.height), d = size(equipment?.dimensions?.depth);
  const planes = {
    FRONT: [[-w / 2, 0, d / 2], [1, 0, 0], [0, 1, 0], w, h],
    BACK: [[w / 2, 0, -d / 2], [-1, 0, 0], [0, 1, 0], w, h],
    LEFT: [[-w / 2, 0, -d / 2], [0, 0, 1], [0, 1, 0], d, h],
    RIGHT: [[w / 2, 0, d / 2], [0, 0, -1], [0, 1, 0], d, h],
    TOP: [[-w / 2, h, d / 2], [1, 0, 0], [0, 0, -1], w, d],
    BOTTOM: [[-w / 2, 0, -d / 2], [1, 0, 0], [0, 0, 1], w, d],
  };
  const [origin, right, up, width, height] = planes[projection.imagePlane] ?? planes.FRONT;
  return normalizeImageSurface({ origin, right, up, width, height });
}

export function imageSurfaceMatrix(surface, equipmentMatrix = new THREE.Matrix4()) {
  const o = new THREE.Vector3(...surface.origin), u = new THREE.Vector3(...surface.right).divideScalar(surface.width), v = new THREE.Vector3(...surface.up).divideScalar(surface.height);
  return new THREE.Matrix4().set(u.x, u.y, u.z, -u.dot(o), v.x, v.y, v.z, -v.dot(o), 0, 0, 0, 0, 0, 0, 0, 1)
    .multiply(equipmentMatrix.clone().invert());
}

// Fit the picked mesh in its own equipment coordinates, including scan alignment.
// Store the resulting basis so export and reload reproduce the very same mapping.
export function imageSurfaceFromMesh(object, equipmentRoot, localNormal) {
  object.updateWorldMatrix(true, false); equipmentRoot.updateWorldMatrix(true, false);
  object.geometry.computeBoundingBox();
  const box = object.geometry.boundingBox;
  if (!box || box.isEmpty()) return null;
  const normal = localNormal?.clone().normalize() ?? new THREE.Vector3(0, 0, 1);
  const up = Math.abs(normal.y) > .95 ? new THREE.Vector3(0, 0, normal.y > 0 ? -1 : 1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, normal).normalize(); up.crossVectors(normal, right).normalize();
  const toLocal = equipmentRoot.matrixWorld.clone().invert().multiply(object.matrixWorld);
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity, depth = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).applyMatrix4(toLocal);
    minU = Math.min(minU, point.dot(right)); maxU = Math.max(maxU, point.dot(right));
    minV = Math.min(minV, point.dot(up)); maxV = Math.max(maxV, point.dot(up)); depth = Math.max(depth, point.dot(normal));
  }
  return normalizeImageSurface({ origin: right.clone().multiplyScalar(minU).addScaledVector(up, minV).addScaledVector(normal, depth).toArray(),
    right: right.toArray(), up: up.toArray(), width: Math.max(.001, maxU - minU), height: Math.max(.001, maxV - minV) });
}
