import * as THREE from "three";

import { getMaterialPreset, normalizeMaterialAppearance } from "@/features/digitalTwin/editor/constants/materialPresets";
import { resolveObjectModelId } from "@/features/digitalTwin/editor/constants/objectModelRegistry";
import { acquireSharedGeometry } from "@/features/digitalTwin/editor/three/sharedGeometryCache";
import { createPresetMaterial } from "@/features/digitalTwin/editor/three/presetMaterial";

const round = (value) => Math.round(Number(value) * 1000) / 1000;
const geometryKey = (type, values) => `${type}:${values.map(round).join(":")}`;
const boxGeometry = (width, height, depth) => acquireSharedGeometry(
  geometryKey("box", [width, height, depth]),
  () => new THREE.BoxGeometry(width, height, depth),
);
const cylinderGeometry = (radiusTop, radiusBottom, height, segments = 12) => acquireSharedGeometry(
  geometryKey("cylinder", [radiusTop, radiusBottom, height, segments]),
  () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
);
const sphereGeometry = (radius, widthSegments = 12, heightSegments = 8) => acquireSharedGeometry(
  geometryKey("sphere", [radius, widthSegments, heightSegments]),
  () => new THREE.SphereGeometry(radius, widthSegments, heightSegments),
);
const torusGeometry = (radius, tube, radialSegments = 8, tubularSegments = 16) => acquireSharedGeometry(
  geometryKey("torus", [radius, tube, radialSegments, tubularSegments]),
  () => new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments),
);

function slotAppearance(structure, definition, slotId, fallback = {}) {
  const slot = definition.materialSlots?.find((item) => item.id === slotId);
  const preset = getMaterialPreset(slot?.defaultAppearance?.materialPreset ?? structure.appearance?.materialPreset);
  return normalizeMaterialAppearance({
    ...preset,
    ...structure.appearance,
    ...slot?.defaultAppearance,
    ...fallback,
    ...structure.appearanceSlots?.[slotId],
  });
}

function addPart(group, geometry, appearance, position, rotation = [0, 0, 0], options = {}) {
  const mesh = new THREE.Mesh(geometry, createPresetMaterial(appearance, options.materialOverrides));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  mesh.userData.materialSlot = options.slotId;
  group.add(mesh);
  if (options.edgeColor != null) {
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 32),
      new THREE.LineBasicMaterial({ color: options.edgeColor, transparent: true, opacity: 0.72 }),
    );
    edge.position.copy(mesh.position);
    edge.rotation.copy(mesh.rotation);
    group.add(edge);
  }
  return mesh;
}

function addBox(group, size, appearance, position, options = {}) {
  return addPart(group, boxGeometry(...size), appearance, position, options.rotation, options);
}

function buildDesk(structure, dimensions, definition, selected, edgeColor) {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d } = dimensions;
  const primary = slotAppearance(structure, definition, "primary");
  const frame = slotAppearance(structure, definition, "frame");
  const top = Math.max(0.035, h * 0.055);
  const leg = Math.min(0.07, w * 0.045);
  const edge = selected ? edgeColor : null;
  addBox(group, [w, top, d], primary, [0, h - top / 2, 0], { slotId: "primary", edgeColor: edge });
  if (["EXECUTIVE_DESK", "SCHOOL_DESK"].includes(resolveObjectModelId(structure.type))) {
    addBox(group, [w * 0.88, h * 0.42, Math.min(0.045, d * 0.08)], primary, [0, h * 0.48, d * 0.42], { slotId: "primary" });
  }
  const modelId = resolveObjectModelId(structure.type);
  if (modelId === "L_SHAPED_DESK") {
    addBox(group, [w * 0.48, top, d * 0.72], primary, [w * 0.26, h - top / 2, d * 0.34], { slotId: "primary", edgeColor: edge });
  }
  if (modelId === "DOUBLE_OFFICE_DESK") {
    addBox(group, [w * 0.92, h * 0.27, 0.035], frame, [0, h + h * 0.13, 0], { slotId: "frame" });
  }
  const legXs = [-w / 2 + leg, w / 2 - leg];
  const legZs = modelId === "DOUBLE_OFFICE_DESK" ? [-d / 2 + leg, d / 2 - leg] : [-d / 2 + leg, d / 2 - leg];
  legXs.forEach((x) => legZs.forEach((z) => addBox(group, [leg, h - top, leg], frame, [x, (h - top) / 2, z], { slotId: "frame" })));
  if (modelId === "STANDING_DESK") {
    legXs.forEach((x) => {
      addBox(group, [leg * 1.5, h * 0.55, leg * 1.5], frame, [x, h * 0.33, 0], { slotId: "frame" });
      addBox(group, [d * 0.8, 0.045, 0.1], frame, [x, 0.025, 0], { slotId: "frame" });
    });
  }
  if (["EXECUTIVE_DESK", "INDUSTRIAL_WORKBENCH"].includes(modelId)) {
    addBox(group, [w * 0.32, h * 0.58, d * 0.72], frame, [w * 0.29, h * 0.29, 0], { slotId: "frame" });
    [0.22, 0.39, 0.56].forEach((ratio) => addBox(group, [w * 0.26, 0.025, d * 0.74], primary, [w * 0.29, h * ratio, d * 0.01], { slotId: "primary" }));
  }
  if (modelId === "SCHOOL_DESK" || modelId === "INDUSTRIAL_WORKBENCH") {
    addBox(group, [w * 0.78, 0.035, d * 0.72], frame, [0, h * 0.33, 0], { slotId: "frame" });
  }
  return group;
}

