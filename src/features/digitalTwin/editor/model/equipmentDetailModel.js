export const EQUIPMENT_DETAIL_VERSION = 1;

export const ASSET_TYPES = Object.freeze({ OBJ: "OBJ", PLY: "PLY", IMAGE: "IMAGE", TEXTURE: "TEXTURE" });
export const ASSET_SOURCE_TYPES = Object.freeze({ PROJECT: "PROJECT", UPLOAD: "UPLOAD", SERVER_KEY: "SERVER_KEY", URL: "URL" });
export const ASSET_USAGE_TYPES = Object.freeze({ MODEL: "MODEL", POINT_CLOUD: "POINT_CLOUD", REFERENCE_IMAGE: "REFERENCE_IMAGE", TEXTURE: "TEXTURE", CAMERA_FRAME: "CAMERA_FRAME" });
export const EQUIPMENT_DISPLAY_MODES = Object.freeze({ PROXY: "PROXY", ACTUAL: "ACTUAL", COMPARE: "COMPARE", POINT_CLOUD: "POINT_CLOUD" });
export const ALIGNMENT_UNITS = Object.freeze({ MM: "MM", CM: "CM", M: "M" });

export const SENSOR_CAPABILITIES = Object.freeze({ ULTRASONIC: "초음파", THERMAL: "열화상", VISION: "비전 카메라", GAUGE: "게이지 감지", SWITCH: "스위치 감지" });
export function getSensorCapabilities(sensor = {}) {
  const values = Array.isArray(sensor.capabilities) ? sensor.capabilities : [sensor.deviceKind ?? ((sensor.sensorType ?? sensor.sourceType) === "CAMERA" ? "VISION" : "GENERIC")];
  return [...new Set(values.map((value) => value === "ULTRASOUND" ? "ULTRASONIC" : value).filter((value) => Object.hasOwn(SENSOR_CAPABILITIES, value)))];
}
export function sensorCapabilityLabel(sensor) {
  return getSensorCapabilities(sensor).map((value) => SENSOR_CAPABILITIES[value]).join(" · ") || "기능 미지정";
}
export function sensorHasImaging(sensor) {
  return getSensorCapabilities(sensor).some((value) => ["VISION", "THERMAL"].includes(value));
}

export const CABINET_SAMPLE_ASSETS = Object.freeze([
  { assetId: "CABINET_SCAN_OBJ", name: "Scan.obj", sourceKey: "/cabinet_3d_sample/Scan.obj", assetType: ASSET_TYPES.OBJ, usageType: ASSET_USAGE_TYPES.MODEL, relatedSourceKey: "/cabinet_3d_sample/Scan.mtl" },
  { assetId: "CABINET_SCAN_PLY", name: "Scan.ply", sourceKey: "/cabinet_3d_sample/Scan.ply", assetType: ASSET_TYPES.PLY, usageType: ASSET_USAGE_TYPES.POINT_CLOUD },
  { assetId: "CABINET_SCAN_IMAGE", name: "Scan.jpg", sourceKey: "/cabinet_3d_sample/Scan.jpg", assetType: ASSET_TYPES.IMAGE, usageType: ASSET_USAGE_TYPES.REFERENCE_IMAGE },
  { assetId: "CABINET_SCAN_TEXTURE", name: "Scan.jpg 텍스처", sourceKey: "/cabinet_3d_sample/Scan.jpg", assetType: ASSET_TYPES.TEXTURE, usageType: ASSET_USAGE_TYPES.TEXTURE },
]);

export function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createAlignmentTransform(source = {}) {
  return {
    unit: Object.values(ALIGNMENT_UNITS).includes(source.unit) ? source.unit : ALIGNMENT_UNITS.MM,
    position: { x: 0, y: 0, z: 0, ...source.position },
    rotation: { x: 0, y: 0, z: 0, ...source.rotation },
    scale: { x: 1, y: 1, z: 1, ...source.scale },
    autoCentered: source.autoCentered ?? true,
    floorAligned: source.floorAligned ?? true,
    fitToProxy: source.fitToProxy ?? true,
    fitDimension: ["WIDTH", "HEIGHT", "DEPTH", "EXACT"].includes(source.fitDimension) ? source.fitDimension : "CONTAIN",
    targetDimensions: Object.fromEntries(Object.entries(source.targetDimensions ?? {}).filter(([key, value]) => ["width", "height", "depth"].includes(key) && Number.isFinite(value) && value > 0)),
    completed: source.completed ?? false,
  };
}

export function createEquipmentAssetBinding(equipmentId, asset, source = {}) {
  return {
    id: source.id ?? createId("EQUIPMENT_ASSET_BINDING"),
    equipmentId,
    assetId: source.assetId ?? asset.assetId ?? createId("ASSET"),
    name: source.name ?? asset.name ?? "설비 자산",
    sourceType: source.sourceType ?? ASSET_SOURCE_TYPES.PROJECT,
    sourceKey: source.sourceKey ?? asset.sourceKey ?? "",
    relatedSourceKey: source.relatedSourceKey ?? asset.relatedSourceKey ?? null,
    textureSourceKey: source.textureSourceKey ?? asset.textureSourceKey ?? null,
    assetType: source.assetType ?? asset.assetType ?? ASSET_TYPES.OBJ,
    usageType: source.usageType ?? asset.usageType ?? ASSET_USAGE_TYPES.MODEL,
    alignmentTransform: createAlignmentTransform(source.alignmentTransform),
    displayMode: source.displayMode ?? EQUIPMENT_DISPLAY_MODES.PROXY,
    includeProxy: source.includeProxy === true,
    status: source.status ?? "READY",
    errorMessage: source.errorMessage ?? "",
  };
}

