export function getBuildingFootprint(building) {
  const width = Math.max(5, Number(building?.parameters?.width) || 5);
  const depth = Math.max(5, Number(building?.parameters?.depth) || 5);
  return {
    width,
    depth,
    points: [
      { x: -width / 2, z: -depth / 2 },
      { x: width / 2, z: -depth / 2 },
      { x: width / 2, z: depth / 2 },
      { x: -width / 2, z: depth / 2 },
    ],
  };
}

export function isPointInsideFootprint(point, footprint) {
  let inside = false;
  const points = footprint?.points ?? [];
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    const intersects = ((currentPoint.z > point.z) !== (previousPoint.z > point.z))
      && point.x < (previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)
        / ((previousPoint.z - currentPoint.z) || Number.EPSILON) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
