import test from "node:test";
import assert from "node:assert/strict";

import {
  getStairRenderInstances,
  normalizeStairOwnership,
  STAIR_SCOPES,
} from "../src/features/digitalTwin/editor/utils/stairStructure.js";

const FLOORS = [
  { id: "f1", parentId: "b1", level: 1, elevation: 0 },
  { id: "f2", parentId: "b1", level: 2, elevation: 3.4 },
  { id: "f3", parentId: "b1", level: 3, elevation: 6.8 },
];
const BASE_STAIR = { id: "s1", type: "STAIR", buildingId: "b1", parameters: {}, position: { x: 0, z: 0 } };

test("기존 시작·종료층 계단을 안정적인 소유 필드로 마이그레이션한다", () => {
  const stair = normalizeStairOwnership({ ...BASE_STAIR, startFloorId: "f1", endFloorId: "f3" }, FLOORS);
  assert.equal(stair.scope, STAIR_SCOPES.CONNECTING);
  assert.equal(stair.floorId, "f1");
  assert.equal(stair.fromFloorId, "f1");
  assert.equal(stair.toFloorId, "f3");
  assert.deepEqual(stair.applicationScope.connectedFloorIds, ["f1", "f2", "f3"]);
});

test("층별 계단은 지정 층 렌더 그룹 하나만 소유한다", () => {
  const stair = normalizeStairOwnership({ ...BASE_STAIR, scope: STAIR_SCOPES.FLOOR, floorId: "f2" }, FLOORS);
  const instances = getStairRenderInstances(stair, FLOORS);
  assert.equal(instances.length, 1);
  assert.equal(instances[0].renderFloorId, "f2");
  assert.equal(stair.fromFloorId, "f2");
  assert.equal(stair.toFloorId, "f2");
});

test("모든 층 계단은 전역 메시 대신 층별 렌더 인스턴스로 파생한다", () => {
  const stair = normalizeStairOwnership({ ...BASE_STAIR, scope: STAIR_SCOPES.ALL_FLOORS }, FLOORS);
  const instances = getStairRenderInstances(stair, FLOORS);
  assert.deepEqual(instances.map((instance) => instance.renderFloorId), ["f1", "f2", "f3"]);
  assert.equal(new Set(instances.map((instance) => instance.id)).size, 3);
});
