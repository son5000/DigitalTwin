import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createServer } from "vite";

let server;
let updateDetailedModelVisibility;
let loadSelectedDetail;
before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.vite-observation-detail-tests",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  });
  ({ updateDetailedModelVisibility, loadSelectedDetail } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/buildingObservation.js"));
});
after(async () => { await server?.close(); });

test("등록 모델 로딩 후 건축물 관측은 활성 카메라로 표시 방식을 계산한다", () => {
  const object = new THREE.Group();
  const fallback = new THREE.Mesh();
  const aligned = new THREE.Group();
  object.add(fallback, aligned);
  object.updateMatrixWorld(true);
  const entry = {
    data: { viewerPreset: { equipmentRepresentation: { globalMode: "AUTO", autoDetailDistance: 12, overrides: { EQ: "DISTANCE" } } } },
    detailedModels: [{ object, equipmentId: "EQ", fallback: [fallback], aligned }],
  };
  const runtime = { activeCamera: new THREE.PerspectiveCamera() };
  runtime.activeCamera.position.set(5, 2, 5);

  assert.doesNotThrow(() => updateDetailedModelVisibility(entry, { equipmentId: null }, runtime));
  assert.equal(aligned.visible, false);
  assert.equal(fallback.visible, true);
  updateDetailedModelVisibility(entry, { equipmentId: "EQ" }, runtime);
  assert.equal(aligned.visible, true);
  assert.equal(fallback.visible, false);

  runtime.activeCamera.position.set(50, 20, 50);
  updateDetailedModelVisibility(entry, { equipmentId: "EQ" }, runtime);
  assert.equal(aligned.visible, false);
  assert.equal(fallback.visible, true);
});

test("카메라가 아직 준비되지 않은 프레임은 건너뛰고 렌더 루프를 중단하지 않는다", () => {
  const entry = { data: {}, detailedModels: [] };
  assert.doesNotThrow(() => updateDetailedModelVisibility(entry, {}, {}));
});

test("건물 진입과 카메라 이동 중에는 스캔 요청을 시작하지 않는다", () => {
  const detail = { equipmentId: "EQ", fallback: [], attempted: false };
  const entry = { detailedModels: [detail] };
  loadSelectedDetail(entry, null, true);
  assert.equal(detail.attempted, false);
  loadSelectedDetail(entry, "EQ", false);
  assert.equal(detail.attempted, false);
});

test("선택 해제는 진행 중 파싱을 취소하고 GPU 메시와 원본 URL을 해제한다", () => {
  const controller = new AbortController();
  const aligned = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  aligned.add(mesh);
  const parent = new THREE.Group(); parent.add(aligned);
  let geometryDisposed = false;
  let revoked = false;
  mesh.geometry.addEventListener("dispose", () => { geometryDisposed = true; });
  aligned.userData.releaseAssetSources = () => { revoked = true; };
  const fallback = new THREE.Group(); fallback.visible = false;
  const detail = { equipmentId: "EQ", fallback: [fallback], attempted: true, aligned, controller };
  loadSelectedDetail({ detailedModels: [detail] }, null, true);
  assert.equal(controller.signal.aborted, true);
  assert.equal(geometryDisposed, true);
  assert.equal(revoked, true);
  assert.equal(parent.children.length, 0);
  assert.equal(fallback.visible, true);
});
