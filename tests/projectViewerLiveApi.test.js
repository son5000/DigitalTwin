import test from "node:test";
import assert from "node:assert/strict";
import { equipmentMappingPath, summarizeEnclosure, viewerEventsUrl } from "../src/features/portal/projects/projectViewerLiveApi.js";

test("viewer live connections use backend equipment mapping and WebSocket paths", () => {
  assert.equal(equipmentMappingPath("project/a", "pump 1"), "/equipment-mappings?projectId=project%2Fa&equipmentId=pump+1");
  assert.equal(viewerEventsUrl("https://checklab.co.kr/api/v1"), "wss://checklab.co.kr/api/v1/events");
  assert.throws(() => equipmentMappingPath("project-a", ""));
});

test("active backend alarms and slot states map only to their saved equipment and sensor IDs", () => {
  const snapshot = { server_time: new Date().toISOString(), slots: [{ sensor_id: "42", status: "FAULT" }],
    alarms: [{ state: "OPEN", severity: "CRITICAL" }], observations: [] };
  const bindings = [{ id: "binding-1", serverSensorId: "42", equipmentIds: ["pump-1"] }];
  const result = summarizeEnclosure("pump-1", [snapshot], bindings);
  assert.equal(result.equipment.status, "DANGER");
  assert.deepEqual(result.sensors.map((item) => [item.bindingId, item.connectionStatus]), [["binding-1", "FAULT"]]);
  assert.equal(summarizeEnclosure("pump-2", [], bindings).equipment.status, "NO_DATA");
});

test("an online slot alone does not fabricate a normal equipment measurement", () => {
  const snapshot = { server_time: new Date().toISOString(), slots: [{ sensor_id: "42", status: "ONLINE" }],
    alarms: [], observations: [] };
  assert.equal(summarizeEnclosure("pump-1", [snapshot], []).equipment.status, "NO_DATA");
});

test("a fresh observation is not shown as normal before its view is configured", () => {
  const snapshot = { server_time: new Date().toISOString(), view: { status: "MAPPING_REQUIRED" }, slots: [],
    alarms: [], observations: [{ kind: "THERMAL_STATS", time: new Date().toISOString(), values: { max: 40 } }] };
  assert.equal(summarizeEnclosure("pump-1", [snapshot], []).equipment.status, "NO_DATA");
  snapshot.view.status = "READY";
  assert.equal(summarizeEnclosure("pump-1", [snapshot], []).equipment.status, "NORMAL");
});
