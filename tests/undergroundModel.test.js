import test from "node:test";
import assert from "node:assert/strict";

import {
  collectTerrainExcavations,
  createUndergroundConnection,
  formatFloorLevel,
  getBasementFloorCount,
  isPointInsideExcavation,
} from "../src/features/digitalTwin/editor/model/undergroundModel.js";

const building = { id: "building-1", position: { x: 5, z: 2 }, rotation: { y: 0 }, parameters: { width: 12, depth: 8, floorHeight: 3.6, basementFloorCount: 2 } };
const floors = [
  { id: "b2", parentId: "building-1", level: -2, elevation: -7.2, floorHeight: 3.6 },
  { id: "b1", parentId: "building-1", level: -1, elevation: -3.6, floorHeight: 3.6 },
  { id: "f1", parentId: "building-1", level: 1, elevation: 0, floorHeight: 3.6 },
];

test("지하층 수와 표시 이름은 기존 지상층과 충돌하지 않는다", () => {
  assert.equal(getBasementFloorCount(building), 2);
  assert.equal(formatFloorLevel(-2), "B2");
  assert.equal(formatFloorLevel(3), "3F");
});

test("건축물 지하층은 지형 절개 영역을 만든다", () => {
  const [excavation] = collectTerrainExcavations([building], floors, []);
  assert.equal(excavation.bottom, -7.2);
  assert.equal(isPointInsideExcavation(5, 2, excavation), true);
  assert.equal(isPointInsideExcavation(30, 2, excavation), false);
});

test("지하 출입구는 가장 가까운 건축물의 B1과 안정적인 ID로 연결된다", () => {
  const object = { id: "entry", assetKind: "UNDERGROUND_ACCESS", position: { x: 7, y: 0, z: 2 }, dimensions: { width: 3, depth: 6 } };
  const connection = createUndergroundConnection(object, [building], floors);
  assert.equal(connection.targetBuildingId, "building-1");
  assert.equal(connection.targetFloorId, "b1");
  assert.equal(connection.endPoint.y, -3.6);
  assert.match(connection.id, /^UNDERGROUND_CONNECTION_/);
});
