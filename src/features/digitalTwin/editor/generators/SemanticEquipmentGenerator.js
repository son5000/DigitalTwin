import * as THREE from "three";

import { getMaterialPreset, normalizeMaterialAppearance } from "@/features/digitalTwin/editor/constants/materialPresets";
import { acquireSharedGeometry } from "@/features/digitalTwin/editor/three/sharedGeometryCache";
import { createPresetMaterial } from "@/features/digitalTwin/editor/three/presetMaterial";

import { addEquipmentLabel } from "./generatorHelpers";

const round = (value) => Math.round(Number(value) * 1000) / 1000;
const cached = (type, values, factory) => acquireSharedGeometry(`${type}:${values.map(round).join(":")}`, factory);
const box = (width, height, depth) => cached("equipment-box", [width, height, depth], () => new THREE.BoxGeometry(width, height, depth));
const cylinder = (top, bottom, height, segments = 12) => cached("equipment-cylinder", [top, bottom, height, segments], () => new THREE.CylinderGeometry(top, bottom, height, segments));
const sphere = (radius) => cached("equipment-sphere", [radius], () => new THREE.SphereGeometry(radius, 12, 8));
const torus = (radius, tube) => cached("equipment-torus", [radius, tube], () => new THREE.TorusGeometry(radius, tube, 8, 18));

function resolveAppearance(appearance, appearanceSlots, slot, fallback) {
  const preset = getMaterialPreset(fallback.materialPreset ?? appearance.materialPreset);
  return normalizeMaterialAppearance({ ...preset, ...appearance, ...fallback, ...appearanceSlots?.[slot] });
}

function add(group, geometry, appearance, position, rotation = [0, 0, 0], slot) {
  const mesh = new THREE.Mesh(geometry, createPresetMaterial(appearance));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.materialSlot = slot;
  group.add(mesh);
  return mesh;
}

function buildSafety(type, dimensions, body, hardware) {
  const { width: w, height: h, depth: d } = dimensions;
  const group = new THREE.Group();
  if (type === "SAFETY_BARRIER") {
    const post = Math.max(0.05, d * 0.38);
    [-1, 1].forEach((sign) => add(group, box(post, h, post), hardware, [sign * (w - post) / 2, h / 2, 0], [0, 0, 0], "hardware"));
    [0.28, 0.7].forEach((ratio) => add(group, box(w, post, post), body, [0, h * ratio, 0], [0, 0, 0], "body"));
  } else if (type === "BOLLARD") {
    add(group, cylinder(w * 0.48, w * 0.48, h, 16), body, [0, h / 2, 0], [0, 0, 0], "body");
    [0.52, 0.68].forEach((ratio) => add(group, torus(w * 0.49, w * 0.055), hardware, [0, h * ratio, 0], [Math.PI / 2, 0, 0], "hardware"));
    add(group, cylinder(w * 0.7, w * 0.7, 0.035, 16), hardware, [0, 0.018, 0], [0, 0, 0], "hardware");
  } else {
    add(group, cylinder(w * 0.42, w * 0.48, h * 0.72, 18), body, [0, h * 0.4, 0], [0, 0, 0], "body");
    add(group, cylinder(w * 0.18, w * 0.24, h * 0.12, 12), hardware, [0, h * 0.81, 0], [0, 0, 0], "hardware");
    add(group, torus(w * 0.34, w * 0.045), hardware, [0, h * 0.76, 0], [0, 0, 0], "hardware");
    add(group, box(w * 0.42, h * 0.16, d * 0.2), hardware, [w * 0.18, h * 0.9, 0], [0, 0, -0.28], "hardware");
  }
  return group;
}

