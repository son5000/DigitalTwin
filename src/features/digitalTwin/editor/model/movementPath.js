export const MOVEMENT_PATH_TYPES = Object.freeze({ LINEAR: "LINEAR", CURVE: "CURVE" });
export const MOVEMENT_REPEAT_MODES = Object.freeze({ ONCE: "ONCE", LOOP: "LOOP", PING_PONG: "PING_PONG" });
export const MOVEMENT_END_BEHAVIORS = Object.freeze({ HOLD: "HOLD", RESET: "RESET", HIDE: "HIDE" });
export const MOVEMENT_PLAYBACK_STATES = Object.freeze({ PLAYING: "PLAYING", PAUSED: "PAUSED", STOPPED: "STOPPED" });
export const MAX_MOVEMENT_FRAME_DELTA = 1 / 15;

const COMPILED_MOVEMENT = Symbol("compiledMovement");

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function createWaypointId() {
  return `WAYPOINT_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function point(value, fallback = {}, fallbackId = "WAYPOINT_FALLBACK") {
  return {
    id: value?.id ?? fallback.id ?? fallbackId,
    x: finite(value?.x, finite(fallback.x)),
    y: finite(value?.y, finite(fallback.y)),
    z: finite(value?.z, finite(fallback.z)),
    floorId: value?.floorId ?? fallback.floorId ?? null,
    waitTime: Math.max(0, finite(value?.waitTime, 0)),
  };
}

function defaultWaypoints(position = {}, createIds = false) {
  const start = point(position, {}, createIds ? createWaypointId() : "WAYPOINT_FALLBACK_0");
  return [
    start,
    point(
      { x: start.x, y: start.y, z: start.z - 6 },
      {},
      createIds ? createWaypointId() : "WAYPOINT_FALLBACK_1",
    ),
  ];
}

export function isMovableSiteObject(object) {
  return object?.assetKind === "VEHICLE" || object?.assetKind === "PERSON";
}

export function createDefaultMovementConfig(position = {}) {
  return {
    enabled: false,
    pathType: MOVEMENT_PATH_TYPES.LINEAR,
    waypoints: defaultWaypoints(position, true),
    startTime: 0,
    speed: 1.4,
    waitTime: 0,
    repeatMode: MOVEMENT_REPEAT_MODES.LOOP,
    endBehavior: MOVEMENT_END_BEHAVIORS.HOLD,
  };
}

export function insertMovementWaypoint(value, index, position, fallbackPosition = {}) {
  const config = normalizeMovementConfig(value, fallbackPosition);
  const waypoints = [...config.waypoints];
  waypoints.splice(Math.min(Math.max(1, Number(index) || waypoints.length), waypoints.length), 0, point(position, {}, createWaypointId()));
  return { ...config, enabled: true, waypoints };
}

export function appendMovementWaypoint(value, position, fallbackPosition = {}) {
  const config = normalizeMovementConfig(value, fallbackPosition);
  return insertMovementWaypoint(config, config.waypoints.length, position, fallbackPosition);
}

export function changeMovementWaypoint(value, waypointId, changes) {
  const config = normalizeMovementConfig(value);
  return {
    ...config,
    enabled: true,
    waypoints: config.waypoints.map((waypoint) => waypoint.id === waypointId ? point({ ...waypoint, ...changes }, waypoint, waypoint.id) : waypoint),
  };
}

export function removeMovementWaypoint(value, waypointId) {
  const config = normalizeMovementConfig(value);
  if (config.waypoints.length <= 2) return { config, removed: false };
  return {
    config: { ...config, enabled: true, waypoints: config.waypoints.filter((waypoint) => waypoint.id !== waypointId) },
    removed: config.waypoints.some((waypoint) => waypoint.id === waypointId),
  };
}

export function normalizeMovementConfig(value, position = {}) {
  const defaults = {
    enabled: false,
    pathType: MOVEMENT_PATH_TYPES.LINEAR,
    waypoints: defaultWaypoints(position),
    startTime: 0,
    speed: 1.4,
    waitTime: 0,
    repeatMode: MOVEMENT_REPEAT_MODES.LOOP,
    endBehavior: MOVEMENT_END_BEHAVIORS.HOLD,
  };
  const sourceWaypoints = Array.isArray(value?.waypoints) && value.waypoints.length
    ? value.waypoints
    : defaults.waypoints;
  const waypoints = sourceWaypoints.map((waypoint, index) => point(
    waypoint,
    defaults.waypoints[Math.min(index, defaults.waypoints.length - 1)],
    `WAYPOINT_FALLBACK_${index}`,
  ));
  return {
    ...defaults,
    ...value,
    enabled: Boolean(value?.enabled),
    pathType: Object.values(MOVEMENT_PATH_TYPES).includes(value?.pathType) ? value.pathType : defaults.pathType,
    repeatMode: Object.values(MOVEMENT_REPEAT_MODES).includes(value?.repeatMode) ? value.repeatMode : defaults.repeatMode,
    endBehavior: Object.values(MOVEMENT_END_BEHAVIORS).includes(value?.endBehavior) ? value.endBehavior : defaults.endBehavior,
    startTime: Math.max(0, finite(value?.startTime, defaults.startTime)),
    speed: Math.max(0.05, finite(value?.speed, defaults.speed)),
    waitTime: Math.max(0, finite(value?.waitTime, defaults.waitTime)),
    waypoints,
  };
}

function segmentLength(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y, right.z - left.z);
}

export function compileMovementConfig(value, position = {}) {
  if (value?.[COMPILED_MOVEMENT]) return value;
  const config = normalizeMovementConfig(value, position);
  let pathLength = 0;
  let movementDuration = 0;
  let waitDuration = 0;
  const segments = [];
  for (let index = 1; index < config.waypoints.length; index += 1) {
    const from = config.waypoints[index - 1];
    const to = config.waypoints[index];
    const length = segmentLength(from, to);
    const wait = Math.max(0, finite(from.waitTime) + config.waitTime);
    const duration = length > 0 ? length / config.speed : 0;
    segments.push({ from, to, length, wait, duration, startDistance: pathLength });
    pathLength += length;
    movementDuration += duration;
    waitDuration += wait;
  }
  const activeDuration = Math.max(0.01, movementDuration + waitDuration);
  return Object.assign(config, {
    [COMPILED_MOVEMENT]: true,
    segments,
    pathLength,
    activeDuration,
    duration: config.startTime + activeDuration,
  });
}

function catmullCoordinate(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function sampleCurvePosition(points, ratio) {
  if (points.length < 2) return { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, z: points[0]?.z ?? 0 };
  const scaled = Math.min(points.length - 1, Math.max(0, ratio) * (points.length - 1));
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const t = scaled - index;
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[index + 1];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  return {
    x: catmullCoordinate(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullCoordinate(p0.y, p1.y, p2.y, p3.y, t),
    z: catmullCoordinate(p0.z, p1.z, p2.z, p3.z, t),
  };
}

export function getMovementPathLength(value) {
  return compileMovementConfig(value).pathLength;
}

export function getMovementDuration(value) {
  return compileMovementConfig(value).duration;
}

export function validateMovementConfig(value) {
  if (!Array.isArray(value?.waypoints) || value.waypoints.length < 2) {
    return { valid: false, code: "PATH_MISSING", message: "경유점이 2개 이상 필요합니다." };
  }
  if (value.waypoints.some((waypoint) => ![waypoint?.x, waypoint?.y, waypoint?.z].every((coordinate) => Number.isFinite(Number(coordinate))))) {
    return { valid: false, code: "INVALID_POINT", message: "유효하지 않은 경유점 좌표가 있습니다." };
  }
  const speed = Number(value.speed);
  if (!Number.isFinite(speed) || speed <= 0) {
    return { valid: false, code: "INVALID_SPEED", message: "이동 속도는 0보다 커야 합니다." };
  }
  const startTime = Number(value.startTime);
  const waitTime = Number(value.waitTime);
  if (!Number.isFinite(startTime) || startTime < 0 || !Number.isFinite(waitTime) || waitTime < 0) {
    return { valid: false, code: "INVALID_TIME", message: "시작 시간과 대기 시간은 0 이상의 유효한 값이어야 합니다." };
  }
  const compiled = compileMovementConfig(value);
  if (!Number.isFinite(compiled.pathLength) || compiled.pathLength <= 1e-5) {
    return { valid: false, code: "ZERO_LENGTH_PATH", message: "경로의 시작점과 종료점이 같은 위치입니다." };
  }
  if (!Number.isFinite(compiled.duration) || compiled.duration <= 0) {
    return { valid: false, code: "INVALID_DURATION", message: "경로 재생 시간을 계산할 수 없습니다." };
  }
  return { valid: true, code: null, message: "" };
}

function stationarySample(config, phase = "WAITING") {
  const waypoint = config.waypoints[0] ?? { x: 0, y: 0, z: 0 };
  return {
    position: { x: waypoint.x, y: waypoint.y, z: waypoint.z },
    tangent: { x: 0, y: 0, z: -1 },
    distance: 0,
    phase,
  };
}

function getPolylineSample(config, elapsed) {
  if (!config.segments.length) return stationarySample(config, elapsed > 0 ? "FINISHED" : "WAITING");
  let remaining = Math.max(0, finite(elapsed));
  for (let index = 0; index < config.segments.length; index += 1) {
    const segment = config.segments[index];
    const { from, to, length, wait, duration, startDistance } = segment;
    if (remaining < wait) {
      return {
        position: { x: from.x, y: from.y, z: from.z },
        tangent: { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z },
        distance: startDistance,
        phase: "WAITING",
      };
    }
    remaining -= wait;
    if (remaining <= duration || index === config.segments.length - 1) {
      const t = duration > 0 ? Math.min(1, remaining / duration) : 1;
      if (config.pathType === MOVEMENT_PATH_TYPES.CURVE && config.waypoints.length >= 3) {
        const distance = startDistance + length * t;
        const ratio = config.pathLength > 0 ? distance / config.pathLength : 0;
        const position = sampleCurvePosition(config.waypoints, ratio);
        const before = sampleCurvePosition(config.waypoints, Math.max(0, ratio - 0.002));
        const after = sampleCurvePosition(config.waypoints, Math.min(1, ratio + 0.002));
        return {
          position,
          tangent: { x: after.x - before.x, y: after.y - before.y, z: after.z - before.z },
          distance,
          phase: t >= 1 ? "FINISHED" : "MOVING",
        };
      }
      return {
        position: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t },
        tangent: { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z },
        distance: startDistance + length * t,
        phase: t >= 1 ? "FINISHED" : length > 0 ? "MOVING" : "WAITING",
      };
    }
    remaining -= duration;
  }
  const last = config.waypoints.at(-1);
  return {
    position: { x: last.x, y: last.y, z: last.z },
    tangent: { x: 0, y: 0, z: -1 },
    distance: config.pathLength,
    phase: "FINISHED",
  };
}

export function sampleMovementPath(value, timelineTime) {
  const config = compileMovementConfig(value);
  let elapsed = finite(timelineTime) - config.startTime;
  if (elapsed <= 0) return { ...getPolylineSample(config, 0), phase: "WAITING", visible: true };
  let reverse = false;
  if (config.repeatMode === MOVEMENT_REPEAT_MODES.LOOP) elapsed %= config.activeDuration;
  else if (config.repeatMode === MOVEMENT_REPEAT_MODES.PING_PONG) {
    const cycle = Math.floor(elapsed / config.activeDuration);
    elapsed %= config.activeDuration;
    reverse = cycle % 2 === 1;
    if (reverse) elapsed = config.activeDuration - elapsed;
  } else if (elapsed >= config.activeDuration) {
    const completed = getPolylineSample(config, config.activeDuration);
    if (config.endBehavior === MOVEMENT_END_BEHAVIORS.RESET) return { ...getPolylineSample(config, 0), phase: "FINISHED", visible: true };
    return { ...completed, phase: "FINISHED", visible: config.endBehavior !== MOVEMENT_END_BEHAVIORS.HIDE };
  }
  const sample = getPolylineSample(config, elapsed);
  return reverse
    ? {
        ...sample,
        tangent: { x: -sample.tangent.x, y: -sample.tangent.y, z: -sample.tangent.z },
        distance: Math.max(0, config.pathLength - sample.distance),
        visible: true,
      }
    : { ...sample, visible: true };
}

export function sanitizeMovementDelta(delta) {
  return Math.min(MAX_MOVEMENT_FRAME_DELTA, Math.max(0, finite(delta)));
}

export function advanceMovementClock(currentTime, delta, status) {
  const time = Math.max(0, finite(currentTime));
  return status === MOVEMENT_PLAYBACK_STATES.PLAYING ? time + sanitizeMovementDelta(delta) : time;
}
