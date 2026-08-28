import * as THREE from "three";

import {
  MAX_TREE_COUNT,
  TREE_DEFAULT_SPACING,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import {
  addElevatedSupports,
  createGradedStripGeometry,
  sliceGradedSamples,
} from "@/features/digitalTwin/editor/terrain/GradedRoadFactory";
import { VERTICAL_PATH_MODES } from "@/features/digitalTwin/editor/terrain/VerticalPathModel";

function materialFor(object, selected) {
  const presets = {
    CONCRETE: { roughness: 0.9, metalness: 0.02 },
    ASPHALT: { roughness: 0.98, metalness: 0 },
    METAL: { roughness: 0.55, metalness: 0.62 },
    GRASS: { roughness: 1, metalness: 0 },
    PAINTED: { roughness: 0.62, metalness: 0.18 },
    GLASS: { roughness: 0.14, metalness: 0.28 },
    BRICK: { roughness: 0.96, metalness: 0 },
  };
  return new THREE.MeshStandardMaterial({
    color: object.appearance.color,
    ...(presets[object.appearance.material] ?? presets.CONCRETE),
    transparent: !object.visible,
    opacity: object.visible ? 1 : 0.18,
    emissive: selected ? object.appearance.color : 0x000000,
    emissiveIntensity: selected ? 0.14 : 0,
  });
}

function addEdges(mesh, color) {
  mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  ));
}

function addAreaSurface(group, object, material, edgeColor) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(object.dimensions.width, object.dimensions.height, object.dimensions.depth),
    material,
  );
  mesh.position.y = object.dimensions.height / 2;
  addEdges(mesh, edgeColor);
  group.add(mesh);
  return mesh;
}

function addParkingLines(group, object) {
  const count = Math.min(24, Math.max(1, Math.floor(object.dimensions.width / 2.6)));
  const spacing = object.dimensions.width / count;
  const material = new THREE.MeshBasicMaterial({ color: 0xd7dde0 });
  for (let index = 1; index < count; index += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, object.dimensions.depth * 0.42), material);
    line.position.set(-object.dimensions.width / 2 + spacing * index, object.dimensions.height + 0.008, 0);
    group.add(line);
  }
}

function createTreeGridPositions(object, count) {
  if (count === 1) return [{ x: 0, z: 0 }];

  const width = object.dimensions.width;
  const depth = object.dimensions.depth;
  const spacing = Math.max(0.5, Number(object.parameters.spacing) || TREE_DEFAULT_SPACING);
  const idealColumns = Math.max(1, Math.ceil(width / spacing) + 1);
  const idealRows = Math.max(1, Math.ceil(depth / spacing) + 1);
  const usesIdealGrid = idealColumns * idealRows === count;
  const columns = usesIdealGrid
    ? idealColumns
    : Math.min(count, Math.max(1, Math.round(Math.sqrt(count * width / Math.max(depth, 0.1)))));
  const rows = usesIdealGrid ? idealRows : Math.ceil(count / columns);
  const slots = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      slots.push({
        column,
        row,
        x: columns === 1 ? 0 : -width / 2 + width * column / (columns - 1),
        z: rows === 1 ? 0 : -depth / 2 + depth * row / (rows - 1),
      });
    }
  }

  if (slots.length <= count) return slots;

  const cornerIndexes = [0, slots.length - 1, columns - 1, slots.length - columns];
  const selectedIndexes = [];
  cornerIndexes.forEach((index) => {
    if (selectedIndexes.length < count && !selectedIndexes.includes(index)) selectedIndexes.push(index);
  });

  while (selectedIndexes.length < count) {
    let bestIndex = -1;
    let bestDistance = -1;
    slots.forEach((slot, index) => {
      if (selectedIndexes.includes(index)) return;
      const distance = Math.min(...selectedIndexes.map((selectedIndex) => {
        const selected = slots[selectedIndex];
        const columnDistance = columns === 1 ? 0 : (slot.column - selected.column) / (columns - 1);
        const rowDistance = rows === 1 ? 0 : (slot.row - selected.row) / (rows - 1);
        return columnDistance ** 2 + rowDistance ** 2;
      }));
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex < 0) break;
    selectedIndexes.push(bestIndex);
  }

  return selectedIndexes.map((index) => slots[index]);
}

function addTreeCluster(group, object, crownMaterial) {
  const count = Math.min(MAX_TREE_COUNT, Math.max(1, Math.round(object.parameters.count)));
  const positions = createTreeGridPositions(object, count);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6f563f, roughness: 1 });
  const treeHeight = object.dimensions.height;
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.18, treeHeight * 0.42, 7),
    trunkMaterial,
    positions.length,
  );
  const crownGeometry = object.profile === "CONIFER"
    ? new THREE.ConeGeometry(Math.min(1.35, treeHeight * 0.24), treeHeight * 0.68, 9)
    : object.profile === "SHRUB"
      ? new THREE.SphereGeometry(Math.min(0.65, treeHeight * 0.55), 8, 6)
      : new THREE.IcosahedronGeometry(Math.min(1.3, treeHeight * 0.24), 1);
  const crown = new THREE.InstancedMesh(
    crownGeometry,
    crownMaterial,
    positions.length,
  );
  const matrix = new THREE.Matrix4();
  positions.forEach((position, index) => {
    matrix.makeTranslation(position.x, treeHeight * 0.21, position.z);
    trunk.setMatrixAt(index, matrix);
    matrix.makeTranslation(position.x, treeHeight * 0.66, position.z);
    crown.setMatrixAt(index, matrix);
  });
  trunk.instanceMatrix.needsUpdate = true;
  crown.instanceMatrix.needsUpdate = true;
  group.add(trunk, crown);
}

function standardMaterial(color, material = "PAINTED") {
  const properties = material === "METAL"
    ? { roughness: 0.46, metalness: 0.56 }
    : material === "GLASS"
      ? { roughness: 0.12, metalness: 0.28, transparent: true, opacity: 0.82 }
      : { roughness: 0.78, metalness: 0.08 };
  return new THREE.MeshStandardMaterial({ color, ...properties });
}

function box(group, size, position, material, edgeColor = null) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  if (edgeColor !== null) addEdges(mesh, edgeColor);
  group.add(mesh);
  return mesh;
}

function cylinder(group, radiusTop, radiusBottom, height, position, material, radialSegments = 12, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material);
  mesh.position.set(position.x, position.y, position.z);
  if (rotation) mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  group.add(mesh);
  return mesh;
}

function addWheels(group, width, depth, wheelRadius, wheelCount = 4) {
  const material = standardMaterial(0x293137, "PAINTED");
  const axleRows = wheelCount > 4 ? [-depth * 0.32, 0, depth * 0.34] : [-depth * 0.3, depth * 0.3];
  axleRows.forEach((z) => [-1, 1].forEach((side) => {
    cylinder(group, wheelRadius, wheelRadius, 0.22, { x: side * width * 0.51, y: wheelRadius, z }, material, 12, { z: Math.PI / 2 });
  }));
}

