import * as THREE from "three";

import {
  getTerrainElevationRange,
  getTerrainFeatureElevation,
  getTerrainVertexPosition,
  normalizeTerrainModel,
  sampleTerrainElevation,
  TERRAIN_MATERIALS,
} from "./TerrainModel";
import { updateTerrainPaint } from "./TerrainPaintGeometry";
import { getTerrainGradientRatio } from "./terrainCellColors";

import { clipTerrainSurface, createTerrainCutSkirt, getFootprintTriangles, clipToFootprint } from "./TerrainShapeGeometry";
import { clipTerrainPolygon, clipExcavationPolygon } from "./TerrainFootprint";

const HEIGHT_LOW = new THREE.Color("#315c82");
const HEIGHT_MID = new THREE.Color("#7b9665");
const HEIGHT_HIGH = new THREE.Color("#c9b18a");

function materialAtPoint(terrain, features, x, z) {
  let selected = terrain.material;
  let magnitude = 0;
  let blend = 0;
  features.forEach((feature) => {
    const delta = Math.abs(getTerrainFeatureElevation(feature, x, z));
    if (delta <= magnitude) return;
    magnitude = delta;
    selected = feature.appearance?.material ?? feature.parameters?.surfaceMaterial ?? selected;
    blend = Math.min(1, delta / Math.max(0.001, Number(feature.dimensions?.height) || 1));
  });
  return { material: TERRAIN_MATERIALS[selected] ?? TERRAIN_MATERIALS.CONCRETE, blend };
}

function getVertexColor(terrain, features, x, z, elevation, range) {
  if (terrain.showHeightColors && range.max - range.min > 0.01) {
    const ratio = (elevation - range.min) / (range.max - range.min);
    const color = ratio < 0.5
      ? HEIGHT_LOW.clone().lerp(HEIGHT_MID, ratio * 2)
      : HEIGHT_MID.clone().lerp(HEIGHT_HIGH, (ratio - 0.5) * 2);
    if (terrain.showContours && Math.abs((elevation / 0.5) - Math.round(elevation / 0.5)) < 0.08) color.multiplyScalar(0.65);
    return color;
  }
  const base = TERRAIN_MATERIALS[terrain.material] ?? TERRAIN_MATERIALS.CONCRETE;
  const resolved = materialAtPoint(terrain, features, x, z);
  const color = new THREE.Color(terrain.color ?? base.color);
  if (terrain.colorGradient) color.lerp(new THREE.Color(terrain.colorGradient.endColor), getTerrainGradientRatio(terrain.colorGradient, x, z));
  if (!terrain.colorGradient) color.lerp(new THREE.Color(resolved.material.color), resolved.blend);
  if (terrain.showContours && Math.abs((elevation / 0.5) - Math.round(elevation / 0.5)) < 0.08) color.multiplyScalar(0.72);
  return color;
}

function getExcavationSignature(excavations = []) {
  return excavations.map((item) => [item.id, item.center?.x, item.center?.z, item.width, item.depth, item.bottom, item.rotationY]).join("|");
}

function createSurfaceGeometry(terrain, features, excavations = []) {
  const vertexCount = terrain.columns * terrain.rows;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = [];
  const range = getTerrainElevationRange(terrain, features);
  for (let row = 0; row < terrain.rows; row += 1) {
    for (let column = 0; column < terrain.columns; column += 1) {
      const index = row * terrain.columns + column;
      const point = getTerrainVertexPosition(terrain, column, row);
      const elevation = sampleTerrainElevation(terrain, point.x, point.z, features);
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = elevation;
      positions[index * 3 + 2] = point.z;
      const color = getVertexColor(terrain, features, point.x, point.z, elevation, range);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
      uvs[index * 2] = column / Math.max(1, terrain.columns - 1);
      uvs[index * 2 + 1] = row / Math.max(1, terrain.rows - 1);
    }
  }
  for (let row = 0; row < terrain.rows - 1; row += 1) {
    for (let column = 0; column < terrain.columns - 1; column += 1) {
      const topLeft = row * terrain.columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + terrain.columns;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.terrainTopology = `${terrain.columns}:${terrain.rows}:${terrain.width}:${terrain.depth}:${getExcavationSignature(excavations)}`;
  return clipTerrainSurface(geometry, terrain, excavations);
}

function updateSurfaceGeometry(geometry, terrain, features, excavations = []) {
  if (geometry.userData.clippedTerrain || terrain.shape === "CIRCLE" || terrain.removedAreas?.length) return false;
  const expectedTopology = `${terrain.columns}:${terrain.rows}:${terrain.width}:${terrain.depth}:${getExcavationSignature(excavations)}`;
  if (geometry.userData.terrainTopology !== expectedTopology) return false;
  const positions = geometry.attributes.position;
  const colors = geometry.attributes.color;
  const range = getTerrainElevationRange(terrain, features);
  for (let row = 0; row < terrain.rows; row += 1) {
    for (let column = 0; column < terrain.columns; column += 1) {
      const index = row * terrain.columns + column;
      const point = getTerrainVertexPosition(terrain, column, row);
      const elevation = sampleTerrainElevation(terrain, point.x, point.z, features);
      positions.setY(index, elevation);
      const color = getVertexColor(terrain, features, point.x, point.z, elevation, range);
      colors.setXYZ(index, color.r, color.g, color.b);
    }
  }
  positions.needsUpdate = true;
  colors.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.attributes.normal.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return true;
}

function createExcavationGroup(terrain, features, excavations, material) {
  const group = new THREE.Group();
  group.name = "지하 절개면";
  group.userData.terrainExcavations = true;
  excavations.forEach((excavation) => {
    const surface = sampleTerrainElevation(terrain, excavation.center.x, excavation.center.z, features);
    const bottom = Math.min(surface - 0.2, Number(excavation.bottom) || -3.6);
    const height = Math.max(0.2, surface - bottom);
    const wallMaterial = material.clone();
    const width = Math.max(0.4, Number(excavation.width) || 1);
    const depth = Math.max(0.4, Number(excavation.depth) || 1);
    const walls = [
      [width, 0.12, 0, depth / 2], [width, 0.12, 0, -depth / 2],
      [0.12, depth, width / 2, 0], [0.12, depth, -width / 2, 0],
    ];
    const root = new THREE.Group();
    root.position.set(excavation.center.x, bottom + height / 2, excavation.center.z);
    root.rotation.y = Number(excavation.rotationY) || 0;
    walls.forEach(([wallWidth, wallDepth, x, z]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, height, wallDepth), wallMaterial);
      wall.position.set(x, 0, z);
      wall.receiveShadow = true;
      root.add(wall);
    });
    group.add(root);
  });
  return group;
}

