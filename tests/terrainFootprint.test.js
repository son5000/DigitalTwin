import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";

let server, model, editor, persistence, meshes, floorTerrain, spatial, spatialScene;
before(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-terrain-footprint-tests",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  [model, editor, persistence, meshes, floorTerrain, spatial, spatialScene] = await Promise.all([
    "terrain/TerrainModel", "terrain/TerrainEditor", "terrain/TerrainPersistence", "terrain/TerrainMeshFactory",
    "terrain/floorTerrain", "model/floorSpatialModel", "three/floorSpatialScene",
  ].map((path) => server.ssrLoadModule(`/src/features/digitalTwin/editor/${path}.js`)));
});
after(async () => { await server?.close(); });

function surfaceArea(geometry) {
  const p = geometry.attributes.position;
  let area = 0;
  for (let i = 0; i < (geometry.index?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((n) => geometry.index ? geometry.index.getX(i + n) : i + n);
    const [a, b, c] = ids.map((id) => new THREE.Vector3().fromBufferAttribute(p, id));
    area += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
  }
  return area;
}
function hits(mesh, x, z) {
  mesh.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh, false).length;
}
function dispose(root) {
  root.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
}

test("부지 삭제는 높이 해상도와 무관하게 선택 그리드만 실제로 제거하며 복원할 수 있다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 3);
  const point = { x: 0.2, z: 0.2 }, brush = { tool: "REMOVE_GROUND", cellSize: 1 };
  const removed = editor.applyTerrainArea(terrain, point, point, brush, 20, 20);
  assert.deepEqual(removed.removedAreas, [{ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }]);
  assert.deepEqual(removed.elevations, terrain.elevations);
  const mesh = meshes.createTerrainMesh({ width: 20, depth: 20, terrain: removed });
  assert.ok(Math.abs(surfaceArea(mesh.geometry) - 399) < 0.001);
  assert.equal(hits(mesh, 0.5, 0.5), 0);
  assert.ok(hits(mesh, 1.5, 0.5));
  const restored = editor.applyTerrainArea(removed, point, point, { ...brush, tool: "RESTORE_GROUND" }, 20, 20);
  meshes.updateTerrainMesh(mesh, { width: 20, depth: 20, terrain: restored });
  assert.ok(Math.abs(surfaceArea(mesh.geometry) - 400) < 0.001);
  assert.ok(hits(mesh, 0.5, 0.5));
  assert.deepEqual(terrain.removedAreas, []);
  dispose(mesh);
});

test("원형 부지는 실제 원형 경계로 잘리며 색칠 메시가 삭제한 부지를 덮지 않는다", () => {
  let terrain = { ...model.createFlatTerrainModel(20, 30, 3), shape: "CIRCLE", color: "#112233" };
  terrain = editor.applyTerrainArea(terrain, { x: -20, z: -20 }, { x: 20, z: 20 }, { tool: "PAINT", cellSize: 1, color: "#ff0000" }, 20, 30);
  terrain = editor.applyTerrainArea(terrain, { x: 0.2, z: 0.2 }, { x: 1.2, z: 1.2 }, { tool: "REMOVE_GROUND", cellSize: 1 }, 20, 30);
  const mesh = meshes.createTerrainMesh({ width: 20, depth: 30, terrain });
  const area = surfaceArea(mesh.geometry);
  assert.ok(Math.abs(area - (Math.PI * 100 - 4)) < 0.3);
  assert.equal(hits(mesh, 9, 9), 0);
  const paint = mesh.children.find((child) => child.userData.terrainPaint);
  assert.ok(Math.abs(surfaceArea(paint.geometry) - area) < 0.001);
  assert.equal(hits(paint, 0.5, 0.5), 0);
  dispose(mesh);
});

test("삭제 영역과 원형·색상·고도는 저장 복원과 해상도 변경 및 연속 드래그 후 유지된다", () => {
  const terrain = { ...model.createFlatTerrainModel(20, 20, 3), shape: "CIRCLE", color: "#123456" };
  const removed = editor.applyTerrainColorStroke(terrain, { x: -3.2, z: 0.2 }, { x: 3.2, z: 0.2 }, { tool: "REMOVE_GROUND", cellSize: 1 }, 20, 20);
  const saved = JSON.parse(JSON.stringify(persistence.serializeTerrain(removed, 20, 20)));
  const restored = persistence.restoreTerrain({ ...saved, resolution: 1 }, 20, 20);
  assert.deepEqual(restored.removedAreas, [{ minX: -4, maxX: 4, minZ: 0, maxZ: 1 }]);
  assert.equal(restored.shape, "CIRCLE");
  assert.equal(restored.color, "#123456");
  assert.ok(restored.elevations.every((height) => height === 0));
});

test("층 범위 적용은 층 ID와 건축물 소속을 지키고 대상의 구조물·실 정보를 보존한다", () => {
  const floors = [{ id: "f3", parentId: "a", level: 3 }, { id: "other", parentId: "b", level: 2 },
    { id: "f1", parentId: "a", level: 1 }, { id: "f2", parentId: "a", level: 2 }, { id: "f4", parentId: "a", level: 4 }];
  const source = spatial.normalizeFloorSpatialPlan({ floorId: "f1", structures: [] });
  source.terrain = { ...floorTerrain.getFloorTerrainEnvironment(source).terrain, shape: "CIRCLE", color: "#ff0000" };
  source.terrain.elevations.fill(2);
  const plans = { f1: source, f2: { structures: [{ id: "wall" }], rooms: [{ id: "room" }] }, other: { structures: [] }, f4: { structures: [] } };
  const snapshot = JSON.stringify(plans);
  const next = floorTerrain.applyFloorTerrainToRange(plans, floors, "f1", "f3", "f1", source);
  for (const id of ["f1", "f2", "f3"]) {
    assert.equal(next[id].terrain.shape, "CIRCLE");
    assert.equal(next[id].terrain.color, "#ff0000");
    assert.ok(next[id].terrain.elevations.every((height) => height === 2));
  }
  assert.equal(next.f2.structures, plans.f2.structures);
  assert.equal(next.f2.rooms, plans.f2.rooms);
  assert.equal(next.other, plans.other);
  assert.equal(next.f4, plans.f4);
  assert.notEqual(next.f2.floorFootprint.id, next.f3.floorFootprint.id);
  assert.notEqual(next.f2.terrain.elevations, next.f3.terrain.elevations);
  assert.equal(JSON.stringify(plans), snapshot);
  assert.equal(floorTerrain.applyFloorTerrainToRange(plans, floors, "f1", "other", "f3", source), plans);
});

test("작은 층의 사용자 부지 및 개구부도 2D·3D 공유 렌더러에서 보존된다", () => {
  const ring = (size) => [{ x: -size, z: -size }, { x: size, z: -size }, { x: size, z: size }, { x: -size, z: size }];
  const plan = { floorFootprint: { regions: [{ id: "floor", outer: ring(3), holes: [ring(1)] }] },
    terrain: { ...model.createFlatTerrainModel(6, 6, 1), color: "#123456" }, elevationZones: [] };
  const env = floorTerrain.getFloorTerrainEnvironment(plan);
  assert.equal(env.width, 6);
  const object = spatialScene.createFloorSpatialObject(plan);
  const mesh = object.userData.floorMeshes[0];
  assert.ok(Math.abs(surfaceArea(mesh.geometry) - 32) < 0.001);
  assert.equal(hits(mesh, 0, 0), 0);
  assert.ok(hits(mesh, 2, 2));
  assert.equal(mesh.userData.floorSurface, true);
  dispose(object);
});
