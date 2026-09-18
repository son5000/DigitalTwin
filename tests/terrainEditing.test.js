import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";

let server, model, editor, persistence, paint, meshFactory, catalog, templates, objectFactory, underground;
before(async () => {
  server = await createServer({ configFile: false, cacheDir: "node_modules/.vite-terrain-tests",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  const load = (path) => server.ssrLoadModule(`/src/features/digitalTwin/editor/${path}.js`);
  [model, editor, persistence, paint, meshFactory, catalog, templates, objectFactory, underground] = await Promise.all([
    load("terrain/TerrainModel"), load("terrain/TerrainEditor"), load("terrain/TerrainPersistence"),
    load("terrain/terrainCellColors"), load("terrain/TerrainMeshFactory"), load("constants/objectLibraryCatalog"),
    load("constants/siteEnvironmentTemplates"), load("world/SiteEnvironmentFactory"), load("model/undergroundModel"),
  ]);
});
after(async () => { await server?.close(); });
const area = (rect) => (rect.maxX - rect.minX) * (rect.maxZ - rect.minZ);

test("영역 경사로는 네 방향의 시작·끝 높이와 중간 높이를 정확히 만들고 외부를 보존한다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 1);
  const start = { x: -4, z: -4 }, end = { x: 4, z: 4 };
  for (const direction of ["POSITIVE_X", "NEGATIVE_X", "POSITIVE_Z", "NEGATIVE_Z"]) {
    const brush = { mode: "AREA", tool: "SLOPE", direction, startHeight: -2, endHeight: 6 };
    const profile = editor.getTerrainAreaProfile(terrain, start, end, brush);
    const result = editor.applyTerrainArea(terrain, start, end, brush, 20, 20);
    assert.equal(profile.gradePercent, 100);
    assert.equal(model.sampleBaseTerrainElevation(result, profile.startPoint.x, profile.startPoint.z), -2);
    assert.equal(model.sampleBaseTerrainElevation(result, profile.endPoint.x, profile.endPoint.z), 6);
    assert.equal(model.sampleBaseTerrainElevation(result, 0, 0), 2);
    assert.equal(model.sampleBaseTerrainElevation(result, 6, 6), 0);
    assert.deepEqual(result, editor.applyTerrainArea(terrain, end, start, brush, 20, 20));
  }
  assert.ok(terrain.elevations.every((height) => height === 0));
});

test("경사율 입력은 스냅된 수평 길이를 사용하고 내리막·평지를 지원한다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 2);
  const start = { x: -3.1, z: -3.1 }, end = { x: 3.1, z: 3.1 };
  for (const gradePercent of [-25, 0, 25]) {
    const brush = { mode: "AREA", tool: "SLOPE", direction: "NEGATIVE_Z", startHeight: 3, heightInput: "GRADE", gradePercent };
    const profile = editor.getTerrainAreaProfile(terrain, start, end, brush);
    assert.equal(profile.length, 8);
    assert.equal(profile.endHeight, 3 + 8 * gradePercent / 100);
    const result = editor.applyTerrainArea(terrain, start, end, brush, 20, 20);
    assert.equal(model.sampleBaseTerrainElevation(result, 0, -4), profile.endHeight);
  }
});

test("언덕은 경사면의 중앙을 올리고 끝 높이·측면·선택 외부를 유지하며 저장 후 복원된다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 1);
  const brush = { mode: "AREA", tool: "HILL", direction: "POSITIVE_Z", startHeight: 1, endHeight: 3, hillHeight: 4 };
  const result = editor.applyTerrainArea(terrain, { x: -4, z: -4 }, { x: 4, z: 4 }, brush, 20, 20);
  assert.equal(model.sampleBaseTerrainElevation(result, 0, -4), 1);
  assert.equal(model.sampleBaseTerrainElevation(result, 0, 4), 3);
  assert.equal(model.sampleBaseTerrainElevation(result, 0, 0), 6);
  assert.equal(model.sampleBaseTerrainElevation(result, 4, 0), 2);
  assert.equal(model.sampleBaseTerrainElevation(result, 6, 0), 0);
  const saved = persistence.serializeTerrain(result, 20, 20, "GRASS");
  const restored = persistence.restoreTerrain(JSON.parse(JSON.stringify(saved)), 20, 20, "GRASS");
  assert.equal(model.sampleBaseTerrainElevation(restored, 0, 0), 6);
  assert.equal(result.revision, terrain.revision + 1);
});

