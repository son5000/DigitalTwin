import assert from "node:assert/strict";
import test from "node:test";

import {
  ALIGNMENT_UNITS,
  CABINET_SAMPLE_ASSETS,
  EQUIPMENT_DISPLAY_MODES,
  createCabinetSampleBindings,
  normalizeEquipmentDetailSnapshot,
  unitScale,
} from "../src/features/digitalTwin/editor/model/equipmentDetailModel.js";

test("캐비닛 샘플은 실제 public 파일 이름과 용도를 분리한다", () => {
  assert.deepEqual(CABINET_SAMPLE_ASSETS.map((item) => item.sourceKey), [
    "/cabinet_3d_sample/Scan.obj",
    "/cabinet_3d_sample/Scan.ply",
    "/cabinet_3d_sample/Scan.jpg",
    "/cabinet_3d_sample/Scan.jpg",
  ]);
  const bindings = createCabinetSampleBindings("EQ_1");
  assert.ok(bindings.every((item) => item.equipmentId === "EQ_1"));
  assert.equal(bindings[0].relatedSourceKey, "/cabinet_3d_sample/Scan.mtl");
  assert.equal(bindings[0].displayMode, EQUIPMENT_DISPLAY_MODES.PROXY);
});

test("기존 관측 장치와 바인딩을 센서·서버 엔티티로 마이그레이션한다", () => {
  const result = normalizeEquipmentDetailSnapshot({
    monitoringDevices: [{ id: "DEVICE_1", equipmentId: "EQ_1", sourceType: "CAMERA", identifier: "CAM-01", fov: 61, range: 14 }],
    monitoringBindings: [{ id: "BINDING_1", equipmentId: "EQ_1", sourceDeviceId: "DEVICE_1" }],
    observationPoints: [{ id: "POINT_1", equipmentId: "EQ_1", localPosition: { x: 1, y: 2, z: 3 } }],
  });
  assert.deepEqual(result.sensorBindings[0].equipmentIds, ["EQ_1"]);
  assert.equal(result.sensorBindings[0].serverKey, "CAM-01");
  assert.equal(result.sensorBindings[0].fieldOfView, 61);
  assert.equal(result.sensorBindings[0].far, 14);
  assert.equal(result.serverBindings[0].id, "BINDING_1");
  assert.deepEqual(result.observationPoints[0].targetNormal, { x: 0, y: 0, z: 1 });
});

test("원본 단위는 별도 정합 스케일로 변환한다", () => {
  assert.equal(unitScale(ALIGNMENT_UNITS.MM), 0.001);
  assert.equal(unitScale(ALIGNMENT_UNITS.CM), 0.01);
  assert.equal(unitScale(ALIGNMENT_UNITS.M), 1);
});
