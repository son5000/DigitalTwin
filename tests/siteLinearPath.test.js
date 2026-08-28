import assert from "node:assert/strict";
import test from "node:test";

import {
  createSiteLinearPathChanges,
  getSiteLinearPathFootprint,
  getSiteLinearPathLength,
  resizeSiteLinearPath,
} from "../src/features/digitalTwin/editor/utils/siteLinearPath.js";

test("가로 방향 도로의 경로 길이를 늘리면 실제 좌표와 footprint가 함께 늘어난다", () => {
  const object = { path: { width: 7, points: [{ x: -9, z: 0 }, { x: 9, z: 0 }] } };
  const changes = createSiteLinearPathChanges(object, { length: 30 });

  assert.equal(getSiteLinearPathLength(changes.path), 30);
  assert.deepEqual(changes.path.points, [{ x: -15, z: 0 }, { x: 15, z: 0 }]);
  assert.deepEqual(changes.dimensions, { width: 30, depth: 7 });
});

test("세로 방향 배관과 컨베이어도 같은 길이 입력으로 depth가 갱신된다", () => {
  const object = { path: { width: 1.2, points: [{ x: 0, z: -3 }, { x: 0, z: 3 }] } };
  const changes = createSiteLinearPathChanges(object, { length: 12 });

  assert.equal(getSiteLinearPathLength(changes.path), 12);
  assert.deepEqual(changes.dimensions, { width: 1.2, depth: 12 });
});

test("선형 오브젝트의 폭 변경도 경로와 실제 footprint를 함께 갱신한다", () => {
  const object = { path: { width: 2, points: [{ x: -5, z: 0 }, { x: 5, z: 0 }] } };
  const changes = createSiteLinearPathChanges(object, { width: 4 });

  assert.equal(changes.path.width, 4);
  assert.deepEqual(changes.dimensions, { width: 10, depth: 4 });
});

test("꺾인 경로는 전체 길이 비율을 유지하며 중심 기준으로 확대된다", () => {
  const path = { width: 1, points: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 4 }] };
  const resized = resizeSiteLinearPath(path, 14);

  assert.equal(getSiteLinearPathLength(resized), 14);
  assert.deepEqual(resized.points, [{ x: -1.5, z: -2 }, { x: 4.5, z: -2 }, { x: 4.5, z: 6 }]);
  assert.deepEqual(getSiteLinearPathFootprint(resized), { width: 6.5, depth: 8.5 });
});
