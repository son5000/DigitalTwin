import { Vector3 } from "three";
import { normalizeSensorProjection, sensorImageTransform } from "./sensorImageTransform.js";
import { resolveImageSurface } from "./textureSurfaceMapping.js";
import { projectPoint } from "./imageHomography.js";
import { getSensorCapabilities } from "./equipmentDetailModel.js";
import { imageAnalysisTransform, imageRegionCoordinates } from "./imageAnalysisContract.js";

export const isImageObservationMetric = (metric) => metric?.startsWith("vision.") || metric === "VIDEO";
export const hasImageObservation = (point) => point?.measurements?.some((item) => isImageObservationMetric(item.metric));
export function visionObservationSensors(sensors, equipmentId) {
  return sensors.filter((sensor) => sensor.equipmentIds?.includes(equipmentId)
    && getSensorCapabilities(sensor).includes("VISION")
    && normalizeSensorProjection(sensor.textureProjection).enabled
    && normalizeSensorProjection(sensor.textureProjection).opacity > 0
    && normalizeSensorProjection(sensor.textureProjection).kind === "VISION"
    && (sensor.textureProjection?.equipmentId ?? sensor.equipmentIds?.[0]) === equipmentId);
}
const inUnit = (point) => point?.length === 2 && point.every((n) => Number.isFinite(n) && n >= -1e-7 && n <= 1 + 1e-7);
function visibleUv(sourceUv, transform) {
  if (!inUnit(sourceUv)) return false;
  const target = projectPoint(transform.sourceUvToTargetUv, sourceUv);
  if (!inUnit(target)) return false;
  const crop = projectPoint(transform.targetUvToCropUv, target);
  if (!inUnit(crop)) return false;
  return !transform.perspective.enabled || transform.perspective.source.every((a, i, quad) => {
    const b = quad[(i + 1) % 4];
    return (b[0] - a[0]) * (crop[1] - a[1]) - (b[1] - a[1]) * (crop[0] - a[0]) <= 1e-7;
  });
}
export function imagePointUv(position, equipment, sensor) {
  const surface = resolveImageSurface(equipment, normalizeSensorProjection(sensor.textureProjection));
  const delta = new Vector3(position.x, position.y, position.z).sub(new Vector3(...surface.origin));
  const target = [delta.dot(new Vector3(...surface.right)) / surface.width, delta.dot(new Vector3(...surface.up)) / surface.height];
  const transform = sensorImageTransform(sensor), source = projectPoint(transform.targetUvToSourceUv, target);
  return inUnit(target) && visibleUv(source, transform) ? source : null;
}

