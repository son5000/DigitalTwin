import { IMAGE_PLANES, normalizeImageSurface } from "./textureSurfaceMapping.js";
import { activeThermalSample, THERMAL_PALETTES } from "./thermalFrame.js";
import { DEFAULT_PERSPECTIVE, IDENTITY_3, UNIT_QUAD, homographyFromQuads, inverse3, multiply3, normalizePerspective, projectPoint } from "./imageHomography.js";

export const VISION_SAMPLE_URL = "/samples/cabinet-vision.jpg";

const number = (value, fallback, min, max) => value !== null && value !== "" && Number.isFinite(Number(value))
  ? Math.max(min, Math.min(max, Number(value))) : fallback;

export const DEFAULT_IMAGE_TRANSFORM = Object.freeze({
  scaleX: 1, scaleY: 1, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0,
  pivotX: .5, pivotY: .5, flipX: false, flipY: false,
  cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1,
  perspective: DEFAULT_PERSPECTIVE,
});

export function normalizeSensorProjection(source = {}) {
  const cropX = number(source.cropX, 0, 0, 1 - 1e-6), cropY = number(source.cropY, 0, 0, 1 - 1e-6);
  return {
    enabled: source.enabled === true,
    kind: source.kind === "THERMAL" ? "THERMAL" : "VISION",
    target: ["ACTUAL", "PROXY", "BOTH"].includes(source.target) ? source.target : "PROXY",
    equipmentId: typeof source.equipmentId === "string" ? source.equipmentId : null,
    surfaceId: typeof source.surfaceId === "string" ? source.surfaceId : "",
    meshPath: typeof source.meshPath === "string" ? source.meshPath : null,
    meshName: typeof source.meshName === "string" ? source.meshName : "",
    imagePlane: Object.hasOwn(IMAGE_PLANES, source.imagePlane) ? source.imagePlane : "FRONT",
    surfaceMapping: normalizeImageSurface(source.surfaceMapping),
    opacity: number(source.opacity, 1, 0, 1),
    scaleX: number(source.scaleX, 1, .01, 100), scaleY: number(source.scaleY, 1, .01, 100),
    zoom: number(source.zoom, 1, .01, 100),
    offsetX: number(source.offsetX, 0, -10, 10), offsetY: number(source.offsetY, 0, -10, 10),
    rotation: number(source.rotation, 0, -3600, 3600),
    pivotX: number(source.pivotX, .5, 0, 1), pivotY: number(source.pivotY, .5, 0, 1),
    flipX: source.flipX === true, flipY: source.flipY === true,
    perspective: normalizePerspective(source.perspective),
    cropX, cropY,
    cropWidth: number(source.cropWidth, 1 - cropX, 1e-6, 1 - cropX),
    cropHeight: number(source.cropHeight, 1 - cropY, 1e-6, 1 - cropY),
    temperatureMin: number(source.temperatureMin, 0, -273.15, 10000),
    temperatureMax: number(source.temperatureMax, 100, -273.14, 10001),
    palette: Object.hasOwn(THERMAL_PALETTES, source.palette) ? source.palette : "SPECTRUM",
  };
}

export function activeVisionSample(sensor) {
  const sample = sensor.projectionSample;
  return sample?.enabled === true && sample.url === VISION_SAMPLE_URL ? sample : null;
}

