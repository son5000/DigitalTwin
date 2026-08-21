import * as THREE from "three";

const MAX_LINES_PER_AXIS = 160;

function createLineMaterial(color, opacity) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

function createRegionLines(region, color) {
  const points = [];
  const halfWidth = region.size.width / 2;
  const halfDepth = region.size.depth / 2;
  const xCount = Math.ceil(region.size.width / region.cellSize);
  const zCount = Math.ceil(region.size.depth / region.cellSize);
  const displayStep = region.cellSize * Math.max(1, Math.ceil(Math.max(xCount, zCount) / MAX_LINES_PER_AXIS));

  for (let x = -halfWidth; x <= halfWidth + displayStep * 0.25; x += displayStep) {
    const clampedX = Math.min(x, halfWidth);
    points.push(new THREE.Vector3(clampedX, 0, -halfDepth), new THREE.Vector3(clampedX, 0, halfDepth));
  }
  for (let z = -halfDepth; z <= halfDepth + displayStep * 0.25; z += displayStep) {
    const clampedZ = Math.min(z, halfDepth);
    points.push(new THREE.Vector3(-halfWidth, 0, clampedZ), new THREE.Vector3(halfWidth, 0, clampedZ));
  }

  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    createLineMaterial(color, 0.55),
  );
}

export function createGridRegionGuide(region, { lineColor, boundaryColor }) {
  const group = new THREE.Group();
  group.name = `GridRegionGuide:${region.id}`;
  group.userData.gridRegionId = region.id;
  group.position.set(region.center.x, 0.018, region.center.z);

  const lines = createRegionLines(region, lineColor);
  const boundaryGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-region.size.width / 2, 0.002, -region.size.depth / 2),
    new THREE.Vector3(region.size.width / 2, 0.002, -region.size.depth / 2),
    new THREE.Vector3(region.size.width / 2, 0.002, region.size.depth / 2),
    new THREE.Vector3(-region.size.width / 2, 0.002, region.size.depth / 2),
    new THREE.Vector3(-region.size.width / 2, 0.002, -region.size.depth / 2),
  ]);
  const boundary = new THREE.Line(boundaryGeometry, createLineMaterial(boundaryColor, 0.9));
  group.add(lines, boundary);
  return group;
}

export function createGridSnapMarker(color) {
  const group = new THREE.Group();
  group.name = "GridSnapMarker";
  group.visible = false;
  group.renderOrder = 20;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.22, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  const cross = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.32, 0, 0), new THREE.Vector3(0.32, 0, 0),
      new THREE.Vector3(0, 0, -0.32), new THREE.Vector3(0, 0, 0.32),
    ]),
    new THREE.LineBasicMaterial({ color, depthTest: false }),
  );
  group.add(ring, cross);
  return group;
}

export function updateGridSnapMarker(marker, position, visible) {
  marker.visible = visible;
  if (visible) marker.position.set(position.x, 0.035, position.z);
}