function addVehicle(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  const profile = object.profile;
  const wheelRadius = Math.min(width, height) * (profile === "HEAVY_TRUCK" || profile === "TANKER" ? 0.22 : 0.18);
  addWheels(group, width, depth, wheelRadius, profile === "HEAVY_TRUCK" || profile === "TANKER" ? 6 : 4);
  if (profile === "FORKLIFT") {
    box(group, { x: width, y: height * 0.45, z: depth * 0.62 }, { x: 0, y: wheelRadius + height * 0.2, z: depth * 0.08 }, material, edgeColor);
    box(group, { x: width * 0.78, y: height * 0.5, z: depth * 0.32 }, { x: 0, y: height * 0.62, z: depth * 0.14 }, standardMaterial(0x59666c, "METAL"));
    [-1, 1].forEach((side) => box(group, { x: 0.1, y: height * 0.92, z: 0.12 }, { x: side * width * 0.34, y: height * 0.53, z: -depth * 0.42 }, standardMaterial(0x4f5b60, "METAL")));
    [-1, 1].forEach((side) => box(group, { x: width * 0.34, y: 0.08, z: depth * 0.5 }, { x: side * width * 0.2, y: 0.09, z: -depth * 0.58 }, standardMaterial(0x4f5b60, "METAL")));
    return;
  }
  if (profile === "TANKER") {
    box(group, { x: width * 0.92, y: height * 0.48, z: depth * 0.24 }, { x: 0, y: wheelRadius + height * 0.22, z: depth * 0.36 }, material, edgeColor);
    cylinder(group, width * 0.42, width * 0.42, depth * 0.66, { x: 0, y: wheelRadius + height * 0.46, z: -depth * 0.12 }, standardMaterial(0x9aa6a8, "METAL"), 16, { x: Math.PI / 2 });
    return;
  }
  const isLongBody = ["BUS", "VAN"].includes(profile);
  const isTruck = ["TRUCK", "HEAVY_TRUCK"].includes(profile);
  if (isTruck) {
    box(group, { x: width * 0.9, y: height * 0.7, z: depth * 0.66 }, { x: 0, y: wheelRadius + height * 0.35, z: -depth * 0.15 }, standardMaterial(0x858f92, "PAINTED"), edgeColor);
    box(group, { x: width, y: height * 0.72, z: depth * 0.25 }, { x: 0, y: wheelRadius + height * 0.36, z: depth * 0.35 }, material, edgeColor);
    return;
  }
  box(group, { x: width, y: height * (isLongBody ? 0.62 : 0.46), z: depth * 0.94 }, { x: 0, y: wheelRadius + height * 0.24, z: 0 }, material, edgeColor);
  box(group, { x: width * 0.82, y: height * (isLongBody ? 0.46 : 0.42), z: depth * (isLongBody ? 0.82 : 0.5) }, { x: 0, y: wheelRadius + height * 0.68, z: isLongBody ? 0 : -depth * 0.08 }, standardMaterial(0x5f7e8d, "GLASS"), edgeColor);
}

function addTrafficObject(group, object, material) {
  const { width, depth, height } = object.dimensions;
  const profile = object.profile;
  if (["BARRIER_GATE", "PARKING_GATE"].includes(profile)) {
    box(group, { x: 0.55, y: height, z: depth }, { x: -width / 2 + 0.3, y: height / 2, z: 0 }, material);
    const arm = box(group, { x: width * 0.9, y: 0.14, z: 0.16 }, { x: 0, y: height * 0.78, z: 0 }, standardMaterial(0xe6e3db, "PAINTED"));
    arm.rotation.z = -0.04;
    return;
  }
  if (profile === "ROAD_BARRIER") {
    box(group, { x: width, y: height, z: depth }, { x: 0, y: height / 2, z: 0 }, material);
    return;
  }
  if (profile === "BOLLARD") {
    cylinder(group, width * 0.38, width * 0.48, height, { x: 0, y: height / 2, z: 0 }, material, 12);
    box(group, { x: width * 0.9, y: height * 0.12, z: width * 0.9 }, { x: 0, y: height * 0.7, z: 0 }, standardMaterial(0xd6d2bd));
    return;
  }
  if (profile === "STREETLIGHT") {
    addStreetlights(group, object, material);
    return;
  }
  if (profile === "SECURITY_GATE") {
    [-1, 1].forEach((side) => box(group, { x: 0.45, y: height, z: depth }, { x: side * width * 0.44, y: height / 2, z: 0 }, material));
    box(group, { x: width * 0.78, y: height * 0.65, z: 0.12 }, { x: 0, y: height * 0.48, z: 0 }, material);
    return;
  }
  const poleHeight = height * 0.82;
  cylinder(group, 0.08, 0.11, poleHeight, { x: 0, y: poleHeight / 2, z: 0 }, material, 10);
  if (["TRAFFIC_LIGHT", "PEDESTRIAN_SIGNAL"].includes(profile)) {
    const headHeight = height * 0.34;
    box(group, { x: width, y: headHeight, z: depth }, { x: 0, y: height - headHeight / 2, z: 0 }, standardMaterial(0x29343a, "METAL"));
    const colors = profile === "TRAFFIC_LIGHT" ? [0xb94e45, 0xd6a53d, 0x4f8a65] : [0xb94e45, 0x4f8a65];
    colors.forEach((color, index) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(width * 0.16, 10, 7), standardMaterial(color));
      lamp.position.set(0, height - headHeight * (index + 0.5) / colors.length, depth * 0.52);
      group.add(lamp);
    });
  } else {
    box(group, { x: width, y: height * 0.3, z: depth }, { x: 0, y: height * 0.78, z: 0 }, material);
  }
}

function addLandscape(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  if (object.profile === "ROCK") {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.max(width, depth, height) * 0.42, 0), material);
    rock.scale.set(width / Math.max(width, depth), height / Math.max(width, depth), depth / Math.max(width, depth));
    rock.position.y = height * 0.42;
    rock.rotation.set(0.16, 0.34, -0.08);
    group.add(rock);
    return;
  }
  if (object.profile === "BENCH") {
    [-0.32, 0.32].forEach((x) => box(group, { x: 0.1, y: height * 0.62, z: depth * 0.72 }, { x: x * width, y: height * 0.31, z: 0 }, standardMaterial(0x566066, "METAL")));
    for (let index = 0; index < 4; index += 1) box(group, { x: width, y: 0.08, z: depth * 0.16 }, { x: 0, y: height * (0.48 + index * 0.13), z: depth * (0.16 - index * 0.11) }, material);
    return;
  }
  if (object.profile === "SHELTER") {
    [-1, 1].forEach((x) => [-1, 1].forEach((z) => box(group, { x: 0.1, y: height, z: 0.1 }, { x: x * width * 0.42, y: height / 2, z: z * depth * 0.4 }, standardMaterial(0x59676d, "METAL"))));
    box(group, { x: width, y: 0.14, z: depth }, { x: 0, y: height, z: 0 }, material, edgeColor);
    return;
  }
  if (["FLOWER_BED", "PLANTER", "INDUSTRIAL_GARDEN"].includes(object.profile)) {
    box(group, { x: width, y: Math.min(0.5, height * 0.34), z: depth }, { x: 0, y: Math.min(0.5, height * 0.34) / 2, z: 0 }, standardMaterial(0x8b8b82, "CONCRETE"), edgeColor);
    const plantObject = { ...object, profile: object.profile === "INDUSTRIAL_GARDEN" ? "DECIDUOUS" : "SHRUB", dimensions: { ...object.dimensions, width: width * 0.8, depth: depth * 0.72, height: Math.max(0.7, height * 0.72) }, parameters: { ...object.parameters, count: object.profile === "INDUSTRIAL_GARDEN" ? 5 : 8 } };
    addTreeCluster(group, plantObject, material);
    return;
  }
  addAreaSurface(group, object, material, edgeColor);
}

