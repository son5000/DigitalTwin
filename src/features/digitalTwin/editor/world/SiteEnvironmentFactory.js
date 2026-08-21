import * as THREE from "three";

import {
  MAX_TREE_COUNT,
  TREE_DEFAULT_SPACING,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";

function materialFor(object, selected) {
  const presets = {
    CONCRETE: { roughness: 0.9, metalness: 0.02 },
    ASPHALT: { roughness: 0.98, metalness: 0 },
    METAL: { roughness: 0.55, metalness: 0.62 },
    GRASS: { roughness: 1, metalness: 0 },
    PAINTED: { roughness: 0.62, metalness: 0.18 },
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
  const crown = new THREE.InstancedMesh(
    new THREE.ConeGeometry(Math.min(1.25, treeHeight * 0.23), treeHeight * 0.68, 8),
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

export function getSiteObjectSignature(object, selected, theme) {
  const geometryDefinition = { ...object, position: undefined, rotation: undefined };
  return JSON.stringify({ geometryDefinition, selected, theme });
}

export function createSiteEnvironmentObject(object, { selected, theme, selectionColor, edgeColor }) {
  const group = new THREE.Group();
  group.name = object.name;
  group.userData.siteObjectId = object.id;
  const material = materialFor(object, selected);
  const resolvedEdge = selected ? selectionColor : edgeColor;

  if (object.type === "TREE") addTreeCluster(group, object, material);
  else if (object.type === "CAR") addCar(group, object, material, resolvedEdge);
  else if (object.type === "FENCE") addFence(group, object, material);
  else if (object.type === "STREETLIGHT") addStreetlights(group, object, material);
  else if (object.geometryMode === "LINEAR") addLinearPath(group, object, material, resolvedEdge);
  else {
    addAreaSurface(group, object, material, resolvedEdge);
    if (object.type === "PARKING") addParkingLines(group, object);
  }

  group.traverse((child) => { child.userData.siteObjectId = object.id; });
  group.position.set(object.position.x, object.position.y, object.position.z);
  group.rotation.set(object.rotation.x, object.rotation.y, object.rotation.z);
  group.visible = object.visible;
  group.userData.geometrySignature = getSiteObjectSignature(object, selected, theme);
  return group;
}
