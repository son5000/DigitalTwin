import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";
import { focusCameraOnBounds } from "../src/features/digitalTwin/editor/three/cameraFocus.js";

let server;
let createBuildingObservation;
let createEquipmentRenderObjects;
let equipmentTemplates;
let disposeObject3D;
let createWorldStructureObject;
let sceneTheme;
const originalDocument = globalThis.document;
before(async () => {
  server = await createServer({
    configFile: false, cacheDir: "node_modules/.vite-observation-tests", optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  });
  ({ createBuildingObservation } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/buildingObservation.js"));
  ({ createEquipmentRenderObjects } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/equipmentInstancing.js"));
  ({ UNIFIED_EQUIPMENT_TEMPLATE_MAP: equipmentTemplates } = await server.ssrLoadModule("/src/features/digitalTwin/editor/constants/unifiedEquipmentCatalog.js"));
  ({ disposeObject3D } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/disposeObject3D.js"));
  ({ createWorldStructureObject } = await server.ssrLoadModule("/src/features/digitalTwin/editor/world/WorldStructureFactory.js"));
  sceneTheme = (await server.ssrLoadModule("/src/features/digitalTwin/editor/constants/sceneThemes.js")).SCENE_THEMES.light;
  globalThis.document = { createElement: () => ({ setAttribute() {}, append() {}, addEventListener() {}, remove() {} }) };
});

test("건축물 격리는 진입·층 선택·다른 건물 전환 내내 유지되고 원래 숨김 상태를 복원한다", () => {
  const f = fixture();
  const other = f.shell.clone(); const hidden = f.shell.clone(); hidden.visible = false;
  const road = new THREE.Group(); const hiddenObject = new THREE.Group(); hiddenObject.visible = false;
  f.runtime.buildingObjects.set("other", other); f.runtime.buildingObjects.set("hidden", hidden);
  f.runtime.scene.add(other, hidden);
  f.runtime.siteEnvironmentObjects.set("road", road); f.runtime.siteEnvironmentObjects.set("hidden", hiddenObject);
  f.runtime.grid.visible = false;
  try {
    f.observation.sync(f.data, { ...f.settings, floorId: null });
    assert.equal(other.visible, false); assert.equal(road.visible, false); assert.equal(f.runtime.ground.visible, false);
    f.observation.sync(f.data, f.settings); f.settle();
    assert.equal(f.shell.visible, true); assert.equal(other.visible, false);
    other.visible = true; road.visible = true; f.settle();
    assert.equal(other.visible, false); assert.equal(road.visible, false);
    const next = { ...f.data, building: { ...f.data.building, id: "other" } };
    f.observation.sync(next, f.settings); f.settle();
    assert.equal(f.shell.visible, false); assert.equal(other.visible, true);
    assert.equal(f.runtime.scene.getObjectByName("BuildingObservation:building").visible, false);
    f.observation.sync(null, {}); f.settle();
    assert.equal(f.shell.visible, true); assert.equal(other.visible, true); assert.equal(hidden.visible, false);
    assert.equal(road.visible, true); assert.equal(hiddenObject.visible, false);
    assert.equal(f.runtime.ground.visible, true); assert.equal(f.runtime.grid.visible, false);
  } finally { f.observation.dispose(); }
});

test("관측 설비는 거리와 무관하게 원본을 유지하고 에디터의 기본 LOD와 인스턴싱은 유지한다", () => {
  const templates = Object.values(equipmentTemplates).filter((template) => template.lod);
  assert.ok(templates.length > 0);
  for (const template of templates.slice(0, 5)) {
    const equipment = { id: template.id, name: "", shapeTemplateId: template.id, dimensions: { width: 2, height: 1, depth: 1 }, parameters: {},
      position: { x: 2, y: 0, z: 3 }, rotation: { x: 0, y: 0.4, z: 0 }, appearance: { color: "#78563b", opacity: 0.8 }, visible: true };
    const entries = [{ equipment, baseY: 4 }];
    const [editor] = createEquipmentRenderObjects(entries, { theme: "light" });
    const [viewer] = createEquipmentRenderObjects(entries, { theme: "light", enableLod: false });
    const lods = []; editor.traverse((object) => { if (object.isLOD) lods.push(object); });
    assert.ok(lods.length > 0, template.id);
    viewer.traverse((object) => assert.ok(!object.isLOD, template.id));
    const camera = new THREE.PerspectiveCamera(); camera.position.set(2000, 2000, 2000); camera.updateMatrixWorld();
    lods.forEach((lod) => { lod.update(camera); assert.equal(lod.getCurrentLevel(), 1); });
    assert.deepEqual(viewer.position.toArray(), [2, 4, 3]); assert.equal(viewer.rotation.y, 0.4);
    disposeObject3D(editor); disposeObject3D(viewer);
    const batch = createEquipmentRenderObjects([0, 1, 2].map((i) => ({ equipment: { ...equipment, id: `${template.id}-${i}` }, baseY: 0 })), { theme: "light", enableLod: false });
    assert.equal(batch.length, 1); assert.equal(batch[0].userData.instancedEquipmentBatch, true);
    batch[0].traverse((object) => assert.ok(!object.isLOD));
    disposeObject3D(batch[0]);
  }
});

test("책상과 선반은 건축물 관측에서 박스 LOD 없이 렌더링되며 에디터 LOD는 유지된다", () => {
  for (const type of ["OFFICE_DESK", "STORAGE_SHELF"]) {
    const structure = { id: type, type, name: type, parameters: { width: 1.4, height: 0.8, depth: 0.7 }, position: { x: 1, y: 0, z: 2 }, rotation: { x: 0, y: 0, z: 0 }, appearance: { color: "#8D694B", opacity: 1 }, visible: true };
    const editor = createWorldStructureObject(structure, { selected: false, theme: "light", sceneTheme });
    assert.equal(editor.children[0].isLOD, true);
    disposeObject3D(editor);
    const f = fixture(); f.data.floors[0].plan.structures = [structure];
    try {
      f.observation.sync(f.data, f.settings); f.settle();
      const root = f.runtime.scene.getObjectByName("BuildingObservation:building");
      root.traverse((object) => assert.ok(!object.isLOD));
      const object = root.getObjectByName(type); let meshes = 0;
      object.traverse((child) => { if (child.isMesh) meshes += 1; });
      assert.ok(meshes > 1, type);
    } finally { f.observation.dispose(); }
  }
});
after(async () => {
  globalThis.document = originalDocument;
  await server?.close();
});

function fixture() {
  const shell = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 24), new THREE.MeshStandardMaterial({ color: "#718391" }));
  shell.position.set(12, 6, -8);
  shell.rotation.y = Math.PI / 5;
  const scene = new THREE.Scene();
  scene.add(shell);
  const runtime = {
    scene, activeCamera: new THREE.PerspectiveCamera(50, 1.8, 0.1, 5000),
    orbitControls: { target: new THREE.Vector3(), minDistance: 0.1, maxDistance: 3000 },
    container: { clientWidth: 1800, clientHeight: 1000 },
    buildingObjects: new Map([["building", shell]]), siteEnvironmentObjects: new Map(),
    ground: new THREE.Group(), grid: new THREE.Group(), gridRegionRoot: new THREE.Group(), siteConnectionRoot: new THREE.Group(),
  };
  runtime.activeCamera.position.set(100, 20, 100);
  const outer = [{ x: -20, z: -12 }, { x: 30, z: -12 }, { x: 30, z: 2 }, { x: 5, z: 2 }, { x: 5, z: 12 }, { x: -20, z: 12 }];
  const data = {
    building: { id: "building", parameters: { width: 40, depth: 24 } }, verticalStructures: [],
    floors: [1, 2, 3].map((level) => ({
      id: `floor-${level}`, name: `${level}층`, level, elevation: (level - 1) * 4,
      plan: { floorFootprint: { regions: [{ id: "boundary", outer }] } }, equipment: [], roomScenes: [],
    })),
  };
  const observation = createBuildingObservation(runtime, {
    labelRoot: { appendChild() {} }, labelClass: "floor", onSelectFloor() {}, getInsets: () => ({ left: 300, right: 350 }),
  });
  const settings = { theme: "light", floorId: "floor-2", gap: 7, opacity: 0, selectionVersion: 1 };
  const settle = () => {
    const time = performance.now() + 2000;
    for (let i = 0; i < 100; i++) observation.update(time + i * 16, 0.016);
    scene.updateMatrixWorld(true);
  };
  return { runtime, data, observation, settings, settle, shell };
}

test("층은 가까운 앞사선으로 돌출하며 외곽선과 함께 이동하고 이전 층의 X/Z 위치는 복원된다", () => {
  const f = fixture();
  try {
    f.observation.sync(f.data, f.settings); f.settle();
    const root = f.runtime.scene.getObjectByName("BuildingObservation:building");
    const selected = root.getObjectByName("2층");
    const slab = selected.children[0].children[0];
    const outline = selected.children.find((child) => child.userData.floorBoundary);
    assert.ok(selected.position.x > 0 && selected.position.x < 20);
    assert.ok(selected.position.z - 12 > 12);
    assert.ok(Math.hypot(selected.position.x, selected.position.z) < 40);
    assert.ok(Math.abs(selected.position.y - 11) < 1e-5);
    assert.ok(Math.abs(root.getObjectByName("3층").position.y - 22) < 1e-5);
    assert.equal(outline.parent, selected);
    assert.equal(outline.geometry.attributes.position.count, 7);
    assert.ok(slab.material.emissive.r > slab.material.emissive.b);
    assert.equal(outline.material.color.getHexString(), "ff7900");
    const baselineOutline = new THREE.Color(sceneTheme.wallEdge);
    assert.equal(f.shell.material.opacity, 0);
    assert.equal(f.shell.material.visible, false);
    assert.equal(root.children.filter((group) => group.children.some((child) => child.userData.floorBoundary)).length, 3);
    f.observation.sync(f.data, { ...f.settings, floorId: "floor-3" }); f.settle();
    assert.ok(Math.abs(selected.position.x) < 0.001);
    assert.ok(Math.abs(selected.position.z) < 0.001);
    assert.equal(slab.material.emissive.getHex(), 0);
    assert.ok(outline.material.color.equals(baselineOutline));
    assert.ok(root.getObjectByName("3층").position.z > 24);
    f.observation.sync(f.data, { ...f.settings, floorId: null, gap: 0, opacity: 0.1 }); f.settle();
    assert.ok(root.children.every((group) => Math.hypot(group.position.x, group.position.z) < 0.001));
    assert.ok(Math.abs(selected.position.y - 4) < 0.001);
    assert.ok(Math.abs(f.shell.material.opacity - 0.1) < 1e-8);
  } finally { f.observation.dispose(); }
});

test("동일 층 재클릭, 표시값 변경, 데이터 재생성은 카메라를 다시 맞추지 않는다", () => {
  const f = fixture();
  try {
    f.observation.sync(f.data, f.settings); f.settle();
    const focus = f.runtime.cameraFocus;
    const root = f.runtime.scene.getObjectByName("BuildingObservation:building");
    const slab = root.getObjectByName("2층").children[0].children[0];
    const bounds = new THREE.Box3().setFromObject(slab);
    assert.ok(focus.target.distanceTo(bounds.getCenter(new THREE.Vector3())) < 1e-5);
    const direction = focus.position.clone().sub(focus.target).normalize();
    assert.ok(direction.y > 0.5 && direction.y < 0.9);
    f.observation.sync(f.data, { ...f.settings, selectionVersion: 9, gap: 5, opacity: 0.2 });
    assert.equal(f.runtime.cameraFocus, focus);
    f.observation.sync(structuredClone(f.data), { ...f.settings, selectionVersion: 10 });
    assert.equal(f.runtime.cameraFocus, focus);
    f.observation.sync(f.data, { ...f.settings, floorId: "floor-1" });
    assert.notEqual(f.runtime.cameraFocus, focus);
  } finally { f.observation.dispose(); }
});

test("층별 월드를 유지하며 선택한 설비로 이동하고 표시값 갱신은 포커스를 재시작하지 않는다", () => {
  const f = fixture();
  const template = Object.values(equipmentTemplates).find((item) => item.lod);
  f.data.floors[1].equipment = [0, 1, 2].map((index) => ({ id: `target-${index}`, name: "", shapeTemplateId: template.id,
    dimensions: { width: 2, height: 1, depth: 1 }, position: { x: index * 5, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI / 2, z: 0 },
    appearance: { color: "#498daf", opacity: 1 }, parameters: {}, visible: true,
  }));
  const settings = { ...f.settings, equipmentId: "target-1" };
  try {
    f.observation.sync(f.data, settings); f.settle();
    const root = f.runtime.scene.getObjectByName("BuildingObservation:building");
    const floor = root.getObjectByName("2층");
    const target = f.runtime.cameraFocus;
    assert.equal(target.duration, 700);
    assert.equal(root.visible, true);
    assert.equal(root.children.length, 3);
    const localTarget = floor.worldToLocal(target.target.clone());
    assert.ok(Math.abs(localTarget.x - 5) < 2);
    assert.ok(Math.abs(localTarget.z) < 2);
    f.observation.sync(f.data, { ...settings, opacity: 0.2 }); f.settle();
    assert.equal(f.runtime.cameraFocus, target);
    f.observation.sync(f.data, { ...settings, equipmentId: "target-2", selectionVersion: 2 }); f.settle();
    assert.notEqual(f.runtime.cameraFocus, target);
    assert.equal(root.visible, true);
  } finally { f.observation.dispose(); }
});

test("관측 종료 시 외벽 원본 재질과 기본 뷰를 복원한다", () => {
  const f = fixture();
  const original = f.shell.material;
  try {
    f.observation.sync(f.data, f.settings); f.settle();
    assert.notEqual(f.shell.material, original);
    f.observation.sync(null, {}); f.settle();
    assert.equal(f.observation.isActive(), false);
    assert.equal(f.shell.material, original);
    assert.equal(original.opacity, 1);
    assert.equal(f.runtime.ground.visible, true);
  } finally { f.observation.dispose(); }
});

test("층 강조는 바닥·외곽선에만 적용하고 설비·내부 구조물의 재질과 텍스처를 복원한다", () => {
  for (const theme of ["light", "dark"]) {
    const f = fixture();
    const settings = { ...f.settings, theme };
    try {
      f.observation.sync(f.data, { ...settings, floorId: null });
      const root = f.runtime.scene.getObjectByName("BuildingObservation:building");
      const floor = root.getObjectByName("2층");
      const texture = new THREE.Texture();
      const material = new THREE.MeshStandardMaterial({ color: "#268ad3", map: texture, opacity: 0.65, transparent: true });
      const equipment = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [material, material.clone()]);
      equipment.position.y = 1;
      const original = equipment.material;
      floor.add(equipment); // Also covers material arrays used by registered 3D models.
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.2), new THREE.MeshStandardMaterial({ color: "#658c53" }));
      wall.position.y = 1;
      floor.add(wall);
      const wallMaterial = wall.material;
      const slab = floor.children[0].children[0];
      const boundary = floor.children.find((child) => child.userData.floorBoundary);
      const slabMaterial = slab.material;
      const boundaryMaterial = boundary.material;
      f.runtime.cameraFocus = null;
      f.observation.sync(f.data, settings); f.settle();
      for (const entry of equipment.material) {
        assert.equal(entry.color.getHex(), material.color.getHex());
        assert.equal(entry.emissive.getHex(), material.emissive.getHex());
        assert.equal(entry.opacity, 0.65);
        assert.equal(entry.map, texture);
        assert.equal(entry.depthWrite, material.depthWrite);
      }
      assert.equal(wall.material.color.getHex(), wallMaterial.color.getHex());
      assert.equal(wall.material.transparent, false);
      assert.equal(wall.material.opacity, 1);
      assert.equal(boundary.material.color.getHexString(), "ff7900");
      assert.ok(slab.material.emissiveIntensity < 0.05);
      slab.geometry.computeBoundingBox();
      assert.ok(Math.abs(slab.geometry.boundingBox.min.y + 0.16) < 1e-6);
      assert.ok(Math.abs(slab.geometry.boundingBox.max.y) < 1e-6);
      f.observation.sync(f.data, { ...settings, floorId: "floor-1" }); f.settle();
      assert.equal(slab.material.color.getHex(), slabMaterial.color.getHex());
      assert.equal(boundary.material.color.getHex(), boundaryMaterial.color.getHex());
      assert.equal(slab.material.opacity, 0.92);
      assert.equal(slab.material.depthWrite, false);
      assert.ok(Math.abs(equipment.material[0].opacity - 0.65 * 0.28) < 1e-6);
      assert.equal(equipment.material[0].color.getHex(), material.color.getHex());
      f.observation.sync(f.data, { ...settings, floorId: null, gap: 0 }); f.settle();
      assert.equal(equipment.material[0].opacity, 0.65);
      assert.equal(wall.material.transparent, false);
      f.observation.sync(null, {}); f.settle();
      assert.equal(equipment.material, original);
      assert.equal(wall.material, wallMaterial);
      assert.equal(slab.material, slabMaterial);
      assert.equal(boundary.material, boundaryMaterial);
      assert.equal(material.color.getHexString(), "268ad3");
    } finally { f.observation.dispose(); }
  }
});

