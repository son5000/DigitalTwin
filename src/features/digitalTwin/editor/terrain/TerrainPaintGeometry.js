import * as THREE from "three";
import { isPointInsideExcavation } from "../model/undergroundModel";
import { getTerrainGradientRatio } from "./terrainCellColors";

function clipPolygon(points, axis, limit, keepGreater) {
  const result = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    const insideA = keepGreater ? a[axis] >= limit : a[axis] <= limit;
    const insideB = keepGreater ? b[axis] >= limit : b[axis] <= limit;
    if (insideA) result.push(a);
    if (insideA !== insideB) result.push(a.clone().lerp(b, (limit - a[axis]) / (b[axis] - a[axis])));
  }
  return result;
}

// Clip paint to the existing terrain triangles so cell edges stay crisp on slopes.
export function createTerrainPaintGeometry(surface, terrain, excavations = []) {
  const positions = [], colors = [];
  const source = surface.getAttribute("position");
  const stepX = terrain.width / (terrain.columns - 1), stepZ = terrain.depth / (terrain.rows - 1);
  for (const cell of terrain.cellColors ?? []) {
    const color = new THREE.Color(cell.color);
    const endColor = new THREE.Color(cell.gradient?.endColor ?? cell.color);
    const vertexColor = new THREE.Color();
    const triangles = [];
    if (surface.userData.clippedTerrain) {
      for (let i = 0; i < source.count; i += 3) {
        const ids = [i, i + 1, i + 2];
        if (ids.every((id) => source.getX(id) <= cell.minX) || ids.every((id) => source.getX(id) >= cell.maxX)
          || ids.every((id) => source.getZ(id) <= cell.minZ) || ids.every((id) => source.getZ(id) >= cell.maxZ)) continue;
        triangles.push(ids);
      }
    } else {
      const minColumn = Math.max(0, Math.floor((cell.minX + terrain.width / 2) / stepX));
      const maxColumn = Math.min(terrain.columns - 2, Math.ceil((cell.maxX + terrain.width / 2) / stepX) - 1);
      const minRow = Math.max(0, Math.floor((cell.minZ + terrain.depth / 2) / stepZ));
      const maxRow = Math.min(terrain.rows - 2, Math.ceil((cell.maxZ + terrain.depth / 2) / stepZ) - 1);
      for (let row = minRow; row <= maxRow; row += 1) for (let column = minColumn; column <= maxColumn; column += 1) {
        const x = -terrain.width / 2 + (column + 0.5) * stepX, z = -terrain.depth / 2 + (row + 0.5) * stepZ;
        if (excavations.some((excavation) => isPointInsideExcavation(x, z, excavation))) continue;
        const a = row * terrain.columns + column, b = a + 1, c = a + terrain.columns, d = c + 1;
        triangles.push([a, c, b], [b, c, d]);
      }
    }
    for (const indices of triangles) {
        let points = indices.map((index) => new THREE.Vector3().fromBufferAttribute(source, index));
        for (const [axis, limit, greater] of [["x", cell.minX, true], ["x", cell.maxX, false], ["z", cell.minZ, true], ["z", cell.maxZ, false]]) {
          points = clipPolygon(points, axis, limit, greater);
        }
        for (let i = 1; i < points.length - 1; i += 1) for (const point of [points[0], points[i], points[i + 1]]) {
          positions.push(point.x, point.y, point.z);
          vertexColor.copy(color).lerp(endColor, getTerrainGradientRatio(cell.gradient, point.x, point.z));
          colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
        }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function updateTerrainPaint(mesh, terrain, excavations = []) {
  let paint = mesh.children.find((child) => child.userData.terrainPaint);
  if (!terrain.cellColors?.length) {
    if (paint) { mesh.remove(paint); paint.geometry.dispose(); paint.material.dispose(); }
    return;
  }
  const geometry = createTerrainPaintGeometry(mesh.geometry, terrain, excavations);
  if (paint) { paint.geometry.dispose(); paint.geometry = geometry; return; }
  paint = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  paint.name = "부지 셀 색상";
  paint.userData.terrainPaint = true;
  mesh.add(paint);
}