function buildChair(structure, dimensions, definition, selected, edgeColor) {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d } = dimensions;
  const fabric = slotAppearance(structure, definition, definition.objectType === "CHAIR" ? "fabric" : "primary");
  const frame = slotAppearance(structure, definition, "frame");
  const modelId = resolveObjectModelId(structure.type);
  const seatY = modelId === "BAR_STOOL" ? h * 0.82 : h * 0.48;
  const seatThickness = Math.max(0.045, h * 0.07);
  addBox(group, [w * 0.82, seatThickness, d * 0.78], fabric, [0, seatY, 0], { slotId: "fabric", edgeColor: selected ? edgeColor : null });
  if (modelId !== "BAR_STOOL") {
    addBox(group, [w * 0.82, h * 0.42, Math.max(0.045, d * 0.09)], fabric, [0, seatY + h * 0.25, -d * 0.36], { slotId: "fabric", rotation: [modelId === "LOUNGE_CHAIR" ? -0.2 : 0, 0, 0] });
  }
  if (modelId === "TASK_CHAIR") {
    addPart(group, cylinderGeometry(0.035, 0.035, seatY, 10), frame, [0, seatY / 2, 0], [0, 0, 0], { slotId: "frame" });
    for (let index = 0; index < 5; index += 1) {
      const angle = index * Math.PI * 0.4;
      const x = Math.cos(angle) * w * 0.34;
      const z = Math.sin(angle) * d * 0.34;
      addBox(group, [w * 0.35, 0.035, 0.035], frame, [x / 2, 0.08, z / 2], { slotId: "frame", rotation: [0, -angle, 0] });
      addPart(group, cylinderGeometry(0.04, 0.04, 0.035, 10), frame, [x, 0.04, z], [Math.PI / 2, 0, 0], { slotId: "frame" });
    }
  } else {
    [-1, 1].forEach((xSign) => [-1, 1].forEach((zSign) => addBox(group, [0.035, seatY, 0.035], frame, [xSign * w * 0.34, seatY / 2, zSign * d * 0.3], { slotId: "frame" })));
  }
  if (["TASK_CHAIR", "LOUNGE_CHAIR"].includes(modelId)) {
    [-1, 1].forEach((sign) => {
      addBox(group, [0.04, h * 0.23, 0.04], frame, [sign * w * 0.46, seatY + h * 0.1, 0], { slotId: "frame" });
      addBox(group, [w * 0.22, 0.04, d * 0.42], frame, [sign * w * 0.42, seatY + h * 0.22, -d * 0.03], { slotId: "frame" });
    });
  }
  if (modelId === "BAR_STOOL") addPart(group, torusGeometry(w * 0.32, 0.025), frame, [0, h * 0.36, 0], [Math.PI / 2, 0, 0], { slotId: "frame" });
  return group;
}