test("선택 최소 크기와 높이 범위를 검사해 잘못된 경사 형상을 적용하지 않는다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 2);
  const point = { x: 0, z: 0 };
  const brush = { mode: "AREA", tool: "SLOPE", startHeight: 0, heightInput: "GRADE", gradePercent: 10 };
  const profile = editor.getTerrainAreaProfile(terrain, point, point, brush);
  assert.equal(profile.length, 2);
  assert.equal(profile.endHeight, 0.2);
  const smallHill = { ...brush, tool: "HILL", hillHeight: 2 };
  assert.equal(editor.getTerrainAreaProfile(terrain, point, point, smallHill).hasHillInterior, true);
  const hill = editor.applyTerrainArea(terrain, point, point, smallHill, 20, 20);
  assert.equal(model.sampleBaseTerrainElevation(hill, 2, 2), 2.2);
  for (const changes of [{ startHeight: -81 }, { gradePercent: 10000 }, { tool: "HILL", hillHeight: 100 }]) {
    const invalid = { ...brush, ...changes };
    assert.equal(editor.getTerrainAreaProfile(terrain, point, point, invalid).valid, false);
    assert.deepEqual(editor.applyTerrainArea(terrain, point, point, invalid, 20, 20).elevations, terrain.elevations);
  }
});

test("기본 경사로와 언덕 브러시는 실제 고도를 바꾸며 내리막 경사율과 높이 제한을 지킨다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 1);
  const start = { x: -4, z: 0 }, end = { x: 4, z: 0 };
  const defaultSlope = editor.applyTerrainSlope(terrain, start, end, { ...editor.DEFAULT_TERRAIN_BRUSH, tool: "SLOPE" }, 20, 20);
  assert.equal(model.sampleBaseTerrainElevation(defaultSlope, 4, 0), 3);
  const downhill = editor.applyTerrainSlope(terrain, start, end, { tool: "SLOPE", startHeight: 2, heightInput: "GRADE", gradePercent: -50 }, 20, 20);
  assert.equal(model.sampleBaseTerrainElevation(downhill, -4, 0), 2);
  assert.equal(model.sampleBaseTerrainElevation(downhill, 4, 0), -2);
  const hill = editor.applyTerrainBrush(terrain, { x: 0, z: 0 }, { tool: "HILL", size: 8, hillHeight: 3, strength: 1 }, 20, 20);
  assert.equal(model.sampleBaseTerrainElevation(hill, 0, 0), 3);
  assert.ok(model.sampleBaseTerrainElevation(hill, 1, 0) > model.sampleBaseTerrainElevation(hill, 2, 0));
  assert.equal(model.sampleBaseTerrainElevation(hill, 5, 0), 0);
  assert.ok(terrain.elevations.every((height) => height === 0));
  const high = editor.applyTerrainBrush(terrain, { x: 0, z: 0 }, { tool: "HILL", hillHeight: 200, strength: 2 }, 20, 20);
  assert.equal(Math.max(...high.elevations), 80);
  const coarse = model.createFlatTerrainModel(20, 20, 5);
  const small = editor.applyTerrainBrush(coarse, { x: 2.5, z: 2.5 }, { tool: "HILL", size: 1 }, 20, 20);
  assert.ok(Math.max(...small.elevations) > 0);
});

