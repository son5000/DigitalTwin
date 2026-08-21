import * as THREE from "three";

function createGrid(width, depth, color) {
  const points = [];
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  for (let x = Math.ceil(-halfWidth); x <= halfWidth; x += 1) {
    points.push(
      new THREE.Vector3(x, 0.008, -halfDepth),
      new THREE.Vector3(x, 0.008, halfDepth),
    );
  }

  for (let z = Math.ceil(-halfDepth); z <= halfDepth; z += 1) {
    points.push(
      new THREE.Vector3(-halfWidth, 0.008, z),
      new THREE.Vector3(halfWidth, 0.008, z),
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

export function createBaseWorld(world, sceneTheme) {
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
  root.add(floor, createGrid(world.width, world.depth, sceneTheme.grid));

  return { root, floor };
}
