import { normalizeTerrainCellColors, paintTerrainCells } from "./terrainCellColors";
import { getExcavationLocalPoint } from "../model/undergroundModel";

export function clipExcavationPolygon(points, excavations = []) {
  let polygons = [points];
  for (const excavation of excavations) {
    const halfWidth = excavation.width / 2, halfDepth = excavation.depth / 2;
    const local = (p) => getExcavationLocalPoint(p.x, p.z, excavation);
    const planes = [(p) => local(p).x + halfWidth, (p) => halfWidth - local(p).x,
      (p) => local(p).z + halfDepth, (p) => halfDepth - local(p).z];
    polygons = polygons.flatMap((polygon) => {
      if (planes.some((distance) => polygon.every((p) => distance(p) <= 0))) return [polygon];
      const outside = [];
      let inside = polygon;
      for (const distance of planes) {
        outside.push(clipPolygonByDistance(inside, (p) => -distance(p)));
        inside = clipPolygonByDistance(inside, distance);
      }
      return outside.filter((part) => part.length >= 3);
    });
  }
  return polygons;
}

export function normalizeRemovedAreas(areas, width, depth) {
  return normalizeTerrainCellColors((Array.isArray(areas) ? areas : []).map((area) => ({ ...area, color: "#000000" })), width, depth)
    .map(({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ }));
}

export function editTerrainFootprint(terrain, bounds, restore = false) {
  const cells = paintTerrainCells((terrain.removedAreas ?? []).map((area) => ({ ...area, color: "#000000" })), bounds, restore ? null : "#000000");
  return { ...terrain, removedAreas: normalizeRemovedAreas(cells, terrain.width, terrain.depth), revision: terrain.revision + 1 };
}

// Half-plane clipping also interpolates elevation and vertex colors at cut edges.
export function clipPolygonByDistance(points, distance) {
  const result = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = distance(a), db = distance(b);
    if (da >= -1e-9) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      result.push(Object.fromEntries(Object.keys(a).map((key) => [key, a[key] + (b[key] - a[key]) * t])));
    }
  }
  return result;
}

export function clipTerrainPolygon(points, terrain) {
  let polygons = [points];
  if (terrain.shape === "CIRCLE") {
    const radius = Math.min(terrain.width, terrain.depth) / 2;
    const inradius = radius * Math.cos(Math.PI / 96);
    const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
    const minZ = Math.min(...points.map((p) => p.z)), maxZ = Math.max(...points.map((p) => p.z));
    if (Math.hypot(Math.max(minX, Math.min(0, maxX)), Math.max(minZ, Math.min(0, maxZ))) > radius) return [];
    const fullyInside = points.every((p) => Math.hypot(p.x, p.z) <= inradius);
    for (let i = 0; !fullyInside && i < 96 && polygons[0]?.length; i += 1) {
      const angle = (i + 0.5) * Math.PI * 2 / 96;
      polygons = [clipPolygonByDistance(polygons[0], (p) => radius * Math.cos(Math.PI / 96) - p.x * Math.cos(angle) - p.z * Math.sin(angle))];
    }
  }
  for (const area of terrain.removedAreas ?? []) {
    polygons = polygons.flatMap((polygon) => {
      if (polygon.every((p) => p.x <= area.minX) || polygon.every((p) => p.x >= area.maxX)
        || polygon.every((p) => p.z <= area.minZ) || polygon.every((p) => p.z >= area.maxZ)) return [polygon];
      const outside = [];
      let inside = polygon;
      for (const distance of [(p) => p.x - area.minX, (p) => area.maxX - p.x, (p) => p.z - area.minZ, (p) => area.maxZ - p.z]) {
        outside.push(clipPolygonByDistance(inside, (p) => -distance(p)));
        inside = clipPolygonByDistance(inside, distance);
      }
      return outside.filter((part) => part.length >= 3);
    });
  }
  return polygons.filter((polygon) => polygon.length >= 3);
}
