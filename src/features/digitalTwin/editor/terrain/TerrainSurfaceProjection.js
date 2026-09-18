import * as THREE from "three";
import { sampleTerrainElevation } from "./TerrainModel";
import { clipPolygonByDistance } from "./TerrainFootprint";

// Sample the same triangles as TerrainMeshFactory, including terrain features.
export function createTerrainSurfaceSampler(terrain, features = []) {
  const stepX = terrain.width / (terrain.columns - 1), stepZ = terrain.depth / (terrain.rows - 1);
  const vertices = [];
  let hash = 2166136261;
  for (let row = 0; row < terrain.rows; row += 1) for (let column = 0; column < terrain.columns; column += 1) {
    const x = column * stepX - terrain.width / 2, z = row * stepZ - terrain.depth / 2;
    const y = sampleTerrainElevation(terrain, x, z, features);
    vertices.push({ x, y, z });
    for (const character of String(y)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  const cell = (column, row) => {
    const a = vertices[row * terrain.columns + column], b = vertices[row * terrain.columns + column + 1];
    const c = vertices[(row + 1) * terrain.columns + column], d = vertices[(row + 1) * terrain.columns + column + 1];
    return [a, b, c, d];
  };
  return {
    signature: `${terrain.width}:${terrain.depth}:${terrain.columns}:${terrain.rows}:${hash >>> 0}`,
    sample(x, z) {
      const cx = Math.max(0, Math.min(terrain.columns - 1, (x + terrain.width / 2) / stepX));
      const rz = Math.max(0, Math.min(terrain.rows - 1, (z + terrain.depth / 2) / stepZ));
      const column = Math.min(terrain.columns - 2, Math.floor(cx)), row = Math.min(terrain.rows - 2, Math.floor(rz));
      const tx = cx - column, tz = rz - row;
      const [a, b, c, d] = cell(column, row);
      return tx + tz <= 1 ? a.y + (b.y - a.y) * tx + (c.y - a.y) * tz
        : d.y + (c.y - d.y) * (1 - tx) + (b.y - d.y) * (1 - tz);
    },
    triangles(bounds) {
      const result = [];
      const minColumn = Math.max(0, Math.floor((bounds.minX + terrain.width / 2) / stepX));
      const maxColumn = Math.min(terrain.columns - 2, Math.floor((bounds.maxX + terrain.width / 2) / stepX));
      const minRow = Math.max(0, Math.floor((bounds.minZ + terrain.depth / 2) / stepZ));
      const maxRow = Math.min(terrain.rows - 2, Math.floor((bounds.maxZ + terrain.depth / 2) / stepZ));
      for (let row = minRow; row <= maxRow; row += 1) for (let column = minColumn; column <= maxColumn; column += 1) {
        const [a, b, c, d] = cell(column, row);
        result.push([a, b, c], [b, d, c]);
      }
      return result;
    },
  };
}

// Split at terrain triangle boundaries, so wide paths and markings cannot cut
// through a hill between samples. Input Y is the offset above the terrain.
export function projectGeometryOnTerrain(geometry, { surface, position = {}, rotationY = 0, clearance = 0 }) {
  const source = geometry.getAttribute("position"), sourceUv = geometry.getAttribute("uv");
  const positions = [], uvs = [];
  const cosine = Math.cos(rotationY), sine = Math.sin(rotationY);
  const count = geometry.index?.count ?? source.count;
  for (let index = 0; index < count; index += 3) {
    const triangle = [0, 1, 2].map((offset) => {
      const id = geometry.index ? geometry.index.getX(index + offset) : index + offset;
      const x = source.getX(id), z = source.getZ(id);
      return { x: (position.x ?? 0) + x * cosine + z * sine, z: (position.z ?? 0) - x * sine + z * cosine,
        y: source.getY(id), u: sourceUv?.getX(id) ?? 0, v: sourceUv?.getY(id) ?? 0 };
    });
    const bounds = { minX: Math.min(...triangle.map((p) => p.x)), maxX: Math.max(...triangle.map((p) => p.x)),
      minZ: Math.min(...triangle.map((p) => p.z)), maxZ: Math.max(...triangle.map((p) => p.z)) };
    for (const terrainTriangle of surface.triangles(bounds)) {
      let polygon = triangle;
      for (let edge = 0; edge < 3; edge += 1) {
        const a = terrainTriangle[edge], b = terrainTriangle[(edge + 1) % 3];
        polygon = clipPolygonByDistance(polygon, (p) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
      }
      for (let i = 1; i < polygon.length - 1; i += 1) {
        const points = [polygon[0], polygon[i], polygon[i + 1]].map((p) => {
          const x = p.x - (position.x ?? 0), z = p.z - (position.z ?? 0);
          return { ...p, x: x * cosine - z * sine, z: x * sine + z * cosine,
            y: p.y + surface.sample(p.x, p.z) + clearance - (position.y ?? 0) };
        });
        const [a, b, c] = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-18) continue;
        for (const p of points) { positions.push(p.x, p.y, p.z); uvs.push(p.u, p.v); }
      }
    }
  }
  geometry.setIndex(null);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
