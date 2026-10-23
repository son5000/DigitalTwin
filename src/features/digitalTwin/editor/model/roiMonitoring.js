import { getEquipmentCoordinateFrame, mapSurfaceCoordinates, validateCoordinateFrame } from "./equipmentCoordinateFrame.js";

export function roiToReferencePayload(roi, equipment) {
  const coordinateFrame = getEquipmentCoordinateFrame(equipment);
  if (!coordinateFrame) return roi;
  validateCoordinateFrame(coordinateFrame, roi.equipmentId);
  const { observationPoint: _point, ...record } = roi;
  void _point;
  return { ...record, schemaVersion: 2, coordinateFrame, surface: mapSurfaceCoordinates(roi.surface, coordinateFrame) };
}

export function roiFromReferencePayload(roi) {
  if (!roi?.coordinateFrame) return roi;
  validateCoordinateFrame(roi.coordinateFrame, roi.equipmentId);
  const { coordinateFrame, schemaVersion: _version, ...record } = roi;
  void _version;
  return { ...record, surface: mapSurfaceCoordinates(roi.surface, coordinateFrame, false) };
}

export const ROI_METRICS = Object.freeze([
  { id: "temperature.max", label: "최고 온도", unit: "℃" },
  { id: "temperature.min", label: "최저 온도", unit: "℃" },
  { id: "temperature.avg", label: "평균 온도", unit: "℃" },
  { id: "ultrasound.db", label: "초음파", unit: "dB" },
  { id: "vision.changePercent", label: "영상 변화율", unit: "%" },
]);

export const ROI_STATUSES = Object.freeze({
  NORMAL: { label: "정상", color: "#438b7c" },
  WARNING: { label: "주의", color: "#bd7418" },
  DANGER: { label: "위험", color: "#d64747" },
  NO_DATA: { label: "데이터 없음", color: "#82909e" },
  IDLE: { label: "조회 전용", color: "#82909e" },
});

export function createSurfaceRoi(equipmentId, surface) {
  return { id: `ROI_${crypto.randomUUID()}`, equipmentId, name: "새 ROI", surface,
    ...(surface.type === "SPHERE" ? { opacity: .25, measurements: ROI_METRICS.slice(0, 2).map((metric) => ({ id: crypto.randomUUID(), name: metric.label, metric: metric.id, unit: metric.unit, sensorId: "", visible: true, rules: [] })) } : {}),
    displayMetrics: ["temperature.max", "temperature.min"], rules: [], monitoringEnabled: false, revision: 0 };
}

export const isSphereRoi = (roi) => roi?.surface?.type === "SPHERE";
export const clampRoiRadius = (radius) => Math.max(.01, Math.min(100, Math.round(radius * 1000) / 1000));

// The editor and viewer use the same equipment-local sphere and measurement IDs.
export function observationPointToRoi(point) {
  return {
    id: point.id, equipmentId: point.equipmentId, name: point.name, revision: point.revision ?? 0,
    surface: { type: "SPHERE", coordinateSpace: "EQUIPMENT_LOCAL", representation: point.representation ?? "BOTH",
      center: [point.localPosition.x, point.localPosition.y, point.localPosition.z], radius: point.radius ?? .15,
      ...(point.model ? { model: point.model } : {}) },
    opacity: point.opacity ?? .25, measurements: point.measurements ?? [], observationPoint: point,
    displayMetrics: [], rules: [], monitoringEnabled: false,
  };
}

export function roiToObservationPoint(roi) {
  const [x, y, z] = roi.surface.center;
  return { ...roi.observationPoint, id: roi.id, equipmentId: roi.equipmentId, name: roi.name, revision: roi.revision,
    geometryType: "SPHERE", localPosition: { x, y, z }, radius: roi.surface.radius, opacity: roi.opacity ?? .25,
    representation: roi.surface.representation, ...(roi.surface.model ? { model: roi.surface.model } : {}), measurements: roi.measurements ?? [],
    sensorIds: [...new Set((roi.measurements ?? []).map((item) => item.sensorId).filter(Boolean))] };
}

export function roiAudioSelection(roi, equipment) {
  const payload = roiToReferencePayload(roi, equipment);
  return { type: "ROI", roiId: roi.id, revision: roi.revision, coordinateSpace: "EQUIPMENT_LOCAL",
    ...(payload.coordinateFrame ? { coordinateFrame: payload.coordinateFrame, schemaVersion: 2 } : {}),
    representation: roi.surface.representation, surface: payload.surface };
}

