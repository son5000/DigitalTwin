import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { calibrationPayload } from "../src/features/digitalTwin/editor/model/monitoringContract.js";
import { applySensorView, flipSensorRotation } from "../src/features/digitalTwin/editor/three/sensorCamera.js";
import { createSensorMarker, SENSOR_FORWARD } from "../src/features/digitalTwin/editor/three/sensorPresentation.js";

import {
  ALIGNMENT_UNITS,
  CABINET_SAMPLE_ASSETS,
  EQUIPMENT_DISPLAY_MODES,
  createCabinetSampleBindings,
  normalizeEquipmentDetailSnapshot,
  normalizeSensorBinding,
  sensorCapabilityLabel,
  unitScale,
} from "../src/features/digitalTwin/editor/model/equipmentDetailModel.js";

test("센서 복수 기능과 방향을 저장·복원하고 서버 정합 요청에 전달한다", () => {
  const sensor = normalizeSensorBinding({ id: "B1", serverSensorId: "S1", serialNumber: "SERIAL1", equipmentIds: ["E1"],
    capabilities: ["ULTRASOUND", "THERMAL", "VISION", "GAUGE", "SWITCH", "THERMAL", "AUDIO"],
    position: { x: 1, y: 2, z: 3 }, rotation: { x: .2, y: -.7, z: .8 } });
  assert.deepEqual(sensor.capabilities, ["ULTRASONIC", "THERMAL", "VISION", "GAUGE", "SWITCH"]);
  assert.equal(sensorCapabilityLabel(sensor), "초음파 · 열화상 · 비전 카메라 · 게이지 감지 · 스위치 감지");
  const restored = normalizeSensorBinding(JSON.parse(JSON.stringify(sensor)));
  assert.deepEqual(restored, sensor);
  const payload = calibrationPayload("PROJECT", { id: "E1" }, restored);
  assert.deepEqual(payload.capabilities, sensor.capabilities);
  assert.deepEqual(payload.pose.rotation, [.2, -.7, .8]);
  assert.equal(payload.sensorId, "S1");
  assert.equal(payload.serialNumber, "SERIAL1");
  assert.equal(payload.coordinateSystem.sensorForward, "-Y");
  assert.deepEqual(normalizeSensorBinding({ sourceType: "CAMERA" }).capabilities, ["VISION"]);
  assert.deepEqual(normalizeSensorBinding({ deviceKind: "ULTRASONIC" }).capabilities, ["ULTRASONIC"]);
  assert.equal(normalizeSensorBinding({ ...sensor, capabilities: ["GAUGE", "SWITCH"] }).sensorType, "SENSOR");
  assert.deepEqual(normalizeSensorBinding({ ...sensor, capabilities: [] }).capabilities, []);
});

test("센서 정면 화살표와 센서 시점이 일치하고 뒤집기는 실제 반대 방향을 가리킨다", () => {
  const sensor = normalizeSensorBinding({ rotation: { x: .4, y: -.9, z: .6 } });
  const marker = createSensorMarker(sensor);
  marker.rotation.set(sensor.rotation.x, sensor.rotation.y, sensor.rotation.z);
  const front = new THREE.Vector3(...SENSOR_FORWARD).applyQuaternion(marker.quaternion);
  const camera = new THREE.PerspectiveCamera();
  applySensorView(camera, marker, sensor);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(front) < 1e-10);
  const arrow = marker.children.find((child) => child.userData.sensorDirection === "FRONT");
  assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.getWorldQuaternion(new THREE.Quaternion())).distanceTo(front) < 1e-10);
  const flipped = flipSensorRotation(sensor.rotation);
  const back = new THREE.Vector3(...SENSOR_FORWARD).applyEuler(new THREE.Euler(flipped.x, flipped.y, flipped.z));
  assert.ok(back.distanceTo(front.clone().negate()) < 1e-10);
  marker.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
});

