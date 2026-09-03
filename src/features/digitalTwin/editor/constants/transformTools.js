export const MOVE_AXIS_MODES = Object.freeze({
  XYZ: "XYZ",
  OFF: "OFF",
  PLANAR: "PLANAR",
});

export const MOVE_AXIS_MODE_SEQUENCE = Object.freeze([
  MOVE_AXIS_MODES.XYZ,
  MOVE_AXIS_MODES.OFF,
  MOVE_AXIS_MODES.PLANAR,
]);

export const ROTATION_AXIS_MODES = Object.freeze({
  OFF: "OFF",
  Y: "Y",
  XY: "XY",
  XYZ: "XYZ",
});

export const ROTATION_AXIS_MODE_SEQUENCE = Object.freeze([
  ROTATION_AXIS_MODES.OFF,
  ROTATION_AXIS_MODES.Y,
  ROTATION_AXIS_MODES.XY,
  ROTATION_AXIS_MODES.XYZ,
]);

export const DEFAULT_TRANSFORM_TOOLS = Object.freeze({
  moveAxisMode: MOVE_AXIS_MODES.XYZ,
  rotationAxisMode: ROTATION_AXIS_MODES.OFF,
  rotate: false,
});

export const DISABLED_TRANSFORM_TOOLS = Object.freeze({
  moveAxisMode: MOVE_AXIS_MODES.OFF,
  rotationAxisMode: ROTATION_AXIS_MODES.OFF,
  rotate: false,
});

export function normalizeMoveAxisMode(tools) {
  if (MOVE_AXIS_MODE_SEQUENCE.includes(tools?.moveAxisMode)) return tools.moveAxisMode;
  // 이전 런타임/저장값의 translate boolean은 읽기 호환만 유지한다.
  if (tools?.translate === false) return MOVE_AXIS_MODES.OFF;
  return MOVE_AXIS_MODES.XYZ;
}

export function normalizeRotationAxisMode(tools) {
  if (ROTATION_AXIS_MODE_SEQUENCE.includes(tools?.rotationAxisMode)) return tools.rotationAxisMode;
  // 이전 rotate boolean 상태는 기존 Y축 회전 동작으로 읽기 호환한다.
  return tools?.rotate ? ROTATION_AXIS_MODES.Y : ROTATION_AXIS_MODES.OFF;
}

export function normalizeTransformTools(tools) {
  const rotationAxisMode = normalizeRotationAxisMode(tools);
  return {
    moveAxisMode: normalizeMoveAxisMode(tools),
    rotationAxisMode,
    rotate: rotationAxisMode !== ROTATION_AXIS_MODES.OFF,
  };
}

export function cycleMoveAxisMode(mode) {
  const currentIndex = MOVE_AXIS_MODE_SEQUENCE.indexOf(mode);
  return MOVE_AXIS_MODE_SEQUENCE[(currentIndex + 1) % MOVE_AXIS_MODE_SEQUENCE.length]
    ?? MOVE_AXIS_MODES.XYZ;
}

export function cycleTransformMoveAxisMode(tools) {
  const normalized = normalizeTransformTools(tools);
  return { ...normalized, moveAxisMode: cycleMoveAxisMode(normalized.moveAxisMode) };
}

export function cycleRotationAxisMode(mode) {
  const currentIndex = ROTATION_AXIS_MODE_SEQUENCE.indexOf(mode);
  return ROTATION_AXIS_MODE_SEQUENCE[(currentIndex + 1) % ROTATION_AXIS_MODE_SEQUENCE.length]
    ?? ROTATION_AXIS_MODES.OFF;
}

export function cycleTransformRotationAxisMode(tools) {
  const normalized = normalizeTransformTools(tools);
  const rotationAxisMode = cycleRotationAxisMode(normalized.rotationAxisMode);
  return { ...normalized, rotationAxisMode, rotate: rotationAxisMode !== ROTATION_AXIS_MODES.OFF };
}

export function getMoveAxisConfiguration(tools) {
  const mode = normalizeMoveAxisMode(tools);
  return {
    mode,
    enabled: mode !== MOVE_AXIS_MODES.OFF,
    showX: mode !== MOVE_AXIS_MODES.OFF,
    showY: mode === MOVE_AXIS_MODES.XYZ,
    showZ: mode !== MOVE_AXIS_MODES.OFF,
  };
}

export function getRotationAxisConfiguration(tools) {
  const mode = normalizeRotationAxisMode(tools);
  return {
    mode,
    enabled: mode !== ROTATION_AXIS_MODES.OFF,
    showX: mode === ROTATION_AXIS_MODES.XY || mode === ROTATION_AXIS_MODES.XYZ,
    showY: mode !== ROTATION_AXIS_MODES.OFF,
    showZ: mode === ROTATION_AXIS_MODES.XYZ,
  };
}