function createBoundarySkirtGeometry(terrain, features) {
  const boundary = [];
  for (let column = 0; column < terrain.columns; column += 1) boundary.push(getTerrainVertexPosition(terrain, column, 0));
  for (let row = 1; row < terrain.rows; row += 1) boundary.push(getTerrainVertexPosition(terrain, terrain.columns - 1, row));
  for (let column = terrain.columns - 2; column >= 0; column -= 1) boundary.push(getTerrainVertexPosition(terrain, column, terrain.rows - 1));
  for (let row = terrain.rows - 2; row > 0; row -= 1) boundary.push(getTerrainVertexPosition(terrain, 0, row));
  const range = getTerrainElevationRange(terrain, features);
  const bottom = Math.min(-0.35, range.min - 0.35);
  const positions = [];
  const indices = [];
  boundary.forEach((point, index) => {
    positions.push(point.x, sampleTerrainElevation(terrain, point.x, point.z, features), point.z);
    positions.push(point.x, bottom, point.z);
    const next = (index + 1) % boundary.length;
    indices.push(index * 2, next * 2, index * 2 + 1, next * 2, next * 2 + 1, index * 2 + 1);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createTerrainMesh(environment, terrainFeatures = [], excavations = []) {
  const terrain = normalizeTerrainModel(environment?.terrain, environment?.width, environment?.depth, environment?.groundMaterial);
  terrain.footprintRegions = environment?.footprintRegions;
  const baseMaterial = TERRAIN_MATERIALS[terrain.material] ?? TERRAIN_MATERIALS.CONCRETE;
  const mesh = new THREE.Mesh(
    createSurfaceGeometry(terrain, terrainFeatures, excavations),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: baseMaterial.roughness,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  mesh.name = "편집 지형";
  mesh.receiveShadow = true;
  const skirt = new THREE.Mesh(
    mesh.geometry.userData.clippedTerrain ? createTerrainCutSkirt(mesh.geometry, Math.min(-0.35, getTerrainElevationRange(terrain, terrainFeatures).min - 0.35)) : createBoundarySkirtGeometry(terrain, terrainFeatures),
    new THREE.MeshStandardMaterial({ color: terrain.color ?? baseMaterial.color, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
  );
  skirt.name = "지형 경계 마감";
  skirt.userData.terrainSkirt = true;
  mesh.add(skirt);
  mesh.add(createExcavationGroup(terrain, terrainFeatures, excavations, skirt.material));
  updateTerrainPaint(mesh, terrain, excavations);
  mesh.userData.terrainRevision = terrain.revision;
  return mesh;
}

export function updateTerrainMesh(mesh, environment, terrainFeatures = [], excavations = []) {
  const terrain = normalizeTerrainModel(environment?.terrain, environment?.width, environment?.depth, environment?.groundMaterial);
  terrain.footprintRegions = environment?.footprintRegions;
  if (!updateSurfaceGeometry(mesh.geometry, terrain, terrainFeatures, excavations)) {
    const nextGeometry = createSurfaceGeometry(terrain, terrainFeatures, excavations);
    mesh.geometry.dispose();
    mesh.geometry = nextGeometry;
  }
  terrain.footprintRegions = environment?.footprintRegions;
  const baseMaterial = TERRAIN_MATERIALS[terrain.material] ?? TERRAIN_MATERIALS.CONCRETE;
  mesh.material.roughness = baseMaterial.roughness;
  const currentSkirt = mesh.children.find((child) => child.userData.terrainSkirt);
  if (currentSkirt) {
    currentSkirt.geometry.dispose();
    currentSkirt.geometry = mesh.geometry.userData.clippedTerrain ? createTerrainCutSkirt(mesh.geometry, Math.min(-0.35, getTerrainElevationRange(terrain, terrainFeatures).min - 0.35)) : createBoundarySkirtGeometry(terrain, terrainFeatures);
    currentSkirt.material.color.set(terrain.color ?? baseMaterial.color);
  }
  const currentExcavations = mesh.children.find((child) => child.userData.terrainExcavations);
  if (currentExcavations) {
    currentExcavations.traverse((child) => {
      if (child.isMesh) child.geometry.dispose();
      if (child.isMesh && child.material !== currentSkirt?.material) child.material.dispose();
    });
    mesh.remove(currentExcavations);
  }
  mesh.add(createExcavationGroup(terrain, terrainFeatures, excavations, currentSkirt?.material ?? mesh.material));
  updateTerrainPaint(mesh, terrain, excavations);
  mesh.userData.terrainRevision = terrain.revision;
  return terrain;
}

export function syncTerrainPicker(picker, terrainMesh) {
  picker.geometry = terrainMesh.geometry;
  picker.position.set(0, 0.004, 0);
}

export function createTerrainGrid(environment, terrainFeatures, cellSize, colors, excavations = []) {
  const terrain = normalizeTerrainModel(environment?.terrain, environment?.width, environment?.depth, environment?.groundMaterial);
  const footprintTriangles = getFootprintTriangles(environment?.footprintRegions);
  const group = new THREE.Group();
  group.name = "SiteGrid";
  const halfWidth = terrain.width / 2;
  const halfDepth = terrain.depth / 2;
  const longestCellCount = Math.max(terrain.width, terrain.depth) / Math.max(cellSize, 0.001);
  const step = cellSize * Math.max(1, Math.ceil(longestCellCount / 800));
  const sampleStep = Math.max(0.75, Math.min(step, terrain.resolution));
  const linePoints = [];
  const centerPoints = [];
  const addLine = (start, end, target) => {
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    const count = Math.max(1, Math.ceil(length / sampleStep));
    for (let index = 0; index < count; index += 1) {
      const t0 = index / count;
      const t1 = (index + 1) / count;
      const points = [t0, t1].map((t) => ({ x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t }));
      const parts = clipTerrainPolygon([points[0], points[1], points[1]], terrain)
        .flatMap((part) => clipToFootprint(part, footprintTriangles))
        .flatMap((part) => clipExcavationPolygon(part, excavations));
      for (const part of parts) {
        const a = part[0], b = part.find((p) => Math.hypot(p.x - a.x, p.z - a.z) > 1e-8);
        if (!b) continue;
        for (const p of [a, b]) target.push(new THREE.Vector3(p.x, sampleTerrainElevation(terrain, p.x, p.z, terrainFeatures) + 0.018, p.z));
      }
    }
  };
  for (let x = Math.ceil(-halfWidth / step) * step; x <= halfWidth + 1e-6; x += step) {
    addLine({ x, z: -halfDepth }, { x, z: halfDepth }, Math.abs(x) < 1e-8 ? centerPoints : linePoints);
  }
  for (let z = Math.ceil(-halfDepth / step) * step; z <= halfDepth + 1e-6; z += step) {
    addLine({ x: -halfWidth, z }, { x: halfWidth, z }, Math.abs(z) < 1e-8 ? centerPoints : linePoints);
  }
  group.add(
    new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePoints), new THREE.LineBasicMaterial({ color: colors.grid, transparent: true, opacity: 0.72 })),
    new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(centerPoints), new THREE.LineBasicMaterial({ color: colors.gridCenter, transparent: true, opacity: 0.92 })),
  );
  const boundary = [
    [-halfWidth, -halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth], [-halfWidth, halfDepth], [-halfWidth, -halfDepth],
  ].map(([x, z]) => new THREE.Vector3(x, sampleTerrainElevation(terrain, x, z, terrainFeatures) + 0.025, z));
  if (terrain.shape !== "CIRCLE" && !terrain.removedAreas?.length && !environment?.footprintRegions?.length) group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(boundary), new THREE.LineBasicMaterial({ color: colors.edge })));
  return group;
}

export function createTerrainBrushCursor(color = 0x55d6be) {
  const geometry = new THREE.RingGeometry(0.48, 0.5, 64);
  const cursor = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthTest: false }));
  cursor.rotation.x = -Math.PI / 2;
  cursor.renderOrder = 20;
  cursor.visible = false;
  cursor.name = "지형 브러시";
  return cursor;
}

export function updateTerrainBrushCursor(cursor, point, brush, visible = true) {
  cursor.visible = visible && Boolean(point);
  if (!cursor.visible) return;
  cursor.position.set(point.x, point.y + 0.035, point.z);
  const radius = Math.max(0.25, Number(brush?.size) / 2 || 5);
  cursor.scale.set(radius * 2, radius * 2, radius * 2);
}
