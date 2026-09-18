import { normalizeTerrainModel } from "./TerrainModel";

export function serializeTerrain(terrain, width, depth, material) {
  const normalized = normalizeTerrainModel(terrain, width, depth, material);
  return {
    version: normalized.version,
    width: normalized.width,
    depth: normalized.depth,
    resolution: normalized.resolution,
    columns: normalized.columns,
    rows: normalized.rows,
    elevations: normalized.elevations.map((value) => Number(value.toFixed(4))),
    material: normalized.material,
    shape: normalized.shape,
    removedAreas: normalized.removedAreas.map((area) => ({ ...area })),
    color: normalized.color,
    colorGradient: normalized.colorGradient ? { ...normalized.colorGradient } : null,
    cellColors: normalized.cellColors.map((cell) => ({ ...cell, ...(cell.gradient ? { gradient: { ...cell.gradient } } : {}) })),
    showContours: normalized.showContours,
    showHeightColors: normalized.showHeightColors,
    revision: normalized.revision,
  };
}

export function restoreTerrain(value, width, depth, material) {
  return normalizeTerrainModel(value, width, depth, material);
}
