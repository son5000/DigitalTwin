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
    displayMetrics: ["temperature.max", "temperature.min"], rules: [], monitoringEnabled: false, revision: 0 };
}

export function validateRoi(roi) {
  if (!roi?.id || !roi.equipmentId || !roi.name?.trim()) throw new Error("ROI 이름과 대상 설비를 확인하세요.");
  if (!Number.isInteger(roi.revision) || roi.revision < 0) throw new Error("ROI 변경 버전을 확인하세요.");
  const surface = roi.surface;
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