test("두께가 있는 바닥판도 저장된 구멍을 막지 않는다", () => {
  const f = fixture();
  f.data.floors[1].plan.floorFootprint.regions[0].holes = [[
    { x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 },
  ]];
  try {
    f.observation.sync(f.data, f.settings); f.settle();
    const slab = f.runtime.scene.getObjectByName("BuildingObservation:building").getObjectByName("2층").children[0].children[0];
    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0).transformDirection(slab.matrixWorld);
    raycaster.set(slab.localToWorld(new THREE.Vector3(0, 2, 0)), down);
    assert.equal(raycaster.intersectObject(slab).length, 0);
    raycaster.set(slab.localToWorld(new THREE.Vector3(-5, 2, 0)), down);
    assert.ok(raycaster.intersectObject(slab).length > 0);
  } finally { f.observation.dispose(); }
});

test("지형이 저장된 층은 건물 진입·층 선택 시 고도와 구멍을 유지한다", () => {
  const f = fixture();
  const plan = f.data.floors[1].plan;
  plan.terrain = { width: 60, depth: 24, columns: 3, rows: 3,
    elevations: [0, 1, 2, 0, 1, 2, 0, 1, 2], color: "#547c36" };
  plan.floorFootprint.regions[0].holes = [[
    { x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 },
  ]];
  const savedPlan = structuredClone(plan);
  try {
    f.observation.sync(f.data, { ...f.settings, floorId: null, gap: 0, opacity: 0.1 }); f.settle();
    const root = f.runtime.scene.getObjectByName("BuildingObservation:building");
    const terrain = root.getObjectByName("편집 지형");
    assert.ok(terrain);
    assert.equal(terrain.geometry.type, "BufferGeometry");
    assert.equal(terrain.material.vertexColors, true);
    assert.equal(terrain.material.side, THREE.DoubleSide);
    assert.ok(terrain.children.some((child) => child.userData.terrainSkirt));
    const positions = Array.from(terrain.geometry.attributes.position.array);
    const colors = Array.from(terrain.geometry.attributes.color.array);
    const elevations = positions.filter((_, index) => index % 3 === 1);
    assert.ok(Math.max(...elevations) - Math.min(...elevations) > 0.5);
    for (const floorId of ["floor-2", "floor-1", null]) {
      f.observation.sync(f.data, { ...f.settings, floorId }); f.settle();
      const down = new THREE.Vector3(0, -1, 0).transformDirection(terrain.matrixWorld);
      const ray = (x) => new THREE.Raycaster(terrain.localToWorld(new THREE.Vector3(x, 5, 0)), down);
      assert.equal(ray(0).intersectObject(terrain, false).length, 0);
      assert.ok(ray(-5).intersectObject(terrain, false).length > 0);
      assert.deepEqual(Array.from(terrain.geometry.attributes.position.array), positions);
      assert.deepEqual(Array.from(terrain.geometry.attributes.color.array), colors);
    }
    f.observation.sync(null, {}); f.settle();
    assert.equal(f.observation.isActive(), false);
    assert.deepEqual(plan, savedPlan);
  } finally { f.observation.dispose(); }
});

