import assert from "node:assert/strict";
import test from "node:test";

import {
  ELEVATION_ZONE_SURFACES,
  FLOOR_FOOTPRINT_MODES,
  addDoorToWall,
  addFootprintHole,
  addFootprintRegion,
  addRectangularRoom,
  getFloorHeightAtPoint,
  mergeFootprintRegions,
  normalizeFloorSpatialPlan,
  pointInsideFootprint,
  restoreInheritedFloorFootprint,
  subtractFootprintRegion,
  synchronizeRoomWalls,
  updateSharedWall,
  validateDoor,
  validateElevationZones,
  validateFloorFootprint,
} from "../src/features/digitalTwin/editor/model/floorSpatialModel.js";

const building = { id: "BUILDING_1", parameters: { width: 20, depth: 12 } };

test("기존 사각형 층은 건축물 단면을 상속하는 FloorFootprint로 마이그레이션한다", () => {
  const plan = normalizeFloorSpatialPlan({ floorId: "FLOOR_1", structures: [] }, building);
  assert.equal(plan.spatialVersion, 1);
  assert.equal(plan.floorFootprint.mode, FLOOR_FOOTPRINT_MODES.INHERIT_BUILDING);
  assert.equal(plan.floorFootprint.regions.length, 1);
  assert.deepEqual(plan.floorFootprint.regions[0].outer[0], { x: -10, z: -6 });
  assert.equal(plan.elevationZones[0].relativeHeight, 0);
});

test("복수 영역, 내부 중정, 영역 합치기와 빼기를 표현한다", () => {
  let plan = normalizeFloorSpatialPlan({}, building);
  plan.floorFootprint = addFootprintRegion(plan.floorFootprint, { width: 4, depth: 4, center: { x: 13, z: 0 } });
  assert.equal(plan.floorFootprint.regions.length, 2);
  const ids = plan.floorFootprint.regions.map((region) => region.id);
  const merged = mergeFootprintRegions(plan.floorFootprint, ids);
  assert.equal(merged.regions.length, 1);
  assert.equal(merged.mode, FLOOR_FOOTPRINT_MODES.CUSTOM);

  const withRegion = addFootprintRegion(plan.floorFootprint, { width: 2, depth: 2, center: { x: 0, z: 0 } });
  const targetId = withRegion.regions[0].id;
  const subtractId = withRegion.regions.at(-1).id;
  const subtracted = subtractFootprintRegion(withRegion, targetId, subtractId);
  assert.equal(subtracted.regions.length, 2);
  assert.equal(subtracted.regions.find((region) => region.id === targetId).holes.length, 1);

  const withHole = addFootprintHole(plan.floorFootprint, plan.floorFootprint.regions[0].id);
  assert.equal(validateFloorFootprint(withHole).filter((issue) => issue.severity === "error").length, 0);
  assert.equal(pointInsideFootprint({ x: 0, z: 0 }, withHole), false);
});

test("잘못된 외곽선과 짧은 변을 차단한다", () => {
  const issues = validateFloorFootprint({
    regions: [{ id: "BAD", holes: [], outer: [
      { x: 0, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }, { x: 2, z: 0 },
    ] }],
  });
  assert.ok(issues.some((issue) => issue.code === "SELF_INTERSECTION"));
});

test("기본 외형 복원은 상속 모드와 건축물 크기를 회복한다", () => {
  const plan = normalizeFloorSpatialPlan({}, building);
  const custom = addFootprintRegion(plan.floorFootprint);
  const restored = restoreInheritedFloorFootprint(building, custom);
  assert.equal(restored.mode, FLOOR_FOOTPRINT_MODES.INHERIT_BUILDING);
  assert.equal(restored.regions.length, 1);
});

test("고도 영역은 평탄·경사 높이를 계산하고 위험 경사를 경고한다", () => {
  const plan = normalizeFloorSpatialPlan({}, building);
  const zone = {
    ...plan.elevationZones[0],
    surfaceType: ELEVATION_ZONE_SURFACES.SLOPED,
    relativeHeight: 0.3,
    slope: { x: 0.2, z: 0 },
  };
  assert.equal(getFloorHeightAtPoint([zone], { x: -9, z: -6 }), 0.5);
  assert.ok(validateElevationZones([zone], plan.floorFootprint).some((issue) => issue.code === "STEEP_SLOPE"));
});

test("인접 방은 안정적인 공유 벽 하나를 재사용한다", () => {
  const rooms = [
    { id: "ROOM_A", outline: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }] },
    { id: "ROOM_B", outline: [{ x: 4, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 3 }, { x: 4, z: 3 }] },
  ];
  const first = synchronizeRoomWalls(rooms, []);
  assert.equal(first.walls.length, 7);
  const shared = first.walls.find((wall) => wall.roomIds.length === 2);
  assert.deepEqual(new Set(shared.roomIds), new Set(["ROOM_A", "ROOM_B"]));
  const second = synchronizeRoomWalls(rooms, first.walls);
  assert.equal(second.walls.find((wall) => wall.boundaryKey === shared.boundaryKey).id, shared.id);
});

test("방 생성은 네 벽을 만들고 벽 비활성화는 문 상태를 연동한다", () => {
  let plan = normalizeFloorSpatialPlan({}, building);
  plan = addRectangularRoom(plan, { width: 4, depth: 3 });
  assert.equal(plan.rooms.length, 1);
  assert.equal(plan.walls.length, 4);
  const result = addDoorToWall(plan, plan.walls[0].id, { width: 0.9 });
  assert.equal(result.error, "");
  assert.equal(result.plan.doors[0].hostWallId, plan.walls[0].id);
  assert.deepEqual(result.plan.doors[0].connectsRoomIds, [plan.rooms[0].id]);
  const disabled = updateSharedWall(result.plan, plan.walls[0].id, { enabled: false });
  assert.equal(disabled.doors[0].active, false);
  const restored = updateSharedWall(disabled, plan.walls[0].id, { enabled: true });
  assert.equal(restored.doors[0].active, true);
});

test("문은 벽 끝과 다른 개구부 겹침을 차단한다", () => {
  let plan = addRectangularRoom(normalizeFloorSpatialPlan({}, building), { width: 4, depth: 3 });
  const wall = plan.walls[0];
  let result = addDoorToWall(plan, wall.id, { offset: 2, width: 1 });
  assert.equal(result.error, "");
  plan = result.plan;
  assert.match(validateDoor({ ...plan.doors[0], id: "OTHER" }, plan.walls, plan.doors), /겹칩니다/);
  result = addDoorToWall(plan, wall.id, { offset: 0.1, width: 1 });
  assert.match(result.error, /벽 끝/);
});