function addIndustrialEquipment(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  const profile = object.profile;
  const dark = standardMaterial(0x53636a, "METAL");
  box(group, { x: width * 1.08, y: 0.12, z: depth * 1.04 }, { x: 0, y: 0.06, z: 0 }, dark, edgeColor);
  if (["TANK", "MIXER"].includes(profile)) {
    cylinder(group, width * 0.42, width * 0.42, height * 0.8, { x: 0, y: height * 0.46, z: 0 }, material, 18);
    cylinder(group, width * 0.12, width * 0.12, height * 0.18, { x: 0, y: height * 0.92, z: 0 }, dark, 12);
    return;
  }
  if (profile === "FAN") {
    cylinder(group, height * 0.48, height * 0.48, depth * 0.42, { x: 0, y: height * 0.52, z: 0 }, dark, 20, { x: Math.PI / 2 });
    for (let index = 0; index < 5; index += 1) {
      const blade = box(group, { x: height * 0.08, y: height * 0.38, z: 0.08 }, { x: 0, y: height * 0.52, z: depth * 0.24 }, material);
      blade.rotation.z = index * Math.PI * 0.4;
    }
    return;
  }
  if (["CONVEYOR", "ROLLER_CONVEYOR"].includes(profile)) {
    [-1, 1].forEach((side) => box(group, { x: 0.12, y: height * 0.72, z: depth }, { x: side * width * 0.46, y: height * 0.42, z: 0 }, dark));
    const rollerCount = Math.min(24, Math.max(4, Math.round(depth / 0.45)));
    for (let index = 0; index < rollerCount; index += 1) {
      cylinder(group, 0.06, 0.06, width * 0.86, { x: 0, y: height * 0.75, z: -depth / 2 + depth * (index + 0.5) / rollerCount }, material, 8, { z: Math.PI / 2 });
    }
    return;
  }
  if (profile === "VALVE") {
    cylinder(group, width * 0.24, width * 0.24, depth, { x: 0, y: height * 0.46, z: 0 }, material, 16, { x: Math.PI / 2 });
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(width * 0.32, 0.05, 8, 20), dark);
    wheel.position.y = height * 0.88;
    wheel.rotation.x = Math.PI / 2;
    group.add(wheel);
    return;
  }
  if (profile === "HEAT_EXCHANGER") {
    cylinder(group, height * 0.3, height * 0.3, depth * 0.86, { x: 0, y: height * 0.58, z: 0 }, material, 18, { x: Math.PI / 2 });
    [-0.28, 0.28].forEach((z) => box(group, { x: width * 0.72, y: height * 0.42, z: 0.16 }, { x: 0, y: height * 0.25, z: z * depth }, dark));
    return;
  }
  const bodyDepth = profile === "GENERATOR" ? depth * 0.82 : depth * 0.52;
  cylinder(group, height * 0.25, height * 0.25, bodyDepth, { x: 0, y: height * 0.48, z: 0 }, material, 16, { x: Math.PI / 2 });
  if (["PUMP", "COMPRESSOR"].includes(profile)) {
    const casing = new THREE.Mesh(new THREE.TorusGeometry(width * 0.28, width * 0.1, 8, 20), material);
    casing.position.set(0, height * 0.48, -depth * 0.3);
    group.add(casing);
  }
}

function addElectricalEquipment(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  const profile = object.profile;
  if (profile === "TRANSFORMER") {
    box(group, { x: width * 0.76, y: height * 0.68, z: depth * 0.8 }, { x: 0, y: height * 0.38, z: 0 }, material, edgeColor);
    for (let index = 0; index < 7; index += 1) [-1, 1].forEach((side) => box(group, { x: 0.06, y: height * 0.54, z: depth * 0.78 }, { x: side * width * (0.4 + index * 0.015), y: height * 0.39, z: 0 }, standardMaterial(0x5c6f71, "METAL")));
    for (let index = 0; index < 3; index += 1) cylinder(group, 0.08, 0.13, height * 0.28, { x: -width * 0.22 + index * width * 0.22, y: height * 0.84, z: 0 }, standardMaterial(0x786c58), 10);
    return;
  }
  const bayCount = ["SWITCHGEAR", "MCC", "BATTERY"].includes(profile) ? Math.max(2, Math.round(width / 0.7)) : 1;
  for (let index = 0; index < bayCount; index += 1) {
    const bayWidth = width / bayCount;
    box(group, { x: bayWidth * 0.94, y: height, z: depth }, { x: -width / 2 + bayWidth * (index + 0.5), y: height / 2, z: 0 }, material, edgeColor);
    box(group, { x: bayWidth * 0.5, y: 0.12, z: 0.04 }, { x: -width / 2 + bayWidth * (index + 0.5), y: height * 0.78, z: depth / 2 + 0.03 }, standardMaterial(0x324b58, "GLASS"));
  }
}

function addLogistics(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  const profile = object.profile;
  if (profile === "PALLET") {
    for (let index = 0; index < 6; index += 1) box(group, { x: width / 7, y: height * 0.42, z: depth }, { x: -width / 2 + width * (index + 1) / 7, y: height * 0.72, z: 0 }, material);
    [-0.34, 0, 0.34].forEach((x) => box(group, { x: width * 0.18, y: height * 0.36, z: depth * 0.86 }, { x: x * width, y: height * 0.25, z: 0 }, material));
    return;
  }
  if (profile === "RACK") {
    [-1, 1].forEach((x) => [-1, 1].forEach((z) => box(group, { x: 0.1, y: height, z: 0.1 }, { x: x * width * 0.46, y: height / 2, z: z * depth * 0.42 }, material)));
    [0.08, 0.4, 0.72].forEach((ratio) => box(group, { x: width, y: 0.12, z: depth }, { x: 0, y: height * ratio, z: 0 }, material));
    return;
  }
  if (profile === "CONTAINER") {
    box(group, { x: width, y: height, z: depth }, { x: 0, y: height / 2, z: 0 }, material, edgeColor);
    for (let index = 1; index < 10; index += 1) box(group, { x: 0.05, y: height * 0.88, z: 0.08 }, { x: width / 2 + 0.03, y: height / 2, z: -depth / 2 + depth * index / 10 }, standardMaterial(0x52656b, "METAL"));
    return;
  }
  if (profile === "GANTRY") {
    [-1, 1].forEach((x) => box(group, { x: 0.32, y: height, z: depth }, { x: x * width * 0.44, y: height / 2, z: 0 }, material, edgeColor));
    box(group, { x: width, y: 0.4, z: depth }, { x: 0, y: height, z: 0 }, material, edgeColor);
    cylinder(group, 0.18, 0.18, height * 0.42, { x: 0, y: height * 0.76, z: 0 }, standardMaterial(0x495960, "METAL"), 10);
    return;
  }
  if (profile === "RAMP") {
    const ramp = box(group, { x: width, y: 0.18, z: depth }, { x: 0, y: height * 0.48, z: 0 }, material, edgeColor);
    ramp.rotation.x = -Math.atan2(height, depth);
    return;
  }
  if (profile === "ROLLER_CONVEYOR") return addIndustrialEquipment(group, { ...object, profile: "ROLLER_CONVEYOR" }, material, edgeColor);
  box(group, { x: width, y: height, z: depth }, { x: 0, y: height / 2, z: 0 }, material, edgeColor);
}

function addSafety(group, object, material) {
  const { width, depth, height } = object.dimensions;
  const profile = object.profile;
  if (["BARRIER", "GUARDRAIL"].includes(profile)) {
    [-1, 1].forEach((x) => box(group, { x: 0.1, y: height, z: depth }, { x: x * width * 0.48, y: height / 2, z: 0 }, material));
    [0.42, 0.86].forEach((ratio) => box(group, { x: width, y: 0.1, z: depth }, { x: 0, y: height * ratio, z: 0 }, material));
    return;
  }
  if (profile === "CONE") {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(width * 0.42, height, 16), material);
    cone.position.y = height / 2;
    group.add(cone);
    box(group, { x: width, y: 0.08, z: depth }, { x: 0, y: 0.04, z: 0 }, standardMaterial(0x343b3f));
    return;
  }
  if (["HYDRANT", "EXTINGUISHER"].includes(profile)) {
    cylinder(group, width * 0.34, width * 0.38, height * 0.78, { x: 0, y: height * 0.42, z: 0 }, material, 14);
    cylinder(group, width * 0.22, width * 0.32, height * 0.18, { x: 0, y: height * 0.88, z: 0 }, material, 12);
    return;
  }
  cylinder(group, 0.07, 0.09, height, { x: 0, y: height / 2, z: 0 }, material, 10);
  if (profile === "EYEWASH") cylinder(group, width * 0.4, width * 0.4, 0.12, { x: 0, y: height * 0.82, z: 0 }, standardMaterial(0x8ba8a0), 14);
  if (profile === "SHOWER") cylinder(group, width * 0.28, width * 0.12, 0.18, { x: 0, y: height, z: 0 }, standardMaterial(0x8b9a9a), 14);
}

