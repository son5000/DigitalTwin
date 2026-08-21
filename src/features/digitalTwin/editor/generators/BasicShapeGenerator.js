import * as THREE from "three";

import { addEquipmentLabel, addGeometry } from "./generatorHelpers";

export function generateBasicShape({ type, dimensions, appearance, edgeColor, sceneTheme, label, showEdges }) {
  const { width, height, depth } = dimensions;
  const group = new THREE.Group();
  let geometry;
  let scale = [1, 1, 1];

  if (type === "CYLINDER") {
    geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    scale = [width, height, depth];
  } else if (type === "SPHERE") {
    geometry = new THREE.SphereGeometry(0.5, 24, 16);
    scale = [width, height, depth];
  } else if (type === "CONE") {
    geometry = new THREE.ConeGeometry(0.5, 1, 24);
    scale = [width, height, depth];
  } else if (type === "CAPSULE") {
    geometry = new THREE.CapsuleGeometry(0.5, Math.max(0.05, height / width - 1), 6, 16);
    scale = [width, width, depth];
  } else if (type === "PRISM" || type === "WEDGE") {
    geometry = new THREE.CylinderGeometry(0.7, 0.7, 1, 3);
    scale = [width, height, depth];
  } else {
    geometry = new THREE.BoxGeometry(width, height, depth, type === "ROUNDED_BOX" ? 2 : 1);
  }

  addGeometry(group, geometry, {
    appearance,
    edgeColor,
    position: [0, height / 2, 0],
    scale,
    showEdges,
  });
  addEquipmentLabel(group, label, height, width, edgeColor, sceneTheme);
  return group;
}
