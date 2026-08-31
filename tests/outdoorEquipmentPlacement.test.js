import test from "node:test";
import assert from "node:assert/strict";

import {
  OUTDOOR_PLACEMENT_MODES,
  moveAttachedOutdoorEquipment,
  resolveOutdoorEquipmentPlacement,
} from "../src/features/digitalTwin/editor/model/outdoorEquipmentPlacement.js";

const building = (overrides = {}) => ({
  id: "building-1",
  position: { x: 10, y: 0, z: 5 },
  rotation: { y: 0 },
  parameters: { width: 12, depth: 8, floorCount: 2, floorHeight: 3 },
  ...overrides,
});

const equipment = (allowedModes, position = { x: 10, y: 0, z: 5 }) => ({
  id: "outdoor-1",
  categoryId: "OUTDOOR_EQUIPMENT",
  position,
  rotation: { x: 0, y: 0, z: 0 },
  dimensions: { width: 2, height: 2, depth: 2 },
  placementRules: { allowedModes, snapDistance: 2 },
});

test("옥상 설비는 건축물 높이와 이동을 안정적인 건축물 ID로 추적한다", () => {
  const originalBuilding = building();
  const placed = resolveOutdoorEquipmentPlacement(equipment([OUTDOOR_PLACEMENT_MODES.ROOF]), [originalBuilding]);
  assert.equal(placed.placement.mode, OUTDOOR_PLACEMENT_MODES.ROOF);
  assert.equal(placed.placement.buildingId, originalBuilding.id);
  assert.equal(placed.position.y, 6);

  const changedBuilding = building({
    position: { x: 15, y: 1, z: 7 },
    rotation: { y: Math.PI / 2 },
    parameters: { width: 12, depth: 8, floorCount: 3, floorHeight: 3 },
  });
  const moved = moveAttachedOutdoorEquipment(placed, originalBuilding, changedBuilding);
  assert.equal(moved.position.y, 10);
  assert.equal(moved.placement.localPosition.y, 9);
  assert.equal(moved.position.x, 15);
  assert.equal(moved.position.z, 7);
});

test("외벽 설비는 건물 높이 변경 시 동일한 상대 높이를 유지한다", () => {
  const originalBuilding = building();
  const placed = resolveOutdoorEquipmentPlacement(
    equipment([OUTDOOR_PLACEMENT_MODES.WALL], { x: 16.4, y: 0, z: 5 }),
    [originalBuilding],
  );
  assert.equal(placed.placement.mode, OUTDOOR_PLACEMENT_MODES.WALL);
  assert.equal(placed.placement.heightRatio, 0.55);

  const changedBuilding = building({ parameters: { width: 12, depth: 8, floorCount: 4, floorHeight: 3 } });
  const moved = moveAttachedOutdoorEquipment(placed, originalBuilding, changedBuilding);
  assert.ok(Math.abs(moved.position.y - 6.6) < 1e-9);
  assert.ok(Math.abs(moved.placement.localPosition.y - 6.6) < 1e-9);
});

test("도로 주변 허용 설비는 가장 가까운 도로 가장자리로 스냅한다", () => {
  const road = { id: "road-1", profile: "ROAD", position: { x: 0, y: 0, z: 0 }, dimensions: { width: 20, depth: 4 } };
  const placed = resolveOutdoorEquipmentPlacement(
    equipment([OUTDOOR_PLACEMENT_MODES.ROAD_EDGE], { x: 2, y: 0, z: 3 }),
    [],
    [road],
  );
  assert.equal(placed.placement.mode, OUTDOOR_PLACEMENT_MODES.ROAD_EDGE);
  assert.equal(placed.placement.roadId, road.id);
  assert.equal(placed.position.z, 2.8);
});
