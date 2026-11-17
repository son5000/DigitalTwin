import { assertProjectId, isRecord, projectApiBase, projectRequest } from "./projectConfigurationApi.js";

export function equipmentMappingPath(projectId, equipmentId) {
  assertProjectId(projectId);
  if (typeof equipmentId !== "string" || !equipmentId) throw new Error("설비 ID를 확인해 주세요.");
  return `/equipment-mappings?${new URLSearchParams({ projectId, equipmentId })}`;
}

export async function loadEquipmentMapping(projectId, equipmentId, signal) {
  let result;
  try { result = await projectRequest(equipmentMappingPath(projectId, equipmentId), { signal }); }
  catch (error) { if (error.status === 404) return null; throw error; }
  if (result?.projectId !== projectId || result.equipmentId !== equipmentId || typeof result.enclosureUid !== "string" || !result.enclosureUid) {
    throw new Error("서버의 설비·함체 매핑을 확인해 주세요.");
  }
  return result.enclosureUid;
}

export async function loadEnclosureSnapshot(enclosureUid, viewType, signal) {
  if (typeof enclosureUid !== "string" || !enclosureUid || !["VISION", "THERMAL", "ULTRASONIC"].includes(viewType)) {
    throw new Error("함체 관측 요청을 확인해 주세요.");
  }
  const result = await projectRequest(`/enclosures/${encodeURIComponent(enclosureUid)}/snapshot?view_type=${viewType}`, {
    signal, cache: "no-store",
  });
  if (!isRecord(result?.enclosure) || result.enclosure.uid !== enclosureUid || !Array.isArray(result.slots)
    || !Array.isArray(result.observations) || !Array.isArray(result.alarms)
    || !Number.isFinite(Date.parse(result.server_time))) {
    throw new Error("서버의 함체 스냅샷 형식을 확인해 주세요.");
  }
  return result;
}

export function viewerEventsUrl(base = projectApiBase) {
  if (!base) throw new Error("프로젝트 API 주소가 설정되지 않았습니다.");
  const url = new URL(`${base}/events`, globalThis.location?.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

export function openViewerEvents() {
  return new WebSocket(viewerEventsUrl());
}

export function summarizeEnclosure(equipmentId, snapshots, sensorBindings) {
  const slots = snapshots.flatMap((item) => item.slots);
  const alarms = snapshots.flatMap((item) => item.alarms).filter((item) => ["OPEN", "ACKED"].includes(item.state));
  const observations = snapshots.flatMap((item) => item.observations);
  const serverTime = snapshots[0]?.server_time ?? null;
  const severity = alarms.some((item) => ["MAJOR", "CRITICAL"].includes(item.severity)) ? "DANGER"
    : alarms.some((item) => item.severity === "WARNING") ? "WARNING" : null;
  const measuredAt = observations.map((item) => item.time).filter((value) => Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const age = measuredAt ? Date.now() - Date.parse(measuredAt) : Infinity;
  const freshObservation = age >= -5000 && age <= 60000;
  const viewReady = snapshots.some((item) => item.view?.status === "READY");
  const status = severity || (viewReady && freshObservation ? "NORMAL" : "NO_DATA");
  const equipment = { equipmentId, status, measuredAt: severity ? serverTime : status === "NORMAL" ? measuredAt : null,
    quality: status === "NO_DATA" ? "NO_DATA" : "GOOD", staleAfterMs: 60000 };
  const sensors = sensorBindings.flatMap((binding) => {
    if (!binding.equipmentIds?.includes(equipmentId)) return [];
    const slot = slots.find((item) => String(item.sensor_id) === String(binding.serverSensorId)
      && binding.serverSensorId != null);
    return [{ bindingId: binding.id, equipmentId,
      connectionStatus: ["ONLINE", "OFFLINE", "UNREGISTERED", "FAULT"].includes(slot?.status) ? slot.status : "UNKNOWN",
      measuredAt: slot ? serverTime : null, quality: slot ? "GOOD" : "NO_DATA", staleAfterMs: 60000 }];
  });
  return { equipment, sensors };
}
