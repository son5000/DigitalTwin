import * as THREE from "three";
import { createGradedStripGeometry } from "./GradedRoadFactory";

// Project the full footprint onto terrain triangles before extruding it. This
// keeps both sides grounded even across sharp grade changes and rotated paths.
export function createBoundaryWallGeometry(object, verticalPath = null) {
  const samples = verticalPath?.points?.length ? verticalPath.points
    : (object.path?.points ?? []).map((point) => ({ ...point, y: 0 }));
  const footprint = createGradedStripGeometry(samples, {
    width: object.path?.width ?? 0.5,
    terrainProjection: verticalPath?.terrainProjection,
  });
  const source = footprint.getAttribute("position");
  if (!source?.count) return footprint;
  const height = Math.max(0.02, Number(object.dimensions.height) || 2);
  let highest = -Infinity;
  for (let i = 0; i < source.count; i += 1) highest = Math.max(highest, source.getY(i));
  const levelTop = highest + height;
  const fixedTop = object.parameters?.wallHeightMode === "LEVEL_TOP";
  const positions = [], edges = new Map();
  const top = (p) => ({ ...p, y: fixedTop ? levelTop : p.y + height });
  const bottom = (p) => ({ ...p, y: p.y - 0.02 });
  const push = (...points) => points.forEach((p) => positions.push(p.x, p.y, p.z));
  const key = (p) => `${p.x.toFixed(6)},${p.z.toFixed(6)}`;
  const count = footprint.index?.count ?? source.count;
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map((offset) => {
      const id = footprint.index ? footprint.index.getX(i + offset) : i + offset;
      return { x: source.getX(id), y: source.getY(id), z: source.getZ(id) };
    });
    let [a, b, c] = triangle;
    if ((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x) > 0) [b, c] = [c, b];
    push(top(a), top(b), top(c), bottom(c), bottom(b), bottom(a));
    for (const [left, right] of [[a, b], [b, c], [c, a]]) {
      const id = [key(left), key(right)].sort().join("|");
      const edge = edges.get(id);
      if (edge) edge.count += 1;
      else edges.set(id, { left, right, count: 1 });
    }
  }
  for (const { left, right, count: edgeCount } of edges.values()) {
    if (edgeCount !== 1) continue;
    push(top(left), bottom(left), top(right), top(right), bottom(left), bottom(right));
  }
  footprint.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
