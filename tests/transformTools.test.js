import test from "node:test";
import assert from "node:assert/strict";

import {
  cycleMoveAxisMode,
  cycleRotationAxisMode,
  cycleTransformMoveAxisMode,
  cycleTransformRotationAxisMode,
  getMoveAxisConfiguration,
  getRotationAxisConfiguration,
  MOVE_AXIS_MODES,
  normalizeTransformTools,
  ROTATION_AXIS_MODES,
} from "../src/features/digitalTwin/editor/constants/transformTools.js";

test("이동 모드는 XYZ, OFF, PLANAR 순서로 순환한다", () => {
  assert.equal(cycleMoveAxisMode(MOVE_AXIS_MODES.XYZ), MOVE_AXIS_MODES.OFF);
  assert.equal(cycleMoveAxisMode(MOVE_AXIS_MODES.OFF), MOVE_AXIS_MODES.PLANAR);
  assert.equal(cycleMoveAxisMode(MOVE_AXIS_MODES.PLANAR), MOVE_AXIS_MODES.XYZ);
});

test("평면 이동은 Y-up 좌표계의 바닥축 X와 Z만 노출한다", () => {
  assert.deepEqual(getMoveAxisConfiguration({ moveAxisMode: MOVE_AXIS_MODES.PLANAR }), {
    mode: MOVE_AXIS_MODES.PLANAR,
    enabled: true,
    showX: true,
    showY: false,
    showZ: true,
  });
  assert.deepEqual(getMoveAxisConfiguration({ moveAxisMode: MOVE_AXIS_MODES.XYZ }), {
    mode: MOVE_AXIS_MODES.XYZ,
    enabled: true,
    showX: true,
    showY: true,
    showZ: true,
  });
});

test("이동 꺼짐은 TransformControls와 모든 이동축을 비활성화한다", () => {
  assert.deepEqual(getMoveAxisConfiguration({ moveAxisMode: MOVE_AXIS_MODES.OFF }), {
    mode: MOVE_AXIS_MODES.OFF,
    enabled: false,
    showX: false,
    showY: false,
    showZ: false,
  });
});

test("회전 모드는 OFF, Y, XY, XYZ 순서로 순환한다", () => {
  assert.equal(cycleRotationAxisMode(ROTATION_AXIS_MODES.OFF), ROTATION_AXIS_MODES.Y);
  assert.equal(cycleRotationAxisMode(ROTATION_AXIS_MODES.Y), ROTATION_AXIS_MODES.XY);
  assert.equal(cycleRotationAxisMode(ROTATION_AXIS_MODES.XY), ROTATION_AXIS_MODES.XYZ);
  assert.equal(cycleRotationAxisMode(ROTATION_AXIS_MODES.XYZ), ROTATION_AXIS_MODES.OFF);
});

test("회전 모드에 해당하는 축만 노출한다", () => {
  assert.deepEqual(getRotationAxisConfiguration({ rotationAxisMode: ROTATION_AXIS_MODES.Y }), {
    mode: ROTATION_AXIS_MODES.Y, enabled: true, showX: false, showY: true, showZ: false,
  });
  assert.deepEqual(getRotationAxisConfiguration({ rotationAxisMode: ROTATION_AXIS_MODES.XY }), {
    mode: ROTATION_AXIS_MODES.XY, enabled: true, showX: true, showY: true, showZ: false,
  });
  assert.deepEqual(getRotationAxisConfiguration({ rotationAxisMode: ROTATION_AXIS_MODES.XYZ }), {
    mode: ROTATION_AXIS_MODES.XYZ, enabled: true, showX: true, showY: true, showZ: true,
  });
});

test("이전 translate boolean 상태를 새 명시적 모드로 호환한다", () => {
  assert.deepEqual(normalizeTransformTools({ translate: true, rotate: true }), {
    moveAxisMode: MOVE_AXIS_MODES.XYZ,
    rotationAxisMode: ROTATION_AXIS_MODES.Y,
    rotate: true,
  });
  assert.deepEqual(cycleTransformMoveAxisMode({ translate: false, rotate: true }), {
    moveAxisMode: MOVE_AXIS_MODES.PLANAR,
    rotationAxisMode: ROTATION_AXIS_MODES.Y,
    rotate: true,
  });
  assert.deepEqual(cycleTransformRotationAxisMode({ moveAxisMode: MOVE_AXIS_MODES.XYZ, rotate: false }), {
    moveAxisMode: MOVE_AXIS_MODES.XYZ,
    rotationAxisMode: ROTATION_AXIS_MODES.Y,
    rotate: true,
  });
});
