import {
  getTerrainVertexIndex,
  getTerrainVertexPosition,
  normalizeTerrainModel,
  sampleBaseTerrainElevation,
} from "./TerrainModel";
import { getPaintCellBounds, paintTerrainCells } from "./terrainCellColors";

import { editTerrainFootprint } from "./TerrainFootprint";

export const TERRAIN_EDIT_MODES = Object.freeze({ BRUSH: "BRUSH", AREA: "AREA" });

export const TERRAIN_EDIT_TOOLS = Object.freeze({
  RAISE: "RAISE",
  LOWER: "LOWER",
  FLATTEN: "FLATTEN",
  SMOOTH: "SMOOTH",
  SET_HEIGHT: "SET_HEIGHT",
  SLOPE: "SLOPE",
  HILL: "HILL",
  PAINT: "PAINT",
  ERASE: "ERASE",
  REMOVE_GROUND: "REMOVE_GROUND",
  RESTORE_GROUND: "RESTORE_GROUND",
});

export const TERRAIN_BRUSH_SHAPES = Object.freeze({
  CIRCLE: "CIRCLE",
  SQUARE: "SQUARE",
  FREE: "FREE",
});

export const DEFAULT_TERRAIN_BRUSH = Object.freeze({
  mode: TERRAIN_EDIT_MODES.BRUSH,
  tool: TERRAIN_EDIT_TOOLS.RAISE,
  shape: TERRAIN_BRUSH_SHAPES.CIRCLE,
  size: 10,
  strength: 0.35,
  falloff: 0.65,
  targetHeight: 0,
  startHeight: 0,
  endHeight: 3,
  heightStep: 1,
  gradePercent: 10,
  heightInput: "HEIGHTS",
  direction: "POSITIVE_Z",
  hillHeight: 3,
  color: "#70777d",
  paintMode: "SOLID",
  gradientEndColor: "#627c63",
  gradientDirection: "POSITIVE_X",
});

export function isTerrainFootprintTool(brush) {
  return [TERRAIN_EDIT_TOOLS.REMOVE_GROUND, TERRAIN_EDIT_TOOLS.RESTORE_GROUND].includes(brush.tool);
}

export function isTerrainCellTool(brush) {
  return isTerrainColorTool(brush) || isTerrainFootprintTool(brush);
}

export function isTerrainColorTool(brush) {
  return [TERRAIN_EDIT_TOOLS.PAINT, TERRAIN_EDIT_TOOLS.ERASE].includes(brush.tool);
}

export function isTerrainAreaProfile(brush) {
  return brush.mode === TERRAIN_EDIT_MODES.AREA
    && [TERRAIN_EDIT_TOOLS.SLOPE, TERRAIN_EDIT_TOOLS.HILL].includes(brush.tool);
}

// Use the snapped selection for both the displayed grade and the generated surface.
export function getTerrainAreaProfile(terrain, start, end, brush) {
  const bounds = getTerrainEditBounds(terrain, start, end, brush);
  const alongX = ["POSITIVE_X", "NEGATIVE_X"].includes(brush.direction);
  const reverse = ["NEGATIVE_X", "NEGATIVE_Z"].includes(brush.direction);
  const length = alongX ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ;
  const center = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
  const startPoint = alongX ? { x: reverse ? bounds.maxX : bounds.minX, z: center.z }
    : { x: center.x, z: reverse ? bounds.maxZ : bounds.minZ };
  const endPoint = alongX ? { x: reverse ? bounds.minX : bounds.maxX, z: center.z }
    : { x: center.x, z: reverse ? bounds.minZ : bounds.maxZ };
  const startHeight = finite(brush.startHeight);
  const endHeight = brush.heightInput === "GRADE"
    ? startHeight + length * finite(brush.gradePercent) / 100
    : finite(brush.endHeight, finite(brush.targetHeight));
  const hillHeight = brush.tool === TERRAIN_EDIT_TOOLS.HILL ? Math.max(0, finite(brush.hillHeight, 3)) : 0;
  const hasHillInterior = hillHeight === 0 || (
    bounds.maxX - bounds.minX >= 2 * terrain.width / (terrain.columns - 1) - 1e-8
    && bounds.maxZ - bounds.minZ >= 2 * terrain.depth / (terrain.rows - 1) - 1e-8
  );
  return { bounds, alongX, reverse, length, startPoint, endPoint, startHeight, endHeight, hillHeight,
    hasHillInterior,
    gradePercent: length > 0 ? (endHeight - startHeight) / length * 100 : 0,
    valid: length > 0 && hasHillInterior && Math.min(startHeight, endHeight) >= -80 && Math.max(startHeight, endHeight) + hillHeight <= 80 };
}

