function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedPoints(path) {
  return Array.isArray(path?.points)
    ? path.points.map((point) => ({ ...point, x: finite(point?.x), z: finite(point?.z) }))
    : [];
}

export function getSiteLinearPathLength(path) {
  const points = normalizedPoints(path);
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point.x - previous.x, point.z - previous.z);
  }, 0);
}

export function resizeSiteLinearPath(path, requestedLength) {
  const points = normalizedPoints(path);
  const currentLength = getSiteLinearPathLength({ points });
  const targetLength = Math.max(0.1, finite(requestedLength, currentLength || 0.1));

  if (points.length < 2 || currentLength < 0.001) {
    return {
      ...path,
      points: [{ x: -targetLength / 2, z: 0 }, { x: targetLength / 2, z: 0 }],
    };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const scale = targetLength / currentLength;

  return {
    ...path,
    points: points.map((point) => ({
      ...point,
      x: centerX + (point.x - centerX) * scale,
      z: centerZ + (point.z - centerZ) * scale,
    })),
  };
}

export function getSiteLinearPathFootprint(path) {
  const points = normalizedPoints(path);
  const pathWidth = Math.max(0.1, finite(path?.width, 0.5));
  const halfWidth = pathWidth / 2;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  points.slice(1).forEach((end, index) => {
    const start = points[index];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.001) return;
    const expansionX = Math.abs(dz / length) * halfWidth;
    const expansionZ = Math.abs(dx / length) * halfWidth;
    minX = Math.min(minX, start.x - expansionX, end.x - expansionX);
    maxX = Math.max(maxX, start.x + expansionX, end.x + expansionX);
    minZ = Math.min(minZ, start.z - expansionZ, end.z - expansionZ);
    maxZ = Math.max(maxZ, start.z + expansionZ, end.z + expansionZ);
  });

  if (!Number.isFinite(minX)) return { width: pathWidth, depth: pathWidth };
  return {
    width: Math.max(0.1, maxX - minX),
    depth: Math.max(0.1, maxZ - minZ),
  };
}

export function createSiteLinearPathChanges(object, changes) {
  const requestedWidth = Math.max(0.1, finite(changes?.width, object.path?.width ?? 0.5));
  const pathWithWidth = { ...object.path, width: requestedWidth };
  const path = changes?.length === undefined
    ? pathWithWidth
    : resizeSiteLinearPath(pathWithWidth, changes.length);
  return {
    path,
    dimensions: getSiteLinearPathFootprint(path),
  };
}
