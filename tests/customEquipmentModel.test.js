import assert from "node:assert/strict";
import test from "node:test";

import {
  addPartFromPort,
  connectEquipmentPorts,
  createCustomEquipmentPart,
  createCustomEquipmentPlacement,
  createDefaultCustomEquipment,
  disconnectEquipmentPort,
  insertJunctionOnStraight,
  recalculateCustomEquipment,
  removeCustomEquipmentPart,
} from "../src/features/customAssets/equipment/customEquipmentModel.js";

test("배치 고스트 후보는 원본 설비를 변경하지 않고 클릭용 결과만 만든다", () => {
  const asset = createDefaultCustomEquipment();
  const result = createCustomEquipmentPlacement(asset, "PIPE_VALVE", { x: 4, y: 0, z: 2 });
  assert.equal(asset.parts.length, 1);
  assert.equal(result.asset.parts.length, 2);
  assert.equal(result.snapped, false);
  assert.deepEqual(result.asset.parts.find((part) => part.id === result.partId).position, { x: 4, y: 0, z: 2 });
});

test("배치 후보는 기존 포트 근처에서 정렬하고 자동 연결한다", () => {
  const asset = createDefaultCustomEquipment();
  const result = createCustomEquipmentPlacement(asset, "PIPE_STRAIGHT", { x: 2.4, y: 0, z: 0 });
  assert.equal(result.snapped, true);
  assert.equal(result.asset.metrics.connectionCount, 1);
});

test("커스텀 설비는 안정적인 부품과 포트 ID로 양방향 연결한다", () => {
  const asset = createDefaultCustomEquipment(); const first = asset.parts[0]; const second = createCustomEquipmentPart("PIPE_STRAIGHT", { position: { x: 2.4, y: 0, z: 0 } });
  const source = recalculateCustomEquipment({ ...asset, parts: [first, second] }); const connected = connectEquipmentPorts(source, { partId: first.id, portId: "b" }, { partId: second.id, portId: "a" });
  assert.equal(connected.ok, true); assert.equal(connected.asset.metrics.connectionCount, 1);
  assert.deepEqual(connected.asset.parts[0].ports.find((port) => port.id === "b").connectedTo, { partId: second.id, portId: "a" });
  const disconnected = disconnectEquipmentPort(connected.asset, first.id, "b"); assert.equal(disconnected.metrics.connectionCount, 0);
});

test("선택 포트에서 8방향 설정을 사용해 부품을 연장한다", () => {
  const asset = createDefaultCustomEquipment(); const result = addPartFromPort(asset, { partId: asset.parts[0].id, portId: "b" }, "PIPE_ELBOW_90", "NE");
  assert.ok(result.partId); assert.equal(result.asset.parts.length, 2); assert.equal(result.asset.metrics.connectionCount, 1);
});

test("직선 배관 중간 접합부 삽입은 두 구간과 연결 그래프를 만든다", () => {
  const asset = createDefaultCustomEquipment(); const result = insertJunctionOnStraight(asset, asset.parts[0].id, "PIPE_T", 0.5);
  assert.ok(result.partId); assert.equal(result.asset.parts.length, 3); assert.equal(result.asset.metrics.segmentCount, 2); assert.equal(result.asset.metrics.junctionCount, 1); assert.equal(result.asset.metrics.connectionCount, 2);
});

test("부품 삭제 시 상대 포트의 끊어진 참조를 정리한다", () => {
  const asset = createDefaultCustomEquipment(); const result = addPartFromPort(asset, { partId: asset.parts[0].id, portId: "b" }, "PIPE_VALVE"); const removed = removeCustomEquipmentPart(result.asset, result.partId);
  assert.equal(removed.parts.length, 1); assert.equal(removed.metrics.connectionCount, 0); assert.equal(removed.parts[0].ports.find((port) => port.id === "b").connectedTo, null);
});