test("회전·이동·줌과 층 전환 중 반투명 바닥의 깊이 설정이 유지되고 위·아래에서 모두 보인다", () => {
  const f = fixture();
  try {
    f.observation.sync(f.data, f.settings); f.settle();
    const root = f.runtime.scene.getObjectByName("BuildingObservation:building");
    const slabs = root.children.map((floor) => floor.children[0].children[0]);
    const materials = slabs.map((slab) => slab.material);
    for (const floorId of [null, "floor-1", "floor-3", null]) {
      for (const angle of [0, Math.PI / 2, Math.PI]) {
        f.shell.rotation.y = angle;
        f.shell.position.set(angle * 10, 6, -angle * 5);
        f.runtime.activeCamera.position.set(100, 20, 100).multiplyScalar(0.5 + angle);
        f.observation.sync(f.data, { ...f.settings, floorId }); f.settle();
        for (const [index, slab] of slabs.entries()) {
          assert.equal(slab.material, materials[index]);
          assert.equal(slab.material.transparent, true);
          assert.equal(slab.material.depthTest, true);
          assert.equal(slab.material.depthWrite, false);
          assert.equal(slab.renderOrder, f.shell.renderOrder);
          assert.equal(slab.material.polygonOffset, true);
          assert.equal(slab.material.side, THREE.FrontSide);
          // Front-side rendering must retain the bottom cap as well as the top:
          // orbiting below the building must not make the floor disappear.
          for (const sign of [-1, 1]) {
            const origin = slab.localToWorld(new THREE.Vector3(-5, sign * 2, 0));
            const direction = new THREE.Vector3(0, -sign, 0).transformDirection(slab.matrixWorld);
            assert.ok(new THREE.Raycaster(origin, direction).intersectObject(slab).length > 0);
          }
        }
      }
    }
  } finally { f.observation.dispose(); }
});