test("담장은 굴곡·회전 지형의 양쪽 바닥에 밀착하고 추종/수평 상단 및 저장 복원을 지원한다", async () => {
  const { resolveVerticalPath } = await server.ssrLoadModule('/src/features/digitalTwin/editor/terrain/VerticalPathModel.js');
  const { createTerrainSurfaceSampler } = await server.ssrLoadModule('/src/features/digitalTwin/editor/terrain/TerrainSurfaceProjection.js');
  const terrain = model.createFlatTerrainModel(30, 30, 1);
  terrain.elevations = terrain.elevations.map((_, index) => {
    const point = model.getTerrainVertexPosition(terrain, index % terrain.columns, Math.floor(index / terrain.columns));
    return Math.max(-2, Math.min(3, -point.x * 0.5)) + Math.abs(point.z) * 0.15;
  });
  const surface = createTerrainSurfaceSampler(terrain);
  const base = templates.createSiteObjectFromArea('BOUNDARY_WALL', { center: { x: 1, z: 2 }, width: 12, depth: 0.5 });
  base.rotation.y = 0.4;
  base.path.width = 0.2;
  base.path.points = [{ x: -6, z: -2 }, { x: 0, z: -2 }, { x: 5, z: 2 }];
  base.position.y = 1;
  for (const wallHeightMode of ['FOLLOW_TERRAIN', 'LEVEL_TOP']) {
    const object = templates.normalizeSiteObject(JSON.parse(JSON.stringify({ ...base, parameters: { ...base.parameters, wallHeightMode } })));
    assert.equal(object.path.width, 0.2);
    assert.equal(object.parameters.wallHeightMode, wallHeightMode);
    const verticalPath = resolveVerticalPath(object, terrain, [], { terrainSurface: surface });
    const group = objectFactory.createSiteEnvironmentObject(object, { theme: 'light', edgeColor: 0x334455, selectionColor: 0xff7900, pathRenderContext: { verticalPath } });
    group.updateMatrixWorld(true);
    const mesh = group.children.find((child) => child.isMesh), positions = mesh.geometry.attributes.position;
    const topHeights = [], groundHeights = [];
    for (let i = 0; i < positions.count; i += 1) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(group.matrixWorld);
      const ground = surface.sample(p.x, p.z);
      if (Math.abs(p.y - (ground - 0.02)) < 1e-5) groundHeights.push(ground);
      else {
        topHeights.push(p.y);
        if (wallHeightMode === 'FOLLOW_TERRAIN') assert.ok(Math.abs(p.y - ground - 2) < 1e-5);
      }
      assert.equal(mesh.userData.siteObjectId, object.id);
    }
    assert.ok(groundHeights.length > 10 && topHeights.length > 10);
    assert.ok(Math.max(...groundHeights) - Math.min(...groundHeights) > 2);
    if (wallHeightMode === 'LEVEL_TOP') {
      assert.ok(Math.max(...topHeights) - Math.min(...topHeights) < 1e-5);
      assert.ok(Math.abs(topHeights[0] - Math.max(...groundHeights) - 2) < 1e-5);
    }
    group.traverse((child) => { child.geometry?.dispose(); child.material?.dispose(); });
  }
});

test("영역 올리기·낮추기·높이 지정은 선택 정점에만 한 번 적용하고 원본을 보존한다", () => {
  const original = model.createFlatTerrainModel(20, 20, 2);
  const start = { x: -1, z: -1 }, end = { x: 2.5, z: 2.5 };
  for (const [tool, expected] of [["RAISE", 2], ["LOWER", -2], ["SET_HEIGHT", -5]]) {
    const brush = { ...editor.DEFAULT_TERRAIN_BRUSH, mode: "AREA", tool, heightStep: 2, targetHeight: -5 };
    const bounds = editor.getTerrainEditBounds(original, start, end, brush);
    const result = editor.applyTerrainArea(original, start, end, brush, 20, 20);
    assert.deepEqual(result, editor.applyTerrainArea(original, end, start, brush, 20, 20));
    for (let row = 0; row < result.rows; row += 1) for (let column = 0; column < result.columns; column += 1) {
      const point = model.getTerrainVertexPosition(result, column, row);
      const inside = point.x >= bounds.minX && point.x <= bounds.maxX && point.z >= bounds.minZ && point.z <= bounds.maxZ;
      assert.equal(result.elevations[row * result.columns + column], inside ? expected : 0);
    }
    assert.equal(result.revision, 1);
  }
  assert.ok(original.elevations.every((height) => height === 0));
});