// Canonical ROI coordinates belong to the ORIGINAL image, top-left origin.
// All world vertices and processed-image coordinates are derived, never anchors.
export function resolveImageObservation(point, equipment, sensors) {
  if (!point.imageBinding) return point;
  const binding = point.imageBinding;
  const sensor = visionObservationSensors(sensors, equipment?.id).find((s) => s.id === binding.sensorId);
  const invalid = (message) => ({ ...point, imageAnalysis: null, imageBindingIssue: message });
  if (!sensor) return invalid("연결된 비전 텍스처를 활성화하거나 카메라를 다시 연결하세요.");
  if (binding.originalImage?.serverSensorId && binding.originalImage.serverSensorId !== sensor.serverSensorId) return invalid("비전 카메라가 변경되었습니다. 기준 이미지를 다시 등록하세요.");
  const r = binding.sourceRect;
  if (!r || ![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0) return invalid("원본 이미지의 영역 좌표와 크기를 확인하세요.");
  const sourceUv = [[r.x, 1-r.y], [r.x+r.width, 1-r.y], [r.x+r.width, 1-r.y-r.height], [r.x, 1-r.y-r.height]];
  const transform = sensorImageTransform({ ...sensor, resolution:binding.originalImage ?? sensor.resolution });
  if (binding.originalImage) transform.source = { ...transform.source, url:binding.originalImage.sourceUrl,
    textureAssetId:binding.originalImage.textureAssetId, width:binding.originalImage.width, height:binding.originalImage.height,
    measuredAt:binding.originalImage.measuredAt ?? null, loadedAt:binding.originalImage.capturedAt ?? null };
  if (!sourceUv.every((uv) => visibleUv(uv, transform))) return invalid("영역이 이미지의 표시·자르기 범위를 벗어났습니다. 원본 이미지 영역을 조정하세요.");
  const p = normalizeSensorProjection(sensor.textureProjection), surface = resolveImageSurface(equipment, p);
  const processedUv = sourceUv.map((uv) => projectPoint(transform.sourceUvToTargetUv, uv));
  const vertices = processedUv.map(([u,v]) => new Vector3(...surface.origin)
    .addScaledVector(new Vector3(...surface.right), u * surface.width)
    .addScaledVector(new Vector3(...surface.up), v * surface.height).toArray());
  const center = vertices.reduce((sum, v) => sum.add(new Vector3(...v)), new Vector3()).multiplyScalar(.25);
  const original = binding.originalImage;
  const sourceNormalized = sourceUv.map(([u,v]) => [u,1-v]);
  return { ...point, geometryType: "PLANE", representation: p.target, localPosition: { x:center.x,y:center.y,z:center.z },
    planeWidth: new Vector3(...vertices[0]).distanceTo(new Vector3(...vertices[1])),
    planeHeight: new Vector3(...vertices[0]).distanceTo(new Vector3(...vertices[3])),
    targetNormal: Object.fromEntries(["x","y","z"].map((axis,i)=>[axis,surface.normal[i]])), planeRotation: 0, imageBindingIssue: "",
    imageAnalysis: { schemaVersion: 2, sensorBindingId: sensor.id, serverSensorId: sensor.serverSensorId ?? null,
      originalImage: original ?? null, imageTransform: imageAnalysisTransform(sensor, original),
      target: { equipmentId: equipment.id, representation: p.target, surfaceId: p.surfaceId, meshPath:p.meshPath, surface },
      cornerOrder: ["TOP_LEFT","TOP_RIGHT","BOTTOM_RIGHT","BOTTOM_LEFT"],
      source: imageRegionCoordinates(sourceNormalized, original?.width, original?.height),
      processed: imageRegionCoordinates(processedUv.map(([x,y]) => [x,1-y]), original?.width, original?.height),
      world: { space:"EQUIPMENT_MODEL_LOCAL", unit:"m", vertices },
    } };
}

export function createImageObservationBinding(position, equipment, sensor, originalImage) {
  const uv = imagePointUv(position, equipment, sensor);
  if (!uv) throw new Error("선택한 비전 이미지가 표시된 부분 안에 영역을 지정하세요.");
  // Shrink near a crop/perspective boundary instead of creating an invalid ROI.
  for (const size of [.1, .05, .02, .01, .002]) {
    const imageBinding = { schemaVersion:1, sensorId:sensor.id, originalImage,
      sourceRect:{ x:uv[0]-size/2, y:1-uv[1]-size/2, width:size, height:size } };
    const result = resolveImageObservation({ imageBinding }, equipment, [sensor]);
    if (!result.imageBindingIssue) return imageBinding;
  }
  throw new Error("이미지 가장자리에서 조금 안쪽을 선택하세요.");
}

// Move in world space, but persist the delta in the original image's coordinates.
export function moveImageObservation(point, position, equipment, sensors) {
  const sensor = sensors.find((item) => item.id === point.imageBinding?.sensorId);
  if (!sensor) return null;
  const resolved = resolveImageObservation(point, equipment, sensors);
  if (resolved.imageBindingIssue) return null;
  const before = imagePointUv(resolved.localPosition, equipment, sensor);
  const after = imagePointUv(position, equipment, sensor);
  if (!before || !after) return null;
  const r = point.imageBinding.sourceRect;
  const imageBinding = { ...point.imageBinding, sourceRect: { ...r, x: r.x + after[0] - before[0], y: r.y - after[1] + before[1] } };
  return resolveImageObservation({ ...point, imageBinding }, equipment, sensors).imageBindingIssue ? null : imageBinding;
}

export function imageObservationIssue(point, equipment, sensors) {
  if (!hasImageObservation(point)) return "";
  if (point.measurements.length !== 1) return "영상 분석 항목은 영역마다 하나만 선택하세요.";
  if (!point.imageBinding || point.geometryType !== "PLANE") return "영상 분석 영역을 비전 텍스처 위에 다시 지정하세요.";
  if (point.measurements[0].sensorId !== point.imageBinding.sensorId) return "관측 센서와 비전 이미지의 카메라가 일치하지 않습니다.";
  if (!point.imageBinding.originalImage?.textureAssetId) return "분석 기준으로 사용할 원본 이미지를 등록하세요.";
  return resolveImageObservation(point,equipment,sensors).imageBindingIssue || "";
}