function addPipeTank(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  const profile = object.profile;
  if (profile === "PIPE") {
    cylinder(group, width * 0.34, width * 0.34, depth, { x: 0, y: height * 0.55, z: 0 }, material, 16, { x: Math.PI / 2 });
    [-1, 1].forEach((side) => cylinder(group, width * 0.48, width * 0.48, 0.12, { x: 0, y: height * 0.55, z: side * depth * 0.5 }, standardMaterial(0x60727a, "METAL"), 16, { x: Math.PI / 2 }));
    return;
  }
  if (profile === "ELBOW") {
    const elbow = new THREE.Mesh(new THREE.TorusGeometry(width * 0.46, width * 0.15, 10, 18, Math.PI / 2), material);
    elbow.position.y = height * 0.48;
    elbow.rotation.x = Math.PI / 2;
    group.add(elbow);
    return;
  }
  if (profile === "PIPE_RACK") {
    [-1, 1].forEach((x) => box(group, { x: 0.18, y: height, z: depth }, { x: x * width * 0.44, y: height / 2, z: 0 }, standardMaterial(0x59676c, "METAL")));
    for (let level = 0; level < 3; level += 1) for (let lane = 0; lane < 4; lane += 1) cylinder(group, 0.08, 0.08, depth, { x: -width * 0.32 + lane * width * 0.21, y: height * (0.3 + level * 0.24), z: 0 }, material, 10, { x: Math.PI / 2 });
    return;
  }
  if (profile === "HORIZONTAL_TANK") {
    cylinder(group, height * 0.38, height * 0.38, depth * 0.82, { x: 0, y: height * 0.58, z: 0 }, material, 20, { x: Math.PI / 2 });
    [-0.28, 0.28].forEach((z) => box(group, { x: width * 0.72, y: height * 0.34, z: 0.18 }, { x: 0, y: height * 0.19, z: z * depth }, standardMaterial(0x5c696e, "METAL")));
    return;
  }
  if (profile === "IBC") {
    box(group, { x: width * 0.88, y: height * 0.82, z: depth * 0.88 }, { x: 0, y: height * 0.48, z: 0 }, standardMaterial(0xbac2be, "GLASS"), edgeColor);
    [-1, 1].forEach((x) => [-1, 1].forEach((z) => box(group, { x: 0.07, y: height, z: 0.07 }, { x: x * width * 0.46, y: height / 2, z: z * depth * 0.46 }, material)));
    return;
  }
  const tankHeight = profile === "SILO" ? height * 0.72 : height * 0.84;
  cylinder(group, width * 0.44, width * 0.44, tankHeight, { x: 0, y: tankHeight / 2 + (profile === "SILO" ? height * 0.18 : 0), z: 0 }, material, 20);
  if (profile === "SILO") {
    const hopper = new THREE.Mesh(new THREE.ConeGeometry(width * 0.44, height * 0.34, 20), material);
    hopper.position.y = height * 0.17;
    hopper.rotation.z = Math.PI;
    group.add(hopper);
  }
}

function addParkingFacility(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  if (["STANDARD", "ANGLED", "ACCESSIBLE"].includes(object.profile)) {
    addAreaSurface(group, object, material, edgeColor);
    addParkingLines(group, object);
    if (object.profile === "ACCESSIBLE") {
      const symbol = new THREE.Mesh(new THREE.RingGeometry(width * 0.12, width * 0.2, 16), standardMaterial(0xe7ecea));
      symbol.rotation.x = -Math.PI / 2;
      symbol.position.y = height + 0.02;
      group.add(symbol);
    }
    return;
  }
  if (object.profile === "WHEEL_STOP") return box(group, { x: width, y: height, z: depth }, { x: 0, y: height / 2, z: 0 }, material, edgeColor);
  if (object.profile === "EV_CHARGER") {
    box(group, { x: width, y: height, z: depth }, { x: 0, y: height / 2, z: 0 }, material, edgeColor);
    box(group, { x: width * 0.56, y: height * 0.2, z: 0.04 }, { x: 0, y: height * 0.72, z: depth / 2 + 0.03 }, standardMaterial(0x294c58, "GLASS"));
    return;
  }
  if (object.profile === "BIKE_RACK") {
    for (let index = 0; index < 5; index += 1) {
      const rack = new THREE.Mesh(new THREE.TorusGeometry(height * 0.38, 0.045, 8, 16, Math.PI), material);
      rack.position.set(-width / 2 + width * (index + 0.5) / 5, 0, 0);
      rack.rotation.y = Math.PI / 2;
      group.add(rack);
    }
    return;
  }
  addTrafficObject(group, object, material);
}

function addEnvironmentBuilding(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  box(group, { x: width, y: height, z: depth }, { x: 0, y: height / 2, z: 0 }, material, edgeColor);
  const rows = Math.max(2, Math.round(height / 3));
  const columns = Math.max(2, Math.min(10, Math.round(width / 3)));
  const windowMaterial = standardMaterial(0x527587, "GLASS");
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    box(group, { x: width / columns * 0.5, y: height / rows * 0.35, z: 0.06 }, { x: -width / 2 + width * (column + 0.5) / columns, y: height * (row + 0.58) / rows, z: depth / 2 + 0.04 }, windowMaterial);
  }
}

function addCar(group, object, material, edgeColor) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(object.dimensions.width, object.dimensions.height * 0.55, object.dimensions.depth),
    material,
  );
  body.position.y = object.dimensions.height * 0.38;
  addEdges(body, edgeColor);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(object.dimensions.width * 0.78, object.dimensions.height * 0.46, object.dimensions.depth * 0.48),
    new THREE.MeshStandardMaterial({ color: 0x8fa5af, roughness: 0.35, metalness: 0.25 }),
  );
  cabin.position.set(0, object.dimensions.height * 0.78, -object.dimensions.depth * 0.06);
  group.add(body, cabin);
}

function addFence(group, object, material) {
  const spacing = Math.max(0.5, Number(object.parameters.spacing) || 2.5);
  const postGeometry = new THREE.BoxGeometry(0.1, object.dimensions.height, 0.1);
  const railHeight = Math.max(0.06, object.dimensions.height * 0.05);
  const horizontalCount = Math.min(80, Math.max(2, Math.ceil(object.dimensions.width / spacing)));
  const verticalCount = Math.min(80, Math.max(2, Math.ceil(object.dimensions.depth / spacing)));
  for (let index = 0; index <= horizontalCount; index += 1) {
    const x = -object.dimensions.width / 2 + object.dimensions.width * index / horizontalCount;
    [-object.dimensions.depth / 2, object.dimensions.depth / 2].forEach((z) => {
      const post = new THREE.Mesh(postGeometry, material);
      post.position.set(x, object.dimensions.height / 2, z);
      group.add(post);
    });
  }
  for (let index = 1; index < verticalCount; index += 1) {
    const z = -object.dimensions.depth / 2 + object.dimensions.depth * index / verticalCount;
    [-object.dimensions.width / 2, object.dimensions.width / 2].forEach((x) => {
      const post = new THREE.Mesh(postGeometry, material);
      post.position.set(x, object.dimensions.height / 2, z);
      group.add(post);
    });
  }
  [object.dimensions.height * 0.32, object.dimensions.height * 0.76].forEach((y) => {
    const railX = new THREE.Mesh(new THREE.BoxGeometry(object.dimensions.width, railHeight, 0.07), material);
    railX.position.set(0, y, -object.dimensions.depth / 2);
    const railX2 = railX.clone();
    railX2.position.z = object.dimensions.depth / 2;
    const railZ = new THREE.Mesh(new THREE.BoxGeometry(0.07, railHeight, object.dimensions.depth), material);
    railZ.position.set(-object.dimensions.width / 2, y, 0);
    const railZ2 = railZ.clone();
    railZ2.position.x = object.dimensions.width / 2;
    group.add(railX, railX2, railZ, railZ2);
  });
}

function addStreetlights(group, object, material) {
  const count = Math.min(24, Math.max(1, Math.round(object.parameters.count)));
  const alongX = object.dimensions.width >= object.dimensions.depth;
  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0.5 : index / (count - 1);
    const x = alongX ? -object.dimensions.width / 2 + object.dimensions.width * ratio : 0;
    const z = alongX ? 0 : -object.dimensions.depth / 2 + object.dimensions.depth * ratio;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, object.dimensions.height, 8), material);
    pole.position.set(x, object.dimensions.height / 2, z);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 7),
      new THREE.MeshStandardMaterial({ color: 0xe7d8a0, emissive: 0xe7c66c, emissiveIntensity: 0.65 }),
    );
    lamp.position.set(x, object.dimensions.height, z);
    group.add(pole, lamp);
  }
}

