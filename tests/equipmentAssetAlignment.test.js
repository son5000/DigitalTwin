import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import * as THREE from "three";
import { createAlignmentTransform, normalizeAssetBinding } from "../src/features/digitalTwin/editor/model/equipmentDetailModel.js";

let server;
let applyAssetAlignment;
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  });
  ({ applyAssetAlignment } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/EquipmentAssetViewer.jsx"));
});
after(async () => { await server?.close(); });

function fixture() {
  const actualObject = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2000, 4000, 1000));
  mesh.position.set(600, 2000, -200);
  actualObject.add(mesh);
  const aligned = new THREE.Group(); aligned.add(actualObject);
  return { actualObject, aligned };
}
const equipment = { dimensions: { width: 2, height: 4, depth: 1 } };

test("업로드 메시 치수는 기준 도형과 독립적으로 적용되고 추가 배율 및 저장 복원을 유지한다", () => {
  const runtime = fixture();
  const binding = { equipmentId: "EQ", alignmentTransform: createAlignmentTransform({ fitDimension: "EXACT", targetDimensions: { width: 6, height: 3, depth: 2 } }) };
  applyAssetAlignment(runtime, binding, equipment);
  const measure = () => new THREE.Box3().setFromObject(runtime.aligned).getSize(new THREE.Vector3()).toArray();
  almostEqual(measure(), [6, 3, 2]);
  binding.alignmentTransform.targetDimensions.width = 12;
  applyAssetAlignment(runtime, binding, equipment);
  almostEqual(measure(), [12, 3, 2]);
  binding.alignmentTransform.scale = { x: 2, y: 2, z: 2 };
  applyAssetAlignment(runtime, binding, equipment);
  almostEqual(measure(), [24, 6, 4]);
  const restored = fixture();
  applyAssetAlignment(restored, normalizeAssetBinding(JSON.parse(JSON.stringify(binding))), equipment);
  almostEqual(new THREE.Box3().setFromObject(restored.aligned).getSize(new THREE.Vector3()).toArray(), [24, 6, 4]);
  assert.deepEqual(equipment.dimensions, { width: 2, height: 4, depth: 1 });
});

test("회전된 스캔도 선택한 실측 축 길이에 비율을 유지하며 맞춘다", () => {
  const runtime = fixture();
  const binding = { alignmentTransform: createAlignmentTransform({ rotation: { x: Math.PI / 2, y: 0, z: 0 }, fitDimension: "HEIGHT" }) };
  applyAssetAlignment(runtime, binding, equipment);
  const size = new THREE.Box3().setFromObject(runtime.aligned).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.y - 4) < 1e-8);
  assert.ok(Math.abs(size.x - 8) < 1e-8);
  const restored = normalizeAssetBinding({ ...binding, equipmentId: "EQ" });
  assert.equal(restored.alignmentTransform.fitDimension, "HEIGHT");
});
function matrix(object) { object.updateWorldMatrix(true, true); return object.matrixWorld.elements.slice(); }
function almostEqual(actual, expected) { actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-8, `${index}: ${value} != ${expected[index]}`)); }

test("위치·회전·크기 정합을 반복 적용해도 자동 중심/크기 보정이 수동 변환을 상쇄하지 않는다", () => {
  const runtime = fixture();
  const binding = { alignmentTransform: createAlignmentTransform({ position: { x: 3, y: 1, z: -2 }, rotation: { x: 0.2, y: 1, z: 0.1 }, scale: { x: 1.2, y: 0.8, z: 1.1 } }) };
  assert.equal(applyAssetAlignment(runtime, binding, equipment), true);
  const expected = matrix(runtime.actualObject);
  for (let index = 0; index < 5; index += 1) {
    applyAssetAlignment(runtime, binding, equipment);
    almostEqual(matrix(runtime.actualObject), expected);
  }
});

test("기즈모로 이동·회전한 상태를 저장하고 재적용해도 화면 위치가 되돌아가지 않는다", () => {
  const runtime = fixture();
  let binding = { id: "SCAN", equipmentId: "EQ", alignmentTransform: createAlignmentTransform() };
  applyAssetAlignment(runtime, binding, equipment);
  runtime.aligned.position.set(2, 3, -1);
  runtime.aligned.rotation.set(0.4, 0.6, -0.2);
  const expected = matrix(runtime.actualObject);
  binding = normalizeAssetBinding({ ...binding, alignmentTransform: { ...binding.alignmentTransform,
    position: { x: 2, y: 3, z: -1 }, rotation: { x: 0.4, y: 0.6, z: -0.2 },
  } });
  applyAssetAlignment(runtime, binding, equipment);
  almostEqual(matrix(runtime.actualObject), expected);
  const reloaded = fixture();
  applyAssetAlignment(reloaded, JSON.parse(JSON.stringify(binding)), equipment);
  almostEqual(matrix(reloaded.actualObject), expected);
});

test("부모 월드의 위치·회전·크기는 스캔의 자동 정렬 기준에 영향을 주지 않는다", () => {
  const local = fixture(); const nested = fixture();
  const parent = new THREE.Group(); parent.position.set(40, 6, -10); parent.rotation.y = 1.2; parent.scale.setScalar(2); parent.add(nested.aligned);
  parent.updateMatrixWorld(true);
  const binding = { alignmentTransform: createAlignmentTransform() };
  applyAssetAlignment(local, binding, equipment); applyAssetAlignment(nested, binding, equipment);
  almostEqual(nested.actualObject.position.toArray(), local.actualObject.position.toArray());
  almostEqual(nested.aligned.scale.toArray(), local.aligned.scale.toArray());
});
