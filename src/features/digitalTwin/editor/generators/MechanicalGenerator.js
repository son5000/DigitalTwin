import * as THREE from "three";

import { addEquipmentLabel, addGeometry } from "./generatorHelpers";

export function generateMechanical({ type, dimensions, appearance, edgeColor, sceneTheme, label, showEdges }) {
  const { width, height, depth } = dimensions;
  const group = new THREE.Group();
  const options = { appearance, edgeColor, showEdges };

  addGeometry(group, new THREE.BoxGeometry(width, height * 0.14, depth), { ...options, position: [0, height * 0.07, 0] });
  if (type === "MACHINE_BASE") {
    addGeometry(group, new THREE.BoxGeometry(width, height * 0.72, depth), { ...options, position: [0, height * 0.5, 0] });
  } else {
    addGeometry(group, new THREE.CylinderGeometry(height * 0.34, height * 0.34, width * 0.7, 24), {
      ...options,
      position: [0, height * 0.55, 0],
      rotation: [0, 0, Math.PI / 2],
    });
    addGeometry(group, new THREE.BoxGeometry(width * 0.28, height * 0.45, depth * 0.72), {
      ...options,
      position: [width * 0.3, height * 0.48, 0],
    });
  }
  addEquipmentLabel(group, label, height, width, edgeColor, sceneTheme);
  return group;
}