function pathSegments(object) {
  const points = object.path?.points ?? [];
  return points.slice(1).map((end, index) => {
    const start = points[index];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    return {
      segmentIndex: index,
      start,
      end,
      length,
      angle: Math.atan2(dz, dx),
      center: { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 },
    };
  }).filter((segment) => segment.length >= 0.01);
}

function visiblePathRanges(length, trims = []) {
  const ranges = [];
  let cursor = 0;
  [...trims].sort((left, right) => left.start - right.start).forEach((trim) => {
    const start = THREE.MathUtils.clamp(Number(trim.start) || 0, 0, length);
    const end = THREE.MathUtils.clamp(Number(trim.end) || 0, start, length);
    if (start > cursor + 0.01) ranges.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  });
  if (cursor < length - 0.01) ranges.push({ start: cursor, end: length });
  return ranges;
}

function addMarking(group, length, width, x, z, material, y) {
  return box(group, { x: length, y: 0.012, z: width }, { x, y, z }, material);
}

function addDashedMarking(group, length, offset, material, y, width = 0.1, centerX = 0) {
  const dashLength = 2.1;
  const gap = 2.6;
  const count = Math.max(1, Math.min(48, Math.floor((length + gap) / (dashLength + gap))));
  const usedLength = count * dashLength + Math.max(0, count - 1) * gap;
  const start = centerX - usedLength / 2 + dashLength / 2;
  for (let index = 0; index < count; index += 1) {
    addMarking(group, Math.min(dashLength, length), width, start + index * (dashLength + gap), offset, material, y);
  }
}

function addDirectionArrow(group, x, z, direction, color, y) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.9, -0.11);
  shape.lineTo(0.28, -0.11);
  shape.lineTo(0.28, -0.34);
  shape.lineTo(0.95, 0);
  shape.lineTo(0.28, 0.34);
  shape.lineTo(0.28, 0.11);
  shape.lineTo(-0.9, 0.11);
  shape.closePath();
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  arrow.rotation.x = -Math.PI / 2;
  arrow.rotation.z = direction === "REVERSE" ? Math.PI : 0;
  arrow.position.set(x, y, z);
  group.add(arrow);
}

function addGradedRibbon(group, samples, width, offset, material, elevationOffset) {
  if (samples.length < 2) return null;
  const mesh = new THREE.Mesh(createGradedStripGeometry(samples, {
    width,
    offset,
    elevationOffset,
  }), material);
  mesh.renderOrder = 3;
  group.add(mesh);
  return mesh;
}

function addGradedDashedRibbon(group, samples, width, offset, material, elevationOffset) {
  const dashLength = 2.1;
  const gap = 2.6;
  const length = samples.at(-1)?.segmentDistance ?? 0;
  for (let start = 0; start < length; start += dashLength + gap) {
    addGradedRibbon(group, sliceGradedSamples(samples, start, Math.min(length, start + dashLength)), width, offset, material, elevationOffset);
  }
}

function addGradedRoadPath(group, object, material, pathRenderContext) {
  const verticalPath = pathRenderContext.verticalPath;
  const roadWidth = Math.max(2.4, object.path?.width ?? object.dimensions.depth);
  const laneCount = Math.min(8, Math.max(1, Math.round(object.parameters?.laneCount ?? 2)));
  const direction = object.parameters?.trafficDirection ?? "TWO_WAY";
  const laneStyle = object.parameters?.laneMarkingStyle ?? "DASHED";
  const centerLineStyle = object.parameters?.centerLineStyle ?? "DOUBLE_SOLID";
  const laneMaterial = new THREE.MeshBasicMaterial({ color: object.parameters?.laneColor ?? "#f4f4ee", side: THREE.DoubleSide });
  const centerMaterial = new THREE.MeshBasicMaterial({ color: object.parameters?.centerLineColor ?? "#f1c94a", side: THREE.DoubleSide });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: object.parameters?.edgeLineColor ?? "#f4f4ee", side: THREE.DoubleSide });
  const markingOffset = object.dimensions.height + 0.014;
  verticalPath.segments.forEach((segment) => {
    const surface = new THREE.Mesh(createGradedStripGeometry(segment.samples, {
      width: roadWidth,
      thickness: object.dimensions.height,
      elevationOffset: object.dimensions.height,
    }), material);
    surface.receiveShadow = true;
    group.add(surface);
    const ranges = visiblePathRanges(segment.length, pathRenderContext?.segmentTrims?.[segment.segmentIndex]);
    const laneWidth = roadWidth / laneCount;
    const edgeOffset = Math.max(0, roadWidth / 2 - 0.14);
    ranges.forEach((range) => {
      const samples = sliceGradedSamples(segment.samples, range.start, range.end);
      [-edgeOffset, edgeOffset].forEach((offset) => addGradedRibbon(group, samples, 0.1, offset, edgeMaterial, markingOffset));
      for (let boundary = 1; boundary < laneCount; boundary += 1) {
        const offset = -roadWidth / 2 + laneWidth * boundary;
        const centerLine = direction === "TWO_WAY" && laneCount > 1 && boundary === Math.ceil(laneCount / 2);
        if (centerLine) {
          const offsets = centerLineStyle.startsWith("DOUBLE") ? [-0.11, 0.11] : [0];
          offsets.forEach((lineOffset) => {
            if (centerLineStyle.endsWith("DASHED")) addGradedDashedRibbon(group, samples, 0.08, offset + lineOffset, centerMaterial, markingOffset);
            else addGradedRibbon(group, samples, 0.08, offset + lineOffset, centerMaterial, markingOffset);
          });
        } else if (laneStyle === "SOLID") addGradedRibbon(group, samples, 0.09, offset, laneMaterial, markingOffset);
        else addGradedDashedRibbon(group, samples, 0.09, offset, laneMaterial, markingOffset);
      }
    });
  });
  if (verticalPath.mode === VERTICAL_PATH_MODES.ELEVATED) {
    addElevatedSupports(group, verticalPath, roadWidth, standardMaterial("#747b80", "CONCRETE"), Number(object.parameters?.supportSpacing) || 12);
  }
}

