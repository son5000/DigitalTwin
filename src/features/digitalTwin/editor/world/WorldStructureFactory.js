import * as THREE from "three";

import { WORLD_STRUCTURE_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";

export function getWorldStructureDimensions(structure) {
  const parameter = structure.parameters;

  if (structure.type === "ROOM" || structure.type === "UTILITY_AREA") {
    return { width: parameter.width, height: 0.04, depth: parameter.depth };
  }
  if (structure.type === "CORRIDOR") {
    return { width: parameter.width, height: 0.04, depth: parameter.length };
  }
  if (["WALL", "PARTITION", "TEMPORARY_WALL"].includes(structure.type)) {
    return { width: parameter.length, height: parameter.height, depth: parameter.thickness };
  }
  if (structure.type === "COLUMN") {
    return { width: parameter.width, height: parameter.height, depth: parameter.depth };
  }
  if (structure.type === "BEAM") {
    return { width: parameter.length, height: parameter.height, depth: parameter.width };
  }
  if (["FLOOR_REGION", "PLATFORM", "STEP"].includes(structure.type)) {
    return { width: parameter.width, height: parameter.height, depth: parameter.depth };
  }
  if (structure.type === "RAMP") {
    return { width: parameter.width, height: Math.max(parameter.startHeight, parameter.endHeight), depth: parameter.length };
  }
  if (["ENTRANCE", "EXIT", "DOOR"].includes(structure.type)) {
    return { width: parameter.width, height: parameter.height, depth: parameter.depth };
  }
  if (structure.type === "PASSAGE") {
    return { width: parameter.width, height: 0.03, depth: parameter.depth };
  }
  if (structure.type === "RAILING" || structure.type === "FENCE") {
    return { width: parameter.length, height: parameter.height, depth: parameter.thickness };
  }
  if (structure.type === "STAIR") {
    return { width: parameter.width, height: parameter.totalHeight, depth: parameter.totalLength };
  }
  if (structure.type === "STRUCTURAL_FRAME") {
    return { width: parameter.width, height: parameter.height, depth: parameter.depth };
  }
  return { width: parameter.width, height: parameter.height, depth: parameter.depth };
}

function createMaterial(appearance) {
  const isGlass = appearance.materialPreset === "GLASS";
  const isMesh = appearance.materialPreset === "MESH" || appearance.materialPreset === "GRATING";
  return new THREE.MeshStandardMaterial({
    color: appearance.color,
    transparent: appearance.opacity < 1 || isGlass,
    opacity: isGlass ? Math.min(appearance.opacity, 0.3) : appearance.opacity,
    roughness: isGlass ? 0.16 : 0.82,
    metalness: appearance.materialPreset?.includes("STEEL") ? 0.32 : 0.04,
    wireframe: isMesh,
    side: THREE.DoubleSide,
    depthWrite: !isGlass,
  });
}

function addSolid(group, geometry, appearance, edgeColor, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, createMaterial(appearance));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 28),
    new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.68 }),
  );
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  group.add(edges);
  return mesh;
}

function generateBoxStructure(structure, dimensions, edgeColor) {
  const group = new THREE.Group();
  const geometry = structure.type === "COLUMN" && structure.variant === "CIRCULAR"
    ? new THREE.CylinderGeometry(dimensions.width / 2, dimensions.width / 2, dimensions.height, 24)
    : new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth);
  addSolid(group, geometry, structure.appearance, edgeColor, [0, dimensions.height / 2, 0]);
  return group;
}

function generateSpace(structure, dimensions, edgeColor) {
  const group = new THREE.Group();
  addSolid(
    group,
    new THREE.BoxGeometry(dimensions.width, 0.035, dimensions.depth),
    { ...structure.appearance, opacity: Math.min(structure.appearance.opacity, 0.28) },
    edgeColor,
    [0, 0.018, 0],
  );
  return group;
}