test("가까운 정면에서도 바닥의 보정된 깊이가 바닥 위 설비보다 앞으로 나오지 않는다", () => {
  const f = fixture();
  try {
    f.observation.sync(f.data, f.settings); f.settle();
    const slab = f.runtime.scene.getObjectByName("BuildingObservation:building").getObjectByName("2층").children[0].children[0];
    const camera = f.runtime.activeCamera;
    const { clientWidth: width, clientHeight: height } = f.runtime.container;
    const project = (point) => {
      const ndc = point.clone().project(camera);
      return new THREE.Vector3((ndc.x + 1) * width / 2, (ndc.y + 1) * height / 2, (ndc.z + 1) / 2);
    };
    for (const distance of [2, 4, 8]) for (const clearance of [0.001, 0.01, 0.1]) {
      const equipmentPoint = slab.localToWorld(new THREE.Vector3(0, clearance, 0));
      camera.position.copy(slab.localToWorld(new THREE.Vector3(0, 1.2, distance)));
      camera.lookAt(equipmentPoint); camera.updateMatrixWorld(true);
      const direction = equipmentPoint.clone().sub(camera.position).normalize();
      const hit = new THREE.Raycaster(camera.position, direction).intersectObject(slab)[0];
      assert.ok(hit);
      // Raster depth bias is factor * max depth slope + units * depth resolution.
      const [a, b, c] = [[-1, 0, -1], [1, 0, -1], [1, 0, 1]]
        .map((point) => project(slab.localToWorld(new THREE.Vector3(...point))));
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      const slope = Math.max(Math.abs(normal.x / normal.z), Math.abs(normal.y / normal.z));
      const biasedDepth = project(hit.point).z + slab.material.polygonOffsetFactor * slope
        + slab.material.polygonOffsetUnits / (2 ** 24 - 1);
      assert.ok(biasedDepth > project(equipmentPoint).z, `distance=${distance}, clearance=${clearance}`);
    }
  } finally { f.observation.dispose(); }
});