function addRoadPath(group, object, material, pathRenderContext = null) {
  if (pathRenderContext?.verticalPath?.segments?.length) {
    addGradedRoadPath(group, object, material, pathRenderContext);
    return;
  }
  const roadWidth = Math.max(2.4, object.path?.width ?? object.dimensions.depth);
  const laneCount = Math.min(8, Math.max(1, Math.round(object.parameters?.laneCount ?? 2)));
  const direction = object.parameters?.trafficDirection ?? "TWO_WAY";
  const laneStyle = object.parameters?.laneMarkingStyle ?? "DASHED";
  const centerLineStyle = object.parameters?.centerLineStyle ?? "DOUBLE_SOLID";
  const laneMaterial = new THREE.MeshBasicMaterial({ color: object.parameters?.laneColor ?? "#f4f4ee" });
  const centerMaterial = new THREE.MeshBasicMaterial({ color: object.parameters?.centerLineColor ?? "#f1c94a" });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: object.parameters?.edgeLineColor ?? "#f4f4ee" });
  const markingY = object.dimensions.height + 0.012;

  const connectedEndpointIndexes = new Set(pathRenderContext?.connectedEndpointIndexes ?? []);
  const segments = pathSegments(object);
  segments.forEach((segment) => {
    const segmentGroup = new THREE.Group();
    segmentGroup.position.set(segment.center.x, 0, segment.center.z);
    segmentGroup.rotation.y = -segment.angle;
    box(
      segmentGroup,
      { x: segment.length, y: object.dimensions.height, z: roadWidth },
      { x: 0, y: object.dimensions.height / 2, z: 0 },
      material,
    );
    const ranges = visiblePathRanges(segment.length, pathRenderContext?.segmentTrims?.[segment.segmentIndex]);
    const edgeOffset = Math.max(0, roadWidth / 2 - 0.14);
    const laneWidth = roadWidth / laneCount;
    ranges.forEach((range) => {
      const rangeLength = range.end - range.start;
      const rangeCenter = -segment.length / 2 + (range.start + range.end) / 2;
      [-edgeOffset, edgeOffset].forEach((offset) => addMarking(segmentGroup, rangeLength, 0.1, rangeCenter, offset, edgeMaterial, markingY));
      for (let boundary = 1; boundary < laneCount; boundary += 1) {
        const offset = -roadWidth / 2 + laneWidth * boundary;
        const isCenterLine = direction === "TWO_WAY" && laneCount > 1 && boundary === Math.ceil(laneCount / 2);
        if (isCenterLine) {
          const lineOffsets = centerLineStyle.startsWith("DOUBLE") ? [-0.11, 0.11] : [0];
          lineOffsets.forEach((lineOffset) => {
            if (centerLineStyle.endsWith("DASHED")) addDashedMarking(segmentGroup, rangeLength, offset + lineOffset, centerMaterial, markingY, 0.08, rangeCenter);
            else addMarking(segmentGroup, rangeLength, 0.08, rangeCenter, offset + lineOffset, centerMaterial, markingY);
          });
        } else if (laneStyle === "SOLID") {
          addMarking(segmentGroup, rangeLength, 0.09, rangeCenter, offset, laneMaterial, markingY);
        } else {
          addDashedMarking(segmentGroup, rangeLength, offset, laneMaterial, markingY, 0.1, rangeCenter);
        }
      }
      if (object.parameters?.showDirectionArrows !== false && rangeLength >= 5) {
        for (let lane = 0; lane < laneCount; lane += 1) {
          const laneCenter = -roadWidth / 2 + laneWidth * (lane + 0.5);
          const arrowDirection = direction === "ONE_WAY_REVERSE"
            ? "REVERSE"
            : direction === "TWO_WAY" && lane < Math.floor(laneCount / 2)
              ? "REVERSE"
              : "FORWARD";
          addDirectionArrow(segmentGroup, rangeCenter, laneCenter, arrowDirection, object.parameters?.laneColor ?? "#f4f4ee", markingY + 0.004);
        }
      }
    });
    if (segment.segmentIndex === 0 && !connectedEndpointIndexes.has(0)) {
      addMarking(segmentGroup, 0.1, roadWidth, -segment.length / 2, 0, edgeMaterial, markingY);
    }
    if (segment.segmentIndex === segments.length - 1 && !connectedEndpointIndexes.has(segments.length)) {
      addMarking(segmentGroup, 0.1, roadWidth, segment.length / 2, 0, edgeMaterial, markingY);
    }
    group.add(segmentGroup);
  });
}

function addGradedWalkwayPath(group, object, material, pathRenderContext) {
  const verticalPath = pathRenderContext.verticalPath;
  const pathWidth = Math.max(1, object.path?.width ?? object.dimensions.depth);
  const curbWidth = Math.min(pathWidth * 0.18, Math.max(0.08, Number(object.parameters?.curbWidth) || 0.18));
  const curbHeight = Math.max(0.04, Number(object.parameters?.curbHeight) || 0.14);
  const curbMaterial = standardMaterial(object.parameters?.curbColor ?? "#c8c5bd", "CONCRETE");
  const tactileMaterial = standardMaterial(object.parameters?.tactileColor ?? "#d7ad35", "PAINTED");
  verticalPath.segments.forEach((segment) => {
    const surface = new THREE.Mesh(createGradedStripGeometry(segment.samples, {
      width: pathWidth,
      thickness: object.dimensions.height,
      elevationOffset: object.dimensions.height,
    }), material);
    surface.receiveShadow = true;
    group.add(surface);
    visiblePathRanges(segment.length, pathRenderContext?.segmentTrims?.[segment.segmentIndex]).forEach((range) => {
      const samples = sliceGradedSamples(segment.samples, range.start, range.end);
      [-1, 1].forEach((side) => addGradedRibbon(
        group,
        samples,
        curbWidth,
        side * (pathWidth / 2 - curbWidth / 2),
        curbMaterial,
        object.dimensions.height + curbHeight,
      ));
      if (object.parameters?.tactileEnabled !== false) addGradedRibbon(
        group,
        samples,
        Math.min(0.32, pathWidth * 0.18),
        0,
        tactileMaterial,
        object.dimensions.height + 0.014,
      );
    });
  });
}

function addWalkwayPath(group, object, material, pathRenderContext = null) {
  if (pathRenderContext?.verticalPath?.segments?.length) {
    addGradedWalkwayPath(group, object, material, pathRenderContext);
    return;
  }
  const pathWidth = Math.max(1, object.path?.width ?? object.dimensions.depth);
  const curbWidth = Math.min(pathWidth * 0.18, Math.max(0.08, Number(object.parameters?.curbWidth) || 0.18));
  const curbHeight = Math.max(0.04, Number(object.parameters?.curbHeight) || 0.14);
  const curbMaterial = standardMaterial(object.parameters?.curbColor ?? "#c8c5bd", "CONCRETE");
  const jointMaterial = new THREE.MeshBasicMaterial({ color: object.parameters?.jointColor ?? "#747b7d" });
  const tactileMaterial = new THREE.MeshStandardMaterial({ color: object.parameters?.tactileColor ?? "#d7ad35", roughness: 0.9 });

  pathSegments(object).forEach((segment) => {
    const segmentGroup = new THREE.Group();
    segmentGroup.position.set(segment.center.x, 0, segment.center.z);
    segmentGroup.rotation.y = -segment.angle;
    box(segmentGroup, { x: segment.length, y: object.dimensions.height, z: pathWidth }, { x: 0, y: object.dimensions.height / 2, z: 0 }, material);
    visiblePathRanges(segment.length, pathRenderContext?.segmentTrims?.[segment.segmentIndex]).forEach((range) => {
      const rangeLength = range.end - range.start;
      const rangeCenter = -segment.length / 2 + (range.start + range.end) / 2;
      [-1, 1].forEach((side) => box(
        segmentGroup,
        { x: rangeLength, y: curbHeight, z: curbWidth },
        { x: rangeCenter, y: curbHeight / 2, z: side * (pathWidth / 2 - curbWidth / 2) },
        curbMaterial,
      ));
      const jointCount = Math.min(64, Math.max(1, Math.floor(rangeLength / 1.2)));
      for (let joint = 1; joint < jointCount; joint += 1) {
        addMarking(segmentGroup, 0.025, pathWidth - curbWidth * 2, rangeCenter - rangeLength / 2 + rangeLength * joint / jointCount, 0, jointMaterial, object.dimensions.height + 0.008);
      }
      if (object.parameters?.tactileEnabled !== false) {
        addMarking(segmentGroup, rangeLength, Math.min(0.32, pathWidth * 0.18), rangeCenter, 0, tactileMaterial, object.dimensions.height + 0.014);
      }
    });
    group.add(segmentGroup);
  });
}

function addBeamBetween(group, start, end, thickness, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, direction.length(), 8), material);
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  group.add(beam);
}

function addOutdoorStairs(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  const stepCount = Math.min(40, Math.max(2, Math.round(object.parameters?.stepCount ?? 12)));
  const stepDepth = depth / stepCount;
  const railMaterial = standardMaterial(object.parameters?.railingColor ?? "#5f696d", "METAL");
  for (let index = 0; index < stepCount; index += 1) {
    const stepHeight = height * (index + 1) / stepCount;
    box(
      group,
      { x: width, y: stepHeight, z: stepDepth + 0.01 },
      { x: 0, y: stepHeight / 2, z: -depth / 2 + stepDepth * (index + 0.5) },
      material,
      edgeColor,
    );
  }
  if (object.parameters?.railingEnabled !== false) {
    [-1, 1].forEach((side) => {
      const x = side * Math.max(0, width / 2 - 0.09);
      const railHeight = Math.min(1.1, Math.max(0.75, height * 0.38));
      const start = new THREE.Vector3(x, railHeight, -depth / 2 + stepDepth / 2);
      const end = new THREE.Vector3(x, height + railHeight, depth / 2 - stepDepth / 2);
      addBeamBetween(group, start, end, 0.035, railMaterial);
      [start, end].forEach((position) => cylinder(group, 0.035, 0.035, railHeight, { x: position.x, y: position.y - railHeight / 2, z: position.z }, railMaterial, 8));
    });
  }
}

