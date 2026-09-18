import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";

let server, underground, templates, catalog, factory, terrainModel, terrainFactory;
before(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-underground-placement-tests",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  [underground, templates, catalog, factory, terrainModel, terrainFactory] = await Promise.all([
    "model/undergroundModel", "constants/siteEnvironmentTemplates", "constants/objectLibraryCatalog",
    "world/SiteEnvironmentFactory", "terrain/TerrainModel", "terrain/TerrainMeshFactory",
  ].map((path) => server.ssrLoadModule(`/src/features/digitalTwin/editor/${path}.js`)));
});
after(async () => { await server?.close(); });

const options = { theme: "light", edgeColor: 0x334455, selectionColor: 0xff7900 };
function dispose(root) { root.traverse((child) => { child.geometry?.dispose(); child.material?.dispose(); }); }
function worldPoint(group, x, z) { return group.localToWorld(new THREE.Vector3(x, 0, z)); }
function hasSurface(mesh, x, z) {
  mesh.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh, false).length > 0;
}
function area(geometry) {
  const p = geometry.attributes.position;
  let result = 0;
  for (let i = 0; i < (geometry.index?.count ?? p.count); i += 3) {
    const [a, b, c] = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(p, geometry.index ? geometry.index.getX(i + offset) : i + offset));
    result += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
  }
  return result;
}

test("모든 지하 오브젝트의 모델·개구부는 초기 배치, 회전, 이동, 저장 복원 후 같은 중심·방향·길이를 쓴다", () => {
  const definitions = catalog.OBJECT_LIBRARY_DEFINITIONS.filter(underground.isUndergroundSiteObject);
  assert.ok(definitions.length >= 9);
  for (const definition of definitions) {
    let object = templates.createSiteObjectFromArea(definition.id, { center: { x: 2, z: 4 }, width: definition.width, depth: definition.depth });
    object.undergroundConnection = underground.createUndergroundConnection(object);
    for (const angle of [0, Math.PI / 4, Math.PI / 2, -Math.PI / 4, Math.PI]) {
      const changes = { position: { x: 9, y: 2, z: -8 }, rotation: { y: angle } };
      object = templates.normalizeSiteObject(JSON.parse(JSON.stringify({ ...object, ...changes,
        undergroundConnection: underground.updateUndergroundConnection(object, changes) })));
      const mesh = factory.createSiteEnvironmentObject(object, options);
      mesh.updateMatrixWorld(true);
      const [hole] = underground.collectTerrainExcavations([], [], [object]);
      assert.equal(hole.center.x, mesh.position.x, definition.id);
      assert.equal(hole.center.z, mesh.position.z, definition.id);
      assert.equal(hole.rotationY, mesh.rotation.y, definition.id);
      assert.equal(hole.depth, object.undergroundConnection.openingLength * mesh.scale.z, definition.id);
      for (const [x, z, inside] of [[0, 0, true], [0, object.dimensions.depth * 0.49, true], [object.dimensions.width * 0.51, 0, false]]) {
        const p = worldPoint(mesh, x, z);
        assert.equal(underground.isPointInsideExcavation(p.x, p.z, hole), inside, `${definition.id} / ${angle}`);
      }
      dispose(mesh);
    }
    // An oblique saved connection supplies another heading and may stretch the model.
    object.undergroundConnection.endPoint = { x: object.undergroundConnection.startPoint.x + 12, y: -8, z: object.undergroundConnection.startPoint.z - 12 };
    const mesh = factory.createSiteEnvironmentObject(object, options);
    const [hole] = underground.collectTerrainExcavations([], [], [object]);
    assert.equal(hole.rotationY, mesh.rotation.y);
    assert.equal(hole.depth, object.undergroundConnection.openingLength * mesh.scale.z);
    const p = worldPoint(mesh, 0, object.dimensions.depth * 0.49);
    assert.equal(underground.isPointInsideExcavation(p.x, p.z, hole), true);
    dispose(mesh);
  }
});