export function getTerrainEditBounds(terrain, start, end, brush) {
  if (isTerrainCellTool(brush)) return getPaintCellBounds(start, end, brush.cellSize, terrain.width, terrain.depth);
  const stepX = terrain.width / (terrain.columns - 1), stepZ = terrain.depth / (terrain.rows - 1);
  const minX = Math.floor((Math.min(start.x, end.x) + terrain.width / 2) / stepX);
  const minZ = Math.floor((Math.min(start.z, end.z) + terrain.depth / 2) / stepZ);
  const bounds = {
    minX: Math.max(-terrain.width / 2, minX * stepX - terrain.width / 2),
    maxX: Math.min(terrain.width / 2, Math.max(minX + 1, Math.ceil((Math.max(start.x, end.x) + terrain.width / 2) / stepX)) * stepX - terrain.width / 2),
    minZ: Math.max(-terrain.depth / 2, minZ * stepZ - terrain.depth / 2),
    maxZ: Math.min(terrain.depth / 2, Math.max(minZ + 1, Math.ceil((Math.max(start.z, end.z) + terrain.depth / 2) / stepZ)) * stepZ - terrain.depth / 2),
  };
  // A dome needs an interior vertex; one-cell selections otherwise stay flat.
  if (brush.tool === TERRAIN_EDIT_TOOLS.HILL) {
    bounds.maxX = Math.min(terrain.width / 2, Math.max(bounds.maxX, bounds.minX + stepX * 2));
    bounds.minX = Math.max(-terrain.width / 2, Math.min(bounds.minX, bounds.maxX - stepX * 2));
    bounds.maxZ = Math.min(terrain.depth / 2, Math.max(bounds.maxZ, bounds.minZ + stepZ * 2));
    bounds.minZ = Math.max(-terrain.depth / 2, Math.min(bounds.minZ, bounds.maxZ - stepZ * 2));
  }
  return bounds;
}

export function applyTerrainArea(terrainValue, start, end, brush, siteWidth, siteDepth) {
  const terrain = normalizeTerrainModel(terrainValue, siteWidth, siteDepth, terrainValue?.material);
  const bounds = getTerrainEditBounds(terrain, start, end, brush);
  if (isTerrainFootprintTool(brush)) return editTerrainFootprint(terrain, bounds, brush.tool === TERRAIN_EDIT_TOOLS.RESTORE_GROUND);
  if (isTerrainColorTool(brush)) return { ...terrain,
    cellColors: paintTerrainCells(terrain.cellColors, bounds, brush.tool === TERRAIN_EDIT_TOOLS.ERASE ? null : brush.color,
      brush.paintMode === "GRADIENT" ? { ...bounds, endColor: brush.gradientEndColor, direction: brush.gradientDirection } : null),
    revision: terrain.revision + 1 };
  const elevations = [...terrain.elevations];
  const amount = Math.max(0.01, finite(brush.heightStep, 1));
  const flattenHeight = finite(brush.flattenHeight, sampleBaseTerrainElevation(terrain, start.x, start.z));
  const profile = isTerrainAreaProfile(brush) ? getTerrainAreaProfile(terrain, start, end, brush) : null;
  if (profile && !profile.valid) return terrain;
  for (let row = 0; row < terrain.rows; row += 1) for (let column = 0; column < terrain.columns; column += 1) {
    const point = getTerrainVertexPosition(terrain, column, row);
    if (point.x < bounds.minX - 1e-8 || point.x > bounds.maxX + 1e-8 || point.z < bounds.minZ - 1e-8 || point.z > bounds.maxZ + 1e-8) continue;
    const index = getTerrainVertexIndex(terrain, column, row);
    if (brush.tool === TERRAIN_EDIT_TOOLS.RAISE) elevations[index] += amount;
    if (brush.tool === TERRAIN_EDIT_TOOLS.LOWER) elevations[index] -= amount;
    if (brush.tool === TERRAIN_EDIT_TOOLS.SET_HEIGHT) elevations[index] = finite(brush.targetHeight);
    if (brush.tool === TERRAIN_EDIT_TOOLS.FLATTEN) elevations[index] = flattenHeight;
    if (brush.tool === TERRAIN_EDIT_TOOLS.SMOOTH) elevations[index] = neighborAverage(terrain, column, row);
    if (profile) {
      const x = (point.x - bounds.minX) / (bounds.maxX - bounds.minX);
      const z = (point.z - bounds.minZ) / (bounds.maxZ - bounds.minZ);
      const progress = profile.alongX ? x : z;
      const t = profile.reverse ? 1 - progress : progress;
      const cross = profile.alongX ? z : x;
      const dome = Math.sin(Math.PI * t) ** 2 * Math.sin(Math.PI * cross) ** 2;
      elevations[index] = profile.startHeight + (profile.endHeight - profile.startHeight) * t + profile.hillHeight * dome;
    }
    elevations[index] = clamp(elevations[index], -80, 80);
  }
  return { ...terrain, elevations, revision: terrain.revision + 1 };
}

