export const GRID_CELL_SIZE_OPTIONS = Object.freeze([0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]);

export const DEFAULT_GRID_SETTINGS = Object.freeze({
  enabled: false,
  baseSize: 1,
  verticalSnap: null,
  regions: Object.freeze([]),
});

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeGridCellSize(value, fallback = DEFAULT_GRID_SETTINGS.baseSize) {
  return Math.min(100, Math.max(0.001, finiteNumber(value, fallback)));
}

export function createDefaultGridSettings() {
  return {
    enabled: DEFAULT_GRID_SETTINGS.enabled,
    baseSize: DEFAULT_GRID_SETTINGS.baseSize,
    verticalSnap: DEFAULT_GRID_SETTINGS.verticalSnap,
    regions: [],
  };
}

export function createGridRegion(scopeId, index = 0, baseSize = DEFAULT_GRID_SETTINGS.baseSize) {
  return {
    id: `GRID_REGION_${crypto.randomUUID()}`,
    scopeId,
    name: `Detail Region ${String(index + 1).padStart(2, "0")}`,
    center: { x: 0, z: 0 },
    size: { width: 10, depth: 10 },
    cellSize: Math.min(normalizeGridCellSize(baseSize), 0.5),
    enabled: true,
  };
}

export function normalizeGridRegion(region, index = 0) {
  if (!region || typeof region.scopeId !== "string") return null;

  return {
    id: typeof region.id === "string" ? region.id : `GRID_REGION_${crypto.randomUUID()}`,
    scopeId: region.scopeId,
    name: typeof region.name === "string" && region.name.trim()
      ? region.name
      : `Detail Region ${String(index + 1).padStart(2, "0")}`,
    center: {
      x: finiteNumber(region.center?.x, 0),
      z: finiteNumber(region.center?.z, 0),
    },
    size: {
      width: Math.max(0.1, finiteNumber(region.size?.width, 10)),
      depth: Math.max(0.1, finiteNumber(region.size?.depth, 10)),
    },
    cellSize: normalizeGridCellSize(region.cellSize, 0.5),
    enabled: region.enabled !== false,
  };
}

export function normalizeGridSettings(settings) {
  if (!settings) return createDefaultGridSettings();

  return {
    enabled: Boolean(settings.enabled),
    baseSize: normalizeGridCellSize(settings.baseSize),
    verticalSnap: settings.verticalSnap == null
      ? null
      : normalizeGridCellSize(settings.verticalSnap, 0.1),
    regions: Array.isArray(settings.regions)
      ? settings.regions.map(normalizeGridRegion).filter(Boolean)
      : [],
  };
}

export function getGridRegionsForScope(settings, scopeId) {
  return (settings?.regions ?? []).filter((region) => region.scopeId === scopeId);
}

function containsPosition(region, position) {
  return (
    Math.abs(position.x - region.center.x) <= region.size.width / 2 &&
    Math.abs(position.z - region.center.z) <= region.size.depth / 2
  );
}

export function getGridResolutionAtPosition(settings, scopeId, position) {
  const baseSize = normalizeGridCellSize(settings?.baseSize);
  if (!position) return baseSize;

  return getGridRegionsForScope(settings, scopeId).reduce((resolution, region) => (
    region.enabled && containsPosition(region, position)
      ? Math.min(resolution, normalizeGridCellSize(region.cellSize, resolution))
      : resolution
  ), baseSize);
}

function roundToGrid(value, cellSize) {
  const snapped = Math.round(value / cellSize) * cellSize;
  const precision = Math.min(8, Math.max(0, Math.ceil(-Math.log10(cellSize)) + 2));
  return Number(snapped.toFixed(precision));
}

export function snapHorizontalPosition(position, settings, scopeId) {
  if (!settings?.enabled) {
    return { position: { ...position }, cellSize: null };
  }

  const cellSize = getGridResolutionAtPosition(settings, scopeId, position);
  return {
    position: {
      ...position,
      x: roundToGrid(position.x, cellSize),
      z: roundToGrid(position.z, cellSize),
    },
    cellSize,
  };
}

export function formatGridResolution(cellSize) {
  if (cellSize < 1) return `${Number((cellSize * 100).toFixed(2))} cm`;
  return `${Number(cellSize.toFixed(3))} m`;
}
