import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import * as THREE from "three";
import { createAlignmentTransform, normalizeAssetBinding, normalizeSensorBinding } from "../src/features/digitalTwin/editor/model/equipmentDetailModel.js";
import { getEnclosureScanSlot, getSensorMountPose, resizeEnclosureDoor } from "../src/features/digitalTwin/editor/model/equipmentEnclosure.js";
import { modelToScanSlot, resultPositionToModel, scanSlotForModelPosition, scanSlotToModel } from "../src/features/digitalTwin/editor/model/equipmentCoordinateFrame.js";
import { roiToReferencePayload } from "../src/features/digitalTwin/editor/model/roiMonitoring.js";
import { calibrationPayload, modelReference, validateCalibration } from "../src/features/digitalTwin/editor/model/monitoringContract.js";

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

test("문별 스캔은 mm 원본을 구획 안에 맞추고 해당 문 왼쪽 아래에 고정한다", () => {
  const cabinet = { id: "CABINET", dimensions: { width: 1.2, height: 2.4, depth: 1.2 },
    enclosure: { enabled: true, doorCount: 3, doorLayout: "STACKED", bodyLayout: "BACK_TO_BACK", rear: { doorCount: 1 } } };
  for (const side of ["FRONT", "REAR"]) {
    const runtime = fixture();
    const binding = normalizeAssetBinding({ equipmentId: cabinet.id, assetType: "OBJ", scanSlot: { side, index: 0 },
      alignmentTransform: { unit: "MM", originMode: "DOOR_CORNER", autoCentered: false, floorAligned: false, fitToProxy: true } });
    const slot = getEnclosureScanSlot(cabinet, 0, side);
    assert.equal(applyAssetAlignment(runtime, binding, cabinet), true);
    const bounds = new THREE.Box3().setFromObject(runtime.aligned);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x <= slot.dimensions.width + 1e-8);
    assert.ok(size.y <= slot.dimensions.height + 1e-8);
    assert.ok(size.z <= slot.dimensions.depth + 1e-8);
    assert.ok([[size.x, slot.dimensions.width], [size.y, slot.dimensions.height], [size.z, slot.dimensions.depth]]
      .some(([actual, limit]) => Math.abs(actual - limit) < 1e-8));
    assert.ok(Math.abs((side === "FRONT" ? bounds.min.x : bounds.max.x) - slot.origin.x) < 1e-8);
    assert.ok(Math.abs(bounds.min.y - slot.origin.y) < 1e-8);
    assert.ok(Math.abs((side === "FRONT" ? bounds.max.z : bounds.min.z) - slot.origin.z) < 1e-8);
  }
});

test("층별 내부 높이를 조정해도 다른 층 높이를 유지하고 각 기준점이 새 바닥을 따른다", () => {
  const cabinet = { id: "CABINET", dimensions: { width: 1.2, height: 2.4, depth: 1.2 },
    enclosure: { enabled: true, doorCount: 3, doorLayout: "STACKED", stackOrder: "BOTTOM_UP" } };
  const before = [0, 1, 2].map((index) => getEnclosureScanSlot(cabinet, index));
  const changes = resizeEnclosureDoor(cabinet, "FRONT", 1, .9);
  const changed = { ...cabinet, enclosure: { ...cabinet.enclosure, ...changes } };
  const after = [0, 1, 2].map((index) => getEnclosureScanSlot(changed, index));
  almostEqual(after.map((slot) => slot.dimensions.height), [before[0].dimensions.height, .9, before[2].dimensions.height]);
  assert.ok(after[2].origin.y > before[2].origin.y);
  assert.equal(after[0].origin.y, before[0].origin.y);
});

