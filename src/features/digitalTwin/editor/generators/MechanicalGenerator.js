import * as THREE from "three";

import { getMaterialPreset, normalizeMaterialAppearance } from "@/features/digitalTwin/editor/constants/materialPresets";

import { addEquipmentLabel, addGeometry } from "./generatorHelpers";

function slotAppearance(appearance, appearanceSlots, slot, fallback) {
  return normalizeMaterialAppearance({ ...getMaterialPreset(fallback.materialPreset), ...appearance, ...fallback, ...appearanceSlots?.[slot] });
}

export function generateMechanical({ type, dimensions, appearance, appearanceSlots, edgeColor, sceneTheme, label, showEdges }) {
  const { width, height, depth } = dimensions;
  const group = new THREE.Group();
  const body = slotAppearance(appearance, appearanceSlots, "body", { materialPreset: "PAINTED_METAL" });
  const frame = slotAppearance(appearance, appearanceSlots, "frame", { materialPreset: "STEEL", color: "#59666B" });
  const bodyOptions = { appearance: body, edgeColor, showEdges, materialSlot: "body" };
  const frameOptions = { appearance: frame, edgeColor, showEdges: false, materialSlot: "frame" };

  addGeometry(group, new THREE.BoxGeometry(width, height * 0.12, depth), { ...frameOptions, position: [0, height * 0.06, 0] });
  if (type === "MACHINE_BASE") {
    addGeometry(group, new THREE.BoxGeometry(width, height * 0.72, depth), { ...bodyOptions, position: [0, height * 0.5, 0] });
  } else if (type === "PUMP") {
    addGeometry(group, new THREE.SphereGeometry(height * 0.28, 18, 12), { ...bodyOptions, position: [-width * 0.22, height * 0.5, 0] });
    addGeometry(group, new THREE.CylinderGeometry(height * 0.2, height * 0.2, width * 0.44, 18), { ...bodyOptions, position: [width * 0.2, height * 0.48, 0], rotation: [0, 0, Math.PI / 2] });
    addGeometry(group, new THREE.CylinderGeometry(height * 0.11, height * 0.11, height * 0.42, 14), { ...frameOptions, position: [-width * 0.22, height * 0.78, 0] });
  } else if (type === "COMPRESSOR") {
    addGeometry(group, new THREE.CapsuleGeometry(height * 0.2, Math.max(0.12, width * 0.55), 5, 16), { ...bodyOptions, position: [0, height * 0.35, 0], rotation: [0, 0, Math.PI / 2] });
    addGeometry(group, new THREE.BoxGeometry(width * 0.42, height * 0.32, depth * 0.62), { ...bodyOptions, position: [-width * 0.14, height * 0.72, 0] });
    addGeometry(group, new THREE.CylinderGeometry(height * 0.11, height * 0.11, width * 0.28, 16), { ...frameOptions, position: [width * 0.26, height * 0.69, 0], rotation: [0, 0, Math.PI / 2] });
  } else if (["FAN", "BLOWER"].includes(type)) {
    addGeometry(group, new THREE.TorusGeometry(Math.min(height, depth) * 0.28, Math.min(height, depth) * 0.08, 10, 24), { ...bodyOptions, position: [-width * 0.12, height * 0.55, 0], rotation: [0, Math.PI / 2, 0] });
    for (let index = 0; index < 5; index += 1) {
      addGeometry(group, new THREE.BoxGeometry(width * 0.03, height * 0.24, depth * 0.08), { ...frameOptions, position: [-width * 0.12, height * 0.55, 0], rotation: [Math.PI / 2, 0, index * Math.PI * 0.4] });
    }
    addGeometry(group, new THREE.BoxGeometry(width * 0.34, height * 0.36, depth * 0.5), { ...bodyOptions, position: [width * 0.28, height * 0.48, 0] });
  } else if (["CHILLER", "GENERATOR"].includes(type)) {
    addGeometry(group, new THREE.BoxGeometry(width * 0.9, height * 0.72, depth * 0.88), { ...bodyOptions, position: [0, height * 0.5, 0] });
    for (let index = 0; index < 5; index += 1) {
      addGeometry(group, new THREE.BoxGeometry(width * 0.46, 0.018, 0.018), { ...frameOptions, position: [width * 0.18, height * (0.3 + index * 0.08), depth * 0.45] });
    }
    if (type === "CHILLER") [-1, 1].forEach((sign) => addGeometry(group, new THREE.CylinderGeometry(depth * 0.22, depth * 0.22, 0.05, 18), { ...frameOptions, position: [sign * width * 0.25, height * 0.88, 0] }));
  } else if (["BOILER", "HEAT_EXCHANGER"].includes(type)) {
    addGeometry(group, new THREE.CylinderGeometry(depth * 0.42, depth * 0.42, width * 0.74, 22), { ...bodyOptions, position: [0, height * 0.58, 0], rotation: [0, 0, Math.PI / 2] });
    [-1, 1].forEach((sign) => addGeometry(group, new THREE.BoxGeometry(width * 0.08, height * 0.48, depth * 0.1), { ...frameOptions, position: [sign * width * 0.28, height * 0.28, 0] }));
  } else {
    addGeometry(group, new THREE.CylinderGeometry(height * 0.34, height * 0.34, width * 0.7, 24), {
      ...bodyOptions,
      position: [0, height * 0.55, 0],
      rotation: [0, 0, Math.PI / 2],
    });
    addGeometry(group, new THREE.BoxGeometry(width * 0.28, height * 0.45, depth * 0.72), {
      ...frameOptions,
      position: [width * 0.3, height * 0.48, 0],
    });
  }
  addEquipmentLabel(group, label, height, width, edgeColor, sceneTheme);
  return group;
}
