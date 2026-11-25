import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { normalizeSensorLookup, sensorLookupChanges, sensorLookupPath, sensorSerialChanges, sensorLookupErrorMessage } from "../src/features/digitalTwin/editor/model/sensorLookup.js";

const sensor = { id: "server-1", serialNumber: "CAM-001", equipmentId: "equipment-1" };
test("시리얼은 대소문자와 선행 0을 보존하며 쿼리를 안전하게 인코딩한다", () => {
  const path = sensorLookupPath(" 00a +/&? ", "설비 /1");
  const query = new URL(path, "https://test.invalid").searchParams;
  assert.equal(query.get("serialNumber"), "00a +/&?");
  assert.equal(query.get("equipmentId"), "설비 /1");
  assert.throws(() => sensorLookupPath(" ", "equipment-1"));
  assert.throws(() => sensorLookupPath("123", ""));
});
test("FE01 직접 응답과 data 응답에서 센서 존재와 설비 소속만 검증한다", () => {
  assert.deepEqual(normalizeSensorLookup({ sensor }, "CAM-001", "equipment-1"), sensor);
  assert.equal(normalizeSensorLookup({ data: { sensor: { ...sensor, id: 42 } } }, "CAM-001", "equipment-1").id, "42");
  for (const change of [{ id: null }, { serialNumber: "other" }, { equipmentId: "other" }, { equipmentId: undefined }, { equipmentId: "" }, { equipmentId: false }])
    assert.throws(() => normalizeSensorLookup({ sensor: { ...sensor, ...change } }, "CAM-001", "equipment-1"));
  assert.equal(normalizeSensorLookup({ sensor: { ...sensor, equipmentId: null } }, "CAM-001", "equipment-1").equipmentId, null);
  assert.throws(() => normalizeSensorLookup({ sensor: { id: "server-1", serialNumber: "CAM-001" } }, "CAM-001", "equipment-1"), /연결 여부/);
});
test("확인된 센서 ID만 적용하고 수동 기능·배치·화각·ROI 참조를 보존한다", () => {
  const local = { id: "local-binding", name: "수동 이름", capabilities: ["ULTRASONIC"], fieldOfView: 50, aspectRatio: 1,
    position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 1, z: 0 }, observationPointIds: ["roi"],
    calibration: { revision: 4 }, calibrationConfirmed: true };
  const applied = { ...local, ...sensorLookupChanges(sensor, local, "equipment-1") };
  assert.equal(applied.id, local.id);
  assert.equal(applied.name, local.name);
  assert.deepEqual(applied.position, local.position);
  assert.deepEqual(applied.rotation, local.rotation);
  assert.deepEqual(applied.observationPointIds, ["roi"]);
  assert.deepEqual(applied.capabilities, ["ULTRASONIC"]);
  assert.equal(applied.aspectRatio, 1);
  assert.equal(applied.fieldOfView, 50);
  assert.equal(applied.connectionStatus, undefined);
  assert.equal(applied.calibration, null);
  assert.equal(applied.calibrationConfirmed, false);
  assert.equal(applied.serverSensorId, sensor.id);
});
test("구형 상세 응답의 영상·측정값·사양을 에디터로 가져오지 않는다", () => {
  const result = normalizeSensorLookup({ sensor: { ...sensor, capabilities: ["VISION"], fieldOfView: 60, frameUrl: "https://test.invalid/live", connectionStatus: "ONLINE", latestValue: 90, resolution: { width: 1920, height: 1080 } } }, "CAM-001", "equipment-1");
  assert.deepEqual(result, sensor);
  const changes = sensorLookupChanges(result, {}, "equipment-1");
  for (const key of ["frameUrl", "frameMeasuredAt", "connectionStatus", "latestValue", "capabilities", "fieldOfView", "resolution"])
    assert.equal(Object.hasOwn(changes, key), false);
});
test("같은 센서를 다시 확인해도 기존 배치 보정 확인을 해제하지 않는다", () => {
  const local = { serverSensorId: sensor.id, serialNumber: sensor.serialNumber, calibrationConfirmed: true, calibration: { revision: 3 } };
  assert.deepEqual({ ...local, ...sensorLookupChanges(sensor, local, "equipment-1") }.calibration, local.calibration);
  assert.equal(sensorLookupChanges(sensor, local, "equipment-1").calibrationConfirmed, undefined);
});
test("시리얼 변경은 이전 서버 식별·영상·보정 정보를 해제한다", () => {
  const cleared = sensorSerialChanges("NEXT");
  assert.equal(cleared.serialNumber, "NEXT");
  assert.equal(cleared.serverSensorId, null);
  assert.equal(Object.hasOwn(cleared, "resolution"), false);
  assert.equal(Object.hasOwn(cleared, "intrinsics"), false);
  assert.equal(cleared.connectionStatus, "UNKNOWN");
  assert.deepEqual(cleared.reportedCapabilities, []);
  assert.equal(cleared.calibrationConfirmationFrame, null);
});
test("조회 요청은 캐시 없이 기존 FE01 경로를 사용하고 오류 진단 정보를 보존한다", async () => {
  const server = await createServer({ configFile: false, envDir: false, optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, hmr: false }, define: { "import.meta.env.VITE_MONITORING_API_BASE": JSON.stringify("https://sensor.invalid/api/fe/v1") } });
  const originalFetch = globalThis.fetch;
  try {
    const { lookupSensor } = await server.ssrLoadModule("/src/features/digitalTwin/editor/api/monitoringClient.js");
    const controller = new AbortController();
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://sensor.invalid/api/fe/v1/sensors/by-serial?serialNumber=CAM-001&equipmentId=equipment-1");
      assert.equal(options.cache, "no-store");
      assert.equal(options.headers["Content-Type"], undefined);
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(JSON.stringify({ sensor: { ...sensor, frameUrl: "/api/v1/media?key=frame" } }));
    };
    const result = await lookupSensor(" CAM-001 ", "equipment-1", controller.signal);
    assert.deepEqual(result, sensor);
    globalThis.fetch = async () => new Response(JSON.stringify({ request_id: "req-404", error: { code: "NOT_FOUND", message: "Mapping not found", fields: [{ path: "equipmentId" }] } }), { status: 404 });
    await assert.rejects(lookupSensor("CAM-001", "equipment-1"), error => {
      assert.equal(error.status, 404);
      assert.equal(error.code, "NOT_FOUND");
      assert.deepEqual(error.fields, [{ path: "equipmentId" }]);
      assert.match(sensorLookupErrorMessage(error), /서버 등록 상태.*req-404/);
      return true;
    });
    globalThis.fetch = async () => new Response(JSON.stringify({ sensor: { ...sensor, equipmentId: null } }));
    assert.equal((await lookupSensor("CAM-001", "equipment-1")).equipmentId, null);
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});