function addOutdoorRamp(group, object, material, edgeColor) {
  const { width, depth, height } = object.dimensions;
  const landingLength = Math.min(depth * 0.35, Math.max(0.4, Number(object.parameters?.landingLength) || 1.5));
  const runDepth = Math.max(0.5, depth - landingLength * 2);
  const surfaceThickness = Math.min(0.35, Math.max(0.08, Number(object.parameters?.surfaceThickness) || 0.16));
  const curbHeight = Math.min(0.35, Math.max(0.06, Number(object.parameters?.curbHeight) || 0.12));
  const curbWidth = Math.min(0.16, width * 0.08);
  const slopeAngle = Math.atan2(height, runDepth);
  const slopeLength = Math.hypot(runDepth, height);
  const curbMaterial = standardMaterial(object.parameters?.curbColor ?? "#c8c5bd", "CONCRETE");
  const railMaterial = standardMaterial(object.parameters?.railingColor ?? "#5f696d", "METAL");

  const ramp = box(
    group,
    { x: width, y: surfaceThickness, z: slopeLength },
    { x: 0, y: height / 2 + surfaceThickness / 2, z: 0 },
    material,
    edgeColor,
  );
  ramp.rotation.x = -slopeAngle;

  [
    { z: -runDepth / 2 - landingLength / 2, y: surfaceThickness / 2 },
    { z: runDepth / 2 + landingLength / 2, y: height + surfaceThickness / 2 },
  ].forEach((landing) => box(
    group,
    { x: width, y: surfaceThickness, z: landingLength },
    { x: 0, y: landing.y, z: landing.z },
    material,
    edgeColor,
  ));

  [-1, 1].forEach((side) => {
    const x = side * (width / 2 - curbWidth / 2);
    const slopeCurb = box(
      group,
      { x: curbWidth, y: curbHeight, z: slopeLength },
      { x, y: height / 2 + surfaceThickness + curbHeight / 2, z: 0 },
      curbMaterial,
    );
    slopeCurb.rotation.x = -slopeAngle;
    [
      { z: -runDepth / 2 - landingLength / 2, y: surfaceThickness + curbHeight / 2 },
      { z: runDepth / 2 + landingLength / 2, y: height + surfaceThickness + curbHeight / 2 },
    ].forEach((landing) => box(
      group,
      { x: curbWidth, y: curbHeight, z: landingLength },
      { x, y: landing.y, z: landing.z },
      curbMaterial,
    ));
  });

  if (object.parameters?.tactileEnabled !== false) {
    const tactileMaterial = standardMaterial(object.parameters?.tactileColor ?? "#d7ad35", "PAINTED");
    [
      { z: -depth / 2 + 0.28, y: surfaceThickness + 0.012 },
      { z: depth / 2 - 0.28, y: height + surfaceThickness + 0.012 },
    ].forEach((strip) => box(
      group,
      { x: Math.max(0.4, width - curbWidth * 2), y: 0.024, z: 0.38 },
      { x: 0, y: strip.y, z: strip.z },
      tactileMaterial,
    ));
  }

  if (object.parameters?.railingEnabled !== false) {
    const railHeight = 0.95;
    const railX = Math.max(0, width / 2 - 0.07);
    const railSections = [
      [new THREE.Vector3(railX, railHeight, -depth / 2), new THREE.Vector3(railX, railHeight, -runDepth / 2)],
      [new THREE.Vector3(railX, railHeight, -runDepth / 2), new THREE.Vector3(railX, height + railHeight, runDepth / 2)],
      [new THREE.Vector3(railX, height + railHeight, runDepth / 2), new THREE.Vector3(railX, height + railHeight, depth / 2)],
    ];
    [-1, 1].forEach((side) => {
      railSections.forEach(([start, end]) => {
        const sideStart = start.clone();
        const sideEnd = end.clone();
        sideStart.x *= side;
        sideEnd.x *= side;
        addBeamBetween(group, sideStart, sideEnd, 0.035, railMaterial);
        const midStart = sideStart.clone();
        const midEnd = sideEnd.clone();
        midStart.y -= railHeight * 0.45;
        midEnd.y -= railHeight * 0.45;
        addBeamBetween(group, midStart, midEnd, 0.025, railMaterial);
      });
      [-depth / 2, -runDepth / 2, 0, runDepth / 2, depth / 2].forEach((z) => {
        const baseY = z <= -runDepth / 2
          ? 0
          : z >= runDepth / 2
            ? height
            : height * (z + runDepth / 2) / runDepth;
        cylinder(group, 0.035, 0.035, railHeight, { x: side * railX, y: baseY + railHeight / 2, z }, railMaterial, 8);
      });
    });
  }
}

function addTerrainFeatureHandle(group, object, selected, edgeColor) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(object.dimensions.width, object.dimensions.depth),
    new THREE.MeshBasicMaterial({
      color: object.appearance.color,
      transparent: true,
      opacity: selected ? 0.12 : 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = object.profile === "LOW_GROUND" || object.profile === "DRAINAGE_CHANNEL"
    ? 0.03
    : object.dimensions.height + 0.04;
  if (selected) addEdges(mesh, edgeColor);
  group.add(mesh);
}

function averageConnectionColor(endpoints) {
  const color = new THREE.Color(endpoints[0]?.appearance?.color ?? "#808080");
  endpoints.slice(1).forEach((endpoint, index) => {
    color.lerp(new THREE.Color(endpoint.appearance?.color ?? color), 1 / (index + 2));
  });
  return color;
}

function createJunctionShape(junction) {
  if (!junction.polygon?.length) return null;
  const shape = new THREE.Shape();
  junction.polygon.forEach((point, index) => {
    const x = point.x - junction.center.x;
    const z = point.z - junction.center.z;
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return shape;
}

function isWalkwayOpening(junction, point) {
  return junction.approaches.some((approach) => {
    const forward = point.x * approach.direction.x + point.z * approach.direction.z;
    const side = Math.abs(-point.x * approach.direction.z + point.z * approach.direction.x);
    return forward > junction.radius * 0.56 && side < approach.width * 0.48;
  });
}

function addWalkwayJunctionCurbs(group, junction) {
  const curbWidth = Math.min(0.18, junction.width * 0.08);
  const curbHeight = Math.max(0.06, Number(junction.approaches[0]?.parameters?.curbHeight) || 0.14);
  const material = standardMaterial(junction.approaches[0]?.parameters?.curbColor ?? "#c8c5bd", "CONCRETE");
  const points = junction.polygon.map((point) => ({
    x: point.x - junction.center.x,
    z: point.z - junction.center.z,
  }));
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length];
    const center = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
    if (isWalkwayOpening(junction, center)) return;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.04) return;
    const curb = box(group, { x: length + 0.025, y: curbHeight, z: curbWidth }, {
      x: center.x, y: curbHeight / 2 + 0.006, z: center.z,
    }, material);
    curb.rotation.y = -Math.atan2(dz, dx);
  });
}

function addPolylineStripe(group, points, offset, width, material, y, dashed = false) {
  points.slice(1).forEach((end, index) => {
    if (dashed && index % 3 === 2) return;
    const start = points[index];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) return;
    const normal = { x: -dz / length, z: dx / length };
    const stripe = addMarking(
      group,
      length + 0.03,
      width,
      (start.x + end.x) / 2 + normal.x * offset,
      (start.z + end.z) / 2 + normal.z * offset,
      material,
      y,
    );
    stripe.rotation.y = -Math.atan2(dz, dx);
  });
}