function buildTable(structure, dimensions, definition, selected, edgeColor) {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d } = dimensions;
  const primary = slotAppearance(structure, definition, "primary");
  const frame = slotAppearance(structure, definition, "frame");
  const round = ["ROUND_MEETING_TABLE", "CAFE_TABLE"].includes(structure.type);
  if (round) addPart(group, cylinderGeometry(w / 2, w / 2, 0.055, 24), primary, [0, h - 0.028, 0], [0, 0, 0], { slotId: "primary", edgeColor: selected ? edgeColor : null });
  else addBox(group, [w, 0.055, d], primary, [0, h - 0.028, 0], { slotId: "primary", edgeColor: selected ? edgeColor : null });
  if (round) {
    addPart(group, cylinderGeometry(0.07, 0.07, h - 0.055, 12), frame, [0, (h - 0.055) / 2, 0], [0, 0, 0], { slotId: "frame" });
    addPart(group, cylinderGeometry(w * 0.28, w * 0.32, 0.045, 18), frame, [0, 0.023, 0], [0, 0, 0], { slotId: "frame" });
  } else {
    [-1, 1].forEach((xSign) => [-1, 1].forEach((zSign) => addBox(group, [0.055, h - 0.055, 0.055], frame, [xSign * (w / 2 - 0.09), (h - 0.055) / 2, zSign * (d / 2 - 0.09)], { slotId: "frame" })));
  }
  if (structure.type === "MEETING_TABLE") addBox(group, [w * 0.35, 0.012, d * 0.08], frame, [0, h + 0.008, 0], { slotId: "frame" });
  if (structure.type === "SIDE_TABLE") addBox(group, [w * 0.75, 0.035, d * 0.75], primary, [0, h * 0.35, 0], { slotId: "primary" });
  return group;
}

function buildSofa(structure, dimensions, definition, selected, edgeColor) {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d } = dimensions;
  const fabric = slotAppearance(structure, definition, "fabric");
  const frame = slotAppearance(structure, definition, "frame");
  const modelId = structure.type;
  addBox(group, [w, h * 0.28, d * 0.82], frame, [0, h * 0.18, 0], { slotId: "frame" });
  const seatCount = modelId === "SOFA_3_SEAT" ? 3 : modelId === "SOFA_2_SEAT" ? 2 : modelId === "CORNER_SOFA" ? 3 : 1;
  const cushionWidth = w * 0.78 / seatCount;
  for (let index = 0; index < seatCount; index += 1) {
    const x = -w * 0.39 + cushionWidth * (index + 0.5);
    addBox(group, [cushionWidth * 0.94, h * 0.16, d * 0.62], fabric, [x, h * 0.39, d * 0.04], { slotId: "fabric", edgeColor: selected && index === 0 ? edgeColor : null });
    if (modelId !== "LOUNGE_BENCH") addBox(group, [cushionWidth * 0.94, h * 0.43, d * 0.15], fabric, [x, h * 0.65, -d * 0.34], { slotId: "fabric", rotation: [-0.08, 0, 0] });
  }
  if (modelId !== "LOUNGE_BENCH") [-1, 1].forEach((sign) => addBox(group, [w * 0.1, h * 0.46, d * 0.78], fabric, [sign * w * 0.45, h * 0.43, 0], { slotId: "fabric" }));
  if (modelId === "CORNER_SOFA") {
    addBox(group, [w * 0.42, h * 0.28, d * 0.75], frame, [w * 0.28, h * 0.18, d * 0.42], { slotId: "frame" });
    addBox(group, [w * 0.36, h * 0.16, d * 0.72], fabric, [w * 0.28, h * 0.39, d * 0.42], { slotId: "fabric" });
  }
  return group;
}

function buildStorage(structure, dimensions, definition, selected, edgeColor) {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d } = dimensions;
  const body = slotAppearance(structure, definition, structure.type === "OPEN_BOOKSHELF" ? "primary" : "body");
  const hardware = slotAppearance(structure, definition, structure.type === "OPEN_BOOKSHELF" ? "frame" : "hardware");
  const side = Math.max(0.025, w * 0.035);
  addBox(group, [side, h, d], body, [-w / 2 + side / 2, h / 2, 0], { slotId: "body", edgeColor: selected ? edgeColor : null });
  addBox(group, [side, h, d], body, [w / 2 - side / 2, h / 2, 0], { slotId: "body" });
  addBox(group, [w, side, d], body, [0, side / 2, 0], { slotId: "body" });
  const shelfCount = structure.type === "FILING_CABINET" ? 4 : structure.type === "PERSONAL_LOCKER" ? 3 : 5;
  for (let index = 1; index <= shelfCount; index += 1) {
    const y = h * index / shelfCount;
    addBox(group, [w - side * 2, side, d * 0.92], body, [0, Math.min(h - side / 2, y), 0], { slotId: "body" });
  }
  if (structure.type !== "OPEN_BOOKSHELF") {
    const columns = structure.type === "PERSONAL_LOCKER" ? 2 : 1;
    for (let column = 0; column < columns; column += 1) {
      const x = columns === 1 ? 0 : (column === 0 ? -1 : 1) * w * 0.245;
      addBox(group, [w / columns - side * 1.6, h - side * 2, 0.025], body, [x, h / 2, d / 2 + 0.014], { slotId: "body" });
      addBox(group, [0.055, 0.018, 0.035], hardware, [x + w / columns * 0.28, h * 0.52, d / 2 + 0.04], { slotId: "hardware" });
    }
  }
  return group;
}

