import test from "node:test";
import assert from "node:assert/strict";

import {
  createFloorDisplayOffsets,
  formatFloorOptionLabel,
  normalizeFloorDisplayGap,
  resolveFloorOwnerId,
  sortFloorsByLevel,
} from "../src/features/digitalTwin/editor/model/floorDisplay.js";

const FLOORS = [
  { id: "floor-3", level: 3, elevation: 7.2, name: "생산 구역" },
  { id: "floor-1", level: 1, elevation: 0, name: "출하 구역" },
  { id: "floor-2", level: 2, elevation: 3.6, name: "검사 구역" },
];

test("층 이동 목록은 안정적인 ID를 유지하며 층 번호 순으로 정렬한다", () => {
  assert.deepEqual(sortFloorsByLevel(FLOORS).map((floor) => floor.id), ["floor-1", "floor-2", "floor-3"]);
  assert.equal(formatFloorOptionLabel(FLOORS[0]), "3F");
});

test("표시 간격은 층 순서에만 곱하고 실제 elevation을 변경하지 않는다", () => {
  const offsets = createFloorDisplayOffsets(FLOORS, 2.5);
  assert.deepEqual([...offsets], [["floor-1", 0], ["floor-2", 2.5], ["floor-3", 5]]);
  assert.deepEqual(FLOORS.map((floor) => floor.elevation), [7.2, 0, 3.6]);
});

test("0m와 범위를 벗어난 표시 간격을 안전하게 정규화한다", () => {
  assert.equal(normalizeFloorDisplayGap(""), 0);
  assert.equal(normalizeFloorDisplayGap(-3), 0);
  assert.equal(normalizeFloorDisplayGap(18), 12);
});

test("여러 층을 연결하는 구조물은 안정적인 시작 층 그룹을 소유한다", () => {
  assert.equal(resolveFloorOwnerId({ applicationScope: { startFloorId: "floor-2", connectedFloorIds: ["floor-2", "floor-3"] } }, FLOORS), "floor-2");
  assert.equal(resolveFloorOwnerId({ applicationScope: { connectedFloorIds: ["floor-3", "floor-1"] } }, FLOORS), "floor-1");
});
