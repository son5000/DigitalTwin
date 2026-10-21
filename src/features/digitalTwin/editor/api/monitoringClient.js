import { validateCalibration, validateTelemetry, mediaUrl } from "../model/monitoringContract.js";
import { validTemperatureGrid } from "../model/sensorProjection.js";

export const monitoringApiBase = (import.meta.env?.VITE_MONITORING_API_BASE || "").replace(/\/$/, "");
export async function monitoringRequest(path, options = {}) {
  if (!monitoringApiBase) throw new Error("관측 서버가 연결되지 않았습니다. 예시 모드로 화면을 확인하거나 연결 구성을 내보낼 수 있습니다.");
  const response = await fetch(`${monitoringApiBase}${path}`, {
    credentials: "same-origin", ...options,
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) throw new Error(response.status === 409 || response.status === 412 ? "다른 사용자가 변경했습니다. 최신 구성을 조회한 뒤 다시 저장하세요."
    : response.status === 401 || response.status === 403 ? "로그인 또는 접근 권한을 확인하세요."
      : response.status === 404 ? "해당 센서 또는 관측 데이터를 찾을 수 없습니다." : `서버 요청에 실패했습니다 (${response.status}).`);
  return response.status === 204 ? null : response.json();
}
export async function lookupSensor(serialNumber, equipmentId, signal) {
  const result = await monitoringRequest(`/sensors/by-serial?${new URLSearchParams({ serialNumber, equipmentId })}`, { signal });
  if (!result?.sensor?.id || result.sensor.serialNumber !== serialNumber) throw new Error("센서 조회 결과를 확인하세요.");
  if (result.sensor.equipmentId && result.sensor.equipmentId !== equipmentId) throw new Error("다른 설비에 연결된 센서입니다.");
  return result.sensor;
}
export async function saveSensorCalibration(payload, revision = 0, signal) {
  validateCalibration(payload);
  if (payload.dataSource === "DEMO") throw new Error("예시 센서는 실제 서버에 등록할 수 없습니다.");
  const result = await monitoringRequest(`/projects/${encodeURIComponent(payload.projectId)}/sensors/${encodeURIComponent(payload.sensorId)}/calibration`, {
    method: "PUT", body: JSON.stringify(payload), headers: { "If-Match": String(revision) }, signal,
  });
  if (!Number.isInteger(result?.revision) || result.revision <= revision) throw new Error("서버의 보정 저장 버전을 확인하세요.");
  return result;
}
export async function getSensorFrame(sensorId, signal, kind) {
  const result = await monitoringRequest(`/sensors/${encodeURIComponent(sensorId)}/frame${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, { signal });
  if (result?.sensorId !== sensorId || (!mediaUrl(result.url) && !validTemperatureGrid(result.temperatureGrid)) || !Number.isFinite(Date.parse(result.measuredAt))) throw new Error("센서 영상 응답 형식을 확인하세요.");
  if (kind && (result.kind ?? (result.temperatureGrid ? "THERMAL" : "VISION")) !== kind) throw new Error("선택한 종류의 센서 영상을 기다리고 있습니다.");
  return result;
}
export const equipmentPath = (projectId, equipmentId) => `/projects/${encodeURIComponent(projectId)}/equipment/${encodeURIComponent(equipmentId)}`;
export async function loadEquipmentTelemetry(projectId, equipmentId, signal) {
  return validateTelemetry(await monitoringRequest(`${equipmentPath(projectId, equipmentId)}/monitoring`, { signal }), equipmentId);
}
export async function requestPointAudio(projectId, equipmentId, selection, processing, signal) {
  const result = await monitoringRequest(`${equipmentPath(projectId, equipmentId)}/audio`, { method: "POST", body: JSON.stringify({ selection, processing }), signal });
  if (result?.equipmentId !== equipmentId || !mediaUrl(result.url)) throw new Error("위치별 음원 응답 형식을 확인하세요.");
  return result;
}
export async function acknowledgeAlarm(projectId, equipmentId, alarmId) {
  return monitoringRequest(`${equipmentPath(projectId, equipmentId)}/alarms/${encodeURIComponent(alarmId)}/acknowledge`, { method: "POST" });
}
