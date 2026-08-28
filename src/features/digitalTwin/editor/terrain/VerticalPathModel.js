import { sampleTerrainElevation } from "./TerrainModel";

export const VERTICAL_PATH_MODES = Object.freeze({
  FOLLOW_TERRAIN: "FOLLOW_TERRAIN",
  FIXED_GRADE: "FIXED_GRADE",
  USER_PATH: "USER_PATH",
  CUT_FILL: "CUT_FILL",
  ELEVATED: "ELEVATED",
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rotateLocalPoint(object, point) {
  const angle = finite(object.rotation?.y);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: finite(object.position?.x) + point.x * cosine + point.z * sine,
    z: finite(object.position?.z) - point.x * sine + point.z * cosine,
  };
}

function getMode(object) {
  const value = object.parameters?.verticalPathMode ?? object.path?.elevationMode;
  return Object.values(VERTICAL_PATH_MODES).includes(value) ? value : VERTICAL_PATH_MODES.FOLLOW_TERRAIN;
}

function verticalCurveElevation(distance, length, startHeight, endHeight, requestedCurveLength) {
  if (length < 0.001) return startHeight;
  const curveLength = clamp(finite(requestedCurveLength, 4), 0, length / 2 - 0.001);
  if (curveLength <= 0.001) return startHeight + (endHeight - startHeight) * distance / length;
  const effectiveGrade = (endHeight - startHeight) / Math.max(0.001, length - curveLength);
  if (distance < curveLength) return startHeight + effectiveGrade * distance * distance / (2 * curveLength);
  if (distance > length - curveLength) {
    const remaining = length - distance;
    return endHeight - effectiveGrade * remaining * remaining / (2 * curveLength);
  }
  return startHeight + effectiveGrade * (distance - curveLength / 2);
}

function sampleControlElevation(mode, startPoint, endPoint, t, fallbackStart, fallbackEnd) {
  if (mode !== VERTICAL_PATH_MODES.USER_PATH) return fallbackStart + (fallbackEnd - fallbackStart) * t;
  const start = finite(startPoint.elevation ?? startPoint.y, fallbackStart);
  const end = finite(endPoint.elevation ?? endPoint.y, fallbackEnd);
  return start + (end - start) * t;
}

export function normalizeVerticalPath(path) {
  const points = Array.isArray(path?.points)
    ? path.points.map((point) => ({
        ...point,
        x: finite(point?.x),
        z: finite(point?.z),
        ...(Number.isFinite(Number(point?.elevation ?? point?.y)) ? { elevation: finite(point.elevation ?? point.y) } : {}),
        curveRadius: Math.max(0, finite(point?.curveRadius, 0)),
      }))
    : [];
  return { ...path, points };
}

export function resolveVerticalPath(object, terrain, terrainFeatures = [], options = {}) {
  const path = normalizeVerticalPath(object.path);
  const mode = getMode(object);
  const sourcePoints = path.points;
  if (sourcePoints.length < 2) return { mode, points: [], segments: [], horizontalLength: 0, startHeight: 0, endHeight: 0 };
  const sourceSegments = sourcePoints.slice(1).map((end, segmentIndex) => {
    const start = sourcePoints[segmentIndex];
    return { start, end, segmentIndex, length: Math.hypot(end.x - start.x, end.z - start.z) };
  }).filter((segment) => segment.length > 0.001);
  const horizontalLength = sourceSegments.reduce((total, segment) => total + segment.length, 0);
  const worldStart = rotateLocalPoint(object, sourcePoints[0]);
  const worldEnd = rotateLocalPoint(object, sourcePoints.at(-1));
  const terrainStart = sampleTerrainElevation(terrain, worldStart.x, worldStart.z, terrainFeatures);
  const terrainEnd = sampleTerrainElevation(terrain, worldEnd.x, worldEnd.z, terrainFeatures);
  const startHeight = finite(object.parameters?.startElevation, sourcePoints[0].elevation ?? terrainStart);
  const endHeight = finite(object.parameters?.endElevation, sourcePoints.at(-1).elevation ?? terrainEnd);
  const verticalCurveLength = Math.max(0, finite(object.parameters?.verticalCurveLength, 4));
  const spacing = clamp(finite(options.sampleSpacing, Math.min(1.25, terrain?.resolution ?? 1.25)), 0.25, 4);
  let accumulated = 0;
  const segments = sourceSegments.map((segment) => {
    const sampleCount = Math.max(1, Math.ceil(segment.length / spacing));
    const samples = [];
    for (let index = 0; index <= sampleCount; index += 1) {
      const t = index / sampleCount;
      const x = segment.start.x + (segment.end.x - segment.start.x) * t;
      const z = segment.start.z + (segment.end.z - segment.start.z) * t;
      const distance = accumulated + segment.length * t;
      const world = rotateLocalPoint(object, { x, z });
      const terrainHeight = sampleTerrainElevation(terrain, world.x, world.z, terrainFeatures);
      let elevation = terrainHeight;
      if ([VERTICAL_PATH_MODES.FIXED_GRADE, VERTICAL_PATH_MODES.CUT_FILL, VERTICAL_PATH_MODES.ELEVATED].includes(mode)) {
        elevation = verticalCurveElevation(distance, horizontalLength, startHeight, endHeight, verticalCurveLength);
      } else if (mode === VERTICAL_PATH_MODES.USER_PATH) {
        const segmentStartDistance = distance - segment.length * t;
        const fallbackStart = startHeight + (endHeight - startHeight) * (horizontalLength > 0 ? segmentStartDistance / horizontalLength : 0);
        const fallbackEnd = startHeight + (endHeight - startHeight) * (horizontalLength > 0 ? (segmentStartDistance + segment.length) / horizontalLength : 1);
        elevation = sampleControlElevation(mode, segment.start, segment.end, t, fallbackStart, fallbackEnd);
      }
      elevation += finite(object.parameters?.terrainClearance, 0);
      samples.push({
        x,
        y: elevation - finite(object.position?.y),
        z,
        elevation,
        terrainElevation: terrainHeight,
        distance,
        segmentDistance: segment.length * t,
        segmentIndex: segment.segmentIndex,
      });
    }
    accumulated += segment.length;
    return { ...segment, samples };
  });
  const points = segments.flatMap((segment, index) => index === 0 ? segment.samples : segment.samples.slice(1));
  const resolvedStart = points[0]?.elevation ?? 0;
  const resolvedEnd = points.at(-1)?.elevation ?? resolvedStart;
  const heightDifference = resolvedEnd - resolvedStart;
  return {
    mode,
    points,
    segments,
    horizontalLength,
    startHeight: resolvedStart,
    endHeight: resolvedEnd,
    heightDifference,
    gradePercent: horizontalLength > 0 ? heightDifference / horizontalLength * 100 : 0,
    gradeAngle: horizontalLength > 0 ? Math.atan2(heightDifference, horizontalLength) * 180 / Math.PI : 0,
    verticalCurveLength,
  };
}

export function getVerticalPathMetrics(object, terrain, terrainFeatures = []) {
  const resolved = resolveVerticalPath(object, terrain, terrainFeatures);
  return {
    mode: resolved.mode,
    startHeight: resolved.startHeight,
    endHeight: resolved.endHeight,
    heightDifference: resolved.heightDifference,
    horizontalLength: resolved.horizontalLength,
    gradePercent: resolved.gradePercent,
    gradeAngle: resolved.gradeAngle,
    verticalCurveLength: resolved.verticalCurveLength,
  };
}

export function getRecommendedGradeLimit(profile) {
  if (profile === "WALKWAY") return 8.33;
  if (profile === "OUTDOOR_RAMP") return 12.5;
  return 12;
}
