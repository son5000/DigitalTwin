import * as THREE from "three";

import { addEquipmentLabel, addGeometry } from "./generatorHelpers";

function createLineSegments(points, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color });

  return new THREE.LineSegments(geometry, material);
}

export function generateCabinet({
  type,
  dimensions,
  label,
  edgeColor,
  sceneTheme,
  appearance,
  showEdges,
}) {
  const { width, height, depth } = dimensions;
  const group = new THREE.Group();
  const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
  addGeometry(group, bodyGeometry, {
    appearance,
    edgeColor,
    position: [0, height / 2, 0],
    showEdges,
  });

  const frontZ = depth / 2 + 0.008;
  const headerHeight = Math.min(0.32, Math.max(0.2, height * 0.16));
  const headerBottom = height - headerHeight;
  const seamPoints = [
    new THREE.Vector3(-width / 2, headerBottom, frontZ),
    new THREE.Vector3(width / 2, headerBottom, frontZ),
  ];

  if (type === "CABINET_DOUBLE") {
    seamPoints.push(
      new THREE.Vector3(0, 0, frontZ),
      new THREE.Vector3(0, headerBottom, frontZ),
    );
  }

  group.add(createLineSegments(seamPoints, edgeColor));

  const plateWidth = Math.max(0.3, width * 0.68);
  const plateHeight = Math.min(0.16, headerHeight * 0.52);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(plateWidth, plateHeight, 0.025),
    new THREE.MeshBasicMaterial({
      color: sceneTheme.cabinetPlate,
      transparent: true,
      opacity: 0.9,
    }),
  );
  plate.position.set(0, headerBottom + headerHeight / 2, frontZ + 0.014);
  group.add(plate);

  addEquipmentLabel(group, label, height, width, edgeColor, sceneTheme);

  return group;
}