function buildSensor(type, dimensions, housing, lens) {
  const { width: w, height: h, depth: d } = dimensions;
  const group = new THREE.Group();
  if (["CAMERA", "THERMAL_CAMERA"].includes(type)) {
    add(group, box(w * 0.82, h * 0.68, d * 0.72), housing, [0, h * 0.58, 0], [0, 0, 0], "housing");
    add(group, cylinder(w * 0.22, w * 0.22, d * 0.34, 16), lens, [0, h * 0.58, d * 0.48], [Math.PI / 2, 0, 0], "lens");
    add(group, box(w * 0.12, h * 0.38, d * 0.12), housing, [0, h * 0.2, -d * 0.1], [0, 0, 0], "housing");
    add(group, cylinder(w * 0.38, w * 0.38, 0.035, 14), housing, [0, 0.018, -d * 0.1], [0, 0, 0], "housing");
    if (type === "THERMAL_CAMERA") add(group, box(w * 0.18, h * 0.22, 0.02), lens, [w * 0.24, h * 0.58, d * 0.38], [0, 0, 0], "lens");
  } else if (type === "SENSOR_CURRENT") {
    add(group, torus(w * 0.32, w * 0.12), housing, [0, h * 0.58, 0], [Math.PI / 2, 0, 0], "housing");
    add(group, box(w * 0.62, h * 0.28, d * 0.6), housing, [0, h * 0.18, 0], [0, 0, 0], "housing");
    add(group, sphere(w * 0.065), lens, [0, h * 0.2, d * 0.32], [0, 0, 0], "lens");
  } else if (type === "SENSOR_VIBRATION") {
    add(group, cylinder(w * 0.42, w * 0.48, h * 0.68, 16), housing, [0, h * 0.36, 0], [0, 0, 0], "housing");
    add(group, cylinder(w * 0.22, w * 0.22, h * 0.32, 12), lens, [0, h * 0.84, 0], [0, 0, 0], "lens");
  } else {
    add(group, box(w, h * 0.78, d), housing, [0, h * 0.45, 0], [0, 0, 0], "housing");
    const sensorCount = type === "SENSOR_GAS" ? 4 : 2;
    for (let index = 0; index < sensorCount; index += 1) {
      const x = (index - (sensorCount - 1) / 2) * w * 0.18;
      add(group, sphere(w * 0.055), lens, [x, h * 0.52, d / 2 + 0.015], [0, 0, 0], "lens");
    }
    if (type === "SENSOR_TEMPERATURE") add(group, cylinder(w * 0.06, w * 0.06, h * 0.34, 8), lens, [0, h * 0.12, 0], [0, 0, 0], "lens");
  }
  return group;
}

function buildUtility(type, dimensions, body, detail) {
  const { width: w, height: h, depth: d } = dimensions;
  const group = new THREE.Group();
  if (type === "CABLE_TRAY") {
    add(group, box(w, h * 0.16, d * 0.08), body, [0, h * 0.5, -d * 0.46], [0, 0, 0], "body");
    add(group, box(w, h * 0.16, d * 0.08), body, [0, h * 0.5, d * 0.46], [0, 0, 0], "body");
    for (let index = 0; index < 7; index += 1) add(group, box(w * 0.035, h * 0.1, d), body, [-w / 2 + w * index / 6, h * 0.48, 0], [0, 0, 0], "body");
  } else if (type === "WORK_LIGHT") {
    add(group, box(w, h * 0.62, d), body, [0, h * 0.5, 0], [0, 0, 0], "body");
    add(group, box(w * 0.78, h * 0.38, 0.02), detail, [0, h * 0.54, d / 2 + 0.015], [0, 0, 0], "detail");
    [-1, 1].forEach((sign) => add(group, box(w * 0.06, h * 0.8, d * 0.08), body, [sign * w * 0.47, h * 0.48, 0], [0, 0, 0], "body"));
  } else {
    [-1, 1].forEach((xSign) => [-1, 1].forEach((zSign) => add(group, box(w * 0.08, h, d * 0.08), body, [xSign * w * 0.42, h / 2, zSign * d * 0.42], [0, 0, 0], "body")));
    add(group, box(w, h * 0.1, d), body, [0, h * 0.92, 0], [0, 0, 0], "body");
    add(group, box(w * 0.72, h * 0.06, d * 0.72), detail, [0, h * 0.5, 0], [0, 0, 0], "detail");
  }
  return group;
}

export function generateSemanticEquipment({ type, dimensions, appearance, appearanceSlots, edgeColor, sceneTheme, label }) {
  const body = resolveAppearance(appearance, appearanceSlots, "body", { materialPreset: "PAINTED_METAL" });
  const hardware = resolveAppearance(appearance, appearanceSlots, "hardware", { materialPreset: "STEEL", color: "#59666B" });
  const housing = resolveAppearance(appearance, appearanceSlots, "housing", { materialPreset: "PLASTIC", color: "#D5DDE0" });
  const lens = resolveAppearance(appearance, appearanceSlots, "lens", { materialPreset: "GLASS", color: "#3D7FA2", opacity: 0.72 });
  const detail = resolveAppearance(appearance, appearanceSlots, "detail", { materialPreset: "PLASTIC", color: "#D7C067" });
  const category = type.startsWith("SENSOR_") || ["CAMERA", "THERMAL_CAMERA", "GENERIC_SENSOR"].includes(type)
    ? "SENSOR"
    : ["SAFETY_BARRIER", "BOLLARD", "FIRE_EXTINGUISHER"].includes(type)
      ? "SAFETY"
      : "UTILITY";
  const group = category === "SENSOR"
    ? buildSensor(type, dimensions, housing, lens)
    : category === "SAFETY"
      ? buildSafety(type, dimensions, body, hardware)
      : buildUtility(type, dimensions, body, detail);
  addEquipmentLabel(group, label, dimensions.height, dimensions.width, edgeColor, sceneTheme);
  return group;
}