export function createCabinetSampleBindings(equipmentId) {
  return CABINET_SAMPLE_ASSETS.map((asset) => createEquipmentAssetBinding(equipmentId, asset));
}

export function isCabinetEquipment(equipment) {
  const id = equipment?.shapeTemplateId ?? equipment?.sourceTemplateId ?? "";
  return id.includes("CABINET") || ["RACK", "SERVER_RACK", "CONTROL_PANEL", "DISTRIBUTION_PANEL", "SWITCHBOARD", "MCC_PANEL"].includes(id);
}

export function normalizeObservationPoint(point = {}) {
  const measurements = (point.measurements ?? [{
    id: `${point.id ?? "roi"}-value`, name: point.name ?? "온도", metric: point.metric ?? "TEMPERATURE", unit: point.unit ?? "°C",
    sensorId: point.sensorIds?.[0] ?? point.sourceDeviceId ?? "", visible: true, previewValue: point.previewValue,
    rules: [{ operator: "gte", threshold: point.warningRange?.min ?? 60, severity: "WARNING" }, { operator: "gte", threshold: point.dangerRange?.min ?? 80, severity: "DANGER" }],
  }]).map((item) => ({ ...item, id: item.id ?? createId("ROI_VALUE"), visible: item.visible !== false, rules: item.rules ?? [] }));
  return {
    ...point,
    id: point.id ?? createId("OBSERVATION_POINT"),
    equipmentId: point.equipmentId ?? null,
    name: point.name ?? "관측 영역",
    geometryType: "SPHERE",
    revision: Math.max(0, Math.floor(Number(point.revision) || 0)),
    radius: Math.max(.01, Math.min(100, Number(point.radius) || .15)),
    opacity: Math.max(.05, Math.min(.8, Number.isFinite(Number(point.opacity)) ? Number(point.opacity) : .25)),
    measurements,
    localPosition: { x: 0, y: 0.5, z: 0, ...point.localPosition },
    targetNormal: { x: 0, y: 0, z: 1, ...point.targetNormal },
    sensorIds: [...new Set(measurements.map((item) => item.sensorId).filter(Boolean))],
  };
}

export function normalizeSensorBinding(device = {}) {
  const equipmentIds = device.equipmentIds ?? (device.equipmentId ? [device.equipmentId] : []);
  const capabilities = getSensorCapabilities(device);
  const sensorType = capabilities.some((value) => ["VISION", "THERMAL"].includes(value)) ? "CAMERA" : "SENSOR";
  return {
    ...device,
    id: device.id ?? createId("SENSOR_BINDING"),
    equipmentIds,
    serverKey: device.serverKey ?? device.identifier ?? "",
    serialNumber: device.serialNumber ?? "",
    serverSensorId: device.serverSensorId ?? null,
    capabilities,
    deviceKind: capabilities[0] ?? "GENERIC",
    sensorType,
    sourceType: sensorType,
    mountMode: device.mountMode ?? "WORLD",
    markerDiameter: getSensorMarkerDiameter(device),
    position: { x: 2, y: 2, z: 2, ...device.position },
    rotation: { x: 0, y: 0, z: 0, ...device.rotation },
    fieldOfView: Number(device.fieldOfView ?? device.fov ?? 50),
    aspectRatio: Number(device.aspectRatio ?? 16 / 9),
    near: Number(device.near ?? 0.1),
    far: Number(device.far ?? device.range ?? 10),
    observationPointIds: device.observationPointIds ?? [],
  };
}

export function getSensorMarkerDiameter(sensor = {}) {
  return Number.isFinite(sensor.markerDiameter) ? Math.max(0.005, Math.min(2, sensor.markerDiameter)) : 0.05;
}

export function normalizeAssetBinding(binding = {}) {
  return createEquipmentAssetBinding(binding.equipmentId, binding, binding);
}

export function normalizeEquipmentDetailSnapshot(snapshot = {}) {
  return {
    equipmentAssetBindings: (snapshot.equipmentAssetBindings ?? []).map(normalizeAssetBinding),
    sensorBindings: (snapshot.sensorBindings ?? snapshot.monitoringDevices ?? []).map(normalizeSensorBinding),
    observationPoints: (snapshot.observationPoints ?? []).map(normalizeObservationPoint),
    serverBindings: snapshot.serverBindings ?? snapshot.monitoringBindings ?? [],
  };
}

export function unitScale(unit) {
  if (unit === ALIGNMENT_UNITS.MM) return 0.001;
  if (unit === ALIGNMENT_UNITS.CM) return 0.01;
  return 1;
}
