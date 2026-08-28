import * as THREE from "three";

import { addEquipmentLabel, addGeometry } from "./generatorHelpers";
import { getMaterialPreset, normalizeMaterialAppearance } from "@/features/digitalTwin/editor/constants/materialPresets";

function slotAppearance(appearance, appearanceSlots, slot, fallback) {
  return normalizeMaterialAppearance({
    ...getMaterialPreset(fallback.materialPreset),
    ...appearance,
    ...fallback,
    ...appearanceSlots?.[slot],
  });
}

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
  appearanceSlots,
  showEdges,
}) {
  const { width, height, depth } = dimensions;
  const group = new THREE.Group();
  const bodyAppearance = slotAppearance(appearance, appearanceSlots, "body", { materialPreset: "PAINTED_METAL" });
  const hardwareAppearance = slotAppearance(appearance, appearanceSlots, "hardware", { materialPreset: "STAINLESS", color: "#AAB4B8" });
  const bodyGeometry = new THREE.BoxGeometry(width, height, depth);
  addGeometry(group, bodyGeometry, {
    appearance: bodyAppearance,
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

  const doorColumns = ["CABINET_DOUBLE", "CABINET_VERTICAL_SPLIT", "SWITCHBOARD", "MCC_PANEL"].includes(type) ? 2 : 1;
  const doorRows = ["CABINET_HORIZONTAL_SPLIT", "BATTERY_CABINET", "DISTRIBUTION_PANEL"].includes(type) ? 2 : 1;
  for (let column = 0; column < doorColumns; column += 1) {
    for (let row = 0; row < doorRows; row += 1) {
      const centerX = -width / 2 + width * (column + 0.5) / doorColumns;
      const centerY = height * (row + 0.5) / doorRows;
      addGeometry(group, new THREE.BoxGeometry(0.035, Math.min(0.18, height / doorRows * 0.22), 0.035), {
        appearance: hardwareAppearance,
        edgeColor,
        position: [centerX + width / doorColumns * 0.3, centerY, frontZ + 0.035],
        showEdges: false,
      });
    }
  }

  if (["SERVER_RACK", "RACK", "UPS", "TRANSFORMER"].includes(type)) {
    for (let index = 0; index < 5; index += 1) {
      addGeometry(group, new THREE.BoxGeometry(width * 0.58, 0.018, 0.018), {
        appearance: hardwareAppearance,
        edgeColor,
        position: [0, height * (0.22 + index * 0.1), frontZ + 0.035],
        showEdges: false,
      });
    }
  }

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
