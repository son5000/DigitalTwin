import { BUILDING_ENTITY_TYPES, createBuildingMassEntity, normalizeBuildingAssembly } from "./buildingAssembly.js";

export const CUSTOM_BUILDING_AUTHORING_MODES = Object.freeze({ BLOCK: "BLOCK", OUTLINE: "OUTLINE" });
export const BLOCK_EDIT_TOOLS = Object.freeze({ ADD: "ADD", REMOVE: "REMOVE" });

function key(cell) { return `${cell.level}:${cell.x}:${cell.z}`; }
function compareCells(left, right) { return left.level - right.level || left.z - right.z || left.x - right.x; }

export function normalizeBlockGrid(source = {}) {
  const cellSize = Math.max(0.5, Number(source.cellSize) || 4);
  const levelHeight = Math.max(2, Number(source.levelHeight) || 3.6);
  const unique = new Map();
  (source.cells ?? []).forEach((cell) => {
    const normalized = { x: Math.round(Number(cell.x) || 0), z: Math.round(Number(cell.z) || 0), level: Math.max(0, Math.round(Number(cell.level) || 0)) };
    unique.set(key(normalized), normalized);
  });
  return { version: 1, cellSize, levelHeight, cells: [...unique.values()].sort(compareCells) };
}

export function createDefaultBlockGrid({ width = 24, depth = 16, floorCount = 5, cellSize = 4, levelHeight = 3.6 } = {}) {
  const columns = Math.max(1, Math.round(width / cellSize));
  const rows = Math.max(1, Math.round(depth / cellSize));
  const startX = -Math.floor(columns / 2);
  const startZ = -Math.floor(rows / 2);
  const cells = [];
  for (let level = 0; level < floorCount; level += 1) {
    for (let z = 0; z < rows; z += 1) for (let x = 0; x < columns; x += 1) cells.push({ x: startX + x, z: startZ + z, level });
  }
  return normalizeBlockGrid({ cellSize, levelHeight, cells });
}

export function setBlockCell(grid, cell, occupied = true) {
  const normalized = normalizeBlockGrid(grid);
  const target = { x: Math.round(cell.x), z: Math.round(cell.z), level: Math.max(0, Math.round(cell.level)) };
  const cells = new Map(normalized.cells.map((item) => [key(item), item]));
  if (occupied) cells.set(key(target), target); else cells.delete(key(target));
  return { ...normalized, cells: [...cells.values()].sort(compareCells) };
}

export function fillBlockRange(grid, start, end, occupied = true) {
  let next = normalizeBlockGrid(grid);
  const bounds = {
    minX: Math.min(start.x, end.x), maxX: Math.max(start.x, end.x), minZ: Math.min(start.z, end.z), maxZ: Math.max(start.z, end.z),
    minLevel: Math.min(start.level, end.level), maxLevel: Math.max(start.level, end.level),
  };
  for (let level = bounds.minLevel; level <= bounds.maxLevel; level += 1) for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) for (let x = bounds.minX; x <= bounds.maxX; x += 1) next = setBlockCell(next, { x, z, level }, occupied);
  return next;
}

export function transformBlockCells(grid, selector, transform, { copy = false } = {}) {
  const normalized = normalizeBlockGrid(grid);
  const selected = normalized.cells.filter(selector);
  const retained = copy ? normalized.cells : normalized.cells.filter((cell) => !selector(cell));
  return normalizeBlockGrid({ ...normalized, cells: [...retained, ...selected.map((cell) => ({ ...cell, ...transform(cell) }))] });
}

export function duplicateBlockLevel(grid, sourceLevel, targetLevel = sourceLevel + 1) {
  return transformBlockCells(grid, (cell) => cell.level === sourceLevel, (cell) => ({ ...cell, level: targetLevel }), { copy: true });
}

export function mirrorBlockLevel(grid, level, axis = "X") {
  return transformBlockCells(grid, (cell) => cell.level === level, (cell) => axis === "X" ? { ...cell, x: -cell.x } : { ...cell, z: -cell.z }, { copy: true });
}

