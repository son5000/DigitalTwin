import test from "node:test";
import assert from "node:assert/strict";
import { collectMonitoringEquipment } from "../src/features/digitalTwin/editor/model/monitoringEquipmentList.js";

test("all floors, rooms and outdoor equipment are listed once and keep their saved ownership", () => {
  const list = collectMonitoringEquipment({
    floorEquipment: [{ id: "first", name: "팬", floorId: "b1", shapeTemplateId: "FAN" }, { id: "second", name: "팬", floorId: "f2", shapeTemplateId: "FAN" }],
    hierarchy: [{ id: "building", name: "A동" }, { id: "b1", parentId: "building", name: "B1" }, { id: "f2", parentId: "building", name: "2층" }, { id: "room", parentId: "f2", name: "기계실" }],
    roomScenes: { room: { equipment: [{ id: "room-fan", shapeTemplateId: "FAN" }, { id: "first", shapeTemplateId: "FAN" }] }, active: { equipment: [{ id: "stale" }] } },
    activeRoomId: "active", roomEquipment: [{ id: "live", shapeTemplateId: "FAN" }],
    siteObjects: [{ id: "outside", type: "OUT_FAN" }, { id: "tree", type: "TREE" }],
    templates: { FAN: {}, OUT_FAN: { defaultDimensions: { width: 1, height: 2, depth: 1 } } },
  });
  assert.deepEqual(list.map((item) => item.id), ["first", "second", "room-fan", "live", "outside"]);
  assert.equal(list[0].locationLabel, "A동 / B1");
  assert.equal(list[2].locationLabel, "A동 / 2층 / 기계실");
  assert.equal(list[2].monitoringOwnerId, "room");
  assert.equal(list[4].monitoringSource, "SITE");
  assert.equal(list[4].shapeTemplateId, "OUT_FAN");
  assert.equal(list[0].id, "first");
  assert.equal(collectMonitoringEquipment({}).length, 0);
});

test("equipment is collected even when a world has no buildings or floors", () => {
  const source = { id: "outdoor", type: "OUT_CCTV", name: "CCTV", position: { x: 12, y: 3, z: -2 } };
  const list = collectMonitoringEquipment({ siteObjects: [source], templates: { OUT_CCTV: {} } });
  assert.equal(list[0].id, "outdoor");
  assert.deepEqual(source.position, { x: 12, y: 3, z: -2 });
  assert.equal(Object.hasOwn(source, "monitoringSource"), false);
});