function buildWindowOrDoor(structure, dimensions, definition, selected, edgeColor) {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d } = dimensions;
  const isWindow = definition.objectType === "WINDOW";
  const panel = slotAppearance(structure, definition, isWindow ? "glass" : "primary");
  const frame = slotAppearance(structure, definition, "frame", { materialPreset: "ALUMINUM", color: "#66757B" });
  const frameWidth = Math.max(0.045, Math.min(w, h) * 0.055);
  addBox(group, [w, frameWidth, d], frame, [0, frameWidth / 2, 0], { slotId: "frame" });
  addBox(group, [w, frameWidth, d], frame, [0, h - frameWidth / 2, 0], { slotId: "frame" });
  [-1, 1].forEach((sign) => addBox(group, [frameWidth, h, d], frame, [sign * (w - frameWidth) / 2, h / 2, 0], { slotId: "frame" }));
  addBox(group, [w - frameWidth * 2, h - frameWidth * 2, Math.max(0.018, d * 0.2)], panel, [0, h / 2, 0], { slotId: isWindow ? "glass" : "primary", edgeColor: selected ? edgeColor : null });
  if (["SLIDING_WINDOW", "CASEMENT_WINDOW"].includes(structure.type)) addBox(group, [frameWidth, h - frameWidth * 2, d * 1.08], frame, [0, h / 2, 0], { slotId: "frame" });
  if (!isWindow) {
    addPart(group, sphereGeometry(Math.max(0.025, w * 0.025), 10, 7), frame, [w * 0.32, h * 0.48, d * 0.62], [0, 0, 0], { slotId: "frame" });
  }
  return group;
}

function buildLight(structure, dimensions, definition, selected, edgeColor) {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d } = dimensions;
  const body = slotAppearance(structure, definition, "body", { emissive: "#FFF0C2", emissiveIntensity: 0.55 });
  const frame = slotAppearance(structure, definition, "frame", { materialPreset: "PAINTED_METAL", color: "#616C71" });
  if (structure.type === "LINEAR_LIGHT") {
    addBox(group, [w, h, d], body, [0, h / 2, 0], { edgeColor: selected ? edgeColor : null });
  } else if (structure.type === "PENDANT_LIGHT") {
    addPart(group, cylinderGeometry(0.012, 0.012, h * 0.55, 8), frame, [0, h * 0.72, 0]);
    addPart(group, cylinderGeometry(w * 0.18, w * 0.5, h * 0.35, 18), body, [0, h * 0.28, 0], [0, 0, 0], { edgeColor: selected ? edgeColor : null });
  } else {
    addPart(group, cylinderGeometry(w * 0.22, w * 0.28, 0.05, 18), frame, [0, 0.025, 0]);
    addPart(group, cylinderGeometry(0.018, 0.018, h * 0.78, 8), frame, [0, h * 0.4, 0]);
    addPart(group, cylinderGeometry(w * 0.18, w * 0.48, h * 0.25, 18), body, [0, h * 0.86, 0], [0, 0, 0], { edgeColor: selected ? edgeColor : null });
  }
  return group;
}

function buildAppliance(structure, dimensions, definition, selected, edgeColor) {
  const group = buildStorage(structure, dimensions, definition, selected, edgeColor);
  const { width: w, height: h, depth: d } = dimensions;
  const detail = slotAppearance(structure, definition, definition.materialSlots?.some((slot) => slot.id === "glass") ? "glass" : "hardware");
  if (structure.type === "WATER_DISPENSER") {
    addBox(group, [w * 0.55, h * 0.2, 0.035], detail, [0, h * 0.65, d / 2 + 0.03], { slotId: "hardware" });
    addPart(group, cylinderGeometry(0.018, 0.018, 0.08, 8), detail, [0, h * 0.61, d / 2 + 0.08], [Math.PI / 2, 0, 0], { slotId: "hardware" });
  } else if (structure.type === "VENDING_MACHINE") {
    addBox(group, [w * 0.62, h * 0.58, 0.025], detail, [-w * 0.12, h * 0.64, d / 2 + 0.03], { slotId: "glass" });
  }
  return group;
}