// All matrices are row-major, multiplying column vectors [u, v, 1].
// UV origin is bottom-left. Positive rotation is counterclockwise in UV space.
export function sensorImageTransform(sensor) {
  const p = normalizeSensorProjection(sensor.textureProjection);
  const angle = p.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const sx = p.scaleX * p.zoom * (p.flipX ? -1 : 1), sy = p.scaleY * p.zoom * (p.flipY ? -1 : 1);
  const a = c / sx, b = s / sx, d = -s / sy, e = c / sy;
  const tx = p.pivotX - a * (p.pivotX + p.offsetX) - b * (p.pivotY + p.offsetY);
  const ty = p.pivotY - d * (p.pivotX + p.offsetX) - e * (p.pivotY + p.offsetY);
  const targetUvToRectifiedUv = [a, b, tx, d, e, ty, 0, 0, 1];
  const rectifiedUvToTargetUv = [c * sx, -s * sy, p.pivotX + p.offsetX - c * sx * p.pivotX + s * sy * p.pivotY,
    s * sx, c * sy, p.pivotY + p.offsetY - s * sx * p.pivotX - c * sy * p.pivotY, 0, 0, 1];
  const perspectiveMatrix = p.perspective.enabled ? homographyFromQuads(p.perspective.source, p.perspective.target) : [...IDENTITY_3];
  const inversePerspective = inverse3(perspectiveMatrix);
  const cropToSource = [p.cropWidth, 0, p.cropX, 0, p.cropHeight, p.cropY, 0, 0, 1];
  const sourceToCrop = [1 / p.cropWidth, 0, -p.cropX / p.cropWidth, 0, 1 / p.cropHeight, -p.cropY / p.cropHeight, 0, 0, 1];
  const targetUvToCropUv = multiply3(inversePerspective, targetUvToRectifiedUv);
  const targetUvToSourceUv = multiply3(cropToSource, targetUvToCropUv);
  const sourceUvToTargetUv = multiply3(multiply3(rectifiedUvToTargetUv, perspectiveMatrix), sourceToCrop);
  const sample = p.kind === "VISION" ? activeVisionSample(sensor) : activeThermalSample(sensor);
  const resolution = sample ?? sensor.resolution;
  const width = number(resolution?.width, null, 1, 100000), height = number(resolution?.height, null, 1, 100000);
  return {
    schemaVersion: 3,
    source: { type: sample ? "SAMPLE" : sensor.dataSource === "DEMO" ? "DEMO" : "SERVER", url: sample?.url ?? sensor.frameUrl ?? null,
      width, height, loadedAt: sample?.loadedAt ?? null, measuredAt: sample ? null : sensor.frameMeasuredAt ?? null },
    coordinates: { origin: "BOTTOM_LEFT", unit: "NORMALIZED_UV", xAxis: "RIGHT", yAxis: "UP",
      targetSpace: p.kind === "VISION" ? "OBJECT_SURFACE" : "SENSOR_PROJECTION",
      rotationUnit: "DEG", positiveRotation: "COUNTERCLOCKWISE", pivotSpace: "RECTIFIED_IMAGE_UV",
      matrixLayout: "ROW_MAJOR", vectorConvention: "COLUMN_VECTOR", homogeneousDivide: "xy / w", pixelOrigin: "TOP_LEFT" },
    order: ["CROP", "PERSPECTIVE", "PIVOT", "FLIP", "AXIS_SCALE", "ZOOM", "ROTATE", "TRANSLATE", p.kind === "VISION" ? "SURFACE_MAP" : "CAMERA_PROJECT"],
    parameters: Object.fromEntries(Object.keys(DEFAULT_IMAGE_TRANSFORM).map((key) => [key, p[key]])),
    effectiveScale: { x: sx, y: sy },
    cropPixels: width && height ? { x: p.cropX * width, y: (1 - p.cropY - p.cropHeight) * height,
      width: p.cropWidth * width, height: p.cropHeight * height } : null,
    targetUvToCropUv, targetUvToSourceUv, sourceUvToTargetUv,
    targetUvToRectifiedUv, rectifiedUvToTargetUv,
    perspective: { ...p.perspective, cornerOrder: ["TOP_LEFT", "TOP_RIGHT", "BOTTOM_RIGHT", "BOTTOM_LEFT"],
      sourceSpace: "CROPPED_IMAGE_UV", targetSpace: "RECTIFIED_IMAGE_UV", matrix: perspectiveMatrix, inverseMatrix: inversePerspective,
      sourcePixels: width && height ? p.perspective.source.map(([u, v]) => [(p.cropX + u * p.cropWidth) * width, (1 - p.cropY - v * p.cropHeight) * height]) : null,
      finalTargetUv: (p.perspective.enabled ? p.perspective.target : UNIT_QUAD).map((point) => projectPoint(rectifiedUvToTargetUv, point)),
      clipping: "DISCARD_OUTSIDE_SOURCE_QUAD_WHEN_ENABLED" },
    clipping: p.kind === "VISION" ? "DISCARD_OUTSIDE_SURFACE_CROP_AND_ENABLED_SOURCE_QUAD; SURFACE_NORMAL_DOT_MIN_0.9" : "DISCARD_OUTSIDE_PROJECTOR_CROP_AND_ENABLED_SOURCE_QUAD; DEPTH_TEST_FROM_SENSOR",
  };
}