export function applyTerrainColorStroke(terrainValue, start, end, brush, siteWidth, siteDepth) {
  let terrain = normalizeTerrainModel(terrainValue, siteWidth, siteDepth, terrainValue?.material);
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(end.x - start.x), Math.abs(end.z - start.z)) / Math.max(0.001, brush.cellSize || 1) * 2));
  for (let i = 0; i <= count; i += 1) {
    const point = { x: start.x + (end.x - start.x) * i / count, z: start.z + (end.z - start.z) * i / count };
    const bounds = getPaintCellBounds(point, point, brush.cellSize, terrain.width, terrain.depth);
    if (isTerrainFootprintTool(brush)) { terrain = editTerrainFootprint(terrain, bounds, brush.tool === TERRAIN_EDIT_TOOLS.RESTORE_GROUND); continue; }
    terrain = { ...terrain, cellColors: paintTerrainCells(terrain.cellColors, bounds, brush.tool === TERRAIN_EDIT_TOOLS.ERASE ? null : brush.color) };
  }
  return { ...terrain, revision: terrain.revision + 1 };
}

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
  if (brush.tool === TERRAIN_EDIT_TOOLS.HILL) {
    brush.size = Math.max(finite(brush.size, 10), 2 * terrain.width / (terrain.columns - 1), 2 * terrain.depth / (terrain.rows - 1));
  }
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
      if (brush.tool === TERRAIN_EDIT_TOOLS.HILL) {
        const radius = Math.max(0.5, finite(brush.size, 10) / 2);
        const dx = Math.abs(point.x - center.x), dz = Math.abs(point.z - center.z);
        const distance = brush.shape === TERRAIN_BRUSH_SHAPES.SQUARE ? Math.max(dx, dz) : Math.hypot(dx, dz);
        const dome = Math.cos(Math.min(1, distance / radius) * Math.PI / 2) ** 2;
        const target = flattenHeight + Math.max(0, finite(brush.hillHeight, 3)) * dome;
        elevations[index] = current + Math.max(0, target - current) * clamp(strength, 0, 1) * weight;
      }
      elevations[index] = clamp(elevations[index], -80, 80);
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
  const endHeight = brush.heightInput === "GRADE"
    ? startHeight + Math.sqrt(lengthSquared) * finite(brush.gradePercent, 10) / 100
    : finite(brushValue.endHeight, finite(brushValue.targetHeight, brush.endHeight));
  const elevations = [...terrain.elevations];
  const corridor = Math.max(0.5, finite(brush.size, 10) / 2);
  for (let row = 0; row < terrain.rows; row += 1) {
    for (let column = 0; column < terrain.columns; column += 1) {
      const point = getTerrainVertexPosition(terrain, column, row);
      const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared, 0, 1);
      const closest = { x: start.x + dx * t, z: start.z + dz * t };
      const distance = Math.hypot(point.x - closest.x, point.z - closest.z);
      if (distance > corridor) continue;
      const weight = brushWeight(point, closest, { ...brush, size: corridor * 2 });
      const index = getTerrainVertexIndex(terrain, column, row);
      const target = startHeight + (endHeight - startHeight) * t;
      elevations[index] = clamp(elevations[index] + (target - elevations[index]) * weight, -80, 80);
    }
  }
  return { ...terrain, elevations, revision: terrain.revision + 1 };
}