function buildSanitary(structure, dimensions, definition, selected, edgeColor) {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d } = dimensions;
  const ceramic = slotAppearance(structure, definition, "body", { materialPreset: "CERAMIC", color: "#E3E8E9" });
  const metal = slotAppearance(structure, definition, "hardware", { materialPreset: "STAINLESS", color: "#B8C2C5" });
  if (structure.type === "TOILET") {
    addPart(group, cylinderGeometry(w * 0.45, w * 0.38, h * 0.42, 18), ceramic, [0, h * 0.22, d * 0.08], [0, 0, 0], { edgeColor: selected ? edgeColor : null });
    addBox(group, [w * 0.9, h * 0.48, d * 0.35], ceramic, [0, h * 0.56, -d * 0.28]);
    addPart(group, torusGeometry(w * 0.32, w * 0.055, 8, 20), ceramic, [0, h * 0.45, d * 0.12], [Math.PI / 2, 0, 0]);
  } else if (structure.type === "WASH_BASIN") {
    addPart(group, cylinderGeometry(w * 0.48, w * 0.38, h * 0.16, 20), ceramic, [0, h * 0.78, 0], [0, 0, 0], { edgeColor: selected ? edgeColor : null });
    addBox(group, [w * 0.18, h * 0.62, d * 0.28], ceramic, [0, h * 0.34, -d * 0.08]);
    addPart(group, cylinderGeometry(0.018, 0.018, h * 0.18, 8), metal, [0, h * 0.94, -d * 0.08]);
  } else {
    addPart(group, cylinderGeometry(w * 0.46, w * 0.28, h * 0.64, 18), ceramic, [0, h * 0.42, 0], [0, 0, 0], { edgeColor: selected ? edgeColor : null });
    addPart(group, cylinderGeometry(0.015, 0.015, h * 0.3, 8), metal, [0, h * 0.88, 0]);
  }
  return group;
}

function buildPlant(structure, dimensions, definition, selected, edgeColor) {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d } = dimensions;
  const pot = slotAppearance(structure, definition, "pot", { materialPreset: "STONE", color: "#74736B" });
  const leaf = slotAppearance(structure, definition, "leaf", { materialPreset: "PLASTIC", color: "#4E7656", roughness: 0.86 });
  const trunk = slotAppearance(structure, definition, "trunk", { materialPreset: "WOOD", color: "#6F523C" });
  if (structure.type === "PLANTER_BOX") {
    addBox(group, [w, h * 0.55, d], pot, [0, h * 0.275, 0], { edgeColor: selected ? edgeColor : null });
    for (let index = 0; index < 5; index += 1) addPart(group, sphereGeometry(Math.min(w, d) * 0.34, 10, 7), leaf, [-w * 0.38 + index * w * 0.19, h * 0.72, 0]);
  } else {
    addPart(group, cylinderGeometry(w * 0.24, w * 0.18, h * 0.26, 14), pot, [0, h * 0.13, 0], [0, 0, 0], { edgeColor: selected ? edgeColor : null });
    addPart(group, cylinderGeometry(w * 0.055, w * 0.075, h * 0.5, 9), trunk, [0, h * 0.46, 0]);
    const crownY = structure.type === "TALL_PLANT" ? [0.48, 0.64, 0.8] : [0.58, 0.72, 0.84];
    crownY.forEach((ratio, index) => addPart(group, sphereGeometry(w * (0.28 + index * 0.05), 10, 7), leaf, [(index - 1) * w * 0.12, h * ratio, (index % 2 ? 1 : -1) * d * 0.08]));
  }
  return group;
}

const FAMILY_BUILDERS = Object.freeze({
  DESK: buildDesk,
  CHAIR: buildChair,
  TABLE: buildTable,
  SOFA: buildSofa,
  STORAGE: buildStorage,
  DOOR: buildWindowOrDoor,
  WINDOW: buildWindowOrDoor,
  LIGHTING: buildLight,
  APPLIANCE: buildAppliance,
  SANITARY: buildSanitary,
  PLANT: buildPlant,
});

export function createProceduralWorldObject(structure, dimensions, definition, { selected = false, edgeColor }) {
  const builder = FAMILY_BUILDERS[definition?.objectType];
  return builder ? builder(structure, dimensions, definition, selected, edgeColor) : null;
}
