import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceMovementClock,
  appendMovementWaypoint,
  changeMovementWaypoint,
  compileMovementConfig,
  getMovementDuration,
  MAX_MOVEMENT_FRAME_DELTA,
  MOVEMENT_END_BEHAVIORS,
  MOVEMENT_PLAYBACK_STATES,
  MOVEMENT_REPEAT_MODES,
  normalizeMovementConfig,
  sampleMovementPath,
  MOVEMENT_PATH_TYPES,
  insertMovementWaypoint,
  removeMovementWaypoint,
  validateMovementConfig,
} from "../src/features/digitalTwin/editor/model/movementPath.js";

const movement = normalizeMovementConfig({
  enabled: true,
  speed: 2,
  startTime: 1,
  waitTime: 0,
  repeatMode: MOVEMENT_REPEAT_MODES.ONCE,
  endBehavior: MOVEMENT_END_BEHAVIORS.HOLD,
  waypoints: [
    { id: "a", x: 0, y: 0, z: 0, waitTime: 0 },
    { id: "b", x: 10, y: -3, z: 0, waitTime: 0 },
  ],
});

test("중앙 시계 시간으로 지상과 지하 사이 위치를 샘플링한다", () => {
  assert.equal(getMovementDuration(movement), 1 + Math.hypot(10, 3) / 2);
  const sample = sampleMovementPath(movement, 1 + Math.hypot(10, 3) / 4);
  assert.ok(Math.abs(sample.position.x - 5) < 1e-6);
  assert.ok(Math.abs(sample.position.y + 1.5) < 1e-6);
  assert.equal(sample.phase, "MOVING");
});

test("왕복 경로는 두 번째 주기에서 방향과 위치를 반전한다", () => {
  const pingPong = { ...movement, startTime: 0, repeatMode: MOVEMENT_REPEAT_MODES.PING_PONG };
  const duration = getMovementDuration(pingPong);
  const first = sampleMovementPath(pingPong, duration * 0.25);
  const returnTrip = sampleMovementPath(pingPong, duration * 1.75);
  assert.ok(Math.abs(first.position.x - returnTrip.position.x) < 1e-6);
  assert.equal(Math.sign(first.tangent.x), -Math.sign(returnTrip.tangent.x));
});

test("1회 실행 후 숨기기 종료 동작을 적용한다", () => {
  const hidden = sampleMovementPath({ ...movement, endBehavior: MOVEMENT_END_BEHAVIORS.HIDE }, 999);
  assert.equal(hidden.visible, false);
  assert.equal(hidden.phase, "FINISHED");
});

test("곡선 경로는 중간 경유점 주변을 부드러운 접선으로 통과한다", () => {
  const curved = normalizeMovementConfig({
    enabled: true,
    pathType: MOVEMENT_PATH_TYPES.CURVE,
    speed: 1,
    waypoints: [
      { id: "a", x: 0, y: 0, z: 0 },
      { id: "b", x: 4, y: 0, z: 4 },
      { id: "c", x: 8, y: -3, z: 0 },
    ],
  });
  const sample = sampleMovementPath(curved, getMovementDuration(curved) * 0.4);
  assert.equal(Number.isFinite(sample.position.x), true);
  assert.ok(Math.hypot(sample.tangent.x, sample.tangent.y, sample.tangent.z) > 0);
});

test("빈 경로와 잘못된 시간·속도는 유한한 기본 경로로 정규화한다", () => {
  const invalid = compileMovementConfig({
    enabled: true,
    speed: 0,
    startTime: Number.POSITIVE_INFINITY,
    waitTime: Number.NaN,
    waypoints: [],
  }, { x: 2, y: -4, z: 6 });
  const sample = sampleMovementPath(invalid, Number.POSITIVE_INFINITY);
  assert.equal(invalid.speed, 0.05);
  assert.equal(invalid.startTime, 0);
  assert.equal(invalid.waypoints[0].id, "WAYPOINT_FALLBACK_0");
  assert.deepEqual(sample.position, { x: 2, y: -4, z: 6 });
  assert.equal(Object.values(sample.position).every(Number.isFinite), true);
});

test("경유점 하나와 길이 0인 구간은 정지 상태로 안전하게 샘플링한다", () => {
  const single = compileMovementConfig({
    enabled: true,
    waypoints: [{ id: "only", x: 3, y: 1, z: -2 }],
  });
  const zeroLength = compileMovementConfig({
    enabled: true,
    waypoints: [
      { id: "a", x: 1, y: 2, z: 3 },
      { id: "b", x: 1, y: 2, z: 3 },
    ],
  });
  assert.deepEqual(sampleMovementPath(single, 5).position, { x: 3, y: 1, z: -2 });
  assert.deepEqual(sampleMovementPath(zeroLength, 5).position, { x: 1, y: 2, z: 3 });
  assert.equal(getMovementDuration(single), 0.01);
  assert.equal(compileMovementConfig(single), single);
});

test("중앙 시계는 정지·일시정지에서 진행하지 않고 과도한 delta를 제한한다", () => {
  assert.equal(advanceMovementClock(4, 1, MOVEMENT_PLAYBACK_STATES.PAUSED), 4);
  assert.equal(advanceMovementClock(4, 1, MOVEMENT_PLAYBACK_STATES.STOPPED), 4);
  assert.equal(advanceMovementClock(4, 1, MOVEMENT_PLAYBACK_STATES.PLAYING), 4 + MAX_MOVEMENT_FRAME_DELTA);
  assert.equal(advanceMovementClock(Number.NaN, -1, MOVEMENT_PLAYBACK_STATES.PLAYING), 0);
});

test("재생 전 경로·속도·시간 오류를 정확히 구분한다", () => {
  assert.equal(validateMovementConfig({ speed: 1, startTime: 0, waitTime: 0, waypoints: [] }).code, "PATH_MISSING");
  assert.equal(validateMovementConfig({ ...movement, speed: 0 }).code, "INVALID_SPEED");
  assert.equal(validateMovementConfig({ ...movement, startTime: Number.NaN }).code, "INVALID_TIME");
  assert.equal(validateMovementConfig({ ...movement, waypoints: movement.waypoints.map((point) => ({ ...point, x: 1, y: 1, z: 1 })) }).code, "ZERO_LENGTH_PATH");
  assert.equal(validateMovementConfig(movement).valid, true);
});

test("경유점 추가·선분 삽입·드래그 변경·삭제가 순서와 안정 ID를 유지한다", () => {
  const appended = appendMovementWaypoint(movement, { x: 12, y: 0, z: 2 });
  const inserted = insertMovementWaypoint(appended, 1, { x: 4, y: 0, z: 1 });
  const insertedId = inserted.waypoints[1].id;
  const changed = changeMovementWaypoint(inserted, insertedId, { x: 5, z: 3 });
  const removed = removeMovementWaypoint(changed, insertedId);
  assert.equal(appended.waypoints.length, movement.waypoints.length + 1);
  assert.equal(changed.waypoints[1].id, insertedId);
  assert.deepEqual({ x: changed.waypoints[1].x, z: changed.waypoints[1].z }, { x: 5, z: 3 });
  assert.equal(removed.removed, true);
  assert.deepEqual(removed.config.waypoints.map((point) => point.id), appended.waypoints.map((point) => point.id));
});