function generateRamp(structure, dimensions, edgeColor) {
  const { width, depth } = dimensions;
  const { startHeight, endHeight } = structure.parameters;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const vertices = new Float32Array([
    -halfWidth, 0, -halfDepth, halfWidth, 0, -halfDepth, -halfWidth, startHeight, -halfDepth,
    halfWidth, 0, -halfDepth, halfWidth, startHeight, -halfDepth, -halfWidth, startHeight, -halfDepth,
    -halfWidth, 0, halfDepth, -halfWidth, endHeight, halfDepth, halfWidth, 0, halfDepth,
    halfWidth, 0, halfDepth, -halfWidth, endHeight, halfDepth, halfWidth, endHeight, halfDepth,
    -halfWidth, startHeight, -halfDepth, halfWidth, startHeight, -halfDepth, -halfWidth, endHeight, halfDepth,
    halfWidth, startHeight, -halfDepth, halfWidth, endHeight, halfDepth, -halfWidth, endHeight, halfDepth,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const group = new THREE.Group();
  addSolid(group, geometry, structure.appearance, edgeColor);
  return group;
}

function generateStair(structure, dimensions, edgeColor) {
  const group = new THREE.Group();
  const stepCount = Math.max(2, Math.round(structure.parameters.stepCount));
  const stepDepth = dimensions.depth / stepCount;
  const stepHeight = dimensions.height / stepCount;
  for (let index = 0; index < stepCount; index += 1) {
    const height = stepHeight * (index + 1);
    addSolid(
      group,
      new THREE.BoxGeometry(dimensions.width, height, stepDepth),
      structure.appearance,
      edgeColor,
      [0, height / 2, -dimensions.depth / 2 + stepDepth * (index + 0.5)],
    );
  }
  return group;
}

function generateRailing(structure, dimensions, edgeColor) {
  const group = new THREE.Group();
  const thickness = Math.max(0.025, structure.parameters.thickness);
  const postInterval = structure.parameters.postInterval ?? 1;
  const postCount = Math.max(2, Math.ceil(dimensions.width / postInterval) + 1);
  for (let index = 0; index < postCount; index += 1) {
    const x = -dimensions.width / 2 + dimensions.width * index / (postCount - 1);
    addSolid(group, new THREE.BoxGeometry(thickness, dimensions.height, thickness), structure.appearance, edgeColor, [x, dimensions.height / 2, 0]);
  }
  addSolid(group, new THREE.BoxGeometry(dimensions.width, thickness, thickness), structure.appearance, edgeColor, [0, dimensions.height, 0]);
  if (structure.type === "FENCE") {
    addSolid(group, new THREE.BoxGeometry(dimensions.width, thickness, thickness), structure.appearance, edgeColor, [0, dimensions.height / 2, 0]);
  }
  return group;
}

function generateFrame(structure, dimensions, edgeColor) {
  const group = new THREE.Group();
  const leg = structure.parameters.legThickness;
  const beam = structure.parameters.beamThickness;
  [-1, 1].forEach((xSign) => [-1, 1].forEach((zSign) => {
    addSolid(group, new THREE.BoxGeometry(leg, dimensions.height, leg), structure.appearance, edgeColor, [xSign * (dimensions.width - leg) / 2, dimensions.height / 2, zSign * (dimensions.depth - leg) / 2]);
  }));
  [-1, 1].forEach((zSign) => {
    addSolid(group, new THREE.BoxGeometry(dimensions.width, beam, beam), structure.appearance, edgeColor, [0, dimensions.height, zSign * dimensions.depth / 2]);
  });
  [-1, 1].forEach((xSign) => {
    addSolid(group, new THREE.BoxGeometry(beam, beam, dimensions.depth), structure.appearance, edgeColor, [xSign * dimensions.width / 2, dimensions.height, 0]);
  });
  return group;
}

const STRUCTURE_GENERATORS = {
  ROOM: generateSpace,
  CORRIDOR: generateSpace,
  UTILITY_AREA: generateSpace,
  RAMP: generateRamp,
  STAIR: generateStair,
  RAILING: generateRailing,
  FENCE: generateRailing,
  STRUCTURAL_FRAME: generateFrame,
};

export function getWorldStructureSignature(structure, { selected, theme }) {
  return [
    structure.type,
    structure.name,
    structure.variant,
    JSON.stringify(structure.parameters),
    JSON.stringify(structure.appearance),
    selected,
    theme,
  ].join("|");
}

export function createWorldStructureObject(structure, { selected, theme, sceneTheme }) {
  const dimensions = getWorldStructureDimensions(structure);
  const edgeColor = selected ? sceneTheme.worldSelection : sceneTheme.worldEdge;
  const generator = STRUCTURE_GENERATORS[structure.type] ?? generateBoxStructure;
  const visual = generator(structure, dimensions, edgeColor);
  const definition = WORLD_STRUCTURE_TEMPLATE_MAP[structure.type];

  const object = new THREE.Group();
  object.name = structure.name;
  object.visible = structure.visible;
  object.userData.worldStructureId = structure.id;
  object.userData.domain = "WORLD";
  object.userData.structureType = structure.type;
  object.userData.visibilityType = structure.type === "WALL"
    ? "WALL"
    : definition.group === "BOUNDARY"
    ? "BOUNDARY"
    : ["PARTITION", "TEMPORARY_WALL"].includes(structure.type)
      ? "PARTITION"
      : structure.type === "COLUMN"
        ? "COLUMN"
        : structure.type === "PLATFORM"
          ? "PLATFORM"
          : definition.group === "OPENING"
            ? "OPENING"
            : "OTHER";
  object.userData.geometrySignature = getWorldStructureSignature(structure, { selected, theme });
  object.add(visual);
  object.position.set(structure.position.x, structure.position.y, structure.position.z);
  object.rotation.set(structure.rotation.x, structure.rotation.y, structure.rotation.z);
  return object;
}
