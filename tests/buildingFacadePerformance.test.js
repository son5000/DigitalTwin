import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";

let server;
let createBuildingObject;
let disposeObject3D;
let getBuildingFacadeOpenings;
const visual = { theme: "light", edgeColor: 0x607987, apronColor: 0xcbd5da, selectionColor: 0xff7900 };
const building = {
  id: "tower", name: "20층 건물",
  parameters: { width: 32, depth: 24, floorHeight: 3.6, roofType: "FLAT", stairCount: 0 },
  appearance: { color: "#afb6b9" },
  facadeOpenings: { doors: { enabled: false }, windows: { count: 10 } },
};
const floors = (count) => Array.from({ length: count }, (_, i) => ({
  id: `floor-${i + 1}`, parentId: building.id, level: i + 1, elevation: i * 3.6,
}));
const renderObjects = (root) => {
  const result = [];
  root.traverse((object) => { if (object.isMesh || object.isLine) result.push(object); });
  return result;
};

before(async () => {
  server = await createServer({
    configFile: false, cacheDir: "node_modules/.vite-facade-tests",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  });
  ({ createBuildingObject } = await server.ssrLoadModule("/src/features/digitalTwin/editor/world/BuildingFactory.js"));
  ({ disposeObject3D } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/disposeObject3D.js"));
  ({ getBuildingFacadeOpenings } = await server.ssrLoadModule("/src/features/digitalTwin/editor/model/buildingOpenings.js"));
});
after(async () => { await server?.close(); });

test("20층 창호는 부재 수가 늘어도 렌더 객체 수가 증가하지 않는다", () => {
  const low = createBuildingObject(building, floors(2), visual);
  const high = createBuildingObject(building, floors(20), visual);
  try {
    assert.equal(renderObjects(high).length, renderObjects(low).length);
    assert.ok(renderObjects(high).length < 20);
    const panes = renderObjects(high).filter((mesh) => mesh.isInstancedMesh && mesh.material.opacity === 0.72);
    const openings = getBuildingFacadeOpenings(building, 20).openings;
    assert.equal(panes.reduce((sum, mesh) => sum + mesh.count, 0), openings.length);
    assert.ok(openings.length > 500);
    assert.ok(panes.every((mesh) => mesh.geometry.getAttribute("uv") && mesh.userData.buildingId === building.id));
    const bounds = new THREE.Box3().setFromObject(high);
    assert.ok(Math.abs(bounds.max.y - 72.24) < 0.001);
    assert.ok(Math.abs(bounds.min.x + 17) < 0.001);
  } finally { disposeObject3D(low); disposeObject3D(high); }
});

test("인스턴싱된 창문은 선택 가능하고 외벽 개구부와 유리 재질을 유지한다", () => {
  const group = createBuildingObject(building, floors(20), visual);
  try {
    group.position.set(10, 0, -5);
    group.updateMatrixWorld(true);
    const opening = getBuildingFacadeOpenings(building, 20).openings.find((item) => item.facade === "FRONT" && item.floor === 10);
    const origin = new THREE.Vector3(opening.center + 10, opening.bottom + opening.height / 2, 24 / 2 - 5 + 0.5);
    const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1), 0, 1);
    const hit = ray.intersectObject(group, true)[0];
    assert.equal(hit.object.userData.buildingId, building.id);
    assert.equal(hit.object.userData.facadeOpeningKind, "WINDOW");
    assert.equal(hit.object.material.opacity, 0.72);
    assert.ok(Number.isInteger(hit.instanceId));
    const wall = group.children.find((object) => object.isInstancedMesh && object.userData.textureSurface === "EXTERIOR");
    assert.equal(ray.intersectObject(wall).length, 0);
  } finally { disposeObject3D(group); }
});

test("선택 재질과 GPU 인스턴스 버퍼는 다른 건물에 영향을 주지 않고 해제된다", () => {
  const normal = createBuildingObject(building, floors(20), visual);
  const transparent = createBuildingObject(building, floors(20), { ...visual, viewerTranslucent: true });
  let disposed = 0;
  const instances = renderObjects(transparent).filter((mesh) => mesh.isInstancedMesh);
  instances.forEach((mesh) => mesh.addEventListener("dispose", () => { disposed += 1; }));
  const pane = (root) => renderObjects(root).find((mesh) => mesh.isInstancedMesh && mesh.userData.facadeOpeningKind === "WINDOW" && mesh.material.opacity < 0.8);
  assert.equal(pane(normal).material.opacity, 0.72);
  assert.ok(pane(transparent).material.opacity <= 0.32);
  disposeObject3D(transparent);
  assert.equal(disposed, instances.length);
  assert.equal(pane(normal).material.opacity, 0.72);
  disposeObject3D(normal);
});
