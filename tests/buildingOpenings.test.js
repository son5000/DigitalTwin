import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILDING_FACADES,
  OPENING_COLLISION_MARGIN,
  getBuildingFacadeOpenings,
} from "../src/features/digitalTwin/editor/model/buildingOpenings.js";

function building({ width = 14, doorWidth = 2, doorCount = 1, doorOffset = 0, windowCount = 5, floorCount = 3 } = {}) {
  return {
    parameters: { width, depth: 8, floorHeight: 3.6 },
    facadeOpenings: {
      doors: {
        enabled: true,
        count: doorCount,
        facade: BUILDING_FACADES.FRONT,
        width: doorWidth,
        height: 2.4,
        spacing: 2,
        offset: doorOffset,
        startFloor: 1,
        endFloor: 1,
      },
      windows: {
        enabled: true,
        count: windowCount,
        facades: [BUILDING_FACADES.FRONT],
        width: 1,
        height: 1.3,
        sillHeight: 1,
        spacing: 1,
        offset: 0,
        startFloor: 1,
        endFloor: floorCount,
      },
    },
  };
}

function windowCenters(openings, floor) {
  return openings.filter(({ kind, floor: openingFloor }) => kind === "WINDOW" && openingFloor === floor).map(({ center }) => center);
}

test("모든 층은 같은 파사드 창문 슬롯을 공유하고 1층 충돌 슬롯만 비운다", () => {
  const { openings } = getBuildingFacadeOpenings(building(), 3);
  const firstFloor = windowCenters(openings, 1);
  const secondFloor = windowCenters(openings, 2);

  assert.deepEqual(secondFloor, [-4, -2, 0, 2, 4]);
  assert.deepEqual(windowCenters(openings, 3), secondFloor);
  assert.deepEqual(firstFloor, [-4, -2, 2, 4]);
  assert.ok(firstFloor.every((center) => secondFloor.includes(center)));
});

test("출입문 충돌 금지 영역을 피할 공간이 없으면 창문을 생략한다", () => {
  const { openings } = getBuildingFacadeOpenings(building({ width: 5, doorWidth: 4, windowCount: 1, floorCount: 1 }), 1);

  assert.equal(openings.filter(({ kind }) => kind === "DOOR").length, 1);
  assert.equal(openings.filter(({ kind }) => kind === "WINDOW").length, 0);
});

test("출입문이 여러 개면 겹치는 고정 슬롯만 제거한다", () => {
  const { openings } = getBuildingFacadeOpenings(building({ doorCount: 2 }), 3);

  assert.deepEqual(windowCenters(openings, 1), [-4, 0, 4]);
  assert.deepEqual(windowCenters(openings, 2), [-4, -2, 0, 2, 4]);
});

test("건축물 너비가 달라도 창문 슬롯의 간격과 대칭을 유지한다", () => {
  [10, 14, 18].forEach((width) => {
    const { openings } = getBuildingFacadeOpenings(building({ width }), 3);
    const centers = windowCenters(openings, 2);
    const gaps = centers.slice(1).map((center, index) => center - centers[index]);

    assert.ok(gaps.every((gap) => gap === 2));
    assert.equal(centers[0] + centers.at(-1), 0);
  });
});

test("출입문 위치 변경은 해당 슬롯만 비우고 나머지 슬롯을 이동시키지 않는다", () => {
  const { openings } = getBuildingFacadeOpenings(building({ doorOffset: 2 }), 3);
  const upperFloorSlots = windowCenters(openings, 2);

  assert.deepEqual(upperFloorSlots, [-4, -2, 0, 2, 4]);
  assert.deepEqual(windowCenters(openings, 1), [-4, -2, 0, 4]);
  const door = openings.find(({ kind }) => kind === "DOOR");
  assert.ok(Math.abs(2 - door.center) - (1 + door.width) / 2 < OPENING_COLLISION_MARGIN);
});
