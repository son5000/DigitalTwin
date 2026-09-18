import test from "node:test";
import assert from "node:assert/strict";

import { getEquipmentIdFromIntersection, pickEquipmentId } from "../src/features/digitalTwin/editor/three/equipmentRaycast.js";

function node(userData = {}, parent = null, visible = true) {
  return { userData, parent, visible, isMesh: true, material: { visible: true, opacity: 1 } };
}

test("일반 설비와 인스턴스 설비의 저장 ID를 선택한다", () => {
  const root = node();
  const equipment = node({ equipmentId: "equipment-01" }, root);
  const mesh = node({}, equipment);
  assert.equal(getEquipmentIdFromIntersection({ object: mesh }, root), "equipment-01");

  const instances = node({ equipmentInstanceIds: ["equipment-02", "equipment-03"] }, root);
  assert.equal(getEquipmentIdFromIntersection({ object: instances, instanceId: 1 }, root), "equipment-03");
});

test("환경요소는 건너뛰고 숨겨지지 않은 설비만 선택한다", () => {
  const root = node();
  const environment = node({ siteObjectId: "tree-01" }, root);
  const equipment = node({ equipmentId: "equipment-01" }, root);
  assert.equal(pickEquipmentId({ intersectObject: () => [{ object: environment }, { object: equipment }] }, root), "equipment-01");

  equipment.visible = false;
  assert.equal(pickEquipmentId({ intersectObject: () => [{ object: equipment }] }, root), null);
});