export function validateRoi(roi) {
  if (!roi?.id || !roi.equipmentId || !roi.name?.trim()) throw new Error("ROI 이름과 대상 설비를 확인하세요.");
  if (!Number.isInteger(roi.revision) || roi.revision < 0) throw new Error("ROI 변경 버전을 확인하세요.");
  const surface = roi.surface;
  if (isSphereRoi(roi)) {
    if (surface.coordinateSpace !== "EQUIPMENT_LOCAL" || !["ACTUAL", "PROXY", "BOTH"].includes(surface.representation)
      || !Array.isArray(surface.center) || surface.center.length !== 3 || !surface.center.every(Number.isFinite)
      || !Number.isFinite(surface.radius) || surface.radius < .01 || surface.radius > 100
      || !Array.isArray(roi.measurements) || roi.measurements.some((item) => !item.id || !item.metric || !Array.isArray(item.rules)
        || item.rules.some((rule) => !["gt", "gte", "lt", "lte"].includes(rule.operator) || !Number.isFinite(rule.threshold) || !["WARNING", "DANGER"].includes(rule.severity)))) {
      throw new Error("관측 영역의 위치, 반경과 측정 항목을 확인하세요.");
    }
    return { ...roi, name: roi.name.trim() };
  }
  if (surface?.coordinateSpace !== "EQUIPMENT_LOCAL" || !["PROXY", "ACTUAL"].includes(surface.representation)
    || !Array.isArray(surface.vertices) || surface.vertices.length < 4 || surface.vertices.length > 1024
    || surface.vertices.some((point) => !Array.isArray(point) || point.length !== 3 || point.some((value) => !Number.isFinite(value)))
    || !Array.isArray(surface.outline) || surface.outline.length < 4 || surface.outline.some((index) => !Number.isInteger(index) || !surface.vertices[index])
    || !Array.isArray(surface.triangles) || !surface.triangles.length || surface.triangles.length % 3
    || surface.triangles.some((index) => !Number.isInteger(index) || !surface.vertices[index])) {
    throw new Error("유효한 설비 표면 위에 ROI를 다시 그려주세요.");
  }
  if (surface.sampleMask !== undefined && (!Array.isArray(surface.sampleMask)
    || surface.sampleMask.length !== surface.vertices.length || surface.sampleMask.some((value) => typeof value !== "boolean")
    || surface.triangles.some((index) => !surface.sampleMask[index]) || surface.missingSurfacePolicy !== "EXCLUDE")) {
    throw new Error("ROI의 빈 공간 제외 정보를 확인하세요.");
  }
  const metricIds = ROI_METRICS.map((metric) => metric.id);
  if (!Array.isArray(roi.displayMetrics) || !roi.displayMetrics.length || roi.displayMetrics.some((id) => !metricIds.includes(id))) {
    throw new Error("표시할 측정값을 하나 이상 선택하세요.");
  }
  if (!Array.isArray(roi.rules) || roi.rules.some((rule) => !metricIds.includes(rule.metric)
    || !["gt", "gte", "lt"].includes(rule.operator) || !["WARNING", "DANGER"].includes(rule.severity)
    || !Number.isFinite(rule.threshold) || !Number.isFinite(rule.durationSeconds) || rule.durationSeconds < 0)) {
    throw new Error("임계치와 지속 시간을 올바르게 입력하세요.");
  }
  if (roi.monitoringEnabled && !roi.rules.length) throw new Error("감시를 사용하려면 임계치를 하나 이상 설정하세요.");
  return { ...roi, name: roi.name.trim(), displayMetrics: [...new Set(roi.displayMetrics)] };
}

// Only timestamped ROI-specific server measurements are accepted. Sensor-wide
// latestValue and editor preview values cannot stand in for a surface reading.
export function getRoiReading(roi, reading, now = Date.now()) {
  const receivedAt = Date.parse(reading?.measuredAt);
  const maxAge = Math.min(300000, Math.max(1000, Number(reading?.staleAfterMs) || 15000));
  const valid = reading?.roiId === roi.id && reading?.equipmentId === roi.equipmentId
    && reading?.revision === roi.revision && Number.isFinite(receivedAt)
    && now - receivedAt >= -5000 && now - receivedAt <= maxAge && reading?.quality === "GOOD";
  const values = Object.fromEntries(ROI_METRICS.map(({ id }) => [id, valid && Number.isFinite(reading?.values?.[id]) ? reading.values[id] : null]));
  const hasData = Object.values(values).some((value) => value !== null);
  const hasRuleData = (roi.rules ?? []).every((rule) => values[rule.metric] !== null && values[rule.metric] !== undefined);
  const status = !hasData ? "NO_DATA" : !roi.monitoringEnabled ? "IDLE"
    : hasRuleData && ["NORMAL", "WARNING", "DANGER"].includes(reading?.status) ? reading.status : "NO_DATA";
  return { values, status, measuredAt: valid ? reading.measuredAt : null, alarm: valid ? reading.alarm ?? null : null };
}

export function viewerLink(projectId, equipmentId, base = window.location.href) {
  const url = new URL("/viewer", base);
  url.searchParams.set("project", projectId);
  if (equipmentId) url.searchParams.set("equipment", equipmentId);
  return url.href;
}
