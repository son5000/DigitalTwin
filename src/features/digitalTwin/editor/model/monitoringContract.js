import { getSensorMountPose } from "./equipmentEnclosure.js";
import { getSensorCapabilities } from "./equipmentDetailModel.js";

export const MONITORING_MODES = { MODEL: "모델", VISION: "비전", THERMAL: "열화상", ULTRASOUND: "초음파" };

export function mediaUrl(value, demo = false) {
  if (typeof value !== "string") return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (demo && /^data:image\/svg\+xml[,;]/.test(value)) return value;
  return "";
}

export function modelReference(equipment, assets = []) {
  const asset = assets.filter((item) => item.equipmentId === equipment?.id && ["OBJ", "PLY"].includes(item.assetType)).at(-1);
  const identity = { equipmentId: equipment?.id, templateId: equipment?.shapeTemplateId, customAssetId: equipment?.customAssetId,
    dimensions: equipment?.dimensions, ...(equipment?.enclosure ? { enclosure: equipment.enclosure } : {}), parts: equipment?.parts, assetId: asset?.assetId ?? null, alignment: asset?.alignmentTransform ?? null,
    ...(asset?.includeProxy ? { includeProxy: true } : {}), sourceType: asset?.sourceType, sourceKey: asset?.sourceKey, assetType: asset?.assetType };
  let hash = 2166136261;
  for (const char of JSON.stringify(identity)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return { assetId: asset?.assetId ?? null, version: `geometry-${(hash >>> 0).toString(16)}` };
}

export function calibrationPayload(projectId, equipment, sensor, assets = []) {
  const vector = (value) => ["x", "y", "z"].map((axis) => Number(value?.[axis] ?? 0));
  const mounted = getSensorMountPose(sensor, equipment);
  const mountingIssue = sensor.surfaceMount && (!mounted || mounted.adjusted) ? "부착면과 센서 위치를 다시 확인하세요." : "";
  const payload = { schemaVersion: 1, projectId, equipmentId: equipment.id, sensorId: sensor.serverSensorId,
    serialNumber: sensor.serialNumber, bindingId: sensor.id, capabilities: getSensorCapabilities(sensor), model: modelReference(equipment, assets),
    coordinateSystem: { unit: "m", handedness: "RIGHT", up: "+Y", rotationUnit: "rad", rotationOrder: "XYZ", sensorForward: "-Y", sensorUp: "-Z" },
    pose: { space: sensor.mountMode === "EQUIPMENT" ? "EQUIPMENT_LOCAL" : "WORLD", position: vector(mounted?.position ?? sensor.position), rotation: vector(mounted?.rotation ?? sensor.rotation) },
    ...(sensor.surfaceMount ? { surfaceMount: sensor.surfaceMount, mountingIssue } : {}),
    ...(sensor.textureProjection ? { textureProjection: sensor.textureProjection } : {}),
    equipmentTransform: { position: vector(equipment.position), rotation: vector(equipment.rotation) },
    camera: { fieldOfView: Number(sensor.fieldOfView), aspectRatio: Number(sensor.aspectRatio), near: Number(sensor.near), far: Number(sensor.far),
      intrinsics: sensor.intrinsics ?? null, calibrationId: sensor.intrinsicCalibrationId ?? null, resolution: sensor.resolution ?? null },
    method: "MANUAL", dataSource: sensor.dataSource === "DEMO" ? "DEMO" : "SERVER" };
  return payload;
}

export function validateCalibration(payload) {
  if (payload.mountingIssue) throw new Error(payload.mountingIssue);
  if (!payload.sensorId || !payload.serialNumber || !payload.equipmentId || !payload.projectId) throw new Error("먼저 시리얼 번호로 센서를 조회하세요.");
  if ([...payload.pose.position, ...payload.pose.rotation, ...payload.equipmentTransform.position, ...payload.equipmentTransform.rotation].some((value) => !Number.isFinite(value))) throw new Error("위치와 방향을 올바르게 입력하세요.");
  const { fieldOfView, aspectRatio, near, far } = payload.camera;
  if (![fieldOfView, aspectRatio, near, far].every(Number.isFinite) || fieldOfView < 10 || fieldOfView > 160 || aspectRatio <= 0 || near <= 0 || far <= near) throw new Error("화각은 10~160도, 관측 거리는 근거리보다 크게 입력하세요.");
  return payload;
}

export function isFreshMeasurement(record, now = Date.now()) {
  const time = Date.parse(record?.measuredAt);
  return record?.quality === "GOOD" && Number.isFinite(time) && now - time >= -5000 && now - time <= Math.min(60000, Math.max(1000, record.staleAfterMs || 15000));
}

export function validateTelemetry(input, equipmentId) {
  if (input?.equipmentId !== equipmentId) throw new Error("다른 설비의 관측 응답을 받았습니다.");
  return { ...input, textures: Array.isArray(input.textures) ? input.textures : [], hotspots: Array.isArray(input.hotspots) ? input.hotspots : [],
    readings: Array.isArray(input.readings) ? input.readings : [], alarms: Array.isArray(input.alarms) ? input.alarms : [] };
}

export function downloadMonitoringJson(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
