import { getSensorMountPose } from "./equipmentEnclosure.js";
import { normalizeSensorProjection } from "./sensorImageTransform.js";
import { imageAnalysisTransform } from "./imageAnalysisContract.js";

export const observationTextureKind = (measurements = []) => measurements.some((m) => m.metric?.startsWith("vision.") || m.metric === "VIDEO")
  ? "VISION" : measurements.some((m) => m.metric === "TEMPERATURE") ? "THERMAL" : null;

export function thermalCalibrationKey(sensor, equipment) {
  const pose = getSensorMountPose(sensor, equipment) ?? sensor;
  return JSON.stringify([sensor.serverSensorId, pose.position, pose.rotation, sensor.mountMode,
    sensor.fieldOfView, sensor.aspectRatio, sensor.near, sensor.far, normalizeSensorProjection(sensor.textureProjection)]);
}

export function thermalObservationIssue(point, equipment, sensors) {
  if (!point.measurements?.some((m) => m.metric === "TEMPERATURE")) return "";
  const binding = point.thermalBinding;
  const sensor = sensors.find((s) => s.id === binding?.sensorId && s.equipmentIds?.includes(equipment?.id));
  if (!binding || !sensor) return "열화상 텍스처 위에 영역을 지정해 카메라를 자동 연결하세요.";
  const p = normalizeSensorProjection(sensor.textureProjection);
  if (!p.enabled || p.kind !== "THERMAL" || p.opacity <= 0 || (p.equipmentId ?? sensor.equipmentIds?.[0]) !== equipment?.id)
    return "연결된 열화상 텍스처를 활성화하거나 영역을 다시 지정하세요.";
  if (binding.calibrationKey !== thermalCalibrationKey(sensor, equipment)) return "열화상 카메라 보정이 변경되었습니다. 텍스처 위에 영역을 다시 지정하세요.";
  if (!binding.anchorPosition || ["x", "y", "z"].some((axis) => Math.abs(binding.anchorPosition[axis] - point.localPosition?.[axis]) > 1e-6))
    return "열화상 텍스처 위에서 영역 위치를 다시 지정하세요.";
  if (point.measurements.some((m) => m.metric === "TEMPERATURE" && m.sensorId !== binding.sensorId)) return "온도 영역과 열화상 카메라의 연결을 확인하세요.";
  return "";
}

export function createThermalObservationBinding(hit, equipment, position) {
  const { sensor, frame } = hit;
  const resolution = frame?.temperatureGrid ?? frame?.resolution ?? sensor.resolution;
  const width = resolution?.width ?? null, height = resolution?.height ?? null;
  return { schemaVersion: 1, kind: "THERMAL", sensorId: sensor.id, serverSensorId: sensor.serverSensorId ?? null,
    serialNumber: sensor.serialNumber ?? "", calibrationKey: thermalCalibrationKey(sensor, equipment),
    anchorPosition: { x: position.x, y: position.y, z: position.z }, coordinateSpace: "EQUIPMENT_MODEL_LOCAL",
    representation: hit.representation, source: { origin: "TOP_LEFT", width, height, uv: hit.sourceUv,
      pixel: width && height ? [hit.sourceUv[0] * width, hit.sourceUv[1] * height] : null, measuredAt: frame?.measuredAt ?? null },
    projector: { matrix: hit.projectorMatrix, matrixLayout: "COLUMN_MAJOR", vectorConvention: "COLUMN_VECTOR",
      from: "EQUIPMENT_MODEL_LOCAL", to: "CLIP", homogeneousDivide: "xyz / w; uv=xy*0.5+0.5" },
    imageTransform: imageAnalysisTransform({ ...sensor, resolution: { width, height } }),
    regionPolicy: "ROI_INTERSECT_VISIBLE_THERMAL_SURFACE", missingPixels: "EXCLUDE" };
}

export function bindObservationMeasurements(measurements = [], { imageBinding, thermalBinding } = {}) {
  return measurements.map((m) => ({ ...m, sensorId: m.metric === "ultrasound.db" ? ""
    : m.metric === "TEMPERATURE" ? thermalBinding?.sensorId ?? ""
      : m.metric?.startsWith("vision.") ? imageBinding?.sensorId ?? "" : m.sensorId ?? "" }));
}