function rectanglesForLevel(cells) {
  const occupied = new Set(cells.map((cell) => `${cell.x}:${cell.z}`));
  const used = new Set();
  const rectangles = [];
  [...cells].sort((left, right) => left.z - right.z || left.x - right.x).forEach((cell) => {
    const cellKey = `${cell.x}:${cell.z}`;
    if (used.has(cellKey)) return;
    let width = 1;
    while (occupied.has(`${cell.x + width}:${cell.z}`) && !used.has(`${cell.x + width}:${cell.z}`)) width += 1;
    let depth = 1;
    while (Array.from({ length: width }, (_, offset) => `${cell.x + offset}:${cell.z + depth}`).every((candidate) => occupied.has(candidate) && !used.has(candidate))) depth += 1;
    for (let dz = 0; dz < depth; dz += 1) for (let dx = 0; dx < width; dx += 1) used.add(`${cell.x + dx}:${cell.z + dz}`);
    rectangles.push({ x: cell.x, z: cell.z, width, depth });
  });
  return rectangles;
}

export function getBlockLevelFootprintRegions(grid, level) {
  const normalized = normalizeBlockGrid(grid);
  return rectanglesForLevel(normalized.cells.filter((cell) => cell.level === level)).map((rectangle, index) => {
    const minX = rectangle.x * normalized.cellSize;
    const minZ = rectangle.z * normalized.cellSize;
    const maxX = minX + rectangle.width * normalized.cellSize;
    const maxZ = minZ + rectangle.depth * normalized.cellSize;
    return { id: `BLOCK_REGION_${level}_${index}`, points: [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }], holes: [] };
  });
}

export function deriveBlockBuildingAsset(source) {
  const blockGrid = normalizeBlockGrid(source.blockGrid);
  const maximumLevel = Math.max(0, ...blockGrid.cells.map((cell) => cell.level));
  const levels = Array.from({ length: maximumLevel + 1 }, (_, level) => ({ id: `block-level-${level}`, name: `${level + 1}층`, floorNumber: level + 1, order: level, baseElevation: level * blockGrid.levelHeight, topElevation: (level + 1) * blockGrid.levelHeight, height: blockGrid.levelHeight }));
  const stacked = [];
  levels.forEach((level, levelIndex) => rectanglesForLevel(blockGrid.cells.filter((cell) => cell.level === levelIndex)).forEach((rectangle) => {
    const signature = `${rectangle.x}:${rectangle.z}:${rectangle.width}:${rectangle.depth}`;
    const previous = stacked.find((item) => item.signature === signature && item.endLevel === levelIndex - 1);
    if (previous) { previous.endLevel = levelIndex; previous.levelIds.push(level.id); return; }
    stacked.push({ ...rectangle, signature, startLevel: levelIndex, endLevel: levelIndex, levelIds: [level.id] });
  }));
  const masses = stacked.map((rectangle) => {
    const width = rectangle.width * blockGrid.cellSize;
    const depth = rectangle.depth * blockGrid.cellSize;
    const centerX = rectangle.x * blockGrid.cellSize + width / 2;
    const centerZ = rectangle.z * blockGrid.cellSize + depth / 2;
    const mass = createBuildingMassEntity({ name: `블록 ${rectangle.startLevel + 1}~${rectangle.endLevel + 1}층`, baseElevation: rectangle.startLevel * blockGrid.levelHeight, topElevation: (rectangle.endLevel + 1) * blockGrid.levelHeight, position: { x: centerX, y: 0, z: centerZ }, footprint: { templateId: "BLOCK_RECTANGLE", points: [{ x: -width / 2, z: -depth / 2 }, { x: width / 2, z: -depth / 2 }, { x: width / 2, z: depth / 2 }, { x: -width / 2, z: depth / 2 }], holes: [] } });
    mass.id = `block-mass-${rectangle.startLevel}-${rectangle.endLevel}-${rectangle.x}-${rectangle.z}-${rectangle.width}-${rectangle.depth}`;
    mass.levelIds = rectangle.levelIds;
    return mass;
  });
  const retained = (source.entities ?? []).filter((entity) => entity.entityType !== BUILDING_ENTITY_TYPES.MASS && entity.entityType !== BUILDING_ENTITY_TYPES.CONNECTOR);
  return normalizeBuildingAssembly({ ...source, authoringMode: CUSTOM_BUILDING_AUTHORING_MODES.BLOCK, blockGrid, levels, entities: [...retained, ...masses], relations: [] });
}
