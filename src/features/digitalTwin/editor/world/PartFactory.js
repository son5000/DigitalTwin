import * as THREE from "three";

const PART_STATUS_COLORS = {
  WARNING: "#D99A36",
  ALARM: "#D64545",
  MAINTENANCE: "#6F82A8",
};

export function getPartWorldDimensions(part, equipment) {
  return {
    x: Math.max(0.02, part.dimensions.x * equipment.dimensions.width),
    y: Math.max(0.02, part.dimensions.y * equipment.dimensions.height),
    z: Math.max(0.02, part.dimensions.z * equipment.dimensions.depth),
  };
}

export function getPartWorldPosition(part, equipment) {
  return {
    x: part.position.x * equipment.dimensions.width,
    y: part.position.y * equipment.dimensions.height,
    z: part.position.z * equipment.dimensions.depth,
  };
}

export function getPartSignature(part, equipment, selected, theme) {
  return JSON.stringify({ part, equipmentDimensions: equipment.dimensions, selected, theme });
}

function createPartGeometry(part, dimensions) {
  if (part.shape === "SPHERE") {
    return new THREE.SphereGeometry(Math.min(dimensions.x, dimensions.y, dimensions.z) / 2, 24, 16);
  }
  if (part.shape === "CYLINDER_X") {
    const geometry = new THREE.CylinderGeometry(dimensions.y / 2, dimensions.y / 2, dimensions.x, 24);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }
  if (part.shape === "CYLINDER_Y") {
    return new THREE.CylinderGeometry(dimensions.x / 2, dimensions.x / 2, dimensions.y, 24);
  }
  return new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z);
}

export function createPartObject(part, equipment, visualState) {
  const dimensions = getPartWorldDimensions(part, equipment);
  const geometry = createPartGeometry(part, dimensions);
  const material = new THREE.MeshStandardMaterial({
    color: PART_STATUS_COLORS[part.status] ?? part.appearance.color,
    roughness: 0.56,
    metalness: 0.14,
    transparent: part.appearance.opacity < 1,
    opacity: part.appearance.opacity,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = part.name;
  mesh.userData.partId = part.id;
  mesh.userData.domain = "PART";
  mesh.userData.geometrySignature = getPartSignature(part, equipment, visualState.selected, visualState.theme);
  if (visualState.selected) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 18),
      new THREE.LineBasicMaterial({ color: visualState.selectionColor }),
    );
    edges.userData.partId = part.id;
    mesh.add(edges);
  }
  const position = getPartWorldPosition(part, equipment);
  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z);
  mesh.visible = part.visible;
  return mesh;
}
