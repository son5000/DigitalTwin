import * as THREE from "three";

function getHorizontalNormal(samples, index) {
  const previous = samples[Math.max(0, index - 1)];
  const next = samples[Math.min(samples.length - 1, index + 1)];
  const dx = next.x - previous.x;
  const dz = next.z - previous.z;
  const length = Math.hypot(dx, dz) || 1;
  return { x: -dz / length, z: dx / length };
}

function interpolateSample(left, right, t) {
  return {
    ...left,
    x: left.x + (right.x - left.x) * t,
    y: left.y + (right.y - left.y) * t,
    z: left.z + (right.z - left.z) * t,
    segmentDistance: left.segmentDistance + (right.segmentDistance - left.segmentDistance) * t,
  };
}

export function sliceGradedSamples(samples, startDistance, endDistance) {
  if (!samples?.length || endDistance <= startDistance) return [];
  const result = [];
  samples.slice(1).forEach((right, index) => {
    const left = samples[index];
    if (right.segmentDistance < startDistance || left.segmentDistance > endDistance) return;
    const span = Math.max(0.0001, right.segmentDistance - left.segmentDistance);
    const startT = Math.max(0, (startDistance - left.segmentDistance) / span);
    const endT = Math.min(1, (endDistance - left.segmentDistance) / span);
    const segmentStart = interpolateSample(left, right, startT);
    const segmentEnd = interpolateSample(left, right, endT);
    if (!result.length) result.push(segmentStart);
    else if (Math.hypot(result.at(-1).x - segmentStart.x, result.at(-1).z - segmentStart.z) > 0.001) result.push(segmentStart);
    result.push(segmentEnd);
  });
  return result;
}

export function createGradedStripGeometry(samples, {
  width,
  thickness = 0,
  offset = 0,
  elevationOffset = 0,
} = {}) {
  if (!Array.isArray(samples) || samples.length < 2) return new THREE.BufferGeometry();
  const halfWidth = Math.max(0.001, Number(width) || 1) / 2;
  const hasThickness = thickness > 0.001;
  const positions = [];
  const uvs = [];
  const indices = [];
  samples.forEach((sample, index) => {
    const normal = getHorizontalNormal(samples, index);
    const centerX = sample.x + normal.x * offset;
    const centerZ = sample.z + normal.z * offset;
    const topY = sample.y + elevationOffset;
    positions.push(centerX + normal.x * halfWidth, topY, centerZ + normal.z * halfWidth);
    positions.push(centerX - normal.x * halfWidth, topY, centerZ - normal.z * halfWidth);
    uvs.push(0, index / Math.max(1, samples.length - 1), 1, index / Math.max(1, samples.length - 1));
    if (hasThickness) {
      positions.push(centerX + normal.x * halfWidth, topY - thickness, centerZ + normal.z * halfWidth);
      positions.push(centerX - normal.x * halfWidth, topY - thickness, centerZ - normal.z * halfWidth);
      uvs.push(0, index / Math.max(1, samples.length - 1), 1, index / Math.max(1, samples.length - 1));
    }
  });
  const stride = hasThickness ? 4 : 2;
  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = index * stride;
    const next = (index + 1) * stride;
    indices.push(current, next, current + 1, current + 1, next, next + 1);
    if (hasThickness) {
      indices.push(current + 2, current + 3, next + 2, current + 3, next + 3, next + 2);
      indices.push(current, current + 2, next, current + 2, next + 2, next);
      indices.push(current + 1, next + 1, current + 3, current + 3, next + 1, next + 3);
    }
  }
  if (hasThickness) {
    const last = (samples.length - 1) * stride;
    indices.push(0, 1, 2, 1, 3, 2, last, last + 2, last + 1, last + 1, last + 2, last + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function addElevatedSupports(group, verticalPath, roadWidth, material, spacing = 12) {
  if (!verticalPath?.points?.length) return;
  let nextDistance = spacing;
  verticalPath.points.forEach((sample) => {
    if (sample.distance + 0.001 < nextDistance || sample.elevation - sample.terrainElevation < 0.5) return;
    const height = sample.elevation - sample.terrainElevation;
    const support = new THREE.Mesh(new THREE.BoxGeometry(Math.min(roadWidth * 0.45, 2.4), height, Math.min(roadWidth * 0.35, 1.6)), material);
    support.position.set(sample.x, sample.y - height / 2, sample.z);
    group.add(support);
    nextDistance += spacing;
  });
}
