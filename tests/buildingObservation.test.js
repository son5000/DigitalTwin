import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";
import { focusCameraOnBounds } from "../src/features/digitalTwin/editor/three/cameraFocus.js";

let server;
let createBuildingObservation;
const originalDocument = globalThis.document;
before(async () => {
  server = await createServer({
    configFile: false, cacheDir: "node_modules/.vite-observation-tests", optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  });
  ({ createBuildingObservation } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/buildingObservation.js"));
  globalThis.document = { createElement: () => ({ setAttribute() {}, append() {}, addEventListener() {}, remove() {} }) };
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
    const baselineOutline = outline.material.color.clone();
    assert.equal(f.shell.material.opacity, 0);
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
