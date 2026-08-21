import * as THREE from "three";

function createGrid(width, depth, color, cellSize = 1) {
  const points = [];
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const maxLines = 220;
  const requestedLines = Math.max(width, depth) / cellSize;
  const displayStep = cellSize * Math.max(1, Math.ceil(requestedLines / maxLines));

  for (let x = -halfWidth; x <= halfWidth + displayStep * 0.25; x += displayStep) {
    const clampedX = Math.min(x, halfWidth);
    points.push(
      new THREE.Vector3(clampedX, 0.008, -halfDepth),
      new THREE.Vector3(clampedX, 0.008, halfDepth),
    );
  }

  for (let z = -halfDepth; z <= halfDepth + displayStep * 0.25; z += displayStep) {
    const clampedZ = Math.min(z, halfDepth);
    points.push(
      new THREE.Vector3(-halfWidth, 0.008, clampedZ),
      new THREE.Vector3(halfWidth, 0.008, clampedZ),
    );
  }

  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
    }),
  );
}

export function createBaseWorld(world, sceneTheme, cellSize = 1) {
  const root = new THREE.Group();
  root.name = "BaseWorld";

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(world.width, world.depth),
    new THREE.MeshStandardMaterial({
      color: sceneTheme.floor,
      roughness: 0.94,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  floor.name = "Floor";
  floor.userData.isEditorFloor = true;
  floor.userData.visibilityType = "FLOOR";
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor, createGrid(world.width, world.depth, sceneTheme.grid, cellSize));

  return { root, floor };
}