test("기존 브러시와 영역 평탄화·다듬기 및 높이 제한을 유지한다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 2);
  const point = { x: 0, z: 0 };
  const raised = editor.applyTerrainBrush(terrain, point, { tool: "RAISE", size: 6, strength: 1 }, 20, 20);
  assert.equal(model.sampleBaseTerrainElevation(raised, 0, 0), 1);
  const flat = editor.applyTerrainArea(raised, { x: -3, z: -3 }, { x: 3, z: 3 }, { tool: "FLATTEN", flattenHeight: 4 }, 20, 20);
  assert.equal(model.sampleBaseTerrainElevation(flat, 0, 0), 4);
  const smooth = editor.applyTerrainArea(raised, point, point, { tool: "SMOOTH" }, 20, 20);
  assert.ok(model.sampleBaseTerrainElevation(smooth, 0, 0) < 1);
  const limited = editor.applyTerrainArea(raised, point, point, { tool: "SET_HEIGHT", targetHeight: 300 }, 20, 20);
  assert.equal(model.sampleBaseTerrainElevation(limited, 0, 0), 80);
});

test("색칠·지우기는 현재 그리드 셀 경계에 맞추고 이웃 셀을 보존한다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 3);
  const brush = { tool: "PAINT", cellSize: 1, color: "#ff0000" };
  const full = editor.applyTerrainArea(terrain, { x: -2.1, z: -1.1 }, { x: 2.1, z: 1.1 }, brush, 20, 20);
  assert.deepEqual(full.cellColors, [{ minX: -3, maxX: 3, minZ: -2, maxZ: 2, color: "#ff0000" }]);
  const point = { x: 0.2, z: 0.2 };
  const erased = editor.applyTerrainArea(full, point, point, { ...brush, tool: "ERASE" }, 20, 20);
  assert.equal(erased.cellColors.reduce((sum, cell) => sum + area(cell), 0), 23);
  const blue = editor.applyTerrainArea(erased, point, point, { ...brush, color: "#0000ff" }, 20, 20);
  assert.equal(blue.cellColors.reduce((sum, cell) => sum + area(cell), 0), 24);
  assert.deepEqual(blue.elevations, terrain.elevations);
  assert.equal(full.cellColors.length, 1);
  assert.equal(area(full.cellColors[0]), 24);
});

test("빠른 드래그는 중간 셀을 빠뜨리지 않고 연속 셀을 하나의 영역으로 저장한다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 3);
  const result = editor.applyTerrainColorStroke(terrain, { x: -4.5, z: 0.2 }, { x: 4.5, z: 0.2 },
    { tool: "PAINT", color: "#445566", cellSize: 1 }, 20, 20);
  assert.deepEqual(result.cellColors, [{ minX: -5, maxX: 5, minZ: 0, maxZ: 1, color: "#445566" }]);
  assert.equal(terrain.cellColors.length, 0);
  const frozen = Object.freeze(result.cellColors.map((cell) => Object.freeze(cell)));
  assert.doesNotThrow(() => paint.paintTerrainCells(frozen, { minX: 8, maxX: 9, minZ: 8, maxZ: 9 }, null));
});

test("색상은 JSON 저장·복원 및 지형 해상도 변경 후에도 같은 위치에 남는다", () => {
  const terrain = editor.applyTerrainArea(model.createFlatTerrainModel(20, 20, 2), { x: 0.1, z: 0.1 }, { x: 1.1, z: 1.1 },
    { tool: "PAINT", color: "#123456", cellSize: 1 }, 20, 20);
  const stored = JSON.parse(JSON.stringify(persistence.serializeTerrain(terrain, 20, 20)));
  assert.deepEqual(persistence.restoreTerrain(stored, 20, 20).cellColors, terrain.cellColors);
  assert.deepEqual(model.normalizeTerrainModel({ ...stored, resolution: 1 }, 20, 20).cellColors, terrain.cellColors);
  assert.deepEqual(model.normalizeTerrainModel({}, 20, 20).cellColors, []);
});

