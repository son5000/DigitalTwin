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

export const DEFAULT_TRANSFORM_TOOLS = Object.freeze({
  moveAxisMode: MOVE_AXIS_MODES.XYZ,
  rotate: false,
});

export const DISABLED_TRANSFORM_TOOLS = Object.freeze({
  moveAxisMode: MOVE_AXIS_MODES.OFF,
  rotate: false,
});

export function normalizeMoveAxisMode(tools) {
  if (MOVE_AXIS_MODE_SEQUENCE.includes(tools?.moveAxisMode)) return tools.moveAxisMode;
  // 이전 런타임/저장값의 translate boolean은 읽기 호환만 유지한다.
  if (tools?.translate === false) return MOVE_AXIS_MODES.OFF;
  return MOVE_AXIS_MODES.XYZ;
}

export function normalizeTransformTools(tools) {
  return {
    moveAxisMode: normalizeMoveAxisMode(tools),
    rotate: Boolean(tools?.rotate),
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
