export const MAX_AREA_PLACEMENT_COUNT = 2500;
export const MAX_GHOST_PREVIEW_COUNT = 256;

const EPSILON = 1e-8;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback = 1) {
  return Math.max(EPSILON, finite(value, fallback));
}

function resolveScale(scale) {
  if (typeof scale === "number") {
    const normalized = positive(scale, 1);
    return { x: normalized, y: normalized, z: normalized };
  }
  return {
    x: positive(scale?.x, 1),
    y: positive(scale?.y, 1),
    z: positive(scale?.z, 1),
  };
}

export function calculateObjectFootprint(source, options = {}) {
  const dimensions = source?.dimensions ?? source ?? {};
  const baseWidth = positive(dimensions.width, source?.width ?? 1);
  const baseDepth = positive(dimensions.depth, source?.depth ?? 1);
  const scale = resolveScale(options.scale ?? source?.scale);
  const rotationY = finite(options.rotationY, source?.rotation?.y ?? source?.rotationY ?? 0);
  const padding = Math.max(0, finite(options.padding, 0));
  const scaledWidth = baseWidth * scale.x;
  const scaledDepth = baseDepth * scale.z;
  const cosine = Math.abs(Math.cos(rotationY));
  const sine = Math.abs(Math.sin(rotationY));
  const width = scaledWidth * cosine + scaledDepth * sine;
  const depth = scaledWidth * sine + scaledDepth * cosine;

  return {
    width: width + padding * 2,
    depth: depth + padding * 2,
    objectWidth: scaledWidth,
    objectDepth: scaledDepth,
    rotationY,
    scale,
    padding,
  };
}

function snapUp(value, cellSize) {
  return Math.ceil((value - EPSILON) / cellSize) * cellSize;
}

export function calculatePlacementGrid(area, footprint, options = {}) {
  const width = Math.max(0, finite(area?.width, 0));
  const depth = Math.max(0, finite(area?.depth, 0));
  const centerX = finite(area?.center?.x, 0);
  const centerZ = finite(area?.center?.z, 0);
  const gridEnabled = options.gridEnabled !== false;
  const cellSize = gridEnabled ? positive(options.cellSize, area?.cellSize ?? 1) : null;
  const minX = centerX - width / 2;
  const maxX = centerX + width / 2;
  const minZ = centerZ - depth / 2;
  const maxZ = centerZ + depth / 2;
  const minimumCenterX = minX + footprint.width / 2;
  const maximumCenterX = maxX - footprint.width / 2;
  const minimumCenterZ = minZ + footprint.depth / 2;
  const maximumCenterZ = maxZ - footprint.depth / 2;
  const startX = gridEnabled ? snapUp(minimumCenterX, cellSize) : minimumCenterX;
  const startZ = gridEnabled ? snapUp(minimumCenterZ, cellSize) : minimumCenterZ;
  const pitchX = gridEnabled ? snapUp(footprint.width, cellSize) : footprint.width;
  const pitchZ = gridEnabled ? snapUp(footprint.depth, cellSize) : footprint.depth;
  const columns = startX <= maximumCenterX + EPSILON
    ? Math.floor((maximumCenterX - startX + EPSILON) / pitchX) + 1
    : 0;
  const rows = startZ <= maximumCenterZ + EPSILON
    ? Math.floor((maximumCenterZ - startZ + EPSILON) / pitchZ) + 1
    : 0;

  return {
    area: { center: { x: centerX, z: centerZ }, width, depth, cellSize: cellSize ?? area?.cellSize ?? null },
    footprint,
    gridEnabled,
    cellSize,
    minX,
    maxX,
    minZ,
    maxZ,
    startX,
    startZ,
    pitchX,
    pitchZ,
    columns,
    rows,
    count: columns * rows,
  };
}

export function generatePlacementPositions(grid, limit = Number.POSITIVE_INFINITY) {
  const positions = [];
  const normalizedLimit = Math.max(0, finite(limit, Number.POSITIVE_INFINITY));
  for (let row = 0; row < grid.rows && positions.length < normalizedLimit; row += 1) {
    for (let column = 0; column < grid.columns && positions.length < normalizedLimit; column += 1) {
      positions.push({
        x: Number((grid.startX + column * grid.pitchX).toFixed(6)),
        y: 0,
        z: Number((grid.startZ + row * grid.pitchZ).toFixed(6)),
        row,
        column,
      });
    }
  }
  return positions;
}

export function placeObjectsInArea({
  area,
  object,
  scale,
  rotationY,
  padding = 0,
  gridEnabled = true,
  cellSize,
  maxCount = MAX_AREA_PLACEMENT_COUNT,
  previewLimit = MAX_GHOST_PREVIEW_COUNT,
}) {
  const footprint = calculateObjectFootprint(object, { scale, rotationY, padding });
  const grid = calculatePlacementGrid(area, footprint, { gridEnabled, cellSize });
  const fits = grid.count > 0;
  const exceedsLimit = grid.count > maxCount;
  const canPlace = fits && !exceedsLimit;
  const positions = canPlace ? generatePlacementPositions(grid) : [];
  const previewPositions = fits ? generatePlacementPositions(grid, previewLimit) : [];
  let message = `${grid.columns}열 × ${grid.rows}행 · ${grid.count}개 배치`;
  if (!fits) {
    message = `선택 영역보다 오브젝트가 큽니다. 최소 ${footprint.width.toFixed(2)} × ${footprint.depth.toFixed(2)} m가 필요합니다.`;
  } else if (exceedsLimit) {
    message = `예상 배치 ${grid.count}개가 안전 한도 ${maxCount}개를 초과합니다. 영역을 줄여주세요.`;
  }

  return {
    ...grid,
    fits,
    canPlace,
    exceedsLimit,
    positions,
    previewPositions,
    message,
  };
}
