import {
  getTerrainVertexIndex,
  getTerrainVertexPosition,
  normalizeTerrainModel,
  sampleBaseTerrainElevation,
} from "./TerrainModel";

export const TERRAIN_EDIT_TOOLS = Object.freeze({
  RAISE: "RAISE",
  LOWER: "LOWER",
  FLATTEN: "FLATTEN",
  SMOOTH: "SMOOTH",
  SET_HEIGHT: "SET_HEIGHT",
  SLOPE: "SLOPE",
});

export const TERRAIN_BRUSH_SHAPES = Object.freeze({
  CIRCLE: "CIRCLE",
  SQUARE: "SQUARE",
  FREE: "FREE",
});

export const DEFAULT_TERRAIN_BRUSH = Object.freeze({
  tool: TERRAIN_EDIT_TOOLS.RAISE,
  shape: TERRAIN_BRUSH_SHAPES.CIRCLE,
  size: 10,
  strength: 0.35,
  falloff: 0.65,
  targetHeight: 0,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function brushWeight(point, center, brush) {
  const radius = Math.max(0.25, finite(brush.size, 10) / 2);
  const dx = Math.abs(point.x - center.x);
  const dz = Math.abs(point.z - center.z);
  const normalizedDistance = brush.shape === TERRAIN_BRUSH_SHAPES.SQUARE
    ? Math.max(dx, dz) / radius
    : Math.hypot(dx, dz) / radius;
  if (normalizedDistance > 1) return 0;
  const falloff = clamp(finite(brush.falloff, 0.65), 0, 1);
  if (falloff <= 0.001) return 1;
  const edgeStart = 1 - falloff;
  if (normalizedDistance <= edgeStart) return 1;
  const t = clamp((1 - normalizedDistance) / falloff, 0, 1);
  return t * t * (3 - 2 * t);
}

function neighborAverage(terrain, column, row) {
  let total = 0;
  let count = 0;
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const nextColumn = column + columnOffset;
      const nextRow = row + rowOffset;
      if (nextColumn < 0 || nextColumn >= terrain.columns || nextRow < 0 || nextRow >= terrain.rows) continue;
      total += terrain.elevations[getTerrainVertexIndex(terrain, nextColumn, nextRow)];
      count += 1;
    }
  }
  return count ? total / count : terrain.elevations[getTerrainVertexIndex(terrain, column, row)];
}

export function applyTerrainBrush(terrainValue, center, brushValue, siteWidth, siteDepth) {
  const terrain = normalizeTerrainModel(terrainValue, siteWidth, siteDepth, terrainValue?.material);
  const brush = { ...DEFAULT_TERRAIN_BRUSH, ...brushValue };
  const elevations = [...terrain.elevations];
  const strength = clamp(finite(brush.strength, 0.35), 0.01, 2);
  const flattenHeight = Number.isFinite(Number(brush.flattenHeight))
    ? Number(brush.flattenHeight)
    : sampleBaseTerrainElevation(terrain, center.x, center.z);
  for (let row = 0; row < terrain.rows; row += 1) {
    for (let column = 0; column < terrain.columns; column += 1) {
      const point = getTerrainVertexPosition(terrain, column, row);
      const weight = brushWeight(point, center, brush);
      if (weight <= 0) continue;
      const index = getTerrainVertexIndex(terrain, column, row);
      const current = terrain.elevations[index];
      if (brush.tool === TERRAIN_EDIT_TOOLS.RAISE) elevations[index] = current + strength * weight;
      if (brush.tool === TERRAIN_EDIT_TOOLS.LOWER) elevations[index] = current - strength * weight;
      if (brush.tool === TERRAIN_EDIT_TOOLS.FLATTEN) elevations[index] = current + (flattenHeight - current) * clamp(strength, 0, 1) * weight;
      if (brush.tool === TERRAIN_EDIT_TOOLS.SET_HEIGHT) elevations[index] = current + (finite(brush.targetHeight) - current) * clamp(strength, 0, 1) * weight;
      if (brush.tool === TERRAIN_EDIT_TOOLS.SMOOTH) elevations[index] = current + (neighborAverage(terrain, column, row) - current) * clamp(strength, 0, 1) * weight;
    }
  }
  return { ...terrain, elevations, revision: terrain.revision + 1 };
}

export function applyTerrainSlope(terrainValue, start, end, brushValue, siteWidth, siteDepth) {
  const terrain = normalizeTerrainModel(terrainValue, siteWidth, siteDepth, terrainValue?.material);
  const brush = { ...DEFAULT_TERRAIN_BRUSH, ...brushValue };
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < 0.01) return terrain;
  const startHeight = Number.isFinite(Number(brush.startHeight))
    ? Number(brush.startHeight)
    : sampleBaseTerrainElevation(terrain, start.x, start.z);
  const endHeight = Number.isFinite(Number(brush.endHeight))
    ? Number(brush.endHeight)
    : finite(brush.targetHeight, startHeight);
  const elevations = [...terrain.elevations];
  const corridor = Math.max(0.5, finite(brush.size, 10) / 2);
  for (let row = 0; row < terrain.rows; row += 1) {
    for (let column = 0; column < terrain.columns; column += 1) {
      const point = getTerrainVertexPosition(terrain, column, row);
      const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared, 0, 1);
      const closest = { x: start.x + dx * t, z: start.z + dz * t };
      const distance = Math.hypot(point.x - closest.x, point.z - closest.z);
      if (distance > corridor) continue;
      const weight = 1 - distance / corridor;
      const index = getTerrainVertexIndex(terrain, column, row);
      const target = startHeight + (endHeight - startHeight) * t;
      elevations[index] += (target - elevations[index]) * weight;
    }
  }
  return { ...terrain, elevations, revision: terrain.revision + 1 };
}