test("앞뒤 서랍의 원점·상대좌표는 왕복 변환되고 서버 모델에 문별 정합값이 포함된다", () => {
  const cabinet = { id: "CABINET", dimensions: { width: 1.2, height: 2.4, depth: 1.2 },
    enclosure: { enabled: true, doorCount: 3, doorLayout: "STACKED", bodyLayout: "BACK_TO_BACK", rear: { doorCount: 1 } } };
  for (const side of ["FRONT", "REAR"]) {
    const slot = getEnclosureScanSlot(cabinet, 0, side);
    const local = { x: .1, y: .1, z: -.1 };
    const model = scanSlotToModel(local, slot);
    almostEqual(Object.values(modelToScanSlot(model, slot)), Object.values(local));
    assert.equal(scanSlotForModelPosition(cabinet, model)?.id, slot.id);
    almostEqual(resultPositionToModel({ equipmentId: cabinet.id, coordinateSpace: "SCAN_SLOT", scanSlot: { side, index: 0 },
      position: Object.values(local) }, cabinet), Object.values(model));
  }
  const binding = normalizeAssetBinding({ id: "SCAN-2", equipmentId: cabinet.id, assetId: "A2", assetType: "PLY",
    scanSlot: { side: "FRONT", index: 1 }, alignmentTransform: { position: { x: .05, y: .02, z: -.03 } } });
  assert.equal(binding.alignmentTransform.originMode, "DOOR_CORNER");
  const reference = modelReference(cabinet, [binding]).scanAssets[0];
  assert.deepEqual(reference.scanSlot, { side: "FRONT", index: 1 });
  assert.deepEqual(reference.alignment.position, { x: .05, y: .02, z: -.03 });
  assert.equal(reference.slotFrame.id, "CABINET:FRONT:1");
});

test("서랍 안 센서의 실측 좌표는 배치·서버 보정·수신 히트맵에 같은 기준을 사용한다", () => {
  const cabinet = { id: "CABINET", dimensions: { width: 1.2, height: 2.4, depth: 1.2 },
    enclosure: { enabled: true, doorCount: 3, doorLayout: "STACKED", bodyLayout: "BACK_TO_BACK", rear: { doorCount: 1 } } };
  for (const side of ["FRONT", "REAR"]) {
    const slot = getEnclosureScanSlot(cabinet, 0, side);
    const local = { x: .12, y: .23, z: -.08 };
    const sensor = normalizeSensorBinding({ id: `S-${side}`, equipmentIds: [cabinet.id], serverSensorId: `SERVER-${side}`,
      serialNumber: `SERIAL-${side}`, mountMode: "EQUIPMENT", scanSlotMount: { equipmentId: cabinet.id, side, index: 0, position: local },
      position: { x: 0, y: 0, z: 0 } });
    assert.deepEqual(normalizeSensorBinding(JSON.parse(JSON.stringify(sensor))).scanSlotMount, sensor.scanSlotMount);
    const model = scanSlotToModel(local, slot);
    almostEqual(getSensorMountPose(sensor, cabinet).position.toArray(), Object.values(model));
    const payload = validateCalibration(calibrationPayload("PROJECT", cabinet, sensor));
    assert.equal(payload.schemaVersion, 3);
    assert.deepEqual(payload.scanSlotMount.position, Object.values(local));
    assert.equal(payload.scanSlotMount.slotFrame.id, `CABINET:${side}:0`);
    almostEqual(payload.pose.position, Object.values(model));
    almostEqual(resultPositionToModel({ equipmentId: cabinet.id, coordinateSpace: "SCAN_SLOT",
      scanSlot: { side, index: 0 }, position: Object.values(local) }, cabinet), Object.values(model));
    const outside = { ...sensor, scanSlotMount: { ...sensor.scanSlotMount, position: { ...local, x: slot.dimensions.width + .01 } } };
    assert.throws(() => validateCalibration(calibrationPayload("PROJECT", cabinet, outside)), /서랍/);
  }
});

test("서랍 안 일반 관측 영역만 서랍 상대좌표를 전달하고 비전 영역은 기존 이미지 좌표를 유지한다", () => {
  const cabinet = { id: "CABINET", dimensions: { width: 1.2, height: 2.4, depth: 1.2 },
    enclosure: { enabled: true, doorCount: 3, doorLayout: "STACKED" } };
  const slot = getEnclosureScanSlot(cabinet, 1);
  const center = scanSlotToModel({ x: .1, y: .1, z: -.1 }, slot);
  const surface = { type: "SPHERE", coordinateSpace: "EQUIPMENT_LOCAL", center: Object.values(center), radius: .02 };
  const general = roiToReferencePayload({ equipmentId: cabinet.id, surface }, cabinet);
  assert.deepEqual(general.scanSlot, { side: "FRONT", index: 1 });
  almostEqual(general.slotSurface.center, [.1, .1, -.1]);
  assert.deepEqual(general.surface, surface);
  const vision = roiToReferencePayload({ equipmentId: cabinet.id, surface, imageBinding: { sensorId: "VISION" } }, cabinet);
  assert.equal(vision.scanSlot, undefined);
  assert.deepEqual(vision.surface, surface);
});