test("위치 변경은 연결점 XYZ와 ID를 보존하고 부분 높이 수정 및 연속 경계 보정을 합성한다", () => {
  const object = { position: { x: 3, y: 1, z: 5 }, undergroundConnection: {
    id: "connection", targetBuildingId: "building", targetFloorId: "b1",
    startPoint: { x: 3, y: 1, z: 5 }, endPoint: { x: 6, y: -3, z: -2 }, openingWidth: 4,
  } };
  const moved = underground.updateUndergroundConnection(object, { position: { x: 8, y: 4, z: 9 }, undergroundConnection: { endPoint: { y: -5 } } });
  assert.deepEqual(moved.startPoint, { x: 8, y: 4, z: 9 });
  assert.deepEqual(moved.endPoint, { x: 11, y: -5, z: 2 });
  assert.equal(moved.id, "connection");
  assert.equal(moved.targetFloorId, "b1");
  const clamped = underground.updateUndergroundConnection({ ...object, position: { x: 8, y: 4, z: 9 }, undergroundConnection: moved }, { position: { x: 7, y: 4, z: 6 } });
  assert.deepEqual(clamped.startPoint, { x: 7, y: 4, z: 6 });
  assert.deepEqual(clamped.endPoint, { x: 10, y: -5, z: -1 });
  assert.deepEqual(object.undergroundConnection.startPoint, { x: 3, y: 1, z: 5 });
});

test("회전한 지하층 건축물도 모델 방향과 같은 부지를 절개한다", () => {
  const building = { id: "building", position: { x: 4, z: -3 }, rotation: { y: Math.PI / 6 }, parameters: { width: 4, depth: 12 } };
  const [hole] = underground.collectTerrainExcavations([building], [{ parentId: "building", level: -1, elevation: -3.6 }]);
  const transform = new THREE.Group();
  transform.position.set(4, 0, -3);
  transform.rotation.y = building.rotation.y;
  for (const [x, z, expected] of [[0, 5.9, true], [2.5, 0, false]]) {
    const p = worldPoint(transform, x, z);
    assert.equal(underground.isPointInsideExcavation(p.x, p.z, hole), expected);
  }
});

test("거친 지형도 회전한 실제 개구부 경계로 잘리고 이동 후 이전 구멍·색칠·그리드를 복원한다", () => {
  const terrain = terrainModel.createFlatTerrainModel(40, 40, 10);
  terrain.cellColors = [{ minX: -20, maxX: 20, minZ: -20, maxZ: 20, color: "#445566" }];
  const environment = { width: 40, depth: 40, terrain };
  const hole = { id: "test", center: { x: -8, z: -8 }, width: 1.4, depth: 7, bottom: -3.6, rotationY: Math.PI / 4 };
  const mesh = terrainFactory.createTerrainMesh(environment, [], [hole]);
  assert.ok(Math.abs(area(mesh.geometry) - (1600 - 1.4 * 7)) < 0.001);
  assert.equal(hasSurface(mesh, -8, -8), false);
  let paint = mesh.children.find((child) => child.userData.terrainPaint);
  assert.equal(hasSurface(paint, -8, -8), false);
  const moved = { ...hole, center: { x: 8, z: 8 }, rotationY: -Math.PI / 4 };
  terrainFactory.updateTerrainMesh(mesh, environment, [], [moved]);
  assert.equal(hasSurface(mesh, -8, -8), true);
  assert.equal(hasSurface(mesh, 8, 8), false);
  paint = mesh.children.find((child) => child.userData.terrainPaint);
  assert.equal(hasSurface(paint, -8, -8), true);
  assert.equal(hasSurface(paint, 8, 8), false);
  for (const [x, z, expected] of [[0, 3.4, false], [0.8, 0, true]]) {
    const px = 8 + x * Math.cos(moved.rotationY) + z * Math.sin(moved.rotationY);
    const pz = 8 - x * Math.sin(moved.rotationY) + z * Math.cos(moved.rotationY);
    assert.equal(hasSurface(mesh, px, pz), expected);
  }
  const grid = terrainFactory.createTerrainGrid(environment, [], 1, { grid: 0, gridCenter: 0, edge: 0 }, [moved]);
  for (const line of grid.children.filter((child) => child.isLineSegments)) {
    const p = line.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 2) assert.equal(underground.isPointInsideExcavation((p.getX(i) + p.getX(i + 1)) / 2, (p.getZ(i) + p.getZ(i + 1)) / 2, moved, 1e-5), false);
  }
  terrainFactory.updateTerrainMesh(mesh, environment, [], []);
  assert.ok(Math.abs(area(mesh.geometry) - 1600) < 0.001);
  assert.equal(hasSurface(mesh, 8, 8), true);
  dispose(mesh); dispose(grid);
});
