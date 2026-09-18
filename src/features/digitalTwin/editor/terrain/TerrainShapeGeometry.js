import * as THREE from "three";
import { clipPolygonByDistance, clipTerrainPolygon, clipExcavationPolygon } from "./TerrainFootprint";

export function getFootprintTriangles(regions = []) {
  return regions.flatMap((region) => {
    const outer = region.outer.map((p) => new THREE.Vector2(p.x, p.z));
    const holes = (region.holes ?? []).map((ring) => ring.map((p) => new THREE.Vector2(p.x, p.z)));
    const vertices = [...outer, ...holes.flat()];
    return THREE.ShapeUtils.triangulateShape(outer, holes).map((ids) => ids.map((id) => ({ x: vertices[id].x, z: vertices[id].y })));
  });
}

export function clipToFootprint(points, triangles) {
  if (!triangles.length) return [points];
  return triangles.flatMap((triangle) => {
    if (points.every((p) => p.x < Math.min(...triangle.map((v) => v.x))) || points.every((p) => p.x > Math.max(...triangle.map((v) => v.x)))
      || points.every((p) => p.z < Math.min(...triangle.map((v) => v.z))) || points.every((p) => p.z > Math.max(...triangle.map((v) => v.z)))) return [];
    const [a, b, c] = triangle;
    const sign = Math.sign((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    let result = points;
    for (let i = 0; i < 3; i += 1) {
      const start = triangle[i], end = triangle[(i + 1) % 3];
      result = clipPolygonByDistance(result, (p) => sign * ((end.x - start.x) * (p.z - start.z) - (end.z - start.z) * (p.x - start.x)));
    }
    return result.length >= 3 ? [result] : [];
  });
}

export function clipTerrainSurface(geometry, terrain, excavations = []) {
  if (terrain.shape !== "CIRCLE" && !terrain.removedAreas?.length && !terrain.footprintRegions?.length && !excavations.length) return geometry;
  const footprintTriangles = getFootprintTriangles(terrain.footprintRegions);
  const positions = [], colors = [], uvs = [];
  const source = geometry.attributes;
  for (let i = 0; i < geometry.index.count; i += 3) {
    const triangle = [0, 1, 2].map((offset) => {
      const index = geometry.index.getX(i + offset);
      return { x: source.position.getX(index), y: source.position.getY(index), z: source.position.getZ(index),
        r: source.color.getX(index), g: source.color.getY(index), b: source.color.getZ(index),
        u: source.uv.getX(index), v: source.uv.getY(index) };
    });
    for (const polygon of clipTerrainPolygon(triangle, terrain)
      .flatMap((part) => clipToFootprint(part, footprintTriangles))
      .flatMap((part) => clipExcavationPolygon(part, excavations))) {
      for (let j = 1; j < polygon.length - 1; j += 1) {
        const [a, b, c] = [polygon[0], polygon[j], polygon[j + 1]];
        if (Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) < 1e-10) continue;
        for (const p of [a, b, c]) { positions.push(p.x, p.y, p.z); colors.push(p.r, p.g, p.b); uvs.push(p.u, p.v); }
      }
    }
  }
  geometry.setIndex(null);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.clippedTerrain = true;
  return geometry;
}

export function createTerrainCutSkirt(surface, bottom) {
  const edges = new THREE.EdgesGeometry(surface, 180);
  const source = edges.attributes.position;
  const positions = [];
  for (let i = 0; i < source.count; i += 2) {
    const a = new THREE.Vector3().fromBufferAttribute(source, i), b = new THREE.Vector3().fromBufferAttribute(source, i + 1);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, a.x, bottom, a.z,
      b.x, b.y, b.z, b.x, bottom, b.z, a.x, bottom, a.z);
  }
  edges.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