test("센서 이동·회전·크기·선택 갱신과 제거는 기존 스캔 메시를 보존한다", async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } } });
  try {
    const { createSensorSceneLayer } = await server.ssrLoadModule("/src/features/digitalTwin/editor/three/sensorSceneLayer.js");
    const root = new THREE.Group(), equipment = new THREE.Group();
    const scan = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    equipment.add(scan); root.add(equipment);
    let disposed = false;
    scan.geometry.addEventListener("dispose", () => { disposed = true; });
    const entry = { object: equipment, actual: scan, loading: null };
    const layer = createSensorSceneLayer({ root, renderedEquipment: new Map([["E1", entry]]), origin: { x: 10, y: 0, z: 0 } });
    const mounted = normalizeSensorBinding({ id: "LOCAL", equipmentIds: ["E1"], mountMode: "EQUIPMENT", position: { x: 1, y: 2, z: 3 } });
    const world = normalizeSensorBinding({ id: "WORLD", equipmentIds: ["E1"], mountMode: "WORLD", position: { x: 12, y: 2, z: 0 } });
    for (let index = 0; index < 3; index++) {
      layer.update({ sensors: [{ ...mounted, position: { x: index, y: 2, z: 3 }, rotation: { x: .1 * index, y: 0, z: 0 }, markerDiameter: .05 + index * .01 }, world], selectedSensorId: index % 2 ? "WORLD" : "LOCAL" });
      assert.equal(layer.markers.size, 2);
      assert.equal(layer.markers.get("LOCAL").parent, equipment);
      assert.equal(layer.markers.get("LOCAL").position.x, index);
      assert.equal(layer.markers.get("LOCAL").rotation.x, .1 * index);
      assert.equal(layer.markers.get("LOCAL").geometry.parameters.radius, (.05 + index * .01) / 2);
      assert.equal(layer.markers.get("WORLD").position.x, 2);
      assert.equal(scan.parent, equipment);
      assert.equal(scan.visible, true);
      assert.equal(disposed, false);
    }
    entry.loading = Promise.resolve();
    layer.updateVisibility();
    assert.ok([...layer.markers.values()].every((marker) => !marker.visible));
    entry.loading = null;
    layer.updateVisibility();
    assert.ok([...layer.markers.values()].every((marker) => marker.visible));
    layer.updateVisibility("LOCAL");
    assert.equal(layer.markers.get("LOCAL").visible, false);
    assert.equal(layer.markers.get("WORLD").visible, true);
    entry.actual = null;
    entry.proxy = { visible: true };
    layer.updateVisibility();
    assert.ok([...layer.markers.values()].every((marker) => marker.visible));
    layer.dispose();
    assert.deepEqual(equipment.children, [scan]);
    assert.equal(disposed, false);
    scan.geometry.dispose(); scan.material.dispose();
  } finally { await server.close(); }
});

test("센서 표시 지름은 5cm가 기본이며 저장 복원과 위치·측정 범위가 독립적이다", () => {
  const original = normalizeSensorBinding({ id: "S", position: { x: 1, y: 2, z: 3 }, far: 12 });
  assert.equal(original.markerDiameter, 0.05);
  const restored = normalizeSensorBinding(JSON.parse(JSON.stringify({ ...original, markerDiameter: 0.08 })));
  assert.equal(restored.markerDiameter, 0.08);
  assert.deepEqual(restored.position, original.position);
  assert.equal(restored.far, 12);
  assert.equal(normalizeSensorBinding({ markerDiameter: -1 }).markerDiameter, 0.005);
  assert.equal(normalizeSensorBinding({ markerDiameter: NaN }).markerDiameter, 0.05);
});

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


test("외형 도형과 스캔 함께 표시 설정은 설치 구성 복원 시 유지된다", () => {
  const snapshot = { equipmentAssetBindings: [{ id: "B", equipmentId: "E", assetId: "A", assetType: "OBJ", includeProxy: true }] };
  const restored = normalizeEquipmentDetailSnapshot(JSON.parse(JSON.stringify(snapshot)));
  assert.equal(restored.equipmentAssetBindings[0].includeProxy, true);
  assert.equal(normalizeEquipmentDetailSnapshot({ equipmentAssetBindings: [{ assetType: "OBJ" }] }).equipmentAssetBindings[0].includeProxy, false);
});