test("지붕은 관측 중 표시되며 외벽 불투명도와 연동되고 종료 시 원본 재질로 복원된다", () => {
  const f = fixture();
  const material = new THREE.MeshStandardMaterial({ color: "#854d30" });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 24), material);
  roof.userData.textureSurface = "ROOF";
  roof.position.y = 6.5;
  f.shell.add(roof);
  try {
    f.observation.sync(f.data, f.settings); f.settle();
    for (const opacity of [0.1, 0.5, 1, 0]) {
      f.observation.sync(f.data, { ...f.settings, floorId: null, gap: 0, opacity }); f.settle();
      assert.equal(roof.visible, true);
      assert.ok(Math.abs(roof.material.opacity - opacity) < 1e-8);
      assert.equal(roof.material.opacity, f.shell.material.opacity);
      assert.equal(roof.material.transparent, opacity < 1);
      assert.equal(roof.material.depthWrite, opacity === 1);
      assert.equal(material.opacity, 1);
    }
    f.observation.sync(null, {}); f.settle();
    assert.equal(roof.visible, true);
    assert.equal(roof.material, material);
  } finally { f.observation.dispose(); }
});

test("윗사선 카메라는 회전된 층의 모든 꼭짓점을 패널 밖 안전 영역에 맞춘다", () => {
  for (const [width, height] of [[1800, 1000], [900, 1200]]) {
    const f = fixture();
    try {
      const bounds = new THREE.Box3(new THREE.Vector3(20, 11, -35), new THREE.Vector3(100, 17, 35));
      f.runtime.container = { clientWidth: width, clientHeight: height };
      const camera = f.runtime.activeCamera;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      focusCameraOnBounds(f.runtime, bounds, { direction: [1, 1.25, 1], centerTarget: true, viewportInsets: { left: 200, right: 280 } });
      camera.position.copy(f.runtime.cameraFocus.position);
      camera.lookAt(f.runtime.cameraFocus.target);
      camera.updateMatrixWorld(true);
      for (const x of [20, 100]) for (const y of [11, 17]) for (const z of [-35, 35]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        assert.ok((point.x + 1) * width / 2 > 200 && (point.x + 1) * width / 2 < width - 280);
        assert.ok(Math.abs(point.y) < 1);
      }
    } finally { f.observation.dispose(); }
  }
});
