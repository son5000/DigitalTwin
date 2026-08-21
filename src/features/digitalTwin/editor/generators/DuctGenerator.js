import * as THREE from "three";

import { addEquipmentLabel, addGeometry } from "./generatorHelpers";

export function generateDuct({ type, dimensions, appearance, edgeColor, sceneTheme, label, showEdges }) {
  const { width, height, depth } = dimensions;
  const group = new THREE.Group();
  const options = { appearance, edgeColor, showEdges };

  if (type === "AIR_TERMINAL") {
    addGeometry(group, new THREE.BoxGeometry(width, height, depth), { ...options, position: [0, height / 2, 0] });
  } else if (type === "DUCT_ELBOW") {
    addGeometry(group, new THREE.BoxGeometry(width / 2, height, depth), { ...options, position: [-width / 4, height / 2, 0] });
    addGeometry(group, new THREE.BoxGeometry(width, height, depth / 2), { ...options, position: [0, height / 2, depth / 4] });
  } else {
    addGeometry(group, new THREE.BoxGeometry(width, height, depth), { ...options, position: [0, height / 2, 0] });
  }
  addEquipmentLabel(group, label, height, width, edgeColor, sceneTheme);
  return group;
}