function getCurvedJunctionPoints(junction) {
  if (junction.approaches.length !== 2 || !["CURVE", "L_CORNER"].includes(junction.type)) return null;
  const [left, right] = junction.approaches;
  const leftReach = Math.min(left.segmentLength * 0.42, junction.radius + 0.35);
  const rightReach = Math.min(right.segmentLength * 0.42, junction.radius + 0.35);
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(left.direction.x * leftReach, 0, left.direction.z * leftReach),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(right.direction.x * rightReach, 0, right.direction.z * rightReach),
  ).getPoints(20);
}

function addRoadJunctionMarkings(group, junction) {
  const points = getCurvedJunctionPoints(junction);
  if (!points) return;
  const source = junction.approaches[0];
  const roadWidth = Math.min(...junction.approaches.map((approach) => approach.width));
  const laneCount = Math.min(8, Math.max(1, Math.round(source.parameters?.laneCount ?? 2)));
  const direction = source.parameters?.trafficDirection ?? "TWO_WAY";
  const laneStyle = source.parameters?.laneMarkingStyle ?? "DASHED";
  const centerStyle = source.parameters?.centerLineStyle ?? "DOUBLE_SOLID";
  const laneMaterial = new THREE.MeshBasicMaterial({ color: source.parameters?.laneColor ?? "#f4f4ee" });
  const centerMaterial = new THREE.MeshBasicMaterial({ color: source.parameters?.centerLineColor ?? "#f1c94a" });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: source.parameters?.edgeLineColor ?? "#f4f4ee" });
  const markingY = 0.018;
  const edgeOffset = Math.max(0, roadWidth / 2 - 0.14);
  [-edgeOffset, edgeOffset].forEach((offset) => addPolylineStripe(group, points, offset, 0.1, edgeMaterial, markingY));
  const laneWidth = roadWidth / laneCount;
  for (let boundary = 1; boundary < laneCount; boundary += 1) {
    const offset = -roadWidth / 2 + laneWidth * boundary;
    const centerLine = direction === "TWO_WAY" && laneCount > 1 && boundary === Math.ceil(laneCount / 2);
    if (centerLine) {
      const offsets = centerStyle.startsWith("DOUBLE") ? [-0.11, 0.11] : [0];
      offsets.forEach((lineOffset) => addPolylineStripe(
        group, points, offset + lineOffset, 0.08, centerMaterial, markingY, centerStyle.endsWith("DASHED"),
      ));
    } else {
      addPolylineStripe(group, points, offset, 0.09, laneMaterial, markingY, laneStyle !== "SOLID");
    }
  }
}

function addWalkwayJunctionTactile(group, junction) {
  const points = getCurvedJunctionPoints(junction);
  const source = junction.approaches[0];
  if (!points || source.parameters?.tactileEnabled === false) return;
  const material = new THREE.MeshStandardMaterial({
    color: source.parameters?.tactileColor ?? "#d7ad35",
    roughness: 0.9,
  });
  addPolylineStripe(group, points, 0, Math.min(0.32, junction.width * 0.18), material, 0.02);
}

export function createSitePathConnectionObject(junction, { preview = false } = {}) {
  const group = new THREE.Group();
  group.name = `${junction.profile} 자동 연결부`;
  group.userData.sitePathConnectionId = junction.id;
  group.userData.geometrySignature = JSON.stringify({ junction, preview });
  const connectionColor = averageConnectionColor(junction.approaches);
  const shape = createJunctionShape(junction);
  if (!shape) return group;
  const material = new THREE.MeshStandardMaterial({
    color: connectionColor,
    roughness: junction.profile === "ROAD" ? 0.98 : 0.9,
    metalness: 0,
    transparent: preview,
    opacity: preview ? 0.56 : 1,
    depthWrite: !preview,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const surface = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.006;
  surface.renderOrder = preview ? 5 : 2;
  group.add(surface);
  if (preview) {
    const outlinePoints = junction.polygon.map((point) => new THREE.Vector3(
      point.x - junction.center.x,
      0.022,
      point.z - junction.center.z,
    ));
    group.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(outlinePoints),
      new THREE.LineBasicMaterial({ color: 0x55d6be, transparent: true, opacity: 0.95, depthTest: false }),
    ));
  } else if (junction.profile === "ROAD") {
    addRoadJunctionMarkings(group, junction);
  } else {
    addWalkwayJunctionCurbs(group, junction);
    addWalkwayJunctionTactile(group, junction);
  }
  group.position.set(junction.center.x, junction.center.y, junction.center.z);

  group.traverse((child) => {
    child.userData.sitePathConnectionId = junction.id;
    child.raycast = () => {};
  });
  return group;
}

function addLinearPath(group, object, material, edgeColor) {
  const points = object.path?.points ?? [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) continue;
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(length, object.dimensions.height, object.path.width),
      material,
    );
    segment.position.set((start.x + end.x) / 2, object.dimensions.height / 2, (start.z + end.z) / 2);
    segment.rotation.y = -Math.atan2(dz, dx);
    addEdges(segment, edgeColor);
    group.add(segment);
  }
}

export function getSiteObjectSignature(object, selected, theme, pathRenderContext = null) {
  const geometryDefinition = { ...object, position: undefined, rotation: undefined };
  return JSON.stringify({ geometryDefinition, selected, theme, pathRenderContext });
}

export function createSiteEnvironmentObject(object, {
  selected, theme, selectionColor, edgeColor, pathRenderContext = null,
}) {
  const group = new THREE.Group();
  group.name = object.name;
  group.userData.siteObjectId = object.id;
  const material = materialFor(object, selected);
  const resolvedEdge = selected ? selectionColor : edgeColor;

  const generators = {
    BUILDING: () => addEnvironmentBuilding(group, object, material, resolvedEdge),
    VEHICLE: () => addVehicle(group, object, material, resolvedEdge),
    TRAFFIC: () => addTrafficObject(group, object, material),
    FENCE: () => addFence(group, object, material),
    VEGETATION: () => addTreeCluster(group, object, material),
    LANDSCAPE: () => addLandscape(group, object, material, resolvedEdge),
    INDUSTRIAL: () => addIndustrialEquipment(group, object, material, resolvedEdge),
    ELECTRICAL: () => addElectricalEquipment(group, object, material, resolvedEdge),
    LOGISTICS: () => addLogistics(group, object, material, resolvedEdge),
    SAFETY: () => addSafety(group, object, material),
    PIPE_TANK: () => addPipeTank(group, object, material, resolvedEdge),
    PARKING: () => addParkingFacility(group, object, material, resolvedEdge),
    SURFACE: () => {
      if (object.profile === "ROAD") addRoadPath(group, object, material, pathRenderContext);
      else if (object.profile === "WALKWAY") addWalkwayPath(group, object, material, pathRenderContext);
      else if (object.geometryMode === "LINEAR") addLinearPath(group, object, material, resolvedEdge);
      else addAreaSurface(group, object, material, resolvedEdge);
      if (object.profile === "CROSSWALK") addParkingLines(group, object);
    },
    ACCESS: () => object.profile === "OUTDOOR_RAMP"
      ? addOutdoorRamp(group, object, material, resolvedEdge)
      : addOutdoorStairs(group, object, material, resolvedEdge),
    TERRAIN: () => addTerrainFeatureHandle(group, object, selected, resolvedEdge),
    UTILITY: () => addAreaSurface(group, object, material, resolvedEdge),
  };
  const generator = generators[object.assetKind];
  if (generator) generator();
  else if (object.type === "CAR") addCar(group, object, material, resolvedEdge);
  else if (object.type === "TREE") addTreeCluster(group, object, material);
  else if (object.type === "FENCE") addFence(group, object, material);
  else if (object.type === "STREETLIGHT") addStreetlights(group, object, material);
  else if (object.geometryMode === "LINEAR") addLinearPath(group, object, material, resolvedEdge);
  else addAreaSurface(group, object, material, resolvedEdge);

  group.traverse((child) => { child.userData.siteObjectId = object.id; });
  group.position.set(object.position.x, object.position.y, object.position.z);
  group.rotation.set(object.rotation.x, object.rotation.y, object.rotation.z);
  group.visible = object.visible;
  group.userData.geometrySignature = getSiteObjectSignature(object, selected, theme, pathRenderContext);
  return group;
}
