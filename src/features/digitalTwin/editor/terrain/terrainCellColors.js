const validColor = (color) => /^#[0-9a-f]{6}$/i.test(color ?? "");

export function normalizeTerrainGradient(value) {
  if (!value || !validColor(value.endColor)
    || ![value.minX, value.maxX, value.minZ, value.maxZ].every(Number.isFinite)
    || value.minX >= value.maxX || value.minZ >= value.maxZ) return null;
  return { minX: value.minX, maxX: value.maxX, minZ: value.minZ, maxZ: value.maxZ,
    endColor: value.endColor, direction: ["POSITIVE_X", "NEGATIVE_X", "POSITIVE_Z", "NEGATIVE_Z"].includes(value.direction) ? value.direction : "POSITIVE_X" };
}

export function getTerrainGradientRatio(gradient, x, z) {
  if (!gradient) return 0;
  const alongZ = gradient.direction.endsWith("Z");
  const progress = alongZ ? (z - gradient.minZ) / (gradient.maxZ - gradient.minZ)
    : (x - gradient.minX) / (gradient.maxX - gradient.minX);
  return Math.max(0, Math.min(1, gradient.direction.startsWith("NEGATIVE") ? 1 - progress : progress));
}

export function normalizeTerrainCellColors(value, width, depth) {
  return (Array.isArray(value) ? value : []).filter((cell) => cell && validColor(cell.color)
    && [cell.minX, cell.maxX, cell.minZ, cell.maxZ].every(Number.isFinite)).map((cell) => ({
    minX: Math.max(-width / 2, cell.minX), maxX: Math.min(width / 2, cell.maxX),
    minZ: Math.max(-depth / 2, cell.minZ), maxZ: Math.min(depth / 2, cell.maxZ), color: cell.color,
    ...(normalizeTerrainGradient(cell.gradient) ? { gradient: normalizeTerrainGradient(cell.gradient) } : {}),
  })).filter((cell) => cell.minX < cell.maxX && cell.minZ < cell.maxZ);
}

export function getPaintCellBounds(start, end, cellSize, width, depth) {
  const size = Math.max(0.001, Number(cellSize) || 1);
  return {
    minX: Math.max(-width / 2, Math.floor(Math.min(start.x, end.x) / size) * size),
    maxX: Math.min(width / 2, (Math.floor(Math.max(start.x, end.x) / size) + 1) * size),
    minZ: Math.max(-depth / 2, Math.floor(Math.min(start.z, end.z) / size) * size),
    maxZ: Math.min(depth / 2, (Math.floor(Math.max(start.z, end.z) / size) + 1) * size),
  };
}

// Store contiguous cells as rectangles, without creating one scene object per cell.
export function paintTerrainCells(cells, bounds, color, gradient = null) {
  if (bounds.minX >= bounds.maxX || bounds.minZ >= bounds.maxZ) return cells;
  const result = [];
  for (const cell of cells ?? []) {
    const minX = Math.max(cell.minX, bounds.minX), maxX = Math.min(cell.maxX, bounds.maxX);
    const minZ = Math.max(cell.minZ, bounds.minZ), maxZ = Math.min(cell.maxZ, bounds.maxZ);
    if (minX >= maxX || minZ >= maxZ) { result.push({ ...cell }); continue; }
    if (cell.minX < minX) result.push({ ...cell, maxX: minX });
    if (cell.maxX > maxX) result.push({ ...cell, minX: maxX });
    if (cell.minZ < minZ) result.push({ ...cell, minX, maxX, maxZ: minZ });
    if (cell.maxZ > maxZ) result.push({ ...cell, minX, maxX, minZ: maxZ });
  }
  const normalizedGradient = normalizeTerrainGradient(gradient);
  if (validColor(color)) result.push({ ...bounds, color, ...(normalizedGradient ? { gradient: normalizedGradient } : {}) });
  // Coalesce neighboring cells after a drag to keep rendering and saved data small.
  let merged = true;
  while (merged && result.length > 1) {
    merged = false;
    const last = result.at(-1);
    for (let i = 0; i < result.length - 1; i += 1) {
      const cell = result[i];
      if (cell.color !== last.color) continue;
      if (JSON.stringify(cell.gradient) !== JSON.stringify(last.gradient)) continue;
      const horizontal = cell.minZ === last.minZ && cell.maxZ === last.maxZ
        && (Math.abs(cell.maxX - last.minX) < 1e-8 || Math.abs(last.maxX - cell.minX) < 1e-8);
      const vertical = cell.minX === last.minX && cell.maxX === last.maxX
        && (Math.abs(cell.maxZ - last.minZ) < 1e-8 || Math.abs(last.maxZ - cell.minZ) < 1e-8);
      if (!horizontal && !vertical) continue;
      Object.assign(last, { minX: Math.min(cell.minX, last.minX), maxX: Math.max(cell.maxX, last.maxX),
        minZ: Math.min(cell.minZ, last.minZ), maxZ: Math.max(cell.maxZ, last.maxZ) });
      result.splice(i, 1);
      merged = true;
      break;
    }
  }
  return result;
}