test("색칠 영역은 경사진 지형에 밀착하고 단일 메시로 표시되며 지하 개구부를 막지 않는다", () => {
  const terrain = model.createFlatTerrainModel(20, 20, 2);
  terrain.elevations = terrain.elevations.map((_, index) => (index % terrain.columns) * 0.2);
  terrain.cellColors = [{ minX: -4, maxX: 4, minZ: -4, maxZ: 4, color: "#dd3300" }];
  const environment = { width: 20, depth: 20, terrain };
  const hole = { center: { x: 0, z: 0 }, width: 4, depth: 4, bottom: -3, rotationY: 0 };
  const mesh = meshFactory.createTerrainMesh(environment, [], [hole]);
  mesh.updateMatrixWorld(true);
  const layer = mesh.children.find((child) => child.userData.terrainPaint);
  assert.ok(layer?.isMesh);
  assert.equal(mesh.children.filter((child) => child.userData.terrainPaint).length, 1);
  const position = layer.geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    assert.ok(Math.abs(position.getY(i) - (position.getX(i) + 10) * 0.1) < 1e-5);
    assert.ok(position.getX(i) >= -4 && position.getX(i) <= 4 && position.getZ(i) >= -4 && position.getZ(i) <= 4);
  }
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(layer).length, 0);
  meshFactory.updateTerrainMesh(mesh, { ...environment, terrain: { ...terrain, cellColors: [] } }, [], [hole]);
  assert.equal(mesh.children.filter((child) => child.userData.terrainPaint).length, 0);
  mesh.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
});

test("범용 도형 10종은 배치·저장 복원·치수·회전·선택 ID를 유지한다", () => {
  const definitions = catalog.OBJECT_LIBRARY_DEFINITIONS.filter((item) => item.categoryId === "GENERIC_STRUCTURE");
  assert.equal(definitions.length, 10);
  for (const definition of definitions) {
    const object = templates.createSiteObjectFromArea(definition.id, { center: { x: 2, z: -3 }, width: 4, depth: 6 });
    object.dimensions.height = 5;
    object.rotation = { x: 0.2, y: 0.4, z: 0.1 };
    object.appearance.color = "#234567";
    const restored = templates.normalizeSiteObject(JSON.parse(JSON.stringify(object)));
    assert.deepEqual(restored.dimensions, object.dimensions);
    assert.deepEqual(restored.rotation, object.rotation);
    const group = objectFactory.createSiteEnvironmentObject(restored, { theme: "light", edgeColor: 0x334455, selectionColor: 0xff7900 });
    const mesh = group.children.find((child) => child.isMesh);
    const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x - 4) < 1e-5 && Math.abs(size.y - 5) < 1e-5 && Math.abs(size.z - 6) < 1e-5);
    assert.equal(mesh.userData.siteObjectId, object.id);
    assert.equal(mesh.material.color.getHexString(), "234567");
    group.traverse((child) => { child.geometry?.dispose(); child.material?.dispose(); });
  }
});

test("지하 관찰은 수평선 아래에서 점진적으로 지면을 숨기고 위로 돌아오면 복원한다", () => {
  assert.equal(underground.getUndergroundGroundOpacity(Math.PI / 3, 10, 0), 1);
  const middle = underground.getUndergroundGroundOpacity(Math.PI / 2 + Math.PI / 24, 1, 0);
  assert.ok(middle > 0 && middle < 1);
  assert.equal(underground.getUndergroundGroundOpacity(Math.PI * 0.75, -5, 0), 0);
  assert.equal(underground.getUndergroundGroundOpacity(Math.PI / 3, -3, 0), 0);
  assert.equal(underground.getUndergroundGroundOpacity(Math.PI / 3, 10, 0), 1);
});
