import * as THREE from "three";

import { addEquipmentLabel, addGeometry } from "./generatorHelpers";

export function generateTank({ type, dimensions, appearance, edgeColor, sceneTheme, label, showEdges }) {
  const { width, height, depth } = dimensions;
  const group = new THREE.Group();
  const options = { appearance, edgeColor, showEdges };

  if (type === "SQUARE_TANK") {
    addGeometry(group, new THREE.BoxGeometry(width, height, depth), { ...options, position: [0, height / 2, 0] });
  } else if (type === "HOPPER") {
    addGeometry(group, new THREE.CylinderGeometry(width / 2, width * 0.18, height, 4), { ...options, position: [0, height / 2, 0] });
  } else if (type === "TANK_HORIZONTAL" || type === "PRESSURE_VESSEL") {
    addGeometry(group, new THREE.CapsuleGeometry(height / 2, Math.max(0.1, width - height), 6, 20), {
      ...options,
      position: [0, height / 2 + 0.15, 0],
      rotation: [0, 0, Math.PI / 2],
    });
  } else {
    addGeometry(group, new THREE.CylinderGeometry(width / 2, depth / 2, height, 28), { ...options, position: [0, height / 2, 0] });
  }

  addEquipmentLabel(group, label, height + 0.2, width, edgeColor, sceneTheme);
  return group;
}
